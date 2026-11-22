# Steel Storm Remastered: "BROKEN CITY" (city.hgm), a bombed city centre 420 m across, built with tools/blender/ss_mapkit.py.
#   blender -b --factory-startup -P tools/blender/make_city.py -- [nobake] [samples=32] [preview]   (later runs: blender -b art/steelstorm/city.blend -P ...)
# then  node tools/export-art.mjs city ; node tools/blender/check_heights.mjs "Steel Storm Remastered/assets/city.hgm"
# A grid of 14 m streets between ruined blocks (the blocks are solid: broken buildings of 3-7 floors, some collapsed into rubble heaps), a 30 m
# boulevard east-west with a tree-lined median and burnt-out trams, a park with low walls, a pond and a bandstand, three rubble-filled squares
# (low rubble you drive over, chunks you do not), a railway cutting north-south (6.5 m deep, steep retaining walls, ramps at its ends, a derailed
# train in it) crossed by two bridges (the boulevard and a north street), barricades of sandbags, hedgehogs and overturned buses across streets.
import os, sys, math, random
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ss_mapkit as K
from ss_mapkit import box, blob, cyl, beam, prism_xz, tree2, truck, car, hedgehog, sandbags, gz, vn2, seg_dist, rRz, log
from hgkit import T

K.NAME = 'city'
COLS = [(-183.0, -143.0), (-129.0, -89.0), (-75.0, -35.0), (-21.0, 19.0), (33.0, 73.0), (87.0, 105.0), (137.0, 183.0)]
ROWS = [(-163.0, -123.0), (-109.0, -69.0), (-55.0, -15.0), (15.0, 55.0), (69.0, 109.0), (123.0, 163.0)]
CUT_X = 120.0; CUT_W = 8.0; CUT_D = 6.5; BRIDGES_Y = (0.0, 116.0)
PARK = (-75.0, 19.0, 15.0, 55.0); POND = (-50.0, 38.0, 9.0, 6.0)
SQUARES = [(1, 1), (4, 4), (6, 2)]                 # (column, row) blocks left open as rubble-filled squares
def in_park(i, j): return j == 3 and i in (2, 3)
def cut_depth(x, y):
    x = np.asarray(x, np.float64); y = np.asarray(y, np.float64)
    d = np.abs(x - CUT_X); wall = np.clip((CUT_W + 1.4 - d) / 1.4, 0, 1)
    ramp = np.clip((188.0 - np.abs(y)) / 26.0, 0, 1)
    br = np.ones(np.shape(x))
    for by in BRIDGES_Y: br = br * np.clip((np.abs(y - by) - (16.0 if by == 0 else 8.0)) / 0.8, 0, 1)
    d = CUT_D * wall * ramp * br
    # between the two bridges a ledge runs down the west wall from street level (y 28) to the floor (y 62): the middle stretch is reachable
    lx = np.clip(np.minimum(x - (CUT_X - CUT_W - 2.0), (CUT_X - CUT_W + 6.0) - x) / 0.8, 0, 1) * np.clip(np.minimum(y - 26.0, 66.0 - y) / 0.8, 0, 1)
    return d * (1 - lx) + np.minimum(d, CUT_D * np.clip((y - 28.0) / 34.0, 0, 1)) * lx
def height(x, y):
    x = np.asarray(x, np.float64); y = np.asarray(y, np.float64)
    h = 0.9 * (vn2(x, y, 120.0, 3) - 0.5) + 0.25 * (vn2(x, y, 30.0, 5) - 0.5)
    px, py, rx, ry = POND; e = np.clip(1.0 - np.sqrt(((x - px) / rx) ** 2 + ((y - py) / ry) ** 2), 0, 1); h -= 0.9 * np.clip(e * 2.5, 0, 1)
    return h - cut_depth(x, y)
