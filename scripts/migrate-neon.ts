import { neonAdapter } from '../server/neon.js';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  console.log('Connecting to Neon PostgreSQL...');
  const status = await neonAdapter.getStatus();
  console.log('Status:', status);

  if (!status.connected) {
    console.error('Cannot connect to Neon:', status.error);
    process.exit(1);
  }

  console.log('Creating database tables in Neon PostgreSQL...');
  const res = await neonAdapter.initializeTables();
  console.log('Created tables:', res.tablesCreated);

  console.log('Loading seed data...');
  const dbFile = path.resolve(process.cwd(), 'data', 'medical_store.db.json');
  let seedData: any = {};
  if (fs.existsSync(dbFile)) {
    seedData = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
  }

  console.log('Seeding initial data into Neon...');
  await neonAdapter.seedInitialData(seedData);

  const finalStatus = await neonAdapter.getStatus();
  console.log('Final Neon Database Tables Count:', finalStatus.tables.length);
  console.log('Final Tables List:', finalStatus.tables);
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
