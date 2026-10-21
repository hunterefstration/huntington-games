// Time, the inbox, player actions on money and debt, and saves.
const SPEEDS = [0, 1, 2.5, 6, 15, 30]; // days per second
const Clock = {
  acc: 0, paused: true, speed: 1,
  step(dt) {
    if (!G || this.paused || UI.screen !== 'game' || !$('#modal').classList.contains('hidden')) return false;
    this.acc += dt * SPEEDS[this.speed];
    let changed = false;
    while (this.acc >= 1) { this.acc -= 1; nextDay(); changed = true; if (this.paused) { this.acc = 0; break; } }
    return changed;
  },
  set(speed) { this.speed = clamp(speed, 1, 5); this.paused = false; Bus.emit('clock'); },
  toggle() { this.paused = !this.paused; Bus.emit('clock'); },
  pause() { this.paused = true; Bus.emit('clock'); }
};

function nextDay() {
  G.day++;
  if (dateOf(G.day).getUTCDate() === 1) nextMonth();
  Bus.emit('day');
}
function nextMonth() {
  const p = G.nations[G.player.idx], before = { approval: p.approval, gdp: gdpUsd(p), infl: p.infl, unemp: p.unemp, debt: debtPct(p) };
  worldMonth(true);
  recordHistory(false);
  const d = (a, b, f) => (b - a >= 0 ? '+' : '') + f(b - a);
  inbox('report', 'Monthly report: ' + fmtMonth(G.day - 1),
    `Approval ${p.approval.toFixed(0)}% (${d(before.approval, p.approval, x => x.toFixed(1))}), growth ${p.growth.toFixed(1)}%, inflation ${p.infl.toFixed(1)}%, unemployment ${p.unemp.toFixed(1)}%, debt ${debtPct(p).toFixed(0)}% of GDP.`);
  if (p.imf > 0 && --p.imf === 0) inbox('good', 'IMF programme finished', 'We can set our own budget freely again.');
  if (p.approval < 20 && GOV[p.gov].free && G.rng() < 0.05) inbox('bad', 'Calls to resign', 'With approval at ' + p.approval.toFixed(0) + '%, newspapers say you should step down. (Elections and no-confidence votes arrive in a later update.)');
  if (dateOf(G.day).getUTCMonth() % 3 === 0) autosave();
  Bus.emit('month');
}

function inbox(type, title, text) {
  if (!G) return;
  G.inbox.unshift({ id: (G.inboxN = (G.inboxN || 0) + 1), day: G.day, type, title, text, read: false });
  if (G.inbox.length > 80) G.inbox.length = 80;
  if (type === 'crisis') Clock.pause();
  Bus.emit('inbox', G.inbox[0]);
}
function newsWorld(text) { if (G) { G.log.unshift({ day: G.day, text }); if (G.log.length > 60) G.log.length = 60; } }

