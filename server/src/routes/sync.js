import { Router } from 'express'
import supabase from '../db/supabase.js'

const router = Router()

// Sync a single offline order
router.post('/order', async (req, res, next) => {
  try {
    const {
      client_order_id, order_number, items, subtotal, discount_amount,
      tax_amount, total, payment_method, payment_status, payments,
      customer_id, user_id, created_at
    } = req.body

    if (!client_order_id) {
      return res.status(400).json({ error: 'client_order_id is required' })
    }

    // Check for duplicate - if this client_order_id already synced, skip
    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('client_order_id', client_order_id)
      .single()

    if (existing) {
      return res.json({
        message: 'Order already synced',
        server_order_id: existing.id,
        duplicate: true
      })
    }

    // Use the authenticated user's ID (or override for sync)
    const userId = req.user.id

    // Create order with client_order_id for dedup
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
        client_order_id,
        completed_at: created_at || new Date().toISOString(),
      })
      .select()
      .single()

    if (orderError) throw orderError

    console.log(`[SYNC] Order synced: ${client_order_id} -> ${order.id} (${order_number})`)

    // Process order items and stock (same as normal order)
    processSyncedOrder(order, items, payments, customer_id, userId, order_number, total).catch(err => {
      console.error('[SYNC BG] Error:', err.message)
    })

    res.status(201).json({
      message: 'Order synced successfully',
      server_order_id: order.id,
      duplicate: false
    })
  } catch (err) {
    console.error('[SYNC] Sync order error:', err)
    next(err)
  }
})

// Bulk sync multiple orders
router.post('/bulk', async (req, res, next) => {
  try {
    const { orders } = req.body
    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({ error: 'orders array is required' })
    }

    const results = []
    for (const orderData of orders) {
      try {
        const { client_order_id } = orderData

        // Check duplicate
        const { data: existing } = await supabase
          .from('orders')
          .select('id')
          .eq('client_order_id', client_order_id)
          .single()

        if (existing) {
          results.push({ client_order_id, status: 'duplicate', server_order_id: existing.id })
          continue
        }

        const userId = req.user.id

        const { data: order, error } = await supabase
          .from('orders')
          .insert({
            order_number: orderData.order_number,
            subtotal: orderData.subtotal || 0,
            discount_amount: orderData.discount_amount || 0,
            tax_amount: orderData.tax_amount || 0,
            total: orderData.total,
            payment_method: orderData.payment_method || 'cash',
            payment_status: orderData.payment_status || 'paid',
            user_id: userId,
            customer_id: orderData.customer_id || null,
            client_order_id,
            completed_at: orderData.created_at || new Date().toISOString(),
          })
          .select()
          .single()

        if (error) throw error

        processSyncedOrder(order, orderData.items, orderData.payments, orderData.customer_id, userId, orderData.order_number, orderData.total).catch(err => {
          console.error('[SYNC BULK BG] Error:', err.message)
        })

        results.push({ client_order_id, status: 'synced', server_order_id: order.id })
      } catch (err) {
        console.error(`[SYNC BULK] Failed: ${orderData.client_order_id}`, err.message)
        results.push({ client_order_id: orderData.client_order_id, status: 'error', error: err.message })
      }
    }

    const synced = results.filter(r => r.status === 'synced').length
    const duplicates = results.filter(r => r.status === 'duplicate').length
    const errors = results.filter(r => r.status === 'error').length

    console.log(`[SYNC BULK] Synced: ${synced}, Duplicates: ${duplicates}, Errors: ${errors}`)

    res.json({ results, summary: { synced, duplicates, errors, total: orders.length } })
  } catch (err) {
    console.error('[SYNC BULK] Error:', err)
    next(err)
  }
})

// Get sync status
router.get('/status', async (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    server: process.env.NODE_ENV || 'development',
  })
})

// Background processing for synced orders (same logic as normal orders)
async function processSyncedOrder(order, items, payments, customer_id, userId, order_number, total) {
  console.log(`[SYNC BG] Processing order ${order_number}`)

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
    } catch (e) { console.error('[SYNC BG] Loyalty update failed:', e.message) }
  }

  // Create order items and update stock
  for (const item of items) {
    try {
      const qty = parseFloat(item.quantity)
      const itemTotal = qty * item.unit_price - (item.discount || 0)

      await supabase.from('order_items').insert({
        order_id: order.id,
        product_id: item.product_id,
        quantity: qty,
        unit_price: item.unit_price,
        discount: item.discount || 0,
        total: itemTotal
      })

      const { data: product } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single()
      if (product) {
        await supabase.from('products').update({
          stock_quantity: Math.max(0, product.stock_quantity - qty),
          updated_at: new Date().toISOString()
        }).eq('id', item.product_id)
      }

      await supabase.from('stock_movements').insert({
        product_id: item.product_id,
        type: 'sale',
        quantity: -qty,
        reference_id: order.id,
        notes: `Order ${order_number} (synced)`
      })
    } catch (e) { console.error(`[SYNC BG] Stock update failed for item ${item.product_id}:`, e.message) }
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
      const arAccount = await findAcc('1030')

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
        } catch (e) { console.error(`[SYNC BG] Payment journal failed:`, e.message) }
      }
    } catch (e) { console.error('[SYNC BG] Payment processing failed:', e.message) }
  }

  // Post order journal
  try {
    const { postOrderJournal } = await import('../services/accountingEngine.js')
    const itemsWithCost = await Promise.all(items.map(async (item) => {
      const { data: product } = await supabase.from('products').select('cost_price').eq('id', item.product_id).single()
      return { ...item, cost_price: product?.cost_price || 0 }
    }))
    const journalEntry = await postOrderJournal(order, itemsWithCost)
    if (journalEntry) {
      await supabase.from('orders').update({ journal_entry_id: journalEntry.id }).eq('id', order.id)
    }
  } catch (e) { console.error('[SYNC BG] Order journal failed:', e.message) }

  console.log(`[SYNC BG] Order ${order_number} processing complete`)
}

export default router
