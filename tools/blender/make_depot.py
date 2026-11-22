# ASHFALL map "THE DEPOT": a rail freight warehouse interior (about 50 x 36 m), in art/ashfall/depot.blend.
#   blender -b art/ashfall/depot.blend -P tools/blender/make_depot.py -- [nobake] [preview]   (first time: --factory-startup)
# then node tools/export-art.mjs depot -> Ashfall/assets/depot.hgm. Same pipeline as make_street.py (one mesh, tiling UVs, packed Lightmap UV,
# Cycles bake of diffuse direct + indirect into art/ashfall/tex/depot_light.exr, a reachability check on a 0.5 m grid).
# Layout: big doors rolled shut in the east wall, roof with six skylights (sun shafts), rail track with two freight wagons down the north side,
# four rows of pallet racking (lanes 3.8 m, a cross aisle at x -4..2), crate stacks, ground-level loading bays by the doors (pallets, a forklift,
# drums), an office block in the south-west corner with two rooms. Working lamps hang over the aisles.
import bpy, bmesh, math, os, sys, json, random
import numpy as np
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hgkit import log, vnoise, fbm, save_image, smart_uv, T, Rz, Rx, Ry

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OPT = dict((a.split('=', 1) + ['1'])[:2] for a in ARGV)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = os.path.join(ROOT, 'art', 'ashfall'); TEXDIR = os.path.join(BASE, 'tex'); CACHE = os.path.join(BASE, '_cache'); PROOF = os.path.join(ROOT, 'art', 'proof', 'tex')
for d in (TEXDIR, CACHE): os.makedirs(d, exist_ok=True)
scene = bpy.context.scene
if not bpy.data.filepath.replace('\\', '/').endswith('art/ashfall/depot.blend'):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, 'depot.blend')); log('created', bpy.data.filepath)
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
    for k, (f, amt, tint) in src.items(): PICS[k] = save_image(dust(load_px(f), amt, len(k) * 7, tint), 'depot_' + k, TEXDIR)
    for k, amt in (('plaster', 0.3), ('sandbag', 0.2), ('glass', 0.15), ('dirt', 0.55)): PICS[k] = save_image(dust(painted(k), amt, len(k) * 11), 'depot_' + k, TEXDIR)
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
def ground():
    quad(-25.5, -18.5, 25.5, 18.5, 'concrete')
# ---------------------------------------------------------------- detail pieces
def beam(p0, p1, th, mat, th2=None):
    p0, p1 = Vector(p0), Vector(p1); d = p1 - p0; L = d.length
    if L < 1e-4: return
    q = d.normalized().to_track_quat('Y', 'Z'); before = set(bm.faces)
    bmesh.ops.create_cube(bm, size=1.0, matrix=T(*((p0 + p1) / 2)) @ q.to_matrix().to_4x4() @ Matrix.Diagonal((th, L, th2 or th, 1)))
    for f in [f for f in bm.faces if f not in before]: f.material_index = MI[mat]
def braces(x, y, d, h):
    zs = [0.25 + k * (h - 0.5) / 5 for k in range(6)]
    for k in range(5):
        beam((x, y - d / 2 + 0.05, zs[k]), (x, y + d / 2 - 0.05, zs[k + 1]), 0.05, 'metal') if k % 2 == 0 else beam((x, y + d / 2 - 0.05, zs[k]), (x, y - d / 2 + 0.05, zs[k + 1]), 0.05, 'metal')
def pallet_boards(x, y, rz=0.0):
    c, s = math.cos(rz), math.sin(rz)
    def at(lx, ly): return (x + c * lx - s * ly, y + s * lx + c * ly)
    for lx in (-0.5, 0.0, 0.5): px, py = at(lx, 0); box((px, py, 0), (0.1, 1.0, 0.1), 'wood', rz)
    for ly in (-0.42, -0.21, 0.0, 0.21, 0.42): px, py = at(0, ly); box((px, py, 0.1), (1.2, 0.14, 0.03), 'wood', rz)