def macro_colour(x, y, z, slope):
    x = np.asarray(x, np.float64); y = np.asarray(y, np.float64)
    n = vn2(x, y, 20.0, 7)[..., None]; n2 = vn2(x, y, 4.0, 9)[..., None]
    asph = np.array((0.16, 0.16, 0.17)); pave = np.array((0.38, 0.37, 0.35)); grass = np.array((0.22, 0.29, 0.13)); dust = np.array((0.36, 0.34, 0.31))
    ball = np.array((0.30, 0.29, 0.27)); conc = np.array((0.42, 0.41, 0.39)); water = np.array((0.07, 0.10, 0.10)); soot = np.array((0.12, 0.12, 0.12))
    c = asph * (0.85 + 0.3 * n2) * (0.9 + 0.2 * n)
    for i, (x0, x1) in enumerate(COLS):
        for j, (y0, y1) in enumerate(ROWS):
            inside = np.clip(np.minimum.reduce([x - x0 + 3.0, x1 + 3.0 - x, y - y0 + 3.0, y1 + 3.0 - y]) / 0.6, 0, 1)[..., None]
            c = c * (1 - inside) + pave * (0.8 + 0.3 * n2) * inside
            if (i, j) in SQUARES: core = np.clip(np.minimum.reduce([x - x0, x1 - x, y - y0, y1 - y]) / 3.0, 0, 1)[..., None]; c = c * (1 - core) + dust * (0.8 + 0.4 * n2) * core
    px0, px1, py0, py1 = PARK; pk = np.clip(np.minimum.reduce([x - px0, px1 - x, y - py0, py1 - y]) / 2.0, 0, 1)[..., None]
    path = (np.abs(x - (-28.0)) < 2.0) | (np.abs(y - 35.0) < 2.0); c = c * (1 - pk) + np.where(path[..., None], dust, grass * (0.8 + 0.4 * n)) * pk
    med = np.clip((3.0 - np.abs(y)) / 0.5, 0, 1)[..., None] * (np.abs(x - CUT_X) > 20)[..., None]; c = c * (1 - med) + grass * 0.9 * med
    cd = np.clip(cut_depth(x, y) / 1.0, 0, 1)[..., None]; fl = np.clip((CUT_W - np.abs(x - CUT_X)) / 1.0, 0, 1)[..., None]
    c = c * (1 - cd) + (ball * fl + conc * (1 - fl)) * (0.85 + 0.3 * n2) * cd
    px, py, rx, ry = POND; e = (np.sqrt(((x - px) / rx) ** 2 + ((y - py) / ry) ** 2) < 0.85)[..., None]; c = np.where(e, water, c)
    sc = np.clip((vn2(x, y, 9.0, 31) - 0.72) * 6, 0, 1)[..., None]; c = c * (1 - 0.6 * sc) + soot * 0.6 * sc                # scorch marks
    return np.clip(c, 0.04, 0.85)
K.height = height; K.macro_colour = macro_colour
px, py, rx, ry = POND
K.WATER = [(float(height(px, py)) + 0.3, [(px + rx * 0.9 * math.cos(a), py + ry * 0.9 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 20, endpoint=False)])]
K.SUN_DIR, K.SUN_E, K.SUN_COL, K.SKY_AIR, K.SKY_DUST = (0.45, 0.62, -0.5), 4.0, (1.0, 0.84, 0.66), 1.6, 7.0
K.BD_A, K.BD_B = 18.0, 20.0

