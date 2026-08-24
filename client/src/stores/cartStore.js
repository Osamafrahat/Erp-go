import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      promoCode: null,
      promoDiscount: 0,
      promoId: null,

      addItem: (product, quantity = 1) => {
        const state = get()
        const isService = product._type === 'service'
        const existingItem = state.items.find(item => item.product.id === product.id && item.product._type === product._type)
        const currentQty = existingItem ? existingItem.quantity : 0
        const newQty = currentQty + quantity

        // Stock validation (only for products, not services)
        if (!isService) {
          if (product.stock_quantity !== undefined && product.stock_quantity !== null) {
            if (product.stock_quantity <= 0 && !existingItem) {
              return false
            }
            if (newQty > product.stock_quantity) {
              return false
            }
          }
        }

        set((state) => {
          if (existingItem) {
            return {
              items: state.items.map(item =>
                item.product.id === product.id && item.product._type === product._type
                  ? { ...item, quantity: item.quantity + quantity }
                  : item
              )
            }
          }
          return { items: [...state.items, { product, quantity }] }
        })
        return true
      },

      removeItem: (productId, itemType) => set((state) => ({
        items: state.items.filter(item => !(item.product.id === productId && item.product._type === itemType))
      })),

      updateQuantity: (productId, quantity, itemType) => {
        if (quantity <= 0) {
          set((state) => ({
            items: state.items.filter(item => !(item.product.id === productId && item.product._type === itemType))
          }))
          return true
        }

        const state = get()
        const item = state.items.find(i => i.product.id === productId && i.product._type === itemType)
        if (!item) return false

        // Stock validation (only for products)
        if (item.product._type !== 'service') {
          const stock = item.product.stock_quantity
          if (stock !== undefined && stock !== null && quantity > stock) {
            return false
          }
        }

        set((state) => ({
          items: state.items.map(i =>
            i.product.id === productId && i.product._type === itemType ? { ...i, quantity } : i
          )
        }))
        return true
      },

      clearCart: () => set({ items: [], promoCode: null, promoDiscount: 0, promoId: null }),

      applyPromo: (code, discount, id) => set({ promoCode: code, promoDiscount: discount, promoId: id || null }),
      removePromo: () => set({ promoCode: null, promoDiscount: 0, promoId: null }),

      getSubtotal: () => {
        const { items } = get()
        return items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)
      },

      getProductSubtotal: () => {
        const { items } = get()
        return items.filter(item => item.product._type !== 'service' && item.product._type !== 'subscription').reduce((sum, item) => sum + (item.product.price * item.quantity), 0)
      },

      getNonProductSubtotal: () => {
        const { items } = get()
        return items.filter(item => item.product._type === 'service' || item.product._type === 'subscription').reduce((sum, item) => sum + (item.product.price * item.quantity), 0)
      },

      getServiceSubtotal: () => {
        const { items } = get()
        return items.filter(item => item.product._type === 'service').reduce((sum, item) => sum + (item.product.price * item.quantity), 0)
      },

      getDiscount: () => {
        const { promoDiscount } = get()
        const subtotal = get().getProductSubtotal()
        return subtotal * (promoDiscount / 100)
      },

      getTax: (taxRate = 14) => {
        const productSubtotal = get().getProductSubtotal()
        const discount = get().getDiscount()
        return (productSubtotal - discount) * (taxRate / 100)
      },

      getTotal: (taxRate = 14) => {
        const productSubtotal = get().getProductSubtotal()
        const nonProductSubtotal = get().getNonProductSubtotal()
        const discount = get().getDiscount()
        const tax = get().getTax(taxRate)
        return productSubtotal - discount + tax + nonProductSubtotal
      },

      getItemCount: () => {
        const { items } = get()
        return items.reduce((sum, item) => sum + item.quantity, 0)
      },

      hasServices: () => {
        const { items } = get()
        return items.some(item => item.product._type === 'service')
      },

      getServices: () => {
        const { items } = get()
        return items.filter(item => item.product._type === 'service')
      },

      getProducts: () => {
        const { items } = get()
        return items.filter(item => item.product._type !== 'service')
      },
    }),
    {
      name: 'cart-storage',
    }
  )
)
