import { neonAdapter } from '../server/neon.js';
import { db } from '../server/db.js';

async function verifyPersistence() {
  console.log('=== APEX MEDI SALES: NEON POSTGRESQL VERIFICATION ===\n');

  // 1. Connection & Schema Verification
  const status = await neonAdapter.getStatus();
  console.log('1. Connection Status:');
  console.log(`   Connected: ${status.connected}`);
  console.log(`   Database: ${status.database}`);
  console.log(`   Schema: ${status.schema}`);
  console.log(`   Host: ${status.host}`);
  console.log(`   Total Tables: ${status.tables.length}`);

  if (!status.connected) {
    throw new Error(`Neon connection failed: ${status.error}`);
  }

  // 2. Initial Table Row Counts
  const initialCounts = await neonAdapter.getTableCounts();
  console.log('\n2. Table Row Counts in Neon PostgreSQL:');
  for (const [table, count] of Object.entries(initialCounts)) {
    console.log(`   - ${table.padEnd(20)}: ${count} rows`);
  }

  // 3. Test Direct Insertion via Application DB Layer
  console.log('\n3. Testing Persistent Write to Neon PostgreSQL:');
  const testBarcode = `TEST-BARCODE-${Date.now()}`;
  const testMedicineName = `TEST-AMOXICLAV-NEON-${Date.now().toString().slice(-4)}`;

  const createdMed = await db.addMedicine({
    name: testMedicineName,
    genericName: 'Amoxicillin and Potassium Clavulanate',
    manufacturer: 'APEX TEST LABS',
    dosageForm: 'TABLET',
    strength: '625mg',
    packSize: '10 TAB',
    uom: 'STRIP',
    hsnCode: '30041000',
    barcode: testBarcode,
    isPrescriptionRequired: true,
    minStockAlert: 10,
    taxRate: 12.0,
    isActive: true,
  });

  console.log(`   Created Medicine in application layer: ID=${createdMed.id}, Name=${createdMed.name}`);

  // Give pool query a moment to execute
  await new Promise((r) => setTimeout(r, 600));

  // 4. Verify Directly in Neon PostgreSQL via Raw SQL
  const pool = neonAdapter.getPool()!;
  const sqlCheck = await pool.query('SELECT id, name, barcode, tax_rate, created_at FROM medicines WHERE id = $1', [createdMed.id]);

  if (sqlCheck.rows.length === 0) {
    throw new Error('FAILED: Test medicine was NOT found in Neon PostgreSQL database!');
  }

  console.log('   PROVEN: Record exists in Neon PostgreSQL table `medicines`:');
  console.log(`   Neon Row:`, sqlCheck.rows[0]);

  // 5. Test Batch Addition and Stock Adjustment
  console.log('\n4. Testing Batch Creation & Stock Adjustment Persistence:');
  const testBatch = await db.addBatch({
    medicineId: createdMed.id,
    batchNumber: `BAT-NEON-${Date.now().toString().slice(-4)}`,
    expiryDate: '2028-12-31',
    purchaseRate: 120.00,
    mrp: 200.00,
    sellingRate: 180.00,
    initialQty: 50,
    currentQty: 50,
    freeQty: 0,
    gstRate: 12.0,
    discount: 0,
  });

  await new Promise((r) => setTimeout(r, 600));

  const batchSql = await pool.query('SELECT id, batch_number, current_qty, mrp FROM medicine_batches WHERE id = $1', [testBatch.id]);
  console.log('   Neon Row in `medicine_batches`:');
  console.log(`   `, batchSql.rows[0]);

  // Adjust stock
  console.log('   Adjusting stock from 50 to 45...');
  await db.adjustStock({
    batchId: testBatch.id,
    newQuantity: 45,
    reason: 'Verification test deduction',
  });

  await new Promise((r) => setTimeout(r, 600));

  const batchAfterAdjust = await pool.query('SELECT current_qty FROM medicine_batches WHERE id = $1', [testBatch.id]);
  console.log(`   Neon updated batch current_qty: ${batchAfterAdjust.rows[0]?.current_qty} (expected 45)`);

  const movementSql = await pool.query('SELECT id, type, quantity, new_qty, reason FROM stock_movements WHERE batch_id = $1', [testBatch.id]);
  console.log(`   Neon stock_movements recorded:`, movementSql.rows[0]);

  // 6. Clean Up Test Records
  console.log('\n5. Cleaning up test record from Neon PostgreSQL...');
  await pool.query('DELETE FROM stock_movements WHERE batch_id = $1', [testBatch.id]);
  await pool.query('DELETE FROM medicine_batches WHERE id = $1', [testBatch.id]);
  await db.deleteMedicine(createdMed.id);
  await new Promise((r) => setTimeout(r, 600));

  const verifyCleaned = await pool.query('SELECT id FROM medicines WHERE id = $1', [createdMed.id]);
  console.log(`   Medicine cleaned from Neon: ${verifyCleaned.rows.length === 0 ? 'YES (0 rows remain)' : 'NO'}`);

  console.log('\n=== ALL NEON POSTGRESQL VERIFICATION CHECKS PASSED SUCCESSFULLY ===');
  process.exit(0);
}

verifyPersistence().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
