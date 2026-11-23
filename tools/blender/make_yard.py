# ASHFALL map "THE YARD": a walled freight / rail yard at ashen dusk (about 100 x 90 m), in art/ashfall/yard.blend.
#   blender -b art/ashfall/yard.blend -P tools/blender/make_yard.py -- [nobake] [preview]   (first time: --factory-startup)
# then node tools/export-art.mjs yard -> Ashfall/assets/yard.hgm. Same pipeline as make_street.py (one mesh, tiling UVs, packed Lightmap UV, Cycles bake
# into art/ashfall/tex/yard_light.exr, a reachability check). Layout: two rail lines along the north side (box cars, a walk-through open car, a flatcar
# with a container, a locomotive), container stacks with lanes under a gantry crane (south-west), an open-sided warehouse with half walls, crates and
# a raised loading platform with a ramp (south-east), a fuel point (north-west), the gate and guard hut in the west wall, scrap piles, floodlights,
# an open middle with a few low covers, a 3 m lane inside the walls all round.
import bpy, bmesh, math, os, sys, json, random
import numpy as np
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hgkit import log, vnoise, fbm, save_image, smart_uv, T, Rz, Rx, Ry, grit, gravel_px, separate_coplanar, collapse_thin_lightmap, lightmap_weight, relight_black_faces
def Rx(a): return Matrix.Rotation(a, 4, 'X')        # radians here (hgkit's take degrees)
def Ry(a): return Matrix.Rotation(a, 4, 'Y')
def Rz(a): return Matrix.Rotation(a, 4, 'Z')

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OPT = dict((a.split('=', 1) + ['1'])[:2] for a in ARGV)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = os.path.join(ROOT, 'art', 'ashfall'); TEXDIR = os.path.join(BASE, 'tex'); CACHE = os.path.join(BASE, '_cache'); PROOF = os.path.join(ROOT, 'art', 'proof', 'tex')
for d in (TEXDIR, CACHE): os.makedirs(d, exist_ok=True)
scene = bpy.context.scene
if not bpy.data.filepath.replace('\\', '/').endswith('art/ashfall/yard.blend'):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, 'yard.blend')); log('created', bpy.data.filepath)
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
    import ash_paint; ash_paint.repaint(PICS, save_image, dust, TEXDIR, 'street_', 'yard')      # painted metal and old steel, this map's colours (less rust)
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
XH, YH = 50.0, 45.0
def ground():
    GBASE.append(quad(-XH - 0.5, -YH - 0.5, XH + 0.5, YH + 0.5, 'dirt'))
def beam(p0, p1, th, mat):
    p0, p1 = Vector(p0), Vector(p1); d = p1 - p0; L = d.length
    if L < 1e-4: return
    q = d.normalized().to_track_quat('Y', 'Z'); before = set(bm.faces)
    bmesh.ops.create_cube(bm, size=1.0, matrix=T(*((p0 + p1) / 2)) @ q.to_matrix().to_4x4() @ Matrix.Diagonal((th, L, th, 1)))
    for f in [f for f in bm.faces if f not in before]: f.material_index = MI[mat]
def overlay(x0, y0, x1, y1, mat):
    """a ground patch 2 cm up (asphalt road, concrete apron): drawn over the dirt, counted as ground (2 mm flickered)"""
    f = quad(x0, y0, x1, y1, mat, 0.02); return f
def track(y, x0=-48.5, x1=48.5):
    for s in (-0.72, 0.72): box(((x0 + x1) / 2, y + s, 0), (x1 - x0, 0.08, 0.14), 'metal')
    x = x0 + 0.4
    while x < x1: box((x, y, 0), (0.22, 2.4, 0.07), 'wood'); x += 1.25
def bogie(x, y):
    box((x, y, 0.3), (2.0, 2.2, 0.3), 'metal')
    for dx in (-0.7, 0.7):
        for dy in (-0.75, 0.75):
            b0 = set(bm.faces); bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=12, radius1=0.42, radius2=0.42, depth=0.12, matrix=T(x + dx, y + dy, 0.43) @ Rx(math.pi / 2))
            for f in [f for f in bm.faces if f not in b0]: f.material_index = MI['rust']
def boxcar(x, y, L=12.0, mat='rust'):
    box((x, y, 0.0), (L - 1.0, 2.2, 1.1), 'metal')              # chassis down to the ground: a blocker
    box((x, y, 1.1), (L, 3.0, 2.9), mat, 0.0, 0.06); box((x, y, 4.0), (L - 0.2, 2.8, 0.2), 'metal', 0.0, 0.04)
    for sx in (-1, 1): bogie(x + sx * (L / 2 - 2.0), y); box((x + sx * (L / 2 + 0.35), y, 0.85), (0.7, 0.3, 0.25), 'metal')
    for sy in (-1, 1):
        box((x, y + sy * 1.52, 2.3), (2.6, 0.05, 2.3), 'metal')
        for k in range(int(L / 1.2)): box((x - L / 2 + 0.6 + k * 1.2, y + sy * 1.53, 2.5), (0.08, 0.04, 2.8), 'rust')
