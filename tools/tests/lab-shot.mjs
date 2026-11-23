// A picture of the Lab (the experimental launcher) for looking at its layout:  node tools/tests/lab-shot.mjs <out.png> [query]
import { chromium } from 'playwright';
import { startServer } from '../bench/serve.mjs';
const out = process.argv[2], query = process.argv[3] || '';
if (!out) { console.log('usage: lab-shot.mjs <out.png> [query]'); process.exit(1); }
const { server, base } = await startServer(0), browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1366, height: 600 } })).newPage();
await page.goto(base + '/Lab/index.html' + query, { waitUntil: 'load' }); await page.waitForTimeout(1500);
await page.screenshot({ path: out }); await browser.close(); server.close();
