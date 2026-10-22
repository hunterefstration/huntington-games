// War and spies. Armies come from the real military data plus what each country spends on defence.
// Fronts run along real shared borders; each month the stronger side pushes the line toward the other's capital.
// Shown as maps, numbers and headlines only: smoke, flashes and retreating units, never gore.
function armyOf(n) {
  if (!n.army) {
    const E = n.milx * 5; // equipment: about five years of spending
    n.army = { troops: n.mil, E, morale: 70, mobilized: false, stance: 'balanced' };
  }
  return n.army;
}
function techOf(n) { return 0.45 + n.dev * 0.75 + (n.techLv || 0) * 0.02; }
function landPower(n) { const A = armyOf(n); return Math.sqrt(A.troops + 1) * Math.sqrt(A.E / 1e9 + 0.1) * techOf(n) * (A.morale / 70) * (1 + ((n.lawFx || {}).milK || 0)); }
function navyPower(n) { const c = World.countries[n.idx]; return c.landlocked ? 0 : Math.pow(armyOf(n).E / 1e9 + 0.1, 0.9) * techOf(n); }
function airPower(n) { return Math.pow(armyOf(n).E / 1e9 + 0.1, 0.9) * techOf(n) ** 1.5; }

// border lines between two countries from the map arcs: [[lon,lat],...] polylines
const borderCache = {};
function borderBetween(a, b) {
  const key = PAIR(a, b); if (borderCache[key]) return borderCache[key];
  const m = World.maps['50m'] || World.maps['110m'], users = new Map();
  m.feats.forEach(f => { if (f.c === a || f.c === b) f.arcIds.forEach(id => { const u = users.get(id) || new Set(); u.add(f.c); users.set(id, u); }); });
  const lines = [];
  users.forEach((u, id) => { if (u.has(a) && u.has(b)) { const arc = m.arcs[id], pts = []; for (let i = 0; i < arc.length; i += 2) pts.push([arc[i], arc[i + 1]]); lines.push(pts); } });
  return borderCache[key] = lines;
}
function capitalOf(idx) { return World.cities.find(c => c.c === idx && c.cap) || World.cities.find(c => c.c === idx) || { lon: World.countries[idx].label.lon, lat: World.countries[idx].label.lat, name: World.countries[idx].capital }; }
// the front: the border pushed toward the losing side's capital
function frontLine(f) {
  const lines = borderBetween(f.a, f.b), toward = f.prog >= 0 ? capitalOf(f.b) : capitalOf(f.a), k = Math.min(0.85, Math.abs(f.prog));
  if (!lines.length) { // no shared border (landing): a short line near the coast of the defender
    const cap = capitalOf(f.b), from = capitalOf(f.a), x = lerp(cap.lon, from.lon, 0.25 - 0.2 * k), y = lerp(cap.lat, from.lat, 0.25 - 0.2 * k);
    return [[[x - 0.6, y - 0.4], [x, y], [x + 0.6, y + 0.4]]];
  }
  return lines.map(l => l.map(([x, y]) => [lerp(x, toward.lon, k), lerp(y, toward.lat, k)]));
}

