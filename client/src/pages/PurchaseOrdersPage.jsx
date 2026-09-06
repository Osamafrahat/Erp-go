import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { formatCurrency } from '../lib/utils'
import { purchaseOrdersApi } from '../lib/api'
import {
  ShoppingCart,
  Plus,
  Eye,
  X,
  Loader2,
  Search,
  Package,
  Truck,
  CheckCircle,
  Trash2,
  FileText
} from 'lucide-react'

export default function PurchaseOrdersPage() {
  const { t, toastSuccess, toastError } = useAppStore()
  const [orders, setOrders] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [form, setForm] = useState({
    supplier_id: '',
    expected_date: '',
    notes: '',
    items: [{ product_id: '', quantity: '', unit_price: '' }]
  })

  const fetchData = async () => {
    try {
      setLoading(true)
      const [ordersRes, statsRes] = await Promise.all([
        purchaseOrdersApi.getAll({ status: filter === 'all' ? undefined : filter }),
        purchaseOrdersApi.getStats()
      ])
      setOrders(ordersRes.data || [])
      setStats(statsRes.data)
    } catch (err) {
      toastError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const loadDropdowns = async () => {
    try {
      const [supRes, prodRes] = await Promise.all([
        fetch('/api/suppliers', { credentials: 'include' }).then((r) => r.json()),
        fetch('/api/products', { credentials: 'include' }).then((r) => r.json())
      ])
      setSuppliers(supRes.data || supRes || [])
      setProducts(prodRes.data || prodRes || [])
    } catch (err) {
      // silent
    }
  }

  useEffect(() => {
    fetchData()
  }, [filter])

  useEffect(() => {
    loadDropdowns()
  }, [])

  const handleItemChange = (index, field, value) => {
    const updated = [...form.items]
    updated[index][field] = value
    setForm({ ...form, items: updated })
  }

  const addItem = () => {
    setForm({ ...form, items: [...form.items, { product_id: '', quantity: '', unit_price: '' }] })
  }

  const removeItem = (index) => {
    if (form.items.length <= 1) return
    setForm({ ...form, items: form.items.filter((_, i) => i !== index) })
  }

  const handleCreatePO = async (e) => {
    e.preventDefault()
    if (!form.supplier_id) {
      toastError('Please select a supplier')
      return
    }
    const validItems = form.items.filter((item) => item.product_id && item.quantity && item.unit_price)
    if (validItems.length === 0) {
      toastError('Please add at least one item')
      return
    }

    try {
      setSubmitting(true)
      await purchaseOrdersApi.create({
        supplier_id: form.supplier_id,
        expected_date: form.expected_date || null,
        notes: form.notes,
        items: validItems.map((item) => ({
          product_id: item.product_id,
          quantity: parseInt(item.quantity),
          unit_price: parseFloat(item.unit_price)
        }))
      })
      toastSuccess('Purchase order created successfully')
      setShowCreateForm(false)
      setForm({ supplier_id: '', expected_date: '', notes: '', items: [{ product_id: '', quantity: '', unit_price: '' }] })
      fetchData()
    } catch (err) {
      toastError(err.message || 'Failed to create purchase order')
    } finally {
      setSubmitting(false)
    }
  }

  const viewDetail = async (id) => {
    try {
      const res = await purchaseOrdersApi.getById(id)
      setShowDetail(res.data)
    } catch (err) {
      toastError(err.message || 'Failed to load details')
    }
  }

  const handleReceive = async (id) => {
    if (!confirm(t('confirmReceive') || 'Mark this order as received?')) return
    try {
      await purchaseOrdersApi.receive(id)
      toastSuccess('Order marked as received')
      fetchData()
    } catch (err) {
      toastError(err.message || 'Failed to receive order')
    }
  }

  const handleDeletePO = async (id) => {
    if (!confirm(t('confirmDelete') || 'Are you sure you want to delete this order?')) return
    try {
      await purchaseOrdersApi.delete(id)
      toastSuccess('Order deleted successfully')
      fetchData()
    } catch (err) {
      toastError(err.message || 'Failed to delete order')
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      case 'sent':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      case 'received':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'draft':
        return <FileText className="h-4 w-4" />
      case 'sent':
        return <Truck className="h-4 w-4" />
      case 'received':
        return <CheckCircle className="h-4 w-4" />
      case 'cancelled':
        return <X className="h-4 w-4" />
      default:
        return null
    }
  }

  const filteredOrders = orders.filter(
    (o) =>
      o.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <ShoppingCart className="h-6 w-6" />
          {t('purchaseOrders') || 'Purchase Orders'}
        </h1>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t('createPO') || 'Create PO'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('totalOrders') || 'Total Orders'}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.total_orders || orders.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Truck className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('pending') || 'Pending'}</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats?.pending || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('received') || 'Received'}</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats?.received || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('totalValue') || 'Total Value'}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats?.total_value || 0)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex flex-wrap gap-2">
              {['all', 'draft', 'sent', 'received', 'cancelled'].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filter === s
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {t(s) || s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={t('search') || 'Search...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('poNumber') || 'PO #'}</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('supplier') || 'Supplier'}</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('items') || 'Items'}</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('total') || 'Total'}</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('expectedDate') || 'Expected Date'}</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('status') || 'Status'}</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('actions') || 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-500 dark:text-gray-400">
                    {t('noPurchaseOrders') || 'No purchase orders found'}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-5 py-4 text-sm font-mono font-medium text-gray-900 dark:text-white">{po.po_number}</td>
                    <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300">{po.supplier_name}</td>
                    <td className="px-5 py-4 text-sm text-center text-gray-600 dark:text-gray-300">{po.items_count || po.items?.length || 0}</td>
                    <td className="px-5 py-4 text-sm text-right text-gray-900 dark:text-white font-medium">{formatCurrency(po.total)}</td>
                    <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300">
                      {po.expected_date ? new Date(po.expected_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(po.status)}`}>
                        {getStatusIcon(po.status)}
                        {t(po.status) || po.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => viewDetail(po.id)} className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" title={t('view') || 'View'}>
                          <Eye className="h-4 w-4" />
                        </button>
                        {(po.status === 'draft' || po.status === 'sent') && (
                          <button onClick={() => handleReceive(po.id)} className="p-1.5 text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors" title={t('receive') || 'Receive'}>
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                        {po.status === 'draft' && (
                          <button onClick={() => handleDeletePO(po.id)} className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors" title={t('delete') || 'Delete'}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('createPO') || 'Create Purchase Order'}</h3>
              <button onClick={() => setShowCreateForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreatePO} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('supplier') || 'Supplier'} *</label>
                  <select
                    value={form.supplier_id}
                    onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  >
                    <option value="">{t('selectSupplier') || 'Select supplier...'}</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('expectedDate') || 'Expected Date'}</label>
                  <input
                    type="date"
                    value={form.expected_date}
                    onChange={(e) => setForm({ ...form, expected_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('items') || 'Items'}</label>
                {form.items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <select
                      value={item.product_id}
                      onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm outline-none"
                    >
                      <option value="">{t('selectProduct') || 'Product...'}</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      placeholder={t('qty') || 'Qty'}
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                      className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm outline-none"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={t('price') || 'Price'}
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                      className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm outline-none"
                    />
                    <button type="button" onClick={() => removeItem(idx)} className="px-2 text-gray-400 hover:text-red-500">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addItem} className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                  + {t('addItem') || 'Add Item'}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('notes') || 'Notes'}</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateForm(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  {t('cancel') || 'Cancel'}
                </button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('create') || 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {showDetail.po_number}
              </h3>
              <button onClick={() => setShowDetail(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('supplier') || 'Supplier'}</p>
                <p className="font-medium text-gray-900 dark:text-white">{showDetail.supplier_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('status') || 'Status'}</p>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(showDetail.status)}`}>
                  {getStatusIcon(showDetail.status)}
                  {t(showDetail.status) || showDetail.status}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('expectedDate') || 'Expected Date'}</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {showDetail.expected_date ? new Date(showDetail.expected_date).toLocaleDateString() : '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('total') || 'Total'}</p>
                <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(showDetail.total)}</p>
              </div>
            </div>

            {showDetail.notes && (
              <div className="mb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('notes') || 'Notes'}</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{showDetail.notes}</p>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50">
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('product') || 'Product'}</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('qty') || 'Qty'}</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('unitPrice') || 'Unit Price'}</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('subtotal') || 'Subtotal'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {showDetail.items?.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{item.product_name}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-300">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-300">{formatCurrency(item.unit_price)}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                        {formatCurrency(item.quantity * item.unit_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {t('total') || 'Total'}: {formatCurrency(showDetail.total)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
