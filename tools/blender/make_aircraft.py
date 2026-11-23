# Steel Storm Remastered: the air line, four aircraft each exported to its own small file, in art/steelstorm/aircraft.blend.
#   blender -b art/steelstorm/aircraft.blend -P tools/blender/make_aircraft.py -- [only=ftr,heli] [preview]   (first time: --factory-startup)
# then  node tools/export-art.mjs a_ftr a_atk a_bmb a_heli  ->  Steel Storm Remastered/assets/a_<id>.hgm
# Built like the ground vehicles (make_vehicles.py: same texturing, same part split): <id>_hull (+ for the helicopter <id>_turret = the main
# rotor, pivot on the mast top, spun about its vertical axis, and <id>_barrel = the chin gun, parented to the HULL so it does not spin),
# each with a _lod1 twin; forward -Y; origin at the centre of mass (solid volume of the whole aircraft); wheels up; neutral grey paint.
import bpy, bmesh, math, os, sys, json, random
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hgkit import *

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OPT = dict((a.split('=', 1) + ['1'])[:2] for a in ARGV)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = os.path.join(ROOT, 'art', 'steelstorm'); TEXDIR = os.path.join(BASE, 'tex'); CACHE = os.path.join(BASE, '_cache')
for d in (TEXDIR, CACHE): os.makedirs(d, exist_ok=True)
scene = bpy.context.scene
if not bpy.data.filepath.replace('\\', '/').endswith('art/steelstorm/aircraft.blend'):
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    scene.render.fps = 30; bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, 'aircraft.blend')); log('created', bpy.data.filepath)
TEXN_V = {}; BARREL_ON_HULL = {'heli'}

