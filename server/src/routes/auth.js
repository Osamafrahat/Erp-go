import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { body, validationResult } from 'express-validator'
import { generateToken, generateSessionToken, authenticateToken } from '../middleware/auth.js'
import { logActivity } from '../middleware/activityLogger.js'
import supabase from '../db/supabase.js'

const router = Router()

function generateSlug(storeName) {
  let slug = storeName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug
}

async function isSlugAvailable(slug) {
  const { data } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single()
  return !data
}

async function ensureUniqueSlug(baseSlug) {
  let slug = baseSlug
  if (await isSlugAvailable(slug)) return slug
  
  const randomSuffix = Math.random().toString(36).substring(2, 6)
  slug = `${baseSlug}-${randomSuffix}`
  if (await isSlugAvailable(slug)) return slug
  
  return `${baseSlug}-${Date.now().toString(36)}`
}

async function seedTenantData(tenantId, storeName) {
  const now = new Date().toISOString()
  const currentYear = new Date().getFullYear()

  const chartOfAccounts = [
    { code: '1010', name: 'Cash', account_type: 'asset', description: 'Physical cash in register and vault', tenant_id: tenantId },
    { code: '1020', name: 'Bank Account', account_type: 'asset', description: 'Business bank account', tenant_id: tenantId },
    { code: '1030', name: 'Accounts Receivable', account_type: 'asset', description: 'Amounts owed by customers', tenant_id: tenantId },
    { code: '1050', name: 'Inventory', account_type: 'asset', description: 'Products held for resale', tenant_id: tenantId },
    { code: '2010', name: 'Accounts Payable', account_type: 'liability', description: 'Amounts owed to suppliers', tenant_id: tenantId },
    { code: '2030', name: 'VAT Payable', account_type: 'liability', description: 'Tax collected on sales', tenant_id: tenantId },
    { code: '3010', name: 'Owner Equity', account_type: 'equity', description: 'Capital invested by owner', tenant_id: tenantId },
    { code: '3020', name: 'Retained Earnings', account_type: 'equity', description: 'Accumulated profit', tenant_id: tenantId },
    { code: '3030', name: 'Current Year Earnings', account_type: 'equity', description: 'Net income for current period', tenant_id: tenantId },
    { code: '4010', name: 'Sales Revenue', account_type: 'revenue', description: 'Revenue from product sales', tenant_id: tenantId },
    { code: '4015', name: 'Service Revenue', account_type: 'revenue', description: 'Revenue from service sales', tenant_id: tenantId },
    { code: '4020', name: 'Sales Returns', account_type: 'revenue', description: 'Returns and refunds', tenant_id: tenantId },
    { code: '4025', name: 'Subscription Revenue', account_type: 'revenue', description: 'Revenue from subscriptions', tenant_id: tenantId },
    { code: '5010', name: 'Cost of Goods Sold', account_type: 'expense', description: 'Direct cost of products sold', tenant_id: tenantId },
    { code: '5020', name: 'Operating Expenses', account_type: 'expense', description: 'General operating costs', tenant_id: tenantId },
    { code: '5030', name: 'Salary Expense', account_type: 'expense', description: 'Employee salaries', tenant_id: tenantId },
    { code: '5040', name: 'Rent Expense', account_type: 'expense', description: 'Office/store rent', tenant_id: tenantId },
    { code: '5050', name: 'Utilities Expense', account_type: 'expense', description: 'Electricity, water, internet', tenant_id: tenantId },
  ]

  const storeSettings = [
    { key: 'storeName', value: storeName, tenant_id: tenantId },
    { key: 'storeAddress', value: '', tenant_id: tenantId },
    { key: 'storePhone', value: '', tenant_id: tenantId },
    { key: 'storeLogo', value: '', tenant_id: tenantId },
    { key: 'taxRate', value: '14', tenant_id: tenantId },
    { key: 'currency', value: 'EGP', tenant_id: tenantId },
    { key: 'currencySymbol', value: 'ج.م', tenant_id: tenantId },
    { key: 'receiptFooter', value: 'Thank you for your purchase!', tenant_id: tenantId },
    { key: 'lowStockThreshold', value: '10', tenant_id: tenantId },
    { key: 'loyaltyPointsPerCurrency', value: '1', tenant_id: tenantId },
    { key: 'attendance.lateGraceMinutes', value: '5', tenant_id: tenantId },
    { key: 'attendance.overtimeThresholdHours', value: '8', tenant_id: tenantId },
    { key: 'attendance.autoClockOut', value: 'false', tenant_id: tenantId },
    { key: 'attendance.autoClockOutTime', value: '23:00', tenant_id: tenantId },
    { key: 'attendance.enableGeolocation', value: 'false', tenant_id: tenantId },
    { key: 'attendance.requiredRadiusMeters', value: '100', tenant_id: tenantId },
    { key: 'attendance.storeLatitude', value: '30.0444', tenant_id: tenantId },
    { key: 'attendance.storeLongitude', value: '31.2357', tenant_id: tenantId },
  ]

  const fiscalPeriod = {
    name: `FY ${currentYear}`,
    start_date: `${currentYear}-01-01`,
    end_date: `${currentYear}-12-31`,
    tenant_id: tenantId,
  }

  const leaveTypes = [
    { name: 'Annual Leave', days_per_year: 21, is_paid: true, tenant_id: tenantId },
    { name: 'Sick Leave', days_per_year: 14, is_paid: true, tenant_id: tenantId },
    { name: 'Personal Leave', days_per_year: 5, is_paid: false, tenant_id: tenantId },
    { name: 'Maternity Leave', days_per_year: 90, is_paid: true, tenant_id: tenantId },
    { name: 'Bereavement Leave', days_per_year: 5, is_paid: true, tenant_id: tenantId },
  ]

  await supabase.from('accounts').insert(chartOfAccounts)
  await supabase.from('store_settings').insert(storeSettings)
  await supabase.from('fiscal_periods').insert(fiscalPeriod)
  await supabase.from('leave_types').insert(leaveTypes)
}

