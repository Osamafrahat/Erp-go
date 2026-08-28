-- Add subscription expiry tracking columns
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS renewal_note text;