const WAR_GOALS = { land: 'Take territory', regime: 'Regime change', punish: 'Punish them', defend: 'Defend' };
function startWar(att, def, goal, silent) {
  if (G.wars.some(w => w.a.includes(att) && w.d.includes(def) || w.a.includes(def) && w.d.includes(att))) return null;
  const w = { id: (G.warN = (G.warN || 0) + 1), a: [att], d: [def], goal, start: G.day, score: 0, fronts: [{ a: att, b: def, prog: 0 }], dead: {}, weary: {}, taken: {} };
  w.dead[att] = w.dead[def] = 0; w.weary[att] = w.weary[def] = 0;
  G.wars.push(w);
  const A = World.countries[att], D = World.countries[def];
  addRel(att, def, -60);
  for (const m of G.nations) if (m && m !== G.nations[att]) addRel(att, m.idx, -6 * (m.dem / 10 + 0.3));
  if (!silent) newsWorld(A.name + ' declares war on ' + D.name);
  // allies are called: defence pacts, NATO, CSTO
  for (const side of [[def, 'd'], [att, 'a']]) {
    const [x, k] = side;
    for (const m of G.nations) {
      if (!m || w.a.includes(m.idx) || w.d.includes(m.idx)) continue;
      const pact = hasTreaty(x, m.idx, 'defence') || (k === 'd' && ['NATO', 'CSTO'].some(b => m.blocs.includes(b) && G.nations[x].blocs.includes(b)));
      if (!pact) continue;
      if (m.idx === G.player.idx) { G.requests.push({ type: 'joinwar', war: w.id, side: k, from: x, text: World.countries[x].name + ' is at war and asks you to join as their ally.', day: G.day, until: G.day + 45 }); inbox('crisis', World.countries[x].name + ' asks for help', 'Our ally is at war. Answer in Diplomacy.'); continue; }
      const p = m.persona || makePersona(m);
      if (G.rng() < 0.35 + p.honor / 200) joinWar(w, m.idx, k);
    }
  }
  for (const id of w.a.concat(w.d)) G.nations[id].atWar = true;
  syncWarVisuals();
  return w;
}
function joinWar(w, idx, side) {
  (side === 'a' ? w.a : w.d).push(idx); w.dead[idx] = 0; w.weary[idx] = 0; G.nations[idx].atWar = true;
  const enemies = side === 'a' ? w.d : w.a;
  for (const e of enemies) { addRel(idx, e, -40); if (borderBetween(idx, e).length) w.fronts.push(side === 'a' ? { a: idx, b: e, prog: 0 } : { a: e, b: idx, prog: 0 }); }
  newsWorld(World.countries[idx].name + ' joins the war ' + (side === 'a' ? 'against ' : 'to defend ') + World.countries[side === 'a' ? w.d[0] : w.d[0]].name);
}
// one month of fighting
function warMonth() {
  for (const w of G.wars.slice()) {
    const sidePower = list => list.reduce((s, i) => s + landPower(G.nations[i]) * (G.nations[i].army.mobilized ? 1.4 : 1) * (i === list[0] ? 1 : 0.35), 0);
    // friends outside the war send weapons and money
    const aid = (side, foe) => { let a = 0; for (const m of G.nations) if (m && !w.a.includes(m.idx) && !w.d.includes(m.idx) && relation(m.idx, side) > 25 && relation(m.idx, foe) < -25) a += landPower(m) * 0.03; return a; };
    w.aidA = aid(w.a[0], w.d[0]); w.aidD = aid(w.d[0], w.a[0]);
    const airA = w.a.reduce((s, i) => s + airPower(G.nations[i]), 0), airD = w.d.reduce((s, i) => s + airPower(G.nations[i]), 0);
    for (const f of w.fronts) {
      const A = G.nations[f.a], D = G.nations[f.b];
      const stA = { attack: 1.25, balanced: 1, defend: 0.75 }[A.army.stance], stD = { attack: 1.15, balanced: 1, defend: 1.2 }[D.army.stance];
      // allies add part of their strength; air control, supply over long distances and defending home soil matter
      let pa = (sidePower(w.a.includes(f.a) ? [f.a, ...w.a.filter(x => x !== f.a)] : [f.a]) + w.aidA) * stA * (1 + 0.3 * (airA - airD) / (airA + airD + 1));
      let pd = (sidePower(w.d.includes(f.b) ? [f.b, ...w.d.filter(x => x !== f.b)] : [f.b]) + w.aidD) * stD * (1.25 + Math.min(0.3, (G.day - w.start) / 3000)) * (1 + 0.3 * (airD - airA) / (airA + airD + 1));
      pa *= 1 - Math.max(0, f.prog) * 0.5; // supply lines stretch as the attacker goes deeper
      pa *= 0.85 + G.rng() * 0.3; pd *= 0.85 + G.rng() * 0.3;
      const tot = pa + pd, move = (pa - pd) / tot * 0.025 * (borderBetween(f.a, f.b).length ? 1 : 0.5);
      f.prog = clamp(f.prog + move, -0.6, 1);
      f.fighting = Math.abs(move) > 0.004 || A.army.stance === 'attack';
      // Lanchester-style losses: the side facing more power loses more
      const base = Math.min(A.army.troops, D.army.troops) * 0.012 * (A.army.stance === 'attack' ? 1.4 : 1);
      const la = base * (pd / tot) ** 2 * 2, ld = base * (pa / tot) ** 2 * 2;
      A.army.troops = Math.max(1000, A.army.troops - la); D.army.troops = Math.max(500, D.army.troops - ld);
      A.army.E *= 1 - 0.01 * pd / tot; D.army.E *= 1 - 0.01 * pa / tot;
      w.dead[f.a] = (w.dead[f.a] || 0) + la * 0.3; w.dead[f.b] = (w.dead[f.b] || 0) + ld * 0.3;
      // cities fall as the front passes them
      // cities nearest the border fall first; the capital only when the front reaches it
      if (!f.order) { const B = borderBetween(f.a, f.b).flat(), ac = capitalOf(f.a), dist = c => B.length ? Math.min(...B.filter((_, i) => i % 4 === 0).map(([x, y]) => Math.hypot(x - c.lon, y - c.lat))) : Math.hypot(c.lon - ac.lon, c.lat - ac.lat); f.order = World.cities.filter(c => c.c === f.b && !c.cap).map(c => [World.cities.indexOf(c), dist(c)]).sort((a, b) => a[1] - b[1]).map(x => x[0]); }
      const nTaken = f.prog > 0 ? Math.floor(f.order.length * Math.min(1, f.prog * 1.1) ** 1.6) : 0;
      w.taken[f.b] = f.order.slice(0, nTaken);
      if (f.prog >= 0.85) { endWar(w, 'a', 'capital'); break; }
    }
    if (!G.wars.includes(w)) continue;
    // weariness, economy and stability for everyone involved
    const months = (G.day - w.start) / 30;
    for (const i of w.a.concat(w.d)) {
      const n = G.nations[i], side = w.a.includes(i) ? 'a' : 'd', lost = (w.taken[i] || []).length / Math.max(1, World.cities.filter(c => c.c === i).length);
      w.weary[i] = clamp((w.dead[i] / n.pop) * 1.2e4 + months * 0.25 + lost * 40, 0, 100);
      setMod(n, 'growth', 'War', -(0.6 + lost * 8 + (n.army.mobilized ? 0.6 : 0)));
      setMod(n, 'infl', 'War', 1 + lost * 6);
      setMod(n, 'stability', 'War', months < 4 ? 4 - months : -w.weary[i] / 4);
      setMod(n, 'approval', 'War', months < 4 ? 6 - months * 1.5 : -w.weary[i] / 5);
      n.cost = n.cost || {}; n.cost.War = 1 + (n.army.mobilized ? 1 : 0);
    }
    w.score = clamp(Math.round(w.fronts.reduce((s, f) => s + f.prog * 70, 0) / w.fronts.length + (w.dead[w.d[0]] - w.dead[w.a[0]]) / (w.dead[w.a[0]] + w.dead[w.d[0]] + 1) * 20), -100, 100);
    // AI sides look for peace when losing or tired
    for (const lead of [w.a[0], w.d[0]]) {
      if (lead === G.player.idx) continue;
      const mine = lead === w.a[0] ? w.score : -w.score;
      if ((mine < -35 || w.weary[lead] > 80) && G.rng() < 0.2) {
        const other = lead === w.a[0] ? w.d[0] : w.a[0];
        if (other === G.player.idx) { if (!G.requests.some(r => r.type === 'peace' && r.war === w.id)) { G.requests.push({ type: 'peace', war: w.id, from: lead, text: World.countries[lead].name + ' offers peace' + (mine < -35 ? ' and gives up the land we hold.' : ' on the current lines.'), day: G.day, until: G.day + 45 }); inbox('good', 'Peace offer', World.countries[lead].name + ' wants to end the war. Answer in Diplomacy.'); } }
        else endWar(w, mine < -35 ? (lead === w.a[0] ? 'd' : 'a') : 'white', 'talks');
      }
    }
  }
  for (const n of G.nations) if (n && !G.wars.some(w => w.a.includes(n.idx) || w.d.includes(n.idx)) && n.atWar) { n.atWar = false; setMod(n, 'growth', 'War', 0); setMod(n, 'infl', 'War', 0); setMod(n, 'stability', 'War', 0); setMod(n, 'approval', 'War', 0); if (n.cost) n.cost.War = 0; }
  // armies rebuild from defence spending
  for (const n of G.nations) {
    if (!n) continue; const A = armyOf(n), spend = n.spend.defence / 100 * gdpUsd(n);
    A.E += spend / 12 * 0.6 - A.E / 180; A.troops += (n.mil * (A.mobilized ? 1.6 : 1) - A.troops) * 0.03; A.morale += ((n.groups ? n.groups.military : 55) - A.morale) * 0.1;
  }
  aiWars();
  syncWarVisuals();
}
function endWar(w, winner, how) {
  G.wars.splice(G.wars.indexOf(w), 1);
  const A = World.countries[w.a[0]], D = World.countries[w.d[0]];
  if (winner === 'white') newsWorld('Ceasefire between ' + A.name + ' and ' + D.name);
  else {
    const win = winner === 'a' ? w.a : w.d, lose = winner === 'a' ? w.d : w.a, W0 = G.nations[win[0]], L0 = G.nations[lose[0]];
    newsWorld(World.countries[win[0]].name + ' wins the war against ' + World.countries[lose[0]].name);
    if (winner === 'a' && w.goal === 'land') annex(w, w.a[0], w.d[0]);
    if (winner === 'a' && (w.goal === 'regime' || how === 'capital')) { L0.leader = personName(World.countries[L0.idx], G.rng); L0.title = 'Interim Leader'; L0.gov = 'TRANS'; newsWorld('New government installed in ' + World.countries[L0.idx].name); if (L0.idx === G.player.idx) { endGame('conquered', 'Defeated in war', `Enemy forces took the capital. ${G.player.title} ${G.player.name} was removed from power.`); } }
    for (const i of win) G.nations[i].warsWon = (G.nations[i].warsWon || 0) + 1, G.nations[i].prestige = (G.nations[i].prestige || 0) + 2;
    for (const i of lose) G.nations[i].warsLost = (G.nations[i].warsLost || 0) + 1, G.nations[i].evStab -= 8;
  }
  for (const i of w.a.concat(w.d)) if (i === G.player.idx) inbox(winner === 'white' ? 'info' : (w[winner] || []).includes(i) ? 'good' : 'bad', 'The war is over', winner === 'white' ? 'A ceasefire holds. The front stays where it is.' : (w[winner] || []).includes(i) ? 'We won.' : 'We lost the war.');
  syncWarVisuals();
}
// land taken in a winning war joins the winner (people and part of the economy move)
function annex(w, att, def) {
  const taken = w.taken[def] || [], all = World.cities.filter(c => c.c === def), A = G.nations[att], D = G.nations[def];
  if (!taken.length) return;
  const share = taken.reduce((s, i) => s + World.cities[i].pop, 0) / Math.max(1, all.reduce((s, c) => s + c.pop, 0)) * 0.8;
  const moveReal = D.real * share, movePop = D.pop * share;
  D.real -= moveReal; D.pop -= movePop; A.real += moveReal * (A.P / D.P) * 0.6; A.pop += movePop;
  G.annexed = (G.annexed || []).concat(taken.map(i => ({ city: i, by: att, from: def })));
  newsWorld(World.countries[att].name + ' annexes ' + taken.length + ' cities from ' + World.countries[def].name);
}
function aiWars() {
  if (G.rng() > 0.25) return;
  const cands = [];
  for (const n of G.nations) {
    if (!n || n.idx === G.player.idx || n.atWar) continue;
    const p = n.persona || makePersona(n); if (p.aggr < 60) continue;
    for (const id of World.countries[n.idx].borders) {
      const o = G.nations[World.byId[id].idx]; if (o.atWar || o.mil < 5000 || hasTreaty(n.idx, o.idx, 'nonagg')) continue;
      // deterrence: the target's allies count, and anyone under a nuclear umbrella is left alone
      const allies = G.nations.filter(m => m && m.idx !== o.idx && m.idx !== n.idx && (hasTreaty(m.idx, o.idx, 'defence') || ['NATO', 'CSTO'].some(b => m.blocs.includes(b) && o.blocs.includes(b))));
      if (o.nukes || allies.some(m => m.nukes)) continue;
      const rel = relation(n.idx, o.idx), ratio = landPower(n) / (landPower(o) + allies.reduce((s, m) => s + landPower(m) * 0.5, 0) + 1e-6);
      if (rel < -65 && ratio > 1.8) cands.push([n, o, ratio]);
    }
  }
  if (cands.length && G.rng() < 0.08) { const [n, o] = cands[Math.floor(G.rng() * cands.length)]; startWar(n.idx, o.idx, 'land'); if (o.idx === G.player.idx) { inbox('crisis', 'We are under attack!', World.countries[n.idx].name + ' has invaded. Open Military to fight back, rally allies, or seek peace.'); Clock.pause(); } }
}

