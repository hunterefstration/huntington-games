// ==========================================
// WORLD COUNCIL (1.4): the world's assembly meets every four months (1 January, 1 May, 1 September).
// - A month before each session the agenda is published: resolutions proposed by AI countries (sanctions on an
//   aggressor, peacekeepers for a war, world laws like a climate accord or a global minimum tax) and by you.
// - Every country votes. Sanctions and peacekeepers also need the Security Council: any permanent member can veto.
// - Passed world laws last years. Breaking one (defying the Council) costs relations and influence every month,
//   and sooner or later the world proposes sanctions on you.
// - Council influence (0-100) decides how much your lobbying moves votes; it comes from your economy, your seat,
//   prestige, foreign aid and your record (standing): votes won, resolutions passed, crises fought.
// - Global crises (pandemics, financial panics, an asteroid...) open an emergency session: every country pledges
//   money to a world fund, and the damage everyone takes shrinks as the fund fills.
// All numbers are clamped; AI countries vote with the same rules everywhere (Simulator, online, solo).
// ==========================================
const COUNCIL_SESSION_MONTHS = [0, 4, 8];
const cnName = i => World.countries[i] ? World.countries[i].name : '?';
const cnFlag = i => World.countries[i] ? World.countries[i].flag : '';
const cnVoters = () => G.nations.filter(m => m && m.owner == null);
const cnWorldGdp = () => Math.max(1, G.world.worldGdp || G.nations.reduce((a, n) => a + (n ? gdpUsd(n) : 0), 0));
const cnBloc = (a, b) => ['EU', 'NATO', 'BRICS', 'SCO', 'CSTO', 'AL', 'AU', 'ASEAN', 'GCC', 'MERC'].some(k => a.blocs.includes(k) && b.blocs.includes(k));
const cnWar = it => G.wars.find(w => w.id === it.w);
const cnMe = () => G.nations[G.player.idx];

// ---- the resolutions. ai(m, it): how much country m likes it (about -2..2). ok(n, law): does the player keep the law?
const RESOLUTIONS = {
  sanction: { icon: '⛔', target: 'country', sc: true, years: 3, name: it => 'Sanctions on ' + cnName(it.t),
    desc: 'Every country that votes yes cuts business with them for 3 years. Members must keep the sanctions up.',
    ai: (m, it) => { const t = G.nations[it.t]; return -0.02 * relation(m.idx, it.t) - 0.35 + (G.wars.some(w => w.a[0] === it.t) ? 0.7 : 0) + (m.dem > 7 && t.dem < 4 ? 0.3 : 0) - (hasTreaty(m.idx, it.t, 'trade') ? 0.5 : 0) - (cnBloc(m, t) ? 0.7 : 0); },
    ok: (n, law) => law.t === n.idx || G.sanctions.some(s => s.by === n.idx && s.on === law.t), need: law => 'Keep sanctions on ' + cnName(law.t) },
  condemn: { icon: '📢', target: 'country', years: 0, name: it => 'Condemn ' + cnName(it.t),
    desc: 'A formal condemnation. The world thinks less of them; nothing else happens.',
    ai: (m, it) => { const t = G.nations[it.t]; return -0.02 * relation(m.idx, it.t) - 0.05 + (G.wars.some(w => w.a[0] === it.t) ? 0.7 : 0) + (m.dem > 7 && t.dem < 4 ? 0.3 : 0) - (cnBloc(m, t) ? 0.6 : 0); } },
  peacekeep: { icon: '🕊', target: 'war', sc: true, years: 0.5, name: it => { const w = cnWar(it); return 'Peacekeepers: ' + (w ? cnName(w.a[0]) + ' vs ' + cnName(w.d[0]) : 'a war that ended'); },
    desc: 'Blue helmets and a ceasefire deadline. Wars between AI countries usually stop; an attacker that fights on defies the Council.',
    ai: (m, it) => { const w = cnWar(it); if (!w) return 0; if (w.a.includes(m.idx)) return -3; if (w.d.includes(m.idx)) return 2.5; return 0.3 + 0.01 * (relation(m.idx, w.d[0]) - relation(m.idx, w.a[0])) - (hasTreaty(m.idx, w.a[0], 'defence') ? 1.5 : 0); },
    ok: (n, law) => !G.wars.some(w => w.id === law.w && w.a.includes(n.idx)), need: law => 'Stop attacking in the war (' + (cnWar(law) ? cnName(cnWar(law).a[0]) + ' vs ' + cnName(cnWar(law).d[0]) : 'over') + ')' },
  climate: { icon: '🌱', years: 5, name: () => 'Climate Accord',
    desc: 'Countries must put a price on carbon (carbon tax of at least $20 a tonne). Oil demand falls.',
    ai: m => (m.dev - 0.5) * 1.6 + (m.dem - 5) * 0.08 - (m.rent > 5 ? 1.3 : 0) - (m.res.includes('coal') ? 0.5 : 0) + (World.countries[m.idx].borders.length ? 0 : 0.8),
    ok: n => n.tax.carbon >= 20, need: () => 'Carbon tax of at least $20/t', comply: m => { if (m.dev > 0.4) m.tax.carbon = Math.max(m.tax.carbon, 20); } },
  armscap: { icon: '🛡', years: 5, name: () => 'Arms Control Treaty',
    desc: 'Defence spending capped at 3% of GDP (countries at war are exempt). Fewer wars start while it holds.',
    ai: m => -0.1 - (m.spend.defence - 1.8) * 0.4 - (m.nukes ? 0.8 : 0) - (m.atWar ? 1 : 0) + (m.mil < 50000 ? 0.25 : 0) - ((m.persona || {}).aggr > 60 ? 0.4 : 0),
    ok: n => n.atWar || n.spend.defence <= 3.001, need: () => 'Defence spending at most 3% of GDP (unless at war)', comply: m => { if (!m.atWar) m.spend.defence = Math.min(m.spend.defence, 3); } },
  mintax: { icon: '🏦', years: 6, name: () => 'Global Minimum Tax',
    desc: 'Company tax of at least 15% everywhere. Big economies collect more; tax havens lose their edge.',
    ai: m => (m.tax.corporate - 22) * 0.1 + (m.tax.corporate < 13 ? -1 : 0) + (m.dev - 0.55) * 1.6 - (m.open > 0.55 ? 0.4 : 0) - 0.15,
    ok: n => n.tax.corporate >= 15, need: () => 'Company tax of at least 15%', comply: m => { m.tax.corporate = Math.max(m.tax.corporate, 15); } },
  aidfund: { icon: '🤲', years: 5, name: () => 'World Development Fund',
    desc: 'Rich countries give at least 0.3% of GDP in foreign aid; the poorest countries grow faster while it lasts.',
    ai: m => (0.45 - m.dev) * 2.6 + (m.dem > 8 ? 0.4 : 0) + m.spend.aid * 1.5,
    ok: n => n.dev <= 0.6 || n.spend.aid >= 0.3, need: () => 'Foreign aid of at least 0.3% of GDP (rich countries only)', comply: m => { if (m.dev > 0.6) m.spend.aid = Math.max(m.spend.aid, 0.3); } },
  aisafety: { icon: '🤖', years: 6, name: () => 'AI Safety Pact',
    desc: 'No research into General AI or drone swarms while it holds. Research is 10% slower; the world is calmer.',
    ai: m => 0.1 + (m.dem - 5) * 0.06 + (m.dev < 0.4 ? 0.25 : 0) - m.dev * 0.3 - (m.techLv || 0) * 0.015 - (m.blocs.includes('UNSC') ? 0.4 : 0),
    ok: n => !['agi', 'swarm'].includes(G.tech && G.tech.current) || !G.tech.progress, need: () => 'Do not research General AI or drone swarms' },
  freetrade: { icon: '🚢', years: 5, name: () => 'World Trade Round',
    desc: 'Import tariffs of at most 10%. Open economies grow; protected industries complain.',
    ai: m => (m.open - 0.45) * 3 + (m.tax.tariff < 6 ? 0.5 : m.tax.tariff > 15 ? -0.8 : 0),
    ok: n => n.tax.tariff <= 10, need: () => 'Import tariffs of at most 10%', comply: m => { m.tax.tariff = Math.min(m.tax.tariff, 10); } },
  debtrelief: { icon: '📜', years: 0, name: () => 'Debt Relief for the Poorest',
    desc: 'Poor countries with heavy debts get 30% of it cancelled. Lenders take a small hit.',
    ai: m => (0.4 - m.dev) * 2.5 + (debtPct(m) > 90 ? 0.8 : 0) - (m.dev > 0.75 ? 0.3 : 0) },
  spacetreaty: { icon: '🛰', years: 8, name: () => 'Peaceful Space Treaty',
    desc: 'No weapons in orbit: nobody may build a space shield while it holds. Space powers dislike it.',
    ai: m => 0.2 - m.dev * 0.3 - (m.blocs.includes('UNSC') ? 0.9 : 0) - (m.spend.space > 0.2 ? 0.6 : 0),
    ok: n => G.tech.current !== 'spaceshield' || !G.tech.progress, need: () => 'Do not research the space shield' }
};
const WORLD_LAWS = ['climate', 'armscap', 'mintax', 'aidfund', 'aisafety', 'freetrade', 'debtrelief', 'spacetreaty'];

