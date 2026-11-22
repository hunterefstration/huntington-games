# Steel Storm Remastered: the ground "WHITE PASS" (about 420 m) and the same three tanks, in art/steelstorm/pass.blend.
#   blender -b art/steelstorm/pass.blend -P tools/blender/make_pass.py -- [nobake] [samples=32] [preview]   (first time: --factory-startup)
# then  node tools/export-art.mjs pass  ->  Steel Storm Remastered/assets/pass.hgm. Made from make_dunes.py (same conventions and export);
# snow: a mountain road between two shoulders, a frozen lake in the middle, pine woods on the slopes, a wrecked convoy, a ski-lift station.
import bpy, bmesh, math, os, sys, json, random, shutil
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hgkit import *
def rRx(a): return Matrix.Rotation(a, 4, 'X')      # map props: radians (hgkit's Rx/Ry/Rz take degrees; the tanks use those)
def rRy(a): return Matrix.Rotation(a, 4, 'Y')
def rRz(a): return Matrix.Rotation(a, 4, 'Z')

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OPT = dict((a.split('=', 1) + ['1'])[:2] for a in ARGV)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = os.path.join(ROOT, 'art', 'steelstorm'); TEXDIR = os.path.join(BASE, 'tex'); CACHE = os.path.join(BASE, '_cache'); PROOF = os.path.join(ROOT, 'art', 'proof')
for d in (TEXDIR, CACHE): os.makedirs(d, exist_ok=True)
scene = bpy.context.scene
if not bpy.data.filepath.replace('\\', '/').endswith('art/steelstorm/pass.blend'):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, 'pass.blend')); log('created', bpy.data.filepath)
for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
for c in list(bpy.data.collections): bpy.data.collections.remove(c)
for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.images):
    for d in list(coll):
        if d.users == 0: coll.remove(d)
scene.render.fps = 30
random.seed(11)
HALF = 210.0; CLEAR = 30.0
def coll(name):
    c = bpy.data.collections.new(name); scene.collection.children.link(c); return c

# ---------------------------------------------------------------- the ground
def vn2(x, y, scale, seed):
    P = np.stack([np.asarray(x, np.float32).ravel(), np.asarray(y, np.float32).ravel(), np.zeros(np.size(x), np.float32)], 1)
    return vnoise(P, scale, seed).reshape(np.shape(x))
LAKE = (-35.0, 5.0, 52.0, 36.0)                     # the frozen lake: centre, radii (flat, open)
LIFT = (-118.0, 105.0)                              # the ski-lift station, on the west shoulder
VILLAGE = (40.0, -40.0)                             # preview spot (on the road, south of the lake)
SUN_DIR, SUN_E, SUN_COL, SKY_AIR, SKY_DUST = (0.55, 0.62, -0.42), 4.0, (1.0, 0.93, 0.84), 1.4, 0.6
BD_A, BD_B = 70.0, 90.0                             # far mountains
def road_x(y): return 42.0 + 22.0 * np.sin(np.asarray(y, np.float64) / 75.0)
def height(x, y):
    x = np.asarray(x, np.float64); y = np.asarray(y, np.float64); h = height0(x, y)
    dl = np.hypot(x - LIFT[0], y - LIFT[1]); pk = np.clip(1 - (dl - 14.0) / 22.0, 0, 1); pk = pk * pk * (3 - 2 * pk)
    return h * (1 - pk) + float(_lift_z()) * pk
def height0(x, y):
    x = np.asarray(x, np.float64); y = np.asarray(y, np.float64)
    cl = 5.0 + 10.0 * np.sin(y / 120.0)                                            # the pass's centre line
    s = np.clip((np.abs(x - cl) - 85.0) / 125.0, 0, 1); sh = 40.0 * s * s           # the two shoulders, steepening to the edges
    h = sh + 2.2 * (vn2(x, y, 55.0, 3) - 0.5) + 0.7 * (vn2(x, y, 16.0, 5) - 0.5) + 0.02 * y
    h += (1.0 + 1.6 * s) * (vn2(x, y, 30.0, 7) - 0.5) * s * 2                       # rougher on the slopes
    e = np.sqrt(((x - LAKE[0]) / LAKE[2]) ** 2 + ((y - LAKE[1]) / LAKE[3]) ** 2)
    lake = np.clip((1.35 - e) / 0.35, 0, 1); lake = lake * lake * (3 - 2 * lake)
    h = h * (1 - lake) + (0.02 * LAKE[1] - 0.6) * lake                             # dead flat ice, a bank round it
    rd = np.abs(x - road_x(y)); rk = np.clip(1 - (rd - 5.0) / 6.0, 0, 1)
    hs = 40.0 * np.clip((np.abs(road_x(y) - cl) - 85.0) / 125.0, 0, 1) ** 2 + 0.02 * y
    h = h * (1 - 0.8 * rk) + hs * 0.8 * rk                                          # the road: smoothed into the slope
    return h
_LZ = []
def _lift_z():
    if not _LZ:
        _LZ.append(float(height0(np.array([LIFT[0]]), np.array([LIFT[1]]))[0]))
    return _LZ[0]
def macro_colour(x, y, z, slope):
    x = np.asarray(x, np.float64); y = np.asarray(y, np.float64)
    snow = np.array((0.70, 0.72, 0.76)); shade = np.array((0.58, 0.62, 0.70)); rock = np.array((0.30, 0.30, 0.31)); ice = np.array((0.36, 0.46, 0.53))
    slush = np.array((0.22, 0.22, 0.23)); needles = np.array((0.40, 0.42, 0.42))
    n = vn2(x, y, 20.0, 7)[..., None]; n2 = vn2(x, y, 4.0, 9)[..., None]
    c = snow * (0.92 + 0.1 * n2) * (1 - 0.25 * n) + shade * 0.25 * n
    st = np.clip((np.asarray(slope) - 0.33) / 0.15, 0, 1)[..., None] * np.clip(vn2(x, y, 9.0, 13) * 1.6 - 0.3, 0, 1)[..., None]
    c = c * (1 - 0.8 * st) + rock * 0.8 * st                                         # rock showing through on steep ground
    e = np.sqrt(((x - LAKE[0]) / LAKE[2]) ** 2 + ((y - LAKE[1]) / LAKE[3]) ** 2)
    li = np.clip((1.04 - e) / 0.06, 0, 1)[..., None]
    crack = (np.abs(vn2(x, y, 7.0, 17) - 0.5) < 0.02)[..., None] * 0.5
    icec = ice * (0.85 + 0.25 * vn2(x, y, 12.0, 15)[..., None]) * (1 - crack) + snow * 0.25 * np.clip(vn2(x, y, 25.0, 19)[..., None] - 0.55, 0, 1) * 3
    c = c * (1 - li) + icec * li
    rd = np.abs(x - road_x(y)); rk = np.clip(1 - (rd - 3.5) / 2.0, 0, 1)[..., None]
    tracks = ((np.abs(rd - 1.6) < 0.35) | (np.abs(rd - 0.0) < 0.2))[..., None] * 0.35
    c = c * (1 - rk) + slush * (1 - tracks) * rk + snow * 0.6 * tracks * rk
    w = np.clip((WOOD(x, y) - 0.5) * 4, 0, 1)[..., None]; c = c * (1 - 0.3 * w) + needles * 0.3 * w
    dl = np.hypot(x - LIFT[0], y - LIFT[1]); pk = np.clip(1 - (dl - 12.0) / 6.0, 0, 1)[..., None]; c = c * (1 - 0.5 * pk) + slush * 1.4 * 0.5 * pk
    return np.clip(c, 0.04, 0.85)
