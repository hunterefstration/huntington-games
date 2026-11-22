# Steel Storm Remastered: six more ground vehicles, each exported to its own small file, in art/steelstorm/vehicles.blend.
#   blender -b art/steelstorm/vehicles.blend -P tools/blender/make_vehicles.py -- [only=td,spaa] [preview]   (first time: --factory-startup)
# then  node tools/export-art.mjs v_td v_spaa v_arty v_apc v_truck v_atgun  ->  Steel Storm Remastered/assets/v_<id>.hgm
# Same style, part layout and naming as the valley's light and heavy tanks (tools/blender/make_valley.py, whose texturing and track
# helpers are copied here): <id>_hull > <id>_turret > <id>_barrel, each with a _lod1 twin; forward -Y; hull origin on the ground
# under its centre, turret origin on its pivot, barrel origin on the trunnion; neutral grey-green paint. The truck has a hull only.
# The file is this script's own: every run rebuilds the vehicles it builds (and keeps the others).
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
if not bpy.data.filepath.replace('\\', '/').endswith('art/steelstorm/vehicles.blend'):
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    scene.render.fps = 30; bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, 'vehicles.blend')); log('created', bpy.data.filepath)
TEXN_V = {'truck': 512, 'atgun': 512}

# ---------------------------------------------------------------- copied from make_valley.py
TANK_BASE = (0.58, 0.60, 0.54)
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
    dirt = np.clip((1.0 - P[:, 2]) / 1.0, 0, 1) * (0.5 + 0.5 * mott); col_ = col_ * (1 - 0.45 * dirt[:, None]) + np.array((0.36, 0.31, 0.24), np.float32) * 0.45 * dirt[:, None]
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
    img = tank_texture(ob, TEXN_V.get(prefix, 1024), prefix + '_tank'); mat = image_material(prefix + '_tank', img, 0.7, 0.3)
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
    if barrel: barrel.parent = turret or hull; barrel.location = TR - (TP if turret else Vector())
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

# ---------------------------------------------------------------- the vehicles (metres, forward -Y)
def wheel_x(k, x, y, z, r, w, cls='rubber', grp='gun'):
    wheel(k, x, y, z, r, w, cls, grp)
    k.lathe([(0.0, -w / 2 - 0.01), (r * 0.55, -w / 2 - 0.01), (r * 0.55, w / 2 + 0.01), (0.0, w / 2 + 0.01)], T(x, y, z) @ Rz(90), 10, 'olive', grp)
def model_td():
    k = Kit(2)
    k.prism([(-3.3, 0.45), (-3.45, 0.8), (3.2, 0.8), (3.35, 0.45)], -1.1, 1.1, 'olive', bev=0.04)
    k.prism([(-3.45, 0.8), (-2.2, 1.95), (1.8, 1.95), (3.3, 1.55), (3.35, 0.8)], -1.45, 1.45, 'olive', bev=0.04)
    k.box((0, -0.5, 1.95), (2.6, 3.4, 0.06), 'olive', bev=0.01); k.box((0, 2.5, 1.62), (2.2, 1.2, 0.04), 'dark', bev=0.0)
    for sx in (-1, 1):
        track_side(k, sx, 1.1, 1.62, -3.4, 3.3, 0.08, 1.0, 6, 0.38)
        for i in range(4): k.box((sx * 1.66, -2.4 + i * 1.6, 0.95), (0.05, 1.55, 0.7), 'olive', bev=0.01)
    k.lathe([(0.0, 0.0), (0.3, 0.0), (0.3, 0.12), (0.0, 0.13)], T(0.7, 0.3, 1.95) @ Rx(90), 14, 'olive')
    TP = Vector((0, -2.3, 1.45))
    k.lathe([(0.0, -0.05), (0.42, -0.05), (0.48, 0.1), (0.48, 0.3), (0.0, 0.32)], T(0, -2.45, 1.45) @ Rz(180), 16, 'olive', 'mag')
    TR = Vector((0, -2.6, 1.45))
    k.lathe([(0.14, -2.6), (0.14, -3.2), (0.095, -3.3), (0.095, -6.6), (0.13, -6.65), (0.13, -6.95), (0.06, -6.95), (0.06, -2.6)], T(0, 0, 1.45), 16, 'olive', 'bolt', loop=True)
    for sx in (-1, 1): k.box((sx * 0.13, -6.8, 1.45), (0.02, 0.12, 0.16), 'dark', 'bolt', bev=0.0)
    return k, TP, TR
