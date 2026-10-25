// ---------- 5.0 same-wifi game scan + Grapevine invites ----------
// Browsers cannot do LAN discovery, so devices behind the same router find each other by their shared public address:
// netId = first 10 hex of SHA-256(public IP + 'blocky'). A host with an open party also registers a tiny PeerJS "beacon"
// peer named lan-<netId>-<slot>; scanners poke the 12 possible slots and the beacon answers with the party info.
// All network access goes through a transport object, so tests can swap in a fake one (__blocky.lan.fake).
const LAN_SLOTS = 12;
const lanRealTransport = {
    netId() {         // public address via STUN (server-reflexive candidate), hashed
        return new Promise((res) => {
            let pc, done = false;
            const fin = (v) => { if (done) return; done = true; try { pc.close(); } catch (e) {} res(v); };
            try {
                pc = new RTCPeerConnection({ iceServers: [ICE_SERVERS[0]] });
                pc.createDataChannel('x');
                pc.onicecandidate = (e) => {
                    const c = e.candidate && e.candidate.candidate;
                    if (!c || c.indexOf(' typ srflx') < 0) return;
                    const ip = c.split(' ')[4];
                    crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + 'blocky')).then(b => fin([...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 10)), () => fin(null));
                };
                pc.createOffer().then(o => pc.setLocalDescription(o)).catch(() => fin(null));
                setTimeout(() => fin(null), 4500);
            } catch (e) { fin(null); }
        });
    },
    sp: null,
    async probeAll(netId, ms) {       // -> array of info objects (one per answering beacon)
        const Peer = await loadPeerJS();
        if (!this.sp || this.sp.destroyed) {
            const sp = new Peer({ debug: 0 }); this.sp = sp;
            await new Promise((res, rej) => { sp.on('open', res); sp.on('error', rej); setTimeout(() => rej(new Error('lan')), 6000); });
        }
        const sp = this.sp;
        const one = (slot) => new Promise((res) => {
            const id = PJ_PREFIX + 'lan-' + netId + '-' + slot;
            let conn, t;
            const fin = (v) => { clearTimeout(t); sp.off('error', onErr); try { conn && conn.close(); } catch (e) {} res(v); };
            const onErr = (e) => { if (String(e && e.message).indexOf(id) >= 0) fin(null); };
            sp.on('error', onErr);
            try { conn = sp.connect(id, { label: 'lan', serialization: 'json', reliable: true }); } catch (e) { fin(null); return; }
            conn.on('data', (d) => fin(d && typeof d === 'object' ? d : null));
            t = setTimeout(() => fin(null), ms);
        });
        const out = await Promise.all(Array.from({ length: LAN_SLOTS }, (_, i) => one(i)));
        return out.filter(Boolean);
    },
    stopScan() { if (this.sp) { try { this.sp.destroy(); } catch (e) {} this.sp = null; } },
    async advertise(netId, getInfo) {      // claim the first free slot; returns {close()} or null
        const Peer = await loadPeerJS();
        for (let slot = 0; slot < LAN_SLOTS; slot++) {
            const pj = await new Promise((res) => {
                const p = new Peer(PJ_PREFIX + 'lan-' + netId + '-' + slot, { debug: 0 });
                p.on('open', () => res(p)); p.on('error', () => { try { p.destroy(); } catch (e) {} res(null); });
                setTimeout(() => res(null), 6000);
            });
            if (!pj) continue;
            pj.on('connection', (conn) => {
                conn.on('open', () => {
                    if (conn.label !== 'lan') { conn.close(); return; }
                    try { conn.send(getInfo()); } catch (e) {}
                    setTimeout(() => { try { conn.close(); } catch (e) {} }, 400);
                });
            });
            return { slot, close() { try { pj.destroy(); } catch (e) {} } };
        }
        return null;
    }
};
// fake in-memory transport for tests: {netId, games:[info...], fail}
function lanFakeTransport(spec) {
    return {
        netId: () => Promise.resolve(spec.fail ? null : (spec.netId || 'fakenet000')),
        probeAll: () => Promise.resolve(spec.games.slice(0, LAN_SLOTS).map(g => Object.assign({}, g))),
        stopScan() {},
        advertise: (netId, getInfo) => { const h = { slot: spec.games.length, info: getInfo, close() { spec.advertised = null; } }; spec.advertised = h; return Promise.resolve(h); }
    };
}
const LAN = {
    tr: lanRealTransport, state: 'idle', results: [], netId: '', timer: 0, busy: false, gen: 0, adv: null, advBusy: false, scans: 0,
    wantScan() { return !ui.mp.classList.contains('hidden') && !NET.host && !NET.inGame && (NET.view === 'home' || (NET.view === 'join' && NET.joinState !== 'connected')); },
    wantAdv() { return settings.lanShow !== false && NET.host && !NET.inGame && NET.codeState === 'ready' && NET.view === 'host'; },
    info() { return { name: NET.name, mode: NET.lobby.mode, map: NET.lobby.map, players: allPlayers().length, max: 10, code: NET.code }; },
    async scan() {
        if (this.busy) return; this.busy = true; const gen = this.gen;
        if (!this.results.length) this.state = 'scanning'; this.paint();
        try {
            const tr = this.tr;
            if (!this.netId) { const id = await tr.netId() || ''; if (gen !== this.gen) return; this.netId = id; }
            if (!this.netId) { this.state = 'unsupported'; this.results = []; }
            else {
                const list = await tr.probeAll(this.netId, 2500); if (gen !== this.gen) return;
                this.results = list.filter(g => g && /^\d{6}$/.test(String(g.code)) && String(g.code) !== NET.code).slice(0, LAN_SLOTS);
                this.state = this.results.length ? 'found' : 'empty';
            }
        } catch (e) { if (gen !== this.gen) return; this.state = this.results.length ? 'found' : 'unsupported'; }
        this.busy = false; this.scans++; this.paint();
    },
    async startAdv() {
        if (this.adv || this.advBusy) return; this.advBusy = true;
        try {
            if (!this.netId) this.netId = await this.tr.netId() || '';
            if (this.netId && this.wantAdv()) {
                const h = await this.tr.advertise(this.netId, () => this.info());
                if (h && this.wantAdv()) this.adv = h; else if (h) h.close();
            }
        } catch (e) {}
        this.advBusy = false;
    },
    sync() {            // starts / stops everything to match what is on screen; safe to call often
        const ws = this.wantScan(), wa = this.wantAdv();
        if (wa) this.startAdv(); else if (this.adv) { this.adv.close(); this.adv = null; }
        if (ws && !this.timer) { this.timer = setInterval(() => this.sync(), 8000); this.scan(); }
        else if (ws && !this.busy && this.timer) { if (Date.now() - (this.lastAt || 0) > 7000) this.scan(); }
        if (ws) this.lastAt = Date.now();
        if (!ws && !wa && this.timer) { clearInterval(this.timer); this.timer = 0; }
        if (wa && !this.timer) this.timer = setInterval(() => this.sync(), 8000);
        if (!ws) { this.tr.stopScan(); this.results = []; this.state = 'idle'; }
    },
    stop() { this.gen++; this.busy = false; if (this.adv) { this.adv.close(); this.adv = null; } clearInterval(this.timer); this.timer = 0; this.tr.stopScan(); this.results = []; this.state = 'idle'; },
    html() {
        let h = `<div class="mlabel">GAMES ON THIS WI-FI</div>`;
        if (this.state === 'scanning' || this.state === 'idle') h += `<div class="mdesc">Scanning this wifi...</div>`;
        else if (this.state === 'unsupported') h += `<div class="mdesc">Can't scan on this network (it blocks the address lookup). Use a party code instead.</div>`;
        else if (this.state === 'empty') h += `<div class="mdesc">No open games found on this wifi. Looking again every few seconds.</div>`;
        else h += `<div class="flex flex-col gap-1.5">${this.results.map(g => `<div class="bcard items-center"><div class="flex-1 font-black">${escHtml(String(g.name || 'Player').slice(0, 16))}<div class="text-xs text-gray-400">${escHtml((MP_MODES[g.mode] || MP_MODES.coop).name)} - ${escHtml(g.map === 'random' ? 'random map' : (MAPS[g.map] ? MAPS[g.map].name : String(g.map).slice(0, 12)))} - ${+g.players | 0}/${+g.max | 0} players</div></div><button class="chip on" data-lanjoin="${escHtml(String(g.code))}">JOIN</button></div>`).join('')}</div>`;
        return h;
    },
    paint() { const el = document.getElementById('mp-lan-list'); if (el) el.innerHTML = this.html(); }
};

