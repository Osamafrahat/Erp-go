import { Router } from 'express'
import supabase from '../db/supabase.js'

const router = Router()

// Get all commissions with filters
router.get('/', async (req, res, next) => {
  try {
    const { employee_id, status, period_start, period_end } = req.query

    let query = supabase
      .from('commissions')
      .select('*, employees(name, id)')
      .eq('tenant_id', req.user?.tenantId)
      .order('created_at', { ascending: false })

    if (employee_id) query = query.eq('employee_id', employee_id)
    if (status) query = query.eq('status', status)
    if (period_start) query = query.gte('created_at', period_start)
    if (period_end) query = query.lte('created_at', period_end)

    const { data, error } = await query
    if (error) throw error

    const enriched = (data || []).map(c => ({
      ...c,
      employee_name: c.employees?.name || 'Unknown',
    }))

    res.json(enriched)
  } catch (err) {
    next(err)
  }
})

// Get commission stats
router.get('/stats', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('commissions')
      .select('commission_amount, status, employee_id, employees(name)')
      .eq('tenant_id', req.user?.tenantId)

    if (error) throw error

    const records = data || []
    const total_pending = records
      .filter(r => r.status === 'pending')
      .reduce((sum, r) => sum + parseFloat(r.commission_amount || 0), 0)
    const total_approved = records
      .filter(r => r.status === 'approved')
      .reduce((sum, r) => sum + parseFloat(r.commission_amount || 0), 0)
    const total_paid = records
      .filter(r => r.status === 'paid')
      .reduce((sum, r) => sum + parseFloat(r.commission_amount || 0), 0)

    const byEmployee = {}
    records.forEach(r => {
      const empId = r.employee_id
      if (!empId) return
      if (!byEmployee[empId]) {
        byEmployee[empId] = { employee_id: empId, employee_name: r.employees?.name || 'Unknown', pending: 0, approved: 0, paid: 0, total: 0 }
      }
      const amt = parseFloat(r.commission_amount || 0)
      byEmployee[empId][r.status] = (byEmployee[empId][r.status] || 0) + amt
      byEmployee[empId].total += amt
    })

    res.json({ total_pending, total_approved, total_paid, byEmployee: Object.values(byEmployee) })
  } catch (err) {
    next(err)
  }
})

// Get employee commission history
router.get('/employee/:employeeId', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('commissions')
      .select('*, employees(name)')
      .eq('tenant_id', req.user?.tenantId)
      .eq('employee_id', req.params.employeeId)
      .order('created_at', { ascending: false })

    if (error) throw error

    const enriched = (data || []).map(c => ({
      ...c,
      employee_name: c.employees?.name || 'Unknown',
    }))

    res.json(enriched)
  } catch (err) {
    next(err)
  }
})

