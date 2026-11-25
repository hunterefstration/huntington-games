// ---------- THE OPENING (from the first remaster; the owner, 2026-11-25: "emphasize it being remastered and have the intro from old
// steel storm remastered"): the doors stay shut on a key (sound needs one), the starter turns, the engine catches, the doors part, the
// name is stamped on letter by letter, REMASTERED slams in under it, three lamps come on, a click rolls out.
// Tests (navigator.webdriver) skip it unless the address says ?intro=1; ?nointro skips it for anybody.
const Intro = {
    on: false,
    skip() { const q = location.search; return /[?&]nointro/.test(q) || (navigator.webdriver && !/[?&]intro=1/.test(q)); },
    sleep(ms) { return new Promise(r => setTimeout(r, ms)); },
    key(ms) { return new Promise(r => { let t = 0, iv = 0; const f = () => { removeEventListener('keydown', f, true); removeEventListener('mousedown', f, true); clearTimeout(t); clearInterval(iv); r(); }; addEventListener('keydown', f, true); addEventListener('mousedown', f, true); if (ms) t = setTimeout(f, ms); iv = setInterval(() => { if (M) f(); }, 200); }); },
    tone(f, vol, dur, type, to) { const c = ac(); if (c) try { tone(c, type || 'sine', f, to || f * .5, dur, vol, c.currentTime); } catch (e) {} },
    noise(vol, from, to, dur) { const c = ac(); if (c) try { noiseBurst(c, dur, vol, from, to, 'lowpass', c.currentTime); } catch (e) {} },
    logo() { return '<div class="sslogo big"><div>' + 'STEEL STORM'.split('').map(c => c === ' ' ? '<i></i>' : '<span>' + c + '</span>').join('') + '</div><em>REMASTERED</em></div>'; },
    async run() {
        if (this.skip()) return doorsOpen();
        const b = $('#boot'), s = $('#boot-s'), box = $('#intro'), tx = $('#intro-text'), end = () => { this.on = false; box.classList.add('hidden'); tx.innerHTML = ''; s.classList.remove('press'); doorsOpen(); };
        try {
            this.on = true; clearTimeout(doorsOpen.t); b.classList.remove('hidden'); b.classList.remove('open'); s.textContent = '[ press any key ]'; s.classList.add('press');
            await this.key(); if (M) return end(); s.classList.remove('press'); s.textContent = 'starting engine';
            for (let i = 0; i < 5; i++) { this.noise(.25, 500, 90, .12); this.tone(48 + i * 3, .3, .14, 'sawtooth', 40); await this.sleep(150); }
            this.tone(38, .5, 3.2, 'sawtooth', 62); this.noise(.35, 300, 60, 2.4); await this.sleep(450); if (M) return end();
            box.classList.remove('hidden'); doorsOpen(); this.noise(.5, 1800, 200, 1.3); this.tone(70, .3, 1.3, 'square', 55); await this.sleep(900); if (M) return end();
            tx.innerHTML = this.logo() + '<div class="lamps"><span>ENGINE</span><span>GUN</span><span>CREW</span></div><div class="go">CLICK TO ROLL OUT</div>';
            const L = [...tx.querySelectorAll('.sslogo span')]; for (let i = 0; i < L.length; i++) { await this.sleep(85); L[i].classList.add('in'); this.noise(.5, 3200, 500, .07); this.tone(150 + (i % 3) * 22, .3, .09, 'square', 70); }
            await this.sleep(260); tx.querySelector('.sslogo').classList.add('done'); this.tone(95, .7, 1.3, 'sine', 26); this.noise(.5, 2500, 80, .9); box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
            for (const l of tx.querySelectorAll('.lamps span')) { await this.sleep(330); l.classList.add('on'); this.tone(880, .14, .09, 'square', 880); }
            tx.querySelector('.go').classList.add('in'); await this.sleep(300); await this.key(7000); if (!M) sfx('click');
        } catch (e) { console.error(e); }
        end();
    }
};
