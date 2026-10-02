import { Router } from 'express'
import crypto from 'crypto'
import supabase from '../db/supabase.js'
import { authenticateToken, requireManager } from '../middleware/auth.js'
import { logActivity } from '../middleware/activityLogger.js'
import { planEntitlements } from '../services/planLimits.js'

const router = Router()

const PAYMOB_BASE_URL = 'https://accept.paymob.com'

const PLAN_MAP = {
  pro: { tier: 'pro', ...planEntitlements('pro') },
  enterprise: { tier: 'enterprise', ...planEntitlements('enterprise') },
}

// POST /api/billing/paymob/checkout - Create intention and return client_secret
router.post('/checkout', authenticateToken, requireManager, async (req, res) => {
  try {
    const secretKey = process.env.PAYMOB_SECRET_KEY
    const publicKey = process.env.PAYMOB_PUBLIC_KEY
    const cardIntegrationId = process.env.PAYMOB_CARD_INTEGRATION_ID
    const walletIntegrationId = process.env.PAYMOB_WALLET_INTEGRATION_ID
    const webhookUrl = `${process.env.BACKEND_URL || 'https://erp-go-crimson-wind-2087.fly.dev'}/api/billing/paymob/webhook`
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pricing`

    if (!secretKey || !publicKey || !cardIntegrationId) {
      return res.status(503).json({ error: 'Paymob not fully configured. Missing keys.' })
    }

    const { amount, planSlug, billingPeriod } = req.body
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' })

    const period = billingPeriod === 'yearly' ? 'yearly' : 'monthly'

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

    const merchantOrderId = `tenant-${tenant?.id}-${planSlug || 'unknown'}-${period}-${Date.now()}`

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

    // Dedup: skip if this order already has a payment record
    const { data: existingPayment } = await supabase
      .from('tenant_payments')
      .select('id')
      .eq('description', merchantOrderId)
      .limit(1)

    if (!existingPayment || existingPayment.length === 0) {
      const { error: insertErr } = await supabase.from('tenant_payments').insert({
        tenant_id: tenant.id,
        amount: amount,
        currency: 'EGP',
        status: 'pending',
        description: merchantOrderId,
      })
      if (insertErr) console.error('[Paymob] Failed to insert pending payment:', insertErr.message)
    }

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

// ---------------------------------------------------------------------------
// Paymob callback verification
// ---------------------------------------------------------------------------
// Paymob's HMAC signature for acceptance callbacks: HMAC-SHA512 over the
// ordered, concatenated callback fields, keyed with PAYMOB_HMAC_SECRET.
const PAYMOB_HMAC_ORDER = [
  'amount_cents', 'currency', 'error_messages', 'integration_id',
  'is_3d_secure', 'is_auth', 'is_capture', 'is_refunded', 'is_voided',
  'merchant_id', 'merchant_order_id', 'order_id', 'owner', 'pan',
  'profile_id', 'source_data.sub_type', 'source_data.type',
  'statement_descriptor', 'success',
]

function dig(obj, path) {
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj)
}

function computePaymobHmac(payload, secret) {
  const concat = PAYMOB_HMAC_ORDER.map((key) => {
    const v = dig(payload, key)
    return v === undefined || v === null ? '' : String(v)
  }).join('')
  return crypto.createHmac('sha512', secret).update(concat).digest('hex')
}

function safeEqualHex(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8')
  const bufB = Buffer.from(String(b || ''), 'utf8')
  if (bufA.length !== bufB.length || bufA.length === 0) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Decide whether a Paymob callback can be trusted.
 * Returns { ok: true } or { ok: false, status, reason }.
 *
 * Two independent gates, both required to pass:
 *  1. HMAC signature (when PAYMOB_HMAC_SECRET is configured and `hmac` present)
 *  2. Authoritative re-fetch from Paymob's own API -- the callback body is
 *     attacker-controlled, so we never grant a tier based on it alone.
 */
async function verifyPaymobCallback(callback) {
  const secret = process.env.PAYMOB_HMAC_SECRET
  const receivedHmac = callback?.hmac || callback?.obj?.hmac

  if (secret) {
    if (!receivedHmac) {
      return { ok: false, status: 401, reason: 'missing hmac' }
    }
    const source = callback?.obj || callback
    const expected = computePaymobHmac(source, secret)
    if (!safeEqualHex(expected, receivedHmac)) {
      return { ok: false, status: 401, reason: 'hmac mismatch' }
    }
  }

  // Re-fetch the payment from Paymob rather than trusting the POST body.
  const lookupId = callback?.obj?.id || callback?.id
    || callback?.obj?.order?.id || callback?.order?.id

  if (!lookupId) {
    return { ok: false, status: 400, reason: 'no transaction id to verify' }
  }

  const secretKey = process.env.PAYMOB_SECRET_KEY
  const apiKey = process.env.PAYMOB_API_KEY
  if (!secretKey && !apiKey) {
    return { ok: false, status: 503, reason: 'Paymob not configured' }
  }

  let paymentData = null
  try {
    if (String(lookupId).startsWith('pi_') && process.env.PAYMOB_PUBLIC_KEY) {
      const res = await fetch(
        `${PAYMOB_BASE_URL}/v1/intention/element/${process.env.PAYMOB_PUBLIC_KEY}/${lookupId}/`
      )
      if (res.ok) paymentData = await res.json()
    } else if (apiKey) {
      const authRes = await fetch(`${PAYMOB_BASE_URL}/api/auth/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey }),
      })
      const authData = await authRes.json()
      if (authData?.token) {
        const txnRes = await fetch(
          `${PAYMOB_BASE_URL}/api/acceptance/transactions/${lookupId}?token=${authData.token}`
        )
        if (txnRes.ok) paymentData = await txnRes.json()
      }
    } else {
      const txnRes = await fetch(
        `${PAYMOB_BASE_URL}/api/acceptance/transactions/${lookupId}?token=${secretKey}`
      )
      if (txnRes.ok) paymentData = await txnRes.json()
    }
  } catch (e) {
    console.error('[Paymob] Verification fetch failed:', e.message)
    return { ok: false, status: 502, reason: 'verification request failed' }
  }

  if (!paymentData) {
    return { ok: false, status: 502, reason: 'no response from Paymob' }
  }

  const authoritativeSuccess = paymentData?.success === true
    || paymentData?.status === 'paid'
    || paymentData?.status === 'successful'
    || paymentData?.payment_status === 'success'
    || paymentData?.obj?.success === true
    || (paymentData?.pending === false && paymentData?.is_refunded === false)

  if (!authoritativeSuccess) {
    return { ok: false, status: 400, reason: 'Paymob reports payment not successful' }
  }

  return { ok: true, paymentData }
}

