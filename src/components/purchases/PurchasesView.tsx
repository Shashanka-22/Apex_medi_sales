import React, { useState, useEffect } from 'react';
import { api, Purchase } from '../../lib/api';
import { Package, FileText, ChevronDown, ChevronRight, Plus, RefreshCw } from 'lucide-react';

interface PurchasesViewProps {
  onNavigateToUpload: () => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({ onNavigateToUpload }) => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadPurchases = async () => {
    try {
      const data = await api.getPurchases();
      setPurchases(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPurchases();
  }, []);

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

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
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
                    </tr>

                    {/* Expanded Items */}
                    {isExpanded && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={9} className="p-4 pl-10 border-b border-slate-200">
                          <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs">
                            <div className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2">
                              Billed Medicine Items ({pur.items?.length || 0})
                            </div>
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                                  <th className="py-1.5 px-2">Product Name</th>
                                  <th className="py-1.5 px-2">Batch No</th>
                                  <th className="py-1.5 px-2">Exp</th>
                                  <th className="py-1.5 px-2 text-right">Qty</th>
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
                                      {item.expiryDate.substring(0, 7)}
                                    </td>
                                    <td className="py-1.5 px-2 text-right font-bold">{item.quantity}</td>
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
      </div>
    </div>
  );
};
