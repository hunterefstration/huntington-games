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
    base = np.array((0.60, 0.58, 0.66), np.float32)
    a = base * (0.86 + 0.18 * low[..., None]) * (0.93 + 0.1 * fine[..., None])
    lines = np.clip((fib - 0.62) * 4, 0, 1) * 0.22 + np.clip((fib2 - 0.66) * 4, 0, 1) * 0.12; a *= (1 - lines)[..., None]
    m = np.clip((mid - 0.6) * 3, 0, 1)[..., None]
    a = a * (1 - 0.12 * m) + np.array((0.0, 0.03, 0.03), np.float32) * m
    return np.clip(a, 0.05, 0.9)

def _smoothstep(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

def night_sky(W=2048, moon=(0.36, 0.79, 0.5), moon2=(-0.42, -0.24, 0.87), seed=5, aurora=0.30, zen=(0.010, 0.008, 0.032), mid=(0.010, 0.022, 0.050),
              hor=(0.022, 0.070, 0.080), alo=(0.08, 1.0, 0.55), ahi=(0.50, 0.14, 0.85), a0=-48.0, moon_col=(0.40, 0.43, 0.46), halo=(0.55, 0.85, 1.0),
              moon2_col=(0.6, 0.42, 0.56), glow2=(0.020, 0.006, 0.030)):
    """an equirectangular night sky (linear light, Blender's world mapping: middle of the picture = +X, row 0 = straight down):
    teal at the horizon to deep violet overhead, stars, an aurora over the north-west, a big pale moon (put it where the sun lamp is)
    and a small rose crescent. Returns an (H, W, 3) float array."""
    H = W // 2; rng = np.random.default_rng(seed)
    v = (np.arange(H, dtype=np.float32) + 0.5) / H; u = (np.arange(W, dtype=np.float32) + 0.5) / W
    th = (v - 0.5) * np.pi; ph = -(u - 0.5) * 2 * np.pi
    ct = np.cos(th)[:, None]; X = ct * np.cos(ph)[None, :]; Y = ct * np.sin(ph)[None, :]; Z = np.repeat(np.sin(th)[:, None], W, 1)
    D = np.stack([X, Y, Z], 2)
    zen = np.array(zen, np.float32); mid = np.array(mid, np.float32); hor = np.array(hor, np.float32)
    low = np.array((0.006, 0.012, 0.018), np.float32); z = Z[..., None]
    sky = np.where(z > 0.22, mid + (zen - mid) * _smoothstep(0.22, 0.9, z), hor + (mid - hor) * _smoothstep(0.0, 0.22, z))
    sky = np.where(z < 0, low + (hor - low) * _smoothstep(-0.12, 0.0, z), sky)
    az = np.arctan2(X, Y)                      # from north (+Y) toward east (+X)
    se = np.exp(-((az - 2.3) ** 2) / 0.5) * np.exp(-np.clip(Z, 0, None) / 0.18) * (Z > -0.02)          # a violet glow low in the south-east
    sky = sky + se[..., None] * np.array(glow2, np.float32)
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
    A0, span = a0, 82.0; da = ((azd - A0 + 180.0) % 360.0) - 180.0
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
    col = np.array(alo, np.float32) * (1 - mixc) + np.array(ahi, np.float32) * mixc
    sky = sky + col * (aurora * k)[..., None]
    e1 = e0 + 19.0 + 4 * np.sin(np.radians(da) * 1.3)              # a fainter, higher arc
    k2 = _smoothstep(span * 0.8, span * 0.3, np.abs(da + 15)) * np.where(el >= e1, np.exp(-np.clip(el - e1, 0, None) / 7.0), np.exp(-((e1 - el) / 2.0) ** 2)) * (0.3 + 0.7 * n1(xa + 0.3, 60, 8))
    sky = sky + np.array(ahi, np.float32) * 0.6 * (aurora * 0.33 * k2)[..., None]
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
    h1, d1, m1 = disc(moon, 3.4, moon_col, (0.10, 3.0, halo, 0.035, 16.0))
    h2, d2, m2 = disc(moon2, 1.3, moon2_col, (0.03, 1.5, (0.9, 0.6, 1.0), 0.0, 1.0), lit=(0.8, -0.3, -0.35), mseed=12)
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
        self.stats = {'vine': 0, 'crystal': 0, 'shelf': 0, 'mat': 0}; self.gs = 1.0; self.lift = 0.014      # gs: every glow times this
        self.ca, self.cb = BLOOM_TEAL, BLOOM_VIOLET; self.sat = 1.0; self.cgs = 1.0; self.step = 0.6; self.seg = 7; self.rk = 1.0      # lead / second colour, crystal colour depth and gain, root step, fan segments
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
    def deep(self, col):                    # a colour made deeper (sat > 1) so lit faces keep their hue instead of washing to white
        if self.sat == 1.0: return col
        c = [max(x, 0.0) ** self.sat for x in col]; m = max(c) or 1.0; return tuple(x / m for x in c)
    def role(self, col):                    # which unlit material carries this colour: the lead's or the second's
        da = sum((a - b) ** 2 for a, b in zip(col, self.ca)); db = sum((a - b) ** 2 for a, b in zip(col, self.cb)); return 'emissive_teal' if da <= db else 'emissive_violet'
    def merge_glows(self, maxn, reach=7.0):
        """fewer glow points (each is a see-through halo in the game): merge the nearest two of one colour until there are maxn"""
        from mathutils import Vector
        G = [list(g) for g in self.glows]
        while len(G) > maxn:
            best = None
            for i in range(len(G)):
                for j in range(i + 1, len(G)):
                    if G[i][1] != G[j][1] or G[i][3] <= 0 or G[j][3] <= 0: continue
                    d = (Vector(G[i][0]) - Vector(G[j][0])).length
                    if d < reach and (best is None or d < best[0]): best = (d, i, j)
            if best is None: break
            _, i, j = best; a, b = G[i], G[j]; wa, wb = a[2] ** 2, b[2] ** 2
            p = tuple((Vector(a[0]) * wa + Vector(b[0]) * wb) / (wa + wb)); G[i] = [p, a[1], math.sqrt(wa + wb), (a[3] * wa + b[3] * wb) / (wa + wb)]; del G[j]
        self.glows = [tuple(g) for g in G]
    def glow(self, p, col, size, lk=1.0): self.glows.append((tuple(p), tuple(col), float(size), float(lk)))      # lk: how strong a lamp the bake puts there
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
            if pts and (loc - pts[-1]).length > step * 1.6: break
            q = loc + n * self.lift
            if pts and (q - pts[-1]).length < step * 0.25: break        # stuck in a corner
            if pts:                                                     # never bridge a gap through the air (a root that jumps to a rod or a wire)
                mid = (q + pts[-1]) / 2; mh = self.bvh.find_nearest(mid, 1.0)
                if mh[0] is None or (mh[0] - mid).length > 0.2: break
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
    def sweep(self, pts, ns, w0, h0, col, vein='emissive_teal', k=0.8, solid=0, wtip=0.012):
        col = self.deep(col); k = k * self.rk
        """a root along the points: a low faceted ridge (flat side on the surface) with its spine as the lit vein"""
        from mathutils import Vector
        if len(pts) < 3: return 0
        P = [pts[0]] + [(pts[i - 1] + pts[i] * 2 + pts[i + 1]) / 4 for i in range(1, len(pts) - 1)] + [pts[-1]]
        N_ = [ns[0]] + [(ns[i - 1] + ns[i] * 2 + ns[i + 1]).normalized() for i in range(1, len(ns) - 1)] + [ns[-1]]
        prof = ((-1, 0), (-0.42, 0.82), (0.3, 1.0), (1, 0)); n = len(P); rings = []; arc = [0.0]      # the spine leans a little: never parallel to what it lies on
        for i in range(1, n): arc.append(arc[-1] + (P[i] - P[i - 1]).length)
        for i in range(n):
            t = (P[min(i + 1, n - 1)] - P[max(i - 1, 0)]); t = t.normalized() if t.length > 1e-6 else Vector((1, 0, 0))
            nn = N_[i] - t * N_[i].dot(t); nn = nn.normalized() if nn.length > 1e-6 else t.orthogonal(); b = t.cross(nn)
            kk = (1 - i / (n - 1)) ** 0.75; w = max(wtip, w0 * kk); h = max(0.016, h0 * kk)      # never flat enough to fight the surface it lies on
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
    def vine(self, p, bias, length, w0=0.11, h0=0.07, col=BLOOM_TEAL, vein='emissive_teal', step=None, curl=0.0, branches=0, wander=0.5, k=0.8):
        from mathutils import Vector
        step = step or self.step
        p = Vector(p); self.lift = 0.012 + 0.008 * (self.stats['vine'] % 4)      # each root its own height off the surface: two that cross never share a plane
        if Vector(bias).normalized().z > 0.7 and p.z < 0.25: p = Vector((p.x, p.y, 0.25))      # a climber starts on the wall, not on the floor in front of it
        pts, ns = self.crawl(p, bias, length, step, curl, wander)
        if pts and abs(ns[0].z) < 0.3:                                  # ...and its foot comes down to the ground
            h = self.ray(pts[0], (0, 0, -1), 0.6)
            if h[0] is not None and h[1].z > 0.7: pts.insert(0, Vector((pts[0].x, pts[0].y, h[0].z + 0.006)) + ns[0] * 0.02); ns.insert(0, (ns[0] + h[1]).normalized())
        if self.sweep(pts, ns, w0, h0, col, vein, k) < 3: return []
        self.stats['vine'] += 1; B = Vector(bias)
        for _ in range(branches):
            if len(pts) < 6: break
            i = self.rng.randint(2, len(pts) - 3); n = ns[i]; side = n.cross(B)
            side = side.normalized() if side.length > 1e-3 else n.orthogonal().normalized()
            sb = B.normalized() * 0.6 + side * self.rng.choice((-1, 1)) * 0.8
            self.lift = 0.012 + 0.008 * ((self.stats['vine'] + 2) % 4)
            q, qn = self.crawl(pts[i], sb, length * self.rng.uniform(0.3, 0.55), step, curl, wander)
            if self.sweep(q, qn, w0 * 0.55, h0 * 0.55, col, vein, k) >= 3: self.stats['vine'] += 1
        return pts
    # ---- crystals
    def crystal(self, base, axis, r, L, col, k=2.2, solid=0):
        col = self.deep(col); k = k * self.cgs
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
        c = Vector(p) + nw * 0.008; ph = rng.uniform(0, 6.28); seg = self.seg; arc = []
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
    def mat(self, c, rx, ry, rot, col, k=1.6, lift=0.045, seg=10, glow=True, size=None, sprouts=2):
        from mathutils import Vector
        import math
        rng = self.rng; cx, cy = c[0], c[1]; zt = (c[2] + 1.5) if len(c) > 2 else 3.0
        pool = self.role(col)
        def at(r, a, fr):
            x = cx + (math.cos(a) * rx * math.cos(rot) - math.sin(a) * ry * math.sin(rot)) * r * fr
            y = cy + (math.cos(a) * rx * math.sin(rot) + math.sin(a) * ry * math.cos(rot)) * r * fr
            hit = self.down(x, y, zt); return Vector((x, y, hit.z if hit is not None else 0.0))
        ph = rng.uniform(0, 6.28); fr = [0.72 + 0.2 * math.sin(3 * (i / seg) * 6.283 + ph) + 0.12 * rng.uniform(-1, 1) for i in range(seg)]
        cen = at(0, 0, 1); ip = [at(0.62, i / seg * 6.283, fr[i] * rng.uniform(0.85, 1.1)) for i in range(seg)]
        zp = min([q.z for q in ip] + [cen.z]) + lift * 1.35                  # the pool is level (fluid): sleepers and rails may stand out of it
        C = self.bm.verts.new(Vector((cen.x, cen.y, zp))); inner = [self.bm.verts.new(Vector((q.x, q.y, zp))) for q in ip]
        outer_p = [at(1.0, i / seg * 6.283, fr[i]) for i in range(seg)]
        outer = [self.bm.verts.new(q + Vector((0, 0, lift))) for q in outer_p]; foot = [self.bm.verts.new(q + Vector((0, 0, 0.008))) for q in outer_p]
        gC = [x * k for x in col]; gI = [x * k * 0.4 for x in col]; gO = [x * k * 0.06 for x in col]; gF = [x * k * 0.05 for x in col]
        U = lambda v: ((v.co.x - cx) / 1.2, (v.co.y - cy) / 1.2); up = Vector((0, 0, 1))
        for i in range(seg):
            j = (i + 1) % seg
            self.face([C, inner[i], inner[j]], pool, [U(C), U(inner[i]), U(inner[j])], [(0, 0, 0)] * 3, 0, up)          # the pool: lit fluid (flat, unlit)
            self.face([inner[i], outer[i], outer[j], inner[j]], 'st_growth', [U(inner[i]), U(outer[i]), U(outer[j]), U(inner[j])], [gI, gO, gO, gI], 0, up)    # its fibrous lip
            self.face([outer[i], foot[i], foot[j], outer[j]], 'st_growth', [U(outer[i]), U(foot[i]), U(foot[j]), U(outer[j])], [gO, gF, gF, gO], 0, (outer[i].co + outer[j].co) / 2 - cen)
        self.stats['mat'] += 1
        for i in range(sprouts):                                      # small shards come up through the mat (it is the growth, not a sheet)
            a = rng.uniform(0, 6.283); r = rng.uniform(0.1, 0.55); q = at(r, a, 1.0)
            L = rng.uniform(0.14, 0.4); self.crystal(q, Vector((rng.uniform(-0.4, 0.4), rng.uniform(-0.4, 0.4), 1.0)), L * 0.16, L, col, 2.4)
        if glow: self.glow(cen + Vector((0, 0, 1.8)), col, size or max(2.5, (rx + ry) * 1.6), 0.35)
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

# ---------------------------------------------------------------- the per-map plumbing (every make_<map>.py uses it the same way; see make_yard.py)
# A map script supplies: its palette P (below), the lamps it keeps, and a layout(B) that places the hearts. It calls, with G = globals():
#   after make_pictures():  bloom_pictures(G)                  after build():   bloom_dim_lamps(G, P)
#   after lights():         bob = bloom_grow(G, layout, P); bloom_relight(G, P)
#   in bake(): save with save_exr_linear;  after the map's bake: bloom_bake(G, bob, P);  then always bloom_split(G, bob)
# P keys (all optional but name): name, lead (colour), second (colour), lead_mat / second_mat (unlit material names), keep [(x, y)...],
#   lamp (colour of the lamps still burning), lamp_k (their power), amber_glow (halo on kept lamps), moon (direction), moon_e, moon_col,
#   indoor (no sky light: the sky as painted only), skyk, sky {night_sky kwargs}, gs, cgs, sat, step, seg, glowk, lm (bloom light size), seed
import math, os
ROLE_A, ROLE_B = 'emissive_teal', 'emissive_violet'          # slot names the growth uses for the lead and second unlit colours (any hue)
GROWTH_PX = 512                                              # the growth picture, the same for every map (the game draws colour pictures at 512)

def _light_parts(L):
    i = next(k for k, v in enumerate(L) if isinstance(v, (int, float)))      # (subway's entries start with a kind letter)
    return i
def bloom_pictures(G):
    G['PICS']['growth'] = G['save_image'](bloom_bark(GROWTH_PX), 'bloom_growth', G['TEXDIR'])
def bloom_dim_lamps(G, P):
    """most lamps die: only those near P['keep'] stay (dimmer, recoloured); every emissive face with no kept light near it goes dark"""
    import bpy
    LIGHTS, bm, MATS, MI, log = G['LIGHTS'], G['bm'], G['MATS'], G['MI'], G['log']
    keep, k, col = P.get('keep', []), P.get('lamp_k', 0.6), P.get('lamp', (1.0, 0.6, 0.28)); out = []
    every = int(P.get('keep_every', 0))
    for n, L in enumerate(LIGHTS):
        i = _light_parts(L)
        if any(math.hypot(L[i] - x, L[i + 1] - y) < 0.9 for x, y in keep) or (every and n % every == 0):
            L = list(L); L[i + 3] = L[i + 3] * k; L[i + 4] = col if not P.get('lamp_keep_col') else L[i + 4]; out.append(tuple(L))
    LIGHTS[:] = out; dead_mat = 'glass' if 'glass' in MI else ('grime' if 'grime' in MI else 'metal'); dead = 0
    for f in bm.faces:
        if MATS[f.material_index].startswith('emissive'):
            c = f.calc_center_median()
            if not any(math.hypot(c.x - L[_light_parts(L)], c.y - L[_light_parts(L) + 1]) < 1.8 for L in LIGHTS): f.material_index = MI[dead_mat]; dead += 1
    lc = P.get('lamp_face', (1.0, 0.45, 0.12))
    for name in ('emissive_lamp',):
        m = bpy.data.materials.get(name)
        if m:
            b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
            b.inputs['Base Color'].default_value = (*lc, 1); b.inputs['Emission Color'].default_value = (*lc, 1); b.inputs['Emission Strength'].default_value = 1.6
    log('bloom: lamps kept %d, dead lamp faces %d' % (len(LIGHTS), dead))
def bloom_materials(G, P):
    import bpy
    out = {}
    m = bpy.data.materials.get('st_growth') or bpy.data.materials.new('st_growth'); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes):
        if n.type not in ('BSDF_PRINCIPLED', 'OUTPUT_MATERIAL'): nt.nodes.remove(n)
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = G['PICS']['growth']; uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'UVMap'
    nt.links.new(uvn.outputs['UV'], tx.inputs['Vector']); nt.links.new(tx.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.6; bsdf.inputs['Metallic'].default_value = 0.0
    at = nt.nodes.new('ShaderNodeAttribute'); at.attribute_name = 'glow'; mul = nt.nodes.new('ShaderNodeVectorMath'); mul.operation = 'SCALE'
    nt.links.new(at.outputs['Color'], mul.inputs[0]); mul.inputs['Scale'].default_value = 0.4           # emitted = glow x the picture's brightness
    nt.links.new(mul.outputs['Vector'], bsdf.inputs['Emission Color']); bsdf.inputs['Emission Strength'].default_value = 1.0
    out['st_growth'] = m; vk = P.get('vein', 0.22)
    for role, name, col in ((ROLE_A, P.get('lead_mat', 'emissive_teal'), P.get('lead', BLOOM_TEAL)), (ROLE_B, P.get('second_mat', 'emissive_violet'), P.get('second', BLOOM_VIOLET))):
        m = bpy.data.materials.get(name) or bpy.data.materials.new(name); m.use_nodes = True; bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        c = tuple(x * vk for x in col); bsdf.inputs['Base Color'].default_value = (*c, 1); bsdf.inputs['Emission Color'].default_value = (*c, 1); bsdf.inputs['Emission Strength'].default_value = 1.0
        out[role] = m
    out['emissive_lamp'] = bpy.data.materials.get('emissive_lamp') or bpy.data.materials.new('emissive_lamp')
    return out
def bloom_grow(G, layout, P):
    import bpy
    from mathutils.bvhtree import BVHTree
    yob = G['ob']; log = G['log']; mats = bloom_materials(G, P); names = ['st_growth', ROLE_A, ROLE_B, 'emissive_lamp']
    bvh = BVHTree.FromObject(yob, bpy.context.evaluated_depsgraph_get())
    B = Bloom(bvh, {n: i for i, n in enumerate(names)}, seed=int(P.get('seed', 3)))
    B.ca, B.cb = P.get('lead', BLOOM_TEAL), P.get('second', BLOOM_VIOLET)
    B.gs = P.get('gs', 0.42); B.cgs = P.get('cgs', 1.0); B.sat = P.get('sat', 1.0); B.step = P.get('step', 0.6); B.seg = P.get('seg', 7); B.rk = P.get('rk', 1.0)
    layout(B)
    B.merge_glows(int(P.get('max_glows', 45)) - (len(P.get('keep', [])) if P.get('amber_glow', True) else 0))
    if P.get('amber_glow', True):
        for x, y in P.get('keep', []):
            Ls = [L for L in G['LIGHTS'] if math.hypot(L[_light_parts(L)] - x, L[_light_parts(L) + 1] - y) < 0.9]
            if Ls: L = Ls[0]; i = _light_parts(L); B.glow((L[i], L[i + 1], L[i + 2] + 0.2), P.get('lamp', BLOOM_AMBER), 3.0, 0.0)      # lk 0: the lamp itself already shines
    me = B.to_mesh('bloom')
    for v in me.vertices: v.co.z = max(v.co.z, 0.0)          # nothing below the ground (the exporter measures heights from the lowest point)
    for n in names: me.materials.append(mats[n])
    bob = bpy.data.objects.new('bloom', me); bpy.data.collections['map'].objects.link(bob)
    bob['hg_lightmap'] = 'tex/%s_bloom_light.exr' % P['name']; bob['hg_lightmap_size'] = int(P.get('lm', 512)); bob.visible_shadow = False
    me.calc_loop_triangles(); log('bloom:', B.stats, len(me.loop_triangles), 'triangles,', len(B.glows), 'glow points')
    lu = me.uv_layers.new(name='Lightmap'); me.uv_layers.active = lu; G['smart_uv'](bob, 66, 0.004); me.uv_layers.active = me.uv_layers['UVMap']
    gc = bpy.data.collections.get('glows') or bpy.data.collections.new('glows')
    if gc.name not in G['scene'].collection.children: G['scene'].collection.children.link(gc)
    for i, (p, col, size, lk) in enumerate(B.glows):
        e = bpy.data.objects.new('glow.%03d' % i, None); e.empty_display_type = 'SPHERE'; e.empty_display_size = 0.3; e.location = p
        e['r'], e['g'], e['b'], e['size'] = float(col[0]), float(col[1]), float(col[2]), float(size); e['lk'] = lk; gc.objects.link(e)
    return bob
def bloom_relight(G, P):
    """after the map's own lights(): the sun becomes the moon, the world the night sky, and a lamp at every glow point"""
    import bpy
    from mathutils import Vector
    scene, log, TEXDIR = G['scene'], G['log'], G['TEXDIR']
    sun = next((o for o in scene.objects if o.type == 'LIGHT' and o.data.type == 'SUN'), None)
    moon = Vector(P.get('moon', (0.36, 0.79, 0.5))).normalized()
    if sun:
        sun.data.energy = P.get('moon_e', 1.3); sun.data.color = P.get('moon_col', (0.62, 0.76, 1.0)); sun.data.angle = math.radians(1.0)
        sun.rotation_euler = (-moon).to_track_quat('-Z', 'Y').to_euler(); lc = sun.users_collection[0]
    else: lc = bpy.data.collections.get('lights') or scene.collection
    gk = P.get('glowk', 3.2); n = 0
    for e in bpy.data.collections['glows'].objects:
        if e.get('lk', 1.0) <= 0: continue
        ld = bpy.data.lights.new(e.name, 'POINT'); ld.energy = gk * e.get('lk', 1.0) * e['size'] ** 2; ld.color = (e['r'], e['g'], e['b']); ld.shadow_soft_size = 0.5
        lo = bpy.data.objects.new('L' + e.name, ld); lc.objects.link(lo); lo.location = e.location; n += 1
    fill = float(P.get('fill', 0.0))
    if fill > 0:                            # "eyes adjusted to the dark": a low, even, cool fill everywhere (shadowless lamps on a grid), the pools go on top
        ob = G['ob']; bb = [ob.matrix_world @ Vector(c) for c in ob.bound_box]; x0, x1 = min(v.x for v in bb), max(v.x for v in bb); y0, y1 = min(v.y for v in bb), max(v.y for v in bb)
        z = min(v.z for v in bb) + float(P.get('fill_h', 2.6)); sp = float(P.get('fill_s', 7.0)); nf = 0; fc = P.get('fill_col', (0.62, 0.74, 1.0))
        nx, ny = max(1, int((x1 - x0) / sp)), max(1, int((y1 - y0) / sp))
        for i in range(nx + 1):
            for j in range(ny + 1):
                ld = bpy.data.lights.new('fill', 'POINT'); ld.energy = fill * 40.0 * sp * sp; ld.color = fc; ld.shadow_soft_size = 2.0
                for attr in ('use_shadow',):
                    try: setattr(ld, attr, False)
                    except Exception: pass
                try: ld.cycles.cast_shadow = False
                except Exception: pass
                lo = bpy.data.objects.new('fill', ld); lc.objects.link(lo); lo.location = (x0 + (x1 - x0) * i / nx, y0 + (y1 - y0) * j / ny, z); nf += 1
        log('bloom fill: %d shadowless lamps, %.0f W each' % (nf, fill * 40.0 * sp * sp))
    W = int(P.get('sky_w', 1024)); sky = night_sky(W, tuple(moon), **P.get('sky', {})); H = sky.shape[0]
    path = os.path.join(TEXDIR, '%s_night_sky.exr' % P['name']); old = bpy.data.images.get(P['name'] + '_night_sky')
    if old: bpy.data.images.remove(old)
    im = bpy.data.images.new(P['name'] + '_night_sky', W, H, alpha=False, float_buffer=True); im.pixels.foreach_set(np.concatenate([sky, np.ones((H, W, 1), np.float32)], 2).ravel())
    save_exr_linear(im, path); bpy.data.images.remove(im); im = bpy.data.images.load(path); im.name = P['name'] + '_night_sky'
    w = scene.world or bpy.data.worlds.new(P['name'] + '_sky'); scene.world = w; w.use_nodes = True; nt = w.node_tree
    for nd in list(nt.nodes): nt.nodes.remove(nd)
    out = nt.nodes.new('ShaderNodeOutputWorld'); bg = nt.nodes.new('ShaderNodeBackground'); env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = im
    nt.links.new(env.outputs['Color'], bg.inputs['Color']); nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    lp = nt.nodes.new('ShaderNodeLightPath'); mr = nt.nodes.new('ShaderNodeMapRange'); nt.links.new(lp.outputs['Is Camera Ray'], mr.inputs['Value'])      # the sky as seen: as painted;
    mr.inputs['To Min'].default_value = P.get('skyk', 1.0 if P.get('indoor') else 4.0); mr.inputs['To Max'].default_value = 1.0          # as light: brighter outdoors
    nt.links.new(mr.outputs['Result'], bg.inputs['Strength']); scene.view_settings.exposure = 0.0
    log('bloom lights: moon %.2f, %d glow lights, sky %dx%d' % (sun.data.energy if sun else 0, n, W, H))
def bloom_bake(G, bob, P, samples=40):
    import bpy
    scene, TEXDIR = G['scene'], G['TEXDIR']; size = int(P.get('lm', 512))
    me = bob.data; me.uv_layers.active = me.uv_layers['Lightmap']
    img = bpy.data.images.new(P['name'] + '_bloom_light', size, size, alpha=False, float_buffer=True)
    for m in me.materials:
        nt = m.node_tree; n = nt.nodes.new('ShaderNodeTexImage'); n.name = 'hg_bake'; n.image = img; nt.nodes.active = n
    scene.render.engine = 'CYCLES'; scene.cycles.samples = samples; scene.cycles.device = 'CPU'
    vl = bpy.context.view_layer
    for o in list(vl.objects):
        if o is not None: o.select_set(False)
    vl.objects.active = bob; bob.select_set(True)
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=3, use_clear=True)
    a = np.array(img.pixels[:], np.float32).reshape(size, size, 4); rgb = a[:, :, :3]; blur = rgb.copy()
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)): blur += np.roll(np.roll(rgb, dy, 0), dx, 1)
    a[:, :, :3] = blur / 5.0; img.pixels.foreach_set(a.ravel())
    path = os.path.join(TEXDIR, '%s_bloom_light.exr' % P['name']); save_exr_linear(img, path)
    for m in me.materials:
        n = m.node_tree.nodes.get('hg_bake')
        if n: m.node_tree.nodes.remove(n)
    me.uv_layers.active = me.uv_layers['UVMap']; bpy.data.images.remove(img)
    G['log']('bloom baked; glow added to %d texels' % bloom_glow_into(bob, path))
