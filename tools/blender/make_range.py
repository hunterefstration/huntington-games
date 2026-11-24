# Steel Storm Remastered's PROVING GROUND (range.hgm): the proof slice's range (art/proof/range.blend, built by hand through the
# Blender MCP; its ground, props and baked light are kept as they are) with the three Steel Storm tanks of tools/blender/ss_tanks.py
# (paint + _gear materials) in place of the old medium. The proof slice's own file and Proof Slice/assets/range.hgm are never touched.
#   blender -b art/proof/range.blend -P tools/blender/make_range.py -- [samples=32]   (saves art/steelstorm/range.blend, writes range.export.json;
#   always from the proof file: the green ground and the extra props are added to a fresh copy, and baked into art/steelstorm/tex/range_*.exr)
# then  node tools/export-art.mjs range_ssr  ->  Steel Storm Remastered/assets/range.hgm
import bpy, os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hgkit import log, save_image, smart_uv
ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OPT = dict((a.split('=', 1) + ['1'])[:2] for a in ARGV)
from ss_tanks import drop_tanks, build_tanks, BASE, TANK_PARTS

src = bpy.data.filepath.replace('\\', '/')
if src.endswith('art/proof/range.blend'):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, 'range.blend'), relative_remap=True); log('copied to', bpy.data.filepath)
    for ob in bpy.data.objects:                         # the light pictures stay in art/proof/tex
        p = ob.get('hg_lightmap')
        if p and str(p).startswith('tex/'): ob['hg_lightmap'] = '../proof/' + str(p)
else:
    raise SystemExit('run this on art/proof/range.blend (the extras go into a fresh copy each time)')
drop_tanks()
# ---------------------------------------------------------------- round after build 23: greener ground, more on the field (only in this copy; the proof slice's file is never touched)
# The ground's colour picture comes from the proof's own macro material (baked as colour only), recoloured: grass turns a natural green with
# darker and lighter patches, dry tufts and tank tracks; dirt and the road stay. The old prop objects and the new things are joined into one
# `props` mesh (and `props_soft`: bushes and stones, not solid) with one new light picture; ground and props re-baked here (tex/range_*.exr).
import bmesh, math, random
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import ss_mapkit as K
TEX = os.path.join(BASE, 'tex'); scene = bpy.context.scene
ter = bpy.data.objects['terrain']; tc = bpy.data.collections['terrain']
dg = bpy.context.evaluated_depsgraph_get(); TBVH = BVHTree.FromObject(ter, dg)
def height(x, y):
    if np.ndim(x):
        return np.array([height(a, b) for a, b in zip(np.ravel(x), np.ravel(y))]).reshape(np.shape(x))
    h = TBVH.ray_cast(Vector((float(x), float(y), 200.0)), Vector((0, 0, -1)), 400.0); return h[0].z if h[0] is not None else 0.0
K.HALF = 100.0
def setup_cycles(samples):
    scene.render.engine = 'CYCLES'; scene.cycles.samples = samples; scene.cycles.device = 'CPU'
def bake_into(ob, img, passes):
    me = ob.data; me.uv_layers.active = me.uv_layers['Lightmap']
    for m in me.materials:
        n = m.node_tree.nodes.new('ShaderNodeTexImage'); n.name = 'hg_bake'; n.image = img; m.node_tree.nodes.active = n
    vl = bpy.context.view_layer
    for o in list(vl.objects): o.select_set(False)
    vl.objects.active = ob; ob.select_set(True)
    bpy.ops.object.bake(type='DIFFUSE', pass_filter=passes, margin=4, use_clear=True)
    for m in me.materials:
        n = m.node_tree.nodes.get('hg_bake')
        if n: m.node_tree.nodes.remove(n)
    me.uv_layers.active = me.uv_layers['UVMap']
    return np.array(img.pixels[:], np.float32).reshape(img.size[1], img.size[0], 4)
