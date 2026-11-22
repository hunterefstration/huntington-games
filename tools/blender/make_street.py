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
from hgkit import log, vnoise, fbm, save_image, smart_uv, T, Rz

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OPT = dict((a.split('=', 1) + ['1'])[:2] for a in ARGV)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = os.path.join(ROOT, 'art', 'ashfall'); TEXDIR = os.path.join(BASE, 'tex'); CACHE = os.path.join(BASE, '_cache'); PROOF = os.path.join(ROOT, 'art', 'proof', 'tex')
for d in (TEXDIR, CACHE): os.makedirs(d, exist_ok=True)
scene = bpy.context.scene
if not bpy.data.filepath.replace('\\', '/').endswith('art/ashfall/street.blend'):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, 'street.blend')); log('created', bpy.data.filepath)
for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
    for d in list(coll):
        if d.users == 0: coll.remove(d)
scene.render.fps = 30
random.seed(7)

# ---------------------------------------------------------------- pictures (1024, tiling): the yard's, dusted with ash, plus painted ones
ASH = np.array((0.66, 0.64, 0.60), np.float32)
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
TILE = {'asphalt': 5.0, 'concrete': 3.0, 'brick': 3.0, 'plaster': 4.0, 'metal': 2.5, 'rust': 2.5, 'wood': 2.0, 'sandbag': 1.2, 'glass': 2.5, 'dirt': 6.0}
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
bm = bmesh.new(); MI = {k: i for i, k in enumerate(MATS)}
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
    f = bm.faces.new(vs); f.material_index = MI[mat]; return f
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
    for x0, x1 in ((-16, -8), (8, 16)): quad(x0, -26, x1, 24, 'concrete')
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
    LIGHTS.append(((x0 + x1) / 2, (y0 + y1) / 2, 2.9, 180, (1.0, 0.75, 0.45)))
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
def build():
    ground()
    H = 7.0
    # boundary wall all round
    for x in (-22.4, 22.4): box((x, 0, 0), (0.5, 72, 4.0), 'brick')
    for y in (-35.4, 35.4): box((0, y, 0), (45, 0.5, 4.0), 'brick')
    # west row (street side at x = -8, facing +x)
    block(-16, -8, -26, -14, H, +1, sign=None)
    open_shop(-16, -8, -12, 0, 6.2, +1, (-7.0, -5.4), back_door=(-3.0, -1.6), counter=(-11.5, -6.5, 4.5), sign='emissive_sign')
    block(-16, -8, 2.5, 14, 7.6, +1, mat='plaster')
    open_shop(-16, -8, 14, 24, 6.0, +1, (18.0, 19.6), back_door=(20.5, 22.0), counter=(-12.5, 18.5, 5.0))
    # east row (street side at x = 8, facing -x)
    block(8, 16, -26, -16, 6.5, -1, mat='plaster')
    open_shop(8, 16, -13.5, -2, 6.4, -1, (-9.0, -7.4), back_door=(-5.0, -3.6), counter=(11.5, -10.0, 4.0))
    block(8, 16, -2, 10, H, -1, sign='emissive_sign')
    block(8, 16, 12.5, 24, 6.6, -1, mat='plaster')
    # back lot (west) clutter and service lane (east): crates, a skip, a fence line with gaps
    box((-19.5, -6, 0), (2.0, 4.0, 1.4), 'rust', 0.1, 0.05); box((-20.0, 10, 0), (1.4, 1.4, 1.2), 'wood', 0.3); box((-18.5, 12.0, 0), (1.2, 1.2, 1.0), 'wood', -0.2)
    box((-19.0, -20, 0), (3.0, 1.2, 1.1), 'wood', 0.05); wall_y(17.0, -22.2, -16.0, 2.0, 'wood', [(-20.5, -18.5)], 0.15)
    box((19.5, -8, 0), (1.6, 3.0, 1.5), 'rust', 0.0, 0.05); box((19.0, 4, 0), (1.2, 1.2, 1.0), 'wood', 0.4); box((20.0, 16.0, 0), (2.2, 1.0, 1.2), 'metal', 0.0, 0.05)
    # petrol station (north)
    for x in (-5.0, 5.0):
        for y in (26.5, 32.5): box((x, y, 0), (0.45, 0.45, 4.8), 'metal')
    box((0, 29.5, 4.8), (14.5, 9.5, 0.6), 'metal', 0.0, 0.08)
    for x in (-3.0, 0.0, 3.0): box((x, 29.5, 4.76), (0.5, 7.0, 0.06), 'emissive_lamp'); LIGHTS.append((x, 29.5, 4.4, 120, (1.0, 0.85, 0.6)))
    for x in (-2.4, 2.4): box((x, 29.5, 0), (1.2, 3.2, 0.25), 'concrete'); box((x, 28.6, 0.25), (0.6, 0.8, 1.5), 'metal', 0, 0.05); box((x, 30.4, 0.25), (0.6, 0.8, 1.5), 'metal', 0, 0.05)
    box((15.0, 30.0, 0), (10.0, 8.0, 4.0), 'plaster'); facade(10.0, 26.0, 34.0, -1, 4.0, sign='emissive_sign')
    box((-17.0, 31.0, 0), (6.0, 4.0, 3.2), 'brick'); car(-9.0, 28.0, 0.5, 'metal'); car(8.0, 33.0, 1.4)
    sandbags(-8.0, 23.0, -4.0, 23.6); sandbags(4.0, 23.6, 7.5, 23.0); sandbags(-20.0, 26.0, -20.0, 22.0)
    # street: wrecks, the bus slewed across, barricades, a burning barrel, dead lamp posts
    bus(0.6, -4.0, math.radians(35))
    for x, y, a, m in ((-2.7, 10.0, 8, 'rust'), (2.8, 16.0, -15, 'metal'), (-2.5, -16.0, 175, 'metal'), (2.7, -21.0, 190, 'rust'), (-1.0, 20.5, 70, 'rust'), (3.2, 3.0, 5, 'metal')):
        car(x, y, math.radians(a), m)
    sandbags(-4.5, -11.0, -1.0, -11.6); sandbags(1.0, 6.5, 4.6, 7.0); sandbags(-7.2, -18.5, -7.2, -21.5); sandbags(6.0, -24.0, 2.0, -24.5)
    cyl((-6.6, 8.0, 0), 0.32, 0.9, 'rust', 12, top_mat='emissive_fire'); LIGHTS.append((-6.6, 8.0, 1.3, 260, (1.0, 0.5, 0.18)))
    cyl((6.8, -14.0, 0), 0.32, 0.9, 'rust', 12, top_mat='emissive_fire'); LIGHTS.append((6.8, -14.0, 1.3, 220, (1.0, 0.5, 0.18)))
    for y in (-20.0, -6.0, 8.5, 21.0):
        cyl((-7.4, y, 0), 0.09, 6.0, 'metal', 8); cyl((7.4, y + 3.0, 0), 0.09, 6.0, 'metal', 8)
    # the collapsed building closing the south end: tumbled slabs and rubble mounds across the full width
    for i in range(46):
        x = random.uniform(-22, 22); y = random.uniform(-35, -27.5); s = random.uniform(1.2, 3.5)
        box((x, y, random.uniform(-0.6, 0.2)), (s, s * random.uniform(0.6, 1.4), random.uniform(1.0, 4.0)), random.choice(['concrete', 'brick', 'concrete']),
            random.uniform(0, 3.14), 0.0)
    box((0.0, -29.0, 0), (30.0, 3.0, 2.2), 'concrete', 0.03)
    box((-3.0, -31.0, 0), (9.0, 0.6, 6.5), 'brick', 0.2); box((6.0, -32.0, 0), (7.0, 0.6, 5.0), 'plaster', -0.25)
    # ash heaps against walls and in corners (walkable, lower than 0.45 m)
    for x, y, rx, ry, rz in ((-7.6, -24, 0.9, 2.5, 0), (-7.6, 6.5, 0.8, 1.8, 0), (7.6, -18, 0.8, 2.2, 0), (7.6, 18, 0.9, 2.6, 0), (-21.6, 0, 1.0, 3.0, 0),
                             (21.6, -2, 1.0, 3.5, 0), (-15.5, 1.2, 0.7, 1.0, 0), (15.5, 11.2, 0.7, 1.0, 0), (-4.8, 0.0, 0.7, 3.0, 0.1), (4.8, 12.0, 0.7, 2.6, -0.1),
                             (0.0, -26.5, 4.0, 1.2, 0), (-12.0, 34.6, 3.0, 0.8, 0), (12.0, 22.0, 1.4, 0.8, 0.3)):
        heap((x, y, 0.0), rx, ry, 0.35)
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
    sd = bpy.data.lights.new('Sun', 'SUN'); sd.energy = 4.2; sd.color = (1.0, 0.62, 0.38); sd.angle = math.radians(2.5)
    so = bpy.data.objects.new('Sun', sd); lc.objects.link(so); so.rotation_euler = (math.radians(80), 0, math.radians(-62))
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
    nt.links.new(ramp.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = 1.0; nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
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
    rgb = a[:, :, :3]; blur = rgb.copy()
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)): blur += np.roll(np.roll(rgb, dy, 0), dx, 1)
    a[:, :, :3] = blur / 5.0; img.pixels.foreach_set(a.ravel())
    path = os.path.join(TEXDIR, 'street_light.exr'); img.filepath_raw = path; img.file_format = 'OPEN_EXR'; img.save()
    for m in me.materials:
        n = m.node_tree.nodes.get('hg_bake')
        if n: m.node_tree.nodes.remove(n)
    me.uv_layers.active = me.uv_layers['UVMap']
    lum = (rgb @ np.array((0.3, 0.59, 0.11), np.float32)); nz = lum[lum > 0]
    log('baked', path, 'light median %.2f, 90%% %.2f' % (float(np.median(nz)), float(np.percentile(nz, 90))))
    bpy.data.images.remove(img)

