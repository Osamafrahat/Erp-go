import { useState, useCallback } from 'react'
import { useAppStore } from '../../stores/appStore'
import { emailApi } from '../../lib/api'
import { AlertCircle, Check, CheckCircle, ClipboardCopy, Loader2, Mail, MessageCircle, Send, X } from 'lucide-react'

// Send a purchase order to its supplier by email and/or WhatsApp.
// The server composes the message (order details + store name/location/phone)
// so both channels carry identical content; email is delivered via Resend and
// WhatsApp returns a wa.me link we open in a new tab.
export default function SendPOModal({ po, onClose, onSent }) {
  const { t } = useAppStore()
  const [method, setMethod] = useState('both')
  const [isSending, setIsSending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  const supplier = po?.suppliers || {}

  const doEmail = method === 'email' || method === 'both'
  const doWhatsApp = method === 'whatsapp' || method === 'both'

  const handleSend = useCallback(async () => {
    if (isSending) return
    setIsSending(true)
    setError(null)
    try {
      const res = await emailApi.sendPurchaseOrder(po.id, {
        send_email: doEmail,
        send_whatsapp: doWhatsApp,
      })
      const data = res.data || {}
      setResult(data)

      // Open the WhatsApp thread (wa.me link) in a new tab.
      const waLink = data.results?.whatsapp?.find((r) => r.success)?.link
      if (waLink) window.open(waLink, '_blank', 'noopener')

      onSent?.()
    } catch (err) {
      console.error('[SendPO] error:', err)
      setError(err.response?.data?.error || err.message || t('purchaseOrders.sendFailed'))
    } finally {
      setIsSending(false)
    }
  }, [po.id, doEmail, doWhatsApp, isSending, onSent, t])

  // Copy the exact message the server composed so it can be pasted into any
  // channel manually. Falls back to a hidden textarea when the async
  // clipboard API is unavailable (e.g. non-secure origins).
  const copyMessage = useCallback(async () => {
    const text = result?.message || ''
    if (!text) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('[SendPO] copy failed:', err)
    }
  }, [result])

  if (result) {
    const emailRes = result.results?.email?.[0]
    const waRes = result.results?.whatsapp?.[0]
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" />
              {t('purchaseOrders.sentTo') || 'Sent to supplier'}
            </h3>
            <button onClick={onClose} className="text-muted hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          <p className="text-sm text-muted">{result.supplier?.name}</p>

          <div className="space-y-2">
            {doEmail && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted" />
                {emailRes?.success ? (
                  <span className="text-success">
                    {t('purchaseOrders.emailSent') || 'Email sent'} ({emailRes.email})
                  </span>
                ) : (
                  <span className="text-warning">
                    {emailRes?.reason === 'no_supplier_email'
                      ? (t('purchaseOrders.noSupplierEmail') || 'Supplier has no email address')
                      : emailRes?.reason === 'email_not_configured'
                        ? (t('purchaseOrders.emailNotConfigured') || 'Email is not configured')
                        : (emailRes?.error || t('purchaseOrders.emailFailed') || 'Email failed to send')}
                  </span>
                )}
              </div>
            )}
            {doWhatsApp && (
              <div className="flex items-center gap-2 text-sm">
                <MessageCircle className="h-4 w-4 text-muted" />
                {waRes?.success ? (
                  <span className="text-success">{t('purchaseOrders.whatsappOpened') || 'WhatsApp opened'}</span>
                ) : (
                  <span className="text-warning">
                    {waRes?.reason === 'no_supplier_phone'
                      ? (t('purchaseOrders.noSupplierPhone') || 'Supplier has no phone number')
                      : (waRes?.error || t('purchaseOrders.whatsappFailed') || 'WhatsApp failed')}
                  </span>
                )}
              </div>
            )}
          </div>

          {result.message && (
            <button
              onClick={copyMessage}
              className="w-full px-4 py-2.5 bg-surface-hover border border-border rounded-xl font-medium text-foreground hover:bg-surface-secondary transition-colors flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-success" />
                  {t('purchaseOrders.copied') || 'Copied'}
                </>
              ) : (
                <>
                  <ClipboardCopy className="h-4 w-4" />
                  {t('purchaseOrders.copyMessage') || 'Copy message'}
                </>
              )}
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-accent text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            {t('common.close') || 'Close'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Send className="h-5 w-5 text-accent" />
            {t('purchaseOrders.sendOrder') || 'Send Order'}
          </h3>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="text-sm text-muted">
          <p className="font-medium text-foreground">{po.order_number}</p>
          <p>{supplier.name}</p>
        </div>

        <div>
          <p className="text-sm font-medium text-foreground mb-2">
            {t('purchaseOrders.sendVia') || 'Send via'}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'email', icon: Mail, label: t('purchaseOrders.email') || 'Email' },
              { key: 'whatsapp', icon: MessageCircle, label: 'WhatsApp' },
              { key: 'both', icon: Send, label: t('purchaseOrders.both') || 'Both' },
            ].map((opt) => {
              const Icon = opt.icon
              const active = method === opt.key
              return (
                <button
                  key={opt.key}
                  onClick={() => setMethod(opt.key)}
                  className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border text-sm font-medium transition-colors ${
                    active
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-border bg-surface text-muted hover:bg-surface-hover'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        <p className="text-xs text-muted">
          {t('purchaseOrders.sendInfo') ||
            'The order details and your store name, location, and phone will be shared with the supplier.'}
        </p>

        {error && (
          <div className="flex items-center gap-2 text-sm text-danger">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSend}
            disabled={isSending}
            className="flex-1 px-4 py-2.5 bg-accent text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
          >
            {isSending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('common.send') || 'Send'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-surface-hover rounded-xl font-medium text-muted hover:text-foreground transition-colors"
          >
            {t('common.cancel') || 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}
