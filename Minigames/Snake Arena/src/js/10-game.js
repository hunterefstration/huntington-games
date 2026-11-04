// ==========================================
// SNAKE ARENA: everyone's snake on one board. Eat to grow, don't hit walls, yourself or anyone else.
// Last snake alive wins (or the longest when 2 minutes are up). The host moves every snake 9 times a second.
// ==========================================
const GW = 48, GH = 30, TICK = 1 / 9, ROUND = 120;
const SN = { snakes: [], food: [], on: false, acc: 0, t: 0, myDir: null, rng: Math.random, cell: 16 };
document.getElementById('app').innerHTML = '<div class="mg-hud" id="sn-hud"></div><canvas id="sn"></canvas>';
const cv = document.getElementById('sn'), x = cv.getContext('2d');
function fit() { SN.cell = Math.floor(Math.min(innerWidth / GW, (innerHeight - 50) / GH)); cv.width = GW * SN.cell; cv.height = GH * SN.cell; cv.style.margin = '44px auto 0'; }
addEventListener('resize', fit); fit();
const DIRS = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] }, OPP = { u: 'd', d: 'u', l: 'r', r: 'l' };
const key = (a, b) => a + b * GW;
function occupied() { const s = new Set(); for (const sn of SN.snakes) if (sn.alive) for (const [a, b] of sn.body) s.add(key(a, b)); return s; }
function addFood() { const occ = occupied(); for (let k = 0; k < 50; k++) { const a = Math.floor(SN.rng() * GW), b = Math.floor(SN.rng() * GH); if (!occ.has(key(a, b)) && !SN.food.some(f => f[0] === a && f[1] === b)) { SN.food.push([a, b]); return; } } }
// a bot: the safe move that heads for the closest food, preferring room to move (a small flood fill)
function room(a, b, occ) { const seen = new Set([key(a, b)]), q = [[a, b]]; while (q.length && seen.size < 60) { const [p, r] = q.shift(); for (const d of Object.values(DIRS)) { const n = [p + d[0], r + d[1]], kk = key(n[0], n[1]); if (n[0] < 0 || n[1] < 0 || n[0] >= GW || n[1] >= GH || occ.has(kk) || seen.has(kk)) continue; seen.add(kk); q.push(n); } } return seen.size; }
function botDir(sn) {
    const occ = occupied(), h = sn.body[0];
    let best = null, bs = -1e9;
    for (const [d, v] of Object.entries(DIRS)) {
        if (d === OPP[sn.dir]) continue; const n = [h[0] + v[0], h[1] + v[1]];
        if (n[0] < 0 || n[1] < 0 || n[0] >= GW || n[1] >= GH || occ.has(key(n[0], n[1]))) continue;
        const f = SN.food.reduce((m, q) => Math.min(m, Math.abs(q[0] - n[0]) + Math.abs(q[1] - n[1])), 99);
        const s = -f * 2 + Math.min(room(n[0], n[1], occ), 40) + Math.random() * 3;
        if (s > bs) { bs = s; best = d; }
    }
    return best || sn.dir;
}
function hostTick() {
    for (const sn of SN.snakes) if (sn.alive) { if (sn.bot) sn.dir = botDir(sn); else if (sn.want && sn.want !== OPP[sn.dir]) sn.dir = sn.want; }
    const heads = SN.snakes.filter(s => s.alive).map(s => { const v = DIRS[s.dir], h = s.body[0]; return [s, [h[0] + v[0], h[1] + v[1]]]; });
    const occ = occupied();
    for (const [s, n] of heads) {
        let dead = n[0] < 0 || n[1] < 0 || n[0] >= GW || n[1] >= GH || occ.has(key(n[0], n[1]));
        if (!dead) for (const [o, m] of heads) if (o !== s && m[0] === n[0] && m[1] === n[1]) dead = true;   // head on head
        s.next = n; s.dying = dead;
    }
    for (const [s] of heads) {
        if (s.dying) { s.alive = false; s.diedAt = SN.t; continue; }
        s.body.unshift(s.next);
        const fi = SN.food.findIndex(f => f[0] === s.next[0] && f[1] === s.next[1]);
        if (fi >= 0) { SN.food.splice(fi, 1); s.grow += 3; addFood(); }
        if (s.grow > 0) s.grow--; else s.body.pop();
    }
    const alive = SN.snakes.filter(s => s.alive);
    MG.toAll({ k: 's', s: SN.snakes.map(s => [s.id, s.alive ? 1 : 0, s.body.flat()]), f: SN.food.flat(), t: Math.round(SN.t) }, true);
    if ((SN.snakes.length > 1 && alive.length <= 1) || SN.t >= ROUND || !alive.length) {
        SN.on = false;
        const rows = SN.snakes.slice().sort((a, b) => (b.alive - a.alive) || (b.body.length - a.body.length) || ((b.diedAt || 0) - (a.diedAt || 0)));
        setTimeout(() => MG.end(`<h1>${mgEsc(rows[0].name)} wins!</h1>` + rows.map((s, i) => `<div class="mg-res-row"><span>${['🥇', '🥈', '🥉'][i] || (i + 1) + '.'} ${mgEsc(s.name)}${s.alive ? '' : ' 💀'}</span><b>${s.body.length}</b></div>`).join('')), 900);
    }
}
function start(roster, seed) {
    SN.rng = mgRng(seed); SN.t = 0; SN.acc = 0; SN.food = [];
    const spots = [[6, 6, 'r'], [GW - 7, GH - 7, 'l'], [GW - 7, 6, 'l'], [6, GH - 7, 'r'], [GW / 2 | 0, 4, 'd'], [GW / 2 | 0, GH - 5, 'u'], [4, GH / 2 | 0, 'r'], [GW - 5, GH / 2 | 0, 'l']];
    SN.snakes = roster.map((p, i) => { const [a, b, d] = spots[i % spots.length], v = DIRS[d]; return { id: p.id, name: p.name, col: p.col, bot: !!p.bot, dir: d, alive: true, grow: 0, body: [0, 1, 2].map(k => [a - v[0] * k, b - v[1] * k]) }; });
    for (let i = 0; i < 6; i++) addFood();
    SN.on = true;
}
function loop(t) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (t - (SN.last || t)) / 1000); SN.last = t;
    if (SN.on && MG.isHost()) { SN.t += dt; SN.acc += dt; while (SN.acc >= TICK) { SN.acc -= TICK; hostTick(); if (!SN.on) break; } }
    draw();
}
function draw() {
    const c = SN.cell; x.fillStyle = '#060a14'; x.fillRect(0, 0, cv.width, cv.height);
    x.strokeStyle = 'rgba(255,255,255,.04)'; x.lineWidth = 1; x.beginPath(); for (let i = 0; i <= GW; i++) { x.moveTo(i * c, 0); x.lineTo(i * c, GH * c); } for (let j = 0; j <= GH; j++) { x.moveTo(0, j * c); x.lineTo(GW * c, j * c); } x.stroke();
    for (const [a, b] of SN.food) { x.fillStyle = '#facc15'; x.shadowColor = '#facc15'; x.shadowBlur = 12; x.beginPath(); x.arc(a * c + c / 2, b * c + c / 2, c * 0.32, 0, 7); x.fill(); } x.shadowBlur = 0;
    for (const s of SN.snakes) {
        x.globalAlpha = s.alive ? 1 : 0.25;
        s.body.forEach(([a, b], i) => { x.fillStyle = i ? s.col : '#fff'; x.fillRect(a * c + 1, b * c + 1, c - 2, c - 2); if (!i) { x.fillStyle = s.col; x.fillRect(a * c + 3, b * c + 3, c - 6, c - 6); } });
        x.globalAlpha = 1;
    }
    const hud = document.getElementById('sn-hud'), me = SN.snakes.find(s => s.id === MG.me);
    hud.innerHTML = `<span>⏱ ${Math.max(0, ROUND - Math.round(SN.t))} s</span>` + SN.snakes.map(s => `<span style="color:${s.col}">${mgEsc(s.name.replace(' (bot)', ''))} ${s.alive ? s.body.length : '💀'}</span>`).join('') + (me && !me.alive && SN.on ? '<span>You crashed: watching</span>' : '');
}
function steer(d) { const me = SN.snakes.find(s => s.id === MG.me); if (!me || !me.alive) return; MG.toHost({ k: 'dir', d }); }
addEventListener('keydown', e => { const d = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' }[e.code]; if (d) { e.preventDefault(); steer(d); } });
let touch0 = null; cv.addEventListener('pointerdown', e => { touch0 = [e.clientX, e.clientY]; }); cv.addEventListener('pointerup', e => { if (!touch0) return; const dx = e.clientX - touch0[0], dy = e.clientY - touch0[1]; if (Math.max(Math.abs(dx), Math.abs(dy)) > 20) steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u')); touch0 = null; });
requestAnimationFrame(loop);
MG.init({
    id: 'mg-snake', title: 'Snake Arena', color: '#4ade80', min: 2, max: 8, bots: 7, defBots: 3,
    sub: 'Every snake on one board. Last one slithering wins.', howto: 'Steer with the <b>arrow keys</b> or <b>WASD</b> (swipe on a touch screen). Eat the gold to grow. Hit a wall, yourself or another snake and you are out. Last snake alive wins; after 2 minutes the longest wins.',
    onStart(roster, seed) { start(roster, seed); },
    onMsg(from, m) {
        if (m.k === 'dir' && MG.isHost()) { const s = SN.snakes.find(q => q.id === from); if (s) s.want = m.d; }
        if (m.k === 's' && !MG.isHost()) { SN.t = m.t; for (const [id, alive, flat] of m.s) { const s = SN.snakes.find(q => q.id === id); if (!s) continue; s.alive = !!alive; s.body = []; for (let i = 0; i < flat.length; i += 2) s.body.push([flat[i], flat[i + 1]]); } SN.food = []; for (let i = 0; i < m.f.length; i += 2) SN.food.push([m.f[i], m.f[i + 1]]); }
    },
    onLeave(id) { const s = SN.snakes.find(q => q.id === id); if (s) s.alive = false; }, onQuit() { SN.on = false; }, onEnd() { SN.on = false; }
});
