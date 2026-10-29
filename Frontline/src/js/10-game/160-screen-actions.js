// ----- screen actions -----
let ACT = {};
ACT.war = () => { UI.wreset = 0; showScreen('war'); };
ACT.warnew = el => { warNew(el && +el.dataset.v === 1 ? 1 : 0); showScreen('war'); };
ACT.warreset = () => { if (!UI.wreset) { UI.wreset = 1; showScreen('war'); return; } UI.wreset = 0; WAR = null; lsSet('frontline_war_v1', ''); showScreen('war'); };
ACT.warplay = () => { if (!WAR) warNew(); startGame(warCfg()); };
ACT.wardoc = el => { const id = el.dataset.v; if (!WAR || !WAR.offer || !WAR.offer.includes(id)) return; WAR.docs[id] = (WAR.docs[id] || 0) + 1; WAR.offer = null; saveWar(); if (inGame && W && W.o.war) { const me = W.players[0]; me.perkMod = perkModOf(WAR.docs, me.gen); me.bounty = (WAR.docs.bounty ? .15 : 0) + (me.gen && me.gen.spoils ? .1 : 0); me.fevMul = WAR.docs.qm ? 2 : 1; recalcMods(me); sfx('done'); ACT.warnext(); } else showScreen('war'); };
ACT.warnext = () => { closeScreen(); if (W && W.war) { W.war.hold = false; W.paused = false; } };
ACT.warnow = () => { if (W && W.war && W.war.hold && SCREEN !== 'warwave' && W.t - (W.war.holdT || 0) > 3) W.war.hold = false; if (W && W.war && W.war.phase === 'prep' && !W.war.hold && !W.war.go) { W.war.go = true; sfx('click'); hudUpdate(true); } };
ACT.warmenu = () => { if (W && W.o.war && W.war && W.war.phase === 'prep') warSave(); endGame(); ACT.war(); };
ACT.warmenu2 = () => { endGame(); ACT.war(); };
ACT.warretry = () => { endGame(); startGame(warCfg()); };
ACT.campaign = () => { UI.cquit = 0; showScreen('campaign'); };
ACT.cstart = el => { campNew(el.dataset.v); PROF.cRuns++; saveProf(); showScreen('campaign'); };
ACT.cgo = el => { const c = CAMP && CAMP.choices && CAMP.choices[+el.dataset.v]; if (!c) return; CAMP.cur = c; saveCamp(); startGame(campCfg(c)); };
ACT.cdoc = el => { const id = el.dataset.v; if (!CAMP || !CAMP.offer || !CAMP.offer.includes(id)) return; CAMP.docs[id] = (CAMP.docs[id] || 0) + 1; CAMP.offer = null; CAMP.stage++; campChoices(); saveCamp(); if (inGame) endGame(); showScreen('campaign'); };
ACT.cquit = () => { if (!UI.cquit) { UI.cquit = 1; showScreen('campaign'); return; } UI.cquit = 0; CAMP.over = 'lost'; PROF.cBest = Math.max(PROF.cBest, CAMP.stage); saveProf(); saveCamp(); showScreen('campaign'); };
ACT.tocamp = () => { if (inGame) endGame(); ACT.campaign(); };
ACT.tutorial = () => startTutorial(); ACT.skirmish = () => { if (!SK) SK = defaultSK(); applySimple(SK); showScreen('skirmish'); };
ACT.sandbox = () => startSandbox(); ACT.codex = () => { BACKSCREEN = 'main'; showScreen('codex'); }; ACT.profile = () => { BACKSCREEN = 'main'; showScreen('profile'); }; ACT.settings = () => { BACKSCREEN = 'main'; showScreen('settings'); };
let HOWFROM = '';
ACT.help = () => { HOWFROM = SCREEN; if (inGame && W) { if (!W.o.mp && !W.paused) { W.paused = true; PAUSEDBYHELP = true; } else PAUSEDBYHELP = false; BACKSCREEN = 'pause'; } else BACKSCREEN = 'main'; showScreen('howto'); };
ACT.howback = () => { if (inGame && W) { if (HOWFROM === 'pause') { showScreen('pause'); return; } closeScreen(); if (PAUSEDBYHELP && W) W.paused = false; PAUSEDBYHELP = false; } else showScreen('main'); };
ACT.skiptut = () => { PROF.seenIntro = 1; saveProf(); showScreen('main'); };
ACT.general = () => { if (inGame && W && resultsShown) endGame(); BACKSCREEN = 'main'; showScreen('general'); };
ACT.genbuy = el => { const id = el.dataset.v, why = genCanBuy(id), g = GENBY[id]; if (why) { sfx('deny'); toast(why === 'max' ? g.n + ' is already maxed.' : why === 'tier' ? 'Spend ' + GEN_TIER[g.tier] + ' points in ' + GEN_BR.find(b => b.id === g.br).n + ' first.' : 'No points left. Fight more battles to earn commander XP.'); return; } PROF.gen[id] = (PROF.gen[id] | 0) + 1; if (genSpent(PROF.gen) >= 15 && !PROF.ach.gen) { PROF.ach.gen = 1; toast('Achievement: ' + ACH.gen[0]); } saveProf(); sfx('done'); showScreen('general'); };
ACT.genreset = () => { if (!genSpent(PROF.gen)) { toast('Nothing to reset.'); return; } PROF.gen = {}; saveProf(); toast('All perks reset. Spend your points again.'); showScreen('general'); };
ACT.back = () => showScreen('main'); ACT.back2 = () => { if (inGame && W) showScreen('pause'); else showScreen(BACKSCREEN); };
ACT.mp = () => { showScreen('mp'); };
ACT.map = el => { SK.map = el.dataset.v; const mp = mapDef(SK.map).maxP; if (mp < 3) { SK.type = '1v1'; } if (SCREEN === 'mplobby') { SK.slots[2].kind = mp < 3 ? 'closed' : SK.slots[2].kind; SK.slots[3].kind = mp < 3 ? 'closed' : SK.slots[3].kind; } else applySimple(SK); reSK(); };
ACT.opt = el => { let v = el.dataset.v; const k = el.dataset.k; if (k === 'fog' || k === 'events') v = v === '1'; else if (k !== 'supplies') v = +v; SK[k] = v; reSK(); };
ACT.stype = el => { SK.type = el.dataset.v; applySimple(SK); reSK(); };
ACT.sdiff = el => { SK.diff = el.dataset.v; applySimple(SK); reSK(); };
ACT.sstyle = el => { SK.style = el.value; applySimple(SK); };
ACT.moreopt = () => { SK.more = !SK.more; showScreen('skirmish'); };
ACT.swx = el => { SK[el.dataset.k] = el.dataset.v; reSK(); };   // 3.0 time of day / weather
ACT.scustom = el => { const on = el.dataset.v === '1'; if (on && !SK.custom) { SK.custom = false; applySimple(SK); } SK.custom = on; applySimple(SK); showScreen('skirmish'); };
ACT.news = () => { BACKSCREEN = 'main'; showScreen('news'); };
ACT.newsok = () => { PROF.seenVer = VERSION; saveProf(); showScreen('main'); };
ACT.slotkind = el => { const i = +el.dataset.i; SK.slots[i].kind = el.value; if (el.value === 'ai' && SK.slots[i].team === SK.slots[0].team) SK.slots[i].team = i; reSK(); };
ACT.slotpers = el => { SK.slots[+el.dataset.i].pers = el.value; };
ACT.slotdiff = el => { SK.slots[+el.dataset.i].diff = el.value; };
ACT.slotteam = el => { SK.slots[+el.dataset.i].team = +el.value; };
ACT.slotfac = el => { const v = el.value; SK.slots[+el.dataset.i].fac = v === 'auto' ? 'auto' : +v; };
ACT.sfac = el => { SK.fac = +el.dataset.v === 1 ? 1 : 0; SET.fac = SK.fac; saveSet(); if (SCREEN === 'mplobby') { refreshLobby(); lobbyChanged(); } else showScreen('skirmish'); };
ACT.sefac = el => { SK.efac = el.dataset.v; SET.efac = SK.efac; saveSet(); showScreen('skirmish'); };
function reSK() { if (SCREEN === 'mplobby') { refreshLobby(); lobbyChanged(); } else showScreen('skirmish'); }
ACT.startsk = () => { const err = validSK(SK); if (err) { toast(err); return; } SK.seed = (SK.seed | 0) + 1; applySimple(SK); const cfg = skToCfg(SK); cfg.players[0].gen = genActive(); startGame(cfg); };   // 3.0: General perks in Quick Battles
ACT.gfxp = el => { const v = el.dataset.v; SET.gfx = v; if (v === 'auto') { autoLvl = GPU.weak ? 0 : 1; applyLevel(['low', 'medium', 'high'][autoLvl]); } else applyPreset(v); saveSet(); applyGfx(); showScreen('settings'); };
ACT.setb = el => { SET[el.dataset.k] = el.dataset.v === '1'; if (el.dataset.k === 'shadows') SET.gfx = 'custom'; saveSet(); applyGfx(); showScreen('settings'); };
ACT.setv = el => { SET[el.dataset.k] = el.dataset.v; saveSet(); if (el.dataset.k === 'uiSize') hudScale(); showScreen('settings'); };
ACT.adv = () => { SET.adv = !SET.adv; saveSet(); showScreen('settings'); };
ACT.rng = el => { const k = el.dataset.k; SET[k] = +el.value; if (['particles', 'scale', 'decor', 'maxUnits'].includes(k)) SET.gfx = 'custom'; const v = $('#v_' + k); if (v) v.textContent = SET[k] + (k === 'maxUnits' ? '' : k === 'camSpd' ? 'x' : '%'); saveSet(); setVol(); if (k === 'scale') resize(); if (k === 'music') musicVol(); if (k === 'decor') applyGfx(); };
ACT.name = el => { SET.name = el.value.slice(0, 14) || 'Commander'; saveSet(); };
ACT.color = el => { const i = +el.dataset.v; if (rankOf(PROF.xp) >= PCOL[i].rank) { PROF.color = i; saveProf(); showScreen('profile'); } else toast('Reach the rank of ' + RANKS[PCOL[i].rank][0] + ' to unlock this color'); };
ACT.ctab = el => { CODEXTAB = el.dataset.v; showScreen('codex'); };
ACT.cfac = el => { CODEXFAC = +el.dataset.v === 1 ? 1 : 0; showScreen('codex'); };
ACT.resume = () => { closeScreen(); if (W) W.paused = false; };
ACT.psettings = () => { BACKSCREEN = 'pause'; showScreen('settings'); };
ACT.pcodex = () => { BACKSCREEN = 'pause'; showScreen('codex'); };
ACT.quit = () => { if (W && W.o.mp) netSurrender(); const camp = W && W.o.camp && !resultsShown, war = W && W.o.war; if (war && W.war && W.war.phase === 'prep') warSave(); endGame(); if (camp) { campAfter(false); ACT.campaign(); } else if (war) ACT.war(); else showScreen('main'); };
ACT.quit2 = () => { endGame(); showScreen('main'); };
ACT.rematch = () => { if (LASTCFG) startGame(LASTCFG, LASTOPT); };
ACT.tolobby = () => { endGame(true); netBackToLobby(); };
function bindMenus() {
  const m = MENU();
  m.addEventListener('click', e => { const t = e.target.closest('[data-act]'); if (!t || t.tagName === 'SELECT' || t.tagName === 'INPUT') return; initAudio(); sfx('click'); const f = ACT[t.dataset.act]; if (f) f(t); });
  m.addEventListener('change', e => { const t = e.target.closest('[data-act]'); if (!t) return; if (t.tagName === 'SELECT' || (t.tagName === 'INPUT')) { const f = ACT[t.dataset.act]; if (f) f(t); if (SCREEN === 'mplobby' && t.tagName === 'SELECT') lobbyChanged(); } });
  m.addEventListener('input', e => { const t = e.target; if (t.type === 'range' || (t.tagName === 'INPUT' && t.dataset.act === 'name')) { const f = ACT[t.dataset.act]; if (f) f(t); } });
  m.addEventListener('keydown', e => { e.stopPropagation(); });
  m.addEventListener('contextmenu', e => { e.preventDefault(); });
}
// ----- upgrades panel -----
function openTech() {
  if (techOpen) { closeTech(); return; } if (!inGame) return; techOpen = true; lastQuick = ''; const d = document.createElement('div'); d.id = 'techp'; d.style.cssText = 'position:absolute;left:50%;top:54px;transform:translateX(-50%);z-index:30;overflow:auto;pointer-events:auto'; d.className = 'panel';
  d.innerHTML = '<div class="row" style="justify-content:space-between"><h3 style="margin:0;color:#ffe2a6;font-size:20px">Upgrades <span class="note" style="font-weight:400;font-size:13px">- help your whole army. One at a time. Rows 1 and 2 need HQ Level 2, row 3 needs HQ Level 3.</span></h3><button class="tbtn" id="techx">Close</button></div><div id="techbody"></div>';
  $('#hud').appendChild(d); $('#techx').onclick = closeTech; d.addEventListener('click', e => { if (e.target.closest('#techmore')) { UI.techAdv = true; updTech(true); return; } const c = e.target.closest('.tcard'); if (c && c.dataset.id) { if (issue({ k: 'tech', id: c.dataset.id })) { UI.did.tech = 1; sfx('click'); } else { sfx('deny'); toast('You cannot start that yet.'); } updTech(true); } });
  updTech(true);
}
function closeTech() { if (techOpen) lastQuick = ''; techOpen = false; const d = $('#techp'); if (d) d.remove(); }
let techSig = '';
function techAdvShown(p, hq) { return !!(UI.techAdv || hq >= 3 || W.o.sandbox || TECH.some(t => TBR.find(b => b.id === t.br).adv && (p.techs[t.id] || (p.res && p.res.id === t.id)))); }
function updTech(force) {
  if (!techOpen) return; const p = P(ME), hq = playerHQLvl(p); const adv = techAdvShown(p, hq);
  let sig = JSON.stringify([p.techs, p.res && p.res.id, Math.floor(p.sup / 20), hq, p.res ? Math.floor(p.res.t) : 0, adv, p.techN || 0]); if (sig === techSig && !force) return; techSig = sig;
  const left = techLeft(p), capped = left <= 0;
  const h = (W.o.sandbox ? '' : '<div class="note" id="techcap" style="margin-bottom:8px">' + (capped ? '<b style="color:#ff9a8a">You have used all ' + TECH_PER_ROUND + ' Upgrades for this battle.</b> Choose them well next time.' : 'Upgrades left this battle: <b>' + left + ' of ' + TECH_PER_ROUND + '</b>') + '</div>') + '<div class="tech">' + TBR.filter(b => adv || !b.adv).map(b => '<div class="tcol"><h5>' + b.n + '</h5>' + techList(p.fac).filter(t => t.br === b.id).map(t => {
    const done = p.techs[t.id], act = p.res && p.res.id === t.id, prev = techPrev(t, p.fac); const need = Math.max(2, t.tier); const lock = !done && !act && ((hq < need && !W.o.sandbox) || (prev && !p.techs[prev.id]) || capped);
    const st = done ? '<span style="color:#7be08a">Done</span>' : act ? '<span style="color:#ffe2a6">Researching ' + Math.floor(p.res.t / p.res.dur * 100) + '%</span>' : lock ? '<span style="color:#ff9a8a">' + (capped && !(hq < need && !W.o.sandbox) && !(prev && !p.techs[prev.id]) ? 'No Upgrades left this battle' : hq < need ? 'Needs HQ Level ' + need : 'Do the one above first') + '</span>' : '<span style="color:#ffe2a6">Costs ' + t.cost + '</span>';
    return '<div class="tcard ' + (done ? 'done' : act ? 'act' : lock ? 'lock' : '') + '" data-id="' + t.id + '"><b>' + t.n + '</b>' + t.d + '<br>' + st + (act ? '<div class="pgb" style="width:' + (p.res.t / p.res.dur * 100) + '%"></div>' : '') + '</div>';
  }).join('') + '</div>').join('') + '</div>' + (adv ? '' : '<div style="margin-top:10px"><button class="tbtn" id="techmore">Show more upgrades (Vision, Command)</button></div>');
  $('#techbody').innerHTML = h;
}

