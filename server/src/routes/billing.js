import { Router } from 'express'
import Stripe from 'stripe'
import supabase from '../db/supabase.js'
import { authenticateToken, requireManager } from '../middleware/auth.js'

const router = Router()

let _stripe = null
function getStripe() {
  if (!_stripe && process.env.STRIPE_SECRET_KEY) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  }
  return _stripe
}
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost'

const PLAN_SLUG_MAP = {
  pro: process.env.STRIPE_PRO_PRICE_ID,
  enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID,
}

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
      .select('id, name, subscription_status, subscription_tier, stripe_customer_id, stripe_subscription_id, max_products, max_users, max_orders_monthly, subscription_expires_at, renewal_note')
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
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())

    let subscription = null
    if (tenant.stripe_subscription_id) {
      try {
        subscription = await getStripe().subscriptions.retrieve(tenant.stripe_subscription_id)
      } catch {
        subscription = null
      }
    }

    let upcomingInvoice = null
    if (subscription?.current_period_end) {
      upcomingInvoice = {
        amount_due: subscription.items.data[0]?.price?.unit_amount || 0,
        period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      }
    }

    res.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        plan: tenant.subscription_tier || 'free',
        subscription_status: tenant.subscription_status || 'active',
        max_products: tenant.max_products,
        max_users: tenant.max_users,
        max_orders_monthly: tenant.max_orders_monthly,
        subscription_expires_at: tenant.subscription_expires_at || null,
        renewal_note: tenant.renewal_note || null,
      },
      usage: {
        products: productCount || 0,
        users: userCount || 0,
        orders_this_month: orderCount || 0,
      },
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          }
        : null,
      upcoming_invoice: upcomingInvoice,
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

    const limits = plan || { max_products: 50, max_users: 2, max_orders_monthly: 100 }

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

    console.log(`[Billing] Tenant ${tenant.id} downgraded from ${currentTier} to ${planSlug}`)
    res.json({ success: true, plan: planSlug })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/billing/checkout - Create Stripe checkout session (auth required)
