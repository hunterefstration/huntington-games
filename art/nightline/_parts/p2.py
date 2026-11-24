
# ---------------------------------------------------------------- geometry kit: one bmesh, a material per face, UV 'UVMap' (colour picture) + 'Lightmap'
bm = bmesh.new(); UVL = bm.loops.layers.uv.new('UVMap'); LML = bm.loops.layers.uv.new('Lightmap')
EMISSIVE = {i for i, n in enumerate(MATS) if n.startswith('emissive')}
SELFI = {MI[k]: v for k, v in SELFLIT.items()}
TINY = [(0.0, 0.0), (1e-3, 0.0), (1e-3, 1e-3), (0.0, 1e-3)]
LIGHTS = []; GLOWS = []
def LT(p, col, W, r=0.3): LIGHTS.append((tuple(p), tuple(col), float(W), r))
def pw(L, h): return L * 35.5 * h * h                     # watts for a point lamp at height h to light the ground under it to L (calibrated: 1000 W at 8 m -> 0.44)
def GLW(p, name, size): GLOWS.append((tuple(p), COL[name], size))
NFACE = [0]
def F(vs, mat, uv=None, lm=None, hint=None, dens=1.0, tile=3.0):
    vs = [Vector(v) for v in vs]; n = len(vs)
    nm = Vector((0, 0, 0))
    for k in range(n):
        a = vs[k]; b = vs[(k + 1) % n]; nm.x += (a.y - b.y) * (a.z + b.z); nm.y += (a.z - b.z) * (a.x + b.x); nm.z += (a.x - b.x) * (a.y + b.y)
    if nm.length < 1e-9: return None
    nm.normalize()
    if hint is not None and nm.dot(hint) < 0:
        vs.reverse(); nm = -nm
        if uv: uv = uv[::-1]
        if lm: lm = lm[::-1]
    mi = MI[mat]
    if uv is None:
        if abs(nm.z) > 0.6: ex = Vector((1, 0, 0)); ey = Vector((0, 1, 0))
        else: ex = Vector((-nm.y, nm.x, 0)).normalized(); ey = Vector((0, 0, 1))
        uv = [(v.dot(ex) / tile, v.dot(ey) / tile) for v in vs]
    if mi in EMISSIVE or mi in SELFI: lm = TINY[:n]
    elif lm is None:
        e1 = (vs[1] - vs[0]).normalized(); e2 = nm.cross(e1)
        lm = [((v - vs[0]).dot(e1) * dens, (v - vs[0]).dot(e2) * dens) for v in vs]
    try: f = bm.faces.new([bm.verts.new(v) for v in vs])
    except ValueError: return None
    f.material_index = mi
    for l, a, b in zip(f.loops, uv, lm): l[UVL].uv = a; l[LML].uv = b
    NFACE[0] += 1
    return f
def obox(c, ex, ey, ez, hx, hy, hz, mat, dens=2.0, tile=3.0, bottom=False, top=True, sides=True, uvs=None):
    pt = lambda a, b, d: c + ex * (hx * a) + ey * (hy * b) + ez * (hz * d)
    if top: F([pt(-1, -1, 1), pt(1, -1, 1), pt(1, 1, 1), pt(-1, 1, 1)], mat, None, None, ez, dens, tile)
    if bottom: F([pt(-1, -1, -1), pt(-1, 1, -1), pt(1, 1, -1), pt(1, -1, -1)], mat, None, None, -ez, dens, tile)
    if sides:
        F([pt(1, -1, -1), pt(1, 1, -1), pt(1, 1, 1), pt(1, -1, 1)], mat, None, None, ex, dens, tile)
        F([pt(-1, 1, -1), pt(-1, -1, -1), pt(-1, -1, 1), pt(-1, 1, 1)], mat, None, None, -ex, dens, tile)
        F([pt(1, 1, -1), pt(-1, 1, -1), pt(-1, 1, 1), pt(1, 1, 1)], mat, None, None, ey, dens, tile)
        F([pt(-1, -1, -1), pt(1, -1, -1), pt(1, -1, 1), pt(-1, -1, 1)], mat, None, None, -ey, dens, tile)
