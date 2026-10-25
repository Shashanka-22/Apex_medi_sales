/**
 * Centralized Indian GST and Financial Calculation Engine
 * Currency: Indian Rupees (INR, ₹)
 * Locale: en-IN
 */

export interface TaxLineInput {
  quantity: number;
  rate: number;
  mrp?: number;
  discountPercent?: number; // e.g. 5 for 5%
  discountAmount?: number;
  gstRate: number; // 0, 5, 12, 18, 28
  freeQty?: number;
}

export interface TaxLineResult {
  grossAmount: number;
  discountAmount: number;
  taxableAmount: number;
  gstRate: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalGst: number;
  lineTotal: number;
}

export interface InvoiceTotalsResult {
  totalQuantity: number;
  totalFreeQuantity: number;
  grossAmount: number;
  itemDiscountTotal: number;
  billDiscountTotal: number;
  totalDiscount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  additionalCharges: number;
  subTotal: number;
  roundOff: number;
  grandTotal: number;
  grandTotalWords: string;
  taxBreakdown: {
    rate: number;
    baseValue: number;
    discount: number;
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
  }[];
}

/**
 * Rounds to 2 decimal places using standard financial half-up rounding
 */
export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates a single line item's taxes and amounts
 */
export function calculateLineTax(
  input: TaxLineInput,
  isInterState = false
): TaxLineResult {
  const qty = Math.max(0, Number(input.quantity) || 0);
  const rate = Math.max(0, Number(input.rate) || 0);
  const gstRate = Math.max(0, Number(input.gstRate) || 0);

  const grossAmount = round2(qty * rate);

  let discountAmount = 0;
  if (input.discountPercent && input.discountPercent > 0) {
    discountAmount = round2((grossAmount * input.discountPercent) / 100);
  } else if (input.discountAmount && input.discountAmount > 0) {
    discountAmount = round2(Math.min(grossAmount, input.discountAmount));
  }

  const taxableAmount = round2(Math.max(0, grossAmount - discountAmount));
  const totalGst = round2((taxableAmount * gstRate) / 100);

  let cgstRate = 0;
  let sgstRate = 0;
  let igstRate = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isInterState) {
    igstRate = gstRate;
    igstAmount = totalGst;
  } else {
    cgstRate = gstRate / 2;
    sgstRate = gstRate / 2;
    cgstAmount = round2(totalGst / 2);
    sgstAmount = round2(totalGst - cgstAmount); // Avoid half-cent discrepancy
  }

  const lineTotal = round2(taxableAmount + totalGst);

  return {
    grossAmount,
    discountAmount,
    taxableAmount,
    gstRate,
    cgstRate,
    sgstRate,
    igstRate,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalGst,
    lineTotal,
  };
}

/**
 * Calculates comprehensive invoice totals and the GST tax breakdown matrix
 */
