# ASHFALL map "CHECKPOINT 9" in art/ashfall/outpost.blend (made from make_yard.py: same pipeline, its own layout below).
#   blender -b art/ashfall/outpost.blend -P tools/blender/make_outpost.py -- [nobake] [preview]   (first time: --factory-startup)
# then node tools/export-art.mjs outpost -> Ashfall/assets/outpost.hgm
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
if not bpy.data.filepath.replace('\\', '/').endswith('art/ashfall/outpost.blend'):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, 'outpost.blend')); log('created', bpy.data.filepath)
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
XH, YH = 50.0, 50.0
MAPNAME = 'outpost'
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
from mapkit import install; install(globals())
add_pics({'grime': (2.0, grime_pic), 'paint': (1.5, paint_pic)})
SODIUM = (1.0, 0.80, 0.55); FIRE = (1.0, 0.48, 0.18); TENT = (1.0, 0.72, 0.42)
def overlay(x0, y0, x1, y1, mat, z=0.02): return quad(x0, y0, x1, y1, mat, z)
def hesco_row(x0, y0, x1, y1, h=1.4, gaps=()):
    """1 m baskets from (x0, y0) to (x1, y1) (ends included); gaps [(a, b)] in metres along the row"""
    L = math.hypot(x1 - x0, y1 - y0); n = max(1, int(round(L / 1.06))); rz = math.atan2(y1 - y0, x1 - x0)
    for k in range(n):
        t = (k + 0.5) / n * L
        if any(a - 0.55 <= t <= b + 0.55 for a, b in gaps): continue
        x, y = x0 + (x1 - x0) * t / L, y0 + (y1 - y0) * t / L
        box((x, y, 0), (1.0, 1.0, h), 'sandbag', rz, 0.04)
        box((x, y, h - 0.06), (1.04, 1.04, 0.04), 'metal', rz)                         # the wire rim of the basket
POSTS = set()
def fence(x0, y0, x1, y1, gaps=()):
    L = math.hypot(x1 - x0, y1 - y0); n = max(1, int(L / 3.0)); rz = math.atan2(y1 - y0, x1 - x0)
    for k in range(n):
        t0, t1 = k / n, (k + 1) / n
        xa, ya = x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0; xb, yb = x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1
        for px, py in ((xa, ya), (xb, yb)):
            if (round(px, 2), round(py, 2)) not in POSTS: POSTS.add((round(px, 2), round(py, 2))); cyl((px, py, 0), 0.05, 2.6, 'metal', 6)
        if any(a <= (t0 + t1) / 2 <= b for a, b in gaps): continue
        box(((xa + xb) / 2, (ya + yb) / 2, 0), (L / n - 0.3, 0.25, 0.55), 'concrete', rz)          # a footing: the panel alone is too thin for the grid
        box(((xa + xb) / 2, (ya + yb) / 2, 0.55), (L / n - 0.12, 0.03, 1.9), 'metal', rz)
        box(((xa + xb) / 2, (ya + yb) / 2, 2.55), (L / n - 0.12, 0.12, 0.12), 'rust', rz)
        if k % 5 == 2:                                                                 # a warning plate on every fifth panel, facing out
            mx, my = (xa + xb) / 2, (ya + yb) / 2; ol = math.hypot(mx, my); ox, oy = mx / ol, my / ol
            if abs(ox) > abs(oy): ox, oy = (1.0 if ox > 0 else -1.0), 0.0
            else: ox, oy = 0.0, (1.0 if oy > 0 else -1.0)
            sign(mx + ox * 0.1, my + oy * 0.1, 1.3, 0.5, 0.35, math.atan2(ox, -oy), 'paint')
def tent(x, y, rz, L=8.0, W=5.0, lit=True):
    """a frame tent: low side walls (blockers), pitched roof, both ends open: walk through it; cots and lockers along the sides"""
    def at(lx, ly): return P(x, y, rz, lx, ly)
    for sx in (-1, 1):
        px, py = at(sx * W / 2, 0); box((px, py, 0), (0.2, L, 1.7), 'sandbag', rz)
        before = set(bm.faces); ang = math.atan2(1.3, W / 2)
        pm = at(sx * W / 4, 0); bmesh.ops.create_cube(bm, size=1.0, matrix=T(pm[0], pm[1], 1.7 + 0.65) @ Rz(rz) @ Ry(-sx * ang) @ Matrix.Diagonal((math.hypot(W / 2, 1.3) + 0.1, L, 0.05, 1)))
        for f in [f for f in bm.faces if f not in before]: f.material_index = MI['sandbag']
        for ly in (-2.6, 0.0, 2.6):                                                    # cots (0.42 m: you step over them)
            cx, cy = at(sx * (W / 2 - 0.55), ly); box((cx, cy, 0.34), (0.72, 1.9, 0.08), 'sandbag', rz)
            for ex in (-0.3, 0.3):
                for ey in (-0.85, 0.85): lx_, ly_ = at(sx * (W / 2 - 0.55) + ex, ly + ey); box((lx_, ly_, 0), (0.04, 0.04, 0.34), 'metal', rz)
        cx, cy = at(sx * (W / 2 - 0.4), 1.3); box((cx, cy, 0), (0.5, 0.6, 0.42), 'olive' if 'olive' in MI else 'wood', rz)
    for ly in (-L / 2, L / 2):
        for sx in (-1, 1): px, py = at(sx * W / 2, ly); cyl((px, py, 0), 0.06, 1.72, 'wood', 6)
    px, py = at(0, 0); box((px, py, 2.62), (0.06, 0.06, 0.36), 'metal')
    if lit: lamp_cone(px, py, 2.35, 'metal', 'emissive_lamp', 0.2); LIGHTS.append((px, py, 2.1, 30, TENT))
    else: lamp_cone(px, py, 2.35, 'metal', 'glass', 0.2)
