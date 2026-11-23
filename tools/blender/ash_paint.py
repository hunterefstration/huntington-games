# ASHFALL maps: the painted-metal and old-steel pictures, one palette per map (round after build 23: "less rusty").
# The old `metal` picture was blue paint eaten by orange rust and `rust` was rust all over; nearly every wall and prop carried orange.
# Now `metal` is painted metal (each map its own colour) with grime streaks and chips down to grey primer and dark steel, with only
# specks of rust in the deepest chips; `rust` is old bare steel (dark, mottled, streaked) with rust as patches on a part of it.
# Each make_<map>.py calls repaint() right after its own pictures:  import ash_paint; ash_paint.repaint(PICS, save_image, dust, TEXDIR, 'street_', 'yard')
import numpy as np

def pn(N, cx, cy, seed, oct=3):
    """periodic value noise with cx cells across and cy cells down (wraps, so tiles repeat seamlessly); 0..1"""
    out = np.zeros((N, N), np.float32); amp = 1.0; tot = 0.0
    for o in range(oct):
        nx, ny = max(2, int(cx * 2 ** o)), max(2, int(cy * 2 ** o)); g = np.random.default_rng(seed * 31 + o).random((ny, nx)).astype(np.float32)
        u = np.arange(N, dtype=np.float32) * nx / N; i0 = np.floor(u).astype(int); fu = u - i0; fu = fu * fu * (3 - 2 * fu); i1 = (i0 + 1) % nx
        v = np.arange(N, dtype=np.float32) * ny / N; j0 = np.floor(v).astype(int); fv = v - j0; fv = fv * fv * (3 - 2 * fv); j1 = (j0 + 1) % ny
        a = g[j0][:, i0] * (1 - fu)[None, :] + g[j0][:, i1] * fu[None, :]; b = g[j1][:, i0] * (1 - fu)[None, :] + g[j1][:, i1] * fu[None, :]
        out += amp * (a * (1 - fv)[:, None] + b * fv[:, None]); tot += amp; amp *= 0.5
    return out / tot

RUST = np.array((0.34, 0.245, 0.18), np.float32)        # a brown rust, not orange
PRIMER = np.array((0.42, 0.42, 0.40), np.float32); STEEL = np.array((0.23, 0.23, 0.24), np.float32)

