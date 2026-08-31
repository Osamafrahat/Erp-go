import { openDB } from 'idb'

const DB_NAME = 'store-management-offline'
const DB_VERSION = 1

let dbPromise = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Products cache
        if (!db.objectStoreNames.contains('products')) {
          const productStore = db.createObjectStore('products', { keyPath: 'id' })
          productStore.createIndex('category_id', 'category_id')
          productStore.createIndex('barcode', 'barcode')
          productStore.createIndex('sku', 'sku')
        }
        // Categories cache
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' })
        }
        // Customers cache
        if (!db.objectStoreNames.contains('customers')) {
          const customerStore = db.createObjectStore('customers', { keyPath: 'id' })
          customerStore.createIndex('phone', 'phone')
        }
        // Settings cache
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' })
        }
        // Services cache
        if (!db.objectStoreNames.contains('services')) {
          db.createObjectStore('services', { keyPath: 'id' })
        }
        // Plans cache
        if (!db.objectStoreNames.contains('plans')) {
          db.createObjectStore('plans', { keyPath: 'id' })
        }
        // Pending orders (offline queue)
        if (!db.objectStoreNames.contains('pendingOrders')) {
          const orderStore = db.createObjectStore('pendingOrders', { keyPath: 'client_order_id' })
          orderStore.createIndex('status', 'status')
          orderStore.createIndex('created_at', 'created_at')
        }
        // Sync metadata
        if (!db.objectStoreNames.contains('syncMeta')) {
          db.createObjectStore('syncMeta', { keyPath: 'key' })
        }
      },
    })
  }
  return dbPromise
}

// --- Products ---
export async function cacheProducts(products) {
  const db = await getDB()
  const tx = db.transaction('products', 'readwrite')
  await tx.store.clear()
  for (const product of products) {
    await tx.store.put(product)
  }
  await tx.done
}

export async function getCachedProducts() {
  const db = await getDB()
  return db.getAll('products')
}

export async function updateCachedProduct(productId, updates) {
  const db = await getDB()
  const product = await db.get('products', productId)
  if (product) {
    await db.put('products', { ...product, ...updates })
  }
}

// --- Categories ---
export async function cacheCategories(categories) {
  const db = await getDB()
  const tx = db.transaction('categories', 'readwrite')
  await tx.store.clear()
  for (const cat of categories) {
    await tx.store.put(cat)
  }
  await tx.done
}

export async function getCachedCategories() {
  const db = await getDB()
  return db.getAll('categories')
}

// --- Customers ---
export async function cacheCustomers(customers) {
  const db = await getDB()
  const tx = db.transaction('customers', 'readwrite')
  await tx.store.clear()
  for (const c of customers) {
    await tx.store.put(c)
  }
  await tx.done
}

export async function getCachedCustomers() {
  const db = await getDB()
  return db.getAll('customers')
}

// --- Settings ---
export async function cacheSettings(settings) {
  const db = await getDB()
  const tx = db.transaction('settings', 'readwrite')
  for (const [key, value] of Object.entries(settings)) {
    await tx.store.put({ key, value })
  }
  await tx.done
}

export async function getCachedSettings() {
  const db = await getDB()
  const all = await db.getAll('settings')
  const result = {}
  for (const item of all) {
    result[item.key] = item.value
  }
  return result
}

// --- Services ---
export async function cacheServices(services) {
  const db = await getDB()
  const tx = db.transaction('services', 'readwrite')
  await tx.store.clear()
  for (const s of services) {
    await tx.store.put(s)
  }
  await tx.done
}

export async function getCachedServices() {
  const db = await getDB()
  return db.getAll('services')
}

// --- Plans ---
export async function cachePlans(plans) {
  const db = await getDB()
  const tx = db.transaction('plans', 'readwrite')
  await tx.store.clear()
  for (const p of plans) {
    await tx.store.put(p)
  }
  await tx.done
}

export async function getCachedPlans() {
  const db = await getDB()
  return db.getAll('plans')
}

// --- Pending Orders (Offline Queue) ---
export async function addPendingOrder(order) {
  const db = await getDB()
  await db.put('pendingOrders', {
    ...order,
    status: 'pending',
    created_at: order.created_at || new Date().toISOString(),
    synced_at: null,
    error: null,
  })
}

export async function getPendingOrders() {
  const db = await getDB()
  return db.getAll('pendingOrders')
}

export async function getPendingOrderCount() {
  const db = await getDB()
  const all = await db.getAll('pendingOrders')
  return all.filter(o => o.status === 'pending').length
}

export async function markOrderSynced(clientOrderId, serverOrderId) {
  const db = await getDB()
  const order = await db.get('pendingOrders', clientOrderId)
  if (order) {
    await db.put('pendingOrders', {
      ...order,
      status: 'synced',
      server_order_id: serverOrderId,
      synced_at: new Date().toISOString(),
    })
  }
}

export async function markOrderFailed(clientOrderId, error) {
  const db = await getDB()
  const order = await db.get('pendingOrders', clientOrderId)
  if (order) {
    await db.put('pendingOrders', {
      ...order,
      status: 'failed',
      error: typeof error === 'string' ? error : error.message || 'Unknown error',
    })
  }
}

export async function clearSyncedOrders() {
  const db = await getDB()
  const tx = db.transaction('pendingOrders', 'readwrite')
  const all = await tx.store.getAll()
  for (const order of all) {
    if (order.status === 'synced') {
      await tx.store.delete(order.client_order_id)
    }
  }
  await tx.done
}

export async function retryPendingOrders() {
  const db = await getDB()
  const tx = db.transaction('pendingOrders', 'readwrite')
  const all = await tx.store.getAll()
  for (const order of all) {
    if (order.status === 'failed') {
      await tx.store.put({ ...order, status: 'pending', error: null })
    }
  }
  await tx.done
}

// --- Sync Metadata ---
export async function setSyncMeta(key, value) {
  const db = await getDB()
  await db.put('syncMeta', { key, value })
}

export async function getSyncMeta(key) {
  const db = await getDB()
  const item = await db.get('syncMeta', key)
  return item?.value ?? null
}

export async function getLastSyncTime() {
  return getSyncMeta('lastSyncTime')
}

export async function setLastSyncTime() {
  return setSyncMeta('lastSyncTime', new Date().toISOString())
}
