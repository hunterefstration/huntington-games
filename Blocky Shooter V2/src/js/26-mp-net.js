// ==========================================
// 8. MULTIPLAYER (EXPERIMENTAL)
// ==========================================
// Peer to peer - the party creator's browser is the server ("host"). There is no game server anywhere.
//  * Joining: browsers can't just "listen" for each other, so players swap a connection code once
//    (host makes an invite code -> friend pastes it and gets a reply code -> host pastes that back).
//    After that all game data goes straight between the computers (WebRTC data channels).
//  * The host runs the enemies, waves and scores - the referee. You move and shoot on your own screen
//    instantly and tell the host what happened; the host tells everyone the results.
//  * Other players and enemies are shown ~0.1s "in the past" and slid smoothly between updates,
//    so they glide instead of teleporting.


const INTERP_MS = 100;           // how far "in the past" other things are shown (room for 2-3 updates)
const MP_MODES = {
    coop: { name: 'CO-OP', team: 10, desc: 'Survive the waves together - up to 10 players. Everyone has their own cash and armory. Downed players come back next wave.' },
    v1: { name: '1v1', team: 1 }, v2: { name: '2v2', team: 2 }, v3: { name: '3v3', team: 3 }, v4: { name: '4v4', team: 4 }, v5: { name: '5v5', team: 5 }
};
const PVP_TARGET = { v1: 10, v2: 15, v3: 20, v4: 25, v5: 30 };
const TEAM_COLORS = [0xef4444, 0x3b82f6], TEAM_NAMES = ['RED', 'BLUE'];
const COOP_COLORS = [0x3b82f6, 0x22c55e, 0xf59e0b, 0xec4899, 0x8b5cf6, 0x06b6d4, 0xf97316, 0x84cc16, 0xe11d48, 0x14b8a6];
const NET_SRC = WEAPON_ORDER.concat(['explosive', 'molotov', 'turret', 'melee', 'airstrike', 'landmine', 'nuke', 'boom', 'grenade', 'c4', 'launcher', 'rpg']);
const srcIdx = (s) => Math.max(0, NET_SRC.indexOf(s));
const ENEMY_IDS = Object.keys(enemyTypes);
// (4 bits in the snapshot: 16 at most.) 5.0 added hidden (Vent Crawler in its vent), pounce, zap (Shocker) and Patient Zero's burrow/erupt/cast/nova
const E_STATES = ['walk', 'windup', 'charge', 'stun', 'aim', 'slam', 'cloak', 'hidden', 'pounce', 'zap', 'burrow', 'erupt', 'cast', 'nova'];
const r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;
const netModeName = () => (MP_MODES[NET.mode] || MP_MODES.coop).name + (NET.pvp ? ' TEAM DEATHMATCH' : '');
const escHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Grapevine (the launcher's account): one name in every game, players proven by their account key, and a
// + FRIEND button that sends a real Grapevine friend request. The launcher page owns the account (window.parent.HGGrapevine);
// opened on its own, or while signed out, none of this shows and the game behaves exactly as before.
const GVL = {
    get L() { try { const w = window.parent !== window ? window.parent : window.opener; return (w && w.HGGrapevine) || null; } catch (e) { return null; } },   // in the launcher's frame, or in a new tab it opened
    name() {
        const L = this.L, me = L && L.me();
        if (me) return me.name;
        try { return (localStorage.getItem('hgv:key') && localStorage.getItem('hgv:name')) || ''; } catch (e) { return ''; }   // new-tab copy: the name only
    },
    on() { const L = this.L; return !!(L && L.online()); },
    friendBtn(name) {
        const L = this.L; if (!L) return '';
        const st = L.friendState(name);
        if (st === 'none') return `<button class="chip" data-gvfriend="${escHtml(name)}" title="Send a Grapevine friend request">+ FRIEND</button>`;
        return st === 'friend' ? '<span class="text-[10px] text-green-300 font-black">FRIEND</span>' : st === 'outgoing' ? '<span class="text-[10px] text-gray-400 font-black">REQUEST SENT</span>' : st === 'incoming' ? '<span class="text-[10px] text-amber-300 font-black">ASKED YOU</span>' : '';
    }
};

Object.assign(NET, {
    name: String(GVL.name() || settings.mpName || ('Player' + (100 + Math.floor(Math.random() * 900)))).slice(0, 16), lanOnly: !!settings.mpLan,
    lobby: { mode: 'coop', map: 'random', diff: 'normal' }, hostPeer: null, invites: [], view: 'home', joinState: '',
    sendAcc: 0, hitOut: [], pvpOut: new Map(), myShots: [], shotOut: [], fireT: 0, score: [0, 0], target: 0, feed: [],
    me: null, respawnT: 0, lastBy: -1, lastSrc: 0, over: false, pingAt: 0, tickAt: 0, rtt: 0, deadIds: new Map(), hudT: 0, spawns: [[], []], nextId: 1
});
const netPlayers = new Map();       // everyone except you: id -> player record


// ---------- smooth motion: a short history of snapshots, sampled a little in the past ----------
class Interp {
    constructor(angles) { this.t = []; this.v = []; this.angles = angles; }
    push(t, arr) {
        const L = this.t.length;
        if (L && t <= this.t[L - 1]) return;            // late / duplicate packet
        this.t.push(t); this.v.push(arr);
        if (L >= 24) { this.t.shift(); this.v.shift(); }
    }
    clear() { this.t.length = 0; this.v.length = 0; }
    sample(t, out) {
        const T = this.t, V = this.v, L = T.length;
        if (!L) return false;
        let a, b, k;
        if (t <= T[0]) { a = b = V[0]; k = 0; }
        else if (t >= T[L - 1]) {
            // ran out of updates: keep sliding a little along the last direction, then hold still
            if (L < 2) { a = b = V[L - 1]; k = 0; }
            else { a = V[L - 2]; b = V[L - 1]; k = 1 + Math.min(120, t - T[L - 1]) / Math.max(1, T[L - 1] - T[L - 2]); }
        } else {
            let i = L - 2;
            while (i > 0 && T[i] > t) i--;
            a = V[i]; b = V[i + 1]; k = (t - T[i]) / Math.max(1, T[i + 1] - T[i]);
        }
        for (let j = 0; j < b.length; j++) {
            if (this.angles && this.angles.includes(j)) { let d = b[j] - a[j]; d = Math.atan2(Math.sin(d), Math.cos(d)); out[j] = a[j] + d * Math.min(k, 1); }
            else out[j] = a[j] + (b[j] - a[j]) * k;
        }
        return true;
    }
}
// clock matching: the fastest packet tells us the other computer's clock (+ as little delay as possible)
function clockSample(obj, remoteT, now) {
    const s = remoteT - now;
    if (obj.off === undefined || s > obj.off) obj.off = s; else obj.off -= 0.15;
}


// ---------- connection codes ----------
const b64u = {
    enc(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
    dec(str) { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; const s = atob(str); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }
};
// k = which invite this is (a reply carries its invite's k back, so the host can't connect it to the wrong invite)
async function packCode(desc, k) {
    const bytes = new TextEncoder().encode(JSON.stringify(k ? { t: desc.type, s: desc.sdp, k } : { t: desc.type, s: desc.sdp }));
    if (window.CompressionStream) {
        const z = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
        return 'BLKZ.' + b64u.enc(z);
    }
    return 'BLKR.' + b64u.enc(bytes);
}
async function unpackCode(code) {
    code = String(code || '').replace(/\s+/g, '');
    const tag = code.slice(0, 5), body = code.slice(5);
    if (tag !== 'BLKZ.' && tag !== 'BLKR.') throw new Error("That doesn't look like a Blocky Shooter code - copy the whole thing.");
    let o;
    try {
        let bytes = b64u.dec(body);
        if (tag === 'BLKZ.') bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
        o = JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) { o = null; }
    // chat apps sometimes cut long messages short or mangle them
    if (!o || typeof o.s !== 'string' || (o.t !== 'offer' && o.t !== 'answer')) throw new Error('That code is incomplete or damaged - copy the WHOLE code (it is long) and paste it again.');
    return { type: o.t, sdp: o.s, k: typeof o.k === 'string' ? o.k : '' };
}
// the same address lookup + relay servers the 6-digit codes get through PeerJS, so a long code also works
// when the two networks block a direct link (school Wi-Fi) - it only skips the matchmaking server
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }];
function newPeer() {
    const pc = new RTCPeerConnection({ iceServers: NET.lanOnly ? [] : ICE_SERVERS });
    // two pipes: "r" never loses a message (events), "u" is fire-and-forget for fast position updates
    const rel = pc.createDataChannel('r', { negotiated: true, id: 0, ordered: true });
    const fast = pc.createDataChannel('u', { negotiated: true, id: 1, ordered: false, maxRetransmits: 0 });
    rel.binaryType = fast.binaryType = 'arraybuffer';
    return { pc, rel, fast, off: undefined };
}
// wait for the connection addresses to go into the code: all of them, or at most 5s (a blocked server never answers).
// Once a relay address shows up we only wait a moment longer - that one works from almost anywhere.
const iceDone = (pc) => new Promise(res => {
    if (pc.iceGatheringState === 'complete') return res();
    let t = setTimeout(res, 5000);
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
    pc.addEventListener('icecandidate', (e) => { if (e.candidate && / typ relay/.test(e.candidate.candidate)) { clearTimeout(t); t = setTimeout(res, 1200); } });
});
function sendRel(peer, obj) { try { if (peer && peer.rel.readyState === 'open') peer.rel.send(JSON.stringify(obj)); } catch (e) {} }
function sendFast(peer, data) { try { if (peer && peer.fast.readyState === 'open' && peer.fast.bufferedAmount < 65536) peer.fast.send(data); } catch (e) {} }
// guest -> host, or host -> everyone
function netSend(obj) { if (NET.host) netBroadcast(obj); else sendRel(NET.hostPeer, obj); }
function netBroadcast(obj, except) { const s = JSON.stringify(obj); for (const p of netPlayers.values()) if (p.peer && p.id !== except) { try { if (p.peer.rel.readyState === 'open') p.peer.rel.send(s); } catch (e) {} } }
function wirePeer(peer, onOpen, onClose) {
    const handle = (data) => {
        peer.lastMsg = performance.now();
        if (typeof data === 'string') { let m; try { m = JSON.parse(data); } catch (e) { return; } netMessage(peer, m); }
        else netBinary(peer, data);
    };
    peer.rel.onmessage = (e) => handle(e.data);
    peer.fast.onmessage = (e) => handle(e.data);
    peer.rel.onopen = onOpen;
    peer.rel.onclose = onClose;
    peer.pc.addEventListener('connectionstatechange', () => { if (peer.pc.connectionState === 'failed') onClose(); });
}


