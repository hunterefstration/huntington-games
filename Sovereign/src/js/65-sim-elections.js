// Staying in power: elections and campaigns, term limits, no-confidence votes, impeachment, coups, revolutions, endings.
// Known next national elections after July 2026 (approximate dates); others follow their term length.
const NEXT_ELECTION = { USA: '2028-11-07', BRA: '2026-10-04', ISR: '2026-10-27', SWE: '2026-09-13', DNK: '2026-10-31', NZL: '2026-11-07', FRA: '2027-04-25',
  GBR: '2029-05-03', DEU: '2029-09-23', JPN: '2028-10-01', IND: '2029-04-15', CAN: '2029-10-15', AUS: '2028-05-20', ITA: '2027-09-20', ESP: '2027-07-23',
  KOR: '2030-06-03', MEX: '2030-06-02', ARG: '2027-10-24', POL: '2027-10-15', TUR: '2028-05-14', ZAF: '2029-05-15', NGA: '2027-02-20', IDN: '2029-02-14',
  PHL: '2028-05-08', KEN: '2027-08-09', COL: '2030-05-31', CHL: '2029-11-18', NLD: '2029-03-15', PRT: '2030-01-30', GRC: '2027-06-20', IRL: '2029-11-29',
  NOR: '2029-09-10', FIN: '2027-04-18', TWN: '2028-01-15', PAK: '2029-02-08', CZE: '2029-10-05', HUN: '2030-04-10', AUT: '2029-09-30', BEL: '2029-06-09' };
const MIDTERMS = { USA: '2026-11-03' };
const TERM_YEARS = { USA: 4, MEX: 6, FRA: 5, RUS: 6, BRA: 4, KOR: 5, PHL: 6, CHL: 4, COL: 4, PER: 5, ARG: 4, IDN: 5, TUR: 5, NGA: 4, ZAF: 5, IND: 5, GBR: 5, CAN: 4, AUS: 3, NZL: 3, JPN: 4, DEU: 4, ITA: 5 };
// terms already served by the real leader, counting the current one (for term limits)
const REAL_TERMS = { USA: 2, FRA: 2, TUR: 2, BRA: 1, ARG: 1, IDN: 1, COL: 1, KEN: 1, NGA: 1, GHA: 2, SEN: 1, ZAF: 2 };
const dayOf = iso => Math.round((Date.parse(iso + 'T00:00:00Z') - START_DAY) / 864e5);
function regionsOf(n) {
  if (n.regions) return n.regions;
  const cities = World.cities.filter(c => c.c === n.idx).sort((a, b) => b.pop - a.pop).slice(0, 8), r = makeRng(n.idx * 31 + 5);
  const tot = cities.reduce((a, c) => a + Math.sqrt(c.pop), 0) || 1;
  return n.regions = cities.map(c => ({ city: World.cities.indexOf(c), name: c.name, w: Math.sqrt(c.pop) / tot, lean: c.cap ? 3 : Math.round((r() - 0.5) * 14), boost: 0 }));
}
SYSTEM_INITS.push(g => {
  const n = g.nations[g.player.idx], P = g.player;
  if (P.terms == null) P.terms = P.real ? (REAL_TERMS[n.id] || 1) : 1;
  if (n.nextElection == null && free(n)) {
    const term = TERM_YEARS[n.id] || (n.gov === 'SEMI' ? 5 : 4);
    n.nextElection = NEXT_ELECTION[n.id] ? dayOf(NEXT_ELECTION[n.id]) : 300 + Math.floor(makeRng(g.seed)() * term * 365);
    n.termDays = term * 365;
    if (MIDTERMS[n.id]) n.midterm = dayOf(MIDTERMS[n.id]);
  }
  if (n.lowStab == null) n.lowStab = 0;
  if (!n.promises) n.promises = [];
  for (const m of g.nations) if (m && m.idx !== n.idx && m.aiElection == null && GOV[m.gov].free) m.aiElection = NEXT_ELECTION[m.id] ? dayOf(NEXT_ELECTION[m.id]) : 30 + Math.floor(makeRng(m.idx)() * 4 * 365);
});

