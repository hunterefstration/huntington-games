# NIGHTLINE circuit 1 "NEON QUAY": a harbour city at night after rain, built round art/nightline/quay.track.json (the fixed road).
#   "C:/Program Files/Blender Foundation/Blender 4.5/blender.exe" -b --factory-startup -P tools/blender/make_nl_quay.py -- [samples=48] [nobake] [lm=4096]
# then  node tools/export-art.mjs quay   ->  Nightline/assets/quay.hgm (+ pictures).   Same pipeline as the Ashfall maps (make_yard.py):
# one mesh, tiling pictures, packed 'Lightmap' UV, a Cycles bake of the light (lamps, neon, moon, sky) into art/nightline/tex/quay_light.exr.
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
if not bpy.data.filepath.replace('\\', '/').endswith('art/nightline/quay.blend'):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, 'quay.blend')); log('created', bpy.data.filepath)
for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
for c in list(bpy.data.collections): bpy.data.collections.remove(c)
for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras, bpy.data.images):
    for d in list(coll):
        if d.users == 0: coll.remove(d)
rng = random.Random(11)
LMSIZE = int(OPT.get('lm', 4096))

# ---------------------------------------------------------------- the road: samples in Blender axes
trk = json.load(open(os.path.join(BASE, 'quay.track.json')))
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

def road_pixels(W=2048, H=2048):
    """14 m across (u), 18 m along (v): wet dark asphalt, neutral glossy puddle patches, worn tyre lanes, edge lines at +-6.6 m, centre dashes"""
    y, x = np.mgrid[0:H, 0:W].astype(np.float32); um = (x + 0.5) / W * 14.0; vm = (y + 0.5) / H * 18.0
    n1 = fbm_t(H, W, 6, 3); n2 = tn(H, W, 64, 64, 5); fine = grain(H, W, 0.05, 7)
    a = v3(0.275, 0.28, 0.305) * (0.75 + 0.5 * n1)[..., None] + fine[..., None]
    lane = np.exp(-((np.abs(um - 7.0) - 1.9) ** 2) / 0.5) * 0.5; a = a * (1 - 0.18 * lane[..., None])
    pm = np.clip(blur((tn(H, W, 9, 9, 21) - 0.48) * 6, 8) + 0.5, 0, 1) * np.clip((tn(H, W, 3, 3, 4) - 0.25) * 4, 0, 1)
    a = a * (1 - 0.35 * pm[..., None])
    st = tn(H, W, 28, 3, 31) * 0.6 + tn(H, W, 70, 5, 32) * 0.4; st = np.clip((st - 0.40) * 3.0, 0, 1)
    a = a + (pm * st * 0.06 + pm * 0.01)[..., None]                       # neutral glossy puddle patches (no colour)
    # (no cracks: the outlines of a noise pattern read as scribbles on the road from above)
    wear = np.clip((tn(H, W, 180, 180, 51) - 0.35) * 3, 0, 1)
    def line(mask, wearing=0.6):
        nonlocal a
        a = mix(a, v3(0.86, 0.86, 0.84) * (0.85 + 0.15 * n2[..., None]), mask * (1 - wearing * (1 - wear)))
    for c in (0.4, 13.6): line(np.clip((0.09 - np.abs(um - c)) / 0.012, 0, 1))
    dash = ((vm % 9.0) < 3.0).astype(np.float32); line(np.clip((0.075 - np.abs(um - 7.0)) / 0.012, 0, 1) * dash)
    return np.clip(a, 0.01, 1.0)
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
def kerb_pixels(N=512):
    y, x = np.mgrid[0:N, 0:N].astype(np.float32); red = (y / N) < 0.5
    a = np.where(red[..., None], v3(0.80, 0.08, 0.06), v3(0.84, 0.84, 0.82)) * (0.8 + 0.3 * fbm_t(N, N, 6, 91))[..., None]
    a[(y % (N / 2)) < 3] *= 0.5; return np.clip(a, 0.01, 1)
def grass_pixels(N=1024):
    a = v3(0.13, 0.28, 0.16) * (0.6 + 0.8 * fbm_t(N, N, 8, 95))[..., None] + grain(N, N, 0.08, 96)[..., None] * v3(0.5, 1, 0.5)
    return np.clip(a, 0.01, 1)
def foliage_pixels(N=512):
    a = v3(0.07, 0.17, 0.10) * (0.5 + 0.9 * fbm_t(N, N, 10, 97))[..., None]
    sp = (tn(N, N, 60, 60, 98) > 0.72).astype(np.float32); a = mix(a, v3(0.34, 0.58, 0.28), sp * 0.7); a = a * (1 - 0.5 * (tn(N, N, 40, 40, 99) > 0.8))[..., None]
    return np.clip(a, 0.01, 1)
def roof_pixels(N=512):
    a = v3(0.22, 0.22, 0.25) * (0.7 + 0.6 * fbm_t(N, N, 5, 101))[..., None] + grain(N, N, 0.05, 102)[..., None]
    y, x = np.mgrid[0:N, 0:N]; a[(x % 128) < 2] *= 0.6; return np.clip(a, 0.01, 1)
def metal_pixels(N=512):
    y, x = np.mgrid[0:N, 0:N].astype(np.float32)
    a = v3(0.50, 0.52, 0.56) * (0.75 + 0.4 * fbm_t(N, N, 4, 103))[..., None] + grain(N, N, 0.05, 104)[..., None]
    a[((x % 256) < 2) | ((y % 256) < 2)] *= 0.55; a = mix(a, v3(0.45, 0.2, 0.1), np.clip((tn(N, N, 9, 9, 105) - 0.62) * 3, 0, 1) * 0.5); return np.clip(a, 0.01, 1)
def water_pixels(N=1024):
    a = v3(0.05, 0.11, 0.20) * (0.6 + 0.8 * fbm_t(N, N, 12, 111))[..., None]
    st = np.clip((tn(N, N, 120, 6, 112) * 0.55 + tn(N, N, 50, 3, 113) * 0.45 - 0.46) * 4, 0, 1) * np.clip((tn(N, N, 5, 5, 114) - 0.3) * 3, 0, 1)
    cc = tn(N, N, 6, 4, 115); col = np.where((cc < 0.33)[..., None], v3(1.0, 0.25, 0.7), np.where((cc < 0.66)[..., None], v3(0.2, 0.8, 1.0), v3(1.0, 0.6, 0.2)))
    return np.clip(a + col * (st * 0.5)[..., None], 0.01, 1)
def facade_pixels(kind, W=2048, H=512, seed=120):
    """one floor: 4 modules of 3 m, 3.2 m high (170 / 160 px per m); window recess 1.5 x 1.8 m, sill at 0.9 m"""
    y, x = np.mgrid[0:H, 0:W].astype(np.float32); um = x / W * 12.0; vm = y / H * 3.2
    n1 = fbm_t(H, W, 8, seed); fine = grain(H, W, 0.06, seed + 1)
    if kind == 'brick':
        a = v3(0.46, 0.25, 0.20) * (0.7 + 0.6 * n1)[..., None]; course = vm % 0.075; a[course < 0.012] *= 0.6
        a = a * (0.9 + 0.2 * tn(H, W, 160, 40, seed + 2))[..., None]
    else:
        a = v3(0.50, 0.50, 0.54) * (0.75 + 0.5 * n1)[..., None]; a[(vm % 1.6) < 0.02] *= 0.65
    a = a + fine[..., None]
    mm = um % 3.0; win = (np.abs(mm - 1.5) < 0.75) & (vm > 0.9) & (vm < 2.7)
    frame = (np.abs(mm - 1.5) < 0.84) & (vm > 0.82) & (vm < 2.78) & ~win
    ref = np.clip(tn(H, W, 24, 8, seed + 4) * 1.4, 0, 1)[..., None]
    a = np.where(frame[..., None], a * 1.4 + 0.03, a); a = np.where(win[..., None], v3(0.06, 0.08, 0.12) + ref * v3(0.04, 0.06, 0.09), a)
    sill = (np.abs(mm - 1.5) < 0.92) & (vm > 0.78) & (vm < 0.9); a[sill] = a[sill] * 1.5
    st = np.clip((tn(H, W, 48, 2, seed + 5) - 0.55) * 3, 0, 1) * np.clip(1 - vm / 3.2, 0, 1) ** 0.5; a = a * (1 - 0.4 * st[..., None])
    return np.clip(a, 0.01, 1)
def shop_pixels(W=1024, H=384, seed=140):
    """ground floor, 12 m x 4.5 m: 4 modules with big glass 2.6 x 2.4 m, a riser, a fascia band above"""
    y, x = np.mgrid[0:H, 0:W].astype(np.float32); um = x / W * 12.0; vm = y / H * 4.5
    a = v3(0.26, 0.25, 0.28) * (0.7 + 0.6 * fbm_t(H, W, 6, seed))[..., None] + grain(H, W, 0.05, seed + 1)[..., None]
    mm = um % 3.0; glass = (np.abs(mm - 1.5) < 1.3) & (vm > 0.5) & (vm < 2.9)
    frame = (np.abs(mm - 1.5) < 1.38) & (vm > 0.42) & (vm < 2.98) & ~glass
    a = np.where(frame[..., None], v3(0.48, 0.48, 0.52), a); a = np.where(glass[..., None], v3(0.05, 0.07, 0.10) + 0.05 * tn(H, W, 16, 6, seed + 3)[..., None], a)
    band = (vm > 3.2) & (vm < 4.4); a = np.where(band[..., None], v3(0.12, 0.12, 0.15) + 0.04 * tn(H, W, 30, 4, seed + 4)[..., None], a)
    a[(vm < 0.5)] *= 0.8; return np.clip(a, 0.01, 1)
def cont_pixels(N=1024):
    y, x = np.mgrid[0:N, 0:N].astype(np.float32); out = np.zeros((N, N, 3), np.float32)
    cols = [v3(0.75, 0.16, 0.12), v3(0.14, 0.32, 0.72), v3(0.90, 0.52, 0.14), v3(0.12, 0.55, 0.48)]
    n1 = fbm_t(N, N, 6, 150)
    for k, c in enumerate(cols):
        qx, qy = k % 2, k // 2; sl = (slice(qy * N // 2, (qy + 1) * N // 2), slice(qx * N // 2, (qx + 1) * N // 2))
        xs = x[sl]; ys = y[sl]; rib = 0.82 + 0.18 * np.sin(xs * (2 * math.pi / 12.0)); o = c * rib[..., None] * (0.7 + 0.5 * n1[sl])[..., None]
        o = o * (1 - 0.45 * np.clip((tn(N // 2, N // 2, 24, 3, 151 + k) - 0.55) * 3, 0, 1))[..., None]; o[(ys % (N // 2)) < 6] *= 0.6; out[sl] = o
    return np.clip(out, 0.01, 1)
def tower_pixels(N=1024, seed=160):
    """self-lit glass tower wall: 12 m x 12.8 m = 8 columns x 4 floors; lit windows in patterns, a few coloured"""
    r = np.random.default_rng(seed); a = np.zeros((N, N, 3), np.float32) + v3(0.05, 0.07, 0.11)
    cw, ch = N // 10, N // 4; palette = [v3(1.0, 0.82, 0.50)] * 8 + [v3(0.72, 0.86, 1.0)] * 3 + [v3(1.0, 0.35, 0.80), v3(0.25, 0.90, 1.0)]
    for fy in range(4):
        for fx in range(10):
            x0, y0 = fx * cw + 7, fy * ch + 38; x1, y1 = (fx + 1) * cw - 7, (fy + 1) * ch - 38
            lit = r.random() < 0.46; c = palette[r.integers(len(palette))] * (0.55 + 0.45 * r.random()) if lit else v3(0.07, 0.10, 0.16) + v3(0.03, 0.04, 0.06) * r.random()
            a[y0:y1, x0:x1] = c
            if lit: a[y0:y0 + 6, x0:x1] *= 0.7
    a[:, ::cw] *= 0.4; return np.clip(a, 0.01, 1)
def skyline_pixels(W=2048, H=512, seed=170):
    """a far skyline strip, tileable sideways: dark towers, lit windows, beacons, haze glow at the foot"""
    r = np.random.default_rng(seed); a = np.zeros((H, W, 3), np.float32); haze = np.exp(-np.arange(H, dtype=np.float32) / 70.0)[:, None, None]
    gy = np.clip(np.arange(H, dtype=np.float32) / 330.0, 0, 1)[:, None, None]; a += (v3(0.07, 0.10, 0.17) * gy + v3(0.04, 0.05, 0.09) * (1 - gy)) + haze * v3(0.30, 0.13, 0.10) * 0.8
    x = 0
    while x < W:
        w = int(r.integers(26, 90)); h = int(r.integers(70, 250) if r.random() < 0.75 else r.integers(240, 440)); w = min(w, W - x)
        a[:h, x:x + w] = v3(0.04, 0.055, 0.09) * (0.8 + 0.4 * r.random())
        for wy in range(14, h - 8, 12):
            for wx in range(x + 5, x + w - 5, 9):
                if r.random() < 0.34:
                    c = v3(1.0, 0.80, 0.48) if r.random() < 0.7 else (v3(0.7, 0.85, 1.0) if r.random() < 0.6 else v3(1.0, 0.3, 0.8))
                    a[wy:wy + 5, wx:wx + 5] = c * (0.5 + 0.5 * r.random())
        if h > 240:
            cc = [v3(1.0, 0.1, 0.7), v3(0.1, 0.9, 1.0), v3(1.0, 0.7, 0.2)][r.integers(3)]; a[h - 10:h - 4, x + 3:x + w - 3] = cc; a[h:h + 14, x + w // 2 - 1:x + w // 2 + 2] = v3(1.0, 0.1, 0.05)
        x += w + int(r.integers(0, 6))
    return np.clip(a, 0.0, 1)
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
SIGNS = [('KOMET', 'magenta'), ('NOVA RAMEN', 'amber'), ('ZENTRA', 'cyan'), ('VELOX', 'green'), ('LUNA BAR', 'magenta'), ('AURELIA', 'amber'), ('ORBIT', 'cyan'), ('NIGHTLINE', 'red')]
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
PICS = {}
def pictures():
    spec = {'road': road_pixels(2048, 2048), 'pave': pave_pixels(), 'concrete': concrete_pixels(), 'tunnel': tunnel_pixels(), 'kerb': kerb_pixels(), 'grass': grass_pixels(),
            'foliage': foliage_pixels(), 'roof': roof_pixels(), 'metal': metal_pixels(), 'water': water_pixels(), 'fac_a': facade_pixels('brick'), 'fac_b': facade_pixels('plaster', seed=130),
            'shop': shop_pixels(), 'cont': cont_pixels(), 'tower': tower_pixels(), 'sky': skyline_pixels(), 'sign': sign_atlas()}
    for k, a in spec.items(): PICS[k] = save_image(np.ascontiguousarray(a, dtype=np.float32), 'nl_' + k, TEXDIR)
    log('pictures', len(PICS))
pictures()
SELFLIT = {'sign': 'A', 'tower': 'B', 'sky': 'B'}; SELF_L = {'A': 3.2, 'B': 1.5}
TEXMATS = ['road', 'pave', 'grass', 'kerb', 'concrete', 'tunnel', 'fac_a', 'fac_b', 'shop', 'roof', 'tower', 'sky', 'sign', 'metal', 'water', 'foliage', 'cont']
MATS = TEXMATS + ['paint'] + ['emissive_' + k for k in COL]
MI = {n: i for i, n in enumerate(MATS)}
def make_materials():
    out = []
    for k in MATS:
        if k in PICS:
            m = image_material('nl_' + k, PICS[k], 0.35 if k in ('road', 'pave', 'water') else 0.55, 0.0)
        elif k == 'paint':
            m = bpy.data.materials.new('nl_paint'); m.use_nodes = True; b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
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
CS2 = C[::2]; GCS = np.array([GC(i) for i in range(0, N, 2)])
def ground_z(x, y):
    d2 = (CS2[:, 0] - x) ** 2 + (CS2[:, 1] - y) ** 2; w = 1.0 / (d2 + 120.0) ** 1.5; return float((w * GCS).sum() / w.sum())

# ---------------------------------------------------------------- THE ROAD, runoff strips, kerbs
ribbon(0, N, lambda i: [P(i, -7.0), P(i, 7.0)], 'road', UP, tile=(14.0, 18.0), dens=1.0)
for sg in (1, -1):
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 7.0), P(i, sg * 8.5)] if sg > 0 else [P(i, -8.5), P(i, -7.0)], 'pave', UP, tile=(4, 4), dens=0.6)
# kerbs: red / white on the inside of the tighter corners (radius under ~170 m), runs of 8+ samples only
KON = np.zeros(N, int)
for i in range(N):
    if abs(KAP[i]) > 1 / 170.0: KON[i] = 1 if KAP[i] > 0 else -1
for sgn in (1, -1):
    m = (KON == sgn).astype(int); i = 0
    while i < N:
        if m[i]:
            j = i
            while j < N and m[j]: j += 1
            if j - i < 8: m[i:j] = 0
            i = j
        else: i += 1
    ribbon(0, N, lambda i, sgn=sgn, m=m: ([P(i, sgn * 7.0, 0.035), P(i, sgn * 8.0, 0.035)] if m[i % N] and m[(i + 1) % N] else None), 'kerb', UP, tile=(1.0, 4.0), dens=0.7)
# ---------------------------------------------------------------- barriers: inner face exactly 8.5 m from the centre line, 1.0 m high, a light strip on top (left magenta, right cyan)
for sg, neon in ((1, 'magenta'), (-1, 'cyan')):
    inward = lambda i, sg=sg: -LFv(i) * sg; outward = lambda i, sg=sg: LFv(i) * sg
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 8.5), P(i, sg * 8.5, 1.0)], 'concrete', inward, tile=(3, 3), dens=0.9)
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 8.5, 1.0), P(i, sg * 9.0, 1.0)], 'concrete', UP, tile=(3, 3), dens=0.3)
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 9.0, 1.0), P(i, sg * 9.0, 0.0)], 'concrete', outward, tile=(3, 3), dens=0.3)
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 8.485, 0.78), P(i, sg * 8.485, 0.93)], 'emissive_' + neon, inward)
    ribbon(0, N, lambda i, sg=sg: [P(i, sg * 8.58, 1.012), P(i, sg * 8.80, 1.012)], 'emissive_' + neon, UP)
