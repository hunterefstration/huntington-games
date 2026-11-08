// ---------- 5.3 BOTS: computer players for every PvP mode (host only) ----------
// A bot is an ordinary player record with no connection. The host runs it like the zombies: it walks the nav grid,
// looks for enemies it can actually see, and shoots with a skill-based chance to hit. Its position goes out in the normal
// player snapshot, its shots in the shot list and its hits through hostApplyPvpHits, so guests see and fight a bot exactly
// like a person and need no bot code at all.
const BOT_NAMES = ['Blocko', 'Cubert', 'Pixel', 'Brick', 'Voxel', 'Chunk', 'Tetra', 'Boxy', 'Nugget', 'Dice', 'Cobble', 'Slab', 'Pebble', 'Crate'];
const BOT_SKILL = { easy: { acc: 0.32, react: 0.8, dmg: 0.5, speed: 0.82 }, normal: { acc: 0.5, react: 0.5, dmg: 0.72, speed: 0.92 }, hard: { acc: 0.7, react: 0.28, dmg: 0.92, speed: 1 } };
const BOT_GUNS = ['ar', 'smg', 'shotgun', 'burst', 'lmg', 'dmr', 'carbine', 'ar'];
const botSkill = () => BOT_SKILL[settings.mpBotSkill] ? settings.mpBotSkill : 'normal';
const isBot = (p) => !!(p && p.bot && typeof p.bot === 'object');
function botCap() { const m = NET.lobby.mode; return m === 'tourney' ? 8 : lobbyTeams(m) ? Math.min(10, MP_MODES[m].team * 2) : 10; }
function botAdd() {
    if (!NET.host || NET.inGame || allPlayers().length >= botCap()) return false;
    const used = new Set(allPlayers().map(p => p.name));
    const nm = BOT_NAMES.find(n => !used.has('BOT ' + n)) || ('Bot' + (NET.botSeq | 0));
    NET.botSeq = Math.max(100, NET.botSeq | 0);
    const id = NET.botSeq++;
    const p = makePlayer(id, 'BOT ' + nm, 0, COOP_COLORS[(id * 3 + 1) % COOP_COLORS.length]);
    p.bot = { skill: botSkill(), gun: BOT_GUNS[id % BOT_GUNS.length] };
    netPlayers.set(id, p);
    autoTeam(p);
    return true;
}
function botFill() { let n = 0; const want = NET.lobby.mode === 'tourney' ? 8 : lobbyTeams(NET.lobby.mode) ? botCap() : 6; while (allPlayers().length < want && botAdd() && n++ < 10); }
function botMakeRoom() { for (const p of netPlayers.values()) if (isBot(p)) { netRemovePlayer(p.id, 'made room'); return true; } return false; }
function botsClear() { NET.botSeq = 100; }
function teamsShuffle() {       // 5.3 balanced teams: shuffle, then deal out alternately (so 3 bots don't all land on one side)
    const all = allPlayers().slice().sort(() => Math.random() - 0.5);
    all.forEach((p, i) => { p.team = i & 1; });
}

