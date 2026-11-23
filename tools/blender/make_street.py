# ASHFALL map "MAIN STREET": a small-town street buried in ash at dusk, in art/ashfall/street.blend.
#   blender -b art/ashfall/street.blend -P tools/blender/make_street.py -- [nobake] [preview]
#   (first time: blender -b --factory-startup -P tools/blender/make_street.py)
# then  node tools/export-art.mjs street  ->  Ashfall/assets/street.hgm (+ pictures)
# The file is this script's own: every run deletes all objects, rebuilds the map as one mesh (collection `map`, one material per
# picture, tiling UVs `UVMap` in world metres, a packed `Lightmap` UV), the lights (collection `lights`: low orange sun, warm point
# lights), the dusk sky (world `street_sky`), the ash-dusted pictures (art/ashfall/tex/street_*.png, made from the yard's pictures
# plus a few painted here) and bakes the light picture art/ashfall/tex/street_light.exr (Cycles: diffuse direct + indirect, no colour).
# Layout (x across the street, y along it; ground z = 0; playable about 44 x 70 m):
#   street x -5..5, sidewalks to +-8, shop rows x -16..-8 and 8..16, back lot (west) and service lane (east) behind them, alleys
#   through at y -14..-12 / 0..2.5 (west) and -16..-13.5 / 10..12.5 (east), open shops with a room, a counter and a back door:
#   W2 (y -12..0), W4 (14..24), E2 (-13.5..-2); petrol station with canopy at the north end (y 24..35); collapsed building (rubble)
#   closing the south end (y < -26); a boundary wall all round.
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
BLOOM = 'plain' not in OPT       # the glowing-growth night look (ash_paint.py, see make_yard.py); `plain` builds the old look exactly as before
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = os.path.join(ROOT, 'art', 'ashfall'); TEXDIR = os.path.join(BASE, 'tex'); CACHE = os.path.join(BASE, '_cache'); PROOF = os.path.join(ROOT, 'art', 'proof', 'tex')
for d in (TEXDIR, CACHE): os.makedirs(d, exist_ok=True)
scene = bpy.context.scene
if not bpy.data.filepath.replace('\\', '/').endswith('art/ashfall/street.blend'):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, 'street.blend')); log('created', bpy.data.filepath)
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
    import ash_paint; ash_paint.repaint(PICS, save_image, dust, TEXDIR, 'street_', 'street')      # painted metal and old steel, this map's colours (less rust)
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

# ---- ground
def ground():
    for x0, x1 in ((-23, -16), (16, 23)): quad(x0, -36, x1, 24, 'dirt')
    quad(-16, -36, -8, -26, 'dirt'); quad(8, -36, 16, -26, 'dirt')
    quad(-5, -36, 5, 24, 'asphalt'); quad(-8, -36, -5, 24, 'concrete'); quad(5, -36, 8, 24, 'concrete')
    # ground only where you can walk: alleys and the open shops' rooms (none under the closed blocks: they must read as solid)
    for y0, y1 in ((-14, -12), (-12, 0), (0, 2.5), (14, 24)): quad(-16, y0, -8, y1, 'concrete')
    for y0, y1 in ((-16, -13.5), (-13.5, -2), (10, 12.5)): quad(8, y0, 16, y1, 'concrete')
    quad(-23, 24, 23, 36, 'concrete')
