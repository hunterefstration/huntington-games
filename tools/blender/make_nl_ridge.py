# NIGHTLINE circuit 3 "MOONRIDGE PASS": a mountain pass at night after rain, under a big moon, built round art/nightline/ridge.track.json (the fixed road).
#   "C:/Program Files/Blender Foundation/Blender 4.5/blender.exe" -b --factory-startup -P tools/blender/make_nl_ridge.py -- [samples=48] [nobake] [lm=4096] [moon=3.0]
# then  node tools/export-art.mjs ridge   ->  Nightline/assets/ridge.hgm (+ pictures).   Same pipeline as the other two circuits (make_nl_quay.py, make_nl_skyway.py):
# one mesh, tiling pictures, packed 'Lightmap' UV, a Cycles bake of the light (moon, lanterns, windows, sky) into art/nightline/tex/ridge_light.exr.
# Axes: game (x, y, z) -> Blender (x, -z, y). The mountain is a heightfield (terrain_z) that the road is cut into: vertices inside the road corridor are snapped onto the
# verge's outer edge, so the ground meets the road exactly; cut and fill slopes are clamps round every road sample (bridge: a ravine, tunnel: a roof of rock).
# Self-lit pictures (signs, waterfall, the city far below, pines): the hgm has no unlit textures, so those faces point their Lightmap UV at a patch of the light
# picture that is painted a fixed brightness after the bake (colour picture x that light = the picture, glowing).

import bpy, bmesh, math, os, sys, json, random, time
import numpy as np
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hgkit import log, save_image, image_material
import ash_paint, mapkit


ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OPT = dict((a.split('=', 1) + ['1'])[:2] for a in ARGV)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = os.path.join(ROOT, 'art', 'nightline'); TEXDIR = os.path.join(BASE, 'tex'); CACHE = os.path.join(BASE, '_cache')
for d in (TEXDIR, CACHE): os.makedirs(d, exist_ok=True)
scene = bpy.context.scene
if not bpy.data.filepath.replace('\\', '/').endswith('art/nightline/ridge.blend'):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, 'ridge.blend')); log('created', bpy.data.filepath)
for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
for c in list(bpy.data.collections): bpy.data.collections.remove(c)
for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras, bpy.data.images):
    for d in list(coll):
        if d.users == 0: coll.remove(d)

rng = random.Random(11)
LMSIZE = int(OPT.get('lm', 4096))