// ---- global crises
const WORLD_CRISES = {
  pandemic: { icon: '🦠', name: 'The Grey Flu pandemic', months: 14, need: 0.22, text: 'A new flu is spreading across every continent. Hospitals are filling up. The Council has opened a vaccine fund.',
    hit: (m, s) => ({ growth: -1.1 * s, stability: -2.5 * s, approval: -1.5 * s }), win: 'Vaccines for everyone: the Grey Flu is beaten.', lose: 'The Grey Flu burned itself out, but it cost millions of lives and years of growth.' },
  contagion: { icon: '📉', name: 'World financial panic', months: 10, need: 0.3, text: 'A giant bank collapsed overnight and panic is spreading from market to market. The Council is raising a rescue fund.',
    hit: (m, s) => ({ growth: -1.6 * s * (0.4 + m.open), unemp: 0.8 * s }), win: 'The rescue fund calmed the markets. The panic is over.', lose: 'The panic ended on its own, leaving a long recession behind it.' },
  asteroid: { icon: '☄', name: 'Asteroid 2031 KR', months: 16, need: 0.14, text: 'Astronomers confirm it: a 400-metre asteroid is on a collision course with Earth. The Council is funding a mission to push it off course.',
    hit: (m, s) => ({ stability: -1.2 * s, growth: -0.2 * s }), win: 'The deflection mission worked: Asteroid 2031 KR sails safely past Earth. The whole world watched.', lose: 'The mission was never funded. Asteroid 2031 KR has struck the Earth.' },
  famine: { icon: '🌾', name: 'World food crisis', months: 12, need: 0.18, text: 'Failed harvests on three continents at once. Food prices are doubling. The Council is raising a food fund.',
    hit: (m, s) => ({ infl: 2.2 * s, stability: -3 * s * (m.dev < 0.4 ? 1 : 0.3) }), win: 'Grain ships reached every port: the food crisis is over.', lose: 'The food crisis faded with the next harvest, after riots in dozens of countries.' },
  climate: { icon: '🧊', name: 'Climate tipping point', months: 24, need: 0.35, text: 'A huge Antarctic ice shelf has broken away. Sea levels are rising faster than anyone feared. The Council is raising a climate fund.',
    hit: (m, s) => ({ growth: -0.6 * s * (World.countries[m.idx].landlocked ? 0.3 : 1), stability: -1 * s }), win: 'The climate fund built sea walls and clean power worldwide. The worst was avoided.', lose: 'The world did too little. Coastal cities will be fighting the sea for a century.' },
  solar: { icon: '🌞', name: 'Solar superstorm', months: 6, need: 0.1, text: 'The biggest solar storm in 150 years fried satellites and power grids. The Council is funding repairs.',
    hit: (m, s) => ({ growth: -1.2 * s * m.dev }), win: 'The grids are back and satellites are being replaced.', lose: 'The grids came back slowly, one city at a time.' },
  worm: { icon: '🪱', name: 'The Worm: a global cyber plague', months: 8, need: 0.12, text: 'A self-spreading computer virus is shutting down banks, ports and hospitals worldwide. The Council is funding a cure.',
    hit: (m, s) => ({ growth: -0.9 * s * (0.3 + m.dev), stability: -1 * s }), win: 'Programmers from 60 countries cracked the Worm.', lose: 'The Worm was eventually contained, after months of chaos.' }
};
const PLEDGES = [[0, 'Nothing'], [0.1, 'Small (0.1% of GDP)'], [0.3, 'Fair share (0.3% of GDP)'], [0.6, 'Generous (0.6% of GDP)'], [1, 'Lead the world (1% of GDP)']];

