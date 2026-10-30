import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config();

const { Pool } = pg;

export interface NeonDbStatus {
  connected: boolean;
  database?: string;
  schema?: string;
  host?: string;
  tables: string[];
  error?: string;
}

export class NeonDatabaseAdapter {
  private pool: pg.Pool | null = null;
  private isInitialized = false;

  constructor() {
    this.initPool();
  }

  private initPool() {
    const connStr = process.env.DATABASE_URL;
    if (!connStr || connStr.includes('ep-sample')) {
      return;
    }
    try {
      this.pool = new Pool({
        connectionString: connStr,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
    } catch (err: any) {
      console.error('Failed to initialize Neon connection pool:', err.message);
    }
  }

  public isAvailable(): boolean {
    return !!this.pool;
  }

  public getPool(): pg.Pool | null {
    return this.pool;
  }

  public async getStatus(): Promise<NeonDbStatus> {
    if (!this.pool) {
      return {
        connected: false,
        tables: [],
        error: 'DATABASE_URL not configured or using placeholder',
      };
    }

    try {
      const dbRes = await this.pool.query('SELECT current_database(), current_schema()');
      const tableRes = await this.pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);

      const host = new URL(process.env.DATABASE_URL!).host;

      return {
        connected: true,
        database: dbRes.rows[0]?.current_database,
        schema: dbRes.rows[0]?.current_schema,
        host,
        tables: tableRes.rows.map((r) => r.table_name),
      };
    } catch (err: any) {
      return {
        connected: false,
        tables: [],
        error: err.message,
      };
    }
  }

  public async initializeTables(): Promise<{ tablesCreated: string[] }> {
    if (!this.pool) throw new Error('No PostgreSQL connection pool available');

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Users
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role VARCHAR(32) NOT NULL DEFAULT 'ADMIN',
          must_change_password BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 2. Business Profile
      await client.query(`
        CREATE TABLE IF NOT EXISTS business_profile (
          id VARCHAR(64) PRIMARY KEY,
          store_name VARCHAR(255) NOT NULL DEFAULT 'APEX MEDI SALES',
          owner_name VARCHAR(255) DEFAULT 'Apex Administrator',
          address TEXT,
          city VARCHAR(100),
          state VARCHAR(100) DEFAULT 'Karnataka',
          state_code VARCHAR(10) DEFAULT '29',
          pincode VARCHAR(20),
          phone VARCHAR(50),
          email VARCHAR(255),
          gstin VARCHAR(50),
          dl_no1 VARCHAR(100),
          dl_no2 VARCHAR(100),
          food_lic VARCHAR(100),
          invoice_prefix VARCHAR(10) DEFAULT 'AM',
          invoice_footer TEXT,
          terms_conditions TEXT,
          bank_name VARCHAR(100),
          account_no VARCHAR(100),
          ifsc_code VARCHAR(50),
          upi_id VARCHAR(100),
          round_off_preference BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 3. Medicines Master
      await client.query(`
        CREATE TABLE IF NOT EXISTS medicines (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          generic_name VARCHAR(255),
          manufacturer VARCHAR(255),
          dosage_form VARCHAR(50) DEFAULT 'SYRUP',
          strength VARCHAR(50),
          pack_size VARCHAR(50) DEFAULT '1',
          uom VARCHAR(50) DEFAULT 'BOTTLE',
          hsn_code VARCHAR(50) DEFAULT '30049000',
          barcode VARCHAR(100) UNIQUE,
          is_prescription_required BOOLEAN DEFAULT FALSE,
          min_stock_alert INTEGER DEFAULT 20,
          tax_rate NUMERIC(5, 2) DEFAULT 5.0,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 4. Medicine Batches
      await client.query(`
        CREATE TABLE IF NOT EXISTS medicine_batches (
          id VARCHAR(64) PRIMARY KEY,
          medicine_id VARCHAR(64) NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
          batch_number VARCHAR(100) NOT NULL,
          mfg_date DATE,
          expiry_date DATE NOT NULL,
          purchase_rate NUMERIC(10, 2) NOT NULL,
          mrp NUMERIC(10, 2) NOT NULL,
          selling_rate NUMERIC(10, 2) NOT NULL,
          initial_qty INTEGER DEFAULT 0,
          current_qty INTEGER DEFAULT 0,
          free_qty INTEGER DEFAULT 0,
          supplier_id VARCHAR(64),
          purchase_invoice_ref VARCHAR(100),
          gst_rate NUMERIC(5, 2) DEFAULT 5.0,
          discount NUMERIC(5, 2) DEFAULT 0.0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(medicine_id, batch_number)
        );
      `);

      // 5. Suppliers
      await client.query(`
        CREATE TABLE IF NOT EXISTS suppliers (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          contact_person VARCHAR(255),
          address TEXT,
          city VARCHAR(100),
          state VARCHAR(100) DEFAULT 'Karnataka',
          state_code VARCHAR(10) DEFAULT '29',
          phone VARCHAR(50),
          email VARCHAR(255),
          gstin VARCHAR(50),
          dl_no VARCHAR(100),
          opening_balance NUMERIC(12, 2) DEFAULT 0.0,
          current_balance NUMERIC(12, 2) DEFAULT 0.0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 6. Customers
      await client.query(`
        CREATE TABLE IF NOT EXISTS customers (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          contact_person VARCHAR(255),
          address TEXT,
          city VARCHAR(100),
          state VARCHAR(100) DEFAULT 'Karnataka',
          state_code VARCHAR(10) DEFAULT '29',
          phone VARCHAR(50),
          email VARCHAR(255),
          gstin VARCHAR(50),
          dl_no1 VARCHAR(100),
          dl_no2 VARCHAR(100),
          opening_balance NUMERIC(12, 2) DEFAULT 0.0,
          current_balance NUMERIC(12, 2) DEFAULT 0.0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 7. Purchases
      await client.query(`
        CREATE TABLE IF NOT EXISTS purchases (
          id VARCHAR(64) PRIMARY KEY,
          invoice_number VARCHAR(100) UNIQUE NOT NULL,
          supplier_invoice_number VARCHAR(100) NOT NULL,
          supplier_id VARCHAR(64) NOT NULL,
          supplier_name VARCHAR(255),
          invoice_date TIMESTAMPTZ NOT NULL,
          entry_date TIMESTAMPTZ DEFAULT NOW(),
          payment_terms VARCHAR(50) DEFAULT 'Credit',
          payment_status VARCHAR(50) DEFAULT 'Pending',
          taxable_amount NUMERIC(12, 2) NOT NULL,
          cgst_amount NUMERIC(10, 2) DEFAULT 0.0,
          sgst_amount NUMERIC(10, 2) DEFAULT 0.0,
          igst_amount NUMERIC(10, 2) DEFAULT 0.0,
          discount_amount NUMERIC(10, 2) DEFAULT 0.0,
          round_off NUMERIC(6, 2) DEFAULT 0.0,
          grand_total NUMERIC(12, 2) NOT NULL,
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 8. Purchase Items
      await client.query(`
        CREATE TABLE IF NOT EXISTS purchase_items (
          id VARCHAR(64) PRIMARY KEY,
          purchase_id VARCHAR(64) NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
          medicine_id VARCHAR(64) NOT NULL,
          medicine_name VARCHAR(255),
          batch_number VARCHAR(100) NOT NULL,
          expiry_date DATE NOT NULL,
          packing VARCHAR(50),
          hsn_code VARCHAR(50),
          quantity INTEGER NOT NULL,
          free_qty INTEGER DEFAULT 0,
          mrp NUMERIC(10, 2) NOT NULL,
          purchase_rate NUMERIC(10, 2) NOT NULL,
          discount_percent NUMERIC(5, 2) DEFAULT 0.0,
          gst_rate NUMERIC(5, 2) DEFAULT 5.0,
          line_amount NUMERIC(12, 2) NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 9. Sales
      await client.query(`
        CREATE TABLE IF NOT EXISTS sales (
          id VARCHAR(64) PRIMARY KEY,
          invoice_number VARCHAR(100) UNIQUE NOT NULL,
          invoice_series VARCHAR(50) DEFAULT 'MAIN',
          customer_id VARCHAR(64),
          customer_name VARCHAR(255) NOT NULL,
          customer_address TEXT,
          customer_gstin VARCHAR(50),
          customer_state_code VARCHAR(10) DEFAULT '29',
          invoice_date TIMESTAMPTZ DEFAULT NOW(),
          payment_mode VARCHAR(50) DEFAULT 'Cash',
          payment_status VARCHAR(50) DEFAULT 'Paid',
          total_items INTEGER DEFAULT 0,
          taxable_amount NUMERIC(12, 2) NOT NULL,
          cgst_amount NUMERIC(10, 2) DEFAULT 0.0,
          sgst_amount NUMERIC(10, 2) DEFAULT 0.0,
          igst_amount NUMERIC(10, 2) DEFAULT 0.0,
          discount_amount NUMERIC(10, 2) DEFAULT 0.0,
          additional_charges NUMERIC(10, 2) DEFAULT 0.0,
          round_off NUMERIC(6, 2) DEFAULT 0.0,
          grand_total NUMERIC(12, 2) NOT NULL,
          paid_amount NUMERIC(12, 2) DEFAULT 0.0,
          balance_amount NUMERIC(12, 2) DEFAULT 0.0,
          verification_token VARCHAR(100) UNIQUE NOT NULL,
          is_cancelled BOOLEAN DEFAULT FALSE,
          cancellation_reason TEXT,
          cancelled_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 10. Sale Items
      await client.query(`
        CREATE TABLE IF NOT EXISTS sale_items (
          id VARCHAR(64) PRIMARY KEY,
          sale_id VARCHAR(64) NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
          medicine_id VARCHAR(64) NOT NULL,
          medicine_name VARCHAR(255) NOT NULL,
          batch_id VARCHAR(64) NOT NULL,
          batch_number VARCHAR(100) NOT NULL,
          expiry_date DATE NOT NULL,
          packing VARCHAR(50),
          hsn_code VARCHAR(50),
          quantity INTEGER NOT NULL,
          free_qty INTEGER DEFAULT 0,
          mrp NUMERIC(10, 2) NOT NULL,
          selling_rate NUMERIC(10, 2) NOT NULL,
          discount_percent NUMERIC(5, 2) DEFAULT 0.0,
          gst_rate NUMERIC(5, 2) DEFAULT 5.0,
          taxable_amount NUMERIC(12, 2) NOT NULL,
          cgst_amount NUMERIC(10, 2) DEFAULT 0.0,
          sgst_amount NUMERIC(10, 2) DEFAULT 0.0,
          igst_amount NUMERIC(10, 2) DEFAULT 0.0,
          line_total NUMERIC(12, 2) NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 11. Payments
      await client.query(`
        CREATE TABLE IF NOT EXISTS payments (
          id VARCHAR(64) PRIMARY KEY,
          voucher_number VARCHAR(100) UNIQUE NOT NULL,
          voucher_type VARCHAR(50) NOT NULL,
          customer_id VARCHAR(64),
          supplier_id VARCHAR(64),
          sale_id VARCHAR(64),
          purchase_id VARCHAR(64),
          amount NUMERIC(12, 2) NOT NULL,
          payment_mode VARCHAR(50) DEFAULT 'Cash',
          reference_number VARCHAR(100),
          notes TEXT,
          payment_date TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 12. Customer Ledger
      await client.query(`
        CREATE TABLE IF NOT EXISTS customer_ledger (
          id VARCHAR(64) PRIMARY KEY,
          customer_id VARCHAR(64) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
          date TIMESTAMPTZ DEFAULT NOW(),
          voucher_type VARCHAR(50) NOT NULL,
          voucher_number VARCHAR(100) NOT NULL,
          debit NUMERIC(12, 2) DEFAULT 0.0,
          credit NUMERIC(12, 2) DEFAULT 0.0,
          balance NUMERIC(12, 2) NOT NULL,
          reference VARCHAR(100),
          remarks TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 13. Supplier Ledger
      await client.query(`
        CREATE TABLE IF NOT EXISTS supplier_ledger (
          id VARCHAR(64) PRIMARY KEY,
          supplier_id VARCHAR(64) NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
          date TIMESTAMPTZ DEFAULT NOW(),
          voucher_type VARCHAR(50) NOT NULL,
          voucher_number VARCHAR(100) NOT NULL,
          debit NUMERIC(12, 2) DEFAULT 0.0,
          credit NUMERIC(12, 2) DEFAULT 0.0,
          balance NUMERIC(12, 2) NOT NULL,
          reference VARCHAR(100),
          remarks TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 14. Stock Movements
      await client.query(`
        CREATE TABLE IF NOT EXISTS stock_movements (
          id VARCHAR(64) PRIMARY KEY,
          medicine_id VARCHAR(64) NOT NULL,
          medicine_name VARCHAR(255),
          batch_id VARCHAR(64) NOT NULL,
          batch_number VARCHAR(100) NOT NULL,
          type VARCHAR(50) NOT NULL,
          quantity INTEGER NOT NULL,
          previous_qty INTEGER NOT NULL,
          new_qty INTEGER NOT NULL,
          reference_type VARCHAR(50),
          reference_id VARCHAR(100),
          reason TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 15. Audit Logs
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64),
          user_name VARCHAR(255),
          action VARCHAR(100) NOT NULL,
          entity_type VARCHAR(100),
          entity_id VARCHAR(100),
          details TEXT,
          ip_address VARCHAR(100),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 16. Purchase Imports History
      await client.query(`
        CREATE TABLE IF NOT EXISTS purchase_imports (
          id VARCHAR(64) PRIMARY KEY,
          supplier_name VARCHAR(255),
          supplier_invoice_number VARCHAR(100),
          invoice_date DATE,
          file_name VARCHAR(255),
          file_type VARCHAR(50),
          total_items INTEGER DEFAULT 0,
          imported_items INTEGER DEFAULT 0,
          grand_total NUMERIC(12, 2) DEFAULT 0.0,
          tax_type VARCHAR(20) DEFAULT 'IGST',
          status VARCHAR(50) DEFAULT 'CONFIRMED',
          purchase_id VARCHAR(64),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 17. Durable Purchase Import Jobs (Page-by-page tracking & Vercel serverless safety)
      await client.query(`
        CREATE TABLE IF NOT EXISTS purchase_import_jobs (
          id VARCHAR(64) PRIMARY KEY,
          file_hash VARCHAR(64) NOT NULL,
          file_name VARCHAR(255),
          file_size INTEGER,
          mime_type VARCHAR(100),
          status VARCHAR(50) NOT NULL DEFAULT 'queued',
          stage VARCHAR(100) DEFAULT 'queued',
          total_pages INTEGER DEFAULT 1,
          completed_pages INTEGER DEFAULT 0,
          failed_pages INTEGER DEFAULT 0,
          extracted_rows_count INTEGER DEFAULT 0,
          error_message TEXT,
          pages_data JSONB DEFAULT '[]'::jsonb,
          final_result JSONB,
          timings JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_import_jobs_hash ON purchase_import_jobs(file_hash);
      `);

      await client.query('COMMIT');

      // Fetch created table list
      const res = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);

      this.isInitialized = true;
      return { tablesCreated: res.rows.map((r) => r.table_name) };
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('Failed to create Neon tables:', err);
      throw err;
    } finally {
      client.release();
    }
  }

  public async seedInitialData(seedSource: any): Promise<void> {
    if (!this.pool) return;
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Seed or Verify Administrator (Never overwrite existing password!)
      const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || 'admin@apexmedisales.com').trim().toLowerCase();
      const adminCheck = await client.query('SELECT id FROM users WHERE LOWER(email) = $1', [adminEmail]);

      if (adminCheck.rows.length === 0) {
        const adminName = process.env.INITIAL_ADMIN_NAME || 'Apex Admin';
        const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'ApexAdmin@2026';
        const salt = bcrypt.genSaltSync(10);
        const passwordHash = bcrypt.hashSync(adminPassword, salt);

        await client.query(
          `INSERT INTO users (id, name, email, password_hash, role, must_change_password)
           VALUES ($1, $2, $3, $4, 'ADMIN', false)`,
          ['usr_admin_001', adminName, adminEmail, passwordHash]
        );
        console.log('Neon DB: Created initial administrator account');
      }

      // 2. Seed Business Profile if missing
      const profileCheck = await client.query('SELECT id FROM business_profile LIMIT 1');
      if (profileCheck.rows.length === 0 && seedSource.businessProfile) {
        const bp = seedSource.businessProfile;
        await client.query(
          `INSERT INTO business_profile (
            id, store_name, owner_name, address, city, state, state_code, pincode,
            phone, email, gstin, dl_no1, dl_no2, food_lic, invoice_prefix, invoice_footer,
            terms_conditions, bank_name, account_no, ifsc_code, upi_id, round_off_preference
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
          [
            bp.id || 'biz_001',
            bp.storeName || 'APEX MEDI SALES',
            bp.ownerName || 'Apex Administrator',
            bp.address || '',
            bp.city || 'UTTARA KANNADA',
            bp.state || 'Karnataka',
            bp.stateCode || '29',
            bp.pincode || '581354',
            bp.phone || '9113917343',
            bp.email || 'apexmedisales@gmail.com',
            bp.gstin || '29BZWWPN5791F1ZE',
            bp.dlNo1 || 'KA-KW1-299954',
            bp.dlNo2 || 'KA-KW1-299955 & KA-KW1-299956',
            bp.foodLic || '11223344556677',
            bp.invoicePrefix || 'AM',
            bp.invoiceFooter || '',
            bp.termsConditions || '',
            bp.bankName || 'State Bank of India',
            bp.accountNo || '38492019482',
            bp.ifscCode || 'SBIN0004128',
            bp.upiId || 'apexmedisales@upi',
            bp.roundOffPreference !== false,
          ]
        );
      }

      // 3. Seed Suppliers if empty
      const supCheck = await client.query('SELECT COUNT(*) FROM suppliers');
      if (Number(supCheck.rows[0].count) === 0 && seedSource.suppliers) {
        for (const s of seedSource.suppliers) {
          await client.query(
            `INSERT INTO suppliers (id, name, contact_person, address, city, state, state_code, phone, email, gstin, dl_no, opening_balance, current_balance)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             ON CONFLICT (id) DO NOTHING`,
            [s.id, s.name, s.contactPerson, s.address, s.city, s.state, s.stateCode, s.phone, s.email, s.gstin, s.dlNo, s.openingBalance, s.currentBalance]
          );
        }
      }

      // 4. Seed Customers if empty
      const custCheck = await client.query('SELECT COUNT(*) FROM customers');
      if (Number(custCheck.rows[0].count) === 0 && seedSource.customers) {
        for (const c of seedSource.customers) {
          await client.query(
            `INSERT INTO customers (id, name, contact_person, address, city, state, state_code, phone, email, gstin, dl_no1, dl_no2, opening_balance, current_balance)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             ON CONFLICT (id) DO NOTHING`,
            [c.id, c.name, c.contactPerson, c.address, c.city, c.state, c.stateCode, c.phone, c.email, c.gstin, c.dlNo1, c.dlNo2, c.openingBalance, c.currentBalance]
          );
        }
      }

      // 5. Seed Medicines if empty
      const medCheck = await client.query('SELECT COUNT(*) FROM medicines');
      if (Number(medCheck.rows[0].count) === 0 && seedSource.medicines) {
        for (const m of seedSource.medicines) {
          await client.query(
            `INSERT INTO medicines (id, name, generic_name, manufacturer, dosage_form, strength, pack_size, uom, hsn_code, barcode, is_prescription_required, min_stock_alert, tax_rate, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             ON CONFLICT (id) DO NOTHING`,
            [m.id, m.name, m.genericName, m.manufacturer, m.dosageForm, m.strength, m.packSize, m.uom, m.hsnCode, m.barcode, m.isPrescriptionRequired, m.minStockAlert, m.taxRate, m.isActive]
          );
        }
      }

      // 6. Seed Batches if empty
      const batchCheck = await client.query('SELECT COUNT(*) FROM medicine_batches');
      if (Number(batchCheck.rows[0].count) === 0 && seedSource.batches) {
        for (const b of seedSource.batches) {
          await client.query(
            `INSERT INTO medicine_batches (id, medicine_id, batch_number, expiry_date, purchase_rate, mrp, selling_rate, initial_qty, current_qty, free_qty, supplier_id, purchase_invoice_ref, gst_rate, discount)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             ON CONFLICT (medicine_id, batch_number) DO NOTHING`,
            [b.id, b.medicineId, b.batchNumber, b.expiryDate, b.purchaseRate, b.mrp, b.sellingRate, b.initialQty, b.currentQty, b.freeQty, b.supplierId, b.purchaseInvoiceRef, b.gstRate, b.discount]
          );
        }
      }

      // 7. Seed Purchases & Items if empty
      const purCheck = await client.query('SELECT COUNT(*) FROM purchases');
      if (Number(purCheck.rows[0].count) === 0 && seedSource.purchases) {
        for (const p of seedSource.purchases) {
          await client.query(
            `INSERT INTO purchases (id, invoice_number, supplier_invoice_number, supplier_id, supplier_name, invoice_date, entry_date, payment_terms, payment_status, taxable_amount, cgst_amount, sgst_amount, igst_amount, discount_amount, round_off, grand_total, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
             ON CONFLICT (invoice_number) DO NOTHING`,
            [p.id, p.invoiceNumber, p.supplierInvoiceNumber, p.supplierId, p.supplierName, p.invoiceDate, p.entryDate, p.paymentTerms, p.paymentStatus, p.taxableAmount, p.cgstAmount, p.sgstAmount, p.igstAmount, p.discountAmount, p.roundOff, p.grandTotal, p.notes]
          );

          if (p.items) {
            for (const pi of p.items) {
              await client.query(
                `INSERT INTO purchase_items (id, purchase_id, medicine_id, medicine_name, batch_number, expiry_date, packing, hsn_code, quantity, free_qty, mrp, purchase_rate, discount_percent, gst_rate, line_amount)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                 ON CONFLICT (id) DO NOTHING`,
                [pi.id, p.id, pi.medicineId, pi.medicineName, pi.batchNumber, pi.expiryDate, pi.packing, pi.hsnCode, pi.quantity, pi.freeQty, pi.mrp, pi.purchaseRate, pi.discountPercent, pi.gstRate, pi.lineAmount]
              );
            }
          }
        }
      }

      // 8. Seed Sales & Items if empty
      const salesCheck = await client.query('SELECT COUNT(*) FROM sales');
      if (Number(salesCheck.rows[0].count) === 0 && seedSource.sales) {
        for (const s of seedSource.sales) {
          await client.query(
            `INSERT INTO sales (id, invoice_number, invoice_series, customer_id, customer_name, customer_address, customer_gstin, customer_state_code, invoice_date, payment_mode, payment_status, total_items, taxable_amount, cgst_amount, sgst_amount, igst_amount, discount_amount, additional_charges, round_off, grand_total, paid_amount, balance_amount, verification_token, is_cancelled)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
             ON CONFLICT (invoice_number) DO NOTHING`,
            [s.id, s.invoiceNumber, s.invoiceSeries, s.customerId, s.customerName, s.customerAddress, s.customerGstin, s.customerStateCode, s.invoiceDate, s.paymentMode, s.paymentStatus, s.totalItems, s.taxableAmount, s.cgstAmount, s.sgstAmount, s.igstAmount, s.discountAmount, s.additionalCharges, s.roundOff, s.grandTotal, s.paidAmount, s.balanceAmount, s.verificationToken, s.isCancelled]
          );

          if (s.items) {
            for (const si of s.items) {
              await client.query(
                `INSERT INTO sale_items (id, sale_id, medicine_id, medicine_name, batch_id, batch_number, expiry_date, packing, hsn_code, quantity, free_qty, mrp, selling_rate, discount_percent, gst_rate, taxable_amount, cgst_amount, sgst_amount, igst_amount, line_total)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
                 ON CONFLICT (id) DO NOTHING`,
                [si.id, s.id, si.medicineId, si.medicineName, si.batchId, si.batchNumber, si.expiryDate, si.packing, si.hsnCode, si.quantity, si.freeQty, si.mrp, si.sellingRate, si.discountPercent, si.gstRate, si.taxableAmount, si.cgstAmount, si.sgstAmount, si.igstAmount, si.lineTotal]
              );
            }
          }
        }
      }

      await client.query('COMMIT');
      console.log('Neon DB: Seeding verification completed successfully.');
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('Failed to seed initial data to Neon:', err.message);
    } finally {
      client.release();
    }
  }

  public async syncRecord(query: string, params: any[]): Promise<any> {
    if (!this.pool) return null;
    try {
      const res = await this.pool.query(query, params);
      return res.rows;
    } catch (err: any) {
      console.error('Neon DB query sync error:', err.message);
      return null;
    }
  }

  public async getTableCounts(): Promise<Record<string, number>> {
    if (!this.pool) return {};
    const tables = [
      'users', 'business_profile', 'medicines', 'medicine_batches',
      'suppliers', 'customers', 'purchases', 'purchase_items',
      'sales', 'sale_items', 'payments', 'customer_ledger',
      'supplier_ledger', 'stock_movements', 'audit_logs'
    ];
    const counts: Record<string, number> = {};
    for (const t of tables) {
      try {
        const res = await this.pool.query(`SELECT COUNT(*) as count FROM ${t}`);
        counts[t] = Number(res.rows[0]?.count || 0);
      } catch {
        counts[t] = 0;
      }
    }
    return counts;
  }

  public async loadAllFromNeon(): Promise<any | null> {
    if (!this.pool) return null;
    try {
      // 1. Users
      const usersRes = await this.pool.query('SELECT * FROM users ORDER BY created_at ASC');
      const users = usersRes.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        passwordHash: r.password_hash,
        role: r.role,
        mustChangePassword: r.must_change_password,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
      }));

      // 2. Business Profile
      const profRes = await this.pool.query('SELECT * FROM business_profile LIMIT 1');
      let businessProfile = null;
      if (profRes.rows.length > 0) {
        const p = profRes.rows[0];
        businessProfile = {
          id: p.id,
          storeName: p.store_name,
          ownerName: p.owner_name,
          address: p.address || '',
          city: p.city || '',
          state: p.state || 'Karnataka',
          stateCode: p.state_code || '29',
          pincode: p.pincode || '',
          phone: p.phone || '',
          email: p.email || '',
          gstin: p.gstin || '',
          dlNo1: p.dl_no1 || '',
          dlNo2: p.dl_no2 || '',
          foodLic: p.food_lic || '',
          invoicePrefix: p.invoice_prefix || 'AM',
          invoiceFooter: p.invoice_footer || '',
          termsConditions: p.terms_conditions || '',
          bankName: p.bank_name || '',
          accountNo: p.account_no || '',
          ifscCode: p.ifsc_code || '',
          upiId: p.upi_id || '',
          roundOffPreference: p.round_off_preference !== false,
          createdAt: p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString(),
          updatedAt: p.updated_at ? new Date(p.updated_at).toISOString() : new Date().toISOString(),
        };
      }

      // 3. Medicines
      const medRes = await this.pool.query('SELECT * FROM medicines ORDER BY name ASC');
      const medicines = medRes.rows.map((m: any) => ({
        id: m.id,
        name: m.name,
        genericName: m.generic_name,
        manufacturer: m.manufacturer,
        dosageForm: m.dosage_form,
        strength: m.strength,
        packSize: m.pack_size,
        uom: m.uom,
        hsnCode: m.hsn_code,
        barcode: m.barcode,
        isPrescriptionRequired: m.is_prescription_required,
        minStockAlert: Number(m.min_stock_alert || 0),
        taxRate: Number(m.tax_rate || 0),
        isActive: m.is_active,
        createdAt: m.created_at ? new Date(m.created_at).toISOString() : new Date().toISOString(),
        updatedAt: m.updated_at ? new Date(m.updated_at).toISOString() : new Date().toISOString(),
      }));

      // 4. Batches
      const batchRes = await this.pool.query('SELECT * FROM medicine_batches ORDER BY expiry_date ASC');
      const batches = batchRes.rows.map((b: any) => ({
        id: b.id,
        medicineId: b.medicine_id,
        batchNumber: b.batch_number,
        mfgDate: b.mfg_date ? new Date(b.mfg_date).toISOString().split('T')[0] : undefined,
        expiryDate: b.expiry_date ? new Date(b.expiry_date).toISOString().split('T')[0] : '',
        purchaseRate: Number(b.purchase_rate || 0),
        mrp: Number(b.mrp || 0),
        sellingRate: Number(b.selling_rate || 0),
        initialQty: Number(b.initial_qty || 0),
        currentQty: Number(b.current_qty || 0),
        freeQty: Number(b.free_qty || 0),
        supplierId: b.supplier_id,
        purchaseInvoiceRef: b.purchase_invoice_ref,
        gstRate: Number(b.gst_rate || 0),
        discount: Number(b.discount || 0),
        createdAt: b.created_at ? new Date(b.created_at).toISOString() : new Date().toISOString(),
        updatedAt: b.updated_at ? new Date(b.updated_at).toISOString() : new Date().toISOString(),
      }));

      // 5. Suppliers
      const supRes = await this.pool.query('SELECT * FROM suppliers ORDER BY name ASC');
      const suppliers = supRes.rows.map((s: any) => ({
        id: s.id,
        name: s.name,
        contactPerson: s.contact_person,
        address: s.address,
        city: s.city,
        state: s.state,
        stateCode: s.state_code,
        phone: s.phone,
        email: s.email,
        gstin: s.gstin,
        dlNo: s.dl_no,
        openingBalance: Number(s.opening_balance || 0),
        currentBalance: Number(s.current_balance || 0),
        createdAt: s.created_at ? new Date(s.created_at).toISOString() : new Date().toISOString(),
        updatedAt: s.updated_at ? new Date(s.updated_at).toISOString() : new Date().toISOString(),
      }));

      // 6. Customers
      const custRes = await this.pool.query('SELECT * FROM customers ORDER BY name ASC');
      const customers = custRes.rows.map((c: any) => ({
        id: c.id,
        name: c.name,
        contactPerson: c.contact_person,
        address: c.address,
        city: c.city,
        state: c.state,
        stateCode: c.state_code,
        phone: c.phone,
        email: c.email,
        gstin: c.gstin,
        dlNo1: c.dl_no1,
        dlNo2: c.dl_no2,
        openingBalance: Number(c.opening_balance || 0),
        currentBalance: Number(c.current_balance || 0),
        createdAt: c.created_at ? new Date(c.created_at).toISOString() : new Date().toISOString(),
        updatedAt: c.updated_at ? new Date(c.updated_at).toISOString() : new Date().toISOString(),
      }));

      // 7. Purchases and items
      const purRes = await this.pool.query('SELECT * FROM purchases ORDER BY invoice_date DESC');
      const purItemsRes = await this.pool.query('SELECT * FROM purchase_items');
      const purchases = purRes.rows.map((p: any) => {
        const items = purItemsRes.rows
          .filter((pi: any) => pi.purchase_id === p.id)
          .map((pi: any) => ({
            id: pi.id,
            purchaseId: pi.purchase_id,
            medicineId: pi.medicine_id,
            medicineName: pi.medicine_name,
            batchNumber: pi.batch_number,
            expiryDate: pi.expiry_date ? new Date(pi.expiry_date).toISOString().split('T')[0] : '',
            packing: pi.packing,
            hsnCode: pi.hsn_code,
            quantity: Number(pi.quantity || 0),
            freeQty: Number(pi.free_qty || 0),
            mrp: Number(pi.mrp || 0),
            purchaseRate: Number(pi.purchase_rate || 0),
            discountPercent: Number(pi.discount_percent || 0),
            gstRate: Number(pi.gst_rate || 0),
            lineAmount: Number(pi.line_amount || 0),
          }));

        return {
          id: p.id,
          invoiceNumber: p.invoice_number,
          supplierInvoiceNumber: p.supplier_invoice_number,
          supplierId: p.supplier_id,
          supplierName: p.supplier_name,
          invoiceDate: p.invoice_date ? new Date(p.invoice_date).toISOString() : new Date().toISOString(),
          entryDate: p.entry_date ? new Date(p.entry_date).toISOString() : new Date().toISOString(),
          paymentTerms: p.payment_terms || 'Credit',
          paymentStatus: p.payment_status || 'Pending',
          taxableAmount: Number(p.taxable_amount || 0),
          cgstAmount: Number(p.cgst_amount || 0),
          sgstAmount: Number(p.sgst_amount || 0),
          igstAmount: Number(p.igst_amount || 0),
          discountAmount: Number(p.discount_amount || 0),
          roundOff: Number(p.round_off || 0),
          grandTotal: Number(p.grand_total || 0),
          notes: p.notes,
          items,
          createdAt: p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString(),
          updatedAt: p.updated_at ? new Date(p.updated_at).toISOString() : new Date().toISOString(),
        };
      });

      // 8. Sales and items
      const salesRes = await this.pool.query('SELECT * FROM sales ORDER BY invoice_date DESC');
      const saleItemsRes = await this.pool.query('SELECT * FROM sale_items');
      const sales = salesRes.rows.map((s: any) => {
        const items = saleItemsRes.rows
          .filter((si: any) => si.sale_id === s.id)
          .map((si: any) => ({
            id: si.id,
            saleId: si.sale_id,
            medicineId: si.medicine_id,
            medicineName: si.medicine_name,
            batchId: si.batch_id,
            batchNumber: si.batch_number,
            expiryDate: si.expiry_date ? new Date(si.expiry_date).toISOString().split('T')[0] : '',
            packing: si.packing,
            hsnCode: si.hsn_code,
            quantity: Number(si.quantity || 0),
            freeQty: Number(si.free_qty || 0),
            mrp: Number(si.mrp || 0),
            sellingRate: Number(si.selling_rate || 0),
            discountPercent: Number(si.discount_percent || 0),
            gstRate: Number(si.gst_rate || 0),
            taxableAmount: Number(si.taxable_amount || 0),
            cgstAmount: Number(si.cgst_amount || 0),
            sgstAmount: Number(si.sgst_amount || 0),
            igstAmount: Number(si.igst_amount || 0),
            lineTotal: Number(si.line_total || 0),
          }));

        return {
          id: s.id,
          invoiceNumber: s.invoice_number,
          invoiceSeries: s.invoice_series || 'MAIN',
          customerId: s.customer_id,
          customerName: s.customer_name,
          customerAddress: s.customer_address,
          customerGstin: s.customer_gstin,
          customerStateCode: s.customer_state_code,
          invoiceDate: s.invoice_date ? new Date(s.invoice_date).toISOString() : new Date().toISOString(),
          paymentMode: s.payment_mode || 'Cash',
          paymentStatus: s.payment_status || 'Paid',
          totalItems: Number(s.total_items || items.length),
          taxableAmount: Number(s.taxable_amount || 0),
          cgstAmount: Number(s.cgst_amount || 0),
          sgstAmount: Number(s.sgst_amount || 0),
          igstAmount: Number(s.igst_amount || 0),
          discountAmount: Number(s.discount_amount || 0),
          additionalCharges: Number(s.additional_charges || 0),
          roundOff: Number(s.round_off || 0),
          grandTotal: Number(s.grand_total || 0),
          paidAmount: Number(s.paid_amount || 0),
          balanceAmount: Number(s.balance_amount || 0),
          verificationToken: s.verification_token,
          isCancelled: !!s.is_cancelled,
          cancellationReason: s.cancellation_reason,
          cancelledAt: s.cancelled_at ? new Date(s.cancelled_at).toISOString() : undefined,
          items,
          createdAt: s.created_at ? new Date(s.created_at).toISOString() : new Date().toISOString(),
          updatedAt: s.updated_at ? new Date(s.updated_at).toISOString() : new Date().toISOString(),
        };
      });

      // 9. Payments
      const payRes = await this.pool.query('SELECT * FROM payments ORDER BY payment_date DESC');
      const payments = payRes.rows.map((p: any) => ({
        id: p.id,
        voucherNumber: p.voucher_number,
        voucherType: p.voucher_type,
        customerId: p.customer_id,
        supplierId: p.supplier_id,
        saleId: p.sale_id,
        purchaseId: p.purchase_id,
        amount: Number(p.amount || 0),
        paymentMode: p.payment_mode,
        referenceNumber: p.reference_number,
        notes: p.notes,
        paymentDate: p.payment_date ? new Date(p.payment_date).toISOString() : new Date().toISOString(),
        createdAt: p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString(),
      }));

      // 10. Customer Ledgers
      const cLedgRes = await this.pool.query('SELECT * FROM customer_ledger ORDER BY date DESC');
      const customerLedgers = cLedgRes.rows.map((l: any) => ({
        id: l.id,
        customerId: l.customer_id,
        date: l.date ? new Date(l.date).toISOString() : new Date().toISOString(),
        voucherType: l.voucher_type,
        voucherNumber: l.voucher_number,
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
        balance: Number(l.balance || 0),
        reference: l.reference,
        remarks: l.remarks,
        createdAt: l.created_at ? new Date(l.created_at).toISOString() : new Date().toISOString(),
      }));

      // 11. Supplier Ledgers
      const sLedgRes = await this.pool.query('SELECT * FROM supplier_ledger ORDER BY date DESC');
      const supplierLedgers = sLedgRes.rows.map((l: any) => ({
        id: l.id,
        supplierId: l.supplier_id,
        date: l.date ? new Date(l.date).toISOString() : new Date().toISOString(),
        voucherType: l.voucher_type,
        voucherNumber: l.voucher_number,
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
        balance: Number(l.balance || 0),
        reference: l.reference,
        remarks: l.remarks,
        createdAt: l.created_at ? new Date(l.created_at).toISOString() : new Date().toISOString(),
      }));

      // 12. Stock Movements
      const smRes = await this.pool.query('SELECT * FROM stock_movements ORDER BY created_at DESC LIMIT 500');
      const stockMovements = smRes.rows.map((sm: any) => ({
        id: sm.id,
        medicineId: sm.medicine_id,
        medicineName: sm.medicine_name,
        batchId: sm.batch_id,
        batchNumber: sm.batch_number,
        type: sm.type,
        quantity: Number(sm.quantity || 0),
        previousQty: Number(sm.previous_qty || 0),
        newQty: Number(sm.new_qty || 0),
        referenceType: sm.reference_type,
        referenceId: sm.reference_id,
        reason: sm.reason,
        createdAt: sm.created_at ? new Date(sm.created_at).toISOString() : new Date().toISOString(),
      }));

      // 13. Audit Logs
      const alRes = await this.pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500');
      const auditLogs = alRes.rows.map((a: any) => ({
        id: a.id,
        userId: a.user_id,
        userName: a.user_name,
        action: a.action,
        entityType: a.entity_type,
        entityId: a.entity_id,
        details: a.details,
        ipAddress: a.ip_address,
        createdAt: a.created_at ? new Date(a.created_at).toISOString() : new Date().toISOString(),
      }));

      return {
        users,
        businessProfile,
        medicines,
        batches,
        suppliers,
        customers,
        purchases,
        sales,
        payments,
        customerLedgers,
        supplierLedgers,
        stockMovements,
        auditLogs,
      };
    } catch (err: any) {
      console.error('Failed to load data from Neon PostgreSQL:', err.message);
      return null;
    }
  }

  // --- Real-time Persistent Write Operations to Neon ---

  public async persistMedicine(m: any): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO medicines (
          id, name, generic_name, manufacturer, dosage_form, strength,
          pack_size, uom, hsn_code, barcode, is_prescription_required,
          min_stock_alert, tax_rate, is_active, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          generic_name = EXCLUDED.generic_name,
          manufacturer = EXCLUDED.manufacturer,
          dosage_form = EXCLUDED.dosage_form,
          strength = EXCLUDED.strength,
          pack_size = EXCLUDED.pack_size,
          uom = EXCLUDED.uom,
          hsn_code = EXCLUDED.hsn_code,
          barcode = EXCLUDED.barcode,
          is_prescription_required = EXCLUDED.is_prescription_required,
          min_stock_alert = EXCLUDED.min_stock_alert,
          tax_rate = EXCLUDED.tax_rate,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()`,
        [
          m.id, m.name, m.genericName || null, m.manufacturer || null, m.dosageForm,
          m.strength || null, m.packSize, m.uom, m.hsnCode, m.barcode || null,
          !!m.isPrescriptionRequired, m.minStockAlert, m.taxRate, m.isActive !== false
        ]
      );
    } catch (err: any) {
      console.error('Neon DB: persistMedicine error:', err.message);
      throw err;
    }
  }

  public async removeMedicine(id: string): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query('DELETE FROM medicines WHERE id = $1', [id]);
    } catch (err: any) {
      console.error('Neon DB: removeMedicine error:', err.message);
      throw err;
    }
  }

  public async removeSupplier(id: string): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query('DELETE FROM suppliers WHERE id = $1', [id]);
    } catch (err: any) {
      console.error('Neon DB: removeSupplier error:', err.message);
      throw err;
    }
  }

  public async removeCustomer(id: string): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query('DELETE FROM customers WHERE id = $1', [id]);
    } catch (err: any) {
      console.error('Neon DB: removeCustomer error:', err.message);
      throw err;
    }
  }

  public async persistBatch(b: any): Promise<void> {
    if (!this.pool) return;
    try {
      const res = await this.pool.query(
        `INSERT INTO medicine_batches (
          id, medicine_id, batch_number, expiry_date, purchase_rate,
          mrp, selling_rate, initial_qty, current_qty, free_qty,
          supplier_id, purchase_invoice_ref, gst_rate, discount, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
        ON CONFLICT (medicine_id, batch_number) DO UPDATE SET
          current_qty = EXCLUDED.current_qty,
          purchase_rate = EXCLUDED.purchase_rate,
          mrp = EXCLUDED.mrp,
          selling_rate = EXCLUDED.selling_rate,
          expiry_date = EXCLUDED.expiry_date,
          updated_at = NOW()
        RETURNING id`,
        [
          b.id, b.medicineId, b.batchNumber, b.expiryDate, b.purchaseRate,
          b.mrp, b.sellingRate, b.initialQty, b.currentQty, b.freeQty || 0,
          b.supplierId || null, b.purchaseInvoiceRef || null, b.gstRate || 5.0, b.discount || 0
        ]
      );
      if (res.rows && res.rows[0]?.id) {
        b.id = res.rows[0].id;
      }
    } catch (err: any) {
      console.error('Neon DB: persistBatch error:', err.message);
      throw err;
    }
  }

  public async updateBatchCurrentQty(batchId: string, currentQty: number): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        'UPDATE medicine_batches SET current_qty = $1, updated_at = NOW() WHERE id = $2',
        [currentQty, batchId]
      );
    } catch (err: any) {
      console.error('Neon DB: updateBatchCurrentQty error:', err.message);
      throw err;
    }
  }

  public async persistSupplier(s: any): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO suppliers (
          id, name, contact_person, address, city, state, state_code,
          phone, email, gstin, dl_no, opening_balance, current_balance, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          contact_person = EXCLUDED.contact_person,
          address = EXCLUDED.address,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          state_code = EXCLUDED.state_code,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          gstin = EXCLUDED.gstin,
          dl_no = EXCLUDED.dl_no,
          current_balance = EXCLUDED.current_balance,
          updated_at = NOW()`,
        [
          s.id, s.name, s.contactPerson || null, s.address || null, s.city || null,
          s.state || 'Karnataka', s.stateCode || '29', s.phone || null, s.email || null,
          s.gstin || null, s.dlNo || null, s.openingBalance || 0, s.currentBalance || 0
        ]
      );
    } catch (err: any) {
      console.error('Neon DB: persistSupplier error:', err.message);
      throw err;
    }
  }

  public async persistCustomer(c: any): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO customers (
          id, name, contact_person, address, city, state, state_code,
          phone, email, gstin, dl_no1, dl_no2, opening_balance, current_balance, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          contact_person = EXCLUDED.contact_person,
          address = EXCLUDED.address,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          state_code = EXCLUDED.state_code,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          gstin = EXCLUDED.gstin,
          dl_no1 = EXCLUDED.dl_no1,
          dl_no2 = EXCLUDED.dl_no2,
          current_balance = EXCLUDED.current_balance,
          updated_at = NOW()`,
        [
          c.id, c.name, c.contactPerson || null, c.address || null, c.city || null,
          c.state || 'Karnataka', c.stateCode || '29', c.phone || null, c.email || null,
          c.gstin || null, c.dlNo1 || null, c.dlNo2 || null, c.openingBalance || 0, c.currentBalance || 0
        ]
      );
    } catch (err: any) {
      console.error('Neon DB: persistCustomer error:', err.message);
      throw err;
    }
  }

  public async persistPurchase(p: any): Promise<void> {
    if (!this.pool) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO purchases (
          id, invoice_number, supplier_invoice_number, supplier_id,
          supplier_name, invoice_date, entry_date, payment_terms,
          payment_status, taxable_amount, cgst_amount, sgst_amount,
          igst_amount, discount_amount, round_off, grand_total, notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        ON CONFLICT (id) DO UPDATE SET
          payment_status = EXCLUDED.payment_status,
          updated_at = NOW()`,
        [
          p.id, p.invoiceNumber, p.supplierInvoiceNumber, p.supplierId,
          p.supplierName, p.invoiceDate, p.entryDate, p.paymentTerms,
          p.paymentStatus, p.taxableAmount, p.cgstAmount, p.sgstAmount,
          p.igstAmount, p.discountAmount, p.roundOff, p.grandTotal, p.notes
        ]
      );

      if (p.items) {
        for (const pi of p.items) {
          await client.query(
            `INSERT INTO purchase_items (
              id, purchase_id, medicine_id, medicine_name, batch_number,
              expiry_date, packing, hsn_code, quantity, free_qty,
              mrp, purchase_rate, discount_percent, gst_rate, line_amount
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
            ON CONFLICT (id) DO NOTHING`,
            [
              pi.id, p.id, pi.medicineId, pi.medicineName, pi.batchNumber,
              pi.expiryDate, pi.packing, pi.hsnCode, pi.quantity, pi.freeQty || 0,
              pi.mrp, pi.purchaseRate, pi.discountPercent || 0, pi.gstRate, pi.lineAmount
            ]
          );
        }
      }

      await client.query('COMMIT');
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('Neon DB: persistPurchase error:', err.message);
      throw err;
    } finally {
      client.release();
    }
  }

  public async persistSale(s: any): Promise<void> {
    if (!this.pool) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO sales (
          id, invoice_number, invoice_series, customer_id, customer_name,
          customer_address, customer_gstin, customer_state_code, invoice_date,
          payment_mode, payment_status, total_items, taxable_amount,
          cgst_amount, sgst_amount, igst_amount, discount_amount,
          additional_charges, round_off, grand_total, paid_amount,
          balance_amount, verification_token, is_cancelled
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
        ON CONFLICT (id) DO UPDATE SET
          is_cancelled = EXCLUDED.is_cancelled,
          payment_status = EXCLUDED.payment_status,
          paid_amount = EXCLUDED.paid_amount,
          balance_amount = EXCLUDED.balance_amount,
          updated_at = NOW()`,
        [
          s.id, s.invoiceNumber, s.invoiceSeries, s.customerId || null, s.customerName,
          s.customerAddress || null, s.customerGstin || null, s.customerStateCode || '29', s.invoiceDate,
          s.paymentMode, s.paymentStatus, s.totalItems, s.taxableAmount,
          s.cgstAmount, s.sgstAmount, s.igstAmount, s.discountAmount,
          s.additionalCharges, s.roundOff, s.grandTotal, s.paidAmount,
          s.balanceAmount, s.verificationToken, !!s.isCancelled
        ]
      );

      if (s.items) {
        for (const si of s.items) {
          await client.query(
            `INSERT INTO sale_items (
              id, sale_id, medicine_id, medicine_name, batch_id,
              batch_number, expiry_date, packing, hsn_code, quantity,
              free_qty, mrp, selling_rate, discount_percent, gst_rate,
              taxable_amount, cgst_amount, sgst_amount, igst_amount, line_total
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
            ON CONFLICT (id) DO NOTHING`,
            [
              si.id, s.id, si.medicineId, si.medicineName, si.batchId,
              si.batchNumber, si.expiryDate, si.packing, si.hsnCode, si.quantity,
              si.freeQty || 0, si.mrp, si.sellingRate, si.discountPercent || 0, si.gstRate,
              si.taxableAmount, si.cgstAmount, si.sgstAmount, si.igstAmount, si.lineTotal
            ]
          );
        }
      }

      await client.query('COMMIT');
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('Neon DB: persistSale error:', err.message);
      throw err;
    } finally {
      client.release();
    }
  }

  public async persistCancelSale(saleId: string, reason: string): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `UPDATE sales
         SET is_cancelled = true,
             cancellation_reason = $1,
             cancelled_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [reason, saleId]
      );
    } catch (err: any) {
      console.error('Neon DB: persistCancelSale error:', err.message);
      throw err;
    }
  }

  public async persistPayment(p: any): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO payments (
          id, voucher_number, voucher_type, customer_id, supplier_id,
          sale_id, purchase_id, amount, payment_mode, reference_number,
          notes, payment_date
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (id) DO NOTHING`,
        [
          p.id, p.voucherNumber, p.voucherType, p.customerId || null, p.supplierId || null,
          p.saleId || null, p.purchaseId || null, p.amount, p.paymentMode, p.referenceNumber || null,
          p.notes || null, p.paymentDate
        ]
      );
    } catch (err: any) {
      console.error('Neon DB: persistPayment error:', err.message);
      throw err;
    }
  }

  public async persistStockMovement(sm: any): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO stock_movements (
          id, medicine_id, medicine_name, batch_id, batch_number,
          type, quantity, previous_qty, new_qty, reference_type,
          reference_id, reason
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (id) DO NOTHING`,
        [
          sm.id, sm.medicineId, sm.medicineName || null, sm.batchId, sm.batchNumber,
          sm.type, sm.quantity, sm.previousQty, sm.newQty, sm.referenceType || null,
          sm.referenceId || null, sm.reason || null
        ]
      );
    } catch (err: any) {
      console.error('Neon DB: persistStockMovement error:', err.message);
      throw err;
    }
  }

  public async persistCustomerLedger(cl: any): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO customer_ledger (
          id, customer_id, date, voucher_type, voucher_number,
          debit, credit, balance, reference, remarks
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (id) DO NOTHING`,
        [
          cl.id, cl.customerId, cl.date, cl.voucherType, cl.voucherNumber,
          cl.debit, cl.credit, cl.balance, cl.reference || null, cl.remarks || null
        ]
      );
    } catch (err: any) {
      console.error('Neon DB: persistCustomerLedger error:', err.message);
      throw err;
    }
  }

  public async persistSupplierLedger(sl: any): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO supplier_ledger (
          id, supplier_id, date, voucher_type, voucher_number,
          debit, credit, balance, reference, remarks
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (id) DO NOTHING`,
        [
          sl.id, sl.supplierId, sl.date, sl.voucherType, sl.voucherNumber,
          sl.debit, sl.credit, sl.balance, sl.reference || null, sl.remarks || null
        ]
      );
    } catch (err: any) {
      console.error('Neon DB: persistSupplierLedger error:', err.message);
      throw err;
    }
  }

  public async persistAuditLog(al: any): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO audit_logs (
          id, user_id, user_name, action, entity_type,
          entity_id, details, ip_address
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (id) DO NOTHING`,
        [
          al.id, al.userId || null, al.userName || null, al.action,
          al.entityType || null, al.entityId || null, al.details || null, al.ipAddress || null
        ]
      );
    } catch (err: any) {
      console.error('Neon DB: persistAuditLog error:', err.message);
      throw err;
    }
  }

  public async persistUser(u: any): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO users (
          id, name, email, password_hash, role, must_change_password, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          must_change_password = EXCLUDED.must_change_password,
          updated_at = NOW()`,
        [u.id, u.name, u.email, u.passwordHash, u.role, !!u.mustChangePassword]
      );
    } catch (err: any) {
      console.error('Neon DB: persistUser error:', err.message);
      throw err;
    }
  }