// ---- the player's elections
function voteShare(n, region) { // share for the player's side in one region
  const P = G.player, econ = clamp(0.5 * feelOf(n) - 0.5 * n.base.feel, -10, 10);
  return clamp(n.approval * 0.85 + 8 + econ + region.lean + region.boost + (n.campaign || 0) + (G.rng() - 0.5) * 6 - (n.rigged ? 0 : 0) + (n.rigged ? 15 : 0), 3, 97);
}
function runElection(n, kind) {
  const regs = regionsOf(n), res = regs.map(r => ({ name: r.name, city: r.city, w: r.w, me: voteShare(n, r) }));
  const total = res.reduce((a, r) => a + r.me * r.w, 0);
  let won;
  const pres = ['PRES', 'SEMI'].includes(n.gov) && kind !== 'midterm';
  if (pres) won = total > 50;
  // parliament: our party's share of seats follows our vote, partners keep theirs
  const P = n.parl, mine = P.parties.find(p => p.id === 'me'), oldMine = mine.seats;
  const partyVote = clamp(total * 0.8, 5, 75) / 100;
  mine.seats = Math.round(P.total * partyVote);
  const others = P.parties.filter(p => p.id !== 'me'), osum = others.reduce((a, p) => a + p.seats, 0) || 1, left = P.total - mine.seats;
  others.forEach(p => p.seats = Math.max(0, Math.round(left * p.seats / osum * (0.8 + G.rng() * 0.4))));
  const diff = P.total - P.parties.reduce((a, p) => a + p.seats, 0); others[0].seats += diff;
  // coalition: keep partners, add the closest until a majority
  others.forEach(p => p.gov = p.gov && p.seats > 0);
  let have = P.parties.filter(p => p.gov).reduce((a, p) => a + p.seats, 0);
  for (const p of others.filter(p => !p.gov).sort((a, b) => Math.hypot(a.ideo[0] - G.player.econ, a.ideo[1] - G.player.social) - Math.hypot(b.ideo[0] - G.player.econ, b.ideo[1] - G.player.social))) {
    if (have > P.total / 2) break; p.gov = true; have += p.seats;
  }
  if (!pres && kind !== 'midterm') won = have > P.total / 2;
  if (kind === 'midterm') won = true;
  n.campaign = 0; n.rigged = false; regs.forEach(r => r.boost = 0);
  return { res, total, won, pres, seats: mine.seats, oldSeats: oldMine, govSeats: have, kind };
}
const Campaign = {
  active(n) { return n.nextElection != null && n.nextElection - G.day <= 120 && n.nextElection > G.day; },
  rally(cityIdx) {
    const n = G.nations[G.player.idx]; if (n.pc < 3) return 'Not enough political capital.';
    n.pc -= 3; const r = regionsOf(n).find(x => x.city === cityIdx); if (r) r.boost += 3 + G.rng() * 2;
    addCrowd(n, cityIdx, 'rally', GROUPS[0], 8, 'campaign'); flyTo(World.cities[cityIdx].lon, World.cities[cityIdx].lat, 0.004);
    Bus.emit('changed'); return 'Big crowd in ' + World.cities[cityIdx].name + '!';
  },
  ads() { const n = G.nations[G.player.idx]; if (n.pc < 6) return 'Not enough political capital.'; n.pc -= 6; n.campaign = (n.campaign || 0) + 1.5 + G.rng(); Bus.emit('changed'); return 'Ads are running everywhere.'; },
  promise(p) {
    const n = G.nations[G.player.idx]; if (n.promises.some(x => x.id === p.id)) return 'Already promised.';
    n.promises.push({ id: p.id, text: p.text, stat: p.stat, dir: p.dir, start: p.get(n), due: G.day + 540 }); n.campaign = (n.campaign || 0) + 1.2;
    react(n, { title: 'Promise: ' + p.text, stance: p.groups, size: 0.8, topic: 'Promise' }); Bus.emit('changed'); return 'Promise made. Keep it within 18 months!';
  },
  rig() { const n = G.nations[G.player.idx]; n.rigged = true; if (G.rng() < 0.3) { n.exposed = true; } Bus.emit('changed'); return 'The count will be "managed".'; }
};
const PROMISES = [
  { id: 'notax', text: 'No new taxes', stat: 'Tax income', dir: -1, get: n => budgetOf(n).rev, groups: { workers: 3, business: 3, elite: 2 } },
  { id: 'jobs', text: 'Cut unemployment', stat: 'Unemployment', dir: -1, get: n => n.unemp, groups: { workers: 4, youth: 3 } },
  { id: 'prices', text: 'Bring prices down', stat: 'Inflation', dir: -1, get: n => n.infl, groups: { retirees: 4, workers: 2 } },
  { id: 'health', text: 'More money for hospitals', stat: 'Health spending', dir: 1, get: n => n.spend.health, groups: { retirees: 4, workers: 3 } },
  { id: 'safety', text: 'Safer streets', stat: 'Stability', dir: 1, get: n => n.stability, groups: { police: 4, retirees: 3 } },
  { id: 'debt', text: 'Cut the debt', stat: 'Debt', dir: -1, get: n => debtPct(n), groups: { business: 4, elite: 3 } }
];
// debate: two questions, answers please different groups
const DEBATE = [
  { q: 'The moderator asks: "Prices are up. What will you do about it?"', a: [['Cut taxes so families keep more', { workers: 3, business: 4, elite: 3 }], ['Cap prices on food and energy', { workers: 5, retirees: 4, business: -5 }], ['Trust the central bank and stay calm', { business: 3, media: 2, workers: -2 }]] },
  { q: 'Your rival says you have broken the country. Your reply?', a: [['Attack their record hard', { media: -2, military: 2, youth: 2 }], ['Talk about your plan for the future', { students: 3, media: 3, business: 2 }], ['Make a joke and smile', { youth: 4, retirees: 1 }]] }
];

