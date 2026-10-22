// In-game HUD: top bar stats, clock, side menu, Why? popovers, data map modes.
const SEQ = ['#123a6b', '#1c5cab', '#3987e5', '#86b6ef', '#cde2fb'];
const DIV_NEG = '#d03b3b', DIV_MID = '#6f6f6a', DIV_POS = '#3987e5';
const _ca = new THREE.Color(), _cb = new THREE.Color();
function rampColor(stops, t) {
  t = clamp(t, 0, 1) * (stops.length - 1); const i = Math.min(stops.length - 2, Math.floor(t));
  return '#' + _ca.set(stops[i]).lerp(_cb.set(stops[i + 1]), t - i).getHexString();
}
const divColor = t => t < 0 ? rampColor([DIV_MID, DIV_NEG], -t) : rampColor([DIV_MID, DIV_POS], t);
// nation data for map modes: the live game if one is running, the 2026 starting data otherwise
const nat = c => G ? G.nations[c.idx] : World.nat0[c.idx];
const logT = (v, a, b) => (Math.log10(Math.max(v, a)) - Math.log10(a)) / (Math.log10(b) - Math.log10(a));
const GOV_GROUPS = [['Democratic republic', '#3987e5', ['PRES', 'PARL', 'SEMI']], ['Constitutional monarchy', '#4fb8b0', ['CMON']], ['Authoritarian republic', '#e08a3c', ['AUTH']],
  ['One-party state', '#d03b3b', ['ONEP']], ['Absolute monarchy', '#9b6fd0', ['AMON']], ['Military government', '#8f7a4a', ['JUNTA']], ['Theocracy', '#5e9c4c', ['THEO']], ['Transitional', '#7d838c', ['TRANS']]];
const BLOC_GROUPS = [['NATO', '#3987e5'], ['CSTO (Russia-led)', '#d03b3b'], ['EU (not NATO)', '#86b6ef'], ['BRICS', '#e08a3c'], ['SCO', '#c9a14a'], ['None of these', '#5b6270']];
function blocOf(n) { const b = n.blocs; return b.includes('NATO') ? 0 : b.includes('CSTO') ? 1 : b.includes('EU') ? 2 : b.includes('BRICS') ? 3 : b.includes('SCO') ? 4 : 5; }

MapModes.add('gdp', 'Economy', c => rampColor(SEQ, logT(gdpUsd(nat(c)), 1e9, 3e13)), { type: 'seq', lo: '$1B', hi: '$30T', title: 'Size of the economy (GDP)' });
MapModes.add('gdppc', 'Wealth', c => { const n = nat(c); return rampColor(SEQ, logT(gdpUsd(n) / n.pop, 300, 1e5)); }, { type: 'seq', lo: '$300', hi: '$100K', title: 'GDP per person' });
MapModes.add('growth', 'Growth', c => divColor(nat(c).growth / 6), { type: 'div', lo: '-6%', mid: '0', hi: '+6%', title: 'Economic growth per year' });
MapModes.add('infl', 'Inflation', c => rampColor(SEQ, logT(Math.max(nat(c).infl, 0.1) + 1, 1, 60)), { type: 'seq', lo: '0%', hi: '60%+', title: 'Inflation' });
MapModes.add('debt', 'Debt', c => rampColor(SEQ, debtPct(nat(c)) / 160), { type: 'seq', lo: '0%', hi: '160%+', title: 'Government debt (% of GDP)' });
MapModes.add('pop', 'Population', c => rampColor(SEQ, logT(nat(c).pop, 1e5, 1.5e9)), { type: 'seq', lo: '100K', hi: '1.5B', title: 'Population' });
MapModes.add('gov', 'Government', c => (GOV_GROUPS.find(g => g[2].includes(nat(c).gov)) || GOV_GROUPS[7])[1], { type: 'cat', items: GOV_GROUPS, title: 'Type of government' });
MapModes.add('blocs', 'Alliances', c => BLOC_GROUPS[blocOf(nat(c))][1], { type: 'cat', items: BLOC_GROUPS, title: 'Alliances and blocs' });
MapModes.add('mil', 'Military', c => rampColor(SEQ, logT(nat(c).milx, 1e8, 1e12)), { type: 'seq', lo: '$0.1B', hi: '$1T', title: 'Military spending per year' });
MapModes.add('stab', 'Stability', c => divColor((nat(c).stability - 50) / 40), { type: 'div', lo: 'Chaos', mid: '', hi: 'Calm', title: 'Stability' });
MapModes.list.find(m => m.id === 'political').legend = null;

