import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import supabase from '../db/supabase.js'

const router = Router()

const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg })
  }
  next()
}

// Get credit sales stats
router.get('/stats', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('credit_sales')
      .select('total_amount, remaining_amount, status')
      .eq('tenant_id', req.user?.tenantId)

    if (error) throw error

    const records = data || []
    const total_pending = records
      .filter(r => r.status === 'pending' || r.status === 'partial')
      .reduce((sum, r) => sum + parseFloat(r.remaining_amount || 0), 0)
    const total_overdue = records
      .filter(r => r.status === 'overdue')
      .reduce((sum, r) => sum + parseFloat(r.remaining_amount || 0), 0)
    const total_collected = records.reduce((sum, r) => sum + parseFloat(r.total_amount || 0) - parseFloat(r.remaining_amount || 0), 0)

    res.json({ total_pending, total_overdue, total_collected })
  } catch (err) {
    next(err)
  }
})

// Get credit sales for a customer
router.get('/customer/:customerId', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('credit_sales')
      .select('*, orders(id, order_number, total, created_at), customers(name)')
      .eq('tenant_id', req.user?.tenantId)
      .eq('customer_id', req.params.customerId)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

// Get all credit sales
router.get('/', async (req, res, next) => {
  try {
    const { status, customer_id } = req.query

    let query = supabase
      .from('credit_sales')
      .select('*, orders(id, order_number, total, created_at), customers(name)')
      .eq('tenant_id', req.user?.tenantId)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (customer_id) query = query.eq('customer_id', customer_id)

    const { data, error } = await query
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

// Create a credit sale
router.post('/', [
  body('order_id').isNumeric().withMessage('Order ID is required'),
  body('customer_id').isNumeric().withMessage('Customer ID is required'),
  body('total_amount').isFloat({ min: 0.01 }).withMessage('Total amount must be positive'),
  body('due_date').isISO8601().withMessage('Due date is required'),
], validate, async (req, res, next) => {
  try {
    const { order_id, customer_id, total_amount, due_date, notes } = req.body

    const { data, error } = await supabase
      .from('credit_sales')
      .insert({
        tenant_id: req.user?.tenantId,
        order_id,
        customer_id,
        total_amount,
        remaining_amount: total_amount,
        due_date,
        notes,
        status: 'pending',
        paid_amount: 0,
        created_at: new Date().toISOString(),
      })
      .select('*, orders(id, order_number, total, created_at), customers(name)')
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

// Record a payment on a credit sale
router.post('/:id/pay', [
  body('amount').isFloat({ min: 0.01 }).withMessage('Payment amount must be positive'),
], validate, async (req, res, next) => {
  try {
    const { amount, payment_method, reference } = req.body

    const { data: creditSale, error: fetchError } = await supabase
      .from('credit_sales')
      .select('*')
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .single()

    if (fetchError || !creditSale) {
      return res.status(404).json({ error: 'Credit sale not found' })
    }

    const newPaidAmount = parseFloat(creditSale.paid_amount || 0) + parseFloat(amount)
    const newRemainingAmount = parseFloat(creditSale.total_amount) - newPaidAmount
    const newStatus = newRemainingAmount <= 0 ? 'paid' : 'partial'

    // Log payment to credit_payments table
    await supabase
      .from('credit_payments')
      .insert({
        tenant_id: req.user?.tenantId,
        credit_sale_id: creditSale.id,
        amount: parseFloat(amount),
        payment_method: payment_method || 'cash',
        reference: reference || null,
        notes: null,
        created_at: new Date().toISOString(),
      })

    const { data, error } = await supabase
      .from('credit_sales')
      .update({
        paid_amount: newPaidAmount,
        remaining_amount: Math.max(0, newRemainingAmount),
        status: newStatus,
      })
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .select('*, orders(id, order_number, total, created_at), customers(name)')
      .single()

    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// Update credit sale
router.patch('/:id', async (req, res, next) => {
  try {
    const { status, due_date, notes } = req.body

    const { data, error } = await supabase
      .from('credit_sales')
      .update({ status, due_date, notes })
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .select('*, orders(id, order_number, total, created_at), customers(name)')
      .single()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Credit sale not found' })
    }
    res.json(data)
  } catch (err) {
    next(err)
  }
})

export default router
