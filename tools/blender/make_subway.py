# ASHFALL map "THE UNDERGROUND" in art/ashfall/subway.blend (made from make_yard.py: same pipeline, its own layout below).
#   blender -b art/ashfall/subway.blend -P tools/blender/make_subway.py -- [nobake] [preview]   (first time: --factory-startup)
# then node tools/export-art.mjs subway -> Ashfall/assets/subway.hgm
import bpy, bmesh, math, os, sys, json, random
import numpy as np
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hgkit import log, vnoise, fbm, save_image, smart_uv, T, Rz, Rx, Ry, grit, gravel_px, separate_coplanar, collapse_thin_lightmap, lightmap_weight, relight_black_faces, coplanar_pairs
def Rx(a): return Matrix.Rotation(a, 4, 'X')        # radians here (hgkit's take degrees)
def Ry(a): return Matrix.Rotation(a, 4, 'Y')
def Rz(a): return Matrix.Rotation(a, 4, 'Z')

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OPT = dict((a.split('=', 1) + ['1'])[:2] for a in ARGV)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = os.path.join(ROOT, 'art', 'ashfall'); TEXDIR = os.path.join(BASE, 'tex'); CACHE = os.path.join(BASE, '_cache'); PROOF = os.path.join(ROOT, 'art', 'proof', 'tex')
for d in (TEXDIR, CACHE): os.makedirs(d, exist_ok=True)
scene = bpy.context.scene
if not bpy.data.filepath.replace('\\', '/').endswith('art/ashfall/subway.blend'):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, 'subway.blend')); log('created', bpy.data.filepath)
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
EMIT = {'emissive_sign': (1.0, 0.45, 0.12), 'emissive_lamp': (0.80, 0.92, 1.0), 'emissive_fire': (1.0, 0.12, 0.06), 'emissive_window': (1.0, 0.86, 0.62)}
ESTR = {'emissive_sign': 3.0, 'emissive_lamp': 4.0, 'emissive_fire': 5.0, 'emissive_window': 2.2}      # emission strength in the bake
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
            bsdf.inputs['Emission Strength'].default_value = ESTR.get(k, 6.0)
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

LIGHTS = []                                         # ('P', x, y, z, W, rgb) point, ('A', x, y, z, W, rgb, sx, sy) area facing down, ('S', x, y, z, W, rgb, cone deg, aim)
XH, YH = 45.0, 25.0
H = 5.2
COOL = (0.80, 0.92, 1.0); WARM = (1.0, 0.86, 0.62); RED = (1.0, 0.10, 0.06); DAY = (0.62, 0.72, 1.0)
GBASE = []
def ground():
    GBASE.append(quad(-XH - 0.5, -YH - 0.5, XH + 3.5, YH + 0.5, 'concrete')); quad(-XH - 3.5, -YH - 0.5, -XH - 0.5, YH + 0.5, 'concrete')
def overlay(x0, y0, x1, y1, mat, z=0.02): return quad(x0, y0, x1, y1, mat, z)
def beam(p0, p1, th, mat):
    p0, p1 = Vector(p0), Vector(p1); d = p1 - p0; L = d.length
    if L < 1e-4: return
    q = d.normalized().to_track_quat('Y', 'Z'); before = set(bm.faces)
    bmesh.ops.create_cube(bm, size=1.0, matrix=T(*((p0 + p1) / 2)) @ q.to_matrix().to_4x4() @ Matrix.Diagonal((th, L, th, 1)))
    for f in [f for f in bm.faces if f not in before]: f.material_index = MI[mat]
def slab(c, s, mat, rz=0.0, rx=0.0):
    """a box tilted about its own x axis (fallen ceiling panels, a leaning door)"""
    before = set(bm.faces)
    bmesh.ops.create_cube(bm, size=1.0, matrix=T(*c) @ Rz(rz) @ Rx(rx) @ Matrix.Diagonal((s[0], s[1], s[2], 1)))
    for f in [f for f in bm.faces if f not in before]: f.material_index = MI[mat]
