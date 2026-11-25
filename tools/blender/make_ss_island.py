# Steel Storm Remastered: "THE ISLAND" (island.hgm): one big island, 1280 m square file, height 0 = sea level. The game draws the sea itself
# (an endless plane at height 0), so the file has NO water, NO backdrop: just the ground (island + sea bed down to -9.8 m, reaching the file
# edge) and one props mesh. Own terrain / scatter / run code; the kit (ss_mapkit.py) only lends its pictures, materials and prop builders.
#   "C:/Program Files/Blender Foundation/Blender 4.5/blender.exe" -b --factory-startup -P tools/blender/make_ss_island.py -- [nobake] [samples=32] [map] [preview] [skyprev]
#   (later runs: ... -b art/steelstorm/island.blend -P ...)   then   node tools/export-art.mjs island
#   check:  node art/steelstorm/island_check.mjs "Steel Storm Rebuilt/assets/island.hgm"
# Options: map = only write art/mockups/ss-island-map.png (design view) and stop; nobake = skip the light bakes (keep old pictures);
#          preview = aerial + ground pictures art/mockups/ss-island-air.png / -ground.png (rendered from the macro material, not the bake).
# Blender axes: x east, y north (game z = -y). All places below are in BLENDER x, y; the report negates y.
import os, sys, math, random, json, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Matrix
import ss_mapkit as K
from ss_mapkit import box, blob, cyl, beam, prism_xz, log, rRz, rRx, rRy
from hgkit import T, save_image, smart_uv
OPT = K.OPT
K.NAME = 'island'
HALF = 640.0; K.HALF = HALF
MG = 2.0; NG = int(2 * HALF / MG) + 1
GX = np.linspace(-HALF, HALF, NG)
X2, Y2 = np.meshgrid(GX, GX, indexing='ij')
MOCK = os.path.join(K.ROOT, 'art', 'mockups'); os.makedirs(MOCK, exist_ok=True)
T0 = time.time()
def tick(s): log('%-28s %5.1fs' % (s, time.time() - T0))

def sstep(a, lo=0.0, hi=1.0):
    t = np.clip((np.asarray(a, np.float64) - lo) / (hi - lo), 0.0, 1.0); return t * t * (3 - 2 * t)
def lerp(a, b, t): return a + (b - a) * t
def fbm2(x, y, scale, seed, octv=3):
    s = 0.0; a = 1.0; tot = 0.0
    for o in range(octv): s = s + a * K.vn2(x, y, scale / (2 ** o), seed + o * 7); tot += a; a *= 0.5
    return s / tot
def box_blur(a, k):
    """separable box blur, window 2k+1, edge-clamped"""
    out = a.astype(np.float64)
    for ax in (0, 1):
        p = np.concatenate([np.repeat(np.take(out, [0], ax), k, ax), out, np.repeat(np.take(out, [-1], ax), k, ax)], ax)
        c = np.cumsum(p, ax); c = np.concatenate([np.zeros_like(np.take(c, [0], ax)), c], ax)
        n = out.shape[ax]; out = (np.take(c, np.arange(2 * k + 1, 2 * k + 1 + n), ax) - np.take(c, np.arange(0, n), ax)) / (2 * k + 1)
    return out
def bil(G, x, y):
    fx = (np.asarray(x, np.float64) + HALF) / MG; fy = (np.asarray(y, np.float64) + HALF) / MG
    i = np.clip(np.floor(fx).astype(np.int64), 0, NG - 2); j = np.clip(np.floor(fy).astype(np.int64), 0, NG - 2); tx = np.clip(fx - i, 0, 1); ty = np.clip(fy - j, 0, 1)
    return G[i, j] * (1 - tx) * (1 - ty) + G[i + 1, j] * tx * (1 - ty) + G[i, j + 1] * (1 - tx) * ty + G[i + 1, j + 1] * tx * ty
def arc(th, a, b, e):
    """1 inside the angular range [a, b] degrees (0..360), smooth edges e wide"""
    return sstep(th, a - e, a + e) * sstep(-th, -(b + e), -(b - e))

# ---------------------------------------------------------------- the coast: a radius per angle (10 degree knots, Catmull-Rom)
KN = [1.00, 0.99, 1.03, 1.05, 1.06, 1.00, 0.95, 0.97, 1.02, 1.05, 0.99, 0.90, 0.86, 0.90, 0.97, 1.03, 1.02, 0.98,
      1.00, 0.99, 0.96, 0.72, 0.55, 0.78, 0.97, 1.02, 1.00, 0.99, 1.00, 1.02, 1.00, 1.03, 0.99, 0.94, 1.03, 1.01]
HEADS = [(38.0, 0.10, 4.5), (342.0, 0.06, 3.5), (326.0, -0.07, 3.0), (152.0, 0.05, 4.0), (92.0, 0.04, 3.0)]
def coast_R(th):
    u = (np.degrees(th) % 360.0) / 10.0; i = np.floor(u).astype(int); t = u - i; k = np.array(KN)
    p0, p1, p2, p3 = k[(i - 1) % 36], k[i % 36], k[(i + 1) % 36], k[(i + 2) % 36]
    f = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)
    a, b = 475.0, 350.0; Rl = a * b / np.sqrt((b * np.cos(th)) ** 2 + (a * np.sin(th)) ** 2)
    wob = 1 + 0.025 * np.sin(5 * th + 1.0) + 0.018 * np.sin(9 * th + 0.3) + 0.010 * np.sin(17 * th + 2.0) + 0.006 * np.sin(31 * th)
    for c, amp, w in HEADS: f = f + amp * np.exp(-((((np.degrees(th) - c + 180) % 360) - 180) / w) ** 2)
    return Rl * f * wob
def signed_distance():
    """metres to the coast line, positive on land (4 m grid by brute force against the coast polygon, then upsampled)"""
    th = np.radians(np.arange(0, 360, 0.12)); R = coast_R(th); P = np.stack([R * np.cos(th), R * np.sin(th)], 1)
    g = np.linspace(-HALF, HALF, NG // 2 + 1); GXs, GYs = np.meshgrid(g, g, indexing='ij'); Q = np.stack([GXs.ravel(), GYs.ravel()], 1); out = np.empty(len(Q))
    for s in range(0, len(Q), 3000):
        q = Q[s:s + 3000]; dd = (q[:, None, 0] - P[None, :, 0]) ** 2 + (q[:, None, 1] - P[None, :, 1]) ** 2; out[s:s + 3000] = np.sqrt(dd.min(1))
    ins = np.hypot(GXs, GYs).ravel() < coast_R(np.arctan2(GYs, GXs)).ravel(); out = np.where(ins, out, -out).reshape(GXs.shape)
    up = np.zeros((NG, NG)); up[::2, ::2] = out; up[1::2, ::2] = (out[:-1] + out[1:]) / 2; up[::2, 1::2] = (out[:, :-1] + out[:, 1:]) / 2
    up[1::2, 1::2] = (out[:-1, :-1] + out[1:, :-1] + out[:-1, 1:] + out[1:, 1:]) / 4; return up

# ---------------------------------------------------------------- places (x, y in Blender axes; game z = -y)
WB = (-330.0, 0.0); EB = (330.0, 0.0); PA = (-200.0, -40.0); PB = (0.0, 0.0); PC = (200.0, 40.0)
AIR = dict(c=(-10.0, -276.0), hw=150.0, hd=15.0, rot=0.0)            # the runway: 300 x 30 m
def _lh():
    th = math.radians(38.0); R = float(coast_R(np.array([th]))[0]) - 50.0; return (R * math.cos(th), R * math.sin(th))
LH = _lh()                                                          # the lighthouse: the north-east headland, 50 m in from the cliff edge
FARMS = [(-236.0, 176.0), (150.0, -190.0), (262.0, 170.0)]
FLAGW = (-286.0, 46.0); FLAGE = (286.0, -46.0)                            # the two flag places, 45 m in front of each base
# the ridge: a spine with a height and half width per node
SPINE = [(-30.0, -178.0, 10.1, 52.0), (-4.0, -140.0, 30.2, 66.0), (24.0, -100.0, 48.7, 72.0), (14.0, -70.0, 33.6, 64.0), (-6.0, -40.0, 15.1, 64.0),
         (0.0, 0.0, 5.0, 100.0), (6.0, 48.0, 16.8, 64.0), (22.0, 92.0, 38.6, 70.0), (46.0, 132.0, 52.0, 78.0), (52.0, 184.0, 42.0, 74.0), (34.0, 232.0, 11.8, 52.0)]
HILLS = [(-140.0, 150.0, 30.0, 70.0, 52.0, 0.5), (-105.0, -196.0, 24.0, 60.0, 46.0, -0.3), (-250.0, 235.0, 20.0, 62.0, 50.0, 0.3),
         (272.0, -178.0, 30.0, 70.0, 52.0, 0.6), (120.0, 205.0, 26.0, 60.0, 46.0, -0.4), (112.0, -34.0, 15.0, 40.0, 28.0, 0.2),
         (-135.0, 92.0, 13.0, 36.0, 28.0, -0.5), (-60.0, -95.0, 16.0, 38.0, 30.0, 0.7), (92.0, 112.0, 9.0, 34.0, 26.0, 0.1), (392.0, 118.0, 15.0, 40.0, 32.0, 0.2),
         (-300.0, -110.0, 17.0, 48.0, 36.0, -0.3), (-160.0, 40.0, 11.0, 32.0, 26.0, -0.2)]
ISLETS = [(-120.0, -432.0, 20.0, 18.0, 1), (345.0, -388.0, 17.0, 17.0, 2), (385.0, 342.0, 22.0, 19.0, 3), (-545.0, 118.0, 15.0, 16.0, 4)]
def sd_box(X, Y, c, hx, hy, rot=0.0):
    cs, sn = math.cos(rot), math.sin(rot); u = (X - c[0]) * cs + (Y - c[1]) * sn; v = -(X - c[0]) * sn + (Y - c[1]) * cs
    qx, qy = np.abs(u) - hx, np.abs(v) - hy; return np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0)
def sd_circ(X, Y, c, r): return np.hypot(X - c[0], Y - c[1]) - r

# ---------------------------------------------------------------- roads (polylines, Blender axes): three ways from the west base to the east base, joined by branches
ROADS_MAIN = {
    'north': [WB, (-322, 60), (-290, 130), (-232, 196), (-160, 238), (-80, 268), (-10, 282), (62, 288), (128, 272), (196, 232), (256, 170), (306, 96), (326, 40), EB],
    'centre': [WB, (-292, -10), (-246, -30), PA, (-150, -30), (-84, -12), PB, (74, 12), (140, 32), PC, (262, 28), (306, 12), EB],
    'south': [WB, (-322, -50), (-292, -86), (-246, -84), (-196, -86), (-150, -122), (-112, -170), (-60, -214), (10, -224), (86, -214), (150, -178), (214, -128), (276, -64), (318, -22), EB],
}
def find_shore(p, d):
    n = math.hypot(*d); d = (d[0] / n, d[1] / n); t = 0.0
    while t < 400:
        q = (p[0] + d[0] * t, p[1] + d[1] * t)
        if math.hypot(*q) > float(coast_R(np.array([math.atan2(q[1], q[0])]))[0]): return q
        t += 0.5
    return q
SHORE_A = find_shore(PA, (0.14, -1.0))
ROADS_TRACK = {
    'jet': [PA, (SHORE_A[0] - 0.14 * 9, SHORE_A[1] + 9)],
    'wA': [(-190, 233), (-200, 150), (-206, 70), PA],               # north road down to the village
    'wB': [(-150, -30), (-120, -90), (-112, -170)],                 # village road to the south road (east of the bay)
    'bN': [PB, (-46, 44), (-70, 110), (-70, 190), (-80, 268)],                  # pass to the north road, west of the ridge
    'cN': [PC, (212, 110), (216, 160), (196, 232)],                 # radar rise down to the north road
    'cS': [PC, (222, -20), (236, -90), (214, -128)],                # radar rise to the south road
    'air': [(10, -224), (10, -268)],                                # south road to the airstrip
    'lh': [(306, 96), (322, 180), LH],                              # north-east coast track up to the lighthouse
    'f1': [(-232, 196), FARMS[0]], 'f2': [(86, -214), FARMS[1]], 'f3': [(256, 170), FARMS[2]],
    'flagW': [(-318, 66), (-300, 56), FLAGW], 'flagE': [(280, -62), (290, -54), FLAGE],
}
def dense(poly, step=2.0):
    pts = []
    for (ax, ay), (bx, by) in zip(poly[:-1], poly[1:]):
        n = max(1, int(math.hypot(bx - ax, by - ay) / step))
        for k in range(n): pts.append((ax + (bx - ax) * k / n, ay + (by - ay) * k / n))
    pts.append(poly[-1]); return np.array(pts)
def smooth_poly(poly, k=3):
    """a Chaikin-smoothed copy of a polyline (the corners round off; the ends stay)"""
    p = [tuple(map(float, q)) for q in poly]
    for _ in range(k):
        n = [p[0]]
        for a, b in zip(p[:-1], p[1:]): n += [(0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]), (0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1])]
        n.append(p[-1]); p = n
    return p
ROUTES = {k: smooth_poly(v, 3) for k, v in ROADS_MAIN.items()}; TRACKS = {k: smooth_poly(v, 2) for k, v in ROADS_TRACK.items()}

# ---------------------------------------------------------------- summit tracks: graded switchback tracks from the road net up to a flat shelf on each main high point
# Each is planned (hybrid A*: arcs of radius >= PTURN, climb <= PGRADE on the smoothed ground, little cut and fill), then the ground is cut to the designed profile.
PATH_TOPS = [('summit', (72.0, 194.0)), ('knoll', (34.0, -78.0)), ('west-hill', (-132.0, 158.0))]     # Blender x, y of each high point (the ridge shoulder at (70, 118) found no clean climb that keeps off the summit track: left out)
PGRADE = math.tan(math.radians(11.5)); PTURN = 10.0; PHALF = 3.0; PSHELF = 8.0; PBLEND = 15.0
PATHS = []; ROADMASK = None; HM0 = None
def scalar_sampler(G):
    GL = G.tolist()
    def f(x, y):
        fx = (x + HALF) / MG; fy = (y + HALF) / MG; i = int(fx); j = int(fy)
        if fx < 0 or fy < 0 or i >= NG - 1 or j >= NG - 1: return None
        tx = fx - i; ty = fy - j; a = GL[i]; b = GL[i + 1]
        return a[j] * (1 - tx) * (1 - ty) + b[j] * tx * (1 - ty) + a[j + 1] * (1 - tx) * ty + b[j + 1] * tx * ty
    return f
