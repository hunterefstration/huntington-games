# NIGHTLINE: the fleet. Twenty cars, each built from a short description (FLEET below), one .blend and one export description each.
#   "C:/Program Files/Blender Foundation/Blender 4.5/blender.exe" -b --factory-startup -P tools/blender/make_nl_cars.py -- [only=kite,halo] [preview=1]
# then  node tools/export-art.mjs car_kite car_halo ...   (ALWAYS named; the script prints the line)  ->  Nightline/assets/car_<id>.hgm
# It also writes Nightline/src/js/27-fleetdata.js (sizes, wheel places, lamp places: never edit that by hand).
# HOW A CAR IS MADE
#   the tub: rings of 16 points from tail to nose (floor, sill, side, shoulder, hood), smoothed once, with a round hole cut for each wheel;
#   the cabin: a second, smaller run of rings sunk into the tub (glass at the sides and both ends, paint for the roof and the pillars);
#   everything else is laid ON that skin by shooting rays at it (lamps, grilles, door lines, stripes: `patch`) or is a small solid part
#   (splitter, skirts, wing, mirrors, exhausts), and four wheels with spokes, discs and calipers.
# WHAT THE GAME EXPECTS (Nightline/src/js/30-car.js, carModel): objects body, wheel_fl/fr/rl/rr, lamp_head, lamp_tail (children of body);
#   materials paint (the game colours it), glass, detail (one small palette picture: every other colour is a square of it).
# Car axes while building: x to the left, s forward (nose at +s), z up, the ground at z = 0, s = 0 halfway between the axles.
#   Blender (x, -s, z); the game (x, z, s).
import bpy, bmesh, math, os, sys, json, bisect
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hgkit import log

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OPT = dict((a.split('=', 1) + ['1'])[:2] for a in ARGV)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = os.path.join(ROOT, 'art', 'nightline', 'cars'); TEX = os.path.join(BASE, 'tex'); PRE = os.path.join(BASE, 'preview')
for d in (BASE, TEX, PRE): os.makedirs(d, exist_ok=True)
scene = bpy.context.scene

def lerp(a, b, t): return a + (b - a) * t
def bump(x, c, w): return math.exp(-((x - c) / w) ** 2)
def B(x, s, z): return Vector((x, -s, z))
def curve(pts):                                           # a smooth line through points that never overshoots them
    pts = sorted(pts); xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; n = len(xs)
    h = [max(xs[i + 1] - xs[i], 1e-6) for i in range(n - 1)]; d = [(ys[i + 1] - ys[i]) / h[i] for i in range(n - 1)]
    m = [d[0]] + [0.0 if d[i - 1] * d[i] <= 0 else 2 * d[i - 1] * d[i] / (d[i - 1] + d[i]) for i in range(1, n - 1)] + [d[-1]]
    def f(x):
        if x <= xs[0]: return ys[0]
        if x >= xs[-1]: return ys[-1]
        i = bisect.bisect_right(xs, x) - 1; t = (x - xs[i]) / h[i]
        return (2 * t ** 3 - 3 * t ** 2 + 1) * ys[i] + (t ** 3 - 2 * t ** 2 + t) * h[i] * m[i] + (-2 * t ** 3 + 3 * t ** 2) * ys[i + 1] + (t ** 3 - t ** 2) * h[i] * m[i + 1]
    return f

# ---------------------------------------------------------------- the palette: every colour that is not paint, glass or a lamp
PAL = ['black', 'dark', 'tyre', 'silver', 'chrome', 'gun', 'red', 'yellow', 'white', 'amber', 'carbon', 'bronze', 'gloss', 'lens', 'cabin', 'blue']
PALC = {'black': (0.035, 0.035, 0.04), 'dark': (0.09, 0.09, 0.10), 'tyre': (0.028, 0.028, 0.03), 'silver': (0.62, 0.64, 0.67), 'chrome': (0.86, 0.87, 0.9), 'gun': (0.20, 0.21, 0.23),
        'red': (0.75, 0.05, 0.04), 'yellow': (0.95, 0.72, 0.05), 'white': (0.9, 0.9, 0.88), 'amber': (1.0, 0.45, 0.05), 'carbon': (0.06, 0.065, 0.07), 'bronze': (0.55, 0.38, 0.18),
        'gloss': (0.02, 0.02, 0.022), 'lens': (0.30, 0.02, 0.02), 'cabin': (0.05, 0.05, 0.055), 'blue': (0.1, 0.35, 0.9)}
