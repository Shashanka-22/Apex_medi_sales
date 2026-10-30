import React, { useState, useEffect } from 'react';
import { api, Customer, Supplier, LedgerEntry } from '../../lib/api';
import {
  Users, Building, Plus, FileText, Banknote, RefreshCw, X,
  Search, Edit2, Trash2, AlertCircle, CheckCircle
} from 'lucide-react';

export const PartiesView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'CUSTOMERS' | 'SUPPLIERS'>('CUSTOMERS');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  // Add / Edit Party Modal
  const [partyModal, setPartyModal] = useState<{
    mode: 'ADD' | 'EDIT';
    type: 'CUSTOMER' | 'SUPPLIER';
    id?: string;
  } | null>(null);

  const [partyFormData, setPartyFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: 'Karnataka',
    stateCode: '29',
    gstin: '',
    dlNo: '',
    dlNo1: '',
    dlNo2: '',
    openingBalance: 0,
  });

  const loadData = async () => {
    try {
      const [c, s] = await Promise.all([api.getCustomers(), api.getSuppliers()]);
      setCustomers(c);
      setSuppliers(s);
    } catch (err: any) {
      setError(err.message || 'Failed loading parties');
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
    } catch (err: any) {
      setError(err.message || 'Failed loading ledger');
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPaymentModal || voucherAmount <= 0) return;

    setError(null);
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

      setSuccess(`Voucher recorded successfully for ${showPaymentModal.name}`);
      setTimeout(() => setSuccess(null), 3000);
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
      setError(err.message || 'Failed recording payment voucher');
    }
  };

  const openAddParty = (type: 'CUSTOMER' | 'SUPPLIER') => {
    setPartyFormData({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      state: 'Karnataka',
      stateCode: '29',
      gstin: '',
      dlNo: '',
      dlNo1: '',
      dlNo2: '',
      openingBalance: 0,
    });
    setPartyModal({ mode: 'ADD', type });
  };

  const openEditParty = (party: Customer | Supplier, type: 'CUSTOMER' | 'SUPPLIER') => {
    const isCust = type === 'CUSTOMER';
    const c = party as Customer;
    const s = party as Supplier;

    setPartyFormData({
      name: party.name,
      contactPerson: party.contactPerson || '',
      phone: party.phone || '',
      email: party.email || '',
      address: party.address || '',
      city: party.city || '',
      state: party.state || 'Karnataka',
      stateCode: party.stateCode || '29',
      gstin: party.gstin || '',
      dlNo: !isCust ? s.dlNo || '' : '',
      dlNo1: isCust ? c.dlNo1 || '' : '',
      dlNo2: isCust ? c.dlNo2 || '' : '',
      openingBalance: party.openingBalance || 0,
    });
    setPartyModal({ mode: 'EDIT', type, id: party.id });
  };

  const handleSaveParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyModal || !partyFormData.name.trim()) return;

    setError(null);
    try {
      const isCust = partyModal.type === 'CUSTOMER';

      if (partyModal.mode === 'ADD') {
        if (isCust) {
          await api.addCustomer({
            name: partyFormData.name.trim(),
            contactPerson: partyFormData.contactPerson.trim() || undefined,
            phone: partyFormData.phone.trim() || undefined,
            email: partyFormData.email.trim() || undefined,
            address: partyFormData.address.trim() || undefined,
            city: partyFormData.city.trim() || undefined,
            state: partyFormData.state,
            stateCode: partyFormData.stateCode,
            gstin: partyFormData.gstin.trim() || undefined,
            dlNo1: partyFormData.dlNo1.trim() || undefined,
            dlNo2: partyFormData.dlNo2.trim() || undefined,
            openingBalance: Number(partyFormData.openingBalance) || 0,
            currentBalance: Number(partyFormData.openingBalance) || 0,
          });
          setSuccess(`Customer '${partyFormData.name}' created successfully`);
        } else {
          await api.addSupplier({
            name: partyFormData.name.trim(),
            contactPerson: partyFormData.contactPerson.trim() || undefined,
            phone: partyFormData.phone.trim() || undefined,
            email: partyFormData.email.trim() || undefined,
            address: partyFormData.address.trim() || undefined,
            city: partyFormData.city.trim() || undefined,
            state: partyFormData.state,
            stateCode: partyFormData.stateCode,
            gstin: partyFormData.gstin.trim() || undefined,
            dlNo: partyFormData.dlNo.trim() || undefined,
            openingBalance: Number(partyFormData.openingBalance) || 0,
            currentBalance: Number(partyFormData.openingBalance) || 0,
          });
          setSuccess(`Supplier '${partyFormData.name}' created successfully`);
        }
      } else {
        // Edit
        if (isCust) {
          await api.updateCustomer(partyModal.id!, {
            name: partyFormData.name.trim(),
            contactPerson: partyFormData.contactPerson.trim() || undefined,
            phone: partyFormData.phone.trim() || undefined,
            email: partyFormData.email.trim() || undefined,
            address: partyFormData.address.trim() || undefined,
            city: partyFormData.city.trim() || undefined,
            state: partyFormData.state,
            stateCode: partyFormData.stateCode,
            gstin: partyFormData.gstin.trim() || undefined,
            dlNo1: partyFormData.dlNo1.trim() || undefined,
            dlNo2: partyFormData.dlNo2.trim() || undefined,
          });
          setSuccess(`Customer updated successfully`);
        } else {
          await api.updateSupplier(partyModal.id!, {
            name: partyFormData.name.trim(),
            contactPerson: partyFormData.contactPerson.trim() || undefined,
            phone: partyFormData.phone.trim() || undefined,
            email: partyFormData.email.trim() || undefined,
            address: partyFormData.address.trim() || undefined,
            city: partyFormData.city.trim() || undefined,
            state: partyFormData.state,
            stateCode: partyFormData.stateCode,
            gstin: partyFormData.gstin.trim() || undefined,
            dlNo: partyFormData.dlNo.trim() || undefined,
          });
          setSuccess(`Supplier updated successfully`);
        }
      }

      setTimeout(() => setSuccess(null), 3000);
      setPartyModal(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed saving party details');
    }
  };

  const handleDeleteParty = async (id: string, name: string, type: 'CUSTOMER' | 'SUPPLIER') => {
    if (!window.confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
      return;
    }
    setError(null);
    try {
      if (type === 'CUSTOMER') {
        await api.deleteCustomer(id);
        setSuccess(`Customer '${name}' deleted successfully`);
      } else {
        await api.deleteSupplier(id);
        setSuccess(`Supplier '${name}' deleted successfully`);
      }
      setTimeout(() => setSuccess(null), 3000);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete party');
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone && c.phone.includes(search)) ||
      (c.gstin && c.gstin.toLowerCase().includes(search.toLowerCase())) ||
      (c.city && c.city.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.phone && s.phone.includes(search)) ||
      (s.gstin && s.gstin.toLowerCase().includes(search.toLowerCase())) ||
      (s.city && s.city.toLowerCase().includes(search.toLowerCase()))
  );

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

        <div className="flex flex-wrap items-center gap-2">
          {/* Tab Toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => {
                setActiveTab('CUSTOMERS');
                setSearch('');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'CUSTOMERS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Customers ({customers.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('SUPPLIERS');
                setSearch('');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'SUPPLIERS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              Suppliers ({suppliers.length})
            </button>
          </div>

          <button
            onClick={() => openAddParty(activeTab === 'CUSTOMERS' ? 'CUSTOMER' : 'SUPPLIER')}
            className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-lg shadow-xs transition flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {activeTab === 'CUSTOMERS' ? 'Add Customer' : 'Add Supplier'}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-400 ml-1" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${activeTab === 'CUSTOMERS' ? 'customers' : 'suppliers'} by name, phone, GSTIN, city...`}
          className="w-full text-xs bg-transparent border-0 focus:outline-hidden"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600 text-xs mr-2">
            Clear
          </button>
        )}
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
                filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No customers found. Click &quot;Add Customer&quot; above to create one.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{c.name}</div>
                        {c.contactPerson && <div className="text-[11px] text-slate-600">Contact: {c.contactPerson}</div>}
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
                            title="View Account Ledger Statement"
                          >
                            Ledger
                          </button>
                          <button
                            onClick={() => setShowPaymentModal({ id: c.id, name: c.name, type: 'CUSTOMER' })}
                            className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded font-semibold text-[11px] transition cursor-pointer"
                            title="Record Receipt Voucher"
                          >
                            + Receipt
                          </button>
                          <button
                            onClick={() => openEditParty(c, 'CUSTOMER')}
                            className="p-1 text-slate-500 hover:text-teal-700 rounded transition cursor-pointer"
                            title="Edit Customer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteParty(c.id, c.name, 'CUSTOMER')}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                            title="Delete Customer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )
              ) : (
                filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No suppliers found. Click &quot;Add Supplier&quot; above to create one.
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{s.name}</div>
                        {s.contactPerson && <div className="text-[11px] text-slate-600">Contact: {s.contactPerson}</div>}
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
                            title="View Supplier Ledger Statement"
                          >
                            Ledger
                          </button>
                          <button
                            onClick={() => setShowPaymentModal({ id: s.id, name: s.name, type: 'SUPPLIER' })}
                            className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded font-semibold text-[11px] transition cursor-pointer"
                            title="Record Payment Voucher"
                          >
                            + Payment
                          </button>
                          <button
                            onClick={() => openEditParty(s, 'SUPPLIER')}
                            className="p-1 text-slate-500 hover:text-teal-700 rounded transition cursor-pointer"
                            title="Edit Supplier"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteParty(s.id, s.name, 'SUPPLIER')}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                            title="Delete Supplier"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ledger Modal View */}
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

      {/* Add / Edit Party Modal */}
      {partyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden text-xs">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">
                {partyModal.mode === 'ADD' ? 'Add New' : 'Edit'}{' '}
                {partyModal.type === 'CUSTOMER' ? 'Customer (Sundry Debtor)' : 'Supplier (Sundry Creditor)'}
              </h3>
              <button onClick={() => setPartyModal(null)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveParty} className="p-4 space-y-3 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Party / Business Name *</label>
                <input
                  type="text"
                  required
                  value={partyFormData.name}
                  onChange={(e) => setPartyFormData({ ...partyFormData, name: e.target.value })}
                  placeholder="e.g. Sri Rama Medicals / Sai Pharma"
                  className="w-full border border-slate-300 rounded p-2 focus:outline-teal-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={partyFormData.contactPerson}
                    onChange={(e) => setPartyFormData({ ...partyFormData, contactPerson: e.target.value })}
                    placeholder="Manager / Owner Name"
                    className="w-full border border-slate-300 rounded p-2 focus:outline-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={partyFormData.phone}
                    onChange={(e) => setPartyFormData({ ...partyFormData, phone: e.target.value })}
                    placeholder="10-digit mobile"
                    className="w-full border border-slate-300 rounded p-2 focus:outline-teal-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={partyFormData.email}
                    onChange={(e) => setPartyFormData({ ...partyFormData, email: e.target.value })}
                    placeholder="contact@pharmacy.com"
                    className="w-full border border-slate-300 rounded p-2 focus:outline-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={partyFormData.gstin}
                    onChange={(e) => setPartyFormData({ ...partyFormData, gstin: e.target.value.toUpperCase() })}
                    placeholder="15-character GSTIN"
                    className="w-full border border-slate-300 rounded p-2 focus:outline-teal-500 font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={partyFormData.address}
                  onChange={(e) => setPartyFormData({ ...partyFormData, address: e.target.value })}
                  placeholder="Door No, Street, Road, Landmark"
                  className="w-full border border-slate-300 rounded p-2 focus:outline-teal-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">City / Town</label>
                  <input
                    type="text"
                    value={partyFormData.city}
                    onChange={(e) => setPartyFormData({ ...partyFormData, city: e.target.value })}
                    placeholder="City"
                    className="w-full border border-slate-300 rounded p-2 focus:outline-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={partyFormData.state}
                    onChange={(e) => setPartyFormData({ ...partyFormData, state: e.target.value })}
                    placeholder="Karnataka"
                    className="w-full border border-slate-300 rounded p-2 focus:outline-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">State Code</label>
                  <input
                    type="text"
                    value={partyFormData.stateCode}
                    onChange={(e) => setPartyFormData({ ...partyFormData, stateCode: e.target.value })}
                    placeholder="29"
                    className="w-full border border-slate-300 rounded p-2 focus:outline-teal-500 font-mono"
                  />
                </div>
              </div>

              {partyModal.type === 'CUSTOMER' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Drug Licence 1 (Form 20)</label>
                    <input
                      type="text"
                      value={partyFormData.dlNo1}
                      onChange={(e) => setPartyFormData({ ...partyFormData, dlNo1: e.target.value })}
                      placeholder="KA-KW1-..."
                      className="w-full border border-slate-300 rounded p-2 focus:outline-teal-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Drug Licence 2 (Form 21)</label>
                    <input
                      type="text"
                      value={partyFormData.dlNo2}
                      onChange={(e) => setPartyFormData({ ...partyFormData, dlNo2: e.target.value })}
                      placeholder="KA-KW1-..."
                      className="w-full border border-slate-300 rounded p-2 focus:outline-teal-500 font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Drug Licence Number</label>
                  <input
                    type="text"
                    value={partyFormData.dlNo}
                    onChange={(e) => setPartyFormData({ ...partyFormData, dlNo: e.target.value })}
                    placeholder="DL No."
                    className="w-full border border-slate-300 rounded p-2 focus:outline-teal-500 font-mono"
                  />
                </div>
              )}

              {partyModal.mode === 'ADD' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Opening Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={partyFormData.openingBalance}
                    onChange={(e) => setPartyFormData({ ...partyFormData, openingBalance: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full border border-slate-300 rounded p-2 focus:outline-teal-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-500">
                    {partyModal.type === 'CUSTOMER' ? 'Positive value = Customer owes you (Debit)' : 'Positive value = You owe supplier (Credit)'}
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPartyModal(null)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded shadow-xs"
                >
                  {partyModal.mode === 'ADD' ? 'Save Party' : 'Update Party'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