# ---------------------------------------------------------------- the road: samples in Blender axes
trk = json.load(open(os.path.join(BASE, 'ridge.track.json')))
S = np.array(trk['s'], float); N = len(S)
C = np.stack([S[:, 0], -S[:, 2], S[:, 1]], 1)            # centre (x, y, z)
TG = np.stack([S[:, 3], -S[:, 4]], 1)                    # driving direction on the ground
LF = np.stack([S[:, 4], S[:, 3]], 1)                     # the driver's left
BK = S[:, 5]                                             # positive: down toward the left
_seg = np.hypot(*np.diff(np.vstack([C, C[:1]])[:, :2], axis=0).T); SC = np.concatenate([[0.0], np.cumsum(_seg)]); LEN = float(SC[-1]); STEP = LEN / N
PSI = np.arctan2(TG[:, 1], TG[:, 0])
def _wrap(a): return (a + math.pi) % (2 * math.pi) - math.pi
KAP = np.array([_wrap(PSI[(i + 3) % N] - PSI[(i - 3) % N]) / (6 * STEP) for i in range(N)])      # + = left turn
def SCu(i): return SC[i % N] + LEN * (i // N)
def P(i, d, dz=0.0):
    i0 = i % N; return Vector((C[i0, 0] + LF[i0, 0] * d, C[i0, 1] + LF[i0, 1] * d, C[i0, 2] - d * BK[i0] + dz))
def PA(i, d, z):
    i0 = i % N; return Vector((C[i0, 0] + LF[i0, 0] * d, C[i0, 1] + LF[i0, 1] * d, z))
def Pf(sv, d, dz=0.0):
    i0 = int(math.floor(sv)); f = sv - i0; return P(i0, d, dz) * (1 - f) + P(i0 + 1, d, dz) * f
def TGv(i): return Vector((TG[i % N, 0], TG[i % N, 1], 0.0))
def LFv(i): return Vector((LF[i % N, 0], LF[i % N, 1], 0.0))
UP = Vector((0, 0, 1))


IB0, IB1 = int(trk['marks']['bridge'][0] * N), int(trk['marks']['bridge'][1] * N)
IT0, IT1 = int(trk['marks']['tunnel'][0] * N), int(trk['marks']['tunnel'][1] * N)
def BRIDGE(i): return IB0 <= i % N < IB1
def TUNNEL(i): return IT0 <= i % N < IT1
def plain(i, m=4): return not any(BRIDGE(i + j) or TUNNEL(i + j) for j in range(-m, m + 1))
def RIGHT(n): return UP.cross(n)
def smooth(a, b, x):
    t = np.clip((np.asarray(x, np.float64) - a) / (b - a), 0.0, 1.0); return t * t * (3 - 2 * t)
ISB = np.array([BRIDGE(i) for i in range(N)]); IST = np.array([TUNNEL(i) for i in range(N)]); NORM = ~(ISB | IST)
SUMMIT = int(np.argmax(C[:, 2]))
log('track', N, 'samples, length %.0f m, bridge %d..%d tunnel %d..%d, summit sample %d (z %.1f)' % (LEN, IB0, IB1, IT0, IT1, SUMMIT, C[SUMMIT, 2]))


# ---------------------------------------------------------------- colours and the pictures (all painted here; values are sRGB, as seen)
COL = {'amber': (1.0, 0.62, 0.10), 'red': (1.0, 0.08, 0.06), 'ice': (0.82, 0.93, 1.0), 'warm': (1.0, 0.55, 0.22), 'win': (1.0, 0.66, 0.32),
       'cyan': (0.10, 0.85, 1.0), 'green': (0.20, 1.0, 0.35), 'wcool': (0.72, 0.86, 1.0)}
EMIT_K = {'amber': 3.5, 'red': 4.0, 'ice': 3.0, 'warm': 3.2, 'win': 1.5, 'cyan': 4.0, 'green': 3.5, 'wcool': 2.2}

def tn(H, W, cx, cy, seed):
    """tileable value noise 0..1, cx x cy random cells"""
    cx = max(1, int(cx)); cy = max(1, int(cy))
    r = np.random.default_rng(seed).random((cy, cx)).astype(np.float32)
    ys = np.arange(H, dtype=np.float32) * cy / H; xs = np.arange(W, dtype=np.float32) * cx / W
    y0 = np.floor(ys).astype(int); x0 = np.floor(xs).astype(int); fy = ys - y0; fx = xs - x0; fy = fy * fy * (3 - 2 * fy); fx = fx * fx * (3 - 2 * fx)
    y1 = (y0 + 1) % cy; x1 = (x0 + 1) % cx; y0 %= cy; x0 %= cx
    a = r[y0][:, x0] * (1 - fx)[None, :] + r[y0][:, x1] * fx[None, :]; b = r[y1][:, x0] * (1 - fx)[None, :] + r[y1][:, x1] * fx[None, :]
    return (a * (1 - fy)[:, None] + b * fy[:, None]).astype(np.float32)
def fbm_t(H, W, c, seed, oct=4):
    o = np.zeros((H, W), np.float32); amp = 1.0; tot = 0.0
    for k in range(oct): o += amp * tn(H, W, c * 2 ** k, c * 2 ** k * H / W, seed + k * 7); tot += amp; amp *= 0.5
    return o / tot
def blur(a, r):
    k = int(r)
    if k < 1: return a
    for ax in (0, 1):
        for _ in range(2):
            n = a.shape[ax]; pad = [(k + 1, k) if i == ax else (0, 0) for i in range(a.ndim)]
            cs = np.cumsum(np.pad(a, pad, mode='wrap'), axis=ax)
            sl = lambda lo, hi: tuple(slice(lo, hi) if i == ax else slice(None) for i in range(a.ndim))
            a = (cs[sl(2 * k + 1, 2 * k + 1 + n)] - cs[sl(0, n)]) / (2 * k + 1)
    return a
def mix(a, b, t): return a + (b - a) * t[..., None]
def v3(*c): return np.array(c, np.float32)
def grain(H, W, amt, seed): return (np.random.default_rng(seed).random((H, W)).astype(np.float32) - 0.5) * amt



def concrete_pixels(N=1024, base=(0.46, 0.47, 0.51), seed=70):
    y, x = np.mgrid[0:N, 0:N].astype(np.float32); um = x / N * 3.0; vm = y / N * 3.0
    n1 = fbm_t(N, N, 4, seed); fine = grain(N, N, 0.06, seed + 1)
    a = v3(*base) * (0.75 + 0.5 * n1)[..., None] + fine[..., None]
    a[(np.abs(um % 1.5) < 0.012) | (np.abs(vm % 1.5) < 0.012)] *= 0.55
    st = np.clip((tn(N, N, 30, 3, seed + 3) - 0.5) * 3, 0, 1)[..., None]; a = a * (1 - 0.35 * st)
    return np.clip(a, 0.01, 1)
def tunnel_pixels(N=1024):
    y, x = np.mgrid[0:N, 0:N].astype(np.float32); um = x / N * 2.0; vm = y / N * 2.0
    a = v3(0.60, 0.58, 0.52) * (0.8 + 0.3 * fbm_t(N, N, 5, 81))[..., None] + grain(N, N, 0.05, 82)[..., None]
    a[(np.minimum(um % 0.3, 0.3 - um % 0.3) < 0.01) | (np.minimum(vm % 0.3, 0.3 - vm % 0.3) < 0.01)] *= 0.6
    a = a * (1 - 0.35 * np.clip((tn(N, N, 24, 3, 83) - 0.55) * 3, 0, 1))[..., None]
    return np.clip(a, 0.01, 1)


def metal_pixels(N=512):
    y, x = np.mgrid[0:N, 0:N].astype(np.float32)
    a = v3(0.50, 0.52, 0.56) * (0.75 + 0.4 * fbm_t(N, N, 4, 103))[..., None] + grain(N, N, 0.05, 104)[..., None]
    a[((x % 256) < 2) | ((y % 256) < 2)] *= 0.55; a = mix(a, v3(0.45, 0.2, 0.1), np.clip((tn(N, N, 9, 9, 105) - 0.62) * 3, 0, 1) * 0.5); return np.clip(a, 0.01, 1)


FONT = {
 'A': '.###.|#...#|#...#|#####|#...#|#...#|#...#', 'B': '####.|#...#|#...#|####.|#...#|#...#|####.', 'C': '.###.|#...#|#....|#....|#....|#...#|.###.',
 'D': '####.|#...#|#...#|#...#|#...#|#...#|####.', 'E': '#####|#....|#....|####.|#....|#....|#####', 'F': '#####|#....|#....|####.|#....|#....|#....',
 'G': '.###.|#...#|#....|#.###|#...#|#...#|.###.', 'H': '#...#|#...#|#...#|#####|#...#|#...#|#...#', 'I': '#####|..#..|..#..|..#..|..#..|..#..|#####',
 'J': '..###|...#.|...#.|...#.|...#.|#..#.|.##..', 'K': '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', 'L': '#....|#....|#....|#....|#....|#....|#####',
 'M': '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', 'N': '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#', 'O': '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
 'P': '####.|#...#|#...#|####.|#....|#....|#....', 'Q': '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', 'R': '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
 'S': '.####|#....|#....|.###.|....#|....#|####.', 'T': '#####|..#..|..#..|..#..|..#..|..#..|..#..', 'U': '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
 'V': '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..', 'W': '#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#', 'X': '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
 'Y': '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', 'Z': '#####|....#|...#.|..#..|.#...|#....|#####', ' ': '.....|.....|.....|.....|.....|.....|.....'}

def sign_atlas(W=2048, H=1024):
    """8 panels of 1024 x 256 (2 columns x 4 rows, row 0 at the bottom): dark board, dot-matrix word with a glow, a frame and a pattern"""
    out = np.zeros((H, W, 3), np.float32) + v3(0.01, 0.01, 0.015)
    for k, (word, cn) in enumerate(SIGNS):
        col = v3(*COL[cn]); cx, cy = k % 2, k // 2; x0, y0 = cx * 1024, cy * 256
        pan = np.zeros((256, 1024, 3), np.float32) + v3(0.012, 0.012, 0.02) + col * 0.045
        sc = int(min(15, (1024 * 0.78) // (6 * len(word)))); tw = 6 * len(word) * sc; th = 7 * sc; tx0 = (1024 - tw) // 2 + 20; ty0 = (256 - th) // 2
        mask = np.zeros((256, 1024), np.float32)
        for ci, ch in enumerate(word):
            rows = FONT[ch].split('|')
            for ry in range(7):
                for rx in range(5):
                    if rows[ry][rx] == '#':
                        px = tx0 + (ci * 6 + rx) * sc; py = ty0 + (6 - ry) * sc; mask[py + 1:py + sc - 1, px + 1:px + sc - 1] = 1.0
        glow = blur(mask, 10) * 0.9 + blur(mask, 3) * 0.5
        pan = pan + col[None, None, :] * glow[..., None] * 0.55 + (v3(1, 1, 1) * 0.55 + col * 0.45)[None, None, :] * mask[..., None]
        f = np.zeros((256, 1024), np.float32); f[6:12, 6:-6] = 1; f[-12:-6, 6:-6] = 1; f[6:-6, 6:12] = 1; f[6:-6, -12:-6] = 1; pan = pan + col * f[..., None] * 0.9
        yy, xx = np.mgrid[0:256, 0:1024]; sh = ((xx - 70) ** 2 + (yy - 128) ** 2 < 36 ** 2) & ((xx - 70) ** 2 + (yy - 128) ** 2 > 28 ** 2)
        pan[sh] = col; pan[(np.abs(xx - 960) < 14) & (yy > 60) & (yy < 196) & ((yy // 18) % 2 == 0)] = col
        out[y0:y0 + 256, x0:x0 + 1024] = np.clip(pan, 0, 1)
    return np.clip(out, 0, 1)


# ---------------------------------------------------------------- circuit 2 pictures: wet asphalt, glass towers, LED screens, green signs, car parks, the city far below

FONT.update({'0': '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.', '1': '..#..|.##..|..#..|..#..|..#..|..#..|.###.', '2': '.###.|#...#|....#|...#.|..#..|.#...|#####',
             '3': '####.|....#|....#|.###.|....#|....#|####.', '4': '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.', '5': '#####|#....|####.|....#|....#|#...#|.###.',
             '6': '.###.|#....|#....|####.|#...#|#...#|.###.', '7': '#####|....#|...#.|..#..|.#...|.#...|.#...', '8': '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
             '9': '.###.|#...#|#...#|.####|....#|....#|.###.'})


def road_pixels(W=2048, H=2048):
    """14 m across (u), 18 m along (v): plain wet dark asphalt, neutral, worn tyre lanes, white edge lines at +-6.6 m, centre dashes. No cracks, no coloured reflections."""
    y, x = np.mgrid[0:H, 0:W].astype(np.float32); um = (x + 0.5) / W * 14.0; vm = (y + 0.5) / H * 18.0
    n1 = fbm_t(H, W, 6, 3); n2 = tn(H, W, 64, 64, 5); fine = grain(H, W, 0.05, 7)
    a = v3(0.262, 0.270, 0.298) * (0.80 + 0.40 * n1)[..., None] + fine[..., None]
    lane = np.exp(-((np.abs(um - 7.0) - 1.9) ** 2) / 0.5) * 0.5; a = a * (1 - 0.16 * lane[..., None])
    pm = np.clip(blur((tn(H, W, 9, 9, 21) - 0.48) * 1.5, 12) + 0.5, 0, 1); a = a * (1 - 0.06 * pm[..., None])        # very soft damp patches, no outlines
    wear = np.clip((tn(H, W, 180, 180, 51) - 0.35) * 3, 0, 1)
    def line(mask, wearing=0.6):
        nonlocal a
        a = mix(a, v3(0.86, 0.86, 0.84) * (0.85 + 0.15 * n2[..., None]), mask * (1 - wearing * (1 - wear)))
    for c in (0.4, 13.6): line(np.clip((0.09 - np.abs(um - c)) / 0.012, 0, 1))
    dash = ((vm % 9.0) < 3.0).astype(np.float32); line(np.clip((0.075 - np.abs(um - 7.0)) / 0.012, 0, 1) * dash)
    return np.clip(a, 0.01, 1.0)
def water_pixels(N=1024):
    a = v3(0.025, 0.05, 0.095) * (0.6 + 0.8 * fbm_t(N, N, 12, 111))[..., None]
    st = np.clip((tn(N, N, 120, 6, 112) * 0.55 + tn(N, N, 50, 3, 113) * 0.45 - 0.46) * 4, 0, 1) * np.clip((tn(N, N, 5, 5, 114) - 0.3) * 3, 0, 1)
    return np.clip(a + v3(0.25, 0.40, 0.55) * (st * 0.10)[..., None], 0.005, 1)

def ground_pixels(N=1024, seed=190):
    """the city far below, 240 m per picture: a street grid (60 m blocks) as lines of small lights, traffic, a few lit plazas"""
    r = np.random.default_rng(seed); y, x = np.mgrid[0:N, 0:N].astype(np.float32); m = x / N * 240.0; n = y / N * 240.0
    a = np.zeros((N, N, 3), np.float32) + v3(0.012, 0.016, 0.026) + (0.012 * fbm_t(N, N, 6, 191))[..., None]
    for bi, bj in ((1, 2), (3, 0), (2, 3)):
        px0 = int((bi * 60 + 6) / 240 * N); px1 = int((bi * 60 + 54) / 240 * N); py0 = int((bj * 60 + 6) / 240 * N); py1 = int((bj * 60 + 54) / 240 * N)
        a[py0:py1, px0:px1] = v3(0.07, 0.09, 0.13)
        for gy in range(py0 + 6, py1 - 4, 26):
            for gx in range(px0 + 6, px1 - 4, 26): a[gy:gy + 5, gx:gx + 5] = v3(0.85, 0.92, 1.0) if r.random() < 0.6 else v3(1.0, 0.75, 0.4)
    for axis in (0, 1):
        u = m if axis == 0 else n; w_ = n if axis == 0 else m
        d = np.minimum(u % 60, 60 - u % 60); st = d < 6; a = np.where(st[..., None], v3(0.026, 0.030, 0.042) * (0.9 + 0.3 * fbm_t(N, N, 20, 195 + axis))[..., None], a)
        idx = (u // 60 + 0.5 + (u % 60 > 30)).astype(int) % 2
        lamp = (np.abs(d - 5.0) < 0.6) & ((w_ % 6.0) < 1.2); col = np.where((idx == 0)[..., None], v3(1.0, 0.62, 0.25), v3(0.80, 0.90, 1.0)); a = np.where(lamp[..., None], col * 0.9, a)
    for _ in range(260):
        axis = int(r.integers(2)); line_ = int(r.integers(4)) * 60 / 240 * N; pos = int(r.random() * N); off = int((r.random() - 0.5) * 8 / 240 * N); col = v3(1.0, 0.08, 0.06) if r.random() < 0.5 else v3(0.9, 0.95, 1.0)
        yq, xq = (pos, int(line_) + off) if axis == 0 else (int(line_) + off, pos)
        yq = int(np.clip(yq, 1, N - 4)); xq = int(np.clip(xq, 1, N - 4)); a[yq:yq + 3, xq:xq + 3] = col * 0.9
    return np.clip(a, 0.005, 1)


# ---------------------------------------------------------------- circuit 3 pictures: rock, wet grass, scree, snow, pine, wood, slate, plaster, masonry, waterfall
SIGNS = [('GASTHOF', 'amber'), ('MOONRIDGE', 'ice'), ('HOTEL', 'red'), ('BERGBAHN', 'cyan'), ('ADLER', 'amber'), ('PASS', 'ice'), ('START', 'green'), ('NIGHTLINE', 'red')]
def hash2(a, seed): return (np.random.default_rng(seed).random(a).astype(np.float32))
def rock_pixels(N=1024):
    y, x = np.mgrid[0:N, 0:N].astype(np.float32); f = fbm_t(N, N, 4, 121); f2 = fbm_t(N, N, 12, 122)
    strata = 0.5 + 0.5 * np.sin(y / N * 2 * np.pi * 11 + 5.0 * f)
    a = mix(np.zeros((N, N, 3), np.float32) + v3(0.13, 0.145, 0.18), np.zeros((N, N, 3), np.float32) + v3(0.30, 0.31, 0.335), np.clip(0.35 * strata + 0.65 * f2, 0, 1))
    r = fbm_t(N, N, 7, 123); crack = np.clip(1 - np.abs(r - 0.5) / 0.02, 0, 1); a = a * (1 - 0.65 * crack[..., None])
    c2 = np.clip(1 - np.abs(fbm_t(N, N, 16, 124) - 0.5) / 0.015, 0, 1); a = a * (1 - 0.45 * c2[..., None])
    wet = np.clip((fbm_t(N, N, 3, 125) - 0.55) * 4, 0, 1); a = a * (1 - 0.25 * wet[..., None]) + grain(N, N, 0.05, 126)[..., None]
    return np.clip(a, 0.01, 1)
def grass_pixels(N=1024):
    f = fbm_t(N, N, 8, 131); g = np.clip((tn(N, N, 110, 110, 132) - 0.35) * 2.2, 0, 1)
    a = v3(0.045, 0.075, 0.062) * (0.55 + 0.9 * f)[..., None]
    a = a + v3(0.05, 0.10, 0.04) * (g * f)[..., None] * 0.55
    br = np.clip((fbm_t(N, N, 5, 133) - 0.58) * 4, 0, 1); a = mix(a, v3(0.10, 0.075, 0.05) * (0.6 + f[..., None]), br * 0.55)
    return np.clip(a + grain(N, N, 0.04, 134)[..., None], 0.01, 1)
def scree_pixels(N=1024):
    n = tn(N, N, 90, 90, 141); n2 = tn(N, N, 40, 40, 142); gap = np.clip((tn(N, N, 45, 45, 143) - 0.30) * 6, 0, 1)
    a = v3(0.22, 0.22, 0.235) * (0.45 + 0.9 * n * 0.6 + 0.4 * n2)[..., None]
    a = a * (0.3 + 0.7 * gap[..., None]) + grain(N, N, 0.06, 144)[..., None]
    return np.clip(a, 0.01, 1)
def snow_pixels(N=1024):
    f = fbm_t(N, N, 6, 151); a = v3(0.50, 0.57, 0.70) * (0.8 + 0.4 * f)[..., None]
    sh = np.clip((tn(N, N, 12, 12, 152) - 0.5) * 3, 0, 1); a = a * (1 - 0.25 * sh[..., None]) + grain(N, N, 0.04, 153)[..., None]
    return np.clip(a, 0.02, 1)
def pine_pixels(N=512):
    f = fbm_t(N, N, 24, 161); a = v3(0.030, 0.052, 0.054) * (0.45 + 1.1 * f)[..., None] + grain(N, N, 0.04, 162)[..., None]
    return np.clip(a, 0.005, 1)
def wood_pixels(N=512):
    y, x = np.mgrid[0:N, 0:N].astype(np.float32); pid = np.floor(x / N * 12).astype(int)
    tone = (0.65 + 0.7 * hash2(16, 171))[pid % 16]; gr = tn(N, N, 6, 80, 172)
    a = v3(0.24, 0.14, 0.075) * (tone * (0.75 + 0.5 * gr))[..., None]
    gap = (x % (N / 12.0)) < 3; a[gap] *= 0.3; return np.clip(a + grain(N, N, 0.03, 173)[..., None], 0.01, 1)
def slate_pixels(N=512):
    y, x = np.mgrid[0:N, 0:N].astype(np.float32); row = np.floor(y / N * 12).astype(int); off = (row % 2) * (N / 20.0)
    col = np.floor((x + off) / N * 10).astype(int); tone = (0.6 + 0.8 * hash2(240, 181)).reshape(12, 20)[row % 12, col % 20]
    a = v3(0.13, 0.12, 0.14) * tone[..., None] * (0.8 + 0.4 * fbm_t(N, N, 6, 182))[..., None]
    a[(y % (N / 12.0)) < 3] *= 0.45; a[((x + off) % (N / 10.0)) < 2] *= 0.6; return np.clip(a + grain(N, N, 0.03, 183)[..., None], 0.01, 1)
def plaster_pixels(N=512):
    a = v3(0.50, 0.46, 0.40) * (0.78 + 0.35 * fbm_t(N, N, 5, 191))[..., None] + grain(N, N, 0.05, 192)[..., None]
    st = np.clip((tn(N, N, 14, 4, 193) - 0.6) * 3, 0, 1); a = a * (1 - 0.3 * st[..., None]); return np.clip(a, 0.01, 1)
def stone_pixels(N=1024):
    a = np.zeros((N, N, 3), np.float32); r = np.random.default_rng(201); rows = 10; rh = N // rows; nz = fbm_t(N, N, 8, 202)
    for ri in range(rows):
        x = -int(r.integers(0, 200))
        while x < N:
            w = int(r.integers(110, 260)); c = v3(0.30, 0.285, 0.265) * (0.6 + 0.7 * r.random()) * (v3(1, 1, 1) + (r.random(3) - 0.5) * 0.12)
            x0 = max(0, x); x1 = min(N, x + w); a[ri * rh + 3:(ri + 1) * rh - 3, x0 + 3:max(x0 + 3, x1 - 3)] = c; x += w
    a = a * (0.75 + 0.5 * nz[..., None]) + grain(N, N, 0.05, 203)[..., None]; a[a.sum(2) == 0] = v3(0.05, 0.05, 0.055)
    return np.clip(a, 0.01, 1)
def fall_pixels(N=512):
    y, x = np.mgrid[0:N, 0:N].astype(np.float32); st = tn(N, N, 28, 3, 211) * 0.6 + tn(N, N, 60, 6, 212) * 0.4
    a = mix(np.zeros((N, N, 3), np.float32) + v3(0.30, 0.42, 0.55), np.zeros((N, N, 3), np.float32) + v3(0.88, 0.95, 1.0), np.clip((st - 0.25) * 2.4, 0, 1))
    return np.clip(a, 0.02, 1)

def tunnel_lining(N=1024):
    y, x = np.mgrid[0:N, 0:N].astype(np.float32); um = x / N * 2.0; vm = y / N * 2.0
    a = v3(0.40, 0.405, 0.43) * (0.85 + 0.22 * fbm_t(N, N, 6, 281))[..., None] + grain(N, N, 0.04, 282)[..., None]
    j = (np.minimum(um % 1.0, 1 - um % 1.0) < 0.010) | (np.minimum(vm % 1.0, 1 - vm % 1.0) < 0.010); a[j] *= 0.55
    st = np.clip((tn(N, N, 40, 3, 283) - 0.62) * 2.5, 0, 1); a = a * (1 - 0.18 * st[..., None]); return np.clip(a, 0.01, 1)

PICS = {}
def pictures():
    spec = {'road': road_pixels(2048, 2048), 'rock': rock_pixels(), 'grass': grass_pixels(), 'scree': scree_pixels(), 'snow': snow_pixels(), 'pine': pine_pixels(),
            'wood': wood_pixels(), 'roof': slate_pixels(), 'plaster': plaster_pixels(), 'stone': stone_pixels(), 'metal': metal_pixels(), 'concrete': concrete_pixels(),
            'tunnel': tunnel_lining(), 'water': water_pixels(), 'fall': fall_pixels(), 'city': ground_pixels(), 'sign': sign_atlas()}
    GAIN = {'rock': 1.9, 'grass': 3.3, 'scree': 1.9, 'snow': 0.85, 'pine': 4.6, 'wood': 2.4, 'roof': 2.8, 'plaster': 1.6, 'stone': 2.0}
    for k in GAIN: spec[k] = np.clip(spec[k] * GAIN[k], 0.0, 1.0)
    for k, a in spec.items(): PICS[k] = save_image(np.ascontiguousarray(a, dtype=np.float32), 'rg_' + k, TEXDIR)
    log('pictures', len(PICS))
pictures()
# self-lit patches (a fixed brightness the colour picture is multiplied by): A signs, B waterfall + the city far below, C/D/E the pines (lit by the moon / half / shade; set after the bake)
SELFLIT = {'sign': 'A', 'fall': 'B', 'city': 'B', 'pine_a': 'C', 'pine_b': 'D', 'pine_c': 'E'}; SELF_L = {'A': 3.2, 'B': 1.5, 'C': 0.5, 'D': 0.3, 'E': 0.15}
TEXMATS = ['road', 'rock', 'scree', 'grass', 'snow', 'pine_a', 'pine_b', 'pine_c', 'wood', 'roof', 'plaster', 'stone', 'metal', 'concrete', 'tunnel', 'water', 'fall', 'city', 'sign']
MATS = TEXMATS + ['paint'] + ['emissive_' + k for k in COL]
MI = {n: i for i, n in enumerate(MATS)}
def make_materials():
    out = []
    for k in MATS:
        pk = 'pine' if k.startswith('pine') else k
        if pk in PICS:
            m = image_material('rg_' + k, PICS[pk], 0.30 if k in ('road', 'water') else (0.8 if k.startswith('pine') or k in ('grass', 'snow') else 0.55), 0.0)
        elif k == 'paint':
            m = bpy.data.materials.new('rg_paint'); m.use_nodes = True; b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
            b.inputs['Base Color'].default_value = (0.62, 0.62, 0.60, 1); b.inputs['Roughness'].default_value = 0.5
        else:
            c = COL[k[9:]]; m = bpy.data.materials.new(k); m.use_nodes = True; b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
            b.inputs['Base Color'].default_value = (0, 0, 0, 1); b.inputs['Emission Color'].default_value = (*c, 1); b.inputs['Emission Strength'].default_value = EMIT_K[k[9:]]
        out.append(m)
    return out
mats = make_materials()

# ---------------------------------------------------------------- geometry kit: one bmesh, a material per face, UV 'UVMap' (colour picture) + 'Lightmap'
bm = bmesh.new(); UVL = bm.loops.layers.uv.new('UVMap'); LML = bm.loops.layers.uv.new('Lightmap')
EMISSIVE = {i for i, n in enumerate(MATS) if n.startswith('emissive')}
SELFI = {MI[k]: v for k, v in SELFLIT.items()}
TINY = [(0.0, 0.0), (1e-3, 0.0), (1e-3, 1e-3), (0.0, 1e-3)]
LIGHTS = []; GLOWS = []
def LT(p, col, W, r=0.3): LIGHTS.append((tuple(p), tuple(col), float(W), r))
def pw(L, h): return L * 35.5 * h * h                     # watts for a point lamp at height h to light the ground under it to L (calibrated: 1000 W at 8 m -> 0.44)
def GLW(p, name, size): GLOWS.append((tuple(p), COL[name], size))
def RGL(p, name, width): GLOWS.append((tuple(p), COL[name], -abs(float(width))))      # reflect-only glow: no halo, only its reflection on the road; width = the light's width in metres
NFACE = [0]
def F(vs, mat, uv=None, lm=None, hint=None, dens=1.0, tile=3.0):
    vs = [Vector(v) for v in vs]; n = len(vs)
    nm = Vector((0, 0, 0))
    for k in range(n):
        a = vs[k]; b = vs[(k + 1) % n]; nm.x += (a.y - b.y) * (a.z + b.z); nm.y += (a.z - b.z) * (a.x + b.x); nm.z += (a.x - b.x) * (a.y + b.y)
    if nm.length < 1e-9: return None
    nm.normalize()
    if hint is not None and nm.dot(hint) < 0:
        vs.reverse(); nm = -nm
        if uv: uv = uv[::-1]
        if lm: lm = lm[::-1]
    mi = MI[mat]
    if uv is None:
        if abs(nm.z) > 0.6: ex = Vector((1, 0, 0)); ey = Vector((0, 1, 0))
        else: ex = Vector((-nm.y, nm.x, 0)).normalized(); ey = Vector((0, 0, 1))
        uv = [(v.dot(ex) / tile, v.dot(ey) / tile) for v in vs]
    if mi in EMISSIVE or mi in SELFI: lm = TINY[:n]
    elif lm is None:
        e1 = (vs[1] - vs[0]).normalized(); e2 = nm.cross(e1)
        lm = [((v - vs[0]).dot(e1) * dens, (v - vs[0]).dot(e2) * dens) for v in vs]
    try: f = bm.faces.new([bm.verts.new(v) for v in vs])
    except ValueError: return None
    f.material_index = mi
    for l, a, b in zip(f.loops, uv, lm): l[UVL].uv = a; l[LML].uv = b
    NFACE[0] += 1
    return f
def obox(c, ex, ey, ez, hx, hy, hz, mat, dens=2.0, tile=3.0, bottom=False, top=True, sides=True, uvs=None):
    pt = lambda a, b, d: c + ex * (hx * a) + ey * (hy * b) + ez * (hz * d)
    if top: F([pt(-1, -1, 1), pt(1, -1, 1), pt(1, 1, 1), pt(-1, 1, 1)], mat, None, None, ez, dens, tile)
    if bottom: F([pt(-1, -1, -1), pt(-1, 1, -1), pt(1, 1, -1), pt(1, -1, -1)], mat, None, None, -ez, dens, tile)
    if sides:
        F([pt(1, -1, -1), pt(1, 1, -1), pt(1, 1, 1), pt(1, -1, 1)], mat, None, None, ex, dens, tile)
        F([pt(-1, 1, -1), pt(-1, -1, -1), pt(-1, -1, 1), pt(-1, 1, 1)], mat, None, None, -ex, dens, tile)
        F([pt(1, 1, -1), pt(-1, 1, -1), pt(-1, 1, 1), pt(1, 1, 1)], mat, None, None, ey, dens, tile)
        F([pt(-1, -1, -1), pt(1, -1, -1), pt(1, -1, 1), pt(-1, -1, 1)], mat, None, None, -ey, dens, tile)
def yaw_axes(yaw): return Vector((math.cos(yaw), math.sin(yaw), 0)), Vector((-math.sin(yaw), math.cos(yaw), 0)), Vector((0, 0, 1))
def bbox(cx, cy, zb, yaw, sx, sy, h, mat, **k):
    ex, ey, ez = yaw_axes(yaw); obox(Vector((cx, cy, zb + h / 2)), ex, ey, ez, sx / 2, sy / 2, h / 2, mat, **k)
def beam(p0, p1, th, mat, dens=2.0, bottom=False):
    p0 = Vector(p0); p1 = Vector(p1); ez = p1 - p0; L = ez.length
    if L < 1e-6: return
    ez /= L; a = Vector((0, 0, 1)) if abs(ez.z) < 0.9 else Vector((1, 0, 0)); ex = ez.cross(a).normalized(); ey = ez.cross(ex)
    obox((p0 + p1) / 2, ex, ey, ez, th / 2, th / 2, L / 2, mat, dens=dens, top=bottom, bottom=bottom)
def quad_on(c, eu, ev, hw, hh, n, mat, uv=None, dens=1.0):
    c = Vector(c); F([c - eu * hw - ev * hh, c + eu * hw - ev * hh, c + eu * hw + ev * hh, c - eu * hw + ev * hh], mat, uv, None, n, dens)
def panel_uv(k, rot=False, flip=False):
    u0 = (k % 2) * 0.5 + 0.003; u1 = u0 + 0.494; v0 = (k // 2) * 0.25 + 0.006; v1 = v0 + 0.238
    uv = [(u0, v1), (u0, v0), (u1, v0), (u1, v1)] if rot else [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
    if flip: uv = [uv[1], uv[0], uv[3], uv[2]]
    return uv
def ribbon(i0, i1, sec, mat, hint, tile=(4.0, 4.0), dens=1.0, chunk=16, hintp=None):
    """quads between neighbouring cross sections sec(i) (lists of 3D points, or None to skip); the Lightmap UV runs in strips of `chunk` samples"""
    for i in range(i0, i1):
        a = sec(i); b = sec(i + 1)
        if not a or not b: continue
        cua = [0.0]; cub = [0.0]
        for k in range(1, len(a)): cua.append(cua[-1] + (a[k] - a[k - 1]).length); cub.append(cub[-1] + (b[k] - b[k - 1]).length)
        s0, s1 = SCu(i), SCu(i + 1); sl = SCu((i // chunk) * chunk)
        for k in range(len(a) - 1):
            uv = [(cua[k] / tile[0], s0 / tile[1]), (cua[k + 1] / tile[0], s0 / tile[1]), (cub[k + 1] / tile[0], s1 / tile[1]), (cub[k] / tile[0], s1 / tile[1])]
            lm = [((s0 - sl) * dens, cua[k] * dens), ((s0 - sl) * dens, cua[k + 1] * dens), ((s1 - sl) * dens, cub[k + 1] * dens), ((s1 - sl) * dens, cub[k] * dens)]
            vs = [a[k], a[k + 1], b[k + 1], b[k]]
            h = hint(i) if callable(hint) else hint
            if hintp is not None:
                h = hintp(i, (vs[0] + vs[1] + vs[2] + vs[3]) / 4)
            F(vs, mat, uv, lm, h, dens)


ALL = range(0, N)
CSXY = C[:, :2]


# ---------------------------------------------------------------- the mountain: a heightfield the road is cut into
PL = []; _PA = [None]
def occupy(x, y, r): PL.append((x, y, r)); _PA[0] = None
def free(x, y, r, slack=3.0):
    if _PA[0] is None: _PA[0] = np.array(PL, float).reshape(-1, 3)
    a = _PA[0]
    if len(a) == 0: return True
    return bool(np.all(np.hypot(a[:, 0] - x, a[:, 1] - y) > r + a[:, 2] - slack))
DET = {}
def cnt_(k): DET[k] = DET.get(k, 0) + 1
TW = 11.5                                                 # road corridor half width: kerbs to 9.2, a verge strip to 11.5; the terrain is snapped to this line
_NT = np.random.default_rng(5).random((512, 512)).astype(np.float32)
def vn(x, y, s):
    u = np.asarray(x, np.float64) / s; v = np.asarray(y, np.float64) / s; i = np.floor(u).astype(int); j = np.floor(v).astype(int); fu = u - i; fv = v - j
    fu = fu * fu * (3 - 2 * fu); fv = fv * fv * (3 - 2 * fv); i0 = i & 511; j0 = j & 511; i1 = (i + 1) & 511; j1 = (j + 1) & 511
    return (_NT[j0, i0] * (1 - fu) + _NT[j0, i1] * fu) * (1 - fv) + (_NT[j1, i0] * (1 - fu) + _NT[j1, i1] * fu) * fv
def fb(x, y, s, o=4):
    t = 0.0; a = 1.0; tot = 0.0
    for k in range(o): t = t + a * vn(x + 37 * k, y + 91 * k, s / 2 ** k); tot += a; a *= 0.5
    return t / tot
# the bridge's ravine runs across the road, perpendicular to the bridge chord; uphill (-y) it ends in a cliff (the waterfall)
_ia, _ib = IB0, IB1 - 1
_ch = C[_ib, :2] - C[_ia, :2]; LCH = float(np.linalg.norm(_ch)); _ch = _ch / LCH
UA = Vector((_ch[0], _ch[1], 0)); US = Vector((-_ch[1], _ch[0], 0))
if US.y < 0: US = -US                                     # US points downhill (+y)
MC = Vector(((C[_ia, 0] + C[_ib, 0]) / 2, (C[_ia, 1] + C[_ib, 1]) / 2, 0)); LH = LCH / 2 + 4.0
RAV_D = 36.0
WF_S = -70.0                                              # the waterfall cliff: distance uphill of the bridge axis
def ravine(x, y):
    a = (x - MC.x) * UA.x + (y - MC.y) * UA.y; s = (x - MC.x) * US.x + (y - MC.y) * US.y
    cross = 1 - smooth(LH - 9, LH + 15, np.abs(a)); u = -s
    prof = np.where(s < 0, (1 - 0.78 * smooth(-WF_S - 6, -WF_S + 6, u)) * (1 - smooth(110, 175, u)), 1 - smooth(40, 110, s))
    return RAV_D * cross * prof
def mountain(x, y):
    x = np.asarray(x, np.float64); y = np.asarray(y, np.float64)
    h0 = 0.14 * (200 - np.clip(y, -280, 215))
    mass = 105 * np.exp(-(((x + 110) / 165) ** 2 + ((y + 350) / 120) ** 2))
    vN = 62 * smooth(215, 330, y); vW = 55 * smooth(-285, -395, x); vE = 60 * smooth(235, 335, x)
    big = h0 + mass
    rough = (fb(x, y, 95, 4) - 0.5) * 40 * (0.35 + 0.65 * smooth(25, 120, big)) + (fb(x + 500, y, 24, 3) - 0.5) * 7
    return big - vN - vW - vE + rough - ravine(x, y)
# cut / fill slopes of the road corridor (rise per metre away from the verge); the village and the summit sit on gentle benches
CUTJ = np.full(N, 1.15); FILLJ = np.full(N, 0.8)
def _bench(i0, i1, r=25):
    for i in range(i0 - r, i1 + r):
        t = 1.0 - smooth(0, r, max(i0 - i, i - i1, 0)); CUTJ[i % N] = min(CUTJ[i % N], 1.15 + (0.14 - 1.15) * t); FILLJ[i % N] = min(FILLJ[i % N], 0.8 + (0.14 - 0.8) * t)
VIL0, VIL1 = -48, 58                                      # village: samples round the start (wraps)
_bench(VIL0, VIL1); _bench(SUMMIT - 30, SUMMIT + 30)
RB = 45.0                                                 # beyond this the corridor limits give way (the valley can fall as steeply as it likes)
def terrain_z(px, py, want=False):
    """terrain height at points (arrays); with want=True also the nearest sample, its distance and the lateral offset"""
    px = np.atleast_1d(np.asarray(px, np.float64)); py = np.atleast_1d(np.asarray(py, np.float64)); out = np.zeros(len(px)); NI = np.zeros(len(px), int); ND = np.zeros(len(px)); NS = np.zeros(len(px))
    for k0 in range(0, len(px), 900):
        x = px[k0:k0 + 900]; y = py[k0:k0 + 900]; dx = x[:, None] - C[None, :, 0]; dy = y[:, None] - C[None, :, 1]; d = np.hypot(dx, dy)
        sd = dx * LF[None, :, 0] + dy * LF[None, :, 1]; zr = C[None, :, 2] - np.clip(sd, -TW, TW) * BK[None, :] - 0.12
        dp = np.maximum(d - TW, 0.0); near = np.minimum(dp, RB); far = np.maximum(dp - RB, 0.0)
        lo = zr - FILLJ[None, :] * near - 6.0 * far; up = zr + CUTJ[None, :] * near + 6.0 * far
        lowN = np.where(NORM[None, :], lo, -1e9).max(1); upN = np.where(NORM[None, :], up, 1e9).min(1)
        dB = np.where(ISB[None, :], d, 1e9).min(1); dN = np.where(NORM[None, :], d, 1e9).min(1); lowN = np.where(dB < dN, -1e9, lowN)      # under the viaduct the road's own corridor does not hold the ground up
        upB = np.where(ISB[None, :], zr - 7.0 + 0.9 * dp, 1e9).min(1)
        roof = np.where(IST[None, :], C[None, :, 2] + 9.8 - 1.0 * np.maximum(d - 13.0, 0.0), -1e9).max(1)
        m = mountain(x, y); t = np.maximum(lowN, np.minimum(np.minimum(m, upN), upB)); t = np.maximum(t, roof)
        out[k0:k0 + 900] = t; i = d.argmin(1); NI[k0:k0 + 900] = i; ND[k0:k0 + 900] = d[np.arange(len(x)), i]; NS[k0:k0 + 900] = sd[np.arange(len(x)), i]
    return (out, NI, ND, NS) if want else out
def TZ(x, y): return float(terrain_z([x], [y])[0])

# the grid: 6 m near the road, growing outside
def lines(a0, a1, h, grow):
    f = list(np.arange(a0, a1 + 0.01, h)); lo = []; hi = []; p = f[0]; q = f[-1]
    for g in grow: p -= g; q += g; lo.append(p); hi.append(q)
    return np.array(sorted(lo + f + hi))
GROW = [9, 13, 19, 28, 42, 63, 95, 140]
GX = lines(-352, 280, 6.0, GROW); GY = lines(-272, 262, 6.0, GROW); NX, NY = len(GX), len(GY)
VX, VY = np.meshgrid(GX, GY); VXf = VX.ravel(); VYf = VY.ravel()
t0 = time.time(); VZf, VNI, VND, VNS = terrain_z(VXf, VYf, True)
log('terrain heights: %d vertices in %.0f s, z %.0f..%.0f' % (len(VXf), time.time() - t0, VZf.min(), VZf.max()))
# snap the vertices that lie in a plain road corridor onto the verge's outer edge (exactly on the ribbon edge)
SNAP = np.zeros(len(VXf), bool)
for q in range(len(VXf)):
    i = int(VNI[q])
    if NORM[i] and VND[q] < TW:
        a = (VXf[q] - C[i, 0]) * TG[i, 0] + (VYf[q] - C[i, 1]) * TG[i, 1]; f = float(np.clip(a / STEP, -0.5, 0.5)); sg = 1.0 if VNS[q] >= 0 else -1.0
        i0 = i + (-1 if f < 0 else 0); fr = f + (1 if f < 0 else 0)
        A = Vector((C[i0 % N, 0] + LF[i0 % N, 0] * sg * TW, C[i0 % N, 1] + LF[i0 % N, 1] * sg * TW, C[i0 % N, 2] - sg * TW * BK[i0 % N]))
        B = Vector((C[(i0 + 1) % N, 0] + LF[(i0 + 1) % N, 0] * sg * TW, C[(i0 + 1) % N, 1] + LF[(i0 + 1) % N, 1] * sg * TW, C[(i0 + 1) % N, 2] - sg * TW * BK[(i0 + 1) % N]))
        pnt = A * (1 - fr) + B * fr; VXf[q] = pnt.x; VYf[q] = pnt.y; VZf[q] = pnt.z - 0.12 - 0.04; SNAP[q] = True
VZ = VZf.reshape(NY, NX); VXg = VXf.reshape(NY, NX); VYg = VYf.reshape(NY, NX); SNg = SNAP.reshape(NY, NX); ND_g = VND.reshape(NY, NX)
log('snapped', int(SNAP.sum()), 'of', len(VXf), 'terrain vertices to the road')


# ---------------------------------------------------------------- the terrain mesh
def terrain_mesh():
    n = 0
    for r in range(NY - 1):
        for c in range(NX - 1):
            ix = [(r, c), (r, c + 1), (r + 1, c + 1), (r + 1, c)]
            if all(SNg[a] for a in ix): continue
            vs = [Vector((VXg[a], VYg[a], VZ[a])) for a in ix]; ce = (vs[0] + vs[1] + vs[2] + vs[3]) / 4; d = float(np.mean([ND_g[a] for a in ix]))
            nm = (vs[2] - vs[0]).cross(vs[3] - vs[1]); nm.normalize() if nm.length > 1e-9 else None
            nz = max(abs(nm.z), 0.02); sl = math.sqrt(max(0.0, 1 - nz * nz)) / nz; nn = float(fb(ce.x, ce.y, 35, 2))
            if ce.y > 330 and ce.z < 0: mat = 'city'
            elif sl > 0.95: mat = 'rock'
            elif sl > 0.62: mat = 'rock' if nn > 0.45 else 'scree'
            elif ce.z > 46 + 16 * (nn - 0.5): mat = 'snow' if sl < 0.55 else 'scree'
            elif sl > 0.36: mat = 'scree' if nn > 0.55 else 'grass'
            else: mat = 'grass'
            dens = 1.6 if d < 45 else (0.7 if d < 120 else 0.22)
            if mat == 'city': tile = 240.0
            else: tile = 7.0
            if F(vs, mat, None, None, UP, dens, tile): n += 1
    log('terrain faces:', n)
terrain_mesh()

# ---------------------------------------------------------------- the road, kerbs, verges, barriers
def ok(i): return NORM[i % N]
_fl = {}
for sg in (1, -1):
    pts = [P(i, sg * 17.0) for i in range(N)]
    dT = terrain_z([p.x for p in pts], [p.y for p in pts]) - np.array([p.z for p in pts])
    rail = (dT < 0.4).astype(float); k = 4
    rs = np.array([rail[np.arange(i - k, i + k + 1) % N].mean() for i in range(N)]); _fl[sg] = rs > 0.5
RAIL = lambda i, sg: bool(_fl[sg][i % N])
log('rail sides', int(_fl[1].sum()), int(_fl[-1].sum()), 'of', N)
ribbon(0, N, lambda i: [P(i, -7.0), P(i, 7.0)], 'road', UP, tile=(14.0, 18.0), dens=2.0)
for sg in (1, -1):
    inward = lambda i, sg=sg: -LFv(i) * sg; outward = lambda i, sg=sg: LFv(i) * sg
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 7.0), P(i, sg * 9.2)] if not BRIDGE(i) else [P(i, sg * 7.0), P(i, sg * 9.3)], 'concrete', UP, tile=(3, 3), dens=1.0)
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 9.2, -0.12), P(i, sg * TW, -0.12)] if ok(i) else None, 'grass', UP, tile=(3, 3), dens=0.8)
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * TW, -0.12), P(i, sg * TW, -2.8)] if ok(i) else None, 'rock', outward, tile=(3, 3), dens=0.3)
    # steel guard rail on the drop side, a stone wall on the cut side (inner face 8.5 m from the centre line)
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 8.5, 0.50), P(i, sg * 8.5, 1.04)] if ok(i) and RAIL(i, sg) else None, 'metal', inward, tile=(3, 3), dens=1.0)
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 8.5, 1.04), P(i, sg * 8.72, 1.04)] if ok(i) and RAIL(i, sg) else None, 'metal', UP, tile=(3, 3), dens=1.0)
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 8.5, 0.0), P(i, sg * 8.5, 1.12)] if ok(i) and not RAIL(i, sg) else None, 'stone', inward, tile=(4, 4), dens=1.0)
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 8.5, 1.12), P(i, sg * 9.2, 1.12)] if ok(i) and not RAIL(i, sg) else None, 'stone', UP, tile=(4, 4), dens=1.0)
    for i in range(0, N, 2):
        if ok(i) and ok(i + 1) and RAIL(i, sg) and RAIL(i + 1, sg):
            c = P(i, sg * 8.82, 0.4); obox(c, TGv(i), LFv(i), UP, 0.07, 0.1, 0.70, 'metal', dens=1.5, bottom=False)
    # the viaduct deck: parapets, fascias
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 8.5, 0.0), P(i, sg * 8.5, 1.1)] if BRIDGE(i) else None, 'concrete', inward, tile=(3, 3), dens=1.0)
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 8.5, 1.1), P(i, sg * 9.3, 1.1)] if BRIDGE(i) else None, 'concrete', UP, tile=(3, 3), dens=1.0)
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 9.3, 1.1), P(i, sg * 9.3, -1.9)] if BRIDGE(i) else None, 'concrete', outward, tile=(3, 3), dens=0.6)
    for i in range(0, N, 4):                                # cat's-eye reflectors, white on the left, amber on the right, on every barrier
        c = P(i, sg * 8.49, 0.72); n = -LFv(i) * sg
        quad_on(c, TGv(i), UP, 0.09, 0.06, n, 'emissive_ice' if sg > 0 else 'emissive_amber'); RGL(c, 'ice' if sg > 0 else 'amber', 0.5); cnt_('reflector')
