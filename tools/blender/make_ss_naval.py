# Steel Storm Rebuilt: the 22 ships and submarines, one parametric script. Each ship is built from its entry (line "n") in
# art/steelstorm/rebuilt/vehicles.json: the old model's numbers (length, beam, deck height, bridge position and size, funnels, turret list,
# flags) give the plan, the json's body / turret / kit boxes give the extents the check wants. A lofted hull (bow flare, sheer, stem rake,
# transom stern, the old draught below y = 0), stepped superstructure, bridge with windows, funnels with caps, masts and yards, boats,
# anchors, rails as low solid strips, torpedo tubes, VLS cells, gun houses with barrels; submarines with a pressure hull, sail, planes.
#   blender -b art/steelstorm/rebuilt/naval.blend -P tools/blender/make_ss_naval.py -- n1a n1b ...   (no ids: all 22; first time --factory-startup)
#   options: nobuild, shot=<out.png> (render the ids in one row) w= h= az= el= spp=
# then export ONE NAME AT A TIME:  node tools/export-art.mjs v_n1a   (never the bare command) ;  node tools/ss-check-model.mjs
# Parts (vehicle space, +Z to the bow, y = 0 the waterline): <id>_body, <id>_tur0.. (on their pos, barrels along +Z), <id>_kitb (radar fit).
# Materials <id>_skin (painted steel, tinted by the game) and <id>_gear (deck, windows, caps, boats, barrels) on one 512 picture.
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
OPT = dict((a.split('=', 1) + ['1'])[:2] for a in ARGV if not (len(a) >= 2 and a[0] == 'n' and a[1].isdigit()))
VEH = {v['id']: v for v in json.load(open(os.path.join(REB, 'vehicles.json'))) if v['line'] == 'n'}
IDS = [a for a in ARGV if a in VEH] or sorted(VEH)
scene = bpy.context.scene
TEXN = 512
ss_tanks.PAL[CLS.index('red')] = (0.10, 0.17, 0.24)          # window glass
ss_tanks.PAL[CLS.index('white')] = (0.72, 0.72, 0.68)        # ensign, boats' gunwales
ss_tanks.PAL[CLS.index('wood')] = (0.42, 0.33, 0.22)         # deck planking

# ---------------------------------------------------------------- the picture: painted steel, plating lines, rust streaks, boot topping
def ship_decorate(col_, P, Nn, paint, mott, streak):
    """light neutral steel: plating seams, frame lines, soft rust streaks, a darker waterline band and underwater hull (never below 0.72 x the base)"""
    z = P[:, 2]; yb = P[:, 1]; x = P[:, 0]
    seam = paint & (np.abs(np.mod(z + 0.2, 1.3) - 0.65) < 0.025) & (np.abs(Nn[:, 2]) < 0.6); col_[seam] *= 0.9
    frame = paint & (np.abs(np.mod(yb + 0.4, 3.1) - 1.55) < 0.025) & (np.abs(Nn[:, 2]) < 0.6); col_[frame] *= 0.92
    rng = np.random.default_rng(5); k = np.ones(len(P), np.float32)
    blot = np.mod(np.floor(yb * 0.35) * 3.1 + np.floor(z * 0.5) * 1.7 + np.floor(x * 0.4) * 0.9, 1.0)
    k *= np.where(blot > 0.78, 0.9, 1.0)
    k *= np.where(z < 0.0, 0.84, 1.0) * np.where((z > -0.35) & (z < 0.4), 0.88, 1.0)                  # underwater hull and the boot topping
    st = np.clip(streak * 1.6 - 0.55, 0, 1); k *= (1 - 0.18 * st * (np.abs(Nn[:, 2]) < 0.5))                    # rust streaks run down the plating
    col_[paint] *= k[paint, None]
    top = paint & (Nn[:, 2] > 0.6); col_[top] *= 1.03
_src = inspect.getsource(ss_tanks.tank_texture)
for _a, _b in (("decorate(col_, P, Nn, paint, G == GRP.index('mag'), C == CLS.index('rubber'), B, name, mott, streak)", "ship_decorate(col_, P, Nn, paint, mott, streak)"),
               ("col_[paint & panel] *= 0.6", "col_[paint & panel] *= 0.9"), ("(0.35 + 0.65 * np.clip(ao[idx], 0, 1) ** 1.3)", "(0.8 + 0.2 * np.clip(ao[idx], 0, 1) ** 1.3)"),
               ("(0.92 + 0.16 * grain[:, None]) * (0.92 + 0.16 * mott[:, None])", "(0.96 + 0.08 * grain[:, None]) * (0.96 + 0.08 * mott[:, None])"), ("(0.9 + 0.12 * streak[paint])", "(0.96 + 0.05 * streak[paint])"),
               ("rivet = paint &", "rivet = paint & False &")):
    assert _a in _src, _a
    _src = _src.replace(_a, _b)
