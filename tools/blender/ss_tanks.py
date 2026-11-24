# Steel Storm Remastered: the tank kit every battlefield script (make_valley/dunes/pass/works/range/harbor/farmland/city.py),
# make_vehicles.py and retank.py share. One copy of: the painting of a vehicle's picture, wheels and track runs, the light and heavy
# tanks, the medium tank (the proof slice's range tank, copied from art/proof/range.blend and repainted), and the paint / gear split.
#
# PAINT AND GEAR: every vehicle has two materials on one picture: `<name>` (the painted armour, the only one the game tints to a side's
# colour) and `<name>_gear` (tracks, road wheels, idlers, sprockets, tyres, rubber, exhausts, tools, glass, lights, the dark bore of the
# gun). In the Kit models a face is paint when its class is 'olive', gear otherwise. The medium tank's faces carry the range's `part`
# number (0 armour, 1 tracks, 3 dark metal, 4 glass, 5 stowage); part 0 islands shaped like a wheel low on the sides are gear too.
import bpy, bmesh, math, os, shutil
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from hgkit import *

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = os.path.join(ROOT, 'art', 'steelstorm'); TEXDIR = os.path.join(BASE, 'tex'); PROOF = os.path.join(ROOT, 'art', 'proof')
TANK_BASE = (0.58, 0.60, 0.54)
PAINT = CLS.index('olive')
# what the picture shows for each class (paint is TANK_BASE): rubber tracks and tyres, dark steel wheels, bare steel, glass and slits...
PAL = {CLS.index('olive'): TANK_BASE, CLS.index('rubber'): (0.1, 0.1, 0.095), CLS.index('steel'): (0.3, 0.3, 0.29), CLS.index('dark'): (0.06, 0.06, 0.06),
       CLS.index('bright'): (0.62, 0.62, 0.58), CLS.index('wood'): (0.40, 0.30, 0.20), CLS.index('alloy'): (0.22, 0.22, 0.21), CLS.index('tan'): (0.44, 0.40, 0.30),
       CLS.index('brass'): (0.30, 0.22, 0.16), CLS.index('polymer'): (0.11, 0.11, 0.11)}

# ---------------------------------------------------------------- vehicle character: camouflage, markings, dust, soot, track metal
# Everything on the paint is a light / dark variation of a neutral base, so the game's side tint (olive x 0.7 / 0.84 / 0.5, sand x 1.25 / 1.02 /
# 0.72) still gives an olive and a sand vehicle, each with its own darker brown and near-black camouflage. Markings are off-white (pale olive
# or cream after the tint). Metal, rubber, soot and dust on the gear (never tinted) keep their own colours.
NUMBERS = {'tank': '213', 'light': '121', 'heavy': '331', 'td': '412', 'spaa': '508', 'arty': '615', 'apc': '704', 'truck': '27', 'atgun': '9'}
FONT = {'0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001', '5': '111100111001111',
        '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111'}
def text_mask(u, v, text, h):
    """stencil digits (3 x 5 cells) centred on u = v = 0; u to the right, v up, h the digit height (metres)"""
    c = h / 5.0; W = len(text) * 4 * c - c; out = np.zeros(u.shape, bool)
    col = np.floor((u + W / 2) / c).astype(int); row = np.floor((h / 2 - v) / c).astype(int)
    ch = col // 4; cx = col % 4; ok = (col >= 0) & (ch < len(text)) & (cx < 3) & (row >= 0) & (row < 5)
    # stencil: a thin gap in the middle of each cell row keeps it from reading as a blob at a distance
    for i, t in enumerate(text):
        bits = np.array([b == '1' for b in FONT[t]])
        sel = ok & (ch == i); out[sel] = bits[row[sel] * 3 + cx[sel]]
    return out
def chevron_mask(u, v, s):
    """an upward chevron (a plain unit mark), s across"""
    return (np.abs(v - (0.18 * s - np.abs(u) * 0.75)) < 0.075 * s) & (np.abs(u) < 0.5 * s)
