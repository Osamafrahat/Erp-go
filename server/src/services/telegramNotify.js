import { getWalletMethods } from './walletPaymentUtils.js'

// Best-effort Telegram push to the platform operator.
//
// Contract (mirrors lifecycleEmails): callers must treat failure as
// non-fatal - nothing here ever rejects, blocks, or throws, and every hook
// site fires and forgets. Credentials come from Fly secrets
// (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID); unset = disabled: one boot
// line, every call a no-op, nothing else changes.
//
// SECURITY PROPERTIES (do not weaken these):
// - notifyOperator escapes EVERY caller-supplied string centrally (title,
//   lines, emoji), so no hook can accidentally pass HTML/tenant-controlled
//   text through to Telegram as markup. Dynamic content is always inert.
// - Per-line (250 chars) and per-message (4000 chars) caps are applied
//   BEFORE any escaping, so entities can never be cut in half; the total
//   stays under Telegram's 4096 limit.
// - notifyOperatorOnce dedupes by key with a bounded in-memory map
//   (sweeps expired entries at 200, hard-stops claiming at 1000) so an
//   attacker forging webhook ids cannot grow memory without limit.
// - sendTelegramMessage applies a global 20-messages/minute cap (matches
//   Telegram's per-chat limit), so no flood path can amplify into an
//   outbound request storm.
// - supabase is imported lazily (inside notifyWalletTransfer) so this
//   module - including the error-alert path - loads even when the DB
//   client is the thing that is broken.

const TIMEOUT_MS = 8000
const PANEL_URL = 'https://dukkanza.com/super-admin'
const MAX_LINE_CHARS = 250
const MAX_MESSAGE_CHARS = 4000
const MAX_SEND_PER_MINUTE = 20

function creds() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  return token && chatId ? { token, chatId } : null
}

console.log(
  creds()
    ? '[Telegram] operator push enabled (TELEGRAM_BOT_TOKEN set)'
    : '[Telegram] disabled - set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to enable push'
)

// Telegram HTML parse mode accepts only a handful of entities; escaping
// &, < and > is sufficient to neutralize any tag a dynamic string could
// try to smuggle in (quotes need no escaping in text nodes).
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Truncate raw text (before escaping, so entities stay intact).
function clip(value) {
  const s = String(value ?? '')
  return s.length > MAX_LINE_CHARS ? `${s.slice(0, MAX_LINE_CHARS)}...` : s
}

let sendWindowStart = 0
let sendWindowCount = 0

// Test-only: clears the rate window and the dedupe registry. Exported so
// suites do not steal each other's 20/min budget; has no effect outside
// tests and exposes nothing over HTTP.
export function __resetTelegramForTests() {
  sendWindowStart = 0
  sendWindowCount = 0
  recentSends.clear()
}

async function sendTelegramMessage(text) {
  const cfg = creds()
  if (!cfg || !text) return

  // Global outbound cap: Telegram allows ~20 messages/minute per chat;
  // dropping here beats hammering the API into429s (which would also
  // swallow later, legitimate alerts).
  const now = Date.now()
  if (now - sendWindowStart > 60000) {
    sendWindowStart = now
    sendWindowCount = 0
  }
  if (sendWindowCount >= MAX_SEND_PER_MINUTE) {
    console.error('[Telegram] rate cap hit (20/min) - message dropped')
    return
  }
  sendWindowCount += 1

  try {
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

/**
 * Generic operator alert. Every caller-supplied string (emoji, title,
 * lines) is escaped and clipped here - callers pass plain text only, never
 * HTML. `link` appends the fixed super-admin panel link (a constant, never
 * caller-supplied, so no hook can inject a URL).
 */
export async function notifyOperator({ emoji = '\u{1F514}', title = '', lines = [], link = true } = {}) {
  try {
    const linkText = link ? `\n\n<a href="${PANEL_URL}">Open super admin panel</a>` : ''
    let text = `${escapeHtml(clip(emoji))} <b>${escapeHtml(clip(title))}</b>`
    for (let i = 0; i < lines.length; i += 1) {
      const line = `• ${escapeHtml(clip(lines[i]))}`
      if (text.length + 1 + line.length + linkText.length + 32 > MAX_MESSAGE_CHARS) {
        text += `\n• ... (+${lines.length - i} more)`
        break
      }
      text += `\n${line}`
    }
    text += linkText
    await sendTelegramMessage(text)
  } catch (err) {
    console.error('[Telegram] notify failed:', err.message)
  }
}

// Dedupe registry for notifyOperatorOnce. Bounded on purpose: expired
// entries are swept once the map reaches 200, and claiming stops entirely
// at 1000 live entries (fail-closed on memory) - a forged-key flood can
// suppress alerts for a cooldown window but can never grow the process.
const recentSends = new Map()

function claimSend(key, cooldownSec) {
  const now = Date.now()
  if (recentSends.size >= 200) {
    for (const [k, expiresAt] of recentSends) {
      if (expiresAt <= now) recentSends.delete(k)
    }
  }
  if (recentSends.size >= 1000) return false
  const expiresAt = recentSends.get(key)
  if (expiresAt !== undefined && expiresAt > now) return false
  recentSends.set(key, now + cooldownSec * 1000)
  return true
}

/**
 * notifyOperator with a per-key cooldown: same key within `cooldownSec`
 * sends at most once. Use for events that can be re-delivered (webhook
 * retries, hourly job re-runs) or looped (a hot failing endpoint).
 * `key` must be built from bounded, non-user-generated segments where
 * possible; it is never rendered into the message.
 */
export async function notifyOperatorOnce({ key, cooldownSec = 3600, ...msg } = {}) {
  try {
    if (!creds()) return
    if (typeof key !== 'string' || key.length === 0 || key.length > 500) return
    if (!claimSend(key, cooldownSec)) return
    await notifyOperator(msg)
  } catch (err) {
    console.error('[Telegram] notify failed:', err.message)
  }
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
    if (!creds()) return

    // Lazy import: the alert plumbing must not depend on the DB client
    // loading (see module header).
    const { default: supabase } = await import('../db/supabase.js')

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
      `Store: <b>${escapeHtml(clip(storeName))}</b>`,
      `Plan: <b>${escapeHtml(clip(planSlug))}</b> (${escapeHtml(clip(billingPeriod))})`,
      `Amount: <b>${escapeHtml(clip(amountEgp))} EGP</b>`,
      `Wallet: ${escapeHtml(clip(walletName))}`,
      `Ref: ${escapeHtml(clip(referenceNote || '-'))}`,
      `Code: <code>${escapeHtml(clip(paymentCode))}</code>`,
      '',
      `<a href="${PANEL_URL}">Open super admin panel</a>`,
    ].join('\n')

    await sendTelegramMessage(text)
  } catch (err) {
    console.error('[Telegram] notify failed:', err.message)
  }
}