def bloom_split(G, bob):
    """the growth as two objects with the same light picture: `bloom` (big crystals on the ground: solid) and `bloom_soft` (hg_soft = 1)"""
    import bpy, bmesh
    soft = bob.copy(); soft.data = bob.data.copy(); soft.name = 'bloom_soft'; soft.data.name = 'bloom_soft'; bpy.data.collections['map'].objects.link(soft); soft['hg_soft'] = 1
    for o, keep in ((bob, 1), (soft, 0)):
        b2 = bmesh.new(); b2.from_mesh(o.data); lay = b2.faces.layers.int.get('solid')
        bmesh.ops.delete(b2, geom=[f for f in b2.faces if f[lay] != keep], context='FACES'); b2.to_mesh(o.data); b2.free()
        o.data.calc_loop_triangles(); G['log']('bloom part', o.name, len(o.data.loop_triangles), 'triangles')

# ---- hearts and trails placed from the map itself (the later maps: give a centre and a radius, the growth finds walls, tops and floor)
def _bloom_scan(self, c, R, n=320):
    """sample the disc: where is floor, where are tops (crate, car roof, shelf), where do walls stand at the floor's edge"""
    from mathutils import Vector
    rng = self.rng; tops, floor, walls = [], [], []
    for i in range(n):
        r = R * math.sqrt(rng.random()); a = rng.uniform(0, 2 * math.pi); x, y = c[0] + r * math.cos(a), c[1] + r * math.sin(a)
        u = self.ray((x, y, 1.0), (0, 0, 1), 14.0); zc = u[0].z if (u[0] is not None and u[1].z < -0.5) else 40.0      # a ceiling over it, or open sky (or inside a solid)
        h = self.ray((x, y, zc - 0.05), (0, 0, -1), zc + 2.0)
        if h[0] is None or h[1].z < 0.8: continue
        z = h[0].z
        if z < 0.45:
            floor.append((x, y, z, zc))
            for k in range(8):
                d = Vector((math.cos(k * math.pi / 4), math.sin(k * math.pi / 4), 0)); w = self.ray((x, y, z + 0.6), d, 0.8)
                if w[0] is not None and abs(w[1].z) < 0.2 and self.ray((x, y, z + 1.8), d, 1.0)[0] is not None: walls.append((w[0], w[1].copy(), z, zc)); break
        elif z >= 0.6 and zc - z > 0.9:
            if all((self.ray((x + dx, y + dy, zc - 0.05), (0, 0, -1), zc + 2.0)[0] or Vector((0, 0, -9))).z > z - 0.12 for dx, dy in ((0.35, 0), (-0.35, 0), (0, 0.35), (0, -0.35))):
                tops.append((x, y, z, zc))
    return tops, floor, walls