# ---------------------------------------------------------------- props
def building(x0, y0, x1, y1, rng):
    """a broken city building: a solid mass, a jagged top, window rows on its long faces, sometimes a gutted corner"""
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2; W, D = x1 - x0, y1 - y0; z = gz(cx, cy)
    fl = rng.randint(3, 7); h = fl * 3.3; mat = rng.choice(['brick', 'plaster', 'concrete', 'brick', 'plaster'])
    if rng.random() < 0.14:      # collapsed: a high rubble heap with a standing wall stump
        for k in range(5): blob((cx + rng.uniform(-W / 3, W / 3), cy + rng.uniform(-D / 3, D / 3), z - 0.5), rng.uniform(3.0, 5.0), mat, 0.55, rng.randint(0, 999), 1)
        box((x0 + 1.0, cy, z), (0.8, D * 0.8, h * 0.6), mat, sink=0.4); return
    box((cx, cy, z), (W, D, h * 0.75), mat)
    nx_ = 2 if W > D else 1; ny_ = 1 if W > D else 2
    for a in range(nx_):
        for b in range(ny_):
            sx, sy = W / nx_, D / ny_; hh = h * 0.25 * rng.uniform(0.0, 1.2)
            if hh > 0.8: box((x0 + (a + 0.5) * sx, y0 + (b + 0.5) * sy, z + h * 0.75), (sx * rng.uniform(0.7, 1.0), sy * rng.uniform(0.7, 1.0), hh), mat, sink=0.0, tilt=(rng.uniform(-0.05, 0.05), rng.uniform(-0.05, 0.05)))
    if rng.random() < 0.4: box((x0 + rng.uniform(1, W - 1), cy, z + h * 0.75), (rng.uniform(0.6, 1.2), D * 0.9, rng.uniform(2.0, 5.0)), mat, sink=0.0)       # a wall standing proud
    top = h * 0.75
    for f in range(fl):
        zz = z + 1.2 + f * 3.3
        if zz + 1.4 > z + top: break
        if W >= D:
            for sy in (-1, 1): box((cx, cy + sy * (D / 2 + 0.06), zz), (W * 0.84, 0.25, 1.5), 'glass', sink=0.0)
        else:
            for sx in (-1, 1): box((cx + sx * (W / 2 + 0.06), cy, zz), (0.25, D * 0.84, 1.5), 'glass', sink=0.0)
    if rng.random() < 0.5:
        for k in range(3): blob((cx + rng.choice((-1, 1)) * (W / 2 + rng.uniform(0.5, 2.5)), cy + rng.uniform(-D / 2, D / 2), z - 0.25), rng.uniform(0.6, 1.0), mat, 0.4, rng.randint(0, 999), 1)
def block(i, j, rng):
    x0, x1 = COLS[i]; y0, y1 = ROWS[j]; W, D = x1 - x0, y1 - y0
    if W > D * 0.9 and W > 25:
        cuts = sorted(rng.sample([x0 + W * t for t in (0.25, 0.38, 0.5, 0.62, 0.75)], 2)); xs = [x0] + cuts + [x1]
        for a, b in zip(xs[:-1], xs[1:]):
            if rng.random() < 0.5: building(a, y0, b, y1, rng)
            else: m = y0 + D * rng.uniform(0.4, 0.6); building(a, y0, b, m, rng); building(a, m, b, y1, rng)
    else:
        m = y0 + D * rng.uniform(0.35, 0.65); building(x0, y0, x1, m, rng); building(x0, m, x1, y1, rng)
def square(i, j, rng):
    x0, x1 = COLS[i]; y0, y1 = ROWS[j]; cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    for k in range(60):         # low rubble a tank drives over
        x, y = rng.uniform(x0, x1), rng.uniform(y0, y1); box((x, y, gz(x, y)), (rng.uniform(0.4, 1.4), rng.uniform(0.3, 1.0), rng.uniform(0.15, 0.45)), rng.choice(['brick', 'concrete', 'stone']), rng.uniform(0, 3), sink=0.1)
    for k in range(7):          # chunks that block
        x, y = rng.uniform(x0 + 4, x1 - 4), rng.uniform(y0 + 4, y1 - 4)
        if math.hypot(x - cx, y - cy) < 7: continue
        box((x, y, gz(x, y)), (rng.uniform(2.0, 4.0), rng.uniform(1.5, 3.0), rng.uniform(1.0, 2.2)), rng.choice(['concrete', 'brick']), rng.uniform(0, 3), tilt=(rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3)))
    if (i, j) == (4, 4):        # the plaza's monument
        z = gz(cx, cy); box((cx, cy, z), (5.0, 5.0, 2.2), 'stone'); box((cx, cy, z + 2.2), (2.2, 2.2, 3.5), 'stone', sink=0.0); blob((cx, cy, z + 6.3), 1.3, 'metal', 1.4, 3, 1)
    else:
        for k in range(2): truck(cx + rng.uniform(-8, 8), cy + rng.uniform(-8, 8), rng.uniform(0, 3))
    for sx in (-1, 1):          # a broken wall at two of its edges
        box((cx + sx * (x1 - x0) / 2, cy + rng.uniform(-6, 6), gz(cx + sx * (x1 - x0) / 2, cy)), (0.7, rng.uniform(8, 14), rng.uniform(1.5, 3.5)), 'brick')
