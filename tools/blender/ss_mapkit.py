# Steel Storm Remastered: the battlefield kit shared by make_harbor.py, make_farmland.py and make_city.py (the older maps carry their own
# copies of the same code: make_valley/dunes/pass/works.py). Same conventions as those: a 420 m heightfield `terrain` (colour x light in
# one baked picture, the grey `ground_detail` tiling on top), a far `backdrop` ring, one `props` mesh (a material per face, its own light
# picture), optional flat `water` (its own light picture; it is not ground, so the height map's tops block it: tanks cannot drive into it),
# the three tanks (tools/blender/ss_tanks.py), the export config. A map script sets the module's hooks and calls run():
#   import ss_mapkit as K; K.NAME = 'harbor'; K.height = my_height; K.macro_colour = my_colour; K.build_props = my_props; K.run()
import bpy, bmesh, math, os, sys, json, random, shutil
import numpy as np
from mathutils import Vector, Matrix
from hgkit import *
def rRx(a): return Matrix.Rotation(a, 4, 'X')      # map props: radians
def rRy(a): return Matrix.Rotation(a, 4, 'Y')
def rRz(a): return Matrix.Rotation(a, 4, 'Z')
ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OPT = dict((a.split('=', 1) + ['1'])[:2] for a in ARGV)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = os.path.join(ROOT, 'art', 'steelstorm'); TEXDIR = os.path.join(BASE, 'tex'); CACHE = os.path.join(BASE, '_cache'); PROOF = os.path.join(ROOT, 'art', 'proof')
ASHTEX = os.path.join(ROOT, 'art', 'ashfall', 'tex')
for d in (TEXDIR, CACHE): os.makedirs(d, exist_ok=True)
scene = bpy.context.scene
HALF = 210.0
# ---- hooks the map script sets
NAME = 'map'
def height(x, y): return np.zeros(np.shape(x))
def macro_colour(x, y, z, slope): return np.full(np.shape(x) + (3,), 0.3)
LINEAR = (2.0, 1.25)     # the maps give display-like colours; the bake wants linear ones (valley's grass is 0.085, 0.11, 0.035): c ** 2.0 * 1.25
def lin(c): return np.clip(np.clip(c, 0, 1) ** LINEAR[0] * LINEAR[1], 0.01, 1)
def build_props(): pass
WATER = []                     # [(z, [(x, y), ...] polygon)]: flat water surfaces (their own light picture)
VIEWS = []                     # preview cameras [(eye, target)]
SUN_DIR, SUN_E, SUN_COL, SKY_AIR, SKY_DUST = (0.62, 0.48, -0.5), 4.4, (1.0, 0.88, 0.72), 1.2, 3.0
BD_A, BD_B = 22.0, 26.0
SEA = None                     # backdrop: lambda px, py -> 1 where the far ring is sea (stays flat at sea level), else 0
SEA_Z = 0.0
PM = ['stone', 'rock', 'bark', 'foliage', 'concrete', 'rust', 'wood', 'metal', 'brick']
TILE = {'stone': 3.0, 'rock': 4.0, 'bark': 2.0, 'foliage': 3.0, 'concrete': 3.0, 'rust': 2.5, 'wood': 2.0, 'metal': 2.5, 'brick': 3.0, 'plaster': 3.0, 'asphalt': 4.0,
        'sandbag': 1.5, 'glass': 3.0, 'red': 2.5, 'blue': 2.5, 'green': 2.5, 'orange': 2.5, 'water': 6.0, 'hedge': 2.5, 'tile': 2.0, 'grave': 1.0}
# ---------------------------------------------------------------- pictures and materials
PIC = {}
def copy_pic(name, src=None, folder=None):
    shutil.copy(os.path.join(folder or os.path.join(PROOF, 'tex'), (src or name) + '.png'), os.path.join(TEXDIR, name + '.png'))
    im = bpy.data.images.load(os.path.join(TEXDIR, name + '.png')); im.name = name; im.filepath = '//tex/' + name + '.png'; return im
