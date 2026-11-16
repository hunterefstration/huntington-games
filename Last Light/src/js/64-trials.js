// ==========================================
// TRIALS (1.5): any level you have cleared, against the clock. No talking; lanterns still catch you but the clock never
// stops; R starts the run over. A ghost of your best run races you. Medals: Bronze, Silver, Gold, and Lumen for the
// very best (the gold time is each level's `par`, worked out by tools/levels.py from the shortest way through it).
// Records: SAVE.d.trials[id] = { t: best seconds, m: best medal 0-4, n: runs }. Ghosts: their own key ('lumighost'),
// on this device only (not synced: too big for a cloud save), the 10 most recent levels.
// LOOKS: the colour of your light. Six to start with, five more to earn (Frostveil, the frozen lanterns, gold medals).
// ==========================================
const MEDALS = [null, { n: 'Bronze', k: 1.6, c: '#e0965a' }, { n: 'Silver', k: 1.25, c: '#dfe8f2' }, { n: 'Gold', k: 1, c: '#ffd23a' }, { n: 'Lumen', k: 0.85, c: '#9ff6ff' }];
const medalTime = (def, m) => m === 4 ? Math.floor(def.par * 0.85) : Math.ceil(def.par * MEDALS[m].k);
function medalFor(def, t) { let m = 0; for (let k = 1; k <= 4; k++) if (t <= medalTime(def, k)) m = k; return m; }
const medalPoints = () => Object.keys(SAVE.d.trials || {}).reduce((n, k) => n + Math.min(4, (SAVE.d.trials[k] || {}).m | 0), 0);
const medalCount = m => Object.keys(SAVE.d.trials || {}).filter(k => ((SAVE.d.trials[k] || {}).m | 0) >= m).length;
const trialOpen = i => !!LEVELS[i] && !!SAVE.d.levels[LEVELS[i].id] && LEVELS[i].par > 0;
const medalHTML = (m, big) => m ? `<span class="medal${big ? ' big' : ''}" style="--mc:${MEDALS[m].c}" title="${MEDALS[m].n}">${m === 4 ? '✦' : '●'}</span>` : `<span class="medal none${big ? ' big' : ''}">○</span>`;

