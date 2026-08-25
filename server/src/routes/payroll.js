import { Router } from 'express'
import { param, body, validationResult } from 'express-validator'
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

// Get all payroll runs
router.get('/', requireManager, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('payroll')
      .select('*')
      .eq('tenant_id', req.user?.tenantId)
      .order('period_start', { ascending: false })
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

// Get payroll by ID with items
router.get('/:id', requireManager, [
  param('id').isNumeric().withMessage('Invalid payroll ID'),
], validate, async (req, res, next) => {
  try {
    const { data: payroll, error } = await supabase
      .from('payroll')
      .select('*')
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .single()
    if (error || !payroll) {
      return res.status(404).json({ error: 'Payroll not found' })
    }

    const { data: items } = await supabase
      .from('payroll_items')
      .select('*, employees(name, role)')
      .eq('tenant_id', req.user?.tenantId)
      .eq('payroll_id', payroll.id)

    res.json({ ...payroll, items: items || [] })
  } catch (err) {
    next(err)
  }
})

// Process payroll for a period
router.post('/', requirePermission('hr_edit'), [
  body('period_start').isISO8601().withMessage('Period start is required'),
  body('period_end').isISO8601().withMessage('Period end is required'),
], validate, async (req, res, next) => {
  try {
    const { period_start, period_end, notes } = req.body

    if (period_start > period_end) {
      return res.status(400).json({ error: 'Period start must be before period end' })
    }

    // Check for overlapping payroll
    const { data: existing } = await supabase
      .from('payroll')
      .select('id')
      .eq('tenant_id', req.user?.tenantId)
      .neq('status', 'rejected')
      .lte('period_start', period_end)
      .gte('period_end', period_start)
      .limit(1)

    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'A payroll run already exists for this period' })
    }

    // Get all active employees
    const { data: employees } = await supabase
      .from('employees')
      .select('id, salary, name')
      .eq('tenant_id', req.user?.tenantId)
      .eq('is_active', true)

    if (!employees || employees.length === 0) {
      return res.status(400).json({ error: 'No active employees found' })
    }

    // Create payroll run
    const { data: payroll, error: payrollError } = await supabase
      .from('payroll')
      .insert({
        tenant_id: req.user?.tenantId,
        period_start,
        period_end,
        status: 'draft',
        total_amount: 0,
        processed_by: req.user.id,
        notes: notes || null,
      })
      .select()
      .single()

    if (payrollError) throw payrollError

    // Create payroll items for each employee
    let totalAmount = 0
    const items = []

    for (const emp of employees) {
      const baseSalary = parseFloat(emp.salary) || 0

      // Get overtime from attendance
      const { data: attendance } = await supabase
        .from('attendance')
        .select('overtime_hours')
        .eq('tenant_id', req.user?.tenantId)
        .eq('employee_id', emp.id)
        .gte('date', period_start)
        .lte('date', period_end)

      const totalOvertime = (attendance || []).reduce((sum, a) => sum + (parseFloat(a.overtime_hours) || 0), 0)
      const overtimeRate = baseSalary / 160 // hourly rate (assume 160 work hours/month)
      const overtimePay = totalOvertime * overtimeRate * 1.5

      // Get approved bonuses from promotions or manual
      const bonuses = 0
      const deductions = 0
      const advanceDeduction = 0
      const netPay = baseSalary + overtimePay + bonuses - deductions - advanceDeduction

      const { data: item } = await supabase
        .from('payroll_items')
        .insert({
          tenant_id: req.user?.tenantId,
          payroll_id: payroll.id,
          employee_id: emp.id,
          base_salary: baseSalary,
          overtime_pay: overtimePay,
          bonuses,
          deductions,
          advance_deduction: advanceDeduction,
          net_pay: netPay,
          status: 'pending',
        })
        .select()
        .single()

      if (item) {
        items.push(item)
        totalAmount += netPay
      }
    }

    // Update total
    await supabase
      .from('payroll')
      .update({ total_amount: totalAmount, status: 'processed', updated_at: new Date().toISOString() })
      .eq('id', payroll.id)
      .eq('tenant_id', req.user?.tenantId)

    req.logActivity?.({ action: 'processed', entity_type: 'payroll', entity_name: `Payroll ${period_start} to ${period_end}` })

    res.status(201).json({ ...payroll, total_amount: totalAmount, status: 'processed', items })
  } catch (err) {
    next(err)
  }
})

// Mark payroll item as paid
router.patch('/:id/pay', requirePermission('hr_edit'), [
  param('id').isNumeric().withMessage('Invalid payroll item ID'),
], validate, async (req, res, next) => {
  try {
    const { data: existing } = await supabase
      .from('payroll_items')
      .select('id, payroll_id')
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .single()

    if (!existing) {
      return res.status(404).json({ error: 'Payroll item not found' })
    }

    const { data, error } = await supabase
      .from('payroll_items')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .select()
      .single()

    if (error) throw error

    // Check if all items are paid, then mark payroll as paid
    const { data: items } = await supabase
      .from('payroll_items')
      .select('status')
      .eq('tenant_id', req.user?.tenantId)
      .eq('payroll_id', existing.payroll_id)

    const allPaid = (items || []).every(i => i.status === 'paid')
    if (allPaid) {
      await supabase
        .from('payroll')
        .update({ status: 'paid', updated_at: new Date().toISOString() })
        .eq('id', existing.payroll_id)
        .eq('tenant_id', req.user?.tenantId)
    }

    res.json(data)
  } catch (err) {
    next(err)
  }
})

// Delete payroll run
router.delete('/:id', requirePermission('hr_edit'), [
  param('id').isNumeric().withMessage('Invalid payroll ID'),
], validate, async (req, res, next) => {
  try {
    const { data: existing } = await supabase
      .from('payroll')
      .select('id, status')
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .single()

    if (!existing) {
      return res.status(404).json({ error: 'Payroll not found' })
    }

    if (existing.status === 'paid') {
      return res.status(400).json({ error: 'Cannot delete a paid payroll' })
    }

    // Delete items first
    await supabase.from('payroll_items').delete().eq('payroll_id', existing.id).eq('tenant_id', req.user?.tenantId)

    const { error } = await supabase
      .from('payroll')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)

    if (error) throw error
    res.json({ message: 'Payroll deleted' })
  } catch (err) {
    next(err)
  }
})

export default router
