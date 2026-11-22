# Steel Storm Remastered: "IRON HARBOUR" (harbor.hgm), a 420 m port, built with tools/blender/ss_mapkit.py.
#   blender -b --factory-startup -P tools/blender/make_harbor.py -- [nobake] [samples=32] [preview]      (later runs: blender -b art/steelstorm/harbor.blend -P ...)
# then  node tools/export-art.mjs harbor ; node tools/blender/check_heights.mjs "Steel Storm Remastered/assets/harbor.hgm"
# Sea to the north (flat water, not ground: the height map's tops block it), walled by a 1 m quay parapet. From the quay inland: the quay apron
# with three portal cranes, a row of warehouses with streets between, three rail sidings with wagons, the container yard (stacks 1-3 high in
# blocks with lanes between, two gantries), a dry dock with a ship's hull on keel blocks (a ramp leads down into it), a breakwater road out to a
# lighthouse, a finger pier with a crane, a ship alongside; inland a tank farm in bund walls, the port offices, workers' cottages, the gate,
# and a low ridge with berms to the south.
import os, sys, math, random
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ss_mapkit as K
from ss_mapkit import box, blob, cyl, beam, prism_xz, tree2, truck, car, hedgehog, sandbags, gz, vn2, seg_dist, rRz, log
from hgkit import T
from mathutils import Vector, Matrix
import bmesh

K.NAME = 'harbor'
QY = 115.0; ZQ = 2.2; FLOOR = -5.0; WZ = 0.0
MOLE = [(150.0, 108.0), (150.0, 190.0), (30.0, 190.0)]
PIER = (-70.0, -50.0, 108.0, 165.0)
DOCK = (52.0, 82.0, 35.0, 111.0); DOCK_Z = -4.0; RAMP = 20.0
BERMS = [(-120.0, -128.0, 0.3), (-40.0, -134.0, -0.2), (40.0, -126.0, 0.15), (120.0, -132.0, -0.3)]
ROADS = ((0.0, -205.0, 0.0, 58.0), (-200.0, -2.0, 200.0, -2.0), (-200.0, 102.0, 200.0, 102.0), (150.0, -2.0, 150.0, 115.0))
def mole_d(x, y):
    d = np.full(np.shape(x), 1e9)
    for a, b in zip(MOLE[:-1], MOLE[1:]): d = np.minimum(d, seg_dist(x, y, (a[0], a[1], b[0], b[1])))
    return 7.0 - d
def land_d(x, y):
    x0, x1, y0, y1 = PIER
    return np.maximum.reduce([QY - y, mole_d(x, y), np.minimum.reduce([x - x0, x1 - x, y - y0, y1 - y])])
def height(x, y):
    x = np.asarray(x, np.float64); y = np.asarray(y, np.float64)
    inl = np.clip(-y / 200.0, 0, 1); h = ZQ + 4.5 * inl ** 1.3 + 1.2 * (vn2(x, y, 45.0, 3) - 0.5) * np.clip(-y / 60.0, 0, 1)
    h += 2.6 * np.exp(-((y + 130.0) / 15.0) ** 2) * (0.7 + 0.5 * vn2(x, y, 60.0, 5))
    for bx, by, rz in BERMS:
        c, s = math.cos(rz), math.sin(rz); lx = (x - bx) * c + (y - by) * s; ly = -(x - bx) * s + (y - by) * c
        h += 1.35 * np.exp(-(lx / 9.0) ** 4 - (ly / 2.4) ** 2)
    x0, x1, y0, y1 = DOCK
    k = np.clip(np.minimum(x - x0, x1 - x) / 0.8, 0, 1) * np.clip((y1 - y) / 0.8, 0, 1) * (y > y0)
    floor = h + (DOCK_Z - h) * np.clip((y - y0) / RAMP, 0, 1)
    h = h * (1 - k) + floor * k
    m = np.clip(land_d(x, y) / 1.5, 0, 1)
    return h * m + FLOOR * (1 - m)