def walkcar(x, y, L=12.0):
    """an open box car standing on the ground with both side doors open: walk in one side and out the other"""
    for sy in (-1, 1):
        for a, b in ((-L / 2, -1.3), (1.3, L / 2)): box((x + (a + b) / 2, y + sy * 1.45, 0), (b - a, 0.12, 3.6), 'rust')
        box((x, y + sy * 1.45, 2.4), (2.6, 0.12, 1.2), 'rust')
        box((x + 2.6, y + sy * 1.62, 0), (2.5, 0.08, 2.4), 'metal')           # the slid-open door
    for sx in (-1, 1): box((x + sx * L / 2, y, 0), (0.12, 3.0, 3.6), 'rust')
    box((x, y, 3.6), (L + 0.1, 3.1, 0.18), 'metal', 0.0, 0.04)
    box((x - 3.5, y + 0.85, 0), (1.2, 1.0, 1.0), 'wood'); box((x + 4.0, y - 0.85, 0), (1.0, 1.0, 1.2), 'wood')      # against the sides: a clear aisle
def locomotive(x, y, L=16.0):
    box((x, y, 0.0), (L - 2.0, 2.2, 1.2), 'metal'); box((x, y, 1.2), (L, 3.0, 0.25), 'metal')
    box((x - 1.5, y, 1.45), (L - 6.0, 2.4, 2.5), 'rust', 0.0, 0.1); box((x + L / 2 - 2.2, y, 1.45), (3.6, 3.0, 2.9), 'rust', 0.0, 0.08)
    for sy in (-1, 1): box((x + L / 2 - 2.2, y + sy * 1.51, 3.2), (2.4, 0.04, 0.9), 'glass')
    box((x + L / 2 - 0.39, y, 3.2), (0.04, 2.4, 0.9), 'glass'); box((x + L / 2 - 2.2, y, 4.35), (3.8, 3.1, 0.15), 'metal')
    for sx in (-1, 1): bogie(x + sx * (L / 2 - 2.6), y)
    box((x, y, 0.55), (4.0, 2.0, 0.65), 'metal'); box((x + L / 2 + 0.1, y, 1.3), (0.15, 0.5, 0.25), 'emissive_lamp')
    for k in range(4): box((x - L / 2 + 2.0 + k * 1.6, y, 3.95), (0.8, 0.8, 0.12), 'dark' if False else 'metal')
def container(x, y, z, rz=0.0, mat='metal'):
    c, s = math.cos(rz), math.sin(rz)
    box((x, y, z), (2.44, 6.06, 2.59), mat, rz, 0.03)
    for sx in (-1, 1):
        for k in range(9):
            ly = -2.7 + k * 0.675; box((x + c * sx * 1.23 - s * ly, y + s * sx * 1.23 + c * ly, z + 0.15), (0.04, 0.12, 2.3), mat, rz)
    for k in (-0.6, 0.6): box((x - s * 3.04 + c * k, y + c * 3.04 + s * k, z + 0.2), (0.06, 0.06, 2.2), 'rust', rz)
def containers():
    mats = ['metal', 'rust', 'metal', 'rust', 'metal']
    for i, cx in enumerate((-44.0, -38.5, -33.0, -27.5, -22.0, -16.5)):
        for j, cy in enumerate((-36.0, -20.0)):
            if (i, j) in ((2, 1), (4, 0)): continue                 # gaps: more paths through the stacks
            for k in (-1, 1):
                n = random.choice((1, 2, 2, 3)); yy = cy + k * 3.08
                for lev in range(n): container(cx, yy, lev * 2.6, 0.0, mats[(i + j + lev) % 5])
def gantry():
    for x in (-47.6, -12.0):
        for y in (-29.5, -26.5): box((x, y, 0), (0.9, 0.9, 12.0), 'metal')
        box((x, -28.0, 11.2), (1.0, 4.0, 0.8), 'metal')
    box((-29.8, -28.0, 12.0), (36.6, 1.4, 1.3), 'rust', 0.0, 0.05); box((-26.0, -28.0, 10.9), (2.2, 2.0, 1.1), 'metal')
    beam((-26.0, -28.0, 10.9), (-26.0, -28.0, 5.5), 0.06, 'metal'); box((-26.0, -28.0, 5.0), (0.8, 0.5, 0.5), 'rust')
