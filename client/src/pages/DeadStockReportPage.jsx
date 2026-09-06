import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { formatCurrency } from '../lib/utils'
import { reportsApi } from '../lib/api'
import {
  AlertTriangle,
  Calendar,
  Filter,
  Loader2,
  Package,
  TrendingDown,
  Trash2
} from 'lucide-react'

export default function DeadStockReportPage() {
  const { t, toastSuccess, toastError } = useAppStore()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    from: getDefaultFromDate(),
    to: getDefaultToDate()
  })
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [categories, setCategories] = useState([])

  function getDefaultFromDate() {
    const d = new Date()
    d.setDate(d.getDate() - 90)
    return d.toISOString().split('T')[0]
  }

  function getDefaultToDate() {
    return new Date().toISOString().split('T')[0]
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await reportsApi.getDeadStock({
        from_date: dateRange.from,
        to_date: dateRange.to,
        category: categoryFilter === 'all' ? undefined : categoryFilter
      })
      const data = res.data || []
      setItems(data)

      const cats = [...new Set(data.map((i) => i.category).filter(Boolean))]
      setCategories(cats)
    } catch (err) {
      toastError(err.message || 'Failed to load dead stock report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [dateRange.from, dateRange.to, categoryFilter])

  const getDaysColor = (days) => {
    if (days >= 90) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
    if (days >= 60) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
    if (days >= 30) return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20'
    return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50'
  }

  const getDaysDot = (days) => {
    if (days >= 90) return 'bg-red-500'
    if (days >= 60) return 'bg-yellow-500'
    if (days >= 30) return 'bg-orange-500'
    return 'bg-gray-400'
  }

  const totalItems = items.length
  const totalValue = items.reduce((sum, i) => sum + (i.stock_value || i.current_stock * i.cost || 0), 0)

  const filteredItems = items.filter(
    (i) =>
      i.product_name?.toLowerCase().includes('') &&
      (categoryFilter === 'all' || i.category === categoryFilter)
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-orange-500" />
          {t('deadStockReport') || 'Dead Stock Report'}
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <Package className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('totalDeadStockItems') || 'Total Dead Stock Items'}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalItems}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <TrendingDown className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('totalValueAtRisk') || 'Total Value at Risk'}</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(totalValue)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('dateRange') || 'Date Range'}</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <span className="text-gray-400">—</span>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">{t('allCategories') || 'All Categories'}</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            {t('over90days') || '90+ days'}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
            {t('days60to90') || '60-90 days'}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            {t('days30to60') || '30-60 days'}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('product') || 'Product'}</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('category') || 'Category'}</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('currentStock') || 'Current Stock'}</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('lastSold') || 'Last Sold'}</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('daysSinceSale') || 'Days Since Sale'}</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('stockValue') || 'Stock Value'}</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('actions') || 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-500 dark:text-gray-400">
                    {t('noDeadStockFound') || 'No dead stock items found'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const daysSince = item.days_since_sale || 0
                  const stockVal = item.stock_value || item.current_stock * (item.cost || 0)
                  return (
                    <tr key={item.id || item.product_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-5 py-4 text-sm font-medium text-gray-900 dark:text-white">{item.product_name}</td>
                      <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300">{item.category || '—'}</td>
                      <td className="px-5 py-4 text-sm text-right text-gray-900 dark:text-white">{item.current_stock}</td>
                      <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {item.last_sold_date ? new Date(item.last_sold_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getDaysColor(daysSince)}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${getDaysDot(daysSince)}`}></span>
                          {daysSince} {t('days') || 'days'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-right font-medium text-gray-900 dark:text-white">{formatCurrency(stockVal)}</td>
                      <td className="px-5 py-4 text-center">
                        <button className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors" title={t('markForClearance') || 'Mark for Clearance'}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
