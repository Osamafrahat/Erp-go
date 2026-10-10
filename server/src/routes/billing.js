import { Router } from 'express'
import supabase from '../db/supabase.js'
import { authenticateToken, requireManager } from '../middleware/auth.js'
import { logActivity } from '../middleware/activityLogger.js'
import {
  currentMonthStartIso,
  planEntitlements,
  resolveLimit,
} from '../services/planLimits.js'

const router = Router()

// GET /api/billing/plans - List all subscription plans (public)
router.get('/plans', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('price_monthly', { ascending: true })
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/billing/current - Get current tenant subscription (auth required)
router.get('/current', authenticateToken, requireManager, async (req, res) => {
  try {
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, subscription_status, subscription_tier, max_products, max_users, max_orders_monthly, subscription_expires_at, renewal_note')
      .eq('id', req.user.tenantId)
      .single()
    if (tenantError || !tenant) return res.status(404).json({ error: 'Tenant not found' })

    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id)

    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id)

    const { count: orderCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id)
      .gte('created_at', currentMonthStartIso())

    const { data: paymentHistory } = await supabase
      .from('tenant_payments')
      .select('id, amount, currency, status, description, created_at')
      .eq('tenant_id', tenant.id)
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(20)

    const tenantPlan = tenant.subscription_tier || 'free'

    res.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        plan: tenantPlan,
        subscription_status: tenant.subscription_status || 'active',
        // Effective caps rather than raw columns. Every tenant is created
        // with NULL max_* columns, and that null reached the client as -1
        // (rendered as an unlimited "âˆž" bar) while the middleware was still
        // enforcing the plan default â€” so a free tenant saw "5 / âˆž" and then
        // got blocked at 100.
        max_products: resolveLimit('products', tenantPlan, tenant.max_products),
        max_users: resolveLimit('users', tenantPlan, tenant.max_users),
        max_orders_monthly: resolveLimit('orders', tenantPlan, tenant.max_orders_monthly),
        subscription_expires_at: tenant.subscription_expires_at || null,
        renewal_note: tenant.renewal_note || null,
      },
      usage: {
        products: productCount || 0,
        users: userCount || 0,
        orders_this_month: orderCount || 0,
      },
      paymentHistory: (paymentHistory || []).map(p => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        description: p.description,
        date: p.created_at,
      })),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/billing/downgrade - Downgrade to a lower plan (auth required)
router.post('/downgrade', authenticateToken, requireManager, async (req, res) => {
  try {
    const { planSlug } = req.body
    if (!planSlug) return res.status(400).json({ error: 'Plan slug is required' })

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, subscription_tier')
      .eq('id', req.user.tenantId)
      .single()
    if (tenantError || !tenant) return res.status(404).json({ error: 'Tenant not found' })

    const currentTier = tenant.subscription_tier || 'free'
    const tierOrder = { free: 0, pro: 1, enterprise: 2 }
    if ((tierOrder[planSlug] || 0) >= (tierOrder[currentTier] || 0)) {
      return res.status(400).json({ error: 'Can only downgrade to a lower plan' })
    }

    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('max_products, max_users, max_orders_monthly')
      .eq('slug', planSlug)
      .single()

    // subscription_plans is authoritative when seeded; otherwise fall back to
    // the canonical plan limits for the slug rather than a hardcoded copy.
    const limits = plan || planEntitlements(planSlug)

    const { error: updateErr } = await supabase
      .from('tenants')
      .update({
        subscription_tier: planSlug,
        max_products: limits.max_products,
        max_users: limits.max_users,
        max_orders_monthly: limits.max_orders_monthly,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenant.id)
    if (updateErr) throw updateErr

    // Log downgrade
    await logActivity({
      user_id: req.user.id,
      user_name: req.user.full_name || req.user.username,
      action: 'downgraded',
      entity_type: 'subscription',
      entity_id: tenant.id,
      entity_name: tenant.name,
      details: { from_tier: currentTier, to_tier: planSlug },
      tenant_id: tenant.id,
    })

    console.log(`[Billing] Tenant ${tenant.id} downgraded from ${currentTier} to ${planSlug}`)
    res.json({ success: true, plan: planSlug })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})


export default router
