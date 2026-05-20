/**
 * Phase 16 load smoke — run against staging:
 *   k6 run -e BASE_URL=https://api.staging.example -e TOKEN=<jwt> scripts/load-test/k6-smoke.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(99)<300'],
    http_req_failed: ['rate<0.01'],
  },
};

const base = __ENV.BASE_URL || 'http://localhost:4000';
const token = __ENV.TOKEN || '';

export default function () {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const health = http.get(`${base}/health`);
  check(health, { 'health ok': (r) => r.status === 200 });

  if (token) {
    const me = http.get(`${base}/auth/me`, { headers });
    check(me, { 'auth me ok': (r) => r.status === 200 });
  }

  sleep(1);
}
