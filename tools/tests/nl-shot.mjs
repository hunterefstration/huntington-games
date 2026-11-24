// A picture of Nightline in a chosen state.
//   node tools/tests/nl-shot.mjs <query> <out.png> ["js run in the page first"] [--size=1366x600] [--wait=ms] [--clip=x,y,w,h] [--probe=x,y;x,y]
// query: "" = the menu, "go=race" or "go=trial" starts at once (&car=aria&level=2), "standin=1" = the plain stand-in city.
// The js sees S (window.__nightline: S.Race, S.World, S.step(n) steps the race); it runs once the game has started.
import fs from 'node:fs';
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
await page.goto(base + '/Nightline/index.html?' + query, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__nightline, null, { timeout: 30000 });
await page.waitForTimeout(300);
const info = await page.evaluate(async js => {
    const S = window.__nightline; let r = ''; for (let i = 0; i < 400 && !S.started; i++) await new Promise(r => setTimeout(r, 50));
    if (js) r = await new Function('S', 'return (async () => { ' + js + ' })()')(S);
    return r === undefined ? '' : JSON.stringify(r);
}, js || '');
await page.waitForTimeout(+opt('wait', 900));
const clip = opt('clip', '').split(',').map(Number); await page.screenshot(clip.length === 4 ? { path: out, clip: { x: clip[0], y: clip[1], width: clip[2], height: clip[3] } } : { path: out }); if (info) console.log(String(info).slice(0, 1500));
// --probe=x,y;x,y prints the colour of those pixels of the picture (to measure light without looking)
if (opt('probe', '')) { const b64 = fs.readFileSync(out).toString('base64'), pts = opt('probe', '').split(';').map(p => p.split(',').map(Number)); console.log('probe ' + JSON.stringify(await page.evaluate(async ([b64, pts]) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return pts.map(p => Array.from(x.getImageData(p[0], p[1], 1, 1).data.slice(0, 3)).join(',')); }, [b64, pts]))); }
await browser.close(); server.close(); process.exit(0);
