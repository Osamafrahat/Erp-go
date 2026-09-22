import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { errorHandler } from '../middleware/errorHandler.js'

describe('errorHandler', () => {
  let req, res, next

  beforeEach(() => {
    req = {}
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }
    next = jest.fn()
    process.env.NODE_ENV = 'test'
  })

  it('returns 403 for CORS errors', () => {
    const err = new Error('Not allowed by CORS')
    errorHandler(err, req, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: 'Origin not allowed by CORS policy' })
  })

  it('returns 400 for invalid JSON', () => {
    const err = { type: 'entity.parse.failed' }
    errorHandler(err, req, res, next)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid JSON' })
  })

  it('returns 413 for body too large', () => {
    const err = { type: 'entity.too.large' }
    errorHandler(err, req, res, next)
    expect(res.status).toHaveBeenCalledWith(413)
    expect(res.json).toHaveBeenCalledWith({ error: 'Request body too large' })
  })

  it('returns 413 for file too large', () => {
    const err = { code: 'LIMIT_FILE_SIZE' }
    errorHandler(err, req, res, next)
    expect(res.status).toHaveBeenCalledWith(413)
    expect(res.json).toHaveBeenCalledWith({ error: 'File too large' })
  })

  it('returns 409 for unique constraint violation', () => {
    const err = { code: '23505' }
    errorHandler(err, req, res, next)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith({ error: 'Resource already exists' })
  })

  it('returns 400 for foreign key violation', () => {
    const err = { code: '23503' }
    errorHandler(err, req, res, next)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Related resource not found' })
  })

  it('returns 400 for not null violation', () => {
    const err = { code: '23502' }
    errorHandler(err, req, res, next)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Required field is missing' })
  })

  it('returns 400 for invalid input syntax', () => {
    const err = { code: '22P02' }
    errorHandler(err, req, res, next)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid input format' })
  })

  it('returns 401 for invalid JWT', () => {
    const err = { name: 'JsonWebTokenError' }
    errorHandler(err, req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' })
  })

  it('returns 401 for expired JWT', () => {
    const err = { name: 'TokenExpiredError' }
    errorHandler(err, req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Token expired' })
  })

  it('returns 500 for unknown errors', () => {
    const err = { message: 'Something broke', statusCode: 500 }
    errorHandler(err, req, res, next)
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('hides error message in production', () => {
    process.env.NODE_ENV = 'production'
    const err = { message: 'Secret error', statusCode: 500 }
    errorHandler(err, req, res, next)
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
  })
})
