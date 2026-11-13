// ============================================================
// MENUS, HUD, WARDROBE, RESULTS and the WINNER CEREMONY.
// The 3D menu scenes (title stage, wardrobe podium, winner podium) are drawn by drawMenu().
// ============================================================
let annT = 0;
function announce(text, cls) {
    const e = $('#ann'); if (!e) return;
    e.className = ''; void e.offsetWidth; e.innerHTML = text; e.className = 'show ' + (cls || '');
    clearTimeout(annT); annT = setTimeout(() => { e.className = ''; }, 1800);
}
function drawPortrait(cv, look) {
    const g = cv.getContext('2d'), w = cv.width, h = cv.height, c = '#' + ITEM[look.col].hex.toString(16).padStart(6, '0'), c2 = '#' + ITEM[look.col2].hex.toString(16).padStart(6, '0');
    g.clearRect(0, 0, w, h); g.save(); g.beginPath(); g.arc(w / 2, h * 0.55, w * 0.4, 0, TAU); g.clip();
    g.fillStyle = c; g.fillRect(0, 0, w, h);
    const k = ITEM[look.pat].k; g.fillStyle = c2;
    if (k === 1) for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 4); else if (k === 2 || k === 7 || k === 9) for (let i = 0; i < 7; i++) { g.beginPath(); g.arc((i * 37) % w, (i * 23) % h + 6, 3.5, 0, TAU); g.fill(); }
    else if (k === 3) g.fillRect(w / 2, 0, w / 2, h); else if (k === 4) { g.beginPath(); g.arc(w / 2, h * 0.78, w * 0.2, 0, TAU); g.fill(); } else if (k === 6) for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) if ((i + j) % 2) g.fillRect(i * w / 6, j * h / 6, w / 6, h / 6);
    else if (k === 8) { const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, c); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, w, h); } else if (k === 5) for (let x = 0; x < w; x += 8) g.fillRect(x, h * 0.62 + (x % 16 ? 3 : -3), 8, 4);
    g.restore();
    const vis = ITEM[look.visor]; g.fillStyle = '#' + vis.glass.toString(16).padStart(6, '0'); g.beginPath(); g.ellipse(w / 2, h * 0.47, w * 0.3, h * 0.14, 0, 0, TAU); g.fill();
    g.fillStyle = '#' + vis.eye.toString(16).padStart(6, '0'); g.fillRect(w * 0.36, h * 0.42, w * 0.07, h * 0.1); g.fillRect(w * 0.57, h * 0.42, w * 0.07, h * 0.1);
    g.lineWidth = 2; g.strokeStyle = '#2a1d5c'; g.beginPath(); g.arc(w / 2, h * 0.55, w * 0.4, 0, TAU); g.stroke();
    if (look.hat !== 'h0') { g.fillStyle = '#2a1d5c'; g.beginPath(); g.arc(w / 2, h * 0.13, w * 0.09, 0, TAU); g.fill(); }
}
const portrait = (look, size) => { const cv = document.createElement('canvas'); cv.width = cv.height = size || 40; drawPortrait(cv, look); return cv; };
const MENU = { scene: 'title', looks: [], wardYaw: 0, tryLook: null, cat: 'col', cer: null, t: 0 };
function menuWorld(kind) {
    worldReset(); newLevel(); MENU.scene = kind;
    if (kind === 'ceremony') { cyl(0, 0.75, 0, 1.6, 1.5, { col: 0xffd23f }); cyl(-3, 0.45, 0.3, 1.4, 0.9, { col: 0xd9dde8 }); cyl(3, 0.3, 0.3, 1.4, 0.6, { col: 0xe0a060 }); cyl(0, -0.5, 0, 9, 1, { col: 0xf3e9ff }); }
    else { cyl(0, -0.5, 0, 9, 1, { col: 0xffd6f0 }); cyl(0, -0.4, 0, 2.2, 1.2, { col: 0xffd23f }); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; cyl(Math.sin(a) * 8.6, 0.1, Math.cos(a) * 8.6, 0.5, 0.4, { col: i % 2 ? 0x3fb8ff : 0xff5fa2 }); } }
    buildLevelMeshes(L.extra); GFX.stadium.position.set(0, 0, 0);
    if (!MENU.looks.length) { const r = mulberry(Date.now() | 0); for (let i = 0; i < 6; i++) MENU.looks.push(randomLook(r)); }
}
function drawMenu(dt) {
    const t = performance.now() / 1000, cam = GFX.cam; MENU.t = t; tumBegin(); clearTags();
    const vs = (x, y, z, yaw, pose, extra) => Object.assign({ x, y: y + PR, z, yaw, st: 0, ground: true, spd: 0, anim: t * 2, t, pose, sq: Math.sin(t * 3) * 0.03 }, extra || {});
    if (MENU.scene === 'ceremony' && MENU.cer) {
        const c = MENU.cer;
        if (c.win) drawTumbler(vs(0, 1.5, 0, 0, c.win.look.pose), c.win.look, { crown: true, seed: 1 });
        if (c.second) drawTumbler(vs(-3, 0.9, 0.3, 0.25, 'e5'), c.second.look, { seed: 2 });
        if (c.third) drawTumbler(vs(3, 0.6, 0.3, -0.25, 'e5'), c.third.look, { seed: 3 });
        if (Math.random() < dt * 6) confetti((Math.random() - 0.5) * 8, 8, (Math.random() - 0.5) * 4, 10, 2);
        cam.position.set(Math.sin(t * 0.2) * 1.5, 3.2, 8.5); cam.lookAt(0, 1.6, 0);
    } else if (MENU.scene === 'ward') {
        const look = MENU.tryLook || save.look;
        drawTumbler(vs(0, 0.2, 0, MENU.wardYaw + Math.sin(t * 0.5) * 0.1, MENU.cat === 'pose' ? look.pose : null), look, { seed: 1, scale: 1 });
        if (look.trail !== 't0' && Math.random() < dt * 10) { const tr = ITEM[look.trail]; puff(Math.sin(t * 2) * 1.2, 0.3, Math.cos(t * 2) * 1.2, tr.hex, 1, 0.5, 0.6, 0.8, 0.8); }
        const narrow = innerWidth < 700;
        cam.position.set(narrow ? 0 : -1.25, narrow ? 2.6 : 1.6, narrow ? 5.5 : 3.9); cam.lookAt(narrow ? 0 : -1.25, narrow ? 0.4 : 0.95, 0);
        if (!narrow) { cam.position.x = -1.25; cam.lookAt(-1.25, 0.95, 0); cam.position.x = -1.2; }
    } else {
        const a = t * 0.08; cam.position.set(Math.sin(a) * 1.2 - 2.4, 2.5, 7.2); cam.lookAt(-1.5, 1.0, 0);
        drawTumbler(vs(0, 0.2, 0, Math.atan2(cam.position.x, cam.position.z) + Math.sin(t * 0.6) * 0.3, ['e0', 'e3', 'e5'][Math.floor(t / 4) % 3]), save.look, { seed: 1 });
        MENU.looks.forEach((l, i) => { const g = (i - 2.5) * 0.55, r = 3.0 + (i % 2) * 1.4, x = Math.sin(g) * r * 1.25, z = -Math.cos(g) * r * 0.75 - 0.6; drawTumbler(vs(x, 0, z, Math.atan2(cam.position.x - x, cam.position.z - z) + Math.sin(t + i) * 0.3, ['e3', 'e5', 'e2', 'e4', 'e1', 'e6'][(i + Math.floor(t / 5)) % 6]), l, { seed: i + 2 }); });
    }
    tumEnd(); listenerPos = null;
    GFX.sun.position.set(30, 60, 20); GFX.sun.target.position.set(0, 0, 0);
}
// ---------- screens ----------
const SCREENS = ['#s-title', '#s-play', '#s-lobby', '#s-ward', '#s-how', '#s-set', '#s-res', '#s-win', '#s-pause'];
const UI = {
    back: null,
    show(id) { for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id); G.screen = id ? id.slice(3) : 'game'; },
    toTitle() {
        G.show = null; G.R = null; G.paused = false; if (document.pointerLockElement) document.exitPointerLock();
        $('#hud').classList.add('hidden'); $('#s-intro').classList.add('hidden'); clearTags();
        menuWorld('title'); UI.show('#s-title'); UI.paintTitle(); playMusic('menu');
    },
    paintTitle() {
        const s = save.stats, fp = fameProgress(save.fame);
        $('#t-crowns').textContent = s.crowns; $$('.v-kudos').forEach(e => e.textContent = save.kudos);
        $('#t-lvl').textContent = fp.lvl; $('#t-fame').style.width = (fp.lvl >= FAME_MAX ? 100 : fp.have / fp.need * 100).toFixed(0) + '%';
        const nm = $('#t-name'); nm.value = myName(); nm.disabled = signedIn();
        $('#t-stats').textContent = 'Shows ' + s.shows + ' · Crowns ' + s.crowns + ' · Rounds qualified ' + s.qualified + ' · Finals reached ' + s.finals;
    },
    openPlay() {
        UI.show('#s-play'); segPaint('#o-skill', save.opts.skill); segPaint('#o-len', save.opts.length);
        const rc = lastRoom(); $('#b-rejoin').classList.toggle('hidden', !rc); if (rc) $('#b-rejoin').textContent = 'Rejoin room ' + rc;
        $('#p-status').textContent = '';
    },
    showLobby() {
        G.R = null; G.show = null; $('#hud').classList.add('hidden'); $('#s-intro').classList.add('hidden'); clearTags();
        if (MENU.scene !== 'title') menuWorld('title'); UI.show('#s-lobby'); UI.paintLobby(); playMusic('menu');
    },
    paintLobby() {
        if (G.screen === 'play') { $('#p-status').textContent = NET.status; $('#p-status').className = 'note' + (NET.bad ? ' bad' : ''); }
        if (G.screen !== 'lobby') return;
        $('#l-code').textContent = NET.code || '------';
        const r = NET.host ? hostRoster() : NET.roster, list = $('#l-list'); list.innerHTML = '';
        for (const p of r) {
            const d = document.createElement('div'); d.className = 'pl'; d.appendChild(portrait(sanitizeLook(p.look), 40));
            d.insertAdjacentHTML('beforeend', '<span>' + esc(p.name) + (p.id === G.me ? ' (you)' : '') + '</span>' + (p.id === 0 ? '<span class="host">HOST</span>' : '') + '<span class="rd' + (p.ready ? ' on' : '') + '">' + (p.id === 0 ? 'host' : p.ready ? 'ready' : p.lag ? 'reconnecting' : 'not ready') + '</span>');
            list.appendChild(d);
        }
        const o = NET.host ? save.opts : (NET.hostOpts || save.opts), nb = Math.min(o.bots, MAXP - r.length);
        if (nb > 0) { const d = document.createElement('div'); d.className = 'pl bot'; d.textContent = '+ ' + nb + ' bot' + (nb > 1 ? 's' : '') + ' (' + (SKILLS[o.skill] || 'Mixed') + ')'; list.appendChild(d); }
        $('#l-n').textContent = r.length + ' / ' + MAXP;
        segPaint('#l-bots', o.bots); segPaint('#l-skill', o.skill); segPaint('#l-len', o.length); segPaint('#l-score', o.scoring);
        $$('#l-opts .seg').forEach(s => s.classList.toggle('locked', !NET.host));
        $('#l-hostonly').textContent = NET.host ? '' : '(the host picks)';
        $('#l-start').classList.toggle('hidden', !NET.host); $('#l-ready').classList.toggle('hidden', NET.host || !NET.net);
        $('#l-ready').textContent = NET.ready ? 'Not ready' : 'Ready';
        const nr = r.filter(p => p.id !== 0 && !p.ready).length;
        $('#l-status').textContent = NET.status + (NET.host && nr ? ' · ' + nr + ' not ready yet' : '') + (NET.inShow && !G.show ? ' · a show is running' : '');
        $('#l-status').className = 'note' + (NET.bad ? ' bad' : '');
    },
    openWard() { UI.show('#s-ward'); menuWorld('ward'); MENU.tryLook = null; UI.paintWard(); },
    paintWard() {
        $$('.v-kudos').forEach(e => e.textContent = save.kudos);
        $('#w-tabs').innerHTML = CATS.map(([k, n]) => '<button data-c="' + k + '" class="' + (MENU.cat === k ? 'on' : '') + '">' + n + '</button>').join('');
        const cat = SLOT_CAT[MENU.cat], lvl = fameLevel(save.fame), cur = (MENU.tryLook || save.look)[MENU.cat];
        $('#w-grid').innerHTML = ITEMS.filter(i => i.cat === cat).map(it => {
            const own = itemOwned(it), sw = it.hex != null && it.hex >= 0 ? 'background:#' + it.hex.toString(16).padStart(6, '0') : it.cat === 'visor' ? 'background:radial-gradient(circle at 50% 45%, #' + it.eye.toString(16).padStart(6, '0') + ' 0 18%, #' + it.glass.toString(16).padStart(6, '0') + ' 20%)' : it.hex === -1 ? 'background:conic-gradient(red,orange,yellow,lime,cyan,blue,violet,red)' : 'background:#f0eaff';
            const lab = it.cat === 'pat' ? 'background:repeating-linear-gradient(45deg,#ff5fa2 0 6px,#fff 6px 12px)' : sw;
            return '<button class="it' + (cur === it.id ? ' on' : '') + (own ? '' : ' lock') + '" data-id="' + it.id + '"><span class="sw" style="' + (it.cat === 'col' || it.cat === 'visor' || it.cat === 'trail' ? sw : it.cat === 'pat' ? lab : 'background:#f0eaff') + '"></span>' + esc(it.name) +
                (own ? '' : it.lvl ? '<span class="lv">Fame ' + it.lvl + '</span>' : '<span class="pr">' + it.price + ' kudos</span>') + '</button>';
        }).join('');
        const n = ITEMS.filter(i => itemOwned(i)).length; if (!MENU.tryLook) $('#w-note').innerHTML = 'You own ' + n + ' of ' + ITEMS.length + ' items. Fame level ' + lvl + '. Click to wear; locked items can be tried on.';
    },
    wardClick(id) {
        const it = ITEM[id]; if (!it) return; sfx('click');
        if (itemOwned(it)) { save.look[MENU.cat] = id; MENU.tryLook = null; writeSave(); UI.paintWard(); if (NET.net) { if (NET.host) broadcastLobby(); else sendHi(); } return; }
        MENU.tryLook = Object.assign({}, save.look, { [MENU.cat]: id }); UI.paintWard();
        if (it.lvl && !it.price) $('#w-note').innerHTML = '<b>' + esc(it.name) + '</b> unlocks at fame level ' + it.lvl + '.';
        else $('#w-note').innerHTML = 'Trying on <b>' + esc(it.name) + '</b>. <button class="btn small go" id="w-buy" ' + (save.kudos < it.price ? 'disabled' : '') + '>Buy for ' + it.price + ' kudos</button>' + (save.kudos < it.price ? ' <span class="note bad">Not enough kudos yet</span>' : '');
        const bb = $('#w-buy'); if (bb) bb.onclick = () => { if (save.kudos < it.price) return; save.kudos -= it.price; save.owned[id] = true; save.look[MENU.cat] = id; MENU.tryLook = null; writeSave(); sfx('buy'); confetti(-1.2, 2, 0, 30, 1); UI.paintWard(); };
    },
    openSettings(from) {
        UI.back = from || G.screen; UI.show('#s-set'); const s = save.settings;
        segPaint('#s-q', s.quality); $('#s-mus').value = s.music; $('#s-sfx').value = s.sfx; $('#s-mute').checked = s.mute; $('#s-sens').value = s.sens; $('#s-inv').checked = s.invertY; $('#s-names').checked = s.names;
        UI.paintSettings();
    },
    paintSettings() { const s = save.settings; $('#s-musv').textContent = Math.round(s.music * 100) + '%'; $('#s-sfxv').textContent = Math.round(s.sfx * 100) + '%'; $('#s-sensv').textContent = s.sens.toFixed(1) + 'x'; },
    goBack() {
        const b = UI.back; UI.back = null;
        if (b === 'pause') { UI.show('#s-pause'); return; }
        if (G.show && !G.show.over) { UI.show(null); $('#hud').classList.remove('hidden'); return; }
        if (MENU.scene !== 'title') menuWorld('title');
        if (b === 'lobby' && NET.net) UI.showLobby(); else UI.toTitle();
    },
    enterGame() { UI.show(null); $('#hud').classList.remove('hidden'); $('#s-win').classList.add('hidden'); G.scene = 'round'; },
    roundIntro(R) {
        const S = G.show; UI.show(null); $('#hud').classList.remove('hidden');
        $('#i-kind').textContent = KIND_LABEL[R.info.kind] + ' · Round ' + (R.idx + 1) + (S.practice ? '' : ' of ' + S.len);
        $('#i-name').textContent = R.info.name; $('#i-desc').textContent = R.info.desc;
        const me = byId(G.me), n = R.cs.length;
        let goal = S.pts ? 'Points round: everyone plays on!' : R.info.kind === 'race' ? 'The first ' + R.q + ' of ' + n + ' qualify' : R.info.kind === 'survive' ? 'Survive! ' + R.q + ' of ' + n + ' go through' : R.rid === 'tail' ? R.q + ' tails - hold one at the end!' : R.info.kind === 'team' ? R.nTeams + ' teams - the lowest team is out' : 'Winner takes the crown!';
        if (!me || !me.inRound) goal += ' (you are spectating)';
        $('#i-goal').textContent = goal; $('#s-intro').classList.remove('hidden');
        if (me && me.inRound && R.team != null) {}
        $('#h-lock').classList.toggle('hidden', !!document.pointerLockElement || isTouch() || !me || !me.inRound);
        sfx('whoosh');
    },
    hideIntro() { $('#s-intro').classList.add('hidden'); },
    countdown(n) { const e = $('#h-count'); e.className = ''; void e.offsetWidth; if (!n) { e.textContent = ''; return; } e.textContent = n; e.className = 'pop'; },
    showResults(R) {
        const S = G.show, msg = R.results; if (!msg) return;
        const qs = new Set(msg.q), me = byId(G.me);
        let h = '<div class="ch"><h2>' + esc(R.info.name) + ' - results</h2></div>';
        if (me && me.inRound && R.reward) { const ok = qs.has(me.id); h += '<div class="reward">' + (S.pts ? 'Placed ' + (msg.order.indexOf(me.id) + 1) + ' of ' + msg.order.length + '! ' : ok ? (R.info.kind === 'final' ? 'You won the final! ' : 'You qualified! ') : 'You were eliminated. ') + '+' + R.reward.kudos + ' kudos, +' + R.reward.fame + ' fame' + (R.reward.lvlUp ? ' · <b>FAME LEVEL ' + R.reward.lvlUp + '!</b>' : '') + '</div>'; }
        h += '<div class="res">';
        for (const id of msg.order) { const C = byId(id); if (!C) continue; const ok = qs.has(id); h += '<div class="pl ' + (S.pts ? 'q' : ok ? 'q' : 'o') + (isMe(C) ? ' me' : '') + '"><span>' + esc(C.name) + '</span>' + (S.pts ? '<b>+' + (msg.pts[id] || 0) + ' (' + C.points + ')</b>' : ok ? '<b>✔</b>' : '') + '</div>'; }
        h += '</div><div class="note">' + (S.pts ? 'Points show: total points in brackets.' : qs.size + ' qualified, ' + (msg.order.length - qs.size) + ' eliminated.') + ' Next up in a moment...</div>';
        $('#r-card').innerHTML = h; UI.show('#s-res');
        setTimeout(() => { if (G.screen === 'res') UI.show(null); }, 5500);
    },
    ceremony(msg, W0) {
        const S = G.show; if (document.pointerLockElement) document.exitPointerLock();
        G.R = null; G.scene = 'menu'; menuWorld('ceremony'); $('#s-intro').classList.add('hidden'); $('#hud').classList.add('hidden'); clearTags();
        const st = msg.standings || [], get = i => st[i] ? byId(st[i].id) : null;
        MENU.cer = { win: W0, second: get(st[0] && st[0].id === msg.id ? 1 : 0), third: get(st[0] && st[0].id === msg.id ? 2 : 1) };
        playMusic('win'); sfx('crown'); confetti(0, 6, 0, 150, 4);
        const me = isMe(W0);
        let h = '<h1>' + (msg.practice ? 'Practice over' : me ? 'YOU WIN THE CROWN!' : esc(W0 ? W0.name : 'Nobody') + ' wins!') + '</h1>';
        if (!msg.practice && me) h += '<div class="reward">+1 crown · +150 kudos · +200 fame</div>';
        h += '<div class="st">' + st.slice(0, 16).map((s, i) => '<span>' + (i + 1) + '. ' + esc(s.name) + (S && S.pts ? ' ' + s.pts : '') + '</span>').join('') + '</div><div class="row" style="justify-content:center">';
        if (!NET.net) h += '<button class="btn go" id="w-again">Play again</button><button class="btn" id="w-menu">Main menu</button>';
        else if (NET.host) h += '<button class="btn go" id="w-lobby">Back to the lobby</button>';
        else h += '<span class="note">Waiting for the host...</span><button class="btn small" id="w-leave">Leave</button>';
        $('#w-box').innerHTML = h + '</div>'; UI.show('#s-win');
        const a = $('#w-again'); if (a) a.onclick = () => (S && S.practice ? startPractice(S.practice) : startSolo());
        const m = $('#w-menu'); if (m) m.onclick = () => UI.toTitle();
        const l = $('#w-lobby'); if (l) { l.onclick = () => netToLobby(); clearTimeout(UI.lobbyT); UI.lobbyT = setTimeout(() => { if (G.screen === 'win' && NET.host) netToLobby(); }, 20000); }
        const lv = $('#w-leave'); if (lv) lv.onclick = () => { netLeave(); UI.toTitle(); };
    },
    spectateWait() { UI.enterGame(); announce('Spectating until the next show', 'small'); },
    pause() {
        if (!G.show || G.show.over || G.screen !== 'game') return;
        if (document.pointerLockElement) document.exitPointerLock();
        const solo = !NET.net; G.paused = solo; $('#pa-title').textContent = solo ? 'Paused' : 'Menu'; $('#pa-note').textContent = solo ? '' : 'The show goes on while this is open.';
        UI.show('#s-pause');
    },
    resume() { G.paused = false; UI.show(null); }
};
function segPaint(sel, v) { $$(sel + ' button').forEach(b => b.classList.toggle('on', String(b.dataset.v) === String(v))); }
const isTouch = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window && navigator.maxTouchPoints > 0;
function startSolo() {
    netReset(); ac();
    const o = save.opts, cfg = makeShowConfig([{ id: 0, name: myName(), look: save.look }], { bots: 15, skill: o.skill, length: o.length, scoring: 'knockout' });
    G.host = true; G.me = 0; beginShow(cfg); hostStartRound();
}
function startPractice(rid, bots, skill) {
    netReset(); ac();
    const cfg = makeShowConfig([{ id: 0, name: myName(), look: save.look }], { bots: bots == null ? 15 : bots, skill: skill == null ? save.opts.skill : skill, length: 1, scoring: 'knockout', practice: rid });
    G.host = true; G.me = 0; beginShow(cfg); hostStartRound();
}
// ---------- HUD (10 times a second) ----------
function updateHud() {
    const R = G.R, S = G.show; if (!R || !S) return;
    const info = R.info, left = Math.max(0, info.time - Math.max(0, R.t));
    $('#h-round').textContent = info.name + ' · ' + KIND_LABEL[info.kind];
    const te = $('#h-time'); te.textContent = R.phase === 'play' ? Math.ceil(left) : R.phase === 'over' ? '0' : Math.ceil(info.time); te.classList.toggle('low', R.phase === 'play' && left < 10);
    const live = R.cs.filter(c => !c.done && !c.hide).length, me = byId(G.me);
    let st = '';
    if (R.rid === 'crown') st = 'Grab the crown at the top!';
    else if (R.rid === 'hex') st = 'Still standing: ' + live;
    else if (info.kind === 'race') st = S.pts ? 'Finished: ' + R.finished.length + ' / ' + R.cs.length : 'Qualified: ' + R.finished.length + ' / ' + R.q;
    else if (info.kind === 'survive') st = 'Still on: ' + live + (S.pts ? '' : ' · ' + R.q + ' qualify');
    else if (R.rid === 'tail') st = 'Tails: ' + R.tails.size + (me && R.tails.has(me.id) ? ' · <b style="color:#e8a400">YOU HAVE ONE!</b>' : me && me.inRound ? ' · grab one (F)!' : '');
    $('#h-stat').innerHTML = st;
    let tm = '';
    if (R.nTeams && R.rid !== 'tail') for (let k = 0; k < R.nTeams; k++) tm += '<span class="' + (me && me.team === k ? 'mine' : '') + '" style="background:#' + TEAM_COLS[k].toString(16).padStart(6, '0') + '">' + TEAM_NAMES[k] + ' ' + ((R.score && R.score[k]) || 0) + '</span>';
    $('#h-teams').innerHTML = tm;
    $('#h-fruit').innerHTML = R.def.hud ? R.def.hud(R) : '';
    const wd = $('#h-wind'); if (R.def.wind && R.phase === 'play') { const w = R.def.wind(R.t); wd.style.display = 'block'; wd.firstChild.style.transform = 'rotate(' + (Math.atan2(w.x, w.z) - G.camYaw + PI) * -180 / PI + 'deg) scaleY(' + clamp(Math.hypot(w.x, w.z) / 4, 0.3, 1.3) + ')'; } else wd.style.display = 'none';
    const spec = !me || !me.inRound || me.hide, sp = byId(G.spec);
    $('#h-spec').classList.toggle('hidden', !spec || !sp || R.phase === 'intro');
    if (spec && sp) $('#h-spec').textContent = 'Spectating ' + sp.name + ' · click or Space to switch';
    $('#h-hint').classList.toggle('hidden', spec || isTouch());
    $('#touch').classList.toggle('hidden', !isTouch() || spec);
}
// ---------- wiring ----------
function wireUI() {
    const click = (sel, fn) => $(sel).addEventListener('click', e => { ac(); sfx('click'); fn(e); });
    click('#b-play', () => UI.openPlay()); click('#b-ward', () => UI.openWard()); click('#b-how', () => { UI.back = G.screen; UI.show('#s-how'); }); click('#b-set', () => UI.openSettings());
    $$('[data-back]').forEach(b => b.addEventListener('click', () => { sfx('click'); if (G.screen === 'ward') { MENU.tryLook = null; menuWorld('title'); } UI.goBack(); }));
    $('#t-name').addEventListener('change', e => { save.name = e.target.value.trim().slice(0, 16) || save.name; writeSave(); e.target.value = myName(); });
    const seg = (sel, fn) => $(sel).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; ac(); sfx('click'); fn(b.dataset.v); });
    seg('#o-skill', v => { save.opts.skill = +v; writeSave(); segPaint('#o-skill', v); }); seg('#o-len', v => { save.opts.length = +v; writeSave(); segPaint('#o-len', v); });
    $('#o-prac').innerHTML = Object.keys(ROUND_INFO).map(id => '<option value="' + id + '">' + ROUND_INFO[id].name + ' (' + KIND_LABEL[ROUND_INFO[id].kind] + ')</option>').join('');
    click('#b-solo', () => startSolo()); click('#b-prac', () => startPractice($('#o-prac').value));
    click('#b-host', () => { UI.showLobby(); netHost(); });
    click('#b-join', () => { const c = $('#j-code').value; if (String(c).replace(/\D/g, '').length !== 6) { NET.status = 'Type the 6-digit code.'; NET.bad = true; UI.paintLobby(); return; } UI.showLobby(); netJoin(c); });
    $('#j-code').addEventListener('keydown', e => { if (e.key === 'Enter') $('#b-join').click(); });
    click('#b-rejoin', () => { const c = lastRoom(); if (c) { UI.showLobby(); netJoin(c); } });
    click('#l-copy', () => { const c = NET.code; try { navigator.clipboard.writeText(c); toast('Code ' + c + ' copied'); } catch (e) { toast('Code: ' + c); } });
    click('#l-leave', () => { netLeave(); UI.toTitle(); });
    click('#l-ready', () => { NET.ready = !NET.ready; sendHi(); UI.paintLobby(); });
    click('#l-start', () => netStartShow()); click('#l-ward', () => { UI.openWard(); UI.back = 'lobby'; });
    const lseg = (sel, key, num) => seg(sel, v => { if (!NET.host) return; save.opts[key] = num ? +v : v; writeSave(); broadcastLobby(); });
    lseg('#l-bots', 'bots', 1); lseg('#l-skill', 'skill', 1); lseg('#l-len', 'length', 1); lseg('#l-score', 'scoring', 0);
    $('#w-tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; sfx('click'); MENU.cat = b.dataset.c; MENU.tryLook = null; UI.paintWard(); });
    $('#w-grid').addEventListener('click', e => { const b = e.target.closest('.it'); if (b) UI.wardClick(b.dataset.id); });
    seg('#s-q', v => { save.settings.quality = v; writeSave(); segPaint('#s-q', v); applyQuality(); });
    const rng = (sel, key) => $(sel).addEventListener('input', e => { save.settings[key] = +e.target.value; writeSave(); applyVolume(); UI.paintSettings(); });
    rng('#s-mus', 'music'); rng('#s-sfx', 'sfx'); rng('#s-sens', 'sens');
    $('#s-mute').addEventListener('change', e => { save.settings.mute = e.target.checked; writeSave(); applyVolume(); });
    $('#s-inv').addEventListener('change', e => { save.settings.invertY = e.target.checked; writeSave(); });
    $('#s-names').addEventListener('change', e => { save.settings.names = e.target.checked; writeSave(); });
    click('#pa-resume', () => UI.resume()); click('#pa-set', () => UI.openSettings('pause')); click('#pa-how', () => { UI.back = 'pause'; UI.show('#s-how'); });
    click('#pa-quit', () => { if (NET.net) netLeave(); UI.toTitle(); });
}
