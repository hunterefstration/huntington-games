// ---------- 5.2 TOURNAMENT MODE (PvP): a single-elimination bracket of 1v1 duels, one at a time, on the Tournament Arena ----------
// The host is the referee. The flow, for 4 to 8 players (byes fill the bracket when the number is not 4 or 8):
//   bracket (everyone in the stands, the bracket on screen) -> ready (the two duelists drop into the pit, 4 second countdown, nobody can shoot)
//   -> duel (first death wins; after 2 minutes the one with more health wins) -> over (who beat whom) -> bracket again ... -> champ.
// Everyone who is not in the duel is a spectator: standing on the terrace, unhurtable, unable to shoot, and counted as "not alive" by everyone else.
const TN = { on: false, ids: [], names: {}, n: 0, rounds: [], phase: '', phaseId: 0, until: 0, a: -1, b: -1, r: 0, m: 0, champ: -1, msg: '', wins: {}, fightAt: 0 };
const TN_BYE = -1, TN_TBD = -2;
const TN_SECS = { bracket: 6, ready: 4, duel: 120, over: 4, champ: 12 };
let _tnHtml = '', _tnEl = null;
{ const st = document.createElement('style'); st.textContent = '.tn-spec #hud-slots, .tn-spec #hud-sec, .tn-spec #hud-ammo-card, .tn-spec #hud-abil, .tn-spec #crosshair { display: none !important; }'; document.head.appendChild(st); }

function tourneyReset() {
    document.body.classList.remove('tn-spec'); TN.on = false; TN.phase = ''; TN.rounds = []; TN.champ = -1; TN.a = TN.b = -1; NET.spec = false; NET.lockT = 0;
    if (_tnEl) { _tnEl.remove(); _tnEl = null; _tnHtml = ''; }
}
const tnName = (id) => { const p = playerById(id); return p ? p.name : (TN.names[id] || '?'); };
const tnIsDuelist = (id) => id === TN.a || id === TN.b;
const tnPresent = (id) => id === NET.id || netPlayers.has(id);
function tourneyInit(cfg) {
    TN.on = true; TN.ids = cfg.players.map(q => q.id); TN.names = {}; for (const q of cfg.players) TN.names[q.id] = q.name;
    TN.n = cfg.players.length; TN.rounds = []; TN.phase = ''; TN.phaseId = 0; TN.champ = -1; TN.a = TN.b = -1; TN.wins = {}; TN.msg = '';
    NET.spec = true; NET.lockT = 0;
}

