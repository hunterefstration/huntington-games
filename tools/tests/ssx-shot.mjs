// A picture of Steel Storm Rebuilt in a chosen state, for looking at models and maps without playing.
//   node tools/tests/ssx-shot.mjs <query> <out.png> ["js run in the page first"] [--size=1366x600] [--wait=ms] [--clip=x,y,w,h]
// The js sees S (window.__steelstorm); it may be async and what it returns is printed. Examples:
//   node tools/tests/ssx-shot.mjs "" a.png "S.startMatch({ veh: 'g1b' }); S.step(30); S.look(2.4, .25);"
//   node tools/tests/ssx-shot.mjs "" a.png "return await S.lineup(['g1a', 'g1b', 'g2c'])"      (models in a row, both sides)
import { chromium } from 'playwright';
import { startServer } from '../bench/serve.mjs';

const args = process.argv.slice(2).filter(a => !a.startsWith('--')), opt = (n, d) => { const a = process.argv.find(a => a.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const size = opt('size', '1366x600').split('x').map(Number), [query, out, js] = args;
if (query === undefined || !out) { console.log('usage: ssx-shot.mjs <query> <out.png> ["js"]'); process.exit(1); }
const { server, base } = await startServer(0);
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: size[0], height: size[1] } })).newPage();
await page.addInitScript(() => { Element.prototype.requestPointerLock = function () { }; });      // a hidden browser must never take the mouse
page.on('pageerror', e => console.log('error: ' + e.message.slice(0, 300)));
page.on('console', m => { if (m.type() === 'error' || /\[HG3D\]/.test(m.text())) console.log('console: ' + m.text().slice(0, 300)); });
await page.goto(base + '/Steel%20Storm%20Rebuilt/index.html?' + query, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__steelstorm, null, { timeout: 30000 });
await page.waitForTimeout(300);
const info = await page.evaluate(async js => {
    const S = window.__steelstorm; let r = '';
    if (js) r = await new Function('S', 'return (async () => { ' + js + ' })()')(S);
    return r === undefined ? '' : JSON.stringify(r);
}, js || '');
await page.waitForTimeout(+opt('wait', 900));
const clip = opt('clip', '').split(',').map(Number); await page.screenshot(clip.length === 4 ? { path: out, clip: { x: clip[0], y: clip[1], width: clip[2], height: clip[3] } } : { path: out }); if (info) console.log(String(info).slice(0, 1500));
await browser.close(); server.close(); process.exit(0);