ribbon(0, N, lambda i: [P(i, -9.3, -1.9), P(i, 9.3, -1.9)] if BRIDGE(i) else None, 'concrete', -UP, tile=(3, 3), dens=0.6)
log('road + barriers:', NFACE[0], 'faces')


def column(x, y, z0, z1, r, mat='stone', n=8, r1=None):
    r1 = r if r1 is None else r1
    pa = [(x + r * math.cos(2 * math.pi * k / n + 0.39), y + r * math.sin(2 * math.pi * k / n + 0.39)) for k in range(n)]
    pb = [(x + r1 * math.cos(2 * math.pi * k / n + 0.39), y + r1 * math.sin(2 * math.pi * k / n + 0.39)) for k in range(n)]
    for k in range(n):
        a = pa[k]; b = pa[(k + 1) % n]; a1 = pb[k]; b1 = pb[(k + 1) % n]
        F([Vector((a[0], a[1], z0)), Vector((b[0], b[1], z0)), Vector((b1[0], b1[1], z1)), Vector((a1[0], a1[1], z1))], mat, None, None, Vector(((a[0] + b[0]) / 2 - x, (a[1] + b[1]) / 2 - y, 0)), 0.5, 4.0)

# ---------------------------------------------------------------- the viaduct: stone piers, hammerhead caps, a lit waterfall beside it
for i in range(IB0 + 5, IB1 - 3, 11):
    p = P(i, 0, 0); zdeck = C[i, 2] - 1.9; ex = TGv(i); ey = LFv(i); gz = TZ(p.x, p.y) - 1.5
    obox(PA(i, 0, zdeck - 0.8), ex, ey, UP, 1.5, 9.3, 0.8, 'concrete', dens=0.4, top=False, bottom=True)
    for dd in (-4.3, 4.3):
        q = PA(i, dd, 0); column(q.x, q.y, gz, zdeck - 1.5, 1.5, 'stone', 8, 1.15)
    cnt_('pier')
