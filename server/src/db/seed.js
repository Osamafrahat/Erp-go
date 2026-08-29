import supabase from './supabase.js'
import bcrypt from 'bcryptjs'

async function seed(tenantId) {
  console.log('Checking Supabase tables...')

  // Check if users table exists by trying to select
  const { error: checkError } = await supabase.from('users').select('id').limit(1)

  if (checkError && checkError.code === '42P01') {
    // Table doesn't exist - print SQL instructions
    console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║  Your Supabase database needs tables. Go to your Supabase dashboard ║
║  (https://supabase.com/dashboard) → SQL Editor and run this SQL:    ║
╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'CASHIER',
  permissions JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  must_change_password BOOLEAN DEFAULT false,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, username)
);

CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  cost_price NUMERIC DEFAULT 0,
  stock_quantity NUMERIC DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  is_refundable BOOLEAN DEFAULT true,
  unit_of_measure TEXT DEFAULT 'quantity',
  image_url TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  supplier_id BIGINT REFERENCES suppliers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  payment_status TEXT DEFAULT 'paid',
  user_id BIGINT REFERENCES users(id),
  customer_id BIGINT REFERENCES customers(id),
  promotion_id BIGINT REFERENCES promotions(id),
  is_refunded BOOLEAN DEFAULT false,
  journal_entry_id BIGINT REFERENCES journal_entries(id),
  client_order_id TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, order_number)
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id),
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payment_splits (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id),
  type TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  reference_id BIGINT,
  notes TEXT,
  created_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS promotions (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  type TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  min_order_amount NUMERIC,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, code)
);

CREATE TABLE IF NOT EXISTS store_settings (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  "key" TEXT NOT NULL,
  value TEXT,
  UNIQUE(tenant_id, "key")
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);

-- Ensure customers has account_code column
ALTER TABLE customers ADD COLUMN IF NOT EXISTS account_code TEXT;

-- Ensure expenses has method column
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS method TEXT DEFAULT 'cash';

-- Default admin user
`)

    process.exit(1)
  }

  if (checkError) {
    console.error('Error checking tables:', checkError)
    process.exit(1)
  }

  // Ensure new columns exist on existing databases
  const { data: hasMethod } = await supabase.from('expenses').select('method').limit(1).catch(() => ({ data: null, error: true }))
  const { data: hasAccountCode } = await supabase.from('customers').select('account_code').limit(1).catch(() => ({ data: null, error: true }))

  if (!hasMethod || !hasAccountCode) {
    console.log('')
    console.log('╔══════════════════════════════════════════════════════════════════╗')
    console.log('║  Missing columns detected. Run this SQL in Supabase SQL Editor: ║')
    console.log('╚══════════════════════════════════════════════════════════════════╝')
    console.log('')
    console.log('ALTER TABLE customers ADD COLUMN IF NOT EXISTS account_code TEXT;')
    console.log('ALTER TABLE expenses ADD COLUMN IF NOT EXISTS method TEXT DEFAULT \'cash\';')
    console.log('')
  }

  // Tables exist - check for admin user
  let adminQuery = supabase
    .from('users')
    .select('id')
    .eq('username', 'admin')
  if (tenantId) adminQuery = adminQuery.eq('tenant_id', tenantId)
  const { data: existingAdmin } = await adminQuery.single()

  if (!existingAdmin) {
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash('admin123', salt)

    const adminUser = {
      username: 'admin',
      password: hashedPassword,
      full_name: 'Administrator',
      role: 'MANAGER',
      permissions: [
        'dashboard_view', 'pos_access', 'inventory_view', 'inventory_edit',
        'reports_view', 'suppliers_view', 'suppliers_edit',
        'promotions_view', 'promotions_edit', 'settings_view',
        'settings_edit', 'user_manage', 'customers_view', 'customers_edit',
        'expenses_view', 'expenses_edit', 'refunds_view', 'refunds_edit',
        'employees_view', 'employees_edit', 'accounting_view', 'accounting_edit',
        'accounting_post', 'hr_view', 'hr_edit', 'services_view', 'services_edit'
      ],
      is_active: true,
      must_change_password: true
    }
    if (tenantId) adminUser.tenant_id = tenantId

    const { error: insertError } = await supabase
      .from('users')
      .insert(adminUser)

    if (insertError) {
      console.error('Error creating admin user:', insertError)
      process.exit(1)
    }

    console.log('Default admin user created')
  } else {
    console.log('Admin user already exists')
  }

  // Seed default store settings
  const defaultSettings = [
    { key: 'store_name', value: 'ERP-GO' },
    { key: 'currency', value: 'EGP' },
    { key: 'currency_symbol', value: 'ج.م' },
    { key: 'tax_rate', value: '14' },
    { key: 'low_stock_threshold', value: '10' },
    { key: 'receipt_header', value: 'Thank you for your purchase!' },
    { key: 'receipt_footer', value: 'Come again!' }
  ]

  for (const setting of defaultSettings) {
    const settingData = tenantId ? { ...setting, tenant_id: tenantId } : setting
    await supabase
      .from('store_settings')
      .upsert(settingData, { onConflict: 'key' })
  }

  // Backfill account_code for existing customers
  let customerQuery = supabase
    .from('customers')
    .select('id')
    .is('account_code', null)
  if (tenantId) customerQuery = customerQuery.eq('tenant_id', tenantId)
  const { data: customersWithoutCode } = await customerQuery

  if (customersWithoutCode && customersWithoutCode.length > 0) {
    for (const cust of customersWithoutCode) {
      await supabase
        .from('customers')
        .update({ account_code: `1030-C${cust.id}` })
        .eq('id', cust.id)
    }
    console.log(`Backfilled account_code for ${customersWithoutCode.length} customers`)
  }

  console.log('Seed completed successfully!')
}

// Support both CLI usage and programmatic usage
const tenantIdArg = process.argv[2] || null
seed(tenantIdArg).catch(console.error)
