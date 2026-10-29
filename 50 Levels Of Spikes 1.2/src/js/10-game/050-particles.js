// ===================== Particles =====================

function createParticles(x, y, amount, color) {
    if (simMode) return;
    for (let i = 0; i < amount && particles.length < MAX_PARTICLES; i++) {
        const p = particlePool.length ? particlePool.pop() : {};
        p.x = x; p.y = y;
        p.vx = (Math.random() - 0.5) * 8;
        p.vy = (Math.random() - 0.5) * 8;
        p.life = 1.0;
        p.decay = 0.02 + Math.random() * 0.03;
        p.color = color;
        p.size = 2 + Math.random() * 4;
        particles.push(p);
    }
}


function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) {
            particles[i] = particles[particles.length - 1];
            particles.pop();
            particlePool.push(p);
        }
    }
}

function clearParticles() {
    while (particles.length) particlePool.push(particles.pop());
}


// ===================== Drawing =====================

function makeSpikeSprite(dir) {
    const c = document.createElement('canvas');
    const w = dir >= 2 ? 20 : 24, h = dir >= 2 ? 24 : 20;
    c.width = w + 24; c.height = h + 24;
    const g = c.getContext('2d');
    g.translate(12, 12);
    g.fillStyle = '#f43f5e';
    g.shadowColor = '#f43f5e';
    g.shadowBlur = 10;
    g.beginPath();
    if (dir === 0) { g.moveTo(0, h); g.lineTo(w / 2, 0); g.lineTo(w, h); }
    else if (dir === 1) { g.moveTo(0, 0); g.lineTo(w / 2, h); g.lineTo(w, 0); }
    else if (dir === 2) { g.moveTo(w, 0); g.lineTo(0, h / 2); g.lineTo(w, h); }
    else { g.moveTo(0, 0); g.lineTo(w, h / 2); g.lineTo(0, h); }
    g.closePath();
    g.fill();
    return c;
}
const spikeSprites = [makeSpikeSprite(0), makeSpikeSprite(1), makeSpikeSprite(2), makeSpikeSprite(3)];

const sawSprite = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 56;
    const g = c.getContext('2d');
    g.translate(28, 28);
    g.shadowColor = '#f43f5e';
    g.shadowBlur = 8;
    g.beginPath();
    for (let i = 0; i < 20; i++) {
        const a = i * Math.PI / 10, rr = i % 2 === 0 ? SAW_DRAW_R : SAW_DRAW_R * 0.7;
        g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath();
    g.fillStyle = '#e2e8f0';
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = '#f43f5e';
    g.lineWidth = 2;
    g.stroke();
    g.beginPath(); g.arc(0, 0, 6, 0, Math.PI * 2); g.fillStyle = '#475569'; g.fill();
    g.beginPath(); g.arc(0, 0, 2.5, 0, Math.PI * 2); g.fillStyle = '#f43f5e'; g.fill();
    return c;
})();

let bgGradient = null;
const DASH = [4, 4];
const NO_DASH = [];

function drawBlock(g, x, y, w, h) {
    g.fillStyle = '#334155';
    g.fillRect(x, y, w, h);
    g.strokeStyle = '#475569';
    g.lineWidth = 2;
    g.strokeRect(x, y, w, h);
    g.fillStyle = '#475569';
    g.fillRect(x, y, w, 4);
}

function drawSpike(g, x, y, dir) {
    g.drawImage(spikeSprites[dir], x - 12, y - 12);
}

function drawCrumble(g, x, y, state) {
    if (state === 2) {
        g.strokeStyle = 'rgba(251, 146, 60, 0.3)';
        g.lineWidth = 2;
        g.setLineDash(DASH);
        g.strokeRect(x + 2, y + 2, 26, 26);
        g.setLineDash(NO_DASH);
        return;
    }
    if (state === 1) { x += (Math.random() - 0.5) * 3; y += (Math.random() - 0.5) * 2; }
    g.fillStyle = '#9a3412';
    g.fillRect(x, y, 30, 30);
    g.fillStyle = '#c2410c';
    g.fillRect(x + 2, y + 2, 26, 26);
    g.strokeStyle = '#431407';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x + 6, y + 2); g.lineTo(x + 12, y + 13); g.lineTo(x + 8, y + 22);
    g.moveTo(x + 12, y + 13); g.lineTo(x + 22, y + 16); g.lineTo(x + 26, y + 28);
    g.moveTo(x + 22, y + 16); g.lineTo(x + 24, y + 4);
    g.stroke();
}

