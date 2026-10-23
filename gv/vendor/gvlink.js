// GVLink — reach the Grapevine server over public MQTT relays instead of WebRTC.
// Shared by client.html and the launcher's Grapevine Lite. Needs HGNet (relay/hgnet.js)
// and an Ed25519 verifier. The server half is relay/server.js; read its header for the
// wire format. Returns an object shaped like a PeerJS DataConnection (peer, open, send,
// close, on('open'|'data'|'close'|'error')) so the code above it does not care which
// transport it is on.
const GVLink = (() => {
  'use strict';
  const MQTT = {
    // Byte-for-byte the mqtt@5.10.1 build the server runs. The browser refuses it if it differs.
    urls: ['https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js', 'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js'],
    sri: 'sha384-u4uqeACkFcoKl57rBQJHVGDd1pqhW4w8X3WjTu1ZksPdxoLqdt34jpoNkJisE25W'
  };
  const te = new TextEncoder(), td = new TextDecoder();
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const hex = u8 => Array.from(u8, b => b.toString(16).padStart(2, '0')).join('');
  const sha256hex = async s => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(s))));
  const nonce = (dir, n) => { const b = new Uint8Array(12); b[0] = dir; new DataView(b.buffer).setBigUint64(4, BigInt(n)); return b; };

  // Same derivation as relay/server.js: nothing to configure on either side.
  async function address(archiveId, shard) {
    const game = 'gv-' + (await sha256hex('gv-relay|' + archiveId)).slice(0, 10);
    const code = String(100000 + (parseInt((await sha256hex(`gv-relay|${archiveId}|${shard}`)).slice(0, 8), 16) % 900000));
    return { game, code };
  }

  let mqttP = null;
  function loadMqtt() {
    if (window.mqtt) return Promise.resolve();
    if (mqttP) return mqttP;
    // The page may already have started the download (window.__gvMqtt) while other things loaded; wait for that first.
    mqttP = (window.__gvMqtt || Promise.resolve()).then(() => window.mqtt ? undefined : fetchMqtt());
    mqttP.catch(() => { mqttP = null; });
    return mqttP;
  }
  function fetchMqtt() {
    return new Promise((resolve, reject) => {
      let i = 0;
      (function next() {
        if (window.mqtt) return resolve();
        if (i >= MQTT.urls.length) return reject(new Error('could not load the relay library'));
        const s = document.createElement('script');
        s.src = MQTT.urls[i++]; s.integrity = MQTT.sri; s.crossOrigin = 'anonymous';
        const t = setTimeout(() => { s.onload = s.onerror = null; next(); }, 12000);
        s.onload = () => { clearTimeout(t); next(); };
        s.onerror = () => { clearTimeout(t); next(); };
        document.head.appendChild(s);
      })();
    });
  }

  function emitter(o) {
    const h = {};
    o.on = (ev, fn) => ((h[ev] = h[ev] || []).push(fn), o);
    o.off = (ev, fn) => { h[ev] = (h[ev] || []).filter(f => f !== fn); return o; };
    o.emit = (ev, ...a) => { for (const f of (h[ev] || []).slice()) { try { f(...a); } catch (e) { console.error(e); } } };
    return o;
  }
  const shuffled = n => { const a = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // opts: { shards (2), pinned (hex server key or ''), verify(pubHex, msg, sigHex) -> Promise<bool>,
  //         relays (override), urlParams (false), onStatus(text) }
  function connect(archiveId, opts) {
    opts = opts || {};
    const conn = emitter({ peer: archiveId, open: false, relay: true, pid: '', serverPub: '', metadata: { role: 'client' }, status: '', marks: [] });
    // Where the time goes, step by step (milliseconds since the connection was asked for). Shown in the launcher's Connection tab.
    const t0 = Date.now(), mark = name => conn.marks.push([name, Date.now() - t0]);
    mark('start');
    const early = [];
    let net = null, key = null, tx = 0, rx = 0, dead = false, sendQ = Promise.resolve(), rxQ = Promise.resolve();
    const say = t => { conn.status = t; try { opts.onStatus && opts.onStatus(t); } catch (e) {} conn.emit('status', t); };
    const finish = (why, errType) => {
      if (dead) return; dead = true;
      conn.open = false;
      try { net && net.close(); } catch (e) {}
      if (errType) conn.emit('error', { type: errType, message: why });
      conn.emit('close', why);
    };
    conn.close = () => finish('closed');
    conn.send = obj => {
      if (!conn.open || dead) throw new Error('link closed');
      const n = ++tx, text = JSON.stringify(obj);
      sendQ = sendQ.then(async () => {
        if (dead) return;
        const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce(0, n) }, key, te.encode(text)));
        net.send('host', { k: 'd', n, c: b64(ct) });
      }).catch(e => { console.warn('relay send:', e && e.message); });
    };

    (async () => {
      say('loading relay library…');
      await loadMqtt(); mark('relay library ready');
      if (!window.HGNet) throw new Error('relay code missing');
      const nshards = Math.max(1, Math.min(Number(opts.shards) || 2, 8));
      let joined = null, lastErr = null;
      // Shard 0 first, always: it is the one the server fills first, and a shard that is not there costs a full wait
      // before the next one is tried. Later shards are only for when shard 0 is full.
      for (let i = 0; i < nshards; i++) {
        if (dead) return;
        const { game, code } = await address(archiveId, i);
        const n = window.HGNet.create({ game, forceRelay: true, peer: false, resume: false, notFoundMs: 3500,
          urlParams: opts.urlParams === true, relays: opts.relays || undefined });
        n.on('status', t => say(t));
        try { await n.join(code, { name: 'gv' }); joined = n; mark('joined room ' + i); break; }
        catch (e) { lastErr = e; try { n.close(); } catch (x) {} if (e && (e.code === 'blocked' || e.code === 'closed')) break; }
      }
      if (dead) { try { joined && joined.close(); } catch (e) {} return; }
      if (!joined) {
        const e = lastErr || new Error('no server');
        return finish(e.code === 'blocked' ? 'blocked' : 'no-server', e.code === 'blocked' ? 'blocked' : 'peer-unavailable');
      }
      net = joined;
      net.on('closed', (reason) => finish(reason || 'closed'));

      // ---- key exchange ----
      say('securing the link…'); mark('key exchange');
      const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
      const cpub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
      const cpubB64 = b64(cpub);
      const reply = new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('server did not answer')), 12000);
        net.on('message', (peer, m) => {
          if (!m || typeof m !== 'object') return;
          if (m.k === 'ke' && !key) { clearTimeout(t); resolve(m); }
          else if (m.k === 'nk') finish('reset');
          else if (m.k === 'd') { if (key) onData(m); else early.push(m); }   // the challenge can beat our key derivation
        });
      });
      net.send('host', { k: 'ke', v: 1, pub: cpubB64 });
      const m = await reply;
      const spubB64 = String(m.pub || ''), pid = String(m.pid || ''), spub = String(m.spub || '');
      if (!/^rl-[0-9a-f]{12}$/.test(pid) || !/^[0-9a-f]{64}$/.test(spub)) throw new Error('bad key exchange');
      if (opts.pinned && opts.pinned !== spub) return finish('not-pinned', 'link-key');
      if (!(await opts.verify(spub, `gv-link|${cpubB64}|${spubB64}|${pid}`, String(m.sig || '')))) return finish('bad-signature', 'link-key');
      const spubKey = await crypto.subtle.importKey('raw', unb64(spubB64), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
      const secret = await crypto.subtle.deriveBits({ name: 'ECDH', public: spubKey }, kp.privateKey, 256);
      const hk = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
      key = await crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: te.encode(`gv-link|${cpubB64}|${spubB64}|${pid}`) },
        hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      conn.pid = pid; conn.serverPub = spub;
      conn.open = true; mark('link secured');
      say('connected through relay');
      early.splice(0).forEach(onData);
      conn.emit('open');
    })().catch(e => finish(String(e && e.message || e), 'network'));

    function onData(m) {
      if (!Number.isSafeInteger(m.n) || typeof m.c !== 'string') return;
      rxQ = rxQ.then(async () => {
        if (dead || m.n <= rx) return;
        let obj;
        try { obj = JSON.parse(td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce(1, m.n) }, key, unb64(m.c)))); }
        catch (e) { return; }       // forged or damaged: ignored
        rx = m.n;
        conn.emit('data', obj);
      });
    }
    return conn;
  }

  // For /diag: which relays can this network reach?
  async function diagnose(opts) {
    await loadMqtt();
    return window.HGNet.diagnose(Object.assign({ game: 'gv-diag', urlParams: false }, opts || {}));
  }

  return { connect, address, diagnose, loadMqtt, MQTT };
})();
