# Steel Storm Rebuilt: the ground vehicles, one parametric script. Every vehicle is built from its entry in
# art/steelstorm/rebuilt/vehicles.json (hull / turret / gun numbers, flags, the old part boxes) so that it keeps the old vehicle's size,
# turret and gun pivots and muzzle, but is modelled properly: sloped armour, running gear, hatches, mantlet, stowage, exhausts.
#   blender -b art/steelstorm/rebuilt/ground.blend -P tools/blender/make_ss_ground.py -- g1a g1b ...      (no ids: all 25 ground vehicles)
#     (first time: blender -b --factory-startup -P ... -- ids; the script creates ground.blend itself)
#   options: nobuild (skip building), preview (render art/mockups/ssx-ground-1.png of the ids), shot=<out.png> w= h= az= el= spp=
# then  node tools/export-art.mjs v_g1a v_g1b ...   ->  Steel Storm Rebuilt/assets/v_<id>.hgm
# Parts (vehicle space, +Y up / +Z forward in the game; here Blender forward is -Y, the exporter maps (x,y,z) -> (x,z,-y)):
#   <id>_body (hull, wheels, everything fixed), <id>_track (track runs, or the tyres), <id>_tur, <id>_gun, <id>_kitb / <id>_kitt (upgrade kit).
# Materials: <id>_skin (painted armour, tinted by the game) and <id>_gear (everything else) on one 1024 picture (baked AO, weathering: ss_tanks.tank_texture_v2); `track` for the runs.
# Modelling is done in GAME coordinates (x right, y up, z forward) and converted by B().
import bpy, bmesh, math, os, sys, json
import numpy as np
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hgkit import *
import ss_tanks
from ss_tanks import split_uv, gear_material, split_by_class, tank_texture

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OPT = dict((a.split('=', 1) + ['1'])[:2] for a in ARGV if not (len(a) >= 2 and a[0] == 'g' and a[1].isdigit()))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REB = os.path.join(ROOT, 'art', 'steelstorm', 'rebuilt'); TEXDIR = os.path.join(REB, 'tex'); os.makedirs(TEXDIR, exist_ok=True)
ss_tanks.TEXDIR = TEXDIR
VEH = {v['id']: v for v in json.load(open(os.path.join(REB, 'vehicles.json'))) if v['line'] == 'g'}
IDS = [a for a in ARGV if a in VEH] or ([] if any(a for a in ARGV if a in ('nobuild',)) and False else list(VEH))
scene = bpy.context.scene
TEXN = 1024
TRI_MAX = 11800                  # the .hgm limit (420 KB, about 35 bytes a triangle) binds before the 16000 triangle budget
BEVSEG = [2]; PITCH = [0.17]; CLEAT = [1]; DEFBEV = [1]
# repaint: gentler camouflage (darkest tone 0.72 x the base, mid tone 0.86 x), soft ambient shading, the game multiplies this by the side's colour
import inspect
_src = inspect.getsource(ss_tanks.decorate) + chr(10) + inspect.getsource(ss_tanks.tank_texture)
for _a, _b in (("np.array((0.29, 0.27, 0.20), np.float32) / base", "0.86"), ("np.array((0.12, 0.12, 0.11), np.float32) / base", "0.72"),
               ("(1 - 0.7 * so)", "(1 - 0.35 * so)"), ("col_[paint & panel] *= 0.6", "col_[paint & panel] *= 0.84"),
               ("(0.35 + 0.65 * np.clip(ao[idx], 0, 1) ** 1.3)", "(0.74 + 0.26 * np.clip(ao[idx], 0, 1) ** 1.3)"),
               ("(0.92 + 0.16 * grain[:, None]) * (0.92 + 0.16 * mott[:, None])", "(0.96 + 0.08 * grain[:, None]) * (0.96 + 0.08 * mott[:, None])"),
               ("(0.9 + 0.12 * streak[paint])", "(0.95 + 0.06 * streak[paint])"), ("np.where(paint, 0.62, 0.42)", "np.where(paint, 0.4, 0.42)"), ("np.array((0.46, 0.41, 0.32), np.float32)", "np.array((0.64, 0.60, 0.50), np.float32)")):
    assert _a in _src, _a
    _src = _src.replace(_a, _b)
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
        if bev <= 0 and DEFBEV[0] and min(sz) > 0.12 and cls in ('olive', 'steel'): bev = 0.012         # edges catch light
        return s.k.box((0, 0, 0), (sz[0], sz[2], sz[1]), cls, s.grp, bev=bev, M=M)
    def hull(s, pts, cls='olive', bev=0.012, mirror=False, minang=0.45):
        bev = max(bev, 0.024) if bev > 0 else 0
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
            try: bf = bmesh.ops.bevel(k.bm, geom=es, offset=bev, segments=BEVSEG[0], affect='EDGES', profile=0.5, clamp_overlap=True)['faces']
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

def hatch(q, x, y, z, r, cls='olive', lid=True, scopes=True):
    """a round hatch: low ring, domed lid, hinge, handle, a few periscopes round the ring"""
    sg = 16 if r > 0.2 else 12
    q.lathe([(r * 1.08, 0), (r * 1.08, 0.05), (r, 0.065), (r, 0.075), (r * 0.9, 0.08), (0, 0.08)] if not lid else
            [(r * 1.08, 0), (r * 1.08, 0.05), (r, 0.065), (r, 0.075), (r * 0.9, 0.085), (r * 0.3, 0.115), (0, 0.12)], (x, y, z), (0, 1, 0), sg, cls, caps=True)
    q.box((x, y + 0.06, z - r * 1.0), (r * 0.5, 0.045, 0.06), 'steel')                                     # hinge
    if lid:
        q.box((x, y + 0.15, z + r * 0.15), (r * 0.7, 0.025, 0.03), 'steel')                                   # grab handle bar
        for sx in (-1, 1): q.box((x + sx * r * 0.33, y + 0.13, z + r * 0.15), (0.025, 0.04, 0.03), 'steel')
    else:
        q.lathe([(r * 0.95, 0.0), (r * 0.95, -0.12)], (x, y + 0.08, z), (0, 1, 0), sg, 'dark', loop=False, caps=False)
    if scopes and r >= 0.2:
        for a_ in (-0.75, 0.0, 0.75):                                                                         # periscopes in the ring
            q.box((x + (r * 1.08) * math.sin(a_), y + 0.075, z + (r * 1.08) * math.cos(a_) * 0.95), (0.1, 0.05, 0.06), 'olive', 0.0)
            q.box((x + (r * 1.12) * math.sin(a_), y + 0.085, z + (r * 1.12) * math.cos(a_) * 0.95), (0.075, 0.03, 0.02), 'dark')

def wheel(q, s, xface, y, z, r, w, segs=8, hub='steel', rim='rubber'):
    """a road wheel / idler / sprocket whose outer face is at x = xface, s = +1 / -1: the outside. Rubber tyre with rounded shoulders, a dished
    steel disc with a bolt circle and a domed hub cap"""
    segs = max(segs, 16)
    q.lathe([(0, 0.06), (0.3 * r, 0.03), (0.6 * r, -0.025), (0.78 * r, 0.015), (0.93 * r, 0.0), (r, -0.05), (r, -w), (0.8 * r, -w)],
            (xface, y, z), (s, 0, 0), segs, rim, split=(0.8 * r, hub), caps=False)
    if r > 0.3 and BEVSEG[0] > 1:
        for k in range(6):
            a_ = 2 * math.pi * k / 6
            q.box((xface + s * 0.03, y + 0.5 * r * math.sin(a_), z + 0.5 * r * math.cos(a_)), (0.03, 0.035, 0.035), 'bright')

# ---------------------------------------------------------------- tracks (own mesh, own UVs, material "track")
def hull2d(pts):
    pts = sorted(set(pts)); cr = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo = []
    for p in pts:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 1e-9: lo.pop()
        lo.append(p)
    up = []
    for p in reversed(pts):
        while len(up) >= 2 and cr(up[-2], up[-1], p) <= 1e-9: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]            # counter-clockwise
