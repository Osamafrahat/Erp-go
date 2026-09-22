// k6 Load Test Script for Erp-go API
// Install k6: https://k6.io/docs/getting-started/installation/
// Run: k6 run tests/load-test.js
// Run with options: k6 run --vus 10 --duration 30s tests/load-test.js

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001'
const LOGIN_USER = __ENV.LOGIN_USER || 'superadmin'
const LOGIN_PASS = __ENV.LOGIN_PASS || 'SuperAdmin123!'

const errorRate = new Rate('errors')
const loginDuration = new Trend('login_duration')
const apiDuration = new Trend('api_duration')

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // ramp up to 10 VUs
    { duration: '1m', target: 10 },     // stay at 10 VUs
    { duration: '30s', target: 20 },    // ramp up to 20 VUs
    { duration: '1m', target: 20 },     // stay at 20 VUs
    { duration: '30s', target: 0 },     // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    errors: ['rate<0.1'],
  },
}

function login() {
  const start = Date.now()
  const res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    username: LOGIN_USER,
    password: LOGIN_PASS,
  }), {
    headers: { 'Content-Type': 'application/json' },
  })
  loginDuration.add(Date.now() - start)

  const ok = check(res, {
    'login status 200': (r) => r.status === 200,
    'login has token': (r) => {
      try {
        const body = JSON.parse(r.body)
        return body.token !== undefined
      } catch { return false }
    },
  })
  errorRate.add(!ok)

  if (ok) {
    try {
      return JSON.parse(res.body).token
    } catch { return null }
  }
  return null
}

function apiGet(path, token) {
  const start = Date.now()
  const res = http.get(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  apiDuration.add(Date.now() - start)

  const ok = check(res, {
    [`${path} status 200`]: (r) => r.status === 200,
  })
  errorRate.add(!ok)
  return res
}

export default function () {
  // 1. Test public endpoints (no auth)
  const healthRes = http.get(`${BASE_URL}/api/health`)
  check(healthRes, {
    'health endpoint works': (r) => r.status === 200,
  })

  const bannerRes = http.get(`${BASE_URL}/api/banners`)
  check(bannerRes, {
    'banners endpoint works': (r) => r.status === 200,
  })

  // 2. Login
  const token = login()
  if (!token) return

  // 3. Hit protected endpoints
  const endpoints = [
    '/api/products',
    '/api/categories',
    '/api/orders',
    '/api/customers',
    '/api/employees',
    '/api/expenses',
    '/api/reports/dashboard',
    '/api/commissions',
    '/api/settings',
  ]

  // Randomly pick 3-5 endpoints per iteration
  const shuffled = endpoints.sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, Math.floor(Math.random() * 3) + 3)

  for (const ep of selected) {
    apiGet(ep, token)
    sleep(0.1)
  }

  sleep(1)
}

export function handleSummary(data) {
  return {
    'tests/load-test-results.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  }
}

function textSummary(data, opts) {
  const lines = []
  lines.push('=== Load Test Results ===')
  lines.push(`Total requests: ${data.metrics.http_reqs?.values?.count || 0}`)
  lines.push(`Avg response time: ${(data.metrics.http_req_duration?.values?.avg || 0).toFixed(0)}ms`)
  lines.push(`P95 response time: ${(data.metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(0)}ms`)
  lines.push(`Error rate: ${((data.metrics.errors?.values?.rate || 0) * 100).toFixed(2)}%`)
  return lines.join('\n')
}