function drawKey(g, x, y) {
    g.fillStyle = '#facc15';
    g.beginPath(); g.arc(x + 9, y + 6, 6, 0, Math.PI * 2); g.fill();
    g.fillRect(x + 7.5, y + 10, 3, 12);
    g.fillRect(x + 10.5, y + 15, 5, 2.5);
    g.fillRect(x + 10.5, y + 19.5, 3.5, 2.5);
    g.fillStyle = '#1e1b4b';
    g.beginPath(); g.arc(x + 9, y + 6, 2.5, 0, Math.PI * 2); g.fill();
}

function drawDoor(g, x, y) {
    g.fillStyle = '#78350f';
    g.fillRect(x, y, 30, 30);
    g.strokeStyle = '#facc15';
    g.lineWidth = 2;
    g.strokeRect(x + 1, y + 1, 28, 28);
    g.fillStyle = '#facc15';
    g.beginPath(); g.arc(x + 15, y + 12, 4, 0, Math.PI * 2); g.fill();
    g.fillRect(x + 13.5, y + 13, 3, 9);
}

function drawBounce(g, x, y, up, down, squash) {
    g.fillStyle = '#334155';
    g.fillRect(x, y, 30, 30);
    g.strokeStyle = '#475569';
    g.lineWidth = 2;
    g.strokeRect(x, y, 30, 30);
    g.strokeStyle = '#facc15';
    if (up) {
        const top = y - 6 + squash;
        g.beginPath();
        g.moveTo(x + 8, y + 2); g.lineTo(x + 22, top + 9); g.lineTo(x + 8, top + 6); g.lineTo(x + 22, top + 3);
        g.stroke();
        g.fillStyle = '#a3e635';
        g.fillRect(x + 2, top - 1, 26, 5);
    }
    if (down) {
        const bot = y + 36 - squash;
        g.beginPath();
        g.moveTo(x + 8, y + 28); g.lineTo(x + 22, bot - 9); g.lineTo(x + 8, bot - 6); g.lineTo(x + 22, bot - 3);
        g.stroke();
        g.fillStyle = '#a3e635';
        g.fillRect(x + 2, bot - 4, 26, 5);
    }
}

function drawConveyor(g, x, y, w, dir, tick) {
    g.fillStyle = '#1f2937';
    g.fillRect(x, y, w, 30);
    g.strokeStyle = '#64748b';
    g.lineWidth = 2;
    g.strokeRect(x + 1, y + 1, w - 2, 28);
    g.fillStyle = '#f59e0b';
    g.fillRect(x + 2, y + 2, w - 4, 3);
    const off = (((tick * CONVEYOR_SPEED * dir) % 15) + 15) % 15;
    g.beginPath();
    for (let cx = x + off - 15; cx < x + w; cx += 15) {
        if (cx < x + 3 || cx + 8 > x + w - 3) continue;
        if (dir > 0) { g.moveTo(cx, y + 10); g.lineTo(cx + 7, y + 16); g.lineTo(cx, y + 22); }
        else { g.moveTo(cx + 7, y + 10); g.lineTo(cx, y + 16); g.lineTo(cx + 7, y + 22); }
    }
    g.strokeStyle = '#fbbf24';
    g.stroke();
}

function drawMoverSlab(g, x, y, w) {
    g.fillStyle = '#0e7490';
    g.fillRect(x, y, w, MOVER_H);
    g.fillStyle = '#22d3ee';
    g.fillRect(x, y, w, 4);
    g.strokeStyle = '#155e75';
    g.lineWidth = 2;
    g.strokeRect(x + 1, y + 1, w - 2, MOVER_H - 2);
}

