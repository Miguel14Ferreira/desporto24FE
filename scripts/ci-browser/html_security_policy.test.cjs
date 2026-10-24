const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const html = readFileSync(join(__dirname, '../../src/index.html'), 'utf8');

test('static index defines a minimal CSP before the base element', () => {
  const policy = '<meta http-equiv="Content-Security-Policy" content="object-src \'none\'; base-uri \'self\'">';
  const policyAt = html.indexOf(policy);
  const baseAt = html.indexOf('<base href="/">');
  assert.ok(policyAt > -1 && policyAt < baseAt, 'CSP must precede the base element');
  assert.ok(!html.includes("unsafe-inline") && !html.includes("unsafe-eval"));
});

test('static index limits referrers without blocking external login and map scripts', () => {
  assert.ok(html.includes('<meta name="referrer" content="strict-origin-when-cross-origin">'));
  // This intentionally does not attempt to emulate HTTP response headers;
  // frame-ancestors and HSTS MUST be configured at the Render edge.
  assert.ok(!html.includes('content="frame-ancestors'));
});
