import cron from 'node-cron'
import supabase from '../db/supabase.js'
import { logActivity } from '../middleware/activityLogger.js'
import { planEntitlements } from './planLimits.js'

let expiryCheckJob = null

export async function runSchemaMigrations() {
  console.log('[Migration] Checking schema...')
  try {
    // Check if subscription_expires_at column exists
    const { data, error } = await supabase
      .from('tenants')
      .select('id')
      .limit(1)

    if (error) {
      console.error('[Migration] Cannot query tenants table:', error.message)
      return
    }

    // Try adding columns via raw SQL
    const sqlStatements = [
      'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz',
      'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS renewal_note text',
      // Wallet-transfer payment proofs (manual InstaPay / Vodafone Cash flow).
      // exec_sql is typically revoked for the service role, so this logs
      // "manual migration may be needed" — the same SQL is pasted into the
      // Supabase SQL Editor in that case.
      `CREATE TABLE IF NOT EXISTS wallet_payment_requests (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        plan_slug TEXT NOT NULL,
        billing_period TEXT NOT NULL DEFAULT 'monthly',
        amount_egp NUMERIC(12,2) NOT NULL,
        wallet_type TEXT NOT NULL,
        reference_note TEXT,
        screenshot TEXT NOT NULL,
        payment_code TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        rejection_reason TEXT,
        confirmed_by INTEGER,
        confirmed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now(),
        CONSTRAINT wallet_payment_requests_status_check CHECK (status IN ('pending','confirmed','rejected'))
      )`,
      // One in-flight request per tenant, enforced by the database itself so
      // concurrent double submissions cannot both land.
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_payment_requests_pending
         ON wallet_payment_requests(tenant_id) WHERE status = 'pending'`,
      `CREATE INDEX IF NOT EXISTS idx_wallet_payment_requests_status
         ON wallet_payment_requests(status, created_at DESC)`,
      // Deny direct anon/authenticated access — proof screenshots are only
      // reachable through the authenticated API routes.
      'ALTER TABLE wallet_payment_requests ENABLE ROW LEVEL SECURITY',
    ]

    for (const sql of sqlStatements) {
      try {
        const { error: e } = await supabase.rpc('exec_sql', { sql })
        if (e) console.log(`[Migration] RPC exec_sql not available (${e.message}), manual migration may be needed`)
      } catch {
        // RPC function doesn't exist — columns must be added via SQL Editor
      }
    }

    console.log('[Migration] Schema check complete')
  } catch (err) {
    console.error('[Migration] Error:', err.message)
  }
}

export async function checkExpiredSubscriptions() {
  console.log('[SubscriptionExpiry] Running subscription expiry check...')
  try {
    const now = new Date().toISOString()

    // 1. Check expired paid subscriptions
    const { data: expiredTenants, error } = await supabase
      .from('tenants')
      .select('id, name, subscription_tier')
      .not('subscription_tier', 'eq', 'free')
      .not('subscription_expires_at', 'is', null)
      .lte('subscription_expires_at', now)
      .eq('subscription_status', 'active')

    if (error) throw error

    if (expiredTenants && expiredTenants.length > 0) {
      console.log(`[SubscriptionExpiry] Found ${expiredTenants.length} expired paid subscription(s)`)

      for (const tenant of expiredTenants) {
        const { error: updateErr } = await supabase
          .from('tenants')
          .update({
            subscription_tier: 'free',
            subscription_status: 'active',
            subscription_expires_at: null,
            ...planEntitlements('free'),
            renewal_note: `Your ${tenant.subscription_tier} plan has expired. Please renew to restore your limits.`,
            updated_at: now,
          })
          .eq('id', tenant.id)

        if (updateErr) {
          console.error(`[SubscriptionExpiry] Failed to downgrade tenant ${tenant.id}:`, updateErr.message)
        } else {
          console.log(`[SubscriptionExpiry] Tenant ${tenant.id} (${tenant.name}) downgraded to free (was ${tenant.subscription_tier})`)
          await logActivity({
            user_name: 'System',
            action: 'expired',
            entity_type: 'subscription',
            entity_id: tenant.id,
            entity_name: tenant.name,
            details: { from_tier: tenant.subscription_tier, to_tier: 'free', reason: 'subscription_expired' },
            tenant_id: tenant.id,
          })
        }
      }
    }

    // 2. Check expired trials (trial_ends_at has passed, still in trialing status)
    const { data: expiredTrials, error: trialError } = await supabase
      .from('tenants')
      .select('id, name, subscription_tier')
      .eq('subscription_status', 'trialing')
      .not('trial_ends_at', 'is', null)
      .lte('trial_ends_at', now)

    if (trialError) throw trialError

    if (expiredTrials && expiredTrials.length > 0) {
      console.log(`[SubscriptionExpiry] Found ${expiredTrials.length} expired trial(s)`)

      for (const tenant of expiredTrials) {
        const { error: updateErr } = await supabase
          .from('tenants')
          .update({
            subscription_status: 'active',
            subscription_tier: 'free',
            max_products: FREE_TIER_LIMITS.max_products,
            max_users: FREE_TIER_LIMITS.max_users,
            max_orders_monthly: FREE_TIER_LIMITS.max_orders_monthly,
            renewal_note: 'Your 14-day trial has ended. Upgrade to Pro or Enterprise to continue.',
            updated_at: now,
          })
          .eq('id', tenant.id)

        if (updateErr) {
          console.error(`[SubscriptionExpiry] Failed to expire trial for tenant ${tenant.id}:`, updateErr.message)
        } else {
          console.log(`[SubscriptionExpiry] Tenant ${tenant.id} (${tenant.name}) trial expired, moved to free`)
          await logActivity({
            user_name: 'System',
            action: 'expired',
            entity_type: 'subscription',
            entity_id: tenant.id,
            entity_name: tenant.name,
            details: { from_tier: 'trial', to_tier: 'free', reason: 'trial_expired' },
            tenant_id: tenant.id,
          })
        }
      }
    }

    if ((!expiredTenants || expiredTenants.length === 0) && (!expiredTrials || expiredTrials.length === 0)) {
      console.log('[SubscriptionExpiry] No expired subscriptions or trials found.')
    }
  } catch (err) {
    console.error('[SubscriptionExpiry] Error:', err.message)
  }
}

export function startSubscriptionExpiryCron() {
  if (expiryCheckJob) return
  expiryCheckJob = cron.schedule('0 2 * * *', checkExpiredSubscriptions)
  console.log('[SubscriptionExpiry] Cron job started (daily at 02:00)')
}

export function stopSubscriptionExpiryCron() {
  if (expiryCheckJob) {
    expiryCheckJob.stop()
    expiryCheckJob = null
    console.log('[SubscriptionExpiry] Cron job stopped')
  }
}