function drawSaw(g, cx, cy, angle) {
    g.save();
    g.translate(cx, cy);
    g.rotate(angle);
    g.drawImage(sawSprite, -28, -28);
    g.restore();
}

function drawGoalShape(g, x, y) {
    g.fillStyle = '#10b981';
    g.fillRect(x, y, goal.w, goal.h);
    g.fillStyle = '#047857';
    g.fillRect(x + 10, y + 10, goal.w - 20, goal.h - 20);
}

function drawPlayerShape(g, x, y, w, h, grav, vx) {
    g.fillStyle = '#38bdf8';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#fff';
    const eyeOffsetX = vx > 0 ? 4 : (vx < 0 ? -4 : 0);
    const eyeY = grav > 0 ? y + 4 : y + h - 8;
    g.fillRect(x + 4 + eyeOffsetX, eyeY, 4, 4);
    g.fillRect(x + 16 + eyeOffsetX, eyeY, 4, 4);
}

function drawZoneRect(g, x, y, w, h, tick) {
    g.fillStyle = 'rgba(168, 85, 247, 0.16)';
    g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(192, 132, 252, 0.45)';
    g.lineWidth = 1;
    g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    g.strokeStyle = 'rgba(216, 180, 254, ' + (0.35 + 0.2 * Math.sin(tick * 0.08)).toFixed(2) + ')';
    g.lineWidth = 2;
    g.beginPath();
    for (let ay = y + 15; ay < y + h; ay += 60) {
        for (let ax = x + 15; ax < x + w; ax += 60) {
            g.moveTo(ax - 5, ay - 4); g.lineTo(ax, ay - 9); g.lineTo(ax + 5, ay - 4);
            g.moveTo(ax - 5, ay + 4); g.lineTo(ax, ay + 9); g.lineTo(ax + 5, ay + 4);
            g.moveTo(ax, ay - 9); g.lineTo(ax, ay + 9);
        }
    }
    g.stroke();
}