def model_spaa():
    k = Kit(2)
    k.prism([(-2.8, 0.45), (-3.0, 0.8), (-2.4, 1.35), (2.7, 1.35), (2.9, 1.0), (2.8, 0.45)], -1.05, 1.05, 'olive', bev=0.035)
    k.box((0, -0.05, 1.33), (3.0, 5.6, 0.07), 'olive', bev=0.015)
    for sx in (-1, 1): track_side(k, sx, 1.05, 1.48, -2.9, 2.8, 0.08, 1.0, 5, 0.37)
    k.box((0, 2.2, 1.4), (1.8, 0.9, 0.05), 'dark', bev=0.0)
    TP = Vector((0, 0.2, 1.38))
    k.lathe([(0.0, 0.0), (1.05, 0.0), (1.05, 0.08), (0.0, 0.09)], T(0, 0.2, 1.38) @ Rx(90), 24, 'olive', 'mag')
    for i in range(10):
        a = math.radians(i * 36 + 18)
        if 70 < (i * 36 + 18) % 360 < 110: continue
        k.box((math.cos(a) * 1.0, 0.2 + math.sin(a) * 1.0, 1.8), (0.06, 0.62, 0.8), 'olive', 'mag', bev=0.01, M=None) if False else None
    for sx in (-1, 1):
        k.box((sx * 1.0, 0.2, 1.85), (0.06, 1.9, 0.8), 'olive', 'mag', bev=0.01)
    k.box((0, 1.15, 1.85), (2.0, 0.06, 0.8), 'olive', 'mag', bev=0.01); k.box((0, -0.75, 1.75), (2.0, 0.06, 0.6), 'olive', 'mag', bev=0.01)
    k.box((0.5, 0.6, 1.6), (0.5, 0.5, 0.45), 'olive', 'mag', bev=0.01); k.box((-0.5, 0.6, 1.6), (0.5, 0.5, 0.45), 'olive', 'mag', bev=0.01)
    TR = Vector((0, -0.2, 1.95))
    k.box((0, -0.2, 1.95), (0.9, 0.7, 0.5), 'olive', 'bolt', bev=0.02)
    for sx in (-0.3, 0.3):
        for sz in (-0.12, 0.12):
            k.lathe([(0.045, -0.3), (0.045, -2.5), (0.06, -2.52), (0.06, -2.7), (0.025, -2.7), (0.025, -0.3)], T(sx, 0, 1.95 + sz), 12, 'olive', 'bolt', loop=True)
    for sx in (-0.48, 0.48): k.box((sx, 0.05, 1.95), (0.15, 0.5, 0.4), 'steel', 'bolt', bev=0.01)
    return k, TP, TR
def model_arty():
    k = Kit(2)
    k.prism([(-3.4, 0.45), (-3.6, 0.85), (-2.8, 1.4), (3.4, 1.4), (3.55, 1.0), (3.45, 0.45)], -1.15, 1.15, 'olive', bev=0.04)
    k.box((0, -0.05, 1.38), (3.3, 7.0, 0.07), 'olive', bev=0.015)
    for sx in (-1, 1): track_side(k, sx, 1.15, 1.65, -3.5, 3.4, 0.08, 1.05, 6, 0.4)
    k.box((0, -2.6, 1.45), (1.8, 0.9, 0.05), 'dark', bev=0.0)
    TP = Vector((0, 1.1, 1.42))
    for sx in (-1, 1): k.prism([(-1.4 + 1.1, 1.42), (-1.6 + 1.1, 2.1), (1.6 + 1.1, 2.6), (2.2 + 1.1, 2.6), (2.2 + 1.1, 1.42)], sx * 1.5, sx * 1.42, 'olive', 'mag', bev=0.01)
    k.prism([(-1.6 + 1.1, 1.42), (-1.75 + 1.1, 2.2), (-1.6 + 1.1, 2.25), (-1.45 + 1.1, 1.42)], -1.5, 1.5, 'olive', 'mag', bev=0.015)
    k.box((0, 3.25, 2.0), (3.0, 0.06, 1.2), 'olive', 'mag', bev=0.01)
    for x, y in ((0.9, 2.6), (-0.9, 2.6), (0.9, 1.9)): k.box((x, y, 1.65), (0.5, 0.4, 0.45), 'wood', 'mag', bev=0.01)
    TR = Vector((0, 0.6, 2.05))
    k.box((0, 0.7, 2.05), (0.8, 1.6, 0.6), 'olive', 'bolt', bev=0.03)
    k.lathe([(0.2, -0.1), (0.2, -0.9), (0.13, -1.0), (0.13, -4.1), (0.0, -4.1)], T(0, 0.6, 2.05) @ Rz(0), 16, 'olive', 'bolt')
    k.box((0, -3.5 + 0.0, 2.05), (0.5, 0.45, 0.4), 'olive', 'bolt', bev=0.03); k.box((0, -3.5, 2.05), (0.55, 0.2, 0.12), 'dark', 'bolt', bev=0.0)
    return k, TP, TR
