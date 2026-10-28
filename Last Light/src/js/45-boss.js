// ==========================================
// THE GLOOM: the last boss. A cloud of shadow with a light trapped inside.
//   float: drifts above the arena and throws shadow orbs that curve toward you
//   slam:  rises, hangs over you (a shadow marks the spot), crashes down and sends shockwaves along the floor (jump them)
//   stunned: after a slam its core glows - stomp it or dash into it. Six hits; it gets faster and calls bats after each pair.
// ==========================================
function makeBoss(e) { return { x: e.x, y: e.y - 60, hx: e.x, hy: e.y - 60, r: 46, hp: 6, max: 6, state: 'intro', t: 2.2, stun: 0, hitT: 0, phase: 0, waves: [], fireT: 1.5, wob: 0 }; }
function bossUpdate(G, dt) {
    const B = G.boss, p = G.p; if (!B) return;
    B.wob += dt; B.hitT = Math.max(0, B.hitT - dt);
    const L = G.L, floorY = B.floor || (B.floor = findFloor(L, B.hx)), speed = 1 + B.phase * 0.25;
    B.t -= dt;
    switch (B.state) {
        case 'intro': B.y = lerp(B.y, B.hy, dt * 2); if (B.t <= 0) { B.state = 'float'; B.t = 4.5 / speed; } break;
        case 'float': {
            const tx = clamp(p.x, TS * 4, L.w * TS - TS * 4) + Math.sin(B.wob * 0.9) * 120;
            B.x = lerp(B.x, tx, dt * 0.9 * speed); B.y = lerp(B.y, B.hy + Math.sin(B.wob * 1.6) * 30, dt * 2);
            B.fireT -= dt;
            if (B.fireT <= 0) {
                B.fireT = 1.2 / speed; const n = 2 + B.phase;
                for (let i = 0; i < n; i++) { const a = Math.atan2(p.y - B.y, p.x - B.x) + (i - (n - 1) / 2) * 0.35; G.shots.push({ x: B.x, y: B.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, life: 6, shadow: true, home: 0.9 }); }
                Sound.play('shoot');
            }
            if (B.t <= 0) { B.state = 'rise'; B.t = 0.9; Sound.play('boss'); }
            break;
        }
        case 'rise': B.y = lerp(B.y, B.hy - 90, dt * 4); B.x = lerp(B.x, p.x, dt * 3); if (B.t <= 0) { B.state = 'hang'; B.t = 0.65 / Math.sqrt(speed); B.tx = p.x; } break;
        case 'hang': B.x = lerp(B.x, B.tx, dt * 6); if (B.t <= 0) { B.state = 'drop'; B.vy = 0; } break;
        case 'drop':
            B.vy = (B.vy || 0) + 3200 * dt; B.y += B.vy * dt;
            if (B.y + B.r * 0.75 >= floorY) {
                B.y = floorY - B.r * 0.75; B.state = 'stunned'; B.stun = 2.6; G.shake(14); Sound.play('boss');
                for (const d of [-1, 1]) B.waves.push({ x: B.x + d * B.r, dir: d, life: 2.6 });
                burst(G, B.x, floorY, '#b98aff', 30, 300);
            }
            break;
        case 'stunned':
            B.stun -= dt;
            if (B.stun <= 0) { B.state = 'float'; B.t = 4.5 / speed; B.fireT = 0.8; }
            break;
        case 'hurt': B.y = lerp(B.y, B.hy, dt * 3); if (B.t <= 0) { B.state = 'float'; B.t = 4 / speed; } break;
        case 'dying':
            B.r = Math.max(0, B.r - dt * 18); G.white = Math.min(1, G.white + dt * 0.35);
            if (Math.random() < 0.6) burst(G, B.x + rand(-40, 40), B.y + rand(-40, 40), '#fff2c4', 6, 260);
            if (B.t <= 0) {
                G.boss = null; G.white = 1; G.ambient = 0.15; G.toast('The Gloom is gone. Something was left behind...'); G.revealGate();
                G.L.ents.push({ kind: 'memory', x: B.x, y: floorY - 50, sx: B.x, sy: floorY - 50, seed: 3, lid: '5-1' });
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
    // shadow orbs curve toward you a little
    for (const s of G.shots) if (s.home) { const a = Math.atan2(p.y - s.y, p.x - s.x), v = Math.hypot(s.vx, s.vy); s.vx = lerp(s.vx, Math.cos(a) * v, dt * s.home); s.vy = lerp(s.vy, Math.sin(a) * v, dt * s.home); }
    // touching it
    if (p.dead || B.state === 'dying') return;
    const d = Math.hypot(p.x - B.x, p.y - B.y);
    if (d < B.r + 8) {
        const open = B.state === 'stunned';
        if (open && (p.dashT > 0 || (p.vy > 0 && p.y < B.y - B.r * 0.3))) {
            B.hp--; B.hitT = 0.4; G.shake(10); Sound.play('stomp'); burst(G, B.x, B.y - 20, '#fff2c4', 30, 300);
            p.vy = -PH.stomp * 1.2; p.vx = sign(p.x - B.x || 1) * 260; p.air = 1; p.canDash = true;
            if (B.hp <= 0) { B.state = 'dying'; B.t = 2.4; Sound.play('gate'); G.stats.boss = true; return; }
            if (B.hp % 2 === 0) {
                B.phase++; G.toast(B.phase === 1 ? 'It is getting angry...' : 'One last push!');
                for (let i = 0; i < 1 + B.phase; i++) G.L.ents.push({ kind: 'bat', x: B.x, y: B.hy, sx: TS * (6 + i * 9) % (G.L.w * TS - TS * 8) + TS * 4, sy: B.hy + 40, seed: rand(9) });
            }
            B.state = 'hurt'; B.t = 0.8; B.stun = 0; B.waves = [];
        } else if (p.hurtT <= 0 && p.dashT <= 0) hurt(G, 'enemy', B);
    }
}
function findFloor(L, x) { const tx = Math.floor(x / TS); for (let y = 2; y < L.h; y++) if (isSolidT(L, tx, y)) return y * TS; return L.h * TS; }
function drawBoss(x, G, t) {
    const B = G.boss; if (!B) return;
    x.save(); x.translate(B.x, B.y);
    if (B.state === 'hang' || B.state === 'rise') {         // where it will land
        x.save(); x.translate(0, (B.floor || 0) - B.y); x.globalAlpha = 0.35 + 0.25 * Math.sin(t * 20); x.fillStyle = '#000'; x.beginPath(); x.ellipse(0, 0, B.r * 1.1, 8, 0, 0, 7); x.fill(); x.restore();
    }
    const r = B.r, open = B.state === 'stunned', hit = B.hitT > 0;
    // tendrils
    x.strokeStyle = 'rgba(60,20,110,.75)'; x.lineWidth = 6; x.lineCap = 'round';
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + t * 0.6; x.beginPath(); x.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); x.quadraticCurveTo(Math.cos(a + 0.5) * r * 1.3, Math.sin(a + 0.5) * r * 1.3, Math.cos(a + Math.sin(t * 2 + i)) * r * 1.5, Math.sin(a + Math.sin(t * 2 + i)) * r * 1.5); x.stroke(); }
    // body: overlapping dark blobs
    for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2 + t * 0.8, bx = Math.cos(a) * r * 0.35, by = Math.sin(a) * r * 0.3, br = r * (0.65 + 0.12 * Math.sin(t * 3 + i));
        const g = x.createRadialGradient(bx, by, 2, bx, by, br); g.addColorStop(0, hit ? '#ffffff' : '#2a0e4a'); g.addColorStop(0.7, hit ? '#c9a0ff' : '#1a0630'); g.addColorStop(1, 'rgba(20,4,40,0)');
        x.fillStyle = g; x.beginPath(); x.arc(bx, by, br, 0, 7); x.fill();
    }
    // the trapped light: an eye that opens when it is stunned
    const eo = open ? 1 : 0.25 + 0.1 * Math.sin(t * 5);
    const g = x.createRadialGradient(0, -4, 1, 0, -4, 22); g.addColorStop(0, '#fffbe6'); g.addColorStop(0.4, open ? '#ffd36b' : '#c9a0ff'); g.addColorStop(1, 'rgba(255,200,120,0)');
    x.fillStyle = g; x.beginPath(); x.ellipse(0, -4, 22, 22 * eo, 0, 0, 7); x.fill();
    x.fillStyle = '#12021e'; x.beginPath(); x.ellipse(sign(G.p.x - B.x) * 5, -4, 5, 9 * eo, 0, 0, 7); x.fill();
    if (open) { x.fillStyle = '#fff'; x.font = 'bold 16px sans-serif'; x.textAlign = 'center'; x.globalAlpha = 0.6 + 0.4 * Math.sin(t * 10); x.fillText('!', 0, -r - 10); }
    x.restore();
    // health bar under the boss
    x.save(); const bw = 140; x.translate(B.x - bw / 2, B.y + r + 18);
    x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(0, 0, bw, 7); x.fillStyle = '#c9a0ff'; x.fillRect(0, 0, bw * B.hp / B.max, 7); x.restore();
}