router.post('/signup', [
  body('storeName').trim().notEmpty().withMessage('Store name is required'),
  body('username').trim().notEmpty().withMessage('Username is required').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg })
    }

    const { storeName, username, password, email, fullName } = req.body

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single()

    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' })
    }

    const { data: existingEmail } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (existingEmail) {
      return res.status(400).json({ error: 'Email already exists' })
    }

    const baseSlug = generateSlug(storeName)
    const slug = await ensureUniqueSlug(baseSlug)
    const now = new Date().toISOString()

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: storeName,
        slug,
        plan: 'free',
        created_at: now,
      })
      .select('id')
      .single()

    if (tenantError) throw tenantError

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    const newSessionToken = generateSessionToken()

    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        username,
        password: hashedPassword,
        full_name: fullName,
        email,
        role: 'MANAGER',
        permissions: JSON.stringify([
          'dashboard_view', 'pos_access', 'inventory_view', 'inventory_edit',
          'reports_view', 'suppliers_view', 'suppliers_edit', 'promotions_view',
          'promotions_edit', 'settings_view', 'settings_edit', 'user_manage',
          'customers_view', 'customers_edit', 'expenses_view', 'expenses_edit',
          'refunds_view', 'refunds_edit', 'employees_view', 'employees_edit',
          'hr_view', 'hr_edit', 'services_view', 'services_edit',
          'accounting_view', 'accounting_edit', 'accounting_post'
        ]),
        is_active: true,
        must_change_password: true,
        session_token: newSessionToken,
        tenant_id: tenant.id,
        created_at: now,
        updated_at: now,
      })
      .select('id, username, full_name, email, role, tenant_id')
      .single()

    if (userError) {
      await supabase.from('tenants').delete().eq('id', tenant.id)
      throw userError
    }

    await seedTenantData(tenant.id, storeName)

    const token = generateToken({ ...user, session_token: newSessionToken })

    logActivity({
      user_id: user.id,
      user_name: user.full_name || user.username,
      action: 'signed_up',
      entity_type: 'auth',
      entity_name: user.username,
      details: { store_name: storeName, tenant_id: tenant.id },
      ip_address: req.ip || req.connection?.remoteAddress,
    })

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        tenant_id: user.tenant_id,
      },
      tenant: {
        id: tenant.id,
        name: storeName,
        slug,
      },
    })
  } catch (err) {
    console.error('Signup error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/login', [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg })
    }

    const { username, password } = req.body

    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, password, full_name, role, permissions, is_active, must_change_password, session_token, employee_id, last_login, tenant_id')
      .eq('username', username)
      .eq('is_active', true)
      .single()

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const newSessionToken = generateSessionToken()

    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        last_login: new Date().toISOString(),
        session_token: newSessionToken
      })
      .eq('id', user.id)

    if (updateError) {
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id)
    }

    const token = generateToken({ ...user, session_token: updateError ? null : newSessionToken })

    const { password: _, ...userWithoutPassword } = user

    logActivity({
      user_id: user.id,
      user_name: user.full_name || user.username,
      action: 'logged_in',
      entity_type: 'auth',
      entity_name: user.username,
      ip_address: req.ip || req.connection?.remoteAddress,
    })

    res.json({ token, user: userWithoutPassword })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/change-password', authenticateToken, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg })
    }

    const { currentPassword, newPassword } = req.body
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, password')
      .eq('id', userId)
      .single()

    if (fetchError || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const validPassword = await bcrypt.compare(currentPassword, user.password)
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' })
    }

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(newPassword, salt)

    const { error: updateError } = await supabase
      .from('users')
      .update({
        password: hashedPassword,
        must_change_password: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) throw updateError

    res.json({ message: 'Password updated successfully' })
  } catch (err) {
    console.error('Change password error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, full_name, phone, email, role, permissions, is_active, employee_id, last_login, created_at, updated_at, tenant_id')
      .eq('id', req.user.id)
      .single()

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    let tenant = null
    if (user.tenant_id) {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('id, name, slug, plan, created_at')
        .eq('id', user.tenant_id)
        .single()
      tenant = tenantData
    }

    res.json({ ...user, tenant })
  } catch (err) {
    console.error('Get profile error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/profile', authenticateToken, [
  body('phone').optional().trim(),
  body('email').optional().trim().isEmail().withMessage('Invalid email format'),
], async (req, res) => {
  try {
    const { phone, email } = req.body

    const updateData = { updated_at: new Date().toISOString() }
    if (phone !== undefined) updateData.phone = phone || null
    if (email !== undefined) updateData.email = email || null

    const { data: user, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', req.user.id)
      .select('id, username, full_name, phone, email, role, permissions, is_active, employee_id, last_login, created_at, updated_at, tenant_id')
      .single()

    if (error) throw error

    let tenant = null
    if (user.tenant_id) {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('id, name, slug, plan, created_at')
        .eq('id', user.tenant_id)
        .single()
      tenant = tenantData
    }

    res.json({ ...user, tenant })
  } catch (err) {
    console.error('Update profile error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Invalidate session token server-side
    if (req.user?.id) {
      await supabase
        .from('users')
        .update({ session_token: null, updated_at: new Date().toISOString() })
        .eq('id', req.user.id)
    }

    logActivity({
      user_id: req.user?.id,
      user_name: req.user?.full_name || req.user?.username,
      action: 'logged_out',
      entity_type: 'auth',
      entity_name: req.user?.username,
      ip_address: req.ip || req.connection?.remoteAddress,
    })
    res.json({ message: 'Logged out successfully' })
  } catch (err) {
    console.error('Logout error:', err)
    res.json({ message: 'Logged out successfully' })
  }
})

export { router as authRouter }