# 1. the ground's colour from the proof's macro material, recoloured
N = 2048; setup_cycles(1)
macro = bpy.data.materials['terrain_macro']; ter.data.materials[0] = macro
alb = bpy.data.images.new('range_albedo', N, N, alpha=False, float_buffer=True)
A = bake_into(ter, alb, {'COLOR'})[:, :, :3].copy()
lo, hi = ter.matrix_world @ Vector(ter.bound_box[0]), ter.matrix_world @ Vector(ter.bound_box[6])
xs = lo.x + (np.arange(N) + 0.5) / N * (hi.x - lo.x); ys = lo.y + (np.arange(N) + 0.5) / N * (hi.y - lo.y)
X, Y = np.meshgrid(xs, ys, indexing='xy')
L = A @ np.array((0.3, 0.59, 0.11), np.float32)
veg = np.clip((A[:, :, 1] / np.maximum(A[:, :, 0], 1e-4) - 0.92) / 0.12, 0, 1)            # green-ish over brown: the grass (the road and dirt stay)
n = K.vn2(X, Y, 26.0, 7); n3 = K.vn2(X, Y, 11.0, 17); n4 = K.vn2(X, Y, 1.3, 19); n5 = K.vn2(X, Y, 0.45, 29); n2 = K.vn2(X, Y, 4.0, 9)
grass = np.array((0.058, 0.125, 0.014)); lush = np.array((0.032, 0.085, 0.009)); pale = np.array((0.095, 0.155, 0.022)); dry = np.array((0.19, 0.17, 0.065)); mud = np.array((0.085, 0.062, 0.038))
c = grass * ((0.82 + 0.36 * n) * (0.88 + 0.24 * n4) * (0.93 + 0.14 * n5))[..., None]
t = np.clip((n3 - 0.5) * 3.2, -1, 1)[..., None]; c = c * (1 - 0.55 * np.abs(t)) + np.where(t < 0, lush, pale) * 0.55 * np.abs(t)
dr = (np.clip((n2 - 0.68) * 5, 0, 1) * np.clip((n4 - 0.35) * 3, 0, 1) * 0.7)[..., None]; c = c * (1 - dr) + dry * (0.9 + 0.2 * n5[..., None]) * dr
c *= np.clip(L / max(float(np.median(L[veg > 0.5])) if (veg > 0.5).any() else 1.0, 1e-4), 0.6, 1.4)[..., None] ** 0.5       # keep the old picture's light/dark shaping, softened
r_ = random.Random(23); paths = []
for k in range(10):
    x, y = r_.uniform(-85, 85), r_.uniform(-85, 85); a = r_.uniform(0, 6.28); pts = []
    for i in range(24): pts.append((x, y)); a += r_.uniform(-0.12, 0.12); x += math.cos(a) * 3.5; y += math.sin(a) * 3.5
    for side in (-1.35, 1.35):
        P = []
        for i, (qx, qy) in enumerate(pts):
            j0, j1 = max(i - 1, 0), min(i + 1, len(pts) - 1); dx, dy = pts[j1][0] - pts[j0][0], pts[j1][1] - pts[j0][1]; dl = math.hypot(dx, dy) or 1.0
            P.append((qx - dy / dl * side, qy + dx / dl * side))
        paths.append(P)
tr = (K.stroke_grid(paths, 0.55, 0.25, 0.3)(X, Y) * (0.55 + 0.45 * n4) * 0.75)[..., None]; c = c * (1 - tr) + mud * (0.9 + 0.2 * n5[..., None]) * tr
w = veg[..., None]; out = A * (1 - w) + c * w
col = bpy.data.images.new('range_colour', N, N, alpha=False, float_buffer=True); col.pixels.foreach_set(np.concatenate([out, np.ones((N, N, 1), np.float32)], 2).astype(np.float32).ravel())
tb = bpy.data.materials.new('terrain_bake'); tb.use_nodes = True; nt = tb.node_tree; b = next(n_ for n_ in nt.nodes if n_.type == 'BSDF_PRINCIPLED'); b.inputs['Roughness'].default_value = 1.0
tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = col; uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'Lightmap'; nt.links.new(uvn.outputs['UV'], tx.inputs['Vector']); nt.links.new(tx.outputs['Color'], b.inputs['Base Color'])
log('range ground recoloured: grass share %.0f%%' % (100 * float((veg > 0.5).mean())))
# 2. one props mesh: the old prop objects (their own tiling UVs kept) + the new things
olds = [o for o in tc.objects if o.type == 'MESH' and o.name not in ('terrain', 'backdrop')]
PMs = []
bm = bmesh.new(); MI = {}
for o in olds:
    me = o.data.copy(); me.transform(o.matrix_world)
    remap = []
    for m in me.materials:
        if m.name not in MI: MI[m.name] = len(MI); PMs.append(m)
        remap.append(MI[m.name])
    for p in me.polygons: p.material_index = remap[p.material_index] if p.material_index < len(remap) else 0
    n0 = len(bm.faces); bm.from_mesh(me); bpy.data.meshes.remove(me)
OLDF = len(bm.faces)
for k, src in (('hay', None), ('sandbag', None), ('metal', None)):
    if k == 'hay':
        wd = bpy.data.images.load(os.path.join(os.path.dirname(BASE), 'proof', 'tex', 'wood.png')); a = np.array(wd.pixels[:], np.float32).reshape(wd.size[1], wd.size[0], 4)[:, :, :3].mean(2, keepdims=True); bpy.data.images.remove(wd)
        img = save_image(np.clip(a * np.array((0.92, 0.78, 0.42), np.float32) + np.array((0.04, 0.03, 0.0), np.float32), 0.02, 1), 'hay', TEX)
    elif k == 'sandbag': img = K.copy_pic('sandbag', 'depot_sandbag', K.ASHTEX)
    else: img = K.copy_pic('metal', 'metal_painted')
    m = K.tiled_material(k, img); MI[k] = len(MI); PMs.append(m)