# abutments: a stone face under each deck end
for i, sgn in ((IB0, 1), (IB1, -1)):
    F([P(i, -9.3, -1.9), P(i, 9.3, -1.9), P(i, 9.3, -30.0), P(i, -9.3, -30.0)], 'stone', None, None, TGv(i) * sgn, 0.3, 4.0)
_s = np.linspace(-WF_S - 12.0, -WF_S + 12.0, 9); _af = 17.0                      # waterfall: a strip hugging the cliff face, a little off the rock
_pts = []
for s_ in _s:
    for a_ in (-3.5, 3.5):
        q = MC + UA * _af + US * (-s_) + UA * a_; _pts.append(Vector((q.x, q.y, 0.0)))
_zz = terrain_z([p.x for p in _pts], [p.y for p in _pts]); _nw = 0
for k in range(len(_s) - 1):
    q = [Vector((_pts[2 * k + t].x, _pts[2 * k + t].y, _zz[2 * k + t] + 0.45)) for t in (0, 1)] + [Vector((_pts[2 * k + 3 - t].x, _pts[2 * k + 3 - t].y, _zz[2 * k + 3 - t] + 0.45)) for t in (0, 1)]
    F(q, 'fall', [(0, k / 8.0 * 3), (1, k / 8.0 * 3), (1, (k + 1) / 8.0 * 3), (0, (k + 1) / 8.0 * 3)], None, UP, 0.5); _nw += 1
_wp = Vector((MC.x + UA.x * _af - US.x * 70.0, MC.y + UA.y * _af - US.y * 70.0, 0)); _wz = TZ(_wp.x, _wp.y)
LT(Vector((_wp.x, _wp.y, _wz + 8.0)) + US * 4.0, (0.7, 0.85, 1.0), 900.0, 0.6); LT(Vector((_wp.x, _wp.y, _wz + 2.0)) + US * 4.0, (0.7, 0.85, 1.0), 500.0, 0.6)
GLW(Vector((_wp.x, _wp.y, _wz + 3.0)) + US * 4.0, 'wcool', 7.0)
for q in range(3):
    ip = IB0 + 6 + 12 * q; zb = C[ip, 2]
    for sg in (1, -1):                                       # lamps on the parapet
        b = P(ip, sg * 8.9, 1.1); obox(Vector((b.x, b.y, b.z + 1.4)), TGv(ip), LFv(ip), UP, 0.1, 0.1, 1.4, 'metal', dens=1.0, bottom=False)
        hp = b + Vector((0, 0, 2.95)); obox(hp, TGv(ip), LFv(ip), UP, 0.3, 0.3, 0.08, 'emissive_warm', dens=1.0); GLW(hp, 'warm', 6.0); LT(hp - Vector((0, 0, 0.3)), COL['warm'], pw(1.4, 4.0), 0.25)
log('viaduct and waterfall:', NFACE[0], 'faces; fall strip', _nw)

# ---------------------------------------------------------------- the tunnel: bored through rock, vaulted lining, a row of amber ceiling lamps, stone portals
TPROF = [(-8.5, 0.0), (-8.5, 6.6), (-6.0, 7.3), (-3.0, 7.7), (0.0, 7.85), (3.0, 7.7), (6.0, 7.3), (8.5, 6.6), (8.5, 0.0)]
ribbon(IT0, IT1, lambda i: [P(i, d, z) for d, z in TPROF] if IT0 <= i <= IT1 else None, 'tunnel', UP, tile=(4, 4), dens=1.2, chunk=8, hintp=lambda i, c: P(i, 0, 3.5) - c)
for i in range(IT0 + 1, IT1, 2):
    for dd in (-2.6, 2.6):
        c = PA(i, dd, C[i, 2] + 7.62 - abs(dd) * 0.04 - dd * BK[i]); obox(c, TGv(i), LFv(i), UP, 0.45, 0.16, 0.06, 'emissive_amber', dens=1.0)
        RGL(c, 'amber', 1.0); cnt_('tlamp')
    if (i - IT0) % 4 == 1: LT(P(i, 0, 6.9), COL['amber'], pw(0.8, 6.9), 0.4)
