/*!
 * HGNet 1.0 - online multiplayer for Huntington Games.
 *
 * One self-contained file (ES5, no build step) that a game pastes inline to get online play with a
 * 6-digit room code. Read src/hgnet-README.md for how to use it from a game.
 *
 * WHY IT IS BUILT THIS WAY
 * Our old games connected players with WebRTC peer-to-peer only. Between two homes or schools (for
 * example New York <-> North Carolina) that usually fails: both sides sit behind routers (NATs) that
 * refuse unsolicited traffic and we had no TURN relay, so the guest "joined" and was dropped at once.
 * HGNet turns that around:
 *
 *   1. RELAY IS THE BACKBONE. Every session is set up and run through public MQTT-over-WebSocket
 *      brokers ("relays"), preferring ones on port 443 because school firewalls allow ordinary
 *      HTTPS ports far more often than 8084/8884/8081. Plain outgoing wss:// works almost everywhere.
 *   2. MANY RELAYS AT ONCE. The host connects to every relay it can reach and serves the room on all of
 *      them; a guest uses whichever of those it can reach. Players behind different firewalls can end
 *      up on different relays and the host bridges them (the room is a star around the host).
 *   3. WEBRTC IS ONLY A SPEED-UP. Once a session is running, HGNet quietly tries a direct WebRTC link
 *      (via PeerJS). If it connects, traffic moves onto it; if it stalls or dies, traffic moves back to
 *      the relay without the game noticing. A WebRTC failure never ends a session.
 *   4. OUR OWN RELIABILITY LAYER. Relays only offer "at most once" (MQTT QoS 0), messages can arrive
 *      twice (several relays/routes) or out of order (route switches). Reliable messages therefore carry
 *      sequence numbers and are acknowledged, retransmitted, de-duplicated and delivered in order.
 *      'fast' messages (snapshots) skip all of that: newest wins, stale or duplicate ones are dropped.
 *   5. CHROMEBOOK-PROOF LIVENESS. Background tabs get their timers throttled (1/second, or 1/minute
 *      after 5 minutes hidden). HGNet's housekeeping runs from a Web Worker beat, its publishes go
 *      straight onto the WebSocket, and heartbeats are answered from the network event, so a hidden tab
 *      keeps its connection fully alive (see "background-proof scheduling"). A peer is only marked
 *      'lagging' / 'reconnecting' for the UI, and it is dropped only after a long silence (90 s by
 *      default). A guest whose network blips reconnects by itself and gets the same player id back.
 *
 * WIRE FORMAT (all frames are small JSON objects; v = protocol version, t = type, f = sender id)
 *   Topics on every relay:  hgnet1/<game>/<code>/h         host inbox (join requests, guest traffic)
 *                           hgnet1/<game>/<code>/g/<eid>   one inbox per endpoint (host replies, echo)
 *                           hgnet1/<game>/<code>/b         host -> everyone (fast broadcasts, goodbye, last will)
 *   Types: pr/tk probe + "code taken"  he/wl/dn/wt join request / welcome / denied / please wait
 *          pi/po ping/pong  d reliable data  a ack  u fast data  by goodbye (carries a key from the
 *          welcome)  gn last will ("connection lost")
 *          nk "I don't know you" (host -> guest that should rejoin)  ec relay self-check echo
 *
 * Relay traffic is public and untrusted: anybody who knows the topic can read or inject frames. HGNet
 * validates and size-limits everything it receives and ignores anything malformed, but it does NOT
 * encrypt or authenticate. Never send passwords or personal data through it.
 */
