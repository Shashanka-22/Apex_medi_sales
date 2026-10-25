import React, { useState } from 'react';
import { api, UserSession } from '../../lib/api';
import { Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles, Building2 } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: UserSession) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@apexmedisales.com');
  const [password, setPassword] = useState('ApexAdmin@2026');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.login(email, password);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('admin@apexmedisales.com');
    setPassword('ApexAdmin@2026');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-teal-900 to-slate-900 p-8 text-white text-center">
          <div className="w-14 h-14 bg-teal-600/30 border border-teal-400/40 rounded-2xl mx-auto flex items-center justify-center mb-3">
            <Building2 className="w-8 h-8 text-teal-300" />
          </div>
          <h1 className="text-xl font-black uppercase tracking-tight">
            Apex Medi Sales
          </h1>
          <p className="text-xs text-teal-200/80 mt-1 font-medium">
            Medical Billing &amp; Batch-wise Inventory ERP
          </p>
          <div className="inline-block mt-2 px-2.5 py-0.5 bg-white/10 rounded-full text-[10px] font-mono text-teal-300">
            DL: KA-KW1-299954 · Bhatkal
          </div>
        </div>

        {/* Form Container */}
        <div className="p-8 space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Sign in to Terminal</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter authorized administrator credentials to manage pharmacy operations.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Username / Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@apexmedisales.com"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-teal-600 focus:ring-2 focus:ring-teal-100 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                'Verifying Credentials...'
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Sign In to Billing Terminal
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Helper */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2">
            <div className="text-[11px] text-slate-600">
              Demo Admin: <span className="font-mono font-semibold">admin@apexmedisales.com</span>
            </div>
            <button
              type="button"
              onClick={handleFillDemo}
              className="px-3 py-1 bg-white hover:bg-slate-100 text-teal-800 border border-slate-300 rounded-lg text-[11px] font-bold shadow-2xs transition cursor-pointer"
            >
              Fill Demo Admin Credentials
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