def cell(name): i = PAL.index(name); return ((i % 4 + 0.5) / 4, 1 - (i // 4 + 0.5) / 4)
def palette_image():
    N = 64; a = np.zeros((N, N, 4), np.float32); a[..., 3] = 1
    for i, n in enumerate(PAL):
        r, c = i // 4, i % 4; a[N - (r + 1) * 16:N - r * 16, c * 16:(c + 1) * 16, :3] = PALC[n]      # row 0 of the list is the TOP of the picture
    im = bpy.data.images.new('nl_palette', N, N, alpha=False); im.pixels.foreach_set(a.ravel()); im.filepath_raw = os.path.join(TEX, 'nl_palette.png'); im.file_format = 'PNG'; im.save()
    return im
def materials(paint):
    def mat(name, col, rough, metal, image=None, emit=None):
        m = bpy.data.materials.new(name); m.use_nodes = True; b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
        if image: t = m.node_tree.nodes.new('ShaderNodeTexImage'); t.image = image; t.interpolation = 'Closest'; m.node_tree.links.new(t.outputs['Color'], b.inputs['Base Color'])
        if emit: b.inputs['Emission Color'].default_value = (*emit[0], 1); b.inputs['Emission Strength'].default_value = emit[1]
        return m
    return [mat('paint', paint, 0.28, 0.4), mat('glass', (0.012, 0.016, 0.022), 0.05, 0.9), mat('detail', (1, 1, 1), 0.45, 0.25, image=palette_image())], \
        mat('lamp_head', (1, 1, 1), 0.3, 0, emit=((1.0, 0.95, 0.85), 6.0)), mat('lamp_tail', (1, 0.05, 0.03), 0.3, 0, emit=((1.0, 0.04, 0.02), 4.0))
PAINT, GLASS, DETAIL = 0, 1, 2

# ---------------------------------------------------------------- small makers: every face gets a material and, for `detail`, its palette square
class Mesh:
    def __init__(self): self.bm = bmesh.new(); self.uv = self.bm.loops.layers.uv.new('UVMap')
    def face(self, vs, mat, col=None, out=None):
        try: f = self.bm.faces.new(vs)
        except ValueError: return None
        f.material_index = mat; f.smooth = True
        if out is not None:
            f.normal_update()
            if f.normal.dot(out) < 0: f.normal_flip()
        if col:
            u = cell(col)
            for l in f.loops: l[self.uv].uv = u
        return f
    def v(self, p): return self.bm.verts.new(p)
    def box(self, c, hx, hs, hz, mat, col=None, pitch=0.0, taper=1.0):      # centre (x, s, z), half sizes; pitch: nose-down tilt (radians) about the x axis; taper: top narrower in x
        cp, sp = math.cos(pitch), math.sin(pitch); vs = []
        for dz in (-1, 1):
            for ds in (-1, 1):
                for dx in (-1, 1):
                    a, b = ds * hs, dz * hz; vs.append(self.v(B(c[0] + dx * hx * (taper if dz > 0 else 1), c[1] + a * cp + b * sp, c[2] - a * sp + b * cp)))
        cen = B(*c)
        for q in ((0, 1, 3, 2), (4, 5, 7, 6), (0, 1, 5, 4), (2, 3, 7, 6), (0, 2, 6, 4), (1, 3, 7, 5)):
            pts = [vs[i] for i in q]; mid = sum((p.co for p in pts), Vector()) / 4; f = self.face(pts, mat, col, mid - cen)
            if f: f.smooth = False
    def tube(self, c, r, hs, mat, col, colin='black', n=10):                 # a pipe along s (an exhaust): chrome outside, dark inside
        ring = lambda s, rr: [self.v(B(c[0] + rr * math.cos(a), s, c[2] + rr * math.sin(a))) for a in (2 * math.pi * i / n for i in range(n))]
        a, b, e = ring(c[1] - hs, r), ring(c[1] + hs, r), ring(c[1] - hs, r * 0.78)
        for i in range(n):
            j = (i + 1) % n; mid = (a[i].co + b[j].co) / 2
            self.face([a[i], a[j], b[j], b[i]], mat, col, mid - B(c[0], mid.y * -1, c[2]))
            self.face([a[i], a[j], e[j], e[i]], mat, col, Vector((0, 1, 0)))
        self.face(e, mat, colin, Vector((0, 1, 0)))
    def finish(self, name, mats, sharp=38):
        me = bpy.data.meshes.new(name); self.bm.to_mesh(me); self.bm.free()
        for m in mats: me.materials.append(m)
        me.set_sharp_from_angle(angle=math.radians(sharp))
        ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob); return ob

# things laid on the skin: a grid of points, each pushed onto the body along the line of sight of `view`
def ray_of(view):
    if view == 'front': return lambda a, b: (Vector((a, -9, b)), Vector((0, 1, 0)))
    if view == 'rear': return lambda a, b: (Vector((a, 9, b)), Vector((0, -1, 0)))
    if view == 'side': return lambda a, b: (Vector((9, -a, b)), Vector((-1, 0, 0)))          # (s, z) seen from the left
    return lambda a, b: (Vector((a, -b, 9)), Vector((0, 0, -1)))                             # 'top': (x, s)
def patch(M, bvh, view, corners, mat, col=None, n=(6, 2), off=0.008, mirror=True, lift=None):
    """corners: 4 points (a, b) of the view, going round. Returns the centre of what was laid (car axes x, s, z) or None."""
    ray = ray_of(view); nu, nv = n; grid = {}; cen = Vector(); k = 0
    for i in range(nu + 1):
        for j in range(nv + 1):
            u, w = i / nu, j / nv
            a = lerp(lerp(corners[0][0], corners[1][0], u), lerp(corners[3][0], corners[2][0], u), w); b = lerp(lerp(corners[0][1], corners[1][1], u), lerp(corners[3][1], corners[2][1], u), w)
            o, d = ray(a, b); hit = bvh.ray_cast(o, d)
            lv = off if lift is None else lift
            if callable(lv): lv = lv(u, w)
            if hit[0] is not None: grid[i, j] = hit[0] - d * lv; cen += grid[i, j]; k += 1
    if not k: return None
    o, d = ray(0, 0)
    for sx in ((1, -1) if mirror else (1,)):
        vs = {key: M.v(Vector((p.x * sx, p.y, p.z))) for key, p in grid.items()}
        for i in range(nu):
            for j in range(nv):
                q = [vs.get((i, j)), vs.get((i + 1, j)), vs.get((i + 1, j + 1)), vs.get((i, j + 1))]
                if all(q): M.face(q, mat, col, Vector((-d.x * sx, -d.y, -d.z)))
    cen /= k; return (cen.x, -cen.y, cen.z)
def disc(M, bvh, view, c, r, mat, col=None, n=14, off=0.008, mirror=True, dome=0.0):
    ray = ray_of(view); pts = [c] + [(c[0] + r * math.cos(2 * math.pi * i / n), c[1] + r * math.sin(2 * math.pi * i / n)) for i in range(n)]; hits = []
    for a, b in pts:
        o, d = ray(a, b); h = bvh.ray_cast(o, d)
        if h[0] is None: return None
        hits.append(h[0] - d * (off + (dome if (a, b) == c else 0.0)))
    for sx in ((1, -1) if mirror else (1,)):
        vs = [M.v(Vector((p.x * sx, p.y, p.z))) for p in hits]
        for i in range(n): M.face([vs[0], vs[1 + i], vs[1 + (i + 1) % n]], mat, col, Vector((-d.x * sx, -d.y, -d.z)))
    return (hits[0].x, -hits[0].y, hits[0].z)

# ---------------------------------------------------------------- the tub
HALF = 12                                                  # points in half a ring: floor, sill (3), kick, side (2), shoulder (2), deck (3)
def ss(x): x = min(1.0, max(0.0, x)); return x * x * (3 - 2 * x)
def profiles(S):
    sf, sr = S['wb'] / 2 + S['of'], S['wb'] / 2 + S['orr']; c0, c1, c2, c3 = S['cab']
    deck = curve([(-sr, S['zt']), (max(c0, -sr + 0.12), S['zd']), (c3, S['zc']), ((c3 + sf) / 2, lerp(S['zc'], S['zn'], 0.45) + S['bulge']), (sf, S['zn'])])
    plan = curve([(-sr, S['pt']), (-sr + 0.38, lerp(S['pt'], 1, 0.82)), (-S['wb'] * 0.25, 1.0), (S['wb'] * 0.25, 1.0), (sf - 0.42, lerp(S['pn'], 1, 0.8)), (sf, S['pn'])])
    floor = curve([(-sr, S['clear'] + S['tail_lift']), (-sr + 0.5, S['clear']), (sf - 0.45, S['clear']), (sf, S['clear'] + S['nose_lift'])])
    belt = lambda s: deck(s) - S['crown'] * (0.55 + 0.45 * math.sin(math.pi * min(1, max(0, (s + sr) / (sf + sr)))))
    return sf, sr, deck, plan, floor, belt
def ring_at(S, s, P):
    sf, sr, deck, plan, floor, belt = P; c0, c1, c2, c3 = S['cab']; wbh = S['wb'] / 2
    fl = S['flare'][0] * bump(s, wbh, 0.44) + S['flare'][1] * bump(s, -wbh, 0.46)        # the swell over each wheel
    w = S['W'] / 2 * plan(s) - max(S['flare']); zb, zs, zt = floor(s), belt(s), deck(s)
    need = 2 * S['R'] + 0.085; zs += max(0.0, need - belt(wbh)) * bump(s, wbh, 0.5) + max(0.0, need - belt(-wbh)) * bump(s, -wbh, 0.52)      # the wings rise over the wheels
    tuck = S['scallop'] * bump(s, 0, S['wb'] * 0.3); hgt = zs - zb; sill = 0.03 + tuck
    hm = S['hood'] * math.sin(math.pi * min(1.0, max(0.0, (s - c3) / max(sf - 0.12 - c3, 0.1)))) ** 0.8 if s > c3 else 0.0      # the power bulge of the hood
    z3, z4, z5 = zb + min(0.05, 0.12 * hgt), zb + min(0.12, 0.27 * hgt), zb + min(0.18, 0.40 * hgt); zm = lerp(z5, zs, 0.5)
    return [(0, zb), (0.55 * w, zb), (0.92 * w, zb + 0.012), (w - sill, z3), (w - sill, z4), (w + 0.4 * fl - 0.004, z5), (w + fl, zm),
            (0.99 * w + 0.9 * fl, zs - 0.03), (0.975 * w + 0.8 * fl, zs), (S['tum'] * w - 0.015 + 0.3 * fl, zs + 0.3 * (zt - zs)), (0.5 * w, zt - (zt - zs) * 0.12 + 0.5 * hm), (0, zt + hm)]
def stations(a, b, n):
    out = []
    for i in range(n):
        t = i / (n - 1); t = 0.55 * t + 0.45 * (0.5 - 0.5 * math.cos(math.pi * t)); out.append(lerp(a, b, t))
    return out
def station_list(S, P, n=14):
    sf, sr = P[0], P[1]; wbh = S['wb'] / 2; allp = sorted(stations(-sr, sf, n) + [c + dd * S['R'] for c in (wbh, -wbh) for dd in (-0.95, 0.95)])
    out = [allp[0]]
    for v in allp[1:-1]:
        if v - out[-1] > 0.09: out.append(v)
    if allp[-1] - out[-1] < 0.06: out.pop()
    return out + [allp[-1]]
def warp(S, P, x, s, z):                                   # the bumper step at the tail and the overhanging hood edge at the nose
    sf, sr = P[0], P[1]; fl = P[4]
    if s < -sr + 0.30: t = 1 - (s + sr) / 0.30; s += 0.05 * t * t * ss((z - (fl(-sr) + 0.22)) / 0.10)
    if s > sf - 0.30: t = 1 - (sf - s) / 0.30; s -= 0.04 * t * t * (1 - ss((z - (fl(sf) + 0.12)) / 0.10))
    return x, s, z
def loft(rows, mats, close_ends, crease):
    """rows: list of full rings (lists of Vector). mats(i, j) -> material of the face between ring i, i+1 and point j, j+1. Returns a mesh, smoothed once."""
    bm = bmesh.new(); cr = bm.edges.layers.float.new('crease_edge'); n = len(rows[0]); V = [[bm.verts.new(p) for p in r] for r in rows]; closed = close_ends is not None
    for i in range(len(rows) - 1):
        for j in range(n if closed else n - 1):
            k = (j + 1) % n; f = bm.faces.new([V[i][j], V[i][k], V[i + 1][k], V[i + 1][j]]); f.material_index = mats(i, j)
    if closed:
        for r in (V[0], V[-1]):                           # the two ends: strips across, from one side to its mirror
            bm.faces.new([r[0], r[1], r[n - 1]]); bm.faces.new([r[n // 2 - 1], r[n // 2], r[n // 2 + 1]])
            for j in range(1, n // 2 - 1): bm.faces.new([r[j], r[j + 1], r[n - j - 1], r[n - j]])
    bm.edges.ensure_lookup_table()
    for (kind, j), val in crease.items():
        if kind == 'along':
            for i in range(len(rows) - 1):
                e = bm.edges.get([V[i][j], V[i + 1][j]])
                if e: e[cr] = val
        else:
            r = V[j]
            for q in range(n):
                e = bm.edges.get([r[q], r[(q + 1) % n]])
                if e: e[cr] = val
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('cage'); bm.to_mesh(me); bm.free(); ob = bpy.data.objects.new('cage', me); scene.collection.objects.link(ob)
    md = ob.modifiers.new('s', 'SUBSURF'); md.levels = 1; md.render_levels = 1
    return ob
def baked(ob):
    bpy.context.view_layer.update(); me = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get())); return me
def drop(ob): me = ob.data; bpy.data.objects.remove(ob, do_unlink=True); bpy.data.meshes.remove(me)

def wheel_x(S, P, s): return S['W'] / 2 * P[3](s) - max(S['flare']) + (S['flare'][0] if s > 0 else S['flare'][1]) - 0.03 - S['tw'] / 2
def build_tub(S, P):
    sf, sr = P[0], P[1]; rows = []; n = 2 * HALF - 2
    for s in station_list(S, P):
        h = ring_at(S, s, P); pts = [(x, z) for x, z in h] + [(-x, z) for x, z in reversed(h[1:-1])]; rows.append([B(*warp(S, P, x, s, z)) for x, z in pts])
    cr = {('ring', 0): 0.55, ('ring', len(rows) - 1): 0.55}
    for j, v in ((2, 0.4), (4, 0.7), (5, 0.55), (8, min(1.0, S['crease'] + 0.3)), (7, 0.3)): cr[('along', j)] = v; cr[('along', n - j)] = v
    ob = loft(rows, lambda i, j: PAINT, True, cr)
    Ra = S['R'] + 0.048; cuts = []
    for sw in (S['wb'] / 2, -S['wb'] / 2):
        for sx in (1, -1):
            xw = wheel_x(S, P, sw); x0, x1 = xw - S['tw'] / 2 - 0.10, xw + 0.9
            bm = bmesh.new(); r = bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=Ra, radius2=Ra, depth=x1 - x0)
            bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=__import__('mathutils').Matrix.Rotation(math.pi / 2, 3, 'Y'))
            bmesh.ops.translate(bm, verts=bm.verts, vec=(sx * (x0 + x1) / 2, -sw, S['R']))
            me = bpy.data.meshes.new('cut'); bm.to_mesh(me); bm.free(); c = bpy.data.objects.new('cut', me); scene.collection.objects.link(c); cuts.append(c)
            md = ob.modifiers.new('b', 'BOOLEAN'); md.operation = 'DIFFERENCE'; md.object = c; md.solver = 'EXACT'
    me = baked(ob); drop(ob)
    for c in cuts: drop(c)
    return me, Ra

# recesses: a prism pushed into the skin along the line of sight, cut out of the tub (lamps, grille, plate, vents)
def cut_mesh(bm, outer, inner, ring):                    # a closed prism from two caps and a ring of walls (lists of vertex lists)
    n = len(ring)
    for i in range(n):
        j = (i + 1) % n; bm.faces.new([inner[ring[i]], inner[ring[j]], outer[ring[j]], outer[ring[i]]])
def cut_grid(bvh, view, corners, n, depth, sx=1, up=0.06):
    ray = ray_of(view); nu, nv = n; hit = {}; bm = bmesh.new()
    for i in range(nu + 1):
        for j in range(nv + 1):
            u, w = i / nu, j / nv
            a = lerp(lerp(corners[0][0], corners[1][0], u), lerp(corners[3][0], corners[2][0], u), w); b = lerp(lerp(corners[0][1], corners[1][1], u), lerp(corners[3][1], corners[2][1], u), w)
            o, d = ray(a, b); h = bvh.ray_cast(o, d)
            if h[0] is None: bm.free(); return None
            hit[i, j] = h[0]
    d = Vector((d.x * sx, d.y, d.z)); fx = lambda p: Vector((p.x * sx, p.y, p.z))
    inn = {k: bm.verts.new(fx(p) + d * depth) for k, p in hit.items()}; out = {k: bm.verts.new(fx(p) - d * up) for k, p in hit.items()}
    for i in range(nu):
        for j in range(nv):
            for V in (inn, out): bm.faces.new([V[i, j], V[i + 1, j], V[i + 1, j + 1], V[i, j + 1]])
    ring = [(i, 0) for i in range(nu)] + [(nu, j) for j in range(nv)] + [(i, nv) for i in range(nu, 0, -1)] + [(0, j) for j in range(nv, 0, -1)]
    cut_mesh(bm, out, inn, ring); return finish_cut(bm)
def cut_disc(bvh, view, c, r, depth, sx=1, segs=12, up=0.06):
    ray = ray_of(view); pts = [c] + [(c[0] + r * math.cos(2 * math.pi * i / segs), c[1] + r * math.sin(2 * math.pi * i / segs)) for i in range(segs)]; hit = []; bm = bmesh.new()
    for a, b in pts:
        o, d = ray(a, b); h = bvh.ray_cast(o, d)
        if h[0] is None: bm.free(); return None
        hit.append(h[0])
    d = Vector((d.x * sx, d.y, d.z)); fx = lambda p: Vector((p.x * sx, p.y, p.z))
    inn = [bm.verts.new(fx(p) + d * depth) for p in hit]; out = [bm.verts.new(fx(p) - d * up) for p in hit]
    for V in (inn, out):
        for i in range(segs): bm.faces.new([V[0], V[1 + i], V[1 + (i + 1) % segs]])
    for i in range(segs):
        j = (i + 1) % segs; bm.faces.new([inn[1 + i], inn[1 + j], out[1 + j], out[1 + i]])
    return finish_cut(bm)
def finish_cut(bm):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); me = bpy.data.meshes.new('cut'); bm.to_mesh(me); bm.free(); return bpy.data.objects.new('cut', me)
def carve(me, cuts):
    for p in me.polygons: p.material_index += 10
    ob = bpy.data.objects.new('pre', me); scene.collection.objects.link(ob); coll = bpy.data.collections.new('cuts')
    for c in cuts: coll.objects.link(c)
    md = ob.modifiers.new('b', 'BOOLEAN'); md.operation = 'DIFFERENCE'; md.operand_type = 'COLLECTION'; md.collection = coll; md.solver = 'EXACT'; md.use_self = True
    out = baked(ob); drop(ob)
    for c in cuts: drop(c)
    bpy.data.collections.remove(coll); return out
