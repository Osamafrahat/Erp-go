import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import crypto from 'crypto'
import supabase from '../db/supabase.js'
import { authenticateToken, requireManager, requireSuperAdmin } from '../middleware/auth.js'
import { logActivity } from '../middleware/activityLogger.js'
import { planEntitlements } from '../services/planLimits.js'
import {
  getWalletMethods,
  isValidWalletTypeId,
  parseScreenshot,
  sanitizeReference,
  sanitizeReason,
  computeWalletAmount,
  isMissingTableError,
} from '../services/walletPaymentUtils.js'

// User-facing flow: shows receiving numbers, accepts a transfer proof.
export const walletUserRouter = Router()

// Super-admin flow: reviews proofs and confirms/rejects payments.
export const walletAdminRouter = Router()

// Boot-time visibility: operators change receiving numbers via the
// WALLET_CONFIG secret, so log which configuration actually loaded.
const bootWalletCfg = getWalletMethods()
console.log(
  bootWalletCfg.configured
    ? `[Wallet] ${bootWalletCfg.methods.length} receiving method(s): ${bootWalletCfg.methods
        .map((m) => `${m.id} (${m.name_ar || m.name})`)
        .join(', ')}`
    : '[Wallet] WALLET_CONFIG missing or invalid — wallet transfer disabled'
)

// Submissions carry a full screenshot (~4MB) — a tight per-IP budget prevents
// the endpoint from being used to flood storage or the dashboard.
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment submissions. Please try again later.' },
})

const TABLE_HINT = 'Wallet transfer is being set up. Please contact support to pay.'

function validId(req, res, next) {
  if (!/^\d{1,18}$/.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid request id' })
  }
  next()
}

const SELECT_LIST =
  'id, tenant_id, user_id, plan_slug, billing_period, amount_egp, wallet_type, ' +
  'reference_note, payment_code, status, rejection_reason, confirmed_by, confirmed_at, created_at'

// ---------------------------------------------------------------------------
// User routes — mounted at /api/billing/wallet
// ---------------------------------------------------------------------------

// Receiving numbers for the transfer. Auth required so only real tenants see
// them; returns configured:false until the operator sets WALLET_CONFIG.
walletUserRouter.get('/config', authenticateToken, (req, res) => {
  res.json(getWalletMethods())
})

// The tenant's latest request (never includes the screenshot payload).
walletUserRouter.get('/status', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('wallet_payment_requests')
      .select(SELECT_LIST)
      .eq('tenant_id', req.user.tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
    if (error) {
      if (isMissingTableError(error)) return res.json({ request: null, setupPending: true })
      throw error
    }
    res.json({ request: data?.[0] || null })
  } catch (err) {
    console.error('[Wallet] status error:', err.message)
    res.status(500).json({ error: 'Could not load payment status' })
  }
})

