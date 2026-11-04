// ==========================================
// PONG: two paddles, one ball, first to 7. The host plays left and runs the ball; the other side is a friend or a bot.
// Move with the mouse / finger, or W/S / arrow keys. The ball speeds up a little with every hit.
// ==========================================
const W = 800, H = 500, PH = 90, PW = 12, BR = 8, TO = 7;
document.getElementById('app').innerHTML = '<canvas id="pg"></canvas><div class="mg-hud"><span id="pg-l"></span><span id="pg-r"></span></div>';
const cv = document.getElementById('pg'), x = cv.getContext('2d');
const P = { on: false, b: { x: W / 2, y: H / 2, vx: 0, vy: 0 }, p: [H / 2, H / 2], s: [0, 0], side: 0, ids: [0, 0], serveT: 0, keys: {}, myY: H / 2, sendT: 0, last: 0, trail: [] };
function fit() { const k = Math.min(innerWidth / W, innerHeight / H); cv.width = W; cv.height = H; cv.style.width = W * k + 'px'; cv.style.height = H * k + 'px'; cv.style.margin = ((innerHeight - H * k) / 2) + 'px auto 0'; }
addEventListener('resize', fit); fit();
function pgPointer(e) { const r = cv.getBoundingClientRect(); P.myY = (e.clientY - r.top) / r.height * H; }
cv.addEventListener('pointermove', pgPointer); cv.addEventListener('pointerdown', pgPointer);
addEventListener('keydown', e => { P.keys[e.code] = true; }); addEventListener('keyup', e => { P.keys[e.code] = false; });
function serve(dir) { P.b = { x: W / 2, y: H / 2, vx: 0, vy: 0 }; P.serveT = 1.2; P.serveDir = dir; }
function hostStep(dt) {
    const b = P.b;
    if (P.serveT > 0) { P.serveT -= dt; if (P.serveT <= 0) { const a = (Math.random() - 0.5) * 0.8; b.vx = P.serveDir * 360 * Math.cos(a); b.vy = 360 * Math.sin(a); } }
    // the bot (right side when it is a bot): follows the ball with a little delay and error
    const right = MG.player(P.ids[1]);
    if (right && right.bot) { const target = b.vx > 0 ? b.y + (P.err || 0) : H / 2; P.p[1] += Math.max(-330 * dt, Math.min(330 * dt, target - P.p[1])); if (Math.random() < 0.02) P.err = (Math.random() - 0.5) * 70; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y < BR) { b.y = BR; b.vy = Math.abs(b.vy); MGS.blip(); } if (b.y > H - BR) { b.y = H - BR; b.vy = -Math.abs(b.vy); MGS.blip(); }
    for (const s of [0, 1]) {
        const px = s ? W - 30 : 30;
        if ((s ? b.vx > 0 : b.vx < 0) && Math.abs(b.x - px) < BR + PW / 2 && Math.abs(b.y - P.p[s]) < PH / 2 + BR) {
            const off = (b.y - P.p[s]) / (PH / 2), sp = Math.min(900, Math.hypot(b.vx, b.vy) * 1.06);
            b.vx = (s ? -1 : 1) * sp * Math.cos(off * 0.9); b.vy = sp * Math.sin(off * 0.9); b.x = px + (s ? -1 : 1) * (BR + PW / 2); MGS.hit();
        }
    }
    if (b.x < -20 || b.x > W + 20) {
        const scorer = b.x < 0 ? 1 : 0; P.s[scorer]++; MGS[scorer === 0 ? 'win' : 'lose']();
        if (P.s[scorer] >= TO) { const w = MG.player(P.ids[scorer]); P.on = false;
            MG.end(`<h1>${mgEsc(w ? w.name : '?')} wins!</h1><div class="mg-res-row"><span>${mgEsc(MG.player(P.ids[0]).name)}</span><b>${P.s[0]}</b></div><div class="mg-res-row"><span>${mgEsc(MG.player(P.ids[1]).name)}</span><b>${P.s[1]}</b></div>`); return; }
        serve(scorer ? 1 : -1);
    }
}
function loop(t) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (t - (P.last || t)) / 1000); P.last = t;
    if (!P.on) return draw();
    // my paddle: keys move it, the mouse sets it
    const sp = 520 * dt; if (P.keys.KeyW || P.keys.ArrowUp) P.myY -= sp; if (P.keys.KeyS || P.keys.ArrowDown) P.myY += sp;
    P.myY = Math.max(PH / 2, Math.min(H - PH / 2, P.myY));
    if (P.side >= 0) P.p[P.side] = P.myY;
    if (MG.isHost()) {
        hostStep(dt);
        if ((P.sendT -= dt) <= 0) { P.sendT = 1 / 30; MG.toAll({ k: 's', b: [Math.round(P.b.x), Math.round(P.b.y), Math.round(P.b.vx), Math.round(P.b.vy)], p: P.p.map(Math.round), s: P.s }, true); }
    } else {
        P.b.x += P.b.vx * dt; P.b.y += P.b.vy * dt;           // smooth between updates
        if ((P.sendT -= dt) <= 0 && P.side >= 0) { P.sendT = 1 / 30; MG.toHost({ k: 'y', y: Math.round(P.myY) }, true); }
    }
    P.trail.push([P.b.x, P.b.y]); if (P.trail.length > 10) P.trail.shift();
    draw();
}
function draw() {
    x.fillStyle = '#05070f'; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(255,255,255,.15)'; x.setLineDash([10, 12]); x.lineWidth = 3; x.beginPath(); x.moveTo(W / 2, 0); x.lineTo(W / 2, H); x.stroke(); x.setLineDash([]);
    x.font = '900 64px system-ui'; x.textAlign = 'center'; x.fillStyle = 'rgba(255,255,255,.18)'; x.fillText(P.s[0], W / 2 - 80, 80); x.fillText(P.s[1], W / 2 + 80, 80);
    for (const s of [0, 1]) { const p = MG.player(P.ids[s]); x.fillStyle = p ? p.col : '#fff'; x.shadowColor = x.fillStyle; x.shadowBlur = 16; x.fillRect((s ? W - 30 : 30) - PW / 2, P.p[s] - PH / 2, PW, PH); }
    x.shadowBlur = 0;
    P.trail.forEach((t, i) => { x.fillStyle = `rgba(255,255,255,${i / 30})`; x.beginPath(); x.arc(t[0], t[1], BR * i / 10, 0, 7); x.fill(); });
    x.fillStyle = '#fff'; x.shadowColor = '#fff'; x.shadowBlur = 20; x.beginPath(); x.arc(P.b.x, P.b.y, BR, 0, 7); x.fill(); x.shadowBlur = 0;
}
requestAnimationFrame(loop);
MG.init({
    id: 'mg-pong', title: 'Pong', color: '#a78bfa', min: 2, max: 2, bots: 1, defBots: 1,
    sub: 'The original. Two paddles, one ball.', howto: 'Move your paddle with the <b>mouse</b> or a finger, or <b>W/S</b> / arrow keys. First to 7. The ball speeds up with every hit.',
    onStart(roster) {
        P.ids = [roster[0].id, roster[1].id]; P.side = P.ids.indexOf(MG.me); P.s = [0, 0]; P.p = [H / 2, H / 2]; P.on = true; P.trail = [];
        document.getElementById('pg-l').textContent = roster[0].name + (P.side === 0 ? ' (you)' : ''); document.getElementById('pg-r').textContent = roster[1].name + (P.side === 1 ? ' (you)' : '');
        if (MG.isHost()) serve(Math.random() < 0.5 ? -1 : 1);
    },
    onMsg(from, m) {
        if (m.k === 'y' && MG.isHost()) { const s = P.ids.indexOf(from); if (s >= 0 && s !== P.side) P.p[s] = Math.max(PH / 2, Math.min(H - PH / 2, m.y)); }
        if (m.k === 's' && !MG.isHost()) { P.b = { x: m.b[0], y: m.b[1], vx: m.b[2], vy: m.b[3] }; P.s = m.s; m.p.forEach((y, i) => { if (i !== P.side) P.p[i] = y; }); }
    },
    onLeave() { if (P.on && MG.isHost()) { P.on = false; MG.end('<h1>Your opponent left</h1>'); } }, onQuit() { P.on = false; }, onEnd() { P.on = false; }
});