def warehouse():
    x0, x1, y0, y1, H = 14.0, 42.0, -40.0, -14.0, 7.5
    for x in (x0, x0 + 7, x0 + 14, x0 + 21, x1):
        for y in (y0, y1): box((x, y, 0), (0.5, 0.5, H), 'metal')
    for y in (y0 + 6.5, y0 + 13, y0 + 19.5):
        for x in (x0, x1): box((x, y, 0), (0.5, 0.5, H), 'metal')
    box(((x0 + x1) / 2, (y0 + y1) / 2, H), (x1 - x0 + 1.0, y1 - y0 + 1.0, 0.35), 'metal', 0.0, 0.05)
    for x in range(int(x0), int(x1) + 1, 7): box((x, (y0 + y1) / 2, H - 0.6), (0.3, y1 - y0, 0.6), 'rust')
    box((x1 + 0.2, (y0 + y1) / 2 - 6, 0), (0.3, 12.0, 4.0), 'brick')
    for x, y, w, d, h in ((20, -34, 3.0, 1.2, 1.1), (27, -27, 1.2, 4.0, 1.1), (35, -33, 3.6, 1.2, 1.1), (21, -21, 1.2, 3.0, 1.1)):
        box((x, y, 0), (w, d, h), 'concrete', 0.0, 0.03)
    for x, y in ((31.0, -21.0), (24.5, -37.0), (38.5, -24.0), (17.0, -28.0)):
        for k in range(random.randint(2, 3)): box((x + random.uniform(-0.1, 0.1), y + random.uniform(-0.1, 0.1), k * 1.2), (1.2, 1.2, 1.15), 'wood', random.uniform(-0.1, 0.1), 0.02)
    for x, y in ((21, -30), (35, -30), (28, -20)):
        LIGHTS.append((x, y, H - 1.2, 300, (1.0, 0.8, 0.55))); box((x, y, H - 0.9), (0.8, 0.4, 0.12), 'emissive_lamp')
    # raised loading platform along the north side with a ramp at its east end
    box((25.0, -12.4, 0), (18.0, 3.2, 1.2), 'concrete', 0.0, 0.03)
    before = set(bm.faces); vs = [bm.verts.new(p) for p in ((34.0, -14.0, 0.006), (41.0, -14.0, 0.006), (41.0, -10.8, 0.006), (34.0, -10.8, 0.006),
                                                              (34.0, -14.0, 1.2), (34.0, -10.8, 1.2))]
    for idx in ((0, 3, 2, 1), (0, 1, 4), (3, 5, 2), (1, 2, 5, 4), (0, 4, 5, 3)):
        f = bm.faces.new([vs[i] for i in idx]); f.material_index = MI['concrete']
    bmesh.ops.recalc_face_normals(bm, faces=[f for f in bm.faces if f not in before])
def fuel_point():
    for y in (32.0, 38.0):
        b0 = set(bm.faces); bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=16, radius1=1.4, radius2=1.4, depth=9.0, matrix=T(-40.0, y, 2.0) @ Ry(math.pi / 2))
        for f in [f for f in bm.faces if f not in b0]: f.material_index = MI['metal']
        for x in (-43.5, -36.5): box((x, y, 0), (0.6, 2.4, 0.9), 'concrete')
        box((-40.0, y, 0), (8.0, 1.0, 0.6), 'concrete')
    box((-30.0, 32.0, 0), (1.2, 4.0, 0.25), 'concrete'); box((-30.0, 31.2, 0.25), (0.6, 0.8, 1.6), 'metal', 0.0, 0.04); box((-30.0, 32.8, 0.25), (0.6, 0.8, 1.6), 'metal', 0.0, 0.04)
    for x, y in ((-33.0, 30.0), (-33.0, 34.0)): box((x, y, 0), (0.3, 0.3, 4.5), 'metal')
    box((-31.5, 32.0, 4.5), (5.0, 6.0, 0.35), 'metal', 0.0, 0.05); box((-31.5, 32.0, 4.46), (2.0, 0.5, 0.05), 'emissive_lamp'); LIGHTS.append((-31.5, 32.0, 4.0, 150, (1.0, 0.85, 0.6)))
    for x, y in ((-27.0, 37.0), (-26.4, 37.6), (-27.4, 38.2)): cyl((x, y, 0), 0.3, 0.9, 'rust', 12)
