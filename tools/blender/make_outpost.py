# ASHFALL map "CHECKPOINT 9" in art/ashfall/outpost.blend (made from make_yard.py: same pipeline, its own layout below).
#   blender -b art/ashfall/outpost.blend -P tools/blender/make_outpost.py -- [nobake] [preview]   (first time: --factory-startup)
# then node tools/export-art.mjs outpost -> Ashfall/assets/outpost.hgm
import bpy, bmesh, math, os, sys, json, random
import numpy as np
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hgkit import log, vnoise, fbm, save_image, smart_uv, T, Rz, Rx, Ry
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
    for k, (f, amt, tint) in src.items(): PICS[k] = save_image(dust(load_px(f), amt, len(k) * 7, tint), 'street_' + k, TEXDIR)
    for k, amt in (('plaster', 0.3), ('sandbag', 0.2), ('glass', 0.15), ('dirt', 0.55)): PICS[k] = save_image(dust(painted(k), amt, len(k) * 11), 'street_' + k, TEXDIR)
    log('pictures', len(PICS))
TILE = {'asphalt': 3.5, 'concrete': 2.2, 'brick': 2.4, 'plaster': 2.8, 'metal': 2.5, 'rust': 2.5, 'wood': 2.0, 'sandbag': 1.2, 'glass': 2.5, 'dirt': 6.0}
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
def ground():
    quad(-XH - 0.5, -YH - 0.5, XH + 0.5, YH + 0.5, 'dirt')
def overlay(x0, y0, x1, y1, mat, z=0.002): return quad(x0, y0, x1, y1, mat, z)
def hesco_row(x0, y0, x1, y1, h=1.4, gaps=()):
    L = math.hypot(x1 - x0, y1 - y0); n = max(1, int(L / 1.05)); rz = math.atan2(y1 - y0, x1 - x0)
    for k in range(n):
        t = (k + 0.5) / n
        if any(a <= t <= b for a, b in gaps): continue
        box((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 0), (1.0, 1.0, h), 'sandbag', rz, 0.04)
def fence(x0, y0, x1, y1, gaps=()):
    L = math.hypot(x1 - x0, y1 - y0); n = max(1, int(L / 3.0)); rz = math.atan2(y1 - y0, x1 - x0)
    for k in range(n):
        t0, t1 = k / n, (k + 1) / n
        if any(a <= (t0 + t1) / 2 <= b for a, b in gaps): continue
        xa, ya = x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0; xb, yb = x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1
        cyl((xa, ya, 0), 0.05, 2.6, 'metal', 6)
        box(((xa + xb) / 2, (ya + yb) / 2, 0.05), (L / n, 0.03, 2.4), 'metal', rz)
        box(((xa + xb) / 2, (ya + yb) / 2, 2.55), (L / n, 0.12, 0.12), 'rust', rz)
def tent(x, y, rz, L=8.0, W=5.0):
    """a frame tent: low side walls (blockers), pitched roof, both ends open: walk through it"""
    c, s = math.cos(rz), math.sin(rz)
    def at(lx, ly): return (x + c * lx - s * ly, y + s * lx + c * ly)
    for sx in (-1, 1):
        px, py = at(sx * W / 2, 0); box((px, py, 0), (0.08, L, 1.7), 'sandbag', rz)
        a = at(sx * W / 2, -L / 2); b = at(0, -L / 2)
        before = set(bm.faces); ang = math.atan2(1.3, W / 2)
        pm = at(sx * W / 4, 0); bmesh.ops.create_cube(bm, size=1.0, matrix=T(pm[0], pm[1], 1.7 + 0.65) @ Rz(rz) @ Ry(-sx * ang) @ Matrix.Diagonal((math.hypot(W / 2, 1.3) + 0.1, L, 0.05, 1)))
        for f in [f for f in bm.faces if f not in before]: f.material_index = MI['sandbag']
    for ly in (-L / 2, L / 2):
        for sx in (-1, 1): px, py = at(sx * W / 2, ly); cyl((px, py, 0), 0.06, 1.7, 'wood', 6)
    px, py = at(-1.6, 1.5); box((px, py, 0), (0.8, 1.9, 0.5), 'wood', rz); px, py = at(1.6, -1.5); box((px, py, 0), (0.8, 1.9, 0.5), 'wood', rz)
    px, py = at(0, 0); LIGHTS.append((px, py, 2.3, 25, (1.0, 0.75, 0.45))); box((px, py, 2.9), (0.2, 0.2, 0.2), 'emissive_lamp')
