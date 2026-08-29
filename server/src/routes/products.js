import { Router } from 'express'
import { body, param, validationResult } from 'express-validator'
import supabase from '../db/supabase.js'
import { authenticateToken, requirePermission } from '../middleware/auth.js'
import { checkTenantLimits } from '../middleware/limits.js'
import { sanitizeSearch } from '../helpers/search.js'

const router = Router()

const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg })
  }
  next()
}

// Get all products
router.get('/', async (req, res, next) => {
  try {
    const { category_id, is_active, search, page = 1, limit = 100 } = req.query
    const offset = (page - 1) * limit

    let query = supabase.from('products').select('*, suppliers(name)', { count: 'exact' })

    if (category_id) {
      query = query.eq('category_id', category_id)
    }
    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true')
    }
    if (search) {
      const s = sanitizeSearch(search)
      if (s) query = query.or(`name.ilike.%${s}%,sku.ilike.%${s}%,barcode.ilike.%${s}%`)
    }

    query = query.order('name').range(offset, offset + parseInt(limit) - 1)

    const { data, error, count } = await query
    if (error) throw error

    res.json({ data, total: count, page: parseInt(page), limit: parseInt(limit) })
  } catch (err) {
    next(err)
  }
})

// Get product by ID
router.get('/:id', [
  param('id').isNumeric().withMessage('Invalid product ID'),
], validate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Product not found' })
    }

    res.json(data)
  } catch (err) {
    next(err)
  }
})

// Get product by barcode
router.get('/barcode/:barcode', [
  param('barcode').trim().notEmpty().withMessage('Barcode is required'),
], validate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('barcode', req.params.barcode)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Product not found' })
    }

    res.json(data)
  } catch (err) {
    next(err)
  }
})

