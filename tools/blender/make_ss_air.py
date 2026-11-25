# Steel Storm Rebuilt: the 22 aircraft, one parametric script. Each aircraft is built from its entry (line "a") in
# art/steelstorm/rebuilt/vehicles.json: the old model's numbers (length, span, kind m.k, flags m.f) give the planform, and the json's
# body box, props and muzzles give the extents the check wants. Real fuselage sections (lathes), wings with thickness, taper and
# sweep (hulls through airfoil sections), tails, intakes, nozzles, canopies, nacelles, pylons, stores, gear, rotors and propellers.
#   blender -b art/steelstorm/rebuilt/air.blend -P tools/blender/make_ss_air.py -- a1a a1b ...     (no ids: all 22; first time use --factory-startup)
#   options: nobuild, shot=<out.png> (render the ids in one row) w= h= az= el= spp=
# then  node tools/export-art.mjs v_a1a ... ;  node tools/ss-check-model.mjs
# Parts (vehicle space): <id>_body, <id>_prop0 / <id>_prop1 (centred on the json's prop pos, spinning about its axis), materials
# <id>_skin (painted, tinted by the game) and <id>_gear (glass, tyres, nozzles, blades, barrels) on one 512 picture.
import bpy, bmesh, math, os, sys, json, inspect
import numpy as np
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hgkit import *
import ss_tanks
from ss_tanks import split_uv, gear_material, split_by_class

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REB = os.path.join(ROOT, 'art', 'steelstorm', 'rebuilt'); TEXDIR = os.path.join(REB, 'tex'); os.makedirs(TEXDIR, exist_ok=True)
ss_tanks.TEXDIR = TEXDIR
OPT = dict((a.split('=', 1) + ['1'])[:2] for a in ARGV if not (len(a) >= 2 and a[0] == 'a' and a[1].isdigit()))
VEH = {v['id']: v for v in json.load(open(os.path.join(REB, 'vehicles.json'))) if v['line'] == 'a'}
IDS = [a for a in ARGV if a in VEH] or sorted(VEH)
scene = bpy.context.scene
TEXN = 512
ss_tanks.PAL[CLS.index('red')] = (0.10, 0.17, 0.24)          # canopy glass (class 'red' is only used for glass here)
ss_tanks.PAL[CLS.index('white')] = (0.55, 0.55, 0.52)

# ---------------------------------------------------------------- the picture: aircraft paint (splinter camouflage), gentle shading
def air_decorate(col_, P, Nn, paint, mott, streak):
    """two-tone splinter camouflage (mid 0.86 x, dark 0.72 x the base) in hard-edged angular patches, a lighter underside, darker walkways on the
    wing roots, exhaust stains behind the nozzles and engine stacks, panel lines come from the shared texture code"""
    rng = np.random.default_rng(17); lo = P.min(0); hi = P.max(0); K = 46
    seeds = lo + (hi - lo) * rng.random((K, 3)).astype(np.float32); tone = rng.integers(0, 3, K)
    Q = P * np.array((1.0, 0.55, 1.0), np.float32); S = seeds * np.array((1.0, 0.55, 1.0), np.float32)
    best = np.full(len(P), 1e9, np.float32); idx = np.zeros(len(P), np.int64)
    for i in range(K):
        d = np.abs(Q[:, 0] - S[i, 0]) + np.abs(Q[:, 1] - S[i, 1]) * 0.8 + np.abs(Q[:, 2] - S[i, 2]) * 1.6
        m = d < best; best[m] = d[m]; idx[m] = i
    f = np.where(tone[idx] == 0, 1.0, np.where(tone[idx] == 1, 0.86, 0.72)).astype(np.float32)
    belly = paint & (Nn[:, 2] < -0.3); f = np.where(belly, np.maximum(f, 0.94) * 1.05, f)                                  # lighter underside
    col_[paint] *= f[paint, None]
    ex = (hi[0] - lo[0]) * 0.5; rear = (hi[1] - lo[1])
    walk = paint & (Nn[:, 2] > 0.6) & (np.abs(P[:, 0]) < 0.17 * ex + 0.6) & (P[:, 1] > lo[1] + 0.35 * rear) & (P[:, 1] < lo[1] + 0.62 * rear); col_[walk] *= 0.9           # walkways
    stain = paint & (P[:, 1] > hi[1] - 0.16 * rear) & (np.abs(P[:, 0]) < 0.3 * ex + 0.5); col_[stain] *= (0.82 + 0.12 * np.clip(streak, 0, 1))[stain, None]           # exhaust
    side = paint & (np.abs(Nn[:, 0]) > 0.7) & (P[:, 1] < lo[1] + 0.3 * rear) & (np.abs(P[:, 0]) < 0.12 * ex + 0.8); col_[side] *= 0.9
    up = paint & (Nn[:, 2] > 0.5); col_[up] *= 1.02
    low = paint & (P[:, 2] < lo[2] + 0.12 * (hi[2] - lo[2])); col_[low] *= 0.96
_src = inspect.getsource(ss_tanks.tank_texture)
for _a, _b in (("decorate(col_, P, Nn, paint, G == GRP.index('mag'), C == CLS.index('rubber'), B, name, mott, streak)", "air_decorate(col_, P, Nn, paint, mott, streak)"),
               ("col_[paint & panel] *= 0.6", "col_[paint & panel] *= 0.84"), ("(0.35 + 0.65 * np.clip(ao[idx], 0, 1) ** 1.3)", "(0.76 + 0.24 * np.clip(ao[idx], 0, 1) ** 1.3)"),
               ("(0.92 + 0.16 * grain[:, None]) * (0.92 + 0.16 * mott[:, None])", "(0.96 + 0.08 * grain[:, None]) * (0.96 + 0.08 * mott[:, None])"), ("(0.9 + 0.12 * streak[paint])", "(0.95 + 0.06 * streak[paint])")):
    assert _a in _src, _a
    _src = _src.replace(_a, _b)
ss_tanks.air_decorate = air_decorate
exec(_src, ss_tanks.__dict__)

# ---------------------------------------------------------------- game <-> Blender
CG = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1))); CGI = CG.inverted()
def B(x, y, z): return Vector((x, -z, y))
def Rg(ax, deg): return CG @ Matrix.Rotation(math.radians(deg), 4, ax.upper()) @ CGI

class Q:
    """modelling in a local frame (origin org, game axes) into the kit k, every vertex in group grp"""
    def __init__(s, k, org, grp): s.k = k; s.o = Vector(org); s.grp = grp
    def c(s, p): return (p[0] + s.o.x, p[1] + s.o.y, p[2] + s.o.z)
    def box(s, c, sz, cls='olive', bev=0.0, rot=()):
        M = T(*B(*s.c(c)))
        for ax, d in rot: M = M @ Rg(ax, d)
        return s.k.box((0, 0, 0), (sz[0], sz[2], sz[1]), cls, s.grp, bev=bev, M=M)
    def hull(s, pts, cls='olive', bev=0.012, mirror=False, minang=0.45):
        """convex solid through the points (game coordinates); mirror: also the points with x negated"""
        k = s.k; P = [B(*s.c(p)) for p in pts]
        if mirror: P += [B(*s.c((-p[0], p[1], p[2]))) for p in pts if abs(p[0]) > 1e-6]
        b = set(k.bm.faces); vs = [k.bm.verts.new(p) for p in P]
        bmesh.ops.convex_hull(k.bm, input=vs, use_existing_faces=False)
        bmesh.ops.delete(k.bm, geom=[v for v in vs if not v.link_faces], context='VERTS')
        fs = list(set(k.bm.faces) - b); bmesh.ops.recalc_face_normals(k.bm, faces=fs)
        try: bmesh.ops.dissolve_limit(k.bm, angle_limit=math.radians(1.5), verts=list({v for f in fs for v in f.verts}), edges=list({e for f in fs for e in f.edges}))
        except Exception as ex: log('dissolve', ex)
        fs = list(set(k.bm.faces) - b); bf = []
        if bev > 0:
            es = list({e for f in fs for e in f.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > minang})
            try: bf = bmesh.ops.bevel(k.bm, geom=es, offset=bev, segments=1, affect='EDGES', profile=0.5, clamp_overlap=True)['faces']
            except Exception as ex: log('bevel', ex)
        return k._finish(b, cls, s.grp, bf)
    def prism(s, prof, x0, x1, cls='olive', bev=0.0):
        """side profile [(y, z)] (game) extruded across x"""
        return s.k.prism([(-(z + s.o.z), y + s.o.y) for y, z in prof], x0 + s.o.x, x1 + s.o.x, cls, s.grp, bev=bev)
    def lathe(s, prof, pos, d=(0, 1, 0), segs=10, cls='olive', loop=False, caps=True, smooth=True, sc=None, split=None):
        """profile [(r, t)] turned round the axis d through pos (t runs along d). split=(rmax, cls2): faces within rmax of the axis get cls2"""
        dv = B(*d).normalized()
        R = (Rx(90 if dv.z > 0 else -90) if abs(dv.z) > 0.999 else dv.to_track_quat('Y', 'Z').to_matrix().to_4x4())
        p0 = B(*s.c(pos)); M = T(*p0) @ R
        if sc: M = M @ Matrix.Diagonal((sc[0], 1, sc[1], 1))
        faces = s.k.lathe(prof, M, segs, cls, s.grp, loop=loop, caps=caps, smooth=smooth)
        if split:
            for f in faces:
                if all(((v.co - p0) - dv * (v.co - p0).dot(dv)).length <= split[0] + 1e-4 for v in f.verts): f[s.k.cls] = CLS.index(split[1])
        return faces
    def cyl(s, pos, r, h, d=(0, 1, 0), segs=8, cls='olive', split=None): return s.lathe([(r, 0), (r, h)], pos, d, segs, cls, split=split)


