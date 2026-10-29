// ===================== Worlds: a new background every 20 levels, and music =====================
// 1-20 Midnight Grid, 21-40 Sunset Dunes, 41-60 Deep Sea, 61-80 Toxic Lab, 81-100 Inferno (Endless keeps cycling).
// Each world also has its own song: a little chiptune made on the fly with WebAudio (no files to load).
const THEMES = [
    { name: 'Midnight Grid', top: '#0f172a', bot: '#1e1b4b', line: '56, 189, 248', bpm: 124, root: 45, scale: [0, 3, 5, 7, 10], wave: 'square' },
    { name: 'Sunset Dunes', top: '#1a0b2e', bot: '#7c2d12', line: '251, 146, 60', bpm: 112, root: 50, scale: [0, 2, 4, 7, 9], wave: 'triangle' },
    { name: 'Deep Sea', top: '#021526', bot: '#03346e', line: '125, 211, 252', bpm: 100, root: 43, scale: [0, 2, 3, 7, 8], wave: 'sine' },
    { name: 'Toxic Lab', top: '#04150b', bot: '#1a2e05', line: '163, 230, 53', bpm: 136, root: 47, scale: [0, 1, 5, 7, 10], wave: 'square' },
    { name: 'Inferno', top: '#160303', bot: '#4c0519', line: '248, 113, 113', bpm: 148, root: 40, scale: [0, 1, 4, 5, 7, 8], wave: 'sawtooth' }
];
function themeIndex() {
    const lv = (typeof mpLevel === 'function' && mpLevel()) || (playMode === 'campaign' ? currentLevel : 0);
    if (!lv) return 0;
    return Math.floor((lv - 1) / 20) % THEMES.length;
}
let themeKey = '', themeFx = [];
function drawThemeBg() {
    const ti = themeIndex(), T = THEMES[ti], H = canvas.height, W = canvas.width;
    if (!bgGradient || themeKey !== ti + '|' + H) {
        themeKey = ti + '|' + H;
        bgGradient = ctx.createLinearGradient(0, 0, 0, H);
        bgGradient.addColorStop(0, T.top); bgGradient.addColorStop(1, T.bot);
        // a fixed set of decorations per world (positions in "parallax space")
        let seed = 7 + ti * 101; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        themeFx = Array.from({ length: 46 }, () => ({ x: r() * 2400, y: r() * H, s: 0.4 + r() * 1.6, p: r() * 6.28 }));
    }
    ctx.fillStyle = bgGradient; ctx.fillRect(0, 0, W, H);
    const t = levelTick / 60, cx = camera.x;
    ctx.save();
    if (ti === 0) {                 // the original neon grid
        ctx.strokeStyle = 'rgba(' + T.line + ', 0.03)'; ctx.lineWidth = 1;
        let o1 = -(cx * 0.1) % 100; ctx.beginPath(); for (let x = o1; x < W; x += 100) { ctx.moveTo(x, 0); ctx.lineTo(x, H); } ctx.stroke();
        ctx.strokeStyle = 'rgba(' + T.line + ', 0.07)';
        let o2 = -(cx * 0.3) % 60; ctx.beginPath(); for (let x = o2; x < W; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, H); } ctx.stroke();
    } else if (ti === 1) {          // a low sun and two layers of dunes
        const sx = W * 0.72 - (cx * 0.02) % W;
        const sg = ctx.createRadialGradient(sx, H * 0.62, 10, sx, H * 0.62, 150);
        sg.addColorStop(0, 'rgba(253, 186, 116, 0.9)'); sg.addColorStop(0.4, 'rgba(249, 115, 22, 0.35)'); sg.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = sg; ctx.fillRect(sx - 150, H * 0.62 - 150, 300, 300);
        for (const [k, a, amp, base] of [[0.08, 'rgba(67, 20, 7, 0.55)', 40, 0.78], [0.2, 'rgba(41, 12, 4, 0.8)', 28, 0.88]]) {
            ctx.fillStyle = a; ctx.beginPath(); ctx.moveTo(0, H);
            for (let x = 0; x <= W; x += 24) ctx.lineTo(x, H * base - Math.sin((x + cx * k) * 0.006) * amp - Math.sin((x + cx * k) * 0.017) * amp * 0.35);
            ctx.lineTo(W, H); ctx.fill();
        }
    } else if (ti === 2) {          // light rays from above and bubbles drifting up
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i++) {
            const x = ((i * 260 - cx * 0.05) % (W + 300) + W + 300) % (W + 300) - 150, w = 60 + 30 * Math.sin(t * 0.5 + i);
            ctx.fillStyle = 'rgba(125, 211, 252, 0.035)'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w, 0); ctx.lineTo(x + w * 2.4 - 80, H); ctx.lineTo(x - 80, H); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.28)'; ctx.lineWidth = 1.5;
        for (const b of themeFx) {
            const x = ((b.x - cx * 0.25 * b.s) % W + W) % W + Math.sin(t * 1.3 + b.p) * 6, y = ((b.y - t * 30 * b.s) % H + H) % H;
            ctx.beginPath(); ctx.arc(x, y, 1.5 + b.s * 2.2, 0, 6.283); ctx.stroke();
        }
    } else if (ti === 3) {          // a hex grid that pulses, and slow toxic drips
        ctx.strokeStyle = 'rgba(' + T.line + ', ' + (0.05 + 0.025 * Math.sin(t * 2)) + ')'; ctx.lineWidth = 1;
        const R = 34, hw = R * 1.732, ox = -(cx * 0.2) % hw;
        ctx.beginPath();
        for (let row = -1; row * R * 1.5 < H + R; row++) for (let col = -1; col * hw < W + hw; col++) {
            const x = ox + col * hw + (row & 1 ? hw / 2 : 0), y = row * R * 1.5;
            for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k + Math.PI / 6, px = x + R * Math.cos(a), py = y + R * Math.sin(a); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
            ctx.closePath();
        }
        ctx.stroke();
        ctx.fillStyle = 'rgba(163, 230, 53, 0.35)';
        for (const b of themeFx.slice(0, 18)) { const x = ((b.x - cx * 0.3) % W + W) % W, y = ((b.y + t * 40 * b.s) % (H + 40)) - 20; ctx.fillRect(x, y, 2, 8 + b.s * 6); }
    } else {                        // embers rising over a lava glow
        const lg = ctx.createLinearGradient(0, H * 0.7, 0, H);
        lg.addColorStop(0, 'rgba(239, 68, 68, 0)'); lg.addColorStop(1, 'rgba(249, 115, 22, ' + (0.28 + 0.06 * Math.sin(t * 3)) + ')');
        ctx.fillStyle = lg; ctx.fillRect(0, H * 0.7, W, H * 0.3);
        ctx.globalCompositeOperation = 'lighter';
        for (const b of themeFx) {
            const x = ((b.x - cx * 0.35 * b.s) % W + W) % W + Math.sin(t * 2 + b.p) * 10, y = H - ((b.y + t * 55 * b.s) % H);
            ctx.fillStyle = 'rgba(251, ' + (120 + (b.s * 60 | 0)) + ', 60, ' + (0.25 + 0.5 * (y / H)) + ')';
            ctx.fillRect(x, y, 1.5 + b.s, 1.5 + b.s);
        }
    }
    ctx.restore();
}