def portal(i, outn):
    n = TGv(i) * outn; back = -n
    def Q(d, z, k=0.0): return P(i, d, z) + back * k
    top = [(-8.5, 6.6), (-6.0, 7.3), (-3.0, 7.7), (0.0, 7.85), (3.0, 7.7), (6.0, 7.3), (8.5, 6.6), (8.5, 14.0), (-8.5, 14.0)]
    F([Q(-16, -1.5), Q(-8.5, -1.5), Q(-8.5, 14.0), Q(-16, 14.0)], 'stone', None, None, n, 0.6, 4.0)
    F([Q(8.5, -1.5), Q(16, -1.5), Q(16, 14.0), Q(8.5, 14.0)], 'stone', None, None, n, 0.6, 4.0)
    F([Q(d, z) for d, z in top], 'stone', None, None, n, 0.6, 4.0)
    F([Q(-16.6, 14.0, -0.4), Q(16.6, 14.0, -0.4), Q(16.6, 14.0, 3.0), Q(-16.6, 14.0, 3.0)], 'stone', None, None, UP, 0.6, 4.0)
    F([Q(-16.6, 14.0, -0.4), Q(16.6, 14.0, -0.4), Q(16.6, 14.6, -0.4), Q(-16.6, 14.6, -0.4)], 'stone', None, None, n, 0.6, 4.0)
    for sg in (1, -1):
        F([Q(sg * 16, -1.5), Q(sg * 16, 14.0), Q(sg * 16, 14.0, 3.0), Q(sg * 16, -1.5, 3.0)], 'stone', None, None, LFv(i) * sg, 0.4, 4.0)
    for sg in (1, -1):                                       # two lit lanterns beside the mouth
        b = Q(sg * 10.2, 0.0, 0.3); obox(Vector((b.x, b.y, b.z + 1.7)), TGv(i), LFv(i), UP, 0.1, 0.1, 1.7, 'metal', dens=1.0, bottom=False)
        hp = b + Vector((0, 0, 3.6)); obox(hp, TGv(i), LFv(i), UP, 0.25, 0.25, 0.1, 'emissive_amber', dens=1.0); GLW(hp, 'amber', 5.0); LT(hp - Vector((0, 0, 0.3)), COL['amber'], pw(1.2, 3.8), 0.25)
    occupy(P(i, 0).x, P(i, 0).y, 14.0)
portal(IT0, -1); portal(IT1, 1)
log('tunnel:', NFACE[0], 'faces')


# ---------------------------------------------------------------- the mountain village round the start straight
RNG = random.Random(31)
def house(cx, cy, yaw, w, d, h, rh, front, wall='wood', lit=0.7, light=True, tag='house'):
    """a gabled house: stone foundation down to the ground, walls, steep slate roof, lit windows on the side that faces `front` (a vector toward the road)"""
    ex, ey, ez = yaw_axes(yaw); fs = 1.0 if ey.dot(front) > 0 else -1.0
    cs = [(cx + ex.x * a + ey.x * b, cy + ex.y * a + ey.y * b) for a in (-w / 2, w / 2) for b in (-d / 2, d / 2)] + [(cx, cy)]
    zs = terrain_z([c[0] for c in cs], [c[1] for c in cs]); z0 = float(zs.max()) + 0.12; zb = float(zs.min()) - 0.9
    pt = lambda a, b, z: Vector((cx + ex.x * a + ey.x * b, cy + ex.y * a + ey.y * b, z))
    obox(Vector((cx, cy, (zb + z0) / 2)), ex, ey, ez, w / 2 + 0.1, d / 2 + 0.1, (z0 - zb) / 2, 'stone', dens=0.5, top=False, bottom=False)
    obox(Vector((cx, cy, z0 + h / 2)), ex, ey, ez, w / 2, d / 2, h / 2, wall, dens=0.8, top=False, bottom=False)
    for sg in (1, -1):
        F([pt(-w / 2 - 0.5, sg * (d / 2 + 0.7), z0 + h - 0.3), pt(w / 2 + 0.5, sg * (d / 2 + 0.7), z0 + h - 0.3), pt(w / 2 + 0.5, 0, z0 + h + rh), pt(-w / 2 - 0.5, 0, z0 + h + rh)], 'roof', None, None, ey * sg + ez * 1.2, 0.6, 3.0)
        F([pt(sg * w / 2, -d / 2, z0 + h), pt(sg * w / 2, d / 2, z0 + h), pt(sg * w / 2, 0, z0 + h + rh)], 'wood', None, None, ex * sg, 0.6, 3.0)
    obox(pt(w * 0.25, -fs * d * 0.15, z0 + h + rh * 0.6), ex, ey, ez, 0.4, 0.4, rh * 0.5 + 1.0, 'stone', dens=0.5, top=True, bottom=False)
    n = ey * fs
    for fl in (0, 1):
        zw = z0 + 1.5 + fl * 2.7
        for a in np.arange(-w / 2 + 1.5, w / 2 - 0.6, 2.6):
            if RNG.random() < lit:
                c = pt(a, fs * (d / 2 + 0.03), zw); quad_on(c, ex, ez, 0.42, 0.55, n, 'emissive_win'); RGL(c, 'win', 0.9); cnt_('window')
    dc = pt(-w / 2 + 1.0, fs * (d / 2 + 0.03), z0 + 1.0); quad_on(dc, ex, ez, 0.5, 1.0, n, 'emissive_warm')
    if light: LT(pt(0, fs * (d / 2 + 1.2), z0 + 2.4), COL['warm'], 90.0, 0.25)
    occupy(cx, cy, math.hypot(w, d) / 2 + 1.0); cnt_(tag)
    return z0

def street_pos(i, d): return P(i, d, 0)
def tangent_yaw(i): return float(PSI[i % N])
# the inn and its sign, then houses on both sides
INN_I = 8
p = P(INN_I, -(17.0 + 5.0)); inn_z = house(p.x, p.y, tangent_yaw(INN_I), 15.0, 9.0, 6.2, 4.2, LFv(INN_I), 'plaster', 0.95, True, 'inn')
ex_, ey_, _ = yaw_axes(tangent_yaw(INN_I)); fs_ = 1.0 if ey_.dot(LFv(INN_I)) > 0 else -1.0; nrm = ey_ * fs_
sc = Vector((p.x, p.y, inn_z + 6.9)) + nrm * (4.5 + 0.35)
quad_on(sc, ex_, UP, 3.0, 0.75, nrm, 'sign', panel_uv(0)); RGL(sc + nrm * 0.2, 'amber', 6.0); GLW(sc + nrm * 0.4, 'amber', 6.0); LT(sc + nrm * 3.5, COL['amber'], 160.0, 0.5)
beam(Vector((p.x, p.y, inn_z + 7.7)) + nrm * 4.5 - ex_ * 3.0, Vector((p.x, p.y, inn_z + 7.7)) + nrm * 4.85 - ex_ * 3.0, 0.15, 'metal')
for k in (-6.5, 6.5):
    b = Vector((p.x, p.y, inn_z)) + ex_ * k + nrm * 5.6; obox(Vector((b.x, b.y, b.z + 1.5)), ex_, ey_, UP, 0.1, 0.1, 1.5, 'metal', dens=1.0, bottom=False)
    hp = b + Vector((0, 0, 3.1)); obox(hp, ex_, ey_, UP, 0.28, 0.28, 0.1, 'emissive_warm', dens=1.0); GLW(hp, 'warm', 5.5); LT(hp - Vector((0, 0, 0.3)), COL['warm'], pw(1.2, 3.2), 0.25)
for i in range(-46, 58, 5):
    for sg in (-1, 1):
        if sg == 1 and not (i in (-36, -21, 18, 38, 53)): continue
        if sg == -1 and abs(i - INN_I) < 8: continue
        if sg == -1 and 24 <= i <= 38: continue                  # the church stands there
        w = RNG.choice([8.0, 9.0, 10.0, 11.0]); d = RNG.choice([6.5, 7.5, 8.5]); off = 16.5 + d / 2 + RNG.random() * 3.0
        pp = P(i, sg * off);
        if not free(pp.x, pp.y, math.hypot(w, d) / 2): continue
        house(pp.x, pp.y, tangent_yaw(i) + RNG.choice([0, 0, 0.12, -0.12]), w, d, RNG.choice([5.0, 5.6, 6.0]), RNG.choice([3.8, 4.4, 5.0]), LFv(i) * (-sg), RNG.choice(['wood', 'wood', 'plaster']), 0.65)
# the church: nave, tower with lit belfry and clock, spire
CH_I = 31; cp = P(CH_I, -40.0); ch_yaw = tangent_yaw(CH_I); cex, cey, _ = yaw_axes(ch_yaw); front = LFv(CH_I)
house(cp.x, cp.y, ch_yaw, 16.0, 9.0, 7.0, 5.0, front, 'plaster', 0.9, True, 'church')
tp = Vector((cp.x, cp.y, 0)) + cex * 11.5; tz = terrain_z([tp.x], [tp.y])[0]; tz0 = max(tz, TZ(cp.x, cp.y)) + 0.1
obox(Vector((tp.x, tp.y, (tz - 1.2 + tz0 + 14.0) / 2)), cex, cey, UP, 2.6, 2.6, (tz0 + 14.0 - (tz - 1.2)) / 2, 'stone', dens=0.5, top=False, bottom=False)
sp = tz0 + 14.0
for k in range(4):
    a0 = k * math.pi / 2 + math.pi / 4; a1 = a0 + math.pi / 2
    A_ = Vector((tp.x + 3.0 * math.cos(a0), tp.y + 3.0 * math.sin(a0), sp)); B_ = Vector((tp.x + 3.0 * math.cos(a1), tp.y + 3.0 * math.sin(a1), sp)); T_ = Vector((tp.x, tp.y, sp + 9.5))
    F([A_, B_, T_], 'roof', None, None, (A_ + B_) / 2 - Vector((tp.x, tp.y, 0)) + UP * 1.5, 0.6, 3.0)
fn = LFv(CH_I) * 1.0; fn = fn if (fn.dot(Vector((cp.x - tp.x, cp.y - tp.y, 0))) < 0) else -fn
fn = LFv(CH_I)                                                        # the face that looks at the road (left)
for dz_, mat_ in ((11.4, 'emissive_amber'),):
    cc = Vector((tp.x, tp.y, tz0 + dz_)) + fn * 2.62; quad_on(cc, cex, UP, 0.9, 0.9, fn, mat_); RGL(cc + fn * 0.1, 'amber', 1.6); GLW(cc + fn * 0.3, 'amber', 4.0)
for k in range(4):
    nn_ = [cex, cey, -cex, -cey][k]; cc = Vector((tp.x, tp.y, tz0 + 8.3)) + nn_ * 2.62; quad_on(cc, RIGHT(nn_), UP, 0.55, 1.0, nn_, 'emissive_win')
    if nn_.dot(fn) > 0.9: RGL(cc + nn_ * 0.1, 'win', 1.0)
LT(Vector((tp.x, tp.y, tz0 + 8.3)) + fn * 3.5, COL['win'], 700.0, 0.4); occupy(tp.x, tp.y, 6.0)
# a small grandstand on the drop side of the start line, lit from under its roof
GS_I = 0; gp = P(GS_I + 1, 18.5); ge = TGv(GS_I + 1); gl = LFv(GS_I + 1)
for k in range(5):
    zt = TZ(gp.x, gp.y)
    obox(Vector((gp.x, gp.y, 0)) + gl * (k * 1.3) + UP * (zt + 0.45 * (k + 1) * 0.5 - 0.3), ge, gl, UP, 9.0, 0.65, 0.45 * (k + 1) * 0.5 + 0.3, 'concrete', dens=0.6, bottom=False)
for sx in (-8.8, 8.8):
    for sy in (0.3, 5.5): beam(Vector((gp.x, gp.y, 0)) + ge * sx + gl * sy + UP * (TZ(gp.x, gp.y) - 0.3), Vector((gp.x, gp.y, 0)) + ge * sx + gl * sy + UP * (TZ(gp.x, gp.y) + 5.2), 0.2, 'metal')
zr_ = TZ(gp.x, gp.y) + 5.2
obox(Vector((gp.x, gp.y, 0)) + gl * 3.0 + UP * zr_, ge, gl, UP, 9.8, 3.6, 0.1, 'metal', dens=0.6, bottom=True)
for sx in range(-8, 9, 2):
    c = Vector((gp.x, gp.y, 0)) + ge * sx + gl * 0.5 + UP * (zr_ - 0.2); obox(c, ge, gl, UP, 0.3, 0.12, 0.05, 'emissive_warm', dens=1.0); RGL(c, 'warm', 0.7); cnt_('gs_lamp')
for sx in (-6, 0, 6): LT(Vector((gp.x, gp.y, 0)) + ge * sx + gl * 0.8 + UP * (zr_ - 0.5), COL['warm'], pw(1.1, 5.0), 0.3)
occupy(gp.x + gl.x * 3, gp.y + gl.y * 3, 12.0)
# the start gantry over sample 0

def roadtop(i): return max(P(i, 7.0).z, P(i, -7.0).z)
def frame(i, half=0.55, posts=9.4, zb=6.9):
    yy = roadtop(i); ex = TGv(i); ey = LFv(i)
    for sg in (1, -1):
        b = P(i, sg * posts); ztop = yy + zb + 2 * half
        obox(Vector((b.x, b.y, (b.z - 0.3 + ztop) / 2)), ex, ey, UP, 0.3, 0.3, (ztop - b.z + 0.3) / 2, 'metal', dens=1.5, bottom=False); occupy(b.x, b.y, 2.0)
    obox(PA(i, 0, yy + zb + half), ex, ey, UP, half, posts + 0.35, half, 'metal', dens=1.5, bottom=True)
    return yy
