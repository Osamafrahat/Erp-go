import { Router } from 'express'
import supabase from '../db/supabase.js'

const router = Router()

// Get all orders
router.get('/', async (req, res, next) => {
  try {
    const { start_date, end_date, limit = 100 } = req.query

    let query = supabase
      .from('orders')
      .select(`
        *,
        users(full_name),
        customers(name),
        refunds(id, amount, is_partial),
        order_items(id, product_id, product_name, quantity, unit_price, discount, total, type)
      `)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))

    if (start_date) {
      query = query.gte('created_at', start_date)
    }
    if (end_date) {
      query = query.lte('created_at', end_date)
    }

    const { data, error } = await query
    if (error) throw error

    // Enrich with refund summary
    const enriched = (data || []).map(order => {
      const refunds = order.refunds || []
      const total_refunded = refunds.reduce((sum, r) => sum + parseFloat(r.amount), 0)
      const refund_count = refunds.length
      const has_partial_refund = refunds.some(r => r.is_partial)

      let refund_status = 'paid'
      if (has_partial_refund) {
        refund_status = 'partial'
      } else if (order.is_refunded || refund_count > 0) {
        refund_status = 'refunded'
      }

      return {
        ...order,
        total_refunded,
        refund_count,
        has_partial_refund,
        refund_status,
      }
    })

    res.json(enriched)
  } catch (err) {
    next(err)
  }
})

// Get order by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    // Get user name
    let user_name = null
    if (order.user_id) {
      const { data: u } = await supabase.from('users').select('full_name').eq('id', order.user_id).single()
      user_name = u?.full_name || null
    }

    // Get customer name
    let customer_name = null
    if (order.customer_id) {
      const { data: c } = await supabase.from('customers').select('name').eq('id', order.customer_id).single()
      customer_name = c?.name || null
    }

    // Get order items
    const { data: items } = await supabase
      .from('order_items')
      .select('*, products(name, is_refundable, unit_of_measure), product_name')
      .eq('order_id', order.id)

    // Get payments
    const { data: payments } = await supabase
      .from('payment_splits')
      .select('*')
      .eq('order_id', order.id)

    // Get refunds with items
    const { data: refunds } = await supabase
      .from('refunds')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false })

    // Get refund items for all refunds on this order
    let refundItems = []
    if (refunds && refunds.length > 0) {
      const refundIds = refunds.map(r => r.id)
      const { data: ri } = await supabase
        .from('refund_items')
        .select('*')
        .in('refund_id', refundIds)
      refundItems = ri || []
    }

    const totalRefunded = (refunds || []).reduce((sum, r) => sum + parseFloat(r.amount), 0)

    res.json({
      ...order,
      users: user_name ? { full_name: user_name } : null,
      customers: customer_name ? { name: customer_name } : null,
      items: items || [],
      payments: payments || [],
      refunds: refunds || [],
      refund_items: refundItems,
      total_refunded: totalRefunded
    })
  } catch (err) {
    next(err)
  }
})

// Create order
router.post('/', async (req, res, next) => {
  try {
    const { order_number, items, subtotal, discount_amount, tax_amount, total,
      payment_method, payment_status, payments, customer_id, promotion_id, client_order_id, notes } = req.body

    if (!order_number) {
      return res.status(400).json({ error: 'Order number is required' })
    }
    if (!items || items.length === 0) {
      // Service-only orders may have no product items - check if notes indicate service sale
      const isServiceOrder = req.body.notes?.includes('Service sale') || req.body.notes?.includes('service(s)')
      if (!isServiceOrder) {
        return res.status(400).json({ error: 'Order items are required' })
      }
    }

    // Dedup: if client_order_id already exists, return existing order
    if (client_order_id) {
      const { data: existing } = await supabase
        .from('orders')
        .select('id')
        .eq('client_order_id', client_order_id)
        .single()
      if (existing) {
        return res.status(200).json({ ...existing, duplicate: true })
      }
    }

    const userId = req.user.id

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number,
        subtotal: subtotal || 0,
        discount_amount: discount_amount || 0,
        tax_amount: tax_amount || 0,
        total,
        payment_method: payment_method || 'cash',
        payment_status: payment_status || 'paid',
        user_id: userId,
        customer_id: customer_id || null,
        promotion_id: promotion_id || null,
        client_order_id: client_order_id || null,
        notes: notes || null,
        completed_at: new Date().toISOString()
      })
      .select()
      .single()

    if (orderError) throw orderError

    // Respond immediately
    res.status(201).json(order)

    // Everything below runs in background (fire and forget)
    processOrderBackground(order, items, payments, customer_id, userId, order_number, total, promotion_id).catch(err => {
      console.error('[ORDER BG] Error:', err.message)
    })
  } catch (err) {
    console.error('Failed to create order:', err)
    next(err)
  }
})

