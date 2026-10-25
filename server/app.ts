import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { db } from './db.js';
import { extractInvoiceWithGemini, getSampleInvoiceData } from './ocr.js';

dotenv.config();

const app = express();
const JWT_SECRET = process.env.AUTH_SECRET || 'apex-medi-sales-secret-key-2026';

// Request parsing
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// CORS & Preflight handling
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Multer setup for file uploads in memory
const upload = multer({
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDF documents are allowed'));
    }
  },
});

// Auth Middleware
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired session token' });
    }
    req.user = decoded;
    next();
  });
}

// Create dedicated API router
const apiRouter = express.Router();

// Health check endpoint
apiRouter.get('/health', (_req: Request, res: Response) => {
  return res.json({
    status: 'ok',
    store: 'APEX MEDI SALES',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
  });
});

// ----------------------------------------------------
// 1. AUTHENTICATION & ACCOUNT ENDPOINTS
// ----------------------------------------------------
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = email.trim();
    const user = db.getUserByEmail(cleanEmail);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. Please verify your email and password.' });
    }

    const isValid = bcrypt.compareSync(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials. Please verify your email and password.' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    db.logAudit({
      userId: user.id,
      userName: user.name,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      details: `User ${user.email} logged in successfully`,
      ipAddress: req.ip,
    });

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
});

apiRouter.get('/auth/me', authenticateToken, (req: any, res: Response) => {
  const user = db.getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  });
});

apiRouter.post('/auth/change-password', authenticateToken, (req: any, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long' });
    }

    const user = db.getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isValid = bcrypt.compareSync(currentPassword, user.passwordHash);
    if (!isValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(newPassword, salt);

    db.updateUser(user.id, {
      passwordHash: newHash,
      mustChangePassword: false,
    });

    db.logAudit({
      userId: user.id,
      userName: user.name,
      action: 'CHANGE_PASSWORD',
      entityType: 'User',
      entityId: user.id,
      details: 'Password was changed securely',
      ipAddress: req.ip,
    });

    return res.json({ message: 'Password changed successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error updating password' });
  }
});

apiRouter.post('/auth/update-account', authenticateToken, (req: any, res: Response) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const updated = db.updateUser(req.user.id, {
      name: name.trim(),
      email: email.trim(),
    });

    return res.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error updating profile' });
  }
});

// ----------------------------------------------------
// 2. BUSINESS PROFILE
// ----------------------------------------------------
apiRouter.get('/profile', (_req: Request, res: Response) => {
  return res.json(db.getProfile());
});

