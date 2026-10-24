const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const config = fs.readFileSync(path.join(__dirname, '../../default.conf.template'), 'utf8');

test('nginx sends fundamental security headers', () => {
  for (const header of [
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Referrer-Policy',
    'Content-Security-Policy',
  ]) {
    assert.ok(config.split('\n').some(line =>
      line.includes('add_header ' + header + ' ') && line.trim().endsWith('always;')
    ), header + ' missing always');
  }
  assert.ok(config.includes("frame-ancestors 'none'"));
  assert.ok(config.includes("object-src 'none'"));
  assert.ok(config.includes("base-uri 'self'"));
});

test('nginx prevents hidden-file exposure and stale SPA entrypoint', () => {
  assert.ok(config.includes('location ~ /\\.(?!well-known) {'));
  assert.match(config, /location\s+=\s+\/index\.html\s*\{\s*expires -1;/);
});

test('nginx retains backend proxy routes', () => {
  const upstream = 'proxy_pass ' + '$' + '{BACKEND_UPSTREAM};';
  assert.ok(config.includes('location /api/ {'));
  assert.ok(config.includes('location /media/ {'));
  assert.equal(config.split(upstream).length, 3);
});
