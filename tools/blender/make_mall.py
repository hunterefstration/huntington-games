# ASHFALL map "THE ARCADE" in art/ashfall/mall.blend (made from make_yard.py: same pipeline, its own layout below).
#   blender -b art/ashfall/mall.blend -P tools/blender/make_mall.py -- [nobake] [preview]   (first time: --factory-startup)
# then node tools/export-art.mjs mall -> Ashfall/assets/mall.hgm
import bpy, bmesh, math, os, sys, json, random
import numpy as np
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hgkit import log, vnoise, fbm, save_image, smart_uv, T, Rz, Rx, Ry, grit, gravel_px
def Rx(a): return Matrix.Rotation(a, 4, 'X')        # radians here (hgkit's take degrees)
def Ry(a): return Matrix.Rotation(a, 4, 'Y')
def Rz(a): return Matrix.Rotation(a, 4, 'Z')

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OPT = dict((a.split('=', 1) + ['1'])[:2] for a in ARGV)
BLOOM = 'plain' not in OPT       # the glowing-growth night look (ash_paint.py, see make_yard.py); `plain` builds the old look exactly as before
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = os.path.join(ROOT, 'art', 'ashfall'); TEXDIR = os.path.join(BASE, 'tex'); CACHE = os.path.join(BASE, '_cache'); PROOF = os.path.join(ROOT, 'art', 'proof', 'tex')
for d in (TEXDIR, CACHE): os.makedirs(d, exist_ok=True)
scene = bpy.context.scene
if not bpy.data.filepath.replace('\\', '/').endswith('art/ashfall/mall.blend'):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, 'mall.blend')); log('created', bpy.data.filepath)
for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
for c in list(bpy.data.collections): bpy.data.collections.remove(c)       # the file is ours: old 'map' / 'lights' would shadow the new ones
for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
    for d in list(coll):
        if d.users == 0: coll.remove(d)
scene.render.fps = 30
random.seed(7)

# ---------------------------------------------------------------- pictures (1024, tiling): the yard's, dusted with ash, plus painted ones
ASH = np.array((0.52, 0.505, 0.48), np.float32)      # mid-grey ash: never near white (it is multiplied by light)
def load_px(name):
    im = bpy.data.images.load(os.path.join(PROOF, name + '.png')); a = np.array(im.pixels[:], np.float32).reshape(im.size[1], im.size[0], 4)[:, :, :3]
    bpy.data.images.remove(im); return a
def grid_pts(N, scale):
    y, x = np.mgrid[0:N, 0:N].astype(np.float32); return np.stack([x / N, y / N, np.zeros_like(x)], 2).reshape(-1, 3) * scale
def tile_noise(N, cell, seed, oct=3):
    """periodic value noise (wraps at the picture edge, so tiles repeat seamlessly)"""
    out = np.zeros((N, N), np.float32); amp, tot = 1.0, 0.0
    for o in range(oct):
        c = max(2, int(round(N / (cell / (2 ** o))))); rng = np.random.default_rng(seed + o); g = rng.random((c, c)).astype(np.float32)
        u = np.arange(N, dtype=np.float32) * c / N; i0 = np.floor(u).astype(int); f = u - i0; f = f * f * (3 - 2 * f); i1 = (i0 + 1) % c
        a = g[i0][:, i0] * (1 - f)[None, :] + g[i0][:, i1] * f[None, :]; b = g[i1][:, i0] * (1 - f)[None, :] + g[i1][:, i1] * f[None, :]
        out += amp * (a * (1 - f)[:, None] + b * f[:, None]); tot += amp; amp *= 0.5
    return out / tot
def dust(a, amount, seed, tint=None):
    N = a.shape[0]; m = tile_noise(N, 160, seed); m2 = tile_noise(N, 24, seed + 10)
    k = np.clip((m * 0.75 + m2 * 0.25 - (0.62 - amount)) * 3.0, 0, 1)[..., None] * amount * 1.4
    g = a.mean(2, keepdims=True); a = a * 0.75 + g * 0.25
    if tint is not None: a = a * np.array(tint, np.float32)
    return np.clip(a * (1 - k) + ASH * k * (0.9 + 0.2 * m2[..., None]), 0.04, 1)
