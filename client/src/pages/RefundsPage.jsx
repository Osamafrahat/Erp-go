import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { refundsApi, ordersApi } from '../lib/api'
import { X, RotateCcw, AlertCircle, CheckCircle, Package, Search } from 'lucide-react'

export default function RefundsPage() {
  const { t } = useAppStore()
  const [refunds, setRefunds] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchRefunds()
  }, [])

  const fetchRefunds = async () => {
    setLoading(true)
    try {
      const response = await refundsApi.getAll()
      setRefunds(response.data)
    } catch (err) {
      console.error('Failed to fetch refunds:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRefund = async (refundData) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      await refundsApi.create(refundData)
      setShowForm(false)
      fetchRefunds()
    } catch (err) {
      console.error('Failed to process refund:', err)
      alert(err.response?.data?.error || t('refunds.failedToProcess'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatAmount = (val) => {
    const num = parseFloat(val) || 0
    return num.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('refunds.title')}</h1>
<p className="text-muted">{t('refunds.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
className="flex items-center gap-2 px-4 py-2 bg-danger text-white rounded-lg hover:bg-red-700"
        >
          <RotateCcw className="w-4 h-4" />
          {t('refunds.processRefund')}
        </button>
      </div>

      {/* Refunds List */}
      {refunds.length === 0 ? (
<div className="bg-surface rounded-xl border border-border p-6 md:p-12 text-center">
<RotateCcw className="w-16 h-16 mx-auto text-foreground mb-4"/>
<h3 className="text-lg font-medium text-foreground mb-2">{t('refunds.noRefunds')}</h3>
<p className="text-muted">{t('refunds.addFirst')}</p>
        </div>
      ) : (
<div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
<thead className="bg-surface-secondary">
                <tr>
<th className="px-4 py-3 text-start text-sm font-medium text-muted">{t('refunds.date')}</th>
<th className="px-4 py-3 text-start text-sm font-medium text-muted">{t('refunds.orderNumber')}</th>
<th className="px-4 py-3 text-start text-sm font-medium text-muted">{t('refunds.amount')}</th>
<th className="px-4 py-3 text-start text-sm font-medium text-muted">{t('refunds.type')}</th>
<th className="px-4 py-3 text-start text-sm font-medium text-muted">{t('refunds.reason')}</th>
<th className="px-4 py-3 text-start text-sm font-medium text-muted">{t('refunds.processedBy')}</th>
<th className="px-4 py-3 text-start text-sm font-medium text-muted">{t('refunds.status')}</th>
                </tr>
              </thead>
<tbody className="divide-y divide-border">
                {refunds.map((refund) => (
<tr key={refund.id}className="bg-surface-hover">
                    <td className="px-4 py-3 text-sm text-start">
                      {new Date(refund.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-start">
                      {refund.orders?.order_number || '-'}
                    </td>
<td className="px-4 py-3 text-sm font-semibold text-danger text-start">
                      {formatAmount(refund.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-start">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
refund.is_partial ?'bg-warning-soft text-warning-soft-foreground':'bg-accent-soft text-accent-soft-foreground'
                      }`}>
                        {refund.is_partial ? t('refunds.partial') : t('refunds.full')}
                      </span>
                    </td>
<td className="px-4 py-3 text-sm text-muted text-start">
                      {refund.reason}
                    </td>
                    <td className="px-4 py-3 text-sm text-start">
                      {refund.users?.full_name || 'System'}
                    </td>
                    <td className="px-4 py-3 text-sm text-start">
<span className="flex items-center gap-1 text-success">
                        <CheckCircle className="w-4 h-4" />
                        {t('refunds.completed')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Refund Form Modal */}
      {showForm && (
        <RefundForm
          onSave={handleRefund}
          onClose={() => setShowForm(false)}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  )
}

function RefundForm({ onSave, onClose, isSubmitting }) {
  const { t, settings } = useAppStore()
  const [orderNumber, setOrderNumber] = useState('')
  const [order, setOrder] = useState(null)
  const [orderItems, setOrderItems] = useState([])
  const [refundableItems, setRefundableItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedItems, setSelectedItems] = useState([])
  const [refundAll, setRefundAll] = useState(false)
  const [reason, setReason] = useState('')
  const taxRate = parseFloat(settings.taxRate) || 14

  const searchOrder = async () => {
    if (!orderNumber.trim()) return
    setLoading(true)
    setError('')
    setOrder(null)
    setOrderItems([])
    setRefundableItems([])
    setSelectedItems([])
    setRefundAll(false)

    try {
      const response = await ordersApi.getAll({ search: orderNumber })
      const foundOrder = response.data.find(o => o.order_number === orderNumber)

      if (!foundOrder) {
        setError(t('refunds.orderNotFound'))
        return
      }

      // Fetch full order with items, refunds, refund_items
      const detailRes = await ordersApi.getById(foundOrder.id)
      const fullOrder = detailRes.data

      // Check if order is older than 14 days
      const orderDate = new Date(fullOrder.created_at)
      const now = new Date()
      const daysSinceOrder = Math.floor((now - orderDate) / (1000 * 60 * 60 * 24))
      if (daysSinceOrder > 14) {
        setError(t('refunds.exceeded14Days').replace('{days}', daysSinceOrder))
        return
      }

      setOrder(fullOrder)
      setOrderItems(fullOrder.items || [])

      // Calculate already-refunded quantities per order_item_id
      const refundedQtyMap = {}
      const refundItems = fullOrder.refund_items || []
      for (const ri of refundItems) {
        refundedQtyMap[ri.order_item_id] = (refundedQtyMap[ri.order_item_id] || 0) + ri.quantity
      }

      // Build refundable items (only items with remaining quantity > 0 and is_refundable)
      const items = (fullOrder.items || [])
        .map(item => {
          const originalQty = item.quantity
          const refundedQty = refundedQtyMap[item.id] || 0
          const remainingQty = originalQty - refundedQty
          return {
            ...item,
            refunded_quantity: refundedQty,
            remaining_quantity: remainingQty,
            is_refundable: item.products?.is_refundable !== false,
            unit_of_measure: item.products?.unit_of_measure || 'quantity',
            remaining_total: remainingQty * parseFloat(item.unit_price) - (remainingQty < originalQty ? (parseFloat(item.discount) || 0) * (remainingQty / originalQty) : (parseFloat(item.discount) || 0)),
          }
        })
        .filter(item => item.remaining_quantity > 0 && item.is_refundable)

      setRefundableItems(items)

      if (items.length === 0) {
        setError(t('refunds.allItemsRefunded'))
      }
    } catch (err) {
      setError(t('refunds.failedToSearch'))
    } finally {
      setLoading(false)
    }
  }

  const toggleItem = (item) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.order_item_id === item.id)
      if (exists) {
        return prev.filter(i => i.order_item_id !== item.id)
      }
      return [...prev, {
        order_item_id: item.id,
        product_id: item.product_id,
        product_name: item.products?.name || item.product_name || 'Product',
        max_quantity: item.remaining_quantity,
        quantity: item.remaining_quantity,
        unit_price: parseFloat(item.unit_price),
        item_discount: parseFloat(item.discount) || 0,
        item_total: parseFloat(item.total),
        original_quantity: item.quantity,
        refunded_quantity: item.refunded_quantity,
      }]
    })
  }

  const updateItemQuantity = (orderItemId, qty) => {
    setSelectedItems(prev => prev.map(i => {
      if (i.order_item_id === orderItemId) {
        const newQty = Math.max(1, Math.min(qty, i.max_quantity))
        return { ...i, quantity: newQty }
      }
      return i
    }))
  }

  const toggleRefundAll = () => {
    if (refundAll) {
      setSelectedItems([])
      setRefundAll(false)
    } else {
      setSelectedItems(refundableItems.map(item => ({
        order_item_id: item.id,
        product_id: item.product_id,
        product_name: item.products?.name || item.product_name || 'Product',
        max_quantity: item.remaining_quantity,
        quantity: item.remaining_quantity,
        unit_price: parseFloat(item.unit_price),
        item_discount: parseFloat(item.discount) || 0,
        item_total: parseFloat(item.total),
        original_quantity: item.quantity,
        refunded_quantity: item.refunded_quantity,
      })))
      setRefundAll(true)
    }
  }

  // Calculate refund breakdown
  const calculateRefund = () => {
    if (!order || selectedItems.length === 0) {
      return { itemSubtotal: 0, promoPortion: 0, netBeforeTax: 0, vatPortion: 0, totalRefund: 0 }
    }

    const orderSubtotal = parseFloat(order.subtotal) || 0
    const orderDiscount = parseFloat(order.discount_amount) || 0
    const orderTax = parseFloat(order.tax_amount) || 0
    const orderTotal = parseFloat(order.total) || 0

    // Sum of original item totals for selected items
    const selectedItemTotals = selectedItems.reduce((sum, i) => sum + (i.unit_price * i.quantity - i.item_discount), 0)

    // Proportional discount for selected items
    const promoPortion = orderSubtotal > 0
      ? (selectedItemTotals / orderSubtotal) * orderDiscount
      : 0

    // Net before tax = item subtotal - proportional discount
    const netBeforeTax = selectedItemTotals - promoPortion

    // Proportional VAT
    const vatPortion = orderSubtotal > 0
      ? (selectedItemTotals / orderSubtotal) * orderTax
      : 0

    // Total refund = net before tax + VAT portion
    const totalRefund = netBeforeTax + vatPortion

    return { itemSubtotal: selectedItemTotals, promoPortion, netBeforeTax, vatPortion, totalRefund }
  }

  const refund = calculateRefund()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!order || !reason.trim() || selectedItems.length === 0) return

    onSave({
      order_id: order.id,
      amount: parseFloat(refund.totalRefund.toFixed(2)),
      reason: reason.trim(),
      is_partial: !refundAll,
      items: selectedItems.map(i => ({
        order_item_id: i.order_item_id,
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount: i.item_discount,
        total: (i.unit_price * i.quantity - i.item_discount),
      })),
    })
  }

  const formatAmount = (val) => {
    const num = parseFloat(val) || 0
    return num.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
<div className="bg-surface rounded-2xl w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] flex flex-col">
<div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <h2 className="text-xl font-semibold">{t('refunds.processRefund')}</h2>
          <button
            onClick={onClose}
className="p-2 rounded-lg bg-surface-hover"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Order Search */}
          <div>
<label className="block text-sm font-medium text-foreground mb-1">
              {t('refunds.orderNumber')} *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchOrder())}
                placeholder={t('refunds.enterOrderNumber')}
className="flex-1 px-4 py-2 rounded-lg border border-border bg-surface"
              />
              <button
                type="button"
                onClick={searchOrder}
                disabled={loading}
className="px-4 py-2 bg-surface-tertiary rounded-lg bg-surface-hover disabled:opacity-50 flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                {loading ? t('refunds.searching') : t('common.search')}
              </button>
            </div>
          </div>

          {error && (
<div className="flex items-center gap-2 p-3 bg-danger-soft text-danger-soft-foreground rounded-lg">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {order && refundableItems.length > 0 && (
            <>
              {/* Order Summary */}
<div className="bg-surface-secondary rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
<span className="text-muted">{t('refunds.orderTotal')}</span>
                  <span className="font-semibold">{formatAmount(order.total)}</span>
                </div>
                {order.total_refunded > 0 && (
<div className="flex justify-between text-sm text-danger">
                    <span>{t('refunds.alreadyRefunded')}</span>
                    <span>-{formatAmount(order.total_refunded)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
<span className="text-muted">{t('refunds.paymentMethod')}</span>
                  <span className="capitalize">{order.payment_method}</span>
                </div>
                <div className="flex justify-between text-sm">
<span className="text-muted">{t('expenses.date')}:</span>
                  <span>{new Date(order.created_at).toLocaleDateString()}</span>
                </div>
                {parseFloat(order.discount_amount) > 0 && (
<div className="flex justify-between text-sm text-success">
                    <span>{t('refunds.orderDiscount')}</span>
                    <span>-{formatAmount(order.discount_amount)}</span>
                  </div>
                )}
                {parseFloat(order.tax_amount) > 0 && (
                  <div className="flex justify-between text-sm">
<span className="text-muted">{t('refunds.orderVAT')}({taxRate}%)</span>
                    <span>{formatAmount(order.tax_amount)}</span>
                  </div>
                )}
              </div>

              {/* Refund Type Toggle */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={toggleRefundAll}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    refundAll
?'bg-danger-soft border-danger text-danger-soft-foreground'
:'border-border text-muted bg-surface-hover'
                  }`}
                >
                  {t('refunds.refundFullOrder')}
                </button>
                <button
                  type="button"
                  onClick={() => { if (refundAll) { setRefundAll(false); setSelectedItems([]) } }}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    !refundAll && selectedItems.length > 0
?'bg-warning-soft border-warning text-warning-soft-foreground'
:'border-border text-muted bg-surface-hover'
                  }`}
                >
                  {t('refunds.selectItems')}
                </button>
              </div>

              {/* Order Items */}
              <div>
<h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  {t('refunds.orderItems')}
                </h3>
                <div className="space-y-2">
                  {refundableItems.map((item) => {
                    const selected = selectedItems.find(i => i.order_item_id === item.id)
                    const isSelected = !!selected
                    const productName = item.products?.name || item.product_name || 'Product'
                    const itemUnitTotal = parseFloat(item.unit_price) * item.remaining_quantity - (parseFloat(item.discount) || 0)
                    const isPartiallyRefunded = item.refunded_quantity > 0

                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                          isSelected
?'bg-accent-soft border-accent'
:'bg-surface border-border'
                        }`}
                      >
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleItem(item)}
className="w-4 h-4 rounded border-border text-accent ring-focus"
                        />

                        {/* Item Info */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{productName}</div>
<div className="text-xs text-muted">
                            {formatAmount(item.unit_price)} x {item.remaining_quantity}
                            {isPartiallyRefunded && (
<span className="text-warning ml-1">(orig:{item.quantity},refunded:{item.refunded_quantity})</span>
                            )}
                            {parseFloat(item.discount) > 0 && (
<span className="text-success ml-1">(-{formatAmount(item.discount)})</span>
                            )}
                          </div>
                        </div>

                        {/* Item Total */}
                        <div className="text-sm font-semibold whitespace-nowrap">
                          {formatAmount(itemUnitTotal)}
                        </div>

                        {/* Quantity Selector */}
                        {isSelected && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateItemQuantity(item.id, selected.quantity - 1)}
                              disabled={selected.quantity <= 1}
className="w-7 h-7 rounded bg-surface-tertiary flex items-center justify-center text-sm font-bold disabled:opacity-50"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-sm font-medium">{selected.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateItemQuantity(item.id, selected.quantity + 1)}
                              disabled={selected.quantity >= selected.max_quantity}
className="w-7 h-7 rounded bg-surface-tertiary flex items-center justify-center text-sm font-bold disabled:opacity-50"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Refund Calculation Breakdown */}
              {selectedItems.length > 0 && (
<div className="bg-surface-secondary rounded-lg p-4 space-y-2">
<h4 className="text-sm font-medium text-foreground mb-2">{t('refunds.refundBreakdown')}</h4>
                  <div className="flex justify-between text-sm">
<span className="text-muted">{t('refunds.itemsSubtotal')}</span>
                    <span>{formatAmount(refund.itemSubtotal)}</span>
                  </div>
                  {refund.promoPortion > 0 && (
<div className="flex justify-between text-sm text-success">
                      <span>{t('refunds.promoDiscount')} ({formatAmount(parseFloat(order.discount_amount))} proportional)</span>
                      <span>-{formatAmount(refund.promoPortion)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
<span className="text-muted">{t('refunds.netBeforeTax')}</span>
                    <span>{formatAmount(refund.netBeforeTax)}</span>
                  </div>
                  {refund.vatPortion > 0 && (
                    <div className="flex justify-between text-sm">
<span className="text-muted">{t('refunds.vatPortion')}({taxRate}%)</span>
                      <span>{formatAmount(refund.vatPortion)}</span>
                    </div>
                  )}
<div className="border-t border-border pt-2 mt-2">
                    <div className="flex justify-between text-base font-bold">
                      <span>{t('refunds.totalRefund')}</span>
<span className="text-danger">{formatAmount(refund.totalRefund)}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {order && refundableItems.length === 0 && !error && (
<div className="flex items-center gap-2 p-3 bg-warning-soft text-warning-soft-foreground rounded-lg">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{t('refunds.allItemsRefunded')}</span>
            </div>
          )}

          {/* Reason */}
          <div>
<label className="block text-sm font-medium text-foreground mb-1">
              {t('refunds.reason')} *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={3}
              placeholder={t('refunds.enterReason')}
className="w-full px-4 py-2 rounded-lg border border-border bg-surface"
            />
          </div>
        </form>

        {/* Footer */}
<div className="flex justify-end gap-3 p-4 border-t border-border flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
className="px-4 py-2 text-foreground bg-surface-tertiary rounded-lg bg-surface-hover"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={!order || !reason.trim() || selectedItems.length === 0 || isSubmitting}
            onClick={handleSubmit}
className="px-4 py-2 bg-danger text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (t('common.processing') || 'Processing...') : `${t('refunds.processRefund')} (${formatAmount(refund.totalRefund)})`}
          </button>
        </div>
      </div>
    </div>
  )
}
