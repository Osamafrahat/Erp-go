import { useState, useEffect, useMemo } from 'react'
import { useAppStore } from '../stores/appStore'
import { useUserStore } from '../stores/userStore'
import { attendanceApi, employeesApi } from '../lib/api'
import { ChevronLeft, ChevronRight, Plus, Trash2, X, BarChart3 } from 'lucide-react'
import ClockWidget from '../components/attendance/ClockWidget'
import AttendanceCalendar from '../components/attendance/AttendanceCalendar'
import ConfirmModal from '../components/ConfirmModal'
import SearchableSelect from '../components/SearchableSelect'

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function AttendancePage() {
  const { t, language, toastSuccess, toastError } = useAppStore()
  const currentUser = useUserStore(s => s.currentUser)
  const [records, setRecords] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [addEmployee, setAddEmployee] = useState('')
  const [addStatus, setAddStatus] = useState('present')
  const [addNotes, setAddNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [detailRecord, setDetailRecord] = useState(null)

  const isManager = currentUser?.role === 'MANAGER'

  const startDate = useMemo(() => `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`, [selectedYear, selectedMonth])
  const endDate = useMemo(() => {
    const d = new Date(selectedYear, selectedMonth, 0)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [selectedYear, selectedMonth])

  useEffect(() => { fetchData() }, [startDate, endDate])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [attRes, empRes] = await Promise.all([
        attendanceApi.getAll({ start_date: startDate, end_date: endDate }),
        employeesApi.getAll(),
      ])
      setRecords(attRes.data)
      setEmployees(empRes.data)
    } catch {
      toastError(t('hr.attendance.fetchFailed') || 'Failed to load attendance')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!addEmployee) return
    setIsSubmitting(true)
    try {
      await attendanceApi.create({ employee_id: parseInt(addEmployee), status: addStatus, notes: addNotes })
      toastSuccess(t('hr.attendance.created') || 'Attendance recorded')
      setShowAddForm(false)
      setAddEmployee('')
      setAddStatus('present')
      setAddNotes('')
      fetchData()
    } catch (err) {
      toastError(err.response?.data?.error || t('hr.attendance.createFailed') || 'Failed to record attendance')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await attendanceApi.delete(deleteTarget.id)
      toastSuccess(t('hr.attendance.deleted') || 'Record deleted')
      setDeleteTarget(null)
      fetchData()
    } catch (err) {
      toastError(err.response?.data?.error || t('hr.attendance.deleteFailed') || 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  const summary = useMemo(() => {
    const total = records.length
    const present = records.filter(r => r.status === 'present').length
    const absent = records.filter(r => r.status === 'absent').length
    const late = records.filter(r => r.status === 'late').length
    const halfDay = records.filter(r => r.status === 'half_day').length
    const onLeave = records.filter(r => r.status === 'on_leave').length
    const totalHours = records.reduce((s, r) => s + (parseFloat(r.total_hours) || 0), 0)
    return { total, present, absent, late, half_day: halfDay, on_leave: onLeave, totalHours: Math.round(totalHours * 10) / 10 }
  }, [records])

  const months = useMemo(() => {
    return MONTHS_EN.map((name, i) => ({
      value: i + 1,
      label: language === 'ar' ? t(`months.${name.toLowerCase()}`) || name : name,
    }))
  }, [language, t])

  const filteredEmployees = useMemo(() => {
    if (!searchTerm) return employees
    return employees.filter(e => e.name?.toLowerCase().includes(searchTerm.toLowerCase()) || e.role?.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [employees, searchTerm])

  const activeEmployees = useMemo(() => filteredEmployees.filter(e => e.is_active), [filteredEmployees])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('hr.attendance.title') || 'Attendance'}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{t('hr.attendance.subtitle') || 'Track employee attendance and hours'}</p>
        </div>
        <div className="flex gap-2">
          {isManager && (
            <button onClick={() => setShowAddForm(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm">
              <Plus className="w-4 h-4" /> {t('hr.attendance.addRecord') || 'Add Record'}
            </button>
          )}
        </div>
      </div>

      {/* Clock Widget */}
      <ClockWidget />

      {/* Summary Cards */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[
          { label: t('hr.attendance.total') || 'Total', value: summary.total, bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-l-gray-400', text: 'text-gray-900 dark:text-white', icon: '📊' },
          { label: t('hr.attendance.present') || 'Present', value: summary.present, bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-l-green-500', text: 'text-green-700 dark:text-green-400', icon: '✓' },
          { label: t('hr.attendance.absent') || 'Absent', value: summary.absent, bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-l-red-500', text: 'text-red-700 dark:text-red-400', icon: '✗' },
          { label: t('hr.attendance.late') || 'Late', value: summary.late, bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-l-yellow-500', text: 'text-yellow-700 dark:text-yellow-400', icon: '⏰' },
          { label: t('hr.attendance.halfDay') || 'Half Day', value: summary.half_day, bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-l-orange-500', text: 'text-orange-700 dark:text-orange-400', icon: '🕐' },
          { label: t('hr.attendance.onLeave') || 'On Leave', value: summary.on_leave, bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-l-blue-500', text: 'text-blue-700 dark:text-blue-400', icon: '🏖' },
        ].map(item => (
          <div key={item.label} className={`${item.bg} rounded-xl border border-gray-200 dark:border-gray-700 border-l-4 ${item.border} p-3 text-center`}>
            <div className={`text-2xl font-bold ${item.text}`}>{item.value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Month Navigation + Search */}
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-3">
        <div className="flex items-center gap-2">
          <button onClick={() => {
            if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1) }
            else setSelectedMonth(m => m - 1)
          }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(parseInt(e.target.value))}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => {
            if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1) }
            else setSelectedMonth(m => m + 1)
          }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
            <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {summary.totalHours}h {t('hr.attendance.totalHours') || 'total'}
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={t('hr.attendance.search') || 'Search employees...'}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-48"
          />
        </div>
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : activeEmployees.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {t('hr.attendance.noEmployees') || 'No employees found'}
        </div>
      ) : (
        <AttendanceCalendar
          records={records}
          employees={activeEmployees}
          year={selectedYear}
          month={selectedMonth}
          onCellClick={(record) => setDetailRecord(record)}
        />
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        {['present', 'absent', 'late', 'half_day', 'on_leave'].map(status => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${status === 'present' ? 'bg-green-500' : status === 'absent' ? 'bg-red-500' : status === 'late' ? 'bg-yellow-500' : status === 'half_day' ? 'bg-orange-500' : 'bg-blue-500'}`}></div>
            <span>{t(`hr.attendance.status.${status}`) || status}</span>
          </div>
        ))}
      </div>

      {/* Add Record Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('hr.attendance.addRecord') || 'Add Record'}</h3>
              <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hr.attendance.employee') || 'Employee'}</label>
                <SearchableSelect
                  options={activeEmployees.map(e => ({ value: e.id, label: e.name }))}
                  value={addEmployee}
                  onChange={setAddEmployee}
                  placeholder={t('hr.attendance.selectEmployee') || 'Select employee...'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hr.attendance.status') || 'Status'}</label>
                <select value={addStatus} onChange={e => setAddStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                  <option value="present">{t('hr.attendance.status.present') || 'Present'}</option>
                  <option value="absent">{t('hr.attendance.status.absent') || 'Absent'}</option>
                  <option value="late">{t('hr.attendance.status.late') || 'Late'}</option>
                  <option value="half_day">{t('hr.attendance.status.half_day') || 'Half Day'}</option>
                  <option value="on_leave">{t('hr.attendance.status.on_leave') || 'On Leave'}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.notes') || 'Notes'}</label>
                <textarea value={addNotes} onChange={e => setAddNotes(e.target.value)} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddForm(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">{t('common.cancel') || 'Cancel'}</button>
                <button onClick={handleCreate} disabled={!addEmployee || isSubmitting}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium">
                  {isSubmitting ? t('common.saving') || 'Saving...' : t('common.save') || 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('hr.attendance.details') || 'Attendance Details'}</h3>
              <button onClick={() => setDetailRecord(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{t('hr.attendance.employee') || 'Employee'}</span>
                <span className="font-medium text-gray-900 dark:text-white">{detailRecord.employees?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{t('hr.attendance.date') || 'Date'}</span>
                <span className="font-medium text-gray-900 dark:text-white">{detailRecord.date}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400">{t('hr.attendance.status') || 'Status'}</span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${detailRecord.status === 'present' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : detailRecord.status === 'absent' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : detailRecord.status === 'late' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' : detailRecord.status === 'half_day' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${detailRecord.status === 'present' ? 'bg-green-500' : detailRecord.status === 'absent' ? 'bg-red-500' : detailRecord.status === 'late' ? 'bg-yellow-500' : detailRecord.status === 'half_day' ? 'bg-orange-500' : 'bg-blue-500'}`}></span>
                  {t(`hr.attendance.status.${detailRecord.status}`) || detailRecord.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{t('hr.attendance.clockIn') || 'Clock In'}</span>
                <span className="font-medium text-gray-900 dark:text-white">{detailRecord.clock_in ? new Date(detailRecord.clock_in).toLocaleTimeString() : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{t('hr.attendance.clockOut') || 'Clock Out'}</span>
                <span className="font-medium text-gray-900 dark:text-white">{detailRecord.clock_out ? new Date(detailRecord.clock_out).toLocaleTimeString() : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{t('hr.attendance.totalHours') || 'Total Hours'}</span>
                <span className="font-medium text-gray-900 dark:text-white">{detailRecord.total_hours || 0}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{t('hr.attendance.overtime') || 'Overtime'}</span>
                <span className="font-medium text-gray-900 dark:text-white">{detailRecord.overtime_hours || 0}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{t('hr.attendance.break') || 'Break'}</span>
                <span className="font-medium text-gray-900 dark:text-white">{detailRecord.break_minutes || 0} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{t('hr.attendance.source') || 'Source'}</span>
                <span className="font-medium text-gray-900 dark:text-white">{detailRecord.source || 'manager'}</span>
              </div>
              {detailRecord.notes && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{t('common.notes') || 'Notes'}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{detailRecord.notes}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              {isManager && (
                <button onClick={() => { setDeleteTarget(detailRecord); setDetailRecord(null) }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                  <Trash2 className="w-4 h-4" /> {t('common.delete') || 'Delete'}
                </button>
              )}
              <button onClick={() => setDetailRecord(null)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
                {t('common.close') || 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('hr.attendance.deleteRecord') || 'Delete Record'}
        message={t('hr.attendance.deleteConfirm') || 'Are you sure you want to delete this attendance record?'}
        type="danger"
        loading={deleting}
      />
    </div>
  )
}