def grow(c, g):
    ca = sum(p[0] for p in c) / len(c); cb = sum(p[1] for p in c) / len(c)
    return [(p[0] + g * (1 if p[0] > ca + 1e-6 else -1), p[1] + g * (1 if p[1] > cb + 1e-6 else -1)) for p in c]

# ---------------------------------------------------------------- the cabin
def build_cabin(S, P):
    sf, sr, deck, plan, floor, belt = P; c0, c1, c2, c3 = S['cab']; top = S['H']; bp = lerp(c1, c2, S['bp'])
    st = [c0, lerp(c0, c1, 0.3), lerp(c0, c1, 0.7), c1, bp - 0.04, bp + 0.04, c2, lerp(c2, c3, 0.3), lerp(c2, c3, 0.7), c3]
    base = lambda s: belt(s) - 0.05
    roof = curve([(c0, base(c0) + 0.02), (c1, top - S['sag']), ((c1 + c2) / 2, top), (c2, top - 0.015), (c3, base(c3) + 0.02)])
    rows = []
    for k, s in enumerate(st):
        e = 0.9 if k in (0, len(st) - 1) else 0.97 if k in (1, len(st) - 2) else 1.0
        w = (S['W'] / 2 * plan(s) - max(S['flare'])) * S['cabw'] * e; zb = base(s); hh = max(roof(s) - zb, 0.02); wr = w * lerp(1.0, S['tumble'], min(1, hh / max(top - zb, 0.05)))
        h = [(w, zb), (w * 0.985, zb + 0.13 * hh), (lerp(w, wr, 0.82), zb + 0.80 * hh), (wr * 0.93, zb + 0.95 * hh), (wr * 0.5, zb + hh * (1 + 0.012)), (0, zb + hh * (1 + 0.02))]
        rows.append([B(x, s, z) for x, z in h] + [B(-x, s, z) for x, z in reversed(h[:-1])])
    def mats(i, j):
        r = j if j < 5 else 9 - j
        if r == 1: return GLASS if i in (1, 2, 3, 5, 6, 7) else PAINT
        if r >= 3: return GLASS if (i <= 2 or i >= 6 or S['roofglass']) else PAINT
        return PAINT
    ob = loft(rows, mats, None, {('along', 2): 0.3, ('along', 8): 0.3}); me = baked(ob); drop(ob)
    bm = bmesh.new(); bm.from_mesh(me); bpy.data.meshes.remove(me)                                   # every window sunk behind a dark frame: pillars with thickness
    gl = [f for f in bm.faces if f.material_index == GLASS]
    r = bmesh.ops.inset_region(bm, faces=gl, thickness=0.022, depth=-0.014, use_even_offset=True, use_boundary=True)
    for f in r['faces']: f.material_index = TRIM
    me = bpy.data.meshes.new('cabin'); bm.to_mesh(me); bm.free(); return me
TRIM = 4

# ---------------------------------------------------------------- wheels
def build_wheel(S, name, side, mats):
    M = Mesh(); R, tw = S['R'], S['tw']; st = S['rim']; Rr = R * st.get('size', 0.70); N = 20; rimc = st.get('col', 'silver'); ax = Vector((side, 0, 0)); h = tw / 2; sw = R - Rr
    def lathe(prof, col, outward):                        # prof: (x, r) pairs, x > 0 is the outer face of the wheel
        rings = [[M.v(Vector((side * x, r * math.cos(a), r * math.sin(a)))) for a in (2 * math.pi * i / N for i in range(N))] for x, r in prof]
        for k in range(len(prof) - 1):
            for i in range(N):
                j = (i + 1) % N; q = [rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]]; mid = sum((p.co for p in q), Vector()) / 4; rad = Vector((0, mid.y, mid.z)).normalized()
                dx = prof[k + 1][0] - prof[k][0]; dr = prof[k + 1][1] - prof[k][1]
                nrm = (rad * abs(dx) + ax * (1 if (dr < 0) == outward else -1) * abs(dr)) if outward else (-rad * abs(dx) + ax * abs(dr))
                M.face(q, DETAIL, col, nrm if nrm.length > 1e-6 else rad)
    def plate(x, r, col, facing):                         # a flat disc at x, seen from the outside (facing = 1) or the inside
        c = M.v(Vector((side * x, 0, 0))); ring = [M.v(Vector((side * x, r * math.cos(a), r * math.sin(a)))) for a in (2 * math.pi * i / N for i in range(N))]
        for i in range(N): M.face([c, ring[i], ring[(i + 1) % N]], DETAIL, col, ax * facing)
    # the tyre: a rounded sidewall, the shoulder, a flat tread with a groove; the inside half is plain (nobody sees it)
    lathe([(-h + 0.01, Rr), (-h, R - 0.05), (-h + 0.05, R), (h - 0.06, R), (h - 0.022, R - 0.012), (h + 0.002, R - 0.05), (h + 0.006, lerp(Rr, R, 0.45)), (h - 0.008, Rr + 0.004)], 'tyre', True)
    lathe([(h - 0.008, Rr + 0.004), (h - 0.02, Rr - 0.012), (h - 0.05, Rr - 0.03), (-h + 0.03, Rr - 0.035)], rimc, False)      # the lip and the barrel
    plate(-h + 0.03, Rr - 0.035, 'black', 1)
    dish = st.get('dish', 0.075); fx = h - dish; n = st.get('n', 5); kind = st.get('kind', 'five'); bx = h - 0.20
    plate(bx, Rr * 0.82, 'gun', 1); lathe([(bx, Rr * 0.82), (bx - 0.026, Rr * 0.82)], 'gun', True);       # the brake disc, with its thickness
    def spoke(a, w0, w1, r0, r1, col, th=0.034, tilt=0.03):
        ca, sa = math.cos(a), math.sin(a); t = Vector((0, -sa, ca)); rd = Vector((0, ca, sa)); vs = []
        for dx in (0, -th):
            for r, w in ((r0, w0), (r1, w1)):
                for q in (-1, 1): vs.append(M.v(Vector((side * (fx + dx - tilt * (1 - (r - r0) / max(r1 - r0, 1e-3))), 0, 0)) + rd * r + t * (q * w / 2)))
        cen = sum((v.co for v in vs), Vector()) / 8
        for q in ((0, 1, 3, 2), (4, 5, 7, 6), (0, 2, 6, 4), (1, 3, 7, 5), (2, 3, 7, 6)):
            pts = [vs[i] for i in q]; f = M.face(pts, DETAIL, col, sum((p.co for p in pts), Vector()) / 4 - cen)
            if f: f.smooth = False
    r1 = Rr - 0.028
    if kind == 'five':
        for i in range(n): spoke(2 * math.pi * i / n, 0.095, 0.06, 0.05, r1, rimc)
    elif kind == 'split':
        for i in range(n):
            for o in (-0.16, 0.16): spoke(2 * math.pi * i / n + o, 0.036, 0.028, 0.06, r1, rimc)
    elif kind == 'multi':
        for i in range(n): spoke(2 * math.pi * i / n, 0.034, 0.024, 0.06, r1, rimc, th=0.03)
    elif kind == 'turbine':
        for i in range(n): spoke(2 * math.pi * i / n, 0.06, 0.115, 0.06, r1, rimc, th=0.026)
    elif kind == 'dish':
        plate(fx - 0.012, r1, rimc, 1)
        for i in range(n): spoke(2 * math.pi * i / n, 0.05, 0.05, r1 * 0.55, r1 * 0.8, 'black', th=-0.004, tilt=0)
    elif kind == 'steel':
        plate(fx - 0.02, r1, rimc, 1)
        for i in range(n): spoke(2 * math.pi * i / n, 0.07, 0.07, r1 * 0.5, r1 * 0.78, 'black', th=-0.004, tilt=0)
    hc = st.get('hub', rimc); lathe([(fx - 0.03, 0.08), (fx + 0.004, 0.06), (fx + 0.012, 0.0)], hc, True)      # the hub cap
    ca = S.get('caliper', 'red'); a0 = math.radians(35)                                                             # the caliper: a block straddling the disc
    for k in range(3):
        a = a0 + k * math.radians(17); a2 = a + math.radians(17); pts = []
        for x in (bx + 0.03, bx - 0.055):
            for aa, r in ((a, Rr * 0.60), (a2, Rr * 0.60), (a2, Rr * 0.84), (a, Rr * 0.84)): pts.append(M.v(Vector((side * x, r * math.cos(aa), r * math.sin(aa)))))
        M.face(pts[0:4], DETAIL, ca, ax); M.face([pts[3], pts[2], pts[6], pts[7]], DETAIL, ca, Vector((0, math.cos(a), math.sin(a)))); M.face([pts[0], pts[3], pts[7], pts[4]], DETAIL, ca, Vector((0, -math.sin(a), math.cos(a))) * -1)
    return M.finish(name, mats, sharp=50)