// Submit a transfer proof. Privilege matches the card flow exactly
// (authenticateToken + requireManager on /billing/paymob/checkout).
walletUserRouter.post('/submit', authenticateToken, requireManager, submitLimiter, async (req, res) => {
  try {
    const { planSlug, billingPeriod, walletType, referenceNote, screenshot } = req.body || {}

    // Allowlisted plans only — never accept free-form slugs.
    if (planSlug !== 'pro' && planSlug !== 'enterprise') {
      return res.status(400).json({ error: 'Invalid plan' })
    }
    const period = billingPeriod === 'yearly' ? 'yearly' : 'monthly'

    const walletCfg = getWalletMethods()
    if (!walletCfg.configured) return res.status(503).json({ error: TABLE_HINT })
    if (!isValidWalletTypeId(walletType) || !walletCfg.methods.some((m) => m.id === walletType)) {
      return res.status(400).json({ error: 'Invalid wallet type' })
    }

    const shot = parseScreenshot(screenshot)
    if (!shot.ok) return res.status(400).json({ error: shot.error })
    const reference = sanitizeReference(referenceNote)

    // Amount comes from the database, never from the request body.
    const { data: planRow, error: planErr } = await supabase
      .from('subscription_plans')
      .select('slug, price_monthly, price_yearly')
      .eq('slug', planSlug)
      .single()
    if (planErr || !planRow) return res.status(400).json({ error: 'Plan not available' })
    const amount = computeWalletAmount(planRow, period)
    if (amount === null) return res.status(400).json({ error: 'Plan price not configured' })

    // Fast-path duplicate check; the partial unique index below is the
    // authoritative guard against concurrent double submissions.
    const { data: pending } = await supabase
      .from('wallet_payment_requests')
      .select('id')
      .eq('tenant_id', req.user.tenantId)
      .eq('status', 'pending')
      .limit(1)
    if (pending?.length) {
      return res.status(409).json({ error: 'A payment request is already awaiting confirmation' })
    }

    const paymentCode = `wallet-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`
    const normalizedScreenshot = `data:${shot.mime};base64,${shot.base64}`

    const { data: created, error: insErr } = await supabase
      .from('wallet_payment_requests')
      .insert({
        tenant_id: req.user.tenantId,
        user_id: req.user.id,
        plan_slug: planSlug,
        billing_period: period,
        amount_egp: amount,
        wallet_type: walletType,
        reference_note: reference,
        screenshot: normalizedScreenshot,
        payment_code: paymentCode,
        status: 'pending',
      })
      .select(SELECT_LIST)
      .single()

    if (insErr) {
      // 23505 = the one-pending-per-tenant unique index fired (race lost).
      if (insErr.code === '23505') {
        return res.status(409).json({ error: 'A payment request is already awaiting confirmation' })
      }
      if (isMissingTableError(insErr)) return res.status(503).json({ error: TABLE_HINT })
      throw insErr
    }

    // Mirror record in tenant_payments — flipped to paid on confirmation.
    const { error: payErr } = await supabase.from('tenant_payments').insert({
      tenant_id: req.user.tenantId,
      amount,
      currency: 'EGP',
      status: 'pending',
      description: paymentCode,
    })
    if (payErr) console.error('[Wallet] pending payment insert error:', payErr.message)

    await logActivity({
      user_id: req.user.id,
      user_name: req.user.full_name || req.user.username,
      action: 'wallet_payment_submitted',
      entity_type: 'subscription_payment',
      entity_id: created.id,
      entity_name: `${planSlug} (${period})`,
      details: { amount, wallet_type: walletType, payment_code: paymentCode },
      tenant_id: req.user.tenantId,
    })

    console.log(`[Wallet] tenant ${req.user.tenantId} submitted ${planSlug}/${period} ${amount} EGP via ${walletType}`)
    res.status(201).json({ request: created })
  } catch (err) {
    console.error('[Wallet] submit error:', err.message)
    res.status(500).json({ error: 'Could not submit the payment request' })
  }
})

// ---------------------------------------------------------------------------
// Super-admin routes — mounted at /api/super-admin/wallet
// ---------------------------------------------------------------------------
walletAdminRouter.use(authenticateToken, requireSuperAdmin)

// List requests (screenshot excluded — fetched per-row via GET /:id).
walletAdminRouter.get('/', async (req, res) => {
  try {
    const status = ['pending', 'confirmed', 'rejected'].includes(req.query.status)
      ? req.query.status
      : 'pending'
    const { data, error } = await supabase
      .from('wallet_payment_requests')
      .select(
        `${SELECT_LIST}, tenant:tenant_id(name), user:user_id(full_name, username)`
      )
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) {
      if (isMissingTableError(error)) return res.json({ requests: [] })
      throw error
    }
    res.json({ requests: data || [] })
  } catch (err) {
    console.error('[Wallet] admin list error:', err.message)
    res.status(500).json({ error: 'Could not load payment requests' })
  }
})

// Full detail including the proof screenshot (admin only).
walletAdminRouter.get('/:id', validId, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('wallet_payment_requests')
      .select(
        `${SELECT_LIST}, screenshot, tenant:tenant_id(name), user:user_id(full_name, username)`
      )
      .eq('id', Number(req.params.id))
      .maybeSingle()
    if (error) {
      if (isMissingTableError(error)) return res.status(404).json({ error: 'Request not found' })
      throw error
    }
    if (!data) return res.status(404).json({ error: 'Request not found' })
    res.json({ request: data })
  } catch (err) {
    console.error('[Wallet] admin detail error:', err.message)
    res.status(500).json({ error: 'Could not load payment request' })
  }
})

