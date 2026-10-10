import * as Sentry from '@sentry/node'

let enabled = false

/**
 * Initialise server-side error reporting.
 *
 * A no-op unless SENTRY_DSN is set, so an unconfigured deployment never
 * ships events anywhere. Called first thing at startup so boot failures are
 * captured too.
 */
export function initSentry() {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) {
    console.log('[Sentry] SENTRY_DSN not set — error reporting disabled')
    return false
  }

  try {
    Sentry.init({
      dsn,
      // NODE_ENV is not set in the Fly image; without a fallback, every
      // production event would be mislabelled "development". SENTRY_ENV wins
      // if ever set explicitly, then NODE_ENV, then the Fly platform marker.
      environment:
        process.env.SENTRY_ENV ||
        process.env.NODE_ENV ||
        (process.env.FLY_APP_ID ? 'production' : 'development'),
      tracesSampleRate: 0,
      sendDefaultPii: false,
    })
    enabled = true
    console.log('[Sentry] Error reporting enabled')
    return true
  } catch (err) {
    console.error('[Sentry] Failed to initialise:', err)
    return false
  }
}

/**
 * Report an exception with optional context. Never throws: error reporting
 * must not be able to take down the response it is describing.
 */
export function captureException(err, context) {
  if (!enabled || !err) return
  try {
    Sentry.withScope(scope => {
      if (context) scope.setExtras(context)
      Sentry.captureException(err)
    })
  } catch {
    // Intentionally swallowed.
  }
}

/** Best-effort flush so in-flight events reach Sentry before shutdown. */
export async function flushSentry(timeout = 2000) {
  if (!enabled) return
  try {
    await Sentry.flush(timeout)
  } catch {
    // Intentionally swallowed.
  }
}
