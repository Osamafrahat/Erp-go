import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { formatCurrency } from '../lib/utils'
import { cashShiftsApi } from '../lib/api'
import {
  DollarSign,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Plus,
  X,
  History,
  BarChart3,
  Loader2
} from 'lucide-react'

export default function CashShiftPage() {
  const { t, toastSuccess, toastError } = useAppStore()
  const [activeShift, setActiveShift] = useState(null)
  const [shiftStats, setShiftStats] = useState(null)
  const [shifts, setShifts] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showOpenForm, setShowOpenForm] = useState(false)
  const [showCloseForm, setShowCloseForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [openForm, setOpenForm] = useState({ opening_balance: '', notes: '' })
  const [closeForm, setCloseForm] = useState({ closing_balance: '', actual_cash: '', notes: '' })
  const [elapsedTime, setElapsedTime] = useState('')

  const fetchData = async () => {
    try {
      setLoading(true)
      const [activeRes, shiftsRes, summaryRes, statsRes] = await Promise.all([
        cashShiftsApi.getActive(),
        cashShiftsApi.getAll(),
        cashShiftsApi.getSummary(),
        cashShiftsApi.getActiveStats().catch(() => ({ data: null }))
      ])
      setActiveShift(activeRes.data)
      setShiftStats(statsRes.data)
      setShifts(shiftsRes.data || [])
      setSummary(summaryRes.data)
    } catch (err) {
      toastError(err.message || t('cashShift.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (!activeShift) return
    const timer = setInterval(() => {
      const opened = new Date(activeShift.opened_at)
      const now = new Date()
      const diff = now - opened
      const hours = Math.floor(diff / 3600000)
      const mins = Math.floor((diff % 3600000) / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setElapsedTime(
        `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      )
    }, 1000)
    return () => clearInterval(timer)
  }, [activeShift])

  const handleOpenShift = async (e) => {
    e.preventDefault()
    if (!openForm.opening_balance || parseFloat(openForm.opening_balance) < 0) {
      toastError(t('cashShift.invalidOpeningBalance'))
      return
    }
    try {
      setSubmitting(true)
      await cashShiftsApi.open({
        opening_balance: parseFloat(openForm.opening_balance),
        notes: openForm.notes
      })
      toastSuccess(t('cashShift.opened'))
      setShowOpenForm(false)
      setOpenForm({ opening_balance: '', notes: '' })
      fetchData()
    } catch (err) {
      toastError(err.message || t('cashShift.openFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleCloseShift = async (e) => {
    e.preventDefault()
    if (!closeForm.actual_cash || parseFloat(closeForm.actual_cash) < 0) {
      toastError(t('cashShift.invalidActualCash'))
      return
    }
    try {
      setSubmitting(true)
      await cashShiftsApi.close(activeShift.id, {
        closing_balance: parseFloat(closeForm.closing_balance) || 0,
        actual_cash: parseFloat(closeForm.actual_cash),
        notes: closeForm.notes
      })
      toastSuccess(t('cashShift.closed'))
      setShowCloseForm(false)
      setCloseForm({ closing_balance: '', actual_cash: '', notes: '' })
      fetchData()
    } catch (err) {
      toastError(err.message || t('cashShift.closeFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  // Straight from the server: opening_balance + cash takings − cash refunds.
  // Recomputing it here from total_sales would count card/mobile money the
  // drawer never received and omit the cash it handed back.
  const expectedCash = activeShift
    ? parseFloat(shiftStats?.expected_cash || 0)
    : 0

  const currentVariance = closeForm.actual_cash
    ? parseFloat(closeForm.actual_cash) - expectedCash
    : 0

  const getVarianceColor = (variance) => {
    const v = parseFloat(variance)
if(v===0)return'text-success'
return'text-danger'
  }

  const getStatusBadge = (status) => {
    if (status === 'open') {
return'bg-warning-soft text-warning-soft-foreground'
    }
return'bg-success-soft text-success-soft-foreground'
  }

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
<h1 className="text-2xl font-bold text-foreground">
          {t('cashDrawer') || 'Cash Drawer Reconciliation'}
        </h1>
        {!activeShift && (
          <button
            onClick={() => setShowOpenForm(true)}
className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t('openShift') || 'Open Shift'}
          </button>
        )}
      </div>

      {activeShift && (
<div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          <div className="flex items-center justify-between mb-4">
<h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
<Clock className="h-5 w-5 text-accent"/>
              {t('activeShift') || 'Active Shift'}
            </h2>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge('open')}`}>
              {t('open') || 'Open'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
<div className="bg-surface-secondary rounded-lg p-4">
<p className="text-sm text-muted">{t('cashier')||'Cashier'}</p>
<p className="text-lg font-semibold text-foreground">{activeShift.cashier_name}</p>
            </div>
<div className="bg-surface-secondary rounded-lg p-4">
<p className="text-sm text-muted">{t('openingBalance')||'Opening Balance'}</p>
<p className="text-lg font-semibold text-foreground">{formatCurrency(activeShift.opening_balance)}</p>
            </div>
<div className="bg-surface-secondary rounded-lg p-4">
<p className="text-sm text-muted">{t('expectedCash')||'Expected Cash'}</p>
<p className="text-lg font-semibold text-foreground">{formatCurrency(expectedCash)}</p>
            </div>
<div className="bg-surface-secondary rounded-lg p-4">
<p className="text-sm text-muted">{t('elapsedTime')||'Elapsed Time'}</p>
<p className="text-lg font-mono font-semibold text-foreground">{elapsedTime}</p>
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={() => setShowCloseForm(true)}
className="flex items-center gap-2 px-4 py-2 bg-danger text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <X className="h-4 w-4" />
              {t('closeShift') || 'Close Shift'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
<div className="bg-surface rounded-xl shadow-sm border border-border p-5">
          <div className="flex items-center gap-3">
<div className="p-3 bg-accent-soft rounded-lg">
<History className="h-5 w-5 text-accent"/>
            </div>
            <div>
<p className="text-sm text-muted">{t('totalShifts')||'Total Shifts'}</p>
<p className="text-2xl font-bold text-foreground">{summary?.total_shifts || shifts.length}</p>
            </div>
          </div>
        </div>
<div className="bg-surface rounded-xl shadow-sm border border-border p-5">
          <div className="flex items-center gap-3">
<div className="p-3 bg-warning-soft rounded-lg">
<AlertTriangle className="h-5 w-5 text-warning"/>
            </div>
            <div>
<p className="text-sm text-muted">{t('averageVariance')||'Average Variance'}</p>
              <p className={`text-2xl font-bold ${getVarianceColor(summary?.average_variance || 0)}`}>
                {formatCurrency(summary?.average_variance || 0)}
              </p>
            </div>
          </div>
        </div>
<div className="bg-surface rounded-xl shadow-sm border border-border p-5">
          <div className="flex items-center gap-3">
<div className="p-3 bg-success-soft rounded-lg">
<TrendingUp className="h-5 w-5 text-success"/>
            </div>
            <div>
<p className="text-sm text-muted">{t('totalProfit')||'Total Profit'}</p>
<p className="text-2xl font-bold text-foreground">{formatCurrency(summary?.total_profit || 0)}</p>
            </div>
          </div>
        </div>
      </div>

<div className="bg-surface rounded-xl shadow-sm border border-border">
<div className="p-5 border-b border-border">
<h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
<BarChart3 className="h-5 w-5 text-muted"/>
            {t('shiftHistory') || 'Shift History'}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
<tr className="bg-surface-secondary">
<th className="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">{t('cashier')||'Cashier'}</th>
<th className="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">{t('opened')||'Opened'}</th>
<th className="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">{t('closed')||'Closed'}</th>
<th className="px-5 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">{t('opening')||'Opening'}</th>
<th className="px-5 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">{t('expected')||'Expected'}</th>
<th className="px-5 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">{t('actual')||'Actual'}</th>
<th className="px-5 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">{t('variance')||'Variance'}</th>
<th className="px-5 py-3 text-center text-xs font-medium text-muted uppercase tracking-wider">{t('status')||'Status'}</th>
              </tr>
            </thead>
<tbody className="divide-y divide-border">
              {shifts.length === 0 ? (
                <tr>
<td colSpan={8}className="px-5 py-10 text-center text-muted">
                    {t('noShiftsFound') || 'No shifts found'}
                  </td>
                </tr>
              ) : (
                shifts.map((shift) => (
<tr key={shift.id}className="bg-surface-hover transition-colors">
<td className="px-5 py-4 text-sm font-medium text-foreground">{shift.cashier_name}</td>
<td className="px-5 py-4 text-sm text-muted">{new Date(shift.opened_at).toLocaleString()}</td>
<td className="px-5 py-4 text-sm text-muted">
                      {shift.closed_at ? new Date(shift.closed_at).toLocaleString() : '—'}
                    </td>
<td className="px-5 py-4 text-sm text-right text-foreground">{formatCurrency(shift.opening_balance)}</td>
<td className="px-5 py-4 text-sm text-right text-foreground">
                      {shift.status === 'closed'
                        ? formatCurrency(parseFloat(shift.opening_balance || 0) + parseFloat(shift.closing_balance || 0))
                        : formatCurrency(shift.opening_balance)}
                    </td>
<td className="px-5 py-4 text-sm text-right text-foreground">
                      {shift.actual_cash != null ? formatCurrency(shift.actual_cash) : '—'}
                    </td>
                    <td className={`px-5 py-4 text-sm text-right font-medium ${getVarianceColor(shift.variance || 0)}`}>
                      {shift.variance != null ? formatCurrency(shift.variance) : '—'}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(shift.status)}`}>
                        {shift.status === 'open' ? (t('open') || 'Open') : (t('closed') || 'Closed')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showOpenForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
<div className="bg-surface rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
<h3 className="text-lg font-semibold text-foreground">{t('openShift')||'Open Shift'}</h3>
<button onClick={()=>setShowOpenForm(false)}className="text-muted text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleOpenShift} className="space-y-4">
              <div>
<label className="block text-sm font-medium text-foreground mb-1">{t('openingBalance')||'Opening Balance'}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={openForm.opening_balance}
                  onChange={(e) => setOpenForm({ ...openForm, opening_balance: e.target.value })}
className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground ring-focus outline-none"
                  required
                />
              </div>
              <div>
<label className="block text-sm font-medium text-foreground mb-1">{t('notes')||'Notes'}</label>
                <textarea
                  value={openForm.notes}
                  onChange={(e) => setOpenForm({ ...openForm, notes: e.target.value })}
className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground ring-focus outline-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-2">
<button type="button"onClick={()=>setShowOpenForm(false)}className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground bg-surface-hover transition-colors">
                  {t('cancel') || 'Cancel'}
                </button>
<button type="submit"disabled={submitting}className="flex-1 px-4 py-2 bg-accent text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('open') || 'Open'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCloseForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
<div className="bg-surface rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
<h3 className="text-lg font-semibold text-foreground">{t('closeShift')||'Close Shift'}</h3>
<button onClick={()=>setShowCloseForm(false)}className="text-muted text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
<div className="bg-surface-secondary rounded-lg p-4 mb-4">
              <div className="flex justify-between text-sm">
<span className="text-muted">{t('expectedCash')||'Expected Cash'}</span>
<span className="font-medium text-foreground">{formatCurrency(expectedCash)}</span>
              </div>
            </div>
            <form onSubmit={handleCloseShift} className="space-y-4">
              <div>
<label className="block text-sm font-medium text-foreground mb-1">{t('closingBalance')||'Closing Balance(collected)'}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={closeForm.closing_balance}
                  onChange={(e) => setCloseForm({ ...closeForm, closing_balance: e.target.value })}
className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground ring-focus outline-none"
                  placeholder="0.00"
                />
              </div>
              <div>
<label className="block text-sm font-medium text-foreground mb-1">{t('actualCash')||'Actual Cash(counted)'}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={closeForm.actual_cash}
                  onChange={(e) => setCloseForm({ ...closeForm, actual_cash: e.target.value })}
className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground ring-focus outline-none"
                  required
                />
              </div>
              {closeForm.actual_cash && (
<div className={`rounded-lg p-3 ${currentVariance===0 ?'bg-success-soft':'bg-danger-soft'}`}>
                  <div className="flex items-center gap-2">
                    {currentVariance === 0 ? (
<TrendingUp className="h-4 w-4 text-success"/>
                    ) : (
<TrendingDown className="h-4 w-4 text-danger"/>
                    )}
<span className={`text-sm font-medium ${currentVariance===0 ?'text-success':'text-danger'}`}>
                      {t('variance') || 'Variance'}: {formatCurrency(currentVariance)}
                    </span>
                  </div>
                </div>
              )}
              <div>
<label className="block text-sm font-medium text-foreground mb-1">{t('notes')||'Notes'}</label>
                <textarea
                  value={closeForm.notes}
                  onChange={(e) => setCloseForm({ ...closeForm, notes: e.target.value })}
className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground ring-focus outline-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-2">
<button type="button"onClick={()=>setShowCloseForm(false)}className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground bg-surface-hover transition-colors">
                  {t('cancel') || 'Cancel'}
                </button>
<button type="submit"disabled={submitting}className="flex-1 px-4 py-2 bg-danger text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('close') || 'Close'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
