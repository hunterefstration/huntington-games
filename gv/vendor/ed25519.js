// ---- Ed25519, in ~120 lines ------------------------------------------------
// RFC 8032, plain BigInt arithmetic, SHA-512 from WebCrypto. No library, no
// browser flag, deterministic from a 32-byte seed — which is exactly what the
// recovery key already is once hashed. Checked against Node's native Ed25519
// on RFC test vectors in test/ed25519.mjs. Everything is async because the
// hash is; nothing here is on a hot path (a signature per message, at most).
const ED = (() => {
  const P = (1n << 255n) - 19n;
  const L = (1n << 252n) + 27742317777372353535851937790883648493n;
  const mod = (a, m = P) => { const r = a % m; return r >= 0n ? r : r + m; };
  const pow = (b, e, m = P) => { let r = 1n; b = mod(b, m); while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; };
  const inv = a => pow(a, P - 2n);
  const D = mod(-121665n * inv(121666n));
  const SQRT_M1 = pow(2n, (P - 1n) / 4n);
  const G = { x: 15112221349535400772501151409588531511454012693041857206046113283949847762202n,
              y: 46316835694926478169428394003475163141307993866256225615783033603165251855960n };
  // extended coordinates (X, Y, Z, T), a = -1
  const ext = p => ({ X: p.x, Y: p.y, Z: 1n, T: mod(p.x * p.y) });
  const ZERO = { X: 0n, Y: 1n, Z: 1n, T: 0n };
  const add = (p, q) => {
    const A = mod((p.Y - p.X) * (q.Y - q.X)), B = mod((p.Y + p.X) * (q.Y + q.X));
    const C = mod(p.T * 2n * D * q.T), Dd = mod(p.Z * 2n * q.Z);
    const E = B - A, F = Dd - C, Gg = Dd + C, H = B + A;
    return { X: mod(E * F), Y: mod(Gg * H), Z: mod(F * Gg), T: mod(E * H) };
  };
  const dbl = p => {
    const A = mod(p.X * p.X), B = mod(p.Y * p.Y), C = mod(2n * p.Z * p.Z);
    const H = A + B, E = H - mod((p.X + p.Y) * (p.X + p.Y)), Gg = A - B, F = C + Gg;
    return { X: mod(E * F), Y: mod(Gg * H), Z: mod(F * Gg), T: mod(E * H) };
  };
  const mul = (p, n) => { let r = ZERO, b = p; while (n > 0n) { if (n & 1n) r = add(r, b); b = dbl(b); n >>= 1n; } return r; };
  const affine = p => { const zi = inv(p.Z); return { x: mod(p.X * zi), y: mod(p.Y * zi) }; };
  const b2n = b => { let n = 0n; for (let i = b.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(b[i]); return n; };   // little-endian
  const n2b = (n, len = 32) => { const b = new Uint8Array(len); for (let i = 0; i < len; i++) { b[i] = Number(n & 255n); n >>= 8n; } return b; };
  const encode = p => { const a = affine(p); const b = n2b(a.y); b[31] |= Number(a.x & 1n) << 7; return b; };
  const decode = b => {
    if (b.length !== 32) return null;
    const sign = b[31] >> 7; const yb = b.slice(); yb[31] &= 127; const y = b2n(yb);
    if (y >= P) return null;
    const y2 = mod(y * y), u = mod(y2 - 1n), v = mod(D * y2 + 1n);
    let x = mod(pow(u * inv(v), (P + 3n) / 8n));
    if (mod(x * x - u * inv(v)) !== 0n) x = mod(x * SQRT_M1);
    if (mod(x * x - u * inv(v)) !== 0n) return null;
    if (x === 0n && sign) return null;
    if (Number(x & 1n) !== sign) x = P - x;
    return ext({ x, y });
  };
  const cat = (...arrs) => { const n = arrs.reduce((a, c) => a + c.length, 0); const o = new Uint8Array(n); let i = 0; for (const a of arrs) { o.set(a, i); i += a.length; } return o; };
  const sha512 = async b => new Uint8Array(await crypto.subtle.digest('SHA-512', b));
  const clamp = h => { const a = h.slice(0, 32); a[0] &= 248; a[31] &= 127; a[31] |= 64; return b2n(a); };
  const hex = b => [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  const unhex = h => { if (typeof h !== 'string' || h.length % 2 || /[^0-9a-f]/i.test(h)) return null; const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; };
  const bytes = s => typeof s === 'string' ? new TextEncoder().encode(s) : s;

  async function keypair(seed){                         // seed: 32 bytes
    const h = await sha512(seed);
    const a = clamp(h);
    return { seed, a, prefix: h.slice(32), pub: encode(mul(ext(G), a)) };
  }
  async function sign(kp, msg){
    const M = bytes(msg);
    const r = mod(b2n(await sha512(cat(kp.prefix, M))), L);
    const R = encode(mul(ext(G), r));
    const k = mod(b2n(await sha512(cat(R, kp.pub, M))), L);
    return cat(R, n2b(mod(r + k * kp.a, L)));
  }
  async function verify(pub, msg, sig){
    try {
      pub = typeof pub === 'string' ? unhex(pub) : pub; sig = typeof sig === 'string' ? unhex(sig) : sig;
      if (!pub || !sig || sig.length !== 64) return false;
      const A = decode(pub), R = decode(sig.slice(0, 32)); if (!A || !R) return false;
      const s = b2n(sig.slice(32)); if (s >= L) return false;
      const k = mod(b2n(await sha512(cat(sig.slice(0, 32), pub, bytes(msg)))), L);
      const lhs = encode(mul(ext(G), s)), rhs = encode(add(R, mul(A, k)));
      return hex(lhs) === hex(rhs);
    } catch (e) { return false; }
  }
  return { keypair, sign, verify, hex, unhex, bytes };
})();
