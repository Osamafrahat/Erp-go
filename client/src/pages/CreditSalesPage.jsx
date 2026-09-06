import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { formatCurrency } from '../lib/utils'
import { creditSalesApi } from '../lib/api'
import {
  CreditCard,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  X,
  Loader2,
  Wallet,
  User
} from 'lucide-react'

export default function CreditSalesPage() {
  const { t, toastSuccess, toastError } = useAppStore()
  const [sales, setSales] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedSale, setSelectedSale] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'cash',
    reference: ''
  })
  const [customerBalances, setCustomerBalances] = useState([])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [salesRes, statsRes] = await Promise.all([
        creditSalesApi.getAll({ status: filter === 'all' ? undefined : filter }),
        creditSalesApi.getStats()
      ])
      setSales(salesRes.data || [])
      setStats(statsRes.data)
    } catch (err) {
      toastError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [filter])

  const openPaymentModal = (sale) => {
    setSelectedSale(sale)
    setPaymentForm({
      amount: sale.remaining?.toString() || '',
      method: 'cash',
      reference: ''
    })
    setShowPaymentModal(true)
  }

  const handleRecordPayment = async (e) => {
    e.preventDefault()
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toastError('Please enter a valid payment amount')
      return
    }
    if (parseFloat(paymentForm.amount) > parseFloat(selectedSale.remaining)) {
      toastError('Payment amount cannot exceed remaining balance')
      return
    }
    try {
      setSubmitting(true)
      await creditSalesApi.pay(selectedSale.id, {
        amount: parseFloat(paymentForm.amount),
        method: paymentForm.method,
        reference: paymentForm.reference
      })
      toastSuccess('Payment recorded successfully')
      setShowPaymentModal(false)
      setSelectedSale(null)
      fetchData()
    } catch (err) {
      toastError(err.message || 'Failed to record payment')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      case 'partial':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'overdue':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />
      case 'partial':
        return <DollarSign className="h-4 w-4" />
      case 'paid':
        return <CheckCircle className="h-4 w-4" />
      case 'overdue':
        return <AlertTriangle className="h-4 w-4" />
      default:
        return null
    }
  }

  const filteredSales = sales.filter(
    (s) =>
      s.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.order_number?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const buildCustomerBalances = () => {
    const map = {}
    sales.forEach((s) => {
      if (s.status === 'paid') return
      if (!map[s.customer_id]) {
        map[s.customer_id] = { name: s.customer_name, total_owed: 0, sale_count: 0 }
      }
      map[s.customer_id].total_owed += parseFloat(s.remaining || 0)
      map[s.customer_id].sale_count += 1
    })
    return Object.values(map).sort((a, b) => b.total_owed - a.total_owed)
  }

  const balances = buildCustomerBalances()

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
          <CreditCard className="h-6 w-6" />
          {t('creditSales') || 'Credit Sales / Accounts Receivable'}
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('totalPending') || 'Total Pending'}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats?.total_pending || 0)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('totalOverdue') || 'Total Overdue'}</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(stats?.total_overdue || 0)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('totalCollected') || 'Total Collected'}</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(stats?.total_collected || 0)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex flex-wrap gap-2">
                  {['all', 'pending', 'partial', 'paid', 'overdue'].map((s) => (
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
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('customer') || 'Customer'}</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('order') || 'Order #'}</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('total') || 'Total'}</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('paid') || 'Paid'}</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('remaining') || 'Remaining'}</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('dueDate') || 'Due Date'}</th>
                    <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('status') || 'Status'}</th>
                    <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('actions') || 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-10 text-center text-gray-500 dark:text-gray-400">
                        {t('noCreditSales') || 'No credit sales found'}
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-5 py-4 text-sm font-medium text-gray-900 dark:text-white">{sale.customer_name}</td>
                        <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300 font-mono">{sale.order_number}</td>
                        <td className="px-5 py-4 text-sm text-right text-gray-900 dark:text-white">{formatCurrency(sale.total)}</td>
                        <td className="px-5 py-4 text-sm text-right text-green-600 dark:text-green-400">{formatCurrency(sale.paid)}</td>
                        <td className="px-5 py-4 text-sm text-right text-red-600 dark:text-red-400 font-medium">{formatCurrency(sale.remaining)}</td>
                        <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300">
                          {sale.due_date ? new Date(sale.due_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(sale.status)}`}>
                            {getStatusIcon(sale.status)}
                            {t(sale.status) || sale.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          {sale.status !== 'paid' && (
                            <button
                              onClick={() => openPaymentModal(sale)}
                              className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              {t('recordPayment') || 'Record Payment'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-gray-500" />
              {t('customerBalances') || 'Customer Balances'}
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {balances.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">{t('noOutstanding') || 'No outstanding balances'}</p>
              ) : (
                balances.map((b, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-gray-200 dark:bg-gray-600 rounded-full">
                        <User className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{b.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{b.sale_count} {t('sales') || 'sales'}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-red-600 dark:text-red-400">{formatCurrency(b.total_owed)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {showPaymentModal && selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('recordPayment') || 'Record Payment'}</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">{t('customer') || 'Customer'}</span>
                <span className="font-medium text-gray-900 dark:text-white">{selectedSale.customer_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">{t('order') || 'Order'}</span>
                <span className="font-medium text-gray-900 dark:text-white">{selectedSale.order_number}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">{t('remaining') || 'Remaining'}</span>
                <span className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(selectedSale.remaining)}</span>
              </div>
            </div>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('amount') || 'Amount'}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedSale.remaining}
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('method') || 'Payment Method'}</label>
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="cash">{t('cash') || 'Cash'}</option>
                  <option value="card">{t('card') || 'Card'}</option>
                  <option value="transfer">{t('transfer') || 'Bank Transfer'}</option>
                  <option value="check">{t('check') || 'Check'}</option>
                  <option value="other">{t('other') || 'Other'}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('reference') || 'Reference'}</label>
                <input
                  type="text"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder={t('optionalReference') || 'Optional reference number'}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  {t('cancel') || 'Cancel'}
                </button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('recordPayment') || 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
