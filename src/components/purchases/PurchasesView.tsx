import React, { useState, useEffect } from 'react';
import { api, Purchase } from '../../lib/api';
import { Package, FileText, ChevronDown, ChevronRight, RefreshCw, Trash2, AlertTriangle, Check } from 'lucide-react';

interface PurchasesViewProps {
  onNavigateToUpload: () => void;
  syncSignal?: number;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({ onNavigateToUpload, syncSignal }) => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadPurchases = async () => {
    try {
      const data = await api.getPurchases();
      setPurchases(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load purchases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPurchases();
  }, [syncSignal]);

  const handleDeletePurchase = async (e: React.MouseEvent, id: string, invoiceNo: string) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete purchase "${invoiceNo}"? This will reverse the batch quantities and update supplier balance in Neon PostgreSQL.`)) {
      return;
    }
    setError(null);
    try {
      await api.deletePurchase(id);
      setSuccess(`Purchase ${invoiceNo} and associated stock reversed.`);
      setTimeout(() => setSuccess(null), 3000);
      await loadPurchases();
    } catch (err: any) {
      setError(err.message || 'Failed to delete purchase');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Purchases &amp; Inward Invoices Register
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Log of all confirmed supplier invoices, batch inward receipts, and tax allocations.
          </p>
        </div>

        <button
          onClick={onNavigateToUpload}
          className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
        >
          <FileText className="w-4 h-4 text-teal-200" />
          📄 Upload Purchase Bill
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading && purchases.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-teal-600" />
            Loading purchases register...
          </div>
        ) : purchases.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <div className="text-sm font-semibold text-slate-700">No purchases recorded in database</div>
            <div className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Your database is clean. Use AI Purchase Bill Import or inward entry to add medicine stock.
            </div>
            <button
              onClick={onNavigateToUpload}
              className="mt-4 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Import First Purchase Bill
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 font-semibold text-slate-700">
                  <th className="py-3 px-3 w-8"></th>
                  <th className="py-3 px-3">Entry No</th>
                  <th className="py-3 px-3">Supplier Name</th>
                  <th className="py-3 px-3">Supplier Bill No</th>
                  <th className="py-3 px-2">Invoice Date</th>
                  <th className="py-3 px-2 text-right">Taxable (₹)</th>
                  <th className="py-3 px-2 text-right">Tax (₹)</th>
                  <th className="py-3 px-3 text-right">Grand Total (₹)</th>
                  <th className="py-3 px-2 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map((pur) => {
                  const isExpanded = expandedId === pur.id;
                  return (
                    <React.Fragment key={pur.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : pur.id)}
                        className={`hover:bg-slate-50/70 transition cursor-pointer ${
                          isExpanded ? 'bg-teal-50/20' : ''
                        }`}
                      >
                        <td className="py-3 px-3 text-slate-400">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-teal-700" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">{pur.invoiceNumber}</td>
                        <td className="py-3 px-3 font-bold text-slate-900">{pur.supplierName}</td>
                        <td className="py-3 px-3 font-mono text-slate-700">{pur.supplierInvoiceNumber}</td>
                        <td className="py-3 px-2 text-slate-600">
                          {new Date(pur.invoiceDate).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-slate-700">
                          ₹{pur.taxableAmount.toFixed(2)}
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-slate-700">
                          ₹{(pur.cgstAmount + pur.sgstAmount + pur.igstAmount).toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-950">
                          ₹{pur.grandTotal.toFixed(2)}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                            {pur.paymentTerms}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleDeletePurchase(e, pur.id, pur.invoiceNumber)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                            title="Delete Purchase & Adjust Stock"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Items */}
                      {isExpanded && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={10} className="p-4 pl-10 border-b border-slate-200">
                            <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs">
                              <div className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2 flex items-center justify-between">
                                <span>Billed Medicine Items ({pur.items?.length || 0})</span>
                                {pur.notes && (
                                  <span className="text-[11px] font-normal text-slate-500 italic">{pur.notes}</span>
                                )}
                              </div>
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                                    <th className="py-1.5 px-2">Product Name</th>
                                    <th className="py-1.5 px-2">Batch No</th>
                                    <th className="py-1.5 px-2">Exp</th>
                                    <th className="py-1.5 px-2 text-right">Qty</th>
                                    <th className="py-1.5 px-2 text-right">Free</th>
                                    <th className="py-1.5 px-2 text-right">Cost Rate</th>
                                    <th className="py-1.5 px-2 text-right">MRP</th>
                                    <th className="py-1.5 px-2 text-center">GST%</th>
                                    <th className="py-1.5 px-2 text-right">Line Amount</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium">
                                  {(pur.items || []).map((item, idx) => (
                                    <tr key={idx}>
                                      <td className="py-1.5 px-2 font-semibold text-slate-900">
                                        {item.medicineName || 'Medicine Item'}
                                      </td>
                                      <td className="py-1.5 px-2 font-mono">{item.batchNumber}</td>
                                      <td className="py-1.5 px-2 font-mono text-slate-600">
                                        {item.expiryDate ? item.expiryDate.substring(0, 7) : '-'}
                                      </td>
                                      <td className="py-1.5 px-2 text-right font-bold">{item.quantity}</td>
                                      <td className="py-1.5 px-2 text-right font-bold text-teal-700">{item.freeQty || 0}</td>
                                      <td className="py-1.5 px-2 text-right font-mono">₹{item.purchaseRate.toFixed(2)}</td>
                                      <td className="py-1.5 px-2 text-right font-mono">₹{item.mrp.toFixed(2)}</td>
                                      <td className="py-1.5 px-2 text-center font-mono">{item.gstRate}%</td>
                                      <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900">
                                        ₹{item.lineAmount.toFixed(2)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
