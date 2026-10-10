import { captureException } from '../services/sentry.js'

/**
 * Reports every 5xx JSON response to Sentry, even when a route handled its
 * own failure without calling next(err).
 *
 * A large share of the routes respond `res.status(500).json({ error })`
 * straight from their catch blocks. Those failures never reach the error
 * handler, so error reporting missed them entirely — the majority of real
 * server faults were invisible to Sentry. This wraps res.json / res.send
 * near the top of the stack and captures the first 5xx response of each
 * request, tagged with enough context to find the failing route.
 *
 * The error handler marks res.locals.sentryReported before it responds, so
 * failures that DO travel via next(err) are reported exactly once — as the
 * real exception, not this synthetic response wrapper.
 */
export function capture500Responses(req, res, next) {
  const reportOnce = (body) => {
    if (res.statusCode < 500 || res.locals.sentryReported) return
    res.locals.sentryReported = true

    const detail = body && typeof body === 'object' ? body.error : undefined
    const err = new Error(
      `${req.method} ${req.originalUrl} responded ${res.statusCode}${detail ? `: ${detail}` : ''}`,
    )
    err.name = 'RouteError'
    err.statusCode = res.statusCode
    captureException(err, {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      detail,
      tenantId: req.user?.tenantId,
      userId: req.user?.id,
    })
  }

  const originalJson = res.json.bind(res)
  res.json = (body) => {
    reportOnce(body)
    return originalJson(body)
  }

  const originalSend = res.send.bind(res)
  res.send = (body) => {
    reportOnce(body)
    return originalSend(body)
  }

  next()
}