def crate_slats(x, y, z, s, rz):
    c, sn = math.cos(rz), math.sin(rz)
    for dx in (-1, 1):
        for dy in (-1, 1):
            lx, ly = dx * s * 0.47, dy * s * 0.47; box((x + c * lx - sn * ly, y + sn * lx + c * ly, z), (0.09, 0.09, s), 'wood', rz)
    for dz in (0.1, s * 0.5, s - 0.1):
        for dy in (-1, 1): ly = dy * s * 0.485; box((x - sn * ly, y + c * ly, z + dz - 0.04), (s * 0.98, 0.04, 0.08), 'wood', rz)
def bogie(x, y, along_x=True):
    box((x, y, 0.35), (2.2, 2.0, 0.3), 'metal')
    for dx in (-0.75, 0.75):
        for dy in (-0.75, 0.75):
            before = set(bm.faces)
            bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=12, radius1=0.42, radius2=0.42, depth=0.12, matrix=T(x + dx, y + dy, 0.43) @ Rx(math.pi / 2))
            for f in [f for f in bm.faces if f not in before]: f.material_index = MI['rust']
    for dy in (-0.98, 0.98): box((x, y + dy, 0.3), (2.0, 0.08, 0.2), 'rust')
def coupler(x, y, sgn):
    box((x + sgn * 0.35, y, 0.85), (0.7, 0.25, 0.2), 'metal'); box((x + sgn * 0.75, y, 0.85), (0.15, 0.4, 0.3), 'rust')
    for dy in (-1.1, 1.1):
        before = set(bm.faces); bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=10, radius1=0.17, radius2=0.17, depth=0.35, matrix=T(x + sgn * 0.17, y + dy, 1.0) @ Ry(math.pi / 2))
        for f in [f for f in bm.faces if f not in before]: f.material_index = MI['metal']
def lamp_shade(x, y, z):
    before = set(bm.faces); bmesh.ops.create_cone(bm, cap_ends=False, cap_tris=False, segments=12, radius1=0.55, radius2=0.14, depth=0.4, matrix=T(x, y, z + 0.2))
    for f in [f for f in bm.faces if f not in before]: f.material_index = MI['metal']
    before = set(bm.faces); bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=12, radius1=0.42, radius2=0.42, depth=0.04, matrix=T(x, y, z + 0.06))
    for f in [f for f in bm.faces if f not in before]: f.material_index = MI['emissive_lamp']
def cable_tray(y, z=7.0):
    box((0, y, z), (49.0, 0.4, 0.06), 'metal');
    for sy in (-0.2, 0.2): box((0, y + sy, z), (49.0, 0.03, 0.12), 'metal')
    for x in range(-23, 24, 4): box((x, y, z), (0.04, 0.04, 8.5 - z - 0.6), 'metal')
def pedestal_desk(x, y, rz=0.0):
    c, s = math.cos(rz), math.sin(rz)
    box((x, y, 0), (1.6, 0.8, 0.74), 'wood', rz); box((x, y, 0.74), (1.7, 0.85, 0.04), 'wood', rz)
    for k in range(3): box((x + c * 0.5 - s * 0.41, y + s * 0.5 + c * 0.41, 0.12 + k * 0.2), (0.4, 0.02, 0.16), 'metal', rz)
    box((x - s * -0.15, y + c * -0.15, 0.78), (0.5, 0.06, 0.32), 'glass', rz); box((x + c * 0.3, y + s * 0.3, 0.78), (0.35, 0.25, 0.03), 'plaster', rz)
def drum_rims(x, y):
    for z in (0.05, 0.45, 0.85):
        before = set(bm.faces); bmesh.ops.create_cone(bm, cap_ends=False, cap_tris=False, segments=12, radius1=0.315, radius2=0.315, depth=0.04, matrix=T(x, y, z))
        for f in [f for f in bm.faces if f not in before]: f.material_index = MI['metal']
