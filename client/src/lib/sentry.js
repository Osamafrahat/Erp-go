import * as Sentry from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN

/**
 * Initialise browser error reporting.
 *
 * Deliberately a no-op unless VITE_SENTRY_DSN is set at build time, so an
 * unconfigured deployment never ships events anywhere.
 */
export function initSentry() {
  if (!dsn) return false

  try {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      // Error-only. Tracing is opt-in later if it's ever wanted — a POS till
      // has no reason to sample every request by default.
      tracesSampleRate: 0,
      sendDefaultPii: false,
      ignoreErrors: [
        // Third-party browser extensions commonly leak into the console and
        // would otherwise drown out real failures.
        /ResizeObserver loop/,
        /Script error/,
      ],
    })
    return true
  } catch (err) {
    console.error('[Sentry] Failed to initialise:', err)
    return false
  }
}

export { Sentry }
