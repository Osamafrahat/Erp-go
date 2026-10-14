import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import supabase from '../db/supabase.js'
import { sendPasswordResetEmail } from './emailService.js'

// Self-service password recovery. Tokens are 32 random bytes, stored only as
// a SHA-256 hash, single-use, and short-lived. Requesting a new token
// invalidates any previous one, so at most one token per user is live.

const TOKEN_TTL_MS = 30 * 60 * 1000

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function clientBaseUrl() {
  return (
    process.env.CLIENT_URL ||
    (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean)[0] ||
    'http://localhost:5173'
  )
}

/**
 * Looks the user up by email and, if an active account matches, issues a
 * single-use reset token and emails it. Always resolves { sent: true } on the
 * happy path for BOTH outcomes — callers must return an identical generic
 * response so this endpoint cannot be used to enumerate accounts. Email
 * delivery failure is logged but still reported as sent (the token exists;
 * a retry issues a fresh one).
 */
export async function issueResetToken(email) {
  // ilike with an exact (escaped) pattern: case-insensitive without letting
  // % or _ in the input act as wildcards.
  const exact = email.replace(/[\\%_]/g, (c) => '\\' + c)
  const { data: user } = await supabase
    .from('users')
    .select('id, email, full_name, username, is_active')
    .ilike('email', exact)
    .maybeSingle()

  if (!user || !user.is_active) return { sent: false }

  const token = crypto.randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString()

  // One outstanding token per user: drop the old, insert the new.
  await supabase.from('password_reset_tokens').delete().eq('user_id', user.id).is('used_at', null)
  const { error } = await supabase.from('password_reset_tokens').insert({
    user_id: user.id,
    token_hash: hashToken(token),
    expires_at: expiresAt,
  })
  if (error) {
    console.error('[PASSWORD_RESET] insert error:', error.message)
    return { sent: false }
  }

  const resetUrl = `${clientBaseUrl()}/reset-password?token=${token}`
  try {
    await sendPasswordResetEmail({ to: user.email, name: user.full_name || user.username, resetUrl })
  } catch (err) {
    // Delivery failure must not fail the request (and must not change the
    // response shape); the user can simply ask again.
    console.error('[PASSWORD_RESET] email failed:', err.message)
  }
  return { sent: true }
}

/**
 * Consumes a reset token: validates it, hashes the new password, updates the
 * user, kills every live session, and marks the token used. Returns
 * { ok: true } or { ok: false, reason } — reasons are safe to surface as a
 * single generic client message.
 */
export async function consumeResetToken(token, newPassword) {
  const { data: row, error } = await supabase
    .from('password_reset_tokens')
    .select('id, user_id, expires_at, used_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle()

  if (error || !row || row.used_at || new Date(row.expires_at) <= new Date()) {
    return { ok: false, reason: 'invalid_or_expired' }
  }

  const hashed = await bcrypt.hash(newPassword, 10)
  const now = new Date().toISOString()

  // Clearing session_token logs out every device; must_change_password is
  // cleared because the user just proved ownership by choosing a new one.
  const { error: userErr } = await supabase
    .from('users')
    .update({ password: hashed, session_token: null, must_change_password: false, updated_at: now })
    .eq('id', row.user_id)
  if (userErr) {
    console.error('[PASSWORD_RESET] user update error:', userErr.message)
    return { ok: false, reason: 'update_failed' }
  }

  await supabase.from('password_reset_tokens').update({ used_at: now }).eq('id', row.id)
  return { ok: true, userId: row.user_id }
}