for sg, neon in ((1, 'magenta'), (-1, 'cyan')):
    for i in range(0, N, 5): RGL(P(i, sg * 8.6, 1.05), neon, 9.0)
log('road + barriers:', NFACE[0], 'faces')

# ---------------------------------------------------------------- the ground beside the road: sidewalk, verge, quay, bridge, tunnel
def normal_sec(i, sg):                                    # sidewalk (9 -> 12.5 m) then the verge out to 22 m, meeting the ground height GC
    if BRIDGE(i) or TUNNEL(i) or (sg > 0 and QUAYSIDE(i)): return None
    z9 = P(i, sg * 9.0).z; g = GC(i); p0 = P(i, sg * 9.0); p1 = PA(i, sg * 12.5, z9 + (g - z9) * 0.45); p2 = PA(i, sg * 22.0, g)
    return p0, p1, p2
def park(i): return zone(i / N) == 'park'
for sg in (1, -1):
    out = lambda i, sg=sg: LFv(i) * sg
    ribbon(0, N, lambda i, sg=sg: (lambda r: [r[0], r[1]] if r else None)(normal_sec(i, sg)), 'pave', UP, tile=(4, 4), dens=0.35)
    ribbon(0, N, lambda i, sg=sg: (lambda r: [r[1], r[2]] if r and not park(i) else None)(normal_sec(i, sg)), 'pave', UP, tile=(5, 5), dens=0.12)
    ribbon(0, N, lambda i, sg=sg: (lambda r: [r[1], r[2]] if r and park(i) else None)(normal_sec(i, sg)), 'grass', UP, tile=(4, 4), dens=0.12)
    ribbon(0, N, lambda i, sg=sg: (lambda r: [r[2], r[2] - Vector((0, 0, 1.6))] if r else None)(normal_sec(i, sg)), 'concrete', out, tile=(3, 3), dens=0.05)
    # quay edge on the harbour side: apron to 16 m, a wall down into the water
    def quay_sec(i, sg=sg):
        if sg < 0 or not QUAYSIDE(i) or BRIDGE(i) or TUNNEL(i): return None
        z9 = P(i, 9.0).z; return [P(i, 9.0), PA(i, 12.5, z9 - 0.08), PA(i, 16.0, z9 - 0.16)]
    ribbon(0, N, lambda i: quay_sec(i), 'pave', UP, tile=(4, 4), dens=0.5)
    ribbon(0, N, lambda i: (lambda r: [r[2], PA(i, 16.0, -0.7)] if r else None)(quay_sec(i)), 'concrete', lambda i: LFv(i), tile=(3, 3), dens=0.15)
# bridge deck: lip, fascia, underside, a cyan glow line under the edge, piers
for sg in (1, -1):
    out = lambda i, sg=sg: LFv(i) * sg
    ribbon(IB0, IB1, lambda i, sg=sg: [P(i, sg * 9.0), P(i, sg * 9.8)], 'concrete', UP, tile=(3, 3), dens=0.4)
    ribbon(IB0, IB1, lambda i, sg=sg: [P(i, sg * 9.8), P(i, sg * 9.8, -1.1)], 'concrete', out, tile=(3, 3), dens=0.3)
    ribbon(IB0, IB1, lambda i, sg=sg: [P(i, sg * 9.83, -0.78), P(i, sg * 9.83, -0.66)], 'emissive_cyan', out)
    for i in range(IB0, IB1, 4): RGL(P(i, sg * 9.85, -0.7), 'cyan', 8.0)
ribbon(IB0, IB1, lambda i: [P(i, -9.8, -1.1), P(i, 9.8, -1.1)], 'concrete', -UP, tile=(3, 3), dens=0.5)
for i in range(IB0 + 4, IB1 - 3, 10):
    p = P(i, 0, 0); bbox(p.x, p.y, -1.0, PSI[i], 2.4, 7.0, p.z + 1.0 - 1.1, 'concrete', dens=0.3, top=False, bottom=False)
# tunnel: inner tube (roof 7.6 m above the road, never under 6.6 m inside the corridor), warm lamp rows, a hill on top, portals
def tube_sec(i): return [P(i, 9.1, -0.3), P(i, 9.1, 6.6), PA(i, 6.0, C[i % N, 2] + 7.6), PA(i, -6.0, C[i % N, 2] + 7.6), P(i, -9.1, 6.6), P(i, -9.1, -0.3)]
ribbon(IT0, IT1, tube_sec, 'tunnel', None, tile=(2, 2), dens=0.8, hintp=lambda i, p: PA(i, 0, C[i % N, 2] + 3.0) - p)
ribbon(IT0, IT1, lambda i: [PA(i, -9.1, C[i % N, 2] + 8.2), PA(i, 9.1, C[i % N, 2] + 8.2)], 'grass', UP, tile=(4, 4), dens=0.1)
for sg in (1, -1):
    out = lambda i, sg=sg: LFv(i) * sg
    ribbon(IT0, IT1, lambda i, sg=sg: [PA(i, sg * 9.1, C[i % N, 2] + 8.2), PA(i, sg * 14.0, C[i % N, 2] + 8.6), PA(i, sg * 22.0, GC(i))], 'grass', UP, tile=(4, 4), dens=0.1)
    ribbon(IT0, IT1, lambda i, sg=sg: [PA(i, sg * 22.0, GC(i)), PA(i, sg * 22.0, GC(i) - 1.6)], 'concrete', out, tile=(3, 3), dens=0.05)
def portal(i, outdir):
    y = C[i % N, 2]; top = y + 9.0
    for sg in (1, -1):
        a0 = sg * 8.9; a1 = sg * 24.0
        F([PA(i, a0, P(i, a0).z - 0.3), PA(i, a1, P(i, a1).z - 0.3), PA(i, a1, top), PA(i, a0, top)], 'concrete', None, None, outdir, 0.4, 3.0)
    F([PA(i, -9.0, y + 6.6), PA(i, 9.0, y + 6.6), PA(i, 9.0, top), PA(i, -9.0, top)], 'concrete', None, None, outdir, 0.4, 3.0)
    for sg in (1, -1):                                    # a glowing frame round the mouth (outside the corridor)
        F([PA(i, sg * 8.95, y - 0.3), PA(i, sg * 9.25, y - 0.3), PA(i, sg * 9.25, y + 6.8), PA(i, sg * 8.95, y + 6.8)], 'emissive_amber', None, None, outdir)
    F([PA(i, -9.25, y + 6.62), PA(i, 9.25, y + 6.62), PA(i, 9.25, y + 6.85), PA(i, -9.25, y + 6.85)], 'emissive_amber', None, None, outdir)
    c = PA(i, 0, y + 7.9) + outdir * 0.05; eu = LFv(i) if outdir.dot(TGv(i)) < 0 else -LFv(i)
    quad_on(c, eu, UP, 5.0, 1.25, outdir, 'sign', panel_uv(6))
    LT(PA(i, 0, y + 5.0) + outdir * 3.0, COL['amber'], 900.0, 0.5)
    RGL(c + outdir * 0.3, 'amber', 10.0); RGL(PA(i, 0, y + 6.75) + outdir * 0.3, 'amber', 18.0)
    for sg in (1, -1): RGL(PA(i, sg * 9.1, y + 3.0) + outdir * 0.3, 'amber', 0.5)
portal(IT0, -TGv(IT0)); portal(IT1, TGv(IT1))
for i in range(IT0 + 2, IT1 - 1, 2):                      # warm lamp rows along the roof: two rows, a pool of light every 6 m
    for sg in (1, -1):
        p = PA(i, sg * 3.6, C[i % N, 2] + 7.52); ex = TGv(i); ey = LFv(i)
        obox(p, ex, ey, UP, 0.9, 0.22, 0.06, 'emissive_sodium', dens=1.0, top=False)
        if i % 4 == 2 or sg > 0: LT(p - Vector((0, 0, 0.4)), COL['sodium'], pw(1.2, 7.2) * (1.0 if i % 4 == 2 else 0.8), 0.4)
        if i % 6 == 0 and sg > 0: GLW(p, 'sodium', 7.0)
for i in range(IT0 + 8, IT1 - 6, 20):                     # emergency exit signs, green, low on the wall
    for sg in (1,):
        p = P(i, sg * 9.07, 3.2); F([p - TGv(i) * 0.5 - UP * 0.2, p + TGv(i) * 0.5 - UP * 0.2, p + TGv(i) * 0.5 + UP * 0.2, p - TGv(i) * 0.5 + UP * 0.2], 'emissive_green', None, None, -LFv(i) * sg); GLW(p, 'green', 4.0)
log('ground, bridge, tunnel:', NFACE[0], 'faces')

