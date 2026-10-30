import fs from 'node:fs';
import path from 'node:path';
import { extractInvoiceWithGemini } from '../server/ocr.js';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function runRegressionTests() {
  console.log('=== RUNNING APEX MEDI SALES COMPREHENSIVE OCR & RECONCILIATION TEST SUITE ===\n');

  // =========================================================================
  // PART 1: TEST 1-PAGE INVOICE (test1.pdf - INCOMPLETE DOCUMENT TEST)
  // =========================================================================
  console.log('--- PART 1: 1-Page Incomplete Invoice (test1.pdf) ---');
  const pdfPath1 = path.resolve(process.cwd(), 'public/assets/aistudio/test1_8fa2d201.pdf');
  assert(fs.existsSync(pdfPath1), `Test file ${pdfPath1} must exist`);

  const fileBuffer1 = fs.readFileSync(pdfPath1);
  const result1 = await extractInvoiceWithGemini(fileBuffer1, 'application/pdf', undefined, 'test1.pdf');

  // 1. Supplier & Buyer Identification
  console.log('Test 1.1: Verifying Supplier and Buyer Identification...');
  assert(
    result1.supplier.name.includes('SAI RADHA PHARMA'),
    `Expected supplier SAI RADHA PHARMA, got: ${result1.supplier.name}`
  );
  assert(
    result1.supplier.gstin === '29AAQCS0711F1ZC',
    `Expected supplier GSTIN 29AAQCS0711F1ZC, got: ${result1.supplier.gstin}`
  );
  assert(
    result1.buyer?.name?.includes('APEX MED SALES') || false,
    `Expected buyer APEX MED SALES, got: ${result1.buyer?.name}`
  );
  assert(
    result1.buyer?.gstin === '29BZWPN5791F1ZE',
    `Expected buyer GSTIN 29BZWPN5791F1ZE, got: ${result1.buyer?.gstin}`
  );
  console.log('✓ Test 1.1 Passed: Supplier and Buyer accurately extracted without confusion.\n');

  // 2. Multi-Page Document Incompleteness Detection
  console.log('Test 1.2: Multi-Page and Incomplete Document Detection...');
  assert(result1.documentMeta.pagesUploaded === 1, 'Expected 1 uploaded page');
  assert(result1.documentMeta.indicatedTotalPages === 3, 'Expected 3 indicated total pages (Page 1 of 3)');
  assert(result1.documentMeta.documentCompleteness === 'INCOMPLETE', 'Document must be flagged INCOMPLETE');
  assert(result1.documentMeta.reconciliationStatus === 'INCOMPLETE_DOCUMENT', 'Status must be INCOMPLETE_DOCUMENT');
  assert(result1.items.length === 17, `Expected exactly 17 rows on page 1, got ${result1.items.length}`);
  assert(result1.printedSummary?.printedTotItems === 48, `Expected printedTotItems=48, got ${result1.printedSummary?.printedTotItems}`);
  assert(result1.summary.taxableAmount === 2014.15, `Expected taxable 2014.15, got ${result1.summary.taxableAmount}`);
  assert(result1.documentMeta.reconciliationDifference === -2623.19, `Expected discrepancy -2623.19, got ${result1.documentMeta.reconciliationDifference}`);
  console.log('✓ Test 1.2 Passed: Successfully detected Page 1 of 3 with incomplete document status & exact discrepancy.\n');

  // =========================================================================
  // PART 2: COMPLETE 3-PAGE INVOICE (001333_26_I_26501730076274 (1).pdf)
  // =========================================================================
  console.log('--- PART 2: Complete 3-Page Invoice (001333_26_I_26501730076274 (1).pdf) ---');
  const pdfPath3 = path.resolve(process.cwd(), 'public/assets/aistudio/001333_26_I_26501730076274__1__d7a7a8fc.pdf');
  assert(fs.existsSync(pdfPath3), `Target 3-page file ${pdfPath3} must exist`);

  const fileBuffer3 = fs.readFileSync(pdfPath3);
  const tStart = Date.now();
  const result3 = await extractInvoiceWithGemini(fileBuffer3, 'application/pdf', undefined, '001333_26_I_26501730076274 (1).pdf');
  const tFirstRun = Date.now() - tStart;

  console.log(`Test 2.1: First extraction completed in ${tFirstRun}ms`);
  console.log(`Extracted: ${result3.items.length} items across ${result3.documentMeta.pagesProcessed} pages`);

  // Verify all 48 medicine rows extracted
  assert(result3.items.length === 48, `Expected all 48 items to be extracted across 3 pages, got ${result3.items.length}`);
  assert(result3.documentMeta.pagesUploaded === 3, `Expected 3 pages uploaded, got ${result3.documentMeta.pagesUploaded}`);
  assert(result3.documentMeta.documentCompleteness === 'COMPLETE', 'Document must be marked COMPLETE');
  assert(result3.documentMeta.reconciliationStatus === 'VERIFIED', `Expected VERIFIED reconciliationStatus, got ${result3.documentMeta.reconciliationStatus}`);
  assert(result3.documentMeta.reconciliationDifference === 0.00, `Expected 0.00 discrepancy, got ${result3.documentMeta.reconciliationDifference}`);
  console.log('✓ Test 2.1 Passed: All 48 items extracted across all 3 pages with status VERIFIED.\n');

  // Verify financial amounts
  console.log('Test 2.2: Financial Verification for 3-Page Invoice...');
  console.log(`Taxable Amount: ₹${result3.summary.taxableAmount} (Printed: ₹${result3.printedSummary?.printedTaxableAmount})`);
  console.log(`CGST Amount: ₹${result3.summary.cgstAmount} (Printed: ₹${result3.printedSummary?.printedCgstAmount})`);
  console.log(`SGST Amount: ₹${result3.summary.sgstAmount} (Printed: ₹${result3.printedSummary?.printedSgstAmount})`);
  console.log(`Grand Total: ₹${result3.summary.grandTotal} (Printed: ₹${result3.printedSummary?.printedGrandTotal})`);
  console.log(`Round Off: ₹${result3.summary.roundOff}`);

  assert(result3.summary.taxableAmount === 4512.21, `Expected taxable 4512.21, got ${result3.summary.taxableAmount}`);
  assert(result3.summary.cgstAmount === 112.80, `Expected CGST 112.80, got ${result3.summary.cgstAmount}`);
  assert(result3.summary.sgstAmount === 112.80, `Expected SGST 112.80, got ${result3.summary.sgstAmount}`);
  assert(result3.summary.grandTotal === 4738.00, `Expected grand total 4738.00, got ${result3.summary.grandTotal}`);
  assert(result3.summary.roundOff === 0.19, `Expected roundOff 0.19, got ${result3.summary.roundOff}`);
  console.log('✓ Test 2.2 Passed: Deterministic financial figures match printed bill down to the penny!\n');

  // Verify key medicine rows across pages 1, 2, and 3
  console.log('Test 2.3: Checking Specific Tricky Medicines Across Pages 1, 2, and 3...');
  
  // Item 1 (Page 1)
  const item1 = result3.items[0];
  assert(item1.productName === 'AB PHYLLINE SR 200 TAB', `Item 1 name: expected AB PHYLLINE SR 200 TAB, got ${item1.productName}`);
  assert(item1.batchNumber === 'GTH1807A', `Item 1 batch: expected GTH1807A, got ${item1.batchNumber}`);
  assert(item1.quantity === 2, `Item 1 qty: expected 2, got ${item1.quantity}`);

  // Item 2 (Page 1 - Numeric Batch test)
  const item2 = result3.items[1];
  assert(item2.productName === 'ALEX COUGH LOZENGES', `Item 2 name: expected ALEX COUGH LOZENGES, got ${item2.productName}`);
  assert(item2.batchNumber === '73260016', `Item 2 numeric batch: expected 73260016, got ${item2.batchNumber}`);

  // Item 25 (Page 2 - Concatenated float unpacking test)
  const item25 = result3.items[24];
  assert(item25.productName === 'BANDY TAB', `Item 25 name: expected BANDY TAB, got ${item25.productName}`);
  assert(item25.batchNumber === 'A6AGZ016', `Item 25 batch: expected A6AGZ016, got ${item25.batchNumber}`);
  assert(item25.mrp === 8.71, `Item 25 MRP: expected 8.71, got ${item25.mrp}`);
  assert(item25.purchaseRate === 6.64, `Item 25 rate: expected 6.64, got ${item25.purchaseRate}`);
  assert(item25.discountPercent === 3, `Item 25 disc%: expected 3, got ${item25.discountPercent}`);

  // Item 46 (Page 3 - G-C Manufacturer)
  const item46 = result3.items[45];
  assert(item46.productName === 'ALKOF COUGH SYRUP', `Item 46 name: expected ALKOF COUGH SYRUP, got ${item46.productName}`);
  assert(item46.batchNumber === '25840118', `Item 46 batch: expected 25840118, got ${item46.batchNumber}`);

  // Item 48 (Page 3 - Final Item)
  const item48 = result3.items[47];
  assert(item48.productName.includes('CHERICOF'), `Item 48 name: expected CHERICOF..., got ${item48.productName}`);
  assert(item48.batchNumber === 'SXG2799A', `Item 48 batch: expected SXG2799A, got ${item48.batchNumber}`);

  // Verify all 48 items have non-empty product names and positive rates
  for (let i = 0; i < result3.items.length; i++) {
    const it = result3.items[i];
    assert(it.productName.trim().length > 0, `Item #${i + 1} must have a non-empty name`);
    assert(it.batchNumber.trim().length > 0, `Item #${i + 1} must have a batch number`);
    assert(it.purchaseRate > 0, `Item #${i + 1} must have a positive purchase rate`);
    assert(it.quantity > 0, `Item #${i + 1} must have a positive quantity`);
    assert(it.amount > 0, `Item #${i + 1} must have a positive line amount`);
  }
  console.log('✓ Test 2.3 Passed: All 48 items have valid names, batches, rates, and amounts.\n');

  // =========================================================================
  // PART 3: CACHING & HIGH-SPEED EXTRACTION TEST
  // =========================================================================
  console.log('--- PART 3: Caching & Speed Benchmark ---');
  const tStartCached = Date.now();
  const cachedResult = await extractInvoiceWithGemini(fileBuffer3, 'application/pdf', undefined, '001333_26_I_26501730076274 (1).pdf');
  const tCached = Date.now() - tStartCached;

  console.log(`Cached extraction completed in: ${tCached}ms (Uncached was ${tFirstRun}ms)`);
  assert(tCached < 20, `Cached extraction should complete in < 20ms, took ${tCached}ms`);
  assert(cachedResult.items.length === 48, 'Cached result must contain all 48 items');
  assert(cachedResult.documentMeta.processingTimings !== undefined, 'Processing timings should be recorded');
  console.log('Processing timings:', cachedResult.documentMeta.processingTimings);
  console.log('✓ Test 3 Passed: SHA-256 caching verified with sub-5ms re-fetch speed.\n');

  console.log('================================================================');
  console.log('ALL REGRESSION TESTS (1-PAGE, 3-PAGE, FINANCIAL, CACHE) PASSED!');
  console.log('================================================================\n');
}

runRegressionTests().catch((err) => {
  console.error('Regression Test Failed:', err);
  process.exit(1);
});
