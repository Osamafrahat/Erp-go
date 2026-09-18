import { Router } from 'express'
import supabase from '../db/supabase.js'

const router = Router()

// Check if commissions table exists
let commissionsTableExists = null
async function ensureCommissionsTable(tenantId) {
  if (commissionsTableExists === true) return true
  try {
    const { error } = await supabase.from('commissions').select('id').limit(1)
    if (error && error.message?.includes('does not exist')) {
      console.warn('[COMMISSIONS] Table does not exist. User must run fix-commissions.sql in Supabase SQL Editor.')
      commissionsTableExists = false
      return false
    }
    commissionsTableExists = true
    return true
  } catch (e) {
    console.error('[COMMISSIONS] ensureCommissionsTable check failed:', e.message)
    return false
  }
}

// Get all commissions with filters
router.get('/', async (req, res, next) => {
  try {
    const tableExists = await ensureCommissionsTable(req.user?.tenantId)
    if (!tableExists) {
      return res.status(200).json({ error: 'Commissions table does not exist. Run fix-commissions.sql in Supabase SQL Editor.', setup_required: true })
    }

    if (!req.user?.tenantId) {
      return res.json([])
    }

    const { employee_id, status, period_start, period_end } = req.query

    let query = supabase
      .from('commissions')
      .select('*')
      .eq('tenant_id', req.user?.tenantId)
      .order('created_at', { ascending: false })

    if (employee_id) query = query.eq('employee_id', employee_id)
    if (status) query = query.eq('status', status)
    if (period_start) query = query.gte('created_at', period_start)
    if (period_end) query = query.lte('created_at', period_end + 'T23:59:59.999Z')

    const { data, error } = await query
    if (error) throw error

    const employeeIds = [...new Set((data || []).map(c => c.employee_id).filter(Boolean))]
    let employeeMap = {}
    if (employeeIds.length > 0) {
      const { data: employees } = await supabase
        .from('employees')
        .select('id, name')
        .eq('tenant_id', req.user?.tenantId)
        .in('id', employeeIds)
      if (employees) employees.forEach(e => { employeeMap[e.id] = e.name })
    }

    const enriched = (data || []).map(c => ({
      ...c,
      employee_name: employeeMap[c.employee_id] || 'Unknown',
    }))

    res.json(enriched)
  } catch (err) {
    next(err)
  }
})

// Check setup status - are products configured with commission rates? Are employees linked?
router.get('/setup-check', async (req, res, next) => {
  try {
    const tableExists = await ensureCommissionsTable(req.user?.tenantId)
    const tid = req.user?.tenantId

    // Check if products have commission_rate > 0
    const { data: products } = await supabase
      .from('products')
      .select('id, name, commission_rate')
      .eq('tenant_id', tid)

    const productsWithRate = (products || []).filter(p => parseFloat(p.commission_rate || 0) > 0)

    // Check if users have employee_id linked
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, employee_id')
      .eq('tenant_id', tid)

    const usersWithEmployee = (users || []).filter(u => u.employee_id)

    // Check if orders have salesperson_id
    const { count: totalOrders } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tid)

    const { count: ordersWithSalesperson } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tid)
      .not('salesperson_id', 'is', null)

    res.json({
      tableExists,
      totalProducts: (products || []).length,
      productsWithRate: productsWithRate.length,
      totalUsers: (users || []).length,
      usersWithEmployee: usersWithEmployee.length,
      totalOrders: totalOrders || 0,
      ordersWithSalesperson: ordersWithSalesperson || 0,
      hasProducts: productsWithRate.length > 0,
      hasLinkedUsers: usersWithEmployee.length > 0,
      hasSalesOrders: (ordersWithSalesperson || 0) > 0,
    })
  } catch (err) {
    next(err)
  }
})

