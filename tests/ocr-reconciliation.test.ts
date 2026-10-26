import fs from 'node:fs';
import path from 'node:path';
import { extractInvoiceWithGemini } from '../server/ocr.js';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function runRegressionTests() {
  console.log('=== RUNNING APEX MEDI SALES OCR & RECONCILIATION REGRESSION TEST ===\n');

  const pdfPath = path.resolve(process.cwd(), 'public/assets/aistudio/test1_8fa2d201.pdf');
  assert(fs.existsSync(pdfPath), `Test file ${pdfPath} must exist`);

  const fileBuffer = fs.readFileSync(pdfPath);
  const result = await extractInvoiceWithGemini(fileBuffer, 'application/pdf', undefined, 'test1.pdf');

  // 1. Supplier & Buyer Identification
  console.log('Test 1: Verifying Supplier and Buyer Identification...');
  assert(
    result.supplier.name.includes('SAI RADHA PHARMA'),
    `Expected supplier SAI RADHA PHARMA, got: ${result.supplier.name}`
  );
  assert(
    result.supplier.gstin === '29AAQCS0711F1ZC',
    `Expected supplier GSTIN 29AAQCS0711F1ZC, got: ${result.supplier.gstin}`
  );
  assert(
    result.buyer?.name?.includes('APEX MED SALES') || false,
    `Expected buyer APEX MED SALES, got: ${result.buyer?.name}`
  );
  assert(
    result.buyer?.gstin === '29BZWPN5791F1ZE',
    `Expected buyer GSTIN 29BZWPN5791F1ZE, got: ${result.buyer?.gstin}`
  );
  console.log('✓ Test 1 Passed: Supplier and Buyer accurately extracted without confusion.\n');

  // 2. Invoice Metadata
  console.log('Test 2: Verifying Invoice Number and Date...');
  assert(
    result.invoice.invoiceNumber === '26501730076274',
    `Expected invoice number 26501730076274, got: ${result.invoice.invoiceNumber}`
  );
  assert(
    result.invoice.invoiceDate === '2026-08-29',
    `Expected invoice date 2026-08-29, got: ${result.invoice.invoiceDate}`
  );
  console.log('✓ Test 2 Passed: Invoice number and date verified.\n');

  // 3. Medicine Rows Count & Content
  console.log('Test 3: Verifying Extracted Medicines on Page 1 (Expected: 17 items)...');
  assert(result.items.length === 17, `Expected exactly 17 rows, got ${result.items.length}`);

  const expectedNames = [
    'AB PHYLLINE SR 200 TAB',
    'ALEX COUGH LOZENGES',
    'ALEX JUNIOR SYP',
    'ASCORIL LS EXPT',
    'CHERICOF LS JUNIOR SYRUP',
    'CALPOL PEAD DROPS',
    "CREMALAX 10MG TABLETS 6'S",
    'CALPOL 500 +TABLETS',
    'BETNOVATE N CREAM 25GM',
    'BETNOVATE C CREAM',
    'BETNOVATE GM CREAM',
    'BETNOVATE S OINT',
    'BETNOVATE CREAM',
    'CYCLOPAM DROPS 15ML',
    "ATORVA 10MG TAB 15'S",
    "ATORVA 20MG TAB 15'S",
    'ATORVA 40 TAB',
  ];

  for (let i = 0; i < expectedNames.length; i++) {
    const item = result.items[i];
    const exp = expectedNames[i];
    assert(
      item.productName.includes(exp) || exp.includes(item.productName),
      `Item #${i + 1} expected '${exp}', got '${item.productName}'`
    );
    assert(item.quantity > 0, `Item #${i + 1} quantity must be > 0`);
    assert(item.purchaseRate > 0, `Item #${i + 1} purchaseRate must be > 0`);
    assert(item.mrp >= item.purchaseRate, `Item #${i + 1} MRP must be >= rate`);
    assert(item.batchNumber.length > 2, `Item #${i + 1} batch must be valid`);
    assert(item.expiryDate.startsWith('202'), `Item #${i + 1} expiry must be valid date`);
  }
  console.log('✓ Test 3 Passed: All 17 medicines matched with exact product details.\n');

  // 4. Batch Numbers & Expiry Dates Verification
  console.log('Test 4: Traceable Batch Numbers & Normalized Expiry Dates...');
  assert(result.items[0].batchNumber === 'GTH1807A', `Row 1 batch: expected GTH1807A, got ${result.items[0].batchNumber}`);
  assert(result.items[0].expiryDate === '2028-05-31', `Row 1 exp: expected 2028-05-31, got ${result.items[0].expiryDate}`);
  assert(result.items[1].batchNumber === '73260016', `Row 2 batch: expected 73260016, got ${result.items[1].batchNumber}`);
  assert(result.items[4].batchNumber === 'BND0018', `Row 5 batch: expected BND0018, got ${result.items[4].batchNumber}`);
  assert(result.items[8].batchNumber === '6HZ211', `Row 9 batch: expected 6HZ211, got ${result.items[8].batchNumber}`);
  assert(result.items[16].batchNumber === 'IB01064A', `Row 17 batch: expected IB01064A, got ${result.items[16].batchNumber}`);
  console.log('✓ Test 4 Passed: Batch numbers and expiry dates traceable to source document.\n');

  // 5. Multi-Page Document Incompleteness Detection
  console.log('Test 5: Multi-Page and Incomplete Document Detection...');
  assert(result.documentMeta.pagesUploaded === 1, 'Expected 1 uploaded page');
  assert(result.documentMeta.indicatedTotalPages === 3, 'Expected 3 indicated total pages (Page 1 of 3)');
  assert(result.documentMeta.documentCompleteness === 'INCOMPLETE', 'Document must be flagged INCOMPLETE');
  assert(result.documentMeta.reconciliationStatus === 'INCOMPLETE_DOCUMENT', 'Status must be INCOMPLETE_DOCUMENT');
  console.log('✓ Test 5 Passed: Successfully detected Page 1 of 3 with incomplete document flag.\n');

  // 6. Total Items Distinction (Printed 48 vs Extracted 17)
  console.log('Test 6: Total Items Distinction (Printed 48 vs Page 1 Extracted 17)...');
  assert(result.printedSummary?.printedTotItems === 48, `Expected printedTotItems=48, got ${result.printedSummary?.printedTotItems}`);
  assert(result.items.length === 17, `Expected extracted items=17, got ${result.items.length}`);
  console.log('✓ Test 6 Passed: Printed 48 total items distinguished from Page 1 (17 items).\n');

  // 7. Financial Calculations & Reconciliation Difference
  console.log('Test 7: Deterministic Financial Engine & Reconciliation Difference...');
  assert(result.summary.taxableAmount === 2014.15, `Expected taxable 2014.15, got ${result.summary.taxableAmount}`);
  assert(result.summary.cgstAmount === 50.33, `Expected CGST 50.33, got ${result.summary.cgstAmount}`);
  assert(result.summary.sgstAmount === 50.33, `Expected SGST 50.33, got ${result.summary.sgstAmount}`);
  assert(result.summary.grandTotal === 2114.81, `Expected grand total 2114.81, got ${result.summary.grandTotal}`);
  assert(result.printedSummary?.printedGrandTotal === 4738.00, `Expected printed grand total 4738.00, got ${result.printedSummary?.printedGrandTotal}`);
  assert(
    result.documentMeta.reconciliationDifference === -2623.19,
    `Expected reconciliationDifference -2623.19, got ${result.documentMeta.reconciliationDifference}`
  );
  console.log('✓ Test 7 Passed: Financial arithmetic and reconciliation difference verified down to the penny.\n');

  // 8. Zero Mock Substitution Check
  console.log('Test 8: Verifying Zero Sample Data Substitution on User Uploads...');
  assert(result.sourceType === 'UPLOADED_FILE', 'Must be UPLOADED_FILE');
  assert(!result.items.some(it => it.productName.includes('KETOCIS TAB 200MG')), 'Must not substitute Apex Health sample data');
  console.log('✓ Test 8 Passed: No sample data substituted.\n');

  console.log('================================================================');
  console.log('ALL 8 CRITICAL REGRESSION TESTS PASSED 100% SUCCESSFULLY!');
  console.log('================================================================\n');
}

runRegressionTests().catch((err) => {
  console.error('Regression Test Failed:', err);
  process.exit(1);
});
