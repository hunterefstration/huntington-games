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
        a = np.array((0.10, 0.12, 0.14), np.float32) * (0.8 + 0.5 * n1[..., None]); a = a * (1 - 0.4 * n2[..., None]) + 0.25 * n2[..., None] * ASH * 0.4
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
add_pics({'panel': (2.4, panel_pic)})
EMIT['emissive_lamp'] = (0.80, 0.90, 1.0); EMIT['emissive_fire'] = (1.0, 0.10, 0.05); EMIT['emissive_sign'] = (0.25, 1.0, 0.4)
COLD = (0.75, 0.88, 1.0); RED = (1.0, 0.10, 0.05)
def P(cx, cy, rz, dx, dy): return (cx + dx * math.cos(rz) - dy * math.sin(rz), cy + dx * math.sin(rz) + dy * math.cos(rz))
def ground():
    quad(-XH - 0.5, -YH - 0.5, XH + 0.5, YH + 0.5, 'concrete')
def overlay(x0, y0, x1, y1, mat, z=0.002): return quad(x0, y0, x1, y1, mat, z)
def beam(p0, p1, th, mat):
    p0, p1 = Vector(p0), Vector(p1); d = p1 - p0; L = d.length
    if L < 1e-4: return
    q = d.normalized().to_track_quat('Y', 'Z'); before = set(bm.faces)
    bmesh.ops.create_cube(bm, size=1.0, matrix=T(*((p0 + p1) / 2)) @ q.to_matrix().to_4x4() @ Matrix.Diagonal((th, L, th, 1)))
    for f in [f for f in bm.faces if f not in before]: f.material_index = MI[mat]
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
def lamp(x, y, z, on=True, w=220, L=1.4, rz=0.0):
    box((x, y, z), (0.35, L, 0.08), 'metal', rz)
    if on: box((x, y, z - 0.03), (0.26, L - 0.1, 0.04), 'emissive_lamp', rz); LIGHTS.append((x, y, z - 0.25, w, COLD))
def alarm(x, y, z, nx, ny):
    box((x, y, z), (0.25 if nx == 0 else 0.15, 0.25 if ny == 0 else 0.15, 0.25), 'emissive_fire'); LIGHTS.append((x + nx * 0.5, y + ny * 0.5, z, 70, RED))
def exit_sign(x, y, z, rz=0.0):
    box((x, y, z), (0.6, 0.1, 0.22), 'emissive_sign', rz); LIGHTS.append((x, y, z - 0.3, 12, (0.3, 1.0, 0.45)))
def cell(x0, x1, side):
    """a glass-fronted containment cell between x0 and x1 against the hall's north (+1) or south (-1) wall"""
    yf, yb = 6.0 * side, 9.85 * side; ym = (yf + yb) / 2; cx = (x0 + x1) / 2
    box((cx, ym, 3.2), (x1 - x0 + 0.3, abs(yb - yf), 0.2), 'concrete')
    for a, b in ((x0 + 0.15, x0 + 1.75), (x1 - 1.75, x1 - 0.15)):
        if random.random() < 0.6: box(((a + b) / 2, yf, 0), (b - a, 0.08, 2.8), 'glass')
        else: box(((a + b) / 2, yf, 0), (b - a, 0.1, 0.25), 'metal'); heap(((a + b) / 2, yf - 0.8 * side, 0), 0.9, 0.6, 0.06, 'glass')
    box((cx, yf, 2.8), (x1 - x0, 0.2, 0.4), 'metal')
    if random.random() < 0.4: box((cx, yf, 0), (1.5, 0.08, 2.8), 'glass')                 # door still shut
    box((cx - 1.0, ym + 0.6 * side, 0), (2.0, 0.9, 0.55), 'metal', random.uniform(-0.3, 0.3))
    box((cx + 1.4, yb - 0.5 * side, 0), (0.6, 0.6, 1.2), 'metal')
    lamp(cx, ym, 3.15, on=random.random() < 0.4, w=60, L=0.8, rz=math.pi / 2)
