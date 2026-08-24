import { Router } from 'express'
import supabase from '../db/supabase.js'

const router = Router()

// Get sales report
router.get('/sales', async (req, res, next) => {
  try {
    const { range = 'week' } = req.query

    // Calculate date range
    const now = new Date()
    let startDate

    switch (range) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7))
        break
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1))
        break
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1))
        break
      default:
        startDate = new Date(now.setDate(now.getDate() - 7))
    }

    // Get orders in range
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })

    if (ordersError) throw ordersError

    // Calculate stats
    const totalSales = orders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0)
    const totalOrders = orders.length
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0

    // Get order items for top products
    const orderIds = orders.map(o => o.id)
    let itemsSold = 0
    let topProducts = []

    if (orderIds.length > 0) {
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('*, products(name)')
        .in('order_id', orderIds)

      if (orderItems) {
        itemsSold = orderItems.reduce((sum, i) => sum + (i.quantity || 0), 0)

        // Group by product
        const productSales = {}
        orderItems.forEach(item => {
          const productId = item.product_id
          if (!productSales[productId]) {
            productSales[productId] = {
              id: productId,
              name: item.products?.name || 'Unknown',
              quantitySold: 0,
              revenue: 0
            }
          }
          productSales[productId].quantitySold += item.quantity
          productSales[productId].revenue += parseFloat(item.total) || 0
        })

        topProducts = Object.values(productSales)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10)
      }
    }

    // Daily sales for chart
    const dailySales = []
    const daysInRange = Math.ceil((new Date() - startDate) / (1000 * 60 * 60 * 24))
    for (let i = 0; i < Math.min(daysInRange, 30); i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      const dayOrders = orders.filter(o => o.created_at?.startsWith(dateStr))
      const dayTotal = dayOrders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0)
      dailySales.unshift({ date: dateStr, sales: dayTotal })
    }

    res.json({
      totalSales,
      totalOrders,
      avgOrderValue,
      itemsSold,
      topProducts,
      dailySales
    })
  } catch (err) {
    next(err)
  }
})

// Get stock report
router.get('/stock', async (req, res, next) => {
  try {
    // Get all products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*, categories(name)')
      .order('name')

    if (productsError) throw productsError

    const totalProducts = products.length
    const lowStockProducts = products.filter(p => p.stock_quantity <= (p.low_stock_threshold || 10))
    const lowStockCount = lowStockProducts.length
    const totalValue = products.reduce((sum, p) => sum + ((p.stock_quantity || 0) * (p.price || 0)), 0)
    const totalCost = products.reduce((sum, p) => sum + ((p.stock_quantity || 0) * (p.cost_price || 0)), 0)
    const potentialProfit = totalValue - totalCost

    // Category breakdown with cost
    const categoryMap = {}
    products.forEach(p => {
      const catName = p.categories?.name || 'Uncategorized'
      if (!categoryMap[catName]) {
        categoryMap[catName] = { name: catName, value: 0, cost: 0 }
      }
      categoryMap[catName].value += p.stock_quantity || 0
      categoryMap[catName].cost += (p.stock_quantity || 0) * (p.cost_price || 0)
    })

    // Top products by stock value
    const topByValue = products
      .map(p => ({
        id: p.id,
        name: p.name,
        stock: p.stock_quantity,
        costPrice: p.cost_price || 0,
        sellPrice: p.price || 0,
        totalCost: (p.stock_quantity || 0) * (p.cost_price || 0),
        totalValue: (p.stock_quantity || 0) * (p.price || 0),
      }))
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 10)

    res.json({
      totalProducts,
      lowStockCount,
      lowStockProducts,
      totalValue,
      totalCost,
      potentialProfit,
      categoryBreakdown: Object.values(categoryMap),
      topByValue
    })
  } catch (err) {
    next(err)
  }
})

// Get expenses summary
router.get('/expenses', async (req, res, next) => {
  try {
    const { range = 'month' } = req.query
    const now = new Date()
    let startDate

    switch (range) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7))
        break
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1))
        break
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1))
        break
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1))
    }

    const { data: expenses, error } = await supabase
      .from('expenses')
      .select('*')
      .gte('created_at', startDate.toISOString())

    if (error) throw error

    const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)

    const categoryMap = {}
    expenses.forEach(e => {
      const cat = e.category || 'Other'
      if (!categoryMap[cat]) categoryMap[cat] = { name: cat, total: 0 }
      categoryMap[cat].total += parseFloat(e.amount) || 0
    })

    const dailyExpenses = []
    const daysInRange = Math.ceil((new Date() - startDate) / (1000 * 60 * 60 * 24))
    for (let i = 0; i < Math.min(daysInRange, 30); i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      const dayTotal = expenses
        .filter(e => e.created_at?.startsWith(dateStr))
        .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
      dailyExpenses.unshift({ date: dateStr, expenses: dayTotal })
    }

    res.json({
      totalExpenses,
      expenseCount: expenses.length,
      categoryBreakdown: Object.values(categoryMap).sort((a, b) => b.total - a.total),
      dailyExpenses
    })
  } catch (err) {
    next(err)
  }
})

// Get profit/loss summary
router.get('/profit-loss', async (req, res, next) => {
  try {
    const { range = 'month' } = req.query
    const now = new Date()
    let startDate

    switch (range) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7))
        break
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1))
        break
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1))
        break
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1))
    }

    const [ordersRes, expensesRes, refundsRes] = await Promise.all([
      supabase.from('orders').select('total, created_at').gte('created_at', startDate.toISOString()),
      supabase.from('expenses').select('amount, created_at').gte('created_at', startDate.toISOString()),
      supabase.from('refunds').select('amount, created_at').gte('created_at', startDate.toISOString()),
    ])

    const orders = ordersRes.data || []
    const expenses = expensesRes.data || []
    const refunds = refundsRes.data || []

    const totalRevenue = orders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0)
    const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
    const totalRefunds = refunds.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
    const netRevenue = totalRevenue - totalRefunds
    const grossProfit = netRevenue - totalExpenses

    res.json({
      totalRevenue,
      totalExpenses,
      totalRefunds,
      netRevenue,
      grossProfit,
      orderCount: orders.length,
      expenseCount: expenses.length,
      refundCount: refunds.length,
      margin: netRevenue > 0 ? ((grossProfit / netRevenue) * 100).toFixed(1) : 0
    })
  } catch (err) {
    next(err)
  }
})

export default router
