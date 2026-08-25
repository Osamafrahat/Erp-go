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

// ==================== SHIFTS ====================

// Get all shifts
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('tenant_id', req.user?.tenantId)
      .order('name')
    if (error) {
      console.error('Shifts query error:', error)
      throw error
    }
    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

// Create shift (admin)
router.post('/', requirePermission('hr_edit'), [
  body('name').trim().notEmpty().withMessage('Shift name is required'),
  body('start_time').notEmpty().withMessage('Start time is required'),
  body('end_time').notEmpty().withMessage('End time is required'),
], validate, async (req, res, next) => {
  try {
    const { name, start_time, end_time } = req.body
    const { data, error } = await supabase
      .from('shifts')
      .insert({ tenant_id: req.user?.tenantId, name, start_time, end_time })
      .select()
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

// Update shift (admin)
router.put('/:id', requirePermission('hr_edit'), [
  param('id').isNumeric().withMessage('Invalid shift ID'),
], validate, async (req, res, next) => {
  try {
    const { name, start_time, end_time, is_active } = req.body
    const { data, error } = await supabase
      .from('shifts')
      .update({ name, start_time, end_time, is_active })
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .select()
      .single()
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// Delete shift (admin)
router.delete('/:id', requirePermission('hr_edit'), [
  param('id').isNumeric().withMessage('Invalid shift ID'),
], validate, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('shifts')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
    if (error) throw error
    res.json({ message: 'Shift deleted' })
  } catch (err) {
    next(err)
  }
})

// ==================== EMPLOYEE SHIFTS ====================

// Get employee shifts (calendar view)
router.get('/assignments', async (req, res, next) => {
  try {
    const { start_date, end_date, employee_id } = req.query
    let query = supabase
      .from('employee_shifts')
      .select('*, employees(name, role), shifts(name, start_time, end_time)')
      .eq('tenant_id', req.user?.tenantId)
      .order('date')
    if (start_date) query = query.gte('date', start_date)
    if (end_date) query = query.lte('date', end_date)
    if (employee_id) query = query.eq('employee_id', employee_id)
    const { data, error } = await query
    if (error) {
      console.error('Assignments query error:', error)
      throw error
    }
    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

// Assign shift to employee (supports date range)
router.post('/assignments', requirePermission('hr_edit'), [
  body('employee_id').isNumeric().withMessage('Employee ID is required'),
  body('shift_id').isNumeric().withMessage('Shift ID is required'),
  body('start_date').isISO8601().withMessage('Start date is required'),
  body('end_date').isISO8601().withMessage('End date is required'),
], validate, async (req, res, next) => {
  try {
    const { employee_id, shift_id, start_date, end_date } = req.body

    const start = new Date(start_date)
    const end = new Date(end_date)
    if (end < start) {
      return res.status(400).json({ error: 'End date must be after start date' })
    }

    const results = []
    const current = new Date(start)
    while (current <= end) {
      const date = current.toISOString().split('T')[0]

      const { data: existing } = await supabase
        .from('employee_shifts')
        .select('id')
        .eq('tenant_id', req.user?.tenantId)
        .eq('employee_id', employee_id)
        .eq('date', date)
        .maybeSingle()

      if (existing) {
        const { data } = await supabase
          .from('employee_shifts')
          .update({ shift_id })
          .eq('id', existing.id)
          .eq('tenant_id', req.user?.tenantId)
          .select('*, employees(name, role), shifts(name, start_time, end_time)')
          .single()
        if (data) results.push(data)
      } else {
        const { data } = await supabase
          .from('employee_shifts')
          .insert({ tenant_id: req.user?.tenantId, employee_id, shift_id, date })
          .select('*, employees(name, role), shifts(name, start_time, end_time)')
          .single()
        if (data) results.push(data)
      }

      current.setDate(current.getDate() + 1)
    }

    res.status(201).json(results)
  } catch (err) {
    next(err)
  }
})

// Bulk assign shifts for a week
router.post('/assignments/bulk', requirePermission('hr_edit'), [
  body('assignments').isArray().withMessage('Assignments array is required'),
], validate, async (req, res, next) => {
  try {
    const { assignments } = req.body
    const results = []

    for (const a of assignments) {
      const { employee_id, shift_id, date } = a
      if (!employee_id || !shift_id || !date) continue

      const { data: existing } = await supabase
        .from('employee_shifts')
        .select('id')
        .eq('tenant_id', req.user?.tenantId)
        .eq('employee_id', employee_id)
        .eq('date', date)
        .maybeSingle()

      if (existing) {
        const { data } = await supabase
          .from('employee_shifts')
          .update({ shift_id })
          .eq('id', existing.id)
          .eq('tenant_id', req.user?.tenantId)
          .select()
          .single()
        if (data) results.push(data)
      } else {
        const { data } = await supabase
          .from('employee_shifts')
          .insert({ tenant_id: req.user?.tenantId, employee_id, shift_id, date })
          .select()
          .single()
        if (data) results.push(data)
      }
    }

    res.json(results)
  } catch (err) {
    next(err)
  }
})

// Delete employee shift assignment
router.delete('/assignments/:id', requirePermission('hr_edit'), [
  param('id').isNumeric().withMessage('Invalid assignment ID'),
], validate, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('employee_shifts')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
    if (error) throw error
    res.json({ message: 'Shift assignment removed' })
  } catch (err) {
    next(err)
  }
})

export default router