def hall():
    for s in (-1, 1):
        wy(s * 10.0, -14.15, 14.15, HH, 'concrete', [(10.6, 13.4)] if s > 0 else [(-13.4, -10.6)], 0.3, 3.0)
        wx(s * 14.0, -10.0, 10.0, HH, 'concrete', [(-1.5, 1.5)], 0.3, 3.0)
    box((0, 0, HH + 0.01), (28.6, 20.6, 0.4), 'concrete')
    for side in (-1, 1):
        for i in range(4): cell(-10.0 + 5.0 * i, -5.0 + 5.0 * i, side)
        for i in range(5): box((-10.0 + 5.0 * i, side * 7.925, 0), (0.3, 3.85, 3.2), 'concrete')
    overlay(-13.85, -5.9, 13.85, 5.9, 'metal')
    box((-9.5, 0.0, 0), (1.0, 3.0, 1.05), 'metal'); box((-9.2, 0.0, 1.05), (0.3, 2.6, 0.5), 'metal', 0.0)
    box((9.0, -2.0, 0), (1.0, 2.4, 1.05), 'metal', 0.3)
    cyl((4.0, 2.5, 0), 1.1, 0.45, 'metal', 16); box((7.0, 3.6, 0), (3.2, 1.3, 1.25), 'glass', 0.45)      # the specimen tank, toppled off its plinth
    for k in range(6): heap((random.uniform(2.5, 8.5), random.uniform(1.0, 5.0), 0), random.uniform(0.4, 0.9), random.uniform(0.3, 0.6), 0.05, 'glass')
    for y in (-4.0, 4.0): box((0, y, 6.0), (27.0, 0.35, 0.5), 'rust')
    box((-3.0, 0, 5.7), (1.4, 8.4, 0.6), 'metal')
    for x, y in ((-6.0, 2.0), (-5.5, -2.5), (2.0, -3.0), (6.0, -1.0)): beam((x, y, HH), (x + random.uniform(-0.6, 0.6), y + random.uniform(-0.6, 0.6), random.uniform(2.6, 4.5)), 0.05, 'rust')
    for x in (-9.0, -3.0, 3.0, 9.0):
        for y in (-3.0, 3.0): lamp(x, y, HH - 0.4, on=random.random() < 0.5, w=650, L=2.0)
    for x, y, nx, ny in ((-13.8, 6.0, 1, 0), (13.8, -6.0, -1, 0), (0.0, 9.8, 0, -1)): alarm(x, y, 4.6, nx, ny)
def server_room():
    wy(-14.0, -18.0, 18.0, HL, 'panel', [(-12.0, -10.4), (10.4, 12.0)])
    for y in (-17.5, -20.5, -23.5, -26.5):
        for x0 in (-15.0, -7.0, 1.0, 9.0):
            box((x0 + 3.0, y, 0), (6.0, 0.9, 2.2), 'metal')
            for s in (-1, 1):
                for k in range(3):
                    if random.random() < 0.6: box((x0 + 0.8 + k * 2.1 + random.uniform(0, 0.8), y + s * 0.46, 1.2 + random.uniform(0, 0.8)), (0.25, 0.02, 0.04), 'emissive_lamp')
        box((0, y, 3.4), (32.0, 0.5, 0.08), 'rust')
    box((-6.0, -20.5, 0), (2.0, 1.2, 0.8), 'metal', 0.9)                                    # a rack pulled over into the aisle
    for x in (-17.0, 17.0): box((x, -22.0, 0), (1.0, 2.6, 2.1), 'metal')
    for x in (-12.0, -4.0, 4.0, 12.0):
        for y in (-19.0, -25.0): lamp(x, y, HL - 0.3, on=random.random() < 0.45, w=150)
    alarm(0.0, -29.8, 3.2, 0, 1)
def north_labs():
    wy(14.0, -18.0, 18.0, HL, 'panel', [(-13.0, -11.4), (-0.8, 0.8), (11.4, 13.0)])
    for x in (-6.0, 6.0): wx(x, 14.0, 30.0, HL, 'panel', [(25.6, 27.2)])
    for cx in (-12.0, 0.0, 12.0):
        for dx in (-2.6, 2.6):
            box((cx + dx, 21.5, 0), (1.3, 6.5, 0.95), 'metal'); box((cx + dx, 21.5, 0.95), (1.4, 6.6, 0.05), 'panel')
            for dy in (-3.0, 3.0): box((cx + dx, 21.5 + dy, 0.95), (0.08, 0.08, 0.8), 'metal')
            box((cx + dx, 21.5, 1.7), (0.4, 6.5, 0.05), 'metal')
            for k in range(3):
                if random.random() < 0.6: cyl((cx + dx + random.uniform(-0.4, 0.4), 19.5 + k * 2.0, 1.0), 0.06, 0.22, 'glass', 6)
        for k in range(3):
            hx = cx - 4.0 + k * 4.0; box((hx, 29.2, 0), (2.0, 1.0, 2.3), 'metal'); box((hx, 28.68, 0.95), (1.8, 0.04, 0.9), 'glass')
        for dy in (18.0, 25.0): lamp(cx, dy, HL - 0.3, on=random.random() < 0.55, w=200, rz=math.pi / 2)
    box((-1.0, 23.0, 0), (1.6, 0.8, 0.9), 'metal', 1.1)                                    # a knocked-over bench cabinet
