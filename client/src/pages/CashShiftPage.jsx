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
  const [shifts, setShifts] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showOpenForm, setShowOpenForm] = useState(false)
  const [showCloseForm, setShowCloseForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [openForm, setOpenForm] = useState({ opening_balance: '', notes: '' })
  const [closeForm, setCloseForm] = useState({ actual_cash: '', notes: '' })
  const [elapsedTime, setElapsedTime] = useState('')

  const fetchData = async () => {
    try {
      setLoading(true)
      const [activeRes, shiftsRes, summaryRes] = await Promise.all([
        cashShiftsApi.getActive(),
        cashShiftsApi.getAll(),
        cashShiftsApi.getSummary()
      ])
      setActiveShift(activeRes.data)
      setShifts(shiftsRes.data || [])
      setSummary(summaryRes.data)
    } catch (err) {
      toastError(err.message || 'Failed to load data')
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
      toastError('Please enter a valid opening balance')
      return
    }
    try {
      setSubmitting(true)
      await cashShiftsApi.open({
        opening_balance: parseFloat(openForm.opening_balance),
        notes: openForm.notes
      })
      toastSuccess('Cash shift opened successfully')
      setShowOpenForm(false)
      setOpenForm({ opening_balance: '', notes: '' })
      fetchData()
    } catch (err) {
      toastError(err.message || 'Failed to open shift')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCloseShift = async (e) => {
    e.preventDefault()
    if (!closeForm.actual_cash || parseFloat(closeForm.actual_cash) < 0) {
      toastError('Please enter a valid actual cash amount')
      return
    }
    try {
      setSubmitting(true)
      await cashShiftsApi.close(activeShift.id, {
        actual_cash: parseFloat(closeForm.actual_cash),
        notes: closeForm.notes
      })
      toastSuccess('Cash shift closed successfully')
      setShowCloseForm(false)
      setCloseForm({ actual_cash: '', notes: '' })
      fetchData()
    } catch (err) {
      toastError(err.message || 'Failed to close shift')
    } finally {
      setSubmitting(false)
    }
  }

  const expectedCash = activeShift
    ? parseFloat(activeShift.opening_balance || 0)
    : 0

  const currentVariance = closeForm.actual_cash
    ? parseFloat(closeForm.actual_cash) - expectedCash
    : 0

  const getVarianceColor = (variance) => {
    const v = parseFloat(variance)
    if (v === 0) return 'text-green-600 dark:text-green-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getStatusBadge = (status) => {
    if (status === 'open') {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
    }
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
  }

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('cashDrawer') || 'Cash Drawer Reconciliation'}
        </h1>
        {!activeShift && (
          <button
            onClick={() => setShowOpenForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t('openShift') || 'Open Shift'}
          </button>
        )}
      </div>

      {activeShift && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              {t('activeShift') || 'Active Shift'}
            </h2>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge('open')}`}>
              {t('open') || 'Open'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('cashier') || 'Cashier'}</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{activeShift.cashier_name}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('openingBalance') || 'Opening Balance'}</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(activeShift.opening_balance)}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('expectedCash') || 'Expected Cash'}</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(expectedCash)}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('elapsedTime') || 'Elapsed Time'}</p>
              <p className="text-lg font-mono font-semibold text-gray-900 dark:text-white">{elapsedTime}</p>
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={() => setShowCloseForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <X className="h-4 w-4" />
              {t('closeShift') || 'Close Shift'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <History className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('totalShifts') || 'Total Shifts'}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary?.total_shifts || shifts.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('averageVariance') || 'Average Variance'}</p>
              <p className={`text-2xl font-bold ${getVarianceColor(summary?.average_variance || 0)}`}>
                {formatCurrency(summary?.average_variance || 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('totalProfit') || 'Total Profit'}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(summary?.total_profit || 0)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-gray-500" />
            {t('shiftHistory') || 'Shift History'}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('cashier') || 'Cashier'}</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('opened') || 'Opened'}</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('closed') || 'Closed'}</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('opening') || 'Opening'}</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('expected') || 'Expected'}</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('actual') || 'Actual'}</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('variance') || 'Variance'}</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('status') || 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {shifts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-gray-500 dark:text-gray-400">
                    {t('noShiftsFound') || 'No shifts found'}
                  </td>
                </tr>
              ) : (
                shifts.map((shift) => (
                  <tr key={shift.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-5 py-4 text-sm font-medium text-gray-900 dark:text-white">{shift.cashier_name}</td>
                    <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300">{new Date(shift.opened_at).toLocaleString()}</td>
                    <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300">
                      {shift.closed_at ? new Date(shift.closed_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-5 py-4 text-sm text-right text-gray-900 dark:text-white">{formatCurrency(shift.opening_balance)}</td>
                    <td className="px-5 py-4 text-sm text-right text-gray-900 dark:text-white">
                      {shift.status === 'closed'
                        ? formatCurrency(parseFloat(shift.opening_balance || 0) + parseFloat(shift.closing_balance || 0))
                        : formatCurrency(shift.opening_balance)}
                    </td>
                    <td className="px-5 py-4 text-sm text-right text-gray-900 dark:text-white">
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
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('openShift') || 'Open Shift'}</h3>
              <button onClick={() => setShowOpenForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleOpenShift} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('openingBalance') || 'Opening Balance'}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={openForm.opening_balance}
                  onChange={(e) => setOpenForm({ ...openForm, opening_balance: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('notes') || 'Notes'}</label>
                <textarea
                  value={openForm.notes}
                  onChange={(e) => setOpenForm({ ...openForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowOpenForm(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  {t('cancel') || 'Cancel'}
                </button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
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
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('closeShift') || 'Close Shift'}</h3>
              <button onClick={() => setShowCloseForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">{t('expectedCash') || 'Expected Cash'}</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(expectedCash)}</span>
              </div>
            </div>
            <form onSubmit={handleCloseShift} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('actualCash') || 'Actual Cash'}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={closeForm.actual_cash}
                  onChange={(e) => setCloseForm({ ...closeForm, actual_cash: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              {closeForm.actual_cash && (
                <div className={`rounded-lg p-3 ${currentVariance === 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                  <div className="flex items-center gap-2">
                    {currentVariance === 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                    )}
                    <span className={`text-sm font-medium ${currentVariance === 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                      {t('variance') || 'Variance'}: {formatCurrency(currentVariance)}
                    </span>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('notes') || 'Notes'}</label>
                <textarea
                  value={closeForm.notes}
                  onChange={(e) => setCloseForm({ ...closeForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCloseForm(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  {t('cancel') || 'Cancel'}
                </button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
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