def plan_path(top, GS, starts, avoid, RD, lim=(2.2, 6.0)):
    import heapq
    NB = 24; dth = 2 * math.pi / NB; g1 = scalar_sampler(GS); rdf = scalar_sampler(RD)
    sx, sy = top; ztop = g1(sx, sy)
    def blocked(x, y):
        if bil(DIST, x, y) < 22.0: return True
        for cx, cy, r in avoid:
            if (x - cx) ** 2 + (y - cy) ** 2 < r * r: return True
        return sd_box(x, y, AIR['c'], AIR['hw'] + 30, AIR['hd'] + 30, AIR['rot']) < 0
    def prims(x, y, b):
        th = b * dth; out = [(b, [(x + k * math.cos(th), y + k * math.sin(th)) for k in (2.0, 4.0, 6.0)], 1.0)]
        for kk in (1, 2):
            for sg in (1, -1):
                d = sg * kk * dth; cx = x - sg * PTURN * math.sin(th); cy = y + sg * PTURN * math.cos(th); pts = []
                n = max(1, int(PTURN * kk * dth / 2.0 + 0.5))
                for q in range(1, n + 1):
                    a = th + d * q / n; pts.append((cx + sg * PTURN * math.sin(a), cy - sg * PTURN * math.cos(a)))
                out.append(((b + sg * kk) % NB, pts, 1.15))
        return out
    pq = []; best = {}; cnt = 0; nodes = []
    def hfun(x, y, z): return max(math.hypot(x - sx, y - sy), (ztop - z) / PGRADE)
    for (x, y, z) in starts:
        for b in range(NB):
            key = (round(x / 2.0), round(y / 2.0), b)
            if key in best: continue
            nodes.append((x, y, b, z, None, [(x, y, z)], (x, y))); best[key] = 0.0
            cnt += 1; heapq.heappush(pq, (1.6 * hfun(x, y, z), cnt, 0.0, key, len(nodes) - 1))
    it = 0; goal = None
    while pq:
        f, _, g, key, nid = heapq.heappop(pq)
        if g > best.get(key, 1e18) + 1e-9: continue
        x, y, b, z, par, smp, org = nodes[nid]; it += 1
        if math.hypot(x - sx, y - sy) < 11.0 and z >= ztop - 3.5 and abs((b * dth - math.atan2(sy - y, sx - x) + math.pi) % (2 * math.pi) - math.pi) < 0.5: goal = nid; break
        if it > 300000: break
        for nb, pts, tw in prims(x, y, b):
            zc = z; px, py = x, y; cost = 0.0; ok_ = True; sm = []
            for (qx, qy) in pts:
                ds = math.hypot(qx - px, qy - py); gc = g1(qx, qy)
                if gc is None or blocked(qx, qy) or ((qx - org[0]) ** 2 + (qy - org[1]) ** 2 > 900.0 and rdf(qx, qy) < 9.0): ok_ = False; break
                zn = min(max(gc, zc), zc + PGRADE * ds)
                if abs(gc - zn) > lim[0]: ok_ = False; break
                hx, hy = qx - px, qy - py; hl = math.hypot(hx, hy) or 1.0; nx_, ny_ = -hy / hl, hx / hl
                gl = g1(qx + 5 * nx_, qy + 5 * ny_); gr = g1(qx - 5 * nx_, qy - 5 * ny_)
                if gl is None or gr is None: ok_ = False; break
                bank = max(abs(gl - zn), abs(gr - zn))
                if bank > lim[1]: ok_ = False; break
                cost += ds * (tw + 0.6 * max(0.0, bank - 1.0) + 0.9 * abs(gc - zn)); zc = zn; px, py = qx, qy; sm.append((qx, qy, zn))
            if not ok_: continue
            nk = (round(px / 2.0), round(py / 2.0), nb); ng = g + cost
            if ng < best.get(nk, 1e18) - 1e-9:
                best[nk] = ng; nodes.append((px, py, nb, zc, nid, sm, org)); cnt += 1; heapq.heappush(pq, (ng + 2.2 * hfun(px, py, zc), cnt, ng, nk, len(nodes) - 1))
    if goal is None: log('path planning FAILED for', top, 'after', it, 'steps'); return None
    chain = []; k = goal
    while k is not None: n = nodes[k]; chain.append(n[5]); k = n[4]
    pts = [p for seg in reversed(chain) for p in seg]
    log('planned path to', top, ': %d steps, %d points' % (it, len(pts)))
    return pts
def _seg_dist(xy, R, store_z=None):
    """distance to the polyline xy over the grid (nearest segment); with z values given, also the z of the nearest segment"""
    dist_arr = np.full((NG, NG), 1e9); store = np.zeros((NG, NG))
    zz = store_z if store_z is not None else np.zeros(len(xy))
    for (a, b), (za_, zb_) in zip(zip(xy[:-1], xy[1:]), zip(zz[:-1], zz[1:])):
        i0 = max(int((min(a[0], b[0]) - R + HALF) / MG), 0); i1 = min(int((max(a[0], b[0]) + R + HALF) / MG) + 2, NG); j0 = max(int((min(a[1], b[1]) - R + HALF) / MG), 0); j1 = min(int((max(a[1], b[1]) + R + HALF) / MG) + 2, NG)
        Xs, Ys = np.meshgrid(GX[i0:i1], GX[j0:j1], indexing='ij'); dx, dy = b[0] - a[0], b[1] - a[1]; t_ = np.clip(((Xs - a[0]) * dx + (Ys - a[1]) * dy) / max(dx * dx + dy * dy, 1e-9), 0, 1)
        dd = np.hypot(Xs - a[0] - t_ * dx, Ys - a[1] - t_ * dy); cur = dist_arr[i0:i1, j0:j1]; upd = dd < cur
        dist_arr[i0:i1, j0:j1] = np.where(upd, dd, cur); store[i0:i1, j0:j1] = np.where(upd, za_ + (zb_ - za_) * t_, store[i0:i1, j0:j1])
    return dist_arr, store
def plan_paths():
    """plan, then cut every summit track into HM; fills PATHS and lowers TRACKD along them"""
    global HM, TRACKD
    global HM0; HM0 = HM.copy(); GS = box_blur(HM, 2)
    avoid = [(WB[0], WB[1], 55.0), (EB[0], EB[1], 55.0), (PA[0], PA[1], 55.0), (PB[0], PB[1], 55.0), (PC[0], PC[1], 60.0), (LH[0], LH[1], 30.0), (FLAGW[0], FLAGW[1], 18.0), (FLAGE[0], FLAGE[1], 18.0)] + [(f[0], f[1], 40.0) for f in FARMS]
    roadpts = [p for k, v in list(ROUTES.items()) + [(k, v) for k, v in TRACKS.items() if k != 'jet'] for p in dense(v, 8.0)]
    for name, top in PATH_TOPS:
        bi = max(((float(bil(GS, top[0] + dx, top[1] + dy)), (top[0] + dx, top[1] + dy)) for dx in range(-12, 13, 3) for dy in range(-12, 13, 3)))
        S = bi[1]; gxh, gyh = np.gradient(GS, MG, MG); flatish = np.hypot(gxh, gyh) < math.tan(math.radians(8.0))
        starts = [(float(x), float(y), float(bil(HM, x, y))) for x, y in roadpts if math.hypot(x - S[0], y - S[1]) < 330 and bool(flatish[int((x + HALF) / MG), int((y + HALF) / MG)]) and not any((x - c) ** 2 + (y - d) ** 2 < r * r for c, d, r in avoid)]
        own = list(starts)
        for lim in ((2.2, 6.0), (3.2, 8.0)):
            if lim[0] > 3: starts = own + [(float(x), float(y), float(bil(HM, x, y))) for Q in PATHS for x, y in path_arc(Q['xy'], 8.0) if math.hypot(x - Q['top'][0], y - Q['top'][1]) > 60 and math.hypot(x - S[0], y - S[1]) > 60]
            pts = plan_path(S, GS, starts, avoid, np.minimum(ROADD, TRACKD), lim)
            if pts is not None: break
        if pts is None: continue
        P = np.array(pts); dP = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(P[:, :2], axis=0).T))])
        lead = float(np.hypot(S[0] - P[-1, 0], S[1] - P[-1, 1])); nl = max(1, int(lead / 2.0))
        tail = [(P[-1, 0] + (S[0] - P[-1, 0]) * q / nl, P[-1, 1] + (S[1] - P[-1, 1]) * q / nl) for q in range(1, nl + 1)]
        full = [tuple(q) for q in P[:, :2]] + tail; n0 = max(len(P) - 6, 0)
        full = full[:n0] + [tuple(q) for q in smooth_poly(full[n0:], 2)]               # round off the turn onto the shelf
        xy = path_arc(np.array(full), 2.0); dxy = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(xy, axis=0).T))])
        # the bed: height by arc length, averaged over about 16 m, never falling, never climbing faster than PGRADE
        zz = np.interp(dxy, dP, P[:, 2]); k = 4
        zp = np.concatenate([np.repeat(zz[:1], k), zz, np.repeat(zz[-1:], k)]); c_ = np.cumsum(np.concatenate([[0], zp])); zz = (c_[2 * k + 1:] - c_[:-2 * k - 1]) / (2 * k + 1); zz[0] = P[0, 2]
        zz = np.maximum.accumulate(zz)
        for q in range(1, len(zz)): zz[q] = min(zz[q], zz[q - 1] + PGRADE * (dxy[q] - dxy[q - 1]))
        ztop_ = float(zz[-1])
        X, Y = X2, Y2; dist_arr, store = _seg_dist(xy, PHALF + PBLEND + 2, zz)
        sh = sd_circ(X, Y, S, PSHELF); w = 1 - sstep(sh, 0, PBLEND + 2); HM = HM * (1 - w) + ztop_ * w          # the flat turning shelf, 16 m across
        w = (1 - sstep(dist_arr, PHALF, PHALF + PBLEND)) * sstep(ROADD, 3.6, 8.0)
        HM = HM * (1 - w) + store * w
        TRACKD = np.minimum(TRACKD, np.minimum(dist_arr, np.maximum(np.hypot(X - S[0], Y - S[1]) - 6.0, 0)))
        PATHS.append(dict(name=name, top=S, ztop=ztop_, xy=xy, zz=zz))
        log('path %s: top (%.0f, %.0f) z %.1f, %d designed points' % (name, S[0], S[1], ztop_, len(xy)))
def path_arc(xy, step):
    d = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(xy, axis=0).T))]); s = np.append(np.arange(0, d[-1], step), d[-1])
    return np.stack([np.interp(s, d, xy[:, 0]), np.interp(s, d, xy[:, 1])], 1)
def report_paths():
    ok = (HM > 1.2) & (SLM < math.tan(math.radians(25)))
    for P in PATHS:
        pts = path_arc(P['xy'], 6.0); z = bil(HM, pts[:, 0], pts[:, 1]); sl = np.abs(np.diff(z)) / np.hypot(*np.diff(pts, axis=0).T)
        pts_r = path_arc(P['xy'], 3.0); h = np.arctan2(*np.diff(pts_r, axis=0).T[::-1]); h = h[::2]; dh = np.abs((np.diff(h) + np.pi) % (2 * np.pi) - np.pi); rmin = float((6.0 / np.maximum(dh, 1e-6)).min())
        ln = float(np.hypot(*np.diff(P['xy'], axis=0).T).sum())
        m = (corridor(P['xy'], 4.5) | ROADMASK) & ok; fl = flood(m, (int((WB[0] + HALF) / MG), int((WB[1] + HALF) / MG))); e = P['top']
        conn = bool(fl[int((e[0] + HALF) / MG), int((e[1] + HALF) / MG)])
        dmin, _ = _seg_dist(P['xy'], 16.0); band = (dmin > 3.2) & (dmin < 12.0); bs = np.degrees(np.arctan(SLM[band])); g0x, g0y = np.gradient(HM0, MG, MG); bs0 = np.degrees(np.arctan(np.hypot(g0x, g0y)[band])); cut = float(np.abs(HM - HM0)[band].max())
        log('PATH %-9s len %4.0f m  max slope along %.1f deg (at %.0f,%.0f)  min turn radius %.0f m  top (%.0f, %.0f) z %.1f  bank slope p99 %.0f deg (before the cut %.0f)  deepest cut/fill beside the bed %.1f m  connected: %s' % (P['name'], ln, math.degrees(math.atan(sl.max())), pts[sl.argmax()][0], -pts[sl.argmax()][1], rmin, e[0], -e[1], P['ztop'], np.percentile(bs, 99), np.percentile(bs0, 99), cut, conn))
def write_paths():
    if os.environ.get('HG_DUMP'): np.savez(os.environ['HG_DUMP'], HM=HM, **{P['name'] + '_xy': P['xy'] for P in PATHS}, **{P['name'] + '_z': P['zz'] for P in PATHS})
    out = []
    for P in PATHS:
        pts = path_arc(P['xy'], 10.0)
        out.append({'name': P['name'], 'top': [round(P['top'][0], 1), round(float(bil(HM, *P['top'])), 2), round(-P['top'][1], 1)], 'pts': [[round(float(x), 1), round(float(-y), 1)] for x, y in pts]})
    with open(os.path.join(K.BASE, 'island_paths.json'), 'w') as f: json.dump({'paths': out}, f)

