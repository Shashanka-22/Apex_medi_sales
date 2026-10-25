import React, { useState, useEffect } from 'react';
import { api, Customer, Supplier, LedgerEntry } from '../../lib/api';
import { Users, Building, Plus, FileText, Banknote, RefreshCw, X, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export const PartiesView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'CUSTOMERS' | 'SUPPLIERS'>('CUSTOMERS');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Ledger Drawer State
  const [activeLedgerParty, setActiveLedgerParty] = useState<{ id: string; name: string; type: 'CUSTOMER' | 'SUPPLIER'; balance: number } | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Payment / Receipt Voucher Modal
  const [showPaymentModal, setShowPaymentModal] = useState<{ id: string; name: string; type: 'CUSTOMER' | 'SUPPLIER' } | null>(null);
  const [voucherAmount, setVoucherAmount] = useState<number>(0);
  const [voucherMode, setVoucherMode] = useState<'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque'>('Cash');
  const [voucherRef, setVoucherRef] = useState('');
  const [voucherNotes, setVoucherNotes] = useState('');

  const loadData = async () => {
    try {
      const [c, s] = await Promise.all([api.getCustomers(), api.getSuppliers()]);
      setCustomers(c);
      setSuppliers(s);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenLedger = async (party: { id: string; name: string; type: 'CUSTOMER' | 'SUPPLIER'; balance: number }) => {
    setActiveLedgerParty(party);
    setLedgerLoading(true);
    try {
      const entries = party.type === 'CUSTOMER'
        ? await api.getCustomerLedger(party.id)
        : await api.getSupplierLedger(party.id);
      setLedgerEntries(entries);
    } catch (err) {
      console.error(err);
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPaymentModal || voucherAmount <= 0) return;

    try {
      const isCustomer = showPaymentModal.type === 'CUSTOMER';
      await api.recordPayment({
        voucherNumber: `VCH-${Date.now().toString().slice(-6)}`,
        voucherType: isCustomer ? 'RECEIPT' : 'PAYMENT',
        customerId: isCustomer ? showPaymentModal.id : undefined,
        supplierId: !isCustomer ? showPaymentModal.id : undefined,
        amount: voucherAmount,
        paymentMode: voucherMode,
        referenceNumber: voucherRef || undefined,
        notes: voucherNotes || undefined,
        paymentDate: new Date().toISOString(),
      });

      setShowPaymentModal(null);
      setVoucherAmount(0);
      setVoucherRef('');
      setVoucherNotes('');
      await loadData();

      // If ledger is open, refresh it
      if (activeLedgerParty && activeLedgerParty.id === showPaymentModal.id) {
        handleOpenLedger(activeLedgerParty);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Parties &amp; Account Ledgers
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage Sundry Debtors (Customers), Sundry Creditors (Suppliers), debit/credit vouchers, and statement balances.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setActiveTab('CUSTOMERS')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'CUSTOMERS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Customers (Sundry Debtors)
          </button>
          <button
            onClick={() => setActiveTab('SUPPLIERS')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'SUPPLIERS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            Suppliers (Sundry Creditors)
          </button>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 font-semibold text-slate-700">
                <th className="py-3 px-3">Party Name &amp; Contact</th>
                <th className="py-3 px-2">Address &amp; State</th>
                <th className="py-3 px-2">GSTIN / Tax ID</th>
                <th className="py-3 px-2">Drug Licence</th>
                <th className="py-3 px-3 text-right">Outstanding Balance</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeTab === 'CUSTOMERS' ? (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{c.name}</div>
                      {c.phone && <div className="text-[11px] text-slate-500">Ph: {c.phone}</div>}
                    </td>
                    <td className="py-3 px-2 text-slate-700 max-w-[200px] truncate">
                      {c.address || c.city || '-'} ({c.stateCode || '29'})
                    </td>
                    <td className="py-3 px-2 font-mono text-slate-600">{c.gstin || '-'}</td>
                    <td className="py-3 px-2 text-[11px] font-mono text-slate-600">
                      {c.dlNo1 || '-'}{c.dlNo2 ? ` / ${c.dlNo2}` : ''}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold">
                      <span className={c.currentBalance > 0 ? 'text-rose-700' : 'text-slate-900'}>
                        ₹{c.currentBalance.toFixed(2)} {c.currentBalance > 0 ? 'Dr' : ''}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenLedger({ id: c.id, name: c.name, type: 'CUSTOMER', balance: c.currentBalance })}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-semibold text-[11px] transition cursor-pointer"
                        >
                          Ledger
                        </button>
                        <button
                          onClick={() => setShowPaymentModal({ id: c.id, name: c.name, type: 'CUSTOMER' })}
                          className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded font-semibold text-[11px] transition cursor-pointer"
                        >
                          + Receipt
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{s.name}</div>
                      {s.phone && <div className="text-[11px] text-slate-500">Ph: {s.phone}</div>}
                    </td>
                    <td className="py-3 px-2 text-slate-700 max-w-[200px] truncate">
                      {s.address || s.city || '-'} ({s.stateCode || '06'})
                    </td>
                    <td className="py-3 px-2 font-mono text-slate-600 font-bold">{s.gstin || '-'}</td>
                    <td className="py-3 px-2 text-[11px] font-mono text-slate-600">{s.dlNo || '-'}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold">
                      <span className={s.currentBalance > 0 ? 'text-amber-800' : 'text-slate-900'}>
                        ₹{s.currentBalance.toFixed(2)} {s.currentBalance > 0 ? 'Cr' : ''}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenLedger({ id: s.id, name: s.name, type: 'SUPPLIER', balance: s.currentBalance })}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-semibold text-[11px] transition cursor-pointer"
                        >
                          Ledger
                        </button>
                        <button
                          onClick={() => setShowPaymentModal({ id: s.id, name: s.name, type: 'SUPPLIER' })}
                          className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded font-semibold text-[11px] transition cursor-pointer"
                        >
                          + Payment
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ledger Modal View (Similar to reference image_e8b6284a.png) */}
      {activeLedgerParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm">Account Ledger: {activeLedgerParty.name}</h3>
                <div className="text-[11px] text-slate-300">
                  {activeLedgerParty.type === 'CUSTOMER' ? 'Sundry Debtor Statement' : 'Sundry Creditor Statement'}
                </div>
              </div>
              <button
                onClick={() => setActiveLedgerParty(null)}
                className="text-white/70 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs">
              <div>
                <span className="text-slate-500">Current Balance: </span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  ₹{activeLedgerParty.balance.toFixed(2)}
                </span>
              </div>
              <button
                onClick={() => setShowPaymentModal(activeLedgerParty)}
                className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-bold text-xs shadow-xs"
              >
                {activeLedgerParty.type === 'CUSTOMER' ? '+ Record Receipt' : '+ Record Payment'}
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {ledgerLoading ? (
                <div className="py-8 text-center text-slate-500 text-xs">Loading ledger entries...</div>
              ) : ledgerEntries.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">No transactions recorded for this party.</div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 text-slate-600 font-semibold bg-slate-100">
                      <th className="py-2 px-2">Date</th>
                      <th className="py-2 px-2">Type</th>
                      <th className="py-2 px-2">Voucher No</th>
                      <th className="py-2 px-2 text-right">Debit (₹)</th>
                      <th className="py-2 px-2 text-right">Credit (₹)</th>
                      <th className="py-2 px-2 text-right">Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {ledgerEntries.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="py-2 px-2 font-sans text-slate-700">{e.date.substring(0, 10)}</td>
                        <td className="py-2 px-2 font-sans font-bold text-slate-800">{e.voucherType}</td>
                        <td className="py-2 px-2 text-slate-900">{e.voucherNumber}</td>
                        <td className="py-2 px-2 text-right text-rose-700">
                          {e.debit > 0 ? e.debit.toFixed(2) : '-'}
                        </td>
                        <td className="py-2 px-2 text-right text-emerald-700">
                          {e.credit > 0 ? e.credit.toFixed(2) : '-'}
                        </td>
                        <td className="py-2 px-2 text-right font-bold text-slate-950">
                          {e.balance.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Record Payment / Receipt Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full border border-slate-200 p-5 space-y-3 text-xs">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-900">
                {showPaymentModal.type === 'CUSTOMER' ? 'Receipt from Customer' : 'Payment to Supplier'}
              </h3>
              <button onClick={() => setShowPaymentModal(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-slate-600 font-medium">Party: {showPaymentModal.name}</div>

            <form onSubmit={handleRecordPayment} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={voucherAmount}
                  onChange={(e) => setVoucherAmount(parseFloat(e.target.value) || 0)}
                  className="w-full border border-slate-300 rounded p-2 font-mono font-bold text-base focus:outline-teal-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Mode</label>
                <select
                  value={voucherMode}
                  onChange={(e) => setVoucherMode(e.target.value as any)}
                  className="w-full border border-slate-300 rounded p-2 focus:outline-teal-500"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Ref / UTR / Cheque Number</label>
                <input
                  type="text"
                  value={voucherRef}
                  onChange={(e) => setVoucherRef(e.target.value)}
                  placeholder="e.g. UPI-12948291048"
                  className="w-full border border-slate-300 rounded p-2 focus:outline-teal-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Remarks</label>
                <input
                  type="text"
                  value={voucherNotes}
                  onChange={(e) => setVoucherNotes(e.target.value)}
                  placeholder="Payment against Invoice AM-00001"
                  className="w-full border border-slate-300 rounded p-2 focus:outline-teal-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(null)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded"
                >
                  Save Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
