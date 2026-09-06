import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { formatCurrency } from '../lib/utils'
import { productVariantsApi } from '../lib/api'
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  X,
  Tag,
  Loader2,
  Search,
  Hash,
  Boxes
} from 'lucide-react'

export default function ProductVariantsPage() {
  const { t, toastSuccess, toastError } = useAppStore()
  const [products, setProducts] = useState([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [variants, setVariants] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingVariant, setEditingVariant] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [stockAdjustId, setStockAdjustId] = useState(null)
  const [stockAdjustQty, setStockAdjustQty] = useState('')
  const [adjustingStock, setAdjustingStock] = useState(false)
  const [form, setForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    price: '',
    cost: '',
    stock: '',
    attributes: [{ key: '', value: '' }]
  })

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    if (selectedProduct) {
      loadVariants(selectedProduct)
    } else {
      setVariants([])
    }
  }, [selectedProduct])

  const loadProducts = async () => {
    try {
      const res = await productVariantsApi.getByProduct ? null : null
      // Fetch all products from the API
      const response = await fetch('/api/products', { credentials: 'include' })
      const data = await response.json()
      setProducts(data.data || data || [])
    } catch (err) {
      toastError(err.message || 'Failed to load products')
    }
  }

  const loadVariants = async (productId) => {
    try {
      setLoading(true)
      const res = await productVariantsApi.getByProduct(productId)
      setVariants(res.data || [])
    } catch (err) {
      toastError(err.message || 'Failed to load variants')
    } finally {
      setLoading(false)
    }
  }

  const openAddModal = () => {
    setEditingVariant(null)
    setForm({
      name: '',
      sku: '',
      barcode: '',
      price: '',
      cost: '',
      stock: '',
      attributes: [{ key: '', value: '' }]
    })
    setShowModal(true)
  }

  const openEditModal = (variant) => {
    setEditingVariant(variant)
    const attrs = variant.attributes
      ? Object.entries(variant.attributes).map(([key, value]) => ({ key, value }))
      : [{ key: '', value: '' }]
    setForm({
      name: variant.name || '',
      sku: variant.sku || '',
      barcode: variant.barcode || '',
      price: variant.price || '',
      cost: variant.cost || '',
      stock: variant.stock || '',
      attributes: attrs.length > 0 ? attrs : [{ key: '', value: '' }]
    })
    setShowModal(true)
  }

  const handleAttributeChange = (index, field, value) => {
    const updated = [...form.attributes]
    updated[index][field] = value
    setForm({ ...form, attributes: updated })
  }

  const addAttribute = () => {
    setForm({ ...form, attributes: [...form.attributes, { key: '', value: '' }] })
  }

  const removeAttribute = (index) => {
    if (form.attributes.length <= 1) return
    const updated = form.attributes.filter((_, i) => i !== index)
    setForm({ ...form, attributes: updated })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.price) {
      toastError('Name and price are required')
      return
    }

    const attributes = {}
    form.attributes.forEach((attr) => {
      if (attr.key && attr.value) {
        attributes[attr.key] = attr.value
      }
    })

    const payload = {
      product_id: selectedProduct,
      name: form.name,
      sku: form.sku,
      barcode: form.barcode,
      price: parseFloat(form.price),
      cost: form.cost ? parseFloat(form.cost) : 0,
      stock: form.stock ? parseInt(form.stock) : 0,
      attributes
    }

    try {
      setSubmitting(true)
      if (editingVariant) {
        await productVariantsApi.update(editingVariant.id, payload)
        toastSuccess('Variant updated successfully')
      } else {
        await productVariantsApi.create(payload)
        toastSuccess('Variant created successfully')
      }
      setShowModal(false)
      loadVariants(selectedProduct)
    } catch (err) {
      toastError(err.message || 'Failed to save variant')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm(t('confirmDelete') || 'Are you sure you want to delete this variant?')) return
    try {
      await productVariantsApi.delete(id)
      toastSuccess('Variant deleted successfully')
      loadVariants(selectedProduct)
    } catch (err) {
      toastError(err.message || 'Failed to delete variant')
    }
  }

  const handleStockAdjust = async (id) => {
    if (!stockAdjustQty || parseInt(stockAdjustQty) === 0) {
      toastError('Please enter a valid quantity')
      return
    }
    try {
      setAdjustingStock(true)
      await productVariantsApi.adjustStock(id, { quantity: parseInt(stockAdjustQty) })
      toastSuccess('Stock adjusted successfully')
      setStockAdjustId(null)
      setStockAdjustQty('')
      loadVariants(selectedProduct)
    } catch (err) {
      toastError(err.message || 'Failed to adjust stock')
    } finally {
      setAdjustingStock(false)
    }
  }

  const filteredVariants = variants.filter(
    (v) =>
      v.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.barcode?.includes(searchTerm)
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Boxes className="h-6 w-6" />
          {t('productVariants') || 'Product Variants'}
        </h1>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('selectProduct') || 'Select Product'}</label>
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">{t('chooseProduct') || 'Choose a product...'}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        {selectedProduct && (
          <>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('search') || 'Search'}</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('searchVariants') || 'Search variants...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="flex items-end">
              <button
                onClick={openAddModal}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                {t('addVariant') || 'Add Variant'}
              </button>
            </div>
          </>
        )}
      </div>

      {!selectedProduct && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Package className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">{t('selectProductToViewVariants') || 'Select a product to view its variants'}</p>
        </div>
      )}

      {selectedProduct && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50">
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('name') || 'Name'}</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('sku') || 'SKU'}</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('barcode') || 'Barcode'}</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('price') || 'Price'}</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('cost') || 'Cost'}</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('stock') || 'Stock'}</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('attributes') || 'Attributes'}</th>
                    <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('actions') || 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredVariants.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-10 text-center text-gray-500 dark:text-gray-400">
                        {t('noVariantsFound') || 'No variants found'}
                      </td>
                    </tr>
                  ) : (
                    filteredVariants.map((variant) => (
                      <tr key={variant.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-5 py-4 text-sm font-medium text-gray-900 dark:text-white">{variant.name}</td>
                        <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300 font-mono">{variant.sku || '—'}</td>
                        <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300 font-mono">{variant.barcode || '—'}</td>
                        <td className="px-5 py-4 text-sm text-right text-gray-900 dark:text-white">{formatCurrency(variant.price)}</td>
                        <td className="px-5 py-4 text-sm text-right text-gray-600 dark:text-gray-300">{formatCurrency(variant.cost)}</td>
                        <td className="px-5 py-4 text-sm text-right">
                          {stockAdjustId === variant.id ? (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                value={stockAdjustQty}
                                onChange={(e) => setStockAdjustQty(e.target.value)}
                                className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none"
                                placeholder="+/-"
                              />
                              <button onClick={() => handleStockAdjust(variant.id)} disabled={adjustingStock} className="p-1 text-green-600 hover:text-green-700">
                                {adjustingStock ? <Loader2 className="h-4 w-4 animate-spin" /> : '✓'}
                              </button>
                              <button onClick={() => { setStockAdjustId(null); setStockAdjustQty('') }} className="p-1 text-gray-400 hover:text-gray-600">
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setStockAdjustId(variant.id)}
                              className={`font-medium hover:underline ${variant.stock <= 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}
                            >
                              {variant.stock}
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1">
                            {variant.attributes && Object.entries(variant.attributes).map(([key, value]) => (
                              <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full">
                                <Tag className="h-3 w-3" />
                                {key}: {value}
                              </span>
                            ))}
                            {(!variant.attributes || Object.keys(variant.attributes).length === 0) && (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => openEditModal(variant)} className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleDelete(variant.id)} className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingVariant ? (t('editVariant') || 'Edit Variant') : (t('addVariant') || 'Add Variant')}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('name') || 'Name'} *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('sku') || 'SKU'}</label>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('barcode') || 'Barcode'}</label>
                  <input
                    type="text"
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('price') || 'Price'} *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('cost') || 'Cost'}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.cost}
                    onChange={(e) => setForm({ ...form, cost: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('stock') || 'Stock'}</label>
                  <input
                    type="number"
                    min="0"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('attributes') || 'Attributes'}</label>
                {form.attributes.map((attr, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder={t('key') || 'Key'}
                      value={attr.key}
                      onChange={(e) => handleAttributeChange(idx, 'key', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                    <input
                      type="text"
                      placeholder={t('value') || 'Value'}
                      value={attr.value}
                      onChange={(e) => handleAttributeChange(idx, 'value', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                    <button type="button" onClick={() => removeAttribute(idx)} className="px-2 text-gray-400 hover:text-red-500">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addAttribute} className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                  + {t('addAttribute') || 'Add Attribute'}
                </button>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  {t('cancel') || 'Cancel'}
                </button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingVariant ? (t('update') || 'Update') : (t('create') || 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
