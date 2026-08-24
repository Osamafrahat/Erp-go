import { create } from 'zustand'
import { translations } from '../lib/translations'
import { settingsApi } from '../lib/api'

export const useAppStore = create((set, get) => ({
  // Theme (persisted in localStorage)
  theme: localStorage.getItem('app_theme') || 'light',
  toggleTheme: () => {
    const newTheme = get().theme === 'light' ? 'dark' : 'light'
    localStorage.setItem('app_theme', newTheme)
    set({ theme: newTheme })
  },

  // Language (persisted in localStorage)
  language: localStorage.getItem('app_language') || 'en',
  setLanguage: (language) => {
    localStorage.setItem('app_language', language)
    set({ language })
  },
  t: (key) => {
    const lang = get().language
    return translations[lang]?.[key] || translations.en[key] || key
  },

  // Store settings (loaded from database)
  settings: {
    storeName: 'My Store',
    storeAddress: '',
    storePhone: '',
    storeLogo: '',
    taxRate: 14,
    currency: 'EGP',
    currencySymbol: 'ج.م',
    receiptFooter: 'Thank you for your purchase!',
    lowStockThreshold: 10,
    'attendance.lateGraceMinutes': 5,
    'attendance.enableGeolocation': 'false',
    'attendance.requiredRadiusMeters': 100,
    'attendance.storeLatitude': '30.0444',
    'attendance.storeLongitude': '31.2357',
  },
  settingsLoaded: false,

  loadSettings: async () => {
    try {
      const { data } = await settingsApi.get()
      if (data) {
        set({
          settings: { ...get().settings, ...data },
          settingsLoaded: true,
        })
      }
    } catch (err) {
      console.error('Failed to load settings:', err)
      set({ settingsLoaded: true })
    }
  },

  updateSettings: (newSettings) => set((state) => ({
    settings: { ...state.settings, ...newSettings }
  })),

  // Sidebar state
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  // Toast notifications
  toasts: [],
  addToast: (toast) => {
    const id = Date.now() + Math.random()
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }]
    }))
    return id
  },
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter(t => t.id !== id)
  })),

  // Helper functions for toasts
  toastSuccess: (message, title) => get().addToast({ type: 'success', message, title }),
  toastError: (message, title) => get().addToast({ type: 'error', message, title }),
  toastWarning: (message, title) => get().addToast({ type: 'warning', message, title }),
  toastInfo: (message, title) => get().addToast({ type: 'info', message, title }),

  // Notifications
  notifications: [],
  addNotification: (notification) => set((state) => ({
    notifications: [...state.notifications, { ...notification, id: Date.now() }]
  })),
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),
}))
