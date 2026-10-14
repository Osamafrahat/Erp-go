import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import supabase from '../db/supabase.js'
import { requireManager } from '../middleware/auth.js'
import { adjustStock } from '../services/branchStock.js'
import { validateTransferInput, executeTransfer, fetchTransfer, listTransfers } from '../services/transfers.js'

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
      .eq('tenant_id', req.user?.tenantId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))

    if (product_id) {
      query = query.eq('product_id', product_id)
    }
    if (req.branchId) {
      query = query.eq('branch_id', req.branchId)
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
    const tid = req.user?.tenantId

    // Get current product
    const { data: product } = await supabase
      .from('products')
      .select('stock_quantity, cost_price, name, sku, barcode, supplier_id, category_id, price, low_stock_threshold, image_url, specifications')
      .eq('id', pid)
      .eq('tenant_id', tid)
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
        .eq('tenant_id', tid)
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
            tenant_id: tid,
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
            specifications: product.specifications || [],
          })
          .select()
          .single()

        if (dupError) throw dupError
        if (!newProduct) throw new Error('Failed to create product variant')
        targetProductId = newProduct.id
        targetProduct = { ...product, stock_quantity: 0, cost_price: newCostPrice || product.cost_price }
      }
    }

    // Use provided cost_price or product's existing cost
    const unitCost = newCostPrice !== null ? newCostPrice : (targetProduct.cost_price || 0)

    // Update cost price first (a receive may reprice), then move stock
    // into the ACTIVE BRANCH through the RPC — which floors the branch row
    // at 0 and recomputes products.stock_quantity from all branch rows.
    const { error: updateError } = await supabase
      .from('products')
      .update({
        cost_price: newCostPrice !== null ? newCostPrice : targetProduct.cost_price,
        updated_at: new Date().toISOString()
      })
      .eq('id', targetProductId)
      .eq('tenant_id', tid)

    if (updateError) throw updateError

    const adjusted = await adjustStock({ tenantId: tid, branchId: req.branchId, productId: targetProductId, delta: qty })
    if (adjusted === null) throw new Error('Stock update failed')

    // Record movement
    const { data, error } = await supabase
      .from('stock_movements')
      .insert({
        tenant_id: tid,
        product_id: targetProductId,
        type: 'receive',
        quantity: qty,
        notes: notes || 'Stock received',
        branch_id: req.branchId || null
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
            .eq('tenant_id', tid)
            .single()
          supplierInfo = supp
        }
        await postStockReceiveJournal(
          data,
          { name: product.name, cost_price: unitCost },
          supplierInfo,
          tid
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
    const tid = req.user?.tenantId

    // Verify the product exists (404 semantics), then adjust per-branch:
    // the RPC floors the branch row at 0 (same as the old
    // Math.max(0, stock + quantity)) and recomputes the product total.
    const { data: product } = await supabase
      .from('products')
      .select('id')
      .eq('id', pid)
      .eq('tenant_id', tid)
      .single()

    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    const adjusted = await adjustStock({ tenantId: tid, branchId: req.branchId, productId: pid, delta: quantity })
    if (adjusted === null) throw new Error('Stock update failed')

    // Record movement
    const { data, error } = await supabase
      .from('stock_movements')
      .insert({
        tenant_id: tid,
        product_id: pid,
        type: 'adjust',
        quantity,
        notes: notes || 'Stock adjusted',
        branch_id: req.branchId || null
      })
      .select()
      .single()

    if (error) throw error

    // Auto-post to accounting journal
    try {
      const { postStockAdjustJournal } = await import('../services/accountingEngine.js')
      const { data: productFull } = await supabase.from('products').select('name, cost_price').eq('id', product_id).eq('tenant_id', tid).single()
      if (productFull) await postStockAdjustJournal(data, productFull, tid)
    } catch (accErr) {
      console.error('Accounting auto-post failed:', accErr.message)
    }

    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

// List stock transfers (newest first)
router.get('/transfers', async (req, res, next) => {
  try {
    const tenantId = req.user?.tenantId
    if (!tenantId) return res.json({ data: [] })
    const data = await listTransfers(tenantId)
    res.json({ data })
  } catch (err) {
    next(err)
  }
})

// Create a transfer — executes IMMEDIATELY (MVP: no pending/cancelled
// lifecycle; the status column keeps room for one later). The SQL function
// locks the source rows and moves stock + audit movements atomically.
router.post(
  '/transfers',
  requireManager,
  [
    body('from_branch_id').isInt({ min: 1 }).withMessage('Source branch is required'),
    body('to_branch_id').isInt({ min: 1 }).withMessage('Destination branch is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const tenantId = req.user?.tenantId
      if (!tenantId) return res.status(400).json({ error: 'A tenant is required', code: 'TENANT_REQUIRED' })

      const fromBranchId = Number(req.body.from_branch_id)
      const toBranchId = Number(req.body.to_branch_id)
      const { items } = req.body
      const notes = typeof req.body.notes === 'string' ? req.body.notes.slice(0, 500) : null

      // Tenant-scoped lookups: both branch ends must belong to this tenant,
      // and sufficiency is checked against the SOURCE branch's stock.
      const [{ data: branches }, { data: stockRows }] = await Promise.all([
        supabase
          .from('branches')
          .select('id, is_active')
          .in('id', [fromBranchId, toBranchId])
          .eq('tenant_id', tenantId),
        supabase
          .from('product_stock')
          .select('product_id, quantity')
          .eq('tenant_id', tenantId)
          .eq('branch_id', fromBranchId)
          .in('product_id', items.map((i) => Number(i?.product_id)).filter(Boolean)),
      ])

      const check = validateTransferInput({
        fromBranchId,
        toBranchId,
        items,
        branches: branches || [],
        stockRows: stockRows || [],
      })
      if (!check.ok) {
        return res.status(check.status).json({ error: check.error, code: check.code })
      }

      const result = await executeTransfer({
        tenantId,
        userId: req.user?.id,
        fromBranchId,
        toBranchId,
        items: check.items,
        notes,
      })
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error, code: result.code })
      }

      const transfer = await fetchTransfer(tenantId, result.transferId)
      req.logActivity?.({
        action: 'created',
        entity_type: 'stock_transfer',
        entity_name: `Transfer #${result.transferId}`,
        entity_id: result.transferId,
      })
      res.status(201).json({ data: transfer })
    } catch (err) {
      next(err)
    }
  }
)

export default router