# ---- buildings: a closed block with a shop front on the street side (side = +1 for the west row facing +x, -1 east facing -x)
def facade(xf, y0, y1, side, h, sign=None, awning=True):
    d = 0.06 * side
    for k in range(int((y1 - y0 - 1.0) // 3.2)):
        yc = y0 + 1.6 + 1.6 + k * 3.2
        if yc + 1.3 > y1 - 0.5: break
        box((xf + d, yc, 0.9), (0.06, 2.4, 1.6), 'glass'); box((xf + d * 1.5, yc, 0.75), (0.1, 2.6, 0.15), 'wood')
        box((xf + d, yc, 3.8), (0.06, 1.2, 1.4), 'glass'); box((xf + d * 1.5, yc, 3.7), (0.12, 1.4, 0.1), 'plaster')
    if sign: box((xf + d * 2, (y0 + y1) / 2, 2.85), (0.12, min(5.0, y1 - y0 - 2), 0.7), sign)
    if awning:
        before = set(bm.faces); box((xf + side * 0.8, (y0 + y1) / 2, 2.55), (1.6, y1 - y0 - 0.6, 0.08), 'metal')
    box((xf + d, (y0 + y1) / 2, h - 0.3), (0.1, y1 - y0, 0.3), 'brick')
def block(x0, x1, y0, y1, h, side, mat='brick', sign=None, awning=True):
    box(((x0 + x1) / 2, (y0 + y1) / 2, 0), (x1 - x0, y1 - y0, h), mat)
    facade(x1 if side > 0 else x0, y0, y1, side, h, sign, awning)
def open_shop(x0, x1, y0, y1, h, side, door, back_door=None, counter=None, mat='plaster', sign=None):
    xf, xb = (x1, x0) if side > 0 else (x0, x1)
    wall_x(xf, y0, y1, h, mat, [door]); wall_x(xb, y0, y1, h, 'brick', [back_door] if back_door else [])
    wall_y(y0 + 0.15, x0, x1, h, 'brick'); wall_y(y1 - 0.15, x0, x1, h, 'brick')
    box(((x0 + x1) / 2, (y0 + y1) / 2, 3.3), (x1 - x0, y1 - y0, 0.3), 'concrete'); box(((x0 + x1) / 2, (y0 + y1) / 2, h - 0.3), (x1 - x0, y1 - y0, 0.3), 'concrete')
    d = 0.06 * side
    for a, b in ((y0 + 0.6, door[0] - 0.5), (door[1] + 0.5, y1 - 0.6)):
        if b - a > 1.2: box((xf + d, (a + b) / 2, 0.9), (0.06, b - a, 1.5), 'glass')
    if sign: box((xf + d * 2, (y0 + y1) / 2, 2.85), (0.12, min(5.0, y1 - y0 - 2), 0.7), sign)
    box((xf + side * 0.8, (y0 + y1) / 2, 2.55), (1.6, y1 - y0 - 0.6, 0.08), 'metal')
    if counter:
        cx, cy, l = counter; box((cx, cy, 0), (0.8, l, 1.0), 'wood'); box((cx, cy, 1.0), (0.95, l + 0.1, 0.06), 'wood')
    shelf_x = xb + (0.5 if side > 0 else -0.5)
    box((shelf_x, (y0 + y1) / 2 - 1.5, 0), (0.6, 3.0, 1.9), 'wood')
    LIGHTS.append(((x0 + x1) / 2, (y0 + y1) / 2, 2.9, 60, (1.0, 0.75, 0.45)))
    box(((x0 + x1) / 2, (y0 + y1) / 2, 3.18), (0.6, 1.2, 0.08), 'emissive_lamp')
def car(x, y, rz, mat='rust'):
    box((x, y, 0.25), (1.85, 4.3, 0.75), mat, rz, 0.06)
    box((x, y, 1.0), (1.6, 2.2, 0.55), mat, rz, 0.08)
    c, s = math.cos(rz), math.sin(rz)
    for dy in (-0.25, 0.25): box((x - s * dy * 4, y + c * dy * 4, 1.05), (1.62, 0.06, 0.45), 'glass', rz)
    for sx in (-0.85, 0.85):
        for sy in (-1.35, 1.35): cyl((x + c * sx - s * sy, y + s * sx + c * sy, 0.0), 0.32, 0.3, 'rust', 8)
    box((x, y, 1.56), (1.4, 1.8, 0.05), 'dirt', rz)
def bus(x, y, rz):
    box((x, y, 0.35), (2.55, 11.0, 2.75), 'metal', rz, 0.12)
    c, s = math.cos(rz), math.sin(rz)
    for side in (-1, 1):
        for k in range(6):
            dy = -4.2 + k * 1.6; box((x + c * side * 1.29 - s * dy, y + s * side * 1.29 + c * dy, 1.75), (0.06, 1.3, 0.9), 'glass', rz)
    for sx in (-1.1, 1.1):
        for sy in (-3.8, 3.8): cyl((x + c * sx - s * sy, y + s * sx + c * sy, 0.0), 0.5, 0.4, 'rust', 10)
    box((x, y, 3.1), (2.2, 9.0, 0.08), 'dirt', rz)
def sandbags(x0, y0, x1, y1, h=1.0):
    L = math.hypot(x1 - x0, y1 - y0); rz = math.atan2(y1 - y0, x1 - x0) - math.pi / 2
    box(((x0 + x1) / 2, (y0 + y1) / 2, 0), (0.7, L, h), 'sandbag', rz, 0.12)
LIGHTS = []
# ---------------------------------------------------------------- detail pass (what the eye lands on)
FONT = {'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], 'C': ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
        'D': ['11110', '10001', '10001', '10001', '10001', '10001', '11110'], 'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
        'F': ['11111', '10000', '10000', '11110', '10000', '10000', '10000'], 'G': ['01111', '10000', '10000', '10011', '10001', '10001', '01111'],
        'H': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'], 'I': ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
        'L': ['10000', '10000', '10000', '10000', '10000', '10000', '11111'], 'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
        'N': ['10001', '11001', '10101', '10011', '10001', '10001', '10001'], 'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
        'P': ['11110', '10001', '10001', '11110', '10000', '10000', '10000'], 'R': ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
        'S': ['01111', '10000', '10000', '01110', '00001', '00001', '11110'], 'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
        'U': ['10001', '10001', '10001', '10001', '10001', '10001', '01110'], 'W': ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
        'Y': ['10001', '10001', '01010', '00100', '00100', '00100', '00100'], 'K': ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
        'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'], ' ': ['00000'] * 7}
def lettering(text, xf, yc, z, side, px=0.07, mat='emissive_sign'):
    """block letters on a sign board facing the street (x = xf, centred at y = yc, bottom at z): each lit pixel a small box,
    horizontal runs merged into one box"""
    w = len(text) * 6 * px; y0 = yc - side * (-w / 2)
    for ci, ch in enumerate(text):
        rows = FONT.get(ch, FONT[' '])
        for r, row in enumerate(rows):
            c = 0
            while c < 5:
                if row[c] == '1':
                    e = c
                    while e + 1 < 5 and row[e + 1] == '1': e += 1
                    ya = y0 - side * ((ci * 6 + c) * px); yb = y0 - side * ((ci * 6 + e + 1) * px)
                    box((xf + side * 0.1, (ya + yb) / 2, z + (6 - r) * px), (0.04, abs(yb - ya) - 0.01, px - 0.01), mat)
                    c = e + 1
                else: c += 1
def awning_folds(xf, y0, y1, side, z=2.5, depth=1.7, mat='metal'):
    """a fabric/metal awning sloping out from the wall, with pleats (a zig-zag section) and a scalloped valance"""
    n = int((y1 - y0) / 0.5); prof = []
    for k in range(n + 1):
        y = y0 + (y1 - y0) * k / n; prof.append((y, 0.06 if k % 2 else 0.0))
    for k in range(n):
        ya, za = prof[k]; yb, zb = prof[k + 1]
        for a, b in ((ya, yb),):
            vs = [bm.verts.new((xf, a, z + 0.6 + za)), bm.verts.new((xf, b, z + 0.6 + zb)), bm.verts.new((xf + side * depth, b, z + zb)), bm.verts.new((xf + side * depth, a, z + za))]
            f = bm.faces.new(vs if side > 0 else vs[::-1]); f.material_index = MI[mat]
            vs2 = [bm.verts.new((xf + side * depth, a, z + za)), bm.verts.new((xf + side * depth, b, z + zb)), bm.verts.new((xf + side * depth, b, z - 0.3 + 0.08 * (k % 2))), bm.verts.new((xf + side * depth, a, z - 0.3))]
            f2 = bm.faces.new(vs2 if side > 0 else vs2[::-1]); f2.material_index = MI[mat]
    for y in (y0 + 0.1, y1 - 0.1): box((xf + side * depth * 0.5, y, z + 0.3), (depth, 0.04, 0.04), 'metal', 0.0)
def window_frames(xf, y0, y1, side, zs=((0.9, 1.6, 2.4), (3.8, 1.4, 1.2))):
    """frames, mullions and sills round each shop window and upper window of a facade"""
    d = side * 0.12
    for k in range(int((y1 - y0 - 1.0) // 3.2)):
        yc = y0 + 3.2 + k * 3.2
        if yc + 1.3 > y1 - 0.5: break
        for zb, hh, ww in zs:
            for dy in (-ww / 2, ww / 2): box((xf + d, yc + dy, zb), (0.1, 0.1, hh), 'wood')
            box((xf + d, yc, zb + hh), (0.12, ww + 0.1, 0.1), 'wood'); box((xf + d * 1.3, yc, zb - 0.08), (0.18, ww + 0.2, 0.08), 'concrete')
            box((xf + d, yc, zb), (0.08, 0.06, hh), 'wood')
def drainpipe(x, y, h):
    cyl((x, y, 0.15), 0.06, h - 0.15, 'metal', 8); box((x, y, h - 0.2), (0.18, 0.25, 0.15), 'metal')
def meter(x, y, side): box((x + side * 0.12, y, 1.1), (0.22, 0.45, 0.6), 'metal'); cyl((x + side * 0.08, y, 0.0), 0.04, 1.1, 'metal', 6)
def kerbs():
    for xk in (-5.1, 5.1):
        for y0, y1 in ((-26.0, 24.0),):
            box((xk, (y0 + y1) / 2, 0), (0.22, y1 - y0, 0.14), 'concrete')
    for y in (-20.0, -8.0, 4.0, 16.0):
        for xk in (-4.75, 4.75): box((xk, y, 0), (0.4, 0.8, 0.01), 'rust')
def street_lamp(x, y, side):
    cyl((x, y, 0.0), 0.11, 0.6, 'metal', 10); cyl((x, y, 0.6), 0.07, 5.4, 'metal', 8)
    box((x + side * 0.6, y, 5.85), (1.3, 0.08, 0.08), 'metal'); box((x + side * 1.2, y, 5.65), (0.5, 0.28, 0.2), 'metal'); box((x + side * 1.2, y, 5.6), (0.42, 0.22, 0.05), 'glass')
def wheelie(x, y, rz=0.0):
    box((x, y, 0.0), (0.6, 0.72, 1.0), 'metal', rz, 0.03); box((x, y, 1.0), (0.66, 0.78, 0.06), 'rust', rz)
def dumpster(x, y, rz=0.0):
    box((x, y, 0.15), (1.8, 1.1, 1.05), 'rust', rz, 0.04); box((x, y, 1.2), (1.85, 1.15, 0.06), 'metal', rz)
def car2(x, y, rz, mat='metal'):
    """a car that reads as a car: shaped body (hood, cabin, boot), wheels with tyres, glass all round, bumpers, lights"""
    c, s = math.cos(rz), math.sin(rz)
    def W(lx, ly, lz): return (x + c * lx - s * ly, y + s * lx + c * ly, lz)
    prof = [(-2.2, 0.32), (-2.25, 0.62), (-2.05, 0.82), (-0.85, 0.92), (-0.45, 1.38), (0.75, 1.40), (1.25, 0.95), (2.15, 0.88), (2.25, 0.6), (2.2, 0.32)]
    before = set(bm.faces)
    v0 = [bm.verts.new(W(-0.88, py, pz)) for py, pz in prof]; v1 = [bm.verts.new(W(0.88, py, pz)) for py, pz in prof]
    bm.faces.new(v0[::-1]); bm.faces.new(v1)
    for i in range(len(prof)):
        j = (i + 1) % len(prof); bm.faces.new((v0[i], v0[j], v1[j], v1[i]))
    new = [f for f in bm.faces if f not in before]; bmesh.ops.recalc_face_normals(bm, faces=new)
    for f in new: f.material_index = MI[mat]
    for (ya, za), (yb, zb) in ((prof[3], prof[4]), (prof[5], prof[6])):
        ym, zm = (ya + yb) / 2, (za + zb) / 2; L = math.hypot(yb - ya, zb - za); ang = math.atan2(zb - za, yb - ya)
        b0 = set(bm.faces); bmesh.ops.create_cube(bm, size=1.0, matrix=T(*W(0, ym, zm)) @ Rz(rz) @ Rx(ang) @ Matrix.Diagonal((1.62, L * 0.9, 0.03, 1)))
        for f in [f for f in bm.faces if f not in b0]: f.material_index = MI['glass']
    for sx in (-0.89, 0.89): box(W(sx, 0.15, 1.0), (0.03, 1.5, 0.32), 'glass', rz)
    for ly in (-2.28, 2.28): box(W(0, ly, 0.32), (1.8, 0.12, 0.2), 'rust', rz)
    for sx in (-0.6, 0.6): box(W(sx, -2.24, 0.62), (0.3, 0.04, 0.12), 'glass', rz)
    for sx in (-0.82, 0.82):
        for ly in (-1.4, 1.35):
            b0 = set(bm.faces)
            bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=10, radius1=0.33, radius2=0.33, depth=0.24, matrix=T(*W(sx, ly, 0.33)) @ Rz(rz) @ Ry(math.pi / 2))
            for f in [f for f in bm.faces if f not in b0]: f.material_index = MI['rust']
    box(W(0, 0.2, 1.42), (1.3, 1.0, 0.05), 'dirt', rz)
def rubble_detail():
    for i in range(140):
        x = random.uniform(-21, 21); y = random.uniform(-34.5, -27.0)
        box((x, y, random.uniform(1.0, 2.6)), (0.23, 0.11, 0.08), 'brick', random.uniform(0, 3.14))
    for i in range(14):
        x = random.uniform(-18, 18); y = random.uniform(-33, -28)
        box((x, y, random.uniform(1.2, 2.5)), (0.25, random.uniform(2.5, 5.0), 0.25), 'wood', random.uniform(0, 3.14))
def detail_pass():
    # signs with lettering, awnings with pleats, window frames, drainpipes, meters on the shopfronts
    lettering('STORE', -7.85, -6.0, 2.62, +1); lettering('DINER', -7.85, 19.0, 2.62, +1); lettering('PHARMACY', 7.85, -7.75, 2.62, -1)
    lettering('HARDWARE', 7.85, 4.0, 2.62, -1); lettering('CAFE', -7.85, 8.25, 2.62, +1, mat='wood'); lettering('FUEL', 9.85, 30.0, 3.0, -1)
    for xf, side, spans in ((-8.0, +1, ((-26, -14), (2.5, 14))), (8.0, -1, ((-26, -16), (-2, 10), (12.5, 24)))):
        for y0, y1 in spans:
            window_frames(xf, y0, y1, side); drainpipe(xf + side * 0.1, y0 + 0.25, 6.5); meter(xf, y1 - 1.0, side)
    awning_folds(-7.98, -25.4, -14.6, +1, mat='plaster'); awning_folds(7.98, -1.4, 9.4, -1, mat='rust')
    kerbs()
    for y, side in ((-17.0, -1), (-3.0, -1), (11.0, -1), (-10.0, +1), (6.0, +1), (19.0, +1)):
        street_lamp(-7.3 if side < 0 else 7.3, y, -side)
    wheelie(-7.4, -13.2); wheelie(-7.4, -12.4, 0.2); wheelie(7.5, 11.1); dumpster(-19.6, 4.0, 0.0); dumpster(19.4, -14.5, 1.57)
    rubble_detail()
SX, SY = 40.0, 55.0
def overlay(x0, y0, x1, y1, mat, z=0.02): return quad(x0, y0, x1, y1, mat, z)      # 2 cm up (2 mm flickered)
def ground():
    GBASE.append(quad(-SX - 0.5, -SY - 0.5, SX + 0.5, SY + 0.5, 'dirt'))
    overlay(-8, -46, 8, 44, 'concrete'); overlay(-38, -8, -8, 8, 'concrete'); overlay(8, -8, 38, 8, 'concrete')
    for y0, y1 in ((-46, -9), (9, 44)): overlay(-5, y0, 5, y1, 'asphalt', 0.035)
    for x0, x1 in ((-38, -9), (9, 38)): overlay(x0, -5, x1, 5, 'asphalt', 0.035)
    overlay(-SX, 44, SX, SY, 'concrete')
def rot_build(fn, pivot, ang):
    """build with fn() as if the facade faced +-x, then turn everything it made by ang (radians) about pivot (lights too)"""
    vb = set(bm.verts); nl = len(LIGHTS); fn()
    c, s = math.cos(ang), math.sin(ang); px, py = pivot
    for v in bm.verts:
        if v not in vb:
            x, y = v.co.x - px, v.co.y - py; v.co.x = px + c * x - s * y; v.co.y = py + s * x + c * y
    for i in range(nl, len(LIGHTS)):
        x, y, z, w, col = LIGHTS[i]; x, y = x - px, y - py; LIGHTS[i] = (px + c * x - s * y, py + s * x + c * y, z, w, col)
WORDS = ['STORE', 'BAKERY', 'BOOKS', 'BAR', 'TAILOR', 'RADIO', 'DRUGS', 'MARKET', 'HOTEL', 'GARAGE', 'DINER', 'PAWN', 'HARDWARE', 'CAFE', 'BANK', 'SHOES']
def shop_row(sx, segs, kinds, word0):
    """a row of shops along the main street on side sx (+1 east, -1 west): segs [(y0, y1)], kinds 'open' / 'closed'"""
    x0, x1 = (8.0, 16.0) if sx > 0 else (-16.0, -8.0); side = -sx; xf = x0 if sx > 0 else x1
    for k, ((y0, y1), kind) in enumerate(zip(segs, kinds)):
        ya, yb = min(y0, y1), max(y0, y1); mid = (ya + yb) / 2; h = random.choice((6.0, 6.5, 7.0, 7.6))
        if kind == 'open':
            open_shop(x0, x1, ya, yb, h, side, (mid - 1.0, mid + 1.0), back_door=(mid + 1.5, mid + 3.3), counter=((x0 + x1) / 2 + side * -0.5, mid - 1.0, 3.5),
                      sign='emissive_sign' if k % 2 == 0 else None)
        else:
            block(x0, x1, ya, yb, h, side, mat=random.choice(('brick', 'plaster')), sign='emissive_sign' if k % 3 == 0 else None)
            window_frames(xf, ya, yb, side); drainpipe(xf + side * 0.1, ya + 0.3, h - 0.5)
        lettering(WORDS[(word0 + k) % len(WORDS)][:7], xf + side * 0.15, mid, 2.62, side)
        if kind != 'open' and k % 2: awning_folds(xf + side * 0.02, ya + 0.6, yb - 0.6, side, mat=random.choice(('plaster', 'rust')))
def quadrant(sx, sy):
    segs = [(8.0, 18.0), (20.5, 31.0), (33.5, 44.0)]
    kinds = ['closed', 'open', 'closed'] if sx * sy > 0 else ['open', 'closed', 'open']
    shop_row(sx, [(sy * a, sy * b) for a, b in segs], kinds, (2 if sx > 0 else 0) + (5 if sy > 0 else 9))
    # the row along the cross street: built as a main-street row centred on the pivot, then turned to face the cross street
    for k, (a, b) in enumerate(((16.0, 26.0), (28.5, 38.0))):      # (16.0: no 0.5 m slot against the main-street row)
        cxm = sx * (a + b) / 2; cym = sy * 12.0
        def row(a=a, b=b, k=k):
            L = b - a
            if k == 0 and sx * sy < 0:
                open_shop(cxm - 4.0, cxm + 4.0, cym - L / 2, cym + L / 2, 6.4, -1, (cym - 1.0, cym + 1.0), back_door=(cym + 1.5, cym + 3.3), counter=(cxm + 0.5, cym - 1.0, 3.0))
            else:
                block(cxm - 4.0, cxm + 4.0, cym - L / 2, cym + L / 2, random.choice((6.2, 7.0)), -1, mat=random.choice(('brick', 'plaster')))
                window_frames(cxm - 4.0, cym - L / 2, cym + L / 2, -1)
            lettering(WORDS[(k + 7 + (3 if sx > 0 else 0) + (1 if sy > 0 else 0)) % len(WORDS)][:7], cxm - 4.15, cym, 2.62, -1)
        rot_build(row, (cxm, cym), math.pi / 2 if sy > 0 else -math.pi / 2)
    # back lot clutter and a fence with gaps (the back alleys loop through the lot, the row gaps and the shops' back doors)
    bx, by = sx * 27.0, sy * 30.0
    dumpster(bx - sx * 6, by - sy * 8, 0.2); dumpster(bx + sx * 7, by + sy * 9, 1.4)
    for x, y in ((bx + sx * 3, by - sy * 2), (bx - sx * 4, by + sy * 6)): crates_s(x, y)
    xa, xb = sorted((sx * 17.0, sx * 38.5)); wall_y(by + sy * 2.0, xa, xb, 2.0, 'wood', sorted([tuple(sorted((sx * 21.0, sx * 24.5))), tuple(sorted((sx * 31.0, sx * 34.5)))]), 0.15)
    heap((sx * 38.5, by, 0.0), 1.0, 3.0, 0.35)
def crates_s(x, y):
    for k in range(random.randint(1, 2)): box((x + random.uniform(-0.1, 0.1), y, k * 1.1), (1.1, 1.1, 1.05), 'wood', random.uniform(-0.2, 0.2), 0.02)
def fountain():
    """the square: a round basin (blocks: 0.6 m) with a plinth and a statue, four benches"""
    before = set(bm.faces)
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=24, radius1=3.0, radius2=3.0, depth=0.6, matrix=T(0, 0, 0.3))
    for f in [f for f in bm.faces if f not in before]: f.material_index = MI['concrete']
    before = set(bm.faces); bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=24, radius1=2.6, radius2=2.6, depth=0.04, matrix=T(0, 0, 0.62))
    for f in [f for f in bm.faces if f not in before]: f.material_index = MI['dirt']
    box((0, 0, 0.6), (1.3, 1.3, 2.0), 'concrete', 0.0, 0.04); box((0, 0, 2.6), (1.5, 1.5, 0.15), 'concrete')
    cyl((0, 0, 2.75), 0.28, 1.1, 'metal', 10); blob_s((0, 0, 4.1), 0.32); box((0.0, 0.25, 3.3), (0.9, 0.18, 0.14), 'metal', 0.4)
    for a in range(4):
        ang = a * math.pi / 2 + math.pi / 4; x, y = 7.0 * math.cos(ang), 7.0 * math.sin(ang)
        box((x, y, 0.0), (1.8, 0.5, 0.45), 'wood', ang + math.pi / 2); box((x, y, 0.45), (1.8, 0.08, 0.45), 'wood', ang + math.pi / 2)