function showLegend(m) {
  const el = $('#legend'), L = m.legend;
  if (!L || (UI.screen !== 'hud' && UI.screen !== 'game')) { el.classList.add('hidden'); return; }
  let h = '<b>' + L.title + '</b>';
  if (L.type === 'seq') h += `<div class="ramp" style="background:linear-gradient(90deg,${SEQ.join(',')})"></div><div class="ends"><span>${L.lo}</span><span>${L.hi}</span></div>`;
  else if (L.type === 'div') h += `<div class="ramp" style="background:linear-gradient(90deg,${DIV_NEG},${DIV_MID},${DIV_POS})"></div><div class="ends"><span>${L.lo}</span><span>${L.mid}</span><span>${L.hi}</span></div>`;
  else h += L.items.map(([name, col]) => `<div class="cat"><i style="background:${col}"></i>${name}</div>`).join('');
  el.innerHTML = h; el.classList.remove('hidden');
}

// ---- top bar ----
const STAT_CHIPS = [
  { id: 'approval', name: 'Approval', v: n => n.approval.toFixed(0) + '%', why: 'approval', good: 1 },
  { id: 'stability', name: 'Stability', v: n => n.stability.toFixed(0), why: 'stability', good: 1 },
  { id: 'gdp', name: 'GDP', v: n => '$' + fmtBig(gdpUsd(n)), why: 'growth', good: 1 },
  { id: 'growth', name: 'Growth', v: n => (n.growth >= 0 ? '+' : '') + n.growth.toFixed(1) + '%', why: 'growth', good: 1 },
  { id: 'infl', name: 'Inflation', v: n => n.infl.toFixed(1) + '%', why: 'infl', good: -1 },
  { id: 'unemp', name: 'Jobless', v: n => n.unemp.toFixed(1) + '%', why: 'unemp', good: -1 },
  { id: 'debt', name: 'Debt', v: n => debtPct(n).toFixed(0) + '%', why: 'budget', good: -1 },
  { id: 'deficit', name: 'Budget', v: n => { const d = (n.budget || budgetOf(n)).deficit; return (d > 0 ? '-' : '+') + Math.abs(d).toFixed(1) + '%'; }, why: 'budget', good: 1 }
];
const WHY_TITLES = { approval: 'Approval: what moves it', stability: 'Stability: what moves it', growth: 'Growth: what moves it (% a year)', infl: 'Inflation: what moves it (% a year)', unemp: 'Unemployment: what moves it (%)', yield: 'Borrowing cost: what sets it (%)', budget: 'Budget (% of GDP)', trust: 'Trust in the currency' };