def tower(x, y):
    for dx in (-1.3, 1.3):
        for dy in (-1.3, 1.3): box((x + dx, y + dy, 0), (0.25, 0.25, 6.0), 'wood')
    box((x, y, 6.0), (3.4, 3.4, 0.2), 'wood'); box((x, y, 6.2), (3.42, 3.42, 1.1), 'sandbag', 0.0, 0.05); box((x, y, 8.3), (3.8, 3.8, 0.15), 'metal')
    for dx in (-1.6, 1.6):
        for dy in (-1.6, 1.6): box((x + dx, y + dy, 7.3), (0.1, 0.1, 1.0), 'wood')
    for k in range(4): beam((x - 1.3, y + 1.3, 0.6 + k * 1.4), (x + 1.3, y + 1.3, 1.3 + k * 1.4), 0.08, 'wood'); beam((x - 1.3, y - 1.3, 1.3 + k * 1.4), (x + 1.3, y - 1.3, 0.6 + k * 1.4), 0.08, 'wood')
    for s in (-0.25, 0.25): box((x + 1.5, y + s, 0), (0.06, 0.06, 6.0), 'metal')            # the ladder
    for k in range(14): box((x + 1.5, y, 0.4 + k * 0.4), (0.05, 0.5, 0.04), 'metal')
    sandbags(x - 1.4, y - 1.75, x + 1.4, y - 1.75, 4); sandbags(x - 1.4, y + 1.75, x + 1.4, y + 1.75, 4)  # bags round the legs (a blocker, not a room)
    box((x - 1.0, y, 0.006), (0.4, 2.3, 1.0), 'sandbag'); box((x + 0.95, y, 0.006), (0.5, 2.3, 1.0), 'sandbag')
def wheel(cx, cy, rz, lx, ly, r, w=0.35):
    a = P(cx, cy, rz, lx - w / 2, ly); b = P(cx, cy, rz, lx + w / 2, ly); tube((a[0], a[1], r + 0.004), (b[0], b[1], r + 0.004), r, 'grime', 12)
def truck(x, y, rz, burnt=False):
    """army truck, front to local +y: cab, bonnet, a bed with a canvas cover on hoops (2.9 m: you cannot see over it)"""
    body = 'rust' if burnt else 'metal'
    B(x, y, rz, 0, 2.4, 0.95, (2.3, 1.7, 1.6), body, 0, 0.06); B(x, y, rz, 0, 3.75, 0.95, (2.1, 1.0, 0.9), body, 0, 0.05)
    if not burnt: B(x, y, rz, 0, 3.27, 1.65, (1.9, 0.03, 0.7), 'glass')
    B(x, y, rz, 0, -1.2, 0.55, (1.0, 7.6, 0.25), 'grime')                               # chassis rails
    B(x, y, rz, 0, -1.5, 0.82, (2.45, 4.8, 0.12), body)
    if not burnt:
        B(x, y, rz, 0, -1.5, 0.94, (2.4, 4.7, 1.95), 'sandbag', 0, 0.12)
        for k in range(4): B(x, y, rz, 0, -3.6 + k * 1.4, 2.88, (2.44, 0.08, 0.05), 'metal')
    else:
        for s in (-1, 1): B(x, y, rz, s * 1.17, -1.5, 0.94, (0.06, 4.7, 0.5), body)
    for ly in (2.4, -1.0, -2.6):
        for lx in (-1.05, 1.05): wheel(x, y, rz, lx, ly, 0.52, 0.4)
def apc(x, y, rz):
    def at(lx, ly): return P(x, y, rz, lx, ly)
    B(x, y, rz, 0, 0, 0.45, (2.3, 6.0, 0.4), 'grime')
    prism(*at(0, 0), rz, [(-3.3, 0.8), (2.6, 0.8), (3.5, 1.3), (2.9, 2.1), (-3.3, 2.1)], 2.7, 'metal')
    cyl((*at(0, -0.6), 2.1), 0.75, 0.45, 'metal', 12); beam((*at(0, 0.0), 2.35), (*at(0, 2.3), 2.38), 0.12, 'metal')
    for ly in (-2.4, -0.8, 0.8, 2.4):
        for lx in (-1.2, 1.2): wheel(x, y, rz, lx, ly, 0.58, 0.42)
