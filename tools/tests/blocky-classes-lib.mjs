import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
export const { chromium } = require('playwright');
const TOOLS = '/tmp/hg-tools';
export const URL0 = '' + (process.env.HG_BASE || 'http://127.0.0.1:8090/') + 'Blocky%20Shooter%20V2/index.html';
export async function newPage(browser, { init, query = '', errors } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => r.abort());
  await page.route(/three@0\.160\.0\/(.*)$/, r => { const m = /three@0\.160\.0\/(.*)$/.exec(r.request().url()), f = TOOLS + '/cdn/package/' + m[1].split('?')[0]; fs.existsSync(f) ? r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f) }) : r.abort(); });
  await page.route(/\/mqtt\//, r => { const f = '/home/user/grapevine/relay/mqtt.min.js'; fs.existsSync(f) ? r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f) }) : r.abort(); });
  const errs = errors || [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); });
  if (init) await page.addInitScript(init);
  await page.goto(URL0 + query);
  await page.waitForFunction(() => !!(window.__blocky && window.__blocky.state), null, { timeout: 60000 });
  return { page, ctx, errs };
}
export const launch = () => chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
export function check(name, ok, extra = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' :: ' + extra : '')); if (!ok) process.exitCode = 1; }
