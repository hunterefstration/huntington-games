// ==========================================
// PLAYER + EVERYTHING ELSE THAT MOVES
// Feel: coyote time, jump buffering, variable jump height, corner nudges, squash and stretch.
// ==========================================
const PH = { g: 2050, fall: 880, run: 270, accG: 2900, accA: 1900, fricG: 3000, fricA: 700, jump: 690, djump: 610,
    wallFall: 140, wallJumpX: 320, wallJumpY: 650, dash: 760, dashT: 0.17, spring: 1080, coyote: 0.1, buffer: 0.13, stomp: 470 };

function makePlayer(x, y) {
    return { x, y, w: 18, h: 24, vx: 0, vy: 0, face: 1, ground: false, coyote: 0, buffer: 0, air: 0, wall: 0, wallT: 0, wallLock: 0,
        dashT: 0, dashDir: 0, dashDY: 0, canDash: true, cut: false, sx: 1, sy: 1, hurtT: 0, hearts: 3, dead: false, deadT: 0,
        on: null, safe: { x, y }, safeT: 0, keys: 0, blinkSeed: Math.random() * 9, trailT: 0, runDust: 0, landV: 0 };
}
const pBox = p => ({ x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h });
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function updatePlayer(G, dt) {
    const p = G.p, L = G.L, A = SAVE.d.abilities;
    if (p.dead) { p.deadT -= dt; if (p.deadT <= 0 && !G.deathShown) { G.deathShown = true; UI.died(); } return; }
    if (G.outro) { const o = G.outro; o.t += dt; p.x = lerp(p.x, o.x, Math.min(1, dt * 5)); p.y = lerp(p.y, o.y, Math.min(1, dt * 5)); p.vx = p.vy = 0;
        if (Math.random() < 0.5) burst(G, p.x + rand(-20, 20), p.y + rand(-20, 20), '#fff2c4', 1, 80, true); return; }
    ST('dist', Math.abs(p.vx) * dt / TS);
    // hold down for a moment on a thin ledge to drop through it (down + jump works too)
    p.downT = Input.held('down') && p.ground ? (p.downT || 0) + dt : 0;
    if (p.downT > 0.15) { p.dropT = 0.22; p.downT = 0; }
    p.dropT = Math.max(0, (p.dropT || 0) - dt);
    const dir = (Input.held('right') ? 1 : 0) - (Input.held('left') ? 1 : 0);
    if (Input.hit('jump')) p.buffer = PH.buffer;
    p.buffer = Math.max(0, p.buffer - dt); p.coyote = Math.max(0, p.coyote - dt); p.wallT = Math.max(0, p.wallT - dt);
    p.wallLock = Math.max(0, p.wallLock - dt); p.hurtT = Math.max(0, p.hurtT - dt);
    // dash
    if (Input.hit('dash') && A.dash && p.canDash && p.dashT <= 0) {
        p.dashT = PH.dashT; p.canDash = false; p.dashDir = dir || p.face; p.dashDY = Input.held('up') ? -1 : 0;
        p.vy = 0; p.sx = 1.35; p.sy = 0.7; G.shake(4); Sound.play('dash'); G.stats.dashes++; ST('dashes');
        burst(G, p.x, p.y, '#ffe9a8', 14, 220);
    }
    if (p.dashT > 0) {
        p.dashT -= dt;
        p.vx = p.dashDir * PH.dash * (p.dashDY ? 0.72 : 1); p.vy = p.dashDY * PH.dash * 0.72;
        if (Math.random() < 0.9) G.ghosts.push({ x: p.x, y: p.y, face: p.face, sx: p.sx, sy: p.sy, life: 0.22 });
        if (p.dashT <= 0) { p.vx *= 0.45; if (p.dashDY) p.vy *= 0.4; }
    } else {
        // run
        const target = dir * PH.run;
        if (p.wallLock <= 0) {
            if (dir) { p.vx = approach(p.vx, target, (p.ground ? PH.accG : PH.accA) * dt * (sign(p.vx) !== dir && p.vx !== 0 ? 1.6 : 1)); p.face = dir; }
            else p.vx = approach(p.vx, 0, (p.ground ? PH.fricG : PH.fricA) * dt);
        }
        // gravity, wall slide
        p.vy = Math.min(p.vy + PH.g * dt * (p.vy > 0 ? 1.18 : 1), PH.fall);
        p.wall = 0;
        if (!p.ground && A.wall) {
            const b = pBox(p);
            if (boxSolid(L, b.x - 2, b.y + 4, 2, b.h - 8)) p.wall = -1; else if (boxSolid(L, b.x + b.w, b.y + 4, 2, b.h - 8)) p.wall = 1;
            if (p.wall) { p.wallT = 0.12; p.wallDir = p.wall; p.canDash = true; }
            if (p.wall && dir === p.wall && p.vy > PH.wallFall) { p.vy = PH.wallFall; if (Math.random() < 0.3) dust(G, p.x + p.wall * 9, p.y + 4, 1); }
        }
        // jump: from the ground (or just after leaving it), off a wall, or in the air
        if (p.buffer > 0) {
            if (p.ground || p.coyote > 0) {
                p.vy = -PH.jump; p.ground = false; p.coyote = 0; p.buffer = 0; p.cut = false; p.on = null;
                p.sx = 0.72; p.sy = 1.32; Sound.play('jump'); dust(G, p.x, p.y + 12, 6); G.stats.jumps++; ST('jumps');
            } else if (A.wall && p.wallT > 0) {
                p.vy = -PH.wallJumpY; p.vx = -p.wallDir * PH.wallJumpX; p.face = -p.wallDir; p.wallLock = 0.15; p.buffer = 0; p.cut = false; p.wallT = 0;
                p.sx = 0.75; p.sy = 1.28; Sound.play('walljump'); ST('walljumps'); dust(G, p.x + p.wallDir * 10, p.y, 6);
            } else if (A.double && p.air > 0) {
                p.vy = -PH.djump; p.air--; p.buffer = 0; p.cut = false; p.sx = 0.7; p.sy = 1.35; Sound.play('djump'); ST('djumps');
                ring(G, p.x, p.y + 10, '#bff7ff');
            }
        }
        if (!Input.held('jump') && p.vy < -220 && !p.cut && !p.springing) { p.vy *= 0.5; p.cut = true; }
    }
    // move: x then y, against the level
    const wasGround = p.ground, vyBefore = p.vy;
    moveX(G, p.vx * dt);
    moveY(G, p.vy * dt);
    if (p.on) { const m = p.on; moveX(G, m.dx); p.y = m.y - p.h / 2 - 0.01; if (!(p.x + p.w / 2 > m.x && p.x - p.w / 2 < m.x + m.w)) { p.on = null; p.ground = false; } }
    if (p.ground) {
        p.coyote = PH.coyote; p.air = A.double ? 1 : 0; p.springing = false; if (p.dashT <= 0) p.canDash = true;
        if (!wasGround) { const k = clamp(vyBefore / 900, 0.15, 0.6); p.sx = 1 + k; p.sy = 1 - k * 0.8; if (vyBefore > 400) { dust(G, p.x, p.y + 12, 8); Sound.play('land'); } }
        if (Math.abs(p.vx) > 120) { p.runDust -= dt; if (p.runDust <= 0) { p.runDust = 0.12; dust(G, p.x - p.face * 6, p.y + 12, 1); } }
        // remember a safe spot to come back to after a fall into spikes or a pit
        p.safeT += dt;
        if (p.safeT > 0.3 && !p.on && isSolidT(L, Math.floor((p.x - 8) / TS), Math.floor((p.y + 14) / TS)) && isSolidT(L, Math.floor((p.x + 8) / TS), Math.floor((p.y + 14) / TS))) p.safe = { x: p.x, y: p.y };
    } else p.safeT = 0;
    // squash and stretch settle back
    p.sx = lerp(p.sx, 1, Math.min(1, dt * 14)); p.sy = lerp(p.sy, 1, Math.min(1, dt * 14));
    if (!p.ground && p.dashT <= 0) { const st = clamp(Math.abs(p.vy) / 2600, 0, 0.18); p.sy = Math.max(p.sy, 1 + st * 0.5); p.sx = Math.min(p.sx, 1 - st * 0.4); }
    // trail of light when moving fast
    p.trailT -= dt;
    if (p.trailT <= 0 && (Math.abs(p.vx) > 150 || Math.abs(p.vy) > 300)) { p.trailT = 0.03; G.parts.push({ x: p.x + rand(-4, 4), y: p.y + rand(-2, 6), vx: -p.vx * 0.05, vy: rand(-20, 10), life: 0.45, max: 0.45, size: rand(2, 4), color: '#ffd98a', add: true }); }
    // hazards
    if (p.hurtT <= 0 || true) hazards(G);
    if (p.y > L.h * TS + 24) hurt(G, 'pit');
}
function moveX(G, d) {
    const p = G.p, L = G.L; if (!d) return;
    const steps = Math.ceil(Math.abs(d) / 10), s = d / steps;
    for (let i = 0; i < steps; i++) {
        p.x += s; const b = pBox(p);
        if (boxSolid(L, b.x, b.y, b.w, b.h)) {
            // corner nudge: clipping a ledge by a few pixels while rising/falling slips past it instead of stopping dead
            for (const ny of [-4, -8, 4]) { if (!boxSolid(L, b.x, b.y + ny, b.w, b.h) && Math.abs(p.vy) > 60 && (ny < 0 ? p.vy < 0 || p.ground : p.vy > 0)) { p.y += ny; return; } }
            if (s > 0) p.x = Math.floor((b.x + b.w) / TS) * TS - p.w / 2 - 0.01; else p.x = (Math.floor(b.x / TS) + 1) * TS + p.w / 2 + 0.01;
            if (p.dashT > 0 && Math.abs(p.vx) > 400) { G.shake(3); }
            p.vx = 0; return;
        }
    }
}
function moveY(G, d) {
    const p = G.p, L = G.L;
    p.ground = false;
    const steps = Math.max(1, Math.ceil(Math.abs(d) / 10)), s = d / steps;
    for (let i = 0; i < steps; i++) {
        const oldBottom = p.y + p.h / 2;
        p.y += s; const b = pBox(p);
        if (boxSolid(L, b.x, b.y, b.w, b.h)) {
            if (s > 0) { p.y = Math.floor((b.y + b.h) / TS) * TS - p.h / 2 - 0.01; p.ground = true; landedOn(G); }
            else {
                // bumping a corner with the head: nudge sideways instead of stopping
                for (const nx of [-5, 5, -9, 9]) if (!boxSolid(L, b.x + nx, b.y, b.w, b.h)) { p.x += nx; return; }
                p.y = (Math.floor(b.y / TS) + 1) * TS + p.h / 2 + 0.01; p.cut = true;
            }
            p.vy = 0; return;
        }
        if (s >= 0 && !(p.dropT > 0) && !(Input.held('down') && Input.held('jump'))) {
            const led = ledgeBelow(L, b.x, b.w, oldBottom, b.y + b.h);
            if (led) { p.y = led.y - p.h / 2 - 0.01; p.vy = 0; p.ground = true; p.on = led.mover || null; landedOn(G); return; }
        }
    }
    // standing still on a moving ledge or a one-way: keep the ground flag
    if (d === 0 || p.on) { const b = pBox(p); if (boxSolid(L, b.x, b.y + 1, b.w, b.h)) p.ground = true; }
}
function landedOn(G) {
    const p = G.p;
    // crumbling blocks start to shake when stood on
    const ty = Math.floor((p.y + p.h / 2 + 2) / TS);
    for (const c of G.L.crumbles) if (c.state === 0 && c.ty === ty && p.x + p.w / 2 > c.x && p.x - p.w / 2 < c.x + TS) { c.state = 1; c.t = 0.35; }
}
function hazards(G) {
    const p = G.p, L = G.L, b = pBox(p), hb = { x: b.x + 3, y: b.y + 4, w: b.w - 6, h: b.h - 6 };
    const x0 = Math.floor(hb.x / TS), x1 = Math.floor((hb.x + hb.w) / TS), y0 = Math.floor(hb.y / TS), y1 = Math.floor((hb.y + hb.h) / TS);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        const t = tileAt(L, tx, ty);
        if (t === T_SPIKE) {
            const s = L.spikes.find(q => q.tx === tx && q.ty === ty); const r = s ? s.rot : 0;
            const box = r === 0 ? { x: tx * TS + 3, y: ty * TS + 14, w: TS - 6, h: 18 } : Math.abs(r - Math.PI) < 0.1 ? { x: tx * TS + 3, y: ty * TS, w: TS - 6, h: 18 }
                : r > 0 ? { x: tx * TS, y: ty * TS + 3, w: 18, h: TS - 6 } : { x: tx * TS + 14, y: ty * TS + 3, w: 18, h: TS - 6 };
            if (overlap(hb, box)) return hurt(G, 'spike');
        } else if (t === T_LAVA && overlap(hb, { x: tx * TS, y: ty * TS + 10, w: TS, h: TS - 10 })) return hurt(G, 'lava');
    }
}
// hazards send you back to the last safe ground; enemies knock you back. No hearts left: back to the last lantern.
function hurt(G, why, from) {
    const p = G.p;
    if (p.dead || G.done) return;
    if (p.hurtT > 0 && why === 'enemy') return;
    // a pit is the end of that life, straight away; everything else costs a heart
    p.hearts = why === 'pit' ? 0 : p.hearts - 1; G.stats.hits++; ST('hits');
    G.shake(why === 'enemy' ? 6 : 9); G.flash = 0.35;
    if (p.hearts <= 0) {
        p.dead = true; p.deadT = 0.9; G.stats.deaths++; SAVE.d.deaths++; ST('deaths');
        G.cause = why !== 'enemy' ? why : from === G.boss ? 'boss' : from && from.kind ? from.kind : from && from.shadow ? 'boss' : 'turret';
        ST('death_' + (G.cause === 'pit' || G.cause === 'spike' || G.cause === 'lava' ? G.cause : 'enemy'));
        Sound.play('die'); burst(G, p.x, p.y, '#ffd36b', 40, 340); burst(G, p.x, p.y, '#ffffff', 16, 200);
        return;
    }
    Sound.play('hurt'); p.hurtT = 1.3;
    if (why === 'enemy' && from) { p.vx = sign(p.x - from.x || 1) * 280; p.vy = -380; p.dashT = 0; }
    else {
        burst(G, p.x, p.y, '#ffd36b', 16, 220);
        p.x = p.safe.x; p.y = p.safe.y; p.vx = 0; p.vy = 0; p.dashT = 0; p.on = null;
        G.cam.snap = 0.15;
    }
    G.hud();
}
function respawn(G, full = true) {
    const p = G.p, c = G.checkpoint; G.deathShown = false;
    Object.assign(p, makePlayer(c.x, c.y), { keys: p.keys, hearts: G.maxHearts() });
    G.cam.snap = 0.2; G.hud(); p.spawnT = 0.6; G.iris = 0.35;
    burst(G, p.x, p.y, '#fff2c4', 22, 180);
    guardReset(G);
}

