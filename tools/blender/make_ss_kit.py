# Steel Storm Rebuilt: the scenery kit (houses by number of floors, two roofs, pine / broadleaf / palm, two rocks), one picture.
#   blender -b art/steelstorm/rebuilt/kit.blend -P tools/blender/make_ss_kit.py -- [preview]     (first time: blender -b --factory-startup -P ...)
#   then  node tools/export-art.mjs s_kit  ->  Steel Storm Rebuilt/assets/s_kit.hgm ;  node tools/ss-check-kit.mjs
# Modelled in GAME axes (x right, y up, z forward) and converted by B(): Blender (x, -z, y), which the exporter maps back.
# Houses are UNIT boxes (x, z -0.5..0.5, y 0..1) that the game stretches: windows are separate quads in even rows per floor
# (the lowest 0.2 is a plain plinth), the picture holds only noise-like plaster so stretching cannot smear it.
# Materials: walls / roof / foliage are painted light and neutral (the game tints them), trim / bark / rock as painted.
import bpy, bmesh, math, os, sys, json
import numpy as np
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hgkit import save_image, image_material, log

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REB = os.path.join(ROOT, 'art', 'steelstorm', 'rebuilt'); TEXDIR = os.path.join(REB, 'tex'); os.makedirs(TEXDIR, exist_ok=True)
scene = bpy.context.scene
def B(p): return Vector((p[0], -p[2], p[1]))

# ---------------------------------------------------------------- the picture: regions (u0, v0, u1, v1), v up
WALL = (0, .5, .5, 1); STONE = (.5, .5, 1, 1); WIN = (0, .25, .25, .5); DOOR = (.25, .25, .5, .5); ROOFR = (.5, .25, 1, .5)
FOL = (0, 0, .5, .25); BARK = (.5, 0, .75, .25); ROCK = (.75, 0, 1, .25)
PAD = 3 / 1024
def uvr(r, u, v): return (r[0] + PAD + (r[2] - r[0] - 2 * PAD) * min(max(u, 0), 1), r[1] + PAD + (r[3] - r[1] - 2 * PAD) * min(max(v, 0), 1))
def noise(h, w, cy, cx, seed, octv=1):
    rng = np.random.default_rng(seed); out = np.zeros((h, w), np.float32); tot = 0
    for o in range(octv):
        c1, c2 = cy * 2 ** o, cx * 2 ** o; g = rng.random((c1 + 2, c2 + 2)).astype(np.float32)
        y = np.linspace(0, c1, h, endpoint=False); x = np.linspace(0, c2, w, endpoint=False); y0 = y.astype(int); x0 = x.astype(int)
        fy = y - y0; fx = x - x0; fy = fy * fy * (3 - 2 * fy); fx = fx * fx * (3 - 2 * fx)
        a = g[y0][:, x0]; b = g[y0][:, x0 + 1]; c = g[y0 + 1][:, x0]; d = g[y0 + 1][:, x0 + 1]
        out += (0.5 ** o) * (((a * (1 - fx) + b * fx) * (1 - fy)[:, None]) + ((c * (1 - fx) + d * fx) * fy[:, None])); tot += 0.5 ** o
    return out / tot