def inset(poly, d):
    n = len(poly); out = []
    for i in range(n):
        p0, p1, p2 = poly[i - 1], poly[i], poly[(i + 1) % n]
        def nrm(a, b):
            dz, dy = b[0] - a[0], b[1] - a[1]; l = math.hypot(dz, dy); return (-dy / l, dz / l)
        n1, n2 = nrm(p0, p1), nrm(p1, p2); k = d / (1 + n1[0] * n2[0] + n1[1] * n2[1])
        out.append((p1[0] + (n1[0] + n2[0]) * k, p1[1] + (n1[1] + n2[1]) * k))
    return out
def track_run(bm, uvl, s, xa, xb, loop_pts, bt):
    """one closed track run: outer outline (z, y) -> a belt of thickness bt between x = s*xa and s*xb. u = distance x 0.55, v across"""
    O = loop_pts; I = inset(O, bt); n = len(O)
    def cum(P):
        c = [0.0]
        for i in range(n): c.append(c[-1] + math.hypot(P[(i + 1) % n][0] - P[i][0], P[(i + 1) % n][1] - P[i][1]))
        return c
    co, ci = cum(O), cum(I)
    V = lambda p, x: bm.verts.new(B(s * x, p[1], p[0]))
    Oa = [V(p, xa) for p in O]; Ob = [V(p, xb) for p in O]; Ia = [V(p, xa) for p in I]; Ib = [V(p, xb) for p in I]
    def quad(vs, uvs):
        f = bm.faces.new(vs)
        for lp, uv in zip(f.loops, uvs): lp[uvl].uv = uv
    K = 0.55
    for i in range(n):
        j = (i + 1) % n
        quad((Oa[i], Oa[j], Ob[j], Ob[i]), [(co[i] * K, 0), (co[i + 1] * K, 0), (co[i + 1] * K, 1), (co[i] * K, 1)])
        quad((Ia[i], Ib[i], Ib[j], Ia[j]), [(ci[i] * K, 0), (ci[i] * K, 1), (ci[i + 1] * K, 1), (ci[i + 1] * K, 0)])
        quad((Oa[i], Ia[i], Ia[j], Oa[j]), [(co[i] * K, 0), (ci[i] * K, 1), (ci[i + 1] * K, 1), (co[i + 1] * K, 0)])
        quad((Ob[i], Ob[j], Ib[j], Ib[i]), [(co[i] * K, 0), (co[i + 1] * K, 0), (ci[i + 1] * K, 1), (ci[i] * K, 1)])
def resample(poly, step):
    """a closed polyline (z, y) resampled to points about `step` apart (the track-link pitch)"""
    n = len(poly); cum = [0.0]
    for i in range(n): cum.append(cum[-1] + math.hypot(poly[(i + 1) % n][0] - poly[i][0], poly[(i + 1) % n][1] - poly[i][1]))
    m = max(8, round(cum[-1] / step)); out = []; j = 0
    for k in range(m):
        d = cum[-1] * k / m
        while cum[j + 1] < d: j += 1
        t = (d - cum[j]) / max(cum[j + 1] - cum[j], 1e-9); a, b = poly[j], poly[(j + 1) % n]
        out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return out
def track_links(bm, uvl, s, xa, xb, O, bt):
    """individual track links on the outside of the run: a plate with a gap to the next one and a cleat across it"""
    n = len(O); W = abs(xb - xa)
    for i in range(n):
        a, b = O[i], O[(i + 1) % n]; dz, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dz, dy)
        if L < 1e-6: continue
        dz /= L; dy /= L; nz_, ny_ = dy, -dz; cz, cy = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        xv = Vector((1, 0, 0)); tv = Vector((0, -dz, dy)); nv = Vector((0, -nz_, ny_))
        for (lw, th, off, nlen) in ((W * 0.96, 0.05, 0.0, 0.84), (W * 0.9, 0.03, 0.034, 0.22))[:1 + CLEAT[0]]:
            M = Matrix(((xv.x * lw, tv.x * L * nlen, nv.x * th, 0), (xv.y * lw, tv.y * L * nlen, nv.y * th, 0), (xv.z * lw, tv.z * L * nlen, nv.z * th, 0), (0, 0, 0, 1)))
            M.translation = B((xa + xb) / 2, cy + ny_ * (off + 0.005), cz + nz_ * (off + 0.005))
            b0 = set(bm.faces); bmesh.ops.create_cube(bm, size=1.0, matrix=M)
            for f in set(bm.faces) - b0:
                for lp in f.loops: lp[uvl].uv = (lp.vert.co.x * 0.4, lp.vert.co.z * 0.4)
def tyre(bm, uvl, xc, y, z, r_out, r_in, w, segs=14):
    prof = [(r_in + 0.02, -w / 2), (r_out - 0.07, -w / 2), (r_out, -w / 2 + 0.09), (r_out, w / 2 - 0.09), (r_out - 0.07, w / 2)]
    tot = sum(math.hypot(prof[i + 1][0] - prof[i][0], prof[i + 1][1] - prof[i][1]) for i in range(len(prof) - 1)); cv = [0.0]
    for i in range(len(prof) - 1): cv.append(cv[-1] + math.hypot(prof[i + 1][0] - prof[i][0], prof[i + 1][1] - prof[i][1]) / tot)
    for p in range(len(prof) - 1):
        for i in range(segs):
            vs = []; uvs = []
            for (a, t) in ((p, i), (p, i + 1), (p + 1, i + 1), (p + 1, i)):
                th = 2 * math.pi * t / segs; rr, xo_ = prof[a]
                vs.append(bm.verts.new(B(xc + xo_, y + rr * math.cos(th), z + rr * math.sin(th)))); uvs.append((t / segs * 2 * math.pi * r_out * 0.55, cv[a]))
            f = bm.faces.new(vs)
            for lp, uv in zip(f.loops, uvs): lp[uvl].uv = uv