def model_apc():
    k = Kit(2)
    k.prism([(-3.6, 0.55), (-3.5, 0.95), (-2.4, 1.9), (3.3, 1.9), (3.6, 1.4), (3.5, 0.55)], -1.25, 1.25, 'olive', bev=0.05)
    k.prism([(-3.5, 0.55), (-3.0, 0.4), (3.0, 0.4), (3.5, 0.55)], -1.0, 1.0, 'olive', bev=0.03)
    for y in (-2.5, -0.9, 0.9, 2.5):
        for sx in (-1, 1): wheel_x(k, sx * 1.35, y, 0.55, 0.55, 0.4)
    for sx in (-1, 1): k.box((sx * 1.27, 0.0, 1.5), (0.05, 2.2, 0.5), 'dark', bev=0.0)
    for sx in (-1, 1): k.lathe([(0.0, 0.0), (0.09, 0.0), (0.09, 0.05), (0.0, 0.06)], T(sx * 0.8, -3.55, 1.2) @ Rx(90), 10, 'bright')
    TP = Vector((0, -0.6, 1.9))
    k.lathe([(0.0, 0.0), (0.78, 0.0), (0.72, 0.42), (0.5, 0.55), (0.0, 0.56)], T(0, -0.6, 1.9) @ Rx(90), 18, 'olive', 'mag')
    k.lathe([(0.0, 0.0), (0.2, 0.0), (0.2, 0.1), (0.0, 0.11)], T(0.3, -0.4, 2.45) @ Rx(90), 12, 'olive', 'mag')
    TR = Vector((0, -1.2, 2.15))
    k.box((0, -1.25, 2.15), (0.4, 0.25, 0.3), 'olive', 'bolt', bev=0.02)
    k.lathe([(0.05, -1.3), (0.05, -3.2), (0.07, -3.22), (0.07, -3.4), (0.03, -3.4), (0.03, -1.3)], T(0, 0, 2.15), 12, 'olive', 'bolt', loop=True)
    return k, TP, TR
def model_truck():
    k = Kit(2)
    k.box((0, 0.3, 0.55), (2.1, 6.4, 0.35), 'steel', bev=0.03)
    k.box((0, -2.55, 0.9), (2.3, 1.9, 1.6), 'olive', bev=0.08); k.box((0, -3.52, 1.85), (2.0, 0.04, 0.6), 'glass' if 'glass' in CLS else 'dark', bev=0.0)
    for sx in (-1, 1): k.box((sx * 1.16, -2.55, 1.85), (0.04, 1.0, 0.55), 'dark', bev=0.0)
    k.box((0, -3.55, 0.95), (2.0, 0.2, 0.5), 'steel', bev=0.03)
    k.box((0, 1.2, 0.9), (2.4, 4.4, 0.6), 'olive', bev=0.04)
    for sx in (-1, 1): k.box((sx * 1.19, 1.2, 1.9), (0.04, 4.3, 1.5), 'olive', bev=0.01)
    k.lathe([(0.0, -2.15), (1.2, -2.15), (1.2, 2.15), (0.0, 2.15)], T(0, 1.2, 2.55) @ Rz(90) @ Matrix.Diagonal((1.0, 1.0, 0.45, 1.0)), 16, 'olive') if False else None
    for i in range(5):
        y = -0.8 + i * 1.0; k.sweep([(-1.2, y, 1.4), (-1.0, y, 2.4), (0.0, y, 2.75), (1.0, y, 2.4), (1.2, y, 1.4)], 0.03, 6, 'steel')
    k.box((0, 1.2, 2.72), (2.0, 4.4, 0.06), 'olive', bev=0.01)
    for y, x2 in ((-2.6, 1.08), (0.6, 1.08), (2.0, 1.08)):
        for sx in (-1, 1): wheel_x(k, sx * x2, y, 0.52, 0.52, 0.35)
    k.box((0, 3.5, 0.9), (2.3, 0.08, 0.5), 'olive', bev=0.01); k.box((0.9, -1.2, 0.7), (0.4, 0.8, 0.4), 'steel', bev=0.02)
    return k, Vector((0, 0, 0)), Vector((0, 0, 0))
