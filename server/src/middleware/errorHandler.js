import { captureException } from '../services/sentry.js'
import { notifyOperatorOnce } from '../services/telegramNotify.js'

export function errorHandler(err, req, res, next) {
  console.error('Error:', err.message || err)

  // capture500Responses (mounted before the routes) watches for 5xx JSON
  // responses; flag this request so failures arriving via next(err) are
  // reported once — here, as the real exception, not the response wrapper.
  res.locals = res.locals || {}
  res.locals.sentryReported = true

  // Report only unexpected failures. 4xx responses are part of normal
  // operation, and reporting them would bury real faults in noise.
  const reportedStatus = err.statusCode || 500
  if (reportedStatus >= 500) {
    captureException(err, {
      method: req.method,
      path: req.originalUrl,
      status: reportedStatus,
      tenantId: req.user?.tenantId,
      userId: req.user?.id,
    })

    // Telegram alert for failures arriving via next(err) - capture500's
    // res.json wrapper is skipped here because the flag above is already
    // set, so this hook and that one together report each failure once
    // (shared dedupe key). SECURITY: query string stripped before the
    // path reaches the message (URLs may carry tokens/PII); the detail is
    // the server-side error text only - headers and bodies never leave.
    const pathOnly = (req.originalUrl || '/').split('?')[0]
    notifyOperatorOnce({
      key: `5xx ${req.method} ${pathOnly} ${reportedStatus}`,
      cooldownSec: 3600,
      emoji: '\u{1F525}',
      title: `Server error (${reportedStatus})`,
      lines: [`${req.method} ${pathOnly}`, String(err.message || err)],
      link: false,
    }).catch(() => {})
  }

  // CORS errors — return 403, not 500
  if (err.message === 'Not allowed by CORS' || err.message === 'CORS not configured' || err.name === 'CORSError') {
    return res.status(403).json({ error: 'Origin not allowed by CORS policy' })
  }

  const isProduction = process.env.NODE_ENV === 'production'

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' })
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' })
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large' })
  }

  // PostgreSQL unique constraint violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Resource already exists' })
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Related resource not found' })
  }

  // PostgreSQL not null violation
  if (err.code === '23502') {
    return res.status(400).json({ error: 'Required field is missing' })
  }

  // PostgreSQL invalid input syntax
  if (err.code === '22P02') {
    return res.status(400).json({ error: 'Invalid input format' })
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' })
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' })
  }

  const statusCode = err.statusCode || 500
  const message = isProduction ? 'Internal server error' : (err.message || 'Internal server error')

  res.status(statusCode).json({ 
    error: message
  })
}