def painted(kind, N=1024):
    n1 = tile_noise(N, 64, 3); n2 = tile_noise(N, 12, 5); y, x = np.mgrid[0:N, 0:N].astype(np.float32)
    if kind == 'plaster':
        a = np.array((0.55, 0.47, 0.38), np.float32) * (0.82 + 0.3 * n1[..., None]) * (0.95 + 0.1 * n2[..., None])
        streak = tile_noise(N, 400, 9) ; a *= (0.85 + 0.2 * np.clip(streak, 0, 1))[..., None]
    elif kind == 'sandbag':
        bag = ((y % 256) < 6) | ((x + (y // 256) * 128) % 512 < 6)
        w = 0.5 + 0.5 * np.sin(x * 1.6) * np.sin(y * 1.6)
        a = np.array((0.47, 0.41, 0.31), np.float32) * (0.85 + 0.15 * w[..., None]) * (0.85 + 0.3 * n1[..., None]); a[bag] *= 0.55
    elif kind == 'glass':
        a = np.array((0.19, 0.23, 0.27), np.float32) * (0.8 + 0.5 * n1[..., None]); a = a * (1 - 0.4 * n2[..., None]) + 0.25 * n2[..., None] * ASH * 0.4
    elif kind == 'dirt':
        a = np.array((0.42, 0.39, 0.35), np.float32) * (0.75 + 0.4 * n1[..., None]) * (0.9 + 0.2 * n2[..., None])
    return np.clip(a, 0.04, 1)
PICS = {}
def make_pictures():
    src = {'asphalt': ('asphalt', 0.45, (0.95, 0.95, 0.97)), 'concrete': ('concrete', 0.4, None), 'brick': ('brick', 0.28, None), 'metal': ('metal_painted', 0.35, None),
           'rust': ('rust', 0.3, None), 'wood': ('wood', 0.25, (0.9, 0.85, 0.8))}
    for k, (f, amt, tint) in src.items(): PICS[k] = save_image(dust(grit(load_px(f), len(k)) if k in ('concrete', 'asphalt') else load_px(f), amt, len(k) * 7, tint), 'street_' + k, TEXDIR)
    for k, amt in (('plaster', 0.3), ('sandbag', 0.2), ('glass', 0.15), ('dirt', 0.55)): PICS[k] = save_image(dust(painted(k), amt, len(k) * 11), 'street_' + k, TEXDIR)
    PICS['dirt'] = save_image(dust(gravel_px(1024, 5), 0.25, 77), 'street_dirt', TEXDIR)      # sharp gravel ground (the painted dirt read as a blur at eye height)
    import ash_paint; ash_paint.repaint(PICS, save_image, dust, TEXDIR, 'street_', 'mall')      # painted metal and old steel, this map's colours (less rust)
    if BLOOM: ash_paint.bloom_pictures(globals())
    log('pictures', len(PICS))
TILE = {'asphalt': 3.5, 'concrete': 2.2, 'brick': 2.4, 'plaster': 2.8, 'metal': 2.5, 'rust': 2.5, 'wood': 2.0, 'sandbag': 1.2, 'glass': 2.5, 'dirt': 3.0}
EMIT = {'emissive_sign': (1.0, 0.45, 0.12), 'emissive_lamp': (1.0, 0.82, 0.55), 'emissive_fire': (1.0, 0.5, 0.15)}
MATS = list(TILE) + list(EMIT)
def materials():
    out = []
    for k in MATS:
        m = bpy.data.materials.new('st_' + k if k in TILE else k); m.use_nodes = True; nt = m.node_tree; bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        if k in TILE:
            tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = PICS[k]; uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'UVMap'
            nt.links.new(uvn.outputs['UV'], tx.inputs['Vector']); nt.links.new(tx.outputs['Color'], bsdf.inputs['Base Color'])
            bsdf.inputs['Roughness'].default_value = 0.9; bsdf.inputs['Metallic'].default_value = 0.0
        else:
            bsdf.inputs['Base Color'].default_value = (*EMIT[k], 1); bsdf.inputs['Emission Color'].default_value = (*EMIT[k], 1)
            bsdf.inputs['Emission Strength'].default_value = 6.0 if k != 'emissive_fire' else 12.0
        out.append(m)
    return out

# ---------------------------------------------------------------- geometry: one bmesh, material per face, tiling UVs in world metres
bm = bmesh.new(); MI = {k: i for i, k in enumerate(MATS)}; GROUND_FACES = set()
def _faces_since(before): return [f for f in bm.faces if f.index < 0 or f not in before]
def box(c, s, mat, rz=0.0, bevel=0.0):
    before = set(bm.faces)
    M = T(*c) @ Rz(rz) @ Matrix.Diagonal((s[0], s[1], s[2], 1)) @ T(0, 0, 0.5)
    bmesh.ops.create_cube(bm, size=1.0, matrix=M)
    new = [f for f in bm.faces if f not in before]
    if bevel > 0:
        r = bmesh.ops.bevel(bm, geom=list({e for f in new for e in f.edges}), offset=bevel, segments=1, affect='EDGES', profile=0.5, clamp_overlap=True)
        new = [f for f in bm.faces if f not in before]
    for f in new: f.material_index = MI[mat]
    return new
def cyl(c, r, h, mat, seg=12, top_mat=None):
    before = set(bm.faces)
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r, depth=h, matrix=T(c[0], c[1], c[2] + h / 2))
    new = [f for f in bm.faces if f not in before]
    for f in new:
        f.material_index = MI[top_mat] if (top_mat and f.normal.z > 0.9) else MI[mat]
    return new
def heap(c, rx, ry, h, mat='dirt', rz=0.0):
    """a low ash heap (lower than 0.45 m: walkable)"""
    before = set(bm.faces)
    bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=5, radius=1.0, matrix=T(*c) @ Rz(rz) @ Matrix.Diagonal((rx, ry, h, 1)))
    new = [f for f in bm.faces if f not in before]
    kill = [v for v in {v for f in new for v in f.verts} if v.co.z < c[2] - 1e-4]
    for v in {v for f in new for v in f.verts}: v.co.z = max(v.co.z, c[2])
    for f in new: f.material_index = MI[mat]
    return new
def quad(x0, y0, x1, y1, mat, z=0.0):
    vs = [bm.verts.new((x0, y0, z)), bm.verts.new((x1, y0, z)), bm.verts.new((x1, y1, z)), bm.verts.new((x0, y1, z))]
    f = bm.faces.new(vs); f.material_index = MI[mat]; GROUND_FACES.add(f); return f
def wall_x(x, y0, y1, h, mat, gaps=(), th=0.3, z0=0.0):
    """wall along y at x, with door gaps [(ya, yb)]"""
    ys = [y0] + [g for ab in sorted(gaps) for g in ab] + [y1]
    for i in range(0, len(ys), 2):
        a, b = ys[i], ys[i + 1]
        if b - a > 0.01: box(((x, (a + b) / 2, z0)), (th, b - a, h), mat)
    for a, b in gaps: box((x, (a + b) / 2, z0 + 2.2), (th, b - a, h - 2.2), mat)
def wall_y(y, x0, x1, h, mat, gaps=(), th=0.3):
    xs = [x0] + [g for ab in sorted(gaps) for g in ab] + [x1]
    for i in range(0, len(xs), 2):
        a, b = xs[i], xs[i + 1]
        if b - a > 0.01: box(((a + b) / 2, y, 0), (b - a, th, h), mat)
    for a, b in gaps: box(((a + b) / 2, y, 2.2), (b - a, th, h - 2.2), mat)

LIGHTS = []
XH, YH = 45.0, 33.0
MAPNAME = 'mall'
H = 6.0                                             # ceiling height (one level)
def add_pics(extra):
    """extra tiling pictures for this map: {material: (tile metres, maker)}; must run before any face is made"""
    global make_pictures
    for k, (s, fn) in extra.items(): TILE[k] = s
    MATS[:] = list(TILE) + list(EMIT); MI.clear(); MI.update({k: i for i, k in enumerate(MATS)})
    _mp = make_pictures
    def mp():
        _mp()
        for k, (s, fn) in extra.items(): PICS[k] = save_image(fn(), MAPNAME + '_' + k, TEXDIR)
    make_pictures = mp
def tile_pic(N=1024):
    y, x = np.mgrid[0:N, 0:N].astype(np.float32); n1 = tile_noise(N, 64, 21); n2 = tile_noise(N, 6, 23); cell = N // 4
    chk = (((x // cell) + (y // cell)) % 2)[..., None]
    a = np.array((0.50, 0.47, 0.42), np.float32) * (1 - chk) + np.array((0.27, 0.25, 0.23), np.float32) * chk
    a = a * (0.9 + 0.15 * n1[..., None]); chip = (n2 > 0.66)[..., None]; a = np.where(chip, a * 0.7 + 0.12, a)
    grout = ((x % cell) < 4) | ((y % cell) < 4); a[grout] *= 0.55
    return dust(np.clip(a, 0.04, 1), 0.35, 91)
from mapkit import install; install(globals())
add_pics({'tile': (2.4, tile_pic), 'grime': (2.0, grime_pic), 'paint': (1.5, paint_pic)})
EMIT['emissive_lamp'] = (1.0, 0.86, 0.66)
WARM = (1.0, 0.76, 0.5); COOL = (0.82, 0.9, 1.0); EMERG = (1.0, 0.32, 0.1)
FILL = (0.004, 0.004, 0.003)
AREAS = [(-24.8, 34.8, 8.2, 21.8, 5.95, 0.16, WARM), (-24.8, 34.8, -21.8, -8.2, 5.95, 0.16, WARM), (-44.8, 44.8, 22.2, 32.8, 5.95, 0.16, WARM),
         (-44.8, 44.8, -32.8, -22.2, 5.95, 0.16, WARM), (-44.8, -25.2, -21.8, 21.8, 5.95, 0.18, WARM), (35.2, 44.8, -21.8, 21.8, 5.95, 0.18, WARM),
         (-24.8, -5.2, -7.8, 7.8, 5.95, 0.16, WARM), (5.2, 34.8, -7.8, 7.8, 5.95, 0.16, WARM)]     # x0 x1 y0 y1 z W/m2 colour
FLOORS = []
def wx(x, y0, y1, h, mat, gaps=(), th=0.25, dh=2.5):
    """wall running along y at x, door gaps [(a, b)] dh tall"""
    ys = [y0] + [g for ab in sorted(gaps) for g in ab] + [y1]
    for i in range(0, len(ys), 2):
        a, b = ys[i], ys[i + 1]
        if b - a > 0.01: box((x, (a + b) / 2, 0), (th, b - a, h), mat)
    for a, b in gaps:
        if h > dh: box((x, (a + b) / 2, dh), (th, b - a, h - dh), mat)
def wy(y, x0, x1, h, mat, gaps=(), th=0.25, dh=2.5):
    xs = [x0] + [g for ab in sorted(gaps) for g in ab] + [x1]
    for i in range(0, len(xs), 2):
        a, b = xs[i], xs[i + 1]
        if b - a > 0.01: box(((a + b) / 2, y, 0), (b - a, th, h), mat)
    for a, b in gaps:
        if h > dh: box(((a + b) / 2, y, dh), (b - a, th, h - dh), mat)
def tube_lamp(x, y, z, on=True, w=160, L=1.4, rz=0.0):
    """a fluorescent fitting hung from the ceiling (shops)"""
    box((x, y, z), (0.3, L, 0.08), 'metal', rz); box((x, y, z + 0.08), (0.03, 0.03, H - z - 0.085), 'metal')
    if on: box((x, y, z - 0.03), (0.22, L - 0.1, 0.03), 'emissive_lamp', rz); LIGHTS.append((x, y, z - 0.15, w, COOL, math.radians(140)))
    else: box((x, y, z - 0.03), (0.22, L - 0.1, 0.03), 'glass', rz)
def pendant(x, y, z=4.3, w=300):
    """a big hanging dome lamp over the concourse: one pool of warm light"""
    lamp_cone(x, y, z, 'metal', 'emissive_lamp', 0.6, H); LIGHTS.append((x, y, z - 0.1, w, WARM, math.radians(130)))
def emergency(x, y, z, nx, ny, w=45):
    box((x, y, z), (0.3 if nx == 0 else 0.12, 0.3 if ny == 0 else 0.12, 0.18), 'emissive_fire'); LIGHTS.append((x + nx * 0.4, y + ny * 0.4, z, w, EMERG))
def exit_sign(x, y, z, rz=0.0):
    box((x, y, z), (0.7, 0.1, 0.25), 'emissive_sign', rz)                         # lit, but throws no light of its own
def planter(x, y, rz=0.0):
    box((x, y, 0), (3.2, 1.3, 0.6), 'brick', rz); box((x, y, 0.6), (3.0, 1.1, 0.03), 'dirt', rz)
    for d in (-0.8, 0.8):
        px, py = P(x, y, rz, d, 0); cyl((px, py, 0.6), 0.12, 2.4, 'wood', 6)
        for k in range(3):
            a = random.uniform(0, 6.28); beam((px, py, 1.6 + k * 0.4), (px + 0.9 * math.cos(a), py + 0.9 * math.sin(a), 2.3 + k * 0.4), 0.06, 'wood')
def bench(x, y, rz=0.0):
    box((x, y, 0), (2.0, 0.6, 0.45), 'wood', rz); px, py = P(x, y, rz, 0, 0.27); box((px, py, 0.45), (2.0, 0.08, 0.45), 'wood', rz)
def cart(x, y, rz=0.0, tipped=False):
    """a shopping trolley (1 m: blocks feet, not eyes)"""
    def b(dx, dy, z, s): B(x, y, rz, dx, dy, z, s, 'metal')
    if tipped:
        b(0, 0, 0, (0.55, 0.9, 0.04)); b(0, 0, 0.5, (0.55, 0.9, 0.04)); b(0.28, 0, 0.04, (0.02, 0.9, 0.46)); b(-0.28, 0, 0.04, (0.02, 0.9, 0.46)); return
    for dx in (-0.25, 0.25):
        for dy in (-0.4, 0.4): b(dx, dy, 0, (0.04, 0.04, 0.5))
    b(0, 0, 0.5, (0.55, 0.9, 0.03)); b(0.27, 0, 0.53, (0.02, 0.86, 0.45)); b(-0.27, 0, 0.53, (0.02, 0.86, 0.45))
    b(0, 0.44, 0.53, (0.5, 0.02, 0.45)); b(0, -0.44, 0.53, (0.5, 0.02, 0.45)); b(0, -0.55, 0.95, (0.5, 0.04, 0.04))
def gondola(x, y, L, rz=0.0, h=1.8, stock=0.6):
    """a double-sided shop shelf (you cannot see over it): base, spine, four shelves a side, goods on some"""
    B(x, y, rz, 0, 0, 0, (0.7, L, 0.12), 'metal'); B(x, y, rz, 0, 0, 0.12, (0.06, L - 0.02, h - 0.12), 'metal')
    for k, z in enumerate((0.45, 0.85, 1.25, 1.65)):
        for s in (-1, 1):
            B(x, y, rz, s * 0.18, 0, z, (0.3, L - 0.04, 0.025), 'metal')
            n = int(L / 0.42)
            for j in range(n):
                if random.random() < stock: B(x, y, rz, s * 0.18, -L / 2 + 0.25 + j * (L - 0.5) / max(1, n - 1), z + 0.025, (0.25, 0.3, 0.12 + 0.02 * ((j + k) % 4)), random.choice(('plaster', 'brick', 'paint', 'wood')))
def wall_shelf(x0, x1, y, side, h=2.2, d=0.55):
    """shelving against a wall (side: which way it faces, +1 north / -1 south)"""
    cx = (x0 + x1) / 2; L = x1 - x0
    box((cx, y + side * d / 2, 0), (L, d, 0.1), 'metal'); box((cx, y + side * 0.02, 0.1), (L, 0.04, h - 0.1), 'metal')
    for z in (0.6, 1.1, 1.6, 2.05):
        box((cx, y + side * (d / 2 + 0.02), z), (L - 0.04, d - 0.04, 0.025), 'metal')
        for j in range(int(L / 0.5)):
            if random.random() < 0.5: box((x0 + 0.3 + j * 0.5, y + side * (d / 2 + 0.02), z + 0.025), (0.32, 0.3, 0.14 + 0.03 * (j % 3)), random.choice(('plaster', 'brick', 'paint')))
def table(x, y, r=0.5, rz=0.0, tipped=False, h=0.75):
    if tipped:
        before = set(bm.faces); bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=12, radius1=r, radius2=r, depth=0.04, matrix=T(x, y, r + 0.01) @ Rz(rz) @ Rx(math.pi / 2))
        for f in [f for f in bm.faces if f not in before]: f.material_index = MI['plaster']
        tube(P(x, y, rz, 0, 0.03), P(x, y, rz, 0, h), 0.05, 'metal') if False else beam((*P(x, y, rz, 0, 0.05), r), (*P(x, y, rz, 0, h), r), 0.07, 'metal'); return
    cyl((x, y, 0), 0.22, 0.03, 'metal', 10); cyl((x, y, 0.03), 0.04, h - 0.06, 'metal', 6); cyl((x, y, h - 0.03), r, 0.03, 'plaster', 14)
def chair(x, y, rz=0.0):
    B(x, y, rz, 0, 0, 0.42, (0.42, 0.42, 0.04), 'wood'); B(x, y, rz, 0, 0.2, 0.46, (0.42, 0.03, 0.42), 'wood')
    for dx in (-0.18, 0.18):
        for dy in (-0.18, 0.18): B(x, y, rz, dx, dy, 0, (0.03, 0.03, 0.42), 'metal')
def mannequin(x, y, rz=0.0):
    cyl((x, y, 0), 0.25, 0.04, 'metal', 10); cyl((x, y, 0.04), 0.025, 0.85, 'metal', 6)
    B(x, y, rz, 0, 0, 0.9, (0.34, 0.2, 0.42), 'plaster'); B(x, y, rz, 0, 0, 1.32, (0.42, 0.24, 0.32), random.choice(('brick', 'paint', 'plaster')))
    cyl((x, y, 1.64), 0.05, 0.08, 'plaster', 6); B(x, y, rz, 0, 0, 1.72, (0.16, 0.18, 0.22), 'plaster')
def vending(x, y, rz, lying=False):
    if lying: B(x, y, rz, 0, 0, 0, (0.9, 1.85, 0.75), 'brick', 0, 0.02); return
    B(x, y, rz, 0, 0, 0, (0.95, 0.8, 1.9), 'brick', 0, 0.02); B(x, y, rz, -0.1, -0.41, 0.8, (0.6, 0.03, 0.95), 'glass')
def shop(x0, x1, side, kind, lit):
    """one shop unit between x0 and x1; side +1 north row (front at y=8), -1 south row (front at y=-8)"""
    yf, yb = 8.0 * side, 22.0 * side; cx = (x0 + x1) / 2; ym = (yf + yb) / 2; s = side
    dx = random.choice((0.9, 4.6)); door = (x0 + dx, x0 + dx + 1.9)
    wy(yb, x0, x1, H, 'brick', [door])
    FLOORS.append((x0, min(yf, yb), x1, max(yf, yb), {'grocery': 'tile', 'clothes': 'wood', 'electronics': 'concrete', 'cafe': 'wood', 'looted': 'tile', 'shut': 'concrete'}[kind]))
    for a, b in ((x0 + 0.15, x0 + 1.55), (x1 - 1.55, x1 - 0.15)):
        if random.random() < 0.6 or kind == 'shut': box(((a + b) / 2, yf, 0), (b - a, 0.22, 0.5), 'metal'); box(((a + b) / 2, yf, 0.5), (b - a - 0.04, 0.08, 2.7), 'glass')
        else: box(((a + b) / 2, yf, 0), (b - a, 0.22, 0.3), 'metal'); heap(((a + b) / 2, yf - 0.9 * s, 0), 0.9, 0.5, 0.06, 'glass')
    box((cx, yf, 3.2), (x1 - x0 - 0.25, 0.3, H - 3.2), 'plaster')
    sign(cx, yf - 0.15 * s - 0.035 * s, 3.55, x1 - x0 - 1.6, 0.65, 0.0 if s > 0 else math.pi, 'emissive_sign' if lit or random.random() < 0.25 else random.choice(('metal', 'paint', 'brick')), 'metal')
    if kind == 'shut':
        box((cx, yf + 0.1 * s, 0), (4.4, 0.1, 3.2), 'rust'); return
    if random.random() < 0.45: box((cx, yf + 0.1 * s, 1.95), (4.4, 0.1, 1.25), 'rust')    # security shutter half down (you walk under it)
    yy = lambda d: yf + s * d                                                     # d metres in from the shopfront
    if kind == 'grocery':
        for gx in (-1.45, 1.45): gondola(cx + gx, yy(6.8), 7.0)
        wall_shelf(x0 + 0.3, door[0] - 0.2, yb - s * 0.125, -s) if door[0] - x0 > 1.5 else None
        wall_shelf(door[1] + 0.2, x1 - 0.3, yb - s * 0.125, -s) if x1 - door[1] > 1.5 else None
        box((x1 - 0.7, yy(1.4), 0), (0.7, 1.2, 1.0), 'wood'); box((x1 - 0.7, yy(1.2), 1.0), (0.35, 0.3, 0.25), 'metal')
        for k in range(2): cart(cx + random.uniform(-0.2, 0.2), yy(10.6 + k * 1.4), random.uniform(-0.15, 0.15), k == 1)
    elif kind == 'clothes':
        for px, d in ((-2.0, 4.0), (1.8, 5.5), (-1.2, 8.5), (2.0, 9.5)): cyl((cx + px, yy(d), 0), 0.55, 1.35, random.choice(('brick', 'plaster', 'paint')), 10); cyl((cx + px, yy(d), 1.35), 0.6, 0.03, 'metal', 10)
        for px, d in ((-2.6, 1.4), (2.6, 1.6), (0.3, 7.0)): mannequin(cx + px, yy(d), random.uniform(0, 6.28))
        for k in range(2): box((x0 + 0.55, yy(10.6 + k * 1.3), 0), (0.85, 0.2, 2.1), 'metal'); box((x0 + 0.55, yy(11.25 + k * 1.3) - s * 0.0, 2.0), (0.85, 1.2, 0.05), 'metal')
        box((x1 - 0.45, ym, 1.6), (0.06, 8.0, 0.04), 'metal')
        for k in range(10): box((x1 - 0.45, ym - 3.8 + k * 0.84, 0.75), (0.5, 0.3, 0.82), random.choice(('brick', 'plaster', 'paint')))
    elif kind == 'electronics':
        box((cx, yy(11.0), 0), (5.0, 0.8, 1.05), 'wood'); box((cx - 1.2, yy(11.0), 1.05), (0.45, 0.35, 0.28), 'metal')
        for k in range(6): box((x0 + 0.155, yy(2.5 + k * 1.5), 1.2), (0.03, 1.3, 0.75), 'glass')       # dead screens on the side wall
        for px, d in ((-1.8, 4.5), (1.8, 4.5), (0.0, 7.5)):
            box((cx + px, yy(d), 0), (1.4, 0.9, 0.9), 'metal')
            for j in range(3): box((cx + px - 0.45 + j * 0.45, yy(d), 0.9), (0.3, 0.2, 0.02 + 0.05 * j), 'grime')
        heap((cx + 0.5, yy(9.0), 0), 0.8, 0.5, 0.05, 'glass')
    elif kind == 'cafe':
        box((cx, yy(10.5), 0), (5.6, 0.8, 1.05), 'wood'); box((cx + 1.6, yy(10.5), 1.05), (0.5, 0.45, 0.55), 'metal'); box((cx - 1.0, yy(10.5), 1.05), (1.4, 0.6, 0.45), 'glass')
        sign(cx, yb - s * 0.125 - s * 0.035, 2.0, 3.6, 0.9, 0.0 if s < 0 else math.pi, 'paint', 'wood')
        for px, d in ((-2.0, 2.5), (1.6, 3.0), (-1.4, 6.0), (2.0, 7.0)):
            tip = random.random() < 0.3; table(cx + px, yy(d), 0.45, random.uniform(0, 3), tip)
            if not tip:
                for a in (0.0, 3.14): chair(cx + px + 0.75 * math.cos(a), yy(d) + 0.75 * math.sin(a), a + math.pi / 2)
    elif kind == 'looted':
        B(cx - 0.5, yy(5.5), 0.35, 0, 0, 0, (0.8, 6.0, 0.6), 'metal'); heap((cx + 1.5, yy(8.0), 0), 1.6, 1.0, 0.3, 'concrete')
        for px, d in ((-2.6, 2.2), (2.4, 9.8), (-2.4, 11.2), (1.2, 12.0)): crate(cx + px, yy(d), 0.6, random.uniform(0, 1), 'plaster', 'metal')
        litter(cx + 2.2, yy(3.0), 1.0, 8); blob(cx - 1.6, yy(10.0), 1.0, 'grime')
    tube_lamp(cx, yy(4.0), H - 0.6, on=lit, w=150, rz=math.pi / 2); tube_lamp(cx, yy(10.0), H - 0.6, on=lit, w=150, rz=math.pi / 2)
def food_court():
    for k in range(5):
        y0 = -21.0 + k * 8.4; y1 = y0 + 8.4
        if k: box((-43.25, y0, 0), (3.5, 0.2, H), 'plaster')                     # kiosk dividers
        wx(-41.5, y0 + 2.0, y1 - 0.2, 1.1, 'wood', th=0.7)
        box((-44.45, (y0 + y1) / 2, 0), (0.8, 6.0, 1.0), 'metal')              # back counter / fryers
        for j in range(3): box((-44.45, (y0 + y1) / 2 - 2.0 + j * 2.0, 1.0), (0.6, 0.9, 0.3 + 0.1 * j), 'metal')
        sign(-41.13, (y0 + y1) / 2 + 0.9, 3.0, 5.0, 0.9, math.pi / 2, 'emissive_sign' if k in (1, 3) else random.choice(('paint', 'brick', 'metal')), 'metal')
        box((-41.5, (y0 + y1) / 2 + 0.9, 3.9), (0.3, 5.4, H - 3.9), 'plaster')
    FLOORS.append((-45.0, -22.0, -25.0, 22.0, 'tile'))
    for x in (-37.0, -32.5, -28.0):
        for y in range(-18, 19, 5):
            if (x, y) == (-32.5, 2): continue
            tip = random.random() < 0.2; table(x, y, 0.75, random.uniform(0, 3), tip)
            if tip: continue
            for a in range(4):
                if random.random() < 0.8: sx, sy = x + 1.05 * math.cos(a * math.pi / 2 + 0.5), y + 1.05 * math.sin(a * math.pi / 2 + 0.5); cyl((sx, sy, 0), 0.2, 0.42, 'metal', 8)
    box((-32.5, 2.0, 0), (1.5, 0.9, 1.0), 'metal', 0.6)                        # an overturned bin store
    box((-26.5, -12.0, 0), (1.0, 2.4, 1.3), 'wood'); box((-26.5, -12.0, 1.3), (0.8, 2.2, 0.05), 'metal')     # tray return
    for y in (-21.45, 21.45): vending(-30.0, y, 0.0 if y < 0 else math.pi); vending(-28.9, y, 0.0 if y < 0 else math.pi)
    for k in range(2): box((-32.5, -6.0 + 12.0 * k, 4.2), (0.1, 4.0, 0.9), 'emissive_sign' if k == 0 else 'paint'); box((-32.5, -6.0 + 12.0 * k, 5.1), (0.03, 0.03, 0.895), 'metal')
    for x, y in ((-35.0, -8.0), (-30.5, 12.5), (-38.5, 4.0)): blob(x, y, random.uniform(0.6, 1.1), 'grime')
    litter(-34.0, -14.0, 2.0, 9); litter(-30.0, 7.0, 2.0, 8)
    pendant(-32.5, -11.0, 4.3, 200); pendant(-32.5, 11.0, 4.3, 170)
def barricade(x):
    """the survivors' wall across the concourse: tables on their sides, vending machines, carts, boards; two ways through"""
    vending(x, -7.0, 0.0); vending(x + 0.2, -6.1, 0.05, True); table(x - 0.4, -5.0, 0.7, 0.0, True)
    cart(x + 0.6, -0.8, 1.4); cart(x - 0.5, -0.3, 0.2, True); vending(x, 0.6, 3.14); B(x, 1.6, 0.1, 0, 0, 0, (0.4, 1.4, 1.1), 'wood')
    for k in range(4): beam((x - 0.35, -1.9 + k * 0.5, 0.2 + k * 0.05), (x - 0.35, -0.7 + k * 0.5, 1.4 - k * 0.1), 0.08, 'wood')
    vending(x, 6.9, 3.14); vending(x - 0.1, 6.0, 3.1, True); table(x + 0.3, 5.0, 0.7, 1.57, True)
    for y in (-3.9, 4.0): box((x - 1.6, y, 0), (0.5, 0.5, 0.42), 'wood')             # (the gaps: y -4.4..-2.4 and 2.6..4.4)
    litter(x - 2.0, 0.0, 2.0, 8)
def build():
    for x in (-XH - 0.3, XH + 0.3): box((x, 0, 0), (0.6, 2 * YH + 1.2, H), 'brick')
    for y in (-YH - 0.3, YH + 0.3): box((0, y, 0), (2 * XH, 0.6, H), 'brick')
    # ceiling (1 cm above every wall top, out past the outer walls) with the atrium hole, and the skylight lantern over it (panes broken out)
    S = 5.0; E = 0.75; z = H + 0.01
    box((0, (-YH - E - S) / 2, z), (2 * XH + 2 * E, YH + E - S, 0.4), 'concrete'); box((0, (YH + E + S) / 2, z), (2 * XH + 2 * E, YH + E - S, 0.4), 'concrete')
    box(((-XH - E - S) / 2, 0, z), (XH + E - S, 2 * S, 0.4), 'concrete'); box(((XH + E + S) / 2, 0, z), (XH + E - S, 2 * S, 0.4), 'concrete')
    zt = H + 0.41
    for s in (-1, 1): box((0, s * (S + 0.1), zt), (2 * S + 0.4, 0.2, 1.6), 'metal'); box((s * (S + 0.1), 0, zt), (0.2, 2 * S, 1.6), 'metal')
    for i in range(5):
        for j in range(5):
            cx_, cy_ = -S + 1.0 + 2.0 * i, -S + 1.0 + 2.0 * j
            if random.random() < 0.55 and not (i == 2 and j == 2): continue    # broken pane
            box((cx_, cy_, zt + 1.62), (1.86, 1.86, 0.04), 'glass')
    for k in range(6): box((-S + 2.0 * k, 0, zt + 1.6), (0.12, 2 * S, 0.12), 'metal')
    for k in range(6): box((0, -S + 2.0 * k, zt + 1.585), (2 * S, 0.12, 0.16), 'metal')
    for sx in (-1, 1):
        for sy in (-1, 1): box((sx * 5.6, sy * 5.6, 0), (0.6, 0.6, H), 'concrete')
    # floors: tiled concourse, lobby, concrete corridors and store rooms (the shops add their own)
    FLOORS.append((-25.0, -8.0, 35.0, 8.0, 'tile')); FLOORS.append((35.0, -22.0, 45.0, 22.0, 'tile'))
    # the shop rows: 8 units of 7.5 m each side
    kinds = ['grocery', 'clothes', 'electronics', 'cafe', 'grocery', 'looted', 'clothes', 'looted']
    lit = {(1, 2), (-1, 5), (1, 6)}
    for side in (-1, 1):
        random.shuffle(kinds); ks = list(kinds); ks[3 if side > 0 else 5] = 'shut'
        for i in range(8):
            x0 = -25.0 + 7.5 * i; shop(x0, x0 + 7.5, side, ks[i], (side, i) in lit and ks[i] != 'shut')
            if i: wx(x0, 8.0 * side if side > 0 else -22.0, 22.0 if side > 0 else -8.0, H, 'plaster')
        wx(-25.0, 8.0 if side > 0 else -22.0, 22.0 if side > 0 else -8.0, H, 'plaster'); wx(35.0, 8.0 if side > 0 else -22.0, 22.0 if side > 0 else -8.0, H, 'plaster')
        # back corridor (22..28) and store rooms (28..33) behind it
        ys = 28.0 * side; wy(ys, -XH, XH, H, 'brick', [(-40.0, -38.1), (-22.0, -20.1), (-6.0, -4.1), (8.0, 9.9), (22.0, 23.9), (37.0, 38.9)])
        FLOORS.append((-45.0, min(22.0 * side, 33.0 * side), 45.0, max(22.0 * side, 33.0 * side), 'concrete'))
        for x in (-30.0, -15.0, 0.0, 15.0, 30.0): wx(x, 28.125 if side > 0 else -33.0, 33.0 if side > 0 else -28.125, H, 'brick')
        for x0, x1 in ((-44.7, -40.6), (-37.5, -30.3), (-29.7, -22.6), (-19.5, -15.3), (-14.7, -6.6), (-3.5, -0.3), (0.3, 7.4), (10.5, 14.7), (15.3, 21.4), (24.5, 29.7), (30.3, 36.4), (39.5, 44.7)):
            wall_shelf(x0 + 0.1, x1 - 0.1, YH * side, -side)
        for x in (-35.0, -19.0, -3.0, 18.0, 33.0): pallet(x, 30.0 * side, 0.2, random.choice(('boxes', 'sacks')))
        # the corridor: pipes and a cable tray overhead, fuse boxes, a yellow line, bins and carts against the wall
        pipe_run([(-44.6, 23.0 * side, 5.2), (44.6, 23.0 * side, 5.2)], 0.12, 'metal', 10); pipe_run([(-44.6, 23.45 * side, 5.55), (44.6, 23.45 * side, 5.55)], 0.08, 'rust', 8)
        cable_tray((-44.6, 25.0 * side), (44.6, 25.0 * side), 5.0, 0.45, 'metal', H)
        for x in range(-40, 41, 8): box((x, 23.0 * side, 5.32), (0.05, 0.05, H - 5.325), 'metal')
        strip(-44.5, 22.6 * side, 44.5, 22.6 * side, 0.12, 'paint')
        for x in (-34.0, -12.0, 12.0, 26.0): box((x, (27.875 - 0.12) * side, 1.2), (0.7, 0.2, 0.9), 'metal'); box((x, (27.875 - 0.23) * side, 1.3), (0.5, 0.02, 0.6), 'grime')
        for x, w, d, h in ((-33.0, 1.2, 0.8, 1.3), (-10.0, 2.0, 0.9, 1.0), (20.0, 1.0, 1.0, 1.6), (41.0, 1.4, 1.4, 1.1)): box((x, 27.3 * side, 0), (w, d, h), 'metal', 0.0, 0.03)
        cart(-27.0, 26.8 * side, 0.3); cart(5.0, 27.0 * side, -0.2, True); barrels(31.0, 26.4 * side if side > 0 else -27.1, 3, 'metal')
        for x in (-38.0, 0.0, 38.0): emergency(x, 27.8 * side, 3.2, 0, -side)
        # food court and lobby walls on to the corridor
        wy(22.0 * side, -XH, -25.0, H, 'plaster', [(-37.0, -34.0)]); wy(22.0 * side, 35.0, XH, H, 'plaster', [(38.5, 41.5)])
        for x in (-35.5, 40.0): exit_sign(x, 22.0 * side - 0.18 * side, 2.8)
    food_court()
    # lobby: chained glass doors on the east wall, two dead escalators, an information desk, a cash machine, benches
    for y in (-3.0, -1.0, 1.0, 3.0): box((XH - 0.06, y, 0), (0.08, 1.9, 2.6), 'glass')
    box((XH - 0.2, 0, 2.6), (0.2, 8.4, 0.4), 'metal')
    for y in (-2.0, 0.0, 2.0): beam((XH - 0.25, y - 0.6, 1.0), (XH - 0.25, y + 0.6, 1.1), 0.04, 'grime')
    for sy in (-1, 1):
        for k in range(6): box((39.5, sy * (11.0 + k * 1.2), 0), (2.2, 1.2, 0.6 + 0.48 * k), 'metal')
        for sx in (-1, 1): beam((39.5 + sx * 1.15, sy * 10.4, 1.0), (39.5 + sx * 1.15, sy * 18.0, 4.0), 0.12, 'metal')
    cyl((40.0, 0.0, 0), 1.3, 1.05, 'wood', 16); cyl((40.0, 0.0, 1.05), 1.36, 0.04, 'metal', 16)
    box((44.55, 7.5, 0), (0.6, 0.9, 1.7), 'metal'); box((44.23, 7.5, 1.1), (0.03, 0.5, 0.35), 'emissive_sign')
    for y in (-7.0, 7.5): bench(37.0, y, math.pi / 2)
    sign(44.62, -9.0, 1.2, 1.8, 1.2, math.pi / 2, 'emissive_sign', 'metal')               # the lit mall map by the doors
    pendant(40.0, -5.5, 4.3, 190)
    # concourse: planters with dead trees, a dry fountain, kiosk carts, the barricade, rubble and a puddle under the skylight
    for x in (-20.0, -12.0, 20.0, 30.0):
        for y in (-4.6, 4.6): planter(x, y)
    for x in (-16.0,):
        for y in (-4.6, 4.6): bench(x, y, 0.0 if y < 0 else math.pi)
    cyl((12.0, 0.0, 0), 2.8, 0.55, 'concrete', 20); cyl((12.0, 0.0, 0.55), 2.5, 0.02, 'dirt', 20); cyl((12.0, 0.0, 0), 0.8, 1.5, 'concrete', 12)
    cyl((12.0, 0.0, 1.5), 1.3, 0.2, 'concrete', 12); cyl((12.0, 0.0, 1.7), 0.3, 0.9, 'concrete', 8)
    box((-7.5, -3.2, 0), (1.2, 2.2, 1.1), 'wood', 0.2); box((-7.5, -3.2, 1.1), (1.4, 2.4, 0.08), 'rust', 0.2); box((31.5, 1.0, 0), (1.2, 2.2, 1.1), 'metal', -0.3)
    for k in range(7):
        heap((random.uniform(-3.5, 4.5), random.uniform(-3.5, 3.5), 0), random.uniform(0.4, 1.0), random.uniform(0.3, 0.8), random.uniform(0.08, 0.2), random.choice(('glass', 'concrete')))
    blob(0.5, -1.0, 2.2, 'glass', 14, 0.3)
    beam((-1.0, 2.6, 0.18), (3.5, 0.8, 0.12), 0.25, 'metal')                    # a fallen skylight frame
    barricade(24.0)
    for x, y, r in ((-18.0, 1.0, 0.4), (-2.0, -6.0, 1.2), (8.0, 5.5, 2.0), (16.0, -6.2, 0.3), (-23.0, -6.5, 2.6)): cart(x, y, r, random.random() < 0.3)
    for x, y in ((-10.0, 2.0), (6.0, -6.0), (17.0, 3.0), (-22.0, -2.0), (28.0, -2.0)): blob(x, y, random.uniform(0.5, 1.0), 'grime')
    litter(-14.0, -1.5, 2.0, 7); litter(15.0, 4.0, 1.5, 6)
    sign(-14.0, 0.0, 1.0, 1.6, 1.1, 0.0, 'emissive_sign', 'metal', True)                # the directory board: a landmark
    for x, c in ((-8.5, 'brick'), (8.5, 'paint')):                                   # banners hung from the ceiling round the atrium
        for y in (-6.5, 6.5): box((x, y, 2.2), (1.3, 0.04, H - 2.2 - 0.005), c)
    for s in (-1, 1):                                                               # ducts along the concourse, over the shopfronts
        for x0, x1 in ((-24.8, -5.4), (5.4, 34.8)):
            box(((x0 + x1) / 2, s * 6.6, 5.2), (x1 - x0, 0.8, 0.5), 'metal')
            for x in np.arange(x0 + 1.0, x1, 4.0): box((float(x), s * 6.6, 5.7), (0.04, 0.9, H - 5.705), 'metal')
    for x in (-21.0, -8.0, 21.0, 31.0): pendant(x, 0.0 if abs(x) > 10 else 1.5, 4.3, 220)
    for x in (-24.6, 34.6): exit_sign(x, 0.0, 3.0, math.pi / 2)
    floor(FLOORS, 'concrete', -XH - 0.5, -YH - 0.5, XH + 0.5, YH + 0.5)
    log('map', len(bm.faces), 'faces')
def post_lights():
    so = bpy.data.objects['Sun']; so.data.energy = 2.6; so.data.color = (1.0, 0.55, 0.32)
    so.rotation_euler = Vector((0.55, 0.25, -0.80)).normalized().to_track_quat('-Z', 'Y').to_euler()     # dusk sun, steep enough to reach the floor through the skylight
    bg = next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND'); bg.inputs['Strength'].default_value = 0.5
PREVIEW_VIEWS = [((-20, -1, 1.6), (20, 1, 1.4)), ((8, 0, 1.6), (0, 0, 2.5)), ((-30, 0, 1.6), (-40, 10, 1.2)), ((10, -6, 1.6), (12, -15, 1.4)),
                 ((-40, 25, 1.6), (40, 25, 1.6)), ((40, 0, 1.6), (20, 0, 1.6))]

def uv_world(me):
    uvl = me.uv_layers.new(name='UVMap'); bmx = bmesh.new(); bmx.from_mesh(me); lay = bmx.loops.layers.uv['UVMap']
    for f in bmx.faces:
        n = f.normal; ax = max(range(3), key=lambda i: abs(n[i])); k = MATS[f.material_index]; s = TILE.get(k, 3.0)
        for l in f.loops:
            p = l.vert.co
            u, v = ((p.y, p.z) if ax == 0 else (p.x, p.z) if ax == 1 else (p.x, p.y))
            l[lay].uv = (u / s, v / s)
    bmx.to_mesh(me); bmx.free()

# ---------------------------------------------------------------- lights and sky
def lights():
    lc = bpy.data.collections.new('lights'); scene.collection.children.link(lc)
    sd = bpy.data.lights.new('Sun', 'SUN'); sd.energy = 5.0; sd.color = (1.0, 0.62, 0.38); sd.angle = math.radians(2.5)
    so = bpy.data.objects.new('Sun', sd); lc.objects.link(so)
    L = Vector((0.40, 0.88, -0.33)).normalized()          # low sun from the south, slightly from the west: long shadows down and across the street
    so.rotation_euler = L.to_track_quat('-Z', 'Y').to_euler()
    for i, L_ in enumerate(LIGHTS):                    # (x, y, z, watts, colour[, spot cone in radians: a lamp that only shines down])
        x, y, z, w, c = L_[:5]
        ld = bpy.data.lights.new('lamp%d' % i, 'SPOT' if len(L_) > 5 else 'POINT'); ld.energy = w; ld.color = c; ld.shadow_soft_size = 0.3
        if len(L_) > 5: ld.spot_size = L_[5]; ld.spot_blend = 0.5
        lo = bpy.data.objects.new('lamp%d' % i, ld); lc.objects.link(lo); lo.location = (x, y, z)
    for i, (x0, x1, y0, y1, z, k, c) in enumerate(globals().get('AREAS', [])):     # soft fill from the ceiling, no fixture: dim, even, in the light picture and the probes alike
        ld = bpy.data.lights.new('fill%d' % i, 'AREA'); ld.shape = 'RECTANGLE'; ld.size = x1 - x0; ld.size_y = y1 - y0; ld.energy = k * (x1 - x0) * (y1 - y0); ld.color = c
        lo = bpy.data.objects.new('fill%d' % i, ld); lc.objects.link(lo); lo.location = ((x0 + x1) / 2, (y0 + y1) / 2, z)
    w = bpy.data.worlds.get('mall_sky') or bpy.data.worlds.new('mall_sky'); scene.world = w; w.use_nodes = True; nt = w.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputWorld'); bg = nt.nodes.new('ShaderNodeBackground'); tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); ramp = nt.nodes.new('ShaderNodeValToRGB'); mid = nt.nodes.new('ShaderNodeMapRange')
    nt.links.new(tc.outputs['Normal'], sep.inputs[0]); nt.links.new(sep.outputs['Z'], mid.inputs['Value'])
    mid.inputs['From Min'].default_value = -1; mid.inputs['From Max'].default_value = 1; mid.inputs['To Min'].default_value = 0; mid.inputs['To Max'].default_value = 1
    nt.links.new(mid.outputs['Result'], ramp.inputs['Fac'])
    cr = ramp.color_ramp; cr.elements[0].position = 0.0; cr.elements[0].color = (0.10, 0.08, 0.07, 1); cr.elements[1].position = 1.0; cr.elements[1].color = (0.12, 0.12, 0.14, 1)
    for pos, c in ((0.48, (0.22, 0.16, 0.12)), (0.505, (0.85, 0.48, 0.24)), (0.56, (0.55, 0.36, 0.26)), (0.75, (0.26, 0.22, 0.22))):
        el = cr.elements.new(pos); el.color = (*c, 1)
    nt.links.new(ramp.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = 2.6; nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    scene.view_settings.exposure = 0.0

# ---------------------------------------------------------------- bake the light picture
def bake(ob, size=2048, samples=40):
    me = ob.data; lm = me.uv_layers['Lightmap']; me.uv_layers.active = lm
    img = bpy.data.images.new('mall_light', size, size, alpha=False, float_buffer=True)
    for m in me.materials:
        nt = m.node_tree; n = nt.nodes.new('ShaderNodeTexImage'); n.name = 'hg_bake'; n.image = img; nt.nodes.active = n
    scene.render.engine = 'CYCLES'; scene.cycles.samples = samples; scene.cycles.device = 'CPU'
    try: scene.cycles.use_denoising = False
    except Exception: pass
    vl = bpy.context.view_layer
    for o in list(vl.objects):
        if o is not None: o.select_set(False)
    vl.objects.active = ob; ob.select_set(True)
    scene.render.bake.margin = 6
    try: scene.cycles.sample_clamp_indirect = 3.0           # (fireflies)
    except Exception: pass
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=6, use_clear=True)
    a = np.array(img.pixels[:], np.float32).reshape(size, size, 4)
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get(); bvh = BVHTree.FromObject(ob, dg); uvd = me.uv_layers['Lightmap'].data; black = []
    for f in me.polygons:
        c = f.center; n = f.normal
        if n.z < -0.5 or bvh.ray_cast(c + n * 0.02, n, 1.0)[0] is not None: continue
        u = sum((uvd[li].uv for li in f.loop_indices), Vector((0, 0))) / f.loop_total
        px = a[min(size - 1, int(u.y * size)), min(size - 1, int(u.x * size)), :3]
        if float(px.sum()) < 0.01 and f.area > 0.2: black.append((MATS[f.material_index], round(f.area, 2), tuple(round(x, 1) for x in c)))
    log('exposed faces over 0.2 m2 baked black:', len(black), black[:14])
    rgb = a[:, :, :3]; from mapkit import clean_light; clean, nfire = clean_light(rgb, globals().get('FILL', (0.0, 0.0, 0.0))); log('light picture: %d noisy texels smoothed' % nfire)
    a[:, :, :3] = clean; img.pixels.foreach_set(a.ravel())
    path = os.path.join(TEXDIR, 'mall_light.exr'); 
    if BLOOM: import ash_paint; ash_paint.save_exr_linear(img, path)        # (the bloom look: the light as baked, darks not lifted)
    else: img.filepath_raw = path; img.file_format = 'OPEN_EXR'; img.save()
    for m in me.materials:
        n = m.node_tree.nodes.get('hg_bake')
        if n: m.node_tree.nodes.remove(n)
    me.uv_layers.active = me.uv_layers['UVMap']
    lum = (rgb @ np.array((0.3, 0.59, 0.11), np.float32)); nz = lum[lum > 0]
    log('baked', path, 'light median %.2f, 90%% %.2f' % (float(np.median(nz)), float(np.percentile(nz, 90))))
    bpy.data.images.remove(img)

# ---------------------------------------------------------------- THE BLOOM (the owner's night look; shared plumbing in ash_paint.py, see make_yard.py)
# THE ARCADE (indoor): barely touched. Teal leads, a warm amber second; half the mall's lamps still work. The growth has only got in under
# the broken skylight: a heart round the dry fountain and the atrium, a root or two into the nearest shops and out along the concourse.
import ash_paint
from ash_paint import BLOOM_TEAL as TEAL, BLOOM_AMBER as AMBER
BP = dict(name='mall', lead=TEAL, second=AMBER, lead_mat='emissive_teal', second_mat='emissive_amber', indoor=True,
         keep_every=1, lamp_k=0.8, skyk=3.0, fill=float(OPT.get('fill', 0.022)), lamp_keep_col=True, lamp_face=(1.0, 0.85, 0.6), amber_glow=False,
         moon=(-0.2, 0.3, 0.93), moon_e=float(OPT.get('moon', 0.8)), moon_col=(0.62, 0.76, 1.0),
         sky=dict(aurora=0.25), gs=0.42, cgs=0.6, sat=2.0, rk=0.55, step=0.95, seg=5, glowk=3.0, lm=512, max_glows=36, seed=int(OPT.get('seed', 13)))
def bloom_layout(B):
    Tl, A = TEAL, AMBER
    B.heart((10.0, 0.0), 12.0, Tl, A, 0.25, clusters=7, vines=12, shelves=3, roots=7, sprouts=5, Lmax=1.8, size=5.0)         # under the broken skylight
    for x, y, c in ((-6.0, 9.0, Tl), (20.0, -9.0, A), (-6.0, -9.0, Tl), (26.0, 9.0, Tl), (-30.0, 0.0, A), (38.0, 0.0, Tl), (-18.0, 9.0, A), (32.0, -9.0, Tl), (-18.0, -9.0, Tl)):
        B.heart((x, y), 5.0, c, A if c == Tl else Tl, 0.3, clusters=2, vines=4, shelves=1, roots=2, sprouts=2, Lmax=1.1)
    B.trail([(4.0, 0.0), (-6.0, 1.0), (-16.0, 0.0), (-26.0, 0.0)], Tl)
    B.trail([(16.0, 1.0), (24.0, 0.0), (34.0, 0.0)], Tl)

# ---------------------------------------------------------------- run
make_pictures(); mats = materials(); build()
if BLOOM: ash_paint.bloom_dim_lamps(globals(), BP)
for v in bm.verts: v.co.z = max(v.co.z, 0.0)          # nothing below the ground: the exporter measures heights from the lowest point
_gv = {v for f in GROUND_FACES for v in f.verts}
for v in bm.verts:                                     # whatever stands on the ground starts 6 mm above it: a bottom face coplanar with the
    if v not in _gv and v.co.z < 0.006: v.co.z = 0.006  # ground lets the exporter's down-rays miss it and read the object as a thin sheet
from coplanar import report as coplanar_report
COP = coplanar_report(bm, MATS, log)
if 'coponly' in OPT: raise SystemExit(0)
me = bpy.data.meshes.new('mall'); bm.to_mesh(me); bm.free()
for m in mats: me.materials.append(m)
uv_world(me)
mc = bpy.data.collections.new('map'); scene.collection.children.link(mc)
ob = bpy.data.objects.new('mall', me); mc.objects.link(ob)
me.calc_loop_triangles(); log('mall', len(me.loop_triangles), 'triangles,', len(me.vertices), 'verts')
lu = me.uv_layers.new(name='Lightmap'); me.uv_layers.active = lu
from mapkit import lightmap_uv; lightmap_uv(ob, log)
uvd = me.uv_layers['Lightmap']; me.uv_layers.active = me.uv_layers['UVMap']
lights(); post_lights()
if BLOOM: bob = ash_paint.bloom_grow(globals(), bloom_layout, BP); ash_paint.bloom_relight(globals(), BP)
def reach_check(ob):
    """walkable cells on a 0.5 m grid (nothing solid between 0.45 m and head height, not inside a solid), flood filled from mid-street"""
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get(); bvh = BVHTree.FromObject(ob, dg)
    xs = np.arange(-45.0, 45.0 + 0.01, 0.5); ys = np.arange(-33.0, 33.0 + 0.01, 0.5); walk = np.zeros((len(xs), len(ys)), bool)
    for i, x in enumerate(xs):
        for j, y in enumerate(ys):
            ok = True
            for dx, dy in ((0, 0), (0.2, 0.2), (-0.2, 0.2), (0.2, -0.2), (-0.2, -0.2)):
                h = bvh.ray_cast(Vector((x + dx, y + dy, 2.15)), Vector((0, 0, -1)), 3.0)
                if h[0] is None or h[0].z > 0.45 or h[1].z < 0: ok = False; break
            walk[i, j] = ok
    seen = np.zeros_like(walk); st = [(int((0 + 45.0) / 0.5), int((0 + 33.0) / 0.5))]
    while st:
        i, j = st.pop()
        if i < 0 or j < 0 or i >= len(xs) or j >= len(ys) or seen[i, j] or not walk[i, j]: continue
        seen[i, j] = True; st += [(i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)]
    lost = walk & ~seen; pts = [(float(xs[i]), float(ys[j])) for i, j in zip(*np.nonzero(lost))]
    log('reach: %d walkable cells, %d reached, %d cut off' % (walk.sum(), seen.sum(), lost.sum()), pts[:8])
reach_check(ob)
if 'nobake' not in OPT: bake(ob, 2048, int(OPT.get('samples', 40)))
if BLOOM:
    if 'nobake' not in OPT: ash_paint.bloom_bake(globals(), bob, BP, int(OPT.get('samples', 40)))
    ash_paint.bloom_split(globals(), bob)
cfg = {'blend': 'mall.blend', 'out': '../../Ashfall/assets/mall', 'world': {'collections': ['map'], 'lightmap': 'tex/mall_light.exr', 'lmSize': 2048},
       'grid': {'cell': 0.25}, 'probes': {'cell': 1.0, 'height': 1.0, 'samples': 96}, 'sky': {'width': 1024}, 'maxTexture': 1024}
with open(os.path.join(BASE, 'mall.export.json'), 'w') as f: json.dump(cfg, f, indent=1)
bpy.ops.wm.save_mainfile(); log('saved', bpy.data.filepath)
if 'preview' in OPT:
    cd = bpy.data.cameras.new('st_cam'); cam = bpy.data.objects.new('st_cam', cd); scene.collection.objects.link(cam); scene.camera = cam
    cd.sensor_fit = 'VERTICAL'; cd.angle_y = math.radians(50)
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 24
    try: scene.cycles.use_denoising = True
    except Exception: pass
    scene.render.resolution_x, scene.render.resolution_y = 480, 270
    views = PREVIEW_VIEWS
    big = np.ones((3 * 270, 2 * 480, 4), np.float32)
    for i, (p, t) in enumerate(views):
        cam.location = p; cam.rotation_euler = (Vector(t) - Vector(p)).to_track_quat('-Z', 'Y').to_euler()
        tmp = os.path.join(CACHE, '_st%d.png' % i); scene.render.filepath = tmp; bpy.ops.render.render(write_still=True)
        im = bpy.data.images.load(tmp); a = np.array(im.pixels[:], np.float32).reshape(270, 480, 4); bpy.data.images.remove(im); os.remove(tmp)
        r, c = divmod(i, 2); big[(2 - r) * 270:(3 - r) * 270, c * 480:(c + 1) * 480] = a
    im = bpy.data.images.new('st_grid', 960, 810); im.pixels.foreach_set(big.ravel()); im.filepath_raw = os.path.join(CACHE, 'mall_views.png'); im.file_format = 'PNG'; im.save()
    log('preview mall_views.png')
log('done')
