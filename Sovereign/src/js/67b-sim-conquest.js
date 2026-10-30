// 1.2 Conquest: a country can come under another's full control. Its land is drawn in the owner's colour, its
// cities are the owner's, it pays the owner tribute from its economy every month, and it has no foreign policy of
// its own. Ruling it is not free: unrest grows with heavy tribute and a weak garrison, and an uprising can win it
// back its freedom. Whatever it controlled passes to its conqueror. Control every country and you rule the world.
//   nation.owner = index of the controlling country (absent: independent), .unrest 0-100, .tribute share of GDP a year
const TRIBUTE = [[0.04, 'Light'], [0.08, 'Normal'], [0.15, 'Heavy']];

function sameSide(w, x, y) { return (w.a.includes(x) && w.a.includes(y)) || (w.d.includes(x) && w.d.includes(y)); }
// a strike by `by` on `target` moves every front where they face each other (applied with next week's fighting)
function pushFronts(w, by, target, amt) {
  for (const f of w.fronts) {
    if (f.b === target && sameSide(w, f.a, by)) f.push = (f.push || 0) + amt;
    else if (f.a === target && sameSide(w, f.b, by)) f.push = (f.push || 0) - amt;
  }
}
// the computer's sides bomb each other too, and that moves the lines just like the player's strikes
function aiStrikes(w) {
  for (const lead of [w.a[0], w.d[0]]) {
    if (isHuman(lead) || G.rng() > 0.22) continue;
    const enemy = lead === w.a[0] ? w.d[0] : w.a[0], n = G.nations[lead], m = G.nations[enemy];
    const ratio = airPower(n) / (airPower(m) + 1); if (ratio < 0.6) continue;
    const kind = n.dev > 0.7 && G.rng() < 0.4 ? 'missile' : 'air', hit = (kind === 'missile' ? 0.6 : 0.4) * clamp(ratio, 0.3, 2);
    m.army.E *= 1 - hit * 0.02; m.evGrowth = (m.evGrowth || 0) - hit * 0.3;
    pushFronts(w, lead, enemy, hit * 0.008);
    if (w.will[enemy] != null) w.will[enemy] = clamp(w.will[enemy] - hit * 1.2, 0, 100);
    const c = capitalOf(enemy); for (let i = 0; i < 4; i++) Life.flash(c.lon + (G.rng() - 0.5) * 3, c.lat + (G.rng() - 0.5) * 2, 1, [1, 0.6, 0.2], 1.5);
    const txt = nm(lead) + (kind === 'missile' ? ' missiles hit bases and fuel depots in ' : ' jets strike supply lines in ') + nm(enemy) + '.';
    if (enemy === G.player.idx) inbox('bad', kind === 'missile' ? 'Missile attack' : 'Air raid', txt + ' Our front line will feel it.');
    else if (G.rng() < 0.3) newsWorld(txt);
  }
}
// every week at war: one line on how the front moved (only when it really moved)
function weeklyWarReport() {
  const me = G.player.idx, lines = [];
  for (const w of War.myWars()) for (const f of w.fronts) {
    const d = f.week || 0; if (Math.abs(d) < 0.006) continue;
    const ours = sameSide(w, f.a, me), gain = ours ? d > 0 : d < 0, them = ours ? f.b : f.a;
    lines.push((gain ? 'We advanced ' : 'We fell back ') + Math.max(1, Math.round(Math.abs(d) * 300)) + ' km on the ' + nm(them) + ' front');
  }
  if (lines.length) inbox(lines.some(l => l.startsWith('We fell')) ? 'bad' : 'good', 'This week at the front', lines.join('. ') + '.');
}

