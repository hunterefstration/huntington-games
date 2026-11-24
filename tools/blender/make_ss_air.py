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
    """two-tone splinter camouflage (mid 0.86 x, dark 0.72 x the base) in hard-edged angular patches, a lighter belly, soot behind the nozzles"""
    rng = np.random.default_rng(17); lo = P.min(0); hi = P.max(0); K = 46
    seeds = lo + (hi - lo) * rng.random((K, 3)).astype(np.float32); tone = rng.integers(0, 3, K)
    Q = P * np.array((1.0, 0.55, 1.0), np.float32); S = seeds * np.array((1.0, 0.55, 1.0), np.float32)
    best = np.full(len(P), 1e9, np.float32); idx = np.zeros(len(P), np.int64)
    for i in range(K):
        d = np.abs(Q[:, 0] - S[i, 0]) + np.abs(Q[:, 1] - S[i, 1]) * 0.8 + np.abs(Q[:, 2] - S[i, 2]) * 1.6
        m = d < best; best[m] = d[m]; idx[m] = i
    f = np.where(tone[idx] == 0, 1.0, np.where(tone[idx] == 1, 0.86, 0.72)).astype(np.float32)
    belly = paint & (Nn[:, 2] < -0.35); f = np.where(belly, np.maximum(f, 0.9) * 1.04, f)
    col_[paint] *= f[paint, None]
    rear = paint & (P[:, 1] > hi[1] - 0.15 * (hi[1] - lo[1])) & (np.abs(Nn[:, 1]) > 0.2); col_[rear] *= 0.9
    # a lighter dusting on the upper surfaces, a little dirt along the lower edges
    up = paint & (Nn[:, 2] > 0.5); col_[up] *= 1.02
    low = paint & (P[:, 2] < lo[2] + 0.12 * (hi[2] - lo[2])); col_[low] *= 0.94
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
def foil(x, y, zle, c, t):
    return [(x, y, zle), (x, y + t * 0.5, zle - 0.3 * c), (x, y - t * 0.42, zle - 0.3 * c), (x, y + t * 0.1, zle - c), (x, y - t * 0.1, zle - c)]
def wing(q, s, x0, x1, zle0, c0, t0, zle1, c1, t1, y0, y1, cls='olive'):
    q.hull(foil(s * x0, y0, zle0, c0, t0) + foil(s * x1, y1, zle1, c1, t1), cls, 0.0)
def fin(q, x0, x1, y0, y1, zle0, c0, zle1, c1, t, cls='olive'):
    pts = []
    for (x, y, zle, c, tt) in ((x0, y0, zle0, c0, t), (x1, y1, zle1, c1, t * 0.6)): pts += [(x, y, zle), (x + tt / 2, y, zle - 0.3 * c), (x - tt / 2, y, zle - 0.3 * c), (x, y, zle - c)]
    q.hull(pts, cls, 0.0)
def zle_at(zle0, zle1, x0, x1, x): return zle0 + (zle1 - zle0) * (abs(x) - x0) / max(1e-6, x1 - x0)
def dome(q, pos, w, hy, rz, cls='red', segs=10, d=(0, 1, 0)):
    q.lathe([(w, 0), (0.92 * w, 0.4 * hy), (0.6 * w, 0.82 * hy), (0, hy)], pos, d, segs, cls, sc=(1, rz / w))
def pwheel(q, s, xface, y, z, r, w, segs=10):
    q.lathe([(0, 0.02), (0.6 * r, 0), (r, -0.02), (r, -w), (0, -w)], (xface, y, z), (s, 0, 0), segs, 'rubber', split=(0.62 * r, 'steel'))
def store(q, x, y, z, r, ln, cls='steel', segs=7):
    q.lathe([(0, -ln / 2), (r * 0.65, -ln / 2 + r * 0.7), (r, -ln / 2 + r * 1.6), (r, ln / 2 - r * 1.8), (r * 0.8, ln / 2 - r * 0.6), (0, ln / 2)], (x, y, z), (0, 0, 1), segs, cls)
