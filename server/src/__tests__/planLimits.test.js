import { describe, it, expect } from '@jest/globals'
import {
  MONTHLY_RESOURCES,
  PLAN_LIMITS,
  UNLIMITED,
  currentMonthStartIso,
  getPlanLimit,
  isUnlimited,
  planEntitlements,
  resolveLimit,
} from '../services/planLimits.js'

describe('resolveLimit', () => {
  it('falls back to the plan default when the tenant column is null (the "∞" bug)', () => {
    // Regression: tenants are created with no max_* columns, and the billing
    // response passed that null straight through. The client rendered -1 as an
    // unlimited "∞" bar while this same tenant was blocked at 100.
    expect(resolveLimit('orders', 'free', null)).toBe(100)
    expect(resolveLimit('products', 'free', null)).toBe(50)
    expect(resolveLimit('users', 'free', null)).toBe(2)
  })

  it('prefers an explicit per-tenant override over the plan default', () => {
    expect(resolveLimit('orders', 'free', 25)).toBe(25)
    expect(resolveLimit('orders', 'pro', 7)).toBe(7)
  })

  it('treats an empty string as unset', () => {
    expect(resolveLimit('orders', 'free', '')).toBe(100)
  })

  it('keeps a legitimate 0 override rather than silently substituting the plan default', () => {
    // 0 is a value the caller set, not a missing column.
    expect(resolveLimit('orders', 'free', 0)).toBe(0)
  })
})

describe('isUnlimited', () => {
  it('accepts every "no cap" sentinel in use', () => {
    expect(isUnlimited(-1)).toBe(true)
    expect(isUnlimited(Infinity)).toBe(true)
    expect(isUnlimited('unlimited')).toBe(true)
  })

  it('does not treat null as unlimited — null means "unset"', () => {
    // If null counted as unlimited, a fresh free tenant would skip the check
    // entirely instead of falling back to its plan default.
    expect(isUnlimited(null)).toBe(false)
    expect(isUnlimited(undefined)).toBe(false)
    expect(isUnlimited(0)).toBe(false)
  })
})

describe('planEntitlements', () => {
  it('never writes Infinity, which JSON serialises to null', () => {
    // The Stripe webhook previously wrote Infinity; over JSON that became
    // null in the database, leaving entitlements unset.
    const serialized = JSON.parse(JSON.stringify(planEntitlements('enterprise')))
    expect(serialized).toEqual({
      max_products: UNLIMITED,
      max_users: UNLIMITED,
      max_orders_monthly: UNLIMITED,
    })
    for (const value of Object.values(serialized)) {
      expect(value).not.toBeNull()
      expect(Number.isFinite(value)).toBe(true)
    }
  })

  it('matches the plan table exactly, so no consumer can drift', () => {
    expect(planEntitlements('free')).toEqual({
      max_products: PLAN_LIMITS.free.products,
      max_users: PLAN_LIMITS.free.users,
      max_orders_monthly: PLAN_LIMITS.free.orders,
    })
    expect(planEntitlements('pro')).toEqual({
      max_products: PLAN_LIMITS.pro.products,
      max_users: PLAN_LIMITS.pro.users,
      max_orders_monthly: PLAN_LIMITS.pro.orders,
    })
  })

  it('falls back to free for an unknown tier', () => {
    expect(planEntitlements('nonsense')).toEqual(planEntitlements('free'))
  })
})

describe('getPlanLimit', () => {
  it('resolves resources with no configured cap to unlimited instead of throwing', () => {
    // employees.js imports the limiter but has no cap configured; a missing
    // entry must never lock a tenant out.
    expect(getPlanLimit('employees', 'free')).toBe(UNLIMITED)
  })
})

describe('MONTHLY_RESOURCES', () => {
  it('resets orders each month but counts products and users cumulatively', () => {
    expect(MONTHLY_RESOURCES.has('orders')).toBe(true)
    expect(MONTHLY_RESOURCES.has('products')).toBe(false)
    expect(MONTHLY_RESOURCES.has('users')).toBe(false)
    expect(MONTHLY_RESOURCES.has('services')).toBe(false)
  })
})

describe('currentMonthStartIso', () => {
  it('is the first instant of the current calendar month', () => {
    const start = new Date(currentMonthStartIso(new Date(2026, 9, 17, 14, 30)))
    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(9) // October, 0-indexed
    expect(start.getDate()).toBe(1)
    expect(start.getHours()).toBe(0)
  })

  it('bounds the local month: last December instant excluded, late January included', () => {
    // Both sides are built in local time on purpose — comparing against UTC
    // literals would break in any non-UTC timezone, since local Jan 1
    // 00:00:00 is still Dec 31 in UTC.
    const start = new Date(currentMonthStartIso(new Date(2026, 0, 31)))

    const lastMomentOfPrevYear = new Date(2025, 11, 31, 23, 59, 59)
    const lateInJanuary = new Date(2026, 0, 31, 23, 59, 59)

    expect(lastMomentOfPrevYear < start).toBe(true)
    expect(lateInJanuary >= start).toBe(true)
  })
})