def blob_s(c, r):
    before = set(bm.faces); bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r, matrix=T(*c))
    for f in [f for f in bm.faces if f not in before]: f.material_index = MI['metal']
def kerbs():
    for xk in (-5.1, 5.1):
        for y0, y1 in ((-46.0, -9.0), (9.0, 44.0)): box((xk, (y0 + y1) / 2, 0), (0.22, y1 - y0, 0.14), 'concrete')
    for yk in (-5.1, 5.1):
        for x0, x1 in ((-38.0, -9.0), (9.0, 38.0)): box(((x0 + x1) / 2, yk, 0), (x1 - x0, 0.22, 0.14), 'concrete')
def rubble_detail():
    for i in range(160):
        box((random.uniform(-38, 38), random.uniform(-54.5, -47.0), random.uniform(1.0, 2.6)), (0.23, 0.11, 0.08), 'brick', random.uniform(0, 3.14))
    for i in range(16):
        box((random.uniform(-34, 34), random.uniform(-53, -48), random.uniform(1.2, 2.5)), (0.25, random.uniform(2.5, 5.0), 0.25), 'wood', random.uniform(0, 3.14))
GBASE = []
def slab(c, s, mat, rz=0.0, rx=0.0):
    before = set(bm.faces)
    bmesh.ops.create_cube(bm, size=1.0, matrix=T(*c) @ Rz(rz) @ Rx(rx) @ Matrix.Diagonal((s[0], s[1], s[2], 1)))
    for f in [f for f in bm.faces if f not in before]: f.material_index = MI[mat]
