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
from hgkit import T
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
        'sandbag': 1.5, 'hay': 1.6, 'glass': 3.0, 'red': 2.5, 'blue': 2.5, 'green': 2.5, 'orange': 2.5, 'water': 6.0, 'hedge': 2.5, 'tile': 2.0, 'grave': 1.0}
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
def leaves_px(N=512, seed=7, mid=(0.30, 0.42, 0.16), lit=(0.52, 0.62, 0.24), deep=(0.09, 0.15, 0.06), n=1400, r=(5, 15), warm=0.10):
    """a canopy of leaf clumps (wraps at the edges; values as stored in the picture, sRGB): each clump lit on its upper side and darker
    towards its lower side, deep shade in the gaps, a slow yellow-green / blue-green drift across the picture. Foliage and hedges
    read as leaves in light and shade instead of flat dark green (the old hedge picture averaged 0.14: black blocks in the game)."""
    rng = np.random.default_rng(seed); mid, lit, deep = (np.array(c, np.float32) for c in (mid, lit, deep))
    hue = ptile(N, 3, seed + 1, 2)[..., None] - 0.5; fine = ptile(N, 64, seed + 3, 2)[..., None]
    img = np.broadcast_to(deep, (N, N, 3)).copy() * (0.85 + 0.3 * fine); top = np.full((N, N), -1.0, np.float32)
    for k in range(n):
        cx, cy = rng.integers(0, N, 2); rr = rng.uniform(*r); R = int(rr) + 1; ex = rng.uniform(0.7, 1.0)
        yy, xx = np.mgrid[-R:R + 1, -R:R + 1].astype(np.float32); d = np.sqrt((xx / ex) ** 2 + yy ** 2) / rr; m = d < 1
        ys = (cy + yy.astype(int)) % N; xs = (cx + xx.astype(int)) % N
        z = rng.random() + (1 - d) * 0.25                       # painter's order by a random depth: nearer clumps cover farther ones
        cover = m & (z > top[ys, xs])
        if not cover.any(): continue
        sh = np.clip(0.55 - 0.45 * yy / rr + 0.15 * xx / rr, 0, 1) * (1 - 0.35 * d ** 3)    # lit from above (v grows up the picture)
        c = deep[None, None] + (mid - deep)[None, None] * np.clip(sh * 1.6, 0, 1)[..., None] + (lit - mid)[None, None] * np.clip(sh * 1.6 - 1, 0, 1)[..., None] ** 1.2
        c = c * rng.uniform(0.88, 1.12)
        img[ys[cover], xs[cover]] = c[cover]; top[ys[cover], xs[cover]] = z[cover]
    img = img * (0.9 + 0.2 * fine) * (1 + np.concatenate([hue * warm * 1.2, hue * 0.0, -hue * warm * 2.0], 2))
    return np.clip(img, 0.02, 1)
def hedge_px(N=512, seed=7):
    """dense hedge leaves: a little darker and bluer than tree crowns, small clumps"""
    return leaves_px(N, seed, (0.28, 0.40, 0.15), (0.46, 0.57, 0.22), (0.11, 0.18, 0.07), 2200, (4, 11))
def foliage_px(N=512, seed=11, tone=1.0):
    """tree crowns (and pines): bigger leaf clumps, a touch warmer"""
    return np.clip(leaves_px(N, seed, (0.31, 0.43, 0.17), (0.55, 0.64, 0.26), (0.09, 0.15, 0.06), 1300, (6, 17), 0.14) * tone, 0.02, 1)
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
    for k, src in (('ground_detail', None), ('rock', None), ('bark', None), ('concrete', None), ('rust', None), ('wood', None), ('metal', 'metal_painted'), ('brick', None),
                   ('asphalt', None)):
        PIC[k] = copy_pic(k, src)
    PIC['foliage'] = save_image(foliage_px(), 'foliage', TEXDIR)
    for k, src in (('plaster', 'depot_plaster'), ('sandbag', 'depot_sandbag')):
        try: PIC[k] = copy_pic(k, src, ASHTEX)
        except Exception as e: log('picture', k, e); PIC[k] = PIC['concrete']
    a = np.array(PIC['rock'].pixels[:], np.float32).reshape(PIC['rock'].size[1], PIC['rock'].size[0], 4)
    PIC['stone'] = save_image(np.clip(a[:, :, :3] * np.array((1.12, 1.08, 1.0), np.float32) * 1.15, 0.05, 1), 'stone', TEXDIR)
    PIC['red'] = tinted('cont_red', 'metal', (0.95, 0.30, 0.22)); PIC['blue'] = tinted('cont_blue', 'metal', (0.25, 0.42, 0.75))
    PIC['green'] = tinted('cont_green', 'metal', (0.32, 0.6, 0.38)); PIC['orange'] = tinted('cont_orange', 'metal', (1.0, 0.6, 0.22))
    PIC['water'] = save_image(water_px(), NAME + '_water', TEXDIR); PIC['hedge'] = save_image(hedge_px(), 'hedge', TEXDIR)
    PIC['glass'] = tinted('window', 'concrete', (0.26, 0.28, 0.31))           # dark blind windows (pure black bands read badly)
    PIC['hay'] = tinted('hay', 'wood', (0.92, 0.78, 0.42), (0.04, 0.03, 0.0))
    PIC['tile'] = tinted('roof_tile', 'brick', (0.9, 0.42, 0.3)); PIC['grave'] = tinted('grave_stone', 'concrete', (0.95, 0.95, 0.92), (0.05, 0.05, 0.05))