# ---------------------------------------------------------------- the ground
DIST = None; HM = None; SLM = None; ROADD = None; TRACKD = None
def build_ground():
    global DIST, HM, SLM, ROADD, TRACKD
    X, Y = X2, Y2
    DIST = signed_distance(); d = DIST; tick('distance')
    th = np.degrees(np.arctan2(Y, X)) % 360
    cliff = np.clip(arc(th, 18, 66, 10) + 0.55 * arc(th, 118, 138, 8), 0, 1); beach = arc(th, 248, 318, 10) * (1 - cliff)
    nA = fbm2(X, Y, 90, 5, 3); nB = fbm2(X, Y, 38, 6, 2)
    s = np.maximum(-d, 0.0)
    Ls = 85.0 * (1 + 0.7 * (nA - 0.5)) * (1 + 0.35 * beach) * (1 - 0.5 * cliff); t = np.clip(s / Ls, 0, 1)
    bed = -9.8 * (1 - (1 - t) ** 2) + 0.9 * (fbm2(X, Y, 70, 8, 2) - 0.5) * 2 * sstep(s, 25, 80) * 0.7 + 0.35 * (nB - 0.5) * sstep(s, 10, 60)
    L = np.maximum(d, 0.0)
    dune = 1.5 * beach * np.exp(-((L - 52) / 17) ** 2) * (0.5 + nB) + 0.9 * beach * np.exp(-((L - 86) / 20) ** 2) * nA
    hn = 3.4 * (1 - np.exp(-L / 14)); hb = 2.8 * (1 - np.exp(-L / 32)) + dune
    Hc = 14.0 + 9.0 * (nA - 0.5) * 2; hcl = Hc * sstep(L, 2, 27) * (1 - sstep(L, 34, 200))
    hc = (1 - cliff - beach) * hn + beach * hb + cliff * hcl
    Xw = X + 30 * (fbm2(X, Y, 120, 11, 2) - 0.5) * 2; Yw = Y + 30 * (fbm2(X, Y, 120, 13, 2) - 0.5) * 2
    base = 7.4 + (fbm2(X, Y, 130, 3, 3) - 0.5) * 17 + (fbm2(X, Y, 40, 4, 2) - 0.5) * 5.5
    hills = np.zeros_like(X)
    for cx, cy, H_, sx, sy, rot in HILLS:
        c_, s_ = math.cos(rot), math.sin(rot); u = (Xw - cx) * c_ + (Yw - cy) * s_; v = -(Xw - cx) * s_ + (Yw - cy) * c_; hills += H_ * np.exp(-((u / sx) ** 2 + (v / sy) ** 2))
    ridge = np.zeros_like(X)
    for a, b in zip(SPINE[:-1], SPINE[1:]):
        dx, dy = b[0] - a[0], b[1] - a[1]; t_ = np.clip(((Xw - a[0]) * dx + (Yw - a[1]) * dy) / (dx * dx + dy * dy), 0, 1)
        dist = np.hypot(Xw - (a[0] + t_ * dx), Yw - (a[1] + t_ * dy)); tt = t_ * t_ * (3 - 2 * t_)
        ridge = np.maximum(ridge, (a[2] + (b[2] - a[2]) * tt) * np.exp(-(dist / (a[3] + (b[3] - a[3]) * tt)) ** 2))
    ridge = ridge * (0.82 + 0.36 * fbm2(Xw, Yw, 55, 17, 3)); ridge = box_blur(ridge, 3)
    rid = 1 - np.abs(2 * fbm2(Xw, Yw, 48, 19, 3) - 1); ridge = ridge + 6.0 * (rid - 0.45) * sstep(ridge, 6, 28)          # gullies and spurs on the high ground
    hills = hills * (0.85 + 0.3 * fbm2(Xw, Yw, 42, 20, 2)) + 3.0 * (rid - 0.45) * sstep(hills, 5, 15)
    inl = base + hills + ridge
    det = (fbm2(X, Y, 36, 70, 2) - 0.5) * 2 * (0.8 + 6.5 * sstep(inl, 12, 45)) * sstep(L, 35, 90) + (fbm2(X, Y, 20, 72, 2) - 0.5) * 2 * 3.0 * sstep(inl, 18, 50) * sstep(L, 35, 90)          # rough ground: more on the high ground
    land = hc + (inl + det) * sstep(L, 25, 120)
    H = np.where(d > 0, land, bed)
    for cx, cy, r0, amp, sd in ISLETS:                         # rocky islets: cones standing on the sea bed
        rr = np.hypot(X - cx, Y - cy) / (r0 * (1 + 0.55 * (fbm2(X, Y, 22, 40 + sd, 2) - 0.5) * 2)); m = np.exp(-rr ** 2)
        H = H + (amp + 9.0) * m + (nB - 0.5) * 3.0 * m
    tick('base ground')
    def auto(sd, lo, hi): return float(np.clip(H[sd <= 0].mean(), lo, hi)) if (sd <= 0).any() else lo
    def flat(sd, blend, target): nonlocal H; w = 1 - sstep(sd, 0, blend); H = H * (1 - w) + target * w
    for c in (WB, EB):
        sd = sd_box(X, Y, c, 32, 32); flat(sd, 46, auto(sd, 5.5, 9.5))
    sd = sd_circ(X, Y, PA, 24); flat(sd, 40, auto(sd, 4.5, 8.0))
    sd = sd_circ(X, Y, PB, 26); flat(sd, 44, auto(sd, 6.0, 20.0))
    sd = sd_circ(X, Y, PC, 16); flat(sd, 110, max(auto(sd_circ(X, Y, PC, 60), 6, 14) + 13.0, 20.0))
    sd = sd_box(X, Y, AIR['c'], AIR['hw'], AIR['hd'], AIR['rot']); za = auto(sd, 5.0, 9.0); flat(sd, 30, za)
    sd = sd_box(X, Y, (AIR['c'][0] - 40, AIR['c'][1] + 38), 70, 22, 0); flat(sd, 24, za)       # hangar apron
    for f in (FLAGW, FLAGE):
        sd = sd_circ(X, Y, f, 7); flat(sd, 16, auto(sd, 5.0, 12.0))
    sd = sd_circ(X, Y, LH, 12); flat(sd, 32, auto(sd_circ(X, Y, LH, 40), 10.0, 22.0))
    for f in FARMS:
        sd = sd_circ(X, Y, f, 22); flat(sd, 30, auto(sd, 4.5, 14.0))
    global ZA; ZA = za
    HM = H; tick('places')
    # ---- roads: the ground is graded along them (heights along the centre line smoothed over about 60 m, blended in over 12 m)
    best = np.full((NG, NG), 1e9); bz = np.zeros((NG, NG)); tbest = np.full((NG, NG), 1e9)
    def grade(poly, width, store_z, dist_arr, win):
        pts = dense(poly, 2.0); z = bil(HM, pts[:, 0], pts[:, 1]); k = win
        for _ in range(2): zp = np.concatenate([np.repeat(z[:1], k), z, np.repeat(z[-1:], k)]); c = np.cumsum(np.concatenate([[0], zp])); z = (c[2 * k + 1:] - c[:-2 * k - 1]) / (2 * k + 1)
        for (a, b), (za_, zb_) in zip(zip(pts[:-1], pts[1:]), zip(z[:-1], z[1:])):
            R = width / 2 + 14; i0 = max(int((min(a[0], b[0]) - R + HALF) / MG), 0); i1 = min(int((max(a[0], b[0]) + R + HALF) / MG) + 2, NG); j0 = max(int((min(a[1], b[1]) - R + HALF) / MG), 0); j1 = min(int((max(a[1], b[1]) + R + HALF) / MG) + 2, NG)
            xs = GX[i0:i1]; ys = GX[j0:j1]; Xs, Ys = np.meshgrid(xs, ys, indexing='ij'); dx, dy = b[0] - a[0], b[1] - a[1]; t_ = np.clip(((Xs - a[0]) * dx + (Ys - a[1]) * dy) / (dx * dx + dy * dy), 0, 1)
            dd = np.hypot(Xs - a[0] - t_ * dx, Ys - a[1] - t_ * dy); zz = za_ + (zb_ - za_) * t_; cur = dist_arr[i0:i1, j0:j1]; upd = dd < cur
            dist_arr[i0:i1, j0:j1] = np.where(upd, dd, cur); store_z[i0:i1, j0:j1] = np.where(upd, zz, store_z[i0:i1, j0:j1])
    for poly in ROUTES.values(): grade(poly, 7, bz, best, 14)
    tz = np.zeros((NG, NG))
    for poly in TRACKS.values(): grade(poly, 4, tz, tbest, 9)
    ROADD = best; TRACKD = tbest
    Hn = HM.copy()
    pl = np.minimum.reduce([sd_box(X, Y, WB, 32, 32), sd_box(X, Y, EB, 32, 32), sd_circ(X, Y, PA, 24), sd_circ(X, Y, PB, 26), sd_circ(X, Y, PC, 16), sd_box(X, Y, AIR['c'], AIR['hw'], AIR['hd'], AIR['rot']), sd_circ(X, Y, LH, 12), sd_circ(X, Y, FLAGW, 7), sd_circ(X, Y, FLAGE, 7)])
    keep = sstep(pl, 1.0, 14.0)           # the plateaus of the bases and objectives stay as made: the grading fades out over their edges
    for dist_arr, zz, core, wid in ((tbest, tz, 2.2, 9.0), (best, bz, 3.6, 12.0)):
        w = (1 - sstep(dist_arr, core, core + wid)) * keep; Hn = Hn * (1 - w) + zz * w
    HM = Hn
    tick('roads')
    global ROADMASK; ROADMASK = (ROADD < 3.6) | (TRACKD < 3.0); plan_paths(); tick('summit tracks')
    gx_, gy_ = np.gradient(HM, MG, MG); SLM = np.hypot(gx_, gy_)
    land_ok = (DIST > 8)
    k_ = int(np.argmax(np.where(DIST > 0, HM, -99))); log('highest point: %.1f m at game x %.0f, z %.0f' % (HM.flat[k_], X2.flat[k_], -Y2.flat[k_]))
    log('ground: h %.1f..%.1f m; land %.0f%%; max slope on land %.0f deg; share over 25 deg %.1f%%' % (HM.min(), HM.max(), 100 * land_ok.mean(), math.degrees(math.atan(SLM[land_ok].max())), 100 * (SLM[land_ok] > math.tan(math.radians(25))).mean()))
def height(x, y): return bil(HM, x, y)
K.height = height
def gz(x, y): return float(bil(HM, x, y))
K.gz = gz
import ss_mapkit; ss_mapkit.gz = gz

def write_png(arr, path):
    """arr: (rows, cols, 3) floats 0..1, row 0 = top"""
    h, w = arr.shape[:2]; im = bpy.data.images.new('png_tmp', w, h, alpha=False)
    a = np.concatenate([np.clip(arr[::-1], 0, 1), np.ones((h, w, 1))], 2).astype(np.float32); im.pixels.foreach_set(a.ravel())
    im.filepath_raw = path; im.file_format = 'PNG'; im.save(); bpy.data.images.remove(im)
def map_png():
    z = HM; gx_, gy_ = np.gradient(z, MG, MG); sh = np.clip(0.5 + 0.9 * (-gx_ * 0.6 + gy_ * 0.8) * 1.2, 0.15, 1.2)
    col = np.zeros((NG, NG, 3)); land = DIST > 0
    h01 = np.clip(z / 70.0, 0, 1)[..., None]
    col[:] = np.array((0.12, 0.30, 0.42)) * (0.5 + 0.5 * np.clip(1 + z / 10, 0, 1))[..., None]
    lc = np.array((0.25, 0.42, 0.18)) * (1 - h01) + np.array((0.62, 0.55, 0.40)) * h01
    col = np.where(land[..., None], lc, col); col *= sh[..., None] * 0.9 + 0.1
    col = np.where((ROADD < 3.5)[..., None], np.array((0.9, 0.8, 0.5)), col); col = np.where((TRACKD < 2.0)[..., None], np.array((0.85, 0.6, 0.4)), col)
    col = np.where(((z < 0.9) & land)[..., None], np.array((0.9, 0.2, 0.9)), col)
    steep = (SLM > math.tan(math.radians(25))) & land; col = np.where(steep[..., None], col * np.array((1.0, 0.6, 0.6)), col)
    def dot(p, c=(1, 0, 0), r=5):
        i, j = int((p[0] + HALF) / MG), int((p[1] + HALF) / MG); col[max(i - r, 0):i + r, max(j - r, 0):j + r] = c
    for p in (WB, EB, PA, PB, PC, LH, AIR['c'], (AIR['c'][0] - 150, AIR['c'][1]), (AIR['c'][0] + 150, AIR['c'][1])) + tuple(FARMS): dot(p)
    for p in (FLAGW, FLAGE): dot(p, (0, 0, 1), 3)
    img = np.transpose(col, (1, 0, 2))[::-1]; img = np.repeat(np.repeat(img, 2, 0), 2, 1)
    write_png(img, os.path.join(MOCK, 'ss-island-map.png')); log('map written')

def flood(mask, seed):
    r = np.zeros_like(mask); i, j = seed; r[i, j] = mask[i, j]
    while True:
        n = r.copy(); n[1:] |= r[:-1]; n[:-1] |= r[1:]; n[:, 1:] |= r[:, :-1]; n[:, :-1] |= r[:, 1:]; n &= mask
        if (n == r).all(): return r
        r = n
def corridor(poly, rad):
    m = np.zeros((NG, NG), bool); R = int(rad / MG); ii, jj = np.mgrid[-R:R + 1, -R:R + 1]; disk = ii * ii + jj * jj <= R * R
    for x, y in dense(poly, 4.0):
        i, j = int((x + HALF) / MG), int((y + HALF) / MG); m[i - R:i + R + 1, j - R:j + R + 1] |= disk
    return m
def report():
    ok = (HM > 1.2) & (SLM < math.tan(math.radians(25)))
    for name, poly in list(ROUTES.items()) + [(k, v) for k, v in TRACKS.items() if k in ('wA', 'wB', 'bN', 'cN', 'cS', 'air', 'lh')]:
        pts = dense(poly, 6.0); z = bil(HM, pts[:, 0], pts[:, 1]); sl = np.abs(np.diff(z)) / 6.0; cs = bil(SLM, pts[:, 0], pts[:, 1])
        c = corridor(poly, 14.0) & ok; a, b = poly[0], poly[-1]; seed = (int((a[0] + HALF) / MG), int((a[1] + HALF) / MG)); fl = flood(c, seed)
        log('route %-7s len %4.0f m  road slope max %.0f deg  ground slope under road max %.0f deg  connected end-to-end: %s  min z %.1f  worst at (%.0f,%.0f)/(%.0f,%.0f)' % (name, 6 * len(pts), math.degrees(math.atan(sl.max())), math.degrees(math.atan(cs.max())), bool(fl[int((b[0] + HALF) / MG), int((b[1] + HALF) / MG)]), z.min(), pts[sl.argmax()][0], pts[sl.argmax()][1], pts[cs.argmax()][0], pts[cs.argmax()][1]))
    report_paths(); write_paths()
    for nm, p in (('WB', WB), ('EB', EB), ('A', PA), ('B', PB), ('C', PC), ('LH', LH), ('airL', (AIR['c'][0] - 150, AIR['c'][1])), ('airR', (AIR['c'][0] + 150, AIR['c'][1])), ('flagW', FLAGW), ('flagE', FLAGE)): log('place', nm, 'z %.1f  slope %.0f deg  coast dist %.0f' % (gz(*p), math.degrees(math.atan(float(bil(SLM, *p)))), float(bil(DIST, *p))))