// POST /api/billing/paymob/webhook - Handle Paymob callback
//
// SECURITY: this handler previously trusted the raw POST body entirely --
// anyone could POST { success:true, special_reference:"tenant-1-pro-..." }
// and upgrade any tenant to Enterprise (and inject card tokens). It now
// verifies the HMAC signature and re-fetches the payment from Paymob.
router.post('/webhook', async (req, res) => {
  try {
    // Log a redacted summary only -- never the full payload (contains PII /
    // payment data).
    console.log('[Paymob] Webhook received (keys):', Object.keys(req.body || {}).join(','))

    const body = req.body
    const obj = body.obj || body

    const merchantOrderId = obj.special_reference || obj.order?.merchant_order_id || body.special_reference || body.order?.merchant_order_id || ''

    const verification = await verifyPaymobCallback(body)
    if (!verification.ok) {
      console.warn(`[Paymob] Webhook rejected (${verification.reason})`)
      // Non-2xx so Paymob retries on transient failures, but do not leak why.
      return res.status(verification.status).json({ error: 'Verification failed' })
    }

    const paymentSuccess = true
    const vObj = verification.paymentData
    const claimedMerchantOrderId = vObj?.order?.merchant_order_id
      || vObj?.merchant_order_id
      || vObj?.obj?.order?.merchant_order_id
      || vObj?.special_reference
      || ''

    // The order id Paymob confirms must match the one in the callback,
    // otherwise an attacker could replay a real payment for another tenant.
    if (claimedMerchantOrderId && merchantOrderId && claimedMerchantOrderId !== merchantOrderId) {
      console.warn(`[Paymob] Webhook rejected: merchant_order_id mismatch (${claimedMerchantOrderId} != ${merchantOrderId})`)
      return res.status(400).json({ error: 'Order reference mismatch' })
    }

    console.log(`[Paymob] Webhook verified: success=${paymentSuccess}, order=${merchantOrderId}, type=${body.type}`)

    const tenantIdMatch = merchantOrderId.match(/tenant-(\d+)-/)
    const tokenizeMatch = merchantOrderId.match(/tokenize-tenant-(\d+)-/)
    const tenantId = tenantIdMatch?.[1] || tokenizeMatch?.[1]
    const isTokenize = merchantOrderId.startsWith('tokenize-')
    const planSlugMatch = merchantOrderId.match(/tenant-\d+-(\w+)-/)
    const planSlug = planSlugMatch?.[1]
    const periodMatch = merchantOrderId.match(/tenant-\d+-\w+-(yearly|monthly)-/)
    const billingPeriod = periodMatch?.[1] || 'monthly'
    const expiryDays = billingPeriod === 'yearly' ? 365 : 30

    if (paymentSuccess && tenantId) {
      if (isTokenize) {
        // Tokenize-only: just save the card
        const cardToken = obj.token || obj.payment_data?.card_token || obj.card_token
        const cardLastFour = obj.payment_data?.card_last_four || obj.card_last_four
        const cardBrand = obj.payment_data?.card_type || obj.card_type

        if (cardToken) {
          try {
            await supabase.from('saved_payment_methods').update({ is_default: false }).eq('tenant_id', tenantId)
            await supabase.from('saved_payment_methods').insert({
              tenant_id: tenantId,
              provider: 'paymob',
              token: cardToken,
              card_last_four: cardLastFour || null,
              card_brand: cardBrand || null,
              paymob_token_id: cardToken,
              is_default: true,
            })
            console.log(`[Paymob] Webhook: saved card (tokenize) for tenant ${tenantId}`)
          } catch (e) {
            console.error('[Paymob] Webhook tokenize card save error:', e.message)
          }
        }
      } else {
        // Subscription upgrade
        const plan = PLAN_MAP[planSlug] || PLAN_MAP.pro
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + expiryDays)
        console.log(`[Paymob] Webhook upgrading tenant ${tenantId} to ${plan.tier} (${billingPeriod})`)

        // Get current tier for activity logging
        const { data: currentTenant } = await supabase
          .from('tenants')
          .select('subscription_tier, name')
          .eq('id', tenantId)
          .single()

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

        // Log subscription tier change
        if (currentTenant && plan.tier !== currentTenant.subscription_tier) {
          await logActivity({
            user_name: 'System',
            action: 'upgraded',
            entity_type: 'subscription',
            entity_id: tenantId,
            entity_name: currentTenant.name,
            details: { from_tier: currentTenant.subscription_tier, to_tier: plan.tier, billing_period: billingPeriod, source: 'paymob_webhook' },
            tenant_id: tenantId,
          })
        }

        const { error: payErr } = await supabase.from('tenant_payments').update({ status: 'paid' }).eq('tenant_id', tenantId).eq('description', merchantOrderId).eq('status', 'pending').limit(1)
        if (payErr) console.error('[Paymob] Webhook payment update error:', payErr.message)

        // Save card token from webhook
        const cardToken = obj.token || obj.payment_data?.card_token || obj.card_token
        const cardLastFour = obj.payment_data?.card_last_four || obj.card_last_four
        const cardBrand = obj.payment_data?.card_type || obj.card_type

        if (cardToken && tenantId) {
          try {
            await supabase.from('saved_payment_methods').update({ is_default: false }).eq('tenant_id', tenantId)
            await supabase.from('saved_payment_methods').insert({
              tenant_id: tenantId,
              provider: 'paymob',
              token: cardToken,
              card_last_four: cardLastFour || null,
              card_brand: cardBrand || null,
              paymob_token_id: cardToken,
              is_default: true,
            })
            console.log(`[Paymob] Webhook: saved card for tenant ${tenantId}`)
          } catch (e) {
            console.error('[Paymob] Webhook card save exception:', e.message)
          }
        }
      }
    } else if (merchantOrderId) {
      console.log(`[Paymob] Webhook: payment not successful for ${merchantOrderId}`)
    } else {
      console.log('[Paymob] Webhook: no merchant_order_id found')
    }

    res.json({ received: true })
  } catch (err) {
    console.error('[Paymob] Webhook error:', err.message)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/billing/paymob/verify - Verify payment after redirect
router.get('/verify', authenticateToken, requireManager, async (req, res) => {
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
    const tokenizeMatch = merchantOrderId.match(/tokenize-tenant-(\d+)-/)
    const tenantId = tenantIdMatch?.[1] || tokenizeMatch?.[1]
    const isTokenize = merchantOrderId.startsWith('tokenize-')
    const planSlugMatch = merchantOrderId.match(/tenant-\d+-(\w+)-/)
    const planSlug = planSlugMatch?.[1]
    const periodMatch = merchantOrderId.match(/tenant-\d+-\w+-(yearly|monthly)-/)
    const billingPeriod = periodMatch?.[1] || 'monthly'
    const expiryDays = billingPeriod === 'yearly' ? 365 : 30

    if (isPaid && tenantId) {
      // Save card token if present
      const cardToken = paymentData?.token || paymentData?.payment_data?.card_token || paymentData?.obj?.token
      const cardLastFour = paymentData?.payment_data?.card_last_four || paymentData?.card_last_four || paymentData?.obj?.payment_data?.card_last_four
      const cardBrand = paymentData?.payment_data?.card_type || paymentData?.card_type || paymentData?.obj?.payment_data?.card_type

      if (isTokenize) {
        // Tokenize-only: just save the card
        if (cardToken) {
          try {
            await supabase.from('saved_payment_methods').update({ is_default: false }).eq('tenant_id', tenantId)
            await supabase.from('saved_payment_methods').insert({
              tenant_id: tenantId,
              provider: 'paymob',
              token: cardToken,
              card_last_four: cardLastFour || null,
              card_brand: cardBrand || null,
              paymob_token_id: cardToken,
              is_default: true,
            })
            console.log(`[Paymob] Verify: saved card (tokenize) for tenant ${tenantId}`)
          } catch (e) {
            console.error('[Paymob] Verify tokenize card save error:', e.message)
          }
        }
        return res.json({ paid: true, plan: 'tokenize' })
      }

      // Subscription upgrade
      const plan = PLAN_MAP[planSlug] || PLAN_MAP.pro
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + expiryDays)

      // Get current tier for activity logging
      const { data: currentTenant } = await supabase
        .from('tenants')
        .select('subscription_tier, name')
        .eq('id', tenantId)
        .single()

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

      // Log subscription tier change
      if (currentTenant && plan.tier !== currentTenant.subscription_tier) {
        await logActivity({
          user_name: 'System',
          action: 'upgraded',
          entity_type: 'subscription',
          entity_id: tenantId,
          entity_name: currentTenant.name,
          details: { from_tier: currentTenant.subscription_tier, to_tier: plan.tier, billing_period: billingPeriod, source: 'paymob_verify' },
          tenant_id: tenantId,
        })
      }

      const { error: payErr } = await supabase.from('tenant_payments').update({ status: 'paid' }).eq('tenant_id', tenantId).eq('description', merchantOrderId).eq('status', 'pending').limit(1)
      if (payErr) console.error('[Paymob] Verify payment update error:', payErr.message)

      if (cardToken && tenantId) {
        try {
          // Upsert: set all other cards as non-default, then insert new one
          await supabase.from('saved_payment_methods').update({ is_default: false }).eq('tenant_id', tenantId)
          const { error: cardErr } = await supabase.from('saved_payment_methods').insert({
            tenant_id: tenantId,
            provider: 'paymob',
            token: cardToken,
            card_last_four: cardLastFour || null,
            card_brand: cardBrand || null,
            paymob_token_id: cardToken,
            is_default: true,
          })
          if (cardErr) console.error('[Paymob] Verify save card error:', cardErr.message)
          else console.log(`[Paymob] Verify: saved card for tenant ${tenantId}`)
        } catch (e) {
          console.error('[Paymob] Verify card save exception:', e.message)
        }
      }

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
router.get('/cards', authenticateToken, requireManager, async (req, res) => {
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
router.post('/cards', authenticateToken, requireManager, async (req, res) => {
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

// POST /api/billing/paymob/tokenize - Create a tokenization intention for saving a card
router.post('/tokenize', authenticateToken, requireManager, async (req, res) => {
  try {
    const secretKey = process.env.PAYMOB_SECRET_KEY
    const publicKey = process.env.PAYMOB_PUBLIC_KEY
    const cardIntegrationId = process.env.PAYMOB_CARD_INTEGRATION_ID
    const webhookUrl = `${process.env.BACKEND_URL || 'https://erp-go-crimson-wind-2087.fly.dev'}/api/billing/paymob/webhook`
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing`

    if (!secretKey || !publicKey || !cardIntegrationId) {
      return res.status(503).json({ error: 'Paymob not configured' })
    }

    const { data: user } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', req.user.id)
      .single()

    const merchantOrderId = `tokenize-tenant-${req.user.tenantId}-${Date.now()}`

    const intentionRes = await fetch(`${PAYMOB_BASE_URL}/v1/intention/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secretKey}`,
      },
      body: JSON.stringify({
        amount: 100,
        currency: 'EGP',
        payment_methods: [Number(cardIntegrationId)],
        items: [{ name: 'Card Tokenization', amount: 100, description: 'Save card for renewal', quantity: 1 }],
        billing_data: {
          first_name: user?.full_name?.split(' ')[0] || 'Customer',
          last_name: user?.full_name?.split(' ').slice(1).join(' ') || 'User',
          email: user?.email || '',
          phone_number: '+201000000000',
          apartment: 'N/A', floor: 'N/A', street: 'N/A', building: 'N/A',
          city: 'Cairo', country: 'EGY', postal_code: '00000', state: 'Cairo',
        },
        special_reference: merchantOrderId,
        notification_url: webhookUrl,
        redirection_url: redirectUrl,
        extras: { action: 'tokenize', tenant_id: req.user.tenantId },
      }),
    })

    const intentionData = await intentionRes.json()
    if (!intentionData.client_secret) {
      return res.status(500).json({ error: intentionData.detail || 'Failed to create tokenization intention' })
    }

    res.json({ checkout_url: `https://accept.paymob.com/unifiedcheckout/?publicKey=${publicKey}&clientSecret=${intentionData.client_secret}` })
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
router.post('/cards/:id/default', authenticateToken, requireManager, async (req, res) => {
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
router.post('/renew', authenticateToken, requireManager, async (req, res) => {
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
