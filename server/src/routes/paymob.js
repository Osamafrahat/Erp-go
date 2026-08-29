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

    const { error: insertErr } = await supabase.from('tenant_payments').insert({
      tenant_id: tenant.id,
      amount: Math.round(amount * 100),
      currency: 'EGP',
      status: 'pending',
    })
    if (insertErr) console.error('[Paymob] Failed to insert pending payment:', insertErr.message)

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
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)
      console.log(`[Paymob] Webhook upgrading tenant ${tenantId} to ${plan.tier}`)

      const { error: updateErr } = await supabase
        .from('tenants')
        .update({
          subscription_status: 'active',
          subscription_tier: plan.tier,
          max_products: plan.max_products,
          max_users: plan.max_users,
          max_orders_monthly: plan.max_orders_monthly,
          subscription_expires_at: expiresAt.toISOString(),
          trial_ends_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId)

      if (updateErr) console.error('[Paymob] Webhook update error:', updateErr.message)
      else console.log(`[Paymob] Webhook: tenant ${tenantId} upgraded to ${plan.tier}`)

      const { error: payErr } = await supabase.from('tenant_payments').update({ status: 'paid' }).eq('tenant_id', tenantId).eq('status', 'pending').order('created_at', { ascending: false }).limit(1)
      if (payErr) console.error('[Paymob] Webhook payment update error:', payErr.message)
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
    const { intention_id, id: txnId } = req.query
    const lookupId = intention_id || txnId
    if (!lookupId) return res.status(400).json({ error: 'Missing id' })

    const secretKey = process.env.PAYMOB_SECRET_KEY
    const apiKey = process.env.PAYMOB_API_KEY
    if (!secretKey) return res.status(503).json({ error: 'Paymob not configured' })

    let paymentData = null

    if (lookupId.startsWith('pi_')) {
      // Intention ID — use element retrieve API (no auth needed)
      const pubKey = process.env.PAYMOB_PUBLIC_KEY
      const paymobRes = await fetch(`${PAYMOB_BASE_URL}/v1/intention/element/${pubKey}/${lookupId}/`)
      paymentData = await paymobRes.json()
    } else if (apiKey) {
      // Transaction ID — use management API (need auth token first)
      const authRes = await fetch(`${PAYMOB_BASE_URL}/api/auth/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey }),
      })
      const authData = await authRes.json()
      const authToken = authData?.token

      if (authToken) {
        const txnRes = await fetch(`${PAYMOB_BASE_URL}/api/acceptance/transactions/${lookupId}?token=${authToken}`)
        paymentData = await txnRes.json()
      }
    } else {
      // Fallback: try with secret key as token parameter
      const txnRes = await fetch(`${PAYMOB_BASE_URL}/api/acceptance/transactions/${lookupId}?token=${secretKey}`)
      paymentData = await txnRes.json()
    }

    console.log(`[Paymob] Verify ${lookupId}:`, JSON.stringify(paymentData).substring(0, 400))

    // Check success from various response shapes
    const isPaid = paymentData?.success === true
      || paymentData?.status === 'paid'
      || paymentData?.status === 'successful'
      || paymentData?.payment_status === 'success'
      || paymentData?.pending === false && paymentData?.is_refunded === false
      || paymentData?.obj?.success === true

    // Extract merchant_order_id (our special_reference)
    const merchantOrderId = paymentData?.order?.merchant_order_id
      || paymentData?.merchant_order_id
      || paymentData?.obj?.order?.merchant_order_id
      || paymentData?.special_reference
      || ''

    console.log(`[Paymob] Verify: paid=${isPaid}, merchant_order_id=${merchantOrderId}`)

    const tenantIdMatch = merchantOrderId.match(/tenant-(\d+)-/)
    const tenantId = tenantIdMatch?.[1]
    const planSlugMatch = merchantOrderId.match(/tenant-\d+-(\w+)-/)
    const planSlug = planSlugMatch?.[1]

    if (isPaid && tenantId) {
      const plan = PLAN_MAP[planSlug] || PLAN_MAP.pro
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)
      const { error: updateErr } = await supabase
        .from('tenants')
        .update({
          subscription_status: 'active',
          subscription_tier: plan.tier,
          max_products: plan.max_products,
          max_users: plan.max_users,
          max_orders_monthly: plan.max_orders_monthly,
          subscription_expires_at: expiresAt.toISOString(),
          trial_ends_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId)

      if (updateErr) console.error('[Paymob] Verify update error:', updateErr.message)
      else console.log(`[Paymob] Verify: tenant ${tenantId} upgraded to ${plan.tier}`)

      const { error: payErr } = await supabase.from('tenant_payments').update({ status: 'paid' }).eq('tenant_id', tenantId).eq('status', 'pending').order('created_at', { ascending: false }).limit(1)
      if (payErr) console.error('[Paymob] Verify payment update error:', payErr.message)

      return res.json({ paid: true, plan: planSlug || 'pro' })
    }

    // Not paid or not found
    res.json({ paid: false, status: paymentData?.status || (paymentData?.pending === false ? 'completed' : 'pending') })
  } catch (err) {
    console.error('[Paymob] Verify error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/billing/paymob/cards - List saved payment methods
router.get('/cards', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('saved_payment_methods')
      .select('id, provider, card_last_four, card_brand, is_default, created_at')
      .eq('tenant_id', req.user.tenantId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/billing/paymob/cards - Save a new payment method token
router.post('/cards', authenticateToken, async (req, res) => {
  try {
    const { token, card_last_four, card_brand, paymob_token_id } = req.body
    if (!token) return res.status(400).json({ error: 'Token is required' })

    const { data: existing } = await supabase
      .from('saved_payment_methods')
      .select('id')
      .eq('tenant_id', req.user.tenantId)
      .limit(1)

    const isDefault = !existing || existing.length === 0

    const { data, error } = await supabase
      .from('saved_payment_methods')
      .insert({
        tenant_id: req.user.tenantId,
        provider: 'paymob',
        card_last_four: card_last_four || null,
        card_brand: card_brand || null,
        token,
        paymob_token_id: paymob_token_id || null,
        is_default: isDefault,
      })
      .select('id, provider, card_last_four, card_brand, is_default, created_at')
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/billing/paymob/cards/:id - Delete a saved payment method
router.delete('/cards/:id', authenticateToken, async (req, res) => {
  try {
    const { error } = await supabase
      .from('saved_payment_methods')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', req.user.tenantId)

    if (error) throw error
    res.json({ message: 'Payment method deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/billing/paymob/cards/:id/default - Set a card as default
router.post('/cards/:id/default', authenticateToken, async (req, res) => {
  try {
    // Reset all defaults
    await supabase
      .from('saved_payment_methods')
      .update({ is_default: false })
      .eq('tenant_id', req.user.tenantId)

    // Set new default
    const { error } = await supabase
      .from('saved_payment_methods')
      .update({ is_default: true })
      .eq('id', req.params.id)
      .eq('tenant_id', req.user.tenantId)

    if (error) throw error
    res.json({ message: 'Default payment method updated' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/billing/paymob/renew - Auto-renew using saved card
router.post('/renew', authenticateToken, async (req, res) => {
  try {
    const { planSlug } = req.body
    if (!planSlug) return res.status(400).json({ error: 'Plan slug is required' })

    const { data: card } = await supabase
      .from('saved_payment_methods')
      .select('*')
      .eq('tenant_id', req.user.tenantId)
      .eq('is_default', true)
      .single()

    if (!card) {
      return res.status(400).json({ error: 'No saved payment method found. Please add a card first.' })
    }

    const plan = PLAN_MAP[planSlug] || PLAN_MAP.pro
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', req.user.tenantId)
      .single()

    const secretKey = process.env.PAYMOB_SECRET_KEY
    const cardIntegrationId = process.env.PAYMOB_CARD_INTEGRATION_ID

    // Create a new payment using saved token
    const intentionRes = await fetch(`${PAYMOB_BASE_URL}/v1/intention/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${secretKey}`,
      },
      body: JSON.stringify({
        amount: 0, // Amount will be overridden by token
        currency: 'EGP',
        payment_methods: [Number(cardIntegrationId)],
        items: [{ name: `${planSlug} renewal`, amount: 0, quantity: 1 }],
        billing_data: {
          first_name: tenant?.name || 'Customer',
          last_name: 'Renewal',
          email: '',
          phone_number: '+201000000000',
          apartment: 'N/A', floor: 'N/A', street: 'N/A', building: 'N/A',
          city: 'Cairo', country: 'EGY', postal_code: '00000', state: 'Cairo',
        },
        special_reference: `tenant-${tenant?.id}-${planSlug}-${Date.now()}`,
      }),
    })

    const intentionData = await intentionRes.json()

    if (!intentionData.client_secret) {
      return res.status(500).json({ error: 'Failed to create renewal intention' })
    }

    res.json({
      client_secret: intentionData.client_secret,
      intention_id: intentionData.id,
      message: 'Renewal intention created. Complete payment to renew.',
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