// ---------- ghosts: 10 positions a second, in quarter tiles, as differences in one short string ----------
const GHOST_KEY = 'lumighost';
function ghostAll() { try { const o = JSON.parse(localStorage.getItem(GHOST_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
function ghostLoad(id) {
    const g = ghostAll()[id]; if (!g || typeof g.d !== 'string') return null;
    const n = g.d.split(',').map(Number), out = []; let x = 0, y = 0;
    for (let i = 0; i + 1 < n.length; i += 2) { x += n[i]; y += n[i + 1]; out.push([x * 8, y * 8]); }
    return out.length ? out : null;
}
function ghostSave(id, pts, t) {
    const all = ghostAll(), d = []; let px = 0, py = 0;
    for (const [x, y] of pts) { const qx = Math.round(x / 8), qy = Math.round(y / 8); d.push(qx - px, qy - py); px = qx; py = qy; }
    all[id] = { d: d.join(','), t, at: Date.now() };
    for (const k of Object.keys(all).sort((a, b) => (all[b].at || 0) - (all[a].at || 0)).slice(10)) delete all[k];
    try { localStorage.setItem(GHOST_KEY, JSON.stringify(all)); } catch (e) {}
}

// ---------- a trial run ----------
function trialStart(i) { G.run = null; G.trial = { id: LEVELS[i].id }; fadeTo(() => G.start(i)); }
// called by G.start when this.trial is set: the ghost, no talking, the first target
function trialBegin(G) {
    const def = G.L.def, rec = SAVE.d.trials[def.id];
    Object.assign(G.trial, { rec: [], rt: 0, ghost: ghostLoad(def.id), best: rec ? rec.t : null, hudT: 0 });
    for (const e of G.L.ents) if (e.kind === 'npc') e.talked = true;
    G.guardSpoke = G.gloomSpoke = true;
    const want = Math.min(4, ((rec && rec.m) | 0) + 1);
    UI.banner('Trial · ' + def.id, def.name, (rec && rec.m >= 4 ? 'Every medal won: beat ' + fmtTime(rec.t) : MEDALS[want].n + ' medal: ' + fmtTime(medalTime(def, want))) + (G.trial.ghost ? ' · your ghost races you' : ''));
    $('#h-trial').classList.remove('hidden'); trialHud(G);
}
function trialTick(G, dt) {
    const T = G.trial; T.rt += dt;
    if (T.rt >= 0.1 && T.rec.length < 9000) { T.rt -= 0.1; T.rec.push([G.p.x, G.p.y]); }
    T.hudT -= dt; if (T.hudT <= 0) { T.hudT = 0.2; trialHud(G); }
}
// the best medal still in reach, and its time
function trialHud(G) {
    const def = G.L.def; let m = 0;
    for (let k = 4; k >= 1; k--) if (G.time <= medalTime(def, k)) { m = k; break; }
    const el = $('#h-trial'); if (!el) return;
    el.innerHTML = m ? `${medalHTML(m)} ${MEDALS[m].n} ${fmtTime(medalTime(def, m))}` : 'No medal this run · R to start over';
}
function trialGhostDraw(x, t) {
    const T = G.trial, gh = T && T.ghost; if (!gh) return;
    const f = G.time * 10, i = Math.min(gh.length - 1, Math.floor(f)), j = Math.min(gh.length - 1, i + 1), u = f - Math.floor(f);
    const gx = lerp(gh[i][0], gh[j][0], u), gy = lerp(gh[i][1], gh[j][1], u);
    x.save(); x.globalAlpha = 0.38; Sprites.lumi(x, { x: gx, y: gy, sx: 1, sy: 1, face: gh[j][0] >= gh[i][0] ? 1 : -1, vx: 0, vy: 0, blinkSeed: 0, hurtT: 0, pal: 6, shape: 2 }, t); x.restore();
}
function trialFinish(G) {
    const def = G.L.def, t = +G.time.toFixed(2), rec = SAVE.d.trials[def.id] || { t: null, m: 0, n: 0 };
    const best = rec.t == null || t < rec.t, m = medalFor(def, t), newMedal = m > (rec.m | 0);
    if (best) { rec.t = t; ghostSave(def.id, G.trial.rec.concat([[G.p.x, G.p.y]]), t); }
    rec.m = Math.max(rec.m | 0, m); rec.n = (rec.n | 0) + 1;
    SAVE.d.trials[def.id] = rec; ST('trials'); SAVE.write();
    G.p.vx = 0; $('#h-trial').classList.add('hidden');
    setTimeout(() => { G.state = 'done'; UI.trialResults({ def, t, best, m, newMedal, rec }); if (newMedal) Sound.play('medal', m); lookCheck(); }, 1300);
}
UI.trialResults = function (r) {
    const def = r.def, rows = [
        ['Time', fmtTime(r.t) + (r.best ? '<span class="new">NEW BEST</span>' : '')],
        ['Medal', r.m ? medalHTML(r.m) + ' ' + MEDALS[r.m].n + (r.newMedal ? '<span class="new">NEW</span>' : '') : 'none this time'],
        ['Best', fmtTime(r.rec.t) + ' ' + medalHTML(r.rec.m)],
        ['Medal times', [1, 2, 3, 4].map(k => `<span class="mt${r.rec.m >= k ? ' got' : ''}">${medalHTML(k)} ${fmtTime(medalTime(def, k))}</span>`).join(' ')]
    ];
    $('#d-title').textContent = 'Trial · ' + def.id + ' ' + def.name;
    $('#d-rows').innerHTML = rows.map(([a, b]) => `<div class="drow"><span>${a}</span><b>${b}</b></div>`).join('');
    $('#d-unlock').textContent = r.newMedal ? 'Medal points: ' + medalPoints() : '';
    const nx = trialOpen(G.idx + 1);
    $('#d-next').classList.toggle('hidden', !nx); $('#d-next').textContent = nx ? 'Next trial: ' + LEVELS[G.idx + 1].name : 'Next';
    $('#d-retry').textContent = 'Try again';
    $('#hud').classList.add('hidden'); this.show('done');
};

// ---------- looks: the colour of your light (and the shape of its flame) ----------
const LOOKS = [
    { pal: 0, n: 'Lantern' }, { pal: 1, n: 'Sky' }, { pal: 2, n: 'Rose' }, { pal: 3, n: 'Leaf' }, { pal: 4, n: 'Violet' }, { pal: 5, n: 'Ember' },
    { pal: 6, n: 'Frost', need: 'Free Hoarfrost, the guardian of Frostveil', ok: () => !!SAVE.d.guards.owl },
    { pal: 7, n: 'Dawn', need: 'Bring the eleventh light home (6-11)', ok: () => !!SAVE.d.levels['6-11'] },
    { pal: 8, n: 'Aurora', need: 'Find all 11 frozen lanterns in Frostveil', ok: () => frozenFound() >= 11 },
    { pal: 9, n: 'Sunlit', need: 'Win 10 gold trial medals', ok: () => medalCount(3) >= 10 },
    { pal: 10, n: 'Gloomlight', need: 'Beat The Gloom flawless (5-1)', ok: () => !!(SAVE.d.levels['5-1'] || {}).perfect }
];
const SHAPES = ['Flame', 'Twin', 'Crown', 'Curl'];
const lookOk = o => !o.ok || o.ok();
// the light you play as (not in multiplayer: there everyone gets a colour of their own)
function applyLook(p) {
    const lk = SAVE.d.look || {}, o = LOOKS.find(q => q.pal === lk.pal);
    p.pal = o && lookOk(o) ? o.pal : 0; p.shape = clamp(lk.shape | 0, 0, SHAPES.length - 1);
}
// a newly earned light says so once
function lookCheck() {
    const got = SAVE.d.looksGot = Array.isArray(SAVE.d.looksGot) ? SAVE.d.looksGot : [];
    const fresh = LOOKS.filter(o => o.ok && o.ok() && !got.includes(o.pal));
    if (!fresh.length) return;
    for (const o of fresh) got.push(o.pal);
    SAVE.write(); G.toast('New light: ' + fresh.map(o => o.n).join(', ') + ' (title, Your light)');
}
function lookCanvas(cv, pal, shape) {
    const x = cv.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height);
    x.translate(cv.width / 2, cv.height * 0.62); const k = cv.width / 44; x.scale(k, k);
    Sprites.lumi(x, { x: 0, y: 0, sx: 1, sy: 1, face: 1, vx: 0, vy: 0, blinkSeed: 0, hurtT: 0, pal, shape }, 1);
}
UI.looks = function () {
    const lk = SAVE.d.look = SAVE.d.look || { pal: 0, shape: 0 };
    $('#lk-list').innerHTML = LOOKS.map(o => `<button class="look${o.pal === lk.pal ? ' on' : ''}${lookOk(o) ? '' : ' locked'}" data-pal="${o.pal}" title="${o.need && !lookOk(o) ? o.need : o.n}"><canvas width="56" height="60"></canvas><span>${o.n}</span>${lookOk(o) ? '' : `<small>${o.need}</small>`}</button>`).join('');
    $('#lk-shapes').innerHTML = SHAPES.map((n, i) => `<button data-shape="${i}" class="${(lk.shape | 0) === i ? 'on' : ''}">${n}</button>`).join('');
    for (const b of $('#lk-list').querySelectorAll('.look')) {
        lookCanvas(b.querySelector('canvas'), +b.dataset.pal, lk.shape | 0);
        b.onclick = () => { const o = LOOKS.find(q => q.pal === +b.dataset.pal); if (!lookOk(o)) { G.toast(o.need); return; } Sound.play('click'); lk.pal = o.pal; SAVE.write(); UI.looks(); };
    }
    for (const b of $('#lk-shapes').querySelectorAll('button')) b.onclick = () => { Sound.play('click'); lk.shape = +b.dataset.shape; SAVE.write(); UI.looks(); };
    lookCanvas($('#lk-big'), LOOKS.some(o => o.pal === lk.pal && lookOk(o)) ? lk.pal : 0, lk.shape | 0);
    $('#lk-n').textContent = LOOKS.filter(lookOk).length + ' of ' + LOOKS.length + ' lights';
    this.show('look');
};
