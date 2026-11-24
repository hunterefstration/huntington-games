// The Lab (Lab/index.html): the experimental launcher that lets only the owner and the admins of Grapevine at the games
// that are still being built. The real sign-in needs a real key and the real server, so here a stand-in for the Grapevine
// code (gv/account.js) answers for it: what the page does with each answer is what is tested.
//   node tools/tests/lab.mjs
// (needs the internet for one file: the relay library the page loads with an integrity check, as the launcher does)
import { chromium } from 'playwright';
import { startServer } from '../bench/serve.mjs';

const { server, base } = await startServer(0);
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
let fails = 0; const ok = (c, name, more) => { console.log((c ? 'PASS  ' : 'FAIL  ') + name + (more ? '  ' + more : '')); if (!c) fails++; };
// who the stand-in says you are: window.__who in the page = { name, owner, perms, key (the one key it accepts), saved (a key is already on this device) }
const FAKE = "(function () { var W = parent.__who || {}; window.HGGrapevine = { on: function () {}, me: function () { return { name: W.name || 'Tester' }; }, eco: { state: function () { return { owner: !!W.owner, perms: W.perms || [] }; }, report: function (r) { if (W.down) return Promise.reject(new Error('The server is busy.')); (parent.__sent = parent.__sent || []).push(r); return Promise.resolve({ ok: true }); } }," +
    " resume: function () { return Promise.resolve(W.saved ? { name: W.name } : null); }, signIn: function (k) { return k === W.key ? Promise.resolve({ name: W.name }) : Promise.reject(Object.assign(new Error('bad key'), { code: 'bad-key' })); } }; parent.__asked = (parent.__asked || 0) + 1; })();";
async function open(query, who) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 600 } }), page = await ctx.newPage(), msgs = [];
    page.on('pageerror', e => msgs.push('error: ' + e.message.slice(0, 200)));
    await page.route(/\/gv\/account\.js$/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE }));
    await page.addInitScript(w => { window.__who = w; }, who || {});
    await page.goto(base + '/Lab/index.html' + query, { waitUntil: 'load', timeout: 60000 });
    return { ctx, page, msgs };
}
const text = (p, id) => p.evaluate(i => document.getElementById(i).textContent, id), shown = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!e && !e.hidden && e.offsetParent !== null; }, sel);
const KEY = 'k'.repeat(43);

