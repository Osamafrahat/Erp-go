import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAppStore } from '../stores/appStore'
import { shiftsApi, employeesApi } from '../lib/api'
import { Clock, Plus, Trash2, ChevronLeft, ChevronRight, X, GripVertical } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import SearchableSelect from '../components/SearchableSelect'

const SHIFT_COLORS = [
  'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
]

const SHIFT_COLORS_BORDER = [
  'border-blue-300 dark:border-blue-700',
  'border-green-300 dark:border-green-700',
  'border-purple-300 dark:border-purple-700',
  'border-orange-300 dark:border-orange-700',
  'border-pink-300 dark:border-pink-700',
]

function toLocalDateStr(d) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getWeekDates(date) {
  const d = new Date(date + 'T00:00:00')
  const day = d.getDay()
  const diff = d.getDate() - day
  const start = new Date(d)
  start.setDate(diff)
  const dates = []
  for (let i = 0; i < 7; i++) {
    const dt = new Date(start)
    dt.setDate(start.getDate() + i)
    dates.push(toLocalDateStr(dt))
  }
  return dates
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export default function ShiftSchedulingPage({ readOnly = false }) {
  const { t, toastSuccess, toastError } = useAppStore()
  const [shifts, setShifts] = useState([])
  const [employees, setEmployees] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay())
    return toLocalDateStr(d)
  })
  const [showShiftForm, setShowShiftForm] = useState(false)
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [shiftName, setShiftName] = useState('')
  const [shiftStart, setShiftStart] = useState('09:00')
  const [shiftEnd, setShiftEnd] = useState('17:00')
  const [assignEmployee, setAssignEmployee] = useState('')
  const [assignShift, setAssignShift] = useState('')
  const [assignStartDate, setAssignStartDate] = useState('')
  const [assignEndDate, setAssignEndDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteAssignmentTarget, setDeleteAssignmentTarget] = useState(null)
  const [dragShiftId, setDragShiftId] = useState(null)
  const [dragOverCell, setDragOverCell] = useState(null)
  const [dropLoading, setDropLoading] = useState(false)

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])

  useEffect(() => { fetchData() }, [weekStart])

  const fetchData = async () => {
    setLoading(true)
    try {
      const endDate = new Date(weekStart + 'T00:00:00')
      endDate.setDate(endDate.getDate() + 6)
      const endStr = toLocalDateStr(endDate)

      const [shiftsRes, empRes, assignRes] = await Promise.allSettled([
        shiftsApi.getAll(),
        employeesApi.getAll(),
        shiftsApi.getAssignments({ start_date: weekStart, end_date: endStr }),
      ])

      if (shiftsRes.status === 'fulfilled') setShifts(shiftsRes.value.data || [])
      if (empRes.status === 'fulfilled') setEmployees(empRes.value.data || [])
      if (assignRes.status === 'fulfilled') setAssignments(assignRes.value.data || [])

      const failed = [shiftsRes, empRes, assignRes].filter(r => r.status === 'rejected')
      if (failed.length > 0) {
        console.error('Shifts fetch errors:', failed.map(f => f.reason?.message || f.reason))
      }
    } catch (err) {
      console.error('fetchData error:', err)
    } finally {
      setLoading(false)
    }
  }

  const prevWeek = () => {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() - 7)
    setWeekStart(toLocalDateStr(d))
  }

  const nextWeek = () => {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() + 7)
    setWeekStart(toLocalDateStr(d))
  }

  const handleCreateShift = async () => {
    if (!shiftName) return
    setIsSubmitting(true)
    try {
      await shiftsApi.create({ name: shiftName, start_time: shiftStart, end_time: shiftEnd })
      toastSuccess(t('hr.shifts.created') || 'Shift created')
      setShowShiftForm(false)
      setShiftName('')
      setShiftStart('09:00')
      setShiftEnd('17:00')
      fetchData()
    } catch (err) {
      toastError(err.response?.data?.error || t('hr.shifts.createFailed') || 'Failed to create shift')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAssign = async () => {
    if (!assignEmployee || !assignShift || !assignStartDate || !assignEndDate) return
    setIsSubmitting(true)
    try {
      await shiftsApi.assignShift({
        employee_id: parseInt(assignEmployee),
        shift_id: parseInt(assignShift),
        start_date: assignStartDate,
        end_date: assignEndDate,
      })
      toastSuccess(t('hr.shifts.assigned') || 'Shift assigned')
      setShowAssignForm(false)
      setAssignEmployee('')
      setAssignShift('')
      setAssignStartDate('')
      setAssignEndDate('')
      fetchData()
    } catch (err) {
      toastError(err.response?.data?.error || t('hr.shifts.assignFailed') || 'Failed to assign shift')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteShift = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await shiftsApi.delete(deleteTarget.id)
      toastSuccess(t('hr.shifts.deleted') || 'Shift deleted')
      setDeleteTarget(null)
      fetchData()
    } catch (err) {
      toastError(err.response?.data?.error || t('hr.shifts.deleteFailed') || 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteAssignment = async () => {
    if (!deleteAssignmentTarget) return
    setDeleting(true)
    try {
      await shiftsApi.deleteAssignment(deleteAssignmentTarget.id)
      toastSuccess(t('hr.shifts.assignmentRemoved') || 'Assignment removed')
      setDeleteAssignmentTarget(null)
      fetchData()
    } catch (err) {
      toastError(err.response?.data?.error || t('hr.shifts.removeFailed') || 'Failed to remove')
    } finally {
      setDeleting(false)
    }
  }

  const handleDragStart = useCallback((e, shiftId) => {
    setDragShiftId(shiftId)
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', shiftId.toString())
  }, [])

  const handleDragEnd = useCallback(() => {
    setDragShiftId(null)
    setDragOverCell(null)
  }, [])

  const handleDragOver = useCallback((e, empId, date) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOverCell(`${empId}-${date}`)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverCell(null)
  }, [])

  const handleDrop = useCallback(async (e, empId, date) => {
    e.preventDefault()
    setDragOverCell(null)
    const shiftId = parseInt(e.dataTransfer.getData('text/plain'))
    if (!shiftId) return

    setDropLoading(true)
    try {
      await shiftsApi.assignShift({
        employee_id: empId,
        shift_id: shiftId,
        start_date: date,
        end_date: date,
      })
      fetchData()
    } catch (err) {
      toastError(err.response?.data?.error || t('hr.shifts.assignFailed') || 'Failed to assign shift')
    } finally {
      setDropLoading(false)
      setDragShiftId(null)
    }
  }, [fetchData, toastError, t])

  const handleRemoveAssignment = useCallback(async (assignmentId) => {
    try {
      await shiftsApi.deleteAssignment(assignmentId)
      fetchData()
    } catch (err) {
      toastError(err.response?.data?.error || t('hr.shifts.removeFailed') || 'Failed to remove')
    }
  }, [fetchData, toastError, t])

  const getShiftColor = (shiftId) => {
    const idx = shifts.findIndex(s => s.id === shiftId)
    return SHIFT_COLORS[idx % SHIFT_COLORS.length]
  }

  const getShiftBorder = (shiftId) => {
    const idx = shifts.findIndex(s => s.id === shiftId)
    return SHIFT_COLORS_BORDER[idx % SHIFT_COLORS_BORDER.length]
  }

  const getAssignmentForCell = (empId, date) => {
    return assignments.find(a => Number(a.employee_id) === Number(empId) && String(a.date) === String(date))
  }

  const activeEmployees = employees.filter(e => e.is_active)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{readOnly ? (t('hr.shifts.viewTitle') || 'Shift Schedule') : (t('hr.shifts.title') || 'Shift Scheduling')}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{readOnly ? (t('hr.shifts.viewSubtitle') || 'View shifts and weekly schedules') : (t('hr.shifts.subtitle') || 'Manage shifts and weekly schedules')}</p>
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <button onClick={() => setShowShiftForm(true)} className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition text-sm">
              <Plus className="w-4 h-4" /> {t('hr.shifts.addShift') || 'Add Shift'}
            </button>
            <button onClick={() => setShowAssignForm(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm">
              <Clock className="w-4 h-4" /> {t('hr.shifts.assign') || 'Assign Shift'}
            </button>
          </div>
        )}
      </div>

      {/* Shift Definitions - Draggable */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-3">
        {!readOnly && (
          <div className="flex items-center gap-2 mb-2">
            <GripVertical className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('hr.shifts.dragHint') || 'Drag a shift onto the schedule below'}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {shifts.map((shift, i) => (
            <div
              key={shift.id}
              draggable={!readOnly}
              onDragStart={!readOnly ? (e) => handleDragStart(e, shift.id) : undefined}
              onDragEnd={!readOnly ? handleDragEnd : undefined}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium select-none transition-all ${SHIFT_COLORS[i % SHIFT_COLORS.length]} ${!readOnly ? 'cursor-grab active:cursor-grabbing' : ''} ${dragShiftId === shift.id ? 'opacity-50 scale-95 ring-2 ring-primary-400' : 'hover:shadow-md'}`}
            >
              {!readOnly && <GripVertical className="w-3 h-3 opacity-50" />}
              <Clock className="w-3 h-3" />
              {shift.name} ({shift.start_time?.slice(0, 5)} - {shift.end_time?.slice(0, 5)})
              {!readOnly && (
                <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(shift) }} className="ml-1 hover:opacity-70">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          {shifts.length === 0 && (
            <span className="text-sm text-gray-400">{t('hr.shifts.noShifts') || 'No shifts defined.'}</span>
          )}
        </div>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-3">
        <button onClick={prevWeek} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <div className="text-sm font-medium text-gray-900 dark:text-white">
          {weekDates[0]} → {weekDates[6]}
        </div>
        <button onClick={nextWeek} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
          <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
      </div>

      {/* Schedule Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : activeEmployees.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">{t('hr.shifts.noEmployees') || 'No active employees'}</div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-start px-4 py-3 font-medium text-gray-600 dark:text-gray-300 min-w-[150px]">{t('hr.shifts.employee') || 'Employee'}</th>
                {weekDates.map((date, i) => {
                  const d = new Date(date + 'T00:00:00')
                  const isToday = date === new Date().toISOString().split('T')[0]
                  return (
                    <th key={date} className={`text-center px-3 py-3 font-medium text-xs ${isToday ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/10' : 'text-gray-600 dark:text-gray-300'}`}>
                      <div>{t(`days.${DAY_KEYS[i]}`) || DAY_KEYS[i]}</div>
                      <div className="text-xs">{date.slice(5)}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {activeEmployees.map(emp => (
                <tr key={emp.id} className="border-b border-gray-100 dark:border-gray-700/50">
                  <td className="px-4 py-2">
                    <span className="font-medium text-gray-900 dark:text-white">{emp.name}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">{emp.role}</span>
                  </td>
                  {weekDates.map(date => {
                    const assignment = getAssignmentForCell(emp.id, date)
                    const cellKey = `${emp.id}-${date}`
                    const isDragOver = dragOverCell === cellKey
                    return (
                      <td
                        key={date}
                        className={`px-2 py-2 text-center transition-all duration-150 ${isDragOver ? 'bg-primary-50 dark:bg-primary-900/20 ring-2 ring-inset ring-primary-400 dark:ring-primary-500' : ''} ${dropLoading && isDragOver ? 'opacity-60' : ''}`}
                        onDragOver={!readOnly ? (e) => handleDragOver(e, emp.id, date) : undefined}
                        onDragLeave={!readOnly ? handleDragLeave : undefined}
                        onDrop={!readOnly ? (e) => handleDrop(e, emp.id, date) : undefined}
                      >
                        {assignment ? (
                          <div
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${getShiftColor(assignment.shift_id)} ${getShiftBorder(assignment.shift_id)} border ${!readOnly ? 'cursor-pointer hover:opacity-80' : ''}`}
                            onClick={!readOnly ? () => setDeleteAssignmentTarget(assignment) : undefined}
                            title={!readOnly ? (t('hr.shifts.clickToRemove') || 'Click to remove') : undefined}
                          >
                            <Clock className="w-3 h-3" />
                            {assignment.shifts?.name || t('hr.shifts.shiftFallback') || 'Shift'}
                          </div>
                        ) : isDragOver ? (
                          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border-2 border-dashed border-primary-400 dark:border-primary-500 text-primary-500 dark:text-primary-400">
                            <Plus className="w-3 h-3" />
                            {t('hr.shifts.dropHere') || 'Drop'}
                          </div>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Shift Modal */}
      {!readOnly && showShiftForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('hr.shifts.addShift') || 'Add Shift'}</h3>
              <button onClick={() => setShowShiftForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hr.shifts.shiftName') || 'Shift Name'}</label>
                <input type="text" value={shiftName} onChange={e => setShiftName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder={t('hr.shifts.shiftNamePlaceholder') || 'e.g. Morning Shift'} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hr.shifts.startTime') || 'Start Time'}</label>
                  <input type="time" value={shiftStart} onChange={e => setShiftStart(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hr.shifts.endTime') || 'End Time'}</label>
                  <input type="time" value={shiftEnd} onChange={e => setShiftEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowShiftForm(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">{t('common.cancel') || 'Cancel'}</button>
                <button onClick={handleCreateShift} disabled={!shiftName || isSubmitting}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium">
                  {isSubmitting ? t('common.saving') || 'Saving...' : t('common.save') || 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Shift Modal */}
      {/* Assign Shift Modal */}
      {!readOnly && showAssignForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('hr.shifts.assign') || 'Assign Shift'}</h3>
              <button onClick={() => setShowAssignForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hr.shifts.employee') || 'Employee'}</label>
                <SearchableSelect
                  options={activeEmployees.map(e => ({ value: e.id, label: e.name }))}
                  value={assignEmployee}
                  onChange={setAssignEmployee}
                  placeholder={t('hr.shifts.selectEmployee') || 'Search employee...'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hr.shifts.shift') || 'Shift'}</label>
                <SearchableSelect
                  options={shifts.map(s => ({ value: s.id, label: `${s.name} (${s.start_time?.slice(0, 5)} - ${s.end_time?.slice(0, 5)})` }))}
                  value={assignShift}
                  onChange={setAssignShift}
                  placeholder={t('hr.shifts.selectShift') || 'Search shift...'}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hr.shifts.startDate') || 'Start Date'}</label>
                  <input type="date" value={assignStartDate} onChange={e => setAssignStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hr.shifts.endDate') || 'End Date'}</label>
                  <input type="date" value={assignEndDate} onChange={e => setAssignEndDate(e.target.value)} min={assignStartDate}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAssignForm(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">{t('common.cancel') || 'Cancel'}</button>
                <button onClick={handleAssign} disabled={!assignEmployee || !assignShift || !assignStartDate || !assignEndDate || isSubmitting}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium">
                  {isSubmitting ? t('common.saving') || 'Saving...' : t('hr.shifts.assign') || 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!readOnly && (
        <>
          <ConfirmModal
            open={!!deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onConfirm={handleDeleteShift}
            title={t('hr.shifts.deleteShift') || 'Delete Shift'}
            message={t('hr.shifts.deleteConfirm') || 'Are you sure you want to delete this shift?'}
            type="danger"
            loading={deleting}
          />

          <ConfirmModal
            open={!!deleteAssignmentTarget}
            onClose={() => setDeleteAssignmentTarget(null)}
            onConfirm={handleDeleteAssignment}
            title={t('hr.shifts.removeAssignment') || 'Remove Assignment'}
            message={t('hr.shifts.removeConfirm') || 'Remove this shift assignment?'}
            type="danger"
            loading={deleting}
          />
        </>
      )}
    </div>
  )
}