def car(x, y, rz, burnt=False, door=False):
    """a civilian saloon, front to local +y (1.4 m: crouch cover)"""
    body = 'rust' if burnt else random.choice(('plaster', 'metal', 'brick'))
    B(x, y, rz, 0, 0, 0.3, (1.76, 4.3, 0.55), body, 0, 0.05)
    prism(*P(x, y, rz, 0, 0), rz, [(-1.8, 0.85), (1.0, 0.85), (0.35, 1.32), (-1.25, 1.32)], 1.6, 'glass' if not burnt else 'grime')
    B(x, y, rz, 0, -0.45, 1.32, (1.64, 1.66, 0.05), body)
    for ly in (1.35, -1.35):
        for lx in (-0.82, 0.82): wheel(x, y, rz, lx, ly, 0.31, 0.22)
    if door: B(x, y, rz, 1.4, 0.3, 0.35, (0.05, 1.0, 0.9), body, 0.9)
def helicopter(x, y, rz):
    def at(lx, ly): return P(x, y, rz, lx, ly)
    box((*at(0, 0), 0.25), (2.0, 4.4, 0.5), 'metal', rz); box((*at(0, 0.2), 0.75), (2.4, 5.0, 1.7), 'metal', rz, 0.3)
    box((*at(0, 2.75), 0.95), (2.0, 1.2, 1.25), 'glass', rz); box((*at(0, -5.0), 1.6), (0.6, 6.0, 0.6), 'metal', rz)
    box((*at(0, -7.6), 1.8), (0.15, 1.2, 1.8), 'metal', rz); cyl((*at(0, 0.2), 2.45), 0.25, 0.4, 'metal', 8)
    for lx in (-1.2, 1.2):
        px, py = at(lx, 0.2); box((px, py, 0), (0.12, 4.6, 0.12), 'metal', rz)
        for ly in (-1.2, 1.6): sx_, sy_ = at(lx, ly); qx, qy = at(lx * 0.75, ly); beam((sx_, sy_, 0.12), (qx, qy, 0.6), 0.06, 'metal')
    for a in (0.3, 1.9, 3.5, 5.1):
        px, py = at(math.cos(a) * 3.5, 0.2 + math.sin(a) * 3.5); box((px, py, 2.4 - 0.5 * abs(math.sin(a))), (7.0, 0.35, 0.05), 'metal', rz + a)
def floodlight(x, y, w=900, h=7.0, rz=0.0, on=True):
    cyl((x, y, 0), 0.14, h, 'metal', 8); box((x, y, 0), (0.5, 0.5, 0.3), 'concrete')
    B(x, y, rz, 0, 0.27, 1.2, (0.35, 0.25, 0.45), 'metal', 0, 0.02)                    # the junction box
    B(x, y, rz, 0, 0.0, h, (1.6, 0.5, 0.45), 'metal', 0, 0.03); B(x, y, rz, 0, 0.0, h - 0.04, (1.3, 0.34, 0.05), 'emissive_lamp' if on else 'glass')
    if on: LIGHTS.append((x, y, h - 0.4, w, SODIUM))
def burn_barrel(x, y, w=55):
    barrel(x, y, 'rust'); cyl((x, y, 0.9), 0.24, 0.06, 'emissive_fire', 10); LIGHTS.append((x, y, 1.3, w, FIRE))
def mast(x, y, h=14.0):
    """a lattice radio mast with a lit tip: a landmark"""
    pts = [P(x, y, a, 0.3, 0) for a in (0.0, 2.094, 4.189)]
    for px, py in pts: tube((px, py, 0.3), (px, py, h), 0.035, 'metal', 6)
    box((x, y, 0), (1.2, 1.2, 0.3), 'concrete')
    for k in range(int(h)):
        for i in range(3):
            a, b = pts[i], pts[(i + 1) % 3]; beam((a[0], a[1], 0.5 + k), (b[0], b[1], 1.0 + k), 0.025, 'metal')
    box((x, y, h), (0.25, 0.25, 0.25), 'emissive_sign'); tube((x, y, h + 0.25), (x, y, h + 1.8), 0.02, 'metal', 6)
def camo_net(x0, y0, x1, y1, z=3.6):
    """a net on poles over the vehicle park (overhead: does not block)"""
    for px, py in ((x0, y0), (x1, y0), (x0, y1), (x1, y1), ((x0 + x1) / 2, y0), ((x0 + x1) / 2, y1)): cyl((px, py, 0), 0.06, z + 0.05, 'wood', 6)
    nx_, ny_ = 4, 3
    for i in range(nx_):
        for j in range(ny_):
            cx, cy = x0 + (i + 0.5) * (x1 - x0) / nx_, y0 + (j + 0.5) * (y1 - y0) / ny_
            box((cx, cy, z + 0.06 + 0.05 * ((i + j) % 2) - 0.12 * math.sin(math.pi * (i + 0.5) / nx_) * math.sin(math.pi * (j + 0.5) / ny_) - 0.03 * i),
                ((x1 - x0) / nx_, (y1 - y0) / ny_, 0.025), 'sandbag' if (i * 7 + j * 3) % 3 else 'dirt')
