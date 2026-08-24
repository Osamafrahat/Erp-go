import { Resend } from 'resend'

let resendClient = null

function getResendClient() {
  if (!resendClient && process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

export async function sendEmail({ to, subject, html }) {
  const client = getResendClient()
  if (!client) throw new Error('RESEND_API_KEY not configured')

  const from = process.env.SMTP_FROM || 'onboarding@resend.dev'
  const { data, error } = await client.emails.send({ from, to, subject, html })
  if (error) throw new Error(error.message)
  console.log('[EMAIL] Sent:', data?.id)
  return data
}

export async function sendPromotionEmail({ recipients, promotion, storeName }) {
  const client = getResendClient()
  if (!client) throw new Error('RESEND_API_KEY not configured')

  const discountText = promotion.type === 'percentage'
    ? `${promotion.value}%`
    : `${promotion.value} ج.م`

  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .promo-box { background: #f8f9fa; border: 2px dashed #667eea; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }
        .promo-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 3px; font-family: monospace; }
        .discount { font-size: 24px; color: #28a745; font-weight: bold; margin: 15px 0; }
        .details { color: #666; font-size: 14px; line-height: 1.8; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #999; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 عرض خاص من ${storeName}</h1>
        </div>
        <div class="content">
          <p>عزيزي العميل،</p>
          <p>يسعدنا تقديم لكم عرض خاص حصري!</p>
          <div class="promo-box">
            <div class="discount">خصم ${discountText}</div>
            <p>استخدم كود الخصم:</p>
            <div class="promo-code">${promotion.code}</div>
          </div>
          <div class="details">
            ${promotion.min_order_amount ? `<p>📌 الحد الأدنى للطلب: ${promotion.min_order_amount} ج.م</p>` : ''}
            <p>📅 صالح حتى: ${new Date(promotion.end_date).toLocaleDateString('ar-EG')}</p>
            ${promotion.max_uses ? `<p>⏳ عدد الاستخدامات المتبقية: ${promotion.max_uses - (promotion.used_count || 0)}</p>` : ''}
          </div>
          <p style="margin-top: 20px;">سارع بالاستفادة من العرض قبل انتهائه!</p>
        </div>
        <div class="footer">
          <p>${storeName} | جميع الحقوق محفوظة © ${new Date().getFullYear()}</p>
        </div>
      </div>
    </body>
    </html>
  `

  const from = process.env.SMTP_FROM || 'onboarding@resend.dev'
  const results = []

  for (const recipient of recipients) {
    try {
      const { data, error } = await client.emails.send({
        from,
        to: recipient.email,
        subject: `🎉 عرض خاص: خصم ${discountText} - ${storeName}`,
        html: htmlContent,
      })
      if (error) throw new Error(error.message)
      results.push({ email: recipient.email, success: true, messageId: data?.id })
      console.log(`[EMAIL] Sent to ${recipient.email}: ${data?.id}`)
    } catch (err) {
      results.push({ email: recipient.email, success: false, error: err.message })
      console.error(`[EMAIL] Failed to ${recipient.email}:`, err.message)
    }
  }

  return results
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function sendCustomEmail({ recipients, subject, message, storeName }) {
  const client = getResendClient()
  if (!client) throw new Error('RESEND_API_KEY not configured')

  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; color: #333; line-height: 1.8; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #999; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><h1>${escapeHtml(subject)}</h1></div>
        <div class="content"><p>${escapeHtml(message)}</p></div>
        <div class="footer"><p>${storeName} | جميع الحقوق محفوظة © ${new Date().getFullYear()}</p></div>
      </div>
    </body>
    </html>
  `

  const from = process.env.SMTP_FROM || 'onboarding@resend.dev'
  const results = []

  for (const recipient of recipients) {
    try {
      const { data, error } = await client.emails.send({
        from,
        to: recipient.email,
        subject,
        html: htmlContent,
      })
      if (error) throw new Error(error.message)
      results.push({ email: recipient.email, success: true })
    } catch (err) {
      results.push({ email: recipient.email, success: false, error: err.message })
    }
  }

  return results
}