def yaw_axes(yaw): return Vector((math.cos(yaw), math.sin(yaw), 0)), Vector((-math.sin(yaw), math.cos(yaw), 0)), Vector((0, 0, 1))
def bbox(cx, cy, zb, yaw, sx, sy, h, mat, **k):
    ex, ey, ez = yaw_axes(yaw); obox(Vector((cx, cy, zb + h / 2)), ex, ey, ez, sx / 2, sy / 2, h / 2, mat, **k)
def beam(p0, p1, th, mat, dens=2.0, bottom=False):
    p0 = Vector(p0); p1 = Vector(p1); ez = p1 - p0; L = ez.length
    if L < 1e-6: return
    ez /= L; a = Vector((0, 0, 1)) if abs(ez.z) < 0.9 else Vector((1, 0, 0)); ex = ez.cross(a).normalized(); ey = ez.cross(ex)
    obox((p0 + p1) / 2, ex, ey, ez, th / 2, th / 2, L / 2, mat, dens=dens, top=bottom, bottom=bottom)
def quad_on(c, eu, ev, hw, hh, n, mat, uv=None, dens=1.0):
    c = Vector(c); F([c - eu * hw - ev * hh, c + eu * hw - ev * hh, c + eu * hw + ev * hh, c - eu * hw + ev * hh], mat, uv, None, n, dens)
def panel_uv(k, rot=False, flip=False):
    u0 = (k % 2) * 0.5 + 0.003; u1 = u0 + 0.494; v0 = (k // 2) * 0.25 + 0.006; v1 = v0 + 0.238
    uv = [(u0, v1), (u0, v0), (u1, v0), (u1, v1)] if rot else [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
    if flip: uv = [uv[1], uv[0], uv[3], uv[2]]
    return uv
def ribbon(i0, i1, sec, mat, hint, tile=(4.0, 4.0), dens=1.0, chunk=16, hintp=None):
    """quads between neighbouring cross sections sec(i) (lists of 3D points, or None to skip); the Lightmap UV runs in strips of `chunk` samples"""
    for i in range(i0, i1):
        a = sec(i); b = sec(i + 1)
        if not a or not b: continue
        cua = [0.0]; cub = [0.0]
        for k in range(1, len(a)): cua.append(cua[-1] + (a[k] - a[k - 1]).length); cub.append(cub[-1] + (b[k] - b[k - 1]).length)
        s0, s1 = SCu(i), SCu(i + 1); sl = SCu((i // chunk) * chunk)
        for k in range(len(a) - 1):
            uv = [(cua[k] / tile[0], s0 / tile[1]), (cua[k + 1] / tile[0], s0 / tile[1]), (cub[k + 1] / tile[0], s1 / tile[1]), (cub[k] / tile[0], s1 / tile[1])]
            lm = [((s0 - sl) * dens, cua[k] * dens), ((s0 - sl) * dens, cua[k + 1] * dens), ((s1 - sl) * dens, cub[k + 1] * dens), ((s1 - sl) * dens, cub[k] * dens)]
            vs = [a[k], a[k + 1], b[k + 1], b[k]]
            h = hint(i) if callable(hint) else hint
            if hintp is not None:
                h = hintp(i, (vs[0] + vs[1] + vs[2] + vs[3]) / 4)
            F(vs, mat, uv, lm, h, dens)
ALL = range(0, N)
# nearest road sample (any) to a ground point: distance and side
CSXY = C[:, :2]
def nearest(x, y):
    d2 = (CSXY[:, 0] - x) ** 2 + (CSXY[:, 1] - y) ** 2; i = int(np.argmin(d2)); return i, math.sqrt(float(d2[i]))
CS2 = C[::2]; GCS = np.array([GC(i) for i in range(0, N, 2)])
def ground_z(x, y):
    d2 = (CS2[:, 0] - x) ** 2 + (CS2[:, 1] - y) ** 2; w = 1.0 / (d2 + 120.0) ** 1.5; return float((w * GCS).sum() / w.sum())

# ---------------------------------------------------------------- THE ROAD, runoff strips, kerbs
ribbon(0, N, lambda i: [P(i, -7.0), P(i, 7.0)], 'road', UP, tile=(14.0, 18.0), dens=1.0)
for sg in (1, -1):
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 7.0), P(i, sg * 8.5)] if sg > 0 else [P(i, -8.5), P(i, -7.0)], 'pave', UP, tile=(4, 4), dens=0.6)
# kerbs: red / white on the inside of the tighter corners (radius under ~170 m), runs of 8+ samples only
KON = np.zeros(N, int)
for i in range(N):
    if abs(KAP[i]) > 1 / 170.0: KON[i] = 1 if KAP[i] > 0 else -1
for sgn in (1, -1):
    m = (KON == sgn).astype(int); i = 0
    while i < N:
        if m[i]:
            j = i
            while j < N and m[j]: j += 1
            if j - i < 8: m[i:j] = 0
            i = j
        else: i += 1
    ribbon(0, N, lambda i, sgn=sgn, m=m: ([P(i, sgn * 7.0, 0.035), P(i, sgn * 8.0, 0.035)] if m[i % N] and m[(i + 1) % N] else None), 'kerb', UP, tile=(1.0, 4.0), dens=0.7)
# ---------------------------------------------------------------- barriers: inner face exactly 8.5 m from the centre line, 1.0 m high, a light strip on top (left magenta, right cyan)
for sg, neon in ((1, 'magenta'), (-1, 'cyan')):
    inward = lambda i, sg=sg: -LFv(i) * sg; outward = lambda i, sg=sg: LFv(i) * sg
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 8.5), P(i, sg * 8.5, 1.0)], 'concrete', inward, tile=(3, 3), dens=0.9)
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 8.5, 1.0), P(i, sg * 9.0, 1.0)], 'concrete', UP, tile=(3, 3), dens=0.3)
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 9.0, 1.0), P(i, sg * 9.0, 0.0)], 'concrete', outward, tile=(3, 3), dens=0.3)
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 8.485, 0.78), P(i, sg * 8.485, 0.93)], 'emissive_' + neon, inward)
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 8.58, 1.012), P(i, sg * 8.80, 1.012)], 'emissive_' + neon, UP)
log('road + barriers:', NFACE[0], 'faces')

