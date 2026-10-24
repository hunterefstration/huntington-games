// ==========================================
// 1b. AUDIO (tiny synth, no files needed)
// ==========================================
let actx = null, noiseBuf = null, master = null;
function initAudio() {
    if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        actx = new AC();
        master = actx.createGain(); master.gain.value = settings.volume; master.connect(actx.destination);
        noiseBuf = actx.createBuffer(1, actx.sampleRate * 1.5, actx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { actx = null; }
}
function sfxNoise(dur, freq, vol, sweepTo, delay = 0) {
    if (!actx) return;
    const t = actx.currentTime + delay;
    const src = actx.createBufferSource(); src.buffer = noiseBuf;
    const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = actx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + dur);
}
function sfxTone(type, f0, f1, dur, vol, delay = 0) {
    if (!actx) return;
    const t = actx.currentTime + delay;
    const o = actx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = actx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur);
}
// a sound from somewhere else in the world (other players' guns): quieter the further away it is
function sfxAt(name, dist) {
    if (!actx || dist > 95) return;
    const g = actx.createGain(); g.gain.value = Math.pow(1 - dist / 95, 1.6) * 0.8; g.connect(master);
    const m = master; master = g;
    try { sfx(name); } finally { master = m; }
    setTimeout(() => g.disconnect(), 2500);
}
function sfx(name) {
    try {
        switch (name) {
            case 'pistol':   sfxNoise(0.12, 3000, 0.25, 400); sfxTone('square', 220, 60, 0.08, 0.12); break;
            case 'revolver': sfxNoise(0.4, 2600, 0.45, 120); sfxTone('sawtooth', 110, 38, 0.28, 0.24); sfxNoise(0.6, 500, 0.08, 60, 0.08); break;
            case 'smg':      sfxNoise(0.07, 3500, 0.18, 600); sfxTone('square', 260, 90, 0.05, 0.08); break;
            case 'ar':       sfxNoise(0.1, 2600, 0.24, 350); sfxTone('square', 180, 50, 0.08, 0.12); break;
            case 'burst':    sfxNoise(0.08, 3100, 0.22, 420); sfxTone('square', 210, 60, 0.06, 0.1); break;
            case 'shotgun':  sfxNoise(0.38, 1700, 0.5, 120); sfxTone('sawtooth', 110, 32, 0.25, 0.26); break;
            case 'dmr':      sfxNoise(0.26, 3200, 0.36, 200); sfxTone('sawtooth', 150, 45, 0.18, 0.18); break;
            case 'lmg':      sfxNoise(0.11, 2200, 0.26, 300); sfxTone('square', 150, 45, 0.08, 0.12); break;
            case 'sniper':   sfxNoise(0.5, 4000, 0.45, 110); sfxTone('sawtooth', 150, 28, 0.35, 0.25); sfxNoise(1.1, 600, 0.1, 50, 0.12); break;
            case 'minigun':  sfxNoise(0.05, 4200, 0.15, 900); sfxTone('square', 300, 120, 0.04, 0.05); break;
            case 'spin':     sfxTone('sawtooth', 70, 320, 0.5, 0.05); break;
            case 'boom':     sfxNoise(0.9, 900, 0.6, 40); sfxTone('sine', 90, 25, 0.6, 0.5); break;
            case 'hit':      sfxTone('square', 900, 600, 0.04, 0.05); break;
            case 'head':     sfxTone('square', 1400, 900, 0.07, 0.08); break;
            case 'kill':     sfxTone('triangle', 500, 900, 0.1, 0.1); break;
            case 'headkill': sfxTone('triangle', 900, 1800, 0.12, 0.1); sfxTone('sine', 1800, 1800, 0.15, 0.05, 0.05); break;
            case 'hurt':     sfxTone('sawtooth', 140, 60, 0.2, 0.2); break;
            case 'pickup':   sfxTone('sine', 700, 1100, 0.12, 0.12); break;
            case 'heal':     sfxTone('sine', 400, 1000, 0.35, 0.15); break;
            case 'reload':   sfxTone('square', 300, 200, 0.05, 0.06); break;
            case 'magout':   sfxTone('square', 260, 180, 0.05, 0.06); sfxNoise(0.05, 2000, 0.05); break;
            case 'magin':    sfxTone('square', 420, 300, 0.04, 0.08); sfxNoise(0.04, 3000, 0.06); break;
            case 'rack':     sfxNoise(0.07, 3000, 0.1, 900); sfxTone('square', 520, 260, 0.05, 0.07, 0.06); break;
            case 'shell':    sfxTone('square', 520, 320, 0.04, 0.07); sfxNoise(0.05, 3000, 0.05); break;
            case 'pump':     sfxNoise(0.08, 2500, 0.12, 800); sfxTone('square', 180, 120, 0.05, 0.08); sfxNoise(0.07, 2500, 0.1, 800, 0.12); break;
            case 'bolt':     sfxTone('square', 420, 250, 0.05, 0.07); sfxTone('square', 330, 500, 0.05, 0.06, 0.18); break;
            case 'dry':      sfxTone('square', 1600, 1500, 0.02, 0.05); break;
            case 'swap':     sfxNoise(0.1, 1800, 0.06, 500); sfxTone('square', 300, 200, 0.04, 0.04); break;
            case 'throw':    sfxNoise(0.15, 1200, 0.1, 300); break;
            case 'thump':    sfxTone('sine', 200, 70, 0.18, 0.3); sfxNoise(0.12, 800, 0.15, 200); break;
            case 'beep':     sfxTone('square', 1200, 1200, 0.06, 0.08); break;
            case 'deny':     sfxTone('square', 160, 120, 0.12, 0.08); break;
            case 'wave':     sfxTone('triangle', 440, 880, 0.4, 0.15); break;
            case 'spit':     sfxTone('sine', 500, 150, 0.2, 0.06); break;
            case 'slide':    sfxNoise(0.45, 1300, 0.14, 250); break;
            case 'growl':    sfxTone('sawtooth', 95, 55, 0.7, 0.16); sfxNoise(0.6, 400, 0.12, 100); break;
            case 'charge':   sfxNoise(0.6, 800, 0.22, 150); break;
            case 'thud':     sfxTone('sine', 120, 40, 0.3, 0.35); sfxNoise(0.25, 700, 0.2, 100); break;
            case 'lock':     sfxTone('sine', 1500, 1500, 0.07, 0.05); break;
            case 'laser':    sfxTone('sawtooth', 2200, 300, 0.18, 0.12); sfxNoise(0.2, 5000, 0.12, 800); break;
            case 'medic':    sfxTone('sine', 600, 1200, 0.3, 0.07); break;
            case 'scream':   sfxTone('sawtooth', 700, 1700, 0.55, 0.09); sfxNoise(0.5, 3000, 0.1, 400); break;
            case 'roar':     sfxTone('sawtooth', 130, 38, 1.3, 0.22); sfxTone('square', 65, 30, 1.2, 0.12); sfxNoise(1.1, 380, 0.22, 60); break;
            case 'minigun':  sfxNoise(0.05, 2800, 0.14, 600); sfxTone('square', 150, 70, 0.04, 0.06); break;
            case 'cloak':    sfxTone('sine', 1100, 160, 0.55, 0.12); sfxNoise(0.4, 4000, 0.05, 800); break;
            case 'warn':     sfxTone('square', 920, 920, 0.09, 0.06); sfxTone('square', 920, 920, 0.09, 0.06, 0.14); break;
            case 'crossbow': sfxTone('triangle', 320, 110, 0.14, 0.13); sfxNoise(0.08, 2600, 0.08, 500); break;
            case 'flamer':   sfxNoise(0.09, 900, 0.07, 200); break;
            case 'ting':     sfxTone('triangle', 2400, 1800, 0.1, 0.06); break;
            case 'slam':     sfxNoise(0.5, 500, 0.4, 40); sfxTone('sine', 70, 30, 0.4, 0.4); break;
            case 'supply':   sfxTone('triangle', 660, 990, 0.2, 0.12); sfxTone('triangle', 990, 1320, 0.25, 0.1, 0.18); break;
            case 'power':    sfxTone('triangle', 500, 1500, 0.4, 0.15); sfxTone('sine', 750, 2200, 0.4, 0.08, 0.1); break;
            case 'upgrade':  sfxTone('triangle', 520, 1040, 0.15, 0.12); sfxTone('triangle', 780, 1560, 0.2, 0.1, 0.1); break;
            case 'melee':    sfxNoise(0.12, 1500, 0.2, 300); sfxTone('sine', 160, 60, 0.12, 0.2); break;
            case 'whoosh':   sfxNoise(0.18, 2500, 0.08, 600); break;
            case 'thunder':  sfxNoise(2.2, 260, 0.45, 35, 0.3 + Math.random() * 0.8); break;
            case 'fire':     sfxNoise(0.6, 900, 0.18, 200); sfxTone('sawtooth', 90, 40, 0.3, 0.08); break;
            case 'turret':   sfxNoise(0.05, 3800, 0.1, 900); sfxTone('square', 420, 150, 0.04, 0.04); break;
            case 'deploy':   sfxTone('square', 300, 600, 0.12, 0.08); sfxTone('square', 600, 900, 0.12, 0.06, 0.12); break;
            case 'whistle':  sfxTone('sine', 1800, 500, 1.3, 0.06); break;
            case 'strike':   sfxTone('triangle', 400, 800, 0.2, 0.12); sfxTone('triangle', 800, 1200, 0.25, 0.1, 0.18); break;
            case 'click':    sfxTone('square', 900, 700, 0.03, 0.04); break;
            case 'rpg':      sfxNoise(0.7, 1400, 0.45, 90); sfxTone('sawtooth', 90, 40, 0.4, 0.22); sfxNoise(0.9, 3000, 0.08, 300, 0.05); break;
            case 'pop':      sfxNoise(0.14, 1800, 0.14, 300); sfxTone('sine', 160, 60, 0.12, 0.12); break;
            case 'orb':      sfxTone('sine', 880, 1320, 0.25, 0.06); sfxTone('sine', 1320, 1760, 0.25, 0.04, 0.12); break;
            case 'mine':     sfxTone('square', 700, 900, 0.06, 0.07); sfxTone('square', 900, 1200, 0.06, 0.06, 0.09); break;
            // 4.0 class abilities
            case 'adren':    sfxTone('sawtooth', 80, 320, 0.55, 0.16); sfxTone('square', 220, 880, 0.4, 0.05, 0.05); sfxNoise(0.5, 2200, 0.14, 300); sfxTone('sine', 70, 40, 0.14, 0.4, 0.45); break;
            case 'beat':     sfxTone('sine', 72, 40, 0.13, 0.32); sfxTone('sine', 66, 38, 0.11, 0.22, 0.15); break;
            case 'field':    sfxTone('sine', 520, 1040, 0.5, 0.12); sfxTone('triangle', 780, 1560, 0.6, 0.08, 0.12); sfxTone('sine', 1040, 2080, 0.5, 0.05, 0.26); break;
            case 'mend':     sfxTone('sine', 880, 1320, 0.14, 0.035); break;
            case 'kit':      sfxTone('sine', 200, 70, 0.18, 0.3); sfxNoise(0.12, 800, 0.15, 200); sfxTone('square', 300, 600, 0.12, 0.07, 0.12); sfxTone('square', 600, 900, 0.12, 0.05, 0.24); break;
            case 'resupply': sfxTone('square', 420, 300, 0.04, 0.08); sfxNoise(0.05, 3000, 0.06); sfxTone('triangle', 600, 1200, 0.2, 0.1, 0.06); break;
            case 'radar':    sfxTone('sine', 1250, 1180, 0.7, 0.16); sfxTone('sine', 1250, 1180, 0.5, 0.06, 0.38); sfxTone('sine', 1250, 1180, 0.4, 0.025, 0.76); sfxTone('sawtooth', 160, 900, 0.3, 0.035); break;
            case 'ready':    sfxTone('triangle', 660, 990, 0.12, 0.08); sfxTone('triangle', 990, 1320, 0.15, 0.07, 0.1); break;
            // 4.0 weapons
            case 'dual':     sfxNoise(0.1, 3300, 0.2, 450); sfxTone('square', 250, 70, 0.07, 0.09); break;
            case 'katana':   sfxNoise(0.16, 5200, 0.12, 900); sfxTone('sine', 900, 300, 0.12, 0.03); break;
            case 'slice':    sfxNoise(0.08, 6000, 0.16, 1500); sfxTone('triangle', 1700, 900, 0.07, 0.05); sfxTone('sine', 140, 60, 0.1, 0.12); break;
            case 'lunge':    sfxNoise(0.35, 2600, 0.2, 400); sfxTone('sawtooth', 160, 520, 0.22, 0.05); sfxTone('triangle', 2400, 1200, 0.18, 0.04, 0.05); break;
            case 'glauncher': sfxTone('sine', 240, 60, 0.22, 0.42); sfxNoise(0.2, 1100, 0.24, 160); sfxTone('square', 120, 50, 0.1, 0.08); break;
            case 'clink':    sfxTone('triangle', 1250 + Math.random() * 300, 900, 0.05, 0.05); break;
            case 'tesla':    sfxNoise(0.11, 7000, 0.14, 1800); sfxTone('sawtooth', 1900 + Math.random() * 500, 420, 0.09, 0.06); sfxTone('square', 95, 60, 0.07, 0.07); break;
            case 'railgun':  sfxTone('sawtooth', 2600, 70, 0.55, 0.24); sfxNoise(0.6, 9000, 0.3, 300); sfxTone('sine', 110, 30, 0.6, 0.45); sfxTone('triangle', 3200, 2400, 0.4, 0.05, 0.05); break;
            case 'railfull': sfxTone('triangle', 1500, 1800, 0.12, 0.06); break;
        }
    } catch (e) {}
}
// 4.0 Railgun: a rising charge whine that keeps humming at full charge until you let go
function sfxHum(dur) {
    if (!actx) return null;
    try {
        const t = actx.currentTime;
        const o = actx.createOscillator(), o2 = actx.createOscillator(), g = actx.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(1300, t + dur);
        o2.type = 'sine'; o2.frequency.setValueAtTime(280, t); o2.frequency.exponentialRampToValueAtTime(2600, t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + Math.min(0.2, dur));
        o.connect(g); o2.connect(g); g.connect(master); o.start(t); o2.start(t);
        return { o, o2, g };
    } catch (e) { return null; }
}
function stopHum(h) {
    if (!h || !actx) return;
    try { const t = actx.currentTime; h.g.gain.cancelScheduledValues(t); h.g.gain.setValueAtTime(Math.max(0.0001, h.g.gain.value), t); h.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08); h.o.stop(t + 0.1); h.o2.stop(t + 0.1); } catch (e) {}
}
