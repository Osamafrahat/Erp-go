import { Router } from 'express'
import supabase from '../db/supabase.js'

const router = Router()

// Generate statement data for a customer
router.get('/customer/:customerId', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query
    const { customerId } = req.params

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('tenant_id', req.user?.tenantId)
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    // Fetch orders
    let ordersQuery = supabase
      .from('orders')
      .select('id, order_number, created_at, total, subtotal, discount_amount, tax_amount, payment_status, order_items(product_name, quantity, unit_price, discount, total)')
      .eq('tenant_id', req.user?.tenantId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    if (start_date) ordersQuery = ordersQuery.gte('created_at', start_date)
    if (end_date) ordersQuery = ordersQuery.lte('created_at', end_date)

    const { data: orders, error: ordersError } = await ordersQuery
    if (ordersError) throw ordersError

    // Fetch payments (payment_splits linked to this customer's orders)
    const orderIds = (orders || []).map(o => o.id)
    let payments = []
    if (orderIds.length > 0) {
      const { data: splits } = await supabase
        .from('payment_splits')
        .select('*')
        .in('order_id', orderIds)
        .order('created_at', { ascending: false })

      payments = (splits || []).map(p => ({
        id: p.id,
        date: p.created_at,
        amount: parseFloat(p.amount || 0),
        method: p.method,
        reference: p.reference,
        order_id: p.order_id,
      }))
    }

    // Fetch credit sales
    let creditQuery = supabase
      .from('credit_sales')
      .select('id, order_id, total_amount, paid_amount, remaining_amount, status, due_date, created_at')
      .eq('tenant_id', req.user?.tenantId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    if (start_date) creditQuery = creditQuery.gte('created_at', start_date)
    if (end_date) creditQuery = creditQuery.lte('created_at', end_date)

    const { data: creditSales, error: creditError } = await creditQuery
    if (creditError) throw creditError

    const ordersList = (orders || []).map(o => ({
      id: o.id,
      order_number: o.order_number,
      date: o.created_at,
      subtotal: parseFloat(o.subtotal || 0),
      discount: parseFloat(o.discount_amount || 0),
      tax: parseFloat(o.tax_amount || 0),
      total: parseFloat(o.total || 0),
      payment_status: o.payment_status,
      items: (o.order_items || []).map(oi => ({
        product_name: oi.product_name,
        quantity: oi.quantity,
        unit_price: parseFloat(oi.unit_price || 0),
        discount: parseFloat(oi.discount || 0),
        total: parseFloat(oi.total || 0),
      })),
    }))

    const totalOrders = ordersList.reduce((sum, o) => sum + o.total, 0)
    const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0)
    const totalCreditSales = (creditSales || []).reduce((sum, cs) => sum + parseFloat(cs.total_amount || 0), 0)
    const totalCreditPaid = (creditSales || []).reduce((sum, cs) => sum + parseFloat(cs.paid_amount || 0), 0)

    const outstandingBalance = customer.total_spent
      ? parseFloat(customer.total_spent || 0) - totalPayments
      : 0

    res.json({
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        loyalty_points: customer.loyalty_points || 0,
        total_spent: parseFloat(customer.total_spent || 0),
      },
      period: {
        start_date: start_date || null,
        end_date: end_date || null,
      },
      summary: {
        total_orders: ordersList.length,
        total_orders_amount: totalOrders,
        total_payments: totalPayments,
        total_credit_sales: totalCreditSales,
        total_credit_paid: totalCreditPaid,
        outstanding_balance: outstandingBalance,
      },
      orders: ordersList,
      payments,
      credit_sales: (creditSales || []).map(cs => ({
        id: cs.id,
        order_id: cs.order_id,
        total_amount: parseFloat(cs.total_amount || 0),
        paid_amount: parseFloat(cs.paid_amount || 0),
        remaining_amount: parseFloat(cs.remaining_amount || 0),
        status: cs.status,
        due_date: cs.due_date,
        date: cs.created_at,
      })),
      loyalty_points: customer.loyalty_points || 0,
    })
  } catch (err) {
    next(err)
  }
})

export default router