// ---------- enemies, items, moving bits ----------
function updateWorld(G, dt) {
    const p = G.p, L = G.L, t = G.t, pb = pBox(p);
    for (const m of L.movers) {
        const ox = m.x, oy = m.y;
        if (m.kind === 'M') { m.x += m.dir * m.speed * dt; if (m.x <= m.min) { m.x = m.min; m.dir = 1; } else if (m.x >= m.max) { m.x = m.max; m.dir = -1; } }
        else { m.y += m.dir * m.speed * dt; if (m.y <= m.min) { m.y = m.min; m.dir = 1; } else if (m.y >= m.max) { m.y = m.max; m.dir = -1; } }
        m.dx = m.x - ox; m.dy = m.y - oy;
    }
    for (const c of L.crumbles) {
        if (c.state === 1) { c.shake = true; c.t -= dt; if (c.t <= 0) { c.state = 3; c.t = 3; c.shake = false; Sound.play('crumble'); for (let i = 0; i < 8; i++) G.parts.push({ x: c.x + rand(TS), y: c.y + rand(TS), vx: rand(-60, 60), vy: rand(-80, 40), life: 0.8, max: 0.8, size: rand(3, 6), color: WORLDS[G.world].plat, g: 900, sq: true }); } }
        else if (c.state === 3) { c.alpha = 0; c.t -= dt; if (c.t <= 0 && !overlap(pb, { x: c.x, y: c.y, w: TS, h: TS })) { c.state = 0; c.alpha = 1; } }
        else c.alpha = Math.min(1, c.alpha + dt * 3);
    }
    for (const d of L.doors) if (d.open) d.slide = Math.min(1, d.slide + dt * 2); else if (d.slide > 0) d.slide = Math.max(0, d.slide - dt * 5);
    for (const e of L.ents) {
        if (e.gone) continue;
        if (e.dying !== undefined) { e.dying -= dt; if (e.dying <= 0) { e.gone = true; popEnemy(G, e); } continue; }     // squashed, about to pop
        switch (e.kind) {
            case 'spark': if (near(p, e, 20)) { e.gone = true; G.got.sparks++; SAVE.d.sparks++; Sound.play('spark', G.got.sparks); burst(G, e.x, e.y, '#ffd36b', 8, 120, true); G.hud(); } break;
            case 'moth':        // a star: it flares, spins up and bursts when you catch it
                if (e.got !== undefined) { e.got -= dt; if (e.got <= 0) { e.gone = true; burst(G, e.x, e.y - 20, '#fff6c0', 30, 260, true); } }
                else if (near(p, e, 22)) { e.got = 0.55; G.got.moths[e.idx] = true; ST('mothsCaught'); Sound.play('moth'); burst(G, e.x, e.y, '#ffe9a0', 16, 160, true); G.toast('Star ' + (G.got.moths.filter(Boolean).length) + ' of ' + G.L.moths); G.hud(); }
                break;
            case 'memory': if (near(p, e, 22) && !p.dead) { e.gone = true; Sound.play('memory'); burst(G, e.x, e.y, '#d8c0ff', 30, 200, true); UI.memory(e.lid || G.L.def.id); } break;
            case 'key': if (near(p, e, 20)) { e.gone = true; p.keys++; Sound.play('key'); burst(G, e.x, e.y, '#ffd36b', 12, 140, true); G.toast('A key! It opens a door.'); } break;
            case 'lantern':
                if (!e.lit && Math.abs(p.x - e.x) < 26 && Math.abs(p.y - e.y) < 40) {
                    e.lit = true; G.checkpoint = { x: e.x, y: e.y }; p.hearts = G.maxHearts(); ST('lanterns'); Sound.play('lantern'); burst(G, e.x + 12, e.y - 14, '#ffe9a8', 26, 160, true); G.hud();
                    for (const o of L.ents) if (o.kind === 'lantern' && o !== e && o.lit && o.x < e.x) o.lit = true;
                }
                break;
            case 'spring':
                e.boing = Math.max(0, (e.boing || 0) - dt * 4);
                if (p.vy >= 0 && Math.abs(p.x - e.x) < 18 && p.y + p.h / 2 > e.y + 2 && p.y + p.h / 2 < e.y + 18) {
                    p.vy = -PH.spring; p.y = e.y + 2 - p.h / 2; p.ground = false; p.on = null; p.springing = true; p.air = SAVE.d.abilities.double ? 1 : 0; p.canDash = true;
                    e.boing = 1; p.sx = 0.65; p.sy = 1.45; Sound.play('spring'); dust(G, e.x, e.y + 10, 6);
                }
                break;
            case 'gate': if (near(p, e, 24) && !G.done && !G.bossAlive()) G.finish(); break;
            case 'shrine': if (!e.used && near(p, e, 26)) G.shrine(e); break;
            case 'slime': case 'thorn': walker(G, e, dt); break;
            case 'bat': e.x = e.sx + Math.sin(t * 1.2 + e.seed) * 62; e.y = e.sy + Math.sin(t * 2.3 + e.seed) * 24; e.dir = Math.cos(t * 1.2 + e.seed) > 0 ? 1 : -1; contact(G, e, 13); break;
            case 'turret': turret(G, e, dt); contact(G, e, 14); break;
        }
    }
    // turret orbs
    for (const b of G.shots) {
        if (b.g) b.vy += b.g * dt;
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        if (solidAtPx(L, b.x, b.y) || b.life <= 0) { b.dead = true; burst(G, b.x, b.y, b.col || (b.shadow ? '#a070ff' : '#ffd36b'), 6, 90); continue; }
        if (!p.dead && Math.hypot(p.x - b.x, p.y - b.y) < 13) { b.dead = true; if (p.dashT > 0) continue; hurt(G, 'enemy', b); }
    }
    G.shots = G.shots.filter(b => !b.dead);
    for (const k of L.doors) if (!k.open && !k.boss && p.keys > 0 && Math.abs(p.x - (k.x + TS / 2)) < TS && p.y > k.y - TS && p.y < k.y + k.h * TS + TS) { k.open = true; p.keys--; Sound.play('door'); G.shake(5); }
}
const near = (p, e, r) => Math.abs(p.x - e.x) < r && Math.abs(p.y - e.y) < r + 4;
function walker(G, e, dt) {
    const L = G.L, sp = e.kind === 'thorn' ? 95 : 62;
    if (e.dir === undefined) e.dir = Math.random() < 0.5 ? -1 : 1;
    if (e.dead) return;
    e.squash = Math.max(0, (e.squash || 0) - dt * 4);
    const ahead = e.x + e.dir * 14, foot = e.y + 18;
    if (solidAtPx(L, ahead, e.y) || !(solidAtPx(L, ahead, foot) || tileAt(L, Math.floor(ahead / TS), Math.floor(foot / TS)) === T_ONEWAY)) e.dir *= -1;
    else e.x += e.dir * sp * dt;
    contact(G, e, 14);
}
function turret(G, e, dt) {
    const p = G.p, dx = p.x - e.x, dy = p.y - (e.y - 2), d = Math.hypot(dx, dy);
    e.aim = lerp(e.aim || 0, Math.atan2(dy, dx), Math.min(1, dt * 4));
    e.cool = (e.cool ?? (1 + e.seed % 1.5)) - dt;
    if (d < TS * 12 && !p.dead) {
        if (e.cool < 0.5) e.charge = Math.min(1, (e.charge || 0) + dt * 2);
        if (e.cool <= 0) { e.cool = 1.6; e.charge = 0; const a = e.aim; G.shots.push({ x: e.x + Math.cos(a) * 14, y: e.y - 2 + Math.sin(a) * 14, vx: Math.cos(a) * 215, vy: Math.sin(a) * 215, life: 5 }); Sound.play('shoot'); }
    } else e.charge = Math.max(0, (e.charge || 0) - dt);
}
// touching an enemy: from above it is a stomp (not the spiky ones), a dash goes straight through anything, else it hurts
function contact(G, e, r) {
    const p = G.p; if (p.dead || e.dead) return;
    if (Math.abs(p.x - e.x) > r + 8 || Math.abs(p.y - e.y) > r + 12) return;
    if (p.dashT > 0) return kill(G, e);
    const fromAbove = p.vy > 60 && p.y + p.h / 2 < e.y + 2;
    if (fromAbove && e.kind !== 'thorn') { kill(G, e); p.vy = Input.held('jump') ? -PH.stomp * 1.25 : -PH.stomp; p.air = SAVE.d.abilities.double ? 1 : 0; p.canDash = true; p.cut = false; p.sx = 1.3; p.sy = 0.75; return; }
    if (p.hurtT <= 0) hurt(G, 'enemy', e);
}
// a stomp: a tiny freeze, the enemy squashes flat for a moment, then pops
function kill(G, e) {
    e.dead = true; e.dying = 0.22; G.stats.stomps++; ST('kills');
    Sound.play('stomp'); G.shake(4); G.hitstop = Math.max(G.hitstop || 0, 0.06);
    ring(G, e.x, e.y + 12, '#fff3c4'); burst(G, e.x, e.y - 6, '#fff3c4', 8, 140, true);
}
function popEnemy(G, e) {
    const T = WORLDS[G.world], col = e.kind === 'slime' ? T.slime[0] : e.kind === 'bat' ? '#8a5aba' : e.kind === 'turret' ? '#ff7ab8' : '#b8481c';
    for (let i = 0; i < 16; i++) G.parts.push({ x: e.x, y: e.y, vx: rand(-200, 200), vy: rand(-320, -40), life: 0.7, max: 0.7, size: rand(3, 6), color: col, g: 900 });
    for (let i = 0; i < 5; i++) G.parts.push({ x: e.x, y: e.y, vx: rand(-120, 120), vy: rand(-260, -120), life: 0.8, max: 0.8, size: rand(4, 6), color: '#ffe08a', g: 500, star: true });
    burst(G, e.x, e.y, '#fff3c4', 10, 160, true); Sound.play('pop');
}

