// ==========================================
// THE GLOOM: the last boss. A cloud of shadow with a light trapped inside.
//   float: drifts above the arena and throws shadow orbs that curve toward you
//   slam:  rises, hangs over you (a shadow marks the spot), crashes down and sends shockwaves along the floor (jump them)
//   stunned: after a slam its core glows - stomp it or dash into it. Nine hits; it gets faster and calls bats every third.
//   It talks before the fight (once per try of the level) and says something every time it is hit.
// 1.4 adds a move list per phase (GLOOM_PLAN), every move warned for about a second (a sound, a line, and a mark in the arena):
//   ring:   a circle of orbs bursts out; the gap is lit, and a light on the floor shows where it will pass (or dash through)
//   beam:   it climbs to the ceiling and sweeps a beam across the floor; the ledges block it, so hide under one (or dash through)
//   charge: it drops to the floor at one wall and rushes to the other (a lit band shows the lane): jump, dash or take a ledge
//   rain:   shadow drops fall from the ceiling onto the marked spots; stand between them or under a ledge
//   double: in the last phase a slam comes twice (the second shadow shows where)
//   lumen:  from the second phase it sometimes throws a piece of its light (a gold orb, its eye flashes first):
//           dash into it to throw it back - it knocks The Gloom out of the air and opens it, like a slam
// Fair touch (1.4): it cannot hurt you just after a hit, while it is stunned, or when you land on top of it - you are pushed off.
// ==========================================
const GLOOM_PLAN = [['slam', 'ring', 'slam', 'beam'], ['charge', 'slam', 'beam', 'slam', 'ring'], ['rain', 'slam', 'charge', 'beam', 'slam', 'ring']];
function makeBoss(e) { return { x: e.x, y: e.y - 60, hx: e.x, hy: e.y - 60, r: 46, hp: 9, max: 9, state: 'intro', t: 2.2, stun: 0, hitT: 0, safeT: 0, phase: 0, waves: [], drops: [], lums: [], fireT: 1.5, wob: 0, k: 0, vol: 0, glint: 0 }; }
function gloomSay(B, k) { B.say = { text: GLOOM_TALK.moves[k], t: 2.2 }; }
// the arena's inside edges and ceiling, found once from the map around where The Gloom starts
function gloomArena(L, B, floorY) {
    const row = Math.floor((floorY - 8) / TS), t0 = Math.floor(B.hx / TS); let tx = t0, ty = Math.floor(B.hy / TS);
    while (tx > 0 && !isSolidT(L, tx - 1, row)) tx--; B.ax0 = tx * TS;
    tx = t0; while (tx < L.w - 1 && !isSolidT(L, tx + 1, row)) tx++; B.ax1 = (tx + 1) * TS;
    while (ty > 0 && !isSolidT(L, t0, ty - 1)) ty--; B.top = ty * TS;
}
const blocksT = (L, tx, ty) => { const k = tileAt(L, tx, ty); return k === T_SOLID || k === T_ONEWAY; };
// the first ledge or floor below y in the column at x (where a beam or a drop stops)
function gloomHitY(L, x, y) { const tx = Math.floor(x / TS); for (let ty = Math.max(0, Math.floor(y / TS)); ty < L.h; ty++) if (blocksT(L, tx, ty)) return ty * TS; return L.h * TS; }
// pushed off a big body without being hurt (on top: a bounce; at the side: a shove outward)
function bodyPush(p, bx, by, R, pop) {
    const s = sign(p.x - bx || 1);
    if (p.y < by - R * 0.3) { p.vy = Math.min(p.vy, pop ? -420 : -360); p.vx = s * Math.max(Math.abs(p.vx), 200); p.ground = false; p.on = null; }
    else p.vx = s * Math.max(Math.abs(p.vx), 260);
}
function gloomNext(G, B) {
    const p = G.p, plan = GLOOM_PLAN[Math.min(2, B.phase)], m = plan[B.k++ % plan.length], mid = (B.ax0 + B.ax1) / 2;
    B.glint = 0;
    // a new move clears the air: its curving orbs burst, so each warning can be read on its own
    { for (const o of G.shots) if (o.home) { o.dead = true; burst(G, o.x, o.y, '#a070ff', 6, 90); } G.shots = G.shots.filter(o => !o.dead); }
    if (m === 'slam') { B.state = 'rise'; B.t = 0.9; B.second = false; Sound.play('boss'); }
    else if (m === 'ring') { B.state = 'ringW'; B.t = 1; B.rings = B.phase >= 1 ? 2 : 1; gloomGap(G, B); Sound.play('gong'); gloomSay(B, 'ring'); }
    else if (m === 'beam') { B.state = 'beamW'; B.t = 1.1; B.dir = B.x < mid ? 1 : -1; B.bx = B.dir > 0 ? B.ax0 + 20 : B.ax1 - 20; Sound.play('screech'); gloomSay(B, 'beam'); }
    else if (m === 'charge') { B.state = 'chargeW'; B.t = 1.4; B.dir = p.x < mid ? -1 : 1; B.sx = B.dir < 0 ? B.ax1 - B.r - 8 : B.ax0 + B.r + 8; B.back = false; Sound.play('roar'); gloomSay(B, 'charge'); }
    else {      // rain: drops spaced across the arena (a little jitter), each marked where it will land
        B.state = 'rainW'; B.t = 1.1; B.drops = []; const n = 7 + B.phase, w = (B.ax1 - B.ax0) / n, off = rand(-0.3, 0.3);
        for (let i = 0; i < n; i++) { const x = B.ax0 + (i + 0.5 + off) * w + rand(-14, 14); B.drops.push({ x, y: B.top + 6, vy: 0, land: gloomHitY(G.L, x, B.top + 4), go: false }); }
        Sound.play('crumble'); gloomSay(B, 'rain');
    }
}
// the ring's gap points at a spot on the floor near you, within a short run (shown by a light there)
function gloomGap(G, B) { B.gx = clamp(G.p.x + rand(-260, 260), B.ax0 + 90, B.ax1 - 90); B.gap = Math.atan2(B.floor - 14 - B.hy, B.gx - B.x); }
function gloomHit(G, B) {
    const p = G.p;
    B.hp--; B.hitT = 0.4; B.safeT = 1.3; G.shake(10); G.hitstop = 0.07; Sound.play('stomp'); Sound.play('hurtBoss'); burst(G, B.x, B.y - 20, '#fff2c4', 30, 300);
    p.vy = -PH.stomp * 1.2; p.vx = sign(p.x - B.x || 1) * 260; p.air = 1; p.canDash = true; p.dashT = 0;
    if (B.hp <= 0) { B.state = 'dying'; B.t = 2.4; B.say = null; B.drops = []; B.lums = []; B.waves = []; Sound.play('gate'); G.stats.boss = true; return; }
    B.say = { text: GLOOM_TALK.mid[(B.max - B.hp - 1) % GLOOM_TALK.mid.length], t: 2.6 }; UI.bossbar(B);
    if (B.hp % 3 === 0) {
        B.phase++; B.k = 0; B.vol = 0; G.toast(B.phase === 1 ? 'It is getting angry...' : 'One last push!');
        for (let i = 0; i < 1 + B.phase; i++) G.L.ents.push({ kind: 'bat', x: B.x, y: B.hy, sx: TS * (6 + i * 9) % (G.L.w * TS - TS * 8) + TS * 4, sy: B.hy + 40, seed: rand(9), spawned: true });
    }
    // recoil: away from where you bounced, staying low a moment, then back up (never straight up into you)
    B.state = 'hurt'; B.t = 1.1; B.stun = 0; B.waves = []; B.lums = [];
    B.rx = clamp(B.x - sign(p.x - B.x || 1) * 260, B.ax0 + B.r + 10, B.ax1 - B.r - 10);
}
function bossUpdate(G, dt) {
    const B = G.boss, p = G.p; if (!B) return;
    B.wob += dt; B.hitT = Math.max(0, B.hitT - dt); B.safeT = Math.max(0, B.safeT - dt); if (B.say) B.say.t -= dt;
    const L = G.L, floorY = B.floor || (B.floor = findFloor(L, B.hx)), speed = 1 + B.phase * 0.25;
    if (B.ax0 === undefined) gloomArena(L, B, floorY);
    const mid = (B.ax0 + B.ax1) / 2, lo = floorY - B.r * 0.75, high = B.top + 56;
    B.t -= dt;
    switch (B.state) {
        case 'intro': B.y = lerp(B.y, B.hy, dt * 2);
            if (B.t <= 0) {
                UI.bossbar(B);
                if (G.gloomSpoke) { B.state = 'float'; B.t = 4.5 / speed; }
                else { G.gloomSpoke = true; B.state = 'talking'; UI.talk(GLOOM_TALK.pre, () => { B.state = 'float'; B.t = 4.5 / speed; }); }
            }
            break;
        case 'talking': break;
        case 'float': {
            if (B.glint > 0) {          // its eye flashes gold, then it throws a piece of its light
                B.glint -= dt;
                if (B.glint <= 0) { const a = Math.atan2(p.y - B.y, p.x - B.x); B.lums.push({ x: B.x, y: B.y, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, life: 7 }); Sound.play('shoot'); }
                break;
            }
            const tx = clamp(p.x, TS * 4, L.w * TS - TS * 4) + Math.sin(B.wob * 0.9) * 120;
            // (1.4) if you stand on a ledge it floats higher, above you, instead of drifting into you at your height
            if (p.ground || B.fy === undefined) B.fy = p.ground && p.y < floorY - 40 ? Math.max(B.top + 50, Math.min(B.hy, p.y - 115)) : B.hy;
            B.x = lerp(B.x, tx, dt * 0.9 * speed); B.y = lerp(B.y, B.fy + Math.sin(B.wob * 1.6) * 30, dt * 2);
            B.fireT -= dt;
            if (B.fireT <= 0) {
                B.fireT = 1.2 / speed; B.vol++;
                if (B.phase >= 1 && B.vol % 3 === 0 && !B.lums.length && B.t > 1) { B.glint = 0.7; Sound.play('pop'); Sound.play('spark', 4); gloomSay(B, 'lumen'); }
                else {
                    const n = 2 + B.phase;
                    for (let i = 0; i < n; i++) { const a = Math.atan2(p.y - B.y, p.x - B.x) + (i - (n - 1) / 2) * 0.35; G.shots.push({ x: B.x, y: B.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, life: 6, shadow: true, home: 0.9 }); }
                    Sound.play('shoot');
                }
            }
            if (B.t <= 0) gloomNext(G, B);
            break;
        }
        case 'rise':        // (from the floor, after the first of a double slam, it goes straight up before it follows you)
            B.y = lerp(B.y, B.hy - 90, dt * 4); if (B.y < floorY - B.r * 2.2) B.x = lerp(B.x, p.x, dt * 3);
            if (B.t <= 0) { B.state = 'hang'; B.t = 0.65 / Math.sqrt(speed); B.tx = clamp(p.x, B.ax0 + B.r, B.ax1 - B.r); } break;
        case 'hang': B.x = lerp(B.x, B.tx, dt * 6); if (B.t <= 0) { B.state = 'drop'; B.vy = 0; } break;
        case 'drop':
            B.vy = (B.vy || 0) + 3200 * dt; B.y += B.vy * dt;
            if (B.y >= lo) {
                B.y = lo; G.shake(14); Sound.play('boss');
                for (const d of [-1, 1]) B.waves.push({ x: B.x + d * B.r, dir: d, life: 2.6 });
                burst(G, B.x, floorY, '#b98aff', 30, 300);
                if (B.phase >= 2 && !B.second) { B.second = true; B.state = 'rise'; B.t = 0.75; gloomSay(B, 'double'); }
                else { B.state = 'stunned'; B.stun = 2.6; }
            }
            break;
        case 'stunned':
            B.stun -= dt;
            if (B.stun <= 0) { B.state = 'float'; B.t = 4.5 / speed; B.fireT = 0.8; }
            break;
        case 'reel':        // hit by its own light: it falls out of the air and lies open, like after a slam (no shockwaves)
            B.vy = (B.vy || 0) + 1500 * dt; B.y += B.vy * dt;
            if (B.y >= lo) { B.y = lo; B.state = 'stunned'; B.stun = 2.4; G.shake(10); Sound.play('crumble'); burst(G, B.x, floorY, '#ffd36b', 24, 260); }
            break;
        case 'hurt':
            B.x = lerp(B.x, B.rx, dt * 4);
            if (B.t > 0.55) B.y = lerp(B.y, Math.max(B.y, lo - 20), dt * 3); else B.y = lerp(B.y, B.hy, dt * 3);
            if (B.t <= 0) { B.state = 'float'; B.t = 4 / speed; } break;
        case 'ringW':       // warning: it gathers, the ring is drawn faintly with its gap lit
            B.x = lerp(B.x, clamp(B.x, B.ax0 + 220, B.ax1 - 220), dt * 3); B.y = lerp(B.y, B.hy, dt * 3); B.gap = Math.atan2(floorY - 14 - B.y, B.gx - B.x);
            if (B.t <= 0) {
                const n = 20, step = Math.PI * 2 / n;
                for (let i = 2; i <= n - 2; i++) { const a = B.gap + i * step; G.shots.push({ x: B.x + Math.cos(a) * 24, y: B.y + Math.sin(a) * 24, vx: Math.cos(a) * 165, vy: Math.sin(a) * 165, life: 7, shadow: true }); }
                Sound.play('shoot'); G.shake(5); ring(G, B.x, B.y, '#b98aff');
                if (--B.rings > 0) { B.t = 1; gloomGap(G, B); Sound.play('gong'); } else { B.state = 'float'; B.t = 3 / speed; B.fireT = 1.2; }
            }
            break;
        case 'beamW':       // warning: it climbs to the ceiling over the start of the sweep; a thin line flickers there
            B.x = lerp(B.x, B.bx, dt * 5); B.y = lerp(B.y, high, dt * 5);
            if (B.t <= 0) { B.state = 'beam'; Sound.play('roar'); }
            break;
        case 'beam': {
            B.bx += B.dir * (B.phase >= 2 ? 440 : 380) * dt; B.x = lerp(B.x, B.bx, dt * 6); B.y = lerp(B.y, high, dt * 5);
            if (Math.random() < 0.8) { const hy = gloomHitY(L, B.bx, B.y + B.r); G.parts.push({ x: B.bx + rand(-12, 12), y: hy - 2, vx: rand(-60, 60), vy: rand(-200, -60), life: 0.4, max: 0.4, size: rand(3, 6), color: '#b98aff', add: true, g: 500 }); }
            if (!p.dead && p.dashT <= 0 && p.hurtT <= 0 && Math.abs(p.x - B.bx) < 22 && p.y > B.y && gloomHitY(L, p.x, B.y + B.r) > p.y - p.h / 2) hurt(G, 'enemy', { x: B.bx, y: p.y + 30, shadow: true });
            if ((B.dir > 0 && B.bx > B.ax1 - 20) || (B.dir < 0 && B.bx < B.ax0 + 20)) { B.state = 'float'; B.t = 3 / speed; B.fireT = 1; }
            break;
        }
        case 'chargeW':     // warning: it flies high to the far wall, then drops into the lane (the lane is lit the whole time)
            if (B.t > 0.75) { B.x = lerp(B.x, B.sx, dt * 5); B.y = lerp(B.y, high, dt * 5); }
            else { B.x = lerp(B.x, B.sx, dt * 8); B.y = lerp(B.y, floorY - 36, dt * 8); B.x += Math.sin(B.wob * 60) * 1.5; }
            if (B.t <= 0) { B.state = 'charge'; B.y = floorY - 36; Sound.play('dash'); }
            break;
        case 'charge':
            B.x += B.dir * 900 * dt; B.y = floorY - 36;
            if (Math.random() < 0.8) G.parts.push({ x: B.x - B.dir * B.r, y: B.y + rand(-30, 30), vx: -B.dir * rand(60, 160), vy: rand(-40, 40), life: 0.4, max: 0.4, size: rand(3, 7), color: '#5a2a9a', add: false });
            if ((B.dir > 0 && B.x >= B.ax1 - B.r - 8) || (B.dir < 0 && B.x <= B.ax0 + B.r + 8)) {
                B.x = clamp(B.x, B.ax0 + B.r + 8, B.ax1 - B.r - 8); G.shake(10); Sound.play('stomp'); burst(G, B.x + B.dir * B.r, B.y, '#b98aff', 20, 240);
                if (B.phase >= 2 && !B.back) { B.back = true; B.dir = -B.dir; B.sx = B.x; B.state = 'chargeW'; B.t = 1.2; Sound.play('roar'); }    // up, and back down into the lane: then back again
                else { B.state = 'float'; B.t = 3 / speed; B.fireT = 1; }
            }
            break;
        case 'rainW':       // warning: up at the ceiling; every drop's landing spot is marked
            B.x = lerp(B.x, mid, dt * 4); B.y = lerp(B.y, high, dt * 4);
            if (B.t <= 0) { for (const d of B.drops) d.go = true; B.state = 'rain'; B.t = 1.1; Sound.play('shoot'); }
            break;
        case 'rain': B.y = lerp(B.y, high, dt * 4); if (B.t <= 0 && !B.drops.length) { B.state = 'float'; B.t = 3 / speed; B.fireT = 1; } break;
        case 'dying':
            B.r = Math.max(0, B.r - dt * 18); G.white = Math.min(1, G.white + dt * 0.35);
            if (Math.random() < 0.6) burst(G, B.x + rand(-40, 40), B.y + rand(-40, 40), '#fff2c4', 6, 260);
            if (B.t <= 0) {
                G.boss = null; G.white = 1; G.ambient = 0.15; UI.bossbar(null);
                UI.talk(GLOOM_TALK.end, () => { G.toast('The lanterns are lit!'); G.revealGate(); });
            }
            return;
    }
    // shockwaves along the floor
    for (const w of B.waves) {
        w.x += w.dir * 300 * dt; w.life -= dt;
        if (Math.random() < 0.7) G.parts.push({ x: w.x, y: floorY - 4, vx: rand(-30, 30), vy: rand(-160, -60), life: 0.4, max: 0.4, size: rand(3, 6), color: '#b98aff', add: true, g: 500 });
        if (!p.dead && Math.abs(p.x - w.x) < 14 && p.y + p.h / 2 > floorY - 22) hurt(G, 'enemy', { x: w.x - w.dir * 20, y: p.y });
    }
    B.waves = B.waves.filter(w => w.life > 0 && w.x > 0 && w.x < L.w * TS);
    // shadow drops
    for (const d of B.drops) {
        if (!d.go) continue;
        d.vy += 1600 * dt; d.y += d.vy * dt;
        if (d.y >= d.land) { d.dead = true; burst(G, d.x, d.land, '#b98aff', 10, 160); continue; }
        if (!p.dead && p.dashT <= 0 && Math.abs(p.x - d.x) < 18 && Math.abs(p.y - d.y) < 20) { d.dead = true; hurt(G, 'enemy', { x: d.x, y: d.y, shadow: true }); }
    }
    B.drops = B.drops.filter(d => !d.dead);
    // its light, thrown at you: dash into it and it flies back
    for (const l of B.lums) {
        l.life -= dt;
        if (l.back) { const a = Math.atan2(B.y - l.y, B.x - l.x); l.vx = Math.cos(a) * 560; l.vy = Math.sin(a) * 560; }
        else { const a = Math.atan2(p.y - l.y, p.x - l.x), v = Math.hypot(l.vx, l.vy); l.vx = lerp(l.vx, Math.cos(a) * v, dt * 0.5); l.vy = lerp(l.vy, Math.sin(a) * v, dt * 0.5); }
        l.x += l.vx * dt; l.y += l.vy * dt;
        if (Math.random() < 0.5) G.parts.push({ x: l.x, y: l.y, vx: rand(-30, 30), vy: rand(-30, 30), life: 0.3, max: 0.3, size: rand(2, 4), color: '#ffd36b', add: true });
        if (l.back) {
            if (Math.hypot(l.x - B.x, l.y - B.y) < B.r) {
                l.dead = true; burst(G, l.x, l.y, '#fff2c4', 30, 300); ring(G, B.x, B.y, '#ffd36b'); G.shake(10);
                if (['float', 'rise', 'hang', 'ringW', 'beamW', 'beam', 'chargeW', 'rainW', 'rain'].includes(B.state)) {
                    B.state = 'reel'; B.vy = -120; B.safeT = Math.max(B.safeT, 1.2); B.glint = 0; Sound.play('hurtBoss'); gloomSay(B, 'reflect');
                }
            }
            continue;
        }
        if (l.life <= 0 || solidAtPx(L, l.x, l.y)) { l.dead = true; burst(G, l.x, l.y, '#ffd36b', 8, 100); continue; }
        if (p.dead) continue;
        const d = Math.hypot(p.x - l.x, p.y - l.y);
        if (p.dashT > 0 && d < 34) { l.back = true; l.life = 4; Sound.play('spark', 7); burst(G, l.x, l.y, '#fff2c4', 14, 220); G.hitstop = 0.05; }
        else if (d < 15) { l.dead = true; hurt(G, 'enemy', { x: l.x, y: l.y, shadow: true }); }
    }
    B.lums = B.lums.filter(l => !l.dead && l.life > 0);
    // shadow orbs curve toward you a little
    for (const s of G.shots) if (s.home) { const a = Math.atan2(p.y - s.y, p.x - s.x), v = Math.hypot(s.vx, s.vy); s.vx = lerp(s.vx, Math.cos(a) * v, dt * s.home); s.vy = lerp(s.vy, Math.sin(a) * v, dt * s.home); }
    // touching it
    if (p.dead || B.state === 'dying' || B.state === 'talking') return;
    const d = Math.hypot(p.x - B.x, p.y - B.y);
    if (d < B.r + 8) {
        const open = B.state === 'stunned' && B.hitT <= 0, onTop = p.vy > -60 && p.y < B.y - B.r * 0.2;
        if (open && (p.dashT > 0 || onTop)) gloomHit(G, B);
        // never hurt just after a hit, by a stunned or falling-open body, or when you come down on top of it
        else if (B.safeT > 0 || B.state === 'stunned' || B.state === 'reel' || (onTop && p.y < B.y - B.r * 0.35)) bodyPush(p, B.x, B.y, B.r + 8, B.safeT > 0);
        else if (p.hurtT <= 0 && p.dashT <= 0) hurt(G, 'enemy', B);
    }
}
// 1.2: dying in the final fight starts the whole fight again: The Gloom is back at full health, its phases start over, the bats and
// shots are gone. (Nothing is kept from the failed try; only the "it already spoke" flag, so you are not made to sit through the talk.)
function bossReset(G) {
    const B = G.boss; if (!B || B.state === 'dying') return;
    const be = G.L.ents.find(e => e.kind === 'boss'); if (!be) return;
    G.boss = makeBoss(be); G.L.ents = G.L.ents.filter(e => !e.spawned); G.shots = []; G.ambient = null; UI.bossbar(null);
}
function findFloor(L, x) { const tx = Math.floor(x / TS); for (let y = 2; y < L.h; y++) if (isSolidT(L, tx, y)) return y * TS; return L.h * TS; }
// the warnings and new attacks, drawn under the body
function drawGloomFx(x, G, t) {
    const B = G.boss, L = G.L, fl = Math.sin(t * 22) > 0, s = B.state;
    x.save();
    if (s === 'beamW' || s === 'beam') {
        const hy = gloomHitY(L, B.bx, B.y + B.r), top = B.y + B.r * 0.4;
        if (s === 'beamW') {        // a thin flickering line where the sweep starts, an arrow the way it will go, and the ledges' shelter
            x.globalAlpha = 0.35 + 0.35 * fl; x.strokeStyle = '#c9a0ff'; x.lineWidth = 2; x.setLineDash([8, 6]); x.beginPath(); x.moveTo(B.bx, top); x.lineTo(B.bx, hy); x.stroke(); x.setLineDash([]);
            x.fillStyle = '#c9a0ff'; x.beginPath(); const ay = hy - 40; x.moveTo(B.bx + B.dir * 30, ay); x.lineTo(B.bx + B.dir * 10, ay - 10); x.lineTo(B.bx + B.dir * 10, ay + 10); x.fill();
        } else {
            const g = x.createLinearGradient(B.bx - 20, 0, B.bx + 20, 0); g.addColorStop(0, 'rgba(90,40,160,0)'); g.addColorStop(0.5, 'rgba(150,90,255,.85)'); g.addColorStop(1, 'rgba(90,40,160,0)');
            x.fillStyle = g; x.beginPath(); x.moveTo(B.x - 14, top); x.lineTo(B.x + 14, top); x.lineTo(B.bx + 20, hy); x.lineTo(B.bx - 20, hy); x.fill();
            x.globalAlpha = 0.85; x.fillStyle = '#efe2ff'; x.beginPath(); x.moveTo(B.x - 3, top); x.lineTo(B.x + 3, top); x.lineTo(B.bx + 5, hy); x.lineTo(B.bx - 5, hy); x.fill();
        }
    }
    if (s === 'chargeW') {          // the lane it will rush along, with arrows
        const y = B.floor - 36; x.globalAlpha = (0.12 + 0.12 * fl) * Math.min(1, (1.4 - B.t) * 2 + 0.4); x.fillStyle = '#b98aff'; x.fillRect(B.ax0, y - B.r, B.ax1 - B.ax0, B.r * 2);
        x.globalAlpha = 0.5 + 0.3 * fl; x.fillStyle = '#e6d4ff';
        for (let i = 0; i < 6; i++) { const ax = B.ax0 + (i + 0.5) * (B.ax1 - B.ax0) / 6, d = -B.dir; x.beginPath(); x.moveTo(ax + d * 14, y); x.lineTo(ax - d * 6, y - 11); x.lineTo(ax - d * 6, y + 11); x.fill(); }
    }
    if (s === 'ringW') {            // the ring drawn faintly, its gap lit gold, and a light on the floor where the gap will pass
        const n = 20, st = Math.PI * 2 / n, rr = B.r + 22 + 6 * Math.sin(t * 8);
        x.fillStyle = '#b98aff'; x.globalAlpha = 0.5 + 0.3 * fl;
        for (let i = 2; i <= n - 2; i++) { const a = B.gap + i * st; x.beginPath(); x.arc(B.x + Math.cos(a) * rr, B.y + Math.sin(a) * rr, 5, 0, 7); x.fill(); }
        x.globalAlpha = 0.35 + 0.2 * fl; x.fillStyle = '#ffd36b'; x.beginPath(); x.moveTo(B.x, B.y); x.arc(B.x, B.y, rr + 30, B.gap - st * 1.5, B.gap + st * 1.5); x.fill();
        x.globalAlpha = 0.5 + 0.3 * fl; x.beginPath(); x.ellipse(B.gx, B.floor - 3, 22, 5, 0, 0, 7); x.fill();
    }
    for (const d of B.drops) {      // the marks where drops land, then the drops
        x.globalAlpha = 0.45 + 0.35 * (Math.sin(t * 20 + d.x) > 0); x.fillStyle = '#7a3ad0'; x.beginPath(); x.ellipse(d.x, d.land - 2, 16, 5, 0, 0, 7); x.fill();
        if (!d.go) { x.globalAlpha = 0.18; x.fillRect(d.x - 1, B.top, 2, d.land - B.top); }
        else { x.globalAlpha = 1; Sprites.shadowOrb(x, d, t); x.globalAlpha = 0.4; x.fillStyle = '#5a2a9a'; x.fillRect(d.x - 3, d.y - 26, 6, 20); }
    }
    for (const l of B.lums) {       // its light: a gold orb with a pulsing halo
        x.globalAlpha = 0.35 + 0.2 * Math.sin(t * 12); x.fillStyle = '#ffd36b'; x.beginPath(); x.arc(l.x, l.y, 16, 0, 7); x.fill();
        x.globalAlpha = 1; x.fillStyle = l.back ? '#ffffff' : '#ffe9a8'; x.beginPath(); x.arc(l.x, l.y, 8, 0, 7); x.fill();
    }
    x.restore();
}
function drawBoss(x, G, t) {
    const B = G.boss; if (!B) return;
    if (B.ax0 !== undefined) drawGloomFx(x, G, t);
    x.save(); x.translate(B.x, B.y);
    if (B.state === 'hang' || B.state === 'rise') {         // where it will land
        x.save(); x.translate(0, (B.floor || 0) - B.y); x.globalAlpha = 0.35 + 0.25 * Math.sin(t * 20); x.fillStyle = '#000'; x.beginPath(); x.ellipse(0, 0, B.r * 1.1, 8, 0, 0, 7); x.fill(); x.restore();
    }
    const r = B.r, open = B.state === 'stunned', hit = B.hitT > 0, gold = B.glint > 0;
    // tendrils
    x.strokeStyle = 'rgba(60,20,110,.75)'; x.lineWidth = 6; x.lineCap = 'round';
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + t * 0.6; x.beginPath(); x.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); x.quadraticCurveTo(Math.cos(a + 0.5) * r * 1.3, Math.sin(a + 0.5) * r * 1.3, Math.cos(a + Math.sin(t * 2 + i)) * r * 1.5, Math.sin(a + Math.sin(t * 2 + i)) * r * 1.5); x.stroke(); }
    // body: overlapping dark blobs
    for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2 + t * 0.8, bx = Math.cos(a) * r * 0.35, by = Math.sin(a) * r * 0.3, br = r * (0.65 + 0.12 * Math.sin(t * 3 + i));
        const g = x.createRadialGradient(bx, by, 2, bx, by, br); g.addColorStop(0, hit ? '#ffffff' : '#2a0e4a'); g.addColorStop(0.7, hit ? '#c9a0ff' : '#1a0630'); g.addColorStop(1, 'rgba(20,4,40,0)');
        x.fillStyle = g; x.beginPath(); x.arc(bx, by, br, 0, 7); x.fill();
    }
    // the trapped light: an eye that opens when it is stunned (and flashes gold just before it throws its light)
    const eo = open || gold ? 1 : 0.25 + 0.1 * Math.sin(t * 5);
    const g = x.createRadialGradient(0, -4, 1, 0, -4, gold ? 30 : 22); g.addColorStop(0, '#fffbe6'); g.addColorStop(0.4, open || gold ? '#ffd36b' : '#c9a0ff'); g.addColorStop(1, 'rgba(255,200,120,0)');
    x.fillStyle = g; x.beginPath(); x.ellipse(0, -4, 22, 22 * eo, 0, 0, 7); x.fill();
    x.fillStyle = '#12021e'; x.beginPath(); x.ellipse(sign(G.p.x - B.x) * 5, -4, 5, 9 * eo, 0, 0, 7); x.fill();
    if (open) { x.fillStyle = '#fff'; x.font = 'bold 16px sans-serif'; x.textAlign = 'center'; x.globalAlpha = 0.6 + 0.4 * Math.sin(t * 10); x.fillText('!', 0, -r - 10); }
    x.restore();
    // health bar under the boss
    x.save(); const bw = 140; x.translate(B.x - bw / 2, B.y + r + 18);
    x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(0, 0, bw, 7); x.fillStyle = '#c9a0ff'; x.fillRect(0, 0, bw * B.hp / B.max, 7); x.restore();
    drawSay(x, B.x, B.y - r - 34, B.say);
}
