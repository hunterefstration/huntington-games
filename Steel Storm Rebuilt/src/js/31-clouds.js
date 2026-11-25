// ============================================================
// THE SKY OVER THE ISLAND: real clouds and the light they make. (The owner, 2026-11-25: "change steel storm to now have the
// realistic lighting. I want realistic volumetric clouds. See if you can get it to work with little performance cost".)
//   sky      drawn by its own shader on the old sky sphere (the island file's painted dome is hidden): blue overhead, the
//            island's own haze colour at the horizon (so the fog meets it), a halo round the sun and the sun's disc
//   clouds   a layer of cumulus 950 to 1650 m up, MARCHED through per pixel (a few steps, each one lit by one or two looks
//            towards the sun): lit tops, grey bellies, a silver edge with the sun behind them. Only sky pixels pay (the
//            sky is drawn last, behind everything). The shapes come from one 256 px noise picture made here, read at three
//            sizes, the middle one slid with height so the heaps are 3D. Wind moves them.
//   shadows  the same clouds darken the baked ground where they cover the sun (a hook on the island's light-map shader),
//            and the vehicles' sun dims when the camera's spot is under one (one look at the noise on the processor)
//   shafts   HG3D rays(): the sky is written with no cover so the pass can tell it from the ground; light breaks through
//            the gaps between clouds and round the hills (every quality but LOW)
// Cost by quality (sky pixels only): LOW 6 steps, no look towards the sun; MEDIUM 12 steps, one look; HIGH 20 steps, two
// looks and fine detail. ?clouds=0 turns the clouds off.
// ============================================================
const SKYC = { on: false, srgb: true, mat: null, old: null, tex: null, px: null, N: 256, t: 0, wind: [7, 2.5], sun: 1, U: null, ray: { x: .5, y: .5, strength: 0, color: [1, .95, .85], size: .5, density: .85, decay: .93, reach: .45 } };
// per weather: coverage (0..1), density, base height, thickness, how strong the shafts are
const SKYC_WX = { noon: { cov: .47, den: .032, base: 950, thick: 700, rays: .5 }, evening: { cov: .5, den: .03, base: 1000, thick: 650, rays: 1 },
    overcast: { cov: .86, den: .05, base: 700, thick: 900, rays: .25 }, night: { cov: .45, den: .03, base: 950, thick: 700, rays: .35 } };

// one picture, repeating without a seam: r = wide cover (soft lumps), g = heaped puffs (cells), b = fine detail
SKYC.noise = function () {
    const N = SKYC.N, px = new Uint8Array(N * N * 4); let seed = 777; const R = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const lat = P => { const g = new Float32Array(P * P); for (let i = 0; i < g.length; i++) g[i] = R(); return g; };
    const val = (g, P, x, y) => { const fx = x * P / N, fy = y * P / N, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const a = g[(iy % P) * P + ix % P], b = g[(iy % P) * P + (ix + 1) % P], c = g[((iy + 1) % P) * P + ix % P], d = g[((iy + 1) % P) * P + (ix + 1) % P]; return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy; };
    const cells = P => { const p = new Float32Array(P * P * 2); for (let i = 0; i < P * P; i++) { p[i * 2] = R(); p[i * 2 + 1] = R(); } return p; };
    const worley = (p, P, x, y) => { const fx = x * P / N, fy = y * P / N, ix = Math.floor(fx), iy = Math.floor(fy); let m = 9;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const cx = ix + i, cy = iy + j, k = (((cy % P) + P) % P) * P + (((cx % P) + P) % P), dx = cx + p[k * 2] - fx, dy = cy + p[k * 2 + 1] - fy; m = Math.min(m, dx * dx + dy * dy); }
        return Math.sqrt(m); };
    const L4 = lat(4), L8 = lat(8), L16 = lat(16), L32 = lat(32), L64 = lat(64), L128 = lat(128), C6 = cells(6), C12 = cells(12), C24 = cells(24);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = (y * N + x) * 4;
        const r = val(L4, 4, x, y) * .55 + val(L8, 8, x, y) * .3 + val(L16, 16, x, y) * .15;
        const w = (1 - Math.min(1, worley(C6, 6, x, y))) * .55 + (1 - Math.min(1, worley(C12, 12, x, y))) * .3 + (1 - Math.min(1, worley(C24, 24, x, y))) * .15, g = w * .75 + val(L16, 16, x, y) * .25;
        const b = val(L32, 32, x, y) * .5 + val(L64, 64, x, y) * .3 + val(L128, 128, x, y) * .2;
        px[i] = Math.round(clamp((r - .5) * 1.7 + .5, 0, 1) * 255); px[i + 1] = Math.round(clamp((g - .3) * 1.6, 0, 1) * 255); px[i + 2] = Math.round(b * 255); px[i + 3] = 255;
    }
    SKYC.px = px; const t = HG3D.texture({ data: px, width: N, height: N }, { srgb: false }); t.wrapS = t.wrapT = 1000; return t;
};
// the noise as the shader reads it (bilinear, repeating), for the clouds' shadow on the vehicles
SKYC.at = function (u, v, ch) {
    const N = SKYC.N, px = SKYC.px, fx = (u - Math.floor(u)) * N - .5, fy = (v - Math.floor(v)) * N - .5, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const g = (x, y) => px[((((y % N) + N) % N) * N + (((x % N) + N) % N)) * 4 + ch] / 255;
    return (g(ix, iy) * (1 - tx) + g(ix + 1, iy) * tx) * (1 - ty) + (g(ix, iy + 1) * (1 - tx) + g(ix + 1, iy + 1) * tx) * ty;
};