def tinted(name, src, mul, add=(0, 0, 0)):
    a = np.array(PIC[src].pixels[:], np.float32).reshape(PIC[src].size[1], PIC[src].size[0], 4)[:, :, :3]
    g = a.mean(2, keepdims=True); out = np.clip(g * np.array(mul, np.float32) + np.array(add, np.float32), 0.02, 1)
    return save_image(out, name, TEXDIR)
def water_px(N=512, seed=3):
    n1 = ptile(N, 6, seed); n2 = ptile(N, 24, seed + 4, 3); n3 = ptile(N, 60, seed + 9, 2)
    base = np.array((0.07, 0.11, 0.12), np.float32)
    img = base * (0.8 + 0.4 * n1[..., None]) * (0.85 + 0.3 * n2[..., None]); img += (np.abs(n3 - 0.5) < 0.02)[..., None] * 0.05
    return np.clip(img, 0.02, 1)
def hedge_px(N=512, seed=7):
    """dense leaves: dark green with light-catching leaf clusters"""
    rng = np.random.default_rng(seed); n1 = ptile(N, 8, seed); n2 = ptile(N, 40, seed + 5, 3)
    img = np.array((0.10, 0.16, 0.06), np.float32) * (0.7 + 0.6 * n1[..., None]) * (0.7 + 0.6 * n2[..., None])
    for k in range(int(N * N / 90)):
        x, y = rng.integers(0, N, 2); r = rng.integers(1, 4); img[max(0, y - r):y + r, max(0, x - r):x + r] *= rng.uniform(0.6, 1.5)
    return np.clip(img, 0.02, 1)
def tiled_material(name, img, rough=0.9):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != 'BSDF_PRINCIPLED' and n.type != 'OUTPUT_MATERIAL': nt.nodes.remove(n)
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = img; uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'UVMap'
    nt.links.new(uvn.outputs['UV'], tx.inputs['Vector']); nt.links.new(tx.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = 0.0; return m
def macro_material(name):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    at = nt.nodes.new('ShaderNodeAttribute'); at.attribute_name = 'macro'; nt.links.new(at.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 1.0; return m
def pictures():
    for k, src in (('ground_detail', None), ('rock', None), ('bark', None), ('foliage', None), ('concrete', None), ('rust', None), ('wood', None), ('metal', 'metal_painted'), ('brick', None),
                   ('asphalt', None)):
        PIC[k] = copy_pic(k, src)
    for k, src in (('plaster', 'depot_plaster'), ('sandbag', 'depot_sandbag')):
        try: PIC[k] = copy_pic(k, src, ASHTEX)
        except Exception as e: log('picture', k, e); PIC[k] = PIC['concrete']
    a = np.array(PIC['rock'].pixels[:], np.float32).reshape(PIC['rock'].size[1], PIC['rock'].size[0], 4)
    PIC['stone'] = save_image(np.clip(a[:, :, :3] * np.array((1.12, 1.08, 1.0), np.float32) * 1.15, 0.05, 1), 'stone', TEXDIR)
    PIC['red'] = tinted('cont_red', 'metal', (0.95, 0.30, 0.22)); PIC['blue'] = tinted('cont_blue', 'metal', (0.25, 0.42, 0.75))
    PIC['green'] = tinted('cont_green', 'metal', (0.32, 0.6, 0.38)); PIC['orange'] = tinted('cont_orange', 'metal', (1.0, 0.6, 0.22))
    PIC['water'] = save_image(water_px(), NAME + '_water', TEXDIR); PIC['hedge'] = save_image(hedge_px(), 'hedge', TEXDIR)
    PIC['glass'] = tinted('window', 'concrete', (0.26, 0.28, 0.31))           # dark blind windows (pure black bands read badly)
    PIC['tile'] = tinted('roof_tile', 'brick', (0.9, 0.42, 0.3)); PIC['grave'] = tinted('grave_stone', 'concrete', (0.95, 0.95, 0.92), (0.05, 0.05, 0.05))
# ---------------------------------------------------------------- props: one mesh, material per face
bm = None; MI = {}
def _new(before): return [f for f in bm.faces if f not in before]
def gz(x, y): return float(height(x, y))
def mat_i(mat):
    if mat not in MI: MI[mat] = len(MI)
    return MI[mat]
def box(c, s, mat, rz=0.0, sink=0.4, tilt=(0.0, 0.0)):
    before = set(bm.faces)
    M = T(c[0], c[1], c[2] - sink) @ rRz(rz) @ rRx(tilt[0]) @ rRy(tilt[1]) @ Matrix.Diagonal((s[0], s[1], s[2] + sink, 1)) @ T(0, 0, 0.5)
    bmesh.ops.create_cube(bm, size=1.0, matrix=M)
    for f in _new(before): f.material_index = mat_i(mat)
def blob(c, r, mat, squash=1.0, seed=0, sub=1):
    before = set(bm.faces); bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0, matrix=T(*c) @ Matrix.Diagonal((r, r, r * squash, 1)))
    new = _new(before); rng = random.Random(seed)
    for v in {v for f in new for v in f.verts}: v.co = Vector(c) + (v.co - Vector(c)) * rng.uniform(0.8, 1.15)
    for f in new: f.material_index = mat_i(mat)
def cyl(c, r, h, mat, seg=7, r2=None, M=None):
    before = set(bm.faces)
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r2 if r2 is not None else r, depth=h, matrix=(M or Matrix()) @ T(c[0], c[1], c[2] + h / 2))
    for f in _new(before): f.material_index = mat_i(mat)