// Calculate commissions for a single order
router.post('/calculate', async (req, res, next) => {
  try {
    const { order_id } = req.body
    if (!order_id) {
      return res.status(400).json({ error: 'order_id is required' })
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, total, salesperson_id, order_items(product_id, quantity, unit_price, discount, total)')
      .eq('id', order_id)
      .eq('tenant_id', req.user?.tenantId)
      .single()

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    if (!order.salesperson_id) {
      return res.status(400).json({ error: 'Order has no salesperson assigned' })
    }

    const existing = await supabase
      .from('commissions')
      .select('id')
      .eq('tenant_id', req.user?.tenantId)
      .eq('order_id', order_id)
      .limit(1)

    if (existing.data && existing.data.length > 0) {
      return res.status(400).json({ error: 'Commissions already calculated for this order' })
    }

    const items = order.order_items || []
    if (items.length === 0) {
      return res.status(400).json({ error: 'No order items found' })
    }

    const productIds = items.filter(i => i.product_id).map(i => i.product_id)
    let productMap = {}
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('id, commission_rate')
        .in('id', productIds)
        .eq('tenant_id', req.user?.tenantId)
      if (products) products.forEach(p => { productMap[p.id] = p.commission_rate || 0 })
    }

    const commissions = []
    let totalCommission = 0

    for (const item of items) {
      const rate = productMap[item.product_id] || 0
      if (rate <= 0) continue

      const itemTotal = parseFloat(item.total || 0) || (parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0) - parseFloat(item.discount || 0))
      const commission = itemTotal * (rate / 100)

      if (commission > 0) {
        commissions.push({
          tenant_id: req.user?.tenantId,
          employee_id: order.salesperson_id,
          order_id: order.id,
          sale_amount: itemTotal,
          commission_rate: rate,
          commission_amount: commission,
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        totalCommission += commission
      }
    }

    if (commissions.length === 0) {
      return res.status(400).json({ error: 'No commissionable items found in this order' })
    }

    const { data, error } = await supabase
      .from('commissions')
      .insert(commissions)
      .select()

    if (error) throw error

    res.status(201).json({ commissions: data, total_commission: totalCommission, count: data.length })
  } catch (err) {
    next(err)
  }
})

// Approve a commission
router.patch('/:id/approve', async (req, res, next) => {
  try {
    const { data: existing } = await supabase
      .from('commissions')
      .select('id, status')
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .single()

    if (!existing) {
      return res.status(404).json({ error: 'Commission not found' })
    }
    if (existing.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending commissions can be approved' })
    }

    const { data, error } = await supabase
      .from('commissions')
      .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: req.user?.id })
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

// Mark commission as paid
router.patch('/:id/pay', async (req, res, next) => {
  try {
    const { data: existing } = await supabase
      .from('commissions')
      .select('id, status')
      .eq('id', req.params.id)
      .eq('tenant_id', req.user?.tenantId)
      .single()

    if (!existing) {
      return res.status(404).json({ error: 'Commission not found' })
    }
    if (existing.status !== 'approved') {
      return res.status(400).json({ error: 'Only approved commissions can be marked as paid' })
    }

    const { data, error } = await supabase
      .from('commissions')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
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

// Bulk calculate commissions for a date range
router.post('/bulk-calculate', async (req, res, next) => {
  try {
    const { period_start, period_end } = req.body
    if (!period_start || !period_end) {
      return res.status(400).json({ error: 'period_start and period_end are required' })
    }

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, total, salesperson_id, order_items(product_id, quantity, unit_price, discount, total)')
      .eq('tenant_id', req.user?.tenantId)
      .not('salesperson_id', 'is', null)
      .gte('created_at', period_start)
      .lte('created_at', period_end)

    if (ordersError) throw ordersError

    if (!orders || orders.length === 0) {
      return res.status(200).json({ commissions: [], total_commission: 0, count: 0, orders_processed: 0 })
    }

    const existingResult = await supabase
      .from('commissions')
      .select('order_id')
      .eq('tenant_id', req.user?.tenantId)
      .in('order_id', orders.map(o => o.id))

    const existingOrderIds = new Set((existingResult.data || []).map(e => e.order_id))

    const allProductIds = new Set()
    orders.forEach(order => {
      (order.order_items || []).forEach(item => {
        if (item.product_id) allProductIds.add(item.product_id)
      })
    })

    let productMap = {}
    if (allProductIds.size > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('id, commission_rate')
        .in('id', [...allProductIds])
        .eq('tenant_id', req.user?.tenantId)
      if (products) products.forEach(p => { productMap[p.id] = p.commission_rate || 0 })
    }

    const allCommissions = []
    let totalCommission = 0
    let ordersProcessed = 0

    for (const order of orders) {
      if (existingOrderIds.has(order.id)) continue

      const items = order.order_items || []
      let orderHasCommission = false

      for (const item of items) {
        const rate = productMap[item.product_id] || 0
        if (rate <= 0) continue

        const itemTotal = parseFloat(item.total || 0) || (parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0) - parseFloat(item.discount || 0))
        const commission = itemTotal * (rate / 100)

        if (commission > 0) {
          allCommissions.push({
            tenant_id: req.user?.tenantId,
            employee_id: order.salesperson_id,
            order_id: order.id,
            sale_amount: itemTotal,
            commission_rate: rate,
            commission_amount: commission,
            status: 'pending',
            created_at: new Date().toISOString(),
          })
          totalCommission += commission
          orderHasCommission = true
        }
      }

      if (orderHasCommission) ordersProcessed++
    }

    if (allCommissions.length === 0) {
      return res.status(200).json({ commissions: [], total_commission: 0, count: 0, orders_processed: 0 })
    }

    const { data, error } = await supabase
      .from('commissions')
      .insert(allCommissions)
      .select()

    if (error) throw error

    res.status(201).json({ commissions: data, total_commission: totalCommission, count: data.length, orders_processed: ordersProcessed })
  } catch (err) {
    next(err)
  }
})

export default router
