import cron from 'node-cron'
import supabase from '../db/supabase.js'

let expiryCheckJob = null

const FREE_TIER_LIMITS = {
  max_products: 50,
  max_users: 2,
  max_orders_monthly: 100,
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
