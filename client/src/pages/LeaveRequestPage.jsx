import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { useUserStore } from '../stores/userStore'
import { leaveApi, employeesApi } from '../lib/api'
import { Calendar, Plus, Clock, X } from 'lucide-react'
import SearchableSelect from '../components/SearchableSelect'

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

export default function LeaveRequestPage() {
  const { t, toastSuccess, toastError } = useAppStore()
  const currentUser = useUserStore(s => s.currentUser)
  const [leaveTypes, setLeaveTypes] = useState([])
  const [requests, setRequests] = useState([])
  const [balances, setBalances] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [myEmployee, setMyEmployee] = useState(null)

  const [form, setForm] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [typesRes, meRes] = await Promise.all([
        leaveApi.getTypes(),
        import('../lib/api').then(m => m.attendanceApi.getMe()),
      ])
      setLeaveTypes(typesRes.data?.filter(t => t.is_active) || [])

      if (meRes.data?.linked && meRes.data?.employee_id) {
        setMyEmployee(meRes.data.employee)
        const [reqsRes, balRes] = await Promise.all([
          leaveApi.getRequests({ employee_id: meRes.data.employee_id }),
          leaveApi.getBalances(meRes.data.employee_id),
        ])
        setRequests(reqsRes.data || [])
        setBalances(balRes.data || [])
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.leave_type_id || !form.start_date || !form.end_date) {
      toastError(t('hr.leave.fillRequired') || 'Please fill required fields')
      return
    }
    if (new Date(form.end_date) < new Date(form.start_date)) {
      toastError(t('hr.leave.endDateBeforeStart') || 'End date cannot be before start date')
      return
    }
    setIsSubmitting(true)
    try {
      await leaveApi.createRequest({
        employee_id: myEmployee?.id,
        leave_type_id: form.leave_type_id,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason || null,
      })
      toastSuccess(t('hr.leave.requestSubmitted') || 'Leave request submitted')
      setShowForm(false)
      setForm({ leave_type_id: '', start_date: '', end_date: '', reason: '' })
      fetchData()
    } catch (err) {
      toastError(err.response?.data?.error || t('hr.leave.submitFailed') || 'Failed to submit request')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString() : '—'

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!myEmployee) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        {t('hr.attendance.noEmployeeProfile') || 'No employee profile linked to your account. Contact your manager.'}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('hr.leave.myRequests') || 'My Leave Requests'}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{t('hr.leave.requestSubtitle') || 'Submit and track your leave requests'}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm">
          <Plus className="w-4 h-4" /> {t('hr.leave.newRequest') || 'New Request'}
        </button>
      </div>

      {/* Leave Balances */}
      {balances.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t('hr.leave.balances') || 'Leave Balances'}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {balances.map(b => {
              const pct = b.total_days > 0 ? Math.round((b.used_days / b.total_days) * 100) : 0
              const barColor = pct >= 80 ? 'bg-red-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-green-500'
              return (
                <div key={b.id} className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{b.leave_types?.name}</span>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${pct >= 80 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : pct >= 50 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>{pct}%</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{b.remaining_days}<span className="text-sm font-normal text-gray-400 dark:text-gray-500 ml-1">{t('hr.leave.days') || 'days'}</span></div>
                  <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }}></div>
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">{b.used_days}/{b.total_days} {t('hr.leave.used') || 'used'}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Requests List */}
      {requests.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>{t('hr.leave.noRequests') || 'No leave requests yet'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <div key={req.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-medium text-gray-900 dark:text-white">{req.leave_types?.name}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[req.status] || STATUS_COLORS.pending}`}>
                      {t(`hr.leave.status.${req.status}`) || req.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatDate(req.start_date)} → {formatDate(req.end_date)}</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">{req.days} {t('hr.leave.days') || 'days'}</span>
                  </div>
                  {req.reason && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-2 pl-5 border-l-2 border-gray-200 dark:border-gray-600">{req.reason}</div>
                  )}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  {req.created_at ? new Date(req.created_at).toLocaleDateString() : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Request Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('hr.leave.newRequest') || 'New Leave Request'}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hr.leave.type') || 'Leave Type'} *</label>
                <select
                  value={form.leave_type_id}
                  onChange={e => setForm(f => ({ ...f, leave_type_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  required
                >
                  <option value="">{t('hr.leave.selectType') || 'Select type...'}</option>
                  {leaveTypes.map(lt => (
                    <option key={lt.id} value={lt.id}>{lt.name} ({lt.days_per_year} {t('hr.leave.daysYear') || 'days/year'})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hr.leave.startDate') || 'Start Date'} *</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hr.leave.endDate') || 'End Date'} *</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hr.leave.reason') || 'Reason'}</label>
                <textarea
                  value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder={t('hr.leave.reasonPlaceholder') || 'Optional reason...'}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
                  {t('common.cancel') || 'Cancel'}
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium">
                  {isSubmitting ? (t('common.submitting') || 'Submitting...') : (t('hr.leave.submit') || 'Submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
