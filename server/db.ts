import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { neonAdapter } from './neon.js';
import { PurchaseImportRecord } from './ocr.js';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'ADMIN' | 'PHARMACIST' | 'BILLER';
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessProfile {
  id: string;
  storeName: string;
  ownerName: string;
  address: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  phone: string;
  email: string;
  gstin: string;
  dlNo1: string;
  dlNo2: string;
  foodLic: string;
  invoicePrefix: string;
  invoiceFooter: string;
  termsConditions: string;
  bankName: string;
  accountNo: string;
  ifscCode: string;
  upiId: string;
  roundOffPreference: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Medicine {
  id: string;
  name: string;
  genericName?: string;
  manufacturer?: string;
  dosageForm: string;
  strength?: string;
  packSize: string;
  uom: string;
  hsnCode: string;
  barcode?: string;
  isPrescriptionRequired: boolean;
  minStockAlert: number;
  taxRate: number; // e.g. 5, 12, 18, 0
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MedicineBatch {
  id: string;
  medicineId: string;
  batchNumber: string;
  mfgDate?: string;
  expiryDate: string; // YYYY-MM-DD
  purchaseRate: number;
  mrp: number;
  sellingRate: number;
  initialQty: number;
  currentQty: number;
  freeQty: number;
  supplierId?: string;
  purchaseInvoiceRef?: string;
  gstRate: number;
  discount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  address?: string;
  city?: string;
  state: string;
  stateCode: string;
  phone?: string;
  email?: string;
  gstin?: string;
  dlNo?: string;
  openingBalance: number;
  currentBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  contactPerson?: string;
  address?: string;
  city?: string;
  state: string;
  stateCode: string;
  phone?: string;
  email?: string;
  gstin?: string;
  dlNo1?: string;
  dlNo2?: string;
  openingBalance: number;
  currentBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  medicineId: string;
  medicineName?: string;
  batchNumber: string;
  expiryDate: string;
  packing?: string;
  hsnCode?: string;
  quantity: number;
  freeQty: number;
  mrp: number;
  purchaseRate: number;
  discountPercent: number;
  gstRate: number;
  lineAmount: number;
}

export interface Purchase {
  id: string;
  invoiceNumber: string;
  supplierInvoiceNumber: string;
  supplierId: string;
  supplierName?: string;
  invoiceDate: string;
  entryDate: string;
  paymentTerms: string;
  paymentStatus: 'Paid' | 'Pending' | 'Partial';
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  discountAmount: number;
  roundOff: number;
  grandTotal: number;
  notes?: string;
  documentPath?: string;
  items: PurchaseItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  id: string;
  saleId: string;
  medicineId: string;
  medicineName: string;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  packing?: string;
  hsnCode?: string;
  quantity: number;
  freeQty: number;
  mrp: number;
  sellingRate: number;
  discountPercent: number;
  gstRate: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  lineTotal: number;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  invoiceSeries: string;
  customerId?: string;
  customerName: string;
  customerAddress?: string;
  customerGstin?: string;
  customerStateCode?: string;
  invoiceDate: string;
  paymentMode: 'Cash' | 'UPI' | 'Card' | 'Credit';
  paymentStatus: 'Paid' | 'Partial' | 'Unpaid';
  totalItems: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  discountAmount: number;
  additionalCharges: number;
  roundOff: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  verificationToken: string;
  isCancelled: boolean;
  cancellationReason?: string;
  cancelledAt?: string;
  items: SaleItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  voucherNumber: string;
  voucherType: 'RECEIPT' | 'PAYMENT';
  customerId?: string;
  supplierId?: string;
  saleId?: string;
  purchaseId?: string;
  amount: number;
  paymentMode: 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque';
  referenceNumber?: string;
  notes?: string;
  paymentDate: string;
  createdAt: string;
}

export interface CustomerLedgerEntry {
  id: string;
  customerId: string;
  date: string;
  voucherType: string;
  voucherNumber: string;
  debit: number;
  credit: number;
  balance: number;
  reference?: string;
  remarks?: string;
  createdAt: string;
}

export interface SupplierLedgerEntry {
  id: string;
  supplierId: string;
  date: string;
  voucherType: string;
  voucherNumber: string;
  debit: number;
  credit: number;
  balance: number;
  reference?: string;
  remarks?: string;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  medicineId: string;
  medicineName?: string;
  batchId: string;
  batchNumber: string;
  type: 'PURCHASE' | 'SALE' | 'SALE_RETURN' | 'PURCHASE_RETURN' | 'ADJUSTMENT' | 'EXPIRY_WRITE_OFF';
  quantity: number;
  previousQty: number;
  newQty: number;
  referenceType?: string;
  referenceId?: string;
  reason?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  userName?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: string;
  ipAddress?: string;
  createdAt: string;
}

export interface DatabaseState {
  users: User[];
  businessProfile: BusinessProfile;
  medicines: Medicine[];
  batches: MedicineBatch[];
  suppliers: Supplier[];
  customers: Customer[];
  purchases: Purchase[];
  sales: Sale[];
  payments: Payment[];
  customerLedgers: CustomerLedgerEntry[];
  supplierLedgers: SupplierLedgerEntry[];
  stockMovements: StockMovement[];
  auditLogs: AuditLog[];
  purchaseImports?: PurchaseImportRecord[];
}

function getStoragePaths() {
  const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const bundledFile = path.resolve(process.cwd(), 'data', 'medical_store.db.json');
  
  if (isServerless) {
    const tmpDir = '/tmp/data';
    return {
      dir: tmpDir,
      file: path.resolve(tmpDir, 'medical_store.db.json'),
      bundledFile,
    };
  }

  const localDir = path.resolve(process.cwd(), 'data');
  return {
    dir: localDir,
    file: path.resolve(localDir, 'medical_store.db.json'),
    bundledFile,
  };
}

class DatabaseEngine {
  private state: DatabaseState | null = null;
  private neonSyncInProgress = false;

  constructor() {
    this.ensureInitialized();
    this.syncFromNeon();
  }

  public async syncFromNeon(): Promise<boolean> {
    if (this.neonSyncInProgress || !neonAdapter.isAvailable()) return false;
    this.neonSyncInProgress = true;
    try {
      const neonData = await neonAdapter.loadAllFromNeon();
      if (neonData && (neonData.businessProfile || (neonData.users && neonData.users.length > 0))) {
        this.state = {
          users: neonData.users && neonData.users.length > 0 ? neonData.users : (this.state?.users || []),
          businessProfile: neonData.businessProfile || (this.state?.businessProfile as any),
          medicines: neonData.medicines || [],
          batches: neonData.batches || [],
          suppliers: neonData.suppliers || [],
          customers: neonData.customers || [],
          purchases: neonData.purchases || [],
          sales: neonData.sales || [],
          payments: neonData.payments || [],
          customerLedgers: neonData.customerLedgers || [],
          supplierLedgers: neonData.supplierLedgers || [],
          stockMovements: neonData.stockMovements || [],
          auditLogs: neonData.auditLogs || [],
          purchaseImports: neonData.purchaseImports || [],
        };
        this.persist();
        console.log(`Neon PostgreSQL: Synced live state (${this.state.medicines.length} medicines, ${this.state.batches.length} batches, ${this.state.sales.length} sales)`);
        return true;
      }
      return false;
    } catch (err: any) {
      console.warn('Neon sync notice:', err.message);
      return false;
    } finally {
      this.neonSyncInProgress = false;
    }
  }

  private ensureInitialized() {
    if (this.state) return;
    const { dir, file, bundledFile } = getStoragePaths();

    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (err) {
      console.warn('Could not create directory:', dir, err);
    }

    // 1. Try reading existing writable database file
    if (fs.existsSync(file)) {
      try {
        const raw = fs.readFileSync(file, 'utf-8');
        this.state = JSON.parse(raw);
        return;
      } catch (err) {
        console.error('Failed reading existing db file:', err);
      }
    }

    // 2. Try reading pre-bundled database file if running on Vercel
    if (fs.existsSync(bundledFile)) {
      try {
        const raw = fs.readFileSync(bundledFile, 'utf-8');
        this.state = JSON.parse(raw);
        this.persist();
        return;
      } catch (err) {
        console.error('Failed reading bundled db file:', err);
      }
    }

    // 3. Fall back to initial seed state
    this.state = this.getInitialSeedState();
    this.persist();
  }

  private persist() {
    if (!this.state) return;
    try {
      const { dir, file } = getStoragePaths();
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(file, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Persist to filesystem skipped or failed (common in serverless):', err);
    }
  }

  private getInitialSeedState(): DatabaseState {
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'ApexAdmin@2026';
    const adminSalt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(adminPassword, adminSalt);

    const adminUser: User = {
      id: 'usr_admin_001',
      name: process.env.INITIAL_ADMIN_NAME || 'Apex Admin',
      email: process.env.INITIAL_ADMIN_EMAIL || 'admin@apexmedisales.com',
      passwordHash,
      role: 'ADMIN',
      mustChangePassword: false,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    };

    const businessProfile: BusinessProfile = {
      id: 'biz_001',
      storeName: 'APEX MEDI SALES',
      ownerName: 'Shashank Naik',
      address: 'DOOR NO.-VI/143, ALVEKODI SHIRALI ROAD, BHATKAL, SHIRALI',
      city: 'UTTARA KANNADA',
      state: 'Karnataka',
      stateCode: '29',
      pincode: '581354',
      phone: '9113917343',
      email: 'apexmedisales@gmail.com',
      gstin: '29BZWWPN5791F1ZE',
      dlNo1: 'KA-KW1-299954',
      dlNo2: 'KA-KW1-299955 & KA-KW1-299956',
      foodLic: '11223344556677',
      invoicePrefix: 'AM',
      invoiceFooter: 'Thank you for your business. For any queries, please contact Apex Medi Sales at 9113917343.',
      termsConditions: '1. Goods once sold will not be taken back or exchanged.\n2. Kindly make Payment within 30 days otherwise interest @30 % p.a. will be charged.\n3. We are not responsible for any breakage, shortage, leakage, damage or any kind of complaints as soon as goods leave our premises.\n4. All disputes subject to BHATKAL Jurisdiction only. E.& O. E.',
      bankName: 'State Bank of India',
      accountNo: '38492019482',
      ifscCode: 'SBIN0004128',
      upiId: '9113917343@upi',
      roundOffPreference: true,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    };

    return {
      users: [adminUser],
      businessProfile,
      medicines: [],
      batches: [],
      suppliers: [],
      customers: [],
      purchases: [],
      sales: [],
      payments: [],
      customerLedgers: [],
      supplierLedgers: [],
      stockMovements: [],
      auditLogs: [],
      purchaseImports: [],
    };
  }

  // --- Read Operations ---
  public getState(): DatabaseState {
    this.ensureInitialized();
    return this.state!;
  }

  public getUsers(): User[] {
    return this.getState().users;
  }

  public getUserByEmail(email: string): User | undefined {
    const target = (email || '').toLowerCase().trim();
    return this.getState().users.find((u) => {
      const uEmail = (u.email || '').toLowerCase().trim();
      if (uEmail === target) return true;
      if (
        (target === 'admin@apexmedisales.com' || target === 'apexmedisales@gmail.com') &&
        (uEmail === 'admin@apexmedisales.com' || uEmail === 'apexmedisales@gmail.com')
      ) {
        return true;
      }
      return false;
    });
  }

  public getUserById(id: string): User | undefined {
    return this.getState().users.find((u) => u.id === id);
  }

  public getProfile(): BusinessProfile {
    return this.getState().businessProfile;
  }

  public getMedicines(): Medicine[] {
    return this.getState().medicines;
  }

  public getBatches(medicineId?: string): MedicineBatch[] {
    const batches = this.getState().batches;
    if (medicineId) {
      return batches.filter((b) => b.medicineId === medicineId);
    }
    return batches;
  }

  public getSuppliers(): Supplier[] {
    return this.getState().suppliers;
  }

  public getCustomers(): Customer[] {
    return this.getState().customers;
  }

  public getPurchases(): Purchase[] {
    return this.getState().purchases;
  }

  public getSales(): Sale[] {
    return this.getState().sales;
  }

  public getPayments(): Payment[] {
    return this.getState().payments;
  }

  public getCustomerLedger(customerId: string): CustomerLedgerEntry[] {
    return this.getState().customerLedgers.filter((l) => l.customerId === customerId);
  }

  public getSupplierLedger(supplierId: string): SupplierLedgerEntry[] {
    return this.getState().supplierLedgers.filter((l) => l.supplierId === supplierId);
  }

  public getStockMovements(): StockMovement[] {
    return this.getState().stockMovements;
  }

  public getAuditLogs(): AuditLog[] {
    return this.getState().auditLogs;
  }

  public async getPurchaseImports(): Promise<PurchaseImportRecord[]> {
    try {
      const neonImports = await neonAdapter.getPurchaseImports();
      if (neonImports && neonImports.length > 0) {
        return neonImports;
      }
    } catch (e) {
      // fallback
    }
    const state = this.getState();
    return state.purchaseImports || [];
  }

  public async recordPurchaseImport(imp: PurchaseImportRecord): Promise<PurchaseImportRecord> {
    const state = this.getState();
    if (!state.purchaseImports) state.purchaseImports = [];
    state.purchaseImports.unshift(imp);
    this.persist();
    await neonAdapter.persistPurchaseImport(imp);
    return imp;
  }

  // --- Purchase Import Jobs (Durable, page-by-page state for Vercel & Neon) ---
  private importJobs = new Map<string, any>();

  public async createImportJob(job: any): Promise<any> {
    this.importJobs.set(job.id, job);
    await neonAdapter.persistImportJob(job);
    return job;
  }

  public async getImportJob(id: string): Promise<any | null> {
    if (this.importJobs.has(id)) {
      return this.importJobs.get(id);
    }
    const fromNeon = await neonAdapter.getImportJob(id);
    if (fromNeon) {
      this.importJobs.set(id, fromNeon);
      return fromNeon;
    }
    return null;
  }

  public async getImportJobByHash(fileHash: string): Promise<any | null> {
    for (const job of this.importJobs.values()) {
      if (job.fileHash === fileHash && job.status === 'completed') {
        return job;
      }
    }
    const fromNeon = await neonAdapter.getImportJobByHash(fileHash);
    if (fromNeon) {
      this.importJobs.set(fromNeon.id, fromNeon);
      return fromNeon;
    }
    return null;
  }

  public async updateImportJob(job: any): Promise<any> {
    job.updatedAt = new Date().toISOString();
    this.importJobs.set(job.id, job);
    await neonAdapter.persistImportJob(job);
    return job;
  }

  // --- Write Operations with Persistence ---
  public async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const state = this.getState();
    const idx = state.users.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error('User not found');
    const updated = { ...state.users[idx], ...updates, updatedAt: new Date().toISOString() };
    state.users[idx] = updated;
    this.persist();
    await neonAdapter.persistUser(updated);
    return updated;
  }

  public async updateProfile(updates: Partial<BusinessProfile>): Promise<BusinessProfile> {
    const state = this.getState();
    state.businessProfile = {
      ...state.businessProfile,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.persist();
    await neonAdapter.persistProfile(state.businessProfile);
    return state.businessProfile;
  }

  public async addMedicine(medicine: Omit<Medicine, 'id' | 'createdAt' | 'updatedAt'>): Promise<Medicine> {
    const state = this.getState();
    const newMed: Medicine = {
      ...medicine,
      id: `med_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await neonAdapter.persistMedicine(newMed);
    state.medicines.unshift(newMed);
    this.persist();
    return newMed;
  }

  public async updateMedicine(id: string, updates: Partial<Medicine>): Promise<Medicine> {
    const state = this.getState();
    const idx = state.medicines.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error('Medicine not found');
    const updated = { ...state.medicines[idx], ...updates, updatedAt: new Date().toISOString() };
    await neonAdapter.persistMedicine(updated);
    state.medicines[idx] = updated;
    this.persist();
    return updated;
  }

  public async deleteMedicine(id: string): Promise<void> {
    const state = this.getState();
    const med = state.medicines.find((m) => m.id === id);
    if (!med) throw new Error('Medicine not found');

    const hasSales = state.sales.some((s) => s.items.some((it) => it.medicineId === id));
    const hasPurchases = state.purchases.some((p) => p.items.some((it) => it.medicineId === id));
    if (hasSales || hasPurchases) {
      throw new Error('Cannot delete medicine with existing transaction history (sales or purchases). Set isActive to false instead.');
    }

    await neonAdapter.removeMedicine(id);
    state.medicines = state.medicines.filter((m) => m.id !== id);
    state.batches = state.batches.filter((b) => b.medicineId !== id);
    this.persist();
  }

  public async addBatch(batch: Omit<MedicineBatch, 'id' | 'createdAt' | 'updatedAt'>): Promise<MedicineBatch> {
    const state = this.getState();
    // Check if batch already exists for medicine
    const existing = state.batches.find(
      (b) => b.medicineId === batch.medicineId && b.batchNumber.toLowerCase() === batch.batchNumber.toLowerCase()
    );
    if (existing) {
      // Add quantity to existing batch
      existing.currentQty += batch.currentQty;
      existing.sellingRate = batch.sellingRate;
      existing.mrp = batch.mrp;
      existing.purchaseRate = batch.purchaseRate;
      existing.expiryDate = batch.expiryDate;
      existing.updatedAt = new Date().toISOString();
      await neonAdapter.persistBatch(existing);
      this.persist();
      return existing;
    }

    const newBatch: MedicineBatch = {
      ...batch,
      id: `bat_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await neonAdapter.persistBatch(newBatch);
    state.batches.push(newBatch);
    this.persist();
    return newBatch;
  }

  public async updateBatch(id: string, updates: Partial<MedicineBatch>): Promise<MedicineBatch> {
    const state = this.getState();
    const idx = state.batches.findIndex((b) => b.id === id);
    if (idx === -1) throw new Error('Batch not found');
    const updated = { ...state.batches[idx], ...updates, updatedAt: new Date().toISOString() };
    await neonAdapter.persistBatch(updated);
    state.batches[idx] = updated;
    this.persist();
    return updated;
  }

  public async adjustStock(params: {
    batchId: string;
    newQuantity: number;
    reason: string;
    userId?: string;
    userName?: string;
  }): Promise<{ batch: MedicineBatch; movement: StockMovement }> {
    const state = this.getState();
    let batch = state.batches.find((b) => b.id === params.batchId);
    if (!batch && neonAdapter.isAvailable()) {
      await this.syncFromNeon();
      batch = this.getState().batches.find((b) => b.id === params.batchId);
    }
    if (!batch) throw new Error('Batch not found');
    const medicine = state.medicines.find((m) => m.id === batch.medicineId);

    const prevQty = batch.currentQty;
    const diff = params.newQuantity - prevQty;
    batch.currentQty = params.newQuantity;
    batch.updatedAt = new Date().toISOString();

    const movement: StockMovement = {
      id: `sm_${Date.now()}`,
      medicineId: batch.medicineId,
      medicineName: medicine?.name,
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      type: diff >= 0 ? 'ADJUSTMENT' : 'EXPIRY_WRITE_OFF',
      quantity: diff,
      previousQty: prevQty,
      newQty: params.newQuantity,
      referenceType: 'ManualAdjustment',
      reason: params.reason,
      createdAt: new Date().toISOString(),
    };

    await neonAdapter.updateBatchCurrentQty(batch.id, batch.currentQty);
    await neonAdapter.persistStockMovement(movement);

    state.stockMovements.unshift(movement);
    this.logAudit({
      userId: params.userId,
      userName: params.userName,
      action: 'ADJUST_STOCK',
      entityType: 'MedicineBatch',
      entityId: batch.id,
      details: `Adjusted batch ${batch.batchNumber} from ${prevQty} to ${params.newQuantity}. Reason: ${params.reason}`,
    });

    this.persist();
    return { batch, movement };
  }

  public async addSupplier(supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Promise<Supplier> {
    const state = this.getState();
    const newSup: Supplier = {
      ...supplier,
      id: `sup_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await neonAdapter.persistSupplier(newSup);
    state.suppliers.push(newSup);
    this.persist();
    return newSup;
  }

  public async updateSupplier(id: string, updates: Partial<Supplier>): Promise<Supplier> {
    const state = this.getState();
    const idx = state.suppliers.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error('Supplier not found');
    const updated = { ...state.suppliers[idx], ...updates, updatedAt: new Date().toISOString() };
    await neonAdapter.persistSupplier(updated);
    state.suppliers[idx] = updated;
    this.persist();
    return updated;
  }

  public async deleteSupplier(id: string): Promise<void> {
    const state = this.getState();
    const sup = state.suppliers.find((s) => s.id === id);
    if (!sup) throw new Error('Supplier not found');
    if (Math.abs(sup.currentBalance) > 0.01) {
      throw new Error(`Cannot delete supplier with non-zero balance (₹${sup.currentBalance.toFixed(2)})`);
    }
    const hasPurchases = state.purchases.some((p) => p.supplierId === id);
    if (hasPurchases) {
      throw new Error('Cannot delete supplier with associated purchase invoices');
    }
    await neonAdapter.removeSupplier(id);
    state.suppliers = state.suppliers.filter((s) => s.id !== id);
    this.persist();
  }

  public async addCustomer(customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
    const state = this.getState();
    const newCust: Customer = {
      ...customer,
      id: `cust_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await neonAdapter.persistCustomer(newCust);
    state.customers.push(newCust);
    this.persist();
    return newCust;
  }

  public async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer> {
    const state = this.getState();
    const idx = state.customers.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Customer not found');
    const updated = { ...state.customers[idx], ...updates, updatedAt: new Date().toISOString() };
    await neonAdapter.persistCustomer(updated);
    state.customers[idx] = updated;
    this.persist();
    return updated;
  }

  public async deleteCustomer(id: string): Promise<void> {
    const state = this.getState();
    const cust = state.customers.find((c) => c.id === id);
    if (!cust) throw new Error('Customer not found');
    if (Math.abs(cust.currentBalance) > 0.01) {
      throw new Error(`Cannot delete customer with non-zero balance (₹${cust.currentBalance.toFixed(2)})`);
    }
    const hasSales = state.sales.some((s) => s.customerId === id);
    if (hasSales) {
      throw new Error('Cannot delete customer with associated sales invoices');
    }
    await neonAdapter.removeCustomer(id);
    state.customers = state.customers.filter((c) => c.id !== id);
    this.persist();
  }

  // --- Transactions: Purchases ---
  public async recordPurchase(
    purchaseData: Omit<Purchase, 'id' | 'createdAt' | 'updatedAt'>,
    userId?: string,
    userName?: string
  ): Promise<Purchase> {
    const state = this.getState();

    // Check for duplicate supplier invoice
    const duplicate = state.purchases.find(
      (p) =>
        p.supplierId === purchaseData.supplierId &&
        p.supplierInvoiceNumber.trim().toLowerCase() === purchaseData.supplierInvoiceNumber.trim().toLowerCase()
    );
    if (duplicate) {
      throw new Error(`Supplier invoice '${purchaseData.supplierInvoiceNumber}' has already been imported! (Purchase ref: ${duplicate.invoiceNumber})`);
    }

    const purchaseId = `pur_${Date.now()}`;
    const purchase: Purchase = {
      ...purchaseData,
      id: purchaseId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: purchaseData.items.map((item, i) => ({
        ...item,
        id: `pi_${Date.now()}_${i}`,
        purchaseId,
      })),
    };

    // First, commit the purchase transaction to Neon PostgreSQL
    await neonAdapter.persistPurchase(purchase);

    // Update batch stock and create stock movements in memory and Neon
    for (const item of purchase.items) {
      const existingBatch = state.batches.find(
        (b) => b.medicineId === item.medicineId && b.batchNumber.toLowerCase() === item.batchNumber.toLowerCase()
      );

      const totalQtyToAdd = item.quantity + (item.freeQty || 0);

      if (existingBatch) {
        const prev = existingBatch.currentQty;
        existingBatch.currentQty += totalQtyToAdd;
        existingBatch.purchaseRate = item.purchaseRate;
        existingBatch.mrp = item.mrp;
        existingBatch.expiryDate = item.expiryDate;
        existingBatch.updatedAt = new Date().toISOString();

        const sm: StockMovement = {
          id: `sm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          batchId: existingBatch.id,
          batchNumber: item.batchNumber,
          type: 'PURCHASE',
          quantity: totalQtyToAdd,
          previousQty: prev,
          newQty: existingBatch.currentQty,
          referenceType: 'Purchase',
          referenceId: purchase.invoiceNumber,
          reason: `Supplier Invoice: ${purchase.supplierInvoiceNumber}`,
          createdAt: new Date().toISOString(),
        };
        state.stockMovements.unshift(sm);
        await neonAdapter.persistBatch(existingBatch);
        await neonAdapter.persistStockMovement(sm);
      } else {
        const newBatch: MedicineBatch = {
          id: `bat_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          medicineId: item.medicineId,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate,
          purchaseRate: item.purchaseRate,
          mrp: item.mrp,
          sellingRate: Math.round(item.mrp * 0.85 * 100) / 100,
          initialQty: totalQtyToAdd,
          currentQty: totalQtyToAdd,
          freeQty: item.freeQty || 0,
          supplierId: purchase.supplierId,
          purchaseInvoiceRef: purchase.supplierInvoiceNumber,
          gstRate: item.gstRate,
          discount: item.discountPercent,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        state.batches.push(newBatch);

        const sm: StockMovement = {
          id: `sm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          batchId: newBatch.id,
          batchNumber: item.batchNumber,
          type: 'PURCHASE',
          quantity: totalQtyToAdd,
          previousQty: 0,
          newQty: totalQtyToAdd,
          referenceType: 'Purchase',
          referenceId: purchase.invoiceNumber,
          reason: `New batch from Supplier Inv: ${purchase.supplierInvoiceNumber}`,
          createdAt: new Date().toISOString(),
        };
        state.stockMovements.unshift(sm);
        await neonAdapter.persistBatch(newBatch);
        await neonAdapter.persistStockMovement(sm);
      }
    }

    // Update Supplier Balance and Ledger
    const supplier = state.suppliers.find((s) => s.id === purchase.supplierId);
    if (supplier) {
      supplier.currentBalance += purchase.grandTotal;
      supplier.updatedAt = new Date().toISOString();

      const sLedg: SupplierLedgerEntry = {
        id: `sldg_${Date.now()}`,
        supplierId: supplier.id,
        date: purchase.invoiceDate || new Date().toISOString(),
        voucherType: 'PURCHASE',
        voucherNumber: purchase.invoiceNumber,
        debit: 0,
        credit: purchase.grandTotal,
        balance: supplier.currentBalance,
        reference: purchase.supplierInvoiceNumber,
        remarks: `Purchase: ${purchase.supplierInvoiceNumber}`,
        createdAt: new Date().toISOString(),
      };
      state.supplierLedgers.unshift(sLedg);
      await neonAdapter.persistSupplier(supplier);
      await neonAdapter.persistSupplierLedger(sLedg);
    }

    state.purchases.unshift(purchase);

    this.logAudit({
      userId,
      userName,
      action: 'ADD_PURCHASE',
      entityType: 'Purchase',
      entityId: purchase.id,
      details: `Added purchase ${purchase.invoiceNumber} (Supplier Inv: ${purchase.supplierInvoiceNumber}) for ₹${purchase.grandTotal}`,
    });

    this.persist();
    return purchase;
  }

  // --- Transactions: Sales Billing ---
  public async recordSale(
    saleData: Omit<Sale, 'id' | 'verificationToken' | 'isCancelled' | 'createdAt' | 'updatedAt'>,
    userId?: string,
    userName?: string
  ): Promise<Sale> {
    const state = this.getState();

    // Validate and deduct stock atomically
    for (const item of saleData.items) {
      const batch = state.batches.find((b) => b.id === item.batchId);
      if (!batch) {
        throw new Error(`Batch not found for ${item.medicineName}`);
      }

      // Check if batch is expired
      const expDate = new Date(batch.expiryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expDate < today) {
        throw new Error(`Cannot sell expired medicine: ${item.medicineName} (Batch ${batch.batchNumber} expired on ${batch.expiryDate})`);
      }

      const totalDeduction = item.quantity + (item.freeQty || 0);
      if (batch.currentQty < totalDeduction) {
        throw new Error(`Insufficient stock for ${item.medicineName} (Batch ${batch.batchNumber}). Requested: ${totalDeduction}, Available: ${batch.currentQty}`);
      }
    }

    const saleId = `sale_${Date.now()}`;
    const token = `ver_${saleData.invoiceNumber.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Math.random().toString(36).substring(2, 8)}`;

    const sale: Sale = {
      ...saleData,
      id: saleId,
      verificationToken: token,
      isCancelled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: saleData.items.map((item, idx) => ({
        ...item,
        id: `si_${Date.now()}_${idx}`,
        saleId,
      })),
    };

    // First persist the sale to Neon PostgreSQL
    await neonAdapter.persistSale(sale);

    // Deduct batches and log stock movements
    for (const item of sale.items) {
      const batch = state.batches.find((b) => b.id === item.batchId)!;
      const prevQty = batch.currentQty;
      const totalDeduction = item.quantity + (item.freeQty || 0);
      batch.currentQty -= totalDeduction;
      batch.updatedAt = new Date().toISOString();

      const sm: StockMovement = {
        id: `sm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        medicineId: item.medicineId,
        medicineName: item.medicineName,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        type: 'SALE',
        quantity: -totalDeduction,
        previousQty: prevQty,
        newQty: batch.currentQty,
        referenceType: 'Sale',
        referenceId: sale.invoiceNumber,
        reason: `Sold on Invoice ${sale.invoiceNumber}`,
        createdAt: new Date().toISOString(),
      };
      state.stockMovements.unshift(sm);

      await neonAdapter.updateBatchCurrentQty(batch.id, batch.currentQty);
      await neonAdapter.persistStockMovement(sm);
    }

    // Customer ledger & balance update if customer is registered
    if (sale.customerId && sale.paymentMode === 'Credit') {
      const customer = state.customers.find((c) => c.id === sale.customerId);
      if (customer) {
        customer.currentBalance += sale.balanceAmount;
        customer.updatedAt = new Date().toISOString();

        const cLedg: CustomerLedgerEntry = {
          id: `cldg_${Date.now()}`,
          customerId: customer.id,
          date: sale.invoiceDate || new Date().toISOString(),
          voucherType: 'SALE',
          voucherNumber: sale.invoiceNumber,
          debit: sale.grandTotal,
          credit: sale.paidAmount,
          balance: customer.currentBalance,
          reference: sale.invoiceNumber,
          remarks: `Invoice ${sale.invoiceNumber}`,
          createdAt: new Date().toISOString(),
        };
        state.customerLedgers.unshift(cLedg);

        await neonAdapter.persistCustomer(customer);
        await neonAdapter.persistCustomerLedger(cLedg);
      }
    }

    state.sales.unshift(sale);

    this.logAudit({
      userId,
      userName,
      action: 'CREATE_SALE',
      entityType: 'Sale',
      entityId: sale.id,
      details: `Generated Tax Invoice ${sale.invoiceNumber} for ${sale.customerName}: ₹${sale.grandTotal} (${sale.paymentMode})`,
    });

    this.persist();
    return sale;
  }

  // --- Transactions: Cancel Sale / Return ---
  public async cancelSale(saleId: string, reason: string, userId?: string, userName?: string): Promise<Sale> {
    const state = this.getState();
    const sale = state.sales.find((s) => s.id === saleId || s.invoiceNumber === saleId);
    if (!sale) throw new Error('Sale invoice not found');
    if (sale.isCancelled) throw new Error('Invoice is already cancelled');

    sale.isCancelled = true;
    sale.cancellationReason = reason;
    sale.cancelledAt = new Date().toISOString();
    sale.updatedAt = new Date().toISOString();

    await neonAdapter.persistCancelSale(sale.id, reason);

    // Revert stock back to batches
    for (const item of sale.items) {
      const batch = state.batches.find((b) => b.id === item.batchId);
      const totalReturned = item.quantity + (item.freeQty || 0);

      if (batch) {
        const prev = batch.currentQty;
        batch.currentQty += totalReturned;
        batch.updatedAt = new Date().toISOString();

        const sm: StockMovement = {
          id: `sm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          type: 'SALE_RETURN',
          quantity: totalReturned,
          previousQty: prev,
          newQty: batch.currentQty,
          referenceType: 'SaleReturn',
          referenceId: sale.invoiceNumber,
          reason: `Reversal of cancelled Invoice ${sale.invoiceNumber}: ${reason}`,
          createdAt: new Date().toISOString(),
        };
        state.stockMovements.unshift(sm);

        await neonAdapter.updateBatchCurrentQty(batch.id, batch.currentQty);
        await neonAdapter.persistStockMovement(sm);
      }
    }

    // Revert customer balance if credit sale
    if (sale.customerId && sale.paymentMode === 'Credit') {
      const customer = state.customers.find((c) => c.id === sale.customerId);
      if (customer) {
        customer.currentBalance -= sale.balanceAmount;
        customer.updatedAt = new Date().toISOString();

        const cLedg: CustomerLedgerEntry = {
          id: `cldg_${Date.now()}`,
          customerId: customer.id,
          date: new Date().toISOString(),
          voucherType: 'RETURN',
          voucherNumber: `CN-${sale.invoiceNumber}`,
          debit: 0,
          credit: sale.grandTotal,
          balance: customer.currentBalance,
          reference: sale.invoiceNumber,
          remarks: `Credit Note / Cancel Invoice: ${reason}`,
          createdAt: new Date().toISOString(),
        };
        state.customerLedgers.unshift(cLedg);

        await neonAdapter.persistCustomer(customer);
        await neonAdapter.persistCustomerLedger(cLedg);
      }
    }

    this.logAudit({
      userId,
      userName,
      action: 'CANCEL_SALE',
      entityType: 'Sale',
      entityId: sale.id,
      details: `Cancelled invoice ${sale.invoiceNumber}. Reason: ${reason}`,
    });

    this.persist();
    return sale;
  }

  // --- Transactions: Payments ---
  public async recordPayment(
    paymentData: Omit<Payment, 'id' | 'createdAt'>,
    userId?: string,
    userName?: string
  ): Promise<Payment> {
    const state = this.getState();
    const paymentId = `pmt_${Date.now()}`;
    const payment: Payment = {
      ...paymentData,
      id: paymentId,
      createdAt: new Date().toISOString(),
    };

    await neonAdapter.persistPayment(payment);

    if (payment.voucherType === 'RECEIPT' && payment.customerId) {
      const customer = state.customers.find((c) => c.id === payment.customerId);
      if (customer) {
        customer.currentBalance -= payment.amount;
        customer.updatedAt = new Date().toISOString();

        const cLedg: CustomerLedgerEntry = {
          id: `cldg_${Date.now()}`,
          customerId: customer.id,
          date: payment.paymentDate,
          voucherType: 'RECEIPT',
          voucherNumber: payment.voucherNumber,
          debit: 0,
          credit: payment.amount,
          balance: customer.currentBalance,
          reference: payment.referenceNumber || 'Payment Receipt',
          remarks: payment.notes || `Received via ${payment.paymentMode}`,
          createdAt: new Date().toISOString(),
        };
        state.customerLedgers.unshift(cLedg);
        await neonAdapter.persistCustomer(customer);
        await neonAdapter.persistCustomerLedger(cLedg);
      }
    } else if (payment.voucherType === 'PAYMENT' && payment.supplierId) {
      const supplier = state.suppliers.find((s) => s.id === payment.supplierId);
      if (supplier) {
        supplier.currentBalance -= payment.amount;
        supplier.updatedAt = new Date().toISOString();

        const sLedg: SupplierLedgerEntry = {
          id: `sldg_${Date.now()}`,
          supplierId: supplier.id,
          date: payment.paymentDate,
          voucherType: 'PAYMENT',
          voucherNumber: payment.voucherNumber,
          debit: payment.amount,
          credit: 0,
          balance: supplier.currentBalance,
          reference: payment.referenceNumber || 'Payment Voucher',
          remarks: payment.notes || `Paid via ${payment.paymentMode}`,
          createdAt: new Date().toISOString(),
        };
        state.supplierLedgers.unshift(sLedg);
        await neonAdapter.persistSupplier(supplier);
        await neonAdapter.persistSupplierLedger(sLedg);
      }
    }

    state.payments.unshift(payment);

    this.logAudit({
      userId,
      userName,
      action: 'RECORD_PAYMENT',
      entityType: 'Payment',
      entityId: payment.id,
      details: `${payment.voucherType} of ₹${payment.amount} via ${payment.paymentMode} (${payment.voucherNumber})`,
    });

    this.persist();
    return payment;
  }

  // --- Audit Log ---
  public logAudit(entry: Omit<AuditLog, 'id' | 'createdAt'>): void {
    const state = this.getState();
    const logEntry: AuditLog = {
      ...entry,
      id: `aud_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
    };
    state.auditLogs.unshift(logEntry);
    // Keep max 1000 logs
    if (state.auditLogs.length > 1000) {
      state.auditLogs.pop();
    }
    this.persist();
    neonAdapter.persistAuditLog(logEntry).catch((err) => {
      console.warn('Neon audit log error (non-fatal):', err.message);
    });
  }
}

export const db = new DatabaseEngine();
