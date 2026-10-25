import { calculateLineTax, calculateInvoiceTotals, numberToIndianWords, round2 } from '../src/lib/tax.js';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('Running Apex Medi Sales Financial & Tax Calculations Unit Tests...');

// 1. Line Tax: Intra-State 5% GST on single item
{
  const res = calculateLineTax({
    quantity: 1,
    rate: 260.00,
    mrp: 1299.00,
    gstRate: 5.0,
  }, false);

  assert(res.grossAmount === 260.00, 'Gross amount should be 260.00');
  assert(res.taxableAmount === 260.00, 'Taxable amount should be 260.00');
  assert(res.cgstAmount === 6.50, `CGST should be 6.50, got ${res.cgstAmount}`);
  assert(res.sgstAmount === 6.50, `SGST should be 6.50, got ${res.sgstAmount}`);
  assert(res.igstAmount === 0.0, 'IGST should be 0.0 for intra-state');
  assert(res.lineTotal === 273.00, `Line total should be 273.00, got ${res.lineTotal}`);
  console.log('✓ Test 1: Intra-State 5% GST Passed');
}

// 2. Line Tax: Free Quantity does NOT increase taxable amount
{
  const res = calculateLineTax({
    quantity: 10,
    freeQty: 2, // 10 + 2 scheme
    rate: 50.00,
    gstRate: 12.0,
  }, false);

  assert(res.grossAmount === 500.00, 'Gross amount should only bill 10 units');
  assert(res.taxableAmount === 500.00, 'Taxable amount should not include free items');
  assert(res.cgstAmount === 30.00, `CGST should be 30.00, got ${res.cgstAmount}`);
  assert(res.sgstAmount === 30.00, `SGST should be 30.00, got ${res.sgstAmount}`);
  console.log('✓ Test 2: Free Quantity Handling Passed');
}

// 3. Line Tax: Inter-State IGST Calculation
{
  const res = calculateLineTax({
    quantity: 24,
    rate: 41.00,
    mrp: 186.00,
    gstRate: 5.0,
  }, true);

  assert(res.grossAmount === 984.00, `Gross amount should be 984.00, got ${res.grossAmount}`);
  assert(res.cgstAmount === 0.0, 'CGST should be 0 for inter-state');
  assert(res.sgstAmount === 0.0, 'SGST should be 0 for inter-state');
  assert(res.igstAmount === 49.20, `IGST should be 49.20, got ${res.igstAmount}`);
  assert(res.lineTotal === 1033.20, `Line total should match screenshot 1033.20, got ${res.lineTotal}`);
  console.log('✓ Test 3: Inter-State IGST Passed');
}

// 4. Invoice Totals & Round-Off Matrix: Exact match to physical invoice AM-00001
{
  const items = [
    { quantity: 1, rate: 260.00, gstRate: 5.0 }, // KETOCIS TAB
    { quantity: 1, rate: 190.00, gstRate: 5.0 }, // OMSYS 20 CAP
  ];

  const totals = calculateInvoiceTotals(items, {
    isInterState: false,
    roundOffPreference: true,
  });

  assert(totals.grossAmount === 450.00, `Gross amount should be 450.00, got ${totals.grossAmount}`);
  assert(totals.taxableAmount === 450.00, `Taxable amount should be 450.00, got ${totals.taxableAmount}`);
  assert(totals.cgstAmount === 11.25, `CGST should be 11.25, got ${totals.cgstAmount}`);
  assert(totals.sgstAmount === 11.25, `SGST should be 11.25, got ${totals.sgstAmount}`);
  assert(round2(totals.subTotal + totals.roundOff) === totals.grandTotal, 'subTotal + roundOff must equal grandTotal');
  assert(totals.grandTotal === Math.round(totals.subTotal), 'grandTotal should be integer rounded');
  console.log('✓ Test 4: Physical Invoice AM-00001 Round-Off Passed');
}

// 5. Number to Indian Currency Words
{
  assert(
    numberToIndianWords(472) === 'Rupees Four Hundred Seventy-Two Only',
    `Expected 'Rupees Four Hundred Seventy-Two Only', got '${numberToIndianWords(472)}'`
  );
  assert(
    numberToIndianWords(27575) === 'Rupees Twenty-Seven Thousand Five Hundred Seventy-Five Only',
    `Expected 'Rupees Twenty-Seven Thousand Five Hundred Seventy-Five Only', got '${numberToIndianWords(27575)}'`
  );
  console.log('✓ Test 5: Number to Indian Currency Words Passed');
}

console.log('\nAll 5 Critical Financial & GST Unit Tests Passed Successfully!\n');
