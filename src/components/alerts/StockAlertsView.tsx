import React, { useState, useEffect } from 'react';
import { api, Medicine, MedicineBatch } from '../../lib/api';
import { AlertTriangle, Clock, XCircle, CheckCircle, RefreshCw, Sliders, ArrowRight } from 'lucide-react';

interface AlertItem {
  batchId: string;
  medicineId: string;
  medicineName: string;
  batchNumber: string;
  expiryDate: string;
  currentQty: number;
  mrp: number;
  purchaseRate: number;
  packSize?: string;
  daysRemaining: number;
  status: 'EXPIRED' | 'DAYS_30' | 'DAYS_60' | 'DAYS_90' | 'LOW_STOCK';
}

export const StockAlertsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'EXPIRED' | 'DAYS_30' | 'DAYS_60' | 'DAYS_90' | 'LOW_STOCK'>('EXPIRED');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<AlertItem | null>(null);
  const [writeOffReason, setWriteOffReason] = useState('Expired Stock Quarantine / Destruction');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const data = await api.getMedicines();
      setMedicines(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const now = new Date();
  const nowMs = now.getTime();
  const d30 = 30 * 24 * 60 * 60 * 1000;
  const d60 = 60 * 24 * 60 * 60 * 1000;
  const d90 = 90 * 24 * 60 * 60 * 1000;

  const expiredItems: AlertItem[] = [];
  const days30Items: AlertItem[] = [];
  const days60Items: AlertItem[] = [];
  const days90Items: AlertItem[] = [];
  const lowStockItems: AlertItem[] = [];

  medicines.forEach((med) => {
    // Low stock check
    if (med.totalStock <= med.minStockAlert) {
      lowStockItems.push({
        batchId: '',
        medicineId: med.id,
        medicineName: med.name,
        batchNumber: 'All Batches',
        expiryDate: '-',
        currentQty: med.totalStock,
        mrp: 0,
        purchaseRate: 0,
        packSize: med.packSize,
        daysRemaining: 999,
        status: 'LOW_STOCK',
      });
    }

    (med.batches || []).forEach((b) => {
      const expMs = new Date(b.expiryDate).getTime();
      const diff = expMs - nowMs;
      const days = Math.ceil(diff / (24 * 60 * 60 * 1000));

      const item: AlertItem = {
        batchId: b.id,
        medicineId: med.id,
        medicineName: med.name,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate,
        currentQty: b.currentQty,
        mrp: b.mrp,
        purchaseRate: b.purchaseRate,
        packSize: med.packSize,
        daysRemaining: days,
        status: 'EXPIRED',
      };

      if (diff < 0) {
        if (b.currentQty > 0) expiredItems.push({ ...item, status: 'EXPIRED' });
      } else if (diff <= d30) {
        days30Items.push({ ...item, status: 'DAYS_30' });
      } else if (diff <= d60) {
        days60Items.push({ ...item, status: 'DAYS_60' });
      } else if (diff <= d90) {
        days90Items.push({ ...item, status: 'DAYS_90' });
      }
    });
  });

  const getActiveList = () => {
    switch (activeTab) {
      case 'EXPIRED':
        return expiredItems;
      case 'DAYS_30':
        return days30Items;
      case 'DAYS_60':
        return days60Items;
      case 'DAYS_90':
        return days90Items;
      case 'LOW_STOCK':
        return lowStockItems;
      default:
        return [];
    }
  };

  const handleWriteOff = async () => {
    if (!selectedBatch) return;
    try {
      await api.adjustStock(
        selectedBatch.batchId,
        0,
        writeOffReason
      );
      setSuccessMsg(`Batch ${selectedBatch.batchNumber} of ${selectedBatch.medicineName} written off to 0.`);
      setSelectedBatch(null);
      await loadData();
    } catch (err: any) {
      console.error(err);
    }
  };

  const list = getActiveList();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <h1 className="text-xl font-bold text-slate-900">
          Stock Alerts &amp; Expiry Management
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Comprehensive compliance tracking for expiring medicines, expired batches, and minimum stock reorder thresholds.
        </p>

        {/* Tab Buttons */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button
            onClick={() => setActiveTab('EXPIRED')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'EXPIRED'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            Expired Batches ({expiredItems.length})
          </button>

          <button
            onClick={() => setActiveTab('DAYS_30')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'DAYS_30'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Expiring &lt;30 Days ({days30Items.length})
          </button>

          <button
            onClick={() => setActiveTab('DAYS_60')}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeTab === 'DAYS_60'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Expiring &lt;60 Days ({days60Items.length})
          </button>

          <button
            onClick={() => setActiveTab('DAYS_90')}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeTab === 'DAYS_90'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Expiring &lt;90 Days ({days90Items.length})
          </button>

          <button
            onClick={() => setActiveTab('LOW_STOCK')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'LOW_STOCK'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Low Stock ({lowStockItems.length})
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Alert Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {list.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
            <div className="text-sm font-semibold text-slate-700">No issues found in this category</div>
            <div className="text-xs text-slate-400 mt-1">All medicine batches comply with standard expiry &amp; stock rules.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 font-semibold text-slate-700">
                  <th className="py-2.5 px-3">Medicine</th>
                  <th className="py-2.5 px-2">Batch</th>
                  <th className="py-2.5 px-2">Expiry Date</th>
                  <th className="py-2.5 px-2 text-right">Available Qty</th>
                  <th className="py-2.5 px-2 text-right">Stock Valuation</th>
                  <th className="py-2.5 px-2 text-center">Status / Urgency</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{item.medicineName}</div>
                      <div className="text-[11px] text-slate-500">{item.packSize || '1'}</div>
                    </td>
                    <td className="py-2.5 px-2 font-mono font-bold text-slate-800">{item.batchNumber}</td>
                    <td className="py-2.5 px-2 font-mono text-slate-700">{item.expiryDate.substring(0, 10)}</td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-950">{item.currentQty}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                      ₹{(item.currentQty * item.purchaseRate).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      {activeTab === 'EXPIRED' && (
                        <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-bold">
                          EXPIRED ({Math.abs(item.daysRemaining)} days ago)
                        </span>
                      )}
                      {activeTab === 'DAYS_30' && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">
                          {item.daysRemaining} Days Left
                        </span>
                      )}
                      {activeTab === 'DAYS_60' && (
                        <span className="text-[10px] bg-teal-50 text-teal-800 px-2 py-0.5 rounded font-medium">
                          {item.daysRemaining} Days Left
                        </span>
                      )}
                      {activeTab === 'DAYS_90' && (
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                          {item.daysRemaining} Days Left
                        </span>
                      )}
                      {activeTab === 'LOW_STOCK' && (
                        <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded font-bold">
                          Low Stock Alert
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {item.batchId ? (
                        <button
                          onClick={() => setSelectedBatch(item)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-semibold text-[11px] transition cursor-pointer"
                        >
                          Write-Off / Adjust
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">Reorder Item</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Write-off Modal */}
      {selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full border border-slate-200 p-5 space-y-3 text-xs">
            <h3 className="font-bold text-sm text-slate-900">Quarantine / Write-Off Batch</h3>
            <p className="text-slate-600">
              Zero out remaining <strong>{selectedBatch.currentQty} units</strong> of{' '}
              <strong>{selectedBatch.medicineName}</strong> (Batch: {selectedBatch.batchNumber})?
            </p>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Reason for Audit Log:</label>
              <input
                type="text"
                value={writeOffReason}
                onChange={(e) => setWriteOffReason(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 focus:outline-teal-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedBatch(null)}
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleWriteOff}
                className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded"
              >
                Confirm Write-Off
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
