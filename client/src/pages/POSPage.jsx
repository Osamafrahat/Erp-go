import { useState, useEffect, useRef, useMemo } from 'react'
import { useProductStore } from '../stores/productStore'
import { useCartStore } from '../stores/cartStore'
import { useAppStore } from '../stores/appStore'
import { useUserStore } from '../stores/userStore'
import { useOfflineStore } from '../stores/offlineStore'
import { productsApi, categoriesApi, ordersApi, customersApi, servicesApi, servicePlansApi, subscriptionsApi } from '../lib/api'
import { formatCurrency, generateOrderNumber } from '../lib/utils'
import ProductGrid from '../components/pos/ProductGrid'
import Cart from '../components/pos/Cart'
import PaymentModal from '../components/pos/PaymentModal'
import BarcodeScanner from '../components/pos/BarcodeScanner'
import ReceiptModal from '../components/pos/ReceiptModal'
import { Search, Zap, User, Wrench, CreditCard, WifiOff } from 'lucide-react'

export default function POSPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [showPayment, setShowPayment] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [lastOrder, setLastOrder] = useState(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [customers, setCustomers] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [services, setServices] = useState([])
  const [plans, setPlans] = useState([])
  const [activeTab, setActiveTab] = useState('products')
  const searchInputRef = useRef(null)
  const barcodeInputRef = useRef(null)
  const barcodeTimeoutRef = useRef(null)

  const { products, categories, setProducts, setCategories, setLoading, setError } = useProductStore()
  const { addItem, items, getTotal } = useCartStore()
  const { settings, t, toastSuccess, toastError } = useAppStore()
  const { currentUser } = useUserStore()
  const { isOnline, cacheData, loadCachedData, queueOrder } = useOfflineStore()

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  useEffect(() => {
    const focusBarcode = (e) => {
      if (showPayment || showReceipt) return
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return
      barcodeInputRef.current?.focus()
    }
    document.addEventListener('click', focusBarcode)
    return () => document.removeEventListener('click', focusBarcode)
  }, [showPayment, showReceipt])

  const handleBarcodeInput = (e) => {
    const value = e.target.value
    if (barcodeTimeoutRef.current) clearTimeout(barcodeTimeoutRef.current)
    barcodeTimeoutRef.current = setTimeout(async () => {
      if (value.trim()) {
        await handleBarcodeScan(value.trim())
        if (barcodeInputRef.current) barcodeInputRef.current.value = ''
      }
    }, 150)
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const cached = await loadCachedData()
      if (cached.products.length > 0) {
        setProducts(cached.products)
        setCategories(cached.categories)
        setCustomers(cached.customers)
        if (cached.services?.length) setServices(cached.services)
        if (cached.plans?.length) setPlans(cached.plans)
        setLoading(false)
      }

      if (navigator.onLine) {
        try {
          const [productsRes, categoriesRes, customersRes, servicesRes, plansRes] = await Promise.all([
            productsApi.getAll(),
            categoriesApi.getAll(),
            customersApi.getAll(),
            servicesApi.getAll(),
            servicePlansApi.getAll(),
          ])
          const productsData = productsRes.data?.data || productsRes.data || []
          setProducts(productsData)
          setCategories(categoriesRes.data)
          setCustomers(customersRes.data)
          const servicesData = (servicesRes.data || []).filter(s => s.is_active !== false).map(s => ({ ...s, _type: 'service' }))
          setServices(servicesData)
          const plansData = (plansRes.data || []).filter(p => p.is_active !== false).map(p => ({ ...p, _type: 'subscription' }))
          setPlans(plansData)

          await cacheData({
            products: productsData,
            categories: categoriesRes.data,
            customers: customersRes.data,
            services: servicesData,
            plans: plansData,
            settings: { taxRate: settings.taxRate, storeName: settings.storeName, currency: settings.currency },
          })
        } catch (err) {
          console.error('Background fetch failed, using cache:', err)
        }
      } else if (cached.products.length === 0) {
        setError('No offline data available. Please connect to the internet first.')
      }
    } catch (err) {
      console.error('Failed to load data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    setSearchQuery(e.target.value)
  }

  const handleBarcodeScan = async (barcode) => {
    if (navigator.onLine) {
      try {
        const response = await productsApi.getByBarcode(barcode)
        if (response.data) {
          const added = addItem(response.data)
          if (!added) {
            if (response.data.stock_quantity <= 0) {
              toastError(t('pos.outOfStock') || 'Out of stock')
            } else {
              toastError(`${t('pos.insufficientStock') || 'Insufficient stock'} (${t('inventory.inStock')}: ${response.data.stock_quantity})`)
            }
          }
          return response.data.name
        }
      } catch (err) {
        console.error('Product not found online:', barcode, err)
      }
    }
    const localProduct = products.find(p => p.barcode === barcode)
    if (localProduct) {
      const added = addItem(localProduct)
      if (!added) {
        if (localProduct.stock_quantity <= 0) {
          toastError(t('pos.outOfStock') || 'Out of stock')
        } else {
          toastError(`${t('pos.insufficientStock') || 'Insufficient stock'} (${t('inventory.inStock')}: ${localProduct.stock_quantity})`)
        }
      }
      return localProduct.name
    }
    console.error('Product not found:', barcode)
    return null
  }

  const handleQuickSale = async (product, quantity = 1) => {
    const added = addItem(product, quantity)
    if (!added) {
      if (product.stock_quantity <= 0) {
        toastError(t('pos.outOfStock') || 'Out of stock')
      } else {
        toastError(`${t('pos.insufficientStock') || 'Insufficient stock'} (${t('inventory.inStock')}: ${product.stock_quantity})`)
      }
    }
  }

  const filteredProducts = useMemo(() => products.filter(p => {
    if (!p.is_active) return false
    if (selectedCategory && p.category_id !== selectedCategory) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        p.name.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query) ||
        p.barcode?.includes(searchQuery)
      )
    }
    return true
  }), [products, selectedCategory, searchQuery])

  const filteredServices = useMemo(() => services.filter(s => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        s.name.toLowerCase().includes(query) ||
        s.name_ar?.toLowerCase().includes(query)
      )
    }
    return true
  }), [services, searchQuery])

  const filteredPlans = useMemo(() => plans.filter(p => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        p.name.toLowerCase().includes(query) ||
        p.name_ar?.toLowerCase().includes(query)
      )
    }
    return true
  }), [plans, searchQuery])

  const filteredCustomers = useMemo(() => customers.filter(c => {
    if (!customerSearch) return true
    const query = customerSearch.toLowerCase()
    return c.name?.toLowerCase().includes(query) || c.phone?.includes(query)
  }), [customers, customerSearch])

  const displayItems = activeTab === 'products' ? filteredProducts : activeTab === 'services' ? filteredServices : filteredPlans

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-6rem)] md:h-[calc(100vh-8rem)] gap-3 md:gap-4 overflow-hidden">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white text-sm font-medium rounded-xl shrink-0">
          <WifiOff className="w-4 h-4" />
          {t('offline.offline') || 'You are offline'} — {t('offline.ordersWillBeQueued') || 'Orders will be saved and synced when connected'}
        </div>
      )}

      {/* Left side - Products/Services */}
      <div className="flex-1 min-w-0 flex flex-col gap-2 md:gap-4 overflow-y-auto">
        {/* Search and Filters */}
        <div className="flex gap-2 md:gap-3">
          <div className="flex-1 relative min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={t('pos.search')}
              value={searchQuery}
              onChange={handleSearch}
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowScanner(true)}
            className="px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2 shrink-0"
          >
            <Zap className="w-5 h-5" />
            <span className="hidden sm:inline">{t('pos.scan')}</span>
          </button>
        </div>

        {/* Products / Services / Subscriptions Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mb-1">
          <button
            onClick={() => setActiveTab('products')}
            className={`px-3 md:px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'products'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {t('pos.allProducts')}
          </button>
          <button
            onClick={() => setActiveTab('services')}
            className={`px-3 md:px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'services'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Wrench className="w-4 h-4" />
            {t('pos.services') || 'Services'}
          </button>
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`px-3 md:px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'subscriptions'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            {t('pos.subscriptions') || 'Subscriptions'}
          </button>
        </div>

        {/* Category Filter (only for products) */}
        {activeTab === 'products' && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory(null)}
                className={`px-3 md:px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  !selectedCategory
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t('pos.allProducts')}
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-3 md:px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        )}

        {/* Product/Service Grid */}
        <ProductGrid
          products={displayItems}
          onAddToCart={handleQuickSale}
        />
      </div>

      {/* Right side - Cart */}
      <div className="w-full md:w-80 xl:w-96 flex-shrink-0 flex flex-col gap-2 md:gap-3 min-w-0 overflow-y-auto md:overflow-y-auto border-t md:border-t-0 pt-3 md:pt-0">
        {/* Customer Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('pos.selectCustomer')}</span>
          </div>
          {selectedCustomer ? (
            <div className="flex items-center justify-between bg-primary-50 dark:bg-primary-900/20 rounded-lg p-2">
              <div>
                <p className="font-medium text-sm">{selectedCustomer.name}</p>
                <p className="text-xs text-gray-500">{selectedCustomer.phone || ''} | {selectedCustomer.loyalty_points || 0} pts</p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-gray-400 hover:text-red-500 text-sm"
              >
                {t('pos.remove')}
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                placeholder={t('pos.searchCustomer')}
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              />
              {customerSearch && filteredCustomers.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-40 overflow-auto">
                  {filteredCustomers.slice(0, 5).map(customer => (
                    <button
                      key={customer.id}
                      onClick={() => {
                        setSelectedCustomer(customer)
                        setCustomerSearch('')
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-xs text-gray-500">{customer.phone || ''}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Barcode Scanner Input */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <input
            ref={barcodeInputRef}
            type="text"
            onChange={handleBarcodeInput}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                const value = barcodeInputRef.current?.value?.trim()
                if (value) {
                  handleBarcodeScan(value)
                  barcodeInputRef.current.value = ''
                }
              }
            }}
            placeholder={t('pos.scanBarcode') || 'Scan barcode here...'}
            className="w-full px-3 py-2 text-sm rounded-lg border-2 border-dashed border-primary-300 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-900/20 focus:ring-2 focus:ring-primary-500 focus:border-solid"
            autoComplete="off"
          />
        </div>

        <div className="flex-1">
          <Cart onCheckout={() => setShowPayment(true)} />
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <PaymentModal
          onClose={() => setShowPayment(false)}
          isSubmitting={isSubmitting}
          onComplete={async (paymentData) => {
            if (isSubmitting) return
            setIsSubmitting(true)
            try {
              const productItems = items.filter(i => i.product._type !== 'service' && i.product._type !== 'subscription')
              const serviceItems = items.filter(i => i.product._type === 'service')
              const subscriptionItems = items.filter(i => i.product._type === 'subscription')

              // Validate customer required for subscriptions
              if (subscriptionItems.length > 0 && !selectedCustomer) {
                toastError(t('pos.customerRequiredForSubscription') || 'Customer is required for subscriptions')
                setIsSubmitting(false)
                return
              }

              // Create subscriptions from plan items
              for (const item of subscriptionItems) {
                try {
                  if (navigator.onLine) {
                    await subscriptionsApi.quickCreate({
                      customer_id: selectedCustomer.id,
                      plan_id: item.product.id,
                      payment_method: paymentData.method,
                      notes: `POS sale - ${item.product.name}`,
                    })
                  } else {
                    // Queue subscription for sync when back online
                    await queueOrder({
                      _type: 'subscription',
                      customer_id: selectedCustomer.id,
                      plan_id: item.product.id,
                      plan_name: item.product.name,
                      payment_method: paymentData.method,
                      total: item.product.price * item.quantity,
                      user_id: currentUser?.id,
                      created_at: new Date().toISOString(),
                    })
                  }
                } catch (subErr) {
                  if (subErr.response?.status === 409) {
                    toastError(t('pos.duplicateSubscription') || 'Customer already has an active subscription for this plan')
                    setIsSubmitting(false)
                    return
                  }
                  throw subErr
                }
              }

              // Build order items for products + services (both are one-time sales)
              // Note: Subscriptions are handled separately via quickCreate and their own journal entries
              const allOrderItems = [
                ...productItems.map(item => ({
                  product_id: item.product.id,
                  product_name: item.product.name,
                  quantity: item.quantity,
                  unit_price: item.product.price,
                  _type: 'product',
                })),
                ...serviceItems.map(item => ({
                  product_name: item.product.name,
                  quantity: item.quantity,
                  unit_price: item.product.price,
                  _type: 'service',
                })),
              ]

              const productSubtotal = productItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)
              const serviceSubtotal = serviceItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)
              const orderSubtotal = productSubtotal + serviceSubtotal

              // Create order if there are products or services (subscriptions are separate)
              if (allOrderItems.length > 0) {
                const orderData = {
                  order_number: generateOrderNumber(),
                  items: allOrderItems,
                  subtotal: orderSubtotal,
                  discount_amount: 0,
                  tax_amount: productSubtotal * ((settings.taxRate || 14) / 100),
                  total: productSubtotal * (1 + (settings.taxRate || 14) / 100) + serviceSubtotal,
                  payment_method: paymentData.method,
                  payment_status: 'paid',
                  payments: paymentData.payments,
                  user_id: currentUser?.id,
                  customer_id: selectedCustomer?.id || null,
                  promotion_id: null,
                  notes: serviceItems.length > 0 ? `Service sale - ${serviceItems.length} service(s)` : null,
                  created_at: new Date().toISOString(),
                }

                if (navigator.onLine) {
                  const clientOrderId = `ONL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
                  const response = await ordersApi.create({ ...orderData, client_order_id: clientOrderId })
                  let completedOrder
                  if (response.data?.id) {
                    const fullOrderRes = await ordersApi.getById(response.data.id)
                    completedOrder = {
                      ...fullOrderRes.data,
                      items: allOrderItems,
                    }
                  } else {
                    completedOrder = {
                      ...orderData,
                      users: currentUser ? { full_name: currentUser.fullName } : null,
                      customers: selectedCustomer ? { name: selectedCustomer.name } : null,
                    }
                  }
                  setLastOrder(completedOrder)
                } else {
                  const clientOrderId = await queueOrder(orderData)
                  toastSuccess(t('offline.orderQueued'))
                  setLastOrder({
                    ...orderData,
                    client_order_id: clientOrderId,
                    offline: true,
                    users: currentUser ? { full_name: currentUser.fullName } : null,
                    customers: selectedCustomer ? { name: selectedCustomer.name } : null,
                  })
                }
              } else {
                // Subscription-only: create a receipt without order
                setLastOrder({
                  order_number: generateOrderNumber(),
                  items: subscriptionItems.map(item => ({
                    product_name: item.product.name,
                    quantity: item.quantity,
                    unit_price: item.product.price,
                    _type: 'subscription',
                  })),
                  total: subscriptionItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0),
                  customers: selectedCustomer ? { name: selectedCustomer.name } : null,
                  users: currentUser ? { full_name: currentUser.fullName } : null,
                  subscription_sale: true,
                })
              }

              if (subscriptionItems.length > 0) {
                toastSuccess(t('pos.subscriptionCreated') || 'Subscription created')
              }
              if (serviceItems.length > 0) {
                toastSuccess(t('pos.serviceSold') || 'Service sold')
              }

              setSelectedCustomer(null)
              useCartStore.getState().clearCart()
              setShowPayment(false)
              setShowReceipt(true)

              if (navigator.onLine) {
                fetchData()
              }
            } catch (err) {
              console.error('Failed to create order:', err)
              toastError(t('common.error') || 'Error')
            } finally {
              setIsSubmitting(false)
            }
          }}
        />
      )}

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Receipt Modal */}
      {showReceipt && lastOrder && (
        <ReceiptModal
          order={lastOrder}
          onClose={() => {
            setShowReceipt(false)
            setLastOrder(null)
          }}
        />
      )}
    </div>
  )
}
