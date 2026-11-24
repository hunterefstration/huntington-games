// ===== Training (2026-11-16): the coach-mark engine. A copy of Beat Lab's 80-tutor.js look and behaviour, made game-agnostic =====
// (Steel Storm 88-tutor.js and Blocky Shooter V2 31-tutor.js are the same file; keep them in step.)
//   Tutor.config({ done(id), mark(id), z })                      where "lessons done" live (the game's own save)
//   Tutor.define({ id, title, blurb, steps: [step], end: 'finale html', next: lessonId, coach: true|false,
//                  begin() -> false to refuse (e.g. start a practice match), finish(how) (clean up: leave the practice match),
//                  alive() -> false once the player left the lesson's world (Quit to menu...) })
//   step: { title, text (html), el: selector | Element | () => Element | rect | null (what to ring), enter() (on arrival),
//           base() -> snapshot taken on arrival, wait(base) -> true once the player has done it (polled every 150 ms),
//           when() -> false skips the step (e.g. no bombs on this plane), coach (override the lesson's mode), at: 'br'|'bl'|'tr'|'tl',
//           free (no click shield), act: [label, fn] (a helper button in the bubble, e.g. "Self-destruct") }
//   coach mode (gameplay): no dimming, no click shields, a compact banner in a corner and a pulsing ring; spotlight mode (menus):
//   the screen dims around the target, clicks outside it nudge the bubble. Esc always leaves the lesson.
//   Tutor.start(id) / stop(how) / next() / back(); Tutor.active; Tutor.lesson; Tutor.i; Tutor.done(id); Tutor.list;
//   Tutor.offer({ title, text, les, kicker, time, answer(yes) }); Tutor.hub({ title, intro })
const Tutor = (() => {
    const LES = [], S = { les: null, i: 0, dir: 1, base: null, doneAt: 0, iv: 0, sig: '', el: null, hub: null, offer: null };
    const C = { done: () => false, mark: () => {}, z: 9000, nextKey: '' };      // nextKey: in battle the mouse is captured, so a key does Next
    const q = s => document.querySelector(s);
    const cl = (v, a, b) => v < a ? a : v > b ? b : v;
    function mk(tag, attrs, ...kids) {
        const e = document.createElement(tag);
        for (const k in attrs || {}) { const v = attrs[k]; if (v == null || v === false) continue; if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v); }
        for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : String(c));
        return e;
    }
    const btn = (t, cls, f, title) => mk('button', { class: 'hgt-btn' + (cls ? ' ' + cls : ''), type: 'button', title, onclick: e => { e.stopPropagation(); f(); } }, t);
    const coachOf = st => st && st.coach !== undefined ? !!st.coach : !!(S.les && S.les.coach);
    const err = e => { try { console.warn('[training]', e); } catch (e2) {} };

    function start(id) {
        const les = LES.find(l => l.id === id); if (!les) return false;
        closeHub(); hideOffer();
        if (S.les) stop('switch');
        let ok = true; try { if (les.begin) ok = les.begin() !== false; } catch (e) { err(e); ok = false; }
        if (!ok) return false;
        S.les = les; S.dir = 1;
        overlay();
        go(0);
        S.iv = setInterval(tick, 150);
        return true;
    }
    function stop(how) {                                         // how: skip | done | left | switch
        const les = S.les; if (!les) return;
        clearInterval(S.iv); S.les = null;
        if (S.el) { S.el.root.remove(); S.el = null; }
        try { if (les.finish) les.finish(how || 'skip'); } catch (e) { err(e); }
    }
    function overlay() {
        if (S.el) S.el.root.remove();
        const shield = () => mk('div', { class: 'hgt-shield', onpointerdown: e => { e.preventDefault(); e.stopPropagation(); nudge(); } });
        const sh = [shield(), shield(), shield(), shield()];
        const hole = mk('div', { class: 'hgt-hole' });
        const lesson = mk('span', { class: 'hgt-les' }), prog = mk('span', { class: 'hgt-prog' }), title = mk('h4'), text = mk('p'), task = mk('div', { class: 'hgt-task' });
        const skip = mk('button', { class: 'hgt-skip', type: 'button', title: 'Leave the lesson (Esc)', onclick: e => { e.stopPropagation(); stop(S.i >= S.les.steps.length ? 'done' : 'skip'); } }, 'Skip lesson');
        const back = btn('Back', '', () => { S.dir = -1; go(S.i - 1); });
        const next = btn('Next', 'pri', () => { S.dir = 1; go(S.i + 1); });
        const extra = mk('div', { class: 'hgt-end' });
        const bub = mk('div', { class: 'hgt-bubble', role: 'dialog', 'aria-live': 'polite', onpointerdown: e => e.stopPropagation(), onmousedown: e => e.stopPropagation(), onclick: e => e.stopPropagation() },
            mk('div', { class: 'hgt-top' }, lesson, prog), title, text, task, extra, mk('div', { class: 'hgt-btns' }, skip, mk('span', { class: 'hgt-sp' }), back, next));
        const root = mk('div', { id: 'hgt', style: 'z-index:' + C.z }, sh, hole, bub);
        document.body.appendChild(root);
        S.el = { root, sh, hole, bub, lesson, prog, title, text, task, skip, back, next, extra };
    }
    function nudge() { const b = S.el && S.el.bub; if (!b) return; b.classList.remove('nudge'); void b.offsetWidth; b.classList.add('nudge'); }
    function go(i) {
        const les = S.les; if (!les || !S.el) return;
        const n = les.steps.length;
        // steps that do not apply right now (when() false) are passed over in the direction of travel
        while (i >= 0 && i < n && les.steps[i].when) { let w = true; try { w = !!les.steps[i].when(); } catch (e) {} if (w) break; i += S.dir < 0 ? -1 : 1; }
        if (i < 0) { S.dir = 1; return go(0); }
        if (i > n) return stop('done');
        S.i = i; S.doneAt = 0; S.sig = '';
        const E = S.el; E.extra.innerHTML = '';
        E.lesson.textContent = les.title;
        if (i === n) {                                            // the finale: the lesson counts as done
            try { C.mark(les.id); } catch (e) { err(e); }
            try { if (les.atEnd) les.atEnd(); } catch (e) { err(e); }          // e.g. leave the practice match so the mouse is free
            const nx = les.next && LES.find(l => l.id === les.next);
            E.root.classList.remove('coach'); E.root.classList.add('final');
            E.prog.textContent = 'Done!'; E.title.textContent = 'Lesson complete'; E.text.innerHTML = les.end || 'Nice work!';
            E.task.className = 'hgt-task hidden';
            E.extra.append(btn('All lessons', '', () => { stop('done'); setTimeout(() => hub(), 30); }));
            if (nx) E.extra.append(btn('Next: ' + nx.title, 'pri', () => start(nx.id)));
            E.skip.textContent = 'Close';
            E.next.classList.add('hidden'); E.back.classList.remove('hidden');
            place(true);
            return;
        }
        E.root.classList.remove('final');
        const st = les.steps[i];
        try { if (st.enter) st.enter(); } catch (e) { err(e); }
        S.base = null; try { if (st.base) S.base = st.base(); } catch (e) { err(e); }
        if (S.base == null) S.base = {};
        E.root.classList.toggle('coach', coachOf(st));
        E.prog.textContent = (i + 1) + ' of ' + n;
        E.title.textContent = st.title || '';
        E.text.innerHTML = st.text || '';
        E.skip.textContent = 'Skip lesson';
        E.back.classList.toggle('hidden', i === 0); E.next.classList.remove('hidden');
        if (st.act) E.extra.append(btn(st.act[0], '', () => { try { st.act[1](); } catch (e) { err(e); } }));
        let pre = false;
        if (st.wait) { try { pre = !!st.wait(S.base); } catch (e) {} }
        if (st.wait && pre) S.doneAt = -1;                       // already done (e.g. coming Back): no auto-advance, just Next
        taskUi(st, pre);
        place(true);
    }
    function taskUi(st, done) {
        const E = S.el, last = S.i === S.les.steps.length - 1;
        const k = C.nextKey && coachOf(st) ? ' (' + C.nextKey + ')' : '';
        if (!st.wait) { E.task.className = 'hgt-task hidden'; E.next.textContent = (last ? 'Finish' : 'Next') + k; E.next.className = 'hgt-btn pri'; return; }
        E.task.className = 'hgt-task' + (done ? ' ok' : '');
        E.task.textContent = done ? '✓ Nice!' : 'Your turn: do it and the lesson moves on';
        E.next.textContent = (done ? (last ? 'Finish' : 'Next') : 'Skip step') + k;
        E.next.className = 'hgt-btn' + (done ? ' pri' : ' ghost');
    }
    function tick() {
        const les = S.les; if (!les) return;
        if (S.i >= les.steps.length) return;                     // the finale waits for the player
        let alive = true; try { if (les.alive) alive = les.alive() !== false; } catch (e) {}
        if (!alive) return stop('left');
        const st = les.steps[S.i];
        if (st && st.enter && st.el && !coachOf(st) && !target(st)) { try { st.enter(); } catch (e) {} }     // the player wandered to another view
        place(false);
        if (!st || !st.wait || S.doneAt) return;
        let ok = false; try { ok = !!st.wait(S.base); } catch (e) {}
        if (!ok) return;
        S.doneAt = performance.now(); taskUi(st, true);
        const at = S.i;
        setTimeout(() => { if (S.les === les && S.i === at) { S.dir = 1; go(at + 1); } }, 800);
    }
    function target(st) {
        let t = st && st.el;
        try { if (typeof t === 'function') t = t(); } catch (e) { t = null; }
        if (typeof t === 'string') t = q(t);
        if (!t) return null;
        const r = t.getBoundingClientRect ? t.getBoundingClientRect() : t;
        if (!r || !(r.width > 2) || !(r.height > 2)) return null;
        const l = Math.max(0, r.left), tp = Math.max(0, r.top), rt = Math.min(innerWidth, r.left + r.width), bt = Math.min(innerHeight, r.top + r.height);
        return rt - l > 2 && bt - tp > 2 ? { l, t: tp, r: rt, b: bt } : null;
    }
    function place(force) {
        const E = S.el; if (!E || !S.les) return;
        const st = S.les.steps[S.i], tg = st ? target(st) : null, P = 6, W = innerWidth, H = innerHeight, coach = st && coachOf(st);
        const bw = E.bub.offsetWidth, bh = E.bub.offsetHeight;
        const sig = (tg ? [tg.l, tg.t, tg.r, tg.b].map(Math.round).join(',') : '-') + '|' + W + 'x' + H + '|' + bw + 'x' + bh + (st && st.free ? 'f' : '') + (coach ? 'c' : '');
        if (!force && sig === S.sig) return;
        S.sig = sig;
        const box = (el, l, t, w, hh) => { el.style.left = l + 'px'; el.style.top = t + 'px'; el.style.width = Math.max(0, w) + 'px'; el.style.height = Math.max(0, hh) + 'px'; };
        E.root.classList.toggle('free', !!(st && st.free));
        if (tg) {
            const l = Math.max(0, tg.l - P), t = Math.max(0, tg.t - P), r = Math.min(W, tg.r + P), b = Math.min(H, tg.b + P);
            E.hole.classList.remove('none'); box(E.hole, l, t, r - l, b - t);
            box(E.sh[0], 0, 0, W, t); box(E.sh[1], 0, b, W, H - b); box(E.sh[2], 0, t, l, b - t); box(E.sh[3], r, t, W - r, b - t);
        } else {
            E.hole.classList.add('none'); box(E.hole, W / 2, H / 2, 0, 0);
            box(E.sh[0], 0, 0, W, H); box(E.sh[1], 0, 0, 0, 0); box(E.sh[2], 0, 0, 0, 0); box(E.sh[3], 0, 0, 0, 0);
        }
        if (coach) { E.bub.style.left = ''; E.bub.style.top = ''; return; }      // the banner sits in its corner (CSS)
        // the bubble: beside the target if it fits (below, above, right, left), else in a corner; never off-screen
        const M = 12, fit = (x, y) => x >= 8 && y >= 8 && x + bw <= W - 8 && y + bh <= H - 8;
        let x, y;
        if (!tg) { x = (W - bw) / 2; y = (H - bh) / 2; }
        else {
            const cx = cl((tg.l + tg.r) / 2 - bw / 2, 8, W - bw - 8), cy = cl((tg.t + tg.b) / 2 - bh / 2, 8, H - bh - 8);
            const opts = [[cx, tg.b + P + M], [cx, tg.t - P - M - bh], [tg.r + P + M, cy], [tg.l - P - M - bw, cy]];
            const o = opts.find(([a, b]) => fit(a, b));
            if (o) [x, y] = o;
            else { const at = (st && st.at) || 'br'; x = at[1] === 'l' ? 16 : W - bw - 16; y = at[0] === 't' ? 16 : H - bh - 16; }
        }
        E.bub.style.left = Math.round(cl(x, 8, Math.max(8, W - bw - 8))) + 'px';
        E.bub.style.top = Math.round(cl(y, 8, Math.max(8, H - bh - 8))) + 'px';
    }
    addEventListener('resize', () => { if (S.les) place(true); });
    document.addEventListener('scroll', () => { if (S.les) place(false); }, true);
    // Esc always leaves the lesson (or closes the Training list / the offer); the game never sees that Esc
    addEventListener('keydown', e => {
        if (C.nextKey && S.les && e.key === C.nextKey && !e.repeat && S.i < S.les.steps.length && coachOf(S.les.steps[S.i])) {
            const t = e.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
            e.preventDefault(); e.stopImmediatePropagation(); S.dir = 1; go(S.i + 1); return;
        }
        if (e.key !== 'Escape' && e.code !== 'Escape') return;
        if (!S.les && !S.hub && !S.offer) return;
        e.preventDefault(); e.stopImmediatePropagation();
        if (S.hub) return closeHub();
        if (S.offer) return hideOffer(false);
        stop(S.i >= S.les.steps.length ? 'done' : 'skip');
    }, true);

    // ---- the first-visit offer (once: the game remembers the answer)
    function offer(o) {
        hideOffer();
        const answer = yes => { hideOffer(); try { if (o.answer) o.answer(yes); } catch (e) { err(e); } if (yes) start(o.les); };
        const card = mk('div', { id: 'hgt-offer', class: 'hgt-bubble offer', style: 'z-index:' + (C.z + 1) },
            mk('div', { class: 'hgt-top' }, mk('span', { class: 'hgt-les' }, o.kicker || 'Welcome'), mk('span', { class: 'hgt-prog' }, o.time || '2 minutes')),
            mk('h4', null, o.title), mk('p', null, o.text),
            mk('div', { class: 'hgt-btns' }, btn('No thanks', '', () => answer(false)), mk('span', { class: 'hgt-sp' }), btn('Yes', 'pri', () => answer(true))));
        S.offer = { card, answer };
        document.body.appendChild(card);
    }
    function hideOffer(silent) { const o = S.offer; if (!o) return; S.offer = null; o.card.remove(); if (silent === false) try { o.answer(false); } catch (e) {} }

    // ---- the Training list: every lesson with a tick once done
    function hub(o) {
        o = o || S.hubOpts || {}; S.hubOpts = o;
        closeHub();
        const done = LES.filter(l => C.done(l.id)).length;
        const rows = mk('div', { class: 'hgt-rows' }, LES.map((l, i) => {
            const d = C.done(l.id);
            return mk('div', { class: 'hgt-row' + (d ? ' done' : ''), 'data-l': l.id },
                mk('span', { class: 'hgt-tick', title: d ? 'Done' : '' }, d ? '✓' : String(i + 1)),
                mk('div', { class: 'hgt-meta' }, mk('b', null, l.title), mk('span', null, l.blurb + ' · ' + l.steps.length + ' steps')),
                btn(d ? 'Again' : 'Start', d ? '' : 'pri', () => start(l.id)));
        }));
        const card = mk('div', { class: 'hgt-card', role: 'dialog' },
            mk('div', { class: 'hgt-top' }, mk('span', { class: 'hgt-les' }, 'Training'), mk('span', { class: 'hgt-prog' }, done + ' of ' + LES.length + ' done')),
            mk('h3', null, o.title || 'Training'),
            mk('p', null, o.intro || 'Short lessons where you do each step yourself. Esc or "Skip lesson" leaves at any time.'),
            rows,
            mk('div', { class: 'hgt-btns' }, mk('span', { class: 'hgt-sp' }), btn('Close', '', closeHub)));
        const wrap = mk('div', { id: 'hgt-hub', style: 'z-index:' + (C.z + 2), onpointerdown: e => { if (e.target === wrap) closeHub(); e.stopPropagation(); }, onmousedown: e => e.stopPropagation(), onclick: e => e.stopPropagation() }, card);
        S.hub = wrap;
        document.body.appendChild(wrap);
    }
    function closeHub() { if (S.hub) { S.hub.remove(); S.hub = null; } }

    return {
        config(o) { Object.assign(C, o); },
        define(l) { LES.push(l); return l; },
        start, stop: how => stop(how || 'skip'), next: () => { S.dir = 1; go(S.i + 1); }, back: () => { S.dir = -1; go(S.i - 1); },
        get active() { return !!S.les; }, get lesson() { return S.les; }, get i() { return S.i; }, get step() { return S.les && S.les.steps[S.i]; },
        get finale() { return !!S.les && S.i >= S.les.steps.length; }, get stepDone() { return !!S.doneAt; }, get hubOpen() { return !!S.hub; }, get offerOpen() { return !!S.offer; },
        get el() { return S.el; },
        done: id => !!C.done(id), list: LES, offer, hideOffer: () => hideOffer(), hub, closeHub, place: () => place(true)
    };
})();
