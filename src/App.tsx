import React, { useState, useEffect } from 'react';
import { api, UserSession, BusinessProfile, Sale } from './lib/api';
import { LoginView } from './components/auth/LoginView';
import { DashboardView } from './components/dashboard/DashboardView';
import { BillingView } from './components/billing/BillingView';
import { UploadInvoiceView } from './components/ocr/UploadInvoiceView';
import { InventoryView } from './components/inventory/InventoryView';
import { StockAlertsView } from './components/alerts/StockAlertsView';
import { PartiesView } from './components/parties/PartiesView';
import { SalesView } from './components/sales/SalesView';
import { PurchasesView } from './components/purchases/PurchasesView';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';
import { InvoicePrintView } from './components/invoice/InvoicePrintView';
import { InvoiceVerificationModal } from './components/invoice/InvoiceVerificationModal';

import {
  LayoutDashboard, ShoppingCart, FileText, Sparkles, Package,
  AlertTriangle, Users, History, Settings, LogOut, Menu, X,
  Building2, ShieldCheck, Printer, RefreshCw
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Active view tab
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Active Printable Invoice Modal
  const [activePrintInvoice, setActivePrintInvoice] = useState<Sale | null>(null);

  // Verification Token from URL query or path
  const [verificationToken, setVerificationToken] = useState<string | null>(null);

  useEffect(() => {
    // Check if URL has verification token /verify-invoice/:token
    const path = window.location.pathname;
    const match = path.match(/\/verify-invoice\/([^/]+)/);
    if (match && match[1]) {
      setVerificationToken(match[1]);
    }

    // Check user session
    const initApp = async () => {
      try {
        const prof = await api.getProfile();
        setProfile(prof);

        if (api.getToken()) {
          const user = await api.getCurrentUser();
          setCurrentUser(user);
        }
      } catch (err) {
        console.warn('Initial session check:', err);
      } finally {
        setLoading(false);
      }
    };

    initApp();
  }, []);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not trigger if typing in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        setActiveTab('billing');
      } else if (e.key === 'F3') {
        e.preventDefault();
        setActiveTab('upload-invoice');
      } else if (e.key === 'F4') {
        e.preventDefault();
        setActiveTab('sales');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = () => {
    api.setToken(null);
    setCurrentUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 animate-spin text-teal-400 mx-auto mb-3" />
          <div className="text-sm font-semibold tracking-wide">Initializing Apex Medi Sales ERP...</div>
        </div>
      </div>
    );
  }

  // If user is not logged in, show Login Screen
  if (!currentUser) {
    return (
      <>
        {verificationToken && (
          <InvoiceVerificationModal
            token={verificationToken}
            onClose={() => setVerificationToken(null)}
          />
        )}
        <LoginView onLoginSuccess={(user) => setCurrentUser(user)} />
      </>
    );
  }

  const defaultProfile: BusinessProfile = profile || {
    id: 'biz_001',
    storeName: 'APEX MEDI SALES',
    ownerName: 'Shashank Naik',
    address: 'DOOR NO.-VI/143, ALVEKODI SHIRALI ROAD, BHATKAL, SHIRALI',
    city: 'UTTARA KANNADA',
    state: 'Karnataka',
    stateCode: '29',
    pincode: '581354',
    phone: '9113917343',
    email: 'apexmedisales@gmail.com',
    gstin: '29BZWWPN5791F1ZE',
    dlNo1: 'KA-KW1-299954',
    dlNo2: 'KA-KW1-299955 & KA-KW1-299956',
    invoicePrefix: 'AM',
    invoiceFooter: 'Thank you for your business.',
    termsConditions: '',
    bankName: 'SBI',
    accountNo: '38492019482',
    ifscCode: 'SBIN0004128',
    upiId: 'apexmedisales@upi',
    roundOffPreference: true,
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'billing', label: 'Billing POS (F2)', icon: ShoppingCart, highlight: true },
    { id: 'sales', label: 'Sales Invoices (F4)', icon: FileText },
    { id: 'upload-invoice', label: 'AI Bill Import (F3)', icon: Sparkles, badge: 'Vision OCR' },
    { id: 'purchases', label: 'Purchases Register', icon: Package },
    { id: 'inventory', label: 'Medicines & Batches', icon: Package },
    { id: 'alerts', label: 'Stock & Expiry Alerts', icon: AlertTriangle },
    { id: 'parties', label: 'Parties & Ledgers', icon: Users },
    { id: 'reports', label: 'GST & Reports', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col antialiased text-slate-900 font-sans">
      {/* Top Navigation Bar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
              <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center font-bold text-white shadow-2xs">
                A
              </div>
              <div>
                <span className="font-extrabold text-sm tracking-tight text-white block leading-none">
                  {defaultProfile.storeName}
                </span>
                <span className="text-[10px] text-teal-300 font-medium">
                  GST: {defaultProfile.gstin}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('billing')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              New Sale (F2)
            </button>

            <div className="hidden lg:flex items-center text-xs text-slate-300 gap-2 border-l border-slate-800 pl-3">
              <span>DL: <strong className="font-mono text-white">{defaultProfile.dlNo1}</strong></span>
            </div>

            <div className="flex items-center gap-2 pl-2">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-white leading-none">{currentUser.name}</div>
                <div className="text-[10px] text-slate-400 font-medium">Administrator</div>
              </div>
              <button
                onClick={handleLogout}
                title="Log Out"
                className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 flex gap-6">
        {/* Desktop Sidebar Navigation */}
        <aside className="w-56 hidden md:block shrink-0">
          <nav className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-xs sticky top-20 space-y-1 text-xs font-medium">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition cursor-pointer ${
                    isActive
                      ? 'bg-teal-700 text-white font-bold shadow-xs'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-teal-200' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                        isActive ? 'bg-teal-800 text-teal-100' : 'bg-teal-50 text-teal-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden bg-slate-900/60 backdrop-blur-xs flex">
            <div className="bg-white w-64 max-w-xs h-full p-4 space-y-2 shadow-2xl flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                  <span className="font-bold text-sm text-slate-900">{defaultProfile.storeName}</span>
                  <button onClick={() => setMobileMenuOpen(false)} className="text-slate-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        isActive
                          ? 'bg-teal-700 text-white'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 font-mono">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-slate-200">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-semibold transition"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
            <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 pb-16">
          {activeTab === 'dashboard' && (
            <DashboardView
              profile={defaultProfile}
              onNavigate={(tab) => setActiveTab(tab)}
              onViewInvoice={(sale) => setActivePrintInvoice(sale)}
            />
          )}

          {activeTab === 'billing' && (
            <BillingView
              profile={defaultProfile}
              onInvoiceCreated={(sale) => {
                setActivePrintInvoice(sale);
              }}
            />
          )}

          {activeTab === 'upload-invoice' && (
            <UploadInvoiceView
              onPurchaseConfirmed={() => setActiveTab('purchases')}
              onNavigateToInventory={() => setActiveTab('inventory')}
              onNavigateToPurchases={() => setActiveTab('purchases')}
            />
          )}

          {activeTab === 'sales' && (
            <SalesView onViewInvoice={(sale) => setActivePrintInvoice(sale)} />
          )}

          {activeTab === 'purchases' && (
            <PurchasesView onNavigateToUpload={() => setActiveTab('upload-invoice')} />
          )}

          {activeTab === 'inventory' && (
            <InventoryView onNavigateToUpload={() => setActiveTab('upload-invoice')} />
          )}

          {activeTab === 'alerts' && <StockAlertsView />}

          {activeTab === 'parties' && <PartiesView />}

          {activeTab === 'reports' && <ReportsView />}

          {activeTab === 'settings' && (
            <SettingsView
              profile={defaultProfile}
              currentUser={currentUser}
              onProfileUpdated={(up) => setProfile(up)}
            />
          )}
        </main>
      </div>

      {/* Printable Invoice Modal */}
      {activePrintInvoice && (
        <InvoicePrintView
          sale={activePrintInvoice}
          profile={defaultProfile}
          onClose={() => setActivePrintInvoice(null)}
        />
      )}

      {/* Invoice Public Verification Modal */}
      {verificationToken && (
        <InvoiceVerificationModal
          token={verificationToken}
          onClose={() => setVerificationToken(null)}
        />
      )}
    </div>
  );
}