def rack(x0, x1, y, h=5.0, d=1.2):
    """pallet racking along x: uprights, beams, a solid bottom row of crates (so it reads as a full blocker), crates above"""
    n = max(2, int((x1 - x0) / 2.7))
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        for s in (-1, 1): box((x, y + s * d / 2, 0), (0.1, 0.1, h), 'metal')
        braces(x, y, d, h)
    for z in (1.6, 3.2, 4.8):
        for s in (-1, 1): box(((x0 + x1) / 2, y + s * d / 2, z), (x1 - x0, 0.08, 0.12), 'rust')
        box(((x0 + x1) / 2, y, z + 0.12), (x1 - x0, d, 0.04), 'wood')
    for i in range(n):
        xa = x0 + (x1 - x0) * (i + 0.5) / n; w = (x1 - x0) / n - 0.25
        box((xa, y, 0), (w, d - 0.1, 1.45), 'wood' if i % 2 else 'plaster')
        for z in (1.76, 3.36):
            if random.random() < 0.8: box((xa + random.uniform(-0.2, 0.2), y, z), (w * random.uniform(0.5, 0.95), d - 0.15, random.uniform(0.6, 1.3)), random.choice(['wood', 'plaster', 'metal']))
def crates(x, y, nx, ny, nz, s=1.2, rz=0.0):
    c, sn = math.cos(rz), math.sin(rz)
    for i in range(nx):
        for j in range(ny):
            hz = random.randint(max(1, nz - 1), nz)
            for k in range(hz):
                dx, dy = (i - (nx - 1) / 2) * s, (j - (ny - 1) / 2) * s
                box((x + c * dx - sn * dy, y + sn * dx + c * dy, k * s), (s * 0.96, s * 0.96, s * 0.96), 'wood', rz, 0.02)
                crate_slats(x + c * dx - sn * dy, y + sn * dx + c * dy, k * s, s * 0.96, rz)
def wagon(x, y, L=12.0):
    box((x, y, 0.9), (2.9, L, 3.2), 'rust', 0.0, 0.08); box((x, y, 4.1), (2.7, L - 0.2, 0.25), 'metal', 0.0, 0.05)
    for s in (-1, 1):
        box((x + s * 1.46, y, 2.0), (0.04, 2.8, 2.2), 'metal')
        for e in (-1, 1):
            for w in (-0.9, 0.9): cyl((x + s * 0.72, y + e * (L / 2 - 1.5) + w, 0.0), 0.42, 0.1, 'metal', 10)
    box((x, y, 0.45), (2.2, L - 1.0, 0.45), 'metal')
def forklift(x, y, rz):
    box((x, y, 0.2), (1.2, 2.2, 1.1), 'metal', rz, 0.06); box((x, y - 0.3, 1.3), (1.1, 1.0, 0.9), 'glass', rz)
    c, s = math.cos(rz), math.sin(rz)
    box((x - s * 1.2, y + c * 1.2, 0), (0.9, 0.12, 2.6), 'rust', rz); box((x - s * 1.6, y + c * 1.6, 0.05), (0.8, 0.9, 0.06), 'rust', rz)
    for sx in (-0.55, 0.55):
        for sy in (-0.7, 0.7): cyl((x + c * sx - s * sy, y + s * sx + c * sy, 0.0), 0.28, 0.25, 'rust', 8)