def command_post(x, y):
    """a plywood hut (8 x 5 m inside, roof 2.7 m), door 1.8 m on the south side, windows; a map table, the radio desk, a map board"""
    x0, x1, y0, y1 = x - 4.0, x + 4.0, y - 2.5, y + 2.5; Hh = 2.7
    wall_y(y0, x0 - 0.2, x1 + 0.2, Hh, 'wood', [(x - 0.9, x + 0.9)], 0.2); wall_y(y1, x0 - 0.2, x1 + 0.2, Hh, 'wood', [], 0.2)
    for xx in (x0, x1): box((xx, y, 0), (0.2, y1 - y0 - 0.2, Hh), 'wood')
    box((x, y, Hh + 0.01), (8.9, 5.9, 0.12), 'metal')
    for xx in (x0 + 1.5, x1 - 1.5): box((xx, y0 - 0.13, 1.0), (1.2, 0.05, 0.08), 'metal'); box((xx, y0 - 0.13, 1.08), (1.1, 0.03, 0.8), 'glass')
    box((x - 1.0, y + 0.4, 0), (2.2, 1.2, 0.88), 'wood'); box((x - 1.0, y + 0.4, 0.88), (2.0, 1.0, 0.012), 'paint')
    box((x + 2.6, y1 - 0.5, 0), (2.4, 0.7, 0.8), 'metal'); box((x + 2.2, y1 - 0.55, 0.8), (0.6, 0.4, 0.35), 'grime'); box((x + 3.1, y1 - 0.6, 0.8), (0.5, 0.35, 0.25), 'olive' if 'olive' in MI else 'metal')
    sign(x - 1.5, y1 - 0.135, 1.1, 2.4, 1.2, 0.0, 'paint', 'wood')
    box((x0 + 0.6, y1 - 0.6, 0), (0.8, 0.8, 1.9), 'metal'); box((x1 - 0.5, y - 0.4, 0), (0.6, 1.6, 1.4), 'metal')
    lamp_cone(x, y, 2.35, 'metal', 'emissive_lamp', 0.22, Hh); LIGHTS.append((x, y, 2.0, 45, TENT))
    sandbags(x0 - 1.0, y0 - 1.6, x - 2.0, y0 - 1.6, 4); sandbags(x + 2.0, y0 - 1.6, x1 + 1.0, y0 - 1.6, 4)
    sign(x, y0 - 0.135, 2.27, 2.4, 0.36, 0.0, 'paint', 'wood')