ss_tanks.ship_decorate = ship_decorate
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

def foil(x, y, zle, c, t):
    return [(x, y, zle), (x, y + t * 0.5, zle - 0.3 * c), (x, y - t * 0.42, zle - 0.3 * c), (x, y + t * 0.1, zle - c), (x, y - t * 0.1, zle - c)]
def wing(q, s, x0, x1, zle0, c0, t0, zle1, c1, t1, y0, y1, cls='olive'):
    q.hull(foil(s * x0, y0, zle0, c0, t0) + foil(s * x1, y1, zle1, c1, t1), cls, 0.0)
def fin(q, x0, x1, y0, y1, zle0, c0, zle1, c1, t, cls='olive'):
    pts = []
    for (x, y, zle, c, tt) in ((x0, y0, zle0, c0, t), (x1, y1, zle1, c1, t * 0.6)): pts += [(x, y, zle), (x + tt / 2, y, zle - 0.3 * c), (x - tt / 2, y, zle - 0.3 * c), (x, y, zle - c)]
    q.hull(pts, cls, 0.0)

# ---------------------------------------------------------------- helpers (game coordinates: x right, y up, z to the bow)
def tbx(q, w, h, l, cx, cy, cz, fs=0.0, rs=0.0, tx=1.0, cls='olive', bev=0.015, fw=1.0):
    """a box with a sloped front (fs = how far the top edge steps back), sloped rear, narrower top (tx); fw: front width factor"""
    y0, y1 = cy - h / 2, cy + h / 2; zf, zr = cz + l / 2, cz - l / 2
    return q.hull([(w / 2, y0, zf), (w / 2, y0, zr), (w / 2 * tx, y1, zf - fs), (w / 2 * tx, y1, zr + rs), (w / 2 * fw, y0, zf)], cls, bev, mirror=True)
def strip(q, x, y, z0, z1, w, h, cls='olive'):
    return q.box((x, y, (z0 + z1) / 2), (w, h, abs(z1 - z0)), cls, 0.0)
def tube(q, pos, r, ln, d=(0, 0, 1), segs=8, cls='steel'):
    return q.lathe([(r, 0), (r, ln)], pos, d, segs, cls)

