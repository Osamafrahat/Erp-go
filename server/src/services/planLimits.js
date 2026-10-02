// Single source of truth for subscription plan limits.
//
// Every consumer derives its numbers from here: enforcement
// (middleware/limits.js), the billing usage display (routes/billing.js),
// the usage endpoint (routes/tenant.js), payment upgrades
// (routes/paymob.js, routes/billing.js) and trial expiry
// (services/subscriptionExpiry.js).
//
// These previously existed as five independent hard-coded tables that had
// drifted apart. The worst divergence: the usage display told free tenants
// their orders were unlimited while the middleware blocked them at 100.

/** Sentinel meaning "no cap". Stored in the tenants.max_* columns as-is. */
export const UNLIMITED = -1

/**
 * Per-plan caps, keyed by subscription tier then by resource.
 * -1 means unlimited.
 */
export const PLAN_LIMITS = {
  free: { products: 50, users: 2, orders: 100, services: 10 },
  pro: { products: 500, users: 15, orders: UNLIMITED, services: 100 },
  enterprise: {
    products: UNLIMITED,
    users: UNLIMITED,
    orders: UNLIMITED,
    services: UNLIMITED,
  },
}

/**
 * Resources whose counter resets at the start of every calendar month.
 * Anything else is a cumulative cap over the tenant's lifetime.
 */
export const MONTHLY_RESOURCES = new Set(['orders'])

/** tenants.* columns holding the per-tenant override, keyed by resource. */
export const DB_LIMIT_COLUMNS = {
  products: 'max_products',
  users: 'max_users',
  orders: 'max_orders_monthly',
}

/** Plan limits for an unknown tier fall back to free. */
export function getPlanLimits(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free
}

/**
 * Plan default for a resource. Resources with no configured cap (for
 * example employees) resolve to UNLIMITED rather than throwing, so a
 * missing entry can never lock a tenant out.
 */
export function getPlanLimit(resource, plan) {
  const limit = getPlanLimits(plan)[resource]
  return limit === undefined ? UNLIMITED : limit
}

/** True when a value means "no cap". Note: null/undefined are NOT unlimited —
 *  they mean "unset, use the plan default" (see resolveLimit). */
export function isUnlimited(value) {
  return value === UNLIMITED || value === Infinity || value === 'unlimited'
}

/**
 * Effective cap for a resource: a per-tenant DB override wins when present,
 * otherwise the plan default applies. Handles the null columns that every
 * freshly-created tenant starts with.
 */
export function resolveLimit(resource, plan, dbValue) {
  if (dbValue !== null && dbValue !== undefined && dbValue !== '') {
    return dbValue
  }
  return getPlanLimit(resource, plan)
}

/**
 * The tenants.* column values to write when applying a plan's entitlements.
 * Always writes UNLIMITED (-1), never Infinity — Infinity is not a valid
 * NUMERIC and serialises to null over JSON.
 */
export function planEntitlements(plan) {
  const limits = getPlanLimits(plan)
  return {
    max_products: limits.products,
    max_users: limits.users,
    max_orders_monthly: limits.orders,
  }
}

/**
 * ISO timestamp for the first instant of the current calendar month, in the
 * server's local timezone.
 *
 * Enforcement and every usage counter must share this exact calculation so
 * the number shown to a tenant can never disagree with the number that
 * blocks them.
 */
export function currentMonthStartIso(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}
