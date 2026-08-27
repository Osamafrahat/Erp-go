import { Router } from 'express'
import supabase from '../db/supabase.js'
import { authenticateToken, requireSuperAdmin } from '../middleware/auth.js'

const router = Router()

router.use(authenticateToken, requireSuperAdmin)

// GET /api/super-admin/tenants - List all tenants with stats
router.get('/tenants', async (req, res) => {
  try {
    const { data: tenants, error } = await supabase
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false })
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

    res.json(tenantsWithStats)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

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
    ] = await Promise.all([
      supabase.from('tenants').select('*', { count: 'exact', head: true }),
      supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('subscription_status', 'active'),
      supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('subscription_status', 'trialing'),
      supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('subscription_status', 'cancelled'),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('products').select('*', { count: 'exact', head: true }),
    ])

    res.json({
      total_tenants: totalTenants || 0,
      active_tenants: activeTenants || 0,
      trialing_tenants: trialingTenants || 0,
      cancelled_tenants: cancelledTenants || 0,
      total_users: totalUsers || 0,
      total_products: totalProducts || 0,
    })
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
      .select('id, username, role, is_active, created_at')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })

    res.json({
      ...tenant,
      user_count: userCount || 0,
      product_count: productCount || 0,
      order_count: orderCount || 0,
      users: users || [],
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/super-admin/tenants/:id - Update tenant (suspend, change tier)
router.put('/tenants/:id', async (req, res) => {
  try {
    const { subscription_status, subscription_tier, max_products, max_users, max_orders_monthly } = req.body

    const updateData = { updated_at: new Date().toISOString() }
    if (subscription_status !== undefined) updateData.subscription_status = subscription_status
    if (subscription_tier !== undefined) {
      updateData.subscription_tier = subscription_tier
    }
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

export default router
