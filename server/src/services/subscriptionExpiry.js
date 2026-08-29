import cron from 'node-cron'
import supabase from '../db/supabase.js'
import { logActivity } from '../middleware/activityLogger.js'

let expiryCheckJob = null

const FREE_TIER_LIMITS = {
  max_products: 50,
  max_users: 2,
  max_orders_monthly: 100,
}

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

    const { data: expiredTenants, error } = await supabase
      .from('tenants')
      .select('id, name, subscription_tier')
      .not('subscription_tier', 'eq', 'free')
      .not('subscription_expires_at', 'is', null)
      .lte('subscription_expires_at', now)
      .eq('subscription_status', 'active')

    if (error) throw error

    if (!expiredTenants || expiredTenants.length === 0) {
      console.log('[SubscriptionExpiry] No expired subscriptions found.')
      return
    }

    console.log(`[SubscriptionExpiry] Found ${expiredTenants.length} expired subscription(s)`)

    for (const tenant of expiredTenants) {
      const { error: updateErr } = await supabase
        .from('tenants')
        .update({
          subscription_tier: 'free',
          subscription_status: 'active',
          subscription_expires_at: null,
          max_products: FREE_TIER_LIMITS.max_products,
          max_users: FREE_TIER_LIMITS.max_users,
          max_orders_monthly: FREE_TIER_LIMITS.max_orders_monthly,
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