// ---- player's military actions
const War = {
  myWars() { const me = G.player.idx; return G.wars.filter(w => w.a.includes(me) || w.d.includes(me)); },
  declare(t, goal) {
    const me = G.player.idx, n = G.nations[me];
    if (n.pc < 10) return 'Not enough political capital (10).';
    n.pc -= 10;
    const reason = relation(me, t) < -50 || G.wars.some(w => w.a.includes(t) && w.d.some(x => hasTreaty(x, me, 'defence')));
    const w = startWar(me, t, goal);
    if (!w) return 'Already at war.';
    if (!reason) for (const m of G.nations) if (m) addRel(me, m.idx, -10);
    react(n, { title: 'War declared on ' + World.countries[t].name, stance: { military: 6, students: -7, media: -3, business: -4, retirees: -2 }, size: 2, abroad: reason ? -3 : -12, topic: 'War' });
    flyToCountry(World.countries[t]);
    return 'War declared.';
  },
  stance(s) { const n = G.nations[G.player.idx]; n.army.stance = s; Bus.emit('changed'); },
  mobilize(on) {
    const n = G.nations[G.player.idx]; n.army.mobilized = on;
    react(n, { title: on ? 'General mobilisation ordered' : 'Troops sent home', stance: on ? { military: 5, youth: -6, workers: -3 } : { youth: 4, military: -2 }, size: 1.2, topic: 'Mobilisation' });
    setMod(n, 'unemp', 'Mobilisation', on ? -1.5 : 0); Bus.emit('changed');
  },
  strike(t, kind) {
    const me = G.player.idx, n = G.nations[me], m = G.nations[t], c = capitalOf(t), cost = { air: 3, missile: 4, cyber: 3, blockade: 4 }[kind];
    if (n.pc < cost) return 'Not enough political capital.';
    if (kind === 'blockade' && navyPower(n) < navyPower(m) * 1.3) return 'Our navy is too weak to blockade them.';
    if (kind === 'cyber' && n.spend.intel < 0.05) return 'We need more intelligence spending for cyber attacks.';
    n.pc -= cost;
    const hit = { air: 0.4, missile: 0.6, cyber: 0.3, blockade: 0.8 }[kind] * clamp(airPower(n) / (airPower(m) + 1), 0.3, 2);
    m.evGrowth = (m.evGrowth || 0) - hit; m.army.E *= 1 - hit * 0.03; m.evStab -= hit * 2;
    for (let i = 0; i < 8; i++) Life.flash(c.lon + (G.rng() - 0.5) * 3, c.lat + (G.rng() - 0.5) * 2, 1.2, [1, 0.6, 0.2], 2);
    addRel(me, t, -10);
    react(n, { title: { air: 'Air strikes on ', missile: 'Missile strikes on ', cyber: 'Cyber attack on ', blockade: 'Naval blockade of ' }[kind] + World.countries[t].name, stance: { military: 3, students: -3 }, size: 0.8, abroad: -2, topic: 'War' });
    return { air: 'Our jets hit military targets.', missile: 'Missiles struck bases and power plants.', cyber: 'Their banks and power grid went dark.', blockade: 'Our navy is blocking their ports.' }[kind];
  },
  peace(w, terms) {
    const me = G.player.idx, mine = w.a.includes(me) ? w.score : -w.score, enemy = w.a.includes(me) ? w.d[0] : w.a[0];
    const need = { white: -10, land: 35, regime: 70 }[terms], ok = mine + (G.rng() - 0.5) * 20 + w.weary[enemy] / 3 > need;
    if (!ok) return World.countries[enemy].name + ' refused.';
    if (terms === 'white') endWar(w, 'white', 'talks'); else { if (!w.a.includes(me)) { w.goal = terms; [w.a, w.d] = [w.d, w.a]; w.fronts.forEach(f => { [f.a, f.b] = [f.b, f.a]; f.prog = -f.prog; }); } w.goal = terms; endWar(w, 'a', 'talks'); }
    return 'Peace signed.';
  },
  nuke(t) {
    const me = G.player.idx, n = G.nations[me], m = G.nations[t], c = capitalOf(t), C = World.countries[t];
    for (let i = 0; i < 12; i++) Life.flash(c.lon + (G.rng() - 0.5), c.lat + (G.rng() - 0.5), 4, [1, 1, 0.85], 4);
    m.real *= 0.8; m.pop *= 0.95; m.evStab -= 40; m.army.E *= 0.6;
    for (const o of G.nations) if (o && o.idx !== me) addRel(me, o.idx, -70);
    react(n, { title: 'Nuclear weapon used against ' + C.name, stance: { students: -10, media: -10, religious: -8, green: -10, military: 2 }, size: 3, mood: -1, abroad: -50 });
    newsWorld('NUCLEAR ATTACK on ' + C.name + '. The world is in shock.');
    G.nuked = (G.nuked || 0) + 1;
    // retaliation: if they (or a nuclear ally) can strike back, it may become a full exchange
    const avenger = m.nukes ? m : G.nations.find(o => o && o.nukes && o.idx !== me && (hasTreaty(o.idx, t, 'defence') || (o.blocs.includes('NATO') && m.blocs.includes('NATO'))));
    if (avenger && G.rng() < 0.75) setTimeout(() => nuclearWar(avenger), 2500);
    Bus.emit('changed');
  }
};
function nuclearWar(avenger) {
  for (let i = 0; i < 40; i++) { const c = World.cities[Math.floor(G.rng() * World.cities.length)]; Life.flash(c.lon, c.lat, 5, [1, 1, 0.9], 5); }
  setTimeout(() => {
    document.body.style.transition = 'filter 3s'; document.body.style.filter = 'grayscale(1) brightness(.7)';
    endGame('nuclear', 'Nuclear war', World.countries[avenger.idx].name + ' struck back. Cities on every continent went dark. There are no winners.');
    setTimeout(() => { document.body.style.filter = ''; }, 9000);
  }, 3000);
}
// diplomacy page additions: war and spy actions toward one country
function warActionsHtml(t) {
  const me = G.player.idx, w = G.wars.find(x => (x.a.includes(me) && x.d.includes(t)) || (x.d.includes(me) && x.a.includes(t)));
  const spy = G.spy[t] || 0;
  let h = '<h3>Military</h3>';
  if (w) h += `<div class="note-box">We are at war with them. War score ${w.score > 0 === w.a.includes(me) ? '+' : ''}${(w.a.includes(me) ? w.score : -w.score)}.</div>
    <div class="btnrow"><button class="btn small" data-war="air">Air strikes (3)</button><button class="btn small" data-war="missile">Missile strikes (4)</button><button class="btn small" data-war="cyber">Cyber attack (3)</button><button class="btn small" data-war="blockade">Naval blockade (4)</button>${G.nations[me].nukes ? '<button class="btn small" data-war="nuke" style="border-color:#ef6b5b;color:#ef6b5b">☢ Nuclear strike</button>' : ''}</div>
    <div class="btnrow"><button class="btn small" data-peace="white">Offer peace on current lines</button><button class="btn small" data-peace="land">Demand the land we hold</button><button class="btn small" data-peace="regime">Demand surrender</button></div>`;
  else h += `<div class="sub">Our army ${fmtBig(G.nations[me].army.troops)} troops, power ${landPower(G.nations[me]).toFixed(0)}. Theirs: ${spy > 40 ? fmtBig(G.nations[t].army.troops) + ' troops, power ' + landPower(G.nations[t]).toFixed(0) : 'unknown (build a spy network to find out)'}.</div>
    <div class="btnrow"><select id="wgoal" style="background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:5px"><option value="land">Take territory</option><option value="regime">Regime change</option><option value="punish">Punish them</option></select><button class="btn small" data-war="declare" style="border-color:#ef6b5b">Declare war (10)</button></div>`;
  h += `<h3>Intelligence</h3><div class="sub">Spy network in ${esc(World.countries[t].name)}: ${spy.toFixed(0)}/100. Grows each month while it is our focus (needs intelligence spending).</div>
    <div class="btnrow"><button class="btn small" data-spy="focus">${G.spyFocus === t ? 'Current focus' : 'Make this our focus'}</button>${Object.entries(SPY_OPS).map(([k, o]) => `<button class="btn small" data-spy="${k}"${spy < o.need ? ' disabled' : ''}>${o.name} (${o.need}+)</button>`).join('')}</div>`;
  return h;
}
function bindWarActions(el, t) {
  const me = G.player.idx, w = G.wars.find(x => (x.a.includes(me) && x.d.includes(t)) || (x.d.includes(me) && x.a.includes(t)));
  $$('[data-war]', el).forEach(b => b.onclick = () => {
    const k = b.dataset.war;
    if (k === 'declare') return UI.confirm('Declare war on ' + World.countries[t].name + '?', 'Soldiers will die, the economy will suffer and the world will judge you. Wars are hard to stop once started.', 'Declare war', () => { toast(War.declare(t, $('#wgoal', el).value)); Bus.emit('changed'); });
    if (k === 'nuke') return UI.confirm('Use a nuclear weapon?', 'This kills huge numbers of people. Every country will turn against you, and they may strike back, which could end the world as we know it.', 'Launch', () => { War.nuke(t); });
    toast(War.strike(t, k)); Bus.emit('changed');
  });
  $$('[data-peace]', el).forEach(b => b.onclick = () => { toast(War.peace(w, b.dataset.peace)); Bus.emit('changed'); });
  $$('[data-spy]', el).forEach(b => b.onclick = () => { if (b.dataset.spy === 'focus') { G.spyFocus = t; toast('Agents are on their way.'); } else toast(Spies.run(b.dataset.spy, t)); Bus.emit('changed'); });
}
// ---- spies
const SPY_OPS = {
  steal: { name: 'Steal technology', need: 35 }, sabotage: { name: 'Sabotage', need: 45 }, fund: { name: 'Fund their opposition', need: 40 },
  meddle: { name: 'Meddle in their election', need: 60 }, coup: { name: 'Back a coup', need: 75 }
};
const Spies = {
  run(op, t) {
    const me = G.player.idx, n = G.nations[me], m = G.nations[t], c = World.countries[t], lvl = G.spy[t] || 0;
    if (n.pc < 3) return 'Not enough political capital.'; n.pc -= 3;
    const caught = G.rng() < 0.45 - lvl / 250 + (m.spend.intel - n.spend.intel) * 0.5;
    let msg = '';
    if (op === 'steal') { n.techLv = (n.techLv || 0) + 1 + m.dev * 2; msg = 'Plans stolen. Our research jumps ahead.'; }
    if (op === 'sabotage') { m.evGrowth = (m.evGrowth || 0) - 0.5; m.army.E *= 0.95; msg = 'A factory and a fuel depot burned.'; }
    if (op === 'fund') { m.evStab -= 6; m.approval -= 3; msg = 'Their opposition has new money.'; }
    if (op === 'meddle') { m.approval -= 6; if (m.aiElection) m.aiElection = Math.min(m.aiElection, G.day + 60); msg = 'Fake news is flooding their social media.'; }
    if (op === 'coup') { if (G.rng() < 0.35 + (40 - m.stability) / 100) { newLeader(m, 'seized power in a coup in ' + c.name, 'General'); m.gov = 'JUNTA'; addRel(me, t, 40); msg = 'The coup worked. Their new leader owes us.'; } else msg = 'The coup failed.'; }
    G.spy[t] = Math.max(0, lvl - 10);
    if (caught) {
      addRel(me, t, -35); for (const o of G.nations) if (o && o.dem > 6) addRel(me, o.idx, -3);
      react(n, { title: 'Our spies caught in ' + c.name, stance: { media: -4 }, size: 1.2, abroad: -6, topic: 'SpyScandal' });
      newsWorld(World.countries[me].name + ' spies exposed in ' + c.name);
      msg += ' But our agents were caught! A scandal.';
    }
    return msg;
  }
};
function spyMonth() {
  const n = G.nations[G.player.idx];
  if (G.spyFocus != null) G.spy[G.spyFocus] = clamp((G.spy[G.spyFocus] || 0) + n.spend.intel * 12 + 1, 0, 100);
  // enemy spies try their luck on us
  if (G.rng() < 0.04) {
    const foes = G.nations.filter(m => m && m.idx !== n.idx && relation(m.idx, n.idx) < -30 && m.spend.intel > 0.05);
    if (foes.length) { const f = foes[Math.floor(G.rng() * foes.length)], fc = World.countries[f.idx];
      if (G.rng() < 0.5 + n.spend.intel) { inbox('good', 'Spy ring broken', 'Our agents caught spies working for ' + fc.name + '.'); addRel(n.idx, f.idx, -15); react(n, { title: fc.name + ' spy ring exposed', stance: { military: 2, police: 3 }, size: 0.7 }); }
      else { n.evGrowth = (n.evGrowth || 0) - 0.2; inbox('bad', 'Cyber attack', 'Hackers, probably from ' + fc.name + ', hit our banks.'); } }
  }
}

