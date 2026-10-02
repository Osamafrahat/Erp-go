import supabase from '../db/supabase.js'
import {
  DB_LIMIT_COLUMNS,
  MONTHLY_RESOURCES,
  currentMonthStartIso,
  isUnlimited,
  resolveLimit,
} from '../services/planLimits.js'

export function checkTenantLimits(resource) {
  return async (req, res, next) => {
    if (!req.user?.tenantId) {
      return next()
    }

    try {
      const { data: tenant, error: tenantErr } = await supabase
        .from('tenants')
        .select('subscription_tier, max_products, max_users, max_orders_monthly')
        .eq('id', req.user.tenantId)
        .single()

      if (tenantErr || !tenant) {
        console.error(`[Limits] Tenant ${req.user.tenantId} not found:`, tenantErr?.message)
        return res.status(403).json({ error: 'Tenant not found' })
      }

      const plan = tenant.subscription_tier || 'free'

      const column = DB_LIMIT_COLUMNS[resource]
      const limit = resolveLimit(resource, plan, column ? tenant[column] : undefined)

      if (isUnlimited(limit)) {
        return next()
      }

      const numericLimit = Number(limit)
      if (isNaN(numericLimit) || numericLimit <= 0) {
        return next()
      }

      // Monthly resources (orders) are counted within the current calendar
      // month so the cap resets with the counter shown on the billing page;
      // cumulative resources (products, users, services) count all time.
      let countQuery = supabase
        .from(resource)
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', req.user.tenantId)

      if (MONTHLY_RESOURCES.has(resource)) {
        countQuery = countQuery.gte('created_at', currentMonthStartIso())
      }

      const { count, error: countErr } = await countQuery

      if (countErr) {
        console.error(`[Limits] Count query failed for ${resource}:`, countErr.message)
        // On count error, allow the request (fail open)
        return next()
      }

      const current = count || 0

      if (current >= numericLimit) {
        console.log(`[Limits] BLOCKED: Tenant ${req.user.tenantId} hit ${resource} limit: ${current}/${numericLimit} (${plan})`)
        return res.status(403).json({
          error: `${resource} limit reached for ${plan} plan`,
          limit: numericLimit,
          current,
          upgradeRequired: true,
        })
      }

      // Warn when close to limit (90%)
      if (current >= numericLimit * 0.9) {
        console.log(`[Limits] WARNING: Tenant ${req.user.tenantId} ${resource} at ${current}/${numericLimit} (${plan})`)
        res.setHeader('X-Plan-Limit-Warning', `${resource}: ${current}/${numericLimit}`)
      }

      next()
    } catch (err) {
      console.error(`[Limits] Fatal error checking ${resource} limits:`, err.message)
      // On fatal error, allow the request (fail open) but log it
      return next()
    }
  }
}