# ---------------------------------------------------------------- the ground beside the road: sidewalk, verge, quay, bridge, tunnel
def normal_sec(i, sg):                                    # sidewalk (9 -> 12.5 m) then the verge out to 22 m, meeting the ground height GC
    if BRIDGE(i) or TUNNEL(i) or (sg > 0 and QUAYSIDE(i)): return None
    z9 = P(i, sg * 9.0).z; g = GC(i); p0 = P(i, sg * 9.0); p1 = PA(i, sg * 12.5, z9 + (g - z9) * 0.45); p2 = PA(i, sg * 22.0, g)
    return p0, p1, p2
def park(i): return zone(i / N) == 'park'
for sg in (1, -1):
    out = lambda i, sg=sg: LFv(i) * sg
    ribbon(0, N, lambda i, sg=sg: (lambda r: [r[0], r[1]] if r else None)(normal_sec(i, sg)), 'pave', UP, tile=(4, 4), dens=0.35)
    ribbon(0, N, lambda i, sg=sg: (lambda r: [r[1], r[2]] if r and not park(i) else None)(normal_sec(i, sg)), 'pave', UP, tile=(5, 5), dens=0.12)
    ribbon(0, N, lambda i, sg=sg: (lambda r: [r[1], r[2]] if r and park(i) else None)(normal_sec(i, sg)), 'grass', UP, tile=(4, 4), dens=0.12)
    ribbon(0, N, lambda i, sg=sg: (lambda r: [r[2], r[2] - Vector((0, 0, 1.6))] if r else None)(normal_sec(i, sg)), 'concrete', out, tile=(3, 3), dens=0.05)
    # quay edge on the harbour side: apron to 16 m, a wall down into the water
    def quay_sec(i, sg=sg):
        if sg < 0 or not QUAYSIDE(i) or BRIDGE(i) or TUNNEL(i): return None
        z9 = P(i, 9.0).z; return [P(i, 9.0), PA(i, 12.5, z9 - 0.08), PA(i, 16.0, z9 - 0.16)]
    ribbon(0, N, lambda i: quay_sec(i), 'pave', UP, tile=(4, 4), dens=0.5)
    ribbon(0, N, lambda i: (lambda r: [r[2], PA(i, 16.0, -0.7)] if r else None)(quay_sec(i)), 'concrete', lambda i: LFv(i), tile=(3, 3), dens=0.15)
