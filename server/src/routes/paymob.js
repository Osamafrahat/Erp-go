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
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?paymob=success`

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
    const hmacSecret = process.env.PAYMOB_HMAC_SECRET
    if (!hmacSecret) {
      console.error('[Paymob] HMAC secret not configured')
      return res.status(500).json({ error: 'Webhook secret not configured' })
    }

    const body = req.body
    console.log('[Paymob] Webhook received:', JSON.stringify(body).substring(0, 500))

    if (body.hmac && hmacSecret) {
      const hmac = crypto.createHmac('sha512', hmacSecret)
      const sortedParams = Object.keys(body)
        .sort()
        .reduce((acc, key) => {
          if (key !== 'hmac') acc[key] = body[key]
          return acc
        }, {})

      const hmacString = Object.entries(sortedParams)
        .map(([k, v]) => `${k}${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join('')

      hmac.update(hmacString)
      const computedHmac = hmac.digest('hex')

      if (computedHmac !== body.hmac) {
        console.error('[Paymob] HMAC verification failed')
        return res.status(400).json({ error: 'Invalid HMAC' })
      }
    }

    const merchantOrderId = body.special_reference || body.order?.merchant_order_id || ''
    const paymentSuccess = body.success === true || body.success === 'true'
    const paymentStatus = body.transaction?.status || body.obj?.order?.payment_status

    console.log(`[Paymob] Payment callback: success=${paymentSuccess}, status=${paymentStatus}, order=${merchantOrderId}`)

    const tenantIdMatch = merchantOrderId.match(/tenant-(\d+)-/)
    const tenantId = tenantIdMatch?.[1]
    const planSlugMatch = merchantOrderId.match(/tenant-\d+-(\w+)-/)
    const planSlug = planSlugMatch?.[1] || body.extras?.plan_slug

    if (paymentSuccess && tenantId) {
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

      if (updateErr) {
        console.error('[Paymob] Failed to update tenant:', updateErr.message)
      } else {
        console.log(`[Paymob] Tenant ${tenantId} upgraded to ${plan.tier}`)
      }

      await supabase
        .from('tenant_payments')
        .update({ status: 'paid' })
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)

    } else if (tenantId) {
      console.log(`[Paymob] Payment failed for tenant ${tenantId}: ${paymentStatus}`)
    }

    res.json({ received: true })
  } catch (err) {
    console.error('[Paymob] Webhook error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
