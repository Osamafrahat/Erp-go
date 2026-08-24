import { Router } from 'express'
import { body, param, validationResult } from 'express-validator'
import bcrypt from 'bcryptjs'
import supabase from '../db/supabase.js'
import { authenticateToken, requireManager, requirePermission } from '../middleware/auth.js'

const router = Router()

// Role-based permissions mapping (mirrors frontend ROLES in userStore.js)
const ROLE_PERMISSIONS = {
  MANAGER: ['dashboard_view','pos_access','inventory_view','inventory_edit','reports_view','suppliers_view','suppliers_edit','promotions_view','promotions_edit','settings_view','settings_edit','user_manage','customers_view','customers_edit','expenses_view','expenses_edit','refunds_view','refunds_edit','employees_view','employees_edit','hr_view','hr_edit','services_view','services_edit','accounting_view','accounting_edit','accounting_post'],
  SALES_MANAGER: ['dashboard_view','pos_access','inventory_view','reports_view','suppliers_view','promotions_view','promotions_edit','customers_view','customers_edit','refunds_view','refunds_edit','expenses_view','services_view','services_edit'],
  CASHIER: ['dashboard_view','pos_access','reports_view','customers_view','customers_edit','refunds_view','services_view'],
  INVENTORY_CLERK: ['dashboard_view','pos_access','inventory_view','inventory_edit','suppliers_view','suppliers_edit','reports_view'],
  ACCOUNTANT: ['dashboard_view','pos_access','accounting_view','accounting_edit','accounting_post','reports_view','expenses_view','expenses_edit','suppliers_view','customers_view'],
  HR_MANAGER: ['dashboard_view','pos_access','hr_view','hr_edit','reports_view','employees_view','employees_edit','customers_view'],
}

const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg })
  }
  next()
}

// Get all employees
router.get('/', async (req, res, next) => {
  try {
    // Use subquery to get linked user data in one query
    const { data: usersData } = await supabase
      .from('users')
      .select('id, username, full_name, role, employee_id')
      .not('employee_id', 'is', null)

    // Index users by employee_id for fast lookup
    const usersByEmployeeId = {}
    ;(usersData || []).forEach(u => {
      if (u.employee_id) usersByEmployeeId[u.employee_id] = u
    })

    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('name')

    if (error) throw error

    const enriched = (data || []).map(emp => ({
      ...emp,
      user: usersByEmployeeId[emp.id] || null
    }))

    res.json(enriched)
  } catch (err) {
    next(err)
  }
})

// Get employee by ID
router.get('/:id', [
  param('id').isNumeric().withMessage('Invalid employee ID'),
], validate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Employee not found' })
    }

    res.json(data)
  } catch (err) {
    next(err)
  }
})

// Create employee (admin-only)
router.post('/', authenticateToken, requirePermission('employees_edit'), [
  body('name').trim().notEmpty().withMessage('Employee name is required'),
  body('role').trim().notEmpty().withMessage('Employee role is required'),
], validate, async (req, res, next) => {
  try {
    const { name, role, phone, email, salary, hire_date, notes, create_user, username, password, user_role } = req.body

    // Create employee
    const { data, error } = await supabase
      .from('employees')
      .insert({
        name,
        role,
        phone: phone || null,
        email: email || null,
        salary: salary || 0,
        hire_date: hire_date || null,
        notes: notes || null,
      })
      .select()
      .single()

    if (error) throw error

    // Auto-create user account if requested
    let user = null
    if (create_user && username) {
      const validRole = ['MANAGER','SALES_MANAGER','CASHIER','INVENTORY_CLERK','ACCOUNTANT','HR_MANAGER'].includes(user_role) ? user_role : 'CASHIER'

      // Check username uniqueness
      const { data: existingUser } = await supabase.from('users').select('id').eq('username', username).single()
      if (existingUser) {
        return res.status(409).json({ error: `Username "${username}" already exists` })
      }

      const salt = await bcrypt.genSalt(10)
      const hashedPassword = await bcrypt.hash(password || 'changeme123', salt)

      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          username,
          password: hashedPassword,
          full_name: name,
          role: validRole,
          permissions: ROLE_PERMISSIONS[validRole] || ROLE_PERMISSIONS.CASHIER,
          is_active: true,
          must_change_password: true,
          employee_id: data.id,
        })
        .select('id, username, full_name, role, permissions, is_active, must_change_password, last_login, employee_id, created_at, updated_at')
        .single()

      if (userError) throw userError

      user = newUser
    }

    req.logActivity({ action: 'created', entity_type: 'employee', entity_name: data.name })
    res.status(201).json({ ...data, user })
  } catch (err) {
    next(err)
  }
})