class Ship:
    def __init__(a, v, lite=0):
        a.v = v; m = v['m']; a.m = m; a.k = m['k']; a.L = m['len']; a.w = m['w']; a.lite = lite
        a.h = m.get('h') or (1.4 if a.k == 'mtb' else 2.0); a.dep = 1.2 if a.k == 'mon' else 1.6
        a.bz, a.bs = m.get('br') or [0, 1.5]; a.fun = m.get('fun', 0); a.tp = m.get('tp', 0); a.turs = m['tur']
        a.kit = Kit(1); a.body = Q(a.kit, (0, 0, 0), 'gun')
        a.Tq = [Q(a.kit, t['pos'], g) for t, g in zip(v['turrets'], ('mag', 'bolt', 'trigger', 'pump'))]
        a.Kq = Q(a.kit, (0, 0, 0), 'spin'); a.ytop = v['body'][4]
    # ---------------- hull: stations from stern to bow
    def stations(a):
        L, w, h, dep, k = a.L, a.w, a.h, a.dep, a.k; bowK = 1.6 if k == 'mtb' else 2.4; sternK = 0.1 if k == 'mon' else 0.35
        ts = [-1, -0.92, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.68, 0.8, 0.9, 0.96, 1.0]; out = []
        for t in ts:
            kk = max(0.03, 1 - t ** bowK) if t > 0 else 1 - (-t) ** 4 * sternK
            hb = w / 2 * kk; sheer = (h * 0.6 * max(0.0, (t - 0.78) / 0.22) ** 2) + (h * 0.08 * max(0.0, -t - 0.6) / 0.4)
            yd = h + sheer; flare = 0.9 if t > 0.45 else 0.95
            e = max(0.0, (t - 0.55) / 0.45); ybot = -dep * (1 - 0.9 * e * e)
            out.append((t * L / 2, hb, yd, flare, ybot))
        return out
    def hull(a):
        k_ = a.kit; bm = k_.bm; st = a.stations(); h = a.h; dep = a.dep; rings = []
        for (z, hb, yd, fl, yb) in st:
            hw = hb * fl; hk = hb * 0.5; cam = 0.07 * (1 if hb > 0.3 else 0)
            half = [(0, yd + cam), (hb, yd), (hw, min(0.0, yd * 0.5)), (hb * 0.78 * fl, yb * 0.45), (hk, yb * 0.85), (hk * 0.4, yb)]
            full = half + [(-x, y) for (x, y) in half[1:-1][::-1]]
            rings.append([(x, y, z) for (x, y) in full])
        before = set(bm.faces); V = [[bm.verts.new(B(*p)) for p in r] for r in rings]; n = len(rings[0])
        for i in range(len(rings) - 1):
            for j in range(n): bm.faces.new((V[i][j], V[i][(j + 1) % n], V[i + 1][(j + 1) % n], V[i + 1][j]))
        bm.faces.new(V[0][::-1]); bm.faces.new(V[-1])
        fs = list(set(bm.faces) - before); bmesh.ops.recalc_face_normals(bm, faces=fs)
        new = k_._finish(before, 'olive', 'gun'); deck = 'wood' if a.k in ('mtb', 'pb') else 'alloy'
        for f in new:
            c = f.calc_center_median()
            if f.normal.z > 0.55 and c.z > h * 0.6: f[k_.cls] = CLS.index(deck)
        a.st = st
        return rings
    def edge_z(a, z):
        """(half beam at the deck edge, deck y) at station z by interpolation"""
        st = a.st
        for i in range(len(st) - 1):
            if st[i][0] <= z <= st[i + 1][0]:
                t = (z - st[i][0]) / max(1e-6, st[i + 1][0] - st[i][0]); return (st[i][1] + (st[i + 1][1] - st[i][1]) * t, st[i][2] + (st[i + 1][2] - st[i][2]) * t)
        return (st[-1][1], st[-1][2])
    def rails(a):
        q = a.body; st = a.st; hr = 0.34 if a.k not in ('bb',) else 0.42
        for s in (-1, 1):
            for i in range(1, len(st) - 2):
                (z0, h0, y0, _, _), (z1, h1, y1, _, _) = st[i], st[i + 1]
                if a.k == 'mon' and False: continue
                q.hull([(s * (h0 - 0.02), y0, z0), (s * (h0 - 0.1), y0, z0), (s * (h0 - 0.02), y0 + hr, z0), (s * (h0 - 0.1), y0 + hr * 0.9, z0),
                        (s * (h1 - 0.02), y1, z1), (s * (h1 - 0.1), y1, z1), (s * (h1 - 0.02), y1 + hr, z1), (s * (h1 - 0.1), y1 + hr * 0.9, z1)], 'olive', 0.0)
        # bulwark at the bow, a little taller
    def hull_details(a):
        q = a.body; L, w, h = a.L, a.w, a.h; st = a.st
        # row of ports along each side (dark strips), anchors and hawsepipes, scuppers
        if a.k not in ('mtb', 'sub'):
            for s in (-1, 1):
                for i in range(3, 9, 1) if a.lite == 0 else range(4, 8, 1):
                    z0, z1 = st[i][0] + 0.3, st[i + 1][0] - 0.3; hb, yd = a.edge_z((z0 + z1) / 2)
                    q.box((s * (hb - 0.0), h * 0.62, (z0 + z1) / 2), (0.04, 0.16, abs(z1 - z0) * 0.8), 'red', 0.0)
        zb = L * 0.5 * 0.86; hb, yd = a.edge_z(zb)
        for s in (-1, 1):
            q.lathe([(0.0, 0.0), (0.1, 0.0)], (s * (hb * 0.97), h * 0.75, zb), (s, 0, 0), 8, 'dark', caps=False)                              # hawse hole
            q.box((s * (hb * 0.96 + 0.05), h * 0.62, zb - 0.55), (0.12, 0.42, 0.34), 'steel', 0.0); q.box((s * (hb * 0.96 + 0.08), h * 0.46, zb - 0.55), (0.1, 0.1, 0.4), 'steel', 0.0)    # anchor
        q.box((0, h + 0.06, L * 0.5 * 0.9), (0.5, 0.12, 0.7), 'steel', 0.0)                                                                       # windlass
        q.lathe([(0.2, 0), (0.2, 0.3)], (0, h, L * 0.5 * 0.78), (0, 1, 0), 8, 'steel')                                                            # bollard / capstan
        # stern: transom details
        zs = -L / 2; hbs, yds = a.edge_z(zs + 0.05)
        q.box((0, h * 0.55, zs - 0.04), (hbs * 1.0, 0.18, 0.08), 'red', 0.0)

    # ---------------- turrets (gun houses standing on their pos)
    def turret(a, i, s, nb):
        q = a.Tq[i]; t = a.v['turrets'][i]; mz, my = t['muzzle']; tip = mz - 0.03; seg = 10 if s < 1.5 else 12
        q.lathe([(s * 0.85, 0), (s * 0.93, 0.03 * s), (s * 0.93, 0.45 * s), (s * 0.85, 0.45 * s)], (0, 0, 0), (0, 1, 0), seg, 'alloy')
        W = 0.8 * s
        q.hull([(W, 0.4 * s, -1.05 * s), (W, 0.4 * s, 0.7 * s), (W, 0.95 * s, -1.0 * s), (W, 0.95 * s, 0.55 * s), (W * 0.86, 1.15 * s, -0.95 * s), (W * 0.86, 1.15 * s, 0.3 * s), (W * 0.9, 0.7 * s, 0.85 * s), (W * 0.9, 1.0 * s, 0.7 * s)], 'olive', 0.02 * s, mirror=True)
        q.box((0, 1.15 * s, -0.5 * s), (0.9 * s, 0.05, 0.4 * s), 'dark', 0.0)                      # roof hatch / sighting hood
        for sx in (-1, 1): q.box((sx * W * 0.5, 1.1 * s, 0.1 * s), (0.18 * s, 0.1 * s, 0.4 * s), 'red', 0.0)    # sighting ports
        for j in range(nb):
            ox = 0 if nb == 1 else (j - (nb - 1) / 2) * s * 0.5; r = s * 0.13
            q.lathe([(r * 1.7, s * 0.55), (r * 1.7, s * 1.2), (r * 1.15, s * 1.25), (r * 1.05, tip * 0.8), (r * 0.95, tip - 0.2), (r * 1.25, tip - 0.2), (r * 1.25, tip - 0.05), (r * 0.5, tip)], (ox, my, 0), (0, 0, 1), 8 if a.lite == 0 else 6, 'steel')
            q.lathe([(0, 0), (r * 0.6, 0)], (ox, my, tip + 0.003), (0, 0, 1), 6, 'dark', caps=False)
            q.box((ox, my, 0.78 * s), (r * 3.0, r * 3.0, 0.1 * s), 'olive', 0.0)                       # mantlet
    # ---------------- superstructures
    def super_(a):
        q = a.body; L, w, h, k, bz, bs = a.L, a.w, a.h, a.k, a.bz, a.bs; fl = 'red'
        top = a.ytop
        if k == 'mtb':
            tbx(q, w * 0.55, bs * 0.9, L * 0.22, 0, h + bs * 0.45, bz + L * 0.05, fs=bs * 0.6, tx=0.8, bev=0.02)
            q.box((0, h + bs * 0.7, bz + L * 0.05 + L * 0.11 - bs * 0.45), (w * 0.46, 0.2, 0.06), fl, 0.0, rot=(('x', 30),))
            for s in (-1, 1): q.box((s * w * 0.28, h + bs * 0.55, bz + L * 0.05), (0.04, 0.2, L * 0.12), fl, 0.0)
            q.lathe([(0.05, 0), (0.03, 0.15)], (0.0, h + bs * 0.9, bz + L * 0.05 - 0.4), (0, 1, 0), 5, 'steel')
            if a.tp:
                for s in (-1, 1):
                    zz = -L * 0.08
                    tube(q, (s * w * 0.36, h + 0.3, zz - L * 0.15), 0.26, L * 0.3, (0, 0, 1), 8, 'olive')
                    q.box((s * w * 0.36, h + 0.1, zz), (0.5, 0.18, 0.2), 'steel', 0.0); q.lathe([(0.0, 0), (0.19, 0)], (s * w * 0.36, h + 0.3, zz + L * 0.15 + 0.002), (0, 0, 1), 8, 'dark', caps=False)
            q.box((0, h + 0.1, -L * 0.32), (w * 0.5, 0.2, L * 0.1), 'steel', 0.0)                                        # engine hatches
            for s in (-1, 1): tube(q, (s * w * 0.25, h + 0.35, -L * 0.45), 0.09, 0.8, (0, 0, -1), 6, 'steel')
            return
        if k == 'mod':
            tbx(q, w * 0.7, bs * 1.6, L * 0.3, 0, h + bs * 0.8, bz - L * 0.05, fs=bs * 0.4, rs=bs * 0.3, tx=0.75, bev=0.03)
            tbx(q, w * 0.4, bs * 2.2, w * 0.5, 0, h + bs * 2.6, bz, fs=0.8, rs=0.8, tx=0.5, bev=0.03)
            q.box((0, h + bs * 1.3, bz + L * 0.1 - 0.2), (w * 0.5, 0.25, 0.08), fl, 0.0, rot=(('x', 20),))
            for s in (-1, 1): q.box((s * w * 0.36, h + bs * 1.1, bz - L * 0.05 + 0.6), (0.06, 0.4, L * 0.1), fl, 0.0)
            for i in range(4):
                for j in range(2): q.box(((j - 0.5) * w * 0.18, h + 0.04, L * 0.24 - i * w * 0.18), (w * 0.14, 0.08, w * 0.14), 'dark', 0.0)
            for i in range(2):
                for j in range(2): q.box(((j - 0.5) * w * 0.18, h + 0.04, -L * 0.3 - i * w * 0.18), (w * 0.14, 0.08, w * 0.14), 'dark', 0.0)
            q.lathe([(0.15, 0), (0.1, 0.25)], (0, h + bs * 3.7 - 0.05, bz), (0, 1, 0), 6, 'steel')
            for s in (-1, 1): q.box((s * w * 0.28, h + bs * 1.65, bz + 0.3), (0.5, 0.5, 0.1), 'dark', 0.0)           # flat radar faces
            a.boats(2, bz - L * 0.12, 1)
            return
        sw = w * 0.35 if k == 'mon' else w * 0.55; ln1 = w * 0.9 + (L * 0.06 if k in ('bb', 'cl') else 0)
        tbx(q, sw, bs, ln1, 0, h + bs / 2, bz, tx=0.9, bev=0.02)
        tbx(q, sw * 0.8, bs * 0.6, w * 0.6, 0, h + bs * 1.3, bz + w * 0.05, fs=0.2 * bs, tx=0.9, bev=0.02)
        q.box((0, h + bs * 1.42, bz + w * 0.35 + 0.02), (sw * 0.82, 0.2, 0.06), fl, 0.0)
        for s in (-1, 1):
            q.box((s * (sw * 0.8 / 2 * 0.93 + 0.02), h + bs * 1.42, bz + w * 0.05 + 0.2), (0.04, 0.2, w * 0.38), fl, 0.0)      # side windows
            q.box((s * (sw * 0.5 + w * 0.09), h + bs * 1.1, bz + w * 0.2), (w * 0.18, 0.12, 0.8), 'olive', 0.0)             # bridge wings
            q.box((s * (sw * 0.5 + w * 0.09), h + bs * 1.1 + 0.2, bz + w * 0.2 + 0.4), (w * 0.18, 0.28, 0.04), 'olive', 0.0)   # wing screens
            for j in range(3): q.box((s * (sw / 2 + 0.01), h + bs * 0.55, bz + (j - 1) * w * 0.28), (0.03, 0.22, 0.2), fl, 0.0)  # portholes / doors in the deckhouse
        q.box((0, h + bs * 0.55, bz + ln1 / 2 + 0.01), (0.3, bs * 0.5, 0.03), 'dark', 0.0)
        if k in ('bb', 'cl'):
            tbx(q, sw * 0.55, bs * 1.4, w * 0.45, 0, h + bs * 2.2, bz - w * 0.1, fs=0.4, tx=0.7, bev=0.02)
            q.box((0, h + bs * 2.75, bz - w * 0.1 + w * 0.2), (sw * 0.5, 0.2, 0.05), fl, 0.0)                              # director windows
            q.box((0, h + bs * 2.95, bz - w * 0.1), (sw * 0.5, 0.25, w * 0.3), 'steel', 0.0)                                  # rangefinder
        # mast with a yard, tapered; ensign
        yt = h + bs * (4.9 if k == 'bb' else 3.9)
        my = h + bs * (3.6 if k == 'bb' else 2.6) - bs * 1.3
        q.lathe([(0.12, 0), (0.09, yt - my)], (0, my, bz - w * 0.2), (0, 1, 0), 6, 'steel')
        q.box((0, yt - bs * 0.6, bz - w * 0.2), (w * 0.5, 0.07, 0.07), 'steel', 0.0); q.box((0, yt - bs * 0.2, bz - w * 0.2), (w * 0.3, 0.06, 0.06), 'steel', 0.0)
        q.box((0, yt, bz - w * 0.2 - 0.45), (0.04, 0.55, 0.9), 'white', 0.0)
        # funnels
        for i in range(a.fun):
            fz = bz - w * 0.75 - i * w * 0.78
            q.lathe([(0.74, 0), (0.7, bs * 0.65), (0.64, bs * 1.1), (0.0, bs * 1.1)], (0, h, fz), (0, 1, 0), 12, 'olive', sc=(0.78 if k not in ('mon',) else 0.8, 1.15))
            q.lathe([(0.66, 0), (0.64, 0.12), (0, 0.12)], (0, h + bs * 1.1 - 0.01, fz), (0, 1, 0), 12, 'dark', sc=(0.78, 1.15))
            q.lathe([(0.7, 0), (0.7, 0.08)], (0, h + bs * 0.85, fz), (0, 1, 0), 12, 'steel', sc=(0.78, 1.15))
            q.lathe([(0.05, 0), (0.05, bs * 0.7)], (0.0, h + bs * 1.0, fz - 0.55), (0, 1, 0), 5, 'steel')                  # steam pipe
        # secondary batteries, light AA
        if k in ('bb', 'cl'):
            for s in (-1, 1):
                for i in range(3):
                    z = bz - L * 0.06 + i * L * 0.07; q.box((s * w * 0.34, h + 0.3, z), (0.9, 0.5, 1.1), 'olive', 0.02); tube(q, (s * w * 0.34, h + 0.45, z + 0.5), 0.06, 1.0, (0, 0, 1), 5, 'steel')
        if a.tp and k not in ('mtb',):
            for s in (-1, 1):
                zz = bz - w * 1.9 - 0.5; q.box((s * w * 0.22, h + 0.25, zz), (0.7, 0.2, 0.9), 'steel', 0.0)
                for j in range(3): tube(q, (s * w * 0.22 + (j - 1) * 0.22, h + 0.5, zz - 0.5), 0.1, 1.2, (0, 0, 1), 6, 'olive')
        a.boats(2 if k in ('bb', 'cl', 'dd') else 1, bz - w * 1.0 - max(0, a.fun - 1) * w * 0.4, 1)
        if k in ('bb', 'cl') and a.lite == 0:                                                                                  # aft crane
            q.lathe([(0.12, 0), (0.1, bs * 1.2)], (0, h, -L * 0.34), (0, 1, 0), 6, 'steel'); q.box((0, h + bs * 1.2, -L * 0.34 - 0.9), (0.1, 0.1, 2.0), 'steel', 0.0, rot=(('x', 20),))
    def boats(a, n, z0, sg):
        q = a.body; w, h, bs = a.w, a.h, a.bs
        if a.k == 'mon' or a.lite > 1: return
        for s in (-1, 1):
            for i in range(n):
                z = z0 - i * max(1.7, a.L * 0.045)
                q.lathe([(0, -1.0), (0.3, -0.6), (0.38, 0.0), (0.3, 0.6), (0, 1.0)], (s * w * 0.3, h + bs * 0.18, z), (0, 0, 1), 6, 'tan', sc=(1, 0.55))
                q.box((s * w * 0.3, h + bs * 0.05, z), (0.06, bs * 0.18, 0.12), 'steel', 0.0)
    # ---------------- submarines
    def sub(a):
        q = a.body; L, w = a.L, a.w; r = w / 2; v = a.v
        prof = [(0.1 * r, L * 0.5), (r * 0.5, L * 0.47), (r * 0.82, L * 0.4), (r, L * 0.3), (r, -L * 0.2), (r * 0.82, -L * 0.33), (r * 0.5, -L * 0.43), (r * 0.18, -L * 0.5)]
        q.lathe(prof[::-1], (0, 0, 0), (0, 0, 1), 14, 'olive')
        q.hull([(w * 0.4, r * 0.93, L * 0.36), (w * 0.4, r * 0.93, -L * 0.16), (w * 0.34, r * 1.02, L * 0.36), (w * 0.34, r * 1.02, -L * 0.16)], 'wood', 0.0, mirror=True)             # casing deck
        zs = L * 0.12; sh = r * 2.4
        tbx(q, w * 0.32, sh, L * 0.14, 0, r + sh * 0.46, zs, fs=L * 0.03, tx=0.8, bev=0.03, fw=0.9)
        q.box((0, r * 2.35, zs + L * 0.07 - 0.12), (w * 0.2, 0.18, 0.04), 'red', 0.0, rot=(('x', 25),))
        for s in (-1, 1):
            wing(q, s, w * 0.14, w * 0.14 + w * 0.55, zs + 0.2, L * 0.05, 0.1, zs + 0.2, L * 0.035, 0.07, r * 1.9, r * 1.9)
            q.box((s * (w * 0.16 + 0.015), r * 2.1, zs), (0.03, r * 0.7, L * 0.06), 'steel', 0.0)
        bx = v['body']; xt = bx[3] - 0.03
        for s in (-1, 1): wing(q, s, r * 0.4, xt, -L * 0.44 + L * 0.03, L * 0.06, 0.1, -L * 0.44 + L * 0.02, L * 0.04, 0.07, 0.0, 0.0)            # stern planes
        hr = -(bx[1] + 0.03)
        fin(q, 0, 0, bx[1] + 0.03, hr * 0.9, -L * 0.4 + L * 0.0, L * 0.06, -L * 0.44, L * 0.045, 0.1)                       # rudder, below the keel line
        top = bx[4] - 0.03
        q.lathe([(0.06, 0), (0.04, top - (r + sh * 0.9))], (0, r + sh * 0.9, zs), (0, 1, 0), 5, 'steel'); q.lathe([(0.05, 0), (0.04, top - (r * 3.2) - 0.4)], (0.2, r * 3.2, zs + L * 0.04), (0, 1, 0), 5, 'steel')
        q.lathe([(0.05, 0), (0.04, top - (r * 3.0))], (-0.18, r * 3.0, zs + L * 0.035), (0, 1, 0), 5, 'steel')
        for i in range(3):                                                                                                  # screw
            th = 2 * math.pi * i / 3; q.hull([(0.05 * math.cos(th), 0.05 * math.sin(th), -L * 0.52), (0.1 * math.cos(th + 0.5), 0.1 * math.sin(th + 0.5), -L * 0.52 - 0.04), (r * 0.55 * math.cos(th), r * 0.55 * math.sin(th), -L * 0.515), (r * 0.5 * math.cos(th + 0.35), r * 0.5 * math.sin(th + 0.35), -L * 0.52)], 'steel', 0.0)
        q.lathe([(0.12, 0), (0.12, -0.2), (0, -0.28)], (0, 0, -L * 0.5 - 0.05), (0, 0, 1), 8, 'steel')
        q.box((0, 0.0, L * 0.5 - 0.3), (w * 0.5, 0.1, 0.02), 'dark', 0.0)                                                    # bow torpedo door line
        for s in (-1, 1): q.lathe([(0, 0), (0.12, 0)], (s * r * 0.3, -r * 0.1, L * 0.49 + 0.02), (0, 0, 1), 6, 'dark', caps=False)
        # anchor / mooring / flood slots along the casing
        for i in range(5): q.box((0, r * 1.03, L * 0.3 - i * L * 0.09), (w * 0.5, 0.02, 0.05), 'dark', 0.0)
    # ---------------- the radar fit (kitb): mast + antenna bar built into the json's box
    def kit(a):
        kb = a.v.get('kitBody')
        if not kb: return
        q = a.Kq; cx = (kb[0] + kb[3]) / 2; cz = (kb[2] + kb[5]) / 2; dx = kb[3] - kb[0]; dz = kb[5] - kb[2]; dy = kb[4] - kb[1]
        q.lathe([(0.06, 0), (0.05, dy * 0.7)], (cx, kb[1], cz), (0, 1, 0), 6, 'steel')
        q.box((cx, kb[4] - dy * 0.15, cz), (dx * 0.98, dy * 0.26, dz * 0.9), 'olive', 0.0)
        q.box((cx, kb[4] - dy * 0.4, cz), (0.18, dy * 0.12, dz * 0.9), 'steel', 0.0)
    def build(a):
        if a.k == 'sub':
            a.sub()
        else:
            a.hull(); a.rails(); a.hull_details(); a.super_()
        for i, (z, s, nb) in enumerate(a.turs):
            a.turret(i, s, nb)
            t = a.v['turrets'][i]
            if a.k != 'sub' and t['pos'][1] > a.h + 0.2:           # a raised turret stands on a barbette
                a.body.lathe([(s * 1.0, 0), (s * 1.0, t['pos'][1] - a.h + 0.01)], (0, a.h, t['pos'][2]), (0, 1, 0), 12, 'olive')
        a.kit_()
    def kit_(a): a.kit_parts()
    def kit_parts(a): Ship.kit(a)

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
    for lite in (0, 1, 2):
        a = Ship(v, lite); a.build(); n = sum(len(f.verts) - 2 for f in a.kit.bm.faces)
        if n <= 4300 or lite == 2: break
        a.kit.bm.free()
    col = bpy.data.collections.new('v_' + vid); scene.collection.children.link(col)
    me = bpy.data.meshes.new(vid + '_all'); a.kit.bm.to_mesh(me); a.kit.bm.free()
    ob = bpy.data.objects.new(vid + '_all', me); col.objects.link(ob); split_uv(ob, 0.004)
    img = ss_tanks.tank_texture(ob, TEXN, vid + '_tank'); mat = image_material(vid + '_skin', img, 0.6, 0.25); gmat = gear_material(mat); gmat.name = vid + '_gear'
    gv = np.empty(len(me.vertices), np.int64); me.attributes['grp'].data.foreach_get('value', gv)
    names = []; parts = [('body', 'gun')] + [('tur%d' % i, g) for i, g in enumerate(('mag', 'bolt', 'trigger', 'pump')[:len(v['turrets'])])] + ([('kitb', 'spin')] if v.get('kitBody') else [])
    for part, gi in parts:
        if not (gv == GRP.index(gi)).any(): continue
        b2 = bmesh.new(); b2.from_mesh(me); b2.verts.ensure_lookup_table()
        bmesh.ops.delete(b2, geom=[x for x in b2.verts if gv[x.index] != GRP.index(gi)], context='VERTS')
        pm = bpy.data.meshes.new('%s_%s' % (vid, part)); b2.to_mesh(pm); b2.free(); split_by_class(pm, mat, gmat)
        po = bpy.data.objects.new('%s_%s' % (vid, part), pm); col.objects.link(po); names.append(po.name)
    bpy.data.objects.remove(ob, do_unlink=True); bpy.data.meshes.remove(me)
    cfg = {'blend': 'naval.blend', 'out': '../../../Steel Storm Rebuilt/assets/v_' + vid, 'parts': names, 'maxTexture': TEXN}
    with open(os.path.join(REB, 'v_%s.export.json' % vid), 'w') as f: json.dump(cfg, f, indent=1)
    tr = sum(sum(len(f.vertices) - 2 for f in bpy.data.objects[n].data.polygons) for n in names); log(vid, 'triangles', tr, 'detail', lite)
    return tr

