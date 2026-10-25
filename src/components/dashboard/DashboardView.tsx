import React, { useEffect, useState } from 'react';
import { api, DashboardReport, Sale, Purchase, BusinessProfile } from '../../lib/api';
import {
  TrendingUp, ShoppingCart, Package, AlertTriangle, Clock,
  ArrowUpRight, ArrowDownRight, Printer, Sparkles, FileText, Plus,
  ShieldCheck, AlertCircle, RefreshCw, XCircle
} from 'lucide-react';

interface DashboardViewProps {
  profile: BusinessProfile;
  onNavigate: (tab: string) => void;
  onViewInvoice: (sale: Sale) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  profile,
  onNavigate,
  onViewInvoice,
}) => {
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const data = await api.getDashboardReport();
      setReport(data);
    } catch (err) {
      console.error('Failed to load dashboard report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading || !report) {
    return (
      <div className="py-20 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-teal-600" />
        Loading Apex Medi Sales ERP Dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner with Quick Actions */}
      <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-teal-200 mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {profile.storeName || 'APEX MEDI SALES'} · Live Store ERP
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Medical Store Billing &amp; Inventory Hub
            </h1>
            <p className="text-xs text-teal-100/80 mt-1 max-w-xl">
              Drug Licence: {profile.dlNo1} · GSTIN: {profile.gstin} · Bhatkal, Karnataka
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onNavigate('billing')}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              New Sale Bill (F2)
            </button>
            <button
              onClick={() => onNavigate('upload-invoice')}
              className="px-4 py-2 bg-white/15 hover:bg-white/25 text-white font-semibold text-xs rounded-xl backdrop-blur-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-teal-300" />
              Upload Invoice (OCR)
            </button>
          </div>
        </div>
      </div>

      {/* Critical Inventory & Expiry Alerts Ribbon */}
      {(report.expiredCount > 0 || report.lowStockCount > 0 || report.expiringWithin30 > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {report.expiredCount > 0 && (
            <div
              onClick={() => onNavigate('alerts')}
              className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between cursor-pointer hover:bg-rose-100/70 transition"
            >
              <div className="flex items-center gap-2.5">
                <XCircle className="w-5 h-5 text-rose-600" />
                <div>
                  <div className="text-xs font-bold text-rose-950">
                    {report.expiredCount} Expired Batches Blocked
                  </div>
                  <div className="text-[11px] text-rose-700">Strictly excluded from sales</div>
                </div>
              </div>
              <span className="text-xs font-bold text-rose-800">Review &rarr;</span>
            </div>
          )}

          {report.expiringWithin30 > 0 && (
            <div
              onClick={() => onNavigate('alerts')}
              className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between cursor-pointer hover:bg-amber-100/70 transition"
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-amber-600" />
                <div>
                  <div className="text-xs font-bold text-amber-950">
                    {report.expiringWithin30} Batches Expiring in &lt;30 Days
                  </div>
                  <div className="text-[11px] text-amber-700">Priority FEFO clearance</div>
                </div>
              </div>
              <span className="text-xs font-bold text-amber-800">Inspect &rarr;</span>
            </div>
          )}

          {report.lowStockCount > 0 && (
            <div
              onClick={() => onNavigate('alerts')}
              className="p-3 bg-orange-50 border border-orange-200 rounded-xl flex items-center justify-between cursor-pointer hover:bg-orange-100/70 transition"
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <div>
                  <div className="text-xs font-bold text-orange-950">
                    {report.lowStockCount} Medicines Below Reorder Level
                  </div>
                  <div className="text-[11px] text-orange-700">Stock reorder recommended</div>
                </div>
              </div>
              <span className="text-xs font-bold text-orange-800">Restock &rarr;</span>
            </div>
          )}
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Today's Sales</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-2">
            ₹{report.todaySalesTotal.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {report.todaySalesCount} invoices created today
          </div>
        </div>

        {/* Total Inventory Value */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Stock Valuation (Cost)</span>
            <span className="p-1.5 bg-teal-50 text-teal-700 rounded-lg">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-2">
            ₹{report.totalInventoryValue.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Across {report.totalBatches} active batches
          </div>
        </div>

        {/* Customer Receivables */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Customer Receivables</span>
            <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
              <ArrowDownRight className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-indigo-950 mt-2">
            ₹{report.totalCustomerReceivables.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Sundry Debtors (e.g. Divyam Medplus)
          </div>
        </div>

        {/* Supplier Payables */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Supplier Payables</span>
            <span className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-2">
            ₹{report.totalSupplierPayables.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Sundry Creditors (e.g. Kroyf Labcorp)
          </div>
        </div>
      </div>

      {/* Recent Activity: Sales & Purchases Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tax Invoices */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Recent Sales Invoices
            </h3>
            <button
              onClick={() => onNavigate('sales')}
              className="text-xs text-teal-700 hover:text-teal-900 font-semibold cursor-pointer"
            >
              View All &rarr;
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="p-3">Inv No</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Mode</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.recentSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/70 transition">
                    <td className="p-3 font-mono font-bold text-slate-900">
                      {sale.invoiceNumber}
                    </td>
                    <td className="p-3 text-slate-800 truncate max-w-[140px]">
                      {sale.customerName}
                    </td>
                    <td className="p-3">
                      <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700">
                        {sale.paymentMode}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      ₹{sale.grandTotal.toFixed(2)}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => onViewInvoice(sale)}
                        className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded font-medium text-[11px] transition cursor-pointer"
                      >
                        Print A4
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Purchases */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Recent Supplier Purchases
            </h3>
            <button
              onClick={() => onNavigate('purchases')}
              className="text-xs text-teal-700 hover:text-teal-900 font-semibold cursor-pointer"
            >
              View All &rarr;
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="p-3">Entry No</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3">Supplier Bill</th>
                  <th className="p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.recentPurchases.map((pur) => (
                  <tr key={pur.id} className="hover:bg-slate-50/70 transition">
                    <td className="p-3 font-mono font-bold text-slate-900">{pur.invoiceNumber}</td>
                    <td className="p-3 font-medium text-slate-800">{pur.supplierName}</td>
                    <td className="p-3 font-mono text-slate-600">{pur.supplierInvoiceNumber}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      ₹{pur.grandTotal.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
