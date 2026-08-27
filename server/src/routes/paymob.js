import { Router } from 'express'
import crypto from 'crypto'
import supabase from '../db/supabase.js'
import { authenticateToken } from '../middleware/auth.js'

const router = Router()

const PAYMOB_API_URL = 'https://accept.paymob.com/api'

async function paymobAuth() {
  const apiKey = process.env.PAYMOB_API_KEY
  if (!apiKey) throw new Error('PAYMOB_API_KEY not configured')

  const res = await fetch(`${PAYMOB_API_URL}/auth/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey }),
  })
  const data = await res.json()
  if (!data.token) throw new Error('Paymob auth failed')
  return data.token
}

// POST /api/billing/paymob/order - Create Paymob order
router.post('/order', authenticateToken, async (req, res) => {
  try {
    const { amount, planSlug } = req.body
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' })

    const token = await paymobAuth()

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

    const res2 = await fetch(`${PAYMOB_API_URL}/ecommerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: token,
        delivery_needed: false,
        amount_cents: Math.round(amount * 100),
        currency: 'EGP',
        merchant_order_id: `${tenant?.id}-${Date.now()}`,
        items: [
          {
            name: planSlug ? `${planSlug} subscription` : 'Subscription',
            amount_cents: Math.round(amount * 100),
            description: `Payment for ${planSlug || 'subscription'} plan`,
            quantity: 1,
          },
        ],
        billing_data: {
          first_name: user?.full_name?.split(' ')[0] || 'Customer',
          last_name: user?.full_name?.split(' ').slice(1).join(' ') || '',
          email: user?.email || '',
          phone_number: '+201000000000',
          apartment: 'N/A',
          floor: 'N/A',
          street: 'N/A',
          building: 'N/A',
          city: 'Cairo',
          country: 'EG',
          postal_code: '00000',
          state: 'Cairo',
        },
      }),
    })

    const orderData = await res2.json()
    if (orderData.id) {
      await supabase.from('tenant_payments').insert({
        tenant_id: tenant.id,
        stripe_invoice_id: null,
        amount: Math.round(amount * 100),
        currency: 'EGP',
        status: 'pending',
        payment_date: new Date().toISOString(),
      })
    }

    res.json({ order_id: orderData.id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/billing/paymob/pay - Get Paymob payment key
router.post('/pay', authenticateToken, async (req, res) => {
  try {
    const { orderId, integrationId, billingData } = req.body
    if (!orderId || !integrationId) return res.status(400).json({ error: 'Missing orderId or integrationId' })

    const token = await paymobAuth()

    const res2 = await fetch(`${PAYMOB_API_URL}/acceptance/payment_keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: token,
        amount_cents: req.body.amount_cents || 0,
        currency: 'EGP',
        order_id: orderId,
        integration_id: integrationId,
        billing_data: billingData || {
          first_name: 'Customer',
          last_name: '',
          email: 'test@test.com',
          phone_number: '+201000000000',
          apartment: 'N/A',
          floor: 'N/A',
          street: 'N/A',
          building: 'N/A',
          city: 'Cairo',
          country: 'EG',
          postal_code: '00000',
          state: 'Cairo',
        },
      }),
    })

    const data = await res2.json()
    res.json({ token: data.token, iframUrl: data.iframe_url })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/billing/paymob/webhook - Handle Paymob webhook
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

    const order = req.body
    const paymentStatus = order.obj?.order?.payment_status
    const merchantOrderId = order.obj?.order?.merchant_order_id

    if (paymentStatus === 'SUCCESS') {
      const tenantId = merchantOrderId?.split('-')[0]
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
      console.log(`[Paymob] Payment status: ${paymentStatus}`)
    }

    res.json({ received: true })
  } catch (err) {
    console.error('[Paymob] Webhook error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