// the shader's density, shared by the sky and the shadow on the ground (GLSL; p in metres)
const SKYC_DENS = `
uniform sampler2D uCN; uniform vec4 uCl; uniform vec4 uCw;
float cDens(vec3 p, float fine) {
  float h = (p.y - uCl.z) / uCl.w; if (h < 0.0 || h > 1.0) return 0.0;
  vec2 q = p.xz + uCw.xy * uCw.z;
  float n = texture(uCN, q / 16000.0).r * 0.6 + texture(uCN, q / 6500.0 + vec2(h * 0.06, h * 0.035)).g * 0.4;
  if (fine > 0.5) n -= (1.0 - texture(uCN, q / 900.0 + vec2(0.0, h * 0.25)).b) * 0.1 * (1.3 - h);
  float thr = 1.0 - uCl.x + h * 0.24 + (1.0 - smoothstep(0.0, 0.14, h)) * 0.22;
  return clamp((n - thr) * 3.2, 0.0, 1.0);
}
float cCover(vec2 xz) {      // how much cloud stands over a spot of ground, along the sun (for shadows): one middle height
  vec2 q = xz + uCw.xy * uCw.z;
  float n = texture(uCN, q / 16000.0).r * 0.6 + texture(uCN, q / 6500.0 + vec2(0.024, 0.013)).g * 0.4;
  return smoothstep(0.0, 0.15, n - (1.0 - uCl.x + 0.05));
}`;
SKYC.uniforms = function () {
    if (SKYC.U) return SKYC.U; SKYC.tex = SKYC.tex || SKYC.noise();
    return SKYC.U = { uCN: { value: SKYC.tex }, uCl: { value: new THREE.Vector4(.47, .032, 950, 700) }, uCw: { value: new THREE.Vector4(7, 2.5, 0, 0) },
        uSunD: { value: new THREE.Vector3(.3, .7, .3) }, uSunC: { value: new THREE.Vector3(1, 1, 1) }, uZen: { value: new THREE.Vector3(.2, .35, .7) }, uHor: { value: new THREE.Vector3(.5, .55, .55) },
        uAmb: { value: new THREE.Vector3(.4, .45, .55) }, uQ: { value: new THREE.Vector4(12, 1, 0, 1) }, uTone: { value: new THREE.Vector4(1, 1, 0, 0) } };
};
SKYC.material = function () {
    if (SKYC.mat) return SKYC.mat;
    return SKYC.mat = new THREE.ShaderMaterial({
        uniforms: SKYC.uniforms(), side: THREE.BackSide, depthWrite: false, fog: false, userData: { hg: { sky: true } },
        vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w * 0.9999; }',
        fragmentShader: SKYC_DENS + `
uniform vec3 uSunD, uSunC, uZen, uHor, uAmb; uniform vec4 uQ; uniform vec4 uTone; varying vec3 vD;
vec3 cAces(vec3 c) {      // the same curve as tAces (29-tiles.js), so the horizon meets the fog
  c *= uTone.x / 0.6;
  vec3 a = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777) * c;
  a = (a * (a + 0.0245786) - 0.000090537) / (a * (0.983729 * a + 0.4329510) + 0.238081);
  return clamp(mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602) * a, 0.0, 1.0);
}
float cHg(float c, float g) { float g2 = g * g; return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * c, 1.5); }
void main() {
  vec3 d = normalize(vD), e = cameraPosition, sd = normalize(uSunD); float up = max(d.y, 0.0), mu = dot(d, sd), s = max(mu, 0.0);
  vec3 sky = mix(uHor, uZen, pow(up, 0.5));
  sky += uSunC * (0.018 * pow(s, 5.0) + 0.05 * pow(s, 48.0)) * (1.0 - 0.5 * up);
  if (uQ.z > 0.0 && d.y > 0.0) { vec3 g = floor(d * 300.0); float hs = fract(sin(dot(g, vec3(12.9898, 78.233, 37.719))) * 43758.5453), hb = fract(hs * 91.17); sky += vec3(0.85, 0.9, 1.0) * step(0.9975, hs) * uQ.z * (0.3 + 0.7 * hb) * smoothstep(0.0, 0.3, d.y) * 0.25; }      // stars at night (behind the clouds)
  vec3 col = sky + uSunC * 24.0 * smoothstep(0.99986, 0.99994, mu);
  if (d.y > 0.004 && uQ.x > 0.5 && e.y < uCl.z + uCl.w) {
    float t0 = max(0.0, (uCl.z - e.y) / d.y), t1 = min((uCl.z + uCl.w - e.y) / d.y, t0 + 2600.0);
    float n = uQ.x, dt = (t1 - t0) / n, T = 1.0, j = 0.3 + 0.4 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    float ph = 0.6 * cHg(mu, 0.72) + 0.4 * cHg(mu, -0.18) * 1.6;
    vec3 acc = vec3(0.0); float t = t0 + dt * j, sig = uCl.y;
    for (int i = 0; i < 24; i++) {
      if (float(i) >= n || T < 0.03) break;
      vec3 p = e + d * t; float den = cDens(p, uQ.y > 1.5 ? 1.0 : 0.0);
      if (den > 0.003) {
        float h = (p.y - uCl.z) / uCl.w, ld = 0.0;
        if (uQ.y > 0.5) { ld = cDens(p + sd * 110.0, 0.0) * 110.0; if (uQ.y > 1.5) ld += cDens(p + sd * 340.0, 0.0) * 230.0; } ld += (1.0 - h) * 260.0 * den;
        float sunT = exp(-ld * sig), pw = 1.0 - 0.55 * exp(-den * 4.0);
        vec3 L = uSunC * (sunT * ph * pw + 0.05) + uAmb * (0.45 + 0.55 * h);
        float st = exp(-sig * den * dt); acc += T * (1.0 - st) * L; T *= st;
      }
      t += dt;
    }
    float far = 1.0 - exp(-t0 / 14000.0), keep = smoothstep(0.004, 0.05, d.y);
    acc = mix(acc, uHor * (1.0 - T), far); T = mix(1.0, T, keep); acc *= keep;
    col = col * T + acc;
  }
  vec3 o = cAces(col);
  if (uTone.y > 0.5) o = mix(o * 12.92, 1.055 * pow(o, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, o));
  gl_FragColor = vec4(o, uQ.w);
}`
    });
};