function electionsMonth(n) {
  // promises come due
  for (const p of n.promises.slice()) if (G.day >= p.due) {
    const P = PROMISES.find(x => x.id === p.id), kept = (P.get(n) - p.start) * p.dir > 0;
    n.promises.splice(n.promises.indexOf(p), 1);
    react(n, { title: (kept ? 'Promise kept: ' : 'Broken promise: ') + p.text, stance: kept ? P.groups : Object.fromEntries(Object.entries(P.groups).map(([k, v]) => [k, -v * 1.5])), size: 1, mood: kept ? 0.3 : -0.4, topic: 'Promises' });
  }
  if (n.nextElection != null && n.nextElection - G.day <= 120 && n.nextElection - G.day > 90) inbox('info', 'Election campaign begins', 'The election is on ' + fmtDate(n.nextElection) + '. Open the Election screen to hold rallies, run ads, make promises and debate.');
  // revolutions and coups (any country), no confidence and impeachment (free ones)
  n.lowStab = n.stability < 14 ? n.lowStab + 1 : 0;
  if (n.lowStab >= 3 && G.rng() < 0.35) return crisis(n, 'revolution');
  const mil = n.groups ? n.groups.military : 50, coupP = Math.max(0, (42 - mil) / 100 * cloutOf(n, 'military') * 0.06 + (n.stability < 30 ? 0.006 : 0)) * (free(n) ? 0.12 : 1) * (G.player.traits.includes('warhero') ? 0.5 : 1);
  if (G.rng() < coupP) return crisis(n, 'coup');
  if (free(n) && ['PARL', 'CMON'].includes(n.gov) && n.approval < 24 && G.rng() < (24 - n.approval) / 60) return crisis(n, 'noconf');
  if (free(n) && ['PRES', 'SEMI'].includes(n.gov) && n.approval < 20 && n.parl.parties.filter(p => p.gov).reduce((a, p) => a + p.seats, 0) < n.parl.total / 2 && G.rng() < 0.08) return crisis(n, 'impeach');
}
function electionsDay() {
  if (G.sim) return;
  const n = G.nations[G.player.idx];
  if (n.midterm != null && G.day === n.midterm) { const r = runElection(n, 'midterm'); n.midterm = null; ElectionNight.show(n, r); }
  if (n.nextElection != null && G.day === n.nextElection - 1) Clock.pause();
  if (n.nextElection != null && G.day >= n.nextElection) {
    const limit = [0, 3, 2, 1][n.laws.termlimit || 0];
    if (limit && G.player.terms >= limit && ['PRES', 'SEMI'].includes(n.gov)) { endGame('term', 'Term over', `${G.player.title} ${G.player.name} steps down after ${G.player.terms} term${G.player.terms > 1 ? 's' : ''}, as the constitution demands.`); return; }
    const r = runElection(n, 'main');
    n.nextElection = G.day + (n.termDays || 1460);
    ElectionNight.show(n, r);
  }
}
DAILY.push(electionsDay);
MONTHLY.push(() => { if (!G.sim) electionsMonth(G.nations[G.player.idx]); });
MONTHLY.push(aiLeadersMonth);

