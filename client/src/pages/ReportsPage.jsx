import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { reportsApi } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import { BarChart3, TrendingUp, Package, AlertTriangle, DollarSign, Receipt, TrendingDown, Wallet } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

export default function ReportsPage() {
  const { t } = useAppStore()
  const [salesData, setSalesData] = useState(null)
  const [stockData, setStockData] = useState(null)
  const [expenseData, setExpenseData] = useState(null)
  const [profitData, setProfitData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('month')
  const [activeTab, setActiveTab] = useState('sales')

  const dateRanges = [
    { key: 'today', label: t('reports.daily') },
    { key: 'week', label: t('reports.weekly') },
    { key: 'month', label: t('reports.monthly') },
    { key: 'year', label: t('reports.yearly') },
  ]

  useEffect(() => {
    fetchData()
  }, [dateRange])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [salesRes, stockRes, expenseRes, profitRes] = await Promise.all([
        reportsApi.getSales({ range: dateRange }),
        reportsApi.getStock(),
        reportsApi.getExpenses({ range: dateRange }),
        reportsApi.getProfitLoss({ range: dateRange }),
      ])
      setSalesData(salesRes.data)
      setStockData(stockRes.data)
      setExpenseData(expenseRes.data)
      setProfitData(profitRes.data)
    } catch (err) {
      console.error('Failed to fetch reports:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const tabs = [
    { key: 'sales', icon: BarChart3, label: t('reports.sales') },
    { key: 'stock', icon: Package, label: t('reports.stock') },
    { key: 'expenses', icon: Receipt, label: t('reports.expenses') || 'Expenses' },
    { key: 'profit', icon: Wallet, label: t('reports.profitLoss') || 'Profit & Loss' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('reports.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400">{t('reports.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {dateRanges.map((range) => (
            <button
              key={range.key}
              onClick={() => setDateRange(range.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === range.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg w-fit overflow-x-auto">
        {tabs.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === key
                ? 'bg-white dark:bg-gray-600 shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <Icon className="w-4 h-4 inline mr-2" />
            {label}
          </button>
        ))}
      </div>

      {/* ==================== SALES TAB ==================== */}
      {activeTab === 'sales' && salesData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('reports.totalSales')}</p>
                  <p className="text-xl font-bold">{formatCurrency(salesData.totalSales)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('reports.orders')}</p>
                  <p className="text-xl font-bold">{salesData.totalOrders}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('reports.avgOrder')}</p>
                  <p className="text-xl font-bold">{formatCurrency(salesData.avgOrderValue)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Package className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('reports.itemsSold')}</p>
                  <p className="text-xl font-bold">{salesData.itemsSold}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold mb-4">{t('reports.salesTrend')}</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesData.dailySales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                  <Bar dataKey="sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold mb-4">{t('reports.topSellingProducts')}</h3>
            <div className="space-y-3">
              {salesData.topProducts?.map((product, index) => (
                <div key={product.id} className="flex items-center gap-4">
                  <span className="text-lg font-bold text-gray-400 w-8">{index + 1}</span>
                  <div className="flex-1">
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{product.quantitySold} {t('reports.sold')}</p>
                  </div>
                  <p className="font-semibold">{formatCurrency(product.revenue)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== STOCK TAB ==================== */}
      {activeTab === 'stock' && stockData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                  <Package className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('reports.totalProducts')}</p>
                  <p className="text-xl font-bold">{stockData.totalProducts}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('reports.lowStockItems')}</p>
                  <p className="text-xl font-bold text-amber-600">{stockData.lowStockCount}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('reports.stockValue') || 'Stock Value (Sell)'}</p>
                  <p className="text-xl font-bold">{formatCurrency(stockData.totalValue)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <DollarSign className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('reports.totalCost') || 'Total Cost'}</p>
                  <p className="text-xl font-bold">{formatCurrency(stockData.totalCost)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Potential Profit Card */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">{t('reports.potentialProfit') || 'Potential Profit'}</p>
                <p className="text-3xl font-bold mt-1">{formatCurrency(stockData.potentialProfit)}</p>
              </div>
              <TrendingUp className="w-10 h-10 opacity-50" />
            </div>
          </div>

          {stockData.lowStockProducts?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-amber-200 dark:border-amber-800 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-amber-600">
                <AlertTriangle className="w-5 h-5" />
                {t('reports.lowStockAlert')}
              </h3>
              <div className="space-y-3">
                {stockData.lowStockProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{t('reports.threshold')}: {product.low_stock_threshold}</p>
                    </div>
                    <span className="text-lg font-bold text-amber-600">{product.stock_quantity} {t('reports.left')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Products by Cost */}
          {stockData.topByValue?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold mb-4">{t('reports.topByCost') || 'Top Products by Cost'}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 font-semibold">#</th>
                      <th className="text-left py-2 font-semibold">{t('print.productName')}</th>
                      <th className="text-right py-2 font-semibold">{t('print.qty')}</th>
                      <th className="text-right py-2 font-semibold">{t('reports.costPrice') || 'Cost'}</th>
                      <th className="text-right py-2 font-semibold">{t('reports.sellPrice') || 'Sell'}</th>
                      <th className="text-right py-2 font-semibold">{t('reports.totalCost') || 'Total Cost'}</th>
                      <th className="text-right py-2 font-semibold">{t('reports.stockValue') || 'Total Value'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockData.topByValue.map((p, i) => (
                      <tr key={p.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2 text-gray-400">{i + 1}</td>
                        <td className="py-2 font-medium">{p.name}</td>
                        <td className="py-2 text-right">{p.stock}</td>
                        <td className="py-2 text-right">{formatCurrency(p.costPrice)}</td>
                        <td className="py-2 text-right">{formatCurrency(p.sellPrice)}</td>
                        <td className="py-2 text-right font-semibold text-red-600">{formatCurrency(p.totalCost)}</td>
                        <td className="py-2 text-right font-semibold text-green-600">{formatCurrency(p.totalValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold mb-4">{t('reports.stockByCategory')}</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stockData.categoryBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {stockData.categoryBreakdown?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ==================== EXPENSES TAB ==================== */}
      {activeTab === 'expenses' && expenseData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <Receipt className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('reports.totalExpenses') || 'Total Expenses'}</p>
                  <p className="text-xl font-bold text-red-600">{formatCurrency(expenseData.totalExpenses)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <Receipt className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('reports.expenseCount') || 'Number of Expenses'}</p>
                  <p className="text-xl font-bold">{expenseData.expenseCount}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold mb-4">{t('reports.expenseTrend') || 'Expense Trend'}</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expenseData.dailyExpenses}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                  <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {expenseData.categoryBreakdown?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold mb-4">{t('reports.expensesByCategory') || 'Expenses by Category'}</h3>
              <div className="space-y-3">
                {expenseData.categoryBreakdown.map((cat, index) => (
                  <div key={cat.name} className="flex items-center gap-4">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="flex-1 font-medium">{cat.name}</span>
                    <span className="font-bold">{formatCurrency(cat.total)}</span>
                    <span className="text-sm text-gray-400">{((cat.total / expenseData.totalExpenses) * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== PROFIT/LOSS TAB ==================== */}
      {activeTab === 'profit' && profitData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('reports.totalRevenue') || 'Total Revenue'}</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(profitData.totalRevenue)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('reports.totalExpenses') || 'Total Expenses'}</p>
                  <p className="text-xl font-bold text-red-600">{formatCurrency(profitData.totalExpenses)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('reports.totalRefunds') || 'Total Refunds'}</p>
                  <p className="text-xl font-bold text-amber-600">{formatCurrency(profitData.totalRefunds)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Net Revenue & Gross Profit */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">{t('reports.netRevenue') || 'Net Revenue'}</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(profitData.netRevenue)}</p>
                </div>
                <Wallet className="w-10 h-10 opacity-50" />
              </div>
            </div>
            <div className={`bg-gradient-to-r ${profitData.grossProfit >= 0 ? 'from-green-500 to-emerald-600' : 'from-red-500 to-red-600'} rounded-xl p-5 text-white`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">{t('reports.grossProfit') || 'Gross Profit'}</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(profitData.grossProfit)}</p>
                  <p className="text-sm opacity-70 mt-1">{profitData.margin}% {t('reports.margin') || 'margin'}</p>
                </div>
                <TrendingUp className="w-10 h-10 opacity-50" />
              </div>
            </div>
          </div>

          {/* Summary Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold mb-4">{t('reports.summary') || 'Summary'}</h3>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <td className="py-3 font-medium">{t('reports.totalRevenue') || 'Total Revenue'} ({profitData.orderCount} {t('reports.orders')?.toLowerCase() || 'orders'})</td>
                  <td className="py-3 text-right font-bold text-green-600">{formatCurrency(profitData.totalRevenue)}</td>
                </tr>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <td className="py-3 font-medium">- {t('reports.totalRefunds') || 'Total Refunds'} ({profitData.refundCount})</td>
                  <td className="py-3 text-right font-bold text-amber-600">{formatCurrency(profitData.totalRefunds)}</td>
                </tr>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <td className="py-3 font-semibold">{t('reports.netRevenue') || 'Net Revenue'}</td>
                  <td className="py-3 text-right font-bold">{formatCurrency(profitData.netRevenue)}</td>
                </tr>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <td className="py-3 font-medium">- {t('reports.totalExpenses') || 'Total Expenses'} ({profitData.expenseCount})</td>
                  <td className="py-3 text-right font-bold text-red-600">{formatCurrency(profitData.totalExpenses)}</td>
                </tr>
                <tr className="bg-gray-50 dark:bg-gray-700/50">
                  <td className="py-3 text-lg font-bold">{t('reports.grossProfit') || 'Gross Profit'}</td>
                  <td className={`py-3 text-right text-lg font-bold ${profitData.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(profitData.grossProfit)}
                  </td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