# ---------------------------------------------------------------- props: one mesh, material per face
bm = None; MI = {}
def _new(before): return [f for f in bm.faces if f not in before]
def gz(x, y): return float(height(x, y))
def mat_i(mat):
    if mat not in MI: MI[mat] = len(MI)
    return MI[mat]
SOFT = False       # what is made while this is True is drawn but not solid: split off after the bake as `props_soft` (hg_soft: no tops, nothing stops on it)
def _fin(faces, mat):
    lay = bm.faces.layers.int.get('soft'); mi = mat_i(mat)
    for f in faces:
        f.material_index = mi
        if lay is not None: f[lay] = 1 if SOFT else 0
# ---- placing new things without touching what is there: a snapshot of the props (rays down) plus the footprints placed since
_OCC = []; _BVH = [None]
def occ_snapshot():
    from mathutils.bvhtree import BVHTree; _BVH[0] = BVHTree.FromBMesh(bm)
def free_at(x, y, r, margin=0.8, keep=(), tall=None):
    """nothing within r + margin of (x, y): no prop of the snapshot (rays down on a 1.2 m grid), no footprint placed since; and the
    footprint itself (r) outside every keep-out circle"""
    R = r + margin
    for ox, oy, orr in _OCC:
        if math.hypot(x - ox, y - oy) < R + orr: return False
    for ox, oy, orr in keep:
        if math.hypot(x - ox, y - oy) < r + orr: return False
    if _BVH[0] is not None:
        n = int(R / 1.2) + 1
        for i in range(-n, n + 1):
            for j in range(-n, n + 1):
                px, py = x + i * 1.2, y + j * 1.2
                if (px - x) ** 2 + (py - y) ** 2 > R * R: continue
                h = _BVH[0].ray_cast(Vector((px, py, 500.0)), Vector((0, 0, -1)), 1000.0)
                if h[0] is not None and h[0].z > gz(px, py) + (0.05 if tall is None or (px - x) ** 2 + (py - y) ** 2 <= (r + 0.8) ** 2 else tall): return False      # tall: beyond r + 0.8 only things a tank cannot drive over count
    return True
def occupy(x, y, r): _OCC.append((x, y, r))
def split_soft(pr):
    """after the bake: faces made while SOFT go to their own object `props_soft` (same materials and light picture, so no extra draw calls)"""
    me = pr.data; a = me.attributes.get('soft')
    if a is None: return None
    v = np.zeros(len(me.polygons), np.int32); a.data.foreach_get('value', v)
    if not v.any(): return None
    sme = me.copy(); sme.name = 'props_soft'
    for m_, keep in ((me, 0), (sme, 1)):
        b = bmesh.new(); b.from_mesh(m_); lay = b.faces.layers.int.get('soft')
        bmesh.ops.delete(b, geom=[f for f in b.faces if f[lay] != keep], context='FACES'); b.to_mesh(m_); b.free()
    so = bpy.data.objects.new('props_soft', sme); pr.users_collection[0].objects.link(so)
    so['hg_lightmap'] = pr['hg_lightmap']; so['hg_lightmap_size'] = pr['hg_lightmap_size']; so['hg_soft'] = 1
    log('soft props', len(sme.polygons), 'faces; solid', len(me.polygons)); return so
def box(c, s, mat, rz=0.0, sink=0.4, tilt=(0.0, 0.0)):
    before = set(bm.faces)
    M = T(c[0], c[1], c[2] - sink) @ rRz(rz) @ rRx(tilt[0]) @ rRy(tilt[1]) @ Matrix.Diagonal((s[0], s[1], s[2] + sink, 1)) @ T(0, 0, 0.5)
    bmesh.ops.create_cube(bm, size=1.0, matrix=M)
    _fin(_new(before), mat)
