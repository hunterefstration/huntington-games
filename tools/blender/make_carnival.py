# ASHFALL map "THE FAIRGROUND" in art/ashfall/carnival.blend (made from make_yard.py: same pipeline, its own layout below).
#   blender -b art/ashfall/carnival.blend -P tools/blender/make_carnival.py -- [nobake] [preview]   (first time: --factory-startup)
# then node tools/export-art.mjs carnival -> Ashfall/assets/carnival.hgm
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
BLOOM = 'plain' not in OPT       # the glowing-growth night look (ash_paint.py, see make_yard.py); `plain` builds the old look exactly as before
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = os.path.join(ROOT, 'art', 'ashfall'); TEXDIR = os.path.join(BASE, 'tex'); CACHE = os.path.join(BASE, '_cache'); PROOF = os.path.join(ROOT, 'art', 'proof', 'tex')
for d in (TEXDIR, CACHE): os.makedirs(d, exist_ok=True)
scene = bpy.context.scene
if not bpy.data.filepath.replace('\\', '/').endswith('art/ashfall/carnival.blend'):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, 'carnival.blend')); log('created', bpy.data.filepath)
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
    import ash_paint; ash_paint.repaint(PICS, save_image, dust, TEXDIR, 'street_', 'carnival')      # painted metal and old steel, this map's colours (less rust)
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

