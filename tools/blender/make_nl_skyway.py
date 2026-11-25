# NIGHTLINE circuit 2 "SKYWAY NINE": an elevated expressway through a financial district at night after rain, built round art/nightline/skyway.track.json (the fixed road).
#   "C:/Program Files/Blender Foundation/Blender 4.5/blender.exe" -b --factory-startup -P tools/blender/make_nl_skyway.py -- [samples=48] [nobake] [lm=4096]
# then  node tools/export-art.mjs skyway   ->  Nightline/assets/skyway.hgm (+ pictures).   Same pipeline as the Ashfall maps (make_yard.py):
# one mesh, tiling pictures, packed 'Lightmap' UV, a Cycles bake of the light (lamps, neon, moon, sky) into art/nightline/tex/skyway_light.exr.
# Axes: game (x, y, z) -> Blender (x, -z, y). Road ribbons come straight from the samples (centre, tangent, bank).
# Self-lit pictures (neon signs, skyline, glass towers): the hgm has no unlit textures, so those faces point their Lightmap UV at a patch
# of the light picture that is painted a fixed brightness after the bake (colour picture x that light = the picture, glowing).
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
if not bpy.data.filepath.replace('\\', '/').endswith('art/nightline/skyway.blend'):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, 'skyway.blend')); log('created', bpy.data.filepath)
for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
for c in list(bpy.data.collections): bpy.data.collections.remove(c)
for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras, bpy.data.images):
    for d in list(coll):
        if d.users == 0: coll.remove(d)
rng = random.Random(11)
LMSIZE = int(OPT.get('lm', 4096))

# ---------------------------------------------------------------- the road: samples in Blender axes
trk = json.load(open(os.path.join(BASE, 'skyway.track.json')))
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
def ramp(i, a, b, r=12):                                  # 1 inside [a, b), smooth to 0 over r samples outside
    if a <= i < b: return 1.0
    d = (a - i) if i < a else (i - b + 1)
    t = max(0.0, 1 - d / r); return t * t * (3 - 2 * t)
def BF(i): return ramp(i % N, IB0, IB1)
def TF(i): return ramp(i % N, IT0, IT1)
def BRIDGE(i): return IB0 <= i % N < IB1
def TUNNEL(i): return IT0 <= i % N < IT1
def GC(i):                                                # ground beside the road: just under the road plane; a shore at the bridge; a hill at the tunnel
    i0 = i % N; return C[i0, 2] - 0.12 - BF(i0) * (C[i0, 2] + 0.48) + TF(i0) * 9.0
def zone(t):
    t %= 1.0
    if t < 0.17 or t >= 0.93: return 'harbor'
    if t < 0.24: return 'terminal'
    if t < 0.31: return 'bridge'
    if t < 0.45: return 'avenue'
    if t < 0.60: return 'park'
    if t < 0.70: return 'tunnel'
    if t < 0.80: return 'downtown'
    return 'oldtown'
def QUAYSIDE(i): return C[i % N, 1] + LF[i % N, 1] * 16.0 > 183.0      # the left outer edge is on the harbour
log('track', N, 'samples, length %.0f m, bridge %d..%d tunnel %d..%d' % (LEN, IB0, IB1, IT0, IT1))


# ---------------------------------------------------------------- colours and the pictures (all painted here; values are sRGB, as seen)
COL = {'sodium': (1.0, 0.50, 0.14), 'cyan': (0.10, 0.85, 1.0), 'magenta': (1.0, 0.10, 0.70), 'amber': (1.0, 0.62, 0.10), 'green': (0.20, 1.0, 0.35),
       'red': (1.0, 0.08, 0.06), 'wwarm': (1.0, 0.76, 0.42), 'wcool': (0.70, 0.86, 1.0)}
EMIT_K = {'sodium': 3.5, 'cyan': 4.0, 'magenta': 4.0, 'amber': 3.5, 'green': 3.5, 'red': 4.0, 'wwarm': 1.5, 'wcool': 2.2}
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


def pave_pixels(N=1024):
    y, x = np.mgrid[0:N, 0:N].astype(np.float32); um = x / N * 4.0; vm = y / N * 4.0
    n1 = fbm_t(N, N, 5, 61); fine = grain(N, N, 0.05, 62)
    a = v3(0.30, 0.305, 0.33) * (0.7 + 0.6 * n1)[..., None] + fine[..., None]
    slab = (np.minimum(um % 1.0, 1 - um % 1.0) < 0.012) | (np.minimum(vm % 1.0, 1 - vm % 1.0) < 0.012); a[slab] *= 0.55
    pm = np.clip(blur(tn(N, N, 7, 7, 63) - 0.5, 6) * 8 + 0.5, 0, 1); a = a * (1 - 0.3 * pm[..., None]) + v3(0.9, 0.5, 0.35) * (pm * tn(N, N, 4, 4, 64) * 0.06)[..., None]
    return np.clip(a, 0.01, 1)
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

def roof_pixels(N=512):
    a = v3(0.22, 0.22, 0.25) * (0.7 + 0.6 * fbm_t(N, N, 5, 101))[..., None] + grain(N, N, 0.05, 102)[..., None]
    y, x = np.mgrid[0:N, 0:N]; a[(x % 128) < 2] *= 0.6; return np.clip(a, 0.01, 1)
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
COL['ice'] = (0.82, 0.93, 1.0); COL['blue'] = (0.35, 0.60, 1.0)
EMIT_K['ice'] = 3.0; EMIT_K['blue'] = 3.6
SIGNS = [('AXIOM', 'cyan'), ('VANTA', 'ice'), ('STRATA', 'amber'), ('KRONOS', 'magenta'), ('HELIX', 'blue'), ('NOVARA', 'cyan'), ('TOLL', 'green'), ('NIGHTLINE', 'red')]
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
def glass_pixels(kind, seed, N=1024):
    """self-lit glass tower wall: 12 m wide x 30.4 m high = 8 columns x 8 floors (3.8 m); lit floors cool white / pale blue / warm amber"""
    r = np.random.default_rng(seed); a = np.zeros((N, N, 3), np.float32) + v3(0.105, 0.125, 0.165)
    cw = N // 8; ch = N // 8
    pal = {'a': [(v3(1.0, 0.74, 0.38), .62), (v3(1.0, 0.86, 0.62), .18), (v3(0.72, 0.86, 1.0), .12), (v3(0.45, 0.80, 1.0), .08)],
           'b': [(v3(0.80, 0.90, 1.0), .38), (v3(0.50, 0.72, 1.0), .36), (v3(0.40, 0.85, 1.0), .14), (v3(1.0, 0.78, 0.45), .12)],
           'c': [(v3(1.0, 0.74, 0.40), .35), (v3(0.80, 0.90, 1.0), .35), (v3(0.55, 0.75, 1.0), .2), (v3(1.0, 0.35, 0.75), .04), (v3(0.4, 0.9, 1.0), .06)]}[kind]
    cols = [p[0] for p in pal]; pr = np.array([p[1] for p in pal]); pr = pr / pr.sum(); pl = {'a': 0.50, 'b': 0.55, 'c': 0.36}[kind]
    # offices, not a chequerboard: 16 narrow windows a floor, lit in RUNS (a whole office, a corridor), one colour a run, a floor now and then dark
    NC = 16; cw = N // NC
    for fy in range(8):
        f = r.random(); pf = min(0.92, pl * (0.25 + 1.3 * f)); fx = 0
        if r.random() < 0.14: pf = 0.04                                    # an empty floor
        while fx < NC:
            run = int(r.integers(1, 6)); lit = r.random() < pf; c = cols[int(r.choice(len(cols), p=pr))] * (0.50 + 0.30 * r.random()); c = c * 0.8 + c.mean() * 0.2      # a little less colour
            for k in range(fx, min(NC, fx + run)):
                x0 = k * cw + 3; x1 = (k + 1) * cw - 3; y0 = fy * ch + 30; y1 = (fy + 1) * ch - 8
                if lit:
                    a[y0:y1, x0:x1] = c * (0.88 + 0.12 * r.random()); a[y1 - 14:y1, x0:x1] *= 0.6; a[y0:y0 + 10, x0:x1] *= 0.75      # a ceiling band of light, a darker sill
                    if r.random() < 0.3: a[y0 + 12:y0 + 40, x0:x1] *= 0.55                                                              # a desk, a blind
                else:
                    a[y0:y1, x0:x1] = v3(0.03, 0.045, 0.075) + v3(0.02, 0.03, 0.05) * r.random()
            fx += run
        a[fy * ch:fy * ch + 24, :] = v3(0.085, 0.10, 0.135)
    a += grain(N, N, 0.02, seed + 5)[..., None]
    return np.clip(a, 0.01, 1)
def word_mask(H, W, word, x0, y0, sc):
    m = np.zeros((H, W), np.float32)
    for ci, ch in enumerate(word):
        rows = FONT[ch].split('|')
        for ry in range(7):
            for rx in range(5):
                if rows[ry][rx] == '#':
                    px = x0 + (ci * 6 + rx) * sc; py = y0 + (6 - ry) * sc
                    if 0 <= px and px + sc <= W and 0 <= py and py + sc <= H: m[py + 1:py + sc - 1, px + 1:px + sc - 1] = 1.0
    return m