# bridge deck: lip, fascia, underside, a cyan glow line under the edge, piers
for sg in (1, -1):
    out = lambda i, sg=sg: LFv(i) * sg
    ribbon(IB0, IB1, lambda i, sg=sg: [P(i, sg * 9.0), P(i, sg * 9.8)], 'concrete', UP, tile=(3, 3), dens=0.4)
    ribbon(IB0, IB1, lambda i, sg=sg: [P(i, sg * 9.8), P(i, sg * 9.8, -1.1)], 'concrete', out, tile=(3, 3), dens=0.3)
    ribbon(IB0, IB1, lambda i, sg=sg: [P(i, sg * 9.83, -0.78), P(i, sg * 9.83, -0.66)], 'emissive_cyan', out)
ribbon(IB0, IB1, lambda i: [P(i, -9.8, -1.1), P(i, 9.8, -1.1)], 'concrete', -UP, tile=(3, 3), dens=0.5)
for i in range(IB0 + 4, IB1 - 3, 10):
    p = P(i, 0, 0); bbox(p.x, p.y, -1.0, PSI[i], 2.4, 7.0, p.z + 1.0 - 1.1, 'concrete', dens=0.3, top=False, bottom=False)
# tunnel: inner tube (roof 7.6 m above the road, never under 6.6 m inside the corridor), warm lamp rows, a hill on top, portals
def tube_sec(i): return [P(i, 9.1, -0.3), P(i, 9.1, 6.6), PA(i, 6.0, C[i % N, 2] + 7.6), PA(i, -6.0, C[i % N, 2] + 7.6), P(i, -9.1, 6.6), P(i, -9.1, -0.3)]
ribbon(IT0, IT1, tube_sec, 'tunnel', None, tile=(2, 2), dens=0.8, hintp=lambda i, p: PA(i, 0, C[i % N, 2] + 3.0) - p)
ribbon(IT0, IT1, lambda i: [PA(i, -9.1, C[i % N, 2] + 8.2), PA(i, 9.1, C[i % N, 2] + 8.2)], 'grass', UP, tile=(4, 4), dens=0.1)
for sg in (1, -1):
    out = lambda i, sg=sg: LFv(i) * sg
    ribbon(IT0, IT1, lambda i, sg=sg: [PA(i, sg * 9.1, C[i % N, 2] + 8.2), PA(i, sg * 14.0, C[i % N, 2] + 8.6), PA(i, sg * 22.0, GC(i))], 'grass', UP, tile=(4, 4), dens=0.1)
    ribbon(IT0, IT1, lambda i, sg=sg: [PA(i, sg * 22.0, GC(i)), PA(i, sg * 22.0, GC(i) - 1.6)], 'concrete', out, tile=(3, 3), dens=0.05)
def portal(i, outdir):
    y = C[i % N, 2]; top = y + 9.0
    for sg in (1, -1):
        a0 = sg * 8.9; a1 = sg * 24.0
        F([PA(i, a0, P(i, a0).z - 0.3), PA(i, a1, P(i, a1).z - 0.3), PA(i, a1, top), PA(i, a0, top)], 'concrete', None, None, outdir, 0.4, 3.0)
    F([PA(i, -9.0, y + 6.6), PA(i, 9.0, y + 6.6), PA(i, 9.0, top), PA(i, -9.0, top)], 'concrete', None, None, outdir, 0.4, 3.0)
    for sg in (1, -1):                                    # a glowing frame round the mouth (outside the corridor)
        F([PA(i, sg * 8.95, y - 0.3), PA(i, sg * 9.25, y - 0.3), PA(i, sg * 9.25, y + 6.8), PA(i, sg * 8.95, y + 6.8)], 'emissive_amber', None, None, outdir)
    F([PA(i, -9.25, y + 6.62), PA(i, 9.25, y + 6.62), PA(i, 9.25, y + 6.85), PA(i, -9.25, y + 6.85)], 'emissive_amber', None, None, outdir)
    c = PA(i, 0, y + 7.9) + outdir * 0.05; eu = LFv(i) if outdir.dot(TGv(i)) < 0 else -LFv(i)
    quad_on(c, eu, UP, 5.0, 1.25, outdir, 'sign', panel_uv(6))
    LT(PA(i, 0, y + 5.0) + outdir * 3.0, COL['amber'], 900.0, 0.5)
