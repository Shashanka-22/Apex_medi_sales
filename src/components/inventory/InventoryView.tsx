import React, { useState, useEffect } from 'react';
import { api, Medicine, MedicineBatch } from '../../lib/api';
import {
  Search, Plus, Filter, Download, ChevronDown, ChevronRight,
  Package, AlertTriangle, Edit3, Trash2, Check, RefreshCw, X, Sliders, FileText
} from 'lucide-react';

interface InventoryViewProps {
  onNavigateToUpload?: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ onNavigateToUpload }) => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dosageFilter, setDosageFilter] = useState('ALL');
  const [expandedMedId, setExpandedMedId] = useState<string | null>(null);

  // Modals
  const [showAddMed, setShowAddMed] = useState(false);
  const [showAddBatch, setShowAddBatch] = useState<Medicine | null>(null);
  const [showAdjustStock, setShowAdjustStock] = useState<MedicineBatch | null>(null);

  // Form states
  const [newMed, setNewMed] = useState({
    name: '',
    genericName: '',
    manufacturer: '',
    dosageForm: 'TABLET',
    packSize: '10X15',
    uom: 'STRIP',
    hsnCode: '30049000',
    barcode: '',
    isPrescriptionRequired: false,
    minStockAlert: 20,
    taxRate: 5.0,
    isActive: true,
  });

  const [newBatch, setNewBatch] = useState({
    batchNumber: '',
    expiryDate: '2027-12-31',
    purchaseRate: 100,
    mrp: 150,
    sellingRate: 130,
    initialQty: 50,
    currentQty: 50,
    freeQty: 0,
    gstRate: 5.0,
    discount: 0,
  });

  const [adjustData, setAdjustData] = useState({
    newQuantity: 0,
    reason: 'Physical Stock Count Reconciliation',
  });

  const [showEditMed, setShowEditMed] = useState<Medicine | null>(null);
  const [editMedData, setEditMedData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const data = await api.getMedicines();
      setMedicines(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredMedicines = medicines.filter((m) => {
    const matchSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.genericName && m.genericName.toLowerCase().includes(search.toLowerCase())) ||
      (m.manufacturer && m.manufacturer.toLowerCase().includes(search.toLowerCase())) ||
      (m.hsnCode && m.hsnCode.includes(search));
    const matchDosage = dosageFilter === 'ALL' || m.dosageForm === dosageFilter;
    return matchSearch && matchDosage;
  });

  const handleCreateMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMed.name.trim()) return;
    setError(null);
    try {
      await api.addMedicine(newMed);
      setSuccessMessage(`Medicine '${newMed.name}' created successfully.`);
      setTimeout(() => setSuccessMessage(null), 3000);
      setShowAddMed(false);
      setNewMed({
        name: '',
        genericName: '',
        manufacturer: '',
        dosageForm: 'TABLET',
        packSize: '10X15',
        uom: 'STRIP',
        hsnCode: '30049000',
        barcode: '',
        isPrescriptionRequired: false,
        minStockAlert: 20,
        taxRate: 5.0,
        isActive: true,
      });
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed creating medicine');
    }
  };

  const handleOpenEditMed = (med: Medicine) => {
    setEditMedData({
      name: med.name,
      genericName: med.genericName || '',
      manufacturer: med.manufacturer || '',
      dosageForm: med.dosageForm || 'TABLET',
      packSize: med.packSize || '',
      uom: med.uom || 'STRIP',
      hsnCode: med.hsnCode || '30049000',
      barcode: med.barcode || '',
      isPrescriptionRequired: !!med.isPrescriptionRequired,
      minStockAlert: med.minStockAlert || 20,
      taxRate: med.taxRate || 5.0,
      isActive: med.isActive !== false,
    });
    setShowEditMed(med);
  };

  const handleSaveEditMed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditMed || !editMedData.name.trim()) return;
    setError(null);
    try {
      await api.updateMedicine(showEditMed.id, editMedData);
      setSuccessMessage(`Medicine '${editMedData.name}' updated successfully.`);
      setTimeout(() => setSuccessMessage(null), 3000);
      setShowEditMed(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed updating medicine');
    }
  };

  const handleDeleteMed = async (med: Medicine) => {
    if (!window.confirm(`Are you sure you want to delete ${med.name}?`)) return;
    setError(null);
    try {
      await api.deleteMedicine(med.id);
      setSuccessMessage(`Medicine '${med.name}' deleted successfully.`);
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed deleting medicine');
    }
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAddBatch || !newBatch.batchNumber.trim()) return;
    setError(null);
    try {
      await api.addBatch({
        ...newBatch,
        medicineId: showAddBatch.id,
      });
      setSuccessMessage(`Batch '${newBatch.batchNumber}' added successfully.`);
      setTimeout(() => setSuccessMessage(null), 3000);
      setShowAddBatch(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed adding batch');
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAdjustStock || !adjustData.reason.trim()) return;
    setError(null);
    try {
      await api.adjustStock(
        showAdjustStock.id,
        adjustData.newQuantity,
        adjustData.reason
      );
      setSuccessMessage(`Stock adjusted successfully to ${adjustData.newQuantity} units.`);
      setTimeout(() => setSuccessMessage(null), 3000);
      setShowAdjustStock(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed adjusting stock');
    }
  };

  const handleExportCsv = () => {
    const rows = [
      ['Medicine Name', 'Dosage Form', 'Pack Size', 'HSN Code', 'Batch No', 'Expiry Date', 'Available Qty', 'Purchase Rate', 'MRP', 'Selling Rate', 'GST%'],
    ];

    medicines.forEach((m) => {
      (m.batches || []).forEach((b) => {
        rows.push([
          m.name,
          m.dosageForm,
          m.packSize,
          m.hsnCode,
          b.batchNumber,
          b.expiryDate,
          String(b.currentQty),
          String(b.purchaseRate),
          String(b.mrp),
          String(b.sellingRate),
          String(b.gstRate),
        ]);
      });
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Inventory_Apex_Medi_Sales_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Medicine &amp; Batch Inventory Master
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage pharmaceutical items, batch-wise tracking, MRP, cost rates, and stock adjustments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNavigateToUpload && (
            <button
              onClick={onNavigateToUpload}
              className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-4 h-4 text-teal-200" />
              📄 Upload Purchase Bill
            </button>
          )}
          <button
            onClick={handleExportCsv}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-300 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => setShowAddMed(true)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Medicine
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by medicine name, generic name, HSN, or manufacturer..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-teal-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 font-medium">Form:</span>
          <select
            value={dosageFilter}
            onChange={(e) => setDosageFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 focus:outline-teal-500"
          >
            <option value="ALL">All Forms</option>
            <option value="TABLET">Tablets</option>
            <option value="CAPSULE">Capsules</option>
            <option value="SYRUP">Syrups</option>
            <option value="DROPS">Drops</option>
            <option value="INJECTION">Injections</option>
          </select>
        </div>
      </div>

      {/* Medicines Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 font-semibold text-slate-700">
                <th className="py-3 px-3 w-8"></th>
                <th className="py-3 px-3">Medicine Name &amp; Generic</th>
                <th className="py-3 px-2">Manufacturer</th>
                <th className="py-3 px-2 text-center">Form / Pack</th>
                <th className="py-3 px-2 text-center">HSN Code</th>
                <th className="py-3 px-2 text-center">GST Rate</th>
                <th className="py-3 px-2 text-right">Total Stock</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMedicines.map((med) => {
                const isExpanded = expandedMedId === med.id;
                const isLow = med.totalStock <= med.minStockAlert;

                return (
                  <React.Fragment key={med.id}>
                    <tr
                      className={`hover:bg-slate-50/70 transition cursor-pointer ${
                        isExpanded ? 'bg-teal-50/20' : ''
                      }`}
                      onClick={() => setExpandedMedId(isExpanded ? null : med.id)}
                    >
                      <td className="py-3 px-3 text-slate-400">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-teal-700" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{med.name}</div>
                        {med.genericName && (
                          <div className="text-[11px] text-slate-500 italic mt-0.5">
                            {med.genericName}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2 text-slate-700">{med.manufacturer || '-'}</td>
                      <td className="py-3 px-2 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-medium text-slate-700">
                          {med.dosageForm} ({med.packSize})
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center font-mono text-slate-600">{med.hsnCode}</td>
                      <td className="py-3 px-2 text-center font-mono font-medium">{med.taxRate}%</td>
                      <td className="py-3 px-2 text-right">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded ${
                            isLow ? 'bg-rose-100 text-rose-800' : 'bg-emerald-50 text-emerald-800'
                          }`}
                        >
                          {med.totalStock}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setShowAddBatch(med)}
                            className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded font-semibold text-[11px] transition cursor-pointer"
                            title="Add Batch to Medicine"
                          >
                            + Batch
                          </button>
                          <button
                            onClick={() => handleOpenEditMed(med)}
                            className="p-1 text-slate-500 hover:text-teal-700 rounded transition cursor-pointer"
                            title="Edit Medicine Details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMed(med)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                            title="Delete Medicine"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Batch Subtable Drawer */}
                    {isExpanded && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={8} className="p-4 pl-10 border-b border-slate-200">
                          <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                                Batches for {med.name} ({med.batches?.length || 0})
                              </span>
                              <button
                                onClick={() => setShowAddBatch(med)}
                                className="text-xs font-semibold text-teal-700 hover:text-teal-900 cursor-pointer flex items-center gap-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Add Batch to {med.name}
                              </button>
                            </div>

                            {(!med.batches || med.batches.length === 0) ? (
                              <div className="py-4 text-center text-xs text-slate-400">
                                No batches currently recorded for this medicine.
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                                      <th className="py-1.5 px-2">Batch No</th>
                                      <th className="py-1.5 px-2">Expiry Date</th>
                                      <th className="py-1.5 px-2 text-right">Cost Rate</th>
                                      <th className="py-1.5 px-2 text-right">MRP (GST-Incl)</th>
                                      <th className="py-1.5 px-2 text-right">Selling Rate (₹)</th>
                                      <th className="py-1.5 px-2 text-right">Available Qty</th>
                                      <th className="py-1.5 px-2 text-center">Status</th>
                                      <th className="py-1.5 px-2 text-center">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {med.batches.map((batch) => {
                                      const isExpired = new Date(batch.expiryDate) < new Date();
                                      return (
                                        <tr key={batch.id} className="hover:bg-slate-50">
                                          <td className="py-2 px-2 font-mono font-bold text-slate-900">
                                            {batch.batchNumber}
                                          </td>
                                          <td className="py-2 px-2 font-mono text-slate-700">
                                            {batch.expiryDate.substring(0, 10)}
                                          </td>
                                          <td className="py-2 px-2 text-right font-mono text-slate-600">
                                            ₹{batch.purchaseRate.toFixed(2)}
                                          </td>
                                          <td className="py-2 px-2 text-right font-mono text-slate-600">
                                            ₹{batch.mrp.toFixed(2)}
                                          </td>
                                          <td className="py-2 px-2 text-right font-mono font-bold text-teal-800">
                                            ₹{batch.sellingRate.toFixed(2)}
                                          </td>
                                          <td className="py-2 px-2 text-right font-mono font-bold text-slate-950">
                                            {batch.currentQty}
                                          </td>
                                          <td className="py-2 px-2 text-center">
                                            {isExpired ? (
                                              <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-bold">
                                                EXPIRED
                                              </span>
                                            ) : (
                                              <span className="text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-medium">
                                                ACTIVE
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2 px-2 text-center">
                                            <button
                                              onClick={() => {
                                                setShowAdjustStock(batch);
                                                setAdjustData({
                                                  newQuantity: batch.currentQty,
                                                  reason: 'Physical Stock Count Reconciliation',
                                                });
                                              }}
                                              className="p-1 text-slate-600 hover:text-teal-700 rounded transition cursor-pointer"
                                              title="Adjust Stock Quantity"
                                            >
                                              <Sliders className="w-3.5 h-3.5" />
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
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

      {/* Modal: Add Medicine */}
      {showAddMed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-teal-800 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Add New Medicine to Master</h3>
              <button onClick={() => setShowAddMed(false)} className="text-white/80 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateMedicine} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Medicine / Brand Name *</label>
                <input
                  type="text"
                  required
                  value={newMed.name}
                  onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                  placeholder="e.g. PODPILL CV DS DRY SYP"
                  className="w-full border border-slate-300 rounded-lg p-2 focus:outline-teal-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Generic Name</label>
                  <input
                    type="text"
                    value={newMed.genericName}
                    onChange={(e) => setNewMed({ ...newMed, genericName: e.target.value })}
                    placeholder="e.g. Cefpodoxime Proxetil"
                    className="w-full border border-slate-300 rounded-lg p-2 focus:outline-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Manufacturer</label>
                  <input
                    type="text"
                    value={newMed.manufacturer}
                    onChange={(e) => setNewMed({ ...newMed, manufacturer: e.target.value })}
                    placeholder="e.g. KROYF LABCORP"
                    className="w-full border border-slate-300 rounded-lg p-2 focus:outline-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Dosage Form</label>
                  <select
                    value={newMed.dosageForm}
                    onChange={(e) => setNewMed({ ...newMed, dosageForm: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:outline-teal-500"
                  >
                    <option value="TABLET">TABLET</option>
                    <option value="CAPSULE">CAPSULE</option>
                    <option value="SYRUP">SYRUP</option>
                    <option value="DROPS">DROPS</option>
                    <option value="INJECTION">INJECTION</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Packing</label>
                  <input
                    type="text"
                    value={newMed.packSize}
                    onChange={(e) => setNewMed({ ...newMed, packSize: e.target.value })}
                    placeholder="30 ML / 10X15"
                    className="w-full border border-slate-300 rounded-lg p-2 focus:outline-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">HSN Code</label>
                  <input
                    type="text"
                    value={newMed.hsnCode}
                    onChange={(e) => setNewMed({ ...newMed, hsnCode: e.target.value })}
                    placeholder="30049000"
                    className="w-full border border-slate-300 rounded-lg p-2 focus:outline-teal-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">GST Rate (%)</label>
                  <select
                    value={newMed.taxRate}
                    onChange={(e) => setNewMed({ ...newMed, taxRate: parseFloat(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:outline-teal-500"
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Min Stock Alert</label>
                  <input
                    type="number"
                    value={newMed.minStockAlert}
                    onChange={(e) => setNewMed({ ...newMed, minStockAlert: parseInt(e.target.value) || 0 })}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:outline-teal-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddMed(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-lg"
                >
                  Save Medicine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Batch */}
      {showAddBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-teal-800 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm">Add New Batch</h3>
                <div className="text-[11px] text-teal-200">{showAddBatch.name}</div>
              </div>
              <button onClick={() => setShowAddBatch(null)} className="text-white/80 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateBatch} className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Batch Number *</label>
                  <input
                    type="text"
                    required
                    value={newBatch.batchNumber}
                    onChange={(e) => setNewBatch({ ...newBatch, batchNumber: e.target.value.toUpperCase() })}
                    placeholder="PBD5255C"
                    className="w-full border border-slate-300 rounded-lg p-2 focus:outline-teal-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expiry Date *</label>
                  <input
                    type="date"
                    required
                    value={newBatch.expiryDate}
                    onChange={(e) => setNewBatch({ ...newBatch, expiryDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:outline-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Purchase Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newBatch.purchaseRate}
                    onChange={(e) => setNewBatch({ ...newBatch, purchaseRate: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:outline-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">MRP (₹, GST-Incl)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newBatch.mrp}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setNewBatch({
                        ...newBatch,
                        mrp: val,
                        sellingRate: newBatch.sellingRate === 0 || newBatch.sellingRate === newBatch.mrp ? val : newBatch.sellingRate,
                      });
                    }}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:outline-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Customer Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newBatch.sellingRate}
                    onChange={(e) => setNewBatch({ ...newBatch, sellingRate: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:outline-teal-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Initial Quantity in Units</label>
                <input
                  type="number"
                  min="1"
                  value={newBatch.currentQty}
                  onChange={(e) => {
                    const q = parseInt(e.target.value) || 0;
                    setNewBatch({ ...newBatch, initialQty: q, currentQty: q });
                  }}
                  className="w-full border border-slate-300 rounded-lg p-2 focus:outline-teal-500 font-mono font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddBatch(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-lg"
                >
                  Save Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Stock Adjustment */}
      {showAdjustStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-teal-800 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm">Adjust Stock</h3>
                <div className="text-[11px] text-teal-200">Batch: {showAdjustStock.batchNumber}</div>
              </div>
              <button onClick={() => setShowAdjustStock(null)} className="text-white/80 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAdjustStock} className="p-5 space-y-3 text-xs">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600">
                Current Stock: <strong className="font-mono text-slate-900">{showAdjustStock.currentQty}</strong> units
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Verified Quantity *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={adjustData.newQuantity}
                  onChange={(e) => setAdjustData({ ...adjustData, newQuantity: parseInt(e.target.value) || 0 })}
                  className="w-full border border-slate-300 rounded-lg p-2 focus:outline-teal-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mandatory Audit Reason *</label>
                <select
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 focus:outline-teal-500"
                >
                  <option value="Physical Stock Count Reconciliation">Physical Stock Count Reconciliation</option>
                  <option value="Damaged / Broken in Store">Damaged / Broken in Store</option>
                  <option value="Expired Medicine Quarantine / Write-Off">Expired Medicine Quarantine / Write-Off</option>
                  <option value="Supplier Return">Supplier Return</option>
                  <option value="Customer Return">Customer Return</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAdjustStock(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-lg"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal: Edit Medicine */}
      {showEditMed && editMedData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden text-xs">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm">Edit Medicine Details</h3>
                <div className="text-[11px] text-teal-200">{showEditMed.name}</div>
              </div>
              <button onClick={() => setShowEditMed(null)} className="text-white/80 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditMed} className="p-5 space-y-3 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Brand / Product Name *</label>
                <input
                  type="text"
                  required
                  value={editMedData.name}
                  onChange={(e) => setEditMedData({ ...editMedData, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 focus:outline-teal-500 font-bold"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Generic Composition</label>
                <input
                  type="text"
                  value={editMedData.genericName}
                  onChange={(e) => setEditMedData({ ...editMedData, genericName: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 focus:outline-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Manufacturer</label>
                  <input
                    type="text"
                    value={editMedData.manufacturer}
                    onChange={(e) => setEditMedData({ ...editMedData, manufacturer: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:outline-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Dosage Form</label>
                  <select
                    value={editMedData.dosageForm}
                    onChange={(e) => setEditMedData({ ...editMedData, dosageForm: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:outline-teal-500"
                  >
                    <option value="TABLET">TABLET</option>
                    <option value="CAPSULE">CAPSULE</option>
                    <option value="SYRUP">SYRUP</option>
                    <option value="DROPS">DROPS</option>
                    <option value="INJECTION">INJECTION</option>
                    <option value="OINTMENT">OINTMENT</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Pack Size</label>
                  <input
                    type="text"
                    value={editMedData.packSize}
                    onChange={(e) => setEditMedData({ ...editMedData, packSize: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:outline-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">HSN Code</label>
                  <input
                    type="text"
                    value={editMedData.hsnCode}
                    onChange={(e) => setEditMedData({ ...editMedData, hsnCode: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:outline-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">GST Rate (%)</label>
                  <select
                    value={editMedData.taxRate}
                    onChange={(e) => setEditMedData({ ...editMedData, taxRate: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:outline-teal-500"
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Min Stock Alert</label>
                  <input
                    type="number"
                    value={editMedData.minStockAlert}
                    onChange={(e) => setEditMedData({ ...editMedData, minStockAlert: parseInt(e.target.value) || 0 })}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:outline-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Active Status</label>
                  <select
                    value={editMedData.isActive ? 'true' : 'false'}
                    onChange={(e) => setEditMedData({ ...editMedData, isActive: e.target.value === 'true' })}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:outline-teal-500"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive / Discontinued</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEditMed(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-lg"
                >
                  Update Medicine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
