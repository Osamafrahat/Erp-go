import supabase from '../db/supabase.js'

const DEFAULT_LIMITS = {
  products: { free: 50, pro: 500, enterprise: -1 },
  users: { free: 2, pro: 15, enterprise: -1 },
  orders: { free: 100, pro: -1, enterprise: -1 },
  services: { free: 10, pro: 100, enterprise: -1 },
}

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

      // Get limit from DB column, fall back to plan defaults
      const dbLimits = {
        products: tenant.max_products,
        users: tenant.max_users,
        orders: tenant.max_orders_monthly,
      }

      let limit = dbLimits[resource]

      // If DB value is null/undefined/0, use plan defaults
      if (limit === null || limit === undefined) {
        limit = DEFAULT_LIMITS[resource]?.[plan] ?? -1
      }

      // -1 or Infinity means unlimited
      if (limit === -1 || limit === Infinity || limit === 'unlimited') {
        return next()
      }

      // Ensure limit is a number
      limit = Number(limit)
      if (isNaN(limit) || limit <= 0) {
        return next()
      }

      // Count existing records
      const { count, error: countErr } = await supabase
        .from(resource)
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', req.user.tenantId)

      if (countErr) {
        console.error(`[Limits] Count query failed for ${resource}:`, countErr.message)
        // On count error, allow the request (fail open)
        return next()
      }

      const current = count || 0

      if (current >= limit) {
        console.log(`[Limits] BLOCKED: Tenant ${req.user.tenantId} hit ${resource} limit: ${current}/${limit} (${plan})`)
        return res.status(403).json({
          error: `${resource} limit reached for ${plan} plan`,
          limit,
          current,
          upgradeRequired: true,
        })
      }

      // Warn when close to limit (90%)
      if (current >= limit * 0.9) {
        console.log(`[Limits] WARNING: Tenant ${req.user.tenantId} ${resource} at ${current}/${limit} (${plan})`)
        res.setHeader('X-Plan-Limit-Warning', `${resource}: ${current}/${limit}`)
      }

      next()
    } catch (err) {
      console.error(`[Limits] Fatal error checking ${resource} limits:`, err.message)
      // On fatal error, allow the request (fail open) but log it
      return next()
    }
  }
}