# ---------------------------------------------------------------- parts
def smooth_prof(prof, n):
    """prof [(r, z)] with z rising: resample to n points on a smooth (cubic Hermite) curve"""
    zs = np.array([p[1] for p in prof], float); rs = np.array([p[0] for p in prof], float); m = len(prof); tg = np.zeros(m)
    for i in range(m):
        a_, b_ = max(i - 1, 0), min(i + 1, m - 1); tg[i] = (rs[b_] - rs[a_]) / (zs[b_] - zs[a_]) if zs[b_] != zs[a_] else 0
    out = []
    for z in np.linspace(zs[0], zs[-1], n):
        i = int(min(max(np.searchsorted(zs, z, side='right') - 1, 0), m - 2)); h = zs[i + 1] - zs[i]; t = (z - zs[i]) / h
        r = (2 * t ** 3 - 3 * t ** 2 + 1) * rs[i] + (t ** 3 - 2 * t ** 2 + t) * h * tg[i] + (-2 * t ** 3 + 3 * t ** 2) * rs[i + 1] + (t ** 3 - t ** 2) * h * tg[i + 1]
        out.append((max(float(r), 0.0), float(z)))
    return out
FOIL = [(0.025, 0.60, 0.60), (0.12, 0.92, 0.84), (0.38, 1.0, 0.9), (0.68, 0.6, 0.5), (1.0, 0.1, 0.08)]
def foil(x, y, zle, c, t):
    pts = [(x, y, zle)]
    for fz, fu, fl in FOIL: pts += [(x, y + t * 0.5 * fu, zle - fz * c), (x, y - t * 0.5 * fl, zle - fz * c)]
    return pts
def wing(q, s, x0, x1, zle0, c0, t0, zle1, c1, t1, y0, y1, cls='olive'):
    q.hull(foil(s * x0, y0, zle0, c0, t0) + foil(s * x1, y1, zle1, c1, t1), cls, 0.0)
def fin(q, x0, x1, y0, y1, zle0, c0, zle1, c1, t, cls='olive'):
    pts = []
    for (x, y, zle, c, tt) in ((x0, y0, zle0, c0, t), (x1, y1, zle1, c1, t * 0.6)):
        pts += [(x, y, zle), (x + tt * 0.35, y, zle - 0.05 * c), (x - tt * 0.35, y, zle - 0.05 * c), (x + tt / 2, y, zle - 0.35 * c), (x - tt / 2, y, zle - 0.35 * c), (x + tt * 0.2, y, zle - 0.75 * c), (x - tt * 0.2, y, zle - 0.75 * c), (x, y, zle - c)]
    q.hull(pts, cls, 0.0)
def lerp(a, b, u): return a + (b - a) * u
def strip(q, a, b, w=0.03, h=0.012, n=(0, 1, 0), cls='dark'):
    """a thin dark strip (a panel gap or step) from point a to point b, w wide along z (or x if n is z), h thick along n"""
    pts = []; wd = (0, 0, 1) if n != (0, 0, 1) else (1, 0, 0)
    for e in (a, b):
        for sw_ in (-1, 1):
            for sn in (-1, 1): pts.append((e[0] + wd[0] * sw_ * w / 2 + n[0] * sn * h / 2, e[1] + wd[1] * sw_ * w / 2 + n[1] * sn * h / 2, e[2] + wd[2] * sw_ * w / 2 + n[2] * sn * h / 2))
    q.hull(pts, cls, 0.0)
def wing_gaps(q, s, x0, x1, zl0, zl1, c0, c1, t0, t1, y0, y1):
    def at(u, f):
        x = lerp(x0, x1, u); zle = lerp(zl0, zl1, u); c = lerp(c0, c1, u); t = lerp(t0, t1, u); y = lerp(y0, y1, u)
        return (s * x, y + t * 0.5 * (0.6 if f < 0.8 else 0.22) + 0.003, zle - f * c)
    for (ua, ub) in ((0.63, 0.95), (0.14, 0.57)):
        strip(q, at(ua, 0.74), at(ub, 0.74), 0.026, 0.01)
        for u in (ua, ub): strip(q, at(u, 0.74), at(u, 0.985), 0.012, 0.01)
def zle_at(zle0, zle1, x0, x1, x): return zle0 + (zle1 - zle0) * (abs(x) - x0) / max(1e-6, x1 - x0)
def dome(q, pos, w, hy, rz, cls='red', segs=12, d=(0, 1, 0)):
    q.lathe([(w, 0), (0.97 * w, 0.18 * hy), (0.88 * w, 0.5 * hy), (0.6 * w, 0.83 * hy), (0.25 * w, 0.97 * hy), (0, hy)], pos, d, segs, cls, sc=(1, rz / w))
def pwheel(q, s, xface, y, z, r, w, segs=12):
    q.lathe([(0, 0.02), (0.55 * r, 0), (0.95 * r, -0.01), (r, -0.04), (r, -w + 0.04), (0.95 * r, -w + 0.01), (0, -w)], (xface, y, z), (s, 0, 0), segs, 'rubber', split=(0.6 * r, 'steel'))
def store(q, x, y, z, r, ln, cls='olive', segs=8, fins=True):
    q.lathe([(0, -ln / 2), (r * 0.5, -ln / 2 + r * 0.4), (r * 0.9, -ln / 2 + r * 1.2), (r, -ln / 2 + r * 2.0), (r, ln / 2 - r * 2.5), (r * 0.82, ln / 2 - r * 1.0), (0, ln / 2)], (x, y, z), (0, 0, 1), segs, cls)
    if fins:
        for k_ in range(4):
            a_ = k_ * math.pi / 2 + math.pi / 4; q.hull([(x + math.cos(a_) * r * 0.9, y + math.sin(a_) * r * 0.9, z + ln / 2 - r * 1.2), (x + math.cos(a_) * r * 2.0, y + math.sin(a_) * r * 2.0, z + ln / 2 - r * 0.2),
                                                      (x + math.cos(a_) * r * 0.9, y + math.sin(a_) * r * 0.9, z + ln / 2 + r * 0.2), (x + math.cos(a_) * r * 1.0 + 0.012, y + math.sin(a_) * r * 1.0, z + ln / 2 - r * 1.2)], 'steel', 0.0)
def nozzle(q, x, y, z, r, ln, segs=14):
    q.lathe([(r, 0), (r * 1.03, -ln * 0.35), (r * 0.9, -ln * 0.75), (r * 0.8, -ln), (r * 0.7, -ln), (r * 0.78, -ln * 0.75), (r * 0.88, -ln * 0.3), (r * 0.9, 0)], (x, y, z), (0, 0, 1), segs, 'steel', loop=True)
    q.lathe([(0, 0), (r * 0.72, 0)], (x, y, z - ln + 0.02), (0, 0, 1), segs, 'dark', caps=False)
    q.lathe([(r * 0.3, 0), (r * 0.3, -ln * 0.25), (0, -ln * 0.55)], (x, y, z - ln * 0.5), (0, 0, 1), 8, 'steel')
    for k_ in range(6):
        a_ = k_ * math.pi / 3; q.box((x + math.cos(a_) * r * 0.97, y + math.sin(a_) * r * 0.97, z - ln * 0.98), (0.03, 0.03, ln * 0.14), 'dark', 0.0)
def lip(q, x, y, z, r, segs=14):
    """intake lip: a rounded ring and a dark mouth"""
    q.lathe([(r, 0), (r * 1.06, 0.05), (r * 1.04, 0.12), (r * 0.9, 0.12), (r * 0.88, 0.04)], (x, y, z - 0.12), (0, 0, 1), segs, 'olive', loop=True)
    q.lathe([(0, 0), (r * 0.9, 0)], (x, y, z - 0.01), (0, 0, 1), segs, 'dark', caps=False)