def led_pixels():
    """4 screens of 1024 x 512 (2 x 2, row 0 at the bottom): bright advertising pictures"""
    out = np.zeros((1024, 2048, 3), np.float32); yy, xx = np.mgrid[0:512, 0:1024].astype(np.float32); r = np.random.default_rng(210)
    for k in range(4):
        g = xx / 1024 * 0.5 + yy / 512 * 0.5; word = ['VANTA', 'STRATA', 'AXIOM', 'KRONOS'][k]
        if k == 0: a = mix(np.zeros((512, 1024, 3), np.float32) + v3(0.02, 0.08, 0.28), np.zeros((512, 1024, 3), np.float32) + v3(0.10, 0.85, 1.0), g); a = a + v3(0.1, 0.8, 1.0) * (np.exp(-((np.hypot(xx - 760, yy - 256) % 60 - 30) ** 2) / 40) * 0.35)[..., None]
        elif k == 1: a = v3(0.55, 0.18, 0.02) * (1 - g)[..., None] + v3(1.0, 0.72, 0.2) * g[..., None]; a = a * (0.8 + 0.2 * np.sin(yy / 9.0))[..., None]
        elif k == 2:
            a = np.zeros((512, 1024, 3), np.float32) + v3(0.03, 0.05, 0.10)
            for b in range(24):
                h = int(60 + r.random() * 330); c = v3(0.8, 0.92, 1.0) if b % 3 else v3(0.35, 0.6, 1.0); a[0:h, b * 42 + 4:b * 42 + 38] = c * (0.55 + 0.45 * r.random())
        else: a = mix(np.zeros((512, 1024, 3), np.float32) + v3(0.20, 0.02, 0.28), np.zeros((512, 1024, 3), np.float32) + v3(1.0, 0.15, 0.62), g)
        sc = int(min(16, 820 // (6 * len(word)))); tw = 6 * len(word) * sc; m = word_mask(512, 1024, word, (1024 - tw) // 2, 256 - 3 * sc, sc)
        a = a * (1 - 0.55 * blur(m, 14)[..., None]) + v3(1, 1, 1) * m[..., None] * 0.95 + v3(1, 1, 1) * (blur(m, 8) * 0.4)[..., None]
        a[::4] *= 0.82; out[(k // 2) * 512:(k // 2) * 512 + 512, (k % 2) * 1024:(k % 2) * 1024 + 1024] = np.clip(a, 0.02, 1)
    return out
def dsign_pixels():
    """4 green motorway direction signs of 1024 x 512 (2 x 2): white border, two lines of text, an arrow"""
    out = np.zeros((1024, 2048, 3), np.float32); yy, xx = np.mgrid[0:512, 0:1024].astype(np.float32)
    TXT = [('CENTRAL 4', 'NORTH BRIDGE', 'up'), ('AIRPORT 23', 'HARBOUR 11', 'right'), ('RIVER BRIDGE', 'DOCKS 7', 'up'), ('EAST LOOP', 'CITY EXIT 2', 'left')]
    for k, (l1, l2, ar) in enumerate(TXT):
        a = np.zeros((512, 1024, 3), np.float32) + v3(0.02, 0.27, 0.11) * (0.92 + 0.08 * tn(512, 1024, 8, 4, 220 + k))[..., None]
        brd = ((xx > 12) & (xx < 1012) & (yy > 12) & (yy < 500)) & ~((xx > 26) & (xx < 998) & (yy > 26) & (yy < 486)); a[brd] = v3(0.92, 0.95, 0.92)
        for ln, yb in ((l1, 290), (l2, 110)):
            sc = int(min(12, 700 // (6 * len(ln)))); m = word_mask(512, 1024, ln, 50, yb, sc); a = a * (1 - m[..., None]) + v3(0.95, 0.97, 0.95) * m[..., None]
        cx, cy = 890.0, 256.0
        if ar == 'up': ma = ((np.abs(xx - cx) < 22) & (yy > cy - 110) & (yy < cy + 20)) | ((yy >= cy + 20) & (yy < cy + 120) & (np.abs(xx - cx) < (cy + 120 - yy) * 0.8))
        else:
            sg = 1 if ar == 'right' else -1; dx = (xx - cx) * sg
            ma = ((np.abs(yy - cy) < 22) & (dx > -110) & (dx < 20)) | ((dx >= 20) & (dx < 120) & (np.abs(yy - cy) < (120 - dx) * 0.8))
        a[ma] = v3(0.95, 0.97, 0.95); out[(k // 2) * 512:(k // 2) * 512 + 512, (k % 2) * 1024:(k % 2) * 1024 + 1024] = np.clip(a, 0.01, 1)
    return out
def carpark_pixels(N=1024):
    """open car park, 24 m x 12 m = 4 levels: slab band, dark open level with a cool white light strip, columns, parked cars with tail lights"""
    r = np.random.default_rng(230); a = np.zeros((N, N, 3), np.float32) + v3(0.02, 0.025, 0.04); y, x = np.mgrid[0:N, 0:N].astype(np.float32)
    for l in range(4):
        y0 = l * 256; a[y0:y0 + 46] = v3(0.12, 0.13, 0.15) * (0.8 + 0.4 * tn(46, N, 24, 2, 231 + l))[..., None]
        a[y0 + 46:y0 + 52] = v3(0.22, 0.23, 0.26)
        glow = np.exp(-np.clip(y0 + 256 - y[y0 + 52:y0 + 256], 0, 999) / 36.0)[..., None]; a[y0 + 52:y0 + 256] += glow * v3(0.30, 0.36, 0.42) * 0.55
        a[y0 + 226:y0 + 242] = v3(0.80, 0.92, 1.0) * 0.95
        for cx in range(0, N, 64):
            if r.random() < 0.55:
                w = int(r.integers(34, 52)); c = v3(*(0.05 + 0.25 * r.random(3))); a[y0 + 58:y0 + 98, cx + 6:cx + 6 + w] = c
                a[y0 + 66:y0 + 72, cx + 8:cx + 14] = v3(1.0, 0.1, 0.08); a[y0 + 66:y0 + 72, cx + 2 + w:cx + 8 + w] = v3(1.0, 0.1, 0.08)
    a[:, (x[0] % 256) < 16] = a[:, (x[0] % 256) < 16] * 0.0 + v3(0.16, 0.17, 0.19)
    return np.clip(a, 0.01, 1)
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
def skyline_pixels(W=2048, H=512, seed=170):
    """a far skyline strip, tileable sideways (about 920 m x 230 m): dark glass towers, lit windows cool white / blue / amber, beacons, cool haze at the foot"""
    r = np.random.default_rng(seed); a = np.zeros((H, W, 3), np.float32); haze = np.exp(-np.arange(H, dtype=np.float32) / 80.0)[:, None, None]
    gy = np.clip(np.arange(H, dtype=np.float32) / 420.0, 0, 1)[:, None, None]; a += (v3(0.06, 0.09, 0.15) * gy + v3(0.03, 0.045, 0.08) * (1 - gy)) + haze * v3(0.16, 0.24, 0.36) * 0.8
    x = 0
    while x < W:
        w = int(r.integers(30, 100)); h = int(r.integers(120, 330) if r.random() < 0.7 else r.integers(320, 490)); w = min(w, W - x)
        a[:h, x:x + w] = v3(0.04, 0.055, 0.09) * (0.8 + 0.4 * r.random())
        for wy in range(14, h - 8, 12):
            for wx in range(x + 5, x + w - 5, 9):
                if r.random() < 0.36:
                    c = v3(1.0, 0.80, 0.48) if r.random() < 0.4 else (v3(0.78, 0.9, 1.0) if r.random() < 0.6 else v3(0.4, 0.7, 1.0)); a[wy:wy + 5, wx:wx + 5] = c * (0.5 + 0.5 * r.random())
        if h > 300:
            cc = [v3(0.8, 0.92, 1.0), v3(0.1, 0.8, 1.0), v3(1.0, 0.7, 0.3)][r.integers(3)]; a[h - 10:h - 4, x + 3:x + w - 3] = cc; a[h:h + 14, x + w // 2 - 1:x + w // 2 + 2] = v3(1.0, 0.1, 0.05)
        x += w + int(r.integers(0, 6))
    return np.clip(a, 0.0, 1)


PICS = {}
def pictures():
    spec = {'road': road_pixels(2048, 2048), 'pave': pave_pixels(), 'concrete': concrete_pixels(), 'tunnel': tunnel_pixels(), 'metal': metal_pixels(), 'roof': roof_pixels(),
            'water': water_pixels(), 'sign': sign_atlas(), 'led': led_pixels(), 'dsign': dsign_pixels(), 'glass_a': glass_pixels('a', 301), 'glass_b': glass_pixels('b', 302),
            'glass_c': glass_pixels('c', 303), 'carpark': carpark_pixels(), 'ground': ground_pixels(), 'sky': skyline_pixels()}
    for k, a in spec.items(): PICS[k] = save_image(np.ascontiguousarray(a, dtype=np.float32), 'sk_' + k, TEXDIR)
    log('pictures', len(PICS))
pictures()
SELFLIT = {'sign': 'A', 'led': 'A', 'dsign': 'B', 'glass_a': 'B', 'glass_b': 'B', 'glass_c': 'B', 'carpark': 'B', 'ground': 'B', 'sky': 'B'}; SELF_L = {'A': 3.2, 'B': 1.5}
TEXMATS = ['road', 'pave', 'concrete', 'tunnel', 'metal', 'roof', 'water', 'sign', 'led', 'dsign', 'glass_a', 'glass_b', 'glass_c', 'carpark', 'ground', 'sky']
MATS = TEXMATS + ['paint'] + ['emissive_' + k for k in COL]
MI = {n: i for i, n in enumerate(MATS)}
def make_materials():
    out = []
    for k in MATS:
        if k in PICS:
            m = image_material('sk_' + k, PICS[k], 0.35 if k in ('road', 'pave', 'water') else 0.55, 0.0)
        elif k == 'paint':
            m = bpy.data.materials.new('sk_paint'); m.use_nodes = True; b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
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
# nearest road sample (any) to a ground point: distance and side
CSXY = C[:, :2]
def nearest(x, y):
    d2 = (CSXY[:, 0] - x) ** 2 + (CSXY[:, 1] - y) ** 2; i = int(np.argmin(d2)); return i, math.sqrt(float(d2[i]))

def ground_z(x, y): return 0.0


# ---------------------------------------------------------------- the world: ground z = 0, a river under the bridge, helpers
X0, X1, Y0, Y1 = -470.0, 470.0, -320.0, 290.0
WZ = -4.0                                                 # water level
DET = {}
def cnt_(k): DET[k] = DET.get(k, 0) + 1
def plain(i, m=4): return not any(BRIDGE(i + j) or TUNNEL(i + j) for j in range(-m, m + 1))
def RIGHT(n): return UP.cross(n)
def roadtop(i): return max(P(i, 7.0).z, P(i, -7.0).z)     # the highest road surface across the width: things over the road hang 6.9 m above this
def dpanel_uv(k):
    u0 = (k % 2) * 0.5 + 0.004; u1 = u0 + 0.492; v0 = (k // 2) * 0.5 + 0.006; v1 = v0 + 0.488
    return [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
PL = []; _PA = [None]
def occupy(x, y, r): PL.append((x, y, r)); _PA[0] = None
def free(x, y, r, slack=3.0):
    if _PA[0] is None: _PA[0] = np.array(PL, float).reshape(-1, 3)
    a = _PA[0]
    if len(a) == 0: return True
    return bool(np.all(np.hypot(a[:, 0] - x, a[:, 1] - y) > r + a[:, 2] - slack))
def rect_circles(cc, ex, w, dep):
    n = max(1, int(round(w / dep))); r = max(dep, w / n) / 2.0
    return [(cc.x + ex.x * (-w / 2 + w * (k + 0.5) / n), cc.y + ex.y * (-w / 2 + w * (k + 0.5) / n), r) for k in range(n)]
# river: strip across the bridge, perpendicular to its chord
_ia, _ib = IB0, IB1 - 1
_ch = C[_ib, :2] - C[_ia, :2]; _ch = _ch / np.linalg.norm(_ch)
UA = Vector((_ch[0], _ch[1], 0)); US = Vector((-_ch[1], _ch[0], 0)); MC = Vector(((C[_ia, 0] + C[_ib, 0]) / 2, (C[_ia, 1] + C[_ib, 1]) / 2, 0))
RA = (C[:, 0] - MC.x) * UA.x + (C[:, 1] - MC.y) * UA.y; RS = (C[:, 0] - MC.x) * US.x + (C[:, 1] - MC.y) * US.y
_near = [j % N for j in list(range(IB0 - 40, IB0)) + list(range(IB1, IB1 + 40))]
WR = float(max(90, min(120, int((min(abs(RA[j]) for j in _near) - 12) / 30) * 30)))
_nonb = [i for i in range(N) if not any((i - j) % N == 0 for j in _near) and not BRIDGE(i) and abs(RA[i]) < WR + 14]
S1 = float(max(60, min(420, int((min([-RS[i] for i in _nonb if RS[i] < 0] or [999]) - 50) / 30) * 30)))
S2 = float(max(60, min(420, int((min([RS[i] for i in _nonb if RS[i] > 0] or [999]) - 50) / 30) * 30)))
def RP(a, s, z=0.0): return Vector((MC.x + UA.x * a + US.x * s, MC.y + UA.y * a + US.y * s, z))
def _inw(x, y): return X0 + 25 < x < X1 - 25 and Y0 + 25 < y < Y1 - 25
while S2 > 60 and not all(_inw(*RP(a, S2)[:2]) for a in (-WR, WR)): S2 -= 30.0
while S1 > 60 and not all(_inw(*RP(a, -S1)[:2]) for a in (-WR, WR)): S1 -= 30.0
log('river: half width', WR, 'length behind/ahead', S1, S2, 'bridge samples outside the strip:', sum(1 for i in range(IB0, IB1) if abs(RA[i]) >= WR))
def in_river(x, y, m=0.0):
    a = (x - MC.x) * UA.x + (y - MC.y) * UA.y; s = (x - MC.x) * US.x + (y - MC.y) * US.y
    return abs(a) < WR + m and -S1 - m < s < S2 + m
def gzv(x, y): return WZ if in_river(x, y) else 0.0
def wall(A, B, z0, z1, n, mat, u0=0.0, tilev=30.4, tileu=12.0):
    L = (B - A).length; A = Vector((A.x, A.y, 0)); B = Vector((B.x, B.y, 0))
    F([A + UP * z0, B + UP * z0, B + UP * z1, A + UP * z1], mat, [(u0 / tileu, z0 / tilev), ((u0 + L) / tileu, z0 / tilev), ((u0 + L) / tileu, z1 / tilev), (u0 / tileu, z1 / tilev)], None, n)
def column(x, y, z0, z1, r, mat='concrete', n=8):
    pts = [(x + r * math.cos(2 * math.pi * k / n + 0.39), y + r * math.sin(2 * math.pi * k / n + 0.39)) for k in range(n)]
    for k in range(n):
        a = pts[k]; b = pts[(k + 1) % n]
        F([Vector((a[0], a[1], z0)), Vector((b[0], b[1], z0)), Vector((b[0], b[1], z1)), Vector((a[0], a[1], z1))], mat, None, None, Vector(((a[0] + b[0]) / 2 - x, (a[1] + b[1]) / 2 - y, 0)), 0.15, 3.0)
TOLL0, TOLL1 = 12, 32
def ew(i):                                                # half width of the deck: 9.8 m, wider under the toll canopy
    return 9.8 + 4.4 * ramp(i % N, TOLL0 - 2, TOLL1 + 2, 6)

# ---------------------------------------------------------------- THE ROAD, parapets, deck
ribbon(0, N, lambda i: [P(i, -7.0), P(i, 7.0)], 'road', UP, tile=(14.0, 18.0), dens=1.0)
for sg in (1, -1):
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 7.0), P(i, sg * 8.5)] if sg > 0 else [P(i, -8.5), P(i, -7.0)], 'pave', UP, tile=(4, 4), dens=0.6)
for sg in (1, -1):
    inward = lambda i, sg=sg: -LFv(i) * sg; outward = lambda i, sg=sg: LFv(i) * sg
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 8.5), P(i, sg * 8.5, 1.0)], 'concrete', inward, tile=(3, 3), dens=0.9)
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 8.5, 1.0), P(i, sg * 9.0, 1.0)], 'concrete', UP, tile=(3, 3), dens=0.3)
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 9.0, 1.0), P(i, sg * 9.0, 0.0)], 'concrete', outward, tile=(3, 3), dens=0.3)
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 8.485, 0.78), P(i, sg * 8.485, 0.93)], 'emissive_ice', inward)
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 8.58, 1.012), P(i, sg * 8.80, 1.012)], 'emissive_ice', UP)
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 9.0), P(i, sg * ew(i))], 'concrete', UP, tile=(3, 3), dens=0.4)
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * ew(i)), P(i, sg * ew(i), -1.5)], 'concrete', outward, tile=(3, 3), dens=0.3)
    for i in range(0, N, 4): RGL(P(i, sg * 8.6, 1.05), 'ice', 11.0)