def WOOD(x, y):
    """where the pine woods grow: the lower slopes, in clumps, never on the road, the ice or the lift pad"""
    x = np.asarray(x, np.float64); y = np.asarray(y, np.float64); cl = 5.0 + 10.0 * np.sin(y / 120.0)
    s = np.clip((np.abs(x - cl) - 85.0) / 125.0, 0, 1)
    m = vn2(x, y, 45.0, 31) * (0.25 + 0.75 * np.clip(s * 4, 0, 1)) * np.clip((0.8 - s) * 4, 0, 1)
    e = np.sqrt(((x - LAKE[0]) / LAKE[2]) ** 2 + ((y - LAKE[1]) / LAKE[3]) ** 2); m = m * np.clip((e - 1.2) * 3, 0, 1)
    m = m * np.clip((np.abs(x - road_x(y)) - 10.0) / 6.0, 0, 1) * np.clip((np.hypot(x - LIFT[0], y - LIFT[1]) - 24.0) / 8.0, 0, 1)
    m = m * np.clip((np.hypot(x - VILLAGE[0], y - VILLAGE[1]) - 30.0) / 10.0, 0, 1) * np.clip((np.hypot(x, y) - 30.0) / 10.0, 0, 1)
    return m
def pine(x, y, s=1.0):
    z = gz(x, y); h = random.uniform(7.0, 11.0) * s
    cyl((x, y, z - 0.3), 0.22 * s, h * 0.35 + 0.3, 'bark', 6, 0.16 * s)
    for k, (zf, r) in enumerate(((0.18, 2.6), (0.42, 2.0), (0.64, 1.35))):
        cyl((x, y, z + h * zf), r * s * random.uniform(0.9, 1.1), h * 0.42, 'foliage', 7, 0.0)
def lift_station():
    x, y = LIFT; z = _lift_z()
    box((x, y, z), (12.0, 8.0, 4.2), 'concrete', 0.3); box((x, y, z + 4.2), (13.0, 9.0, 0.35), 'wood', 0.3, sink=0.0, tilt=(0.12, 0.0))
    cyl((x + 5.0, y + 7.0, z), 1.4, 3.0, 'metal', 10); box((x + 5.0, y + 7.0, z + 3.0), (5.5, 1.4, 0.6), 'metal', 0.3, sink=0.0)
    # pylons up the slope to the west, the cable between them
    prev = (x + 5.0, y + 7.0, z + 3.6)
    for k in range(1, 6):
        px, py = x - 22.0 * k, y + 5.0 * k + 4.0 * math.sin(k)
        if abs(px) > 205: break
        pz = gz(px, py); hh = 9.0
        box((px, py, pz), (0.7, 0.7, hh), 'metal', 0.2); box((px, py, pz + hh), (0.4, 4.0, 0.4), 'metal', 0.2, sink=0.0)
        for sy in (-1.8, 1.8): beam((prev[0], prev[1] + sy, prev[2]), (px, py + sy, pz + hh + 0.2), 0.06, 'metal')
        if k % 2 == 1: box((px + 6.0, py + 1.8, pz + hh - 2.2), (0.9, 0.7, 1.3), 'rust', 0.2, sink=0.0)       # a chair stopped on the cable
        prev = (px, py, pz + hh + 0.2)
    for k in range(4): box((x - 8.0 + 3.0 * k, y - 8.0, z), (0.25, 0.25, 1.1), 'wood', 0.3)
def convoy():
    """a column caught on the road: burnt trucks nose to tail, two slewed off, a tank hulk"""
    for k, y in enumerate((-95.0, -82.0, -68.0, -55.0, -20.0, -7.0)):
        xr = float(road_x(y)); dx = (-6.0 if k == 2 else 7.5 if k == 4 else random.uniform(-0.8, 0.8))
        ang = math.atan2(1.0, float(road_x(y + 1) - road_x(y))) - math.pi / 2 + (0.9 if k in (2, 4) else random.uniform(-0.15, 0.15))
        truck(xr + dx, y, ang)
    xr = float(road_x(-40.0)); z = gz(xr, -40.0)
    box((xr, -40.0, z), (3.3, 6.6, 1.5), 'rust', 0.25); box((xr - 0.2, -40.5, z + 1.5), (2.2, 2.6, 0.9), 'rust', 0.6, sink=0.0)
    for k in range(10): blob((xr + random.uniform(-6, 6), -40.0 + random.uniform(-14, 14), z), random.uniform(0.4, 0.8), 'rust', 0.4, random.randint(0, 999), 1)
def build_props():
    lift_station(); convoy()
    rng = np.random.default_rng(41); placed = []
    pts = rng.uniform(-200, 200, (9000, 2)); wv = WOOD(pts[:, 0], pts[:, 1])
    for (x, y), w in zip(pts, wv):
        if w < 0.28 or rng.random() > (w - 0.28) * 3.0: continue
        if any((x - a) ** 2 + (y - b) ** 2 < 36 for a, b in placed[-60:]): continue
        placed.append((x, y)); pine(float(x), float(y), random.uniform(0.8, 1.25))
        if len(placed) >= 420: break
    for x, y in ((-160.0, -150.0), (150.0, 160.0), (-170.0, 20.0), (175.0, -60.0), (130.0, 60.0)):
        for k in range(3):
            px, py = x + random.uniform(-6, 6), y + random.uniform(-6, 6); r = random.uniform(1.6, 3.5); blob((px, py, gz(px, py) + r * 0.2), r, 'rock', 0.7, random.randint(0, 999), 2)
    for k in range(9):                                                            # snow-buried posts marking the road edge
        y = -150.0 + k * 35.0; x = float(road_x(y)) + 6.5; box((x, y, gz(x, y)), (0.18, 0.18, 1.6), 'wood', 0.0)
    log('props', len(bm.faces), 'faces,', len(placed), 'pines')
def terrain_mesh(N=150):
    xs = np.linspace(-HALF, HALF, N + 1); X, Y = np.meshgrid(xs, xs, indexing='ij'); Z = height(X, Y)
    gx, gy = np.gradient(Z, xs, xs); slope = np.hypot(gx, gy)
    inner = (np.abs(X) < HALF - 5) & (np.abs(Y) < HALF - 5)
    k = np.unravel_index(np.argmax(np.where(inner, slope, 0)), slope.shape)
    log('terrain: height %.1f..%.1f m, steepest %.1f deg at (%.0f, %.0f); share over 22 deg %.3f%%' % (Z.min(), Z.max(), math.degrees(math.atan(slope[inner].max())), X[k], Y[k],
        100 * float((slope[inner] > math.tan(math.radians(22))).mean())))
    col_ = macro_colour(X, Y, Z, slope)
    verts = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
    idx = np.arange((N + 1) ** 2).reshape(N + 1, N + 1)
    quads = np.stack([idx[:-1, :-1].ravel(), idx[1:, :-1].ravel(), idx[1:, 1:].ravel(), idx[:-1, 1:].ravel()], 1)
    me = bpy.data.meshes.new('terrain'); me.from_pydata(verts.tolist(), [], quads.tolist())
    uv = me.uv_layers.new(name='UVMap'); lm = me.uv_layers.new(name='Lightmap'); lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get('vertex_index', lv)
    p = verts[lv]; uv.data.foreach_set('uv', (p[:, :2] / 8.0).astype(np.float32).ravel()); lm.data.foreach_set('uv', ((p[:, :2] + HALF) / (2 * HALF)).astype(np.float32).ravel())
    ca = me.color_attributes.new('macro', 'FLOAT_COLOR', 'POINT'); ca.data.foreach_set('color', np.c_[col_.reshape(-1, 3), np.ones(len(verts))].astype(np.float32).ravel())
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons)); me.update()
    return me, (X, Y, Z, slope)
