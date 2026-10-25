import React, { useState } from 'react';
import { api, BusinessProfile, UserSession } from '../../lib/api';
import { Building2, Shield, KeyRound, CheckCircle, AlertTriangle, Save, RefreshCw } from 'lucide-react';

interface SettingsViewProps {
  profile: BusinessProfile;
  currentUser: UserSession;
  onProfileUpdated: (updated: BusinessProfile) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile,
  currentUser,
  onProfileUpdated,
}) => {
  const [formData, setFormData] = useState<BusinessProfile>(profile);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Password Change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSuccess(false);
    try {
      const updated = await api.updateProfile(formData);
      onProfileUpdated(updated);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (newPassword !== confirmPassword) {
      setPassError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPassError('New password must be at least 8 characters long');
      return;
    }

    setChangingPass(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setPassSuccess('Password updated securely. Please use your new password on next login.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPassError(err.message || 'Failed changing password. Verify current password.');
    } finally {
      setChangingPass(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <h1 className="text-xl font-bold text-slate-900">
          Business Profile &amp; Account Settings
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure pharmacy shop identity, Drug Licences, GSTIN tax credentials, invoice terms, and security credentials.
        </p>
      </div>

      {/* Business Details Form */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-teal-700" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Store Identity &amp; Statutory Licences
            </h3>
          </div>
          {profileSuccess && (
            <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Saved Successfully!
            </span>
          )}
        </div>

        <form onSubmit={handleSaveProfile} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Medical Store / Firm Name *</label>
              <input
                type="text"
                required
                value={formData.storeName}
                onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 focus:outline-teal-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Owner / Proprietor Name</label>
              <input
                type="text"
                value={formData.ownerName}
                onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Premises Address *</label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-teal-500"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1">City / Taluk</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-teal-500"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">State</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-teal-500"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">State Code</label>
              <input
                type="text"
                value={formData.stateCode}
                onChange={(e) => setFormData({ ...formData, stateCode: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-teal-500 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">PIN Code</label>
              <input
                type="text"
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-teal-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 focus:outline-teal-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-200">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">GSTIN Number</label>
              <input
                type="text"
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2 focus:outline-teal-500 uppercase"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Drug Licence 1</label>
              <input
                type="text"
                value={formData.dlNo1}
                onChange={(e) => setFormData({ ...formData, dlNo1: e.target.value })}
                className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 focus:outline-teal-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Drug Licence 2 / Additional</label>
              <input
                type="text"
                value={formData.dlNo2}
                onChange={(e) => setFormData({ ...formData, dlNo2: e.target.value })}
                className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 focus:outline-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Invoice Prefix</label>
              <input
                type="text"
                value={formData.invoicePrefix}
                onChange={(e) => setFormData({ ...formData, invoicePrefix: e.target.value })}
                placeholder="AM"
                className="w-32 text-xs font-mono font-bold border border-slate-300 rounded-lg p-2 focus:outline-teal-500 uppercase"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">UPI ID for Invoice QR</label>
              <input
                type="text"
                value={formData.upiId}
                onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                placeholder="apexmedisales@upi"
                className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 focus:outline-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Default Terms &amp; Conditions (Printed on A4 Invoice)</label>
            <textarea
              rows={4}
              value={formData.termsConditions}
              onChange={(e) => setFormData({ ...formData, termsConditions: e.target.value })}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-teal-500 font-sans leading-relaxed"
            />
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              disabled={savingProfile}
              className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {savingProfile ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Business Profile
            </button>
          </div>
        </form>
      </div>

      {/* Account Security & Password Change */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-slate-700" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Account Credentials &amp; Password
          </h3>
        </div>

        <form onSubmit={handleChangePassword} className="p-6 space-y-4 text-xs max-w-lg">
          <div className="text-slate-600">
            Current Logged-in Operator: <strong>{currentUser.name}</strong> ({currentUser.email})
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Current Password *</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-teal-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">New Password *</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-teal-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Confirm New Password *</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-teal-500"
              />
            </div>
          </div>

          {passError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{passError}</span>
            </div>
          )}

          {passSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{passSuccess}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={changingPass}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {changingPass ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
};
