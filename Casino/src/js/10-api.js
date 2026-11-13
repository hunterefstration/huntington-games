// Talking to the casino: the launcher's Grapevine (live) or the practice mock. One request at a time for bets.
function launcherApi() {
  try { const L = window.parent && window.parent !== window && window.parent.HGGrapevine; return L && L.eco && typeof L.eco.casino === 'function' ? L : null; } catch { return null; }
}
const evHandlers = new Set();                           // (m) => void, for screens that want live events
let mockApi = null, liveHooked = null;

function setApi(practice) {
  S.practice = practice;
  if (practice) { mockApi = mockApi || makeMock(); S.api = mockApi; }
  else S.api = launcherApi();
  document.body.classList.toggle('practice', practice);
  $('#pr-tag').classList.toggle('hidden', !practice);
  if (S.api && liveHooked !== S.api) {
    const api = S.api; api.on('casino', m => { if (S.api === api) onEvent(m); });
    if (!S.api.mock) S.api.on('status', s => { if (s && s.status === 'online' && S.ready && !S.practice) enter().catch(() => {}); });
    liveHooked = S.api;
  }
}
const apiIsMock = () => !!(S.api && S.api.mock);

// one call: retries once on "Slow down", keeps the clock and the balance in step
async function call(op, args, opt) {
  opt = opt || {};
  if (!S.api) throw new Error('Open the casino from the Huntington Games launcher and sign in to play.');
  const src = S.api; let rep;
  try { rep = await src.eco.casino(op, args || {}); }
  catch (e) {
    if (!/slow down/i.test(e.message || '')) throw e;
    await sleep(1200); rep = await src.eco.casino(op, args || {});
  }
  if (src !== S.api) throw new Error('Switched tables.');
  if (typeof rep.now === 'number') S.offset = rep.now - Date.now();
  if (rep.bal) setBal(rep.bal, opt.hold ? (rep.r && rep.r.win) || 0 : 0);
  return rep;
}
// guard for anything that sends a bet: one request in flight, buttons dimmed, the error shown to the player
async function act(fn) {
  if (S.busy) return; S.busy = true; document.body.classList.add('busy');
  try { return await fn(); }
  catch (e) { if (e && e.message !== 'Switched tables.') toast(e.message || String(e), 'err'); releaseBal(); return null; }
  finally { S.busy = false; document.body.classList.remove('busy'); if (S.game && S.game.refresh) try { S.game.refresh(); } catch {} }
}

// ----- the balance bar -----
let balShown = 0;
function setBal(b, hold) {
  const prev = S.bal.chips; S.bal = { chips: b.chips, goons: b.goons };
  if (hold) S.hold = b.chips - hold; else if (S.hold != null) S.hold += b.chips - prev;           // while an outcome animates, show the balance before the win
  drawBal();
}
function releaseBal() { if (S.hold != null) { S.hold = null; drawBal(); } }
function drawBal() {
  const target = S.hold != null ? S.hold : S.bal.chips, el = $('#bal-chips');
  const from = balShown; balShown = target;
  el.classList.remove('up', 'down'); if (target !== from) { void el.offsetWidth; el.classList.add(target > from ? 'up' : 'down'); setTimeout(() => el.classList.remove('up', 'down'), 900); }
  const steps = 14; let i = 0; clearInterval(drawBal.t);
  drawBal.t = setInterval(() => { i++; el.textContent = fmt(from + (target - from) * Math.min(1, i / steps)); if (i >= steps) clearInterval(drawBal.t); }, 25);
  $('#bal-goons').textContent = S.bal.goons < 0 ? '∞' : fmt(S.bal.goons);
  $('#bal-goons').title = S.bal.goons < 0 ? 'Developer: unlimited goons' : '';
  for (const f of balWatchers) try { f(); } catch {}
}
const balWatchers = new Set();
const shownChips = () => (S.hold != null ? S.hold : S.bal.chips);

// ----- live events -----
function onEvent(m) {
  if (!m || !m.ev) return;
  if (typeof m.now === 'number') S.offset = m.now - Date.now();
  if (m.ev === 'bal' && m.bal) { if (S.hold != null) S.hold += m.bal.chips - S.bal.chips; S.bal = m.bal; drawBal(); }
  else if (m.ev === 'feed' && m.item) { S.feed.push(m.item); if (S.feed.length > 30) S.feed.shift(); feedChanged(m.item); }
  else if (m.ev === 'duels' && S.live) S.live.duels = m.list;
  else if (m.ev === 'bet' && S.live && S.live[m.g === 'lr' ? 'lr' : m.g] && S.live[m.g].r === m.r) {
    const L = S.live[m.g], p = L.players.find(x => x.n === m.n); if (p) p.a = m.a; else L.players.push({ n: m.n, a: m.a });
    if (m.g === 'pot' && m.total != null) L.total = m.total;
  }
  for (const f of evHandlers) try { f(m); } catch (e) { console.error(e); }
}

async function enter() {
  const rep = await call('enter');
  Object.assign(S, { limits: rep.limits || S.limits, stats: rep.stats || S.stats, edge: rep.edge || {}, names: rep.names || {}, feed: rep.feed || [], live: rep.live, tables: rep.tables, turn: rep.turn, daily: !!rep.daily });
  S.me = S.api.me && S.api.me(); S.ready = true;
  return rep;
}
async function refreshLive() { try { const rep = await call('live'); S.live = rep.live; return rep; } catch { return null; } }
function trackPlay(bet, win) { const st = S.stats; st.plays++; st.wag += bet; st.won += win; st.big = Math.max(st.big, win - bet); }