ribbon(0, N, lambda i: [P(i, -ew(i), -1.5), P(i, ew(i), -1.5)], 'concrete', -UP, tile=(3, 3), dens=0.3)
log('road + deck:', NFACE[0], 'faces')

# ---------------------------------------------------------------- pillars with hammerhead crossbeams, bridge piers
for i in range(5, N, 10):
    if any(TUNNEL(i + j) for j in range(-6, 7)) or any(BRIDGE(i + j) for j in range(-3, 4)): continue
    p = P(i, 0, -1.55); g = gzv(p.x, p.y); zt = p.z
    column(p.x, p.y, g - 0.3, zt - 1.8, 1.35)
    bbox(p.x, p.y, zt - 2.0, PSI[i], 2.6, 12.0, 2.45, 'concrete', dens=0.2, top=False, bottom=True); cnt_('pillar')
for i in range(IB0 + 6, IB1 - 3, 24):
    p = P(i, 0, -1.55); g = gzv(p.x, p.y); zt = p.z
    bbox(p.x, p.y, g - 0.3, PSI[i], 3.2, 6.0, zt - 2.2 - g + 0.3, 'concrete', dens=0.2, top=False, bottom=False)
    bbox(p.x, p.y, zt - 2.2, PSI[i], 3.4, 13.0, 2.65, 'concrete', dens=0.2, top=False, bottom=True); cnt_('pier')

# ---------------------------------------------------------------- the ground (a rotated grid parallel to the river), water, embankments
def ground():
    n = 0
    for ai in range(-26, 26):
        for si in range(-26, 26):
            a0 = ai * 30.0; s0 = si * 30.0; ac = a0 + 15; sc = s0 + 15
            cp = RP(ac, sc)
            if not (X0 - 45 < cp.x < X1 + 45 and Y0 - 45 < cp.y < Y1 + 45): continue
            if abs(ac) < WR and -S1 < sc < S2: continue
            vs = [RP(a0, s0), RP(a0 + 30, s0), RP(a0 + 30, s0 + 30), RP(a0, s0 + 30)]
            F(vs, 'ground', [(v.x * UA.x / 240.0 + v.y * UA.y / 240.0, v.x * US.x / 240.0 + v.y * US.y / 240.0) for v in vs], None, UP); n += 1
    log('ground cells:', n)
ground()
F([RP(-WR, -S1, WZ), RP(WR, -S1, WZ), RP(WR, S2, WZ), RP(-WR, S2, WZ)], 'water', None, None, UP, 0.05, 40.0)
for sgn in (1, -1):
    F([RP(sgn * WR, -S1, 0), RP(sgn * WR, S2, 0), RP(sgn * WR, S2, WZ), RP(sgn * WR, -S1, WZ)], 'concrete', None, None, -UA * sgn, 0.05, 6.0)
    F([RP(sgn * (WR - 0.05), -S1, -0.75), RP(sgn * (WR - 0.05), S2, -0.75), RP(sgn * (WR - 0.05), S2, -0.55), RP(sgn * (WR - 0.05), -S1, -0.55)], 'emissive_ice', None, None, -UA * sgn)
for sgn in (1, -1):
    F([RP(-WR, sgn * S2 if sgn > 0 else -S1, 0), RP(WR, sgn * S2 if sgn > 0 else -S1, 0), RP(WR, sgn * S2 if sgn > 0 else -S1, WZ), RP(-WR, sgn * S2 if sgn > 0 else -S1, WZ)], 'concrete', None, None, -US * sgn, 0.05, 6.0)
for s in range(int(-S1) + 12, int(S2) - 6, 24):         # lit embankment: lamp posts on both promenades, a light point on the wall
    for sgn in (1, -1):
        p = RP(sgn * (WR + 3.5), s); obox(Vector((p.x, p.y, 3.0)), Vector((1, 0, 0)), Vector((0, 1, 0)), UP, 0.12, 0.12, 3.0, 'metal', dens=1.0, bottom=False)
        hp = Vector((p.x, p.y, 6.1)); obox(hp, Vector((1, 0, 0)), Vector((0, 1, 0)), UP, 0.5, 0.5, 0.08, 'emissive_wcool', dens=1.0); GLW(hp, 'wcool', 8.0)
        if abs(s) < 200: RGL(RP(sgn * (WR - 0.2), s + 12, -0.6), 'ice', 12.0)
def boat(a, s, yaw, L, kind):
    c = RP(a, s); ex, ey, _ = yaw_axes(yaw); zc = WZ + 0.55
    obox(Vector((c.x, c.y, zc)), ex, ey, UP, L / 2, L * 0.14, 0.75, 'metal', dens=0.1, bottom=True)
    obox(Vector((c.x, c.y, zc + 0.75)) + ex * L * 0.38, ex, ey, UP, L * 0.10, L * 0.12, 0.2, 'metal', dens=0.1, bottom=False)
    cb = c + ex * (-L * 0.1); zb = zc + 0.75
    obox(Vector((cb.x, cb.y, zb + 0.9)), ex, ey, UP, L * 0.2, L * 0.1, 0.9, 'paint', dens=0.1, bottom=False)
    for sgn in (1, -1):
        for t in (-1, 0, 1):
            q = Vector((cb.x, cb.y, zb + 1.05)) + ex * (t * L * 0.1) + ey * sgn * (L * 0.1 + 0.03); quad_on(q, ex, UP, L * 0.04, 0.3, ey * sgn, 'emissive_wwarm')
        RGL(Vector((cb.x, cb.y, zb + 1.05)) + ey * sgn * (L * 0.1 + 0.3), 'wwarm', L * 0.3)
    top = Vector((cb.x, cb.y, zb + 1.9)); GLW(top + UP * (3.0 if kind == 'yacht' else 1.0), 'wcool', 5.0)
    if kind == 'yacht': beam(top, top + UP * 3.0, 0.1, 'metal')
    GLW(c + ex * (L / 2) + ey * (L * 0.12) + UP * (zc + 0.9), 'green', 4.0); GLW(c + ex * (L / 2) - ey * (L * 0.12) + UP * (zc + 0.9), 'red', 4.0)
    cnt_('boat')
for (a, s, yw, L, kd) in ((-30, 10, 0.0, 30, 'barge'), (50, -90, 1.0, 14, 'yacht'), (-70, 140, 2.2, 12, 'yacht'), (20, 60, 0.4, 22, 'barge'), (80, 150, 1.7, 13, 'yacht'), (-90, -140, 0.2, 14, 'yacht')):
    if -S1 + 20 < s < S2 - 20: boat(a, s, math.atan2(US.y, US.x) + (0.0 if kd == 'barge' else yw * 0.25), L, kd)
