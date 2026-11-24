import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
const [, , src, out] = process.argv, b = await chromium.launch({ args: ['--no-sandbox'] }), p = await (await b.newContext({ viewport: { width: 1366, height: 620 } })).newPage();
await p.goto(pathToFileURL(src).href); await p.waitForTimeout(300); await p.screenshot({ path: out, fullPage: true }); await b.close();