def nozzle(q, x, y, z, r, ln, segs=10):
    q.lathe([(r, 0), (r * 1.02, -ln * 0.5), (r * 0.82, -ln), (r * 0.72, -ln), (r * 0.78, -ln * 0.5), (r * 0.9, 0)], (x, y, z), (0, 0, 1), segs, 'steel', loop=True)
    q.lathe([(0, 0), (r * 0.7, 0)], (x, y, z - ln + 0.02), (0, 0, 1), segs, 'dark', caps=False)

class Air:
    def __init__(a, v, seg=12, lite=0):
        a.v = v; m = v['m']; a.m = m; a.L = m['len']; a.S = m['span']; a.k = m['k']; a.f = set(m['f'].split()); a.seg = seg; a.lite = lite
        a.kit = Kit(1); a.body = Q(a.kit, (0, 0, 0), 'gun'); a.P = [Q(a.kit, p['pos'], g) for p, g in zip(v['props'], ('mag', 'bolt'))]
        a.bx = v['body']; a.ytop = a.bx[4]; a.ybot = a.bx[1]
    # ---------------- propeller / rotor parts, centred on the prop's pos
    def prop_parts(a):
        for i, p in enumerate(a.v['props']):
            q = a.P[i]; bx = p['box']; ax = p['axis']
            if ax == 'z':                                    # propeller: 3 blades in the x-y plane, spinner
                r = bx[4] - 0.03; nb = 3
                for j in range(nb):
                    th = 2 * math.pi * j / nb; d = (math.sin(th), math.cos(th)); tg = (math.cos(th), -math.sin(th))
                    def pt(rad, tang, ax_): return (d[0] * rad + tg[0] * tang, d[1] * rad + tg[1] * tang, ax_)
                    q.hull([pt(0.28, -0.1, -0.03), pt(0.28, 0.1, 0.03), pt(0.28, -0.07, 0.05), pt(0.28, 0.07, -0.05), pt(r * 0.55, -0.15, -0.035), pt(r * 0.55, 0.12, 0.03), pt(r, -0.07, 0.0), pt(r, 0.06, 0.02)], 'dark', 0.0)
                q.lathe([(0.0, 0.25), (0.14, 0.17), (0.26, 0.0), (0.26, -0.2), (0, -0.2)], (0, 0, 0), (0, 0, 1), 10, 'steel')
            elif ax == 'x':                                   # tail rotor: two blades along y, hub along x
                r = bx[4] - 0.04
                for sg in (-1, 1): q.hull([(-0.04, 0.12 * sg, -0.05), (-0.04, 0.12 * sg, 0.05), (0.04, 0.12 * sg, -0.05), (0.04, 0.12 * sg, 0.05), (-0.02, r * sg, -0.03), (0.02, r * sg, -0.03), (-0.02, r * sg, 0.03), (0.02, r * sg, 0.03)], 'dark', 0.0)
                q.lathe([(0.1, -0.12), (0.1, 0.12)], (0, 0, 0), (1, 0, 0), 8, 'steel')
            else:                                             # main rotor (y or -y): blades along the box, mast head
                r = bx[3] - 0.05; nb = 4 if ('tandem' in a.f) else 2
                for j in range(nb):
                    th = math.pi * 2 * j / nb; dx, dz = math.sin(th), math.cos(th); tx, tz = dz, -dx
                    def pt(rad, tang, yy): return (dx * rad + tx * tang, yy, dz * rad + tz * tang)
                    q.hull([pt(0.35, -0.17, -0.04), pt(0.35, 0.17, 0.0), pt(0.35, -0.1, 0.07), pt(r * 0.5, -0.15, -0.03), pt(r * 0.5, 0.15, 0.0), pt(r, -0.12, -0.02), pt(r, 0.14, 0.0), pt(r, 0.0, 0.04)], 'dark', 0.0)
                q.lathe([(0.0, 0.2), (0.15, 0.15), (0.28, 0.0), (0.28, -0.12), (0, -0.12)], (0, 0, 0), (0, 1, 0), 10, 'steel')
    # ---------------- guns at the muzzles
    def guns(a, zle_fn=None, ports=False):
        for (x, y, z) in a.v['muzzles'][:2]:
            if ports:
                a.body.lathe([(0.07, 0), (0.07, 0.25)], (x, y, z - 0.2), (0, 0, 1), 6, 'dark'); continue
            zs = max(z - 1.8, (zle_fn(x) if zle_fn else z - 1.8) + 0.2)
            q = a.body; q.lathe([(0.11, zs), (0.11, z - 0.5), (0.05, z - 0.3), (0.05, z)], (x, y, 0), (0, 0, 1), 6, 'olive')
            q.box((x, y + 0.14, zs + 0.3), (0.1, 0.28, 0.5), 'steel')

    # ---------------- ordinary aircraft: props, jets, delta, attackers, heavy bombers
    def plane(a):
        q = a.body; L, S, k, f, v = a.L, a.S, a.k, a.f, a.v
        prop = k in ('prop', 'bomber'); fr = L * (0.085 if prop else 0.07) * (1.15 if 'big' in f else 1)
        wy = fr * 0.7 if 'high' in f else -fr * 0.6 if 'low' in f else 0.0; sw = a.m.get('sweep', 0); delta = k == 'delta'
        root = L * 0.55 if delta else L * 0.24 if k == 'heavy' else L * 0.17 if k == 'atk' else L * 0.2; tip = L * 0.04 if delta else root * (0.55 if prop else 0.4)
        wz = -L * 0.12 if delta else L * 0.02 if k == 'heavy' else -L * 0.02 if k == 'atk' else L * 0.02; half = S / 2; swo = L * 0.45 if delta else math.tan(sw) * half
        dih = 0.04 if prop else (-0.03 if 'high' in f else 0.02); sg_ = a.seg
        # fuselage
        if prop:
            prof = [(fr * 0.1, -L * 0.5), (fr * 0.3, -L * 0.46), (fr * 0.5, -L * 0.34), (fr * 0.7, -L * 0.2), (fr * 0.9, -L * 0.07), (fr * 0.98, L * 0.05), (fr, L * 0.2), (fr, L * 0.32), (fr * 0.94, L * 0.44)]
            ze = L * 0.5 + (L * 0.06 if 'long' in f else 0)
            q.lathe(prof, (0, 0, 0), (0, 0, 1), sg_, 'olive', sc=(0.92, 1.0), caps=False)
            q.lathe([(fr * 0.93, L * 0.4), (fr * 0.96, L * 0.46), (fr * 0.92, ze - 0.1), (fr * 0.78, ze - 0.02), (fr * 0.5, ze), (0, ze)], (0, 0, 0), (0, 0, 1), sg_, 'olive', sc=(0.92, 1.0))
            for s in (-1, 1):
                for i in range(3): q.box((s * fr * 0.72, -fr * 0.1, L * 0.4 - i * 0.18), (0.08, 0.08, 0.14), 'steel')
            q.box((0, -fr * 0.85, L * 0.32), (fr * 0.6, fr * 0.4, L * 0.1), 'olive', 0.02)
        else:
            prof = [(fr * 0.62, -L * 0.5), (fr * 0.78, -L * 0.44), (fr * 0.9, -L * 0.34), (fr * 0.96, -L * 0.2), (fr, -L * 0.05), (fr, L * 0.05), (fr * 0.88, L * 0.22), (fr * 0.62, L * 0.36), (fr * 0.32, L * 0.46), (fr * 0.06, L * 0.52)]
            q.lathe(prof, (0, 0, 0), (0, 0, 1), sg_, 'olive', sc=(0.95, 0.98))
            nozzle(q, 0, 0, -L * 0.5, fr * 0.6, L * 0.05, 10)
            if 'nose' in f: q.lathe([(0.02, 0), (fr * 0.34, 0)], (0, 0, L * 0.4), (0, 0, 1), 8, 'dark', caps=False)
        if 'glassnose' in f:
            dome(q, (0, 0, L * 0.5 - 0.05), fr * 0.56, fr * 0.85, fr * 0.56, 'red', 10, (0, 0, 1))
        if k == 'atk':
            q.lathe([(0.12, 0), (0.12, 1.3), (0.08, 1.6)], (0, -fr * 0.4, L * 0.55 - 0.8), (0, 0, 1), 8, 'steel')
        # canopy and spine
        cz = L * (0.08 if prop else 0.2); cw = fr * 0.55
        if 'glassnose' not in f or k == 'bomber':
            dome(q, (0, fr * 0.55, cz), cw, fr * 0.62, fr * 1.5, 'red', 10, (0, 1, 0))
            if 'framed' in f or ('bubble' not in f and prop):
                for i in range(3): q.box((0, fr * 1.12, cz - fr * 0.9 + i * fr * 0.9), (cw * 1.8, 0.05, 0.05), 'steel')
        if not prop: q.hull([(0.2 * fr, 0.45 * fr, L * 0.1), (0.3 * fr, 0.55 * fr, -L * 0.1), (0.1 * fr, 0.95 * fr, L * 0.02), (0.08 * fr, 0.9 * fr, -L * 0.3), (0.12 * fr, 0.55 * fr, -L * 0.34)], 'olive', 0.0, mirror=True)
        if k == 'prop': q.hull([(0.15 * fr, 0.7 * fr, -L * 0.02), (0.2 * fr, 0.7 * fr, -L * 0.25), (0.05 * fr, 1.0 * fr, -L * 0.08), (0.04 * fr, 0.7 * fr, -L * 0.3)], 'olive', 0.0, mirror=True)
        # wings
        x0 = fr * 0.4; zl0 = wz + root / 2; zl1 = wz - swo + tip / 2; th0 = root * (0.15 if prop else 0.075) * (1.2 if k == 'heavy' else 1); th1 = max(0.05, tip * (0.12 if prop else 0.07))
        for s in (-1, 1):
            wing(q, s, x0, half - 0.05, zl0, root, th0, zl1, tip, th1, wy, wy + dih * half)
            if 'tip' in f:
                q.lathe([(0, -1.1), (0.28, -0.75), (0.32, -0.15), (0.3, 0.5), (0, 1.0)], (s * half, wy + dih * half, wz - swo), (0, 0, 1), 8, 'olive')
        # tail
        if k != 'delta':
            tz0 = -L * 0.42 + L * 0.065; tzl1 = tz0 - (L * 0.04 + math.tan(sw) * S * 0.1) + L * 0.035; ty = (fr * 0.3 if 'twin' in f else 0.1)
            for s in (-1, 1): wing(q, s, fr * 0.4, S * (0.18 if k == 'heavy' else 0.2), tz0, L * 0.13, 0.1, tzl1, L * 0.07, 0.06, ty, ty)
        if 'twin' in f:
            for s in (-1, 1): fin(q, s * fr * 0.9, s * (fr * 0.9 + fr * 0.5), fr * 0.5, a.ytop - 0.03, -L * 0.3, L * 0.17, -L * 0.38, L * 0.08, 0.16)
        elif 'twintail' in f:
            for s in (-1, 1): fin(q, s * S * 0.1, s * S * 0.1, 0.0, a.ytop - 0.03, -L * 0.34, L * 0.13, -L * 0.4, L * 0.07, 0.16)
        elif k == 'atk':
            for s in (-1, 1): fin(q, s * S * 0.11, s * S * 0.11, 0.0, a.ytop - 0.03, -L * 0.34, L * 0.12, -L * 0.4, L * 0.06, 0.16)
        elif k == 'delta':
            fin(q, 0, 0, fr * 0.5, a.ytop - 0.03, -L * 0.28, L * 0.2, -L * 0.42, L * 0.08, 0.18)
        else: fin(q, 0, 0, fr * 0.4, a.ytop - 0.03, -L * 0.3, L * 0.2, -L * 0.4, L * 0.1, 0.18)
        if 'canard' in f:
            for s in (-1, 1): wing(q, s, fr * 0.6, fr * 0.6 + fr * 2.2, L * 0.3, L * 0.1, 0.1, L * 0.3 - L * 0.04, L * 0.03, 0.05, fr * 0.2, fr * 0.2)
        # engines, nacelles, pods, intakes
        if k in ('bomber', 'heavy') or 'eng4' in f:
            ne = 4 if 'eng4' in f else 2
            for i in range(ne):
                s = 1 if i % 2 else -1; ex = s * S * (0.17 if ne == 4 and i < 2 else 0.32 if ne == 4 else 0.22); ez = wz - math.tan(sw) * abs(ex) + (L * 0.06 if prop else L * 0.04)
                ey = wy - (0.2 if prop else fr * 0.6) + dih * abs(ex)
                if prop:
                    q.lathe([(0.0, -L * 0.15), (fr * 0.22, -L * 0.13), (fr * 0.42, -L * 0.07), (fr * 0.5, L * 0.0), (fr * 0.5, L * 0.08), (fr * 0.34, L * 0.125), (0, L * 0.14)], (ex, ey, ez), (0, 0, 1), 10, 'olive')
                else:
                    q.lathe([(fr * 0.3, -L * 0.11), (fr * 0.42, -L * 0.07), (fr * 0.44, L * 0.0), (fr * 0.4, L * 0.09), (fr * 0.46, L * 0.11)], (ex, ey, ez), (0, 0, 1), 10, 'olive')
                    q.lathe([(0.0, 0), (fr * 0.34, 0)], (ex, ey, ez + L * 0.113), (0, 0, 1), 10, 'dark', caps=False); nozzle(q, ex, ey, ez - L * 0.11, fr * 0.3, L * 0.03, 8)
                    q.box((ex, ey + fr * 0.6 + 0.05, ez + 0.2), (0.12, fr * 0.5, L * 0.12), 'olive')
        if 'twinpod' in f:
            for s in (-1, 1):
                q.lathe([(fr * 0.3, -L * 0.11), (fr * 0.46, -L * 0.07), (fr * 0.5, L * 0.0), (fr * 0.42, L * 0.1), (fr * 0.44, L * 0.11)], (s * fr * 1.25, fr * 0.9, -L * 0.22), (0, 0, 1), 10, 'olive')
                q.lathe([(0, 0), (fr * 0.36, 0)], (s * fr * 1.25, fr * 0.9, -L * 0.22 + L * 0.113), (0, 0, 1), 10, 'dark', caps=False); nozzle(q, s * fr * 1.25, fr * 0.9, -L * 0.33, fr * 0.32, L * 0.03, 8)
                q.box((s * fr * 0.9, fr * 0.7, -L * 0.2), (fr * 0.6, 0.12, L * 0.2), 'olive')
        if 'side' in f:
            for s in (-1, 1):
                q.hull([(s * fr * 0.78, -fr * 0.5, L * 0.04), (s * fr * 0.78, fr * 0.45, L * 0.04), (s * fr * 1.28, -fr * 0.3, L * 0.04), (s * fr * 1.28, fr * 0.4, L * 0.04),
                        (s * fr * 0.9, -fr * 0.3, L * 0.26), (s * fr * 0.9, fr * 0.3, L * 0.26), (s * fr * 1.15, -fr * 0.3, L * 0.26), (s * fr * 1.15, fr * 0.3, L * 0.26)], 'olive', 0.01)
                q.box((s * fr * 1.0, 0, L * 0.265), (fr * 0.34, fr * 0.55, 0.05), 'dark')
        # ordnance
        if k == 'atk' or 'big' in f or k == 'heavy':
            for s in (-1, 1):
                for i in range(2):
                    x = s * (fr + 1.2 + i * 1.3); y = wy + dih * abs(x) - 0.45
                    q.box((x, y + 0.28, wz + 0.2), (0.07, 0.3, 0.7), 'steel'); store(q, x, y, wz + 0.2, 0.17, 1.6, 'olive')
        if 'belly' in f: q.lathe([(0.0, -L * 0.15), (fr * 0.5, -L * 0.1), (fr * 0.55, 0.0), (fr * 0.5, L * 0.1), (0, L * 0.15)], (0, -fr * 0.82, 0), (0, 0, 1), 8, 'olive', sc=(1, 0.65))
        if 'gear' in f:
            for s in (-1, 1):
                x = s * fr * 1.6; yw = a.ybot + 0.34; q.box((x, (wy + yw) / 2 - 0.1, L * 0.06), (0.12, wy - yw - 0.2, 0.12), 'steel'); pwheel(q, s, x + s * 0.1, yw, L * 0.06, 0.32, 0.2, 10)
                q.box((x * 0.8, wy - 0.25, L * 0.06 - 0.25), (0.06, 0.06, 0.6), 'steel')
            q.box((0, -fr * 0.9, -L * 0.42), (0.07, 0.4, 0.07), 'steel'); pwheel(q, 1, 0.07, -fr * 1.15, -L * 0.42, 0.14, 0.08, 8)
        a.guns(lambda x: zle_at(zl0, zl1, x0, half, x))
        a.prop_parts()

    # ---------------- flying wing
    def flywing(a):
        q = a.body; L, S = a.L, a.S; half = S / 2; wz = L * 0.2; root = L * 0.9; tip = L * 0.18; swo = L * 0.55
        for s in (-1, 1):
            wing(q, s, 0.0, half - 0.05, wz + root / 2, root, 1.0, wz - swo + tip / 2, tip, 0.3, 0.0, 0.0)
            for i in range(2):
                cx = s * (1.6 + i * 2.0); cz = L * 0.05 - i * 0.4
                q.hull([(cx - 0.6, 0.3, cz + 1.5), (cx + 0.6, 0.3, cz + 1.5), (cx - 0.5, 0.9, cz + 0.6), (cx + 0.5, 0.9, cz + 0.6), (cx - 0.6, 0.3, cz - 1.5), (cx + 0.6, 0.3, cz - 1.5), (cx - 0.5, 0.8, cz - 1.2), (cx + 0.5, 0.8, cz - 1.2)], 'olive', 0.01)
            nozzle(q, s * 2.6, 0.55, -L * 0.07, 0.4, 0.4, 8)
        q.hull([(0.2, 0.2, L * 0.7 - 0.9), (1.8, 0.2, L * 0.3), (1.8, 0.2, -L * 0.3), (0.3, 0.2, -L * 0.45), (0.25, 0.75, L * 0.5), (1.1, 1.0, L * 0.2), (1.0, 1.0, -L * 0.2), (0.2, 1.0, -L * 0.3),
                (0.25, -0.5, L * 0.5), (1.5, -0.6, L * 0.1), (1.0, -0.6, -L * 0.3)], 'olive', 0.015, mirror=True)
        dome(q, (0, 0.85, L * 0.3), 0.5, 0.3, 1.6, 'red', 10, (0, 1, 0))
        for s in (-1, 1): q.box((s * 2.4, -0.3, L * 0.5 - 0.5), (0.9, 0.1, 2.0), 'dark')
        a.guns(ports=True)

    # ---------------- stealth fighter
    def stealth(a):
        q = a.body; L, S = a.L, a.S; fr = L * 0.07; half = S / 2
        q.hull([(0.18 * fr, -0.1 * fr, L * 0.41), (2.75 * fr, -0.2 * fr, -L * 0.2), (2.1 * fr, -0.2 * fr, -L * 0.41), (0.2 * fr, 0.55 * fr, L * 0.33), (1.5 * fr, 0.7 * fr, -L * 0.18), (1.2 * fr, 0.7 * fr, -L * 0.4),
                (0.25 * fr, -0.75 * fr, L * 0.3), (1.8 * fr, -0.75 * fr, -L * 0.3), (0.2 * fr, 0.2 * fr, L * 0.41), (1.0 * fr, -0.6 * fr, -L * 0.1)], 'olive', 0.012, mirror=True)
        q.hull([(0.5 * fr, 0.5 * fr, L * 0.3), (1.0 * fr, 0.5 * fr, L * 0.05), (1.0 * fr, 0.5 * fr, -L * 0.28), (0.3 * fr, 1.3 * fr, L * 0.22), (0.4 * fr, 1.2 * fr, -L * 0.05), (0.3 * fr, 0.8 * fr, -L * 0.3)], 'olive', 0.01, mirror=True)
        dome(q, (0, fr * 0.8, L * 0.2), fr * 0.5, fr * 0.55, fr * 1.7, 'red', 10, (0, 1, 0))
        zr = -L * 0.12 + L * 0.225
        for s in (-1, 1):
            wing(q, s, fr * 2.2, half + fr * 0.2, zr, L * 0.45, 0.25, zr - L * 0.32 - L * 0.1 + L * 0.0, L * 0.1, 0.12, 0.0, 0.0)
            fin(q, s * fr * 1.6, s * (fr * 1.6 + fr * 1.1), fr * 0.5, a.ytop - 0.03, -L * 0.28, L * 0.2, -L * 0.4, L * 0.1, 0.14)
            q.hull([(s * fr * 0.9, -fr * 0.6, L * 0.2), (s * fr * 1.5, -fr * 0.6, L * 0.2), (s * fr * 0.9, fr * 0.3, L * 0.2), (s * fr * 1.5, fr * 0.3, L * 0.2), (s * fr * 1.1, -fr * 0.6, L * 0.05), (s * fr * 1.7, -fr * 0.6, L * 0.05), (s * fr * 1.1, fr * 0.3, L * 0.05)], 'olive', 0.01)
            q.box((s * fr * 1.2, -fr * 0.15, L * 0.2 + 0.02), (fr * 0.6, fr * 0.8, 0.05), 'dark')
        q.box((0, 0.0, -L * 0.41), (fr * 2.4, fr * 0.6, 0.3), 'dark', 0.01)
        a.guns(ports=True)

    # ---------------- helicopters
    def heli(a):
        q = a.body; L = a.L; f = a.f; v = a.v; bw = L * (0.1 if 'tandem' in f else 0.14)
        mastY = bw * 1.7 + 0.25; sg_ = a.seg
        if 'tandem' in f:
            q.hull([(bw, -bw * 1.2, L * 0.33), (bw * 0.45, -bw * 1.2, L * 0.33), (bw, bw * 0.0, L * 0.33), (bw * 0.45, bw * 0.9, L * 0.33), (bw * 0.45, -bw * 1.2, L * 0.3), (bw * 0.9, 1.1 * bw, L * 0.15), (bw * 0.7, bw * 1.2, -L * 0.1), (bw, -bw * 1.2, L * 0.0),
                    (bw, -bw * 1.2, -L * 0.17), (bw * 0.7, 1.2 * bw, -L * 0.17), (bw * 0.5, -bw * 1.0, L * 0.37), (bw * 0.15, 0.1 * bw, L * 0.385)], 'olive', 0.015, mirror=True)
            dome(q, (0, bw * 0.95, L * 0.235), bw * 0.72, bw * 0.55, bw * 1.2, 'red', 10, (0, 1, 0)); dome(q, (0, bw * 1.25, L * 0.09), bw * 0.72, bw * 0.55, bw * 1.2, 'red', 10, (0, 1, 0))
            q.lathe([(0.1, 0), (0.1, 1.2), (0.06, 1.55)], (0, -bw * 1.2, L * 0.3 - 0.65), (0, 0, 1), 7, 'steel')
        else:
            q.lathe([(0.0, -L * 0.14), (bw * 0.9, -L * 0.1), (bw * 1.25, L * 0.0), (bw * 1.2, L * 0.1), (bw * 0.95, L * 0.2), (bw * 0.6, L * 0.27), (0.0, L * 0.31)], (0, 0, 0), (0, 0, 1), sg_, 'olive', sc=(0.95, 1.0))
            dome(q, (0, bw * 0.15, L * 0.18), bw * 0.9, bw * 0.95, bw * 1.5, 'red', 10, (0, 1, 0))
        q.lathe([(bw * 0.2, -L * 0.54), (bw * 0.28, -L * 0.45), (bw * 0.4, -L * 0.3), (bw * 0.5, -L * 0.15), (bw * 0.55, L * 0.0)], (0, bw * 0.3, 0), (0, 0, 1), 8, 'olive')
        fin(q, 0, 0, bw * 0.3, bw * 0.3 + L * 0.17, -L * 0.44, L * 0.09, -L * 0.5, L * 0.045, 0.14)
        for s in (-1, 1): wing(q, s, 0.1, 0.1 + L * 0.1, -L * 0.45 + L * 0.03, L * 0.06, 0.07, -L * 0.45, L * 0.04, 0.05, bw * 0.3, bw * 0.3)
        q.lathe([(bw * 0.6, 0), (bw * 0.8, bw * 0.4), (bw * 0.55, bw * 0.8)], (0, bw * 0.95, L * 0.02), (0, 1, 0), 8, 'olive')
        q.hull([(bw * 0.5, bw * 0.9, L * 0.1), (bw * 0.5, bw * 1.4, L * 0.1), (bw * 0.5, bw * 0.9, -L * 0.14), (bw * 0.3, bw * 1.5, -L * 0.1), (0.1, bw * 1.5, L * 0.05)], 'olive', 0.01, mirror=True)
        for s in (-1, 1): q.lathe([(0.0, 0.0), (bw * 0.28, 0.0)], (s * bw * 0.62, bw * 1.3, -L * 0.07), (0, 0, -1), 8, 'dark', caps=False)
        q.lathe([(0.12, -0.25), (0.12, 0.2), (0.2, 0.28)], (0, mastY - 0.2, L * 0.02), (0, 1, 0), 8, 'steel')
        for (x, y, z) in v['muzzles'][1:]:
            s = 1 if x > 0 else -1
            if 'stubs' in f:
                wing(q, s, bw * 0.5, abs(x), L * 0.02 + L * 0.05, L * 0.1, 0.13, L * 0.02 + L * 0.03, L * 0.07, 0.1, -bw * 0.2, -bw * 0.5)
                q.lathe([(0, -0.7), (0.22, -0.55), (0.28, -0.3), (0.28, 0.5), (0.2, 0.62), (0, 0.66)], (x, y, z - 0.66), (0, 0, 1), 8, 'olive')
                q.lathe([(0.0, 0.0), (0.18, 0.0)], (x, y, z), (0, 0, 1), 8, 'dark', caps=False)
        if 'scout' in f or 'tandem' not in f:
            for s in (-1, 1):
                xk = s * bw * 1.1; q.box((xk, -bw * 1.45, L * 0.08), (0.1, 0.1, L * 0.45), 'steel')
                for z in (L * 0.2, -L * 0.05): q.box((xk * 0.95, -bw * 1.15, z), (0.08, bw * 0.6, 0.08), 'steel')
        else:
            for s in (-1, 1):
                q.box((s * bw * 0.9, -bw * 1.0, L * 0.2), (0.1, bw * 0.6, 0.1), 'steel'); pwheel(q, s, s * bw * 0.9 + s * 0.12, -bw * 1.35, L * 0.2, 0.28, 0.2, 10)
            q.box((0, -bw * 1.1, -L * 0.2), (0.08, bw * 0.5, 0.08), 'steel'); pwheel(q, 1, 0.06, -bw * 1.4, -L * 0.2, 0.2, 0.12, 8)
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
    for seg, lite in ((16, 0), (12, 0), (8, 1)):
        a = Air(v, seg, lite); a.build(); n = sum(len(f.verts) - 2 for f in a.kit.bm.faces)
        if n <= 4400 or seg == 8: break
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
    wid = [0.66 * (VEH[i]['m']['span'] * math.cos(a_) + VEH[i]['m']['len'] * math.sin(a_)) for i in ids]; gap = 0.0
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