router.post('/checkout', authenticateToken, requireManager, async (req, res) => {
  try {
    if (!getStripe()) return res.status(503).json({ error: 'Stripe not configured' })
    const { planSlug } = req.body
    if (!planSlug || !PLAN_SLUG_MAP[planSlug]) {
      return res.status(400).json({ error: 'Invalid plan. Must be "pro" or "enterprise".' })
    }

    const priceId = PLAN_SLUG_MAP[planSlug]
    if (!priceId) {
      return res.status(400).json({ error: `Price ID not configured for plan "${planSlug}". Set STRIPE_${planSlug.toUpperCase()}_PRICE_ID in environment.` })
    }

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, stripe_customer_id')
      .eq('id', req.user.tenantId)
      .single()
    if (tenantError || !tenant) return res.status(404).json({ error: 'Tenant not found' })

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email')
      .eq('id', req.user.id)
      .single()
    if (userError || !user) return res.status(404).json({ error: 'User not found' })

    let customerId = tenant.stripe_customer_id

    if (!customerId) {
      const customer = await getStripe().customers.create({
        name: tenant.name,
        email: user.email,
        metadata: {
          tenant_id: tenant.id,
        },
      })
      customerId = customer.id

      await supabase
        .from('tenants')
        .update({ stripe_customer_id: customerId })
        .eq('id', tenant.id)
    }

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${FRONTEND_URL}/billing?success=true`,
      cancel_url: `${FRONTEND_URL}/pricing`,
      metadata: {
        tenant_id: tenant.id,
        plan_slug: planSlug,
      },
    })

    res.json({ url: session.url })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/billing/portal - Create Stripe customer portal session (auth required)
router.post('/portal', authenticateToken, requireManager, async (req, res) => {
  try {
    if (!getStripe()) return res.status(503).json({ error: 'Stripe not configured' })
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('stripe_customer_id')
      .eq('id', req.user.tenantId)
      .single()
    if (tenantError || !tenant) return res.status(404).json({ error: 'Tenant not found' })
    if (!tenant.stripe_customer_id) {
      return res.status(400).json({ error: 'No billing account found. Subscribe to a plan first.' })
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: tenant.stripe_customer_id,
      return_url: `${FRONTEND_URL}/billing`,
    })

    res.json({ url: session.url })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Stripe webhook handler - exported separately for mounting before express.json()
export async function stripeWebhookHandler(req, res) {
  const sig = req.headers['stripe-signature']
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!getStripe()) {
    console.error('[Stripe] STRIPE_SECRET_KEY not configured')
    return res.status(500).json({ error: 'Stripe not configured' })
  }

  if (!webhookSecret) {
    console.error('[Stripe] STRIPE_WEBHOOK_SECRET not configured')
    return res.status(500).json({ error: 'Webhook secret not configured' })
  }

  let event
  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, webhookSecret)
  } catch (err) {
    console.error('[Stripe] Webhook signature verification failed:', err.message)
    return res.status(400).json({ error: `Webhook Error: ${err.message}` })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const tenantId = session.metadata?.tenant_id
        const subscriptionId = session.subscription
        if (!tenantId || !subscriptionId) break

        const subscription = await getStripe().subscriptions.retrieve(subscriptionId)
        const priceId = subscription.items.data[0]?.price?.id

        let tier = 'pro'
        if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) tier = 'enterprise'

        const tierLimits = {
          pro: { max_products: 500, max_users: 15, max_orders_monthly: Infinity },
          enterprise: { max_products: Infinity, max_users: Infinity, max_orders_monthly: Infinity },
        }

        await supabase
          .from('tenants')
          .update({
            stripe_subscription_id: subscriptionId,
            subscription_status: 'active',
            subscription_tier: tier,
            ...tierLimits[tier],
            updated_at: new Date().toISOString(),
          })
          .eq('id', tenantId)

        console.log(`[Stripe] Subscription activated for tenant ${tenantId}: ${tier}`)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const subscriptionId = subscription.id

        const { data: tenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('stripe_subscription_id', subscriptionId)
          .single()
        if (!tenant) break

        const statusMap = {
          active: 'active',
          past_due: 'past_due',
          unpaid: 'past_due',
          canceled: 'cancelled',
          incomplete: 'incomplete',
          trialing: 'trialing',
          paused: 'paused',
        }

        const updateData = {
          subscription_status: statusMap[subscription.status] || subscription.status,
          updated_at: new Date().toISOString(),
        }

        if (subscription.status === 'active') {
          const newPriceId = subscription.items.data[0]?.price?.id
          if (newPriceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) {
            updateData.subscription_tier = 'enterprise'
          } else {
            updateData.subscription_tier = 'pro'
          }
        }

        await supabase
          .from('tenants')
          .update(updateData)
          .eq('id', tenant.id)

        console.log(`[Stripe] Subscription ${subscriptionId} updated for tenant ${tenant.id}: ${subscription.status}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object

        const { data: tenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('stripe_subscription_id', subscription.id)
          .single()
        if (!tenant) break

        await supabase
          .from('tenants')
          .update({
            subscription_status: 'cancelled',
            subscription_tier: 'free',
            stripe_subscription_id: null,
            max_products: 50,
            max_users: 2,
            max_orders_monthly: 100,
            updated_at: new Date().toISOString(),
          })
          .eq('id', tenant.id)

        console.log(`[Stripe] Subscription cancelled for tenant ${tenant.id}`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const customerId = invoice.customer

        const { data: tenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()
        if (!tenant) break

        await supabase
          .from('tenants')
          .update({
            subscription_status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('id', tenant.id)

        console.log(`[Stripe] Payment failed for tenant ${tenant.id}`)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object
        const customerId = invoice.customer

        const { data: tenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()
        if (!tenant) break

        await supabase
          .from('tenant_payments')
          .insert({
            tenant_id: tenant.id,
            stripe_invoice_id: invoice.id,
            amount: invoice.amount_paid,
            currency: invoice.currency,
            status: 'paid',
            payment_date: new Date(invoice.created * 1000).toISOString(),
          })

        if (invoice.subscription) {
          await supabase
            .from('tenants')
            .update({
              subscription_status: 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('id', tenant.id)
        }

        console.log(`[Stripe] Payment recorded for tenant ${tenant.id}: ${invoice.amount_paid / 100} ${invoice.currency}`)
        break
      }

      default:
        console.log(`[Stripe] Unhandled event type: ${event.type}`)
    }

    res.json({ received: true })
  } catch (err) {
    console.error(`[Stripe] Error processing ${event.type}:`, err.message)
    res.status(500).json({ error: 'Webhook handler failed' })
  }
}

export default router