# ---------------------------------------------------------------- fields shared by the ground colour and the props: woods, farm fields, keep-out places
FM = None
KEEP = []          # circles (x, y, r) where nothing is scattered (places are built by hand)
def in_keep(x, y, extra=0.0):
    for kx, ky, kr in KEEP:
        if math.hypot(x - kx, y - ky) < kr + extra: return True
    sd = sd_box(x, y, AIR['c'], AIR['hw'] + 24, AIR['hd'] + 8, AIR['rot'])
    if sd < extra: return True
    return bool(sd_box(x, y, (AIR['c'][0] - 40, AIR['c'][1] + 38), 76, 28, 0) < extra)
def build_fields():
    global FM, KEEP
    KEEP = [(WB[0], WB[1], 50.0), (EB[0], EB[1], 50.0), (PA[0], PA[1], 58.0), (PB[0], PB[1], 62.0), (PC[0], PC[1], 46.0), (LH[0], LH[1], 30.0), (FLAGW[0], FLAGW[1], 16.0), (FLAGE[0], FLAGE[1], 16.0)] + [(f[0], f[1], 38.0) for f in FARMS]
    X, Y = X2, Y2; L = np.maximum(DIST, 0)
    th = np.degrees(np.arctan2(Y, X)) % 360; beach = arc(th, 248, 318, 10)
    n = fbm2(X, Y, 85, 31, 3) + 0.10 * (fbm2(X, Y, 22, 33, 2) - 0.5)
    fm = sstep(n, 0.52, 0.60)
    for cx, cy, r in ((-110, -60, 48), (-60, 160, 52), (70, 40, 38), (190, -110, 46), (-250, 90, 40), (-262, -78, 46), (-258, 70, 42), (140, 150, 40), (-90, -230, 36), (250, 220, 34)):   # a wood where the lines of sight need breaking
        fm = np.maximum(fm, 0.9 * (1 - sstep(np.hypot(X - cx, Y - cy), r * 0.55, r)) * sstep(fbm2(X, Y, 30, 35, 2), 0.38, 0.5))
    fm = fm * (1 - 0.55 * np.exp(-(((X - 300) / 90) ** 2 + (Y / 110) ** 2))) * sstep(L, 22, 40) * (1 - beach) * (1 - sstep(SLM, 0.45, 0.75)) * (1 - sstep(HM, 42, 58)) * sstep(ROADD, 8, 12) * sstep(TRACKD, 5, 8)
    for kx, ky, kr in KEEP: fm = fm * sstep(np.hypot(X - kx, Y - ky), kr, kr + 14)
    fm = fm * sstep(sd_box(X, Y, AIR['c'], AIR['hw'] + 24, AIR['hd'] + 8, AIR['rot']), 0, 20) * sstep(sd_box(X, Y, (AIR['c'][0] - 40, AIR['c'][1] + 38), 76, 28, 0), 0, 20)
    FM = fm; log('woods: %.1f%% of the land (%.0f m2)' % (100 * (fm > 0.5)[DIST > 0].mean(), (fm > 0.5).sum() * MG * MG))
FPHI = 0.38; FU, FV = 80.0, 54.0
def hash01(a, b, seed):
    r = np.sin(np.asarray(a, np.float64) * 127.1 + np.asarray(b, np.float64) * 311.7 + seed * 74.7) * 43758.5453; return r - np.floor(r)
def fcell(x, y):
    c, s = math.cos(FPHI), math.sin(FPHI); u = (np.asarray(x) * c + np.asarray(y) * s) / FU; v = (-np.asarray(x) * s + np.asarray(y) * c) / FV
    iu, iv = np.floor(u), np.floor(v); return iu, iv, u - iu, v - iv
def field_zone(x, y):
    z = np.zeros(np.shape(x))
    for fx, fy in FARMS: z = np.maximum(z, 1 - sstep(np.hypot(np.asarray(x) - fx, np.asarray(y) - fy), 70, 165))
    return z
def field_active(x, y, iu, iv):
    h2 = hash01(iu, iv, 2); zw = field_zone(x, y)
    return (h2 < zw * 1.1) & (bil(HM, x, y) > 3.0) & (bil(HM, x, y) < 20.0) & (bil(SLM, x, y) < 0.16) & (bil(DIST, x, y) > 38) & (bil(FM, x, y) < 0.3)

# ---------------------------------------------------------------- ground colour (display-like values; K.lin makes them linear for the bake)
def L3(a, b, t): return a + (b - a) * np.asarray(t, np.float32)[..., None]
def C3(r, g, b): return np.array((r, g, b), np.float32)
def colour_field(x, y):
    x = np.asarray(x, np.float32); y = np.asarray(y, np.float32)
    z = bil(HM, x, y).astype(np.float32); sl = bil(SLM, x, y).astype(np.float32); d = bil(DIST, x, y).astype(np.float32)
    th = np.degrees(np.arctan2(y, x)) % 360; beach = arc(th, 248, 318, 10).astype(np.float32); cliff = np.clip(arc(th, 18, 66, 10) + 0.55 * arc(th, 118, 138, 8), 0, 1).astype(np.float32)
    n1 = fbm2(x, y, 60, 21, 3); n2 = fbm2(x, y, 13, 22, 2); n3 = K.vn2(x, y, 2.6, 23); n4 = fbm2(x, y, 170, 24, 2); n5 = fbm2(x, y, 34, 25, 2)
    # grass: lush and mid green, dry yellow patches (more on the high ground), darker hollows, fine mottling
    g = L3(C3(.17, .29, .07), C3(.28, .37, .12), sstep(n1, .35, .65))
    dry = sstep(n4 + 0.20 * (n5 - .5) + 0.003 * z, .50, .62)
    g = L3(g, C3(.43, .39, .20) * (0.9 + 0.2 * n3)[..., None], dry * .85)
    g = g * ((.80 + .40 * n2) * (.92 + .16 * n3))[..., None]
    g = L3(g, g * .62, sstep(.42 - n5, 0, .12) * .7)
    g = L3(g, C3(.32, .28, .17), sstep(z, 30, 60) * .55 * sstep(n1, .3, .7))
    land = g
    # forest floor
    fm = bil(FM, x, y).astype(np.float32)
    land = L3(land, L3(C3(.10, .16, .06), C3(.21, .16, .09), sstep(n3, .35, .75)) * (.8 + .4 * n2)[..., None], np.clip(fm * 1.4, 0, 1) * .88)
    # fields
    iu, iv, fu, fv = fcell(x, y); act = field_active(x, y, iu, iv); kind = hash01(iu, iv, 1)
    c_, s_ = math.cos(FPHI), math.sin(FPHI); vm = -x * s_ + y * c_
    rows = (0.90 + 0.10 * np.sin(vm * (2 * math.pi / 3.3))).astype(np.float32)
    wheat = C3(.52, .45, .20) * rows[..., None]; plough = C3(.34, .24, .16) * (0.82 + 0.18 * np.sin(vm * (2 * math.pi / 3.3)))[..., None]; green = C3(.22, .36, .10) * rows[..., None]
    fld = np.where((kind < .30)[..., None], wheat, np.where((kind < .50)[..., None], plough, np.where((kind < .78)[..., None], green, C3(.30, .40, .14))))
    fld = fld * (0.88 + 0.24 * n2)[..., None]
    edge = np.minimum(np.minimum(fu, 1 - fu) * FU, np.minimum(fv, 1 - fv) * FV)
    land = L3(land, fld, np.where(act, 1.0, 0.0) * sstep(edge, .8, 2.4))
    land = L3(land, land * C3(.55, .70, .45), np.where(act, 1.0, 0.0) * (1 - sstep(edge, .5, 2.2)))   # hedgerow lines between fields
    # rock on steep ground (strata)
    rw = sstep(sl + 0.12 * (n2 - .5), .50, .90)
    strata = (0.96 + 0.08 * n3)
    rock = C3(.40, .37, .32) * ((.70 + .60 * n2) * strata)[..., None]
    rock = L3(rock, C3(.46, .38, .28) * (.8 + .4 * n3)[..., None], sstep(n5, .55, .8) * .5)
    land = L3(land, rock, rw)
    # sand: a narrow strip on ordinary coasts, a wide one on the long beach, shingle on the cliffs
    Ws = (5.0 + 4.0 * n5) * (1 - beach) + (36.0 + 12.0 * n4) * beach
    sw = (1 - sstep(d, Ws * .75, Ws * 1.25)) * (1 - 0.35 * sstep(n2, .62, .85) * sstep(d, 6, 14)) * (1 - 0.85 * cliff)
    sand = C3(.70, .63, .46) * (0.92 + 0.16 * n3)[..., None]; sand = L3(sand, sand * C3(.93, .93, .90), sstep(d, 10, 40) * beach * .5)
    land = L3(land, sand, sw * (1 - rw * .8))
    land = L3(land, C3(.40, .38, .34) * (.7 + .5 * n2)[..., None], cliff * (1 - sstep(d, 3, 9)) * .6 * (1 - rw))           # cliff foot: stones
    # sea bed
    dep = np.clip(-z / 9.0, 0, 1) ** 0.8
    bed = L3(C3(.68, .62, .46), C3(.46, .44, .34), sstep(dep, 0.0, .45)); bed = L3(bed, C3(.19, .22, .20), sstep(dep, .35, 1.0))
    bed = bed * (0.88 + 0.24 * n3)[..., None]
    kelp = sstep(n5 + .35 * (n1 - .5), .56, .68) * sstep(-z, 1.2, 3.5) * (1 - sstep(-z, 4.5, 7.5))
    bed = L3(bed, C3(.12, .17, .09) * (.8 + .4 * n2)[..., None], kelp * .75)
    bed = L3(bed, rock * .75, rw)
    col = L3(bed, land, sstep(d, -1.0, 0.6))
    wet = 1 - sstep(np.abs(z - 0.1), 0.0, 0.9)                    # the waterline band: wet, darker sand
    col = col * (1 - 0.40 * wet)[..., None]
    # roads: dust core, packed shoulders, a lusher verge
    rd = bil(ROADD, x, y).astype(np.float32); td = bil(TRACKD, x, y).astype(np.float32)
    ver = np.clip((1 - sstep(rd, 4.6, 9.0)) * .6 + (1 - sstep(td, 2.8, 6.0)) * .45, 0, 1) * (1 - sw) * (1 - rw)
    col = L3(col, col * C3(.88, 1.06, .85), ver)
    rcol = C3(.47, .41, .30) * (.88 + .24 * n2)[..., None]; rcol2 = C3(.36, .31, .23) * (.88 + .24 * n3)[..., None]
    col = L3(col, rcol2, (1 - sstep(rd, 3.2, 4.4)) * .95); col = L3(col, rcol, (1 - sstep(rd, 1.7, 3.0)) * .85)
    col = L3(col, rcol2 * .95, (1 - sstep(td, 1.6, 2.5)) * .9); col = L3(col, rcol * .95, (1 - sstep(td, .6, 1.4)) * .7)
    # bases: gravel aprons with a scuffed ring; the objectives' yards; the runway
    gravel = C3(.47, .44, .37) * (.82 + .36 * n2)[..., None]
    for c in (WB, EB):
        sd = (sd_box(x, y, c, 32, 32) + (n2 - .5) * 6.0).astype(np.float32); col = L3(col, col * C3(.85, .8, .7) * (.9 + .2 * n3)[..., None], (1 - sstep(sd, 2, 30)) * .55); col = L3(col, gravel, 1 - sstep(sd, -1.2, 1.2))
    yard = C3(.40, .35, .26) * (.85 + .3 * n2)[..., None]
    col = L3(col, yard, (1 - sstep(sd_circ(x, y, PA, 36), 0, 22)) * sstep(n2, .25, .5) * .8)
    paved = C3(.31, .30, .28) * (.8 + .4 * n3)[..., None]
    col = L3(col, L3(yard, paved, .6), (1 - sstep(sd_circ(x, y, PB, 52), 0, 26)) * sstep(n2, .3, .55) * .8); col = L3(col, paved, 1 - sstep(sd_circ(x, y, PB, 13), -1, 1.5))
    col = L3(col, gravel * .95, 1 - sstep(sd_circ(x, y, PC, 28), -1, 2))
    col = L3(col, gravel, 1 - sstep(sd_circ(x, y, LH, 15), -1, 2))
    for fx, fy in FARMS: col = L3(col, yard, (1 - sstep(sd_circ(x, y, (fx, fy), 26), -2, 3)))
    sd = sd_box(x, y, AIR['c'], AIR['hw'], AIR['hd'], AIR['rot']).astype(np.float32)
    tar = C3(.16, .16, .17) * (.88 + .24 * n2)[..., None] * (.92 + .16 * n3)[..., None]
    col = L3(col, L3(col, yard, .4) * .9, (1 - sstep(sd, 2, 14)) * .8)
    col = L3(col, tar, 1 - sstep(sd, -0.8, 0.8))
    u = x - AIR['c'][0]; v = y - AIR['c'][1]; inside = (sd < -0.9)
    mark = (np.abs(v) < 0.35) & (np.mod(u + 150, 24) < 12) & (np.abs(u) < AIR['hw'] - 16)
    mark |= (np.abs(np.abs(v) - 13.4) < 0.3) & (np.abs(u) < AIR['hw'] - 2)
    mark |= (np.abs(np.abs(u) - (AIR['hw'] - 3)) < 0.6) & (np.abs(v) < 13)
    mark |= (np.abs(u) > AIR['hw'] - 15) & (np.abs(u) < AIR['hw'] - 5) & (np.abs(v) < 12) & (np.mod(np.floor((v + 15) / 2.0), 2) == 0)
    col = L3(col, C3(.78, .78, .74), np.where(mark & inside, .9, 0.0))
    sda = sd_box(x, y, (AIR['c'][0] - 40, AIR['c'][1] + 38), 70, 22, 0).astype(np.float32)
    col = L3(col, C3(.44, .43, .40) * (.9 + .2 * n2)[..., None], 1 - sstep(sda, -0.8, 0.8))
    sdt = sd_box(x, y, (AIR['c'][0] - 22, AIR['c'][1] + 20), 6, 8, 0).astype(np.float32); col = L3(col, tar, 1 - sstep(sdt, -0.8, 0.8))     # taxiway
    return np.clip(col, 0.02, 0.92)
