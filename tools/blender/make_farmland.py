# Steel Storm Remastered: "GREEN LINE" (farmland.hgm), bocage country 420 m across, built with tools/blender/ss_mapkit.py.
#   blender -b --factory-startup -P tools/blender/make_farmland.py -- [nobake] [samples=32] [preview]   (later runs: blender -b art/steelstorm/farmland.blend -P ...)
# then  node tools/export-art.mjs farmland ; node tools/blender/check_heights.mjs "Steel Storm Remastered/assets/farmland.hgm"
# Small fields boxed in by thick hedgerows on earth banks (they block sight and movement; gates in them), two sunken lanes between double
# hedges (ramps up where they meet), two farms with yard walls, an orchard, a church with its tower on a rise and a walled churchyard, a
# stream with steep banks crossed by a stone bridge and a ford, a copse, hedgerow oaks, burnt-out vehicles on the road.
import os, sys, math, random
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ss_mapkit as K
from ss_mapkit import box, blob, cyl, beam, prism_xz, tree2, truck, car, sandbags, gz, vn2, seg_dist, rRz, log
from hgkit import T

K.NAME = 'farmland'
CHURCH = (55.0, 98.0); FARMS = ((-122.0, -62.0), (104.0, -112.0)); ORCHARD = (-118.0, 112.0); COPSE = (150.0, 40.0)
FORD_X, BRIDGE_X = -95.0, 70.0
GX = [-205.0, -150.0, -95.0, -40.0, 15.0, 70.0, 125.0, 205.0]; GY = [-205.0, -150.0, -90.0, -30.0, 30.0, 90.0, 150.0, 205.0]
LANE_A_Y = 30.0; LANE_B_X = 15.0; LANE_W = 4.0
def stream_y(x): return -40.0 + 0.42 * np.asarray(x, np.float64) + 22.0 * np.sin(np.asarray(x, np.float64) / 40.0)
def stream_d(x, y):
    x = np.asarray(x, np.float64); d1 = 0.42 + 22.0 / 40.0 * np.cos(x / 40.0)
    return np.abs(np.asarray(y, np.float64) - stream_y(x)) / np.sqrt(1 + d1 * d1)
# hedge lines: grid edges between jittered nodes, with gates; some left out (bigger fields, longer lanes of fire); the lanes' lines are double
rng = random.Random(5); NODE = {}
for i, x in enumerate(GX):
    for j, y in enumerate(GY):
        edge = i in (0, len(GX) - 1) or j in (0, len(GY) - 1)
        NODE[i, j] = (x + (0 if edge else rng.uniform(-9, 9)), y + (0 if edge else rng.uniform(-9, 9)))
HEDGES = []      # (x0, y0, x1, y1, gates [(t0, t1)])
OMIT = {('h', 5, 1), ('h', 6, 1), ('v', 6, 1), ('h', 1, 5), ('v', 2, 5), ('h', 3, 2), ('v', 4, 6), ('h', 5, 5), ('v', 5, 5)}
def near_feature(x, y):
    return (math.hypot(x - CHURCH[0], y - CHURCH[1]) < 34 or min(math.hypot(x - a, y - b) for a, b in FARMS) < 26 or abs(float(stream_d(x, y))) < 12
            or (abs(x - ORCHARD[0]) < 34 and abs(y - ORCHARD[1]) < 30) or math.hypot(x - COPSE[0], y - COPSE[1]) < 24
            or abs(y - LANE_A_Y) < 9.5 or (abs(x - LANE_B_X) < 9.5 and y < LANE_A_Y))
for i in range(1, len(GX) - 1):
    for j in range(len(GY) - 1):
        if ('v', i, j) in OMIT or GX[i] == LANE_B_X and GY[j] < LANE_A_Y: continue
        a, b = NODE[i, j], NODE[i, j + 1]; HEDGES.append((a[0], a[1], b[0], b[1], []))
for j in range(1, len(GY) - 1):
    for i in range(len(GX) - 1):
        if ('h', i, j) in OMIT or GY[j] == LANE_A_Y: continue
        a, b = NODE[i, j], NODE[i + 1, j]; HEDGES.append((a[0], a[1], b[0], b[1], []))
for x0 in (-205.0,):
    pass