def backdrop_mesh(N=150):
    """rings from the terrain's edge out to 600 m, rising into far hills (outside `area`)"""
    xs = np.linspace(-HALF, HALF, N + 1); edge = []
    for t in xs[:-1]: edge.append((t, -HALF))
    for t in xs[:-1]: edge.append((HALF, t))
    for t in xs[::-1][:-1]: edge.append((t, HALF))
    for t in xs[::-1][:-1]: edge.append((-HALF, t))
    edge = np.array(edge); M = len(edge); rings = [0.0, 6, 18, 40, 80, 140, 220, 320, 420]
    verts = []
    for k, dd in enumerate(rings):
        ang = np.arctan2(edge[:, 1], edge[:, 0]); r0 = np.hypot(edge[:, 0], edge[:, 1])
        r = r0 + dd * (1 + 0.3 * (1 - np.abs(np.cos(2 * ang))))
        px, py = r * np.cos(ang), r * np.sin(ang)
        hz = height(np.clip(px, -HALF, HALF), np.clip(py, -HALF, HALF)) if k == 0 else height(edge[:, 0], edge[:, 1]) * max(0.0, 1 - dd / 30.0)
        if k > 0: hz = hz + (dd / 420.0) ** 0.7 * (BD_A + BD_B * vn2(px, py, 140.0, 21) + 10 * vn2(px, py, 40.0, 23)) - 0.4
        verts += list(zip(px, py, hz))
    faces = [(k * M + i, (k + 1) * M + i, (k + 1) * M + (i + 1) % M, k * M + (i + 1) % M) for k in range(len(rings) - 1) for i in range(M)]   # facing up
    me = bpy.data.meshes.new('backdrop'); me.from_pydata(verts, [], faces)
    vv = np.array(verts)
    uv = me.uv_layers.new(name='UVMap'); lm = me.uv_layers.new(name='Lightmap'); lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get('vertex_index', lv)
    p = vv[lv]; uv.data.foreach_set('uv', (p[:, :2] / 8.0).astype(np.float32).ravel()); lm.data.foreach_set('uv', ((p[:, :2] + 700) / 1400).astype(np.float32).ravel())
    gx = np.zeros(len(vv)); col_ = macro_colour(vv[:, 0], vv[:, 1], vv[:, 2], gx) * 0.95
    ca = me.color_attributes.new('macro', 'FLOAT_COLOR', 'POINT'); ca.data.foreach_set('color', np.c_[col_, np.ones(len(vv))].astype(np.float32).ravel())
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons)); me.update()
    return me

# ---------------------------------------------------------------- pictures and materials
def copy_pic(name, src=None):
    shutil.copy(os.path.join(PROOF, 'tex', (src or name) + '.png'), os.path.join(TEXDIR, name + '.png'))
    im = bpy.data.images.load(os.path.join(TEXDIR, name + '.png')); im.name = name; im.filepath = '//tex/' + name + '.png'; return im
def tiled_material(name, img, rough=0.9):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = img; uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'UVMap'
    nt.links.new(uvn.outputs['UV'], tx.inputs['Vector']); nt.links.new(tx.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = 0.0; return m
def macro_material(name):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    at = nt.nodes.new('ShaderNodeAttribute'); at.attribute_name = 'macro'; nt.links.new(at.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 1.0; return m
PIC = {}
def pictures():
    for k, src in (('ground_detail', None), ('rock', None), ('bark', None), ('foliage', None), ('concrete', None), ('rust', None), ('wood', None), ('metal', 'metal_painted'), ('brick', None)):
        PIC[k] = copy_pic(k, src)
    a = np.array(PIC['rock'].pixels[:], np.float32).reshape(PIC['rock'].size[1], PIC['rock'].size[0], 4)
    st = a[:, :, :3] * np.array((1.12, 1.08, 1.0), np.float32) * 1.15
    PIC['stone'] = save_image(np.clip(st, 0.05, 1), 'stone', TEXDIR)

# ---------------------------------------------------------------- props: one mesh, material per face
PM = ['stone', 'rock', 'bark', 'foliage', 'concrete', 'rust', 'wood', 'metal', 'brick']
TILE = {'stone': 3.0, 'rock': 4.0, 'bark': 2.0, 'foliage': 3.0, 'concrete': 3.0, 'rust': 2.5, 'wood': 2.0, 'metal': 2.5, 'brick': 3.0}
bm = bmesh.new(); MI = {k: i for i, k in enumerate(PM)}
def _new(before): return [f for f in bm.faces if f not in before]
def gz(x, y): return float(height(x, y))
def box(c, s, mat, rz=0.0, sink=0.4, tilt=(0.0, 0.0)):
    before = set(bm.faces)
    M = T(c[0], c[1], c[2] - sink) @ rRz(rz) @ rRx(tilt[0]) @ rRy(tilt[1]) @ Matrix.Diagonal((s[0], s[1], s[2] + sink, 1)) @ T(0, 0, 0.5)
    bmesh.ops.create_cube(bm, size=1.0, matrix=M)
    for f in _new(before): f.material_index = MI[mat]
def blob(c, r, mat, squash=1.0, seed=0, sub=1):
    before = set(bm.faces); bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0, matrix=T(*c) @ Matrix.Diagonal((r, r, r * squash, 1)))
    new = _new(before); rng = random.Random(seed)
    for v in {v for f in new for v in f.verts}: v.co = Vector(c) + (v.co - Vector(c)) * rng.uniform(0.8, 1.15)
    for f in new: f.material_index = MI[mat]
def cyl(c, r, h, mat, seg=7, r2=None):
    before = set(bm.faces)
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r2 if r2 is not None else r, depth=h, matrix=T(c[0], c[1], c[2] + h / 2))
    for f in _new(before): f.material_index = MI[mat]
def tree(x, y, s=1.0):
    z = gz(x, y); h = random.uniform(4.0, 6.0) * s
    cyl((x, y, z - 0.3), 0.32 * s, h + 0.3, 'bark', 6, 0.18 * s)
    for k in range(3):
        blob((x + random.uniform(-1, 1) * s, y + random.uniform(-1, 1) * s, z + h + (k - 0.5) * 1.6 * s), random.uniform(2.2, 3.2) * s, 'foliage', 0.8, random.randint(0, 999))