def _bloom_pick(self, pts, k, gap, key=lambda p: (p[0], p[1])):
    out = []
    for p in sorted(pts, key=lambda p: self.rng.random()):
        if len(out) >= k: break
        if all(math.hypot(key(p)[0] - key(q)[0], key(p)[1] - key(q)[1]) >= gap for q in out): out.append(p)
    return out
def _bloom_heart(self, c, R, col=None, col2=None, frac2=0.3, clusters=5, vines=8, shelves=2, roots=5, sprouts=3, Lmax=2.2, size=None, k=2.3):
    """one heart: crystals on the tops near it (bigger near the middle), roots up the walls, fans on a few walls, roots over the floor from
    the middle out, knee-high shards at wall feet. Everything soft. One glow at the middle; the clusters and fans bring their own."""
    from mathutils import Vector
    col = col or self.ca; col2 = col2 or self.cb; rng = self.rng
    tops, floor, walls = self.scan(c, R)
    pick = lambda: col2 if rng.random() < frac2 else col
    for (x, y, z, zc) in self.pick(tops, clusters, 2.2):
        dc = math.hypot(x - c[0], y - c[1]) / max(R, 1e-3); L = min(Lmax * (1.0 - 0.5 * dc) * rng.uniform(0.75, 1.0), zc - z - 0.3)
        if L > 0.4: self.cluster((x, y, z), rng.randint(5, 8), L, pick(), k, spread=min(0.9, 0.35 + L * 0.25), lean=0.5, size=max(3.0, L * 3.0))
    ws = self.pick(walls, vines + shelves + sprouts, 1.1, key=lambda w: (w[0].x, w[0].y))
    for i, (hp, nw, z, zc) in enumerate(ws):
        cc = pick(); vein = self.role(cc)
        if i < vines:
            self.vine((hp.x + nw.x * 0.03, hp.y + nw.y * 0.03, z + 0.25), (0, 0, 1), min(rng.uniform(3.5, 7.0), (zc - z) * 1.6), rng.uniform(0.09, 0.14), 0.07, cc, vein, branches=1, wander=0.4)
        elif i < vines + shelves:
            self.shelves((hp.x + nw.x * 0.6, hp.y + nw.y * 0.6, z + min(1.7, (zc - z) * 0.55)), (-nw.x, -nw.y, 0), 2.6, 1.4, 5, cc, self.role(cc), size=3.5)
        else:
            self.cluster((hp.x + nw.x * 0.25, hp.y + nw.y * 0.25, z), rng.randint(3, 5), rng.uniform(0.35, 0.6), cc, k, spread=0.25, lean=0.6, glow=False)
    g = min(floor, key=lambda f: math.hypot(f[0] - c[0], f[1] - c[1])) if floor else (c[0], c[1], 0.0, 40.0)
    for i in range(roots):
        a = i * 2 * math.pi / max(roots, 1) + rng.uniform(-0.4, 0.4)
        self.vine((g[0] + math.cos(a) * 0.4, g[1] + math.sin(a) * 0.4, g[2] + 0.02), (math.cos(a), math.sin(a), 0), R * rng.uniform(0.5, 0.9), 0.17, 0.08, col, self.role(col), branches=1, wander=0.4)
    self.glow((g[0], g[1], g[2] + min(1.6, (g[3] - g[2]) * 0.6)), col, size or R * 0.9)
