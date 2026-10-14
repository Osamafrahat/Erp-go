import { describe, it, expect, beforeEach, vi } from 'vitest'

// The store talks to the API and (on switch) the offline product cache;
// neither belongs in these unit tests.
vi.mock('../lib/api', () => ({
  branchesApi: { getAll: vi.fn() },
  authApi: { login: vi.fn(), logout: vi.fn().mockResolvedValue({}) },
  usersApi: {},
}))
vi.mock('../lib/offlineDB', () => ({
  clearCachedProducts: vi.fn().mockResolvedValue(undefined),
}))

const KEY = 'erp-selected-branch'

// branchHeader hydrates its in-memory value from localStorage at module
// scope, so every test gets a fresh module graph AFTER seeding storage.
async function freshModules() {
  vi.resetModules()
  const { useBranchStore } = await import('../stores/branchStore')
  const { getBranchHeader, setBranchHeader } = await import('../lib/branchHeader')
  const { branchesApi } = await import('../lib/api')
  return { useBranchStore, getBranchHeader, setBranchHeader, branchesApi }
}

describe('branchStore', () => {
  beforeEach(() => {
    localStorage.removeItem(KEY)
  })

  it('shows the server-resolved branch even when another session persisted a different one', async () => {
    // A manager used this browser and left branch 2 selected; a cashier
    // pinned to branch 1 now logs in. The server ignores the stale header
    // for pinned roles and reports effective_branch_id=1 — the UI must show
    // THAT, not the previous user's "last login branch".
    localStorage.setItem(KEY, '2')
    const { useBranchStore, getBranchHeader, branchesApi } = await freshModules()
    branchesApi.getAll.mockResolvedValue({
      data: {
        data: [
          { id: 1, name: 'Main Branch', is_active: true },
          { id: 2, name: 'Second Branch', is_active: true },
        ],
        effective_branch_id: 1,
      },
    })

    await useBranchStore.getState().loadBranches()

    expect(useBranchStore.getState().currentBranchId).toBe(1)
    expect(getBranchHeader()).toBe(1)
    expect(localStorage.getItem(KEY)).toBe('1')
  })

  it('keeps a valid local selection when the server reports no effective branch', async () => {
    localStorage.setItem(KEY, '2')
    const { useBranchStore, branchesApi } = await freshModules()
    branchesApi.getAll.mockResolvedValue({
      data: {
        data: [
          { id: 1, name: 'Main Branch', is_active: true },
          { id: 2, name: 'Second Branch', is_active: true },
        ],
        effective_branch_id: null,
      },
    })

    await useBranchStore.getState().loadBranches()

    expect(useBranchStore.getState().currentBranchId).toBe(2)
  })

  it('clears a local selection that no longer names an active branch', async () => {
    localStorage.setItem(KEY, '99')
    const { useBranchStore, getBranchHeader, branchesApi } = await freshModules()
    branchesApi.getAll.mockResolvedValue({
      data: { data: [{ id: 1, name: 'Main Branch', is_active: true }], effective_branch_id: null },
    })

    await useBranchStore.getState().loadBranches()

    expect(useBranchStore.getState().currentBranchId).toBeNull()
    expect(getBranchHeader()).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('resetSession wipes the persisted selection, header and loaded list', async () => {
    localStorage.setItem(KEY, '2')
    const { useBranchStore, getBranchHeader } = await freshModules()

    useBranchStore.getState().resetSession()

    expect(localStorage.getItem(KEY)).toBeNull()
    expect(getBranchHeader()).toBeNull()
    expect(useBranchStore.getState().currentBranchId).toBeNull()
    expect(useBranchStore.getState().branches).toEqual([])
    expect(useBranchStore.getState().loaded).toBe(false)
  })

  it('logout clears the branch selection so the next login starts clean', async () => {
    localStorage.setItem(KEY, '2')
    vi.resetModules()
    const { useUserStore } = await import('../stores/userStore')
    const { getBranchHeader } = await import('../lib/branchHeader')

    useUserStore.getState().logout()

    expect(localStorage.getItem(KEY)).toBeNull()
    expect(getBranchHeader()).toBeNull()
  })
})