def decorate(col_, P, Nn, paint, turret, gear_rub, B, name, mott, streak):
    """camouflage, dust, exhaust soot, numbers and a unit chevron on a vehicle picture's texels (in place)"""
    ss = lambda x, e, w=0.02: np.clip((x - e) / w + 0.5, 0, 1)
    Q = P * np.array((0.8, 0.8, 1.5), np.float32)
    a = fbm(Q, 1.0, 41, 3); b = fbm(Q + 13.7, 0.75, 53, 3)
    dark = ss(a, 0.52); black = ss(b, 0.6) * (1 - dark * 0.5)
    base = np.array(TANK_BASE, np.float32)
    k = (1 - dark - black)[:, None] * 1.0 + dark[:, None] * (np.array((0.29, 0.27, 0.20), np.float32) / base) + black[:, None] * (np.array((0.12, 0.12, 0.11), np.float32) / base)
    col_[paint] *= k[paint]
    # track links and tyre treads: bare steel ridges on the running surfaces, polished where they touch the road
    run = gear_rub & (np.abs(Nn[:, 0]) < 0.7)
    t = np.mod(P[:, 1], 0.16) / 0.16; ridge = run & (t < 0.42)
    col_[ridge] = np.array((0.30, 0.29, 0.27), np.float32) * (0.85 + 0.3 * mott[ridge, None])
    shine = ridge & ((Nn[:, 2] < -0.5) | B); col_[shine] = col_[shine] * 0.4 + np.array((0.55, 0.54, 0.5), np.float32) * 0.6
    # dust: thick on the lower hull and the running gear, a film on flat tops
    zl = np.clip((1.25 - P[:, 2]) / 1.0, 0, 1) ** 1.2 * (0.45 + 0.55 * mott); flat = np.clip(Nn[:, 2], 0, 1) ** 3 * 0.18 * (0.5 + mott)
    d = np.clip(np.where(paint, 0.62, 0.42) * zl + flat, 0, 0.8); dust = np.array((0.46, 0.41, 0.32), np.float32)
    col_[:] = col_ * (1 - d[:, None]) + dust * d[:, None]
    # exhaust soot on the rear plate and the back of the deck
    hull = ~turret; ymax = float(np.percentile(P[hull, 1], 99.5)) if hull.any() else 0.0
    rear = hull & (P[:, 1] > ymax - 0.55) & ((Nn[:, 1] > 0.3) | (Nn[:, 2] > 0.6))
    so = np.clip((P[:, 1] - (ymax - 0.55)) / 0.55, 0, 1) * (0.35 + 0.45 * streak) * rear; col_[:] *= (1 - 0.7 * so)[:, None]
    # turret number on both sides (hull sides when there is no turret wall), unit chevron on the front and rear plates
    num = NUMBERS.get(name.replace('_tank', ''), '')
    white = np.array((0.86, 0.86, 0.80), np.float32)
    if num:
        for sg in (-1, 1):
            side = paint & (Nn[:, 0] * sg > 0.8)
            sel = side & turret
            if sel.sum() < 400: sel = side & ~turret & (P[:, 2] > np.percentile(P[side, 2], 40) if side.any() else False)
            if sel.sum() < 200: continue
            yc, zc = float(np.median(P[sel, 1])), float(np.median(P[sel, 2])); zr = float(np.percentile(P[sel, 2], 90) - np.percentile(P[sel, 2], 10))
            h = float(np.clip(zr * 0.55, 0.16, 0.34))
            m = sel & text_mask((P[:, 1] - yc) * sg, P[:, 2] - zc, num, h)
            col_[m] = col_[m] * 0.25 + white * 0.75 * (0.9 + 0.1 * mott[m, None])
    for sg in (-1, 1):
        sel = paint & ~turret & (Nn[:, 1] * sg > 0.6) & (P[:, 2] > 0.45)
        if sel.sum() < 200: continue
        xs = P[sel, 0]; zc = float(np.median(P[sel, 2])); xc = float(np.percentile(xs, 75)) * 0.75
        m = sel & chevron_mask((P[:, 0] - xc) * (-sg), P[:, 2] - zc, 0.32)
        col_[m] = col_[m] * 0.25 + white * 0.75
