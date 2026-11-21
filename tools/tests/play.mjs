// The local games menu (tools/play.mjs, "Play Huntington Games.cmd"). Needs no rig.
//   node tools/tests/play.mjs            three.js from $HG_TOOLS, or from the real CDN with HG_LIVE_CDN=1 (Windows)
// Checks: the menu lists every game the launcher lists, each with its picture; search and the tag chips narrow the list;
// every game opens inside the menu from this folder, with no licence screen and no script error; Back returns to the list.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { startPlayServer, gameLists } from '../play.mjs';

const TOOLS = process.env.HG_TOOLS || '/tmp/hg-tools';
const { server, url } = await startPlayServer(0), lists = gameLists(), all = lists.games.concat(lists.more);
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
let fails = 0; const ok = (c, what, info) => { console.log((c ? 'PASS  ' : 'FAIL  ') + what + (info ? '  ' + info : '')); if (!c) fails++; };
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage(), errs = [];
page.on('pageerror', e => errs.push(e.message.slice(0, 140)));
// a game that could not fetch a library from the internet (blocked, slow or offline) is reported as skipped, not failed:
// that is the network's doing, not the menu's
const ext = r => r.resourceType() === 'script' && !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(r.url()) && /^https?:/.test(r.url()), waiting = new Set(), lost = new Set();
page.on('request', r => { if (ext(r)) waiting.add(r); }); page.on('requestfinished', r => waiting.delete(r)); page.on('requestfailed', r => { if (ext(r)) { waiting.delete(r); lost.add(new URL(r.url()).host); } });
await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, r => r.abort());
await page.route(/three@0\.(160|128)\.0\/(.*)$/, r => { const m = /three@0\.160\.0\/(.*)$/.exec(r.request().url()), f = m ? TOOLS + '/cdn/package/' + m[1].split('?')[0] : ''; f && fs.existsSync(f) ? r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f) }) : process.env.HG_LIVE_CDN ? r.continue() : r.abort(); });
await page.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js/, r => process.env.HG_LIVE_CDN ? r.continue() : r.abort());

await page.goto(url); await page.waitForSelector('.card');
const cards = await page.evaluate(() => [...document.querySelectorAll('#lists .card')].map(c => ({ dir: c.dataset.dir, img: c.querySelector('img') ? c.querySelector('img').getAttribute('src') : null })));
const dirs = new Set(cards.map(c => c.dir));
ok(all.length >= 24 && all.every(g => dirs.has(g.dir)), 'the menu lists every game the launcher lists', all.length + ' games' + (all.filter(g => !dirs.has(g.dir)).length ? ', missing: ' + all.filter(g => !dirs.has(g.dir)).map(g => g.dir).join(', ') : ''));
const noPic = lists.games.filter(g => !g.img).map(g => g.dir);
const broken = await page.evaluate(async () => { const bad = []; for (const i of document.querySelectorAll('#lists img')) { i.loading = 'eager'; if (!i.complete) await new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 4000); }); if (!i.naturalWidth) bad.push(i.getAttribute('src')); } return bad; });
ok(!noPic.length && !broken.length, 'every launcher game has its picture', noPic.concat(broken).join(', '));
await page.fill('#q', 'tetris'); const found = await page.evaluate(() => [...document.querySelectorAll('#lists .card .name')].map(n => n.textContent));
ok(found.length >= 1 && found.length <= 3 && found.every(n => /tetris/i.test(n)), 'search narrows the list', found.join(', '));
await page.fill('#q', ''); await page.click('.chip[data-tag="3D"]'); const n3d = await page.evaluate(() => document.querySelectorAll('#lists .card').length);
ok(n3d >= 4 && n3d < all.length, 'a tag chip narrows the list', n3d + ' 3D games'); await page.click('.chip[data-tag="All"]');

// The launcher's main games are each opened; the experimental ones are only listed (the owner does not hold them to
// this test). "node tools/tests/play.mjs tetris" opens only the games whose name has that word, experimental ones too.
let skipped = 0; const only = process.argv[2] ? process.argv[2].toLowerCase() : '';
for (const g of (only ? all : lists.games)) {
    if (only && !g.name.toLowerCase().includes(only)) continue;
    errs.length = 0; waiting.clear(); lost.clear();
    await page.evaluate(d => { location.hash = '#play=' + encodeURIComponent(d); }, g.dir);
    const frame = await page.waitForFunction(() => { const f = document.getElementById('frame'); try { return f.contentDocument && f.contentDocument.readyState === 'complete' && f.contentWindow.location.href !== 'about:blank'; } catch (e) { return false; } }, null, { timeout: 30000 }).then(() => true, () => false);
    await page.waitForTimeout(1800);
    const s = frame ? await page.evaluate(() => { const d = document.getElementById('frame').contentDocument, t = d.body ? d.body.innerText : ''; return { gate: /This copy has been shut down|unauthorized copy/i.test(t), stuff: d.querySelectorAll('canvas, button, input').length, on: document.getElementById('player').classList.contains('on'), name: document.getElementById('pname').textContent }; }) : null;
    const good = frame && s.on && !s.gate && s.stuff > 0 && !errs.length, net = [...lost].concat([...waiting].map(r => new URL(r.url()).host));
    if (!good && net.length && !(s && s.gate)) { skipped++; console.log('SKIP  ' + g.name + ': could not get a library from ' + [...new Set(net)].join(', ') + ' (needs the internet)'); continue; }
    ok(good, g.name + ' opens and runs', !frame ? 'did not load' : s.gate ? 'LICENCE SCREEN' : errs.length ? errs.slice(0, 2).join(' | ') : '');
}
if (skipped) console.log('      ' + skipped + ' game(s) skipped for lack of a library from the internet');
// the "All games" button, then a card click followed by the browser's own Back
await page.click('#back'); await page.waitForTimeout(300);
const viaButton = await page.evaluate(() => !document.getElementById('player').classList.contains('on') && document.querySelectorAll('#lists .card').length > 20);
ok(viaButton, 'the All games button returns to the list');
await page.click('#lists .card'); await page.waitForTimeout(600);
ok(await page.evaluate(() => document.getElementById('player').classList.contains('on')), 'clicking a card opens that game');
await page.evaluate(() => history.back()); await page.waitForTimeout(600);
const back = await page.evaluate(() => ({ on: document.getElementById('player').classList.contains('on'), src: (() => { try { const h = document.getElementById('frame').contentWindow.location.href; return h === 'about:blank' ? null : h; } catch (e) { return 'unreadable'; } })(), cards: document.querySelectorAll('#lists .card').length, jump: /jump back in/i.test(document.getElementById('lists').innerText) }));
ok(!back.on && !back.src && back.cards > 20 && back.jump, 'one press of Back returns to the list and stops the game', JSON.stringify(back));
await browser.close(); server.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
