import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function runSeed() {
  const databaseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;

  console.log('--- Apex Medi Sales ERP: Database Initialization & Seeding ---');

  if (!databaseUrl || databaseUrl.includes('ep-sample')) {
    console.log('Notice: DATABASE_URL is not set to a live remote PostgreSQL database.');
    console.log('The application will use the pre-seeded persistent local/serverless engine.');
    console.log('To connect to Neon PostgreSQL, set DATABASE_URL in Vercel environment variables.');
    return;
  }

  console.log('Connecting to Neon PostgreSQL at:', databaseUrl.split('@')[1]?.split('/')[0] || 'remote host');

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();
    console.log('Successfully connected to PostgreSQL database!');

    // 1. Create Tables idempotently if they do not exist
    console.log('Ensuring tables exist...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'ADMIN',
        must_change_password BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

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
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

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
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS medicine_batches (
        id VARCHAR(64) PRIMARY KEY,
        medicine_id VARCHAR(64) NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
        batch_number VARCHAR(100) NOT NULL,
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
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(medicine_id, batch_number)
      );

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
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

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
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS purchases (
        id VARCHAR(64) PRIMARY KEY,
        invoice_number VARCHAR(100) UNIQUE NOT NULL,
        supplier_invoice_number VARCHAR(100) NOT NULL,
        supplier_id VARCHAR(64) NOT NULL,
        supplier_name VARCHAR(255),
        invoice_date TIMESTAMP WITH TIME ZONE NOT NULL,
        entry_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
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
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sales (
        id VARCHAR(64) PRIMARY KEY,
        invoice_number VARCHAR(100) UNIQUE NOT NULL,
        invoice_series VARCHAR(50) DEFAULT 'MAIN',
        customer_id VARCHAR(64),
        customer_name VARCHAR(255) NOT NULL,
        customer_address TEXT,
        customer_gstin VARCHAR(50),
        customer_state_code VARCHAR(10) DEFAULT '29',
        invoice_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
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
        cancelled_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64),
        user_name VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100),
        entity_id VARCHAR(100),
        details TEXT,
        ip_address VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('Tables initialized successfully.');

    // 2. Safe, idempotent Administrator creation
    const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || 'admin@apexmedisales.com').trim().toLowerCase();
    const adminName = process.env.INITIAL_ADMIN_NAME || 'Apex Admin';
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'ApexAdmin@2026';

    const checkAdmin = await client.query('SELECT id, email FROM users WHERE LOWER(email) = $1', [adminEmail]);

    if (checkAdmin.rows.length === 0) {
      console.log(`Seeding initial administrator: ${adminEmail}`);
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(adminPassword, salt);
      await client.query(
        `INSERT INTO users (id, name, email, password_hash, role, must_change_password)
         VALUES ($1, $2, $3, $4, 'ADMIN', false)`,
        ['usr_admin_001', adminName, adminEmail, passwordHash]
      );
      console.log('Administrator account created successfully.');
    } else {
      console.log(`Administrator account (${adminEmail}) already exists. Preserving existing password.`);
    }

    client.release();
    console.log('--- Neon Database Seeding Completed Successfully ---');
  } catch (err: any) {
    console.error('Error during database initialization:', err.message);
  } finally {
    await pool.end();
  }
}

runSeed();
