import React, { useState, useEffect } from 'react';
import { api, Supplier, Medicine, Purchase } from '../../lib/api';
import { calculateInvoiceTotals, round2 } from '../../lib/tax';
import {
  Upload, FileText, CheckCircle2, AlertTriangle, RefreshCw, Plus, Trash2,
  Sparkles, ArrowRight, ShieldAlert, Check, HelpCircle
} from 'lucide-react';

interface EditableRow {
  id: string;
  medicineId?: string;
  productName: string;
  packing: string;
  hsnCode: string;
  manufacturer: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  freeQty: number;
  mrp: number;
  purchaseRate: number;
  discountPercent: number;
  gstRate: number;
  amount: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  uncertainFields: string[];
  matchedMedicineName?: string;
  matchStatus: 'MATCHED' | 'NEW_MEDICINE' | 'UNMATCHED';
}

interface UploadInvoiceViewProps {
  onPurchaseConfirmed?: (purchase: Purchase) => void;
  onNavigateToInventory?: () => void;
}

export const UploadInvoiceView: React.FC<UploadInvoiceViewProps> = ({
  onPurchaseConfirmed,
  onNavigateToInventory,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Database reference data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);

  // Extracted and Editable State
  const [extractedData, setExtractedData] = useState<any>(null);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [supplierName, setSupplierName] = useState<string>('');
  const [supplierGstin, setSupplierGstin] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>('');
  const [taxType, setTaxType] = useState<'GST' | 'IGST'>('IGST');

  // Load existing suppliers and medicines to match against
  const loadData = async () => {
    try {
      const [sups, meds] = await Promise.all([api.getSuppliers(), api.getMedicines()]);
      setSuppliers(sups);
      setMedicines(meds);
    } catch (err: any) {
      console.error('Error loading master data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setError(null);
      if (selected.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => setFilePreview(reader.result as string);
        reader.readAsDataURL(selected);
      } else {
        setFilePreview(null);
      }
    }
  };

  const processExtractedPayload = (data: any, previewUrl?: string) => {
    setExtractedData(data);
    if (previewUrl) setFilePreview(previewUrl);

    // Supplier matching or detection
    const sName = data.supplier?.name || '';
    setSupplierName(sName);
    setSupplierGstin(data.supplier?.gstin || '');

    const matchedSup = suppliers.find(
      (s) =>
        s.name.toLowerCase().includes(sName.toLowerCase()) ||
        (data.supplier?.gstin && s.gstin && s.gstin === data.supplier.gstin)
    );
    if (matchedSup) {
      setSupplierId(matchedSup.id);
    } else {
      setSupplierId('');
    }

    setInvoiceNumber(data.invoice?.invoiceNumber || '');
    setInvoiceDate(data.invoice?.invoiceDate || new Date().toISOString().split('T')[0]);
    setTaxType(data.invoice?.taxType || 'IGST');

    // Process rows and match against medicine master
    const processedRows: EditableRow[] = (data.items || []).map((item: any, i: number) => {
      const pName = item.productName || 'Unknown Medicine';
      const cleanName = pName.trim().toLowerCase();

      // Find best match in medicine master
      const match = medicines.find((m) => {
        const mName = m.name.toLowerCase();
        return mName === cleanName || mName.includes(cleanName) || cleanName.includes(mName);
      });

      return {
        id: `row_${Date.now()}_${i}`,
        medicineId: match?.id,
        productName: item.productName || '',
        packing: item.packing || '30 ML',
        hsnCode: item.hsnCode || '30049000',
        manufacturer: item.manufacturer || sName,
        batchNumber: item.batchNumber || `BAT${Math.floor(Math.random() * 90000)}`,
        expiryDate: item.expiryDate || '2027-12-31',
        quantity: Number(item.quantity) || 1,
        freeQty: Number(item.freeQty) || 0,
        mrp: Number(item.mrp) || 0,
        purchaseRate: Number(item.purchaseRate) || 0,
        discountPercent: Number(item.discountPercent) || 0,
        gstRate: Number(item.gstRate) || 5.0,
        amount: Number(item.amount) || Number(item.quantity) * Number(item.purchaseRate) || 0,
        confidence: item.confidence || 'HIGH',
        uncertainFields: item.uncertainFields || [],
        matchedMedicineName: match?.name,
        matchStatus: match ? 'MATCHED' : 'NEW_MEDICINE',
      };
    });

    setRows(processedRows);
    setSuccessMessage(`Extracted ${processedRows.length} medicine rows from supplier document.`);
  };

  const handleExtractUploadedFile = async () => {
    if (!file) {
      setError('Please choose an invoice file to upload');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const data = await api.uploadInvoiceForOcr(file);
      processExtractedPayload(data);
    } catch (err: any) {
      setError(err.message || 'OCR extraction failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSample = async (sampleId: 'kroyf_distributor' | 'apex_tax_invoice') => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const data = await api.getOcrSample(sampleId);
      const sampleImg = sampleId === 'kroyf_distributor'
        ? '/assets/aistudio/image_d925ed9a.png'
        : '/assets/aistudio/image_0abcdbcd.png';
      processExtractedPayload(data, sampleImg);
    } catch (err: any) {
      setError(err.message || 'Failed loading reference invoice sample');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRow = (id: string, field: keyof EditableRow, value: any) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        // Recalculate amount if rate or quantity changes
        if (field === 'quantity' || field === 'purchaseRate' || field === 'discountPercent') {
          const qty = Number(field === 'quantity' ? value : r.quantity) || 0;
          const rate = Number(field === 'purchaseRate' ? value : r.purchaseRate) || 0;
          const dis = Number(field === 'discountPercent' ? value : r.discountPercent) || 0;
          const gross = qty * rate;
          const disAmt = (gross * dis) / 100;
          updated.amount = round2(gross - disAmt);
        }
        return updated;
      })
    );
  };

  const handleAddRow = () => {
    const newRow: EditableRow = {
      id: `row_${Date.now()}`,
      productName: '',
      packing: '30 ML',
      hsnCode: '30049000',
      manufacturer: supplierName || 'KROYF LABCORP',
      batchNumber: '',
      expiryDate: '2027-12-31',
      quantity: 1,
      freeQty: 0,
      mrp: 100,
      purchaseRate: 50,
      discountPercent: 0,
      gstRate: 5,
      amount: 50,
      confidence: 'HIGH',
      uncertainFields: [],
      matchStatus: 'NEW_MEDICINE',
    };
    setRows([...rows, newRow]);
  };

  const handleDeleteRow = (id: string) => {
    setRows(rows.filter((r) => r.id !== id));
  };

  // Recalculate Totals from Review Table
  const calcTotals = calculateInvoiceTotals(
    rows.map((r) => ({
      quantity: r.quantity,
      rate: r.purchaseRate,
      discountPercent: r.discountPercent,
      gstRate: r.gstRate,
      freeQty: r.freeQty,
    })),
    {
      isInterState: taxType === 'IGST',
      roundOffPreference: true,
    }
  );

  // Check discrepancy against extracted summary total
  const extractedTotal = extractedData?.summary?.grandTotal;
  const hasDiscrepancy = extractedTotal !== undefined && Math.abs(calcTotals.grandTotal - extractedTotal) > 1.0;

  // Confirm Purchase & Update Stock
  const handleConfirmPurchase = async () => {
    if (rows.length === 0) {
      setError('Please add at least one medicine row');
      return;
    }
    if (!invoiceNumber.trim()) {
      setError('Supplier invoice number is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Ensure supplier exists in database or create new supplier
      let finalSupplierId = supplierId;
      if (!finalSupplierId) {
        const newSup = await api.addSupplier({
          name: supplierName || 'New Supplier',
          gstin: supplierGstin || undefined,
          state: taxType === 'IGST' ? 'Haryana' : 'Karnataka',
          stateCode: taxType === 'IGST' ? '06' : '29',
          openingBalance: 0,
          currentBalance: 0,
        });
        finalSupplierId = newSup.id;
        setSupplierId(finalSupplierId);
      }

      // 2. Ensure each medicine row matches or is auto-created in medicine master
      const preparedItems = [];
      for (const row of rows) {
        let medicineId = row.medicineId;
        if (!medicineId) {
          // Auto create medicine in master
          const createdMed = await api.addMedicine({
            name: row.productName.trim() || 'Unspecified Medicine',
            manufacturer: row.manufacturer || supplierName,
            dosageForm: row.packing?.toLowerCase().includes('syp') ? 'SYRUP' : 'TABLET',
            packSize: row.packing || '1',
            uom: 'BOTTLE',
            hsnCode: row.hsnCode || '30049000',
            isPrescriptionRequired: true,
            minStockAlert: 20,
            taxRate: row.gstRate,
            isActive: true,
          });
          medicineId = createdMed.id;
        }

        preparedItems.push({
          medicineId,
          medicineName: row.productName,
          batchNumber: row.batchNumber.trim().toUpperCase(),
          expiryDate: row.expiryDate,
          packing: row.packing,
          hsnCode: row.hsnCode,
          quantity: Number(row.quantity),
          freeQty: Number(row.freeQty) || 0,
          mrp: Number(row.mrp),
          purchaseRate: Number(row.purchaseRate),
          discountPercent: Number(row.discountPercent) || 0,
          gstRate: Number(row.gstRate) || 5.0,
          lineAmount: Number(row.amount),
        });
      }

      // 3. Atomically record purchase in database
      const purchasePayload = {
        invoiceNumber: `P-${Date.now().toString().slice(-6)}`,
        supplierInvoiceNumber: invoiceNumber.trim(),
        supplierId: finalSupplierId,
        supplierName,
        invoiceDate: new Date(invoiceDate).toISOString(),
        paymentTerms: 'Credit',
        paymentStatus: 'Pending',
        taxableAmount: calcTotals.taxableAmount,
        cgstAmount: calcTotals.cgstAmount,
        sgstAmount: calcTotals.sgstAmount,
        igstAmount: calcTotals.igstAmount,
        discountAmount: calcTotals.totalDiscount,
        roundOff: calcTotals.roundOff,
        grandTotal: calcTotals.grandTotal,
        notes: `Imported via Vision AI OCR from ${supplierName} (Bill: ${invoiceNumber})`,
        items: preparedItems,
      };

      const result = await api.recordPurchase(purchasePayload);
      setSuccessMessage(`Purchase ${result.invoiceNumber} recorded! Batches created & stock updated successfully.`);
      if (onPurchaseConfirmed) onPurchaseConfirmed(result);

      // Reload master data
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed saving confirmed purchase to database');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header / Instructions */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-teal-50 text-teal-700 rounded-lg">
                <Sparkles className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Upload Purchase Invoice (AI Vision OCR)
                </h2>
                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                  <span>Gemini Multimodal Vision</span>
                  <span>·</span>
                  <span>Batch Stock Auto-Allocation</span>
                  <span>·</span>
                  <span>FEFO Inventory Tracking</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Demo Preloaded Reference Invoices */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Quick Reference Tests:</span>
            <button
              type="button"
              onClick={() => handleLoadSample('kroyf_distributor')}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-medium border border-slate-300 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Loads the exact KROYF LABCORP Distributor Invoice from reference screenshot"
            >
              <FileText className="w-3.5 h-3.5 text-teal-600" />
              KROYF Labcorp (7 Syrups)
            </button>
            <button
              type="button"
              onClick={() => handleLoadSample('apex_tax_invoice')}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-medium border border-slate-300 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Loads the APEX HEALTH invoice from physical photo"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              Apex Health (Tabs &amp; Caps)
            </button>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-8">
            <label className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-xl p-4 flex items-center gap-4 cursor-pointer bg-slate-50/50 hover:bg-teal-50/30 transition">
              <input
                type="file"
                accept="image/jpeg,image/png,image/jpg,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="p-3 bg-white rounded-lg border border-slate-200 text-teal-600 shadow-2xs">
                <Upload className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800 truncate">
                  {file ? file.name : 'Choose invoice file or drag & drop here'}
                </div>
                <div className="text-xs text-slate-500">
                  Supports JPG, PNG, and PDF supplier bills up to 15MB
                </div>
              </div>
              {file && (
                <span className="text-xs font-mono bg-teal-100 text-teal-800 px-2 py-1 rounded">
                  {(file.size / 1024).toFixed(0)} KB
                </span>
              )}
            </label>
          </div>

          <div className="md:col-span-4 flex items-center gap-2">
            <button
              type="button"
              onClick={handleExtractUploadedFile}
              disabled={!file || loading}
              className="flex-1 py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Running AI OCR...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Extract with Vision AI
                </>
              )}
            </button>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <span className="font-semibold">Extraction Notice: </span>
              {error}
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            <div>
              <span className="font-semibold">Success: </span>
              {successMessage}
            </div>
          </div>
        )}
      </div>

      {/* Review Section (shown when rows are extracted or present) */}
      {rows.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          {/* Supplier & Invoice Metadata Header */}
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Invoice Header &amp; Supplier Metadata
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Supplier Name
                </label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  placeholder="e.g. KROYF LABCORP"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Supplier GSTIN
                </label>
                <input
                  type="text"
                  value={supplierGstin}
                  onChange={(e) => setSupplierGstin(e.target.value)}
                  className="w-full text-xs font-mono bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  placeholder="06ABCFK8854D1ZA"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Supplier Bill / Invoice No.
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  placeholder="OS001230"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Invoice Date
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Tax Treatment
                </label>
                <select
                  value={taxType}
                  onChange={(e) => setTaxType(e.target.value as any)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                >
                  <option value="IGST">Inter-State (IGST 5%)</option>
                  <option value="GST">Intra-State (CGST 2.5% + SGST 2.5%)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Discrepancy Alert Banner */}
          {hasDiscrepancy && (
            <div className="p-3 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>
                  <strong>Discrepancy Warning:</strong> Extracted supplier total was ₹{extractedTotal?.toFixed(2)},
                  but table recalculation yields ₹{calcTotals.grandTotal.toFixed(2)}. Please verify rates or discounts.
                </span>
              </div>
            </div>
          )}

          {/* Editable Review Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 font-semibold text-slate-700">
                  <th className="py-2.5 px-2 text-center w-10">#</th>
                  <th className="py-2.5 px-3 min-w-[200px]">Medicine Name</th>
                  <th className="py-2.5 px-2 min-w-[80px]">Packing</th>
                  <th className="py-2.5 px-2 min-w-[90px]">HSN</th>
                  <th className="py-2.5 px-2 min-w-[110px]">Batch No.</th>
                  <th className="py-2.5 px-2 min-w-[105px]">Expiry</th>
                  <th className="py-2.5 px-2 text-right min-w-[65px]">Qty</th>
                  <th className="py-2.5 px-2 text-right min-w-[55px]">Free</th>
                  <th className="py-2.5 px-2 text-right min-w-[80px]">MRP</th>
                  <th className="py-2.5 px-2 text-right min-w-[80px]">Cost Rate</th>
                  <th className="py-2.5 px-2 text-right min-w-[65px]">Dis%</th>
                  <th className="py-2.5 px-2 text-center min-w-[65px]">GST%</th>
                  <th className="py-2.5 px-3 text-right min-w-[95px]">Amount</th>
                  <th className="py-2.5 px-2 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, index) => {
                  const hasUncertainty = row.uncertainFields && row.uncertainFields.length > 0;
                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50 transition ${hasUncertainty ? 'bg-amber-50/40' : ''}`}
                    >
                      <td className="py-2 px-2 text-center text-slate-400 font-mono">
                        {index + 1}
                      </td>

                      {/* Medicine Name & Match Badge */}
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={row.productName}
                          onChange={(e) => handleUpdateRow(row.id, 'productName', e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-900 focus:outline-teal-500"
                        />
                        <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                          {row.matchStatus === 'MATCHED' ? (
                            <span className="text-emerald-700 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Matched: {row.matchedMedicineName}
                            </span>
                          ) : (
                            <span className="text-slate-500 flex items-center gap-1">
                              <Plus className="w-3 h-3" /> Will create as new medicine in master
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Packing */}
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={row.packing}
                          onChange={(e) => handleUpdateRow(row.id, 'packing', e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-center focus:outline-teal-500"
                        />
                      </td>

                      {/* HSN */}
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={row.hsnCode}
                          onChange={(e) => handleUpdateRow(row.id, 'hsnCode', e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-mono text-center focus:outline-teal-500"
                        />
                      </td>

                      {/* Batch */}
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={row.batchNumber}
                          onChange={(e) => handleUpdateRow(row.id, 'batchNumber', e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-mono font-bold text-center focus:outline-teal-500 uppercase"
                        />
                      </td>

                      {/* Expiry */}
                      <td className="py-2 px-2">
                        <input
                          type="date"
                          value={row.expiryDate}
                          onChange={(e) => handleUpdateRow(row.id, 'expiryDate', e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-center focus:outline-teal-500"
                        />
                      </td>

                      {/* Qty */}
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          min="1"
                          value={row.quantity}
                          onChange={(e) => handleUpdateRow(row.id, 'quantity', e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-right font-bold focus:outline-teal-500"
                        />
                      </td>

                      {/* Free */}
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          min="0"
                          value={row.freeQty}
                          onChange={(e) => handleUpdateRow(row.id, 'freeQty', e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-right text-slate-500 focus:outline-teal-500"
                        />
                      </td>

                      {/* MRP */}
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={row.mrp}
                          onChange={(e) => handleUpdateRow(row.id, 'mrp', e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-right font-mono focus:outline-teal-500"
                        />
                      </td>

                      {/* Purchase Rate */}
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={row.purchaseRate}
                          onChange={(e) => handleUpdateRow(row.id, 'purchaseRate', e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-right font-mono font-bold text-teal-800 focus:outline-teal-500"
                        />
                      </td>

                      {/* Discount % */}
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          step="0.1"
                          value={row.discountPercent}
                          onChange={(e) => handleUpdateRow(row.id, 'discountPercent', e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-right font-mono focus:outline-teal-500"
                        />
                      </td>

                      {/* GST % */}
                      <td className="py-2 px-2 text-center">
                        <select
                          value={row.gstRate}
                          onChange={(e) => handleUpdateRow(row.id, 'gstRate', Number(e.target.value))}
                          className="w-full bg-white border border-slate-300 rounded px-1 py-1 text-xs text-center focus:outline-teal-500"
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </td>

                      {/* Amount */}
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        ₹{row.amount.toFixed(2)}
                      </td>

                      {/* Action */}
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(row.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                          title="Delete Row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Bottom Controls & Summary Totals */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddRow}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 rounded-lg text-xs font-medium border border-slate-300 shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-teal-600" />
                Add Medicine Row
              </button>
              <span className="text-xs text-slate-500">
                Total Items: <strong>{rows.length}</strong> · Total Qty: <strong>{calcTotals.totalQuantity}</strong>
              </span>
            </div>

            {/* Totals Matrix */}
            <div className="flex items-center gap-6 text-xs font-mono">
              <div>
                <span className="text-slate-500">Taxable: </span>
                <span className="font-semibold text-slate-900">₹{calcTotals.taxableAmount.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500">Tax ({taxType}): </span>
                <span className="font-semibold text-slate-900">₹{calcTotals.totalTax.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500">R.Off: </span>
                <span className="font-medium">{calcTotals.roundOff.toFixed(2)}</span>
              </div>
              <div className="text-sm font-bold text-teal-900">
                <span>Grand Total: </span>
                <span className="text-base font-extrabold">₹{calcTotals.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Final Action Bar */}
          <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-teal-600" />
              <span>
                Confirming will atomically add batches, update stock movements, and credit the supplier ledger.
              </span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleConfirmPurchase}
                disabled={loading || rows.length === 0}
                className="w-full sm:w-auto px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-sm font-bold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Recording Purchase...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Confirm Purchase &amp; Update Stock
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Original Scanned Document Preview if Available */}
      {filePreview && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Original Supplier Document Preview
            </h3>
            <span className="text-xs text-slate-500">
              Verified with Optical Character Recognition
            </span>
          </div>
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-900/5 max-h-[500px] flex items-center justify-center">
            <img
              src={filePreview}
              alt="Scanned Invoice"
              className="max-h-[480px] w-auto object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};
