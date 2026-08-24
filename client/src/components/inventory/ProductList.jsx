import { useState, useEffect } from 'react'
import { useAppStore } from '../../stores/appStore'
import { formatCurrency } from '../../lib/utils'
import { suppliersApi, stockApi } from '../../lib/api'
import { Edit2, Trash2, Search, ChevronDown, Package, AlertTriangle, QrCode, ArrowDown } from 'lucide-react'

export default function ProductList({ products, canEdit, onEdit, onDelete, onPrintBarcode, onRefresh }) {
  const { t, toastSuccess, toastError } = useAppStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState('name')
  const [sortDirection, setSortDirection] = useState('asc')
  const [receiveStockProduct, setReceiveStockProduct] = useState(null)
  const [receiveQty, setReceiveQty] = useState('')
  const [receiveLoading, setReceiveLoading] = useState(false)
  const [suppliers, setSuppliers] = useState([])
  const [receiveSupplierId, setReceiveSupplierId] = useState('')
  const [receiveCostPrice, setReceiveCostPrice] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    suppliersApi.getAll()
      .then(({ data }) => setSuppliers(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const filteredProducts = products
    .filter(p => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          p.name.toLowerCase().includes(query) ||
          p.sku?.toLowerCase().includes(query) ||
          p.barcode?.includes(searchQuery) ||
          p.suppliers?.name?.toLowerCase().includes(query)
        )
      }
      return true
    })
    .sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      const modifier = sortDirection === 'asc' ? 1 : -1
      if (typeof aVal === 'string') {
        return aVal.localeCompare(bVal) * modifier
      }
      return ((aVal || 0) - (bVal || 0)) * modifier
    })

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown className="w-4 h-4 opacity-30" />
    return (
      <ChevronDown
        className={`w-4 h-4 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`}
      />
    )
  }

  const isSplittable = receiveStockProduct?.unit_of_measure && receiveStockProduct.unit_of_measure !== 'quantity'

  const handleReceiveStock = async () => {
    const qty = isSplittable ? parseFloat(receiveQty) : parseInt(receiveQty)
    if (!receiveQty || qty <= 0) return
    setReceiveLoading(true)
    try {
      const body = {
        product_id: receiveStockProduct.id,
        quantity: qty,
      }
      if (receiveSupplierId) body.supplier_id = parseInt(receiveSupplierId)
      if (receiveCostPrice !== '') body.cost_price = parseFloat(receiveCostPrice)

      const { data: result } = await stockApi.receive(body)
      if (result.duplicated) {
        toastSuccess(`${t('inventory.productDuplicated') || 'Created new product for supplier'} (${receiveQty} ${receiveStockProduct.name})`)
      } else {
        toastSuccess(`${t('inventory.received') || 'Received'} ${receiveQty} ${receiveStockProduct.name}`)
      }
      setReceiveStockProduct(null)
      setReceiveQty('')
      setReceiveSupplierId('')
      setReceiveCostPrice('')
      onRefresh?.()
    } catch (err) {
      toastError(err.response?.data?.error || err.message || 'Failed')
    } finally {
      setReceiveLoading(false)
    }
  }

  if (products.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-12 text-center">
        <Package className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('inventory.noProducts')}</h3>
        <p className="text-gray-500 dark:text-gray-400">{t('inventory.addFirstProduct')}</p>
      </div>
    )
  }

  const getStockStatus = (product) => {
    if (product.stock_quantity <= 0) return { label: t('pos.outOfStock') || 'Out of Stock', cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' }
    if (product.stock_quantity <= product.low_stock_threshold) return { label: t('inventory.lowStock') || 'Low Stock', cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' }
    return { label: t('inventory.inStock') || 'In Stock', cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' }
  }

  const getUnitLabel = (unit) => {
    if (unit === 'kilo') return 'kg'
    if (unit === 'liter') return 'L'
    if (unit === 'meter') return 'm'
    return 'pcs'
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-sm">
      {/* Search */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('inventory.searchProducts')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/30">
              <th className="text-start px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">
                <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('inventory.name')} <SortIcon field="name" />
                </button>
              </th>
              <th className="text-start px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                <button onClick={() => handleSort('sku')} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('inventory.sku')} <SortIcon field="sku" />
                </button>
              </th>
              <th className="text-start px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">
                <button onClick={() => handleSort('price')} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('inventory.price')} <SortIcon field="price" />
                </button>
              </th>
              <th className="text-start px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 hidden md:table-cell">
                <button onClick={() => handleSort('stock_quantity')} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('inventory.stock')} <SortIcon field="stock_quantity" />
                </button>
              </th>
              <th className="text-start px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 hidden lg:table-cell">{t('inventory.status')}</th>
              <th className="text-start px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 hidden xl:table-cell">{t('inventory.unitOfMeasure') || 'Unit'}</th>
              <th className="text-start px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 hidden xl:table-cell">{t('inventory.supplier') || 'Supplier'}</th>
              <th className="text-end px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {filteredProducts.map((product) => {
              const stockStatus = getStockStatus(product)
              return (
                <tr key={product.id} className="hover:bg-white dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{product.name}</p>
                        {product.barcode && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{product.barcode}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs hidden sm:table-cell">{product.sku || '-'}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{formatCurrency(product.price)}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${product.stock_quantity <= product.low_stock_threshold ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                        {product.stock_quantity}
                      </span>
                      <span className="text-gray-400 dark:text-gray-500 text-xs">{getUnitLabel(product.unit_of_measure)}</span>
                      {product.stock_quantity <= product.low_stock_threshold && (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${stockStatus.cls}`}>
                      {stockStatus.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs hidden xl:table-cell">{getUnitLabel(product.unit_of_measure)}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs truncate max-w-[120px] hidden xl:table-cell">{product.suppliers?.name || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => onPrintBarcode?.(product)} className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors" title="Print Barcode">
                        <QrCode className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setReceiveStockProduct(product); setReceiveQty(''); setReceiveSupplierId(product.supplier_id?.toString() || ''); setReceiveCostPrice(product.cost_price?.toString() || '') }} className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title={t('inventory.receiveStock') || 'Receive Stock'}>
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      {canEdit && (
                        <button onClick={() => onEdit(product)} className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canEdit && (
                        <button onClick={() => { if (deletingId) return; setDeletingId(product.id); onDelete(product.id).finally(() => setDeletingId(null)) }} disabled={deletingId} className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700/50 text-xs text-gray-500 dark:text-gray-400">
        {t('inventory.showing')} {filteredProducts.length} {t('inventory.of')} {products.length} {t('common.products')}
      </div>

      {/* Receive Stock Modal */}
      {receiveStockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold">{t('inventory.receiveStock') || 'Receive Stock'}</h3>
            <p className="text-sm text-gray-500">{receiveStockProduct.name}</p>

            {/* Supplier Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.supplier') || 'Supplier'}</label>
              <select
                value={receiveSupplierId}
                onChange={e => setReceiveSupplierId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">{t('inventory.noSupplier') || 'No Supplier'}</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {receiveSupplierId && receiveStockProduct.supplier_id && parseInt(receiveSupplierId) !== receiveStockProduct.supplier_id && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {t('inventory.supplierChanged') || 'Supplier changed — a new product will be created for this supplier'}
                </p>
              )}
            </div>

            {/* Cost Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.costPrice') || 'Cost Price'} (EGP)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={receiveCostPrice}
                onChange={e => setReceiveCostPrice(e.target.value)}
                placeholder={receiveStockProduct.cost_price?.toString() || '0'}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.quantity') || 'Quantity'}</label>
              <input
                type="number"
                min={isSplittable ? "0.01" : "1"}
                step={isSplittable ? "0.01" : "1"}
                value={receiveQty}
                onChange={e => setReceiveQty(e.target.value)}
                placeholder={t('inventory.quantity') || 'Quantity'}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-primary-500 text-lg font-bold"
                autoFocus
              />
            </div>

            {/* Total Cost */}
            {receiveQty && parseFloat(receiveQty) > 0 && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('inventory.totalCost') || 'Total Cost'}</span>
                <span className="text-lg font-bold text-primary-600">
                  {((parseFloat(receiveCostPrice) || receiveStockProduct.cost_price || 0) * parseFloat(receiveQty)).toLocaleString('en-EG', { minimumFractionDigits: 2 })} EGP
                </span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleReceiveStock}
                disabled={receiveLoading || !receiveQty || parseFloat(receiveQty) <= 0}
                className="flex-1 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl font-medium"
              >
                {receiveLoading ? '...' : (t('common.save') || 'Save')}
              </button>
              <button
                onClick={() => { setReceiveStockProduct(null); setReceiveQty(''); setReceiveSupplierId(''); setReceiveCostPrice('') }}
                className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl font-medium"
              >
                {t('common.cancel') || 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