  public async getUserByEmail(email: string): Promise<any | null> {
    if (!this.pool) return null;
    try {
      const clean = (email || '').trim().toLowerCase();
      const res = await this.pool.query(
        `SELECT id, name, email, password_hash, role, must_change_password, created_at, updated_at
         FROM users
         WHERE LOWER(email) = $1
            OR ($1 IN ('admin@apexmedisales.com', 'apexmedisales@gmail.com')
                AND LOWER(email) IN ('admin@apexmedisales.com', 'apexmedisales@gmail.com'))
         LIMIT 1`,
        [clean]
      );
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        passwordHash: r.password_hash,
        role: r.role,
        mustChangePassword: !!r.must_change_password,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
      };
    } catch (err: any) {
      console.error('[Diagnostic] Neon DB: getUserByEmail error:', err.message);
      throw err;
    }
  }

  public async getUserById(id: string): Promise<any | null> {
    if (!this.pool) return null;
    try {
      const res = await this.pool.query(
        `SELECT id, name, email, password_hash, role, must_change_password, created_at, updated_at
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [id]
      );
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        passwordHash: r.password_hash,
        role: r.role,
        mustChangePassword: !!r.must_change_password,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
      };
    } catch (err: any) {
      console.error('[Diagnostic] Neon DB: getUserById error:', err.message);
      throw err;
    }
  }

  public async persistProfile(p: any): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO business_profile (
          id, store_name, owner_name, address, city, state, state_code,
          pincode, phone, email, gstin, dl_no1, dl_no2, food_lic,
          invoice_prefix, invoice_footer, terms_conditions, bank_name,
          account_no, ifsc_code, upi_id, round_off_preference, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NOW())
        ON CONFLICT (id) DO UPDATE SET
          store_name = EXCLUDED.store_name,
          owner_name = EXCLUDED.owner_name,
          address = EXCLUDED.address,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          state_code = EXCLUDED.state_code,
          pincode = EXCLUDED.pincode,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          gstin = EXCLUDED.gstin,
          dl_no1 = EXCLUDED.dl_no1,
          dl_no2 = EXCLUDED.dl_no2,
          food_lic = EXCLUDED.food_lic,
          invoice_prefix = EXCLUDED.invoice_prefix,
          invoice_footer = EXCLUDED.invoice_footer,
          terms_conditions = EXCLUDED.terms_conditions,
          bank_name = EXCLUDED.bank_name,
          account_no = EXCLUDED.account_no,
          ifsc_code = EXCLUDED.ifsc_code,
          upi_id = EXCLUDED.upi_id,
          round_off_preference = EXCLUDED.round_off_preference,
          updated_at = NOW()`,
        [
          p.id, p.storeName, p.ownerName, p.address, p.city, p.state, p.stateCode,
          p.pincode, p.phone, p.email, p.gstin, p.dlNo1, p.dlNo2, p.foodLic,
          p.invoicePrefix, p.invoiceFooter, p.termsConditions, p.bankName,
          p.accountNo, p.ifscCode, p.upiId, p.roundOffPreference !== false
        ]
      );
    } catch (err: any) {
      console.error('Neon DB: persistProfile error:', err.message);
      throw err;
    }
  }

  public async persistPurchaseImport(imp: any): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO purchase_imports (
          id, supplier_name, supplier_invoice_number, invoice_date,
          file_name, file_type, total_items, imported_items,
          grand_total, tax_type, status, purchase_id, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
        ON CONFLICT (id) DO UPDATE SET
          imported_items = EXCLUDED.imported_items,
          status = EXCLUDED.status,
          purchase_id = EXCLUDED.purchase_id`,
        [
          imp.id,
          imp.supplierName,
          imp.supplierInvoiceNumber,
          imp.invoiceDate,
          imp.fileName || 'invoice-scan',
          imp.fileType || 'application/pdf',
          imp.totalItems || 0,
          imp.importedItems || 0,
          imp.grandTotal || 0,
          imp.taxType || 'IGST',
          imp.status || 'CONFIRMED',
          imp.purchaseId || null,
        ]
      );
    } catch (err: any) {
      console.error('Neon DB: persistPurchaseImport error:', err.message);
    }
  }

  public async getPurchaseImports(): Promise<any[]> {
    if (!this.pool) return [];
    try {
      const res = await this.pool.query('SELECT * FROM purchase_imports ORDER BY created_at DESC LIMIT 50');
      return res.rows.map((r: any) => ({
        id: r.id,
        supplierName: r.supplier_name,
        supplierInvoiceNumber: r.supplier_invoice_number,
        invoiceDate: r.invoice_date ? new Date(r.invoice_date).toISOString().split('T')[0] : '',
        fileName: r.file_name,
        fileType: r.file_type,
        totalItems: Number(r.total_items || 0),
        importedItems: Number(r.imported_items || 0),
        grandTotal: Number(r.grand_total || 0),
        taxType: r.tax_type,
        status: r.status,
        purchaseId: r.purchase_id,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      }));
    } catch (err: any) {
      console.error('Neon DB: getPurchaseImports error:', err.message);
      return [];
    }
  }

  public async persistImportJob(job: any): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO purchase_import_jobs (
          id, file_hash, file_name, file_size, mime_type,
          status, stage, total_pages, completed_pages, failed_pages,
          extracted_rows_count, error_message, pages_data, final_result,
          timings, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          stage = EXCLUDED.stage,
          completed_pages = EXCLUDED.completed_pages,
          failed_pages = EXCLUDED.failed_pages,
          extracted_rows_count = EXCLUDED.extracted_rows_count,
          error_message = EXCLUDED.error_message,
          pages_data = EXCLUDED.pages_data,
          final_result = EXCLUDED.final_result,
          timings = EXCLUDED.timings,
          updated_at = NOW()`,
        [
          job.id,
          job.fileHash,
          job.fileName,
          job.fileSize || 0,
          job.mimeType || 'application/pdf',
          job.status,
          job.stage,
          job.totalPages || 1,
          job.completedPages || 0,
          job.failedPages || 0,
          job.extractedRowsCount || 0,
          job.errorMessage || null,
          JSON.stringify(job.pagesData || []),
          job.finalResult ? JSON.stringify(job.finalResult) : null,
          JSON.stringify(job.timings || {}),
          job.createdAt || new Date().toISOString(),
        ]
      );
    } catch (err: any) {
      console.error('Neon DB: persistImportJob error:', err.message);
    }
  }

  public async getImportJob(id: string): Promise<any | null> {
    if (!this.pool) return null;
    try {
      const res = await this.pool.query('SELECT * FROM purchase_import_jobs WHERE id = $1', [id]);
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        fileHash: r.file_hash,
        fileName: r.file_name,
        fileSize: Number(r.file_size || 0),
        mimeType: r.mime_type,
        status: r.status,
        stage: r.stage,
        totalPages: Number(r.total_pages || 1),
        completedPages: Number(r.completed_pages || 0),
        failedPages: Number(r.failed_pages || 0),
        extractedRowsCount: Number(r.extracted_rows_count || 0),
        errorMessage: r.error_message,
        pagesData: typeof r.pages_data === 'string' ? JSON.parse(r.pages_data) : (r.pages_data || []),
        finalResult: typeof r.final_result === 'string' ? JSON.parse(r.final_result) : r.final_result,
        timings: typeof r.timings === 'string' ? JSON.parse(r.timings) : (r.timings || {}),
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
      };
    } catch (err: any) {
      console.error('Neon DB: getImportJob error:', err.message);
      return null;
    }
  }

  public async getImportJobByHash(fileHash: string): Promise<any | null> {
    if (!this.pool) return null;
    try {
      const res = await this.pool.query(
        "SELECT * FROM purchase_import_jobs WHERE file_hash = $1 AND status = 'completed' ORDER BY updated_at DESC LIMIT 1",
        [fileHash]
      );
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        fileHash: r.file_hash,
        fileName: r.file_name,
        fileSize: Number(r.file_size || 0),
        mimeType: r.mime_type,
        status: r.status,
        stage: r.stage,
        totalPages: Number(r.total_pages || 1),
        completedPages: Number(r.completed_pages || 0),
        failedPages: Number(r.failed_pages || 0),
        extractedRowsCount: Number(r.extracted_rows_count || 0),
        errorMessage: r.error_message,
        pagesData: typeof r.pages_data === 'string' ? JSON.parse(r.pages_data) : (r.pages_data || []),
        finalResult: typeof r.final_result === 'string' ? JSON.parse(r.final_result) : r.final_result,
        timings: typeof r.timings === 'string' ? JSON.parse(r.timings) : (r.timings || {}),
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
      };
    } catch (err: any) {
      console.error('Neon DB: getImportJobByHash error:', err.message);
      return null;
    }
  }
}

export const neonAdapter = new NeonDatabaseAdapter();