LIGHTS = []
XH, YH = 50.0, 45.0
MAPNAME = 'carnival'
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
def canvas_pic(N=1024):
    y, x = np.mgrid[0:N, 0:N].astype(np.float32); n1 = tile_noise(N, 48, 31); n2 = tile_noise(N, 6, 33)
    st = ((x // (N // 4)) % 2)[..., None]
    a = np.array((0.42, 0.09, 0.07), np.float32) * (1 - st) + np.array((0.60, 0.54, 0.43), np.float32) * st
    a = a * (0.85 + 0.25 * n1[..., None]) * (0.94 + 0.12 * n2[..., None])
    stain = np.clip((tile_noise(N, 300, 35) - 0.55) * 3, 0, 1)[..., None]; a = a * (1 - 0.35 * stain)
    return dust(np.clip(a, 0.04, 1), 0.25, 97)
def turf_pic(N=1024):
    n1 = tile_noise(N, 96, 41); n2 = tile_noise(N, 10, 43); n3 = tile_noise(N, 3, 45)
    mud = np.array((0.20, 0.16, 0.12), np.float32); grass = np.array((0.17, 0.19, 0.11), np.float32)
    g = np.clip((n1 - 0.45) * 3, 0, 1)[..., None]; a = mud * (1 - g) + grass * g
    a = a * (0.8 + 0.4 * n2[..., None]) * (0.9 + 0.2 * n3[..., None]); lit = (n3 > 0.8)[..., None] & (n1 < 0.5)[..., None]
    a = np.where(lit, np.array((0.42, 0.40, 0.36), np.float32), a)
    return dust(np.clip(a, 0.03, 1), 0.15, 99)
from mapkit import install; install(globals())
add_pics({'canvas': (2.0, canvas_pic), 'turf': (4.0, turf_pic), 'grime': (2.0, grime_pic), 'paint': (1.5, paint_pic)})
EMIT['emissive_lamp'] = (1.0, 0.72, 0.38)
WARM = (1.0, 0.68, 0.36); MAST = (1.0, 0.82, 0.6); FIRE = (1.0, 0.45, 0.15)
FLOORS = []
def ground(): pass
NLIT = [0]
def bulb(x, y, z, lit_p=0.15, w=0):
    """a festoon bulb: lit ones glow but throw no light of their own (the light comes from a few masts, not from a scatter of bulbs)"""
    if random.random() < lit_p: box((x, y, z - 0.05), (0.1, 0.1, 0.1), 'emissive_lamp'); NLIT[0] += 1
    else: box((x, y, z - 0.05), (0.08, 0.08, 0.08), 'glass')
def bulb_string(p0, p1, sag=0.5, step=0.9, lit_p=0.3, flags=False):
    p0, p1 = Vector(p0), Vector(p1); n = max(2, int((p1 - p0).length / step)); pts = []
    for k in range(n + 1):
        t = k / n; p = p0.lerp(p1, t); p.z -= sag * 4 * t * (1 - t); pts.append(p)
    for a, b in zip(pts[::3], pts[3::3] + [pts[-1]]): beam(a, b, 0.02, 'metal')
    for i, p in enumerate(pts[1:-1]):
        if flags and i % 2: box((p.x, p.y, p.z - 0.32), (0.26, 0.02, 0.3), random.choice(('canvas', 'paint', 'brick')), math.atan2(p1.y - p0.y, p1.x - p0.x))
        else: bulb(p.x, p.y, p.z, lit_p)
POLES = set()
def pole(x, y, h=5.0):
    k = (round(x, 1), round(y, 1))
    if k in POLES: return
    POLES.add(k); cyl((x, y, 0), 0.09, h, 'wood', 6)
def mast(x, y, w=650, h=9.0, rz=0.0):
    """a lighting mast: a lattice of three tubes and a head of four lamps: one big pool"""
    pts = [P(x, y, a, 0.25, 0) for a in (0.0, 2.094, 4.189)]
    for px, py in pts: tube((px, py, 0.3), (px, py, h), 0.04, 'metal', 6)
    box((x, y, 0), (1.0, 1.0, 0.3), 'concrete')
    for k in range(int(h / 1.2)):
        for i in range(3): a, b = pts[i], pts[(i + 1) % 3]; beam((a[0], a[1], 0.6 + k * 1.2), (b[0], b[1], 1.2 + k * 1.2), 0.03, 'metal')
    B(x, y, rz, 0, 0, h, (1.6, 0.3, 0.12), 'metal')
    for dx in (-0.55, 0.0, 0.55): B(x, y, rz, dx, 0, h - 0.32, (0.4, 0.3, 0.3), 'metal'); B(x, y, rz, dx, 0, h - 0.36, (0.3, 0.22, 0.04), 'emissive_lamp')
    LIGHTS.append((x, y, h - 0.7, w, MAST))
def hoarding():
    for s in (-1, 1): box((s * (XH + 0.1), 0, 0), (0.2, 2 * YH, 2.6), 'wood')
    box((0, YH + 0.1, 0), (2 * XH + 0.4, 0.2, 2.6), 'wood')
    for a, b in ((-XH - 0.2, -5.6), (5.6, XH + 0.2)): box(((a + b) / 2, -YH - 0.1, 0), (b - a, 0.2, 2.6), 'wood')
    for x in range(-48, 49, 4):
        for y in (-YH, YH):
            if abs(x) > 6: box((x, y + (0.26 if y < 0 else -0.26), 0), (0.14, 0.14, 2.8), 'wood')
    for k, x in enumerate(range(-44, 45, 11)):                                      # torn posters on the inside of the hoarding
        if abs(x) > 8: sign(x, -YH + 0.4, 1.0, 1.6, 1.1, math.pi, random.choice(('canvas', 'paint', 'brick')), 'wood')
        sign(x + 3.0, YH - 0.4, 1.0, 1.6, 1.1, 0.0, random.choice(('canvas', 'paint', 'brick')), 'wood')
def gate():
    y = -YH
    for s in (-1, 1): box((s * 5.0, y, 0), (1.2, 1.2, 5.5), 'brick'); box((s * 7.6, y + 3.0, 0), (2.2, 2.2, 2.6), 'wood'); box((s * 7.6, y + 3.0, 2.6), (2.6, 2.6, 0.15), 'canvas')
    for s in (-1, 1): box((s * 6.45, y + 3.0, 1.0), (0.05, 1.2, 0.8), 'glass')
    box((0, y, 4.6), (8.76, 0.5, 1.6), 'canvas'); box((0, y - 0.3, 5.0), (7.0, 0.08, 0.7), 'emissive_sign')
    for k in range(13): bulb(-6.0 + k, y - 0.32, 6.25, 0.5)
    for x in (-2.6, 0.0, 2.6): box((x, y + 0.5, 0), (0.4, 0.9, 1.0), 'metal')            # turnstiles: 2.2 m between
    for s in (-1, 1): box((s * 2.2, y - 0.45, 0), (4.38, 0.2, 2.4), 'metal'); box((s * 2.2, y - 0.45, 2.4), (4.38, 0.06, 0.08), 'rust')   # the gates, chained shut
    for s in (-1, 1):                                                                 # queue rails inside the gate, lanes 2 m
        for x in (s * 1.5, s * 3.8): box((x, y + 4.5, 0), (0.06, 4.0, 0.06), 'metal'); box((x, y + 4.5, 0.9), (0.06, 4.0, 0.05), 'metal')
        for x in (s * 1.5, s * 3.8):
            for dy in (-1.95, 0.0, 1.95): cyl((x, y + 4.5 + dy, 0), 0.04, 0.95, 'metal', 6)
    mast(10.0, y + 7.0, 520)
def stall(cx, cy, rz, w=3.2, d=3.0, burning=False):
    """a game stall facing +y in its own frame (counter at the front), back and side walls, a striped awning, a sign board, prizes"""
    def Bs(dx, dy, z, s, mat): x, y = P(cx, cy, rz, dx, dy); box((x, y, z), s, mat, rz)
    Bs(0, -d / 2, 0, (w, 0.2, 2.6), 'wood')
    for s in (-1, 1): Bs(s * w / 2, 0, 0, (0.2, d - 0.2, 2.6), 'canvas')
    Bs(0.95, d / 2 - 0.3, 0, (w - 1.9, 0.6, 1.0), 'wood')                 # a 1.8 m gap at one end to get behind
    Bs(0.95, d / 2 - 0.3, 1.0, (w - 1.86, 0.64, 0.04), 'paint')
    if random.random() < 0.2: x, y = P(cx, cy, rz, 0, 0.3); box((x, y, 2.2), (w + 0.4, d + 1.0, 0.08), 'canvas', rz); beam(P(cx, cy, rz, -w / 2, d / 2 + 0.4) + (2.6,), P(cx, cy, rz, w / 2, d / 2 + 0.4) + (2.0,), 0.1, 'wood')
    else: Bs(0, 0.4, 2.62, (w + 0.5, d + 0.8, 0.08), 'canvas')
    Bs(0, -d / 2 + 0.25, 1.2, (w - 0.45, 0.3, 0.05), 'wood'); Bs(0, -d / 2 + 0.25, 1.8, (w - 0.45, 0.3, 0.05), 'wood')
    for k in range(4):
        x, y = P(cx, cy, rz, -w / 2 + 0.6 + k * 0.65, -d / 2 + 0.25); box((x, y, 1.25 + 0.6 * (k % 2)), (0.3, 0.22, 0.35), random.choice(('plaster', 'canvas', 'metal', 'paint')), rz)
    Bs(0, -d / 2 - 0.14, 2.75, (w - 0.4, 0.08, 0.7), random.choice(('paint', 'brick', 'canvas', 'emissive_sign')))    # the sign over the back wall
    for k in range(4):
        x, y = P(cx, cy, rz, -w / 2 + 0.4 + k * (w - 0.8) / 3, d / 2 + 0.75); bulb(x, y, 2.6, 0.25)
    if burning:
        x, y = P(cx, cy, rz, 0, -0.75); box((x, y, 0), (1.2, 0.6, 0.5), 'grime', rz); box((x, y, 0.5), (0.9, 0.4, 0.06), 'emissive_fire', rz); LIGHTS.append((x, y, 1.5, 45, FIRE))
def carousel(cx, cy):
    cyl((cx, cy, 0), 7.0, 0.3, 'wood', 24); cyl((cx, cy, 0.3), 1.6, 3.5, 'plaster', 14); cyl((cx, cy, 2.6), 1.63, 0.5, 'emissive_sign', 14)
    cyl((cx, cy, 3.8), 7.4, 0.6, 'canvas', 24); cone((cx, cy, 4.4), 7.6, 1.0, 1.8, 'canvas', 24); cyl((cx, cy, 6.2), 0.15, 1.2, 'metal', 6)
    LIGHTS.append((cx + 3.0, cy, 3.3, 160, WARM))                                   # the lit crown under the canopy
    for ring, n in ((5.4, 12), (3.8, 8)):
        for k in range(n):
            a = 2 * math.pi * (k + 0.5 * (ring < 5)) / n; x, y = cx + ring * math.cos(a), cy + ring * math.sin(a)
            cyl((x, y, 0.3), 0.05, 3.5, 'metal', 6)
            if random.random() < 0.6:
                h = random.uniform(0.0, 0.4); px, py = P(x, y, a + math.pi / 2, 0, 0)
                box((px, py, 0.31), (0.9, 0.25, 0.45 + h), 'plaster', a + math.pi / 2); box((px, py, 0.76 + h), (1.3, 0.32, 0.55), 'plaster', a + math.pi / 2)
                hx, hy = P(x, y, a + math.pi / 2, 0.65, 0); box((hx, hy, 1.12 + h), (0.3, 0.25, 0.55), 'plaster', a + math.pi / 2 - 0.4)
    for k in range(24):
        a = 2 * math.pi * k / 24; bulb(cx + 7.45 * math.cos(a), cy + 7.45 * math.sin(a), 3.78, 0.6)
    for k in range(5): a = 2 * math.pi * k / 5 + 0.3; box((cx + 7.2 * math.cos(a), cy + 7.2 * math.sin(a), 0), (0.5, 0.5, 0.42), 'wood', a)     # steps up
def ferris(cx, cy):
    """the wheel faces south (in the x-z plane): a backdrop on its base, only the base and legs are in reach"""
    R, hz = 15.0, 17.5
    box((cx, cy, 0), (14.0, 5.0, 0.9), 'concrete'); box((cx, cy - 3.0, 0), (4.0, 1.0, 0.45), 'concrete')
    for sy in (-1, 1):
        for sx in (-1, 1): beam((cx + sx * 6.5, cy + sy * 1.8, 0.9), (cx, cy + sy * 1.0, hz), 0.45, 'rust')
        beam((cx - 4.0, cy + sy * 1.6, 6.0), (cx + 4.0, cy + sy * 1.6, 6.0), 0.25, 'rust')
    beam((cx, cy - 1.3, hz), (cx, cy + 1.3, hz), 0.9, 'metal')
    N = 32
    for ring in (R, R - 1.6):
        for sy in (-0.8, 0.8):
            for k in range(N):
                a0, a1 = 2 * math.pi * k / N, 2 * math.pi * (k + 1) / N
                beam((cx + ring * math.cos(a0), cy + sy, hz + ring * math.sin(a0)), (cx + ring * math.cos(a1), cy + sy, hz + ring * math.sin(a1)), 0.22, 'rust')
    for k in range(16):
        a = 2 * math.pi * k / 16
        for sy in (-0.8, 0.8): beam((cx + 0.5 * math.cos(a), cy + sy, hz + 0.5 * math.sin(a)), (cx + R * math.cos(a), cy + sy, hz + R * math.sin(a)), 0.14, 'rust')
        x, z = cx + R * math.cos(a), hz + R * math.sin(a)
        if k == 12: continue                                     # the gondola that fell
        beam((x, cy - 1.0, z), (x, cy + 1.0, z), 0.1, 'metal'); box((x, cy, z - 2.2), (1.6, 1.4, 1.5), random.choice(('canvas', 'metal', 'rust')), 0.0)
        box((x, cy, z - 0.7), (1.8, 1.6, 0.1), 'metal')
        if k % 2 == 0: bulb(x, cy - 1.15, z, 0.6)
    box((cx + 9.0, cy - 6.0, 0), (1.6, 1.5, 1.4), 'rust', 0.7); heap((cx + 9.5, cy - 6.5, 0), 1.6, 1.0, 0.12, 'glass')
    box((cx - 9.5, cy - 4.0, 0), (2.0, 2.0, 2.5), 'wood'); box((cx - 9.5, cy - 4.0, 2.5), (2.4, 2.4, 0.12), 'canvas')       # the ticket box
    for x in (cx - 4.0, cx - 1.8, cx + 1.8, cx + 4.0): box((x, cy - 7.0, 0), (0.06, 4.0, 0.06), 'metal'); box((x, cy - 7.0, 0.9), (0.06, 4.0, 0.05), 'metal')
    mast(cx + 12.0, cy - 7.0, 600)
def ghost_train(x0, y0, x1, y1):
    Hs = 5.0; d1, d2 = (x0 + 2.5, x0 + 5.0), (x1 - 5.0, x1 - 2.5)
    wy_(y0, x0, x1, Hs, 'plaster', [d1, d2]); wy_(y1, x0, x1, Hs, 'plaster', [])
    wx_(x0, y0 + 0.125, y1 - 0.125, Hs, 'plaster', []); wx_(x1, y0 + 0.125, y1 - 0.125, Hs, 'plaster', [])
    box(((x0 + x1) / 2, (y0 + y1) / 2, Hs + 0.01), (x1 - x0 + 0.6, y1 - y0 + 0.4, 0.3), 'metal')
    box(((x0 + x1) / 2, y0 - 0.4, Hs - 0.6), (x1 - x0 + 0.5, 0.3, 3.6), 'plaster'); box(((x0 + x1) / 2, y0 - 0.61, Hs + 0.9), (9.0, 0.08, 1.4), 'emissive_sign')
    LIGHTS.append(((x0 + x1) / 2, y0 - 2.5, Hs + 0.2, 110, (1.0, 0.35, 0.12)))
    for x, y_a, y_b in ((x0 + 6.5, y0 + 0.125, y1 - 3.5), (x0 + 11.0, y0 + 3.5, y1 - 0.125), (x1 - 6.0, y0 + 0.125, y1 - 3.5)): wx_(x, y_a, y_b, Hs, 'brick', [])
    FLOORS.append((x0, y0, x1, y1, 'wood'))
    for x, y in ((x0 + 3.7, y0 + 4.0), (x0 + 8.7, y1 - 2.0), (x1 - 8.5, y0 + 2.5), (x1 - 3.7, y0 + 6.0)): box((x, y, 0), (1.3, 2.0, 0.9), 'rust', 0.2)
    for x, y in ((x0 + 5.8, y1 - 1.5), (x0 + 12.0, y0 + 1.0), (x1 - 1.0, y1 - 2.0)): box((x, y, 0), (0.5, 0.4, 2.1), 'plaster', 0.3); box((x, y, 2.1), (0.4, 0.35, 0.4), 'plaster')
    LIGHTS.append((x0 + 9.0, y1 - 2.0, 3.5, 35, (1.0, 0.1, 0.05))); box((x0 + 9.0, y1 - 0.3, 3.6), (0.3, 0.2, 0.3), 'emissive_fire')
    for x in (x0 + 3.0, x1 - 3.0): box((x, y0 - 1.6, 0), (1.2, 1.6, 0.8), 'rust', 0.1); box((x, y0 - 1.6, 0.8), (1.0, 0.3, 0.6), 'rust', 0.1)   # cars waiting outside
def wx_(x, y0, y1, h, mat, gaps=(), th=0.25, dh=2.6):
    ys = [y0] + [g for ab in sorted(gaps) for g in ab] + [y1]
    for i in range(0, len(ys), 2):
        a, b = ys[i], ys[i + 1]
        if b - a > 0.01: box((x, (a + b) / 2, 0), (th, b - a, h), mat)
    for a, b in gaps: box((x, (a + b) / 2, dh), (th, b - a, h - dh), mat)
def wy_(y, x0, x1, h, mat, gaps=(), th=0.25, dh=2.6):
    xs = [x0] + [g for ab in sorted(gaps) for g in ab] + [x1]
    for i in range(0, len(xs), 2):
        a, b = xs[i], xs[i + 1]
        if b - a > 0.01: box(((a + b) / 2, y, 0), (b - a, th, h), mat)
    for a, b in gaps: box(((a + b) / 2, y, dh), (b - a, th, h - dh), mat)
def food_truck(cx, cy, rz):
    def Bf(dx, dy, z, s, mat, r=0.0): x, y = P(cx, cy, rz, dx, dy); box((x, y, z), s, mat, rz + r)
    Bf(0, 0.7, 0.5, (2.4, 4.8, 2.5), 'plaster'); Bf(0, -2.6, 0.5, (2.3, 1.6, 1.7), 'metal'); Bf(0, -3.42, 1.4, (2.0, 0.04, 0.6), 'glass')
    for dx in (-1.05, 1.05):
        for dy in (-2.5, 1.9): Bf(dx * 1.067, dy, 0, (0.3, 0.9, 0.9), 'grime')
    Bf(1.22, 0.8, 1.3, (0.04, 3.0, 1.0), 'rust'); Bf(1.6, 0.8, 2.35, (0.9, 3.2, 0.06), 'canvas'); Bf(1.24, 0.8, 2.6, (0.06, 3.4, 0.4), 'emissive_sign' if random.random() < 0.5 else 'canvas')
    x, y = P(cx, cy, rz, 2.2, 0.8); bulb(x, y, 2.3, 0.5)
def picnic(x, y, rz=0.0):
    """a bench table: 0.75 top (cover you can see over), benches either side (0.45: you step on them)"""
    B(x, y, rz, 0, 0, 0.72, (1.8, 0.8, 0.05), 'wood')
    for s in (-1, 1): B(x, y, rz, 0, s * 0.62, 0.4, (1.8, 0.28, 0.04), 'wood'); B(x, y, rz, s * 0.7, 0, 0, (0.08, 1.5, 0.4), 'wood'); B(x, y, rz, s * 0.7, 0, 0.4, (0.08, 0.1, 0.32), 'wood')
def big_top(cx, cy, r=9.0):
    """the circus tent: canvas skirt walls with two 3 m ways in, a peaked roof on poles, a ring (step over it), banked seats (cover)"""
    n = 24; gaps = {5, 6, 17, 18}
    for k in range(n):
        if k in gaps: continue
        a0, a1 = 2 * math.pi * k / n, 2 * math.pi * (k + 1) / n; p0 = (cx + r * math.cos(a0), cy + r * math.sin(a0)); p1 = (cx + r * math.cos(a1), cy + r * math.sin(a1))
        L = math.hypot(p1[0] - p0[0], p1[1] - p0[1]); box(((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, 0), (L - 0.02, 0.22, 2.4), 'canvas', math.atan2(p1[1] - p0[1], p1[0] - p0[0]))
    for k in range(12): a = 2 * math.pi * (k + 0.5) / 12; cyl((cx + (r + 0.1) * math.cos(a), cy + (r + 0.1) * math.sin(a), 0), 0.08, 2.6, 'wood', 6)
    for s in (-1, 1): cyl((cx + s * 1.5, cy, 0), 0.14, 10.0, 'wood', 8)
    cyl((cx, cy, 2.62), r + 0.3, 0.3, 'canvas', 24); cone((cx, cy, 2.92), r + 0.3, 0.6, 6.5, 'canvas', 24)
    cyl((cx, cy, 10.0), 0.08, 1.5, 'metal', 6); box((cx + 0.4, cy, 10.8), (0.8, 0.02, 0.5), 'brick')
    for k in range(16):
        a0, a1 = 2 * math.pi * k / 16, 2 * math.pi * (k + 1) / 16
        p0 = (cx + 3.4 * math.cos(a0), cy + 3.4 * math.sin(a0)); p1 = (cx + 3.4 * math.cos(a1), cy + 3.4 * math.sin(a1))
        if k in (3, 11): continue
        box(((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, 0), (math.hypot(p1[0] - p0[0], p1[1] - p0[1]) - 0.02, 0.3, 0.4), 'paint' if k % 2 else 'brick', math.atan2(p1[1] - p0[1], p1[0] - p0[0]))
    FLOORS.append((cx - 3.0, cy - 3.0, cx + 3.0, cy + 3.0, 'dirt'))
    for base_a in (0.0, math.pi):                                                    # two banks of seats, between the ways in
        for row in range(3):
            rr = 5.0 + row * 0.8
            for j in range(5):
                a = base_a - 0.75 + j * 0.375; px, py = cx + rr * math.cos(a), cy + rr * math.sin(a)
                box((px, py, 0), (rr * 0.375 - 0.08, 0.78, 0.45 + row * 0.45), 'wood', a + math.pi / 2)
    box((cx + 1.0, cy - 1.0, 0), (0.6, 0.6, 0.6), 'brick', 0.4); box((cx - 1.2, cy + 0.6, 0), (0.9, 0.9, 0.5), 'paint', 0.2)        # ring tubs
    LIGHTS.append((cx, cy, 2.1, 110, WARM)); box((cx + 2.5, cy, 2.42), (0.5, 0.5, 0.2), 'metal'); box((cx + 2.5, cy, 2.37), (0.4, 0.4, 0.05), 'emissive_lamp')
def bumper_rink(cx, cy, w=14.0, d=9.0):
    """the dodgems: a steel floor in a rail (0.5 m: you vault it nowhere, there are two ways in), cars (cover you can see over), a roof on posts"""
    x0, x1, y0, y1 = cx - w / 2, cx + w / 2, cy - d / 2, cy + d / 2
    FLOORS.append((x0, y0, x1, y1, 'metal'))
    for (a, b) in ((x0 + 0.125, cx - 2.0), (cx + 2.0, x1 - 0.125)): box(((a + b) / 2, y0, 0), (b - a, 0.25, 0.55), 'paint'); box(((a + b) / 2, y1, 0), (b - a, 0.25, 0.55), 'paint')
    for x in (x0, x1): box((x, cy, 0), (0.25, d - 0.25, 0.55), 'paint')
    for x in (x0, cx, x1):
        for y in (y0, y1): box((x, y, 0), (0.2, 0.2, 4.0), 'metal')
    box((cx, cy, 4.0), (w + 0.6, d + 0.6, 0.15), 'canvas'); box((cx, cy, 3.6), (w - 0.6, d - 0.6, 0.04), 'metal')
    box((cx, y0 - 0.42, 3.3), (5.0, 0.08, 0.7), 'emissive_sign')
    for k, (x, y, r) in enumerate(((cx - 4.5, cy - 2.0, 0.4), (cx - 1.0, cy + 2.5, 2.0), (cx + 2.5, cy - 1.5, -0.6), (cx + 3.8, cy + 2.2, 3.5), (cx + 0.5, cy + 0.5, 1.2), (cx + 1.2, cy - 2.8, 0.1))):
        B(x, y, r, 0, 0, 0, (1.2, 1.8, 0.55), random.choice(('brick', 'paint', 'canvas')), 0, 0.12); B(x, y, r, 0, -0.3, 0.55, (0.9, 0.7, 0.3), 'grime')
        bx, by = P(x, y, r, 0, -0.75); cyl((bx, by, 0.55), 0.03, 3.04, 'metal', 6)
    LIGHTS.append((cx, cy, 3.2, 120, WARM)); box((cx, cy, 3.4), (0.6, 0.6, 0.2), 'metal'); box((cx, cy, 3.36), (0.5, 0.5, 0.04), 'emissive_lamp')
def generator(x, y, rz=0.0):
    B(x, y, rz, 0, 0, 0, (2.2, 1.1, 1.3), 'paint', 0, 0.04); B(x, y, rz, 0.4, 0, 1.3, (0.9, 0.5, 0.3), 'grime'); tube((*P(x, y, rz, -0.6, 0.2), 1.3), (*P(x, y, rz, -0.6, 0.2), 2.3), 0.06, 'grime')
def build():
    hoarding(); gate()
    FLOORS.extend([(-4.0, -YH, 4.0, 26.0, 'asphalt'), (4.0, -12.0, 40.0, -9.0, 'asphalt'), (-40.0, -12.0, -4.0, -9.0, 'asphalt'), (-4.0, -YH, 4.0, -40.0, 'concrete')])
    # stalls facing the midway, 1.8 m between them
    burn = {(1, 4), (-1, 1)}
    for side in (-1, 1):
        for k in range(7):
            y = -37.0 + k * 5.0
            if -14.0 < y < -9.0: continue
            stall(side * 7.4, y, side * math.pi / 2, burning=(side, k) in burn)
    for k in range(6):                                                           # two facing rows in the south-east, a lane between
        x = 15.0 + k * 5.0; stall(x, -28.5, 0.0); stall(x, -18.0, math.pi)
    for k in range(5): stall(-16.0 - k * 5.0, -27.0, 0.0)
    carousel(-31.0, 13.0); ferris(6.0, 37.0); ghost_train(18.0, 8.0, 38.0, 20.0); big_top(-30.0, 33.5); bumper_rink(-22.0, -3.5)
    food_truck(-30.0, -16.5, 1.57 + 0.2); food_truck(32.0, -3.5, -1.57 + 0.15); food_truck(14.0, -3.0, 1.57)
    # the eating place east of the midway: bench tables round the trucks, a generator, bins
    for x, y, r in ((18.0, -6.0, 0.1), (21.5, -5.2, -0.2), (19.2, -1.0, 0.3), (24.5, -1.5, 0.0), (26.0, -6.2, 0.2)): picnic(x, y, r)
    FLOORS.append((16.0, -8.0, 28.0, 1.0, 'concrete'))
    generator(28.5, 2.6, 0.2); cable([(27.5, 2.4), (24.0, 1.6), (18.0, 2.0), (14.0, 0.4)]); cable([(28.8, 2.0), (30.5, -1.0), (31.0, -3.0)])
    for x, y in ((16.8, -8.6), (27.4, -8.2)): barrel(x, y, 'metal', 0.3, 0.95); litter(x + 0.6, y + 0.8, 1.0, 6)
    mast(22.0, -9.6, 560, 9.0, 0.3)
    # bulb strings and bunting: zig-zag over the midway between poles (decoration: their bulbs glow, the masts give the light)
    ys = list(range(-40, 25, 8))
    for y in ys:
        for s in (-1, 1): pole(s * 4.6, y)
    for i, (a, b) in enumerate(zip(ys, ys[1:])):
        bulb_string((-4.6, a, 4.9), (4.6, b, 4.9), 0.6, flags=i % 2 == 1); bulb_string((4.6, a, 4.9), (-4.6, b, 4.9), 0.7, lit_p=0.15)
    for (x0, y0), (x1, y1) in (((-4.6, -8.0), (-17.0, -8.0)), ((4.6, 0.0), (18.0, 6.0)), ((-30.0, 24.0), (-4.6, 24.0)), ((40.0, -4.0), (4.6, -16.0))):
        pole(x0, y0); pole(x1, y1); bulb_string((x0, y0, 4.9), (x1, y1, 4.9), 0.8, lit_p=0.2, flags=True)
    for y in (-24.5, 2.0, 20.0):                                                     # banners across the midway, high on two poles
        for s in (-1, 1): cyl((s * 5.4, y, 0), 0.08, 6.2, 'metal', 6)
        box((0, y, 5.2), (10.6, 0.05, 0.8), random.choice(('canvas', 'paint')))
    mast(-5.6, -14.0, 620); mast(5.6, 8.0, 560); mast(-14.5, 21.0, 520)
    # clutter: hay bales, barrels, bins, benches, a high striker, a toppled cart, ground mess
    for x, y in ((-12.0, -4.0), (-13.4, -4.0), (-12.7, -5.0), (14.0, 26.0), (15.4, 26.0), (-44.0, -40.0), (44.0, 40.0), (-18.0, 26.0)): box((x, y, 0), (1.3, 0.8, 0.6), 'wood', 0.1 * x)
    box((-12.7, -4.5, 0.6), (1.3, 0.8, 0.6), 'wood', 1.3)
    for x, y in ((-10.0, 2.0), (11.0, -7.5), (24.0, -36.0), (-35.0, -10.0), (42.0, 8.0), (-44.0, 18.0), (28.0, 30.0)): barrel(x, y, random.choice(('rust', 'metal')), 0.32, 0.95)
    for x, y, r in ((-6.5, 18.0, 1.57), (6.5, 22.0, -1.57), (-16.0, -12.6, 0.0), (20.0, -12.6, 3.14)):
        box((x, y, 0), (2.0, 0.6, 0.45), 'wood', r); bx, by = P(x, y, r, 0, 0.27); box((bx, by, 0.45), (2.0, 0.08, 0.45), 'wood', r)
    cyl((-10.0, 28.0, 0), 0.15, 7.0, 'wood', 8); box((-10.0, 28.0, 0), (1.4, 1.0, 0.5), 'metal'); cyl((-10.0, 28.0, 7.0), 0.3, 0.3, 'metal', 10)
    sign(-10.0, 27.82, 2.0, 0.6, 3.0, 0.0, 'paint', 'wood')
    box((44.0, -30.0, 0), (2.6, 1.4, 0.9), 'rust', 1.1); box((-44.0, -20.0, 0), (3.0, 3.0, 2.4), 'wood'); box((-44.0, -20.0, 2.4), (3.4, 3.4, 0.15), 'canvas')
    for x, y in ((0.0, -30.0), (1.5, -6.0), (-1.2, 12.0), (2.0, 20.0), (-20.0, -10.5), (25.0, -10.5)): blob(x, y, random.uniform(0.6, 1.4), 'grime')
    for x, y in ((-2.0, -20.0), (2.5, 4.0), (-20.0, 22.0), (36.0, -23.0), (-28.0, -22.0)): blob(x, y, random.uniform(1.0, 1.8), 'glass', 12, 0.3)
    for x, y in ((0.0, -36.0), (-1.5, -2.0), (1.5, 15.0), (-30.0, 22.0), (27.0, -23.0), (-26.0, -21.0), (10.0, 28.0)): litter(x, y, 1.6, 8, ('paint', 'canvas', 'plaster'))
    for x, y in ((-36.0, 4.0), (36.0, 30.0), (-8.0, 38.0), (40.0, -38.0)): heap((x, y, 0), random.uniform(1.0, 1.8), random.uniform(0.8, 1.4), 0.25, 'dirt', random.uniform(0, 3))
    floor(FLOORS, 'turf', -XH - 0.5, -YH - 0.5, XH + 0.5, YH + 0.5)
    log('map', len(bm.faces), 'faces,', NLIT[0], 'bulbs lit (glow only)')
def post_lights():
    so = bpy.data.objects['Sun']; so.data.energy = 0.3; so.data.color = (0.55, 0.66, 1.0)
    so.rotation_euler = Vector((-0.40, -0.50, -0.75)).normalized().to_track_quat('-Z', 'Y').to_euler()
    bg = next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND'); bg.inputs['Strength'].default_value = 0.45
    ramp = next(n for n in scene.world.node_tree.nodes if n.type == 'VALTORGB')
    for el in ramp.color_ramp.elements: c = el.color; el.color = (c[0] * 0.40, c[1] * 0.52, c[2] * 1.05, 1)        # night: the dusk ramp turned blue
PREVIEW_VIEWS = [((0, -40, 1.6), (0, 10, 4.0)), ((0, 0, 1.6), (-24, 12, 2.5)), ((0, 10, 1.6), (6, 37, 10.0)), ((20, -23, 1.6), (44, -23, 1.6)),
                 ((28, 2, 1.6), (28, 10, 2.5)), ((-10, 0, 1.6), (-30, -16, 1.5))]

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
    w = bpy.data.worlds.get('carnival_sky') or bpy.data.worlds.new('carnival_sky'); scene.world = w; w.use_nodes = True; nt = w.node_tree
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
    img = bpy.data.images.new('carnival_light', size, size, alpha=False, float_buffer=True)
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
    path = os.path.join(TEXDIR, 'carnival_light.exr'); 
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
# THE FAIRGROUND: magenta leads, cyan second (the fair's own colours, grown wild). A clear teal night, a cyan-to-pink aurora behind the wheel,
# both moons high. Hearts: the carousel (crystal spires out of its canopy), the ferris wheel's feet, the ghost train's doors (its red lamp
# still on), the big top; roots run up the midway from the gate.
import ash_paint
MAGENTA = (1.0, 0.18, 0.6); CYAN = (0.08, 0.82, 1.0)
BP = dict(name='carnival', lead=MAGENTA, second=CYAN, lead_mat='emissive_magenta', second_mat='emissive_cyan',
         keep=[(27.0, 18.0), (5.6, 8.0)], lamp=(1.0, 0.55, 0.25),
         moon=(0.3, 0.62, 0.72), moon_e=float(OPT.get('moon', 1.0)), moon_col=(0.62, 0.8, 1.0), skyk=float(OPT.get('skyk', 5.0)),
         sky=dict(zen=(0.006, 0.010, 0.032), mid=(0.006, 0.016, 0.036), hor=(0.014, 0.045, 0.055), alo=(0.1, 0.9, 1.0), ahi=(1.0, 0.25, 0.7),
                  a0=-15.0, aurora=0.30, moon_col=(0.40, 0.44, 0.48), halo=(0.55, 0.9, 1.0), moon2=(-0.35, 0.3, 0.89), moon2_col=(0.62, 0.40, 0.55), glow2=(0.030, 0.008, 0.025)),
         gs=0.42, cgs=0.6, sat=2.0, rk=0.55, step=0.95, seg=5, glowk=3.2, lm=512, max_glows=44, seed=int(OPT.get('seed', 9)))
def bloom_layout(B):
    M, C = MAGENTA, CYAN
    h = B.down(-31.0, 13.0, 15.0); B.cluster((-31.0, 13.0, h.z if h is not None else 4.0), 9, 2.6, M, 2.3, spread=1.3, lean=0.7, size=11.0)   # spires out of the carousel
    B.heart((-31.0, 13.0), 9.0, M, C, 0.3, clusters=5, vines=13, shelves=2, roots=6, sprouts=7, Lmax=1.6)
    B.heart((6.0, 33.0), 9.0, C, M, 0.3, clusters=7, vines=14, shelves=2, roots=5, sprouts=5, Lmax=2.4)
    B.heart((18.5, 14.0), 6.0, M, C, 0.25, clusters=4, vines=11, shelves=4, roots=3, sprouts=4, Lmax=1.6)
    B.heart((-30.0, 33.5), 7.0, M, C, 0.3, clusters=5, vines=9, shelves=2, roots=3, sprouts=4, Lmax=2.0)
    B.trail([(0.0, -38.0), (-1.0, -24.0), (1.0, -10.0), (0.0, 4.0), (3.0, 22.0)], M)
    B.trail([(-4.0, 6.0), (-14.0, 10.0), (-24.0, 12.0)], C)
    B.trail([(4.0, 6.0), (11.0, 10.0), (17.0, 13.0)], M)

# ---------------------------------------------------------------- run
make_pictures(); mats = materials(); build()
if BLOOM: ash_paint.bloom_dim_lamps(globals(), BP)
for v in bm.verts: v.co.z = max(v.co.z, 0.0)          # nothing below the ground: the exporter measures heights from the lowest point
_gv = {v for f in GROUND_FACES for v in f.verts}
for v in bm.verts:                                     # whatever stands on the ground starts 6 mm above it: a bottom face coplanar with the
    if v not in _gv and v.co.z < 0.006: v.co.z = 0.006  # ground lets the exporter's down-rays miss it and read the object as a thin sheet
from coplanar import report as coplanar_report
COP = coplanar_report(bm, MATS, log)
if 'coponly' in OPT: raise SystemExit(0)
me = bpy.data.meshes.new('carnival'); bm.to_mesh(me); bm.free()
for m in mats: me.materials.append(m)
uv_world(me)
mc = bpy.data.collections.new('map'); scene.collection.children.link(mc)
ob = bpy.data.objects.new('carnival', me); mc.objects.link(ob)
me.calc_loop_triangles(); log('carnival', len(me.loop_triangles), 'triangles,', len(me.vertices), 'verts')
lu = me.uv_layers.new(name='Lightmap'); me.uv_layers.active = lu
from mapkit import lightmap_uv; lightmap_uv(ob, log)
uvd = me.uv_layers['Lightmap']; me.uv_layers.active = me.uv_layers['UVMap']
lights(); post_lights()
if BLOOM: bob = ash_paint.bloom_grow(globals(), bloom_layout, BP); ash_paint.bloom_relight(globals(), BP)
def reach_check(ob):
    """walkable cells on a 0.5 m grid (nothing solid between 0.45 m and head height, not inside a solid), flood filled from mid-street"""
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get(); bvh = BVHTree.FromObject(ob, dg)
    xs = np.arange(-50.0, 50.0 + 0.01, 0.5); ys = np.arange(-45.0, 45.0 + 0.01, 0.5); walk = np.zeros((len(xs), len(ys)), bool)
    for i, x in enumerate(xs):
        for j, y in enumerate(ys):
            ok = True
            for dx, dy in ((0, 0), (0.2, 0.2), (-0.2, 0.2), (0.2, -0.2), (-0.2, -0.2)):
                h = bvh.ray_cast(Vector((x + dx, y + dy, 2.15)), Vector((0, 0, -1)), 3.0)
                if h[0] is None or h[0].z > 0.45 or h[1].z < 0: ok = False; break
            walk[i, j] = ok
    seen = np.zeros_like(walk); st = [(int((0 + 50.0) / 0.5), int((0 + 45.0) / 0.5))]
    while st:
        i, j = st.pop()
        if i < 0 or j < 0 or i >= len(xs) or j >= len(ys) or seen[i, j] or not walk[i, j]: continue
        seen[i, j] = True; st += [(i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)]
    lost = walk & ~seen; pts = [(float(xs[i]), float(ys[j])) for i, j in zip(*np.nonzero(lost))]
    log('reach: %d walkable cells, %d reached, %d cut off' % (walk.sum(), seen.sum(), lost.sum()), pts[:8])
reach_check(ob)
if 'nobake' not in OPT: bake(ob, 2048, int(OPT.get('samples', 40)))
if BLOOM:
    if 'nobake' not in OPT: ash_paint.bloom_bake(globals(), bob, BP, int(OPT.get('samples', 40)))
    ash_paint.bloom_split(globals(), bob)
cfg = {'blend': 'carnival.blend', 'out': '../../Ashfall/assets/carnival', 'world': {'collections': ['map'], 'lightmap': 'tex/carnival_light.exr', 'lmSize': 2048},
       'grid': {'cell': 0.25}, 'probes': {'cell': 1.0, 'height': 1.0, 'samples': 96}, 'sky': {'width': 1024}, 'maxTexture': 1024}
with open(os.path.join(BASE, 'carnival.export.json'), 'w') as f: json.dump(cfg, f, indent=1)
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
    im = bpy.data.images.new('st_grid', 960, 810); im.pixels.foreach_set(big.ravel()); im.filepath_raw = os.path.join(CACHE, 'carnival_views.png'); im.file_format = 'PNG'; im.save()
    log('preview carnival_views.png')
log('done')