# ---------------------------------------------------------------- preview: one straight row, three-quarter from the bow and above, dark-blue ground
def preview(ids, out, W=2000, H=600, az=32.0, el=30.0, spp=40):
    sc = bpy.data.scenes.new('nav_prev'); sc.render.resolution_x, sc.render.resolution_y = W, H
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
    gm = bpy.data.materials.new('sea'); gm.use_nodes = True; bs_ = next(n for n in gm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'); bs_.inputs['Base Color'].default_value = (0.012, 0.04, 0.10, 1); bs_.inputs['Roughness'].default_value = 0.35
    bpy.ops.mesh.primitive_plane_add(size=900); pl = bpy.context.active_object; pl.data.materials.append(gm)
    for c_ in list(pl.users_collection): c_.objects.unlink(pl)
    sc.collection.objects.link(pl)
    a_ = math.radians(az); right = Vector((math.cos(a_), math.sin(a_), 0))
    wid = [0.55 * (VEH[i]['m']['w'] * math.cos(a_) + VEH[i]['m']['len'] * math.sin(a_)) + 2 for i in ids]
    tot = sum(wid); x = -tot / 2
    for i, vid in enumerate(ids):
        col = bpy.data.collections.get('v_' + vid); xc = x + wid[i] / 2; x += wid[i]
        if not col: continue
        sm = bpy.data.materials.get(vid + '_skin')
        if sm:
            c = VEH[vid]['m']['c'][0]; c3 = [((c >> s) & 255) / 255.0 for s in (16, 8, 0)]; c3 = [(t / 12.92 if t <= 0.04045 else ((t + 0.055) / 1.055) ** 2.4) for t in c3]
            nt2 = sm.node_tree; bs = next(t for t in nt2.nodes if t.type == 'BSDF_PRINCIPLED'); tx = next(t for t in nt2.nodes if t.type == 'TEX_IMAGE')
            mx = nt2.nodes.new('ShaderNodeMixRGB'); mx.blend_type = 'MULTIPLY'; mx.inputs['Fac'].default_value = 1.0; mx.inputs['Color2'].default_value = (c3[0] * 1.7, c3[1] * 1.7, c3[2] * 1.7, 1)
            nt2.links.new(tx.outputs['Color'], mx.inputs['Color1']); nt2.links.new(mx.outputs['Color'], bs.inputs['Base Color'])
        for ob in col.objects:
            sc.collection.objects.link(ob); ob.location = right * xc
    d = Vector((math.sin(a_) * math.cos(math.radians(el)), -math.cos(a_) * math.cos(math.radians(el)), math.sin(math.radians(el))))
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = tot * 1.0 + 4; cd.clip_start, cd.clip_end = 1, 900
    co = bpy.data.objects.new('cam', cd); sc.collection.objects.link(co); co.location = Vector((0, 0, 2.5)) + d * 400; co.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler(); sc.camera = co
    sc.render.filepath = out; sc.render.image_settings.file_format = 'PNG'; bpy.ops.render.render(write_still=True, scene=sc.name); log('preview', out)

# ---------------------------------------------------------------- run
if not bpy.data.filepath.replace('\\', '/').endswith('art/steelstorm/rebuilt/naval.blend'):
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(REB, 'naval.blend')); log('created', bpy.data.filepath)
if 'nobuild' not in OPT:
    tot_ = {vid: make_vehicle(vid) for vid in IDS}
    bpy.ops.wm.save_mainfile(); print('TRIS', json.dumps(tot_))
if 'shot' in OPT:
    kw = {k: (int(OPT[k]) if k in ('w', 'h', 'spp') else float(OPT[k])) for k in ('w', 'h', 'az', 'el', 'spp') if k in OPT}
    if 'w' in kw: kw['W'] = kw.pop('w')
    if 'h' in kw: kw['H'] = kw.pop('h')
    preview(IDS, OPT['shot'], **kw)
log('done')
