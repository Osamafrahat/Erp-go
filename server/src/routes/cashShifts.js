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

// Get shift summary stats
router.get('/summary', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('cash_shifts')
      .select('*')
      .eq('tenant_id', req.user?.tenantId)

    if (error) throw error

    const shifts = data || []
    const totalShifts = shifts.length
    const closedShifts = shifts.filter(s => s.status === 'closed')
    const avgVariance = closedShifts.length > 0
      ? closedShifts.reduce((sum, s) => sum + parseFloat(s.variance || 0), 0) / closedShifts.length
      : 0
    const totalProfit = closedShifts.reduce((sum, s) => sum + parseFloat(s.profit || 0), 0)

    res.json({ total_shifts: totalShifts, avg_variance: avgVariance, total_profit: totalProfit })
  } catch (err) {
    next(err)
  }
})

// Get current user's active (open) shift
router.get('/active', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('cash_shifts')
      .select('*, users(full_name)')
      .eq('tenant_id', req.user?.tenantId)
      .eq('user_id', req.user.id)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// Get all shifts
router.get('/', async (req, res, next) => {
  try {
    const { status, user_id, start_date, end_date } = req.query

    let query = supabase
      .from('cash_shifts')
      .select('*, users(full_name)')
      .eq('tenant_id', req.user?.tenantId)
      .order('opened_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (user_id) query = query.eq('user_id', user_id)
    if (start_date) query = query.gte('opened_at', start_date)
    if (end_date) query = query.lte('opened_at', end_date)

    const { data, error } = await query
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

// Open a new shift
router.post('/', [
  body('opening_balance').isFloat({ min: 0 }).withMessage('Opening balance must be a positive number'),
], validate, async (req, res, next) => {
  try {
    const { opening_balance, notes } = req.body

    const { data: active } = await supabase
      .from('cash_shifts')
      .select('id')
      .eq('tenant_id', req.user?.tenantId)
      .eq('user_id', req.user.id)
      .eq('status', 'open')
      .limit(1)
      .maybeSingle()

    if (active) {
      return res.status(400).json({ error: 'You already have an open shift' })
    }

    const { data, error } = await supabase
      .from('cash_shifts')
      .insert({
        tenant_id: req.user?.tenantId,
        user_id: req.user.id,
        opening_balance,
        notes,
        status: 'open',
        opened_at: new Date().toISOString(),
      })
      .select('*, users(full_name)')
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

// Get shift by ID with order summary
router.get('/:id', async (req, res, next) => {
  try {
    const { data: shift, error } = await supabase
      .from('cash_shifts')
      .select('*, users(full_name)')
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .single()

    if (error || !shift) {
      return res.status(404).json({ error: 'Shift not found' })
    }

    let orderSummary = null
    if (shift.status === 'closed' && shift.opened_at && shift.closed_at) {
      const { data: orders } = await supabase
        .from('orders')
        .select('id, total, created_at, payment_method')
        .eq('tenant_id', req.user?.tenantId)
        .gte('created_at', shift.opened_at)
        .lte('created_at', shift.closed_at)

      if (orders) {
        orderSummary = {
          total_orders: orders.length,
          total_revenue: orders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0),
        }
      }
    }

    res.json({ ...shift, order_summary: orderSummary })
  } catch (err) {
    next(err)
  }
})

// Get orders placed during a shift
router.get('/:id/orders', async (req, res, next) => {
  try {
    const { data: shift, error: shiftError } = await supabase
      .from('cash_shifts')
      .select('opened_at, closed_at')
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .single()

    if (shiftError || !shift) {
      return res.status(404).json({ error: 'Shift not found' })
    }

    if (shift.status !== 'closed' || !shift.closed_at) {
      return res.json([])
    }

    const { data: orders, error } = await supabase
      .from('orders')
      .select('*, users(full_name), customers(name), order_items(*)')
      .eq('tenant_id', req.user?.tenantId)
      .gte('created_at', shift.opened_at)
      .lte('created_at', shift.closed_at)
      .order('created_at')

    if (error) throw error
    res.json(orders || [])
  } catch (err) {
    next(err)
  }
})

// Close a shift
router.patch('/:id/close', [
  body('closing_balance').isFloat({ min: 0 }).withMessage('Closing balance must be a positive number'),
  body('actual_cash').isFloat({ min: 0 }).withMessage('Actual cash must be a positive number'),
], validate, async (req, res, next) => {
  try {
    const { closing_balance, actual_cash, notes } = req.body

    const { data: shift, error: fetchError } = await supabase
      .from('cash_shifts')
      .select('*')
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .single()

    if (fetchError || !shift) {
      return res.status(404).json({ error: 'Shift not found' })
    }

    if (shift.status !== 'open') {
      return res.status(400).json({ error: 'Shift is not open' })
    }

    const expected_cash = parseFloat(shift.opening_balance) + parseFloat(closing_balance)
    const variance = parseFloat(actual_cash) - expected_cash

    const { data, error } = await supabase
      .from('cash_shifts')
      .update({
        closing_balance,
        actual_cash,
        variance,
        notes: notes || shift.notes,
        status: 'closed',
        closed_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .select('*, users(full_name)')
      .single()

    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

export default router