def gate_and_hut():
    for y in (-5.2, 1.2): box((-XH + 0.4, y, 0), (0.8, 0.8, 4.4), 'concrete')
    for k in range(9): box((-XH + 0.35, -4.4 + k * 0.62, 0.2), (0.08, 0.08, 3.4), 'metal')
    for z in (0.4, 1.9, 3.4): box((-XH + 0.35, -2.0, z), (0.1, 5.6, 0.1), 'metal')
    x0, x1, y0, y1 = -46.6, -43.0, 3.0, 6.6
    wall_x(x1, y0, y1, 2.8, 'plaster', [(3.9, 5.7)], 0.2); wall_x(x0, y0, y1, 2.8, 'plaster', [], 0.2)
    wall_y(y0, x0, x1, 2.8, 'plaster', [], 0.2); wall_y(y1, x0, x1, 2.8, 'plaster', [], 0.2)
    box(((x0 + x1) / 2, (y0 + y1) / 2, 2.8), (4.2, 4.2, 0.2), 'metal'); box((x1 + 0.12, 5.8, 1.1), (0.04, 0.6, 0.8), 'glass')
    box((-45.6, 4.0, 0), (0.7, 1.4, 0.75), 'wood'); LIGHTS.append((-44.8, 4.8, 2.4, 40, (1.0, 0.8, 0.55))); box((-44.8, 4.8, 2.72), (0.4, 0.4, 0.06), 'emissive_lamp')
    box((-46.0, -1.8, 1.0), (0.12, 3.8, 0.12), 'rust'); box((-46.3, -0.1, 0), (0.25, 0.25, 1.1), 'metal')
def floodlight(x, y):
    cyl((x, y, 0), 0.16, 8.0, 'metal', 8); box((x, y, 8.0), (1.6, 0.3, 0.4), 'metal'); box((x, y, 7.95), (1.4, 0.25, 0.06), 'emissive_lamp')
    LIGHTS.append((x, y, 7.6, 500, (1.0, 0.78, 0.5)))
def truck(x, y, rz):
    c, s = math.cos(rz), math.sin(rz)
    def at(lx, ly): return (x + c * lx - s * ly, y + s * lx + c * ly)
    box((*at(0, 2.6), 0.4), (2.4, 2.2, 2.2), 'rust', rz, 0.08); box((*at(0, -1.2), 0.5), (2.5, 5.5, 0.4), 'metal', rz); box((*at(0, -1.2), 0.9), (2.4, 5.4, 1.6), 'rust', rz, 0.05)
    box((*at(0, 2.6), 0.0), (2.0, 2.0, 0.4), 'metal', rz)
    box((*at(0, -1.2), 0.0), (2.0, 5.0, 0.5), 'metal', rz)
    for lx in (-1.05, 1.05):
        for ly in (2.6, -0.6, -3.0): px, py = at(lx, ly); cyl((px, py, 0.0), 0.5, 0.4, 'rust', 10)
GBASE = []
def wx2(x, y0, y1, h, mat, gaps=(), th=0.3, dh=2.6):
    ys = [y0] + [g for ab in sorted(gaps) for g in ab] + [y1]
    for i in range(0, len(ys), 2):
        a, b = ys[i], ys[i + 1]
        if b - a > 0.01: box((x, (a + b) / 2, 0), (th, b - a, h), mat)
    for a, b in gaps:
        if h > dh: box((x, (a + b) / 2, dh), (th, b - a, h - dh), mat)
def wy2(y, x0, x1, h, mat, gaps=(), th=0.3, dh=2.6):
    xs = [x0] + [g for ab in sorted(gaps) for g in ab] + [x1]
    for i in range(0, len(xs), 2):
        a, b = xs[i], xs[i + 1]
        if b - a > 0.01: box(((a + b) / 2, y, 0), (b - a, th, h), mat)
    for a, b in gaps:
        if h > dh: box(((a + b) / 2, y, dh), (b - a, th, h - dh), mat)
def hlamp(x, y, z, on=True, w=220):
    beam((x, y, z + 0.1), (x, y, z + 1.4), 0.03, 'metal'); cyl((x, y, z), 0.32, 0.18, 'metal', 10)
    if on: cyl((x, y, z - 0.02), 0.22, 0.03, 'emissive_lamp', 10); LIGHTS.append((x, y, z - 0.3, w, (1.0, 0.8, 0.55)))