def _bloom_trail(self, pts, col=None, vines=2):
    """growth thinning out along a path: a root over the floor from point to point, a few climbers near each point"""
    col = col or self.ca
    for a, b in zip(pts[:-1], pts[1:]):
        d = (b[0] - a[0], b[1] - a[1], 0); L = math.hypot(d[0], d[1])
        h = self.down(a[0], a[1], 1.0) ; z = h.z if h is not None else 0.0
        self.vine((a[0], a[1], z + 0.02), d, L * 1.05, 0.14, 0.07, col, self.role(col), branches=1, wander=0.3)
    for p in pts[1:]:
        tops, floor, walls = self.scan(p, 3.0, 80)
        for (hp, nw, z, zc) in self.pick(walls, vines, 1.2, key=lambda w: (w[0].x, w[0].y)):
            self.vine((hp.x + nw.x * 0.03, hp.y + nw.y * 0.03, z + 0.25), (0, 0, 1), min(5.0, (zc - z) * 1.5), 0.1, 0.06, col, self.role(col), wander=0.4)
Bloom.scan = _bloom_scan; Bloom.pick = _bloom_pick; Bloom.heart = _bloom_heart; Bloom.trail = _bloom_trail

# ---- "More crystals": pools of light in the darkest walkable places (added after the Bloom rollout; the functions above are untouched)
def _bloom_count(self):
    """count every cluster() call from here on: self.ncl = [all, with a glow]"""
    self.ncl = [0, 0]; orig = self.cluster
    def counted(*a, **k):
        self.ncl[0] += 1
        if k.get('glow', True): self.ncl[1] += 1
        return orig(*a, **k)
    self.cluster = counted
