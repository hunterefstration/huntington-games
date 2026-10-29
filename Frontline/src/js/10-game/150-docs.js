// =====================================================================
//  3.0 CAMPAIGN: an operation of 7 battles. Pick 1 of 3 missions at each stage; every win earns a Doctrine
//  (a perk that lasts the whole run). Lose a battle and you spend a Reserve; lose all 3 and the operation fails.
// =====================================================================
const DOCS = {
  chest: { n: 'War Chest', d: 'Start every battle with 300 more money.', max: 3 },
  logi: { n: 'Supply Lines', d: 'Earn 15% more money.', max: 2, mod: { inc: .15 } },
  rapid: { n: 'Fast Training', d: 'Buildings train troops 20% faster.', max: 2, mod: { prod: .2 } },
  bargain: { n: 'Bulk Contracts', d: 'Every unit costs 8% less.', max: 2, mod: { cost: -.08 } },
  armor: { n: 'Body Armor', d: 'Soldiers have 15% more health.', max: 2, mod: { hpInf: .15 } },
  plating: { n: 'Extra Plating', d: 'Vehicles, tanks and aircraft have 15% more health.', max: 2, mod: { hpVeh: .15, hpHvy: .15 } },
  rifles: { n: 'Sharpshooters', d: 'Bullets do 12% more damage.', max: 2, mod: { dmgBul: .12 } },
  ap: { n: 'Tank Hunters', d: 'Rockets and tank cannons do 12% more damage.', max: 2, mod: { dmgAT: .12 } },
  guns: { n: 'Big Guns', d: 'Artillery and bombs do 15% more damage.', max: 2, mod: { dmgShell: .15 } },
  drill: { n: 'Drill Sergeants', d: 'Troops rank up 40% faster.', max: 1, mod: { xp: .4 } },
  eyes: { n: 'Scouting Parties', d: 'Your units see 20% farther and weapons reach 5% farther.', max: 1, mod: { vis: .2, rng: .05 } },
  march: { n: 'Forced March', d: 'Soldiers and vehicles move 10% faster.', max: 1, mod: { spdInf: .1, spdVeh: .1 } },
  vets: { n: 'Veteran Cadre', d: 'Your starting army are Veterans, plus 3 veteran Riflemen (Legionaries in an Iron Legion war).', max: 1 },
  tanks: { n: 'Armored Column', d: 'Start every battle with 2 Light Tanks.', max: 2 },
  base: { n: 'Forward Base', d: 'Start with a Barracks next to your HQ, already training.', max: 1 },
  hq2: { n: 'Head Start', d: 'Your HQ starts at Level 2.', max: 1 },
  fort: { n: 'Dug In', d: 'Your HQ starts ringed with Fortified Walls.', max: 1 },
  mercs: { n: 'Old Friends', d: '4 veteran Mercenaries join you for the first 3 minutes of every battle.', max: 1 },
  bounty: { n: 'Bounty Hunters', d: 'Earn 15% of the cost of every enemy unit you destroy.', max: 1 },
  qm: { n: 'Quartermaster', d: 'Supply crates and Ace bounties pay double.', max: 1 },
  support: { n: 'Staff College', d: 'Support powers recharge 20% faster and cost 15% less.', max: 1, mod: { callCd: -.2, callCost: -.15 } }
};
const MISSIONS = {
  conquest: { n: 'Conquest', ic: 'flag', d: 'The usual battle: hold more flags than the enemy or destroy their HQ.', reward: 'Pick 1 of 3 Doctrines' },
  blitz: { n: 'Blitz', ic: 'fight', d: 'Destroy the enemy HQ or drain their score within 15 minutes. Both sides start with less score.', reward: 'Pick 1 of 4 Doctrines', four: 1 },
  holdout: { n: 'Hold Out', ic: 'nest', d: 'Survive 9 minutes of non-stop attacks. The enemy gets extra money. Keep your HQ standing.', reward: '+1 Reserve, pick 1 of 3 Doctrines', life: 1 },
  koth: { n: 'King of the Hill', ic: 'flag', d: 'Hold the center flag for 3 minutes in total. The clock starts at 1:30 and stops while the flag is being fought over.', reward: 'Pick 1 of 4 Doctrines', four: 1 },
  fortress: { n: 'Break the Line', ic: 'guns', d: 'The enemy is dug in behind walls and bunkers. You start with a bigger army.', reward: '+1 Reserve, pick 1 of 3 Doctrines', life: 1 },
  supply: { n: 'Supply Run', ic: 'crate', d: 'Supply crates drop every minute. Claim 4 before the enemy does.', reward: 'Pick 1 of 4 Doctrines', four: 1 },
  twofront: { n: 'Two Fronts', ic: 'group', d: 'Two enemy commanders team up against you on a big map.', reward: '+1 Reserve, pick 1 of 4 Doctrines', life: 1, four: 1 }
};
const MODS = { fog: ['Fog of war', 'You only see what your troops see.'], rich: ['Rich', 'Everyone starts with 1400 more money.'], short: ['Short fuse', 'Both sides start with only 250 score.'], night: ['Night Operation', 'Fought at night: short sight and fog of war. Searchlights and muzzle flashes give positions away.'], storm: ['Foul Weather', 'Rain, fog or snow: mud and snow slow troops down, rain spoils aim, fog hides everything.'] };
const CDIFF = {
  recruit: { n: 'Recruit', d: 'Easy and Normal enemies. A good first run.', ladder: ['easy', 'easy', 'normal', 'normal', 'normal', 'normal', 'normal'] },
  veteran: { n: 'Veteran', d: 'Normal enemies that turn Hard halfway through.', ladder: ['normal', 'normal', 'normal', 'hard', 'hard', 'hard', 'hard'] },
  elite: { n: 'Elite', d: 'Hard enemies that turn Brutal. For experts.', ladder: ['hard', 'hard', 'hard', 'brutal', 'brutal', 'brutal', 'brutal'] }
};
const CSTAGES = 7, OPNAMES = ['Iron Dawn', 'Steel Rain', 'Red Harvest', 'Thunderclap', 'Night Owl', 'Granite Fist', 'Sandstorm', 'Wildfire', 'Black Anvil', 'Silver Spear', 'Long Winter', 'Broken Arrow'];
let CAMP = (() => { const c = readJSON('frontline_campaign_v1'); return c && c.v === 1 && CDIFF[c.diff] ? c : null; })();
function saveCamp() { lsSet('frontline_campaign_v1', JSON.stringify(CAMP)); }
function campRng(k) { return mulberry32(((CAMP.seed | 0) + CAMP.stage * 977 + k * 131 + (CAMP.rolls | 0) * 7919) >>> 0); }
function campNew(diff) { CAMP = { v: 1, diff, stage: 0, lives: 3, docs: {}, seed: (Math.random() * 1e9) | 0, rolls: 0, choices: null, offer: null, cur: null, log: [], over: '' }; CAMP.name = OPNAMES[CAMP.seed % OPNAMES.length]; campChoices(); saveCamp(); }
function campChoices() {
  const st = CAMP.stage, r = campRng(1), pick = a => a[(r() * a.length) | 0], diff = CDIFF[CAMP.diff].ladder[st], pers = Object.keys(AIP);
  const two = () => { const a = pick(pers); let b = pick(pers); if (b === a) b = pers[(pers.indexOf(a) + 1) % pers.length]; return [a, b]; };
  if (st === CSTAGES - 1) { CAMP.choices = [{ type: 'twofront', map: pick(['corners', 'frostbite', 'ironworks', 'coral', 'mesa']), foes: two(), diff, mod: '', final: 1 }]; return; }
  const pool = Object.keys(MISSIONS).filter(k => k !== 'twofront' || st >= 2), types = st === 0 ? ['conquest'] : [];
  while (types.length < 3) { const t = pick(pool); if (!types.includes(t)) types.push(t); }
  CAMP.choices = types.map(t => {
    const maps = MAPS.filter(m => t !== 'twofront' || m.maxP >= 3); let mod = st >= 1 && r() < .45 ? pick(Object.keys(MODS)) : '';
    if (mod === 'short' && t !== 'conquest' && t !== 'fortress' && t !== 'blitz') mod = '';
    return { type: t, map: pick(maps).id, foes: t === 'twofront' ? two() : [pick(pers)], diff, mod };
  });
}
function campOffer(n) {
  const r = campRng(2), ids = Object.keys(DOCS).filter(id => (CAMP.docs[id] || 0) < DOCS[id].max), out = [];
  while (out.length < n && ids.length) out.push(ids.splice((r() * ids.length) | 0, 1)[0]); return out;
}
function campCfg(c) {
  const colors = assignColors({}), over = {}, D = AID[c.diff];
  if (c.type === 'holdout') Object.assign(over, { firstAtk: 45, pause: 18, atkMul: .45, hqPower: 0, warn: 6, retreat: 0, inc: D.inc * 1.6, popLim: Math.max(D.popLim, 40), startDelay: 0 });
  if (c.type === 'koth' || c.type === 'supply') Object.assign(over, { firstAtk: Math.min(D.firstAtk, 200), capCd: 0 });
  const players = [{ kind: 'human', name: SET.name, team: 0, color: PCOL[colors[0]].c, docs: CAMP.docs, gen: genActive() }];
  c.foes.forEach((pers, i) => players.push({ kind: 'ai', name: AIP[pers].name, team: 1, color: PCOL[colors[i + 1]].c, fac: AIP[pers].fac | 0, ai: { pers, diff: c.diff, over }, fort: c.type === 'fortress', sup: c.type === 'fortress' ? 500 : 0 }));
  if (c.type === 'fortress') players[0].extra = [['rifleman', 4], ['rocket', 3], ['heavy', 2], ['lighttank', 2], ['engineer', 1]];
  if (c.type === 'holdout') { players[0].extra = [['rifleman', 3], ['heavy', 2], ['rocket', 2], ['engineer', 1]]; players[0].sup = 500; }
  const obj = { type: c.type }; if (c.type === 'blitz') obj.dur = 900; if (c.type === 'holdout') obj.dur = 540; if (c.type === 'koth') { obj.need = 180; obj.open = 90; } if (c.type === 'supply') obj.need = 4;
  const tickets = c.type === 'blitz' ? 300 : (c.type === 'holdout' || c.type === 'koth' || c.type === 'supply') ? 5000 : c.mod === 'short' ? 250 : 400;
  const wc = pickWx(mapDef(c.map), c.mod === 'night' ? 'night' : 'map', c.mod === 'storm' ? ['rain', 'fog', 'snow'][(campRng(5)() * 3) | 0] : 'map');   // 3.0 battle conditions
  return { map: c.map, players, tickets, supplies: 600 + (c.mod === 'rich' ? 1400 : 0), fog: c.mod === 'fog', speed: 1, maxPop: 120, events: true, obj, camp: true, tod: wc.tod, weather: wc.weather };
}
// called when a campaign battle ends (or is abandoned); returns what the results screen should show
function campAfter(win) {
  if (!CAMP || !CAMP.cur) return null; const c = CAMP.cur, M = MISSIONS[c.type]; CAMP.cur = null; const r = { win, type: c.type };
  CAMP.log.push([c.type, win ? 1 : 0]);
  if (win) {
    if (c.final) { CAMP.over = 'won'; PROF.cWins++; PROF.cBest = Math.max(PROF.cBest, CSTAGES); if (!PROF.ach.camp) { PROF.ach.camp = 1; r.ach = ACH.camp[0]; } if (CAMP.diff === 'elite' && !PROF.ach.campElite) { PROF.ach.campElite = 1; r.ach = ACH.campElite[0]; } saveProf(); }
    else { if (M.life && CAMP.lives < 3) { CAMP.lives++; r.life = 1; } CAMP.offer = campOffer(M.four ? 4 : 3); }
  } else { CAMP.lives--; if (CAMP.lives <= 0) { CAMP.over = 'lost'; PROF.cBest = Math.max(PROF.cBest, CAMP.stage); saveProf(); } else { CAMP.rolls = (CAMP.rolls | 0) + 1; campChoices(); } }
  r.lives = CAMP.lives; r.over = CAMP.over; r.offer = CAMP.offer; saveCamp(); return r;
}
function docChip(id, n) { const d = DOCS[id]; return '<span class="dchip" data-tip="' + esc(d.n + '|' + d.d) + '">' + esc(d.n) + (n > 1 ? ' x' + n : '') + '</span>'; }
function docCards(ids) { return '<div class="dgrid">' + ids.map(id => { const d = DOCS[id], n = CAMP.docs[id] || 0; return '<button class="dcard" data-act="cdoc" data-v="' + id + '"><b>' + esc(d.n) + (n ? ' <i>(' + (n + 1) + ')</i>' : '') + '</b><span>' + esc(d.d) + '</span></button>'; }).join('') + '</div>'; }
function campTrack() { let h = '<div class="ctrack">'; for (let i = 0; i < CSTAGES; i++) { h += '<span class="' + (i < CAMP.stage ? 'done' : i === CAMP.stage && !CAMP.over ? 'now' : '') + (i === CSTAGES - 1 ? ' fin' : '') + '">' + (i === CSTAGES - 1 ? '&#9733;' : i + 1) + '</span>'; } return h + '</div>'; }
function campHearts() { return '<span class="hearts" data-tip="Reserves|Losing a battle costs one Reserve. Lose all 3 and the operation fails. Some missions give one back.">' + '&#9829;'.repeat(Math.max(0, CAMP.lives)) + '<s>' + '&#9829;'.repeat(Math.max(0, 3 - CAMP.lives)) + '</s></span>'; }
SCREENS.campaign = () => {
  if (CAMP && CAMP.cur) { campAfter(false); toast('The battle was left unfinished, so it counts as a loss.'); }
  const head = t => `<div class="row" style="justify-content:space-between"><h2 style="margin:0;color:#ffe2a6">${t}</h2><button class="tbtn" data-act="back">Back</button></div>`;
  if (!CAMP || CAMP.over) {
    const last = CAMP && CAMP.over ? `<div class="note" style="margin:8px 0;padding:10px;border:1px solid ${CAMP.over === 'won' ? '#3d9b5b' : '#8a3a30'};border-radius:10px;background:#0d1620"><b style="color:${CAMP.over === 'won' ? '#7be08a' : '#ff9a8c'}">Operation ${esc(CAMP.name)}: ${CAMP.over === 'won' ? 'complete!' : 'failed at stage ' + (CAMP.stage + 1)}</b> (${CDIFF[CAMP.diff].n})<br><i style="color:#d9c79a">${esc((CAMP.over === 'won' ? LORE.operations.victory : LORE.operations.defeat)[(CAMP.seed | 0) % 3])}</i><br>${Object.keys(CAMP.docs).length ? 'Doctrines: ' + Object.entries(CAMP.docs).map(([k, n]) => docChip(k, n)).join(' ') : ''}</div>` : '';
    return `<div class="scr bg"><div class="panel" style="width:min(640px,98vw)">${head('Campaign')}
    <div class="note" style="font-size:15px;color:#e6eef7;margin-top:6px">Lead an <b>operation</b> of ${CSTAGES} battles. At each stage pick 1 of 3 missions: Blitz, Hold Out, King of the Hill, Break the Line, Supply Run, Two Fronts and more. Every win earns a <b>Doctrine</b>, a bonus that lasts the whole operation. Losing costs one of your 3 <b>Reserves</b>. The last battle is against two commanders at once.</div>${last}
    <div class="lbl">Pick a difficulty to start a new operation</div>${Object.entries(CDIFF).map(([k, d]) => `<button class="mbtn ${k === 'recruit' ? 'go' : ''}" data-act="cstart" data-v="${k}">${d.n}<small>${d.d}</small></button>`).join('')}
    <div class="note" style="text-align:center;margin-top:8px">Operations won: <b>${PROF.cWins}</b> - furthest stage: <b>${PROF.cBest || 0}</b> of ${CSTAGES}</div></div></div>`;
  }
  const docs = Object.entries(CAMP.docs).map(([k, n]) => docChip(k, n)).join(' ') || '<span class="note">None yet. Win a battle to earn one.</span>';
  const narr = CAMP.stage === 0 && !CAMP.offer && !CAMP.log.length ? '<div class="note" style="margin-top:8px;color:#d9c79a;font-size:14.5px"><i>' + esc(LORE.operations.intro[(CAMP.seed | 0) % LORE.operations.intro.length]) + '</i></div>' : '';
  let body;
  if (CAMP.offer) body = `<div class="lbl">Victory! Choose a Doctrine</div>${docCards(CAMP.offer)}`;
  else body = `<div class="lbl">${CAMP.stage === CSTAGES - 1 ? 'Final battle' : 'Stage ' + (CAMP.stage + 1) + ': pick your next mission'}</div><div class="mgrid">${CAMP.choices.map((c, i) => { const M = MISSIONS[c.type], md = mapDef(c.map); return `<button class="mcard" data-act="cgo" data-v="${i}"><img src="${mapPreview(c.map)}"/><b>${c.final ? 'Final Offensive: ' : ''}${M.n}</b><span>${esc(M.d)}</span><span class="mi">${esc(md.name)}${md.tod === 'night' || md.wx ? ' (' + esc(wxName({ tod: md.tod, weather: md.wx })) + ')' : ''} - vs ${c.foes.map(f => esc(AIP[f].name)).join(' + ')} (${AID[c.diff].n})</span>${c.mod ? `<span class="mm" data-tip="${esc(MODS[c.mod].join('|'))}">${MODS[c.mod][0]}</span>` : ''}<span class="mr">${c.final ? 'Win to complete the operation' : M.reward}</span></button>`; }).join('')}</div>`;
  return `<div class="scr bg"><div class="panel" style="width:min(900px,98vw)">${head('Operation ' + esc(CAMP.name))}
  <div class="row" style="justify-content:space-between;align-items:center;margin-top:6px">${campTrack()}<div>${CDIFF[CAMP.diff].n} ${campHearts()}</div></div>
  ${narr}<div class="lbl">Doctrines</div><div>${docs}</div>${body}
  <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="tbtn" data-act="cquit" style="border-color:#8a3a30">${UI.cquit ? 'Click again to give up this operation' : 'Give up operation'}</button></div></div></div>`;
};
// =====================================================================
//  3.1 ENDLESS WAR: hold the Bastion. Each wave a new enemy commander lands at one of eight sites, with a base and army
//  built to rival yours. Destroy their HQ (or outlast them) to win the wave. Lose and you rebuild from the start of
//  that wave. Your base, money, upgrades and Doctrines are saved.
// =====================================================================
const WSTYLE = {
  rush: { pers: 'vex', bld: ['barracks', 'barracks', 'factory', 'depot', 'turret', 'barracks'], uw: { rifleman: 3, scout: 1, jeep: 2.5, apc: 1.4, rocket: 1, grenadier: 1, heavy: 1, lighttank: 1 }, over: { atkMul: .35, pause: 22 } },
  turtle: { pers: 'stone', bld: ['turret', 'turret', 'barracks', 'arty', 'factory', 'wall'], uw: null, over: { atkMul: .7, pause: 50 } },
  armor: { pers: 'kruger', bld: ['factory', 'factory', 'barracks', 'depot', 'turret', 'factory'], uw: null, over: { atkMul: .5, pause: 35 } },
  air: { pers: 'voss', bld: ['airfield', 'airfield', 'barracks', 'factory', 'turret', 'depot'], uw: null, over: { atkMul: .5, pause: 35 } },
  artillery: { pers: 'stone', bld: ['factory', 'arty', 'barracks', 'arty', 'turret', 'factory'], uw: { artillery: 3, mlrs: 2, mortar: 2, rocket: 1.2, rifleman: 1, aa: .6, heavy: 1, engineer: .5 }, over: { atkMul: .55, pause: 40 } },
  balanced: { pers: 'hale', bld: ['barracks', 'factory', 'depot', 'turret', 'airfield', 'barracks'], uw: null, over: { atkMul: .5, pause: 32 } },
  swarm: { pers: 'vex', bld: ['barracks', 'barracks', 'barracks', 'depot', 'barracks', 'turret'], uw: { rifleman: 3, scout: 1.5, grenadier: 1.5, heavy: 1.3, rocket: 1.2, medic: .6, engineer: .5 }, over: { atkMul: .3, pause: 18 } },
  elite: { pers: 'hale', bld: ['barracks', 'factory', 'airfield', 'turret', 'factory', 'barracks'], uw: { commando: 2.5, tank: 2, titan: 1.5, sniper: 1, gunship: .5, rocket: 1.2, heavy: 1, medic: .5 }, over: { atkMul: .55, pause: 35 }, vet: 1 }
};
const WAR_DOCS = ['logi', 'rapid', 'bargain', 'armor', 'plating', 'rifles', 'ap', 'guns', 'drill', 'eyes', 'march', 'bounty', 'qm', 'support'];
let WAR = (() => { const w = readJSON('frontline_war_v1'); if (w && w.v === 1 && w.fac !== 1) w.fac = 0; return w && w.v === 1 ? w : null; })();   // 3.0: fac = the army you lead (saves from before the Iron Legion are Banner armies)
function saveWar() { lsSet('frontline_war_v1', JSON.stringify(WAR)); }
function warNew(fac) { WAR = { v: 1, fac: fac === 1 ? 1 : 0, wave: 1, seed: (Math.random() * 1e9) | 0, sup: 1500 + 150 * (genActive().funds || 0), techs: {}, docs: {}, blds: null, pts: [], hist: [], best: 1, lastSite: -1, lastStyle: '', losses: 0, wins: 0, kills: 0, offer: null, seen: {} }; saveWar(); }
const wpick = (r, a) => a[(r() * a.length) | 0];
function warDef(wave) {
  const r = mulberry32(((WAR.seed | 0) + wave * 7919) >>> 0), L = LORE.war;
  let keys = Object.keys(WSTYLE).filter(k => k !== WAR.lastStyle && (k !== 'elite' || wave >= 8) && (k !== 'air' || wave >= 4)); if (wave === 1) keys = ['balanced', 'rush'];
  const style = wpick(r, keys); let site = (r() * 8) | 0; if (site === WAR.lastSite) site = (site + 3) % 8;
  const name = wpick(r, L.ranks) + ' ' + wpick(r, L.namesFirst) + ' ' + wpick(r, L.namesLast), ep = wpick(r, L.epithets);
  const diff = wave < 3 ? 'normal' : wave < 9 ? 'hard' : 'brutal';
  const boss = wave % 5 === 0, mod = wave >= 4 ? wpick(r, Object.keys(WMODS).filter(k => !(k === 'air' && style === 'air') && !(k === 'armor' && style === 'armor'))) : '';
  // 3.0: from wave 3 on, some commanders bring the Iron Legion (its own random stream, so older saves keep the same waves otherwise)
  const fr = mulberry32(((WAR.seed | 0) + wave * 104729 + 17) >>> 0), fac = wave >= 3 && fr() < .38 ? 1 : 0, nm = fac ? wpick(fr, L.lgRanks) + name.slice(name.indexOf(' ')) : name;
  // 3.0: some waves come at night or in a storm (their own random stream again)
  const xr = mulberry32(((WAR.seed | 0) + wave * 31337 + 5) >>> 0); let wxm = '', wxw = 'clear'; if (wave >= 5 && xr() < .24) { wxm = xr() < .55 ? 'night' : 'storm'; wxw = wxm === 'storm' ? wpick(xr, ['rain', 'rain', 'fog', 'snow']) : xr() < .3 ? 'rain' : 'clear'; }
  return { wave, style, site, name: nm, ep, diff, title: (fac ? 'Legion ' : '') + L.styles[style].title, taunt: wpick(r, L.styles[style].lines), mod, boss, fac, wxm, wxw };
}
// 2.2: every wave from 4 on has a twist, and every 5th wave the enemy commander comes with a Warlord
const WMODS = {
  armor: { n: 'Armored Push', d: 'The enemy brings far more tanks. Bazookas and Cannon Towers!', rw: 1.2, bld: ['factory'], uw: { tank: 3, lighttank: 2.5, apc: 1.5, heavy: 1 } },
  air: { n: 'Air Raid', d: 'Swarms of helicopters and planes. Build Flak Towers and AA.', rw: 1.2, bld: ['airfield', 'airfield'], uw: { heli: 3, gunship: 2, drone: 2.5, strike: 1.5 } },
  siege: { n: 'Siege', d: 'Artillery and mortars shell you from long range. Hit them fast.', rw: 1.25, bld: ['arty'], uw: { artillery: 3, mlrs: 2.5, mortar: 2 } },
  swarm: { n: 'Swarm', d: 'Half again as many enemy troops, mostly cheap infantry.', rw: 1.2, army: 1.5, uw: { rifleman: 4, grenadier: 2, scout: 1.5 } },
  veterans: { n: 'Veterans', d: 'Every enemy troop is a veteran: tougher and deadlier.', rw: 1.3, vet: 1 },
  blitz: { n: 'Blitz', d: 'Only 4 minutes, and they attack at once. Survive for a big reward.', rw: 1.5, time: 240, atk: .2 },
  fortress: { n: 'Fortress', d: 'Their landing site bristles with towers. Their HQ is worth more.', rw: 1.35, towers: 4 },
  relentless: { n: 'Relentless', d: 'Enemy reinforcements land twice as often.', rw: 1.3, rein: .5 }
};
function warWxTxt(d) { return d.wxm === 'night' ? 'NIGHT ASSAULT' + (d.wxw !== 'clear' ? ' in the ' + WXD[d.wxw].n.toLowerCase() : '') + ': short sight and fog of war. Your HQ and towers sweep searchlights; muzzle flashes give the attackers away.' : d.wxm === 'storm' ? 'STORM FRONT (' + WXD[d.wxw].n + '): ' + WXD[d.wxw].d : ''; }
function warIntel(d) { const M = WMODS[d.mod]; return (d.wxm ? warWxTxt(d) + ' ' : '') + (M ? M.n + ': ' + M.d : '') + (d.boss ? (M ? ' ' : '') + 'BOSS WAVE: a Warlord leads the attack (big bounty).' : '') + (d.fac === 1 ? ((M || d.boss) ? ' ' : '') + 'IRON LEGION: shielded troops and mechs. Tesla Towers drain their shields fast; Jump Troopers leap over walls.' : ''); }
const WDIRS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
function warFill(t, d) { return t.replace(/\{name\}/g, d.name).replace(/\{dir\}/g, WDIRS[d.site]).replace(/\{wave\}/g, d.wave); }
function warValue(p) { let v = 0; for (const b of W.bld) if (b.owner === p.id && b.type !== 'nest') v += b.spent || 0; for (const id in p.techs) v += TECHBY[id] ? TECHBY[id].cost : 0; return v; }
function sitePt(i) { return W.pts[W.M.spawnPts[i + 1]]; }
function warWipe(p) {   // remove a commander from the map without ending the game
  for (const pt of W.pts) if (pt.owner === p.id) { pt.owner = -1; pt.ctrl = 0; pt.capP = -1; }
  for (const u of W.units.slice()) if (u.owner === p.id) { u.dead = true; const i = W.units.indexOf(u); if (i >= 0) { W.units[i] = W.units[W.units.length - 1]; W.units.pop(); } W.byId.delete(u.id); }
  for (const b of W.bld.slice()) if (b.owner === p.id) { b.dead = true; const pt = b.pt >= 0 ? W.pts[b.pt] : null; if (b.type === 'wall') { if (pt) pt.wall = null; for (const a of b.arcs) markNav(W.M, a[0], a[1], .6, -1); } else if (b.slot >= 0 && pt) { pt.slots[b.slot].b = null; markNav(W.M, b.x, b.z, b.T.sz * .52, -1); } else if (b.type === 'hq') markNav(W.M, b.x, b.z, 4.4, -1); else markNav(W.M, b.x, b.z, 1.1, -1); const i = W.bld.indexOf(b); if (i >= 0) { W.bld[i] = W.bld[W.bld.length - 1]; W.bld.pop(); } W.byId.delete(b.id); }
  p.pop = 0; p.hqB = null; p.alive = false; p.ai = null; p.res = null; if (W.fev) W.fev = W.fev.filter(e => !(e.k === 'ace' && e.team === p.team));
}
// called at the end of createWorld for a war battle: rebuild the saved Bastion and set up the preparation phase
function warInit() {
  const me = W.players[0], foe = W.players[1]; warWipe(foe); W.teams[foe.team].alive = false; W.players.forEach(q => { q.popCap = 60; });
  for (const sb of (WAR.blds || [])) {
    const pt = W.pts[sb.pt]; if (!pt) continue;
    if (sb.type === 'hq') { const h = me.hqB; if (h) { h.sqSave = sb.sq || 0; h.sqmSave = sb.sqm || 0; h.lvl = sb.lvl; h.spec = sb.spec || ''; h.hasRally = !!sb.rally; if (sb.rally) { h.rx = sb.rally[0]; h.rz = sb.rally[1]; } if (h.ros && sb.ros) { h.ros = Object.assign({}, sb.ros); h.paid = Object.assign({}, sb.paid || {}); } h.spent = sb.spent || 0; } continue; }
    if (sb.type === 'wall') { if (pt.wall) { const w0 = pt.wall; if (w0.owner === 0 && !w0.spent) { w0.lvl = sb.lvl || 1; w0.spec = sb.spec || ''; w0.spent = sb.spent || 0; w0.prog = sb.prog === undefined ? 1 : sb.prog; w0.hold = !!sb.hold; w0.sqSave = sb.sq || 0; w0.sqmSave = sb.sqm || 0; if (w0.spec === 'mines') initMines(w0); } continue; } }   // 3.0: the Dug In perk already ringed the HQ: the saved wall (its level and upgrade) takes its place
    else if (!pt.slots[sb.slot] || pt.slots[sb.slot].b) continue;
    const b = placeBuilding(sb.type, 0, pt, sb.type === 'wall' ? -2 : sb.slot, true); if (sb.type === 'wall') b.slot = -2;
    b.lvl = sb.lvl || 1; b.spec = sb.spec || ''; b.spent = sb.spent || 0; b.prog = sb.prog === undefined ? 1 : sb.prog; b.hold = !!sb.hold;
    if (b.ros && sb.ros) { b.ros = Object.assign({}, sb.ros); b.paid = Object.assign({}, sb.paid || {}); }
    if (sb.rally) { b.hasRally = true; b.rx = sb.rally[0]; b.rz = sb.rally[1]; }
    b.sqSave = sb.sq || 0; b.sqmSave = sb.sqm || 0;
    if (b.type === 'wall' && b.spec === 'mines') initMines(b);
  }
  // 3.0: a roster only keeps troops of the army this war is fought with (and types this version knows)
  for (const b of W.bld) if (b.owner === 0 && b.ros) for (const k in b.ros) if (!UT[k] || facOfT(UT[k]) !== me.fac) { delete b.ros[k]; if (b.paid) delete b.paid[k]; }
  for (const id of WAR.pts || []) { const pt = W.pts[id]; if (pt && pt.hq < 0) { pt.owner = 0; pt.ctrl = 1; pt.capP = 0; } }
  me.techs = Object.assign({}, WAR.techs); me.sup = WAR.sup; recalcMods(me); for (const b of W.bld) if (b.owner === 0) { refreshB(b); b.hp = b.prog >= 1 ? b.maxHp : b.maxHp * Math.max(.12, b.prog); }
  // the garrison is at full strength when a wave starts (up to the army limit; the rest train as usual)
  { const cap = popCapOf(me); me.popCap = cap; let pop = 0; for (const u of W.units) if (u.owner === 0) pop += u.T.pop;
    for (const b of W.bld) if (b.owner === 0 && b.ros && b.prog >= 1) for (const k in b.ros) { let n = 0; for (let i = 0; i < b.ros[k] && pop + UT[k].pop <= cap; i++) { spawnFromBuilding(b, k, i); pop += UT[k].pop; n++; } b.made[k] = n; } }
  W.war = { phase: 'prep', t: WAR.blds ? 60 : 90, wave: WAR.wave, def: warDef(WAR.wave), saveT: 10 };
  if (WAR.blds && WAR.wave > 1) for (const u of W.units.slice()) if (u.owner === 0 && !u.home) { u.dead = true; const i = W.units.indexOf(u); W.units[i] = W.units[W.units.length - 1]; W.units.pop(); W.byId.delete(u.id); me.pop -= u.T.pop; }   // the starting squad only comes with a brand-new Bastion
  me.pop = 0; for (const u of W.units) if (u.owner === 0) me.pop += u.T.pop;
  if (!WAR.blds) warSave();
}
// 4.3: after loading the Bastion, put back each building's "joins squad" setting and its troops in the squads they were in
function warRestoreSquads() {
  UI.bsq = UI.bsq || {};
  for (const b of W.bld) {
    if (b.owner !== 0) continue; if (b.sqSave) UI.bsq[b.id] = b.sqSave; const m = b.sqmSave; b.sqSave = 0; b.sqmSave = 0; if (!m) continue;
    for (const t in m) {
      const want = []; for (const n in m[t]) for (let i = 0; i < m[t][n]; i++) want.push(+n);
      for (const u of W.units) { if (!want.length) break; if (u.owner === 0 && u.home === b.id && u.type === t) squadAdd(want.shift(), [u.id]); }
      for (const n of want) (UI.sqPend[b.id + ':' + t] = UI.sqPend[b.id + ':' + t] || []).push(n);   // not trained yet: they join when they are
    }
  }
}
// what gets saved: the player's buildings, flags, money, finished upgrades (anything half-done is refunded)
function warSave() {
  if (!W || !W.o.war || !WAR) return; const me = W.players[0]; let sup = me.sup; const blds = [];
  const sqOf = {}, sqm = {}; for (let n = 1; n <= 5; n++) for (const id of (UI.groups || {})[n] || []) sqOf[id] = n;   // squads: per building, per troop type, how many are in each squad
  for (const u of W.units) if (u.owner === 0 && u.home && sqOf[u.id]) { const m = sqm[u.home] = sqm[u.home] || {}, c = m[u.type] = m[u.type] || {}; c[sqOf[u.id]] = (c[sqOf[u.id]] || 0) + 1; }
  for (const k in UI.sqPend || {}) { const [h, t] = k.split(':'); for (const n of UI.sqPend[k]) { const m = sqm[h] = sqm[h] || {}, c = m[t] = m[t] || {}; c[n] = (c[n] || 0) + 1; } }
  for (const b of W.bld) {
    if (b.owner !== 0 || b.dead || b.type === 'nest') continue;
    if (b.upg) sup += b.upg.kind === 'lvl' ? bCost(me, b.type, b.lvl) : SPEC_COST;   // 3.0: what was paid (the Contractors perk makes level-ups cheaper)
    blds.push({ type: b.type, pt: b.pt, slot: b.slot, lvl: b.lvl, spec: b.spec, spent: Math.round(b.spent || 0), prog: b.prog >= 1 ? 1 : +b.prog.toFixed(3), ros: b.ros ? Object.assign({}, b.ros) : null, paid: b.paid ? Object.assign({}, b.paid) : null, rally: b.hasRally ? [b.rx, b.rz] : 0, hold: b.hold ? 1 : 0, sq: (UI.bsq || {})[b.id] || 0, sqm: sqm[b.id] || 0 });
  }
  if (me.res) sup += TECHBY[me.res.id].cost;
  WAR.blds = blds; WAR.pts = W.pts.filter(q => q.owner === 0 && q.hq < 0).map(q => q.id); WAR.techs = Object.assign({}, me.techs); WAR.sup = Math.floor(sup); saveWar();
}
function warTick() {
  const w = W.war; if (!w || W.over || !inGame) return;   // after quitting, the old world can tick a moment longer: never autosave it then (the squad settings are already cleared)
  if (w.phase === 'prep') {
    if (w.hold && SCREEN !== 'warwave' && W.t - (w.holdT || 0) > 3) w.hold = false;   // 2.0: the after-wave screen was closed some other way (pause menu, tab switch): never get stuck without a Start Wave button
    if (w.hold) return;
    warSave();                 // everything done to the Bastion between waves is saved right away (once a second)
    if (w.go) warSpawn();      // the wave only starts when the player presses Start Wave
  } else if (w.phase === 'fight') {
    if (w.q && w.q.length && (w.dropT = (w.dropT || 0) - 1) <= 0) warDrop();      // the next drop lands
    if ((w.retT = (w.retT || 0) - 1) <= 0) { w.retT = 2; warRetarget(false); }
    let left = 0; for (const u of W.units) if (u.owner === 1 && !u.dead) left++;
    w.left = left + (w.q ? w.q.length : 0);
    if (!w.left) { warWon('held'); return; }                                         // every landed trooper is down: wave won
    w.t--; if (w.t <= 0) warWon('held');
  }
}
function warSpawn() {
  // 2.3: no enemy base and no warnings - the enemy army simply lands in waves of drops and goes for your buildings
  const w = W.war, d = w.def, me = W.players[0], e = W.players[1], S = WSTYLE[d.style], wave = d.wave; warSave();
  const site = sitePt(d.site); for (const sl of site.slots) if (sl.b) killBuilding(sl.b, null, -1);
  e.alive = true; e.out = ''; e.techs = {}; e.res = null; e.cd = {}; e.fac = d.fac === 1 ? 1 : 0; e.stats = { kills: 0, lost: 0, built: 0, captured: 0, air: 0, specs: 0, calls: 0, sup: 0, hero: 0, peakPts: 0 }; e.name = d.name; e.hqB = null; e.ai = null; e.sup = 0;
  const tm = W.teams[e.team]; tm.alive = true; tm.tickets = 999999;
  const MD = WMODS[d.mod] || {}, base = AIP[S.pers];
  // upgrades for the enemy troops (more as the waves go up)
  { const tl = techList(e.fac), nt = Math.min(tl.length, Math.floor(wave * .7)); for (const id0 of (base.tech || []).concat(tl.map(t => t.id))) { if (Object.keys(e.techs).length >= nt) break; const w0 = TECHBY[id0], t = w0 && (tl.includes(w0) ? w0 : tl.find(x => x.eq === id0 || x.id === w0.eq)); if (!t || e.techs[t.id] || (t.tier > 1 && !e.techs[techPrev(t, e.fac).id])) continue; e.techs[t.id] = 1; } }
  recalcMods(e);
  // what lands: the commander's favourite troops, the stronger ones as the waves go up
  const uw = Object.assign({}, S.uw || base.uw, MD.uw || {}), tier = wave < 4 ? 1 : wave < 9 ? 2 : 3, pool = [];
  for (const t0 in uw) { const t = fu(e, t0), T = UT[t]; if (!T || T.nobuild || !(T.w || T.w2) || !T.src || facOfT(T) !== e.fac) continue; if (T.air && wave < 4) continue; const need = Math.min(...T.src.map(x => x[1])); if (need <= tier) pool.push([t, uw[t0]]); }   // 3.0: a Legion wave lands the Legion version of each troop
  if (!pool.length) pool.push([fu(e, 'rifleman'), 1]); let sum = 0; for (const x of pool) sum += x[1];
  let money = (1000 + wave * 330 + warValue(me) * Math.min(1.2, .4 + wave * .05)) * (MD.army || 1) * (d.boss ? 1.2 : 1);
  const q = []; let pop = 0;
  while (money > 40 && pop < 420) { let r = Math.random() * sum, t = pool[0][0]; for (const x of pool) { r -= x[1]; if (r <= 0) { t = x[0]; break; } } money -= UT[t].cost; pop += UT[t].pop; q.push(t); }
  w.q = q; w.dropT = 0; w.dropN = 0; w.retT = 0;
  w.phase = 'fight'; w.t = MD.time || Math.min(900, 420 + wave * 20);
  if (d.wxm) setWeather(d.wxm === 'night' ? 'night' : 'day', d.wxw || 'clear');   // 3.0 night / storm waves
  if (d.boss) w.q.splice(Math.min(6, w.q.length), 0, 'BOSS');
  warDrop();
}
// one drop: a group of troops lands at the landing site and heads for your buildings
function warDrop() {
  const w = W.war, d = w.def, e = W.players[1], site = sitePt(d.site); if (!w.q || !w.q.length) return;
  const n = Math.min(w.q.length, w.dropN === 0 ? Math.max(8, Math.ceil(w.q.length * .35)) : Math.max(5, Math.ceil(w.q.length * .3)), 60); w.dropN++;
  const vet = d.wave >= 15 ? 2 : d.wave >= 7 || (WMODS[d.mod] || {}).vet ? 1 : 0;
  for (const t of w.q.splice(0, n)) {
    const a = Math.random() * TAU, r = 4 + Math.random() * 16, p = snapFree(W.M, site.x + Math.cos(a) * r, site.z + Math.sin(a) * r, 8);
    let u;
    if (t === 'BOSS') { u = spawnUnit(fu(e, 'titan'), e.id, p[0], p[1], { vet: 2, hpB: (4 + d.wave * .1) * (e.fac ? .7 : 1), dmB: 1.5 }); u.boss = 1; u.nick = 'Warlord ' + d.name.split(' ').slice(-1)[0]; }   // a Legion Warlord rides a Siege Titan (its huge recharging shield is scaled too, so less armor)
    else u = spawnUnit(t, e.id, p[0], p[1], { vet });
    refreshUnit(u); u.hp = u.maxHp; u.ghost = 3;
  }
  w.dropT = Math.max(14, 26 - d.wave * .5);
  warRetarget(true);
}
// landed troops go after the nearest of your buildings (and the next one once it's gone)
function warRetarget(all) {
  const e = W.players[1], mine = W.bld.filter(b => b.owner === 0 && !b.dead && b.type !== 'nest'); if (!mine.length) return;
  const groups = new Map();
  for (const u of W.units) {
    if (u.owner !== e.id || u.dead) continue;
    if (!all && u.o !== 0 && u.tgt && !u.tgt.dead) continue;
    let best = null, bd = 1e9; for (const b of mine) { const dd = Math.hypot(b.x - u.x, b.z - u.z) * (b.type === 'wall' ? 1.6 : 1); if (dd < bd) { bd = dd; best = b; } }
    if (!best) continue; let g = groups.get(best); if (!g) groups.set(best, g = []); g.push(u.id);
  }
  for (const [b, ids] of groups) applyCmd(e.id, { k: 'atk', ids, t: b.id });
}
function warHqDown(b) { if (b.owner === 0) warLost(); else warWon('hq'); }
function warWon(how) {
  const w = W.war, d = w.def, me = W.players[0], e = W.players[1]; if (w.phase !== 'fight') return;
  const reward = Math.round((300 + d.wave * 110) * (how === 'hq' ? 1.5 : 1) * ((WMODS[d.mod] || {}).rw || 1) * (d.boss ? 1.5 : 1)); me.sup += reward;
  WAR.kills += me.stats.kills - (w.k0 || 0); w.k0 = me.stats.kills;
  warWipe(e); W.teams[e.team].alive = false; if (d.wxm) setWeather('day', 'clear');
  WAR.hist.unshift([d.wave, d.name, how === 'hq' ? 'won' : 'held']); WAR.hist.length = Math.min(WAR.hist.length, 12);
  WAR.wins++; WAR.lastSite = d.site; WAR.lastStyle = d.style; WAR.wave = d.wave + 1; WAR.best = Math.max(WAR.best, WAR.wave);
  if (d.wave % 2 === 0 && !WAR.offer) { const r = mulberry32(((WAR.seed | 0) + d.wave * 31) >>> 0), ids = WAR_DOCS.filter(id => (WAR.docs[id] || 0) < DOCS[id].max), out = []; while (out.length < 3 && ids.length) out.push(ids.splice((r() * ids.length) | 0, 1)[0]); if (out.length) WAR.offer = out; }
  W.war = { phase: 'prep', t: 60, wave: WAR.wave, def: warDef(WAR.wave), saveT: 10, hold: true, holdT: W.t };
  warSave();
  const ms = LORE.war.milestones[WAR.wave] && !WAR.seen[WAR.wave] ? LORE.war.milestones[WAR.wave] : ''; if (ms) { WAR.seen[WAR.wave] = 1; saveWar(); }
  const gx = grantXp(Math.round(40 + d.wave * 8)); saveProf();   // 3.0: a wave won counts for commander XP (General perks)
  const info = { wave: d.wave, name: d.name, ep: d.ep, how, reward, line: warFill(wpick(Math.random, LORE.war.waveWon), d), ms, next: W.war.def, xp: Math.round(40 + d.wave * 8), gx };
  setTimeout(() => { if (W && W.o.war && inGame) { W.paused = true; showScreen('warwave', info); } }, 1800);
}
function warLost() {
  const w = W.war, d = w.def; if (w.phase !== 'fight') return; w.phase = 'lost'; W.over = true;
  WAR.losses++; WAR.hist.unshift([d.wave, d.name, 'lost']); WAR.hist.length = Math.min(WAR.hist.length, 12); saveWar();
  const info = { wave: d.wave, name: d.name, line: warFill(wpick(Math.random, LORE.war.waveLost), d) };
  setTimeout(() => { if (W && W.o.war && inGame) { W.paused = true; showScreen('warlost', info); } }, 2300);
}
function warCfg() {
  const colors = assignColors({});
  return { map: 'bastion', players: [{ kind: 'human', name: SET.name, team: 0, color: PCOL[colors[0]].c, docs: WAR.docs, fac: WAR.fac === 1 ? 1 : 0, gen: genActive() }, { kind: 'ai', name: 'Enemy', team: 1, color: PCOL[colors[1]].c, ai: { pers: 'hale', diff: 'normal' } }], tickets: 999999, supplies: 0, fog: false, speed: 1, maxPop: 320, events: true, war: true, spawnFor: [0, 1] };
}
function warDocChips() { return Object.entries(WAR.docs).map(([k, n]) => docChip(k, n)).join(' ') || '<span class="note">None yet. Every second wave you win lets you pick one.</span>'; }
function warDocCards(ids) { return '<div class="dgrid">' + ids.map(id => { const d = DOCS[id], n = WAR.docs[id] || 0; return '<button class="dcard" data-act="wardoc" data-v="' + id + '"><b>' + esc(d.n) + (n ? ' <i>(' + (n + 1) + ')</i>' : '') + '</b><span>' + esc(d.d) + '</span></button>'; }).join('') + '</div>'; }
SCREENS.war = () => {
  const head = `<div class="row" style="justify-content:space-between"><h2 style="margin:0;color:#ffe2a6">Endless War</h2><button class="tbtn" data-act="back">Back</button></div>`;
  const intro = `<div class="note" style="font-size:14.5px;color:#e6eef7;margin-top:6px;white-space:pre-line">${esc(LORE.war.intro)}</div>
  <div class="note" style="margin-top:8px">You hold <b>the Bastion</b>, a huge fortress with 24 build spots and six outposts around it. Each wave a <b>new enemy commander</b> lands from a new direction with a base and army built to rival yours, and it gets tougher every time. <b>Destroy their HQ</b> (big reward) or <b>hold out</b> until they give up. Lose and you rebuild from the start of that wave. Your base, money, upgrades and Doctrines are always saved.</div>`;
  if (!WAR) return `<div class="scr bg"><div class="panel" style="width:min(640px,98vw)">${head}${intro}<div class="lbl">Choose the army that holds your Bastion (it stays for the whole war)</div><div class="row" style="gap:8px;align-items:stretch">${FACS.map(f => `<button class="mbtn${f.id === 0 ? ' go' : ''}" style="flex:1;margin:0" data-act="warnew" data-v="${f.id}">Raise the Bastion: ${f.n}<small>${esc(f.d)}</small></button>`).join('')}</div></div></div>`;
  const hist = WAR.hist.slice(0, 6).map(h => `<div class="ach ${h[2] === 'lost' ? '' : 'ok'}"><b style="min-width:70px">Wave ${h[0]}</b><span>${esc(h[1])}</span><i style="margin-left:auto">${h[2] === 'won' ? 'HQ destroyed' : h[2] === 'held' ? 'held out' : 'Bastion fell'}</i></div>`).join('');
  const nd = warDef(WAR.wave);
  return `<div class="scr bg"><div class="panel" style="width:min(680px,98vw)">${head}${intro}
  <div class="row" style="gap:18px;margin-top:10px"><div><div class="lbl">Army</div><b style="font-size:20px">${FACS[WAR.fac | 0].n}</b></div><div><div class="lbl">Wave</div><b style="font-size:26px;color:#ffe2a6">${WAR.wave}</b></div><div><div class="lbl">Best</div><b style="font-size:20px">${WAR.best}</b></div><div><div class="lbl">Won / lost</div><b style="font-size:20px">${WAR.wins} / ${WAR.losses}</b></div><div><div class="lbl">Money saved</div><b style="font-size:20px">${WAR.sup}</b></div></div>
  <div class="lbl">Next enemy</div><div class="note"><b style="color:#ff9a8c">${esc(nd.name)}</b>, ${esc(nd.ep)} (${esc(nd.title)}) is coming from the ${WDIRS[nd.site]}${nd.fac === 1 ? ' with an Iron Legion army' : ''}.</div>
  <div class="lbl">Doctrines</div><div>${warDocChips()}</div>${WAR.offer ? `<div class="lbl">Pick a Doctrine</div>${warDocCards(WAR.offer)}` : ''}
  ${hist ? `<div class="lbl">Recent waves</div><div style="display:grid;gap:5px">${hist}</div>` : ''}
  <button class="mbtn go" style="margin-top:14px" data-act="warplay">Defend the Bastion: Wave ${WAR.wave}<small>${WAR.blds ? 'Your base is waiting' : 'Build up before the first enemy lands'}</small></button>
  <div class="row" style="justify-content:flex-end;margin-top:6px"><button class="tbtn" data-act="warreset" style="border-color:#8a3a30">${UI.wreset ? 'Click again to delete this war and start over' : 'Start a new war'}</button></div></div></div>`;
};
SCREENS.warwave = (r) => `<div class="scr bg"><div class="panel" style="width:min(560px,98vw);text-align:center"><div class="title" style="font-size:clamp(28px,6vw,48px)">WAVE ${r.wave} WON</div>
  <div class="sub">${esc(r.name)}, ${esc(r.ep)}: ${r.how === 'hq' ? 'HQ destroyed' : 'gave up the attack'}</div>
  <div class="note" style="font-size:15px;color:#e6eef7;margin:8px 0">${esc(r.line)}</div><div class="note"><b style="color:#7be08a">+${r.reward} money</b>${r.how === 'hq' ? ' (HQ bonus)' : ''}. ${r.xp ? '+' + r.xp + ' XP. ' : ''}Progress saved.${r.gx && r.gx.rankUp ? '<br><b style="color:#7be08a">Promoted to ' + r.gx.rankUp + '!</b>' : ''}${r.gx && r.gx.genUp ? '<br><b style="color:#8fd0ff">+' + r.gx.genUp + ' General point' + (r.gx.genUp > 1 ? 's' : '') + '! Spend ' + (r.gx.genUp > 1 ? 'them' : 'it') + ' in General Perks (main menu).</b>' : ''}</div>
  ${r.ms ? `<div class="note" style="margin:10px 0;padding:10px;border:1px solid #8a6a28;border-radius:10px;background:#1a150a;color:#ffe2a6;text-align:left"><b>War report, wave ${WAR.wave}</b><br>${esc(r.ms)}</div>` : ''}
  ${WAR.offer ? `<div class="lbl" style="text-align:left">Pick a Doctrine (lasts for the whole war)</div>${warDocCards(WAR.offer)}` : ''}
  <div class="note" style="margin-top:10px">Next: <b style="color:#ff9a8c">${esc(r.next.name)}</b> (${esc(r.next.title)}) from the ${WDIRS[r.next.site]}.${warIntel(r.next) ? ' <b style="color:#ffe2a6">' + esc(warIntel(r.next)) + '</b>' : ''} Take your time to build; the wave starts when you press <b>Start Wave</b>.</div>
  ${WAR.offer ? '' : '<button class="mbtn go" data-act="warnext">Prepare for wave ' + WAR.wave + '</button>'}<button class="mbtn" data-act="warmenu">Save and leave</button></div></div>`;
SCREENS.warlost = (r) => `<div class="scr bg"><div class="panel" style="width:min(520px,98vw);text-align:center"><div class="title" style="font-size:clamp(28px,6vw,48px);background:linear-gradient(180deg,#ffd0c8,#d4483a 60%,#7a1d14);-webkit-background-clip:text;background-clip:text">THE BASTION FELL</div>
  <div class="sub">Wave ${r.wave} - ${esc(r.name)}</div><div class="note" style="font-size:15px;color:#e6eef7;margin:10px 0">${esc(r.line)}</div>
  <div class="note">Your base is restored to how it was when wave ${r.wave} began. Nothing else is lost.</div>
  <button class="mbtn go" data-act="warretry">Rebuild and try again</button><button class="mbtn" data-act="warmenu2">Endless War menu</button></div></div>`;