K.hookup(bm, MI, height, 'range')
B_ = [(-27.0, 66.0), (27.0, -66.0)]; P_ = [(12.0, 43.0), (-25.0, -10.0), (39.0, -22.0)]
KEEP = [(0.0, 0.0, 20.0)] + [(x, y, 22.0) for x, y in B_] + [(x, y, 18.0) for x, y in P_]
for (ax, ay), (bx, by) in ((B_[0], B_[1]), ((-60.0, 60.0), (60.0, -60.0)), ((-75.0, -20.0), (75.0, 20.0))):     # three open lanes end to end (and sight lines)
    for t in np.linspace(0, 1, 30): KEEP.append((ax + (bx - ax) * t, ay + (by - ay) * t, 6.0))
def flat(x, y, d=3.0): return abs(K.gz(x + d, y) - K.gz(x - d, y)) < 1.0 and abs(K.gz(x, y + d) - K.gz(x, y - d)) < 1.0
rng = random.Random(41)
KN = dict(K.KINDS); KN['tree'] = KN['tree']
got = K.scatter({'bales': 6, 'stack': 3, 'wreck': 5, 'rocks': 5, 'bigrocks': 3, 'tree': 5, 'pit': 3, 'cubes': 2, 'sandbags': 3}, 22, lambda x, y: flat(x, y), KEEP, rng, 9.5, 88.0)
nb = 0
for k in range(400):
    if nb >= 40: break
    x, y = rng.uniform(-92, 92), rng.uniform(-92, 92)
    if K.free_at(x, y, 1.4, 0.3): K.bush(x, y, rng.uniform(0.9, 1.5), rng, 'foliage'); nb += 1
ns = K.soft_scatter(14, lambda x, y: True, rng, 'stones', 92.0)
log('range extras', got, 'bushes', nb, 'stone groups', ns)
pme = bpy.data.meshes.new('props'); bm.to_mesh(pme); bm.free()
for m in PMs: pme.materials.append(m)
uvl = pme.uv_layers.get('UVMap') or pme.uv_layers.new(name='UVMap')
b2 = bmesh.new(); b2.from_mesh(pme); lay = b2.loops.layers.uv['UVMap']; names = [m.name for m in PMs]
for f in b2.faces:
    if f.index < OLDF: continue
    nn = f.normal; ax_ = max(range(3), key=lambda i: abs(nn[i])); s = K.TILE.get(names[f.material_index], 3.0)
    for l in f.loops:
        p = l.vert.co; u, v = ((p.y, p.z) if ax_ == 0 else (p.x, p.z) if ax_ == 1 else (p.x, p.y)); l[lay].uv = (u / s, v / s)
b2.to_mesh(pme); b2.free()
if pme.uv_layers.get('Lightmap'): pme.uv_layers.remove(pme.uv_layers['Lightmap'])
for o in olds: bpy.data.objects.remove(o, do_unlink=True)
pr = bpy.data.objects.new('props', pme); tc.objects.link(pr); pr['hg_lightmap'] = 'tex/range_props_light.exr'; pr['hg_lightmap_size'] = 2048
lu = pme.uv_layers.new(name='Lightmap'); pme.uv_layers.active = lu; smart_uv(pr, 66, 0.002); pme.uv_layers.active = pme.uv_layers['UVMap']
# 3. bake the ground (colour x light) and the props (light) here
S_ = int(OPT.get('samples', 32)); setup_cycles(S_)
ter.data.materials[0] = tb
for o_, path, passes in ((ter, 'tex/range_light.exr', {'COLOR', 'DIRECT', 'INDIRECT'}), (pr, 'tex/range_props_light.exr', {'DIRECT', 'INDIRECT'})):
    img = bpy.data.images.new('bake_' + o_.name, 2048, 2048, alpha=False, float_buffer=True); a = bake_into(o_, img, passes)
    rgb = a[:, :, :3]; bl = rgb.copy()
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)): bl += np.roll(np.roll(rgb, dy, 0), dx, 1)
    a[:, :, :3] = bl / 5.0; img.pixels.foreach_set(a.ravel()); img.filepath_raw = os.path.join(BASE, path); img.file_format = 'OPEN_EXR'; img.save(); bpy.data.images.remove(img)
    log('baked', path)
ter.data.materials[0] = bpy.data.materials['ground_detail']
K.split_soft(pr)
for o_ in (ter, pr, bpy.data.objects.get('props_soft')):
    if o_: o_.data.calc_loop_triangles(); log(o_.name, len(o_.data.loop_triangles), 'triangles')
TK = build_tanks(bpy.context.scene)
proof = json.load(open(os.path.join(os.path.dirname(BASE), 'proof', 'range.export.json')))
cfg = dict(proof, blend='range.blend', out='../../Steel Storm Remastered/assets/range', parts=TANK_PARTS)
cfg['world'] = dict(proof['world'], lightmap='tex/range_light.exr')          # re-baked here (green ground, shadows of the new props)
with open(os.path.join(BASE, 'range_ssr.export.json'), 'w') as f: json.dump(cfg, f, indent=1)
with open(os.path.join(BASE, '_cache', 'range_tanks.json'), 'w') as f: json.dump(TK, f, indent=1)
bpy.ops.wm.save_mainfile(); log('saved', bpy.data.filepath)