log('ground, river, boats:', NFACE[0], 'faces')


# ---------------------------------------------------------------- towers: glass walls (self-lit pictures), tiers, crowns, red aircraft lamps, LED screens, logos, glow points on the fronts that face the road
def clear_pts(x, y, yaw, w, d, step=5.0):
    ex, ey, _ = yaw_axes(yaw); pts = []; nx = max(1, int(w / step)); ny = max(1, int(d / step))
    for k in range(nx + 1):
        t = -w / 2 + w * k / nx; pts.append((x + ex.x * t + ey.x * d / 2, y + ex.y * t + ey.y * d / 2)); pts.append((x + ex.x * t - ey.x * d / 2, y + ex.y * t - ey.y * d / 2))
    for k in range(1, ny):
        t = -d / 2 + d * k / ny; pts.append((x + ey.x * t + ex.x * w / 2, y + ey.y * t + ex.y * w / 2)); pts.append((x + ey.x * t - ex.x * w / 2, y + ey.y * t - ex.y * w / 2))
    pts.append((x, y)); return pts
def can_place(x, y, yaw, w, d, mc):
    for px, py in clear_pts(x, y, yaw, w, d):
        if not (X0 + 14 < px < X1 - 14 and Y0 + 14 < py < Y1 - 14): return False
        if in_river(px, py, 10.0): return False
        if nearest(px, py)[1] < mc: return False
    ex, _, _ = yaw_axes(yaw)
    return all(free(a, b, rr, 1.0) for a, b, rr in rect_circles(Vector((x, y, 0)), ex, w, d))
def aircraft_lamp(p, big=True):
    obox(p + UP * 0.25, Vector((1, 0, 0)), Vector((0, 1, 0)), UP, 0.3, 0.3, 0.25, 'emissive_red', dens=1.0, bottom=False); GLW(p + UP * 0.3, 'red', 9.0)
