// tenant delete cascade completeness.
//
// DELETE /api/super-admin/tenants/:id hand-deletes 40+ tables in FK-safe
// order because the Supabase client can't express multi-table cascades.
// Production proved two tenant-owned tables were missing from the list:
//   - stock_transfers (stock_transfer_items.product_id -> products is
//     NO ACTION, and items carry no tenant_id; items.transfer_id ->
//     stock_transfers IS cascade, so deleting transfers by tenant first
//     clears both the products and the created_by -> users blockers)
//   - fiscal_periods (closed_by -> users is NO ACTION and nothing else
//     ever deletes the table; rows outlive the users delete)
// The missing tables returned 500 on every tenant delete once any
// transfer or closed period existed. These tests read the route source
// and pin the fix so the cascade cannot silently shrink again.

import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../routes/superAdmin.js', import.meta.url), 'utf8')

// Ordered list of safeDel('table') calls in the delete handler.
const cascade = [...source.matchAll(/safeDel\('([a-z_]+)'/g)].map((m) => m[1])

describe('tenant delete cascade', () => {
  it('deletes stock_transfers before the tables their FKs block', () => {
    expect(cascade).toContain('stock_transfers')
    const transfers = cascade.indexOf('stock_transfers')
    expect(transfers).toBeLessThan(cascade.indexOf('products'))
    expect(transfers).toBeLessThan(cascade.indexOf('users'))
    expect(transfers).toBeLessThan(cascade.indexOf('tenants'))
  })

  it('deletes fiscal_periods before users', () => {
    expect(cascade).toContain('fiscal_periods')
    expect(cascade.indexOf('fiscal_periods')).toBeLessThan(cascade.indexOf('users'))
  })

  it('scopes both new deletes by tenant using the interpolated form', () => {
    // Backtick template literals, not double-quoted strings: a double-quoted
    // "${tid}" passes the literal text and safeDel throws -> 500 for every
    // tenant, not just ones with transfers.
    expect(source).toContain("safeDel('stock_transfers', `tenant_id = ${tid}`)")
    expect(source).toContain("safeDel('fiscal_periods', `tenant_id = ${tid}`)")
  })

  it('still deletes the whole tenant last', () => {
    expect(cascade[cascade.length - 1]).toBe('tenants')
  })
})