// =====================================================================
//  TUTORIAL: short, step by step, with arrows. Can always be skipped.
// =====================================================================
let TUT = null;
const tutHq = () => P(ME).hqB;
const tutFlag = () => { const h = tutHq(); return W.pts.filter(q => q.owner < 0 && q.hq < 0).sort((a, b) => Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z))[0]; };
const tutBarracks = () => W.bld.find(b => b.owner === ME && b.type === 'barracks');
const tutFoe = () => { let best = null, bd = 1e9; for (const u of W.units) if (u.owner !== ME && u.team !== MYTEAM && !u.dead) { const d = Math.hypot(u.x - cam.x, u.z - cam.z); if (d < bd) { bd = d; best = u; } } return best; };
const ptLabel = (pt) => '.plbl[data-pt="' + pt.id + '"] .lb';
const TUT_STEPS = [
  { t: 'Welcome, Commander!', x: 'You lead the blue army. Your goal is simple: capture flags. If you hold more flags than the enemy, they lose.', tip: 'Move the camera with the arrow keys, WASD or two-finger scroll. Zoom by pinching or Ctrl + scroll. Support powers: hold F + a number.', btn: 'Let us go', target: () => ({ sel: '#scoreRow' }) },
  { t: 'Go back to your base', x: 'Press the Home button to jump to your base. (Or press the Space bar.)', target: () => ({ sel: '#quick [data-q2="home"]' }), ok: () => UI.did.home, setup: () => { UI.did.home = 0; const h = tutHq(); camGoto(h.x * .3, h.z * .3, true); } },
  { t: 'Pick your soldiers', x: 'Press the Army button to select all your soldiers. (Or drag a box around them.)', target: () => ({ sel: '#quick [data-q2="army"]' }), ok: () => selIds.size >= 3, setup: () => { goHome(true); clearSel(); } },
  { t: 'Send them to a flag', x: 'Click the gray flag to send your soldiers there. The pulsing circle is the flag.', target: () => { const f = tutFlag(); return f ? { world: () => [f.x, f.y + 1, f.z], label: 'Gray flag' } : null; }, ok: () => UI.did.move, setup: () => { UI.did.move = 0; if (!selIds.size) selAllArmy(); const f = tutFlag(), h = tutHq(); if (f) { camGoto(f.x, f.z, true); cam.tdist = 100; } } },
  { t: 'Capture the flag', x: 'Wait while your soldiers capture it. The circle fills with your color. Flags give you money!', target: () => { const f = TUT.flag; return f ? { world: () => [f.x, f.y + 1, f.z], label: 'Capturing...' } : null; }, ok: () => TUT.flag && TUT.flag.owner === ME, auto: 1, setup: () => { TUT.flag = tutFlag() || TUT.flag; if (TUT.flag) camGoto(TUT.flag.x, TUT.flag.z); }, skipFn: () => { const f = TUT.flag; if (f && f.owner < 0) { f.owner = ME; f.ctrl = 1; f.capP = ME; } } },
  { t: 'Open the build menu', x: 'Click "+ Build" above your base to see what you can build. You have plenty of money.', target: () => { const h = tutHq(); return { sel: ptLabel(W.pts[h.pt]), fallbackWorld: [h.x, h.y + 10, h.z] }; }, ok: () => selPad && selPad.pt === tutHq().pt, setup: () => { P(ME).sup = Math.max(P(ME).sup, 600); goHome(); clearSel(); afterSel(); } },
  { t: 'Build a Barracks', x: 'Pick the Barracks. It keeps a squad of soldiers.', target: () => ({ sel: '#panel .card[data-key="b_barracks"]' }), ok: () => !!tutBarracks(), setup: () => { P(ME).sup = Math.max(P(ME).sup, 500); const hp = W.pts[tutHq().pt]; if (!(selPad && selPad.pt === hp.id)) selectPoint(hp); }, skipFn: () => { if (!tutBarracks()) { const pt = W.pts[tutHq().pt], k = pt.slots.findIndex(s => !s.b); if (k >= 0) placeBuilding('barracks', ME, pt, k, true); } } },
  { t: 'Fill the Barracks', x: 'Your Barracks is being built. When it is ready, click a Rifleman card to add a Rifleman to its roster.', t2: 'Your Barracks is ready! Click the Rifleman card to add Riflemen to its roster. It holds 5 soldiers for now. The Barracks trains them one by one and replaces any that die.', target: () => { const b = tutBarracks(); if (!b) return null; return b.prog < 1 ? { world: () => [b.x, b.y + 3, b.z], label: 'Building...' } : { sel: '#panel .card[data-key="rifleman"]' }; }, ok: () => (UI.did.train || 0) >= 1, setup: () => { UI.did.train = 0; const b = tutBarracks(); if (b) camGoto(b.x, b.z); }, tick: () => { const b = tutBarracks(); if (b && b.prog >= 1 && !TUT.sel1) { TUT.sel1 = 1; selectBuilding(b); sfx('done'); } }, skipFn: () => { const b = tutBarracks(); if (b) issue({ k: 'ros', b: b.id, u: 'rifleman', d: 1 }); } },
  { t: 'Beat the enemy scouts', x: 'Enemy soldiers are coming! Press Army, then click an enemy soldier to attack it.', target: () => { const e = tutFoe(); return e ? { world: () => { const f = tutFoe(); return f ? [f.rx || f.x, (f.ry || 0) + 4, f.rz || f.z] : [e.x, 4, e.z]; }, label: 'Enemy' } : null; }, ok: () => TUT.foes && TUT.foes.every(u => u.dead), setup: () => { const h = tutHq(), f = tutFlag(); const bx = h.x * .55, bz = h.z * .55 + 30; TUT.foes = []; for (let i = 0; i < 3; i++) { const q = snapFree(W.M, bx + i * 4, bz + (i % 2) * 3); TUT.foes.push(spawnUnit('rifleman', 1, q[0], q[1], { hpB: .55, dmB: .6 })); } applyCmd(1, { k: 'am', ids: TUT.foes.map(u => u.id), x: h.x * .75, z: h.z * .75 + 4 }); camGoto((bx + h.x * .75) / 2, (bz + h.z * .75 + 4) / 2, true); cam.tdist = 100; }, skipFn: () => { for (const u of W.units.slice()) if (u.owner === 1 && TUT.foes && TUT.foes.includes(u)) killUnit(u, null, -1); } },
  { t: 'Level up your base', x: 'Your HQ is selected. Press Level up. This unlocks Upgrades and Support powers like airstrikes.', target: () => ({ sel: '#panel .card[data-key="lvl"]' }), ok: () => { const h = tutHq(); return h.upg || h.lvl >= 2; }, setup: () => { P(ME).sup = Math.max(P(ME).sup, 500); goHome(); selectBuilding(tutHq()); sfx('done'); }, skipFn: () => { issue({ k: 'upg', b: tutHq().id }); } },
  { t: 'You are ready!', x: 'Capture more flags than the enemy to win. Their score drops when you hold more flags. Good luck, Commander!', btn: 'Keep playing', btn2: 'Back to menu', final: 1, setup: () => { for (const p of W.players) if (p.ai) p.ai.hold = false; PROF.tutDone = 1; saveProf(); } }
];
function startTutorial() {
  SK = SK || defaultSK();
  const cfg = { map: 'greenfield', players: [{ name: SET.name, kind: 'human', team: 0, color: PCOL[PROF.color || 0].c }, { name: 'Maj. Hale', kind: 'ai', team: 1, color: PCOL[1].c, ai: { pers: 'hale', diff: 'easy' } }], tickets: 300, supplies: 500, fog: false, speed: 1, maxPop: 100, tutorial: true, buildMul: 4, capSpeed: 2.2 };
  startGame(cfg, { after: tutorialSetup });
}
function tutorialSetup() {
  for (const p of W.players) if (p.ai) p.ai.hold = true;
  TUT = { i: -1, t0: 0, flag: null, nsteps: TUT_STEPS.length, doneT: 0 }; UI.camMoved = 0; UI.did = {}; UI.groups = {};
  const box = $('#tut'); box.classList.remove('hidden'); box.innerHTML = '<div class="tcard"></div><div id="tring" class="hidden"></div><div id="tarrow" class="hidden"></div><div id="tedge" class="hidden"></div>';
  box.querySelector('.tcard').addEventListener('click', e => {
    const b = e.target.closest('[data-tb]'); if (!b || !TUT) return; initAudio(); sfx('click'); const a = b.dataset.tb;
    if (a === 'next') tutAdvance(false); else if (a === 'skip') tutAdvance(true); else if (a === 'exit') tutExit(); else if (a === 'menu') { tutExit(); ACT.quit2(); }
  });
  UI.tutorialTick = tutTick; UI.tutFrame = tutFrame; $('#hud').classList.add('tuton'); tutAdvance(false);
}
function tutExit() { TUT = null; UI.tutorialTick = null; UI.tutFrame = null; $('#hud').classList.remove('tuton'); const box = $('#tut'); box.classList.add('hidden'); box.innerHTML = ''; for (const p of W.players) if (p.ai) p.ai.hold = false; PROF.tutDone = 1; saveProf(); }
function tutAdvance(skipped) {
  if (!TUT) return; const cur = TUT_STEPS[TUT.i]; if (cur && skipped && cur.skipFn) { try { cur.skipFn(); } catch (e) { } }
  TUT.i++; if (TUT.i >= TUT_STEPS.length) { tutExit(); return; }
  const st = TUT_STEPS[TUT.i]; TUT.t0 = W.t; TUT.okT = 0; TUT.sel1 = 0; TUT.shown = TUT.i; if (st.setup) { try { st.setup(); } catch (e) { console.error(e); } }
  tutRender(); sfx('done'); hudUpdate(true);
}
function tutRender() {
  const st = TUT_STEPS[TUT.i], card = $('#tut .tcard'); if (!card) return; let dots = ''; for (let k = 0; k < TUT_STEPS.length; k++) dots += '<i class="' + (k < TUT.i ? 'd' : k === TUT.i ? 'c' : '') + '"></i>';
  const waitB = st.t2 && tutBarracks() && tutBarracks().prog >= 1; const txt = waitB ? st.t2 : st.x;
  card.innerHTML = '<div class="ts">STEP ' + (TUT.i + 1) + ' OF ' + TUT_STEPS.length + '</div><h3>' + esc(st.t) + '</h3><p>' + esc(txt) + '</p>' + (st.tip ? '<p style="font-size:13px;color:#a3b4c7">' + esc(st.tip) + '</p>' : '') + '<div class="tb">' + (st.btn ? '<button class="mbtn go" style="width:auto;margin:0;padding:8px 18px;min-height:44px" data-tb="' + (st.final ? 'exit' : 'next') + '">' + st.btn + '</button>' : '<button class="sm" id="tskip" data-tb="skip" style="min-height:36px">Skip step</button>') + (st.btn2 ? '<button class="sm" data-tb="menu" style="min-height:36px">' + st.btn2 + '</button>' : (!st.final ? '<button class="sm" data-tb="exit" style="min-height:36px;opacity:.8">Skip tutorial</button>' : '')) + '</div><div class="tdots">' + dots + '</div>';
  card.dataset.w = waitB ? 1 : 0;
}
function tutTick() {
  if (!TUT || TUT.i < 0 || !inGame) return; const st = TUT_STEPS[TUT.i]; if (!st) return; if (st.tick) st.tick();
  const card = $('#tut .tcard'); if (card && st.t2 && (tutBarracks() && tutBarracks().prog >= 1 ? 1 : 0) !== +card.dataset.w) tutRender();
  const el = W.t - TUT.t0; if (el > 18) { const s = $('#tskip'); if (s) s.classList.add('pulse'); }
  if (st.ok && el > .8) { if (st.ok()) { if (!TUT.okT) { TUT.okT = W.t; const c = $('#tut .tcard'); if (c) { const o = document.createElement('div'); o.className = 'ok'; o.textContent = 'Nice!'; c.insertBefore(o, c.querySelector('.tb')); sfx('cap'); } } else if (W.t - TUT.okT > 1) tutAdvance(false); } }
  if (st.ok && !st.final && el > (st.auto ? 70 : 60)) tutAdvance(true);
}
function tutRect(t) {
  if (!t) return null;
  if (t.sel) { const e = document.querySelector(t.sel); if (e && e.offsetParent !== null) { let r = e.getBoundingClientRect(); const sc = e.closest('.cards'); if (sc && (r.right > vpW - 4 || r.left < 0 || r.right > sc.getBoundingClientRect().right)) { const sr = sc.getBoundingClientRect(); sc.scrollLeft += (r.left + r.width / 2) - (sr.left + sr.width / 2); r = e.getBoundingClientRect(); } if (r.width > 2) return { x: r.left, y: r.top, w: r.width, h: r.height, el: 1 }; } if (t.fallbackWorld) { const fw = t.fallbackWorld; t = { world: () => fw }; } else return null; }
  if (t.world) { const w = t.world(); w2s(w[0], w[1], w[2], _sp); return { x: _sp.x - 30, y: _sp.y - 30, w: 60, h: 60, behind: _sp.z > 1, label: t.label }; }
  return null;
}
function tutFrame() {
  if (!TUT || TUT.i < 0) return; const st = TUT_STEPS[TUT.i]; const ring = $('#tring'), arr = $('#tarrow'), edge = $('#tedge'); if (!ring) return;
  let tg = null; try { tg = st.target ? st.target() : null; } catch (e) { tg = null; }
  const tgs = Array.isArray(tg) ? tg : [tg]; let r = null; for (const t of tgs) { r = tutRect(t); if (r) break; }
  if (!r) { ring.classList.add('hidden'); arr.classList.add('hidden'); edge.classList.add('hidden'); return; }
  const off = r.behind || r.x + r.w < 0 || r.x > vpW || r.y + r.h < 0 || r.y > vpH;
  if (off) {
    ring.classList.add('hidden'); arr.classList.add('hidden'); const cx = vpW / 2, cy = vpH / 2; let dx = (r.x + r.w / 2) - cx, dy = (r.y + r.h / 2) - cy; if (r.behind) { dx = -dx; dy = -dy; }
    const k = Math.min((vpW / 2 - 70) / Math.max(1, Math.abs(dx)), (vpH / 2 - 150) / Math.max(1, Math.abs(dy))); const ex = cx + dx * k, ey = cy + dy * k; const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '&#8594;' : '&#8592;') : (dy > 0 ? '&#8595;' : '&#8593;');
    edge.className = ''; edge.style.cssText = 'position:fixed;z-index:16;pointer-events:none;padding:8px 14px;border-radius:20px;background:var(--gold);color:#1a1204;font-weight:900;font-size:18px;box-shadow:0 4px 14px #000a;left:' + ex + 'px;top:' + ey + 'px;transform:translate(-50%,-50%)'; edge.innerHTML = (r.label || 'Look') + ' ' + dir; return;
  }
  edge.classList.add('hidden'); ring.classList.remove('hidden'); arr.classList.remove('hidden');
  const pad = r.el ? 5 : 0; ring.style.left = (r.x - pad) + 'px'; ring.style.top = (r.y - pad) + 'px'; ring.style.width = (r.w + pad * 2) + 'px'; ring.style.height = (r.h + pad * 2) + 'px'; ring.style.borderRadius = r.el ? '12px' : '50%';
  const below = r.y < 130; arr.classList.toggle('up', below); arr.style.left = (r.x + r.w / 2 - 16) + 'px'; arr.style.top = below ? (r.y + r.h + pad + 6) + 'px' : (r.y - pad - 34) + 'px';
}
function startSandbox() {
  const cfg = { map: 'greenfield', players: [{ name: SET.name, kind: 'human', team: 0, color: PCOL[PROF.color || 0].c }, { name: 'Dummy AI', kind: 'ai', team: 1, color: PCOL[1].c, ai: { pers: 'hale', diff: 'normal' } }], tickets: 9999, supplies: 99999, fog: false, speed: 1, maxPop: 200, sandbox: true };
  startGame(cfg, { after: () => { for (const p of W.players) if (p.ai) p.ai.hold = true; sandboxPanel(); } });
}
function sandboxPanel() {
  const d = document.createElement('div'); d.id = 'sbx'; d.className = 'panel'; d.style.cssText = 'position:fixed;right:8px;top:130px;z-index:12;width:224px;padding:8px;font-size:12px;max-height:50vh;overflow:auto';
  d.innerHTML = '<b style="color:#ffe2a6">Sandbox</b><div class="note">Pick a troop, then click the map to place it. You have unlimited money.</div>' + seg('sbside', [[0, 'Mine'], [1, 'Enemy']], 0, 'sbside') + '<div class="note" style="margin-top:4px">My army (buildings train it):</div><div class="seg" id="sbfac">' + FACS.map(f => '<button class="' + (f.id === (P(ME).fac | 0) ? 'on' : '') + '" data-sbfac="' + f.id + '">' + f.s + '</button>').join('') + '</div>' + '<div class="row" style="gap:4px;margin-top:6px">' + UTK.map(k => `<div class="chip" data-sb="${k}" data-tip="${UT[k].n}" style="${iconStyle(k)}"></div>`).join('') + '</div><div class="row" style="margin-top:6px"><button class="sm" id="sbai">Turn enemy AI on</button><button class="sm" id="sbclr">Remove enemies</button></div>';
  document.body.appendChild(d); UI.sb = { type: 'rifleman', side: 0 };
  d.addEventListener('click', e => { const fb = e.target.closest('[data-sbfac]'); if (fb) { const p = P(ME); p.fac = +fb.dataset.sbfac; $$('#sbx #sbfac button').forEach(b => b.classList.toggle('on', b === fb)); for (const b of W.bld) if (b.owner === ME && b.ros) { for (const k in b.ros) if (!canTrainAt(b, k)) delete b.ros[k]; refundTraining(b); } UI.cardSig = ''; hudUpdate(true); return; } const s = e.target.closest('[data-sb]'); if (s) { UI.sb.type = s.dataset.sb; setMode('sbspawn'); } const sd = e.target.closest('[data-act="sbside"]'); if (sd) { UI.sb.side = +sd.dataset.v; $$('#sbx .seg:not(#sbfac) button').forEach(b => b.classList.toggle('on', b.dataset.v === sd.dataset.v)); } });
  $('#sbai').onclick = () => { for (const p of W.players) if (p.ai) p.ai.hold = !p.ai.hold; toast('Enemy AI ' + (W.players[1].ai.hold ? 'off' : 'on')); };
  $('#sbclr').onclick = () => { for (const u of W.units.slice()) if (u.owner === 1) killUnit(u, null, -1); };
}
// =====================================================================
//  MULTIPLAYER: PeerJS matchmaking (6-digit code) + WebRTC data channels
//  Host-authoritative simulation. Guest sends commands; host sends
//  compact binary unit snapshots (10 Hz, unreliable channel), JSON "meta"
//  state (5 Hz) and discrete effect events (reliable channel).
// =====================================================================
const PJ_PREFIX = 'frntln-cmd-v2-';
const NETV = 2;   // 3.0 protocol: armies (Iron Legion) in the lobby and the match setup; older builds are turned away with the 'different version' message
const NET = { role: '', pj: null, peer: null, mq: [], via: '', code: '', codeState: '', codeErr: '', joinState: '', joinErr: '', lobby: null, guestName: '', hostName: '', guestReady: false, myReady: false, lastRx: 0, rtt: 0, dirty: false, pingT: 0, matchGuest: -1, joinCode: '', leaving: false, snapsRx: 0, snapsTx: 0, cmdRx: 0, bytesTx: 0, bytesRx: 0, cmdWin: 0, cmdWinT: 0, gotSnap: 0 };
let pjLoading = null;
function loadPeerJS() {
  if (window.Peer) return Promise.resolve(window.Peer); if (pjLoading) return pjLoading;
  pjLoading = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
    s.onload = () => window.Peer ? res(window.Peer) : rej(new Error('The matchmaking helper failed to load.'));
    s.onerror = () => { pjLoading = null; rej(new Error("Couldn't reach the matchmaking service - are you online?")); }; document.head.appendChild(s);
  }); return pjLoading;
}
// 4.3: more STUN servers so a direct link works on more networks. When a direct link still can't be made
// (different Wi-Fi, phone data, strict school or office routers), both sides fall back to a public relay below.
const NETQ = new URLSearchParams(location.search);
const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }, { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }];
const pjOptions = () => { const o = { debug: 0, config: { iceServers: ICE, sdpSemantics: 'unified-plan' } }; const h = NETQ.get('pjhost'); if (h) { const [host, port] = h.split(':'); Object.assign(o, { host, port: +port || 443, path: '/', secure: location.protocol === 'https:' }); } return o; };
function peerFromConn(conn) {
  const pc = conn.peerConnection, rel = conn.dataChannel; const fast = pc.createDataChannel('u', { negotiated: true, id: 50, ordered: false, maxRetransmits: 0 });
  rel.binaryType = fast.binaryType = 'arraybuffer'; return { pc, rel, fast, conn };
}
// ---------- relay fallback: MQTT over secure WebSockets through public brokers (all tried at once, first one wins) ----------
const RELAYS = NETQ.get('relay') ? [NETQ.get('relay')] : ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
const RTOPIC = 'frntln/cmd-v2/', DIRECT_WAIT = 4000;
let mqLoading = null;
function loadMQTT() {
  if (window.mqtt) return Promise.resolve(window.mqtt); if (mqLoading) return mqLoading;
  mqLoading = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js';
    s.onload = () => window.mqtt ? res(window.mqtt) : rej(new Error('relay')); s.onerror = () => { mqLoading = null; rej(new Error('relay')); }; document.head.appendChild(s);
  }); return mqLoading;
}
function relayOpen(onUp) {
  return loadMQTT().then(mq => RELAYS.forEach(url => {
    let c; try { c = mq.connect(url, { clientId: 'fl' + Math.random().toString(36).slice(2, 12), clean: true, connectTimeout: 8000, reconnectPeriod: 3000, keepalive: 20, protocolVersion: 4 }); } catch (e) { return; }
    NET.mq.push(c); let up = false; c.on('error', () => { }); c.on('connect', () => { if (!up) { up = true; onUp(c); } });
  }), () => { });
}
function relayEnd(keep) { for (const c of NET.mq) if (c !== keep) { try { c.end(); } catch (e) { } } NET.mq = keep ? [keep] : []; }
const rtxt = u => u[0] === 0 || u.length > 24 ? '' : new TextDecoder().decode(u);
// a relay link that looks like a WebRTC peer to the rest of the code (strings = reliable JSON, a 0 byte in front = binary snapshot)
function relayPeer(client, out, gid, own) {
  let lastBin = 0;
  const raw = d => { if (pc.connectionState !== 'connected') return; let p = d; if (typeof d !== 'string') { p = new Uint8Array(d.byteLength + 1); p.set(new Uint8Array(d), 1); } try { client.publish(out, p, { qos: 0 }); } catch (e) { } };
  const rel = { readyState: 'open', bufferedAmount: 0, onmessage: null, onclose: null, send: raw };
  const fast = { readyState: 'open', bufferedAmount: 0, onmessage: null, send: d => { const t = performance.now(); if (d.byteLength > 3000 && t - lastBin < 190) return; lastBin = t; raw(d); } };   // big armies: 5 snapshots a second through the relay
  const pc = { connectionState: 'connected', addEventListener() { }, close() { if (pc.connectionState === 'closed') return; raw('{"t":"bye"}'); pc.connectionState = 'closed'; rel.readyState = fast.readyState = 'closed'; if (own) setTimeout(() => { try { client.end(); } catch (e) { } }, 300); } };
  return { pc, rel, fast, relay: true, gid, client, deliver(u) { if (pc.connectionState !== 'connected') return; if (u[0] === 0) { if (fast.onmessage) fast.onmessage({ data: u.buffer.slice(u.byteOffset + 1, u.byteOffset + u.byteLength) }); } else if (rel.onmessage) rel.onmessage({ data: new TextDecoder().decode(u) }); } };
}
function sendRel(obj) { const p = NET.peer; if (!p) return; try { if (p.rel.readyState === 'open') { const s = JSON.stringify(obj); NET.bytesTx += s.length; p.rel.send(s); } } catch (e) { } }
function sendBin(buf) { const p = NET.peer; if (!p) return; try { NET.bytesTx += buf.byteLength; if (p.fast.readyState === 'open' && p.fast.bufferedAmount < 60000) p.fast.send(buf); else if (p.rel.readyState === 'open' && p.rel.bufferedAmount < 200000) p.rel.send(buf); } catch (e) { } }
function wirePeer(peer, onClose) {
  const handle = d => { NET.lastRx = performance.now(); if (typeof d === 'string') { NET.bytesRx += d.length; let m; try { m = JSON.parse(d); } catch (e) { return; } netMessage(m); } else { NET.bytesRx += d.byteLength; netBinary(d); } };
  peer.rel.onmessage = e => handle(e.data); peer.fast.onmessage = e => handle(e.data); peer.rel.onclose = onClose;
  peer.pc.addEventListener('connectionstatechange', () => { if (peer.pc.connectionState === 'failed' || peer.pc.connectionState === 'closed') onClose(); });
  NET.lastRx = performance.now();
}
function netReset(keepLobby) {
  try { if (NET.peer) { try { NET.peer.rel.onclose = null; } catch (e) { } NET.peer.pc.close(); } } catch (e) { }
  if (NET.pj) { const pj = NET.pj; NET.pj = null; setTimeout(() => { try { pj.destroy(); } catch (e) { } }, 200); }
  const mq = NET.mq; NET.mq = []; setTimeout(() => { for (const c of mq) { try { c.end(); } catch (e) { } } }, 300);
  Object.assign(NET, { role: '', peer: null, via: '', code: '', codeState: '', codeErr: '', joinState: '', joinErr: '', lobby: null, guestName: '', hostName: '', guestReady: false, myReady: false, dirty: false, matchGuest: -1, leaving: false, guestFac: 0, gvn: null, hostGvn: null, guestGv: '', hostGv: '' });
}
// ---------- host ----------
// a guest that reached us (directly or through the relay) becomes THE guest once it says hello on that link
function hostCandidate(peer) {
  const t0 = setTimeout(() => { if (NET.peer !== peer) { try { peer.pc.close(); } catch (e) { } } }, 30000);
  peer.rel.onmessage = e => {
    if (typeof e.data !== 'string') return; let m; try { m = JSON.parse(e.data); } catch (x) { return; } if (m.t !== 'hello' || NET.peer === peer) return; clearTimeout(t0);
    if (NET.peer || NET.role !== 'host') { try { peer.rel.send(JSON.stringify({ t: 'full' })); } catch (x) { } setTimeout(() => { try { peer.pc.close(); } catch (x) { } }, 400); return; }
    NET.peer = peer; NET.via = peer.relay ? 'relay' : 'direct'; wirePeer(peer, () => { if (NET.peer === peer) hostGuestGone(); });
    NET.guestName = 'Friend'; NET.guestReady = false; netMessage(m); if (SCREEN === 'mplobby') refreshLobby();
  };
}
function hostRelayUp(c, code) {
  const base = RTOPIC + code + '/', cands = new Map(); c.subscribe(base + 'h/+', { qos: 0 });
  c.on('message', (topic, u) => {
    if (NET.role !== 'host' || !topic.startsWith(base + 'h/')) return; const gid = topic.slice(base.length + 2); let p = cands.get(gid);
    if (rtxt(u) === '{"t":"rjoin"}') { if (!p || p.pc.connectionState === 'closed') { p = relayPeer(c, base + 'g/' + gid, gid, false); cands.set(gid, p); hostCandidate(p); } p.rel.send('{"t":"rok"}'); return; }
    if (p) p.deliver(u);
  });
}
async function netHostStart(tries) {
  tries = tries || 0; const tok = NET.hostTok = (NET.hostTok || 0) + 1; relayEnd(); if (NET.pj) { try { NET.pj.destroy(); } catch (e) { } NET.pj = null; }
  NET.role = 'host'; NET.codeState = 'loading'; NET.code = ''; SK = SK || defaultSK(); SK.speed = 1; SK.slots[1] = Object.assign(SK.slots[1], { kind: 'remote', team: 1 }); if (SCREEN === 'mplobby') refreshLobby();
  const code = String(100000 + Math.floor(Math.random() * 900000)), live = () => NET.role === 'host' && NET.hostTok === tok;
  const ready = () => { if (!live() || NET.codeState === 'ready') return; NET.code = code; NET.codeState = 'ready'; refreshLobby(); };
  setTimeout(() => { if (live() && NET.codeState === 'loading') { NET.codeState = 'error'; NET.codeErr = "Couldn't reach the matchmaking service. Check your connection."; refreshLobby(); } }, 14000);
  relayOpen(c => { if (!live()) { try { c.end(); } catch (e) { } return; } hostRelayUp(c, code); ready(); });
  try {
    const Peer = await loadPeerJS(); if (!live()) return;
    const pj = new Peer(PJ_PREFIX + code, pjOptions()); NET.pj = pj;
    pj.on('open', () => { if (NET.pj === pj) ready(); });
    pj.on('error', e => { if (NET.pj !== pj) return; if (e.type === 'unavailable-id' && tries < 6 && NET.codeState !== 'ready') { netHostStart(tries + 1); } });
    pj.on('disconnected', () => { if (NET.pj === pj && !pj.destroyed) setTimeout(() => { try { pj.reconnect(); } catch (e) { } }, 1500); });
    pj.on('connection', conn => { conn.on('open', () => { if (conn.label !== 'frontline' || !live()) { conn.close(); return; } hostCandidate(peerFromConn(conn)); }); });
  } catch (e) { }
}
function hostGuestGone() {
  if (NET.role !== 'host' || !NET.peer) return; const old = NET.peer; NET.peer = null; NET.via = ''; try { old.rel.onclose = null; old.pc.close(); } catch (e) { }
  const was = NET.guestName; NET.guestName = ''; NET.guestReady = false;
  if (W && W.o.mp && inGame && !W.over) { const g = W.players.find(p => p.kind === 'remote'); if (g) { eliminate(g, 'Disconnected'); toast('Opponent disconnected'); } }
  else if (SCREEN === 'mplobby') { refreshLobby(); toast((was || 'Friend') + ' left the lobby'); }
}
// ---------- guest ----------
// try a direct link first; if it isn't open after a few seconds, knock on the relay too. Whichever answers first is used.
async function netJoin(raw) {
  const code = String(raw || '').replace(/\D/g, ''); netReset(); NET.joinCode = code; NET.role = 'guest';
  if (code.length !== 6) { NET.joinState = 'error'; NET.joinErr = 'Codes are 6 digits.'; NET.role = ''; if (SCREEN === 'mp') showScreen('mp'); return; }
  NET.joinState = 'connecting'; NET.joinErr = ''; if (SCREEN === 'mp') showScreen('mp');
  const gid = Math.random().toString(36).slice(2, 10), tok = NET.joinTok = (NET.joinTok || 0) + 1, timers = []; let done = false, relayOn = false, notFound = false, pj = null;
  const live = () => !done && NET.role === 'guest' && NET.joinTok === tok;
  const fail = msg => { if (!live()) return; done = true; timers.forEach(clearTimeout); netReset(); NET.joinCode = code; NET.joinState = 'error'; NET.joinErr = msg; if (SCREEN === 'mp') showScreen('mp'); };
  const use = (peer, via) => {
    if (!live()) { try { peer.pc.close(); } catch (e) { } return; } done = true; timers.forEach(clearTimeout);
    NET.peer = peer; NET.via = via; wirePeer(peer, () => guestHostGone()); NET.joinState = 'connected'; NET.myFac = SET.fac | 0; sendRel({ t: 'hello', name: SET.name, ver: VERSION, nv: NETV, fac: NET.myFac }); if (GVL.on()) { NET.hostGvn = GVL.L.newChallenge(); sendRel({ t: 'gvq', n: NET.hostGvn }); }
    relayEnd(peer.relay ? peer.client : null);
    if (pj) { if (peer.relay) { NET.pj = null; setTimeout(() => { try { pj.destroy(); } catch (e) { } }, 200); } else setTimeout(() => { try { pj.disconnect(); } catch (e) { } }, 1500); }
    showScreen('mplobby');
  };
  const tryRelay = () => {
    if (!live() || relayOn) return; relayOn = true;
    relayOpen(c => {
      if (!live()) { try { c.end(); } catch (e) { } return; }
      const base = RTOPIC + code + '/', inbox = base + 'g/' + gid, p = relayPeer(c, base + 'h/' + gid, gid, true); let ok = false;
      c.subscribe(inbox, { qos: 0 });
      c.on('message', (t, u) => { if (t !== inbox) return; if (!ok) { if (rtxt(u) === '{"t":"rok"}') { ok = true; use(p, 'relay'); } return; } p.deliver(u); });
      const knock = () => { if (live() && !ok) { try { c.publish(base + 'h/' + gid, '{"t":"rjoin"}'); } catch (e) { } } else clearInterval(iv); }; const iv = setInterval(knock, 1500); knock();
    });
  };
  timers.push(setTimeout(tryRelay, DIRECT_WAIT + 3000));
  timers.push(setTimeout(() => fail(notFound ? 'No game found with code ' + code + '. Check the number with the host.' : "Couldn't connect to the host. Check the code, make sure the host is still on the lobby screen, then try again."), 22000));
  if (NETQ.has('forcerelay')) { tryRelay(); return; }
  try {
    const Peer = await loadPeerJS(); if (!live()) return; pj = new Peer(pjOptions()); NET.pj = pj;
    pj.on('error', e => { if (e.type === 'peer-unavailable' && !notFound) { notFound = true; timers.push(setTimeout(() => fail('No game found with code ' + code + '. Check the number with the host.'), 9000)); } tryRelay(); });
    pj.on('open', () => {
      if (!live()) return; timers.push(setTimeout(tryRelay, DIRECT_WAIT));
      const conn = pj.connect(PJ_PREFIX + code, { label: 'frontline', serialization: 'raw', reliable: true });
      conn.on('open', () => { if (!live()) { try { conn.close(); } catch (e) { } return; } use(peerFromConn(conn), 'direct'); });
    });
  } catch (e) { tryRelay(); }
}
function guestHostGone(msg) {
  if (NET.role !== 'guest' || NET.leaving) return; const wasGame = inGame && W && W.o.mp && !W.over; netReset(); if (inGame) endGame(); showScreen('notice', { title: wasGame ? 'Connection lost' : 'Host left', msg: msg || (wasGame ? 'The connection to the host dropped, so the match ended.' : 'The host closed the lobby.') });
}