// turn it on or off for the battlefield being built (sky = the old sky sphere from 30-world.js)
SKYC.use = function (on) {
    on = !!on && Q_ARG('clouds') !== '0'; SKYC.on = on;
    if (!SKYC.old) SKYC.old = sky.material;
    sky.material = on ? SKYC.material() : SKYC.old; sky.visible = on || !GROUNDS[GROUND].tile;
    if (TILE.dome) TILE.dome.visible = !on;
    if (on) SKYC.U.uQ.value.w = renderer.rays ? 0 : 1;      // no cover on the sky for rays() (which gives it back every frame)
    if (SKYC.cs) SKYC.cs.value = on ? SKYC.cs.value : 0;
};
function Q_ARG(n) { try { return new URLSearchParams(location.search).get(n); } catch (e) { return null; } }
// colours and light for the weather (called from tileLight)
SKYC.light = function (X) {
    if (!SKYC.on || !TILE.A) return; const U = SKYC.U, C = SKYC_WX[WXK] || SKYC_WX.noon, h = TILE.hor, k = TILE.expNow, sd = TILE.sunDir;
    const H = [h[0] * X.sky[0], h[1] * X.sky[1], h[2] * X.sky[2]], blue = WXK === 'overcast' ? [.92, .95, 1.02] : WXK === 'night' ? [.7, .8, 1.2] : WXK === 'evening' ? [.6, .62, 1.05] : [.3, .55, 1.3];
    U.uHor.value.set(H[0], H[1], H[2]); U.uZen.value.set(H[0] * blue[0], H[1] * blue[1], H[2] * blue[2]);
    U.uAmb.value.set(H[0] * .78 + H[0] * blue[0] * .22, H[1] * .78 + H[1] * blue[1] * .22, H[2] * .78 + H[2] * blue[2] * .22);
    // the sunlit side of a cloud is about the brightness the tone curve shows as near white
    let lo = 0, hi = 40; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (tAces([m, m, m], k)[1] < .9) lo = m; else hi = m; }
    const sc = TILE.A.json.sun ? TILE.A.json.sun.color : [1, 1, 1], tint = WXK === 'evening' ? [1.15, .78, .55] : WXK === 'night' ? [.35, .42, .6] : WXK === 'overcast' ? [.55, .57, .6] : [1.04, 1, .93];
    U.uSunC.value.set(lo * sc[0] * tint[0] * .55, lo * sc[1] * tint[1] * .55, lo * sc[2] * tint[2] * .55);
    U.uSunD.value.set(sd[0], sd[1], sd[2]).normalize(); U.uCl.value.set(C.cov, C.den, C.base, C.thick);
    U.uTone.value.set(k, SKYC.srgb ? 1 : 0, 0, 0); U.uQ.value.z = WXK === 'night' ? 1 : 0; SKYC.ray.color = [tint[0] * .9, tint[1] * .9, tint[2] * .9]; SKYC.rayK = C.rays;
    SKYC.quality();
};
SKYC.quality = function () { if (!SKYC.U) return; const q = Q === QUAL.high ? [20, 2] : Q === QUAL.low ? [6, 0] : [12, 1]; SKYC.U.uQ.value.x = q[0]; SKYC.U.uQ.value.y = q[1]; };
// how much sun reaches a spot on the ground (1 clear, down to 0.45 under a thick cloud): the same sum as cCover
SKYC.sunAt = function (x, y, z) {
    if (!SKYC.on || !SKYC.px) return 1; const U = SKYC.U.uCl.value, W = SKYC.U.uCw.value, sd = TILE.sunDir, l = Math.hypot(sd[0], sd[1], sd[2]) || 1, hy = U.z + U.w * .3 - y, k = hy / Math.max(sd[1] / l, .1);
    const qx = x + sd[0] / l * k + W.x * W.z, qz = z + sd[2] / l * k + W.y * W.z;
    const n = SKYC.at(qx / 16000, qz / 16000, 0) * .6 + SKYC.at(qx / 6500 + .024, qz / 6500 + .013, 1) * .4, c = clamp((n - (1 - U.x + .05)) / .15, 0, 1);
    return 1 - .55 * c * c * (3 - 2 * c);
};
// the clouds' shadow on the island: the light-map shader (85-assets.js lightmapHook) gets the world position and one look at the cover
SKYC.shadows = function (root) {
    const U = SKYC.uniforms(), seen = new Set();
    (function walk(o) {
        const m = o.material, hg = m && m.userData && m.userData.hg;
        if (hg && hg.key === 'hg-lightmap' && !seen.has(m)) {
            seen.add(m); const u = hg.uniforms; u.uCN = U.uCN; u.uCl = U.uCl; u.uCw = U.uCw; u.uSunD = U.uSunD; u.uCs = SKYC.cs || (SKYC.cs = { value: .55 });
            m.userData.hg = Object.assign({}, hg, { key: 'ss-lightmap-clouds',
                vDecl: hg.vDecl + ' out vec3 vCw;', vMain: hg.vMain + '\n#ifdef USE_INSTANCING\n vCw = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;\n#else\n vCw = (modelMatrix * vec4(position, 1.0)).xyz;\n#endif\n',
                fDecl: hg.fDecl + ' in vec3 vCw; uniform vec3 uSunD; uniform float uCs;' + SKYC_DENS,
                fAlbedo: hg.fAlbedo + ' { vec3 sd = normalize(uSunD); float hy = uCl.z + uCl.w * 0.3 - vCw.y; vec2 q = vCw.xz + sd.xz / max(sd.y, 0.1) * hy; alb *= 1.0 - uCs * cCover(q); }' });
        }
        if (o.children) for (const c of o.children) walk(c);
    })(root);
    return seen.size;
};
// each frame: wind, the vehicles' sun under a cloud, the shafts
SKYC.frame = function (dt) {
    if (!SKYC.on) return; const W = SKYC.U.uCw.value; SKYC.t += dt; W.z = SKYC.t; W.x = SKYC.wind[0]; W.y = SKYC.wind[1];
    if (SKYC.cs) SKYC.cs.value = WXK === 'overcast' ? .15 : WXK === 'night' ? .25 : .55;
    const k = SKYC.sunAt(camera.position.x, 0, camera.position.z); SKYC.sun += (k - SKYC.sun) * Math.min(1, dt * 2); sun.intensity = (W0.sunI || 1) * ((TILE_WX[WXK] || TILE_WX.noon).veh) * SKYC.sun;
};
// HG3D rays(): every frame the clouds are on (the sky was written with no cover: this gives it back), before the glow
SKYC.rays = function () {
    if (!SKYC.on || !renderer.rays) return; const r = SKYC.ray; r.strength = 0;
    const sd = TILE.sunDir || [.3, .9, .3], l = Math.hypot(sd[0], sd[1], sd[2]) || 1, cw = camera.matrixWorld.elements, d = [sd[0] / l, sd[1] / l, sd[2] / l];
    const x = d[0] * cw[0] + d[1] * cw[1] + d[2] * cw[2], y = d[0] * cw[4] + d[1] * cw[5] + d[2] * cw[6], z = -(d[0] * cw[8] + d[1] * cw[9] + d[2] * cw[10]);
    if (z > .05 && Q !== QUAL.low) {
        const t = Math.tan((camera.fov || 60) * Math.PI / 360), px = x / (Math.max(z, .05) * t * camera.aspect), py = y / (Math.max(z, .05) * t), off = Math.max(Math.abs(px), Math.abs(py)), k = clamp(z * 3, 0, 1) * clamp((2.3 - off) / 1.2, 0, 1);      // a sun well outside the picture gives none (a lone bright bar looked like a fault)
        if (k > .01) { r.x = px * .5 + .5; r.y = py * .5 + .5; r.size = .5 + Math.max(0, off - .9) * .5; r.strength = (SKYC.rayK || .6) * k * SKYC.sun; }
    }
    renderer.rays(r);
};