def engine_shed():
    """a brick engine shed you can fight through: two big doors and a side door each way, a flatcar with an engine block, benches, a crane beam"""
    x0, x1, y0, y1, Hs = 6.0, 30.0, 27.0, 42.0, 6.0
    wy2(y0, x0, x1, Hs, 'brick', [(9.5, 14.5), (19.5, 24.5), (26.8, 28.8)], 0.4, 4.8)
    wy2(y1, x0, x1, Hs, 'brick', [], 0.4); wx2(x0, y0, y1, Hs, 'brick', [(35.6, 38.0)], 0.4); wx2(x1, y0, y1, Hs, 'brick', [(32.6, 34.6)], 0.4)
    box(((x0 + x1) / 2, (y0 + y1) / 2, Hs + 0.01), (x1 - x0 + 0.8, y1 - y0 + 0.8, 0.3), 'metal')
    box(((x0 + x1) / 2, (y0 + y1) / 2, Hs + 0.31), (x1 - x0 - 4.0, 2.0, 0.9), 'glass')                      # roof lantern
    for x in (8.0, 16.0, 26.0):
        for y in (y0 - 0.22, y1 + 0.22): box((x, y, 3.6), (2.4, 0.04, 1.4), 'glass')
    for s in (-0.72, 0.72): box((12.0, 33.0 + s, 0), (0.08, 12.0, 0.14), 'metal')                             # the rails run in through the west door
    box((12.0, 34.0, 0), (2.4, 7.0, 1.0), 'metal'); box((12.0, 34.0, 1.0), (1.8, 3.2, 1.6), 'rust', 0.0, 0.05); cyl((12.0, 36.2, 1.0), 0.5, 1.2, 'metal', 12)
    for x in (17.5, 20.5, 23.5, 26.5): box((x, 41.2, 0), (2.4, 0.9, 0.95), 'wood'); box((x, 41.6, 0.95), (2.4, 0.15, 1.1), 'metal')
    for x, y in ((18.5, 31.0), (22.0, 31.0)): box((x, y, 0), (1.6, 0.9, 1.4), 'metal', 0.0, 0.03); box((x - 0.4, y, 1.4), (0.5, 0.5, 0.4), 'rust')
    for x, y in ((27.5, 38.0), (28.2, 38.6), (27.6, 39.3)): cyl((x, y, 0), 0.3, 0.9, 'rust', 10)
    box((8.0, 40.5, 0), (2.4, 1.0, 2.0), 'metal')
    box(((x0 + x1) / 2, 34.5, 5.0), (x1 - x0 - 0.8, 0.35, 0.5), 'rust'); box((15.0, 34.5, 4.6), (1.0, 0.8, 0.4), 'metal'); beam((15.0, 34.5, 4.6), (15.0, 34.5, 2.6), 0.03, 'metal')
    hlamp(12.0, 30.5, 4.6, True, 260); hlamp(22.0, 38.0, 4.6, False); hlamp(24.0, 30.0, 4.6, True, 200)
def water_tower(x, y):
    for sx in (-1.6, 1.6):
        for sy in (-1.6, 1.6): box((x + sx, y + sy, 0), (0.45, 0.45, 9.0), 'metal')
    for z in (3.0, 6.0):
        for a, b in (((-1.6, -1.6), (1.6, 1.6)), ((-1.6, 1.6), (1.6, -1.6))): beam((x + a[0], y + a[1], z), (x + b[0], y + b[1], z + 2.8), 0.08, 'rust')
    cyl((x, y, 9.0), 2.8, 0.3, 'metal', 16); cyl((x, y, 9.3), 2.6, 3.8, 'rust', 16); cyl((x, y, 13.1), 2.7, 0.4, 'metal', 16)
    beam((x - 2.6, y, 11.0), (x - 4.6, y, 8.4), 0.35, 'metal'); beam((x + 2.0, y + 2.0, 0.0), (x + 2.0, y + 2.0, 13.0), 0.06, 'metal')
def coal_bunkers():
    for x in (-12.0, -6.0, 0.0, 6.0, 12.0): box((x, -41.7, 0), (0.4, 6.4, 2.2), 'concrete')
    for x in (-9.0, -3.0, 3.0, 9.0): heap((x, -42.5, 0), 2.4, 2.4, 1.7, 'dirt'); box((x, -38.4, 0), (5.4, 0.3, 0.3), 'concrete')
    for k, (x, z) in enumerate(((14.0, 0.0), (8.0, 2.2), (2.0, 4.0), (-4.0, 5.2), (-9.5, 5.6))):
        if k: beam((px, -40.0, pz + 0.4), (x, -40.0, z + 0.4), 0.9, 'rust')
        if z > 0.5: box((x, -40.0, 0), (0.3, 0.3, z), 'metal')
        px, pz = x, z
    box((-9.5, -40.0, 5.2), (1.6, 1.6, 1.2), 'metal')
def tanker(x, y, rz):
    c, s = math.cos(rz), math.sin(rz)
    def at(lx, ly): return (x + c * lx - s * ly, y + s * lx + c * ly)
    box((*at(0, 3.4), 0.4), (2.4, 2.0, 2.3), 'rust', rz, 0.08); box((*at(0, -0.8), 0.0), (2.0, 7.0, 0.9), 'metal', rz)
    b0 = set(bm.faces); bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=16, radius1=1.2, radius2=1.2, depth=6.6,
                                              matrix=T(*at(0, -1.0), 2.0) @ Rz(rz) @ Rx(math.pi / 2))
    for f in [f for f in bm.faces if f not in b0]: f.material_index = MI['rust']
    for lx in (-1.05, 1.05):
        for ly in (3.4, -2.6, -4.0): px, py = at(lx, ly); cyl((px, py, 0.0), 0.5, 0.4, 'rust', 10)