// ----- the bracket (host) -----
function tourneyBuild(ids) {
    const order = ids.slice().sort(() => Math.random() - 0.5);
    let size = 4; while (size < order.length) size *= 2;
    const byes = size - order.length, first = [];
    const bye = new Set([0, 2, 1, 3].slice(0, byes));       // byes spread over the bracket (matches 0, 2, 1, 3; at most one per match)
    let k = 0;
    for (let m = 0; m < size / 2; m++) {
        if (bye.has(m)) first.push({ a: order[k++], b: TN_BYE, w: TN_TBD });
        else first.push({ a: order[k++], b: order[k++], w: TN_TBD });
    }
    const rounds = [first];
    for (let n = size / 4; n >= 1; n /= 2) rounds.push(Array.from({ length: n }, () => ({ a: TN_TBD, b: TN_TBD, w: TN_TBD })));
    TN.rounds = rounds; tourneyResolveByes();
}
function tourneyWinner(r, m, w) {
    const R = TN.rounds[r]; R[m].w = w;
    const nx = TN.rounds[r + 1]; if (nx) nx[m >> 1][m & 1 ? 'b' : 'a'] = w;
    else TN.champ = w;
}
function tourneyResolveByes() {
    let again = true;
    while (again) {
        again = false;
        TN.rounds.forEach((R, r) => R.forEach((x, m) => {
            if (x.w !== TN_TBD) return;
            if (x.a === TN_BYE && x.b >= 0) { tourneyWinner(r, m, x.b); again = true; }
            else if (x.b === TN_BYE && x.a >= 0) { tourneyWinner(r, m, x.a); again = true; }
        }));
    }
}
function tourneyNextMatch() {
    for (let r = 0; r < TN.rounds.length; r++) for (let m = 0; m < TN.rounds[r].length; m++) { const x = TN.rounds[r][m]; if (x.w === TN_TBD && x.a >= 0 && x.b >= 0) return [r, m]; }
    return null;
}
function tourneySnapshot(rem, ph, id) {
    return { t: 'tb', ph, id, rem, a: TN.a, b: TN.b, r: TN.r, m: TN.m, champ: TN.champ, msg: TN.msg, n: TN.n, rounds: TN.rounds.map(R => R.map(x => [x.a, x.b, x.w])), wins: TN.wins };
}
function tourneySetPhase(ph, secs) {
    const m = tourneySnapshot(secs, ph, TN.phaseId + 1);
    netBroadcast(m); tourneyApply(m);
}
function tourneyHostStart(cfg) {
    tourneyInit(cfg); tourneyBuild(TN.ids);
    const nx = tourneyNextMatch();
    if (nx) { TN.r = nx[0]; TN.m = nx[1]; TN.a = TN.rounds[nx[0]][nx[1]].a; TN.b = TN.rounds[nx[0]][nx[1]].b; }
    TN.msg = 'THE TOURNAMENT BEGINS';
    tourneySetPhase('bracket', TN_SECS.bracket + 2);
}
function tourneyAdvance() {      // after a duel result has been shown: next duel, or the champion
    tourneyResolveByes();
    const nx = tourneyNextMatch();
    if (!nx) {
        if (TN.champ < 0) { const last = TN.rounds[TN.rounds.length - 1][0]; TN.champ = last.w >= 0 ? last.w : NET.id; }
        TN.a = TN.b = -1; TN.msg = tnName(TN.champ) + ' IS THE CHAMPION';
        tourneySetPhase('champ', TN_SECS.champ); return;
    }
    TN.r = nx[0]; TN.m = nx[1]; TN.a = TN.rounds[nx[0]][nx[1]].a; TN.b = TN.rounds[nx[0]][nx[1]].b;
    TN.msg = nx[0] === TN.rounds.length - 1 ? 'THE FINAL' : `ROUND ${nx[0] + 1}`;
    tourneySetPhase('bracket', TN_SECS.bracket);
}
function tourneyDecide(winner, loser, why) {
    if (TN.phase !== 'duel' && TN.phase !== 'ready') return;
    tourneyWinner(TN.r, TN.m, winner);
    TN.wins[winner] = (TN.wins[winner] | 0) + 1;
    const w = playerById(winner); if (w) w.kills = (w.kills | 0) + 1;
    TN.msg = `${tnName(winner)} DEFEATS ${tnName(loser)}${why ? ' (' + why + ')' : ''}`;
    tourneySetPhase('over', TN_SECS.over);
}
function tourneyOnDeath(victim, by) {
    if (!TN.on || TN.phase !== 'duel' || !tnIsDuelist(victim)) return;
    const other = victim === TN.a ? TN.b : TN.a;
    tourneyDecide(other, victim, '');
}
function tourneyOnLeave(id) {
    if (!TN.on || !NET.host) return;
    if ((TN.phase === 'duel' || TN.phase === 'ready') && tnIsDuelist(id)) tourneyDecide(id === TN.a ? TN.b : TN.a, id, 'left');
}
function tourneyHp(id) { if (id === NET.id) return Math.max(0, currentHp); const p = netPlayers.get(id); return p ? p.hp : 0; }
function tourneyHostTick() {
    if (!TN.on || !NET.host || !NET.inGame) return;
    const left = TN.until - performance.now();
    if (TN.phase === 'bracket' && left <= 0) {
        if (!tnPresent(TN.a) || !tnPresent(TN.b)) { TN.phase = 'ready'; if (tnPresent(TN.a) === tnPresent(TN.b)) tourneyDecide(Math.random() < 0.5 ? TN.a : TN.b, -9, 'no show'); else tourneyDecide(tnPresent(TN.a) ? TN.a : TN.b, tnPresent(TN.a) ? TN.b : TN.a, 'no show'); return; }
        TN.msg = ''; tourneySetPhase('ready', TN_SECS.ready);
    } else if (TN.phase === 'ready' && left <= 0) { TN.msg = ''; tourneySetPhase('duel', TN_SECS.duel); }
    else if (TN.phase === 'duel' && left <= 0) {
        const ha = tourneyHp(TN.a), hb = tourneyHp(TN.b);
        const aw = ha === hb ? Math.random() < 0.5 : ha > hb;
        tourneyDecide(aw ? TN.a : TN.b, aw ? TN.b : TN.a, 'time');
    } else if (TN.phase === 'over' && left <= 0) tourneyAdvance();
    else if (TN.phase === 'champ' && left <= 0) {
        const m = { t: 'tend', champ: TN.champ, n: TN.n }; netBroadcast(m); netShowEnd(m);
    }
}

