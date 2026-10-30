import React, { useState, useEffect, useRef } from 'react';
import { api, Medicine, MedicineBatch, Customer, Sale, BusinessProfile } from '../../lib/api';
import { calculateInvoiceTotals, round2, numberToIndianWords } from '../../lib/tax';
import {
  Search, Plus, Trash2, Printer, CheckCircle, AlertCircle, Calendar,
  CreditCard, Banknote, UserCheck, ShieldAlert, Sparkles, X
} from 'lucide-react';

interface BillingItem {
  id: string;
  medicineId: string;
  medicineName: string;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  packing: string;
  hsnCode: string;
  availableStock: number;
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

interface BillingViewProps {
  profile: BusinessProfile;
  onInvoiceCreated: (sale: Sale) => void;
}

export const BillingView: React.FC<BillingViewProps> = ({ profile, onInvoiceCreated }) => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Billing Header State
  const [invoiceSeries] = useState('MAIN');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('Walk-in Cash Customer');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [customerGstin, setCustomerGstin] = useState<string>('');
  const [customerStateCode, setCustomerStateCode] = useState<string>('29');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Card' | 'Credit'>('Cash');
  const [billDiscount, setBillDiscount] = useState<number>(0);

  // Quick Customer Create Modal
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');

  // Medicine Search & Batch Selection
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Medicine[]>([]);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [eligibleBatches, setEligibleBatches] = useState<MedicineBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [inputQty, setInputQty] = useState<number>(1);
  const [inputFreeQty, setInputFreeQty] = useState<number>(0);
  const [inputRate, setInputRate] = useState<number>(0);
  const [inputDiscount, setInputDiscount] = useState<number>(0);

