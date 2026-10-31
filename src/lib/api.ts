/**
 * API client for Apex Medi Sales ERP
 */

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
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
  foodLic?: string;
  invoicePrefix: string;
  invoiceFooter: string;
  termsConditions: string;
  bankName: string;
  accountNo: string;
  ifscCode: string;
  upiId: string;
  roundOffPreference: boolean;
}

export interface MedicineBatch {
  id: string;
  medicineId: string;
  medicineName?: string;
  batchNumber: string;
  mfgDate?: string;
  expiryDate: string;
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
  packSize?: string;
  hsnCode?: string;
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
  taxRate: number;
  isActive: boolean;
  batches: MedicineBatch[];
  totalStock: number;
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
  items: PurchaseItem[];
  createdAt: string;
}

export interface ExtractedMedicineRow {
  serialNumber?: number;
  productName: string;
  genericName?: string;
  packing?: string;
  hsnCode?: string;
  manufacturer?: string;
  rack?: string;
  batchNumber: string;
  mfgDate?: string;
  expiryDate: string;
  quantity: number;
  freeQty: number;
  mrp: number;
  purchaseRate: number;
  discountPercent: number;
  gstRate: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  taxableAmount?: number;
  amount: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  uncertainFields: string[];
  matchedMedicineId?: string;
  matchedMedicineName?: string;
  matchedBatchId?: string;
  matchType?: 'MATCHED_EXISTING_BATCH' | 'MATCHED_NEW_BATCH' | 'NEW_MEDICINE' | 'DUPLICATE' | 'UNCERTAIN';
}

export interface PrintedInvoiceSummary {
  printedTotItems?: number;
  printedTotQty?: number;
  printedSaleValue?: number;
  printedCashDiscount?: number;
  printedTaxableAmount?: number;
  printedCgstAmount?: number;
  printedSgstAmount?: number;
  printedTotalTax?: number;
  printedGrandTotal?: number;
}

export interface DocumentMeta {
  pagesUploaded: number;
  pagesProcessed: number;
  indicatedTotalPages?: number;
  currentPageNumber?: number;
  documentCompleteness: 'COMPLETE' | 'INCOMPLETE' | 'UNKNOWN';
  reconciliationStatus: 'VERIFIED' | 'NEEDS_REVIEW' | 'INCOMPLETE_DOCUMENT' | 'EXTRACTION_FAILED';
  reconciliationDifference: number;
  incompleteWarning?: string;
  notes?: string;
}

export interface ExtractedInvoiceData {
  supplier: {
    name: string;
    gstin?: string;
    address?: string;
    phone?: string;
    dlNo?: string;
  };
  buyer?: {
    name?: string;
    gstin?: string;
    address?: string;
    phone?: string;
    dlNo?: string;
    state?: string;
    stateCode?: string;
  };
  invoice: {
    invoiceNumber: string;
    invoiceDate: string;
    taxType: 'GST' | 'IGST';
    paymentTerms?: string;
  };
  items: ExtractedMedicineRow[];
  summary: {
    totalQuantity: number;
    subtotal?: number;
    taxableAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    discountAmount: number;
    roundOff: number;
    grandTotal: number;
  };
  printedSummary?: PrintedInvoiceSummary;
  documentMeta?: DocumentMeta;
  rawTextNotes?: string;
  sourceType: 'UPLOADED_FILE' | 'SAMPLE_PRESET';
  sampleId?: string;
  fileName?: string;
  fileSize?: number;
}

export interface PurchaseImportRecord {
  id: string;
  supplierName: string;
  supplierInvoiceNumber: string;
  invoiceDate: string;
  fileName: string;
  fileType: string;
  totalItems: number;
  importedItems: number;
  grandTotal: number;
  taxType: string;
  status: 'CONFIRMED' | 'PARTIAL' | 'DRAFT' | 'CANCELLED';
  purchaseId?: string;
  notes?: string;
  createdAt: string;
}

export interface PurchaseImportSampleMeta {
  id: string;
  title: string;
  itemsCount: number;
  category: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  grandTotal: number;
  previewUrl: string;
  description: string;
}