apiRouter.put('/profile', authenticateToken, (req: any, res: Response) => {
  try {
    const updated = db.updateProfile(req.body);
    db.logAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      action: 'UPDATE_PROFILE',
      entityType: 'BusinessProfile',
      entityId: updated.id,
      details: 'Updated business details & billing parameters',
    });
    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 3. MEDICINES & BATCHES
// ----------------------------------------------------
apiRouter.get('/medicines', (_req: Request, res: Response) => {
  const medicines = db.getMedicines();
  const batches = db.getBatches();

  const result = medicines.map((med) => {
    const medBatches = batches.filter((b) => b.medicineId === med.id);
    const totalStock = medBatches.reduce((acc, b) => acc + b.currentQty, 0);
    return {
      ...med,
      batches: medBatches,
      totalStock,
    };
  });

  return res.json(result);
});

apiRouter.post('/medicines', authenticateToken, (req: any, res: Response) => {
  try {
    const newMed = db.addMedicine(req.body);
    db.logAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      action: 'ADD_MEDICINE',
      entityType: 'Medicine',
      entityId: newMed.id,
      details: `Added medicine ${newMed.name} (${newMed.dosageForm})`,
    });
    return res.status(201).json(newMed);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.put('/medicines/:id', authenticateToken, (req: any, res: Response) => {
  try {
    const updated = db.updateMedicine(req.params.id, req.body);
    return res.json(updated);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/medicines/:id', authenticateToken, (req: any, res: Response) => {
  try {
    db.deleteMedicine(req.params.id);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/batches', (req: Request, res: Response) => {
  const medicineId = req.query.medicineId as string | undefined;
  const batches = db.getBatches(medicineId);
  const medicines = db.getMedicines();

  const enriched = batches.map((b) => {
    const med = medicines.find((m) => m.id === b.medicineId);
    return {
      ...b,
      medicineName: med?.name || 'Unknown',
      packSize: med?.packSize || '',
      hsnCode: med?.hsnCode || '',
    };
  });

  return res.json(enriched);
});

apiRouter.post('/batches', authenticateToken, (req: any, res: Response) => {
  try {
    const newBatch = db.addBatch(req.body);
    return res.status(201).json(newBatch);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.put('/batches/:id', authenticateToken, (req: any, res: Response) => {
  try {
    const updated = db.updateBatch(req.params.id, req.body);
    return res.json(updated);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/inventory/adjust', authenticateToken, (req: any, res: Response) => {
  try {
    const { batchId, newQuantity, reason } = req.body;
    if (!batchId || newQuantity === undefined || !reason) {
      return res.status(400).json({ error: 'batchId, newQuantity, and reason are required' });
    }

    const result = db.adjustStock({
      batchId,
      newQuantity: Number(newQuantity),
      reason,
      userId: req.user?.id,
      userName: req.user?.name,
    });

    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 4. SUPPLIERS & CUSTOMERS
// ----------------------------------------------------
apiRouter.get('/suppliers', (_req: Request, res: Response) => {
  return res.json(db.getSuppliers());
});

apiRouter.post('/suppliers', authenticateToken, (req: any, res: Response) => {
  try {
    const sup = db.addSupplier(req.body);
    return res.status(201).json(sup);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.put('/suppliers/:id', authenticateToken, (req: any, res: Response) => {
  try {
    const sup = db.updateSupplier(req.params.id, req.body);
    return res.json(sup);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/customers', (_req: Request, res: Response) => {
  return res.json(db.getCustomers());
});

apiRouter.post('/customers', authenticateToken, (req: any, res: Response) => {
  try {
    const cust = db.addCustomer(req.body);
    return res.status(201).json(cust);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.put('/customers/:id', authenticateToken, (req: any, res: Response) => {
  try {
    const cust = db.updateCustomer(req.params.id, req.body);
    return res.json(cust);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 5. PURCHASES & INVOICE OCR
// ----------------------------------------------------
apiRouter.get('/purchases', (_req: Request, res: Response) => {
  return res.json(db.getPurchases());
});

apiRouter.post('/purchases', authenticateToken, (req: any, res: Response) => {
  try {
    const purchase = db.recordPurchase(req.body, req.user?.id, req.user?.name);
    return res.status(201).json(purchase);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/ocr/upload', authenticateToken, upload.single('invoiceFile'), async (req: any, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload an image (JPG/PNG) or PDF invoice' });
    }

    const mimeType = req.file.mimetype;
    const fileBuffer = req.file.buffer;

    const extracted = await extractInvoiceWithGemini(fileBuffer, mimeType);
    return res.json(extracted);
  } catch (err: any) {
    console.error('OCR Extraction failed:', err.message);
    return res.status(500).json({
      error: err.message || 'OCR extraction failed. You can use reference samples or enter rows manually.',
    });
  }
});

apiRouter.get('/ocr/samples/:id', (req: Request, res: Response) => {
  const sampleId = req.params.id as 'kroyf_distributor' | 'apex_tax_invoice';
  try {
    const data = getSampleInvoiceData(sampleId);
    return res.json(data);
  } catch (err: any) {
    return res.status(404).json({ error: 'Sample not found' });
  }
});

// ----------------------------------------------------
// 6. SALES BILLING & INVOICE VERIFICATION
// ----------------------------------------------------
apiRouter.get('/sales', (_req: Request, res: Response) => {
  return res.json(db.getSales());
});

apiRouter.post('/sales', authenticateToken, (req: any, res: Response) => {
  try {
    const sale = db.recordSale(req.body, req.user?.id, req.user?.name);
    return res.status(201).json(sale);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/sales/:id/cancel', authenticateToken, (req: any, res: Response) => {
  try {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: 'Cancellation reason is mandatory' });
    }
    const cancelled = db.cancelSale(req.params.id, reason, req.user?.id, req.user?.name);
    return res.json(cancelled);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/verify-invoice/:token', (req: Request, res: Response) => {
  const { token } = req.params;
  const sales = db.getSales();
  const sale = sales.find((s) => s.verificationToken === token);

  if (!sale) {
    return res.status(404).json({
      valid: false,
      message: 'Invalid or unrecognized invoice verification code.',
    });
  }

  const profile = db.getProfile();
  return res.json({
    valid: true,
    invoiceNumber: sale.invoiceNumber,
    storeName: profile.storeName,
    storeGstin: profile.gstin,
    invoiceDate: sale.invoiceDate,
    customerName: sale.customerName,
    grandTotal: sale.grandTotal,
    paymentStatus: sale.paymentStatus,
    paymentMode: sale.paymentMode,
    isCancelled: sale.isCancelled,
    itemsCount: sale.items.length,
    message: sale.isCancelled
      ? 'WARNING: This invoice was officially CANCELLED.'
      : 'AUTHENTIC: This invoice was issued by Apex Medi Sales ERP.',
  });
});

// ----------------------------------------------------
// 7. PAYMENTS & LEDGERS
// ----------------------------------------------------
apiRouter.get('/ledgers/customer/:id', (req: Request, res: Response) => {
  return res.json(db.getCustomerLedger(req.params.id));
});

apiRouter.get('/ledgers/supplier/:id', (req: Request, res: Response) => {
  return res.json(db.getSupplierLedger(req.params.id));
});

apiRouter.get('/payments', (_req: Request, res: Response) => {
  return res.json(db.getPayments());
});

apiRouter.post('/payments', authenticateToken, (req: any, res: Response) => {
  try {
    const payment = db.recordPayment(req.body, req.user?.id, req.user?.name);
    return res.status(201).json(payment);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 8. DASHBOARD & REPORTS
// ----------------------------------------------------
apiRouter.get('/reports/dashboard', (_req: Request, res: Response) => {
  const sales = db.getSales();
  const purchases = db.getPurchases();
  const medicines = db.getMedicines();
  const batches = db.getBatches();
  const customers = db.getCustomers();
  const suppliers = db.getSuppliers();

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const activeSales = sales.filter((s) => !s.isCancelled);
  const todaySales = activeSales.filter((s) => s.invoiceDate && s.invoiceDate.startsWith(todayStr));
  const todaySalesTotal = todaySales.reduce((acc, s) => acc + s.grandTotal, 0);

  const todayPurchases = purchases.filter((p) => p.invoiceDate && p.invoiceDate.startsWith(todayStr));
  const todayPurchasesTotal = todayPurchases.reduce((acc, p) => acc + p.grandTotal, 0);

  let totalInventoryValue = 0;
  let totalSellingValue = 0;
  let lowStockCount = 0;
  let expiredCount = 0;
  let expiringWithin30 = 0;
  let expiringWithin60 = 0;
  let expiringWithin90 = 0;

  const nowMs = today.getTime();
  const d30 = 30 * 24 * 60 * 60 * 1000;
  const d60 = 60 * 24 * 60 * 60 * 1000;
  const d90 = 90 * 24 * 60 * 60 * 1000;

  for (const b of batches) {
    const cost = b.purchaseRate * b.currentQty;
    const sell = b.sellingRate * b.currentQty;
    totalInventoryValue += cost;
    totalSellingValue += sell;

    const expMs = new Date(b.expiryDate).getTime();
    const diff = expMs - nowMs;

    if (diff < 0) {
      expiredCount += b.currentQty > 0 ? 1 : 0;
    } else if (diff <= d30) {
      expiringWithin30 += 1;
    } else if (diff <= d60) {
      expiringWithin60 += 1;
    } else if (diff <= d90) {
      expiringWithin90 += 1;
    }
  }

  for (const m of medicines) {
    const medBatches = batches.filter((b) => b.medicineId === m.id);
    const qty = medBatches.reduce((acc, b) => acc + b.currentQty, 0);
    if (qty <= m.minStockAlert) {
      lowStockCount++;
    }
  }

  const totalCustomerReceivables = customers.reduce((acc, c) => acc + (c.currentBalance > 0 ? c.currentBalance : 0), 0);
  const totalSupplierPayables = suppliers.reduce((acc, s) => acc + (s.currentBalance > 0 ? s.currentBalance : 0), 0);

  let totalSalesRevenue = 0;
  let totalCostOfGoodsSold = 0;
  for (const sale of activeSales) {
    totalSalesRevenue += sale.taxableAmount;
    for (const item of sale.items) {
      const b = batches.find((x) => x.id === item.batchId);
      const costRate = b ? b.purchaseRate : item.sellingRate * 0.7;
      totalCostOfGoodsSold += costRate * item.quantity;
    }
  }
  const estimatedGrossProfit = Math.max(0, totalSalesRevenue - totalCostOfGoodsSold);

  return res.json({
    todaySalesTotal,
    todaySalesCount: todaySales.length,
    todayPurchasesTotal,
    todayPurchasesCount: todayPurchases.length,
    totalInventoryValue: Math.round(totalInventoryValue),
    totalSellingValue: Math.round(totalSellingValue),
    totalSKUs: medicines.length,
    totalBatches: batches.length,
    lowStockCount,
    expiringWithin30,
    expiringWithin60,
    expiringWithin90,
    expiredCount,
    totalCustomerReceivables,
    totalSupplierPayables,
    estimatedGrossProfit: Math.round(estimatedGrossProfit),
    recentSales: activeSales.slice(0, 5),
    recentPurchases: purchases.slice(0, 5),
  });
});

apiRouter.get('/reports/movements', (_req: Request, res: Response) => {
  return res.json(db.getStockMovements());
});

apiRouter.get('/reports/audit-logs', authenticateToken, (_req: Request, res: Response) => {
  return res.json(db.getAuditLogs());
});

// ----------------------------------------------------
// Normalize URL for Vercel serverless rewrites if needed
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (!req.url.startsWith('/api') && req.originalUrl && req.originalUrl.startsWith('/api')) {
    req.url = req.originalUrl;
  }
  next();
});

// Mount all API endpoints strictly under /api
app.use('/api', apiRouter);

// Scoped 404 JSON only for unmatched API requests inside apiRouter
apiRouter.use((req: Request, res: Response) => {
  return res.status(404).json({
    error: 'API endpoint not found',
    requestedPath: req.originalUrl || req.url,
    method: req.method,
  });
});

// Centralized error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled server error:', err);
  const status = typeof err.status === 'number' ? err.status : 500;
  return res.status(status).json({
    error: err.message || 'Internal Server Error',
  });
});

export default app;
