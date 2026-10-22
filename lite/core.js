// Grapevine Lite - core. Your normal Grapevine account inside the launcher.
//
// It signs in to the real Grapevine server with the same recovery key, over the same encrypted relay
// link the full app uses on school networks (GVLink, see vendor/gvlink.js), and exposes a small API,
// window.HGLite, that the launcher UI and every game with multiplayer can use:
//   HGLite.me()                      -> { name, userId, pub, status } or null when nobody is signed in
//   HGLite.on('change'|'friends'|'status', fn)
//   HGLite.friendState(name)         -> 'self' | 'friend' | 'incoming' | 'outgoing' | 'none'
//   HGLite.addFriend(name)           -> Promise (a friend request in main Grapevine, or an accept)
//   HGLite.newChallenge()            -> random string a host gives to a joining player
//   HGLite.prove(challenge, context) -> Promise<{ n, k, t, s }|null>  "I am <name>", signed with the account key
//   HGLite.check(proof, challenge, context) -> Promise<{ ok, name, reason }>  verified against the server
// Everything here only ever talks to Grapevine's server; nothing is sent to a game.
(function () {
  'use strict';
  if (window.HGLite) return;

  var CFG = Object.assign({
    // Must match client.html's CONFIG in the Grapevine repo (archiveIds and serverPubs).
    archives: ['grapevine-a-f9c20eec06f3', 'grapevine-b-ae8b586e0081'],
    pinned: { 'grapevine-a-f9c20eec06f3': '114bee3b10b7d63870478007f5008b1dc5230389e4f5ad0786ef68b86a408ba0' },
    shards: 2,
    relays: undefined,          // tests point this at a local broker
    clientVersion: 'v12'
  }, window.HG_LITE_CONFIG || {});

  // ---- storage that never throws ----
  var mem = {};
  var store = {
    get: function (k) { try { var v = localStorage.getItem('hglite:' + k); return v === null ? (mem[k] === undefined ? null : mem[k]) : v; } catch (e) { return mem[k] === undefined ? null : mem[k]; } },
    set: function (k, v) { mem[k] = String(v); try { localStorage.setItem('hglite:' + k, String(v)); } catch (e) {} },
    del: function (k) { delete mem[k]; try { localStorage.removeItem('hglite:' + k); } catch (e) {} }
  };
  var te = new TextEncoder();
  var randHex = function (n) { return ED.hex(crypto.getRandomValues(new Uint8Array(n))); };
  var sha256hex = function (s) { return crypto.subtle.digest('SHA-256', te.encode(s)).then(function (d) { return ED.hex(new Uint8Array(d)); }); };
  var newKey = function () { return btoa(String.fromCharCode.apply(null, crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };

  // ---- state ----
  var st = {
    key: '', userId: '', name: '', pub: '', kp: null, conn: null, ready: false,
    status: 'signed-out', text: '', friends: [], incoming: [], outgoing: [], haveFriends: false,
    signup: false, wanted: '', invite: '', sendKey: false, cnonce: '', welcomeOk: false,
    idx: 0, fails: 0, timer: null, ping: null, lastHeard: 0, auth: null, pending: [], lookups: {}, gen: 0
  };
  var handlers = {};
  function on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); return function () { off(ev, fn); }; }
  function off(ev, fn) { handlers[ev] = (handlers[ev] || []).filter(function (f) { return f !== fn; }); }
  function emit(ev, a) { (handlers[ev] || []).slice().forEach(function (f) { try { f(a); } catch (e) { console.error(e); } }); }
  function setStatus(s, t) { st.status = s; st.text = t || ''; emit('status', { status: s, text: st.text }); emit('change'); }

  // ---- connection ----
  var FATAL = { 'no-account': 1, 'bad-key': 1, 'banned': 1, 'name-taken': 1, 'bad-invite': 1, 'pow': 1, 'bad-sig': 1, 'old-client': 1, 'reg-limit': 1, 'flood': 1 };

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function connect() {
    if (!st.key || st.conn || st.timer) return;
    var gen = st.gen;
    var id = CFG.archives[st.idx % CFG.archives.length];
    setStatus('connecting', 'Connecting to Grapevine...');
    var c;
    try {
      c = GVLink.connect(id, {
        shards: CFG.shards, relays: CFG.relays, pinned: CFG.pinned[id] || '',
        verify: function (pub, msg, sig) { return ED.verify(pub, msg, sig); },
        onStatus: function (t) { if (st.conn === c && !st.ready) setStatus('connecting', t); }
      });
    } catch (e) { console.error(e); return retrySoon(); }
    st.conn = c; st.ready = false; st.welcomeOk = false; st.lastHeard = Date.now();
    var opened = false;
    c.on('open', function () { opened = true; st.fails = 0; });
    c.on('data', function (m) { if (st.conn === c && gen === st.gen) onFrame(c, m); });
    c.on('error', function (e) { console.warn('grapevine link:', e && e.type, e && e.message); });
    c.on('close', function (why) {
      if (st.conn !== c) return;
      st.conn = null; st.ready = false; clearInterval(st.ping);
      if (!st.key) return;
      if (!opened) { st.idx++; st.fails++; }
      if (st.auth && st.fails >= CFG.archives.length * 2 && !opened) failAuth(new Error(why === 'blocked' ? 'This network blocks the Grapevine relay servers.' : 'Could not reach the Grapevine server.'));
      setStatus(st.auth ? 'connecting' : 'offline', st.auth ? 'Reconnecting...' : 'Offline - trying again');
      retrySoon();
    });
  }

  function retrySoon() {
    if (st.timer || !st.key) return;
    var wait_ = Math.min(1000 * Math.pow(2, Math.min(st.fails, 5)), 20000) * (0.6 + Math.random() * 0.8);
    st.timer = setTimeout(function () { st.timer = null; connect(); }, wait_);
  }

  function drop() {            // sign out / switch account: nothing may linger
    st.gen++;
    clearTimeout(st.timer); st.timer = null; clearInterval(st.ping);
    var c = st.conn; st.conn = null; st.ready = false;
    try { c && c.close(); } catch (e) {}
  }

  function send(frame) {
    if (!st.conn || !st.conn.open) return false;
    try { st.conn.send(frame); return true; } catch (e) { return false; }
  }

  function failAuth(err) {
    var a = st.auth; st.auth = null;
    if (a) a.reject(err);
  }

  async function answerChallenge(c, m) {
    var archiveId = c.peer;
    var chalOk = typeof m.serverPub === 'string' && typeof m.sig === 'string' &&
      await ED.verify(m.serverPub, 'gv-challenge|' + m.nonce + '|' + c.pid, m.sig);
    var pinned = CFG.pinned[archiveId], known = store.get('srv:' + archiveId);
    var why = !chalOk ? 'did not prove who it is' : (pinned && pinned !== m.serverPub) ? 'is not the server this launcher was built for' : (known && known !== m.serverPub) ? 'is not the server you signed in to before' : '';
    if (why) { var e = new Error('The Grapevine server ' + why + '. Nothing was sent to it.'); e.fatal = true; failAuth(e); drop(); setStatus('error', e.message); return; }
    st.cnonce = randHex(16);
    var sig = ED.hex(await ED.sign(st.kp, 'gv-login|' + archiveId + '|' + m.nonce + '|' + c.pid + '|' + st.cnonce));
    var hello = { type: 'hello', v: 12, userId: st.userId, pub: st.pub, sig: sig, cnonce: st.cnonce, signup: st.signup,
      client: CFG.clientVersion, rl: 1, lite: 1 };
    if (st.signup) {
      hello.displayName = st.wanted || undefined;
      hello.invite = st.invite || undefined;
      if (m.pow > 0) { setStatus('connecting', 'Preparing your account...'); hello.pow = await proofOfWork(m.nonce + ':' + st.pub + ':', m.pow); }
    } else if (st.sendKey) hello.key = st.key;     // an account from before signed sign-in binds its key once
    if (st.conn === c && c.open) { try { c.send(hello); } catch (e2) {} }
  }

  async function onFrame(c, m) {
    if (!m || typeof m !== 'object') return;
    st.lastHeard = Date.now();
    switch (m.type) {
      case 'challenge': return answerChallenge(c, m);
      case 'welcome': {
        var ok = typeof m.serverPub === 'string' && typeof m.sig === 'string' &&
          await ED.verify(m.serverPub, 'gv-welcome|' + st.cnonce + '|' + c.pid + '|' + m.userId, m.sig);
        var pinned = CFG.pinned[c.peer], known = store.get('srv:' + c.peer);
        if (!ok || (pinned && pinned !== m.serverPub) || (known && known !== m.serverPub)) {
          var e = new Error('The Grapevine server could not prove who it is. Nothing more was sent.'); failAuth(e); drop(); setStatus('error', e.message); return;
        }
        if (!known) store.set('srv:' + c.peer, m.serverPub);
        if (st.conn !== c) return;
        st.welcomeOk = true; st.ready = true; st.sendKey = false;
        st.userId = m.userId; st.name = m.displayName || st.name;
        store.set('name', st.name);
        st.signup = false;
        setStatus('online', 'Connected to Grapevine');
        clearInterval(st.ping);
        st.ping = setInterval(function () {
          if (!st.ready) return;
          if (Date.now() - st.lastHeard > 25000) { try { c.close(); } catch (e3) {} return; }
          send({ type: 'ping' });
        }, 8000);
        send({ type: 'friendsList' });
        var a = st.auth; st.auth = null; if (a) a.resolve({ name: st.name, userId: st.userId });
        return;
      }
      case 'friends':
        st.friends = (m.friends || []).map(function (f) { return { name: f.name, userId: f.userId, online: !!f.online }; });
        st.incoming = (m.incoming || []).map(function (f) { return { name: f.name, userId: f.userId, at: f.at }; });
        st.outgoing = (m.outgoing || []).map(function (f) { return { name: f.name, userId: f.userId, at: f.at }; });
        st.haveFriends = true;
        store.set('friends', JSON.stringify({ f: st.friends, i: st.incoming, o: st.outgoing }));
        settlePending(null);
        emit('friends'); emit('change');
        return;
      case 'profile': {
        var cb = st.lookups[m.name];
        if (cb) { delete st.lookups[m.name]; cb.forEach(function (f) { f(m); }); }
        return;
      }
      case 'error': return onError(c, m);
      case 'pong': return;
    }
  }

  function onError(c, m) {
    var code = m.code || '';
    if (code === 'rate') { settlePending(new Error('Slow down a little.')); return; }
    if (code === 'rebind' && !st.sendKey && st.auth) { st.sendKey = true; try { c.close(); } catch (e) {} return; }   // retry once, sending the key to bind it
    if (code === 'full') { st.idx++; try { c.close(); } catch (e) {} return; }
    if (code === 'no-such-name') {
      // a failed profile lookup or friend request: tell whoever asked
      Object.keys(st.lookups).forEach(function (n) { var cbs = st.lookups[n]; delete st.lookups[n]; cbs.forEach(function (f) { f(null); }); });
    }
    if (FATAL[code] || (st.auth && !st.ready)) {
      var err = new Error(m.text || code); err.code = code;
      failAuth(err);
      if (FATAL[code]) { drop(); setStatus('error', err.message); }
      return;
    }
    settlePending(new Error(m.text || code));
  }

  // friend operations resolve when the server's next friends picture arrives, or fail with its refusal
  function settlePending(err) {
    var p = st.pending.shift();
    if (!p) return;
    clearTimeout(p.t);
    if (err) p.reject(err); else p.resolve();
    if (!err) while (st.pending.length) { var q = st.pending.shift(); clearTimeout(q.t); q.resolve(); }
  }
  function friendOp(type, name) {
    name = String(name || '').trim();
    if (!name) return Promise.reject(new Error('Type a name first.'));
    if (!st.ready) return Promise.reject(new Error('Not connected to Grapevine yet.'));
    return new Promise(function (resolve, reject) {
      var p = { resolve: resolve, reject: reject, t: setTimeout(function () { var i = st.pending.indexOf(p); if (i >= 0) st.pending.splice(i, 1); reject(new Error('Grapevine did not answer. Try again.')); }, 9000) };
      st.pending.push(p);
      if (!send({ type: type, name: name })) { clearTimeout(p.t); st.pending.splice(st.pending.indexOf(p), 1); reject(new Error('Not connected to Grapevine yet.')); }
    });
  }

  // ---- sign in / up / out ----
  async function begin(key, signup, name, invite, soft) {
    key = String(key || '').trim();
    if (key.length < 32 || key.length > 200) throw new Error('That does not look like a recovery key.');
    if (!window.crypto || !crypto.subtle) throw new Error('Needs a secure (https) page.');
    drop();
    st.key = key; st.signup = !!signup; st.wanted = String(name || '').trim().slice(0, 24); st.invite = String(invite || '').trim();
    st.sendKey = false; st.friends = []; st.incoming = []; st.outgoing = []; st.haveFriends = false;
    st.userId = await sha256hex(key);
    var seed = new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode('gv-seed|' + key)));
    st.kp = await ED.keypair(seed); st.pub = ED.hex(st.kp.pub);
    st.fails = 0; st.idx = Math.floor(Math.random() * CFG.archives.length);
    var done = new Promise(function (resolve, reject) { st.auth = { resolve: resolve, reject: reject }; });
    connect();
    var t = setTimeout(function () { failAuth(new Error('Grapevine did not answer. Check /diag in Grapevine or try again on another network.')); }, 60000);
    try { var r = await done; clearTimeout(t); store.set('key', key); store.set('name', r.name); return r; }
    catch (e) {
      clearTimeout(t);
      var fatal = e.fatal || (e.code && FATAL[e.code]);
      if (soft && !fatal) return null;          // a saved account on a bad network keeps trying in the background
      drop(); st.key = '';
      if (!e.fatal) setStatus('signed-out', '');
      throw e;
    }
  }
  function signIn(key) { return begin(key, false); }
  function signUp(key, name, invite) { return begin(key, true, name, invite); }
  function signOut() {
    drop(); st.key = ''; st.userId = ''; st.name = ''; st.pub = ''; st.kp = null; st.friends = []; st.incoming = []; st.outgoing = []; st.haveFriends = false;
    ['key', 'name', 'friends'].forEach(store.del);
    setStatus('signed-out', ''); emit('friends');
  }
  // a saved session comes back by itself
  function resume() {
    var k = store.get('key');
    if (!k || st.key) return Promise.resolve(null);
    st.name = store.get('name') || '';
    try { var f = JSON.parse(store.get('friends') || 'null'); if (f) { st.friends = (f.f || []).map(function (x) { x.online = false; return x; }); st.incoming = f.i || []; st.outgoing = f.o || []; } } catch (e) {}
    return begin(k, false, '', '', true).catch(function (e) { if (e && e.code === 'no-account') { signOut(); } return null; });
  }

  // ---- a compact SHA-256 for the sign-up proof (WebCrypto is too slow per call for ~65k digests) ----
  var SHA256 = (function () {
    var K = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
    var W = new Uint32Array(64);
    return function (bytes) {
      var len = bytes.length, bits = len * 8, padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
      padded.set(bytes); padded[len] = 0x80;
      var dv = new DataView(padded.buffer); dv.setUint32(padded.length - 4, bits >>> 0); dv.setUint32(padded.length - 8, Math.floor(bits / 0x100000000));
      var h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
      for (var off = 0; off < padded.length; off += 64) {
        var i;
        for (i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4);
        for (i = 16; i < 64; i++) { var a1 = W[i-15], b1 = W[i-2];
          W[i] = (W[i-16] + (((a1>>>7)|(a1<<25)) ^ ((a1>>>18)|(a1<<14)) ^ (a1>>>3)) + W[i-7] + (((b1>>>17)|(b1<<15)) ^ ((b1>>>19)|(b1<<13)) ^ (b1>>>10))) | 0; }
        var a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
        for (i = 0; i < 64; i++) {
          var t1 = (h + (((e>>>6)|(e<<26)) ^ ((e>>>11)|(e<<21)) ^ ((e>>>25)|(e<<7))) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
          var t2 = ((((a>>>2)|(a<<30)) ^ ((a>>>13)|(a<<19)) ^ ((a>>>22)|(a<<10))) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
          h=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
        }
        h0=(h0+a)|0;h1=(h1+b)|0;h2=(h2+c)|0;h3=(h3+d)|0;h4=(h4+e)|0;h5=(h5+f)|0;h6=(h6+g)|0;h7=(h7+h)|0;
      }
      var out = new Uint8Array(32), ov = new DataView(out.buffer);
      [h0,h1,h2,h3,h4,h5,h6,h7].forEach(function (v, j) { ov.setUint32(j * 4, v >>> 0); });
      return out;
    };
  })();
  async function proofOfWork(prefix, bits) {
    for (var n = 0; ; n++) {
      var nonce = n.toString(36), h = SHA256(te.encode(prefix + nonce)), zeros = 0;
      for (var i = 0; i < h.length; i++) { if (h[i] === 0) { zeros += 8; continue; } zeros += Math.clz32(h[i]) - 24; break; }
      if (zeros >= bits) return nonce;
      if ((n & 2047) === 0) await wait(0);
    }
  }

  // ---- who is this person? (for games) ----
  function lookupPub(name) {
    return new Promise(function (resolve) {
      var hit = lookupCache[name];
      if (hit && Date.now() - hit.at < 120000) return resolve(hit.pub);
      if (!st.ready) return resolve(null);
      var list = st.lookups[name] = st.lookups[name] || [];
      var t = setTimeout(function () { var i = list.indexOf(fn); if (i >= 0) list.splice(i, 1); resolve(null); }, 6000);
      function fn(m) { clearTimeout(t); var pub = m && m.pub ? String(m.pub) : null; if (pub) lookupCache[name] = { pub: pub, at: Date.now() }; resolve(pub); }
      list.push(fn);
      if (list.length === 1) send({ type: 'profileGet', name: name });
    });
  }
  var lookupCache = {};
  var proofMsg = function (context, challenge, name, ts) { return 'gv-game|' + context + '|' + challenge + '|' + name + '|' + ts; };

  async function prove(challenge, context) {
    if (!st.kp || !st.name) return null;
    var t = Date.now();
    var s = ED.hex(await ED.sign(st.kp, proofMsg(context, challenge, st.name, t)));
    return { n: st.name, k: st.pub, t: t, s: s };
  }
  async function check(proof, challenge, context) {
    try {
      if (!proof || typeof proof.n !== 'string' || typeof proof.k !== 'string' || typeof proof.s !== 'string' || typeof proof.t !== 'number') return { ok: false, reason: 'none' };
      if (Math.abs(Date.now() - proof.t) > 5 * 60000) return { ok: false, reason: 'stale' };
      if (!(await ED.verify(proof.k, proofMsg(context, challenge, proof.n, proof.t), proof.s))) return { ok: false, reason: 'bad-signature' };
      if (!st.ready) return { ok: false, reason: 'offline', name: proof.n };
      var pub = await lookupPub(proof.n);
      if (!pub) return { ok: false, reason: 'unknown', name: proof.n };
      if (pub !== proof.k) return { ok: false, reason: 'impostor', name: proof.n };
      return { ok: true, name: proof.n };
    } catch (e) { return { ok: false, reason: 'error' }; }
  }

  // ---- people met in games ----
  function recent() { try { return JSON.parse(store.get('met') || '[]'); } catch (e) { return []; } }
  function noteMet(name, game) {
    name = String(name || '').slice(0, 24);
    if (!name || name === st.name) return;
    var list = recent().filter(function (r) { return r.name !== name; });
    list.unshift({ name: name, game: String(game || '').slice(0, 40), at: Date.now() });
    store.set('met', JSON.stringify(list.slice(0, 40)));
    emit('met');
  }

  function friendState(name) {
    if (!name) return 'none';
    if (name === st.name) return 'self';
    if (st.friends.some(function (f) { return f.name === name; })) return 'friend';
    if (st.incoming.some(function (f) { return f.name === name; })) return 'incoming';
    if (st.outgoing.some(function (f) { return f.name === name; })) return 'outgoing';
    return 'none';
  }

  window.HGLite = {
    version: 1,
    config: CFG,
    me: function () { return st.name ? { name: st.name, userId: st.userId, pub: st.pub, status: st.status } : null; },
    status: function () { return { status: st.status, text: st.text }; },
    online: function () { return st.ready; },
    friends: function () { return { friends: st.friends.slice(), incoming: st.incoming.slice(), outgoing: st.outgoing.slice(), loaded: st.haveFriends }; },
    friendState: friendState,
    addFriend: function (n) { return friendOp('friendRequest', n); },
    acceptFriend: function (n) { return friendOp('friendAccept', n); },
    declineFriend: function (n) { return friendOp('friendDecline', n); },
    removeFriend: function (n) { return friendOp('friendRemove', n); },
    newKey: newKey,
    signIn: signIn, signUp: signUp, signOut: signOut, resume: resume,
    key: function () { return st.key; },
    newChallenge: function () { return randHex(12); },
    prove: prove, check: check,
    recent: recent, noteMet: noteMet,
    on: on, off: off,
    ready: function () { return readyP; },
    diagnose: function () { return GVLink.diagnose({ relays: CFG.relays }); }
  };
  var readyP = Promise.resolve();
})();
