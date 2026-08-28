import { Router } from 'express'
import crypto from 'crypto'
import supabase from '../db/supabase.js'
import { authenticateToken, requireSuperAdmin, generateToken } from '../middleware/auth.js'
import { body, validationResult } from 'express-validator'

const router = Router()

router.use(authenticateToken, requireSuperAdmin)

// GET /api/super-admin/stats - Global stats
router.get('/stats', async (req, res) => {
  try {
    const [
      { count: totalTenants },
      { count: activeTenants },
      { count: trialingTenants },
      { count: cancelledTenants },
      { count: totalUsers },
      { count: totalProducts },
      { count: totalOrders },
    ] = await Promise.all([
      supabase.from('tenants').select('*', { count: 'exact', head: true }),
      supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('subscription_status', 'active'),
      supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('subscription_status', 'trialing'),
      supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('subscription_status', 'cancelled'),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('*', { count: 'exact', head: true }),
    ])

    const { data: plans } = await supabase.from('subscription_plans').select('*').order('price_monthly')
    const planMap = {}
    for (const p of (plans || [])) planMap[p.slug] = p.price_monthly

    const { data: tenants } = await supabase.from('tenants').select('subscription_tier')
    const mrr = (tenants || []).reduce((sum, t) => sum + (planMap[t.subscription_tier] || 0), 0)

    res.json({
      total_tenants: totalTenants || 0,
      active_tenants: activeTenants || 0,
      trialing_tenants: trialingTenants || 0,
      cancelled_tenants: cancelledTenants || 0,
      total_users: totalUsers || 0,
      total_products: totalProducts || 0,
      total_orders: totalOrders || 0,
      mrr,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/super-admin/tenants - List all tenants with stats
router.get('/tenants', async (req, res) => {
  try {
    const { search, status, tier, page = 1, limit = 20 } = req.query
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit)

    let query = supabase.from('tenants').select('*', { count: 'exact' })
    if (search) {
      query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%,email.ilike.%${search}%`)
    }
    if (status) query = query.eq('subscription_status', status)
    if (tier) query = query.eq('subscription_tier', tier)

    const { data: tenants, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1)
    if (error) throw error

    const tenantsWithStats = await Promise.all(
      (tenants || []).map(async (tenant) => {
        const [{ count: userCount }, { count: productCount }, { count: orderCount }] = await Promise.all([
          supabase.from('users').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
          supabase.from('products').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
          supabase.from('orders').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
        ])

        return {
          ...tenant,
          user_count: userCount || 0,
          product_count: productCount || 0,
          order_count: orderCount || 0,
        }
      })
    )

    res.json({ tenants: tenantsWithStats, total: count || 0, page: Number(page), limit: Number(limit) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/super-admin/tenants/:id - Get tenant details
router.get('/tenants/:id', async (req, res) => {
  try {
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', req.params.id)
      .single()
    if (error || !tenant) return res.status(404).json({ error: 'Tenant not found' })

    const [{ count: userCount }, { count: productCount }, { count: orderCount }] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
    ])

    const { data: users } = await supabase
      .from('users')
      .select('id, username, full_name, email, role, is_active, last_login, created_at')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })

    const { data: recentOrders } = await supabase
      .from('orders')
      .select('id, order_number, total_amount, status, created_at')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(10)

    res.json({
      ...tenant,
      user_count: userCount || 0,
      product_count: productCount || 0,
      order_count: orderCount || 0,
      users: users || [],
      recent_orders: recentOrders || [],
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/super-admin/tenants - Create a new tenant manually
router.post('/tenants', [
  body('name').trim().notEmpty().withMessage('Store name is required'),
  body('adminUsername').trim().isLength({ min: 3 }).withMessage('Admin username must be at least 3 characters'),
  body('adminPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('adminEmail').isEmail().withMessage('Valid admin email is required'),
  body('adminFullName').trim().notEmpty().withMessage('Admin full name is required'),
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array().map(e => e.msg).join(', ') })
  }

  try {
    const { name, adminUsername, adminPassword, adminEmail, adminFullName, tier = 'free' } = req.body

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const { data: existingSlug } = await supabase.from('tenants').select('id').eq('slug', slug).maybeSingle()
    if (existingSlug) {
      return res.status(409).json({ error: 'A tenant with a similar name already exists' })
    }

    const bcrypt = await import('bcryptjs')
    const hashedPassword = await bcrypt.default.hash(adminPassword, 10)

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name,
        slug,
        subscription_tier: tier,
        subscription_status: 'active',
        trial_ends_at: null,
      })
      .select('*')
      .single()
    if (tenantError) throw tenantError

    const { error: userError } = await supabase
      .from('users')
      .insert({
        tenant_id: tenant.id,
        username: adminUsername,
        password: hashedPassword,
        full_name: adminFullName,
        email: adminEmail,
        role: 'MANAGER',
        permissions: '["all"]',
        is_active: true,
        must_change_password: true,
      })
    if (userError) throw userError

    res.status(201).json({ tenant, message: 'Tenant and admin user created. Admin must change password on first login.' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/super-admin/tenants/:id - Update tenant (tier, status, limits)
router.put('/tenants/:id', async (req, res) => {
  try {
    const { subscription_status, subscription_tier, max_products, max_users, max_orders_monthly } = req.body

    const updateData = { updated_at: new Date().toISOString() }
    if (subscription_status !== undefined) updateData.subscription_status = subscription_status
    if (subscription_tier !== undefined) updateData.subscription_tier = subscription_tier
    if (max_products !== undefined) updateData.max_products = max_products
    if (max_users !== undefined) updateData.max_users = max_users
    if (max_orders_monthly !== undefined) updateData.max_orders_monthly = max_orders_monthly

    const { data, error } = await supabase
      .from('tenants')
      .update(updateData)
      .eq('id', req.params.id)
      .select('*')
      .single()
    if (error) throw error

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/super-admin/tenants/:id - Delete a tenant and all its data
router.delete('/tenants/:id', async (req, res) => {
  try {
    const tenantId = req.params.id

    const { data: tenant, error: findErr } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', tenantId)
      .single()
    if (findErr || !tenant) return res.status(404).json({ error: 'Tenant not found' })

    const tables = [
      'order_items', 'orders', 'products', 'categories', 'customers',
      'employees', 'attendance', 'leave_requests', 'leave_types', 'performance_reviews',
      'payroll', 'shift_assignments', 'shifts', 'expenses', 'refunds',
      'promotions', 'suppliers', 'stock_movements', 'store_settings',
      'accounts', 'account_balances', 'journal_entries', 'journal_entry_lines', 'payments',
      'services', 'service_plans', 'subscriptions', 'subscription_payments',
      'activities', 'users',
    ]

    for (const table of tables) {
      await supabase.from(table).delete().eq('tenant_id', tenantId)
    }

    await supabase.from('tenants').delete().eq('id', tenantId)

    res.json({ message: `Tenant "${tenant.name}" and all its data have been permanently deleted` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/super-admin/tenants/:id/impersonate - Generate impersonation token
router.post('/tenants/:id/impersonate', async (req, res) => {
  try {
    const tenantId = req.params.id

    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', tenantId)
      .single()
    if (tenantErr || !tenant) return res.status(404).json({ error: 'Tenant not found' })

    const { data: manager, error: userErr } = await supabase
      .from('users')
      .select('id, username, role, is_active, tenant_id')
      .eq('tenant_id', tenantId)
      .eq('role', 'MANAGER')
      .eq('is_active', true)
      .order('created_at')
      .limit(1)
      .maybeSingle()
    if (userErr || !manager) {
      return res.status(404).json({ error: 'No active manager found for this tenant' })
    }

    const sessionToken = crypto.randomUUID()
    const token = generateToken({ ...manager, session_token: sessionToken })

    await supabase
      .from('users')
      .update({ session_token: sessionToken, last_login: new Date().toISOString() })
      .eq('id', manager.id)

    res.json({
      token,
      user: { id: manager.id, username: manager.username, role: manager.role, tenant_id: manager.tenant_id },
      tenant: { id: tenant.id, name: tenant.name },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/super-admin/plans - List subscription plans
router.get('/plans', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('price_monthly')
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/super-admin/plans/:id - Update a subscription plan
router.put('/plans/:id', async (req, res) => {
  try {
    const { price_monthly, price_yearly, max_products, max_users, max_orders_monthly, features } = req.body
    const updateData = {}
    if (price_monthly !== undefined) updateData.price_monthly = Number(price_monthly)
    if (price_yearly !== undefined) updateData.price_yearly = Number(price_yearly)
    if (max_products !== undefined) updateData.max_products = Number(max_products)
    if (max_users !== undefined) updateData.max_users = Number(max_users)
    if (max_orders_monthly !== undefined) updateData.max_orders_monthly = Number(max_orders_monthly)
    if (features !== undefined) updateData.features = features

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    console.log(`[SuperAdmin] Updating plan ${req.params.id}:`, updateData)

    const { data, error } = await supabase
      .from('subscription_plans')
      .update(updateData)
      .eq('id', req.params.id)
      .select('*')
      .single()
    if (error) {
      console.error('[SuperAdmin] Plan update error:', error)
      throw error
    }

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/super-admin/activity - Recent activity across all tenants
router.get('/activity', async (req, res) => {
  try {
    const { limit = 50, tenant_id } = req.query
    let query = supabase
      .from('activities')
      .select('*, users:user_id(username, full_name)')
      .order('created_at', { ascending: false })
      .limit(Number(limit))

    if (tenant_id) query = query.eq('tenant_id', tenant_id)

    const { data, error } = await query
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/super-admin/payments - All payments across tenants
router.get('/payments', async (req, res) => {
  try {
    const { limit = 50, status } = req.query
    let query = supabase
      .from('tenant_payments')
      .select('*, tenant:tenant_id(name, slug, subscription_tier)')
      .order('created_at', { ascending: false })
      .limit(Number(limit))

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/super-admin/analytics - Revenue and growth analytics
router.get('/analytics', async (req, res) => {
  try {
    const { period = '30d' } = req.query
    const now = new Date()
    let startDate

    if (period === '7d') startDate = new Date(now - 7 * 24 * 60 * 60 * 1000)
    else if (period === '90d') startDate = new Date(now - 90 * 24 * 60 * 60 * 1000)
    else startDate = new Date(now - 30 * 24 * 60 * 60 * 1000)

    const [
      { data: payments },
      { data: plans },
      { data: tenants },
      { data: recentTenants },
    ] = await Promise.all([
      supabase.from('tenant_payments').select('amount, currency, status, created_at, tenant_id'),
      supabase.from('subscription_plans').select('slug, price_monthly, price_yearly'),
      supabase.from('tenants').select('id, subscription_tier, subscription_status, created_at'),
      supabase.from('tenants').select('id, name, subscription_tier, created_at').order('created_at', { ascending: false }).limit(5),
    ])

    const planMap = {}
    for (const p of (plans || [])) planMap[p.slug] = p

    const totalRevenue = (payments || [])
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + (p.amount || 0), 0)

    const periodPayments = (payments || []).filter(p => {
      const d = new Date(p.created_at)
      return d >= startDate && p.status === 'paid'
    })

    const periodRevenue = periodPayments.reduce((sum, p) => sum + (p.amount || 0), 0)

    const dailyRevenue = {}
    for (const p of periodPayments) {
      const day = new Date(p.created_at).toISOString().split('T')[0]
      dailyRevenue[day] = (dailyRevenue[day] || 0) + (p.amount || 0)
    }

    const tierCounts = { free: 0, pro: 0, enterprise: 0 }
    for (const t of (tenants || [])) {
      const tier = t.subscription_tier || 'free'
      tierCounts[tier] = (tierCounts[tier] || 0) + 1
    }

    const estimatedMRR = (tenants || []).reduce((sum, t) => {
      const plan = planMap[t.subscription_tier]
      return sum + (plan?.price_monthly || 0)
    }, 0)

    res.json({
      total_revenue: totalRevenue,
      period_revenue: periodRevenue,
      estimated_mrr: estimatedMRR,
      total_tenants: (tenants || []).length,
      tier_distribution: tierCounts,
      daily_revenue: dailyRevenue,
      recent_tenants: recentTenants || [],
      total_payments: (payments || []).length,
      successful_payments: (payments || []).filter(p => p.status === 'paid').length,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