// ---- visuals: soldiers and tanks along fronts, fire on the map, icons
function syncWarVisuals() {
  const units = [], me = G ? G.player.idx : -1;
  for (const w of (G ? G.wars : [])) for (const f of w.fronts) {
    const lines = frontLine(f), r = makeRng(w.id * 13 + f.a);
    const colA = f.a === me || w.a.includes(me) ? [0.95, 0.75, 0.25] : [0.85, 0.22, 0.2], colD = f.b === me || w.d.includes(me) ? [0.95, 0.75, 0.25] : [0.25, 0.45, 0.85];
    const ca = capitalOf(f.a), cd = capitalOf(f.b);
    const pts = lines.flat(), step = Math.max(1, Math.floor(pts.length / 60));
    for (let i = 0; i < pts.length; i += step) {
      const [x, y] = pts[i];
      for (const [side, cap, col] of [[0, ca, colA], [1, cd, colD]]) {
        const dx = cap.lon - x, dy = cap.lat - y, d = Math.hypot(dx, dy) || 1, off = 0.12 + r() * 0.35;
        const tank = r() < 0.3;
        units.push({ lon: x + dx / d * off, lat: y + dy / d * off, w: tank ? 1.6 : 0.6, d: tank ? 1 : 0.6, h: tank ? 0.6 : 1.4, col, moving: f.fighting });
      }
    }
  }
  Life.units = units; Globe.dirty = true;
}
ICON_SOURCES.push(() => G.wars.map(w => { const c1 = capitalOf(w.a[0]), c2 = capitalOf(w.d[0]), L = borderBetween(w.a[0], w.d[0]).flat(); const p = L.length ? L[Math.floor(L.length / 2)] : [(c1.lon + c2.lon) / 2, (c1.lat + c2.lat) / 2]; return { lon: p[0], lat: p[1], icon: '⚔', ring: '#ef6b5b', bg: 'rgba(80,10,10,.85)' }; }));
// fronts drawn on the 2D overlay, so they stay crisp at every zoom
function drawFronts(ctx) {
  if (!G || !G.wars.length) return;
  const s = {};
  for (const w of G.wars) for (const f of w.fronts) for (const line of frontLine(f)) {
    ctx.beginPath(); let started = false;
    for (const [x, y] of line) { const p = llToScreen(x, y, 1.0008, s); if (!p.front) { started = false; continue; } started ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); started = true; }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,90,60,.35)'; ctx.lineWidth = 9; ctx.stroke();
    ctx.strokeStyle = '#ff6a3d'; ctx.lineWidth = 2.5; ctx.setLineDash([7, 5]); ctx.stroke(); ctx.setLineDash([]);
  }
  // occupied cities
  for (const w of G.wars) for (const id in w.taken) for (const ci of w.taken[id]) { const c = World.cities[ci], p = llToScreen(c.lon, c.lat, 1.001, s); if (!p.front) continue; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, 7); ctx.fillStyle = '#ff6a3d'; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke(); }
}
let warFxT = 0;
DAILY.push(() => { // a few flashes along active fronts while time runs
  if (!G.wars.length || Cam.alt > 1.2) return;
  for (const w of G.wars) for (const f of w.fronts) if (f.fighting && G.rng() < 0.6) { const L = frontLine(f).flat(); if (L.length) { const p = L[Math.floor(G.rng() * L.length)]; Life.flash(p[0] + (G.rng() - 0.5) * 0.4, p[1] + (G.rng() - 0.5) * 0.4, 0.6, [1, 0.65, 0.25], 1.5); } }
});
MONTHLY.push(warMonth);
MONTHLY.push(spyMonth);
SYSTEM_INITS.push(g => {
  g.wars = g.wars || []; g.spy = g.spy || {};
  for (const n of g.nations) if (n) armyOf(n);
  if (!g.warsInit) { // the war in Ukraine is already under way in 2026: Russia holds roughly a fifth of the country
    g.warsInit = true;
    const G0 = G; G = g;
    const w = startWar(World.byId.RUS.idx, World.byId.UKR.idx, 'land', true);
    if (w) { w.start = -1600; w.fronts[0].prog = 0.18; w.dead[World.byId.RUS.idx] = 250000; w.dead[World.byId.UKR.idx] = 120000; syncWarVisuals(); }
    g.requests = g.requests.filter(r => r.type !== 'joinwar');
    G = G0 || g;
  }
});
