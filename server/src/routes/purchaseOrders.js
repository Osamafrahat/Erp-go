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

// Get PO stats
router.get('/stats', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('id, total, status')
      .eq('tenant_id', req.user?.tenantId)

    if (error) throw error

    const orders = data || []
    const totalOrders = orders.length
    const totalValue = orders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0)
    const pendingCount = orders.filter(o => o.status === 'draft' || o.status === 'sent').length
    const receivedCount = orders.filter(o => o.status === 'received').length

    res.json({ total_orders: totalOrders, total_value: totalValue, pending_count: pendingCount, received_count: receivedCount })
  } catch (err) {
    next(err)
  }
})

// Get all purchase orders
router.get('/', async (req, res, next) => {
  try {
    const { status, supplier_id } = req.query

    let query = supabase
      .from('purchase_orders')
      .select('*, suppliers(name, contact_person, email)')
      .eq('tenant_id', req.user?.tenantId)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (supplier_id) query = query.eq('supplier_id', supplier_id)

    const { data, error } = await query
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

// Create purchase order
router.post('/', [
  body('supplier_id').isNumeric().withMessage('Supplier ID is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
], validate, async (req, res, next) => {
  try {
    const { supplier_id, items, expected_date, notes } = req.body

    const order_number = `PO-${Date.now()}`

    // Lookup product names from product IDs
    const productIds = items.map(i => i.product_id).filter(Boolean)
    let productNameMap = {}
    if (productIds.length > 0) {
      const { data: prods } = await supabase
        .from('products')
        .select('id, name')
        .in('id', productIds)
        .eq('tenant_id', req.user?.tenantId)
      ;(prods || []).forEach(p => { productNameMap[p.id] = p.name })
    }

    let total = 0
    const processedItems = items.map(item => {
      const quantity = parseFloat(item.quantity)
      const unit_price = parseFloat(item.unit_price)
      const line_total = quantity * unit_price
      total += line_total
      return {
        product_id: item.product_id,
        product_name: productNameMap[item.product_id] || item.product_name || 'Unknown',
        quantity,
        unit_price,
        line_total,
        received_quantity: 0,
      }
    })

    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        tenant_id: req.user?.tenantId,
        supplier_id,
        order_number,
        total,
        expected_date,
        notes,
        status: 'draft',
        created_at: new Date().toISOString(),
      })
      .select('*, suppliers(name, contact_person, email)')
      .single()

    if (poError) throw poError

    const itemsToInsert = processedItems.map(item => ({
      ...item,
      purchase_order_id: po.id,
      tenant_id: req.user?.tenantId,
    }))

    const { error: itemsError } = await supabase
      .from('purchase_order_items')
      .insert(itemsToInsert)

    if (itemsError) throw itemsError

    const { data: itemsData } = await supabase
      .from('purchase_order_items')
      .select('*')
      .eq('purchase_order_id', po.id)
      .eq('tenant_id', req.user?.tenantId)

    res.status(201).json({ ...po, items: itemsData || [] })
  } catch (err) {
    next(err)
  }
})

// Get PO by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select('*, suppliers(name, contact_person, email)')
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .single()

    if (poError || !po) {
      return res.status(404).json({ error: 'Purchase order not found' })
    }

    const { data: items } = await supabase
      .from('purchase_order_items')
      .select('*')
      .eq('purchase_order_id', po.id)
      .eq('tenant_id', req.user?.tenantId)

    res.json({ ...po, items: items || [] })
  } catch (err) {
    next(err)
  }
})

