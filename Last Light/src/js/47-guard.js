// ==========================================
// GUARDIANS: a mini boss at the end of every world, each a creature of its world that the dark got into.
// The arena door slams shut behind you; beat it and it turns back into light, the door opens and the gate appears.
//   Mossback (Glowwood)       a huge mossy beetle: hops at you, and its back is always fair game. Stomps shake slimes loose.
//   Shardwing (Hollow Caves)  a crystal bat: hovers dropping shards, skims across the floor, then dives and gets stuck.
//   The Bellkeeper (Sky)      a stone bell: fires rings of light, then tolls - crashes down, sends waves, sticks a moment.
//   Cinderjaw (Ember Forge)   a magma beast: spits lava, then charges; hitting the wall knocks it silly.
// A "!" means it is open: stomp it or dash into it.
// ==========================================
const GUARDS = {
    moss: { name: 'Mossback', sub: 'Guardian of the Glowwood', hp: 6, r: 46, col: '#8fe07a', light: '170,255,150',
        free: 'Thank you, little light. He took our lanterns too.' },
    shard: { name: 'Shardwing', sub: 'Guardian of the Hollow Caves', hp: 5, r: 34, col: '#8ff0ff', light: '140,240,255',
        free: 'The Deep Bell can ring again. Go on, little one.' },
    bell: { name: 'The Bellkeeper', sub: 'Guardian of the Sky Ruins', hp: 5, r: 42, col: '#ffe08a', light: '255,230,150',
        free: 'The hour is late. He is waiting at the Forge.' },
    cinder: { name: 'Cinderjaw', sub: 'Guardian of the Ember Forge', hp: 5, r: 44, col: '#ff8a3a', light: '255,140,60',
        free: 'You carry her light. He will know it.' }
};
function makeGuard(G, e) {
    const L = G.L, kind = L.def.guard || 'moss', D = GUARDS[kind], floor = findFloor(L, e.x), fty = Math.round(floor / TS);
    const doorTx = Math.floor(e.x / TS) - 19, ty0 = Math.max(0, fty - 11);       // the arena starts one column past the door
    return { kind, D, ent: e, x: e.x, y: floor - D.r, floor, top: Math.max(TS, floor - TS * 10), x0: (doorTx + 1) * TS, x1: L.w * TS,
        doorTx, doorTy: ty0, doorH: fty - ty0, hp: D.hp, max: D.hp, state: 'wait', t: 0, hitT: 0, open: false, vx: 0, vy: 0,
        face: -1, phase: 0, n: 0, fx: [], wob: rand(9), land: 0, glow: 0 };
}
function guardWake(G, B) {
    const L = G.L;
    L.doors.push({ tx: B.doorTx, ty: B.doorTy, x: B.doorTx * TS, y: B.doorTy * TS, h: B.doorH, open: false, slide: 1, boss: true });
    B.state = 'intro'; B.t = 1.1; G.shake(10); Sound.play('door'); Sound.play('boss');
    UI.banner(B.D.sub, B.D.name); UI.bossbar(B); Sound.musicFor(10 + G.world);
}
// back to the start of the fight (you fell): the door opens again and the guardian goes back to sleep
function guardReset(G) {
    const B = G.guard; if (!B || B.state === 'free' || B.state === 'gone') return;
    G.guard = makeGuard(G, B.ent);
    G.L.doors = G.L.doors.filter(d => !d.boss); G.L.ents = G.L.ents.filter(e => !e.spawned); G.shots = [];
    UI.bossbar(null); Sound.musicFor(G.world);
}
function guardHit(G, B) {
    const p = G.p;
    B.hp--; B.hitT = 0.8; B.open = false; G.shake(10); G.hitstop = 0.09; Sound.play('stomp'); Sound.play('hurtBoss');
    burst(G, B.x, B.y - 10, '#fff2c4', 26, 280, true); burst(G, B.x, B.y, B.D.col, 18, 240); ring(G, B.x, B.y + B.D.r * 0.6, B.D.col);
    p.vy = -PH.stomp * 1.15; p.vx = sign(p.x - B.x || 1) * 240; p.air = SAVE.d.abilities.double ? 1 : 0; p.canDash = true; p.cut = false; p.sx = 1.3; p.sy = 0.75;
    UI.bossbar(B);
    if (B.hp <= 0) { B.state = 'dying'; B.t = 1.8; B.fx = []; B.say = null; Sound.play('boss'); return; }
    B.phase = B.max - B.hp; B.n = 0;
    const mid = GUARD_TALK[B.kind].mid; B.say = { text: mid[(B.phase - 1) % mid.length], t: 2.6 };
    const alive = G.L.ents.filter(e => e.spawned && !e.gone).length;
    if (B.kind === 'shard' && B.phase >= 3 && alive < 3) for (let i = 0; i < 2; i++) G.L.ents.push({ kind: 'bat', x: B.x, y: B.top + 60, sx: B.x0 + 120 + i * (B.x1 - B.x0 - 240), sy: B.top + 70 + i * 30, seed: rand(9), spawned: true });
    if (B.kind === 'moss' && alive < 4) {          // slimes shake loose from its back
        for (let i = 0; i < (B.phase >= 3 ? 2 : 1); i++) G.L.ents.push({ kind: 'slime', x: B.x + (i ? 40 : -40), y: B.floor - TS / 2, sx: B.x, sy: B.floor - TS / 2, seed: rand(9), dir: i ? 1 : -1, spawned: true });
    }
    if (B.kind === 'moss') { B.state = 'idle'; B.t = 0.6; B.vx = B.vy = 0; B.y = B.floor - B.D.r; }
    else if (B.kind === 'shard') { B.state = 'rise'; B.t = 0.9; }
    else if (B.kind === 'bell') { B.state = 'lift'; B.t = 0.8; }
    else { B.state = 'stalk'; B.t = 1.2; }
    if (B.phase === B.max - 1) G.toast(B.D.name + ' is furious!');
    B.bounced = false;
}
function guardFree(G, B) {
    B.state = 'free'; B.t = 2.2; G.white = 0.55; Sound.play('shrine');
    for (const d of G.L.doors) if (d.boss) d.open = true;
    G.L.ents = G.L.ents.filter(e => !e.spawned); G.shots = G.shots.filter(s => !s.guard);
    SAVE.d.guards = SAVE.d.guards || {}; SAVE.d.guards[B.kind] = true; ST('guardians'); SAVE.write();
    UI.bossbar(null); Sound.musicFor(G.world); B.clean = true;
    UI.talk(GUARD_TALK[B.kind].free.map(l => [B.kind, l]), () => { UI.banner(B.D.name + ' is free', 'The way is open'); G.revealGate(); });
}
// waves along the floor, warning glints, lava geysers
function guardFx(G, B, dt) {
    const p = G.p;
    for (const f of B.fx) {
        f.t -= dt;
        if (f.type === 'wave') {
            f.x += f.dir * f.sp * dt;
            if (Math.random() < 0.7) G.parts.push({ x: f.x, y: B.floor - 4, vx: rand(-30, 30), vy: rand(-170, -60), life: 0.4, max: 0.4, size: rand(3, 6), color: B.D.col, add: true, g: 500 });
            if (!p.dead && Math.abs(p.x - f.x) < 14 && p.y + p.h / 2 > B.floor - 22) hurt(G, 'enemy', { kind: B.kind, x: f.x - f.dir * 20, y: p.y });
            if (f.x < B.x0 || f.x > B.x1) f.t = 0;
        } else if (f.type === 'glint' && f.t <= 0) {
            G.shots.push({ x: f.x, y: B.top + 6, vx: 0, vy: 40, g: 1250, life: 3, style: 'shard', guard: true, kind: B.kind, col: '#bff7ff', light: '140,240,255' });
        } else if (f.type === 'rock' && f.t <= 0) {
            G.shots.push({ x: f.x, y: B.top + 6, vx: 0, vy: 40, g: 1250, life: 3, style: 'rock', guard: true, kind: B.kind, col: '#ff9a50', light: '255,140,60' });
        } else if (f.type === 'geyser') {
            if (f.t < 0.6 && !f.hot) { f.hot = true; Sound.play('crumble'); G.shake(4); }
            if (f.hot) {
                if (Math.random() < 0.9) G.parts.push({ x: f.x + rand(-10, 10), y: B.floor - 4, vx: rand(-30, 30), vy: rand(-620, -380), life: 0.5, max: 0.5, size: rand(4, 8), color: Math.random() < 0.5 ? '#ffb040' : '#ff5a1a', add: true, g: 400 });
                if (!p.dead && Math.abs(p.x - f.x) < 18 && p.y > B.floor - TS * 4.5) hurt(G, 'enemy', { kind: B.kind, x: f.x, y: p.y + 30 });
            } else if (Math.random() < 0.3) G.parts.push({ x: f.x + rand(-12, 12), y: B.floor - 2, vx: 0, vy: rand(-90, -30), life: 0.4, max: 0.4, size: rand(2, 4), color: '#ff7a2a', add: true, g: 0 });
        }
    }
    B.fx = B.fx.filter(f => f.t > 0);
}
const GUARD_AI = {
    moss(G, B, dt) {
        const p = G.p, g = 2200, sp = 1 + B.phase * 0.25;
        if (B.state === 'go') { B.state = 'idle'; B.t = 0.5; }
        if (B.state === 'idle') {
            B.squat = clamp(1 - B.t / (0.7 / sp), 0, 1);
            if (B.t <= 0) {
                const air = 0.95 - B.phase * 0.08; B.vy = -g * air / 2; B.vx = clamp((p.x - B.x) / air, -400, 400);
                B.face = sign(B.vx) || B.face; B.state = 'hop'; B.squat = 0; Sound.play('bounce'); dust(G, B.x, B.floor - 2, 10);
            }
        } else if (B.state === 'hop') {
            B.vy += g * dt; B.x += B.vx * dt; B.y += B.vy * dt;
            if (B.x < B.x0 + B.D.r) { B.x = B.x0 + B.D.r; B.vx = Math.abs(B.vx); } if (B.x > B.x1 - B.D.r) { B.x = B.x1 - B.D.r; B.vx = -Math.abs(B.vx); }
            if (B.vy > 0 && B.y >= B.floor - B.D.r) {
                B.y = B.floor - B.D.r; B.state = 'idle'; B.land = 1; G.shake(8); dust(G, B.x, B.floor - 2, 14); Sound.play('land');
                B.hops = (B.hops || 0) + 1; B.t = B.phase >= 2 && B.hops % 2 ? 0.14 : 0.75 / sp;        // hurt enough, it hops twice in a row
                if (B.phase >= 3 && !(B.hops % 2)) for (let i = 0; i < 3; i++) B.fx.push({ type: 'rock', x: B.x0 + 40 + rand(B.x1 - B.x0 - 80), t: 0.3 + i * 0.2 });
                if (B.phase >= 1) for (const d of [-1, 1]) B.fx.push({ type: 'wave', x: B.x + d * B.D.r, dir: d, sp: 260, t: 1.6 });
            }
        }
    },
    shard(G, B, dt) {
        const p = G.p, sp = 1 + B.phase * 0.25, hy = B.top + 56;
        if (B.state === 'go') { B.state = 'hover'; B.t = 2.4; B.drop = 0.5; }
        switch (B.state) {
            case 'hover':
                B.x = lerp(B.x, clamp(p.x, B.x0 + 60, B.x1 - 60), dt * 1.3); B.y = lerp(B.y, hy + Math.sin(B.wob * 3) * 10, dt * 3);
                B.drop -= dt; if (B.drop <= 0) { B.drop = 0.75 / sp; for (const o of B.phase >= 2 ? [-70, 0, 70] : [0]) B.fx.push({ type: 'glint', x: clamp(p.x + o + rand(-30, 30), B.x0 + 20, B.x1 - 20), t: 0.5 }); }
                if (B.t <= 0) { B.state = 'screech'; B.t = 0.6; Sound.play('screech'); G.shake(4); }
                break;
            case 'screech': B.y = lerp(B.y, hy - 20, dt * 4); if (B.t <= 0) {
                B.n++;
                if (B.n % (B.phase >= 2 ? 3 : 2)) { B.state = 'swoop'; B.u = 0; B.sx = B.x; B.ex = B.x < (B.x0 + B.x1) / 2 ? B.x1 - 70 : B.x0 + 70; B.sy = B.y; }
                else { B.state = 'dive'; B.tx = clamp(p.x, B.x0 + 40, B.x1 - 40); }
            } break;
            case 'swoop': {          // skims the floor from one side to the other: jump it
                B.u += dt / (1.3 / sp); const u = Math.min(1, B.u);
                B.x = lerp(B.sx, B.ex, u); B.y = lerp(B.sy, hy, u) + (B.floor - B.D.r - 6 - hy) * Math.sin(Math.PI * u); B.face = sign(B.ex - B.sx);
                if (u >= 1) { B.state = 'hover'; B.t = 2 / sp; }
                break;
            }
            case 'dive': {           // straight at where you were, into the floor
                const dx = B.tx - B.x, dy = B.floor - B.D.r - B.y, d = Math.hypot(dx, dy), v = 760 * sp * dt;
                B.face = sign(dx) || B.face;
                if (d <= v) { B.x = B.tx; B.y = B.floor - B.D.r; B.state = 'dazed'; B.t = 1.8; B.open = true; G.shake(12); Sound.play('crumble'); burst(G, B.x, B.floor, '#bff7ff', 24, 260); }
                else { B.x += dx / d * v; B.y += dy / d * v; }
                break;
            }
            case 'dazed': if (B.t <= 0) { B.open = false; B.state = 'rise'; B.t = 0.9; } break;
            case 'rise': B.y = lerp(B.y, hy, dt * 3); if (B.t <= 0) { B.state = 'hover'; B.t = 2 / sp; } break;
        }
    },
    bell(G, B, dt) {
        const p = G.p, sp = 1 + B.phase * 0.2, hy = B.top + 70, spots = [B.x0 + 110, (B.x0 + B.x1) / 2, B.x1 - 110];
        if (B.state === 'go') { B.state = 'move'; B.t = 1.1; B.tx = spots[1]; }
        switch (B.state) {
            case 'move': B.x = lerp(B.x, B.tx, dt * 2.5); B.y = lerp(B.y, hy + Math.sin(B.wob * 2) * 8, dt * 3);
                if (B.t <= 0) { B.state = 'volley'; B.t = 1.5; B.k = 0; } break;
            case 'volley':           // three rings of light, each turned a little
                B.y = lerp(B.y, hy + Math.sin(B.wob * 2) * 8, dt * 3);
                if (B.t < 1.4 - B.k * 0.4 && B.k < (B.phase >= 2 ? 4 : 3)) {
                    const n = 10 + B.phase * 2;
                    for (let i = 0; i < n; i++) { const a = (i + B.k * 0.5) / n * Math.PI * 2; G.shots.push({ x: B.x, y: B.y + 10, vx: Math.cos(a) * 150 * sp, vy: Math.sin(a) * 150 * sp, life: 5, guard: true, kind: B.kind }); }
                    B.k++; Sound.play('gong'); B.glow = 1;
                }
                if (B.t <= 0) { B.n++; if (B.n % 2) { B.state = 'move'; B.t = 1; B.tx = spots[(B.n + (p.x > B.x ? 1 : 0)) % 3]; } else { B.state = 'toll'; B.t = 0.7; Sound.play('screech'); } }
                break;
            case 'toll': B.x = lerp(B.x, p.x, dt * 3); B.y = lerp(B.y, hy - 40, dt * 4); B.glow = 1; if (B.t <= 0) { B.state = 'drop'; B.vy = 0; } break;
            case 'drop':
                B.vy += 3600 * dt; B.y += B.vy * dt;
                if (B.y >= B.floor - B.D.r) {
                    B.y = B.floor - B.D.r; B.state = 'stuck'; B.t = 1.8; B.open = true; G.shake(14); Sound.play('gong'); Sound.play('boss');
                    if (B.phase >= 3 && !B.bounced) { B.bounced = true; B.state = 'toll'; B.t = 0.5; B.open = false; }      // hurt enough, it tolls twice
                    else B.bounced = false;
                    for (const d of [-1, 1]) B.fx.push({ type: 'wave', x: B.x + d * B.D.r, dir: d, sp: 300, t: 2.2 });
                    burst(G, B.x, B.floor, B.D.col, 30, 300);
                }
                break;
            case 'stuck': if (B.t <= 0) { B.open = false; B.state = 'lift'; B.t = 0.8; } break;
            case 'lift': B.y = lerp(B.y, hy, dt * 3); if (B.t <= 0) { B.state = 'move'; B.t = 0.9; B.tx = spots[Math.floor(rand(3))]; } break;
        }
        B.glow = Math.max(0, B.glow - dt * 2);
    },
    cinder(G, B, dt) {
        const p = G.p, sp = 1 + B.phase * 0.2;
        if (B.state === 'go') { B.state = 'stalk'; B.t = 2; B.spit = 0.8; }
        B.y = B.floor - B.D.r;
        switch (B.state) {
            case 'stalk':
                B.face = sign(p.x - B.x) || B.face; B.x = clamp(B.x + B.face * 70 * dt, B.x0 + B.D.r, B.x1 - B.D.r);
                B.spit -= dt;
                if (B.spit <= 0) {
                    B.spit = 1 / sp; const air = 0.85;
                    for (const o of B.phase >= 3 ? [-120, 0, 120] : [0]) G.shots.push({ x: B.x + B.face * 30, y: B.y - 14, vx: clamp((p.x - B.x) / air + o, -480, 480), vy: -520, g: 1200, life: 3, style: 'lava', guard: true, kind: B.kind, col: '#ff7a2a', light: '255,120,40' });
                    Sound.play('shoot');
                    if (B.phase >= 1) B.fx.push({ type: 'geyser', x: clamp(p.x, B.x0 + 20, B.x1 - 20), t: 1.4 });
                }
                if (B.t <= 0) { B.state = 'rev'; B.t = 0.8; Sound.play('roar'); }
                break;
            case 'rev': B.face = sign(p.x - B.x) || B.face; B.glow = 1; if (Math.random() < 0.5) dust(G, B.x - B.face * 20, B.floor - 2, 2);
                if (B.t <= 0) { B.state = 'charge'; B.vx = B.face * 560 * sp; } break;
            case 'charge':
                B.x += B.vx * dt; if (Math.random() < 0.6) dust(G, B.x - B.face * 24, B.floor - 2, 2);
                if (B.x <= B.x0 + B.D.r || B.x >= B.x1 - B.D.r) {
                    B.x = clamp(B.x, B.x0 + B.D.r, B.x1 - B.D.r);
                    if (B.phase >= 2 && !B.bounced) { B.bounced = true; B.face = -B.face; B.vx = -B.vx * 1.1; G.shake(10); Sound.play('stomp'); burst(G, B.x - B.face * B.D.r, B.y, '#ffb040', 16, 220); break; }   // off the wall and back
                    B.bounced = false; B.state = 'stunned'; B.t = 1.9; B.open = true; B.glow = 0;
                    G.shake(16); Sound.play('boss'); burst(G, B.x + B.face * B.D.r, B.y, '#ffb040', 24, 260);
                    for (let i = 0; i < 2 + B.phase; i++) B.fx.push({ type: 'rock', x: B.x0 + 40 + rand(B.x1 - B.x0 - 80), t: 0.4 + i * 0.25 });
                }
                break;
            case 'stunned': if (B.t <= 0) { B.open = false; B.state = 'stalk'; B.t = 2 / sp; B.spit = 0.6; } break;
        }
        B.glow = Math.max(0, B.glow - dt * 1.5);
    }
};
function guardUpdate(G, dt) {
    const B = G.guard, p = G.p; if (!B) return;
    B.wob += dt; B.hitT = Math.max(0, B.hitT - dt); B.land = Math.max(0, B.land - dt * 4); B.t -= dt;
    if (B.state === 'gone') return;
    if (B.state === 'free') { B.y -= dt * 40; if (Math.random() < 0.5) burst(G, B.x + rand(-30, 30), B.y + rand(-30, 30), '#fff6d0', 2, 120, true); if (B.t <= 0) B.state = 'gone'; return; }
    if (B.state === 'wait') { if (!p.dead && p.x > B.x0 + TS * 2 && p.y > B.floor - TS * 12) guardWake(G, B); return; }
    if (B.say) B.say.t -= dt;
    if (B.state === 'intro') {
        if (B.t <= 0) { if (G.guardSpoke) B.state = 'go'; else { G.guardSpoke = true; B.state = 'talking'; UI.talk(GUARD_TALK[B.kind].pre.map(l => [B.kind, l]), () => { B.state = 'go'; }); } }
        return;
    }
    if (B.state === 'talking') return;
    if (B.state === 'dying') {
        if (Math.random() < 0.6) burst(G, B.x + rand(-40, 40), B.y + rand(-30, 30), Math.random() < 0.5 ? '#fff2c4' : B.D.col, 5, 240, true);
        if (B.t <= 0) guardFree(G, B);
        return;
    }
    GUARD_AI[B.kind](G, B, dt);
    guardFx(G, B, dt);
    if (p.dead) return;
    // touching it: stomp or dash when it is open (Mossback: its back, any time), otherwise it hurts
    if (Math.abs(p.x - B.x) < B.D.r + 10 && Math.abs(p.y - B.y) < B.D.r + 14) {
        const above = p.vy > 60 && p.y < B.y - B.D.r * 0.35;
        if ((B.open || B.kind === 'moss') && B.hitT <= 0 && (above || (B.open && p.dashT > 0))) guardHit(G, B);
        else if (p.dashT <= 0 && p.hurtT <= 0 && B.hitT <= 0.4) hurt(G, 'enemy', B);
    }
}