def house(x, y, rz, w=8.0, d=6.5, h=4.2, broken=0.5):
    z = gz(x, y); c, s = math.cos(rz), math.sin(rz)
    def at(lx, ly): return (x + c * lx - s * ly, y + s * lx + c * ly)
    for side in range(4):
        L = w if side % 2 == 0 else d; ang = rz + (0 if side % 2 == 0 else math.pi / 2)
        off = (0, -d / 2) if side == 0 else (w / 2, 0) if side == 1 else (0, d / 2) if side == 2 else (-w / 2, 0)
        n = 3; seg = L / n
        for k in range(n):
            t = -L / 2 + seg * (k + 0.5)
            lx, ly = (off[0] + t, off[1]) if side % 2 == 0 else (off[0], off[1] + t)
            hh = h if random.random() > broken * 0.6 else random.uniform(1.3, h * 0.6)
            if side == 0 and k == 1: hh = 2.2; box((*at(lx, ly), z + 2.2), (seg, 0.6, h - 2.2), 'stone', ang, sink=0.0); continue   # doorway: lintel only
            px, py = at(lx, ly); box((px, py, z), (seg + 0.02, 0.6, hh), 'stone', ang)
    if random.random() < 0.7:
        for k in range(4):
            lx = -w / 2 + 1 + k * (w - 2) / 3; px, py = at(lx, 0)
            box((px, py, z + h - 0.1), (0.25, d + 0.6, 0.25), 'wood', rz + math.pi / 2 * 0 + math.pi / 2, sink=0.0, tilt=(0, random.uniform(-0.15, 0.15)))
    if random.random() < 0.5:
        px, py = at(-w * 0.2, -d * 0.15); box((px, py, z + h - 0.3), (w * 0.55, d * 0.6, 0.18), 'brick', rz, sink=0.0, tilt=(0.25, 0))
    for k in range(3):
        px, py = at(random.uniform(-w / 2, w / 2), random.uniform(-d / 2 - 2, d / 2 + 2)); blob((px, py, z - 0.2), random.uniform(0.6, 1.0), 'stone', 0.45, random.randint(0, 999), 1)
def field_wall(x0, y0, x1, y1, gaps=()):
    L = math.hypot(x1 - x0, y1 - y0); rz = math.atan2(y1 - y0, x1 - x0); n = int(L / 3.0)
    for k in range(n):
        t = (k + 0.5) / n
        if any(a <= t <= b for a, b in gaps): continue
        x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t; box((x, y, gz(x, y)), (L / n + 0.05, 0.7, random.uniform(1.15, 1.4)), 'stone', rz)
def truck(x, y, rz):
    z = gz(x, y); c, s = math.cos(rz), math.sin(rz)
    def at(lx, ly): return (x + c * lx - s * ly, y + s * lx + c * ly)
    box((*at(0, 1.6), z + 0.6), (2.3, 2.0, 1.9), 'rust', rz); box((*at(0, -1.3), z + 0.6), (2.4, 4.2, 1.2), 'metal', rz); box((*at(0, -1.3), z + 1.8), (2.3, 4.0, 1.4), 'rust', rz, sink=0.0)
    for lx in (-1.1, 1.1):
        for ly in (1.6, -0.6, -2.4):
            px, py = at(lx, ly); cyl((px, py, z), 0.5, 0.35, 'rust', 8)
# ---------------------------------------------------------------- polish: houses with gables and timbers, layered trees, the medium tank's picture
def beam(p0, p1, th, mat):
    p0, p1 = Vector(p0), Vector(p1); d = p1 - p0; L = d.length
    if L < 1e-4: return
    q = d.normalized().to_track_quat('Y', 'Z'); before = set(bm.faces)
    bmesh.ops.create_cube(bm, size=1.0, matrix=T(*((p0 + p1) / 2)) @ q.to_matrix().to_4x4() @ Matrix.Diagonal((th, L, th, 1)))
    for f in _new(before): f.material_index = MI[mat]
def prism_xz(pts, y0, y1, mat, M):
    """a side profile [(lx, lz)] in a house's local frame, extruded along local y from y0 to y1"""
    before = set(bm.faces)
    a = [bm.verts.new(M @ Vector((x, y0, z))) for x, z in pts]; b = [bm.verts.new(M @ Vector((x, y1, z))) for x, z in pts]
    bm.faces.new(a); bm.faces.new(b[::-1])
    for i in range(len(pts)):
        j = (i + 1) % len(pts); bm.faces.new((a[i], a[j], b[j], b[i]))
    new = _new(before); bmesh.ops.recalc_face_normals(bm, faces=new)
    for f in new: f.material_index = MI[mat]
def house2(x, y, rz, w=8.0, d=6.5, h=4.2, broken=0.5):
    """a broken stone farmhouse: walls with a door, windows with lintels and sills, gable ends (one broken), ridge beam and rafters,
    a patch of roof tiles on the rafters, rubble at its feet. Walls are 0.6 m thick and at least 1.3 m tall where they stand."""
    z = gz(x, y); M = T(x, y, z) @ rRz(rz); rng = random.Random(int(x * 13 + y * 7))
    def W(lx, ly, lz): return M @ Vector((lx, ly, lz))
    def piece(lx, ly, sx, sy, z0, hh):
        if hh <= 0.05: return
        p = W(lx, ly, z0); box((p.x, p.y, p.z), (sx, sy, hh), 'stone', rz, sink=0.4 if z0 <= 0 else 0.0)
    # long walls (along local x) at ly = -d/2 (front, the door) and +d/2 (back, windows); short walls (along local y) at lx = +-w/2
    for ly, door in ((-d / 2, True), (d / 2, False)):
        segs = [(-w / 2, -1.3), (-1.3, -0.3), (-0.3, 0.7), (0.7, w / 2)] if door else [(-w / 2, -2.3), (-2.3, -1.1), (-1.1, 1.1), (1.1, 2.3), (2.3, w / 2)]
        for i, (a, b) in enumerate(segs):
            cx, L = (a + b) / 2, b - a; hh = h if rng.random() > broken * 0.5 else rng.uniform(1.4, h * 0.7)
            if door and i == 1:            # doorway with a lintel
                piece(cx, ly, L + 0.02, 0.6, 2.2, h - 2.2); p = W(cx, ly - 0.32, 2.15); box((p.x, p.y, p.z), (L + 0.5, 0.12, 0.18), 'wood', rz, sink=0.0); continue
            if not door and i in (1, 3):     # window: sill wall, lintel, wall above
                piece(cx, ly, L + 0.02, 0.6, 0.0, 1.0); p = W(cx, ly + 0.33, 1.0); box((p.x, p.y, p.z), (L + 0.2, 0.15, 0.08), 'concrete', rz, sink=0.0)
                piece(cx, ly, L + 0.02, 0.6, 2.1, max(0.0, hh - 2.1)); p = W(cx, ly + 0.32, 2.05); box((p.x, p.y, p.z), (L + 0.4, 0.12, 0.16), 'wood', rz, sink=0.0); continue
            piece(cx, ly, L + 0.02, 0.6, 0.0, hh)
    for lx in (-w / 2, w / 2):
        for i, (a, b) in enumerate(((-d / 2, -0.7), (-0.7, 0.7), (0.7, d / 2))):
            cy, L = (a + b) / 2, b - a
            if i == 1:
                piece(lx, cy, 0.6, L + 0.02, 0.0, 1.0); piece(lx, cy, 0.6, L + 0.02, 2.1, h - 2.1); p = W(lx + 0.32 * (1 if lx > 0 else -1), cy, 2.05)
                box((p.x, p.y, p.z), (0.12, L + 0.4, 0.16), 'wood', rz, sink=0.0); continue
            piece(lx, cy, 0.6, L + 0.02, 0.0, h)
    # gable ends on the short walls: one whole, one broken
    ridge = h + d * 0.42
    for k, lx in enumerate((-w / 2, w / 2)):
        if k == 0 or rng.random() < 0.35:
            pts = [(-d / 2 - 0.1, h), (d / 2 + 0.1, h), (0.0, ridge)]
        else:
            pts = [(-d / 2 - 0.1, h), (0.2, h), (-0.6, h + d * 0.25), (-d / 2 * 0.4, h + d * 0.3)]
        Mg = M @ rRz(math.pi / 2); prism_xz(pts, -lx - 0.3, -lx + 0.3, 'stone', Mg)
    # roof timbers: ridge beam, rafters (some missing), a patch of tiles on one slope
    if rng.random() < 0.85:
        beam(W(-w / 2 + 0.3, 0, ridge - 0.12), W(w / 2 - 0.3, 0, ridge - 0.12), 0.22, 'wood')
        for i in range(7):
            lx = -w / 2 + 0.6 + i * (w - 1.2) / 6
            for sgn in (-1, 1):
                if rng.random() < 0.7: beam(W(lx, 0, ridge - 0.12), W(lx, sgn * (d / 2 + 0.25), h - 0.05), 0.14, 'wood')
        sgn = rng.choice((-1, 1)); x0 = rng.uniform(-w / 2 + 0.5, 0.0); x1 = x0 + rng.uniform(2.0, 3.5)
        for r in range(4):
            t0 = 0.15 + r * 0.2
            a = W((x0 + x1) / 2, sgn * (d / 2 + 0.25) * t0, ridge - 0.12 - (ridge - h) * t0 + 0.12)
            ang = math.atan2(ridge - h, d / 2 + 0.25)
            before = set(bm.faces)
            bmesh.ops.create_cube(bm, size=1.0, matrix=T(*a) @ rRz(rz) @ rRx(-sgn * ang) @ Matrix.Diagonal((x1 - x0 - r * 0.3, (d / 2) * 0.22, 0.05, 1)))
            for f in _new(before): f.material_index = MI['brick']
    # rubble at its feet (low: a tank drives over it)
    for k in range(6):
        p = W(rng.uniform(-w / 2 - 1.5, w / 2 + 1.5), rng.choice((-1, 1)) * rng.uniform(d / 2 + 0.4, d / 2 + 2.0), 0.0)
        box((p.x, p.y, p.z), (rng.uniform(0.3, 0.6), rng.uniform(0.25, 0.5), rng.uniform(0.15, 0.32)), 'stone', rng.uniform(0, 3.14), sink=0.1)
    for k in range(2):
        p = W(rng.uniform(-w / 2, w / 2), rng.uniform(-d / 2, d / 2), 0.0); blob((p.x, p.y, p.z - 0.2), rng.uniform(0.7, 1.1), 'stone', 0.4, rng.randint(0, 999), 1)