def signal_box(x, y):
    """a two-storey signal box: the lower room is open on its west side (1.8 m door), the glazed cabin above is a landmark"""
    wx2(x - 2.5, y - 2.0, y + 2.0, 3.0, 'brick', [(y - 0.9, y + 0.9)], 0.3, 2.4); wx2(x + 2.5, y - 2.0, y + 2.0, 3.0, 'brick', [], 0.3)
    wy2(y - 2.0, x - 2.5, x + 2.5, 3.0, 'brick', [], 0.3); wy2(y + 2.0, x - 2.5, x + 2.5, 3.0, 'brick', [], 0.3)
    box((x, y, 3.01), (6.0, 5.0, 0.25), 'wood'); box((x, y, 3.26), (6.0, 5.0, 0.9), 'brick')
    for sx in (-1, 1): box((x + sx * 2.98, y, 4.16), (0.06, 4.6, 1.4), 'glass')
    for sy in (-1, 1): box((x, y + sy * 2.48, 4.16), (5.6, 0.06, 1.4), 'glass')
    box((x, y, 5.56), (6.6, 5.6, 0.3), 'metal'); box((x + 1.0, y + 1.0, 0), (2.4, 0.6, 1.0), 'metal')
    for k in range(7): box((x - 2.0 + k * 0.6, y + 3.2, 0.0), (0.6, 1.2, 0.45 * (k + 1)), 'concrete')                 # steps up the south side
    box((x + 1.0, y + 0.3, 2.95), (0.3, 0.3, 0.06), 'emissive_lamp'); LIGHTS.append((x + 1.0, y + 0.3, 2.6, 60, (1.0, 0.8, 0.55)))
def catenary():
    """overhead line poles and wires along both tracks"""
    for x in range(-44, 45, 12):
        for y in (11.6, 22.0): box((x, y, 0), (0.3, 0.3, 6.6), 'metal')
        beam((x, 11.6, 6.4), (x, 22.0, 6.4), 0.18, 'rust')
        for ty in (14.0, 19.5): beam((x, ty, 6.3), (x, ty, 5.8), 0.04, 'metal')
    for ty in (14.0, 19.5): beam((-48.0, ty, 5.75), (48.0, ty, 5.75), 0.03, 'metal')
def checkpoint():
    for x, y, L, r in ((-40.5, -7.2, 3.4, 0.0), (-40.5, 3.2, 3.4, 0.0), (-42.4, -5.6, 2.4, 1.57), (-42.4, 1.6, 2.4, 1.57)):
        box((x, y, 0), (L, 0.8, 0.7), 'sandbag', r); box((x, y, 0.7), (L - 0.3, 0.6, 0.25), 'sandbag', r)
    for x, y, r in ((-36.0, -1.0, 0.4), (-33.5, -2.6, -0.3)): box((x, y, 0), (2.8, 0.6, 0.85), 'concrete', r, 0.04)
def wall_dressing():
    """the perimeter wall: lamps on brackets, signs, a pipe run, wire along the top"""
    for k, x in enumerate(range(-40, 41, 16)):
        box((x, YH - 0.35, 3.4), (0.3, 0.7, 0.12), 'metal'); on = k % 2 == 0
        box((x, YH - 0.6, 3.32), (0.35, 0.25, 0.1), 'emissive_lamp' if on else 'glass')
        if on: LIGHTS.append((x, YH - 0.9, 3.0, 90, (1.0, 0.8, 0.55)))
    for x, y, w in ((-20.0, YH - 0.03, 4.0), (30.0, -YH + 0.03, 3.0), (-XH + 0.03, 20.0, 3.0)):
        if abs(y) > 40: box((x, y - 0.0 * 0, 2.6), (w, 0.05, 1.0), 'plaster')
        else: box((x, y, 2.6), (0.05, w, 1.0), 'plaster')
    box((XH - 0.25, 0.0, 2.6), (0.22, 80.0, 0.22), 'rust'); box((XH - 0.25, 0.0, 3.0), (0.16, 80.0, 0.16), 'metal')
    for x in (-XH - 0.3, XH + 0.3): beam((x, -YH, 4.45), (x, YH, 4.45), 0.06, 'rust')
    for y in (-YH - 0.3, YH + 0.3): beam((-XH, y, 4.45), (XH, y, 4.45), 0.06, 'rust')
def ground_detail():
    for y in (-4.12, 0.12):
        for x0 in range(-48, 14, 10): box((x0 + 4.5, y, 0), (8.6, 0.25, 0.15), 'concrete')
    for x0 in range(-46, 13, 6): quad(x0, -2.08, x0 + 3.0, -1.92, 'sandbag', 0.035)                      # painted centre line
    for x, y in ((19.0, -17.0), (33.0, -17.0), (-40.0, 30.0), (-30.0, 40.0), (28.0, -38.0)): quad(x - 0.35, y - 0.35, x + 0.35, y + 0.35, 'metal', 0.035)
    # (no dark patch decals: an opaque quad cannot fade at its edges, they read as holes)
    for x, y, r in ((-10.0, 9.0, 0.2), (-9.0, 10.4, 1.1), (34.0, -8.5, 0.5), (2.0, -18.0, 0.0), (-26.0, 24.0, 0.7)): box((x, y, 0), (1.2, 1.0, 0.15), 'wood', r)
