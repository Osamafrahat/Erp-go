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
      beforeSend(event) {
        // Some browser extensions wrap navigator.serviceWorker.register in
        // their own frames (e.g. "wrsParams") and their promise rejections
        // land in our Sentry as "Error: Rejected" — extension failures are
        // not our failures. Only drop the event when the offending frame is
        // clearly not ours (our code never contains that identifier).
        const values = event.exception?.values || []
        const frames = values.flatMap((v) => v.stacktrace?.frames || [])
        if (frames.some((f) => `${f.function || ''}${f.filename || ''}`.includes('wrsParams'))) {
          return null
        }
        return event
      },
    })
    return true
  } catch (err) {
    console.error('[Sentry] Failed to initialise:', err)
    return false
  }
}

export { Sentry }