def macro_picture(N):
    xs = ((np.arange(N) + 0.5) / N * 2 * HALF - HALF).astype(np.float32); out = np.zeros((N, N, 3), np.float32); t0 = time.time()
    for r0 in range(0, N, 256):
        Xs, Ys = np.meshgrid(xs, xs[r0:r0 + 256], indexing='xy'); out[r0:r0 + 256] = K.lin(colour_field(Xs, Ys))
    img = bpy.data.images.new('island_macro', N, N, alpha=False, float_buffer=True)
    img.pixels.foreach_set(np.concatenate([out, np.ones((N, N, 1), np.float32)], 2).ravel()); log('macro picture', N, '%.0fs' % (time.time() - t0), 'mean', out.reshape(-1, 3).mean(0)); return img
K.macro_picture = macro_picture

def color_map_png():
    xs = GX[::2]; Xs, Ys = np.meshgrid(xs, xs, indexing='ij'); c = colour_field(Xs, Ys)
    img = np.transpose(c, (1, 0, 2))[::-1]; write_png(np.repeat(np.repeat(img, 3, 0), 3, 1), os.path.join(MOCK, 'ss-island-colour.png'))

# ---------------------------------------------------------------- props: registry (what stands where), terrain tests
REG = {}
def reg_add(x, y, r): REG.setdefault((int(x // 16), int(y // 16)), []).append((x, y, r))
def reg_free(x, y, r, margin=0.0):
    R = r + margin + 28
    for ci in range(int((x - R) // 16), int((x + R) // 16) + 1):
        for cj in range(int((y - R) // 16), int((y + R) // 16) + 1):
            for ox, oy, orr in REG.get((ci, cj), ()):
                if (x - ox) ** 2 + (y - oy) ** 2 < (r + orr + margin) ** 2: return False
    return True
def terr_ok(x, y, maxsl=0.35, mind=18.0, minz=2.4, road=9.0, track=6.0, maxz=999.0):
    if bil(DIST, x, y) < mind or bil(SLM, x, y) > maxsl or bil(ROADD, x, y) < road or bil(TRACKD, x, y) < track: return False
    z = gz(x, y); return minz <= z <= maxz
def at_fn(x, y, rz):
    c, s = math.cos(rz), math.sin(rz); return lambda lx, ly: (x + c * lx - s * ly, y + s * lx + c * ly)
def zmin(x, y, w, d, rz=0.0):
    at = at_fn(x, y, rz); return min(gz(*at(a * w / 2, b * d / 2)) for a in (-1, 0, 1) for b in (-1, 0, 1))
def ntri(): return sum(len(f.verts) - 2 for f in K.bm.faces)
def mark(label, t0=[0]):
    n = ntri(); log('props %-22s +%6d tris (total %d)' % (label, n - t0[0], n)); t0[0] = n

# ---------------------------------------------------------------- builders
def house(x, y, rz, w=8.0, d=5.5, h=3.0, wall='plaster', roof='tile', door=True, win=True, z=None):
    z = zmin(x, y, w, d, rz) if z is None else z; at = at_fn(x, y, rz)
    box((x, y, z), (w, d, h), wall, rz)
    prism_xz([(-d / 2 - 0.35, 0.0), (d / 2 + 0.35, 0.0), (0.0, 1.1 + d * 0.15)], -w / 2 - 0.3, w / 2 + 0.3, roof, T(x, y, z + h) @ rRz(rz - math.pi / 2))
    if win:
        for sgn in (-1, 1):
            for lx in (-w * 0.27, w * 0.27): box((*at(lx, sgn * (d / 2 + 0.03)), z + 1.1), (1.0, 0.1, 1.1), 'glass', rz, sink=0.0)
    if door: box((*at(0.0, d / 2 + 0.04), z), (1.1, 0.12, 2.1), 'wood', rz, sink=0.0)
    return math.hypot(w, d) / 2 + 0.6
def barn(x, y, rz, w=16.0, d=9.0, h=4.6, z=None):
    z = zmin(x, y, w, d, rz) if z is None else z; at = at_fn(x, y, rz)
    box((x, y, z), (w, d, h), 'wood', rz)
    prism_xz([(-d / 2 - 0.4, 0.0), (d / 2 + 0.4, 0.0), (0.0, 2.7)], -w / 2 - 0.4, w / 2 + 0.4, 'metal', T(x, y, z + h) @ rRz(rz - math.pi / 2))
    box((*at(0.0, d / 2 + 0.04), z), (4.2, 0.14, 3.6), 'rust', rz, sink=0.0)
    return math.hypot(w, d) / 2 + 0.8
def hangar(x, y, rz, w=24.0, ln=22.0, h=8.5, z=None):
    z = gz(x, y) if z is None else z; at = at_fn(x, y, rz)
    pts = [(math.cos(a) * w / 2, 1.4 + math.sin(a) * (h - 1.4)) for a in np.linspace(math.pi, 0, 9)]
    prism_xz([(-w / 2, 0.0)] + pts + [(w / 2, 0.0)], -ln / 2, ln / 2, 'metal', T(x, y, z - 0.05) @ rRz(rz - math.pi / 2))
    for e in (-1, 1): box((*at(0.0, e * (ln / 2 + 0.05)), z), (w * 0.72, 0.16, 5.2), 'rust', rz, sink=0.0)
    return math.hypot(w, ln) / 2 + 1
def control_tower(x, y, rz):
    z = gz(x, y); at = at_fn(x, y, rz)
    box((x, y, z), (5.0, 5.0, 8.5), 'concrete', rz); box((x, y, z + 8.5), (7.2, 7.2, 2.6), 'glass', rz, sink=0.0); box((x, y, z + 11.1), (8.4, 8.4, 0.4), 'concrete', rz, sink=0.0)
    beam((x, y, z + 11.4), (x, y, z + 16.0), 0.18, 'metal'); box((*at(0, 2.55), z), (1.2, 0.1, 2.0), 'wood', rz, sink=0.0)
    return 7.0
def watchtower(x, y, rz):
    z = gz(x, y); at = at_fn(x, y, rz)
    for a in (-1, 1):
        for b in (-1, 1): beam((*at(a * 1.5, b * 1.5), z - 0.2), (*at(a * 1.15, b * 1.15), z + 6.6), 0.22, 'wood')
    box((x, y, z + 6.5), (3.4, 3.4, 0.25), 'wood', rz, sink=0.0); box((x, y, z + 6.75), (2.9, 2.9, 1.7), 'wood', rz, sink=0.0)
    box((x, y, z + 8.45), (3.9, 3.9, 0.22), 'metal', rz, sink=0.0); box((*at(0, 1.46), z + 7.4), (1.8, 0.08, 0.6), 'glass', rz, sink=0.0)
    return 3.0
def revetment(x, y, rz, w=7.0, d=5.0):
    """a U of sandbags open towards +x (local): a tank's pen"""
    at = at_fn(x, y, rz); K.sandbags(*at(-d / 2, -w / 2), *at(-d / 2, w / 2))
    K.sandbags(*at(-d / 2, -w / 2), *at(d / 2, -w / 2)); K.sandbags(*at(-d / 2, w / 2), *at(d / 2, w / 2))
    return math.hypot(w, d) / 2 + 0.8
def drums(x, y, n=5, rng=random):
    for k in range(n):
        px, py = x + rng.uniform(-1.4, 1.4), y + rng.uniform(-1.4, 1.4); cyl((px, py, gz(px, py) - 0.1), 0.34, 1.0, rng.choice(('rust', 'rust', 'green', 'blue')), 7)
def flag_post(x, y, col):
    z = gz(x, y); box((x, y, z), (4.0, 4.0, 0.35), 'concrete', 0.0); cyl((x, y, z), 0.13, 9.5, 'metal', 6)
    box((x + 1.25, y, z + 7.6), (2.4, 0.06, 1.5), col, 0.0, sink=0.0)
def fuel_tank(x, y, r=5.2, h=6.0, mat='plaster'):
    z = min(gz(x + dx * r, y + dy * r) for dx in (-1, 0, 1) for dy in (-1, 0, 1)); cyl((x, y, z - 0.3), r, h + 0.3, mat, 12)
    cyl((x, y, z + h), r, 0.3, 'metal', 12, r * 0.55); beam((x + r * 0.6, y, z), (x + r * 0.6, y, z + h + 0.2), 0.14, 'metal'); return r + 0.8
def radar_site(x, y, rz):
    z = gz(x, y); box((x, y, z), (8.0, 8.0, 4.6), 'concrete', rz); cyl((x, y, z + 4.5), 0.55, 11.0, 'metal', 8)
    cyl((0, 0, 0), 0.5, 1.3, 'metal', 14, 5.0, M=T(x, y, z + 16.2) @ rRz(rz) @ rRx(-0.9))
    for k in range(3): box((x + (k - 1) * 2.5, y - 4.04, z + 1.4), (1.2, 0.1, 1.0), 'glass', 0.0, sink=0.0)
    return 8.0
def lighthouse(x, y):
    z = gz(x, y)
    cyl((x, y, z - 0.5), 3.6, 7.5, 'plaster', 14, 3.2); cyl((x, y, z + 7.0), 3.2, 7.0, 'red', 14, 2.8); cyl((x, y, z + 14.0), 2.8, 7.0, 'plaster', 14, 2.4)
    cyl((x, y, z + 21.0), 3.3, 0.5, 'metal', 14); cyl((x, y, z + 21.5), 1.8, 2.6, 'glass', 12); cyl((x, y, z + 24.1), 2.3, 1.7, 'red', 12, 0.25)
    for a in range(12): ang = a * math.pi / 6; box((x + math.cos(ang) * 3.2, y + math.sin(ang) * 3.2, z + 21.5), (0.12, 0.12, 1.0), 'metal', ang, sink=0.0)
    house(x + 11.0, y - 2.0, 0.3, 9.0, 6.0, 3.3, 'plaster', 'tile'); return 14.0
def boat(x, y, rz, col='plaster', zw=0.0):
    M = T(x, y, zw) @ rRz(rz); at = at_fn(x, y, rz)
    prism_xz([(-3.9, 0.9), (2.8, 0.9), (4.2, 1.7), (2.6, -0.3), (-3.6, -0.3)], -1.1, 1.1, col, M)
    box((*at(-1.0, 0), zw + 0.9), (2.4, 1.8, 1.5), 'plaster', rz, sink=0.0); box((*at(-1.0, 0), zw + 2.3), (2.7, 2.1, 0.12), 'metal', rz, sink=0.0)
    beam((*at(1.2, 0), zw + 0.9, ), (*at(1.2, 0), zw + 5.0), 0.1, 'wood')
def jetty(x0, y0, ang, length, width=3.6, zd=1.5):
    dx, dy = math.cos(ang), math.sin(ang); n = int(length / 6)
    for k in range(n):
        px, py = x0 + dx * (k + 0.5) * 6, y0 + dy * (k + 0.5) * 6; box((px, py, zd - 0.3), (width + 0.05 * (k % 2), 6.02, 0.3), 'wood', ang - math.pi / 2, sink=0.0)
        for sg in (-1, 1):
            qx, qy = px - dy * sg * (width / 2 - 0.2), py + dx * sg * (width / 2 - 0.2); zb = gz(qx, qy); cyl((qx, qy, zb - 0.3), 0.17, zd - zb + 0.3, 'wood', 5)
    ex, ey = x0 + dx * length, y0 + dy * length; box((ex, ey, zd - 0.3), (9.0, 3.4, 0.3), 'wood', ang - math.pi / 2, sink=0.0)
    for sg in (-1, 1):
        qx, qy = ex - dy * sg * 3.8, ey + dx * sg * 3.8; zb = gz(qx, qy); cyl((qx, qy, zb - 0.3), 0.2, zd - zb + 0.3, 'wood', 5)
    return ex, ey
def tree_trunk(x, y, z, h, r): cyl((x, y, z - 0.3), r, h + 0.3, 'bark', 4, r * 0.7)
def pine(x, y, s, rng):
    z = gz(x, y); h = rng.uniform(8.0, 12.0) * s; tree_trunk(x, y, z, h * 0.35, 0.3 * s)
    was = K._soft(True); cyl((x, y, z + h * 0.16), 3.7 * s, h * 0.5, 'pine', 7, 0.9 * s); cyl((x, y, z + h * 0.46), 2.7 * s, h * 0.54, 'pine', 7, 0.06); K._soft(was)
def broadleaf(x, y, s, rng):
    z = gz(x, y); h = rng.uniform(4.5, 6.5) * s; tree_trunk(x, y, z, h, 0.36 * s)
    was = K._soft(True); blob((x, y, z + h + 1.2 * s), rng.uniform(3.4, 4.3) * s, 'foliage', 0.78, rng.randint(0, 999), 2); K._soft(was)
def oak(x, y, s, rng):
    z = gz(x, y); h = rng.uniform(4.5, 6.0) * s; tree_trunk(x, y, z, h, 0.42 * s)
    was = K._soft(True)
    for dx_, dy_, dz_, rr in ((0, 0, 1.4, 3.6), (1.8, 0.8, 0.4, 2.7), (-1.6, -1.0, 0.7, 2.9)): blob((x + dx_ * s, y + dy_ * s, z + h + dz_ * s), rr * s, 'foliage', 0.72, rng.randint(0, 999), 1)
    K._soft(was)
def wall_pieces(p0, p1, rng, h=1.15, step=4.0, check=True, gaps=0.0):
    L = math.hypot(p1[0] - p0[0], p1[1] - p0[1]); n = max(1, int(L / step)); rz = math.atan2(p1[1] - p0[1], p1[0] - p0[0]); c = 0
    for k in range(n):
        t = (k + 0.5) / n; x, y = p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t
        if check and (not terr_ok(x, y, 0.3, 14.0, 2.6, 8.0, 5.0) or in_keep(x, y)): continue
        if gaps and rng.random() < gaps: continue
        box((x, y, gz(x, y)), (L / n + 0.05, 0.7 + 0.06 * (k % 2), h + rng.uniform(-0.04, 0.04)), 'stone', rz); c += 1
    return c
def bunker(x, y, rz):
    z = zmin(x, y, 7.0, 5.0, rz); at = at_fn(x, y, rz)
    box((x, y, z), (7.0, 5.0, 2.0), 'concrete', rz); box((x, y, z + 2.0), (7.8, 5.8, 0.35), 'concrete', rz, sink=0.0); box((*at(0, 2.53), z + 1.1), (4.2, 0.1, 0.5), 'glass', rz, sink=0.0)
    was = K._soft(True); blob((*at(0, -3.6), z + 0.2), 3.0, 'stone', 0.45, 3, 1); K._soft(was); return 5.2
def crates(x, y, rng, n=4):
    for k in range(n):
        px, py = x + rng.uniform(-1.6, 1.6), y + rng.uniform(-1.6, 1.6); box((px, py, gz(px, py)), (1.1, 1.1, 1.0 + 0.2 * rng.random()), 'wood', rng.uniform(0, 3.14))
def tent(x, y, rz):
    z = zmin(x, y, 5, 4, rz); prism_xz([(-2.1, 0.0), (2.1, 0.0), (0.0, 2.5)], -2.8, 2.8, 'sandbag', T(x, y, z) @ rRz(rz - math.pi / 2)); return 3.6

# ---------------------------------------------------------------- places
def build_base(cx, cy, fx, rng, flag, col):
    rz0 = 0.0 if fx > 0 else math.pi
    P = lambda u, v: (cx + fx * u, cy + fx * v)
    for v in (-20.0, 0.0, 20.0): x, y = P(-27.0, v); house(x, y, rz0 - math.pi / 2, 9.5, 5.0, 2.8, 'wood', 'metal', True, True, z=gz(cx, cy))
    x, y = P(-24.0, -29.5); K.container(x, y, rz0 + 0.02, 'metal', 2); x, y = P(-24.0, 29.5); K.container(x, y, rz0 - 0.03, 'rust', 1)
    x, y = P(-9.0, 31.0); drums(x, y, 7, rng); x, y = P(-9.0, -31.0); crates(x, y, rng, 5)
    for u in (-17.0, -3.0, 11.0, 25.0):
        for sg in (-1, 1):
            x, y = P(u + rng.uniform(-1, 1), sg * 26.5); revetment(x, y, -math.pi / 2 * sg * fx, 7.0, 5.0); reg_add(x, y, 5.0)
    for sg in (-1, 1):
        for a, b in ((7.0, 17.0), (22.0, 31.0)):
            x0, y0 = P(33.0, sg * a); x1, y1 = P(33.0, sg * b); K.sandbags(x0, y0, x1, y1)
        x, y = P(33.0, sg * 4.0); K.hedgehog(x, y, rng.uniform(0, 3))
        x, y = P(-31.0, sg * 30.0); watchtower(x, y, rz0 + 0.2); x, y = P(31.0, sg * 31.0); watchtower(x, y, rz0 - 0.2)
    x, y = P(-8.0, 3.0); beam((x, y, gz(x, y)), (x, y, gz(x, y) + 14.0), 0.22, 'metal')
    fx_, fy_ = flag; flag_post(fx_, fy_, col)
    pts = [P(36.0, -34.0), P(-36.0, -34.0), P(-36.0, 34.0), P(36.0, 34.0)]
    K.fence(pts, 1.2, 4.6, 'wood', gaps=[(*P(-36.0, 0.0), 4.0)])
    for a, b in ((-12.0, -33.0), (14.0, 33.0)): x, y = P(a, b); tent(x, y, rz0 + 0.3)
def roadside(poly, s0, s1, step, off, make, rng, skip=None, pr=7.0, maxsl=0.3, mind=14.0, road=7.0, track=5.0):
    """houses (make(x, y, rz) -> radius) down both sides of a road between arc lengths s0 and s1, long side parallel to the road, set back off metres"""
    pts = dense(poly, 2.0); L = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(pts, axis=0).T))]); s = max(s0, 0.0); n = 0
    while s < min(s1, L[-1] - 4):
        i = min(int(np.searchsorted(L, s)), len(pts) - 2); tx, ty = pts[i + 1] - pts[i]; tl = math.hypot(tx, ty) or 1.0; tx, ty = tx / tl, ty / tl; ang = math.atan2(ty, tx)
        for sg in (-1, 1):
            o = sg * (off + rng.uniform(-1.0, 2.5)); x, y = pts[i][0] - ty * o, pts[i][1] + tx * o
            if (skip and skip(x, y)) or not terr_ok(x, y, maxsl, mind, 2.4, road, track) or not reg_free(x, y, pr, 2.5): continue
            r = make(x, y, ang + (math.pi if sg > 0 else 0.0) + rng.uniform(-0.06, 0.06)); reg_add(x, y, r); n += 1
        s += step + rng.uniform(-2.0, 3.0)
    return n
def arc_at(poly, p):
    pts = dense(poly, 2.0); L = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(pts, axis=0).T))]); return float(L[int(np.argmin(np.hypot(pts[:, 0] - p[0], pts[:, 1] - p[1])))])
