-- Saved payment methods for auto-renewal
CREATE TABLE IF NOT EXISTS saved_payment_methods (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'paymob',
  card_last_four TEXT,
  card_brand TEXT,
  token TEXT NOT NULL,
  is_default BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE saved_payment_methods ADD COLUMN IF NOT EXISTS paymob_token_id TEXT;

CREATE INDEX IF NOT EXISTS idx_saved_payment_methods_tenant ON saved_payment_methods(tenant_id);
