import supabase from '../db/supabase.js'
import { getWalletMethods } from './walletPaymentUtils.js'

// Best-effort Telegram push to the platform operator: when a tenant submits
// a wallet transfer proof, the super admin gets a message without having to
// watch the panel. Mirrors the lifecycleEmails contract - callers must treat
// failure as non-fatal (the submission already succeeded by then), and the
// function never rejects.
//
// Credentials come from Fly secrets (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID).
// Unset = disabled: one boot line, every call a no-op, nothing else changes.

const TIMEOUT_MS = 8000
const PANEL_URL = 'https://dukkanza.com/super-admin'

function creds() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  return token && chatId ? { token, chatId } : null
}

console.log(
  creds()
    ? '[Telegram] wallet push enabled (TELEGRAM_BOT_TOKEN set)'
    : '[Telegram] disabled - set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to enable push'
)

// Telegram HTML parse mode accepts only a handful of entities; escape the
// dynamic parts (store names come from tenant input) before interpolation.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Notify the operator that a wallet transfer was submitted.
 * Resolves always; failures log to the server console only.
 */
export async function notifyWalletTransfer({
  tenantId,
  planSlug,
  billingPeriod,
  amountEgp,
  walletType,
  referenceNote,
  paymentCode,
}) {
  try {
    const cfg = creds()
    if (!cfg) return

    // Tenant name lookup (same pattern as lifecycleEmails); fall back to
    // the id so a lookup hiccup never blocks the message.
    let storeName = `#${tenantId}`
    try {
      const { data } = await supabase
        .from('tenants')
        .select('name')
        .eq('id', tenantId)
        .maybeSingle()
      if (data?.name) storeName = data.name
    } catch {
      // keep the id fallback
    }

    // Resolve the wallet type to its display name (methods are configured
    // through the WALLET_CONFIG secret; raw ids are a last resort).
    const cfgWallet = getWalletMethods()
    const method = (cfgWallet.methods || []).find((m) => m.id === walletType)
    const walletName = method ? method.name || method.name_ar || walletType : walletType

    const text = [
      '\u{1F514} <b>New wallet transfer submitted</b>',
      '',
      `Store: <b>${escapeHtml(storeName)}</b>`,
      `Plan: <b>${escapeHtml(planSlug)}</b> (${escapeHtml(billingPeriod)})`,
      `Amount: <b>${escapeHtml(amountEgp)} EGP</b>`,
      `Wallet: ${escapeHtml(walletName)}`,
      `Ref: ${escapeHtml(referenceNote || '-')}`,
      `Code: <code>${escapeHtml(paymentCode)}</code>`,
      '',
      `<a href="${PANEL_URL}">Open super admin panel</a>`,
    ].join('\n')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cfg.chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      })
      if (!res.ok) console.error(`[Telegram] sendMessage failed: HTTP ${res.status}`)
    } finally {
      clearTimeout(timer)
    }
  } catch (err) {
    console.error('[Telegram] notify failed:', err.message)
  }
}