// ----- match lifecycle -----
function botsMatchStart() {
    for (const p of netPlayers.values()) {
        if (!isBot(p)) continue;
        const b = p.bot;
        Object.assign(b, { x: 0, z: 0, feet: -100, vy: 0, yaw: 0, pitch: 0, hp: 100, path: null, pathT: 0, goal: null, tgt: -1, seeT: 0, aimT: 0, fireCd: 0, fireT: 0, ammo: 0, reloadT: 0,
                           thinkT: Math.random() * 0.3, strafe: Math.random() < 0.5 ? 1 : -1, strafeT: 0, stuckT: 0, lx: 0, lz: 0, respawnT: 0, onGround: true, wander: null });
        p.alive = false; p.spec = NET.mode === 'tourney';
        if (NET.mode !== 'tourney') botRespawn(p);
        else botPark(p);
    }
}
function botPark(p) {        // tournament spectator: invisible, out of the way, not alive
    const b = p.bot, [x, z, y] = tourneySeat(tourneySeatIndex(p.id), 8);
    b.x = x; b.z = z; b.feet = y || 0; b.vy = 0; p.alive = false; b.path = null;
    botWrite(p, performance.now());
}
function botRespawn(p, at) {
    const b = p.bot, now = performance.now();
    const s = at || pickSpawn(p.team, p.id);
    b.x = s[0]; b.z = s[1]; b.feet = groundAt(s[0], s[1], 0.3, (s[2] || 0) + 0.5); b.vy = 0; b.onGround = true;
    b.hp = modeMaxHp(p.team); p.hp = b.hp; p.alive = true; p.spec = false;
    b.w = modeBotWeapon(p); const W0 = weaponsDb[b.w] || weaponsDb.ar; b.ammo = W0.magSize; b.reloadT = 0; b.fireCd = 0.4;
    b.path = null; b.pathT = 0; b.tgt = -1; b.aimT = 0; b.yaw = Math.atan2(b.x, b.z); b.pitch = 0; b.stuckT = 0; b.lx = b.x; b.lz = b.z;
    p.protUntil = now + SPAWN_PROT_MS;
    p.buf.clear(); botWrite(p, now);
}
function botDamaged(p, d, by, si) {
    if (!isBot(p) || !p.alive) return;
    const b = p.bot;
    b.hp -= d; p.hp = Math.max(0, Math.ceil(b.hp));
    if (b.tgt < 0 && by !== p.id) { b.tgt = by; b.aimT = BOT_SKILL[b.skill].react * 0.8; }     // turn on whoever shot it
    if (b.hp <= 0) {
        p.alive = false; p.hp = 0; b.respawnT = modeRespawnDelay(p.team);
        botWrite(p, performance.now());
        hostOnDeath(p.id, by, si);
    }
}

// ----- path finding: a plain breadth-first search over the same nav grid the zombies use -----
let _bfsPrev = null, _bfsMark = null, _bfsQ = null, _bfsStamp = 0;
function botPath(x, z, feet, gx, gz, gy) {
    if (!nav || !nav.Y.length) return null;
    const n0 = navNear(x, z, feet + 0.3), n1 = navNear(gx, gz, (gy || 0) + 0.3);
    if (n0 < 0 || n1 < 0) return null;
    const L = nav.Y.length;
    if (!_bfsPrev || _bfsPrev.length !== L) { _bfsPrev = new Int32Array(L); _bfsMark = new Uint32Array(L); _bfsQ = new Int32Array(L); _bfsStamp = 0; }
    const st = ++_bfsStamp, { N, start, cell } = nav;
    let h = 0, t = 0, found = n0 === n1;
    _bfsQ[t++] = n0; _bfsMark[n0] = st; _bfsPrev[n0] = -1;
    while (h < t && !found) {
        const n = _bfsQ[h++], c = cell[n], ci = c % N, cj = (c - ci) / N;
        for (let k = 0; k < 4 && !found; k++) {
            const ni = ci + DX4[k], nj = cj + DZ4[k];
            if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
            const cn = nj * N + ni;
            for (let m = start[cn]; m < start[cn + 1]; m++) {
                if (_bfsMark[m] === st || !navEdge(n, k, m)) continue;
                _bfsMark[m] = st; _bfsPrev[m] = n; _bfsQ[t++] = m;
                if (m === n1) { found = true; break; }
            }
        }
    }
    if (!found) return null;
    const path = [];
    for (let n = n1; n !== -1 && n !== n0 && path.length < 400; n = _bfsPrev[n]) path.push(n);
    return path.reverse();
}
const nodeX = (n) => -nav.A + nav.cell[n] % nav.N + 0.5, nodeZ = (n) => { const c = nav.cell[n]; return -nav.A + (c - c % nav.N) / nav.N + 0.5; };

