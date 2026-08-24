import { create } from 'zustand'
import {
  getPendingOrderCount,
  getLastSyncTime,
  cacheProducts,
  cacheCategories,
  cacheCustomers,
  cacheSettings,
  getCachedProducts,
  getCachedCategories,
  getCachedCustomers,
  setLastSyncTime,
  addPendingOrder,
  getPendingOrders,
  markOrderSynced,
  markOrderFailed,
  retryPendingOrders,
  clearSyncedOrders,
} from '../lib/offlineDB'

export const useOfflineStore = create((set, get) => ({
  isOnline: navigator.onLine,
  pendingCount: 0,
  lastSyncTime: null,
  isSyncing: false,
  syncProgress: { total: 0, done: 0, errors: 0 },

  // Initialize - check online status and load pending count
  init: async () => {
    const count = await getPendingOrderCount()
    const lastSync = await getLastSyncTime()
    set({ pendingCount: count, lastSyncTime: lastSync })

    window.addEventListener('online', () => {
      set({ isOnline: true })
      get().syncPendingOrders()
    })
    window.addEventListener('offline', () => {
      set({ isOnline: false })
    })
  },

  setOnline: (isOnline) => set({ isOnline }),

  // Cache data from API responses
  cacheData: async ({ products, categories, customers, settings }) => {
    try {
      if (products) await cacheProducts(products)
      if (categories) await cacheCategories(categories)
      if (customers) await cacheCustomers(customers)
      if (settings) await cacheSettings(settings)
    } catch (err) {
      console.error('[OfflineDB] Cache error:', err)
    }
  },

  // Load data from IndexedDB cache
  loadCachedData: async () => {
    try {
      const [products, categories, customers] = await Promise.all([
        getCachedProducts(),
        getCachedCategories(),
        getCachedCustomers(),
      ])
      return { products, categories, customers }
    } catch (err) {
      console.error('[OfflineDB] Load cache error:', err)
      return { products: [], categories: [], customers: [] }
    }
  },

  // Add order to offline queue
  queueOrder: async (orderData) => {
    const clientOrderId = orderData.client_order_id || `OFF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const order = { ...orderData, client_order_id: clientOrderId }
    await addPendingOrder(order)
    const count = await getPendingOrderCount()
    set({ pendingCount: count })
    return clientOrderId
  },

  // Sync all pending orders when back online
  syncPendingOrders: async () => {
    const state = get()
    if (state.isSyncing || !state.isOnline) return

    const pending = await getPendingOrders()
    const toSync = pending.filter(o => o.status === 'pending')
    if (toSync.length === 0) return

    set({ isSyncing: true, syncProgress: { total: toSync.length, done: 0, errors: 0 } })

    // Dynamically import to avoid circular dependency
    const { syncOrdersApi } = await import('../lib/api')

    for (const order of toSync) {
      try {
        const response = await syncOrdersApi.sync(order)
        await markOrderSynced(order.client_order_id, response.data?.server_order_id || null)
        const progress = get().syncProgress
        set({ syncProgress: { ...progress, done: progress.done + 1 } })
      } catch (err) {
        console.error('[Sync] Failed:', order.client_order_id, err)
        await markOrderFailed(order.client_order_id, err)
        const progress = get().syncProgress
        set({ syncProgress: { ...progress, done: progress.done + 1, errors: progress.errors + 1 } })
      }
    }

    await setLastSyncTime()
    const count = await getPendingOrderCount()
    const lastSync = await getLastSyncTime()
    set({
      isSyncing: false,
      pendingCount: count,
      lastSyncTime: lastSync,
      syncProgress: { total: 0, done: 0, errors: 0 },
    })
  },

  retryFailed: async () => {
    await retryPendingOrders()
    const count = await getPendingOrderCount()
    set({ pendingCount: count })
    get().syncPendingOrders()
  },

  clearSynced: async () => {
    await clearSyncedOrders()
    const count = await getPendingOrderCount()
    set({ pendingCount: count })
  },
}))