def tower(x, y):
    for dx in (-1.3, 1.3):
        for dy in (-1.3, 1.3): box((x + dx, y + dy, 0), (0.25, 0.25, 6.0), 'wood')
    box((x, y, 6.0), (3.4, 3.4, 0.2), 'wood'); box((x, y, 6.2), (3.4, 3.4, 1.1), 'sandbag', 0.0, 0.05); box((x, y, 8.3), (3.8, 3.8, 0.15), 'metal')
    for dx in (-1.6, 1.6):
        for dy in (-1.6, 1.6): box((x + dx, y + dy, 7.3), (0.1, 0.1, 1.0), 'wood')
    box((x, y, 0.006), (2.6, 2.6, 1.0), 'sandbag')          # sandbagged base between the legs: a blocker you cannot walk under
def truck(x, y, rz):
    c, s = math.cos(rz), math.sin(rz)
    def at(lx, ly): return (x + c * lx - s * ly, y + s * lx + c * ly)
    box((*at(0, 2.6), 0.4), (2.4, 2.2, 2.2), 'metal', rz, 0.08); box((*at(0, -1.2), 0.5), (2.5, 5.5, 0.4), 'metal', rz)
    box((*at(0, -1.2), 0.9), (2.4, 5.4, 2.0), 'sandbag', rz, 0.15); box((*at(0, 2.6), 0.0), (2.0, 2.0, 0.4), 'metal', rz); box((*at(0, -1.2), 0.0), (2.0, 5.0, 0.5), 'metal', rz)
    for lx in (-1.05, 1.05):
        for ly in (2.6, -0.6, -3.0): px, py = at(lx, ly); cyl((px, py, 0.0), 0.5, 0.4, 'rust', 10)
def apc(x, y, rz):
    c, s = math.cos(rz), math.sin(rz)
    def at(lx, ly): return (x + c * lx - s * ly, y + s * lx + c * ly)
    box((*at(0, 0), 0.0), (2.3, 6.2, 0.7), 'metal', rz); box((*at(0, -0.2), 0.7), (2.7, 6.8, 1.4), 'metal', rz, 0.1)
    box((*at(0, 2.9), 0.7), (2.5, 1.2, 1.0), 'metal', rz, 0.1)
    for ly in (-2.4, -0.8, 0.8, 2.4):
        for lx in (-1.3, 1.3): px, py = at(lx, ly); cyl((px, py, 0.0), 0.55, 0.45, 'rust', 10)
    cyl((*at(0, -0.6), 2.1), 0.7, 0.45, 'metal', 12); box((*at(0, 0.6), 2.32), (0.12, 1.8, 0.12), 'metal', rz)
def helicopter(x, y, rz):
    c, s = math.cos(rz), math.sin(rz)
    def at(lx, ly): return (x + c * lx - s * ly, y + s * lx + c * ly)
    box((*at(0, 0), 0.0), (2.0, 4.4, 0.7), 'metal', rz); box((*at(0, 0.2), 0.7), (2.4, 5.0, 1.8), 'metal', rz, 0.3)
    box((*at(0, 2.9), 0.9), (2.0, 1.2, 1.3), 'glass', rz); box((*at(0, -5.0), 1.6), (0.6, 6.0, 0.6), 'metal', rz)
    box((*at(0, -7.6), 1.8), (0.15, 1.2, 1.8), 'metal', rz)
    for lx in (-1.2, 1.2): px, py = at(lx, 0.2); box((px, py, 0.006), (0.12, 4.6, 0.12), 'metal', rz)
    for a in (0.3, 1.9, 3.5, 5.1):
        px, py = at(math.cos(a) * 3.5, 0.2 + math.sin(a) * 3.5); box((px, py, 2.4 - 0.5 * abs(math.sin(a))), (7.0, 0.35, 0.05), 'metal', rz + a)
def floodlight(x, y, w=900):
    cyl((x, y, 0), 0.14, 7.0, 'metal', 8); box((x, y, 7.0), (1.4, 0.4, 0.5), 'metal'); box((x, y, 6.95), (1.2, 0.3, 0.06), 'emissive_lamp')
    LIGHTS.append((x, y, 6.6, w, (1.0, 0.86, 0.66)))