def blob(c, r, mat, squash=1.0, seed=0, sub=1):
    before = set(bm.faces); bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0, matrix=T(*c) @ Matrix.Diagonal((r, r, r * squash, 1)))
    new = _new(before); rng = random.Random(seed)
    for v in dict.fromkeys(v for f in new for v in f.verts): v.co = Vector(c) + (v.co - Vector(c)) * rng.uniform(0.8, 1.15)     # in face order: a set's order changed run to run
    if mat in CROWN_MATS and sub >= 1:      # tree crowns: flat, shaded undersides (top and outline stay: same tops, same footprint)
        for v in {v for f in new for v in f.verts}:
            dz = v.co.z - c[2]
            if dz < 0: v.co.z = c[2] + dz * 0.82
        for f in new: f.smooth = True        # a soft leaf mass, not facets (everything else stays flat-shaded)
    _fin(new, mat)
CROWN_MATS = ('foliage',)
def cyl(c, r, h, mat, seg=7, r2=None, M=None):
    before = set(bm.faces)
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r2 if r2 is not None else r, depth=h, matrix=(M or Matrix()) @ T(c[0], c[1], c[2] + h / 2))
    _fin(_new(before), mat)
def beam(p0, p1, th, mat, th2=None):
    p0, p1 = Vector(p0), Vector(p1); d = p1 - p0; L = d.length
    if L < 1e-4: return
    q = d.normalized().to_track_quat('Y', 'Z'); before = set(bm.faces)
    bmesh.ops.create_cube(bm, size=1.0, matrix=T(*((p0 + p1) / 2)) @ q.to_matrix().to_4x4() @ Matrix.Diagonal((th, L, th2 or th, 1)))
    _fin(_new(before), mat)
def prism_xz(pts, y0, y1, mat, M):
    """a side profile [(lx, lz)] in a local frame M, extruded along local y from y0 to y1"""
    before = set(bm.faces)
    a = [bm.verts.new(M @ Vector((x, y0, z))) for x, z in pts]; b = [bm.verts.new(M @ Vector((x, y1, z))) for x, z in pts]
    bm.faces.new(a); bm.faces.new(b[::-1])
    for i in range(len(pts)):
        j = (i + 1) % len(pts); bm.faces.new((a[i], a[j], b[j], b[i]))
    new = _new(before); bmesh.ops.recalc_face_normals(bm, faces=new)
    _fin(new, mat)
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
        t = (k + 0.5) / n; x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t; box((x, y, gz(x, y)), (L / n + 0.04, 1.0 + 0.06 * (k % 2), h + random.uniform(-0.08, 0.08)), "sandbag", rz + random.uniform(-0.05, 0.05))
# ---------------------------------------------------------------- more things for the fields (cover, lines, small detail); `SOFT` ones are not solid
def _soft(on):
    global SOFT; was = SOFT; SOFT = on; return was
def bale(x, y, rz, z=None):
    """a round straw bale on its side (1.5 m across: hull-down cover)"""
    z = gz(x, y) if z is None else z
    cyl((0, 0, -0.6), 0.75, 1.2, 'hay', 10, M=T(x, y, z + 0.66) @ rRz(rz) @ rRx(math.pi / 2))
def bales(x, y, rz, n=5, rng=random):
    """a short row of round bales 0.35 m apart (a tank cannot squeeze between), sometimes one on top"""
    c, s = math.cos(rz), math.sin(rz)
    for k in range(n):
        lx = (k - (n - 1) / 2) * 1.55; px, py = x + c * lx, y + s * lx; bale(px, py, rz + rng.uniform(-0.04, 0.04))
    if n >= 3 and rng.random() < 0.6:
        k = rng.randint(0, n - 2); lx = (k - (n - 1) / 2) * 1.55 + 0.775; px, py = x + c * lx, y + s * lx
        z = max(gz(x + c * (lx - 0.775), y + s * (lx - 0.775)), gz(x + c * (lx + 0.775), y + s * (lx + 0.775))) + 1.3
        bale(px, py, rz, z=z)
    return n * 1.55 / 2 + 0.6
def bale_stack(x, y, rz, w=6.0, d=2.6, tiers=3):
    """square bales in a stepped stack (2-2.6 m: full cover)"""
    z = min(gz(x + dx, y + dy) for dx in (-w / 2, w / 2) for dy in (-d / 2, d / 2)); Z0 = gz(x, y) + 1.2
    box((x, y, z), (w, d, Z0 - z), 'hay', rz)
    for t in range(1, tiers): box((x, y, Z0 + (t - 1) * 0.82 + 0.01), (w - t * 1.1, d - t * 0.5, 0.8), 'hay', rz, sink=0.0)
    return math.hypot(w, d) / 2