def beam_s(p0, p1, th, mat):
    p0, p1 = Vector(p0), Vector(p1); d = p1 - p0; L = d.length
    if L < 1e-4: return
    q = d.normalized().to_track_quat('Y', 'Z'); before = set(bm.faces)
    bmesh.ops.create_cube(bm, size=1.0, matrix=T(*((p0 + p1) / 2)) @ q.to_matrix().to_4x4() @ Matrix.Diagonal((th, L, th, 1)))
    for f in [f for f in bm.faces if f not in before]: f.material_index = MI[mat]
def lying_pipe(x, y, z, r, L):
    b0 = set(bm.faces); bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=10, radius1=r, radius2=r, depth=L, matrix=T(x, y, z + r) @ Ry(math.pi / 2))
    for f in [f for f in bm.faces if f not in b0]: f.material_index = MI['concrete']
def construction(sx, sy):
    """back lot: scaffold tower (planks overhead), cement mixer, stacked pipes, a skip, sand, a site toilet"""
    X = lambda lx: sx * lx; Y = lambda ly: sy * ly
    for lx in (26.0, 30.0):
        for ly in (20.0, 24.0): cyl((X(lx), Y(ly), 0), 0.06, 5.6, 'metal', 6)
    for z in (2.6, 5.0): box((X(28.0), Y(22.0), z), (4.4, 4.4, 0.08), 'wood')
    for ly in (20.0, 24.0): beam_s((X(26.0), Y(ly), 0.2), (X(30.0), Y(ly), 2.5), 0.05, 'metal'); beam_s((X(30.0), Y(ly), 2.7), (X(26.0), Y(ly), 4.9), 0.05, 'metal')
    cyl((X(34.0), Y(19.0), 0.4), 0.6, 0.9, 'rust', 10); box((X(34.0), Y(19.0), 0), (1.0, 1.6, 0.5), 'metal')
    for k, (dz, dy) in enumerate(((0.0, -0.45), (0.0, 0.45), (0.78, 0.0))): lying_pipe(X(25.0), Y(27.5) + dy, dz, 0.4, 4.0)
    box((X(35.5), Y(25.0), 0), (1.8, 3.0, 1.3), 'rust', 0.0, 0.04); heap((X(29.0), Y(18.0), 0), 1.6, 1.2, 0.8, 'dirt'); box((X(37.3), Y(21.0), 0), (1.2, 1.2, 2.3), 'plaster', 0.0, 0.04)