# ---------------------------------------------------------------- the vehicle
class Gen:
    def __init__(g, v, wseg=12, lite=0):
        g.wseg = wseg; g.lite = lite; g.v = v; m = v['m']; g.m = m; g.id = v['id']
        g.hw, g.hh, g.hl = m['hull']; g.tw, g.th, g.tl = m['tur']; g.tz = m['tz']; g.gl, g.gr, g.gn = m['gun']; g.ty = m['ty']
        g.fl = set(m['f'].split()); g.wl = 'wl' in g.fl
        g.trw = 0.62 if g.wl else max(0.55, g.hw * 0.2); g.y0 = 1.0 if g.wl else 0.62; g.top = g.y0 + g.hh
        g.xs = g.hw / 2; g.xo = g.xs + g.trw; g.zf = g.hl / 2; g.zr = -g.hl / 2
        g.TP = Vector(v['turretPivot']); g.GP = g.TP + Vector(v['gunPivot'])
        g.k = Kit(1); g.body = Q(g.k, (0, 0, 0), 'gun'); g.tur = Q(g.k, g.TP, 'mag'); g.gun = Q(g.k, g.GP, 'bolt')
        g.kb = Q(g.k, (0, 0, 0), 'trigger'); g.kt = Q(g.k, g.TP, 'pump')
        g.track_bm = bmesh.new(); g.uvl = g.track_bm.loops.layers.uv.new('UVMap')
        # the glacis: from the top edge (top, zf - gl) down to the nose (y_n, zf)
        g.y_n = max(0.62, g.top - g.hh * 0.78) if not g.wl else 1.15
        g.gl_ = (g.top - g.y_n) * (0.55 if not g.wl else 0.8)
    def glacis(g, u, off=0.0):
        """(y, z, slope degrees) on the glacis: u 0 at the top edge, 1 at the nose, off along the surface normal"""
        y = g.top + (g.y_n - g.top) * u; z = g.zf - g.gl_ + g.gl_ * u
        a = math.atan2(g.top - g.y_n, g.gl_); return y + off * math.cos(a), z + off * math.sin(a), math.degrees(a)

    # ------------------------------------------------ tracked running gear + hull
    def tracked(g):
        b = g.body; bt = 0.09; tb = g.v['track']; z0, z1, ytop = tb[2] + 0.01, tb[5] - 0.01, min(tb[4], 1.12)
        rs, ri = 0.42, 0.40; zS = z0 + bt + rs; zI = z1 - bt - ri; yS = ytop - bt - rs; yI = ytop - bt - ri
        n = g.m.get('wh') or round(g.hl / 1.1); rw0 = min(max(g.hh * 0.4, 0.36), 0.55)
        za = zS + rs + rw0 * 0.55; zb = zI - ri - rw0 * 0.55; zs = [za + (zb - za) * i / max(1, n - 1) for i in range(n)]
        sp = (zb - za) / max(1, n - 1); inter = 2 * rw0 > sp * 0.97; rw = rw0 if inter else min(rw0, sp * 0.5)
        ww = (g.trw - 0.1) * (0.5 if inter else 0.78)
        circles = [(zS, yS, rs + bt), (zI, yI, ri + bt)] + [(z, bt + rw, rw + bt) for z in zs]
        pts = []
        for (cz, cy, r) in circles:
            for i in range(16): a = 2 * math.pi * i / 16; pts.append((round(cz + r * math.cos(a), 6), round(cy + r * math.sin(a), 6)))
        loop = resample(hull2d(pts), PITCH[0]); g.loop_n = len(loop)
        sagA = min(0.14, 0.012 * (zI - zS))                                      # the top run sags between sprocket and idler
        loop = [(p[0], p[1] - sagA * math.sin(math.pi * (p[0] - zS) / (zI - zS))) if (abs(p[1] - ytop) < 1e-3 and zS <= p[0] <= zI) else p for p in loop]
        for s in (-1, 1):
            track_run(g.track_bm, g.uvl, s, g.xs, g.xo, loop, bt)
            track_links(g.track_bm, g.uvl, s, s * g.xs, s * g.xo, loop, bt)
            xf = s * (g.xo - 0.04)
            for i, z in enumerate(zs):
                off = (ww + 0.03) * (i % 2) if inter else 0.0
                wheel(b, s, xf - s * off, bt + rw, z, rw, ww, g.wseg)
            wheel(b, s, xf, yS, zS, rs * 0.96, 0.18, g.wseg, 'steel', 'steel'); wheel(b, s, xf, yI, zI, ri * 0.96, 0.16, g.wseg, 'steel', 'steel')
            if g.lite < 0.5:
                for k in range(16):                                                   # sprocket teeth, and a rim ring on the idler
                    a_ = 2 * math.pi * k / 16
                    b.box((xf, yS + (rs + bt * 0.2) * math.sin(a_), zS + (rs + bt * 0.2) * math.cos(a_)), (0.2, 0.075, 0.075), 'steel', 0.0, rot=(('x', -math.degrees(a_) + 90),))
                b.lathe([(ri * 1.0, 0.0), (ri * 1.0, 0.05), (ri * 0.7, 0.07), (0, 0.07)], (xf, yI, zI), (s, 0, 0), 24, 'steel')
            nr = 3 if 'ret' in g.fl else 2
            for i in range(nr):
                zz = zS + 0.7 + (zI - zS - 1.4) * (i + 0.5) / nr
                b.cyl((xf - s * 0.02, ytop - bt - 0.1, zz), 0.1, 0.0, (s, 0, 0), 8, 'steel') if False else b.lathe([(0.1, 0), (0.1, -0.2)], (xf, ytop - bt - 0.1, zz), (s, 0, 0), 8, 'steel')
        # hull between the tracks: nose, glacis, deck, sloped rear plate
        xs, top, zf, zr, y_n = g.xs, g.top, g.zf, g.zr, g.y_n
        pts = [(xs - 0.25, 0.32, zr + 0.4), (xs - 0.30, 0.32, zf - 0.7), (xs - 0.15, y_n, zf), (xs - 0.02, top, zf - g.gl_), (xs - 0.02, top, zr + 0.55),
               (xs - 0.06, top - 0.14, zr), (xs - 0.02, 0.7, zr), (xs, 0.9, zr + 0.1), (xs, 0.9, zf - 0.35)]
        b.hull(pts, 'olive', 0.012, mirror=True)
        # fenders over the tracks with a swept-up front
        for s in (-1, 1):
            xa, xb_ = sorted((s * (xs - 0.05), s * (g.xo + 0.05)))
            b.prism([(1.17, z0 - 0.04), (1.17, z1 - 0.5), (1.3, z1 - 0.02), (1.35, z1 - 0.04), (1.24, z1 - 0.56), (1.24, z0 - 0.04)], xa, xb_, 'olive', 0.008)
        if 'sk' in g.fl: g.skirts(b)
        # engine deck: raised louvre block, dark grille, filler caps
        L = min(1.7, g.hl * 0.28); zc = zr + 0.5 + L / 2
        b.box((0, top + 0.03, zc), (g.hw * 0.72, 0.09, L), 'olive', 0.01); b.box((0, top + 0.08, zc), (g.hw * 0.56, 0.03, L * 0.8), 'dark')
        for i in range(7): b.box((0, top + 0.1, zc - L * 0.42 + i * L * 0.14), (g.hw * 0.58, 0.04, 0.045), 'olive')
        for sx in (-1, 1): b.lathe([(0.1, 0), (0.1, 0.05), (0.06, 0.07), (0, 0.07)], (sx * g.hw * 0.36, top, zr + 0.45), (0, 1, 0), 8, 'steel')
        # driver's hatch and vision block, headlights, tow eyes
        yh, zh, ang = g.glacis(0.0)
        hatch(b, -g.hw * 0.2, top, g.zf - g.gl_ - 0.35, 0.26); b.box((-g.hw * 0.2, top + 0.12, g.zf - g.gl_ - 0.05), (0.3, 0.07, 0.05), 'dark')
        hatch(b, g.hw * 0.2, top, g.zf - g.gl_ - 0.35, 0.22, lid=False)
        for s in (-1, 1):
            b.box((s * (g.xo - 0.35), 1.31, z1 - 0.35), (0.2, 0.17, 0.2), 'steel', 0.01); b.box((s * (g.xo - 0.35), 1.31, z1 - 0.46), (0.14, 0.12, 0.03), 'bright')
            b.box((s * g.hw * 0.3, y_n - 0.03, zf + 0.04), (0.16, 0.14, 0.2), 'steel', 0.01)
            if g.lite < 1:
                b.lathe([(0.1, 0), (0.1, 0.08), (0.075, 0.09), (0.0, 0.09)], (s * (g.xo - 0.35), 1.31, z1 - 0.58), (0, 0, 1), 16, 'steel')                  # headlight with a guard
                for dx in (-0.08, 0.0, 0.08): b.box((s * (g.xo - 0.35) + dx, 1.31, z1 - 0.6), (0.014, 0.2, 0.014), 'steel')
            b.box((s * g.hw * 0.33, g.y0 + 0.2, zr - 0.04), (0.16, 0.14, 0.18), 'steel', 0.01)            # rear tow eyes
        # spare track links on the glacis, tools on the left fender, fuel cans on the rear deck
        for i in range(5):
            y_, z_, a_ = g.glacis(0.28, 0.04); b.box((-g.hw * 0.3 + i * 0.28, y_, z_), (0.25, 0.04, 0.2), 'steel', 0.0, rot=(('x', a_),)) if g.hh > 0.8 and g.lite < 1 else None
        if g.lite < 1:
            b.box((g.xo - 0.3, 1.27, zr + 1.1), (0.14, 0.03, 0.4), 'wood'); b.box((g.xo - 0.3, 1.285, zr + 1.45), (0.2, 0.025, 0.24), 'steel')
            b.box((g.xo - 0.52, 1.27, zr + 1.2), (0.05, 0.04, 0.9), 'steel')
        for sx in (-1, 1) if g.lite < 1 and g.hh >= 1.0 else (): b.lathe([(0.12, 0), (0.12, 0.4)], (sx * g.hw * 0.28, top + 0.12, zr + 0.45 + L + 0.3), (0, 0, 1), 8, 'steel')
        if 'exh' in g.fl:
            for sx in (-1, 1):
                b.box((sx * g.hw * 0.3, top - g.hh * 0.28, zr - 0.05), (0.28, 0.26, 0.34), 'steel', 0.01)
                b.lathe([(0.075, 0), (0.075, -0.25), (0.055, -0.25), (0.055, 0)], (sx * g.hw * 0.3, top - g.hh * 0.28, zr - 0.1), (0, 0, 1), 16, 'steel', loop=True)
                b.lathe([(0.13, 0.0), (0.13, -0.3)], (sx * g.hw * 0.3, top - g.hh * 0.28, zr - 0.06), (0, 0, 1), 16, 'steel', loop=False, caps=False)         # heat shield
                for kk in range(3): b.lathe([(0.135, 0), (0.135, 0.02)], (sx * g.hw * 0.3, top - g.hh * 0.28, zr - 0.1 - kk * 0.1), (0, 0, 1), 16, 'dark', caps=False)
        if 'spade' in g.fl:
            b.box((0, 0.55, zr - 0.45), (g.hw * 0.86, 0.85, 0.1), 'olive', 0.015, rot=(('x', 30),)); b.box((0, 0.9, zr - 0.64), (g.hw * 0.86, 0.1, 0.16), 'steel', 0.01)
            for sx in (-1, 1): b.box((sx * g.hw * 0.4, 0.62, zr - 0.2), (0.12, 0.12, 0.6), 'steel', 0.01, rot=(('x', 25),))
        if 'era' in g.fl: g.era(b)
        for i, s in enumerate((-1, 1)): pass
    def details_hull(g):
        b = g.body; top = g.top; zr = g.zr; zf = g.zf; hw = g.hw
        if g.lite >= 1: return
        if not g.wl and g.hh > 0.8:                                   # tow cable looped over the glacis between two hooks
            pts = []
            for k in range(15):
                t = k / 14.0; x_ = -hw * 0.34 + t * hw * 0.68; u_ = 0.5 + 0.3 * math.sin(math.pi * t) ** 0.8
                y_, z_, a_ = g.glacis(u_, 0.045); pts.append(B(x_, y_, z_))
            g.k.sweep(pts, 0.03, 6, 'steel', 'gun', True)
            for sx in (-1, 1): b.box((sx * hw * 0.34, g.glacis(0.5, 0.03)[0], g.glacis(0.5, 0.03)[1]), (0.07, 0.07, 0.07), 'steel')
        if not g.wl:                                                  # stowage: a box and a rolled tarpaulin on the right fender, a jerry can on the rear deck
            xo = g.xo; zz = zr + 1.5
            b.box((-(xo - 0.35), 1.17 + 0.22, zz), (0.5, 0.4, 0.8), 'olive', 0.015); b.box((-(xo - 0.35), 1.17 + 0.44, zz), (0.46, 0.03, 0.76), 'steel')
            b.lathe([(0.15, 0), (0.15, 0.95)], (-(xo - 0.38), 1.17 + 0.16, zz + 1.2), (0, 0, 1), 12, 'tan')
            b.lathe([(0.153, 0.2), (0.153, 0.24)], (-(xo - 0.38), 1.17 + 0.16, zz + 1.2), (0, 0, 1), 12, 'rubber', caps=False)
            b.lathe([(0.153, 0.65), (0.153, 0.69)], (-(xo - 0.38), 1.17 + 0.16, zz + 1.2), (0, 0, 1), 12, 'rubber', caps=False)
    def skirts(g, q, grp_kit=False):
        tb = g.v['track']; zz0, zz1 = tb[2] + 0.45, tb[5] - 0.45; n = 5; gap = 0.04; ln = (zz1 - zz0 - gap * (n - 1)) / n
        for s in (-1, 1):
            for i in range(n):
                zc = zz0 + ln / 2 + i * (ln + gap); q.box((s * (g.xo + 0.05), 0.87, zc), (0.06, 0.62, ln), 'olive', 0.0 if grp_kit or g.lite else 0.008)
            if not grp_kit and not g.lite: q.box((s * (g.xo + 0.085), 1.12, zc), (0.03, 0.05, ln * 0.96), 'steel')
    def era(g, q):
        for i in range(4):
            for j in range(2):
                y_, z_, a_ = g.glacis(0.18 + j * 0.34, 0.06)
                q.box(((i - 1.5) * g.hw * 0.24, y_, z_), (g.hw * 0.2, 0.1, 0.3), 'olive', 0.012, rot=(('x', a_),))

    # ------------------------------------------------ wheeled running gear + hull (the 8x8)
    def wheeled(g):
        b = g.body; n = g.m.get('wh') or 4; xs = g.xs; top = g.top; hl = g.hl
        ws = [-hl * 0.36 + i * hl * 0.72 / (n - 1) for i in range(n)]
        for s in (-1, 1):
            xc = s * (xs + 0.2)
            for z in ws:
                tyre(g.track_bm, g.uvl, xc, 0.62, z, 0.62, 0.36, 0.5)
                wheel(b, s, xc + s * 0.25 + s * 0.0, 0.62, z, 0.4, 0.3, 10, 'steel', 'steel')
                b.lathe([(0, 0.0), (0.12, 0), (0.12, 0.05), (0, 0.06)], (xc + s * 0.25, 0.62, z), (s, 0, 0), 8, 'dark')
                b.box((s * (xs - 0.05), 0.62, z), (0.5, 0.14, 0.2), 'steel', 0.01)                              # axle arm / suspension
                b.box((s * (xs + 0.25), 1.3, z), (0.62, 0.06, 1.0), 'olive', 0.01, rot=(('x', 0),))              # mudguard over the tyre
        zf = g.zf; zr = g.zr + 0.35
        # belly and lower hull, then the upper hull with its sloped sides and glacis
        b.hull([(xs - 0.35, 0.55, zr + 0.3), (xs - 0.35, 0.55, zf - 0.6), (xs - 0.05, 1.35, zf + 0.05), (xs - 0.02, 1.4, zr), (xs - 0.1, 0.8, zr)], 'olive', 0.015, mirror=True)
        yt = g.y_n; gl = g.gl_
        b.hull([(xs - 0.02, 1.3, zr), (xs - 0.02, 1.3, zf + 0.0), (xs - 0.08, 1.45, zf + 0.06), (xs - 0.22, top, zr + 0.3), (xs - 0.22, top, zf - gl), (xs - 0.02, 1.5, zf - 0.2)], 'olive', 0.015, mirror=True)
        # front: sloped glacis plate, lower nose, driver vision, headlights, bumper
        for s in (-1, 1):
            b.box((s * xs * 0.6, 1.05, zf + 0.08), (0.34, 0.3, 0.14), 'steel', 0.01)                      # bumper ends
            b.box((s * (xs - 0.3), 1.35, zf + 0.04), (0.2, 0.17, 0.12), 'bright'); b.box((s * (xs - 0.3), 1.35, zf + 0.0), (0.26, 0.23, 0.08), 'steel', 0.01)
            b.box((s * xs * 0.35, 1.0, zf + 0.14), (0.2, 0.16, 0.2), 'steel', 0.01)                          # tow eyes
            b.box((s * (xs - 0.15), 1.88, zf - gl * 0.5 - 0.4), (0.1, 0.34, 0.5), 'dark')                  # side window slit
        b.box((0, top - 0.25, zf - gl * 0.45 + 0.02), (xs * 1.1, 0.3, 0.06), 'dark', rot=(('x', 40),))     # driver's vision block
        b.box((0, 1.0, zf + 0.12), (xs * 1.5, 0.14, 0.12), 'steel', 0.012)
        b.box((0, top + 0.03, g.zr + 1.4), (xs * 1.4, 0.07, 1.6), 'olive', 0.01); b.box((0, top + 0.07, g.zr + 1.4), (xs * 1.1, 0.03, 1.2), 'dark')    # engine deck grille
        hatch(b, -xs * 0.5, top, g.zf - gl - 0.5, 0.26); hatch(b, xs * 0.5, top, g.zf - gl - 0.5, 0.22, lid=False)
        for s in (-1, 1):
            b.box((s * (xs - 0.1), 1.62, 0.0), (0.07, 0.45, 1.6), 'olive', 0.01)                          # side door panel plate
            b.box((s * (xs - 0.1), 0.9, zr - 0.02), (0.3, 0.2, 0.12), 'steel', 0.01)                         # rear tow
        b.box((0, top - 0.5, zr - 0.04), (xs * 1.2, 0.5, 0.1), 'olive', 0.01)

    # ------------------------------------------------ turrets
    def turret(g):
        t = g.tur; tw, th, tl, ty, fl = g.tw, g.th, g.tl, g.ty, g.fl
        front = tl * 0.3 if ty == 'cas' else tl * 0.5
        if ty == 'box':
            t.hull([(tw / 2, -0.02, tl / 2), (tw / 2, -0.02, -tl / 2), (tw / 2, th * 0.55, tl / 2 - th * 0.1), (tw / 2, th * 0.55, -tl / 2 + th * 0.05),
                    (tw / 2 * 0.86, th, tl / 2 - th * 0.45), (tw / 2 * 0.86, th, -tl / 2 + th * 0.15)], 'olive', 0.014, mirror=True)
            t.hull([(tw * 0.42, 0.02, -tl * 0.35), (tw * 0.42, 0.02, -tl * 0.81), (tw * 0.4, th * 0.92, -tl * 0.76), (tw * 0.4, th * 0.92, -tl * 0.35)], 'olive', 0.014, mirror=True)
            rear = -tl * 0.81
        elif ty == 'cast':
            t.lathe([(0, th * 1.05), (tw * 0.2, th * 1.0), (tw * 0.38, th * 0.8), (tw * 0.5, th * 0.5), (tw * 0.52, th * 0.2), (tw * 0.52, -0.02), (0, -0.02)], (0, 0, tl * 0.08),
                    (0, 1, 0), 32, 'olive', sc=(1, tl * 0.56 / (tw * 0.52)))
            t.hull([(tw * 0.35, 0.02, -tl * 0.3), (tw * 0.35, 0.02, -tl * 0.55), (tw * 0.3, th * 0.6, -tl * 0.5), (tw * 0.3, th * 0.6, -tl * 0.3)], 'olive', 0.012, mirror=True)
            t.box((0, th * 0.1, tl * 0.08 - tl * 0.56 * 0.98), (tw * 0.5, th * 0.2, 0.06), 'olive')
            rear = -tl * 0.55
        elif ty == 'wedge':
            tt = tw / 2
            bot = [(tt, -0.02, -tl * 0.46), (tt, -0.02, tl * 0.02), (tt * 0.34, -0.02, tl * 0.62)]
            tp_ = [(tt * 0.9, th, -tl * 0.44), (tt * 0.9, th, -tl * 0.04), (tt * 0.3, th * 0.86, tl * 0.5)]
            t.hull(bot + tp_ + [(tt * 0.96, th * 0.5, -tl * 0.45), (tt * 0.96, th * 0.5, tl * 0.02)], 'olive', 0.012, mirror=True)
            if 'ml' not in fl:
                for s in (-1, 1): t.hull([(s * (tt + 0.18), 0.12, -tl * 0.5), (s * (tt + 0.18), 0.12, 0.0), (s * (tt + 0.18), th * 0.8, 0.0), (s * (tt + 0.18), th * 0.8, -tl * 0.5), (s * tt * 0.95, 0.12, -tl * 0.5), (s * tt * 0.95, th * 0.8, -tl * 0.5)], 'olive', 0.01)
            rear = -tl * 0.46
        elif ty == 'arty':
            t.hull([(tw / 2, -0.02, tl / 2), (tw / 2, -0.02, -tl / 2), (tw / 2, th * 0.7, tl / 2 - th * 0.12), (tw / 2, th * 0.7, -tl / 2),
                    (tw / 2 * 0.92, th, tl / 2 - th * 0.3), (tw / 2 * 0.92, th, -tl / 2)], 'olive', 0.014, mirror=True)
            t.box((0, th * 0.42, -tl / 2 - 0.03), (tw * 0.55, th * 0.55, 0.08), 'dark')                      # ammunition door in the rear
            for s in (-1, 1): t.box((s * (tw / 2 + 0.06), th * 0.5, -tl * 0.1), (0.12, th * 0.5, tl * 0.5), 'olive', 0.01)
            rear = -tl / 2
        elif ty == 'cas':
            Wb = g.xs + g.trw * 0.8; thc = max(0.5, th * 0.9); g.thc = thc; zfb = g.tz + tl / 2; zrb = g.tz - tl / 2
            zft = max(zfb - thc * 1.9, zrb + 1.0); base = g.top - 0.02
            g.body.hull([(Wb, base, zfb), (Wb, base, zrb), (Wb * 0.87, base + thc, zft), (Wb * 0.87, base + thc, zrb + th * 0.25), (Wb * 0.95, base + thc * 0.5, zfb - 0.3), (Wb * 0.95, base + thc * 0.5, zrb)], 'olive', 0.015, mirror=True)
            # the gun mount: a cast mantlet block that shows on the sloped front face, its heavy body reaching back inside the casemate
            tb_ = g.v['turret']; zmin, zmax = tb_[2] + 0.03, tb_[5] - 0.12; y0_, y1_ = -0.02, min(tb_[4] - 0.05, thc - 0.006); hb, hf = tw * 0.41, tw * 0.3; zm = zmax - 0.7
            t.hull([(hb, y0_, zmin), (hb, y1_, zmin), (hb, y0_, zm), (hb, y1_, zm), (hf, y0_, zmax), (hf, y1_ - 0.05, zmax)], 'olive', 0.015, mirror=True)
            t.box((0, y1_ * 0.5 + 0.02, zmax + 0.01), (hf * 2.0, y1_ * 0.5, 0.06), 'steel', 0.01)
            rear = zmin
        elif ty == 'aa':
            t.lathe([(tw * 0.52, 0), (tw * 0.52, 0.3)], (0, 0, 0), (0, 1, 0), 14, 'olive')
            h_ = th
            for s in (-1, 1): t.box((s * (tw / 2 - 0.04), 0.2 + h_ / 2, 0), (0.08, h_, tl * 0.9), 'olive', 0.012); t.box((s * (tw / 2 - 0.04), 0.2 + h_ + 0.02, 0), (0.12, 0.04, tl * 0.9), 'steel')
            t.box((0, 0.2 + h_ * 0.4, -tl / 2 + 0.04), (tw * 0.96, h_ * 0.8, 0.08), 'olive', 0.012)
            t.box((0, 0.2 + h_ * 0.25, tl / 2 - 0.05), (tw * 0.96, h_ * 0.5, 0.08), 'olive', 0.012, rot=(('x', 17),))
            t.box((0, 0.32, -tl * 0.3), (0.5, 0.1, 0.4), 'dark'); t.box((0.55, 0.42, -tl * 0.2), (0.4, 0.3, 0.5), 'steel', 0.01); t.box((-0.55, 0.42, -tl * 0.2), (0.4, 0.3, 0.5), 'steel', 0.01)
            if 'rad' in fl:
                t.cyl((0, th + 0.2, -tl * 0.45), 0.05, 1.1, (0, 1, 0), 6, 'steel')
                t.lathe([(0.75, 0), (0.5, 0.1), (0.0, 0.2)], (0, th + 1.35, -tl * 0.45), (0, 0.3, 1), 14, 'olive')
            rear = -tl / 2
        elif ty == 'ml':
            t.lathe([(tw * 0.5, 0), (tw * 0.5, 0.4)], (0, 0, 0), (0, 1, 0), 12, 'olive')
            t.hull([(tw * 0.4, 0.2, tl * 0.3), (tw * 0.4, 0.2, -tl * 0.5), (tw * 0.4, th + 0.2, -tl * 0.4), (tw * 0.34, th + 0.2, tl * 0.1)], 'olive', 0.012, mirror=True)
            rear = -tl * 0.5
        # ---- fittings
        def surf(x_, z_):
            """height of the cast dome above (x, z)"""
            if ty != 'cast': return topy
            k_ = tl * 0.56 / (tw * 0.52); rr = math.hypot(x_, (z_ - tl * 0.08) / k_)
            P_ = [(0, th * 1.05), (tw * 0.2, th), (tw * 0.38, th * 0.8), (tw * 0.5, th * 0.5), (tw * 0.52, th * 0.2)]
            for i in range(len(P_) - 1):
                if rr <= P_[i + 1][0]: return P_[i][1] + (P_[i + 1][1] - P_[i][1]) * (rr - P_[i][0]) / max(P_[i + 1][0] - P_[i][0], 1e-6)
            return th * 0.2
        topy = th if ty not in ('aa', 'ml', 'cas') else (th * 0.95 if ty == 'cas' else th + 0.2)
        if ty == 'cas': topy = g.thc
        if 'cup' in fl and ty != 'aa':
            cx_, cz_ = tw * 0.22, -tl * 0.12
            cy_ = surf(cx_, cz_) - 0.1 if ty == 'cast' else topy - 0.04
            t.lathe([(0.4, -0.12), (0.35, 0.22), (0.3, 0.3), (0.2, 0.31), (0, 0.31)], (cx_, cy_, cz_), (0, 1, 0), 16, 'olive')
            for a_ in range(8): t.box((cx_ + 0.33 * math.cos(a_ * 0.785), cy_ + 0.24, cz_ + 0.33 * math.sin(a_ * 0.785)), (0.09, 0.06, 0.09), 'dark', 0.0)
            tpc = cy_ + 0.04
            t.box((cx_ + 0.1, tpc + 0.5, cz_ - 0.05), (0.07, 0.09, 0.2), 'steel')            # cupola MG: receiver, barrel with jacket, pintle
            t.lathe([(0.026, 0.0), (0.026, 0.55), (0.018, 0.56)], (cx_ + 0.1, tpc + 0.5, cz_ + 0.05), (0, 0, 1), 10, 'dark')
            t.lathe([(0.04, 0.02), (0.04, 0.2)], (cx_ + 0.1, tpc + 0.5, cz_ + 0.05), (0, 0, 1), 10, 'steel')
            t.lathe([(0.03, 0), (0.03, 0.2)], (cx_ + 0.1, tpc + 0.3, cz_ - 0.05), (0, 1, 0), 8, 'steel')
            hatch(t, -tw * 0.22, surf(-tw * 0.22, -tl * 0.18) - 0.04, -tl * 0.18, 0.24)
        elif ty in ('box', 'wedge', 'arty', 'cast') or ty == 'cas':
            hatch(t, tw * 0.2 if ty != 'cas' else 0.5, topy - (0.04 if ty != 'cast' else 0.25), -tl * 0.15 if ty != 'cas' else -0.6, 0.24)
            hatch(t, -tw * 0.2 if ty != 'cas' else -0.5, topy - (0.04 if ty != 'cast' else 0.25), -tl * 0.2 if ty != 'cas' else -0.6, 0.2, lid=False)
        if ty == 'cas':
            for s in (-1, 1): t.box((s * 0.9, topy + 0.02, 0.35), (0.3, 0.06, 0.25), 'dark')
        if ty not in ('aa', 'cas'):
            for s in (-1, 1): t.box((s * tw * 0.28, th * 0.8, tl * 0.5 - 0.05 if ty != 'wedge' else tl * 0.15), (0.16, 0.1, 0.1), 'dark')     # sights
        if 'ant' in fl:
            ax_, az_ = -tw * 0.34, -tl * 0.38 if ty != 'cas' else -0.8
            t.box((ax_, topy + 0.05, az_), (0.14, 0.1, 0.14), 'steel'); t.lathe([(0.028, 0), (0.012, max(0.8, min(2.35, g.v['turret'][4] - 0.05 - (topy + 0.1))))], (ax_, topy + 0.1, az_), (0, 1, 0), 5, 'steel')
        if 'bins' in fl and ty not in ('aa', 'arty'):
            bz = rear - 0.17 if ty != 'wedge' else -tl * 0.84
            if ty == 'wedge':
                for s in (-1, 1): t.box((s * tw * 0.3, th * 0.5, (rear + bz) / 2), (0.08, 0.08, rear - bz + 0.3), 'steel')
            t.box((0, th * 0.5, bz), (tw * 0.8, th * 0.45, 0.3), 'tan', 0.01); t.box((0, th * 0.74, bz), (tw * 0.82, 0.03, 0.32), 'wood')
            for s in (-1, 1): t.box((s * tw * 0.3, th * 0.5, bz - 0.17), (0.05, th * 0.47, 0.04), 'rubber')
        if 'ml' in fl and ty != 'ml':
            for s in (-1, 1):
                xc = s * (tw / 2 + 0.22)
                t.box((xc, th * 0.65, -tl * 0.05), (0.3, 0.3, 1.45), 'olive', 0.02)
                for dy in (-0.075, 0.075): t.lathe([(0.06, 0), (0.06, 0.03)], (xc, th * 0.65 + dy, -tl * 0.05 + 0.72), (0, 0, 1), 6, 'dark')
                t.box((xc, th * 0.65, -tl * 0.05 - 0.72), (0.24, 0.24, 0.05), 'dark'); t.box((s * (tw / 2 + 0.06), th * 0.55, -tl * 0.05), (0.14, 0.12, 0.5), 'steel')
        if ty not in ('aa', 'arty', 'ml'):
            for s in (-1, 1):                       # smoke dischargers
                x_ = s * (tw * 0.45 + 0.04) if ty != 'cas' else s * 1.2
                zc_ = tl * 0.15 if ty != 'cas' else 0.3
                yb_ = th * 0.55 if ty != 'cas' else g.thc - 0.2
                if ty == 'wedge' or ty == 'cast': x_ = s * (tw * (0.5 if ty == 'cast' else 0.46))
                t.box((x_, yb_ + 0.1, zc_), (0.12, 0.3, 0.2), 'steel', 0.0)
                for i in range(3 if g.lite < 1 else 1): t.lathe([(0.04, 0), (0.04, 0.05)], (x_ + s * 0.03, yb_ + 0.0 + i * 0.1, zc_ + 0.1), (0, 0, 1), 5, 'dark')

    # ------------------------------------------------ gun
    def make_gun(g):
        q = g.gun; v = g.v; tw, th, ty, fl, gr, gl = g.tw, g.th, g.ty, g.fl, g.gr, g.gl
        mz = v['muzzle'][2]; tip = max(mz - 0.1, min(mz - 0.02, v['gun'][5] + 0.15))
        if ty == 'aa':
            q.box((0, 0, 0), (tw * 0.42, th * 0.9, 0.8), 'olive', 0.015); q.box((0, 0, -0.38), (tw * 0.3, th * 0.7, 0.1), 'steel', 0.01)
            for s in (-1, 1): q.box((s * tw * 0.23, 0, 0), (0.14, th * 0.9, 0.5), 'steel', 0.01)
            for i in range(g.gn):
                ox = (i % 2 * 2 - 1) * (tw * 0.28 + (i // 2) * 0.22); oy = (i // 2) * 0.22 - 0.0
                q.lathe([(gr * 1.7, 0.0), (gr * 1.7, 0.7), (gr * 1.0, 0.76), (gr * 0.95, tip - 0.4), (gr * 1.3, tip - 0.38), (gr * 1.3, tip - 0.22), (gr * 0.6, tip - 0.2), (gr * 0.6, tip)], (ox, oy, -0.35), (0, 0, 1), 8, 'olive') if False else None
                q.lathe([(gr * 1.7, -0.35), (gr * 1.7, 0.35), (gr * 1.0, 0.42), (gr * 0.95, tip - 0.45), (gr * 1.35, tip - 0.43), (gr * 1.35, tip - 0.2), (gr * 0.6, tip - 0.18), (gr * 0.6, tip)], (ox, oy, 0), (0, 0, 1), 8, 'olive')
                q.lathe([(gr * 0.35, tip - 0.002), (0, tip - 0.002)], (ox, oy, 0), (0, 0, 1), 6, 'dark', caps=False) if False else q.lathe([(0, 0.0), (gr * 0.45, 0.0)], (ox, oy, tip + 0.003), (0, 0, 1), 6, 'dark', caps=False)
                q.box((ox + (1 if ox > 0 else -1) * (gr * 2.4), oy - 0.02, 0.05), (0.1, 0.22, 0.5), 'steel', 0.01)              # feed chute
            return
        if ty == 'ml':
            for s in (-1, 1):
                for kk in (0, 1): q.box((s * 0.3, 0.25 + kk * 0.44, 0.3), (0.42, 0.42, 1.8), 'olive', 0.02); q.lathe([(0.14, 0), (0.14, 0.03)], (s * 0.3, 0.25 + kk * 0.44, 1.2), (0, 0, 1), 8, 'dark')
            q.box((0, 0.01, 0.3), (0.9, 0.05, 1.2), 'steel', 0.0)
            return
        # mantlet
        w_, h_ = tw * 0.46, th * 0.56
        if ty == 'cast':
            q.lathe([(0, tw * 0.0 + th * 0.38), (tw * 0.12, th * 0.34), (tw * 0.21, th * 0.15), (tw * 0.22, 0), (tw * 0.21, -th * 0.15), (tw * 0.12, -th * 0.34), (0, -th * 0.38)], (0, 0, 0.05), (0, 1, 0), 24, 'olive', sc=(1, 0.5 / (tw * 0.22)))
        else:
            q.hull([(w_ / 2, -h_ / 2, -0.3), (w_ / 2, h_ / 2, -0.3), (w_ / 2, -h_ / 2, 0.12), (w_ / 2, h_ / 2, 0.12), (w_ / 2 * 0.8, -h_ / 2 * 0.85, 0.3), (w_ / 2 * 0.8, h_ / 2 * 0.85, 0.3)], 'olive', 0.012, mirror=True)
            q.box((w_ * 0.36, h_ * 0.18, 0.31), (0.12, 0.1, 0.04), 'dark'); q.box((-w_ * 0.36, 0, 0.3), (0.05, 0.05, 0.2), 'steel')   # sight window, coax MG
            if g.lite < 0.5:
                for kx in (-0.4, 0.0, 0.4):                                                                                                       # mantlet cover bolts
                    for ky in (-0.42, 0.42): q.box((kx * w_, ky * h_, 0.26), (0.04, 0.04, 0.03), 'steel')
                for ky in (-0.2, 0.2):
                    for kx in (-0.46, 0.46): q.box((kx * w_ * 0.98, ky * h_, 0.2), (0.04, 0.04, 0.03), 'steel')
        # barrel(s)
        segs = 24 if gr >= 0.2 else 16; L0 = 0.15; mzf = 'mz' in fl; fume = 'fume' in fl
        bl = min(0.6, max(0.25, gr * 3.2)) if mzf else 0.0
        for i in range(g.gn):
            ox = 0 if g.gn == 1 else (i - 0.5) * gr * 6
            r0 = gr * 1.15; prof = [(r0 * 1.12, L0), (r0 * 1.12, 0.5), (r0, 0.56), (gr * 1.0, 0.56 + (tip - bl - 0.56) * 0.25)]
            if fume:
                z1_ = tip * 0.6; prof += [(gr * 0.97, z1_ - 0.05), (gr * 1.55, z1_ + 0.06), (gr * 1.55, z1_ + tip * 0.13), (gr * 0.95, z1_ + tip * 0.13 + 0.07)]
            prof += [(gr * 0.92, tip - bl)]
            if mzf:
                rb = gr * 1.6; z0_ = tip - bl
                prof += [(rb, z0_ + 0.0), (rb, z0_ + bl * 0.4), (gr * 1.05, z0_ + bl * 0.45), (rb, z0_ + bl * 0.5), (rb, tip), (gr * 0.55, tip)]
            else: prof += [(gr * 1.25, tip - 0.28), (gr * 1.25, tip - 0.02), (gr * 0.6, tip)]
            q.lathe(prof, (ox, 0, 0), (0, 0, 1), segs, 'olive')
            if g.lite < 1:
                q.lathe([(gr * 1.55, 0.12), (gr * 1.55, 0.2), (gr * 1.3, 0.24)], (ox, 0, 0), (0, 0, 1), segs, 'steel')                              # cradle collar
                for fz in (0.45, 0.78): q.lathe([(gr * 1.12, tip * fz - 0.03), (gr * 1.12, tip * fz + 0.03)], (ox, 0, 0), (0, 0, 1), segs, 'steel', caps=False)
            q.lathe([(0, 0), (gr * 0.55, 0)], (ox, 0, tip + 0.004), (0, 0, 1), 16, 'dark', caps=False)
            if mzf:
                for s in (-1, 1): q.box((ox + s * gr * 1.62, 0, tip - bl * 0.25), (0.02, gr * 0.9, bl * 0.2), 'dark')

    # ------------------------------------------------ the upgrade kit
    def kits(g):
        v = g.v; kb = v.get('kitBody'); kt = v.get('kitTurret')
        if kb:
            if not g.wl and 'sk' not in g.fl: g.skirts(g.kb, True)
            y_, z_, a_ = g.glacis(0.5 if not g.wl else 0.5, 0.08)
            wd = g.hw * 0.9; ln = g.hh * 0.6
            g.kb.box((0, y_, z_), (wd, 0.1, ln), 'olive', 0.012, rot=(('x', a_),))
            for s in (-1, 1): g.kb.box((s * wd * 0.3, y_ + 0.05, z_ + 0.03), (0.2, 0.06, ln * 0.7), 'steel', 0.0, rot=(('x', a_),)) if False else None
        if kt:
            cx = (kt[0] + kt[3]) / 2; cy = (kt[1] + kt[4]) / 2; cz = (kt[2] + kt[5]) / 2 - g.TP.z * 0
            g.kt.box((0, cy, cz), ((kt[3] - kt[0]) * 0.96, (kt[4] - kt[1]) * 0.82, 0.14), 'olive', 0.012, rot=(('x', -14),))
            for s in (-1, 1): g.kt.box((s * (kt[3] - kt[0]) * 0.3, cy, cz - 0.08), (0.12, (kt[4] - kt[1]) * 0.6, 0.1), 'steel')
    def build(g):
        if g.wl: g.wheeled()
        else: g.tracked()
        g.details_hull(); g.turret(); g.make_gun(); g.kits()

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
    for wseg, lite, bevs, pitch, cleat, dbev in ((22, 0, 2, .2, 1, 1), (18, 0, 1, .24, 1, 1), (16, 0, 1, .28, 0, 1), (16, 0, 1, .3, 0, 0), (16, 0.5, 1, .3, 0, 0), (16, 1, 1, .3, 0, 0), (16, 2, 1, .32, 0, 0)):
        BEVSEG[0] = bevs; PITCH[0] = pitch; CLEAT[0] = cleat; DEFBEV[0] = dbev; g = Gen(v, wseg, lite); g.build()
        n = sum(len(f.verts) - 2 for f in g.k.bm.faces) + sum(len(f.verts) - 2 for f in g.track_bm.faces)
        log(vid, 'tier', wseg, lite, n)
        if n <= TRI_MAX or lite == 2: break
        g.k.bm.free(); g.track_bm.free()
    log(vid, 'wheel sides', wseg, 'detail', lite)
    col = bpy.data.collections.new('v_' + vid); scene.collection.children.link(col)
    ss_tanks.finish_shading(g.k.bm, 38.0); ss_tanks.finish_shading(g.track_bm, 38.0)
    me = bpy.data.meshes.new(vid + '_all'); g.k.bm.to_mesh(me); g.k.bm.free()
    ob = bpy.data.objects.new(vid + '_all', me); col.objects.link(ob); split_uv(ob, 0.004)
    img = ss_tanks.tank_texture_v2(ob, TEXN, vid + '_tank', ground=True); mat = image_material(vid + '_skin', img, 0.7, 0.3); gmat = gear_material(mat); gmat.name = vid + '_gear'
    gv = np.empty(len(me.vertices), np.int64); me.attributes['grp'].data.foreach_get('value', gv)
    names = {}
    for part, gi in (('body', 'gun'), ('tur', 'mag'), ('gun', 'bolt'), ('kitb', 'trigger'), ('kitt', 'pump')):
        if not (gv == GRP.index(gi)).any(): continue
        b2 = bmesh.new(); b2.from_mesh(me); b2.verts.ensure_lookup_table()
        bmesh.ops.delete(b2, geom=[x for x in b2.verts if gv[x.index] != GRP.index(gi)], context='VERTS')
        pm = bpy.data.meshes.new('%s_%s' % (vid, part)); b2.to_mesh(pm); b2.free(); split_by_class(pm, mat, gmat)
        po = bpy.data.objects.new('%s_%s' % (vid, part), pm); col.objects.link(po); names[part] = po
    bpy.data.objects.remove(ob, do_unlink=True); bpy.data.meshes.remove(me)
    # tracks / tyres
    tm = bpy.data.materials.get('track') or bpy.data.materials.new('track'); tm.use_nodes = True
    tb_ = next(n for n in tm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'); tb_.inputs['Base Color'].default_value = (0.085, 0.082, 0.075, 1); tb_.inputs['Roughness'].default_value = 0.95; tb_.inputs['Metallic'].default_value = 0.0
    bmesh.ops.recalc_face_normals(g.track_bm, faces=g.track_bm.faces[:])
    trm = bpy.data.meshes.new(vid + '_track'); g.track_bm.to_mesh(trm); g.track_bm.free(); trm.materials.append(tm)
    to = bpy.data.objects.new(vid + '_track', trm); col.objects.link(to); names['track'] = to
    order = [p for p in ('body', 'track', 'tur', 'gun', 'kitb', 'kitt') if p in names]
    cfg = {'blend': 'ground.blend', 'out': '../../../Steel Storm Rebuilt/assets/v_' + vid, 'parts': [vid + '_' + p for p in order], 'maxTexture': TEXN}
    with open(os.path.join(REB, 'v_%s.export.json' % vid), 'w') as f: json.dump(cfg, f, indent=1)
    tris = {p: sum(len(f.vertices) - 2 for f in names[p].data.polygons) for p in order}
    log(vid, 'triangles', sum(tris.values()), tris)
    return tris
def image_material_(*a): return image_material(*a)

# ---------------------------------------------------------------- preview
def preview(ids, out, W=1600, H=700, az=38.0, el=27.0, spp=48, spacing=5.2, tint=True, zig=1.7, ortho=0):
    sc = bpy.data.scenes.new('ssx_prev'); sc.render.resolution_x, sc.render.resolution_y = W, H
    try: sc.render.engine = 'CYCLES'
    except TypeError: pass
    sc.cycles.samples = spp; sc.cycles.use_denoising = True
    try: sc.view_settings.view_transform = 'Standard'
    except TypeError: pass
    w = bpy.data.worlds.new('ssx_sky'); w.use_nodes = True; nt = w.node_tree; bg = next(n for n in nt.nodes if n.type == 'BACKGROUND')
    try:
        sk = nt.nodes.new('ShaderNodeTexSky')
        items = [i.identifier for i in sk.bl_rna.properties['sky_type'].enum_items]
        sk.sky_type = 'NISHITA' if 'NISHITA' in items else [i for i in items if 'MULTIPLE' in i or 'SINGLE' in i][0]
        sk.sun_elevation = math.radians(48); sk.sun_rotation = math.radians(210); sk.sun_disc = False
        nt.links.new(sk.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = 0.45
    except Exception as ex:
        log('sky', ex); bg.inputs['Color'].default_value = (0.5, 0.65, 0.9, 1)
    sc.world = w
    ld = bpy.data.lights.new('sun', 'SUN'); ld.energy = 2.4; ld.angle = math.radians(2.5); lo = bpy.data.objects.new('sun', ld); sc.collection.objects.link(lo)
    lo.rotation_euler = (math.radians(48), 0, math.radians(210 - 180 + 0));
    # direction the light travels: down and toward -x/+y; set from a vector
    lo.rotation_euler = Vector((0.55, 0.45, -0.7)).to_track_quat('-Z', 'Y').to_euler()
    gm = bpy.data.materials.new('ssx_ground'); gm.use_nodes = True; next(n for n in gm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'].default_value = (0.42, 0.34, 0.22, 1)
    bpy.ops.mesh.primitive_plane_add(size=300); pl = bpy.context.active_object; pl.data.materials.append(gm)
    for c_ in list(pl.users_collection): c_.objects.unlink(pl)
    sc.collection.objects.link(pl)
    a = math.radians(az); right = Vector((math.cos(a), math.sin(a), 0)); back = Vector((-math.sin(a), math.cos(a), 0))     # screen-right, away from camera
    n = len(ids)
    for i, vid in enumerate(ids):
        col = bpy.data.collections.get('v_' + vid)
        if not col: continue
        pos = right * (i - (n - 1) / 2) * spacing + back * (zig if i % 2 else -zig) * (1 if n > 1 else 0)
        for ob in col.objects:
            if ob.name.endswith('_kitb') or ob.name.endswith('_kitt'): continue
            sc.collection.objects.link(ob); ob.location = pos
        sm = bpy.data.materials.get(vid + '_skin')
        if sm and tint:
            c = VEH[vid]['m']['c'][0]; col3 = [((c >> s) & 255) / 255.0 for s in (16, 8, 0)]; col3 = [(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in col3]
            nt2 = sm.node_tree; bs = next(x for x in nt2.nodes if x.type == 'BSDF_PRINCIPLED'); tx = next(x for x in nt2.nodes if x.type == 'TEX_IMAGE')
            mx = nt2.nodes.new('ShaderNodeMixRGB'); mx.blend_type = 'MULTIPLY'; mx.inputs['Fac'].default_value = 1.0; mx.inputs['Color2'].default_value = (col3[0] * 1.6, col3[1] * 1.6, col3[2] * 1.6, 1)
            nt2.links.new(tx.outputs['Color'], mx.inputs['Color1']); nt2.links.new(mx.outputs['Color'], bs.inputs['Base Color'])
    d = Vector((math.sin(a) * math.cos(math.radians(el)), -math.cos(a) * math.cos(math.radians(el)), math.sin(math.radians(el))))
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = ortho or (spacing * max(n, 1) + 2.0 if n > 1 else 9.0); cd.clip_start, cd.clip_end = 1, 400
    co = bpy.data.objects.new('cam', cd); sc.collection.objects.link(co); tgt = Vector((0, 0, 1.3 if n > 1 else 1.2))
    co.location = tgt + d * 100; co.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler(); sc.camera = co
    sc.render.filepath = out; sc.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True, scene=sc.name); log('preview', out)

# ---------------------------------------------------------------- run
if not bpy.data.filepath.replace('\\', '/').endswith('art/steelstorm/rebuilt/ground.blend'):
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    scene.render.fps = 30; bpy.ops.wm.save_as_mainfile(filepath=os.path.join(REB, 'ground.blend')); log('created', bpy.data.filepath)
if 'nobuild' not in OPT:
    tot = {}
    for vid in IDS: tot[vid] = make_vehicle(vid)
    bpy.ops.wm.save_mainfile(); log('saved', bpy.data.filepath)
    print('TRIS', json.dumps({k: sum(t.values()) for k, t in tot.items()}))
if 'preview' in OPT or 'shot' in OPT:
    out = OPT.get('shot') if OPT.get('shot', '1') != '1' else os.path.join(ROOT, 'art', 'mockups', 'ssx-ground-1.png')
    kw = {k: (float(OPT[k]) if k != 'w' and k != 'h' else int(OPT[k])) for k in ('w', 'h', 'az', 'el', 'spp', 'spacing', 'zig', 'ortho') if k in OPT}
    if 'w' in kw: kw['W'] = kw.pop('w')
    if 'h' in kw: kw['H'] = kw.pop('h')
    if 'spp' in kw: kw['spp'] = int(kw['spp'])
    preview(IDS, out, **kw)
log('done')