# ---------------------------------------------------------------- street lamps: every 30 m, alternating sides, sodium (cool white downtown), an arm over the road at 8.8 m
def street_lamps():
    for i in range(4, N, 10):
        if TUNNEL(i): continue
        z = zone(i / N); sg = 1 if (i // 10) % 2 == 0 else -1
        if sg > 0 and QUAYSIDE(i) and False: continue
        dp = 9.45 if BRIDGE(i) else 10.3
        bz = P(i, sg * dp).z; topz = bz + 8.8
        if sg > 0 and QUAYSIDE(i): bz = P(i, 9.0).z - 0.3
        base = PA(i, sg * dp, bz - 0.4); ex = TGv(i); ey = LFv(i)
        obox(Vector((base.x, base.y, (base.z + topz) / 2)), ex, ey, UP, 0.14, 0.14, (topz - base.z) / 2, 'metal', dens=2.0, bottom=False)
        beam(PA(i, sg * dp, topz), PA(i, sg * 7.7, topz + 0.15), 0.16, 'metal')
        cn = 'wcool' if z == 'downtown' else ('amber' if z in ('park', 'oldtown') else 'sodium')
        hp = PA(i, sg * 7.7, topz - 0.06)
        obox(hp, ex, ey, UP, 0.55, 0.25, 0.06, 'emissive_' + cn, dens=1.0)
        col = COL[cn] if cn != 'wcool' else (0.78, 0.88, 1.0)
        LT(hp - Vector((0, 0, 0.25)), col, pw(3.0, 8.5), 0.3); GLW(hp, cn, 9.0)
street_lamps()
for i in range(2, N, 7):                                  # bollard lamps along the quay edge: small amber lights that streak on the water
    if QUAYSIDE(i) and not BRIDGE(i):
        p = PA(i, 15.55, P(i, 9.0).z - 0.16); obox(Vector((p.x, p.y, p.z + 0.35)), TGv(i), LFv(i), UP, 0.16, 0.16, 0.35, 'emissive_amber', dens=1.0)
        if i % 14 == 2: LT(Vector((p.x, p.y, p.z + 0.9)), COL['amber'], 120.0, 0.1); GLW(Vector((p.x, p.y, p.z + 0.7)), 'amber', 3.5)
        else: RGL(Vector((p.x, p.y, p.z + 0.7)), 'amber', 0.5)
log('lamps:', NFACE[0], 'faces,', len(LIGHTS), 'lights')

# ---------------------------------------------------------------- buildings: walls with a painted facade, lit windows as emissive quads, shop fronts, signs, neon trim
STY = {
 'harbor':   dict(w=(16, 30), dep=(12, 18), H=(7, 13),  fac=['fac_a', 'fac_b'], neon=['amber', 'red', 'cyan'],      lit=0.30, tower=0.0,  sign=0.45, setback=16.0),
 'terminal': dict(w=(20, 34), dep=(14, 22), H=(8, 14),  fac=['fac_b'],          neon=['amber', 'red'],              lit=0.25, tower=0.0,  sign=0.40, setback=17.0),
 'avenue':   dict(w=(14, 24), dep=(12, 18), H=(14, 32), fac=['fac_a', 'fac_b'], neon=['magenta', 'amber', 'green'], lit=0.50, tower=0.0,  sign=0.85, setback=15.5),
 'downtown': dict(w=(18, 28), dep=(16, 24), H=(38, 85), fac=['fac_b'],          neon=['cyan', 'magenta'],           lit=0.50, tower=0.85, sign=0.55, setback=16.0),
 'oldtown':  dict(w=(12, 20), dep=(10, 16), H=(9, 19),  fac=['fac_a'],          neon=['green', 'amber', 'red'],     lit=0.45, tower=0.0,  sign=0.70, setback=15.5),
}
NSIGN = [0]
FRONTS = []; BUILDS = []
def wall_pts(c, n, hw):
    eu = RIGHT(n); return c - eu * hw, c + eu * hw, eu
def building_box(sg, ci, w, dep, H, front_d, fac, tower_p, detail=True, accent=None, shop_colors=None, lit=0.4, sign_p=0.5, rowback=False):
    """one building beside the road at sample ci: front face front_d metres from the centre line on side sg; returns its footprint radius"""
    ex = TGv(ci); ey = LFv(ci); cc = P(ci, sg * (front_d + dep / 2)); c = Vector((cc.x, cc.y, 0))
    corners = [c + ex * a * w / 2 + ey * b * dep / 2 for a in (-1, 1) for b in (-1, 1)]
    gz = [ground_z(p.x, p.y) for p in corners]; zg = max(gz) + 0.05; zb = min(gz) - 1.2
    zs = 4.5; nf = max(1, int((H - zs) / 3.2)); roofz = zg + zs + nf * 3.2
    front_n = -sg * ey; walls = [(front_n, c + front_n * dep / 2, w / 2, True), (-front_n, c - front_n * dep / 2, w / 2, False), (ex, c + ex * w / 2, dep / 2, False), (-ex, c - ex * w / 2, dep / 2, False)]
    accent = accent or ['amber']; ac = rng.choice(accent); offs = 3.0 * rng.randrange(4); is_tower = rng.random() < tower_p
    fm = 'tower' if is_tower else fac
    for n, wc, hw, front in walls:
        A, B, eu = wall_pts(wc, n, hw); u0 = offs / 12.0; u1 = (offs + 2 * hw) / 12.0
        if is_tower or rowback:
            F([A + UP * (zg + zs), B + UP * (zg + zs), B + UP * roofz, A + UP * roofz], fm, [(u0, 0), (u1, 0), (u1, (roofz - zg - zs) / 12.8), (u0, (roofz - zg - zs) / 12.8)], None, n, 0.1)
        else:
            F([A + UP * (zg + zs), B + UP * (zg + zs), B + UP * roofz, A + UP * roofz], fm, [(u0, 0), (u1, 0), (u1, nf), (u0, nf)], None, n, 0.2)
        F([A + UP * (zg), B + UP * (zg), B + UP * (zg + zs), A + UP * (zg + zs)], 'shop' if detail else fm, [(u0, 0), (u1, 0), (u1, 1), (u0, 1)] if detail else [(u0, 0), (u1, 0), (u1, 1.4), (u0, 1.4)], None, n, 0.2)
        F([A + UP * zb, B + UP * zb, B + UP * zg, A + UP * zg], 'concrete', None, None, n, 0.05)
    F([c + ex * w / 2 * a + ey * dep / 2 * b + UP * roofz for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))], 'roof', None, None, UP, 0.03, 6.0)
    if detail and not rowback:
        nk = int(w / 3.0); nlit = [0]
        for n, wc, hw, front in walls:
            if n.dot(-front_n) > 0.9: continue                                 # no windows on the back
            A, B, eu = wall_pts(wc, n, hw); nk = int(2 * hw / 3.0); pl = lit * (1.0 if front else 0.65)
            for f in range(nf):
                zc = zg + zs + 3.2 * f + 1.8
                for k in range(nk):
                    if rng.random() > pl: continue
                    r = rng.random(); cn = 'wwarm' if r < 0.66 else ('wcool' if r < 0.80 else ac)
                    quad_on(A + eu * (3 * k + 1.5) + UP * zc + n * 0.045, eu, UP, 0.68, 0.83, n, 'emissive_' + cn)
                    if front: nlit[0] += 1
            if front:
                for k in range(nk):
                    if rng.random() < 0.8:
                        sc_ = rng.choice(shop_colors or (['wwarm'] * 2 + ['wcool', ac])); p = A + eu * (3 * k + 1.5) + UP * (zg + 1.75) + n * 0.045
                        quad_on(p, eu, UP, 1.25, 1.12, n, 'emissive_' + sc_)
                        if k % 3 == 0: RGL(p + n * 0.3, sc_, 2.5)
                        if rng.random() < 0.3: LT(p + n * 2.2 + UP * 0.3, COL[sc_], 500.0, 0.4)
                if rng.random() < sign_p and 2 * hw > 7:
                    k0 = rng.randrange(max(1, nk - 1)); pk = rng.randrange(8); p = A + eu * (3 * k0 + 3.0) + UP * (zg + 3.85) + n * 0.07
                    quad_on(p, eu, UP, 2.2, 0.55, n, 'sign', panel_uv(pk)); cn = SIGNS[pk][1]; LT(p + n * 1.6 + UP * 0.3, COL[cn], 650.0, 0.4); GLW(p + n * 0.3, cn, 6.0)
                if rng.random() < sign_p * 0.5:                              # a blade sign at one end, standing out from the wall
                    pk = rng.randrange(8); side = rng.choice((0.8, 2 * hw - 0.8)); q = A + eu * side + n * 0.1; z0 = zg + 5.2; z1 = z0 + 3.4; cn = SIGNS[pk][1]
                    q0 = q + UP * z0; q1 = q + n * 1.2 + UP * z0; q2 = q + n * 1.2 + UP * z1; q3 = q + UP * z1
                    F([q0, q1, q2, q3], 'sign', panel_uv(pk, rot=True, flip=True), None, eu)
                    F([q0, q1, q2, q3], 'sign', panel_uv(pk, rot=True, flip=False), None, -eu)
                    LT((q0 + q2) / 2 + n * 1.6, COL[cn], 600.0, 0.4); GLW((q0 + q2) / 2 + n * 0.6, cn, 6.0)
                if rng.random() < 0.55:                                      # neon trim under the parapet
                    ct = rng.choice(accent)
                    F([A + UP * (roofz - 0.55) + n * 0.05, B + UP * (roofz - 0.55) + n * 0.05, B + UP * (roofz - 0.3) + n * 0.05, A + UP * (roofz - 0.3) + n * 0.05], 'emissive_' + ct, None, None, n)
                    if rng.random() < 0.5: LT((A + B) / 2 + UP * (roofz - 0.4) + n * 3.0, COL[ct], 900.0, 0.5); GLW((A + B) / 2 + UP * (roofz - 0.4) + n * 0.5, ct, 9.0)
                    else: RGL((A + B) / 2 + UP * (roofz - 0.4) + n * 0.5, ct, min(2 * hw, 14.0))
                if nlit[0] > 0 and front_d <= 40.0: RGL((A + B) / 2 + UP * (zg + (roofz - zg) / 2) + n * 0.3, 'wwarm', 2 * hw)
                FRONTS.append(dict(A=A, B=B, eu=eu, n=n, zg=zg, roofz=roofz, nk=nk, hw=hw, c=c, ex=ex, ey=ey, w=w, dep=dep, H=H, ci=ci, sg=sg, ac=ac))
    if detail and not rowback:
        for _k in range(rng.randrange(2, 5)):
            q = c + ex * rng.uniform(-w / 2 + 2, w / 2 - 2) + ey * rng.uniform(-dep / 2 + 2, dep / 2 - 2); sz = rng.uniform(1.2, 3.0)
            obox(q + UP * (roofz + sz * 0.4), ex, ey, UP, sz / 2, sz / 2 * rng.uniform(0.6, 1.4), sz * 0.4, 'metal', dens=0.3, bottom=False)
        if rng.random() < 0.5: beam(c + UP * roofz, c + UP * (roofz + rng.uniform(5, 9)), 0.12, 'metal')
    if H > 42 and not rowback:
        p = c + UP * (roofz + 0.4); obox(p, ex, ey, UP, 0.3, 0.3, 0.3, 'emissive_red', dens=1.0); GLW(p, 'red', 9.0)
    BUILDS.append((c.x, c.y, math.hypot(w, dep) / 2, roofz))
    return math.hypot(w, dep) / 2
def blocked_zone(i):
    return any(zone(((i + k) % N) / N) in ('bridge', 'park', 'tunnel') for k in (-9, 0, 9))
WHY = {}
def rect_circles(cc, ex, w, dep):
    n = max(1, int(round(w / dep))); r = max(dep, w / n) / 2.0
    return [(cc.x + ex.x * (-w / 2 + w * (k + 0.5) / n), cc.y + ex.y * (-w / 2 + w * (k + 0.5) / n), r) for k in range(n)]
def place_rows():
    n = 0
    for sg in (1, -1):
        for row in (0, 1, 2):
            i = 0
            while i < N:
                t = i / N; zn = zone(t)
                if blocked_zone(i) or (sg > 0 and QUAYSIDE(i)) or (sg < 0 and (t >= 0.955 or t < 0.13) and row == 0) or (sg < 0 and (t >= 0.94 or t < 0.13)):
                    i += 3; continue
                st = STY[zn]; w = rng.uniform(*st['w']); dep = rng.uniform(*st['dep']); H = rng.uniform(*st['H']); ci = i + int(w / 2 / STEP)
                if blocked_zone(ci) or (sg > 0 and QUAYSIDE(ci)): i += 3; continue
                fd = st['setback'] + row * (22.0 if row == 1 else 52.0) + rng.uniform(0, 2.0)
                if row == 1: H = rng.uniform(30, 75) if zn in ('avenue', 'downtown', 'oldtown') else rng.uniform(16, 30)
                if row == 2: H = rng.uniform(45, 105) if zn in ('avenue', 'downtown') else rng.uniform(20, 45)
                cc = P(ci, sg * (fd + dep / 2)); ex = TGv(ci); ey = LFv(ci); r = math.hypot(w, dep) / 2
                pts = [P(ci, sg * (fd + dep / 2)) + ex * a * w / 2 + ey * b * dep / 2 for a in (-1, 0, 1) for b in (-1, 1)]
                o1 = all(nearest(p.x, p.y)[1] >= st['setback'] - 0.8 for p in pts); o2 = all(free(a, b, rr, 1.0) for a, b, rr in rect_circles(cc, ex, w, dep)); o3 = all(-338 < p.x < 330 and -258 < p.y < 186 for p in pts)
                ok = o1 and o2 and o3; (WHY.__setitem__((zn, sg, o1, o2, o3), WHY.get((zn, sg, o1, o2, o3), 0) + 1) if row == 0 else None)
                if ok:
                    building_box(sg, ci, w, dep, H, fd, rng.choice(st['fac']), st['tower'] if row == 0 else 1.0, detail=(row == 0), accent=st['neon'], lit=st['lit'] * rng.uniform(0.6, 1.3), sign_p=st['sign'], rowback=(row > 0))
                    [occupy(a, b, rr) for a, b, rr in rect_circles(cc, ex, w, dep)]; n += 1; i = ci + int(w / 2 / STEP) + int(rng.uniform(0, 2.5))
                else: i += 2
    log('buildings:', n, WHY)