def wreck_tank(x, y, rz, rng=random, turret=True):
    """a burnt-out tank: hull, track runs, a turret (or knocked off beside it), the gun drooping"""
    z = gz(x, y); c, s = math.cos(rz), math.sin(rz)
    def at(lx, ly): return (x + c * lx - s * ly, y + s * lx + c * ly)
    box((x, y, z + 0.45), (2.3, 6.2, 1.15), 'rust', rz)
    for sx in (-1, 1): box((*at(sx * 1.52, 0.0), z), (0.72, 6.6, 1.05), 'metal', rz)
    if turret:
        tx, ty = at(rng.uniform(-0.3, 0.3), rng.uniform(-0.6, 0.4)); trz = rz + rng.uniform(-0.8, 0.8)
        cyl((tx, ty, z + 1.61), 1.1, 0.75, 'rust', 8)
        g0 = Vector((tx, ty, z + 1.95)); d = Vector((-math.sin(trz), math.cos(trz), -rng.uniform(0.05, 0.25))).normalized()
        beam(g0 + d * 0.9, g0 + d * 4.6, 0.16, 'metal')
    else:
        tx, ty = at(rng.choice((-1, 1)) * 3.6, rng.uniform(-1.5, 1.5)); cyl((tx, ty, gz(tx, ty) - 0.25), 1.1, 0.85, 'rust', 8)
    return 4.0
def tank_cubes(x0, y0, x1, y1, step=2.9):
    """anti-tank cubes (1.2 m concrete): a line a tank cannot pass, gaps 1.7 m"""
    L = math.hypot(x1 - x0, y1 - y0); n = max(1, int(L / step) + 1); rz = math.atan2(y1 - y0, x1 - x0)
    for k in range(n):
        t = k / max(1, n - 1); x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        box((x, y, gz(x, y)), (1.2, 1.2, 1.15), 'concrete', rz + random.uniform(-0.1, 0.1))
def gun_pit(x, y, rz, r=3.6, rng=random):
    """a sandbagged gun position: a ring of bags open at the back, a field gun inside facing rz"""
    n = 14
    for k in range(n):
        a = rz + 6.2832 * (k + 0.5) / n
        if abs(math.remainder(a - rz - math.pi, 6.2832)) < 0.5: continue
        px, py = x + math.cos(a) * r, y + math.sin(a) * r; box((px, py, gz(px, py)), (1.0, 2 * (r - 0.5) * math.sin(math.pi / n) - 0.06, 1.05 + rng.uniform(-0.06, 0.06)), 'sandbag', a)
    c, s = math.cos(rz), math.sin(rz); z = gz(x, y)
    box((x, y, z + 0.3), (1.4, 1.0, 0.5), 'metal', rz); box((x + c * 0.45, y + s * 0.45, z + 0.82), (0.1, 1.9, 0.9), 'metal', rz, sink=0.0)
    box((x, y, z + 0.81), (0.6, 0.4, 0.3), 'metal', rz, sink=0.0)
    beam((x, y, z + 0.96), (x + c * 3.0, y + s * 3.0, z + 1.04), 0.12, 'metal')
    for sy in (-1, 1): beam((x - c * 0.6 - s * sy * 0.45, y - s * 0.6 + c * sy * 0.45, z + 0.3), (x - c * 2.4 - s * sy * 1.1, y - s * 2.4 + c * sy * 1.1, z + 0.08), 0.12, 'metal')
    return r + 0.6
def shed(x, y, rz, w=6.0, d=4.0, h=2.8, mat='wood', roof='metal'):
    """a field shed / store: walls and a pent roof"""
    z = min(gz(x + dx, y + dy) for dx in (-w / 2, w / 2) for dy in (-d / 2, d / 2)); top = gz(x, y) + h; box((x, y, z), (w, d, top - z), mat, rz)
    prism_xz([(-d / 2 - 0.3, 0.0), (d / 2 + 0.3, 0.0), (d / 2 + 0.3, 0.12), (-d / 2 - 0.3, 0.75)], -w / 2 - 0.25, w / 2 + 0.25, roof, T(x, y, top + 0.01) @ rRz(rz - math.pi / 2))
    return math.hypot(w, d) / 2 + 0.3
