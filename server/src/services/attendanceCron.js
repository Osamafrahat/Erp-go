import cron from 'node-cron'
import supabase from '../db/supabase.js'

let autoClockOutJob = null

function getLocalDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getLocalTime() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

async function getAllTenantIds() {
  const { data } = await supabase.from('tenants').select('id')
  return (data || []).map(t => t.id)
}

async function runAutoClockOutForTenant(tenantId) {
  try {
    const today = getLocalDate()
    const currentTime = getLocalTime()
    console.log(`[Attendance Cron] Running at ${currentTime} for date ${today}, tenant ${tenantId}`)

    // Get settings
    const { data: settingsData } = await supabase
      .from('store_settings')
      .select('key, value')
      .eq('tenant_id', tenantId)
      .in('key', ['attendance.autoClockOut', 'attendance.autoClockOutTime', 'attendance.overtimeThresholdHours'])

    const settings = {}
    settingsData?.forEach(s => { settings[s.key] = s.value })

    if (settings['attendance.autoClockOut'] !== 'true') {
      console.log(`[Attendance Cron] Auto clock-out is disabled in settings for tenant ${tenantId}`)
      return
    }

    const autoTime = settings['attendance.autoClockOutTime'] || '23:00'
    const threshold = parseFloat(settings['attendance.overtimeThresholdHours'] || '8')

    // Find employees with shifts today who haven't clocked out
    const { data: assignments, error: assignErr } = await supabase
      .from('employee_shifts')
      .select('employee_id')
      .eq('date', today)
      .eq('tenant_id', tenantId)

    if (assignErr) {
      console.error(`[Attendance Cron] Error fetching shifts for tenant ${tenantId}:`, assignErr.message)
      return
    }

    if (!assignments?.length) {
      console.log(`[Attendance Cron] No shift assignments found for today in tenant ${tenantId}`)
      return
    }

    console.log(`[Attendance Cron] Found ${assignments.length} shift assignments for today in tenant ${tenantId}`)

    let processed = 0
    for (const { employee_id } of assignments) {
      const { data: record } = await supabase
        .from('attendance')
        .select('id, clock_in, clock_out')
        .eq('employee_id', employee_id)
        .eq('date', today)
        .eq('tenant_id', tenantId)
        .maybeSingle()

      if (record && !record.clock_out) {
        const clockOut = `${today}T${autoTime}:00.000Z`
        const totalMs = new Date(clockOut) - new Date(record.clock_in)
        const totalHours = Math.max(0, totalMs / 3600000)
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
          .eq('tenant_id', tenantId)
        processed++
      }
    }

    if (processed > 0) {
      console.log(`[Attendance Cron] Auto clock-out: ${processed} employees processed for tenant ${tenantId}`)
    }

    // Mark employees with shifts but no attendance as absent
    const { data: attendedEmpIds } = await supabase
      .from('attendance')
      .select('employee_id')
      .eq('date', today)
      .eq('tenant_id', tenantId)

    const attendedIds = new Set(attendedEmpIds?.map(r => r.employee_id) || [])
    const absentEmployees = assignments.filter(a => !attendedIds.has(a.employee_id))

    for (const { employee_id } of absentEmployees) {
      const { error: insertErr } = await supabase
        .from('attendance')
        .insert({
          tenant_id: tenantId,
          employee_id,
          date: today,
          status: 'absent',
          clock_in: null,
          clock_out: null,
          total_hours: 0,
          overtime_hours: 0,
          source: 'auto',
          notes: 'Auto-marked absent by system',
        })
      if (insertErr) {
        console.error(`[Attendance Cron] Failed to mark employee ${employee_id} absent for tenant ${tenantId}:`, insertErr.message)
      }
    }

    if (absentEmployees.length > 0) {
      console.log(`[Attendance Cron] Auto-absent: ${absentEmployees.length} employees marked absent for tenant ${tenantId}`)
    }

    console.log(`[Attendance Cron] Done for tenant ${tenantId}. Clock-out: ${processed}, Absent: ${absentEmployees.length}`)
  } catch (err) {
    console.error(`[Attendance Cron] Error for tenant ${tenantId}:`, err.message)
  }
}

async function runAutoClockOut() {
  try {
    const tenantIds = await getAllTenantIds()

    if (tenantIds.length === 0) {
      console.log('[Attendance Cron] No tenants found')
      return
    }

    for (const tenantId of tenantIds) {
      await runAutoClockOutForTenant(tenantId)
    }
  } catch (err) {
    console.error('[Attendance Cron] Error:', err.message)
  }
}

export function startAttendanceCron() {
  // Run every day at 23:05 (5 minutes after the default auto clock-out time)
  autoClockOutJob = cron.schedule('5 23 * * *', runAutoClockOut)
  console.log('Attendance cron job started (auto clock-out at 23:05)')
}

export { runAutoClockOut }

export function stopAttendanceCron() {
  if (autoClockOutJob) {
    autoClockOutJob.stop()
    autoClockOutJob = null
  }
}