// Create product
router.post('/', authenticateToken, requirePermission('inventory_edit'), checkTenantLimits('products'), [
  body('name').trim().notEmpty().withMessage('Product name is required')
    .isLength({ max: 255 }).withMessage('Name too long'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('sku').optional().trim().isLength({ max: 50 }),
  body('barcode').optional().trim().isLength({ max: 100 }),
  body('stock_quantity').optional().isFloat({ min: 0 }).withMessage('Stock must be non-negative'),
  body('low_stock_threshold').optional().isInt({ min: 0 }),
  body('cost_price').optional().isFloat({ min: 0 }),
], validate, async (req, res, next) => {
  try {
    const { name, sku, barcode, category_id, supplier_id, price, cost_price,
            stock_quantity, low_stock_threshold, is_refundable, unit_of_measure, image_url, description } = req.body

    // Check for duplicate SKU
    if (sku) {
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('sku', sku)
        .single()
      if (existing) {
        return res.status(409).json({ error: 'SKU already exists' })
      }
    }

    // Check for duplicate barcode
    if (barcode) {
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('barcode', barcode)
        .single()
      if (existing) {
        return res.status(409).json({ error: 'Barcode already exists' })
      }
    }

    // Validate cost price vs selling price
    if (cost_price !== undefined && cost_price !== null && parseFloat(cost_price) > parseFloat(price)) {
      return res.status(400).json({ error: 'Cost price cannot exceed selling price' })
    }

    const { data, error } = await supabase
      .from('products')
      .insert({
        name,
        sku: sku || null,
        barcode: barcode || null,
        category_id: category_id || null,
        supplier_id: supplier_id || null,
        price,
        cost_price: cost_price || 0,
        stock_quantity: stock_quantity || 0,
        low_stock_threshold: low_stock_threshold || 10,
        is_refundable: is_refundable !== false,
        unit_of_measure: unit_of_measure || 'quantity',
        image_url: image_url || null,
        description: description || null
      })
      .select()
      .single()

    if (error) throw error
    req.logActivity({ action: 'created', entity_type: 'product', entity_name: data.name })

    // Auto-post journal if initial stock
    if (data.stock_quantity > 0 && data.cost_price > 0) {
      try {
        const { postStockReceiveJournal } = await import('../services/accountingEngine.js')
        const movement = { id: data.id, quantity: data.stock_quantity }
        let supplierInfo = null
        if (data.supplier_id) {
          const { data: supp } = await supabase.from('suppliers').select('id, name, account_code').eq('id', data.supplier_id).single()
          supplierInfo = supp
        }
        await postStockReceiveJournal(movement, { name: data.name, cost_price: data.cost_price }, supplierInfo)
      } catch (accErr) {
        console.error('Accounting auto-post (product create) failed:', accErr.message)
      }
    }

    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

// Update product
router.put('/:id', authenticateToken, requirePermission('inventory_edit'), [
  param('id').isNumeric().withMessage('Invalid product ID'),
  body('name').optional().trim().notEmpty().isLength({ max: 255 }),
  body('price').optional().isFloat({ min: 0 }),
  body('stock_quantity').optional().isInt({ min: 0 }),
], validate, async (req, res, next) => {
  try {
    // Check if product exists
    const { data: existing } = await supabase
      .from('products')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (!existing) {
      return res.status(404).json({ error: 'Product not found' })
    }

    const { name, sku, barcode, category_id, supplier_id, price, cost_price,
            stock_quantity, low_stock_threshold, is_refundable, unit_of_measure, image_url, description, is_active } = req.body

    // Check for duplicate SKU (excluding current product)
    if (sku && sku !== existing.sku) {
      const { data: dupSku } = await supabase
        .from('products')
        .select('id')
        .eq('sku', sku)
        .neq('id', req.params.id)
        .single()
      if (dupSku) {
        return res.status(409).json({ error: 'SKU already exists' })
      }
    }

    // Check for duplicate barcode (excluding current product)
    if (barcode && barcode !== existing.barcode) {
      const { data: dupBarcode } = await supabase
        .from('products')
        .select('id')
        .eq('barcode', barcode)
        .neq('id', req.params.id)
        .single()
      if (dupBarcode) {
        return res.status(409).json({ error: 'Barcode already exists' })
      }
    }

    // Validate cost price vs selling price
    const finalPrice = price !== undefined ? parseFloat(price) : parseFloat(existing.price)
    const finalCost = cost_price !== undefined && cost_price !== null ? parseFloat(cost_price) : (existing.cost_price !== null ? parseFloat(existing.cost_price) : null)
    if (finalCost !== null && finalCost > finalPrice) {
      return res.status(400).json({ error: 'Cost price cannot exceed selling price' })
    }

    const { data, error } = await supabase
      .from('products')
      .update({
        name: name ?? existing.name,
        sku: sku ?? existing.sku,
        barcode: barcode ?? existing.barcode,
        category_id: category_id ?? existing.category_id,
        supplier_id: supplier_id !== undefined ? (supplier_id || null) : existing.supplier_id,
        price: price ?? existing.price,
        cost_price: cost_price ?? existing.cost_price,
        stock_quantity: stock_quantity ?? existing.stock_quantity,
        low_stock_threshold: low_stock_threshold ?? existing.low_stock_threshold,
        is_refundable: is_refundable ?? existing.is_refundable,
        unit_of_measure: unit_of_measure ?? existing.unit_of_measure,
        image_url: image_url ?? existing.image_url,
        description: description ?? existing.description,
        is_active: is_active ?? existing.is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    req.logActivity({ action: 'updated', entity_type: 'product', entity_id: req.params.id, entity_name: data.name })

    // Auto-post journal if stock changed
    const stockDiff = data.stock_quantity - existing.stock_quantity
    if (stockDiff !== 0 && data.cost_price > 0) {
      try {
        const { postStockReceiveJournal, postStockAdjustJournal } = await import('../services/accountingEngine.js')
        const movement = { id: data.id, quantity: Math.abs(stockDiff) }
        let supplierInfo = null
        if (data.supplier_id) {
          const { data: supp } = await supabase.from('suppliers').select('id, name, account_code').eq('id', data.supplier_id).single()
          supplierInfo = supp
        }
        if (stockDiff > 0) {
          await postStockReceiveJournal(movement, { name: data.name, cost_price: data.cost_price }, supplierInfo)
        } else {
          await postStockAdjustJournal({ ...movement, quantity: -Math.abs(stockDiff) }, { name: data.name, cost_price: data.cost_price })
        }
      } catch (accErr) {
        console.error('Accounting auto-post (product update) failed:', accErr.message)
      }
    }

    res.json(data)
  } catch (err) {
    next(err)
  }
})

// Delete product
router.delete('/:id', authenticateToken, requirePermission('inventory_edit'), [
  param('id').isNumeric().withMessage('Invalid product ID'),
], validate, async (req, res, next) => {
  try {
    const { data: existing } = await supabase
      .from('products')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (!existing) {
      return res.status(404).json({ error: 'Product not found' })
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error
    req.logActivity({ action: 'deleted', entity_type: 'product', entity_id: req.params.id })

    // Auto-post journal: reverse inventory value
    if (existing.stock_quantity > 0 && existing.cost_price > 0) {
      try {
        const { postStockAdjustJournal } = await import('../services/accountingEngine.js')
        const movement = { id: existing.id, quantity: -existing.stock_quantity }
        await postStockAdjustJournal(movement, { name: existing.name, cost_price: existing.cost_price })
      } catch (accErr) {
        console.error('Accounting auto-post (product delete) failed:', accErr.message)
      }
    }

    res.json({ message: 'Product deleted successfully' })
  } catch (err) {
    next(err)
  }
})

export default router
