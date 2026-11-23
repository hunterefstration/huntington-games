# ASHFALL map "SUBLEVEL 3" in art/ashfall/lab.blend (made from make_yard.py: same pipeline, its own layout below).
#   blender -b art/ashfall/lab.blend -P tools/blender/make_lab.py -- [nobake] [preview]   (first time: --factory-startup)
# then node tools/export-art.mjs lab -> Ashfall/assets/lab.hgm
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
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = os.path.join(ROOT, 'art', 'ashfall'); TEXDIR = os.path.join(BASE, 'tex'); CACHE = os.path.join(BASE, '_cache'); PROOF = os.path.join(ROOT, 'art', 'proof', 'tex')
for d in (TEXDIR, CACHE): os.makedirs(d, exist_ok=True)
scene = bpy.context.scene
if not bpy.data.filepath.replace('\\', '/').endswith('art/ashfall/lab.blend'):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, 'lab.blend')); log('created', bpy.data.filepath)
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
    import ash_paint; ash_paint.repaint(PICS, save_image, dust, TEXDIR, 'street_', 'lab')      # painted metal and old steel, this map's colours (less rust)
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
XH, YH = 40.0, 30.0
MAPNAME = 'lab'
HL, HH = 4.2, 7.0                                   # ceiling of the rooms / of the containment hall
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
def panel_pic(N=1024):
    y, x = np.mgrid[0:N, 0:N].astype(np.float32); n1 = tile_noise(N, 80, 51); n2 = tile_noise(N, 8, 53)
    a = np.array((0.50, 0.53, 0.55), np.float32) * (0.9 + 0.12 * n1[..., None]) * (0.96 + 0.08 * n2[..., None])
    seam = ((x % 512) < 5) | ((y % 1024) < 5); a[seam] *= 0.45
    bolt = (((x % 512) - 24) ** 2 + ((y % 256) - 24) ** 2) < 30; a[bolt] *= 0.7
    st = np.clip((tile_noise(N, 220, 55) - 0.6) * 4, 0, 1)[..., None]; a = a * (1 - 0.3 * st) + np.array((0.30, 0.27, 0.22), np.float32) * 0.3 * st
    return dust(np.clip(a, 0.04, 1), 0.2, 101)
from mapkit import install; install(globals())
add_pics({'panel': (2.4, panel_pic), 'grime': (2.0, grime_pic), 'paint': (1.5, paint_pic)})
EMIT['emissive_lamp'] = (0.80, 0.90, 1.0); EMIT['emissive_fire'] = (1.0, 0.10, 0.05); EMIT['emissive_sign'] = (0.25, 1.0, 0.4)
COLD = (0.75, 0.88, 1.0); RED = (1.0, 0.12, 0.05)
FILL = (0.004, 0.005, 0.006)
AREAS = [(-13.8, 13.8, -9.8, 9.8, 6.85, 0.17, COLD), (-17.8, 17.8, 10.3, 13.9, 4.15, 0.16, COLD), (-17.8, 17.8, -13.9, -10.3, 4.15, 0.16, COLD),
         (-17.8, -14.3, -10.2, 10.2, 4.15, 0.16, COLD), (14.3, 17.8, -10.2, 10.2, 4.15, 0.16, COLD), (-17.8, 17.8, 14.2, 29.8, 4.15, 0.15, COLD),
         (-17.8, 17.8, -29.8, -14.2, 4.15, 0.15, COLD), (-39.8, -18.2, -29.8, 29.8, 4.15, 0.15, COLD), (18.2, 39.8, -29.8, 29.8, 4.15, 0.15, COLD)]     # x0 x1 y0 y1 z W/m2 colour
FLOORS = []
def ground(): pass
def wx(x, y0, y1, h, mat, gaps=(), th=0.25, dh=2.5):
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
def panel_light(x, y, z, on=True, w=160, sx=1.2, sy=1.2):
    """a square ceiling light (one kind for the whole level): on ones make a pool, dead ones are dark glass"""
    box((x, y, z - 0.1), (sx + 0.1, sy + 0.1, 0.1), 'metal'); box((x, y, z - 0.13), (sx, sy, 0.03), 'emissive_lamp' if on else 'glass')
    if on: LIGHTS.append((x, y, z - 0.2, w * 1.6, COLD, math.radians(150)))