def _bloom_fill(self, n, area, cols, frac2=0.3, gap=4.5, ring=None, samples=7000, big=0.15, Lbig=2.6, Lmed=1.6, Lsmall=0.9, tops_bonus=1.25, clear=2.6, min_head=2.6, avoid=(), top_max=3.4, sizek=1.25, wall_frac=0.5, top_boost=1.3, cnt=None, flat=0.35, top_min=0.6, top_gap=2.5):
    """n new clusters, one at a time at the walkable spot farthest from every glow so far (so the dark places get lit first). Spots: the top of
    something (crate, roof, shelf; headroom over 0.9 m) or the foot of a wall (0.5 m from it, with `clear` metres of open floor in front, so a way stays
    wide). Not near the ring of start spots (ring = (cx, cy, R)) or any point in `avoid`. area = (x0, x1, y0, y1). Everything the existing cluster() makes (soft)."""
    from mathutils import Vector
    rng = self.rng; cand = []
    bad = [(ring[0] + ring[2] * math.cos(k * math.pi / 6), ring[1] + ring[2] * math.sin(k * math.pi / 6)) for k in range(12)] if ring else []
    bad += list(avoid)
    for i in range(samples):
        x, y = rng.uniform(area[0], area[1]), rng.uniform(area[2], area[3])
        u = self.ray((x, y, 1.0), (0, 0, 1), 14.0); zc = u[0].z if (u[0] is not None and u[1].z < -0.5) else 40.0
        h = self.ray((x, y, zc - 0.05), (0, 0, -1), zc + 2.0)
        if h[0] is None or h[1].z < 0.8: continue
        z = h[0].z
        if z < min(0.45, top_min - 0.05):
            if zc < min_head: continue
            for k in range(8):
                d = Vector((math.cos(k * math.pi / 4), math.sin(k * math.pi / 4), 0)); w = self.ray((x, y, z + 0.6), d, 0.9)
                if w[0] is None or abs(w[1].z) > 0.2 or self.ray((x, y, z + 1.8), d, 1.0)[0] is None: continue
                bx, by = w[0].x - d.x * 0.5, w[0].y - d.y * 0.5; g = self.ray((bx, by, z + 1.0), (0, 0, -1), 3.0)
                if g[0] is None or abs(g[0].z - z) > 0.2 or g[1].z < 0.8: break
                if self.ray((bx, by, z + 0.9), -d, clear)[0] is not None or self.ray((bx, by, z + 1.8), -d, clear)[0] is not None: break
                cand.append(('wall', (bx, by, g[0].z), zc, 1.0)); break
        elif top_min <= z <= top_max and zc - z > 0.9:
            if all((self.ray((x + dx, y + dy, zc - 0.05), (0, 0, -1), zc + 2.0)[0] or Vector((0, 0, -9))).z > z - 0.12 for dx, dy in ((flat, 0), (-flat, 0), (0, flat), (0, -flat))):
                cand.append(('top', (x, y, z), zc, tops_bonus))
    cand = [c for c in cand if all(math.hypot(c[1][0] - b[0], c[1][1] - b[1]) > 3.5 for b in bad)]
    P = np.array([[c[1][0], c[1][1]] for c in cand], np.float64); W = np.array([c[3] for c in cand])
    lit = [np.array(g[0][:2]) for g in self.glows]
    dmin = np.full(len(cand), 1e9)
    for g in lit: dmin = np.minimum(dmin, np.hypot(P[:, 0] - g[0], P[:, 1] - g[1]))
    out = []; isw = np.array([c[0] == 'wall' for c in cand]); nw = 0; nt = 0; need = np.where(isw, gap, top_gap)
    for r in range(n):
        if not len(cand): break
        Wm = W * np.where(isw & (nw > nt * wall_frac / (1.0 - wall_frac)), 0.0, 1.0)          # walls only while they stay at most wall_frac of the new ones
        sc = np.where(dmin >= need, dmin * Wm, 0.0); j = int(np.argmax(sc))
        if sc[j] <= 0: break
        kind, base, zc, _ = cand[j]; out.append((kind, base)); dmin = np.minimum(dmin, np.hypot(P[:, 0] - base[0], P[:, 1] - base[1]))
        if kind == 'wall': nw += 1
        else: nt += 1
        L = Lbig if r < n * big else (Lmed if r < n * 0.5 else Lsmall); L *= rng.uniform(0.85, 1.1) * (top_boost if kind == 'top' else 1.0); L = min(L, zc - base[2] - 0.3)
        if L < 0.45: continue
        col = cols[1] if rng.random() < frac2 else cols[0]
        if kind == 'wall': self.cluster(base, rng.randint(*(cnt or (4, 7))), L, col, 2.3, spread=min(0.45, 0.22 + 0.1 * L), lean=0.5, size=max(3.5, L * 3.4) * sizek)
        else: self.cluster(base, rng.randint(*(cnt or (6, 9))), L, col, 2.3, spread=min(0.6, 0.2 + L * 0.12), lean=0.5, size=max(3.5, L * 3.4) * sizek)
    return out