def macro_colour(x, y, z, slope):
    x = np.asarray(x, np.float64); y = np.asarray(y, np.float64)
    n = vn2(x, y, 22.0, 7)[..., None]; n2 = vn2(x, y, 4.0, 9)[..., None]
    grass = np.array((0.27, 0.30, 0.17)); dirt = np.array((0.33, 0.30, 0.25)); conc = np.array((0.43, 0.42, 0.40)); asph = np.array((0.17, 0.17, 0.18))
    grav = np.array((0.34, 0.33, 0.31)); sea = np.array((0.05, 0.08, 0.09)); wet = np.array((0.24, 0.24, 0.23))
    inl = np.clip((-y - 10.0) / 40.0, 0, 1)[..., None]
    c = (grav * (1 - inl) + (grass * (1 - 0.5 * n) + dirt * 0.5 * n) * inl) * (0.85 + 0.3 * n2)
    ap = np.clip((y - 96.0) / 2.0, 0, 1)[..., None]; c = c * (1 - ap) + conc * (0.85 + 0.25 * n2) * ap                   # quay apron, pier, mole
    md = np.clip((mole_d(x, y) + 1.0) / 1.0, 0, 1)[..., None]; c = c * (1 - md) + conc * (0.8 + 0.25 * n2) * md
    for r in ROADS:
        d = seg_dist(x, y, r)[..., None]; e = np.clip((5.0 - d) / 1.0, 0, 1); c = c * (1 - e) + asph * (0.9 + 0.2 * n2) * e
    yard = (np.clip(np.minimum.reduce([x + 188, -22 - x, y - 3, 58 - y]) / 2.0, 0, 1))[..., None]; c = c * (1 - yard) + conc * 0.85 * (0.8 + 0.3 * n2) * yard
    x0, x1, y0, y1 = DOCK; dk = np.clip(np.minimum.reduce([x - x0 + 1.5, x1 + 1.5 - x, y - y0 + 1.5, y1 + 1.5 - y]) / 1.0, 0, 1)[..., None]
    c = c * (1 - dk) + wet * (0.8 + 0.3 * n2) * dk
    sa = (1 - np.clip(land_d(x, y) / 1.5, 0, 1))[..., None]; c = c * (1 - sa) + sea * sa
    return np.clip(c, 0.04, 0.85)
K.height = height; K.macro_colour = macro_colour
K.WATER = [(WZ, [(-700.0, QY - 1.0), (700.0, QY - 1.0), (700.0, 700.0), (-700.0, 700.0)])]
K.SEA = lambda px, py: np.clip((py - 125.0) / 40.0, 0, 1); K.SEA_Z = WZ
K.SUN_DIR, K.SUN_E, K.SUN_COL, K.SKY_AIR, K.SKY_DUST = (0.55, 0.6, -0.48), 4.3, (1.0, 0.9, 0.76), 1.1, 2.0

# ---------------------------------------------------------------- props
def container(x, y, z, rz, col=None, sink=0.05):
    box((x, y, z), (12.2, 2.44, 2.6), col or random.choice(['red', 'blue', 'green', 'orange', 'rust', 'blue', 'red']), rz, sink=sink)
def stack_block(x0, y0, nx, ny, hmax, rz=0.0):
    """a block of container stacks, nx long x ny wide, 1..hmax high, some gaps"""
    c, s = math.cos(rz), math.sin(rz)
    for i in range(nx):
        for j in range(ny):
            if random.random() < 0.08: continue
            lx, ly = i * 12.5, j * 2.6; x, y = x0 + c * lx - s * ly, y0 + s * lx + c * ly; z = gz(x, y); n = random.randint(1, hmax)
            for k in range(n): container(x, y, z + 2.6 * k, rz + random.uniform(-0.02, 0.02), sink=0.05 if k == 0 else 0.0)