def beam(p0, p1, th, mat, th2=None):
    p0, p1 = Vector(p0), Vector(p1); d = p1 - p0; L = d.length
    if L < 1e-4: return
    q = d.normalized().to_track_quat('Y', 'Z'); before = set(bm.faces)
    bmesh.ops.create_cube(bm, size=1.0, matrix=T(*((p0 + p1) / 2)) @ q.to_matrix().to_4x4() @ Matrix.Diagonal((th, L, th2 or th, 1)))
    for f in _new(before): f.material_index = mat_i(mat)
def prism_xz(pts, y0, y1, mat, M):
    """a side profile [(lx, lz)] in a local frame M, extruded along local y from y0 to y1"""
    before = set(bm.faces)
    a = [bm.verts.new(M @ Vector((x, y0, z))) for x, z in pts]; b = [bm.verts.new(M @ Vector((x, y1, z))) for x, z in pts]
    bm.faces.new(a); bm.faces.new(b[::-1])
    for i in range(len(pts)):
        j = (i + 1) % len(pts); bm.faces.new((a[i], a[j], b[j], b[i]))
    new = _new(before); bmesh.ops.recalc_face_normals(bm, faces=new)
    for f in new: f.material_index = mat_i(mat)
def tree2(x, y, s=1.0, z=None, sub=2):
    """a trunk with two forks and layered foliage clumps"""
    z = gz(x, y) if z is None else z; h = random.uniform(4.0, 6.0) * s
    cyl((x, y, z - 0.3), 0.32 * s, h * 0.7 + 0.3, 'bark', 7, 0.2 * s)
    for k in range(2):
        a = random.uniform(0, 6.28); beam((x, y, z + h * 0.6), (x + math.cos(a) * 1.2 * s, y + math.sin(a) * 1.2 * s, z + h + 0.6 * s), 0.18 * s, 'bark')
    for dz, r, n in ((0.0, 2.9, 2), (1.3, 2.3, 2), (2.6, 1.5, 1)):
        for i in range(n):
            a = random.uniform(0, 6.28); off = (r * 0.55 if n > 1 else 0.0) * s
            blob((x + math.cos(a) * off, y + math.sin(a) * off, z + h + dz * s), r * s * random.uniform(0.85, 1.1), 'foliage', 0.62, random.randint(0, 999), min(sub, 2 if r * s > 2.5 else 1))