// ---------- 6-digit party codes ----------
// A 6-digit number is far too small to hold the connection info itself, so PeerJS's free public
// matchmaking server swaps it behind the scenes - only for the few seconds of joining. All game data
// still goes straight between the computers. (The long-code method below needs no matchmaking server.)
const PJ_PREFIX = 'blkyshtr-v31-';
let pjLoading = null;
function loadPeerJS() {
    if (window.Peer) return Promise.resolve(window.Peer);
    if (pjLoading) return pjLoading;
    pjLoading = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
        s.onload = () => window.Peer ? res(window.Peer) : rej(new Error('The matchmaking helper failed to load.'));
        s.onerror = () => { pjLoading = null; rej(new Error("Couldn't reach the matchmaking service - are you online?")); };
        document.head.appendChild(s);
    });
    return pjLoading;
}
// "same Wi-Fi only" skips the address lookup / relay servers PeerJS normally uses
const pjOptions = () => NET.lanOnly ? { debug: 0, config: { iceServers: [] } } : { debug: 0 };
// turn a PeerJS connection into our own two pipes: its reliable channel, plus a fast fire-and-forget
// one we open on the same connection (PeerJS's own "unreliable" mode still re-sends lost packets)
function peerFromConn(conn) {
    const pc = conn.peerConnection, rel = conn.dataChannel;
    const fast = pc.createDataChannel('u', { negotiated: true, id: 50, ordered: false, maxRetransmits: 0 });
    rel.binaryType = fast.binaryType = 'arraybuffer';
    return { pc, rel, fast, off: undefined, conn };
}
async function hostOpenCode(tries = 0) {
    NET.codeState = 'loading'; NET.code = ''; renderMP();
    try {
        const Peer = await loadPeerJS();
        if (!NET.host) return;
        const code = String(100000 + Math.floor(Math.random() * 900000));
        const pj = new Peer(PJ_PREFIX + code, pjOptions());
        NET.pj = pj;
        pj.on('open', () => { if (NET.pj !== pj) return; NET.code = code; NET.codeState = 'ready'; renderMP(); });
        pj.on('error', (e) => {
            if (NET.pj !== pj) return;
            if (e.type === 'unavailable-id' && tries < 6) { pj.destroy(); hostOpenCode(tries + 1); return; }
            if (NET.codeState !== 'ready') { NET.codeState = 'error'; NET.codeErr = e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error' ? "Couldn't reach the matchmaking service." : 'Something went wrong making a code (' + e.type + ').'; renderMP(); }
        });
        pj.on('disconnected', () => { if (NET.pj === pj && !pj.destroyed) setTimeout(() => { try { pj.reconnect(); } catch (e) {} }, 1500); });
        pj.on('connection', (conn) => {
            conn.on('open', () => {
                if (conn.label !== 'blocky') { conn.close(); return; }
                const inv = { peer: peerFromConn(conn), done: false, key: '', status: '' };
                wirePeer(inv.peer, () => {}, () => hostPeerClosed(inv));
                hostPeerOpened(inv);
            });
        });
    } catch (e) { NET.codeState = 'error'; NET.codeErr = e.message; renderMP(); }
}
async function clientJoinCode(raw, attempt = 0) {
    const code = String(raw || '').replace(/\D/g, '');
    NET.joinCode = code;
    if (code.length !== 6) { NET.joinState = 'error'; NET.joinErr = 'Party codes are 6 digits.'; renderMP(); return; }
    NET.joinState = 'connecting'; renderMP();
    try {
        const Peer = await loadPeerJS();
        const pj = new Peer(pjOptions()); NET.pj = pj;
        let done = false;
        const fail = (msg, retry) => {
            if (done || NET.pj !== pj) return; done = true; clearTimeout(timer);
            try { pj.destroy(); } catch (e) {} NET.pj = null;
            if (retry && attempt < 2) { NET.joinErr = ''; setTimeout(() => clientJoinCode(code, attempt + 1), 1200); return; }   // try again by itself
            NET.joinState = 'error'; NET.joinErr = msg; renderMP();
        };
        const timer = setTimeout(() => fail("Couldn't connect in time. Double-check the code - or if you're on different networks, one of them may be blocking it (try the same Wi-Fi, or the long-code method).", true), 15000);
        pj.on('error', (e) => fail(e.type === 'peer-unavailable' ? `No party found with code ${code}. Check the number with the host.` : e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error' ? "Couldn't reach the matchmaking service - are you online?" : 'Connection problem (' + e.type + ').', e.type !== 'peer-unavailable'));
        pj.on('open', () => {
            const conn = pj.connect(PJ_PREFIX + code, { label: 'blocky', serialization: 'raw', reliable: true });
            conn.on('open', () => {
                if (done) return; done = true; clearTimeout(timer);
                const peer = peerFromConn(conn); NET.hostPeer = peer;
                wirePeer(peer, () => {}, () => netHostGone());
                NET.on = true; NET.host = false; NET.joinState = 'connected';
                sendRel(peer, { t: 'hi', name: NET.name }); renderMP();
                // matchmaking is done: hang up on the server, the game connection stays
                setTimeout(() => { try { pj.disconnect(); } catch (e) {} }, 1500);
            });
        });
    } catch (e) { NET.joinState = 'error'; NET.joinErr = e.message; renderMP(); }
}


// ---------- players ----------
function hostMe() { return { id: NET.id, name: NET.name, team: NET.team || 0, color: NET.color || COOP_COLORS[0], kills: 0, deaths: 0, alive: true, rtt: 0 }; }
function allPlayers() { if (NET.host && NET.on && !NET.me) NET.me = hostMe(); return NET.me ? [NET.me, ...netPlayers.values()] : [...netPlayers.values()]; }
function playerById(id) { return id === NET.id ? NET.me : netPlayers.get(id); }
function makePlayer(id, name, team, color) {
    return { id, name, team, color, peer: null, buf: new Interp([4, 5]), cur: [0, 0, 0, 0, 0, 0], w: 0, f: 0, hp: 100, alive: true, kills: 0, deaths: 0, rtt: 0,
             tgt: { id, pos: new V3(0, -100, 0), feet: -100, local: false, alive: false }, av: null, fireT: 0, seenT: 0, walk: 0 };
}
function playerColor(p) { return NET.lobby.mode === 'coop' || NET.mode === 'coop' ? p.color : TEAM_COLORS[p.team]; }


// ---------- HOST: invites ----------
async function hostCreateInvite() {
    const inv = { peer: newPeer(), code: '', status: 'Making an invite code...', done: false, key: Math.random().toString(36).slice(2, 8) };
    NET.invites.push(inv); renderMP();
    const pc = inv.peer.pc;
    wirePeer(inv.peer, () => hostPeerOpened(inv), () => hostPeerClosed(inv));
    try {
        await pc.setLocalDescription(await pc.createOffer());
        await iceDone(pc);
        inv.code = await packCode(pc.localDescription, inv.key);
        inv.status = 'Send this code to your friend. Then paste the reply code they send back.';
    } catch (e) { inv.status = 'Could not make a code: ' + e.message; }
    renderMP();
}
async function hostAcceptReply(inv, reply) {
    if (inv.accepting) return;                     // CONNECT pressed twice
    inv.accepting = true;
    let target = inv;
    try {
        const d = await unpackCode(reply);
        if (d.type !== 'answer') throw new Error('That is an invite code - you need the REPLY code from your friend.');
        // a reply knows which invite it answers: pasted into the wrong box (easy with several friends), it still
        // goes to the right invite instead of hanging on "connecting" forever
        if (d.k && d.k !== inv.key) {
            const other = NET.invites.find(i => i.key === d.k), n = NET.invites.indexOf(other) + 1;
            if (!other) throw new Error('That reply is for an invite that was already used or cancelled - your friend needs a NEW invite code.');
            if (other.accepting || other.done) throw new Error(`That reply belongs to invite #${n}, which is already connecting.`);
            inv.accepting = false; inv.reply = ''; inv.status = `That reply was for invite #${n} - connecting it there.`;
            target = other; other.accepting = true; other.reply = reply;
        }
        if (target.peer.pc.signalingState !== 'have-local-offer') throw new Error('This invite is already used or closed - make a new invite.');
        target.status = 'Connecting...'; renderMP();
        await target.peer.pc.setRemoteDescription({ type: d.type, sdp: d.sdp });
        setTimeout(() => { if (!target.done && !target.failed) { target.status = 'Still connecting... if this takes more than ~15s, the network may be blocking it (try the same Wi-Fi).'; renderMP(); } }, 8000);
    } catch (e) { target.accepting = false; target.status = e.message; renderMP(); }
}
function hostPeerOpened(inv) {
    if (inv.done) return;
    inv.done = true;
    NET.invites = NET.invites.filter(i => i !== inv);
    const cap = NET.inGame && NET.pvp ? MP_MODES[NET.mode].team * 2 : 10;
    if (allPlayers().length >= cap) { sendRel(inv.peer, { t: 'full' }); setTimeout(() => inv.peer.pc.close(), 500); renderMP(); return; }
    const id = NET.nextId++;
    const p = makePlayer(id, 'Player ' + id, 0, COOP_COLORS[id % COOP_COLORS.length]);
    p.peer = inv.peer; p.pending = true;
    inv.peer.player = p; inv.peer.lastMsg = performance.now();
    netPlayers.set(id, p);
    autoTeam(p);
    renderMP();
}
function hostPeerClosed(inv) {
    if (!inv.done) { inv.failed = true; inv.status = "Couldn't connect. Make a NEW invite (each code works once) and swap codes again. If it keeps failing, your networks may be blocking it - being on the same Wi-Fi helps."; renderMP(); return; }
    const p = inv.peer.player; if (p) netRemovePlayer(p.id, 'left the party');
}
function autoTeam(p) {
    if (NET.lobby.mode === 'coop') return;
    const n = [0, 0]; for (const q of allPlayers()) if (q !== p) n[q.team]++;
    p.team = n[0] <= n[1] ? 0 : 1;
}
function hostLobbyUpdate() {
    if (!NET.host) return;
    const players = allPlayers().map(p => ({ id: p.id, name: p.name, team: p.team, color: p.color, gv: p === NET.me ? GVL.on() : !!p.gv }));
    for (const p of netPlayers.values()) sendRel(p.peer, { t: 'lobby', you: p.id, mode: NET.lobby.mode, map: NET.lobby.map, diff: NET.lobby.diff, players });
    renderMP();
}
function netRemovePlayer(id, why) {
    const p = netPlayers.get(id); if (!p) return;
    netPlayers.delete(id);
    if (p.av) { scene.remove(p.av.g); p.av = null; }
    try { p.peer && p.peer.pc.close(); } catch (e) {}
    if (NET.host) { netBroadcast({ t: 'left', id }); hostLobbyUpdate(); }
    netFeed(`<span style="color:${hex(playerColor(p))}">${escHtml(p.name)}</span> ${why || 'left'}`);
    if (!NET.inGame) renderMP();
}


// ---------- GUEST: join ----------
// Every reply code is its own connection attempt, and players often redo the codes (a paste went wrong, the host
// cancelled and made a new invite). Older attempts can still be around: whichever one actually connects is used and
// the rest are hung up - an old attempt that fails later must never end the party you are in now (it used to kick
// you out a few seconds after you got in).
async function clientJoin(code) {
    let peer = null;
    try {
        const d = await unpackCode(code);
        if (d.type !== 'offer') throw new Error("That's a reply code - you need the host's INVITE code.");
        peer = newPeer();
        NET.joinPeers = (NET.joinPeers || []).filter(q => !q.gone);
        NET.joinPeers.push(peer);
        while (NET.joinPeers.length > 3) { const old = NET.joinPeers.shift(); old.gone = true; try { old.pc.close(); } catch (e) {} }
        NET.hostPeer = peer; NET.replyFor = String(code).replace(/\s+/g, '');
        wirePeer(peer, () => clientLinkOpen(peer), () => clientLinkClosed(peer));
        NET.joinState = 'making'; renderMP();
        await peer.pc.setRemoteDescription({ type: d.type, sdp: d.sdp });
        await peer.pc.setLocalDescription(await peer.pc.createAnswer());
        await iceDone(peer.pc);
        if (NET.hostPeer !== peer || NET.joinState !== 'making') return;        // got in another way / left / newer code meanwhile
        NET.replyCode = await packCode(peer.pc.localDescription, d.k);
        NET.joinState = 'reply'; renderMP();
    } catch (e) { if (peer && NET.hostPeer !== peer) return; NET.joinState = 'error'; NET.joinErr = e.message; renderMP(); }
}
function clientLinkOpen(peer) {
    if (peer.gone) return;
    if (NET.joinState === 'connected' && NET.hostPeer !== peer) { peer.gone = true; try { peer.pc.close(); } catch (e) {} return; }   // already in through another code
    NET.hostPeer = peer;
    for (const q of NET.joinPeers || []) if (q !== peer) { q.gone = true; try { q.pc.close(); } catch (e) {} }
    NET.joinPeers = [];
    NET.on = true; NET.host = false; NET.joinState = 'connected'; NET.joinVia = 'long';
    sendRel(peer, { t: 'hi', name: NET.name }); renderMP();
}
function clientLinkClosed(peer) {
    if (peer.gone) return;                // hung up on purpose, or already handled ('failed' and the channel closing both land here)
    // Not connected yet = the reply code is still on its way to the host. Until the host pastes it their computer can't
    // answer ours, so on most networks (school Wi-Fi, anything behind a router) Chrome calls the attempt 'failed' about
    // 15s after the reply code is made - but it comes straight back the moment the host pastes the reply. Copying a code
    // through a chat takes longer than 15s, so that used to drop everyone right as their reply went in. Keep waiting.
    if (peer.pc.connectionState === 'failed' && !(NET.hostPeer === peer && NET.joinState === 'connected')) return;
    peer.gone = true;
    if (NET.hostPeer === peer && NET.joinState === 'connected') { netHostGone(); return; }
    NET.joinPeers = (NET.joinPeers || []).filter(q => q !== peer);
    // an attempt that never connected: only speak up when it was the last one still trying - and stay on this screen
    if (NET.joinState !== 'reply' || NET.joinPeers.length) return;
    NET.joinState = 'error'; NET.showLong = true; NET.replyCode = '';
    NET.joinErr = "Couldn't connect to the host. Ask them for a NEW invite code (each one works once) and make a new reply. If it keeps failing, your networks may be blocking it - being on the same Wi-Fi helps.";
    renderMP();
}
function netHostGone(msg) {
    if (!NET.on && NET.joinState !== 'connected' && NET.joinState !== 'reply') return;
    const wasIn = NET.inGame, via = NET.joinVia;
    netReset();
    if (wasIn) { resetRun(); changeGameState('main'); }
    openMP('home');
    // long-code invites only work once, so "type the code again" would send them nowhere
    const again = via === 'long' ? 'To rejoin, ask the host for a NEW invite code.' : 'If it was a drop, type the code again to rejoin.';
    NET.homeMsg = msg ? (via === 'long' ? msg.replace(/type the code again[^.]*\./i, again) : msg) : 'The host ended the party (or the connection dropped). ' + again;
    renderMP();
}


// ---------- leaving ----------
function netLeave() {
    netSend({ t: 'bye' });
    const wasIn = NET.inGame;
    setTimeout(() => { for (const p of netPlayers.values()) try { p.peer && p.peer.pc.close(); } catch (e) {} ; try { NET.hostPeer && NET.hostPeer.pc.close(); } catch (e) {} ; }, 200);
    netReset();
    if (wasIn) { commitLife(); resetRun(); }
    changeGameState('main');
}
function netReset() {
    for (const p of netPlayers.values()) if (p.av) scene.remove(p.av.g);
    netPlayers.clear();
    for (const inv of NET.invites) try { inv.peer.pc.close(); } catch (e) {}
    for (const q of NET.joinPeers || []) { q.gone = true; try { q.pc.close(); } catch (e) {} }     // reply codes still waiting
    NET.joinPeers = []; NET.joinVia = ''; NET.inviteText = ''; NET.replyFor = '';
    if (NET.pj) { const pj = NET.pj; NET.pj = null; setTimeout(() => { try { pj.destroy(); } catch (e) {} }, 300); }
    Object.assign(NET, { saidHi: false, hostGvn: null, hostAsked: false, code: '', codeState: '', showLong: false, joinCode: '', on: false, host: false, pvp: false, inGame: false, dead: false, id: 0, team: 0, mode: 'coop', invites: [], hostPeer: null, joinState: '', replyCode: '', me: null, over: false, nextId: 1, feed: [], slowT: 0 });
    NET.hitOut.length = 0; NET.pvpOut.clear(); NET.myShots.length = 0; NET.shotOut.length = 0; NET.deadIds.clear();
    netHud(false);
    stopHiddenTicker();
    try { LAN.sync(); HGI.open = false; HGI.msg = ''; } catch (e) {}       // 5.0 (28b-mp-lan.js; not loaded yet on the very first call)
}


// ---------- messages ----------
function netMessage(peer, m) {
    if (NET.host) hostMessage(peer.player, peer, m); else clientMessage(m);
}
function gvAnswer(peer, m) {
    const L = GVL.L; if (!L || !L.online() || typeof m.n !== 'string' || m.n.length > 64 || !peer) return;
    L.prove(m.n, 'blocky').then(pr => { if (pr) sendRel(peer, { t: 'gva', p: pr }); });
}
function hostMessage(p, peer, m) {
    if (!p) return;
    const now = performance.now();
    switch (m.t) {
        case 'hi': {
            const first = p.pending;
            p.name = String(m.name || 'Player').replace(/[<>]/g, '').slice(0, 16) || 'Player'; p.pending = false;
            if (GVL.on() && !p.gvn) { p.gvn = GVL.L.newChallenge(); sendRel(peer, { t: 'gvq', n: p.gvn }); }   // "prove you are your Grapevine account"
            hostLobbyUpdate();
            if (first && NET.inGame) hostLateJoin(p);          // jumped into a match that's already going (or rejoined after a drop)
            break;
        }
        case 'gvq': gvAnswer(peer, m); break;
        case 'gva': {
            const L = GVL.L, n = p.gvn; if (!L || !n) break; p.gvn = null;
            L.check(m.p, n, 'blocky').then(r => {
                if (!r.ok || netPlayers.get(p.id) !== p) return;
                p.gv = true; p.name = r.name.slice(0, 16); L.noteMet(r.name, 'Blocky Shooter'); hostLobbyUpdate();
            });
            break;
        }
        case 'bye': netRemovePlayer(p.id, 'left the party'); break;
        case 'po': p.rtt = now - m.ts; break;
        case 'S': {
            clockSample(peer, m.ct, now);
            const s = m.p; if (!s) break;
            p.buf.push(m.ct, [s[0], s[1], s[2], s[3], s[4], s[5]]);
            p.last = s; p.w = m.w; p.f = m.f; p.hp = m.hp; p.seenT = now;
            p.tgt.pos.set(s[0], s[1], s[2]); p.tgt.feet = s[3];
            p.alive = !!(m.f & 1); p.tgt.alive = p.alive && NET.inGame;
            if (m.s && m.s.length) { for (const seg of m.s) { NET.shotOut.push([p.id, ...seg]); netShowShot(p, seg); } }
            break;
        }
        case 'h': if (NET.inGame && !NET.pvp) hostApplyHits(p.id, m.l); break;
        case 'ph': if (NET.inGame && NET.pvp) hostApplyPvpHits(p, m.l); break;
        case 'dead': hostOnDeath(p.id, m.by, m.s); break;
        case 'fx': netBroadcast(m, p.id); netPlayFx(m); break;
    }
}
function clientMessage(m) {
    const now = performance.now();
    switch (m.t) {
        case 'gvq': gvAnswer(NET.hostPeer, m); break;
        case 'gva': {
            const L = GVL.L, n = NET.hostGvn; if (!L || !n) break; NET.hostGvn = null;
            L.check(m.p, n, 'blocky').then(r => { if (!r.ok) return; const hp = netPlayers.get(0); if (hp) { hp.gv = true; hp.gvSelf = true; L.noteMet(r.name, 'Blocky Shooter'); renderMPPlayers(); } });
            break;
        }
        case 'lobby': {
            if (!NET.saidHi) { NET.saidHi = true; sendRel(NET.hostPeer, { t: 'hi', name: NET.name }); }
            if (GVL.on() && !NET.hostGvn && !NET.hostAsked) { NET.hostAsked = true; NET.hostGvn = GVL.L.newChallenge(); sendRel(NET.hostPeer, { t: 'gvq', n: NET.hostGvn }); }   // and the host proves itself to us
            NET.id = m.you; NET.lobby = { mode: m.mode, map: m.map, diff: m.diff };
            const seen = new Set();
            for (const q of m.players) {
                seen.add(q.id);
                if (q.id === NET.id) { NET.team = q.team; NET.color = q.color; continue; }
                let p = netPlayers.get(q.id);
                if (!p) { p = makePlayer(q.id, q.name, q.team, q.color); netPlayers.set(q.id, p); }
                p.name = q.name; p.team = q.team; p.color = q.color;
                if (q.id !== 0) p.gv = !!q.gv;               // the host vouches for the others; the host proves itself (gva)
                if (q.gv && q.id !== 0 && GVL.L) GVL.L.noteMet(q.name, 'Blocky Shooter');
            }
            for (const id of [...netPlayers.keys()]) if (!seen.has(id)) netRemovePlayer(id);
            renderMP();
            break;
        }
        case 'full': NET.joinState = 'error'; NET.joinErr = 'That party is full or already playing.'; renderMP(); break;
        case 'start': netBeginGame(m); if (m.late) netApplyLate(m.late); break;
        case 'pj': if (NET.inGame && m.id !== NET.id) {
                let p = netPlayers.get(m.id);
                if (!p) { p = makePlayer(m.id, m.name, m.team, m.color); netPlayers.set(m.id, p); }
                Object.assign(p, { name: m.name, team: m.team, color: m.color });
                if (!p.av) { p.av = makeAvatar(p); p.av.g.position.set(spawnPt[0], -50, spawnPt[1]); }
                netFeed(`<span style="color:${hex(NET.pvp ? TEAM_COLORS[p.team] : p.color)}">${escHtml(p.name)}</span> joined the match`);
            } break;
        case 'bye': netHostGone(); break;
        case 'left': netRemovePlayer(m.id, 'left the party'); break;
        case 'pi': sendRel(NET.hostPeer, { t: 'po', ts: m.ts }); break;
        case 'rt': for (const [id, rtt] of m.l) { const p = playerById(id); if (p) p.rtt = rtt; if (id === NET.id) NET.rtt = rtt; } break;
        case 'P': {
            clockSample(NET.hostPeer, m.ht, now);
            for (const s of m.p) {
                if (s[0] === NET.id) continue;
                const p = netPlayers.get(s[0]); if (!p) continue;
                p.buf.push(m.ht, [s[1], s[2], s[3], s[4], s[5], s[6]]);
                p.w = s[7]; p.f = s[8]; p.hp = s[9]; p.alive = !!(s[8] & 1); p.seenT = now;
            }
            if (m.s) for (const seg of m.s) { if (seg[0] === NET.id) continue; const p = netPlayers.get(seg[0]); netShowShot(p, seg.slice(1)); }
            break;
        }
        case 'wave': clientWaveStart(m.n); break;
        case 'clr': clientWaveClear(m.n); break;
        case 'k': clientKill(m); break;
        case 'd': if (NET.inGame) { takeDamage(m.a, m.f ? new V3(m.f[0], 0, m.f[1]) : null, typeof m.by === 'string' ? m.by.slice(0, 40) : undefined); if (m.jam) jamGun(clamp(+m.jam || 0.7, 0.1, 1.5)); if (m.kb) { push.x += m.kb[0]; push.z += m.kb[2]; if (m.kb[1]) { velocity.y = Math.max(velocity.y, m.kb[1]); onGround = false; } } } break;
        case 'pd': netPvpDamaged(m.a, m.by, m.h, m.s, m.f); break;
        case 'fx': netPlayFx(m); break;
        case 'bfx': netBossFx(m); break;
        case 'sp': netSpitFx(m); break;
        case 'tr': spawnTracer(new V3(...m.a), new V3(...m.b), m.c, 0.09, 0.18); sfxAt('laser', camera.position.distanceTo(new V3(...m.a))); break;
        case 'feed': netOnFeed(m); break;
        case 'score': netOnScore(m); break;
        case 'end': netShowEnd(m); break;
        case 'over': netShowEnd(m); break;
    }
}
function netBinary(peer, buf) {
    if (NET.host || !NET.inGame || NET.pvp) return;
    const dv = new DataView(buf);
    if (dv.getUint8(0) !== 1) return;
    const now = performance.now(), ht = dv.getFloat64(1);
    clockSample(NET.hostPeer, ht, now);
    const n = dv.getUint16(11);
    let o = 13;
    for (let i = 0; i < n; i++, o += 14) {
        const id = dv.getUint16(o), ti = dv.getUint8(o + 2), fl = dv.getUint8(o + 3);
        const x = dv.getInt16(o + 4) / 32, y = dv.getInt16(o + 6) / 32, z = dv.getInt16(o + 8) / 32;
        const rot = dv.getUint8(o + 10) / 256 * Math.PI * 2, hpf = dv.getUint8(o + 11) / 255, tg = dv.getUint8(o + 12), xb = dv.getUint8(o + 13);
        let e = enemyById.get(id);
        if (!e) { if (NET.deadIds.has(id)) continue; e = netSpawnRemoteEnemy(id, ENEMY_IDS[ti] || 'grunt', x, y, z); }
        const u = e.userData;
        u.net.buf.push(ht, [x, y, z, rot]);
        u.net.seen = now; u.net.fl = fl; u.net.tg = tg; u.net.x = xb; u.phase2 = !!(xb & 2);
        const hp = hpf * u.maxHp;
        u.hp = u.net.predT > now ? Math.min(u.hp, hp) : hp;
        u.barShow = hpf < 0.999;
    }
}