def park():
    px0, px1, py0, py1 = PARK; rr = random.Random(21)
    for x0_, y0_, x1_, y1_ in ((px0, py0, px1, py0), (px0, py1, px1, py1), (px0, py0, px0, py1), (px1, py0, px1, py1)):
        L = math.hypot(x1_ - x0_, y1_ - y0_); rz = math.atan2(y1_ - y0_, x1_ - x0_); n = int(L / 3.0)
        for k in range(n):
            t = (k + 0.5) / n; x, y = x0_ + (x1_ - x0_) * t, y0_ + (y1_ - y0_) * t
            if abs(x + 28.0) < 4 or abs(y - 35.0) < 4 or abs(x + 52.0) < 3 or rr.random() < 0.12: continue                # gates, and gaps blown in it
            box((x, y, gz(x, y)), (L / n + 0.05, 0.6, 1.05), 'stone', rz)
    pts = []
    while len(pts) < 22:
        x, y = rr.uniform(px0 + 5, px1 - 5), rr.uniform(py0 + 5, py1 - 5)
        if abs(x + 28) < 4 or abs(y - 35) < 4 or math.hypot((x - POND[0]) / (POND[2] + 3), (y - POND[1]) / (POND[3] + 3)) < 1: continue
        if all(math.hypot(x - a, y - b) > 7.0 for a, b in pts): pts.append((x, y)); tree2(x, y, rr.uniform(0.8, 1.15))
    bx, by = 2.0, 30.0; z = gz(bx, by); cyl((bx, by, z - 0.3), 6.0, 1.0, 'stone', 10)                                  # the bandstand
    for k in range(8): a = k * math.pi / 4; cyl((bx + 5.2 * math.cos(a), by + 5.2 * math.sin(a), z + 0.7), 0.18, 3.0, 'metal', 6)
    cyl((bx, by, z + 3.7), 6.4, 1.6, 'metal', 10, 0.6)
    for k in range(5): x, y = rr.uniform(px0 + 6, px1 - 6), rr.uniform(py0 + 4, py1 - 4); sandbags(x, y, x + rr.uniform(-6, 6), y + rr.uniform(-6, 6))
def railway():
    rr = random.Random(31)
    for y in np.arange(-180.0, 180.0, 12.0):
        if any(abs(y + 6 - by) < (17.0 if by == 0 else 9.0) for by in BRIDGES_Y): continue
        for tx in (-2.6, 2.6):
            for s in (-0.75, 0.75): box((CUT_X + tx + s, y + 6.0, gz(CUT_X + tx + s, y + 6.0)), (0.12, 12.05, 0.18), 'metal', sink=0.1)
    ys = [-150.0, -136.0, -122.0, -108.0, -94.0, 30.0, 44.0, 58.0]
    for k, y in enumerate(ys):      # a derailed train: the engine and wagons slewed across the cut
        rz = math.pi / 2 + rr.uniform(-0.35, 0.35) * (1 if k % 2 else -1); x = CUT_X + (rr.uniform(-2.5, 2.5) if y < 0 else 3.5); z = gz(x, y)
        box((x, y, z + 0.8), (13.0, 3.0, 3.4), 'rust' if k else 'metal', rz, tilt=(rr.uniform(-0.15, 0.15), 0.0))
        if k == 0: cyl((x, y + 3.0, z + 4.2), 0.6, 1.6, 'metal', 8)
    for by in BRIDGES_Y:            # bridges: parapets, girders under the decks, piers on the cutting floor
        half = 16.0 if by == 0 else 8.0
        for sy in (-1, 1):
            for k in range(int((2 * CUT_W + 6) / 3)):
                x = CUT_X - CUT_W - 3 + (k + 0.5) * 3.0; box((x, by + sy * (half - 0.4), gz(x, by + sy * (half - 0.4))), (3.05, 0.6, 1.1), 'concrete')
            box((CUT_X, by + sy * (half - 1.0), -CUT_D + 2.2), (2 * CUT_W + 2.0, 1.2, 4.0), 'rust', sink=0.0)
        box((CUT_X, by, -CUT_D + 0.3), (1.6, 2 * half - 4.0, 4.0), 'concrete', sink=0.3)
