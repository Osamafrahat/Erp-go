import { Router } from 'express'
import { param, body, validationResult } from 'express-validator'
import supabase from '../db/supabase.js'

const router = Router()

const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg })
  }
  next()
}

// Get variants for a product
router.get('/product/:productId', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('product_variants')
      .select('*')
      .eq('tenant_id', req.user?.tenantId)
      .eq('product_id', req.params.productId)
      .order('name')

    if (error) throw error
    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

// Create a product variant
router.post('/', [
  body('product_id').isNumeric().withMessage('Product ID is required'),
  body('name').trim().notEmpty().withMessage('Variant name is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
], validate, async (req, res, next) => {
  try {
    const { product_id, name, sku, barcode, price, cost_price, stock_quantity, attributes } = req.body

    const { data, error } = await supabase
      .from('product_variants')
      .insert({
        tenant_id: req.user?.tenantId,
        product_id,
        name,
        sku,
        barcode,
        price,
        cost_price,
        stock_quantity: stock_quantity || 0,
        attributes,
      })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

// Update a product variant
router.put('/:id', [
  param('id').isNumeric().withMessage('Invalid variant ID'),
], validate, async (req, res, next) => {
  try {
    const { name, sku, barcode, price, cost_price, stock_quantity, attributes } = req.body

    const { data, error } = await supabase
      .from('product_variants')
      .update({ name, sku, barcode, price, cost_price, stock_quantity, attributes })
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .select()
      .single()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Variant not found' })
    }
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// Delete a product variant
router.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('product_variants')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)

    if (error) throw error
    res.json({ message: 'Variant deleted' })
  } catch (err) {
    next(err)
  }
})

// Adjust stock for a variant
router.patch('/:id/stock', [
  body('adjustment').isNumeric().withMessage('Adjustment must be a number'),
], validate, async (req, res, next) => {
  try {
    const { adjustment, reason } = req.body

    const { data: variant, error: fetchError } = await supabase
      .from('product_variants')
      .select('stock_quantity')
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .single()

    if (fetchError || !variant) {
      return res.status(404).json({ error: 'Variant not found' })
    }

    const newQuantity = parseFloat(variant.stock_quantity) + parseFloat(adjustment)
    if (newQuantity < 0) {
      return res.status(400).json({ error: 'Insufficient stock' })
    }

    const { data, error } = await supabase
      .from('product_variants')
      .update({ stock_quantity: newQuantity })
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

export default router
