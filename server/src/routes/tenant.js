import { Router } from 'express'
import supabase from '../db/supabase.js'
import { authenticateToken, requireManager } from '../middleware/auth.js'

const router = Router()

// GET /api/tenant - Get current tenant info (auth required)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id, name, logo_url, address, phone, email, subscription_status, subscription_tier, max_products, max_users, max_orders_monthly, created_at')
      .eq('id', req.user.tenantId)
      .single()
    if (error || !tenant) return res.status(404).json({ error: 'Tenant not found' })

    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id)

    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id)

    const { count: orderCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id)

    res.json({
      ...tenant,
      user_count: userCount || 0,
      product_count: productCount || 0,
      order_count: orderCount || 0,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/tenant - Update tenant settings (auth required, manager only)
router.put('/', authenticateToken, requireManager, async (req, res) => {
  try {
    const { name, logo_url, address, phone, email } = req.body

    const updateData = { updated_at: new Date().toISOString() }
    if (name !== undefined) updateData.name = name
    if (logo_url !== undefined) updateData.logo_url = logo_url
    if (address !== undefined) updateData.address = address
    if (phone !== undefined) updateData.phone = phone
    if (email !== undefined) updateData.email = email

    const { data, error } = await supabase
      .from('tenants')
      .update(updateData)
      .eq('id', req.user.tenantId)
      .select('id, name, logo_url, address, phone, email')
      .single()
    if (error) throw error

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/tenant/usage - Get current usage stats (auth required)
router.get('/usage', authenticateToken, async (req, res) => {
  try {
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('subscription_tier, max_products, max_users, max_orders_monthly')
      .eq('id', req.user.tenantId)
      .single()
    if (tenantError || !tenant) return res.status(404).json({ error: 'Tenant not found' })

    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', req.user.tenantId)

    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', req.user.tenantId)

    const { count: orderCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', req.user.tenantId)
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())

    const tier = tenant.subscription_tier || 'free'
    const limits = {
      free: { max_products: 100, max_users: 3, max_orders_monthly: 1000 },
      pro: { max_products: 1000, max_users: 50, max_orders_monthly: 100000 },
      enterprise: { max_products: Infinity, max_users: Infinity, max_orders_monthly: Infinity },
    }

    const planLimits = limits[tier] || limits.free

    res.json({
      products: { current: productCount || 0, limit: tenant.max_products || planLimits.max_products },
      users: { current: userCount || 0, limit: tenant.max_users || planLimits.max_users },
      orders_this_month: { current: orderCount || 0, limit: tenant.max_orders_monthly || planLimits.max_orders_monthly },
      plan: tier,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