def build_village(rng):
    ax, ay = PA; sx, sy = SHORE_A[0], SHORE_A[1] + 30.0
    while bil(HM, sx, sy) > 0.9 and sy > SHORE_A[1] - 40: sy -= 0.5
    SH = (sx, sy); dx, dy = 0.14, -1.0; nl = math.hypot(dx, dy); dx, dy = dx / nl, dy / nl; ang = math.atan2(dy, dx)
    log('village: shore at (%.0f, %.0f), %.0f m south of A' % (sx, sy, ay - sy))
    def mk(x, y, rz):
        wall = rng.choice(('plaster', 'plaster', 'stone', 'brick')); roof = rng.choice(('tile', 'tile', 'rust', 'wood'))
        return house(x, y, rz, rng.uniform(7.5, 9.5), rng.uniform(5.0, 6.2), rng.uniform(2.9, 3.5), wall, roof)
    near = lambda x, y: math.hypot(x - ax, y - ay) < 25.0
    sA = arc_at(ROUTES['centre'], PA); n = roadside(ROUTES['centre'], sA - 100, sA + 85, 15.0, 13.5, mk, rng, near)
    n += roadside(TRACKS['jet'], 18.0, 120.0, 15.0, 13.0, mk, rng)
    wa = TRACKS['wA']; sw = arc_at(wa, PA); n += roadside(wa, sw - 85, sw - 24, 16.0, 12.5, mk, rng, near)
    x, y = ax + 13.0, ay + 5.0; cyl((x, y, gz(x, y) - 0.2), 1.0, 1.0, 'stone', 10); reg_add(x, y, 1.5)                  # the well
    for sg in (-1, 1): beam((x + sg * 1.1, y, gz(x, y)), (x + sg * 1.1, y, gz(x, y) + 2.4), 0.12, 'wood')
    beam((x - 1.1, y, gz(x, y) + 2.4), (x + 1.1, y, gz(x, y) + 2.4), 0.12, 'wood')
    ex, ey = jetty(SH[0] - dx * 5, SH[1] - dy * 5, ang, 62.0)
    boat(ex + 4.0 * -dy, ey + 4.0 * dx + 0.5, ang + 1.57, 'blue', 0.0); boat(ex - 3.0 * -dy - 1.0, ey - 3.0 * dx, ang + 1.62, 'red', 0.0)
    for k in range(3):                                                           # boats hauled up on the shore
        tx = SH[0] + (k - 1) * 22.0 + 24.0; ty = SH[1] + 25; tt2 = 0.0
        while bil(HM, tx, ty - tt2) > 0.5 and tt2 < 70: tt2 += 1.0
        bx, by = tx, ty - tt2 + 2.5
        boat(bx, by, 1.57 + rng.uniform(-0.2, 0.2), ('red', 'blue', 'green')[k], gz(bx, by) - 0.1); reg_add(bx, by, 4.5)
    for k in range(2):                                                           # boat sheds by the water
        px, py = SH[0] - 30.0 - k * 24.0, SH[1] + 16.0 + k * 3.0
        if terr_ok(px, py, 0.3, 6.0, 1.6, 5.0, 4.0) and reg_free(px, py, 7.0, 2.0): r = house(px, py, 0.1 * k, 11.0, 6.0, 3.6, 'wood', 'rust', True, False); reg_add(px, py, r)
    x, y = SH[0] + 8.0, SH[1] + 16.0; crates(x, y, rng, 6); drums(x - 6.0, y + 1.0, 5, rng)
    was = K._soft(True)
    for k in range(2):                                                           # net-drying frames
        x, y = ax - 24.0 + k * 46.0, ay - 30.0
        for sgn in (-1, 1): beam((x + sgn * 3.0, y, gz(x, y) - 0.2), (x + sgn * 3.0, y, gz(x, y) + 2.4), 0.1, 'wood')
        beam((x - 3.0, y, gz(x, y) + 2.3), (x + 3.0, y, gz(x, y) + 2.3), 0.07, 'wood'); box((x, y, gz(x, y) + 1.0), (6.0, 0.05, 1.3), 'hedge', 0.0, sink=0.0)
    K._soft(was); log('village houses', n); return SH
def build_town(rng):
    px_, py_ = PB; n = 0; near = lambda x, y: math.hypot(x - px_, y - py_) < 27.0
    def mk(x, y, rz):
        if rng.random() < 0.6: return K.ruin(x, y, rz, rng.uniform(8.5, 11.0), rng.uniform(6.0, 7.5), rng.choice(('stone', 'brick')), rng)
        return house(x, y, rz, rng.uniform(8, 10), 6.0, 3.4, rng.choice(('brick', 'stone', 'plaster')), 'tile') + 0.5
    sB = arc_at(ROUTES['centre'], PB); n += roadside(ROUTES['centre'], sB - 85, sB + 85, 17.0, 14.0, mk, rng, near, 7.5, 0.30, 20.0, 8.0, 6.0)
    bn = TRACKS['bN']; n += roadside(bn, 26.0, 100.0, 18.0, 13.0, mk, rng, near, 7.5, 0.30, 20.0, 8.0, 6.0)
    for k in range(40):                                                          # a few more between the streets
        a = rng.uniform(0, 6.283); r_ = rng.uniform(30, 62); x, y = px_ + math.cos(a) * r_, py_ + math.sin(a) * r_
        if not terr_ok(x, y, 0.30, 20.0, 2.4, 12.0, 9.0) or not reg_free(x, y, 7.5, 4.5): continue
        r = mk(x, y, round(a / (math.pi / 2)) * (math.pi / 2) + rng.uniform(-0.12, 0.12)); reg_add(x, y, r); n += 1
        if n >= 22: break
    cx, cy = px_ - 38.0, py_ + 34.0                                              # the church ruin: a nave and a stump of tower
    for _ in range(30):
        if terr_ok(cx, cy, 0.25, 20.0, 2.4, 12.0, 9.0) and reg_free(cx, cy, 11.0, 3.0): break
        cx, cy = px_ - rng.uniform(30, 62), py_ + rng.uniform(22, 58)
    K.ruin(cx, cy, 0.1, 16.0, 8.0, 'stone', rng); z = gz(cx, cy); box((cx - 8.5, cy, z), (4.6, 4.6, 12.5), 'stone', 0.1)
    box((cx - 8.5, cy, z + 12.5), (3.6, 3.6, 1.4), 'stone', 0.4, sink=0.0); reg_add(cx, cy, 12.0)
    x, y = px_ + 12.8, py_ + 3.0; cyl((x, y, gz(x, y) - 0.2), 1.7, 1.1, 'stone', 12); cyl((x, y, gz(x, y) + 0.9), 0.4, 3.4, 'stone', 8)
    for a, kind in ((0.5, 'tank'), (2.2, 'truck'), (3.9, 'car'), (5.3, 'tank')):
        x, y = px_ + math.cos(a) * 21.0, py_ + math.sin(a) * 21.0
        if not terr_ok(x, y, 0.25, 20.0, 2.4, 6.0, 5.0) or not reg_free(x, y, 4.5, 3.0): continue
        if kind == 'tank': K.wreck_tank(x, y, rng.uniform(0, 6.2), rng, True)
        elif kind == 'truck': K.truck(x, y, rng.uniform(0, 6.2), True)
        else: K.car(x, y, rng.uniform(0, 6.2))
        reg_add(x, y, 4.5)
    for a in (0.8, 2.4, 3.9, 5.5):                                               # sandbag nests on the corners of the crossing
        x, y = px_ + math.cos(a) * 18.0, py_ + math.sin(a) * 18.0
        if terr_ok(x, y, 0.25, 20.0, 2.4, 6.0, 5.0) and reg_free(x, y, 3.2, 2.0): K.sandbags(x - 2.6, y, x + 2.6, y + 1.0); reg_add(x, y, 3.2)
    was = K._soft(True)
    for k in range(22):
        a = rng.uniform(0, 6.283); r_ = rng.uniform(14, 66); x, y = px_ + math.cos(a) * r_, py_ + math.sin(a) * r_
        if terr_ok(x, y, 0.3, 20.0, 2.4, 7.0, 5.0): blob((x, y, gz(x, y) - 0.2), rng.uniform(0.9, 1.7), rng.choice(('stone', 'brick', 'stone')), 0.4, rng.randint(0, 999), 1)
    K._soft(was); log('town buildings', n)
def build_radar(rng):
    cx, cy = PC; z0 = gz(cx, cy)
    radar_site(cx - 6.0, cy + 17.0, 0.0); reg_add(cx - 6.0, cy + 17.0, 9.0)
    for k, a in enumerate((-2.5, -1.7, -0.9)):
        x, y = cx + math.cos(a) * 22.5, cy + math.sin(a) * 22.5; fuel_tank(x, y, 4.8, 5.5, ('plaster', 'plaster', 'metal')[k]); reg_add(x, y, 6.0)
    x, y = cx + 19.0, cy + 8.0; house(x, y, 0.2, 7.0, 4.5, 2.8, 'concrete', 'metal', True, True); reg_add(x, y, 5.0)
    for a in (0.6, 2.0, 3.6, 5.3):
        x, y = cx + math.cos(a) * 24.0, cy + math.sin(a) * 24.0; K.sandbags(x - 2.6 * -math.sin(a), y - 2.6 * math.cos(a), x + 2.6 * -math.sin(a), y + 2.6 * math.cos(a)); reg_add(x, y, 3.0)
    for a, rz in ((1.1, 0.0), (4.4, math.pi)):
        x, y = cx + math.cos(a) * 20.5, cy + math.sin(a) * 20.5; K.gun_pit(x, y, a, 3.6, rng); reg_add(x, y, 4.5)
    pts = [(cx + math.cos(a) * 31.0, cy + math.sin(a) * 31.0) for a in np.linspace(0.3, 0.3 + 6.283, 25)]
    K.fence(pts, 1.5, 4.5, 'metal', gaps=[(cx + 31.0 * math.cos(3.1), cy + 31.0 * math.sin(3.1), 7.0), (cx + 31.0 * math.cos(0.0), cy + 31.0 * math.sin(0.0), 7.0), (cx + 31.0 * math.cos(-1.57), cy + 31.0 * math.sin(-1.57), 6.0)])
    x, y = cx - 21.0, cy - 11.0; K.truck(x, y, 0.6, False); reg_add(x, y, 4.0); drums(cx + 14.0, cy - 19.0, 6, rng)