def beacon(x, y, z, w=30):
    """a red alarm beacon on a bracket (the second kind of light)"""
    cyl((x, y, z), 0.12, 0.08, 'metal', 10); cyl((x, y, z - 0.18), 0.09, 0.18, 'emissive_fire', 10); LIGHTS.append((x, y, z - 0.45, w, RED))
def exit_sign(x, y, z, rz=0.0):
    box((x, y, z), (0.6, 0.1, 0.22), 'emissive_sign', rz)                       # glows, throws no light
def hazard(x0, y0, x1, y1, w=0.3):
    """yellow and dark diagonal-free hazard band: alternating paint and grime strips"""
    L = math.hypot(x1 - x0, y1 - y0); n = max(1, int(L / 0.6))
    for k in range(n): t0, t1 = k / n, (k + 1) / n; strip(x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0, x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1, w, 'paint' if k % 2 == 0 else 'grime')
def cell(x0, x1, side):
    """a glass-fronted containment cell between x0 and x1 against the hall's north (+1) or south (-1) wall"""
    yf, yb = 6.0 * side, 9.85 * side; ym = (yf + yb) / 2; cx = (x0 + x1) / 2
    box((cx, ym, 3.2), (x1 - x0, abs(yb - yf), 0.2), 'concrete')
    for a, b in ((x0 + 0.15, x0 + 1.4), (x1 - 1.4, x1 - 0.15)):
        if random.random() < 0.6: box(((a + b) / 2, yf, 0), (b - a, 0.22, 0.5), 'metal'); box(((a + b) / 2, yf, 0.5), (b - a - 0.04, 0.08, 2.3), 'glass')
        else: box(((a + b) / 2, yf, 0), (b - a, 0.22, 0.5), 'metal'); heap(((a + b) / 2, yf - 0.8 * side, 0), 0.9, 0.6, 0.06, 'glass')
    box((cx, yf, 2.8), (x1 - x0 - 0.3, 0.24, 0.4), 'metal')
    door_shut = random.random() < 0.35
    if door_shut: box((cx, yf, 0), (2.2, 0.22, 2.8), 'glass')                 # door still shut (a sealed cell)
    box((cx - 1.0, yb - 0.5 * side, 0), (1.9, 0.9, 0.5), 'metal', random.uniform(-0.04, 0.04)); box((cx + 1.4, yb - 0.45 * side, 0), (0.6, 0.6, 1.2), 'metal')
    hazard(x0 + 0.3, yf - 0.45 * side, x1 - 0.3, yf - 0.45 * side, 0.25)
    sign(cx, yb - 0.035 * side, 2.2, 0.8, 0.5, 0.0 if side > 0 else math.pi, 'paint')