def wx(x, y0, y1, h, mat, gaps=(), th=0.3, dh=2.6):
    ys = [y0] + [g for ab in sorted(gaps) for g in ab] + [y1]
    for i in range(0, len(ys), 2):
        a, b = ys[i], ys[i + 1]
        if b - a > 0.01: box((x, (a + b) / 2, 0), (th, b - a, h), mat)
    for a, b in gaps:
        if h > dh: box((x, (a + b) / 2, dh), (th, b - a, h - dh), mat)
def wy(y, x0, x1, h, mat, gaps=(), th=0.3, dh=2.6):
    xs = [x0] + [g for ab in sorted(gaps) for g in ab] + [x1]
    for i in range(0, len(xs), 2):
        a, b = xs[i], xs[i + 1]
        if b - a > 0.01: box(((a + b) / 2, y, 0), (b - a, th, h), mat)
    for a, b in gaps:
        if h > dh: box(((a + b) / 2, y, dh), (b - a, th, h - dh), mat)
def strip(x0, x1, y, z, on):
    """a long fluorescent fitting; a lit one is an area light the length of the tube"""
    box(((x0 + x1) / 2, y, z), (x1 - x0, 0.32, 0.1), 'metal')
    if on: box(((x0 + x1) / 2, y, z - 0.035), (x1 - x0 - 0.2, 0.22, 0.04), 'emissive_lamp'); LIGHTS.append(('A', (x0 + x1) / 2, y, z - 0.12, 26.0 * (x1 - x0), COOL, x1 - x0 - 0.2, 0.25))
    else: box(((x0 + x1) / 2, y, z - 0.035), (x1 - x0 - 0.2, 0.22, 0.04), 'glass')
    for x in (x0 + 0.4, x1 - 0.4): beam((x, y, z + 0.05), (x, y, H), 0.03, 'metal')
def red_lamp(x, y, z, nx=0.0, ny=0.0):
    box((x, y, z), (0.22 if nx == 0 else 0.12, 0.22 if ny == 0 else 0.12, 0.16), 'emissive_fire'); LIGHTS.append(('P', x + nx * 0.4, y + ny * 0.4, z - 0.1, 45, RED))
def work_lamp(x, y, aim, w=500):
    """a floodlight on a tripod, aimed at what is being worked on"""
    for a in (0, 2.1, 4.2): beam((x + 0.55 * math.cos(a), y + 0.55 * math.sin(a), 0.0), (x, y, 1.9), 0.05, 'metal')
    cyl((x, y, 1.85), 0.04, 0.5, 'metal', 6); d = (Vector(aim) - Vector((x, y, 2.4))).normalized()
    box((x, y, 2.3), (0.45, 0.3, 0.32), 'metal'); box((x + d.x * 0.16, y + d.y * 0.16, 2.33), (0.36, 0.06, 0.26), 'emissive_window', math.atan2(d.y, d.x) + math.pi / 2)
    LIGHTS.append(('S', x + d.x * 0.3, y + d.y * 0.3, 2.45, w, (1.0, 0.92, 0.78), 80, tuple(aim)))
    beam((x, y, 0.02), (x + 2.5, y - 1.0, 0.02), 0.04, 'rust')                    # its cable along the floor