def ruin(x, y, rz, w=9.0, d=7.0, mat='stone', rng=random):
    """a broken cottage: wall stubs of mixed height with gaps (closed corners), a rubble heap inside"""
    c, s = math.cos(rz), math.sin(rz)
    def at(lx, ly): return (x + c * lx - s * ly, y + s * lx + c * ly)
    for e, ((ax, ay), (bx, by)) in enumerate((((-w / 2, -d / 2), (w / 2, -d / 2)), ((w / 2 - 0.6, -d / 2 + 0.6), (w / 2 - 0.6, d / 2 - 0.6)),
                                              ((w / 2, d / 2), (-w / 2, d / 2)), ((-w / 2 + 0.6, d / 2 - 0.6), (-w / 2 + 0.6, -d / 2 + 0.6)))):
        L = math.hypot(bx - ax, by - ay); n = max(2, int(L / 2.2)); er = math.atan2(by - ay, bx - ax)
        for k in range(n):
            if 0 < k < n - 1 and rng.random() < 0.25: continue
            t = (k + 0.5) / n; px, py = at(ax + (bx - ax) * t, ay + (by - ay) * t)
            box((px, py, gz(px, py)), (L / n - 0.08, 0.6, rng.uniform(1.4, 3.8)), mat, rz + er)
    was = _soft(True)
    for k in range(3):
        px, py = at(rng.uniform(-w / 5, w / 5), rng.uniform(-d / 5, d / 5)); blob((px, py, gz(px, py) - 0.25), rng.uniform(0.9, 1.4), mat, 0.35, rng.randint(0, 999), 0)
    _soft(was)
    return math.hypot(w, d) / 2 + 0.4
def bush(x, y, r=1.2, rng=random, mat='hedge'):
    was = _soft(True); blob((x, y, gz(x, y) + r * 0.2), r, mat, 0.7, rng.randint(0, 999), 0); _soft(was)
def lone_tree(x, y, s=1.0):
    """a tree whose crown is not solid (only the trunk is)"""
    z = gz(x, y); h = random.uniform(4.5, 6.0) * s
    cyl((x, y, z - 0.3), 0.42 * s, h * 0.7 + 0.3, 'bark', 8, 0.24 * s)
    was = _soft(True)
    for k in range(2):
        a = random.uniform(0, 6.28); beam((x, y, z + h * 0.6), (x + math.cos(a) * 1.2 * s, y + math.sin(a) * 1.2 * s, z + h + 0.6 * s), 0.18 * s, 'bark')
    for dz, r, n in ((0.0, 2.9, 2), (1.3, 2.3, 2), (2.6, 1.5, 1)):
        for i in range(n):
            a = random.uniform(0, 6.28); off = (r * 0.55 if n > 1 else 0.0) * s
            blob((x + math.cos(a) * off, y + math.sin(a) * off, z + h + dz * s), r * s * random.uniform(0.85, 1.1), 'foliage', 0.62, random.randint(0, 999), 1)
    _soft(was)
    return 3.5 * s
def fence(points, h=1.15, step=2.6, mat='wood', gaps=()):
    """post and rail (not solid)"""
    was = _soft(True)
    for (ax, ay), (bx, by) in zip(points[:-1], points[1:]):
        L = math.hypot(bx - ax, by - ay); n = max(1, int(round(L / step))); rz = math.atan2(by - ay, bx - ax)
        for k in range(n + 1):
            t = k / n; x, y = ax + (bx - ax) * t, ay + (by - ay) * t
            if any(math.hypot(x - gx, y - gy) < gr for gx, gy, gr in gaps): continue
            box((x, y, gz(x, y)), (0.14, 0.14, h + 0.1), mat, rz)
            if k < n:
                x2, y2 = ax + (bx - ax) * (k + 1) / n, ay + (by - ay) * (k + 1) / n
                if any(math.hypot(x2 - gx, y2 - gy) < gr for gx, gy, gr in gaps): continue
                for zz in (0.45, h - 0.12):
                    beam((x, y, gz(x, y) + zz), (x2, y2, gz(x2, y2) + zz), 0.07, mat, 0.11)
    _soft(was)