def start_gantry(i):
    ex = TGv(i); ey = LFv(i); back = -ex; yy = frame(i, 0.5, 9.4, 6.9); n = back
    for dd in (-4, -2, 0, 2, 4):
        p = PA(i, dd, yy + 7.4) + back * 0.8; obox(p, ex, ey, UP, 0.12, 0.5, 0.45, 'emissive_red', dens=1.0); GLW(p, 'red', 6.0)
    for dd in (-4.5, 0, 4.5): LT(PA(i, dd, yy + 6.2) + back * 1.5, COL['red'], 500.0, 0.3)
    c = PA(i, 0, yy + 10.2) + back * 0.75
    for dd in (-3.2, 3.2): beam(PA(i, dd, yy + 7.9), PA(i, dd, yy + 9.0), 0.25, 'metal')
    quad_on(c, RIGHT(n), UP, 4.0, 1.0, n, 'sign', panel_uv(7)); LT(c + back * 2.0, COL['red'], 700.0, 0.5)
    RGL(c + back * 0.3, 'red', 8.0); RGL(PA(i, 0, yy + 7.4) + back * 0.8, 'ice', 20.0)
    F([PA(i, -9.6, yy + 7.45) + back * 0.52, PA(i, 9.6, yy + 7.45) + back * 0.52, PA(i, 9.6, yy + 7.6) + back * 0.52, PA(i, -9.6, yy + 7.6) + back * 0.52], 'emissive_ice', None, None, back)
    for r in range(2):                                    # the line, eight grid boxes
        for c_ in range(28):
            if (r + c_) % 2 == 0:
                s0 = r * 0.5; s1 = s0 + 0.5; d0 = -7.0 + c_ * 0.5; d1 = d0 + 0.5
                F([Pf(s0 / STEP, d0, 0.025), Pf(s0 / STEP, d1, 0.025), Pf(s1 / STEP, d1, 0.025), Pf(s1 / STEP, d0, 0.025)], 'paint', None, None, UP, 1.0)
    for j in range(8):
        dc = -2.6 if j % 2 == 0 else 2.6; sb = 8.0 + 9.0 * j; sf = sb - 5.5
        F([Pf(-(sb - 0.14) / STEP, dc - 1.3, 0.025), Pf(-(sb - 0.14) / STEP, dc + 1.3, 0.025), Pf(-sb / STEP, dc + 1.3, 0.025), Pf(-sb / STEP, dc - 1.3, 0.025)], 'paint', None, None, UP, 1.0)
        for dd0, dd1 in ((dc - 1.3, dc - 1.16), (dc + 1.16, dc + 1.3)):
            F([Pf(-(sb - 2.0) / STEP, dd0, 0.025), Pf(-(sb - 2.0) / STEP, dd1, 0.025), Pf(-sb / STEP, dd1, 0.025), Pf(-sb / STEP, dd0, 0.025)], 'paint', None, None, UP, 1.0)


start_gantry(0)
# ---- village lanterns and festoons of lights over the street
def lantern(i, sg, h=3.6, dd=10.0):
    b = P(i, sg * dd, -0.25); obox(Vector((b.x, b.y, b.z + (h + 0.25) / 2)), TGv(i), LFv(i), UP, 0.1, 0.1, (h + 0.25) / 2, 'metal', dens=1.0, bottom=False)
    hp = b + Vector((0, 0, h + 0.25)); obox(hp, TGv(i), LFv(i), UP, 0.3, 0.3, 0.12, 'emissive_warm', dens=1.0); GLW(hp, 'warm', 6.0); LT(hp - Vector((0, 0, 0.3)), COL['warm'], pw(1.3, h), 0.25); cnt_('lantern')
for k, i in enumerate(range(-44, 56, 6)):
    if abs(i) < 4: continue
    lantern(i, 1 if k % 2 == 0 else -1)
for i in (-40, -29, -17, 13, 25, 37, 49):
    if abs(i) < 8: continue
    top = roadtop(i) + 8.4
    for sg in (1, -1):
        b = P(i, sg * 10.7, -0.25); obox(Vector((b.x, b.y, (b.z + top) / 2)), TGv(i), LFv(i), UP, 0.12, 0.12, (top - b.z) / 2, 'metal', dens=1.0, bottom=False)
    for q in range(1, 12):
        t = q / 12.0; dd = -10.7 + 21.4 * t; z = top - 1.1 * 4 * t * (1 - t); c = PA(i, dd, z); obox(c, TGv(i), LFv(i), UP, 0.1, 0.1, 0.1, 'emissive_warm', dens=1.0)
        RGL(c, 'warm', 0.5)
        if q % 4 == 2: GLW(c, 'warm', 2.5)
    cnt_('festoon')
# ---- lit chevron boards on the outside of every real bend, a lamp at each hairpin
def chevron(i, sgo, s):
    n = (-sgo * LFv(i)) * 0.92 + (-TGv(i)) * 0.39; n.normalize(); eu = RIGHT(n)
    b = P(i, sgo * 9.75); z0 = b.z; c = Vector((b.x, b.y, z0 + 1.65))
    obox(c, eu, n, UP, 1.15, 0.04, 0.95, 'metal', dens=1.0)
    for dx in (-0.8, 0.8): obox(Vector((b.x, b.y, z0 + 0.3)) + eu * dx, eu, n, UP, 0.05, 0.05, 0.45, 'metal', dens=1.0, bottom=False)
    for sy in (1, -1): F([c + n * 0.06 + eu * s * x + UP * sy * y for x, y in ((-0.7, 0.88), (-0.28, 0.88), (0.7, 0.0), (0.28, 0.0))], 'emissive_amber', None, None, n)
    RGL(c + n * 0.3, 'amber', 2.2); cnt_('chevron')
def hairpin_lamp(i, sgo):
    dp = 10.4; b = P(i, sgo * dp, -0.3); topz = b.z + 9.2
    obox(Vector((b.x, b.y, (b.z + topz) / 2)), TGv(i), LFv(i), UP, 0.17, 0.17, (topz - b.z) / 2, 'metal', dens=1.5, bottom=False)
    beam(PA(i, sgo * dp, topz), PA(i, sgo * 6.2, topz + 0.15), 0.2, 'metal'); hp = PA(i, sgo * 6.2, topz - 0.05)
    obox(hp, TGv(i), LFv(i), UP, 0.7, 0.3, 0.07, 'emissive_warm', dens=1.0); LT(hp - Vector((0, 0, 0.3)), COL['warm'], pw(2.0, 9.0), 0.3); GLW(hp, 'warm', 9.0); cnt_('hairpin lamp')
ap = []; HP = []
for i in range(N):
    if abs(KAP[i]) < 1 / 200.0 or i in range(IT0 - 10, IT1 + 10) or any(BRIDGE(i + j) for j in range(-6, 7)): continue
    if all(abs(KAP[(i + k) % N]) <= abs(KAP[i]) for k in range(-25, 26)) and all(abs(i - j) > 30 for j in ap): ap.append(i)
for i0_ in ap:
    sgo = -1 if KAP[i0_] > 0 else 1; s = 1 if KAP[i0_] < 0 else -1
    for i in range(i0_ - 12, i0_ + 13, 3):
        if abs(KAP[i % N]) > 1 / 280.0 and not any(BRIDGE(i + j) for j in range(-2, 3)) and not (IT0 - 3 <= i % N <= IT1 + 3): chevron(i, sgo, s)
    if abs(KAP[i0_]) > 1 / 70.0: hairpin_lamp(i0_, sgo); HP.append(i0_)
log('chevron boards:', DET.get('chevron', 0), 'at', len(ap), 'bends;', 'hairpin lamps', DET.get('hairpin lamp', 0))
# a lit shrine or hut beside the road at a few calm places and one road-side hut at each of two hairpins
def shrine(i, sg, kind):
    off = 14.5 + (3.0 if kind == 'hut' else 0.5); pp = P(i, sg * off); yaw = tangent_yaw(i); ex, ey, ez = yaw_axes(yaw); z0 = terrain_z([pp.x], [pp.y])[0] + 0.1
    if not free(pp.x, pp.y, 4.0): return False
    n = LFv(i) * (-sg)
    if kind == 'shrine':
        obox(Vector((pp.x, pp.y, z0 + 0.7)), ex, ey, ez, 0.9, 0.9, 0.7, 'stone', dens=0.8, bottom=False)
        obox(Vector((pp.x, pp.y, z0 + 2.0)), ex, ey, ez, 0.7, 0.7, 0.6, 'stone', dens=0.8, bottom=False)
        for k in range(4):
            a_ = [ex, ey, -ex, -ey][k]; A_ = Vector((pp.x, pp.y, z0 + 2.6)) + a_ * 0.85 + RIGHT(a_) * 0.85; B_ = Vector((pp.x, pp.y, z0 + 2.6)) + a_ * 0.85 - RIGHT(a_) * 0.85
            F([A_, B_, Vector((pp.x, pp.y, z0 + 3.5))], 'roof', None, None, a_ + UP, 0.6, 3.0)
        c = Vector((pp.x, pp.y, z0 + 1.95)) + n * 0.72; quad_on(c, RIGHT(n), UP, 0.3, 0.35, n, 'emissive_warm'); RGL(c + n * 0.1, 'warm', 0.8); GLW(c + n * 0.4, 'warm', 3.5)
        LT(c + n * 0.8, COL['warm'], 90.0, 0.15)
    else:
        house(pp.x, pp.y, yaw, 6.0, 5.0, 3.6, 2.6, n, 'wood', 1.0, True, 'hut')
        hp = Vector((pp.x, pp.y, z0 + 2.9)) + n * 3.3; GLW(hp, 'warm', 4.0)
    occupy(pp.x, pp.y, 5.0); cnt_(kind); return True
_sh = 0
for fr, sg, kind in ((0.12, -1, 'shrine'), (0.36, -1, 'hut'), (0.60, 1, 'shrine'), (0.84, -1, 'hut'), (0.48, 1, 'hut')):
    for dj in range(0, 40):
        i = int(fr * N) + dj
        if plain(i, 8) and abs(KAP[i % N]) < 1 / 250.0 and not (i % N > N - 60 or i % N < 60):
            if shrine(i, sg, kind): break


# ---------------------------------------------------------------- the summit: observatory dome, radio masts with red lamps, a lookout with a railing
MOON = Vector((-0.62, 0.15, 0.62)).normalized()
SU = SUMMIT; sgu = 1 if TZ(*P(SU, 32).xy) > TZ(*P(SU, -32).xy) else -1          # the uphill side at the top
def dome(cx, cy, zb, R):
    for ring in range(5):
        a0 = ring * (math.pi / 2) / 5; a1 = (ring + 1) * (math.pi / 2) / 5
        for k in range(14):
            b0 = k * 2 * math.pi / 14; b1 = (k + 1) * 2 * math.pi / 14
            q = [Vector((cx + R * math.cos(a) * math.cos(b), cy + R * math.cos(a) * math.sin(b), zb + R * math.sin(a))) for a, b in ((a0, b0), (a0, b1), (a1, b1), (a1, b0))]
            if ring == 4: q = q[:2] + [Vector((cx, cy, zb + R))]
            F(q, 'concrete', None, None, (q[0] + q[1]) / 2 - Vector((cx, cy, zb)) + Vector((0, 0, 0.1)), 0.5, 4.0)
op = P(SU + 6, sgu * 38.0); oz = terrain_z([op.x], [op.y])[0]; oex, oey, _ = yaw_axes(tangent_yaw(SU + 6))
if free(op.x, op.y, 12.0):
    zmin = float(terrain_z([op.x + 8 * math.cos(a) for a in np.linspace(0, 6.2, 8)], [op.y + 8 * math.sin(a) for a in np.linspace(0, 6.2, 8)]).min())
    column(op.x, op.y, zmin - 1.0, oz + 6.0, 8.0, 'stone', 12); dome(op.x, op.y, oz + 6.0, 8.0)
    towards = -sgu * LFv(SU + 6)
    for dz_ in (0.8, 2.2, 3.6):                                   # the lit slit of the dome, facing the road
        c = Vector((op.x, op.y, oz + 6.0 + dz_ + 1.0)) + towards * (math.sqrt(max(0.0, 64 - (dz_ + 1.0) ** 2)) + 0.05)
        quad_on(c, RIGHT(towards), UP, 0.45, 0.6, towards, 'emissive_ice')
    c = Vector((op.x, op.y, oz + 3.0)) + towards * 8.06; quad_on(c, RIGHT(towards), UP, 0.9, 1.0, towards, 'emissive_win'); RGL(c + towards * 0.1, 'win', 1.8); GLW(c + towards * 0.5, 'ice', 5.0)
    LT(c + towards * 3.0, COL['ice'], 600.0, 0.5); LT(c + towards * 1.5 + UP * 5.0, COL['win'], 300.0, 0.4)
    for sx in (-12, 12):
        bp = Vector((op.x, op.y, 0)) + oex * sx; bz = TZ(bp.x, bp.y); obox(Vector((bp.x, bp.y, bz + 1.8)), oex, oey, UP, 3.0, 2.2, 2.2, 'plaster', dens=0.6, bottom=False)
        w_ = bp + towards * 2.25 + UP * (bz + 2.0 - bp.z); quad_on(Vector((w_.x, w_.y, bz + 2.2)), oex, UP, 0.5, 0.45, towards, 'emissive_win'); occupy(bp.x, bp.y, 5.0)
    occupy(op.x, op.y, 12.0); cnt_('observatory')
for q, (a_, H_, ofs) in enumerate(((0, 42.0, 62.0), (-14, 31.0, 74.0), (16, 26.0, 70.0))):
    mp = P(SU + a_ + 8, sgu * ofs); mz = terrain_z([mp.x], [mp.y])[0]
    if not free(mp.x, mp.y, 5.0): continue
    for k in range(8):                                            # a tapering lattice mast: a square tube of boxes with cross braces
        z0 = mz - 1.0 + k * (H_ + 1.0) / 8; z1 = z0 + (H_ + 1.0) / 8; w0 = 1.2 * (1 - 0.7 * k / 8); w1 = 1.2 * (1 - 0.7 * (k + 1) / 8)
        for sx, sy in ((1, 1), (1, -1), (-1, 1), (-1, -1)): beam(Vector((mp.x + sx * w0, mp.y + sy * w0, z0)), Vector((mp.x + sx * w1, mp.y + sy * w1, z1)), 0.14, 'metal')
        for sx, sy, tx, ty in ((1, 1, -1, 1), (-1, 1, -1, -1)): beam(Vector((mp.x + sx * w0, mp.y + sy * w0, z0)), Vector((mp.x + tx * w1, mp.y + ty * w1, z1)), 0.07, 'metal')
    for hh in (H_ * 0.45, H_ * 0.8, H_ + 0.6):
        hp = Vector((mp.x, mp.y, mz + hh)); obox(hp, Vector((1, 0, 0)), Vector((0, 1, 0)), UP, 0.22, 0.22, 0.22, 'emissive_red', dens=1.0); GLW(hp, 'red', 8.0); RGL(hp, 'red', 1.0)
    occupy(mp.x, mp.y, 5.0); cnt_('mast')
# the lookout: a stone platform on the drop side with a railing and two lamps
li = SU - 12; lw = 14.0; ld = 6.0
lc_ = [P(li, -sgu * (11.8 + t * ld), 0) for t in (0, 1)] + [P(li + int(lw / STEP), -sgu * (11.8 + t * ld), 0) for t in (1, 0)]
lz = C[li, 2] - 0.3
for j in range(0, int(lw / STEP) + 1):
    i = li + j; a = P(i, -sgu * 11.5, 0.0); b = P(i + 1, -sgu * 11.5, 0.0); ok_ = TZ(a.x, a.y)
