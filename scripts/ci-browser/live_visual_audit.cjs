'use strict';
// Anonymous, read-only visual audit of the deployed site.
// Do not authenticate, submit forms, or send write requests to production.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const BASE = 'https://desporto24-full-preview.onrender.com';
const OUT = path.resolve('artifacts/visual-audit');
fs.mkdirSync(OUT, { recursive: true });
const cases = [
  { label: 'desktop', width: 1440, height: 900, routes: ['/home','/login','/about','/contact','/login/resetPassword','/login/registerNewUser'] },
  { label: 'tablet', width: 768, height: 1024, routes: ['/home','/login','/login/resetPassword','/login/registerNewUser'] },
  { label: 'mobile', width: 390, height: 844, routes: ['/home','/login','/about','/contact','/login/resetPassword','/login/registerNewUser'] },
  { label: 'compact', width: 320, height: 700, routes: ['/home','/login','/login/resetPassword'] }
];

async function main() {
  const browser = await chromium.launch({ headless:true, args:['--no-sandbox'] });
  const failures = [], results = [];
  try {
    for (const test of cases) {
      const context = await browser.newContext({
        viewport: { width: test.width, height: test.height },
        locale:'pt-PT', serviceWorkers:'block', reducedMotion:'reduce'
      });
      await context.route('**/*', async route => {
        const req = route.request();
        // Read-only even if the application attempts refresh or analytics.
        if (!['GET','HEAD','OPTIONS'].includes(req.method())) {
          return route.abort('blockedbyclient');
        }
        return route.continue();
      });
      const page = await context.newPage();
      for (const route of test.routes) {
        const name = test.label + '-' + route.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'');
        try {
          const res = await page.goto(BASE + route, {waitUntil:'domcontentloaded',timeout:50000});
          await page.locator('body').waitFor({timeout:15000});
          await page.waitForTimeout(1050);
          const data = await page.evaluate(() => {
            const html = document.documentElement;
            const body = document.body;
            const nav = document.querySelector('.site-nav');
            const title = document.querySelector('main h1, section h1, h1');
            const navRect = nav?.getBoundingClientRect();
            const titleRect = title?.getBoundingClientRect();
            const bodyText = body.innerText.trim();
            const width = html.clientWidth;
            const excess = Math.max(0,html.scrollWidth - width,body.scrollWidth - width);
            const titleOverlap = !!(navRect && titleRect
              && titleRect.top < navRect.bottom - 3
              && titleRect.bottom > navRect.top + 3);
            const fields = [...document.querySelectorAll('input:not([type=hidden]),select,textarea')];
            const clippedFields = fields.filter(el => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && (r.width < 130 || r.right > width + 3 || r.left < -3);
            }).length;
            return {
              width, scrollWidth:html.scrollWidth, excess, titleOverlap,
              titleTop:titleRect ? Math.round(titleRect.top):null,
              navbarBottom:navRect ? Math.round(navRect.bottom):null,
              title:title?.innerText?.trim().slice(0,90) || '',
              textCharacters:bodyText.length,
              clippedFields,
              navbarLinks:nav?.querySelectorAll('a').length || 0
            };
          });
          const row={route,viewport:test.label,status:res?.status() ?? null,...data};
          results.push(row);
          const fail=[];
          if (!row.status || row.status >= 400)fail.push('HTTP '+row.status);
          if (row.textCharacters < 55)fail.push('page text missing');
          if (!row.title)fail.push('h1 missing');
          if (row.excess>4)fail.push('horizontal overflow '+row.excess+'px');
          if (row.titleOverlap)fail.push('heading overlaps fixed navigation');
          if (row.clippedFields>0)fail.push(row.clippedFields+' clipped form fields');
          if (fail.length)failures.push({case:name,findings:fail});
          await page.screenshot({path:path.join(OUT,name+'.png'),fullPage:true,animations:'disabled',timeout:15000});
          console.log('VISUAL_AUDIT',JSON.stringify(row));
        } catch(err) {
          failures.push({case:name,findings:[String(err.message).slice(0,210)]});
          console.error('VISUAL_AUDIT_ERROR',name,String(err.message).slice(0,210));
        }
      }
      await context.close();
    }
    console.log('VISUAL_AUDIT_SUMMARY',JSON.stringify({
      checked:results.length,failures:failures.length,issues:failures
    }));
    if (failures.length)process.exitCode=1;
  } finally {
    await browser.close();
  }
}
main().catch(e=>{console.error('AUDIT_FATAL',String(e.message));process.exitCode=1});