// Confirm: claim first (conditional update = idempotent under concurrent
// clicks), activate the plan, then settle the mirrored payment record.
walletAdminRouter.post('/:id/confirm', validId, async (req, res) => {
  const id = Number(req.params.id)
  try {
    const { data: claimed, error: claimErr } = await supabase
      .from('wallet_payment_requests')
      .update({
        status: 'confirmed',
        confirmed_by: req.user.id,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select(SELECT_LIST)
      .maybeSingle()

    if (claimErr) {
      if (isMissingTableError(claimErr)) return res.status(503).json({ error: TABLE_HINT })
      throw claimErr
    }
    if (!claimed) {
      return res.status(409).json({ error: 'This request has already been processed' })
    }

    try {
      // Activation mirrors paymob verify: canonical limits, 30/365-day expiry.
      const limits = planEntitlements(claimed.plan_slug)
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + (claimed.billing_period === 'yearly' ? 365 : 30))

      const { data: currentTenant } = await supabase
        .from('tenants')
        .select('subscription_tier, name')
        .eq('id', claimed.tenant_id)
        .single()

      const { error: updErr } = await supabase
        .from('tenants')
        .update({
          subscription_status: 'active',
          subscription_tier: claimed.plan_slug,
          max_products: limits.max_products,
          max_users: limits.max_users,
          max_orders_monthly: limits.max_orders_monthly,
          subscription_expires_at: expiresAt.toISOString(),
          trial_ends_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', claimed.tenant_id)
      if (updErr) throw updErr

      // Audit steps: failures here must not undo an applied activation —
      // log and continue so the superadmin still gets a success response.
      try {
        await supabase
          .from('tenant_payments')
          .update({ status: 'paid' })
          .eq('description', claimed.payment_code)
          .eq('status', 'pending')
          .limit(1)

        if (currentTenant && claimed.plan_slug !== currentTenant.subscription_tier) {
          await logActivity({
            user_name: 'System',
            action: 'upgraded',
            entity_type: 'subscription',
            entity_id: claimed.tenant_id,
            entity_name: currentTenant.name,
            details: {
              from_tier: currentTenant.subscription_tier,
              to_tier: claimed.plan_slug,
              billing_period: claimed.billing_period,
              source: 'wallet_transfer',
            },
            tenant_id: claimed.tenant_id,
          })
        }

        await logActivity({
          user_id: req.user.id,
          user_name: req.user.full_name || req.user.username,
          action: 'wallet_payment_confirmed',
          entity_type: 'subscription_payment',
          entity_id: claimed.id,
          entity_name: `${claimed.plan_slug} (${claimed.billing_period})`,
          details: { amount: claimed.amount_egp, wallet_type: claimed.wallet_type },
          tenant_id: claimed.tenant_id,
        })
      } catch (auditErr) {
        console.error('[Wallet] confirm audit error:', auditErr.message)
      }

      console.log(`[Wallet] request ${id} confirmed by superadmin ${req.user.id} → tenant ${claimed.tenant_id} = ${claimed.plan_slug}`)
      res.json({ success: true, request: claimed })
    } catch (err) {
      // Activation failed — release the claim so the request can be retried.
      await supabase
        .from('wallet_payment_requests')
        .update({ status: 'pending', confirmed_by: null, confirmed_at: null })
        .eq('id', id)
        .eq('status', 'confirmed')
      console.error('[Wallet] confirm activation error:', err.message)
      res.status(500).json({ error: 'Confirmation failed — nothing was applied, please retry' })
    }
  } catch (err) {
    console.error('[Wallet] confirm error:', err.message)
    res.status(500).json({ error: 'Could not confirm the payment request' })
  }
})

// Reject: conditional pending→rejected, reason required, mirrored placeholder
// payment record removed so it cannot linger as "pending" elsewhere.
walletAdminRouter.post('/:id/reject', validId, async (req, res) => {
  const id = Number(req.params.id)
  try {
    const reason = sanitizeReason(req.body?.reason)
    if (!reason) return res.status(400).json({ error: 'Rejection reason is required' })

    const { data: rejected, error: rejErr } = await supabase
      .from('wallet_payment_requests')
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('id', id)
      .eq('status', 'pending')
      .select(SELECT_LIST)
      .maybeSingle()

    if (rejErr) {
      if (isMissingTableError(rejErr)) return res.status(503).json({ error: TABLE_HINT })
      throw rejErr
    }
    if (!rejected) {
      return res.status(409).json({ error: 'This request has already been processed' })
    }

    try {
      await supabase
        .from('tenant_payments')
        .delete()
        .eq('description', rejected.payment_code)
        .eq('status', 'pending')

      await logActivity({
        user_id: req.user.id,
        user_name: req.user.full_name || req.user.username,
        action: 'wallet_payment_rejected',
        entity_type: 'subscription_payment',
        entity_id: rejected.id,
        entity_name: `${rejected.plan_slug} (${rejected.billing_period})`,
        details: { amount: rejected.amount_egp, wallet_type: rejected.wallet_type, reason },
        tenant_id: rejected.tenant_id,
      })
    } catch (auditErr) {
      console.error('[Wallet] reject audit error:', auditErr.message)
    }

    console.log(`[Wallet] request ${id} rejected by superadmin ${req.user.id}`)
    res.json({ success: true, request: rejected })
  } catch (err) {
    console.error('[Wallet] reject error:', err.message)
    res.status(500).json({ error: 'Could not reject the payment request' })
  }
})