def west_block():
    for y, gaps in ((6.0, [(-25.0, -23.4)]), (-6.0, [(-30.0, -28.4)]), (18.0, [(-34.0, -32.4)])): wy(y, -XH, -18.0, HL, 'panel', gaps)
    for k in range(5): box((-38.6, 8.5 + k * 1.9, 0), (2.0, 0.9, 0.7), 'metal'); beam((-37.4, 8.0 + k * 1.9, 2.2), (-37.4, 9.6 + k * 1.9, 2.2), 0.04, 'metal')
    box((-20.0, 12.0, 0), (0.7, 2.4, 2.0), 'metal'); box((-30.0, 12.0, 0), (2.0, 1.0, 0.95), 'metal', 0.2)
    for x in (-36.0, -28.0):                                                                  # specimen tanks, some smashed
        for y in (-3.5, 0.0, 3.5):
            cyl((x, y, 0), 0.7, 0.4, 'metal', 12)
            if random.random() < 0.6: cyl((x, y, 0.4), 0.6, 2.2, 'glass', 12); cyl((x, y, 2.6), 0.7, 0.25, 'metal', 12)
            else: heap((x + 0.8, y, 0), 0.8, 0.6, 0.06, 'glass')
    for y in (-26.0, -21.0, -16.0, -11.0): box((-31.0, y, 0), (14.0, 0.6, 2.0), 'metal')
    for x, y in ((-38.0, 24.0), (-24.0, 26.0)): box((x, y, 0), (2.4, 1.2, 0.76), 'wood')
    for (x, y) in ((-29.0, 12.0), (-29.0, 0.0), (-29.0, -18.0), (-29.0, 24.0)): lamp(x, y, HL - 0.3, on=random.random() < 0.55, w=220)
    alarm(-39.8, 0.0, 3.0, 1, 0)
def east_block():
    for s in (-1, 1): wy(s * 1.5, 18.0, XH, HL, 'panel', [(21.0, 22.6)] if s > 0 else [(33.0, 34.6)])
    for x in (24.0, 30.0, 36.0):                                                              # decontamination stages: narrowed frames, shower heads, hazard strips
        for s in (-1, 1): box((x, s * 1.12, 0), (0.4, 0.5, HL), 'metal')
        box((x, 0, 2.4), (0.4, 2.8, HL - 2.4), 'metal')
        for dx in (-1.2, 1.2): overlay(x + dx - 0.15, -1.3, x + dx + 0.15, 1.3, 'rust', 0.004)
        for dx in (-2.0, 2.0): cyl((x + dx, 0.0, HL - 0.25), 0.15, 0.25, 'metal', 8)
        lamp(x + 3.0, 0.0, HL - 0.3, on=x != 30.0, w=120, L=1.0, rz=math.pi / 2)
    box((XH - 0.25, 0.0, 0), (0.3, 2.8, 3.2), 'metal'); alarm(XH - 0.3, 0.0, 3.6, -1, 0)
    for k in range(3):                                                                        # control room: desks with dead screens
        y = 5.0 + k * 3.0; box((29.0, y, 0), (9.0, 0.9, 0.76), 'wood')
        for j in range(4): box((25.5 + j * 2.3, y + 0.25, 0.76), (0.6, 0.06, 0.4), 'emissive_lamp' if random.random() < 0.25 else 'glass')
    wy(14.0, 18.0, XH, HL, 'panel', [(24.0, 25.6), (34.0, 35.6)]); wx(29.0, 14.0, 30.0, HL, 'panel', [(20.0, 21.6)])
    for x, y in ((22.0, 24.0), (35.0, 26.0), (36.0, 18.0)): box((x, y, 0), (1.6, 0.8, 0.76), 'wood', 0.3)
    for x, y in ((25.0, -8.0), (25.0, -15.0), (33.0, -8.0), (33.0, -15.0)): box((x, y, 0), (3.0, 1.6, 2.0), 'metal', 0.0, 0.05)
    for x in (24.0, 34.0): cyl((x, -25.0, 0), 1.2, 2.6, 'rust', 14)
    box((29.0, -20.0, 3.5), (18.0, 0.3, 0.3), 'rust')
    for x, y in ((29.0, 8.0), (24.0, 22.0), (35.0, 22.0), (29.0, -11.0), (29.0, -24.0)): lamp(x, y, HL - 0.3, on=random.random() < 0.55, w=220)
    alarm(39.8, -12.0, 3.0, -1, 0)
