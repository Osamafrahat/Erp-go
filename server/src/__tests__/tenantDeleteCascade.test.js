// tenant delete cascade completeness.
//
// DELETE /api/super-admin/tenants/:id hand-deletes 40+ tables in FK-safe
// order because the Supabase client can't express multi-table cascades.
// Production has now proved three tenant-owned failure modes:
//   - stock_transfers (stock_transfer_items.product_id -> products is
//     NO ACTION, and items carry no tenant_id; items.transfer_id ->
//     stock_transfers IS cascade, so deleting transfers by tenant first
//     clears both the products and the created_by -> users blockers)
//   - fiscal_periods (closed_by -> users is NO ACTION and nothing else
//     ever deletes the table; rows outlive the users delete)
//   - journal_entry_lines filtered on a guessed FK column name
//     (journal_entry_id) that does not exist - the real parent column is
//     entry_id - so the delete 400'd and every tenant with journal data
//     reported a phantom "incomplete" delete even though the cascades
//     cleaned the rows anyway. Lines are now deleted by tenant_id, the
//     column accountingEngine sets on every insert.
// The missing or wrong deletes returned 500 on every tenant delete once
// any transfer, closed period or journal entry existed. These tests read
// the route source and pin the fixes so the cascade cannot silently
// shrink again.

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

  it('deletes journal_entry_lines by tenant_id, never by a guessed FK column', () => {
    // The parent column is entry_id (see accountingEngine inserts);
    // journal_entry_id never existed and made this delete 400 in prod.
    expect(source).toContain("safeDel('journal_entry_lines', `tenant_id = ${tid}`)")
    expect(source).not.toContain('journal_entry_id')
  })

  it('deletes journal_entry_lines before the tables their FKs block', () => {
    // lines.account_id -> accounts is NO ACTION; lines.entry_id ->
    // journal_entries cascades but the explicit delete must still run first.
    const lines = cascade.indexOf('journal_entry_lines')
    expect(lines).toBeLessThan(cascade.indexOf('accounts'))
    expect(lines).toBeLessThan(cascade.indexOf('journal_entries'))
  })

  it('still deletes the whole tenant last', () => {
    expect(cascade[cascade.length - 1]).toBe('tenants')
  })
})