def car_park(sx, sy):
    X = lambda lx: sx * lx; Y = lambda ly: sy * ly
    for k in range(8): quad(X(18.6 + k * 2.6) - 0.06, Y(34.0) if sy > 0 else Y(39.0), X(18.6 + k * 2.6) + 0.06, Y(39.0) if sy > 0 else Y(34.0), 'plaster', 0.02)
    car2(X(19.9), Y(36.6), 0.08, 'rust'); car2(X(27.7), Y(36.4), -0.1, 'metal'); car2(X(30.3), Y(36.8), 0.2, 'rust')
    box((X(17.6), Y(41.0), 0), (0.5, 0.4, 1.5), 'metal')
    x0, x1 = sorted((X(31.0), X(34.0))); y0, y1 = sorted((Y(18.5), Y(21.0)))
    wall_x(x0, y0, y1, 2.4, 'wood', [], 0.2); wall_x(x1, y0, y1, 2.4, 'wood', [], 0.2)
    wall_y(y0, x0, x1, 2.4, 'wood', [], 0.2) if sy > 0 else wall_y(y0, x0, x1, 2.4, 'wood', [((x0 + x1) / 2 - 0.9, (x0 + x1) / 2 + 0.9)], 0.2)
    wall_y(y1, x0, x1, 2.4, 'wood', [((x0 + x1) / 2 - 0.9, (x0 + x1) / 2 + 0.9)], 0.2) if sy > 0 else wall_y(y1, x0, x1, 2.4, 'wood', [], 0.2)
    slab(((x0 + x1) / 2, (y0 + y1) / 2, 2.55), (3.6, 3.1, 0.08), 'rust', 0.0, 0.12)
    for lx in (19.0, 30.0): cyl((X(lx), Y(25.0), 0), 0.05, 2.4, 'wood', 6)
    beam_s((X(19.0), Y(25.0), 2.3), (X(30.0), Y(25.0), 2.3), 0.02, 'metal')
    for lx in (21.0, 23.5, 26.5): box((X(lx), Y(25.0), 1.15), (1.2, 0.04, 1.1), random.choice(('plaster', 'sandbag')))
def beer_garden(sx, sy):
    X = lambda lx: sx * lx; Y = lambda ly: sy * ly
    for lx, ly in ((24.0, 19.0), (28.0, 22.0), (24.0, 26.0)):
        box((X(lx), Y(ly), 0), (1.8, 0.8, 0.75), 'wood'); box((X(lx), Y(ly) + 0.75, 0), (1.8, 0.3, 0.45), 'wood'); box((X(lx), Y(ly) - 0.75, 0), (1.8, 0.3, 0.45), 'wood')
    for lx in (31.0, 34.0):
        for ly in (18.0, 21.0): cyl((X(lx), Y(ly), 0), 0.05, 2.3, 'metal', 6)
    for ly in (18.0, 21.0): beam_s((X(31.0), Y(ly), 2.25), (X(34.0), Y(ly), 2.25), 0.06, 'metal')
    for lx in (31.0, 32.5, 34.0): beam_s((X(lx), Y(18.0), 2.25), (X(lx), Y(21.0), 2.25), 0.05, 'metal')
    vs = [(X(35.0), Y(25.0), 1.8), (X(35.8), Y(25.0), 1.8), (X(35.8), Y(29.0), 0.006), (X(35.0), Y(29.0), 0.006)]
    slab((X(35.4), Y(27.0), 0.9), (0.8, 4.2, 0.12), 'metal', 0.0, -sy * math.atan2(1.8, 4.0)); box((X(35.4), Y(24.8), 0), (0.9, 0.5, 1.8), 'metal')
    for lx0, lx1, ly in ((18.0, 25.0, 29.5), (28.0, 37.0, 29.5)): box(((X(lx0) + X(lx1)) / 2, Y(ly), 0), (lx1 - lx0, 0.35, 0.9), 'brick')
    car2(X(30.0), Y(39.0), 1.3, 'rust')
