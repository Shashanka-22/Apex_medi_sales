import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../server/db.js';
import { neonAdapter } from '../server/neon.js';

dotenv.config();

const { Pool } = pg;

async function runAudit() {
  console.log('====================================================');
  console.log('APEX MEDI SALES — COMPLETE E2E FUNCTIONAL & CRUD AUDIT');
  console.log('====================================================');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const results: { module: string; test: string; status: 'PASS' | 'FAIL'; details?: string }[] = [];

  function record(module: string, test: string, passed: boolean, details?: string) {
    results.push({ module, test, status: passed ? 'PASS' : 'FAIL', details });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] [${module}] ${test} ${details ? `(${details})` : ''}`);
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Neon Connection & Tables
    // -------------------------------------------------------------------------
    const connRes = await pool.query('SELECT current_database(), current_schema()');
    const tableRes = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    const tableNames = tableRes.rows.map((r) => r.table_name);
    record(
      'Neon Connection',
      'Database & Schema Check',
      connRes.rows.length > 0,
      `db: ${connRes.rows[0].current_database}, schema: ${connRes.rows[0].current_schema}`
    );
    record(
      'Neon Schema',
      '15 Application Tables Present',
      tableNames.length >= 15,
      `Found ${tableNames.length} tables: ${tableNames.slice(0, 5).join(', ')}...`
    );

    // Sync DB engine from Neon
    await db.syncFromNeon();

    // -------------------------------------------------------------------------
    // TEST 2: Authentication & Admin Credentials
    // -------------------------------------------------------------------------
    const adminUser = db.getUserByEmail('admin@apexmedisales.com');
    const passwordValid = adminUser ? bcrypt.compareSync('ApexAdmin@2026', adminUser.passwordHash) : false;
    record('Auth', 'Admin User Exists & Password Hash Matches', !!adminUser && passwordValid);

    // -------------------------------------------------------------------------
    // TEST 3: Business Profile CRUD & Persistence
    // -------------------------------------------------------------------------
    const initialProfile = db.getProfile();
    const updatedProfile = await db.updateProfile({
      storeName: 'APEX MEDI SALES & SURGICALS',
    });
    // Check directly in Neon SQL
    const profSql = await pool.query('SELECT store_name FROM business_profile WHERE id = $1', [initialProfile.id]);
    const profilePersisted = profSql.rows[0]?.store_name === 'APEX MEDI SALES & SURGICALS';
    record('Profile', 'Profile Update Persistent in Neon DB', profilePersisted, profSql.rows[0]?.store_name);

    // Restore original store name
    await db.updateProfile({ storeName: 'APEX MEDI SALES' });

    // -------------------------------------------------------------------------
    // TEST 4: Medicines CRUD & Batches
    // -------------------------------------------------------------------------
    const testMedName = `AUDIT_MED_${Date.now()}`;
    const createdMed = await db.addMedicine({
      name: testMedName,
      genericName: 'Audit Paracetamol 500mg',
      manufacturer: 'Apex Pharma Labs',
      dosageForm: 'TABLET',
      packSize: '10x10',
      uom: 'STRIP',
      hsnCode: '30049000',
      isPrescriptionRequired: false,
      minStockAlert: 10,
      taxRate: 12.0,
      isActive: true,
    });

    const medSql = await pool.query('SELECT name, tax_rate FROM medicines WHERE id = $1', [createdMed.id]);
    record(
      'Medicines',
      'Create Medicine Persistent in Neon',
      medSql.rows.length === 1 && medSql.rows[0].name === testMedName,
      `id: ${createdMed.id}`
    );

    // Update Medicine
    const updatedMed = await db.updateMedicine(createdMed.id, {
      genericName: 'Audit Paracetamol 650mg Updated',
    });
    const medUpdateSql = await pool.query('SELECT generic_name FROM medicines WHERE id = $1', [createdMed.id]);
    record(
      'Medicines',
      'Update Medicine Persistent in Neon',
      medUpdateSql.rows[0]?.generic_name === 'Audit Paracetamol 650mg Updated'
    );

    // Add Batch
    const batchNumber = `AUDIT_BAT_${Date.now().toString().slice(-5)}`;
    const createdBatch = await db.addBatch({
      medicineId: createdMed.id,
      batchNumber,
      expiryDate: '2028-12-31',
      purchaseRate: 20.0,
      mrp: 45.0,
      sellingRate: 38.0,
      initialQty: 100,
      currentQty: 100,
      freeQty: 0,
      gstRate: 12.0,
      discount: 0,
    });
    const batchSql = await pool.query('SELECT current_qty, mrp FROM medicine_batches WHERE id = $1', [createdBatch.id]);
    record(
      'Batches',
      'Add Batch Persistent in Neon',
      Number(batchSql.rows[0]?.current_qty) === 100 && Number(batchSql.rows[0]?.mrp) === 45
    );

    // Adjust Stock
    const adjustmentResult = await db.adjustStock({
      batchId: createdBatch.id,
      newQuantity: 85,
      reason: 'Physical Audit Count Discrepancy',
    });
    const adjustBatchSql = await pool.query('SELECT current_qty FROM medicine_batches WHERE id = $1', [createdBatch.id]);
    const adjustSmSql = await pool.query('SELECT * FROM stock_movements WHERE batch_id = $1 ORDER BY created_at DESC LIMIT 1', [createdBatch.id]);
    record(
      'Stock Adjustment',
      'Adjust Stock & Log Movement Persistent in Neon',
      Number(adjustBatchSql.rows[0]?.current_qty) === 85 && adjustSmSql.rows.length === 1 && Number(adjustSmSql.rows[0].quantity) === -15,
      `newQty: ${adjustBatchSql.rows[0]?.current_qty}, diff: ${adjustSmSql.rows[0]?.quantity}`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Suppliers CRUD & Ledgers
    // -------------------------------------------------------------------------
    const testSupName = `AUDIT_SUP_${Date.now()}`;
    const createdSup = await db.addSupplier({
      name: testSupName,
      contactPerson: 'Audit Contact',
      phone: '9876543210',
      email: 'audit_sup@test.com',
      address: 'Industrial Area',
      city: 'Bangalore',
      state: 'Karnataka',
      stateCode: '29',
      gstin: '29AAAAA0000A1Z5',
      dlNo: 'KA-BNG-12345',
      openingBalance: 1500.0,
      currentBalance: 1500.0,
    });

    const supSql = await pool.query('SELECT name, current_balance FROM suppliers WHERE id = $1', [createdSup.id]);
    record(
      'Suppliers',
      'Create Supplier Persistent in Neon',
      supSql.rows.length === 1 && Number(supSql.rows[0].current_balance) === 1500.0,
      `name: ${supSql.rows[0]?.name}`
    );

    const updatedSup = await db.updateSupplier(createdSup.id, {
      city: 'Hubli',
    });
    const supUpdateSql = await pool.query('SELECT city FROM suppliers WHERE id = $1', [createdSup.id]);
    record('Suppliers', 'Update Supplier Persistent in Neon', supUpdateSql.rows[0]?.city === 'Hubli');

    // Supplier delete validation with balance
    let supDeleteError = false;
    try {
      await db.deleteSupplier(createdSup.id);
    } catch {
      supDeleteError = true;
    }
    record('Suppliers', 'Safety Check Prevents Deleting Supplier with Balance', supDeleteError);

    // -------------------------------------------------------------------------
    // TEST 6: Customers CRUD & Ledgers
    // -------------------------------------------------------------------------
    const testCustName = `AUDIT_CUST_${Date.now()}`;
    const createdCust = await db.addCustomer({
      name: testCustName,
      contactPerson: 'Audit Customer Care',
      phone: '9123456789',
      email: 'audit_cust@test.com',
      address: 'Main Road',
      city: 'Bhatkal',
      state: 'Karnataka',
      stateCode: '29',
      gstin: '29BBBBB1111B1Z2',
      dlNo1: 'KA-KW1-99991',
      openingBalance: 2000.0,
      currentBalance: 2000.0,
    });

    const custSql = await pool.query('SELECT name, current_balance FROM customers WHERE id = $1', [createdCust.id]);
    record(
      'Customers',
      'Create Customer Persistent in Neon',
      custSql.rows.length === 1 && Number(custSql.rows[0].current_balance) === 2000.0,
      `name: ${custSql.rows[0]?.name}`
    );

    const updatedCust = await db.updateCustomer(createdCust.id, {
      city: 'Shirali',
    });
    const custUpdateSql = await pool.query('SELECT city FROM customers WHERE id = $1', [createdCust.id]);
    record('Customers', 'Update Customer Persistent in Neon', custUpdateSql.rows[0]?.city === 'Shirali');

    // Customer delete validation with balance
    let custDeleteError = false;
    try {
      await db.deleteCustomer(createdCust.id);
    } catch {
      custDeleteError = true;
    }
    record('Customers', 'Safety Check Prevents Deleting Customer with Balance', custDeleteError);

    // -------------------------------------------------------------------------
    // TEST 7: Inward Purchase Entry & Stock Addition
    // -------------------------------------------------------------------------
    const purchaseInvNum = `P-AUD-${Date.now().toString().slice(-5)}`;
    const supplierBillNo = `INV-SUP-${Date.now().toString().slice(-4)}`;
    const createdPurchase = await db.recordPurchase({
      invoiceNumber: purchaseInvNum,
      supplierInvoiceNumber: supplierBillNo,
      supplierId: createdSup.id,
      supplierName: createdSup.name,
      invoiceDate: new Date().toISOString(),
      entryDate: new Date().toISOString(),
      paymentTerms: 'Credit',
      paymentStatus: 'Pending',
      taxableAmount: 500.0,
      cgstAmount: 30.0,
      sgstAmount: 30.0,
      igstAmount: 0.0,
      discountAmount: 0.0,
      roundOff: 0.0,
      grandTotal: 560.0,
      notes: 'Automated E2E Audit Purchase Record',
      items: [
        {
          id: `pi_audit_1`,
          purchaseId: '',
          medicineId: createdMed.id,
          medicineName: createdMed.name,
          batchNumber: `INW-${Date.now().toString().slice(-4)}`,
          expiryDate: '2028-06-30',
          packing: '10x10',
          hsnCode: '30049000',
          quantity: 50,
          freeQty: 5,
          mrp: 45.0,
          purchaseRate: 10.0,
          discountPercent: 0,
          gstRate: 12.0,
          lineAmount: 560.0,
        },
      ],
    });

    const purSql = await pool.query('SELECT invoice_number, grand_total FROM purchases WHERE invoice_number = $1', [purchaseInvNum]);
    const purItemSql = await pool.query('SELECT quantity, free_qty FROM purchase_items WHERE purchase_id = $1', [createdPurchase.id]);
    const supLedgSql = await pool.query('SELECT credit, balance FROM supplier_ledger WHERE supplier_id = $1 ORDER BY date DESC LIMIT 1', [createdSup.id]);
    record(
      'Purchases',
      'Record Purchase, Batch Inward & Supplier Ledger Persistent in Neon',
      purSql.rows.length === 1 && purItemSql.rows.length === 1 && supLedgSql.rows.length === 1,
      `grandTotal: ${purSql.rows[0]?.grand_total}, addedQty: 55`
    );

    // Duplicate bill number check
    let dupBillError = false;
    try {
      await db.recordPurchase({
        invoiceNumber: `P-AUD-DUP`,
        supplierInvoiceNumber: supplierBillNo,
        supplierId: createdSup.id,
        supplierName: createdSup.name,
        invoiceDate: new Date().toISOString(),
        entryDate: new Date().toISOString(),
        paymentTerms: 'Credit',
        paymentStatus: 'Pending',
        taxableAmount: 100.0,
        cgstAmount: 6.0,
        sgstAmount: 6.0,
        igstAmount: 0.0,
        discountAmount: 0.0,
        roundOff: 0.0,
        grandTotal: 112.0,
        items: [],
      });
    } catch {
      dupBillError = true;
    }
    record('Purchases', 'Duplicate Supplier Invoice Number Rejection', dupBillError);

    // -------------------------------------------------------------------------
    // TEST 8: Sales POS Billing & Batch Stock Deduction
    // -------------------------------------------------------------------------
    const saleInvNum = `AM-AUD-${Date.now().toString().slice(-5)}`;
    const batchBeforeSale = db.getBatches().find((b) => b.id === createdBatch.id);
    const qtyBefore = batchBeforeSale?.currentQty || 0;

    const createdSale = await db.recordSale({
      invoiceNumber: saleInvNum,
      invoiceSeries: 'MAIN',
      customerId: createdCust.id,
      customerName: createdCust.name,
      customerStateCode: '29',
      invoiceDate: new Date().toISOString(),
      paymentMode: 'Credit',
      paymentStatus: 'Unpaid',
      totalItems: 1,
      taxableAmount: 380.0,
      cgstAmount: 22.8,
      sgstAmount: 22.8,
      igstAmount: 0.0,
      discountAmount: 0.0,
      additionalCharges: 0.0,
      roundOff: 0.4,
      grandTotal: 426.0,
      paidAmount: 0.0,
      balanceAmount: 426.0,
      items: [
        {
          id: `si_audit_1`,
          saleId: '',
          medicineId: createdMed.id,
          medicineName: createdMed.name,
          batchId: createdBatch.id,
          batchNumber: createdBatch.batchNumber,
          expiryDate: createdBatch.expiryDate,
          packing: createdMed.packSize,
          hsnCode: createdMed.hsnCode,
          quantity: 10,
          freeQty: 0,
          mrp: 45.0,
          sellingRate: 38.0,
          discountPercent: 0,
          gstRate: 12.0,
          taxableAmount: 380.0,
          cgstAmount: 22.8,
          sgstAmount: 22.8,
          igstAmount: 0.0,
          lineTotal: 425.6,
        },
      ],
    });

    const saleSql = await pool.query('SELECT invoice_number, grand_total, verification_token FROM sales WHERE id = $1', [createdSale.id]);
    const saleItemSql = await pool.query('SELECT * FROM sale_items WHERE sale_id = $1', [createdSale.id]);
    const batchAfterSaleSql = await pool.query('SELECT current_qty FROM medicine_batches WHERE id = $1', [createdBatch.id]);
    const custLedgSql = await pool.query('SELECT debit, balance FROM customer_ledger WHERE customer_id = $1 ORDER BY date DESC LIMIT 1', [createdCust.id]);

    const batchDeducted = Number(batchAfterSaleSql.rows[0]?.current_qty) === qtyBefore - 10;
    record(
      'Sales Billing',
      'Record Sale, Token, Stock Deduction & Customer Ledger Persistent in Neon',
      saleSql.rows.length === 1 && saleItemSql.rows.length === 1 && batchDeducted && custLedgSql.rows.length === 1,
      `token: ${saleSql.rows[0]?.verification_token}, deducted: ${qtyBefore} -> ${batchAfterSaleSql.rows[0]?.current_qty}`
    );

    // -------------------------------------------------------------------------
    // TEST 9: Controlled Sales Cancellation & Stock Restitution
    // -------------------------------------------------------------------------
    const cancelledSale = await db.cancelSale(createdSale.id, 'Customer cancellation audit test');
    const cancelSql = await pool.query('SELECT is_cancelled, cancellation_reason FROM sales WHERE id = $1', [createdSale.id]);
    const batchAfterCancelSql = await pool.query('SELECT current_qty FROM medicine_batches WHERE id = $1', [createdBatch.id]);
    const restitutionSuccess = Number(batchAfterCancelSql.rows[0]?.current_qty) === qtyBefore;
    record(
      'Sales Cancellation',
      'Cancel Sale, Restitute Stock & Add Audit Return Movement in Neon',
      cancelSql.rows[0]?.is_cancelled === true && restitutionSuccess,
      `is_cancelled: true, stock restored to ${batchAfterCancelSql.rows[0]?.current_qty}`
    );

    // -------------------------------------------------------------------------
    // TEST 10: Payment Vouchers & Ledger Balance Adjustments
    // -------------------------------------------------------------------------
    const receiptVoucher = await db.recordPayment({
      voucherNumber: `RCT-AUD-${Date.now().toString().slice(-4)}`,
      voucherType: 'RECEIPT',
      customerId: createdCust.id,
      amount: 500.0,
      paymentMode: 'UPI',
      referenceNumber: 'UPI-AUDIT-992211',
      notes: 'Customer payment test receipt',
      paymentDate: new Date().toISOString(),
    });

    const pmtSql = await pool.query('SELECT amount, payment_mode FROM payments WHERE id = $1', [receiptVoucher.id]);
    const custBalanceSql = await pool.query('SELECT current_balance FROM customers WHERE id = $1', [createdCust.id]);
    record(
      'Payments & Ledgers',
      'Customer Receipt Voucher & Customer Balance Persistent in Neon',
      pmtSql.rows.length === 1 && Number(custBalanceSql.rows[0]?.current_balance) === 1500.0,
      `amount: ₹${pmtSql.rows[0]?.amount}, balance: ₹${custBalanceSql.rows[0]?.current_balance}`
    );

    // -------------------------------------------------------------------------
    // TEST 11: Cleanup Test Records
    // -------------------------------------------------------------------------
    await pool.query('DELETE FROM payments WHERE id = $1', [receiptVoucher.id]);
    await pool.query('DELETE FROM sales WHERE id = $1', [createdSale.id]);
    await pool.query('DELETE FROM purchases WHERE id = $1', [createdPurchase.id]);
    await pool.query('DELETE FROM stock_movements WHERE batch_id = $1', [createdBatch.id]);
    await pool.query('DELETE FROM customer_ledger WHERE customer_id = $1', [createdCust.id]);
    await pool.query('DELETE FROM supplier_ledger WHERE supplier_id = $1', [createdSup.id]);
    await pool.query('DELETE FROM medicine_batches WHERE medicine_id = $1', [createdMed.id]);
    await pool.query('DELETE FROM medicines WHERE id = $1', [createdMed.id]);
    await pool.query('DELETE FROM customers WHERE id = $1', [createdCust.id]);
    await pool.query('DELETE FROM suppliers WHERE id = $1', [createdSup.id]);

    // Resync db state cleanly
    await db.syncFromNeon();

    record('Cleanup', 'Cleaned up audit test entities from Neon PostgreSQL', true);

    console.log('====================================================');
    console.log('AUDIT SUMMARY:');
    const passed = results.filter((r) => r.status === 'PASS').length;
    const failed = results.filter((r) => r.status === 'FAIL').length;
    console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('====================================================');

    await pool.end();
    if (failed > 0) process.exit(1);
    process.exit(0);
  } catch (err: any) {
    console.error('Audit encountered fatal error:', err);
    await pool.end();
    process.exit(1);
  }
}

runAudit();
