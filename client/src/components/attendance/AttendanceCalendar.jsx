import { useMemo } from 'react'
import { useAppStore } from '../../stores/appStore'
import { CheckCircle, XCircle, AlertCircle, MinusCircle, Calendar } from 'lucide-react'

const STATUS_COLORS = {
present:'bg-success-soft text-success-soft-foreground',
absent:'bg-danger-soft text-danger-soft-foreground',
late:'bg-warning-soft text-warning-soft-foreground',
half_day:'bg-warning-soft text-warning-soft-foreground',
on_leave:'bg-accent-soft text-accent-soft-foreground',
}

const STATUS_ICONS = {
  present: CheckCircle,
  absent: XCircle,
  late: AlertCircle,
  half_day: MinusCircle,
  on_leave: Calendar,
}

const STATUS_KEYS = {
  present: 'hr.attendance.status.present',
  absent: 'hr.attendance.status.absent',
  late: 'hr.attendance.status.late',
  half_day: 'hr.attendance.status.half_day',
  on_leave: 'hr.attendance.status.on_leave',
}

export default function AttendanceCalendar({ records, employees, year, month, onCellClick }) {
  const { t } = useAppStore()

  const daysInMonth = new Date(year, month, 0).getDate()
  const days = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      return { day, dateStr, dayOfWeek: new Date(dateStr + 'T00:00:00').getDay() }
    })
  }, [year, month, daysInMonth])

  const todayStr = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const recordsByEmployeeDate = useMemo(() => {
    const map = {}
    records.forEach(r => {
      const key = `${r.employee_id}-${r.date}`
      map[key] = r
    })
    return map
  }, [records])

  const activeEmployees = useMemo(() => employees.filter(e => e.is_active), [employees])

  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

  return (
<div className="bg-surface-secondary rounded-xl border border-border shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
<tr className="border-b border-border">
<th className="text-start px-4 py-3 font-medium text-muted min-w-[150px] sticky left-0 bg-surface-secondary backdrop-blur-sm z-10">
              {t('hr.shifts.employee') || 'Employee'}
            </th>
            {days.map(d => {
              const isWeekend = d.dayOfWeek === 0 || d.dayOfWeek === 6
              const isToday = d.dateStr === todayStr
              return (
<th key={d.day}className={`text-center px-2 py-3 font-medium text-xs min-w-[44px] ${isToday ?'text-accent-soft-foreground bg-accent-soft': isWeekend ?'text-muted bg-surface-secondary':'text-muted'}`}>
                  <div>{d.day}</div>
                  <div className="text-[10px] font-normal opacity-70">{t(`days.${dayKeys[d.dayOfWeek]}`) || dayHeaders[d.dayOfWeek]}</div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {activeEmployees.map((emp, idx) => (
<tr key={emp.id}className={`border-b border-border hover:bg-white/50 dark:hover:bg-gray-700/30 transition-colors ${idx % 2===0 ?'':'bg-surface-secondary'}`}>
<td className="px-4 py-2.5 sticky left-0 bg-surface-secondary backdrop-blur-sm z-10 border-r border-border">
<div className="font-medium text-foreground text-sm">{emp.name}</div>
<div className="text-xs text-muted">{emp.role}</div>
              </td>
              {days.map(d => {
                const record = recordsByEmployeeDate[`${emp.id}-${d.dateStr}`]
                const isWeekend = d.dayOfWeek === 0 || d.dayOfWeek === 6
                const isToday = d.dateStr === todayStr
                const StatusIcon = record ? STATUS_ICONS[record.status] || CheckCircle : null
                return (
                  <td
                    key={d.day}
                    onClick={() => record && onCellClick?.(record)}
className={`text-center px-1 py-1.5 ${record ?'cursor-pointer bg-surface-hover':''}${isToday ?'bg-accent-soft': isWeekend ?'bg-surface-secondary':''}`}
                  >
                    {record ? (
                      <div
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-medium transition-transform hover:scale-110 ${STATUS_COLORS[record.status] || ''}`}
                        title={`${t(STATUS_KEYS[record.status]) || record.status}${record.clock_in ? ` | ${new Date(record.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}${record.clock_out ? ` → ${new Date(record.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`}
                      >
                        {StatusIcon && <StatusIcon className="w-3.5 h-3.5" />}
                      </div>
                    ) : isWeekend ? (
<span className="text-foreground text-xs">—</span>
                    ) : (
<span className="text-foreground text-xs">—</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
