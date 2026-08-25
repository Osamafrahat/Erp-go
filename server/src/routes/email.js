import { Router } from 'express'
import supabase from '../db/supabase.js'
import { sendPromotionEmail, sendCustomEmail } from '../services/emailService.js'
import { sendPromotionWhatsApp, sendCustomWhatsApp } from '../services/whatsappService.js'

const router = Router()

async function getStoreName(tenantId) {
  try {
    const { data } = await supabase
      .from('store_settings')
      .select('value')
      .eq('key', 'storeName')
      .eq('tenant_id', tenantId)
      .single()
    return data?.value || 'Store'
  } catch {
    return 'Store'
  }
}

async function processPromotionSend(promoId, { send_email, send_whatsapp, tenantId }) {
  console.log(`[BG] === Starting background send for promo_id: ${promoId} ===`)
  try {
    const { data: promo, error: promoError } = await supabase
      .from('promotions')
      .select('*')
      .eq('id', promoId)
      .eq('tenant_id', tenantId)
      .single()

    if (promoError || !promo) {
      console.error(`[BG] Promotion not found:`, promoError?.message)
      return
    }
    console.log(`[BG] Step 1 OK: promo=${promo.code}`)

    const storeName = await getStoreName(tenantId)
    const results = { email: [], whatsapp: [] }

    if (send_email) {
      const { data: emailCustomers, error: emailErr } = await supabase
        .from('customers')
        .select('id, name, email, phone')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .not('email', 'is', null)

      if (!emailErr && emailCustomers?.length > 0) {
        console.log(`[BG] Sending emails to ${emailCustomers.length} customers`)
        results.email = await sendPromotionEmail({
          recipients: emailCustomers,
          promotion: promo,
          storeName
        })
        console.log(`[BG] Emails done: ${results.email.filter(r => r.success).length}/${results.email.length} sent`)
      }
    }

    if (send_whatsapp) {
      const { data: whatsappCustomers, error: waErr } = await supabase
        .from('customers')
        .select('id, name, email, phone')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .not('phone', 'is', null)

      if (!waErr && whatsappCustomers?.length > 0) {
        results.whatsapp = await sendPromotionWhatsApp({
          recipients: whatsappCustomers,
          promotion: promo,
          storeName
        })
      }
    }

    const emailSuccess = results.email.filter(r => r.success).length
    const whatsappSuccess = results.whatsapp.filter(r => r.success).length
    console.log(`[BG] === COMPLETE: email=${emailSuccess}, whatsapp=${whatsappSuccess} ===`)
  } catch (err) {
    console.error(`[BG] FATAL ERROR:`, err.message)
  }
}

router.post('/promotion', (req, res) => {
  try {
    const { promotion_id, send_email, send_whatsapp } = req.body
    const numericId = Number(promotion_id)
    if (!numericId || numericId <= 0) {
      return res.status(400).json({ error: 'Invalid promotion ID' })
    }

    const emailConfigured = !!(process.env.RESEND_API_KEY || (process.env.SMTP_USER && process.env.SMTP_PASS))

    if (send_email && !emailConfigured) {
      return res.json({
        success: true,
        message: 'Email not configured',
        results: { email: [], emailSkipped: true, whatsapp: [] }
      })
    }

    if (!send_email && !send_whatsapp) {
      return res.json({ success: true, message: 'No channels selected', results: { email: [], whatsapp: [] } })
    }

    res.json({
      success: true,
      message: 'Sending in background',
      results: { email: [], whatsapp: [], processing: true }
    })

    processPromotionSend(numericId, {
      send_email: send_email && emailConfigured,
      send_whatsapp,
      tenantId: req.user?.tenantId
    }).catch(err => {
      console.error('[BG] Background send error:', err.message)
    })
  } catch (err) {
    console.error('[EMAIL] Promotion send FAILED:', err.message)
    res.status(500).json({ error: 'Failed to send promotion' })
  }
})

export default router
