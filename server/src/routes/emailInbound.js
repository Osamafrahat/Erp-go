// Inbound support-mail relay.
//
// Resend receives mail sent to support@dukkanza.com (custom-domain MX) and
// posts a signed `email.received` webhook here; we forward the stored message
// to the owner's real mailbox with Resend's native receiving.forward (keeps
// subject, body and attachments — `Fwd:` prefixed).
//
// Mounted in index.js BEFORE express.json: Svix verification hashes the exact
// raw bytes of the request body, so this route parses the body itself with
// express.raw.
import express from 'express'
import { Resend } from 'resend'
import { senderFor } from '../services/emailService.js'

const router = express.Router()

// Svix retries reuse the same message id; remembering recent ids (single
// process, bounded) keeps a retried delivery from forwarding twice. Only
// successful forwards are remembered, so a failed forward can be retried.
const seenIds = new Set()

function senderAddress(rawFrom) {
  const value = String(rawFrom || '')
  const match = value.match(/<([^>]+)>/)
  return (match ? match[1] : value).trim().toLowerCase()
}

router.post('/', express.raw({ type: '*/*', limit: '5mb' }), async (req, res) => {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET
    const apiKey = process.env.RESEND_API_KEY
    if (!secret || !apiKey) return res.status(503).json({ error: 'inbound relay not configured' })

    const resend = new Resend(apiKey)
    let event
    try {
      event = resend.webhooks.verify({
        webhookSecret: secret,
        payload: Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body ?? ''),
        headers: {
          id: req.headers['svix-id'],
          timestamp: req.headers['svix-timestamp'],
          signature: req.headers['svix-signature'],
        },
      })
    } catch {
      return res.status(401).json({ error: 'invalid signature' })
    }
    if (typeof event === 'string') {
      try { event = JSON.parse(event) } catch { /* leave as-is; type check below rejects */ }
    }

    if (!event || event.type !== 'email.received') {
      return res.json({ ok: true, skipped: event?.type || 'unknown-event' })
    }

    const svixId = req.headers['svix-id']
    if (svixId) {
      if (seenIds.has(svixId)) return res.json({ ok: true, duplicate: true })
      if (seenIds.size > 5000) seenIds.clear()
    }

    const forwardTo = process.env.INBOUND_FORWARD_TO
    if (!forwardTo) return res.status(503).json({ error: 'forward target not configured' })

    // Loop guard: mail that originated from the owner's mailbox or from the
    // relay sender itself must never be re-forwarded (their replies to a
    // Fwd: copy would otherwise bounce back at them).
    const from = senderAddress(event.data?.from)
    const relaySender = senderAddress(senderFor('support'))
    if (!from || from === senderAddress(forwardTo) || from === relaySender) {
      return res.json({ ok: true, skipped: 'loop-guard' })
    }
    if (!event.data?.email_id) return res.json({ ok: true, skipped: 'no-email-id' })

    const { error } = await resend.emails.receiving.forward({
      emailId: event.data.email_id,
      to: forwardTo,
      from: senderFor('support'),
      passthrough: false,
    })
    if (error) {
      console.error('[INBOUND] forward failed:', error.message)
      return res.status(500).json({ error: 'forward failed' })
    }
    if (svixId) seenIds.add(svixId)
    console.log('[INBOUND] forwarded', event.data.email_id, '->', forwardTo)
    res.json({ ok: true, forwarded: event.data.email_id })
  } catch (err) {
    console.error('[INBOUND] handler error:', err)
    res.status(500).json({ error: 'inbound processing failed' })
  }
})

export default router