// ---------- Grapevine invites (the launcher supplies window.parent.HG_inviteTargets / HG_sendInvite / HG_takeJoin) ----------
const HGI = {
    open: false, msg: '',
    api() { try { const p = window.parent; return p && p !== window && typeof p.HG_inviteTargets === 'function' && typeof p.HG_sendInvite === 'function' ? p : null; } catch (e) { return null; } },
    code() { return NET.host ? NET.code : (NET.joinState === 'connected' ? NET.joinCode : ''); },
    html() {
        const p = this.api(), code = this.code(); if (!p || !/^\d{6}$/.test(code || '')) return '';
        let h = `<div class="mt-4"><button id="mp-hginvite" class="chip">INVITE A FRIEND</button> <span class="text-sm font-bold text-gray-300">${escHtml(this.msg)}</span>`;
        if (this.open) {
            let t = []; try { t = p.HG_inviteTargets() || []; } catch (e) {}
            h += `<div class="flex flex-col gap-1.5 mt-2">${t.length ? t.slice(0, 40).map(x => `<div class="bcard items-center"><div class="flex-1 font-black">${escHtml(String(x.title || x.id).slice(0, 30))}<span class="text-xs text-gray-400"> ${escHtml(String(x.kind || ''))}</span></div><button class="chip" data-hgsend="${escHtml(String(x.id))}">SEND</button></div>`).join('') : '<div class="mdesc">No one to invite right now.</div>'}</div>`;
        }
        return h + `</div>`;
    },
    send(id) {
        const p = this.api(); if (!p) return;
        let ok = false; try { ok = !!p.HG_sendInvite(id, { game: 'blocky', code: this.code(), mode: NET.lobby.mode }); } catch (e) {}
        this.msg = ok ? 'Invite sent!' : 'Invite failed - try again.'; this.open = ok ? false : this.open; renderMP();
    }
};
let hgPending = '', hgTries = 0;
function hgTryJoin() {
    if (!hgPending) return;
    if (currentGameState !== 'main' || NET.on) { if (++hgTries < 90) setTimeout(hgTryJoin, 1000); return; }
    const code = hgPending; hgPending = ''; hgTries = 0;
    netReset(); NET.homeMsg = ''; openMP('join'); clientJoinCode(code);
}
function hgAccept(raw) { const c = String(raw || '').replace(/\D/g, ''); if (c.length !== 6) return false; hgPending = c; hgTries = 0; hgTryJoin(); return true; }
window.__hgJoin = hgAccept;
function hgBoot() {
    let c = '';
    try { const p = window.parent; if (p && p !== window && typeof p.HG_takeJoin === 'function') c = p.HG_takeJoin('blocky') || ''; } catch (e) {}
    if (c) hgAccept(c);
}
setTimeout(hgBoot, 0);
Object.assign(window.__blocky, { lan: {
    scan: () => { LAN.lastAt = 0; return LAN.scan(); }, get results() { return LAN.results; }, get state() { return LAN.state; }, get obj() { return LAN; },
    fake: (spec) => { LAN.stop(); LAN.netId = ''; LAN.tr = lanFakeTransport(spec); return spec; }, real: () => { LAN.stop(); LAN.tr = lanRealTransport; },
}, hgi: HGI, mpRender: () => renderMP() });