// Background processing for order (stock, payments, accounting)
async function processOrderBackground(order, items, payments, customer_id, userId, order_number, total, promotion_id) {
  console.log(`[ORDER BG] Processing order ${order_number}`)

  // Increment promotion used_count
  if (promotion_id) {
    try {
      const { data: promo } = await supabase.from('promotions').select('used_count, max_uses').eq('id', promotion_id).single()
      if (promo) {
        const newCount = (promo.used_count || 0) + 1
        const updateData = { used_count: newCount }
        if (promo.max_uses && newCount >= promo.max_uses) {
          updateData.is_active = false
        }
        await supabase.from('promotions').update(updateData).eq('id', promotion_id)
        console.log(`[ORDER BG] Promotion ${promotion_id} used_count incremented to ${newCount}`)
      }
    } catch (e) { console.error('[ORDER BG] Promotion update failed:', e.message) }
  }

  // Update customer loyalty points
  if (customer_id) {
    try {
      const { data: setting } = await supabase.from('store_settings').select('value').eq('key', 'loyaltyPointsPerCurrency').single()
      const pointsPerCurrency = parseFloat(setting?.value) || 0
      const { data: customer } = await supabase.from('customers').select('loyalty_points, total_spent').eq('id', customer_id).single()
      if (customer) {
        await supabase.from('customers').update({
          loyalty_points: (customer.loyalty_points || 0) + Math.floor(total * pointsPerCurrency),
          total_spent: (customer.total_spent || 0) + total,
          updated_at: new Date().toISOString()
        }).eq('id', customer_id)
      }
    } catch (e) { console.error('[ORDER BG] Loyalty update failed:', e.message) }
  }

  // Create order items and update stock
  for (const item of items) {
    try {
      const qty = parseFloat(item.quantity)
      const itemTotal = qty * item.unit_price - (item.discount || 0)

      await supabase.from('order_items').insert({
        order_id: order.id,
        product_id: item.product_id || null,
        product_name: item.product_name || null,
        quantity: qty,
        unit_price: item.unit_price,
        discount: item.discount || 0,
        total: itemTotal,
        type: item._type || 'product'
      })

      // Update stock directly (skip RPC) - only for product items
      if (item.product_id) {
        const { data: product } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single()
        if (product) {
          await supabase.from('products').update({
            stock_quantity: Math.max(0, product.stock_quantity - qty),
            updated_at: new Date().toISOString()
          }).eq('id', item.product_id)
        }

        // Record stock movement
        await supabase.from('stock_movements').insert({
          product_id: item.product_id,
          type: 'sale',
          quantity: -qty,
          reference_id: order.id,
          notes: `Order ${order_number}`
        })
      }
    } catch (e) { console.error(`[ORDER BG] Stock update failed for item ${item.product_id}:`, e.message) }
  }

  // Create payment splits and journal entries
  if (payments && payments.length > 0) {
    try {
      const paymentInserts = payments.map(p => ({
        order_id: order.id,
        method: p.method,
        amount: p.amount,
        reference: p.reference || null
      }))
      await supabase.from('payment_splits').insert(paymentInserts)

      const { createJournalEntry } = await import('../services/accountingEngine.js')

      async function findAcc(code) {
        const { data } = await supabase.from('accounts').select('id, code').eq('code', code).single()
        return data
      }

      const cashAccount = await findAcc('1010')
      const bankAccount = await findAcc('1020')

      // Use customer-specific AR if available
      let arAccount = null
      if (customer_id) {
        const { data: cust } = await supabase
          .from('customers')
          .select('account_code')
          .eq('id', customer_id)
          .single()
        if (cust?.account_code) {
          const { data } = await supabase.from('accounts').select('id, code').eq('code', cust.account_code).single()
          arAccount = data
        }
      }
      if (!arAccount) {
        arAccount = await findAcc('1030')
      }

      for (const p of payments) {
        try {
          const sourceAccount = p.method === 'cash' ? cashAccount : bankAccount
          const date = new Date().toISOString().split('T')[0]
          const rand = Math.floor(Math.random() * 9999).toString().padStart(4, '0')
          const paymentNumber = `PAY-${date.replace(/-/g, '')}-${rand}`

          const lines = []
          if (sourceAccount) lines.push({ accountId: sourceAccount.id, debit: parseFloat(p.amount), credit: 0, description: `Payment - ${paymentNumber}` })
          if (arAccount) lines.push({ accountId: arAccount.id, debit: 0, credit: parseFloat(p.amount), description: `AR - ${paymentNumber}` })

          if (lines.length > 0) {
            const entry = await createJournalEntry({ date, description: `Payment: ${paymentNumber}`, reference: paymentNumber, sourceType: 'payment', sourceId: null, lines, createdBy: userId })
            await supabase.from('payments').insert({
              payment_number: paymentNumber, payment_type: 'inbound', method: p.method,
              amount: parseFloat(p.amount), reference: p.reference || null,
              payment_date: date, recorded_by: userId, journal_entry_id: entry.id,
            })
          }
        } catch (e) { console.error(`[ORDER BG] Payment journal failed:`, e.message) }
      }
    } catch (e) { console.error('[ORDER BG] Payment processing failed:', e.message) }
  }

  // Post order journal
  try {
    const { postOrderJournal } = await import('../services/accountingEngine.js')
    const itemsWithCost = await Promise.all(items.map(async (item) => {
      const { data: product } = await supabase.from('products').select('cost_price').eq('id', item.product_id).single()
      return { ...item, cost_price: product?.cost_price || 0 }
    }))

    // Fetch customer info for per-customer AR
    let customerInfo = null
    if (customer_id) {
      const { data: cust } = await supabase
        .from('customers')
        .select('id, name, account_code')
        .eq('id', customer_id)
        .single()
      customerInfo = cust
    }

    const journalEntry = await postOrderJournal(order, itemsWithCost, customerInfo)
    if (journalEntry) {
      await supabase.from('orders').update({ journal_entry_id: journalEntry.id }).eq('id', order.id)
    }
  } catch (e) { console.error('[ORDER BG] Order journal failed:', e.message) }

  // Log activity (skip if no request context)
  try {
    if (typeof req.logActivity === 'function') {
      req.logActivity({ action: 'created', entity_type: 'order', entity_id: order.id, entity_name: order_number, details: { total, items_count: items.length } })
    }
  } catch (e) {}

  console.log(`[ORDER BG] Order ${order_number} processing complete`)
}

// Update order status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body

    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('id', req.params.id)
      .single()

    if (!existing) {
      return res.status(404).json({ error: 'Order not found' })
    }

    const { data, error } = await supabase
      .from('orders')
      .update({ payment_status: status })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

export default router