# ---------------------------------------------------------------- landmarks and set pieces (placed first: they register what they occupy)
PLACED = []                                               # (x, y, radius) footprints
def occupy(x, y, r): PLACED.append((x, y, r))
def free(x, y, r, slack=3.0): return all(math.hypot(x - a, y - b) > r + rr - slack for a, b, rr in PLACED)
def RIGHT(n): return UP.cross(n)                          # to the right of a viewer who looks at a face with outward normal n
def neon_pick(names): return rng.choice(names)
def zdir(c, d): return Vector((c.x - d.x, c.y - d.y, 0)).normalized()
def container(c, ex, ey, ez, q, L=6.1, W=1.22, H=1.3):
    qx, qy = q % 2, q // 2; u0 = qx * 0.5 + 0.01; u1 = u0 + 0.48; v0 = qy * 0.5 + 0.01; v1 = v0 + 0.48
    uv = lambda: [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
    pt = lambda a, b, d: c + ex * (L * a) + ey * (W * b) + ez * (H * d)
    F([pt(-1, -1, 1), pt(1, -1, 1), pt(1, 1, 1), pt(-1, 1, 1)], 'cont', uv(), None, ez, 1.5)
    F([pt(1, -1, -1), pt(1, 1, -1), pt(1, 1, 1), pt(1, -1, 1)], 'cont', uv(), None, ex, 1.5)
    F([pt(-1, 1, -1), pt(-1, -1, -1), pt(-1, -1, 1), pt(-1, 1, 1)], 'cont', uv(), None, -ex, 1.5)
    F([pt(1, 1, -1), pt(-1, 1, -1), pt(-1, 1, 1), pt(1, 1, 1)], 'cont', uv(), None, ey, 1.5)
    F([pt(-1, -1, -1), pt(1, -1, -1), pt(1, -1, 1), pt(-1, -1, 1)], 'cont', uv(), None, -ey, 1.5)
def pole_light(p, h, col, W, ex, ey, name='wcool', size=9.0):                       # a floodlight mast: pole, a lamp panel facing `ey`, a point lamp
    base = Vector((p.x, p.y, p.z - 0.4)); obox(Vector((p.x, p.y, base.z + (h + 0.4) / 2)), ex, ey, UP, 0.25, 0.25, (h + 0.4) / 2, 'metal', dens=1.5, bottom=False)
    hp = Vector((p.x, p.y, p.z + h)) + ey * 0.6; obox(hp, ex, ey, UP, 1.6, 0.18, 0.9, 'emissive_' + name, dens=1.0)
    LT(hp + ey * 1.5, col, W, 0.6); GLW(hp, name, size)

def gantry(i):                                            # start gantry over sample i: beam bottom 6.6 m up, red lights and the NIGHTLINE board facing the grid
    y = C[i % N, 2]; ex = TGv(i); ey = LFv(i); back = -ex
    for sg in (1, -1):
        b = P(i, sg * 10.8); obox(Vector((b.x, b.y, (b.z - 0.4 + y + 7.8) / 2)), ex, ey, UP, 0.5, 0.45, (y + 7.8 - b.z + 0.4) / 2, 'metal', dens=1.5, bottom=False)
    obox(PA(i, 0, y + 7.1), ex, ey, UP, 0.7, 11.3, 0.5, 'metal', dens=1.5, bottom=True)
    for dd in (-4, -2, 0, 2, 4):
        p = PA(i, dd, y + 7.1) + back * 0.8; obox(p, ex, ey, UP, 0.12, 0.5, 0.5, 'emissive_red', dens=1.0); GLW(p, 'red', 6.0)
    for dd in (-4.5, 0, 4.5): LT(PA(i, dd, y + 6.2) + back * 1.5, COL['red'], 500.0, 0.3)
    c = PA(i, 0, y + 9.6) + back * 0.75; n = back
    for dd in (-3.2, 3.2): beam(PA(i, dd, y + 7.6), PA(i, dd, y + 8.7), 0.25, 'metal')
    quad_on(c, RIGHT(n), UP, 4.0, 1.0, n, 'sign', panel_uv(7)); LT(c + back * 2.0, COL['red'], 700.0, 0.5)
    RGL(c + back * 0.3, 'red', 8.0); RGL(PA(i, 0, y + 7.8) + back * 0.8, 'cyan', 20.0)
    F([PA(i, -10.2, y + 7.7) + back * 0.72, PA(i, 10.2, y + 7.7) + back * 0.72, PA(i, 10.2, y + 7.85) + back * 0.72, PA(i, -10.2, y + 7.85) + back * 0.72], 'emissive_cyan', None, None, back)
    # the line, eight grid boxes (two columns, staggered, 9 m apart going back)
    for r in range(2):
        for c_ in range(28):
            if (r + c_) % 2 == 0:
                s0 = r * 0.5; s1 = s0 + 0.5; d0 = -7.0 + c_ * 0.5; d1 = d0 + 0.5
                F([Pf(s0 / STEP, d0, 0.025), Pf(s0 / STEP, d1, 0.025), Pf(s1 / STEP, d1, 0.025), Pf(s1 / STEP, d0, 0.025)], 'paint', None, None, UP, 1.0)
    for j in range(8):
        dc = -2.6 if j % 2 == 0 else 2.6; sb = 8.0 + 9.0 * j; sf = sb - 5.5
        bars = [(-sb, -sf, dc - 1.3, dc + 1.3, 0.14, True), (-sb, -sf, dc - 1.3, dc - 1.18, 0.14, False), (-sb, -sf, dc + 1.18, dc + 1.3, 0.14, False)]
        F([Pf(-(sb - 0.14) / STEP, dc - 1.3, 0.025), Pf(-(sb - 0.14) / STEP, dc + 1.3, 0.025), Pf(-sb / STEP, dc + 1.3, 0.025), Pf(-sb / STEP, dc - 1.3, 0.025)], 'paint', None, None, UP, 1.0)
        for dd0, dd1 in ((dc - 1.3, dc - 1.16), (dc + 1.16, dc + 1.3)):
            F([Pf(-(sb - 2.0) / STEP, dd0, 0.025), Pf(-(sb - 2.0) / STEP, dd1, 0.025), Pf(-sb / STEP, dd1, 0.025), Pf(-sb / STEP, dd0, 0.025)], 'paint', None, None, UP, 1.0)
gantry(0)
def grandstand():                                         # inland side of the start straight: stepped stands under a canopy, the pit garages behind, floodlight masts
    ic = 32; ex = TGv(ic); ey = LFv(ic); yaw = PSI[ic]; L = 150.0
    _p = P(ic, -30); zg = ground_z(_p.x, _p.y)
    for k in range(6):
        dc = -(19.0 + 1.7 * k + 0.85); c = P(ic, dc); bbox(c.x, c.y, zg - 0.3, yaw, L, 1.7, 0.3 + 0.9 * (k + 1), 'concrete', dens=0.25, bottom=False)
    c = P(ic, -(19 + 10.2 + 8.4)); occupy(c.x, c.y, 60)
    building_box(-1, ic, L, 14.0, 12.5, 19.0 + 10.2 + 1.0, 'fac_b', 0.0, detail=True, accent=['amber', 'cyan'], shop_colors=['wwarm', 'wcool', 'amber'])
    cc = P(ic, -25.5); bbox(cc.x, cc.y, zg + 8.0, yaw, L, 15.0, 0.4, 'roof', dens=0.2)
    for k in range(-5, 6):
        p = P(ic, -35.0) + ex * (k * 12.5); obox(Vector((p.x, p.y, zg + 4.2)), ex, ey, UP, 0.3, 0.3, 4.4, 'metal', dens=1.0, bottom=False)
    p = P(ic, -18.2) ; obox(Vector((p.x, p.y, zg + 7.75)), ex, ey, UP, L / 2, 0.15, 0.1, 'emissive_wcool', dens=1.0)
    for k in range(-6, 7): RGL(Vector((p.x, p.y, zg + 7.75)) + ex * (k * 12.0), 'wcool', 12.0)
    for k in range(-5, 6):
        p = P(ic, -22.0) + ex * (k * 12.5 + 6); LT(Vector((p.x, p.y, zg + 7.4)), (0.8, 0.9, 1.0), pw(1.6, 7.0), 0.4)
    for ii in (14, 36, 58):
        b = P(ii, -13.5); pole_light(b, 22.0, (0.85, 0.92, 1.0), pw(1.5, 22.0), TGv(ii), LFv(ii))
grandstand()

def crane(i):                                             # a quay crane on the apron: 4 legs outside the barrier, a boom over the water, red aircraft lights
    ex = TGv(i); ey = LFv(i); b = P(i, 12.5).z - 0.35; ctr = P(i, 0)
    pos = lambda x, d, z: Vector((ctr.x + ex.x * x + ey.x * d, ctr.y + ex.y * x + ey.y * d, z))
    for x in (-8.0, 8.0):
        for d in (11.4, 15.2): obox(pos(x, d, b + 13.0), ex, ey, UP, 0.55, 0.55, 13.0, 'metal', dens=1.5, bottom=False)
        obox(pos(x, 13.3, b + 25.5), ex, ey, UP, 0.6, 2.6, 0.7, 'metal', dens=1.5, bottom=True)
    for d in (11.4, 15.2): obox(pos(0, d, b + 25.5), ex, ey, UP, 8.6, 0.55, 0.7, 'metal', dens=1.5, bottom=True)
    obox(pos(0, 36.6, b + 27.2), ex, ey, UP, 0.8, 25.4, 0.7, 'metal', dens=1.5, bottom=True)
    obox(pos(0, 13.3, b + 29.2), ex, ey, UP, 2.6, 2.0, 1.5, 'metal', dens=1.5, bottom=True)
    obox(pos(0, 40.0, b + 25.2), ex, ey, UP, 1.6, 1.4, 1.2, 'metal', dens=1.5, bottom=True)
    obox(pos(0, 40.0 + 1.45, b + 25.4), ex, ey, UP, 0.9, 0.05, 0.6, 'emissive_wwarm', dens=1.0)
    beam(pos(0, 13.3, b + 30.5), pos(0, 13.3, b + 41.0), 0.5, 'metal'); beam(pos(0, 13.3, b + 41.0), pos(0, 60.0, b + 27.8), 0.14, 'metal'); beam(pos(0, 13.3, b + 41.0), pos(0, 9.6, b + 27.8), 0.14, 'metal')
    for p in (pos(0, 13.3, b + 41.6), pos(0, 61.0, b + 28.4), pos(0, 36.6, b + 28.4)):
        obox(p, ex, ey, UP, 0.28, 0.28, 0.28, 'emissive_red', dens=1.0); GLW(p, 'red', 9.0)
    LT(pos(0, 61.0, b + 26.5), COL['red'], 400.0, 0.3); LT(pos(0, 40.0, b + 23.0), COL['wwarm'], 500.0, 0.3)
    RGL(pos(0, 41.5, b + 25.4), 'wwarm', 1.8)
    for d in (20.0, 30.0, 50.0): RGL(pos(0, d, b + 26.4), 'wcool', 1.0)
    occupy(ctr.x, ctr.y + 0, 0.1)
for ii in (8, 24, 43, 62, 80, 98): crane(ii)

def containers_block(i0, i1, dlist, hmax=4, skip=0.12):
    for ii in range(i0, i1, 4):
        ex = TGv(ii); ey = LFv(ii)
        for dd in dlist:
            if rng.random() < skip: continue
            c = P(ii, dd); zg = ground_z(c.x, c.y)
            if not free(c.x, c.y, 6.5, 6.0): continue
            for lv in range(rng.choice([1, 2, 2, 3, hmax])):
                container(Vector((c.x, c.y, zg + 1.3 + 2.6 * lv)), ex, ey, UP, rng.randrange(4))
            if rng.random() < 0.1: LT(Vector((c.x, c.y, zg + 12.0)), COL['sodium'], 400.0, 0.3)
    for sx in range(i0 + 6, i1, 28):                      # yard floodlights
        b = P(sx, dlist[0] + 4.0); pole_light(b, 16.0, (1.0, 0.8, 0.55), pw(1.7, 16.0), TGv(sx), -LFv(sx), 'sodium', 8.0)
containers_block(66, 120, [-24.0, -26.7, -29.4, -35.0, -37.7, -40.4, -47.0, -49.7]); _c = P(93, -37.0); occupy(_c.x, _c.y, 88)
containers_block(124, 152, [-22.5, -25.2, -31.0, -33.7]); _c = P(138, -28.0); occupy(_c.x, _c.y, 55)

def ship():
    y0 = 213.0; z0 = -0.9; z1 = 5.8
    outline = [(-150, y0 - 15), (-22, y0 - 15), (14, y0 - 3.5), (14, y0 + 3.5), (-22, y0 + 15), (-150, y0 + 15)]
    for k in range(len(outline)):
        a = outline[k]; b = outline[(k + 1) % len(outline)]; mid = Vector(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 2))
        nrm = Vector((b[1] - a[1], -(b[0] - a[0]), 0)).normalized(); F([Vector((a[0], a[1], z0)), Vector((b[0], b[1], z0)), Vector((b[0], b[1], z1)), Vector((a[0], a[1], z1))], 'metal', None, None, nrm, 0.3, 6.0)
    F([Vector((p[0], p[1], z1)) for p in outline], 'roof', None, None, UP, 0.3, 6.0)
    ex = Vector((1, 0, 0)); ey = Vector((0, 1, 0))
    for xx in range(-118, -16, 13):
        for yy in (-10.4, -7.8, -5.2, -2.6, 0.0, 2.6, 5.2, 7.8, 10.4):
            if abs(xx + 118) > 70 and abs(yy) > 6: continue
            for lv in range(rng.choice([1, 2, 2, 3])): container(Vector((xx, y0 + yy, z1 + 1.3 + 2.6 * lv)), ex, ey, UP, rng.randrange(4))
    bbox(-138, y0, z1, 0.0, 22, 26, 16, 'tower', dens=0.2, top=False)
    F([Vector((-149, y0 - 13, z1 + 16)), Vector((-127, y0 - 13, z1 + 16)), Vector((-127, y0 + 13, z1 + 16)), Vector((-149, y0 + 13, z1 + 16))], 'roof', None, None, UP, 0.2)
    bbox(-128, y0, z1 + 16, 0.0, 6, 6, 7, 'cont', dens=0.2); beam((-138, y0, z1 + 16), (-138, y0, z1 + 31), 0.3, 'metal')
    for p in ((-138, y0, z1 + 31.4), (-150.5, y0 - 13, z1 + 17), (14, y0, z1 + 1)): obox(Vector(p), ex, ey, UP, 0.3, 0.3, 0.3, 'emissive_red', dens=1.0); GLW(p, 'red', 8.0)
    for sx in (-1, 1):
        for xx in range(-146, 6, 8):
            p = Vector((xx, y0 + sx * 14.6, z1 + 1.0)); obox(p, ex, ey, UP, 0.25, 0.25, 0.25, 'emissive_wcool', dens=1.0)
            if xx % 24 == 2: LT(p + Vector((0, sx * 0.5, 2.0)), (0.85, 0.92, 1.0), 1300.0, 0.3); GLW(p, 'wcool', 7.0)
            else: RGL(p, 'wcool', 0.6)
    RGL(Vector((13.2, y0 - 3.0, z1 + 0.6)), 'red', 0.6); RGL(Vector((13.2, y0 + 3.0, z1 + 0.6)), 'green', 0.6); RGL(Vector((-138, y0 - 14, z1 + 8)), 'wcool', 6.0)
    obox(Vector((13.2, y0 - 3.0, z1 + 0.6)), ex, ey, UP, 0.3, 0.3, 0.3, 'emissive_red', dens=1.0); obox(Vector((13.2, y0 + 3.0, z1 + 0.6)), ex, ey, UP, 0.3, 0.3, 0.3, 'emissive_green', dens=1.0)
    occupy(-70, y0, 100)
ship()

def pylons():                                             # lit cable-stayed bridge: two H-pylons over the deck, glowing cable fans
    for fr in (0.27, 0.73):
        ip = IB0 + int((IB1 - IB0) * fr); y = C[ip % N, 2]; ex = TGv(ip); ey = LFv(ip)
        for sg in (1, -1):
            c = PA(ip, sg * 10.6, 0); obox(Vector((c.x, c.y, (-1.0 + y + 26) / 2)), ex, ey, UP, 0.8, 0.65, (y + 27) / 2, 'concrete', dens=0.3, bottom=False)
        obox(PA(ip, 0, y + 24.8), ex, ey, UP, 0.8, 10.6, 0.8, 'concrete', dens=0.3, bottom=True)
        obox(PA(ip, 0, y + 20.0), ex, ey, UP, 0.5, 10.6, 0.4, 'concrete', dens=0.3, bottom=True)
        for p in (PA(ip, 10.6, y + 26.4), PA(ip, -10.6, y + 26.4)): obox(p, ex, ey, UP, 0.3, 0.3, 0.3, 'emissive_red', dens=1.0); GLW(p, 'red', 9.0)
        for sg in (1, -1):
            for dr in (1, -1):
                for j in range(5):
                    ia = ip + dr * (4 * j + 3); top = PA(ip, sg * 10.6, y + 23.0 - 2.9 * j)
                    pa = P(ia, sg * 9.55, 0.35); beam(top, pa, 0.13, 'emissive_cyan')
                    if j % 2 == 0: obox(pa + UP * 0.1, TGv(ia), LFv(ia), UP, 0.22, 0.22, 0.22, 'emissive_wcool', dens=1.0); GLW(pa, 'cyan', 7.0)
                    else: RGL((top + pa) / 2, 'cyan', 0.6)
            LT(PA(ip, sg * 10.6, y + 14.0) - LFv(ip) * sg * 0.8, COL['cyan'], 3000.0, 0.5)
        LT(PA(ip, 0, y + 19.0), COL['cyan'], 4500.0, 0.6)
        for zz in (4.0, 9.0, 14.0, 19.0, 24.0):
            for sg in (1, -1): RGL(PA(ip, sg * 10.6, y + zz), 'wcool', 1.6)
        RGL(PA(ip, 0, y + 24.8), 'cyan', 20.0); RGL(PA(ip, 0, y + 20.0), 'cyan', 20.0)
pylons()

# the arch over the road at the park gate, a needle tower (avenue), a clock tower (old town)
def arch(i):
    y = C[i % N, 2]; ex = TGv(i); ey = LFv(i); back = -ex
    for sg in (1, -1):
        b = P(i, sg * 10.9); obox(Vector((b.x, b.y, (b.z - 0.4 + y + 10.4) / 2)), ex, ey, UP, 0.65, 0.65, (y + 10.4 - b.z + 0.4) / 2, 'metal', dens=1.5, bottom=False)
    obox(PA(i, 0, y + 9.8), ex, ey, UP, 0.7, 11.3, 0.7, 'metal', dens=1.5, bottom=True)
    F([PA(i, -10.5, y + 9.4) + back * 0.72, PA(i, 10.5, y + 9.4) + back * 0.72, PA(i, 10.5, y + 9.7) + back * 0.72, PA(i, -10.5, y + 9.7) + back * 0.72], 'emissive_amber', None, None, back)
    c = PA(i, 0, y + 11.9) + back * 0.1; n = back; quad_on(c, RIGHT(n), UP, 4.0, 1.0, n, 'sign', panel_uv(5)); LT(c + back * 2.5, COL['amber'], 900.0, 0.5); RGL(c + back * 0.3, 'amber', 8.0); RGL(PA(i, 0, y + 9.55) + back * 0.8, 'amber', 18.0)
    for dd in (-6.5, 0, 6.5): LT(PA(i, dd, y + 8.6) + back * 1.0, COL['amber'], 1100.0, 0.3)
    GLW(PA(i, -10.5, y + 9.5), 'amber', 8.0); GLW(PA(i, 10.5, y + 9.5), 'amber', 8.0)
