import { Router } from 'express'
import crypto from 'crypto'
import supabase from '../db/supabase.js'
import { authenticateToken } from '../middleware/auth.js'

const router = Router()

const PAYMOB_BASE_URL = 'https://accept.paymob.com'

const PLAN_MAP = {
  pro: { tier: 'pro', max_products: 500, max_users: 15, max_orders_monthly: -1 },
  enterprise: { tier: 'enterprise', max_products: -1, max_users: -1, max_orders_monthly: -1 },
}

// POST /api/billing/paymob/checkout - Create intention and return client_secret
router.post('/checkout', authenticateToken, async (req, res) => {
  try {
    const secretKey = process.env.PAYMOB_SECRET_KEY
    const publicKey = process.env.PAYMOB_PUBLIC_KEY
    const cardIntegrationId = process.env.PAYMOB_CARD_INTEGRATION_ID
    const walletIntegrationId = process.env.PAYMOB_WALLET_INTEGRATION_ID
    const webhookUrl = 'https://erp-go-crimson-wind-2087.fly.dev/api/billing/paymob/webhook'
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pricing`

    if (!secretKey || !publicKey || !cardIntegrationId) {
      return res.status(503).json({ error: 'Paymob not fully configured. Missing keys.' })
    }

    const { amount, planSlug } = req.body
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' })

    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', req.user.tenantId)
      .single()

    const { data: user } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', req.user.id)
      .single()

    const merchantOrderId = `tenant-${tenant?.id}-${planSlug || 'unknown'}-${Date.now()}`

    const paymentMethods = [Number(cardIntegrationId)]
    if (walletIntegrationId) paymentMethods.push(Number(walletIntegrationId))

    const intentionRes = await fetch(`${PAYMOB_BASE_URL}/v1/intention/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${secretKey}`,
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency: 'EGP',
        payment_methods: paymentMethods,
        items: [
          {
            name: planSlug ? `${planSlug} subscription` : 'Subscription',
            amount: Math.round(amount * 100),
            description: `Payment for ${planSlug || 'subscription'} plan`,
            quantity: 1,
          },
        ],
        billing_data: {
          first_name: user?.full_name?.split(' ')[0] || 'Customer',
          last_name: user?.full_name?.split(' ').slice(1).join(' ') || 'User',
          email: user?.email || '',
          phone_number: '+201000000000',
          apartment: 'N/A',
          floor: 'N/A',
          street: 'N/A',
          building: 'N/A',
          city: 'Cairo',
          country: 'EGY',
          postal_code: '00000',
          state: 'Cairo',
        },
        special_reference: merchantOrderId,
        notification_url: webhookUrl,
        redirection_url: redirectUrl,
        extras: { plan_slug: planSlug, tenant_id: tenant?.id },
      }),
    })

    const intentionData = await intentionRes.json()

    if (!intentionData.client_secret) {
      console.error('[Paymob] Intention creation failed:', intentionData)
      return res.status(500).json({ error: intentionData.detail || 'Failed to create payment intention' })
    }

    await supabase.from('tenant_payments').insert({
      tenant_id: tenant.id,
      stripe_invoice_id: null,
      amount: Math.round(amount * 100),
      currency: 'EGP',
      status: 'pending',
      payment_date: new Date().toISOString(),
    })

    const checkoutUrl = `${PAYMOB_BASE_URL}/unifiedcheckout/?publicKey=${publicKey}&clientSecret=${intentionData.client_secret}`

    res.json({
      checkout_url: checkoutUrl,
      client_secret: intentionData.client_secret,
      intention_id: intentionData.id,
    })
  } catch (err) {
    console.error('[Paymob] Checkout error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/billing/paymob/webhook - Handle Paymob callback
router.post('/webhook', async (req, res) => {
  try {
    console.log('[Paymob] Webhook received:', JSON.stringify(req.body).substring(0, 500))

    const body = req.body
    const obj = body.obj || body

    const merchantOrderId = obj.special_reference || obj.order?.merchant_order_id || body.special_reference || body.order?.merchant_order_id || ''
    const paymentSuccess = obj.success === true || obj.success === 'true' || body.success === true

    console.log(`[Paymob] Webhook: success=${paymentSuccess}, order=${merchantOrderId}, type=${body.type}`)

    const tenantIdMatch = merchantOrderId.match(/tenant-(\d+)-/)
    const tenantId = tenantIdMatch?.[1]
    const planSlugMatch = merchantOrderId.match(/tenant-\d+-(\w+)-/)
    const planSlug = planSlugMatch?.[1]

    if (paymentSuccess && tenantId) {
      const plan = PLAN_MAP[planSlug] || PLAN_MAP.pro
      console.log(`[Paymob] Webhook upgrading tenant ${tenantId} to ${plan.tier}`)

      const { error: updateErr } = await supabase
        .from('tenants')
        .update({
          subscription_status: 'active',
          subscription_tier: plan.tier,
          max_products: plan.max_products,
          max_users: plan.max_users,
          max_orders_monthly: plan.max_orders_monthly,
          trial_ends_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId)

      if (updateErr) console.error('[Paymob] Webhook update error:', updateErr.message)
      else console.log(`[Paymob] Webhook: tenant ${tenantId} upgraded to ${plan.tier}`)

      await supabase.from('tenant_payments').update({ status: 'paid' }).eq('tenant_id', tenantId).eq('status', 'pending').order('created_at', { ascending: false }).limit(1)
    } else if (merchantOrderId) {
      console.log(`[Paymob] Webhook: payment not successful for ${merchantOrderId}`)
    } else {
      console.log('[Paymob] Webhook: no merchant_order_id found')
    }

    res.json({ received: true })
  } catch (err) {
    console.error('[Paymob] Webhook error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/billing/paymob/verify - Verify payment after redirect
router.get('/verify', authenticateToken, async (req, res) => {
  try {
    const { intention_id } = req.query
    if (!intention_id) return res.status(400).json({ error: 'Missing intention_id' })

    const secretKey = process.env.PAYMOB_SECRET_KEY
    if (!secretKey) return res.status(503).json({ error: 'Paymob not configured' })

    let paymentData = null

    // Paymob redirect may pass intention ID (pi_xxx) or transaction ID (number)
    if (intention_id.startsWith('pi_')) {
      const paymobRes = await fetch(`${PAYMOB_BASE_URL}/v1/intention/${intention_id}/`, {
        headers: { 'Authorization': `Token ${secretKey}` },
      })
      paymentData = await paymobRes.json()
      console.log(`[Paymob] Verify intention ${intention_id}:`, JSON.stringify(paymentData).substring(0, 300))
    } else {
      const paymobRes = await fetch(`${PAYMOB_BASE_URL}/v1/transactions/${intention_id}`, {
        headers: { 'Authorization': `Token ${secretKey}` },
      })
      paymentData = await paymobRes.json()
      console.log(`[Paymob] Verify transaction ${intention_id}:`, JSON.stringify(paymentData).substring(0, 300))
    }

    const isPaid = paymentData?.success === true ||
      paymentData?.payment_status === 'success' ||
      paymentData?.payment_status === 'paid' ||
      paymentData?.obj?.success === true ||
      paymentData?.status === 'success'

    // Extract merchant_order_id to find tenant
    const merchantOrderId = paymentData?.special_reference ||
      paymentData?.order?.merchant_order_id ||
      paymentData?.obj?.special_reference ||
      paymentData?.obj?.order?.merchant_order_id || ''

    const tenantIdMatch = merchantOrderId.match(/tenant-(\d+)-/)
    const tenantId = tenantIdMatch?.[1]
    const planSlugMatch = merchantOrderId.match(/tenant-\d+-(\w+)-/)
    const planSlug = planSlugMatch?.[1]

    console.log(`[Paymob] Verify: paid=${isPaid}, order=${merchantOrderId}, tenant=${tenantId}, plan=${planSlug}`)

    if (isPaid && tenantId) {
      const plan = PLAN_MAP[planSlug] || PLAN_MAP.pro
      const { error: updateErr } = await supabase
        .from('tenants')
        .update({
          subscription_status: 'active',
          subscription_tier: plan.tier,
          max_products: plan.max_products,
          max_users: plan.max_users,
          max_orders_monthly: plan.max_orders_monthly,
          trial_ends_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId)

      if (updateErr) console.error('[Paymob] Verify update error:', updateErr.message)
      else console.log(`[Paymob] Verify: tenant ${tenantId} upgraded to ${plan.tier}`)

      await supabase.from('tenant_payments').update({ status: 'paid' }).eq('tenant_id', tenantId).eq('status', 'pending').order('created_at', { ascending: false }).limit(1)

      return res.json({ paid: true, plan: planSlug || 'pro' })
    }

    res.json({ paid: false, status: paymentData?.status || paymentData?.payment_status || 'pending' })
  } catch (err) {
    console.error('[Paymob] Verify error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