(function (root) {
  'use strict';
  if (root.HGNet && root.HGNet.version) return; // pasted twice: keep the first copy

  /* ====================================================================================
   * 1. Constants and defaults
   * ==================================================================================== */

  var VERSION = '1.1.0';
  var PROTO = 1;
  var TOPIC_ROOT = 'hgnet1';

  // Order matters only as a tie-breaker: port 443 relays come first because they get through the most
  // school/office firewalls. All of them are connected in parallel.
  var DEFAULT_RELAYS = [
    { url: 'wss://mqtt.eclipseprojects.io:443/mqtt', name: 'Eclipse' },
    { url: 'wss://public.cloud.shiftr.io:443', name: 'Shiftr', username: 'public', password: 'public' },
    { url: 'wss://broker.emqx.io:8084/mqtt', name: 'EMQX' },
    { url: 'wss://broker.hivemq.com:8884/mqtt', name: 'HiveMQ' },
    { url: 'wss://test.mosquitto.org:8081/mqtt', name: 'Mosquitto' }
  ];

  // STUN finds our public address; the PeerJS TURN servers relay media when STUN alone is not enough.
  // If none of this works we simply stay on the MQTT relay.
  var DEFAULT_ICE = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }
  ];

  var DEFAULT_PEER_HOST = '0.peerjs.com'; // PeerJS's free signalling server (used when peer.host is not given)

  // Pinned library versions; a second CDN is tried if the first one is blocked.
  var LIB_URLS = {
    mqtt: ['https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js', 'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js'],
    peerjs: ['https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js', 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js']
  };

  var LIMITS = {
    payload: 32000,          // max bytes we put in one MQTT publish / WebRTC message
    chunkBudget: 24000,      // escaped size of one chunk of a big message (stays well under payload)
    incoming: 36000,         // frames bigger than this are dropped unread
    message: 4 * 1024 * 1024, // biggest message a game may send (after JSON encoding)
    chunks: 256,             // most chunks one message may be split into
    info: 4096,              // max JSON size of the room/player 'info' objects
    name: 32,                // max player name length
    txWindow: 128,           // reliable messages in flight per peer before we queue
    rxWindow: 512,           // out-of-order reliable messages we are willing to buffer (a sender keeps at
                             // most ~txWindow + 32 ahead, so this is plenty and caps memory a spoofer could use)
    maxId: 999,
    rtoMax: 8000,
    sockFast: 256 * 1024,    // relay socket backlog (bytes) above which 'fast' frames are dropped...
    sockMax: 8 * 1024 * 1024 // ...and above which reliable frames wait for their retransmission
  };

  // Every timing can be overridden through HGNet.create({ ... }). All values are milliseconds.
  var DEFAULTS = {
    tickMs: 100,             // housekeeping timer
    relayConnectMs: 8000,    // how long one relay may take to connect
    helloEveryMs: 1500,      // guest repeats its join request this often until the host answers
    notFoundMs: 5000,        // ...and reports "no game with that code" this long after first asking
    joinTimeoutMs: 20000,    // hard limit for join()
    probeMs: 1500,           // host listens this long for another host already using a code
    pingRelayMs: 2000,       // heartbeat on a peer's main relay
    pingSpareMs: 5000,       // heartbeat on the other relays (keeps them warm for fail-over)
    pingDirectMs: 1000,      // heartbeat on the WebRTC link
    relayFreshMs: 7000,      // a relay counts as working for a peer if we heard the peer on it this recently
    directStallMs: 3000,     // our WebRTC heartbeats unanswered this long -> traffic goes back to the relay
    directTimeoutMs: 12000,  // a WebRTC attempt that is not working after this is abandoned
    lagMs: 4000,             // peer silent this long -> 'lagging'
    reconnectingMs: 10000,   // peer silent this long -> 'reconnecting'
    dropMs: 90000,           // host removes a guest that has been silent this long
    giveUpMs: 120000,        // guest stops trying to get back into the room after this
    rejoinMs: 120000,        // host keeps a departed player's slot this long for a rejoin
    echoMs: 10000,           // idle relays are self-checked this often...
    echoTimeoutMs: 6000      // ...and recycled after two unanswered checks
  };

  /* ====================================================================================
   * 2. Small utilities
   * ==================================================================================== */

  var perf = root.performance && typeof root.performance.now === 'function' ? root.performance : null;
  function now() { return perf ? perf.now() : Date.now(); } // monotonic clock for all timing
  function noop() {}
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function isInt(x, lo, hi) { return typeof x === 'number' && x % 1 === 0 && x >= lo && x <= hi; }
  function isStr(x, max) { return typeof x === 'string' && x.length <= max; }
  function isArr(x) { return Object.prototype.toString.call(x) === '[object Array]'; }
  function isObj(x) { return x !== null && typeof x === 'object' && !isArr(x); }
  function clampNum(x, lo, hi, dflt) { x = Number(x); return isFinite(x) ? Math.min(hi, Math.max(lo, x)) : dflt; }
  function round1(x) { return Math.round(x * 10) / 10; }
  function pageHidden() { try { return !!(root.document && root.document.hidden); } catch (e) { return false; } }

  function randInt(n) { // uniform 0..n-1, crypto quality when available
    try {
      var c = root.crypto || root.msCrypto;
      if (c && c.getRandomValues) { var a = new Uint32Array(1); c.getRandomValues(a); return a[0] % n; }
    } catch (e) { /* fall through */ }
    return Math.floor(Math.random() * n);
  }
  function randId(len) { var s = '', abc = 'abcdefghijklmnopqrstuvwxyz0123456789'; while (s.length < len) s += abc.charAt(randInt(36)); return s; }
  function randCode() { return String(100000 + randInt(900000)); }
  function normCode(c) { return String(c === undefined || c === null ? '' : c).replace(/[\s.\-]/g, ''); }

  function hgError(code, message) { var e = new Error(message); e.code = code; return e; }

  // JSON with every non-ASCII character escaped, so string length == byte length on the wire.
  function toAscii(s) {
    if (!/[^\x00-\x7e]/.test(s)) return s;
    return s.replace(/[\u007f-\uffff]/g, function (c) { return '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4); });
  }
  function encodeMsg(msg) {
    var s = JSON.stringify(msg === undefined ? null : msg);
    if (s === undefined) s = 'null'; // functions etc.
    s = toAscii(s);
    if (s.length > LIMITS.message) throw hgError('too-big', 'HGNet: message is too big (' + s.length + ' bytes, max ' + LIMITS.message + ').');
    return s;
  }
  // A frame is a small header object plus (optionally) the already-encoded message JSON appended as "m".
  function encodeFrame(hdr, mj) {
    var s = toAscii(JSON.stringify(hdr));
    if (mj !== undefined) s = s.slice(0, -1) + ',"m":' + mj + '}';
    return s;
  }
  // Cut message JSON into pieces whose size *after* being embedded as a JSON string stays under budget.
  function splitPieces(s, budget) {
    var parts = [], start = 0, cost = 0, i, ch, c;
    for (i = 0; i < s.length; i++) {
      ch = s.charCodeAt(i);
      c = (ch === 34 || ch === 92) ? 2 : (ch < 32 ? 6 : 1);
      if (cost + c > budget) { parts.push(s.slice(start, i)); start = i; cost = 0; }
      cost += c;
    }
    parts.push(s.slice(start));
    return parts;
  }
  function jsonSize(v) { try { var s = JSON.stringify(v); return s === undefined ? 0 : toAscii(s).length; } catch (e) { return Infinity; } }
  function cleanName(n, dflt) {
    n = (typeof n === 'string' ? n : (n === undefined || n === null ? '' : String(n))).replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, '').replace(/^\s+|\s+$/g, '');
    return n.slice(0, LIMITS.name) || dflt;
  }
  function cleanGame(g) { g = String(g || 'game').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24); return g || 'game'; }
  function toId(x) {
    if (typeof x === 'string' && /^\d{1,3}$/.test(x)) x = +x;
    return isInt(x, 0, LIMITS.maxId) ? x : null;
  }
  function decodeUtf8(buf) {
    if (typeof buf === 'string') return buf;
    try { if (root.TextDecoder) return new root.TextDecoder().decode(buf); } catch (e) { /* fall through */ }
    return String(buf);
  }
  function each(obj, fn) { for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) fn(obj[k], k); }

  /* ---------- tiny event emitter (a throwing game handler must never break networking) ---------- */
  function Emitter() {}
  Emitter.prototype.on = function (evt, fn) {
    if (typeof fn !== 'function') return this;
    var ev = this._ev || (this._ev = {});
    (ev[evt] || (ev[evt] = [])).push(fn);
    return this;
  };
  Emitter.prototype.off = function (evt, fn) {
    var list = this._ev && this._ev[evt];
    if (!list) return this;
    if (!fn) { delete this._ev[evt]; return this; }
    for (var i = list.length - 1; i >= 0; i--) if (list[i] === fn) list.splice(i, 1);
    return this;
  };
  Emitter.prototype.emit = function (evt) {
    var list = this._ev && this._ev[evt];
    if (!list || !list.length) return;
    var args = Array.prototype.slice.call(arguments, 1);
    list = list.slice();
    for (var i = 0; i < list.length; i++) {
      try { list[i].apply(this, args); } catch (e) {
        if (root.console) root.console.error('[HGNet] error in your "' + evt + '" handler:', e);
      }
    }
  };

  /* ---------- lazy script loading with CDN fallback ---------- */
  var libPromises = {};
  function loadLib(key, globalName, urls, timeoutMs) {
    if (root[globalName]) return Promise.resolve(root[globalName]);
    if (libPromises[key]) return libPromises[key];
    var p = new Promise(function (resolve, reject) {
      var i = 0;
      (function next() {
        if (root[globalName]) { resolve(root[globalName]); return; }
        if (!root.document || i >= urls.length) { reject(hgError('blocked', 'Could not load ' + key)); return; }
        var url = urls[i++], s = root.document.createElement('script'), done = false;
        var timer = setTimeout(function () { finish(false); }, timeoutMs || 15000);
        function finish(ok) {
          if (done) return;
          done = true; clearTimeout(timer); s.onload = s.onerror = null;
          if (ok && root[globalName]) resolve(root[globalName]); else next();
        }
        s.onload = function () { finish(true); };
        s.onerror = function () { finish(false); };
        s.async = true; s.src = url;
        (root.document.head || root.document.documentElement).appendChild(s);
      })();
    });
    libPromises[key] = p;
    p.then(null, function () { if (libPromises[key] === p) delete libPromises[key]; }); // allow a later retry
    return p;
  }
  function loadMqtt(opts) { return loadLib('mqtt', 'mqtt', opts.libs.mqtt, 15000); }
  function loadPeerJS(opts) { return loadLib('peerjs', 'Peer', opts.libs.peerjs, 15000); }

  // mqtt.js runs its keep-alive timer in a Web Worker so it is not throttled in background tabs.
  // Some sandboxes forbid workers; then we fall back to normal timers instead of failing to connect.
  var workerOk = null;
  function workersAllowed() {
    if (workerOk !== null) return workerOk;
    try {
      var url = root.URL.createObjectURL(new root.Blob([''], { type: 'application/javascript' }));
      var w = new root.Worker(url); w.terminate(); root.URL.revokeObjectURL(url); workerOk = true;
    } catch (e) { workerOk = false; }
    return workerOk;
  }

  /* ---------- background-proof scheduling ----------
   * Chrome throttles timers in background tabs: one wake-up per second, and once a tab has been hidden for
   * 5 minutes only ONE PER MINUTE for "chained" timers - any setTimeout/setInterval created inside another
   * timer callback, which includes every game loop and every timer such a loop starts. Measured in real
   * Chromium, two things are NOT throttled even then: messages from a Web Worker (the worker's own timers run
   * at full speed) and MessageChannel messages; timers created inside those handlers are on time as well.
   * So HGNet
   *   - drives its housekeeping from a tiny worker (every(), with a normal interval as backup), and
   *   - makes every call into mqtt.js from a MessageChannel callback (soon()). mqtt.js pushes all its socket
   *     writes through ONE shared setTimeout(0) queue; started from a game loop in a hidden tab, that queue
   *     waits up to a minute and holds back every write behind it (pings, welcomes, game data). Our own
   *     publishes skip mqtt.js altogether and go straight onto the WebSocket (see RelayPool.publish).
   */
  var soonQ = [], soonCh = null;
  function soonRun() {
    var a = soonQ; soonQ = [];
    for (var i = 0; i < a.length; i++) {
      try { a[i](); } catch (e) { if (root.console) root.console.error('[HGNet]', e); }
    }
  }
  function soon(fn) {
    soonQ.push(fn);
    if (soonQ.length > 1) return; // already scheduled
    if (soonCh === null) {
      try { soonCh = new root.MessageChannel(); soonCh.port1.onmessage = soonRun; } catch (e) { soonCh = false; }
    }
    if (soonCh) soonCh.port2.postMessage(0); else setTimeout(soonRun, 0);
  }

  // A worker whose only job is to send us "tick" messages; shared by everything on the page.
  var TICK_WORKER_SRC = 'var t={};onmessage=function(e){var d=e.data;clearInterval(t[d[1]]);delete t[d[1]];' +
    'if(d[0])t[d[1]]=setInterval(function(){postMessage(d[1])},d[2])}';
  var tickW = { w: undefined, fns: {}, next: 1 };
  function tickWorker() {
    if (tickW.w !== undefined) return tickW.w;
    tickW.w = null;
    if (!workersAllowed()) return null;
    try {
      var url = root.URL.createObjectURL(new root.Blob([TICK_WORKER_SRC], { type: 'application/javascript' }));
      var w = new root.Worker(url);
      w.onmessage = function (e) { var f = tickW.fns[e.data]; if (f) f(); };
      w.onerror = function () { tickW.w = null; }; // blocked after all (e.g. CSP): the backup intervals carry on
      tickW.w = w;
    } catch (e) { tickW.w = null; }
    return tickW.w;
  }
  // every(ms, fn): call fn(elapsedMs) about every ms, also while the tab is in the background. Returns stop().
  // A worker provides the beat; a normal setInterval runs alongside as a backup (whichever comes first wins,
  // so fn still runs about once per ms).
  function every(ms, fn) {
    ms = Math.max(4, Math.round(clampNum(ms, 4, 3600000, 100)));
    var id = tickW.next++, last = now(), stopped = false, w = tickWorker();
    function beat() {
      if (stopped) return;
      var t = now();
      if (t - last < ms * 0.75) return; // the other source already ran it (keeps the pace at about ms)
      var dt = t - last; last = t;
      fn(dt);
    }
    var iv = setInterval(beat, ms);
    if (w) { tickW.fns[id] = beat; try { w.postMessage([1, id, ms]); } catch (e) { delete tickW.fns[id]; } }
    return function stop() {
      if (stopped) return;
      stopped = true; clearInterval(iv);
      if (tickW.fns[id]) { delete tickW.fns[id]; try { if (tickW.w) tickW.w.postMessage([0, id]); } catch (e) { /* ignore */ } }
    };
  }

  /* ---------- options (code options, overridable by URL parameters for testing) ---------- */
  function parsePeer(s) {
    var m = /^(?:(https?|wss?):\/\/)?([^:\/?#]+)(?::(\d+))?(\/[^?#]*)?$/.exec(String(s || '').replace(/^\s+|\s+$/g, ''));
    if (!m) return null;
    var port = m[3] ? +m[3] : (m[1] ? (/s$/.test(m[1]) ? 443 : 80) : 443);
    return { host: m[2], port: port, path: m[4] || '/', secure: m[1] ? /s$/.test(m[1]) : port === 443 };
  }
  function readUrlParams() {
    var out = {}, s = '', p = {};
    try { s = (root.location && root.location.search) || ''; } catch (e) { return out; }
    s.replace(/^\?/, '').split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      try { p[decodeURIComponent(i < 0 ? kv : kv.slice(0, i)).toLowerCase()] = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); } catch (e) { /* ignore malformed */ }
    });
    if (p.hgrelays) out.relays = p.hgrelays.split(',');
    if ('hgpeer' in p) out.peer = (p.hgpeer === 'off' || p.hgpeer === '0') ? false : parsePeer(p.hgpeer);
    if ('hgforcerelay' in p) out.forceRelay = p.hgforcerelay !== '0';
    if ('hgnorelay' in p) out.noRelay = p.hgnorelay !== '0';
    if (p.hgdrop) out.dropRate = parseFloat(p.hgdrop);
    if (p.hglatency) out.latency = parseFloat(p.hglatency);
    if (p.hgjitter) out.jitter = parseFloat(p.hgjitter);
    if ('hglog' in p) out.log = p.hglog !== '0';
    if (p.hgice === 'none') out.iceServers = [];
    return out;
  }
  function normRelays(list) {
    var out = [], seen = {};
    (isArr(list) ? list : [list]).forEach(function (r) {
      if (typeof r === 'string') r = { url: r };
      if (!isObj(r) || typeof r.url !== 'string') return;
      var url = r.url.replace(/^\s+|\s+$/g, '');
      if (!/^wss?:\/\/[^\s\/]+/i.test(url) || seen[url] || out.length >= 8) return;
      seen[url] = true;
      var host = /^wss?:\/\/([^\/:]+)/i.exec(url)[1];
      out.push({ url: url, name: r.name ? String(r.name).slice(0, 24) : host, username: r.username, password: r.password });
    });
    return out;
  }
  function buildOptions(o) {
    o = o || {};
    var q = o.urlParams === false ? {} : readUrlParams(), out = {}, k;
    function pick(key) { return q[key] !== undefined ? q[key] : o[key]; }
    out.game = cleanGame(o.game);
    out.relays = normRelays(pick('relays') || DEFAULT_RELAYS);
    var peer = pick('peer');
    out.peer = peer === false ? false : (isObj(peer) ? peer : {});
    out.iceServers = isArr(pick('iceServers')) ? pick('iceServers') : DEFAULT_ICE;
    out.forceRelay = !!pick('forceRelay');
    out.noRelay = !!pick('noRelay');
    out.dropRate = clampNum(pick('dropRate'), 0, 1, 0);
    out.latency = clampNum(pick('latency'), 0, 20000, 0);
    out.jitter = clampNum(pick('jitter'), 0, 20000, 0);
    out.log = pick('log');
    out.guestToGuest = o.guestToGuest !== false;
    out.resume = o.resume !== false;
    out.libs = { mqtt: isArr(o.mqttUrls) ? o.mqttUrls : LIB_URLS.mqtt, peerjs: isArr(o.peerjsUrls) ? o.peerjsUrls : LIB_URLS.peerjs };
    for (k in DEFAULTS) out[k] = isNum(o[k]) && o[k] > 0 ? o[k] : DEFAULTS[k];
    return out;
  }

  /* ---------- remembered session tokens (so a reloaded page gets its old slot back) ---------- */
  function tokenKey(game, code) { return 'hgnet:' + game + ':' + code; }
  function loadToken(game, code) {
    try { var t = root.sessionStorage.getItem(tokenKey(game, code)); return t && /^[a-z0-9]{8,40}$/.test(t) ? t : null; } catch (e) { return null; }
  }
  function saveToken(game, code, tok) { try { root.sessionStorage.setItem(tokenKey(game, code), tok); } catch (e) { /* private mode etc. */ } }
  function clearToken(game, code) { try { root.sessionStorage.removeItem(tokenKey(game, code)); } catch (e) { /* ignore */ } }

  /* ---------- frame validation (relay traffic is untrusted) ---------- */
  var EID_RE = /^[a-z0-9]{8,16}$/;
  function parseFrame(str) {
    if (typeof str !== 'string' || str.length > LIMITS.incoming || str.charCodeAt(0) !== 123) return null;
    var fr;
    try { fr = JSON.parse(str); } catch (e) { return null; }
    if (!isObj(fr) || fr.v !== PROTO || !isStr(fr.t, 2) || !isStr(fr.f, 16) || !EID_RE.test(fr.f)) return null;
    return fr;
  }

  /* ====================================================================================
   * 3. RelayPool - one MQTT-over-WebSocket connection per relay, all in parallel
   * ==================================================================================== */

  // Packets we write straight onto a relay's WebSocket (MQTT 3.1.1).
  var PINGREQ = [0xc0, 0x00], DISCONNECT = [0xe0, 0x00];

  function RelayPool(net) {
    this.net = net;
    this.list = net.opts.relays.map(function (r, i) {
      return {
        idx: i, url: r.url, name: r.name, username: r.username, password: r.password,
        client: null, up: false, everUp: false, upAt: 0, failures: 0, attempts: 0, hung: 0,
        retryAt: 0, connectStart: 0, connectMs: null, lastPingReq: 0,
        rtt: null, lastError: '', lastRx: 0, echoOut: null, echoMiss: 0, suspect: false, txBytes: 0, rxBytes: 0
      };
    });
    this.topics = [];
    this.will = null;
    this.lib = null;
    this.closed = false;
    this.lastUpAt = 0;
  }

  RelayPool.prototype.start = function (lib, topics, will) {
    this.lib = lib; this.topics = topics.slice(); this.will = will;
    for (var i = 0; i < this.list.length; i++) this._connect(this.list[i]);
  };

  // How long one connection attempt may take. Normally relayConnectMs (8 s). But while we have NO working
  // relay, a relay that has answered before gets a much shorter limit (3x its usual connect time + 1.5 s,
  // at least 2.5 s): an attempt started while the internet was out can hang for good (Wi-Fi still
  // associated), and waiting it out would leave players on "reconnecting" ~10 s after the network is back.
  // Hung attempts are aborted and replaced by a fresh one (a fresh attempt also gets a fresh TCP handshake;
  // running several in parallel would not help, browsers open one WebSocket per server at a time). The limit
  // grows to at most twice that if attempts keep timing out, so a network that has become slow still gets in.
  RelayPool.prototype._attemptMs = function (r) {
    var full = this.net.opts.relayConnectMs;
    if (!r.everUp || r.connectMs === null || this.upCount() > 0) return full;
    return Math.min(full, Math.max(2500, r.connectMs * 3 + 1500) * Math.min(2, Math.pow(1.4, r.hung)));
  };

  // Start one connection attempt. All calls into mqtt.js happen inside soon() (see "background-proof
  // scheduling" above); r.client holds a placeholder until then so nothing starts a second attempt.
  RelayPool.prototype._connect = function (r) {
    var self = this, net = this.net;
    if (this.closed || r.client) return;
    r.retryAt = 0;
    r.attempts++;
    r.connectStart = now();
    var slot = { placeholder: true };
    r.client = slot;
    var o = {
      clientId: 'hg' + randId(14), clean: true, protocolVersion: 4,
      connectTimeout: net.opts.relayConnectMs + 2000, reconnectPeriod: 0, // our own timeout and backoff are in tick()/_failed()
      // Keep-alive: we write a PINGREQ ourselves every 15 s (tick), and the relay sees our heartbeats anyway.
      // Without a worker our timers may run only once a minute in a hidden tab, so ask for a longer window.
      keepalive: workersAllowed() ? 30 : 90, resubscribe: false, queueQoSZero: false,
      timerVariant: workersAllowed() ? 'auto' : 'native'
    };
    if (r.username) { o.username = r.username; o.password = r.password || ''; }
    if (this.will) o.will = { topic: this.will.topic, payload: this.will.payload, qos: 0, retain: false };
    soon(function () {
      if (r.client !== slot || self.closed) return; // given up (or closed) before we got here
      var c;
      try { c = self.lib.connect(r.url, o); } catch (e) {
        r.lastError = String(e && e.message || e).slice(0, 80);
        r.client = null;
        self._failed(r);
        return;
      }
      r.client = c;
      c.on('connect', function () {
        if (r.client !== c || self.closed) return;
        r.connectMs = Math.round(now() - r.connectStart);
        if (!self.topics.length) { self._markUp(r, c); return; }
        c.subscribe(self.topics, { qos: 0 }, function (err) {
          if (r.client !== c || self.closed) return;
          if (err) { r.lastError = 'subscribe refused'; self._drop(r, c); return; }
          self._markUp(r, c);
        });
      });
      c.on('message', function (topic, payload) { if (r.client === c && !self.closed) self._onMessage(r, topic, payload); });
      c.on('error', function (e) { if (r.client === c) r.lastError = String(e && e.message || e).slice(0, 80); }); // 'close' follows
      c.on('close', function () { if (r.client === c) self._drop(r, c); });
    });
  };

  RelayPool.prototype._markUp = function (r, c) {
    // (r.failures is NOT reset here: see _failed - a relay that keeps kicking us out must keep backing off)
    r.up = true; r.everUp = true; r.upAt = now(); r.lastError = ''; r.hung = 0;
    r.lastRx = now(); r.echoOut = null; r.echoMiss = 0; r.suspect = false; r.lastPingReq = now();
    this.lastUpAt = now();
    this.net._log('relay up: ' + r.name + ' (' + r.connectMs + ' ms)');
    this.net._onRelayUp(r);
  };

  function endClient(c, graceful) {
    if (!c || c.placeholder) return;
    soon(function () { try { c.end(!graceful); } catch (e) { /* already closed */ } });
  }

  // Connection lost or failed: forget the client, tell the session, try again later with backoff.
  RelayPool.prototype._drop = function (r, c) {
    if (r.client !== c || !c) return;
    r.client = null;
    var wasUp = r.up;
    r.up = false; r.echoOut = null;
    endClient(c);
    if (wasUp) { this.net._log('relay down: ' + r.name); this.net._onRelayDown(r); }
    else this.net._log('relay failed: ' + r.name + (r.lastError ? ' (' + r.lastError + ')' : ''));
    this._failed(r, wasUp);
  };

  RelayPool.prototype._failed = function (r, wasUp) {
    if (this.closed) return;
    // A connection that had been up for a while and then dropped: probably a network blip, so reconnect
    // almost at once (0.3 s). A connection that died soon after connecting (a broker that keeps kicking us
    // out, e.g. for rate limits) counts as a failure, so such a relay is not hammered several times a
    // second. A relay that has worked before is retried quickly (0.5 s, 1 s, 2 s, 4 s, then every 5 s);
    // one that never answered backs off up to 30 s. While we have no relay at all, a relay that worked before
    // and whose last attempt just hung (no answer at all) is tried again right away - that attempt already
    // took a few seconds, and the network may be back.
    var stable = wasUp && now() - r.upAt > 10000, urgent = !this.upCount();
    if (stable) r.failures = 0;
    r.failures++;
    var base;
    if (stable) base = 300;
    else if (r.everUp && urgent && r.lastError === 'timed out') base = 300;
    else if (r.everUp) base = Math.min(urgent ? 2000 : 5000, 500 * Math.pow(2, Math.min(r.failures - 1, 4)));
    else base = Math.min(30000, 1000 * Math.pow(2, Math.min(r.failures - 1, 5)));
    r.retryAt = now() + base * (0.75 + Math.random() * 0.5);
    this.net._onRelayFailed(r);
  };

  RelayPool.prototype._onMessage = function (r, topic, payload) {
    var net = this.net;
    net._tickIfLate(true); // our timers may be starved (no worker in a background tab): traffic drives us too
    if (this.closed) return;
    if (!payload || payload.length > LIMITS.incoming) { net.stats.malformed++; return; }
    var str = decodeUtf8(payload);
    r.rxBytes += str.length;
    r.lastRx = now();
    var fr = parseFrame(str);
    if (!fr) { net.stats.malformed++; return; }
    if (fr.t === 'ec') { // our own self-check echo
      if (fr.f === net.eid && r.echoOut && fr.n === r.echoOut.n) { r.rtt = Math.round(now() - r.echoOut.at); r.echoOut = null; r.echoMiss = 0; r.suspect = false; }
    } else net._onRelayFrame(r, topic, fr, str.length);
    net._tickIfLate(false);
  };

  /* ---------- writing straight onto the WebSocket ----------
   * Every PUBLISH we make is encoded here and handed to the relay's WebSocket at once (see "background-proof
   * scheduling"). mqtt.js itself only writes CONNECT/SUBSCRIBE/UNSUBSCRIBE (and a PINGREQ if ours ever stop),
   * each as one complete packet, so our packets never land in the middle of one of its packets. If mqtt.js's
   * socket is not reachable (another mqtt.js build already on the page) we use its normal publish instead. */
  function rawSocket(c) {
    var s = c && !c.placeholder && c.stream && c.stream.socket;
    return s && s.readyState === 1 && typeof s.send === 'function' ? s : null;
  }
  var asciiEnc = null;
  try { if (root.TextEncoder) asciiEnc = new root.TextEncoder(); } catch (e) { asciiEnc = null; }
  function rawPublishPacket(topic, str) { // QoS 0 PUBLISH; topic and payload are ASCII (encodeFrame guarantees it)
    var tl = topic.length, pl = str.length, n = 2 + tl + pl, rem = [], i = 0, k, b;
    do { b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 128; rem.push(b); } while (n > 0);
    var buf = new Uint8Array(1 + rem.length + 2 + tl + pl);
    buf[i++] = 0x30;
    for (k = 0; k < rem.length; k++) buf[i++] = rem[k];
    buf[i++] = tl >> 8; buf[i++] = tl & 255;
    for (k = 0; k < tl; k++) buf[i++] = topic.charCodeAt(k) & 255;
    if (asciiEnc && asciiEnc.encodeInto && pl > 64) asciiEnc.encodeInto(str, buf.subarray(i));
    else for (k = 0; k < pl; k++) buf[i++] = str.charCodeAt(k) & 255;
    return buf;
  }

  // fast = a 'fast' (latest-wins) frame: dropped instead of queued when the connection is congested.
  RelayPool.prototype.publish = function (r, topic, str, fast) {
    if (!r || !r.up || !r.client || this.closed) return false;
    var c = r.client, s = rawSocket(c);
    if (s) {
      if (s.bufferedAmount > (fast ? LIMITS.sockFast : LIMITS.sockMax)) return false; // reliable data is resent later
      try { s.send(rawPublishPacket(topic, str)); } catch (e) { return false; }
    } else {
      soon(function () { try { if (r.client === c && r.up) c.publish(topic, str, { qos: 0, retain: false }); } catch (e) { /* ignore */ } });
    }
    r.txBytes += str.length;
    return true;
  };
  RelayPool.prototype._rawControl = function (r, bytes) {
    var s = rawSocket(r.client);
    if (!s) return false;
    try { s.send(new Uint8Array(bytes)); return true; } catch (e) { return false; }
  };

  // Change subscriptions on every connected relay (new code after a collision, new inbox after a rejoin).
  // onEach(relay) runs once the new subscriptions are active on that relay.
  RelayPool.prototype.setTopics = function (topics, onEach) {
    var old = this.topics, removed = [], added = [], self = this;
    old.forEach(function (t) { if (topics.indexOf(t) < 0) removed.push(t); });
    topics.forEach(function (t) { if (old.indexOf(t) < 0) added.push(t); });
    this.topics = topics.slice();
    this.upList().forEach(function (r) {
      var c = r.client;
      soon(function () {
        if (r.client !== c || self.closed) return;
        try { if (removed.length) c.unsubscribe(removed); } catch (e) { /* ignore */ }
        if (!added.length) { if (onEach) onEach(r); return; }
        try {
          c.subscribe(added, { qos: 0 }, function (err) { if (!err && r.client === c && onEach && !self.closed) onEach(r); });
        } catch (e) { /* ignore: relay will be recycled */ }
      });
    });
  };

  // Housekeeping (from Net._tick): retries, attempt timeouts, keep-alive and self-checks.
  // Self-check: a relay that has been quiet gets an echo through our own inbox. Two missing echoes in a
  // row mean the connection is dead even if the socket has not noticed yet (Wi-Fi changes, sleep...).
  // Right after something suspicious (computer woke up, network came back, we lost the host) checkNow()
  // marks every relay as suspect, and then a single missing echo is enough: reconnecting a relay that was
  // in fact fine costs about a second, waiting for a second miss on a dead one costs ten.
  RelayPool.prototype.tick = function (t) {
    var o = this.net.opts, self = this;
    this.list.forEach(function (r) {
      if (self.closed) return;
      if (!r.client) { if (r.retryAt && t >= r.retryAt) self._connect(r); return; }
      if (!r.up) {
        if (t - r.connectStart > self._attemptMs(r)) { r.lastError = 'timed out'; r.hung++; self._drop(r, r.client); }
        return;
      }
      if (r.echoOut && t - r.echoOut.at > o.echoTimeoutMs) {
        r.echoOut = null;
        if (++r.echoMiss >= (r.suspect ? 1 : 2)) { self.net._log('relay ' + r.name + ' stopped answering - reconnecting it'); r.lastError = 'stopped answering'; self._drop(r, r.client); return; }
      }
      if (!r.echoOut && t - r.lastRx > o.echoMs) self._echo(r, t);
      if (t - r.lastPingReq >= 15000) { r.lastPingReq = t; self._rawControl(r, PINGREQ); } // keeps mqtt.js's own keep-alive from firing
    });
  };
  RelayPool.prototype._echo = function (r, t) {
    var n = randId(6);
    r.echoOut = { n: n, at: t };
    this.publish(r, this.net._inbox(), encodeFrame({ v: PROTO, t: 'ec', f: this.net.eid, n: n }));
  };
  RelayPool.prototype.checkNow = function () { var t = now(), self = this; this.upList().forEach(function (r) { r.suspect = true; if (!r.echoOut) self._echo(r, t); }); };
  RelayPool.prototype.resetEchoes = function () { this.list.forEach(function (r) { r.echoOut = null; r.echoMiss = 0; r.lastRx = now(); }); };
  // Something suggests the network is back (online event, tab visible again, computer woke up): try every
  // relay that is down right now, and give up on attempts that were started while the network was out.
  RelayPool.prototype.retryNow = function () {
    var self = this, t = now();
    this.list.forEach(function (r) {
      if (self.closed) return;
      if (r.client && !r.up && t - r.connectStart > 1500) { r.lastError = 'timed out'; self._drop(r, r.client); }
      if (!r.client) { r.failures = Math.min(r.failures, 1); self._connect(r); }
    });
  };
  RelayPool.prototype.upList = function () { var a = []; for (var i = 0; i < this.list.length; i++) if (this.list[i].up) a.push(this.list[i]); return a; };
  RelayPool.prototype.upCount = function () { return this.upList().length; };
  RelayPool.prototype.everUp = function () { for (var i = 0; i < this.list.length; i++) if (this.list[i].everUp) return true; return false; };
  RelayPool.prototype.allFailed = function () { for (var i = 0; i < this.list.length; i++) if (this.list[i].everUp || this.list[i].failures < 1) return false; return true; };
  RelayPool.prototype.settled = function () { for (var i = 0; i < this.list.length; i++) if (!this.list[i].everUp && this.list[i].failures < 1) return false; return true; };

  RelayPool.prototype.close = function () {
    var self = this;
    if (this.closed) return;
    this.closed = true;
    this.list.forEach(function (r) {
      var c = r.client, s = rawSocket(c);
      r.client = null; r.up = false;
      if (!c || c.placeholder) return;
      // Leave cleanly *now* (the page may be unloading): DISCONNECT tells the broker this is a normal
      // goodbye, so it drops our subscriptions (clean session) and does not publish our last will.
      if (s) { try { s.send(new Uint8Array(DISCONNECT)); } catch (e) { s = null; } }
      soon(function () {
        try { if (!s && c.connected && self.topics.length) c.unsubscribe(self.topics); } catch (e) { /* ignore */ }
        try { c.end(!!s); } catch (e) { /* ignore */ } // without the raw path: graceful end() sends DISCONNECT itself
      });
    });
  };

  RelayPool.prototype.info = function () {
    return this.list.map(function (r) {
      return { name: r.name, url: r.url, up: r.up, connectMs: r.connectMs, rtt: r.rtt, error: r.up ? '' : r.lastError, attempts: r.attempts, txBytes: r.txBytes, rxBytes: r.rxBytes };
    });
  };

  /* ====================================================================================
   * 4. Link - everything about the connection to ONE remote endpoint
   *    (host: one Link per guest; guest: one Link to the host)
   *    Reliable stream (seq/ack/retransmit/in-order), fast stream (newest wins), route choice
   *    between relays and the WebRTC link, heartbeats and RTT.
   * ==================================================================================== */

  var DIRECT = { direct: true };       // route marker for the WebRTC link
  var VIA_DIRECT = { direct: true };

  function Link(net, eid, outTopic) {
    this.net = net;
    this.eid = eid;            // remote endpoint id
    this.out = outTopic;       // remote endpoint's inbox topic
    this.peer = null;          // host side: the guest record
    this.dead = false;
    this.lastHeard = now();
    this.goneAt = 0;           // the relays told us (last will) the remote lost its connection
    // reliable, sending (dsrtt/drttvar: how long our data really takes to be acknowledged, see _onAck)
    this.txSeq = 0; this.unacked = {}; this.unackedN = 0; this.queue = []; this.dsrtt = 0; this.drttvar = 0;
    // reliable, receiving
    this.rxNext = 1; this.rxBuf = {}; this.rxBufN = 0; this.rxChunk = null; this.ackPending = false; this.ackTimer = null;
    // fast, receiving
    this.fastMax = {};         // original sender id -> newest fast sequence delivered from it
    this.fastParts = {};       // fast sequence -> chunks of a big fast message being reassembled
    // routes
    this.rs = {};              // relay idx -> { heard, srtt, rttvar, lastPing, gone }
    this.primary = null;
    this.direct = null;        // { conn, fast, open, up, stalled, lastHeard, lastPong, lastPing, srtt, rttvar, startedAt }
    this.lastPong = 0;         // last answer to one of our heartbeats (any route): proves the remote knows us
    this.route = 'relay';
    this.remotePj = null; this.directTries = 0; this.nextDirectAt = 0;
  }

  Link.prototype.rstat = function (r) {
    var s = this.rs[r.idx];
    // loss: smoothed fraction of our heartbeats on this relay that got no answer (0..1); pingN: the
    // heartbeat we are waiting for
    if (!s) s = this.rs[r.idx] = { heard: 0, srtt: 0, rttvar: 0, lastPing: 0, gone: false, loss: 0, pingN: 0 };
    return s;
  };

  Link.prototype.heard = function (via) {
    var t = now();
    this.lastHeard = t; this.goneAt = 0;
    if (via.relay) { var s = this.rstat(via.relay); s.heard = t; s.gone = false; }
    else if (via.direct && this.direct) this.direct.lastHeard = t;
    this.net._linkHeard(this);
  };

  /* ---------- route choice ---------- */
  // Lower is better: round-trip time, plus a penalty for heartbeats lost on this relay (an overloaded or
  // rate-limiting public broker may silently drop a share of messages while its RTT still looks fine),
  // plus a small tie-breaker that prefers relays listed earlier.
  function relayScore(link, r) { var s = link.rs[r.idx]; return (s && s.srtt ? s.srtt : 400) + (s ? s.loss * 1500 : 0) + r.idx * 15; }

  // Working routes ("fresh": WebRTC if healthy, then relays we recently heard this peer on, best first)
  // and spare routes (other connected relays, most recently useful first).
  Link.prototype.routes = function (t) {
    var net = this.net, fresh = [], spare = [], self = this, d = this.direct;
    var ups = net.pool ? net.pool.upList() : [];
    ups.forEach(function (r) {
      var s = self.rs[r.idx];
      if (s && !s.gone && s.heard && t - s.heard < net.opts.relayFreshMs) fresh.push(r); else spare.push(r);
    });
    fresh.sort(function (a, b) { return relayScore(self, a) - relayScore(self, b); });
    // hysteresis: stay on the current main relay unless another one is clearly better
    var cur = this.primary, ci = fresh.indexOf(cur);
    if (ci > 0 && relayScore(this, cur) <= relayScore(this, fresh[0]) * 1.3 + 40) { fresh.splice(ci, 1); fresh.unshift(cur); }
    if (fresh.length) this.primary = fresh[0];
    spare.sort(function (a, b) { var sa = self.rs[a.idx], sb = self.rs[b.idx]; return ((sb && sb.heard) || 0) - ((sa && sa.heard) || 0) || a.idx - b.idx; });
    if (d && d.up && !d.stalled) fresh.unshift(DIRECT);
    return { fresh: fresh, spare: spare };
  };

  // attempt 0 = best route; retransmissions rotate through the working routes and now and then try a
  // spare relay, so a dead route is bypassed on the very next retry.
  Link.prototype.pickRoute = function (attempt, t) {
    var R = this.routes(t), list = R.fresh;
    if (!list.length) list = R.spare;
    else if (attempt >= 2 && attempt % 3 === 2 && R.spare.length) { list = R.spare; attempt = Math.floor(attempt / 3); }
    return list.length ? list[attempt % list.length] : null;
  };

  // Retransmission timeout: from the heartbeat RTT of the route, but never below what acknowledgements of
  // our data have really been taking lately (a busy Chromebook or a burst of big messages can take much
  // longer than a heartbeat; resending too early only doubles the traffic).
  Link.prototype.rto = function (route) {
    var d = this.direct, s, v;
    if (route === DIRECT && d) v = d.srtt ? d.srtt + 4 * d.rttvar + 40 : 400;
    else if (route && route.idx !== undefined) { s = this.rs[route.idx]; v = s && s.srtt ? s.srtt + 4 * s.rttvar + 80 : 1000; }
    else v = 1000;
    if (this.dsrtt) v = Math.max(v, this.dsrtt + 4 * this.drttvar + 30);
    return Math.min(4000, Math.max(route === DIRECT ? 150 : 250, v));
  };

  Link.prototype.rtt = function () {
    var d = this.direct;
    if (this.route === 'direct' && d && d.srtt) return Math.round(d.srtt);
    var r = this.primary, s = r && this.rs[r.idx];
    return s && s.srtt ? Math.round(s.srtt) : null;
  };

  /* ---------- putting frames on the wire ---------- */
  Link.prototype._wire = function (str, route, fast) {
    var self = this, net = this.net;
    net._impair(function () {
      if (self.dead) return;
      if (route === DIRECT) {
        if (self._directSend(str, fast)) return;
        var R = self.routes(now()), r = R.fresh.filter(function (x) { return x !== DIRECT; })[0] || R.spare[0]; // WebRTC hiccup: use a relay instead
        if (r && !(fast && net.opts.noRelay)) net._relaySend(r, self.out, str, fast);
      } else net._relaySend(route, self.out, str, fast);
    });
  };

  Link.prototype._directSend = function (str, fast) {
    var d = this.direct;
    if (!d || !d.open) return false;
    try {
      if (fast && d.fast && d.fast.readyState === 'open') {
        if (d.fast.bufferedAmount < 262144) d.fast.send(str); // congested: drop the fast message
      } else d.conn.send(str);
    } catch (e) { this.closeDirect('send failed'); return false; }
    this.net.stats.txDirect += str.length; this.net.stats.txFrames++;
    return true;
  };

  // Attach any pending acknowledgement to an outgoing frame (saves separate ack frames).
  Link.prototype._ackInto = function (hdr) {
    if (this.rxNext > 1 || this.rxBufN) {
      hdr.a = this.rxNext - 1;
      if (this.rxBufN) hdr.s = this._sackList(); else delete hdr.s;
    } else { delete hdr.a; delete hdr.s; }
    this.ackPending = false;
  };
  Link.prototype._sackList = function () {
    var a = [];
    for (var k in this.rxBuf) a.push(+k);
    a.sort(function (x, y) { return x - y; });
    return a.slice(0, 32);
  };

  // Send a frame on the chosen route. kind: 'data' (reliable), 'fast', 'ack'. Returns the route or null.
  Link.prototype.sendFrame = function (hdr, mj, kind, attempt) {
    if (this.dead) return null;
    var route = this.pickRoute(attempt || 0, now());
    if (!route) return null;
    if ((kind === 'data' || kind === 'fast') && this.net.opts.noRelay && route !== DIRECT) return null; // test option
    hdr.v = PROTO; hdr.f = this.net.eid;
    this._ackInto(hdr);
    this._wire(encodeFrame(hdr, mj), route, kind === 'fast');
    return route;
  };

  // Control frames (ping/pong/goodbye) go out on a specific route.
  Link.prototype.sendRaw = function (hdr, via) {
    if (this.dead) return;
    hdr.v = PROTO; hdr.f = this.net.eid;
    this._ackInto(hdr);
    this._wire(encodeFrame(hdr), via.relay || DIRECT, false);
  };

  /* ---------- sending game data ---------- */
  function buildFrames(type, mj, meta) {
    var k, hdr;
    if (mj.length + 300 <= LIMITS.payload) { hdr = { t: type }; for (k in meta) hdr[k] = meta[k]; return [{ hdr: hdr, mj: mj }]; }
    var pieces = splitPieces(mj, LIMITS.chunkBudget), out = [], i;
    if (pieces.length > LIMITS.chunks) throw hgError('too-big', 'HGNet: message is too big.');
    for (i = 0; i < pieces.length; i++) {
      hdr = { t: type, c: [i, pieces.length], p: pieces[i] };
      if (i === 0) for (k in meta) hdr[k] = meta[k];
      out.push({ hdr: hdr, mj: undefined });
    }
    return out;
  }

  // mj = encoded message JSON; meta = routing fields (to / fr / k); q = forced fast sequence (broadcasts)
  Link.prototype.sendData = function (mj, fast, meta, q) {
    if (this.dead) return false;
    var frames = buildFrames(fast ? 'u' : 'd', mj, meta || {}), i, t = now();
    if (fast) {
      q = q || ++this.net.fastSeq;
      for (i = 0; i < frames.length; i++) { frames[i].hdr.q = q; this.sendFrame(frames[i].hdr, frames[i].mj, 'fast', 0); }
      return true;
    }
    if (this.queue.length + this.unackedN + frames.length > 200000) { this.net._log('send queue overflow - message dropped'); return false; }
    for (i = 0; i < frames.length; i++) {
      var e = { q: ++this.txSeq, hdr: frames[i].hdr, mj: frames[i].mj, tries: 0, sentAt: 0, nextAt: 0, via: null };
      e.hdr.q = e.q;
      this.queue.push(e);
    }
    this.pump(t);
    return true;
  };
  Link.prototype.sendCtrl = function (kind, data) { return this.sendData(encodeMsg(data), false, { k: kind }); };

  Link.prototype.pump = function (t) {
    while (this.queue.length && this.unackedN < LIMITS.txWindow) {
      var e = this.queue.shift();
      this.unacked[e.q] = e; this.unackedN++;
      this._sendEntry(e, t);
    }
  };

  Link.prototype._sendEntry = function (e, t) {
    var route = this.sendFrame(e.hdr, e.mj, 'data', e.tries);
    if (e.tries > 0 && route) this.net.stats.retransmits++;
    e.tries++; e.sentAt = t; e.via = route;
    e.nextAt = route ? t + Math.min(LIMITS.rtoMax, this.rto(route) * Math.pow(2, Math.min(e.tries - 1, 4))) : t + 400;
  };

  // Retransmit soon everything last sent on a route that just went bad.
  Link.prototype._resendVia = function (route) {
    var t = now();
    each(this.unacked, function (e) { if (e.via === route) e.nextAt = t; });
  };

  /* ---------- receiving ---------- */
  Link.prototype.onFrame = function (fr, via) {
    if (this.dead) return;
    this.heard(via);
    if (this.dead) return; // a game handler may have closed us
    if (fr.a !== undefined) this._onAck(fr.a, fr.s);
    switch (fr.t) {
      case 'pi': this.sendRaw({ t: 'po', n: fr.n }, via); break;
      case 'po': this._onPong(fr, via); break;
      case 'd': this._onData(fr); break;
      case 'u': this._onFast(fr); break;
      default: break; // 'a' was handled above
    }
  };

  Link.prototype._onPong = function (fr, via) {
    if (!isNum(fr.n)) return;
    var rtt = now() - fr.n, s;
    if (rtt < 0 || rtt > 60000) return;
    if (via.relay) s = this.rstat(via.relay); else s = this.direct;
    if (!s) return;
    this.lastPong = now();
    if (via.direct) s.lastPong = this.lastPong;
    if (via.relay && s.pingN && fr.n === s.pingN) { s.loss *= 0.7; s.pingN = 0; } // answered: loss estimate decays
    if (!s.srtt) { s.srtt = rtt; s.rttvar = rtt / 2; }
    else { s.rttvar = 0.75 * s.rttvar + 0.25 * Math.abs(s.srtt - rtt); s.srtt = 0.875 * s.srtt + 0.125 * rtt; }
    if (via.direct && (!s.up || s.stalled)) { // WebRTC proved itself: move traffic onto it
      s.up = true; s.stalled = false;
      this._routeCheck();
      var t = now();
      each(this.unacked, function (e) { e.nextAt = Math.min(e.nextAt, t); });
    }
  };

  Link.prototype._onAck = function (a, s) {
    if (!isInt(a, 0, this.txSeq)) return;
    var t = now(), changed = false, self = this, maxS = 0, k, sample = null;
    // one RTT sample per ack: the newest acknowledged message that was sent only once (Karn's rule)
    function done(e) { if (e.tries === 1 && (!sample || e.q > sample.q)) sample = e; }
    for (k in this.unacked) if (+k <= a) { done(this.unacked[k]); delete this.unacked[k]; this.unackedN--; changed = true; }
    if (isArr(s) && s.length <= 64) {
      s.forEach(function (x) {
        if (!isInt(x, 1, self.txSeq)) return;
        if (x > maxS) maxS = x;
        if (self.unacked[x]) { done(self.unacked[x]); delete self.unacked[x]; self.unackedN--; changed = true; }
      });
      if (maxS) { // holes below a selectively-acked message were probably lost: resend early
        var rtt = Math.max(this.rtt() || 300, this.dsrtt);
        each(this.unacked, function (e) { if (e.q < maxS && e.tries < 8 && t - e.sentAt > rtt * 1.2 + 30) self._sendEntry(e, t); });
      }
    }
    if (sample) {
      var m = Math.min(10000, t - sample.sentAt);
      if (!this.dsrtt) { this.dsrtt = m; this.drttvar = m / 2; }
      else { this.drttvar = 0.75 * this.drttvar + 0.25 * Math.abs(this.dsrtt - m); this.dsrtt = 0.875 * this.dsrtt + 0.125 * m; }
    }
    if (changed) this.pump(t);
  };

  // A reliable frame must be well-formed BEFORE it may use up a sequence number.
  function validData(fr) {
    if (fr.c !== undefined ? !validChunk(fr) : !('m' in fr)) return false;
    if (fr.k !== undefined && !isStr(fr.k, 8)) return false;
    if (fr.to !== undefined && fr.to !== '*' && toId(fr.to) === null) return false;
    if (fr.fr !== undefined && toId(fr.fr) === null) return false;
    return true;
  }

  Link.prototype._onData = function (fr) {
    var q = fr.q;
    if (!isInt(q, 1, 1e12)) return;
    if (!validData(fr)) { this.net.stats.malformed++; return; }
    if (q < this.rxNext || this.rxBuf[q]) { this.ackPending = true; this._flushAck(); return; } // duplicate: re-ack now
    if (q - this.rxNext >= LIMITS.rxWindow) return;
    this.rxBuf[q] = fr; this.rxBufN++;
    while (this.rxBuf[this.rxNext]) {
      var f = this.rxBuf[this.rxNext];
      delete this.rxBuf[this.rxNext]; this.rxBufN--; this.rxNext++;
      this._deliverReliable(f);
      if (this.dead) return;
    }
    this._scheduleAck();
  };

  function validChunk(fr) { return isArr(fr.c) && fr.c.length === 2 && isInt(fr.c[1], 2, LIMITS.chunks) && isInt(fr.c[0], 0, fr.c[1] - 1) && typeof fr.p === 'string'; }

  Link.prototype._deliverReliable = function (f) {
    if (f.c === undefined) { this.net._onLinkMsg(this, f, f.m, false); return; }
    if (!validChunk(f)) { this.rxChunk = null; this.net.stats.malformed++; return; }
    var i = f.c[0], n = f.c[1];
    if (i === 0) this.rxChunk = { n: n, parts: [], size: 0, meta: f };
    var ch = this.rxChunk;
    if (!ch || ch.n !== n || ch.parts.length !== i) { this.rxChunk = null; this.net.stats.malformed++; return; }
    ch.parts.push(f.p); ch.size += f.p.length;
    if (ch.size > LIMITS.message) { this.rxChunk = null; this.net.stats.malformed++; return; }
    if (ch.parts.length < n) return;
    this.rxChunk = null;
    var msg;
    try { msg = JSON.parse(ch.parts.join('')); } catch (e) { this.net.stats.malformed++; return; }
    this.net._onLinkMsg(this, ch.meta, msg, false);
  };

  // Fast messages: newest wins, per original sender. The host numbers every fast message it sends from
  // one counter, including guest messages it forwards, so "newer" is only compared between messages from
  // the same original sender - otherwise a forwarded position that overtook a host snapshot on another
  // route would make that snapshot look stale.
  // A number FAR below the newest one is not a late straggler (those are at most a few hundred behind) but
  // a restarted counter or a bogus huge number someone injected; accepting it keeps one bad frame from
  // silencing a sender's fast stream for good.
  function fastOrigin(fr) { return fr.fr === undefined ? 0 : toId(fr.fr); }
  Link.prototype._fastFresh = function (fr) {
    var o = fastOrigin(fr), max;
    if (o === null) return false;
    max = this.fastMax[o] || 0;
    return fr.q > max || max - fr.q > 50000;
  };
  Link.prototype._onFast = function (fr) {
    var q = fr.q, net = this.net;
    if (!isInt(q, 1, 1e15)) return;
    if (fr.x !== undefined && (!isArr(fr.x) || fr.x.indexOf(net.id) >= 0)) return; // broadcast that excludes us
    if (fr.c === undefined) {
      if (!this._fastFresh(fr)) return; // stale or duplicate
      this.fastMax[fastOrigin(fr)] = q;
      net._onLinkMsg(this, fr, fr.m, true);
      return;
    }
    if (!validChunk(fr)) { net.stats.malformed++; return; }
    var g = this.fastParts[q], keys;
    if (!g) {
      g = this.fastParts[q] = { n: fr.c[1], got: 0, parts: [], size: 0, meta: null };
      keys = Object.keys(this.fastParts).map(Number).sort(function (a, b) { return a - b; });
      while (keys.length > 3) delete this.fastParts[keys.shift()]; // keep only a few partial snapshots
    }
    if (g.n !== fr.c[1] || g.parts[fr.c[0]] !== undefined) return;
    g.parts[fr.c[0]] = fr.p; g.got++; g.size += fr.p.length;
    if (fr.c[0] === 0) g.meta = fr;
    if (g.size > LIMITS.message) { delete this.fastParts[q]; return; }
    if (g.got < g.n) return;
    delete this.fastParts[q];
    var meta = g.meta || fr; // routing fields travel in chunk 0
    if (!this._fastFresh({ q: q, fr: meta.fr })) return; // a newer message from the same sender already arrived
    this.fastMax[fastOrigin(meta)] = q;
    var msg;
    try { msg = JSON.parse(g.parts.join('')); } catch (e) { net.stats.malformed++; return; }
    net._onLinkMsg(this, meta, msg, true);
  };

  Link.prototype._scheduleAck = function () {
    var self = this;
    this.ackPending = true;
    if (pageHidden()) { this._flushAck(); return; } // timers are throttled in hidden tabs: ack right away
    if (!this.ackTimer) this.ackTimer = setTimeout(function () { self.ackTimer = null; self._flushAck(); }, 15);
  };
  Link.prototype._flushAck = function () {
    if (!this.ackPending || this.dead) return;
    this.sendFrame({ t: 'a' }, undefined, 'ack', 0);
  };

  /* ---------- periodic work ---------- */
  Link.prototype.tick = function (t) {
    if (this.dead) return;
    var self = this;
    each(this.unacked, function (e) { if (e.nextAt <= t && !self.dead) self._sendEntry(e, t); });
    this._pings(t);
    this._directHealth(t);
    if (this.ackPending) this._flushAck();
  };

  Link.prototype._pings = function (t) {
    var net = this.net, ups = net.pool ? net.pool.upList() : [], i, r, s, every, d = this.direct;
    this.routes(t); // refresh this.primary
    for (i = 0; i < ups.length; i++) {
      r = ups[i]; s = this.rstat(r);
      // The guest pings on every relay so the host learns all the ways to reach it; the host answers
      // on the relays it has actually heard this guest on.
      if (net.isHost && !(s.heard && t - s.heard < 30000)) continue;
      every = r === this.primary ? net.opts.pingRelayMs : net.opts.pingSpareMs;
      if (t - s.lastPing >= every) {
        // the previous heartbeat on this relay was never answered: count it as lost
        // (only while the page is visible - a frozen or heavily throttled tab can't judge)
        if (s.pingN && !pageHidden() && t - s.lastPing < every * 3) s.loss = s.loss * 0.7 + 0.3;
        s.lastPing = t; s.pingN = round1(t);
        this.sendRaw({ t: 'pi', n: s.pingN }, { relay: r });
      }
    }
    if (d && d.open && t - d.lastPing >= net.opts.pingDirectMs) { d.lastPing = t; this.sendRaw({ t: 'pi', n: round1(t) }, VIA_DIRECT); }
  };

  // The WebRTC link is judged by answers to OUR heartbeats on it, not by whatever arrives on it: when only
  // one direction of a data channel dies, the remote side's pings keep arriving here although nothing we
  // send gets through. Each side checks its own sending direction, so both notice within directStallMs.
  Link.prototype._directHealth = function (t) {
    var d = this.direct, o = this.net.opts;
    if (!d) return;
    if (d.up && !d.stalled && t - d.lastPong > o.directStallMs) {
      d.stalled = true;
      this.net._log('direct link to ' + this.eid + ' stalled - using the relay');
      this._routeCheck();
      this._resendVia(DIRECT);
    }
    if (!d.up && t - d.startedAt > o.directTimeoutMs) this.closeDirect('timed out');
    else if (d.stalled && t - d.lastPong > 30000) this.closeDirect('dead');
  };

  Link.prototype._routeCheck = function () {
    var d = this.direct, r = d && d.up && !d.stalled ? 'direct' : 'relay';
    if (r !== this.route) { this.route = r; this.net._onRoute(this, r); }
  };

  // A relay connection of ours went down.
  Link.prototype.relayDown = function (r) {
    var s = this.rs[r.idx];
    if (s) { s.heard = 0; s.pingN = 0; }
    if (this.primary === r) this.primary = null;
    this._resendVia(r);
  };
  // The remote side's connection to relay r died (its MQTT last will arrived).
  Link.prototype.relayGone = function (r) {
    var s = this.rstat(r), t = now();
    s.gone = true; s.heard = 0;
    if (this.primary === r) this.primary = null;
    this._resendVia(r);
    if (!this.routes(t).fresh.length) this.goneAt = t;
  };

  Link.prototype.closeDirect = function (why) {
    var d = this.direct;
    if (!d) return;
    this.direct = null;
    try { if (d.fast) d.fast.close(); } catch (e) { /* ignore */ }
    try { d.conn.close(); } catch (e) { /* ignore */ }
    this.net._log('direct link to ' + this.eid + ' closed (' + why + ')');
    this._routeCheck();
    this._resendVia(DIRECT);
    this.net._directClosed(this, d);
  };

  Link.prototype.backlog = function () { return this.queue.length + this.unackedN; };
  // The remote is back after a silence: retransmit what is outstanding now instead of waiting out the
  // backed-off retransmission timers (up to 8 s).
  Link.prototype.resendAll = function () {
    var t = now();
    each(this.unacked, function (e) { e.tries = 0; e.nextAt = Math.min(e.nextAt, t); }); // tries 0: best route first
  };

  Link.prototype.destroy = function () {
    if (this.dead) return;
    this.closeDirect('link closed');
    this.dead = true;
    clearTimeout(this.ackTimer);
    this.unacked = {}; this.unackedN = 0; this.queue = []; this.rxBuf = {}; this.fastParts = {};
  };

  /* ====================================================================================
   * 5. Direct - the optional WebRTC speed-up through PeerJS
   * ==================================================================================== */

  function Direct(net) { this.net = net; this.peer = null; this.id = null; this.state = 'idle'; this.fails = 0; this.retry = null; }

  Direct.prototype.enabled = function () {
    var o = this.net.opts;
    return !o.forceRelay && o.peer !== false && typeof root.RTCPeerConnection === 'function';
  };

  Direct.prototype.start = function () {
    var self = this, net = this.net;
    if (!this.enabled() || this.state !== 'idle' || net.closed) return;
    this.state = 'loading';
    loadPeerJS(net.opts).then(function (Peer) {
      if (net.closed || self.state !== 'loading') return;
      self._open(Peer);
    }, function () {
      self._fail('PeerJS could not be loaded');
    });
  };

  Direct.prototype._open = function (Peer) {
    var self = this, net = this.net, o = net.opts, po = o.peer || {}, p;
    var popts = { debug: 0, config: { iceServers: o.iceServers } };
    if (po.host) popts.host = po.host;
    if (po.port) popts.port = po.port;
    if (po.path) popts.path = po.path;
    if (po.secure !== undefined) popts.secure = !!po.secure;
    if (po.key) popts.key = po.key;
    // PeerJS ids allow only letters/digits with single '-' or '_' between them, so keep the game part plain
    try { p = new Peer('hgn-' + (net.game.replace(/[^a-z0-9]/g, '') || 'game') + '-' + randId(12), popts); } catch (e) { this._fail('PeerJS error: ' + (e && e.message)); return; }
    this.peer = p; this.state = 'connecting';
    var timer = setTimeout(function () { if (self.peer === p && self.state === 'connecting') self._fail('signalling server timed out'); }, 15000);
    p.on('open', function (id) {
      if (self.peer !== p) return;
      clearTimeout(timer);
      self.state = 'open'; self.id = id; self.fails = 0;
      net._log('WebRTC signalling ready');
      net._onDirectReady(id);
    });
    p.on('connection', function (conn) { if (self.peer === p) net._onDirectIncoming(conn); else try { conn.close(); } catch (e) { /* ignore */ } });
    p.on('disconnected', function () { // lost the signalling server: existing links keep working, try to get it back
      if (self.peer !== p || net.closed) return;
      setTimeout(function () { if (self.peer === p && !p.destroyed && p.disconnected) { try { p.reconnect(); } catch (e) { /* ignore */ } } }, 3000);
    });
    p.on('error', function (e) {
      if (self.peer !== p) return;
      var type = e && e.type;
      net._log('WebRTC: ' + (type || e));
      if (type === 'peer-unavailable') { net._onDirectUnavailable(e); return; }
      if (self.state === 'connecting') { clearTimeout(timer); self._fail(type || 'error'); }
    });
  };

  // Signalling failed: stay on the relay, try again a couple of times later (networks change).
  Direct.prototype._fail = function (why) {
    var self = this;
    this.net._log('WebRTC unavailable: ' + why);
    if (this.peer) { try { this.peer.destroy(); } catch (e) { /* ignore */ } }
    this.peer = null; this.id = null; this.state = 'failed'; this.fails++;
    if (this.fails <= 2 && !this.net.closed) this.retry = setTimeout(function () { if (self.state === 'failed') { self.state = 'idle'; self.start(); } }, 30000 * this.fails);
  };

  Direct.prototype.close = function () {
    clearTimeout(this.retry);
    if (this.peer) { try { this.peer.destroy(); } catch (e) { /* ignore */ } }
    this.peer = null; this.id = null; this.state = 'closed';
  };

  /* ====================================================================================
   * 6. Net - one multiplayer session (either hosting or joined to a host)
   * ==================================================================================== */

  function Net(opts) {
    this._ev = {};
    this.opts = buildOptions(opts);
    this.game = this.opts.game;
    this.eid = randId(12);        // endpoint id on the wire (changes when a guest rejoins)
    this.id = null;               // player id: host 0, guests 1..999
    this.isHost = false;
    this.code = null;
    this.state = 'idle';          // idle | connecting | hosting | joining | joined | reconnecting | closed
    this.closed = false;
    this.hostInfo = null;
    this.pool = null;
    this.direct = new Direct(this);
    this.links = {};              // eid -> Link
    this.peerRecs = {};           // id -> player record (host: guests; guest: other guests)
    this.fastSeq = 0;
    this.stats = { txFrames: 0, rxFrames: 0, txRelay: 0, rxRelay: 0, txDirect: 0, rxDirect: 0, retransmits: 0, malformed: 0, impairDropped: 0 };
    this._logs = [];
    this._stopTick = null;
    this._lastTick = now();
    this._lastWall = Date.now();  // wall clock, to notice the computer sleeping (see _tick)
    this._lastRxAt = 0;
    var self = this;
    this._onPageHide = function () { self.close(); };
    this._onOnline = function () { if (self.pool && !self.closed) { self.pool.retryNow(); self.pool.checkNow(); } };
    this._onVisible = function () { if (!pageHidden() && self.pool && !self.closed) { self.pool.retryNow(); self.pool.checkNow(); self._tick(); } };
    if (this.opts.noRelay && this.opts.forceRelay) this._log('warning: noRelay + forceRelay means game data has no route at all');
  }
  Net.prototype = new Emitter();
  Net.prototype.constructor = Net;

  /* ---------- logging, status, test impairment ---------- */
  Net.prototype._log = function (text) {
    var line = (this.isHost ? 'host' : 'guest') + ' ' + text;
    this._logs.push(Math.round(now()) + ' ' + line);
    if (this._logs.length > 300) this._logs.shift();
    var l = this.opts.log;
    if (l === true && root.console) root.console.log('[HGNet] ' + line);
    else if (typeof l === 'function') { try { l(line); } catch (e) { /* ignore */ } }
  };
  Net.prototype._status = function (text) { this.statusText = text; this._log('status: ' + text); this.emit('status', text); };

  // Artificial packet loss / latency for testing (options dropRate, latency, jitter).
  Net.prototype._impair = function (fn) {
    var o = this.opts;
    if (o.dropRate > 0 && Math.random() < o.dropRate) { this.stats.impairDropped++; return; }
    if (o.latency > 0 || o.jitter > 0) { setTimeout(fn, o.latency + Math.random() * o.jitter); return; }
    fn();
  };
  Net.prototype.setImpairment = function (o) {
    o = o || {};
    if (o.dropRate !== undefined) this.opts.dropRate = clampNum(o.dropRate, 0, 1, 0);
    if (o.latency !== undefined) this.opts.latency = clampNum(o.latency, 0, 20000, 0);
    if (o.jitter !== undefined) this.opts.jitter = clampNum(o.jitter, 0, 20000, 0);
  };

  /* ---------- topics ---------- */
  Net.prototype._base = function () { return TOPIC_ROOT + '/' + this.game + '/' + this.code + '/'; };
  Net.prototype._inbox = function () { return this._base() + 'g/' + this.eid; };
  Net.prototype._relaySend = function (r, topic, str, fast) {
    if (this.pool && this.pool.publish(r, topic, str, fast)) { this.stats.txRelay += str.length; this.stats.txFrames++; return true; }
    return false;
  };
  Net.prototype._publishRaw = function (r, topic, hdr) { // frames sent before a Link exists
    var self = this;
    hdr.v = PROTO; hdr.f = this.eid;
    var str = encodeFrame(hdr);
    this._impair(function () { self._relaySend(r, topic, str); });
  };

  /* ---------- starting the relays ---------- */
  Net.prototype._startPool = function (topics, will) {
    var self = this;
    this.pool = new RelayPool(this);
    this._stopTick = every(this.opts.tickMs, function () { self._tick(); });
    if (root.addEventListener) {
      root.addEventListener('pagehide', this._onPageHide);
      root.addEventListener('online', this._onOnline);
    }
    if (root.document && root.document.addEventListener) root.document.addEventListener('visibilitychange', this._onVisible);
    if (!this.opts.relays.length) { this._log('no relays configured'); return; }
    loadMqtt(this.opts).then(function (lib) {
      if (self.closed) return;
      self.pool.start(lib, topics, will);
    }, function () {
      self._fail('blocked', "Couldn't load the online-play code - your network may be blocking cdn.jsdelivr.net. Try another network.");
    });
  };

  Net.prototype._relayCountText = function () {
    var n = this.pool ? this.pool.upCount() : 0, m = this.opts.relays.length;
    return n + ' of ' + m + ' game server' + (m === 1 ? '' : 's');
  };

  Net.prototype._onRelayUp = function (r) {
    var self = this, t = now();
    if (this.state === 'connecting' && this.isHost) {
      this._status('Connected to ' + this._relayCountText() + '...');
      if (this._probe) this._sendProbe(r);
    } else if (this.state === 'joining') {
      this._status('Looking for game ' + this.code + '...');
      this._sendHello(r, false);
      if (!this._joinReq.firstHello) this._joinReq.firstHello = t;
    } else if (this._rejoin) {
      this._sendHello(r, true);
    } else if (this.state === 'hosting') {
      if (this._offlineAt) {
        // We are back after losing every relay. That silence was OUR outage, not the guests': credit it
        // to them, so nobody is dropped (or loses a rejoin slot) because the host's Wi-Fi went away.
        var gap = t - this._offlineAt;
        this._offlineAt = 0;
        this._log('back online after ' + Math.round(gap / 1000) + ' s without any game server');
        each(this.links, function (L) { L.lastHeard = Math.min(t, L.lastHeard + gap); });
        each(this.tombs, function (tb) { tb.until += gap; });
      }
      this._status('Room ' + this.code + ' is open on ' + this._relayCountText());
    }
    // ping the peers on the new relay right away so routes are learned quickly
    each(this.links, function (L) { var s = L.rstat(r); s.lastPing = 0; s.gone = false; });
    if (!this.isHost && this.hostLink) { this.hostLink.rstat(r).lastPing = 0; }
    if (this.state === 'reconnecting' || this.state === 'joined') self.hostLink && self.hostLink._pings(t);
  };
  Net.prototype._onRelayDown = function (r) {
    each(this.links, function (L) { L.relayDown(r); });
    if (this.hostLink) this.hostLink.relayDown(r);
    if (this.isHost && this.state === 'hosting' && !this.pool.upCount() && !this._offlineAt) {
      this._offlineAt = now(); // see _onRelayUp and _hostTick
      this._status('Lost the connection to the game servers - reconnecting...');
    }
  };
  Net.prototype._onRelayFailed = function () { /* deadlines are checked in _tick */ };

  /* ---------- incoming frames ---------- */
  Net.prototype._onRelayFrame = function (r, topic, fr, size) {
    if (this.closed || fr.f === this.eid) return; // our own frame (e.g. our probe on the host inbox)
    this.stats.rxRelay += size; this.stats.rxFrames++;
    this._lastRxAt = now();
    var via = { relay: r, topic: topic };
    if (this.isHost) this._hostFrame(fr, via); else this._guestFrame(fr, via);
  };

  Net.prototype._onDirectData = function (link, data) {
    this._tickIfLate(true);
    if (this.closed || link.dead) return;
    if (typeof data !== 'string') { try { data = decodeUtf8(data); } catch (e) { return; } }
    var fr = parseFrame(data);
    if (!fr || fr.f !== link.eid) { this.stats.malformed++; return; }
    this.stats.rxDirect += data.length; this.stats.rxFrames++;
    this._lastRxAt = now();
    if (!this.isHost && fr.t === 'by') { this._guestFrame(fr, VIA_DIRECT); return; }
    if (this.isHost && fr.t === 'by') { this._hostFrame(fr, VIA_DIRECT); return; }
    if (this.isHost) link.gotData = true;
    link.onFrame(fr, VIA_DIRECT);
    this._tickIfLate(false);
  };

  // Game message (or control message) that came out of a Link's reliable or fast stream.
  Net.prototype._onLinkMsg = function (link, meta, msg, fast) {
    if (this.closed) return;
    if (msg === undefined) msg = null;
    if (meta.k !== undefined) { if (!fast && isStr(meta.k, 8)) this._onCtrl(link, meta.k, msg); return; }
    if (this.isHost) {
      var rec = link.peer, to = meta.to;
      if (!rec) return;
      if (to === undefined || to === 0) { this.emit('message', rec.pub, msg, { fast: fast, to: 'host' }); return; }
      if (to === '*') {
        if (this.opts.guestToGuest) this._hostDeliver('all', encodeMsg(msg), fast, rec.id, [rec.id]);
        this.emit('message', rec.pub, msg, { fast: fast, to: 'all' });
        return;
      }
      to = toId(to);
      if (to !== null && this.opts.guestToGuest && this.peerRecs[to] && to !== rec.id) this._hostDeliver(to, encodeMsg(msg), fast, rec.id);
      return;
    }
    var from = meta.fr, pub;
    if (from === undefined || from === 0) pub = this.hostPub;
    else if (toId(from) !== null) pub = this.peerRecs[from] ? this.peerRecs[from].pub : makePub(from, 'Player ' + from, null, false);
    if (pub) this.emit('message', pub, msg, { fast: fast });
  };

  /* ====================================================================================
   * 6a. Hosting
   * ==================================================================================== */

  Net.prototype.host = function (hopts) {
    var self = this;
    if (this.state !== 'idle') return Promise.reject(hgError('busy', 'This HGNet connection is already in use - make a new one with HGNet.create().'));
    hopts = hopts || {};
    var info = hopts.info === undefined ? null : hopts.info;
    if (jsonSize(info) > LIMITS.info) return Promise.reject(hgError('too-big', 'HGNet: room info must be under 4 KB.'));
    this.isHost = true; this.id = 0; this.state = 'connecting';
    this.room = {
      name: cleanName(hopts.name, 'Host'),
      maxPlayers: Math.round(clampNum(hopts.maxPlayers, 2, 64, 8)),
      info: info,
      accept: typeof hopts.accept === 'function' ? hopts.accept : null
    };
    this.tombs = {}; this._pending = {}; this._nkAt = {}; this._gone = {}; this._rosterDirty = false; this._offlineAt = 0;
    this._roomKey = randId(12); // proves a room-wide goodbye really comes from us (see _sayBye)
    this.hostInfo = { name: this.room.name, info: info, maxPlayers: this.room.maxPlayers };
    this._hostStart = now();
    this._codeTries = 0;
    var p = new Promise(function (resolve, reject) { self._hostP = { resolve: resolve, reject: reject }; });
    this._newCode(hopts.code && /^\d{6}$/.test(String(hopts.code)) ? String(hopts.code) : null);
    this._status('Connecting to game servers...');
    this._startPool(this._hostTopics(), this._hostWill());
    return p;
  };
  Net.prototype._hostTopics = function () { return [this._base() + 'h', this._inbox()]; };
  // MQTT last will: if our connection to a relay dies, that relay tells the room's guests at once.
  Net.prototype._hostWill = function () { return { topic: this._base() + 'b', payload: encodeFrame({ v: PROTO, t: 'gn', f: this.eid }) }; };

  // Pick a code and make sure nobody else is serving it: we publish a probe on the code's host inbox on
  // every relay and listen for an answer from an existing host.
  Net.prototype._newCode = function (wanted) {
    var self = this;
    this._codeTries++;
    this.code = wanted || randCode();
    this._probe = { nonce: randId(10), firstAt: 0 };
    this._log('trying code ' + this.code);
    if (this.pool) this.pool.will = this._hostWill(); // relay connections made from now on
    if (this.pool && this.pool.lib) this.pool.setTopics(this._hostTopics(), function (r) { self._sendProbe(r); });
  };
  Net.prototype._sendProbe = function (r) {
    if (!this._probe) return;
    if (!this._probe.firstAt) this._probe.firstAt = now();
    this._publishRaw(r, this._base() + 'h', { t: 'pr', n: this._probe.nonce });
  };
  Net.prototype._codeTaken = function () {
    this._log('code ' + this.code + ' is already in use');
    if (this._codeTries >= 10) { this._fail('busy', 'Could not find a free game code - please try again.'); return; }
    this._newCode(null);
  };

  Net.prototype._serve = function () {
    this._probe = null;
    this.state = 'hosting';
    this._status('Room ' + this.code + ' is open on ' + this._relayCountText());
    if (this._hostP) { var p = this._hostP; this._hostP = null; p.resolve({ code: this.code }); }
    this.direct.start();
  };

  Net.prototype._hostFrame = function (fr, via) {
    var link;
    switch (fr.t) {
      case 'pr': // someone checks whether our code is free
        if (this.state === 'hosting') { if (via.relay) this._publishRaw(via.relay, this._base() + 'g/' + fr.f, { t: 'tk', n: fr.n }); }
        else if (this._probe && isStr(fr.n, 12) && fr.n < this._probe.nonce) this._codeTaken(); // two hosts picked the same code at once: lower nonce keeps it
        return;
      case 'tk':
        if (this._probe && fr.n === this._probe.nonce) this._codeTaken();
        return;
      case 'he': this._onHello(fr, via); return;
      case 'gn': link = this.links[fr.f]; if (link && via.relay) link.relayGone(via.relay); return;
      case 'by':
        link = this.links[fr.f];
        if (link && link.peer) {
          // Once a guest has its welcome, its goodbye must carry its secret key: anybody watching the relay
          // can see a guest's endpoint id, and a forged goodbye must not throw the player out.
          if (link.peer.keyed && link.gotData && fr.k !== link.peer.key) { this.stats.malformed++; return; }
          this._removePeer(link.peer, 'left', true);
        } else { // left while accept() was deciding, or its goodbye overtook its join request
          if (this._pending[fr.f]) { this._pending[fr.f].cancelled = true; delete this._pending[fr.f]; }
          this._markGone(fr.f);
        }
        return;
      default:
        link = this.links[fr.f];
        if (link) { link.gotData = true; link.onFrame(fr, via); return; }
        if ((fr.t === 'pi' || fr.t === 'd' || fr.t === 'u' || fr.t === 'a') && via.relay && this.state === 'hosting') this._notKnown(fr.f, via.relay);
    }
  };

  // Traffic from a guest we don't know (we dropped it, or it is left over from before a rejoin): tell it
  // so it can rejoin with its token. Rate-limited so spoofed traffic can't make us flood.
  Net.prototype._notKnown = function (eid, r) {
    var t = now(), self = this;
    if (this._nkAt[eid] && t - this._nkAt[eid] < 1000) return;
    if (Object.keys(this._nkAt).length > 200) each(this._nkAt, function (v, k) { if (t - v > 5000) delete self._nkAt[k]; });
    if (Object.keys(this._nkAt).length > 200) return;
    this._nkAt[eid] = t;
    this._publishRaw(r, this._base() + 'g/' + eid, { t: 'nk' });
  };

  Net.prototype._guestCount = function () { return Object.keys(this.peerRecs).length; };
  // Endpoints that have left: their join requests are ignored for 60 s (see _onHello). Bounded, because
  // anybody can send goodbyes from made-up endpoint ids.
  Net.prototype._markGone = function (eid) {
    var t = now(), self = this;
    if (Object.keys(this._gone).length >= 500) each(this._gone, function (at, k) { if (t - at > 10000) delete self._gone[k]; });
    if (Object.keys(this._gone).length < 1000) this._gone[eid] = t;
  };
  // A link counts as alive if we heard from it in the last 3 s (both sides ping every 2 s) and its relays
  // have not reported its connection lost.
  Net.prototype._linkAlive = function (L, t) { return !!L && !L.dead && !L.goneAt && t - L.lastHeard < 3000; };
  Net.prototype._peerByToken = function (tok) { var found = null; each(this.peerRecs, function (p) { if (p.token === tok) found = p; }); return found; };
  Net.prototype._freeId = function () {
    var used = {}, id;
    each(this.peerRecs, function (p) { used[p.id] = true; });
    each(this.tombs, function (tb) { used[tb.id] = true; });
    for (id = 1; id <= LIMITS.maxId; id++) if (!used[id]) return id;
    return null;
  };

  Net.prototype._onHello = function (fr, via) {
    var self = this, t = now(), eid = fr.f;
    if (this.state !== 'hosting' || !via.relay) return;
    // a join request with wrongly-typed fields is junk, not a player
    if ((fr.n !== undefined && !isStr(fr.n, 64)) || (fr.tk !== undefined && !(isStr(fr.tk, 40) && /^[a-z0-9]{8,40}$/.test(fr.tk)))) { this.stats.malformed++; return; }
    var info = fr.i === undefined ? null : fr.i;
    if (jsonSize(info) > LIMITS.info) { this.stats.malformed++; return; }
    var name = cleanName(fr.n, 'Player');
    var tok = fr.tk || null;
    var link = this.links[eid];
    // A late copy of the join request of a player that has already left again (it came through a slower
    // relay) must not bring a second, phantom player into the room.
    if (this._gone[eid] && t - this._gone[eid] < 60000) return;
    if (link && link.peer) { link.heard(via); link.peer.keyed = !!fr.kv; this._sendWelcome(link.peer, via.relay); return; } // repeat hello: repeat welcome
    if (this._pending[eid]) { this._publishRaw(via.relay, this._base() + 'g/' + eid, { t: 'wt' }); return; }
    var full = this._guestCount() >= this.room.maxPlayers - 1;
    var fullText = 'That game is full (' + this.room.maxPlayers + '/' + this.room.maxPlayers + ' players).';
    if (tok) { // a player coming back (network blip, page reload): same id, no questions asked
      var rec = this._peerByToken(tok), tomb = this.tombs[tok];
      var expired = 'You were away too long and lost your place - join again with the code.';
      if (rec && !fr.rj && this._linkAlive(rec.link, t)) {
        // A fresh join with the token of a player who is still connected and answering: a second copy of
        // the page (a duplicated tab copies sessionStorage, token included). It must not take over that
        // player's slot, so it joins as a new player (and gets a token of its own).
        this._log('token of #' + rec.id + ' is in use by a live connection');
      } else if (rec) { rec.keyed = !!fr.kv; this._replaceLink(rec, eid, via); return; } // same player, new connection
      else if (tomb && tomb.until > t) {
        if (full) { this._deny(eid, via.relay, 'full', fullText); return; }
        delete this.tombs[tok];
        this._admit(eid, via, { id: tomb.id, token: tok, key: tomb.key, name: name, info: info, rejoin: true, keyed: !!fr.kv });
        return;
      } else if (fr.rj) {
        // An automatic rejoin, but we no longer hold that player's slot: say so plainly rather than
        // quietly giving them a brand-new id the game knows nothing about.
        this._deny(eid, via.relay, 'expired', expired);
        return;
      }
    }
    if (full) { this._deny(eid, via.relay, 'full', fullText); return; }
    var accept = this.room.accept;
    if (!accept) { this._admit(eid, via, { name: name, info: info, keyed: !!fr.kv }); return; }
    // let the game decide (e.g. "game already started"); it may answer later with a Promise
    var pend = this._pending[eid] = { at: t, cancelled: false };
    this._publishRaw(via.relay, this._base() + 'g/' + eid, { t: 'wt' });
    var decided = false;
    var decide = function (v) {
      if (decided) return;
      decided = true;
      if (self._pending[eid] === pend) delete self._pending[eid];
      if (pend.cancelled || self.closed || self.state !== 'hosting' || self.links[eid]) return; // guest gave up meanwhile
      if (v === true || v === undefined || v === null) {
        if (self._guestCount() >= self.room.maxPlayers - 1) self._deny(eid, via.relay, 'full', fullText);
        else self._admit(eid, via, { name: name, info: info, keyed: !!fr.kv });
      } else self._deny(eid, via.relay, 'refused', typeof v === 'string' && v ? v.slice(0, 200) : "The host didn't let you join this game.");
    };
    try {
      var res = accept({ name: name, info: info });
      if (res && typeof res.then === 'function') res.then(decide, function () { decide(false); }); else decide(res);
    } catch (e) {
      this._log('accept() threw: ' + e);
      decide(false);
    }
  };

  Net.prototype._deny = function (eid, r, why, text) {
    this._log('refused a join (' + why + ')');
    this._publishRaw(r, this._base() + 'g/' + eid, { t: 'dn', w: why, x: text });
  };

  Net.prototype._sendWelcome = function (rec, r) {
    var hdr = { t: 'wl', id: rec.id, tk: rec.token, bk: rec.key, rk: this._roomKey, hn: this.room.name, hi: this.room.info, mx: this.room.maxPlayers };
    if (this.direct.id) hdr.pj = this.direct.id;
    if (rec.rejoin) hdr.rj = 1;
    this._publishRaw(r, this._base() + 'g/' + rec.eid, hdr);
  };

  function makePub(id, name, info, isHost) {
    return { id: id, name: name, info: info === undefined ? null : info, isHost: !!isHost, route: 'relay', rtt: null, lagging: false, state: 'connected' };
  }

  Net.prototype._admit = function (eid, via, o) {
    var id = o.id || this._freeId();
    if (id === null) { this._deny(eid, via.relay, 'full', 'That game is full.'); return; }
    var link = new Link(this, eid, this._base() + 'g/' + eid);
    var pub = makePub(id, o.name, o.info, false);
    var rec = { id: id, eid: eid, token: o.token || randId(20), key: o.key || randId(12), keyed: !!o.keyed, name: o.name, info: o.info, link: link, pub: pub, lagging: false, reconnecting: false, rejoin: !!o.rejoin, joinedAt: Date.now() };
    pub.rejoin = !!o.rejoin;
    link.peer = rec;
    this.links[eid] = link;
    this.peerRecs[id] = rec;
    link.heard(via);
    this._sendWelcome(rec, via.relay);
    this._log((o.rejoin ? 'rejoined: ' : 'joined: ') + o.name + ' as #' + id);
    this._flushRoster(['j', id]); // roster first, so the new guest knows everyone before game messages
    this._status(o.name + (o.rejoin ? ' rejoined' : ' joined'));
    this.emit('join', pub);
  };

  // A known player came back with a new endpoint (page reload, or it rejoined after a long blip).
  Net.prototype._replaceLink = function (rec, eid, via) {
    var old = rec.link;
    if (old) { delete this.links[old.eid]; old.destroy(); this._markGone(old.eid); }
    var link = new Link(this, eid, this._base() + 'g/' + eid);
    link.peer = rec; rec.link = link; rec.eid = eid; rec.rejoin = true;
    this.links[eid] = link;
    link.heard(via);
    var wasLagging = rec.lagging;
    rec.lagging = rec.reconnecting = false;
    rec.pub.lagging = false; rec.pub.state = 'connected'; rec.pub.route = 'relay'; rec.pub.rejoin = true;
    this._sendWelcome(rec, via.relay);
    this._log('player #' + rec.id + ' is back with a fresh connection');
    this._flushRoster(null);
    if (wasLagging) this.emit('lagging', rec.pub, false);
    this.emit('reconnected', rec.pub, { rejoin: true });
  };

  Net.prototype._removePeer = function (rec, reason, keepSlot) {
    if (this.peerRecs[rec.id] !== rec) return;
    delete this.peerRecs[rec.id];
    delete this.links[rec.eid];
    rec.link.destroy();
    this._markGone(rec.eid);
    if (keepSlot) this.tombs[rec.token] = { id: rec.id, name: rec.name, key: rec.key, until: now() + this.opts.rejoinMs };
    rec.pub.state = 'left';
    this._log('left: #' + rec.id + ' (' + reason + ')');
    this._flushRoster(['l', rec.id, reason]);
    this._status(rec.name + ' left');
    this.emit('leave', rec.pub, reason);
  };

  Net.prototype._roster = function () {
    var list = [[0, this.room.name, this.room.info, 0]];
    each(this.peerRecs, function (p) { list.push([p.id, p.name, p.info, p.reconnecting ? 2 : (p.lagging ? 1 : 0)]); });
    return list;
  };
  Net.prototype._flushRoster = function (evt) {
    this._rosterDirty = false;
    var data = { l: this._roster() };
    if (evt) data.e = evt;
    var mj = encodeMsg(data);
    each(this.peerRecs, function (p) { p.link.sendData(mj, false, { k: 'ro' }); });
  };

  Net.prototype._hostTick = function (t) {
    var o = this.opts, self = this;
    if (this.state === 'connecting') {
      var waited = t - this._hostStart;
      if (!this.pool.everUp()) {
        if ((this.pool.allFailed() && waited > 3000) || waited > o.relayConnectMs + 3000) this._failBlocked();
        return;
      }
      if (this._probe && this._probe.firstAt && t - this._probe.firstAt >= o.probeMs) this._serve();
      return;
    }
    if (this.state !== 'hosting') return;
    each(this.peerRecs, function (rec) {
      if (self.closed || self.peerRecs[rec.id] !== rec) return;
      var L = rec.link, silent = t - L.lastHeard;
      if (L.goneAt && t - L.goneAt > 2000) silent = Math.max(silent, o.reconnectingMs + 1); // its relays reported it gone
      if (!rec.lagging && silent > o.lagMs) {
        rec.lagging = true; rec.pub.lagging = true; rec.pub.state = 'lagging'; self._rosterDirty = true;
        self.pool.checkNow(); // maybe it's our side: make sure our relay connections still carry data
        self.emit('lagging', rec.pub, true);
      }
      if (rec.lagging && !rec.reconnecting && silent > o.reconnectingMs) {
        rec.reconnecting = true; rec.pub.state = 'reconnecting'; self._rosterDirty = true;
        self._log('#' + rec.id + ' silent for ' + Math.round(silent / 1000) + ' s - reconnecting');
        self.emit('reconnecting', rec.pub);
      }
      // (never drop anybody while we ourselves have no relay at all - it's our outage, see _onRelayUp)
      if (t - L.lastHeard > o.dropMs && !self._offlineAt) self._removePeer(rec, 'timeout', true);
      // Let in, but its tab died before it ever sent us anything (closed mid-join: the relays delivered its
      // "connection lost" last will). Don't keep a phantom player for 90 s; its token still brings it back.
      else if (L.goneAt && !L.gotData && t - L.goneAt > 3000 && !self._offlineAt) self._removePeer(rec, 'left', true);
      else { rec.pub.route = L.route; rec.pub.rtt = L.rtt(); }
    });
    if (!this._offlineAt) each(this.tombs, function (tb, k) { if (tb.until < t) delete self.tombs[k]; });
    each(this._pending, function (pd, k) { if (t - pd.at > 120000) delete self._pending[k]; });
    each(this._gone, function (at, k) { if (t - at > 60000) delete self._gone[k]; });
    if (this._rosterDirty && !this.closed) this._flushRoster(null);
  };

  /* ====================================================================================
   * 6b. Joining
   * ==================================================================================== */

  Net.prototype.join = function (code, jopts) {
    var self = this;
    code = normCode(code); // only spaces, dashes and dots are ignored: "12a456" must not turn into another room
    if (!/^\d{6}$/.test(code)) return Promise.reject(hgError('bad-code', 'Game codes are 6 digits - check the code with the host.'));
    if (this.state !== 'idle') return Promise.reject(hgError('busy', 'This HGNet connection is already in use - make a new one with HGNet.create().'));
    jopts = jopts || {};
    var info = jopts.info === undefined ? null : jopts.info;
    if (jsonSize(info) > LIMITS.info) return Promise.reject(hgError('too-big', 'HGNet: player info must be under 4 KB.'));
    this.code = code; this.state = 'joining';
    this.token = (typeof jopts.token === 'string' && /^[a-z0-9]{8,40}$/.test(jopts.token)) ? jopts.token : (this.opts.resume ? loadToken(this.game, code) : null);
    this._joinReq = { name: cleanName(jopts.name, 'Player'), info: info, startedAt: now(), firstHello: 0, lastHello: 0, hostSeen: false };
    this.hostLink = null;
    this.hostPub = null;
    this._reconnecting = false; this._hostLagging = false; this._rejoin = null; this._keys = null;
    var p = new Promise(function (resolve, reject) { self._joinP = { resolve: resolve, reject: reject }; });
    this._status('Connecting to game servers...');
    this._startPool([this._inbox(), this._base() + 'b'], this._guestWill());
    return p;
  };

  Net.prototype._sendHello = function (r, rejoin) {
    var j = this._joinReq, hdr = { t: 'he', n: j.name, pv: VERSION, kv: 1 }; // kv: we use goodbye keys
    if (j.info !== null) hdr.i = j.info;
    if (this.token) hdr.tk = this.token;
    if (rejoin) hdr.rj = 1;
    this._publishRaw(r, this._base() + 'h', hdr);
  };

  Net.prototype._guestFrame = function (fr, via) {
    var t = fr.t;
    // Only our current inbox and the room broadcast topic count (frames to an old inbox are stale).
    if (via.relay && via.topic !== this._inbox() && via.topic !== this._base() + 'b') return;
    if (this.state === 'joining') {
      if (t === 'wl') this._onWelcome(fr, via);
      else if (t === 'dn') this._onDenied(fr);
      else if (t === 'wt') this._joinReq.hostSeen = true;
      return;
    }
    var L = this.hostLink;
    if (!L || fr.f !== L.eid) return; // not from our host
    switch (t) {
      case 'by':
        // The host's goodbye must carry one of the keys from our welcome: anybody watching the relay knows
        // the host's endpoint id, and a forged goodbye must not end the game for everyone.
        if (this._keys && (!isStr(fr.k, 16) || (fr.k !== this._keys.g && fr.k !== this._keys.r))) { this.stats.malformed++; return; }
        if (fr.w === 'kicked') this._shutdown('kicked', isStr(fr.x, 200) && fr.x ? fr.x : 'The host removed you from the game.');
        else this._shutdown('host-left', 'The host left the game.');
        return;
      case 'gn': if (via.relay) L.relayGone(via.relay); return;
      case 'nk':
        // "I don't know you": the host dropped us (we were silent too long). A host that is answering our
        // heartbeats does know us, so an 'nk' then is stale or forged - ignore it.
        if (now() - L.lastPong > 3000) this._startRejoin();
        return;
      case 'wl': if (this._rejoin) this._onWelcome(fr, via); else L.heard(via); return;
      case 'dn': if (this._rejoin) this._shutdown('lost', isStr(fr.x, 200) && fr.x ? fr.x : 'Could not get back into the game.'); return;
      case 'wt': return;
      default: L.onFrame(fr, via);
    }
  };

  Net.prototype._onWelcome = function (fr, via) {
    if (!isInt(fr.id, 1, LIMITS.maxId) || !isStr(fr.tk, 40) || !/^[a-z0-9]{8,40}$/.test(fr.tk)) return;
    if (this.hostLink && this.hostLink.eid !== fr.f) return;
    var self = this, rejoining = !!this._rejoin;
    if (rejoining && fr.id !== this.id) { // never switch a running game to a different player id
      this._shutdown('lost', 'You were away too long and lost your place - join again with the code.');
      return;
    }
    if (this.hostLink) this.hostLink.destroy();
    this.hostLink = new Link(this, fr.f, this._base() + 'h');
    this.id = fr.id;
    this.token = fr.tk;
    if (this.opts.resume) saveToken(this.game, this.code, fr.tk);
    this.hostInfo = { name: cleanName(fr.hn, 'Host'), info: fr.hi === undefined ? null : fr.hi, maxPlayers: isInt(fr.mx, 2, 64) ? fr.mx : null };
    if (!this.hostPub) this.hostPub = makePub(0, this.hostInfo.name, this.hostInfo.info, true);
    if (isStr(fr.pj, 64)) this.hostLink.remotePj = fr.pj;
    this.hostLink.lastPong = now(); // the host just answered us (see 'nk' in _guestFrame)
    if (/^[a-z0-9]{8,16}$/.test(fr.bk) && /^[a-z0-9]{8,16}$/.test(fr.rk)) this._keys = { g: fr.bk, r: fr.rk };
    this.hostLink.heard(via);
    if (rejoining) {
      this._rejoin = null; this._reconnecting = false; this.state = 'joined';
      this.hostPub.state = 'connected'; this.hostPub.lagging = false; this.hostPub.route = 'relay';
      if (this._hostLagging) { this._hostLagging = false; this.emit('lagging', this.hostPub, false); }
      this._status('Back in the game');
      this.emit('reconnected', undefined, { rejoin: true });
      this._maybeDirect();
      return;
    }
    this.state = 'joined';
    this._status('Joined game ' + this.code + ' (via game server)');
    var p = this._joinP; this._joinP = null;
    p.resolve({ id: this.id, hostInfo: this.hostInfo, code: this.code, rejoined: !!fr.rj });
    // announce the host after the game's own .then() / await continuation has run
    Promise.resolve().then(function () { if (!self.closed) self.emit('join', self.hostPub); });
    this.direct.start();
  };

  Net.prototype._onDenied = function (fr) {
    var why = fr.w === 'full' ? 'full' : 'refused';
    this._fail(why, isStr(fr.x, 200) && fr.x ? fr.x : (why === 'full' ? 'That game is full.' : "The host didn't let you join this game."));
  };

  // The host does not know us any more (it dropped us after a long silence): come back with our token,
  // using a fresh endpoint id so nothing from the old connection can mix into the new one.
  Net.prototype._startRejoin = function () {
    var self = this;
    if (this._rejoin || this.closed || !this.token) return;
    this._log('host no longer knows us - rejoining with our token');
    this._rejoin = { at: now(), lastHello: 0 };
    this._setReconnecting();
    if (this.hostLink) { // stop the old link from sending, but keep its "last heard" time
      var last = this.hostLink.lastHeard, eid = this.hostLink.eid;
      this.hostLink.destroy();
      this.hostLink = new Link(this, eid, this._base() + 'h');
      this.hostLink.lastHeard = last;
      this.hostLink.dead = true; // placeholder until the new welcome arrives
    }
    this.eid = randId(12);
    // relay connections made from now on announce "connection lost" under the new endpoint id
    this.pool.will = this._guestWill();
    this.pool.setTopics([this._inbox(), this._base() + 'b'], function (r) { self._sendHello(r, true); });
  };
  Net.prototype._guestWill = function () { return { topic: this._base() + 'h', payload: encodeFrame({ v: PROTO, t: 'gn', f: this.eid }) }; };

  Net.prototype._setReconnecting = function () {
    if (this._reconnecting) return;
    this._reconnecting = true;
    this.state = 'reconnecting';
    if (this.hostPub) this.hostPub.state = 'reconnecting';
    this._status('Connection lost - reconnecting...');
    if (this.pool) { this.pool.retryNow(); this.pool.checkNow(); }
    this.emit('reconnecting');
  };

  Net.prototype._guestTick = function (t) {
    var o = this.opts, j = this._joinReq, pool = this.pool;
    if (this.state === 'joining') {
      var ups = pool.upList(), waited = t - j.startedAt, self = this;
      if (ups.length && t - j.lastHello >= o.helloEveryMs) {
        j.lastHello = t;
        if (!j.firstHello) j.firstHello = t;
        ups.forEach(function (r) { self._sendHello(r, false); });
      }
      if (!pool.everUp()) {
        if ((pool.allFailed() && waited > 3000) || waited > o.relayConnectMs + 3000) this._failBlocked();
      } else if (!j.hostSeen) {
        var settled = pool.settled() && t - pool.lastUpAt > 2000;
        if ((j.firstHello && t - j.firstHello > o.notFoundMs && settled) || waited > o.joinTimeoutMs)
          this._fail('not-found', 'No game with code ' + this.code + ' - check the digits with the host.');
      } else if (waited > 90000) this._fail('timeout', 'The host did not let you in in time.');
      return;
    }
    if (this.state !== 'joined' && this.state !== 'reconnecting') return;
    var L = this.hostLink, silent = t - L.lastHeard;
    var d = L.direct, directOk = d && d.up && !d.stalled;
    var noRoute = !pool.upCount() && !directOk;
    if (!this._hostLagging && (silent > o.lagMs || (noRoute && silent > 1500))) {
      this._hostLagging = true; this.hostPub.lagging = true;
      pool.checkNow(); // a silently dead relay connection is the usual cause: find out now, not in 20 s
      this.emit('lagging', this.hostPub, true);
    }
    if (!this._reconnecting && (silent > o.reconnectingMs || ((noRoute || L.goneAt) && silent > 2000))) this._setReconnecting();
    if (this._reconnecting && t - (this._lastCheck || 0) > 3000) { this._lastCheck = t; pool.checkNow(); }
    if (this._rejoin && t - this._rejoin.lastHello >= o.helloEveryMs) {
      var me = this;
      this._rejoin.lastHello = t;
      pool.upList().forEach(function (r) { me._sendHello(r, true); });
    }
    // Give up after giveUpMs (2 minutes) of silence. We wait the full time even when the relays reported
    // the host's connection as lost (L.goneAt): a host whose Wi-Fi drops or whose laptop lid closes for a
    // minute comes back to the same room, and its guests should still be there.
    if (silent > o.giveUpMs) { this._shutdown('lost', 'Lost the connection to the host.'); return; }
    this.hostPub.route = L.route; this.hostPub.rtt = L.rtt();
    var self2 = this;
    each(this.peerRecs, function (p) { p.pub.route = self2.hostPub.route; });
    this._maybeDirect();
  };

  Net.prototype._onRoster = function (data) {
    if (!isObj(data) || !isArr(data.l) || data.l.length > 128) return;
    var self = this, seen = {}, joined = [], evt = isArr(data.e) ? data.e : null;
    data.l.forEach(function (e) {
      if (!isArr(e) || !isInt(e[0], 0, LIMITS.maxId)) return;
      var id = e[0], name = cleanName(e[1], id === 0 ? 'Host' : 'Player ' + id), info = e[2] === undefined ? null : e[2], st = isInt(e[3], 0, 2) ? e[3] : 0;
      seen[id] = true;
      if (id === 0) { if (self.hostPub) { self.hostPub.name = name; self.hostPub.info = info; } return; }
      if (id === self.id) return;
      var rec = self.peerRecs[id];
      if (!rec) {
        rec = self.peerRecs[id] = { id: id, name: name, info: info, st: st, pub: makePub(id, name, info, false) };
        rec.pub.lagging = st > 0; rec.pub.state = st === 2 ? 'reconnecting' : (st === 1 ? 'lagging' : 'connected');
        rec.pub.route = self.hostPub ? self.hostPub.route : 'relay';
        joined.push(rec.pub);
        return;
      }
      rec.name = rec.pub.name = name; rec.info = rec.pub.info = info;
      if (st !== rec.st) {
        var was = rec.st;
        rec.st = st; rec.pub.lagging = st > 0; rec.pub.state = st === 2 ? 'reconnecting' : (st === 1 ? 'lagging' : 'connected');
        if (was === 0) self.emit('lagging', rec.pub, true);
        if (st === 2) self.emit('reconnecting', rec.pub);
        if (st === 0) { self.emit('lagging', rec.pub, false); if (was === 2) self.emit('reconnected', rec.pub, { rejoin: false }); }
      }
    });
    each(this.peerRecs, function (rec, id) {
      if (seen[id]) return;
      delete self.peerRecs[id];
      rec.pub.state = 'left';
      var reason = evt && evt[0] === 'l' && evt[1] === rec.id && isStr(evt[2], 16) ? evt[2] : 'left';
      self.emit('leave', rec.pub, reason);
    });
    joined.forEach(function (pub) { self.emit('join', pub); });
  };

  Net.prototype._onCtrl = function (link, k, data) {
    if (this.isHost) {
      if (k === 'rtc' && isObj(data) && isStr(data.pj, 64)) link.remotePj = data.pj;
      return;
    }
    if (k === 'ro') this._onRoster(data);
    else if (k === 'rtc' && isObj(data) && isStr(data.pj, 64)) { link.remotePj = data.pj; link.directTries = 0; link.nextDirectAt = 0; this._maybeDirect(); }
  };

  /* ====================================================================================
   * 6c. WebRTC upgrade plumbing
   * ==================================================================================== */

  Net.prototype._onDirectReady = function (pjId) {
    if (this.isHost) { each(this.peerRecs, function (p) { p.link.sendCtrl('rtc', { pj: pjId }); }); return; }
    this._maybeDirect();
  };

  // Guests start the WebRTC attempt (the host would otherwise have to dial every guest).
  Net.prototype._maybeDirect = function () {
    var L = this.hostLink, D = this.direct, conn;
    if (this.isHost || !L || L.dead || L.direct || this._rejoin || D.state !== 'open' || !L.remotePj) return;
    if (now() < L.nextDirectAt || L.directTries >= 4) return;
    L.directTries++;
    this._log('trying a direct WebRTC link (attempt ' + L.directTries + ')');
    try { conn = D.peer.connect(L.remotePj, { label: 'hgnet', serialization: 'raw', reliable: true, metadata: { e: this.eid } }); } catch (e) { conn = null; }
    if (!conn) { L.nextDirectAt = now() + 20000; return; }
    this._attachDirect(L, conn);
  };

  Net.prototype._onDirectIncoming = function (conn) {
    var md = conn && conn.metadata, L = md && isStr(md.e, 16) ? this.links[md.e] : null;
    if (!this.isHost || !L || !L.peer || conn.label !== 'hgnet' || (L.remotePj && L.remotePj !== conn.peer)) {
      try { conn.close(); } catch (e) { /* ignore */ }
      return;
    }
    L.remotePj = conn.peer;
    this._attachDirect(L, conn);
  };

  Net.prototype._attachDirect = function (L, conn) {
    var self = this;
    if (L.direct) L.closeDirect('replaced');
    var d = { conn: conn, fast: null, open: false, up: false, stalled: false, lastHeard: 0, lastPong: 0, lastPing: 0, srtt: 0, rttvar: 0, startedAt: now() };
    L.direct = d;
    conn.on('open', function () {
      if (L.direct !== d) return;
      d.open = true; d.lastHeard = d.lastPong = now();
      var pc = conn.peerConnection;
      try { // a second, unordered + no-retransmit channel for fast messages (no head-of-line blocking)
        var dc = pc.createDataChannel('hgfast', { negotiated: true, id: 77, ordered: false, maxRetransmits: 0 });
        dc.onmessage = function (e) { if (L.direct === d) self._onDirectData(L, e.data); };
        d.fast = dc;
      } catch (e) { /* fast messages will use the reliable channel */ }
      try {
        pc.addEventListener('iceconnectionstatechange', function () {
          var s = pc.iceConnectionState;
          if ((s === 'failed' || s === 'closed') && L.direct === d) L.closeDirect('ICE ' + s);
        });
      } catch (e) { /* ignore */ }
      d.lastPing = now();
      L.sendRaw({ t: 'pi', n: round1(now()) }, VIA_DIRECT);
    });
    conn.on('data', function (data) { if (L.direct === d) self._onDirectData(L, data); });
    conn.on('close', function () { if (L.direct === d) L.closeDirect('closed by peer'); });
    conn.on('error', function () { if (L.direct === d) L.closeDirect('error'); });
  };

  Net.prototype._onDirectUnavailable = function () {
    if (!this.isHost && this.hostLink && this.hostLink.direct && !this.hostLink.direct.open) this.hostLink.closeDirect('host unreachable');
  };

  Net.prototype._directClosed = function (L, d) {
    if (this.isHost || this.closed) return;
    if (d.up && now() - d.startedAt > 60000) L.directTries = Math.min(L.directTries, 1); // it worked for a while: allow retries
    L.nextDirectAt = now() + [5000, 20000, 60000][Math.min(Math.max(L.directTries - 1, 0), 2)];
  };

  Net.prototype._onRoute = function (L, route) {
    var pub = this.isHost ? (L.peer && L.peer.pub) : this.hostPub;
    if (!pub) return;
    pub.route = route;
    this._log('route to ' + (this.isHost ? '#' + pub.id : 'host') + ': ' + route);
    if (!this.isHost) this._status(route === 'direct' ? 'Fast direct connection to the host' : 'Connected through the game server');
    this.emit('route', pub, route);
  };

  /* ---------- liveness bookkeeping ---------- */
  Net.prototype._linkHeard = function (L) {
    if (this.isHost) {
      var rec = L.peer;
      if (!rec || !rec.lagging) return;
      var wasRe = rec.reconnecting;
      rec.lagging = rec.reconnecting = false;
      rec.pub.lagging = false; rec.pub.state = 'connected';
      this._rosterDirty = true;
      L.resendAll();
      this.emit('lagging', rec.pub, false);
      if (wasRe) { this._log('#' + rec.id + ' is back'); this.emit('reconnected', rec.pub, { rejoin: false }); }
      return;
    }
    if (L !== this.hostLink || this._rejoin) return;
    if (this._hostLagging) { this._hostLagging = false; this.hostPub.lagging = false; L.resendAll(); this.emit('lagging', this.hostPub, false); }
    if (this._reconnecting) {
      this._reconnecting = false;
      this.state = 'joined';
      this.hostPub.state = 'connected';
      this._status('Reconnected');
      this.emit('reconnected', undefined, { rejoin: false });
    }
  };

  /* ---------- the housekeeping timer ---------- */
  // Runs from every() (a worker beat, so it keeps going in background tabs). On network traffic it is also
  // run if it is overdue, which keeps sessions alive where workers are not allowed. Never re-entrant.
  // Normally that happens AFTER the incoming frame was handled (an ack in it must count before we decide what
  // to retransmit); only after a long gap does it run first, so that the "were our timers frozen?" check in
  // _tickBody sees the silence before this frame counts as traffic.
  Net.prototype._tickIfLate = function (before) {
    if (this.closed || this._inTick) return;
    var late = now() - this._lastTick;
    if (before ? late > 4000 : late > Math.max(300, this.opts.tickMs * 3)) this._tick();
  };
  Net.prototype._tick = function () {
    if (this.closed || this._inTick) return;
    this._inTick = true;
    try { this._tickBody(); } finally { this._inTick = false; }
  };
  Net.prototype._tickBody = function () {
    var t = now(), gap = t - this._lastTick, self = this;
    var wall = Date.now(), wallGap = wall - this._lastWall;
    this._lastTick = t; this._lastWall = wall;
    // If this whole tab was frozen (laptop asleep, tab discarded and restored) nothing arrived while our
    // timers were stopped, so the silence is our fault, not the peers': don't count it against them.
    // (A merely throttled background tab still receives network events, so it does not trigger this.)
    // Afterwards every relay connection is checked at once: sockets often die silently during sleep.
    if (gap > 4000 && t - this._lastRxAt > gap * 0.8) {
      var shift = gap - this.opts.tickMs;
      this._log('timers were paused for ' + Math.round(gap / 1000) + ' s - giving peers extra time');
      each(this.links, function (L) { L.lastHeard = Math.min(t, L.lastHeard + shift); });
      if (this.hostLink) this.hostLink.lastHeard = Math.min(t, this.hostLink.lastHeard + shift);
      if (this.pool) { this.pool.resetEchoes(); this.pool.checkNow(); this.pool.retryNow(); }
    } else if (wallGap - gap > 5000 && this.pool) {
      // The wall clock jumped but performance.now() did not: on some systems the monotonic clock stops
      // while the computer sleeps. Peers' silence is then not miscounted, but our sockets may be dead.
      this._log('computer was asleep for about ' + Math.round(wallGap / 1000) + ' s - checking connections');
      this.pool.resetEchoes(); this.pool.checkNow(); this.pool.retryNow();
    }
    if (this.pool && this.pool.lib) this.pool.tick(t);
    if (this.isHost) {
      each(this.links, function (L) { if (!self.closed) L.tick(t); });
      if (!this.closed) this._hostTick(t);
    } else {
      if (this.hostLink && !this.closed) this.hostLink.tick(t);
      if (!this.closed) this._guestTick(t);
    }
  };

  /* ---------- failing and closing ---------- */
  Net.prototype._failBlocked = function () {
    this._fail('blocked', 'Your network is blocking our game servers - try another network (like home Wi-Fi or a phone hotspot), or ask whoever runs this network to allow them. "Test my connection" shows which ones are blocked.');
  };

  // host()/join() could not complete
  Net.prototype._fail = function (code, text) {
    var p = this._hostP || this._joinP;
    this._hostP = this._joinP = null;
    if (!p) { this._shutdown(code, text); return; }
    this._log('failed: ' + code);
    this._byeWhileJoining();
    this._shutdown(code, text);
    p.reject(hgError(code, text));
  };

  // Goodbye frames carry a key that only the two ends know (handed out in the welcome), so that nobody else
  // can end a session with a forged goodbye. Host -> guest: that guest's key; guest -> host: its own key.
  Net.prototype._sayBye = function (L, why, text) {
    if (!L || L.dead || !this.pool) return;
    var hdr = { v: PROTO, t: 'by', f: this.eid, w: why };
    if (text) hdr.x = String(text).slice(0, 200);
    var key = this.isHost ? (L.peer && L.peer.key) : (this._keys && this._keys.g);
    if (key) hdr.k = key;
    var str = encodeFrame(hdr), self = this;
    // goodbye goes out immediately on every route (no artificial delay: we are about to disconnect)
    this.pool.upList().forEach(function (r) { self._relaySend(r, L.out, str); });
    L._directSend(str, false);
  };

  Net.prototype.close = function () {
    if (this.closed) return;
    var self = this;
    if (this.isHost && this.state === 'hosting') {
      each(this.peerRecs, function (p) { self._sayBye(p.link, 'host-left'); });
      // the room key is revealed here, but the room is closing anyway
      var str = encodeFrame({ v: PROTO, t: 'by', f: this.eid, w: 'host-left', k: this._roomKey });
      this.pool.upList().forEach(function (r) { self._relaySend(r, self._base() + 'b', str); });
    } else if (!this.isHost && this.hostLink && (this.state === 'joined' || this.state === 'reconnecting')) {
      this._sayBye(this.hostLink, 'left');
    } else this._byeWhileJoining();
    this._shutdown('closed', 'You left the game.');
  };
  // Gave up while joining: the host may already have let us in, so free that slot right away.
  Net.prototype._byeWhileJoining = function () {
    if (this.isHost || this.state !== 'joining' || !this.pool) return;
    var self = this, bye = encodeFrame({ v: PROTO, t: 'by', f: this.eid, w: 'left' });
    this.pool.upList().forEach(function (r) { self._relaySend(r, self._base() + 'h', bye); });
  };

  Net.prototype._shutdown = function (reason, text) {
    if (this.closed) return;
    var was = this.state, self = this;
    this.closed = true;
    this.state = 'closed';
    if (this._stopTick) { this._stopTick(); this._stopTick = null; }
    if (root.removeEventListener) {
      root.removeEventListener('pagehide', this._onPageHide);
      root.removeEventListener('online', this._onOnline);
    }
    if (root.document && root.document.removeEventListener) root.document.removeEventListener('visibilitychange', this._onVisible);
    each(this.links, function (L) { L.destroy(); });
    if (this.hostLink) this.hostLink.destroy();
    this.direct.close();
    if (this.pool) this.pool.close();
    // keep the token after a normal close/page unload (a reloaded page gets its slot back); forget it
    // when the room is gone or the host removed us
    if (!this.isHost && this.code && (reason === 'host-left' || reason === 'kicked')) clearToken(this.game, this.code);
    var p = this._hostP || this._joinP;
    this._hostP = this._joinP = null;
    if (p) p.reject(hgError(reason, text));
    this._log('closed: ' + reason);
    this._status(text);
    if (was === 'hosting' || was === 'joined' || was === 'reconnecting') self.emit('closed', reason, text);
  };

  /* ====================================================================================
   * 6d. Public API: sending, peers, stats
   * ==================================================================================== */

  // net.send(to, msg, { fast }) - to: a player id, 'host', 'all', or (host only) an array of ids.
  // Host: opts.except = id or [ids] to leave out of 'all'.  Returns true if the message was queued.
  Net.prototype.send = function (to, msg, sopts) {
    if (this.closed || !(this.state === 'hosting' || this.state === 'joined' || this.state === 'reconnecting')) return false;
    var fast = !!(sopts && sopts.fast), mj = encodeMsg(msg);
    if (this.isHost) {
      var ex = sopts && sopts.except;
      return this._hostDeliver(to, mj, fast, undefined, ex === undefined ? undefined : (isArr(ex) ? ex : [ex]));
    }
    if (!this.hostLink || this.hostLink.dead) return false;
    var meta = {};
    if (to === 'all' || to === '*') meta.to = '*';
    else if (!(to === 'host' || toId(to) === 0)) {
      var id = toId(to);
      if (id === null || id === this.id) return false;
      meta.to = id;
    }
    return this.hostLink.sendData(mj, fast, meta);
  };

  // Host only: pass a message on to `to` so it arrives as if `from` had sent it (e.g. relaying chat).
  Net.prototype.forward = function (from, to, msg, sopts) {
    if (!this.isHost || this.state !== 'hosting') return false;
    var fid = toId(from), fast = !!(sopts && sopts.fast);
    var ex = [];
    if (fid !== null && fid !== 0) ex.push(fid);
    if (sopts && sopts.except !== undefined) ex = ex.concat(isArr(sopts.except) ? sopts.except : [sopts.except]);
    return this._hostDeliver(to, encodeMsg(msg), fast, fid === null ? undefined : fid, ex);
  };

  Net.prototype._hostDeliver = function (to, mj, fast, fromId, except) {
    var self = this, targets = [], all = to === 'all' || to === '*';
    var exc = {};
    (except || []).forEach(function (x) { var i = toId(x); if (i !== null) exc[i] = true; });
    if (all) each(this.peerRecs, function (p) { if (!exc[p.id]) targets.push(p); });
    else (isArr(to) ? to : [to]).forEach(function (x) { var i = toId(x); if (i !== null && self.peerRecs[i] && !exc[i]) targets.push(self.peerRecs[i]); });
    if (!targets.length) return false;
    var meta = fromId ? { fr: fromId } : {};
    if (fast && all && targets.length > 1 && mj.length + 300 <= LIMITS.payload) { this._broadcastFast(targets, mj, meta, except); return true; }
    targets.forEach(function (p) { p.link.sendData(mj, fast, meta); });
    return true;
  };

  // A fast message for everybody: players on WebRTC get it directly; for players on relays we publish ONE
  // copy per relay on the room broadcast topic instead of one copy per player (saves host upload).
  Net.prototype._broadcastFast = function (targets, mj, meta, except) {
    var q = ++this.fastSeq, relays = {}, t = now(), self = this, k;
    targets.forEach(function (p) {
      var route = p.link.pickRoute(0, t);
      if (route === DIRECT) p.link.sendData(mj, true, meta, q);
      else if (route && !self.opts.noRelay) relays[route.idx] = route;
    });
    var hdr = { v: PROTO, t: 'u', f: this.eid, q: q };
    for (k in meta) hdr[k] = meta[k];
    var ex = (except || []).map(toId).filter(function (x) { return x !== null; });
    if (ex.length) hdr.x = ex;
    var str = encodeFrame(hdr, mj), topic = this._base() + 'b';
    each(relays, function (r) { self._impair(function () { self._relaySend(r, topic, str, true); }); });
  };

  Net.prototype.kick = function (id, text) {
    if (!this.isHost) return false;
    var rec = this.peerRecs[toId(id)];
    if (!rec) return false;
    this._sayBye(rec.link, 'kicked', text);
    this._removePeer(rec, 'kicked', false);
    return true;
  };

  Net.prototype.peers = function () {
    var out = [];
    function copy(p) { return { id: p.id, name: p.name, info: p.info, isHost: p.isHost, route: p.route, rtt: p.rtt, lagging: p.lagging, state: p.state }; }
    if (!this.isHost && this.hostPub && !this.closed) out.push(copy(this.hostPub));
    each(this.peerRecs, function (p) { out.push(copy(p.pub)); });
    return out;
  };

  // How many reliable messages to `to` are waiting to be delivered (use it to avoid flooding a slow peer).
  Net.prototype.backlog = function (to) {
    if (!this.isHost) return this.hostLink ? this.hostLink.backlog() : 0;
    var rec = this.peerRecs[toId(to)];
    return rec ? rec.link.backlog() : 0;
  };

  Net.prototype.getStats = function () {
    var s = {}, k;
    for (k in this.stats) s[k] = this.stats[k];
    s.state = this.state; s.code = this.code; s.id = this.id; s.isHost = this.isHost;
    s.relays = this.pool ? this.pool.info() : [];
    s.webrtc = this.direct.state;
    return s;
  };
  Net.prototype.logs = function () { return this._logs.slice(); };

  /* ====================================================================================
   * 7. Diagnostics - "Test my connection"
   * ==================================================================================== */

  function testRelay(lib, r, timeoutMs) {
    return new Promise(function (resolve) {
      var start = now(), res = { name: r.name, url: r.url, ok: false, connectMs: null, rttMs: null, error: '' }, done = false, c, lastErr = '', sentAt = 0;
      var topic = TOPIC_ROOT + '/diag/' + randId(12);
      function finish(ok, err) {
        if (done) return;
        done = true; clearTimeout(timer);
        res.ok = ok; if (!ok) res.error = err || lastErr || 'blocked';
        try { if (c) c.end(true); } catch (e) { /* ignore */ }
        resolve(res);
      }
      var timer = setTimeout(function () { finish(false, res.connectMs === null ? 'no answer (blocked?)' : 'connected but messages do not come back'); }, timeoutMs);
      var o = { clientId: 'hgd' + randId(12), clean: true, protocolVersion: 4, connectTimeout: timeoutMs, reconnectPeriod: 0, keepalive: 30, timerVariant: workersAllowed() ? 'auto' : 'native' };
      if (r.username) { o.username = r.username; o.password = r.password || ''; }
      try { c = lib.connect(r.url, o); } catch (e) { finish(false, 'bad address'); return; }
      c.on('connect', function () {
        res.connectMs = Math.round(now() - start);
        c.subscribe(topic, { qos: 0 }, function (err) {
          if (err) { finish(false, 'subscribe refused'); return; }
          sentAt = now();
          c.publish(topic, 'hgnet-diag', { qos: 0 });
        });
      });
      c.on('message', function (t) { if (t === topic && sentAt) { res.rttMs = Math.round(now() - sentAt); finish(true); } });
      c.on('error', function (e) { lastErr = String(e && e.message || e).slice(0, 60); });
      c.on('close', function () { finish(false); });
    });
  }

  function testPeerServer(o, timeoutMs) {
    var po = o.peer || {}, host = po.host || DEFAULT_PEER_HOST;
    var res = { name: 'WebRTC signalling (' + host + ')', host: host, ok: false, ms: null, error: '' };
    if (o.peer === false) { res.error = 'turned off'; return Promise.resolve(res); }
    return loadPeerJS(o).then(function (Peer) {
      return new Promise(function (resolve) {
        var start = now(), p, done = false;
        function finish(ok, err) {
          if (done) return;
          done = true; clearTimeout(timer);
          res.ok = ok; if (ok) res.ms = Math.round(now() - start); else res.error = err;
          try { if (p) p.destroy(); } catch (e) { /* ignore */ }
          resolve(res);
        }
        var timer = setTimeout(function () { finish(false, 'no answer (blocked?)'); }, timeoutMs);
        var popts = { debug: 0, config: { iceServers: [] } };
        if (po.host) popts.host = po.host;
        if (po.port) popts.port = po.port;
        if (po.path) popts.path = po.path;
        if (po.secure !== undefined) popts.secure = !!po.secure;
        if (po.key) popts.key = po.key;
        try { p = new Peer('hgn-diag-' + randId(12), popts); } catch (e) { finish(false, 'error'); return; }
        p.on('open', function () { finish(true); });
        p.on('error', function (e) { finish(false, (e && e.type) || 'error'); });
      });
    }, function () { res.error = 'library blocked'; return res; });
  }

  // Can this browser find a public address (STUN) or a TURN relay? If not, WebRTC can only work on the
  // same local network - games then simply run over the relays.
  function testWebRTC(o, timeoutMs) {
    var res = { name: 'Direct connection (WebRTC)', ok: false, host: 0, srflx: 0, relay: 0, ms: null, error: '' };
    if (typeof root.RTCPeerConnection !== 'function') { res.error = 'not supported'; return Promise.resolve(res); }
    return new Promise(function (resolve) {
      var start = now(), pc, done = false;
      function finish() {
        if (done) return;
        done = true; clearTimeout(timer);
        try { pc.close(); } catch (e) { /* ignore */ }
        res.ms = Math.round(now() - start);
        res.ok = res.srflx + res.relay > 0;
        if (!res.ok && !res.error) res.error = res.host ? 'only local network' : 'blocked';
        resolve(res);
      }
      var timer = setTimeout(finish, timeoutMs);
      try {
        pc = new root.RTCPeerConnection({ iceServers: o.iceServers });
        pc.createDataChannel('diag');
        pc.onicecandidate = function (e) {
          if (!e.candidate) { finish(); return; }
          var m = / typ (host|srflx|prflx|relay)/.exec(e.candidate.candidate || '');
          if (m) { if (m[1] === 'host') res.host++; else if (m[1] === 'relay') res.relay++; else res.srflx++; }
        };
        pc.createOffer().then(function (offer) { return pc.setLocalDescription(offer); }).then(null, function () { res.error = 'error'; finish(); });
      } catch (e) { res.error = 'error'; finish(); }
    });
  }

  function summarize(r) {
    var ok = r.relays.filter(function (x) { return x.ok; }), n = r.relays.length;
    if (!ok.length) {
      return {
        level: 'bad', canPlay: false,
        text: 'Online games cannot connect from this network: all ' + n + ' game servers are blocked.',
        advice: 'Try a different network (home Wi-Fi or a phone hotspot). On a school or work network, ask IT to allow secure WebSocket (wss://) connections to: ' +
          r.relays.map(function (x) { return x.url.replace(/^wss?:\/\//, '').replace(/\/.*$/, ''); }).join(', ') + '.'
      };
    }
    ok.sort(function (a, b) { return (a.rttMs || 9999) - (b.rttMs || 9999); });
    var text = 'Online play should work: ' + ok.length + ' of ' + n + ' game servers reachable (fastest: ' + ok[0].name + ', ' + ok[0].rttMs + ' ms).';
    var advice = r.webrtc && r.webrtc.ok ? 'Direct connections are possible too, so games can get even faster.'
      : 'Direct connections look blocked - that is fine, games run through the game servers with a little extra delay.';
    if (ok.length === 1) advice += ' Only one server works here; if games still drop, try another network.';
    if (ok[0].rttMs > 400) advice += ' The connection is slow right now (high ms), so expect some lag.';
    return { level: ok.length > 1 ? 'good' : 'ok', canPlay: true, text: text, advice: advice };
  }

  function diagnose(dopts) {
    dopts = dopts || {};
    var o = buildOptions(dopts), timeoutMs = isNum(dopts.timeoutMs) ? dopts.timeoutMs : 8000;
    var onProgress = typeof dopts.onProgress === 'function' ? dopts.onProgress : noop;
    var results = {
      when: new Date().toISOString(), version: VERSION,
      relays: o.relays.map(function (r) { return { name: r.name, url: r.url, ok: null, connectMs: null, rttMs: null, error: '' }; }),
      peerServer: null, webrtc: null, summary: null
    };
    function progress() { try { onProgress(results); } catch (e) { /* ignore */ } }
    var relaysP = loadMqtt(o).then(function (lib) {
      return Promise.all(o.relays.map(function (r, i) {
        return testRelay(lib, r, timeoutMs).then(function (res) { results.relays[i] = res; progress(); });
      }));
    }, function () {
      results.relays.forEach(function (x) { x.ok = false; x.error = 'could not load the game-server code (cdn.jsdelivr.net blocked?)'; });
      progress();
    });
    var peerP = testPeerServer(o, timeoutMs).then(function (res) { results.peerServer = res; progress(); });
    var rtcP = testWebRTC(o, Math.min(timeoutMs, 6000)).then(function (res) { results.webrtc = res; progress(); });
    return Promise.all([relaysP, peerP, rtcP]).then(function () {
      results.summary = summarize(results);
      progress();
      return results;
    });
  }

  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function drawDiagnostics(el, r) {
    var chip = function (ok, label) {
      var bg = ok === null ? '#5b6472' : (ok ? '#1f9d55' : (label === 'Limited' ? '#b7791f' : '#c0392b'));
      return '<span style="display:inline-block;min-width:64px;text-align:center;padding:2px 8px;border-radius:10px;background:' + bg + ';color:#fff;font-weight:600;font-size:12px">' + esc(label) + '</span>';
    };
    var row = function (name, detail, ok, label, ms) {
      return '<tr><td style="padding:5px 8px 5px 0;vertical-align:top">' + esc(name) + '<div style="font-size:11px;opacity:.65;word-break:break-all">' + esc(detail) + '</div></td>' +
        '<td style="padding:5px 8px;white-space:nowrap;vertical-align:top">' + chip(ok, label) + '</td>' +
        '<td style="padding:5px 0;text-align:right;white-space:nowrap;vertical-align:top;font-variant-numeric:tabular-nums">' + esc(ms) + '</td></tr>';
    };
    var html = '<div style="font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#161b22;color:#e6edf3;border:1px solid #30363d;border-radius:10px;padding:12px 14px;max-width:560px;box-sizing:border-box">';
    html += '<div style="font-weight:700;font-size:15px;margin-bottom:4px">Connection test</div>';
    if (r.summary) {
      var col = r.summary.level === 'bad' ? '#ff7b72' : (r.summary.level === 'ok' ? '#e3b341' : '#56d364');
      html += '<div style="color:' + col + ';font-weight:600;margin-bottom:2px">' + esc(r.summary.text) + '</div><div style="margin-bottom:8px;opacity:.9">' + esc(r.summary.advice) + '</div>';
    } else html += '<div style="opacity:.8;margin-bottom:8px">Testing your connection - this takes up to 10 seconds...</div>';
    html += '<table style="width:100%;border-collapse:collapse"><tr style="font-size:12px;opacity:.6;text-align:left"><th style="font-weight:500;padding-bottom:4px">Route</th><th style="font-weight:500">Result</th><th style="font-weight:500;text-align:right">Time</th></tr>';
    r.relays.forEach(function (x) {
      html += row('Game server ' + x.name, x.url + (x.error && x.ok === false ? ' - ' + x.error : ''), x.ok, x.ok === null ? 'testing' : (x.ok ? 'OK' : 'Blocked'), x.ok ? x.rttMs + ' ms' : '');
    });
    var ps = r.peerServer, w = r.webrtc;
    html += ps ? row(ps.name, ps.ok ? 'needed for direct connections' : ps.error, ps.ok, ps.ok ? 'OK' : 'Blocked', ps.ok ? ps.ms + ' ms' : '')
      : row('WebRTC signalling', '', null, 'testing', '');
    html += w ? row(w.name, w.ok ? (w.relay ? 'public address + TURN relay found' : 'public address found') : (w.error === 'only local network' ? 'only works on the same Wi-Fi' : w.error), w.ok, w.ok ? 'OK' : 'Limited', w.ok ? w.ms + ' ms' : '')
      : row('Direct connection (WebRTC)', '', null, 'testing', '');
    html += '</table><div style="font-size:11px;opacity:.5;margin-top:6px">HGNet ' + VERSION + (r.when ? ' - ' + esc(r.when.replace('T', ' ').slice(0, 19)) : '') + '</div></div>';
    el.innerHTML = html;
  }

  // Draw the panel into `el` (element or CSS selector). Without `results` it runs the test itself
  // and updates the panel live; returns a Promise for the results.
  function renderDiagnostics(el, results, dopts) {
    if (typeof el === 'string') el = root.document.querySelector(el);
    if (!el) return Promise.reject(new Error('HGNet.renderDiagnostics: element not found'));
    if (results && results.relays) { drawDiagnostics(el, results); return Promise.resolve(results); }
    dopts = dopts || {};
    var user = dopts.onProgress;
    var o = {}, k;
    for (k in dopts) o[k] = dopts[k];
    o.onProgress = function (partial) { drawDiagnostics(el, partial); if (typeof user === 'function') user(partial); };
    drawDiagnostics(el, { relays: buildOptions(dopts).relays.map(function (x) { return { name: x.name, url: x.url, ok: null }; }) });
    return diagnose(o);
  }

  /* ====================================================================================
   * 8. Export
   * ==================================================================================== */

  var HGNet = {
    version: VERSION,
    create: function (opts) { return new Net(opts); },
    diagnose: diagnose,
    renderDiagnostics: renderDiagnostics,
    // HGNet.every(ms, fn) -> stop(): like setInterval, but keeps its pace in a background tab (where Chrome
    // runs normal timers only once a second, and after 5 minutes only once a minute). Use it for a host's
    // simulation / snapshot loop. fn gets the milliseconds since its previous call.
    every: function (ms, fn) { if (typeof fn !== 'function') throw new Error('HGNet.every(ms, fn): fn must be a function'); return every(ms, fn); },
    isValidCode: function (code) { return /^\d{6}$/.test(normCode(code)); },
    defaults: { relays: DEFAULT_RELAYS, iceServers: DEFAULT_ICE, timings: DEFAULTS, limits: LIMITS, libs: LIB_URLS }
  };
  root.HGNet = HGNet;
})(typeof window !== 'undefined' ? window : this);