{   // on this computer: no sign-in, both games are offered, and one opens
    const { ctx, page, msgs } = await open('');
    const tiles = await page.waitForSelector('[data-game="1"]', { timeout: 20000 }).then(() => true, () => false);
    ok(tiles && !(await shown(page, '#form')) && (await page.evaluate(() => window.__asked || 0)) === 0, 'lab: on localhost there is no sign-in and Grapevine is not asked', await text(page, 'who'));
    await page.click('[data-game="1"]'); const up = await page.waitForFunction(() => !!window.__steelstorm && window.HG_LAB === 1, null, { timeout: 60000 }).then(() => true, () => false);
    ok(up, 'lab: a game opens from it (Steel Storm Remastered)'); ok(!msgs.length, 'lab: no script error', msgs.slice(0, 2).join(' | ')); await ctx.close();
}
{   // nothing saved on this device: it asks for a key; a short one and a wrong one are refused; the owner's lets you in
    const { ctx, page, msgs } = await open('?gate=1', { name: 'Hunter', owner: true, key: KEY });
    const form = await page.waitForSelector('#form:not([hidden])', { timeout: 30000 }).then(() => true, () => false);
    ok(form && !(await shown(page, '#games')), 'lab: with no key on this device it asks for one and shows no game', await text(page, 'say'));
    await page.fill('#key', 'short'); await page.click('#go'); const short = await text(page, 'say');
    await page.fill('#key', 'x'.repeat(43)); await page.click('#go'); await page.waitForFunction(() => /does not belong/.test(document.getElementById('say').textContent), null, { timeout: 30000 }).catch(() => { });
    const wrong = await text(page, 'say'), still = !(await shown(page, '#games'));
    ok(/too short/.test(short) && /does not belong/.test(wrong) && still, 'lab: a short key and a wrong key are refused', wrong);
    await page.fill('#key', KEY); await page.click('#go'); const inn = await page.waitForSelector('[data-game="0"]', { timeout: 30000 }).then(() => true, () => false);
    ok(inn && /Hunter\s+\(owner\)/.test(await text(page, 'who')) && (await page.evaluate(() => document.getElementById('key').value)) === '' && (await page.evaluate(() => document.querySelectorAll('iframe').length)) === 0, 'lab: the owner\'s key lets you in; the key is not left in the box and the sign-in frame is gone', await text(page, 'who'));
    ok(!msgs.length, 'lab: no script error (sign-in)', msgs.slice(0, 2).join(' | ')); await ctx.close();
}
{   // a key already on this device (the launcher's): an admin goes straight in, an ordinary player is told no
    let { ctx, page } = await open('?gate=1', { name: 'Mod', perms: ['reports'], saved: true });
    const adm = await page.waitForSelector('[data-game="0"]', { timeout: 30000 }).then(() => true, () => false);
    ok(adm && /Mod\s+\(admin\)/.test(await text(page, 'who')), 'lab: an admin whose key is already on the device goes straight in', await text(page, 'who')); await ctx.close();
    ({ ctx, page } = await open('?gate=1', { name: 'Player', saved: true }));
    await page.waitForFunction(() => /only for the owner/.test(document.getElementById('say').textContent), null, { timeout: 30000 }).catch(() => { });
    ok(/Player is signed in, but the Lab is only for the owner and the admins/.test(await text(page, 'say')) && !(await shown(page, '#games')) && (await page.evaluate(() => document.querySelectorAll('[data-game]').length)) === 0, 'lab: an ordinary player is told no and is shown no game', await text(page, 'say')); await ctx.close();
}
{   // a ticket: written in the Lab, sent to Grapevine as a report under the key this browser holds; a refusal is shown, not lost
    const { ctx, page, msgs } = await open('?gate=1', { name: 'Hunter', owner: true, saved: true });
    await page.waitForSelector('[data-game="0"]', { timeout: 30000 }).catch(() => { });
    ok(await shown(page, '#tk') && !(await shown(page, '#ticket')), 'ticket: the button is there once you are in');
    await page.click('#tk'); const form = (await shown(page, '#ticket')) && !(await shown(page, '#games'));
    await page.fill('#ttext', 'hi'); await page.click('#tsend'); const short = await text(page, 'tsay');
    await page.selectOption('#tgame', { label: 'NIGHTLINE' }); await page.fill('#ttext', 'The grid sits on the last bend.\nMove it to the straight.'); await page.click('#tsend');
    await page.waitForFunction(() => /^Sent/.test(document.getElementById('tsay').textContent), null, { timeout: 30000 }).catch(() => { });
    const sent = await page.evaluate(() => window.__sent || []), r = sent[0] || {};
    ok(form && /few words/.test(short), 'ticket: the form opens, and two letters are not a ticket', short);
    ok(sent.length === 1 && r.kind === 'bug' && /^Lab: NIGHTLINE/.test(r.game) && r.text === 'The grid sits on the last bend. Move it to the straight.', 'ticket: it goes to Grapevine as a report about that game', JSON.stringify(r));
    ok(/^Sent/.test(await text(page, 'tsay')) && (await page.evaluate(() => document.getElementById('ttext').value)) === '' && (await page.evaluate(() => document.querySelectorAll('iframe').length)) === 0, 'ticket: it says so, the box is emptied and no connection is left running', await text(page, 'tsay'));
    await page.evaluate(() => { window.__who.down = true; }); await page.fill('#ttext', 'Another thing to fix.'); await page.click('#tsend');
    await page.waitForFunction(() => /^Not sent/.test(document.getElementById('tsay').textContent), null, { timeout: 30000 }).catch(() => { });
    ok(/^Not sent: The server is busy/.test(await text(page, 'tsay')) && (await page.evaluate(() => document.getElementById('ttext').value)) !== '', 'ticket: a refusal is shown and the words are kept', await text(page, 'tsay'));
    await page.click('#tback'); ok(await shown(page, '#games') && !(await shown(page, '#ticket')), 'ticket: BACK returns to the games');
    ok(!msgs.length, 'ticket: no script error', msgs.slice(0, 2).join(' | ')); await ctx.close();
}

await browser.close(); server.close();
console.log(fails ? fails + ' FAILED' : 'lab: all passed'); process.exit(fails ? 1 : 0);
