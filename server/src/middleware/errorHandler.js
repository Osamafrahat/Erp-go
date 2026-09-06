export function errorHandler(err, req, res, next) {
  console.error('Error:', err.message || err)

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