class Air:
    def __init__(a, v, seg=20, lite=0):
        a.v = v; m = v['m']; a.m = m; a.L = m['len']; a.S = m['span']; a.k = m['k']; a.f = set(m['f'].split()); a.seg = seg; a.lite = lite
        a.kit = Kit(1); a.body = Q(a.kit, (0, 0, 0), 'gun'); a.P = [Q(a.kit, p['pos'], g) for p, g in zip(v['props'], ('mag', 'bolt'))]
        a.bx = v['body']; a.ytop = a.bx[4]; a.ybot = a.bx[1]
    # ---------------- propeller / rotor parts, centred on the prop's pos
    def prop_parts(a):
        for i, p in enumerate(a.v['props']):
            q = a.P[i]; bx = p['box']; ax = p['axis']
            if ax == 'z':                                    # propeller: spinner, 3 blades with chord, twist, taper and a rounded tip
                r = bx[4] - 0.03; nb = 3
                radii = [0.26, 0.36 * r, 0.62 * r, 0.86 * r, r - 0.03]; chord = [0.17, 0.30, 0.29, 0.22, 0.12]; pitch = [38, 29, 19, 12, 8]; thick = [0.07, 0.05, 0.036, 0.026, 0.016]
                for j in range(nb):
                    th = 2 * math.pi * j / nb; d = (math.sin(th), math.cos(th)); tg = (math.cos(th), -math.sin(th)); secs = []
                    for rr, c_, pt_, t_ in zip(radii, chord, pitch, thick):
                        pr = math.radians(pt_); cd = (math.cos(pr), math.sin(pr)); nd = (-math.sin(pr), math.cos(pr)); sec = []
                        for (fu, fn) in ((0, 0), (0.22, 0.5), (0.22, -0.4), (0.7, 0.3), (0.7, -0.25), (1.0, 0.0)):
                            tc = (fu - 0.35) * c_ * cd[0] + fn * t_ * nd[0]; ac = (fu - 0.35) * c_ * cd[1] + fn * t_ * nd[1]
                            sec.append((d[0] * rr + tg[0] * tc, d[1] * rr + tg[1] * tc, ac))
                        secs.append(sec)
                    for s0, s1 in zip(secs[:-1], secs[1:]): q.hull(s0 + s1, 'dark', 0.0)
                    rt = r; q.hull(secs[-1] + [(d[0] * rt + tg[0] * 0.0, d[1] * rt, 0.0)], 'dark', 0.0)
                    q.box((d[0] * 0.3, d[1] * 0.3, 0.0), (0.2, 0.2, 0.16), 'steel', 0.0, rot=(('z', -math.degrees(th)),))           # blade root
                q.lathe([(0.0, 0.25), (0.1, 0.22), (0.2, 0.14), (0.27, 0.0), (0.27, -0.2), (0, -0.2)], (0, 0, 0), (0, 0, 1), 14, 'olive')
                q.lathe([(0.28, -0.02), (0.28, 0.04)], (0, 0, 0.0), (0, 0, 1), 14, 'steel')
            elif ax == 'x':                                   # tail rotor: hub and two blades with chord
                r = bx[4] - 0.05
                for sg in (-1, 1):
                    secs = []
                    for rr, c_ in ((0.16, 0.2), (0.4 * r, 0.3), (0.8 * r, 0.26), (r - 0.04, 0.16)):
                        secs.append([(-0.035, sg * rr, -c_ * 0.45), (0.035, sg * rr, -c_ * 0.3), (0.03, sg * rr, c_ * 0.55), (-0.03, sg * rr, c_ * 0.5), (0.0, sg * rr, c_ * 0.6), (0.0, sg * rr, -c_ * 0.5)])
                    for s0, s1 in zip(secs[:-1], secs[1:]): q.hull(s0 + s1, 'dark', 0.0)
                    q.box((0, sg * 0.2, 0), (0.1, 0.12, 0.14), 'steel', 0.0)
                q.lathe([(0.1, -0.12), (0.1, 0.12), (0.04, 0.2)], (0, 0, 0), (1, 0, 0), 10, 'steel')
                q.lathe([(0.05, 0), (0.05, 0.3)], (0, 0, 0), (-1, 0, 0), 6, 'steel')
            else:                                             # main rotor (y or -y): head, grips, blades with chord and a little droop
                r = max(bx[3], bx[5]) - 0.05; nb = 4 if ('tandem' in a.f) else 2; cmax = 0.56 if bx[3] < 0.31 else 0.7
                for j in range(nb):
                    th = math.pi * 2 * j / nb; dx, dz = math.sin(th), math.cos(th); tx, tz = dz, -dx; secs = []
                    for rr, cf in ((0.55, 0.8), (0.18 * r, 1.0), (0.5 * r, 1.0), (0.8 * r, 0.95), (r - 0.05, 0.85)):
                        c_ = cmax * cf; yy = -0.17 * (rr / r) ** 2 + 0.02; sec = []
                        for (fu, fn) in ((0.0, 0.0), (0.12, 0.5), (0.12, -0.4), (0.6, 0.3), (0.6, -0.3), (1.0, 0.0)):
                            tc = (fu - 0.3) * c_; sec.append((dx * rr + tx * tc, yy + fn * 0.06, dz * rr + tz * tc))
                        secs.append(sec)
                    for s0, s1 in zip(secs[:-1], secs[1:]): q.hull(s0 + s1, 'dark', 0.0)
                    q.box((dx * 0.55, 0.0, dz * 0.55), (0.2, 0.12, 0.34), 'steel', 0.0, rot=(('y', math.degrees(th)),))                      # blade grip
                q.lathe([(0.0, 0.2), (0.14, 0.17), (0.3, 0.1), (0.34, 0.0), (0.3, -0.1), (0.2, -0.13), (0.0, -0.13)], (0, 0, 0), (0, 1, 0), 14, 'steel')
                q.lathe([(0.45, 0), (0.45, 0.04)], (0, -0.1, 0), (0, 1, 0), 14, 'dark')
    # ---------------- guns at the muzzles
    def guns(a, zle_fn=None, ports=False):
        q = a.body
        for (x, y, z) in a.v['muzzles'][:2]:
            if ports:
                q.lathe([(0.075, 0), (0.075, 0.25)], (x, y, z - 0.2), (0, 0, 1), 8, 'dark'); q.box((x, y, z - 0.35), (0.3, 0.18, 0.3), 'olive', 0.0); continue
            zs = max(z - 1.8, (zle_fn(x) if zle_fn else z - 1.8) + 0.2)
            q.lathe([(0.13, zs), (0.13, zs + 0.5), (0.1, zs + 0.7), (0.07, z - 0.5), (0.1, z - 0.4), (0.1, z - 0.3), (0.05, z)], (x, y, 0), (0, 0, 1), 8, 'olive')
            q.hull([(x - 0.12, y + 0.08, zs), (x + 0.12, y + 0.08, zs), (x - 0.08, y + 0.28, zs + 0.1), (x + 0.08, y + 0.28, zs + 0.1), (x - 0.08, y + 0.28, zs + 0.9), (x + 0.08, y + 0.28, zs + 0.9), (x - 0.12, y + 0.08, zs + 0.9), (x + 0.12, y + 0.08, zs + 0.9)], 'steel', 0.0)
            q.lathe([(0.0, 0.0), (0.04, 0.0)], (x, y, z + 0.003), (0, 0, 1), 6, 'dark', caps=False)
    def belly_outline(a, cx, cz, w, ln, r):
        q = a.body; y = lambda b: -math.sqrt(max(r * r - b * b, 0.01)) - 0.01
        for sx in (-1, 1): strip(q, (cx + sx * w / 2, y(w / 2), cz - ln / 2), (cx + sx * w / 2, y(w / 2), cz + ln / 2), 0.03, 0.02)
        for sz in (-1, 1): strip(q, (cx - w / 2, y(w / 2), cz + sz * ln / 2), (cx + w / 2, y(w / 2), cz + sz * ln / 2), 0.03, 0.02)

    # ---------------- ordinary aircraft: props, jets, delta, attackers, heavy bombers
    def plane(a):
        q = a.body; L, S, k, f, v = a.L, a.S, a.k, a.f, a.v
        prop = k in ('prop', 'bomber'); fr = L * (0.085 if prop else 0.07) * (1.15 if 'big' in f else 1)
        wy = fr * 0.7 if 'high' in f else -fr * 0.6 if 'low' in f else 0.0; sw = a.m.get('sweep', 0); delta = k == 'delta'
        root = L * 0.55 if delta else L * 0.24 if k == 'heavy' else L * 0.17 if k == 'atk' else L * 0.2; tip = L * 0.04 if delta else root * (0.55 if prop else 0.4)
        wz = -L * 0.12 if delta else L * 0.02 if k == 'heavy' else -L * 0.02 if k == 'atk' else L * 0.02; half = S / 2; swo = L * 0.45 if delta else math.tan(sw) * half
        dih = 0.04 if prop else (-0.03 if 'high' in f else 0.02); sg_ = a.seg
        # ---- fuselage: a smooth body of revolution, tail cone, nose
        if prop:
            prof = [(fr * 0.08, -L * 0.52), (fr * 0.16, -L * 0.5), (fr * 0.3, -L * 0.46), (fr * 0.5, -L * 0.34), (fr * 0.7, -L * 0.2), (fr * 0.9, -L * 0.07), (fr * 0.98, L * 0.05), (fr, L * 0.2), (fr, L * 0.32), (fr * 0.95, L * 0.42)]
            if k == 'bomber': prof[0] = (prof[0][0], -L * 0.5); prof[1] = (prof[1][0], -L * 0.485)
            ze = L * 0.5 + (L * 0.06 if 'long' in f else 0)
            q.lathe(smooth_prof(prof, 12), (0, 0, 0), (0, 0, 1), sg_, 'olive', sc=(0.92, 1.0), caps=False)
            q.lathe(smooth_prof([(fr * 0.93, L * 0.4), (fr * 0.97, L * 0.46), (fr * 0.95, ze - 0.14), (fr * 0.84, ze - 0.04), (fr * 0.62, ze)], 5) + [(fr * 0.36, ze), (0, ze)], (0, 0, 0), (0, 0, 1), sg_, 'olive', sc=(0.92, 1.0))
            q.lathe([(fr * 0.62, ze - 0.04), (fr * 0.62, ze + 0.0), (fr * 0.5, ze + 0.0)], (0, 0, 0), (0, 0, 1), sg_, 'steel', loop=True, sc=(0.92, 1.0))              # cowl lip
            q.lathe([(0, 0), (fr * 0.4, 0)], (0, 0, ze - 0.005), (0, 0, 1), 14, 'dark', caps=False)                                                                          # air inlet behind the propeller
            for s in (-1, 1):
                for i in range(6): q.lathe([(0.055, 0), (0.05, 0.1), (0.03, 0.12)], (s * fr * 0.83, -fr * 0.12 - i * 0.0, L * 0.42 - i * 0.14), (s, 0.1, -0.3), 6, 'steel')       # exhaust stacks
                q.box((s * fr * 0.9, fr * 0.2, L * 0.3), (0.03, 0.02, 0.5), 'dark', 0.0)                                                                                          # cowl gill
            q.hull([(-fr * 0.35, -fr * 0.75, L * 0.38), (fr * 0.35, -fr * 0.75, L * 0.38), (-fr * 0.3, -fr * 1.05, L * 0.34), (fr * 0.3, -fr * 1.05, L * 0.34), (-fr * 0.3, -fr * 0.75, L * 0.2), (fr * 0.3, -fr * 0.75, L * 0.2), (-fr * 0.25, -fr * 0.95, L * 0.22), (fr * 0.25, -fr * 0.95, L * 0.22)], 'olive', 0.01)   # radiator / oil cooler
            q.box((0, -fr * 1.0, L * 0.385), (fr * 0.55, fr * 0.2, 0.04), 'dark', 0.0)
            for s in (-1, 1): strip(q, (s * fr * 0.88, fr * 0.0, L * 0.38), (s * fr * 0.88, fr * 0.0, L * 0.0), 0.02, 0.02, (1, 0, 0))                                          # cowl / fuselage panel joint
        else:
            prof = [(fr * 0.62, -L * 0.5), (fr * 0.74, -L * 0.45), (fr * 0.88, -L * 0.36), (fr * 0.96, -L * 0.22), (fr, -L * 0.05), (fr, L * 0.05), (fr * 0.9, L * 0.2), (fr * 0.68, L * 0.33), (fr * 0.4, L * 0.42), (fr * 0.2, L * 0.46)]
            q.lathe(smooth_prof(prof, 14), (0, 0, 0), (0, 0, 1), sg_, 'olive', sc=(0.95, 0.98))
            nozzle(q, 0, 0, -L * 0.5, fr * 0.6, L * 0.04, 14)
            q.lathe([(fr * 0.2, 0), (fr * 0.12, L * 0.03), (0.02, L * 0.06)], (0, 0, L * 0.46), (0, 0, 1), 8, 'dark')                                                     # radome tip
            if 'nose' in f: q.lathe([(0.02, 0), (fr * 0.3, 0)], (0, 0, L * 0.4), (0, 0, 1), 10, 'dark', caps=False)
            q.lathe([(0.025, 0), (0.012, 0.15)], (0, 0.05, L * 0.52), (0, 0, 1), 5, 'steel')                                                                           # pitot
            q.lathe([(fr * 0.12, 0), (fr * 0.01, -0.4)], (0, 0, -L * 0.57 + 0.0), (0, 0, 1), 6, 'steel') if False else None
        q.lathe([(fr * 0.08, 0), (0.02, -0.15)], (0, 0, -L * 0.5 + 0.0), (0, 0, 1), 6, 'steel') if prop else None
        q.lathe([(0.03, 0), (0.0, -0.1)], (0, fr * 0.04, -L * (0.5 if k == 'bomber' else 0.52)), (0, 0, 1), 6, 'red')                                                                                  # tail light
        if 'glassnose' in f: dome(q, (0, 0, L * 0.5 - 0.05), fr * 0.56, fr * 0.85, fr * 0.56, 'red', 12, (0, 0, 1)); [strip(q, (0, fr * 0.56 * c, L * 0.5 + 0.05), (0, fr * 0.56 * c, L * 0.5 - 0.5), 0.03, 0.02) for c in (0.0, 0.6, -0.6)] if False else None
        if k == 'atk': q.lathe([(0.14, 0), (0.14, 1.2), (0.1, 1.45), (0.17, 1.5), (0.17, 1.65), (0.08, 1.7)], (0, -fr * 0.4, L * 0.55 - 0.85), (0, 0, 1), 10, 'steel')
        # ---- canopy: glass, frame bars, rails, windshield arch, turtleback with the headrest
        cz = L * (0.08 if prop else 0.2); cw = fr * 0.55
        if 'glassnose' not in f or k == 'bomber':
            dome(q, (0, fr * 0.55, cz), cw, fr * 0.62, fr * 1.5, 'red', 12, (0, 1, 0))
            for i in range(4): q.box((0, fr * 1.0 + math.sin(math.pi * (i + 0.5) / 4.5) * 0.0, cz - fr * 1.1 + i * fr * 0.75), (cw * 1.9, fr * 0.05, 0.05), 'steel', 0.0)
            for s in (-1, 1):
                strip(q, (s * cw * 0.96, fr * 0.6, cz - fr * 1.5), (s * cw * 0.96, fr * 0.6, cz + fr * 1.5), 0.04, 0.06, (0, 1, 0), 'steel')                      # canopy rail
                q.box((s * cw * 0.5, fr * 0.84, cz - fr * 0.98), (0.03, fr * 0.2, fr * 1.2), 'steel', 0.0, rot=(('z', s * 18),))
            q.box((0, fr * 0.9, cz + fr * 1.45), (cw * 1.8, fr * 0.1, 0.07), 'steel', 0.0, rot=(('x', 35),))                                                        # windshield arch
            q.hull([(cw * 0.7, fr * 0.6, cz - fr * 1.3), (-cw * 0.7, fr * 0.6, cz - fr * 1.3), (cw * 0.5, fr * 0.78, cz - fr * 1.8), (-cw * 0.5, fr * 0.78, cz - fr * 1.8),
                    (cw * 0.2, fr * 0.7, cz - fr * 2.8), (-cw * 0.2, fr * 0.7, cz - fr * 2.8), (cw * 0.4, fr * 0.9, cz - fr * 1.6), (-cw * 0.4, fr * 0.9, cz - fr * 1.6)], 'olive', 0.01)   # turtleback
            q.hull([(0.15 * fr, fr * 0.95, cz - fr * 0.9), (-0.15 * fr, fr * 0.95, cz - fr * 0.9), (0.14 * fr, fr * 1.15, cz - fr * 1.05), (-0.14 * fr, fr * 1.15, cz - fr * 1.05), (0.12 * fr, fr * 0.9, cz - fr * 1.2), (-0.12 * fr, fr * 0.9, cz - fr * 1.2)], 'dark', 0.0)       # headrest seen through
        if not prop: q.hull([(0.2 * fr, 0.45 * fr, L * 0.1), (0.3 * fr, 0.55 * fr, -L * 0.1), (0.1 * fr, 0.95 * fr, L * 0.02), (0.08 * fr, 0.9 * fr, -L * 0.3), (0.12 * fr, 0.55 * fr, -L * 0.34)], 'olive', 0.0, mirror=True)
        if k == 'prop': q.hull([(0.15 * fr, 0.7 * fr, -L * 0.02), (0.2 * fr, 0.7 * fr, -L * 0.25), (0.05 * fr, 1.0 * fr, -L * 0.08), (0.04 * fr, 0.7 * fr, -L * 0.3)], 'olive', 0.0, mirror=True)
        q.lathe([(0.025, 0), (0.012, 0.35)], (0.0, fr * 0.98, -L * 0.2), (0, 1, 0), 5, 'steel')                                                                            # blade antenna
        if not prop and k in ('jet', 'delta'):                                  # airbrake outline on the spine, blisters, chaff slots
            for sz in (-1, 1): strip(q, (-0.32 * fr, fr * 0.97, -L * 0.17 + sz * L * 0.045), (0.32 * fr, fr * 0.97, -L * 0.17 + sz * L * 0.045), 0.03, 0.03)
            for sx in (-1, 1): strip(q, (sx * 0.32 * fr, fr * 0.97, -L * 0.215), (sx * 0.32 * fr, fr * 0.97, -L * 0.125), 0.03, 0.03)
            for sx in (-1, 1): q.lathe([(0.1, 0), (0.08, 0.04), (0.0, 0.07)], (sx * fr * 0.55, fr * 0.8, -L * 0.28), (sx * 0.5, 1, 0), 8, 'olive')
            q.lathe([(0.12, 0), (0.1, 0.05), (0.0, 0.09)], (0, -fr * 0.97, L * 0.14), (0, -1, 0), 8, 'olive')
            for i in range(4): strip(q, (-0.25 * fr, -fr * 0.98, -L * 0.3 - i * 0.12), (0.25 * fr, -fr * 0.98, -L * 0.3 - i * 0.12), 0.03, 0.02)
        # ---- wings: aerofoil sections, root fillets, hinge gaps, fences, tips
        x0 = fr * 0.4; zl0 = wz + root / 2; zl1 = wz - swo + tip / 2; th0 = root * (0.15 if prop else 0.075) * (1.2 if k == 'heavy' else 1); th1 = max(0.05, tip * (0.12 if prop else 0.07))
        for s in (-1, 1):
            wing(q, s, x0, half - 0.05, zl0, root, th0, zl1, tip, th1, wy, wy + dih * half)
            wing_gaps(q, s, x0 + fr * 0.8, half - 0.05, zl0, zl1, root, tip, th0, th1, wy, wy + dih * half)
            q.hull([(s * x0, wy - th0 * 0.45, zl0 - root * 0.05), (s * x0, wy + th0 * 0.5, zl0 - root * 0.05), (s * fr * 1.0, wy + th0 * 0.5 + 0.04, zl0 - root * 0.25), (s * fr * 1.0, wy - th0 * 0.5, zl0 - root * 0.25),
                    (s * x0, wy + th0 * 0.3, zl0 - root * 0.8), (s * fr * 0.95, wy + th0 * 0.4, zl0 - root * 0.7)], 'olive', 0.0)                                              # root fillet
            xt = half - 0.05; q.box((s * (xt - 0.03), wy + dih * half, zl1 - tip * 0.5), (0.12, 0.05, 0.1), 'red', 0.0)                                                    # wing-tip light
            if sw > 0.2 or k == 'heavy': q.box((s * (x0 + (half - x0) * 0.6), wy + dih * half * 0.6 + th0 * 0.5 + 0.03, lerp(zl0, zl1, 0.6) - root * 0.35), (0.025, 0.14, root * 0.55), 'olive', 0.0)   # wing fence
            if k == 'jet' and 'tip' not in f:
                q.box((s * (half - 0.28), wy + dih * half - th1 * 0.5 - 0.05, zl1 - tip * 0.45), (0.05, 0.1, 0.9), 'steel', 0.0); store(q, s * (half - 0.28), wy + dih * half - 0.1, zl1 - tip * 0.45, 0.085, 1.9, 'steel', 8)
            if 'tip' in f: q.lathe([(0, -1.1), (0.22, -0.9), (0.3, -0.6), (0.32, -0.15), (0.3, 0.5), (0.2, 0.85), (0, 1.0)], (s * half, wy + dih * half, wz - swo), (0, 0, 1), 12, 'olive')
        # ---- tail: tailplane with elevators, fin with rudder, tip light, dorsal fillet
        if k != 'delta':
            tz0 = -L * 0.42 + L * 0.065; tzl1 = tz0 - (L * 0.04 + math.tan(sw) * S * 0.1) + L * 0.035; ty = (fr * 0.3 if 'twin' in f else 0.1); th_s = S * (0.18 if k == 'heavy' else 0.2)
            for s in (-1, 1):
                wing(q, s, fr * 0.4, th_s, tz0, L * 0.13, 0.11, tzl1, L * 0.07, 0.06, ty, ty)
                strip(q, (s * fr * 0.7, ty + 0.056, tz0 - L * 0.13 * 0.65), (s * th_s * 0.95, ty + 0.03, tzl1 - L * 0.07 * 0.65), 0.02, 0.01)                              # elevator hinge
        yt = a.ytop - 0.03
        def rud(x, y0, y1, zl, c):
            for sg in (-1, 1): strip(q, (x + sg * 0.065, y0, zl - c * 0.7), (x + sg * 0.065, y1, zl - c * 0.7), 0.02, 0.012, (1, 0, 0))
        if 'twin' in f:
            for s in (-1, 1): fin(q, s * fr * 0.9, s * (fr * 0.9 + fr * 0.5), fr * 0.5, yt, -L * 0.3, L * 0.17, -L * 0.38, L * 0.08, 0.16); rud(s * fr * 0.9 + s * fr * 0.1, fr * 0.9, yt - 0.1, -L * 0.34, L * 0.13)
        elif 'twintail' in f:
            for s in (-1, 1): fin(q, s * S * 0.1, s * S * 0.1, 0.0, yt, -L * 0.34, L * 0.13, -L * 0.4, L * 0.07, 0.16); rud(s * S * 0.1, 0.4, yt - 0.1, -L * 0.37, L * 0.1)
        elif k == 'atk':
            for s in (-1, 1): fin(q, s * S * 0.11, s * S * 0.11, 0.0, yt, -L * 0.34, L * 0.12, -L * 0.4, L * 0.06, 0.16); rud(s * S * 0.11, 0.4, yt - 0.1, -L * 0.37, L * 0.09)
        elif k == 'delta':
            fin(q, 0, 0, fr * 0.5, yt, -L * 0.28, L * 0.2, -L * 0.42, L * 0.08, 0.18); rud(0, fr * 0.8, yt - 0.1, -L * 0.35, L * 0.14)
        else:
            fin(q, 0, 0, fr * 0.4, yt, -L * 0.3, L * 0.2, -L * 0.4, L * 0.1, 0.18); rud(0, fr * 0.7, yt - 0.1, -L * 0.35, L * 0.15)
            q.hull([(0.05, fr * 0.8, -L * 0.2), (-0.05, fr * 0.8, -L * 0.2), (0.03, fr * 1.4, -L * 0.3), (-0.03, fr * 1.4, -L * 0.3), (0.02, fr * 0.9, -L * 0.34), (-0.02, fr * 0.9, -L * 0.34)], 'olive', 0.0)    # dorsal fillet
        if 'canard' in f:
            for s in (-1, 1): wing(q, s, fr * 0.6, fr * 0.6 + fr * 2.2, L * 0.3, L * 0.1, 0.1, L * 0.3 - L * 0.04, L * 0.03, 0.05, fr * 0.2, fr * 0.2)
        # ---- engines, nacelles, pods, intakes
        if k in ('bomber', 'heavy') or 'eng4' in f:
            ne = 4 if 'eng4' in f else 2
            for i in range(ne):
                s = 1 if i % 2 else -1; ex = s * S * (0.17 if ne == 4 and i < 2 else 0.32 if ne == 4 else 0.22); ez = wz - math.tan(sw) * abs(ex) + (L * 0.06 if prop else L * 0.04)
                ey = wy - (0.2 if prop else fr * 0.6) + dih * abs(ex)
                if prop:
                    q.lathe(smooth_prof([(0.0, -L * 0.15), (fr * 0.22, -L * 0.13), (fr * 0.42, -L * 0.07), (fr * 0.5, L * 0.0), (fr * 0.5, L * 0.08), (fr * 0.34, L * 0.125), (fr * 0.2, L * 0.14)], 9) + [(0, L * 0.14)], (ex, ey, ez), (0, 0, 1), max(8, a.seg - 6), 'olive')
                    q.lathe([(fr * 0.34, L * 0.115), (fr * 0.39, L * 0.128), (fr * 0.36, L * 0.14)], (ex, ey, ez), (0, 0, 1), 12, 'steel', loop=True)
                    for sk in range(5): q.lathe([(0.05, 0), (0.04, 0.12)], (ex + s * fr * 0.46, ey + fr * 0.05 - sk * 0.0, ez + L * 0.04 - sk * 0.12), (s, 0.1, -0.2), 5, 'steel')
                else:
                    q.lathe(smooth_prof([(fr * 0.3, -L * 0.11), (fr * 0.42, -L * 0.07), (fr * 0.44, L * 0.0), (fr * 0.4, L * 0.09), (fr * 0.46, L * 0.11)], 8), (ex, ey, ez), (0, 0, 1), max(8, a.seg - 6), 'olive')
                    lip(q, ex, ey, ez + L * 0.115, fr * 0.44, max(8, a.seg - 8)); nozzle(q, ex, ey, ez - L * 0.11, fr * 0.3, L * 0.04, max(8, a.seg - 8))
                    q.box((ex, ey + fr * 0.6 + 0.05, ez + 0.2), (0.12, fr * 0.5, L * 0.12), 'olive')
                    q.box((ex, ey + fr * 0.46, ez + L * 0.08), (0.06, fr * 0.1, L * 0.06), 'steel', 0.0)
        if 'twinpod' in f:
            for s in (-1, 1):
                px = s * fr * 1.25; py = fr * 0.9; pz = -L * 0.22
                q.lathe(smooth_prof([(fr * 0.3, -L * 0.11), (fr * 0.46, -L * 0.07), (fr * 0.5, L * 0.0), (fr * 0.42, L * 0.1), (fr * 0.44, L * 0.11)], 8), (px, py, pz), (0, 0, 1), 14, 'olive')
                lip(q, px, py, pz + L * 0.115, fr * 0.46, max(8, a.seg - 8)); nozzle(q, px, py, pz - L * 0.11, fr * 0.32, L * 0.04, max(8, a.seg - 8))
                q.box((s * fr * 0.9, fr * 0.7, -L * 0.2), (fr * 0.6, 0.12, L * 0.2), 'olive')
        if 'side' in f:
            for s in (-1, 1):
                q.hull([(s * fr * 0.78, -fr * 0.5, L * 0.04), (s * fr * 0.78, fr * 0.45, L * 0.04), (s * fr * 1.28, -fr * 0.3, L * 0.04), (s * fr * 1.28, fr * 0.4, L * 0.04),
                        (s * fr * 0.9, -fr * 0.3, L * 0.26), (s * fr * 0.9, fr * 0.3, L * 0.26), (s * fr * 1.15, -fr * 0.3, L * 0.26), (s * fr * 1.15, fr * 0.3, L * 0.26)], 'olive', 0.01)
                q.box((s * fr * 1.0, 0, L * 0.268), (fr * 0.34, fr * 0.55, 0.05), 'dark', 0.0)
                q.box((s * fr * 0.8, 0, L * 0.27), (0.03, fr * 0.8, 0.3), 'olive', 0.0)                                     # splitter plate
                q.lathe([(fr * 0.28, 0), (fr * 0.3, 0.06), (fr * 0.27, 0.1)], (s * fr * 1.03, 0.0, L * 0.255), (0, 0, 1), 12, 'steel', loop=True, sc=(0.7, 1.0))
        # ---- ordnance on pylons
        if k == 'atk' or 'big' in f or k == 'heavy':
            for s in (-1, 1):
                for i in range(2):
                    x = s * (fr + 1.2 + i * 1.3); y = wy + dih * abs(x) - 0.45
                    q.hull([(x - 0.04, y + 0.3, wz + 0.55), (x + 0.04, y + 0.3, wz + 0.55), (x - 0.04, y + 0.3, wz - 0.1), (x + 0.04, y + 0.3, wz - 0.1), (x - 0.04, y + 0.08, wz + 0.35), (x + 0.04, y + 0.08, wz + 0.35), (x - 0.04, y + 0.08, wz + 0.05), (x + 0.04, y + 0.08, wz + 0.05)], 'steel', 0.0)
                    store(q, x, y, wz + 0.2, 0.17, 1.6, 'olive', 8)
        if 'belly' in f: q.lathe(smooth_prof([(0.02, -L * 0.15), (fr * 0.45, -L * 0.1), (fr * 0.55, 0.0), (fr * 0.5, L * 0.1), (fr * 0.1, L * 0.145)], 7) + [(0, L * 0.15)], (0, -fr * 0.82, 0), (0, 0, 1), 12, 'olive', sc=(1, 0.65))
        # ---- landing gear and its doors
        if 'gear' in f:
            for s in (-1, 1):
                x = s * fr * 1.6; yw = a.ybot + 0.34; q.box((x, (wy + yw) / 2 - 0.1, L * 0.06), (0.12, wy - yw - 0.2, 0.12), 'steel'); q.lathe([(0.07, 0), (0.07, 0.4)], (x, yw + 0.3, L * 0.06), (0, 1, 0), 6, 'alloy')
                pwheel(q, s, x + s * 0.1, yw, L * 0.06, 0.32, 0.2, 12); q.box((x * 0.8, wy - 0.25, L * 0.06 - 0.25), (0.06, 0.06, 0.6), 'steel', 0.0)
                q.box((x + s * 0.2, wy - th0 * 0.5 - 0.01, L * 0.06), (0.04, 0.02, 0.9), 'dark', 0.0)
                for sz in (-1, 1): strip(q, (x - 0.22, wy - th0 * 0.5 - 0.01, L * 0.06 + sz * 0.45), (x + 0.22, wy - th0 * 0.5 - 0.01, L * 0.06 + sz * 0.45), 0.03, 0.02)
            q.box((0, -fr * 0.9, -L * 0.42), (0.07, 0.4, 0.07), 'steel'); pwheel(q, 1, 0.07, -fr * 1.15, -L * 0.42, 0.14, 0.08, 10)
        else:
            a.belly_outline(-fr * 0.5, L * 0.06, 0.5 * fr, 1.4, fr); a.belly_outline(fr * 0.5, L * 0.06, 0.5 * fr, 1.4, fr); a.belly_outline(0, L * 0.3, 0.4 * fr, 0.8, fr * 0.8)
        a.guns(lambda x: zle_at(zl0, zl1, x0, half, x))
        a.prop_parts()

    # ---------------- flying wing
    def flywing(a):
        q = a.body; L, S = a.L, a.S; half = S / 2; wz = L * 0.2; root = L * 0.9; tip = L * 0.18; swo = L * 0.55
        for s in (-1, 1):
            wing(q, s, 0.0, half - 0.05, wz + root / 2, root, 1.0, wz - swo + tip / 2, tip, 0.3, 0.0, 0.0)
            wing_gaps(q, s, 2.0, half - 0.05, wz + root / 2, wz - swo + tip / 2, root, tip, 1.0, 0.3, 0.0, 0.0)
            for i in range(2):
                cx = s * (1.6 + i * 2.0); cz = L * 0.05 - i * 0.4
                q.hull([(cx - 0.6, 0.3, cz + 1.5), (cx + 0.6, 0.3, cz + 1.5), (cx - 0.5, 0.9, cz + 0.6), (cx + 0.5, 0.9, cz + 0.6), (cx - 0.6, 0.3, cz - 1.5), (cx + 0.6, 0.3, cz - 1.5), (cx - 0.5, 0.8, cz - 1.2), (cx + 0.5, 0.8, cz - 1.2)], 'olive', 0.01)
                q.box((cx, 0.62, cz + 1.4), (0.8, 0.5, 0.06), 'dark', 0.0)
            nozzle(q, s * 2.6, 0.55, -L * 0.07, 0.4, 0.5, 12)
            strip(q, (s * 10.0, 0.0, wz - swo * 0.9), (s * (half - 0.2), 0.0, wz - swo - 0.3), 0.04, 0.06, (0, 1, 0), 'dark')
            q.box((s * (half - 0.2), 0.0, wz - swo - tip * 0.5), (0.25, 0.1, 0.2), 'red', 0.0)
        q.hull([(0.2, 0.2, L * 0.7 - 0.9), (1.8, 0.2, L * 0.3), (1.8, 0.2, -L * 0.3), (0.3, 0.2, -L * 0.45), (0.25, 0.75, L * 0.5), (1.1, 1.0, L * 0.2), (1.0, 1.0, -L * 0.2), (0.2, 1.0, -L * 0.3),
                (0.25, -0.5, L * 0.5), (1.5, -0.6, L * 0.1), (1.0, -0.6, -L * 0.3)], 'olive', 0.015, mirror=True)
        dome(q, (0, 0.85, L * 0.3), 0.5, 0.3, 1.6, 'red', 12, (0, 1, 0))
        for i in range(3): q.box((0, 1.12, L * 0.3 - 0.8 + i * 0.8), (0.95, 0.05, 0.05), 'steel', 0.0)
        for s in (-1, 1):
            q.box((s * 2.4, -0.3, L * 0.5 - 0.5), (0.9, 0.1, 2.0), 'dark'); q.box((s * 1.8, -0.2, L * 0.5 - 0.5), (0.03, 0.2, 2.0), 'olive', 0.0)
            self_ = a; a.belly_outline(s * 2.0, L * 0.1, 1.0, 2.0, 3.0) if False else None
        for sx in (-1, 1):
            for i in range(4): strip(q, (sx * (3.0 + i * 1.8), 0.46, L * 0.25 - i * 1.1), (sx * (4.0 + i * 1.8), 0.46, L * 0.25 - i * 1.1 - 0.8), 0.05, 0.03)
            for zz in (-L * 0.1, L * 0.2): strip(q, (sx * 0.9, -0.43, zz), (sx * 3.4, -0.43, zz), 0.05, 0.03)
            strip(q, (sx * 0.9, -0.43, -L * 0.1), (sx * 0.9, -0.43, L * 0.2), 0.05, 0.03); strip(q, (sx * 3.4, -0.43, -L * 0.1), (sx * 3.4, -0.43, L * 0.2), 0.05, 0.03)
            lip(q, sx * 2.4, -0.25, L * 0.5 + 0.3, 0.5, 12)
            q.lathe([(0.12, 0), (0.1, 0.05), (0.0, 0.09)], (sx * 5.0, 0.35, -L * 0.1), (0, 1, 0), 8, 'olive')
        a.guns(ports=True)

    # ---------------- stealth fighter
    def stealth(a):
        q = a.body; L, S = a.L, a.S; fr = L * 0.07; half = S / 2
        q.hull([(0.18 * fr, -0.1 * fr, L * 0.41), (2.75 * fr, -0.2 * fr, -L * 0.2), (2.1 * fr, -0.2 * fr, -L * 0.41), (0.2 * fr, 0.55 * fr, L * 0.33), (1.5 * fr, 0.7 * fr, -L * 0.18), (1.2 * fr, 0.7 * fr, -L * 0.4),
                (0.25 * fr, -0.75 * fr, L * 0.3), (1.8 * fr, -0.75 * fr, -L * 0.3), (0.2 * fr, 0.2 * fr, L * 0.41), (1.0 * fr, -0.6 * fr, -L * 0.1)], 'olive', 0.012, mirror=True)
        q.hull([(0.5 * fr, 0.5 * fr, L * 0.3), (1.0 * fr, 0.5 * fr, L * 0.05), (1.0 * fr, 0.5 * fr, -L * 0.28), (0.3 * fr, 1.3 * fr, L * 0.22), (0.4 * fr, 1.2 * fr, -L * 0.05), (0.3 * fr, 0.8 * fr, -L * 0.3)], 'olive', 0.01, mirror=True)
        dome(q, (0, fr * 0.8, L * 0.2), fr * 0.5, fr * 0.55, fr * 1.7, 'red', 12, (0, 1, 0))
        for i in range(4): q.box((0, fr * 1.28 - i * 0.0, L * 0.2 - fr * 1.3 + i * fr * 0.85), (fr * 1.0, 0.05, 0.05), 'steel', 0.0)
        q.lathe([(fr * 0.3, 0), (fr * 0.1, 0.1), (0.02, 0.18)], (0, 0.1 * fr, L * 0.41), (0, 0, 1), 8, 'dark')
        zr = -L * 0.12 + L * 0.225
        for s in (-1, 1):
            xa = fr * 2.2; xb = half + fr * 0.2; zl1 = zr - L * 0.32 - L * 0.1; c1 = L * 0.1
            wing(q, s, xa, xb, zr, L * 0.45, 0.25, zl1, c1, 0.12, 0.0, 0.0)
            wing_gaps(q, s, xa + 0.6, xb, zr, zl1, L * 0.45, c1, 0.25, 0.12, 0.0, 0.0)
            fin(q, s * fr * 1.6, s * (fr * 1.6 + fr * 1.1), fr * 0.5, a.ytop - 0.03, -L * 0.28, L * 0.2, -L * 0.4, L * 0.1, 0.14)
            for sg in (-1, 1): strip(q, (s * fr * 2.0 + sg * 0.07, fr * 1.0, -L * 0.36), (s * fr * 2.5 + sg * 0.07, a.ytop - 0.2, -L * 0.4), 0.02, 0.012, (1, 0, 0))
            q.hull([(s * fr * 0.9, -fr * 0.6, L * 0.2), (s * fr * 1.5, -fr * 0.6, L * 0.2), (s * fr * 0.9, fr * 0.3, L * 0.2), (s * fr * 1.5, fr * 0.3, L * 0.2), (s * fr * 1.1, -fr * 0.6, L * 0.05), (s * fr * 1.7, -fr * 0.6, L * 0.05), (s * fr * 1.1, fr * 0.3, L * 0.05)], 'olive', 0.01)
            q.box((s * fr * 1.2, -fr * 0.15, L * 0.2 + 0.02), (fr * 0.6, fr * 0.8, 0.05), 'dark', 0.0)
            q.box((s * (xb - 0.1), 0.0, zl1 - c1 * 0.4), (0.2, 0.05, 0.12), 'red', 0.0)
            strip(q, (s * fr * 1.3, -fr * 0.76, L * 0.05), (s * fr * 1.3, -fr * 0.76, -L * 0.15), 0.5, 0.02)
        for sx in (-1, 1):
            for sz in (-1, 1): strip(q, (sx * fr * 0.6, -fr * 0.77, -L * 0.15 + sz * L * 0.1), (sx * fr * 1.4, -fr * 0.77, -L * 0.15 + sz * L * 0.1), 0.04, 0.025)
            strip(q, (sx * fr * 0.6, -fr * 0.77, -L * 0.25), (sx * fr * 0.6, -fr * 0.77, -L * 0.05), 0.04, 0.025); strip(q, (sx * fr * 1.4, -fr * 0.77, -L * 0.25), (sx * fr * 1.4, -fr * 0.77, -L * 0.05), 0.04, 0.025)
            strip(q, (sx * fr * 0.25, -fr * 0.74, L * 0.3), (sx * fr * 0.25, -fr * 0.74, L * 0.18), 0.04, 0.025)
            for i in range(5): strip(q, (sx * fr * 0.3, fr * 0.72 + 0.0, L * 0.12 - i * L * 0.1), (sx * fr * 1.3, fr * 0.72, L * 0.12 - i * L * 0.1 - 0.3), 0.03, 0.02)
            q.lathe([(fr * 0.1, 0), (fr * 0.08, 0.05), (0, 0.09)], (sx * fr * 0.7, fr * 0.78, -L * 0.2), (sx * 0.4, 1, 0), 8, 'olive')
        q.box((0, 0.0, -L * 0.41), (fr * 2.4, fr * 0.6, 0.3), 'dark', 0.01)
        for i in range(6):                                                                                                              # sawtooth trailing edge round the nozzle
            x0_ = -fr * 1.25 + i * fr * 0.5; q.hull([(x0_, fr * 0.28, -L * 0.41), (x0_ + fr * 0.5, fr * 0.28, -L * 0.41), (x0_ + fr * 0.25, fr * 0.2, -L * 0.41 - 0.45), (x0_, -fr * 0.28, -L * 0.41), (x0_ + fr * 0.5, -fr * 0.28, -L * 0.41), (x0_ + fr * 0.25, -fr * 0.2, -L * 0.41 - 0.45)], 'olive', 0.0)
        for sx in (-1, 1):
            lip(q, sx * fr * 1.2, -fr * 0.15, L * 0.2 + 0.1, fr * 0.42, 12)
            for i in range(3):
                strip(q, (sx * (fr * 2.6 + i * 0.4), 0.05, -L * 0.02 - i * 0.5), (sx * (half - 0.8), 0.05, -L * 0.2 - i * 0.7), 0.03, 0.02)
                strip(q, (sx * (fr * 2.6 + i * 0.4), -0.05, -L * 0.02 - i * 0.5), (sx * (half - 0.8), -0.05, -L * 0.2 - i * 0.7), 0.03, 0.02)
            q.lathe([(fr * 0.15, 0), (fr * 0.12, 0.08), (0, 0.14)], (sx * fr * 1.0, -fr * 0.7, L * 0.25), (0, -1, 0), 8, 'olive')
        a.guns(ports=True)

    # ---------------- helicopters
    def heli(a):
        q = a.body; L = a.L; f = a.f; v = a.v; bw = L * (0.1 if 'tandem' in f else 0.14)
        mastY = bw * 1.7 + 0.25; sg_ = a.seg; tandem = 'tandem' in f
        if tandem:
            q.hull([(bw, -bw * 1.2, L * 0.33), (bw * 0.45, -bw * 1.2, L * 0.33), (bw, bw * 0.0, L * 0.33), (bw * 0.45, bw * 0.9, L * 0.33), (bw * 0.45, -bw * 1.2, L * 0.3), (bw * 0.9, 1.1 * bw, L * 0.15), (bw * 0.7, bw * 1.2, -L * 0.1), (bw, -bw * 1.2, L * 0.0),
                    (bw, -bw * 1.2, -L * 0.17), (bw * 0.7, 1.2 * bw, -L * 0.17), (bw * 0.5, -bw * 1.0, L * 0.37), (bw * 0.15, 0.1 * bw, L * 0.385)], 'olive', 0.015, mirror=True)
            for (zc, yc) in ((L * 0.235, bw * 0.95), (L * 0.09, bw * 1.25)):
                dome(q, (0, yc, zc), bw * 0.72, bw * 0.55, bw * 1.2, 'red', 12, (0, 1, 0))
                for i in range(3): q.box((0, yc + bw * 0.5, zc - bw * 0.9 + i * bw * 0.9), (bw * 1.5, 0.05, 0.05), 'steel', 0.0)
                for s in (-1, 1): strip(q, (s * bw * 0.7, yc + 0.02, zc - bw * 1.2), (s * bw * 0.7, yc + 0.02, zc + bw * 1.2), 0.04, 0.05, (0, 1, 0), 'steel')
            q.lathe([(0.12, 0), (0.12, 1.2), (0.08, 1.4), (0.14, 1.45), (0.14, 1.55), (0.06, 1.6)], (0, -bw * 1.2, L * 0.3 - 0.65), (0, 0, 1), 8, 'steel')     # chin gun
            q.lathe([(0.0, 0.25), (0.22, 0.12), (0.26, -0.1), (0.2, -0.3), (0, -0.3)], (0, -bw * 1.2, L * 0.3 - 0.75), (0, 1, 0), 10, 'alloy') if False else None
            q.lathe([(0.0, 0.3), (0.25, 0.18), (0.3, 0.0), (0.2, -0.2), (0.0, -0.25)], (0, -bw * 1.05, L * 0.3 - 0.8), (0, 1, 0), 10, 'alloy', sc=(1, 1.4))        # gun turret ball
            q.lathe([(0.0, 0.3), (0.2, 0.15), (0.24, 0.0), (0.0, -0.2)], (0.0, -bw * 0.25, L * 0.37), (0, 0, 1), 10, 'dark')                                                 # sensor ball in the nose
            for s in (-1, 1):
                q.lathe(smooth_prof([(0.0, -L * 0.12), (bw * 0.4, -L * 0.1), (bw * 0.55, -L * 0.03), (bw * 0.55, L * 0.05), (bw * 0.3, L * 0.1), (0.0, L * 0.12)], 8), (s * bw * 0.85, bw * 0.55, -L * 0.04), (0, 0, 1), 12, 'olive')      # engine nacelles
                q.lathe([(0.0, 0), (bw * 0.4, 0)], (s * bw * 0.85, bw * 0.55, L * 0.07), (0, 0, 1), 10, 'dark', caps=False)
                nozzle(q, s * bw * 0.85, bw * 0.55, -L * 0.15, bw * 0.28, L * 0.03, 10)
        else:
            q.lathe(smooth_prof([(0.0, -L * 0.14), (bw * 0.9, -L * 0.1), (bw * 1.25, L * 0.0), (bw * 1.2, L * 0.1), (bw * 0.95, L * 0.2), (bw * 0.6, L * 0.27), (bw * 0.3, L * 0.3)], 10) + [(0.0, L * 0.31)], (0, 0, 0), (0, 0, 1), sg_, 'olive', sc=(0.95, 1.0))
            dome(q, (0, bw * 0.15, L * 0.18), bw * 0.9, bw * 0.95, bw * 1.5, 'red', 14, (0, 1, 0))
            for i in range(3): q.box((0, bw * 0.15 + bw * 0.9, L * 0.18 - bw * 0.8 + i * bw * 0.8), (bw * 1.7, 0.05, 0.05), 'steel', 0.0)
            for s in (-1, 1):
                for sz in (-0.5, 0.3): strip(q, (s * bw * 1.02, bw * 0.0, L * 0.1 + sz * L * 0.1), (s * bw * 1.02, bw * 0.9, L * 0.1 + sz * L * 0.1), 0.04, 0.03, (1, 0, 0))     # door frames
                strip(q, (s * bw * 1.12, bw * 0.45, L * 0.0), (s * bw * 1.12, bw * 0.45, L * 0.2), 0.04, 0.03, (1, 0, 0))
            q.lathe([(0.0, 0.15), (0.12, 0.1), (0.14, 0)], (0, bw * 0.15 + bw * 0.1, L * 0.27 - 0.1), (0, 0, 1), 8, 'dark')
        q.lathe(smooth_prof([(bw * 0.2, -L * 0.54), (bw * 0.28, -L * 0.45), (bw * 0.4, -L * 0.3), (bw * 0.5, -L * 0.15), (bw * 0.55, L * 0.0)], 9), (0, bw * 0.3, 0), (0, 0, 1), 12, 'olive')        # tail boom
        q.lathe([(bw * 0.2, 0), (bw * 0.1, -0.2), (0.03, -0.3)], (0, bw * 0.3, -L * 0.54), (0, 0, 1), 8, 'steel')
        fin(q, 0, 0, bw * 0.3, bw * 0.3 + L * 0.17, -L * 0.44, L * 0.09, -L * 0.5, L * 0.045, 0.14)
        for sg in (-1, 1): strip(q, (sg * 0.08, bw * 0.4, -L * 0.44 - L * 0.07 * 0.6), (sg * 0.08, bw * 0.3 + L * 0.16, -L * 0.5 - L * 0.045 * 0.3), 0.02, 0.012, (1, 0, 0))
        for s in (-1, 1): wing(q, s, 0.1, 0.1 + L * 0.1, -L * 0.45 + L * 0.03, L * 0.06, 0.08, -L * 0.45, L * 0.04, 0.05, bw * 0.3, bw * 0.3)
        q.box((0, bw * 0.3 + L * 0.17 + 0.04, -L * 0.47), (0.12, 0.08, 0.25), 'red', 0.0)
        q.lathe([(bw * 0.6, 0), (bw * 0.8, bw * 0.4), (bw * 0.55, bw * 0.8)], (0, bw * 0.95, L * 0.02), (0, 1, 0), 12, 'olive')                                                             # engine hump
        q.hull([(bw * 0.5, bw * 0.9, L * 0.1), (bw * 0.5, bw * 1.4, L * 0.1), (bw * 0.5, bw * 0.9, -L * 0.14), (bw * 0.3, bw * 1.5, -L * 0.1), (0.1, bw * 1.5, L * 0.05)], 'olive', 0.01, mirror=True)
        for s in (-1, 1):
            q.lathe([(0.0, 0.0), (bw * 0.28, 0.0)], (s * bw * 0.62, bw * 1.3, -L * 0.07), (0, 0, -1), 10, 'dark', caps=False)
            q.lathe([(bw * 0.28, 0), (bw * 0.3, -0.08), (bw * 0.24, -0.2)], (s * bw * 0.62, bw * 1.3, -L * 0.07), (0, 0, 1), 10, 'steel', loop=True)
            q.lathe([(bw * 0.2, 0), (bw * 0.22, 0.1)], (s * bw * 0.45, bw * 1.5, L * 0.1), (0, 0, 1), 10, 'dark')                                                                             # intake mouths
        q.lathe([(0.12, -0.25), (0.12, 0.2), (0.2, 0.28)], (0, mastY - 0.2, L * 0.02), (0, 1, 0), 10, 'steel')
        q.lathe([(0.3, 0), (0.28, 0.1), (0.2, 0.2)], (0, mastY - 0.5, L * 0.02), (0, 1, 0), 10, 'olive')
        for (x, y, z) in v['muzzles'][1:]:
            s = 1 if x > 0 else -1
            if 'stubs' in f:
                wing(q, s, bw * 0.5, abs(x), L * 0.02 + L * 0.05, L * 0.1, 0.15, L * 0.02 + L * 0.03, L * 0.07, 0.1, -bw * 0.2, -bw * 0.5)
                q.box((x, y + 0.3, z - 0.3), (0.08, 0.36, 0.5), 'steel', 0.0)
                q.lathe([(0, -0.7), (0.2, -0.6), (0.28, -0.35), (0.28, 0.5), (0.22, 0.6), (0.0, 0.66)], (x, y, z - 0.66), (0, 0, 1), 12, 'olive')
                q.lathe([(0.0, 0.0), (0.2, 0.0)], (x, y, z), (0, 0, 1), 12, 'dark', caps=False)
                for kk in range(6 if a.seg > 14 else 3):
                    ang = kk * math.pi / 3; q.lathe([(0.035, 0), (0.035, 0.18)], (x + 0.12 * math.cos(ang), y + 0.12 * math.sin(ang), z - 0.05), (0, 0, 1), 5, 'steel')
                q.box((s * (abs(x) + 0.0), y + 0.0, z - 0.7), (0.5, 0.06, 0.4), 'olive', 0.0, rot=(('z', 45),))
        if 'scout' in f or not tandem:
            for s in (-1, 1):
                xk = s * bw * 1.1; q.box((xk, -bw * 1.45, L * 0.08), (0.1, 0.1, L * 0.45), 'steel')
                q.hull([(xk - 0.05, -bw * 1.5, L * 0.08 + L * 0.225), (xk + 0.05, -bw * 1.5, L * 0.08 + L * 0.225), (xk - 0.05, -bw * 1.4, L * 0.08 + L * 0.225 + 0.3), (xk + 0.05, -bw * 1.4, L * 0.08 + L * 0.225 + 0.3), (xk - 0.05, -bw * 1.4, L * 0.08 + L * 0.2), (xk + 0.05, -bw * 1.4, L * 0.08 + L * 0.2)], 'steel', 0.0)
                for z in (L * 0.2, -L * 0.05): q.box((xk * 0.95, -bw * 1.15, z), (0.08, bw * 0.6, 0.08), 'steel', 0.0)
            q.box((0, -bw * 1.2, L * 0.2), (bw * 2.2, 0.06, 0.06), 'steel', 0.0); q.box((0, -bw * 1.2, -L * 0.05), (bw * 2.2, 0.06, 0.06), 'steel', 0.0)
            q.lathe([(0.02, 0), (0.0, 0.5)], (0.0, bw * 1.5, -L * 0.1), (0, 1, 0), 5, 'steel')
        else:
            for s in (-1, 1):
                q.box((s * bw * 0.9, -bw * 1.0, L * 0.2), (0.1, bw * 0.6, 0.1), 'steel'); pwheel(q, s, s * bw * 0.9 + s * 0.12, -bw * 1.35, L * 0.2, 0.28, 0.2, 12)
                strip(q, (s * bw * 0.9, -bw * 1.05, L * 0.13), (s * bw * 0.9, -bw * 1.05, L * 0.27), 0.04, 0.03, (1, 0, 0))
            q.box((0, -bw * 1.1, -L * 0.2), (0.08, bw * 0.5, 0.08), 'steel'); pwheel(q, 1, 0.06, -bw * 1.4, -L * 0.2, 0.2, 0.12, 10)
        a.prop_parts()
    def build(a):
        k = a.k
        if k == 'wing': a.flywing(); a.prop_parts()
        elif k == 'stealth': a.stealth(); a.prop_parts()
        elif k == 'heli': a.heli()
        else: a.plane()