// ---------- particles ----------
function dust(G, x, y, n) { for (let i = 0; i < n; i++) G.parts.push({ x: x + rand(-6, 6), y, vx: rand(-60, 60), vy: rand(-60, -10), life: 0.45, max: 0.45, size: rand(3, 6), color: 'rgba(255,255,255,.55)', drag: 3 }); }
function burst(G, x, y, color, n, sp, add) { for (let i = 0; i < n; i++) { const a = rand(Math.PI * 2), v = rand(sp * 0.3, sp); G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.35, 0.8), max: 0.8, size: rand(2, 5), color, add: add !== false, drag: 2.5 }); } }
function ring(G, x, y, color) { G.rings.push({ x, y, r: 6, life: 0.35, color }); }
function updateParts(G, dt) {
    for (const q of G.parts) { q.life -= dt; q.vy += (q.g || 0) * dt; if (q.drag) { q.vx *= 1 - q.drag * dt; q.vy *= 1 - q.drag * dt; } q.x += q.vx * dt; q.y += q.vy * dt; }
    if (G.parts.length > 900) G.parts.splice(0, G.parts.length - 900);
    G.parts = G.parts.filter(q => q.life > 0);
    for (const g of G.ghosts) g.life -= dt; G.ghosts = G.ghosts.filter(g => g.life > 0);
    for (const r of G.rings) { r.life -= dt; r.r += dt * 120; } G.rings = G.rings.filter(r => r.life > 0);
}