def pole_line(points, step=34.0, h=7.2, wires=True, mat='wood', skip=None):
    """telegraph poles with a cross arm and sagging wires (not solid)"""
    was = _soft(True); pts = []
    for (ax, ay), (bx, by) in zip(points[:-1], points[1:]):
        L = math.hypot(bx - ax, by - ay); n = max(1, int(round(L / step)))
        for k in range(n): pts.append((ax + (bx - ax) * k / n, ay + (by - ay) * k / n))
    pts.append(points[-1]); tops = []
    for i, (x, y) in enumerate(pts):
        if skip and skip(x, y): tops.append(None); continue
        z = gz(x, y); cyl((x, y, z - 0.3), 0.15, h + 0.3, mat, 6, 0.11)
        nx_, ny_ = (pts[min(i + 1, len(pts) - 1)][0] - pts[max(i - 1, 0)][0]), (pts[min(i + 1, len(pts) - 1)][1] - pts[max(i - 1, 0)][1]); L = math.hypot(nx_, ny_) or 1.0
        px, py = -ny_ / L, nx_ / L; beam((x - px * 0.9, y - py * 0.9, z + h - 0.5), (x + px * 0.9, y + py * 0.9, z + h - 0.5), 0.1, mat); tops.append((x, y, z + h - 0.42, px, py))
    if wires:
        for a, b in zip(tops[:-1], tops[1:]):
            if a is None or b is None: continue
            for o in (-0.7, 0.7):
                p0 = Vector((a[0] + a[3] * o, a[1] + a[4] * o, a[2])); p1 = Vector((b[0] + b[3] * o, b[1] + b[4] * o, b[2])); mid = (p0 + p1) / 2 - Vector((0, 0, 0.6))
                beam(p0, mid, 0.035, 'metal'); beam(mid, p1, 0.035, 'metal')
    _soft(was)
def log_pile(x, y, rz):
    was = _soft(True); c, s = math.cos(rz), math.sin(rz); z = gz(x, y)
    for row, m in ((0, 3), (1, 2), (2, 1)):
        for i in range(m):
            lx = (i - (m - 1) / 2) * 0.46
            cyl((0, 0, -1.6), 0.21, 3.2, 'bark', 7, M=T(x + c * lx, y + s * lx, z + 0.19 + row * 0.37) @ rRz(rz) @ rRx(math.pi / 2))
    _soft(was)
def stones(x, y, n=4, rng=random, mat='rock'):
    was = _soft(True)
    for k in range(n):
        px, py = x + rng.uniform(-2, 2), y + rng.uniform(-2, 2); r = rng.uniform(0.25, 0.5); blob((px, py, gz(px, py) + r * 0.1), r, mat, 0.55, rng.randint(0, 999), 0)
    _soft(was)
def outcrop(x, y, n=4, s=1.0, rng=random, mat='rock'):
    """a rock outcrop: a few big boulders shouldered together (solid cover)"""
    for k in range(n):
        a = rng.uniform(0, 6.28); d = rng.uniform(0.0, 2.2) * s; r = rng.uniform(1.4, 2.4) * s
        px, py = x + math.cos(a) * d, y + math.sin(a) * d; blob((px, py, gz(px, py) + r * 0.1), r, mat, rng.uniform(0.55, 0.8), rng.randint(0, 999), 1)
    return 3.8 * s
def container(x, y, rz, mat='metal', n=1):
    """a shipping container (2.6 m), n stacked"""
    for k in range(n): box((x, y, gz(x, y) + k * 2.62 if k else gz(x, y)), (6.1, 2.45, 2.6 if k else 2.6), mat, rz + (0.04 * k), sink=0.0 if k else 0.4)
    return 3.4
def wall_line(x0, y0, x1, y1, h=1.3, mat='stone', th=0.7):
    """a dry-stone wall (solid): segments meet with alternating thickness (no coplanar overlap)"""
    L = math.hypot(x1 - x0, y1 - y0); n = max(1, int(L / 3.0)); rz = math.atan2(y1 - y0, x1 - x0)
    for k in range(n):
        t = (k + 0.5) / n; x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        box((x, y, gz(x, y)), (L / n + 0.05, th + 0.06 * (k % 2), h + random.uniform(-0.1, 0.1)), mat, rz)