Bloom.counting = _bloom_count; Bloom.fill_dark = _bloom_fill

# ---------------------------------------------------------------- MIDDAY (the owner's "midday blocky shooter" look; `plain` without `dusk`)
# One place for the day numbers: every map script calls day_light(globals(), name) after its lights; sky_only.py repaints with day_sky.
DAY = dict(elev=60.0, sun_e=4.2, sun_col=(1.0, 0.96, 0.88), sun_angle=0.8, sky_k=1.5, sky_w=1024,
           zen=(0.12, 0.30, 0.80), hor=(0.58, 0.74, 0.95), ground=(0.40, 0.39, 0.35))
# horizontal direction TOWARD the sun for each map (kept from each map's old light, so shadows fall the way they did)
DAY_SUN_XY = dict(yard=(-0.40, -0.88), street=(-0.40, -0.88), subway=(-0.40, -0.88), lab=(-0.40, -0.88), depot=(0.45, -0.50),
                  outpost=(-0.45, 0.55), carnival=(0.40, 0.50), mall=(-0.55, -0.25))
def day_sun_vec(name, elev=None):
    h = np.array(DAY_SUN_XY[name], float); h /= np.linalg.norm(h); e = math.radians(DAY['elev'] if elev is None else elev)
    return (float(h[0] * math.cos(e)), float(h[1] * math.cos(e)), float(math.sin(e)))     # unit vector pointing at the sun

