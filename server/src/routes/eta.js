import { Router } from 'express'
import supabase from '../db/supabase.js'
import {
  getEtaConfig,
  generateEtaUUID,
  buildReceiptDocument,
  generateQrCode,
  submitToEta,
  getDocumentStatus,
  authenticatePos,
} from '../services/etaService.js'

const router = Router()

// Test ETA connection
router.post('/test', async (req, res, next) => {
  try {
    const { data: settings } = await supabase.from('store_settings').select('*').limit(1).single()
    const config = getEtaConfig(settings)

    if (!config.clientId || !config.clientSecret) {
      return res.status(400).json({ error: 'ETA credentials not configured' })
    }

    const token = await authenticatePos(config)
    res.json({ success: true, message: 'ETA connection successful', tokenPreview: token.substring(0, 20) + '...' })
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error || err.message || 'ETA connection failed' })
  }
})

// Submit receipt to ETA
router.post('/submit', async (req, res, next) => {
  try {
    const { order_id } = req.body
    if (!order_id) return res.status(400).json({ error: 'order_id is required' })

    const { data: settings } = await supabase.from('store_settings').select('*').limit(1).single()
    const config = getEtaConfig(settings)

    if (!config.clientId || !config.clientSecret) {
      return res.status(400).json({ error: 'ETA credentials not configured' })
    }

    // Fetch order with items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(*, products(name, sku))')
      .eq('id', order_id)
      .single()

    if (orderError || !order) return res.status(404).json({ error: 'Order not found' })

    // Check if already submitted
    if (order.eta_uuid) {
      return res.json({
        alreadySubmitted: true,
        etaUUID: order.eta_uuid,
        etaStatus: order.eta_status,
      })
    }

    // Build receipt document
    const items = order.order_items?.map(oi => ({
      product: oi.products,
      name: oi.products?.name || oi.product_name,
      quantity: oi.quantity,
      unit_price: oi.unit_price,
      price: oi.unit_price,
    })) || []

    const receiptData = buildReceiptDocument(order, settings, items)
    const uuid = generateEtaUUID(receiptData)
    const qrContent = generateQrCode(receiptData, uuid, config)

    // Submit to ETA
    const result = await submitToEta(receiptData, uuid, config)

    // Update order with ETA info
    const updateData = {
      eta_uuid: result.etaUUID || uuid,
      eta_qr_code: qrContent,
      eta_status: result.rejectedDocuments?.length > 0 ? 'rejected' : 'submitted',
      eta_submitted_at: new Date().toISOString(),
    }

    await supabase.from('orders').update(updateData).eq('id', order_id)

    res.json({
      success: true,
      etaUUID: result.etaUUID || uuid,
      submissionUUID: result.submissionUUID,
      qrContent,
      status: updateData.eta_status,
      rejectedDocuments: result.rejectedDocuments,
    })
  } catch (err) {
    console.error('ETA submit error:', err.message)
    res.status(500).json({ error: err.response?.data?.error || err.message || 'Failed to submit to ETA' })
  }
})

// Check ETA document status
router.get('/status/:etaUUID', async (req, res, next) => {
  try {
    const { etaUUID } = req.params
    const { data: settings } = await supabase.from('store_settings').select('*').limit(1).single()
    const config = getEtaConfig(settings)

    const status = await getDocumentStatus(etaUUID, config)
    res.json(status)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Generate QR code for order
router.post('/qr', async (req, res, next) => {
  try {
    const { order_id } = req.body
    const { data: settings } = await supabase.from('store_settings').select('*').limit(1).single()
    const config = getEtaConfig(settings)

    const { data: order } = await supabase
      .from('orders')
      .select('*, order_items(*, products(name))')
      .eq('id', order_id)
      .single()

    if (!order) return res.status(404).json({ error: 'Order not found' })

    const items = order.order_items?.map(oi => ({
      product: oi.products,
      quantity: oi.quantity,
      unit_price: oi.unit_price,
    })) || []

    const receiptData = buildReceiptDocument(order, settings, items)
    const uuid = order.eta_uuid || generateEtaUUID(receiptData)
    const qrContent = generateQrCode(receiptData, uuid, config)

    // Save QR if not already saved
    if (!order.eta_qr_code) {
      await supabase.from('orders').update({ eta_qr_code: qrContent }).eq('id', order_id)
    }

    res.json({ qrContent, etaUUID: uuid })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
