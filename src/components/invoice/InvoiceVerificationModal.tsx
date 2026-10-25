import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { ShieldCheck, AlertTriangle, CheckCircle2, X } from 'lucide-react';

interface InvoiceVerificationModalProps {
  token: string;
  onClose: () => void;
}

export const InvoiceVerificationModal: React.FC<InvoiceVerificationModalProps> = ({ token, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    api.verifyInvoice(token)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Invoice verification failed');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
        <div className="p-4 bg-teal-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-300" />
            <h3 className="font-semibold text-sm">Invoice Verification System</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-teal-700 rounded-lg text-white/80 hover:text-white transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 text-sm">
          {loading && (
            <div className="py-8 text-center text-slate-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-2"></div>
              Verifying invoice security token with server...
            </div>
          )}

          {error && (
            <div className="py-6 text-center">
              <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-2" />
              <div className="text-base font-bold text-slate-900 mb-1">Verification Failed</div>
              <div className="text-xs text-rose-600">{error}</div>
            </div>
          )}

          {data && (
            <div className="space-y-4">
              <div className={`p-3 rounded-lg border ${data.isCancelled ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'} flex items-start gap-3`}>
                {data.isCancelled ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className={`font-bold ${data.isCancelled ? 'text-amber-900' : 'text-emerald-900'}`}>
                    {data.isCancelled ? 'Invoice Was Cancelled' : 'Authentic Tax Invoice'}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">{data.message}</div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-3 space-y-2 text-xs bg-slate-50">
                <div className="flex justify-between">
                  <span className="text-slate-500">Invoice Number:</span>
                  <span className="font-mono font-bold text-slate-900">{data.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Issuing Firm:</span>
                  <span className="font-semibold text-slate-900">{data.storeName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">GSTIN:</span>
                  <span className="font-mono text-slate-700">{data.storeGstin}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-semibold text-slate-900">{data.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date:</span>
                  <span>{new Date(data.invoiceDate).toLocaleDateString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Items Billed:</span>
                  <span>{data.itemsCount} lines</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="text-slate-700 font-semibold">Total Amount:</span>
                  <span className="text-base font-bold text-teal-800 font-mono">₹{data.grandTotal?.toFixed(2)}</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 text-center">
                This verification was cryptographically verified against the persistent database records of Apex Medi Sales.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