def build():
    ground()
    overlay(-XH, -4.0, 14.0, 0.0, 'asphalt'); overlay(14.0, -42.0, 43.0, -9.0, 'concrete'); overlay(-48.0, 26.0, -24.0, 43.0, 'concrete')
    for x in (-XH - 0.3, XH + 0.3): box((x, 0, 0), (0.6, 2 * YH + 1.2, 4.2), 'brick')
    for y in (-YH - 0.3, YH + 0.3): box((0, y, 0), (2 * XH + 1.2, 0.6, 4.2), 'brick')
    for x in range(-45, 50, 10):
        for y in (-YH - 0.05, YH + 0.05): box((x, y, 4.2), (0.7, 0.7, 0.4), 'concrete')
    track(14.0); track(19.5)
    boxcar(-36.0, 14.0); walkcar(-20.0, 14.0); boxcar(4.0, 14.0, mat='metal'); boxcar(-6.0, 19.5, 11.0)
    locomotive(28.0, 19.5)
    box((10.0, 19.5, 0.0), (9.0, 2.0, 1.1), 'metal'); box((10.0, 19.5, 1.1), (10.0, 2.8, 0.25), 'metal'); container(10.0, 19.5, 1.35, math.pi / 2, 'rust')
    containers(); gantry(); warehouse(); fuel_point(); gate_and_hut()
    for x, y in ((-30.0, 5.0), (30.0, 5.0), (0.0, -30.0), (-10.0, 38.0), (40.0, 38.0), (-44.0, -10.0)): floodlight(x, y)
    # the middle stays open: a few low covers and one wreck
    for x, y, rz in ((-6.0, -6.0, 0.3), (7.0, 4.0, -0.2), (-2.0, 7.5, 1.2), (5.5, -8.0, 0.8)): box((x, y, 0), (3.0, 0.6, 0.9), 'concrete', rz, 0.04)
    truck(16.0, 3.0, 0.4)
    # scrap piles (block) and low ash heaps (walk over)
    for x, y in ((-6.0, 30.0), (-24.0, -6.0), (44.0, -42.0)):
        for k in range(5): box((x + random.uniform(-1.6, 1.6), y + random.uniform(-1.4, 1.4), 0), (random.uniform(0.8, 1.8), random.uniform(0.6, 1.4), random.uniform(0.9, 2.0)), random.choice(['rust', 'metal']), random.uniform(0, 3), 0.0)
    for x, y, rx, ry in ((-9.0, 0.0, 1.6, 2.4), (10.0, -3.0, 1.3, 2.0), (2.0, 24.0, 2.5, 1.2), (-30.0, -2.0, 2.0, 1.0), (32.0, 0.0, 2.2, 1.0), (-14.0, 42.5, 4.0, 1.0)):
        heap((x, y, 0.0), rx, ry, 0.35)
    engine_shed(); water_tower(38.0, 34.0); coal_bunkers(); tanker(-5.0, -22.0, 0.6); signal_box(40.0, 2.0); catenary(); checkpoint(); wall_dressing(); ground_detail()
    log('map', len(bm.faces), 'faces')
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
    w = bpy.data.worlds.get('yard_sky') or bpy.data.worlds.new('yard_sky'); scene.world = w; w.use_nodes = True; nt = w.node_tree
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
    img = bpy.data.images.new('yard_light', size, size, alpha=False, float_buffer=True)
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
    path = os.path.join(TEXDIR, 'yard_light.exr'); img.filepath_raw = path; img.file_format = 'OPEN_EXR'; img.save()
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
_mv, _left = separate_coplanar(bm, fixed=lambda f: f in GBASE, skip=lambda f: f.normal.z < -0.9 and f.calc_center_median().z < 0.05)
log('coplanar overlaps: %d faces moved apart, %d pairs left' % (_mv, _left))
bm.faces.index_update(); GIDX = [f.index for f in GROUND_FACES if f.is_valid and f.calc_area() > 10.0]      # the ground and big floor patches keep floor density; lines and strips get the props' resolution
me = bpy.data.meshes.new('yard'); bm.to_mesh(me); bm.free()
for m in mats: me.materials.append(m)
uv_world(me)
mc = bpy.data.collections.new('map'); scene.collection.children.link(mc)
ob = bpy.data.objects.new('yard', me); mc.objects.link(ob)
me.calc_loop_triangles(); log('yard', len(me.loop_triangles), 'triangles,', len(me.vertices), 'verts')
lu = me.uv_layers.new(name='Lightmap'); me.uv_layers.active = lu
smart_uv(ob, 66, 0.004)
lightmap_weight(ob, GIDX, 2.0)                                                          # props get more of the light picture than the floor
log('thin faces given a neighbour light texel: %d' % collapse_thin_lightmap(ob, 2048, min_width=0.8, max_dist=1.0))
uvd = me.uv_layers['Lightmap']; me.uv_layers.active = me.uv_layers['UVMap']
lights()
def reach_check(ob):
    """walkable cells on a 0.5 m grid (nothing solid between 0.45 m and head height, not inside a solid), flood filled from mid-street"""
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get(); bvh = BVHTree.FromObject(ob, dg)
    xs = np.arange(-50.0, 50.01, 0.5); ys = np.arange(-45.0, 45.01, 0.5); walk = np.zeros((len(xs), len(ys)), bool)
    for i, x in enumerate(xs):
        for j, y in enumerate(ys):
            ok = True
            for dx, dy in ((0, 0), (0.2, 0.2), (-0.2, 0.2), (0.2, -0.2), (-0.2, -0.2)):
                h = bvh.ray_cast(Vector((x + dx, y + dy, 2.15)), Vector((0, 0, -1)), 3.0)
                if h[0] is None or h[0].z > 0.45 or h[1].z < 0: ok = False; break
            walk[i, j] = ok
    seen = np.zeros_like(walk); st = [(int((0 + 50) / 0.5), int((0 + 45) / 0.5))]
    while st:
        i, j = st.pop()
        if i < 0 or j < 0 or i >= len(xs) or j >= len(ys) or seen[i, j] or not walk[i, j]: continue
        seen[i, j] = True; st += [(i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)]
    lost = walk & ~seen; pts = [(float(xs[i]), float(ys[j])) for i, j in zip(*np.nonzero(lost))]
    log('reach: %d walkable cells, %d reached, %d cut off' % (walk.sum(), seen.sum(), lost.sum()), pts[:8])