for sgn in (-1, 1):            # the sunken lanes' double hedges (gaps where the lanes cross and at the ramps)
    HEDGES.append((-200.0, LANE_A_Y + sgn * 6.5, 200.0, LANE_A_Y + sgn * 6.5, [((LANE_B_X + 200) / 400.0 - 0.025, (LANE_B_X + 200) / 400.0 + 0.025), (0.0, 0.04), (0.96, 1.0), (0.4, 0.43)]))
    HEDGES.append((LANE_B_X + sgn * 6.5, -200.0, LANE_B_X + sgn * 6.5, LANE_A_Y - 7.0, [(0.0, 0.04), (0.45, 0.48)]))
fl = []
for h in HEDGES:
    x0, y0, x1, y1, g = h; L = math.hypot(x1 - x0, y1 - y0)
    g = [(a_, b_, 'gate') for a_, b_ in g]
    if not g:
        for k in range(rng.choice((1, 1, 2))):
            t = rng.uniform(0.15, 0.85); w = 8.0 / L; g.append((t - w / 2, t + w / 2, 'gate'))
    n = max(2, int(L / 5.0))
    lanes = abs(y0 - y1) < 1e-6 and abs(abs(y0 - LANE_A_Y) - 6.5) < 1e-6 or abs(x0 - x1) < 1e-6 and abs(abs(x0 - LANE_B_X) - 6.5) < 1e-6
    for k in range(n):         # cut the hedge where it would run through a farm, the church, the stream, the orchard, the copse or a lane
        t = (k + 0.5) / n; px_, py_ = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        if (near_feature(px_, py_) if not lanes else (math.hypot(px_ - CHURCH[0], py_ - CHURCH[1]) < 34 or abs(float(stream_d(px_, py_))) < 12)): g.append((t - 0.5 / n, t + 0.5 / n, 'cut'))
    fl.append((x0, y0, x1, y1, g))
HEDGES = fl
def lane_depth(x, y):
    """the sunken lanes: 1.6 m deep, ramps up to field level where they meet each other and at their ends"""
    x = np.asarray(x, np.float64); y = np.asarray(y, np.float64)
    ramp_a = np.clip((np.minimum.reduce([np.abs(x - LANE_B_X) - 8.0, np.abs(x + 200.0) - 8.0, np.abs(x - 200.0) - 8.0, np.abs(x + 37.0) - 6.0]) / 14.0), 0, 1)
    da = np.clip((LANE_W + 1.5 - np.abs(y - LANE_A_Y)) / 1.5, 0, 1) * ramp_a * (np.abs(x) < 200)
    ramp_b = np.clip(np.minimum.reduce([np.abs(y - LANE_A_Y) - 8.0, np.abs(y + 200.0) - 8.0, np.abs(y + 96.0) - 6.0]) / 14.0, 0, 1)
    db = np.clip((LANE_W + 1.5 - np.abs(x - LANE_B_X)) / 1.5, 0, 1) * ramp_b * (y < LANE_A_Y) * (y > -200)
    return 1.6 * np.maximum(da, db)
