import React, { useState, useEffect } from 'react';
import { api, Sale } from '../../lib/api';
import { FileText, Printer, AlertTriangle, CheckCircle, RefreshCw, XCircle, Search, Download } from 'lucide-react';

interface SalesViewProps {
  onViewInvoice: (sale: Sale) => void;
}

export const SalesView: React.FC<SalesViewProps> = ({ onViewInvoice }) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cancelModalSale, setCancelModalSale] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSales = async () => {
    try {
      const data = await api.getSales();
      setSales(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, []);

  const handleCancelSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalSale || !cancelReason.trim()) return;

    setError(null);
    try {
      await api.cancelSale(cancelModalSale.id, cancelReason);
      setSuccess(`Invoice ${cancelModalSale.invoiceNumber} was cancelled and stock returned to inventory.`);
      setCancelModalSale(null);
      setCancelReason('');
      await loadSales();
    } catch (err: any) {
      setError(err.message || 'Failed cancelling invoice');
    }
  };

  const filteredSales = sales.filter((s) =>
    s.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
    s.customerName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Sales Register &amp; Invoices
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit history of all generated GST tax invoices, reprint facilities, and controlled cancellation workflows.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice or customer..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-teal-500"
          />
        </div>
      </div>

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Invoices Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 font-semibold text-slate-700">
                <th className="py-3 px-3">Invoice No</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Customer</th>
                <th className="py-3 px-2 text-center">Payment</th>
                <th className="py-3 px-2 text-right">Taxable (₹)</th>
                <th className="py-3 px-2 text-right">GST (₹)</th>
                <th className="py-3 px-3 text-right">Grand Total (₹)</th>
                <th className="py-3 px-2 text-center">Status</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-3 font-mono font-bold text-slate-900">{sale.invoiceNumber}</td>
                  <td className="py-3 px-3 text-slate-600">
                    {new Date(sale.invoiceDate).toLocaleDateString('en-IN')}
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-900">{sale.customerName}</td>
                  <td className="py-3 px-2 text-center">
                    <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700">
                      {sale.paymentMode}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-slate-700">
                    ₹{sale.taxableAmount.toFixed(2)}
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-slate-700">
                    ₹{(sale.cgstAmount + sale.sgstAmount + sale.igstAmount).toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-950">
                    ₹{sale.grandTotal.toFixed(2)}
                  </td>
                  <td className="py-3 px-2 text-center">
                    {sale.isCancelled ? (
                      <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-bold">
                        CANCELLED
                      </span>
                    ) : (
                      <span className="text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-medium">
                        ACTIVE
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => onViewInvoice(sale)}
                        className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded font-semibold text-[11px] transition cursor-pointer flex items-center gap-1"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Print A4
                      </button>
                      {!sale.isCancelled && (
                        <button
                          onClick={() => setCancelModalSale(sale)}
                          className="px-2 py-1 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 rounded font-semibold text-[11px] transition cursor-pointer"
                          title="Controlled cancellation with stock reversal"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Controlled Cancellation Modal */}
      {cancelModalSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full border border-slate-200 p-5 space-y-3 text-xs">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              Cancel Invoice &amp; Revert Stock
            </div>
            <p className="text-slate-600 leading-relaxed">
              Are you sure you want to cancel Invoice <strong>{cancelModalSale.invoiceNumber}</strong> for{' '}
              <strong>₹{cancelModalSale.grandTotal.toFixed(2)}</strong>?
              Stock will be returned to batches and an audit reversal entry will be written.
            </p>
            <form onSubmit={handleCancelSale} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mandatory Cancellation Reason *
                </label>
                <textarea
                  required
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Customer billing error / Order returned by patient"
                  className="w-full border border-slate-300 rounded p-2 focus:outline-teal-500"
                />
              </div>

              {error && <div className="text-rose-600 font-medium">{error}</div>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelModalSale(null)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded"
                >
                  Keep Invoice
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded"
                >
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