def _vnoise3(P, seed):
    i = np.floor(P).astype(np.int64); f = (P - i).astype(np.float32); f = f * f * (3 - 2 * f)
    def h(dx, dy, dz):
        n = ((i[..., 0] + dx) * 374761393 + (i[..., 1] + dy) * 668265263 + (i[..., 2] + dz) * 1274126177 + seed * 1442695041) & 0xFFFFFFFF
        n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF; n ^= n >> 16
        return (n & 0xFFFF).astype(np.float32) / 65535.0
    fx, fy, fz = f[..., 0], f[..., 1], f[..., 2]
    def lx(dy, dz): return h(0, dy, dz) * (1 - fx) + h(1, dy, dz) * fx
    a = lx(0, 0) * (1 - fy) + lx(1, 0) * fy; b = lx(0, 1) * (1 - fy) + lx(1, 1) * fy
    return a * (1 - fz) + b * fz

def day_sky(W=2048, sun=(-0.2, -0.43, 0.87), seed=7, zen=None, hor=None, ground=None, cloud=0.5, sun_k=1.0):
    """an equirectangular clear-day sky (linear light, same layout as night_sky: middle of the picture = +X, row 0 = straight down):
    blue overhead, paler toward a hazy horizon, a soft bright area round the sun, a few soft white clouds. Returns (H, W, 3) floats."""
    H = W // 2
    v = (np.arange(H, dtype=np.float32) + 0.5) / H; u = (np.arange(W, dtype=np.float32) + 0.5) / W
    th = (v - 0.5) * np.pi; ph = -(u - 0.5) * 2 * np.pi
    ct = np.cos(th)[:, None]; X = ct * np.cos(ph)[None, :]; Y = ct * np.sin(ph)[None, :]; Z = np.repeat(np.sin(th)[:, None], W, 1)
    D = np.stack([X, Y, Z], 2).astype(np.float32)
    zen = np.array(zen or DAY['zen'], np.float32); hor = np.array(hor or DAY['hor'], np.float32); gr = np.array(ground or DAY['ground'], np.float32)
    z = np.clip(Z, 0, 1)[..., None]
    t = (1 - z) ** 2.6                                                   # 0 overhead, 1 at the horizon
    sky = zen + (hor - zen) * t
    s = np.array(sun, np.float32); s /= np.linalg.norm(s); a = np.degrees(np.arccos(np.clip(D @ s, -1, 1)))
    glow = (0.55 * np.exp(-a / 7.0) + 0.16 * np.exp(-a / 28.0))[..., None] * np.array((1.0, 0.93, 0.78), np.float32) * sun_k
    sky = sky + glow * (0.5 + 0.5 * (1 - t))
    # a few soft clouds: layered noise stretched along the horizon, thinning toward it, brighter and whiter near the sun
    n = np.zeros(Z.shape, np.float32); amp = 1.0; tot = 0.0; fr = 1.7
    for o in range(5):
        n += amp * _vnoise3(D * np.array((fr, fr, fr * 2.6), np.float32) + 11.0 * o, seed + o); tot += amp; amp *= 0.5; fr *= 2.05
    n /= tot
    cov = _smoothstep(0.60 - 0.12 * cloud, 0.74 - 0.12 * cloud, n) * _smoothstep(0.04, 0.30, Z)
    lit = np.clip(0.55 + 0.45 * (D @ s), 0, 1)[..., None]
    c0 = np.array((0.80, 0.86, 0.97), np.float32); c1 = np.array((1.12, 1.10, 1.04), np.float32); ccol = c0 + (c1 - c0) * lit
    ccol = ccol * (1 - 0.10 * _smoothstep(0.66, 0.82, n)[..., None])
    sky = sky * (1 - 0.92 * cov[..., None]) + ccol * (0.92 * cov[..., None])
    sky = sky + (7.0 * np.exp(-a / 1.1))[..., None] * np.array((1.0, 0.96, 0.86), np.float32)
    below = _smoothstep(0.0, -0.08, Z)[..., None]; sky = sky * (1 - below) + gr * below          # the ground, if anything looks down past the horizon
    return sky.astype(np.float32)

