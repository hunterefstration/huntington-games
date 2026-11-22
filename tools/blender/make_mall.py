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
add_pics({'tile': (2.4, tile_pic)})
EMIT['emissive_lamp'] = (1.0, 0.9, 0.75)
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
def lamp(x, y, z, on=True, w=300, L=1.4, rz=0.0):
    box((x, y, z), (0.3, L, 0.08), 'metal', rz)
    if on: box((x, y, z - 0.03), (0.22, L - 0.1, 0.04), 'emissive_lamp', rz); LIGHTS.append((x, y, z - 0.25, w, (1.0, 0.9, 0.75)))
def exit_sign(x, y, z, rz=0.0):
    box((x, y, z), (0.7, 0.12, 0.25), 'emissive_sign', rz); LIGHTS.append((x, y, z - 0.3, 25, (1.0, 0.4, 0.15)))
def planter(x, y, rz=0.0):
    box((x, y, 0), (3.2, 1.3, 0.6), 'brick', rz); box((x, y, 0.6), (3.0, 1.1, 0.04), 'dirt', rz)
    for d in (-0.8, 0.8):
        px, py = P(x, y, rz, d, 0); cyl((px, py, 0.6), 0.12, 2.4, 'wood', 6)
        for k in range(3):
            a = random.uniform(0, 6.28); beam((px, py, 1.6 + k * 0.4), (px + 0.9 * math.cos(a), py + 0.9 * math.sin(a), 2.3 + k * 0.4), 0.06, 'wood')
def bench(x, y, rz=0.0):
    box((x, y, 0), (2.0, 0.6, 0.5), 'wood', rz); px, py = P(x, y, rz, 0, 0.27); box((px, py, 0.5), (2.0, 0.08, 0.45), 'wood', rz)
def shop(x0, x1, side, kind):
    """one shop unit between x0 and x1; side +1 north row (front at y=8), -1 south row (front at y=-8)"""
    yf, yb = 8.0 * side, 22.0 * side; cx = (x0 + x1) / 2; ym = (yf + yb) / 2
    wy(yb, x0, x1, H, 'brick', [(x0 + random.choice((1.0, 4.5)), x0 + random.choice((1.0, 4.5)) + 1.5)])
    # shopfront: glass either side of a 4.4 m opening, fascia above
    for a, b in ((x0 + 0.15, x0 + 1.55), (x1 - 1.55, x1 - 0.15)):
        if random.random() < 0.7: box(((a + b) / 2, yf, 0), (b - a, 0.08, 3.2), 'glass')
        else: box(((a + b) / 2, yf, 0), (b - a, 0.12, 0.3), 'metal')            # broken: just the sill
    box((cx, yf, 3.2), (x1 - x0, 0.3, H - 3.2), 'plaster')
    box((cx, yf - 0.2 * side, 3.5), (x1 - x0 - 1.0, 0.1, 0.7), 'emissive_sign' if random.random() < 0.3 else 'metal')
    if kind == 'shut':
        box((cx, yf, 0), (4.4, 0.1, 3.2), 'rust'); return
    if random.random() < 0.4: box((cx, yf + 0.1 * side, 1.95), (4.4, 0.1, 1.25), 'rust')    # security shutter half down
    if kind == 'shelves':
        for dx in (-2.0, 0.0, 2.0): box((cx + dx, ym + 1.0 * side, 0), (0.5, 6.0, 1.8), 'metal')
        box((cx, yb - 1.0 * side, 0), (5.5, 0.6, 2.2), 'wood')
    elif kind == 'clothes':
        for dx, dy in ((-2.0, -2.5), (1.5, -1.0), (-1.0, 2.0), (2.2, 3.0)): cyl((cx + dx, ym + dy, 0), 0.55, 1.4, 'metal', 10)
        box((x0 + 0.5, ym, 0), (0.6, 8.0, 2.0), 'wood')
    elif kind == 'counter':
        box((cx, yb - 3.0 * side, 0), (5.0, 0.8, 1.05), 'wood'); box((cx - 1.5, yb - 3.0 * side, 1.05), (0.5, 0.4, 0.3), 'metal')
        box((cx, yb - 1.0 * side, 0), (6.0, 0.5, 2.0), 'metal')
    elif kind == 'empty':
        heap((cx + random.uniform(-2, 2), ym, 0), 1.6, 1.0, 0.35, 'concrete'); box((cx + 2.0, ym + 2.0, 0), (1.0, 1.0, 0.9), 'wood', 0.4)
    lamp(cx, ym, H - 0.4, on=random.random() < 0.6, w=320)
