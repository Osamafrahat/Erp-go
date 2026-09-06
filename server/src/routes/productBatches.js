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

// Get batches expiring within 30 days
router.get('/expiring', async (req, res, next) => {
  try {
    const now = new Date()
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('product_batches')
      .select('*, products(name, sku)')
      .eq('tenant_id', req.user?.tenantId)
      .gte('expiry_date', now.toISOString().split('T')[0])
      .lte('expiry_date', thirtyDays)
      .order('expiry_date')

    if (error) throw error
    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

// Get expired batches
router.get('/expired', async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('product_batches')
      .select('*, products(name, sku)')
      .eq('tenant_id', req.user?.tenantId)
      .lt('expiry_date', today)
      .order('expiry_date', { ascending: false })

    if (error) throw error
    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

// Get all batches
router.get('/', async (req, res, next) => {
  try {
    const { product_id, expiry_before, expiry_after } = req.query

    let query = supabase
      .from('product_batches')
      .select('*, products(name, sku)')
      .eq('tenant_id', req.user?.tenantId)
      .order('expiry_date')

    if (product_id) query = query.eq('product_id', product_id)
    if (expiry_before) query = query.lte('expiry_date', expiry_before)
    if (expiry_after) query = query.gte('expiry_date', expiry_after)

    const { data, error } = await query
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

// Create a product batch
router.post('/', [
  body('product_id').isNumeric().withMessage('Product ID is required'),
  body('batch_number').trim().notEmpty().withMessage('Batch number is required'),
  body('expiry_date').isISO8601().withMessage('Expiry date is required'),
  body('quantity').isFloat({ min: 0.01 }).withMessage('Quantity must be positive'),
], validate, async (req, res, next) => {
  try {
    const { product_id, variant_id, batch_number, expiry_date, quantity, cost_price } = req.body

    const { data, error } = await supabase
      .from('product_batches')
      .insert({
        tenant_id: req.user?.tenantId,
        product_id,
        variant_id: variant_id || null,
        batch_number,
        expiry_date,
        quantity,
        cost_price,
        created_at: new Date().toISOString(),
      })
      .select('*, products(name, sku)')
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

// Update a product batch
router.put('/:id', async (req, res, next) => {
  try {
    const { variant_id, batch_number, expiry_date, quantity, cost_price } = req.body

    const { data, error } = await supabase
      .from('product_batches')
      .update({ variant_id, batch_number, expiry_date, quantity, cost_price })
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .select('*, products(name, sku)')
      .single()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Batch not found' })
    }
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// Delete a product batch
router.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('product_batches')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)

    if (error) throw error
    res.json({ message: 'Batch deleted' })
  } catch (err) {
    next(err)
  }
})

export default router
