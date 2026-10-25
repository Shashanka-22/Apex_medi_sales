import React, { useState, useEffect } from 'react';
import { api, Sale, StockMovement, AuditLog } from '../../lib/api';
import { FileText, Download, BarChart3, History, Shield, RefreshCw } from 'lucide-react';

export const ReportsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'GST' | 'MOVEMENTS' | 'AUDIT'>('GST');
  const [sales, setSales] = useState<Sale[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [s, m, a] = await Promise.all([
        api.getSales(),
        api.getStockMovements(),
        api.getAuditLogs().catch(() => []),
      ]);
      setSales(s);
      setMovements(m);
      setAuditLogs(a);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute GST Tax Slab Summary from non-cancelled sales
  const activeSales = sales.filter((s) => !s.isCancelled);
  const slabs = [0, 5, 12, 18, 28];
  const gstSummary = slabs.map((rate) => {
    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    activeSales.forEach((sale) => {
      sale.items.forEach((item) => {
        if (Number(item.gstRate) === rate) {
          taxable += item.taxableAmount;
          cgst += item.cgstAmount;
          sgst += item.sgstAmount;
          igst += item.igstAmount;
        }
      });
    });

    const totalTax = cgst + sgst + igst;
    return {
      rate,
      taxable: Math.round(taxable * 100) / 100,
      cgst: Math.round(cgst * 100) / 100,
      sgst: Math.round(sgst * 100) / 100,
      igst: Math.round(igst * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      invoiceValue: Math.round((taxable + totalTax) * 100) / 100,
    };
  });

  const grandTaxable = gstSummary.reduce((acc, s) => acc + s.taxable, 0);
  const grandTax = gstSummary.reduce((acc, s) => acc + s.totalTax, 0);
  const grandTotal = gstSummary.reduce((acc, s) => acc + s.invoiceValue, 0);

  const exportGstCsv = () => {
    const rows = [
      ['GST Rate (%)', 'Taxable Value (INR)', 'CGST (INR)', 'SGST (INR)', 'IGST (INR)', 'Total Tax (INR)', 'Total Value (INR)'],
      ...gstSummary.map((s) => [
        `${s.rate}%`,
        s.taxable.toFixed(2),
        s.cgst.toFixed(2),
        s.sgst.toFixed(2),
        s.igst.toFixed(2),
        s.totalTax.toFixed(2),
        s.invoiceValue.toFixed(2),
      ]),
      ['TOTAL', grandTaxable.toFixed(2), '', '', '', grandTax.toFixed(2), grandTotal.toFixed(2)],
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `GST_Tax_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            GST &amp; Financial Reports
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Internal GST tax summaries, batch stock movements, and tamper-resistant audit logs.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setActiveTab('GST')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'GST' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            GST Tax Slabs
          </button>
          <button
            onClick={() => setActiveTab('MOVEMENTS')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'MOVEMENTS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Stock Movements
          </button>
          <button
            onClick={() => setActiveTab('AUDIT')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'AUDIT' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Audit Logs
          </button>
        </div>
      </div>

      {/* Tab: GST Tax Summary */}
      {activeTab === 'GST' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              GST Slab-wise Outward Tax Breakdown (GSTR-1 Ready)
            </h3>
            <button
              onClick={exportGstCsv}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 rounded-lg text-xs font-medium border border-slate-300 shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download GST CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 font-semibold text-slate-700">
                  <th className="py-3 px-3">Tax Slab</th>
                  <th className="py-3 px-3 text-right">Taxable Value (₹)</th>
                  <th className="py-3 px-3 text-right">CGST (₹)</th>
                  <th className="py-3 px-3 text-right">SGST (₹)</th>
                  <th className="py-3 px-3 text-right">IGST (₹)</th>
                  <th className="py-3 px-3 text-right">Total Tax (₹)</th>
                  <th className="py-3 px-4 text-right">Invoice Value (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {gstSummary.map((s) => (
                  <tr key={s.rate} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3 font-sans font-bold text-slate-900">{s.rate}% GST</td>
                    <td className="py-3 px-3 text-right text-slate-800">{s.taxable.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right text-slate-700">{s.cgst.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right text-slate-700">{s.sgst.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right text-slate-700">{s.igst.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right font-bold text-teal-800">{s.totalTax.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-950">{s.invoiceValue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-mono font-bold text-slate-950 text-xs">
                  <td className="py-3 px-3 font-sans font-extrabold">TOTALS</td>
                  <td className="py-3 px-3 text-right">₹{grandTaxable.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right"></td>
                  <td className="py-3 px-3 text-right"></td>
                  <td className="py-3 px-3 text-right"></td>
                  <td className="py-3 px-3 text-right text-teal-900 font-extrabold">₹{grandTax.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right text-teal-900 font-extrabold">₹{grandTotal.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Stock Movements */}
      {activeTab === 'MOVEMENTS' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Stock Inward &amp; Outward Ledger ({movements.length} logs)
            </h3>
          </div>
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 font-semibold text-slate-700 sticky top-0">
                  <th className="py-2.5 px-3">Date &amp; Time</th>
                  <th className="py-2.5 px-3">Medicine</th>
                  <th className="py-2.5 px-2">Batch</th>
                  <th className="py-2.5 px-2 text-center">Type</th>
                  <th className="py-2.5 px-2 text-right">Change</th>
                  <th className="py-2.5 px-2 text-right">Previous</th>
                  <th className="py-2.5 px-2 text-right">New Qty</th>
                  <th className="py-2.5 px-3">Reference / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {movements.map((m) => {
                  const isPositive = m.quantity > 0;
                  return (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-sans text-slate-600">
                        {new Date(m.createdAt).toLocaleString('en-IN', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-900">
                        {m.medicineName || 'Medicine Item'}
                      </td>
                      <td className="py-2.5 px-2 text-slate-800">{m.batchNumber}</td>
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`text-[10px] font-sans font-bold px-2 py-0.5 rounded ${
                            m.type === 'SALE'
                              ? 'bg-rose-50 text-rose-800'
                              : m.type === 'PURCHASE'
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {m.type}
                        </span>
                      </td>
                      <td
                        className={`py-2.5 px-2 text-right font-bold ${
                          isPositive ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {isPositive ? `+${m.quantity}` : m.quantity}
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-500">{m.previousQty}</td>
                      <td className="py-2.5 px-2 text-right font-bold text-slate-900">{m.newQty}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-600 max-w-xs truncate">
                        {m.reason || m.referenceId || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Audit Logs */}
      {activeTab === 'AUDIT' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              System Audit &amp; Security Logs
            </h3>
          </div>
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 font-semibold text-slate-700 sticky top-0">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Operator</th>
                  <th className="py-2.5 px-2">Action</th>
                  <th className="py-2.5 px-2">Entity</th>
                  <th className="py-2.5 px-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                      {new Date(log.createdAt).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{log.userName || 'System'}</td>
                    <td className="py-2.5 px-2">
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-mono font-bold text-slate-800">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-slate-600">{log.entityType || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-700">{log.details || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