def truck(x, y, rz, burnt=True):
    z = gz(x, y); c, s = math.cos(rz), math.sin(rz)
    def at(lx, ly): return (x + c * lx - s * ly, y + s * lx + c * ly)
    m = 'rust' if burnt else 'metal'
    box((*at(0, 1.6), z + 0.6), (2.3, 2.0, 1.9), m, rz); box((*at(0, -1.3), z + 0.6), (2.4, 4.2, 1.2), 'metal', rz); box((*at(0, -1.3), z + 1.8), (2.3, 4.0, 1.4), m, rz, sink=0.0)
    for lx in (-1.1, 1.1):
        for ly in (1.6, -0.6, -2.4):
            px, py = at(lx, ly); cyl((px, py, z), 0.5, 0.35, 'rust', 8, M=None)
def car(x, y, rz):
    z = gz(x, y); c, s = math.cos(rz), math.sin(rz)
    def at(lx, ly): return (x + c * lx - s * ly, y + s * lx + c * ly)
    box((x, y, z + 0.25), (1.8, 4.3, 0.75), 'rust', rz); box((*at(0, 0.3), z + 1.0), (1.6, 2.2, 0.55), 'rust', rz, sink=0.0)
def hedgehog(x, y, rz):
    z = gz(x, y)
    for a in (0.0, 2.09, 4.19):
        d = Vector((math.cos(rz + a) * 0.9, math.sin(rz + a) * 0.9, 0.0))
        beam(Vector((x, y, z)) - d + Vector((0, 0, 0.1)), Vector((x, y, z)) + d + Vector((0, 0, 1.4)), 0.15, 'metal')
def sandbags(x0, y0, x1, y1, h=1.1):
    L = math.hypot(x1 - x0, y1 - y0); rz = math.atan2(y1 - y0, x1 - x0); n = max(1, int(L / 1.2))
    for k in range(n):
        t = (k + 0.5) / n; x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t; box((x, y, gz(x, y)), (L / n + 0.04, 1.0, h + random.uniform(-0.08, 0.08)), 'sandbag', rz + random.uniform(-0.05, 0.05))
def world_uv(me, mats):
    uvl = me.uv_layers.new(name='UVMap'); b2 = bmesh.new(); b2.from_mesh(me); lay = b2.loops.layers.uv['UVMap']
    for f in b2.faces:
        n = f.normal; ax = max(range(3), key=lambda i: abs(n[i])); s = TILE.get(mats[f.material_index], 3.0)
        for l in f.loops:
            p = l.vert.co; u, v = ((p.y, p.z) if ax == 0 else (p.x, p.z) if ax == 1 else (p.x, p.y)); l[lay].uv = (u / s, v / s)
    b2.to_mesh(me); b2.free()
# ---------------------------------------------------------------- ground
def terrain_mesh(N=150):
    xs = np.linspace(-HALF, HALF, N + 1); X, Y = np.meshgrid(xs, xs, indexing='ij'); Z = height(X, Y)
    gx, gy = np.gradient(Z, xs, xs); slope = np.hypot(gx, gy)
    inner = (np.abs(X) < HALF - 5) & (np.abs(Y) < HALF - 5)
    log('terrain: height %.1f..%.1f m, steepest %.1f deg; share over 22 deg %.3f%%' % (Z.min(), Z.max(), math.degrees(math.atan(slope[inner].max())), 100 * float((slope[inner] > math.tan(math.radians(22))).mean())))
    col_ = lin(macro_colour(X, Y, Z, slope))
    verts = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1); idx = np.arange((N + 1) ** 2).reshape(N + 1, N + 1)
    quads = np.stack([idx[:-1, :-1].ravel(), idx[1:, :-1].ravel(), idx[1:, 1:].ravel(), idx[:-1, 1:].ravel()], 1)
    me = bpy.data.meshes.new('terrain'); me.from_pydata(verts.tolist(), [], quads.tolist())
    uv = me.uv_layers.new(name='UVMap'); lm = me.uv_layers.new(name='Lightmap'); lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get('vertex_index', lv)
    p = verts[lv]; uv.data.foreach_set('uv', (p[:, :2] / 8.0).astype(np.float32).ravel()); lm.data.foreach_set('uv', ((p[:, :2] + HALF) / (2 * HALF)).astype(np.float32).ravel())
    ca = me.color_attributes.new('macro', 'FLOAT_COLOR', 'POINT'); ca.data.foreach_set('color', np.c_[col_.reshape(-1, 3), np.ones(len(verts))].astype(np.float32).ravel())
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons)); me.update()
    return me
