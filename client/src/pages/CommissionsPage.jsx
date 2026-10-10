import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { formatCurrency } from '../lib/utils'
import { commissionsApi, employeesApi } from '../lib/api'
import {
  Award,
  DollarSign,
  CheckCircle,
  Clock,
  Loader2,
  Calendar,
  Search,
  TrendingUp,
  Users,
  Calculator,
  AlertTriangle,
  Package,
  UserCheck,
  ShoppingCart
} from 'lucide-react'

export default function CommissionsPage() {
  const { t, toastSuccess, toastError } = useAppStore()
  const [commissions, setCommissions] = useState([])
  const [stats, setStats] = useState(null)
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [bulkForm, setBulkForm] = useState({ period_start: '', period_end: '' })
  const [setupCheck, setSetupCheck] = useState(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [commissionsRes, statsRes, employeesRes, setupRes] = await Promise.all([
        commissionsApi.getAll({
          status: filter === 'all' ? undefined : filter,
          employee_id: employeeFilter || undefined,
        }),
        commissionsApi.getStats(),
        employeesApi.getAll(),
        commissionsApi.getSetupCheck().catch(() => ({ data: null })),
      ])
      setCommissions(Array.isArray(commissionsRes.data) ? commissionsRes.data : [])
      setStats(statsRes.data)
      setEmployees(employeesRes.data || [])
      const setup = setupRes.data || (commissionsRes.data?.setup_required ? { tableExists: false } : null)
      setSetupCheck(setup)

      // Auto-backfill salesperson on existing orders if setup is good
      if (setup?.tableExists && setup.hasProducts && setup.hasLinkedUsers && !setup.hasSalesOrders) {
        commissionsApi.backfillSalesperson().catch(() => {})
      }
    } catch (err) {
      toastError(err.message || t('commissions.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [filter, employeeFilter])

  const handleApprove = async (id) => {
    try {
      await commissionsApi.approve(id)
      toastSuccess(t('commissions.approved'))
      fetchData()
    } catch (err) {
      toastError(err.response?.data?.error || t('commissions.approveFailed'))
    }
  }

  const handlePay = async (id) => {
    try {
      await commissionsApi.pay(id)
      toastSuccess(t('commissions.markedPaid'))
      fetchData()
    } catch (err) {
      toastError(err.response?.data?.error || t('commissions.markPaidFailed'))
    }
  }

  const handleBulkCalculate = async (e) => {
    e.preventDefault()
    if (!bulkForm.period_start || !bulkForm.period_end) {
      toastError(t('commissions.datesRequired'))
      return
    }
    try {
      setSubmitting(true)
      const res = await commissionsApi.bulkCalculate({
        period_start: bulkForm.period_start,
        period_end: bulkForm.period_end,
      })
      const data = res.data
      toastSuccess(t('commissions.calculated', { count: data.count, orders: data.orders_processed }))
      setShowBulkModal(false)
      setBulkForm({ period_start: '', period_end: '' })
      fetchData()
    } catch (err) {
      toastError(err.response?.data?.error || t('commissions.calculateFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
return'bg-warning-soft text-warning-soft-foreground'
      case 'approved':
return'bg-accent-soft text-accent-soft-foreground'
      case 'paid':
return'bg-success-soft text-success-soft-foreground'
      default:
return'bg-surface-tertiary text-foreground'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />
      case 'approved':
        return <CheckCircle className="h-4 w-4" />
      case 'paid':
        return <DollarSign className="h-4 w-4" />
      default:
        return null
    }
  }

  const filteredCommissions = commissions.filter(c =>
    c.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.order_id?.toString().includes(searchTerm)
  )

  const employeeBreakdown = stats?.byEmployee || []

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
          <Award className="h-6 w-6" />
          {t('commissions') || 'Salesperson Commissions'}
        </h1>
        <button
          onClick={() => setShowBulkModal(true)}
className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
        >
          <Calculator className="h-4 w-4" />
          {t('calculateCommissions') || 'Calculate Commissions'}
        </button>
      </div>

      {/* Setup Guidance Banner */}
      {commissions.length === 0 && setupCheck && !setupCheck.tableExists && (
<div className="bg-danger-soft border border-danger rounded-xl p-5">
          <div className="flex items-start gap-3">
<AlertTriangle className="h-5 w-5 text-danger mt-0.5 flex-shrink-0"/>
            <div>
<h3 className="font-semibold text-danger mb-2">{t('commissions.tableMissing')||'Database Table Missing'}</h3>
<p className="text-sm text-danger mb-2">
                {t('commissions.tableMissingDesc') || 'The commissions table does not exist in the database. You must run the migration SQL.'}
              </p>
<p className="text-xs text-danger-soft-foreground font-mono bg-danger-soft p-2 rounded">
                {t('commissions.tableMissingSQL') || 'Go to Supabase Dashboard → SQL Editor → paste and run the contents of server/migrations/fix-commissions.sql'}
              </p>
            </div>
          </div>
        </div>
      )}
      {commissions.length === 0 && setupCheck && setupCheck.tableExists && !setupCheck.hasProducts && (
<div className="bg-warning-soft border border-warning rounded-xl p-5">
          <div className="flex items-start gap-3">
<AlertTriangle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0"/>
            <div>
<h3 className="font-semibold text-warning mb-2">{t('commissions.setupRequired')||'Commission Setup Required'}</h3>
<ul className="text-sm text-warning space-y-1.5">
                {!setupCheck.hasProducts && (
                  <li className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {t('commissions.setupProducts') || 'Set commission rate on products (Inventory → Edit Product → Commission Rate)'}
                  </li>
                )}
                {!setupCheck.hasLinkedUsers && (
                  <li className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    {t('commissions.setupEmployees') || 'Link users to employees (Employees → Create Employee → assign to user)'}
                  </li>
                )}
                {!setupCheck.hasSalesOrders && (
                  <li className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    {t('commissions.setupOrders') || 'Create orders from POS with a salesperson assigned'}
                  </li>
                )}
              </ul>
<p className="text-xs text-warning mt-2">
                {t('commissions.setupHint') || 'Products: ' + setupCheck.productsWithRate + '/' + setupCheck.totalProducts + ' with rate | Users linked: ' + setupCheck.usersWithEmployee + '/' + setupCheck.totalUsers}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
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
<div className="p-3 bg-accent-soft rounded-lg">
<CheckCircle className="h-5 w-5 text-accent"/>
            </div>
            <div>
<p className="text-sm text-muted">{t('totalApproved')||'Total Approved'}</p>
<p className="text-2xl font-bold text-accent">{formatCurrency(stats?.total_approved || 0)}</p>
            </div>
          </div>
        </div>
<div className="bg-surface rounded-xl shadow-sm border border-border p-5">
          <div className="flex items-center gap-3">
<div className="p-3 bg-success-soft rounded-lg">
<DollarSign className="h-5 w-5 text-success"/>
            </div>
            <div>
<p className="text-sm text-muted">{t('totalPaid')||'Total Paid'}</p>
<p className="text-2xl font-bold text-success">{formatCurrency(stats?.total_paid || 0)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Table */}
        <div className="lg:col-span-3">
<div className="bg-surface rounded-xl shadow-sm border border-border">
<div className="p-5 border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex flex-wrap gap-2">
                  {['all', 'pending', 'approved', 'paid'].map((s) => (
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
                <select
                  value={employeeFilter}
                  onChange={(e) => setEmployeeFilter(e.target.value)}
className="px-3 py-2 border border-border rounded-lg bg-surface text-foreground text-sm ring-focus outline-none"
                >
                  <option value="">{t('allEmployees') || 'All Employees'}</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
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
<th className="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">{t('employee')||'Employee'}</th>
<th className="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">{t('order')||'Order #'}</th>
<th className="px-5 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">{t('saleAmount')||'Sale Amount'}</th>
<th className="px-5 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">{t('rate')||'Rate'}</th>
<th className="px-5 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">{t('commission')||'Commission'}</th>
<th className="px-5 py-3 text-center text-xs font-medium text-muted uppercase tracking-wider">{t('status')||'Status'}</th>
<th className="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">{t('date')||'Date'}</th>
<th className="px-5 py-3 text-center text-xs font-medium text-muted uppercase tracking-wider">{t('actions')||'Actions'}</th>
                  </tr>
                </thead>
<tbody className="divide-y divide-border">
                  {filteredCommissions.length === 0 ? (
                    <tr>
<td colSpan={8}className="px-5 py-10 text-center text-muted">
                        {t('noCommissions') || 'No commissions found'}
                      </td>
                    </tr>
                  ) : (
                    filteredCommissions.map((c) => (
<tr key={c.id}className="bg-surface-hover transition-colors">
<td className="px-5 py-4 text-sm font-medium text-foreground">{c.employee_name}</td>
<td className="px-5 py-4 text-sm text-muted font-mono">#{c.order_id}</td>
<td className="px-5 py-4 text-sm text-right text-foreground">{formatCurrency(c.sale_amount)}</td>
<td className="px-5 py-4 text-sm text-right text-muted">{c.commission_rate}%</td>
<td className="px-5 py-4 text-sm text-right text-success font-semibold">{formatCurrency(c.commission_amount)}</td>
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(c.status)}`}>
                            {getStatusIcon(c.status)}
                            {t(c.status) || c.status}
                          </span>
                        </td>
<td className="px-5 py-4 text-sm text-muted">
                          {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {c.status === 'pending' && (
                              <button
                                onClick={() => handleApprove(c.id)}
className="px-3 py-1 bg-accent text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                              >
                                {t('approve') || 'Approve'}
                              </button>
                            )}
                            {c.status === 'approved' && (
                              <button
                                onClick={() => handlePay(c.id)}
className="px-3 py-1 bg-success text-white text-xs rounded-lg hover:bg-green-700 transition-colors"
                              >
                                {t('markPaid') || 'Mark Paid'}
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
        </div>

        {/* Employee Breakdown */}
        <div className="lg:col-span-1">
<div className="bg-surface rounded-xl shadow-sm border border-border p-5">
<h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
<Users className="h-5 w-5 text-muted"/>
              {t('employeeBreakdown') || 'Employee Breakdown'}
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {employeeBreakdown.length === 0 ? (
<p className="text-sm text-muted text-center py-4">{t('noData')||'No commission data'}</p>
              ) : (
                employeeBreakdown.map((emp) => {
                  const total = emp.total || 0
                  const paidPct = total > 0 ? ((emp.paid || 0) / total * 100) : 0
                  const approvedPct = total > 0 ? ((emp.approved || 0) / total * 100) : 0
                  const pendingPct = total > 0 ? ((emp.pending || 0) / total * 100) : 0
                  return (
<div key={emp.employee_id}className="p-4 bg-surface-secondary rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
<div className="w-10 h-10 rounded-full bg-accent-soft flex items-center justify-center text-sm font-bold text-accent-soft-foreground flex-shrink-0">
                          {(emp.employee_name || '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
<p className="text-sm font-semibold text-foreground truncate">{emp.employee_name}</p>
<p className="text-xs text-muted">{formatCurrency(total)}</p>
                        </div>
                      </div>
<div className="h-1.5 bg-surface-tertiary rounded-full overflow-hidden flex mb-3">
{paidPct>0 &&<div className="h-full bg-success"style={{width:`${paidPct}%`}}/>}
{approvedPct>0 &&<div className="h-full bg-accent"style={{width:`${approvedPct}%`}}/>}
{pendingPct>0 &&<div className="h-full bg-warning"style={{width:`${pendingPct}%`}}/>}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
<p className="text-[10px] uppercase tracking-wide text-warning font-medium">{t('pending')||'Pending'}</p>
<p className="text-xs font-semibold text-foreground">{formatCurrency(emp.pending || 0)}</p>
                        </div>
                        <div>
<p className="text-[10px] uppercase tracking-wide text-accent font-medium">{t('approved')||'Approved'}</p>
<p className="text-xs font-semibold text-foreground">{formatCurrency(emp.approved || 0)}</p>
                        </div>
                        <div>
<p className="text-[10px] uppercase tracking-wide text-success font-medium">{t('paid')||'Paid'}</p>
<p className="text-xs font-semibold text-foreground">{formatCurrency(emp.paid || 0)}</p>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Calculate Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
<div className="bg-surface rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
<h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {t('calculateCommissions') || 'Calculate Commissions'}
              </h3>
<button onClick={()=>setShowBulkModal(false)}className="text-muted text-foreground">
                <span className="text-xl">&times;</span>
              </button>
            </div>
            <form onSubmit={handleBulkCalculate} className="space-y-4">
              <div>
<label className="block text-sm font-medium text-foreground mb-1">{t('periodStart')||'Period Start'}</label>
                <input
                  type="date"
                  value={bulkForm.period_start}
                  onChange={(e) => setBulkForm({ ...bulkForm, period_start: e.target.value })}
className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground ring-focus outline-none"
                  required
                />
              </div>
              <div>
<label className="block text-sm font-medium text-foreground mb-1">{t('periodEnd')||'Period End'}</label>
                <input
                  type="date"
                  value={bulkForm.period_end}
                  onChange={(e) => setBulkForm({ ...bulkForm, period_end: e.target.value })}
className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground ring-focus outline-none"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground bg-surface-hover transition-colors"
                >
                  {t('cancel') || 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
className="flex-1 px-4 py-2 bg-accent text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  <TrendingUp className="h-4 w-4" />
                  {t('calculate') || 'Calculate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