// AI countries change leaders too: elections, coups, revolutions
function aiLeadersMonth() {
  for (const m of G.nations) {
    if (!m || m.idx === pIdx()) continue;
    const c = World.countries[m.idx];
    if (m.aiElection != null && G.day >= m.aiElection) {
      m.aiElection = G.day + (TERM_YEARS[m.id] || 4) * 365;
      // presidents with term limits must step down; others face the voters
      const limit = ONE_TERM.includes(m.id) ? 1 : ['PRES', 'SEMI'].includes(m.gov) ? 2 : 0;
      if (m.aiTerms == null) m.aiTerms = REAL_TERMS[m.id] || 1;
      if (limit && m.aiTerms >= limit) { newLeader(m, 'succeeds ' + m.leader + ' as president of ' + c.name + ' after the term limit'); m.aiTerms = 1; }
      else if (G.rng() > 1 / (1 + Math.exp(-(m.approval - 42) / 7))) { newLeader(m, 'won the election in ' + c.name); m.aiTerms = 1; }
      else { newsWorld(m.title + ' ' + m.leader + ' re-elected in ' + c.name); m.aiTerms++; }
    } else if (!GOV[m.gov].free && m.stability < 22 && G.rng() < (22 - m.stability) / 1500) {
      m.gov = 'JUNTA'; newLeader(m, 'seized power in a coup in ' + c.name, 'General');
    } else if (m.stability < 8 && G.rng() < 0.01) { m.gov = 'TRANS'; newLeader(m, 'leads a new government after a revolution in ' + c.name); }
  }
}
function newLeader(m, what, title) {
  const r = makeRng(G.seed + m.idx + G.day), c = World.countries[m.idx];
  m.leader = personName(c, r); if (title) m.title = title;
  m.months = 0; m.approval = Math.max(m.approval, 50); m.honeymoon = 1; m.base.approval = m.approval;
  if (m.persona) m.persona = makePersona(m);
  newsWorld(m.leader + ' ' + what);
}

