import { Router } from 'express'
import { body, param, validationResult } from 'express-validator'
import supabase from '../db/supabase.js'
import { authenticateToken, requirePermission } from '../middleware/auth.js'

const router = Router()

const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg })
  }
  next()
}

// Get all promotions
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// Validate promo code
router.post('/validate', [
  body('code').trim().notEmpty().withMessage('Promo code is required'),
  body('orderAmount').isFloat({ min: 0 }).withMessage('Order amount is required'),
], validate, async (req, res, next) => {
  try {
    const { code, orderAmount } = req.body

    const { data: promo, error } = await supabase
      .from('promotions')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single()

    if (error || !promo) {
      return res.status(404).json({ error: 'Invalid promo code' })
    }

    // Check if expired
    if (promo.end_date && new Date(promo.end_date) < new Date()) {
      return res.status(400).json({ error: 'Promo code has expired' })
    }

    // Check usage limit
    if (promo.max_uses && promo.used_count >= promo.max_uses) {
      return res.status(400).json({ error: 'Promo code usage limit reached' })
    }

    // Check minimum order amount
    if (promo.min_order_amount && orderAmount < promo.min_order_amount) {
      return res.status(400).json({ error: `Minimum order amount is ${promo.min_order_amount}` })
    }

    res.json(promo)
  } catch (err) {
    next(err)
  }
})

// Create promotion
router.post('/', authenticateToken, requirePermission('promotions_edit'), [
  body('code').trim().notEmpty().withMessage('Promo code is required'),
  body('type').isIn(['percentage', 'fixed']).withMessage('Type must be percentage or fixed'),
  body('value').isFloat({ min: 0 }).withMessage('Value must be a positive number'),
], validate, async (req, res, next) => {
  try {
    const { code, type, value, min_order_amount, max_uses, start_date, end_date, is_active } = req.body

    // Check if code exists
    const { data: existing } = await supabase
      .from('promotions')
      .select('id')
      .eq('code', code.toUpperCase())
      .single()

    if (existing) {
      return res.status(409).json({ error: 'Promo code already exists' })
    }

    const { data, error } = await supabase
      .from('promotions')
      .insert({
        code: code.toUpperCase(),
        type,
        value,
        min_order_amount: min_order_amount || null,
        max_uses: max_uses || null,
        start_date: start_date || null,
        end_date: end_date || null,
        is_active: is_active !== false
      })
      .select()
      .single()

    if (error) throw error
    req.logActivity({ action: 'created', entity_type: 'promotion', entity_name: data.code })
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

// Update promotion
router.put('/:id', authenticateToken, requirePermission('promotions_edit'), [
  param('id').isNumeric().withMessage('Invalid promotion ID'),
], validate, async (req, res, next) => {
  try {
    const { code, type, value, min_order_amount, max_uses, start_date, end_date, is_active } = req.body

    const updateData = {}
    if (code !== undefined) updateData.code = code.toUpperCase()
    if (type !== undefined) updateData.type = type
    if (value !== undefined) updateData.value = value
    if (min_order_amount !== undefined) updateData.min_order_amount = min_order_amount
    if (max_uses !== undefined) updateData.max_uses = max_uses
    if (start_date !== undefined) updateData.start_date = start_date
    if (end_date !== undefined) updateData.end_date = end_date
    if (is_active !== undefined) updateData.is_active = is_active

    const { data, error } = await supabase
      .from('promotions')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    req.logActivity({ action: 'updated', entity_type: 'promotion', entity_id: req.params.id })
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// Delete promotion
router.delete('/:id', authenticateToken, requirePermission('promotions_edit'), [
  param('id').isNumeric().withMessage('Invalid promotion ID'),
], validate, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('promotions')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error
    req.logActivity({ action: 'deleted', entity_type: 'promotion', entity_id: req.params.id })
    res.json({ message: 'Promotion deleted successfully' })
  } catch (err) {
    next(err)
  }
})

export default router