quad_ = [PA(li, -sgu * 11.5, lz), PA(li, -sgu * (11.5 + ld), lz), PA(li + int(lw / STEP), -sgu * (11.5 + ld), lz), PA(li + int(lw / STEP), -sgu * 11.5, lz)]
F(quad_, 'concrete', None, None, UP, 0.8, 3.0)
for q in quad_:                                                    # stone piers under the corners
    column(q.x, q.y, TZ(q.x, q.y) - 2.0, lz, 0.5, 'stone', 6)
for j in range(0, int(lw / STEP) + 1):                              # railing on the three outer sides
    i = li + j; pa = PA(i, -sgu * (11.5 + ld), lz); beam(pa, pa + UP * 1.1, 0.07, 'metal')
for t in range(0, 4):
    pa = PA(li + int(lw / STEP) * 1, -sgu * (11.5 + ld * t / 3.0), lz); beam(pa, pa + UP * 1.1, 0.07, 'metal'); pb = PA(li, -sgu * (11.5 + ld * t / 3.0), lz); beam(pb, pb + UP * 1.1, 0.07, 'metal')
for h_ in (0.55, 1.1):
    beam(PA(li, -sgu * (11.5 + ld), lz + h_), PA(li + int(lw / STEP), -sgu * (11.5 + ld), lz + h_), 0.06, 'metal')
    beam(PA(li, -sgu * 11.5, lz + h_), PA(li, -sgu * (11.5 + ld), lz + h_), 0.06, 'metal'); beam(PA(li + int(lw / STEP), -sgu * 11.5, lz + h_), PA(li + int(lw / STEP), -sgu * (11.5 + ld), lz + h_), 0.06, 'metal')
for t in (0.2, 0.8):
    c = PA(li + int(lw / STEP * t), -sgu * (11.5 + ld * 0.5), lz); obox(Vector((c.x, c.y, lz + 1.7)), TGv(li), LFv(li), UP, 0.1, 0.1, 1.7, 'metal', dens=1.0, bottom=False)
    hp = Vector((c.x, c.y, lz + 3.5)); obox(hp, TGv(li), LFv(li), UP, 0.28, 0.28, 0.1, 'emissive_warm', dens=1.0); GLW(hp, 'warm', 6.0); LT(hp - Vector((0, 0, 0.3)), COL['warm'], pw(1.3, 3.4), 0.25)
occupy(*(P(li + 2, -sgu * 16.0).xy), 9.0); cnt_('lookout')
log('summit set pieces:', NFACE[0], 'faces; summit sample', SU, 'uphill side', sgu)

# ---------------------------------------------------------------- the cable car: a line from a station above the village to the summit, two lit cabins, pylons; high over every road it crosses
SA = P(-22, -62.0); SB = P(SU - 10, sgu * 56.0)
A0 = Vector((SA.x, SA.y, terrain_z([SA.x], [SA.y])[0] + 9.0)); B0 = Vector((SB.x, SB.y, terrain_z([SB.x], [SB.y])[0] + 9.0))
dirv = Vector((B0.x - A0.x, B0.y - A0.y, 0)); LL = dirv.length; dirv /= LL
def near_road(x, y, r):
    d = np.hypot(C[:, 0] - x, C[:, 1] - y); return d < r
nodes = []                                                              # (distance along the line, z)
nn_ = max(3, int(LL / 90.0))
for k in range(1, nn_):
    s = LL * k / nn_
    for sh in sorted(range(-40, 41, 4), key=abs):
        q = A0 + dirv * (s + sh)
        if not near_road(q.x, q.y, 24.0).any() and free(q.x, q.y, 4.0): s += sh; break
    q = A0 + dirv * s; nodes.append([s, terrain_z([q.x], [q.y])[0] + 16.0, q.x, q.y])
zA, zB = A0.z, B0.z
def prof(nds):
    return [(0.0, zA)] + [(n_[0], n_[1]) for n_ in nds] + [(LL, zB)]
def zline(pf, s):
    for k in range(len(pf) - 1):
        if pf[k][0] <= s <= pf[k + 1][0]: t = (s - pf[k][0]) / max(1e-6, pf[k + 1][0] - pf[k][0]); return pf[k][1] * (1 - t) + pf[k + 1][1] * t
    return pf[-1][1]
for it in range(60):
    pf = prof(nodes); bad = 0
    for s in np.arange(0.0, LL, 2.0):
        q = A0 + dirv * s; zl = zline(pf, s); dj = np.hypot(C[:, 0] - q.x, C[:, 1] - q.y); m = dj < 14.0
        need = (C[m, 2].max() + 15.0) if m.any() else -1e9; need = max(need, terrain_z([q.x], [q.y])[0] + 14.0 if s > 40 and s < LL - 40 else -1e9)
        if zl < need:
            bad += 1
            for n_ in nodes:
                if n_[0] <= s + 90 and n_[0] >= s - 90: n_[1] += (need - zl) * 0.5 + 0.5
    if not bad: break
pf = prof(nodes); log('cable car: line %.0f m, %d pylons, clearance passes %d, bad %d' % (LL, len(nodes), it, bad))
cabl = [Vector((A0.x + dirv.x * s, A0.y + dirv.y * s, zline(pf, s))) for s in [p_[0] for p_ in pf]]
for k in range(len(cabl) - 1): beam(cabl[k], cabl[k + 1], 0.09, 'metal')
side = Vector((-dirv.y, dirv.x, 0))
def station(c, z0, up):
    zt = terrain_z([c.x, c.x + 4, c.x - 4, c.x], [c.y, c.y, c.y, c.y + 4])
    obox(Vector((c.x, c.y, (zt.min() - 1.5 + z0) / 2)), dirv, side, UP, 5.0, 4.0, (z0 - zt.min() + 1.5) / 2, 'stone', dens=0.5, top=False, bottom=False)
    obox(Vector((c.x, c.y, z0 + 3.0)), dirv, side, UP, 4.5, 3.4, 3.0, 'plaster', dens=0.6, bottom=False)
    for sg in (1, -1):
        w_ = Vector((c.x, c.y, z0 + 2.4)) + side * 3.45 * sg; quad_on(w_, dirv, UP, 3.2, 0.7, side * sg, 'emissive_win'); RGL(w_ + side * sg * 0.1, 'win', 3.0)
    LT(Vector((c.x, c.y, z0 + 2.0)) + side * 5.0, COL['win'], 400.0, 0.4); occupy(c.x, c.y, 8.0)
station(Vector((A0.x, A0.y, 0)), A0.z - 9.0 + 0.4, True); station(Vector((B0.x, B0.y, 0)), B0.z - 9.0 + 0.4, False)
for n_ in nodes:                                                       # lattice pylons
    z_ = zline(pf, n_[0]); q = Vector((n_[2], n_[3], 0)); g = TZ(q.x, q.y) - 0.8; top = Vector((q.x, q.y, z_ - 1.4))
    for sg in (1, -1):
        beam(Vector((q.x, q.y, g)) + side * 3.2 * sg, top + side * 0.5 * sg, 0.35, 'metal')
    for f_ in (0.35, 0.65):
        zz = g + (z_ - 1.4 - g) * f_; w_ = 3.2 - (3.2 - 0.5) * f_; beam(Vector((q.x, q.y, zz)) + side * w_, Vector((q.x, q.y, zz)) - side * w_, 0.2, 'metal')
    obox(Vector((q.x, q.y, z_ - 0.9)), dirv, side, UP, 0.5, 1.8, 0.35, 'metal', dens=1.0); lp = Vector((q.x, q.y, z_ + 0.4)); obox(lp, dirv, side, UP, 0.18, 0.18, 0.18, 'emissive_red', dens=1.0); GLW(lp, 'red', 6.0); RGL(lp, 'red', 0.8)
    occupy(q.x, q.y, 5.0); cnt_('pylon')
def cabin(s):
    z_ = zline(pf, s); q = A0 + dirv * s; cz = z_ - 5.2
    beam(Vector((q.x, q.y, z_)), Vector((q.x, q.y, cz + 2.0)), 0.12, 'metal')
    obox(Vector((q.x, q.y, cz + 1.0)), dirv, side, UP, 1.5, 1.1, 1.0, 'metal', dens=1.0, top=True, bottom=True)
    for sg in (1, -1):
        w_ = Vector((q.x, q.y, cz + 1.1)) + side * 1.11 * sg; quad_on(w_, dirv, UP, 1.1, 0.55, side * sg, 'emissive_win'); RGL(w_ + side * sg * 0.1, 'win', 2.0)
    for sg in (1, -1): w_ = Vector((q.x, q.y, cz + 1.1)) + dirv * 1.51 * sg; quad_on(w_, side, UP, 0.8, 0.55, dirv * sg, 'emissive_win')
    GLW(Vector((q.x, q.y, cz + 1.1)) + side * 1.5, 'win', 5.0); LT(Vector((q.x, q.y, cz + 1.0)), COL['win'], 150.0, 0.3); cnt_('cabin')
cr = []                                                                # crossings: where the line passes over a road
for s in np.arange(10.0, LL - 10, 3.0):
    q = A0 + dirv * s
    if near_road(q.x, q.y, 6.0).any() and (not cr or s - cr[-1] > 60): cr.append(s)
cs_ = (cr + [LL * 0.35, LL * 0.7])[:2] if len(cr) >= 1 else [LL * 0.35, LL * 0.7]
if len(cr) >= 2: cs_ = [cr[0] + 4.0, cr[1] + 4.0]
for s in cs_: cabin(s)
log('cable car crossings at', [round(float(c), 0) for c in cr])


# ---------------------------------------------------------------- pine forest: two stacked 5-sided cones each, denser low down, thinning toward the summit; self-lit (fixed dark brightness by facing)
def pine(x, y, z, H, rot):
    r0 = 0.30 * H
    for (zb, ztop, rr) in ((z + 0.1, z + H * 0.64, r0), (z + H * 0.40, z + H, r0 * 0.66)):
        ring = [Vector((x + rr * math.cos(rot + 2 * math.pi * k / 5), y + rr * math.sin(rot + 2 * math.pi * k / 5), zb)) for k in range(5)]; ap_ = Vector((x, y, ztop))
        for k in range(5):
            a = ring[k]; b = ring[(k + 1) % 5]; mid = (a + b) / 2 - Vector((x, y, 0)); nrm = Vector((mid.x, mid.y, rr * 0.9)).normalized(); d = nrm.dot(MOON)
            F([a, b, ap_], 'pine_a' if d > 0.42 else ('pine_b' if d > -0.05 else 'pine_c'), [(0, 0), (1, 0), (0.5, 1)], None, nrm)
def forest(cap=2300):
    rng = np.random.default_rng(77); M = 30000
    X = rng.uniform(GX[len(GROW)] + 1, GX[-len(GROW) - 1], M); Y = rng.uniform(GY[len(GROW)] + 1, GY[-len(GROW) - 1], M)
    X = np.where(rng.random(M) < 0.55, X, rng.uniform(-330, 265, M)); Y = np.where(rng.random(M) < 0.5, Y, rng.uniform(-255, 300, M))
    Z, NI, ND, NS = terrain_z(X, Y, True); R = rng.random(M)
    dens = np.clip(1.08 - (Z - 2) / 66.0, 0.02, 1.0) * np.where(ND < 48, 1.0, 0.55) * np.where(Y > 310, 0.0, 1.0) * np.where(Z < -25, 0.5, 1.0)
    clear = fb(X, Y, 26, 2) > 0.70
    keep = (ND > 15.5) & (R < dens * 0.80) & (~clear) & (Z < 62)
    idx = np.nonzero(keep)[0]; rng.shuffle(idx); n = 0; hit = 0
    for q in idx:
        x, y, z = float(X[q]), float(Y[q]), float(Z[q])
        z2 = terrain_z([x + 3, x], [y, y + 3]); sl = math.hypot(z2[0] - z, z2[1] - z) / 3.0
        if sl > 0.95: continue
        H = 6.5 + rng.random() * 6.0 + (2.5 if Z[q] < 15 else 0.0)
        if not free(x, y, 2.5, 2.0): hit += 1; continue
        pine(x, y, z - 0.3, H, rng.random() * 6.28); n += 1
        if n >= cap: break
    log('pines:', n, '(skipped near buildings:', hit, ')')
forest()
log('scenery faces:', NFACE[0])

PX, PY = -330.0, -245.0

def clearance_check():
    vs = []
    for f in bm.faces:
        if MATS[f.material_index] in ('road', 'pave', 'paint'): continue
        for v in f.verts: vs.append((v.co.x, v.co.y, v.co.z))
    V = np.unique(np.round(np.array(vs), 3), axis=0); bad = 0; worst = []
    for k in range(0, len(V), 4000):
        ch = V[k:k + 4000]; d2 = (ch[:, None, 0] - C[None, :, 0]) ** 2 + (ch[:, None, 1] - C[None, :, 1]) ** 2; j = d2.argmin(1); dm = np.sqrt(d2[np.arange(len(ch)), j])
        sd = (ch[:, 0] - C[j, 0]) * LF[j, 0] + (ch[:, 1] - C[j, 1]) * LF[j, 1]; rz = C[j, 2] - sd * BK[j]; hz = ch[:, 2] - rz
        m = (np.abs(sd) < 8.45) & (hz > 0.12) & (hz < 6.6) & (dm < 12)
        bad += int(m.sum()); worst += [(round(float(sd[q]), 2), round(float(hz[q]), 2), int(j[q])) for q in np.nonzero(m)[0][:3]]
    log('clearance check: %d vertices inside the barriers or under 6.6 m over the road' % bad, worst[:8])
clearance_check()

# ---------------------------------------------------------------- build the object, weld, light-picture patches
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
BLOCKS = {}
for idx_, k in enumerate('ABCDE'):
    zv = -300.0 - 0.5 * idx_
    F([Vector((PX, PY, zv)), Vector((PX + 6, PY, zv)), Vector((PX + 6, PY + 6, zv)), Vector((PX, PY + 6, zv))], 'concrete', None, [(0, 0), (8, 0), (8, 8), (0, 8)], -UP, 1.0)
me = bpy.data.meshes.new('ridge'); bm.to_mesh(me); bm.free()
for m in mats: me.materials.append(m)
mc = bpy.data.collections.new('map'); scene.collection.children.link(mc)
ob = bpy.data.objects.new('ridge', me); mc.objects.link(ob)
me.calc_loop_triangles(); NTRI = len(me.loop_triangles); log('ridge mesh:', NTRI, 'triangles,', len(me.vertices), 'verts,', len(me.polygons), 'faces')
NP = len(me.polygons); BLOCK_POLY = {}
for p in me.polygons:                                    # the two light-picture patches are the only faces under the base plane (z -1.4 / -1.45)
    zs = [me.vertices[v].co.z for v in p.vertices]
    if all(z < -299 for z in zs): BLOCK_POLY['ABCDE'[int(round(-(zs[0] + 300.0) / 0.5))]] = p.index
