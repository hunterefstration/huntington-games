// A picture of the Proof Slice in a chosen state, for looking at art and layout without playing.
//   node tools/tests/proof-shot.mjs <yard|tank> <out.png> ["js run in the page first"] [--size=960x540]
// The js sees H (window.__proof), M (the mode) and P (M.P or M.K); it may be async. Example:
//   node tools/tests/proof-shot.mjs yard /tmp/ads.png "for (let i = 0; i < 30; i++) { H.mouse.right = true; H.step(1/30, 1); }"
import { chromium } from 'playwright';
import { startServer } from '../bench/serve.mjs';

const args = process.argv.slice(2).filter(a => !a.startsWith('--')), size = (process.argv.find(a => a.startsWith('--size=')) || '--size=960x540').slice(7).split('x').map(Number);
const [mode, out, js] = args; if (!mode || !out) { console.log('usage: proof-shot.mjs <yard|tank> <out.png> ["js"]'); process.exit(1); }
const { server, base } = await startServer(0);
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
const page = await (await browser.newContext({ viewport: { width: size[0], height: size[1] } })).newPage();
page.on('pageerror', e => console.log('error: ' + e.message.slice(0, 200)));
await page.goto(base + '/Proof%20Slice/index.html?gov=0&stats=0', { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__proof, null, { timeout: 15000 });
const info = await page.evaluate(async ([mode, js]) => {
    const H = window.__proof; if (!await H.start(mode, false)) return 'did not start: ' + document.getElementById('load').textContent;
    const M = H.App.modes[mode], P = M.P || M.K; H.App.locked = true; H.step(1 / 30, 20);
    let r = ''; if (js) r = await new Function('H', 'M', 'P', 'return (async () => { ' + js + ' })()')(H, M, P);
    H.step(1e-4, 1); H.App.paused = true; return r === undefined ? '' : JSON.stringify(r);
}, [mode, js || '']);
await page.screenshot({ path: out }); if (info) console.log(info);
await browser.close(); server.close(); process.exit(0);