def painted_metal(N, base, seed, chips=0.08, rust=0.01, seams=True):
    b = np.array(base, np.float32)
    low = pn(N, 2, 2, seed); mid = pn(N, 9, 9, seed + 1); fine = pn(N, 80, 80, seed + 2, 2); streak = pn(N, 40, 2, seed + 3, 2)
    a = b * (0.86 + 0.24 * low[..., None]) * (0.95 + 0.1 * fine[..., None])
    g = a.mean(2, keepdims=True); f = (0.15 * low)[..., None]; a = a * (1 - f) + g * 1.08 * f                 # sun-faded toward chalky grey in places
    gs = np.clip((streak - 0.55) * 3.0, 0, 1) * (0.5 + 0.5 * mid); a *= (1 - 0.2 * gs)[..., None]             # grime runs (dark, not orange)
    cn = pn(N, 22, 22, seed + 5, 3) * 0.75 + fine * 0.25; th = np.quantile(cn, 1 - chips)
    edge = (cn > th - 0.025) & (cn <= th); chip = cn > th
    a[edge] *= 0.78
    m = (0.5 + 0.5 * fine)[..., None]; bare = PRIMER * m + STEEL * (1 - m); a[chip] = bare[chip]
    if rust > 0: rs = cn > np.quantile(cn, 1 - rust); a[rs] = (RUST * (0.75 + 0.4 * fine[..., None]))[rs]
    if seams:                                                                                                  # panel seams every half tile
        for c in (0, N // 2):
            a[:, max(0, c - 2):c + 2] *= 0.72
            for r in range(N // 16, N, N // 8): a[max(0, r - 2):r + 2, c + 5:c + 9] *= 0.6
    return np.clip(a, 0.04, 1)

def old_steel(N, seed, base=(0.31, 0.30, 0.29), rust=0.22):
    b = np.array(base, np.float32)
    low = pn(N, 3, 3, seed); mid = pn(N, 10, 10, seed + 1); fine = pn(N, 90, 90, seed + 2, 2); streak = pn(N, 36, 2, seed + 3, 2)
    a = b * (0.78 + 0.36 * low[..., None]) * (0.9 + 0.2 * fine[..., None])
    gs = np.clip((streak - 0.5) * 2.5, 0, 1) * (0.4 + 0.6 * mid); a *= (1 - 0.25 * gs)[..., None]
    rn = pn(N, 11, 11, seed + 7, 3) * 0.65 + mid * 0.25 + fine * 0.1; th = np.quantile(rn, 1 - rust)
    m = np.clip((rn - th) / 0.035, 0, 1)[..., None]; rc = RUST * (0.7 + 0.45 * mid[..., None]) * (0.9 + 0.2 * fine[..., None])
    a = a * (1 - m) + rc * m
    run = np.clip((streak - 0.6) * 3, 0, 1)[..., None] * np.clip((rn - th + 0.08) / 0.08, 0, 1)[..., None] * 0.35       # a little rust run below the patches
    a = a * (1 - run) + rc * run
    pits = fine > np.quantile(fine, 0.985); a[pits] *= 0.6
    return np.clip(a, 0.04, 1)

# per map: painted metal colour, its chips and rust specks; old steel's tone and how much of it is rust
PALETTE = {
    'yard':     dict(metal=(0.39, 0.42, 0.39), chips=0.09, specks=0.010, steel=(0.31, 0.30, 0.29), rust=0.17),   # faded rail-yard green-grey
    'depot':    dict(metal=(0.36, 0.41, 0.47), chips=0.08, specks=0.008, steel=(0.27, 0.27, 0.28), rust=0.10),   # warehouse blue-grey
    'street':   dict(metal=(0.50, 0.48, 0.42), chips=0.10, specks=0.012, steel=(0.27, 0.26, 0.26), rust=0.20),   # dull cream (cars, signs, bins)
    'subway':   dict(metal=(0.40, 0.48, 0.42), chips=0.10, specks=0.010, steel=(0.29, 0.29, 0.29), rust=0.16),   # institutional green
    'outpost':  dict(metal=(0.36, 0.38, 0.27), chips=0.07, specks=0.008, steel=(0.30, 0.29, 0.27), rust=0.15),   # olive drab
    'mall':     dict(metal=(0.52, 0.48, 0.42), chips=0.06, specks=0.006, steel=(0.32, 0.31, 0.30), rust=0.12),   # warm taupe
    'carnival': dict(metal=(0.30, 0.44, 0.45), chips=0.12, specks=0.010, steel=(0.29, 0.28, 0.28), rust=0.20),   # faded fairground teal
    'lab':      dict(metal=(0.60, 0.62, 0.63), chips=0.03, specks=0.002, steel=(0.34, 0.35, 0.36), rust=0.07),   # clean pale grey
}

def repaint(PICS, save_image, dust, texdir, prefix, name, N=1024):
    P = PALETTE[name]
    PICS['metal'] = save_image(dust(painted_metal(N, P['metal'], 11, P['chips'], P['specks']), 0.3, 35), prefix + 'metal', texdir)
    PICS['rust'] = save_image(dust(old_steel(N, 13, P['steel'], P['rust']), 0.28, 28), prefix + 'rust', texdir)
    return PICS

# ================================================================ THE BLOOM (owner's pick: "otherworldly and glowing"; piloted on the yard)
# Nothing above this line changed: repaint() is what all eight maps call. Below is new and only used by a map that asks for it
# (make_yard.py unless run with `plain`). One organism over the ruins, not clip-art: pale roots with a lit vein along their spine climb
# walls, poles and wagons; where they gather they fruit into faceted crystals; shelf fans with glowing gills step up the brick; where the
# roots meet the ground they spread a glowing fibre mat (between the rails, in front of the bays). Three glow colours: teal (main),
# violet (second), amber (rare: the last few lamps). Everything is one bmesh with a per-corner 'glow' colour (light units: what the
# light picture adds on top of the bake, so a crystal's facets come out bright and shaded) and a per-face 'solid' flag.
BLOOM_TEAL = (0.06, 1.00, 0.74); BLOOM_VIOLET = (0.58, 0.18, 1.00); BLOOM_AMBER = (1.00, 0.55, 0.16)

def bloom_bark(N=1024, seed=21):
    """the growth's own picture (display values, tiles): pale bone-lilac with fibres running down the picture (along a root, up a crystal)"""
    fib = pn(N, 70, 3, seed, 2); fib2 = pn(N, 160, 5, seed + 1, 2); low = pn(N, 3, 3, seed + 2); mid = pn(N, 12, 12, seed + 3); fine = pn(N, 90, 90, seed + 4, 2)
    base = np.array((0.74, 0.72, 0.79), np.float32)
    a = base * (0.86 + 0.18 * low[..., None]) * (0.93 + 0.1 * fine[..., None])
    lines = np.clip((fib - 0.62) * 4, 0, 1) * 0.22 + np.clip((fib2 - 0.66) * 4, 0, 1) * 0.12; a *= (1 - lines)[..., None]
    m = np.clip((mid - 0.6) * 3, 0, 1)[..., None]
    a = a * (1 - 0.12 * m) + np.array((0.0, 0.03, 0.03), np.float32) * m
    return np.clip(a, 0.05, 0.9)

def _smoothstep(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

def night_sky(W=2048, moon=(0.36, 0.79, 0.5), moon2=(-0.42, -0.24, 0.87), seed=5, aurora=0.30):
    """an equirectangular night sky (linear light, Blender's world mapping: middle of the picture = +X, row 0 = straight down):
    teal at the horizon to deep violet overhead, stars, an aurora over the north-west, a big pale moon (put it where the sun lamp is)
    and a small rose crescent. Returns an (H, W, 3) float array."""
    H = W // 2; rng = np.random.default_rng(seed)
    v = (np.arange(H, dtype=np.float32) + 0.5) / H; u = (np.arange(W, dtype=np.float32) + 0.5) / W
    th = (v - 0.5) * np.pi; ph = -(u - 0.5) * 2 * np.pi
    ct = np.cos(th)[:, None]; X = ct * np.cos(ph)[None, :]; Y = ct * np.sin(ph)[None, :]; Z = np.repeat(np.sin(th)[:, None], W, 1)
    D = np.stack([X, Y, Z], 2)
    zen = np.array((0.010, 0.008, 0.032), np.float32); mid = np.array((0.010, 0.022, 0.050), np.float32); hor = np.array((0.022, 0.070, 0.080), np.float32)
    low = np.array((0.006, 0.012, 0.018), np.float32); z = Z[..., None]
    sky = np.where(z > 0.22, mid + (zen - mid) * _smoothstep(0.22, 0.9, z), hor + (mid - hor) * _smoothstep(0.0, 0.22, z))
    sky = np.where(z < 0, low + (hor - low) * _smoothstep(-0.12, 0.0, z), sky)
    az = np.arctan2(X, Y)                      # from north (+Y) toward east (+X)
    se = np.exp(-((az - 2.3) ** 2) / 0.5) * np.exp(-np.clip(Z, 0, None) / 0.18) * (Z > -0.02)          # a violet glow low in the south-east
    sky = sky + se[..., None] * np.array((0.020, 0.006, 0.030), np.float32)
    # stars
    n = 9000; sd = rng.normal(size=(n, 3)); sd /= np.linalg.norm(sd, axis=1, keepdims=True); sd = sd[sd[:, 2] > 0.02]
    mag = np.clip(rng.pareto(2.2, len(sd)) * 0.05 + 0.02, 0, 1.2); tint = rng.random(len(sd))
    sc = np.stack([0.85 + 0.15 * tint, 0.9 + 0.05 * tint, 1.0 - 0.2 * tint], 1) * (mag * _smoothstep(0.02, 0.3, sd[:, 2]))[:, None]
    su = (-np.arctan2(sd[:, 1], sd[:, 0]) / (2 * np.pi) + 0.5) * W; sv = (np.arctan2(sd[:, 2], np.hypot(sd[:, 0], sd[:, 1])) / np.pi + 0.5) * H
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            xi = np.floor(su).astype(int) + dx; yi = np.floor(sv).astype(int) + dy
            w = np.exp(-(((xi + 0.5 - su) ** 2) + ((yi + 0.5 - sv) ** 2)) / 0.45)
            ok = (yi >= 0) & (yi < H); np.add.at(sky, (yi[ok], xi[ok] % W), (sc[ok] * w[ok, None]).astype(np.float32))
    # aurora: curtains over the north-west, a bright green-teal lower edge fading up into violet
    el = np.degrees(th)[:, None] * np.ones((1, W), np.float32); azd = np.degrees(az)
    A0, span = -48.0, 82.0; da = (azd - A0)
    def n1(x, f, s):
        r = np.random.default_rng(s).random(4096); xx = x * f; i = np.floor(xx).astype(int); t = xx - i; t = t * t * (3 - 2 * t)
        return r[i % 4096] * (1 - t) + r[(i + 1) % 4096] * t
    xa = (da + 400.0) / 360.0
    e0 = 16.0 + 7.0 * np.sin(np.radians(da) * 2.2 + 0.7) + 5.0 * (n1(xa, 6, 3) - 0.5)
    rays = 0.35 + 0.65 * n1(xa + (el - e0) * 0.0006, 90, 4) ** 1.5 * (0.6 + 0.4 * n1(xa, 23, 5))
    env = _smoothstep(span, span * 0.55, np.abs(da)) * (0.45 + 0.55 * n1(xa, 4, 6))
    above = np.clip(el - e0, 0, None); below = np.clip(e0 - el, 0, None)
    vert = np.where(el >= e0, np.exp(-above / 9.0), np.exp(-(below / 1.6) ** 2))
    k = env * rays * vert; mixc = _smoothstep(0, 14, above)[..., None]
    col = np.array((0.08, 1.0, 0.55), np.float32) * (1 - mixc) + np.array((0.50, 0.14, 0.85), np.float32) * mixc
    sky = sky + col * (aurora * k)[..., None]
    e1 = e0 + 19.0 + 4 * np.sin(np.radians(da) * 1.3)              # a fainter, higher arc
    k2 = _smoothstep(span * 0.8, span * 0.3, np.abs(da + 15)) * np.where(el >= e1, np.exp(-np.clip(el - e1, 0, None) / 7.0), np.exp(-((e1 - el) / 2.0) ** 2)) * (0.3 + 0.7 * n1(xa + 0.3, 60, 8))
    sky = sky + np.array((0.25, 0.10, 0.60), np.float32) * (aurora * 0.33 * k2)[..., None]
    def disc(m, r, colour, halo, lit=None, mseed=9):
        m = np.array(m, np.float32); m /= np.linalg.norm(m); c = np.clip(D @ m, -1, 1); a = np.degrees(np.arccos(c))
        hc = np.array(halo[2], np.float32)
        out = (halo[0] * np.exp(-a / halo[1]) + halo[3] * np.exp(-a / halo[4]))[..., None] * hc
        e1v = np.cross(m, (0, 0, 1)); e1v /= np.linalg.norm(e1v); e2v = np.cross(e1v, m)
        px = (D @ e1v) / np.radians(r); py = (D @ e2v) / np.radians(r); mu = np.sqrt(np.clip(1 - px * px - py * py, 0, 1))
        rr = np.random.default_rng(mseed); maria = np.zeros_like(px)
        for _ in range(9):
            cx, cy, s = rr.uniform(-0.7, 0.7), rr.uniform(-0.7, 0.7), rr.uniform(0.15, 0.45); maria += np.exp(-((px - cx) ** 2 + (py - cy) ** 2) / (s * s)) * rr.uniform(0.15, 0.3)
        shade = (0.72 + 0.28 * mu) * (1 - np.clip(maria, 0, 0.45))
        if lit is not None:
            L = np.array(lit, np.float32); L /= np.linalg.norm(L)
            shade = shade * _smoothstep(-0.05, 0.12, px * L[0] + py * L[1] + mu * L[2])
        edge = _smoothstep(r, r - 0.08, a) * (c > 0)
        return out, np.array(colour, np.float32) * (shade * edge)[..., None], edge
    h1, d1, m1 = disc(moon, 3.4, (0.92, 0.96, 1.0), (0.10, 3.0, (0.55, 0.85, 1.0), 0.035, 16.0))
    h2, d2, m2 = disc(moon2, 1.3, (1.0, 0.72, 0.92), (0.03, 1.5, (0.9, 0.6, 1.0), 0.0, 1.0), lit=(0.8, -0.3, -0.35), mseed=12)
    sky = sky + h1 + h2
    sky = sky * (1 - m1[..., None]) + (d1 + h1 * 0.3) * m1[..., None]
    lit2 = (d2.sum(2) > 0.01).astype(np.float32)[..., None] * m2[..., None]
    sky = sky * (1 - lit2 * 0.7) + d2 * lit2
    return sky.astype(np.float32)

class Bloom:
    """The growth as one bmesh. Materials by name (mats: name -> slot). Every face gets a 'solid' flag (1 = goes into the collision map) and
    per-corner 'glow' (light units, added to the baked light picture afterwards; also given to Cycles as emission so it lights the map).
    bvh: the map to grow on (BVHTree of the finished map mesh). Positions are Blender's (z up)."""
    def __init__(self, bvh, mats, seed=3):
        import bmesh, random
        self.bm = bmesh.new(); self.uvl = self.bm.loops.layers.uv.new('UVMap'); self.gl = self.bm.loops.layers.float_color.new('glow')
        self.sol = self.bm.faces.layers.int.new('solid'); self.bvh = bvh; self.M = mats; self.rng = random.Random(seed); self.glows = []
        self.stats = {'vine': 0, 'crystal': 0, 'shelf': 0, 'mat': 0}; self.gs = 1.0      # gs: every glow times this
    # ---- low level
    def face(self, vs, mat, uvs, glows, solid=0, up=None):
        if up is not None:                      # orient: the face's normal should agree with `up`
            a, b, c = vs[0].co, vs[1].co, vs[2].co; nn = (b - a).cross(c - a)
            if nn.dot(up) < 0: vs = vs[::-1]; uvs = uvs[::-1]; glows = glows[::-1]
        try: f = self.bm.faces.new(vs)
        except ValueError: return None
        f.material_index = self.M[mat]; f[self.sol] = solid; f.smooth = False
        gs = self.gs
        for l, uv, g in zip(f.loops, uvs, glows): l[self.uvl].uv = uv; l[self.gl] = (g[0] * gs, g[1] * gs, g[2] * gs, 1.0)
        return f
    def glow(self, p, col, size): self.glows.append((tuple(p), tuple(col), float(size)))
    def ray(self, p, d, dist=3.0):
        from mathutils import Vector
        return self.bvh.ray_cast(Vector(p), Vector(d).normalized(), dist)
    def down(self, x, y, z=30.0):
        return self.ray((x, y, z), (0, 0, -1), 60.0)[0]
    # ---- roots
    def crawl(self, p, bias, length, step=0.4, curl=0.0, wander=0.5):
        from mathutils import Vector
        p = Vector(p); bias = Vector(bias); bias = bias.normalized() if bias.length > 0 else bias; d = None; pts, ns = [], []; s = 0.0
        while s < length:
            loc, n, idx, dist = self.bvh.find_nearest(p, 1.2)
            if loc is None: break
            if pts and (loc - pts[-1]).length > step * 2.2: break
            q = loc + n * 0.006
            if pts and (q - pts[-1]).length < step * 0.25: break        # stuck in a corner
            pts.append(q); ns.append(n.copy())
            w = Vector((self.rng.uniform(-1, 1), self.rng.uniform(-1, 1), self.rng.uniform(-1, 1))) * wander
            want = bias + w + ((n.cross(d)) * curl if d is not None else Vector())
            t = want - n * want.dot(n)
            if t.length < 1e-4: t = (d - n * d.dot(n)) if d is not None else n.orthogonal()
            if t.length < 1e-5: t = n.orthogonal()
            t.normalize(); d = t if d is None else (d * 0.6 + t * 0.4); d = d - n * d.dot(n)
            if d.length < 1e-5: d = n.orthogonal()
            d.normalize(); p = q + d * step - n * 0.03; s += step
        return pts, ns
    def sweep(self, pts, ns, w0, h0, col, vein='emissive_teal', k=0.18, solid=0, wtip=0.012):
        """a root along the points: a low faceted ridge (flat side on the surface) with its spine as the lit vein"""
        from mathutils import Vector
        if len(pts) < 3: return 0
        P = [pts[0]] + [(pts[i - 1] + pts[i] * 2 + pts[i + 1]) / 4 for i in range(1, len(pts) - 1)] + [pts[-1]]
        N_ = [ns[0]] + [(ns[i - 1] + ns[i] * 2 + ns[i + 1]).normalized() for i in range(1, len(ns) - 1)] + [ns[-1]]
        prof = ((-1, 0), (-0.36, 1.0), (0.36, 1.0), (1, 0)); n = len(P); rings = []; arc = [0.0]
        for i in range(1, n): arc.append(arc[-1] + (P[i] - P[i - 1]).length)
        for i in range(n):
            t = (P[min(i + 1, n - 1)] - P[max(i - 1, 0)]); t = t.normalized() if t.length > 1e-6 else Vector((1, 0, 0))
            nn = N_[i] - t * N_[i].dot(t); nn = nn.normalized() if nn.length > 1e-6 else t.orthogonal(); b = t.cross(nn)
            kk = (1 - i / (n - 1)) ** 0.75; w = max(wtip, w0 * kk); h = max(wtip * 0.7, h0 * kk)
            if i == n - 1: tip = self.bm.verts.new(P[i] + nn * h * 0.4); rings.append([tip] * len(prof))
            else: rings.append([self.bm.verts.new(P[i] + b * ox * w + nn * oy * h) for ox, oy in prof])
        for i in range(n - 1):
            kk0 = 1 - i / (n - 1); kk1 = 1 - (i + 1) / (n - 1)
            g0 = [c * k * (0.4 + 0.6 * kk0) for c in col]; g1 = [c * k * (0.4 + 0.6 * kk1) for c in col]
            for j in range(len(prof) - 1):
                a, b_, c_, d_ = rings[i][j], rings[i][j + 1], rings[i + 1][j + 1], rings[i + 1][j]
                vs = [a, b_, c_, d_] if c_ is not d_ else [a, b_, c_]
                up = (a.co + b_.co) / 2 - P[i] + N_[i] * 0.001
                uvs = [(j / 3, arc[i] / 0.7), ((j + 1) / 3, arc[i] / 0.7), ((j + 1) / 3, arc[i + 1] / 0.7), (j / 3, arc[i + 1] / 0.7)][:len(vs)]
                if j == 1 and vein: self.face(vs, vein, uvs, [(0, 0, 0)] * len(vs), solid, up)
                else: self.face(vs, 'st_growth', uvs, [g0, g0, g1, g1][:len(vs)], solid, up)
        return n
    def vine(self, p, bias, length, w0=0.11, h0=0.07, col=BLOOM_TEAL, vein='emissive_teal', step=0.5, curl=0.0, branches=0, wander=0.5, k=0.18):
        from mathutils import Vector
        pts, ns = self.crawl(p, bias, length, step, curl, wander)
        if self.sweep(pts, ns, w0, h0, col, vein, k) < 3: return []
        self.stats['vine'] += 1; B = Vector(bias)
        for _ in range(branches):
            if len(pts) < 6: break
            i = self.rng.randint(2, len(pts) - 3); n = ns[i]; side = n.cross(B)
            side = side.normalized() if side.length > 1e-3 else n.orthogonal().normalized()
            sb = B.normalized() * 0.6 + side * self.rng.choice((-1, 1)) * 0.8
            q, qn = self.crawl(pts[i], sb, length * self.rng.uniform(0.3, 0.55), step, curl, wander)
            if self.sweep(q, qn, w0 * 0.55, h0 * 0.55, col, vein, k) >= 3: self.stats['vine'] += 1
        return pts
    # ---- crystals
    def crystal(self, base, axis, r, L, col, k=2.2, solid=0):
        from mathutils import Vector
        import math
        rng = self.rng; ax = Vector(axis).normalized(); e1 = ax.orthogonal().normalized(); e2 = ax.cross(e1)
        rot = rng.uniform(0, math.pi); b0 = Vector(base) - ax * (0.06 * L + r * 0.35); sh = rng.uniform(0.68, 0.8); m = 6
        ring0, ring1 = [], []
        for j in range(m):
            a = rot + j * 2 * math.pi / m; c, s = math.cos(a), math.sin(a); j0 = rng.uniform(0.85, 1.08)
            ring0.append(self.bm.verts.new(b0 + (e1 * c + e2 * s) * r * j0))
            ring1.append(self.bm.verts.new(b0 + ax * (L * sh) + (e1 * c + e2 * s) * r * j0 * rng.uniform(0.82, 0.95)))
        tip = self.bm.verts.new(b0 + ax * L + (e1 * rng.uniform(-1, 1) + e2 * rng.uniform(-1, 1)) * r * 0.12)
        per = 2 * math.pi * r
        for j in range(m):
            f = rng.uniform(0.6, 1.15); jj = (j + 1) % m
            gb = [c * k * 0.45 * f for c in col]; gt = [c * k * 0.9 * f for c in col]
            out = (ring0[j].co + ring0[jj].co) / 2 - b0
            self.face([ring0[j], ring0[jj], ring1[jj], ring1[j]], 'st_growth', [(j * per / m, 0), ((j + 1) * per / m, 0), ((j + 1) * per / m, L * sh), (j * per / m, L * sh)], [gb, gb, gt, gt], solid, out)
            f2 = rng.uniform(0.8, 1.2); gt2 = [c * k * 1.0 * f2 for c in col]; gp2 = [c * k * 1.5 * f2 for c in col]
            o2 = (ring1[j].co + ring1[jj].co) / 2 - (b0 + ax * (L * sh * 0.5))
            self.face([ring1[j], ring1[jj], tip], 'st_growth', [(j * per / m, L * sh), ((j + 1) * per / m, L * sh), ((j + 0.5) * per / m, L)], [gt2, gt2, gp2], solid, o2)
        self.stats['crystal'] += 1
    def cluster(self, base, n, Lmax, col, k=2.2, spread=0.7, lean=0.55, up=(0, 0, 1), solid=0, glow=True, size=None, slim=1.0):
        from mathutils import Vector
        import math
        rng = self.rng; up = Vector(up).normalized(); e1 = up.orthogonal().normalized(); e2 = up.cross(e1); base = Vector(base); top = 0.0
        for i in range(n):
            if i == 0: rr, a = 0.0, 0.0
            else: rr = spread * math.sqrt(rng.uniform(0.08, 1.0)); a = rng.uniform(0, 2 * math.pi)
            off = (e1 * math.cos(a) + e2 * math.sin(a)) * rr
            h = self.ray(base + off + up * 1.2, -up, 3.0)
            if h[0] is None: continue
            L = Lmax * (1.0 - 0.55 * (rr / max(spread, 1e-3))) * rng.uniform(0.6, 1.0)
            jit = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))) * 0.12
            ax = (up + off.normalized() * lean * (0.3 + rr / max(spread, 1e-3)) + jit) if rr > 0 else (up + jit)
            self.crystal(h[0], ax, L * rng.uniform(0.11, 0.15) * slim, L, col, k, solid); top = max(top, L)
        if glow: self.glow(base + up * max(0.5, top * 0.5), col, size or max(3.0, Lmax * 3.2))
    # ---- shelf fans
    def shelf(self, p, nw, R, col=BLOOM_VIOLET, gill='emissive_violet', k=0.9, solid=0):
        from mathutils import Vector
        import math
        rng = self.rng; up = Vector((0, 0, 1)); nw = Vector((nw[0], nw[1], 0)).normalized(); side = up.cross(nw)
        tilt = math.radians(rng.uniform(4, 16)); o = nw * math.cos(tilt) + up * math.sin(tilt); th = max(0.025, R * 0.09)
        c = Vector(p) + nw * 0.008; ph = rng.uniform(0, 6.28); seg = 7; arc = []
        for i in range(seg + 1):
            a = -1.4 + 2.8 * i / seg; rr = R * (0.8 + 0.14 * math.sin(3.2 * a + ph) + 0.06 * rng.uniform(-1, 1))
            arc.append(c + side * math.sin(a) * rr + o * math.cos(a) * rr)
        ct = self.bm.verts.new(c + up * th * 0.5); cb = self.bm.verts.new(c - up * th * 1.2)
        top = [self.bm.verts.new(q) for q in arc]; bot = [self.bm.verts.new(q - up * th) for q in arc]
        gr = [x * k * 0.35 for x in col]; gc = [x * k * 0.06 for x in col]; grim = [x * k * 0.55 for x in col]
        for i in range(seg):
            self.face([ct, top[i], top[i + 1]], 'st_growth', [(0.5, 0), (i / seg, R), ((i + 1) / seg, R)], [gc, gr, gr], solid, up)
            self.face([cb, bot[i + 1], bot[i]], gill, [(0, 0)] * 3, [(0, 0, 0)] * 3, solid, -up)
            self.face([top[i], bot[i], bot[i + 1], top[i + 1]], 'st_growth', [(i / seg, 0), (i / seg, 0.06), ((i + 1) / seg, 0.06), ((i + 1) / seg, 0)], [grim] * 4, solid, (arc[i] + arc[i + 1]) / 2 - c)
        self.stats['shelf'] += 1
    def shelves(self, p, to_wall, w, h, n, col=BLOOM_VIOLET, gill='emissive_violet', rmin=0.16, rmax=0.42, glow=True, size=None, k=0.9):
        """n shelf fans stepping up a wall: p is a point in front of the wall, to_wall the direction to it; w x h the patch they cover"""
        from mathutils import Vector
        rng = self.rng; d = Vector(to_wall).normalized(); side = Vector((0, 0, 1)).cross(d); made = 0
        for i in range(n * 4):
            if made >= n: break
            t = rng.random(); q = Vector(p) + side * rng.uniform(-w / 2, w / 2) + Vector((0, 0, h * (t - 0.5)))
            hit = self.ray(q, d, 2.5)
            if hit[0] is None or abs(hit[1].z) > 0.3: continue
            R = rmax - (rmax - rmin) * t * rng.uniform(0.6, 1.0)
            if not all(self.ray(q + side * s * R * 0.9, d, 2.5)[0] is not None for s in (-1, 1)): continue      # wall all along its back
            self.shelf(hit[0], hit[1], R, col, gill, k); made += 1
        if glow and made: self.glow(Vector(p) + d * 0.3, col, size or max(2.5, (w + h) * 0.8))
        return made
    # ---- glowing fibre mats on the ground
    def mat(self, c, rx, ry, rot, col, k=1.6, lift=0.045, seg=14, glow=True, size=None):
        from mathutils import Vector
        import math
        rng = self.rng; cx, cy = c[0], c[1]; zt = (c[2] + 1.5) if len(c) > 2 else 3.0
        def at(r, a, fr):
            x = cx + (math.cos(a) * rx * math.cos(rot) - math.sin(a) * ry * math.sin(rot)) * r * fr
            y = cy + (math.cos(a) * rx * math.sin(rot) + math.sin(a) * ry * math.cos(rot)) * r * fr
            hit = self.down(x, y, zt); return Vector((x, y, hit.z if hit is not None else 0.0))
        ph = rng.uniform(0, 6.28); fr = [0.72 + 0.2 * math.sin(3 * (i / seg) * 6.283 + ph) + 0.12 * rng.uniform(-1, 1) for i in range(seg)]
        cen = at(0, 0, 1); C = self.bm.verts.new(cen + Vector((0, 0, lift + 0.02)))
        inner = [self.bm.verts.new(at(0.5, i / seg * 6.283, fr[i]) + Vector((0, 0, lift + 0.012))) for i in range(seg)]
        outer_p = [at(1.0, i / seg * 6.283, fr[i]) for i in range(seg)]
        outer = [self.bm.verts.new(q + Vector((0, 0, lift))) for q in outer_p]; foot = [self.bm.verts.new(q + Vector((0, 0, 0.004))) for q in outer_p]
        gC = [x * k for x in col]; gI = [x * k * 0.55 for x in col]; gO = [x * k * 0.12 for x in col]; gF = [x * k * 0.05 for x in col]
        U = lambda v: ((v.co.x - cx) / 1.2, (v.co.y - cy) / 1.2); up = Vector((0, 0, 1))
        for i in range(seg):
            j = (i + 1) % seg
            self.face([C, inner[i], inner[j]], 'st_growth', [U(C), U(inner[i]), U(inner[j])], [gC, gI, gI], 0, up)
            self.face([inner[i], outer[i], outer[j], inner[j]], 'st_growth', [U(inner[i]), U(outer[i]), U(outer[j]), U(inner[j])], [gI, gO, gO, gI], 0, up)
            self.face([outer[i], foot[i], foot[j], outer[j]], 'st_growth', [U(outer[i]), U(foot[i]), U(foot[j]), U(outer[j])], [gO, gF, gF, gO], 0, (outer[i].co + outer[j].co) / 2 - cen)
        self.stats['mat'] += 1
        if glow: self.glow(cen + Vector((0, 0, 0.6)), col, size or max(2.5, (rx + ry) * 1.6))
    def to_mesh(self, name):
        import bpy
        me = bpy.data.meshes.new(name); self.bm.to_mesh(me); self.bm.free(); return me