def build_airstrip(rng):
    cx, cy = AIR['c']; hw = AIR['hw']; z = gz(cx, cy)
    ay = cy + 38.0
    for x in (-100.0, -62.0, -24.0): hangar(x, ay - 4.0 + 0.0, 0.0, 24.0, 22.0, 8.5); reg_add(x, ay - 4.0, 16.0)
    control_tower(10.0, cy + 34.0, 0.0); reg_add(10.0, cy + 34.0, 8.0)
    for x, y in ((-6.0, cy + 49.0), (-16.0, cy + 49.0)): fuel_tank(x, y, 3.3, 4.2, 'plaster'); reg_add(x, y, 4.5)
    x, y = cx + 110.0, cy + 22.0; was = K._soft(True); beam((x, y, gz(x, y)), (x, y, gz(x, y) + 7.0), 0.12, 'metal'); cyl((0, 0, 0), 0.7, 3.2, 'red', 8, 0.2, M=T(x + 1.4, y, gz(x, y) + 6.6) @ rRy(math.pi / 2 - 0.15)); K._soft(was)
    for k, x in enumerate((38.0, 62.0, 86.0, 110.0)):                           # dispersal pens for aircraft north of the runway
        yy = cy + 29.0 + 5.0; revetment(x, yy, -math.pi / 2, 18.0, 6.0); reg_add(x, yy, 11.0)
    for x in (-140.0, 120.0):
        for sg in (-1, 1): K.gun_pit(x, cy + sg * 26.0, 1.57 * sg, 3.6, rng); reg_add(x, cy + sg * 26.0, 4.5)
    was = K._soft(True)
    for x in np.arange(cx - hw + 10, cx + hw, 25.0):
        for sg in (-1, 1): box((x, cy + sg * 15.9, gz(x, cy + sg * 15.9)), (0.35, 0.35, 0.4), 'glass', 0.0, sink=0.1)
    K._soft(was)
    for x, y in ((-122.0, cy + 53.0), (-60.0, cy + 54.0)): K.truck(x, y, 0.3, False); reg_add(x, y, 4.0)
    x, y = 30.0, cy + 54.0; drums(x, y, 6, rng)
def build_lighthouse(rng):
    x, y = LH; r = lighthouse(x, y); reg_add(x, y, 16.0)
    pts = [(x - 15.0, y - 12.0), (x + 17.0, y - 12.0), (x + 17.0, y + 14.0), (x - 15.0, y + 14.0), (x - 15.0, y - 12.0)]
    K.fence(pts, 1.1, 4.5, 'wood', gaps=[(x - 15.0, y + 1.0, 4.0)])
def build_farm(f, k, rng):
    fx, fy = f; rot = rng.uniform(-0.5, 0.5); at = at_fn(fx, fy, rot)
    x, y = at(-13.0, -9.0); r = house(x, y, rot, 11.0, 7.0, 4.0, rng.choice(('brick', 'plaster')), 'tile'); box((x + 3, y, gz(x, y) + 4.0), (0.9, 0.9, 2.4), 'brick', 0.0, sink=0.0); reg_add(x, y, 8.0)
    x, y = at(14.0, 7.0); barn(x, y, rot + 0.1, 17.0, 9.5, 4.8); reg_add(x, y, 10.5)
    x, y = at(4.0, -13.0); house(x, y, rot + 1.57, 8.0, 5.0, 3.0, 'wood', 'metal', True, False); reg_add(x, y, 5.5)
    x, y = at(-2.0, 11.0); r = K.bale_stack(x, y, rot, 6.0, 2.6, 3); reg_add(x, y, 4.0)
    x, y = at(-18.0, 8.0); K.bales(x, y, rot + 1.5, 4, rng); reg_add(x, y, 5.0)
    pts = [at(-26.0, -22.0), at(26.0, -22.0), at(26.0, 22.0), at(-26.0, 22.0), at(-26.0, -22.0)]
    K.fence(pts, 1.1, 4.8, 'wood', gaps=[(*at(26.0, 0.0), 5.0), (*at(-26.0, 4.0), 4.0)])
    for a, b in ((-24.0, -19.0), (24.0, 20.0), (-24.0, 19.0), (25.0, -21.0)): oak(*at(a, b), 1.1, rng)
    log('farm', k, 'built')
def field_walls(rng):
    c_, s_ = math.cos(FPHI), math.sin(FPHI); done = set(); n = 0
    def corner(u, v): return (FU * u * c_ - FV * v * s_, FU * u * s_ + FV * v * c_)
    for iu in range(-12, 12):
        for iv in range(-16, 16):
            mx, my = corner(iu + 0.5, iv + 0.5)
            if abs(mx) > 520 or abs(my) > 420: continue
            if not bool(field_active(mx, my, np.float64(iu), np.float64(iv))): continue
            for (a, b, key) in (((iu, iv), (iu + 1, iv), ('h', iu, iv)), ((iu, iv), (iu, iv + 1), ('v', iu, iv)), ((iu, iv + 1), (iu + 1, iv + 1), ('h', iu, iv + 1)), ((iu + 1, iv), (iu + 1, iv + 1), ('v', iu + 1, iv))):
                if key in done or hash01(key[1] * 3 + (7 if key[0] == 'h' else 0), key[2], 9) > 0.45: continue
                done.add(key); n += wall_pieces(corner(*a), corner(*b), rng, 1.1, 4.0, True, 0.15)
    log('field walls', n, 'pieces')
def scatter_cover(rng):
    """cover every 40-60 m along the three routes and the branch tracks: rocks, walls, wrecks, bunkers, pits, ruins, sandbags, bales"""
    kinds = {'rocks': 3.0, 'wall': 2.0, 'wreck': 1.3, 'bunker': 1.0, 'pit': 1.3, 'ruin': 0.9, 'sandbags': 1.4, 'bales': 0.7, 'cubes': 0.5, 'trucks': 0.7}
    names = list(kinds); w = [kinds[k] for k in names]; got = {}
    for name, poly in list(ROUTES.items()) + [(k, v) for k, v in TRACKS.items() if k in ('wA', 'wB', 'bN', 'cN', 'cS', 'lh', 'air')]:
        pts = dense(poly, 2.0); L = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(pts, axis=0).T))]); s = 40.0 + rng.uniform(0, 14); side = rng.choice((-1, 1))
        while s < L[-1] - 30:
            i = int(np.searchsorted(L, s)); i = min(i, len(pts) - 2); tx, ty = pts[i + 1] - pts[i]; tl = math.hypot(tx, ty) or 1.0; tx, ty = tx / tl, ty / tl; ang = math.atan2(ty, tx)
            kind = rng.choices(names, w)[0]; ok = False
            for tries in range(14):
                off = side * rng.uniform(13.0, 34.0); x, y = pts[i][0] - ty * off, pts[i][1] + tx * off
                R = {'rocks': 3.8, 'wall': 9.0, 'wreck': 4.2, 'bunker': 5.2, 'pit': 4.4, 'ruin': 6.0, 'sandbags': 3.4, 'bales': 5.0, 'cubes': 8.0, 'trucks': 4.0}[kind]
                if not terr_ok(x, y, 0.30, 18.0, 2.5, 10.0, 7.0) or in_keep(x, y) or not reg_free(x, y, R, 7.0): side = -side if tries % 3 == 2 else side; continue
                if kind == 'bales' and not (field_zone(x, y) > 0.1 and gz(x, y) < 18): kind = 'rocks'; R = 3.8
                if kind == 'rocks': K.outcrop(x, y, rng.choice((3, 4)), 0.95, rng)
                elif kind == 'wall': wall_pieces((x - tx * 8, y - ty * 8), (x + tx * 8, y + ty * 8), rng, 1.2, 4.0, True, 0.0)
                elif kind == 'wreck': K.wreck_tank(x, y, rng.uniform(0, 6.2), rng, rng.random() < 0.7)
                elif kind == 'bunker': bunker(x, y, ang + rng.choice((0.0, math.pi)) + rng.uniform(-0.3, 0.3))
                elif kind == 'pit': K.gun_pit(x, y, ang + rng.choice((1.57, -1.57)) * (1 if off > 0 else -1) + rng.uniform(-0.4, 0.4), 3.6, rng)
                elif kind == 'ruin': K.ruin(x, y, ang + rng.uniform(-0.3, 0.3), rng.uniform(8, 10), rng.uniform(6, 7.5), 'stone', rng)
                elif kind == 'sandbags': K.sandbags(x - tx * 2.8, y - ty * 2.8, x + tx * 2.8, y + ty * 2.8)
                elif kind == 'bales': K.bales(x, y, ang, rng.choice((3, 4)), rng)
                elif kind == 'cubes': K.tank_cubes(x - tx * 7, y - ty * 7, x + tx * 7, y + ty * 7)
                elif kind == 'trucks': K.truck(x, y, rng.uniform(0, 6.2), True)
                reg_add(x, y, R); got[kind] = got.get(kind, 0) + 1; ok = True; break
            side = -side; s += rng.uniform(40.0, 58.0)
    log('route cover', got)
def scatter_hills(rng, n=52):
    c = 0; tries = 0
    while c < n and tries < 4000:
        tries += 1; x, y = rng.uniform(-470, 470), rng.uniform(-360, 360)
        if not terr_ok(x, y, 0.42, 24.0, 4.0, 10.0, 7.0) or in_keep(x, y) or bil(SLM, x, y) < 0.08 or not reg_free(x, y, 3.8, 8.0): continue
        K.outcrop(x, y, rng.choice((2, 3)), rng.uniform(0.8, 1.3), rng); reg_add(x, y, 3.8); c += 1
    log('hill boulders', c)
def scatter_walls_long(rng):
    c = 0; tries = 0
    while c < 12 and tries < 3000:
        tries += 1; x, y = rng.uniform(-440, 440), rng.uniform(-340, 340)
        if not terr_ok(x, y, 0.2, 30.0, 3.0, 10.0, 8.0) or in_keep(x, y, 6) or not reg_free(x, y, 8.0, 7.0): continue
        a = rng.uniform(0, 3.14); n_ = wall_pieces((x - math.cos(a) * 14, y - math.sin(a) * 14), (x + math.cos(a) * 14, y + math.sin(a) * 14), rng, 1.15, 4.0, True, 0.0)
        if n_: reg_add(x, y, 8.0); c += 1
def build_woods(rng):
    cnt = {'pine': 0, 'broad': 0}; step = 7.0
    cand = [(x + rng.uniform(-3.4, 3.4), y + rng.uniform(-3.4, 3.4)) for x in np.arange(-480, 480, step) for y in np.arange(-370, 370, step)]; rng.shuffle(cand)
    for x, y in cand:
        f = float(bil(FM, x, y))
        if f < 0.4 or rng.random() > min(1.0, f * 0.9): continue
        if not reg_free(x, y, 3.0, 3.6): continue
        sp = float(K.vn2(np.float64(x), np.float64(y), 70.0, 52)) + 0.004 * (gz(x, y) - 10)
        if sp > 0.43: pine(x, y, rng.uniform(0.85, 1.25), rng); cnt['pine'] += 1
        else: broadleaf(x, y, rng.uniform(0.9, 1.25), rng); cnt['broad'] += 1
        reg_add(x, y, 3.0)
    log('woods', cnt)
def scatter_trees_lone(rng):
    c = 0; tries = 0
    while c < 46 and tries < 4000:
        tries += 1; x, y = rng.uniform(-470, 470), rng.uniform(-360, 360)
        if not terr_ok(x, y, 0.2, 22.0, 2.8, 8.0, 6.0) or in_keep(x, y) or not reg_free(x, y, 3.2, 3.0): continue
        if float(bil(FM, x, y)) > 0.05 or float(K.vn2(np.float64(x), np.float64(y), 90.0, 61)) < 0.5: continue
        oak(x, y, rng.uniform(0.9, 1.25), rng); reg_add(x, y, 3.2); c += 1
    log('lone oaks', c)
def soft_things(rng):
    was = K._soft(True); nb = 0; tries = 0
    while nb < 150 and tries < 6000:
        tries += 1; x, y = rng.uniform(-480, 480), rng.uniform(-370, 370)
        z = gz(x, y)
        if bil(DIST, x, y) < 6 or z < 0.9 or bil(ROADD, x, y) < 5 or in_keep(x, y, -20): continue
        near_wood = float(bil(FM, x, y)) > 0.15; near_road = bil(ROADD, x, y) < 16 or bil(TRACKD, x, y) < 10
        if not (near_wood or near_road or rng.random() < 0.15) or float(K.vn2(np.float64(x), np.float64(y), 25.0, 71)) < 0.45: continue
        K.bush(x, y, rng.uniform(0.9, 1.7), rng); nb += 1
    ns = 0; tries = 0
    while ns < 50 and tries < 4000:
        tries += 1; x, y = rng.uniform(-480, 480), rng.uniform(-370, 370)
        if bil(DIST, x, y) < 3 or gz(x, y) < 0.9 or bil(ROADD, x, y) < 5 or in_keep(x, y, -20): continue
        if rng.random() > 0.35 + 0.65 * float(bil(SLM, x, y) > 0.2): continue
        K.stones(x, y, 3, rng); ns += 1
    for k in range(70):                                                           # reef rocks in the shallows (seen through the water), shingle
        a = rng.uniform(0, 6.283); r_ = coast_R(np.array([a]))[0] + rng.uniform(12, 80); x, y = r_ * math.cos(a), r_ * math.sin(a)
        z = gz(x, y)
        if -7.0 < z < -0.6: blob((x, y, z + 0.2), rng.uniform(1.3, 3.0), 'rock', 0.6, rng.randint(0, 999), 0)
    K._soft(was); log('bushes', nb, 'stone groups', ns)
def islet_rocks(rng):
    for cx, cy, r0, amp, sd in ISLETS:
        for k in range(6):
            a = rng.uniform(0, 6.283); d_ = rng.uniform(0, r0 * 0.7); x, y = cx + math.cos(a) * d_, cy + math.sin(a) * d_; z = gz(x, y)
            if z > 0.5: blob((x, y, z + 0.4), rng.uniform(2.0, 4.0), 'rock', 0.7, rng.randint(0, 999), 1)
