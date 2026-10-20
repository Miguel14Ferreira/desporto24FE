'use strict';
// Anonymous LIVE browser smoke only. Never submit forms, use QA secrets or
// send POST/PUT/PATCH/DELETE to production. No user records are logged.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const BASE = 'https://d24sports.com';
const API = 'https://api.d24sports.com';
const OUT = path.resolve('artifacts/live-guest');
fs.mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'pt-PT',
    serviceWorkers: 'block'
  });
  const page = await context.newPage();
  const errors = [];
  const blockedWrites = [];
  const checks = [];
  page.on('pageerror', e => errors.push(String(e.message).slice(0, 200)));

  await context.route('**/*', async route => {
    const req = route.request();
    const method = req.method();
    const url = new URL(req.url());
    const safe = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
    if (!safe) {
      blockedWrites.push(method + ' ' + url.pathname);
      if (url.origin === API) {
        return route.fulfill({
          status: url.pathname.includes('/auth/refresh') ? 401 : 200,
          contentType: 'application/json',
          headers: {
            'access-control-allow-origin': BASE,
            'access-control-allow-credentials': 'true',
            'access-control-allow-headers': '*'
          },
          body: JSON.stringify(url.pathname.includes('/auth/refresh')
            ? { message: 'Anonymous read-only QA' } : {})
        });
      }
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });

  async function inspect(relative, label) {
    const response = await page.goto(BASE + relative, {
      waitUntil: 'domcontentloaded', timeout: 45000
    });
    await page.locator('body').waitFor();
    await page.waitForTimeout(1200);
    const status = response?.status();
    const textLength = await page.locator('body').innerText()
      .then(s => s.trim().length).catch(() => 0);
    const title = await page.title();
    await page.screenshot({ path: path.join(OUT, label + '.png'),
      fullPage: true, timeout: 15000 });
    checks.push({ path: relative, status, title: title.slice(0, 85),
      bodyCharacters: textLength });
    assert.ok(status && status < 400,
      relative + ' returned an HTTP error ' + status);
    assert.ok(textLength > 60, relative + ' rendered an empty page');
  }

  try {
    await inspect('/', '01-home-live');
    await inspect('/login', '02-login-live');
    assert.equal(await page.locator('input[name="username"]').count(), 1,
      'Username field must be present on the LIVE login screen');
    assert.equal(await page.locator('input[name="password"]').count(), 1,
      'Password field must be present on the LIVE login screen');
    assert.equal(await page.locator('button[type="submit"]').count() >= 1, true,
      'LIVE login form has a submit button');
    await inspect('/contact', '03-contact-live');

    console.log('PASS: LIVE website reachable in headless Chromium');
    console.log('PASS: public homepage, login form and contact page load');
    console.log('READ-ONLY route checks:', JSON.stringify(checks));
    console.log('Production mutation requests intercepted:',
      blockedWrites.length, '(no writes sent)');
    console.log('Browser JS error count:', errors.length);
    if (errors.length) console.log('Anonymized error summaries:', errors.slice(0, 4));
  } catch (e) {
    console.error('FAIL:', e.message);
    console.error('Visited routes:', JSON.stringify(checks));
    console.error('Blocked mutation count:', blockedWrites.length);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main().catch(e => { console.error('FAIL:', e.message); process.exitCode = 1; });