// ----- everyone: react to the host's snapshots -----
function tourneyApply(m) {
    if (!TN.on) return;
    TN.rounds = m.rounds.map(R => R.map(([a, b, w]) => ({ a, b, w }))); TN.a = m.a; TN.b = m.b; TN.r = m.r; TN.m = m.m; TN.champ = m.champ; TN.msg = String(m.msg || '').slice(0, 80); TN.n = m.n; TN.wins = m.wins || {};
    const changed = m.id !== TN.phaseId || m.ph !== TN.phase;
    TN.phase = m.ph; TN.phaseId = m.id; TN.until = performance.now() + (+m.rem || 0) * 1000;
    if (changed) tourneyEnterPhase();
    tourneyUi();
}
function tnSetSpec(id, spec) { if (id === NET.id) NET.spec = spec; else { const p = netPlayers.get(id); if (p) p.spec = spec; } }
function tourneySeatIndex(id) { const i = TN.ids.indexOf(id); return i >= 0 ? i : Math.abs(id | 0) % 8; }
function tourneyGoSeat() {
    const [x, z] = tourneySeat(tourneySeatIndex(NET.id), 8);
    NET.spec = true; NET.lockT = 0; cancelReload(); isMouseDown = false;
    netRespawn([x, z], maxHp, TOURNEY.deckY);
    camera.quaternion.setFromEuler(new THREE.Euler(-0.3, Math.atan2(x, z), 0, 'YXZ'));
    if (vmModel) vmModel.root.visible = false;
}
function tourneyGoPit() {
    const team = NET.id === TN.a ? 0 : 1, sp = TOURNEY.spawns[team];
    NET.spec = false; NET.team = team; NET.lastBy = -1;
    playerStats.currentWeapon = 'ar'; resetAmmo(); secondaryCooldown = 0; cancelReload(); isMouseDown = false;
    netRespawn(sp, maxHp, 0);
    camera.quaternion.setFromEuler(new THREE.Euler(0, team ? 0 : Math.PI, 0, 'YXZ'));
    if (vmModel) vmModel.root.visible = true;
    updateHUD();
}
function tourneyEnterPhase() {
    const ph = TN.phase;
    if (ph === 'bracket') {
        for (const id of [NET.id, ...netPlayers.keys()]) tnSetSpec(id, true);
        tourneyGoSeat();
    } else if (ph === 'ready') {
        for (const id of [NET.id, ...netPlayers.keys()]) { tnSetSpec(id, !tnIsDuelist(id)); const p = playerById(id); if (p && tnIsDuelist(id)) p.team = id === TN.a ? 0 : 1; }
        NET.lockT = Math.max(0, (TN.until - performance.now()) / 1000);
        if (tnIsDuelist(NET.id)) tourneyGoPit();
        sfx('wave');
    } else if (ph === 'duel') {
        NET.lockT = 0; TN.fightAt = performance.now(); toast('FIGHT!', '#fca5a5', 1.2); sfx('boom');
    } else if (ph === 'over') {
        sfx('headkill');
    } else if (ph === 'champ') {
        const name = tnName(TN.champ);
        CROWNED.add(name);
        for (const p of netPlayers.values()) if (p.av) rebuildAvatar(p);
        if (TN.champ === NET.id) {
            life.tourneyWins = tourneyWins() + 1; saveJSON('blocky21_life', life); updateMyLook();
            try { const G = hgG(); if (G && G.eco && typeof G.eco.claim === 'function') G.eco.claim('tourney', null, TN.n); } catch (e) {}
            toast('YOU ARE THE TOURNAMENT CHAMPION!', '#fde047', 3);
        }
        sfx('level');
    }
}