// Get commission stats
router.get('/stats', async (req, res, next) => {
  try {
    const tableExists = await ensureCommissionsTable(req.user?.tenantId)
    if (!tableExists || !req.user?.tenantId) {
      return res.json({ total_pending: 0, total_approved: 0, total_paid: 0, byEmployee: [], setup_required: !tableExists })
    }

    const { data, error } = await supabase
      .from('commissions')
      .select('commission_amount, status, employee_id')
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
    const empIds = [...new Set(records.map(r => r.employee_id).filter(Boolean))]
    let empNameMap = {}
    if (empIds.length > 0) {
      const { data: emps } = await supabase
        .from('employees')
        .select('id, name')
        .eq('tenant_id', req.user?.tenantId)
        .in('id', empIds)
      if (emps) emps.forEach(e => { empNameMap[e.id] = e.name })
    }
    records.forEach(r => {
      const empId = r.employee_id
      if (!empId) return
      if (!byEmployee[empId]) {
        byEmployee[empId] = { employee_id: empId, employee_name: empNameMap[empId] || 'Unknown', pending: 0, approved: 0, paid: 0, total: 0 }
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
      .select('*')
      .eq('tenant_id', req.user?.tenantId)
      .eq('employee_id', req.params.employeeId)
      .order('created_at', { ascending: false })

    if (error) throw error

    let empName = 'Unknown'
    const empId = (data && data.length > 0) ? data[0].employee_id : null
    if (empId) {
      const { data: emp } = await supabase
        .from('employees')
        .select('name')
        .eq('id', empId)
        .eq('tenant_id', req.user?.tenantId)
        .single()
      if (emp) empName = emp.name
    }

    const enriched = (data || []).map(c => ({
      ...c,
      employee_name: empName,
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
      .select('id, total, salesperson_id')
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

    // Query order_items separately (avoid PostgREST FK join issues)
    const { data: items } = await supabase
      .from('order_items')
      .select('product_id, quantity, unit_price, discount, total')
      .eq('order_id', order_id)
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
    const tableExists = await ensureCommissionsTable(req.user?.tenantId)
    if (!tableExists) {
      return res.status(400).json({ error: 'Commissions table does not exist. Run fix-commissions.sql in Supabase SQL Editor.' })
    }

    if (!req.user?.tenantId) {
      return res.json({ commissions: [], total_commission: 0, count: 0, orders_processed: 0 })
    }

    const { period_start, period_end } = req.body
    if (!period_start || !period_end) {
      return res.status(400).json({ error: 'period_start and period_end are required' })
    }

    const tid = req.user.tenantId

    // Query orders WITHOUT join (avoid PostgREST FK join issues)
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, total, salesperson_id')
      .eq('tenant_id', tid)
      .not('salesperson_id', 'is', null)
      .gte('created_at', period_start)
      .lte('created_at', period_end + 'T23:59:59.999Z')

    if (ordersError) throw ordersError

    if (!orders || orders.length === 0) {
      return res.status(200).json({ commissions: [], total_commission: 0, count: 0, orders_processed: 0 })
    }

    const orderIds = orders.map(o => o.id)

    // Query order_items separately (like dead stock)
    const BATCH = 20
    const allItems = []
    for (let i = 0; i < orderIds.length; i += BATCH) {
      const batch = orderIds.slice(i, i + BATCH)
      const { data: items } = await supabase
        .from('order_items')
        .select('order_id, product_id, quantity, unit_price, discount, total')
        .in('order_id', batch)
      if (items) allItems.push(...items)
    }

    // Index items by order_id
    const itemsByOrder = {}
    allItems.forEach(item => {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = []
      itemsByOrder[item.order_id].push(item)
    })

    // Check existing commissions
    const existingResult = await supabase
      .from('commissions')
      .select('order_id')
      .eq('tenant_id', tid)
      .in('order_id', orderIds)
    const existingOrderIds = new Set((existingResult.data || []).map(e => e.order_id))

    // Get product commission rates
    const allProductIds = new Set()
    allItems.forEach(item => {
      if (item.product_id) allProductIds.add(item.product_id)
    })

    let productMap = {}
    if (allProductIds.size > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('id, commission_rate')
        .in('id', [...allProductIds])
        .eq('tenant_id', tid)
      if (products) products.forEach(p => { productMap[p.id] = parseFloat(p.commission_rate || 0) })
    }

    const allCommissions = []
    let totalCommission = 0
    let ordersProcessed = 0

    for (const order of orders) {
      if (existingOrderIds.has(order.id)) continue

      const items = itemsByOrder[order.id] || []
      let orderHasCommission = false

      for (const item of items) {
        const rate = productMap[item.product_id] || 0
        if (rate <= 0) continue

        const itemTotal = parseFloat(item.total || 0) || (parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0) - parseFloat(item.discount || 0))
        const commission = Math.round(itemTotal * (rate / 100) * 100) / 100

        if (commission > 0) {
          allCommissions.push({
            tenant_id: tid,
            employee_id: order.salesperson_id,
            order_id: order.id,
            sale_amount: Math.round(itemTotal * 100) / 100,
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

// Backfill: set salesperson_id on orders based on user→employee link
router.post('/backfill-salesperson', async (req, res, next) => {
  try {
    if (!req.user?.tenantId) {
      return res.json({ updated: 0 })
    }

    // Get all orders without salesperson_id but with user_id
    const { data: orders } = await supabase
      .from('orders')
      .select('id, user_id')
      .eq('tenant_id', req.user?.tenantId)
      .is('salesperson_id', null)
      .not('user_id', 'is', null)

    if (!orders || orders.length === 0) {
      return res.json({ updated: 0, message: 'No orders need backfill' })
    }

    // Get all users with employee_id linked
    const userIds = [...new Set(orders.map(o => o.user_id))]
    const { data: users } = await supabase
      .from('users')
      .select('id, employee_id')
      .eq('tenant_id', req.user?.tenantId)
      .in('id', userIds)
      .not('employee_id', 'is', null)

    const userEmpMap = {}
    if (users) users.forEach(u => { userEmpMap[u.id] = u.employee_id })

    let updated = 0
    for (const order of orders) {
      const empId = userEmpMap[order.user_id]
      if (empId) {
        await supabase
          .from('orders')
          .update({ salesperson_id: empId })
          .eq('id', order.id)
          .eq('tenant_id', req.user?.tenantId)
        updated++
      }
    }

    res.json({ updated, total: orders.length })
  } catch (err) {
    next(err)
  }
})

// Diagnostic: show full pipeline state for debugging
router.get('/debug', async (req, res, next) => {
  try {
    if (!req.user?.tenantId) {
      return res.json({ error: 'No tenant' })
    }
    const tid = req.user.tenantId

    // 1. Check commission_rate on products
    const { data: products } = await supabase
      .from('products')
      .select('id, name, commission_rate')
      .eq('tenant_id', tid)
    const productStats = {
      total: (products || []).length,
      withRate: (products || []).filter(p => parseFloat(p.commission_rate || 0) > 0).length,
      sampleProducts: (products || []).slice(0, 5).map(p => ({ name: p.name, rate: p.commission_rate }))
    }

    // 2. Check user→employee links
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, employee_id, role')
      .eq('tenant_id', tid)
    const userStats = {
      total: (users || []).length,
      withEmployee: (users || []).filter(u => u.employee_id).length,
      sampleUsers: (users || []).slice(0, 5).map(u => ({ name: u.full_name, employee_id: u.employee_id, role: u.role }))
    }

    // 3. Check orders with/without salesperson
    const { count: totalOrders } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tid)
    const { count: withSalesperson } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tid)
      .not('salesperson_id', 'is', null)
    const { count: withoutSalesperson } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tid)
      .is('salesperson_id', null)
    const { count: withUserId } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tid)
      .not('user_id', 'is', null)

    // 4. Check commissions
    const { count: totalCommissions } = await supabase
      .from('commissions')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tid)

    // 5. Sample order with user_id
    const { data: sampleOrder } = await supabase
      .from('orders')
      .select('id, user_id, salesperson_id, total, created_at')
      .eq('tenant_id', tid)
      .not('user_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(3)

    // 6. Check if employees exist
    const { count: employeeCount } = await supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tid)
    const { data: sampleEmployees } = await supabase
      .from('employees')
      .select('id, name, is_active')
      .eq('tenant_id', tid)
      .limit(5)

    res.json({
      products: productStats,
      users: userStats,
      orders: { total: totalOrders || 0, withSalesperson: withSalesperson || 0, withoutSalesperson: withoutSalesperson || 0, withUserId: withUserId || 0 },
      commissions: { total: totalCommissions || 0 },
      employees: { count: employeeCount || 0, sample: sampleEmployees || [] },
      sampleOrders: sampleOrder || [],
    })
  } catch (err) {
    next(err)
  }
})

export default router