def barricades(rng):
    """streets crossed by barricades with a gap (one tank at a time squeezes through: choke points); rz = the line of the barricade"""
    for x, y, rz in ((-136.0, -28.0, 0.0), (-82.0, 62.0, math.pi / 2), (26.0, -90.0, 0.0), (80.0, 140.0, 0.0), (-28.0, -116.0, 0.0), (-136.0, 116.0, 0.0),
                     (26.0, 8.0, 0.0), (-136.0, -8.0, 0.0), (160.0, 62.0, math.pi / 2), (-190.0 + 54.0 * 3, -62.0, math.pi / 2)):
        c, s_ = math.cos(rz), math.sin(rz); gap = rng.uniform(-3.0, 3.0)
        for t0, t1 in ((-7.5, gap - 2.3), (gap + 2.3, 7.5)):
            if t1 - t0 < 1.0: continue
            if rng.random() < 0.6: sandbags(x + c * t0, y + s_ * t0, x + c * t1, y + s_ * t1, 1.2)
            else:
                for t in np.arange(t0 + 0.9, t1, 1.8): hedgehog(x + c * t, y + s_ * t, rng.uniform(0, 3))
        if rng.random() < 0.4:
            t = 7.5 + 2.0; box((x + c * t, y + s_ * t, gz(x + c * t, y + s_ * t)), (11.0, 2.6, 2.8), 'red', rz + math.pi / 2 + rng.uniform(-0.3, 0.3), tilt=(0.0, 0.5))
def boulevard(rng):
    for x in np.arange(-185.0, 105.0, 15.0):
        if abs(x - 26.0) < 6 or abs(x + 136.0) < 6: continue
        if rng.random() < 0.8: tree2(x + rng.uniform(-2, 2), rng.uniform(-1.0, 1.0), rng.uniform(0.75, 1.0))
        else: blob((x, 0.0, gz(x, 0.0)), 1.1, 'bark', 0.3, rng.randint(0, 999), 1)
    for x in np.arange(-180.0, 100.0, 30.0):
        for sy in (-1, 1): cyl((x, sy * 12.5, gz(x, sy * 12.5)), 0.12, 6.0, 'metal', 6)
    for x, y, rz in ((-160.0, 7.0, 0.05), (-100.0, -7.5, 3.1), (-58.0, 7.0, 0.2), (60.0, -7.0, 3.0), (160.0, 7.0, 0.1)):
        box((x, y, gz(x, y) + 0.4), (14.0, 2.6, 3.0), 'red', rz, tilt=(0.25 if rng.random() < 0.4 else 0.0, 0.0))                     # burnt trams
        box((x, y, gz(x, y) + 3.4), (13.0, 2.4, 0.3), 'metal', rz, sink=0.0)
def build_props():
    rng = random.Random(11); random.seed(11)
    for i in range(len(COLS)):
        for j in range(len(ROWS)):
            if in_park(i, j): continue
            if (i, j) in SQUARES: square(i, j, rng); continue
            block(i, j, rng)
    park(); railway(); barricades(rng); boulevard(rng)
    for k in range(40):             # burnt cars along the streets
        if rng.random() < 0.5: x = rng.choice([c[1] + 7.0 for c in COLS[:-1]]) + rng.uniform(-4, 4); y = rng.uniform(-170, 170)
        else: y = rng.choice([r[1] + 7.0 for r in ROWS[:-1] if r[1] != -15.0]) + rng.uniform(-4, 4); x = rng.uniform(-185, 100)
        if abs(x - CUT_X) < 16 or (PARK[0] < x < PARK[1] and PARK[2] < y < PARK[3]): continue
        car(x, y, rng.uniform(0, 3.14))
    for k in range(14):             # craters' lips and shell-torn street (low)
        x, y = rng.uniform(-185, 100), rng.uniform(-175, 175); blob((x, y, gz(x, y) - 0.5), rng.uniform(1.0, 1.6), 'concrete', 0.3, rng.randint(0, 999), 1)
    log('props', len(K.bm.faces), 'faces')
K.build_props = build_props
K.VIEWS = [((-110.0, -8.0, 4.0), (40.0, 0.0, 3.0)), ((CUT_X, -180.0, 4.0), (CUT_X, 0.0, -3.0)), ((-28.0, -40.0, 30.0), (-28.0, 40.0, 0.0)),
           ((-109.0, -40.0, 12.0), (-109.0, -89.0, 0.0)), ((26.0, -140.0, 3.0), (26.0, 60.0, 4.0)), ((-200.0, -200.0, 90.0), (20.0, 20.0, 0.0))]
K.run()