// ----- screens: a header, a countdown / result banner, and the bracket -----
function tourneyBracketHtml() {
    const R = TN.rounds, cur = (r, m) => TN.phase !== 'champ' && r === TN.r && m === TN.m && TN.a >= 0;
    const nm = (id, w) => id === TN_BYE ? '<span style="color:#6b7280">BYE</span>' : id === TN_TBD ? '<span style="color:#6b7280">?</span>' : `<span style="color:${w === id ? '#fde047' : (w >= 0 ? '#6b7280' : '#e5e7eb')};font-weight:${w === id ? 900 : 700}">${CROWNED.has(tnName(id)) ? '&#9819; ' : ''}${escHtml(tnName(id))}</span>`;
    const title = (r) => r === R.length - 1 ? 'FINAL' : r === R.length - 2 ? 'SEMIFINALS' : 'ROUND ' + (r + 1);
    return `<div style="display:flex;gap:18px;justify-content:center;align-items:stretch">${R.map((rd, r) => `<div style="display:flex;flex-direction:column;justify-content:space-around;gap:8px;min-width:118px"><div style="font-size:11px;letter-spacing:2px;color:#9ca3af;font-weight:900;text-align:center">${title(r)}</div>${rd.map((x, m) =>
        `<div style="background:rgba(17,24,39,0.85);border:2px solid ${cur(r, m) ? '#f87171' : 'rgba(255,255,255,0.18)'};border-radius:8px;padding:5px 9px;font-size:14px;line-height:1.5">${nm(x.a, x.w)}<br>${nm(x.b, x.w)}</div>`).join('')}</div>`).join('')}</div>`;
}
function tourneyUi() {
    if (!TN.on || !NET.inGame) { if (_tnEl) { _tnEl.remove(); _tnEl = null; _tnHtml = ''; } return; }
    if (!_tnEl) { _tnEl = document.createElement('div'); _tnEl.id = 'tourney-ui'; _tnEl.style.cssText = 'position:fixed;inset:0;z-index:37;pointer-events:none;font-family:inherit;color:#fff;text-shadow:0 2px 6px #000'; document.body.appendChild(_tnEl); }
    const left = Math.max(0, TN.until - performance.now()) / 1000, ph = TN.phase, big = 'font-size:64px;font-weight:900;text-align:center;line-height:1';
    const lastR = Math.max(0, TN.rounds.length - 1);
    let head = '';
    if (TN.a >= 0 && ph !== 'champ') head = `<span style="color:#fca5a5">${escHtml(tnName(TN.a))}</span> <span style="color:#9ca3af">vs</span> <span style="color:#93c5fd">${escHtml(tnName(TN.b))}</span>`;
    const mm = Math.floor(left / 60), ss = String(Math.floor(left % 60)).padStart(2, '0');
    let h = `<div style="position:absolute;top:10px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.55);border-radius:10px;padding:6px 16px;text-align:center"><div style="font-size:11px;letter-spacing:3px;color:#fbbf24;font-weight:900">TOURNAMENT${TN.r === lastR && ph !== 'champ' ? ' - THE FINAL' : ' - ROUND ' + (TN.r + 1)}${NET.spec && ph !== 'champ' ? ' - SPECTATING' : ''}</div><div style="font-size:20px;font-weight:900">${head}${ph === 'duel' ? ` <span style="color:#e5e7eb;font-size:15px">${mm}:${ss}</span>` : ''}</div></div>`;
    if (ph === 'ready') h += `<div style="position:absolute;top:30%;left:0;right:0"><div style="${big}">${Math.max(1, Math.ceil(left))}</div><div style="text-align:center;font-size:22px;font-weight:900;margin-top:8px">${tnIsDuelist(NET.id) ? 'GET READY' : 'THE DUEL STARTS'}</div></div>`;
    else if (ph === 'duel' && TN.fightAt && performance.now() - TN.fightAt < 1300) h += `<div style="position:absolute;top:30%;left:0;right:0"><div style="${big};color:#fca5a5">FIGHT!</div></div>`;
    else if (ph === 'over') h += `<div style="position:absolute;top:34%;left:0;right:0;text-align:center;font-size:32px;font-weight:900;color:#fde047">${escHtml(TN.msg)}</div>`;
    else if (ph === 'bracket' || ph === 'champ') {
        const champ = ph === 'champ';
        h += `<div style="position:absolute;top:70px;left:0;right:0;text-align:center"><div style="font-size:${champ ? 44 : 30}px;font-weight:900;color:#fde047">${champ ? '&#9819; ' : ''}${escHtml(TN.msg)}</div>${champ ? '' : `<div style="font-size:15px;color:#e5e7eb;font-weight:800;margin-top:4px">next duel in ${Math.ceil(left)}</div>`}</div>
            <div style="position:absolute;top:50%;left:0;right:0;transform:translateY(-35%);padding:0 12px;overflow:hidden">${tourneyBracketHtml()}</div>`;
    }
    if (h !== _tnHtml) { _tnHtml = h; _tnEl.innerHTML = h; }
}
function tourneyBoardHtml() {
    return `<div class="text-2xl font-black mb-3">TOURNAMENT <span class="text-sm text-gray-400">${TN.n} players</span></div>${tourneyBracketHtml()}
        <table class="w-full text-sm font-bold mt-4"><tr class="text-xs text-gray-400 tracking-widest"><td class="pr-6">PLAYER</td><td class="pr-6">DUELS WON</td><td>PING</td></tr>${allPlayers().map(p => `<tr><td class="py-1 pr-6 font-black" style="color:${hex(p.color)}">${tagHtml(p)}${escHtml(p.name)}</td><td class="pr-6">${TN.wins[p.id] | 0}</td><td class="text-gray-400">${p.id === NET.id ? '-' : Math.round(p.rtt)}</td></tr>`).join('')}</table>`;
}
// per frame, from netTick
function tourneyTick(dt) {
    if (!TN.on) return;
    if (NET.lockT > 0) NET.lockT -= dt;
    if (NET.spec && vmModel) vmModel.root.visible = false;
    document.body.classList.toggle('tn-spec', !!NET.spec);
    if (NET.host) tourneyHostTick();
    tourneyUi();
}