# ---------------------------------------------------------------- panel lines, lips, slats
def line(M, bvh, view, pts, wd=0.011, col='black', off=0.003, mirror=True, dens=0.09):
    """a dark inset line that follows the surface: a strip along the polyline pts (a, b of the view)."""
    ray = ray_of(view); dense = []
    for p, q in zip(pts, pts[1:]):
        k = max(1, int(math.hypot(q[0] - p[0], q[1] - p[1]) / dens))
        for i in range(k): dense.append((lerp(p[0], q[0], i / k), lerp(p[1], q[1], i / k)))
    dense.append(pts[-1]); rows = []
    for i, p in enumerate(dense):
        a = dense[min(i + 1, len(dense) - 1)]; b = dense[max(i - 1, 0)]; tx, ty = a[0] - b[0], a[1] - b[1]; l = math.hypot(tx, ty) or 1.0; nx, ny = -ty / l, tx / l; pair = []
        for sg in (-1, 1):
            o, d = ray(p[0] + sg * nx * wd / 2, p[1] + sg * ny * wd / 2); h = bvh.ray_cast(o, d); pair.append(None if h[0] is None else h[0] - d * off)
        rows.append(pair)
    o, d = ray(0, 0)
    for sx in ((1, -1) if mirror else (1,)):
        for i in range(len(rows) - 1):
            q = [rows[i][0], rows[i][1], rows[i + 1][1], rows[i + 1][0]]
            if all(v is not None for v in q): M.face([M.v(Vector((v.x * sx, v.y, v.z))) for v in q], DETAIL, col, Vector((-d.x * sx, -d.y, -d.z)))
def slats(M, bvh, view, c, fr, th, col, lift, n=8, mirror=True):
    for f in fr:
        A = (lerp(c[0][0], c[3][0], f), lerp(c[0][1], c[3][1], f)); Bp = (lerp(c[1][0], c[2][0], f), lerp(c[1][1], c[2][1], f))
        patch(M, bvh, view, [(A[0], A[1] - th / 2), (Bp[0], Bp[1] - th / 2), (Bp[0], Bp[1] + th / 2), (A[0], A[1] + th / 2)], DETAIL, col, n=(n, 1), mirror=mirror, lift=lift)
def arch_lip(M, bvh, S, P, Ra):
    """a flared lip standing proud round the top of each wheel opening (rings of points laid on the skin, then raised)."""
    prof = [(0.0, 0.0006), (0.0, 0.015), (0.012, 0.0185), (0.03, 0.012), (0.052, 0.0006)]; R = S['R']; flo = P[4]
    for sw in (S['wb'] / 2, -S['wb'] / 2):
        for sx in (1, -1):
            rings = []
            for i in range(17):
                ph = math.radians(-32 + 244 * i / 16); s = sw + (Ra + 0.01) * math.cos(ph); z = R + (Ra + 0.01) * math.sin(ph); ring = []
                if z < flo(s) + 0.07: rings.append(None); continue
                for dr, off in prof:
                    rr = Ra + dr; s2 = sw + rr * math.cos(ph); z2 = R + rr * math.sin(ph); o = Vector((9 * sx, -s2, z2)); h = bvh.ray_cast(o, Vector((-sx, 0, 0)))
                    if h[0] is None: ring = None; break
                    ring.append(Vector((h[0].x + sx * off, -s2, z2)))
                rings.append(ring)
            ctr = Vector((sx * 0.5, -sw, R))
            for i in range(16):
                a, b = rings[i], rings[i + 1]
                if a is None or b is None: continue
                vs = [[M.v(p) for p in r] for r in (a, b)]
                for k in range(4):
                    q = [vs[0][k], vs[1][k], vs[1][k + 1], vs[0][k + 1]]; mid = sum((v.co for v in q), Vector()) / 4
                    out = Vector((sx, 0, 0)) if k else Vector((0, ctr.y - mid.y, ctr.z - mid.z))
                    M.face(q, PAINT, None, out)

# ---------------------------------------------------------------- one car
def lamp_shapes(d, zlo, zhi, wend):
    kind = d.get('kind', 'slit'); z0 = lerp(zlo, zhi, d.get('z', 0.7)); x0, x1 = wend * d.get('x0', 0.45), wend * d.get('x1', 0.93); th = d.get('h', 0.06); rise = d.get('rise', 0.0)
    if kind in ('slit', 'rect'): return [('q', [(x0, z0 - th / 2), (x1, z0 - th / 2 + rise), (x1, z0 + th / 2 + rise), (x0, z0 + th / 2)], (7, 2))]
    if kind == 'tri': return [('q', [(x0, z0 - th * 0.2), (x1, z0 - th / 2 + rise), (x1, z0 + th / 2 + rise), (x0, z0 + th * 0.2)], (7, 2))]
    if kind == 'vert': w = d.get('w', 0.1); return [('q', [(x1 - w, z0 - th), (x1, z0 - th), (x1, z0 + th), (x1 - w, z0 + th)], (2, 5))]
    if kind == 'bar': return [('q', [(0.0, z0 - th / 2), (x1, z0 - th / 2), (x1, z0 + th / 2), (0.0, z0 + th / 2)], (12, 1))]
    r = d.get('r', 0.075); xc = lerp(x0, x1, 0.75); out = [('c', (xc, z0), r)]
    if d.get('n', 2) > 1: out.append(('c', (xc - r * 2.3, z0), r * 0.9))
    return out
GR = 0.012                                                  # how far a lamp's recess reaches past its lens