def warehouse(x0, y0, x1, y1, h, mat='brick'):
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2; z = gz(cx, cy); W, D = x1 - x0, y1 - y0
    box((cx, cy, z), (W, D, h), mat)
    M = T(cx, cy, z + h) @ rRz(-math.pi / 2); broken = random.random() < 0.5
    if broken:      # a section of roof gone
        a = random.uniform(0.2, 0.6)
        prism_xz([(-D / 2 - 0.4, 0.0), (D / 2 + 0.4, 0.0), (0.0, D * 0.22)], -W / 2, -W / 2 + W * a, 'metal', M)
        prism_xz([(-D / 2 - 0.4, 0.0), (D / 2 + 0.4, 0.0), (0.0, D * 0.22)], -W / 2 + W * (a + 0.18), W / 2, 'metal', M)
        for k in range(4): blob((x0 + W * (a + 0.09) + random.uniform(-3, 3), cy + random.uniform(-D / 3, D / 3), z + h - 0.5), random.uniform(1.0, 2.0), 'rust', 0.4, random.randint(0, 999), 1)
    else: prism_xz([(-D / 2 - 0.4, 0.0), (D / 2 + 0.4, 0.0), (0.0, D * 0.22)], -W / 2, W / 2, 'metal', M)
    n = max(2, int(W / 12))
    for k in range(n):
        xx = x0 + (k + 0.5) * W / n
        for yy, sgn in ((y0 - 0.05, -1), (y1 + 0.05, 1)): box((xx, yy, z), (5.0, 0.3, 5.5), 'rust', sink=0.0)
        box((xx, y0 - 0.06, z + h - 2.2), (W / n * 0.7, 0.3, 1.0), 'glass', sink=0.0); box((xx, y1 + 0.06, z + h - 2.2), (W / n * 0.7, 0.3, 1.0), 'glass', sink=0.0)
    box((cx - W * 0.15, y0 - 2.0, z), (W * 0.55, 4.0, 1.25), 'concrete')                                               # loading platform: cover
def portal_crane(x, y, rz=0.0):
    z = gz(x, y); c, s = math.cos(rz), math.sin(rz)
    def at(lx, ly): return (x + c * lx - s * ly, y + s * lx + c * ly)
    for lx in (-5.0, 5.0):
        for ly in (-5.5, 5.5): box((*at(lx, ly), z), (1.1, 1.1, 14.0), 'orange', rz)
        beam((*at(lx, -5.5), z + 7.0), (*at(lx, 5.5), z + 12.0), 0.4, 'orange')
    box((*at(0, 0), z + 14.0), (12.0, 13.0, 1.4), 'orange', rz, sink=0.0); box((*at(0, -1.0), z + 15.4), (6.5, 8.0, 5.0), 'orange', rz, sink=0.0)
    box((*at(0, -1.0), z + 17.0), (6.6, 0.3, 1.2), 'glass', rz, sink=0.0)
    tip = Vector((*at(0, 32.0), z + 31.0)); beam(Vector((*at(0, 2.0), z + 18.0)), tip, 1.2, 'orange'); beam(Vector((*at(0, -1.0), z + 26.0)), tip, 0.35, 'metal')
    beam(Vector((*at(0, -1.0), z + 18.0)), Vector((*at(0, -1.0), z + 26.0)), 0.8, 'orange'); beam(Vector((*at(0, -1.0), z + 26.0)), Vector((*at(0, -9.0), z + 19.0)), 0.6, 'orange')
    box((*at(0, -9.5), z + 17.0), (3.0, 3.0, 2.5), 'concrete', rz, sink=0.0); beam(tip, tip - Vector((0, 0, 20.0)), 0.12, 'metal')
def gantry(x, y, span=26.0, h=18.0):
    z = gz(x, y)
    for sx in (-1, 1):
        for sy in (-6.0, 6.0): box((x + sx * span / 2, y + sy, z), (1.2, 1.2, h), 'blue')
        box((x + sx * span / 2, y, z), (1.6, 13.0, 1.0), 'blue')
    for sy in (-6.0, 6.0): box((x, y + sy, z + h), (span + 1.2, 1.4, 1.6), 'blue', sink=0.0)
    box((x - 3.0, y, z + h - 2.5), (4.0, 12.0, 2.5), 'blue', sink=0.0)
