import React from 'react';
import { Sale, BusinessProfile } from '../../lib/api';
import { numberToIndianWords } from '../../lib/tax';

export interface InvoiceTemplateProps {
  sale: Sale;
  profile: BusinessProfile;
  qrCodeUrl?: string;
  copyLabel?: string;
  id?: string;
  className?: string;
}

export const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({
  sale,
  profile,
  qrCodeUrl,
  copyLabel = 'Original / Duplicate',
  id = 'invoice-printable-root',
  className = '',
}) => {
  const invoiceDateStr = new Date(sale.invoiceDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const verifyUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/verify-invoice/${sale.verificationToken}`;

  // Tax Matrix breakdown across 0%, 5%, 12%, 18%, 28% slabs
  const taxSlabs = [0, 5, 12, 18, 28];
  const slabStats = taxSlabs.map((rate) => {
    const itemsForRate = sale.items.filter((item) => Number(item.gstRate) === rate);
    const baseValue = itemsForRate.reduce((acc, item) => acc + item.quantity * item.sellingRate, 0);
    const discount = itemsForRate.reduce((acc, item) => acc + (item.quantity * item.sellingRate * (item.discountPercent || 0)) / 100, 0);
    const taxable = itemsForRate.reduce((acc, item) => acc + item.taxableAmount, 0);
    const taxSum = itemsForRate.reduce((acc, item) => acc + item.cgstAmount + item.sgstAmount + item.igstAmount, 0);
    const total = taxable + taxSum;
    return {
      rate,
      baseValue: Math.round(baseValue * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      taxable: Math.round(taxable * 100) / 100,
      taxSum: Math.round(taxSum * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  });

  return (
    <div
      id={id}
      className={`invoice-container bg-white text-slate-900 border border-slate-400 p-4 sm:p-6 w-full max-w-[210mm] mx-auto shadow-xs font-sans text-xs box-border ${className}`}
      style={{ minWidth: '190mm', backgroundColor: '#ffffff' }}
    >
      {/* Header */}
      <div className="flex justify-between items-start border-b border-slate-400 pb-3">
        <div className="text-left w-24">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
            {copyLabel}
          </span>
        </div>
        <div className="text-center flex-1 px-2">
          <span className="text-xs font-bold tracking-widest text-slate-700 block uppercase">
            TAX INVOICE
          </span>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 uppercase mt-0.5">
            {profile.storeName || 'APEX MEDI SALES'}
          </h1>
          <p className="text-[11px] text-slate-700 font-medium leading-tight mt-1 max-w-lg mx-auto">
            {profile.address}, {profile.city}, {profile.state} - {profile.pincode}
          </p>
          <p className="text-[11px] text-slate-600 mt-0.5">
            Phone : <span className="font-semibold text-slate-900">{profile.phone}</span> · Email : {profile.email}
          </p>
          <p className="text-[11px] font-semibold text-slate-900 mt-1">
            GST No. : <span className="font-mono">{profile.gstin}</span>
            {profile.foodLic && ` · Food Lic : ${profile.foodLic}`}
          </p>
          <p className="text-[10px] text-slate-700 font-medium">
            D.L.NO.: {profile.dlNo1} &amp; {profile.dlNo2}
          </p>
        </div>
        <div className="w-24 text-right">
          <span className="text-[10px] border border-slate-400 px-1.5 py-0.5 rounded font-mono uppercase font-semibold">
            HSN 3004
          </span>
        </div>
      </div>

      {/* Bill To & Invoice Meta Box */}
      <div className="grid grid-cols-12 border-b border-slate-400 py-2.5 text-[11px] leading-snug">
        {/* Customer Column */}
        <div className="col-span-7 pr-3 border-r border-slate-300">
          <div className="text-slate-500 font-medium text-[10px] uppercase tracking-wide">
            Customer / Buyer:
          </div>
          <div className="font-bold text-sm text-slate-950 mt-0.5">
            {sale.customerName}
          </div>
          {sale.customerAddress && (
            <div className="text-slate-700 mt-0.5">{sale.customerAddress}</div>
          )}
          <div className="flex items-center gap-4 mt-1">
            <span>STATE : <strong className="text-slate-900">Karnataka</strong></span>
            <span>CODE : <strong className="font-mono text-slate-900">{sale.customerStateCode || '29'}</strong></span>
          </div>
          {sale.customerGstin && (
            <div className="mt-0.5">
              GSTIN : <strong className="font-mono">{sale.customerGstin}</strong>
            </div>
          )}
        </div>

        {/* Invoice Meta Column */}
        <div className="col-span-5 pl-4 space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-600">Inv. No. :</span>
            <span className="font-bold font-mono text-slate-950 text-xs">{sale.invoiceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Date :</span>
            <span className="font-medium">{invoiceDateStr}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Payment Mode :</span>
            <span className="font-semibold text-slate-900 uppercase">{sale.paymentMode}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Payment Status :</span>
            <span className={`font-semibold ${sale.paymentStatus === 'Paid' ? 'text-emerald-700' : 'text-amber-700'}`}>
              {sale.paymentStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Itemized Medicine Table */}
      <div className="overflow-x-auto my-2">
        <table className="invoice-table w-full text-left border-collapse border-b border-slate-400 text-[11px]">
          <thead>
            <tr className="border-b border-slate-400 bg-slate-50 font-semibold text-slate-800">
              <th className="py-1.5 px-1.5 text-center w-8 border-r border-slate-300">Sno</th>
              <th className="py-1.5 px-2 border-r border-slate-300">Product Name</th>
              <th className="py-1.5 px-1.5 text-center border-r border-slate-300">Pack</th>
              <th className="py-1.5 px-1.5 text-center border-r border-slate-300">HSN</th>
              <th className="py-1.5 px-1.5 text-center border-r border-slate-300">Batch No.</th>
              <th className="py-1.5 px-1.5 text-center border-r border-slate-300">Exp</th>
              <th className="py-1.5 px-1.5 text-right border-r border-slate-300">Qty.</th>
              <th className="py-1.5 px-1.5 text-right border-r border-slate-300">Free</th>
              <th className="py-1.5 px-1.5 text-right border-r border-slate-300">M.R.P.</th>
              <th className="py-1.5 px-1.5 text-right border-r border-slate-300">Rate</th>
              <th className="py-1.5 px-1.5 text-right border-r border-slate-300">Dis%</th>
              <th className="py-1.5 px-1.5 text-center border-r border-slate-300">G%</th>
              <th className="py-1.5 px-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sale.items.map((item, idx) => (
              <tr key={item.id || idx} className="hover:bg-slate-50/50" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                <td className="py-1.5 px-1.5 text-center text-slate-500 border-r border-slate-200">{idx + 1}</td>
                <td className="py-1.5 px-2 font-medium text-slate-900 border-r border-slate-200">
                  {item.medicineName}
                </td>
                <td className="py-1.5 px-1.5 text-center text-slate-600 border-r border-slate-200">{item.packing || '-'}</td>
                <td className="py-1.5 px-1.5 text-center font-mono text-slate-600 border-r border-slate-200">{item.hsnCode || '3004'}</td>
                <td className="py-1.5 px-1.5 text-center font-mono font-medium text-slate-800 border-r border-slate-200">{item.batchNumber}</td>
                <td className="py-1.5 px-1.5 text-center font-mono text-slate-600 border-r border-slate-200">{item.expiryDate.substring(0, 7)}</td>
                <td className="py-1.5 px-1.5 text-right font-semibold text-slate-950 border-r border-slate-200">{item.quantity}</td>
                <td className="py-1.5 px-1.5 text-right text-slate-500 border-r border-slate-200">{item.freeQty || 0}</td>
                <td className="py-1.5 px-1.5 text-right font-mono text-slate-700 border-r border-slate-200">{item.mrp.toFixed(2)}</td>
                <td className="py-1.5 px-1.5 text-right font-mono text-slate-900 border-r border-slate-200">{item.sellingRate.toFixed(2)}</td>
                <td className="py-1.5 px-1.5 text-right font-mono text-slate-600 border-r border-slate-200">{item.discountPercent || 0}</td>
                <td className="py-1.5 px-1.5 text-center font-mono text-slate-700 border-r border-slate-200">{item.gstRate}</td>
                <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-950">{item.lineTotal.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tax Matrix & Summary Totals Box */}
      <div className="grid grid-cols-12 gap-3 pt-2 border-b border-slate-400 pb-3" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        {/* Left Column: GST Breakdown Matrix */}
        <div className="col-span-7">
          <div className="text-[10px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
            GST Tax Analysis
          </div>
          <table className="w-full text-[10px] border border-slate-300 border-collapse text-right">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-semibold">
                <th className="p-1 text-left border-r border-slate-300">Rate</th>
                <th className="p-1 border-r border-slate-300">Base Val</th>
                <th className="p-1 border-r border-slate-300">Disc.</th>
                <th className="p-1 border-r border-slate-300">Taxable</th>
                <th className="p-1 border-r border-slate-300">GST Sum</th>
                <th className="p-1">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {slabStats.map((slab) => (
                <tr key={slab.rate} className={slab.taxable > 0 ? 'bg-teal-50/40 font-medium' : 'text-slate-400'}>
                  <td className="p-1 text-left font-sans text-slate-700 border-r border-slate-200">
                    {slab.rate}%
                  </td>
                  <td className="p-1 border-r border-slate-200">{slab.baseValue.toFixed(2)}</td>
                  <td className="p-1 border-r border-slate-200">{slab.discount.toFixed(2)}</td>
                  <td className="p-1 border-r border-slate-200 font-semibold text-slate-900">{slab.taxable.toFixed(2)}</td>
                  <td className="p-1 border-r border-slate-200">{slab.taxSum.toFixed(2)}</td>
                  <td className="p-1 font-semibold text-slate-900">{slab.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right Column: Invoice Totals & Summary */}
        <div className="col-span-5 pl-2 space-y-1 text-[11px] font-mono">
          <div className="flex justify-between text-slate-700">
            <span>TAXABLE AMOUNT:</span>
            <span className="font-semibold text-slate-900">₹{sale.taxableAmount.toFixed(2)}</span>
          </div>
          {sale.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>LESS DISCOUNT:</span>
              <span>-₹{sale.discountAmount.toFixed(2)}</span>
            </div>
          )}
          {sale.cgstAmount > 0 && (
            <div className="flex justify-between text-slate-700">
              <span>ADD CGST:</span>
              <span>₹{sale.cgstAmount.toFixed(2)}</span>
            </div>
          )}
          {sale.sgstAmount > 0 && (
            <div className="flex justify-between text-slate-700">
              <span>ADD SGST:</span>
              <span>₹{sale.sgstAmount.toFixed(2)}</span>
            </div>
          )}
          {sale.igstAmount > 0 && (
            <div className="flex justify-between text-slate-700">
              <span>ADD IGST:</span>
              <span>₹{sale.igstAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-600">
            <span>ROUND OFF:</span>
            <span>{sale.roundOff >= 0 ? `+${sale.roundOff.toFixed(2)}` : sale.roundOff.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-sm font-bold text-slate-950 border-t border-slate-400 pt-1 mt-1">
            <span>GRAND TOTAL:</span>
            <span className="text-base text-teal-900 font-extrabold">₹{sale.grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Rupees In Words */}
      <div className="py-2 text-[11px] border-b border-slate-300" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <span className="font-semibold text-slate-700">Amount in Words: </span>
        <span className="font-bold text-slate-900">{numberToIndianWords(sale.grandTotal)}</span>
      </div>

      {/* Footer with Terms, QR Code & Signatory */}
      <div className="grid grid-cols-12 gap-3 pt-3 items-end" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        {/* Terms & Conditions */}
        <div className="col-span-7">
          <div className="text-[10px] font-bold text-slate-800 uppercase tracking-wide mb-1">
            Terms &amp; Conditions :
          </div>
          <div className="text-[9px] text-slate-600 leading-tight whitespace-pre-line font-sans">
            {profile.termsConditions || `1. Goods once sold will not be taken back or Exchange.
2. Kindly make Payment within 30 days otherwise interest @30 % p.a. will be charged.
3. We are not responsible for any breakage, shortage, leakage or damage complaints once goods leave premises.
4. All disputes subject to BHATKAL Jurisdiction only. E.& O. E.`}
          </div>
        </div>

        {/* QR Code with Verification Link */}
        <div className="col-span-2 text-center flex flex-col items-center">
          {qrCodeUrl ? (
            <a
              href={verifyUrl}
              target="_blank"
              rel="noreferrer"
              className="group block p-1 bg-white border border-slate-300 rounded shadow-2xs hover:border-teal-600 transition"
              title="Click to view online verification"
            >
              <img src={qrCodeUrl} alt="Verify Invoice QR" className="w-16 h-16 object-contain" />
              <span className="text-[8px] text-slate-500 group-hover:text-teal-700 block mt-0.5 font-medium">
                Scan to Verify
              </span>
            </a>
          ) : (
            <div className="w-16 h-16 bg-slate-100 border border-slate-200 rounded flex items-center justify-center text-[9px] text-slate-400">
              QR
            </div>
          )}
        </div>

        {/* Signatory Area */}
        <div className="col-span-3 text-right">
          <div className="text-[11px] font-bold text-slate-900">
            For {profile.storeName || 'APEX MEDI SALES'}
          </div>
          <div className="h-10"></div>
          <div className="text-[10px] text-slate-600 border-t border-slate-400 pt-1 inline-block min-w-[120px] text-center">
            Authorized Signatory
          </div>
        </div>
      </div>

      {/* ERP Attribution Footnote */}
      <div className="text-[9px] text-slate-400 text-center border-t border-slate-200 mt-3 pt-1" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        Apex Medi Sales ERP · Ph: 9113917343 · System Verified GST Invoice
      </div>
    </div>
  );
};
