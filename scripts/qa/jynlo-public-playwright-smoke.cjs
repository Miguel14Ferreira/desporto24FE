#!/usr/bin/env node
'use strict';

// Public-only Chromium smoke test. No account login, private user data,
// storage state, recordings or authorization headers. Screenshots are public.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const SITE = 'https://d24sports.com';
const REPORT = path.join(process.cwd(), 'test-results', 'public-smoke');
const SCENARIOS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true }
];

async function main() {
  fs.mkdirSync(REPORT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  let failures = 0;
  try {
    for (const scenario of SCENARIOS) {
      const context = await browser.newContext({
        viewport: scenario.viewport,
        isMobile: Boolean(scenario.isMobile),
        locale: 'pt-PT',
        reducedMotion: 'reduce',
        serviceWorkers: 'block'
      });
      const page = await context.newPage();
      try {
        const response = await page.goto(SITE, {
          waitUntil: 'domcontentloaded', timeout: 40000
        });
        assert.ok(response && response.status() < 400, 'PUBLIC_HTTP_ERROR');
        assert.equal(new URL(page.url()).origin, SITE, 'PUBLIC_UNEXPECTED_REDIRECT');
        await page.locator('body').waitFor({ state: 'visible', timeout: 15000 });
        await page.waitForTimeout(1200);
        const body = (await page.locator('body').innerText()).trim();
        assert.ok(body.length > 100, 'PUBLIC_PAGE_EMPTY');
        assert.match(body, /JYNLO|Jynlo|desporto|sport/i, 'PUBLIC_BRAND_MISSING');
        // No authentication or private content: artifacts may be shared with QA.
        await page.screenshot({
          path: path.join(REPORT, scenario.name + '-home.png'),
          fullPage: true, animations: 'disabled', timeout: 25000
        });
        console.log('[PASS] Public landing page rendered in ' + scenario.name);
      } catch (error) {
        failures++;
        const code = typeof error?.message === 'string'
          && /PUBLIC_[A-Z_]+/.test(error.message)
          ? error.message.match(/PUBLIC_[A-Z_]+/)[0]
          : 'PUBLIC_BROWSER_FAILURE';
        console.error('[FAIL] ' + scenario.name + ': ' + code);
        // Never save browser state or credentials; the test stays anonymous.
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  assert.equal(failures, 0, 'PUBLIC_SMOKE_INCOMPLETE');
}

if (require.main === module) {
  main().catch(() => { process.exitCode = 1; });
}
module.exports = { main };