def backdrop_mesh(N=150):
    xs = np.linspace(-HALF, HALF, N + 1); edge = []
    for t in xs[:-1]: edge.append((t, -HALF))
    for t in xs[:-1]: edge.append((HALF, t))
    for t in xs[::-1][:-1]: edge.append((t, HALF))
    for t in xs[::-1][:-1]: edge.append((-HALF, t))
    edge = np.array(edge); M = len(edge); rings = [0.0, 6, 18, 40, 80, 140, 220, 320, 420]; verts = []
    for k, dd in enumerate(rings):
        ang = np.arctan2(edge[:, 1], edge[:, 0]); r0 = np.hypot(edge[:, 0], edge[:, 1]); r = r0 + dd * (1 + 0.3 * (1 - np.abs(np.cos(2 * ang))))
        px, py = r * np.cos(ang), r * np.sin(ang)
        hz = height(np.clip(px, -HALF, HALF), np.clip(py, -HALF, HALF)) if k == 0 else height(edge[:, 0], edge[:, 1]) * max(0.0, 1 - dd / 30.0)
        if k > 0:
            hill = (dd / 420.0) ** 0.7 * (BD_A + BD_B * vn2(px, py, 140.0, 21) + 10 * vn2(px, py, 40.0, 23)) - 0.4
            if SEA is not None: s = SEA(px, py); hz = hz * (1 - s) + (SEA_Z - 4.0) * s + hill * (1 - s)
            else: hz = hz + hill
        verts += list(zip(px, py, hz))
    faces = [(k * M + i, (k + 1) * M + i, (k + 1) * M + (i + 1) % M, k * M + (i + 1) % M) for k in range(len(rings) - 1) for i in range(M)]
    me = bpy.data.meshes.new('backdrop'); me.from_pydata(verts, [], faces); vv = np.array(verts)
    uv = me.uv_layers.new(name='UVMap'); lm = me.uv_layers.new(name='Lightmap'); lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get('vertex_index', lv)
    p = vv[lv]; uv.data.foreach_set('uv', (p[:, :2] / 8.0).astype(np.float32).ravel()); lm.data.foreach_set('uv', ((p[:, :2] + 700) / 1400).astype(np.float32).ravel())
    col_ = lin(macro_colour(vv[:, 0], vv[:, 1], vv[:, 2], np.zeros(len(vv)))) * 0.95
    ca = me.color_attributes.new('macro', 'FLOAT_COLOR', 'POINT'); ca.data.foreach_set('color', np.c_[col_, np.ones(len(vv))].astype(np.float32).ravel())
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons)); me.update()
    return me
def vn2(x, y, scale, seed):
    P = np.stack([np.asarray(x, np.float32).ravel(), np.asarray(y, np.float32).ravel(), np.zeros(np.size(x), np.float32)], 1)
    return vnoise(P, scale, seed).reshape(np.shape(x))
def seg_dist(x, y, a):
    x0, y0, x1, y1 = a; dx, dy = x1 - x0, y1 - y0; L2 = dx * dx + dy * dy
    t = np.clip(((x - x0) * dx + (y - y0) * dy) / L2, 0, 1); return np.hypot(x - x0 - t * dx, y - y0 - t * dy)