# ---------------------------------------------------------------- copied from make_valley.py
TANK_BASE = (0.50, 0.52, 0.53)                  # neutral grey
def tank_texture(ob, N, name):
    me = ob.data; me.calc_loop_triangles(); nt = len(me.loop_triangles)
    tl = np.empty(nt * 3, np.int64); me.loop_triangles.foreach_get('loops', tl); tl = tl.reshape(-1, 3)
    tp = np.empty(nt, np.int64); me.loop_triangles.foreach_get('polygon_index', tp)
    lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get('vertex_index', lv)
    co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    uv = np.empty(len(me.loops) * 2, np.float32); me.uv_layers['UVMap'].data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
    fn = np.empty(len(me.polygons) * 3, np.float32); me.polygons.foreach_get('normal', fn); fn = fn.reshape(-1, 3)
    cl = np.empty(len(me.polygons), np.int64); me.attributes['cls'].data.foreach_get('value', cl)
    bv = np.empty(len(me.polygons), np.int64); me.attributes['bev'].data.foreach_get('value', bv)
    rep = lambda a: np.repeat(a[tp].astype(np.float32)[:, None, None], 3, 1)
    mask, (Pi, Ni, Ci, Bi) = raster(uv[tl], [co[lv[tl]], np.repeat(fn[tp][:, None, :], 3, 1), rep(cl), rep(bv)], N)
    bvh = BVHTree.FromPolygons([Vector(c) for c in co], [list(p.vertices) for p in me.polygons])
    rng = np.random.default_rng(5); NR = 12; u1, u2 = rng.random(NR), rng.random(NR)
    dirs = np.stack([np.sqrt(u1) * np.cos(2 * np.pi * u2), np.sqrt(u1) * np.sin(2 * np.pi * u2), np.sqrt(1 - u1)], 1)
    aoh = np.ones((N, N), np.float32); sub = mask.copy(); sub[1::2, :] = False; sub[:, 1::2] = False
    for y, x in zip(*np.nonzero(sub)):
        n = Vector(Ni[y, x])
        if n.length < 1e-6: continue
        n.normalize(); t = n.orthogonal().normalized(); b2 = n.cross(t); o = Vector(Pi[y, x]) + n * 0.004; occ = 0.0
        for d in dirs:
            h = bvh.ray_cast(o, t * d[0] + b2 * d[1] + n * d[2], 0.6)
            if h[0] is not None: occ += 1 - h[3] / 0.6
        aoh[y, x] = 1 - occ / NR
    ao = aoh.copy(); ys, xs = np.nonzero(mask & ~sub); ao[ys, xs] = aoh[(ys // 2) * 2, (xs // 2) * 2]
    ao = 0.25 * (ao + np.roll(ao, 1, 0) + np.roll(ao, 1, 1) + np.roll(np.roll(ao, 1, 0), 1, 1))
    idx = np.nonzero(mask); P = Pi[idx]; C = np.rint(Ci[idx][:, 0]).astype(int); B = Bi[idx][:, 0] > 0.5
    pal = {CLS.index('olive'): TANK_BASE, CLS.index('rubber'): (0.16, 0.16, 0.15), CLS.index('steel'): (0.38, 0.38, 0.37), CLS.index('dark'): (0.06, 0.06, 0.06),
           CLS.index('bright'): (0.55, 0.55, 0.53), CLS.index('wood'): (0.40, 0.30, 0.20)}
    base = np.array([pal.get(c, TANK_BASE) for c in C], np.float32)
    grain = fbm(P, 0.03, 3); mott = fbm(P, 0.6, 9); fine = vnoise(P, 0.01, 17)
    col_ = base * (0.92 + 0.16 * grain[:, None]) * (0.92 + 0.16 * mott[:, None])
    under = Ni[idx][:, 2] < -0.35; col_[under] *= 1.15                                   # aircraft: lighter belly, no ground dirt
    panel = (np.abs(np.mod(P[:, 1] + 0.37, 0.9) - 0.45) < 0.008) | (np.abs(np.mod(P[:, 0] + 0.21, 1.1) - 0.55) < 0.008)
    paint = C == CLS.index('olive'); col_[paint & panel] *= 0.7
    rivet = paint & (np.abs(np.mod(P[:, 1] + 0.37, 0.9) - 0.45) < 0.03) & (np.mod(P[:, 0] * 10 + P[:, 2] * 10, 1.0) < 0.15); col_[rivet] *= 1.12
    wear = B * (0.4 + 0.3 * grain); col_ = col_ * (1 - wear[:, None]) + np.array((0.62, 0.61, 0.58), np.float32) * wear[:, None]
    streak = vnoise(P * np.array((1, 1, 0.12), np.float32), 0.05, 31); col_[paint] *= (0.9 + 0.12 * streak[paint])[:, None]
    col_ *= (0.35 + 0.65 * np.clip(ao[idx], 0, 1) ** 1.3)[:, None]
    col_ = np.clip(col_, 0.04, 1); img = np.zeros((N, N, 3), np.float32); img[idx] = col_; filled = mask.copy()
    for it in range(6):
        acc = np.zeros_like(img); cnt = np.zeros((N, N), np.float32)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            acc += np.roll(np.roll(img * filled[..., None], dy, 0), dx, 1); cnt += np.roll(np.roll(filled, dy, 0), dx, 1)
        new = (~filled) & (cnt > 0); img[new] = acc[new] / cnt[new][:, None]; filled |= new
    img[~filled] = 0.3
    return save_image(img, name, TEXDIR)
def wheel(k, x, y, z, r, w, cls='olive', grp='gun'):
    k.lathe([(0.0, -w / 2), (r * 0.35, -w / 2 - 0.02), (r * 0.9, -w / 2), (r, -w / 2 + 0.03), (r, w / 2 - 0.03), (r * 0.9, w / 2), (r * 0.35, w / 2 + 0.02), (0.0, w / 2)],
            T(x, y, z) @ Rz(90), 14, cls, grp)
def track_side(k, sx, x0, x1, y0, y1, z0, z1, nw, rw, grp='gun'):
    k.prism([(y0, (z0 + z1) / 2), (y0 + 0.25, z0), (y1 - 0.25, z0), (y1, (z0 + z1) / 2), (y1 - 0.2, z1), (y0 + 0.2, z1)], sx * x0, sx * x1, 'rubber', grp, bev=0.03)
    for i in range(int((y1 - y0) / 0.16)):
        yy = y0 + 0.3 + i * 0.16
        if yy > y1 - 0.3: break
        k.box((sx * (x0 + x1) / 2, yy, z0 + 0.02), (abs(x1 - x0) + 0.02, 0.06, 0.05), 'rubber', grp, bev=0.0)
    for i in range(nw):
        yy = y0 + 0.55 + i * (y1 - y0 - 1.1) / max(1, nw - 1); wheel(k, sx * (max(abs(x0), abs(x1)) - 0.06), yy, z0 + rw, rw, 0.22)
    wheel(k, sx * (max(abs(x0), abs(x1)) + 0.03), y0 + 0.28, (z0 + z1) / 2 + 0.05, rw * 0.75, 0.2, 'steel'); wheel(k, sx * (max(abs(x0), abs(x1)) + 0.03), y1 - 0.28, (z0 + z1) / 2 + 0.05, rw * 0.7, 0.2, 'steel')
def make_tank(prefix, model, col):
    k, TP, TR = model()
    me = bpy.data.meshes.new(prefix + '_all'); k.bm.to_mesh(me); k.bm.free()
    ob = bpy.data.objects.new(prefix + '_all', me); col.objects.link(ob); smart_uv(ob, 66, 0.003)
    img = tank_texture(ob, TEXN_V.get(prefix, 1024), prefix + '_skin'); mat = image_material(prefix + '_skin', img, 0.6, 0.3)
    g = np.empty(len(me.vertices), np.int64); me.attributes['grp'].data.foreach_get('value', g)
    parts = {}
    for part, gi, pivot in (('hull', GRP.index('gun'), Vector((0, 0, 0))), ('turret', GRP.index('mag'), TP), ('barrel', GRP.index('bolt'), TR)):
        if not (g == gi).any(): continue          # a vehicle without a turret or gun (the truck)
        b2 = bmesh.new(); b2.from_mesh(me); b2.verts.ensure_lookup_table()
        bmesh.ops.delete(b2, geom=[v for v in b2.verts if g[v.index] != gi], context='VERTS')
        bmesh.ops.translate(b2, verts=b2.verts[:], vec=-pivot)
        pm = bpy.data.meshes.new('%s_%s' % (prefix, part)); b2.to_mesh(pm); b2.free(); pm.materials.append(mat)
        po = bpy.data.objects.new('%s_%s' % (prefix, part), pm); col.objects.link(po); parts[part] = (po, pivot)
        lo = bpy.data.objects.new('%s_%s_lod1' % (prefix, part), pm.copy()); col.objects.link(lo); lo.data.name = lo.name
        dm = lo.modifiers.new('d', 'DECIMATE'); dm.ratio = 0.2
        dg = bpy.context.evaluated_depsgraph_get(); lme = bpy.data.meshes.new_from_object(lo.evaluated_get(dg)); lo.modifiers.clear(); old = lo.data; lo.data = lme; bpy.data.meshes.remove(old)
        lme.name = lo.name; parts[part + '_lod1'] = (lo, pivot)
    hull = parts['hull'][0]; turret = parts.get('turret', (None,))[0]; barrel = parts.get('barrel', (None,))[0]
    if turret: turret.parent = hull; turret.location = TP
    if barrel:
        on_t = turret is not None and prefix not in BARREL_ON_HULL; barrel.parent = turret if on_t else hull; barrel.location = TR - (TP if on_t else Vector())
    for part in [p for p in ('hull', 'turret', 'barrel') if p in parts]:
        lo = parts[part + '_lod1'][0]; lo.parent = parts[part][0]; lo.location = (0, 0, 0)
    bpy.data.objects.remove(ob, do_unlink=True); bpy.data.meshes.remove(me)
    muzzle = (TR + Vector((0, min(v.co.y for v in barrel.data.vertices), 0))) if barrel else None
    hv = [v.co for v in hull.data.vertices]; top = max(v.z for v in hv)
    if turret: top = max([top] + [v.co.z + TP.z for v in turret.data.vertices])
    info = {'tris': {p: sum(len(f.vertices) - 2 for f in parts[p][0].data.polygons) for p in parts}, 'muzzle': tuple(round(x, 3) for x in muzzle) if muzzle else None,
            'half_width': round(max(abs(v.x) for v in hv), 3), 'half_length': round(max(abs(v.y) for v in hv), 3), 'height': round(top, 3),
            'turret_pivot': tuple(round(x, 3) for x in TP) if turret else None, 'trunnion': tuple(round(x, 3) for x in TR) if barrel else None}
    log(prefix, info)
    return info


# ---------------------------------------------------------------- the aircraft (metres, forward -Y, z up; origin moved to the centre of mass)
AF = [(0.0, 0.0), (0.04, 0.45), (0.15, 0.85), (0.35, 1.0), (0.65, 0.7), (1.0, 0.06), (1.0, -0.06), (0.65, -0.35), (0.35, -0.5), (0.15, -0.45), (0.04, -0.25)]
def loft(k, secs, cls='olive', grp='gun', vertical=False):
    """airfoil sections [(s, y_le, h, chord, thick)] across x at height h (wings), or (vertical) up z at side offset h (fins); leading edge to -Y"""
    b = set(k.bm.faces); rings = []
    for s_, yle, h, c, t in secs:
        if vertical: rings.append([k.bm.verts.new((h + v * t, yle + u * c, s_)) for u, v in AF])
        else: rings.append([k.bm.verts.new((s_, yle + u * c, h + v * t)) for u, v in AF])
    n = len(AF)
    for A, B in zip(rings, rings[1:]):
        for j in range(n): q = (j + 1) % n; k.bm.faces.new((A[j], A[q], B[q], B[j]))
    k.bm.faces.new(rings[0]); k.bm.faces.new(rings[-1][::-1])
    faces = list(set(k.bm.faces) - b); bmesh.ops.recalc_face_normals(k.bm, faces=faces)
    return k._finish(b, cls, grp, (), False)
def wings(k, root, tip, cls='olive', grp='gun', mid=None):
    for sx in (-1, 1): loft(k, [(sx * s, y, h, c, t) for (s, y, h, c, t) in [root] + ([mid] if mid else []) + [tip]], cls, grp)
def disc(k, x, y, z, r, cls='dark', grp='gun', segs=16):
    k.lathe([(0.0, y - 0.01), (r, y - 0.01), (r, y + 0.01), (0.0, y + 0.01)], T(x, 0, z), segs, cls, grp, smooth=False)
RAW = {}
def model_ftr():
    k = Kit(1); S = Matrix.Diagonal((1.0, 1.0, 1.1, 1.0))
    k.lathe([(0.0, -7.6), (0.12, -7.3), (0.3, -6.8), (0.45, -6.1), (0.6, -5.3), (0.72, -4.4), (0.84, -3.0), (0.9, -1.2), (0.92, 0.8), (0.9, 3.0), (0.84, 4.8), (0.76, 6.2), (0.66, 7.0), (0.62, 7.3)], S, 20, 'olive')
    k.lathe([(0.0, 7.2), (0.47, 7.2), (0.47, 7.7), (0.6, 7.7), (0.63, 7.0)], None, 20, 'dark')
    k.lathe([(0.0, -4.8), (0.2, -4.5), (0.36, -4.0), (0.43, -3.3), (0.42, -2.5), (0.32, -1.8), (0.0, -1.3)], T(0, 0, 0.66) @ Matrix.Diagonal((1, 1, 1.25, 1)), 14, 'dark')
    k.box((0, -2.2, 1.18), (0.06, 0.12, 0.08), 'bright', bev=0.0)
    for sx in (-1, 1):
        k.prism([(-3.5, -0.55), (-3.5, 0.35), (-1.0, 0.5), (1.5, 0.35), (2.2, -0.45)], sx * 0.7, sx * 1.15, 'olive', bev=0.03)
        k.box((sx * 0.93, -3.52, -0.1), (0.36, 0.04, 0.8), 'dark', bev=0.0)
    wings(k, (0.7, -1.6, -0.2, 4.6, 0.2), (4.75, 2.3, -0.3, 1.3, 0.06), mid=(2.7, 0.4, -0.25, 3.0, 0.13))
    wings(k, (0.5, 4.6, 0.05, 2.2, 0.09), (2.7, 6.3, 0.0, 0.9, 0.04))
    loft(k, [(0.7, 3.4, 0.0, 3.4, 0.11), (2.0, 4.7, 0.0, 2.4, 0.08), (3.3, 6.0, 0.0, 1.3, 0.05)], vertical=True)
    for sx in (-1, 1): loft(k, [(-0.3, 4.4, sx * 0.55, 1.8, 0.05), (-1.1, 5.4, sx * 0.75, 0.9, 0.03)], vertical=True)      # ventral fins
    k.lathe([(0.0, -4.2), (0.055, -4.2), (0.055, -5.5), (0.0, -5.5)], T(0.55, 0, -0.35), 8, 'dark')
    for sx in (-1, 1):
        k.box((sx * 3.0, 0.6, -0.42), (0.1, 1.6, 0.26), 'olive', bev=0.0)
        k.lathe([(0.0, -1.25), (0.06, -1.1), (0.09, -0.85), (0.09, 1.8), (0.0, 1.85)], T(sx * 3.0, 0, -0.64), 10, 'bright')
        for a in (45, 135): k.box((sx * 3.0, 1.6, -0.64), (0.5, 0.35, 0.02), 'bright', bev=0.0, M=T(sx * 3.0, 1.6, -0.64) @ Ry(a) @ T(-sx * 3.0, -1.6, 0.64))
        k.box((sx * 4.75, 2.8, -0.3), (0.06, 1.2, 0.06), 'red', bev=0.0)
    k.box((0, 0.5, -1.0), (0.12, 1.4, 0.3), 'olive', bev=0.0)
    k.lathe([(0.0, -1.6), (0.18, -1.3), (0.3, -0.6), (0.32, 0.6), (0.26, 1.6), (0.0, 2.3)], T(0, 0.5, -1.42), 14, 'olive')
    RAW['ftr'] = {'gun muzzle (right side of the nose)': (0.55, -5.5, -0.35), 'missiles (nose, under each wing)': [(-3.0, -1.25, -0.64), (3.0, -1.25, -0.64)],
                  'bomb drop (under the belly, the drop tank spot)': (0.0, 0.5, -1.8)}
    return k, Vector((0, 0, 0)), Vector((0, 0, 0))
def model_atk():
    k = Kit(1); S = Matrix.Diagonal((1.0, 1.0, 1.15, 1.0))
    k.lathe([(0.0, -8.0), (0.3, -7.85), (0.6, -7.4), (0.8, -6.7), (0.98, -5.4), (1.05, -3.0), (1.05, 0.0), (0.98, 2.4), (0.85, 4.0), (0.62, 5.6), (0.4, 7.2), (0.25, 8.0), (0.0, 8.05)], S, 20, 'olive')
    k.lathe([(0.0, -5.9), (0.3, -5.6), (0.48, -5.0), (0.5, -4.2), (0.38, -3.5), (0.0, -3.2)], T(0, 0, 0.88) @ Matrix.Diagonal((1, 1, 1.15, 1)), 14, 'dark')
    k.lathe([(0.0, -7.5), (0.2, -7.5), (0.2, -8.0), (0.0, -8.0)], T(0, 0, -0.35), 12, 'steel')
    for a in range(5):
        an = math.radians(a * 72); k.lathe([(0.0, -7.9), (0.045, -7.9), (0.045, -9.0), (0.0, -9.0)], T(0.09 * math.cos(an), 0, -0.35 + 0.09 * math.sin(an)), 6, 'dark')
    wings(k, (0.9, -1.6, -0.45, 3.3, 0.3), (8.75, -1.0, -0.05, 1.9, 0.12), mid=(4.0, -1.45, -0.35, 3.0, 0.25))
    for sx in (-1, 1):
        k.lathe([(0.0, 1.6), (0.55, 1.65), (0.68, 2.1), (0.72, 3.0), (0.7, 4.3), (0.6, 5.5), (0.45, 5.8), (0.0, 5.8)], T(sx * 1.6, 0, 1.15), 16, 'olive')
        disc(k, sx * 1.6, 1.62, 1.15, 0.52); disc(k, sx * 1.6, 5.81, 1.15, 0.38)
        k.prism([(2.4, 0.5), (2.9, 0.75), (4.4, 0.75), (5.0, 0.5)], sx * 0.5, sx * 1.1, 'olive', bev=0.02)
        loft(k, [(-0.4, 5.6, sx * 3.2, 2.0, 0.1), (1.2, 5.75, sx * 3.2, 1.8, 0.09), (3.0, 5.9, sx * 3.2, 1.5, 0.07)], vertical=True)
        for x in (4.0, 6.0):
            k.box((sx * x, -0.6, -0.56), (0.1, 1.4, 0.36), 'olive', bev=0.0)
            k.lathe([(0.0, -1.8), (0.22, -1.8), (0.3, -1.62), (0.3, 0.45), (0.2, 0.68), (0.0, 0.75)], T(sx * x, 0, -0.98), 14, 'olive')
            disc(k, sx * x, -1.81, -0.98, 0.2)
        k.lathe([(0.0, -1.4), (0.14, -1.2), (0.14, 0.8), (0.0, 1.0)], T(sx * 8.8, 0, -0.05), 8, 'olive')
        for y in (-2.4, -1.0): k.box((sx * 1.0, y + 0.3, -1.05), (0.25, 0.6, 0.35), 'olive', bev=0.02)       # retracted wheel fairings
    wings(k, (0.0, 5.7, 0.55, 2.0, 0.1), (3.3, 6.0, 0.55, 1.6, 0.07))
    RAW['atk'] = {'gun muzzle (nose cannon)': (0.0, -9.0, -0.35), 'rockets (front of the four pods)': [(-6.0, -1.85, -0.98), (-4.0, -1.85, -0.98), (4.0, -1.85, -0.98), (6.0, -1.85, -0.98)],
                  'bomb drop (under the belly)': (0.0, 0.0, -1.4)}
    return k, Vector((0, 0, 0)), Vector((0, 0, 0))
def model_bmb():
    k = Kit(1); S = Matrix.Diagonal((1.0, 1.0, 1.1, 1.0))
    prof = [(0.0, -8.9), (0.45, -8.7), (0.95, -7.8), (1.2, -6.2), (1.28, -3.0), (1.28, 2.0), (1.15, 3.8), (1.0, 5.2), (0.7, 7.6), (0.45, 8.6), (0.0, 8.8)]
    k.lathe(prof, S, 20, 'olive')
    k.lathe([(0.0, -8.94), (0.47, -8.73), (0.98, -7.82), (1.05, -7.4), (0.0, -7.4)], Matrix.Diagonal((1.0, 1.0, 1.1, 1.0)), 20, 'dark')
    k.lathe([(0.0, -6.3), (0.35, -6.0), (0.5, -5.3), (0.48, -4.3), (0.3, -3.6), (0.0, -3.4)], T(0, 0, 1.1) @ Matrix.Diagonal((1, 1, 1.2, 1)), 14, 'dark')
    k.lathe([(0.0, 8.4), (0.5, 8.5), (0.48, 9.0), (0.25, 9.35), (0.0, 9.4)], None, 14, 'dark')
    for sx in (-0.12, 0.12): k.lathe([(0.0, 9.2), (0.04, 9.2), (0.04, 10.2), (0.0, 10.2)], T(sx, 0, 0.0), 6, 'steel')
    for sx in (-0.25, 0.25): k.lathe([(0.0, -8.3), (0.04, -8.3), (0.04, -9.4), (0.0, -9.4)], T(sx, 0, -0.75), 6, 'steel')
    wings(k, (1.1, -2.0, -0.1, 4.0, 0.38), (10.5, -0.6, 0.35, 1.6, 0.12), mid=(3.4, -1.9, 0.0, 3.7, 0.33))
    for sx in (-1, 1):
        k.lathe([(0.0, -3.4), (0.55, -3.35), (0.72, -2.8), (0.78, -1.6), (0.78, 0.5), (0.7, 2.0), (0.55, 3.0), (0.48, 3.2), (0.0, 3.2)], T(sx * 3.4, 0, -0.55), 16, 'olive')
        disc(k, sx * 3.4, -3.37, -0.55, 0.5); disc(k, sx * 3.4, 3.21, -0.55, 0.42)
        k.box((sx * 10.45, 0.2, 0.36), (0.12, 1.0, 0.1), 'red' if sx < 0 else 'olive', bev=0.0)
    wings(k, (0.0, 6.2, 0.65, 2.5, 0.12), (4.3, 7.7, 0.75, 1.1, 0.05))
    loft(k, [(0.9, 5.2, 0.0, 3.6, 0.14), (2.6, 6.7, 0.0, 2.4, 0.1), (4.2, 8.0, 0.0, 1.4, 0.06)], vertical=True)
    k.box((0, 0.5, -1.4), (1.1, 4.2, 0.04), 'dark', bev=0.0)
    k.box((0, -3.0, 1.45), (0.5, 0.8, 0.3), 'dark', bev=0.02)                                     # astrodome / dorsal sight
    RAW['bmb'] = {'gun muzzle (twin nose guns, forward)': (0.0, -9.4, -0.75), 'tail gun muzzle (pointing backward, +Y)': (0.0, 10.2, 0.0),
                  'bomb drop (bomb bay, under the belly)': (0.0, 0.5, -1.6)}
    return k, Vector((0, 0, 0)), Vector((0, 0, 0))
def model_heli():
    k = Kit(1); S = Matrix.Diagonal((0.85, 1.0, 1.15, 1.0))
    k.lathe([(0.0, -6.2), (0.35, -6.0), (0.62, -5.5), (0.8, -4.8), (0.92, -3.6), (1.0, -1.2), (0.98, 1.0), (0.75, 2.6), (0.42, 4.0), (0.32, 5.5), (0.27, 7.2), (0.28, 8.2), (0.0, 8.4)], S, 18, 'olive')
    k.lathe([(0.0, -5.7), (0.3, -5.4), (0.45, -4.7), (0.45, -3.9), (0.0, -3.6)], T(0, 0, 0.55) @ Matrix.Diagonal((0.95, 1, 1.3, 1)), 12, 'dark')
    k.lathe([(0.0, -4.1), (0.3, -3.8), (0.48, -3.1), (0.45, -2.0), (0.0, -1.6)], T(0, 0, 0.95) @ Matrix.Diagonal((0.95, 1, 1.25, 1)), 12, 'dark')
    for sx in (-1, 1):
        k.lathe([(0.0, -1.2), (0.42, -1.1), (0.48, -0.6), (0.48, 1.8), (0.38, 2.4), (0.0, 2.5)], T(sx * 0.75, 0, 1.05), 14, 'olive')
        disc(k, sx * 0.75, 2.45, 1.05, 0.3)
        k.box((sx * 1.7, -0.1, -0.42), (0.12, 0.9, 0.4), 'olive', bev=0.0)
        k.lathe([(0.0, -1.0), (0.24, -1.0), (0.27, -0.8), (0.27, 0.6), (0.18, 0.7), (0.0, 0.72)], T(sx * 1.7, 0, -0.82), 12, 'olive'); disc(k, sx * 1.7, -1.01, -0.82, 0.22)
        k.box((sx * 2.55, -0.1, -0.38), (0.1, 1.2, 0.12), 'steel', bev=0.0)
        for z in (-0.52,): k.lathe([(0.0, -1.05), (0.06, -0.95), (0.09, -0.75), (0.09, 0.8), (0.0, 0.85)], T(sx * 2.55, 0, z), 8, 'bright')
    wings(k, (0.6, -0.65, -0.15, 1.5, 0.12), (2.65, -0.45, -0.32, 1.1, 0.08))
    k.lathe([(0.0, 0.0), (0.6, 0.0), (0.45, 0.6), (0.16, 0.95), (0.16, 1.4), (0.0, 1.4)], T(0, 0.2, 1.2) @ Rx(90), 14, 'olive')
    loft(k, [(0.15, 6.9, 0.0, 1.6, 0.12), (1.3, 7.3, 0.0, 1.3, 0.1), (2.4, 7.7, 0.0, 1.0, 0.07)], vertical=True)
    wings(k, (0.15, 7.0, 0.25, 0.9, 0.06), (1.4, 7.25, 0.25, 0.7, 0.05))
    k.lathe([(0.0, -0.1), (0.15, -0.1), (0.15, 0.1), (0.0, 0.1)], T(0.22, 7.9, 2.0) @ Rz(90), 10, 'steel')
    for a in (20, 110): k.box((0.32, 7.9, 2.0), (0.04, 0.24, 2.6), 'dark', bev=0.0, M=T(0.32, 7.9, 2.0) @ Rx(a) @ T(-0.32, -7.9, -2.0))
    k.box((0, -4.4, -1.0), (0.5, 0.7, 0.35), 'olive', bev=0.02)
    TP = Vector((0, 0.2, 2.6))
    k.lathe([(0.0, -0.05), (0.38, -0.05), (0.38, 0.22), (0.18, 0.32), (0.0, 0.34)], T(*TP) @ Rx(90), 14, 'steel', 'mag')
    for a in (15, 105, 195, 285):
        k.box((3.95, 0, 0.12), (6.9, 0.55, 0.06), 'dark', 'mag', bev=0.0, M=T(*TP) @ Rz(a))
        k.box((0.55, 0, 0.12), (0.5, 0.2, 0.12), 'steel', 'mag', bev=0.0, M=T(*TP) @ Rz(a))
    TR = Vector((0, -4.4, -1.3))
    k.lathe([(0.0, -0.32), (0.22, -0.26), (0.3, 0.0), (0.22, 0.26), (0.0, 0.32)], T(*TR), 12, 'olive', 'bolt')
    k.lathe([(0.0, -0.2), (0.055, -0.2), (0.055, -1.75), (0.075, -1.78), (0.075, -1.95), (0.0, -1.95)], T(*TR), 8, 'dark', 'bolt')
    RAW['heli'] = {'gun muzzle (chin gun, at rest)': tuple(TR + Vector((0, -1.95, 0))), 'rockets (front of the two pods)': [(-1.7, -1.05, -0.82), (1.7, -1.05, -0.82)],
                   'missiles (nose, outer rails)': [(-2.55, -1.05, -0.52), (2.55, -1.05, -0.52)]}
    return k, TP, TR
MODELS_V = {'ftr': model_ftr, 'atk': model_atk, 'bmb': model_bmb, 'heli': model_heli}
PTS = {}
def centred(vid, fn):
    """build, then move everything so the origin is the centre of mass (solid volume, all parts together)"""
    def run():
        k, TP, TR = fn(); bm_ = k.bm; vol = 0.0; acc = Vector()
        for f in bm_.faces:
            vs = [v.co for v in f.verts]
            for i in range(1, len(vs) - 1):
                a, b, c = vs[0], vs[i], vs[i + 1]; v6 = a.dot(b.cross(c)); vol += v6; acc += v6 * (a + b + c) / 4
        c = acc / vol; c = Vector([round(x, 2) for x in c])
        for v in bm_.verts: v.co -= c
        def sh(p): return tuple(round(a - b, 2) for a, b in zip(p, c))
        PTS[vid] = {key: ([sh(q) for q in val] if isinstance(val, list) else sh(val)) for key, val in RAW[vid].items()}
        PTS[vid]['centre of mass moved from'] = tuple(c)
        return k, TP - c, TR - c
    return run

# ---------------------------------------------------------------- run
todo = [v for v in MODELS_V if 'only' not in OPT or v in OPT['only'].split(',')]
info = {}
for vid in todo:
    old = bpy.data.collections.get('a_' + vid)
    if old:
        for ob in list(old.objects): bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.collections.remove(old)
    for coll_ in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for d in list(coll_):
            if d.name.startswith(vid + '_') and d.users == 0: coll_.remove(d)
    c = bpy.data.collections.new('a_' + vid); scene.collection.children.link(c)
    inf = make_tank(vid, centred(vid, MODELS_V[vid]), c)
    hull = bpy.data.objects[vid + '_hull']; xs = [v.co.x for v in hull.data.vertices]; ys = [v.co.y for v in hull.data.vertices]; zs = [v.co.z for v in hull.data.vertices]
    inf.update({'span': round(max(xs) - min(xs), 2), 'length': round(max(ys) - min(ys), 2), 'height': round(max(zs) - min(zs), 2),
                'x': (round(min(xs), 2), round(max(xs), 2)), 'y': (round(min(ys), 2), round(max(ys), 2)), 'z': (round(min(zs), 2), round(max(zs), 2)), 'points': PTS[vid]})
    rot = bpy.data.objects.get(vid + '_turret')
    if rot: inf['rotor_diameter'] = round(2 * max(math.hypot(v.co.x, v.co.y) for v in rot.data.vertices), 2)
    info[vid] = inf; log(vid, inf)
    parts = [o.name for o in c.objects if o.type == 'MESH']
    cfg = {'blend': 'aircraft.blend', 'out': '../../Steel Storm Remastered/assets/a_' + vid, 'parts': sorted(parts, key=lambda n: (n.endswith('_lod1'), ['hull', 'turret', 'barrel'].index(n.split('_')[1]))),
           'maxTexture': 1024}
    with open(os.path.join(BASE, 'a_%s.export.json' % vid), 'w') as f: json.dump(cfg, f, indent=1)
prev = {}
p = os.path.join(CACHE, 'aircraft.json')
if os.path.exists(p): prev = json.load(open(p))
prev.update(info); json.dump(prev, open(p, 'w'), indent=1)
bpy.ops.wm.save_mainfile(); log('saved', bpy.data.filepath)
if 'preview' in OPT:
    sc = bpy.data.scenes.new('aprev'); sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'TEXTURE'
    cd = bpy.data.cameras.new('ac'); cam = bpy.data.objects.new('ac', cd); sc.collection.objects.link(cam); sc.camera = cam; cd.angle = math.radians(40)
    big = np.ones((2 * 300, 2 * 400, 4), np.float32)
    for i, vid in enumerate(MODELS_V):
        c = bpy.data.collections.get('a_' + vid)
        if not c: continue
        for o in c.objects:
            if not o.name.endswith('_lod1'): sc.collection.objects.link(o)
        off = Vector(((i % 2) * 80.0, (i // 2) * 80.0, 0)); bpy.data.objects[vid + '_hull'].location = off
        cam.location = off + Vector((17.0, -19.0, 12.0)); cam.rotation_euler = (off - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.resolution_x, sc.render.resolution_y = 400, 300; tmp = os.path.join(CACHE, '_ac.png'); sc.render.filepath = tmp
        bpy.ops.render.render(write_still=True, scene=sc.name)
        im = bpy.data.images.load(tmp); a = np.array(im.pixels[:], np.float32).reshape(300, 400, 4); bpy.data.images.remove(im); os.remove(tmp)
        r, q = divmod(i, 2); big[(1 - r) * 300:(2 - r) * 300, q * 400:(q + 1) * 400] = a
        bpy.data.objects[vid + '_hull'].location = (0, 0, 0)
    im = bpy.data.images.new('ag', 800, 600); im.pixels.foreach_set(big.ravel()); im.filepath_raw = os.path.join(CACHE, 'aircraft.png'); im.file_format = 'PNG'; im.save()
    log('preview aircraft.png')
log('done')