def build():
    cx_road = 5.0
    floor([(-cx_road, -YH - 0.5, cx_road, YH + 0.5, 'asphalt'), (-25.0, -7.0, -11.0, 7.0, 'concrete'), (11.0, -4.0, 27.0, 13.0, 'concrete'),
           (-6.0, 10.0, 12.0, 21.0, 'concrete')], 'dirt', -XH - 0.5, -YH - 0.5, XH + 0.5, YH + 0.5)
    for x in (-XH - 0.6, XH + 0.6): box((x, 0, 0), (1.2, 2 * YH + 2.4, 3.2), 'dirt')
    for y in (-YH - 0.6, YH + 0.6): box((0, y, 0), (2 * XH, 1.2, 3.2), 'dirt')
    # perimeter fence 4 m inside the berm, with breaks (the ashen come in through them)
    fence(-46.0, -46.0, 46.0, -46.0, [(0.18, 0.26), (0.45, 0.55), (0.78, 0.86)]); fence(-46.0, 46.0, 46.0, 46.0, [(0.12, 0.2), (0.45, 0.55), (0.72, 0.8)])
    fence(-46.0, -46.0, -46.0, 46.0, [(0.2, 0.28), (0.5, 0.58), (0.8, 0.88)]); fence(46.0, -46.0, 46.0, 46.0, [(0.15, 0.23), (0.48, 0.56), (0.76, 0.84)])
    # road paint: centre dashes, edge lines, the stop line at the gate
    dashes(0, -YH, 0, YH, 0.15, 'paint', 3.0, 4.0)
    for s in (-1, 1): strip(s * 4.7, -YH, s * 4.7, -25.5, 0.12, 'paint'); strip(s * 4.7, -22.5, s * 4.7, 22.5, 0.12, 'paint'); strip(s * 4.7, 25.5, s * 4.7, YH, 0.12, 'paint')
    strip(-4.6, -26.2, 4.6, -26.2, 0.4, 'paint', 0.035)
    for k in range(9): strip(-4.0 + k, -40.6, -3.6 + k, -40.6, 0.5, 'paint', 0.035)       # chevrons before the chicane
    # ---- THE GATE (south): the chicane under an inspection canopy, the barrier arm raised, the booth, a bagged firing point, a queue of cars
    for x, y in ((-2.25, -38.0), (2.25, -33.0), (-2.25, -28.5)):
        jersey(x - 1.55, y, 0.0, 3.0); jersey(x + 1.55, y, 0.0, 3.0)
    for s in (-1, 1):
        for y in (-37.5, -29.0): box((s * 5.7, y, 0), (0.3, 0.3, 4.6), 'metal')
        box((s * 5.7, -33.25, 4.6), (0.4, 9.3, 0.4), 'metal')
    box((0, -33.25, 5.0), (12.2, 9.6, 0.12), 'metal'); box((0, -37.95, 4.55), (12.1, 0.1, 0.55), 'paint'); box((0, -28.55, 4.55), (12.1, 0.1, 0.55), 'paint')
    sign(0, -38.06, 4.5, 5.0, 0.4, 0.0, 'emissive_sign', 'metal')                       # CHECKPOINT 9 (lit board)
    box((0, -33.25, 4.7), (1.4, 0.4, 0.3), 'metal'); box((0, -33.25, 4.65), (1.2, 0.3, 0.05), 'emissive_lamp')
    LIGHTS.append((0, -33.25, 4.2, 260, SODIUM))
    box((5.3, -24.6, 0), (0.4, 0.4, 1.1), 'metal')                                         # the barrier arm: raised (it used to shut the road)
    for k in range(8):
        a = math.radians(78); p0 = (5.3 - k * 1.05 * math.cos(a), -24.6, 1.1 + k * 1.05 * math.sin(a)); p1 = (5.3 - (k + 1) * 1.05 * math.cos(a), -24.6, 1.1 + (k + 1) * 1.05 * math.sin(a))
        beam(p0, p1, 0.13, 'paint' if k % 2 else 'brick')
    box((8.2, -25.72, 0), (2.4, 2.4, 2.6), 'plaster', 0.0, 0.04); box((8.2, -25.72, 2.6), (2.8, 2.8, 0.15), 'metal')
    box((8.2, -26.95, 1.0), (1.6, 0.04, 0.9), 'glass'); box((6.98, -25.72, 1.0), (0.04, 1.6, 0.9), 'glass')
    sandbags(-11.0, -28.0, -7.0, -28.0, 4); sandbags(-11.2, -28.0, -11.2, -31.5, 4); sandbags(-7.0, -28.0, -7.0, -30.0, 4)
    burn_barrel(-9.0, -26.6)
    for k in range(5): box((-6.6 + 0.0, -30.6 - k * 0.3, 0), (0.24, 0.24, 0.38), 'brick')    # traffic cones (under knee height)
    car(1.8, -44.0, 0.08); car(-2.5, -42.5, -0.25, True, True); car(8.6, -35.5, -0.4, False, True)
    for x, y in ((-1.5, -46.5), (2.0, -40.0), (-3.5, -35.0)): blob(x, y, random.uniform(0.6, 1.2), 'grime')
    litter(-2.0, -45.0, 2.0, 10); litter(6.5, -34.0, 1.5, 6)
    # ---- hesco walls round the camp, gaps at least 2 m (corners not doubled)
    hesco_row(-30.0, -24.0, -6.0, -24.0, gaps=[(9.0, 11.5)]); hesco_row(6.0, -24.0, 30.0, -24.0, gaps=[(13.5, 16.0)])
    hesco_row(-30.0, -22.9, -30.0, 22.9, gaps=[(14.5, 17.5), (31.0, 33.5)]); hesco_row(30.0, -22.9, 30.0, 22.9, gaps=[(9.5, 12.5), (26.0, 28.5)])
    hesco_row(-28.9, 24.0, -6.0, 24.0, gaps=[(6.5, 9.0)]); hesco_row(6.0, 24.0, 28.9, 24.0, gaps=[(14.0, 16.5)])
    for x, y, r in ((-30.6, -12.0, -math.pi / 2), (30.6, 4.0, math.pi / 2), (-9.5, -24.6, 0.0)): sign(x, y, 1.6, 1.0, 0.6, r, 'paint')
    # ---- COMMAND POST (north): the hut, a radio mast, the generator, cables out to the lights
    command_post(3.0, 15.5); mast(9.4, 18.6, 14.0)
    box((-3.0, 18.6, 0), (2.2, 1.1, 1.3), 'olive' if 'olive' in MI else 'metal', 0.0, 0.04); box((-3.0, 18.6, 1.3), (1.0, 0.5, 0.3), 'grime'); tube((-2.4, 18.8, 1.3), (-2.4, 18.8, 2.4), 0.05, 'grime')
    barrels(-5.6, 17.6, 4, 'rust')
    cable([(-1.9, 18.0), (-1.0, 16.0), (-1.2, 12.0)]); cable([(-3.0, 18.0), (-6.0, 12.0), (-10.0, 7.5), (-11.6, 6.2)])
    # ---- VEHICLE PARK (east): two trucks and the APC under a camo net, a fuel point, tyres, a workbench, tracks and oil
    camo_net(11.5, -3.5, 26.5, 12.5, 3.9)
    truck(15.0, 5.0, 0.0); truck(20.5, 5.5, 0.05); apc(24.0, -0.5, 1.45)
    for x in (12.4, 17.75, 23.2): dashes(x, -3.0, x, 12.0, 0.12, 'paint', 1.5, 1.0)
    for x in (14.4, 15.6, 19.9, 21.1): strip(x, -3.5, x + random.uniform(-0.8, 0.8), -12.0, 0.4, 'dirt', 0.045)
    for x, y in ((15.2, 1.0), (20.4, 0.7), (16.0, 9.5)): blob(x, y, random.uniform(0.5, 0.9), 'grime')
    barrels(25.0, 9.0, 6); tyres(12.4, 10.8, 4); tyres(13.3, 11.4, 3); box((16.5, 11.9, 0), (2.4, 0.8, 0.9), 'wood'); box((15.9, 11.9, 0.9), (0.5, 0.3, 0.25), 'metal')
    pallet(12.8, -1.8, 0.2, 'boxes'); crate(14.6, -2.4, 1.0, 0.1, 'olive' if 'olive' in MI else 'wood')
    floodlight(18.0, -6.5, 800, 7.0, 0.0)
    box((18.0, 3.0, 3.2), (1.0, 0.3, 0.2), 'metal'); box((18.0, 3.0, 3.15), (0.8, 0.2, 0.05), 'emissive_lamp'); box((18.0, 3.0, 3.4), (0.03, 0.03, 0.48), 'metal')
    LIGHTS.append((18.0, 3.0, 2.9, 90, SODIUM))                                            # a work lamp hung under the net
    # ---- HELIPAD (west): pad, H and circle, edge lights, a windsock, the dead helicopter, fuel and ammo by the pad
    for x0, y0, x1, y1 in ((-21.0, -3.0, -20.4, 3.0), (-15.6, -3.0, -15.0, 3.0), (-20.4, -0.3, -15.6, 0.3)): strip((x0 + x1) / 2, y0, (x0 + x1) / 2, y1, x1 - x0, 'paint')
    for k in range(24): a0, a1 = 2 * math.pi * k / 24, 2 * math.pi * (k + 0.6) / 24; strip(-18 + 5.6 * math.cos(a0), 5.6 * math.sin(a0), -18 + 5.6 * math.cos(a1), 5.6 * math.sin(a1), 0.25, 'paint')
    for k in range(8): a = 2 * math.pi * (k + 0.5) / 8; box((-18 + 6.6 * math.cos(a), 6.6 * math.sin(a), 0), (0.2, 0.2, 0.25), 'emissive_sign' if k % 3 == 0 else 'glass')
    helicopter(-17.0, 1.0, 0.4)
    cyl((-26.0, 8.0, 0), 0.08, 6.0, 'metal', 6)
    beam((-26.0, 8.0, 5.7), (-24.4, 8.3, 5.3), 0.3, 'brick')                             # the windsock, hanging limp
    box((-23.5, -6.0, 0), (3.6, 2.4, 0.42), 'grime', 0.1, 0.15)                          # a fuel bladder (0.42 m: step over)
    for k in range(3): crate(-13.0 + k * 1.15, -5.6, 0.9, 0.05, 'olive' if 'olive' in MI else 'wood')
    floodlight(-24.5, 4.5, 800)
    # ---- SUPPLY DUMP (south-west): crate stacks you cannot see over, sacks you can, drums
    crate_stack(-14.0, -21.0, 0.0, 3); crate_stack(-9.0, -18.5, 0.3, 2); crate_stack(-15.5, -14.0, -0.2, 3)
    for x, y, r in ((-11.0, -14.0, 0.0), (-12.5, -11.2, 0.4), (-7.5, -21.5, 0.1)): pallet(x, y, r, 'sacks')
    pallet(-7.0, -14.5, 0.6, 'boxes'); barrels(-17.4, -18.0, 4)
    floodlight(-11.0, -9.0, 800, 7.0, 0.3)
    # ---- MORTAR PIT (south-east inside): a ring of bags with a 2 m way in, the tube, ammo boxes
    for k in range(9):
        a0, a1 = 2 * math.pi * k / 11 + 0.4, 2 * math.pi * (k + 1) / 11 + 0.4
        sandbags(11.0 + 2.6 * math.cos(a0), -18.0 + 2.6 * math.sin(a0), 11.0 + 2.6 * math.cos(a1), -18.0 + 2.6 * math.sin(a1), 4)
    tube((11.0, -18.0, 0.2), (11.4, -17.4, 1.3), 0.07, 'metal'); box((11.0, -18.0, 0), (0.6, 0.6, 0.2), 'metal')
    for k in range(3): box((9.8 + k * 0.5, -19.2, 0), (0.4, 0.25, 0.25), 'olive' if 'olive' in MI else 'wood')
    # ---- tents and towers inside the walls
    for x, y, rz, lit in ((-22.0, 14.0, 0.0, True), (-13.5, 14.0, 0.0, False), (-22.5, -14.0, 0.0, True), (20.0, -15.5, math.pi / 2, True)): tent(x, y, rz, lit=lit)
    tower(-26.0, -20.0); tower(26.0, 20.0)
    # ---- the open middle: a flagpole and two low bag walls (cover at waist height), ground scuffs
    cyl((0.0, 5.5, 0), 0.06, 9.0, 'metal', 6); box((0.0, 5.5, 0), (0.8, 0.8, 0.3), 'concrete'); box((0.45, 5.5, 7.6), (0.8, 0.02, 0.6), 'brick')
    sandbags(-8.5, -3.0, -6.0, -6.0, 4); sandbags(6.5, 3.5, 8.0, 6.5, 4)
    for x, y in ((-3.0, -8.0), (5.0, -6.0), (-9.0, 4.0), (2.0, 9.0)): blob(x, y, random.uniform(0.8, 1.6), 'grime', 12, 0.4)
    # ---- OUTSIDE THE WALLS: a refugee camp (north-east), tank traps (east), a gun nest and wire (west), a container stack (north-west)
    for x, y, r in ((33.0, 31.0, 0.3), (38.0, 34.0, -0.4), (41.0, 29.5, 0.9), (35.5, 39.0, 0.1), (42.0, 40.0, -0.2)):
        for s in (-1, 1):
            bx, by = P(x, y, r, s * 1.1, 0); beam((bx, by, 0), (bx, by, 2.36), 0.06, 'wood')
            bx, by = P(x, y, r, s * 1.1, 1.38); beam((bx, by, 0), (bx, by, 1.52), 0.06, 'wood')
        x2, y2 = P(x, y, r, 0, 1.4); before = set(bm.faces)
        bmesh.ops.create_cube(bm, size=1.0, matrix=T(*P(x, y, r, 0, 0.7), 1.97) @ Rz(r) @ Rx(-0.55) @ Matrix.Diagonal((2.6, 1.7, 0.03, 1)))
        for f in [f for f in bm.faces if f not in before]: f.material_index = MI['sandbag' if random.random() < 0.5 else 'plaster']
        litter(*P(x, y, r, 0, -1.5), 1.2, 6)
    burn_barrel(37.5, 31.5, 60); car(41.0, 35.5, 1.2, True, True); tyres(31.0, 36.0, 2); crate(34.0, 43.0, 0.8, 0.3, 'wood')
    blob(37.5, 31.5, 1.6, 'grime')
    for x, y in ((35.0, 8.0), (38.5, 5.5), (42.0, 8.5), (36.5, 1.5), (40.5, -1.0), (35.0, -5.0), (39.5, -8.0), (43.0, -4.5), (37.0, -12.5), (41.5, -14.0)): czech(x, y, random.uniform(0, 3), 1.6)
    sandbags(-40.0, -4.0, -36.3, -4.0, 4); sandbags(-40.0, 4.0, -36.3, 4.0, 4); sandbags(-36.0, -4.0, -36.0, -1.0, 4); sandbags(-36.0, 1.0, -36.0, 4.0, 4)
    tube((-37.0, 0.0, 1.0), (-35.6, 0.0, 1.15), 0.05, 'metal'); box((-37.4, 0.0, 0.0), (0.5, 0.5, 1.0), 'metal'); burn_barrel(-39.0, 2.6)
    wire_coil(-42.0, -16.0, -42.0, -8.0); wire_coil(-42.0, 8.0, -42.0, 16.0)
    box((-40.0, 30.0, 0), (2.44, 6.06, 2.59), 'metal', 0.0, 0.03); box((-40.0, 30.0, 2.6), (2.44, 6.06, 2.59), 'rust', 0.04, 0.03)
    box((-35.5, 28.5, 0), (2.44, 6.06, 2.59), 'olive' if 'olive' in MI else 'metal', 0.1, 0.03)
    truck(-36.0, -38.0, 0.8, True); burn_barrel(-33.5, -35.5)
    for x, y in ((-40.0, -12.0), (40.0, 30.0)): box((x, y, 0), (2.44, 6.06, 2.59), 'metal', random.uniform(0, 1), 0.03)
    car(-20.0, 40.0, 1.9, True); car(20.0, -40.0, 0.6, False, True)
    for x, y in ((-34.0, 20.0), (34.0, -24.0), (-20.0, -36.0), (18.0, 36.0), (-42.0, -26.0)): heap((x, y, 0), random.uniform(1.0, 2.0), random.uniform(0.8, 1.5), 0.25, 'dirt', random.uniform(0, 3))
    for x, y in ((-30.0, 34.0), (24.0, 32.0), (-26.0, -32.0), (30.0, -34.0)): litter(x, y, 1.5, 7)
    # ---- power line along the road: poles with sagging wires (overhead), and the outer floodlights
    for y in range(-44, 37, 16):
        cyl((-6.5, y, 0), 0.12, 7.5, 'wood', 6); box((-6.5, y, 7.0), (1.4, 0.1, 0.1), 'wood')
    for y0 in range(-44, 21, 16):
        for dx in (-0.6, 0.6):
            for k in range(4):
                t0, t1 = k / 4, (k + 1) / 4; s0, s1 = 0.6 * 4 * t0 * (1 - t0), 0.6 * 4 * t1 * (1 - t1)
                beam((-6.5 + dx, y0 + 16 * t0, 7.1 - s0), (-6.5 + dx, y0 + 16 * t1, 7.1 - s1), 0.02, 'grime')
    floodlight(-3.0, 11.0, 800, 7.0, 0.4)
    floodlight(-38.0, -30.0, 900); floodlight(38.0, 38.0, 800); floodlight(-40.0, 38.0, 700, 7.0, 0.0, False); floodlight(40.0, -20.0, 800)
    log('map', len(bm.faces), 'faces')