def camp(sx, sy):
    X = lambda lx: sx * lx; Y = lambda ly: sy * ly
    for lx, ly in ((25.0, 19.5), (29.5, 22.8)):
        for s in (-1, 1): slab((X(lx), Y(ly) + s * 0.75, 1.0), (3.0, 1.9, 0.06), 'sandbag', 0.0, s * 0.9)
        box((X(lx), Y(ly), 0), (3.0, 0.1, 0.4), 'sandbag')
    cyl((X(26.0), Y(26.0), 0), 0.32, 0.9, 'rust', 12, top_mat='emissive_fire'); LIGHTS.append((X(26.0), Y(26.0), 1.3, 160, (1.0, 0.5, 0.18)))
    for lx, ly in ((24.4, 25.6), (27.4, 27.0)): box((X(lx), Y(ly), 0), (0.9, 0.5, 0.45), 'wood', 0.5)
    box((X(33.0), Y(18.5), 0), (5.0, 0.8, 0.95), 'sandbag'); box((X(36.0), Y(21.5), 0), (0.8, 4.0, 0.95), 'sandbag')
    car2(X(33.0), Y(25.0), 1.57 + 0.2, 'metal')
    for k in range(4): box((X(20.0 + k * 0.6), Y(29.0), 0), (0.5, 0.4, 0.45), 'plaster', k * 0.4)
def street_furniture():
    # traffic lights over the junction, a bus shelter, a phone box, bollards, projecting shop signs, cables across the street
    for x, y, s in ((6.9, 9.6, -1), (-6.9, -9.6, 1)):
        cyl((x, y, 0), 0.12, 5.6, 'metal', 8); beam_s((x, y, 5.5), (x + s * 5.5, y, 5.5), 0.1, 'metal')
        box((x + s * 4.0, y, 4.8), (0.35, 0.3, 0.9), 'metal'); box((x + s * 4.0, y - s * 0.16, 5.4), (0.2, 0.02, 0.2), 'emissive_fire')
    box((7.9, -30.0, 0), (0.08, 3.6, 2.4), 'glass'); box((7.25, -30.0, 2.4), (1.5, 3.8, 0.08), 'metal')      # back against the shopfront: no pocket behind
    for y in (-31.8, -28.2): box((7.25, y, 0), (1.2, 0.08, 2.4), 'glass')
    box((7.55, -30.0, 0), (0.45, 2.6, 0.45), 'wood')
    box((-7.2, 34.0, 0), (1.0, 1.0, 2.4), 'rust', 0.0, 0.04); box((-6.69, 34.0, 1.2), (0.03, 0.8, 1.0), 'glass')
    for x, y in ((-7.6, -8.6), (-6.4, -8.6), (7.6, 8.6), (6.4, 8.6), (8.6, -6.4), (8.6, -7.6), (-8.6, 6.4), (-8.6, 7.6)): cyl((x, y, 0), 0.13, 0.9, 'metal', 8)
    for xf, side, ys in ((-8.0, 1, (-38.0, -24.0, 13.0, 27.0, 40.0)), (8.0, -1, (-41.0, -21.0, 15.0, 30.0))):
        for y in ys:
            box((xf + side * 0.45, y, 3.6), (0.9, 0.06, 0.06), 'metal'); box((xf + side * 0.9, y, 3.05), (0.06, 0.8, 0.6), random.choice(('plaster', 'emissive_sign', 'wood')))
    for y in (-35.0, -20.0, 20.0, 35.0): beam_s((-8.0, y, 6.0), (8.0, y + 1.0, 6.2), 0.03, 'metal')
    beam_s((-8.0, 18.0, 5.6), (8.0, 18.0, 5.6), 0.03, 'metal'); box((0.0, 18.0, 4.9), (5.0, 0.04, 0.7), 'sandbag')
    # a fuel price pylon at the petrol station: the north landmark
    box((-15.0, 45.2, 0), (0.6, 0.6, 7.0), 'metal'); box((-15.0, 45.2, 7.0), (2.4, 0.4, 2.6), 'plaster'); box((-15.0, 44.98, 8.2), (2.0, 0.04, 0.8), 'emissive_sign')
    LIGHTS.append((-15.0, 44.3, 8.0, 80, (1.0, 0.5, 0.2)))
def road_marks():
    for y0 in list(range(-45, -12, 4)) + list(range(13, 43, 4)): quad(-0.08, y0, 0.08, y0 + 2.0, 'plaster', 0.05)
    for x0 in list(range(-37, -12, 4)) + list(range(13, 37, 4)): quad(x0, -0.08, x0 + 2.0, 0.08, 'plaster', 0.05)
    for yc in (10.8, -10.8):
        for k in range(9): quad(-4.4 + k * 1.0, yc - 1.2, -4.4 + k * 1.0 + 0.5, yc + 1.2, 'plaster', 0.05)
    for y in range(-42, 43, 12):
        if abs(y) < 12: continue
        for x in (-4.65, 4.65): quad(x - 0.2, y - 0.4, x + 0.2, y + 0.4, 'metal', 0.05)
    for x, y in ((-6.0, -21.0), (6.5, 19.5), (-6.5, 29.0), (-11.0, 6.5), (20.0, -6.5)):
        for k in range(3): box((x + random.uniform(-0.5, 0.5), y + random.uniform(-0.5, 0.5), 0), (0.5, 0.45, 0.4), 'plaster', random.uniform(0, 3))