def build():
    ground()
    overlay(-5.0, -XH, 5.0, XH, 'asphalt')                                # the road through the checkpoint
    overlay(-18.0, -18.0, 18.0, 18.0, 'concrete', 0.004) if False else None
    for x in (-XH - 0.6, XH + 0.6): box((x, 0, 0), (1.2, 2 * YH + 2.4, 3.2), 'dirt')
    for y in (-YH - 0.6, YH + 0.6): box((0, y, 0), (2 * XH + 2.4, 1.2, 3.2), 'dirt')
    # perimeter fence 4 m inside the berm, with breaks (enemies come in through them), and the road gate
    fence(-46.0, -46.0, 46.0, -46.0, [(0.18, 0.26), (0.45, 0.55), (0.78, 0.86)]); fence(-46.0, 46.0, 46.0, 46.0, [(0.12, 0.2), (0.45, 0.55), (0.72, 0.8)])
    fence(-46.0, -46.0, -46.0, 46.0, [(0.2, 0.28), (0.5, 0.58), (0.8, 0.88)]); fence(46.0, -46.0, 46.0, 46.0, [(0.15, 0.23), (0.48, 0.56), (0.76, 0.84)])
    # the checkpoint on the road (south): jersey barrier chicane, a barrier pole, a guard booth, hesco walls either side
    for x, y, rz in ((-2.5, -38.0, 0.0), (2.5, -33.0, 0.0), (-2.5, -28.0, 0.0)): box((x, y, 0), (4.5, 0.6, 0.9), 'concrete', rz, 0.04)
    box((0.0, -24.0, 1.0), (9.0, 0.12, 0.12), 'rust'); box((5.0, -24.0, 0), (0.3, 0.3, 1.1), 'metal')
    box((7.5, -26.0, 0), (2.4, 2.4, 2.6), 'plaster', 0.0, 0.04); box((7.5, -26.0, 2.6), (2.8, 2.8, 0.15), 'metal'); floodlight(9.0, -22.0)
    hesco_row(-30.0, -24.0, -6.5, -24.0, gaps=[(0.4, 0.5)]); hesco_row(6.5, -24.0, 30.0, -24.0, gaps=[(0.55, 0.65)])
    hesco_row(-30.0, -24.0, -30.0, 10.0, gaps=[(0.45, 0.56)]); hesco_row(30.0, -24.0, 30.0, 10.0, gaps=[(0.3, 0.4)])
    hesco_row(-30.0, 24.0, -6.5, 24.0, gaps=[(0.3, 0.42)]); hesco_row(6.5, 24.0, 30.0, 24.0, gaps=[(0.6, 0.72)])
    # the camp inside the hesco: tents (walk-through), the vehicle park, the helipad, two watch towers
    for x, y, rz in ((-22.0, 14.0, 0.0), (-14.0, 14.0, 0.0), (-22.0, -14.0, 0.0), (20.0, -14.0, 1.57)): tent(x, y, rz)
    tower(-26.0, -20.0); tower(26.0, 20.0)
    truck(16.0, 6.0, 0.0); truck(21.0, 6.0, 0.05); truck(-36.0, -38.0, 0.8); apc(14.0, -8.0, 1.2)
    overlay(-24.0, -6.0, -12.0, 6.0, 'concrete', 0.002)
    for x0, y0, x1, y1 in ((-20.5, -3.0, -20.0, 3.0), (-16.0, -3.0, -15.5, 3.0), (-20.0, -0.25, -16.0, 0.25)): overlay(x0, y0, x1, y1, 'plaster', 0.004)
    helicopter(-18.0, 0.5, 0.4)
    # sandbag nests and crates for cover; an open middle
    for x, y in ((8.0, 14.0), (-8.0, -12.0), (36.0, -30.0), (-38.0, 30.0)):
        for k in range(3): box((x + random.uniform(-0.2, 0.2), y + k * 1.15, 0), (1.1, 1.1, 1.0), 'wood', random.uniform(-0.2, 0.2), 0.02)
    for x, y, rz in ((0.0, 12.0, 0.0), (-6.0, -6.0, 0.8), (35.0, 0.0, 1.57), (-35.0, 0.0, 1.57)): box((x, y, 0), (3.0, 0.7, 1.0), 'sandbag', rz, 0.1)
    for x, y in ((-40.0, -12.0), (40.0, 30.0), (36.0, -40.0), (-20.0, 40.0)): box((x, y, 0), (2.4, 6.0, 2.6), 'metal', random.uniform(0, 1), 0.03)
    # floodlights: pools of light with dark between
    for x, y in ((-24.0, 4.0), (0.0, 20.0), (24.0, -18.0), (-38.0, -30.0), (38.0, 38.0), (0.0, -42.0), (-40.0, 38.0), (40.0, -8.0)): floodlight(x, y)
    log('map', len(bm.faces), 'faces')
def post_lights():
    so = bpy.data.objects['Sun']; so.data.energy = 0.35; so.data.color = (0.55, 0.66, 1.0)
    so.rotation_euler = Vector((0.45, -0.55, -0.70)).normalized().to_track_quat('-Z', 'Y').to_euler()      # a high moon
    bg = next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND'); bg.inputs['Strength'].default_value = 0.12

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
me = bpy.data.meshes.new('outpost'); bm.to_mesh(me); bm.free()
for m in mats: me.materials.append(m)
uv_world(me)
mc = bpy.data.collections.new('map'); scene.collection.children.link(mc)
ob = bpy.data.objects.new('outpost', me); mc.objects.link(ob)
me.calc_loop_triangles(); log('outpost', len(me.loop_triangles), 'triangles,', len(me.vertices), 'verts')
lu = me.uv_layers.new(name='Lightmap'); me.uv_layers.active = lu
smart_uv(ob, 66, 0.004)
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
