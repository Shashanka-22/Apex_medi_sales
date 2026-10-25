import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { db, User } from './server/db.js';
import { extractInvoiceWithGemini, getSampleInvoiceData } from './server/ocr.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.AUTH_SECRET || 'apex-medi-sales-secret-key-2026';

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

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

// ----------------------------------------------------
// 1. AUTHENTICATION & ACCOUNT ENDPOINTS
// ----------------------------------------------------
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.getUserByEmail(email.trim());
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

app.get('/api/auth/me', authenticateToken, (req: any, res) => {
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

app.post('/api/auth/change-password', authenticateToken, (req: any, res) => {
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

app.post('/api/auth/update-account', authenticateToken, (req: any, res) => {
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
app.get('/api/profile', (_req, res) => {
  return res.json(db.getProfile());
});

app.put('/api/profile', authenticateToken, (req: any, res) => {
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
app.get('/api/medicines', (_req, res) => {
  const medicines = db.getMedicines();
  const batches = db.getBatches();

  // Combine medicines with their current batches and total available stock
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

app.post('/api/medicines', authenticateToken, (req: any, res) => {
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

app.put('/api/medicines/:id', authenticateToken, (req: any, res) => {
  try {
    const updated = db.updateMedicine(req.params.id, req.body);
    return res.json(updated);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

app.delete('/api/medicines/:id', authenticateToken, (req: any, res) => {
  try {
    db.deleteMedicine(req.params.id);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

app.get('/api/batches', (req, res) => {
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

app.post('/api/batches', authenticateToken, (req: any, res) => {
  try {
    const newBatch = db.addBatch(req.body);
    return res.status(201).json(newBatch);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

app.put('/api/batches/:id', authenticateToken, (req: any, res) => {
  try {
    const updated = db.updateBatch(req.params.id, req.body);
    return res.json(updated);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/inventory/adjust', authenticateToken, (req: any, res) => {
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
app.get('/api/suppliers', (_req, res) => {
  return res.json(db.getSuppliers());
});

app.post('/api/suppliers', authenticateToken, (req: any, res) => {
  try {
    const sup = db.addSupplier(req.body);
    return res.status(201).json(sup);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

app.put('/api/suppliers/:id', authenticateToken, (req: any, res) => {
  try {
    const sup = db.updateSupplier(req.params.id, req.body);
    return res.json(sup);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

app.get('/api/customers', (_req, res) => {
  return res.json(db.getCustomers());
});

app.post('/api/customers', authenticateToken, (req: any, res) => {
  try {
    const cust = db.addCustomer(req.body);
    return res.status(201).json(cust);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

app.put('/api/customers/:id', authenticateToken, (req: any, res) => {
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
app.get('/api/purchases', (_req, res) => {
  return res.json(db.getPurchases());
});

app.post('/api/purchases', authenticateToken, (req: any, res) => {
  try {
    const purchase = db.recordPurchase(req.body, req.user?.id, req.user?.name);
    return res.status(201).json(purchase);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// OCR File Upload & Extraction
app.post('/api/ocr/upload', authenticateToken, upload.single('invoiceFile'), async (req: any, res) => {
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

// Reference OCR Samples (APEX MEDI SALES reference distributor invoice & tax invoice)
app.get('/api/ocr/samples/:id', (req, res) => {
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
app.get('/api/sales', (_req, res) => {
  return res.json(db.getSales());
});

app.post('/api/sales', authenticateToken, (req: any, res) => {
  try {
    const sale = db.recordSale(req.body, req.user?.id, req.user?.name);
    return res.status(201).json(sale);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/sales/:id/cancel', authenticateToken, (req: any, res) => {
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

// Public Invoice Verification for QR code scans
app.get('/api/verify-invoice/:token', (req, res) => {
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
app.get('/api/ledgers/customer/:id', (req, res) => {
  return res.json(db.getCustomerLedger(req.params.id));
});

app.get('/api/ledgers/supplier/:id', (req, res) => {
  return res.json(db.getSupplierLedger(req.params.id));
});

app.get('/api/payments', (_req, res) => {
  return res.json(db.getPayments());
});

app.post('/api/payments', authenticateToken, (req: any, res) => {
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
app.get('/api/reports/dashboard', (_req, res) => {
  const sales = db.getSales();
  const purchases = db.getPurchases();
  const medicines = db.getMedicines();
  const batches = db.getBatches();
  const customers = db.getCustomers();
  const suppliers = db.getSuppliers();

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Today's Sales
  const activeSales = sales.filter((s) => !s.isCancelled);
  const todaySales = activeSales.filter((s) => s.invoiceDate && s.invoiceDate.startsWith(todayStr));
  const todaySalesTotal = todaySales.reduce((acc, s) => acc + s.grandTotal, 0);

  // Today's Purchases
  const todayPurchases = purchases.filter((p) => p.invoiceDate && p.invoiceDate.startsWith(todayStr));
  const todayPurchasesTotal = todayPurchases.reduce((acc, p) => acc + p.grandTotal, 0);

  // Stock valuation and alerts
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

  // Outstanding balances
  const totalCustomerReceivables = customers.reduce((acc, c) => acc + (c.currentBalance > 0 ? c.currentBalance : 0), 0);
  const totalSupplierPayables = suppliers.reduce((acc, s) => acc + (s.currentBalance > 0 ? s.currentBalance : 0), 0);

  // Estimated gross profit on completed sales
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

app.get('/api/reports/movements', (_req, res) => {
  return res.json(db.getStockMovements());
});

app.get('/api/reports/audit-logs', authenticateToken, (_req, res) => {
  return res.json(db.getAuditLogs());
});

// ----------------------------------------------------
// 9. VITE DEV MIDDLEWARE OR STATIC PRODUCTION SERVE
// ----------------------------------------------------
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Apex Medi Sales ERP Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