def day_light(G, name, elev=None):
    """midday light for a map script (call after its lights()/post_lights()): a high, nearly white sun, a clear painted sky as the world
    (lights the shade with blue-white bounce), and the sky as seen. The lamps stay."""
    import bpy
    from mathutils import Vector
    scene, TEXDIR, log = G['scene'], G['TEXDIR'], G['log']
    sv = day_sun_vec(name, elev); sun = bpy.data.objects.get('Sun')
    if sun is None:
        sd = bpy.data.lights.new('Sun', 'SUN'); sun = bpy.data.objects.new('Sun', sd); bpy.data.collections['lights'].objects.link(sun)
    sun.data.energy = DAY['sun_e']; sun.data.color = DAY['sun_col']; sun.data.angle = math.radians(DAY['sun_angle'])
    sun.rotation_euler = (-Vector(sv)).to_track_quat('-Z', 'Y').to_euler(); sun.hide_render = False
    W = DAY['sky_w']; sky = day_sky(W, sv); H = sky.shape[0]
    path = os.path.join(TEXDIR, '%s_day_sky.exr' % name); old = bpy.data.images.get(name + '_day_sky')
    if old: bpy.data.images.remove(old)
    im = bpy.data.images.new(name + '_day_sky', W, H, alpha=False, float_buffer=True); im.pixels.foreach_set(np.concatenate([sky, np.ones((H, W, 1), np.float32)], 2).ravel())
    save_exr_linear(im, path); bpy.data.images.remove(im); im = bpy.data.images.load(path); im.name = name + '_day_sky'
    w = scene.world or bpy.data.worlds.new(name + '_sky'); scene.world = w; w.use_nodes = True; nt = w.node_tree
    for nd in list(nt.nodes): nt.nodes.remove(nd)
    out = nt.nodes.new('ShaderNodeOutputWorld'); bg = nt.nodes.new('ShaderNodeBackground'); env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = im
    nt.links.new(env.outputs['Color'], bg.inputs['Color']); nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    lp = nt.nodes.new('ShaderNodeLightPath'); mr = nt.nodes.new('ShaderNodeMapRange'); nt.links.new(lp.outputs['Is Camera Ray'], mr.inputs['Value'])
    mr.inputs['To Min'].default_value = DAY['sky_k']; mr.inputs['To Max'].default_value = 1.0          # as light: a little brighter (the bounce); as seen: as painted
    nt.links.new(mr.outputs['Result'], bg.inputs['Strength']); scene.view_settings.exposure = 0.0
    log('day light: sun %.1f at %.0f deg, sky %dx%d x%.1f' % (DAY['sun_e'], math.degrees(math.asin(sv[2])), W, H, DAY['sky_k']))