def wagon(x, y, rz, kind=0):
    z = gz(x, y)
    if kind == 0: box((x, y, z + 0.9), (13.0, 2.9, 3.0), random.choice(['rust', 'red', 'metal']), rz)
    elif kind == 1: box((x, y, z + 0.9), (12.0, 2.8, 1.4), 'rust', rz); [cyl((x + math.cos(rz) * d, y + math.sin(rz) * d, z + 2.3), 1.0, 0.9, 'metal', 8) for d in (-3.0, 0.0, 3.0)]
    else: cyl((x, y, z + 1.0), 1.4, 0.1, 'metal', 4); beam((x - math.cos(rz) * 5.5, y - math.sin(rz) * 5.5, z + 2.4), (x + math.cos(rz) * 5.5, y + math.sin(rz) * 5.5, z + 2.4), 2.6, 'metal', 2.6)
def rails(y, x0, x1):
    for x in np.arange(x0, x1, 12.0):
        for s in (-0.75, 0.75): box((x + 6.0, y + s, gz(x + 6.0, y)), (12.05, 0.12, 0.18), 'metal', 0.0, sink=0.1)
    box((x1 + 0.6, y, gz(x1, y)), (0.8, 2.6, 1.1), 'rust')                                                              # buffer stop
def ship(cy0, cy1, cx, beam_, zk, zd, mat='rust', axis='y', superstructure=True):
    """a ship's hull lofted from U sections (bow at cy1), deck, a superstructure and funnel at the stern"""
    st = 14; secs = []
    for i in range(st + 1):
        t = i / st; w = beam_ / 2 * (1.0 - max(0.0, (t - 0.6) / 0.4) ** 1.8 * 0.92) * (0.88 + 0.12 * min(1.0, t * 6)); yy = cy0 + (cy1 - cy0) * t
        dz = zd + 1.6 * max(0.0, (t - 0.75) / 0.25) ** 2; kz = zk + 2.5 * max(0.0, (t - 0.85) / 0.15) ** 2
        prof = [(-w, dz), (-w * 0.98, kz + (dz - kz) * 0.35), (-w * 0.75, kz + 0.4), (-w * 0.3, kz), (w * 0.3, kz), (w * 0.75, kz + 0.4), (w * 0.98, kz + (dz - kz) * 0.35), (w, dz)]
        secs.append([(cx + px, yy, pz) if axis == 'y' else (yy, cx + px, pz) for px, pz in prof])
    bmk = K.bm; before = set(bmk.faces); V_ = [[bmk.verts.new(p) for p in s] for s in secs]
    for i in range(st):
        a, b = V_[i], V_[i + 1]
        for j in range(len(a) - 1): bmk.faces.new((a[j], a[j + 1], b[j + 1], b[j]))
        bmk.faces.new((a[-1], a[0], b[0], b[-1]))
    bmk.faces.new(V_[0][::-1]); bmk.faces.new(V_[-1])
    new = [f for f in bmk.faces if f not in before]; bmesh.ops.recalc_face_normals(bmk, faces=new)
    for f in new: f.material_index = K.mat_i(mat)
    if superstructure:
        L = cy1 - cy0; sy = cy0 + L * 0.12; p = (cx, sy) if axis == 'y' else (sy, cx)
        box((p[0], p[1], zd), (beam_ * 0.7, L * 0.12, 6.5) if axis == 'y' else (L * 0.12, beam_ * 0.7, 6.5), 'metal', sink=0.0)
        box((p[0], p[1], zd + 6.5), (beam_ * 0.8, L * 0.06, 2.4) if axis == 'y' else (L * 0.06, beam_ * 0.8, 2.4), 'metal', sink=0.0)
        g = (cx, sy + L * 0.035 + 0.05) if axis == 'y' else (sy + L * 0.035 + 0.05, cx)
        box((g[0], g[1] - 0.0, zd + 7.0), (beam_ * 0.78, 0.2, 1.0) if axis == 'y' else (0.2, beam_ * 0.78, 1.0), 'glass', sink=0.0)
        f_ = (cx, sy - L * 0.05) if axis == 'y' else (sy - L * 0.05, cx); cyl((f_[0], f_[1], zd + 6.5), 1.6, 6.0, 'rust', 10, 1.4)
        for k in range(2):
            q = (cx, cy0 + L * (0.42 + 0.2 * k)) if axis == 'y' else (cy0 + L * (0.42 + 0.2 * k), cx)
            box((q[0], q[1], zd), (beam_ * 0.62, L * 0.13, 1.0) if axis == 'y' else (L * 0.13, beam_ * 0.62, 1.0), 'metal', sink=0.0)       # hatch covers
            m_ = (cx, cy0 + L * (0.52 + 0.2 * k)) if axis == 'y' else (cy0 + L * (0.52 + 0.2 * k), cx); cyl((m_[0], m_[1], zd), 0.35, 9.0, 'metal', 6)