# kinds for scatter(): footprint radius and builder (x, y, rz, rng)
KINDS = {
    'bales': (4.5, lambda x, y, rz, rng: bales(x, y, rz, rng.choice((3, 4, 5)), rng)),
    'stack': (3.4, lambda x, y, rz, rng: bale_stack(x, y, rz, rng.uniform(5.0, 6.5), 2.6, rng.choice((2, 3)))),
    'shed': (4.2, lambda x, y, rz, rng: shed(x, y, rz, rng.uniform(5.0, 7.0), rng.uniform(3.5, 4.5), 2.8, 'wood', 'metal')),
    'wreck': (4.0, lambda x, y, rz, rng: wreck_tank(x, y, rz, rng, rng.random() < 0.7)),
    'rocks': (3.8, lambda x, y, rz, rng: outcrop(x, y, rng.choice((3, 4)), 0.9, rng)),
    'bigrocks': (5.2, lambda x, y, rz, rng: outcrop(x, y, rng.choice((4, 5)), 1.3, rng)),
    'tree': (3.0, lambda x, y, rz, rng: lone_tree(x, y, rng.uniform(1.0, 1.3))),
    'ruin': (6.0, lambda x, y, rz, rng: ruin(x, y, rz, rng.uniform(8.0, 10.0), rng.uniform(6.0, 7.5), 'stone', rng)),
    'pit': (4.5, lambda x, y, rz, rng: gun_pit(x, y, math.atan2(-y, -x) + rng.uniform(-0.5, 0.5), 3.6, rng)),
    'cubes': (8.0, lambda x, y, rz, rng: tank_cubes(x - math.cos(rz) * 7, y - math.sin(rz) * 7, x + math.cos(rz) * 7, y + math.sin(rz) * 7)),
    'container': (3.6, lambda x, y, rz, rng: container(x, y, rz, rng.choice(('metal', 'rust')), rng.choice((1, 1, 2)))),
    'wall': (7.5, lambda x, y, rz, rng: wall_line(x - math.cos(rz) * 7, y - math.sin(rz) * 7, x + math.cos(rz) * 7, y + math.sin(rz) * 7)),
    'sandbags': (3.2, lambda x, y, rz, rng: sandbags(x - math.cos(rz) * 2.8, y - math.sin(rz) * 2.8, x + math.cos(rz) * 2.8, y + math.sin(rz) * 2.8)),
}
def scatter(weights, n, ok, keep, rng, margin=9.5, lim=192.0, tries=6000, kinds=None, tall=None):
    """n solid things of the weighted kinds where ok(x, y), each free_at its footprint + margin (9.5 m: no slot under a 9 m route) and
    outside the keep-out circles; returns the counts"""
    K_ = kinds or KINDS; names = list(weights); w = [weights[k] for k in names]; got = {}; total = 0
    while total < n and tries > 0:
        tries -= 1; x, y = rng.uniform(-lim, lim), rng.uniform(-lim, lim)
        if not ok(x, y): continue
        kind = rng.choices(names, w)[0]; r, fn = K_[kind]
        if not free_at(x, y, r, margin, keep, tall): continue
        fn(x, y, rng.uniform(0, 6.2832), rng); occupy(x, y, r); got[kind] = got.get(kind, 0) + 1; total += 1
    return got
def soft_scatter(n, ok, rng, what='bush', lim=200.0, tries=4000, keep=()):
    """not-solid small things (bushes, stone groups, log piles) where ok(x, y)"""
    c = 0
    while c < n and tries > 0:
        tries -= 1; x, y = rng.uniform(-lim, lim), rng.uniform(-lim, lim)
        if not ok(x, y) or not free_at(x, y, 2.2 if what == 'logs' else 1.4, 0.3, keep): continue
        if what == 'bush': bush(x, y, rng.uniform(0.9, 1.6), rng)
        elif what == 'stones': stones(x, y, rng.randint(3, 5), rng)
        elif what == 'logs': log_pile(x, y, rng.uniform(0, 3.14)); occupy(x, y, 2.2)
        c += 1
    return c
def hookup(bm_, MI_, height_, name, macro_=None):
    """let an older map script (its own copy of the kit: valley, dunes, pass, works) use these builders on its bmesh"""
    global bm, MI, NAME
    bm = bm_; MI = MI_; NAME = name; globals()['height'] = height_
    if macro_ is not None: globals()['macro_colour'] = macro_
    if bm.faces.layers.int.get('soft') is None: bm.faces.layers.int.new('soft')
    _OCC.clear(); occ_snapshot()
def macro_node(mat, N):
    """swap a macro material's vertex colours for the macro picture (N px) through the Lightmap layout"""
    nt = mat.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = macro_picture(N); tx.interpolation = 'Linear'
    uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'Lightmap'; nt.links.new(uvn.outputs['UV'], tx.inputs['Vector']); nt.links.new(tx.outputs['Color'], b.inputs['Base Color'])
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
def stroke_grid(polys, width, res=0.25, soft=0.6):
    """thin lines on the ground (tank tracks, paths): polylines [(x, y), ...] drawn into a 0.25 m grid over the map, segment by segment inside
    its own box; returns f(x, y) -> 0..1 (nearest grid cell), cheap for any number of points"""
    n = int(2 * HALF / res) + 1; g = np.zeros((n, n), np.float32); r = width / 2 + soft
    for P in polys:
        for (x0, y0), (x1, y1) in zip(P[:-1], P[1:]):
            i0, i1 = int((min(x0, x1) - r + HALF) / res), int((max(x0, x1) + r + HALF) / res) + 1; j0, j1 = int((min(y0, y1) - r + HALF) / res), int((max(y0, y1) + r + HALF) / res) + 1
            i0, j0 = max(i0, 0), max(j0, 0); i1, j1 = min(i1, n), min(j1, n)
            if i1 <= i0 or j1 <= j0: continue
            xs = np.arange(i0, i1) * res - HALF; ys = np.arange(j0, j1) * res - HALF; X, Y = np.meshgrid(xs, ys, indexing='ij')
            d = seg_dist(X, Y, (x0, y0, x1, y1)); v = np.clip((r - d) / soft, 0, 1).astype(np.float32); g[i0:i1, j0:j1] = np.maximum(g[i0:i1, j0:j1], v)
    def f(x, y):
        i = np.clip(np.rint((np.asarray(x) + HALF) / res).astype(np.int64), 0, n - 1); j = np.clip(np.rint((np.asarray(y) + HALF) / res).astype(np.int64), 0, n - 1)
        return g[i, j]
    return f