def tree2(x, y, s=1.0):
    """a trunk with two forks and layered foliage clumps (flattened, overlapping, smaller towards the top)"""
    z = gz(x, y); h = random.uniform(4.0, 6.0) * s
    cyl((x, y, z - 0.3), 0.32 * s, h * 0.7 + 0.3, 'bark', 7, 0.2 * s)
    for k in range(2):
        a = random.uniform(0, 6.28); beam((x, y, z + h * 0.6), (x + math.cos(a) * 1.2 * s, y + math.sin(a) * 1.2 * s, z + h + 0.6 * s), 0.18 * s, 'bark')
    tiers = ((0.0, 2.9, 2), (1.3, 2.3, 2), (2.6, 1.5, 1))
    for dz, r, n in tiers:
        for i in range(n):
            a = random.uniform(0, 6.28); off = (r * 0.55 if n > 1 else 0.0) * s
            blob((x + math.cos(a) * off, y + math.sin(a) * off, z + h + dz * s), r * s * random.uniform(0.85, 1.1), 'foliage', 0.62, random.randint(0, 999), 2 if r > 2.5 else 1)
def medium_texture(objs, N=1024):
    """repaint the range tank's picture like the light and heavy: neutral grey-green, panel lines, wear on edges, dirt, AO,
    keeping the old picture's light/dark detail (hatches, bolts) as a multiplier"""
    old = objs[0].data.materials[0].node_tree.nodes; img = next(n.image for n in old if n.type == 'TEX_IMAGE' and n.image)
    o = np.array(img.pixels[:], np.float32).reshape(img.size[1], img.size[0], 4)[:, :, :3]
    if o.shape[0] != N:
        idx = (np.arange(N) * o.shape[0] / N).astype(int); o = o[idx][:, (np.arange(N) * o.shape[1] / N).astype(int)]
    lum = o @ np.array((0.3, 0.59, 0.11), np.float32); lum = lum / max(float(np.median(lum[lum > 0.02])), 1e-3)
    P3, N3, UV, CV = [], [], [], []; allv, allf = [], []
    for ob in objs:
        me = ob.data; mw = ob.matrix_world; me.calc_loop_triangles(); nt = len(me.loop_triangles)
        tl = np.empty(nt * 3, np.int64); me.loop_triangles.foreach_get('loops', tl); tl = tl.reshape(-1, 3)
        lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get('vertex_index', lv)
        co = np.array([mw @ v.co for v in me.vertices], np.float32); vn = np.array([(mw.to_3x3() @ v.normal).normalized() for v in me.vertices], np.float32)
        uv = np.empty(len(me.loops) * 2, np.float32); me.uv_layers[0].data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
        a, b, c = co[lv[tl[:, 0]]], co[lv[tl[:, 1]]], co[lv[tl[:, 2]]]
        nb = np.zeros_like(co); cnt = np.zeros(len(co))
        for k in range(3):
            for j in range(3):
                if j != k: np.add.at(nb, lv[tl[:, k]], co[lv[tl[:, j]]]); np.add.at(cnt, lv[tl[:, k]], 1)
        cvx = ((co - nb / np.maximum(cnt, 1)[:, None]) * vn).sum(1) / 0.02
        P3.append(co[lv[tl]]); N3.append(vn[lv[tl]]); UV.append(uv[tl]); CV.append(np.clip(cvx, -1, 1)[lv[tl]][..., None].astype(np.float32))
        base = len(allv); allv += [Vector(v) for v in co]; allf += [[base + i for i in p.vertices] for p in me.polygons]
    mask, (Pi, Ni, Ci) = raster(np.concatenate(UV), [np.concatenate(P3), np.concatenate(N3), np.concatenate(CV)], N)
    bvh = BVHTree.FromPolygons(allv, allf); rng = np.random.default_rng(4); NR = 12; u1, u2 = rng.random(NR), rng.random(NR)
    dirs = np.stack([np.sqrt(u1) * np.cos(2 * np.pi * u2), np.sqrt(u1) * np.sin(2 * np.pi * u2), np.sqrt(1 - u1)], 1)
    aoh = np.ones((N, N), np.float32); sub = mask.copy(); sub[1::2, :] = False; sub[:, 1::2] = False
    for yy, xx in zip(*np.nonzero(sub)):
        n = Vector(Ni[yy, xx])
        if n.length < 1e-6: continue
        n.normalize(); t = n.orthogonal().normalized(); b2 = n.cross(t); oo = Vector(Pi[yy, xx]) + n * 0.004; occ = 0.0
        for dd in dirs:
            hh = bvh.ray_cast(oo, t * dd[0] + b2 * dd[1] + n * dd[2], 0.6)
            if hh[0] is not None: occ += 1 - hh[3] / 0.6
        aoh[yy, xx] = 1 - occ / NR
    ao = aoh.copy(); ys, xs = np.nonzero(mask & ~sub); ao[ys, xs] = aoh[(ys // 2) * 2, (xs // 2) * 2]
    ao = 0.25 * (ao + np.roll(ao, 1, 0) + np.roll(ao, 1, 1) + np.roll(np.roll(ao, 1, 0), 1, 1))
    idx = np.nonzero(mask); P = Pi[idx]; C = Ci[idx][:, 0]
    grain = fbm(P, 0.03, 3); mott = fbm(P, 0.6, 9); streak = vnoise(P * np.array((1, 1, 0.12), np.float32), 0.05, 31)
    col_ = np.array(TANK_BASE, np.float32)[None, :] * (0.92 + 0.16 * grain[:, None]) * (0.92 + 0.16 * mott[:, None]) * (0.9 + 0.12 * streak[:, None])
    col_ *= np.clip(0.55 + 0.45 * lum[idx], 0.35, 1.35)[:, None]
    dirt = np.clip((1.0 - P[:, 2]) / 1.0, 0, 1) * (0.5 + 0.5 * mott); col_ = col_ * (1 - 0.45 * dirt[:, None]) + np.array((0.36, 0.31, 0.24), np.float32) * 0.45 * dirt[:, None]
    panel = (np.abs(np.mod(P[:, 1] + 0.37, 0.9) - 0.45) < 0.008) | (np.abs(np.mod(P[:, 0] + 0.21, 1.1) - 0.55) < 0.008); col_[panel] *= 0.72
    wear = np.clip(C, 0, 1) * (0.5 + 0.3 * grain); col_ = col_ * (1 - wear[:, None]) + np.array((0.62, 0.61, 0.58), np.float32) * wear[:, None]
    col_ *= (0.35 + 0.65 * np.clip(ao[idx], 0, 1) ** 1.3)[:, None]
    out = o.copy() * 0 + np.array(TANK_BASE, np.float32) * 0.6; out[idx] = np.clip(col_, 0.04, 1)
    filled = mask.copy()
    for it in range(6):
        acc = np.zeros_like(out); cnt = np.zeros((N, N), np.float32)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            acc += np.roll(np.roll(out * filled[..., None], dy, 0), dx, 1); cnt += np.roll(np.roll(filled, dy, 0), dx, 1)
        new = (~filled) & (cnt > 0); out[new] = acc[new] / cnt[new][:, None]; filled |= new
    im = save_image(out, 'tank', TEXDIR)
    for ob in bpy.data.objects:
        if ob.name.startswith('tank_'):
            for m in ob.data.materials:
                for n in m.node_tree.nodes:
                    if n.type == 'TEX_IMAGE': n.image = im
    log('medium tank repainted', int(mask.sum()), 'texels')
def world_uv(me):
    uvl = me.uv_layers.new(name='UVMap'); b2 = bmesh.new(); b2.from_mesh(me); lay = b2.loops.layers.uv['UVMap']
    for f in b2.faces:
        n = f.normal; ax = max(range(3), key=lambda i: abs(n[i])); s = TILE[PM[f.material_index]]
        for l in f.loops:
            p = l.vert.co; u, v = ((p.y, p.z) if ax == 0 else (p.x, p.z) if ax == 1 else (p.x, p.y)); l[lay].uv = (u / s, v / s)
    b2.to_mesh(me); b2.free()

# ---------------------------------------------------------------- tanks
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
def model_light():
    k = Kit(2)
    k.prism([(-2.45, 0.45), (-2.6, 0.75), (-2.05, 1.25), (2.3, 1.25), (2.5, 1.0), (2.4, 0.45)], -0.95, 0.95, 'olive', bev=0.03)
    k.box((0, -0.05, 1.22), (2.7, 4.95, 0.07), 'olive', bev=0.015)
    for sx in (-1, 1): track_side(k, sx, 0.95, 1.33, -2.55, 2.45, 0.08, 0.95, 5, 0.36)
    k.box((0, 1.9, 1.28), (1.6, 0.9, 0.05), 'dark', bev=0.0); k.box((0.6, -1.7, 1.27), (0.5, 0.6, 0.06), 'olive', bev=0.01)
    for sx in (-1, 1): k.lathe([(0.0, 0.0), (0.09, 0.0), (0.09, 0.05), (0.0, 0.06)], T(sx * 0.9, -2.35, 1.0) @ Rx(90), 10, 'bright')
    TP = Vector((0, 0.55, 1.25))
    k.prism([(-0.85 + 0.55, 1.28), (-0.98 + 0.55, 1.55), (-0.72 + 0.55, 1.97), (0.8 + 0.55, 1.97), (0.98 + 0.55, 1.5), (0.88 + 0.55, 1.28)], -0.76, 0.76, 'olive', 'mag', bev=0.025)
    k.lathe([(0.0, 0.0), (0.26, 0.0), (0.26, 0.14), (0.2, 0.18), (0.0, 0.19)], T(0.3, 0.85, 1.97) @ Rx(90), 14, 'olive', 'mag')
    k.box((-0.35, 0.95, 2.0), (0.45, 0.5, 0.05), 'olive', 'mag', bev=0.01); k.box((0.0, 1.55, 1.75), (1.2, 0.35, 0.35), 'olive', 'mag', bev=0.02)
    for sx in (-1, 1): k.box((sx * 0.4, -0.3, 1.86), (0.12, 0.05, 0.05), 'dark', 'mag', bev=0.0)
    TR = Vector((0, -0.42, 1.62))
    k.box((0, -0.5, 1.62), (0.42, 0.2, 0.34), 'olive', 'bolt', bev=0.02)
    k.lathe([(0.085, -0.4), (0.085, -0.95), (0.056, -1.0), (0.056, -3.9), (0.07, -3.92), (0.07, -4.08), (0.04, -4.08), (0.04, -0.4)], T(0, 0, 1.62) @ Rz(180) @ Rz(180), 14, 'olive', 'bolt', loop=True)
    return k, TP, TR
def model_heavy():
    k = Kit(2)
    k.prism([(-3.6, 0.5), (-3.8, 0.9), (-3.0, 1.9), (3.5, 1.9), (3.7, 1.5), (3.6, 0.5)], -1.2, 1.2, 'olive', bev=0.04)
    k.box((0, -0.05, 1.88), (3.6, 7.3, 0.08), 'olive', bev=0.02)
    for sx in (-1, 1):
        track_side(k, sx, 1.2, 1.72, -3.7, 3.6, 0.1, 1.1, 7, 0.4)
        for i in range(4): k.box((sx * 1.8, -2.75 + i * 1.6, 1.0), (0.05, 1.55, 0.85), 'olive', bev=0.012)
    for i in range(3): k.box((0, 2.4 + i * 0.35, 1.94), (2.2, 0.22, 0.04), 'dark', bev=0.0)
    for sx in (-1, 1):
        k.lathe([(0.0, 0.0), (0.12, 0.0), (0.12, 0.06), (0.0, 0.07)], T(sx * 1.0, -3.55, 1.4) @ Rx(90), 10, 'bright')
        k.box((sx * 1.45, -3.0, 1.97), (0.3, 1.0, 0.1), 'wood', bev=0.01)
    TP = Vector((0, 0.3, 1.95))
    k.prism([(-1.6 + 0.3, 1.98), (-1.78 + 0.3, 2.42), (-1.5 + 0.3, 2.95), (1.72 + 0.3, 2.95), (1.95 + 0.3, 2.3), (1.75 + 0.3, 1.98)], -1.45, 1.45, 'olive', 'mag', bev=0.04)
    k.box((0, 2.35, 2.45), (2.4, 0.6, 0.75), 'olive', 'mag', bev=0.03)
    k.lathe([(0.0, 0.0), (0.33, 0.0), (0.33, 0.06), (0.25, 0.1), (0.0, 0.11)], T(0.55, 0.9, 2.95) @ Rx(90), 16, 'olive', 'mag')
    k.box((-0.55, 0.6, 2.98), (0.6, 0.7, 0.06), 'olive', 'mag', bev=0.01)
    for sx in (-1, 1):
        for i in range(3): k.lathe([(0.05, 0.0), (0.05, 0.25), (0.0, 0.26)], T(sx * 1.3, -0.6 + i * 0.12, 2.75) @ Rx(-60) @ Rz(sx * 20), 8, 'steel', 'mag')
    for sx in (-1, 1): k.box((sx * 0.55, -1.15, 2.7), (0.18, 0.05, 0.06), 'dark', 'mag', bev=0.0)
    TR = Vector((0, -1.75, 2.42))
    k.box((0, -1.95, 2.42), (1.1, 0.36, 0.72), 'olive', 'bolt', bev=0.04)
    k.lathe([(0.17, -1.9), (0.17, -2.7), (0.115, -2.8), (0.115, -4.0), (0.155, -4.15), (0.155, -4.6), (0.115, -4.75), (0.115, -6.25), (0.06, -6.25), (0.06, -1.9)],
            T(0, 0, 2.42), 16, 'olive', 'bolt', loop=True)
    k.box((0, -6.42, 2.42), (0.4, 0.34, 0.3), 'olive', 'bolt', bev=0.02)
    for i in range(2):
        for sx in (-1, 1): k.box((sx * 0.2, -6.36 - i * 0.14, 2.42), (0.02, 0.07, 0.2), 'dark', 'bolt', bev=0.0)
    return k, TP, TR
def make_tank(prefix, model, col):
    k, TP, TR = model()
    me = bpy.data.meshes.new(prefix + '_all'); k.bm.to_mesh(me); k.bm.free()
    ob = bpy.data.objects.new(prefix + '_all', me); col.objects.link(ob); smart_uv(ob, 66, 0.003)
    img = tank_texture(ob, 1024, prefix + '_tank'); mat = image_material(prefix + '_tank', img, 0.7, 0.3)
    g = np.empty(len(me.vertices), np.int64); me.attributes['grp'].data.foreach_get('value', g)
    parts = {}
    for part, gi, pivot in (('hull', GRP.index('gun'), Vector((0, 0, 0))), ('turret', GRP.index('mag'), TP), ('barrel', GRP.index('bolt'), TR)):
        b2 = bmesh.new(); b2.from_mesh(me); b2.verts.ensure_lookup_table()
        bmesh.ops.delete(b2, geom=[v for v in b2.verts if g[v.index] != gi], context='VERTS')
        bmesh.ops.translate(b2, verts=b2.verts[:], vec=-pivot)
        pm = bpy.data.meshes.new('%s_%s' % (prefix, part)); b2.to_mesh(pm); b2.free(); pm.materials.append(mat)
        po = bpy.data.objects.new('%s_%s' % (prefix, part), pm); col.objects.link(po); parts[part] = (po, pivot)
        lo = bpy.data.objects.new('%s_%s_lod1' % (prefix, part), pm.copy()); col.objects.link(lo); lo.data.name = lo.name
        dm = lo.modifiers.new('d', 'DECIMATE'); dm.ratio = 0.2
        dg = bpy.context.evaluated_depsgraph_get(); lme = bpy.data.meshes.new_from_object(lo.evaluated_get(dg)); lo.modifiers.clear(); old = lo.data; lo.data = lme; bpy.data.meshes.remove(old)
        lme.name = lo.name; parts[part + '_lod1'] = (lo, pivot)
    hull, turret, barrel = parts['hull'][0], parts['turret'][0], parts['barrel'][0]
    turret.parent = hull; turret.location = TP; barrel.parent = turret; barrel.location = TR - TP
    for part in ('hull', 'turret', 'barrel'):
        lo = parts[part + '_lod1'][0]; lo.parent = parts[part][0]; lo.location = (0, 0, 0)
    bpy.data.objects.remove(ob, do_unlink=True); bpy.data.meshes.remove(me)
    bvy = min(v.co.y for v in barrel.data.vertices); muzzle = TR + Vector((0, bvy, 0))
    hv = [v.co for v in hull.data.vertices]
    info = {'tris': {p: sum(len(f.vertices) - 2 for f in parts[p][0].data.polygons) for p in parts}, 'muzzle': tuple(round(x, 3) for x in muzzle),
            'half_width': round(max(abs(v.x) for v in hv), 3), 'half_length': round(max(abs(v.y) for v in hv), 3), 'height': round(max(v.z for v in hv) if False else
            max([v.co.z + TP.z for v in turret.data.vertices]), 3), 'turret_pivot': tuple(TP), 'trunnion': tuple(TR)}
    log(prefix, info)
    return info
def medium_tank(col):
    with bpy.data.libraries.load(os.path.join(PROOF, 'range.blend'), link=False) as (src, dst):
        dst.objects = ['tank_hull', 'tank_turret', 'tank_barrel', 'tank_hull_lod1', 'tank_turret_lod1', 'tank_barrel_lod1']
    for o in dst.objects: col.objects.link(o)
    shutil.copy(os.path.join(PROOF, 'tex', 'tank.png'), os.path.join(TEXDIR, 'tank.png'))
    for o in dst.objects:
        for m in o.data.materials:
            for n in m.node_tree.nodes:
                if n.type == 'TEX_IMAGE' and n.image: n.image.filepath = '//tex/tank.png'; n.image.reload()
    bpy.context.view_layer.update(); hull = bpy.data.objects['tank_hull']; bar = bpy.data.objects['tank_barrel']
    mw = bar.matrix_world; vy = min((mw @ v.co).y for v in bar.data.vertices)
    far = min(((mw @ v.co) for v in bar.data.vertices), key=lambda p: p.y)
    hv = [hull.matrix_world @ v.co for v in hull.data.vertices]
    info = {'muzzle': tuple(round(x, 3) for x in (0.0, far.y, mw.translation.z)), 'turret_pivot': tuple(round(x, 3) for x in bpy.data.objects['tank_turret'].matrix_world.translation), 'trunnion': tuple(round(x, 3) for x in mw.translation), 'half_width': round(max(abs(v.x) for v in hv), 3), 'half_length': round(max(abs(v.y) for v in hv), 3)}
    log('tank (medium)', info); return info

# ---------------------------------------------------------------- light, bake
def lights(c):
    sd = bpy.data.lights.new('Sun', 'SUN'); sd.energy = SUN_E; sd.color = SUN_COL; sd.angle = math.radians(1.2)
    so = bpy.data.objects.new('Sun', sd); c.objects.link(so)
    L = Vector(SUN_DIR).normalized(); so.rotation_euler = L.to_track_quat('-Z', 'Y').to_euler()
    # a clear late-afternoon sky (Nishita: blue overhead, warm haze toward the sun), its sun placed where the lamp's light comes from
    w = bpy.data.worlds.get('pass_sky') or bpy.data.worlds.new('pass_sky'); scene.world = w; w.use_nodes = True; nt = w.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputWorld'); bg = nt.nodes.new('ShaderNodeBackground'); sky = nt.nodes.new('ShaderNodeTexSky')
    try: sky.sky_type = 'NISHITA'
    except Exception as e: log('sky type', e)
    Sd = (-L).normalized(); el = math.asin(Sd.z); ce = math.cos(el)
    sky.sun_elevation = el; sky.sun_rotation = math.atan2(Sd.x / ce, -Sd.y / ce); sky.sun_disc = False
    sky.air_density = SKY_AIR; sky.dust_density = SKY_DUST; sky.ozone_density = 1.0; sky.altitude = 100.0
    nt.links.new(sky.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = float(OPT.get('skyk', 0.1)); nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
def bake(ob, size, path, passes, samples):
    me = ob.data; me.uv_layers.active = me.uv_layers['Lightmap']
    img = bpy.data.images.new('bake_' + ob.name, size, size, alpha=False, float_buffer=True)
    for m in me.materials:
        n = m.node_tree.nodes.new('ShaderNodeTexImage'); n.name = 'hg_bake'; n.image = img; m.node_tree.nodes.active = n
    scene.render.engine = 'CYCLES'; scene.cycles.samples = samples; scene.cycles.device = 'CPU'
    vl = bpy.context.view_layer
    for o in list(vl.objects):
        if o is not None: o.select_set(False)
    vl.objects.active = ob; ob.select_set(True)
    bpy.ops.object.bake(type='DIFFUSE', pass_filter=passes, margin=4, use_clear=True)
    a = np.array(img.pixels[:], np.float32).reshape(size, size, 4); rgb = a[:, :, :3]; bl = rgb.copy()
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)): bl += np.roll(np.roll(rgb, dy, 0), dx, 1)
    a[:, :, :3] = bl / 5.0; img.pixels.foreach_set(a.ravel()); img.filepath_raw = os.path.join(BASE, path); img.file_format = 'OPEN_EXR'; img.save()
    for m in me.materials:
        n = m.node_tree.nodes.get('hg_bake')
        if n: m.node_tree.nodes.remove(n)
    me.uv_layers.active = me.uv_layers['UVMap']; bpy.data.images.remove(img)
    l = rgb.reshape(-1, 3) @ np.array((0.3, 0.59, 0.11), np.float32); l = l[l > 0.001]
    log('baked', path, 'p25 %.2f median %.2f p90 %.2f' % tuple(np.percentile(l, [25, 50, 90])))

# ---------------------------------------------------------------- run
pictures()
tc_ = coll('terrain'); wc = coll('_work'); lights(wc)
tme, grid = terrain_mesh(); ter = bpy.data.objects.new('terrain', tme); tc_.objects.link(ter)
bme = backdrop_mesh(); bd = bpy.data.objects.new('backdrop', bme); tc_.objects.link(bd); bd['hg_lightmap'] = 'tex/pass_backdrop_light.exr'; bd['hg_lightmap_size'] = 512
build_props(); pme = bpy.data.meshes.new('props'); bm.to_mesh(pme); bm.free()
mats = {k: tiled_material(k, PIC[k]) for k in PM}
for k in PM: pme.materials.append(mats[k])
world_uv(pme); pme.polygons.foreach_set('use_smooth', [False] * len(pme.polygons))
pr = bpy.data.objects.new('props', pme); tc_.objects.link(pr); pr['hg_lightmap'] = 'tex/pass_props_light.exr'; pr['hg_lightmap_size'] = 2048
lu = pme.uv_layers.new(name='Lightmap'); pme.uv_layers.active = lu; smart_uv(pr, 66, 0.002); pme.uv_layers.active = pme.uv_layers['UVMap']
macro = macro_material('terrain_macro'); bmacro = macro_material('backdrop_macro'); detail = tiled_material('ground_detail', PIC['ground_detail'], 1.0)
tme.materials.append(macro); bme.materials.append(bmacro)
for o in (ter, bd, pr):
    o.data.calc_loop_triangles(); log(o.name, len(o.data.loop_triangles), 'triangles')
S = int(OPT.get('samples', 32))
if 'nobake' not in OPT:
    bake(ter, 2048, 'tex/pass_light.exr', {'COLOR', 'DIRECT', 'INDIRECT'}, S)
    bake(bd, 512, 'tex/pass_backdrop_light.exr', {'COLOR', 'DIRECT', 'INDIRECT'}, max(8, S // 2))
    bake(pr, 2048, 'tex/pass_props_light.exr', {'DIRECT', 'INDIRECT'}, S)
tme.materials[0] = detail; bme.materials[0] = detail
TK = {}
for name, fn in (('tank', None), ('light', model_light), ('heavy', model_heavy)):
    c = coll(name); TK[name] = medium_tank(c) if fn is None else make_tank(name, fn, c)
    if fn is None: medium_texture([bpy.data.objects['tank_hull'], bpy.data.objects['tank_turret'], bpy.data.objects['tank_barrel']])
parts = [p for n in ('tank', 'light', 'heavy') for p in (n + '_hull', n + '_turret', n + '_barrel', n + '_hull_lod1', n + '_turret_lod1', n + '_barrel_lod1')]
cfg = {'out': '../../Steel Storm Remastered/assets/pass',
       'world': {'collections': ['terrain'], 'lightmap': 'tex/pass_light.exr', 'lmSize': 2048, 'gain': {'ground_detail': 2}, 'plain': ['ground_detail']},
       'parts': parts, 'heights': {'cell': 1.0, 'ground': ['terrain']}, 'probes': {'cell': 2.0, 'height': 1.5, 'samples': 96, 'follow': True},
       'sky': {'width': 1024}, 'maxTexture': 1024, 'area': ['terrain']}
with open(os.path.join(BASE, 'pass.export.json'), 'w') as f: json.dump(cfg, f, indent=1)
with open(os.path.join(CACHE, 'pass_tanks.json'), 'w') as f: json.dump(TK, f, indent=1)
bpy.ops.wm.save_mainfile(); log('saved', bpy.data.filepath)
if 'preview' in OPT:
    cd = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cd); scene.collection.objects.link(cam); scene.camera = cam
    cd.sensor_fit = 'VERTICAL'; cd.angle_y = math.radians(45); cd.clip_end = 2000
    tme.materials[0] = macro; bme.materials[0] = bmacro
    for n, x in (('light', -12.0), ('heavy', 0.0), ('tank', 12.0)):
        h = bpy.data.objects[n + '_hull']; h.location = (VILLAGE[0] + x, VILLAGE[1] - 52.0, gz(VILLAGE[0] + x, VILLAGE[1] - 52.0))
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 16
    try: scene.cycles.use_denoising = True
    except Exception: pass
    scene.render.resolution_x, scene.render.resolution_y = 480, 270
    vx, vy = VILLAGE
    views = [((vx - 8, vy - 75, gz(vx - 8, vy - 75) + 4), (vx, vy - 52, gz(vx, vy - 52) + 1)), ((vx - 60, vy - 80, gz(vx - 60, vy - 80) + 14), (vx, vy, gz(vx, vy))),
             ((-150, -150, gz(-150, -150) + 6), (60, 60, 5)), ((-60, 30, gz(-60, 30) + 3), (-95, 70, gz(-95, 70) + 3)), ((vx + 5, vy - 21, gz(vx + 5, vy - 21) + 2), (vx + 5, vy + 30, gz(vx, vy) + 2)),
             ((140, -150, gz(140, -150) + 25), (-40, 60, 0))]
    big = np.ones((3 * 270, 2 * 480, 4), np.float32)
    for i, (p, t) in enumerate(views):
        cam.location = p; cam.rotation_euler = (Vector(t) - Vector(p)).to_track_quat('-Z', 'Y').to_euler()
        tmp = os.path.join(CACHE, '_v%d.png' % i); scene.render.filepath = tmp; bpy.ops.render.render(write_still=True)
        im = bpy.data.images.load(tmp); a = np.array(im.pixels[:], np.float32).reshape(270, 480, 4); bpy.data.images.remove(im); os.remove(tmp)
        r, c2 = divmod(i, 2); big[(2 - r) * 270:(3 - r) * 270, c2 * 480:(c2 + 1) * 480] = a
    im = bpy.data.images.new('grid', 960, 810); im.pixels.foreach_set(big.ravel()); im.filepath_raw = os.path.join(CACHE, 'pass_views.png'); im.file_format = 'PNG'; im.save()
    log('preview pass_views.png')
log('done')