def hall():
    for s in (-1, 1):
        wy(s * 10.0, -14.15, 14.15, HH, 'concrete', [(10.6, 13.4)] if s > 0 else [(-13.4, -10.6)], 0.3, 3.0)
        wx(s * 14.0, -9.85, 9.85, HH, 'concrete', [(-1.5, 1.5)], 0.3, 3.0)
    box((0, 0, HH + 0.01), (28.9, 20.9, 0.4), 'concrete')
    for side in (-1, 1):
        for i in range(4): cell(-10.0 + 5.0 * i, -5.0 + 5.0 * i, side)
        for i in range(5): box((-10.0 + 5.0 * i, side * 7.925, 0), (0.3, 3.85, 3.2), 'concrete')
    FLOORS.append((-13.85, -5.9, 13.85, 5.9, 'metal'))
    # the control island (cover you can see over), the toppled specimen tank, cryo canisters, a crate stack you cannot see over
    for x0, x1, y in ((-9.0, -5.0, -3.0), (-9.0, -5.0, 3.0)): box(((x0 + x1) / 2, y, 0), (x1 - x0, 0.8, 1.0), 'metal')
    box((-9.4, 0.0, 0), (0.8, 5.2, 1.0), 'metal')
    for y in (-3.0, 3.0):
        for k in range(3): box((-8.2 + k * 1.2, y + 0.1 * (1 if y < 0 else -1), 1.0), (0.7, 0.05, 0.42), 'emissive_lamp' if random.random() < 0.3 else 'glass', 0.0)
    cyl((3.6, 3.4, 0), 1.1, 0.45, 'metal', 16); B(7.0, 2.7, 0.45, 0, 0, 0, (3.2, 1.3, 1.25), 'glass')
    for k in range(5): heap((random.uniform(3.0, 8.5), random.uniform(0.5, 5.0), 0), random.uniform(0.4, 0.9), random.uniform(0.3, 0.6), 0.05, 'glass')
    blob(6.0, 2.0, 1.6, 'grime', 12, 0.4)
    for k in range(4): cyl((9.6 + (k % 2) * 0.7, -3.0 - (k // 2) * 0.7, 0), 0.3, 1.5, 'metal', 12); cyl((9.6 + (k % 2) * 0.7, -3.0 - (k // 2) * 0.7, 1.5), 0.2, 0.15, 'paint', 10)
    crate_stack(5.5, -3.6, 0.0, 2, 0.95, 'metal')
    cable([(-9.0, 2.6), (-6.0, 1.0), (-1.0, 1.5), (4.0, 0.8)]); cable([(-9.4, -2.5), (-4.0, -1.0), (2.0, -1.8), (9.5, -2.5)])
    for x, y in ((-12.5, 0.0), (12.5, 0.0)): drain(x, y, math.pi / 2)
    # overhead: the gantry walkway with rails, hanging cables, the crane rail
    for y in (-4.0, 4.0):
        box((0, y, 6.0), (27.4, 1.2, 0.12), 'metal')
        for s in (-1, 1): box((0, y + s * 0.58, 6.12), (27.4, 0.05, 0.05), 'rust'); box((0, y + s * 0.58, 6.92), (27.4, 0.06, 0.06), 'rust')
        for x in range(-12, 13, 3):
            for s in (-1, 1): box((x, y + s * 0.58, 6.12), (0.05, 0.05, 0.8), 'rust')
            box((x, y, 6.12 + 0.005), (0.05, 0.05, HH - 6.12 - 0.01), 'metal')
    box((-3.0, 0, 5.4), (1.4, 8.4, 0.5), 'rust'); tube((-3.0, 0.0, 3.6), (-3.0, 0.0, 5.4), 0.03, 'metal'); box((-3.0, 0.0, 3.3), (0.3, 0.3, 0.3), 'metal')
    for x, y in ((-6.0, 1.6), (-5.5, -2.5), (2.0, -3.4), (6.0, -1.0)): beam((x, y, 5.95), (x + random.uniform(-0.6, 0.6), y + random.uniform(-0.6, 0.6), random.uniform(2.6, 4.5)), 0.05, 'grime')
    panel_light(-1.0, 0.0, HH - 0.6, True, 110, 1.4, 1.4); panel_light(8.0, 0.0, HH - 0.6, False, 0, 1.4, 1.4); panel_light(-10.0, 0.0, HH - 0.6, True, 50, 1.4, 1.4)
    for x in (-12.0, -6.0, 6.0, 12.0): box((x, 0, HH - 0.7), (0.06, 0.06, 0.69), 'metal')
    beacon(-13.7, 6.0, 4.6); beacon(13.7, -6.0, 4.6)
def server_room():
    wy(-14.0, -18.0, 18.0, HL, 'panel', [(-12.2, -10.3), (10.3, 12.2)])
    FLOORS.append((-17.9, -29.9, 17.9, -14.1, 'panel'))
    for y in (-17.4, -20.4, -23.4, -26.4):
        for x0 in (-15.5, -7.25, 1.0, 9.25):
            if (x0, y) == (-7.25, -20.4): continue                                   # the gap the fallen rack left
            box((x0 + 2.75, y, 0), (5.5, 0.9, 2.2), 'metal')
            for s in (-1, 1):
                for k in range(4):
                    if random.random() < 0.55: box((x0 + 0.6 + k * 1.4, y + s * 0.47, 1.0 + 0.3 * (k % 3)), (0.25, 0.02, 0.04), 'emissive_sign' if random.random() < 0.7 else 'emissive_fire')
        cable_tray((-17.5, y), (17.5, y), 2.75, 0.45, 'metal', HL)
    B(-4.5, -20.4, 0.35, 0, 0, 0, (5.4, 0.9, 0.9), 'metal'); heap((-4.8, -19.3, 0), 1.2, 0.5, 0.05, 'glass')         # a rack pulled over
    for x in (-17.0, 17.0):
        box((x * 12.0 / 17.0, -29.3, 0), (2.4, 1.0, 2.1), 'plaster', 0.0, 0.03); box((x * 12.0 / 17.0, -28.78, 1.4), (1.6, 0.02, 0.5), 'grime')
    for x in (-8.0, 8.0): panel_light(x, -22.4, HL, True, 55 if x < 0 else 30)
    beacon(0.0, -30.0, 3.4)
    exit_sign(-11.25, -14.2, 2.7)
def north_labs():
    wy(14.0, -18.0, 18.0, HL, 'panel', [(-13.2, -11.3), (-0.95, 0.95), (11.3, 13.2)])
    for x in (-6.0, 6.0): wx(x, 14.125, 30.0, HL, 'panel', [(25.4, 27.3)])
    FLOORS.append((-17.9, 14.1, 17.9, 30.0, 'concrete'))
    for cx in (-12.0, 0.0, 12.0):
        for dx in (-2.6, 2.6):
            box((cx + dx, 21.5, 0), (1.3, 6.5, 0.92), 'metal'); box((cx + dx, 21.5, 0.92), (1.4, 6.6, 0.05), 'panel')
            for dy in (-3.0, 3.0): box((cx + dx, 21.5 + dy, 0.97), (0.08, 0.08, 0.75), 'metal')
            box((cx + dx, 21.5, 1.72), (0.4, 6.5, 0.05), 'metal')
            for k in range(3):
                if random.random() < 0.6: cyl((cx + dx + random.uniform(-0.4, 0.4), 19.5 + k * 2.0, 0.97), 0.06, 0.22, 'glass', 6)
                if random.random() < 0.5: box((cx + dx + 0.3, 20.0 + k * 2.0, 0.97), (0.35, 0.3, 0.38), 'plaster')        # microscopes, boxes
            for dy in (-2.0, 0.0, 2.0): cyl((cx + dx + (0.95 if dx > 0 else -0.95), 21.5 + dy, 0), 0.2, 0.6, 'metal', 8)          # stools
        for k in range(3):
            if k == 2: continue
            hx = cx - 2.0 + k * 4.0; box((hx, 29.48, 0), (2.4, 1.0, 2.3), 'metal'); box((hx, 28.96, 0.95), (2.2, 0.04, 0.9), 'glass')
        sign(cx + 3.0, 14.125 + 0.035, 1.4, 2.6, 1.1, math.pi, 'plaster', 'metal')                           # whiteboards
        box((cx - 5.3, 15.0, 0), (1.0, 0.9, 1.9), 'plaster')                                                    # a freezer
        panel_light(cx, 21.5, HL, True, 55 if cx != 12.0 else 25)
    box((0.0, 26.0, 0), (1.6, 0.8, 0.9), 'metal', 0.3)                                    # a knocked-over bench cabinet
    litter(-11.0, 17.0, 1.5, 8); blob(1.5, 18.0, 1.0, 'grime')
def west_block():
    for y, gaps in ((6.0, [(-25.2, -23.3)]), (-6.0, [(-30.2, -28.3)]), (18.0, [(-34.2, -32.3)])): wy(y, -40.0, -18.125, HL, 'panel', gaps)
    FLOORS.append((-40.0, -30.0, -18.1, 30.0, 'concrete'))
    # medical bay (6..18): beds with curtain rails, drip stands, a cabinet
    for k in range(3):
        y = 8.5 + k * 3.5; box((-38.4, y, 0), (2.0, 0.9, 0.62), 'plaster'); box((-38.4, y, 0.62), (1.9, 0.8, 0.12), 'paint')
        box((-37.0, y + 1.2, 2.3), (2.8, 0.04, 0.04), 'metal'); cyl((-36.6, y + 0.6, 0), 0.03, 1.8, 'metal', 6)
    box((-37.0, 12.0, 2.0), (2.6, 0.03, 0.3), 'plaster')                                    # a curtain torn down to its top
    box((-20.0, 12.0, 0), (0.7, 2.4, 2.0), 'metal'); box((-29.0, 12.0, 0), (2.0, 1.0, 0.95), 'metal', 0.2)
    sign(-18.165, 13.0, 1.5, 1.4, 0.9, -math.pi / 2, 'paint')
    panel_light(-28.0, 12.0, HL, True, 50)
    # specimen tanks (-6..6)
    for x in (-36.0, -28.0):
        for y in (-3.5, 0.0, 3.5):
            cyl((x, y, 0), 0.7, 0.4, 'metal', 12)
            if random.random() < 0.6: cyl((x, y, 0.4), 0.6, 2.2, 'glass', 12); cyl((x, y, 2.6), 0.7, 0.25, 'metal', 12); tube((x, y, 2.85), (x, y, HL - 0.005), 0.08, 'metal', 8)
            else: heap((x + 0.8, y, 0), 0.8, 0.6, 0.06, 'glass'); blob(x + 0.3, y - 0.6, 0.7, 'grime')
    pipe_run([(-38.5, -5.0, 3.6), (-24.0, -5.0, 3.6), (-24.0, 5.0, 3.6)], 0.1, 'rust')
    panel_light(-32.0, 0.0, HL, False, 0); beacon(-39.6, 0.0, 3.0)
    # stores (-30..-6): racking with boxes
    for y in (-26.0, -21.0, -16.0, -11.0):
        box((-31.0, y, 0), (14.0, 0.6, 0.1), 'metal')
        for z in (0.6, 1.2, 1.8):
            box((-31.0, y, z), (14.0, 0.6, 0.03), 'metal')
            for j in range(12):
                if random.random() < 0.6: box((-37.4 + j * 1.15, y, z + 0.03), (0.6, 0.5, 0.25 + 0.05 * (j % 3)), random.choice(('plaster', 'wood', 'paint')))
        for x in (-37.9, -31.0, -24.1): box((x, y, 0.1), (0.06, 0.6, 1.9), 'metal')
    panel_light(-31.0, -18.5, HL, True, 45)
    # offices (18..30)
    for x, y in ((-38.0, 24.0), (-24.0, 26.0)): box((x, y, 0), (2.4, 1.2, 0.76), 'wood'); chair_ = box((x, y - 1.0, 0), (0.5, 0.5, 0.45), 'metal')
    box((-31.0, 29.3, 0), (3.0, 0.6, 2.0), 'metal'); litter(-30.0, 23.0, 2.0, 9)
def east_block():
    for s in (-1, 1): wy(s * 1.5, 18.125, 40.0, HL, 'panel', [(20.8, 22.7)] if s > 0 else [(32.8, 34.7)])
    FLOORS.append((18.1, -30.0, 40.0, 30.0, 'concrete'))
    for x in (24.0, 30.0, 36.0):                                                              # decontamination stages: narrowed frames, shower heads, hazard strips
        for s in (-1, 1): box((x, s * 1.12, 0), (0.4, 0.5, HL), 'metal')
        box((x, 0, 2.4), (0.4, 1.74, HL - 2.4), 'metal')
        for dx in (-1.2, 1.2): hazard(x + dx, -1.3, x + dx, 1.3, 0.3)
        for dx in (-2.0, 2.0): cyl((x + dx, 0.0, HL - 0.25), 0.15, 0.245, 'metal', 8)
    panel_light(27.0, 0.0, HL, True, 35, 0.8, 0.8); beacon(39.6 - 0.1, 0.9, 3.4)
    box((XH - 0.35, 0.0, 0), (0.4, 2.6, 3.2), 'metal'); box((XH - 0.6, 0.0, 0), (0.1, 2.0, 0.6), 'paint')         # the shut blast door, a step plate
    for k in range(3):                                                                        # control room: desks with dead screens
        y = 5.0 + k * 3.0; box((29.0, y, 0), (9.0, 0.9, 0.76), 'wood')
        for j in range(4): box((25.5 + j * 2.3, y + 0.25, 0.76), (0.6, 0.06, 0.4), 'emissive_lamp' if random.random() < 0.25 else 'glass')
        for j in range(3): box((26.5 + j * 2.6, y - 0.8, 0), (0.5, 0.5, 0.45), 'metal', random.uniform(-0.5, 0.5))
    sign(39.66, 8.0, 1.4, 3.5, 1.6, -math.pi / 2, 'glass', 'metal')                    # the big wall display, still on
    wy(14.0, 18.125, 40.0, HL, 'panel', [(23.8, 25.7), (33.8, 35.7)]); wx(29.0, 14.125, 30.0, HL, 'panel', [(19.8, 21.7)])
    for x, y in ((22.0, 24.0), (35.0, 26.0), (36.0, 18.0)): box((x, y, 0), (1.6, 0.8, 0.76), 'wood', 0.3)
    panel_light(29.0, 8.0, HL, True, 55); panel_light(35.0, 22.0, HL, False, 0)
    # generator room (south): generators, fuel tanks, a pipe header
    for x, y in ((25.0, -8.0), (25.0, -15.0), (33.0, -8.0), (33.0, -15.0)):
        box((x, y, 0), (3.0, 1.6, 2.0), 'metal', 0.0, 0.05); box((x - 0.8, y, 2.0), (0.8, 0.6, 0.4), 'grime'); tube((x + 0.9, y, 2.0), (x + 0.9, y, HL - 0.005), 0.1, 'grime')
    for x in (24.0, 34.0): cyl((x, -25.0, 0), 1.2, 2.6, 'rust', 14); cyl((x, -25.0, 2.6), 1.25, 0.06, 'metal', 14)
    pipe_run([(23.0, -20.0, 3.5), (34.5, -20.0, 3.5), (34.5, -24.5, 3.5), (34.5, -24.5, 2.66)], 0.14, 'rust')
    for x, y in ((29.0, -11.5), (29.0, -21.0), (27.0, -26.0)): blob(x, y, random.uniform(0.6, 1.2), 'grime')
    panel_light(29.0, -11.5, HL, True, 55); beacon(39.6, -12.0, 3.0)
def corridor():
    # pipes and a cable tray along the corridor ceiling, signs, gurneys, a desk barricade, floor stripes
    for s in (-1, 1):
        pipe_run([(-16.9, s * 11.5, 3.75), (16.9, s * 11.5, 3.75)], 0.09, 'metal', 8, False)
        cable_tray((s * 16.4, -13.6), (s * 16.4, 13.6), 3.55, 0.4, 'metal', HL)
        strip(-16.5, s * 12.0, 16.5, s * 12.0, 0.1, 'paint'); strip(s * 16.0, -11.5, s * 16.0, 11.5, 0.1, 'paint')
    for x, y, r in ((-16.2, 6.0, 0.2), (15.8, -9.5, 1.4)): box((x, y, 0.5), (0.7, 1.9, 0.08), 'plaster', r); box((x, y, 0), (0.6, 1.7, 0.5), 'metal', r)
    for x in (-8.0, 7.5):
        B(x, -12.95, 0.1, 0, 0, 0, (1.6, 0.8, 0.76), 'wood'); B(x + 1.4, -13.25, -0.2, 0, 0, 0, (0.9, 0.6, 1.4), 'metal')
    box((-16.5, -6.0, 0), (0.9, 0.9, 1.0), 'metal', 0.4); box((16.5, 6.5, 0), (0.9, 0.9, 1.0), 'metal', 0.2)
    for x, y, r in ((-17.84, -4.0, math.pi / 2), (17.84, 4.0, -math.pi / 2), (-4.0, 13.84, 0.0), (4.0, -13.84, math.pi)): sign(x, y, 1.6, 1.2, 0.4, r, 'paint')
    for x, y in ((-16.0, 12.0), (16.0, -12.0), (16.0, 12.0), (-16.0, -12.0)): panel_light(x, y, HL, True, 55 if (x, y) in ((-16.0, 12.0), (16.0, -12.0)) else 38)
    for x, y in ((0.0, 12.0), (0.0, -12.0), (-16.0, 0.0), (16.0, 0.0)): panel_light(x, y, HL, x != 0.0, 32, 1.2, 0.8)
    for x, y, r in ((-16.0, 13.8, 0.0), (16.0, -13.8, 0.0), (17.8, 0.0, math.pi / 2)): exit_sign(x, y, 2.7, r)
    for x, y in ((-10.0, 12.6), (9.0, -12.8), (-16.4, -2.0)): blob(x, y, random.uniform(0.5, 1.0), 'grime')
    litter(10.0, 12.0, 1.5, 6)
def build():
    for x in (-XH - 0.3, XH + 0.3): box((x, 0, 0), (0.6, 2 * YH + 1.2, HL), 'concrete')
    for y in (-YH - 0.3, YH + 0.3): box((0, y, 0), (2 * XH, 0.6, HL), 'concrete')
    z = HL + 0.01; E = 0.75; hx, hy = 14.15, 10.15                                              # room ceiling round the hall (the hall has its own, higher)
    box((0, (-YH - E - hy) / 2, z), (2 * XH + 2 * E, YH + E - hy, 0.3), 'concrete'); box((0, (YH + E + hy) / 2, z), (2 * XH + 2 * E, YH + E - hy, 0.3), 'concrete')
    box(((-XH - E - hx) / 2, 0, z), (XH + E - hx, 2 * hy, 0.3), 'concrete'); box(((XH + E + hx) / 2, 0, z), (XH + E - hx, 2 * hy, 0.3), 'concrete')
    # the ring corridor's outer walls (the hall walls are its inner side)
    wx(-18.0, -YH, YH, HL, 'panel', [(-21.8, -19.9), (-11.1, -9.2), (-0.95, 0.95), (8.9, 10.8), (23.9, 25.8)])
    wx(18.0, -YH, YH, HL, 'panel', [(-22.1, -20.2), (-9.1, -7.2), (-1.4, 1.4), (8.9, 10.8)])
    FLOORS.append((-18.0, -14.0, 18.0, 14.0, 'concrete'))
    hall(); server_room(); north_labs(); west_block(); east_block(); corridor()
    floor(FLOORS, 'concrete', -XH - 0.5, -YH - 0.5, XH + 0.5, YH + 0.5)
    log('map', len(bm.faces), 'faces')
def post_lights():
    so = bpy.data.objects.get('Sun')
    if so: so.hide_render = True
    bg = next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND'); bg.inputs['Strength'].default_value = 0.03
PREVIEW_VIEWS = [((-12, 0, 1.6), (12, 0, 2.0)), ((0, -4, 1.6), (-5, 8, 1.5)), ((-16, -12, 1.6), (-16, 12, 1.6)), ((-16, -22, 1.6), (16, -22, 1.4)),
                 ((18.5, 0, 1.6), (40, 0, 1.6)), ((0, 16, 1.6), (0, 28, 1.4))]

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
    w = bpy.data.worlds.get('lab_sky') or bpy.data.worlds.new('lab_sky'); scene.world = w; w.use_nodes = True; nt = w.node_tree
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
    img = bpy.data.images.new('lab_light', size, size, alpha=False, float_buffer=True)
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
    path = os.path.join(TEXDIR, 'lab_light.exr'); img.filepath_raw = path; img.file_format = 'OPEN_EXR'; img.save()
    for m in me.materials:
        n = m.node_tree.nodes.get('hg_bake')
        if n: m.node_tree.nodes.remove(n)
    me.uv_layers.active = me.uv_layers['UVMap']
    lum = (rgb @ np.array((0.3, 0.59, 0.11), np.float32)); nz = lum[lum > 0]
    log('baked', path, 'light median %.2f, 90%% %.2f' % (float(np.median(nz)), float(np.percentile(nz, 90))))
    bpy.data.images.remove(img)

# ---------------------------------------------------------------- run
make_pictures(); mats = materials(); build()
for v in bm.verts: v.co.z = max(v.co.z, 0.0)          # nothing below the ground: the exporter measures heights from the lowest point
_gv = {v for f in GROUND_FACES for v in f.verts}
for v in bm.verts:                                     # whatever stands on the ground starts 6 mm above it: a bottom face coplanar with the
    if v not in _gv and v.co.z < 0.006: v.co.z = 0.006  # ground lets the exporter's down-rays miss it and read the object as a thin sheet
from coplanar import report as coplanar_report
COP = coplanar_report(bm, MATS, log)
if 'coponly' in OPT: raise SystemExit(0)
me = bpy.data.meshes.new('lab'); bm.to_mesh(me); bm.free()
for m in mats: me.materials.append(m)
uv_world(me)
mc = bpy.data.collections.new('map'); scene.collection.children.link(mc)
ob = bpy.data.objects.new('lab', me); mc.objects.link(ob)
me.calc_loop_triangles(); log('lab', len(me.loop_triangles), 'triangles,', len(me.vertices), 'verts')
lu = me.uv_layers.new(name='Lightmap'); me.uv_layers.active = lu
from mapkit import lightmap_uv; lightmap_uv(ob, log)
uvd = me.uv_layers['Lightmap']; me.uv_layers.active = me.uv_layers['UVMap']
lights(); post_lights()
def reach_check(ob):
    """walkable cells on a 0.5 m grid (nothing solid between 0.45 m and head height, not inside a solid), flood filled from mid-street"""
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get(); bvh = BVHTree.FromObject(ob, dg)
    xs = np.arange(-40.0, 40.0 + 0.01, 0.5); ys = np.arange(-30.0, 30.0 + 0.01, 0.5); walk = np.zeros((len(xs), len(ys)), bool)
    for i, x in enumerate(xs):
        for j, y in enumerate(ys):
            ok = True
            for dx, dy in ((0, 0), (0.2, 0.2), (-0.2, 0.2), (0.2, -0.2), (-0.2, -0.2)):
                h = bvh.ray_cast(Vector((x + dx, y + dy, 2.15)), Vector((0, 0, -1)), 3.0)
                if h[0] is None or h[0].z > 0.45 or h[1].z < 0: ok = False; break
            walk[i, j] = ok
    seen = np.zeros_like(walk); st = [(int((0 + 40.0) / 0.5), int((0 + 30.0) / 0.5))]
    while st:
        i, j = st.pop()
        if i < 0 or j < 0 or i >= len(xs) or j >= len(ys) or seen[i, j] or not walk[i, j]: continue
        seen[i, j] = True; st += [(i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)]
    lost = walk & ~seen; pts = [(float(xs[i]), float(ys[j])) for i, j in zip(*np.nonzero(lost))]
    log('reach: %d walkable cells, %d reached, %d cut off' % (walk.sum(), seen.sum(), lost.sum()), pts[:8])
reach_check(ob)
if 'nobake' not in OPT: bake(ob, 2048, int(OPT.get('samples', 40)))
cfg = {'blend': 'lab.blend', 'out': '../../Ashfall/assets/lab', 'world': {'collections': ['map'], 'lightmap': 'tex/lab_light.exr', 'lmSize': 2048},
       'grid': {'cell': 0.25}, 'probes': {'cell': 1.0, 'height': 1.0, 'samples': 96}, 'sky': {'width': 1024}, 'maxTexture': 1024}
with open(os.path.join(BASE, 'lab.export.json'), 'w') as f: json.dump(cfg, f, indent=1)
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
    im = bpy.data.images.new('st_grid', 960, 810); im.pixels.foreach_set(big.ravel()); im.filepath_raw = os.path.join(CACHE, 'lab_views.png'); im.file_format = 'PNG'; im.save()
    log('preview lab_views.png')
log('done')