def drum(x, y): cyl((x, y, 0.0), 0.3, 0.9, random.choice(['rust', 'metal']), 12); drum_rims(x, y)
def pallet(x, y, rz=0.0): pallet_boards(x, y, rz)
def build():
    ground(); H = 8.5
    # shell: walls, the big rolled-shut doors in the east wall, roof with a row of skylight openings (the sun comes in through them)
    for x in (-25.3, 25.3): box((x, 0, 0), (0.6, 37.2, H), 'brick')
    for y in (-18.3, 18.3): box((0, y, 0), (51.2, 0.6, H), 'brick')
    for y in (-9.0, 5.0): box((24.9, y, 0), (0.25, 7.0, 6.0), 'metal'); box((24.9, y, 6.0), (0.4, 7.4, 0.5), 'rust')
    sky = [(-17.0, -1.0), (-6.0, -1.0), (5.0, -1.0), (16.0, -1.0), (-11.0, 10.5), (2.0, 10.5)]
    xs = sorted({-25.6, 25.6} | {x + d for x, _ in sky for d in (-1.5, 1.5)}); ys = sorted({-18.6, 18.6} | {y + d for _, y in sky for d in (-2.0, 2.0)})
    for i in range(len(xs) - 1):
        for j in range(len(ys) - 1):
            cx, cy = (xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2
            if any(abs(cx - x) < 1.5 and abs(cy - y) < 2.0 for x, y in sky): continue
            box((cx, cy, H), (xs[i + 1] - xs[i], ys[j + 1] - ys[j], 0.4), 'metal')
    for x in range(-24, 25, 6): box((x, 0, H - 0.6), (0.3, 36.6, 0.6), 'rust')
    # rail track down the north side with two freight wagons
    quad(-25, 12.4, 25, 16.6, 'dirt', 0.002)
    for s in (-0.72, 0.72): box((0, 14.5 + s, 0), (50.4, 0.08, 0.14), 'metal')
    wagon_along(-13.5, 14.5); wagon_along(2.5, 14.5)
    # racking rows (lanes 3.8 m), a cross aisle at x -4..2, crate stacks to the south-east, the office block in the south-west corner
    for y in (-12.0, -7.0, -2.0, 3.0):
        rack(-14.0, -4.5, y); rack(2.5, 14.0, y)
    crates(19.0, -14.0, 2, 2, 2); crates(19.5, 9.0, 2, 3, 2, rz=0.2); crates(-2.0, 8.0, 2, 1, 2, rz=-0.3); crates(9.0, 8.5, 1, 2, 1)
    # office: x -25..-15, y -18..-8, two rooms, doors to the hall and between the rooms
    wall_x(-15.0, -18.0, -8.0, 3.2, 'plaster', [(-15.5, -13.9)], 0.2); wall_y(-8.0, -25.0, -15.0, 3.2, 'plaster', [(-19.0, -17.4)], 0.2)
    wall_x(-20.0, -18.0, -8.0, 3.2, 'plaster', [(-12.5, -11.0)], 0.2)
    box((-20.0, -13.0, 3.2), (10.0, 10.0, 0.25), 'concrete')
    for y0, y1 in ((-17.4, -15.9), (-13.3, -9.0)): box((-15.0 + 0.11, (y0 + y1) / 2, 1.0), (0.04, y1 - y0, 1.2), 'glass')
    pedestal_desk(-22.5, -16.0); pedestal_desk(-17.5, -10.5); box((-24.5, -12.0, 0), (0.6, 2.4, 1.9), 'metal')
    box((-17.0, -16.5, 0), (0.6, 1.8, 1.4), 'metal')
    for x, y in ((-22.5, -13.0), (-17.5, -13.0)): LIGHTS.append((x, y, 2.9, 90, (1.0, 0.85, 0.65))); box((x, y, 3.17), (0.5, 1.2, 0.05), 'emissive_lamp')
    # loading bays at ground level by the doors: pallets, the forklift, drums
    forklift(20.5, -3.0, math.radians(100))
    for x, y in ((22.5, -12.5), (22.0, -6.0), (21.0, 1.5), (22.5, 7.0), (-1.0, -15.5), (6.0, -15.8), (-10.0, 8.0), (12.0, 10.0)): pallet(x, y, random.uniform(0, 1))
    for x, y in ((17.5, -16.5), (18.2, -16.6), (17.8, -15.9), (-23.5, 4.0), (-23.6, 4.7), (-1.5, -6.0), (0.5, 0.5), (8.0, -16.5), (-8.0, 10.0)): drum(x, y)
    # working lamps hanging over the aisles (and a lit sign by the doors)
    for x, y in ((-9.0, -9.5), (8.0, -9.5), (-9.0, 0.5), (8.0, 0.5), (-1.0, -4.5), (19.0, -3.0), (-6.0, 11.0), (10.0, 11.0)):
        LIGHTS.append((x, y, 6.0, 550, (1.0, 0.82, 0.6))); lamp_shade(x, y, 6.0); box((x, y, 6.35), (0.04, 0.04, H - 6.75), 'metal')
    box((24.7, -2.0, 4.0), (0.12, 3.0, 0.6), 'emissive_sign')
    cable_tray(-9.5); cable_tray(0.5); cable_tray(10.5)
    log('map', len(bm.faces), 'faces')
def wagon_along(x, y, L=12.0):
    """a freight wagon lying along the track (x)"""
    box((x, y, 0.9), (L, 2.9, 3.2), 'rust', 0.0, 0.08); box((x, y, 4.1), (L - 0.2, 2.7, 0.25), 'metal', 0.0, 0.05)
    for s in (-1, 1):
        box((x, y + s * 1.46, 2.0), (2.8, 0.04, 2.2), 'metal')
        for e in (-1, 1):
            for w in (-0.9, 0.9): cyl((x + e * (L / 2 - 1.5) + w, y + s * 0.72, 0.0), 0.42, 0.1, 'metal', 10)
    box((x, y, 0.0), (L - 1.0, 2.2, 0.9), 'metal')          # chassis down to the floor: no walking under the wagon
    for sx in (-1, 1): bogie(x + sx * (L / 2 - 2.0), y); coupler(x + sx * L / 2, y, sx)
    for k in range(int(L / 1.5)): box((x - L / 2 + 0.75 + k * 1.5, y - 1.47, 2.4), (0.08, 0.06, 2.6), 'rust'); box((x - L / 2 + 0.75 + k * 1.5, y + 1.47, 2.4), (0.08, 0.06, 2.6), 'rust')
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
    sd = bpy.data.lights.new('Sun', 'SUN'); sd.energy = 4.0; sd.color = (1.0, 0.62, 0.38); sd.angle = math.radians(2.5)
    so = bpy.data.objects.new('Sun', sd); lc.objects.link(so)
    L = Vector((-0.45, 0.50, -0.74)).normalized()          # high afternoon sun through the skylights: shafts on the floor
    so.rotation_euler = L.to_track_quat('-Z', 'Y').to_euler()
    for i, (x, y, z, w, c) in enumerate(LIGHTS):
        ld = bpy.data.lights.new('lamp%d' % i, 'POINT'); ld.energy = w; ld.color = c; ld.shadow_soft_size = 0.3
        lo = bpy.data.objects.new('lamp%d' % i, ld); lc.objects.link(lo); lo.location = (x, y, z)
    w = bpy.data.worlds.get('depot_sky') or bpy.data.worlds.new('depot_sky'); scene.world = w; w.use_nodes = True; nt = w.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputWorld'); bg = nt.nodes.new('ShaderNodeBackground'); tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); ramp = nt.nodes.new('ShaderNodeValToRGB'); mid = nt.nodes.new('ShaderNodeMapRange')
    nt.links.new(tc.outputs['Normal'], sep.inputs[0]); nt.links.new(sep.outputs['Z'], mid.inputs['Value'])
    mid.inputs['From Min'].default_value = -1; mid.inputs['From Max'].default_value = 1; mid.inputs['To Min'].default_value = 0; mid.inputs['To Max'].default_value = 1
    nt.links.new(mid.outputs['Result'], ramp.inputs['Fac'])
    cr = ramp.color_ramp; cr.elements[0].position = 0.0; cr.elements[0].color = (0.10, 0.08, 0.07, 1); cr.elements[1].position = 1.0; cr.elements[1].color = (0.12, 0.12, 0.14, 1)
    for pos, c in ((0.48, (0.22, 0.16, 0.12)), (0.505, (0.85, 0.48, 0.24)), (0.56, (0.55, 0.36, 0.26)), (0.75, (0.26, 0.22, 0.22))):
        el = cr.elements.new(pos); el.color = (*c, 1)
    nt.links.new(ramp.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = 0.8; nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    scene.view_settings.exposure = 0.0

# ---------------------------------------------------------------- bake the light picture
def bake(ob, size=2048, samples=40):
    me = ob.data; lm = me.uv_layers['Lightmap']; me.uv_layers.active = lm
    img = bpy.data.images.new('depot_light', size, size, alpha=False, float_buffer=True)
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
    path = os.path.join(TEXDIR, 'depot_light.exr'); img.filepath_raw = path; img.file_format = 'OPEN_EXR'; img.save()
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
me = bpy.data.meshes.new('depot'); bm.to_mesh(me); bm.free()
for m in mats: me.materials.append(m)
uv_world(me)
mc = bpy.data.collections.new('map'); scene.collection.children.link(mc)
ob = bpy.data.objects.new('depot', me); mc.objects.link(ob)
me.calc_loop_triangles(); log('depot', len(me.loop_triangles), 'triangles,', len(me.vertices), 'verts')
lu = me.uv_layers.new(name='Lightmap'); me.uv_layers.active = lu
smart_uv(ob, 66, 0.004)
uvd = me.uv_layers['Lightmap']; me.uv_layers.active = me.uv_layers['UVMap']
lights()
def reach_check(ob):
    """walkable cells on a 0.5 m grid (nothing solid between 0.45 m and head height, not inside a solid), flood filled from the cross aisle"""
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get(); bvh = BVHTree.FromObject(ob, dg)
    xs = np.arange(-25.0, 25.01, 0.5); ys = np.arange(-18.0, 18.01, 0.5); walk = np.zeros((len(xs), len(ys)), bool)
    for i, x in enumerate(xs):
        for j, y in enumerate(ys):
            ok = True
            for dx, dy in ((0, 0), (0.2, 0.2), (-0.2, 0.2), (0.2, -0.2), (-0.2, -0.2)):
                h = bvh.ray_cast(Vector((x + dx, y + dy, 2.15)), Vector((0, 0, -1)), 3.0)
                if h[0] is None or h[0].z > 0.45 or h[1].z < 0: ok = False; break
            walk[i, j] = ok
    seen = np.zeros_like(walk); st = [(int((-1 + 25) / 0.5), int((-4.5 + 18) / 0.5))]
    while st:
        i, j = st.pop()
        if i < 0 or j < 0 or i >= len(xs) or j >= len(ys) or seen[i, j] or not walk[i, j]: continue
        seen[i, j] = True; st += [(i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)]
    lost = walk & ~seen; pts = [(float(xs[i]), float(ys[j])) for i, j in zip(*np.nonzero(lost))]
    log('reach: %d walkable cells, %d reached, %d cut off' % (walk.sum(), seen.sum(), lost.sum()), pts[:8])
reach_check(ob)
if 'nobake' not in OPT: bake(ob, 2048, int(OPT.get('samples', 40)))
cfg = {'blend': 'depot.blend', 'out': '../../Ashfall/assets/depot', 'world': {'collections': ['map'], 'lightmap': 'tex/depot_light.exr', 'lmSize': 2048},
       'grid': {'cell': 0.25}, 'probes': {'cell': 1.0, 'height': 1.0, 'samples': 96}, 'sky': {'width': 1024}, 'maxTexture': 1024}
with open(os.path.join(BASE, 'depot.export.json'), 'w') as f: json.dump(cfg, f, indent=1)
bpy.ops.wm.save_mainfile(); log('saved', bpy.data.filepath)
if 'preview' in OPT:
    cd = bpy.data.cameras.new('st_cam'); cam = bpy.data.objects.new('st_cam', cd); scene.collection.objects.link(cam); scene.camera = cam
    cd.sensor_fit = 'VERTICAL'; cd.angle_y = math.radians(50)
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 24
    try: scene.cycles.use_denoising = True
    except Exception: pass
    scene.render.resolution_x, scene.render.resolution_y = 480, 270
    views = [((-1, -16, 1.6), (-1, 10, 2.0)), ((22, -16, 1.6), (0, 10, 2.5)), ((-1, -9.5, 1.6), (-14, -9.5, 1.5)), ((-22, 11, 1.6), (10, 13, 2.0)),
             ((-17, -10, 1.6), (-23, -16, 1.2)), ((10, 8, 1.6), (20, -14, 1.8))]
    big = np.ones((3 * 270, 2 * 480, 4), np.float32)
    for i, (p, t) in enumerate(views):
        cam.location = p; cam.rotation_euler = (Vector(t) - Vector(p)).to_track_quat('-Z', 'Y').to_euler()
        tmp = os.path.join(CACHE, '_st%d.png' % i); scene.render.filepath = tmp; bpy.ops.render.render(write_still=True)
        im = bpy.data.images.load(tmp); a = np.array(im.pixels[:], np.float32).reshape(270, 480, 4); bpy.data.images.remove(im); os.remove(tmp)
        r, c = divmod(i, 2); big[(2 - r) * 270:(3 - r) * 270, c * 480:(c + 1) * 480] = a
    im = bpy.data.images.new('st_grid', 960, 810); im.pixels.foreach_set(big.ravel()); im.filepath_raw = os.path.join(CACHE, 'depot_views.png'); im.file_format = 'PNG'; im.save()
    log('preview depot_views.png')
log('done')