// --- player actions ---
const Gov = {
  me() { return G.nations[G.player.idx]; },
  applyBudget(tax, spend) {
    const n = this.me(), b0 = budgetOf(n);
    Object.assign(n.tax, tax); Object.assign(n.spend, spend);
    const b1 = budgetOf(n);
    n.budget = b1;
    inbox('info', 'New budget passed', `Spending ${b1.spend.toFixed(1)}% of GDP, tax income ${b1.rev.toFixed(1)}%. The budget ${b1.deficit > 0 ? 'deficit' : 'surplus'} is now ${Math.abs(b1.deficit).toFixed(1)}% of GDP (was ${b0.deficit.toFixed(1)}%).`);
    Bus.emit('changed');
  },
  setIndependent(on) {
    const n = this.me(); if (n.mon.type !== 'float') return;
    n.mon.independent = on;
    if (!on) { n.evGrowth -= 0.3; n.ratingOff -= 1; inbox('bad', 'You took control of the central bank', 'Investors are nervous: borrowing costs rise and inflation expectations will now follow real inflation.'); }
    else { n.ratingOff += 1; inbox('good', 'Central bank made independent', 'Markets cheer. Inflation expectations will slowly settle at the ' + n.mon.target + '% target.'); }
    Bus.emit('changed');
  },
  setRate(v) { const n = this.me(); if (n.mon.type === 'float' && !n.mon.independent) { n.mon.rate = clamp(v, 0, 200); Bus.emit('changed'); } },
  setQE(v) { const n = this.me(); if (n.mon.type === 'float') { n.mon.qe = clamp(v, 0, 25); Bus.emit('changed'); } },
  devalue(pct) {
    const n = this.me(); if (n.mon.type !== 'peg' && n.mon.type !== 'float') return;
    n.fx *= 1 - pct / 100; n.devalued = (n.devalued || 1) * (1 - pct / 100); n.mon.pressure = 0; n.evAppr -= pct / 5; n.evGrowth += pct / 25;
    inbox('info', 'Currency devalued by ' + pct + '%', 'Exports get cheaper and factories gain, but imports and fuel cost more. Expect higher inflation for a year.');
    Bus.emit('changed');
  },
  floatCurrency() {
    const n = this.me(); if (n.mon.type !== 'peg') return;
    n.mon.type = 'float'; n.mon.independent = n.dem >= 6; n.mon.rateOff = n.mon.rate - taylorOf(Object.assign({}, n, { mon: Object.assign({}, n.mon, { rateOff: 0 }) }));
    inbox('info', 'The ' + n.mon.cur + ' now floats', 'Our money finds its own value. We now control interest rates and can print money.');
    Bus.emit('changed');
  },
  pegCurrency(anchor) {
    const n = this.me(); if (n.mon.type !== 'float' || n.mon.cur === anchor) return;
    n.mon.type = 'peg'; n.mon.anchor = anchor; n.mon.qe = 0; n.mon.pressure = 0; n.devalued = 1;
    inbox('info', 'The ' + n.mon.cur + ' is now pegged to the ' + anchor, 'Prices should calm down as our inflation follows theirs, but we gave up our own interest rates and money printing. If the peg looks too high, speculators may attack it.');
    Bus.emit('changed');
  },
  default() {
    const n = this.me(); if (n.debt <= 0) return;
    const cutAmt = doDefault(n);
    inbox('crisis', 'We stopped paying our debts', 'Lenders lose ' + fmtBig(cutAmt * n.fx / 100) + ' dollars. Our debt is cut, but nobody will lend cheaply for years, the currency fell and the economy is in shock.');
    Bus.emit('changed');
  },
  imf() {
    const n = this.me(); if (!(n.crisis || n.rating <= 7) || n.imf > 0) return;
    doIMF(n);
    inbox('info', 'IMF bailout agreed', 'Cheap emergency loans for 3 years. In return we cut spending by 12% and raised sales tax by 2 points. People are angry about the cuts.');
    Bus.emit('changed');
  }
};

// --- saves: 3 slots + autosave, versioned and migrated, never wiped ---
function serialize() {
  const g = Object.assign({}, G, { rng: undefined, rngState: G.rng.state() });
  g.nations = G.nations.map(n => n && Object.assign({}, n, { why: undefined, budget: undefined }));
  return JSON.stringify(g, (k, v) => typeof v === 'number' && !Number.isInteger(v) ? +v.toPrecision(8) : v); // 8 digits is plenty, halves the size
}
async function gzip64(text) {
  const cs = new Blob([new TextEncoder().encode(text)]).stream().pipeThrough(new CompressionStream('gzip'));
  const buf = new Uint8Array(await new Response(cs).arrayBuffer());
  let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode(...buf.subarray(i, i + 8192));
  return btoa(s);
}
async function gunzip64(b64) {
  const bin = atob(b64), buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}
function deserialize(json) {
  const g = JSON.parse(json);
  migrate(g);
  g.rng = makeRng(0); g.rng.set(g.rngState);
  g.nations = g.nations.map(n => n && Object.assign(n, { why: {} }));
  for (const n of g.nations) if (n) n.budget = null;
  return g;
}
function migrate(g) {
  if (!g.v || g.v > SAVE_VERSION) throw new Error('This save is from a newer version of Sovereign.');
  // future: if (g.v < 2) { ...; g.v = 2; }
}
function saveMeta() { const n = G.nations[G.player.idx]; return { country: World.countries[n.idx].name, flag: World.countries[n.idx].flag, leader: G.player.name, date: fmtDate(G.day), at: Date.now() }; }
async function saveTo(slot) {
  try { const meta = saveMeta(); localStorage.setItem('sov.save.' + slot, 'gz:' + await gzip64(serialize())); Store.set('meta.' + slot, meta); return true; }
  catch (e) { toast('Could not save: browser storage is full'); return false; }
}
async function loadFrom(slot) {
  let raw = null; try { raw = localStorage.getItem('sov.save.' + slot); } catch (e) {}
  if (!raw) return false;
  G = deserialize(raw.startsWith('gz:') ? await gunzip64(raw.slice(3)) : raw); for (const n of G.nations) if (n) n.budget = budgetOf(n);
  return true;
}
function autosave() { if (G) saveTo('auto'); }
async function exportSave() { return 'SOV1:' + await gzip64(serialize()); }
async function importSave(code) {
  G = deserialize(await gunzip64(code.trim().replace(/^SOV1:/, ''))); for (const n of G.nations) if (n) n.budget = budgetOf(n);
}