export function calculateInvoiceTotals(
  items: (TaxLineInput & { freeQty?: number })[],
  options: {
    isInterState?: boolean;
    billDiscount?: number;
    additionalCharges?: number;
    roundOffPreference?: boolean;
  } = {}
): InvoiceTotalsResult {
  const isInterState = !!options.isInterState;
  const billDiscount = Math.max(0, Number(options.billDiscount) || 0);
  const additionalCharges = Math.max(0, Number(options.additionalCharges) || 0);
  const roundOffPref = options.roundOffPreference !== false;

  let totalQuantity = 0;
  let totalFreeQuantity = 0;
  let grossAmount = 0;
  let itemDiscountTotal = 0;
  let taxableAmount = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  // Breakdown map for standard Indian GST slabs: 0%, 5%, 12%, 18%, 28%
  const slabs = [0, 5, 12, 18, 28];
  const slabMap = new Map<number, { baseValue: number; discount: number; taxable: number; cgst: number; sgst: number; igst: number; total: number }>();
  slabs.forEach((rate) => {
    slabMap.set(rate, { baseValue: 0, discount: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });
  });

  for (const item of items) {
    totalQuantity += Number(item.quantity) || 0;
    totalFreeQuantity += Number(item.freeQty) || 0;

    const line = calculateLineTax(item, isInterState);
    grossAmount = round2(grossAmount + line.grossAmount);
    itemDiscountTotal = round2(itemDiscountTotal + line.discountAmount);
    taxableAmount = round2(taxableAmount + line.taxableAmount);
    cgstAmount = round2(cgstAmount + line.cgstAmount);
    sgstAmount = round2(sgstAmount + line.sgstAmount);
    igstAmount = round2(igstAmount + line.igstAmount);

    // Update tax slab map
    const rateKey = Number(line.gstRate);
    if (!slabMap.has(rateKey)) {
      slabMap.set(rateKey, { baseValue: 0, discount: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });
    }
    const slab = slabMap.get(rateKey)!;
    slab.baseValue = round2(slab.baseValue + line.grossAmount);
    slab.discount = round2(slab.discount + line.discountAmount);
    slab.taxable = round2(slab.taxable + line.taxableAmount);
    slab.cgst = round2(slab.cgst + line.cgstAmount);
    slab.sgst = round2(slab.sgst + line.sgstAmount);
    slab.igst = round2(slab.igst + line.igstAmount);
    slab.total = round2(slab.taxable + slab.cgst + slab.sgst + slab.igst);
  }

  const totalDiscount = round2(itemDiscountTotal + billDiscount);
  const totalTax = round2(cgstAmount + sgstAmount + igstAmount);
  const subTotal = round2(taxableAmount - billDiscount + totalTax + additionalCharges);

  let roundOff = 0;
  let grandTotal = subTotal;

  if (roundOffPref) {
    grandTotal = Math.round(subTotal);
    roundOff = round2(grandTotal - subTotal);
  }

  const taxBreakdown = Array.from(slabMap.entries())
    .map(([rate, vals]) => ({ rate, ...vals }))
    .sort((a, b) => a.rate - b.rate);

  return {
    totalQuantity,
    totalFreeQuantity,
    grossAmount,
    itemDiscountTotal,
    billDiscountTotal: billDiscount,
    totalDiscount,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalTax,
    additionalCharges,
    subTotal,
    roundOff,
    grandTotal,
    grandTotalWords: numberToIndianWords(grandTotal),
    taxBreakdown,
  };
}

/**
 * Converts numbers to Indian currency words format
 * E.g. 472 -> "Rupees Four Hundred Seventy-Two Only"
 * E.g. 27575 -> "Rupees Twenty-Seven Thousand Five Hundred Seventy-Five Only"
 */
export function numberToIndianWords(amount: number): string {
  if (amount === 0) return 'Rupees Zero Only';

  const absAmount = Math.abs(amount);
  const integerPart = Math.floor(absAmount);
  const paisePart = Math.round((absAmount - integerPart) * 100);

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];

  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  function convertTwoDigits(n: number): string {
    if (n < 20) return ones[n];
    const t = tens[Math.floor(n / 10)];
    const o = ones[n % 10];
    return o ? `${t}-${o}` : t;
  }

  function convertThreeDigits(n: number): string {
    const h = Math.floor(n / 100);
    const r = n % 100;
    let res = '';
    if (h > 0) {
      res += `${ones[h]} Hundred`;
      if (r > 0) res += ' ';
    }
    if (r > 0) {
      res += convertTwoDigits(r);
    }
    return res;
  }

  let crore = Math.floor(integerPart / 10000000);
  let remainder = integerPart % 10000000;
  let lakh = Math.floor(remainder / 100000);
  remainder = remainder % 100000;
  let thousand = Math.floor(remainder / 1000);
  let rest = remainder % 1000;

  const parts: string[] = [];

  if (crore > 0) {
    parts.push(`${convertThreeDigits(crore)} Crore`);
  }
  if (lakh > 0) {
    parts.push(`${convertThreeDigits(lakh)} Lakh`);
  }
  if (thousand > 0) {
    parts.push(`${convertThreeDigits(thousand)} Thousand`);
  }
  if (rest > 0) {
    parts.push(convertThreeDigits(rest));
  }

  let words = `Rupees ${parts.join(' ')}`.trim();

  if (paisePart > 0) {
    words += ` and ${convertTwoDigits(paisePart)} Paise`;
  }

  words += ' Only';
  return words;
}