// ---- crises that can end your time in office
function crisis(n, kind) {
  Clock.pause();
  const P = G.player;
  if (kind === 'coup') {
    const chance = clamp(0.35 + (n.groups.police - 50) / 150 + (n.stability - 50) / 200 + (n.groups.military - 30) / 150, 0.1, 0.9);
    UI.modal(`<h2>⚠ Coup attempt!</h2><p class="sub" style="font-size:14px">Tanks are moving toward the capital. Parts of the army have turned against you.</p>
      <div class="menu" style="width:auto"><button class="btn" id="cp-fight">Order loyal troops and police to resist (${Math.round(chance * 100)}% chance)</button>
      <button class="btn" id="cp-deal">Make a deal: give the generals a bigger budget and a say in government</button><button class="btn" id="cp-flee">Flee the country</button></div>`);
    $('#cp-fight').onclick = () => { UI.closeModal(); if (G.rng() < chance) { react(n, { title: 'Coup crushed', stance: { military: -6, police: 6 }, size: 1.5, mood: 0.4 }); n.evStab += 6; inbox('good', 'The coup failed', 'Loyal forces held the capital. The plotters are under arrest.'); } else endGame('coup', 'Overthrown in a coup', `Soldiers took the presidential palace. ${P.title} ${P.name} is out of power.`); };
    $('#cp-deal').onclick = () => { UI.closeModal(); n.spend.defence *= 1.4; n.laws.martial = Math.max(n.laws.martial, 1); applyLaws(n); n.groups.military = 70; n.freeHit = (n.freeHit || 0) - 6; applyLaws(n); react(n, { title: 'Government bows to the generals', stance: { military: 8, media: -6, students: -5 }, size: 1.5 }); Bus.emit('changed'); };
    $('#cp-flee').onclick = () => { UI.closeModal(); endGame('fled', 'Fled the country', `${P.title} ${P.name} escaped abroad as the army took over.`); };
  } else if (kind === 'revolution') {
    const chance = clamp(0.25 + (n.groups.police + n.groups.military - 80) / 200, 0.05, 0.8);
    UI.modal(`<h2>⚠ Revolution!</h2><p class="sub" style="font-size:14px">Millions are in the streets. They want you gone.</p>
      <div class="menu" style="width:auto"><button class="btn" id="rv-crush">Crack down (${Math.round(chance * 100)}% chance, the world will be furious)</button>
      <button class="btn" id="rv-reform">Promise free elections and reforms</button><button class="btn" id="rv-quit">Resign</button></div>`);
    $('#rv-crush').onclick = () => { UI.closeModal(); if (G.rng() < chance) { n.freeHit = (n.freeHit || 0) - 15; applyLaws(n); n.lowStab = 0; n.evStab += 15; react(n, { title: 'Brutal crackdown ends the uprising', stance: { police: 4, military: 3, students: -10, media: -10, minorities: -6 }, size: 2, abroad: -15 }); } else endGame('revolution', 'Swept away by revolution', `The palace fell. ${P.title} ${P.name} was forced out by the people.`); };
    $('#rv-reform').onclick = () => { UI.closeModal(); n.laws.elections = 2; n.laws.oppos = 2; n.laws.press = 2; applyLaws(n); n.lowStab = 0; n.evStab += 12; n.nextElection = G.day + 180; n.termDays = 4 * 365; react(n, { title: 'Leader promises free elections', stance: { students: 6, media: 6, workers: 3, military: -3 }, size: 2, abroad: 8, mood: 0.5 }); Bus.emit('changed'); };
    $('#rv-quit').onclick = () => { UI.closeModal(); endGame('resigned', 'Resigned', `${P.title} ${P.name} stepped down to end the unrest.`); };
  } else if (kind === 'noconf') {
    UI.modal(`<h2>No-confidence vote</h2><p class="sub" style="font-size:14px">With approval at ${n.approval.toFixed(0)}%, your coalition partners are wavering. Parliament votes on whether you can stay.</p>
      <div class="menu" style="width:auto"><button class="btn" id="nc-face">Face the vote</button><button class="btn" id="nc-snap">Call an early election instead</button></div>`);
    $('#nc-face').onclick = () => { UI.closeModal(); const ok = G.rng() < clamp(0.35 + (n.approval - 20) / 30 + n.pc / 300, 0.05, 0.9); if (ok) { inbox('good', 'You survived the vote', 'Parliament backed you, just.'); n.pc = Math.max(0, n.pc - 15); } else endGame('noconf', 'Lost a no-confidence vote', `Parliament voted ${P.title} ${P.name} out of office.`); };
    $('#nc-snap').onclick = () => { UI.closeModal(); n.nextElection = G.day + 45; inbox('info', 'Early election called', 'The country votes on ' + fmtDate(n.nextElection) + '. Campaign hard.'); Bus.emit('changed'); };
  } else if (kind === 'impeach') {
    const ok = G.rng() < 0.6;
    UI.modal(`<h2>Impeachment</h2><p class="sub" style="font-size:14px">The opposition-controlled parliament put you on trial. ${ok ? 'The vote to remove you fell short.' : 'They found the votes.'}</p><div class="actions"><button class="btn small gold" data-act="close-modal">Continue</button></div>`);
    if (!ok) setTimeout(() => endGame('impeached', 'Removed by impeachment', `${P.title} ${P.name} was removed from office by parliament.`), 50);
    else { n.pc = Math.max(0, n.pc - 20); react(n, { title: 'President survives impeachment', stance: { media: -2 }, size: 1.2 }); }
  }
}