portal(IT0, -TGv(IT0)); portal(IT1, TGv(IT1))
for i in range(IT0 + 2, IT1 - 1, 2):                      # warm lamp rows along the roof: two rows, a pool of light every 6 m
    for sg in (1, -1):
        p = PA(i, sg * 3.6, C[i % N, 2] + 7.52); ex = TGv(i); ey = LFv(i)
        obox(p, ex, ey, UP, 0.9, 0.22, 0.06, 'emissive_sodium', dens=1.0, top=False)
        if i % 4 == 2 or sg > 0: LT(p - Vector((0, 0, 0.4)), COL['sodium'], pw(1.2, 7.2) * (1.0 if i % 4 == 2 else 0.8), 0.4)
        if i % 6 == 0 and sg > 0: GLW(p, 'sodium', 7.0)
for i in range(IT0 + 8, IT1 - 6, 20):                     # emergency exit signs, green, low on the wall
    for sg in (1,):
        p = P(i, sg * 9.07, 3.2); F([p - TGv(i) * 0.5 - UP * 0.2, p + TGv(i) * 0.5 - UP * 0.2, p + TGv(i) * 0.5 + UP * 0.2, p - TGv(i) * 0.5 + UP * 0.2], 'emissive_green', None, None, -LFv(i) * sg); GLW(p, 'green', 4.0)
log('ground, bridge, tunnel:', NFACE[0], 'faces')

# ---------------------------------------------------------------- street lamps: every 30 m, alternating sides, sodium (cool white downtown), an arm over the road at 8.8 m
def street_lamps():
    for i in range(4, N, 10):
        if TUNNEL(i): continue
        z = zone(i / N); sg = 1 if (i // 10) % 2 == 0 else -1
        if sg > 0 and QUAYSIDE(i) and False: continue
        dp = 9.45 if BRIDGE(i) else 10.3
        bz = P(i, sg * dp).z; topz = bz + 8.8
        if sg > 0 and QUAYSIDE(i): bz = P(i, 9.0).z - 0.3
        base = PA(i, sg * dp, bz - 0.4); ex = TGv(i); ey = LFv(i)
        obox(Vector((base.x, base.y, (base.z + topz) / 2)), ex, ey, UP, 0.14, 0.14, (topz - base.z) / 2, 'metal', dens=2.0, bottom=False)
        beam(PA(i, sg * dp, topz), PA(i, sg * 7.7, topz + 0.15), 0.16, 'metal')
        cn = 'wcool' if z == 'downtown' else ('amber' if z in ('park', 'oldtown') else 'sodium')
        hp = PA(i, sg * 7.7, topz - 0.06)
        obox(hp, ex, ey, UP, 0.55, 0.25, 0.06, 'emissive_' + cn, dens=1.0)
        col = COL[cn] if cn != 'wcool' else (0.78, 0.88, 1.0)
        LT(hp - Vector((0, 0, 0.25)), col, pw(3.0, 8.5), 0.3); GLW(hp, cn, 9.0)
street_lamps()
for i in range(2, N, 7):                                  # bollard lamps along the quay edge: small amber lights that streak on the water
    if QUAYSIDE(i) and not BRIDGE(i):
        p = PA(i, 15.55, P(i, 9.0).z - 0.16); obox(Vector((p.x, p.y, p.z + 0.35)), TGv(i), LFv(i), UP, 0.16, 0.16, 0.35, 'emissive_amber', dens=1.0)
        if i % 14 == 2: LT(Vector((p.x, p.y, p.z + 0.9)), COL['amber'], 120.0, 0.1)
log('lamps:', NFACE[0], 'faces,', len(LIGHTS), 'lights')