def train_car(x0, x1, y=0.0, lit=True):
    """a stalled metro car: walk in through any of the three open doors a side (2 m clear), out the other side; lit cars spill their light"""
    L = x1 - x0; n = 3; Hc = 3.4; doors = [x0 + L * (k + 0.5) / n for k in range(n)]
    for sy in (-1, 1):
        xs = [x0] + [d + e for d in doors for e in (-1.0, 1.0)] + [x1]
        for i in range(0, len(xs), 2):
            a, b = xs[i], xs[i + 1]; box(((a + b) / 2, y + sy * 1.42, 0), (b - a, 0.2, Hc), 'metal')       # 0.2 m: thinner walls slip between the collision samples
            for wv in range(int((b - a) // 1.6)):
                wxc = a + 0.8 + wv * 1.6
                if wxc + 0.55 > b - 0.1: continue
                box((wxc, y + sy * 1.535, 1.15), (1.1, 0.04, 0.9), 'emissive_window' if lit and random.random() < 0.85 else 'glass')
        for d in doors: box((d, y + sy * 1.42, 2.25), (2.0, 0.2, Hc - 2.26), 'metal'); box((d + 1.45 * sy, y + sy * 1.28, 0), (0.8, 0.04, 2.1), 'metal')
    for x in (x0, x1): box((x, y, 0), (0.2, 3.04, Hc), 'metal')
    box(((x0 + x1) / 2, y, Hc + 0.01), (L + 0.1, 3.1, 0.2), 'metal', 0.0, 0.05)      # the roof 1 cm above the walls
    for k in range(int(L // 4)):
        xx = x0 + 2 + k * 4
        if any(abs(xx - d) < 1.4 for d in doors): continue
        for sy in (-1, 1): box((xx, y + sy * 1.15, 0), (1.6, 0.45, 0.5), 'plaster')
    for k in range(int(L // 2)): beam((x0 + 1 + k * 2, y - 0.9, 2.35), (x0 + 1 + k * 2, y + 0.9, 2.35), 0.03, 'metal')       # grab rails overhead (above 1.85 m: not solid to the game)
    if lit:
        box(((x0 + x1) / 2, y, Hc - 0.06), (L - 1.0, 0.25, 0.04), 'emissive_window'); LIGHTS.append(('A', (x0 + x1) / 2, y, Hc - 0.2, 140, WARM, L - 1.0, 1.2))
def vending(x, y, face):
    box((x, y, 0), (1.0, 0.8, 1.9), 'metal'); box((x, y + face * 0.41, 0.9), (0.7, 0.02, 0.8), 'glass'); box((x, y + face * 0.41, 1.75), (0.8, 0.02, 0.1), 'emissive_sign' if random.random() < 0.4 else 'plaster')
def bench(x, y, face):
    box((x, y, 0), (2.2, 0.55, 0.5), 'wood'); box((x, y - face * 0.24, 0.5), (2.2, 0.08, 0.45), 'wood')
def sandbags(x, y, L, rz=0.0, h=0.9):
    box((x, y, 0), (L, 0.8, h - 0.25), 'sandbag', rz); box((x, y, h - 0.25), (L - 0.3, 0.6, 0.25), 'sandbag', rz)
def poster(x, y, face):
    box((x, y, 1.2), (2.0, 0.04, 1.4), 'metal'); box((x, y + face * 0.025, 1.25), (1.85, 0.02, 1.3), random.choice(('plaster', 'sandbag', 'wood')))
def sign_board(x, y):
    box((x, y, 3.3), (3.2, 0.12, 0.6), 'plaster'); box((x, y, 3.92), (3.3, 0.16, 0.06), 'metal')
    for dx in (-1.4, 1.4): beam((x + dx, y, 3.95), (x + dx, y, H), 0.03, 'metal')
def trays(y, x0, x1, z=4.3):
    box(((x0 + x1) / 2, y, z), (x1 - x0, 0.45, 0.06), 'metal'); box(((x0 + x1) / 2, y, z + 0.35), (x1 - x0, 0.22, 0.22), 'rust')
    for x in range(int(x0) + 2, int(x1), 4): beam((x, y, z), (x, y, H), 0.04, 'metal')
def puddle(x, y, rx, ry):
    quad(x - rx, y - ry, x + rx, y + ry, 'glass', 0.015)
def build():
    random.seed(7); ground()
    # the box: walls, a ceiling 1 cm above them, the track's tunnel mouths through both end walls
    for x in (-XH - 0.3, XH + 0.3):
        for y0, y1 in ((-YH - 0.6, -2.6), (2.6, YH + 0.6)): box((x, (y0 + y1) / 2, 0), (0.6, y1 - y0, H + 0.4), 'brick')
        box((x, 0, 4.2), (0.6, 5.2, H + 0.4 - 4.2), 'brick')
        s = 1 if x > 0 else -1; xe = x + s * 3.0
        for yy in (-2.65, 2.65): box(((x + xe) / 2, yy, 0), (3.0, 0.3, 4.2), 'concrete')
        box(((x + xe) / 2, 0, 4.2), (3.0, 5.6, 0.3), 'concrete'); box((xe + s * 0.15, 0, 0), (0.3, 5.6, 4.2), 'brick')
        box((x + s * 1.6, 0, 0), (0.6, 4.4, 0.9), 'rust'); heap((x + s * 2.4, 0.8, 0), 1.6, 1.4, 0.8, 'concrete')    # buffer stop, the fallen tunnel beyond
        box((x - s * 0.33, 2.25, 2.9), (0.06, 0.3, 0.3), 'metal'); red_lamp(x - s * 0.37, 2.25, 2.95, -s, 0.0)       # signal head at the mouth
    for y in (-YH - 0.3, YH + 0.3): box((0, y, 0), (2 * XH + 1.2, 0.6, H + 0.4), 'brick')
    box((0, 0, H + 0.01), (2 * XH + 1.2, 2 * YH + 1.2, 0.4), 'concrete')
    for x in range(-42, 43, 6): box((x, 0, H - 0.5), (0.4, 2 * YH - 0.2, 0.49), 'rust')
    # track bed boarded flush with the platforms, the rails let in
    overlay(-XH, -2.0, XH, 2.0, 'wood')
    for s in (-0.72, 0.72): overlay(-XH, s - 0.04, XH, s + 0.04, 'metal', 0.035)
    train_car(-40.0, -24.0, lit=True); train_car(-22.0, -6.0, lit=False); train_car(5.0, 21.0, lit=True)
    box((-23.0, 0, 0.6), (2.0, 0.5, 0.35), 'rust')                               # the coupling between the first two cars
    # the gap in the middle: a maintenance trolley on the rails, cable drums, tool chests, a work lamp: the station's landmark
    box((-4.0, 0.0, 0), (3.2, 2.0, 0.85), 'rust'); box((-4.8, 0.0, 0.85), (1.0, 1.6, 0.6), 'metal'); box((-3.1, 0.4, 0.85), (0.9, 0.7, 0.45), 'metal')     # the middle stays open
    cyl((3.0, 1.0, 0), 0.65, 0.9, 'wood', 12); cyl((3.6, -1.1, 0), 0.5, 0.75, 'wood', 12)
    work_lamp(-1.8, -3.4, (-4.0, 0.0, 0.5), 520)
    # platforms: pillars, benches, vending machines on the walls, hanging name boards, posters, cable trays, yellow edges
    for x in range(-39, 40, 7):
        if abs(x) < 4: continue
        for y in (-8.0, 8.0): box((x, y, 0), (0.8, 0.8, H), 'concrete')
    for y in (-2.2, 2.2): overlay(-XH, y - 0.15, XH, y + 0.15, 'sandbag')
    for x in (-35.5, -21.5, 13.5, 27.5):
        for y in (-8.0, 8.0): bench(x, y + (0.7 if y > 0 else -0.7), 1 if y > 0 else -1)
    for x, y in ((-30.0, 12.45), (-29.0, 12.45), (6.0, 12.45), (33.0, -12.45), (-8.0, -12.45), (-7.0, -12.45)): vending(x, y, -1 if y > 0 else 1)
    for x in (-24.5, -3.5, 17.5, 38.5):
        for y in (-8.0, 8.0): sign_board(x, y)
    for x in (-38.0, -16.0, 1.0, 22.0, 36.0):
        for y in (-12.82, 12.82): poster(x, y, -1 if y > 0 else 1)
    for y in (-12.5, 12.5): trays(y, -XH + 0.5, XH - 0.5)
    # set pieces: a sandbagged firing point (north), the collapsed ceiling (south-east), a mail-cart barricade (south-west)
    sandbags(-15.0, 5.2, 4.0); sandbags(-12.4, 6.6, 3.0, 1.2); sandbags(-17.6, 6.6, 3.0, -1.2)
    box((-15.0, 10.5, 0), (1.2, 1.0, 1.1), 'wood', 0.3); box((-14.0, 11.2, 0), (1.0, 1.0, 1.6), 'wood')
    heap((33.5, -6.0, 0), 3.2, 2.4, 1.3, 'concrete'); slab((31.0, -5.0, 1.1), (4.0, 2.6, 0.25), 'concrete', 0.3, 0.45); slab((35.5, -8.5, 0.9), (3.0, 2.0, 0.22), 'concrete', -0.6, -0.5)
    beam((29.0, -9.0, 0.2), (36.0, -3.4, 2.6), 0.3, 'rust')
    for k in range(5): beam((31.0 + k, -6.0 + k * 0.4, H), (31.2 + k, -6.2 + k * 0.4, 2.6 + random.uniform(0, 1.2)), 0.025, 'metal')       # cables hanging out of the hole
    for x, y, r in ((-25.0, -5.0, 0.2), (-22.5, -5.6, -0.3), (-24.0, -10.5, 1.4)): box((x, y, 0), (1.8, 0.9, 0.95), 'metal', r)
    for x, y in ((-26.0, -4.2), (9.0, 4.5), (24.0, 10.5), (-37.0, -10.0)): heap((x, y, 0), 0.9, 0.6, 0.3, 'dirt')
    for x in range(-40, 41, 10):
        for y in (-11.2, 11.2): quad(x - 0.3, y - 0.3, x + 0.3, y + 0.3, 'metal', 0.015)          # drains
    # walls on to the corridor and the ticket hall, doors 2.4 m clear (the corridor loops round the whole station)
    wy(-13.0, -XH, XH, H, 'plaster', [(-36.2, -33.8), (-12.2, -9.8), (9.8, 12.2), (33.8, 36.2)])
    wy(13.0, -XH, XH, H, 'brick', [(-30.2, -27.8), (-6.0, 6.0), (27.8, 30.2)])
    for x in (-42.0, 42.0): wx(x, -13.0, 13.0, H, 'brick', [(-11.4, -9.0), (-2.75, 2.75), (9.0, 11.4)])
    # maintenance corridor (south), split by an inner wall: pipes, trays, cabinets, a generator under a work lamp, red emergency light
    wy(-19.0, -40.0, 40.0, H, 'brick', [(-31.2, -28.8), (-6.2, -3.8), (17.8, 20.2)])
    for y in (-24.4, -13.6): box((0, y, 3.8), (2 * XH - 2, 0.25, 0.25), 'rust'); box((0, y, 4.2), (2 * XH - 2, 0.18, 0.18), 'metal')
    for x in (-37.0, -33.5, -12.0, 4.0, 24.0, 31.0): box((x, -24.45, 0), (1.2, 0.6, 2.0), 'metal'); box((x, -24.12, 1.3), (0.2, 0.06, 0.12), 'emissive_sign' if random.random() < 0.3 else 'plaster')
    box((-15.0, -16.0, 0), (2.4, 1.3, 1.4), 'metal', 0.0, 0.04); box((-15.0, -16.0, 1.4), (0.3, 0.3, 1.2), 'rust'); work_lamp(-11.8, -17.6, (-15.0, -16.0, 1.0), 420)
    for x, y, w, d, h in ((-38.0, -22.0, 1.2, 2.4, 1.6), (8.0, -22.5, 1.6, 1.0, 1.8), (30.0, -16.0, 1.0, 1.0, 1.0), (14.0, -16.2, 2.0, 0.8, 0.9), (-26.0, -22.8, 1.0, 1.0, 1.0)):
        box((x, y, 0), (w, d, h), random.choice(('metal', 'wood')), 0.0, 0.04)
    cyl((22.5, -22.5, 0), 0.6, 0.9, 'wood', 12); cyl((-2.0, -16.0, 0), 0.45, 0.8, 'rust', 10)
    for x in (-40.0, -20.0, 0.0, 20.0, 40.0): red_lamp(x, -24.92, 3.0, 0, 1)
    for x in (-30.0, -5.0, 19.0): red_lamp(x, -13.21, 2.9, 0, -1)
    for x in (-42.0, 42.0): wx(x, -YH, -13.0, H, 'brick', [(-22.0, -19.6), (-17.6, -15.2)])
    # ticket hall (north): the barrier line, two booths, the closed stair up to the street with daylight down it, machines, a barricade
    for x0 in range(-20, 21, 4):
        if x0 in (-4, 0, 4): continue
        box((x0, 18.0, 0), (0.5, 1.4, 1.05), 'metal', 0.0, 0.03); box((x0 + 1.2, 18.0, 0.95), (1.9, 0.08, 0.08), 'metal')
    for x in (-24.0, 24.0):
        wx(x - 2.2, 15.0, 21.0, 2.8, 'plaster', [(17.1, 18.9)], 0.22, 2.4); wx(x + 2.2, 15.0, 21.0, 2.8, 'plaster', [], 0.22)
        wy(15.0, x - 2.2, x + 2.2, 2.8, 'plaster', [], 0.22); wy(21.0, x - 2.2, x + 2.2, 2.8, 'plaster', [], 0.22)
        box((x, 18.0, 2.81), (4.6, 6.2, 0.15), 'metal'); box((x + 2.25, 19.6, 1.0), (0.04, 1.8, 1.0), 'glass'); box((x + 1.0, 16.0, 0), (1.6, 0.6, 1.0), 'wood'); box((x, 18.0, 2.74), (0.3, 0.3, 0.06), 'emissive_window'); LIGHTS.append(('P', x, 18.0, 2.4, 30, (1.0, 0.7, 0.42)))      # a warm lamp left on in each booth
    box((0.0, 23.6, 0), (10.4, 2.8, 3.0), 'concrete')
    for k in range(6): box((0.0, 22.25 + k * 0.2, 0.5 * k), (10.0, 0.4, 0.5), 'concrete')
    LIGHTS.append(('A', 0.0, 21.6, 4.7, 55, DAY, 9.0, 2.0)); box((0.0, 24.9, 3.3), (9.6, 0.2, 1.6), 'emissive_window')           # daylight down the stair
    for x in (-36.0, -33.6, 33.6, 36.0): box((x, 24.6, 0), (1.4, 0.7, 1.9), 'metal')
    box((-12.0, 24.85, 1.0), (3.0, 0.08, 2.0), 'plaster'); box((12.0, 24.85, 1.0), (3.0, 0.08, 2.0), 'plaster')
    sandbags(-6.0, 15.4, 3.4); sandbags(6.0, 15.4, 3.4); box((0.0, 19.6, 0), (2.4, 0.6, 0.5), 'wood', 0.25); box((-3.0, 19.4, 0), (2.2, 0.6, 0.95), 'wood', -0.6)
    box((-38.0, 22.0, 0), (5.0, 4.0, 2.2), 'rust', 0.0, 0.05); box((38.0, 21.0, 0), (3.0, 3.0, 1.4), 'wood')
    for x in (-28.0, 28.0): box((x, 13.21, 3.0), (1.2, 0.12, 0.35), 'emissive_sign'); LIGHTS.append(('P', x, 13.8, 2.7, 20, (0.4, 1.0, 0.5)))
    red_lamp(0.0, 21.8, 3.4, 0, -1)
    for x in (-14.0, 14.0, -31.0, 31.0): box((x, 24.92, 2.6), (0.4, 0.14, 0.22), 'emissive_window'); LIGHTS.append(('P', x, 24.4, 2.4, 70, (1.0, 0.72, 0.45)))     # warm bulkheads: the hall's sides are not pitch black
    # light: strip fittings over both platform edges in 6 m sections, a good half of them dead in runs (stretches of dark)
    pattern_n = [1, 1, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 1, 1]; pattern_s = [0, 1, 1, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1]
    for k in range(14):
        x0 = -42.0 + k * 6.0
        strip(x0 + 0.3, x0 + 5.7, 3.4, H - 0.7, pattern_n[k]); strip(x0 + 0.3, x0 + 5.7, -3.4, H - 0.7, pattern_s[k])
    strip(-4.0, 4.0, 18.5, H - 0.6, False); strip(-12.0, -5.0, 18.5, H - 0.6, False); strip(5.0, 12.0, 18.5, H - 0.6, False)     # the ticket hall's strips are dead: daylight down the stair, the booths' lamps; strip(-30.0, -22.0, 22.0, H - 0.6, False); strip(22.0, 30.0, 22.0, H - 0.6, False)
    log('map', len(bm.faces), 'faces')
def post_lights():
    so = bpy.data.objects.get('Sun')
    if so: so.hide_render = True
    bg = next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND'); bg.inputs['Strength'].default_value = 0.015

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
    for i, Ls in enumerate(LIGHTS):
        kind, x, y, z, w, c = Ls[:6]
        ld = bpy.data.lights.new('lamp%d' % i, {'P': 'POINT', 'A': 'AREA', 'S': 'SPOT'}[kind]); ld.energy = w; ld.color = c
        lo = bpy.data.objects.new('lamp%d' % i, ld); lc.objects.link(lo); lo.location = (x, y, z)
        if kind == 'P': ld.shadow_soft_size = 0.15
        elif kind == 'A': ld.shape = 'RECTANGLE'; ld.size = Ls[6]; ld.size_y = Ls[7]                     # an area light faces down (-Z) as made
        else:
            ld.spot_size = math.radians(Ls[6]); ld.spot_blend = 0.5; ld.shadow_soft_size = 0.1
            lo.rotation_euler = (Vector(Ls[7]) - Vector((x, y, z))).to_track_quat('-Z', 'Y').to_euler()
    w = bpy.data.worlds.get('subway_sky') or bpy.data.worlds.new('subway_sky'); scene.world = w; w.use_nodes = True; nt = w.node_tree
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
    img = bpy.data.images.new('subway_light', size, size, alpha=False, float_buffer=True)
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
    path = os.path.join(TEXDIR, 'subway_light.exr'); img.filepath_raw = path; img.file_format = 'OPEN_EXR'; img.save()
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
_mv, _left = separate_coplanar(bm, fixed=lambda f: f in GBASE, skip=lambda f: f.normal.z < -0.9 and f.calc_center_median().z < 0.05)                       # no two faces in one plane on top of each other (they flicker)
log('coplanar overlaps: %d faces moved apart, %d pairs left' % (_mv, _left))
bm.faces.index_update(); GIDX = [f.index for f in GROUND_FACES if f.is_valid and f.calc_area() > 10.0]      # the ground and big floor patches keep floor density; lines and strips get the props' resolution
me = bpy.data.meshes.new('subway'); bm.to_mesh(me); bm.free()
for m in mats: me.materials.append(m)
uv_world(me)
mc = bpy.data.collections.new('map'); scene.collection.children.link(mc)
ob = bpy.data.objects.new('subway', me); mc.objects.link(ob)
me.calc_loop_triangles(); log('subway', len(me.loop_triangles), 'triangles,', len(me.vertices), 'verts')
lu = me.uv_layers.new(name='Lightmap'); me.uv_layers.active = lu
smart_uv(ob, 66, 0.004)
lightmap_weight(ob, GIDX, 2.0)                                                          # props get more of the light picture than the floor
log('thin faces given a neighbour light texel: %d' % collapse_thin_lightmap(ob, 2048, min_width=0.8, max_dist=1.0))
uvd = me.uv_layers['Lightmap']; me.uv_layers.active = me.uv_layers['UVMap']
lights(); post_lights()
def reach_check(ob):
    """walkable cells on a 0.5 m grid (nothing solid between 0.45 m and head height, not inside a solid), flood filled from mid-street"""
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get(); bvh = BVHTree.FromObject(ob, dg)
    xs = np.arange(-45.0, 45.0 + 0.01, 0.5); ys = np.arange(-25.0, 25.0 + 0.01, 0.5); walk = np.zeros((len(xs), len(ys)), bool)
    for i, x in enumerate(xs):
        for j, y in enumerate(ys):
            ok = True
            for dx, dy in ((0, 0), (0.2, 0.2), (-0.2, 0.2), (0.2, -0.2), (-0.2, -0.2)):
                h = bvh.ray_cast(Vector((x + dx, y + dy, 2.15)), Vector((0, 0, -1)), 3.0)
                if h[0] is None or h[0].z > 0.45 or h[1].z < 0: ok = False; break
            walk[i, j] = ok
    seen = np.zeros_like(walk); st = [(int((0 + 45.0) / 0.5), int((0 + 25.0) / 0.5))]
    while st:
        i, j = st.pop()
        if i < 0 or j < 0 or i >= len(xs) or j >= len(ys) or seen[i, j] or not walk[i, j]: continue
        seen[i, j] = True; st += [(i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)]
    lost = walk & ~seen; pts = [(float(xs[i]), float(ys[j])) for i, j in zip(*np.nonzero(lost))]
    log('reach: %d walkable cells, %d reached, %d cut off' % (walk.sum(), seen.sum(), lost.sum()), pts[:8])
reach_check(ob)
if 'nobake' not in OPT:
    bake(ob, 2048, int(OPT.get('samples', 40)))
    log('black faces in the open given a lit neighbour texel: %d' % relight_black_faces(ob, os.path.join(TEXDIR, 'subway' + '_light.exr')))
cfg = {'blend': 'subway.blend', 'out': '../../Ashfall/assets/subway', 'world': {'collections': ['map'], 'lightmap': 'tex/subway_light.exr', 'lmSize': 2048},
       'grid': {'cell': 0.25}, 'probes': {'cell': 1.0, 'height': 1.0, 'samples': 96}, 'sky': {'width': 1024}, 'maxTexture': 1024}
with open(os.path.join(BASE, 'subway.export.json'), 'w') as f: json.dump(cfg, f, indent=1)
bpy.ops.wm.save_mainfile(); log('saved', bpy.data.filepath)
if 'preview' in OPT:
    cd = bpy.data.cameras.new('st_cam'); cam = bpy.data.objects.new('st_cam', cd); scene.collection.objects.link(cam); scene.camera = cam
    cd.sensor_fit = 'VERTICAL'; cd.angle_y = math.radians(50)
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 24
    try: scene.cycles.use_denoising = True
    except Exception: pass
    scene.render.resolution_x, scene.render.resolution_y = 480, 270
    views = [((-30, -10, 1.6), (30, -10, 1.6)), ((-14.5, 0, 1.6), (-30, 0, 1.4)), ((0, 15, 1.6), (-20, 18, 1.2)), ((-40, -16, 1.6), (40, -16, 1.6)),
             ((0, 0, 1.6), (12, 0, 1.4)), ((30, 8, 1.6), (0, -8, 1.5))]
    big = np.ones((3 * 270, 2 * 480, 4), np.float32)
    for i, (p, t) in enumerate(views):
        cam.location = p; cam.rotation_euler = (Vector(t) - Vector(p)).to_track_quat('-Z', 'Y').to_euler()
        tmp = os.path.join(CACHE, '_st%d.png' % i); scene.render.filepath = tmp; bpy.ops.render.render(write_still=True)
        im = bpy.data.images.load(tmp); a = np.array(im.pixels[:], np.float32).reshape(270, 480, 4); bpy.data.images.remove(im); os.remove(tmp)
        r, c = divmod(i, 2); big[(2 - r) * 270:(3 - r) * 270, c * 480:(c + 1) * 480] = a
    im = bpy.data.images.new('st_grid', 960, 810); im.pixels.foreach_set(big.ravel()); im.filepath_raw = os.path.join(CACHE, 'subway_views.png'); im.file_format = 'PNG'; im.save()
    log('preview subway_views.png')
log('done')