def post_lights():
    so = bpy.data.objects['Sun']; so.data.energy = 0.3; so.data.color = (0.55, 0.66, 1.0)
    so.rotation_euler = Vector((0.45, -0.55, -0.70)).normalized().to_track_quat('-Z', 'Y').to_euler()      # a high moon
    bg = next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND'); bg.inputs['Strength'].default_value = 0.22

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
    w = bpy.data.worlds.get('outpost_sky') or bpy.data.worlds.new('outpost_sky'); scene.world = w; w.use_nodes = True; nt = w.node_tree
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
    img = bpy.data.images.new('outpost_light', size, size, alpha=False, float_buffer=True)
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
    path = os.path.join(TEXDIR, 'outpost_light.exr'); img.filepath_raw = path; img.file_format = 'OPEN_EXR'; img.save()
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
me = bpy.data.meshes.new('outpost'); bm.to_mesh(me); bm.free()
for m in mats: me.materials.append(m)
uv_world(me)
mc = bpy.data.collections.new('map'); scene.collection.children.link(mc)
ob = bpy.data.objects.new('outpost', me); mc.objects.link(ob)
me.calc_loop_triangles(); log('outpost', len(me.loop_triangles), 'triangles,', len(me.vertices), 'verts')
lu = me.uv_layers.new(name='Lightmap'); me.uv_layers.active = lu
from mapkit import lightmap_uv; lightmap_uv(ob, log)
uvd = me.uv_layers['Lightmap']; me.uv_layers.active = me.uv_layers['UVMap']
lights(); post_lights()
def reach_check(ob):
    """walkable cells on a 0.5 m grid (nothing solid between 0.45 m and head height, not inside a solid), flood filled from mid-street"""
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get(); bvh = BVHTree.FromObject(ob, dg)
    xs = np.arange(-50.0, 50.0 + 0.01, 0.5); ys = np.arange(-50.0, 50.0 + 0.01, 0.5); walk = np.zeros((len(xs), len(ys)), bool)
    for i, x in enumerate(xs):
        for j, y in enumerate(ys):
            ok = True
            for dx, dy in ((0, 0), (0.2, 0.2), (-0.2, 0.2), (0.2, -0.2), (-0.2, -0.2)):
                h = bvh.ray_cast(Vector((x + dx, y + dy, 2.15)), Vector((0, 0, -1)), 3.0)
                if h[0] is None or h[0].z > 0.45 or h[1].z < 0: ok = False; break
            walk[i, j] = ok
    seen = np.zeros_like(walk); st = [(int((0 + 50.0) / 0.5), int((0 + 50.0) / 0.5))]
    while st:
        i, j = st.pop()
        if i < 0 or j < 0 or i >= len(xs) or j >= len(ys) or seen[i, j] or not walk[i, j]: continue
        seen[i, j] = True; st += [(i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)]
    lost = walk & ~seen; pts = [(float(xs[i]), float(ys[j])) for i, j in zip(*np.nonzero(lost))]
    log('reach: %d walkable cells, %d reached, %d cut off' % (walk.sum(), seen.sum(), lost.sum()), pts[:8])