def tank_texture(ob, N, name):
    me = ob.data; me.calc_loop_triangles(); nt = len(me.loop_triangles)
    tl = np.empty(nt * 3, np.int64); me.loop_triangles.foreach_get('loops', tl); tl = tl.reshape(-1, 3)
    tp = np.empty(nt, np.int64); me.loop_triangles.foreach_get('polygon_index', tp)
    lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get('vertex_index', lv)
    co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    uv = np.empty(len(me.loops) * 2, np.float32); me.uv_layers['UVMap'].data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
    fn = np.empty(len(me.polygons) * 3, np.float32); me.polygons.foreach_get('normal', fn); fn = fn.reshape(-1, 3)
    cl = np.empty(len(me.polygons), np.int64); me.attributes['cls'].data.foreach_get('value', cl)
    bv = np.empty(len(me.polygons), np.int64); me.attributes['bev'].data.foreach_get('value', bv)
    rep = lambda a: np.repeat(a[tp].astype(np.float32)[:, None, None], 3, 1)
    gv = np.empty(len(me.vertices), np.int64); me.attributes['grp'].data.foreach_get('value', gv)
    gf = np.array([gv[p.vertices[0]] for p in me.polygons], np.int64)
    mask, (Pi, Ni, Ci, Bi, Gi) = raster(uv[tl], [co[lv[tl]], np.repeat(fn[tp][:, None, :], 3, 1), rep(cl), rep(bv), rep(gf)], N)
    bvh = BVHTree.FromPolygons([Vector(c) for c in co], [list(p.vertices) for p in me.polygons])
    rng = np.random.default_rng(5); NR = 12; u1, u2 = rng.random(NR), rng.random(NR)
    dirs = np.stack([np.sqrt(u1) * np.cos(2 * np.pi * u2), np.sqrt(u1) * np.sin(2 * np.pi * u2), np.sqrt(1 - u1)], 1)
    aoh = np.ones((N, N), np.float32); sub = mask.copy(); sub[1::2, :] = False; sub[:, 1::2] = False
    for y, x in zip(*np.nonzero(sub)):
        n = Vector(Ni[y, x])
        if n.length < 1e-6: continue
        n.normalize(); t = n.orthogonal().normalized(); b2 = n.cross(t); o = Vector(Pi[y, x]) + n * 0.004; occ = 0.0
        for d in dirs:
            h = bvh.ray_cast(o, t * d[0] + b2 * d[1] + n * d[2], 0.6)
            if h[0] is not None: occ += 1 - h[3] / 0.6
        aoh[y, x] = 1 - occ / NR
    ao = aoh.copy(); ys, xs = np.nonzero(mask & ~sub); ao[ys, xs] = aoh[(ys // 2) * 2, (xs // 2) * 2]
    ao = 0.25 * (ao + np.roll(ao, 1, 0) + np.roll(ao, 1, 1) + np.roll(np.roll(ao, 1, 0), 1, 1))
    idx = np.nonzero(mask); P = Pi[idx]; C = np.rint(Ci[idx][:, 0]).astype(int); B = Bi[idx][:, 0] > 0.5; G = np.rint(Gi[idx][:, 0]).astype(int)
    Nn = Ni[idx]; Nn = Nn / np.maximum(np.linalg.norm(Nn, axis=1), 1e-6)[:, None]
    base = np.array([PAL.get(c, TANK_BASE) for c in C], np.float32)
    grain = fbm(P, 0.03, 3); mott = fbm(P, 0.6, 9)
    col_ = base * (0.92 + 0.16 * grain[:, None]) * (0.92 + 0.16 * mott[:, None])
    paint = C == PAINT
    streak = vnoise(P * np.array((1, 1, 0.12), np.float32), 0.05, 31)
    decorate(col_, P, Nn, paint, G == GRP.index('mag'), C == CLS.index('rubber'), B, name, mott, streak)
    panel = (np.abs(np.mod(P[:, 1] + 0.37, 0.9) - 0.45) < 0.008) | (np.abs(np.mod(P[:, 0] + 0.21, 1.1) - 0.55) < 0.008); col_[paint & panel] *= 0.6
    rivet = paint & (np.abs(np.mod(P[:, 1] + 0.37, 0.9) - 0.45) < 0.03) & (np.mod(P[:, 0] * 10 + P[:, 2] * 10, 1.0) < 0.15); col_[rivet] *= 1.12
    metal = (C == CLS.index('steel')) | (C == CLS.index('alloy'))
    wear = (B & (paint | metal)) * (0.45 + 0.35 * grain) * np.where(paint, 1.0, 0.6); col_ = col_ * (1 - wear[:, None]) + np.array((0.60, 0.59, 0.56), np.float32) * wear[:, None]
    col_[paint] *= (0.9 + 0.12 * streak[paint])[:, None]
    col_ *= (0.35 + 0.65 * np.clip(ao[idx], 0, 1) ** 1.3)[:, None]
    col_ = np.clip(col_, 0.04, 1); img = np.zeros((N, N, 3), np.float32); img[idx] = col_; filled = mask.copy()
    for it in range(6):
        acc = np.zeros_like(img); cnt = np.zeros((N, N), np.float32)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            acc += np.roll(np.roll(img * filled[..., None], dy, 0), dx, 1); cnt += np.roll(np.roll(filled, dy, 0), dx, 1)
        new = (~filled) & (cnt > 0); img[new] = acc[new] / cnt[new][:, None]; filled |= new
    img[~filled] = 0.3
    return save_image(img, name, TEXDIR)

# ---------------------------------------------------------------- running gear and guns
def wheel(k, x, y, z, r, w, cls='alloy', grp='gun'):
    """a road wheel / idler: dished steel disc (gear)"""
    k.lathe([(0.0, -w / 2), (r * 0.35, -w / 2 - 0.02), (r * 0.9, -w / 2), (r, -w / 2 + 0.03), (r, w / 2 - 0.03), (r * 0.9, w / 2), (r * 0.35, w / 2 + 0.02), (0.0, w / 2)],
            T(x, y, z) @ Rz(90), 14, cls, grp)
def track_side(k, sx, x0, x1, y0, y1, z0, z1, nw, rw, grp='gun'):
    k.prism([(y0, (z0 + z1) / 2), (y0 + 0.25, z0), (y1 - 0.25, z0), (y1, (z0 + z1) / 2), (y1 - 0.2, z1), (y0 + 0.2, z1)], sx * x0, sx * x1, 'rubber', grp, bev=0.03)
    for i in range(int((y1 - y0) / 0.16)):
        yy = y0 + 0.3 + i * 0.16
        if yy > y1 - 0.3: break
        k.box((sx * (x0 + x1) / 2, yy, z0 + 0.02), (abs(x1 - x0) + 0.02, 0.06, 0.05), 'rubber', grp, bev=0.0)
    for i in range(nw):
        yy = y0 + 0.55 + i * (y1 - y0 - 1.1) / max(1, nw - 1); wheel(k, sx * (max(abs(x0), abs(x1)) - 0.06), yy, z0 + rw, rw, 0.22)
    wheel(k, sx * (max(abs(x0), abs(x1)) + 0.03), y0 + 0.28, (z0 + z1) / 2 + 0.05, rw * 0.75, 0.2, 'steel'); wheel(k, sx * (max(abs(x0), abs(x1)) + 0.03), y1 - 0.28, (z0 + z1) / 2 + 0.05, rw * 0.7, 0.2, 'steel')
def wheel_x(k, x, y, z, r, w, cls='rubber', grp='gun'):
    """a tyre with a steel hub (wheeled vehicles)"""
    wheel(k, x, y, z, r, w, cls, grp)
    k.lathe([(0.0, -w / 2 - 0.01), (r * 0.55, -w / 2 - 0.01), (r * 0.55, w / 2 + 0.01), (0.0, w / 2 + 0.01)], T(x, y, z) @ Rz(90), 10, 'alloy', grp)
    for sx in (-1, 1): k.lathe([(0.0, sx * (w / 2 + 0.005)), (r * 0.18, sx * (w / 2 + 0.005)), (r * 0.18, sx * (w / 2 + 0.03)), (0.0, sx * (w / 2 + 0.03))], T(x, y, z) @ Rz(90), 8, 'dark', grp)
def gun_tube(k, prof, M, segs=16, grp='bolt', r_in=None):
    """a hollow gun tube (lathe loop profile [(r, y)]); the inside of the bore (radius <= r_in) is dark gear"""
    faces = k.lathe(prof, M, segs, 'olive', grp, loop=True)
    if r_in:
        Mi = M.inverted()
        for f in faces:
            if all(math.hypot(*(lambda p: (p.x, p.z))(Mi @ v.co)) <= r_in + 1e-4 for v in f.verts): f[k.cls] = CLS.index('dark')
    return faces
def bore_disc(k, M, y, r, grp='bolt'):
    """a thin dark disc whose face is at y (the bore seen in the face of a muzzle brake)"""
    k.lathe([(0.0, y + 0.01), (r, y + 0.01), (r, y), (0.0, y)], M, 12, 'dark', grp, smooth=False)
def exhaust(k, x, y, z, r=0.07, l=0.35, grp='gun'):
    """a short exhaust pipe pointing back (+y), dark steel with a sooty mouth"""
    k.lathe([(r, 0.0), (r, l), (r * 0.7, l), (r * 0.7, 0.02)], T(x, y, z), 10, 'steel', grp, loop=True)

def stowage(k, roll, r, L, grp, g0, g1, t):
    """a canvas tarp roll lying across the turret's back (centre roll, radius r, length L) with two straps, and four spare track links
    on the glacis (the slope from (y, z) g0 to g1, at fraction t): canvas and steel are gear, so they keep their own colours"""
    x, y, z = roll
    k.lathe([(0.0, -L / 2), (r * 0.8, -L / 2), (r, -L / 2 + 0.04), (r, L / 2 - 0.04), (r * 0.8, L / 2), (0.0, L / 2)], T(x, y, z) @ Rz(90), 10, 'tan', grp)
    for sx in (-1, 1): k.box((x + sx * L * 0.3, y, z), (0.05, 2 * r + 0.03, 2 * r + 0.03), 'rubber', grp, bev=0.0)       # straps
    dy, dz = g1[0] - g0[0], g1[1] - g0[1]; ln = math.hypot(dy, dz); ang = math.degrees(math.atan2(dz, dy))
    cy, cz = g0[0] + dy * t - dz / ln * 0.035, g0[1] + dz * t + dy / ln * 0.035
    for i in range(4):
        cx = -0.45 + i * 0.3; M = T(cx, cy, cz) @ Rx(ang) @ T(-cx, -cy, -cz)
        k.box((cx, cy, cz), (0.27, 0.15, 0.05), 'steel', 'gun', bev=0.008, M=M)
# ---------------------------------------------------------------- the light and heavy tanks (metres, forward -Y)
def model_light():
    k = Kit(2)
    k.prism([(-2.45, 0.45), (-2.6, 0.75), (-2.05, 1.25), (2.3, 1.25), (2.5, 1.0), (2.4, 0.45)], -0.95, 0.95, 'olive', bev=0.03)
    k.box((0, -0.05, 1.22), (2.7, 4.95, 0.07), 'olive', bev=0.015)
    for sx in (-1, 1): track_side(k, sx, 0.95, 1.33, -2.55, 2.45, 0.08, 0.95, 5, 0.36)
    k.box((0, 1.9, 1.28), (1.6, 0.9, 0.05), 'dark', bev=0.0); k.box((0.6, -1.7, 1.27), (0.5, 0.6, 0.06), 'olive', bev=0.01)
    for sx in (-1, 1): k.lathe([(0.0, 0.0), (0.09, 0.0), (0.09, 0.05), (0.0, 0.06)], T(sx * 0.9, -2.35, 1.0) @ Rx(90), 10, 'bright')
    for sx in (-1, 1): exhaust(k, sx * 0.55, 2.35, 0.95, 0.06, 0.25)
    k.box((-0.75, 2.2, 1.3), (0.12, 0.7, 0.05), 'wood', bev=0.005)
    TP = Vector((0, 0.55, 1.25))
    k.prism([(-0.85 + 0.55, 1.28), (-0.98 + 0.55, 1.55), (-0.72 + 0.55, 1.97), (0.8 + 0.55, 1.97), (0.98 + 0.55, 1.5), (0.88 + 0.55, 1.28)], -0.76, 0.76, 'olive', 'mag', bev=0.025)
    k.lathe([(0.0, 0.0), (0.26, 0.0), (0.26, 0.14), (0.2, 0.18), (0.0, 0.19)], T(0.3, 0.85, 1.97) @ Rx(90), 14, 'olive', 'mag')
    k.box((-0.35, 0.95, 2.0), (0.45, 0.5, 0.05), 'olive', 'mag', bev=0.01); k.box((0.0, 1.55, 1.75), (1.2, 0.35, 0.35), 'olive', 'mag', bev=0.02)
    for sx in (-1, 1): k.box((sx * 0.4, -0.3, 1.86), (0.12, 0.05, 0.05), 'dark', 'mag', bev=0.0)
    stowage(k, (0, 1.855, 1.78), 0.13, 1.0, 'mag', (-2.6, 0.75), (-2.05, 1.25), 0.6)
    TR = Vector((0, -0.42, 1.62))
    k.box((0, -0.5, 1.62), (0.42, 0.2, 0.34), 'olive', 'bolt', bev=0.02)
    gun_tube(k, [(0.085, -0.4), (0.085, -0.95), (0.056, -1.0), (0.056, -3.9), (0.07, -3.92), (0.07, -4.08), (0.04, -4.08), (0.04, -0.4)], T(0, 0, 1.62), 14, r_in=0.04)
    return k, TP, TR
def model_heavy():
    k = Kit(2)
    k.prism([(-3.6, 0.5), (-3.8, 0.9), (-3.0, 1.9), (3.5, 1.9), (3.7, 1.5), (3.6, 0.5)], -1.2, 1.2, 'olive', bev=0.04)
    k.box((0, -0.05, 1.88), (3.6, 7.3, 0.08), 'olive', bev=0.02)
    for sx in (-1, 1):
        track_side(k, sx, 1.2, 1.72, -3.7, 3.6, 0.1, 1.1, 7, 0.4)
        for i in range(4): k.box((sx * 1.8, -2.75 + i * 1.6, 1.0), (0.05, 1.55, 0.85), 'olive', bev=0.012)
    for i in range(3): k.box((0, 2.4 + i * 0.35, 1.94), (2.2, 0.22, 0.04), 'dark', bev=0.0)
    for sx in (-1, 1):
        k.lathe([(0.0, 0.0), (0.12, 0.0), (0.12, 0.06), (0.0, 0.07)], T(sx * 1.0, -3.55, 1.4) @ Rx(90), 10, 'bright')
        k.box((sx * 1.45, -3.0, 1.97), (0.3, 1.0, 0.1), 'wood', bev=0.01)
        exhaust(k, sx * 0.75, 3.5, 1.55, 0.08, 0.26)
    TP = Vector((0, 0.3, 1.95))
    k.prism([(-1.6 + 0.3, 1.98), (-1.78 + 0.3, 2.42), (-1.5 + 0.3, 2.95), (1.72 + 0.3, 2.95), (1.95 + 0.3, 2.3), (1.75 + 0.3, 1.98)], -1.45, 1.45, 'olive', 'mag', bev=0.04)
    k.box((0, 2.35, 2.45), (2.4, 0.6, 0.75), 'olive', 'mag', bev=0.03)
    k.lathe([(0.0, 0.0), (0.33, 0.0), (0.33, 0.06), (0.25, 0.1), (0.0, 0.11)], T(0.55, 0.9, 2.95) @ Rx(90), 16, 'olive', 'mag')
    k.box((-0.55, 0.6, 2.98), (0.6, 0.7, 0.06), 'olive', 'mag', bev=0.01)
    for sx in (-1, 1):
        for i in range(3): k.lathe([(0.05, 0.0), (0.05, 0.25), (0.0, 0.26)], T(sx * 1.3, -0.6 + i * 0.12, 2.75) @ Rx(-60) @ Rz(sx * 20), 8, 'steel', 'mag')
    for sx in (-1, 1): k.box((sx * 0.55, -1.15, 2.7), (0.18, 0.05, 0.06), 'dark', 'mag', bev=0.0)
    stowage(k, (0, 2.82, 2.62), 0.17, 1.8, 'mag', (-3.8, 0.9), (-3.0, 1.9), 0.55)
    TR = Vector((0, -1.75, 2.42))
    k.box((0, -1.95, 2.42), (1.1, 0.36, 0.72), 'olive', 'bolt', bev=0.04)
    gun_tube(k, [(0.17, -1.9), (0.17, -2.7), (0.115, -2.8), (0.115, -4.0), (0.155, -4.15), (0.155, -4.6), (0.115, -4.75), (0.115, -6.25), (0.06, -6.25), (0.06, -1.9)],
             T(0, 0, 2.42), 16, r_in=0.06)
    k.box((0, -6.42, 2.42), (0.4, 0.34, 0.3), 'olive', 'bolt', bev=0.02)
    bore_disc(k, T(0, 0, 2.42), -6.592, 0.075)
    for i in range(2):
        for sx in (-1, 1): k.box((sx * 0.2, -6.36 - i * 0.14, 2.42), (0.02, 0.07, 0.2), 'dark', 'bolt', bev=0.0)
    return k, TP, TR

# ---------------------------------------------------------------- building one vehicle
GEAR_V = 0.3     # gear islands get the bottom 30 % of the picture, paint the rest (seen far off, the small mip levels must not mix them)
def split_uv(ob, margin=0.006):
    """smart UV projection done twice, paint faces and gear faces apart, then paint moved to v GEAR_V..1 and gear to 0..GEAR_V"""
    me = ob.data
    if not me.uv_layers: me.uv_layers.new(name='UVMap')
    vl = bpy.context.view_layer
    for o in list(vl.objects):
        if o is not None: o.select_set(False)
    vl.objects.active = ob; ob.select_set(True)
    cl = np.empty(len(me.polygons), np.int64); me.attributes['cls'].data.foreach_get('value', cl); gear = cl != PAINT
    for want in (False, True):
        me.polygons.foreach_set('select', (gear == want).tolist()); me.update()
        if not (gear == want).any(): continue
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=margin); bpy.ops.object.mode_set(mode='OBJECT')
    uv = np.empty(len(me.loops) * 2, np.float32); me.uv_layers['UVMap'].data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
    lp = np.empty(len(me.loops), np.int64)
    for p in me.polygons: lp[p.loop_start:p.loop_start + p.loop_total] = p.index
    g = gear[lp]; uv[:, 1] = np.where(g, uv[:, 1] * GEAR_V, GEAR_V + uv[:, 1] * (1 - GEAR_V))
    me.uv_layers['UVMap'].data.foreach_set('uv', uv.ravel()); me.polygons.foreach_set('select', [False] * len(me.polygons)); me.update()
def gear_material(mat):
    """the `<name>_gear` twin of a paint material: same picture, never tinted by the game"""
    g = bpy.data.materials.get(mat.name + '_gear')
    if g: bpy.data.materials.remove(g)
    g = mat.copy(); g.name = mat.name + '_gear'
    bs = next(n for n in g.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')      # not metal: the game's specular follows the material colour, not the picture
    bs.inputs['Roughness'].default_value = 0.9; bs.inputs['Metallic'].default_value = 0.0
    return g
def split_by_class(me, mat, gmat):
    me.materials.clear(); me.materials.append(mat); me.materials.append(gmat)
    cl = np.empty(len(me.polygons), np.int64); me.attributes['cls'].data.foreach_get('value', cl)
    me.polygons.foreach_set('material_index', (cl != PAINT).astype(np.int32)); me.update()
def make_tank(prefix, model, col, N=1024):
    """Kit model -> <prefix>_hull > _turret > _barrel (+ _lod1 twins), picture <prefix>_tank, materials <prefix>_tank and <prefix>_tank_gear"""
    k, TP, TR = model()
    me = bpy.data.meshes.new(prefix + '_all'); k.bm.to_mesh(me); k.bm.free()
    ob = bpy.data.objects.new(prefix + '_all', me); col.objects.link(ob); split_uv(ob)
    img = tank_texture(ob, N, prefix + '_tank'); mat = image_material(prefix + '_tank', img, 0.7, 0.3); gmat = gear_material(mat)
    g = np.empty(len(me.vertices), np.int64); me.attributes['grp'].data.foreach_get('value', g)
    parts = {}
    for part, gi, pivot in (('hull', GRP.index('gun'), Vector((0, 0, 0))), ('turret', GRP.index('mag'), TP), ('barrel', GRP.index('bolt'), TR)):
        if not (g == gi).any(): continue          # a vehicle without a turret or gun (the truck)
        b2 = bmesh.new(); b2.from_mesh(me); b2.verts.ensure_lookup_table()
        bmesh.ops.delete(b2, geom=[v for v in b2.verts if g[v.index] != gi], context='VERTS')
        bmesh.ops.translate(b2, verts=b2.verts[:], vec=-pivot)
        pm = bpy.data.meshes.new('%s_%s' % (prefix, part)); b2.to_mesh(pm); b2.free(); split_by_class(pm, mat, gmat)
        po = bpy.data.objects.new('%s_%s' % (prefix, part), pm); col.objects.link(po); parts[part] = (po, pivot)
        lo = bpy.data.objects.new('%s_%s_lod1' % (prefix, part), pm.copy()); col.objects.link(lo); lo.data.name = lo.name
        dm = lo.modifiers.new('d', 'DECIMATE'); dm.ratio = 0.2
        dg = bpy.context.evaluated_depsgraph_get(); lme = bpy.data.meshes.new_from_object(lo.evaluated_get(dg)); lo.modifiers.clear(); old = lo.data; lo.data = lme; bpy.data.meshes.remove(old)
        lme.name = lo.name; parts[part + '_lod1'] = (lo, pivot)
    hull = parts['hull'][0]; turret = parts.get('turret', (None,))[0]; barrel = parts.get('barrel', (None,))[0]
    if turret: turret.parent = hull; turret.location = TP
    if barrel: barrel.parent = turret or hull; barrel.location = TR - (TP if turret else Vector())
    for part in [p for p in ('hull', 'turret', 'barrel') if p in parts]:
        lo = parts[part + '_lod1'][0]; lo.parent = parts[part][0]; lo.location = (0, 0, 0)
    bpy.data.objects.remove(ob, do_unlink=True); bpy.data.meshes.remove(me)
    muzzle = (TR + Vector((0, min(v.co.y for v in barrel.data.vertices), 0))) if barrel else None
    hv = [v.co for v in hull.data.vertices]; top = max(v.z for v in hv)
    if turret: top = max([top] + [v.co.z + TP.z for v in turret.data.vertices])
    gear = sum(sum(1 for f in parts[p][0].data.polygons if f.material_index == 1) for p in ('hull', 'turret', 'barrel') if p in parts)
    info = {'tris': {p: sum(len(f.vertices) - 2 for f in parts[p][0].data.polygons) for p in parts}, 'muzzle': tuple(round(x, 3) for x in muzzle) if muzzle else None,
            'half_width': round(max(abs(v.x) for v in hv), 3), 'half_length': round(max(abs(v.y) for v in hv), 3), 'height': round(top, 3),
            'turret_pivot': tuple(round(x, 3) for x in TP) if turret else None, 'trunnion': tuple(round(x, 3) for x in TR) if barrel else None, 'gear_faces': gear}
    log(prefix, info)
    return info

# ---------------------------------------------------------------- the medium tank (the range's), split and repainted
def _islands(me):
    bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table(); seen = np.zeros(len(bm.faces), bool); out = []
    for f in bm.faces:
        if seen[f.index]: continue
        st = [f]; comp = []; seen[f.index] = True
        while st:
            g = st.pop(); comp.append(g.index)
            for e in g.edges:
                for h in e.link_faces:
                    if not seen[h.index]: seen[h.index] = True; st.append(h)
        P = np.array([v.co[:] for i in comp for v in bm.faces[i].verts]); out.append((comp, P.min(0), P.max(0), np.abs(P[:, 0]).min()))
    bm.free(); return out
def medium_codes(me):
    """per face: 0 paint, else the gear kind (1 tracks, 3 dark metal, 4 glass, 5 stowage, 6 wheels)"""
    part = np.empty(len(me.polygons), np.float32); me.attributes['part'].data.foreach_get('value', part); code = np.rint(part).astype(np.int64)
    for comp, lo, hi, axmin in _islands(me):
        if axmin > 1.1 and hi[2] < 0.95 and hi[1] - lo[1] < 0.85 and hi[2] - lo[2] > 0.2:
            for i in comp:
                if code[i] == 0: code[i] = 6
    return code
MED_PAL = {1: (0.1, 0.1, 0.095), 3: (0.24, 0.24, 0.23), 4: (0.07, 0.08, 0.10), 5: (0.40, 0.36, 0.27), 6: (0.22, 0.22, 0.21)}
def medium_texture(objs, N=1024):
    """repaint the range tank's picture like the light and heavy: neutral grey-green paint (panel lines, wear on edges, dirt, AO),
    gear in its own colours, keeping the old picture's light/dark detail (hatches, bolts) as a multiplier"""
    old = objs[0].data.materials[0].node_tree.nodes; img = next(n.image for n in old if n.type == 'TEX_IMAGE' and n.image)
    o = np.array(img.pixels[:], np.float32).reshape(img.size[1], img.size[0], 4)[:, :, :3]
    if o.shape[0] != N:
        idx = (np.arange(N) * o.shape[0] / N).astype(int); o = o[idx][:, (np.arange(N) * o.shape[1] / N).astype(int)]
    lum = o @ np.array((0.3, 0.59, 0.11), np.float32); lum = lum / max(float(np.median(lum[lum > 0.02])), 1e-3)
    P3, N3, UV, CV, CD = [], [], [], [], []; allv, allf = [], []
    for oi, ob in enumerate(objs):
        me = ob.data; mw = ob.matrix_world; me.calc_loop_triangles(); nt = len(me.loop_triangles)
        tl = np.empty(nt * 3, np.int64); me.loop_triangles.foreach_get('loops', tl); tl = tl.reshape(-1, 3)
        tp = np.empty(nt, np.int64); me.loop_triangles.foreach_get('polygon_index', tp)
        lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get('vertex_index', lv)
        co = np.array([mw @ v.co for v in me.vertices], np.float32); vn = np.array([(mw.to_3x3() @ v.normal).normalized() for v in me.vertices], np.float32)
        uv = np.empty(len(me.loops) * 2, np.float32); me.uv_layers[0].data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
        a, b, c = co[lv[tl[:, 0]]], co[lv[tl[:, 1]]], co[lv[tl[:, 2]]]
        nb = np.zeros_like(co); cnt = np.zeros(len(co))
        for k in range(3):
            for j in range(3):
                if j != k: np.add.at(nb, lv[tl[:, k]], co[lv[tl[:, j]]]); np.add.at(cnt, lv[tl[:, k]], 1)
        cvx = ((co - nb / np.maximum(cnt, 1)[:, None]) * vn).sum(1) / 0.02
        code = medium_codes(me)
        P3.append(co[lv[tl]]); N3.append(vn[lv[tl]]); UV.append(uv[tl]); CV.append(np.clip(cvx, -1, 1)[lv[tl]][..., None].astype(np.float32))
        CD.append(np.repeat((code[tp] + 10 * oi).astype(np.float32)[:, None, None], 3, 1))       # gear code + 10 x part (0 hull, 1 turret, 2 gun)
        base = len(allv); allv += [Vector(v) for v in co]; allf += [[base + i for i in p.vertices] for p in me.polygons]
    mask, (Pi, Ni, Ci, Di) = raster(np.concatenate(UV), [np.concatenate(P3), np.concatenate(N3), np.concatenate(CV), np.concatenate(CD)], N)
    bvh = BVHTree.FromPolygons(allv, allf); rng = np.random.default_rng(4); NR = 12; u1, u2 = rng.random(NR), rng.random(NR)
    dirs = np.stack([np.sqrt(u1) * np.cos(2 * np.pi * u2), np.sqrt(u1) * np.sin(2 * np.pi * u2), np.sqrt(1 - u1)], 1)
    aoh = np.ones((N, N), np.float32); sub = mask.copy(); sub[1::2, :] = False; sub[:, 1::2] = False
    for yy, xx in zip(*np.nonzero(sub)):
        n = Vector(Ni[yy, xx])
        if n.length < 1e-6: continue
        n.normalize(); t = n.orthogonal().normalized(); b2 = n.cross(t); oo = Vector(Pi[yy, xx]) + n * 0.004; occ = 0.0
        for dd in dirs:
            hh = bvh.ray_cast(oo, t * dd[0] + b2 * dd[1] + n * dd[2], 0.6)
            if hh[0] is not None: occ += 1 - hh[3] / 0.6
        aoh[yy, xx] = 1 - occ / NR
    ao = aoh.copy(); ys, xs = np.nonzero(mask & ~sub); ao[ys, xs] = aoh[(ys // 2) * 2, (xs // 2) * 2]
    ao = 0.25 * (ao + np.roll(ao, 1, 0) + np.roll(ao, 1, 1) + np.roll(np.roll(ao, 1, 0), 1, 1))
    idx = np.nonzero(mask); P = Pi[idx]; C = Ci[idx][:, 0]; D = np.rint(Di[idx][:, 0]).astype(int); OB = D // 10; D = D % 10; paint = D == 0
    Nn = Ni[idx]; Nn = Nn / np.maximum(np.linalg.norm(Nn, axis=1), 1e-6)[:, None]
    grain = fbm(P, 0.03, 3); mott = fbm(P, 0.6, 9); streak = vnoise(P * np.array((1, 1, 0.12), np.float32), 0.05, 31)
    base = np.array([MED_PAL.get(d, TANK_BASE) for d in D], np.float32)
    col_ = base * (0.92 + 0.16 * grain[:, None]) * (0.92 + 0.16 * mott[:, None])
    col_[paint] *= (0.9 + 0.12 * streak[paint])[:, None]
    col_ *= np.clip(0.55 + 0.45 * lum[idx], 0.35, 1.35)[:, None] ** np.where(paint, 1.0, 0.5)[:, None]
    decorate(col_, P, Nn, paint, OB == 1, D == 1, np.clip(C, 0, 1) > 0.5, 'tank', mott, streak)
    panel = (np.abs(np.mod(P[:, 1] + 0.37, 0.9) - 0.45) < 0.008) | (np.abs(np.mod(P[:, 0] + 0.21, 1.1) - 0.55) < 0.008); col_[panel & paint] *= 0.62
    wear = np.clip(C, 0, 1) * (0.5 + 0.3 * grain) * ((D == 0) | (D == 6) | (D == 3)); col_ = col_ * (1 - wear[:, None]) + np.array((0.62, 0.61, 0.58), np.float32) * wear[:, None]
    col_ *= (0.35 + 0.65 * np.clip(ao[idx], 0, 1) ** 1.3)[:, None]
    out = o.copy() * 0 + np.array(TANK_BASE, np.float32) * 0.6; out[idx] = np.clip(col_, 0.04, 1)
    filled = mask.copy()
    for it in range(6):
        acc = np.zeros_like(out); cnt = np.zeros((N, N), np.float32)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            acc += np.roll(np.roll(out * filled[..., None], dy, 0), dx, 1); cnt += np.roll(np.roll(filled, dy, 0), dx, 1)
        new = (~filled) & (cnt > 0); out[new] = acc[new] / cnt[new][:, None]; filled |= new
    im = save_image(out, 'tank', TEXDIR)
    for m in (bpy.data.materials.get('tank'), bpy.data.materials.get('tank_gear')):
        if m:
            for n in m.node_tree.nodes:
                if n.type == 'TEX_IMAGE': n.image = im
    log('medium tank repainted', int(mask.sum()), 'texels')
def medium_tank(col):
    with bpy.data.libraries.load(os.path.join(PROOF, 'range.blend'), link=False) as (src, dst):
        dst.objects = ['tank_hull', 'tank_turret', 'tank_barrel', 'tank_hull_lod1', 'tank_turret_lod1', 'tank_barrel_lod1']
    for o in dst.objects: col.objects.link(o)
    shutil.copy(os.path.join(PROOF, 'tex', 'tank.png'), os.path.join(TEXDIR, 'tank.png'))
    mat = dst.objects[0].data.materials[0]; mat.name = 'tank'
    for n in mat.node_tree.nodes:
        if n.type == 'TEX_IMAGE' and n.image: n.image.filepath = os.path.join(TEXDIR, 'tank.png'); n.image.reload()
    gmat = gear_material(mat)
    for o in dst.objects:                     # paint / gear split (the lod1 twins have the same parts and islands)
        me = o.data; code = medium_codes(me); me.materials.clear(); me.materials.append(mat); me.materials.append(gmat)
        me.polygons.foreach_set('material_index', (code != 0).astype(np.int32)); me.update()
    bpy.context.view_layer.update(); hull = bpy.data.objects['tank_hull']; bar = bpy.data.objects['tank_barrel']
    mw = bar.matrix_world
    far = min(((mw @ v.co) for v in bar.data.vertices), key=lambda p: p.y)
    hv = [hull.matrix_world @ v.co for v in hull.data.vertices]
    gear = sum(sum(1 for f in bpy.data.objects[n].data.polygons if f.material_index == 1) for n in ('tank_hull', 'tank_turret', 'tank_barrel'))
    info = {'muzzle': tuple(round(x, 3) for x in (0.0, far.y, mw.translation.z)), 'turret_pivot': tuple(round(x, 3) for x in bpy.data.objects['tank_turret'].matrix_world.translation), 'trunnion': tuple(round(x, 3) for x in mw.translation), 'half_width': round(max(abs(v.x) for v in hv), 3), 'half_length': round(max(abs(v.y) for v in hv), 3), 'gear_faces': gear}
    log('tank (medium)', info); return info

# ---------------------------------------------------------------- the three tanks in a battlefield file
TANK_PARTS = [p for n in ('tank', 'light', 'heavy') for p in (n + '_hull', n + '_turret', n + '_barrel', n + '_hull_lod1', n + '_turret_lod1', n + '_barrel_lod1')]
def drop_tanks():
    """remove the three tanks (collections tank / light / heavy) and whatever only they used"""
    for name in ('tank', 'light', 'heavy'):
        c = bpy.data.collections.get(name)
        if c:
            for ob in list(c.objects): bpy.data.objects.remove(ob, do_unlink=True)
            bpy.data.collections.remove(c)
    for ob in list(bpy.data.objects):
        if ob.name in TANK_PARTS or ob.name.split('.')[0] in TANK_PARTS: bpy.data.objects.remove(ob, do_unlink=True)
    for coll_ in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for d in list(coll_):
            if d.users == 0 and d.name.split('.')[0].split('_')[0] in ('tank', 'light', 'heavy'): coll_.remove(d)
def build_tanks(scene):
    """the medium, light and heavy tanks, each in its own collection; returns their measurements"""
    def coll(name):
        c = bpy.data.collections.new(name); scene.collection.children.link(c); return c
    TK = {}
    for name, fn in (('tank', None), ('light', model_light), ('heavy', model_heavy)):
        c = coll(name); TK[name] = medium_tank(c) if fn is None else make_tank(name, fn, c)
        if fn is None: medium_texture([bpy.data.objects['tank_hull'], bpy.data.objects['tank_turret'], bpy.data.objects['tank_barrel']])
    return TK