def food_court():
    # kiosks along the west wall: counters with a gap at one end to get behind
    for k in range(5):
        y0 = -21.0 + k * 8.4; y1 = y0 + 8.4
        if k: box((-43.2, y0, 0), (3.6, 0.2, H), 'plaster')                    # kiosk dividers
        wx(-41.5, y0 + 1.6, y1 - 0.2, 1.1, 'wood', th=0.7)
        box((-44.5, (y0 + y1) / 2, 0), (0.8, 6.0, 1.0), 'metal')              # back counter / fryers
        box((-41.6, (y0 + y1) / 2, 3.2), (0.3, 8.0, 1.0), 'emissive_sign' if k % 2 == 0 else 'metal')
    for x in (-37.0, -32.5, -28.0):
        for y in range(-18, 19, 5):
            if (x, y) == (-32.5, 2): continue
            cyl((x, y, 0), 0.12, 0.72, 'metal', 8); cyl((x, y, 0.72), 0.75, 0.05, 'plaster', 14)
            for a in range(4):
                sx, sy = x + 1.05 * math.cos(a * math.pi / 2 + 0.5), y + 1.05 * math.sin(a * math.pi / 2 + 0.5); cyl((sx, sy, 0), 0.2, 0.42, 'metal', 8)
    box((-32.5, 2.0, 0), (1.5, 0.9, 1.0), 'metal', 0.6)                        # an overturned bin store
    for x in (-38.0, -30.0):
        for y in (-15.0, -5.0, 5.0, 15.0): lamp(x, y, H - 0.4, on=random.random() < 0.45, w=260)
