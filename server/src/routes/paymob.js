import { Router } from 'express'
import crypto from 'crypto'
import supabase from '../db/supabase.js'
import { authenticateToken } from '../middleware/auth.js'

const router = Router()

const PAYMOB_BASE_URL = 'https://accept.paymob.com'

// POST /api/billing/paymob/checkout - Create intention and return client_secret
router.post('/checkout', authenticateToken, async (req, res) => {
  try {
    const secretKey = process.env.PAYMOB_SECRET_KEY
    const publicKey = process.env.PAYMOB_PUBLIC_KEY
    const cardIntegrationId = process.env.PAYMOB_CARD_INTEGRATION_ID
    const walletIntegrationId = process.env.PAYMOB_WALLET_INTEGRATION_ID
    const webhookUrl = `${req.protocol}://${req.get('host')}/api/billing/paymob/webhook`
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

    const merchantOrderId = `tenant-${tenant?.id}-${Date.now()}`

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
    if (!hmacSecret) return res.status(500).json({ error: 'Webhook secret not configured' })

    const hmac = crypto.createHmac('sha512', hmacSecret)
    const sortedParams = Object.keys(req.body)
      .sort()
      .reduce((acc, key) => {
        if (key !== 'hmac') acc[key] = req.body[key]
        return acc
      }, {})

    const hmacString = Object.entries(sortedParams)
      .map(([k, v]) => `${k}${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join('')

    hmac.update(hmacString)
    const computedHmac = hmac.digest('hex')

    if (computedHmac !== req.body.hmac) {
      console.error('[Paymob] HMAC verification failed')
      return res.status(400).json({ error: 'Invalid HMAC' })
    }

    const transaction = req.body
    const paymentStatus = transaction.success
    const merchantOrderId = transaction.special_reference || transaction.order?.merchant_order_id

    if (paymentStatus === true || paymentStatus === 'true') {
      const tenantId = merchantOrderId?.match(/tenant-(\d+)-/)?.[1]
      if (tenantId) {
        await supabase
          .from('tenants')
          .update({
            subscription_status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', tenantId)

        console.log(`[Paymob] Payment successful for tenant ${tenantId}`)
      }
    } else {
      console.log(`[Paymob] Payment failed: ${merchantOrderId}`)
    }

    res.json({ received: true })
  } catch (err) {
    console.error('[Paymob] Webhook error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
