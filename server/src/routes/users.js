import { Router } from 'express'
import { body, param, validationResult } from 'express-validator'
import bcrypt from 'bcryptjs'
import supabase from '../db/supabase.js'
import { authenticateToken, requirePermission } from '../middleware/auth.js'

const router = Router()

const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg })
  }
  next()
}

// Get all users
router.get('/', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    const { data, error } = await supabase
      .from('users')
      .select('id, username, full_name, role, permissions, is_active, must_change_password, last_login, employee_id, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Batch-fetch all linked employees in one query
    const empIds = (data || []).filter(u => u.employee_id).map(u => u.employee_id)
    let employeesMap = {}
    if (empIds.length > 0) {
      const { data: emps } = await supabase
        .from('employees')
        .select('id, name, role, phone, email, is_active')
        .in('id', empIds)
      ;(emps || []).forEach(e => { employeesMap[e.id] = e })
    }

    const enriched = (data || []).map(user => ({
      ...user,
      employee: user.employee_id ? (employeesMap[user.employee_id] || null) : null
    }))

    res.json(enriched)
  } catch (err) {
    next(err)
  }
})

// Get user by ID
router.get('/:id', [
  param('id').isNumeric().withMessage('Invalid user ID'),
], validate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, full_name, role, permissions, is_active, must_change_password, last_login, employee_id, created_at, updated_at')
      .eq('id', req.params.id)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Enrich with employee data
    let employee = null
    if (data.employee_id) {
      const { data: emp } = await supabase.from('employees').select('id, name, role, phone, email, is_active').eq('id', data.employee_id).single()
      employee = emp || null
    }

    res.json({ ...data, employee })
  } catch (err) {
    next(err)
  }
})

// Create user
router.post('/', authenticateToken, requirePermission('user_manage'), [
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('role').isIn(['MANAGER', 'SALES_MANAGER', 'CASHIER', 'INVENTORY_CLERK', 'ACCOUNTANT', 'HR_MANAGER']).withMessage('Invalid role'),
], validate, async (req, res, next) => {
  try {
    const { username, password, fullName, role, permissions, employeeId } = req.body

    // Check if username exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single()

    if (existing) {
      return res.status(409).json({ error: 'Username already exists' })
    }

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    const { data, error } = await supabase
      .from('users')
      .insert({
        username,
        password: hashedPassword,
        full_name: fullName,
        role,
        permissions: permissions || [],
        is_active: true,
        must_change_password: true,
        employee_id: employeeId || null
      })
      .select('id, username, full_name, role, permissions, is_active, must_change_password, last_login, employee_id, created_at, updated_at')
      .single()

    if (error) throw error

    // Link is maintained via users.employee_id — no employees.user_id needed

    req.logActivity({ action: 'created', entity_type: 'user', entity_name: data.full_name })
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

// Update user
router.put('/:id', authenticateToken, requirePermission('user_manage'), [
  param('id').isNumeric().withMessage('Invalid user ID'),
  body('fullName').optional().trim().notEmpty().withMessage('Full name cannot be empty'),
  body('role').optional().isIn(['MANAGER', 'SALES_MANAGER', 'CASHIER', 'INVENTORY_CLERK', 'ACCOUNTANT', 'HR_MANAGER']).withMessage('Invalid role'),
  body('password').optional()
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
], validate, async (req, res, next) => {
  try {
    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (!existing) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { username, fullName, role, password, employeeId, permissions } = req.body

    const updateData = {
      updated_at: new Date().toISOString()
    }

    if (username !== undefined) {
      // Check username uniqueness if changing
      if (username !== existing.username) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('username', username)
          .single()
        if (existingUser) {
          return res.status(409).json({ error: 'Username already exists' })
        }
      }
      updateData.username = username
    }
    if (fullName !== undefined) updateData.full_name = fullName
    if (role !== undefined) updateData.role = role
    if (permissions !== undefined) updateData.permissions = permissions
    if (employeeId !== undefined) updateData.employee_id = employeeId || null

    // Force logout when permissions or role change
    const permissionsChanged = permissions !== undefined && JSON.stringify(permissions) !== JSON.stringify(existing.permissions)
    const roleChanged = role !== undefined && role !== existing.role
    if (permissionsChanged || roleChanged || password) {
      updateData.session_token = null
    }

    if (password) {
      const salt = await bcrypt.genSalt(10)
      updateData.password = await bcrypt.hash(password, salt)
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', req.params.id)
      .select('id, username, full_name, role, permissions, is_active, must_change_password, last_login, employee_id, created_at, updated_at')
      .single()

    if (error) throw error

    // Link is maintained via users.employee_id — no employees.user_id needed

    req.logActivity({ action: 'updated', entity_type: 'user', entity_id: req.params.id })
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// Toggle user active status
router.patch('/:id/toggle-active', authenticateToken, requirePermission('user_manage'), [
  param('id').isNumeric().withMessage('Invalid user ID'),
], validate, async (req, res, next) => {
  try {
    const { data: existing } = await supabase
      .from('users')
      .select('id, is_active, employee_id')
      .eq('id', req.params.id)
      .single()

    if (!existing) {
      return res.status(404).json({ error: 'User not found' })
    }

    const newActiveState = !existing.is_active

    const updatePayload = {
      is_active: newActiveState,
      updated_at: new Date().toISOString()
    }

    // Force logout: clear session_token when deactivating
    if (!newActiveState) {
      updatePayload.session_token = null
    }

    const { data, error } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', req.params.id)
      .select('id, username, full_name, role, permissions, is_active, must_change_password, last_login, employee_id, created_at, updated_at')
      .single()

    if (error) throw error

    // Sync linked employee's active status
    if (existing.employee_id) {
      await supabase.from('employees').update({ is_active: newActiveState, updated_at: new Date().toISOString() }).eq('id', existing.employee_id)
    }

    req.logActivity({ action: 'toggled_active', entity_type: 'user', entity_id: req.params.id })
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// Delete user
router.delete('/:id', authenticateToken, requirePermission('user_manage'), [
  param('id').isNumeric().withMessage('Invalid user ID'),
], validate, async (req, res, next) => {
  try {
    const { data: existing } = await supabase
      .from('users')
      .select('id, username, employee_id')
      .eq('id', req.params.id)
      .single()

    if (!existing) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (existing.username === 'admin') {
      return res.status(403).json({ error: 'Cannot delete the admin user' })
    }

    // Force logout: clear session_token before deleting
    await supabase
      .from('users')
      .update({ session_token: null })
      .eq('id', req.params.id)

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error
    req.logActivity({ action: 'deleted', entity_type: 'user', entity_id: req.params.id })
    res.json({ message: 'User deleted successfully' })
  } catch (err) {
    next(err)
  }
})

export default router
