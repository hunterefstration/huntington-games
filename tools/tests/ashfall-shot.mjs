// A picture of Ashfall in a chosen state, for looking at art and layout without playing.
//   node tools/tests/ashfall-shot.mjs <query> <out.png> ["js run in the page first"] [--size=960x540] [--wait=ms]
// query: "go=yard" starts a run, "menu=1" opens the menu, "intro=1" the opening ("" = as a first visit).
// The js sees H (window.__ash), G (H.Game) and P (G.P); it may be async and what it returns is printed. Example:
//   node tools/tests/ashfall-shot.mjs go=yard /tmp/a.png "for (let i = 0; i < 40; i++) { H.Input.aimOn = true; H.step(1/30, 1); }"
import { chromium } from 'playwright';
import { startServer } from '../bench/serve.mjs';

const args = process.argv.slice(2).filter(a => !a.startsWith('--')), opt = (n, d) => { const a = process.argv.find(a => a.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const size = opt('size', '960x540').split('x').map(Number), [query, out, js] = args;
if (query === undefined || !out) { console.log('usage: ashfall-shot.mjs <query> <out.png> ["js"]'); process.exit(1); }
const { server, base } = await startServer(0);
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: size[0], height: size[1] } })).newPage();
page.on('pageerror', e => console.log('error: ' + e.message.slice(0, 300)));
page.on('console', m => { if (m.type() === 'error' || /\[HG3D\]/.test(m.text())) console.log('console: ' + m.text().slice(0, 300)); });
await page.goto(base + '/Ashfall/index.html?gov=0&' + query, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ash, null, { timeout: 15000 });
if (/go=/.test(query)) await page.waitForFunction(() => window.__ash.started !== undefined, null, { timeout: 60000 });
await page.waitForTimeout(+opt('wait', 300));
const info = await page.evaluate(async js => {
    const H = window.__ash, G = H.Game, P = G.P; if (H.App.game) { H.App.locked = true; H.step(1 / 30, 10); }
    let r = ''; if (js) r = await new Function('H', 'G', 'P', 'return (async () => { ' + js + ' })()')(H, G, P);
    if (H.App.game) { H.step(1e-4, 1); H.App.paused = true; }
    return (r === undefined ? '' : JSON.stringify(r)) + (H.App.errors.length ? ' ERRORS: ' + H.App.errors.slice(0, 3).join(' | ') : '');
}, js || '');
await page.screenshot({ path: out }); if (info) console.log(info);
await browser.close(); server.close(); process.exit(0);