// test hooks (5.2): skins / avatars / gamer tags / tournament
Object.assign(window.__blocky, {
    gear: {
        mine: () => LOOK_MINE, update: () => updateMyLook(), read: () => readMyLook(), clean: (l) => cleanLook(l), crowned: () => [...CROWNED], setStanding: (s) => { LOOK.stand = s; updateMyLook(); },
        of: (id) => { const p = playerById(id); return p ? { look: lookOf(p), weapon: p.av ? p.av.w : null, meshes: p.av ? p.av.g.children.length : 0, tagH: p.av ? p.av.tag.scale.y : 0, wpMesh: p.av ? p.av.gun.geometry.uuid : '', skinMat: p.av ? p.av.legL.children[0].material.map.uuid : '' } : null; },
        px: (sk, col, x, y) => { const m = lookMat(sk, col); return [...m.map.image.getContext('2d').getImageData(x, y, 1, 1).data].slice(0, 3); },
        armTex: () => !!(VM.sleeve && VM.sleeve.map), armColor: () => VM.sleeve ? VM.sleeve.color.getHex() : -1,
        drawCalls: (id) => { const p = playerById(id); let n = 0; if (p && p.av) p.av.g.traverse(o => { if (o.isMesh || o.isSprite) n++; }); return n; }
    },
    tourney: {
        TN, secs: TN_SECS, state: () => ({ on: TN.on, phase: TN.phase, a: TN.a, b: TN.b, r: TN.r, m: TN.m, champ: TN.champ, spec: NET.spec, lock: NET.lockT, n: TN.n, rounds: TN.rounds.map(R => R.map(x => [x.a, x.b, x.w])) }),
        win: (id) => { if (!NET.host || TN.phase !== 'duel') return false; tourneyDecide(id, id === TN.a ? TN.b : TN.a, 'test'); return true; },
        build: (ids) => { tourneyBuild(ids); const r = TN.rounds.map(R => R.map(x => [x.a, x.b, x.w])); TN.rounds = []; return r; },
        seat: (i, n) => tourneySeat(i, n || 8)
    },
    flash: { screenFlash: (c, h) => screenFlash(c, h), opacity: () => +ui.flash.style.opacity, bg: () => ui.flash.style.background, fxVisible: (x, y, z) => fxVisible(new V3(x, y, z)), lightning: () => ({ t: lightningT, f: lightningFlash, hemi: hemi.intensity }), allowFx: (m) => netFxAllowed(m), ex: () => explosions.map(e => [+e.ball.material.opacity.toFixed(3), +e.core.material.opacity.toFixed(3), e.radius]), boomLights: () => boomLights.map(b => Math.round(b.light.intensity)), cam: () => [camera.position.x, camera.position.y, camera.position.z] }
});
