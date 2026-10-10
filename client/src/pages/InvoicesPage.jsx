import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { ordersApi, etaApi, subscriptionsApi } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import { FileText, Search, Eye, RefreshCcw, CheckCircle, XCircle, Clock, Send, Wrench, DollarSign, Repeat } from 'lucide-react'
import ReceiptModal from '../components/pos/ReceiptModal'

const STATUS_COLORS = {
paid:'bg-success-soft text-success-soft-foreground',
refunded:'bg-danger-soft text-danger-soft-foreground',
partial:'bg-warning-soft text-warning-soft-foreground',
pending:'bg-surface-tertiary text-foreground',
}

const STATUS_ICONS = {
  paid: CheckCircle,
  refunded: XCircle,
  partial: Clock,
  pending: Clock,
}

export default function InvoicesPage() {
  const { t, toastSuccess, toastError } = useAppStore()
  const [orders, setOrders] = useState([])
  const [subPayments, setSubPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [etaSubmitting, setEtaSubmitting] = useState(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [ordersRes, subPayRes] = await Promise.all([
        ordersApi.getAll({ limit: 500 }),
        subscriptionsApi.getAllPayments().catch(() => ({ data: [] }))
      ])
      setOrders(ordersRes.data || [])
      setSubPayments(subPayRes.data || [])
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  const getOrderStatus = (order) => {
    if (order.refund_status === 'partial') return 'partial'
    if (order.refund_status === 'refunded' || order.is_refunded || order.payment_status === 'refunded') return 'refunded'
    return order.payment_status || 'paid'
  }

  const isServiceOrder = (order) => {
    const items = order.order_items || order.items || []
    return (
      order.notes?.toLowerCase().includes('service sale') ||
      order.notes?.toLowerCase().includes('service(s)') ||
      items.some(i => i.type === 'service' || i._type === 'service')
    )
  }

  const getOrderItems = (order) => order.order_items || order.items || []

  // Normalize subscription payments into invoice-like objects
  const normalizedSubs = subPayments.map(sp => ({
    id: `sub-${sp.id}`,
    _type: 'subscription',
    order_number: `SUB-${sp.id}`,
    created_at: sp.payment_date || sp.created_at,
    customers: sp.subscription?.customer || null,
    total: parseFloat(sp.amount) || 0,
    // Subscription payments are charged at list price with no tax or discount;
    // without these the receipt rendered formatCurrency(undefined) as "NaN".
    subtotal: parseFloat(sp.amount) || 0,
    tax_amount: 0,
    discount_amount: 0,
    payment_method: sp.payment_method || 'cash',
    payment_status: 'paid',
    items_count: 1,
    items: [{ product_name: sp.subscription?.plan?.name || 'Subscription', quantity: 1, unit_price: sp.amount, _type: 'subscription' }],
  }))

  // Merge orders and subscription payments
  const allInvoices = [...orders.map(o => ({ ...o, _type: o._type || 'order' })), ...normalizedSubs]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  const filteredOrders = allInvoices.filter(invoice => {
    const matchesSearch = !search ||
      invoice.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      invoice.customers?.name?.toLowerCase().includes(search.toLowerCase())
    const invoiceStatus = invoice._type === 'subscription' ? 'paid' : getOrderStatus(invoice)
    const matchesStatus = statusFilter === 'all' || invoiceStatus === statusFilter
    const matchesType = typeFilter === 'all' ||
      (typeFilter === 'subscription' && invoice._type === 'subscription') ||
      (typeFilter === 'service' && isServiceOrder(invoice)) ||
      (typeFilter === 'product' && invoice._type !== 'subscription' && !isServiceOrder(invoice))
    return matchesSearch && matchesStatus && matchesType
  })

  const stats = {
    total: allInvoices.length,
    paid: allInvoices.filter(o => o._type === 'subscription' || getOrderStatus(o) === 'paid').length,
    refunded: orders.filter(o => getOrderStatus(o) === 'refunded').length,
    partial: orders.filter(o => getOrderStatus(o) === 'partial').length,
    serviceOrders: orders.filter(o => isServiceOrder(o)).length,
    subscriptionPayments: subPayments.length,
    totalRevenue: allInvoices.filter(o => o._type === 'subscription' || getOrderStatus(o) !== 'refunded').reduce((s, o) => {
      return s + (parseFloat(o.total) || 0)
    }, 0),
    serviceRevenue: orders.filter(o => isServiceOrder(o) && getOrderStatus(o) !== 'refunded').reduce((s, o) => {
      return s + (parseFloat(o.total) || 0)
    }, 0),
    subscriptionRevenue: subPayments.reduce((s, sp) => s + (parseFloat(sp.amount) || 0), 0),
  }

  const handleViewReceipt = async (invoice) => {
    if (invoice._type === 'subscription') {
      setSelectedOrder(invoice)
      setShowReceipt(true)
      return
    }
    try {
      const { data: fullOrder } = await ordersApi.getById(invoice.id)
      setSelectedOrder(fullOrder)
      setShowReceipt(true)
    } catch (err) {
      console.error('Failed to load order:', err)
    }
  }

  const handleEtaSubmit = async (order) => {
    setEtaSubmitting(order.id)
    try {
      const res = await etaApi.submit(order.id)
      const data = res.data
      if (data.alreadySubmitted) {
        toastSuccess(t('invoices.alreadySubmittedToETA', { uuid: data.etaUUID?.substring(0, 12) }))
      } else if (data.status === 'submitted') {
        toastSuccess(t('invoices.submittedToETA', { uuid: data.etaUUID?.substring(0, 12) }))
      } else {
        toastError(data.rejectedDocuments?.[0]?.error || t('invoices.etaRejected'))
      }
      loadData()
    } catch (err) {
      toastError(err.response?.data?.error || err.message || t('invoices.etaSubmitFailed'))
    } finally {
      setEtaSubmitting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('invoices.title') || 'Invoices'}</h1>
<p className="text-muted">{t('invoices.subtitle')||'View all invoices'}</p>
        </div>
<button onClick={loadData}className="px-4 py-2 bg-surface-tertiary bg-surface-hover rounded-xl font-medium flex items-center gap-2 text-sm">
          <RefreshCcw className="w-4 h-4" /> {t('common.refresh') || 'Refresh'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
<div className="bg-surface-secondary rounded-2xl border border-border shadow-sm p-5">
          <div className="flex items-center gap-4">
<div className="p-3 bg-accent-soft rounded-xl">
<FileText className="w-6 h-6 text-accent"/>
            </div>
            <div>
<p className="text-xs font-medium text-muted uppercase tracking-wide">{t('invoices.totalOrders')||'Total Orders'}</p>
<p className="text-2xl font-bold text-foreground">{stats.total}</p>
            </div>
          </div>
        </div>
<div className="bg-surface-secondary rounded-2xl border border-border shadow-sm p-5">
          <div className="flex items-center gap-4">
<div className="p-3 bg-success-soft rounded-xl">
<CheckCircle className="w-6 h-6 text-success"/>
            </div>
            <div>
<p className="text-xs font-medium text-muted uppercase tracking-wide">{t('invoices.paid')||'Paid'}</p>
<p className="text-2xl font-bold text-success">{stats.paid}</p>
            </div>
          </div>
        </div>
<div className="bg-surface-secondary rounded-2xl border border-border shadow-sm p-5">
          <div className="flex items-center gap-4">
<div className="p-3 bg-warning-soft rounded-xl">
<Clock className="w-6 h-6 text-warning"/>
            </div>
            <div>
<p className="text-xs font-medium text-muted uppercase tracking-wide">{t('invoices.partialRefund')||'Partial Refund'}</p>
<p className="text-2xl font-bold text-warning">{stats.partial}</p>
            </div>
          </div>
        </div>
<div className="bg-surface-secondary rounded-2xl border border-border shadow-sm p-5">
          <div className="flex items-center gap-4">
<div className="p-3 bg-danger-soft rounded-xl">
<XCircle className="w-6 h-6 text-danger"/>
            </div>
            <div>
<p className="text-xs font-medium text-muted uppercase tracking-wide">{t('invoices.refunded')||'Refunded'}</p>
<p className="text-2xl font-bold text-danger">{stats.refunded}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
<div className="bg-surface-secondary rounded-2xl border border-border shadow-sm p-5">
          <div className="flex items-center gap-4">
<div className="p-3 bg-accent-soft rounded-xl">
<DollarSign className="w-6 h-6 text-accent"/>
            </div>
            <div>
<p className="text-xs font-medium text-muted uppercase tracking-wide">{t('invoices.totalRevenue')||'Total Revenue'}</p>
<p className="text-2xl font-bold text-foreground">{formatCurrency(stats.totalRevenue)}</p>
            </div>
          </div>
        </div>
<div className="bg-surface-secondary rounded-2xl border border-border shadow-sm p-5">
          <div className="flex items-center gap-4">
<div className="p-3 bg-accent-soft rounded-xl">
<Wrench className="w-6 h-6 text-accent"/>
            </div>
            <div>
<p className="text-xs font-medium text-muted uppercase tracking-wide">{t('services.serviceSales')||'Service Sales'}</p>
              <div className="flex items-baseline gap-3">
<p className="text-2xl font-bold text-accent">{stats.serviceOrders}</p>
                {stats.serviceRevenue > 0 && (
<p className="text-sm font-medium text-accent">{formatCurrency(stats.serviceRevenue)}</p>
                )}
              </div>
            </div>
          </div>
        </div>
<div className="bg-surface-secondary rounded-2xl border border-border shadow-sm p-5">
          <div className="flex items-center gap-4">
<div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
<Repeat className="w-6 h-6 text-purple-600 dark:text-purple-400"/>
            </div>
            <div>
<p className="text-xs font-medium text-muted uppercase tracking-wide">{t('billingCycle.subscriptions')||'Subscriptions'}</p>
              <div className="flex items-baseline gap-3">
<p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.subscriptionPayments}</p>
                {stats.subscriptionRevenue > 0 && (
<p className="text-sm font-medium text-purple-500 dark:text-purple-400/70">{formatCurrency(stats.subscriptionRevenue)}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"/>
          <input
            type="text"
            placeholder={t('invoices.searchPlaceholder') || 'Search by order number, customer, or cashier...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-surface text-sm ring-focus focus:border-transparent"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'all', label: t('reports.all') || 'All' },
            { key: 'product', label: t('inventory.products') || 'Products' },
            { key: 'service', label: t('services.service') || 'Service' },
            { key: 'subscription', label: t('billingCycle.subscriptions') || 'Subscriptions' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTypeFilter(key)}
              className={`px-3 py-2.5 rounded-xl text-xs font-medium transition-colors min-h-[44px] ${
                typeFilter === key
?'bg-accent text-white'
:'bg-surface-tertiary text-foreground bg-surface-hover'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {[
            { key: 'all', label: t('reports.all') || 'All' },
            { key: 'paid', label: t('invoices.paid') || 'Paid' },
            { key: 'pending', label: t('invoices.pending') || 'Pending' },
            { key: 'partial', label: t('invoices.partialRefund') || 'Partial Refund' },
            { key: 'refunded', label: t('invoices.refunded') || 'Refunded' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-2.5 rounded-xl text-xs font-medium transition-colors min-h-[44px] ${
                statusFilter === key
?'bg-accent text-white'
:'bg-surface-tertiary text-foreground bg-surface-hover'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
<div className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
<tr className="bg-surface-secondary border-b border-border">
                <th className="text-left px-4 py-3 font-semibold">{t('invoices.orderNumber') || 'Order #'}</th>
                <th className="text-left px-4 py-3 font-semibold">{t('invoices.date') || 'Date'}</th>
                <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">{t('invoices.customer') || 'Customer'}</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">{t('invoices.cashier') || 'Cashier'}</th>
                <th className="text-center px-4 py-3 font-semibold">{t('invoices.items') || 'Items'}</th>
                <th className="text-right px-4 py-3 font-semibold">{t('invoices.total') || 'Total'}</th>
                <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">{t('invoices.payment') || 'Payment'}</th>
                <th className="text-center px-4 py-3 font-semibold">{t('invoices.status') || 'Status'}</th>
                <th className="text-center px-4 py-3 font-semibold">{t('invoices.actions') || 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
<td colSpan="9"className="text-center py-12 text-muted">
                    {t('invoices.noOrders') || 'No invoices found'}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((invoice) => {
                  const isSub = invoice._type === 'subscription'
                  const orderStatus = isSub ? 'paid' : getOrderStatus(invoice)
                  const StatusIcon = STATUS_ICONS[orderStatus] || Clock
                  const items = isSub ? (invoice.items || []) : getOrderItems(invoice)
                  return (
<tr key={invoice.id}className="border-b border-border bg-surface-hover">
                      <td className="px-4 py-3 font-mono font-semibold">
                        <div className="flex items-center gap-2">
                          {invoice.order_number}
                          {isSub && (
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                              <Repeat className="w-3 h-3" />
                              {t('billingCycle.subscriptions') || 'Subscription'}
                            </span>
                          )}
                          {!isSub && isServiceOrder(invoice) && (
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent-soft text-accent-soft-foreground">
                              <Wrench className="w-3 h-3" />
                              {t('services.service') || 'Service'}
                            </span>
                          )}
                        </div>
                      </td>
<td className="px-4 py-3 text-muted">{new Date(invoice.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">{invoice.customers?.name || '-'}</td>
                      <td className="px-4 py-3 hidden md:table-cell">{isSub ? '-' : (invoice.users?.full_name || '-')}</td>
                      <td className="px-4 py-3 text-center">
                        {isSub ? (items[0]?.product_name || '-') : (invoice.items_count || items.length || '-')}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(invoice.total)}
                        {!isSub && invoice.total_refunded > 0 && (
<div className="text-xs text-danger">-{formatCurrency(invoice.total_refunded)}refunded</div>
                        )}
                      </td>
                      <td className="px-4 py-3 capitalize hidden sm:table-cell">{invoice.payment_method}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[orderStatus] || STATUS_COLORS.pending}`}>
                          <StatusIcon className="w-3 h-3" />
                          {orderStatus === 'partial' ? 'Partial Refund' : orderStatus === 'refunded' ? 'Refunded' : orderStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {!isSub && !invoice.eta_uuid && (
                            <button
                              onClick={() => handleEtaSubmit(invoice)}
                              disabled={etaSubmitting === invoice.id}
className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-green-50 text-muted hover:text-green-600 transition-colors disabled:opacity-50"
                              title={t('invoices.submitEta') || 'Submit to ETA'}
                            >
                              {etaSubmitting === invoice.id ? (
<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-success"></div>
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          {!isSub && invoice.eta_uuid && (
<span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success-soft text-success-soft-foreground"title={invoice.eta_uuid}>
                              ETA
                            </span>
                          )}
                          <button
                            onClick={() => handleViewReceipt(invoice)}
className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-surface-hover text-muted hover:text-primary-600 transition-colors"
                            title={t('common.view') || 'View'}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt Modal */}
      {showReceipt && selectedOrder && (
        <ReceiptModal order={selectedOrder} onClose={() => { setShowReceipt(false); setSelectedOrder(null) }} />
      )}
    </div>
  )
}
