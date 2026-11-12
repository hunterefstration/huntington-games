       // --- AUTO-CLICKER GUARD --- (both variants; the Angel Fingers auto-clicks from the tree are not clicks and never pass through here)
       // Every click that pays (big E, golden E) asks acceptClick() first. It ignores script clicks, clicks past ~15 a second
       // and held keys, and gives a strike for robot-like clicking: clicks are then locked for 20 s per strike (max 120 s).
       // Strikes live in localStorage brownEClicker_ac as a plain number (the launcher drops players with 3 or more from the
       // leaderboard) and go down by one after a clean day of play.
       const AC_KEY = 'brownEClicker_ac';
       const AC_META_KEY = 'brownEClicker_acMeta';
       const AC_RULES = {
           maxPerSec: 15,            // accepted clicks in any 1 s window
           steadyN: 25, steadyMean: 400, steadySd: 6, // 25+ intervals, mean under 400 ms, standard deviation under 6 ms
           burstN: 80, burstMs: 6000, // more than 80 raw clicks in 6 s (13+ a second, sustained)
           untrustedN: 10, untrustedMs: 5000, // script clicks
           lockPer: 20, lockMax: 120, // seconds locked per strike
           decayMs: 86400000, decayPlay: 600 // a strike is forgiven after a day with 10+ minutes of clean play
       };
       const ac = { strikes: 0, lockUntil: 0, accepted: [], raw: [], gaps: [], lastAt: 0, untrusted: [], keysDown: {}, meta: { t: Date.now(), play: 0 }, lockMsgAt: 0 };
       function acLoad() {
           try {
               const n = Number(localStorage.getItem(AC_KEY));
               ac.strikes = isFinite(n) && n > 0 ? Math.min(99, Math.floor(n)) : 0;
               const m = JSON.parse(localStorage.getItem(AC_META_KEY) || 'null');
               if (m && typeof m === 'object') {
                   ac.meta.t = isFinite(m.t) && m.t > 0 ? m.t : Date.now();
                   ac.meta.play = isFinite(m.play) && m.play > 0 ? m.play : 0;
                   ac.lockUntil = isFinite(m.lock) && m.lock > Date.now() ? Math.min(m.lock, Date.now() + AC_RULES.lockMax * 1000) : 0;
               }
           } catch (e) { /* storage blocked */ }
       }
       function acSave() {
           try {
               localStorage.setItem(AC_KEY, String(ac.strikes));
               localStorage.setItem(AC_META_KEY, JSON.stringify({ t: ac.meta.t, play: Math.floor(ac.meta.play), lock: ac.lockUntil }));
           } catch (e) { /* ignore */ }
       }
       acLoad();
       function acLocked() { return Date.now() < ac.lockUntil; }
       function acStrike(why) {
           ac.strikes++;
           const secs = Math.min(AC_RULES.lockMax, AC_RULES.lockPer * ac.strikes);
           ac.lockUntil = Date.now() + secs * 1000;
           ac.meta.t = Date.now(); ac.meta.play = 0;
           ac.accepted.length = 0; ac.raw.length = 0; ac.gaps.length = 0; ac.untrusted.length = 0;
           acSave();
           acToast(`Auto-clicker detected (${why}). Clicks are paused for ${secs} seconds.${ac.strikes >= 3 ? ' You are off the leaderboard until this calms down.' : ''}`);
       }
       function acToast(text) {
           while (toastBox.children.length >= 3) toastBox.removeChild(toastBox.firstChild);
           const t = document.createElement('div');
           t.className = 'toast-in bg-stone-900 border-2 border-red-600 rounded-xl px-2.5 py-1.5 shadow-2xl flex items-center gap-2.5';
           t.dataset.ac = '1';
           t.innerHTML = `<div class="text-2xl">🤖</div><div class="min-w-0"><div class="text-[0.6rem] font-black uppercase tracking-wide text-red-400">Auto-clicker detected</div><div class="text-xs font-bold text-white leading-snug"></div></div>`;
           t.querySelector('.text-xs').textContent = text;
           toastBox.appendChild(t);
           setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 8000);
       }
       // Script clicks (element.click(), dispatchEvent): never pay; a stream of them is a strike
       function acUntrusted() {
           const now = performance.now();
           ac.untrusted.push(now);
           while (ac.untrusted.length && now - ac.untrusted[0] > AC_RULES.untrustedMs) ac.untrusted.shift();
           if (ac.untrusted.length >= AC_RULES.untrustedN && !acLocked()) acStrike('script clicks');
       }
       // kind: 'mouse' | 'touch' | 'key' | 'golden'. Returns true if this click should pay.
       function acceptClick(e, kind) {
           if (!e || e.isTrusted !== true) { acUntrusted(); return false; }
           if (kind === 'key' && e.repeat) return false;
           const now = performance.now();
           if (acLocked()) {
               if (now - ac.lockMsgAt > 1500 && kind !== 'golden') { ac.lockMsgAt = now; createFloatingText(e.clientX ? e : null, `🔒 ${Math.ceil((ac.lockUntil - Date.now()) / 1000)}s`); }
               return false;
           }
           if (kind === 'golden') return true; // rare by design: only the trust and lock checks apply
           // Robot timing: very steady intervals
           const t = typeof e.timeStamp === 'number' && e.timeStamp > 0 ? e.timeStamp : now;
           const gap = t - ac.lastAt;
           ac.lastAt = t;
           if (gap > 1500) ac.gaps.length = 0;
           else if (gap > 0) {
               ac.gaps.push(gap);
               if (ac.gaps.length > 40) ac.gaps.shift();
               if (ac.gaps.length >= AC_RULES.steadyN) {
                   const g = ac.gaps.slice(-AC_RULES.steadyN);
                   let mean = 0; for (let i = 0; i < g.length; i++) mean += g[i]; mean /= g.length;
                   let v = 0; for (let i = 0; i < g.length; i++) v += (g[i] - mean) * (g[i] - mean);
                   const sd = Math.sqrt(v / g.length);
                   if (mean < AC_RULES.steadyMean && sd < AC_RULES.steadySd) { acStrike('perfectly steady clicking'); return false; }
               }
           }
           // Sustained machine-gun clicking
           ac.raw.push(now);
           while (ac.raw.length && now - ac.raw[0] > AC_RULES.burstMs) ac.raw.shift();
           if (ac.raw.length > AC_RULES.burstN) { acStrike('too many clicks for too long'); return false; }
           // Hard cap: at most 15 paid clicks in any second
           while (ac.accepted.length && now - ac.accepted[0] > 1000) ac.accepted.shift();
           if (ac.accepted.length >= AC_RULES.maxPerSec) return false;
           ac.accepted.push(now);
           return true;
       }
       // Called once a second while playing: forgive one strike after a clean day with some play
       function acSecond() {
           if (ac.strikes <= 0 || acLocked()) return;
           ac.meta.play++;
           if (Date.now() - ac.meta.t >= AC_RULES.decayMs && ac.meta.play >= AC_RULES.decayPlay) {
               ac.strikes--;
               ac.meta.t = Date.now(); ac.meta.play = 0;
               acSave();
           } else if (ac.meta.play % 30 === 0) acSave();
       }
       // Holding Enter / Space on a focused button repeats its click: one real key press = one click
       document.addEventListener('keydown', (e) => {
           if (e.repeat && (e.key === 'Enter' || e.key === ' ') && e.target && e.target.closest && e.target.closest('button,[role="button"]')) e.preventDefault();
       }, true);