MACRO_PX = 0       # > 0: the ground's colour for the bake is a picture this many pixels across (laid out like the light picture) instead of 2.8 m vertex colours
def macro_picture(N):
    xs = (np.arange(N) + 0.5) / N * 2 * HALF - HALF; X, Y = np.meshgrid(xs, xs, indexing='xy'); Z = height(X, Y)
    gy, gx = np.gradient(Z, xs, xs); col = lin(macro_colour(X, Y, Z, np.hypot(gx, gy))).astype(np.float32)
    img = bpy.data.images.new(NAME + '_macro', N, N, alpha=False, float_buffer=True)
    img.pixels.foreach_set(np.concatenate([col.reshape(N, N, 3), np.ones((N, N, 1), np.float32)], 2).ravel()); log('macro picture', N, 'mean', col.reshape(-1, 3).mean(0), 'median', np.median(col.reshape(-1, 3), 0)); return img
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
    bm = bmesh.new(); bm.faces.layers.int.new('soft'); MI.clear(); _OCC.clear(); _BVH[0] = None; build_props(); pme = bpy.data.meshes.new('props'); bm.to_mesh(pme); bm.free()
    mats_ = sorted(MI, key=lambda k: MI[k]); mats = {k: tiled_material(k, PIC[k]) for k in mats_}
    for k in mats_: pme.materials.append(mats[k])
    world_uv(pme, mats_)          # faces keep the shading they were made with: flat, crowns smooth
    pr = bpy.data.objects.new('props', pme); tc_.objects.link(pr); pr['hg_lightmap'] = 'tex/%s_props_light.exr' % NAME; pr['hg_lightmap_size'] = 2048
    lu = pme.uv_layers.new(name='Lightmap'); pme.uv_layers.active = lu; smart_uv(pr, 66, 0.002); pme.uv_layers.active = pme.uv_layers['UVMap']
    objs = [ter, bd, pr]
    if WATER:
        wme = water_mesh(); wme.materials.append(tiled_material('water', PIC['water'], 0.2)); wo = bpy.data.objects.new('water', wme); tc_.objects.link(wo)
        wo['hg_lightmap'] = 'tex/%s_water_light.exr' % NAME; wo['hg_lightmap_size'] = 256; objs.append(wo)
    macro = macro_material('terrain_macro'); bmacro = macro_material('backdrop_macro'); detail = tiled_material('ground_detail', PIC['ground_detail'], 1.0)
    if MACRO_PX:
        nt = macro.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = macro_picture(MACRO_PX); tx.interpolation = 'Linear'
        uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'Lightmap'; nt.links.new(uvn.outputs['UV'], tx.inputs['Vector']); nt.links.new(tx.outputs['Color'], b.inputs['Base Color'])
    tme.materials.append(macro); bme.materials.append(bmacro)
    for o in objs:
        o.data.calc_loop_triangles(); log(o.name, len(o.data.loop_triangles), 'triangles')
    S = int(OPT.get('samples', 32))
    if 'nobake' not in OPT:
        bake(ter, 2048, 'tex/%s_light.exr' % NAME, {'COLOR', 'DIRECT', 'INDIRECT'}, S)
        bake(bd, 512, 'tex/%s_backdrop_light.exr' % NAME, {'COLOR', 'DIRECT', 'INDIRECT'}, max(8, S // 2))
        bake(pr, 2048, 'tex/%s_props_light.exr' % NAME, {'DIRECT', 'INDIRECT'}, S)
        if WATER: bake(wo, 256, 'tex/%s_water_light.exr' % NAME, {'DIRECT', 'INDIRECT'}, max(8, S // 2))
    split_soft(pr)
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