// ----- per frame -----
function botsTick(dt) {
    const now = performance.now();
    for (const p of netPlayers.values()) if (isBot(p) && p.bot.feet !== undefined) botThink(p, dt, now);
}
function botEnemyOk(p, q) {
    if (!q || q === p || !q.alive || q.spec || q.team === p.team) return false;
    if (NET.mode === 'tourney' && !(tnIsDuelist(q.id) && tnIsDuelist(p.id))) return false;
    return true;
}
function botThink(p, dt, now) {
    const b = p.bot, S = BOT_SKILL[b.skill] || BOT_SKILL.normal;
    if (b.fireT > 0) b.fireT -= dt;
    if (!p.alive) {
        if (NET.mode !== 'tourney' && modeCanRespawn(p) && (b.respawnT -= dt) <= 0) botRespawn(p);
        botWrite(p, now); return;
    }
    if (NET.mode === 'tourney' && (p.spec || TN.phase !== 'duel')) { botWrite(p, now); return; }       // frozen in the pit until FIGHT
    if (MD.on && MD.phase !== 'live') { botWrite(p, now); return; }
    const w = weaponsDb[b.w] || weaponsDb.ar, melee = !!w.melee;
    const eye = b.feet + 1.55;
    // --- look around (5x a second): the closest enemy it can see
    if ((b.thinkT -= dt) <= 0) {
        b.thinkT = 0.2 + Math.random() * 0.1;
        let best = null, bd = 1e9, near = null, nd = 1e9;
        for (const q of allPlayers()) {
            if (!botEnemyOk(p, q)) continue;
            const P = netPosOf(q); if (!P) continue;
            const d = Math.hypot(P.x - b.x, P.z - b.z, (P.y - b.feet) * 0.5);
            if (d < nd) { nd = d; near = q; }
            if (d > 70 || d >= bd) continue;
            if (losClear(b.x, eye, b.z, P.x, P.y + 1.2, P.z)) { bd = d; best = q; }
        }
        const was = b.tgt;
        b.tgt = best ? best.id : (b.tgt >= 0 && now - b.seeT < 1500 ? b.tgt : -1);
        if (best) b.seeT = now;
        if (best && best.id !== was) b.aimT = S.react * (0.7 + Math.random() * 0.6);
        b.hunt = near ? near.id : -1;
    }
    const T = b.tgt >= 0 ? playerById(b.tgt) : null, TP = T && botEnemyOk(p, T) ? netPosOf(T) : null;
    const seen = !!(TP && now - b.seeT < 260);
    // --- where to go
    let goal = modeBotGoal(p);
    let dist = TP ? Math.hypot(TP.x - b.x, TP.z - b.z) : 1e9;
    let fight = false;
    if (!goal) {
        if (TP && (melee || dist > Math.min(22, (w.range || 60) * 0.6) || !seen)) goal = TP;
        else if (TP) fight = true;                     // in range: strafe and shoot
        else { const H = b.hunt >= 0 ? netPosOf(playerById(b.hunt)) : null; goal = H || b.wander; }
        if (!goal || (goal === b.wander && Math.hypot(goal.x - b.x, goal.z - b.z) < 2)) { const s = pickSpawn(1 - (p.team & 1), -1); goal = b.wander = { x: s[0], y: s[2] || 0, z: s[1] }; }
    }
    let mx = 0, mz = 0;
    if (goal && !fight) {
        if (!b.path || (b.pathT -= dt) <= 0 || !b.goal || Math.hypot(goal.x - b.goal.x, goal.z - b.goal.z) > 3) {
            b.path = botPath(b.x, b.z, b.feet, goal.x, goal.z, goal.y); b.pathT = 0.9 + Math.random() * 0.4; b.goal = { x: goal.x, z: goal.z };
        }
        const path = b.path;
        if (path && path.length) {
            // skip waypoints we can walk straight to (smoother, less zig-zag)
            const n0 = navNear(b.x, b.z, b.feet + 0.3);
            for (let k = 0; k < 3 && path.length > 1 && n0 >= 0; k++) {
                if (Math.abs(nav.Y[path[1]] - nav.Y[n0]) > 0.3 || !navLine(n0, b.x, b.z, nodeX(path[1]), nodeZ(path[1]), 10)) break;
                path.shift();
            }
            const wx = nodeX(path[0]) - b.x, wz = nodeZ(path[0]) - b.z, wd = Math.hypot(wx, wz);
            if (wd < 0.45 && Math.abs(nav.Y[path[0]] - b.feet) < 0.7) path.shift();
            if (wd > 1e-3) { mx = wx / wd; mz = wz / wd; }
            if (b.onGround && nav.Y[path[0]] > b.feet + 0.45 && wd < 1.9) { b.vy = JUMP_V; b.onGround = false; }
        } else { const gx = goal.x - b.x, gz = goal.z - b.z, gd = Math.hypot(gx, gz); if (gd > 0.5) { mx = gx / gd; mz = gz / gd; } }
    }
    if (TP && seen && !melee) {
        // side-step while shooting (a sitting duck is no fun), switching direction now and then
        if ((b.strafeT -= dt) <= 0) { b.strafeT = 0.6 + Math.random() * 1.2; b.strafe = Math.random() < 0.15 ? 0 : (Math.random() < 0.5 ? 1 : -1); }
        const tx = TP.x - b.x, tz = TP.z - b.z, td = Math.hypot(tx, tz) || 1;
        const k = fight ? 1 : 0.45, back = fight && td < 6 ? -0.6 : 0;
        mx += (-tz / td * b.strafe + tx / td * back) * k; mz += (tx / td * b.strafe + tz / td * back) * k;
    }
    const ml = Math.hypot(mx, mz);
    if (ml > 1e-3) {
        const sp = (melee ? 6.6 : 5.3) * S.speed * (w.moveMult || 1) * (b.onGround ? 1 : 0.85) / ml;
        let nx = b.x + mx * sp * dt, nz = b.z + mz * sp * dt;
        // don't stroll off a cloud (Sky Islands)
        if (VOID && !skyOK(nx, nz, b.feet)) { nx = b.x; nz = b.z; b.strafe = -b.strafe; b.pathT = 0; }
        const pos = { x: nx, z: nz };
        pushOut(pos, 0.4, b.feet, b.feet + 1.75);
        b.x = clamp(pos.x, -ARENA + 1, ARENA - 1); b.z = clamp(pos.z, -ARENA + 1, ARENA - 1);
    }
    // stuck against something: hop, and find a new way
    if ((b.stuckT += dt) > 1.2) {
        if (ml > 1e-3 && Math.hypot(b.x - b.lx, b.z - b.lz) < 0.5) { if (b.onGround) { b.vy = JUMP_V; b.onGround = false; } b.path = null; b.wander = null; b.strafe = -b.strafe; }
        b.stuckT = 0; b.lx = b.x; b.lz = b.z;
    }
    // gravity / landing
    b.vy -= GRAVITY * dt;
    let nf = b.feet + b.vy * dt;
    if (b.vy > 0) { const c = ceilingAt(b.x, b.z, 0.25, b.feet + 1.75); if (nf + 1.75 > c) { nf = c - 1.75; b.vy = 0; } }
    const g = groundAt(b.x, b.z, 0.2, b.feet);
    if (nf <= g) { nf = g; b.vy = 0; b.onGround = true; } else b.onGround = false;
    b.feet = nf;
    if (b.feet < (VOID ? FALL_DEATH_Y : -5)) { botDamaged(p, 9999, p.id, srcIdx('explosive')); return; }
    // --- aim and shoot
    if (TP) {
        const ty = TP.y + 1.25 - (b.feet + 1.55), td = Math.hypot(TP.x - b.x, TP.z - b.z);
        b.yaw = turnTo(b.yaw, Math.atan2(-(TP.x - b.x), -(TP.z - b.z)), dt * 9);
        b.pitch = Math.atan2(ty, td);
    } else if (ml > 1e-3) { b.yaw = turnTo(b.yaw, Math.atan2(-mx, -mz), dt * 7); b.pitch *= 0.9; }
    if (b.reloadT > 0) { if ((b.reloadT -= dt) <= 0) b.ammo = w.magSize; }
    if (b.fireCd > 0) b.fireCd -= dt;
    if (b.aimT > 0) b.aimT -= dt;
    if (TP && seen && b.aimT <= 0 && b.fireCd <= 0 && b.reloadT <= 0 && dist < (melee ? 2.7 : Math.min(w.range || 60, 80))) botFire(p, T, TP, dist, w, S);
    botWrite(p, now);
}
function turnTo(a, b, k) { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * Math.min(1, k); }
const _bA = new V3(), _bB = new V3();
function botFire(p, T, TP, dist, w, S) {
    const b = p.bot;
    b.fireCd = Math.max(w.fireRate || 200, w.melee ? 450 : 130) / 1000 * (b.skill === 'easy' ? 1.6 : b.skill === 'normal' ? 1.25 : 1.05) * (0.85 + Math.random() * 0.3);
    if (!w.melee && --b.ammo <= 0) b.reloadT = Math.min(3, (w.reloadTime || 1500) / 1000 + (w.shellTime ? w.magSize * w.shellTime / 2000 : 0));
    b.fireT = 0.1;
    const range = w.range || 60;
    let chance = w.melee ? 0.8 : clamp(S.acc * (1.15 - dist / Math.min(range, 90)) + 0.12, 0.06, 0.9);
    if (w.pellets > 1) chance = clamp(chance + 0.2, 0, 0.95);
    const hit = Math.random() < chance, head = hit && !w.melee && Math.random() < 0.12 + S.acc * 0.1;
    _bA.set(b.x - Math.sin(b.yaw) * 0.4, b.feet + 1.45, b.z - Math.cos(b.yaw) * 0.4);
    if (!w.melee) {
        const miss = hit ? 0 : 0.8 + Math.random() * 1.2, a = Math.random() * 6.28;
        _bB.set(TP.x + Math.cos(a) * miss, TP.y + (head ? 1.75 : 1.1) + (hit ? 0 : (Math.random() - 0.3) * miss), TP.z + Math.sin(a) * miss);
        if (!hit) { _dir.copy(_bB).sub(_bA).normalize(); const e = raySolids(_bA, _dir, 90); _bB.copy(e ? e.point : _bA.clone().addScaledVector(_dir, 80)); }
        const seg = [r2(_bA.x), r2(_bA.y), r2(_bA.z), r2(_bB.x), r2(_bB.y), r2(_bB.z)];
        NET.shotOut.push([p.id, ...seg]); netShowShot(p, seg);
    } else p.fireT = 0.12;
    if (!hit) return;
    let dmg = w.melee ? w.damage : w.damage * (w.pellets > 1 ? w.pellets * clamp(1 - dist / range, 0.15, 0.75) : 1);
    dmg = Math.min(dmg, w.melee ? 80 : 95) * S.dmg * (head ? Math.min(2, w.hsMult || 1.5) : 1);
    hostApplyPvpHits(p, [[T.id, r2(dmg), head ? 1 : 0, 0, srcIdx(w.melee ? 'melee' : b.w)]]);
}
function botWrite(p, now) {
    const b = p.bot;
    p.last = [r2(b.x), r2(b.feet + EYE_STAND), r2(b.z), r2(b.feet), r3(b.yaw), r3(b.pitch)];
    p.buf.push(now, p.last.slice());
    p.f = (p.alive && !p.spec ? 1 : 0) | (b.fireT > 0 ? 4 : 0) | (b.reloadT > 0 ? 16 : 0) | (p.protUntil > now ? 64 : 0);
    p.w = Math.max(0, WEAPON_ORDER.indexOf(b.w || 'ar')); p.hp = Math.max(0, Math.ceil(b.hp)); p.seenT = now;
    p.tgt.pos.set(b.x, b.feet + EYE_STAND, b.z); p.tgt.feet = b.feet; p.tgt.alive = false;
}