def paint_picture(N=1024):
    img = np.full((N, N, 3), 0.5, np.float32)
    def put(r, arr): img[int(r[1] * N):int(r[3] * N), int(r[0] * N):int(r[2] * N)] = arr
    def size(r): return int((r[3] - r[1]) * N), int((r[2] - r[0]) * N)
    # plaster: light neutral, soft mottling, faint rain streaks
    h, w = size(WALL); n = noise(h, w, 6, 6, 1, 3); s = noise(h, w, 2, 40, 2)
    put(WALL, np.clip(0.86 + 0.07 * (n[..., None] - 0.5) * 2 - 0.05 * (s[..., None] - 0.4), 0, 1) * np.ones(3, np.float32))
    # stone courses
    h, w = size(STONE); n = noise(h, w, 8, 8, 3, 2); a = np.full((h, w), 0.62, np.float32)
    rows = np.arange(h) // 48; cols = (np.arange(w)[None, :] + (rows[:, None] % 2) * 48) // 96
    tile = np.random.default_rng(4).random((h // 48 + 2, w // 96 + 3)).astype(np.float32); a = 0.5 + 0.18 * tile[rows[:, None], cols] + 0.1 * (n - 0.5)
    mort = ((np.arange(h) % 48) < 3)[:, None] | (((np.arange(w)[None, :] + (rows[:, None] % 2) * 48) % 96) < 3); a[mort] *= 0.62
    put(STONE, np.clip(a, 0, 1)[..., None] * np.array((1.0, 0.98, 0.94), np.float32))
    # window: cream frame, four panes of dark glass with a sky gradient, sill shadow
    h, w = size(WIN); y = np.linspace(0, 1, h)[:, None] * np.ones((1, w)); x = np.ones((h, 1)) * np.linspace(0, 1, w)[None, :]
    col = np.ones((h, w, 3), np.float32) * np.array((0.80, 0.77, 0.68), np.float32)
    inner = (x > 0.12) & (x < 0.88) & (y > 0.1) & (y < 0.9); mull = (np.abs(x - 0.5) < 0.035) | (np.abs(y - 0.5) < 0.03)
    glass = np.stack([0.10 + 0.14 * y, 0.14 + 0.16 * y, 0.20 + 0.20 * y], -1).astype(np.float32); glass *= (0.85 + 0.15 * noise(h, w, 3, 3, 5))[..., None]
    col = np.where((inner & ~mull)[..., None], glass, col); col[y < 0.06] *= 0.7
    put(WIN, np.clip(col, 0, 1))
    # door: dark wood, raised panels, brass handle
    h, w = size(DOOR); y = np.linspace(0, 1, h)[:, None] * np.ones((1, w)); x = np.ones((h, 1)) * np.linspace(0, 1, w)[None, :]
    wood = np.ones((h, w, 3), np.float32) * np.array((0.30, 0.19, 0.11), np.float32) * (0.85 + 0.3 * noise(h, w, 1, 30, 6, 2))[..., None]
    frame = (x < 0.1) | (x > 0.9) | (y > 0.93); wood[frame] *= 1.25
    for (x0, x1, y0, y1) in ((0.18, 0.46, 0.08, 0.45), (0.54, 0.82, 0.08, 0.45), (0.18, 0.46, 0.52, 0.88), (0.54, 0.82, 0.52, 0.88)):
        pm = (x > x0) & (x < x1) & (y > y0) & (y < y1); wood[pm] *= 0.78
    wood[(np.abs(x - 0.8) < 0.025) & (np.abs(y - 0.5) < 0.03)] = (0.65, 0.5, 0.2)
    put(DOOR, np.clip(wood, 0, 1))
    # roof tiles: rows along the slope, light neutral, each tile its own brightness
    h, w = size(ROOFR); rows_n, cols_n = 10, 24; rh, rw = h / rows_n, w / cols_n
    ri = (np.arange(h) / rh).astype(int); ci = ((np.arange(w)[None, :] / rw) + (ri[:, None] % 2) * 0.5).astype(int)
    t = np.random.default_rng(7).random((rows_n + 2, cols_n + 3)).astype(np.float32); a = 0.78 + 0.2 * t[ri[:, None], ci]
    fy = (np.arange(h) % rh) / rh; a = a * (0.72 + 0.28 * fy[:, None] ** 0.5); a[(fy < 0.07)[:, None] * np.ones((1, w), bool)] *= 0.7
    cm = ((np.arange(w)[None, :] / rw + (ri[:, None] % 2) * 0.5) % 1) < 0.04; a[cm] *= 0.8
    put(ROOFR, np.clip(a, 0, 1)[..., None] * np.array((1.0, 0.99, 0.97), np.float32))
    # foliage: v 0 = underside (shaded), v 1 = sunlit top, clumpy speckle, neutral grey
    h, w = size(FOL); y = np.linspace(0, 1, h)[:, None] * np.ones((1, w)); n = noise(h, w, 10, 20, 8, 3); sp = noise(h, w, 40, 80, 9)
    a = 0.40 + 0.38 * y ** 0.8 + 0.18 * (n - 0.5) + 0.12 * (sp - 0.5); put(FOL, np.clip(a, 0.2, 0.95)[..., None] * np.array((1, 1, 0.98), np.float32))
    h, w = size(BARK); n = noise(h, w, 2, 30, 10, 3); put(BARK, np.clip((0.7 + 0.5 * (n - 0.5)), 0.2, 1)[..., None] * np.array((0.34, 0.24, 0.16), np.float32))
    h, w = size(ROCK); n = noise(h, w, 5, 5, 11, 4); put(ROCK, np.clip(0.42 + 0.3 * (n - 0.5) + 0.06, 0.15, 0.8)[..., None] * np.array((1.0, 0.96, 0.9), np.float32))
    return img

# ---------------------------------------------------------------- meshes in game coordinates
class M:
    def __init__(s, mats): s.v = []; s.f = []; s.mats = mats
    def tris(s): return sum(len(f[0]) - 2 for f in s.f)
    def face(s, pts, uvs, mat, out=None):
        pts = [tuple(p) for p in pts]; uvs = list(uvs)
        if out is not None:
            n = np.zeros(3); c = np.mean(pts, 0)
            for i in range(len(pts)): n += np.cross(pts[i], pts[(i + 1) % len(pts)])
            if np.dot(n, c - np.array(out)) < 0: pts.reverse(); uvs.reverse()
        ids = []
        for p in pts: s.v.append(p); ids.append(len(s.v) - 1)
        s.f.append((ids, uvs, s.mats.index(mat)))
    def box(s, c, sz, mat, rect, skip=()):
        x, y, z = c; hx, hy, hz = sz[0] / 2, sz[1] / 2, sz[2] / 2; U = [(0, 0), (1, 0), (1, 1), (0, 1)]
        F = {'+x': [(hx, -hy, -hz), (hx, -hy, hz), (hx, hy, hz), (hx, hy, -hz)], '-x': [(-hx, -hy, hz), (-hx, -hy, -hz), (-hx, hy, -hz), (-hx, hy, hz)],
             '+y': [(-hx, hy, -hz), (hx, hy, -hz), (hx, hy, hz), (-hx, hy, hz)], '-y': [(-hx, -hy, hz), (hx, -hy, hz), (hx, -hy, -hz), (-hx, -hy, -hz)],
             '+z': [(-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)], '-z': [(hx, -hy, -hz), (-hx, -hy, -hz), (-hx, hy, -hz), (hx, hy, -hz)]}
        for k, P in F.items():
            if k in skip: continue
            s.face([(x + p[0], y + p[1], z + p[2]) for p in P], [uvr(rect, *u) for u in U], mat, out=c)
    def build(s, name, col):
        me = bpy.data.meshes.new(name); me.from_pydata([B(p) for p in s.v], [], [f[0] for f in s.f]); me.update()
        uv = me.uv_layers.new(name='UVMap')
        for poly, f in zip(me.polygons, s.f):
            for li, u in zip(poly.loop_indices, f[1]): uv.data[li].uv = u
        for pi, f in enumerate(s.f): me.polygons[pi].material_index = f[2]
        for mn in s.mats: me.materials.append(bpy.data.materials[mn])
        ob = bpy.data.objects.new(name, me); col.objects.link(ob); return ob

def house(F, budget):
    m = M(['walls', 'trim']); fh = 0.8 / F
    m.box((0, 0.6, 0), (1, 0.8, 1), 'walls', WALL, skip=('+y', '-y'))
    m.box((0, 0.1, 0), (1.02, 0.2, 1.02), 'trim', STONE, skip=('-y',))
    m.box((0, 0.9775, 0), (1.06, 0.045, 1.06), 'trim', STONE, skip=('-y',))
    for k in range(1, F): m.box((0, 0.2 + k * fh, 0), (1.04, 0.014, 1.04), 'trim', STONE, skip=('+y', '-y'))
    for sx in (-1, 1):
        for sz in (-1, 1): m.box((sx * 0.5, 0.6, sz * 0.5), (0.05, 0.8, 0.05), 'trim', STONE, skip=('+y', '-y'))
    ww, wh = 0.13, 0.5 * fh; U = [(0, 0), (1, 0), (1, 1), (0, 1)]; sills = []
    for f in range(F):
        yc = 0.2 + (f + 0.55) * fh
        for side in ('+z', '-z', '+x', '-x'):
            for t in (-0.3, 0.0, 0.3):
                if side == '+z' and f == 0 and t == 0.0: continue
                sg = 1 if side[0] == '+' else -1
                if side[1] == 'z': P = [(t - ww / 2, yc - wh / 2, sg * 0.503), (t + ww / 2, yc - wh / 2, sg * 0.503), (t + ww / 2, yc + wh / 2, sg * 0.503), (t - ww / 2, yc + wh / 2, sg * 0.503)]
                else: P = [(sg * 0.503, yc - wh / 2, t - ww / 2), (sg * 0.503, yc - wh / 2, t + ww / 2), (sg * 0.503, yc + wh / 2, t + ww / 2), (sg * 0.503, yc + wh / 2, t - ww / 2)]
                m.face(P, [uvr(WIN, *u) for u in U], 'trim', out=(0, yc, 0)); sills.append((side, sg, t, yc - wh / 2))
    dh = 0.66 * fh; yd = 0.2 + dh / 2
    m.face([(-0.065, 0.2, 0.503), (0.065, 0.2, 0.503), (0.065, 0.2 + dh, 0.503), (-0.065, 0.2 + dh, 0.503)], [uvr(DOOR, *u) for u in U], 'trim', out=(0, yd, 0))
    m.box((0, 0.19, 0.52), (0.2, 0.02, 0.04), 'trim', STONE, skip=('-y', '-z'))
    m.box((0, 0.2 + dh + 0.012, 0.51), (0.17, 0.02, 0.03), 'trim', STONE, skip=('-y', '-z'))
    for (side, sg, t, y) in sills:                       # window sills (front + top), as many as the triangle budget allows
        if m.tris() + 4 > budget: break
        if side[1] == 'z': c = (t, y - 0.006, sg * 0.515); sz = (ww + 0.03, 0.012, 0.03)
        else: c = (sg * 0.515, y - 0.006, t); sz = (0.03, 0.012, ww + 0.03)
        m.box(c, sz, 'trim', STONE, skip=('-y', '-x', '+x') if side[1] == 'z' else ('-y', '-z', '+z'))
    return m
def roof(kind):
    m = M(['roof', 'trim']); U = [(0, 0), (1, 0), (1, 1), (0, 1)]; R = lambda u, v: uvr(ROOFR, u, v)
    if kind == 1:                                        # gable, ridge along z
        a = [(-0.5, 0, -0.5), (0.5, 0, -0.5), (0.5, 0.045, -0.5), (0, 1.0, -0.5), (-0.5, 0.045, -0.5)]; b = [(p[0], p[1], 0.5) for p in a]; c = (0, 0.4, 0)
        m.face([a[4], a[3], b[3], b[4]], [R(0, 0), R(0, 1), R(1, 1), R(1, 0)], 'roof', out=c); m.face([a[3], a[2], b[2], b[3]], [R(0, 1), R(0, 0), R(1, 0), R(1, 1)], 'roof', out=c)
        m.face([a[1], a[2], b[2], b[1]], [R(0, 0), R(0, 0.05), R(1, 0.05), R(1, 0)], 'roof', out=c); m.face([a[0], a[4], b[4], b[0]], [R(0, 0), R(0, 0.05), R(1, 0.05), R(1, 0)], 'roof', out=c)
        m.face([a[0], a[1], b[1], b[0]], [R(0, 0), R(1, 0), R(1, 0.1), R(0, 0.1)], 'roof', out=c)
        m.face(a, [R(0.5 + p[0], p[1]) for p in a], 'roof', out=c); m.face(b, [R(0.5 + p[0], p[1]) for p in b], 'roof', out=c)
        m.box((0, 1.0, 0), (0.07, 0.05, 1.0), 'trim', STONE, skip=('-y',)); m.box((0.28, 0.72, 0.18), (0.1, 0.8, 0.14), 'trim', STONE); m.box((0.28, 1.14, 0.18), (0.13, 0.04, 0.17), 'trim', STONE, skip=('-y',))
    else:                                                # hipped
        P = {'a': (-0.5, 0, -0.5), 'b': (0.5, 0, -0.5), 'c': (0.5, 0, 0.5), 'd': (-0.5, 0, 0.5), 'e': (0, 1.0, -0.22), 'f': (0, 1.0, 0.22)}; c = (0, 0.4, 0)
        def fc(ks, uv): m.face([P[k] for k in ks], uv, 'roof', out=c)
        fc('dcba', [R(0, 0), R(1, 0), R(1, 0.1), R(0, 0.1)]); fc('bcfe', [R(0, 0), R(1, 0), R(1, 1), R(0, 1)]); fc('adfe', [R(1, 0), R(0, 0), R(0, 1), R(1, 1)])
        fc('abe', [R(0, 0), R(1, 0), R(0.5, 1)]); fc('cdf', [R(0, 0), R(1, 0), R(0.5, 1)])
        m.box((0, 1.0, 0), (0.07, 0.05, 0.46), 'trim', STONE, skip=('-y',)); m.box((0.15, 0.72, -0.12), (0.1, 0.5, 0.14), 'trim', STONE); m.box((0.15, 1.0, -0.12), (0.13, 0.04, 0.17), 'trim', STONE, skip=('-y',))
    return m

# ---------------------------------------------------------------- trees and rocks
def ring(m, y, r, n, mat, rect, jit=0.0, off=(0, 0), ph=0.0):
    return [(off[0] + r * (1 + jit * (1 if i % 2 else -1)) * math.cos(2 * math.pi * i / n + ph), y, off[1] + r * (1 + jit * (1 if i % 2 else -1)) * math.sin(2 * math.pi * i / n + ph)) for i in range(n)]
def trunk(m, pts, radii, n=6):
    rings = []
    for (c, r) in zip(pts, radii): rings.append([(c[0] + r * math.cos(2 * math.pi * i / n), c[1], c[2] + r * math.sin(2 * math.pi * i / n)) for i in range(n)])
    for k in range(len(rings) - 1):
        for i in range(n):
            j = (i + 1) % n; v0, v1 = k / (len(rings) - 1), (k + 1) / (len(rings) - 1)
            cen = (pts[k][0], (pts[k][1] + pts[k + 1][1]) / 2, pts[k][2])
            m.face([rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]], [uvr(BARK, i / n, v0), uvr(BARK, (i + 1) / n, v0), uvr(BARK, (i + 1) / n, v1), uvr(BARK, i / n, v1)], 'bark', out=cen)
def pine():
    m = M(['bark', 'foliage']); trunk(m, [(0, 0, 0), (0, 1.6, 0), (0, 3.2, 0)], [0.24, 0.17, 0.11], 6)
    for k in range(6):
        yb = 1.2 + k * 0.9; top = yb + (2.0 if k < 5 else 1.5); R = 2.0 * (1 - 0.15 * k); n = 12
        base = ring(m, yb, R, n, 'foliage', FOL, 0.2, ph=0.35 * k); apex = (0.06 * math.cos(k), top, 0.06 * math.sin(k))
        for i in range(n):
            j = (i + 1) % n; p, q = base[i], base[j]
            m.face([p, q, apex], [uvr(FOL, 0.5 + p[0] / 5, 0.1 + 0.1 * k / 6), uvr(FOL, 0.5 + q[0] / 5, 0.1 + 0.1 * k / 6), uvr(FOL, 0.5 + apex[0] / 5, 0.55 + 0.45 * k / 5)], 'foliage', out=(0, yb - 0.5, 0))
    return m
def ico(c, r, seed, squash=1.0):
    t = (1 + 5 ** 0.5) / 2; V = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    Fc = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    rng = np.random.default_rng(seed); V = [np.array(v) / np.linalg.norm(v) * r * (0.82 + 0.36 * rng.random()) for v in V]
    return [(c[0] + v[0], c[1] + v[1] * squash, c[2] + v[2]) for v in V], Fc
def blobs(m, specs, mat, rect, flat=False):
    for i, (c, r, sq) in enumerate(specs):
        V, Fc = ico(c, r, 20 + i, sq)
        for f in Fc:
            P = [V[k] for k in f]; vv = lambda p: 0.2 + 0.8 * min(max((p[1] - 3.0) / 3.8, 0), 1)
            m.face(P, [uvr(rect, 0.5 + p[0] / 5.6, vv(p)) for p in P], mat, out=c)
def leaf():
    m = M(['bark', 'foliage']); trunk(m, [(0, 0, 0), (0.05, 1.8, 0.0), (-0.1, 3.4, 0.1)], [0.3, 0.22, 0.15], 6)
    blobs(m, [((0, 5.15, 0), 1.45, 0.85), ((1.1, 4.3, 0.5), 1.25, 0.85), ((-1.05, 4.4, -0.35), 1.3, 0.85), ((0.1, 4.2, -1.1), 1.2, 0.85), ((-0.2, 4.1, 1.1), 1.2, 0.85)], 'foliage', FOL)
    return m
def palm():
    m = M(['bark', 'foliage']); ys = [0, 1.6, 3.2, 4.8, 6.4]; pts = [(0.3 * (y / 6.4) ** 2, y, 0) for y in ys]; trunk(m, pts, [0.26, 0.22, 0.19, 0.17, 0.15], 6)
    top = pts[-1]
    for k in range(7):
        a = 2 * math.pi * k / 7 + 0.3; d = (math.cos(a), math.sin(a)); sp = [(0, 0.1), (0.95, 0.55), (1.75, 0.45), (2.3, -0.15)]; wd = [0.0, 0.3, 0.36, 0.2]
        L = lambda r, h, w: (top[0] + d[0] * r - d[1] * w, top[1] + h, top[2] + d[1] * r + d[0] * w)
        for s in range(3):
            (r0, h0), (r1, h1) = sp[s], sp[s + 1]; w0, w1 = wd[s], wd[s + 1]
            for sd in (-1, 1):
                q = [L(r0, h0, 0), L(r1, h1, 0), L(r1, h1 - 0.12, sd * w1), L(r0, h0 - 0.1, sd * w0)] if s else [L(r0, h0, 0), L(r1, h1, 0), L(r1, h1 - 0.12, sd * w1), L(r0, h0 - 0.1, sd * w0)]
                uvf = lambda t, ww: uvr(FOL, 0.2 + 0.6 * ww, 0.35 + 0.6 * (1 - t / 3))
                m.face(q, [uvf(s, 0.5), uvf(s + 1, 0.5), uvf(s + 1, 0.5 + sd * 0.3), uvf(s, 0.5 + sd * 0.3)], 'foliage')
                n = np.cross(np.array(q[1]) - np.array(q[0]), np.array(q[3]) - np.array(q[0]))
                if n[1] < 0: f = m.f[-1]; f[0].reverse(); f[1].reverse()
    return m
def rock(seed, rx, ry, rz, cy):
    m = M(['rock']); V, Fc = ico((0, cy, 0), 1.0, seed); rng = np.random.default_rng(seed + 5)
    V2 = []
    for v in V: V2.append((v[0] * rx, cy + (v[1] - cy) * ry, v[2] * rz))
    # subdivide once (80 triangles), then jitter the new points a little
    mid = {}
    def mp(a, b):
        k = (min(a, b), max(a, b))
        if k not in mid:
            p = (np.array(V2[a]) + np.array(V2[b])) / 2; p = p + (rng.random(3) - 0.5) * 0.18; V2.append(tuple(p)); mid[k] = len(V2) - 1
        return mid[k]
    F2 = []
    for (a, b, c) in Fc:
        ab, bc, ca = mp(a, b), mp(b, c), mp(c, a); F2 += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
    xs_ = [v[0] for v in V2]; zs_ = [v[2] for v in V2]
    V2 = [((v[0] - (max(xs_) + min(xs_)) / 2) * 2.0 / (max(xs_) - min(xs_)), v[1], (v[2] - (max(zs_) + min(zs_)) / 2) * 2.0 / (max(zs_) - min(zs_))) for v in V2]
    for f in F2:
        P = [V2[k] for k in f]; m.face(P, [uvr(ROCK, 0.5 + p[0] * 0.4, 0.5 + p[2] * 0.4 + p[1] * 0.2) for p in P], 'rock', out=(0, cy, 0))
    return m

# ---------------------------------------------------------------- scene
def clear_kit():
    c = bpy.data.collections.get('kit')
    if c:
        for ob in list(c.objects): bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.collections.remove(c)
    for coll in (bpy.data.meshes,):
        for d in list(coll):
            if d.users == 0: coll.remove(d)
def preview(out, W=1800, H=700):
    sc = bpy.data.scenes.new('kit_prev'); sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.cycles.use_denoising = True
    try: sc.view_settings.view_transform = 'Standard'
    except TypeError: pass
    w = bpy.data.worlds.new('sky'); w.use_nodes = True; nt = w.node_tree; bg = next(n for n in nt.nodes if n.type == 'BACKGROUND')
    try:
        sk = nt.nodes.new('ShaderNodeTexSky'); items = [i.identifier for i in sk.bl_rna.properties['sky_type'].enum_items]
        sk.sky_type = 'NISHITA' if 'NISHITA' in items else [i for i in items if 'MULTIPLE' in i or 'SINGLE' in i][0]; sk.sun_elevation = math.radians(48); sk.sun_rotation = math.radians(210); sk.sun_disc = False
        nt.links.new(sk.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = 0.45
    except Exception as ex: bg.inputs['Color'].default_value = (0.5, 0.65, 0.9, 1)
    sc.world = w
    ld = bpy.data.lights.new('sun', 'SUN'); ld.energy = 2.6; ld.angle = math.radians(2.5); lo = bpy.data.objects.new('sun', ld); sc.collection.objects.link(lo)
    lo.rotation_euler = Vector((0.55, 0.5, -0.7)).to_track_quat('-Z', 'Y').to_euler()
    gm = bpy.data.materials.new('ground'); gm.use_nodes = True; next(n for n in gm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'].default_value = (0.30, 0.25, 0.15, 1)
    bpy.ops.mesh.primitive_plane_add(size=400); pl = bpy.context.active_object; pl.data.materials.append(gm)
    for c_ in list(pl.users_collection): c_.objects.unlink(pl)
    sc.collection.objects.link(pl)
    lin = lambda h: [(((h >> s) & 255) / 255.0) for s in (16, 8, 0)]
    lin = (lambda f: (lambda h: [(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in f(h)]))(lin)
    def tinted(ob, slot, matname, col):
        mt = bpy.data.materials[matname].copy(); nt2 = mt.node_tree; bs = next(x for x in nt2.nodes if x.type == 'BSDF_PRINCIPLED'); tx = next(x for x in nt2.nodes if x.type == 'TEX_IMAGE')
        mx = nt2.nodes.new('ShaderNodeMixRGB'); mx.blend_type = 'MULTIPLY'; mx.inputs['Fac'].default_value = 1.0; mx.inputs['Color2'].default_value = (col[0], col[1], col[2], 1)
        nt2.links.new(tx.outputs['Color'], mx.inputs['Color1']); nt2.links.new(mx.outputs['Color'], bs.inputs['Base Color'])
        ob.material_slots[slot].link = 'OBJECT'; ob.material_slots[slot].material = mt
    kit = bpy.data.collections['kit']
    def inst(name, loc, scl, tints=()):
        src = kit.objects[name]; ob = bpy.data.objects.new(name + '_i', src.data); sc.collection.objects.link(ob)
        ob.location = B(loc); ob.scale = (scl, scl, scl) if isinstance(scl, (int, float)) else (scl[0], scl[2], scl[1])
        for slot, (mn, col) in tints: tinted(ob, slot, mn, col)
        return ob
    houses = [(2, 10, 9, 8, 0xe4d9bd, 1, 0x8a4a34), (3, 12, 10, 11, 0xc9b896, 2, 0x4c4f56), (4, 9, 13, 14, 0xd8a48a, 1, 0x7a3e2c), (5, 14, 12, 17, 0xaab3bd, 2, 0x8f5a42)]
    gap = 3.0; x = -(sum(h[1] for h in houses) + gap * 3) / 2 - 2
    for (F, w, d, h, wc, rk, rc) in houses:
        xc = x + w / 2; x += w + gap
        inst('house%d' % F, (xc, 0, -d / 2), (w, h, d), [(0, ('walls', lin(wc)))])
        inst('roof%d' % rk, (xc, h, -d / 2), (w + 0.8, min(w, d) / 2, d + 0.8), [(0, ('roof', lin(rc)))])
    treec = lambda h: [c * 1.9 for c in lin(h)]
    inst('pine', (-34, 0, 3), 1.25, [(1, ('foliage', treec(0x3f6b2e)))]); inst('pine', (-31, 0, -8), 1.0, [(1, ('foliage', treec(0x466f30)))])
    inst('leaf', (-12, 0, 6.5), 1.2, [(1, ('foliage', treec(0x55782f)))]); inst('leaf', (21, 0, 6), 1.1, [(1, ('foliage', treec(0x4a7a35)))])
    inst('palm', (30, 0, 2), 1.2, [(1, ('foliage', treec(0x4f8a3a)))]); inst('pine', (26, 0, -12), 1.1, [(1, ('foliage', treec(0x3f6b2e)))])
    inst('rock1', (-29, 0, 7), 1.6); inst('rock2', (-9.5, 0, 8), 1.3); inst('rock1', (24, 0, 7), 1.2); inst('rock2', (33.5, 0, 6.5), 1.5)
    a = math.radians(14); el = math.radians(17); d = Vector((math.sin(a) * math.cos(el), -math.cos(a) * math.cos(el), math.sin(el)))
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = 78; cd.clip_start, cd.clip_end = 1, 500
    co = bpy.data.objects.new('cam', cd); sc.collection.objects.link(co); co.location = Vector((0, 0, 8)) + d * 150; co.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler(); sc.camera = co
    sc.render.filepath = out; sc.render.image_settings.file_format = 'PNG'; bpy.ops.render.render(write_still=True, scene=sc.name); log('preview', out)

if not bpy.data.filepath.replace('\\', '/').endswith('art/steelstorm/rebuilt/kit.blend'):
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(REB, 'kit.blend'))
if 'nobuild' not in ARGV:
    clear_kit(); img = save_image(paint_picture(), 'kit', TEXDIR)
    for mn, r, me in (('walls', .9, 0), ('trim', .85, 0), ('roof', .85, 0), ('bark', .95, 0), ('foliage', .9, 0), ('rock', .95, 0)): image_material(mn, img, r, me)
    col = bpy.data.collections.new('kit'); scene.collection.children.link(col); parts = []; rep = {}
    for F, bud in ((2, 220), (3, 240), (4, 260), (5, 280)):
        m = house(F, bud - 2); m.build('house%d' % F, col); parts.append('house%d' % F); rep['house%d' % F] = m.tris()
    for k in (1, 2): m = roof(k); m.build('roof%d' % k, col); parts.append('roof%d' % k); rep['roof%d' % k] = m.tris()
    for n, f in (('pine', pine), ('leaf', leaf), ('palm', palm)): m = f(); m.build(n, col); parts.append(n); rep[n] = m.tris()
    for n, a in (('rock1', (3, 0.98, 0.7, 0.92, 0.2)), ('rock2', (8, 0.85, 0.82, 0.9, 0.3))): m = rock(*a); m.build(n, col); parts.append(n); rep[n] = m.tris()
    json.dump({'blend': 'kit.blend', 'out': '../../../Steel Storm Rebuilt/assets/s_kit', 'parts': parts, 'maxTexture': 1024}, open(os.path.join(REB, 's_kit.export.json'), 'w'), indent=1)
    bpy.ops.wm.save_mainfile(); log('triangles', rep)
if 'preview' in ARGV: preview(os.path.join(ROOT, 'art', 'mockups', 'ssx-kit-1.png'))
log('done')