BLK = set(BLOCK_POLY.values()); assert len(BLK) == 5, BLOCK_POLY
BAKED = np.array([(p.material_index not in EMISSIVE and p.material_index not in SELFI) and p.index not in BLK for p in me.polygons])
def activate(o):
    vl = bpy.context.view_layer
    for q in list(vl.objects):
        if q is not None: q.select_set(False)
    vl.objects.active = o; o.select_set(True)
def pack():
    me.uv_layers.active = me.uv_layers['Lightmap']; activate(ob)
    bpy.ops.object.mode_set(mode='EDIT'); b2 = bmesh.from_edit_mesh(me); b2.faces.ensure_lookup_table()
    for f in b2.faces: f.select_set(bool(BAKED[f.index]) or f.index in BLK)
    b2.select_flush_mode(); bmesh.update_edit_mesh(me)
    bpy.ops.uv.select_all(action='SELECT')
    try: bpy.ops.uv.pack_islands(rotate=True, margin_method='FRACTION', margin=0.0011, shape_method='AABB')
    except TypeError: bpy.ops.uv.pack_islands(rotate=True, margin=0.0011)
    bpy.ops.object.mode_set(mode='OBJECT'); me.uv_layers.active = me.uv_layers['UVMap']
t0 = time.time(); pack(); log('packed the light picture UVs in %.0f s' % (time.time() - t0))
lmd = me.uv_layers['Lightmap'].data
def poly_uvbox(pi):
    us = [lmd[li].uv for li in me.polygons[pi].loop_indices]; return min(u.x for u in us), max(u.x for u in us), min(u.y for u in us), max(u.y for u in us)
bx = {k: poly_uvbox(v) for k, v in BLOCK_POLY.items()}
# a road density report: texels per metre on the road
rp = [p for p in me.polygons if p.material_index == MI['road']][:200]; ta = ua = 0.0
for p in rp:
    pts = [lmd[li].uv for li in p.loop_indices]; a = sum(pts[k].x * pts[(k + 1) % 4].y - pts[(k + 1) % 4].x * pts[k].y for k in range(4)) / 2; ua += abs(a); ta += p.area
RD = math.sqrt(ua / ta) * LMSIZE; log('road light density: %.1f texels per metre (%d px picture)' % (RD, LMSIZE))
log('thin faces given a neighbour texel:', mapkit.collapse_thin(ob, LMSIZE, min_width=0.9, reach=1.2))
for p in me.polygons:                                    # not baked: self-lit faces look at their bright patch, emissive ones sit in a corner texel
    mi = p.material_index
    if p.index in BLK: continue
    if mi in SELFI:
        k = SELFI[mi]; u0, u1, v0, v1 = bx[k]; cu, cv = (u0 + u1) / 2, (v0 + v1) / 2
        for li in p.loop_indices: lmd[li].uv = (cu, cv)
    elif mi in EMISSIVE:
        for li, (du, dv) in zip(p.loop_indices, TINY): lmd[li].uv = (0.9996 + du * 0.1, 0.9996 + dv * 0.1)

# ---------------------------------------------------------------- lights, moon, painted night sky
# ---------------------------------------------------------------- lights, moon, painted night sky: a big moon, stars, thin clouds, far peaks, the glow of a city on the plain (north)
def make_sky(W=1024):
    M = MOON
    sky = ash_paint.night_sky(W, tuple(M), aurora=0.0, zen=(0.010, 0.020, 0.060), mid=(0.018, 0.034, 0.085), hor=(0.050, 0.070, 0.130), moon_col=(0, 0, 0), halo=(0, 0, 0),
                              moon2=(0.01, 0.0, -1.0), moon2_col=(0, 0, 0), glow2=(0, 0, 0)); H = sky.shape[0]
    v = (np.arange(H, dtype=np.float32) + 0.5) / H; u = (np.arange(W, dtype=np.float32) + 0.5) / W; th = (v - 0.5) * np.pi; ph = -(u - 0.5) * 2 * np.pi
    ct = np.cos(th)[:, None]; X = ct * np.cos(ph)[None, :]; Y = ct * np.sin(ph)[None, :]; Z = np.repeat(np.sin(th)[:, None], W, 1)
    zp = np.clip(Z, 0, 1)
    wN = np.clip(Y, 0, 1) ** 2.0; wN2 = np.clip(Y, 0, 1) ** 6.0                        # the city glow: warm, low in the north; a cooler haze elsewhere
    glow = (np.exp(-zp / 0.035) * 0.9 + np.exp(-zp / 0.16) * 0.28) * (Z > -0.04)
    sky = sky + (v3(1.0, 0.52, 0.20)[None, None, :] * (0.05 + 0.95 * wN2)[..., None] * 0.24 + v3(0.20, 0.32, 0.60)[None, None, :] * 0.05) * glow[..., None]
    cl = np.clip((tn(H, W, 14, 30, 7) * 0.6 + tn(H, W, 34, 80, 8) * 0.4 - 0.55) * 3.2, 0, 1) * np.clip((Z - 0.04) / 0.1, 0, 1) * np.clip((0.7 - Z) / 0.3, 0, 1)
    ang = np.arccos(np.clip(X * M.x + Y * M.y + Z * M.z, -1, 1)); rm = math.radians(5.4)           # the moon: a large pale disc with soft maria, a halo, thin clouds in front
    surf = 0.80 + 0.22 * (fbm_t(H, W, 40, 61) - 0.5) * 2 + 0.10 * (tn(H, W, 200, 400, 62) - 0.5)
    disc = (1 - smooth(rm * 0.96, rm, ang)).astype(np.float32); limb = 1 - 0.25 * (ang / rm) ** 3
    moon = disc[..., None] * (v3(0.90, 0.94, 1.0)[None, None, :] * (1.5 * surf * limb)[..., None])
    halo = (np.exp(-ang / 0.10) * 0.16 + np.exp(-ang / 0.55) * 0.035)[..., None] * v3(0.55, 0.72, 1.0)[None, None, :] * (1 - disc)[..., None]
    sky = sky * (1 - 0.45 * cl[..., None]) + cl[..., None] * (v3(0.05, 0.07, 0.12) + halo[..., 0:1] * 3.0) * 0.5
    sky = sky * (1 - disc[..., None] * 0.97) + moon + halo
    az = np.arctan2(Y, X); hz_ = 0.030 + 0.020 * np.sin(3 * az + 1.0) + 0.014 * np.sin(7 * az + 2.0) + 0.008 * np.sin(13 * az + 4.0) + 0.004 * np.sin(29 * az + 1.0)
    hz_ = np.maximum(hz_, 0.004) * (0.10 + 0.90 * (1 - np.exp(-((az - math.pi / 2) / 0.8) ** 2))); inside = Z < hz_                # far peaks round the horizon, low on the plain side
    tt = np.clip(Z / (hz_ + 1e-4), 0, 1)[..., None]; rim = (np.clip(1 - (hz_ - Z) / 0.006, 0, 1) * inside)[..., None]
    snowc = ((tt[..., 0] > 0.72) & (tn(H, W, 120, 30, 63) > 0.4) & inside)[..., None]
    ridge = v3(0.040, 0.056, 0.098)[None, None, :] * (1 - tt) + v3(0.014, 0.020, 0.042)[None, None, :] * tt + v3(0.05, 0.065, 0.11) * snowc + v3(0.09, 0.12, 0.2) * rim * 0.5
    ridge = ridge + (v3(1.0, 0.5, 0.2) * 0.05 * wN2[..., None]) * np.exp(-np.clip(Z, 0, 1) / 0.03)[..., None]
    sky = np.where(inside[..., None], ridge, sky)
    path = os.path.join(TEXDIR, 'ridge_night_sky.exr'); old = bpy.data.images.get('ridge_night_sky')
    if old: bpy.data.images.remove(old)
    im = bpy.data.images.new('ridge_night_sky', W, H, alpha=False, float_buffer=True); im.pixels.foreach_set(np.concatenate([sky.astype(np.float32), np.ones((H, W, 1), np.float32)], 2).ravel())
    ash_paint.save_exr_linear(im, path); bpy.data.images.remove(im); im = bpy.data.images.load(path); im.name = 'ridge_night_sky'
    w = bpy.data.worlds.new('ridge_sky'); scene.world = w; w.use_nodes = True; nt = w.node_tree
    for nd in list(nt.nodes): nt.nodes.remove(nd)
    out = nt.nodes.new('ShaderNodeOutputWorld'); bg = nt.nodes.new('ShaderNodeBackground'); env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = im
    nt.links.new(env.outputs['Color'], bg.inputs['Color']); nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    lp = nt.nodes.new('ShaderNodeLightPath'); mr = nt.nodes.new('ShaderNodeMapRange'); nt.links.new(lp.outputs['Is Camera Ray'], mr.inputs['Value'])
    mr.inputs['To Min'].default_value = float(OPT.get('skyk', 7.0)); mr.inputs['To Max'].default_value = 1.0; nt.links.new(mr.outputs['Result'], bg.inputs['Strength'])
    scene.view_settings.exposure = 0.0
    return M
def build_lights():
    lc = bpy.data.collections.new('lights'); scene.collection.children.link(lc)
    M = make_sky(int(OPT.get('skyw', 2048)))
    sd = bpy.data.lights.new('Moon', 'SUN'); sd.energy = float(OPT.get('moon', 5.0)); sd.color = (0.58, 0.70, 1.0); sd.angle = math.radians(1.2)
    so = bpy.data.objects.new('Moon', sd); lc.objects.link(so); so.rotation_euler = (-M).to_track_quat('-Z', 'Y').to_euler()
    for k, (p, col, W, r) in enumerate(LIGHTS):
        ld = bpy.data.lights.new('L%d' % k, 'POINT'); ld.energy = W * float(OPT.get('lk', 1.0)); ld.color = col; ld.shadow_soft_size = r
        lo = bpy.data.objects.new('L%d' % k, ld); lc.objects.link(lo); lo.location = p
    gl = bpy.data.collections.new('glows'); scene.collection.children.link(gl)
    for k, (p, col, size) in enumerate(GLOWS):
        e = bpy.data.objects.new('glow.%03d' % k, None); e.empty_display_type = 'PLAIN_AXES'; e.empty_display_size = 0.3; gl.objects.link(e); e.location = p
        e['r'], e['g'], e['b'], e['size'] = col[0], col[1], col[2], size
    log('lights:', len(LIGHTS), 'glows:', len(GLOWS))
build_lights()

# ---------------------------------------------------------------- bake the light picture
def bake(samples=48):
    lm = me.uv_layers['Lightmap']; me.uv_layers.active = lm
    img = bpy.data.images.new('ridge_light', LMSIZE, LMSIZE, alpha=False, float_buffer=True)
    for m in me.materials:
        nt = m.node_tree; n = nt.nodes.new('ShaderNodeTexImage'); n.name = 'hg_bake'; n.image = img; nt.nodes.active = n
    scene.render.engine = 'CYCLES'; scene.cycles.samples = samples; scene.cycles.device = 'CPU'
    try: scene.cycles.use_denoising = False
    except Exception: pass
    for a, v in (('diffuse_bounces', 2), ('max_bounces', 4), ('sample_clamp_indirect', 4.0), ('sample_clamp_direct', 40.0), ('use_adaptive_sampling', False)):
        try: setattr(scene.cycles, a, v)
        except Exception: pass
    activate(ob); scene.render.bake.margin = 5
    t0 = time.time(); bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=5, use_clear=True); log('baked in %.0f s' % (time.time() - t0))
    a = np.array(img.pixels[:], np.float32).reshape(LMSIZE, LMSIZE, 4)
    rgb, fired = mapkit.clean_light(a[:, :, :3]); log('fireflies replaced:', fired)
    a[:, :, :3] = rgb
    lum0 = rgb @ np.array((0.3, 0.59, 0.11), np.float32); nz0 = lum0[lum0 > 0.002]
    Lref = float(np.percentile(nz0, 90))
    for k_, f_ in (('C', 1.0), ('D', 0.6), ('E', 0.3)): SELF_L[k_] = Lref * f_ * float(OPT.get('pinek', 1.3))
    log('pine patches', SELF_L)
    for k in 'ABCDE':                                        # the self-lit patches: a fixed brightness the colour picture is multiplied by
        u0, u1, v0, v1 = bx[k]; x0 = int(math.ceil(u0 * LMSIZE)) + 3; x1 = int(math.floor(u1 * LMSIZE)) - 3; y0 = int(math.ceil(v0 * LMSIZE)) + 3; y1 = int(math.floor(v1 * LMSIZE)) - 3
        a[y0:y1, x0:x1, :3] = SELF_L[k]; log('self-lit patch', k, 'texels', x1 - x0, 'x', y1 - y0, 'L', SELF_L[k])
    img.pixels.foreach_set(a.ravel())
    path = os.path.join(TEXDIR, 'ridge_light.exr'); ash_paint.save_exr_linear(img, path)
    for m in me.materials:
        n = m.node_tree.nodes.get('hg_bake')
        if n: m.node_tree.nodes.remove(n)
    me.uv_layers.active = me.uv_layers['UVMap']
    lum = rgb @ np.array((0.3, 0.59, 0.11), np.float32); nz = lum[lum > 0]
    log('light picture: median %.2f, 90%% %.2f, 99%% %.2f, 99.9%% %.2f' % (float(np.median(nz)), float(np.percentile(nz, 90)), float(np.percentile(nz, 99)), float(np.percentile(nz, 99.9))))
    bpy.data.images.remove(img)
if 'nobake' not in OPT: bake(int(OPT.get('samples', 48)))
cfg = {'blend': 'ridge.blend', 'out': '../../Nightline/assets/ridge',
       'world': {'collections': ['map'], 'lightmap': 'tex/ridge_light.exr', 'lmSize': LMSIZE, 'lmRange': 8},
       'sky': {'width': 2048}, 'maxTexture': 2048}
with open(os.path.join(BASE, 'ridge.export.json'), 'w') as f: json.dump(cfg, f, indent=1)
bpy.ops.wm.save_mainfile(); log('saved', bpy.data.filepath, '|', NTRI, 'triangles,', len(mats), 'materials,', len(LIGHTS), 'lights,', len(GLOWS), 'glows')
log('done')