# ---------------------------------------------------------------- run
make_pictures(); mats = materials(); build()
me = bpy.data.meshes.new('street'); bm.to_mesh(me); bm.free()
for m in mats: me.materials.append(m)
uv_world(me)
mc = bpy.data.collections.new('map'); scene.collection.children.link(mc)
ob = bpy.data.objects.new('street', me); mc.objects.link(ob)
me.calc_loop_triangles(); log('street', len(me.loop_triangles), 'triangles,', len(me.vertices), 'verts')
lu = me.uv_layers.new(name='Lightmap'); me.uv_layers.active = lu
smart_uv(ob, 66, 0.004)
uvd = me.uv_layers['Lightmap']; me.uv_layers.active = me.uv_layers['UVMap']
lights()
if 'nobake' not in OPT: bake(ob, 2048, int(OPT.get('samples', 40)))
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
    views = [((0, -24, 1.6), (0, 10, 1.4)), ((-1, 22, 1.6), (0, -10, 1.0)), ((-12, -9, 1.6), (-9, -3, 1.2)), ((-19, -14, 1.6), (-19, 10, 1.2)),
             ((3, 26, 1.6), (0, 32, 2.5)), ((12, -9, 1.6), (6, -2, 1.2))]
    big = np.ones((3 * 270, 2 * 480, 4), np.float32)
    for i, (p, t) in enumerate(views):
        cam.location = p; cam.rotation_euler = (Vector(t) - Vector(p)).to_track_quat('-Z', 'Y').to_euler()
        tmp = os.path.join(CACHE, '_st%d.png' % i); scene.render.filepath = tmp; bpy.ops.render.render(write_still=True)
        im = bpy.data.images.load(tmp); a = np.array(im.pixels[:], np.float32).reshape(270, 480, 4); bpy.data.images.remove(im); os.remove(tmp)
        r, c = divmod(i, 2); big[(2 - r) * 270:(3 - r) * 270, c * 480:(c + 1) * 480] = a
    im = bpy.data.images.new('st_grid', 960, 810); im.pixels.foreach_set(big.ravel()); im.filepath_raw = os.path.join(CACHE, 'street_views.png'); im.file_format = 'PNG'; im.save()
    log('preview street_views.png')
log('done')
