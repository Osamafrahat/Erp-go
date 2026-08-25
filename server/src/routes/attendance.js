import { Router } from 'express'
import { param, body, query, validationResult } from 'express-validator'
import supabase from '../db/supabase.js'
import { requireManager, authenticateToken, requirePermission } from '../middleware/auth.js'

const router = Router()

const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg })
  }
  next()
}

// Helper: get attendance settings from store_settings
async function getSettings(tenantId) {
  const { data } = await supabase
    .from('store_settings')
    .select('key, value')
    .eq('tenant_id', tenantId)
    .in('key', [
      'attendance.lateGraceMinutes',
      'attendance.overtimeThresholdHours',
      'attendance.autoClockOut',
      'attendance.autoClockOutTime',
      'attendance.enableGeolocation',
      'attendance.requiredRadiusMeters',
      'attendance.storeLatitude',
      'attendance.storeLongitude',
    ])
  const settings = {}
  data?.forEach(s => { settings[s.key] = s.value })
  return settings
}

// Helper: compute distance between two lat/lng points (Haversine)
function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ==================== EXISTING ENDPOINTS ====================

// Get attendance records
router.get('/', async (req, res, next) => {
  try {
    const { employee_id, start_date, end_date, status } = req.query
    let query = supabase
      .from('attendance')
      .select('*, employees(name, role)')
      .eq('tenant_id', req.user?.tenantId)
      .order('date', { ascending: false })
    if (employee_id) query = query.eq('employee_id', employee_id)
    if (start_date) query = query.gte('date', start_date)
    if (end_date) query = query.lte('date', end_date)
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

// Get employee summary
router.get('/summary/:employeeId', [
  param('employeeId').isNumeric().withMessage('Invalid employee ID'),
], validate, async (req, res, next) => {
  try {
    const { employeeId } = req.params
    const month = parseInt(req.query.month) || new Date().getMonth() + 1
    const year = parseInt(req.query.year) || new Date().getFullYear()
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endMonth = month === 12 ? 1 : month + 1
    const endYear = month === 12 ? year + 1 : year
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

    const { data: records, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('tenant_id', req.user?.tenantId)
      .eq('employee_id', employeeId)
      .gte('date', startDate)
      .lt('date', endDate)
      .order('date')
    if (error) throw error

    const summary = {
      total_days: records.length,
      present: records.filter(r => r.status === 'present').length,
      absent: records.filter(r => r.status === 'absent').length,
      late: records.filter(r => r.status === 'late').length,
      half_day: records.filter(r => r.status === 'half_day').length,
      on_leave: records.filter(r => r.status === 'on_leave').length,
      total_overtime: records.reduce((sum, r) => sum + (parseFloat(r.overtime_hours) || 0), 0),
      total_hours: records.reduce((sum, r) => sum + (parseFloat(r.total_hours) || 0), 0),
      records,
    }
    res.json(summary)
  } catch (err) {
    next(err)
  }
})

// Create attendance record (manager manual)
router.post('/', requirePermission('hr_edit'), [
  body('employee_id').isNumeric().withMessage('Employee ID is required'),
], validate, async (req, res, next) => {
  try {
    const { employee_id, date, status, notes, clock_in, clock_out, overtime_hours } = req.body
    const recordDate = date || new Date().toISOString().split('T')[0]

    const { data: existing } = await supabase
      .from('attendance')
      .select('id, clock_out')
      .eq('tenant_id', req.user?.tenantId)
      .eq('employee_id', employee_id)
      .eq('date', recordDate)
      .maybeSingle()

    if (existing) {
      if (clock_out && !existing.clock_out) {
        const { data, error } = await supabase
          .from('attendance')
          .update({ clock_out, overtime_hours: overtime_hours || 0, notes, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .eq('tenant_id', req.user?.tenantId)
          .select('*, employees(name, role)')
          .single()
        if (error) throw error
        return res.json(data)
      }
      return res.status(409).json({ error: 'Attendance record already exists for this date' })
    }

    const { data, error } = await supabase
      .from('attendance')
      .insert({
        tenant_id: req.user?.tenantId,
        employee_id,
        date: recordDate,
        clock_in: clock_in || new Date().toISOString(),
        status: status || 'present',
        notes,
        source: 'manager',
      })
      .select('*, employees(name, role)')
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

// Clock out (manager)
router.patch('/:id/clock-out', requirePermission('hr_edit'), [
  param('id').isNumeric().withMessage('Invalid attendance ID'),
], validate, async (req, res, next) => {
  try {
    const { overtime_hours, notes } = req.body
    const { data: record, error: findError } = await supabase
      .from('attendance')
      .select('*')
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .single()
    if (findError || !record) return res.status(404).json({ error: 'Record not found' })

    const clockOut = new Date().toISOString()
    const totalMs = new Date(clockOut) - new Date(record.clock_in)
    const breakMs = (parseFloat(record.break_minutes) || 0) * 60000
    const totalHours = Math.max(0, (totalMs - breakMs) / 3600000)

    const { data, error } = await supabase
      .from('attendance')
      .update({
        clock_out: clockOut,
        overtime_hours: overtime_hours || 0,
        total_hours: Math.round(totalHours * 100) / 100,
        notes: notes || record.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .select('*, employees(name, role)')
      .single()
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// Update attendance record
router.patch('/:id', requirePermission('hr_edit'), [
  param('id').isNumeric().withMessage('Invalid attendance ID'),
], validate, async (req, res, next) => {
  try {
    const { status, clock_in, clock_out, overtime_hours, notes } = req.body
    const { data: record, error: findError } = await supabase
      .from('attendance')
      .select('*')
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .single()
    if (findError || !record) return res.status(404).json({ error: 'Record not found' })

    const updates = { updated_at: new Date().toISOString() }
    if (status !== undefined) updates.status = status
    if (clock_in !== undefined) updates.clock_in = clock_in
    if (clock_out !== undefined) updates.clock_out = clock_out
    if (overtime_hours !== undefined) updates.overtime_hours = overtime_hours
    if (notes !== undefined) updates.notes = notes

    const { data, error } = await supabase
      .from('attendance')
      .update(updates)
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .select('*, employees(name, role)')
      .single()
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// Delete attendance record
router.delete('/:id', requirePermission('hr_edit'), [
  param('id').isNumeric().withMessage('Invalid attendance ID'),
], validate, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('attendance')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
    if (error) throw error
    res.json({ message: 'Attendance record deleted' })
  } catch (err) {
    next(err)
  }
})

// Helper: get employee_id from user, auto-link if possible
async function getEmployeeId(userId, tenantId) {
  // First check if already linked
  const { data: user } = await supabase
    .from('users')
    .select('employee_id, full_name')
    .eq('id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (user?.employee_id) return user.employee_id

  // Try auto-link: find employee with matching name
  if (user?.full_name) {
    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .ilike('name', user.full_name)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .maybeSingle()

    if (emp) {
      // Link them
      await supabase
        .from('users')
        .update({ employee_id: emp.id })
        .eq('id', userId)
        .eq('tenant_id', tenantId)
      return emp.id
    }
  }

  return null
}

// ==================== SELF-SERVICE ENDPOINTS ====================

// Get my employee linkage status
router.get('/me', async (req, res, next) => {
  try {
    const employeeId = await getEmployeeId(req.user.id, req.user?.tenantId)
    if (!employeeId) {
      return res.json({ linked: false, employee_id: null })
    }
    const { data: emp } = await supabase
      .from('employees')
      .select('id, name, role')
      .eq('id', employeeId)
      .eq('tenant_id', req.user?.tenantId)
      .maybeSingle()
    res.json({ linked: true, employee_id: employeeId, employee: emp })
  } catch (err) {
    next(err)
  }
})

// Clock in (self-service)
router.post('/clock-in', [
  body('location').optional().isObject(),
  body('location.lat').optional().isFloat({ min: -90, max: 90 }),
  body('location.lng').optional().isFloat({ min: -180, max: 180 }),
], validate, async (req, res, next) => {
  try {
    const employeeId = await getEmployeeId(req.user.id, req.user?.tenantId)
    if (!employeeId) {
      return res.status(400).json({ error: 'No employee profile linked to your account' })
    }

    const today = new Date().toISOString().split('T')[0]
    const settings = await getSettings(req.user?.tenantId)

    // Check if already clocked in today
    const { data: existing } = await supabase
      .from('attendance')
      .select('id, clock_out')
      .eq('tenant_id', req.user?.tenantId)
      .eq('employee_id', employeeId)
      .eq('date', today)
      .maybeSingle()

    if (existing) {
      return res.status(409).json({ error: 'Already clocked in today' })
    }

    // Geolocation check
    const geoEnabled = settings['attendance.enableGeolocation'] === 'true'
    let clockInLocation = null
    if (geoEnabled && req.body.location) {
      const storeLat = parseFloat(settings['attendance.storeLatitude'] || '30.0444')
      const storeLng = parseFloat(settings['attendance.storeLongitude'] || '31.2357')
      const radius = parseFloat(settings['attendance.requiredRadiusMeters'] || '100')
      const distance = getDistanceMeters(storeLat, storeLng, req.body.location.lat, req.body.location.lng)
      if (distance > radius) {
        return res.status(403).json({ error: `Too far from store. Distance: ${Math.round(distance)}m, allowed: ${radius}m` })
      }
      clockInLocation = req.body.location
    }

    // Find today's shift assignment
    const { data: shiftAssignment } = await supabase
      .from('employee_shifts')
      .select('shift_id, shifts(start_time, end_time, name)')
      .eq('tenant_id', req.user?.tenantId)
      .eq('employee_id', employeeId)
      .eq('date', today)
      .maybeSingle()

    // Determine status based on shift
    let status = 'present'
    const now = new Date()
    const clockInTime = now.toTimeString().slice(0, 5) // HH:MM
    if (shiftAssignment?.shifts?.start_time) {
      const graceMinutes = parseInt(settings['attendance.lateGraceMinutes'] || '5')
      const shiftStart = shiftAssignment.shifts.start_time.slice(0, 5)
      const [shiftH, shiftM] = shiftStart.split(':').map(Number)
      const [clockH, clockM] = clockInTime.split(':').map(Number)
      const shiftMinutes = shiftH * 60 + shiftM
      const clockMinutes = clockH * 60 + clockM
      if (clockMinutes > shiftMinutes + graceMinutes) {
        status = 'late'
      }
    }

    const { data, error } = await supabase
      .from('attendance')
      .insert({
        tenant_id: req.user?.tenantId,
        employee_id: employeeId,
        date: today,
        clock_in: now.toISOString(),
        status,
        clock_in_location: clockInLocation,
        source: 'self',
      })
      .select('*, employees(name, role)')
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

// Clock out (self-service)
router.post('/self-clock-out', [
  body('location').optional().isObject(),
], validate, async (req, res, next) => {
  try {
    const employeeId = await getEmployeeId(req.user.id, req.user?.tenantId)
    if (!employeeId) {
      return res.status(400).json({ error: 'No employee profile linked to your account' })
    }

    const today = new Date().toISOString().split('T')[0]
    const settings = await getSettings(req.user?.tenantId)

    const { data: record, error: findError } = await supabase
      .from('attendance')
      .select('*')
      .eq('tenant_id', req.user?.tenantId)
      .eq('employee_id', employeeId)
      .eq('date', today)
      .maybeSingle()

    if (!record) {
      return res.status(404).json({ error: 'No clock-in record found for today' })
    }
    if (record.clock_out) {
      return res.status(409).json({ error: 'Already clocked out today' })
    }

    const clockOut = new Date().toISOString()
    const totalMs = new Date(clockOut) - new Date(record.clock_in)
    const breakMs = (parseFloat(record.break_minutes) || 0) * 60000
    const totalHours = Math.max(0, (totalMs - breakMs) / 3600000)

    // Overtime calculation
    let overtimeHours = 0
    const threshold = parseFloat(settings['attendance.overtimeThresholdHours'] || '8')
    if (totalHours > threshold) {
      overtimeHours = Math.round((totalHours - threshold) * 100) / 100
    }

    const updates = {
      clock_out: clockOut,
      total_hours: Math.round(totalHours * 100) / 100,
      overtime_hours: overtimeHours,
      updated_at: clockOut,
    }

    // Geolocation
    if (settings['attendance.enableGeolocation'] === 'true' && req.body.location) {
      updates.clock_out_location = req.body.location
    }

    const { data, error } = await supabase
      .from('attendance')
      .update(updates)
      .eq('id', record.id)
      .eq('tenant_id', req.user?.tenantId)
      .select('*, employees(name, role)')
      .single()
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// Start break (self-service)
router.post('/break-start', async (req, res, next) => {
  try {
    const employeeId = await getEmployeeId(req.user.id, req.user?.tenantId)
    if (!employeeId) return res.status(400).json({ error: 'No employee profile linked' })

    const today = new Date().toISOString().split('T')[0]
    const { data: record } = await supabase
      .from('attendance')
      .select('id, break_start')
      .eq('tenant_id', req.user?.tenantId)
      .eq('employee_id', employeeId)
      .eq('date', today)
      .maybeSingle()

    if (!record) return res.status(404).json({ error: 'No clock-in record found' })
    if (record.break_start) return res.status(409).json({ error: 'Break already started' })

    const { data, error } = await supabase
      .from('attendance')
      .update({ break_start: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', record.id)
      .eq('tenant_id', req.user?.tenantId)
      .select('*')
      .single()
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// End break (self-service)
router.post('/break-end', async (req, res, next) => {
  try {
    const employeeId = await getEmployeeId(req.user.id, req.user?.tenantId)
    if (!employeeId) return res.status(400).json({ error: 'No employee profile linked' })

    const today = new Date().toISOString().split('T')[0]
    const { data: record } = await supabase
      .from('attendance')
      .select('id, break_start')
      .eq('tenant_id', req.user?.tenantId)
      .eq('employee_id', employeeId)
      .eq('date', today)
      .maybeSingle()

    if (!record) return res.status(404).json({ error: 'No clock-in record found' })
    if (!record.break_start) return res.status(409).json({ error: 'No active break' })

    const breakEnd = new Date()
    const breakMinutes = Math.round((breakEnd - new Date(record.break_start)) / 60000)

    const { data, error } = await supabase
      .from('attendance')
      .update({
        break_end: breakEnd.toISOString(),
        break_minutes: breakMinutes,
        updated_at: breakEnd.toISOString(),
      })
      .eq('id', record.id)
      .eq('tenant_id', req.user?.tenantId)
      .select('*')
      .single()
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// ==================== DASHBOARD ENDPOINT ====================

// Attendance dashboard stats
router.get('/dashboard', requirePermission('hr_view'), async (req, res, next) => {
  try {
    const startDate = req.query.start_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    const endDate = req.query.end_date || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]

    const [attendanceRes, employeesRes] = await Promise.all([
      supabase
        .from('attendance')
        .select('*, employees(name, role)')
        .eq('tenant_id', req.user?.tenantId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date'),
      supabase
        .from('employees')
        .select('id, name, role')
        .eq('tenant_id', req.user?.tenantId)
        .eq('is_active', true),
    ])

    const records = attendanceRes.data || []
    const employees = employeesRes.data || []

    // Summary counts
    const summary = {
      total_records: records.length,
      present: records.filter(r => r.status === 'present').length,
      absent: records.filter(r => r.status === 'absent').length,
      late: records.filter(r => r.status === 'late').length,
      half_day: records.filter(r => r.status === 'half_day').length,
      on_leave: records.filter(r => r.status === 'on_leave').length,
      total_overtime: records.reduce((s, r) => s + (parseFloat(r.overtime_hours) || 0), 0),
      total_hours: records.reduce((s, r) => s + (parseFloat(r.total_hours) || 0), 0),
      avg_hours: 0,
      attendance_rate: 0,
    }
    if (summary.total_records > 0) {
      summary.avg_hours = Math.round(summary.total_hours / summary.total_records * 100) / 100
      summary.attendance_rate = Math.round((summary.present + summary.late + summary.half_day) / summary.total_records * 100)
    }

    // Daily breakdown
    const dailyMap = {}
    records.forEach(r => {
      if (!dailyMap[r.date]) dailyMap[r.date] = { date: r.date, present: 0, absent: 0, late: 0, half_day: 0, on_leave: 0, total: 0 }
      dailyMap[r.date][r.status] = (dailyMap[r.date][r.status] || 0) + 1
      dailyMap[r.date].total++
    })
    const dailyBreakdown = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date))

    // Per-employee summary
    const empMap = {}
    records.forEach(r => {
      const empId = r.employee_id
      if (!empMap[empId]) {
        empMap[empId] = {
          employee_id: empId,
          name: r.employees?.name || `Employee #${empId}`,
          role: r.employees?.role || '',
          days_worked: 0,
          total_hours: 0,
          overtime_hours: 0,
          late_count: 0,
          absent_count: 0,
          attendance_rate: 0,
        }
      }
      empMap[empId].days_worked++
      empMap[empId].total_hours += parseFloat(r.total_hours) || 0
      empMap[empId].overtime_hours += parseFloat(r.overtime_hours) || 0
      if (r.status === 'late') empMap[empId].late_count++
      if (r.status === 'absent') empMap[empId].absent_count++
    })

    const employeeSummaries = Object.values(empMap).map(emp => {
      const totalDays = dailyBreakdown.length
      emp.total_hours = Math.round(emp.total_hours * 100) / 100
      emp.overtime_hours = Math.round(emp.overtime_hours * 100) / 100
      emp.attendance_rate = totalDays > 0 ? Math.round(emp.days_worked / totalDays * 100) : 0
      return emp
    })

    // Status distribution (for pie chart)
    const statusDistribution = [
      { name: 'present', value: summary.present, label: 'Present' },
      { name: 'absent', value: summary.absent, label: 'Absent' },
      { name: 'late', value: summary.late, label: 'Late' },
      { name: 'half_day', value: summary.half_day, label: 'Half Day' },
      { name: 'on_leave', value: summary.on_leave, label: 'On Leave' },
    ]

    res.json({
      summary,
      dailyBreakdown,
      employeeSummaries,
      statusDistribution,
      period: { start_date: startDate, end_date: endDate },
    })
  } catch (err) {
    next(err)
  }
})

// ==================== AUTO CLOCK-OUT (for cron) ====================

// Auto clock-out endpoint (called by cron job, internal only)
router.post('/auto-clock-out', async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const settings = await getSettings(req.user?.tenantId)

    if (settings['attendance.autoClockOut'] !== 'true') {
      return res.json({ message: 'Auto clock-out is disabled', processed: 0 })
    }

    // Find all employees with shifts today who haven't clocked out
    const { data: assignments } = await supabase
      .from('employee_shifts')
      .select('employee_id, shifts(start_time, end_time)')
      .eq('tenant_id', req.user?.tenantId)
      .eq('date', today)

    if (!assignments?.length) {
      return res.json({ message: 'No shift assignments today', processed: 0 })
    }

    let processed = 0
    for (const assignment of assignments) {
      const { data: record } = await supabase
        .from('attendance')
        .select('id, clock_out')
        .eq('tenant_id', req.user?.tenantId)
        .eq('employee_id', assignment.employee_id)
        .eq('date', today)
        .maybeSingle()

      if (record && !record.clock_out) {
        const autoTime = settings['attendance.autoClockOutTime'] || '23:00'
        const clockOut = `${today}T${autoTime}:00.000Z`

        const totalMs = new Date(clockOut) - new Date(record.clock_in)
        const totalHours = Math.max(0, totalMs / 3600000)
        const threshold = parseFloat(settings['attendance.overtimeThresholdHours'] || '8')
        const overtimeHours = totalHours > threshold ? Math.round((totalHours - threshold) * 100) / 100 : 0

        await supabase
          .from('attendance')
          .update({
            clock_out: clockOut,
            total_hours: Math.round(totalHours * 100) / 100,
            overtime_hours: overtimeHours,
            notes: 'Auto clocked out by system',
            updated_at: new Date().toISOString(),
          })
          .eq('id', record.id)
          .eq('tenant_id', req.user?.tenantId)
        processed++
      }
    }

    res.json({ message: `Auto clock-out completed`, processed })
  } catch (err) {
    next(err)
  }
})

export default router