// ---- music ----
const MUSIC_KEY = 'spikes100_music';
const Music = { ctx: null, gain: null, on: (() => { try { return localStorage.getItem(MUSIC_KEY) !== 'off'; } catch (e) { return true; } })(), theme: -1, step: 0, next: 0, timer: 0 };
function musicStart() {
    if (!Music.on) return;
    try {
        if (!Music.ctx) { Music.ctx = new (window.AudioContext || window.webkitAudioContext)(); Music.gain = Music.ctx.createGain(); Music.gain.gain.value = 0.16; Music.gain.connect(Music.ctx.destination); }
        if (Music.ctx.state === 'suspended') Music.ctx.resume();
    } catch (e) { return; }
    if (!Music.timer) { Music.next = Music.ctx.currentTime + 0.1; Music.timer = setInterval(musicTick, 50); }
}
function musicStop() { clearInterval(Music.timer); Music.timer = 0; }
function musicToggle() {
    Music.on = !Music.on; try { localStorage.setItem(MUSIC_KEY, Music.on ? 'on' : 'off'); } catch (e) {}
    if (Music.on) musicStart(); else musicStop();
    const b = document.getElementById('musicBtn'); if (b) b.textContent = Music.on ? '♪ Music: on' : '♪ Music: off';
    showToast(Music.on ? 'Music on (M)' : 'Music off (M)');
}
function mnote(f, t, len, type, vol, slideTo) {
    const c = Music.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(Music.gain); o.start(t); o.stop(t + len + 0.02);
}
function mnoise(t, len, vol) {
    const c = Music.ctx; if (!Music.nb) { Music.nb = c.createBuffer(1, c.sampleRate * 0.2, c.sampleRate); const d = Music.nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = c.createBufferSource(), g = c.createGain(), hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
    s.buffer = Music.nb; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(hp); hp.connect(g); g.connect(Music.gain); s.start(t); s.stop(t + len);
}
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
function musicTick() {
    const c = Music.ctx; if (!c) return;
    const quiet = gameState === 'MENU' || gameState === 'PAUSED' || gameState === 'EDITOR' || document.hidden;
    Music.gain.gain.setTargetAtTime(quiet ? 0.0001 : 0.16, c.currentTime, 0.3);
    const ti = themeIndex(), T = THEMES[ti];
    if (ti !== Music.theme) { Music.theme = ti; Music.step = 0; }
    const sixteenth = 60 / T.bpm / 4;
    while (Music.next < c.currentTime + 0.25) {
        const t = Music.next, st = Music.step % 64, bar = Math.floor(st / 16), beat = st % 16;
        const prog = [0, 3, 4, 2][bar], sc = T.scale, deg = d => T.root + sc[((d % sc.length) + sc.length) % sc.length] + 12 * Math.floor(d / sc.length);
        if (!quiet) {
            if (beat % 4 === 0) mnote(150, t, 0.16, 'sine', 0.6, 40);                               // kick
            if (beat % 4 === 2) mnoise(t, 0.04, 0.12);                                               // hat
            if (beat === 4 || beat === 12) mnoise(t, 0.12, 0.2);                                     // snare-ish
            if (beat % 2 === 0) mnote(midi(deg(prog) - 12), t, sixteenth * 1.8, 'triangle', 0.28);  // bass
            // the lead: an arpeggio that changes each bar, with a little seeded variation per world
            const pat = [0, 2, 4, 2, 1, 3, 5, 3][(beat + bar * 3 + ti) % 8];
            if ((beat + ti) % 3 !== 1) mnote(midi(deg(prog + pat) + 12), t, sixteenth * 0.9, T.wave, T.wave === 'sawtooth' ? 0.05 : 0.07);
        }
        Music.next += sixteenth; Music.step++;
    }
}
// music starts with the first key press or click (browsers need one), M toggles it
addEventListener('keydown', e => { if (e.code === 'KeyM' && !(e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName))) { musicToggle(); return; } musicStart(); }, true);
addEventListener('pointerdown', () => musicStart(), true);
(function () {
    const b = document.createElement('button'); b.id = 'musicBtn'; b.className = 'btn-small btn-grey'; b.textContent = Music.on ? '♪ Music: on' : '♪ Music: off';
    b.onclick = e => { e.stopPropagation(); musicToggle(); };
    const rows = document.querySelectorAll('#startScreen .menu-row'), row = rows[rows.length - 1]; if (row) row.appendChild(b);
})();