def build():
    ground()
    for x in (-XH - 0.3, XH + 0.3): box((x, 0, 0), (0.6, 2 * YH + 1.2, HL + 0.4), 'concrete')
    for y in (-YH - 0.3, YH + 0.3): box((0, y, 0), (2 * XH + 1.2, 0.6, HL + 0.4), 'concrete')
    z = HL + 0.01; E = 0.6; hx, hy = 14.15, 10.15                                              # room ceiling round the hall (the hall has its own, higher)
    box((0, (-YH - E - hy) / 2, z), (2 * XH + 2 * E, YH + E - hy, 0.3), 'concrete'); box((0, (YH + E + hy) / 2, z), (2 * XH + 2 * E, YH + E - hy, 0.3), 'concrete')
    box(((-XH - E - hx) / 2, 0, z), (XH + E - hx, 2 * hy, 0.3), 'concrete'); box(((XH + E + hx) / 2, 0, z), (XH + E - hx, 2 * hy, 0.3), 'concrete')
    # the ring corridor's outer walls (the hall walls are its inner side)
    wx(-18.0, -YH, YH, HL, 'panel', [(-21.6, -20.0), (-11.0, -9.4), (-0.8, 0.8), (9.0, 10.6), (24.0, 25.6)])
    wx(18.0, -YH, YH, HL, 'panel', [(-22.0, -20.4), (-9.0, -7.4), (-1.4, 1.4), (9.0, 10.6)])
    hall(); server_room(); north_labs(); west_block(); east_block()
    for x in (-16.0, 16.0):
        for y in (-12.0, -4.0, 4.0, 12.0): lamp(x, y, HL - 0.3, on=random.random() < 0.5, w=160)
    for x in (-8.0, 0.0, 8.0):
        for y in (-12.0, 12.0): lamp(x, y, HL - 0.3, on=random.random() < 0.5, w=160, rz=math.pi / 2)
    for x, y, r in ((-16.0, 13.8, 0.0), (16.0, -13.8, 0.0), (17.8, 0.0, math.pi / 2)): exit_sign(x, y - 0.1 * (1 if y > 0 else -1), 2.7, r)
    for x, y in ((-16.5, 6.0), (16.5, -11.0), (-5.0, -12.6)): box((x, y, 0), (0.9, 0.9, 1.0), 'metal', 0.4)
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
    for i, (x, y, z, w, c) in enumerate(LIGHTS):
        ld = bpy.data.lights.new('lamp%d' % i, 'POINT'); ld.energy = w; ld.color = c; ld.shadow_soft_size = 0.3
        lo = bpy.data.objects.new('lamp%d' % i, ld); lc.objects.link(lo); lo.location = (x, y, z)
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
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=6, use_clear=True)
    a = np.array(img.pixels[:], np.float32).reshape(size, size, 4)
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get(); bvh = BVHTree.FromObject(ob, dg); uvd = me.uv_layers['Lightmap'].data; black = []
    for f in me.polygons:
        c = f.center; n = f.normal
        if n.z < -0.5 or bvh.ray_cast(c + n * 0.02, n, 1.0)[0] is not None: continue
        u = sum((uvd[li].uv for li in f.loop_indices), Vector((0, 0))) / f.loop_total
        px = a[min(size - 1, int(u.y * size)), min(size - 1, int(u.x * size)), :3]
        if float(px.sum()) < 0.01: black.append((MATS[f.material_index], tuple(round(x, 1) for x in c)))
    log('exposed faces baked black:', len(black), black[:6])
    rgb = a[:, :, :3]; blur = rgb.copy()
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)): blur += np.roll(np.roll(rgb, dy, 0), dx, 1)
    a[:, :, :3] = blur / 5.0; img.pixels.foreach_set(a.ravel())
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
me = bpy.data.meshes.new('lab'); bm.to_mesh(me); bm.free()
for m in mats: me.materials.append(m)
uv_world(me)
mc = bpy.data.collections.new('map'); scene.collection.children.link(mc)
ob = bpy.data.objects.new('lab', me); mc.objects.link(ob)
me.calc_loop_triangles(); log('lab', len(me.loop_triangles), 'triangles,', len(me.vertices), 'verts')
lu = me.uv_layers.new(name='Lightmap'); me.uv_layers.active = lu
smart_uv(ob, 66, 0.004)
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