# ---------------------------------------------------------------- scene objects
def clear(vid):
    c = bpy.data.collections.get('v_' + vid)
    if c:
        for ob in list(c.objects): bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.collections.remove(c)
    for coll_ in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for d in list(coll_):
            if d.name.startswith(vid + '_') and d.users == 0: coll_.remove(d)
def make_vehicle(vid):
    v = VEH[vid]; clear(vid); log('building', vid, v['name'])
    for seg, lite in ((24, 0), (20, 0), (14, 0), (10, 1), (8, 2)):
        a = Air(v, seg, lite); a.build(); n = sum(len(f.verts) - 2 for f in a.kit.bm.faces)
        if n <= 4100 or seg == 8: break
        a.kit.bm.free()
    col = bpy.data.collections.new('v_' + vid); scene.collection.children.link(col)
    me = bpy.data.meshes.new(vid + '_all'); a.kit.bm.to_mesh(me); a.kit.bm.free()
    ob = bpy.data.objects.new(vid + '_all', me); col.objects.link(ob); split_uv(ob, 0.004)
    img = ss_tanks.tank_texture(ob, TEXN, vid + '_tank'); mat = image_material(vid + '_skin', img, 0.55, 0.35); gmat = gear_material(mat); gmat.name = vid + '_gear'
    gv = np.empty(len(me.vertices), np.int64); me.attributes['grp'].data.foreach_get('value', gv)
    names = []; parts = [('body', 'gun')] + [('prop%d' % i, g) for i, g in enumerate(('mag', 'bolt')[:len(v['props'])])]
    for part, gi in parts:
        if not (gv == GRP.index(gi)).any(): continue
        b2 = bmesh.new(); b2.from_mesh(me); b2.verts.ensure_lookup_table()
        bmesh.ops.delete(b2, geom=[x for x in b2.verts if gv[x.index] != GRP.index(gi)], context='VERTS')
        pm = bpy.data.meshes.new('%s_%s' % (vid, part)); b2.to_mesh(pm); b2.free(); split_by_class(pm, mat, gmat)
        po = bpy.data.objects.new('%s_%s' % (vid, part), pm); col.objects.link(po); names.append(po.name)
    bpy.data.objects.remove(ob, do_unlink=True); bpy.data.meshes.remove(me)
    cfg = {'blend': 'air.blend', 'out': '../../../Steel Storm Rebuilt/assets/v_' + vid, 'parts': names, 'maxTexture': TEXN}
    with open(os.path.join(REB, 'v_%s.export.json' % vid), 'w') as f: json.dump(cfg, f, indent=1)
    tr = sum(sum(len(f.vertices) - 2 for f in bpy.data.objects[n].data.polygons) for n in names); log(vid, 'triangles', tr, 'seg', seg)
    return tr