function conquer(by, t, how) {
  const n = G.nations[t], B = G.nations[by];
  if (!n || !B || t === by || n.owner === by) return;
  if (t === pIdx()) { endGame('conquered', 'Conquered', `${nm(by)} took full control of ${nm(t)}. ${G.player.title} ${G.player.name} rules no more.`); return; }
  for (const m of G.nations) if (m && m.owner === t) { m.owner = by; m.unrest = Math.max(m.unrest || 0, 40); }   // its own conquests pass on
  n.owner = by; n.ownedSince = G.day; n.unrest = 35; n.tribute = 0.08; n.atWar = false;
  for (const w of G.wars.slice()) {
    if (!w.a.includes(t) && !w.d.includes(t)) continue;
    if (w.a[0] === t || w.d[0] === t) endWar(w, 'white', 'conquest');
    else { w.a = w.a.filter(x => x !== t); w.d = w.d.filter(x => x !== t); w.fronts = w.fronts.filter(f => f.a !== t && f.b !== t); }
  }
  for (const k of ['growth', 'infl', 'stability', 'approval']) setMod(n, k, 'War', 0);
  newsWorld(nm(by) + ' takes full control of ' + nm(t));
  if (by === G.player.idx) {
    inbox('good', nm(t) + ' is ours', 'Its land, cities and economy are now under our control, and it pays us tribute every month. Keep the unrest down or it may rise up. See Military, Controlled lands.');
    flyToCountry(World.countries[t]);
  } else if (G.nations.some(m => m && m.owner === G.player.idx && m.idx === t)) inbox('bad', nm(t) + ' lost', nm(by) + ' took it from us.');
  sovAch(); recolorMap(); checkDomination();
}
function release(t, why) {
  const n = G.nations[t], by = n.owner; if (by == null) return;
  n.owner = null; n.unrest = 0; setMod(n, 'growth', 'Occupation', 0); setMod(n, 'stability', 'Occupation', 0);
  addRel(t, by, why === 'uprising' ? -60 : 35);
  newsWorld(why === 'uprising' ? 'Uprising! ' + nm(t) + ' throws off the rule of ' + nm(by) : nm(by) + ' grants ' + nm(t) + ' its independence');
  if (by === G.player.idx) inbox(why === 'uprising' ? 'crisis' : 'info', why === 'uprising' ? 'Uprising in ' + nm(t) : nm(t) + ' is free', why === 'uprising' ? 'The people rose up and drove out our administrators. It is independent again, and it hates us.' : 'We handed back power. They will remember it kindly.');
  recolorMap();
}
const ownerOf = idx => { const n = G.nations[idx]; return n && n.owner != null ? n.owner : null; };
function ruledBy(idx) { return G.nations.filter(m => m && m.owner === idx); }
// a month of ruling: tribute flows to the owner; unrest rises or falls; too much of it ends in an uprising
MONTHLY.push(() => {
  for (const n of G.nations) { if (n) n.tributeIn = 0; }
  for (const n of G.nations) {
    if (!n || n.owner == null) continue;
    let O = G.nations[n.owner]; if (!O) { n.owner = null; continue; }
    if (O.owner != null) { n.owner = O.owner; O = G.nations[n.owner]; }   // ruled by someone who is ruled: the top one takes it
    const amt = gdpUsd(n) * (n.tribute || 0.08) / 12;
    n.debt += amt * 100 / n.fx; O.debt -= amt * 100 / O.fx; O.tributeIn = (O.tributeIn || 0) + amt;
    const garrison = Math.min(1.4, landPower(O) / (landPower(n) + 1) * 0.15), heavy = ((n.tribute || 0.08) - 0.08) * 40;
    n.unrest = clamp((n.unrest || 0) + 0.9 + heavy - garrison + (n.stability < 35 ? 0.8 : 0) - (n.investT > G.day ? 2 : 0), 0, 100);
    setMod(n, 'growth', 'Occupation', -0.4 - (n.tribute || 0.08) * 6); setMod(n, 'stability', 'Occupation', -n.unrest / 6);
    if (n.unrest > 75 && G.rng() < (n.unrest - 70) / 120) release(n.idx, 'uprising');
  }
});
function recolorMap() { try { if (UI.screen === 'game' || UI.screen === 'hud') UI.setMode(UI.mode); Globe.dirty = true; } catch (e) {} }
function checkDomination() {
  const me = G.player.idx; if (G.dominated) return;
  const others = G.nations.filter(m => m && m.idx !== me);
  if (!others.length || !others.every(m => m.owner === me)) return;
  G.dominated = G.day; sovAch();
  Clock.pause();
  UI.modal(`<h2>🌍 World domination</h2><p style="font-size:15px">Every country on Earth answers to ${esc(nm(me))}. ${esc(G.player.title + ' ' + G.player.name)} rules the whole world.</p><p class="sub">Achievement unlocked: World Domination. You can keep playing.</p><div class="menu" style="width:auto"><button class="btn gold" data-act="close-modal">Keep ruling</button></div>`);
  $$('[data-act="close-modal"]').forEach(b => b.onclick = () => UI.closeModal());
}
// what the Huntington Games launcher's achievements read ('sov.hgach' syncs with the account like a save): best values so far.
// (Sovereign's own achievements live in 'sov.ach'; this is a separate key so their counts stay right.)
function sovAch() {
  try {
    if (!G || !G.player) return;
    const me = G.player.idx, n = G.nations[me], o = Store.get('hgach', {}) || {};
    o.warsWon = Math.max(o.warsWon || 0, n.warsWon || 0);
    o.conquered = Math.max(o.conquered || 0, ruledBy(me).length);
    o.years = Math.max(o.years || 0, Math.floor((n.months || 0) / 12));
    if (G.dominated) o.domination = o.domination || Date.now();
    Store.set('hgach', o);
  } catch (e) {}
}
MONTHLY.push(sovAch);