def hedge_bank(x, y):
    x = np.asarray(x, np.float64); y = np.asarray(y, np.float64); b = np.zeros(np.shape(x))
    for x0, y0, x1, y1, g in HEDGES:
        d = seg_dist(x, y, (x0, y0, x1, y1)); e = np.clip((2.4 - d) / 1.6, 0, 1)
        if not np.any(e): continue
        dx, dy = x1 - x0, y1 - y0; t = np.clip(((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy), 0, 1)
        for a_, b_, _ in g: e = e * (1 - ((t > a_) & (t < b_)))
        b = np.maximum(b, e)
    return 0.9 * b * b * (3 - 2 * b)
def height(x, y):
    x = np.asarray(x, np.float64); y = np.asarray(y, np.float64)
    h = 3.2 * (vn2(x, y, 95.0, 3) - 0.5) * 2 + 0.9 * (vn2(x, y, 28.0, 5) - 0.5)
    h += 8.0 * np.exp(-((x - CHURCH[0]) ** 2 + (y - CHURCH[1]) ** 2) / (46.0 ** 2))
    h += hedge_bank(x, y) - lane_depth(x, y)
    sd = stream_d(x, y); ford = np.clip(np.abs(x - FORD_X) / 14.0, 0, 1); bridge = np.clip((np.abs(x - BRIDGE_X) - 6.5) / 1.0, 0, 1)
    w = 3.0 + 6.0 * (1 - ford); depth = 1.0 + 0.8 * ford
    cut = np.clip((w + (2.0 + 9.0 * (1 - ford)) - sd) / (2.0 + 9.0 * (1 - ford)), 0, 1) * bridge
    return h - depth * cut
def macro_colour(x, y, z, slope):
    x = np.asarray(x, np.float64); y = np.asarray(y, np.float64)
    n = vn2(x, y, 26.0, 7)[..., None]; n2 = vn2(x, y, 4.0, 9)[..., None]; f = vn2(x, y, 55.0, 13)[..., None]
    grass = np.array((0.22, 0.32, 0.12)); lush = np.array((0.18, 0.30, 0.10)); hay = np.array((0.48, 0.44, 0.24)); plough = np.array((0.30, 0.22, 0.15))
    dirt = np.array((0.34, 0.28, 0.20)); water = np.array((0.08, 0.12, 0.12)); mud = np.array((0.25, 0.22, 0.16))
    c = grass * (0.85 + 0.3 * n) * (0.9 + 0.2 * n2)
    hy = np.clip((f - 0.62) * 8, 0, 1); c = c * (1 - hy) + hay * (0.85 + 0.3 * n2) * hy
    pl = np.clip((0.36 - f) * 8, 0, 1) * (np.abs(np.mod(x * 0.7 + y * 0.7, 2.2) - 1.1) < 0.6)[..., None]; c = c * (1 - pl) + plough * (0.85 + 0.3 * n2) * pl
    ls = np.clip(0.9 - n, 0, 1) * 0.3; c = c * (1 - ls) + lush * ls
    ln = np.clip(lane_depth(x, y) / 0.8, 0, 1)[..., None]; c = c * (1 - ln) + dirt * (0.85 + 0.3 * n2) * ln
    for r in ((BRIDGE_X, -205.0, BRIDGE_X, CHURCH[1] - 30.0), (BRIDGE_X, CHURCH[1] - 30.0, CHURCH[0] - 10.0, CHURCH[1] - 22.0), (-205.0, -110.0, FARMS[0][0], FARMS[0][1]),
              (FARMS[1][0], FARMS[1][1], BRIDGE_X, -100.0), (FORD_X, -205.0, FORD_X, -60.0)):
        d = seg_dist(x, y, r)[..., None]; e = np.clip((3.5 - d) / 1.2, 0, 1); c = c * (1 - e) + dirt * (0.85 + 0.3 * n2) * e
    sd = stream_d(x, y)[..., None]; wa = np.clip((5.0 - sd) / 1.0, 0, 1); bk = np.clip((8.0 - sd) / 2.0, 0, 1) * (1 - wa)
    br = np.clip((np.abs(x - BRIDGE_X) - 6.5) / 1.0, 0, 1)[..., None]
    c = c * (1 - bk * br) + mud * bk * br; c = c * (1 - wa * br) + water * (0.9 + 0.2 * n2) * wa * br
    hb = np.clip(hedge_bank(x, y) / 0.6, 0, 1)[..., None]; c = c * (1 - 0.5 * hb) + mud * 0.5 * hb
    return np.clip(c, 0.04, 0.85)
K.height = height; K.macro_colour = macro_colour
def stream_water():
    xs = np.arange(-212.0, 212.1, 4.0); L_, R_ = [], []
    for x in xs:
        if abs(x - BRIDGE_X) < 7.5: continue
        y = float(stream_y(x)); d1 = 0.42 + 22.0 / 40.0 * math.cos(x / 40.0); nx, ny = -d1 / math.hypot(1, d1), 1 / math.hypot(1, d1)
        w = 3.4 if abs(x - FORD_X) > 14 else 6.5; zf = float(height(x, y)) + 0.3
        L_.append((x + nx * w, y + ny * w, zf)); R_.append((x - nx * w, y - ny * w, zf))
    out = []; cur_l, cur_r, last = [], [], None
    for p, q in zip(L_, R_):
        if last is not None and p[0] - last > 6.0:
            out.append(('strip', (cur_l, cur_r))); cur_l, cur_r = [], []
        cur_l.append(p); cur_r.append(q); last = p[0]
    out.append(('strip', (cur_l, cur_r)))
    return out
K.WATER = stream_water()
K.SUN_DIR, K.SUN_E, K.SUN_COL, K.SKY_AIR, K.SKY_DUST = (0.6, 0.5, -0.55), 4.5, (1.0, 0.92, 0.8), 1.0, 1.5
K.BD_A, K.BD_B = 14.0, 18.0

# ---------------------------------------------------------------- props
def hedge(x0, y0, x1, y1, gates):
    L = math.hypot(x1 - x0, y1 - y0); rz = math.atan2(y1 - y0, x1 - x0); n = max(2, int(L / 5.0))
    for k in range(n):
        t = (k + 0.5) / n
        if any(a <= t <= b for a, b, _ in gates): continue
        x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t; z = gz(x, y)
        box((x, y, z - 0.2), (L / n + 0.6, random.uniform(2.2, 2.8), random.uniform(2.3, 3.0)), 'hedge', rz + random.uniform(-0.08, 0.08))
        if k % 2 == 0: blob((x + random.uniform(-1, 1), y + random.uniform(-1, 1), z + random.uniform(2.4, 3.2)), random.uniform(1.6, 2.3), 'hedge', 0.8, random.randint(0, 999), 0)
        if random.random() < 0.04: tree2(x, y, random.uniform(1.15, 1.45), z=z, sub=1)        # a hedgerow oak
    for a, b, kind in gates:    # gate posts at real gates (not where the hedge was cut for a feature)
        if kind == 'gate' and random.random() < 0.7:
            for t in (a, b):
                if 0.0 < t < 1.0: x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t; box((x, y, gz(x, y)), (0.3, 0.3, 1.5), 'wood', rz)
def farmhouse(x, y, rz, w=12.0, d=7.5, h=6.0):
    z = gz(x, y); box((x, y, z), (w, d, h), 'stone', rz)
    prism_xz([(-d / 2 - 0.5, 0.0), (d / 2 + 0.5, 0.0), (0.0, d * 0.5)], -w / 2 - 0.3, w / 2 + 0.3, 'tile', T(x, y, z + h) @ rRz(rz - math.pi / 2))
    c, s = math.cos(rz), math.sin(rz)
    for lx in (-w / 3, 0.0, w / 3):
        for sy in (-1, 1):
            px, py = x + c * lx - s * sy * (d / 2 + 0.05), y + s * lx + c * sy * (d / 2 + 0.05)
            box((px, py, z + (0.0 if lx == 0 and sy < 0 else 1.0)), (1.2, 0.2, 2.2 if lx == 0 and sy < 0 else 1.3), 'wood', rz, sink=0.0)
            box((px, py, z + 3.7), (1.1, 0.2, 1.2), 'wood', rz, sink=0.0)
    cx_, cy_ = x + c * (w / 2 - 1.0), y + s * (w / 2 - 1.0); box((cx_, cy_, z + h + 1.5), (0.9, 0.9, 3.2), 'brick', rz, sink=0.0)
def barn(x, y, rz, w=18.0, d=10.0, h=6.5, broken=False):
    z = gz(x, y); box((x, y, z), (w, d, h), 'wood', rz)
    M = T(x, y, z + h) @ rRz(rz - math.pi / 2)
    if broken:
        prism_xz([(-d / 2 - 0.4, 0.0), (d / 2 + 0.4, 0.0), (0.0, d * 0.4)], -w / 2, -w * 0.05, 'metal', M)
        for k in range(3): blob((x + random.uniform(-3, 3), y + random.uniform(-2, 2), z + h), 1.5, 'wood', 0.4, random.randint(0, 999), 1)
    else: prism_xz([(-d / 2 - 0.4, 0.0), (d / 2 + 0.4, 0.0), (0.0, d * 0.4)], -w / 2, w / 2, 'metal', M)
    c, s = math.cos(rz), math.sin(rz); box((x - s * (-d / 2 - 0.05), y + c * (-d / 2 - 0.05), z), (4.5, 0.25, 4.5), 'rust', rz, sink=0.0)
def wall(points, h=1.3, gaps=(), mat='stone'):
    for (ax, ay), (bx, by) in zip(points[:-1], points[1:]):
        L = math.hypot(bx - ax, by - ay); n = max(1, int(L / 3.0)); rz = math.atan2(by - ay, bx - ax)
        for k in range(n):
            t = (k + 0.5) / n; x, y = ax + (bx - ax) * t, ay + (by - ay) * t
            if any(math.hypot(x - gx, y - gy) < gr for gx, gy, gr in gaps): continue
            box((x, y, gz(x, y)), (L / n + 0.05, 0.7, h + random.uniform(-0.1, 0.1)), mat, rz)
def farm(cx, cy, rz):
    c, s = math.cos(rz), math.sin(rz)
    def at(lx, ly): return (cx + c * lx - s * ly, cy + s * lx + c * ly)
    farmhouse(*at(-6.0, 8.0), rz); barn(*at(10.0, -6.0), rz + math.pi / 2, broken=random.random() < 0.5); barn(*at(-10.0, -10.0), rz, 12.0, 7.0, 4.5)
    pts = [at(-22, -22), at(22, -22), at(22, 20), at(-22, 20), at(-22, -22)]
    wall(pts, gaps=[(*at(0, -22), 5.0), (*at(22, 0), 5.0), (*at(-22, 6), 4.0)])
    for k in range(4): blob((*at(random.uniform(-5, 8), random.uniform(-16, -12)), gz(*at(0, -14)) + 0.6), random.uniform(1.2, 1.8), 'wood', 0.75, random.randint(0, 999), 1)
    box((*at(4.0, 4.0), gz(*at(4, 4))), (2.0, 4.0, 1.0), 'wood', rz + 0.3); cyl((*at(-16.0, 14.0), gz(*at(-16, 14))), 1.5, 4.0, 'stone', 10)
def church(cx, cy):
    z = gz(cx, cy); rz = 0.0
    box((cx, cy, z - 0.3), (28.0, 11.0, 9.3), 'stone'); prism_xz([(-6.0, 0.0), (6.0, 0.0), (0.0, 5.5)], -14.3, 14.3, 'tile', T(cx, cy, z + 9.0) @ rRz(-math.pi / 2))
    cyl((cx + 14.0, cy, z - 0.3), 5.0, 7.3, 'stone', 12); cyl((cx + 14.0, cy, z + 7.0), 5.4, 2.6, 'tile', 12, 0.5)
    for k in range(4):
        for sy in (-1, 1): box((cx - 9.0 + k * 6.0, cy + sy * 5.55, z + 2.5), (1.4, 0.3, 4.0), 'glass', sink=0.0)
    tx = cx - 17.5; box((tx, cy, z - 0.3), (7.5, 7.5, 22.3), 'stone')
    box((tx, cy, z + 22.0), (8.2, 8.2, 0.8), 'stone', sink=0.0)
    for sx in (-1, 1):
        for sy in (-1, 1): box((tx + sx * 3.4, cy + sy * 3.4, z + 22.8), (1.2, 1.2, 1.6), 'stone', sink=0.0)
    cyl((tx, cy, z + 22.8), 3.6, 11.0, 'tile', 4, 0.05)                                    # the spire (a broken stump would also do)
    for sx in (-1, 1): box((tx + sx * 3.8, cy, z + 16.0), (0.3, 1.8, 3.0), 'glass', sink=0.0)
    box((tx - 3.8, cy, z), (0.3, 2.4, 3.5), 'wood', sink=0.0)
    wall([(cx - 32, cy - 20), (cx + 26, cy - 20), (cx + 26, cy + 18), (cx - 32, cy + 18), (cx - 32, cy - 20)], h=1.4, gaps=[(cx - 32, cy, 4.5), (cx, cy - 20, 4.5), (cx + 26, cy + 5, 4.0)])
    rr = random.Random(9)
    for k in range(40):
        x, y = cx + rr.uniform(-28, 22), cy + rr.choice((-1, 1)) * rr.uniform(8.0, 16.0)
        box((x, y, gz(x, y)), (0.6, 0.2, rr.uniform(0.6, 1.0)), 'grave', rr.uniform(-0.15, 0.15), sink=0.2)
    for k in range(6): tree2(cx + rr.uniform(-28, 22), cy + rr.choice((-1, 1)) * 16.5, rr.uniform(0.9, 1.1))
def bridge(x):
    y = float(stream_y(x)); z = gz(x, y); d1 = 0.42 + 22.0 / 40.0 * math.cos(x / 40.0); rz = math.atan2(1.0, 0.0)
    for sx in (-1, 1): box((x + sx * 6.0, y, z), (0.8, 22.0, 1.1), 'stone', 0.0)
    for sy in (-1, 1): box((x, y + sy * 3.0, z - 2.3), (11.0, 1.8, 2.2), 'stone', 0.0, sink=0.0)
    for sy in (-1, 1):
        for sx in (-1, 1): box((x + sx * 6.0, y + sy * 11.5, z), (1.1, 1.1, 1.5), 'stone', 0.0)
def build_props():
    random.seed(11)
    for x0, y0, x1, y1, g in HEDGES: hedge(x0, y0, x1, y1, g)
    church(*CHURCH)
    farm(FARMS[0][0], FARMS[0][1], 0.15); farm(FARMS[1][0], FARMS[1][1], -0.4)
    for i in range(7):                                                            # the orchard: rows of small fruit trees
        for j in range(6):
            x, y = ORCHARD[0] - 27 + i * 9.0 + random.uniform(-1, 1), ORCHARD[1] - 22 + j * 9.0 + random.uniform(-1, 1); z = gz(x, y)
            cyl((x, y, z - 0.2), 0.18, 1.8, 'bark', 6, 0.12); blob((x, y, z + 2.6), random.uniform(1.6, 2.0), 'foliage', 0.8, random.randint(0, 999), 1)
            if random.random() < 0.5: blob((x + 0.8, y - 0.5, z + 3.2), 1.2, 'foliage', 0.8, random.randint(0, 999), 0)
    wall([(ORCHARD[0] - 33, ORCHARD[1] - 28), (ORCHARD[0] + 33, ORCHARD[1] - 28)], h=1.2, gaps=[(ORCHARD[0], ORCHARD[1] - 28, 4.0)])
    pts = []
    while len(pts) < 18:                                                          # the copse
        x, y = COPSE[0] + random.uniform(-20, 20), COPSE[1] + random.uniform(-18, 18)
        if all(math.hypot(x - a, y - b) > 6.0 for a, b in pts): pts.append((x, y)); tree2(x, y, random.uniform(0.95, 1.25), sub=1)
    bridge(BRIDGE_X)
    for k in range(9):                                                            # stones in the ford
        x = FORD_X + random.uniform(-10, 10); y = float(stream_y(x)) + random.uniform(-4, 4); blob((x, y, gz(x, y) + 0.05), random.uniform(0.3, 0.6), 'rock', 0.5, random.randint(0, 999), 0)
    for x, y, rz in ((BRIDGE_X + 1.5, -60.0, 1.4), (BRIDGE_X - 2.0, 60.0, 1.8), (-60.0, LANE_A_Y + 1.0, 0.1), (-150.0, -112.0, 0.4)): truck(x, y, rz)
    for x, y, rz in ((FORD_X + 3.0, -95.0, 1.2), (-10.0, -40.0, 0.5)): car(x, y, rz)
    for x0, y0, x1, y1 in ((CHURCH[0] - 36, CHURCH[1] - 28, CHURCH[0] - 26, CHURCH[1] - 30), (BRIDGE_X - 8, -10.0, BRIDGE_X - 2, -14.0), (LANE_B_X - 3, -120.0, LANE_B_X + 3, -122.0),
                           (150.0, -20.0, 162.0, -18.0), (-170.0, 60.0, -160.0, 64.0)): sandbags(x0, y0, x1, y1)
    for k in range(12):
        x, y = random.uniform(-185, 185), random.uniform(-185, 185)
        if near_feature(x, y): continue
        r = random.uniform(0.9, 1.6); blob((x, y, gz(x, y) + r * 0.2), r, 'rock', 0.7, random.randint(0, 999))
    log('props', len(K.bm.faces), 'faces')
K.build_props = build_props
hz = lambda x, y, dz: (x, y, float(height(x, y)) + dz)
K.VIEWS = [(hz(CHURCH[0] - 60, CHURCH[1] - 60, 12.0), hz(*CHURCH, 8.0)), (hz(BRIDGE_X - 30, -20.0, 6.0), hz(BRIDGE_X, 15.0, 2.0)), (hz(-60.0, LANE_A_Y, 2.5), hz(60.0, LANE_A_Y, 2.0)),
           (hz(FARMS[0][0] + 40, FARMS[0][1] - 40, 12.0), hz(*FARMS[0], 2.0)), (hz(-150.0, 150.0, 22.0), hz(*ORCHARD, 0.0)), ((0.0, -200.0, 60.0), (0.0, 40.0, 0.0))]
K.run()