reach_check(ob)
if 'nobake' not in OPT: bake(ob, 2048, int(OPT.get('samples', 40)))
cfg = {'blend': 'outpost.blend', 'out': '../../Ashfall/assets/outpost', 'world': {'collections': ['map'], 'lightmap': 'tex/outpost_light.exr', 'lmSize': 2048},
       'grid': {'cell': 0.25}, 'probes': {'cell': 1.0, 'height': 1.0, 'samples': 96}, 'sky': {'width': 1024}, 'maxTexture': 1024}
with open(os.path.join(BASE, 'outpost.export.json'), 'w') as f: json.dump(cfg, f, indent=1)
bpy.ops.wm.save_mainfile(); log('saved', bpy.data.filepath)
if 'preview' in OPT:
    cd = bpy.data.cameras.new('st_cam'); cam = bpy.data.objects.new('st_cam', cd); scene.collection.objects.link(cam); scene.camera = cam
    cd.sensor_fit = 'VERTICAL'; cd.angle_y = math.radians(50)
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 24
    try: scene.cycles.use_denoising = True
    except Exception: pass
    scene.render.resolution_x, scene.render.resolution_y = 480, 270
    views = [((0, 0, 1.6), (0, 40, 2.0)), ((0, -45, 1.6), (0, -20, 1.5)), ((-18, 8, 1.6), (-22, 20, 1.5)), ((-6, -6, 1.6), (-18, 0, 1.5)),
             ((20, 14, 1.6), (26, 20, 4.0)), ((40, -44, 1.6), (-40, -44, 1.6))]
    big = np.ones((3 * 270, 2 * 480, 4), np.float32)
    for i, (p, t) in enumerate(views):
        cam.location = p; cam.rotation_euler = (Vector(t) - Vector(p)).to_track_quat('-Z', 'Y').to_euler()
        tmp = os.path.join(CACHE, '_st%d.png' % i); scene.render.filepath = tmp; bpy.ops.render.render(write_still=True)
        im = bpy.data.images.load(tmp); a = np.array(im.pixels[:], np.float32).reshape(270, 480, 4); bpy.data.images.remove(im); os.remove(tmp)
        r, c = divmod(i, 2); big[(2 - r) * 270:(3 - r) * 270, c * 480:(c + 1) * 480] = a
    im = bpy.data.images.new('st_grid', 960, 810); im.pixels.foreach_set(big.ravel()); im.filepath_raw = os.path.join(CACHE, 'outpost_views.png'); im.file_format = 'PNG'; im.save()
    log('preview outpost_views.png')
log('done')
