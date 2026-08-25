import { Router } from 'express'
import { body, param, validationResult } from 'express-validator'
import supabase from '../db/supabase.js'
import { authenticateToken, requirePermission } from '../middleware/auth.js'
import { postSubscriptionPaymentJournal } from '../services/accountingEngine.js'

const router = Router()

const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg })
  }
  next()
}

// Get all subscription payments (for invoices page)
router.get('/payments/all', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('subscription_payments')
      .select('*, subscription:subscriptions(id, customer_id, plan_id, status, customer:customers(id, name), plan:service_plans(id, name, billing_cycle))')
      .eq('tenant_id', req.user?.tenantId)
      .order('payment_date', { ascending: false })
      .limit(500)
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get all subscriptions with joins
router.get('/', async (req, res) => {
  try {
    const { status, customer_id } = req.query
    let query = supabase
      .from('subscriptions')
      .select('*, customer:customers(id, name, phone), service:services(id, name, name_ar, service_type), plan:service_plans(id, name, name_ar, billing_cycle)')
      .eq('tenant_id', req.user?.tenantId)
      .order('created_at', { ascending: false })
    if (status) query = query.eq('status', status)
    if (customer_id) query = query.eq('customer_id', customer_id)
    const { data, error } = await query
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get subscription payment history
router.get('/:id/payments', [
  param('id').isNumeric().withMessage('Invalid subscription ID'),
], validate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('subscription_payments')
      .select('*')
      .eq('tenant_id', req.user?.tenantId)
      .eq('subscription_id', req.params.id)
      .order('payment_date', { ascending: false })
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get single subscription
router.get('/:id', [
  param('id').isNumeric().withMessage('Invalid subscription ID'),
], validate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*, customer:customers(id, name, phone), service:services(id, name, name_ar), plan:service_plans(id, name, name_ar, billing_cycle)')
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .single()
    if (error || !data) return res.status(404).json({ error: 'Subscription not found' })
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Create subscription
router.post('/', authenticateToken, requirePermission('services_edit'), [
  body('customer_id').isNumeric().withMessage('Customer is required'),
  body('start_date').isISO8601().withMessage('Start date is required'),
  body('billing_amount').isFloat({ min: 0 }).withMessage('Billing amount must be positive'),
], validate, async (req, res) => {
  try {
    const { customer_id, service_id, plan_id, start_date, end_date, next_billing_date, auto_renew, billing_amount, notes } = req.body

    const insertData = {
      tenant_id: req.user?.tenantId,
      customer_id,
      service_id: service_id || null,
      plan_id: plan_id || null,
      start_date,
      end_date: end_date || null,
      next_billing_date: next_billing_date || null,
      auto_renew: auto_renew !== false,
      billing_amount,
      notes,
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .insert(insertData)
      .select('*, customer:customers(id, name, phone), service:services(id, name, name_ar), plan:service_plans(id, name, name_ar, billing_cycle)')
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Update subscription
router.put('/:id', authenticateToken, requirePermission('services_edit'), [
  param('id').isNumeric().withMessage('Invalid subscription ID'),
], validate, async (req, res) => {
  try {
    const { customer_id, service_id, plan_id, start_date, end_date, next_billing_date, auto_renew, billing_amount, notes } = req.body
    const updateData = { updated_at: new Date().toISOString() }
    if (customer_id !== undefined) updateData.customer_id = customer_id
    if (service_id !== undefined) updateData.service_id = service_id
    if (plan_id !== undefined) updateData.plan_id = plan_id
    if (start_date !== undefined) updateData.start_date = start_date
    if (end_date !== undefined) updateData.end_date = end_date
    if (next_billing_date !== undefined) updateData.next_billing_date = next_billing_date
    if (auto_renew !== undefined) updateData.auto_renew = auto_renew
    if (billing_amount !== undefined) updateData.billing_amount = billing_amount
    if (notes !== undefined) updateData.notes = notes

    const { data, error } = await supabase
      .from('subscriptions')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .select('*, customer:customers(id, name, phone), service:services(id, name, name_ar), plan:service_plans(id, name, name_ar, billing_cycle)')
      .single()
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Cancel subscription
router.patch('/:id/cancel', authenticateToken, requirePermission('services_edit'), [
  param('id').isNumeric().withMessage('Invalid subscription ID'),
], validate, async (req, res) => {
  try {
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .single()
    if (!existing) return res.status(404).json({ error: 'Subscription not found' })
    if (existing.status === 'cancelled') return res.status(400).json({ error: 'Subscription is already cancelled' })

    const { data, error } = await supabase
      .from('subscriptions')
      .update({ status: 'cancelled', auto_renew: false, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .select()
      .single()
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Renew subscription
router.patch('/:id/renew', authenticateToken, requirePermission('services_edit'), [
  param('id').isNumeric().withMessage('Invalid subscription ID'),
], validate, async (req, res) => {
  try {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*, plan:service_plans(billing_cycle, duration_months)')
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .single()
    if (!sub) return res.status(404).json({ error: 'Subscription not found' })
    if (sub.status === 'cancelled') return res.status(400).json({ error: 'Cannot renew a cancelled subscription' })

    const today = new Date()
    let newEndDate = new Date(today)
    const cycle = sub.plan?.billing_cycle || 'monthly'
    const duration = sub.plan?.duration_months || 1

    if (cycle === 'annual') {
      newEndDate.setMonth(newEndDate.getMonth() + (duration * 12))
    } else if (cycle === 'monthly') {
      newEndDate.setMonth(newEndDate.getMonth() + duration)
    } else if (cycle === 'weekly') {
      newEndDate.setDate(newEndDate.getDate() + (duration * 7))
    } else {
      newEndDate.setMonth(newEndDate.getMonth() + duration)
    }

    let nextBilling = null
    if (cycle === 'monthly') {
      nextBilling = new Date(newEndDate)
    } else if (cycle === 'annual') {
      nextBilling = new Date(newEndDate)
    } else if (cycle === 'weekly') {
      nextBilling = new Date(newEndDate)
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        start_date: today.toISOString().split('T')[0],
        end_date: newEndDate.toISOString().split('T')[0],
        next_billing_date: nextBilling ? nextBilling.toISOString().split('T')[0] : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .select()
      .single()
    if (error) throw error

    // Record the renewal payment
    const { data: renewalPayment } = await supabase
      .from('subscription_payments')
      .insert({
        tenant_id: req.user?.tenantId,
        subscription_id: req.params.id,
        amount: sub.billing_amount,
        payment_method: 'cash',
        notes: 'Renewal payment',
      })
      .select()
      .single()

    // Create journal entry for renewal payment
    if (renewalPayment) {
      try {
        await postSubscriptionPaymentJournal(renewalPayment, data, sub.plan)
      } catch (journalErr) {
        console.error('Failed to create renewal journal entry:', journalErr.message)
      }
    }

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Record payment for subscription
router.post('/:id/payments', authenticateToken, requirePermission('services_edit'), [
  param('id').isNumeric().withMessage('Invalid subscription ID'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive'),
], validate, async (req, res) => {
  try {
    const { amount, payment_method, notes } = req.body

    // Get subscription and plan details for journal entry
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*, plan:service_plans(id, name, price)')
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .single()

    const { data, error } = await supabase
      .from('subscription_payments')
      .insert({
        tenant_id: req.user?.tenantId,
        subscription_id: req.params.id,
        amount,
        payment_method: payment_method || 'cash',
        notes,
      })
      .select()
      .single()
    if (error) throw error

    // Create journal entry
    if (data && sub) {
      try {
        await postSubscriptionPaymentJournal(data, sub, sub.plan)
      } catch (journalErr) {
        console.error('Failed to create subscription journal entry:', journalErr.message)
      }
    }

    res.status(201).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Delete subscription
router.delete('/:id', authenticateToken, requirePermission('services_edit'), [
  param('id').isNumeric().withMessage('Invalid subscription ID'),
], validate, async (req, res) => {
  try {
    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Quick subscription from POS (creates subscription + records payment)
router.post('/quick', authenticateToken, requirePermission('services_edit'), [
  body('customer_id').isNumeric().withMessage('Customer is required'),
  body('plan_id').isNumeric().withMessage('Plan is required'),
  body('payment_method').optional().isIn(['cash', 'card', 'bank']),
], validate, async (req, res) => {
  try {
    const { customer_id, plan_id, payment_method, notes } = req.body
    const today = new Date().toISOString().split('T')[0]

    // Get plan details for billing amount and duration
    const { data: plan, error: planError } = await supabase
      .from('service_plans')
      .select('*')
      .eq('id', plan_id)
      .eq('tenant_id', req.user?.tenantId)
      .single()
    if (planError || !plan) return res.status(404).json({ error: 'Plan not found' })

    // Check if customer already has an active subscription for this plan
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id, status')
      .eq('tenant_id', req.user?.tenantId)
      .eq('customer_id', customer_id)
      .eq('plan_id', plan_id)
      .in('status', ['active', 'past_due'])
      .single()

    if (existingSub) {
      return res.status(409).json({ 
        error: 'Customer already has an active subscription for this plan',
        existing_subscription_id: existingSub.id
      })
    }

    // Calculate end date based on plan duration
    const startDate = new Date(today)
    let endDate = new Date(startDate)
    const duration = plan.duration_months || 1
    if (plan.billing_cycle === 'annual') {
      endDate.setMonth(endDate.getMonth() + (duration * 12))
    } else if (plan.billing_cycle === 'weekly') {
      endDate.setDate(endDate.getDate() + (duration * 7))
    } else {
      endDate.setMonth(endDate.getMonth() + duration)
    }

    const insertData = {
      tenant_id: req.user?.tenantId,
      customer_id,
      service_id: null,
      plan_id,
      start_date: today,
      end_date: endDate.toISOString().split('T')[0],
      next_billing_date: endDate.toISOString().split('T')[0],
      auto_renew: false,
      billing_amount: plan.price,
      notes: notes || 'POS sale',
    }

    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .insert(insertData)
      .select('*, customer:customers(id, name, phone), plan:service_plans(id, name, name_ar, billing_cycle, price)')
      .single()
    if (subError) throw subError

    // Record payment
    const { data: paymentData, error: payError } = await supabase
      .from('subscription_payments')
      .insert({
        tenant_id: req.user?.tenantId,
        subscription_id: sub.id,
        amount: plan.price,
        payment_method: payment_method || 'cash',
        notes: 'POS payment',
      })
      .select()
      .single()
    if (payError) console.error('Failed to record payment:', payError.message)

    // Create journal entry for subscription payment
    if (paymentData) {
      try {
        await postSubscriptionPaymentJournal(paymentData, sub, plan)
      } catch (journalErr) {
        console.error('Failed to create subscription journal entry:', journalErr.message)
      }
    }

    res.status(201).json(sub)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