// ---- election night on the map
const ElectionNight = {
  show(n, r) {
    Clock.pause(); const c = World.countries[n.idx];
    if (n.exposed) { react(n, { title: 'Proof of vote rigging leaks', stance: { students: -9, media: -9, workers: -4 }, size: 2, abroad: -10 }); n.exposed = false; }
    flyToCountry(c);
    Overlay.marks = [];
    UI.modal(`<h2>${r.kind === 'midterm' ? 'Midterm elections' : 'Election night'}</h2><div id="en-body" class="sub" style="font-size:14px">Counting votes...</div><div id="en-bar" style="height:14px;border-radius:7px;background:rgba(255,255,255,.08);overflow:hidden;margin:10px 0"><div style="height:100%;width:0;background:var(--gold);transition:width .4s"></div></div><div class="actions" id="en-act"></div>`);
    let i = 0, sum = 0, wsum = 0;
    const step = () => {
      if (i < r.res.length) {
        const x = r.res[i++], city = World.cities[x.city]; sum += x.me * x.w; wsum += x.w;
        Overlay.marks.push({ lon: city.lon, lat: city.lat, color: x.me > 50 ? '#e2b65c' : '#6aa7ff', label: x.name + ' ' + x.me.toFixed(0) + '%' }); Globe.dirty = true;
        $('#en-body').innerHTML = `${esc(x.name)}: <b>${x.me.toFixed(1)}%</b> for you`; $('#en-bar div').style.width = (sum / wsum).toFixed(1) + '%';
        setTimeout(step, 650);
      } else this.finish(n, r);
    };
    setTimeout(step, 600);
  },
  finish(n, r) {
    const P = G.player;
    $('#en-body').innerHTML = (r.pres ? `You won <b>${r.total.toFixed(1)}%</b> of the vote. ` : '') + `Your party: <b>${r.seats}</b> seats (was ${r.oldSeats}). Government: ${r.govSeats} of ${n.parl.total}.`;
    if (r.won) {
      if (r.kind !== 'midterm') { P.terms++; n.honeymoon = 1; n.months = Math.min(n.months, 0); }
      $('#en-act').innerHTML = `<b class="up" style="margin-right:auto;font-size:16px">${r.kind === 'midterm' ? 'The results are in.' : 'You won! ' + (P.terms) + (P.terms === 1 ? 'st' : P.terms === 2 ? 'nd' : P.terms === 3 ? 'rd' : 'th') + ' term.'}</b><button class="btn small gold" id="en-ok">Continue</button>`;
      if (r.kind !== 'midterm') react(n, { title: 'Election victory', stance: {}, size: 1.5, mood: 0.6, city: World.cities.findIndex(x => x.c === n.idx && x.cap) });
      $('#en-ok').onclick = () => { UI.closeModal(); Overlay.marks = []; Globe.dirty = true; Bus.emit('changed'); };
    } else {
      $('#en-act').innerHTML = `<b class="down" style="margin-right:auto;font-size:16px">You lost.</b><button class="btn small gold" id="en-ok">Continue</button>`;
      $('#en-ok').onclick = () => { UI.closeModal(); Overlay.marks = []; endGame('lost', 'Voted out', `${P.title} ${P.name} lost the election with ${r.total.toFixed(1)}% of the vote.`); };
    }
  }
};

// ---- the end of a game: newspaper front page, legacy score, Hall of Leaders
function endGame(kind, headline, text) {
  if (!G || G.over || G.sim) return;
  G.over = { kind, headline, text, day: G.day };
  Clock.pause();
  const n = G.nations[G.player.idx], c = World.countries[n.idx], L = legacyScore(n), P = G.player;
  const entry = { country: c.name, flag: c.flag, leader: P.title + ' ' + P.name, years: (G.day / 365).toFixed(1), ending: headline, score: L.total, date: fmtDate(G.day), at: Date.now() };
  const hall = Store.get('hall', []); hall.unshift(entry); Store.set('hall', hall.slice(0, 50));
  try { localStorage.removeItem('sov.save.auto'); } catch (e) {}
  UI.modal(`<div style="background:#f3ecd9;color:#1d1a14;border-radius:6px;padding:18px 20px;font-family:Georgia,serif">
      <div style="text-align:center;border-bottom:3px double #1d1a14;padding-bottom:6px;font-size:13px;letter-spacing:.2em">THE ${esc(c.name.toUpperCase())} CHRONICLE · ${fmtDate(G.day).toUpperCase()}</div>
      <h1 style="font-size:30px;margin:12px 0 6px;line-height:1.1">${esc(headline.toUpperCase())}</h1>
      <p style="font-size:15px;margin:0 0 12px">${esc(text)}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;font-size:13px">${L.parts.map(([k, v]) => `<span>${k}</span><b style="text-align:right">${v >= 0 ? '+' : ''}${Math.round(v)}</b>`).join('')}</div>
      <div style="border-top:1px solid #1d1a14;margin-top:8px;padding-top:6px;font-size:18px;display:flex;justify-content:space-between"><span>Legacy score</span><b>${L.total}</b></div>
      <p style="font-size:13px;font-style:italic;margin:10px 0 0">${esc(historySummary(n))}</p></div>
    <div class="actions"><button class="btn small" id="end-hall">Hall of Leaders</button><button class="btn small gold" id="end-new">Back to title</button></div>`);
  $('#end-new').onclick = () => { UI.closeModal(); G = null; UI.show('title'); };
  $('#end-hall').onclick = () => Hall.open();
  Bus.emit('gameover', G.over);
}
function legacyScore(n) {
  const b = n.base, yrs = Math.max(0.1, G.day / 365);
  const parts = [
    ['Years in office', yrs * 40],
    ['Economy grew', (n.real / (World.nat0[n.idx].real) - 1) * 600],
    ['People\'s approval', (n.approval - 40) * 4],
    ['Stability', (n.stability - b.stability) * 3],
    ['Debt', -(debtPct(n) - b.debtPct) * 2],
    ['Freedom', ((n.freedom || 50) - (n.freedom0 || 50)) * 3],
    ['Prestige', (n.prestige || 0) * 15],
    ['Achievements', (G.ach ? Object.keys(G.ach).length : 0) * 25],
    ['Wars', -(n.warsLost || 0) * 150 + (n.warsWon || 0) * 80]
  ];
  return { parts, total: Math.max(0, Math.round(parts.reduce((a, p) => a + p[1], 0))) };
}
function historySummary(n) {
  const g = (n.real / World.nat0[n.idx].real - 1) * 100, yrs = G.day / 365;
  return `Historians will remember ${yrs.toFixed(1)} years in which the economy ${g >= 0 ? 'grew' : 'shrank'} by ${Math.abs(g).toFixed(0)}%, inflation ended at ${n.infl.toFixed(1)}%, and debt reached ${debtPct(n).toFixed(0)}% of GDP.` +
    ((n.warsWon || 0) + (n.warsLost || 0) ? ` The country fought ${(n.warsWon || 0) + (n.warsLost || 0)} war${(n.warsWon || 0) + (n.warsLost || 0) > 1 ? 's' : ''}.` : ' It stayed at peace.');
}
const Hall = {
  open() {
    const h = Store.get('hall', []);
    UI.modal(`<h2>Hall of Leaders</h2>${h.length ? `<table class="rank"><thead><tr><th>Leader</th><th>Country</th><th>Years</th><th>Ending</th><th>Score</th></tr></thead><tbody>${h.slice().sort((a, b) => b.score - a.score).map(e => `<tr><td>${esc(e.leader)}</td><td>${e.flag} ${esc(e.country)}</td><td>${e.years}</td><td>${esc(e.ending)}</td><td>${e.score}</td></tr>`).join('')}</tbody></table>` : '<p class="sub">No finished games yet.</p>'}
      <div class="actions"><button class="btn small gold" data-act="close-modal">Close</button></div>`);
  }
};