export interface DashboardReport {
  todaySalesTotal: number;
  todaySalesCount: number;
  todayPurchasesTotal: number;
  todayPurchasesCount: number;
  totalInventoryValue: number;
  totalSellingValue: number;
  totalSKUs: number;
  totalBatches: number;
  lowStockCount: number;
  expiringWithin30: number;
  expiringWithin60: number;
  expiringWithin90: number;
  expiredCount: number;
  totalCustomerReceivables: number;
  totalSupplierPayables: number;
  estimatedGrossProfit: number;
  recentSales: Sale[];
  recentPurchases: Purchase[];
}

export interface LedgerEntry {
  id: string;
  date: string;
  voucherType: string;
  voucherNumber: string;
  debit: number;
  credit: number;
  balance: number;
  reference?: string;
  remarks?: string;
}

export interface StockMovement {
  id: string;
  medicineId: string;
  medicineName?: string;
  batchId: string;
  batchNumber: string;
  type: string;
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

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('apex_token');
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('apex_token', token);
    } else {
      localStorage.removeItem('apex_token');
    }
  }

  public getToken() {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(endpoint, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      let msg = data.error;
      if (typeof msg === 'object' && msg !== null) {
        msg = msg.message || JSON.stringify(msg);
      }
      throw new Error(msg || data.message || `Request failed with status ${res.status}`);
    }

    return data as T;
  }

  // Auth
  async login(email: string, password: string): Promise<{ token: string; user: UserSession }> {
    const res = await this.request<{ token: string; user: UserSession }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.token);
    return res;
  }

  async getCurrentUser(): Promise<UserSession> {
    return this.request<UserSession>('/api/auth/me');
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return this.request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async updateAccount(name: string, email: string): Promise<UserSession> {
    return this.request('/api/auth/update-account', {
      method: 'POST',
      body: JSON.stringify({ name, email }),
    });
  }

  // Profile
  async getProfile(): Promise<BusinessProfile> {
    return this.request('/api/profile');
  }

  async updateProfile(profile: Partial<BusinessProfile>): Promise<BusinessProfile> {
    return this.request('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(profile),
    });
  }

  // Medicines & Batches
  async getMedicines(): Promise<Medicine[]> {
    return this.request('/api/medicines');
  }

  async addMedicine(data: any): Promise<Medicine> {
    return this.request('/api/medicines', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMedicine(id: string, data: any): Promise<Medicine> {
    return this.request(`/api/medicines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteMedicine(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/medicines/${id}`, {
      method: 'DELETE',
    });
  }

  async getBatches(medicineId?: string): Promise<MedicineBatch[]> {
    return this.request(`/api/batches${medicineId ? `?medicineId=${medicineId}` : ''}`);
  }

  async addBatch(data: any): Promise<MedicineBatch> {
    return this.request('/api/batches', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adjustStock(batchId: string, newQuantity: number, reason: string): Promise<any> {
    return this.request('/api/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify({ batchId, newQuantity, reason }),
    });
  }

  // Suppliers & Customers
  async getSuppliers(): Promise<Supplier[]> {
    return this.request('/api/suppliers');
  }

  async addSupplier(data: any): Promise<Supplier> {
    return this.request('/api/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSupplier(id: string, data: any): Promise<Supplier> {
    return this.request(`/api/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSupplier(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/suppliers/${id}`, {
      method: 'DELETE',
    });
  }

  async getCustomers(): Promise<Customer[]> {
    return this.request('/api/customers');
  }

  async addCustomer(data: any): Promise<Customer> {
    return this.request('/api/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCustomer(id: string, data: any): Promise<Customer> {
    return this.request(`/api/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCustomer(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/customers/${id}`, {
      method: 'DELETE',
    });
  }

  // Purchases
  async getPurchases(): Promise<Purchase[]> {
    return this.request('/api/purchases');
  }

  async recordPurchase(purchaseData: any): Promise<Purchase> {
    return this.request('/api/purchases', {
      method: 'POST',
      body: JSON.stringify(purchaseData),
    });
  }

  // AI Purchase Bill Import & Vision AI OCR
  async getPurchaseImportSamples(): Promise<PurchaseImportSampleMeta[]> {
    return this.request('/api/purchase-import/samples');
  }

  async getPurchaseImportSample(id: string): Promise<ExtractedInvoiceData> {
    return this.request(`/api/purchase-import/samples/${id}`);
  }

  async startPurchaseImportJob(file: File, uploadDurationMs?: number): Promise<{
    jobId: string;
    fileHash: string;
    fileName: string;
    fileSize: number;
    totalPages: number;
    status: string;
    stage: string;
    cached: boolean;
    extractedRowsCount?: number;
    errorMessage?: string;
  }> {
    const formData = new FormData();
    formData.append('invoiceFile', file);
    if (uploadDurationMs) {
      formData.append('uploadDurationMs', String(uploadDurationMs));
    }
    return this.request('/api/purchase-import/start', {
      method: 'POST',
      body: formData,
    });
  }

  async processPurchaseImportPage(jobId: string, pageNumber: number): Promise<{
    jobId: string;
    pageNumber: number;
    status: string;
    itemsCount: number;
    completedPages: number;
    totalPages: number;
    error?: string;
  }> {
    return this.request('/api/purchase-import/process-page', {
      method: 'POST',
      body: JSON.stringify({ jobId, pageNumber }),
    });
  }

  async getPurchaseImportJobStatus(jobId: string): Promise<any> {
    return this.request(`/api/purchase-import/status/${jobId}`);
  }

  async getPurchaseImportJobResult(jobId: string): Promise<ExtractedInvoiceData> {
    return this.request(`/api/purchase-import/result/${jobId}`);
  }

  async uploadPurchaseBill(file: File): Promise<ExtractedInvoiceData> {
    const formData = new FormData();
    formData.append('invoiceFile', file);
    return this.request('/api/purchase-import/upload', {
      method: 'POST',
      body: formData,
    });
  }

  async matchImportItems(items: ExtractedMedicineRow[]): Promise<{ items: ExtractedMedicineRow[] }> {
    return this.request('/api/purchase-import/match', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  async confirmBulkPurchaseImport(payload: any): Promise<{
    success: boolean;
    message: string;
    purchase: Purchase;
    importRecord: PurchaseImportRecord;
    totalStockAdded: number;
    importedCount: number;
  }> {
    return this.request('/api/purchase-import/confirm', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getPurchaseImportHistory(): Promise<PurchaseImportRecord[]> {
    return this.request('/api/purchase-import/history');
  }

  // Legacy OCR aliases for backward compatibility
  async uploadInvoiceForOcr(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('invoiceFile', file);
    return this.request('/api/ocr/upload', {
      method: 'POST',
      body: formData,
    });
  }

  async getOcrSample(sampleId: string): Promise<any> {
    return this.request(`/api/ocr/samples/${sampleId}`);
  }

  // Sales
  async getSales(): Promise<Sale[]> {
    return this.request('/api/sales');
  }

  async recordSale(saleData: any): Promise<Sale> {
    return this.request('/api/sales', {
      method: 'POST',
      body: JSON.stringify(saleData),
    });
  }

  async cancelSale(saleId: string, reason: string): Promise<Sale> {
    return this.request(`/api/sales/${saleId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async verifyInvoice(token: string): Promise<any> {
    return this.request(`/api/verify-invoice/${token}`);
  }

  // Ledgers & Payments
  async getCustomerLedger(customerId: string): Promise<LedgerEntry[]> {
    return this.request(`/api/ledgers/customer/${customerId}`);
  }

  async getSupplierLedger(supplierId: string): Promise<LedgerEntry[]> {
    return this.request(`/api/ledgers/supplier/${supplierId}`);
  }

  async recordPayment(data: any): Promise<any> {
    return this.request('/api/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Dashboard & Reports
  async getDashboardReport(): Promise<DashboardReport> {
    return this.request('/api/reports/dashboard');
  }

  async getStockMovements(): Promise<StockMovement[]> {
    return this.request('/api/reports/movements');
  }

  async getAuditLogs(): Promise<AuditLog[]> {
    return this.request('/api/reports/audit-logs');
  }
}

export const api = new ApiService();
