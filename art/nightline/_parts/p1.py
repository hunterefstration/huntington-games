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
    """14 m across (u), 18 m along (v): wet dark asphalt, glossy puddle patches with faint coloured reflections, worn tyre lanes, edge lines at +-6.6 m, centre dashes"""
    y, x = np.mgrid[0:H, 0:W].astype(np.float32); um = (x + 0.5) / W * 14.0; vm = (y + 0.5) / H * 18.0
    n1 = fbm_t(H, W, 6, 3); n2 = tn(H, W, 64, 64, 5); fine = grain(H, W, 0.05, 7)
    a = v3(0.275, 0.28, 0.305) * (0.75 + 0.5 * n1)[..., None] + fine[..., None]
    lane = np.exp(-((np.abs(um - 7.0) - 1.9) ** 2) / 0.5) * 0.5; a = a * (1 - 0.18 * lane[..., None])
    pm = np.clip(blur((tn(H, W, 9, 9, 21) - 0.48) * 6, 8) + 0.5, 0, 1) * np.clip((tn(H, W, 3, 3, 4) - 0.25) * 4, 0, 1)
    a = a * (1 - 0.35 * pm[..., None])
    st = tn(H, W, 28, 3, 31) * 0.6 + tn(H, W, 70, 5, 32) * 0.4; st = np.clip((st - 0.40) * 3.0, 0, 1)
    cc = tn(H, W, 3, 2, 33); tint = np.where((cc < 0.5)[..., None], mix(v3(1.0, 0.25, 0.65), v3(0.20, 0.75, 1.0), np.clip(cc * 2, 0, 1)), mix(v3(0.20, 0.75, 1.0), v3(1.0, 0.55, 0.2), np.clip(cc * 2 - 1, 0, 1)))
    a = a + tint * (pm * st * 0.34 + pm * 0.04)[..., None]
    crack = (np.abs(tn(H, W, 14, 14, 41) - 0.5) < 0.006).astype(np.float32); a = a * (1 - crack[..., None] * 0.35)
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
