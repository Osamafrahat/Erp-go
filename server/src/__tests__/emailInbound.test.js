// emailInbound — support-mail relay webhook.
//
// The router is mounted standalone on a bare express app and driven with
// supertest; the Resend SDK is module-mocked so Svix verification and the
// native receiving.forward call are under test control.

import { jest } from '@jest/globals'
import request from 'supertest'
import express from 'express'

const verifySpy = jest.fn()
const forwardSpy = jest.fn()

jest.unstable_mockModule('resend', () => ({
  Resend: jest.fn(() => ({
    webhooks: { verify: verifySpy },
    emails: { receiving: { forward: forwardSpy } },
  })),
}))

const { default: inboundRouter } = await import('../routes/emailInbound.js')

const TRACKED = ['RESEND_API_KEY', 'RESEND_WEBHOOK_SECRET', 'INBOUND_FORWARD_TO', 'MAIL_FROM_SUPPORT', 'SMTP_FROM']
let saved

beforeAll(() => {
  saved = Object.fromEntries(TRACKED.map((k) => [k, process.env[k]]))
})

afterEach(() => {
  for (const k of TRACKED) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
  verifySpy.mockReset()
  forwardSpy.mockReset()
})

function configure() {
  process.env.RESEND_API_KEY = 're_test_key'
  process.env.RESEND_WEBHOOK_SECRET = 'whsec_test'
  process.env.INBOUND_FORWARD_TO = 'owner@example.com'
  // production shape: senderFor derives support@ from the SMTP_FROM domain
  process.env.SMTP_FROM = 'orders@dukkanza.com'
}

const app = express()
app.use('/api/email/inbound', inboundRouter)

const BODY = JSON.stringify({
  type: 'email.received',
  data: { email_id: 'em_1', from: 'Customer <c@x.com>', to: ['support@dukkanza.com'], subject: 'hi' },
})

function post({ svixId = 'msg_a', body = BODY } = {}) {
  return request(app)
    .post('/api/email/inbound')
    .set('Content-Type', 'application/json')
    .set('svix-id', svixId)
    .set('svix-timestamp', '1700000000')
    .set('svix-signature', 'v1,fake')
    .send(body)
}

const HAPPY_EVENT = {
  type: 'email.received',
  data: { email_id: 'em_1', from: 'Customer <c@x.com>', to: ['support@dukkanza.com'], subject: 'hi' },
}

describe('POST /api/email/inbound', () => {
  test('rejects payloads failing signature verification', async () => {
    configure()
    verifySpy.mockImplementation(() => { throw new Error('bad signature') })
    const res = await post()
    expect(res.status).toBe(401)
    expect(forwardSpy).not.toHaveBeenCalled()
  })

  test('forwards a verified email.received event to the owner mailbox', async () => {
    configure()
    verifySpy.mockReturnValue(HAPPY_EVENT)
    forwardSpy.mockResolvedValue({ data: { id: 'fwd_1' }, error: null })
    const res = await post({ svixId: 'msg_happy' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(forwardSpy).toHaveBeenCalledWith({
      emailId: 'em_1',
      to: 'owner@example.com',
      from: 'support@dukkanza.com',
      passthrough: false,
    })
  })

  test('loop guard skips mail originating from the owner mailbox', async () => {
    configure()
    verifySpy.mockReturnValue({ type: 'email.received', data: { email_id: 'em_2', from: 'Owner <OWNER@example.com>' } })
    const res = await post({ svixId: 'msg_loop' })
    expect(res.status).toBe(200)
    expect(res.body.skipped).toBe('loop-guard')
    expect(forwardSpy).not.toHaveBeenCalled()
  })

  test('loop guard skips mail originating from the relay sender itself', async () => {
    configure()
    verifySpy.mockReturnValue({ type: 'email.received', data: { email_id: 'em_3', from: 'Dukkanza <support@dukkanza.com>' } })
    const res = await post({ svixId: 'msg_loop2' })
    expect(res.body.skipped).toBe('loop-guard')
    expect(forwardSpy).not.toHaveBeenCalled()
  })

  test('ignores event types other than email.received', async () => {
    configure()
    verifySpy.mockReturnValue({ type: 'email.bounced', data: {} })
    const res = await post({ svixId: 'msg_other' })
    expect(res.status).toBe(200)
    expect(res.body.skipped).toBe('email.bounced')
    expect(forwardSpy).not.toHaveBeenCalled()
  })

  test('deduplicates retried deliveries by svix-id', async () => {
    configure()
    verifySpy.mockReturnValue(HAPPY_EVENT)
    forwardSpy.mockResolvedValue({ data: { id: 'fwd_2' }, error: null })
    const first = await post({ svixId: 'msg_dupe' })
    const second = await post({ svixId: 'msg_dupe' })
    expect(first.body.ok).toBe(true)
    expect(second.body.duplicate).toBe(true)
    expect(forwardSpy).toHaveBeenCalledTimes(1)
  })

  test('503 until the webhook secret is configured', async () => {
    configure()
    delete process.env.RESEND_WEBHOOK_SECRET
    const res = await post({ svixId: 'msg_nosecret' })
    expect(res.status).toBe(503)
    expect(verifySpy).not.toHaveBeenCalled()
  })

  test('503 until a forward target is configured', async () => {
    configure()
    delete process.env.INBOUND_FORWARD_TO
    verifySpy.mockReturnValue(HAPPY_EVENT)
    const res = await post({ svixId: 'msg_notarget' })
    expect(res.status).toBe(503)
    expect(forwardSpy).not.toHaveBeenCalled()
  })

  test('returns 500 when the forward fails so Svix retries', async () => {
    configure()
    verifySpy.mockReturnValue(HAPPY_EVENT)
    forwardSpy.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const res = await post({ svixId: 'msg_fail' })
    expect(res.status).toBe(500)
    // a failed forward must NOT be marked seen — the retry has to re-attempt
    const retry = await post({ svixId: 'msg_fail' })
    expect(retry.status).toBe(500)
    expect(forwardSpy).toHaveBeenCalledTimes(2)
  })
})