function draw() {
    if (!bgGradient) {
        bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        bgGradient.addColorStop(0, '#0f172a');
        bgGradient.addColorStop(1, '#1e1b4b');
    }
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);


    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.03)';
    ctx.lineWidth = 1;
    let bgOffsetX1 = -(camera.x * 0.1) % 100;
    ctx.beginPath();
    for (let x = bgOffsetX1; x < canvas.width; x += 100) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.07)';
    let bgOffsetX2 = -(camera.x * 0.3) % 60;
    ctx.beginPath();
    for (let x = bgOffsetX2; x < canvas.width; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
    ctx.stroke();
    ctx.restore();


    ctx.save();
    const camX = Math.floor(camera.x);
    ctx.translate(-camX, Math.floor(-camera.y));
    const viewL = camX - 40, viewR = camX + canvas.width + 40;
    const tick = levelTick;

    for (let i = 0; i < zoneRects.length; i++) {
        const z = zoneRects[i];
        const zx = z.x0 * TILE, zw = (z.x1 - z.x0) * TILE;
        if (zx + zw > viewL && zx < viewR) drawZoneRect(ctx, zx, z.y0 * TILE, zw, (z.y1 - z.y0) * TILE, tick);
    }

    // moving platform rails
    if (movers.length) {
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.22)';
        ctx.lineWidth = 2;
        ctx.setLineDash(DASH);
        ctx.beginPath();
        for (let i = 0; i < movers.length; i++) {
            const m = movers[i];
            if (m.axis === 0) { const ry = m.y + MOVER_H / 2; ctx.moveTo(m.min, ry); ctx.lineTo(m.max + m.w, ry); }
            else { const rx = m.x + m.w / 2; ctx.moveTo(rx, m.min); ctx.lineTo(rx, m.max + MOVER_H); }
        }
        ctx.stroke();
        ctx.setLineDash(NO_DASH);
    }

    for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        if (p.x + p.w <= viewL || p.x >= viewR) continue;
        switch (p.type) {
            case T_SOLID: drawBlock(ctx, p.x, p.y, p.w, p.h); break;
            case T_CRUMBLE: drawCrumble(ctx, p.x, p.y, p.state); break;
            case T_DOOR: if (p.active) drawDoor(ctx, p.x, p.y); break;
            case T_BOUNCE:
                drawBounce(ctx, p.x, p.y, p.faceUp, p.faceDown, p.timer > 0 ? 4 : 0);
                if (p.timer > 0 && gameState === 'PLAYING') p.timer--;
                break;
            case T_CONV_L: drawConveyor(ctx, p.x, p.y, p.w, -1, tick); break;
            case T_CONV_R: drawConveyor(ctx, p.x, p.y, p.w, 1, tick); break;
        }
    }

    for (let i = 0; i < movers.length; i++) {
        const m = movers[i];
        if (m.x + m.w > viewL && m.x < viewR) drawMoverSlab(ctx, m.x, m.y, m.w);
    }


    for (let i = 0; i < spikes.length; i++) {
        const s = spikes[i];
        if (s.x + s.w > viewL && s.x < viewR) drawSpike(ctx, s.x, s.y, s.dir);
    }

    if (saws.length) {
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < saws.length; i++) {
            const s = saws[i];
            if (s.orbit) { ctx.moveTo(s.px, s.py); ctx.lineTo(s.cx, s.cy); }
        }
        ctx.stroke();
        for (let i = 0; i < saws.length; i++) {
            const s = saws[i];
            if (s.cx + 30 < viewL || s.cx - 30 > viewR) continue;
            if (s.orbit) {
                ctx.fillStyle = '#475569';
                ctx.beginPath(); ctx.arc(s.px, s.py, 7, 0, Math.PI * 2); ctx.fill();
            }
            drawSaw(ctx, s.cx, s.cy, tick * 0.25 * s.dir);
        }
    }

    for (let i = 0; i < keyItems.length; i++) {
        const k = keyItems[i];
        if (!k.taken && k.x + 30 > viewL && k.x < viewR) drawKey(ctx, k.x, k.y + Math.sin(tick * 0.08 + i) * 3);
    }


    ctx.fillStyle = '#10b981';
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 20 + Math.sin(Date.now() / 150) * 10;
    ctx.fillRect(goal.x, goal.y, goal.w, goal.h);
    ctx.fillStyle = '#047857';
    ctx.fillRect(goal.x + 10, goal.y + 10, goal.w - 20, goal.h - 20);
    ctx.shadowBlur = 0;
    if (Math.random() < 0.2 && gameState !== 'MENU') createParticles(goal.x + Math.random() * goal.w, goal.y + Math.random() * goal.h, 1, '#34d399');


    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
    }
    ctx.globalAlpha = 1.0;


    if (gameState !== 'DEAD') {
        const g = player.grav;
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 15;
        let stretchY = 1 + (player.vy * g * 0.02);
        let stretchX = 1 - (Math.abs(player.vy) * 0.01);
        if (player.grounded) { stretchX = 1; stretchY = 1; }
        let drawW = player.w * stretchX;
        let drawH = player.h * stretchY;
        let drawX = player.x + (player.w - drawW) / 2;
        let drawY = g > 0 ? player.y + (player.h - drawH) : player.y;
        ctx.fillRect(drawX, drawY, drawW, drawH);
        ctx.shadowBlur = 0;
        drawPlayerShape(ctx, drawX, drawY, drawW, drawH, g, player.vx);
    }


    ctx.restore();

    if (bannerTimer > 0 && levelName && gameState !== 'MENU') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, bannerTimer / 45);
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 6;
        ctx.font = 'bold 30px "Segoe UI", Tahoma, sans-serif';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(levelName, canvas.width / 2, bannerY);
        if (levelHint) {
            ctx.font = 'bold 20px "Segoe UI", Tahoma, sans-serif';
            ctx.fillStyle = '#facc15';
            ctx.fillText(levelHint, canvas.width / 2, bannerY + 32);
        }
        ctx.restore();
    }
}


