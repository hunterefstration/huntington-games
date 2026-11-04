// ==========================================
// TYPING RACE: everyone types the same passage. Your car moves with every correct letter. First to the end wins.
// Mistakes turn red and must be fixed (Backspace). Bots type at 30-70 words a minute.
// ==========================================
const PASSAGES = [
    'The quick brown fox jumps over the lazy dog while the cat watches from the warm windowsill.',
    'Every great game starts with a tiny idea, a blank screen and far too many snacks.',
    'Lumi carried the last light through the dark forest, past the moss and over the broken bridge.',
    'In the lighthouse the keepers rang the bell, and somewhere below a shade began to move.',
    'Stock prices rose and fell all morning, but the smart investor simply bought another coffee.',
    'Seven zombies walked into a mall, and only one of them remembered why they came.',
    'A good tank driver checks the map, watches the hills and never forgets the jets above.',
    'The volcano rumbled, the lava glowed, and the scientist took one very careful step back.',
    'Practice makes progress: type a little faster each day and soon your fingers fly.',
    'Grapevine messages zipped across the school as the bell rang for the very last period.',
    'Build the reactor slowly, add the control rods early, and keep plenty of water nearby.',
    'Spikes on the floor, spikes on the ceiling, and a single cube that refuses to give up.'
];
const TR = { text: '', typed: 0, err: '', pos: {}, done: {}, start: 0, on: false, bots: {}, sendT: 0 };
document.getElementById('app').innerHTML = `<div id="tr"><div id="tr-cars"></div><div id="tr-text"></div><input id="tr-in" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Start typing when the light turns green"><div id="tr-msg"></div></div>`;
const inp = document.getElementById('tr-in');
function wpm(chars, ms) { return Math.round(chars / 5 / Math.max(ms / 60000, 1 / 60)); }
function paintCars() {
    const n = TR.text.length || 1;
    document.getElementById('tr-cars').innerHTML = MG.roster.map(p => { const v = TR.pos[p.id] || 0, d = TR.done[p.id];
        return `<div class="tr-lane"><span class="tr-name">${mgEsc(p.name)}${p.id === MG.me ? ' (you)' : ''}</span><div class="tr-track"><span class="tr-car" style="left:calc(${(v / n * 100).toFixed(1)}% - 14px);background:${p.col}">🏎</span></div><span class="tr-w">${d ? d.wpm + ' wpm' : ''}</span></div>`; }).join('');
}
inp.addEventListener('keydown', e => e.stopPropagation());
inp.addEventListener('input', () => {
    if (!TR.on || TR.done[MG.me]) { inp.value = ''; return; }
    // TR.typed = letters already locked in (whole words and their spaces); the box holds the word being typed
    const v = inp.value, t = TR.text;
    let k = 0; while (k < v.length && t[TR.typed + k] === v[k]) k++;
    TR.err = v.slice(k);
    if (!TR.err && v.endsWith(' ')) { TR.typed += v.length; inp.value = ''; k = 0; }
    const at = TR.typed + k; TR.pos[MG.me] = at;
    if (!TR.err && at >= t.length) {
        TR.typed = t.length; inp.value = ''; const ms = performance.now() - TR.start; TR.done[MG.me] = { ms, wpm: wpm(t.length, ms) };
        MG.toHost({ k: 'done', ms }); MGS.win(); document.getElementById('tr-msg').textContent = 'Finished! ' + TR.done[MG.me].wpm + ' wpm';
    }
    paintTextAt(at, TR.err.length); paintCars();
    if (performance.now() - TR.sendT > 150) { TR.sendT = performance.now(); MG.toHost({ k: 'p', n: at }, true); }
});
function paintTextAt(i, e) { const t = TR.text; document.getElementById('tr-text').innerHTML = `<span class="ok">${mgEsc(t.slice(0, i))}</span><span class="bad">${mgEsc(t.slice(i, i + e))}</span><span class="cur">${mgEsc(t.slice(i + e, i + e + 1))}</span>${mgEsc(t.slice(i + e + 1))}`; }
function hostLoop() {
    if (!TR.on || !MG.isHost()) return;
    const el = performance.now() - TR.start;
    for (const p of MG.roster) if (p.bot && !TR.done[p.id]) { const cps = TR.bots[p.id] * 5 / 60; TR.pos[p.id] = Math.min(TR.text.length, Math.floor(el / 1000 * cps)); if (TR.pos[p.id] >= TR.text.length) TR.done[p.id] = { ms: el, wpm: wpm(TR.text.length, el) }; }
    MG.toAll({ k: 'pos', pos: TR.pos, done: TR.done }, true); paintCars();
    const all = MG.roster.every(p => TR.done[p.id]), first = Object.keys(TR.done).length;
    if (all || (first && el > (TR.firstAt || (TR.firstAt = el)) + 20000) || el > 180000) return finish();
    setTimeout(hostLoop, 200);
}
function finish() {
    TR.on = false;
    const rows = MG.roster.slice().sort((a, b) => ((TR.done[a.id] || { ms: 1e12 }).ms - (TR.done[b.id] || { ms: 1e12 }).ms) || ((TR.pos[b.id] || 0) - (TR.pos[a.id] || 0)));
    MG.end(`<h1>${mgEsc(rows[0].name)} wins!</h1>` + rows.map((p, i) => `<div class="mg-res-row"><span>${['🥇', '🥈', '🥉'][i] || (i + 1) + '.'} ${mgEsc(p.name)}</span><b>${TR.done[p.id] ? TR.done[p.id].wpm + ' wpm' : Math.round((TR.pos[p.id] || 0) / TR.text.length * 100) + '%'}</b></div>`).join(''));
}
function begin(seed) {
    const r = mgRng(seed); TR.text = PASSAGES[Math.floor(r() * PASSAGES.length)]; TR.typed = 0; TR.err = ''; TR.pos = {}; TR.done = {}; TR.firstAt = 0; TR.on = false; inp.value = ''; inp.disabled = true;
    for (const p of MG.roster) if (p.bot) TR.bots[p.id] = 30 + Math.floor(r() * 40);
    paintTextAt(0, 0); paintCars();
    let n = 3; const msg = document.getElementById('tr-msg'), tick = () => { if (n > 0) { msg.textContent = n + '...'; MGS.blip(); n--; setTimeout(tick, 800); } else { msg.textContent = 'GO! Type!'; MGS.go(); TR.on = true; TR.start = performance.now(); inp.disabled = false; inp.focus(); if (MG.isHost()) hostLoop(); } };
    tick();
}
MG.init({
    id: 'mg-typing', title: 'Typing Race', color: '#fb923c', min: 2, max: 8, bots: 7, defBots: 3,
    sub: 'Type the passage first. Every correct letter moves your car.', howto: 'When the light turns green, type the passage exactly (spaces too). Mistakes turn red and must be fixed with <b>Backspace</b>. First to finish wins.',
    onStart(roster, seed) { begin(seed); },
    onMsg(from, m) {
        if (MG.isHost() && m.k === 'p') { TR.pos[from] = m.n; }
        else if (MG.isHost() && m.k === 'done') { TR.pos[from] = TR.text.length; TR.done[from] = { ms: m.ms, wpm: wpm(TR.text.length, m.ms) }; }
        else if (m.k === 'pos' && !MG.isHost()) { for (const id in m.pos) if (+id !== MG.me) TR.pos[id] = m.pos[id]; for (const id in m.done) TR.done[id] = m.done[id]; paintCars(); }
    },
    onQuit() { TR.on = false; }, onEnd() { TR.on = false; inp.disabled = true; }
});