def build_props():
    rng = random.Random(23); random.seed(23)
    build_base(WB[0], WB[1], 1, rng, FLAGW, 'red'); build_base(EB[0], EB[1], -1, rng, FLAGE, 'blue'); mark('bases')
    build_village(rng); mark('village A'); build_town(rng); mark('town B'); build_radar(rng); mark('radar C'); build_airstrip(rng); mark('airstrip'); build_lighthouse(rng); mark('lighthouse')
    for k, f in enumerate(FARMS): build_farm(f, k, rng)
    mark('farms'); field_walls(rng); mark('field walls')
    scatter_cover(rng); mark('route cover'); scatter_hills(rng); scatter_walls_long(rng); mark('hills, walls')
    build_woods(rng); mark('woods'); scatter_trees_lone(rng); soft_things(rng); islet_rocks(rng); mark('trees, soft')
    log('props', len(K.bm.faces), 'faces,', ntri(), 'triangles')
    if 'propmap' in OPT: prop_map()
def prop_map():
    xs = GX[::2]; Xs, Ys = np.meshgrid(xs, xs, indexing='ij'); c = colour_field(Xs, Ys); S = 3
    img = np.repeat(np.repeat(np.transpose(c, (1, 0, 2)), S, 0), S, 1).copy()
    for lst in REG.values():
        for x, y, r in lst:
            i = int((x + HALF) / 4.0 * S); j = int((y + HALF) / 4.0 * S); rr = max(1, int(r / 4.0 * S))
            img[max(j - rr, 0):j + rr, max(i - rr, 0):i + rr] = img[max(j - rr, 0):j + rr, max(i - rr, 0):i + rr] * 0.4 + np.array((0.6, 0.0, 0.0))
    write_png(img[::-1], os.path.join(MOCK, 'ss-island-propmap.png'))

# ---------------------------------------------------------------- the terrain mesh: a grid with 6 m cells over the island band, growing to 56 m out in the sea bed
def axis_coords(inner, step):
    pts = [0.0]
    while pts[-1] < inner - 1e-6: pts.append(pts[-1] + step)
    s = step
    while pts[-1] < HALF - 1e-6: s = min(s * 1.32, 56.0); pts.append(min(pts[-1] + s, HALF))
    if HALF - pts[-2] < 0.35 * s: pts.pop(-2)
    p = np.array(pts); return np.concatenate([-p[::-1][:-1], p])
CELL = 6.4
def terrain_mesh():
    xs = axis_coords(500.0, float(OPT.get('cell', CELL))); ys = axis_coords(378.0, float(OPT.get('cell', CELL)))
    X, Y = np.meshgrid(xs, ys, indexing='ij'); Z = bil(HM, X, Y); nx, ny = len(xs), len(ys)
    verts = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1); idx = np.arange(nx * ny).reshape(nx, ny)
    quads = np.stack([idx[:-1, :-1].ravel(), idx[1:, :-1].ravel(), idx[1:, 1:].ravel(), idx[:-1, 1:].ravel()], 1)
    me = bpy.data.meshes.new('terrain'); me.from_pydata(verts.tolist(), [], quads.tolist())
    uv = me.uv_layers.new(name='UVMap'); lm = me.uv_layers.new(name='Lightmap'); lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get('vertex_index', lv)
    p = verts[lv]; uv.data.foreach_set('uv', (p[:, :2] / 8.0).astype(np.float32).ravel()); lm.data.foreach_set('uv', ((p[:, :2] + HALF) / (2 * HALF)).astype(np.float32).ravel())
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons)); me.update()
    log('terrain mesh: %d x %d verts, %d quads (%d triangles), height %.1f..%.1f' % (nx, ny, len(quads), 2 * len(quads), Z.min(), Z.max())); return me

def patch_sky(scene):
    """the Nishita sky looked up with the direction's z kept above the horizon: below the horizon the sky is the horizon haze, so the game's endless sea meets a hazy horizon"""
    nt = scene.world.node_tree; sky = next(n for n in nt.nodes if n.type == 'TEX_SKY')
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); mx = nt.nodes.new('ShaderNodeMath'); mx.operation = 'MAXIMUM'; mx.inputs[1].default_value = float(OPT.get('hz', 0.08))
    com = nt.nodes.new('ShaderNodeCombineXYZ'); L = nt.links
    L.new(tc.outputs['Generated'], sep.inputs[0]); L.new(sep.outputs['X'], com.inputs['X']); L.new(sep.outputs['Y'], com.inputs['Y']); L.new(sep.outputs['Z'], mx.inputs[0]); L.new(mx.outputs[0], com.inputs['Z']); L.new(com.outputs[0], sky.inputs['Vector'])
def sky_preview(scene):
    w = 512; tmp = bpy.data.scenes.new('skyprev'); tmp.world = scene.world; tmp.render.engine = 'CYCLES'; tmp.cycles.samples = 8
    cam = bpy.data.cameras.new('skyprev'); cam.type = 'PANO'
    try: cam.panorama_type = 'EQUIRECTANGULAR'
    except Exception: cam.cycles.panorama_type = 'EQUIRECTANGULAR'
    co = bpy.data.objects.new('skyprev', cam); tmp.collection.objects.link(co); tmp.camera = co; co.rotation_euler = (math.pi / 2, 0, -math.pi / 2)
    tmp.render.resolution_x = w; tmp.render.resolution_y = w // 2; tmp.render.resolution_percentage = 100; tmp.render.image_settings.file_format = 'PNG'
    tmp.render.filepath = os.path.join(MOCK, 'ss-island-sky.png'); bpy.ops.render.render(scene=tmp.name, write_still=True)
    bpy.data.scenes.remove(tmp); bpy.data.objects.remove(co); bpy.data.cameras.remove(cam); log('sky preview written')

def preview_renders(scene, tme, macro, detail):
    cd = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cd); scene.collection.objects.link(cam); scene.camera = cam
    cd.sensor_fit = 'HORIZONTAL'; cd.clip_end = 4000
    me = bpy.data.meshes.new('seaprev'); me.from_pydata([(-3000, -3000, 0), (3000, -3000, 0), (3000, 3000, 0), (-3000, 3000, 0)], [], [(0, 1, 2, 3)])
    sea = bpy.data.objects.new('seaprev', me); scene.collection.objects.link(sea)
    m = bpy.data.materials.new('seaprev'); m.use_nodes = True; b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (0.02, 0.16, 0.20, 1); b.inputs['Roughness'].default_value = 0.04; b.inputs['Alpha'].default_value = 0.72
    try: b.inputs['IOR'].default_value = 1.33
    except Exception: pass
    me.materials.append(m); tme.materials[0] = macro
    nt = macro.node_tree; pb = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')           # the preview ground wears the game's detail picture (x2, as the game draws it)
    if pb.inputs['Base Color'].links:
        src = pb.inputs['Base Color'].links[0].from_socket; det = nt.nodes.new('ShaderNodeTexImage'); det.image = K.PIC['ground_detail']; uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'UVMap'
        nt.links.new(uvn.outputs['UV'], det.inputs['Vector']); vm = nt.nodes.new('ShaderNodeVectorMath'); vm.operation = 'MULTIPLY'; vm.inputs[1].default_value = (2, 2, 2); nt.links.new(det.outputs['Color'], vm.inputs[0])
        mx = nt.nodes.new('ShaderNodeMixRGB'); mx.blend_type = 'MULTIPLY'; mx.inputs['Fac'].default_value = 1.0; nt.links.new(src, mx.inputs['Color1']); nt.links.new(vm.outputs[0], mx.inputs['Color2']); nt.links.new(mx.outputs['Color'], pb.inputs['Base Color'])
    scene.render.engine = 'CYCLES'; scene.cycles.samples = int(OPT.get('psamples', 40)); scene.cycles.device = 'CPU'
    try: scene.cycles.use_denoising = True
    except Exception: pass
    scene.render.resolution_x, scene.render.resolution_y = 1280, 720; scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'Standard' if 'Standard' in [i.identifier for i in bpy.types.ColorManagedViewSettings.bl_rna.properties['view_transform'].enum_items] else scene.view_settings.view_transform
    zb = gz(PB[0] - 60, PB[1] - 6)
    shots = {'air': ((-430.0, -520.0, 330.0), (40.0, 10.0, 10.0), 52.0), 'ground': ((PB[0] - 75.0, PB[1] - 8.0, zb + 2.7), (PB[0] + 70.0, PB[1] + 10.0, zb + 3.2), 62.0),
             'coast': ((-140.0, -112.0, gz(-140, -112) + 2.6), (-195.0, -165.0, 2.0), 62.0), 'wood': ((-60.0, -62.0, gz(-60, -62) + 2.6), (-130.0, -60.0, gz(-130, -60) + 4.0), 62.0),
             'air2': ((380.0, 420.0, 300.0), (-60.0, -20.0, 10.0), 50.0), 'base': ((-250.0, -60.0, gz(-300, 0) + 22.0), (-340.0, 0.0, gz(-330, 0) + 2.0), 58.0)}
    for nm in [k for k in (OPT.get('shots', 'air,ground').split(',')) if k in shots]:
        p, t, fov = shots[nm]; cd.angle = math.radians(fov); cam.location = p; cam.rotation_euler = (Vector(t) - Vector(p)).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = os.path.join(MOCK, 'ss-island-%s.png' % nm); bpy.ops.render.render(write_still=True); log('preview', nm)

def run():
    scene = bpy.context.scene
    if not bpy.data.filepath.replace('\\', '/').endswith('art/steelstorm/island.blend'):
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(K.BASE, 'island.blend')); log('created', bpy.data.filepath)
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    for c in list(bpy.data.collections): bpy.data.collections.remove(c)
    for cl in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.images):
        for d in list(cl):
            if d.users == 0: cl.remove(d)
    scene.render.fps = 30; random.seed(23)
    def coll(name):
        c = bpy.data.collections.new(name); scene.collection.children.link(c); return c
    K.pictures()
    K.PIC['rock'] = K.tinted('rock_dark', 'rock', (0.74, 0.68, 0.60))
    K.PIC['stone'] = K.tinted('stone_dark', 'stone', (0.80, 0.76, 0.70))
    K.PIC['pine'] = save_image(np.clip(K.leaves_px(512, 19, (0.30, 0.44, 0.22), (0.46, 0.60, 0.32), (0.13, 0.22, 0.11), 1500, (5, 13), 0.08), 0.02, 1), 'pine', K.TEXDIR); K.TILE['pine'] = 3.0; K.CROWN_MATS = ('foliage', 'pine')
    tc_ = coll('terrain'); wc = coll('_work'); K.lights(wc); patch_sky(scene); tick('pictures, light')
    tme = terrain_mesh(); ter = bpy.data.objects.new('terrain', tme); tc_.objects.link(ter)
    K.bm = bmesh.new(); K.bm.faces.layers.int.new('soft'); K.MI.clear(); build_props(); pme = bpy.data.meshes.new('props'); K.bm.to_mesh(pme); K.bm.free(); K.bm = None
    mats_ = sorted(K.MI, key=lambda k: K.MI[k]); mats = {k: K.tiled_material(k, K.PIC[k]) for k in mats_}
    for k in mats_: pme.materials.append(mats[k])
    K.world_uv(pme, mats_)
    pr = bpy.data.objects.new('props', pme); tc_.objects.link(pr); pr['hg_lightmap'] = 'tex/island_props_light.exr'; pr['hg_lightmap_size'] = 2048
    lu = pme.uv_layers.new(name='Lightmap'); pme.uv_layers.active = lu; smart_uv(pr, 66, 0.002); pme.uv_layers.active = pme.uv_layers['UVMap']; tick('props mesh')
    macro = K.macro_material('terrain_macro'); detail = K.tiled_material('ground_detail', K.PIC['ground_detail'], 1.0)
    nt = macro.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    if 'nobake' not in OPT or 'preview' in OPT:
        tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = macro_picture(int(OPT.get('macro', 2048))); tx.interpolation = 'Linear'
        uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'Lightmap'; nt.links.new(uvn.outputs['UV'], tx.inputs['Vector']); nt.links.new(tx.outputs['Color'], b.inputs['Base Color'])
    tme.materials.append(macro)
    for o in (ter, pr): o.data.calc_loop_triangles(); log(o.name, len(o.data.loop_triangles), 'triangles,', len(o.data.materials), 'materials')
    S = int(OPT.get('samples', 32))
    if 'nobake' not in OPT:
        K.bake(ter, 2048, 'tex/island_light.exr', {'COLOR', 'DIRECT', 'INDIRECT'}, S); tick('terrain bake')
        K.bake(pr, 2048, 'tex/island_props_light.exr', {'DIRECT', 'INDIRECT'}, S); tick('props bake')
    K.split_soft(pr)
    tme.materials[0] = detail
    cfg = {'out': '../../Steel Storm Rebuilt/assets/island',
           'world': {'collections': ['terrain'], 'lightmap': 'tex/island_light.exr', 'lmSize': 2048, 'gain': {'ground_detail': 2}, 'plain': ['ground_detail']},
           'heights': {'cell': 2.0, 'ground': ['terrain']}, 'sky': {'width': 1024}, 'maxTexture': 2048, 'area': ['terrain']}
    with open(os.path.join(K.BASE, 'island.export.json'), 'w') as f: json.dump(cfg, f, indent=1)
    with open(os.path.join(K.BASE, 'island_routes.json'), 'w') as f:      # the roads in GAME x, z (for island_check.mjs)
        json.dump({'routes': {k: [[round(p[0], 1), round(-p[1], 1)] for p in dense(v, 8.0)] for k, v in ROUTES.items()}, 'tracks': {k: [[round(p[0], 1), round(-p[1], 1)] for p in dense(v, 8.0)] for k, v in TRACKS.items()}}, f)
    bpy.ops.wm.save_mainfile(); log('saved', bpy.data.filepath)
    if 'skyprev' in OPT: sky_preview(scene)
    if 'preview' in OPT: preview_renders(scene, tme, macro, detail)
    log('done')

if __name__ == '__main__':
    K.SUN_DIR, K.SUN_E, K.SUN_COL, K.SKY_AIR, K.SKY_DUST = (0.60, 0.50, -0.85), 4.2, (1.0, 0.90, 0.76), 1.0, float(OPT.get('dust', 3.0))
    if 'skyk' not in OPT: OPT['skyk'] = '0.12'
    build_ground(); build_fields()
    if 'map' in OPT:
        report(); map_png()
        if 'col' in OPT: color_map_png()
        sys.exit(0)
    run()