def model_atgun():
    k = Kit(2)
    for sx in (-1, 1):
        k.sweep([(sx * 0.25, 0.1, 0.5), (sx * 0.9, 2.0, 0.3), (sx * 1.25, 3.4, 0.12)], 0.08, 8, 'olive')
        k.box((sx * 1.27, 3.5, 0.06), (0.25, 0.3, 0.12), 'steel', bev=0.01)
        wheel_x(k, sx * 1.0, 0.0, 0.5, 0.5, 0.25)
    k.lathe([(0.06, -0.95), (0.06, 0.95)], T(0, 0, 0.5) @ Rz(90), 10, 'steel')
    k.box((0, 0.05, 0.62), (0.6, 0.5, 0.25), 'olive', bev=0.02)
    TP = Vector((0, 0.0, 0.75))
    k.box((0, 0.0, 0.85), (0.5, 0.6, 0.25), 'olive', 'mag', bev=0.02)
    k.prism([(-0.55, 0.65), (-0.55, 1.75), (-0.5, 1.85), (-0.45, 0.65)], -0.95, 0.95, 'olive', 'mag', bev=0.01)
    for sx in (-1, 1): k.prism([(-0.55, 0.65), (-0.2, 0.65), (-0.2, 1.6), (-0.55, 1.75)], sx * 0.95, sx * 1.0, 'olive', 'mag', bev=0.01)
    TR = Vector((0, -0.2, 1.1))
    k.box((0, 0.3, 1.1), (0.3, 1.2, 0.28), 'olive', 'bolt', bev=0.02)
    k.lathe([(0.075, -0.3), (0.075, -0.6), (0.055, -0.7), (0.055, -3.3), (0.0, -3.3)], T(0, 0, 1.1), 12, 'olive', 'bolt')
    k.box((0, -3.35, 1.1), (0.22, 0.25, 0.16), 'olive', 'bolt', bev=0.015); k.box((0, -3.35, 1.1), (0.24, 0.08, 0.06), 'dark', 'bolt', bev=0.0)
    return k, TP, TR
MODELS_V = {'td': model_td, 'spaa': model_spaa, 'arty': model_arty, 'apc': model_apc, 'truck': model_truck, 'atgun': model_atgun}

# ---------------------------------------------------------------- run
todo = [v for v in MODELS_V if 'only' not in OPT or v in OPT['only'].split(',')]
info = {}
for vid in todo:
    old = bpy.data.collections.get('v_' + vid)
    if old:
        for ob in list(old.objects): bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.collections.remove(old)
    for coll_ in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for d in list(coll_):
            if d.name.startswith(vid + '_') and d.users == 0: coll_.remove(d)
    c = bpy.data.collections.new('v_' + vid); scene.collection.children.link(c)
    info[vid] = make_tank(vid, MODELS_V[vid], c)
    parts = [o.name for o in c.objects if o.type == 'MESH']
    cfg = {'blend': 'vehicles.blend', 'out': '../../Steel Storm Remastered/assets/v_' + vid, 'parts': sorted(parts, key=lambda n: (n.endswith('_lod1'), ['hull', 'turret', 'barrel'].index(n.split('_')[1]))),
           'maxTexture': TEXN_V.get(vid, 1024)}
    with open(os.path.join(BASE, 'v_%s.export.json' % vid), 'w') as f: json.dump(cfg, f, indent=1)
prev = {}
p = os.path.join(CACHE, 'vehicles.json')
if os.path.exists(p): prev = json.load(open(p))
prev.update(info); json.dump(prev, open(p, 'w'), indent=1)
bpy.ops.wm.save_mainfile(); log('saved', bpy.data.filepath)
if 'preview' in OPT:
    sc = bpy.data.scenes.new('vprev'); sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'TEXTURE'
    cd = bpy.data.cameras.new('vc'); cam = bpy.data.objects.new('vc', cd); sc.collection.objects.link(cam); sc.camera = cam; cd.angle = math.radians(40)
    big = np.ones((2 * 270, 3 * 360, 4), np.float32)
    for i, vid in enumerate(MODELS_V):
        c = bpy.data.collections.get('v_' + vid)
        if not c: continue
        for o in c.objects:
            if not o.name.endswith('_lod1'): sc.collection.objects.link(o)
        off = Vector(((i % 3) * 40.0, (i // 3) * 40.0, 0)); bpy.data.objects[vid + '_hull'].location = off
        cam.location = off + Vector((8.5, -9.0, 5.5)); cam.rotation_euler = (off + Vector((0, 0, 1.0)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.resolution_x, sc.render.resolution_y = 360, 270; tmp = os.path.join(CACHE, '_vc.png'); sc.render.filepath = tmp
        bpy.ops.render.render(write_still=True, scene=sc.name)
        im = bpy.data.images.load(tmp); a = np.array(im.pixels[:], np.float32).reshape(270, 360, 4); bpy.data.images.remove(im); os.remove(tmp)
        r, q = divmod(i, 3); big[(1 - r) * 270:(2 - r) * 270, q * 360:(q + 1) * 360] = a
        bpy.data.objects[vid + '_hull'].location = (0, 0, 0)
    im = bpy.data.images.new('vg', 1080, 540); im.pixels.foreach_set(big.ravel()); im.filepath_raw = os.path.join(CACHE, 'vehicles.png'); im.file_format = 'PNG'; im.save()
    log('preview vehicles.png')
log('done')