def build():
    ground()
    for x in (-XH - 0.3, XH + 0.3): box((x, 0, 0), (0.6, 2 * YH + 1.2, H + 0.4), 'brick')
    for y in (-YH - 0.3, YH + 0.3): box((0, y, 0), (2 * XH + 1.2, 0.6, H + 0.4), 'brick')
    # ceiling (1 cm above the wall tops) with the atrium hole, and the skylight lantern over it (panes broken out)
    S = 5.0; E = 0.6; z = H + 0.01
    box((0, (-YH - E - S) / 2, z), (2 * XH + 2 * E, YH + E - S, 0.4), 'concrete'); box((0, (YH + E + S) / 2, z), (2 * XH + 2 * E, YH + E - S, 0.4), 'concrete')
    box(((-XH - E - S) / 2, 0, z), (XH + E - S, 2 * S, 0.4), 'concrete'); box(((XH + E + S) / 2, 0, z), (XH + E - S, 2 * S, 0.4), 'concrete')
    zt = H + 0.41
    for s in (-1, 1): box((0, s * (S + 0.1), zt), (2 * S + 0.4, 0.2, 1.6), 'metal'); box((s * (S + 0.1), 0, zt), (0.2, 2 * S, 1.6), 'metal')
    for i in range(5):
        for j in range(5):
            cx_, cy_ = -S + 1.0 + 2.0 * i, -S + 1.0 + 2.0 * j
            if random.random() < 0.55 and not (i == 2 and j == 2): continue    # broken pane
            box((cx_, cy_, zt + 1.6), (1.9, 1.9, 0.04), 'glass')
    for k in range(6): box((-S + 2.0 * k, 0, zt + 1.6), (0.12, 2 * S, 0.12), 'metal'); box((0, -S + 2.0 * k, zt + 1.6), (2 * S, 0.12, 0.12), 'metal')
    for sx in (-1, 1):
        for sy in (-1, 1): box((sx * 5.6, sy * 5.6, 0), (0.6, 0.6, H), 'concrete')
    # floors: tiled concourse, food court and lobby (one overlay each, not overlapping)
    overlay(-25.0, -8.0, 35.0, 8.0, 'tile'); overlay(-45.0, -22.0, -25.0, 22.0, 'tile'); overlay(35.0, -22.0, 45.0, 22.0, 'tile')
    # the shop rows: 8 units of 7.5 m each side
    kinds = ['shelves', 'clothes', 'counter', 'empty', 'shelves', 'counter', 'clothes', 'empty']
    for side in (-1, 1):
        random.shuffle(kinds); ks = list(kinds); ks[3 if side > 0 else 5] = 'shut'
        for i in range(8):
            x0 = -25.0 + 7.5 * i; shop(x0, x0 + 7.5, side, ks[i])
            if i: wx(x0, 8.0 * side if side > 0 else -22.0, 22.0 if side > 0 else -8.0, H, 'plaster')
        wx(-25.0, 8.0 if side > 0 else -22.0, 22.0 if side > 0 else -8.0, H, 'plaster'); wx(35.0, 8.0 if side > 0 else -22.0, 22.0 if side > 0 else -8.0, H, 'plaster')
        # back corridor (22..28) and store rooms (28..33) behind it
        ys = 28.0 * side; wy(ys, -XH, XH, H, 'brick', [(-40.0, -38.4), (-22.0, -20.4), (-6.0, -4.4), (8.0, 9.6), (22.0, 23.6), (37.0, 38.6)])
        for x in (-30.0, -15.0, 0.0, 15.0, 30.0): wx(x, 28.0 if side > 0 else -33.0, 33.0 if side > 0 else -28.0, H, 'brick')
        for x in (-36.0, -19.0, -3.0, 16.0, 33.0):
            box((x, 30.5 * side, 0), (1.2, 1.2, 1.2), 'wood', 0.3); box((x + 1.4, 31.5 * side, 0), (1.0, 1.0, 1.9), 'wood')
        for x in range(-40, 41, 10): lamp(x, 25.0 * side, H - 0.4, on=random.random() < 0.5, w=220)
        box((0, 23.0 * side, 4.6), (2 * XH - 1.0, 0.3, 0.3), 'rust'); box((0, 23.5 * side, 5.1), (2 * XH - 1.0, 0.2, 0.2), 'metal')
        for x, w, d, h in ((-33.0, 1.2, 0.8, 1.3), (-10.0, 2.0, 0.9, 1.0), (22.0, 1.0, 1.0, 1.6), (40.0, 1.4, 1.4, 1.1)):
            box((x, 26.5 * side, 0), (w, d, h), 'metal', 0.0, 0.03)
        # food court and lobby walls on to the corridor
        wy(22.0 * side, -XH, -25.0, H, 'plaster', [(-37.0, -34.0)]); wy(22.0 * side, 35.0, XH, H, 'plaster', [(38.5, 41.5)])
        for x in (-38.0, -4.0, 31.0): exit_sign(x, 22.0 * side - 0.2 * side, 2.8)
    food_court()
    # lobby: chained glass doors on the east wall, two dead escalators, an information desk
    for y in (-3.0, -1.0, 1.0, 3.0): box((XH - 0.1, y, 0), (0.1, 1.9, 2.6), 'glass')
    box((XH - 0.2, 0, 2.6), (0.2, 8.4, 0.4), 'metal')
    for sy in (-1, 1):
        for k in range(6): box((39.5, sy * (11.0 + k * 1.2), 0), (2.2, 1.2, 0.6 + 0.48 * k), 'metal')
        for sx in (-1, 1): beam((39.5 + sx * 1.15, sy * 10.4, 1.0), (39.5 + sx * 1.15, sy * 18.0, 4.0), 0.12, 'metal')
    cyl((40.0, 0.0, 0), 1.3, 1.05, 'wood', 16)
    for y in (-14.0, -4.0, 4.0, 14.0): lamp(40.0, y, H - 0.4, on=random.random() < 0.5, w=260)
    # concourse: planters with dead trees, benches, a dry fountain, kiosk carts, rubble under the skylight
    for x in (-20.0, -12.0, 20.0, 28.0):
        for y in (-4.6, 4.6): planter(x, y)
    for x in (-16.0, 24.0):
        for y in (-4.6, 4.6): bench(x, y, 0.0 if y < 0 else math.pi)
    cyl((12.0, 0.0, 0), 2.8, 0.55, 'concrete', 20); cyl((12.0, 0.0, 0.55), 2.5, 0.02, 'dirt', 20); cyl((12.0, 0.0, 0), 0.8, 1.5, 'concrete', 12); cyl((12.0, 0.0, 1.5), 1.3, 0.2, 'concrete', 12); cyl((12.0, 0.0, 1.7), 0.3, 0.9, 'concrete', 8)
    box((-7.5, -3.2, 0), (1.2, 2.2, 1.1), 'wood', 0.2); box((-7.5, -3.2, 1.1), (1.4, 2.4, 0.08), 'rust', 0.2); box((31.0, 2.5, 0), (1.2, 2.2, 1.1), 'metal', -0.3)
    for k in range(9):
        heap((random.uniform(-3.5, 4.5), random.uniform(-3.5, 3.5), 0), random.uniform(0.4, 1.0), random.uniform(0.3, 0.8), random.uniform(0.08, 0.2), random.choice(('glass', 'concrete')))
    beam((-1.0, 2.6, 0.18), (3.5, 0.8, 0.12), 0.25, 'metal')                    # a fallen skylight frame
    for x in (-21.0, -13.0, -7.0, 7.0, 17.0, 25.0, 31.0):
        for y in (-5.8, 5.8): lamp(x, y, H - 0.4, on=random.random() < 0.5, w=420)
    for x in (-24.0, 34.0): exit_sign(x, 0.0, 3.0, math.pi / 2)
    log('map', len(bm.faces), 'faces')