# ---------------------------------------------------------------- preview: one straight row, three-quarter from the front, a little above
def preview(ids, out, W=2000, H=600, az=30.0, el=24.0, spp=48, hover=3.0):
    sc = bpy.data.scenes.new('air_prev'); sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.render.engine = 'CYCLES'; sc.cycles.samples = spp; sc.cycles.use_denoising = True
    try: sc.view_settings.view_transform = 'Standard'
    except TypeError: pass
    w = bpy.data.worlds.new('sky'); w.use_nodes = True; nt = w.node_tree; bg = next(n for n in nt.nodes if n.type == 'BACKGROUND')
    try:
        sk = nt.nodes.new('ShaderNodeTexSky'); items = [i.identifier for i in sk.bl_rna.properties['sky_type'].enum_items]
        sk.sky_type = 'NISHITA' if 'NISHITA' in items else [i for i in items if 'MULTIPLE' in i or 'SINGLE' in i][0]; sk.sun_elevation = math.radians(48); sk.sun_rotation = math.radians(210); sk.sun_disc = False
        nt.links.new(sk.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = 0.5
    except Exception: bg.inputs['Color'].default_value = (0.5, 0.65, 0.9, 1)
    sc.world = w
    ld = bpy.data.lights.new('sun', 'SUN'); ld.energy = 2.6; ld.angle = math.radians(2.5); lo = bpy.data.objects.new('sun', ld); sc.collection.objects.link(lo)
    lo.rotation_euler = Vector((0.55, 0.45, -0.7)).to_track_quat('-Z', 'Y').to_euler()
    gm = bpy.data.materials.new('ground'); gm.use_nodes = True; next(n for n in gm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'].default_value = (0.42, 0.34, 0.22, 1)
    bpy.ops.mesh.primitive_plane_add(size=600); pl = bpy.context.active_object; pl.data.materials.append(gm)
    for c_ in list(pl.users_collection): c_.objects.unlink(pl)
    sc.collection.objects.link(pl)
    a_ = math.radians(az); right = Vector((math.cos(a_), math.sin(a_), 0))
    if math.cos(a_) < 0: ids = list(reversed(ids))
    wid = [0.66 * (VEH[i]['m']['span'] * abs(math.cos(a_)) + VEH[i]['m']['len'] * abs(math.sin(a_))) for i in ids]; gap = 0.0
    tot = sum(wid) + gap * (len(ids) - 1); x = -tot / 2
    for i, vid in enumerate(ids):
        col = bpy.data.collections.get('v_' + vid); xc = x + wid[i] / 2; x += wid[i] + gap
        if not col: continue
        sm = bpy.data.materials.get(vid + '_skin')
        if sm:
            c = VEH[vid]['m']['c'][0]; c3 = [((c >> s) & 255) / 255.0 for s in (16, 8, 0)]; c3 = [(t / 12.92 if t <= 0.04045 else ((t + 0.055) / 1.055) ** 2.4) for t in c3]
            nt2 = sm.node_tree; bs = next(t for t in nt2.nodes if t.type == 'BSDF_PRINCIPLED'); tx = next(t for t in nt2.nodes if t.type == 'TEX_IMAGE')
            mx = nt2.nodes.new('ShaderNodeMixRGB'); mx.blend_type = 'MULTIPLY'; mx.inputs['Fac'].default_value = 1.0; mx.inputs['Color2'].default_value = (c3[0] * 1.6, c3[1] * 1.6, c3[2] * 1.6, 1)
            nt2.links.new(tx.outputs['Color'], mx.inputs['Color1']); nt2.links.new(mx.outputs['Color'], bs.inputs['Base Color'])
        for ob in col.objects:
            sc.collection.objects.link(ob); ob.location = right * xc + Vector((0, 0, hover - VEH[vid]['body'][1] * 0.0))
    d = Vector((math.sin(a_) * math.cos(math.radians(el)), -math.cos(a_) * math.cos(math.radians(el)), math.sin(math.radians(el))))
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = tot * 1.02 + 6; cd.clip_start, cd.clip_end = 1, 800
    co = bpy.data.objects.new('cam', cd); sc.collection.objects.link(co); co.location = Vector((0, 0, 3.5)) + d * 300; co.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler(); sc.camera = co
    sc.render.filepath = out; sc.render.image_settings.file_format = 'PNG'; bpy.ops.render.render(write_still=True, scene=sc.name); log('preview', out)

# ---------------------------------------------------------------- run
if not bpy.data.filepath.replace('\\', '/').endswith('art/steelstorm/rebuilt/air.blend'):
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(REB, 'air.blend')); log('created', bpy.data.filepath)
if 'nobuild' not in OPT:
    tot_ = {vid: make_vehicle(vid) for vid in IDS}
    bpy.ops.wm.save_mainfile(); print('TRIS', json.dumps(tot_))
if 'shot' in OPT:
    kw = {k: (int(OPT[k]) if k in ('w', 'h', 'spp') else float(OPT[k])) for k in ('w', 'h', 'az', 'el', 'spp') if k in OPT}
    if 'w' in kw: kw['W'] = kw.pop('w')
    if 'h' in kw: kw['H'] = kw.pop('h')
    preview(IDS, OPT['shot'], **kw)
log('done')

