import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api, Sale, BusinessProfile } from '../../lib/api';
import { InvoiceTemplate } from './InvoiceTemplate';
import { printInvoice, downloadInvoicePdf } from '../../lib/invoicePdfPrint';
import { Printer, Download, X, AlertCircle, Loader2, Check } from 'lucide-react';

interface InvoicePrintViewProps {
  sale: Sale;
  profile: BusinessProfile;
  onClose?: () => void;
}

export const InvoicePrintView: React.FC<InvoicePrintViewProps> = ({ sale, profile, onClose }) => {
  const [currentSale, setCurrentSale] = useState<Sale>(sale);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setCurrentSale(sale);
  }, [sale]);

  const isPaid = currentSale.paymentStatus === 'Paid';
  const configuredUpiId = (profile.upiId || '').trim();
  const hasUpi = Boolean(configuredUpiId);

  useEffect(() => {
    let isMounted = true;

    if (isPaid || !hasUpi) {
      setQrCodeUrl('');
      return;
    }

    const storeName = (profile.storeName || 'APEX MEDI SALES').trim();
    const grandTotalStr = currentSale.grandTotal.toFixed(2);
    const invoiceNo = (currentSale.invoiceNumber || '').trim();

    const upiPaymentUri = `upi://pay?pa=${encodeURIComponent(configuredUpiId)}&pn=${encodeURIComponent(storeName)}&am=${encodeURIComponent(grandTotalStr)}&cu=INR&tn=${encodeURIComponent(`Invoice ${invoiceNo}`)}&tr=${encodeURIComponent(invoiceNo)}`;

    QRCode.toDataURL(upiPaymentUri, {
      width: 160,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (isMounted) setQrCodeUrl(url);
      })
      .catch((err) => {
        console.error('Failed generating Payment QR code:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [profile.upiId, profile.storeName, currentSale.grandTotal, currentSale.invoiceNumber, isPaid, hasUpi]);

  const handleMarkAsPaid = async () => {
    setErrorMessage(null);
    setIsMarkingPaid(true);
    try {
      const updated = await api.markSaleAsPaid(currentSale.id, { paymentMode: currentSale.paymentMode });
      setCurrentSale(updated);
      setSuccessMessage(`Payment confirmed! Invoice #${updated.invoiceNumber} is now marked as PAID.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Mark as paid error:', err);
      setErrorMessage(err?.message || 'Failed to mark invoice as paid.');
    } finally {
      setIsMarkingPaid(false);
    }
  };

  const handlePrint = async () => {
    setErrorMessage(null);
    setIsPrinting(true);
    try {
      await printInvoice('invoice-printable-root');
    } catch (err: any) {
      console.error('Print error:', err);
      setErrorMessage(err?.message || 'Failed to initialize printer. Please try again.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadPdf = async () => {
    setErrorMessage(null);
    setIsDownloading(true);
    try {
      const fileName = `Invoice_${sale.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      await downloadInvoicePdf('invoice-printable-root', fileName);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err: any) {
      console.error('PDF generation error:', err);
      setErrorMessage(err?.message || 'Failed to generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="bg-slate-900/60 fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto backdrop-blur-xs">
      <div className="bg-white text-slate-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[96vh] flex flex-col border border-slate-200">
        {/* Top Control Bar (Hidden on print) */}
        <div className="p-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-slate-800">
              Tax Invoice Preview — {currentSale.invoiceNumber}
            </span>
            {currentSale.isCancelled ? (
              <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-medium">
                CANCELLED
              </span>
            ) : isPaid ? (
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-semibold border border-emerald-300">
                PAID
              </span>
            ) : (
              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold border border-amber-300">
                PAYMENT PENDING
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!currentSale.isCancelled && !isPaid && (
              <button
                onClick={handleMarkAsPaid}
                disabled={isMarkingPaid}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                title="Confirm customer payment and mark invoice as Paid"
              >
                {isMarkingPaid ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Mark as Paid
                  </>
                )}
              </button>
            )}

            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white rounded-lg text-xs font-medium transition cursor-pointer"
              title="Print standard A4 tax invoice"
            >
              {isPrinting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Preparing Print...
                </>
              ) : (
                <>
                  <Printer className="w-3.5 h-3.5" />
                  Print (A4)
                </>
              )}
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className={`flex items-center gap-1.5 px-3 py-1.5 ${
                downloadSuccess
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300'
              } text-white rounded-lg text-xs font-medium transition cursor-pointer`}
              title="Download high-fidelity A4 PDF invoice"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating PDF...
                </>
              ) : downloadSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Downloaded!
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  Download PDF
                </>
              )}
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200 transition cursor-pointer ml-1"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Success notification banner */}
        {successMessage && (
          <div className="mx-4 mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between print:hidden">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-500 hover:text-emerald-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Error notification banner */}
        {errorMessage && (
          <div className="mx-4 mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center justify-between print:hidden">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Printable & Visible Invoice Area: Single Source of Truth */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 font-sans text-xs bg-slate-100/50 print:p-0 print:m-0 print:bg-white">
          <InvoiceTemplate
            id="invoice-printable-root"
            sale={currentSale}
            profile={profile}
            paymentQrCodeUrl={qrCodeUrl}
          />
        </div>
      </div>
    </div>
  );
};