  // Billing Cart Items
  const [items, setItems] = useState<BillingItem[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load initial data and next invoice number
  const loadMasterData = async () => {
    try {
      const [meds, custs, sales] = await Promise.all([
        api.getMedicines(),
        api.getCustomers(),
        api.getSales(),
      ]);
      setMedicines(meds);
      setCustomers(custs);

      // Auto-generate invoice number based on prefix and latest count
      const nextNum = sales.length + 1;
      const prefix = profile.invoicePrefix || 'AM';
      const formatted = `${prefix}-${String(nextNum).padStart(5, '0')}`;
      setInvoiceNumber(formatted);
    } catch (err: any) {
      console.error('Failed to load billing data:', err);
    }
  };

  useEffect(() => {
    loadMasterData();
  }, [profile]);

  // Live Medicine Search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const filtered = medicines.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.genericName && m.genericName.toLowerCase().includes(q)) ||
        (m.barcode && m.barcode.includes(q))
    );
    setSearchResults(filtered.slice(0, 8));
  }, [searchQuery, medicines]);

  // Handle selecting a medicine from search
  const handleSelectMedicine = (med: Medicine) => {
    setSelectedMedicine(med);
    setSearchQuery('');
    setSearchResults([]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filter out expired batches and sort by FEFO (First Expiry First Out)
    const activeBatches = (med.batches || [])
      .filter((b) => {
        const exp = new Date(b.expiryDate);
        return exp >= today && b.currentQty > 0;
      })
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

    setEligibleBatches(activeBatches);

    if (activeBatches.length > 0) {
      const fefoBatch = activeBatches[0];
      setSelectedBatchId(fefoBatch.id);
      setInputRate(fefoBatch.sellingRate);
    } else {
      setSelectedBatchId('');
      setInputRate(0);
    }
    setInputQty(1);
    setInputFreeQty(0);
    setInputDiscount(0);
  };

  // When selected batch changes
  const handleBatchChange = (batchId: string) => {
    setSelectedBatchId(batchId);
    const b = eligibleBatches.find((x) => x.id === batchId);
    if (b) {
      setInputRate(b.sellingRate);
    }
  };

  // Customer Selection
  const handleCustomerChange = (custId: string) => {
    setSelectedCustomerId(custId);
    const cust = customers.find((c) => c.id === custId);
    if (cust) {
      setCustomerName(cust.name);
      setCustomerAddress(cust.address || '');
      setCustomerGstin(cust.gstin || '');
      setCustomerStateCode(cust.stateCode || '29');
    } else {
      setCustomerName('Walk-in Cash Customer');
      setCustomerAddress('');
      setCustomerGstin('');
      setCustomerStateCode('29');
    }
  };

  // Add Item to Bill Cart
  const handleAddItem = () => {
    if (!selectedMedicine) {
      setError('Please select a medicine first');
      return;
    }
    const batch = eligibleBatches.find((b) => b.id === selectedBatchId);
    if (!batch) {
      setError('Please select an active, non-expired batch with available stock');
      return;
    }
    if (inputQty <= 0) {
      setError('Quantity must be at least 1');
      return;
    }
    const totalRequired = inputQty + (inputFreeQty || 0);
    if (batch.currentQty < totalRequired) {
      setError(`Only ${batch.currentQty} units available in Batch ${batch.batchNumber}`);
      return;
    }

    const isInterState = customerStateCode !== (profile.stateCode || '29');
    const gross = round2(inputQty * inputRate);
    const disAmt = round2((gross * inputDiscount) / 100);
    const taxable = round2(gross - disAmt);
    const totalGst = round2((taxable * batch.gstRate) / 100);

    const cgst = isInterState ? 0 : round2(totalGst / 2);
    const sgst = isInterState ? 0 : round2(totalGst - cgst);
    const igst = isInterState ? totalGst : 0;
    const lineTotal = round2(taxable + totalGst);

    const newItem: BillingItem = {
      id: `item_${Date.now()}`,
      medicineId: selectedMedicine.id,
      medicineName: selectedMedicine.name,
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
      packing: selectedMedicine.packSize,
      hsnCode: selectedMedicine.hsnCode,
      availableStock: batch.currentQty,
      quantity: inputQty,
      freeQty: inputFreeQty,
      mrp: batch.mrp,
      sellingRate: inputRate,
      discountPercent: inputDiscount,
      gstRate: batch.gstRate,
      taxableAmount: taxable,
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: igst,
      lineTotal,
    };

    setItems([...items, newItem]);
    setSelectedMedicine(null);
    setEligibleBatches([]);
    setSelectedBatchId('');
    setError(null);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((it) => it.id !== id));
  };

  // Calculate Authoritative Invoice Totals
  const isInterState = customerStateCode !== (profile.stateCode || '29');
  const totals = calculateInvoiceTotals(
    items.map((i) => ({
      quantity: i.quantity,
      rate: i.sellingRate,
      discountPercent: i.discountPercent,
      gstRate: i.gstRate,
      freeQty: i.freeQty,
    })),
    {
      isInterState,
      billDiscount,
      roundOffPreference: true,
    }
  );

  // Quick Customer Creation
  const handleSaveCustomer = async () => {
    if (!newCustName.trim()) return;
    try {
      const created = await api.addCustomer({
        name: newCustName.trim(),
        phone: newCustPhone.trim() || undefined,
        address: newCustAddress.trim() || undefined,
        state: 'Karnataka',
        stateCode: '29',
        openingBalance: 0,
        currentBalance: 0,
      });
      setCustomers([...customers, created]);
      handleCustomerChange(created.id);
      setShowAddCustomer(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustAddress('');
    } catch (err: any) {
      setError(err.message || 'Failed adding customer');
    }
  };

  // Finalize Sale & Deduct Stock Atomically
  const handleFinalizeSale = async () => {
    if (items.length === 0) {
      setError('Please add at least one item to the invoice');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const salePayload = {
        invoiceNumber,
        invoiceSeries,
        customerId: selectedCustomerId || undefined,
        customerName: customerName || 'Walk-in Cash Customer',
        customerAddress: customerAddress || undefined,
        customerGstin: customerGstin || undefined,
        customerStateCode,
        invoiceDate: new Date().toISOString(),
        paymentMode,
        paymentStatus: paymentMode === 'Credit' ? 'Unpaid' : 'Paid',
        totalItems: items.length,
        taxableAmount: totals.taxableAmount,
        cgstAmount: totals.cgstAmount,
        sgstAmount: totals.sgstAmount,
        igstAmount: totals.igstAmount,
        discountAmount: totals.totalDiscount,
        additionalCharges: 0,
        roundOff: totals.roundOff,
        grandTotal: totals.grandTotal,
        paidAmount: paymentMode === 'Credit' ? 0 : totals.grandTotal,
        balanceAmount: paymentMode === 'Credit' ? totals.grandTotal : 0,
        items: items.map((i) => ({
          medicineId: i.medicineId,
          medicineName: i.medicineName,
          batchId: i.batchId,
          batchNumber: i.batchNumber,
          expiryDate: i.expiryDate,
          packing: i.packing,
          hsnCode: i.hsnCode,
          quantity: i.quantity,
          freeQty: i.freeQty,
          mrp: i.mrp,
          sellingRate: i.sellingRate,
          discountPercent: i.discountPercent,
          gstRate: i.gstRate,
          taxableAmount: i.taxableAmount,
          cgstAmount: i.cgstAmount,
          sgstAmount: i.sgstAmount,
          igstAmount: i.igstAmount,
          lineTotal: i.lineTotal,
        })),
      };

      const createdSale = await api.recordSale(salePayload);
      onInvoiceCreated(createdSale);

      // Reset for next sale
      setItems([]);
      await loadMasterData();
    } catch (err: any) {
      setError(err.message || 'Failed to complete sale transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2 bg-teal-100 text-teal-800 rounded-lg">
                <CreditCard className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  Sales Billing &amp; Tax Invoicing POS
                </h1>
                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                  <span>Firm: <strong>{profile.storeName}</strong></span>
                  <span>·</span>
                  <span>GSTIN: <strong className="font-mono">{profile.gstin}</strong></span>
                  <span>·</span>
                  <span>DL: <strong>{profile.dlNo1}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Invoice Meta Badges */}
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Invoice No</span>
              <span className="font-mono font-bold text-slate-900">{invoiceNumber}</span>
            </div>
            <div className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Series</span>
              <span className="font-semibold text-teal-800">{invoiceSeries}</span>
            </div>
          </div>
        </div>

        {/* Customer & Billing Attributes */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">Customer (Ledger)</label>
              <button
                type="button"
                onClick={() => setShowAddCustomer(true)}
                className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold cursor-pointer"
              >
                + New Customer
              </button>
            </div>
            <select
              value={selectedCustomerId}
              onChange={(e) => handleCustomerChange(e.target.value)}
              className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
            >
              <option value="">Walk-in Cash Customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Customer Address &amp; Contact
            </label>
            <input
              type="text"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              placeholder="Address / Town"
              className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 focus:outline-hidden truncate"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payment Mode
            </label>
            <div className="grid grid-cols-4 gap-1">
              {(['Cash', 'UPI', 'Card', 'Credit'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentMode(mode)}
                  className={`py-2 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                    paymentMode === mode
                      ? 'bg-teal-700 text-white border-teal-700 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tax Classification
            </label>
            <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 flex items-center justify-between">
              <span>{isInterState ? 'Inter-State (IGST)' : 'Intra-State (CGST+SGST)'}</span>
              <span className="font-mono font-bold text-slate-700">Code: {customerStateCode}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Medicine Search & Batch Selection Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span>Search &amp; Add Medicines</span>
          <span className="text-[11px] text-slate-400 font-normal">
            (Supports Barcode &amp; Auto-FEFO Expiry Batch Recommendation)
          </span>
        </h2>

        {/* Search Input */}
        <div className="relative">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type medicine name (e.g. PODPILL, SEFIRIN, KETOCIS, DOLO), generic, or scan barcode..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition"
            />
          </div>

          {/* Search Dropdown Results */}
          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-64 overflow-y-auto divide-y divide-slate-100">
              {searchResults.map((med) => (
                <div
                  key={med.id}
                  onClick={() => handleSelectMedicine(med)}
                  className="p-3 hover:bg-teal-50/60 cursor-pointer transition flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-bold text-slate-900">{med.name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span>{med.dosageForm}</span>
                      <span>·</span>
                      <span>Pack: {med.packSize}</span>
                      {med.genericName && (
                        <>
                          <span>·</span>
                          <span className="italic">{med.genericName}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        med.totalStock > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      Stock: {med.totalStock}
                    </span>
                    <div className="text-[11px] text-slate-500 mt-0.5">GST: {med.taxRate}%</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Medicine Batch & Quantity Form */}
        {selectedMedicine && (
          <div className="mt-4 p-4 bg-teal-50/40 border border-teal-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-teal-950">{selectedMedicine.name}</span>
                <span className="text-xs text-slate-600 ml-2">
                  ({selectedMedicine.dosageForm} · {selectedMedicine.packSize} · HSN: {selectedMedicine.hsnCode})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMedicine(null)}
                className="text-xs text-slate-500 hover:text-slate-800 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Batch Selection with FEFO Recommendation */}
            {eligibleBatches.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
                <div className="lg:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Select Batch (FEFO - Earliest Expiry First)
                  </label>
                  <select
                    value={selectedBatchId}
                    onChange={(e) => handleBatchChange(e.target.value)}
                    className="w-full text-xs font-mono font-bold bg-white border border-teal-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  >
                    {eligibleBatches.map((b, idx) => (
                      <option key={b.id} value={b.id}>
                        {idx === 0 ? '★ [FEFO] ' : ''}Batch: {b.batchNumber} | Exp: {b.expiryDate.substring(0, 7)} | Avail: {b.currentQty} | MRP: ₹{b.mrp}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Qty Sold
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={inputQty}
                    onChange={(e) => setInputQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full text-xs font-bold text-center bg-white border border-teal-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Selling Rate (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={inputRate}
                    onChange={(e) => setInputRate(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs font-bold text-right bg-white border border-teal-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Dis %
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={inputDiscount}
                    onChange={(e) => setInputDiscount(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs text-right bg-white border border-teal-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="w-full py-2 px-3 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Add To Bill
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>
                  No available, non-expired batches found for this medicine. Sales from expired stock are strictly prohibited.
                </span>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <div>{error}</div>
          </div>
        )}
      </div>

      {/* Bill Items Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Bill Items ({items.length})
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => setItems([])}
              className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
            >
              Clear Cart
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Banknote className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <div className="text-sm font-semibold text-slate-600">Bill is currently empty</div>
            <div className="text-xs text-slate-400 mt-1">
              Search for medicines above or scan barcodes to begin adding items
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 font-semibold text-slate-700">
                  <th className="py-2 px-3 text-center w-8">#</th>
                  <th className="py-2 px-3">Medicine Name</th>
                  <th className="py-2 px-2 text-center">Batch</th>
                  <th className="py-2 px-2 text-center">Exp</th>
                  <th className="py-2 px-2 text-right">Qty</th>
                  <th className="py-2 px-2 text-right">MRP</th>
                  <th className="py-2 px-2 text-right">Rate</th>
                  <th className="py-2 px-2 text-right">Dis%</th>
                  <th className="py-2 px-2 text-center">GST%</th>
                  <th className="py-2 px-2 text-right">Taxable</th>
                  <th className="py-2 px-2 text-right">{isInterState ? 'IGST' : 'CGST+SGST'}</th>
                  <th className="py-2 px-3 text-right">Line Total</th>
                  <th className="py-2 px-2 text-center w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {items.map((it, idx) => (
                  <tr key={it.id} className="hover:bg-slate-50 transition">
                    <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-2 px-3 font-semibold text-slate-900">
                      {it.medicineName}
                      <span className="text-[10px] text-slate-500 font-normal ml-1">
                        ({it.packing || '1'})
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center font-mono font-bold text-slate-800">{it.batchNumber}</td>
                    <td className="py-2 px-2 text-center font-mono text-slate-600">{it.expiryDate.substring(0, 7)}</td>
                    <td className="py-2 px-2 text-right font-bold text-slate-950">{it.quantity}</td>
                    <td className="py-2 px-2 text-right font-mono text-slate-600">₹{it.mrp.toFixed(2)}</td>
                    <td className="py-2 px-2 text-right font-mono font-semibold text-slate-900">₹{it.sellingRate.toFixed(2)}</td>
                    <td className="py-2 px-2 text-right font-mono text-slate-600">{it.discountPercent}%</td>
                    <td className="py-2 px-2 text-center font-mono text-slate-700">{it.gstRate}%</td>
                    <td className="py-2 px-2 text-right font-mono text-slate-800">₹{it.taxableAmount.toFixed(2)}</td>
                    <td className="py-2 px-2 text-right font-mono text-slate-700">
                      ₹{(it.cgstAmount + it.sgstAmount + it.igstAmount).toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-950">₹{it.lineTotal.toFixed(2)}</td>
                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(it.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Invoice Summary & Checkout Footer */}
        {items.length > 0 && (
          <div className="p-5 bg-slate-50 border-t border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Left Column: Words & Bill Discount */}
              <div className="md:col-span-7 space-y-2">
                <div className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">Amount in Words: </span>
                  <span className="font-bold text-slate-900">{numberToIndianWords(totals.grandTotal)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-600">Special Bill Discount (₹):</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={billDiscount}
                    onChange={(e) => setBillDiscount(parseFloat(e.target.value) || 0)}
                    className="w-24 text-xs font-mono bg-white border border-slate-300 rounded px-2 py-1 text-right focus:outline-teal-500"
                  />
                </div>
              </div>

              {/* Right Column: Calculated Authoritative Totals */}
              <div className="md:col-span-5 bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-600">
                  <span>Taxable Subtotal:</span>
                  <span className="font-semibold text-slate-900">₹{totals.taxableAmount.toFixed(2)}</span>
                </div>
                {totals.totalDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount:</span>
                    <span>-₹{totals.totalDiscount.toFixed(2)}</span>
                  </div>
                )}
                {totals.cgstAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>CGST:</span>
                    <span>₹{totals.cgstAmount.toFixed(2)}</span>
                  </div>
                )}
                {totals.sgstAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>SGST:</span>
                    <span>₹{totals.sgstAmount.toFixed(2)}</span>
                  </div>
                )}
                {totals.igstAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>IGST:</span>
                    <span>₹{totals.igstAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500">
                  <span>Round Off:</span>
                  <span>{totals.roundOff >= 0 ? `+${totals.roundOff.toFixed(2)}` : totals.roundOff.toFixed(2)}</span>
                </div>

                <div className="border-t border-slate-300 pt-2 mt-2 flex justify-between items-center text-slate-950 font-bold">
                  <span className="text-sm">NET AMOUNT:</span>
                  <span className="text-xl font-extrabold text-teal-900">
                    ₹{totals.grandTotal.toFixed(2)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleFinalizeSale}
                  disabled={loading}
                  className="w-full mt-3 py-3 px-4 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-sm font-bold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    'Processing Transaction...'
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Finalize &amp; Print Tax Invoice
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Add Customer Modal */}
      {showAddCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full border border-slate-200 shadow-xl space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900">Add New Customer</h3>
              <button
                type="button"
                onClick={() => setShowAddCustomer(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Customer / Clinic Name *</label>
              <input
                type="text"
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                placeholder="e.g. M/s. Shanti Medicos"
                className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={newCustPhone}
                onChange={(e) => setNewCustPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Address</label>
              <input
                type="text"
                value={newCustAddress}
                onChange={(e) => setNewCustAddress(e.target.value)}
                placeholder="Shop No, Street, Town"
                className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-teal-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddCustomer(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCustomer}
                className="px-4 py-1.5 bg-teal-700 text-white rounded-lg text-xs font-bold hover:bg-teal-800"
              >
                Save Customer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