// Update PO
router.put('/:id', async (req, res, next) => {
  try {
    const { status, expected_date, notes, items } = req.body

    const allowedStatuses = ['draft', 'sent', 'received', 'cancelled']
    const updateFields = {}
    if (status !== undefined) {
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` })
      }
      updateFields.status = status
    }
    if (expected_date !== undefined) updateFields.expected_date = expected_date
    if (notes !== undefined) updateFields.notes = notes

    if (items && Array.isArray(items)) {
      let total = 0
      for (const item of items) {
        total += parseFloat(item.quantity) * parseFloat(item.unit_price)
      }
      updateFields.total = total

      await supabase
        .from('purchase_order_items')
        .delete()
        .eq('purchase_order_id', req.params.id)
        .eq('tenant_id', req.user?.tenantId)

      const itemsToInsert = items.map(item => ({
        purchase_order_id: req.params.id,
        tenant_id: req.user?.tenantId,
        product_id: item.product_id,
        product_name: item.product_name || 'Unknown',
        quantity: parseFloat(item.quantity),
        unit_price: parseFloat(item.unit_price),
        line_total: parseFloat(item.quantity) * parseFloat(item.unit_price),
        received_quantity: item.received_quantity || 0,
      }))

      await supabase
        .from('purchase_order_items')
        .insert(itemsToInsert)
    }

    const { data, error } = await supabase
      .from('purchase_orders')
      .update(updateFields)
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .select('*, suppliers(name, contact_person, email)')
      .single()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Purchase order not found' })
    }

    const { data: updatedItems } = await supabase
      .from('purchase_order_items')
      .select('*')
      .eq('purchase_order_id', data.id)
      .eq('tenant_id', req.user?.tenantId)

    res.json({ ...data, items: updatedItems || [] })
  } catch (err) {
    next(err)
  }
})

// Receive PO
router.patch('/:id/receive', async (req, res, next) => {
  try {
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .single()

    if (poError || !po) {
      return res.status(404).json({ error: 'Purchase order not found' })
    }

    if (po.status === 'received') {
      return res.status(400).json({ error: 'PO already received' })
    }

    const { data: items } = await supabase
      .from('purchase_order_items')
      .select('*')
      .eq('purchase_order_id', po.id)
      .eq('tenant_id', req.user?.tenantId)

    if (items) {
      for (const item of items) {
        const received_qty = item.quantity - (item.received_quantity || 0)
        if (received_qty > 0) {
          await supabase
            .from('purchase_order_items')
            .update({ received_quantity: item.quantity })
            .eq('id', item.id)
            .eq('tenant_id', req.user?.tenantId)

          const { data: product } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', item.product_id)
            .eq('tenant_id', req.user?.tenantId)
            .single()

          if (product) {
            await supabase
              .from('products')
              .update({ stock_quantity: (product.stock_quantity || 0) + received_qty })
              .eq('id', item.product_id)
              .eq('tenant_id', req.user?.tenantId)
          }

          await supabase
            .from('stock_movements')
            .insert({
              tenant_id: req.user?.tenantId,
              product_id: item.product_id,
              quantity: received_qty,
              type: 'purchase',
              reference: po.order_number,
              notes: `Received from PO ${po.order_number}`,
              created_at: new Date().toISOString(),
            })
        }
      }
    }

    const { data, error } = await supabase
      .from('purchase_orders')
      .update({
        status: 'received',
        received_date: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .select('*, suppliers(name, contact_person, email)')
      .single()

    if (error) throw error

    const { data: updatedItems } = await supabase
      .from('purchase_order_items')
      .select('*')
      .eq('purchase_order_id', data.id)
      .eq('tenant_id', req.user?.tenantId)

    res.json({ ...data, items: updatedItems || [] })
  } catch (err) {
    next(err)
  }
})

// Delete PO (only if draft)
router.delete('/:id', async (req, res, next) => {
  try {
    const { data: po } = await supabase
      .from('purchase_orders')
      .select('status')
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .single()

    if (!po) {
      return res.status(404).json({ error: 'Purchase order not found' })
    }

    if (po.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft POs can be deleted' })
    }

    await supabase
      .from('purchase_order_items')
      .delete()
      .eq('purchase_order_id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)

    const { error } = await supabase
      .from('purchase_orders')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)

    if (error) throw error
    res.json({ message: 'Purchase order deleted' })
  } catch (err) {
    next(err)
  }
})

export default router