def post_lights():
    so = bpy.data.objects['Sun']; so.data.energy = 4.0; so.data.color = (1.0, 0.55, 0.32)
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
    for i, (x, y, z, w, c) in enumerate(LIGHTS):
        ld = bpy.data.lights.new('lamp%d' % i, 'POINT'); ld.energy = w; ld.color = c; ld.shadow_soft_size = 0.3
        lo = bpy.data.objects.new('lamp%d' % i, ld); lc.objects.link(lo); lo.location = (x, y, z)
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
    path = os.path.join(TEXDIR, 'mall_light.exr'); img.filepath_raw = path; img.file_format = 'OPEN_EXR'; img.save()
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
me = bpy.data.meshes.new('mall'); bm.to_mesh(me); bm.free()
for m in mats: me.materials.append(m)
uv_world(me)
mc = bpy.data.collections.new('map'); scene.collection.children.link(mc)
ob = bpy.data.objects.new('mall', me); mc.objects.link(ob)
me.calc_loop_triangles(); log('mall', len(me.loop_triangles), 'triangles,', len(me.vertices), 'verts')
lu = me.uv_layers.new(name='Lightmap'); me.uv_layers.active = lu
smart_uv(ob, 66, 0.004)
uvd = me.uv_layers['Lightmap']; me.uv_layers.active = me.uv_layers['UVMap']
lights(); post_lights()
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