def parapet(points, h=1.0, mat='concrete', step=4.0):
    for (ax, ay), (bx, by) in zip(points[:-1], points[1:]):
        L = math.hypot(bx - ax, by - ay); n = max(1, int(L / step)); rz = math.atan2(by - ay, bx - ax)
        for k in range(n):
            t = (k + 0.5) / n; x, y = ax + (bx - ax) * t, ay + (by - ay) * t; box((x, y, gz(x, y)), (L / n + 0.05, 0.6, h), mat, rz)
def build_props():
    random.seed(11)
    # quay parapet (no driving into the sea) round the main quay, the pier and the breakwater; bollards
    parapet([(-205.0, QY - 0.5), (PIER[0] - 0.5, QY - 0.5)]); parapet([(PIER[1] + 0.5, QY - 0.5), (MOLE[0][0] - 7.5, QY - 0.5)]); parapet([(MOLE[0][0] + 7.5, QY - 0.5), (205.0, QY - 0.5)])
    parapet([(PIER[0] + 0.4, QY - 0.5), (PIER[0] + 0.4, PIER[3] - 0.4), (PIER[1] - 0.4, PIER[3] - 0.4), (PIER[1] - 0.4, QY - 0.5)])
    parapet([(MOLE[0][0] - 6.6, QY - 0.5), (MOLE[0][0] - 6.6, MOLE[1][1] - 6.6), (MOLE[2][0] + 1.0, MOLE[2][1] - 6.6)])
    parapet([(MOLE[0][0] + 6.6, QY - 0.5), (MOLE[0][0] + 6.6, MOLE[1][1] + 6.6), (MOLE[2][0] + 1.0, MOLE[2][1] + 6.6)], h=2.2)
    parapet([(MOLE[2][0] + 1.0, MOLE[2][1] - 6.6), (MOLE[2][0] - 6.0, MOLE[2][1]), (MOLE[2][0] + 1.0, MOLE[2][1] + 6.6)], h=1.0)
    for x in np.arange(-195.0, 200.0, 16.0):
        if PIER[0] - 2 < x < PIER[1] + 2 or DOCK[0] - 2 < x < DOCK[1] + 2 or abs(x - MOLE[0][0]) < 9: continue
        cyl((x, QY - 1.6, gz(x, QY - 1.6)), 0.3, 0.7, 'metal', 8)
    for k in range(60):                                                         # riprap and blocks along the breakwater's seaward side
        t = k / 59.0
        if t < 0.55: x, y = MOLE[0][0] + 9.0 + random.uniform(0, 3), QY + 5 + t / 0.55 * (MOLE[1][1] - QY)
        else: x, y = MOLE[1][0] - (t - 0.55) / 0.45 * (MOLE[1][0] - MOLE[2][0]), MOLE[1][1] + 9.0 + random.uniform(0, 3)
        blob((x, y, WZ - 0.3), random.uniform(1.4, 2.4), 'concrete', 0.7, random.randint(0, 999), 0)
    lx, ly = MOLE[2][0] + 2.0, MOLE[2][1]; z = gz(lx, ly)                         # the lighthouse at the breakwater's end
    cyl((lx, ly, z), 3.2, 16.0, 'plaster', 14, 2.4); cyl((lx, ly, z + 16.0), 2.9, 0.6, 'metal', 14); cyl((lx, ly, z + 16.6), 1.9, 2.4, 'glass', 12); cyl((lx, ly, z + 19.0), 2.1, 1.2, 'red', 12, 0.4)
    for k in range(5): box((MOLE[1][0] - 20.0 - k * 18.0, MOLE[1][1] + random.uniform(-3, 3), gz(MOLE[1][0] - 20 - k * 18, MOLE[1][1])), (3.0, 0.8, 0.9), 'concrete', random.uniform(-0.3, 0.3))
    for k in range(4): box((MOLE[0][0] + random.uniform(-3, 3), QY + 20.0 + k * 16.0, gz(MOLE[0][0], QY + 20 + k * 16)), (0.8, 3.0, 0.9), 'concrete', random.uniform(-0.3, 0.3))
    truck(MOLE[0][0] - 2.0, 170.0, 0.2); truck(95.0, MOLE[1][1] + 1.5, 1.4)
    # portal cranes on the quay apron, one on the pier
    for x in (-150.0, -25.0, 105.0, 125.0): portal_crane(x, 107.5)
    portal_crane((PIER[0] + PIER[1]) / 2, 150.0)
    # warehouses with streets between (loading platforms on their south faces are cover)
    for x0, x1, h, m in ((-185.0, -138.0, 10.0, 'brick'), (-122.0, -80.0, 11.0, 'concrete'), (-64.0, -18.0, 9.5, 'brick'), (-2.0, 40.0, 12.0, 'plaster'), (96.0, 140.0, 10.5, 'brick'),
                         (160.0, 185.0, 9.0, 'concrete')):
        warehouse(x0, 74.0, x1, 96.0, h, m)
    # rail sidings with wagons, ending short of the dock
    for i, y in enumerate((60.0, 64.0, 68.0)):
        rails(y, -200.0, 44.0)
        for x in np.arange(-180.0 + i * 9.0, 20.0, 34.0):
            if random.random() < 0.65: wagon(x, y, 0.0, random.choice((0, 0, 1, 2)))
    # the container yard: blocks with lanes between, two gantries; a smaller stack yard east of the dock
    for bx in (-182.0, -134.0, -86.0):
        for by in (8.0, 26.0, 44.0): stack_block(bx, by, 3, 3, 3)
    gantry(-120.0, 30.0); gantry(-58.0, 12.0)
    for bx, by in ((-40.0, 46.0),): stack_block(bx, by, 1, 2, 2)
    for bx, by, rz in ((100.0, 10.0, 0.0), (120.0, 40.0, 0.0), (165.0, 22.0, math.pi / 2)): stack_block(bx, by, 2, 3, 2, rz)
    for k in range(10):                                                         # loose and toppled containers
        x, y = random.uniform(-180, 170), random.uniform(-25, 52)
        if DOCK[0] - 8 < x < DOCK[1] + 8 or abs(x) < 8: continue
        container(x, y, gz(x, y), random.uniform(0, 3.14))
    # the dry dock: the hull on keel blocks, the caisson gate, staging along the hull, the dock's coping
    cx = (DOCK[0] + DOCK[1]) / 2
    for y in np.arange(DOCK[2] + RAMP + 4.0, DOCK[3] - 4.0, 4.0): box((cx, y, DOCK_Z), (2.0, 1.2, 1.2), 'wood', sink=0.0)
    ship(DOCK[2] + RAMP + 2.0, DOCK[3] - 3.0, cx, 13.0, DOCK_Z + 1.2, ZQ + 4.0, 'rust')
    box((cx, DOCK[3] + 2.0, gz(cx, DOCK[3] + 2.0)), (DOCK[1] - DOCK[0] + 2.0, 3.0, 1.4), 'rust')
    for sx in (-1, 1):
        for y in np.arange(DOCK[2] + RAMP + 8.0, DOCK[3] - 10.0, 12.0): beam((cx + sx * 7.2, y, DOCK_Z), (cx + sx * 7.2, y, ZQ + 2.0), 0.25, 'metal'); beam((cx + sx * 7.2, y, ZQ + 1.0), (cx + sx * 7.2, y + 12.0, ZQ + 1.0), 0.2, 'metal')
        for y in np.arange(DOCK[2] + RAMP, DOCK[3], 4.0): box((cx + sx * ((DOCK[1] - DOCK[0]) / 2 + 0.8), y + 2.0, ZQ), (1.0, 4.05, 0.5), 'concrete')
    # a ship alongside the west quay (in the water: scenery), a small one at the pier
    ship(-182.0, -95.0, QY + 10.0, 15.0, FLOOR + 1.0, WZ + 4.5, 'red', axis='x')
    ship(PIER[3] - 50.0, PIER[3] - 6.0, PIER[0] - 7.5, 8.0, FLOOR + 1.0, WZ + 3.0, 'blue', superstructure=True)
    # inland: the tank farm in bund walls (cover), the port offices, workers' cottages, the gate, sandbagged posts, berms on the ridge
    for tx, ty in ((95.0, -45.0), (125.0, -45.0), (95.0, -75.0), (125.0, -75.0)): cyl((tx, ty, gz(tx, ty) - 0.3), 10.0, 11.0, 'metal', 16); cyl((tx, ty, gz(tx, ty) + 10.7), 10.0, 1.2, 'metal', 16, 3.0)
    parapet([(78.0, -28.0), (142.0, -28.0), (142.0, -92.0), (78.0, -92.0), (78.0, -64.0)], h=1.3)
    parapet([(78.0, -56.0), (78.0, -28.0)], h=1.3)
    for x, y, w, d, h in ((-40.0, -40.0, 24.0, 14.0, 11.0), (-12.0, -48.0, 12.0, 20.0, 8.0), (40.0, -40.0, 18.0, 12.0, 7.0)):
        z = gz(x, y); box((x, y, z), (w, d, h), 'brick')
        for fl in range(int(h / 3.4)):
            for sy in (-1, 1): box((x, y + sy * (d / 2 + 0.05), z + 1.2 + fl * 3.4), (w * 0.85, 0.2, 1.3), 'glass', sink=0.0)
    for k, (x, y) in enumerate(((-130.0, -95.0), (-112.0, -95.0), (-94.0, -95.0), (-130.0, -70.0), (-112.0, -70.0), (-160.0, -82.0))):
        z = gz(x, y); box((x, y, z), (9.0, 7.0, 5.0), 'brick'); prism_xz([(-3.9, 0.0), (3.9, 0.0), (0.0, 2.6)], -4.7, 4.7, 'tile', T(x, y, z + 5.0) @ rRz(-math.pi / 2))
    box((-14.0, -165.0, gz(-14, -165)), (6.0, 6.0, 3.5), 'concrete'); box((14.0, -165.0, gz(14, -165)), (6.0, 6.0, 3.5), 'concrete')
    beam((-14.0, -165.0, gz(-14, -165) + 3.2), (14.0, -165.0, gz(14, -165) + 3.2), 0.4, 'red')
    for a, b in ((-200.0, -150.0), (-130.0, -60.0), (-40.0, -18.0), (18.0, 40.0), (60.0, 130.0), (150.0, 200.0)): parapet([(a, -165.0), (b, -165.0)], h=2.4, mat="brick", step=6.0)
    for x in (-170.0, -110.0, -60.0, 60.0, 110.0, 170.0): box((x, -165.0, gz(x, -165) + 2.2), (8.0, 1.0, 0.6), 'brick', sink=0.0)
    for x0, y0, x1, y1 in ((-30.0, 20.0, -22.0, 34.0), (30.0, 0.0, 40.0, 8.0), (-15.0, -110.0, 5.0, -114.0), (60.0, -112.0, 80.0, -108.0), (-80.0, -112.0, -62.0, -116.0)): sandbags(x0, y0, x1, y1)
    for x in (-12.0, -6.0, 6.0, 12.0): hedgehog(x, 50.0, random.uniform(0, 3))
    for x, y, rz in ((-10.0, 15.0, 0.3), (20.0, -15.0, 1.7), (-75.0, -20.0, 0.1), (160.0, -50.0, 2.2), (-150.0, -30.0, 1.0)): truck(x, y, rz)
    for x, y, rz in ((-160.0, 100.5, 0.1), (45.0, 104.0, 1.5), (5.0, -60.0, 0.6), (-50.0, -10.0, 2.0)): car(x, y, rz)
    # the dockers' terraces: two rows of houses facing each other across a street south of the offices (some gutted to low walls)
    for row_y, face in ((-96.0, -1), (-116.0, 1)):
        for x in np.arange(-82.0, 72.0, 11.0):
            if abs(x) < 9.0: continue
            z = gz(x, row_y)
            if random.random() < 0.22:
                for k in range(3): box((x + random.uniform(-4, 4), row_y + random.uniform(-3, 3), z), (random.uniform(2, 5), 0.6, random.uniform(1.0, 2.2)), 'brick', random.uniform(0, 3))
                blob((x, row_y, z - 0.3), 2.2, 'brick', 0.35, random.randint(0, 999), 1); continue
            box((x, row_y, z), (10.4, 8.0, 6.6), random.choice(['brick', 'brick', 'plaster']))
            prism_xz([(-4.4, 0.0), (4.4, 0.0), (0.0, 3.0)], -5.2, 5.2, 'tile', T(x, row_y, z + 6.6) @ rRz(-math.pi / 2))
            for lx in (-2.6, 2.6):
                box((x + lx, row_y + face * 4.05, z + 1.0), (1.2, 0.2, 1.4), 'glass', sink=0.0); box((x + lx, row_y + face * 4.05, z + 4.2), (1.2, 0.2, 1.3), 'glass', sink=0.0)
            box((x + 0.0, row_y + face * 4.05, z), (1.1, 0.25, 2.2), 'wood', sink=0.0); box((x + 3.6, row_y, z + 7.5), (0.9, 1.6, 2.2), 'brick', sink=0.0)
    for x, y, rz in ((-30.0, -105.0, 0.1), (35.0, -106.0, 3.0)): car(x, y, rz)
    for x0, y0, x1, y1 in ((-60.0, -104.0, -52.0, -103.0), (45.0, -105.0, 52.0, -103.0)): sandbags(x0, y0, x1, y1)
    for k in range(10):                                                         # a timber yard
        x, y = 140.0 + (k % 5) * 9.0, -128.0 - (k // 5) * 12.0; z = gz(x, y)
        for j in range(random.randint(1, 3)): box((x, y, z + j * 1.1), (7.0, 3.0, 1.1), 'wood', 0.02 * j, sink=0.2 if j == 0 else 0.0)
    for k in range(9):                                                          # a scrapyard
        x, y = random.uniform(-185, -150), random.uniform(-45, -10); blob((x, y, gz(x, y) - 0.4), random.uniform(2.0, 3.4), 'rust', 0.55, random.randint(0, 999), 1)
    for k in range(26):
        x, y = random.uniform(-185, 185), random.uniform(-185, -100)
        if -125 < y < -88 and -90 < x < 80: continue
        if abs(x) < 12 or abs(y + 165) < 6: continue
        tree2(x, y, random.uniform(0.85, 1.15))
    for k in range(14):
        x, y = random.uniform(-185, 185), random.uniform(-190, -110)
        if abs(x) < 12 or abs(y + 165) < 8: continue
        r = random.uniform(1.0, 2.2); blob((x, y, gz(x, y) + r * 0.25), r, 'rock', 0.75, random.randint(0, 999))
    log('props', len(K.bm.faces), 'faces')
K.build_props = build_props
K.VIEWS = [((-40.0, -40.0, 30.0), (-60.0, 80.0, 5.0)), ((67.0, 10.0, 14.0), (67.0, 90.0, 0.0)), ((150.0, 100.0, 10.0), (60.0, 190.0, 4.0)),
           ((-150.0, -10.0, 8.0), (-100.0, 40.0, 4.0)), ((100.0, -120.0, 14.0), (110.0, -50.0, 5.0)), ((0.0, -200.0, 40.0), (0.0, 60.0, 0.0))]
K.run()