def build():
    ground()
    for x in (-SX - 0.4, SX + 0.4): box((x, 0, 0), (0.5, 2 * SY + 1.6, 4.0), 'brick')
    for y in (-SY - 0.4, SY + 0.4): box((0, y, 0), (2 * SX + 1.6, 0.5, 4.0), 'brick')
    for sx in (-1, 1):
        for sy in (-1, 1): quadrant(sx, sy)
    fountain(); kerbs()
    # petrol station at the north end (y 44..55)
    for x in (-5.0, 5.0):
        for y in (46.5, 52.5): box((x, y, 0), (0.45, 0.45, 4.8), 'metal')
    box((0, 49.5, 4.8), (14.5, 9.5, 0.6), 'metal', 0.0, 0.08)
    for x in (-3.0, 0.0, 3.0): box((x, 49.5, 4.76), (0.5, 7.0, 0.06), 'emissive_lamp'); LIGHTS.append((x, 49.5, 4.4, 120, (1.0, 0.85, 0.6)))
    for x in (-2.4, 2.4): box((x, 49.5, 0), (1.2, 3.2, 0.25), 'concrete'); box((x, 48.6, 0.25), (0.6, 0.8, 1.5), 'metal', 0, 0.05); box((x, 50.4, 0.25), (0.6, 0.8, 1.5), 'metal', 0, 0.05)
    box((20.0, 50.0, 0), (12.0, 7.0, 4.0), 'plaster'); facade(14.0, 46.5, 53.5, -1, 4.0, sign='emissive_sign'); lettering('FUEL', 13.85, 50.0, 3.0, -1)
    box((-22.0, 50.5, 0), (8.0, 5.0, 3.2), 'brick'); car2(-12.0, 48.0, 0.5, 'metal'); car2(10.0, 46.5, 1.4, 'rust')
    sandbags(-8.0, 43.0, -4.0, 43.6); sandbags(4.0, 43.6, 7.5, 43.0)
    # the collapsed building closing the south end
    box((0.0, -51.0, 0), (2 * SX + 0.8, 8.4, 1.2), 'concrete')
    for i in range(60):
        x = random.uniform(-SX, SX); y = random.uniform(-SY, -47.5); s = random.uniform(1.2, 3.5)
        box((x, y, random.uniform(0.0, 0.2)), (s, s * random.uniform(0.6, 1.4), random.uniform(1.0, 4.0)), random.choice(['concrete', 'brick', 'concrete']), random.uniform(0, 3.14))
    box((-6.0, -50.0, 0), (9.0, 0.6, 6.5), 'brick', 0.2); box((9.0, -51.0, 0), (7.0, 0.6, 5.0), 'plaster', -0.25)
    rubble_detail()
    # streets: wrecks, the bus slewed across the east arm, barricades, barrels, lamps, bins
    bus(24.0, 0.5, math.radians(62))
    for x, y, a, m in ((-2.7, 16.0, 8, 'rust'), (2.8, 26.0, -15, 'metal'), (-2.5, -18.0, 175, 'metal'), (2.7, -30.0, 190, 'rust'), (-1.0, 38.0, 70, 'rust'),
                       (3.2, -40.0, 5, 'metal'), (-20.0, 2.6, 95, 'rust'), (-31.0, -2.4, 80, 'metal'), (14.0, -2.8, 100, 'metal')):
        car2(x, y, math.radians(a), m)
    sandbags(-4.5, -12.0, -1.0, -12.6); sandbags(1.0, 12.5, 4.6, 13.0); sandbags(-12.5, 4.5, -12.0, 1.0); sandbags(12.0, -1.0, 12.6, -4.6)
    for x, y in ((-6.6, 22.0), (6.8, -24.0), (-24.0, 6.6), (30.0, -6.6)):
        cyl((x, y, 0), 0.32, 0.9, 'rust', 12, top_mat='emissive_fire'); LIGHTS.append((x, y, 1.3, 240, (1.0, 0.5, 0.18)))
    for y in (-38.0, -24.0, -14.0, 14.0, 24.0, 36.0):
        street_lamp(7.3, y, -1); street_lamp(-7.3, y + 5.0, 1)
    for x in (-30.0, -18.0, 18.0, 30.0): street_lamp(x, 7.3, 0) if False else (cyl((x, 7.3, 0.0), 0.11, 0.6, 'metal', 10), cyl((x, 7.3, 0.6), 0.07, 5.4, 'metal', 8), box((x, 6.7, 5.65), (0.28, 0.5, 0.2), 'metal'))
    wheelie(-7.4, -21.2); wheelie(7.5, 19.1); wheelie(-12.0, 7.4)
    for x, y, rx, ry in ((-7.6, -40, 0.9, 2.5), (7.6, -20, 0.8, 2.2), (7.6, 30, 0.9, 2.6), (-7.6, 28, 0.8, 1.8), (-20, -7.6, 2.5, 0.8), (26, 7.6, 2.4, 0.8)):
        heap((x, y, 0.0), rx, ry, 0.35)
    construction(1, 1); car_park(-1, 1); beer_garden(1, -1); camp(-1, -1); street_furniture(); road_marks()
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
    w = bpy.data.worlds.get('street_sky') or bpy.data.worlds.new('street_sky'); scene.world = w; w.use_nodes = True; nt = w.node_tree
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
    img = bpy.data.images.new('street_light', size, size, alpha=False, float_buffer=True)
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
    path = os.path.join(TEXDIR, 'street_light.exr'); 
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
# MAIN STREET: violet leads, teal second. A dusky magenta night, the aurora low in the south over the collapsed block, the moon up the street.
# Hearts: the fountain square (the statue drowned in a crown of crystal) and the collapsed building; a smaller one at the camp (its fire
# still burns); roots run up the main street to the petrol station and out to the slewed bus.
import ash_paint
from ash_paint import BLOOM_TEAL as TEAL
VIOLET = (0.86, 0.22, 1.0)
P = dict(name='street', lead=VIOLET, second=TEAL, lead_mat='emissive_violet', second_mat='emissive_teal',
         keep=[(0.0, 49.5), (-6.6, 22.0), (30.0, -6.6), (-26.0, -26.0)], lamp=(1.0, 0.55, 0.2),
         moon=(-0.28, 0.80, 0.53), moon_e=float(OPT.get('moon', 1.3)), moon_col=(0.72, 0.68, 1.0), skyk=float(OPT.get('skyk', 4.0)),
         sky=dict(zen=(0.010, 0.006, 0.030), mid=(0.020, 0.012, 0.050), hor=(0.065, 0.030, 0.075), alo=(1.0, 0.25, 0.62), ahi=(0.42, 0.14, 0.9),
                  a0=170.0, aurora=0.28, moon_col=(0.44, 0.41, 0.48), halo=(0.85, 0.7, 1.0), moon2=(0.55, -0.35, 0.76), glow2=(0.010, 0.020, 0.030)),
         gs=0.42, cgs=0.8, sat=1.5, step=0.95, seg=5, glowk=3.2, lm=512, max_glows=44, seed=int(OPT.get('seed', 5)))
def bloom_layout(B):
    V, Tl = VIOLET, TEAL
    h = B.down(0.0, 0.0, 20.0); B.cluster((0.0, 0.0, h.z if h is not None else 2.0), 9, 2.6, V, 2.3, spread=0.7, lean=0.7, size=11.0)      # the statue's crown
    B.heart((0.0, 0.0), 10.0, V, Tl, 0.3, clusters=4, vines=6, shelves=2, roots=7, sprouts=4, Lmax=1.6)
    B.heart((0.0, -48.0), 11.0, V, Tl, 0.25, clusters=7, vines=8, shelves=2, roots=4, sprouts=2, Lmax=3.0)
    B.heart((-26.0, -24.0), 7.0, Tl, V, 0.3, clusters=3, vines=6, shelves=2, roots=4, sprouts=3, Lmax=1.6)
    B.heart((24.0, 0.5), 5.0, V, Tl, 0.2, clusters=2, vines=3, shelves=1, roots=3, sprouts=2, Lmax=1.8)
    B.trail([(0.0, 5.0), (-1.5, 18.0), (1.0, 31.0), (0.0, 43.0)], V)
    B.trail([(5.0, 0.0), (14.0, -1.0), (21.0, 0.5)], V)
    B.trail([(-4.0, -6.0), (-12.0, -16.0), (-22.0, -21.0)], Tl)
    B.trail([(0.0, -6.0), (1.0, -22.0), (-1.0, -38.0)], V)
    B.heart((14.0, 40.0), 6.0, Tl, V, 0.3, clusters=2, vines=4, shelves=1, roots=2, sprouts=2, Lmax=1.4)