def water_mesh():
    """flat water surfaces: a triangulated polygon each, world-tiled UVs, a planar light layout"""
    verts, faces, strips = [], [], []
    for z, poly in WATER:
        if z == 'strip':          # ('strip', left [(x, y, z)], right [(x, y, z)]): a ribbon of quads (a stream)
            L_, R_ = poly; b = len(verts); verts += list(L_) + list(R_); n = len(L_)
            strips += [(b + i, b + i + 1, b + n + i + 1, b + n + i) for i in range(n - 1)]; continue
        b = len(verts); verts += [(x, y, z) for x, y in poly]; faces.append(tuple(range(b, b + len(poly))))
    me = bpy.data.meshes.new('water'); me.from_pydata(verts, [], faces + strips)
    b2 = bmesh.new(); b2.from_mesh(me); bmesh.ops.triangulate(b2, faces=b2.faces[:])
    if not strips: bmesh.ops.subdivide_edges(b2, edges=b2.edges[:], cuts=2)
    b2.to_mesh(me); b2.free()
    for p in me.polygons:
        if p.normal.z < 0: p.flip()
    vv = np.array([v.co[:] for v in me.vertices]); lo, hi = vv[:, :2].min(0), vv[:, :2].max(0)
    uv = me.uv_layers.new(name='UVMap'); lm = me.uv_layers.new(name='Lightmap'); lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get('vertex_index', lv)
    p = vv[lv]; uv.data.foreach_set('uv', (p[:, :2] / TILE['water']).astype(np.float32).ravel()); lm.data.foreach_set('uv', ((p[:, :2] - lo) / max(hi - lo)).astype(np.float32).ravel())
    return me
