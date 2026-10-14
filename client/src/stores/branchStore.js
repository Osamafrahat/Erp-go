import { create } from 'zustand'
import { branchesApi } from '../lib/api'
import { getBranchHeader, setBranchHeader } from '../lib/branchHeader'
import { clearCachedProducts } from '../lib/offlineDB'

// --- Branch-switch cache hygiene -----------------------------------------
// Switching branch must make the reloaded UI show the NEW branch's stock, so
// setBranch() clears the caches that hold a snapshot of the OLD branch:
//   1. localStorage 'cart-storage' — the zustand-persisted POS cart (product
//      rows snapshotted under the previous branch's stock/prices).
//   2. IndexedDB 'store-management-offline' -> object store 'products' — the
//      offline cache POSPage seeds its product list from (loadCachedData()).
//      Note: this lives in IndexedDB, NOT localStorage (POSPage lines 191-201
//      + lib/offlineDB.js). The DB's 'pendingOrders'/'syncMeta' stores are
//      deliberately left untouched — unsynced offline orders must survive.
// Everything else (productStore, page state) is rebuilt by the full reload.
const BRANCH_STORAGE_KEY = 'erp-selected-branch'

async function clearBranchCaches() {
  localStorage.removeItem('cart-storage')
  await clearCachedProducts()
}

export const useBranchStore = create((set, get) => ({
  branches: [],
  // Hydrated from localStorage('erp-selected-branch') by branchHeader.js at
  // module scope, so the x-branch-id header is already right on the first
  // request of a fresh page load.
  currentBranchId: getBranchHeader(),
  loaded: false,
  loading: false,

  // GET /api/branches. Skips the request when the list is already loaded (or
  // a load is in flight) unless `force` is passed — Layout calls this on every
  // mount, BranchesPage forces a refresh after create/edit/archive.
  loadBranches: async (force = false) => {
    const { loaded, loading } = get()
    if (loading || (loaded && !force)) return
    set({ loading: true })
    try {
      const res = await branchesApi.getAll()
      const branches = res.data?.data || []
      const effective = res.data?.effective_branch_id ?? null
      // The server resolves the effective branch from the x-branch-id we
      // sent (switchable roles) or from the user's pinned home branch
      // (everyone else) — so it is the source of truth for what to SHOW.
      // Always adopting it fixes pinned employees on shared browsers: a
      // stale 'erp-selected-branch' left by another user's session must not
      // survive a fresh login. When the server reports nothing
      // (platform/tenant-less session) keep the local value only if it still
      // names an active branch in this list.
      let currentBranchId = effective
      if (currentBranchId == null) {
        const local = get().currentBranchId
        currentBranchId =
          branches.find((b) => b.id === local && b.is_active !== false)?.id ?? null
      }
      // Persist the correction so the next page load starts with a header
      // the server agrees with instead of re-correcting every time.
      if (currentBranchId != null) {
        localStorage.setItem(BRANCH_STORAGE_KEY, String(currentBranchId))
      } else {
        localStorage.removeItem(BRANCH_STORAGE_KEY)
      }
      setBranchHeader(currentBranchId)
      set({ branches, currentBranchId, loaded: true, loading: false })
    } catch (err) {
      console.error('Failed to load branches:', err)
      set({ loading: false })
    }
  },

  // Switch the active branch: persist it, point the x-branch-id header at it,
  // drop the previous branch's cached stock/cart, then do a full reload so
  // every page/store refetches under the new branch. Callers should skip this
  // when the id is already active — it unconditionally reloads on purpose.
  setBranch: async (id) => {
    if (id == null || id === '') return
    localStorage.setItem(BRANCH_STORAGE_KEY, String(id))
    setBranchHeader(id)
    set({ currentBranchId: Number(id) })
    try {
      await clearBranchCaches()
    } catch (err) {
      console.error('Failed to clear branch caches:', err)
    } finally {
      window.location.reload()
    }
  },

  // Drop everything branch-scoped for the CURRENT session: called on logout
  // so a different user logging in on the same browser never inherits the
  // previous user's selected branch (localStorage survives reloads) or the
  // loaded branch list of the old tenant.
  resetSession: () => {
    localStorage.removeItem(BRANCH_STORAGE_KEY)
    setBranchHeader(null)
    set({ branches: [], currentBranchId: null, loaded: false, loading: false })
  },
}))