const Game = {
  panel: null, prev: {},
  start() {
    UI.show('game'); UI.select(null); this.renderNav(); this.renderSpeeds(); this.refresh(true);
    const c = World.countries[G.player.idx];
    UI.home = c.idx; Globe.uni.home.value = c.idx;
    $('#hud-nation').innerHTML = `<span class="fl">${c.flag}</span><span>${esc(c.name)}<div class="sub">${esc(G.player.title + ' ' + G.player.name)}</div></span>`;
    flyToCountry(c);
    syncCrowds(); if (Life.refreshProjects) Life.refreshProjects();
    Clock.paused = true; Bus.emit('clock');
    this.open('overview');
  },
  renderNav() {
    const items = [['overview', '◉', 'Overview'], ['economy', '📈', 'Economy'], ['budget', '⚖', 'Budget'], ['money', '💰', 'Money & Debt'], ['laws', '📜', 'Laws'], ['parliament', '🏛', 'Parliament'], ['cabinet', '👥', 'Cabinet'], ['projects', '🏗', 'Projects'], ['people', '🗣', 'People'], ['election', '🗳', 'Elections'], ['news', '📰', 'News'], ['diplomacy', '🤝', 'Diplomacy'], ['world', '🌍', 'World'], ['inbox', '✉', 'Inbox']];
    $('#nav').innerHTML = items.map(([id, ic, name]) => `<button data-panel="${id}"><i>${ic}</i>${name}</button>`).join('');
  },
  renderSpeeds() { $('#speeds').innerHTML = [1, 2, 3, 4, 5].map(s => `<button data-speed="${s}" title="Speed ${s} (${s})"></button>`).join(''); },
  refresh(full) {
    if (!G) return;
    const n = G.nations[G.player.idx];
    $('#date').textContent = fmtDate(G.day); $('#date').classList.toggle('paused', Clock.paused);
    $('#btn-pause').innerHTML = Clock.paused ? '&#9654;' : '&#10074;&#10074;'; $('#btn-pause').classList.toggle('on', Clock.paused);
    $$('#speeds button').forEach(b => b.classList.toggle('on', +b.dataset.speed <= Clock.speed));
    $('#stats').innerHTML = STAT_CHIPS.map(s => {
      const h = n.hist[s.id === 'gdp' ? 'gdp' : s.id] || [], last = h.length > 1 ? h[h.length - 2] : null, cur = h[h.length - 1];
      const arrow = last == null || Math.abs(cur - last) < 1e-6 ? '' : (cur > last) === (s.good > 0) ? '<span class="up">▲</span>' : '<span class="down">▼</span>';
      return `<button class="stat" data-why="${s.why}" data-stat="${s.id}"><small>${s.name}</small><b>${s.v(n)}</b> ${arrow}</button>`;
    }).join('');
    const unread = G.inbox.filter(m => !m.read).length; $('#unread').textContent = unread ? unread : '';
  },
  open(id) {
    if (this.panel === id && !$('#panel').classList.contains('hidden')) { this.close(); return; }
    this.panel = id; $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.panel === id));
    $('#panel').classList.remove('hidden'); this.renderPanel();
  },
  close() { this.panel = null; $('#panel').classList.add('hidden'); $$('#nav button').forEach(b => b.classList.remove('on')); },
  renderPanel() { if (this.panel && Panels[this.panel]) { const el = $('#panel'), st = el.scrollTop; Panels[this.panel](el); el.scrollTop = st; } },
  why(key, anchor) {
    const n = G.nations[G.player.idx], el = $('#why');
    let rows, total, unit = '';
    if (key === 'budget') {
      const b = n.budget || budgetOf(n);
      rows = [['Tax income', b.rev], ['Oil and gas income', b.rent], ['Reserve currency income', b.seign], ['Spending', -b.spend], ['Interest on debt', -b.interest]].filter(r => Math.abs(r[1]) > 0.005);
      total = -b.deficit; unit = '%';
    } else if (key === 'trust') {
      const c = G.cur[n.mon.cur]; rows = (c && c.why) || currencyTrust(n.mon.cur).parts; total = rows.reduce((a, r) => a + r[1], 0);
    } else {
      rows = n.why[key]; if (!rows) { rows = [['Let one month pass to see the breakdown', 0]]; }
      total = rows.reduce((a, r) => a + r[1], 0);
    }
    const sorted = rows.slice().sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).filter(r => Math.abs(r[1]) >= 0.005 || rows.length < 3);
    const f = v => (v > 0 ? '+' : '') + v.toFixed(Math.abs(v) < 10 ? 2 : 1) + unit;
    el.innerHTML = `<h4>${WHY_TITLES[key] || key}</h4>` + sorted.map(([l, v]) => `<div class="r"><span>${esc(l)}</span><b class="${v > 0 ? 'up' : v < 0 ? 'down' : ''}">${f(v)}</b></div>`).join('')
      + `<div class="r tot"><span>${key === 'budget' ? (total >= 0 ? 'Surplus' : 'Deficit') : 'Heading toward'}</span><b>${f(total)}</b></div>`
      + (key !== 'budget' && key !== 'trust' ? '<div class="sub" style="margin-top:6px">The real number moves toward this total over a few months.</div>' : '');
    const r = anchor.getBoundingClientRect(), sc = Settings.ui || 1;
    el.style.left = clamp(r.left / sc, 8, innerWidth / sc - 310) + 'px'; el.style.top = (r.bottom / sc + 6) + 'px';
    el.classList.remove('hidden');
  },
  colorsTick() { const m = MapModes.get(UI.mode); if (m.id !== 'political' && m.id !== 'regions' && m.id !== 'size') setCountryColors(m.color); }
};

document.addEventListener('click', e => {
  const t = e.target;
  const w = t.closest('[data-why]');
  if (w && G) { e.stopPropagation(); Game.why(w.dataset.why, w); return; }
  if (!t.closest('#why')) $('#why').classList.add('hidden');
  const p = t.closest('[data-panel]'); if (p && G) Game.open(p.dataset.panel);
  const s = t.closest('[data-speed]'); if (s) { Clock.set(+s.dataset.speed); }
  const a = t.closest('[data-act]');
  if (a && G) {
    if (a.dataset.act === 'pause') Clock.toggle();
    else if (a.dataset.act === 'inbox') Game.open('inbox');
    else if (a.dataset.act === 'close-panel') Game.close();
  }
}, true);
Bus.on('clock', () => Game.refresh());
Bus.on('day', () => { $('#date').textContent = fmtDate(G.day); });
Bus.on('month', () => { Globe.dirty = true; Game.refresh(); Game.renderPanel(); Game.colorsTick(); if (UI.selected != null && UI.screen === 'game') UI.select(UI.selected); });
Bus.on('changed', () => { const n = G.nations[G.player.idx]; n.budget = budgetOf(n); Game.refresh(); Game.renderPanel(); });
Bus.on('inbox', () => Game.refresh());
Bus.on('key', (k, e) => {
  if (UI.screen !== 'game' || !G) return;
  if (k === ' ') { e.preventDefault(); Clock.toggle(); }
  else if (/^[1-5]$/.test(k) && e.shiftKey === false && !e.altKey) Clock.set(+k);
});
