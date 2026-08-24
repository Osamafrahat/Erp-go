import { create } from 'zustand'

export const useProductStore = create((set, get) => ({
  products: [],
  categories: [],
  loading: false,
  error: null,

  setProducts: (products) => set({ products }),
  setCategories: (categories) => set({ categories }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  getProductByBarcode: (barcode) => {
    const { products } = get()
    return products.find(p => p.barcode === barcode)
  },

  getProductById: (id) => {
    const { products } = get()
    return products.find(p => p.id === id)
  },

  getProductsByCategory: (categoryId) => {
    const { products } = get()
    if (!categoryId) return products.filter(p => p.is_active)
    return products.filter(p => p.category_id === categoryId && p.is_active)
  },

  searchProducts: (query) => {
    const { products } = get()
    const lowerQuery = query.toLowerCase()
    return products.filter(p =>
      p.is_active && (
        p.name.toLowerCase().includes(lowerQuery) ||
        p.sku?.toLowerCase().includes(lowerQuery) ||
        p.barcode?.includes(query)
      )
    )
  },

  getLowStockProducts: (threshold = 10) => {
    const { products } = get()
    return products.filter(p => p.is_active && p.stock_quantity <= (p.low_stock_threshold || threshold))
  },
}))
