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

// Get all refunds
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('refunds')
      .select(`
        *,
        orders(order_number, total),
        users(full_name)
      `)
      .eq('tenant_id', req.user.tenantId)
      .order('created_at', { ascending: false })

    if (error) throw error

    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

// Create refund
router.post('/', authenticateToken, requirePermission('refunds_edit'), [
  body('order_id').isNumeric().withMessage('Invalid order ID'),
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('reason').trim().notEmpty().withMessage('Refund reason is required'),
], validate, async (req, res, next) => {
  try {
    const { order_id, amount, reason, items, is_partial } = req.body

    // Check if order exists
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('tenant_id', req.user.tenantId)
      .eq('id', order_id)
      .single()

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    // Check if order is older than 14 days
    const orderDate = new Date(order.created_at)
    const now = new Date()
    const daysSinceOrder = Math.floor((now - orderDate) / (1000 * 60 * 60 * 24))
    if (daysSinceOrder > 14) {
      return res.status(400).json({ error: `Refund not allowed. Order is ${daysSinceOrder} days old. Refund window is 14 days.` })
    }

    // For full refunds, check if already fully refunded
    if (!is_partial && order.is_refunded) {
      return res.status(400).json({ error: 'Order already fully refunded' })
    }

    // For partial refunds, check total refunded amount
    if (is_partial) {
      const { data: existingRefunds } = await supabase
        .from('refunds')
        .select('amount')
        .eq('tenant_id', req.user.tenantId)
        .eq('order_id', order_id)

      const totalRefunded = (existingRefunds || []).reduce((sum, r) => sum + parseFloat(r.amount), 0)
      if (totalRefunded + parseFloat(amount) > parseFloat(order.total) + 0.01) {
        return res.status(400).json({ error: 'Refund amount exceeds order total' })
      }
    } else {
      if (parseFloat(amount) > parseFloat(order.total)) {
        return res.status(400).json({ error: 'Refund amount cannot exceed order total' })
      }
    }

    // Check if products are refundable
    if (items && items.length > 0) {
      // Item-level refund: check each product
      const productIds = items.map(i => i.product_id)
      const { data: products } = await supabase
        .from('products')
        .select('id, is_refundable, name')
        .eq('tenant_id', req.user.tenantId)
        .in('id', productIds)

      const nonRefundable = (products || []).filter(p => p.is_refundable === false)
      if (nonRefundable.length > 0) {
        const names = nonRefundable.map(p => p.name).join(', ')
        return res.status(400).json({ error: `Cannot refund non-refundable items: ${names}` })
      }
    } else {
      // Full refund: check all order items
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('product_id')
        .eq('tenant_id', req.user.tenantId)
        .eq('order_id', order_id)

      if (orderItems && orderItems.length > 0) {
        const productIds = orderItems.map(i => i.product_id)
        const { data: products } = await supabase
          .from('products')
          .select('id, is_refundable, name')
          .eq('tenant_id', req.user.tenantId)
          .in('id', productIds)

        const nonRefundable = (products || []).filter(p => p.is_refundable === false)
        if (nonRefundable.length > 0) {
          const names = nonRefundable.map(p => p.name).join(', ')
          return res.status(400).json({ error: `Cannot refund non-refundable items: ${names}` })
        }
      }
    }

    // Create refund
    const { data: refund, error: refundError } = await supabase
      .from('refunds')
      .insert({
        tenant_id: req.user.tenantId,
        order_id,
        amount,
        reason,
        is_partial: is_partial || false,
        processed_by: req.user?.id || null
      })
      .select()
      .single()

    if (refundError) throw refundError

    // Create refund_items records if item-level refund
    if (items && items.length > 0) {
      const refundItemsData = items.map(item => ({
        tenant_id: req.user.tenantId,
        refund_id: refund.id,
        order_item_id: item.order_item_id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: item.discount || 0,
        total: item.total,
      }))

      const { error: riError } = await supabase
        .from('refund_items')
        .insert(refundItemsData)

      if (riError) {
        console.error('Failed to create refund_items:', riError.message)
      }
    }

    // Restore stock
    if (items && items.length > 0) {
      // Item-level refund: restore only selected items
      for (const item of items) {
        // Get the original order item to find the product
        const { data: orderItem } = await supabase
          .from('order_items')
          .select('product_id')
          .eq('tenant_id', req.user.tenantId)
          .eq('id', item.order_item_id)
          .single()

        if (orderItem) {
          const { data: product } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('tenant_id', req.user.tenantId)
            .eq('id', orderItem.product_id)
            .single()

          if (product) {
            await supabase
              .from('products')
              .update({
                stock_quantity: product.stock_quantity + item.quantity,
                updated_at: new Date().toISOString()
              })
              .eq('tenant_id', req.user.tenantId)
              .eq('id', orderItem.product_id)
          }

          await supabase
            .from('stock_movements')
            .insert({
              tenant_id: req.user.tenantId,
              product_id: orderItem.product_id,
              type: 'refund',
              quantity: item.quantity,
              reference_id: order_id,
              notes: `Partial refund for order ${order.order_number}`
            })
        }
      }
    } else {
      // Full refund: restore all items
      const { data: allItems } = await supabase
        .from('order_items')
        .select('*')
        .eq('tenant_id', req.user.tenantId)
        .eq('order_id', order_id)

      if (allItems) {
        for (const item of allItems) {
          const { data: product } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('tenant_id', req.user.tenantId)
            .eq('id', item.product_id)
            .single()

          if (product) {
            await supabase
              .from('products')
              .update({
                stock_quantity: product.stock_quantity + item.quantity,
                updated_at: new Date().toISOString()
              })
              .eq('tenant_id', req.user.tenantId)
              .eq('id', item.product_id)
          }

          await supabase
            .from('stock_movements')
            .insert({
              tenant_id: req.user.tenantId,
              product_id: item.product_id,
              type: 'refund',
              quantity: item.quantity,
              reference_id: order_id,
              notes: `Refund for order ${order.order_number}`
            })
        }
      }
    }

    // Determine if order is fully refunded
    if (is_partial) {
      const { data: allRefunds } = await supabase
        .from('refunds')
        .select('amount')
        .eq('tenant_id', req.user.tenantId)
        .eq('order_id', order_id)

      const totalRefunded = (allRefunds || []).reduce((sum, r) => sum + parseFloat(r.amount), 0)
      if (totalRefunded >= parseFloat(order.total) - 0.01) {
        await supabase
          .from('orders')
          .update({ is_refunded: true, payment_status: 'refunded' })
          .eq('tenant_id', req.user.tenantId)
          .eq('id', order_id)
      }
    } else {
      await supabase
        .from('orders')
        .update({ is_refunded: true, payment_status: 'refunded' })
        .eq('tenant_id', req.user.tenantId)
        .eq('id', order_id)
    }

    // Log activity
    req.logActivity({
      action: 'refunded',
      entity_type: 'order',
      entity_id: order.id,
      entity_name: order.order_number,
      details: { amount, reason, original_total: order.total, is_partial: is_partial || false, items_count: items?.length || 0 }
    })

    // Auto-post to accounting journal
    try {
      const { postRefundJournal } = await import('../services/accountingEngine.js')
      await postRefundJournal(refund, items || null)
    } catch (accErr) {
      console.error('Accounting auto-post failed:', accErr.message)
    }

    res.status(201).json(refund)
  } catch (err) {
    console.error('Failed to create refund:', err)
    next(err)
  }
})

// Get refund by ID
router.get('/:id', [
  param('id').isNumeric().withMessage('Invalid refund ID'),
], validate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('refunds')
      .select('*, orders(order_number, total), users(full_name)')
      .eq('tenant_id', req.user.tenantId)
      .eq('id', req.params.id)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Refund not found' })
    }

    // Fetch refund items if any
    const { data: refundItems } = await supabase
      .from('refund_items')
      .select('*, products(name)')
      .eq('tenant_id', req.user.tenantId)
      .eq('refund_id', data.id)

    res.json({ ...data, items: refundItems || [] })
  } catch (err) {
    next(err)
  }
})

export default router