def save_exr_linear(img, path):
    """Blender 4.5 saves a picture made in the script (images.new) colour-managed: an EXR comes out sRGB-encoded (0.006 is written as 0.07),
    which lifts every dark. A picture loaded from a file is saved as it is: so save once, load, put the numbers back, save again."""
    import bpy
    a = np.array(img.pixels[:], np.float32)
    img.filepath_raw = path; img.file_format = 'OPEN_EXR'; img.save()
    im = bpy.data.images.load(path, check_existing=False); im.pixels.foreach_set(a); im.filepath_raw = path; im.file_format = 'OPEN_EXR'; im.save(); bpy.data.images.remove(im)

def bloom_glow_into(ob, path, attr='glow', layer='Lightmap', pad=1.0):
    """add the growth's own light (per-corner `attr`) into its baked light picture (EXR at `path`): each triangle is drawn into the
    picture (max, not sum, so shared edges do not double) with `pad` texels to spare, then added to the bake. Returns texels touched."""
    import bpy
    im = bpy.data.images.load(path, check_existing=False); N = im.size[0]; px = np.array(im.pixels[:], np.float32).reshape(N, N, 4)
    me = ob.data; me.calc_loop_triangles(); uvd = me.uv_layers[layer].data; ca = me.color_attributes[attr].data
    nl = len(me.loops); uv = np.empty(nl * 2, np.float32); uvd.foreach_get('uv', uv); uv = uv.reshape(-1, 2) * N
    gc = np.empty(nl * 4, np.float32); ca.foreach_get('color', gc); gc = gc.reshape(-1, 4)[:, :3]
    tl = np.empty(len(me.loop_triangles) * 3, np.int32); me.loop_triangles.foreach_get('loops', tl); tl = tl.reshape(-1, 3)
    G = np.zeros((N, N, 3), np.float32)
    for t in tl:
        g = gc[t]
        if g.max() <= 1e-4: continue
        p = uv[t]; x0, y0 = np.floor(p.min(0) - pad).astype(int); x1, y1 = np.ceil(p.max(0) + pad).astype(int)
        x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, N), min(y1, N)
        if x1 <= x0 or y1 <= y0: continue
        X, Y = np.meshgrid(np.arange(x0, x1) + 0.5, np.arange(y0, y1) + 0.5)
        (ax, ay), (bx, by), (cx, cy) = p
        den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(den) < 1e-9: continue
        l0 = ((by - cy) * (X - cx) + (cx - bx) * (Y - cy)) / den; l1 = ((cy - ay) * (X - cx) + (ax - cx) * (Y - cy)) / den; l2 = 1 - l0 - l1
        g0 = np.hypot((by - cy) / den, (cx - bx) / den); g1 = np.hypot((cy - ay) / den, (ax - cx) / den)
        g2 = np.hypot(((by - cy) + (cy - ay)) / den, ((cx - bx) + (ax - cx)) / den)          # how fast each weight changes per texel
        ins = (l0 >= -pad * g0) & (l1 >= -pad * g1) & (l2 >= -pad * g2)
        if not ins.any(): continue
        L = np.clip(np.stack([l0[ins], l1[ins], l2[ins]], 1), 0, None); L /= np.maximum(L.sum(1, keepdims=True), 1e-9)
        ys_, xs_ = np.nonzero(ins); ys_ += y0; xs_ += x0
        G[ys_, xs_] = np.maximum(G[ys_, xs_], L @ g)
    px[:, :, :3] += G; im.pixels.foreach_set(px.ravel()); im.filepath_raw = path; im.file_format = 'OPEN_EXR'; im.save(); bpy.data.images.remove(im)
    return int((G.max(2) > 0).sum())