// Update employee (admin-only)
router.put('/:id', authenticateToken, requirePermission('employees_edit'), [
  param('id').isNumeric().withMessage('Invalid employee ID'),
  body('name').trim().notEmpty().withMessage('Employee name is required'),
  body('role').trim().notEmpty().withMessage('Employee role is required'),
], validate, async (req, res, next) => {
  try {
    const { data: existing } = await supabase
      .from('employees')
      .select('id, is_active')
      .eq('id', req.params.id)
      .single()

    if (!existing) {
      return res.status(404).json({ error: 'Employee not found' })
    }

    // Find linked user via users.employee_id
    const { data: linkedUser } = await supabase.from('users').select('id').eq('employee_id', existing.id).maybeSingle()

    const { name, role, phone, email, salary, hire_date, notes, is_active } = req.body

    const { data, error } = await supabase
      .from('employees')
      .update({
        name,
        role,
        phone: phone || null,
        email: email || null,
        salary: salary || 0,
        hire_date: hire_date || null,
        notes: notes || null,
        is_active: is_active ?? true,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error

    // Sync is_active status to linked user
    if (is_active !== undefined && linkedUser && existing.is_active !== is_active) {
      await supabase.from('users').update({ is_active, updated_at: new Date().toISOString() }).eq('id', linkedUser.id)
    }

    req.logActivity({ action: 'updated', entity_type: 'employee', entity_id: req.params.id })
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// Toggle employee active status - admin-only, also toggles linked user
router.patch('/:id/toggle-active', authenticateToken, requirePermission('employees_edit'), [
  param('id').isNumeric().withMessage('Invalid employee ID'),
], validate, async (req, res, next) => {
  try {
    const { data: existing } = await supabase
      .from('employees')
      .select('id, is_active')
      .eq('id', req.params.id)
      .single()

    if (!existing) {
      return res.status(404).json({ error: 'Employee not found' })
    }

    const newActiveState = !existing.is_active

    const { data, error } = await supabase
      .from('employees')
      .update({ is_active: newActiveState, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error

    // Sync linked user's active status via users.employee_id
    const { data: linkedUser } = await supabase.from('users').select('id').eq('employee_id', existing.id).maybeSingle()
    if (linkedUser) {
      const { error: userUpdateError } = await supabase.from('users').update({ is_active: newActiveState, updated_at: new Date().toISOString() }).eq('id', linkedUser.id)
      if (userUpdateError) console.error('Failed to sync user active status:', userUpdateError)
    }

    req.logActivity({ action: newActiveState ? 'activated' : 'deactivated', entity_type: 'employee', entity_id: req.params.id })
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// Delete employee (hard delete) - admin-only, unlinks and deactivates linked user
router.delete('/:id', authenticateToken, requirePermission('employees_edit'), [
  param('id').isNumeric().withMessage('Invalid employee ID'),
], validate, async (req, res, next) => {
  try {
    const { data: existing } = await supabase
      .from('employees')
      .select('id')
      .eq('id', req.params.id)
      .single()

    if (!existing) {
      return res.status(404).json({ error: 'Employee not found' })
    }

    // Delete linked user via users.employee_id
    const { data: linkedUser } = await supabase.from('users').select('id').eq('employee_id', existing.id).maybeSingle()
    if (linkedUser) {
      await supabase.from('users').delete().eq('id', linkedUser.id)
    }

    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error
    req.logActivity({ action: 'deleted', entity_type: 'employee', entity_id: req.params.id })
    res.json({ message: 'Employee deleted successfully' })
  } catch (err) {
    next(err)
  }
})

export default router