// ---- Election screen (added to Panels in 75-ui-gov.js; Panels does not exist yet here)
const ElectionPanel = {
  election(el) {
    const n = me(), regs = regionsOf(n), est = regs.reduce((a, r) => a + clamp(n.approval * 0.85 + 8 + r.lean + r.boost + (n.campaign || 0), 3, 97) * r.w, 0);
    const limit = [0, 3, 2, 1][n.laws.termlimit || 0];
    if (n.nextElection == null) {
      el.innerHTML = this.head('Elections', 'There are no national elections in ' + World.countries[n.idx].name + '.') +
        `<div class="note-box">Power here rests on keeping the army, police and elite loyal (see People). Low stability can bring revolution; an unhappy army can bring a coup.</div>
        <div class="facts"><b>Army support</b><span>${n.groups.military.toFixed(0)}%</span><b>Police support</b><span>${n.groups.police.toFixed(0)}%</span><b>Elite support</b><span>${n.groups.elite.toFixed(0)}%</span><b>Stability</b><span>${n.stability.toFixed(0)}</span></div>
        <div class="sub">You can introduce elections in Laws → Constitution.</div>`;
      return;
    }
    const camp = Campaign.active(n);
    el.innerHTML = this.head('Elections', 'Next election: ' + fmtDate(n.nextElection) + ` (${Math.max(0, Math.round((n.nextElection - G.day) / 30))} months)`) +
      `<div class="kv"><div><small>Poll (±3)</small><b class="${est > 50 ? 'up' : 'down'}">${est.toFixed(0)}%</b></div><div><small>Terms served</small><b>${G.player.terms}</b><em class="sub">${limit ? 'limit ' + limit : 'no limit'}</em></div><div><small>Political capital</small><b>${n.pc.toFixed(0)}</b></div></div>
      ${limit && G.player.terms >= limit && ['PRES', 'SEMI'].includes(n.gov) ? '<div class="note-box">You cannot run again under the current term limits. Change them in Laws → Constitution (needs two thirds of parliament), or your time ends at the next election.</div>' : ''}
      <h3>Regions</h3>` + regs.map(r => { const v = clamp(n.approval * 0.85 + 8 + r.lean + r.boost + (n.campaign || 0), 3, 97);
        return `<div class="sumrow"><span>${esc(r.name)} <span class="sub">${(r.w * 100).toFixed(0)}% of voters</span></span><span><b class="${v > 50 ? 'up' : 'down'}">${v.toFixed(0)}%</b> ${camp ? `<button class="btn small" data-rally="${r.city}">Rally (3)</button>` : ''}</span></div>`; }).join('') +
      (camp ? `<h3>Campaign</h3><div class="btnrow"><button class="btn small" data-camp="ads">Ad blitz (6)</button><button class="btn small" data-camp="debate">TV debate</button>${n.laws.elections === 1 ? '<button class="btn small" data-camp="rig">Manage the count</button>' : ''}</div>
        <h3>Promises</h3>` + PROMISES.map(p => `<div class="sumrow"><span>${esc(p.text)}</span>${n.promises.some(x => x.id === p.id) ? '<span class="sub">promised</span>' : `<button class="btn small" data-prom="${p.id}">Promise</button>`}</div>`).join('')
        : '<div class="sub" style="margin-top:8px">The campaign opens 4 months before election day: rallies, ads, a TV debate and promises.</div>') +
      (n.promises.length ? '<h3>Promises to keep</h3>' + n.promises.map(p => `<div class="sumrow"><span>${esc(p.text)}</span><span class="sub">by ${fmtDate(p.due)}</span></div>`).join('') : '');
    $$('[data-rally]', el).forEach(b => b.onclick = () => toast(Campaign.rally(+b.dataset.rally)));
    $$('[data-prom]', el).forEach(b => b.onclick = () => toast(Campaign.promise(PROMISES.find(p => p.id === b.dataset.prom))));
    $$('[data-camp]', el).forEach(b => b.onclick = () => { const k = b.dataset.camp; if (k === 'ads') toast(Campaign.ads()); else if (k === 'rig') toast(Campaign.rig()); else Debate.start(); });
  }
};
const Debate = {
  start() {
    const n = G.nations[G.player.idx]; if (n.debated === n.nextElection) { toast('You already debated this campaign.'); return; }
    n.debated = n.nextElection; this.i = 0; this.score = 0; this.ask();
  },
  ask() {
    const d = DEBATE[this.i];
    if (!d) { const n = G.nations[G.player.idx], win = this.score + (G.rng() - 0.4) * 4 + (G.player.traits.includes('charismatic') ? 2 : 0) > 0; n.campaign = (n.campaign || 0) + (win ? 2.5 : -1.5); UI.modal(`<h2>Debate over</h2><p class="sub" style="font-size:14px">${win ? 'Snap polls say you won the debate!' : 'Snap polls say your rival edged it.'}</p><div class="actions"><button class="btn small gold" data-act="close-modal">Continue</button></div>`); Bus.emit('changed'); return; }
    UI.modal(`<h2>TV debate</h2><p style="font-size:15px">${d.q}</p><div class="menu" style="width:auto">${d.a.map((a, i) => `<button class="btn" data-ans="${i}">${esc(a[0])}</button>`).join('')}</div>`);
    $$('[data-ans]').forEach(b => b.onclick = () => { const a = d.a[+b.dataset.ans], n = G.nations[G.player.idx], r = react(n, { title: 'Debate: "' + a[0] + '"', stance: a[1], size: 0.6, topic: 'Debate' }); this.score += r ? r.avg : 0; this.i++; this.ask(); });
  }
};
// Icons on the map for things happening right now (protests, rallies; wars and disasters add theirs)
const ICON_SOURCES = [];
function mapIcons() {
  const out = [], n = G.nations[G.player.idx];
  for (const cr of n.crowds || []) { const c = World.cities[cr.city]; out.push({ lon: c.lon, lat: c.lat, icon: cr.kind === 'protest' ? '✊' : '🎉', ring: cr.kind === 'protest' ? '#ef6b5b' : '#e2b65c', minAlt: 0 }); }
  for (const m of G.nations) if (m && m.idx !== n.idx && m.stability < 22) { const L = World.countries[m.idx].label; out.push({ lon: L.lon, lat: L.lat - 1.5, icon: '🔥', ring: '#ef6b5b' }); }
  for (const f of ICON_SOURCES) out.push(...f());
  return out;
}
