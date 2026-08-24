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

// Get stock movements
router.get('/movements', async (req, res, next) => {
  try {
    const { product_id, limit = 100 } = req.query

    let query = supabase
      .from('stock_movements')
      .select('*, products(name)')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))

    if (product_id) {
      query = query.eq('product_id', product_id)
    }

    const { data, error } = await query
    if (error) throw error

    res.json(data)
  } catch (err) {
    next(err)
  }
})

// Receive stock
router.post('/receive', [
  body('product_id').notEmpty().withMessage('Product ID is required'),
  body('quantity').isFloat({ min: 0.01 }).withMessage('Quantity must be at least 0.01'),
], validate, async (req, res, next) => {
  try {
    const { product_id, quantity, notes, supplier_id, cost_price } = req.body
    const pid = parseInt(product_id)
    const qty = parseFloat(quantity)
    const newSupplierId = supplier_id ? parseInt(supplier_id) : null
    const newCostPrice = cost_price !== undefined ? parseFloat(cost_price) : null

    // Get current product
    const { data: product } = await supabase
      .from('products')
      .select('stock_quantity, cost_price, name, sku, barcode, supplier_id, category_id, price, low_stock_threshold, image_url, description')
      .eq('id', pid)
      .single()

    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    // Determine which product to receive into
    let targetProduct = product
    let targetProductId = pid
    const currentSupplierId = product.supplier_id ? parseInt(product.supplier_id) : null
    const supplierChanged = newSupplierId && newSupplierId !== currentSupplierId

    if (supplierChanged) {
      // Check if a product with same name + supplier already exists
      const { data: existingDup } = await supabase
        .from('products')
        .select('id, stock_quantity, cost_price')
        .eq('name', product.name)
        .eq('supplier_id', newSupplierId)
        .maybeSingle()

      if (existingDup) {
        // Product for this supplier already exists — receive into it
        targetProductId = existingDup.id
        targetProduct = { ...product, stock_quantity: existingDup.stock_quantity, cost_price: existingDup.cost_price || product.cost_price }
      } else {
        // Duplicate product for new supplier — generate unique barcode
        const newBarcode = `SUP${newSupplierId}-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
        const { data: newProduct, error: dupError } = await supabase
          .from('products')
          .insert({
            name: product.name,
            sku: product.sku ? `${product.sku}-S${newSupplierId}` : null,
            barcode: newBarcode,
            category_id: product.category_id,
            supplier_id: newSupplierId,
            price: product.price,
            cost_price: newCostPrice || product.cost_price,
            stock_quantity: 0,
            low_stock_threshold: product.low_stock_threshold,
            image_url: product.image_url,
            description: product.description,
          })
          .select()
          .single()

        if (dupError) throw dupError
        targetProductId = newProduct.id
        targetProduct = { ...product, stock_quantity: 0, cost_price: newCostPrice || product.cost_price }
      }
    }

    // Use provided cost_price or product's existing cost
    const unitCost = newCostPrice !== null ? newCostPrice : (targetProduct.cost_price || 0)

    // Update stock
    const { error: updateError } = await supabase
      .from('products')
      .update({
        stock_quantity: (targetProduct.stock_quantity || 0) + qty,
        cost_price: newCostPrice !== null ? newCostPrice : targetProduct.cost_price,
        updated_at: new Date().toISOString()
      })
      .eq('id', targetProductId)

    if (updateError) throw updateError

    // Record movement
    const { data, error } = await supabase
      .from('stock_movements')
      .insert({
        product_id: targetProductId,
        type: 'receive',
        quantity: qty,
        notes: notes || 'Stock received'
      })
      .select()
      .single()

    if (error) throw error

    // Auto-post to accounting journal
    if (unitCost > 0) {
      try {
        const { postStockReceiveJournal } = await import('../services/accountingEngine.js')
        // Fetch supplier info for per-supplier AP
        let supplierInfo = null
        const effectiveSupplierId = newSupplierId || currentSupplierId
        if (effectiveSupplierId) {
          const { data: supp } = await supabase
            .from('suppliers')
            .select('id, name, account_code')
            .eq('id', effectiveSupplierId)
            .single()
          supplierInfo = supp
        }
        await postStockReceiveJournal(
          data,
          { name: product.name, cost_price: unitCost },
          supplierInfo
        )
      } catch (accErr) {
        console.error('Accounting auto-post failed:', accErr.message)
      }
    }

    res.status(201).json({
      ...data,
      duplicated: supplierChanged,
      target_product_id: targetProductId,
    })
  } catch (err) {
    next(err)
  }
})

// Adjust stock
router.post('/adjust', [
  body('product_id').notEmpty().withMessage('Product ID is required'),
  body('quantity').isInt().withMessage('Quantity is required'),
], validate, async (req, res, next) => {
  try {
    const { product_id, quantity, notes } = req.body
    const pid = parseInt(product_id)

    // Get current stock
    const { data: product } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', pid)
      .single()

    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    const newQuantity = Math.max(0, product.stock_quantity + quantity)

    // Update stock
    const { error: updateError } = await supabase
      .from('products')
      .update({
        stock_quantity: newQuantity,
        updated_at: new Date().toISOString()
      })
      .eq('id', pid)

    if (updateError) throw updateError

    // Record movement
    const { data, error } = await supabase
      .from('stock_movements')
      .insert({
        product_id: pid,
        type: 'adjust',
        quantity,
        notes: notes || 'Stock adjusted'
      })
      .select()
      .single()

    if (error) throw error

    // Auto-post to accounting journal
    try {
      const { postStockAdjustJournal } = await import('../services/accountingEngine.js')
      const { data: productFull } = await supabase.from('products').select('name, cost_price').eq('id', product_id).single()
      if (productFull) await postStockAdjustJournal(data, productFull)
    } catch (accErr) {
      console.error('Accounting auto-post failed:', accErr.message)
    }

    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

export default router