def tower_block(x, y, yaw, w, d, H, kind, tiers=1, led=False, logo=False, z0=-0.3, tag='tower'):
    ex, ey, _ = yaw_axes(yaw); c = Vector((x, y, 0)); mat = 'glass_' + kind
    tl = [(H, 1.0)] if tiers == 1 else ([(H * 0.58, 1.0), (H, 0.7)] if tiers == 2 else [(H * 0.42, 1.0), (H * 0.72, 0.8), (H, 0.58)])
    zprev = z0; info = []
    for ti, (zt, sc) in enumerate(tl):
        hw = w * sc / 2; hd = d * sc / 2
        cs = [c + ex * sx * hw + ey * sy * hd for (sx, sy) in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        if ti > 0:
            ph, pdd = w * tl[ti - 1][1] / 2, d * tl[ti - 1][1] / 2
            F([c + ex * sx * ph + ey * sy * pdd + UP * zprev for (sx, sy) in ((-1, -1), (1, -1), (1, 1), (-1, 1))], 'roof', None, None, UP, 0.02, 6.0)
        for k in range(4):
            A = cs[k]; B = cs[(k + 1) % 4]; n = (B - A).cross(UP).normalized()
            wall(A, B, zprev, zt, n, mat, u0=rng.random() * 12.0)
            if ti == 0: info.append((A, B, n))
        zprev = zt
    top = tl[-1][1]; hw = w * top / 2; hd = d * top / 2
    F([c + ex * sx * hw + ey * sy * hd + UP * H for (sx, sy) in ((-1, -1), (1, -1), (1, 1), (-1, 1))], 'roof', None, None, UP, 0.02, 6.0)
    # crown: a lit band under the roof edge, plant boxes, a mast, aircraft lamps
    if rng.random() < 0.6:
        cn = rng.choice(['ice', 'blue', 'amber', 'cyan'])
        for k in range(4):
            A = c + [ex * -hw + ey * -hd, ex * hw + ey * -hd, ex * hw + ey * hd, ex * -hw + ey * hd][k]; B = c + [ex * -hw + ey * -hd, ex * hw + ey * -hd, ex * hw + ey * hd, ex * -hw + ey * hd][(k + 1) % 4]
            n = (B - A).cross(UP).normalized(); F([A + UP * (H - 1.5) + n * 0.06, B + UP * (H - 1.5) + n * 0.06, B + UP * (H - 0.9) + n * 0.06, A + UP * (H - 0.9) + n * 0.06], 'emissive_' + cn, None, None, n)
    for _k in range(rng.randrange(2, 4)):
        q = c + ex * rng.uniform(-hw + 3, hw - 3) + ey * rng.uniform(-hd + 3, hd - 3); sz = rng.uniform(2.0, 4.5)
        obox(q + UP * (H + sz * 0.4), ex, ey, UP, sz / 2, sz / 2 * rng.uniform(0.6, 1.3), sz * 0.4, 'metal', dens=0.1, bottom=False)
    if H >= 110 and not NOMAST[0]:
        mh = rng.uniform(14, 34); beam(c + UP * H, c + UP * (H + mh), 0.5, 'metal'); aircraft_lamp(c + UP * (H + mh))
    elif H >= 75 and not NOMAST[0]: aircraft_lamp(c + ex * (hw - 1.5) + ey * (hd - 1.5) + UP * H)
    # glow points on the fronts that face the road, LED screen and logo on the best front
    best = None
    for (A, B, n) in info:
        wc = (A + B) / 2; i, dm = nearest(wc.x, wc.y)
        if dm > 48: continue
        dv = Vector((C[i, 0] - wc.x, C[i, 1] - wc.y, 0));
        if dv.length < 1e-6 or n.dot(dv) < 0.25 * dv.length: continue
        rz = C[i, 2]; zg = min(rz + rng.uniform(10, 30), z0 + (zt - z0) * 0.8); cn = {'a': 'wwarm', 'b': 'wcool', 'c': rng.choice(['wwarm', 'wcool', 'blue'])}[kind]
        RGL(wc + n * 0.3 + UP * zg, cn, (B - A).length); cnt_('front')
        if best is None or dm < best[0]: best = (dm, A, B, n, i)
    if best is not None:
        dm, A, B, n, i = best; wl = (B - A).length; wc = (A + B) / 2; rz = C[i, 2]
        if led and H > 60 and wl > 14:
            ws = min(0.78 * wl, 24.0); hs = ws / 2; zc = rz + rng.uniform(12, 26) + hs / 2
            if zc + hs / 2 < H - 5:
                k = rng.randrange(4); cc = wc + n * 0.16 + UP * zc; quad_on(cc, RIGHT(n), UP, ws / 2, hs / 2, n, 'led', dpanel_uv(k))
                obox(wc + n * 0.06 + UP * zc, RIGHT(n), n, UP, ws / 2 + 0.3, 0.06, hs / 2 + 0.3, 'metal', dens=0.1)
                cn = ['cyan', 'amber', 'ice', 'magenta'][k]; RGL(cc + n * 0.3, cn, ws); cnt_('led')
                if dm < 45: LT(cc + n * 8.0, COL[cn], 2500.0, 1.0)
        if logo and H >= 90 and wl > 12:
            pk = rng.choice([0, 1, 2, 4, 5]); wd = min(0.8 * wl, 18.0); hh = wd / 8; cc = wc + n * 0.25 + UP * (H - hh - 3.2)
            quad_on(cc, RIGHT(n), UP, wd / 2, hh, n, 'sign', panel_uv(pk)); cn = SIGNS[pk][1]; GLW(cc + n * 0.6, cn, 6.0); RGL(cc + n * 0.3, cn, wd); cnt_('logo')
    BUILDS.append((x, y, H)); cnt_(tag)
BUILDS = []; NOMAST = [False]
def carpark(x, y, yaw, w, d, levels):
    ex, ey, _ = yaw_axes(yaw); c = Vector((x, y, 0)); H = levels * 3.0
    cs = [c + ex * sx * w / 2 + ey * sy * d / 2 for (sx, sy) in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    for k in range(4):
        A = cs[k]; B = cs[(k + 1) % 4]; n = (B - A).cross(UP).normalized()
        wall(A, B, -0.3, H, n, 'carpark', u0=rng.random() * 24.0, tilev=12.0, tileu=24.0)
        if levels < 4: pass
    F([p + UP * H for p in cs], 'roof', None, None, UP, 0.02, 6.0)
    for k in range(4):
        A = cs[k]; B = cs[(k + 1) % 4]; n = (B - A).cross(UP).normalized(); wc = (A + B) / 2; i, dm = nearest(wc.x, wc.y)
        if dm < 60:
            dv = Vector((C[i, 0] - wc.x, C[i, 1] - wc.y, 0))
            if n.dot(dv) > 0.25 * dv.length: RGL(wc + n * 0.3 + UP * min(H * 0.8, C[i, 2] + rng.uniform(10, 30)), 'wcool', (B - A).length)
    cnt_('carpark'); BUILDS.append((x, y, H))

# ---------------------------------------------------------------- overhead frames (start gantry, direction signs, toll canopy): beam bottom 6.9 m above the road
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
def dir_gantry(i, k):
    ex = TGv(i); ey = LFv(i); back = -ex; yy = frame(i, 0.55, 9.4, 6.9)
    for q, dd in enumerate((-4.6, 4.6)):
        kk = (k * 2 + q) % 4; c = PA(i, dd, yy + 8.1 + 1.8) + back * 0.12
        quad_on(c, RIGHT(back), UP, 3.6, 1.8, back, 'dsign', dpanel_uv(kk)); obox(c - back * 0.04, ex, ey, UP, 0.06, 3.75, 1.85, 'metal', dens=0.5)
        LT(c + back * 2.4 + UP * 0.3, COL['green'], 650.0, 0.4); RGL(c + back * 0.3, 'green', 7.2)
        for dx in (-2.4, 0.0, 2.4):
            p = PA(i, dd + dx, yy + 8.1 + 3.75) + back * 0.35; obox(p, ex, ey, UP, 0.2, 0.4, 0.06, 'emissive_ice', dens=1.0)
        GLW(PA(i, dd, yy + 12.1) + back * 0.4, 'ice', 5.0)
    F([PA(i, -9.4, yy + 6.92) + back * 0.62, PA(i, 9.4, yy + 6.92) + back * 0.62, PA(i, 9.4, yy + 7.02) + back * 0.62, PA(i, -9.4, yy + 7.02) + back * 0.62], 'emissive_ice', None, None, back)
    RGL(PA(i, 0, yy + 6.94) + back * 0.7, 'ice', 19.0); cnt_('dirgantry')
def toll_plaza():
    ic = (TOLL0 + TOLL1) // 2; ex = TGv(ic); ey = LFv(ic); back = -ex; yw = PSI[ic]; yy = roadtop(ic); hxl = (TOLL1 - TOLL0) * STEP / 2 + 1.5
    ctr = PA(ic, 0, yy + 8.35)
    obox(ctr, ex, ey, UP, hxl, 16.8, 0.45, 'concrete', dens=0.5, bottom=True)
    for sg in (1, -1):                                    # lit edge strips at the front and the back of the canopy, under-lights
        for sx in (1, -1):
            e0 = ctr + ex * (sx * (hxl + 0.03)); F([e0 - ey * 16.8 - UP * 0.4, e0 + ey * 16.8 - UP * 0.4, e0 + ey * 16.8 - UP * 0.1, e0 - ey * 16.8 - UP * 0.1], 'emissive_ice', None, None, ex * sx)
    for dd in (-13.0, -8.5, -4.0, 0.0, 4.0, 8.5, 13.0):
        q = ctr + ey * dd - UP * 0.47; F([q - ex * (hxl - 0.5) - ey * 0.25, q + ex * (hxl - 0.5) - ey * 0.25, q + ex * (hxl - 0.5) + ey * 0.25, q - ex * (hxl - 0.5) + ey * 0.25], 'emissive_ice', None, None, -UP)
        for t in range(-2, 3): RGL(q + ex * (t * 11.0), 'ice', 6.0)
    for t in (-22.0, -8.0, 8.0, 22.0): LT(ctr + ex * t - UP * 1.2, (0.78, 0.88, 1.0), 2200.0, 0.6)
    for sg in (1, -1):
        for t in (TOLL0, ic, TOLL1):
            p = P(t, sg * 13.4); obox(Vector((p.x, p.y, (p.z - 0.2 + yy + 7.9) / 2)), ex, ey, UP, 0.5, 0.5, (yy + 7.9 - p.z + 0.2) / 2, 'concrete', dens=0.5, bottom=False)
        for t in (TOLL0 + 2, TOLL0 + 7, TOLL0 + 12, TOLL0 + 17):             # booths on the widened deck outside the parapets
            p = P(t, sg * 11.5); n = -LFv(t) * sg; zb = p.z - 0.05
            obox(Vector((p.x, p.y, zb + 1.7)), TGv(t), LFv(t), UP, 2.5, 1.2, 1.7, 'paint', dens=0.4, bottom=False)
            q = Vector((p.x, p.y, zb + 1.9)) + n * 1.23; quad_on(q, TGv(t), UP, 2.1, 0.7, n, 'emissive_wcool'); quad_on(q + UP * 1.1, TGv(t), UP, 2.1, 0.12, n, 'emissive_amber')
            RGL(q + n * 0.3, 'wcool', 4.2); GLW(Vector((p.x, p.y, zb + 3.55)), 'amber', 5.0)
            if t == TOLL0 + 7: LT(q + n * 2.0, COL['wcool'], 700.0, 0.4)
    for k, dd in enumerate((-6.0, -4.0, -2.0, 0.0, 2.0, 4.0, 6.0)):      # lane boards hanging from the canopy: green go, red cross
        cn = 'red' if k in (0, 6) else 'green'; c = PA(TOLL0 + 1, dd, yy + 7.3) + back * 0.1
        quad_on(c, RIGHT(back), UP, 0.65, 0.4, back, 'emissive_' + cn); obox(c - back * 0.06, ex, ey, UP, 0.05, 0.75, 0.5, 'metal', dens=0.5); RGL(c + back * 0.3, cn, 1.3)
    c = PA(TOLL0 - 1, 0, yy + 9.9) + back * 0.3
    for dd in (-4.0, 4.0): beam(PA(TOLL0 - 1, dd, yy + 8.8), PA(TOLL0 - 1, dd, yy + 9.0), 0.2, 'metal')
    quad_on(c, RIGHT(back), UP, 6.0, 1.5, back, 'sign', panel_uv(6)); GLW(c + back * 0.5, 'green', 7.0); RGL(c + back * 0.3, 'green', 12.0); LT(c + back * 3.0, COL['green'], 900.0, 0.5)
    for t in range(TOLL0 - 6, TOLL1 + 6, 4):
        for sg in (1, -1): p = P(t, sg * 16.0); occupy(p.x, p.y, 7.0)
    cnt_('toll')

# ---------------------------------------------------------------- the tunnel: the road runs through the podium of a huge tower
PODH = 22.0
def podium():
    TW = 26.0
    for sg in (1, -1):
        out = lambda i, sg=sg: LFv(i) * sg
        for i in range(IT0, IT1):
            A = PA(i, sg * TW, 0); B = PA(i + 1, sg * TW, 0); z1 = C[i % N, 2] + PODH
            wall(A, B, -0.3, z1, LFv(i) * sg, 'glass_c', u0=SCu(i) % 12.0)
    ribbon(IT0, IT1, lambda i: [PA(i, -TW, C[i % N, 2] + PODH), PA(i, TW, C[i % N, 2] + PODH)], 'roof', UP, tile=(6, 6), dens=0.02)
    for sg in (1, -1):
        ribbon(IT0, IT1, lambda i, sg=sg: [PA(i, sg * (TW - 0.2), C[i % N, 2] + PODH - 1.0), PA(i, sg * (TW - 0.2), C[i % N, 2] + PODH - 0.6)], 'emissive_ice', lambda i, sg=sg: -LFv(i) * sg)
    for i in range(IT0 + 2, IT1 - 1, 4):
        for sg in (1, -1): RGL(PA(i, sg * (TW + 0.3), C[i % N, 2] + 12.0), 'wcool', 12.0)
    def tube_sec(i): return [P(i, 9.1, -0.3), P(i, 9.1, 6.6), PA(i, 6.0, C[i % N, 2] + 7.6), PA(i, -6.0, C[i % N, 2] + 7.6), P(i, -9.1, 6.6), P(i, -9.1, -0.3)]
    ribbon(IT0, IT1, tube_sec, 'tunnel', None, tile=(2, 2), dens=0.8, hintp=lambda i, p: PA(i, 0, C[i % N, 2] + 3.0) - p)
    def end(i, outdir):
        y = C[i % N, 2]; top = y + PODH; eu = LFv(i) if outdir.dot(TGv(i)) < 0 else -LFv(i)
        for sg in (1, -1):
            A = PA(i, sg * 8.9, 0); B = PA(i, sg * TW, 0)
            wall(A, B, -0.3, top, outdir, 'glass_c', u0=rng.random() * 12)
        wall(PA(i, -9.0, 0), PA(i, 9.0, 0), y + 6.6, top, outdir, 'glass_c', u0=3.0)
        F([PA(i, -9.0, -0.3), PA(i, 9.0, -0.3), PA(i, 9.0, y - 1.55), PA(i, -9.0, y - 1.55)], 'concrete', None, None, outdir, 0.3, 3.0)
        for sg in (1, -1): F([PA(i, sg * 8.95, y - 0.3) + outdir * 0.05, PA(i, sg * 9.25, y - 0.3) + outdir * 0.05, PA(i, sg * 9.25, y + 6.8) + outdir * 0.05, PA(i, sg * 8.95, y + 6.8) + outdir * 0.05], 'emissive_ice', None, None, outdir)
        F([PA(i, -9.25, y + 6.62) + outdir * 0.05, PA(i, 9.25, y + 6.62) + outdir * 0.05, PA(i, 9.25, y + 6.85) + outdir * 0.05, PA(i, -9.25, y + 6.85) + outdir * 0.05], 'emissive_ice', None, None, outdir)
        cc = PA(i, 0, y + 14.6) + outdir * 0.1; quad_on(cc, eu, UP, 7.0, 3.5, outdir, 'led', dpanel_uv(0 if outdir.dot(TGv(i)) < 0 else 2))
        LT(PA(i, 0, y + 5.0) + outdir * 3.0, (0.78, 0.88, 1.0), 900.0, 0.5); RGL(cc + outdir * 0.3, 'cyan', 14.0); RGL(PA(i, 0, y + 6.75) + outdir * 0.3, 'ice', 18.0)
        for sg in (1, -1): RGL(PA(i, sg * 9.1, y + 3.0) + outdir * 0.3, 'ice', 0.5)
    end(IT0, -TGv(IT0)); end(IT1, TGv(IT1))
    for i in range(IT0 + 2, IT1 - 1, 2):                   # ceiling light rows
        for sg in (1, -1):
            p = PA(i, sg * 3.6, C[i % N, 2] + 7.52); ex = TGv(i); ey = LFv(i)
            obox(p, ex, ey, UP, 0.9, 0.22, 0.06, 'emissive_ice', dens=1.0, top=False)
            if i % 4 == 2 or sg > 0: LT(p - Vector((0, 0, 0.4)), (0.78, 0.88, 1.0), pw(1.2, 7.2) * (1.0 if i % 4 == 2 else 0.8), 0.4)
            if i % 6 == 0 and sg > 0: GLW(p, 'ice', 7.0)
            if i % 4 == 0: RGL(p - UP * 0.1, 'ice', 5.0)
    for i in range(IT0 + 1, IT1 - 1):                      # wall light strips
        for sg in (1, -1):
            F([P(i, sg * 9.07, 3.3), P(i + 1, sg * 9.07, 3.3), P(i + 1, sg * 9.07, 3.5), P(i, sg * 9.07, 3.5)], 'emissive_ice', None, None, -LFv(i) * sg)
            if i % 3 == 0: RGL(P(i, sg * 9.0, 3.4), 'ice', 9.0)
    for i in range(IT0 + 8, IT1 - 6, 20):
        p = P(i, 9.07, 2.2); F([p - TGv(i) * 0.5 - UP * 0.2, p + TGv(i) * 0.5 - UP * 0.2, p + TGv(i) * 0.5 + UP * 0.2, p - TGv(i) * 0.5 + UP * 0.2], 'emissive_green', None, None, -LFv(i)); GLW(p, 'green', 4.0)
    for i in range(IT0 - 2, IT1 + 3, 5):
        p = PA(i, 0, 0); occupy(p.x, p.y, 40.0)
    mid = (IT0 + IT1) // 2; q = PA(mid, 0, 0); tw_ = 46.0; td_ = 62.0
    zb = min(C[i % N, 2] for i in range(IT0, IT1)) + PODH - 0.6
    tower_block(q.x, q.y, PSI[mid], td_, tw_, 205.0, 'b', tiers=3, led=False, logo=False, z0=zb, tag='podiumtower')
    # logo of the podium tower, a big lit band on the front face
    cnt_('podium')
podium()
log('tunnel + podium:', NFACE[0], 'faces')

# ---------------------------------------------------------------- the bridge: a long steel arch on each side, lit hangers, braces over the road
def bridge_arch():
    i0 = IB0 + 6; i1 = IB1 - 6; H = 44.0
    for sg in (1, -1):
        pts = []
        for i in range(i0, i1 + 1):
            f = (i - i0) / (i1 - i0); pts.append(PA(i, sg * 11.2, C[i % N, 2] + 0.5 + 4 * f * (1 - f) * H))
        inw = lambda i: -LFv(i) * sg * 0.85
        for k in range(len(pts) - 1):
            i = i0 + k; beam(pts[k], pts[k + 1], 1.5, 'metal'); beam(pts[k] + inw(i), pts[k + 1] + inw(i), 0.3, 'emissive_ice')
            if k % 4 == 0: RGL(pts[k] + inw(i), 'ice', 4.0)
        for k in range(2, len(pts) - 2, 4):
            i = i0 + k; pb = P(i, sg * 9.5, 0.4); beam(pts[k], pb, 0.18, 'emissive_ice' if (k // 4) % 2 == 0 else 'metal')
            if (k // 4) % 2 == 0 and (k // 4) % 4 == 0: RGL((pts[k] + pb) / 2, 'ice', 0.6)
        for i in (i0, i1):
            p = PA(i, sg * 11.2, 0); g = gzv(p.x, p.y); bbox(p.x, p.y, g - 0.3, PSI[i], 3.2, 3.2, C[i % N, 2] + 1.0 - g + 0.3, 'concrete', dens=0.2, top=False, bottom=False)
    for k in range(8, i1 - i0 - 7, 8):
        i = i0 + k; f = k / (i1 - i0); h = 4 * f * (1 - f) * H; z = C[i % N, 2] + 0.5 + h - 1.2
        if h < 15: continue
        beam(PA(i, -11.2, z), PA(i, 11.2, z), 0.7, 'metal'); beam(PA(i, -10.5, z - 0.45), PA(i, 10.5, z - 0.45), 0.18, 'emissive_ice'); RGL(PA(i, 0, z - 0.5), 'ice', 20.0); cnt_('brace')
    for k in (20, 50, 80):
        if i0 + k < i1: LT(PA(i0 + k, 0, C[(i0 + k) % N, 2] + 14.0), (0.70, 0.86, 1.0), 3000.0, 0.8)
    cnt_('arch')
bridge_arch()

# ---------------------------------------------------------------- lamp masts: every 30 m on the deck edge, an arm over the road at 11 m; sodium in the first half of the lap, cool white after
GANT = []


# ---------------------------------------------------------------- set pieces that need open ground: the metro viaduct over the road, helipad tower, construction site
def calm(i, k=5): return all(abs(KAP[(i + j) % N]) < 1 / 150.0 for j in range(-k, k + 1))
def near_toll(i): return (TOLL0 - 12 <= i % N <= TOLL1 + 12) or i % N > N - 40
def metro(ic):
    tg = TGv(ic); dv = Vector((-tg.y, tg.x, 0)); O = Vector((C[ic, 0], C[ic, 1], 0)); zt = roadtop(ic) + 9.2; yawv = PSI[ic]; yawd = math.atan2(dv.y, dv.x)
    def blocked(b):
        p = O + dv * b; i, dmin = nearest(p.x, p.y)
        return dmin < 34 and abs(((i - ic + N // 2) % N) - N // 2) > 20 or not (X0 + 30 < p.x < X1 - 30 and Y0 + 30 < p.y < Y1 - 30) or in_river(p.x, p.y, 20)
    bmin = -20.0
    while bmin > -260 and not blocked(bmin - 10): bmin -= 10
    bmax = 20.0
    while bmax < 260 and not blocked(bmax + 10): bmax += 10
    L = bmax - bmin; b0 = (bmin + bmax) / 2; cc = O + dv * b0
    log('metro viaduct over sample', ic, 'from', bmin, 'to', bmax, 'deck top z %.1f' % zt)
    obox(Vector((cc.x, cc.y, zt - 0.85)), dv, tg, UP, L / 2, 3.4, 0.85, 'concrete', dens=0.3, bottom=True)
    for sgn in (1, -1):
        obox(Vector((cc.x, cc.y, zt + 0.45)) + tg * (sgn * 3.2), dv, tg, UP, L / 2, 0.15, 0.45, 'metal', dens=0.3, bottom=False)
        e = cc + tg * (sgn * 3.43); F([e - dv * L / 2 + UP * (zt - 1.35), e + dv * L / 2 + UP * (zt - 1.35), e + dv * L / 2 + UP * (zt - 1.1), e - dv * L / 2 + UP * (zt - 1.1)], 'emissive_ice', None, None, tg * sgn)
        for b in range(int(bmin) + 6, int(bmax), 12):
            p = O + dv * b + tg * (sgn * 3.5); RGL(Vector((p.x, p.y, zt - 1.2)), 'ice', 8.0)
    for b in range(int(bmin) + 10, int(bmax) - 4, 24):
        p = O + dv * b; obox(Vector((p.x, p.y, zt + 2.6)), dv, tg, UP, 0.1, 0.1, 2.6, 'metal', dens=0.3, bottom=False)
    beam(O + dv * bmin + UP * (zt + 5.0), O + dv * bmax + UP * (zt + 5.0), 0.05, 'metal')
    for k in range(0, 40):
        for sgn in (1, -1):
            b = sgn * (15.0 + 30.0 * k)
            if not (bmin + 8 < b < bmax - 8): continue
            p = O + dv * b
            bbox(p.x, p.y, -0.3, yawv, 2.2, 2.2, zt - 1.7 - 1.7 + 0.3, 'concrete', dens=0.2, top=False, bottom=False)
            bbox(p.x, p.y, zt - 3.4, yawv, 6.4, 2.4, 1.8, 'concrete', dens=0.2, top=False, bottom=True)
    for b in range(int(bmin), int(bmax) + 1, 12): occupy((O + dv * b).x, (O + dv * b).y, 9.0)
    ncar = 4; Lh = 8.0
    for k in range(ncar):
        b = -(ncar - 1) * (Lh + 0.6) + k * (2 * Lh + 1.2); p = O + dv * b; zb = zt + 0.35
        ctr = Vector((p.x, p.y, zb + 1.7)); obox(ctr, dv, tg, UP, Lh, 1.5, 1.7, 'metal', dens=0.3, bottom=False); obox(ctr + UP * 1.75, dv, tg, UP, Lh - 0.3, 1.2, 0.08, 'roof', dens=0.1)
        for sgn in (1, -1):
            for t in range(-3, 4):
                c2 = ctr + dv * (t * 2.1) + tg * (sgn * 1.51) + UP * 0.5; quad_on(c2, dv, UP, 0.8, 0.5, tg * sgn, 'emissive_wwarm' if (t + k) % 5 else 'emissive_wcool')
            RGL(ctr + tg * (sgn * 1.8) + UP * 0.5, 'wwarm', 2 * Lh - 1.0)
        LT(ctr + tg * 3.2 - UP * 0.4, COL['wwarm'], 1500.0, 0.6)
        if k == ncar - 1: pp = ctr + dv * (Lh + 0.05); quad_on(pp + tg * 0.8 + UP * 0.2, tg, UP, 0.3, 0.2, dv, 'emissive_wcool'); quad_on(pp - tg * 0.8 + UP * 0.2, tg, UP, 0.3, 0.2, dv, 'emissive_wcool'); GLW(pp + UP * 0.2, 'wcool', 6.0)
        if k == 0: pp = ctr - dv * (Lh + 0.05); quad_on(pp + tg * 0.8 + UP * 0.2, tg, UP, 0.3, 0.2, -dv, 'emissive_red'); quad_on(pp - tg * 0.8 + UP * 0.2, tg, UP, 0.3, 0.2, -dv, 'emissive_red'); GLW(pp + UP * 0.2, 'red', 6.0)
    sb = bmax if (bmax - 20) >= (-bmin - 20) else bmin; sd = 1 if sb > 0 else -1; st = O + dv * (sb - sd * 14.0)       # a lit station at the far end
    obox(Vector((st.x, st.y, zt + 3.4)), dv, tg, UP, 14.0, 7.0, 3.4, 'concrete', dens=0.2, bottom=False)
    for sgn in (1, -1):
        n = tg * sgn; q = Vector((st.x, st.y, zt + 2.6)) + n * 7.04; quad_on(q, dv, UP, 12.5, 1.5, n, 'emissive_wcool'); RGL(q + n * 0.3, 'wcool', 25.0)
    obox(Vector((st.x, st.y, zt + 7.2)), dv, tg, UP, 15.0, 8.0, 0.25, 'metal', dens=0.1, bottom=True); LT(Vector((st.x, st.y, zt + 3.0)) + tg * 9.0, COL['wcool'], 1200.0, 0.8)
    cnt_('metro')
cands = [i for i in range(50, 110) if calm(i, 8) and plain(i, 12) and not near_toll(i)]
IMETRO = cands[len(cands) // 2] if cands else 75
metro(IMETRO)
def helipad(c, z):
    r = 14.0; n = 24
    pts = [Vector((c.x + r * math.cos(2 * math.pi * k / n), c.y + r * math.sin(2 * math.pi * k / n), z + 0.35)) for k in range(n)]
    F([p for p in pts], 'concrete', None, None, UP, 0.1, 6.0)
    for k in range(n):
        a = pts[k]; b = pts[(k + 1) % n]; ma = (a - Vector((c.x, c.y, z + 0.35))) * (12.4 / 14.0) + Vector((c.x, c.y, z + 0.4)); mb = (b - Vector((c.x, c.y, z + 0.35))) * (12.4 / 14.0) + Vector((c.x, c.y, z + 0.4))
        mc = (a - Vector((c.x, c.y, z + 0.35))) * (13.2 / 14.0) + Vector((c.x, c.y, z + 0.4)); md = (b - Vector((c.x, c.y, z + 0.35))) * (13.2 / 14.0) + Vector((c.x, c.y, z + 0.4))
        F([ma, mb, md, mc], 'emissive_wcool', None, None, UP)
        if k % 2 == 0: obox(Vector((a.x, a.y, z + 0.6)), Vector((1, 0, 0)), Vector((0, 1, 0)), UP, 0.25, 0.25, 0.25, 'emissive_amber', dens=1.0, bottom=False); GLW(Vector((a.x, a.y, z + 0.7)), 'amber', 5.0)
    for dx, sx, sy in ((-2.0, 0.35, 3.0), (2.0, 0.35, 3.0), (0.0, 2.35, 0.35)):
        obox(Vector((c.x + dx, c.y, z + 0.4)), Vector((1, 0, 0)), Vector((0, 1, 0)), UP, sx, sy, 0.04, 'emissive_amber', dens=1.0, bottom=False)
    RGL(Vector((c.x, c.y, z + 0.9)), 'wcool', 26.0); RGL(Vector((c.x, c.y, z + 0.9)), 'amber', 8.0)
def find_spot(fr0, fr1, dist, w, d, sgs=(1, -1), step=3):
    for ci in range(int(fr0 * N), int(fr1 * N), step):
        if near_toll(ci) or not plain(ci, 20): continue
        for sg in sgs:
            p = P(ci, sg * (dist + d / 2)); yaw = PSI[ci]
            if can_place(p.x, p.y, yaw, w, d, dist - 2): return p, yaw, ci, sg
    return None
r_ = find_spot(0.46, 0.60, 32, 34, 34)
if r_:
    p, yaw, ci, sg = r_; NOMAST[0] = True
    tower_block(p.x, p.y, yaw, 34, 34, 178.0, 'b', tiers=2, led=False, logo=False, tag='helitower'); NOMAST[0] = False
    helipad(Vector((p.x, p.y, 0)), 178.0)
    [occupy(a, b, rr) for a, b, rr in rect_circles(Vector((p.x, p.y, 0)), yaw_axes(yaw)[0], 34, 34)]; log('helipad tower at sample', ci)
else: log('no spot for the helipad tower')
def crane_site(p, yaw):
    ex, ey, _ = yaw_axes(yaw); w = 26.0; d = 26.0; nfl = 15; fh = 3.6
    for l in range(1, nfl + 1): obox(Vector((p.x, p.y, l * fh)), ex, ey, UP, w / 2, d / 2, 0.2, 'concrete', dens=0.05, bottom=True, tile=6.0)
    for sx in (-1, 0, 1):
        for sy in (-1, 0, 1): obox(Vector((p.x, p.y, 0)) + ex * sx * (w / 2 - 1.0) + ey * sy * (d / 2 - 1.0) + UP * (nfl * fh / 2), ex, ey, UP, 0.5, 0.5, nfl * fh / 2, 'concrete', dens=0.05, bottom=False)
    for l in range(6, nfl + 1):
        for k, (sx, sy) in enumerate(((-1, -1), (1, -1), (1, 1), (-1, 1))):
            q = Vector((p.x, p.y, l * fh - 0.45)) + ex * sx * (w / 2 - 3) + ey * sy * (d / 2 - 3); obox(q, ex, ey, UP, 0.3, 0.3, 0.08, 'emissive_amber' if l % 2 else 'emissive_wcool', dens=1.0, top=False)
            if l % 3 == 0 and k == 0: GLW(q, 'amber' if l % 2 else 'wcool', 6.0)
    topz = nfl * fh + 0.2
    for k in range(4): F([Vector((p.x, p.y, 0)) + ex * a * (w / 2) + ey * b * (d / 2) + UP * (topz + 0.2) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))], 'emissive_wcool', None, None, UP) if k == 0 else None
    RGL(Vector((p.x, p.y, topz)), 'wcool', 20.0); RGL(Vector((p.x, p.y, 40.0)) + ey * (d / 2 + 0.5), 'amber', 14.0)
    m = Vector((p.x, p.y, 0)) + ex * (w / 2 + 5.0); mh = 112.0
    obox(m + UP * mh / 2, ex, ey, UP, 1.0, 1.0, mh / 2, 'paint', dens=0.05, bottom=False)
    for z in range(10, int(mh), 14): obox(m + UP * z, ex, ey, UP, 1.15, 1.15, 0.12, 'metal', dens=0.05)
    jd = ey if rng.random() < 0.5 else -ey; jz = mh + 1.2
    obox(m + jd * 28.0 + UP * jz, jd, ex, UP, 36.0, 0.9, 0.9, 'paint', dens=0.05, bottom=True) if False else None
    obox(m + jd * 24.0 + UP * jz, ex, jd, UP, 0.9, 24.0, 0.9, 'paint', dens=0.05, bottom=True)
    obox(m - jd * 11.0 + UP * jz, ex, jd, UP, 0.9, 11.0, 0.9, 'paint', dens=0.05, bottom=True)
    obox(m - jd * 18.0 + UP * (jz - 1.6), ex, jd, UP, 1.6, 1.5, 1.7, 'concrete', dens=0.05)
    obox(m + UP * (jz + 1.5), ex, jd, UP, 1.0, 1.0, 1.5, 'emissive_wwarm', dens=1.0, bottom=False); cabz = jz - 3.0
    obox(m + jd * 2.5 + UP * cabz, ex, jd, UP, 1.0, 1.2, 1.0, 'emissive_wwarm', dens=1.0, bottom=False); GLW(m + jd * 2.5 + UP * cabz, 'wwarm', 7.0)
    apex = m + UP * (jz + 14.0); beam(m + UP * (jz + 3.0), apex, 0.5, 'paint')
    beam(apex, m + jd * 38.0 + UP * (jz + 0.9), 0.14, 'metal'); beam(apex, m + jd * 20.0 + UP * (jz + 0.9), 0.14, 'metal'); beam(apex, m - jd * 21.0 + UP * (jz + 0.9), 0.14, 'metal')
    for q in (apex, m + jd * 38.0 + UP * (jz + 1.2), m - jd * 21.0 + UP * (jz + 1.2)): aircraft_lamp(q)
    for t in range(6, 36, 7):
        q = m + jd * t + UP * (jz - 0.95); obox(q, ex, jd, UP, 0.2, 0.5, 0.05, 'emissive_amber', dens=1.0, top=False); RGL(q, 'amber', 2.5)
    for z in (30, 60, 90): q = m + ex * 1.2 + UP * z; obox(q, ex, ey, UP, 0.2, 0.2, 0.2, 'emissive_wcool', dens=1.0); GLW(q, 'wcool', 6.0); RGL(q, 'wcool', 1.5)
    beam(m + jd * 30.0 + UP * (jz - 1.0), m + jd * 30.0 + UP * (jz - 38.0), 0.05, 'metal')
    obox(m + jd * 30.0 + UP * (jz - 38.5), ex, jd, UP, 0.6, 0.4, 0.5, 'emissive_amber', dens=1.0, bottom=False); RGL(m + jd * 30.0 + UP * (jz - 38.5), 'amber', 2.0)
    cnt_('crane')
r_ = find_spot(0.80, 0.97, 44, 26, 26) or find_spot(0.05, 0.30, 44, 26, 26)
if r_:
    p, yaw, ci, sg = r_; crane_site(Vector((p.x, p.y, 0)), yaw); [occupy(a, b, rr) for a, b, rr in rect_circles(Vector((p.x, p.y, 0)), yaw_axes(yaw)[0], 40, 30)]; log('construction site at sample', ci)
else: log('no spot for the construction site')

# ---------------------------------------------------------------- direction-sign gantries, the start gantry, the toll plaza
start_gantry(0); toll_plaza()
cl = [i for i in range(40, N - 40) if calm(i, 6) and plain(i, 10) and not near_toll(i)]
used = [IMETRO, 0, (TOLL0 + TOLL1) // 2]
def pick(frac, gap=40):
    best = None
    for i in cl:
        if any(abs(i - j) < gap for j in used): continue
        if best is None or abs(i - frac * N) < abs(best - frac * N): best = i
    if best is not None: used.append(best)
    return best
for q, fr in enumerate((0.10, 0.20, 0.30, 0.46, 0.56, 0.78, 0.87, 0.94)):
    i = pick(fr)
    if i is not None: dir_gantry(i, q); GANT.append(i)
log('direction gantries:', len(GANT), GANT)
# ---- lit chevron boards on the outside of every real bend
CHEV = set()
def chevron(i, sgo, s):
    n = (-sgo * LFv(i)) * 0.92 + (-TGv(i)) * 0.39; n.normalize(); eu = RIGHT(n)
    b = P(i, sgo * 9.45); z0 = b.z; c = Vector((b.x, b.y, z0 + 1.65))
    obox(c, eu, n, UP, 1.15, 0.04, 0.95, 'metal', dens=1.0)
    for dx in (-0.8, 0.8): obox(Vector((b.x, b.y, z0 + 0.3)) + eu * dx, eu, n, UP, 0.05, 0.05, 0.45, 'metal', dens=1.0, bottom=False)
    for sy in (1, -1): F([c + n * 0.06 + eu * s * x + UP * sy * y for x, y in ((-0.7, 0.88), (-0.28, 0.88), (0.7, 0.0), (0.28, 0.0))], 'emissive_amber', None, None, n)
    RGL(c + n * 0.3, 'amber', 2.2); CHEV.add((i % N, sgo)); cnt_('chevron')
ap = []
for i in range(N):
    if abs(KAP[i]) < 1 / 200.0 or not plain(i, 6) or i in range(IT0 - 14, IT1 + 14): continue
    if all(abs(KAP[(i + k) % N]) <= abs(KAP[i]) for k in range(-25, 26)) and all(abs(i - j) > 30 for j in ap): ap.append(i)
for i0_ in ap:
    sgo = -1 if KAP[i0_] > 0 else 1; s = 1 if KAP[i0_] < 0 else -1
    for i in range(i0_ - 12, i0_ + 13, 3):
        if abs(KAP[i % N]) > 1 / 280.0 and plain(i) and not near_toll(i) and not any(abs(i - g) < 3 for g in GANT) and not (IT0 - 4 <= i % N <= IT1 + 4): chevron(i, sgo, s)
log('chevron boards:', DET.get('chevron', 0), 'at', len(ap), 'bends')
# ---- lamp masts
for i in range(4, N, 10):
    if any(TUNNEL(i + j) for j in range(-2, 3)) or any(BRIDGE(i + j) for j in range(-1, 2)) or near_toll(i) or any(abs(i - g) < 4 for g in GANT) or abs(i - IMETRO) < 4 or (i < 6): continue
    sg = 1 if (i // 10) % 2 == 0 else -1
    if (i % N, sg) in CHEV or ((i + 1) % N, sg) in CHEV or ((i - 1) % N, sg) in CHEV: sg = -sg
    dp = 9.4; bz = P(i, sg * dp).z; topz = bz + 11.0; base = PA(i, sg * dp, bz - 0.3); ex = TGv(i); ey = LFv(i)
    obox(Vector((base.x, base.y, (base.z + topz) / 2)), ex, ey, UP, 0.16, 0.16, (topz - base.z) / 2, 'metal', dens=2.0, bottom=False)
    beam(PA(i, sg * dp, topz), PA(i, sg * 5.6, topz + 0.15), 0.18, 'metal')
    cn = 'sodium' if (i / N) < 0.5 else 'wcool'; hp = PA(i, sg * 5.6, topz - 0.06)
    obox(hp, ex, ey, UP, 0.6, 0.28, 0.06, 'emissive_' + cn, dens=1.0)
    col = COL[cn] if cn != 'wcool' else (0.78, 0.88, 1.0)
    LT(hp - Vector((0, 0, 0.25)), col, pw(2.2, 11.0), 0.3); GLW(hp, cn, 9.0); cnt_('mast')
log('lamps and set pieces:', NFACE[0], 'faces,', len(LIGHTS), 'lights')


# ---------------------------------------------------------------- the city: towers close on both sides, lower blocks and car parks in the gaps, a taller skyline beyond
def build_one(x, y, yaw, w, d, row):
    r = rng.random(); lowp = {0: 0.16, 1: 0.12, 2: 0.05}.get(row, 0.04)
    kind = rng.choice(['a', 'a', 'b', 'b', 'c'])
    if r < lowp:
        if rng.random() < 0.45: carpark(x, y, yaw, min(w, 30.0), min(d, 24.0), rng.randrange(4, 9))
        else: tower_block(x, y, yaw, w, d, rng.uniform(22, 52), kind, 1, tag='block')
        return
    if row == 0: H = rng.uniform(75, 135) if rng.random() < 0.55 else rng.uniform(125, 200)
    elif row == 1: H = rng.uniform(65, 175)
    elif row == 2: H = rng.uniform(75, 200)
    else: H = 45 + 155 * rng.random() ** 1.3
    tiers = rng.choice([2, 3, 3]) if H > 150 else (rng.choice([1, 2, 2]) if H > 90 else 1)
    tower_block(x, y, yaw, w, d, H, kind, tiers, led=(row < 2 and rng.random() < 0.34), logo=(row < 3 and rng.random() < 0.5))
def place_rows():
    n = 0
    for row, (f0, f1) in enumerate(((13.8, 16.5), (38.0, 46.0), (72.0, 82.0))):
        for sg in (1, -1):
            i = 0
            while i < N:
                w = rng.uniform(18, 34); d = rng.uniform(18, 34); ci = i + int(w / 2 / STEP); fd = rng.uniform(f0, f1)
                p = P(ci, sg * (fd + d / 2)); yaw = PSI[ci % N]
                if can_place(p.x, p.y, yaw, w, d, 13.3):
                    build_one(p.x, p.y, yaw, w, d, row); [occupy(a, b, rr) for a, b, rr in rect_circles(Vector((p.x, p.y, 0)), yaw_axes(yaw)[0], w, d)]; n += 1
                    i = ci + int(w / 2 / STEP) + rng.randrange(0, 3)
                else: i += 2
    log('buildings beside the road:', n); return n
def place_fill(tries=16000, cap=420):
    n = 0
    for _ in range(tries):
        if n >= cap: break
        x = rng.uniform(X0 + 16, X1 - 16); y = rng.uniform(Y0 + 16, Y1 - 16); w = rng.uniform(22, 40); d = rng.uniform(22, 40)
        ni, dm = nearest(x, y); yaw = PSI[ni] if dm < 160 else math.atan2(UA.y, UA.x)
        if can_place(x, y, yaw, w, d, 16.0):
            build_one(x, y, yaw, w, d, 3); [occupy(a, b, rr) for a, b, rr in rect_circles(Vector((x, y, 0)), yaw_axes(yaw)[0], w, d)]; n += 1
    log('fill buildings:', n); return n
place_rows(); place_fill()
log('buildings:', len(BUILDS), 'details:', DET)
# the far skyline all round, the base plane under the water
for (a, b, n, ln) in (((X0, Y1), (X1, Y1), (0, -1), X1 - X0), ((X1, Y1), (X1, Y0), (-1, 0), Y1 - Y0), ((X1, Y0), (X0, Y0), (0, 1), X1 - X0), ((X0, Y0), (X0, Y1), (1, 0), Y1 - Y0)):
    rep = ln / 920.0
    F([Vector((a[0], a[1], -1.0)), Vector((b[0], b[1], -1.0)), Vector((b[0], b[1], 229.0)), Vector((a[0], a[1], 229.0))], 'sky', [(0, 0), (rep, 0), (rep, 1), (0, 1)], None, Vector((n[0], n[1], 0)), 0.01)
F([Vector((X0, Y0, -5.3)), Vector((X1, Y0, -5.3)), Vector((X1, Y1, -5.3)), Vector((X0, Y1, -5.3))], 'concrete', None, None, UP, 0.02, 12.0)
PX, PY = X1 - 16.0, Y0 + 16.0
log('geometry done:', NFACE[0], 'faces')
# check: nothing between the barriers' inner faces except the road, and nothing over the road lower than 6.6 m
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
for k, zv in (('A', -1.4), ('B', -1.45)):
    f = F([Vector((PX, PY, zv)), Vector((PX + 6, PY, zv)), Vector((PX + 6, PY + 6, zv)), Vector((PX, PY + 6, zv))], 'concrete', None, [(0, 0), (8, 0), (8, 8), (0, 8)], -UP, 1.0)
me = bpy.data.meshes.new('skyway'); bm.to_mesh(me); bm.free()
for m in mats: me.materials.append(m)
mc = bpy.data.collections.new('map'); scene.collection.children.link(mc)
ob = bpy.data.objects.new('skyway', me); mc.objects.link(ob)
me.calc_loop_triangles(); NTRI = len(me.loop_triangles); log('skyway mesh:', NTRI, 'triangles,', len(me.vertices), 'verts,', len(me.polygons), 'faces')
NP = len(me.polygons); BLOCK_POLY = {}
for p in me.polygons:                                    # the two light-picture patches are the only faces under the base plane (z -1.4 / -1.45)
    zs = [me.vertices[v].co.z for v in p.vertices]
    if all(-1.5 < z < -1.38 for z in zs): BLOCK_POLY['A' if zs[0] > -1.42 else 'B'] = p.index
BLK = set(BLOCK_POLY.values()); assert len(BLK) == 2, BLOCK_POLY
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
def make_sky(W=1024):
    M = Vector((-0.45, 0.55, 0.70)).normalized()
    sky = ash_paint.night_sky(W, tuple(M), aurora=0.0, zen=(0.004, 0.007, 0.028), mid=(0.010, 0.020, 0.055), hor=(0.05, 0.04, 0.07), moon_col=(0.55, 0.58, 0.62), halo=(0.55, 0.75, 1.0),
                              moon2=(0.01, 0.0, -1.0), moon2_col=(0, 0, 0), glow2=(0, 0, 0)); H = sky.shape[0]
    v = (np.arange(H, dtype=np.float32) + 0.5) / H; u = (np.arange(W, dtype=np.float32) + 0.5) / W; th = (v - 0.5) * np.pi; ph = -(u - 0.5) * 2 * np.pi
    ct = np.cos(th)[:, None]; X = ct * np.cos(ph)[None, :]; Y = ct * np.sin(ph)[None, :]; Z = np.repeat(np.sin(th)[:, None], W, 1)
    wS = np.clip(-Y, 0, 1) ** 1.5; wW = np.clip(-X, 0, 1) ** 2; wE = np.clip(X, 0, 1) ** 2; wN = np.clip(Y, 0, 1)
    gcol = wS[..., None] * v3(1.0, 0.55, 0.20) + wW[..., None] * v3(0.35, 0.55, 0.95) * 0.7 + wE[..., None] * v3(0.2, 0.7, 0.95) * 0.6 + wN[..., None] * v3(0.12, 0.35, 0.60) * 0.5 + 0.12
    zp = np.clip(Z, 0, 1); glow = np.exp(-zp / 0.05) * 0.9 + np.exp(-zp / 0.22) * 0.25; glow = np.where(Z > -0.05, glow, 0.0)
    sky = sky + gcol * glow[..., None] * 0.13
    cl = np.clip((tn(H, W, 14, 30, 7) * 0.6 + tn(H, W, 30, 70, 8) * 0.4 - 0.52) * 3.5, 0, 1) * np.clip((Z - 0.02) / 0.1, 0, 1) * np.clip((0.62 - Z) / 0.3, 0, 1)
    lit = np.exp(-zp / 0.30)[..., None] * gcol * 0.5 + v3(0.05, 0.07, 0.11)
    sky = sky * (1 - 0.4 * cl[..., None]) + cl[..., None] * lit * 0.35
    path = os.path.join(TEXDIR, 'skyway_night_sky.exr'); old = bpy.data.images.get('skyway_night_sky')
    if old: bpy.data.images.remove(old)
    im = bpy.data.images.new('skyway_night_sky', W, H, alpha=False, float_buffer=True); im.pixels.foreach_set(np.concatenate([sky.astype(np.float32), np.ones((H, W, 1), np.float32)], 2).ravel())
    ash_paint.save_exr_linear(im, path); bpy.data.images.remove(im); im = bpy.data.images.load(path); im.name = 'skyway_night_sky'
    w = bpy.data.worlds.new('skyway_sky'); scene.world = w; w.use_nodes = True; nt = w.node_tree
    for nd in list(nt.nodes): nt.nodes.remove(nd)
    out = nt.nodes.new('ShaderNodeOutputWorld'); bg = nt.nodes.new('ShaderNodeBackground'); env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = im
    nt.links.new(env.outputs['Color'], bg.inputs['Color']); nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    lp = nt.nodes.new('ShaderNodeLightPath'); mr = nt.nodes.new('ShaderNodeMapRange'); nt.links.new(lp.outputs['Is Camera Ray'], mr.inputs['Value'])
    mr.inputs['To Min'].default_value = float(OPT.get('skyk', 3.0)); mr.inputs['To Max'].default_value = 1.0; nt.links.new(mr.outputs['Result'], bg.inputs['Strength'])
    scene.view_settings.exposure = 0.0
    return M
def build_lights():
    lc = bpy.data.collections.new('lights'); scene.collection.children.link(lc)
    M = make_sky(int(OPT.get('skyw', 2048)))
    sd = bpy.data.lights.new('Moon', 'SUN'); sd.energy = float(OPT.get('moon', 0.9)); sd.color = (0.58, 0.70, 1.0); sd.angle = math.radians(1.2)
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
    img = bpy.data.images.new('skyway_light', LMSIZE, LMSIZE, alpha=False, float_buffer=True)
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
    for k in 'AB':                                        # the self-lit patches: a fixed brightness the colour picture is multiplied by
        u0, u1, v0, v1 = bx[k]; x0 = int(math.ceil(u0 * LMSIZE)) + 3; x1 = int(math.floor(u1 * LMSIZE)) - 3; y0 = int(math.ceil(v0 * LMSIZE)) + 3; y1 = int(math.floor(v1 * LMSIZE)) - 3
        a[y0:y1, x0:x1, :3] = SELF_L[k]; log('self-lit patch', k, 'texels', x1 - x0, 'x', y1 - y0, 'L', SELF_L[k])
    img.pixels.foreach_set(a.ravel())
    path = os.path.join(TEXDIR, 'skyway_light.exr'); ash_paint.save_exr_linear(img, path)
    for m in me.materials:
        n = m.node_tree.nodes.get('hg_bake')
        if n: m.node_tree.nodes.remove(n)
    me.uv_layers.active = me.uv_layers['UVMap']
    lum = rgb @ np.array((0.3, 0.59, 0.11), np.float32); nz = lum[lum > 0]
    log('light picture: median %.2f, 90%% %.2f, 99%% %.2f, 99.9%% %.2f' % (float(np.median(nz)), float(np.percentile(nz, 90)), float(np.percentile(nz, 99)), float(np.percentile(nz, 99.9))))
    bpy.data.images.remove(img)
if 'nobake' not in OPT: bake(int(OPT.get('samples', 48)))
cfg = {'blend': 'skyway.blend', 'out': '../../Nightline/assets/skyway',
       'world': {'collections': ['map'], 'lightmap': 'tex/skyway_light.exr', 'lmSize': LMSIZE, 'lmRange': 8},
       'sky': {'width': 2048}, 'maxTexture': 2048}
with open(os.path.join(BASE, 'skyway.export.json'), 'w') as f: json.dump(cfg, f, indent=1)
bpy.ops.wm.save_mainfile(); log('saved', bpy.data.filepath, '|', NTRI, 'triangles,', len(mats), 'materials,', len(LIGHTS), 'lights,', len(GLOWS), 'glows')
log('done')
