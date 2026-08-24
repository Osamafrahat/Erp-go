import { useState, useEffect, useMemo } from 'react'
import { useAppStore } from '../stores/appStore'
import { attendanceApi } from '../lib/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { ChevronLeft, ChevronRight, TrendingUp, Clock, Users, AlertTriangle } from 'lucide-react'

const COLORS = {
  present: '#22c55e',
  absent: '#ef4444',
  late: '#eab308',
  half_day: '#f97316',
  on_leave: '#3b82f6',
}

export default function AttendanceDashboard() {
  const { t, toastError } = useAppStore()
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const startDate = useMemo(() => `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`, [selectedYear, selectedMonth])
  const endDate = useMemo(() => {
    const d = new Date(selectedYear, selectedMonth, 0)
    return d.toISOString().split('T')[0]
  }, [selectedYear, selectedMonth])

  useEffect(() => { fetchDashboard() }, [startDate, endDate])

  const fetchDashboard = async () => {
    setLoading(true)
    try {
      const res = await attendanceApi.getDashboard({ start_date: startDate, end_date: endDate })
      setDashboard(res.data)
    } catch {
      toastError(t('hr.attendance.fetchFailed') || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  const barData = useMemo(() => {
    if (!dashboard?.dailyBreakdown) return []
    return dashboard.dailyBreakdown.map(d => ({
      date: d.date.slice(5),
      Present: d.present || 0,
      Absent: d.absent || 0,
      Late: d.late || 0,
      'Half Day': d.half_day || 0,
      'On Leave': d.on_leave || 0,
    }))
  }, [dashboard])

  const pieData = useMemo(() => {
    if (!dashboard?.statusDistribution) return []
    return dashboard.statusDistribution
      .filter(d => d.value > 0)
      .map(d => ({ name: d.label, value: d.value }))
  }, [dashboard])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const s = dashboard?.summary || {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('hr.attendance.dashboard') || 'Attendance Dashboard'}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{t('hr.attendance.dashboardSubtitle') || 'Overview of attendance statistics'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => {
            if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1) }
            else setSelectedMonth(m => m - 1)
          }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long' })} {selectedYear}
          </span>
          <button onClick={() => {
            if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1) }
            else setSelectedMonth(m => m + 1)
          }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
            <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{s.attendance_rate || 0}%</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('hr.attendance.attendanceRate') || 'Attendance Rate'}</div>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{s.avg_hours || 0}h</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('hr.attendance.avgHours') || 'Avg Hours/Day'}</div>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{s.total_overtime || 0}h</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('hr.attendance.totalOvertime') || 'Total Overtime'}</div>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{s.late || 0}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('hr.attendance.late') || 'Late Arrivals'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart */}
        <div className="lg:col-span-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">{t('hr.attendance.dailyBreakdown') || 'Daily Breakdown'}</h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Present" fill={COLORS.present} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Absent" fill={COLORS.absent} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Late" fill={COLORS.late} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-400 text-sm">No data</div>
          )}
        </div>

        {/* Pie Chart */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">{t('hr.attendance.statusDistribution') || 'Status Distribution'}</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((entry, i) => {
                    const colorKey = entry.name.toLowerCase().replace(/\s+/g, '_').replace('half_day', 'half_day')
                    return <Cell key={i} fill={COLORS[colorKey] || COLORS.present} />
                  })}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-400 text-sm">No data</div>
          )}
        </div>
      </div>

      {/* Employee Summary Table */}
      {dashboard?.employeeSummaries?.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('hr.attendance.employeeSummary') || 'Employee Summary'}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                  <th className="text-start px-4 py-3 font-medium text-gray-600 dark:text-gray-300">{t('hr.shifts.employee') || 'Employee'}</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600 dark:text-gray-300">{t('hr.attendance.daysWorked') || 'Days'}</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600 dark:text-gray-300">{t('hr.attendance.totalHours') || 'Hours'}</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600 dark:text-gray-300">{t('hr.attendance.overtime') || 'Overtime'}</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600 dark:text-gray-300">{t('hr.attendance.late') || 'Late'}</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600 dark:text-gray-300">{t('hr.attendance.attendanceRate') || 'Rate'}</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.employeeSummaries.map(emp => (
                  <tr key={emp.employee_id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{emp.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{emp.role}</div>
                    </td>
                    <td className="text-center px-3 py-3 text-gray-900 dark:text-white">{emp.days_worked}</td>
                    <td className="text-center px-3 py-3 text-gray-900 dark:text-white">{emp.total_hours}h</td>
                    <td className="text-center px-3 py-3">
                      <span className={emp.overtime_hours > 0 ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-gray-500 dark:text-gray-400'}>
                        {emp.overtime_hours}h
                      </span>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className={emp.late_count > 0 ? 'text-yellow-600 dark:text-yellow-400 font-medium' : 'text-gray-500 dark:text-gray-400'}>
                        {emp.late_count}
                      </span>
                    </td>
                    <td className="text-center px-3 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${emp.attendance_rate >= 90 ? 'bg-green-500' : emp.attendance_rate >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, emp.attendance_rate)}%` }}></div>
                        </div>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{emp.attendance_rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