arch(int(0.455 * N))
def needle(i, dd, Hn, ca, cb, k=0):
    c = P(i, dd); zg = ground_z(c.x, c.y); n = zdir(P(i, 0), c) * -1; n = Vector((-n.x, -n.y, 0)) if False else zdir(P(i, 0), c)
    ex, ey, _ = yaw_axes(math.atan2(n.y, n.x))
    bbox(c.x, c.y, zg - 1.5, math.atan2(n.y, n.x), 8, 8, Hn, 'tower', dens=0.1)
    for zr, cn in ((Hn * 0.78, ca), (Hn * 0.62, cb), (Hn * 0.46, ca)):
        obox(Vector((c.x, c.y, zg + zr)), ex, ey, UP, 4.6, 4.6, 0.45, 'emissive_' + cn, dens=1.0); LT(Vector((c.x, c.y, zg + zr)) + n * 6.0, COL[cn], 2500.0, 0.5); GLW(Vector((c.x, c.y, zg + zr)), cn, 14.0)
    beam(Vector((c.x, c.y, zg + Hn)), Vector((c.x, c.y, zg + Hn + 16)), 0.4, 'metal'); p = Vector((c.x, c.y, zg + Hn + 16.3)); obox(p, ex, ey, UP, 0.4, 0.4, 0.4, 'emissive_red', dens=1.0); GLW(p, 'red', 12.0)
    quad_on(Vector((c.x, c.y, zg + Hn * 0.3 + 6)) + n * 4.05, RIGHT(n) * 1.0, UP, 2.2, 11.0, n, 'sign', panel_uv(k, rot=True)) if k >= 0 else None
    if k >= 0: RGL(Vector((c.x, c.y, zg + Hn * 0.3 + 12)) + n * 4.4, SIGNS[k][1], 4.4)
    occupy(c.x, c.y, 20)
needle(int(0.395 * N), -92.0, 78.0, 'magenta', 'cyan', 0)
needle(int(0.735 * N), -80.0, 96.0, 'cyan', 'magenta', 2)
needle(int(0.73 * N), 70.0, 80.0, 'magenta', 'cyan', 4)
def clock_tower(i, dd):
    c = P(i, dd); zg = ground_z(c.x, c.y); n = zdir(P(i, 0), c); yaw = math.atan2(n.y, n.x); ex, ey, _ = yaw_axes(yaw)
    bbox(c.x, c.y, zg - 1.5, yaw, 8, 8, 36, 'fac_a', dens=0.2)
    top = Vector((c.x, c.y, zg + 34.5))
    for k in range(4):
        a0 = yaw + k * math.pi / 2; a1 = a0 + math.pi / 2; p0 = Vector((c.x + 5.6 * math.cos(a0 + math.pi / 4), c.y + 5.6 * math.sin(a0 + math.pi / 4), top.z)); p1 = Vector((c.x + 5.6 * math.cos(a1 + math.pi / 4), c.y + 5.6 * math.sin(a1 + math.pi / 4), top.z))
        F([p0, p1, top + Vector((0, 0, 9))], 'roof', None, None, (p0 + p1) / 2 - top)
    fc = top - Vector((0, 0, 7.5)) + n * 4.05; r = 2.9
    F([fc + RIGHT(n) * r * math.cos(a) + UP * r * math.sin(a) for a in [k * math.pi / 8 for k in range(16)]], 'emissive_wwarm', None, None, n)
    F([fc + n * 0.05 + RIGHT(n) * 0.12 * s + UP * h for s, h in ((-1, 0), (1, 0), (1, 2.1), (-1, 2.1))], 'roof', None, None, n)
    F([fc + n * 0.05 + UP * 0.12 * s + RIGHT(n) * h for s, h in ((-1, 0), (1, 0), (1, 1.6), (-1, 1.6))], 'roof', None, None, n)
    LT(fc + n * 3.0, COL['wwarm'], 1500.0, 0.5); GLW(fc, 'wwarm', 16.0); occupy(c.x, c.y, 14)
clock_tower(int(0.885 * N), -36.0)

# billboards on the outside of the corners, facing the approach
def billboards():
    ap = []
    for i in range(N):
        zn = zone(i / N)
        if zn in ('bridge', 'tunnel') or abs(KAP[i]) < 1 / 140.0: continue
        if all(abs(KAP[(i + k) % N]) <= abs(KAP[i]) for k in range(-25, 26)) and all(abs(i - j) > 30 for j in ap): ap.append(i)
    k = 0
    for i in ap:
        sg = -1 if KAP[i] > 0 else 1
        if sg > 0 and QUAYSIDE(i): sg = -1 if False else 1
        c = P(i, sg * 17.0); zg = ground_z(c.x, c.y)
        if c.y > 184 or not free(c.x, c.y, 9.0, 2.0): continue
        n = zdir(P(i - 20, 0), c); w = 9.0; h = 2.25; bz = zg + 8.5
        ex = Vector((n.y, -n.x, 0)); yaw = math.atan2(ex.y, ex.x)
        quad_on(Vector((c.x, c.y, bz + h)) + n * 0.25, RIGHT(n), UP, w, h, n, 'sign', panel_uv(k % 8))
        bbox(c.x, c.y, bz - 0.1, yaw, 0.3 + 2 * w, 0.4, 2 * h + 0.2, 'metal', dens=0.4)
        for s in (-1, 1): obox(Vector((c.x, c.y, (zg - 0.4 + bz) / 2)) + ex * (s * w * 0.6), ex, n, UP, 0.35, 0.35, (bz - zg + 0.4) / 2, 'metal', dens=1.0, bottom=False)
        cn = SIGNS[k % 8][1]
        for s in (-1, 1): LT(Vector((c.x, c.y, bz + h)) + n * 3.5 + ex * (s * w * 0.45), COL[cn], 1500.0, 0.5)
        GLW(Vector((c.x, c.y, bz + h)) + n * 0.5, cn, 12.0); occupy(c.x, c.y, 9.0); k += 1
    log('billboards:', k)
billboards()
log('set pieces:', NFACE[0], 'faces,', len(LIGHTS), 'lights')

# ---------------------------------------------------------------- the park: lit trees
def blob(c, r, mat='foliage'):
    c = Vector(c); ring = []
    for k in range(8):
        a = k * math.pi / 4 + rng.uniform(-0.15, 0.15); rr = r * rng.uniform(0.85, 1.1); ring.append(c + Vector((rr * math.cos(a), rr * math.sin(a), rng.uniform(-0.1, 0.1) * r)))
    top = c + Vector((0, 0, r * 0.95)); bot = c - Vector((0, 0, r * 0.7))
    for k in range(8):
        a = ring[k]; b = ring[(k + 1) % 8]
        F([top, a, b], mat, None, None, (top + a + b) / 3 - c, 1.5, 4.0); F([bot, b, a], mat, None, None, (bot + a + b) / 3 - c, 1.5, 4.0)
def make_tree(p, g, to_road, s, cnt, rr=2.0):
    h = rng.uniform(2.6, 3.6) * s; yaw = rng.uniform(0, 3)
    bbox(p.x, p.y, g - 0.3, yaw, 0.7, 0.7, h + 0.3, 'concrete', dens=2.0, bottom=False)
    cz = g + h + 1.6 * s; blob(Vector((p.x, p.y, cz)), 2.5 * s); blob(Vector((p.x + 1.0 * s, p.y + 0.5 * s, cz - 1.1 * s)), 1.9 * s)
    for _k in range(3):
        a = rng.uniform(-1.2, 1.2); dirv = Vector((to_road.x * math.cos(a) - to_road.y * math.sin(a), to_road.x * math.sin(a) + to_road.y * math.cos(a), 0))
        q = Vector((p.x, p.y, cz + rng.uniform(-1.0, 0.6) * s)) + dirv * 2.6 * s
        quad_on(q, RIGHT(dirv), UP, 0.14, 0.14, dirv, 'emissive_' + rng.choice(('amber', 'wwarm', 'amber', 'green')))
    if cnt % 4 == 0: LT(Vector((p.x, p.y, g + 0.6)) + to_road * 1.5, COL[rng.choice(('amber', 'green', 'cyan', 'amber'))], 450.0, 0.3)
    if cnt % 3 == 0: GLW(Vector((p.x, p.y, cz)) + to_road * 2.4, 'amber', 6.0)
    occupy(p.x, p.y, rr)
def park_trees():
    cnt = 0
    for i in range(int(0.45 * N), int(0.60 * N), 2):
        for sg in (1, -1):
            for _ in range(rng.choice((1, 1, 2, 3))):
                d = sg * rng.uniform(14.5, 52.0); p = P(i, d); g = GC(i); p = Vector((p.x, p.y, g))
                if nearest(p.x, p.y)[1] < 13.5 or not free(p.x, p.y, 2.0, 2.0): continue
                make_tree(p, g, zdir(P(i, 0), p), rng.uniform(0.9, 1.4), cnt); cnt += 1
    for i in range(0, N, 10):                             # street trees on the sidewalk between the lamps, in the city stretches
        if zone(i / N) not in ('avenue', 'downtown', 'oldtown') or blocked_zone(i): continue
        for sg in (1, -1):
            ii = i + 5 if sg > 0 else i + 10; p = P(ii, sg * 11.9); g = GC(ii); p = Vector((p.x, p.y, g - 0.1))
            if sg * 0 == 0 and not free(p.x, p.y, 1.5, 0.5): continue
            make_tree(p, g - 0.1, zdir(P(ii, 0), p), 0.7, cnt, 1.5); cnt += 1
    log('trees:', cnt)
park_trees()
place_rows()
# ---------------------------------------------------------------- more city: gantries, bridges, chevrons, street furniture, shop awnings, roofs, cars, a rail viaduct, the wheel, the lighthouse, boats, a skyline
R2 = random.Random(2468); DET = {}
def cnt_(k): DET[k] = DET.get(k, 0) + 1
CITYZ = ('harbor', 'terminal', 'avenue', 'downtown', 'oldtown')
def gh(i, sg, d):                                         # the pavement height at distance d from the centre line (same shape as normal_sec / quay_sec)
    d = abs(d); i0 = i % N; z9 = P(i0, sg * 9.0).z
    if sg > 0 and QUAYSIDE(i0): return z9 - 0.08 * min(1.0, (d - 9.0) / 3.5)
    g = GC(i0); zm = z9 + (g - z9) * 0.45
    if d <= 12.5: return z9 + (g - z9) * 0.45 * (d - 9.0) / 3.5
    return zm + (g - zm) * min(1.0, (d - 12.5) / 9.5)
def free_s(x, y, r, slack=0.0): return all(math.hypot(x - a, y - b) > r + rr - slack for a, b, rr in PLACED if rr < 20.0)      # ignores the big yard / stand / ship circles
def plain(i, m=4): return not any(BRIDGE(i + j) or TUNNEL(i + j) for j in range(-m, m + 1))
def spot(i, sg, d, r, slack=0.0):                         # a free ground point beside the road, or None
    i0 = i % N
    if blocked_zone(i0): return None
    if sg > 0 and QUAYSIDE(i0) and d + r > 15.3: return None
    q = P(i0, sg * d); p = Vector((q.x, q.y, gh(i0, sg, d)))
    if nearest(p.x, p.y)[1] < 9.4 + min(r, 1.0) * 0.2 or not free_s(p.x, p.y, r, slack): return None
    return p
def prism(c, r, h, mat, n=8, cap=True, taper=1.0):
    c = Vector(c); r0 = [c + Vector((r * math.cos(2 * math.pi * k / n), r * math.sin(2 * math.pi * k / n), 0)) for k in range(n)]
    r1 = [c + Vector((r * taper * math.cos(2 * math.pi * k / n), r * taper * math.sin(2 * math.pi * k / n), h)) for k in range(n)]
    for k in range(n):
        a = r0[k]; b = r0[(k + 1) % n]; a1 = r1[k]; b1 = r1[(k + 1) % n]; m = (a + b) / 2 - c; m.z = 0
        F([a, b, b1, a1], mat, None, None, m, 1.0, 3.0)
    if cap: F(r1, mat, None, None, UP, 1.0, 3.0)
def outline_extrude(pts, z0, z1, mat, cen=None):         # a plan outline (x, y) pulled up to a deck, for hulls
    cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
    for k in range(len(pts)):
        a = pts[k]; b = pts[(k + 1) % len(pts)]; m = Vector(((a[0] + b[0]) / 2 - cx, (a[1] + b[1]) / 2 - cy, 0))
        F([Vector((a[0], a[1], z0)), Vector((b[0], b[1], z0)), Vector((b[0], b[1], z1)), Vector((a[0], a[1], z1))], mat, None, None, m, 1.0, 3.0)
    F([Vector((p[0], p[1], z1)) for p in pts], mat, None, None, UP, 1.0, 3.0)
