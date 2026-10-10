import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { formatCurrency } from '../lib/utils'
import { deadStockApi } from '../lib/api'
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
      const res = await deadStockApi.get({
        from_date: dateRange.from,
        to_date: dateRange.to,
        category: categoryFilter === 'all' ? undefined : categoryFilter
      })
      const data = res.data?.items || res.data || []
      setItems(data)

      const cats = [...new Set(data.map((i) => i.category).filter(Boolean))]
      setCategories(cats)
    } catch (err) {
      toastError(err.message || t('inventory.deadStockReportFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [dateRange.from, dateRange.to, categoryFilter])

  const getDaysColor = (days) => {
if(days>=90)return'text-danger-soft-foreground bg-danger-soft'
if(days>=60)return'text-warning-soft-foreground bg-warning-soft'
if(days>=30)return'text-warning-soft-foreground bg-warning-soft'
return'text-muted bg-surface-secondary'
  }

  const getDaysDot = (days) => {
if(days>=90)return'bg-danger'
if(days>=60)return'bg-warning'
if(days>=30)return'bg-warning'
return'bg-surface-tertiary'
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
<Loader2 className="h-8 w-8 animate-spin text-accent"/>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
<h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
<AlertTriangle className="h-6 w-6 text-warning"/>
          {t('deadStockReport') || 'Dead Stock Report'}
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
<div className="bg-surface rounded-xl shadow-sm border border-border p-5">
          <div className="flex items-center gap-3">
<div className="p-3 bg-danger-soft rounded-lg">
<Package className="h-5 w-5 text-danger"/>
            </div>
            <div>
<p className="text-sm text-muted">{t('totalDeadStockItems')||'Total Dead Stock Items'}</p>
<p className="text-2xl font-bold text-foreground">{totalItems}</p>
            </div>
          </div>
        </div>
<div className="bg-surface rounded-xl shadow-sm border border-border p-5">
          <div className="flex items-center gap-3">
<div className="p-3 bg-warning-soft rounded-lg">
<TrendingDown className="h-5 w-5 text-warning"/>
            </div>
            <div>
<p className="text-sm text-muted">{t('totalValueAtRisk')||'Total Value at Risk'}</p>
<p className="text-2xl font-bold text-warning">{formatCurrency(totalValue)}</p>
            </div>
          </div>
        </div>
      </div>

<div className="bg-surface rounded-xl shadow-sm border border-border">
<div className="p-5 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-2">
<Calendar className="h-4 w-4 text-muted"/>
<label className="text-sm font-medium text-foreground">{t('dateRange')||'Date Range'}</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
className="px-3 py-2 border border-border rounded-lg bg-surface text-foreground text-sm ring-focus outline-none"
              />
<span className="text-muted">—</span>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
className="px-3 py-2 border border-border rounded-lg bg-surface text-foreground text-sm ring-focus outline-none"
              />
            </div>
            <div className="flex items-center gap-2 ml-auto">
<Filter className="h-4 w-4 text-muted"/>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
className="px-3 py-2 border border-border rounded-lg bg-surface text-foreground text-sm ring-focus outline-none"
              >
                <option value="all">{t('allCategories') || 'All Categories'}</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

<div className="p-4 border-b border-border flex gap-4 text-xs text-muted">
          <div className="flex items-center gap-1.5">
<span className="w-2 h-2 rounded-full bg-danger"></span>
            {t('over90days') || '90+ days'}
          </div>
          <div className="flex items-center gap-1.5">
<span className="w-2 h-2 rounded-full bg-warning"></span>
            {t('days60to90') || '60-90 days'}
          </div>
          <div className="flex items-center gap-1.5">
<span className="w-2 h-2 rounded-full bg-warning"></span>
            {t('days30to60') || '30-60 days'}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
<tr className="bg-surface-secondary">
<th className="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">{t('product')||'Product'}</th>
<th className="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">{t('category')||'Category'}</th>
<th className="px-5 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">{t('currentStock')||'Current Stock'}</th>
<th className="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">{t('lastSold')||'Last Sold'}</th>
<th className="px-5 py-3 text-center text-xs font-medium text-muted uppercase tracking-wider">{t('daysSinceSale')||'Days Since Sale'}</th>
<th className="px-5 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">{t('stockValue')||'Stock Value'}</th>
<th className="px-5 py-3 text-center text-xs font-medium text-muted uppercase tracking-wider">{t('actions')||'Actions'}</th>
              </tr>
            </thead>
<tbody className="divide-y divide-border">
              {filteredItems.length === 0 ? (
                <tr>
<td colSpan={7}className="px-5 py-10 text-center text-muted">
                    {t('noDeadStockFound') || 'No dead stock items found'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const daysSince = item.days_since_sale || 0
                  const stockVal = item.stock_value || item.current_stock * (item.cost || 0)
                  return (
<tr key={item.id || item.product_id}className="bg-surface-hover transition-colors">
<td className="px-5 py-4 text-sm font-medium text-foreground">{item.product_name}</td>
<td className="px-5 py-4 text-sm text-muted">{item.category ||'—'}</td>
<td className="px-5 py-4 text-sm text-right text-foreground">{item.current_stock}</td>
<td className="px-5 py-4 text-sm text-muted">
                        {item.last_sold_date ? new Date(item.last_sold_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getDaysColor(daysSince)}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${getDaysDot(daysSince)}`}></span>
                          {daysSince} {t('days') || 'days'}
                        </span>
                      </td>
<td className="px-5 py-4 text-sm text-right font-medium text-foreground">{formatCurrency(stockVal)}</td>
                      <td className="px-5 py-4 text-center">
<button className="p-1.5 text-muted hover:text-red-600 transition-colors"title={t('markForClearance')||'Mark for Clearance'}>
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