# ---------------------------------------------------------------- light, bake
def lights(c):
    sd = bpy.data.lights.new('Sun', 'SUN'); sd.energy = SUN_E; sd.color = SUN_COL; sd.angle = math.radians(1.2)
    so = bpy.data.objects.new('Sun', sd); c.objects.link(so)
    L = Vector(SUN_DIR).normalized(); so.rotation_euler = L.to_track_quat('-Z', 'Y').to_euler()
    w = bpy.data.worlds.get(NAME + '_sky') or bpy.data.worlds.new(NAME + '_sky'); scene.world = w; w.use_nodes = True; nt = w.node_tree
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
def run():
    global bm
    from ss_tanks import build_tanks, TANK_PARTS
    if not bpy.data.filepath.replace('\\', '/').endswith('art/steelstorm/%s.blend' % NAME):
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, NAME + '.blend')); log('created', bpy.data.filepath)
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    for c in list(bpy.data.collections): bpy.data.collections.remove(c)
    for cl in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.images):
        for d in list(cl):
            if d.users == 0: cl.remove(d)
    scene.render.fps = 30; random.seed(11)
    def coll(name):
        c = bpy.data.collections.new(name); scene.collection.children.link(c); return c
    pictures()
    tc_ = coll('terrain'); wc = coll('_work'); lights(wc)
    tme = terrain_mesh(); ter = bpy.data.objects.new('terrain', tme); tc_.objects.link(ter)
    bme = backdrop_mesh(); bd = bpy.data.objects.new('backdrop', bme); tc_.objects.link(bd); bd['hg_lightmap'] = 'tex/%s_backdrop_light.exr' % NAME; bd['hg_lightmap_size'] = 512
    bm = bmesh.new(); MI.clear(); build_props(); pme = bpy.data.meshes.new('props'); bm.to_mesh(pme); bm.free()
    mats_ = sorted(MI, key=lambda k: MI[k]); mats = {k: tiled_material(k, PIC[k]) for k in mats_}
    for k in mats_: pme.materials.append(mats[k])
    world_uv(pme, mats_); pme.polygons.foreach_set('use_smooth', [False] * len(pme.polygons))
    pr = bpy.data.objects.new('props', pme); tc_.objects.link(pr); pr['hg_lightmap'] = 'tex/%s_props_light.exr' % NAME; pr['hg_lightmap_size'] = 2048
    lu = pme.uv_layers.new(name='Lightmap'); pme.uv_layers.active = lu; smart_uv(pr, 66, 0.002); pme.uv_layers.active = pme.uv_layers['UVMap']
    objs = [ter, bd, pr]
    if WATER:
        wme = water_mesh(); wme.materials.append(tiled_material('water', PIC['water'], 0.2)); wo = bpy.data.objects.new('water', wme); tc_.objects.link(wo)
        wo['hg_lightmap'] = 'tex/%s_water_light.exr' % NAME; wo['hg_lightmap_size'] = 256; objs.append(wo)
    macro = macro_material('terrain_macro'); bmacro = macro_material('backdrop_macro'); detail = tiled_material('ground_detail', PIC['ground_detail'], 1.0)
    tme.materials.append(macro); bme.materials.append(bmacro)
    for o in objs:
        o.data.calc_loop_triangles(); log(o.name, len(o.data.loop_triangles), 'triangles')
    S = int(OPT.get('samples', 32))
    if 'nobake' not in OPT:
        bake(ter, 2048, 'tex/%s_light.exr' % NAME, {'COLOR', 'DIRECT', 'INDIRECT'}, S)
        bake(bd, 512, 'tex/%s_backdrop_light.exr' % NAME, {'COLOR', 'DIRECT', 'INDIRECT'}, max(8, S // 2))
        bake(pr, 2048, 'tex/%s_props_light.exr' % NAME, {'DIRECT', 'INDIRECT'}, S)
        if WATER: bake(wo, 256, 'tex/%s_water_light.exr' % NAME, {'DIRECT', 'INDIRECT'}, max(8, S // 2))
    tme.materials[0] = detail; bme.materials[0] = detail
    TK = build_tanks(scene)
    cfg = {'out': '../../Steel Storm Remastered/assets/' + NAME,
           'world': {'collections': ['terrain'], 'lightmap': 'tex/%s_light.exr' % NAME, 'lmSize': 2048, 'gain': {'ground_detail': 2}, 'plain': ['ground_detail']},
           'parts': TANK_PARTS, 'heights': {'cell': 1.0, 'ground': ['terrain']}, 'probes': {'cell': 2.0, 'height': 1.5, 'samples': 96, 'follow': True},
           'sky': {'width': 1024}, 'maxTexture': 1024, 'area': ['terrain']}
    with open(os.path.join(BASE, NAME + '.export.json'), 'w') as f: json.dump(cfg, f, indent=1)
    with open(os.path.join(CACHE, NAME + '_tanks.json'), 'w') as f: json.dump(TK, f, indent=1)
    bpy.ops.wm.save_mainfile(); log('saved', bpy.data.filepath)
    if 'preview' in OPT and VIEWS:
        cd = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cd); scene.collection.objects.link(cam); scene.camera = cam
        cd.sensor_fit = 'VERTICAL'; cd.angle_y = math.radians(45); cd.clip_end = 2000
        tme.materials[0] = macro; bme.materials[0] = bmacro
        scene.render.engine = 'CYCLES'; scene.cycles.samples = 12
        try: scene.cycles.use_denoising = True
        except Exception: pass
        scene.render.resolution_x, scene.render.resolution_y = 480, 270; big = np.ones((3 * 270, 2 * 480, 4), np.float32)
        for i, (p, t) in enumerate(VIEWS[:6]):
            cam.location = p; cam.rotation_euler = (Vector(t) - Vector(p)).to_track_quat('-Z', 'Y').to_euler()
            tmp = os.path.join(CACHE, '_v%d.png' % i); scene.render.filepath = tmp; bpy.ops.render.render(write_still=True)
            im = bpy.data.images.load(tmp); a = np.array(im.pixels[:], np.float32).reshape(270, 480, 4); bpy.data.images.remove(im); os.remove(tmp)
            r, c2 = divmod(i, 2); big[(2 - r) * 270:(3 - r) * 270, c2 * 480:(c2 + 1) * 480] = a
        im = bpy.data.images.new('grid', 960, 810); im.pixels.foreach_set(big.ravel()); im.filepath_raw = os.path.join(CACHE, NAME + '_views.png'); im.file_format = 'PNG'; im.save()
        log('preview', NAME + '_views.png')
    log('done')