// the player's controlled lands (shown in Military)
const Rule = {
  setTribute(t, v) { const n = G.nations[t]; if (n.owner !== G.player.idx) return; n.tribute = v; Bus.emit('changed'); },
  invest(t) {
    const me = G.nations[G.player.idx], n = G.nations[t]; if (n.owner !== G.player.idx) return '';
    if (me.pc < 4) return 'Not enough political capital (4).';
    me.pc -= 4; n.unrest = Math.max(0, (n.unrest || 0) - 18); n.investT = G.day + 120; n.evGrowth = (n.evGrowth || 0) + 0.3;
    Bus.emit('changed'); return 'Schools, roads and jobs: unrest in ' + nm(t) + ' falls.';
  },
  free(t) { if (G.nations[t].owner !== G.player.idx) return; release(t, 'granted'); Bus.emit('changed'); }
};
function controlledHtml() {
  const me = G.player.idx, lands = ruledBy(me);
  let h = `<h3>Controlled lands (${lands.length})</h3>`;
  if (!lands.length) return h + `<div class="sub">Win a war fought to conquer (or accept a surrender) and the whole country is yours: its land, its cities and its economy. Control every country to rule the world.</div>`;
  const total = lands.reduce((s, n) => s + gdpUsd(n) * (n.tribute || 0.08), 0);
  h += `<div class="sub" style="margin-bottom:6px">Tribute: about ${usd(total)} a year. Heavy tribute pays more but stirs unrest; investing calms it.</div>`;
  for (const n of lands) {
    const c = World.countries[n.idx], u = n.unrest || 0;
    h += `<div class="forecast"><b>${c.flag} ${esc(c.name)}</b> <span class="sub">GDP ${usd(gdpUsd(n))} · ${fmtBig(n.pop)} people · ours since ${fmtDate(n.ownedSince || 0)}</span>
      <div class="sumrow"><span>Unrest</span><b class="${u > 60 ? 'down' : u > 35 ? '' : 'up'}">${u.toFixed(0)}/100${u > 70 ? ' - an uprising is close' : ''}</b></div>
      <div class="opt"><div class="lbl">Tribute</div><div class="seg">${TRIBUTE.map(([v, l]) => `<button data-trib="${n.idx}:${v}" class="${Math.abs((n.tribute || 0.08) - v) < 1e-6 ? 'on' : ''}">${l} ${Math.round(v * 100)}%</button>`).join('')}</div></div>
      <div class="btnrow"><button class="btn small" data-invest="${n.idx}">Invest (4)</button><button class="btn small" data-free="${n.idx}">Grant independence</button><button class="btn small" data-look="${n.idx}">Show on map</button></div></div>`;
  }
  return h;
}
function bindControlled(el) {
  $$('[data-trib]', el).forEach(b => b.onclick = () => { const [t, v] = b.dataset.trib.split(':'); Rule.setTribute(+t, +v); });
  $$('[data-invest]', el).forEach(b => b.onclick = () => toast(Rule.invest(+b.dataset.invest)));
  $$('[data-free]', el).forEach(b => b.onclick = () => UI.confirm('Grant independence to ' + nm(+b.dataset.free) + '?', 'We lose its land and its tribute. They will remember it kindly.', 'Grant independence', () => Rule.free(+b.dataset.free)));
  $$('[data-look]', el).forEach(b => b.onclick = () => flyToCountry(World.countries[+b.dataset.look]));
}

// more that can happen in a war
WAR_FLAVOR.push(
  { w: 0.06, f: (w, A, D) => { const f = w.fronts[0]; f.push = (f.push || 0) + 0.02; return 'A swarm of ' + nm(A) + ' drones knocks out ' + nm(D) + ' artillery near ' + frontCity(w) + '.'; } },
  { w: 0.05, f: (w, A, D) => { const f = w.fronts[0]; f.push = (f.push || 0) - 0.025; return nm(D) + ' paratroopers land behind the lines and cut a supply road.'; } },
  { w: 0.05, f: (w, A, D) => { w.will[A] -= 3; return 'Partisans in occupied ' + frontCity(w) + ' ambush a ' + nm(A) + ' convoy.'; } },
  { w: 0.04, f: (w, A, D) => { w.fronts.forEach(f => f.push = (f.push || 0) + (G.rng() < 0.5 ? 0.015 : -0.015)); return 'A winter offensive begins in the snow. Both armies dig in for a hard week.'; } },
  { w: 0.04, f: (w, A, D) => { const x = G.rng() < 0.5 ? A : D; G.nations[x].army.E *= 1.04; return 'A shipment of new tanks reaches the ' + nm(x) + ' front.'; } },
  { w: 0.04, f: (w, A, D) => { const x = G.rng() < 0.5 ? A : D; w.will[x] += 5; return 'Spies of ' + nm(x) + ' steal the enemy\'s battle plans.'; } },
  { w: 0.03, f: (w, A, D) => { w.will[A] -= 2; w.will[D] -= 2; return 'Satellite photos show both armies running low on shells.'; } },
  { w: 0.03, f: (w, A, D) => { const f = w.fronts[0]; f.push = (f.push || 0) + 0.03; return nm(A) + ' marines storm a beach on the ' + nm(D) + ' coast.'; } }
);