def build(S):
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for d in list(coll):
            if d.users == 0: coll.remove(d)
    P = profiles(S); sf, sr, deck, plan, floor, belt = P; W2 = S['W'] / 2; mats, m_head, m_tail = materials(S['paint'])
    c0, c1, c2, c3 = S['cab']; arch = S['R'] + 0.14
    def halfw(s): return W2 * plan(s) - max(S['flare'])
    wn, wt = halfw(sf - 0.05), halfw(-sr + 0.05); zfn, zft = floor(sf), floor(-sr)
    tub, Ra = build_tub(S, P)
    if OPT.get('dbg'): log('tub', len(tub.polygons), 'rows', len(station_list(S, P)))
    # ---- recesses cut into the tub: lamps, grille, mouth, intakes, plate, vents
    tb = bmesh.new(); tb.from_mesh(tub); tbvh = BVHTree.FromBMesh(tb); cuts = []
    def pq(view, corners, n, depth, mirror=True):
        for sx in ((1, -1) if mirror else (1,)):
            c = cut_grid(tbvh, view, corners, n, depth, sx)
            if c: cuts.append(c)
    def pc(view, c, r, depth):
        for sx in (1, -1):
            o = cut_disc(tbvh, view, c, r, depth, sx)
            if o: cuts.append(o)
    lamps = {}
    for key, view, d, zlo, zhi, wend in (('head', 'front', S['head'], zfn, S['zn'], wn), ('tail', 'rear', S['tailL'], zft, S['zt'], wt)):
        lamps[key] = (view, lamp_shapes(d, zlo, zhi, wend))
        for sh in lamps[key][1]:
            if sh[0] == 'q':
                c = sh[1]
                if d.get('kind') == 'bar': x1 = c[1][0] + GR; pq(view, [(-x1, c[0][1] - GR), (x1, c[1][1] - GR), (x1, c[2][1] + GR), (-x1, c[3][1] + GR)], (16, 2), 0.026, mirror=False)
                else: pq(view, grow(c, GR), sh[2], 0.026)
            else: pc(view, sh[1], sh[2] + GR, 0.026)
    g = S.get('grille'); gq = None
    if g:
        gq = [(-wn * g[0], lerp(zfn, S['zn'], g[1])), (wn * g[0], lerp(zfn, S['zn'], g[1])), (wn * g[0] * g[3], lerp(zfn, S['zn'], g[2])), (-wn * g[0] * g[3], lerp(zfn, S['zn'], g[2]))]
        pq('front', grow(gq, 0.006), (12, 2), 0.034, mirror=False)
    ik = S.get('intake'); iq = None
    if ik: a, b = ik[0], ik[1]; iq = [(wn * a, zfn + 0.04), (wn * b, zfn + 0.04), (wn * b, zfn + ik[2]), (wn * a, zfn + ik[2] * 0.8)]; pq('front', iq, (4, 2), 0.03)
    mo = S.get('mouth'); mq = None
    if mo: mq = [(-wn * mo[0], zfn + 0.035), (wn * mo[0], zfn + 0.035), (wn * mo[0] * 0.86, zfn + mo[1]), (-wn * mo[0] * 0.86, zfn + mo[1])]; pq('front', mq, (10, 2), 0.03, mirror=False)
    if S.get('tailpanel'): pq('rear', [(-wt * 0.9, lerp(zft, S['zt'], 0.52)), (wt * 0.9, lerp(zft, S['zt'], 0.52)), (wt * 0.9, lerp(zft, S['zt'], 0.9)), (-wt * 0.9, lerp(zft, S['zt'], 0.9))], (10, 2), 0.01, mirror=False)
    zp = zft + 0.16; plq = [(-0.26, zp), (0.26, zp), (0.26, zp + 0.12), (-0.26, zp + 0.12)]; pq('rear', plq, (4, 2), 0.018, mirror=False)           # the number plate sits in a recess
    hv = None
    if S.get('hoodvent'):
        xa = 0.14
        if S.get('stripes'): xa = max(xa, max(abs(v) for ab in S['stripes']['at'] for v in ab) + 0.05)
        a = lerp(c3, sf, 0.42); hv = [(xa, a), (xa + 0.26, a), (xa + 0.22, a + 0.30), (xa, a + 0.34)]; pq('top', hv, (3, 3), 0.024)
    sv = None
    if S.get('sidevent'):
        a = -S['wb'] / 2 + arch + 0.08; sv = [(a, lerp(floor(0), belt(a), 0.38)), (a + 0.34, lerp(floor(0), belt(a), 0.30)), (a + 0.30, lerp(floor(0), belt(a), 0.74)), (a + 0.04, lerp(floor(0), belt(a), 0.66))]; pq('side', sv, (3, 3), 0.03)
    try: tub = carve(tub, cuts) if cuts else tub
    finally: tb.free()
    cab = build_cabin(S, P)
    if OPT.get('dbg'): log('carved', len(tub.polygons), 'cabin', len(cab.polygons))
    M = Mesh(); M.bm.from_mesh(tub); bpy.data.meshes.remove(tub); M.bm.normal_update(); black = cell('black')
    for f in M.bm.faces:                                                                           # the pockets the cutters left are dark; everything else lost its +10
        if f.material_index >= 10: f.material_index -= 10
        else:
            f.material_index = DETAIL
            for l in f.loops: l[M.uv].uv = black
    sw0 = M.bm.faces[:]; low = []
    for f in sw0:                                                                                  # the floor between the wheels is never seen: drop it
        c = f.calc_center_median()
        if f.normal.z < -0.85 and abs(c.x) < 0.5 * W2 and c.z < floor(-c.y) + 0.04: low.append(f)
    bmesh.ops.delete(M.bm, geom=low, context='FACES')
    M.bm.from_mesh(cab); bpy.data.meshes.remove(cab)
    for f in M.bm.faces: f.smooth = True
    for f in M.bm.faces:                                                                           # the window frames
        if f.material_index == TRIM:
            f.material_index = DETAIL
            for l in f.loops: l[M.uv].uv = black
    for f in M.bm.faces:                                                                           # the insides of the wheel arches
        if f.material_index != PAINT: continue
        for sw in (S['wb'] / 2, -S['wb'] / 2):
            if all(math.hypot(-v.co.y - sw, v.co.z - S['R']) <= Ra + 0.002 for v in f.verts):
                f.material_index = DETAIL
                for l in f.loops: l[M.uv].uv = black
                break
    M.bm.normal_update(); bvh = BVHTree.FromBMesh(M.bm); L = Mesh(); T = Mesh(); info = {'head': [], 'tail': []}
    if OPT.get('dbg'): log('M before lip', len(M.bm.faces))
    arch_lip(M, bvh, S, P, Ra)
    if OPT.get('dbg'): log('M after lip', len(M.bm.faces))
    # ---- lamps (their own objects: the game lights them): a domed lens at the bottom of its recess ----
    dome = lambda u, w: 0.0035 + 0.009 * math.sin(math.pi * u) * math.sin(math.pi * w)
    for key, Mx in (('head', L), ('tail', T)):
        view, shapes = lamps[key]; cen = None
        for sh in shapes:
            if sh[0] == 'q': cen = patch(Mx, bvh, view, sh[1], 0, n=sh[2], lift=dome) or cen
            else:
                c = disc(Mx, bvh, view, sh[1], sh[2], 0, off=0.004, n=14, dome=0.009)
                if c: cen = c
                if c and sh is shapes[0]: pass
        if cen and lamps[key][1][0][0] == 'q' and len(lamps[key][1][0][2]) == 2 and lamps[key][1][0][2][0] == 12: cen = (lamps[key][1][0][1][1][0] * 0.8, cen[1], cen[2])
        if cen: info[key] = [[round(cen[0], 3), round(cen[2], 3), round(cen[1], 3)], [round(-cen[0], 3), round(cen[2], 3), round(cen[1], 3)]]
    # ---- inside the recesses and on the skin ----
    if gq:
        for f in (0.36, 0.68): slats(M, bvh, 'front', gq, [f], 0.014, 'gun', 0.012, n=12, mirror=False)
        patch(M, bvh, 'front', [(-0.012, gq[0][1] + 0.005), (0.012, gq[0][1] + 0.005), (0.012, gq[3][1] - 0.005), (-0.012, gq[3][1] - 0.005)], DETAIL, 'gun', n=(1, 3), lift=0.014, mirror=False)
    if iq: slats(M, bvh, 'front', iq, [0.45], 0.012, 'gun', 0.01, n=4)
    if mq: slats(M, bvh, 'front', mq, [0.5], 0.013, 'gun', 0.01, n=10, mirror=False)
    if hv: slats(M, bvh, 'top', hv, [0.25, 0.5, 0.75], 0.022, 'dark', 0.012, n=3)
    if sv: slats(M, bvh, 'side', sv, [0.3, 0.5, 0.7], 0.02, 'dark', 0.014, n=3)
    patch(M, bvh, 'rear', plq, DETAIL, 'white', n=(4, 2), mirror=False, lift=0.004)                # the plate at the bottom of its recess
    if S.get('diffuser') or S.get('valance'): patch(M, bvh, 'rear', [(-wt * 0.86, zft + 0.01), (wt * 0.86, zft + 0.01), (wt * 0.8, zft + 0.13), (-wt * 0.8, zft + 0.13)], DETAIL, 'black', n=(10, 2), mirror=False, off=0.005)
    # shut lines, handles, fuel flap
    sd = [(S['wb'] / 2 - arch - 0.05, lerp(c2, c3, 0.35)), (max(-S['wb'] / 2 + arch + 0.05, lerp(c1, c2, S['bp']) - 0.25), lerp(c1, c2, S['bp']))]          # (bottom, top) of the two door shuts
    for a, b in sd: line(M, bvh, 'side', [(a, floor(0) + 0.10), (lerp(a, b, 0.5) + 0.01, lerp(floor(0) + 0.10, belt(b) - 0.02, 0.5)), (b, belt(b) - 0.02)])
    hw = halfw((c3 + sf) / 2) * 0.78
    line(M, bvh, 'top', [(hw, c3 + 0.03), (hw * 0.97, lerp(c3, sf, 0.5)), (hw * 0.85, sf - 0.34)]); line(M, bvh, 'top', [(-hw, c3 + 0.03), (hw, c3 + 0.03)], mirror=False)      # the hood
    tw_ = halfw((c0 - sr) / 2) * 0.78
    line(M, bvh, 'top', [(tw_, c0 - 0.07), (tw_ * 0.98, lerp(c0, -sr, 0.5)), (tw_ * 0.9, -sr + 0.2)]); line(M, bvh, 'top', [(-tw_, c0 - 0.07), (tw_, c0 - 0.07)], mirror=False)           # the trunk
    sh_ = sd[1][1] + 0.17
    if sh_ < sd[0][1] - 0.2:                                                                       # door handle: a dark pocket and the handle itself
        zh = belt(sh_) - 0.105; patch(M, bvh, 'side', [(sh_ - 0.06, zh - 0.022), (sh_ + 0.06, zh - 0.022), (sh_ + 0.06, zh + 0.022), (sh_ - 0.06, zh + 0.022)], DETAIL, 'black', n=(4, 1), off=0.004)
        patch(M, bvh, 'side', [(sh_ - 0.05, zh - 0.011), (sh_ + 0.05, zh - 0.011), (sh_ + 0.05, zh + 0.011), (sh_ - 0.05, zh + 0.011)], PAINT, None, n=(4, 1), off=0.011)
    sf_ = (-S['wb'] / 2 - Ra - sr) / 2
    if (-S['wb'] / 2 - Ra) - (-sr) > 0.3:                                                          # fuel flap, left side
        zf = belt(sf_) - 0.12; disc(M, bvh, 'side', (sf_, zf), 0.062, DETAIL, 'black', n=12, off=0.004, mirror=False); disc(M, bvh, 'side', (sf_, zf), 0.054, PAINT, None, n=12, off=0.008, mirror=False)
    st = S.get('stripes')
    if st:
        for a, b in st['at']:
            for k in range(st.get('n', 22)):
                s0, s1 = lerp(-sr - 0.02, sf + 0.02, k / st.get('n', 22)), lerp(-sr - 0.02, sf + 0.02, (k + 1) / st.get('n', 22))
                patch(M, bvh, 'top', [(a, s0), (b, s0), (b, s1), (a, s1)], DETAIL, st.get('col', 'white'), n=(1, 1), off=0.006)
    if OPT.get('dbg'): log('M before solids', len(M.bm.faces))
    # ---- small solid parts ----
    if S.get('splitter'): M.box((0, sf - 0.12, zfn - 0.012), wn + 0.03, 0.2, 0.014, DETAIL, 'carbon')
    if S.get('skirts'):
        for sx in (1, -1): M.box((sx * (halfw(0) - 0.03), 0, floor(0) + 0.02), 0.05, S['wb'] / 2 - arch - 0.02, 0.035, DETAIL, 'black')
    d = S.get('diffuser')
    if d:
        M.box((0, -sr + 0.16, zft - 0.03), wt * 0.8, 0.2, 0.02, DETAIL, 'carbon', pitch=-0.2)
        for i in range(d): M.box((lerp(-wt * 0.6, wt * 0.6, i / max(d - 1, 1)), -sr + 0.14, zft - 0.07), 0.008, 0.17, 0.045, DETAIL, 'carbon', pitch=-0.2)
    else: M.box((0, -sr + 0.03, zft + 0.0), wt * 0.97, 0.04, 0.018, DETAIL, 'dark')                 # the bumper lip under the tail
    wing = S.get('wing')
    if wing == 'roof': M.box((0, c1 - 0.12, S['H'] - S['sag'] + 0.012), halfw(c1) * S['cabw'] * S['tumble'] * 0.94, 0.09, 0.008, PAINT, pitch=-0.06)
    elif wing == 'duck': M.box((0, -sr + 0.09, S['zt'] + 0.035), wt * 0.92, 0.10, 0.02, PAINT, pitch=-0.42)
    elif wing == 'lip': M.box((0, -sr + 0.08, S['zt'] + 0.03), wt * 0.9, 0.07, 0.012, DETAIL, 'carbon', pitch=-0.25)
    elif wing in ('ped', 'gt'):
        hz = 0.17 if wing == 'ped' else 0.34; ws = -sr + (0.24 if wing == 'ped' else 0.14); wz = deck(ws) + hz; span = wt * (0.92 if wing == 'ped' else 1.04)
        M.box((0, ws, wz), span, 0.13 if wing == 'ped' else 0.16, 0.014, DETAIL if wing == 'gt' else PAINT, 'carbon' if wing == 'gt' else None, pitch=-0.12)
        for sx in (1, -1):
            M.box((sx * span * (0.55 if wing == 'ped' else 0.5), ws + 0.02, deck(ws) + hz / 2 - 0.02), 0.012, 0.06, hz / 2, DETAIL, 'black')
            if wing == 'gt': M.box((sx * span, ws, wz + 0.02), 0.008, 0.19, 0.075, DETAIL, 'carbon')
    if S.get('scoop'): M.box((0, lerp(c3, sf, 0.35), deck(lerp(c3, sf, 0.35)) + 0.03), 0.20, 0.26, 0.04, PAINT, taper=0.8); M.box((0, lerp(c3, sf, 0.35) + 0.262, deck(lerp(c3, sf, 0.35)) + 0.032), 0.16, 0.004, 0.026, DETAIL, 'black')
    if S.get('louvers'):
        for k in range(5):
            s = lerp(c0 + 0.1, c1 - 0.05, k / 4); o, dd = Vector((0, -s, 9)), Vector((0, 0, -1)); h = bvh.ray_cast(o, dd)
            if h[0] is not None: M.box((0, s, h[0].z + 0.014), halfw(s) * S['cabw'] * S['tumble'] * 0.8, 0.04, 0.005, DETAIL, 'black', pitch=-0.5)
    sm = lerp(c2, c3, 0.5)                                                                         # mirrors on stalks
    for sx in (1, -1):
        xm = halfw(sm) * S['cabw'] + 0.10; zm = belt(sm) + 0.085
        M.box((sx * (xm - 0.055), sm - 0.01, zm - 0.04), 0.055, 0.016, 0.011, DETAIL, 'black', pitch=0.3); M.box((sx * xm, sm - 0.02, zm), 0.034, 0.05, 0.036, PAINT, taper=0.8); M.box((sx * (xm - 0.012), sm - 0.071, zm), 0.026, 0.004, 0.028, DETAIL, 'black')
    for x in S.get('exhaust', (0.45, -0.45)): M.tube((x * wt, -sr + 0.02, zft + 0.035), 0.042 if len(S.get('exhaust', (1, 1))) < 4 else 0.034, 0.07, DETAIL, 'chrome')
    # ---- the objects ----
    M.bm.normal_update(); body = M.finish('body', mats); parts = ['body']
    for nm, Mx, m in (('lamp_head', L, m_head), ('lamp_tail', T, m_tail)):
        if len(Mx.bm.faces): o = Mx.finish(nm, [m]); o.parent = body; parts.append(nm)
    wheels = {}
    for nm, sw, sx in (('wheel_fl', S['wb'] / 2, 1), ('wheel_fr', S['wb'] / 2, -1), ('wheel_rl', -S['wb'] / 2, 1), ('wheel_rr', -S['wb'] / 2, -1)):
        o = build_wheel(S, nm, sx, mats); xw = wheel_x(S, P, sw); o.location = B(sx * xw, sw, S['R']); o.parent = body; parts.append(nm); wheels[nm] = [round(sx * xw, 3), round(S['R'], 3), round(sw, 3)]
    bpy.context.view_layer.update()
    tris = sum(len(p.vertices) - 2 for o in bpy.data.objects if o.type == 'MESH' for p in o.data.polygons)
    if OPT.get('dbg'): log('tris', {o.name: sum(len(q.vertices) - 2 for q in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH'})
    info.update({'len': round(sf + sr, 3), 'wid': round(S['W'], 3), 'h': round(S['H'], 3), 'L': round(S['wb'], 3), 'R': round(S['R'], 3), 'wheelX': round(abs(wheels['wheel_fl'][0]), 3), 'front': round(sf, 3), 'rear': round(sr, 3), 'tris': tris})
    return parts, info

# ---------------------------------------------------------------- the fleet: every number in metres. cab = where the cabin starts and ends (rear base, rear of roof, front of roof, base of the windscreen)
def car(id, paint, **k):
    S = dict(id=id, paint=paint, wb=2.6, of=0.85, orr=0.85, W=1.82, H=1.30, R=0.33, tw=0.24, clear=0.15, zn=0.62, zc=0.93, zd=0.95, zt=0.86, bulge=0.02, crown=0.05, nose_lift=0.10, tail_lift=0.15,
             pn=0.84, pt=0.88, cab=(-1.2, -0.5, 0.35, 1.0), cabw=0.86, tumble=0.80, sag=0.03, bp=0.4, tum=0.86, flare=(0.035, 0.045), scallop=0.015, crease=0.45, roofglass=False,
             head=dict(kind='slit'), tailL=dict(kind='slit'), rim=dict(kind='five', n=5), caliper='red')
    S.update(k); S.setdefault('hood', 0.014 + (0.022 if (S.get('hoodvent') or S.get('scoop')) else 0)); return S
FLEET = [
    # STREET
    car('kite', (0.9, 0.12, 0.03), wb=2.5, of=0.78, orr=0.66, W=1.74, H=1.42, R=0.31, tw=0.21, zn=0.70, zc=0.98, zd=1.02, zt=0.98, cab=(-1.52, -1.2, 0.3, 1.05), cabw=0.88, tumble=0.84, bp=0.52, pt=0.9, pn=0.86,
        head=dict(kind='tri', x0=0.42, h=0.13, z=0.72, rise=0.03), tailL=dict(kind='vert', z=0.72, h=0.10, w=0.12), grille=(0.42, 0.28, 0.5, 0.9), intake=(0.55, 0.9, 0.12), rim=dict(kind='multi', n=10), exhaust=(0.5,), wing='roof', mouth=(0.5, 0.14), valance=1),
    car('pixel', (0.95, 0.75, 0.08), wb=2.3, of=0.62, orr=0.5, W=1.62, H=1.50, R=0.29, tw=0.19, zn=0.80, zc=1.0, zd=1.04, zt=1.04, cab=(-1.45, -1.28, 0.42, 0.96), cabw=0.9, tumble=0.9, bp=0.5, pt=0.94, pn=0.92, crown=0.035, flare=(0.02, 0.02),
        head=dict(kind='round', r=0.085, n=1, z=0.62), tailL=dict(kind='rect', h=0.09, x0=0.6, z=0.7), grille=(0.34, 0.5, 0.72, 1.0), rim=dict(kind='steel', n=6, col='white'), exhaust=(0.55,), caliper='gun', mouth=(0.6, 0.1)),
    car('moth', (0.2, 0.75, 0.6), wb=2.45, of=0.82, orr=0.8, W=1.72, H=1.28, R=0.31, tw=0.21, zn=0.60, zc=0.90, zd=0.93, zt=0.84, cab=(-1.25, -0.5, 0.3, 0.98), bp=0.3,
        head=dict(kind='round', r=0.07, n=2, z=0.7), tailL=dict(kind='round', r=0.065, n=2, z=0.66), grille=(0.3, 0.2, 0.42, 0.8), rim=dict(kind='five', n=5), wing='duck'),
    car('rascal', (0.25, 0.4, 0.95), wb=2.52, of=0.8, orr=0.68, W=1.78, H=1.40, R=0.33, tw=0.23, clear=0.19, zn=0.72, zc=0.99, zd=1.02, zt=0.98, cab=(-1.5, -1.22, 0.28, 1.02), cabw=0.88, bp=0.52, flare=(0.06, 0.06), scallop=0.0,
        head=dict(kind='rect', h=0.10, x0=0.5, z=0.7), tailL=dict(kind='vert', z=0.7, h=0.09, w=0.1), grille=(0.45, 0.3, 0.55, 0.92), intake=(0.5, 0.92, 0.14), hoodvent=1, rim=dict(kind='split', n=5, col='white'), wing='roof', splitter=1, skirts=1, valance=1,
        stripes=dict(at=[(-0.09, 0.09)], col='white'), caliper='yellow'),
    # MUSCLE
    car('vandal', (0.75, 0.04, 0.05), wb=2.85, of=0.95, orr=1.0, W=1.92, H=1.32, R=0.35, tw=0.27, zn=0.76, zc=0.97, zd=0.96, zt=0.90, cab=(-1.75, -0.55, 0.25, 0.8), bp=0.3, pn=0.93, pt=0.93, bulge=0.035, flare=(0.035, 0.06), crease=0.6,
        head=dict(kind='round', r=0.08, n=2, z=0.68, x1=0.9), tailL=dict(kind='rect', h=0.08, x0=0.3, z=0.72), tailpanel=1, grille=(0.5, 0.42, 0.78, 1.0), scoop=1, rim=dict(kind='five', n=5, col='gun'), wing='duck',
        stripes=dict(at=[(0.07, 0.22), (-0.22, -0.07)], col='black'), louvers=1),
    car('brute', (0.1, 0.1, 0.11), wb=2.95, of=0.98, orr=1.05, W=1.96, H=1.36, R=0.36, tw=0.28, zn=0.80, zc=1.0, zd=0.98, zt=0.94, cab=(-1.5, -0.9, 0.2, 0.75), bp=0.42, pn=0.95, pt=0.95, bulge=0.03, flare=(0.03, 0.05), crease=0.7, tumble=0.84,
        head=dict(kind='slit', h=0.07, x0=0.5, z=0.74), tailL=dict(kind='bar', h=0.06, z=0.74), grille=(0.86, 0.3, 0.62, 1.0), intake=(0.2, 0.8, 0.1), hoodvent=1, rim=dict(kind='split', n=5, col='gloss'), exhaust=(0.6, 0.45, -0.45, -0.6), wing='lip'),
    car('anvil', (0.85, 0.42, 0.05), wb=2.75, of=0.9, orr=1.08, W=1.9, H=1.30, R=0.35, tw=0.27, zn=0.72, zc=0.95, zd=0.9, zt=0.88, cab=(-1.2, -0.75, 0.15, 0.72), bp=0.35, pn=0.9, pt=0.92, bulge=0.04, flare=(0.04, 0.07),
        head=dict(kind='rect', h=0.09, x0=0.62, z=0.66), tailL=dict(kind='round', r=0.07, n=2, z=0.7), tailpanel=1, grille=(0.55, 0.35, 0.7, 0.95), scoop=1, rim=dict(kind='dish', n=5, col='chrome'), wing='ped', skirts=1),
    car('howl', (0.3, 0.05, 0.5), wb=2.9, of=0.96, orr=0.98, W=1.98, H=1.26, R=0.36, tw=0.29, zn=0.70, zc=0.93, zd=0.93, zt=0.9, cab=(-1.85, -0.5, 0.2, 0.82), bp=0.3, pn=0.9, pt=0.9, bulge=0.03, flare=(0.05, 0.08), crease=0.6, clear=0.13,
        head=dict(kind='slit', h=0.05, x0=0.3, z=0.8, rise=0.02), tailL=dict(kind='bar', h=0.05, z=0.8), grille=(0.75, 0.2, 0.55, 0.9), intake=(0.55, 0.95, 0.13), hoodvent=1, rim=dict(kind='turbine', n=7, col='gun'), exhaust=(0.55, 0.4, -0.4, -0.55),
        wing='duck', splitter=1, skirts=1, diffuser=4, caliper='yellow'),
    # SPORT
    car('aria', (0.1, 0.55, 0.95), wb=2.6, of=0.9, orr=0.85, W=1.85, H=1.24, R=0.33, tw=0.25, clear=0.13, zn=0.56, zc=0.87, zd=0.9, zt=0.84, cab=(-1.35, -0.42, 0.28, 1.02), bp=0.3, pn=0.82, flare=(0.045, 0.06),
        head=dict(kind='slit', h=0.055, x0=0.4, z=0.74, rise=0.035), tailL=dict(kind='slit', h=0.05, x0=0.2, z=0.76), grille=(0.5, 0.12, 0.4, 0.8), intake=(0.6, 0.93, 0.12), rim=dict(kind='split', n=5), wing='ped', splitter=1, skirts=1, diffuser=3),
    car('sylph', (0.92, 0.92, 0.9), wb=2.45, of=0.82, orr=0.72, W=1.76, H=1.2, R=0.32, tw=0.23, clear=0.12, zn=0.54, zc=0.84, zd=0.86, zt=0.8, cab=(-1.0, -0.42, 0.22, 0.9), bp=0.3, pn=0.8, pt=0.86, flare=(0.05, 0.06), scallop=0.03,
        head=dict(kind='round', r=0.07, n=1, z=0.8), tailL=dict(kind='round', r=0.06, n=2, z=0.7), grille=(0.38, 0.1, 0.36, 0.75), rim=dict(kind='multi', n=12), exhaust=(0.12, -0.12), wing='duck', caliper='yellow'),
    car('riptide', (0.05, 0.6, 0.55), wb=2.7, of=0.92, orr=0.88, W=1.88, H=1.26, R=0.34, tw=0.26, clear=0.13, zn=0.58, zc=0.9, zd=0.92, zt=0.88, cab=(-1.6, -0.35, 0.3, 1.05), bp=0.28, pn=0.82, flare=(0.05, 0.075), crease=0.6,
        head=dict(kind='tri', h=0.12, x0=0.5, z=0.74, rise=0.04), tailL=dict(kind='bar', h=0.045, z=0.82), grille=(0.6, 0.1, 0.38, 0.7), intake=(0.62, 0.95, 0.15), hoodvent=1, sidevent=1, rim=dict(kind='turbine', n=9), wing='gt', splitter=1, skirts=1, diffuser=4),
    car('onyx', (0.06, 0.06, 0.07), wb=2.72, of=0.88, orr=0.84, W=1.9, H=1.25, R=0.34, tw=0.26, clear=0.13, zn=0.6, zc=0.9, zd=0.94, zt=0.88, cab=(-1.3, -0.5, 0.35, 1.08), bp=0.42, pn=0.85, flare=(0.04, 0.05), roofglass=True,
        head=dict(kind='slit', h=0.04, x0=0.25, z=0.82, rise=0.02), tailL=dict(kind='vert', z=0.72, h=0.12, w=0.06), grille=(0.45, 0.15, 0.5, 0.85), intake=(0.55, 0.95, 0.1), rim=dict(kind='five', n=5, col='bronze'), exhaust=(0.5, 0.36, -0.36, -0.5), wing='lip', skirts=1, diffuser=3),
    # GRAND TOURER
    car('regent', (0.05, 0.2, 0.12), wb=2.95, of=0.95, orr=1.05, W=1.96, H=1.34, R=0.36, tw=0.27, zn=0.70, zc=0.96, zd=0.97, zt=0.9, cab=(-1.45, -0.7, 0.2, 0.86), bp=0.4, pn=0.86, pt=0.86, bulge=0.03, crease=0.35, flare=(0.035, 0.05), tumble=0.82,
        head=dict(kind='round', r=0.085, n=2, z=0.72, x1=0.9), tailL=dict(kind='vert', z=0.66, h=0.1, w=0.08), grille=(0.42, 0.25, 0.8, 0.8), rim=dict(kind='multi', n=14, col='chrome'), exhaust=(0.5, -0.5), caliper='gun'),
    car('nocturne', (0.12, 0.1, 0.3), wb=2.85, of=0.92, orr=0.98, W=1.94, H=1.28, R=0.35, tw=0.27, clear=0.14, zn=0.62, zc=0.92, zd=0.94, zt=0.86, cab=(-1.85, -0.3, 0.2, 0.92), bp=0.3, pn=0.82, pt=0.84, bulge=0.03, flare=(0.045, 0.065),
        head=dict(kind='slit', h=0.05, x0=0.35, z=0.78, rise=0.025), tailL=dict(kind='bar', h=0.035, z=0.84), grille=(0.55, 0.15, 0.55, 0.75), intake=(0.62, 0.95, 0.11), rim=dict(kind='split', n=6, col='gun'), exhaust=(0.52, 0.4, -0.4, -0.52), skirts=1, diffuser=3),
    car('solace', (0.7, 0.72, 0.75), wb=2.8, of=1.0, orr=0.9, W=1.9, H=1.26, R=0.35, tw=0.26, clear=0.14, zn=0.6, zc=0.9, zd=0.9, zt=0.84, cab=(-1.15, -0.55, 0.1, 0.72), bp=0.3, pn=0.8, pt=0.84, bulge=0.04, flare=(0.05, 0.07), scallop=0.03,
        head=dict(kind='round', r=0.075, n=1, z=0.86), tailL=dict(kind='slit', h=0.05, x0=0.35, z=0.78), grille=(0.3, 0.1, 0.5, 0.6), sidevent=0, hoodvent=1, rim=dict(kind='five', n=5, col='chrome'), exhaust=(0.14, -0.14), wing='duck'),
    car('harbinger', (0.45, 0.06, 0.08), wb=3.0, of=0.98, orr=1.02, W=2.0, H=1.3, R=0.37, tw=0.29, clear=0.14, zn=0.66, zc=0.94, zd=0.95, zt=0.9, cab=(-1.7, -0.6, 0.15, 0.84), bp=0.36, pn=0.88, pt=0.88, bulge=0.035, flare=(0.05, 0.08), crease=0.65,
        head=dict(kind='rect', h=0.07, x0=0.55, z=0.78, rise=0.02), tailL=dict(kind='slit', h=0.06, x0=0.25, z=0.78), tailpanel=1, grille=(0.8, 0.12, 0.6, 0.85), intake=(0.3, 0.9, 0.09), hoodvent=1, rim=dict(kind='turbine', n=8, col='gloss'),
        exhaust=(0.58, 0.44, -0.44, -0.58), wing='ped', splitter=1, skirts=1, diffuser=4, stripes=dict(at=[(-0.3, -0.22), (0.22, 0.3)], col='gloss')),
    # SUPER
    car('halo', (0.95, 0.5, 0.02), wb=2.7, of=1.0, orr=0.9, W=1.98, H=1.13, R=0.34, tw=0.28, clear=0.11, zn=0.46, zc=0.74, zd=0.88, zt=0.86, cab=(-1.3, 0.05, 0.6, 1.35), bp=0.5, cabw=0.82, tumble=0.74, pn=0.78, pt=0.9, flare=(0.06, 0.08), scallop=0.05, crease=0.6, nose_lift=0.05,
        head=dict(kind='slit', h=0.045, x0=0.45, z=0.86, rise=0.03), tailL=dict(kind='bar', h=0.035, z=0.86), grille=(0.5, 0.1, 0.5, 0.6), intake=(0.6, 0.95, 0.13), sidevent=1, rim=dict(kind='split', n=5, col='gun'), exhaust=(0.1, -0.1), wing='gt', splitter=1, skirts=1, diffuser=5, caliper='yellow'),
    car('vortex', (0.4, 0.9, 0.1), wb=2.65, of=1.02, orr=0.82, W=2.0, H=1.1, R=0.34, tw=0.29, clear=0.1, zn=0.42, zc=0.72, zd=0.9, zt=0.88, cab=(-1.0, 0.1, 0.62, 1.42), bp=0.5, cabw=0.8, tumble=0.72, pn=0.76, pt=0.92, flare=(0.065, 0.085), scallop=0.06, crease=0.75, nose_lift=0.04,
        head=dict(kind='tri', h=0.1, x0=0.5, z=0.88, rise=0.02), tailL=dict(kind='slit', h=0.04, x0=0.3, z=0.84, rise=0.03), tailpanel=1, intake=(0.25, 0.95, 0.12), sidevent=1, hoodvent=1, rim=dict(kind='turbine', n=10, col='gloss'), exhaust=(0.2, 0.0, -0.2),
        wing='ped', splitter=1, skirts=1, diffuser=5, roofglass=True),
    car('siren', (0.85, 0.05, 0.3), wb=2.75, of=0.98, orr=0.95, W=1.96, H=1.15, R=0.35, tw=0.28, clear=0.11, zn=0.48, zc=0.76, zd=0.86, zt=0.82, cab=(-1.75, -0.1, 0.5, 1.3), bp=0.45, cabw=0.83, tumble=0.76, pn=0.78, pt=0.86, flare=(0.06, 0.08), scallop=0.045, nose_lift=0.05,
        head=dict(kind='round', r=0.06, n=2, z=0.84), tailL=dict(kind='round', r=0.065, n=2, z=0.74), grille=(0.4, 0.08, 0.45, 0.6), intake=(0.55, 0.95, 0.12), sidevent=1, rim=dict(kind='five', n=5, col='chrome'), exhaust=(0.5, 0.38, -0.38, -0.5),
        wing='duck', splitter=1, skirts=1, diffuser=4),
    car('apex', (0.93, 0.93, 0.95), wb=2.8, of=1.05, orr=0.9, W=2.02, H=1.06, R=0.35, tw=0.3, clear=0.09, zn=0.40, zc=0.68, zd=0.82, zt=0.84, cab=(-0.85, 0.15, 0.6, 1.5), bp=0.5, cabw=0.74, tumble=0.72, pn=0.74, pt=0.94, flare=(0.08, 0.09), scallop=0.07, crease=0.8, nose_lift=0.03, tail_lift=0.2,
        head=dict(kind='vert', h=0.07, w=0.06, z=0.7, x1=0.9), tailL=dict(kind='bar', h=0.03, z=0.9), intake=(0.2, 0.95, 0.1), sidevent=1, rim=dict(kind='multi', n=10, col='gloss', size=0.74), exhaust=(0.0,),
        wing='gt', splitter=1, skirts=1, diffuser=6, stripes=dict(at=[(-0.06, 0.06)], col='blue'), caliper='blue'),
]

# ---------------------------------------------------------------- pictures to look at (not part of the game)
def preview(S, tag):
    for nm in ('pv_cam', 'pv_sun', 'pv_fill', 'pv_floor'):
        o = bpy.data.objects.get(nm)
        if o: bpy.data.objects.remove(o, do_unlink=True)
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 20; scene.cycles.use_denoising = False; scene.render.resolution_x = int(OPT.get('res', 448)); scene.render.resolution_y = int(OPT.get('res', 448)) * 9 // 16; scene.render.film_transparent = False
    w = scene.world or bpy.data.worlds.new('w'); scene.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.10, 0.12, 0.16, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
    me = bpy.data.meshes.new('pv_floor'); me.from_pydata([(-30, -30, 0), (30, -30, 0), (30, 30, 0), (-30, 30, 0)], [], [(0, 1, 2, 3)]); fl = bpy.data.objects.new('pv_floor', me); scene.collection.objects.link(fl)
    fm = bpy.data.materials.new('pv_floor'); fm.use_nodes = True; b = next(n for n in fm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'); b.inputs['Base Color'].default_value = (0.06, 0.06, 0.07, 1); b.inputs['Roughness'].default_value = 0.35; me.materials.append(fm)
    sun = bpy.data.objects.new('pv_sun', bpy.data.lights.new('pv_sun', 'SUN')); sun.data.energy = 3.0; sun.rotation_euler = (math.radians(50), 0, math.radians(35)); scene.collection.objects.link(sun)
    fill = bpy.data.objects.new('pv_fill', bpy.data.lights.new('pv_fill', 'AREA')); fill.data.energy = 900; fill.data.size = 6; fill.location = (-4, -5, 4); scene.collection.objects.link(fill)
    cam = bpy.data.objects.new('pv_cam', bpy.data.cameras.new('pv_cam')); cam.data.lens = 55; scene.collection.objects.link(cam); scene.camera = cam
    out = []
    for k, (ax, ay, az) in enumerate(((4.2, -5.6, 1.7), (-4.4, 5.4, 2.0))):      # front three-quarter (the nose is at -Y), rear three-quarter
        cam.location = (ax, ay, az); d = Vector((0, 0, 0.55)) - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        p = os.path.join(PRE, '%s_%d.png' % (S['id'], k)); scene.render.filepath = p; bpy.ops.render.render(write_still=True); out.append(p)
    for nm in ('pv_cam', 'pv_sun', 'pv_fill', 'pv_floor'): bpy.data.objects.remove(bpy.data.objects[nm], do_unlink=True)
    return out
def sheet(paths, name, cols=4):
    ims = [bpy.data.images.load(p) for p in paths]; w, h = ims[0].size; rows = (len(ims) + cols - 1) // cols; A = np.zeros((rows * h, cols * w, 4), np.float32); A[..., 3] = 1
    for i, im in enumerate(ims):
        a = np.empty(w * h * 4, np.float32); im.pixels.foreach_get(a); r, c = i // cols, i % cols; A[(rows - 1 - r) * h:(rows - r) * h, c * w:(c + 1) * w] = a.reshape(h, w, 4)
    o = bpy.data.images.new(name, cols * w, rows * h); o.pixels.foreach_set(A.ravel()); o.filepath_raw = os.path.join(PRE, name + '.png'); o.file_format = 'PNG'; o.save(); log('sheet', o.filepath_raw)

only = OPT.get('only', '').split(',') if OPT.get('only') else None; INFO = {}; shots = [[], []]
JS = os.path.join(ROOT, 'Nightline', 'src', 'js', '27-fleetdata.js'); KEEP = os.path.join(BASE, 'fleet.json')
if os.path.exists(KEEP): INFO = json.load(open(KEEP))
for S in FLEET:
    if only and S['id'] not in only: continue
    parts, info = build(S); INFO[S['id']] = info
    path = os.path.join(BASE, 'car_%s.blend' % S['id'])
    if OPT.get('preview'):
        for k, p in enumerate(preview(S, S['id'])): shots[k].append(p)
    bpy.ops.wm.save_as_mainfile(filepath=path, copy=True)
    with open(os.path.join(BASE, 'car_%s.export.json' % S['id']), 'w') as f: json.dump({'blend': 'car_%s.blend' % S['id'], 'out': '../../../Nightline/assets/car_%s' % S['id'], 'parts': parts, 'maxTexture': 64}, f, indent=1)
    log(S['id'], info['tris'], 'triangles', 'len %.2f' % info['len'], 'head', info['head'][:1], 'tail', info['tail'][:1])
json.dump(INFO, open(KEEP, 'w'), indent=1)
ids = [S['id'] for S in FLEET if S['id'] in INFO]
with open(JS, 'w', newline='\n') as f:
    f.write('// MADE BY tools/blender/make_nl_cars.py: do not edit. What each car model measures (metres; x left, y up, z forward; the ground at y = 0).\n')
    f.write('const FLEET = ' + json.dumps({i: INFO[i] for i in ids}, separators=(',', ':')).replace('},"', '},\n    "') + ';\n')
if OPT.get('preview') and shots[0]: sheet(shots[0], 'sheet_front' + ('_' + OPT['only'].replace(',', '_') if only else '')); sheet(shots[1], 'sheet_rear' + ('_' + OPT['only'].replace(',', '_') if only else ''))
log('export with:  node tools/export-art.mjs ' + ' '.join('car_' + i for i in (only or ids)))