// ---------- drawing ----------
function drawGuard(x, G, t) {
    const B = G.guard; if (!B || B.state === 'gone') return;
    for (const f of B.fx) {
        if (f.type === 'glint' || f.type === 'rock') { x.save(); x.translate(f.x, B.top + 4); x.globalAlpha = 0.5 + 0.5 * Math.sin(t * 30); x.fillStyle = f.type === 'rock' ? '#ffb070' : '#e8feff';
            x.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, r = i % 2 ? 3 : 10; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.fill(); x.restore(); }
        if (f.type === 'geyser' && !f.hot) { x.save(); x.globalAlpha = 0.4 + 0.3 * Math.sin(t * 25); x.fillStyle = '#ff6a1a'; x.beginPath(); x.ellipse(f.x, B.floor - 2, 20, 5, 0, 0, 7); x.fill(); x.restore(); }
    }
    x.save(); x.translate(B.x, B.y);
    const free = B.state === 'free', dying = B.state === 'dying';
    if (free) { x.globalAlpha = clamp(B.t / 2.2, 0, 1); x.globalCompositeOperation = 'lighter'; }
    if (dying) x.translate(rand(-3, 3), rand(-3, 3));
    const hit = B.hitT > 0.4 && Math.floor(t * 20) % 2, lit = free || hit;
    // the sprites are drawn at a reference size and scaled up to the guardian's real size
    const base = { moss: 38, shard: 30, bell: 36, cinder: 36 }[B.kind], k = B.D.r / base;
    x.save(); x.scale(k, k); GUARD_ART[B.kind](x, Object.assign({}, B, { D: Object.assign({}, B.D, { r: base }) }), t, lit); x.restore();
    if (B.say && B.say.t > 0) { x.restore(); drawSay(x, B.x, B.y - B.D.r - 30, B.say); x.save(); x.translate(B.x, B.y); }
    if (B.open && !free) { x.fillStyle = '#fff'; x.font = 'bold 22px sans-serif'; x.textAlign = 'center'; x.globalAlpha = 0.6 + 0.4 * Math.sin(t * 10); x.fillText('!', 0, -B.D.r - 14); x.globalAlpha = 1;
        // dizzy stars
        for (let i = 0; i < 3; i++) { const a = t * 4 + i * 2.1; x.fillStyle = '#ffe08a'; star5(x, Math.cos(a) * 22, -B.D.r - 4 + Math.sin(a) * 6, 4); } }
    x.restore();
}
function star5(x, cx, cy, r, ir = 0.45) { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * ir : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.fill(); }
// the dark inside a guardian: wisps that leave when it is freed
function darkWisps(x, r, t) {
    x.strokeStyle = 'rgba(90,30,150,.55)'; x.lineWidth = 4; x.lineCap = 'round';
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + t * 0.7; x.beginPath(); x.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.5); x.quadraticCurveTo(Math.cos(a + 0.6) * r * 1.2, Math.sin(a + 0.6) * r, Math.cos(a + Math.sin(t * 2 + i)) * r * 1.35, Math.sin(a + Math.sin(t * 2 + i)) * r * 1.1); x.stroke(); }
}
const eyes = (x, ex, ey, r, lit, look) => { for (const s of [-1, 1]) { x.fillStyle = lit ? '#fff' : '#d9b0ff'; x.beginPath(); x.ellipse(ex + s * r * 2.2, ey, r, r * 1.2, 0, 0, 7); x.fill(); x.fillStyle = '#1a0630'; x.beginPath(); x.arc(ex + s * r * 2.2 + look * r * 0.4, ey + r * 0.2, r * 0.5, 0, 7); x.fill(); } };
const GUARD_ART = {
    moss(x, B, t, lit) {
        const r = B.D.r, sq = B.state === 'hop' ? clamp(-B.vy / 1400, -0.15, 0.25) : -(B.squat || 0) * 0.18 - B.land * 0.2;
        x.scale(B.face < 0 ? -1 : 1, 1); x.scale(1 - sq * 0.6, 1 + sq);
        if (!lit && !B.clean) darkWisps(x, r, t);
        // legs
        x.fillStyle = '#3a2a1a'; for (const lx of [-24, -8, 10, 26]) { x.fillRect(lx - 3, r * 0.55, 6, 12 + Math.sin(t * 10 + lx) * (B.state === 'hop' ? 0 : 1.5)); }
        // shell
        const g = x.createLinearGradient(0, -r, 0, r * 0.7); g.addColorStop(0, lit ? '#f4ffe8' : '#4f8a3a'); g.addColorStop(1, lit ? '#c8f0b0' : '#1f3d1c');
        x.fillStyle = g; x.beginPath(); x.ellipse(0, r * 0.2, r * 1.15, r * 0.95, 0, Math.PI, 0); x.lineTo(r * 1.15, r * 0.55); x.quadraticCurveTo(0, r * 0.8, -r * 1.15, r * 0.55); x.fill();
        // moss clumps and little mushrooms on its back
        x.fillStyle = lit ? '#ffffff' : '#7bd36b'; for (let i = 0; i < 7; i++) { const a = Math.PI + (i + 0.5) / 7 * Math.PI; x.beginPath(); x.arc(Math.cos(a) * r * 1.05, r * 0.2 + Math.sin(a) * r * 0.88, 7 + (i % 3) * 2, 0, 7); x.fill(); }
        for (const [mx, mh, c] of [[-18, 14, '#ff7a8a'], [8, 18, '#ffd36b'], [24, 11, '#c58aff']]) { x.fillStyle = '#e8d8c0'; x.fillRect(mx - 2, -r * 0.72 - mh, 4, mh); x.fillStyle = lit ? '#fff' : c; x.beginPath(); x.ellipse(mx, -r * 0.72 - mh, 8, 5, 0, Math.PI, 0); x.fill(); }
        // face
        x.fillStyle = lit ? '#fff' : '#2a1e14'; x.beginPath(); x.ellipse(r * 0.95, r * 0.3, r * 0.42, r * 0.34, 0, 0, 7); x.fill();
        eyes(x, r * 0.95, r * 0.22, 4.5, lit, 1);
        x.strokeStyle = lit ? '#bbb' : '#f0e0c0'; x.lineWidth = 3; x.beginPath(); x.moveTo(r * 1.25, r * 0.5); x.quadraticCurveTo(r * 1.6, r * 0.6, r * 1.55, r * 0.15); x.stroke();     // a horn
    },
    shard(x, B, t, lit) {
        const r = B.D.r, down = B.state === 'dazed', flap = down ? 0.15 : Math.sin(t * (B.state === 'swoop' || B.state === 'dive' ? 22 : 12));
        x.scale(B.face < 0 ? -1 : 1, 1);
        if (!lit && !B.clean) darkWisps(x, r, t);
        // crystal wings: faceted, catching the light
        for (const s of [-1, 1]) {
            x.save(); x.scale(s, 1); x.rotate(-0.25 + flap * 0.45);
            const g = x.createLinearGradient(0, -20, 70, 20); g.addColorStop(0, lit ? '#ffffff' : '#9af6ff'); g.addColorStop(1, lit ? '#e8ffff' : '#2a6aa8');
            x.fillStyle = g; x.beginPath(); x.moveTo(8, -6); x.lineTo(40, -34); x.lineTo(74, -22); x.lineTo(62, 2); x.lineTo(50, -4); x.lineTo(40, 12); x.lineTo(26, 2); x.lineTo(14, 10); x.closePath(); x.fill();
            x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(8, -6); x.lineTo(62, 2); x.moveTo(40, -34); x.lineTo(40, 12); x.stroke(); x.restore();
        }
        // body + ears
        x.fillStyle = lit ? '#fff' : '#1b2a52'; x.beginPath(); x.ellipse(0, 0, r * 0.62, r * 0.75, 0, 0, 7); x.fill();
        for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 8, -r * 0.6); x.lineTo(s * 20, -r * 1.25); x.lineTo(s * 20, -r * 0.45); x.fill(); }
        x.fillStyle = lit ? '#e8ffff' : '#8ff0ff'; x.beginPath(); x.moveTo(-6, -r * 0.2); x.lineTo(0, -r * 0.5); x.lineTo(6, -r * 0.2); x.lineTo(0, 0); x.fill();       // a crystal on its brow
        eyes(x, 0, 2, 3.5, lit, 0.5);
        x.fillStyle = '#fff'; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 4, 12); x.lineTo(s * 6, 18); x.lineTo(s * 8, 12); x.fill(); }    // fangs
    },
    bell(x, B, t, lit) {
        const r = B.D.r, sw = B.state === 'stuck' ? 0 : Math.sin(t * 2.2) * 0.12;
        x.rotate(sw);
        if (!lit && !B.clean) darkWisps(x, r, t);
        // the clapper: the trapped light
        const cg = x.createRadialGradient(0, r * 0.75, 1, 0, r * 0.75, 18 + B.glow * 14); cg.addColorStop(0, '#fffbe6'); cg.addColorStop(0.5, B.open ? '#ffd36b' : '#c9a0ff'); cg.addColorStop(1, 'rgba(255,220,140,0)');
        x.fillStyle = cg; x.beginPath(); x.arc(0, r * 0.75, 18 + B.glow * 14, 0, 7); x.fill();
        // the bell
        const g = x.createLinearGradient(-r, 0, r, 0); g.addColorStop(0, lit ? '#fff' : '#6a5a3a'); g.addColorStop(0.45, lit ? '#fffbe6' : '#c8a860'); g.addColorStop(1, lit ? '#eee' : '#4a3a20');
        x.fillStyle = g; x.beginPath(); x.moveTo(-r * 0.5, -r * 0.95); x.quadraticCurveTo(-r * 0.6, -r * 1.15, 0, -r * 1.15); x.quadraticCurveTo(r * 0.6, -r * 1.15, r * 0.5, -r * 0.95);
        x.quadraticCurveTo(r * 0.7, r * 0.1, r * 1.05, r * 0.7); x.lineTo(-r * 1.05, r * 0.7); x.quadraticCurveTo(-r * 0.7, r * 0.1, -r * 0.5, -r * 0.95); x.fill();
        x.fillStyle = lit ? '#fff' : '#8a7040'; x.fillRect(-r * 1.08, r * 0.6, r * 2.16, 8);
        // glowing runes round its waist, and a crack when it is open
        x.fillStyle = B.open || B.glow > 0 ? '#fff2a0' : '#ffd36b'; x.globalAlpha = 0.5 + 0.5 * Math.max(B.glow, Math.sin(t * 3) * 0.5 + 0.5);
        for (let i = -2; i <= 2; i++) { x.fillRect(i * 11 - 2, -r * 0.1, 4, 10); x.fillRect(i * 11 - 5, -r * 0.1 + 3, 10, 3); }
        x.globalAlpha = 1;
        if (B.open) { x.strokeStyle = '#fff2c4'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(-6, -r); x.lineTo(2, -r * 0.6); x.lineTo(-4, -r * 0.3); x.lineTo(6, 0); x.stroke(); }
        eyes(x, 0, -r * 0.55, 4, lit, sign(G.p.x - B.x));
        // the hook on top
        x.strokeStyle = lit ? '#fff' : '#8a7040'; x.lineWidth = 5; x.beginPath(); x.arc(0, -r * 1.25, 8, Math.PI, 0); x.stroke();
    },
    cinder(x, B, t, lit) {
        const r = B.D.r, run = B.state === 'charge' || B.state === 'stalk', bob = run ? Math.abs(Math.sin(t * (B.state === 'charge' ? 24 : 8))) * 4 : 0;
        x.scale(B.face < 0 ? -1 : 1, 1); x.translate(0, -bob);
        if (!lit && !B.clean) darkWisps(x, r, t);
        // legs
        x.fillStyle = lit ? '#fff' : '#2a1a18'; for (const [lx, ph] of [[-26, 0], [-10, 1], [12, 0], [28, 1]]) x.fillRect(lx - 5, r * 0.5, 10, 14 + (run ? Math.sin(t * 20 + ph * 3) * 4 : 0));
        // rock body with lava cracks that glow hotter as it revs
        const g = x.createLinearGradient(0, -r, 0, r); g.addColorStop(0, lit ? '#fff' : '#4a3430'); g.addColorStop(1, lit ? '#eee' : '#1e1210');
        x.fillStyle = g; x.beginPath(); x.moveTo(-r * 1.2, r * 0.6); x.quadraticCurveTo(-r * 1.3, -r * 0.6, -r * 0.3, -r * 0.85); x.quadraticCurveTo(r * 0.6, -r * 1.05, r * 1.0, -r * 0.4); x.lineTo(r * 1.4, r * 0.1); x.lineTo(r * 1.0, r * 0.6); x.closePath(); x.fill();
        x.strokeStyle = `rgba(255,${120 + B.glow * 100},40,${0.6 + B.glow * 0.4 + Math.sin(t * 6) * 0.15})`; x.lineWidth = 3;
        x.beginPath(); x.moveTo(-r * 0.9, -r * 0.2); x.lineTo(-r * 0.5, 0); x.lineTo(-r * 0.6, r * 0.35); x.moveTo(-r * 0.2, -r * 0.7); x.lineTo(0, -r * 0.3); x.lineTo(r * 0.3, -r * 0.4); x.lineTo(r * 0.35, r * 0.1); x.moveTo(-r * 0.1, r * 0.2); x.lineTo(r * 0.2, r * 0.45); x.stroke();
        // spikes on its back
        x.fillStyle = lit ? '#fff' : '#ff7a2a'; for (const sx of [-r * 0.7, -r * 0.3, r * 0.1]) { x.beginPath(); x.moveTo(sx - 7, -r * 0.75); x.lineTo(sx, -r * 1.15 - (sx === -r * 0.3 ? 6 : 0)); x.lineTo(sx + 7, -r * 0.8); x.fill(); }
        // jaw (open when it spits or revs)
        const jaw = B.state === 'rev' || B.state === 'charge' ? 0.5 : B.spit !== undefined && B.spit > 0.8 ? 0.4 : 0.1;
        x.fillStyle = lit ? '#fff' : '#3a2420'; x.save(); x.translate(r * 0.9, r * 0.25); x.rotate(jaw); x.fillRect(-10, 0, r * 0.6, 9); x.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(-4 + i * 7, 0); x.lineTo(-1 + i * 7, -6); x.lineTo(2 + i * 7, 0); x.fill(); } x.restore();
        x.fillStyle = `rgba(255,180,60,${0.5 + jaw})`; x.beginPath(); x.arc(r * 1.05, r * 0.25, 6, 0, 7); x.fill();
        eyes(x, r * 0.55, -r * 0.4, 3.5, lit, 1);
    }
};
// guardian shots: crystal shards, lava blobs, falling rocks
function drawGShot(x, b, t) {
    x.save(); x.translate(b.x, b.y);
    if (b.style === 'shard') { x.rotate(Math.atan2(b.vy, b.vx) - Math.PI / 2); x.fillStyle = '#bff7ff'; x.beginPath(); x.moveTo(0, 12); x.lineTo(5, -4); x.lineTo(0, -12); x.lineTo(-5, -4); x.closePath(); x.fill(); x.fillStyle = '#fff'; x.fillRect(-1, -8, 2, 14); }
    else if (b.style === 'lava') { const g = x.createRadialGradient(0, 0, 1, 0, 0, 11); g.addColorStop(0, '#fff2a0'); g.addColorStop(0.5, '#ff8a2a'); g.addColorStop(1, 'rgba(200,40,0,0)'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 11, 0, 7); x.fill(); }
    else { x.rotate(t * 6); x.fillStyle = '#5a3a30'; x.beginPath(); x.moveTo(-9, -4); x.lineTo(-2, -10); x.lineTo(9, -5); x.lineTo(7, 7); x.lineTo(-6, 9); x.closePath(); x.fill(); x.strokeStyle = '#ff8a3a'; x.lineWidth = 2; x.stroke(); }
    x.restore();
}