const Council = {
  st() { return G.council; },
  def(k) { return RESOLUTIONS[k]; },
  itemName(it) { const d = RESOLUTIONS[it.kind]; return d ? d.name(it) : it.kind; },
  isPerm(i) { return !!(G.nations[i] && G.nations[i].blocs.includes('UNSC')); },
  scMembers() { return G.nations.filter(m => m && m.owner == null && (m.blocs.includes('UNSC') || (G.unsc || []).includes(m.idx))); },
  lawActive(kind) { return G.council.laws.some(l => l.kind === kind); },
  nextSessionDay() {
    for (let d = G.day + 1; d < G.day + 140; d++) { const t = dateOf(d); if (t.getUTCDate() === 1 && COUNCIL_SESSION_MONTHS.includes(t.getUTCMonth())) return d; }
    return G.day + 120;
  },
  // ---- influence (the player's voice at the Council)
  influence(n) {
    n = n || cnMe(); const C = G.council, share = gdpUsd(n) / cnWorldGdp();
    return clamp(4 + 50 * Math.sqrt(clamp(share, 0, 1)) + (this.isPerm(n.idx) ? 15 : (G.unsc || []).includes(n.idx) ? 5 : 0) + Math.min(15, (n.prestige || 0) * 0.5) + Math.min(10, (n.spend.aid || 0) * 15) + (C.standing || 0), 0, 100);
  },
  influenceWhy(n) {
    n = n || cnMe(); const share = gdpUsd(n) / cnWorldGdp();
    return [['Base', 4], ['Size of your economy', 50 * Math.sqrt(clamp(share, 0, 1))], ['Security Council seat', this.isPerm(n.idx) ? 15 : (G.unsc || []).includes(n.idx) ? 5 : 0],
      ['Prestige', Math.min(15, (n.prestige || 0) * 0.5)], ['Foreign aid', Math.min(10, (n.spend.aid || 0) * 15)], ['Your record (votes, resolutions, crises)', G.council.standing || 0]];
  },
  stand(v) { const C = G.council; C.standing = clamp((C.standing || 0) + v, -25, 60); },
  // ---- how a country votes: +1 yes, -1 no, 0 abstain
  score(m, it) {
    const d = RESOLUTIONS[it.kind]; if (!d) return 0;
    if (it.t === m.idx) return -9;
    if (it.by === m.idx) return 9;
    let s = d.ai(m, it);
    if (it.by != null && G.nations[it.by]) s += 0.012 * relation(m.idx, it.by) + (cnBloc(m, G.nations[it.by]) ? 0.3 : 0);
    if (G.scenario && G.scenario.id === 'coldwar' && it.by != null) { const cA = scnCamp(m.idx), cB = scnCamp(it.by); if (cA && cB) s += cA === cB ? 0.6 : -0.6; }
    if (it.lobby) s += it.lobby * clamp((relation(m.idx, G.player.idx) + 30) / 90, 0, 1.3);
    if (it.aid && m.dev < 0.45) s += it.aid;
    return Number.isFinite(s) ? s : 0;
  },
  aiVote(m, it) { const s = this.score(m, it) + (G.rng() - 0.5) * 0.7; return s > 0.25 ? 1 : s < -0.25 ? -1 : 0; },
  // ---- the vote itself
  tally(it, myVote) {
    const me = G.player.idx, sim = !!G.sim, res = { yes: 0, no: 0, abst: 0, veto: null, scYes: 0, yesList: [], votes: {} };
    for (const m of cnVoters()) {
      const v = m.idx === me && !sim ? (myVote || 0) : this.aiVote(m, it);
      res.votes[m.idx] = v;
      if (v > 0) { res.yes++; res.yesList.push(m.idx); } else if (v < 0) res.no++; else res.abst++;
    }
    if (RESOLUTIONS[it.kind].sc) {
      for (const m of this.scMembers()) { const v = res.votes[m.idx] || 0; if (v > 0) res.scYes++; if (v < 0 && this.isPerm(m.idx) && (res.veto == null || m.idx === it.t)) res.veto = m.idx; }
    }
    const total = res.yes + res.no + res.abst;
    res.pass = !res.veto && res.yes > res.no && res.yes >= total * 0.3 && (!RESOLUTIONS[it.kind].sc || res.scYes >= 9);
    return res;
  },
  // ---- proposing
  canPropose() { const C = G.council; return !C.agenda.some(it => it.by === G.player.idx) && C.agenda.length < 5; },
  propose(kind, t, w) {
    const C = G.council, n = cnMe(), d = RESOLUTIONS[kind]; if (!d) return 'Unknown resolution.';
    if (G.sim) return 'Take control of a country first.';
    if (!this.canPropose()) return 'You already have a resolution on this session\'s agenda.';
    if (n.pc < 10) return 'Not enough political capital (10).';
    if (d.target === 'country' && (t == null || !G.nations[t] || t === n.idx)) return 'Pick a country.';
    if (d.target === 'war' && !G.wars.some(x => x.id === w)) return 'Pick a war.';
    if (!d.target && this.lawActive(kind)) return 'That world law is already in force.';
    if (C.agenda.some(it => it.kind === kind && it.t === t && it.w === w)) return 'That is already on the agenda.';
    n.pc -= 10;
    C.agenda.push({ kind, t: d.target === 'country' ? t : null, w: d.target === 'war' ? w : null, by: n.idx, lobby: 0, aid: 0, nLobby: 0 });
    C.stats.proposed = (C.stats.proposed || 0) + 1;
    newsWorld(cnName(n.idx) + ' tables a resolution: ' + this.itemName(C.agenda[C.agenda.length - 1]));
    return 'Your resolution is on the agenda for ' + fmtDate(this.nextSessionDay()) + '.';
  },
  // ---- lobbying: political capital moves friends, aid money moves poor countries
  lobby(i, dir, how) {
    const C = G.council, it = C.agenda[i], n = cnMe(); if (!it) return 'Nothing to lobby for.';
    if (G.sim) return 'Take control of a country first.';
    if ((it.nLobby || 0) >= 3) return 'You have already lobbied hard on this one.';
    const inf = this.influence(n);
    if (how === 'aid') {
      const cost = 0.0015 * gdpL(n); n.debt += cost;
      it.aid = clamp((it.aid || 0) + dir * 1.1 * clamp(Math.sqrt(gdpUsd(n) / 1e12), 0.15, 1.5), -3, 3);
    } else {
      if (n.pc < 5) return 'Not enough political capital (5).'; n.pc -= 5;
      it.lobby = clamp((it.lobby || 0) + dir * (0.45 + inf / 100), -3, 3);
    }
    it.nLobby = (it.nLobby || 0) + 1; it.myDir = dir;
    if (it.vote == null) it.vote = dir;
    const r = this.forecast(it);
    return 'Our diplomats are working the corridors. Latest count: ' + r.yes + ' yes, ' + r.no + ' no' + (r.veto != null ? ' (veto threat from ' + cnName(r.veto) + ')' : '') + '.';
  },
  forecast(it) { const save = G.rng; G.rng = makeRng(G.day * 7 + (it.t || 0) + (it.w || 0) * 3 + it.kind.length); const r = this.tally(it, it.vote || 0); G.rng = save; return r; },
  // ---- AI proposals, published a month before the session
  aiAgenda() {
    const C = G.council, me = G.player.idx, big = G.nations.filter(m => m && m.owner == null && !isHuman(m.idx)).sort((a, b) => gdpUsd(b) - gdpUsd(a)).slice(0, 40);
    const add = it => { if (C.agenda.length < 4 && !C.agenda.some(x => x.kind === it.kind && x.t === it.t && x.w === it.w)) C.agenda.push(Object.assign({ lobby: 0, aid: 0, nLobby: 0 }, it)); };
    const foeOf = t => big.filter(m => m.idx !== t).sort((a, b) => relation(a.idx, t) - relation(b.idx, t))[0];
    // the player keeps defying a law: someone proposes sanctions
    if (!G.sim && Object.values(C.defy || {}).some(v => v >= 5) && G.rng() < 0.6) { const f = foeOf(me); if (f) add({ kind: 'sanction', t: me, by: f.idx }); }
    // wars of aggression
    for (const w of G.wars.slice().sort(() => G.rng() - 0.5)) {
      if (G.day - (w.start || 0) < 60 || w.hh) continue;
      const att = w.a[0], f = foeOf(att); if (!f || f.idx === w.d[0] && G.rng() < 0.5) continue;
      const r = G.rng();
      if (r < 0.35) add({ kind: 'peacekeep', w: w.id, by: f.idx }); else if (r < 0.6) add({ kind: 'sanction', t: att, by: f.idx }); else if (r < 0.75) add({ kind: 'condemn', t: att, by: f.idx });
      if (C.agenda.length >= 2) break;
    }
    // conquerors get condemned
    for (const m of big) if (G.rng() < 0.3 && ruledBy(m.idx).length >= 2) { const f = foeOf(m.idx); if (f) add({ kind: 'condemn', t: m.idx, by: f.idx }); break; }
    if (!G.sim && ruledBy(me).length >= 2 && G.rng() < 0.4) { const f = foeOf(me); if (f) add({ kind: 'condemn', t: me, by: f.idx }); }
    // one world law that is not in force yet, tabled by the big country that wants it most
    const free = WORLD_LAWS.filter(k => !this.lawActive(k) && !(C.cool[k] > G.day));
    if (free.length && C.agenda.length < 4) {
      const kind = free[Math.floor(G.rng() * free.length)];
      const champ = big.slice().sort((a, b) => RESOLUTIONS[kind].ai(b, {}) - RESOLUTIONS[kind].ai(a, {}))[0];
      if (champ) add({ kind, by: champ.idx });
    }
  },
  // ---- the session: resolve every item on the agenda
  session() {
    const C = G.council; if (!C.agenda.length) { C.sessions++; return []; }
    const me = G.player.idx, out = [];
    for (const it of C.agenda) {
      if (RESOLUTIONS[it.kind].target === 'war' && !cnWar(it)) continue;
      const myVote = G.sim ? 0 : it.vote == null ? (C.auto ? Math.sign(Math.round(this.score(cnMe(), Object.assign({}, it, { lobby: 0, aid: 0 })) * 2) / 2) : 0) : it.vote;
      const r = this.tally(it, myVote);
      out.push(this.apply(it, r, myVote));
    }
    C.history = out.concat(C.history).slice(0, 40);
    C.agenda = []; C.sessions++;
    if (!G.sim) {
      const mine = out.filter(o => o.by === me);
      inbox('info', 'World Council: ' + out.filter(o => o.pass).length + ' of ' + out.length + ' resolutions passed', out.map(o => o.title + ': ' + o.result).join('. ') + '.');
      for (const o of mine) toast((o.pass ? '🕊 Your resolution passed: ' : '🕊 Your resolution failed: ') + o.title, 3500);
    }
    return out;
  },
  apply(it, r, myVote) {
    const C = G.council, d = RESOLUTIONS[it.kind], me = G.player.idx, title = this.itemName(it), n = cnMe();
    const result = r.veto != null ? 'vetoed by ' + cnName(r.veto) : (r.pass ? 'passed ' : 'failed ') + r.yes + '-' + r.no + (r.abst ? ' (' + r.abst + ' abstained)' : '');
    newsWorld('World Council: ' + title + ' ' + result);
    const rec = { day: G.day, kind: it.kind, title, by: it.by, t: it.t, pass: r.pass, veto: r.veto, yes: r.yes, no: r.no, abst: r.abst, mine: G.sim ? 0 : myVote, result };
    // the player's vote has consequences
    if (!G.sim) {
      if (it.t != null && it.t !== me) addRel(me, it.t, myVote > 0 ? -8 : myVote < 0 ? 4 : 0);
      if (it.by != null && it.by !== me) addRel(me, it.by, myVote > 0 ? 3 : myVote < 0 ? -3 : 0);
      if (myVote) this.stand((myVote > 0) === r.pass ? 1 : -0.5);
      if (it.by === me) {
        if (r.pass) { this.stand(4); C.stats.passed = (C.stats.passed || 0) + 1; n.prestige = (n.prestige || 0) + 1; react(n, { title: 'Our resolution passes at the World Council', stance: { media: 3, elite: 2 }, size: 0.8, abroad: 3, mood: 0.4, topic: 'WorldCouncil' }); }
        else { this.stand(r.veto != null ? -1 : -2); if (r.veto != null) C.stats.vetoed = (C.stats.vetoed || 0) + 1; }
      }
      if (it.t === me && r.pass) react(n, { title: 'World Council votes against us: ' + title, stance: { media: -3, business: -3, military: 2 }, size: 1.4, abroad: -6, mood: -0.4, topic: 'WorldCouncil' });
    }
    if (!r.pass) { if (!d.target) C.cool[it.kind] = G.day + 365; return rec; }
    // passed: what it does
    const yes = r.yesList;
    if (it.kind === 'sanction') {
      for (const i of yes) if (i !== it.t && !isHuman(i) && !G.sanctions.some(s => s.by === i && s.on === it.t)) G.sanctions.push({ by: i, on: it.t, level: 1, since: G.day, un: true });
      if (!G.sim && myVote > 0 && it.t !== me && !G.sanctions.some(s => s.by === me && s.on === it.t)) G.sanctions.push({ by: me, on: it.t, level: 1, since: G.day, un: true });
      for (const i of yes) addRel(i, it.t, -8);
      G.nations[it.t].evStab -= 4;
      if (it.t === me && !G.sim) inbox('bad', 'The World Council sanctions us', r.yes + ' countries voted to cut business with us for 3 years. Exports and investment will suffer.');
    } else if (it.kind === 'condemn') {
      for (const i of yes) addRel(i, it.t, -6);
      G.nations[it.t].evStab -= 3;
    } else if (it.kind === 'peacekeep') {
      const w = cnWar(it);
      if (w) {
        const humanWar = w.a.concat(w.d).some(i => isHuman(i));
        if (!humanWar && !w.hh && G.rng() < 0.75) endWar(w, 'white', 'talks');
        else { for (const i of w.a) { w.weary[i] = (w.weary[i] || 0) + 25; if (w.will && w.will[i] != null) w.will[i] = clamp(w.will[i] - 15, 0, 100); } for (const i of yes) addRel(i, w.a[0], -5); }
        if (w.d.includes(me) && !G.sim) inbox('good', 'Blue helmets are coming', 'The World Council backs us: peacekeepers and a ceasefire deadline for ' + cnName(w.a[0]) + '.');
      }
    } else if (it.kind === 'debtrelief') {
      for (const m of G.nations) if (m && m.owner == null && m.dev < 0.4 && debtPct(m) > 70) { m.debt *= 0.7; m.evStab += 2; }
      for (const m of G.nations) if (m && m.dev > 0.75) m.evGrowth = (m.evGrowth || 0) - 0.05;
      if (n.dev < 0.4 && !G.sim) inbox('good', 'Debt relief', 'Thanks to the World Council, 30% of our debt has been cancelled.');
    }
    if (d.years) {
      G.council.laws = G.council.laws.filter(l => !(l.kind === it.kind && l.t === it.t && l.w === it.w));
      G.council.laws.push({ kind: it.kind, t: it.t, w: it.w, by: it.by, since: G.day, until: G.day + Math.round(d.years * 365), yes: yes.slice(0, 200) });
      if (d.comply) for (const i of yes) if (!isHuman(i)) d.comply(G.nations[i]);
      if (!G.sim && d.ok && !d.ok(n, it) && it.t !== me) inbox('bad', 'New world law: ' + title, 'We do not meet it yet: ' + d.need(it) + '. Every month we defy the Council costs relations and influence.');
    }
    return rec;
  },
  // ---- every month: laws expire, the player's compliance, AI followers, the crisis
  month() {
    const C = G.council, me = G.player.idx, n = cnMe();
    C.standing = clamp((C.standing || 0) * 0.995, -25, 60);
    for (const l of C.laws.slice()) {
      if (G.day >= l.until || (l.kind === 'peacekeep' && !G.wars.some(w => w.id === l.w))) {
        C.laws.splice(C.laws.indexOf(l), 1);
        if (l.kind === 'sanction') G.sanctions = G.sanctions.filter(s => !(s.un && s.on === l.t && !isHuman(s.by)));
        if (C.defy) delete C.defy[l.kind + (l.t != null ? ':' + l.t : '') + (l.w != null ? ':w' + l.w : '')];
        if (l.kind === 'peacekeep' && G.wars.some(w => w.id === l.w && w.a.includes(me)) && !G.sim) { const f = G.nations.filter(m => m && !isHuman(m.idx)).sort((a, b) => relation(a.idx, me) - relation(b.idx, me))[0]; if (f) C.agenda.push({ kind: 'sanction', t: me, by: f.idx, lobby: 0, aid: 0, nLobby: 0 }); }
        if (!G.sim && l.kind !== 'peacekeep') inbox('info', 'World law expired: ' + this.itemName(l), 'It can be proposed again.');
      }
    }
    // the player's compliance
    if (!G.sim) {
      C.defy = C.defy || {};
      for (const l of C.laws) {
        const d = RESOLUTIONS[l.kind]; if (!d.ok) continue;
        const key = l.kind + (l.t != null ? ':' + l.t : '') + (l.w != null ? ':w' + l.w : '');
        if (d.ok(n, l)) { if (C.defy[key]) delete C.defy[key]; C.complyMonths = (C.complyMonths || 0) + 1; continue; }
        C.defy[key] = (C.defy[key] || 0) + 1; C.defyMonths = (C.defyMonths || 0) + 1;
        this.stand(-0.8);
        for (let k = 0; k < 8 && l.yes.length; k++) addRel(me, l.yes[Math.floor(G.rng() * l.yes.length)], -1.5);
        if (C.defy[key] === 1) inbox('bad', 'We are defying the World Council', d.need(l) + '. Each month costs relations with the ' + l.yes.length + ' countries that voted for it, and Council influence.');
      }
    }
    // world laws at work
    const has = k => this.lawActive(k);
    if (has('climate')) G.world.oil = clamp(G.world.oil * 0.996, 35, 260);
    for (const m of G.nations) {
      if (!m) continue;
      setMod(m, 'growth', 'World laws', (has('aidfund') && m.dev < 0.35 ? 0.35 : 0) + (has('freetrade') && m.open > 0.5 ? 0.08 : 0));
      setMod(m, 'stability', 'World laws', (has('aisafety') ? 0.8 : 0) + (has('armscap') ? 0.5 : 0) + (has('spacetreaty') ? 0.3 : 0));
    }
    this.crisisMonth();
    // a new crisis now and then (never in the first year, at least 3 years apart)
    if (!C.crisis && G.day > 365 && G.day - (C.lastCrisis || -9999) > 1095 && G.rng() < 0.014) this.startCrisis();
    // agenda a month before the session, session on the day
    const mo = dateOf(G.day).getUTCMonth();
    if (COUNCIL_SESSION_MONTHS.includes((mo + 1) % 12)) {
      this.aiAgenda();
      if (!G.sim && C.agenda.length) inbox('info', 'World Council meets on ' + fmtDate(this.nextSessionDay()), 'On the agenda: ' + C.agenda.map(it => this.itemName(it)).join('; ') + '. Open Council to lobby, propose your own resolution and set your votes.');
    }
    if (COUNCIL_SESSION_MONTHS.includes(mo)) {
      if (!G.sim && !C.auto && C.agenda.some(it => it.vote == null)) { C.pending = true; setTimeout(() => Council.showSession(), 80); }
      else this.session();
    }
  },
  // the player chooses: a modal listing the agenda with Yes / No / Abstain
  showSession() {
    const C = G && G.council; if (!C || !C.pending || G.sim) return;
    if (!$('#modal').classList.contains('hidden')) { setTimeout(() => Council.showSession(), 600); return; }
    Clock.pause();
    const votes = C.agenda.map(it => it.vote == null ? 0 : it.vote);
    const paint = () => {
      UI.modal(`<div class="sub" style="text-transform:uppercase;letter-spacing:.1em">🕊 World Council · session ${C.sessions + 1}</div><h2>Cast your votes</h2>
        <p class="sub">${C.agenda.length} resolution${C.agenda.length === 1 ? '' : 's'} on the agenda. Your influence: <b>${this.influence().toFixed(0)}</b>/100. Voting with the winning side raises your standing; voting against a country angers it.</p>
        ${C.agenda.map((it, i) => { const f = this.forecast(Object.assign({}, it, { vote: votes[i] })), d = RESOLUTIONS[it.kind];
          return `<div class="note-box" style="text-align:left"><b>${d.icon} ${esc(this.itemName(it))}</b> <span class="sub">proposed by ${it.by === G.player.idx ? 'us' : cnFlag(it.by) + ' ' + esc(cnName(it.by))}</span>
          <div class="sub">${esc(d.desc)}</div><div class="sub">Expected: ${f.yes} yes, ${f.no} no${f.veto != null ? ', <b class="down">veto by ' + esc(cnName(f.veto)) + '</b>' : ''}</div>
          <div class="btnrow">${[[1, 'Yes'], [-1, 'No'], [0, 'Abstain']].map(([v, l]) => `<button class="btn small${votes[i] === v ? ' gold' : ''}" data-cv="${i}:${v}">${l}</button>`).join('')}</div></div>`; }).join('')}
        <div class="actions"><button class="btn small" id="cv-auto">Let my ambassador decide from now on</button><button class="btn small gold" id="cv-go">Cast votes</button></div>`);
      $$('[data-cv]').forEach(b => b.onclick = () => { const [i, v] = b.dataset.cv.split(':').map(Number); votes[i] = v; paint(); });
      $('#cv-go').onclick = () => { C.agenda.forEach((it, i) => { it.vote = votes[i]; }); C.pending = false; UI.closeModal(); this.session(); Bus.emit('changed'); };
      $('#cv-auto').onclick = () => { C.auto = true; C.pending = false; UI.closeModal(); this.session(); toast('Your ambassador will vote for you (change it in Council).'); Bus.emit('changed'); };
    };
    paint();
  },
  // ---- global crises
  startCrisis(id) {
    const C = G.council, keys = Object.keys(WORLD_CRISES), forced = !!(id && WORLD_CRISES[id]);
    if (!forced) id = keys[Math.floor(G.rng() * keys.length)];
    if (id === 'asteroid' && !forced && G.rng() < 0.5) id = 'pandemic'; // the asteroid is the rarest
    const K = WORLD_CRISES[id];
    C.crisis = { id, start: G.day, months: K.months, left: K.months, need: K.need / 100 * cnWorldGdp(), fund: 0, pledged: {}, asked: false, rally: 0 };
    C.lastCrisis = G.day;
    // AI countries pledge: richer, more honourable and less broke countries give more
    for (const m of G.nations) {
      if (!m || m.owner != null || isHuman(m.idx)) continue;
      const p = m.persona || makePersona(m), rate = clamp(K.need * (0.35 + m.dev * 0.8) * (0.5 + (p.honor || 50) / 100) * (0.5 + G.rng()) * (debtPct(m) > 120 ? 0.5 : 1), 0, 1.2);
      const usdAmt = rate / 100 * gdpUsd(m); if (usdAmt <= 0) continue;
      C.crisis.pledged[m.idx] = +rate.toFixed(3); C.crisis.fund += usdAmt; m.debt += rate / 100 * gdpL(m);
    }
    newsWorld(K.icon + ' ' + K.name + ': the World Council opens an emergency fund');
    if (!G.sim) { inbox('crisis', K.icon + ' Global crisis: ' + K.name, K.text + ' Open Council to pledge money to the world fund.'); setTimeout(() => Council.showPledge(), 120); }
    return C.crisis;
  },
  progress() { const c = G.council.crisis; return c ? clamp(c.fund / Math.max(1, c.need), 0, 1.5) : 0; },
  pledge(pct) {
    const c = G.council.crisis, n = cnMe(); if (!c || G.sim) return 'There is no crisis.';
    const had = c.pledged[n.idx] || 0; if (pct <= had) return 'You already pledged that much.';
    const add = pct - had; n.debt += add / 100 * gdpL(n); c.fund += add / 100 * gdpUsd(n); c.pledged[n.idx] = pct;
    react(n, { title: 'We pledge ' + pct + '% of GDP to the world fund', stance: { media: 2, elite: 1, workers: pct >= 0.6 ? -2 : 0 }, size: 0.6, abroad: pct >= 0.3 ? 3 : 1, mood: 0.2, topic: 'WorldFund' });
    return 'Pledged. The fund is at ' + Math.round(this.progress() * 100) + '%.';
  },
  rally() {
    const c = G.council.crisis, n = cnMe(); if (!c || G.sim) return 'There is no crisis.';
    if ((c.rally || 0) >= 2) return 'You have already rallied the world twice.';
    if (n.pc < 8) return 'Not enough political capital (8).'; n.pc -= 8;
    const extra = c.need * 0.12 * (0.4 + this.influence(n) / 100); c.fund += extra; c.rally = (c.rally || 0) + 1; c.rallied = (c.rallied || 0) + extra;
    return 'Your speech moved the room: other countries added $' + fmtBig(extra) + '. The fund is at ' + Math.round(this.progress() * 100) + '%.';
  },
  showPledge() {
    const C = G && G.council, c = C && C.crisis; if (!c || c.asked || G.sim) return;
    if (!$('#modal').classList.contains('hidden')) { setTimeout(() => Council.showPledge(), 700); return; }
    const K = WORLD_CRISES[c.id], n = cnMe(); c.asked = true; Clock.pause();
    UI.modal(`<div class="sub" style="text-transform:uppercase;letter-spacing:.1em">${K.icon} Emergency session of the World Council</div><h2>${esc(K.name)}</h2><p style="font-size:15px">${esc(K.text)}</p>
      <p class="sub">The fund is at <b>${Math.round(this.progress() * 100)}%</b> of what is needed. Until it is full, every country takes damage each month (less as it fills). Big pledges win prestige and influence; rich countries that give nothing are remembered.</p>
      <div class="menu" style="width:auto">${PLEDGES.map(([p, l]) => `<button class="btn" data-pl="${p}">${l}<div class="sub" style="font-size:12px">${p ? 'Costs $' + fmtBig(p / 100 * gdpUsd(n)) + ' (added to our debt)' : 'Keep our money at home'}</div></button>`).join('')}</div>`);
    $$('[data-pl]').forEach(b => b.onclick = () => { const p = +b.dataset.pl; UI.closeModal(); toast(p ? this.pledge(p) : 'We pledged nothing.'); Bus.emit('changed'); });
  },
  crisisMonth() {
    const C = G.council, c = C.crisis; if (!c) return;
    const K = WORLD_CRISES[c.id], prog = this.progress(), sev = clamp(1 - prog, 0, 1);
    for (const m of G.nations) {
      if (!m) continue;
      const h = K.hit(m, sev);
      setMod(m, 'growth', 'Global crisis', clamp(h.growth || 0, -4, 0)); setMod(m, 'stability', 'Global crisis', clamp(h.stability || 0, -8, 0));
      setMod(m, 'approval', 'Global crisis', clamp(h.approval || 0, -6, 0)); setMod(m, 'infl', 'Global crisis', clamp(h.infl || 0, 0, 5)); setMod(m, 'unemp', 'Global crisis', clamp(h.unemp || 0, 0, 3));
    }
    c.fund += c.need * 0.015 * (0.5 + G.rng()); // AI countries top up as the crisis drags on
    c.left--;
    if (prog >= 1 && G.day - c.start >= 55) return this.endCrisis(true);
    if (c.left <= 0) return this.endCrisis(false);
  },
  endCrisis(won) {
    const C = G.council, c = C.crisis, K = WORLD_CRISES[c.id], me = G.player.idx, n = cnMe();
    for (const m of G.nations) if (m) ['growth', 'stability', 'approval', 'infl', 'unemp'].forEach(s => setMod(m, s, 'Global crisis', 0));
    const mine = G.sim ? 0 : c.pledged[me] || 0;
    if (won) {
      for (const [i, p] of Object.entries(c.pledged)) { const m = G.nations[i]; if (m && p >= 0.3) m.prestige = (m.prestige || 0) + 2; }
      if (!G.sim) {
        if (mine >= 0.1) C.stats.crises = (C.stats.crises || 0) + 1;
        if (mine >= 0.3) { C.stats.bigCrises = (C.stats.bigCrises || 0) + 1; n.prestige = (n.prestige || 0) + 2 + mine * 3; this.stand(4 + mine * 4); n.evAppr += 3; }
      }
    } else {
      for (const m of G.nations) if (m) { m.evGrowth = (m.evGrowth || 0) - 0.8; m.evStab -= 3; }
      if (c.id === 'asteroid') this.impact();
    }
    // rich countries that gave nothing
    if (!G.sim && n.dev > 0.6 && mine < 0.05 && gdpUsd(n) / cnWorldGdp() > 0.004) { this.stand(-5); for (const [i, p] of Object.entries(c.pledged)) if (p >= 0.3 && G.rng() < 0.4) addRel(me, +i, -2); }
    newsWorld(K.icon + ' ' + (won ? K.win : K.lose));
    if (!G.sim) {
      inbox(won ? 'good' : 'bad', K.icon + ' ' + (won ? 'Crisis beaten: ' : 'Crisis over: ') + K.name, (won ? K.win : K.lose) + (mine ? ' We pledged ' + mine + '% of GDP.' : ' We pledged nothing.'));
      react(n, { title: won ? K.win : K.lose, stance: won ? { media: 2 } : { media: -2 }, size: 1, mood: won ? 0.6 : -0.6, topic: 'WorldCrisis' });
    }
    C.crisisLog = [{ id: c.id, day: G.day, won, mine }].concat(C.crisisLog || []).slice(0, 12);
    C.crisis = null;
  },
  impact() {
    // the asteroid lands in one region: never the end of the world, but the worst disaster in history there
    const subs = [...new Set(World.countries.filter(Boolean).map(c => c.sub))].filter(Boolean), sub = subs[Math.floor(G.rng() * subs.length)];
    const hit = G.nations.filter(m => m && World.countries[m.idx].sub === sub);
    for (const m of hit) { m.evGrowth = (m.evGrowth || 0) - 5; m.evStab -= 14; m.evAppr -= 6; m.pop *= 0.995; m.real *= 0.97; }
    G.world.cycleShock = Math.min(G.world.cycleShock, -2.5);
    newsWorld('☄ The asteroid struck ' + sub + '. The world mourns.');
    if (!G.sim && hit.some(m => m.idx === G.player.idx)) inbox('crisis', '☄ The asteroid hit our region', 'Cities are flattened and the sky is dark with dust. We will need years to recover.');
    G.council.impact = sub;
  }
};
function councilMonth() { if (G && G.council) Council.month(); }
SYSTEM_INITS.push(g => {
  g.council = g.council || { agenda: [], laws: [], history: [], standing: 0, sessions: 0, cool: {}, stats: {}, defy: {}, crisis: null, auto: false };
  const C = g.council; C.agenda = C.agenda || []; C.laws = C.laws || []; C.history = C.history || []; C.cool = C.cool || {}; C.stats = C.stats || {}; C.defy = C.defy || {};
  if (!Number.isFinite(C.standing)) C.standing = 0;
});
MONTHLY.push(councilMonth);
DAILY.push(() => { const C = G.council; if (!C || G.sim) return; if (C.pending && $('#modal').classList.contains('hidden')) Council.showSession(); if (C.crisis && !C.crisis.asked && $('#modal').classList.contains('hidden')) Council.showPledge(); });
