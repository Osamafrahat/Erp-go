// The two rules that govern a cash box, kept in one place so the route and
// the test guarding them cannot drift apart:
//
//   * several cashiers may hold an open box at the same time — only the
//     requester's OWN open box can stop them opening one
//   * only the cashier who opened a box may close it

/**
 * Error to reject an open request with, or null to allow it.
 *
 * `ownOpenShift` must already be scoped to the requesting user; the route
 * queries tenant + user_id + status. Another cashier's box arriving here
 * would be a caller bug, not a lockout.
 */
export function openBlocker(ownOpenShift) {
  if (!ownOpenShift) return null
  return 'You already have an open cash box. Close it first.'
}

/**
 * Error to reject a close request with, or null to allow it.
 *
 * Beyond enforcing the rule this is what keeps the numbers honest: the close
 * route reconciles the drawer against the requester's own orders, so letting
 * a stranger close it would balance someone else's till under their name.
 */
export function closeBlocker(shift, userId) {
  if (shift?.user_id !== userId) {
    return 'Only the cashier who opened this cash box can close it'
  }
  return null
}