# ---------------------------------------------------------------- run
make_pictures(); mats = materials(); build()
if BLOOM: ash_paint.bloom_dim_lamps(globals(), P)
for v in bm.verts: v.co.z = max(v.co.z, 0.0)          # nothing below the ground: the exporter measures heights from the lowest point
_gv = {v for f in GROUND_FACES for v in f.verts}
for v in bm.verts:                                     # whatever stands on the ground starts 6 mm above it: a bottom face coplanar with the
    if v not in _gv and v.co.z < 0.006: v.co.z = 0.006  # ground lets the exporter's down-rays miss it and read the object as a thin sheet
_mv, _left = separate_coplanar(bm, fixed=lambda f: f in GBASE, skip=lambda f: f.normal.z < -0.9 and f.calc_center_median().z < 0.05, rounds=6)
log('coplanar overlaps: %d faces moved apart, %d pairs left' % (_mv, _left))
bm.faces.index_update(); GIDX = [f.index for f in GROUND_FACES if f.is_valid and f.calc_area() > 10.0]      # the ground and big floor patches keep floor density; lines and strips get the props' resolution
me = bpy.data.meshes.new('street'); bm.to_mesh(me); bm.free()
for m in mats: me.materials.append(m)
uv_world(me)
mc = bpy.data.collections.new('map'); scene.collection.children.link(mc)
ob = bpy.data.objects.new('street', me); mc.objects.link(ob)
me.calc_loop_triangles(); log('street', len(me.loop_triangles), 'triangles,', len(me.vertices), 'verts')
lu = me.uv_layers.new(name='Lightmap'); me.uv_layers.active = lu
smart_uv(ob, 66, 0.004)
lightmap_weight(ob, GIDX, 2.0)                                                          # props get more of the light picture than the floor
log('thin faces given a neighbour light texel: %d' % collapse_thin_lightmap(ob, 2048, min_width=0.8, max_dist=1.0))
uvd = me.uv_layers['Lightmap']; me.uv_layers.active = me.uv_layers['UVMap']
lights()
if BLOOM: bob = ash_paint.bloom_grow(globals(), bloom_layout, P); ash_paint.bloom_relight(globals(), P)
def reach_check(ob):
    """walkable cells on a 0.5 m grid (nothing solid between 0.45 m and head height, not inside a solid), flood filled from mid-street"""
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get(); bvh = BVHTree.FromObject(ob, dg)
    xs = np.arange(-40.0, 40.01, 0.5); ys = np.arange(-55.0, 55.01, 0.5); walk = np.zeros((len(xs), len(ys)), bool)
    for i, x in enumerate(xs):
        for j, y in enumerate(ys):
            ok = True
            for dx, dy in ((0, 0), (0.2, 0.2), (-0.2, 0.2), (0.2, -0.2), (-0.2, -0.2)):
                h = bvh.ray_cast(Vector((x + dx, y + dy, 2.15)), Vector((0, 0, -1)), 3.0)
                if h[0] is None or h[0].z > 0.45 or h[1].z < 0: ok = False; break
            walk[i, j] = ok
    seen = np.zeros_like(walk); st = [(int((6 + 40) / 0.5), int((6 + 55) / 0.5))]
    while st:
        i, j = st.pop()
        if i < 0 or j < 0 or i >= len(xs) or j >= len(ys) or seen[i, j] or not walk[i, j]: continue
        seen[i, j] = True; st += [(i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)]
    lost = walk & ~seen; pts = [(float(xs[i]), float(ys[j])) for i, j in zip(*np.nonzero(lost))]
    log('reach: %d walkable cells, %d reached, %d cut off' % (walk.sum(), seen.sum(), lost.sum()), pts[:8])
reach_check(ob)
if 'nobake' not in OPT:
    bake(ob, 2048, int(OPT.get('samples', 40)))
    log('black faces in the open given a lit neighbour texel: %d' % relight_black_faces(ob, os.path.join(TEXDIR, 'street' + '_light.exr')))
if BLOOM:
    if 'nobake' not in OPT: ash_paint.bloom_bake(globals(), bob, P, int(OPT.get('samples', 40)))
    ash_paint.bloom_split(globals(), bob)
cfg = {'blend': 'street.blend', 'out': '../../Ashfall/assets/street', 'world': {'collections': ['map'], 'lightmap': 'tex/street_light.exr', 'lmSize': 2048},
       'grid': {'cell': 0.25}, 'probes': {'cell': 1.0, 'height': 1.0, 'samples': 96}, 'sky': {'width': 1024}, 'maxTexture': 1024}
with open(os.path.join(BASE, 'street.export.json'), 'w') as f: json.dump(cfg, f, indent=1)
bpy.ops.wm.save_mainfile(); log('saved', bpy.data.filepath)
if 'preview' in OPT:
    cd = bpy.data.cameras.new('st_cam'); cam = bpy.data.objects.new('st_cam', cd); scene.collection.objects.link(cam); scene.camera = cam
    cd.sensor_fit = 'VERTICAL'; cd.angle_y = math.radians(50)
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 24
    try: scene.cycles.use_denoising = True
    except Exception: pass
    scene.render.resolution_x, scene.render.resolution_y = 480, 270
    views = [((0, -40, 1.6), (0, 10, 1.5)), ((-34, 0, 1.6), (10, 0, 1.5)), ((8, 8, 1.6), (0, 0, 1.2)), ((-27, 19.25, 1.6), (-27, 35, 1.2)),
             ((12, 25.75, 1.6), (12, 19.5, 1.2)), ((3, 46, 1.6), (0, 52, 2.5))]
    big = np.ones((3 * 270, 2 * 480, 4), np.float32)
    for i, (p, t) in enumerate(views):
        cam.location = p; cam.rotation_euler = (Vector(t) - Vector(p)).to_track_quat('-Z', 'Y').to_euler()
        tmp = os.path.join(CACHE, '_st%d.png' % i); scene.render.filepath = tmp; bpy.ops.render.render(write_still=True)
        im = bpy.data.images.load(tmp); a = np.array(im.pixels[:], np.float32).reshape(270, 480, 4); bpy.data.images.remove(im); os.remove(tmp)
        r, c = divmod(i, 2); big[(2 - r) * 270:(3 - r) * 270, c * 480:(c + 1) * 480] = a
    im = bpy.data.images.new('st_grid', 960, 810); im.pixels.foreach_set(big.ravel()); im.filepath_raw = os.path.join(CACHE, 'street_views.png'); im.file_format = 'PNG'; im.save()
    log('preview street_views.png')
log('done')
