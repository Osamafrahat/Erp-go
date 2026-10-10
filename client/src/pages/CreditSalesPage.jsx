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

  const fetchData = async () => {
    try {
      setLoading(true)
      const [salesRes, statsRes] = await Promise.all([
        creditSalesApi.getAll({ status: filter === 'all' ? undefined : filter }),
        creditSalesApi.getStats()
      ])
      const roundedSales = (salesRes.data || []).map(s => ({
        ...s,
        total_amount: Math.round(parseFloat(s.total_amount || 0) * 100) / 100,
        paid_amount: Math.round(parseFloat(s.paid_amount || 0) * 100) / 100,
        remaining_amount: Math.round(parseFloat(s.remaining_amount || 0) * 100) / 100,
      }))
      setSales(roundedSales)
      setStats(statsRes.data)
    } catch (err) {
      toastError(err.message || t('creditSales.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [filter])

  const getCustomerName = (sale) => sale.customers?.name || sale.customer_name || '—'
  const getOrderRef = (sale) => sale.orders?.order_number || sale.orders?.id || '—'

  const openPaymentModal = (sale) => {
    const rounded = Math.round(parseFloat(sale.remaining_amount || 0) * 100) / 100
    setSelectedSale({ ...sale, remaining_amount: rounded })
    setPaymentForm({
      amount: rounded.toString() || '',
      method: 'cash',
      reference: ''
    })
    setShowPaymentModal(true)
  }

  const handleRecordPayment = async (e) => {
    e.preventDefault()
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toastError(t('creditSales.invalidPaymentAmount'))
      return
    }
    if (parseFloat(paymentForm.amount) > parseFloat(selectedSale.remaining_amount)) {
      toastError(t('creditSales.exceedsBalance'))
      return
    }
    try {
      setSubmitting(true)
      await creditSalesApi.pay(selectedSale.id, {
        amount: parseFloat(paymentForm.amount),
        payment_method: paymentForm.method,
        reference: paymentForm.reference
      })
      toastSuccess(t('creditSales.paymentRecorded'))
      setShowPaymentModal(false)
      setSelectedSale(null)
      fetchData()
    } catch (err) {
      toastError(err.message || t('creditSales.recordPaymentFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
return'bg-warning-soft text-warning-soft-foreground'
      case 'partial':
return'bg-accent-soft text-accent-soft-foreground'
      case 'paid':
return'bg-success-soft text-success-soft-foreground'
      case 'overdue':
return'bg-danger-soft text-danger-soft-foreground'
      default:
return'bg-surface-tertiary text-foreground'
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
      getCustomerName(s).toLowerCase().includes(searchTerm.toLowerCase()) ||
      getOrderRef(s).toString().toLowerCase().includes(searchTerm.toLowerCase())
  )

  const buildCustomerBalances = () => {
    const map = {}
    sales.forEach((s) => {
      if (s.status === 'paid') return
      const name = getCustomerName(s)
      if (!map[s.customer_id]) {
        map[s.customer_id] = { name, total_owed: 0, sale_count: 0 }
      }
      map[s.customer_id].total_owed += parseFloat(s.remaining_amount || 0)
      map[s.customer_id].sale_count += 1
    })
    return Object.values(map).sort((a, b) => b.total_owed - a.total_owed)
  }

  const balances = buildCustomerBalances()

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
          <CreditCard className="h-6 w-6" />
          {t('creditSales') || 'Credit Sales / Accounts Receivable'}
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
<div className="bg-surface rounded-xl shadow-sm border border-border p-5">
          <div className="flex items-center gap-3">
<div className="p-3 bg-warning-soft rounded-lg">
<Clock className="h-5 w-5 text-warning"/>
            </div>
            <div>
<p className="text-sm text-muted">{t('totalPending')||'Total Pending'}</p>
<p className="text-2xl font-bold text-foreground">{formatCurrency(stats?.total_pending || 0)}</p>
            </div>
          </div>
        </div>
<div className="bg-surface rounded-xl shadow-sm border border-border p-5">
          <div className="flex items-center gap-3">
<div className="p-3 bg-danger-soft rounded-lg">
<AlertTriangle className="h-5 w-5 text-danger"/>
            </div>
            <div>
<p className="text-sm text-muted">{t('totalOverdue')||'Total Overdue'}</p>
<p className="text-2xl font-bold text-danger">{formatCurrency(stats?.total_overdue || 0)}</p>
            </div>
          </div>
        </div>
<div className="bg-surface rounded-xl shadow-sm border border-border p-5">
          <div className="flex items-center gap-3">
<div className="p-3 bg-success-soft rounded-lg">
<CheckCircle className="h-5 w-5 text-success"/>
            </div>
            <div>
<p className="text-sm text-muted">{t('totalCollected')||'Total Collected'}</p>
<p className="text-2xl font-bold text-success">{formatCurrency(stats?.total_collected || 0)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
<div className="bg-surface rounded-xl shadow-sm border border-border">
<div className="p-5 border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex flex-wrap gap-2">
                  {['all', 'pending', 'partial', 'paid', 'overdue'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setFilter(s)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        filter === s
?'bg-accent text-white'
:'bg-surface-tertiary text-muted bg-surface-hover'
                      }`}
                    >
                      {t(s) || s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="relative flex-1 max-w-xs">
<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted"/>
                  <input
                    type="text"
                    placeholder={t('search') || 'Search...'}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-surface text-foreground ring-focus outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
<tr className="bg-surface-secondary">
<th className="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">{t('customer')||'Customer'}</th>
<th className="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">{t('order')||'Order #'}</th>
<th className="px-5 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">{t('total')||'Total'}</th>
<th className="px-5 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">{t('paid')||'Paid'}</th>
<th className="px-5 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">{t('remaining')||'Remaining'}</th>
<th className="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">{t('dueDate')||'Due Date'}</th>
<th className="px-5 py-3 text-center text-xs font-medium text-muted uppercase tracking-wider">{t('status')||'Status'}</th>
<th className="px-5 py-3 text-center text-xs font-medium text-muted uppercase tracking-wider">{t('actions')||'Actions'}</th>
                  </tr>
                </thead>
<tbody className="divide-y divide-border">
                  {filteredSales.length === 0 ? (
                    <tr>
<td colSpan={8}className="px-5 py-10 text-center text-muted">
                        {t('noCreditSales') || 'No credit sales found'}
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((sale) => (
<tr key={sale.id}className="bg-surface-hover transition-colors">
<td className="px-5 py-4 text-sm font-medium text-foreground">{getCustomerName(sale)}</td>
<td className="px-5 py-4 text-sm text-muted font-mono">{getOrderRef(sale)}</td>
<td className="px-5 py-4 text-sm text-right text-foreground">{formatCurrency(sale.total_amount)}</td>
<td className="px-5 py-4 text-sm text-right text-success">{formatCurrency(sale.paid_amount)}</td>
<td className="px-5 py-4 text-sm text-right text-danger font-medium">{formatCurrency(sale.remaining_amount)}</td>
<td className="px-5 py-4 text-sm text-muted">
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
className="px-3 py-1 bg-accent text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
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
<div className="bg-surface rounded-xl shadow-sm border border-border p-5">
<h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
<Wallet className="h-5 w-5 text-muted"/>
              {t('customerBalances') || 'Customer Balances'}
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {balances.length === 0 ? (
<p className="text-sm text-muted text-center py-4">{t('noOutstanding')||'No outstanding balances'}</p>
              ) : (
                balances.map((b, idx) => (
<div key={idx}className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg">
                    <div className="flex items-center gap-2">
<div className="p-1.5 bg-surface-tertiary rounded-full">
<User className="h-3 w-3 text-muted"/>
                      </div>
                      <div>
<p className="text-sm font-medium text-foreground">{b.name}</p>
<p className="text-xs text-muted">{b.sale_count}{t('sales')||'sales'}</p>
                      </div>
                    </div>
<span className="text-sm font-semibold text-danger">{formatCurrency(b.total_owed)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {showPaymentModal && selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
<div className="bg-surface rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
<h3 className="text-lg font-semibold text-foreground">{t('recordPayment')||'Record Payment'}</h3>
<button onClick={()=>setShowPaymentModal(false)}className="text-muted text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
<div className="bg-surface-secondary rounded-lg p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm">
<span className="text-muted">{t('customer')||'Customer'}</span>
<span className="font-medium text-foreground">{getCustomerName(selectedSale)}</span>
              </div>
              <div className="flex justify-between text-sm">
<span className="text-muted">{t('order')||'Order'}</span>
<span className="font-medium text-foreground">{getOrderRef(selectedSale)}</span>
              </div>
              <div className="flex justify-between text-sm">
<span className="text-muted">{t('remaining')||'Remaining'}</span>
<span className="font-semibold text-danger">{formatCurrency(selectedSale.remaining_amount)}</span>
              </div>
            </div>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
<label className="block text-sm font-medium text-foreground mb-1">{t('amount')||'Amount'}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedSale.remaining_amount}
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground ring-focus outline-none"
                  required
                />
              </div>
              <div>
<label className="block text-sm font-medium text-foreground mb-1">{t('method')||'Payment Method'}</label>
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground ring-focus outline-none"
                >
                  <option value="cash">{t('cash') || 'Cash'}</option>
                  <option value="card">{t('card') || 'Card'}</option>
                  <option value="transfer">{t('transfer') || 'Bank Transfer'}</option>
                  <option value="check">{t('check') || 'Check'}</option>
                  <option value="other">{t('other') || 'Other'}</option>
                </select>
              </div>
              <div>
<label className="block text-sm font-medium text-foreground mb-1">{t('reference')||'Reference'}</label>
                <input
                  type="text"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground ring-focus outline-none"
                  placeholder={t('optionalReference') || 'Optional reference number'}
                />
              </div>
              <div className="flex gap-3 pt-2">
<button type="button"onClick={()=>setShowPaymentModal(false)}className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground bg-surface-hover transition-colors">
                  {t('cancel') || 'Cancel'}
                </button>
<button type="submit"disabled={submitting}className="flex-1 px-4 py-2 bg-success text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
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
