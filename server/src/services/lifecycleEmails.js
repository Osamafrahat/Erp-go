import supabase from '../db/supabase.js'
import { sendSubscriptionActivatedEmail } from './emailService.js'
import { notifyOperator } from './telegramNotify.js'

/**
 * Best-effort "your subscription is active" email to the tenant's first
 * active admin. Used by both activation paths (Paymob webhook and superadmin
 * wallet confirmation) so the wording stays identical. Callers must treat
 * failure as non-fatal — the activation itself already succeeded.
 */
export async function notifySubscriptionActivated(tenantId, planName, expiresAt) {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single()

  // Operator push: this function is the single choke point for BOTH
  // activation paths (Paymob webhook + superadmin wallet confirm), so one
  // hook here covers each. Deliberately BEFORE the admin-email guard below
  // (activation without a reachable admin still matters to the operator)
  // and deliberately NOT awaited - callers may await this function, and the
  // push must never extend or fail the activation notification path.
  notifyOperator({
    emoji: '\u{2705}',
    title: 'Subscription activated',
    lines: [
      `Store: ${tenant?.name || `#${tenantId}`}`,
      `Plan: ${planName}`,
      `Expires: ${String(expiresAt || '').slice(0, 10)}`,
    ],
  }).catch(() => {})

  const { data: admin } = await supabase
    .from('users')
    .select('email, full_name, username')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!admin?.email) return
  await sendSubscriptionActivatedEmail({
    to: admin.email,
    name: admin.full_name || admin.username,
    storeName: tenant?.name,
    planName,
    expiresAt,
  })
}