reach_check(ob)
if 'nobake' not in OPT:
    bake(ob, 2048, int(OPT.get('samples', 40)))
    log('black faces in the open given a lit neighbour texel: %d' % relight_black_faces(ob, os.path.join(TEXDIR, 'yard' + '_light.exr')))
cfg = {'blend': 'yard.blend', 'out': '../../Ashfall/assets/yard', 'world': {'collections': ['map'], 'lightmap': 'tex/yard_light.exr', 'lmSize': 2048},
       'grid': {'cell': 0.25}, 'probes': {'cell': 1.0, 'height': 1.0, 'samples': 96}, 'sky': {'width': 1024}, 'maxTexture': 1024}
with open(os.path.join(BASE, 'yard.export.json'), 'w') as f: json.dump(cfg, f, indent=1)
bpy.ops.wm.save_mainfile(); log('saved', bpy.data.filepath)
if 'preview' in OPT:
    cd = bpy.data.cameras.new('st_cam'); cam = bpy.data.objects.new('st_cam', cd); scene.collection.objects.link(cam); scene.camera = cam
    cd.sensor_fit = 'VERTICAL'; cd.angle_y = math.radians(50)
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 24
    try: scene.cycles.use_denoising = True
    except Exception: pass
    scene.render.resolution_x, scene.render.resolution_y = 480, 270
    views = [((0, -12, 1.6), (0, 30, 2.0)), ((-46, 17, 1.6), (40, 17, 2.0)), ((-30.3, -44, 1.6), (-30.3, -10, 2.0)), ((16, -13, 1.6), (38, -36, 1.5)),
             ((-20, 8, 1.6), (-20, 20, 1.6)), ((-30, 22, 1.6), (-44, 38, 1.5))]
    big = np.ones((3 * 270, 2 * 480, 4), np.float32)
    for i, (p, t) in enumerate(views):
        cam.location = p; cam.rotation_euler = (Vector(t) - Vector(p)).to_track_quat('-Z', 'Y').to_euler()
        tmp = os.path.join(CACHE, '_st%d.png' % i); scene.render.filepath = tmp; bpy.ops.render.render(write_still=True)
        im = bpy.data.images.load(tmp); a = np.array(im.pixels[:], np.float32).reshape(270, 480, 4); bpy.data.images.remove(im); os.remove(tmp)
        r, c = divmod(i, 2); big[(2 - r) * 270:(3 - r) * 270, c * 480:(c + 1) * 480] = a
    im = bpy.data.images.new('st_grid', 960, 810); im.pixels.foreach_set(big.ravel()); im.filepath_raw = os.path.join(CACHE, 'yard_views.png'); im.file_format = 'PNG'; im.save()
    log('preview yard_views.png')
log('done')
