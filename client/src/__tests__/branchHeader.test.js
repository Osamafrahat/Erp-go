import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getBranchHeader, setBranchHeader } from '../lib/branchHeader'

// branchHeader.js hydrates its in-memory value from
// localStorage('erp-selected-branch') at module scope; vitest modules are
// re-imported per file, so seeding storage BEFORE a dynamic import gives a
// fresh hydration for the persistence case.
describe('branchHeader', () => {
  beforeEach(() => {
    localStorage.removeItem('erp-selected-branch')
  })

  it('starts empty when nothing is persisted', () => {
    expect(getBranchHeader()).toBeNull()
  })

  it('sets and returns the selected branch id as a number', () => {
    setBranchHeader(42)
    expect(getBranchHeader()).toBe(42)
    setBranchHeader('7')
    expect(getBranchHeader()).toBe(7)
  })

  it('clears the header for null/empty/garbage values', () => {
    setBranchHeader(42)
    setBranchHeader(null)
    expect(getBranchHeader()).toBeNull()
    setBranchHeader('')
    expect(getBranchHeader()).toBeNull()
    setBranchHeader('not-a-number')
    expect(getBranchHeader()).toBeNull()
  })

  it('hydrates from localStorage on module load', async () => {
    localStorage.setItem('erp-selected-branch', '13')
    vi.resetModules()
    const fresh = await import('../lib/branchHeader')
    expect(fresh.getBranchHeader()).toBe(13)
    localStorage.removeItem('erp-selected-branch')
  })
})
