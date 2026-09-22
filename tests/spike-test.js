// k6 Spike Test — sudden traffic burst
// Run: k6 run tests/spike-test.js

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001'
const errorRate = new Rate('errors')

export const options = {
  stages: [
    { duration: '10s', target: 5 },    // normal traffic
    { duration: '5s', target: 100 },   // SPIKE to 100 VUs
    { duration: '30s', target: 100 },  // stay at spike
    { duration: '5s', target: 5 },     // recover
    { duration: '30s', target: 5 },    // normal traffic again
  ],
  thresholds: {
    http_req_duration: ['p(99)<5000'],
    errors: ['rate<0.2'],
  },
}

export default function () {
  const res = http.get(`${BASE_URL}/api/health`)
  const ok = check(res, {
    'health status 200': (r) => r.status === 200,
    'response under 2s': (r) => r.timings.duration < 2000,
  })
  errorRate.add(!ok)
  sleep(0.5)
}