for i in range(4, N, 10):                                 # the street lamps stand here: keep clear
    if not TUNNEL(i):
        sg_ = 1 if (i // 10) % 2 == 0 else -1; q = P(i, sg_ * 10.3); occupy(q.x, q.y, 1.0)
for (a_, b_, r_) in ((-70, 213, 110), (150, 214, 44), (-255, 232, 28)): occupy(a_, b_, r_)

# --- lit chevron boards on the outside of every real bend, with a tyre wall behind
def chevron(i, sgo, s):                                   # s = +1 points to the viewer's right
    n = (-sgo * LFv(i)) * 0.92 + (-TGv(i)) * 0.39; n.normalize(); eu = RIGHT(n)
    b = P(i, sgo * 9.75); z0 = b.z; c = Vector((b.x, b.y, z0 + 1.65))
    obox(c, eu, n, UP, 1.15, 0.04, 0.95, 'metal', dens=1.0)
    for dx in (-0.8, 0.8): obox(Vector((b.x, b.y, z0 + 0.3)) + eu * dx, eu, n, UP, 0.05, 0.05, 0.45, 'metal', dens=1.0, bottom=False)
    for sy in (1, -1):
        F([c + n * 0.06 + eu * s * x + UP * sy * y for x, y in ((-0.7, 0.88), (-0.28, 0.88), (0.7, 0.0), (0.28, 0.0))], 'emissive_amber', None, None, n)
    RGL(c + n * 0.3, 'amber', 2.2); cnt_('chevron')
ap = []
for i in range(N):
    if abs(KAP[i]) < 1 / 200.0 or not plain(i, 6): continue
    if all(abs(KAP[(i + k) % N]) <= abs(KAP[i]) for k in range(-25, 26)) and all(abs(i - j) > 30 for j in ap): ap.append(i)
for i0_ in ap:
    sgo = -1 if KAP[i0_] > 0 else 1; s = 1 if KAP[i0_] < 0 else -1
    for i in range(i0_ - 12, i0_ + 13, 3):
        if abs(KAP[i % N]) > 1 / 280.0 and plain(i): chevron(i, sgo, s)
    for i in range(i0_ - 8, i0_ + 9, 1):
        if not plain(i): continue
        q = P(i, sgo * 11.4); zg = gh(i, sgo, 11.4)
        if sgo > 0 and QUAYSIDE(i) and False: continue
        bbox(q.x, q.y, zg - 0.1, PSI[i % N], 3.1, 1.7, 1.0, 'metal', dens=0.5, bottom=False); bbox(q.x, q.y, zg + 0.9, PSI[i % N], 3.1, 1.0, 0.45, 'metal', dens=0.5, bottom=False)
    cnt_('tyrewall')

# --- advertising boards along the barriers (outside, facing the road) and marshal posts
def ad_board(i, sg, k):
    n = -sg * LFv(i); eu = RIGHT(n); b = P(i, sg * 9.9); z0 = b.z; cn = SIGNS[k][1]
    c = Vector((b.x, b.y, z0 + 1.85)); obox(c, eu, n, UP, 2.55, 0.06, 0.7, 'metal', dens=0.5)
    quad_on(c + n * 0.07, eu, UP, 2.4, 0.58, n, 'sign', panel_uv(k))
    for dx in (-1.9, 1.9): obox(Vector((b.x, b.y, z0 + 0.75)) + eu * dx, eu, n, UP, 0.08, 0.08, 0.8, 'metal', dens=1.0, bottom=False)
    RGL(c + n * 0.3, cn, 4.8); cnt_('ad')
    if DET['ad'] % 2 == 0: LT(c + n * 1.8 + UP * 1.3, COL[cn], 450.0, 0.4)
kk = 0
for i in range(14, N, 17):
    sg = 1 if (kk % 2 == 0) else -1
    if blocked_zone(i) or not plain(i, 6) or abs(KAP[i]) > 1 / 280.0 or any(abs(i - j) < 14 for j in ap): kk += 1; continue
    if sg > 0 and QUAYSIDE(i) and False: continue
    ad_board(i, sg, (i // 17) % 8); kk += 1
def marshal_post(i, sg):
    p = spot(i, sg, 11.8, 2.2, 0.5)
    if p is None: return
    ex = TGv(i); ey = LFv(i); inward = -sg * ey
    obox(p + UP * 1.2, ex, ey, UP, 1.0, 1.0, 1.2, 'metal', dens=0.8, bottom=False)
    quad_on(p + inward * 1.02 + UP * 1.5, ex, UP, 0.7, 0.45, inward, 'emissive_wwarm')
    obox(p + UP * 2.55, ex, ey, UP, 1.2, 1.2, 0.08, 'roof', dens=0.3)
    obox(p + UP * 2.85, ex, ey, UP, 0.12, 0.12, 0.2, 'emissive_amber', dens=1.0); GLW(p + UP * 2.9, 'amber', 4.0)
    RGL(p + inward * 1.3 + UP * 1.5, 'wwarm', 1.4); LT(p + inward * 1.8 + UP * 1.4, COL['wwarm'], 160.0, 0.2); occupy(p.x, p.y, 2.2); cnt_('marshal')
for i in range(20, N, 52): marshal_post(i, 1 if (i // 52) % 2 else -1)

# --- gantries and pedestrian bridges over the road
def calm(i, k=3): return all(abs(KAP[(i + j) % N]) < 1 / 110.0 for j in range(-k, k + 1))
def zone_ok(i): return not blocked_zone(i) and plain(i, 12)
cl = [i for i in range(14, N - 6) if i % 10 in (8, 9, 0, 1) and zone_ok(i) and calm(i)]
log('gantry candidates:', len(cl))
used = [0]
def pick(frac, gap=30):
    best = None
    for i in cl:
        if any(abs(i - j) < gap for j in used): continue
        if all(free_s(P(i, sg * 10.8).x, P(i, sg * 10.8).y, 1.3, 0.0) for sg in (1, -1)):
            if best is None or abs(i - frac * N) < abs(best - frac * N): best = i
    if best is not None: used.append(best)
    return best
def road_gantry(i, k):
    y = C[i % N, 2]; ex = TGv(i); ey = LFv(i); back = -ex
    for sg in (1, -1):
        b = P(i, sg * 10.8); obox(Vector((b.x, b.y, (b.z - 0.4 + y + 7.9) / 2)), ex, ey, UP, 0.45, 0.45, (y + 7.9 - b.z + 0.4) / 2, 'metal', dens=1.5, bottom=False); occupy(b.x, b.y, 1.3)
    obox(PA(i, 0, y + 7.4), ex, ey, UP, 0.6, 11.3, 0.5, 'metal', dens=1.5, bottom=True)
    F([PA(i, -10.9, y + 6.88) + back * 0.62, PA(i, 10.9, y + 6.88) + back * 0.62, PA(i, 10.9, y + 7.0) + back * 0.62, PA(i, -10.9, y + 7.0) + back * 0.62], 'emissive_cyan', None, None, back)
    for q, dd in enumerate((-4.4, 4.4)):
        c = PA(i, dd, y + 9.1) + back * 0.1; kk_ = (k * 2 + q) % 8; cn = SIGNS[kk_][1]
        quad_on(c, RIGHT(back), UP, 3.9, 0.94, back, 'sign', panel_uv(kk_)); obox(c - back * 0.05, ex, ey, UP, 0.06, 4.1, 1.05, 'metal', dens=0.5)
        for dx in (-3.0, 0.0, 3.0): beam(PA(i, dd + dx, y + 7.9), PA(i, dd + dx, y + 8.2), 0.2, 'metal')
        LT(c + back * 2.2 + UP * 0.2, COL[cn], 650.0, 0.4); RGL(c + back * 0.3, cn, 8.0)
    for dd in (-6.5, -3.2, 0.0, 3.2, 6.5):
        p = PA(i, dd, y + 6.95) + back * 0.9; obox(p, ex, ey, UP, 0.12, 0.45, 0.07, 'emissive_wcool', dens=1.0); GLW(p, 'wcool', 5.0)
    RGL(PA(i, 0, y + 6.94) + back * 0.8, 'cyan', 21.0); cnt_('gantry')
def ped_bridge(i, k):
    y = C[i % N, 2]; ex = TGv(i); ey = LFv(i); back = -ex; zd = y + 7.5
    obox(PA(i, 0, zd), ex, ey, UP, 1.35, 12.4, 0.25, 'concrete', dens=0.5, bottom=True)
    for sg in (1, -1):
        p = PA(i, sg * 12.4, 0); zg = gh(i, sg, 12.4)
        obox(Vector((p.x, p.y, (zg - 0.4 + zd + 0.8) / 2)), ex, ey, UP, 1.5, 1.2, (zd + 0.8 - zg + 0.4) / 2, 'concrete', dens=0.4, bottom=False)
        for sx in (1, -1): quad_on(Vector((p.x, p.y, (zg + zd) / 2 - 0.2)) + ex * (sx * 1.52), ey, UP, 0.55, (zd - zg) / 2 - 0.6, ex * sx, 'emissive_wcool')
        RGL(Vector((p.x, p.y, zd - 1.5)) + back * 1.6, 'wcool', 1.2); occupy(p.x, p.y, 2.0)
    for sx in (1, -1):
        beam(PA(i, -12.4, zd + 1.1) + ex * sx * 1.25, PA(i, 12.4, zd + 1.1) + ex * sx * 1.25, 0.07, 'emissive_cyan' if sx > 0 else 'metal')
        beam(PA(i, -12.4, zd + 0.55) + ex * sx * 1.25, PA(i, 12.4, zd + 0.55) + ex * sx * 1.25, 0.05, 'metal')
    kk_ = (k + 3) % 8; c = PA(i, 0, zd + 0.65) + back * 1.4
    quad_on(c, RIGHT(back), UP, 5.5, 0.62, back, 'sign', panel_uv(kk_)); cn = SIGNS[kk_][1]
    LT(c + back * 2.0 + UP * 0.2, COL[cn], 600.0, 0.4); RGL(c + back * 0.3, cn, 11.0)
    LT(PA(i, 0, zd - 1.0), COL['cyan'], 700.0, 0.4)
    for dd in (-9.0, 0.0, 9.0): RGL(PA(i, dd, zd + 1.1) + ex * 1.25, 'cyan', 4.0)
    cnt_('pedbridge')
for q, fr in enumerate((0.04, 0.12, 0.36, 0.52, 0.78, 0.86, 0.97)):
    i = pick(fr)
    if i is not None: road_gantry(i, q)
used_g = list(used)
for q, fr in enumerate((0.19, 0.46, 0.75, 0.92)):
    i = pick(fr, 14)
    if i is not None: ped_bridge(i, q)

# --- pavement furniture: shelters, benches, bins, traffic lights, street signs
for i in range(3, N, 3):
    zn = zone(i / N)
    if zn not in CITYZ or blocked_zone(i) or not plain(i, 4): continue
    sg = 1 if R2.random() < 0.5 else -1; r = R2.random(); ex = TGv(i); ey = LFv(i); outward = sg * ey; inward = -outward
    if r < 0.14:
        p = spot(i, sg, 11.1, 2.2, 0.4)
        if p is None: continue
        obox(p + UP * 2.55, ex, ey, UP, 1.7, 0.85, 0.07, 'metal', dens=0.4)
        for sx in (-1, 1): obox(p + ex * (sx * 1.6) + outward * 0.75 + UP * 1.25, ex, ey, UP, 0.05, 0.05, 1.3, 'metal', dens=1.0, bottom=False)
        cn = R2.choice(('wcool', 'wcool', 'wwarm', 'magenta', 'cyan'))
        quad_on(p + outward * 0.78 + UP * 1.4, ex, UP, 1.45, 0.9, inward, 'emissive_' + cn); obox(p + outward * 0.3 + UP * 0.45, ex, ey, UP, 1.2, 0.2, 0.04, 'metal', dens=0.5)
        LT(p + UP * 2.3, COL[cn], 260.0, 0.3); RGL(p + inward * 0.2 + UP * 1.4, cn, 2.9); occupy(p.x, p.y, 2.2); cnt_('shelter')
    elif r < 0.30:
        p = spot(i, sg, 10.8, 1.1, 0.3)
        if p is None: continue
        obox(p + UP * 0.45, ex, ey, UP, 0.9, 0.24, 0.04, 'metal', dens=0.6); obox(p + outward * 0.22 + UP * 0.8, ex, ey, UP, 0.9, 0.03, 0.24, 'metal', dens=0.6)
        for sx in (-1, 1): obox(p + ex * (sx * 0.75) + UP * 0.22, ex, ey, UP, 0.05, 0.2, 0.22, 'metal', dens=1.0, bottom=False)
        occupy(p.x, p.y, 1.1); cnt_('bench')
    elif r < 0.46:
        p = spot(i, sg, 10.5, 0.6, 0.2)
        if p is None: continue
        obox(p + UP * 0.5, ex, ey, UP, 0.24, 0.24, 0.5, 'metal', dens=1.0, bottom=False); obox(p + UP * 1.04, ex, ey, UP, 0.28, 0.28, 0.05, 'metal', dens=1.0); occupy(p.x, p.y, 0.6); cnt_('bin')
    elif r < 0.64:
        p = spot(i, sg, 9.75, 0.5, 0.4)
        if p is None: continue
        obox(p + UP * 2.3, ex, ey, UP, 0.07, 0.07, 2.4, 'metal', dens=1.0, bottom=False)
        hc = p + UP * 4.0 + inward * 0.1; obox(hc, ex, ey, UP, 0.16, 0.17, 0.5, 'metal', dens=1.0)
        cn = 'red' if R2.random() < 0.5 else 'green'; lp = hc - ex * 0.19 + UP * (0.33 if cn == 'red' else -0.33)
        quad_on(lp, ey, UP, 0.1, 0.1, -ex, 'emissive_' + cn); GLW(lp - ex * 0.2, cn, 3.5); LT(lp - ex * 1.0, COL[cn], 90.0, 0.1); occupy(p.x, p.y, 0.5); cnt_('signal')
    else:
        p = spot(i, sg, 9.85, 0.5, 0.4)
        if p is None: continue
        obox(p + UP * 1.5, ex, ey, UP, 0.05, 0.05, 1.5, 'metal', dens=1.0, bottom=False)
        obox(p + UP * 3.0 + inward * 0.1, ex, ey, UP, 0.55, 0.04, 0.2, 'metal', dens=1.0)
        quad_on(p + UP * 3.0 + inward * 0.1 - ex * 0.56, ey, UP, 0.12, 0.15, -ex, 'emissive_green'); quad_on(p + UP * 3.0 + inward * 0.1 + ex * 0.56, ey, UP, 0.12, 0.15, ex, 'emissive_green')
        RGL(p + UP * 3.0 + inward * 0.1 - ex * 0.6, 'green', 0.9); occupy(p.x, p.y, 0.5); cnt_('streetsign')

# --- shop awnings, hanging vertical neon, rooftop clutter and billboards (from the buildings' fronts)
def tank(c, r=1.2):
    for dx, dy in ((-0.6, -0.6), (0.6, -0.6), (0.6, 0.6), (-0.6, 0.6)): beam(c + Vector((dx * r, dy * r, 0)), c + Vector((dx * r, dy * r, 1.6)), 0.12, 'metal')
    prism(c + UP * 1.6, r, 2.0, 'metal', 8, True); prism(c + UP * 3.6, r, 0.7, 'roof', 8, True, 0.15)
for fr in FRONTS:
    A, B, eu, n, zg, roofz, nk, hw, c, ex, ey, w, dep = (fr[k] for k in ('A', 'B', 'eu', 'n', 'zg', 'roofz', 'nk', 'hw', 'c', 'ex', 'ey', 'w', 'dep'))
    zn = zone(fr['ci'] / N)
    for k in range(nk):
        if R2.random() < 0.55:
            w0 = A + eu * (3 * k + 1.5) + n * 0.05 + UP * (zg + 3.4); mat = R2.choice(('roof', 'roof', 'fac_a', 'fac_b'))
            a_ = w0 - eu * 1.3; b_ = w0 + eu * 1.3; d_ = a_ + n * 1.4 - UP * 0.75; c_ = b_ + n * 1.4 - UP * 0.75
            F([a_, b_, c_, d_], mat, None, None, n + UP, 1.0, 3.0); F([d_, c_, b_, a_], mat, None, None, -n - UP, 1.0, 3.0); cnt_('awning')
    if R2.random() < 0.4:                                 # a hanging vertical neon sign at one end of the front
        cn = R2.choice(('magenta', 'cyan', 'amber', 'green', 'red')); side = R2.choice((1.6, 2 * hw - 1.6)); q = A + eu * side + n * 1.1; z0 = zg + 3.4; z1 = z0 + 3.6
        beam(A + eu * side + n * 0.05 + UP * (z0 + 1.0), q + UP * (z0 + 1.0), 0.07, 'metal')
        for sgn in (1, -1): F([q + UP * z0 - eu * 0.17, q + UP * z0 + eu * 0.17, q + UP * z1 + eu * 0.17, q + UP * z1 - eu * 0.17], 'emissive_' + cn, None, None, eu * sgn)
        RGL(q + UP * (z0 + 1.8) + n * 0.4, cn, 0.5); cnt_('vneon')
        if R2.random() < 0.3: LT(q + UP * (z0 + 1.8) + n * 1.2, COL[cn], 320.0, 0.3)
    if fr['H'] > 12 and R2.random() < 0.55 and w > 12:    # rooftop: tank, aircon units, mast, billboard
        m = lambda u, v: c + ex * u + ey * v
        for _t in range(R2.randrange(1, 3)):
            u = R2.uniform(-w / 2 + 3, w / 2 - 3); v = R2.uniform(-dep / 2 + 3, dep / 2 - 3)
            if R2.random() < 0.55 and zn != 'downtown': tank(Vector((m(u, v).x, m(u, v).y, roofz)), R2.uniform(1.0, 1.5)); cnt_('tank')
            else:
                for q in range(R2.randrange(2, 5)):
                    pu = m(u + q * 1.9, v); obox(Vector((pu.x, pu.y, roofz + 0.55)), ex, ey, UP, 0.8, 0.6, 0.55, 'metal', dens=0.3, bottom=False); obox(Vector((pu.x, pu.y, roofz + 1.15)), ex, ey, UP, 0.5, 0.4, 0.07, 'metal', dens=0.3)
                cnt_('ac')
    if fr['H'] > 12 and R2.random() < 0.3:
        u = R2.uniform(-w / 4, w / 4); v = R2.uniform(-dep / 4, dep / 4); b0 = m(u, v) if False else c + ex * u + ey * v; hgt = R2.uniform(6, 11)
        beam(Vector((b0.x, b0.y, roofz)), Vector((b0.x, b0.y, roofz + hgt)), 0.1, 'metal'); beam(Vector((b0.x, b0.y, roofz + hgt * 0.6)), Vector((b0.x, b0.y, roofz + hgt * 0.6)) + ex * 1.2, 0.05, 'metal')
        p = Vector((b0.x, b0.y, roofz + hgt + 0.25)); obox(p, ex, ey, UP, 0.22, 0.22, 0.22, 'emissive_red', dens=1.0); GLW(p, 'red', 6.0); cnt_('mast')
    if zn in ('avenue', 'downtown', 'oldtown', 'terminal') and fr['H'] > 14 and 2 * hw > 12 and R2.random() < 0.38:
        fc = (A + B) / 2 - n * 2.6 + UP * (roofz + 2.4); kk_ = R2.randrange(8); cn = SIGNS[kk_][1]; bw = min(hw * 0.7, 7.0); bh = bw / 4.15
        quad_on(fc + n * 0.2, RIGHT(n), UP, bw, bh, n, 'sign', panel_uv(kk_)); obox(fc, RIGHT(n), n, UP, bw + 0.15, 0.1, bh + 0.15, 'metal', dens=0.3)
        for sgn in (-1, 1): beam(fc + RIGHT(n) * (sgn * bw * 0.6) - UP * (bh + 0.1), fc + RIGHT(n) * (sgn * bw * 0.6) - UP * (bh + 2.6), 0.18, 'metal')
        for sgn in (-1, 1): obox(fc + RIGHT(n) * (sgn * bw * 0.5) + n * 1.2 + UP * (bh + 0.5), RIGHT(n), n, UP, 0.25, 0.12, 0.1, 'emissive_wcool', dens=1.0)
        LT(fc + n * 3.2, COL[cn], 800.0, 0.5); RGL(fc + n * 0.4, cn, bw * 2); cnt_('roofboard')

# --- parked cars and vans behind the barriers, more street trees with lights
def car(p, i, van=False, lit=False):
    ex = TGv(i); ey = LFv(i); q = R2.randrange(4)
    if van:
        container(p + UP * 1.1, ex, ey, UP, q, 2.5, 0.95, 0.8); obox(p + ex * 1.9 + UP * 1.0, ex, ey, UP, 0.6, 0.9, 0.5, 'metal', dens=0.5, bottom=False); top = 1.9; rear = 2.52
    else:
        container(p + UP * 0.65, ex, ey, UP, q, 2.15, 0.9, 0.36); obox(p - ex * 0.15 + UP * 1.18, ex, ey, UP, 1.15, 0.76, 0.27, 'metal', dens=0.5, bottom=False); top = 1.4; rear = 2.17
    if lit:
        for sy in (-0.6, 0.6): quad_on(p - ex * rear + ey * sy + UP * (0.8 if not van else 1.0), ey, UP, 0.2, 0.09, -ex, 'emissive_red')
        RGL(p - ex * (rear + 0.3) + UP * 0.8, 'red', 1.5)
for i in range(1, N, 4):
    zn = zone(i / N)
    if zn not in CITYZ or blocked_zone(i) or not plain(i, 4) or R2.random() < 0.35: continue
    sg = 1 if R2.random() < 0.5 else -1; d = R2.uniform(10.9, 11.6) if not (sg > 0 and QUAYSIDE(i)) else R2.uniform(11.3, 12.8)
    van = R2.random() < 0.22; p = spot(i, sg, d, 2.1 if not van else 2.8, 0.7)
    if p is None: continue
    car(p, i, van, R2.random() < 0.4); occupy(p.x, p.y, 2.1 if not van else 2.8); cnt_('car')
tc = 1000
for i in range(0, N, 10):
    if zone(i / N) not in ('harbor', 'terminal') or blocked_zone(i): continue
    for sg in (1, -1):
        ii = i + (3 if sg > 0 else 8)
        if sg > 0 and QUAYSIDE(ii): continue
        q = P(ii, sg * 11.9); g = GC(ii); p = Vector((q.x, q.y, g - 0.1))
        if not free_s(p.x, p.y, 1.5, 0.5) or nearest(p.x, p.y)[1] < 10.5: continue
        make_tree(p, g - 0.1, zdir(P(ii, 0), p), 0.7, tc, 1.5); tc += 1; cnt_('tree')

# --- more containers on the inland harbour land, a stack row, a rail viaduct with a lit stopped train
containers_block(556, N + 4, [-24.0, -26.7, -29.4, -40.0, -42.7, -45.4]); _c = P(572, -33.0); occupy(_c.x, _c.y, 40)
def viaduct(i0, i1, d, zdeck):
    z = lambda i: C[i % N, 2] + zdeck
    ribbon(i0, i1, lambda i: [PA(i, d - 3.3, z(i)), PA(i, d + 3.3, z(i))], 'concrete', UP, tile=(3, 3), dens=0.3)
    ribbon(i0, i1, lambda i: [PA(i, d - 3.3, z(i) - 1.3), PA(i, d + 3.3, z(i) - 1.3)], 'concrete', -UP, tile=(3, 3), dens=0.3)
    for sg in (1, -1):
        ribbon(i0, i1, lambda i, sg=sg: [PA(i, d + sg * 3.3, z(i) - 1.3), PA(i, d + sg * 3.3, z(i))], 'concrete', lambda i, sg=sg: LFv(i) * sg, tile=(3, 3), dens=0.3)
        ribbon(i0, i1, lambda i, sg=sg: [PA(i, d + sg * 3.0, z(i) + 0.9), PA(i, d + sg * 3.0, z(i))], 'concrete', lambda i, sg=sg: -LFv(i) * sg, tile=(3, 3), dens=0.3)
    for i in range(i0 + 2, i1, 6):
        q = P(i, d); zg = ground_z(q.x, q.y) - 0.6
        bbox(q.x, q.y, zg, PSI[i % N], 2.0, 3.6, z(i) - 1.3 - zg, 'concrete', dens=0.3, top=False, bottom=False); bbox(q.x, q.y, z(i) - 2.4, PSI[i % N], 2.8, 5.8, 1.1, 'concrete', dens=0.3, top=False, bottom=False)
def train(sv0, d, zdeck, ncar=4, L=8.0):
    for k in range(ncar):
        sv = sv0 + k * (2 * L + 1.2) / STEP; i = int(sv); q = Pf(sv, d); ex = TGv(i); ey = LFv(i); zb = C[i % N, 2] + zdeck + 0.35
        ctr = Vector((q.x, q.y, zb + 1.7)); obox(ctr, ex, ey, UP, L, 1.5, 1.7, 'metal', dens=0.3, bottom=False)
        obox(ctr + UP * 1.75, ex, ey, UP, L - 0.3, 1.2, 0.08, 'roof', dens=0.3)
        for sgn in (1, -1):
            for t in range(-3, 4):
                if (k == 0 and t == -3 and sgn < 0) and False: continue
                c2 = ctr + ex * (t * 2.1) + ey * (sgn * 1.51) + UP * 0.5
                quad_on(c2, ex, UP, 0.8, 0.5, ey * sgn, 'emissive_wwarm' if (t + k) % 5 else 'emissive_wcool')
        for sgn in (1, -1):
            RGL(ctr + ey * (sgn * 1.8) + UP * 0.5, 'wwarm', 2 * L - 1.0)
        LT(ctr + ey * 3.2 - UP * 0.4, COL['wwarm'], 1500.0, 0.6)
        if k == 0: p_ = ctr + ex * (L + 0.05); quad_on(p_ + ey * 0.8 + UP * 0.2, ey, UP, 0.3, 0.2, ex, 'emissive_wcool'); quad_on(p_ - ey * 0.8 + UP * 0.2, ey, UP, 0.3, 0.2, ex, 'emissive_wcool'); GLW(p_ + UP * 0.2, 'wcool', 6.0)
        if k == ncar - 1: p_ = ctr - ex * (L + 0.05); quad_on(p_ + ey * 0.8 + UP * 0.2, ey, UP, 0.3, 0.2, -ex, 'emissive_red'); quad_on(p_ - ey * 0.8 + UP * 0.2, ey, UP, 0.3, 0.2, -ex, 'emissive_red'); GLW(p_ + UP * 0.2, 'red', 6.0)
if True:
    viaduct(556, N + 6, -34.0, 8.5); train(566.0, -34.0, 8.5); cnt_('viaduct')
    occupy(P(572, -34.0).x, P(572, -34.0).y, 50)

# --- the ferris wheel on a pier, a lighthouse on a rock, a breakwater, boats, buoys
def ferris(cx, cy, R=22.0):
    zc = 2.0 + R + 3.0; ex = Vector((1, 0, 0)); ey = Vector((0, 1, 0))
    bbox(cx, cy, -1.2, 0.0, 66, 40, 3.1, 'concrete', dens=0.1, bottom=False)
    for yy in (-2.2, 2.2):
        for sx in (-1, 1): beam(Vector((cx + sx * 13.0, cy + yy * 3.0, 1.9)), Vector((cx, cy + yy, zc)), 0.55, 'metal')
    beam(Vector((cx, cy - 3.2, zc)), Vector((cx, cy + 3.2, zc)), 1.0, 'metal')
    segs = 28
    for rr, mat in ((R, 'emissive_cyan'), (R - 3.0, 'emissive_magenta')):
        for k in range(segs):
            a0 = 2 * math.pi * k / segs; a1 = 2 * math.pi * (k + 1) / segs
            for yy in (-1.6, 1.6): beam(Vector((cx + rr * math.cos(a0), cy + yy, zc + rr * math.sin(a0))), Vector((cx + rr * math.cos(a1), cy + yy, zc + rr * math.sin(a1))), 0.28, mat)
    for k in range(14):
        a = 2 * math.pi * k / 14
        for yy in (-1.6, 1.6): beam(Vector((cx, cy + yy, zc)), Vector((cx + R * math.cos(a), cy + yy, zc + R * math.sin(a))), 0.1, 'metal')
    cols = ('magenta', 'amber', 'cyan', 'green')
    for k in range(28):
        a = 2 * math.pi * (k + 0.5) / 28; q = Vector((cx + R * math.cos(a), cy, zc + R * math.sin(a) - 1.0))
        obox(q, ex, ey, UP, 0.75, 1.3, 0.55, 'emissive_' + cols[k % 4], dens=1.0)
    for k in range(0, 28, 2):
        a = 2 * math.pi * (k + 0.5) / 28; RGL(Vector((cx + R * math.cos(a), cy - 2.0, zc + R * math.sin(a) - 1.0)), cols[k % 4], 1.6)
    for k in range(0, 28, 4):
        a = 2 * math.pi * k / 28; RGL(Vector((cx + R * math.cos(a), cy - 2.0, zc + R * math.sin(a))), 'cyan', 1.2)
    for a in (0.0, math.pi / 2, math.pi, 1.5 * math.pi): LT(Vector((cx + (R - 1.5) * math.cos(a), cy - 5.0, zc + (R - 1.5) * math.sin(a))), COL[cols[int(a / 1.57) % 4]], 3500.0, 0.6)
    LT(Vector((cx, cy - 6.0, zc)), COL['cyan'], 6000.0, 0.8); GLW(Vector((cx, cy - 1.8, zc)), 'cyan', 9.0)
    RGL(Vector((cx, cy - 2.0, zc)), 'magenta', 8.0)
    for sx in (-14, -7, 0, 7, 14): RGL(Vector((cx + sx, cy - 20.5, 2.3)), 'wcool', 1.0); obox(Vector((cx + sx, cy - 19.8, 1.25)), ex, ey, UP, 0.18, 0.18, 0.35, 'emissive_wcool', dens=1.0)
    cnt_('wheel')
ferris(150.0, 214.0)
def lighthouse(cx, cy):
    bbox(cx, cy, -1.2, 0.0, 34, 22, 2.5, 'concrete', dens=0.1, bottom=False)
    prism(Vector((cx, cy, 1.3)), 3.6, 24.0, 'fac_a', 8, False, 0.62); prism(Vector((cx, cy, 25.3)), 3.3, 0.5, 'concrete', 8, True)
    bbox(cx, cy, 25.8, 0.0, 3.4, 3.4, 3.0, 'emissive_wwarm', dens=1.0, top=False, bottom=False)
    prism(Vector((cx, cy, 28.8)), 2.6, 2.2, 'roof', 8, True, 0.1)
    ex = Vector((1, 0, 0)); ey = Vector((0, 1, 0)); obox(Vector((cx, cy, 31.1)), ex, ey, UP, 0.2, 0.2, 0.2, 'emissive_red', dens=1.0)
    LT(Vector((cx, cy - 4.0, 27.3)), COL['wwarm'], 9000.0, 0.8); GLW(Vector((cx, cy, 27.3)), 'wwarm', 16.0); GLW(Vector((cx, cy, 31.2)), 'red', 6.0); RGL(Vector((cx, cy - 2.0, 27.3)), 'wwarm', 3.4)
    outline_extrude([(cx + 16, cy - 3), (cx + 62, cy - 4), (cx + 62, cy + 4), (cx + 16, cy + 3)], -1.2, 1.0, 'concrete')
    for t_ in (-1.0, 1.0):
        obox(Vector((cx + 62, cy + t_ * 3.0, 1.25)), ex, ey, UP, 0.2, 0.2, 0.25, 'emissive_red' if t_ < 0 else 'emissive_green', dens=1.0)
    GLW(Vector((cx + 62, cy - 3.0, 1.6)), 'red', 4.0); GLW(Vector((cx + 62, cy + 3.0, 1.6)), 'green', 4.0); cnt_('lighthouse')
lighthouse(-255.0, 232.0)
CRANE_X = [(P(ii, 0).x, P(ii, 0).y) for ii in (8, 24, 43, 62, 80, 98)]
def water_ok(x, y, r):
    if any(abs(x - cx_) < r + 12 and 176 < y < 236 + r for cx_, cy_ in CRANE_X): return False
    return free(x, y, r, 0.0)
def boat(x, y, yaw, L, kind):
    ex, ey, _ = yaw_axes(yaw); W = L * 0.28; zt = 0.55
    ln = lambda a, b: (x + ex.x * a + ey.x * b, y + ex.y * a + ey.y * b)
    outline_extrude([ln(-L / 2, -W / 2), ln(L * 0.18, -W / 2), ln(L / 2, 0), ln(L * 0.18, W / 2), ln(-L / 2, W / 2)], -0.9, zt, 'metal')
    cabn = Vector((x, y, zt)) - ex * L * 0.1
    obox(cabn + UP * 0.8, ex, ey, UP, L * 0.2, W * 0.36, 0.8, 'concrete', dens=0.5, bottom=False)
    for sgn in (1, -1): quad_on(cabn + ey * (sgn * (W * 0.36 + 0.02)) + UP * 0.95, ex, UP, L * 0.15, 0.3, ey * sgn, 'emissive_wwarm')
    quad_on(cabn + ex * (L * 0.2 + 0.02) + UP * 0.95, ey, UP, W * 0.25, 0.3, ex, 'emissive_wwarm')
    beam(cabn + UP * 1.6, cabn + UP * (3.6 if kind else 2.6), 0.08, 'metal')
    top = cabn + UP * (3.7 if kind else 2.7); obox(top, ex, ey, UP, 0.12, 0.12, 0.12, 'emissive_wcool', dens=1.0); GLW(top, 'wcool', 4.0)
    for sgn, nm in ((1, 'green'), (-1, 'red')): GLW(Vector((x, y, zt + 0.5)) + ex * (L * 0.15) + ey * (sgn * W * 0.45), nm, 3.0)
    RGL(cabn + ey * (W * 0.5) + UP * 1.0, 'wwarm', L * 0.3); LT(cabn + UP * 2.5, COL['wwarm'], 120.0 + L * 20, 0.3); cnt_('boat')
bt = 0; tries = 0; MB = []
while bt < 5 and tries < 300:                             # moored along the quay
    tries += 1; x = R2.uniform(-205, 140); y = R2.uniform(192.0, 195.0); L = R2.uniform(7, 13)
    if any(abs(x - cx_) < L * 0.5 + 14 for cx_, cy_ in CRANE_X) or any(abs(x - bx_) < 22 for bx_ in MB) or abs(x - 150) < 40: continue
    boat(x, y, R2.uniform(-0.25, 0.25), L, bt % 2); MB.append(x); bt += 1
tries = 0
while bt < 16 and tries < 400:
    tries += 1; x = R2.uniform(-320, 300); y = R2.uniform(204, 285); L = R2.uniform(7, 15)
    if not water_ok(x, y, L * 0.6) or (x > 170 and y < 215): continue
    boat(x, y, R2.uniform(0, 6.28), L, bt % 2); occupy(x, y, L * 0.6); bt += 1
for k in range(16):                                       # lit buoys
    x = R2.uniform(-330, 320); y = R2.uniform(190, 290)
    if not water_ok(x, y, 3.0) or (x > 170 and y < 215): continue
    cn = ('red', 'green', 'amber')[k % 3]; ex = Vector((1, 0, 0)); ey = Vector((0, 1, 0))
    obox(Vector((x, y, 0.1)), ex, ey, UP, 0.5, 0.5, 0.45, 'metal', dens=1.0, bottom=False); obox(Vector((x, y, 0.95)), ex, ey, UP, 0.22, 0.22, 0.4, 'emissive_' + cn, dens=1.0)
    GLW(Vector((x, y, 1.0)), cn, 4.5); occupy(x, y, 3.0); cnt_('buoy')

# --- a taller, more varied skyline all round, and far ships on the north water
def far_tower(x, y, w, h, nlight):
    zg = ground_z(x, y); yaw = R2.uniform(0, 1.5); ex, ey, _ = yaw_axes(yaw)
    bbox(x, y, zg - 1.5, yaw, w, w * R2.uniform(0.8, 1.3), h, 'tower', dens=0.1); zg = zg - 1.5
    if nlight == 1: beam(Vector((x, y, zg + h)), Vector((x, y, zg + h + 14)), 0.4, 'metal'); q = Vector((x, y, zg + h + 14.3)); obox(q, ex, ey, UP, 0.4, 0.4, 0.4, 'emissive_red', dens=1.0); GLW(q, 'red', 10.0)
    elif nlight == 2: q = Vector((x, y, zg + h + 0.6)); obox(q, ex, ey, UP, w * 0.35, w * 0.35, 0.4, 'emissive_' + R2.choice(('cyan', 'magenta', 'amber')), dens=1.0)
    else: q = Vector((x, y, zg + h + 0.4)); obox(q, ex, ey, UP, 0.3, 0.3, 0.3, 'emissive_red', dens=1.0); GLW(q, 'red', 8.0)
    occupy(x, y, w)
ft = 0; tries = 0
while ft < 22 and tries < 400:
    tries += 1; x = R2.uniform(-325, 322); y = R2.uniform(-250, 172); w = R2.uniform(10, 22)
    dm = nearest(x, y)[1]
    if dm < 70 or not free(x, y, w, 0.0): continue
    far_tower(x, y, w, R2.uniform(70, 175), 1 + ft % 3); ft += 1; cnt_('fartower')
    if dm < 160: RGL(Vector((x, y, 40.0)), 'wcool', w * 1.2)
for k, (x, y, L) in enumerate(((-220, 276, 130), (60, 282, 150), (245, 274, 110))):
    ex = Vector((1, 0, 0)); ey = Vector((0, 1, 0))
    outline_extrude([(x - L / 2, y - 9), (x + L / 2 - 14, y - 9), (x + L / 2, y), (x + L / 2 - 14, y + 9), (x - L / 2, y + 9)], -0.9, 6.0, 'metal')
    for q in range(8): container(Vector((x - L / 2 + 8 + q * 12.5, y, 7.3)), ex, ey, UP, R2.randrange(4), 6.0, 1.2, 1.3)
    bbox(x - L / 2 + 8, y, 6.0, 0.0, 14, 16, 14, 'tower', dens=0.2, top=True); q = Vector((x - L / 2 + 8, y, 20.4)); obox(q, ex, ey, UP, 0.3, 0.3, 0.3, 'emissive_red', dens=1.0); GLW(q, 'red', 8.0)
    for q in range(0, 9): RGL(Vector((x - L / 2 + 10 + q * 12.0, y - 9.4, 6.4)), 'wcool', 0.7)
    cnt_('farship')

# --- inside the tunnel: light strips along both walls, light rings round the tube
for sg in (1, -1):
    ribbon(IT0 + 1, IT1 - 1, lambda i, sg=sg: [P(i, sg * 9.08, 1.45), P(i, sg * 9.08, 1.62)], 'emissive_amber', lambda i, sg=sg: -LFv(i) * sg)
    for i in range(IT0 + 3, IT1 - 2, 6): RGL(P(i, sg * 9.0, 1.55), 'amber', 6.0)
def ring_sec(i):
    pts = tube_sec(i); cen = PA(i, 0, C[i % N, 2] + 3.0); return [p + (cen - p).normalized() * 0.05 for p in pts[1:5]]
for i in range(IT0 + 6, IT1 - 4, 8):
    ribbon(i, i + 1, ring_sec, 'emissive_cyan', None, hintp=lambda i, p: PA(i, 0, C[i % N, 2] + 3.0) - p)
    RGL(PA(i, 0, C[i % N, 2] + 7.5), 'cyan', 12.0)
log('details:', DET)
log('city:', NFACE[0], 'faces,', len(LIGHTS), 'lights,', len(GLOWS), 'glows')

# ---------------------------------------------------------------- the ground away from the road (a heightfield from the ground heights), water, the base plane, a skyline all round
X0, X1, Y0, Y1 = -346.0, 338.0, -266.0, 296.0
def heightfield(cell=10.0):
    xs = np.arange(X0, X1 + 0.1, cell); ys = np.arange(Y0, 190.0, cell); nx, ny = len(xs), len(ys)
    Z = np.zeros((ny, nx)); DM = np.zeros((ny, nx)); DB = np.full((ny, nx), 1e9); PK = np.zeros((ny, nx), bool)
    br = np.arange(IB0 - 8, IB1 + 8) % N; bpts = C[br, :2]
    for r, y in enumerate(ys):
        d2 = (CSXY[None, :, 0] - xs[:, None]) ** 2 + (CSXY[None, :, 1] - y) ** 2
        DM[r] = np.sqrt(d2.min(1)); w = 1.0 / (d2[:, ::2] + 120.0) ** 1.5; Z[r] = (w * GCS[None, :]).sum(1) / w.sum(1)
        db = (bpts[None, :, 0] - xs[:, None]) ** 2 + (bpts[None, :, 1] - y) ** 2; DB[r] = np.sqrt(db.min(1))
        nn = d2.argmin(1); PK[r] = [zone(k / N) == 'park' for k in nn]
    n = 0
    for r in range(ny - 1):
        for c in range(nx - 1):
            blk = (DM[r:r + 2, c:c + 2].min() < 21.0) or (DB[r:r + 2, c:c + 2].min() < 52.0)
            if blk or ys[r + 1] > 184: continue
            v = lambda rr, cc: Vector((xs[cc], ys[rr], Z[rr, cc] - 0.5))
            F([v(r, c), v(r, c + 1), v(r + 1, c + 1), v(r + 1, c)], 'grass' if PK[r:r + 2, c:c + 2].all() else 'pave', None, None, UP, 0.1, 6.0); n += 1
    log('heightfield cells:', n)
heightfield()
F([Vector((X0, Y0, -1.3)), Vector((X1, Y0, -1.3)), Vector((X1, Y1, -1.3)), Vector((X0, Y1, -1.3))], 'pave', None, None, UP, 0.02, 12.0)
F([Vector((X0, 183.0, -0.3)), Vector((X1, 183.0, -0.3)), Vector((X1, Y1, -0.3)), Vector((X0, Y1, -0.3))], 'water', None, None, UP, 0.05, 24.0)
ribbon(IB0 - 8, IB1 + 8, lambda i: [PA(i, -50.0, -0.3), PA(i, 50.0, -0.3)], 'water', UP, tile=(24, 24), dens=0.05, chunk=24)
for (a, b, n, ln) in (((X0, Y1), (X1, Y1), (0, -1), X1 - X0), ((X1, Y1), (X1, Y0), (-1, 0), Y1 - Y0), ((X1, Y0), (X0, Y0), (0, 1), X1 - X0), ((X0, Y0), (X0, Y1), (1, 0), Y1 - Y0)):
    rep = ln / 240.0
    F([Vector((a[0], a[1], -1.0)), Vector((b[0], b[1], -1.0)), Vector((b[0], b[1], 69.0)), Vector((a[0], a[1], 69.0))], 'sky', [(0, 0), (rep, 0), (rep, 1), (0, 1)], None, Vector((n[0], n[1], 0)), 0.01)
log('geometry done:', NFACE[0], 'faces')

# ---------------------------------------------------------------- build the object, weld, light-picture patches
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
BLOCKS = {}
for k, zv in (('A', -1.4), ('B', -1.45)):
    f = F([Vector((0, 0, zv)), Vector((6, 0, zv)), Vector((6, 6, zv)), Vector((0, 6, zv))], 'concrete', None, [(0, 0), (8, 0), (8, 8), (0, 8)], -UP, 1.0)
me = bpy.data.meshes.new('quay'); bm.to_mesh(me); bm.free()
for m in mats: me.materials.append(m)
mc = bpy.data.collections.new('map'); scene.collection.children.link(mc)
ob = bpy.data.objects.new('quay', me); mc.objects.link(ob)
me.calc_loop_triangles(); NTRI = len(me.loop_triangles); log('quay mesh:', NTRI, 'triangles,', len(me.vertices), 'verts,', len(me.polygons), 'faces')
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
    gcol = wS[..., None] * v3(1.0, 0.38, 0.14) + wW[..., None] * v3(0.9, 0.18, 0.6) * 0.7 + wE[..., None] * v3(0.2, 0.55, 0.95) * 0.6 + wN[..., None] * v3(0.1, 0.35, 0.55) * 0.5 + 0.12
    zp = np.clip(Z, 0, 1); glow = np.exp(-zp / 0.05) * 0.9 + np.exp(-zp / 0.22) * 0.25; glow = np.where(Z > -0.05, glow, 0.0)
    sky = sky + gcol * glow[..., None] * 0.13
    cl = np.clip((tn(H, W, 14, 30, 7) * 0.6 + tn(H, W, 30, 70, 8) * 0.4 - 0.52) * 3.5, 0, 1) * np.clip((Z - 0.02) / 0.1, 0, 1) * np.clip((0.62 - Z) / 0.3, 0, 1)
    lit = np.exp(-zp / 0.30)[..., None] * gcol * 0.5 + v3(0.05, 0.07, 0.11)
    sky = sky * (1 - 0.4 * cl[..., None]) + cl[..., None] * lit * 0.35
    path = os.path.join(TEXDIR, 'quay_night_sky.exr'); old = bpy.data.images.get('quay_night_sky')
    if old: bpy.data.images.remove(old)
    im = bpy.data.images.new('quay_night_sky', W, H, alpha=False, float_buffer=True); im.pixels.foreach_set(np.concatenate([sky.astype(np.float32), np.ones((H, W, 1), np.float32)], 2).ravel())
    ash_paint.save_exr_linear(im, path); bpy.data.images.remove(im); im = bpy.data.images.load(path); im.name = 'quay_night_sky'
    w = bpy.data.worlds.new('quay_sky'); scene.world = w; w.use_nodes = True; nt = w.node_tree
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
    img = bpy.data.images.new('quay_light', LMSIZE, LMSIZE, alpha=False, float_buffer=True)
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
    path = os.path.join(TEXDIR, 'quay_light.exr'); ash_paint.save_exr_linear(img, path)
    for m in me.materials:
        n = m.node_tree.nodes.get('hg_bake')
        if n: m.node_tree.nodes.remove(n)
    me.uv_layers.active = me.uv_layers['UVMap']
    lum = rgb @ np.array((0.3, 0.59, 0.11), np.float32); nz = lum[lum > 0]
    log('light picture: median %.2f, 90%% %.2f, 99%% %.2f, 99.9%% %.2f' % (float(np.median(nz)), float(np.percentile(nz, 90)), float(np.percentile(nz, 99)), float(np.percentile(nz, 99.9))))
    bpy.data.images.remove(img)
if 'nobake' not in OPT: bake(int(OPT.get('samples', 48)))
cfg = {'blend': 'quay.blend', 'out': '../../Nightline/assets/quay',
       'world': {'collections': ['map'], 'lightmap': 'tex/quay_light.exr', 'lmSize': LMSIZE, 'lmRange': 8},
       'sky': {'width': 2048}, 'maxTexture': 2048}
with open(os.path.join(BASE, 'quay.export.json'), 'w') as f: json.dump(cfg, f, indent=1)
bpy.ops.wm.save_mainfile(); log('saved', bpy.data.filepath, '|', NTRI, 'triangles,', len(mats), 'materials,', len(LIGHTS), 'lights,', len(GLOWS), 'glows')
log('done')
