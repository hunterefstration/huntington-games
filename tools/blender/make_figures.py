# ASHFALL figures: enemy kinds + a soldier for other players, in art/ashfall/figures.blend.
#   blender -b art/ashfall/figures.blend -P tools/blender/make_figures.py -- [only=walker,soldier] [preview=pose,walk,attack,die]
#   (first time: blender -b --factory-startup -P tools/blender/make_figures.py  creates the .blend)
# then node tools/export-art.mjs foe_walker soldier ...  ->  Ashfall/assets/foe_<id>.hgm, soldier.hgm
# Each figure: a body made as a signed distance field (bones as round cones, torso/head ellipsoids, clothes as offset shells,
# extras per kind), meshed with surface nets, decimated to three detail levels that share one 1024 picture (LOD0 in the top
# three quarters, LOD1 and LOD2 side by side below). Weights: the two nearest bones. Clips are computed per frame: legs by
# two-bone IK on planted feet (the stance foot moves back at the walking speed, so feet do not slide when the game moves the
# figure at that speed: logged and written to FIGURES.md), arms and spine by eased key poses.
# Re-runnable: per figure it deletes and rebuilds collection f_<id> (<id>_rig, <id>, <id>_lod1, <id>_lod2, actions <id>_*).
import bpy, bmesh, math, os, sys, json
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hgkit import *

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OPT = dict((a.split('=', 1) + ['1'])[:2] for a in ARGV)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = os.path.join(ROOT, 'art', 'ashfall'); TEXDIR = os.path.join(BASE, 'tex'); CACHE = os.path.join(BASE, '_cache')
for d in (TEXDIR, CACHE): os.makedirs(d, exist_ok=True)
scene = bpy.context.scene
if not bpy.data.filepath.replace('\\', '/').endswith('art/ashfall/figures.blend'):
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    scene.render.fps = 30; scene.render.fps_base = 1.0
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, 'figures.blend')); log('created', bpy.data.filepath)
FPS = scene.render.fps / scene.render.fps_base
V = Vector
def sd_cap(P, a, b, r):
    a = np.array(a, np.float32); ba = np.array(b, np.float32) - a; pa = P - a
    h = np.clip((pa @ ba) / max(float(ba @ ba), 1e-9), 0, 1); return np.linalg.norm(pa - h[:, None] * ba, axis=1) - r
def sd_cone2(P, a, b, r1, r2):
    """round cone between two points"""
    F = fr(a, V(b) - V(a), (0, -1, 0) if abs((V(b) - V(a)).normalized().y) < 0.9 else (0, 0, 1))
    return sd_rcone(loc(P, F), r1, r2, max((V(b) - V(a)).length, 1e-5))
def sd_ellf(P, c, r, F=None):
    q = P - np.array(c, np.float32) if F is None else loc(P, F)
    return sd_ell(q, r)
def sd_band(P, c, rx, ry, hh, th):
    """flat ring round the vertical axis through c (a belt)"""
    q = P - np.array(c, np.float32); e = np.sqrt((q[:, 0] / rx) ** 2 + (q[:, 1] / ry) ** 2); dr = np.abs((e - 1) * min(rx, ry)) - th
    return np.maximum(dr, np.abs(q[:, 2]) - hh)

# ---------------------------------------------------------------- skeleton
BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'upperarm_L', 'forearm_L', 'hand_L', 'upperarm_R', 'forearm_R', 'hand_R',
         'thigh_L', 'shin_L', 'foot_L', 'thigh_R', 'shin_R', 'foot_R']
PARENT = {'spine': 'hips', 'chest': 'spine', 'neck': 'chest', 'head': 'neck', 'upperarm_L': 'chest', 'forearm_L': 'upperarm_L', 'hand_L': 'forearm_L',
          'upperarm_R': 'chest', 'forearm_R': 'upperarm_R', 'hand_R': 'forearm_R', 'thigh_L': 'hips', 'shin_L': 'thigh_L', 'foot_L': 'shin_L',
          'thigh_R': 'hips', 'shin_R': 'thigh_R', 'foot_R': 'shin_R'}
def skeleton(H, p):
    J = {}; sw, hw, al = p.get('sw', 0.125), p.get('hw', 0.058), p.get('al', 1.0)
    J['hips'] = V((0, 0, 0.53 * H)); J['spine'] = V((0, 0, 0.61 * H)); J['chest'] = V((0, 0, 0.70 * H)); J['neck'] = V((0, 0, 0.825 * H))
    J['head'] = V((0, 0, 0.865 * H)); J['top'] = V((0, 0, H))
    a = math.radians(p.get('apose', 38))
    for s, sx in (('L', 1), ('R', -1)):
        d = V((sx * math.sin(a), 0, -math.cos(a)))
        J['sh_' + s] = V((sx * sw * H, 0, 0.81 * H)); J['el_' + s] = J['sh_' + s] + d * 0.175 * H * al; J['wr_' + s] = J['el_' + s] + d * 0.15 * H * al
        J['ht_' + s] = J['wr_' + s] + d * 0.09 * H * p.get('hand', 1.0)
        J['hip_' + s] = V((sx * hw * H, 0, 0.51 * H)); J['kn_' + s] = V((sx * hw * H, -0.01 * H, 0.275 * H)); J['an_' + s] = V((sx * hw * H, 0.0, 0.045 * H))
        J['toe_' + s] = V((sx * hw * H, -0.13 * H, 0.012 * H))
    seg = {'hips': ('hips', 'spine'), 'spine': ('spine', 'chest'), 'chest': ('chest', 'neck'), 'neck': ('neck', 'head'), 'head': ('head', 'top')}
    for s in 'LR':
        seg.update({'upperarm_' + s: ('sh_' + s, 'el_' + s), 'forearm_' + s: ('el_' + s, 'wr_' + s), 'hand_' + s: ('wr_' + s, 'ht_' + s),
                    'thigh_' + s: ('hip_' + s, 'kn_' + s), 'shin_' + s: ('kn_' + s, 'an_' + s), 'foot_' + s: ('an_' + s, 'toe_' + s)})
    R = {}
    for b in BONES:
        h, t = J[seg[b][0]], J[seg[b][1]]
        R[b] = fr(h, t - h, (0, 0, 1) if b.startswith('foot') else (0, -1, 0))
        R[b + '#len'] = (t - h).length
    return J, R

# ---------------------------------------------------------------- bodies
def body_groups(P, J, H, p, kind):
    """signed distances per material group (metres)"""
    G = {}; k = 0.035 * H; lr = p.get('limb', 1.0); cw, cd = p.get('cw', 1.0), p.get('cd', 1.0)
    ch = J['chest']
    torso = sd_ellf(P, ch + V((0, 0.005 * H, 0.04 * H)), (0.125 * H * cw, 0.08 * H * cd, 0.11 * H))
    torso = smin(torso, sd_ellf(P, J['spine'] + V((0, 0, 0.01 * H)), (0.105 * H * cw, 0.068 * H * cd, 0.09 * H)), k)
    torso = smin(torso, sd_ellf(P, J['hips'] + V((0, 0.004 * H, 0.0)), (0.115 * H * cw, 0.075 * H * cd, 0.075 * H)), k)
    bk = p.get('bellyk', 1.0)
    if p.get('belly'): torso = smin(torso, sd_ellf(P, J['spine'] + V((0, -0.04 * H, 0.0)), (0.15 * H * bk, 0.12 * H * bk, 0.13 * H * bk)), k)
    neck = sd_cap(P, J['neck'] - V((0, 0, 0.03 * H)), J['head'] + V((0, 0.0, 0.02 * H)), 0.034 * H * p.get('neck', 1.0))
    hk = p.get('head', 1.0)
    head = sd_ellf(P, J['head'] + V((0, -0.004 * H, 0.06 * H * hk)), (0.052 * H * hk, 0.062 * H * hk, 0.068 * H * hk))
    jaw = sd_ellf(P, J['head'] + V((0, -0.03 * H * hk, 0.025 * H * hk)), (0.04 * H * hk, 0.04 * H * hk, 0.032 * H * hk))
    G['skin'] = smin(smin(head, jaw, 0.02 * H), neck, 0.025 * H)
    arms, hands, legs, feet = [], [], [], []
    for s in 'LR':
        big = p.get('bigarm', 1.0) if s == 'R' else 1.0
        a = smin(sd_cone2(P, J['sh_' + s], J['el_' + s], 0.042 * H * lr * big, 0.033 * H * lr * big),
                 sd_cone2(P, J['el_' + s], J['wr_' + s], 0.033 * H * lr * big, 0.025 * H * lr * big), 0.02 * H)
        arms.append(smin(a, sd_ellf(P, J['sh_' + s] + V((0, 0, 0.01 * H)), (0.05 * H * lr * big, 0.05 * H * lr * big, 0.045 * H * lr * big)), 0.03 * H))
        d = (J['ht_' + s] - J['wr_' + s]).normalized(); Fh = fr(J['wr_' + s], d, (0, -1, 0))
        hands.append(smin(sd_rbox(loc(P, Fh) - np.array((0, 0.045 * H * p.get('hand', 1.0), 0), np.float32),
                                  (0.022 * H * big, 0.035 * H * p.get('hand', 1.0) * big, 0.009 * H * big), 0.008 * H * big),
                          sd_cap(P, J['wr_' + s] + V((0, -0.015 * H, 0)), J['wr_' + s] + d * 0.05 * H + V((0, -0.03 * H, 0)), 0.009 * H * big), 0.01 * H))
        legs.append(smin(sd_cone2(P, J['hip_' + s], J['kn_' + s], 0.066 * H * lr, 0.044 * H * lr), sd_cone2(P, J['kn_' + s], J['an_' + s], 0.045 * H * lr, 0.03 * H * lr), 0.02 * H))
        feet.append(sd_rbox(P - np.array(J['an_' + s] + V((0, -0.05 * H, -0.022 * H)), np.float32), (0.03 * H, 0.075 * H, 0.018 * H), 0.012 * H))
    arm = np.minimum(*arms); hand = np.minimum(*hands); leg = np.minimum(*legs); foot = np.minimum(*feet)
    body = smin(smin(torso, arm, 0.03 * H), leg, 0.04 * H)
    G['hand'] = hand; G['foot'] = foot
    if kind == 'walker':
        coat = smin(torso - 0.012 * H, arm - 0.008 * H, 0.03 * H)
        z = P[:, 2]; r0 = 0.13 * H; t = np.clip((0.56 * H - z) / (0.28 * H), 0, 1)
        th = np.arctan2(P[:, 1], P[:, 0]); fold = 0.006 * H * np.sin(7 * th + 3 * np.sin(z * 20 / H))
        rx = r0 + t * 0.05 * H + fold; ry = 0.085 * H + t * 0.05 * H + fold
        skirt = np.sqrt((P[:, 0] / rx) ** 2 + ((P[:, 1] - 0.005 * H) / ry) ** 2) * np.minimum(rx, ry) - np.minimum(rx, ry)
        hem = 0.30 * H + 0.035 * H * (vnoise(P * np.array((1, 1, 0), np.float32), 0.05 * H, 3) - 0.5) * 2
        skirt = np.maximum(skirt, np.maximum(hem - z, z - 0.58 * H))
        coat = smin(coat, skirt, 0.03 * H)
        hood = np.maximum(sd_ellf(P, J['head'] + V((0, 0.012 * H, 0.06 * H)), (0.072 * H, 0.085 * H, 0.088 * H)),
                          -sd_ellf(P, J['head'] + V((0, -0.075 * H, 0.04 * H)), (0.05 * H, 0.05 * H, 0.06 * H)))
        coat = smin(coat, hood, 0.025 * H)
        G['coat'] = coat; G['belt'] = sd_band(P, J['hips'] + V((0, 0.004 * H, 0.04 * H)), 0.125 * H, 0.085 * H, 0.012 * H, 0.006 * H)
        G['cloth'] = leg - 0.006 * H
        G['body'] = body
    elif kind in ('runner', 'cinder', 'spitter'):
        G['skin'] = smin(G['skin'], body, 0.03 * H)
        rags = np.maximum(sd_band(P, J['hips'] + V((0, 0.004 * H, 0.0)), 0.11 * H * cw, 0.075 * H * cd, 0.05 * H, 0.007 * H),
                          (vnoise(P, 0.04 * H, 11) - 0.62) * 0.05 * H)
        G['cloth'] = rags
        if kind == 'runner':
            G['cloth'] = np.minimum(rags, np.maximum(sd_band(P, ch + V((0, 0.005 * H, 0.06 * H)), 0.125 * H * cw, 0.08 * H * cd, 0.025 * H, 0.006 * H),
                                                     (vnoise(P, 0.03 * H, 13) - 0.6) * 0.05 * H))
        if kind == 'spitter':
            G['glow'] = sd_ellf(P, J['neck'] + V((0, -0.045 * H, -0.005 * H)), (0.068 * H, 0.062 * H, 0.06 * H))
    elif kind == 'brute':
        G['skin'] = smin(G['skin'], body, 0.04 * H)
        slabs = None
        for c, r in (((0.11, 0.0, 0.80), (0.07, 0.07, 0.03)), ((-0.12, 0.0, 0.81), (0.08, 0.075, 0.035)), ((0.0, 0.07, 0.74), (0.11, 0.035, 0.09)),
                     ((0.04, 0.075, 0.62), (0.08, 0.03, 0.06)), ((-0.17, 0.0, 0.66), (0.045, 0.05, 0.05))):
            e = sd_rbox(P - np.array(V(c) * H, np.float32), np.array(r, np.float32) * H * 0.8, 0.012 * H) + 0.006 * H * vnoise(P, 0.02 * H, 7)
            slabs = e if slabs is None else np.minimum(slabs, e)
        G['ash'] = slabs; G['cloth'] = sd_band(P, J['hips'] + V((0, 0.004 * H, 0.0)), 0.115 * H * cw, 0.075 * H * cd, 0.045 * H, 0.008 * H)
    elif kind == 'furnace':
        G['skin'] = smin(G['skin'], body, 0.04 * H)
        bc = J['spine'] + V((0, -0.04 * H, 0.0))
        G['fire'] = sd_ellf(P, bc + V((0, -0.006 * H, 0)), (0.15 * H, 0.12 * H, 0.13 * H)) + 0.004 * H
        bars = None
        for i in range(6):
            zz = bc.z - 0.10 * H + i * 0.04 * H
            e = sd_band(P, V((0, bc.y, zz)), 0.152 * H * math.sqrt(max(0.05, 1 - ((zz - bc.z) / (0.13 * H)) ** 2)) + 0.002 * H,
                        0.122 * H * math.sqrt(max(0.05, 1 - ((zz - bc.z) / (0.13 * H)) ** 2)) + 0.002 * H, 0.007 * H, 0.008 * H)
            e = np.maximum(e, P[:, 1] - (bc.y + 0.03 * H))
            bars = e if bars is None else np.minimum(bars, e)
        Fl = fr(J['el_L'], J['wr_L'] - J['el_L'], (0, -1, 0))
        G['metal'] = np.minimum(bars, sd_rbox(loc(P, Fl) - np.array((0.0, 0.07 * H, 0.0), np.float32), (0.05 * H, 0.08 * H, 0.03 * H), 0.006 * H))
        chain = None
        for i in range(14):
            u = i / 13.0; c = V((-0.14 * H + 0.28 * H * u, -0.09 * H - 0.02 * H * math.sin(math.pi * u), J['chest'].z + 0.08 * H - 0.25 * H * u))
            e = sd_cap(P, c - V((0.008 * H, 0, 0.008 * H)), c + V((0.008 * H, 0, 0.008 * H)), 0.006 * H)
            chain = e if chain is None else np.minimum(chain, e)
        G['chain'] = chain
        G['cloth'] = sd_band(P, J['hips'] + V((0, 0.004 * H, -0.01 * H)), 0.12 * H * cw, 0.08 * H * cd, 0.05 * H, 0.009 * H)
    elif kind == 'soldier':
        G['coat'] = smin(torso - 0.016 * H, sd_cone2(P, J['sh_L'], J['wr_L'], 0.05 * H, 0.033 * H), 0.03 * H)
        G['coat'] = smin(G['coat'], sd_cone2(P, J['sh_R'], J['wr_R'], 0.05 * H, 0.033 * H), 0.03 * H)
        G['cloth'] = leg - 0.01 * H
        G['helmet'] = np.maximum(sd_ellf(P, J['head'] + V((0, 0.004 * H, 0.075 * H)), (0.066 * H, 0.074 * H, 0.062 * H)), J['head'].z + 0.058 * H - P[:, 2])
        G['pack'] = sd_rbox(P - np.array(ch + V((0, 0.115 * H, 0.0)), np.float32), np.array((0.085, 0.04, 0.10), np.float32) * H, 0.02 * H)
        G['boot'] = foot - 0.004 * H
        G['glove'] = hand - 0.003 * H
        G['skin'] = G['skin']
        G['body'] = body
        del G['hand'], G['foot']
    elif kind in NEW_KINDS:
        new_body_groups(G, P, J, H, p, kind, torso, body, arm, leg, k, cw, cd)
    return G
NEW_KINDS = ('charger', 'leaper', 'bulwark', 'howler', 'husk', 'mite', 'bloater', 'foreman', 'widow')
def caps_path(P, pts, r0, r1):
    """a chain of capsules through pts, radius tapering r0 -> r1"""
    d = None
    for i in range(len(pts) - 1):
        r = r0 + (r1 - r0) * (i + 0.5) / (len(pts) - 1); e = sd_cap(P, pts[i], pts[i + 1], r)
        d = e if d is None else smin(d, e, 0.4 * r)
    return d
def bez(a, b, c, e, n):
    a, b, c, e = V(a), V(b), V(c), V(e)
    return [a * (1 - t) ** 3 + b * 3 * t * (1 - t) ** 2 + c * 3 * t * t * (1 - t) + e * t ** 3 for t in (i / (n - 1) for i in range(n))]
def skirt_sd(P, J, H, hem_h, top, r0, flare, seed):
    z = P[:, 2]; t = np.clip((top - z) / (top - hem_h), 0, 1)
    th = np.arctan2(P[:, 1], P[:, 0]); fold = 0.006 * H * np.sin(7 * th + 3 * np.sin(z * 20 / H))
    rx = r0 + t * flare * H + fold; ry = 0.075 * H + t * flare * H + fold
    sk = np.sqrt((P[:, 0] / rx) ** 2 + ((P[:, 1] - 0.005 * H) / ry) ** 2) * np.minimum(rx, ry) - np.minimum(rx, ry)
    hem = hem_h + 0.05 * H * (vnoise(P * np.array((1, 1, 0), np.float32), 0.04 * H, seed) - 0.5) * 2
    return np.maximum(sk, np.maximum(hem - z, z - top))
def chain_sd(P, pts, H, r=0.006):
    d = None
    for i in range(len(pts)):
        c = V(pts[i]); o = V((0.008 * H, 0, 0.008 * H)) if i % 2 else V((0, 0.008 * H, 0.008 * H))
        e = sd_cap(P, c - o, c + o, r * H); d = e if d is None else np.minimum(d, e)
    return d
def new_body_groups(G, P, J, H, p, kind, torso, body, arm, leg, k, cw, cd):
    ch, hd = J['chest'], J['head']; A = lambda v: np.array(v, np.float32)
    if kind == 'charger':
        hump = sd_ellf(P, ch + V((0, 0.045 * H, 0.075 * H)), (0.21 * H, 0.12 * H, 0.09 * H))
        G['skin'] = smin(smin(G['skin'], body, 0.04 * H), hump, 0.05 * H)
        Fr = fr(J['el_R'], J['wr_R'] - J['el_R'], (0, -1, 0))
        plate = sd_rbox(loc(P, Fr) - A((0.0, 0.08 * H, 0.085 * H)), (0.07 * H, 0.11 * H, 0.012 * H), 0.004 * H)
        cap = np.maximum(sd_ellf(P, hd + V((0, -0.01 * H, 0.075 * H)), (0.068 * H, 0.078 * H, 0.06 * H)), hd.z + 0.065 * H - P[:, 2])
        shp = sd_rbox(P - A(J['sh_R'] + V((0, 0, 0.06 * H))), (0.08 * H, 0.08 * H, 0.016 * H), 0.006 * H)
        G['metal'] = np.minimum(np.minimum(plate, cap), shp)
        rebar = None
        for ox, oz in ((-0.03, 0.07), (0.0, 0.1), (0.035, 0.075), (0.012, 0.055)):
            e = sd_cap(P, Fr @ V((ox * H, 0.0, oz * H)), Fr @ V((ox * H, 0.40 * H, (oz + 0.01) * H)), 0.007 * H)
            rebar = e if rebar is None else np.minimum(rebar, e)
        q = loc(P, Fr); rad = np.sqrt(q[:, 0] ** 2 + q[:, 2] ** 2); straps = None
        for yy, rr in ((0.03, 0.09), (0.12, 0.08)):
            e = np.maximum(np.abs(rad - rr * H) - 0.008 * H, np.abs(q[:, 1] - yy * H) - 0.014 * H); straps = e if straps is None else np.minimum(straps, e)
        G['rebar'] = rebar; G['belt'] = straps
        G['cloth'] = sd_band(P, J['hips'] + V((0, 0.004 * H, 0.0)), 0.115 * H * cw, 0.075 * H * cd, 0.05 * H, 0.009 * H)
    elif kind in ('leaper', 'mite'):
        knobs = None
        for i in range(10):
            z = J['hips'].z + (J['neck'].z - J['hips'].z) * i / 9
            e = sd_ellf(P, V((0, 0.07 * H * cd, z)), (0.014 * H, 0.012 * H, 0.012 * H)); knobs = e if knobs is None else np.minimum(knobs, e)
        G['skin'] = smin(smin(G['skin'], body, 0.025 * H), knobs, 0.012 * H)
        claws = None
        for s in 'LR':
            d = (J['ht_' + s] - J['wr_' + s]).normalized()
            for ox in (-0.014, 0.0, 0.014):
                a = J['ht_' + s] + V((ox * H, -0.01 * H, 0)); e = sd_cap(P, a - d * 0.02 * H, a + d * 0.05 * H + V((0, -0.015 * H, 0)), 0.005 * H)
                claws = e if claws is None else np.minimum(claws, e)
        G['hand'] = smin(G['hand'], claws, 0.006 * H)
        if kind == 'leaper':
            G['cloth'] = np.maximum(sd_band(P, J['hips'] + V((0, 0.004 * H, -0.01 * H)), 0.10 * H * cw, 0.07 * H * cd, 0.04 * H, 0.007 * H),
                                    (vnoise(P, 0.04 * H, 23) - 0.6) * 0.05 * H)
    elif kind == 'bulwark':
        sl = smin(sd_cone2(P, J['sh_L'], J['wr_L'], 0.052 * H, 0.036 * H), sd_cone2(P, J['sh_R'], J['wr_R'], 0.052 * H, 0.036 * H), 0.02 * H)
        G['coat'] = smin(torso - 0.02 * H, sl, 0.03 * H); G['cloth'] = leg - 0.01 * H; G['body'] = body
        G['helmet'] = np.maximum(sd_ellf(P, hd + V((0, 0.006 * H, 0.07 * H)), (0.07 * H, 0.08 * H, 0.072 * H)), hd.z + 0.015 * H - P[:, 2])
        vis = np.maximum(sd_ellf(P, hd + V((0, -0.012 * H, 0.055 * H)), (0.072 * H, 0.082 * H, 0.05 * H)), P[:, 1] - (hd.y - 0.03 * H))
        G['visor'] = np.maximum(vis, np.maximum(hd.z + 0.02 * H - P[:, 2], P[:, 2] - (hd.z + 0.09 * H)))
        sc = V((0.06 * H, -0.2 * H, 0.53 * H))
        door = sd_rbox(P - A(sc), A((0.15, 0.012, 0.27)) * H, 0.012 * H) + 0.003 * H * vnoise(P, 0.03 * H, 41)
        win = sd_rbox(P - A(sc + V((0.0, 0, 0.16 * H))), A((0.115, 0.05, 0.085)) * H, 0.01 * H)
        door = np.maximum(door, -win)
        hand_ = sd_rbox(P - A(sc + V((0.085 * H, -0.016 * H, 0.03 * H))), A((0.03, 0.006, 0.008)) * H, 0.003 * H)
        G['door'] = np.minimum(door, hand_)
    elif kind == 'howler':
        G['skin'] = smin(G['skin'], body, 0.025 * H)
        jaw = sd_cone2(P, hd + V((0, -0.012 * H, 0.03 * H)), hd + V((0, -0.065 * H, -0.065 * H)), 0.034 * H, 0.026 * H)
        mouth = sd_ellf(P, hd + V((0, -0.062 * H, 0.0)), (0.024 * H, 0.03 * H, 0.055 * H))
        G['skin'] = np.maximum(smin(G['skin'], jaw, 0.015 * H), -mouth)
        ribs = None; rx0, ry0 = 0.125 * H * cw, 0.08 * H * cd
        for i in range(6):
            zz = ch.z + 0.10 * H - i * 0.03 * H; f = math.sqrt(max(0.15, 1 - ((zz - ch.z - 0.04 * H) / (0.11 * H)) ** 2))
            e = np.maximum(sd_band(P, V((0, 0.005 * H, zz)), rx0 * f + 0.003 * H, ry0 * f + 0.003 * H, 0.006 * H, 0.006 * H), P[:, 1] - 0.03 * H)
            ribs = e if ribs is None else np.minimum(ribs, e)
        G['bone'] = ribs
        G['cloth'] = np.maximum(sd_band(P, J['hips'] + V((0, 0.004 * H, 0.0)), 0.11 * H * cw, 0.075 * H * cd, 0.05 * H, 0.007 * H), (vnoise(P, 0.04 * H, 29) - 0.62) * 0.05 * H)
    elif kind == 'husk':
        G['skin'] = smin(G['skin'], body, 0.04 * H)
        rng = np.random.default_rng(17); gr = None
        for anc, n, rr in ((J['sh_R'] + V((0.01 * H, 0.03 * H, 0.05 * H)), 6, 0.05), (J['spine'] + V((0.05 * H, -0.13 * H, 0.0)), 5, 0.04),
                           (ch + V((-0.06 * H, 0.09 * H, 0.05 * H)), 5, 0.045), (J['hips'] + V((-0.08 * H, -0.06 * H, 0.02 * H)), 3, 0.03)):
            for i in range(n):
                c = anc + V(tuple(rng.normal(0, 0.035, 3) * H)); r = rr * H * rng.uniform(0.5, 1.0)
                e = sd_ellf(P, c, (r, r, r * 0.9)); gr = e if gr is None else smin(gr, e, 0.01 * H)
        G['growth'] = gr
        G['cloth'] = np.maximum(sd_band(P, J['hips'] + V((0, 0.004 * H, 0.0)), 0.115 * H * cw, 0.08 * H * cd, 0.055 * H, 0.009 * H), (vnoise(P, 0.04 * H, 31) - 0.65) * 0.05 * H)
    elif kind == 'bloater':
        bc = J['spine'] + V((0, -0.06 * H, -0.02 * H))
        G['skin'] = smin(smin(G['skin'], body, 0.05 * H), sd_ellf(P, bc, (0.22 * H, 0.2 * H, 0.2 * H)), 0.06 * H)
        gl = None
        for th, ph, r in ((-0.3, 0.1, 0.06), (0.35, -0.2, 0.05), (0.0, -0.45, 0.045), (0.6, 0.3, 0.04), (-0.65, -0.1, 0.045), (0.15, 0.45, 0.035), (-0.2, -0.75, 0.03)):
            dv = V((math.sin(th) * math.cos(ph), -math.cos(th) * math.cos(ph), math.sin(ph))); c = bc + V((dv.x * 0.21 * H, dv.y * 0.19 * H, dv.z * 0.19 * H))
            e = sd_ellf(P, c, (r * H, r * H, r * H)); gl = e if gl is None else np.minimum(gl, e)
        G['glow'] = gl
        G['cloth'] = sd_band(P, J['hips'] + V((0, -0.01 * H, -0.02 * H)), 0.15 * H, 0.12 * H, 0.04 * H, 0.008 * H)
    elif kind == 'foreman':
        G['skin'] = smin(G['skin'], body, 0.04 * H)
        vest = np.maximum(torso - 0.014 * H, (vnoise(P, 0.03 * H, 71) - 0.7) * 0.06 * H)
        vest = np.maximum(vest, np.maximum(J['hips'].z - 0.02 * H - P[:, 2], P[:, 2] - (J['neck'].z - 0.01 * H)))
        vest = np.maximum(vest, -np.maximum(np.abs(P[:, 0]) - 0.028 * H, P[:, 1] + 0.02 * H))      # hanging open at the front
        G['vest'] = np.minimum(vest, np.maximum(sd_cone2(P, J['sh_L'], J['el_L'], 0.05 * H, 0.04 * H), (vnoise(P, 0.03 * H, 73) - 0.6) * 0.06 * H))
        dome = np.maximum(sd_ellf(P, hd + V((0, 0.0, 0.08 * H)), (0.068 * H, 0.078 * H, 0.06 * H)), hd.z + 0.08 * H - P[:, 2])
        brim = sd_ellf(P, hd + V((0, -0.012 * H, 0.08 * H)), (0.085 * H, 0.1 * H, 0.006 * H))
        G['hat'] = np.minimum(dome, brim)
        d = (J['ht_R'] - J['wr_R']).normalized(); e0 = J['wr_R'] + d * 0.36 * H
        Fe = fr(e0, d, (0, -1, 0))
        G['hammer'] = np.minimum(sd_cap(P, J['wr_R'] - d * 0.02 * H, e0, 0.011 * H), sd_rbox(loc(P, Fe), (0.03 * H, 0.032 * H, 0.075 * H), 0.006 * H))
        drape = [V((-0.13 * H + 0.26 * H * u, -0.085 * H - 0.025 * H * math.sin(math.pi * u), ch.z + 0.1 * H - 0.24 * H * u)) for u in (i / 15.0 for i in range(16))]
        Fl = fr(J['el_L'], J['wr_L'] - J['el_L'], (0, -1, 0))
        wrap = [Fl @ V((0.042 * H * math.cos(a), 0.02 * H + a * 0.006 * H, 0.042 * H * math.sin(a))) for a in np.linspace(0, 4 * math.pi, 18)]
        hang = [J['wr_L'] + V((0.01 * H, -0.01 * H, -0.02 * H * i)) for i in range(8)]
        G['chain'] = chain_sd(P, drape + wrap + hang, H, 0.0055)
        G['cloth'] = leg - 0.009 * H
    elif kind == 'widow':
        G['skin'] = smin(G['skin'], body, 0.025 * H)
        dress = smin(torso - 0.01 * H, skirt_sd(P, J, H, 0.29 * H, 0.56 * H, 0.11 * H, 0.06, 5), 0.03 * H)
        G['dress'] = np.maximum(dress, (vnoise(P, 0.025 * H, 81) - 0.76) * 0.06 * H)          # torn holes
        G['dress'] = np.minimum(G['dress'], sd_rbox(P - A(hd + V((0, 0.01 * H, 0.13 * H))), (0.04 * H, 0.03 * H, 0.012 * H), 0.004 * H))
        sp = None
        for i, (sx, z0, rch, fw) in enumerate(((1, 0.76, 0.40, -0.08), (-1, 0.76, 0.40, -0.08), (1, 0.70, 0.36, 0.0), (-1, 0.70, 0.36, 0.0),
                                               (1, 0.64, 0.33, 0.05), (-1, 0.64, 0.33, 0.05), (1, 0.82, 0.22, -0.02), (-1, 0.82, 0.22, -0.02))):
            a = V((sx * 0.035 * H, 0.06 * H, z0 * H)); b = V((sx * 0.12 * H, 0.26 * H, (z0 + 0.16) * H))
            c = V((sx * (rch + 0.02) * H, 0.18 * H, (z0 + 0.14) * H)); e = V((sx * rch * H, fw * H, (z0 - 0.06) * H))
            d = caps_path(P, bez(a, b, c, e, 9), 0.022 * H, 0.006 * H); sp = d if sp is None else np.minimum(sp, d)
        G['spines'] = sp
        G['sac'] = sd_ellf(P, V((0, 0.13 * H, 0.47 * H)), (0.1 * H, 0.11 * H, 0.13 * H)) + 0.004 * H * vnoise(P, 0.02 * H, 83)
def combine(G, kind):
    D = None
    for g, d in G.items(): D = d if D is None else (smin(D, d, 0.012) if g in ('skin', 'body', 'coat', 'cloth') else np.minimum(D, d))
    return D

# ---------------------------------------------------------------- mesh, weights, UV atlas, picture
def figure_mesh(name, J, H, p, kind):
    h = H / float(OPT.get('res', 190))
    bx = p.get('box', ((-0.42, -0.24, -0.01), (0.42, 0.22, 1.02))); lo = V(bx[0]) * H; hi = V(bx[1]) * H
    xs = np.arange(lo.x, hi.x, h, dtype=np.float32); ys = np.arange(lo.y, hi.y, h, dtype=np.float32); zs = np.arange(lo.z, hi.z, h, dtype=np.float32)
    X, Y, Z = np.meshgrid(xs, ys, zs, indexing='ij'); P = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
    F = combine(body_groups(P, J, H, p, kind), kind).reshape(len(xs), len(ys), len(zs))
    v, q = surface_nets(F, (xs[0], ys[0], zs[0]), h)
    me = bpy.data.meshes.new(name + '_tmp'); me.from_pydata(v.tolist(), [], q.tolist())
    ob = bpy.data.objects.new(name + '_tmp', me); col.objects.link(ob)
    m1 = ob.modifiers.new('s', 'SMOOTH'); m1.factor = 0.5; m1.iterations = 2
    m2 = ob.modifiers.new('d', 'DECIMATE'); m2.ratio = p.get('tris', 4200) / (2.0 * len(q))
    dg = bpy.context.evaluated_depsgraph_get(); out = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob, do_unlink=True); bpy.data.meshes.remove(me)
    log(name, 'surface nets', len(q), 'quads ->', len(out.polygons))
    return out
def decimated(me, n):
    ob = bpy.data.objects.new('tmp_dec', me.copy()); col.objects.link(ob)
    m = ob.modifiers.new('d', 'DECIMATE'); m.ratio = min(1.0, n / max(1, len(me.polygons)))
    dg = bpy.context.evaluated_depsgraph_get(); out = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    d = ob.data; bpy.data.objects.remove(ob, do_unlink=True); bpy.data.meshes.remove(d)
    return out
def triangulate(me):
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.triangulate(bm, faces=bm.faces[:]); bm.to_mesh(me); bm.free()
REGIONS = [(0.0, 0.25, 1.0, 0.75), (0.0, 0.0, 0.5, 0.25), (0.5, 0.0, 0.5, 0.25)]      # u0, v0, w, h per detail level
def atlas_uv(ob, region):
    smart_uv(ob, 66, 0.006)
    uv = ob.data.uv_layers['UVMap'].data; a = np.empty(len(uv) * 2, np.float32); uv.foreach_get('uv', a); a = a.reshape(-1, 2)
    u0, v0, w, hh = region; a[:, 0] = u0 + a[:, 0] * w; a[:, 1] = v0 + a[:, 1] * hh; uv.foreach_set('uv', a.ravel())
def bone_weights(co, R, H):
    """two nearest bones by distance to the bone's axis, smooth blend"""
    segs = []
    for b in BONES:
        h = np.array(R[b].translation, np.float32); y = np.array(R[b].col[1][:3], np.float32); segs.append((b, h, y, R[b + '#len']))
    D = np.zeros((len(co), len(segs)), np.float32)
    for i, (b, h, y, L) in enumerate(segs):
        pa = co - h; t = np.clip(pa @ y, 0, L); D[:, i] = np.linalg.norm(pa - t[:, None] * y, axis=1)
        if b in ('hips', 'spine', 'chest'): D[:, i] -= 0.08 * H
        elif b == 'head': D[:, i] -= 0.05 * H
    order = np.argsort(D, 1)[:, :2]; d1 = np.take_along_axis(D, order[:, :1], 1)[:, 0]; d2 = np.take_along_axis(D, order[:, 1:2], 1)[:, 0]
    w1 = 1.0 / np.maximum(d1 - d1.min() * 0 + 0.01 * H, 1e-4) ** 4; w2 = 1.0 / np.maximum(d2 + 0.01 * H, 1e-4) ** 4
    w2 = np.where(d2 - d1 > 0.06 * H, 0, w2); s = w1 + w2
    return [(BONES[order[i, 0]], float(w1[i] / s[i]), BONES[order[i, 1]], float(w2[i] / s[i])) for i in range(len(co))]
PALETTE = {
    'walker': {'skin': (0.55, 0.54, 0.51), 'coat': (0.36, 0.33, 0.29), 'belt': (0.24, 0.18, 0.13), 'cloth': (0.27, 0.27, 0.28), 'hand': (0.52, 0.51, 0.48), 'foot': (0.2, 0.19, 0.18), 'body': (0.36, 0.33, 0.29)},
    'runner': {'skin': (0.45, 0.43, 0.41), 'cloth': (0.32, 0.28, 0.24), 'hand': (0.42, 0.40, 0.38), 'foot': (0.40, 0.38, 0.36)},
    'brute': {'skin': (0.36, 0.35, 0.34), 'ash': (0.60, 0.58, 0.54), 'cloth': (0.24, 0.22, 0.20), 'hand': (0.34, 0.33, 0.32), 'foot': (0.33, 0.32, 0.31)},
    'spitter': {'skin': (0.42, 0.44, 0.38), 'glow': (0.74, 0.88, 0.26), 'cloth': (0.28, 0.27, 0.22), 'hand': (0.40, 0.42, 0.36), 'foot': (0.40, 0.42, 0.36)},
    'cinder': {'skin': (0.10, 0.09, 0.085), 'cloth': (0.16, 0.13, 0.11), 'hand': (0.10, 0.09, 0.085), 'foot': (0.10, 0.09, 0.085)},
    'furnace': {'skin': (0.26, 0.24, 0.23), 'fire': (1.0, 0.52, 0.14), 'metal': (0.33, 0.33, 0.35), 'chain': (0.30, 0.29, 0.28), 'cloth': (0.20, 0.18, 0.16), 'hand': (0.25, 0.23, 0.22), 'foot': (0.25, 0.23, 0.22)},
    'soldier': {'skin': (0.55, 0.43, 0.35), 'coat': (0.58, 0.60, 0.53), 'cloth': (0.36, 0.37, 0.33), 'helmet': (0.47, 0.49, 0.43), 'pack': (0.54, 0.56, 0.49),
                'boot': (0.17, 0.16, 0.15), 'glove': (0.16, 0.16, 0.16), 'body': (0.58, 0.60, 0.53), 'gun': (0.12, 0.12, 0.125)},
    'charger': {'skin': (0.34, 0.30, 0.28), 'metal': (0.34, 0.30, 0.27), 'rebar': (0.28, 0.19, 0.13), 'belt': (0.20, 0.15, 0.11), 'cloth': (0.22, 0.20, 0.18), 'hand': (0.32, 0.29, 0.27), 'foot': (0.30, 0.27, 0.25)},
    'leaper': {'skin': (0.50, 0.47, 0.44), 'cloth': (0.25, 0.22, 0.19), 'hand': (0.46, 0.43, 0.40), 'foot': (0.46, 0.43, 0.40)},
    'bulwark': {'skin': (0.47, 0.43, 0.40), 'coat': (0.22, 0.24, 0.27), 'cloth': (0.20, 0.20, 0.22), 'helmet': (0.16, 0.16, 0.17), 'visor': (0.05, 0.06, 0.07), 'door': (0.44, 0.17, 0.12),
                'body': (0.22, 0.24, 0.27), 'hand': (0.18, 0.18, 0.18), 'foot': (0.16, 0.15, 0.14)},
    'howler': {'skin': (0.48, 0.45, 0.42), 'bone': (0.70, 0.66, 0.58), 'cloth': (0.26, 0.23, 0.20), 'hand': (0.45, 0.42, 0.39), 'foot': (0.45, 0.42, 0.39)},
    'husk': {'skin': (0.42, 0.35, 0.32), 'growth': (0.80, 0.76, 0.64), 'cloth': (0.27, 0.25, 0.21), 'hand': (0.40, 0.34, 0.31), 'foot': (0.38, 0.33, 0.30)},
    'mite': {'skin': (0.70, 0.68, 0.64), 'hand': (0.66, 0.64, 0.60), 'foot': (0.66, 0.64, 0.60)},
    'bloater': {'skin': (0.46, 0.44, 0.37), 'glow': (0.55, 1.0, 0.22), 'cloth': (0.25, 0.24, 0.20), 'hand': (0.44, 0.42, 0.35), 'foot': (0.42, 0.40, 0.34)},
    'foreman': {'skin': (0.36, 0.33, 0.31), 'vest': (0.80, 0.76, 0.12), 'hat': (0.82, 0.72, 0.12), 'hammer': (0.26, 0.25, 0.25), 'chain': (0.30, 0.29, 0.28),
                'cloth': (0.20, 0.21, 0.25), 'hand': (0.34, 0.31, 0.29), 'foot': (0.18, 0.16, 0.14)},
    'widow': {'skin': (0.56, 0.53, 0.51), 'dress': (0.64, 0.65, 0.62), 'spines': (0.28, 0.24, 0.22), 'sac': (0.64, 0.55, 0.46), 'hand': (0.52, 0.49, 0.47), 'foot': (0.50, 0.47, 0.45)}}
def figure_texture(name, lods, J, H, p, kind, gunfaces):
    N = 1024; attrs_tri = []; tuv_all = []
    lod0 = lods[0].data
    co0 = np.array([v.co[:] for v in lod0.vertices], np.float32)
    bvh0 = BVHTree.FromPolygons([V(c) for c in co0], [list(f.vertices) for f in lod0.polygons])
    ns = [v.normal.copy() for v in lod0.vertices]; ao_v = np.ones(len(co0), np.float32)
    rng = np.random.default_rng(2); NR = 40; u1, u2 = rng.random(NR), rng.random(NR)
    dirs = np.stack([np.sqrt(u1) * np.cos(2 * np.pi * u2), np.sqrt(u1) * np.sin(2 * np.pi * u2), np.sqrt(1 - u1)], 1); md = 0.12 * H
    for i, (c, n) in enumerate(zip(co0, ns)):
        t = n.orthogonal().normalized(); b = n.cross(t); o = V(c) + n * 0.002 * H; occ = 0.0
        for d in dirs:
            hit = bvh0.ray_cast(o, t * d[0] + b * d[1] + n * d[2], md)
            if hit[0] is not None: occ += 1 - hit[3] / md
        ao_v[i] = 1 - occ / NR
    for li, ob in enumerate(lods):
        me = ob.data; me.calc_loop_triangles(); nt = len(me.loop_triangles)
        tl = np.empty(nt * 3, np.int64); me.loop_triangles.foreach_get('loops', tl); tl = tl.reshape(-1, 3)
        tp = np.empty(nt, np.int64); me.loop_triangles.foreach_get('polygon_index', tp)
        lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get('vertex_index', lv)
        co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
        uv = np.empty(len(me.loops) * 2, np.float32); me.uv_layers['UVMap'].data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
        vn = np.array([v.normal[:] for v in me.vertices], np.float32)
        gf = np.zeros(len(me.polygons), np.float32)
        if gunfaces.get(li): gf[list(gunfaces[li])] = 1
        attrs_tri.append([co[lv[tl]], vn[lv[tl]], np.repeat(gf[tp][:, None, None], 3, 1)]); tuv_all.append(uv[tl])
    tuv = np.concatenate(tuv_all); A = [np.concatenate([a[k] for a in attrs_tri]) for k in range(3)]
    mask, (Pi, Ni, Gi) = raster(tuv, A, N)
    idx = np.nonzero(mask); P = Pi[idx]; Nn = Ni[idx]; Nn /= np.maximum(np.linalg.norm(Nn, axis=1, keepdims=True), 1e-6); isgun = Gi[idx][:, 0] > 0.5
    ao = np.ones(len(P), np.float32)
    for i in range(len(P)):
        r = bvh0.find_nearest(V(P[i]), 0.1 * H)
        if r[2] is not None: ao[i] = float(np.mean(ao_v[list(lod0.polygons[r[2]].vertices)]))
    G = body_groups(P, J, H, p, kind); names = list(G); Dm = np.stack([G[g] for g in names], 1); order = np.argsort(Dm, 1)
    part = np.array(names)[order[:, 0]]; gap = np.take_along_axis(Dm, order[:, 1:2], 1)[:, 0] - np.take_along_axis(Dm, order[:, :1], 1)[:, 0]
    pal = PALETTE[kind]; base = np.array([pal.get(g, pal.get('skin')) for g in part], np.float32)
    base[isgun] = pal.get('gun', (0.12, 0.12, 0.12))
    grain = fbm(P, 0.006 * H, 3); mott = fbm(P, 0.05 * H, 9); fine = vnoise(P, 0.002 * H, 21)
    col_ = base * (0.88 + 0.24 * grain[:, None]) * (0.9 + 0.2 * mott[:, None])
    cloth = np.isin(part, ['coat', 'cloth', 'belt', 'pack', 'body', 'vest', 'dress'])
    streak = vnoise(P * np.array((1, 1, 0.15), np.float32), 0.01 * H, 5)
    col_[cloth] *= (0.85 + 0.25 * streak[cloth])[:, None]
    skin = np.isin(part, ['skin', 'hand'])
    veins = np.abs(fbm(P, 0.03 * H, 31) - 0.5) < 0.018
    if kind in ('walker', 'runner', 'spitter', 'brute', 'charger', 'leaper', 'howler', 'husk', 'mite', 'bloater', 'foreman', 'widow'): col_[skin & veins] *= 0.72
    if kind == 'foreman':      # reflective stripes on what is left of the hi-vis
        v = part == 'vest'; band = (np.abs(P[:, 2] - (J['chest'].z + 0.02 * H)) < 0.012 * H) | (np.abs(P[:, 2] - (J['spine'].z - 0.02 * H)) < 0.012 * H)
        col_[v & band] = np.array((0.72, 0.72, 0.70), np.float32)
    if kind == 'husk':         # the splitting torso: raw red-dark tears
        tear = skin & (np.abs(fbm(P, 0.03 * H, 91, 4) - 0.5) < 0.03) & (P[:, 2] > 0.45 * H) & (P[:, 2] < 0.85 * H)
        col_[tear] = np.array((0.30, 0.06, 0.05), np.float32)
    if kind == 'howler':       # the maw
        m = np.linalg.norm((P - np.array(J['head'] + V((0, -0.062 * H, 0.0)), np.float32)) / np.array((0.03, 0.036, 0.062), np.float32) / H, axis=1) < 1.0
        col_[m] = np.array((0.12, 0.03, 0.03), np.float32)
    if kind == 'bloater':      # the glow shows through the skin round the patches too
        g = (part == 'skin') & (G['glow'] < 0.025 * H); col_[g] = col_[g] * 0.6 + np.array((0.35, 0.6, 0.12), np.float32) * 0.4
    if kind == 'cinder':
        crack = np.abs(fbm(P, 0.035 * H, 41, 4) - 0.5) < 0.03; glow = np.array((1.0, 0.45, 0.1), np.float32)
        col_[skin & crack] = glow * (0.8 + 0.4 * fine[skin & crack, None])
    if 'glow' in G:
        gl = part == 'glow'; col_[gl] = np.array(pal['glow'], np.float32) * (0.85 + 0.3 * fine[gl, None])
    if kind == 'furnace':
        fi = part == 'fire'; col_[fi] = np.array(pal['fire'], np.float32) * (0.7 + 0.6 * fbm(P[fi], 0.03 * H, 51)[:, None])
    if kind == 'brute':
        a = part == 'ash'; crack = np.abs(fbm(P, 0.02 * H, 61) - 0.5) < 0.025; col_[a & crack] *= 0.5
    face = (part == 'skin') & (P[:, 2] > J['head'].z + 0.03 * H) & (P[:, 1] < -0.04 * H)
    for sx in (-1, 1):
        e = np.linalg.norm(P - np.array(J['head'] + V((sx * 0.022 * H, -0.058 * H, 0.072 * H)), np.float32), axis=1) < 0.012 * H
        col_[e & face] *= 0.25
    mouth = (part == 'skin') & (np.abs(P[:, 2] - (J['head'].z + 0.022 * H)) < 0.004 * H) & (np.abs(P[:, 0]) < 0.02 * H) & (P[:, 1] < -0.05 * H)
    col_[mouth] *= 0.3
    ash = np.clip((Nn[:, 2] - 0.35) * 2.5, 0, 1) * (0.5 + 0.5 * mott) * (0 if kind in ('soldier', 'cinder') else 1)
    col_ = col_ * (1 - 0.45 * ash[:, None]) + np.array((0.62, 0.6, 0.57), np.float32) * 0.45 * ash[:, None]
    seam = (gap < 0.003 * H) & ~isgun; col_[seam] *= 0.7
    glowing = np.isin(part, ['glow', 'fire']) | ((kind == 'cinder') & skin & (col_[:, 0] > 0.5))
    col_[~glowing] *= (0.32 + 0.68 * np.clip(ao[~glowing], 0, 1) ** 1.4)[:, None]
    low = (0.72 + 0.28 * np.clip((P[:, 2] - 0.05 * H) / (0.45 * H), 0, 1)) * np.where(Nn[:, 2] < -0.3, 0.8, 1.0)      # lower body and undersides a step darker
    keep = glowing | (part == 'skin') & (P[:, 2] > 0.8 * H) | isgun
    col_[~keep] *= low[~keep][:, None]
    col_ = np.clip(col_, 0.035, 1)
    img = np.zeros((N, N, 3), np.float32); img[idx] = col_; filled = mask.copy()
    for it in range(8):
        acc = np.zeros_like(img); cnt = np.zeros((N, N), np.float32)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            acc += np.roll(np.roll(img * filled[..., None], dy, 0), dx, 1); cnt += np.roll(np.roll(filled, dy, 0), dx, 1)
        new = (~filled) & (cnt > 0); img[new] = acc[new] / cnt[new][:, None]; filled |= new
    img[~filled] = 0.2
    return save_image(img, name, TEXDIR)

# ---------------------------------------------------------------- the soldier's carbine (simple, for third person)
def soldier_gun():
    k = Kit(1)
    k.box((0, 0.05, 0.0), (0.03, 0.30, 0.055), 'polymer', bev=0.003)
    k.lathe([(0.009, 0.2), (0.009, 0.46), (0.0, 0.462)], T(0, 0, 0.012), 8, 'steel')
    k.box((0, -0.19, -0.01), (0.035, 0.18, 0.07), 'polymer', bev=0.004)
    k.box((0, 0.10, -0.06), (0.024, 0.04, 0.09), 'steel', bev=0.003)
    k.box((0, -0.015, -0.055), (0.026, 0.03, 0.08), 'polymer', bev=0.003)
    k.box((0, 0.0, 0.045), (0.03, 0.06, 0.03), 'alloy', bev=0.003)
    return k

# ---------------------------------------------------------------- posing: own forward kinematics, legs by IK
def two_bone(A, Tg, a, b, pole):
    d = Tg - A; L = min(max(d.length, 1e-4), (a + b) * 0.9995); dn = d.normalized()
    ca = max(-1.0, min(1.0, (a * a + L * L - b * b) / (2 * a * L))); sa = math.sqrt(max(0.0, 1 - ca * ca))
    pp = (pole - pole.dot(dn) * dn); pp = pp.normalized() if pp.length > 1e-6 else V((0, -1, 0))
    return A + dn * (a * ca) + pp * (a * sa), A + dn * L
def rot(e): return Rx(e[0]) @ Ry(e[1]) @ Rz(e[2]) if e else Matrix()
def fk(R, pose):
    """pose: {'body': Matrix, bone: (rx, ry, rz) local degrees, 'feet': {L: (pos, pitch)} or None, 'hands': {L: pos} or None}"""
    W = {}
    sc = pose.get('scale') or {}; S_ = lambda b: Matrix.Diagonal((sc[b], sc[b], sc[b], 1.0)) if b in sc else Matrix()
    W['hips'] = pose.get('body', Matrix()) @ R['hips'] @ rot(pose.get('hips')) @ S_('hips')
    for b in BONES[1:]:
        par = PARENT[b]; W[b] = W[par] @ (R[par].inverted() @ R[b]) @ rot(pose.get(b)) @ S_(b)
    for s in 'LR':
        ft = pose.get('feet', {}).get(s) if pose.get('feet') else None
        if ft:
            hip = (W['hips'] @ (R['hips'].inverted() @ R['thigh_' + s])).translation
            pos, pitch = ft; a, b = R['thigh_' + s + '#len'], R['shin_' + s + '#len']
            fwd = (pose.get('body', Matrix()).to_3x3() @ V((0, -1, 0))).normalized()
            knee, an = two_bone(hip, V(pos), a, b, fwd + V((0.15 if s == 'L' else -0.15, 0, 0)))
            W['thigh_' + s] = fr(hip, knee - hip, fwd); W['shin_' + s] = fr(knee, an - knee, fwd)
            fd = Rax(pitch, (1, 0, 0)).to_3x3() @ fwd
            W['foot_' + s] = fr(an, fd, V((0, 0, 1)))
        hd = pose.get('hands', {}).get(s) if pose.get('hands') else None
        if hd:
            sh = (W['chest'] @ (R['chest'].inverted() @ R['upperarm_' + s])).translation
            a, b = R['upperarm_' + s + '#len'], R['forearm_' + s + '#len']
            el, wr = two_bone(sh, V(hd[0]), a, b, V((0.5 if s == 'L' else -0.5, 0.3, -0.8)))
            fwd = V((0, -1, 0))
            W['upperarm_' + s] = fr(sh, el - sh, fwd); W['forearm_' + s] = fr(el, wr - el, fwd)
            W['hand_' + s] = fr(wr, V(hd[1]), fwd)
    return W
def lerp_pose(A, B, u):
    out = {}
    for k in set(A) | set(B):
        a, b = A.get(k), B.get(k)
        if k == 'body': out[k] = mlerp(a or Matrix(), b or Matrix(), u)
        elif k in ('feet', 'hands', 'gun'): out[k] = b if u > 0.5 else a
        else:
            a = a or (0, 0, 0); b = b or (0, 0, 0); out[k] = tuple(x + (y - x) * u for x, y in zip(a, b))
    return out
def keyed(keys, t):
    for i in range(len(keys) - 1):
        if keys[i][0] <= t <= keys[i + 1][0]:
            u = ease((t - keys[i][0]) / max(keys[i + 1][0] - keys[i][0], 1e-6)); return lerp_pose(keys[i][1], keys[i + 1][1], u)
    return dict(keys[-1][1])
def merge(*ps):
    out = {}
    for p in ps:
        for k, v in p.items():
            if k in out and isinstance(v, tuple) and isinstance(out[k], tuple): out[k] = tuple(a + b for a, b in zip(out[k], v))
            else: out[k] = v
    return out

# ---------------------------------------------------------------- the figures
FIGS = {
    'walker':  dict(kind='walker', H=1.8, p={}, walk=dict(D=1.0, stride=0.62, duty=0.62, lift=0.10, bob=0.028, arm=16, lean=12, sway=0.03, crouch=0.02, armin=26, elbow=25),
                    atk='swipe', die=1.2, file='foe_walker', skin='enemy', tex=1024),
    'soldier': dict(kind='soldier', H=1.8, p={'tris': 4400}, walk=dict(D=0.7, stride=0.85, duty=0.40, lift=0.16, bob=0.035, arm=0, lean=12, sway=0.015, crouch=0.04),
                    die=1.2, file='soldier', skin='soldier'),
    'brute':   dict(kind='brute', H=2.5, p={'cw': 1.4, 'cd': 1.3, 'limb': 1.35, 'neck': 1.9, 'bigarm': 1.7, 'sw': 0.145, 'hw': 0.066, 'tris': 4800},
                    walk=dict(D=1.3, stride=0.85, duty=0.66, lift=0.08, bob=0.05, arm=12, lean=14, sway=0.06, crouch=0.03, armin=10, elbow=20), atk='smash', die=1.3, file='foe_brute', skin='enemy'),
    'runner':  dict(kind='runner', H=1.7, p={'cw': 0.82, 'cd': 0.85, 'limb': 0.78, 'al': 1.18, 'hand': 1.2},
                    walk=dict(D=0.5, stride=0.80, duty=0.38, lift=0.17, bob=0.04, arm=45, lean=34, sway=0.01, crouch=0.05, armin=15, elbow=60), atk='claw', die=1.2, file='foe_runner', skin='enemy'),
    'spitter': dict(kind='spitter', H=1.75, p={'cw': 0.85, 'limb': 0.75, 'al': 1.05},
                    walk=dict(D=1.1, stride=0.52, duty=0.62, lift=0.08, bob=0.025, arm=10, lean=30, sway=0.03, crouch=0.04, armin=20, elbow=40), atk='spit', die=1.2, file='foe_spitter', skin='enemy'),
    'cinder':  dict(kind='cinder', H=1.7, p={'cw': 0.9, 'limb': 0.9},
                    walk=dict(D=0.6, stride=0.85, duty=0.42, lift=0.15, bob=0.035, arm=20, lean=20, sway=0.02, crouch=0.04, armin=-30, elbow=20), atk='lunge', die=1.2, file='foe_cinder', skin='enemy'),
    'furnace': dict(kind='furnace', H=3.9, p={'cw': 1.5, 'cd': 1.35, 'limb': 1.4, 'neck': 1.6, 'sw': 0.14, 'hw': 0.07, 'belly': True, 'tris': 5000},
                    walk=dict(D=1.4, stride=1.25, duty=0.68, lift=0.07, bob=0.05, arm=8, lean=8, sway=0.06, crouch=0.025, armin=12, elbow=25), atk='slam', die=2.2, file='foe_furnace', skin='enemy', tex=1024),
}
M = 1.8      # a man: the new kinds are modelled at their size x a man
FIGS.update({
    'charger': dict(kind='charger', H=1.22 * M, p={'cw': 1.5, 'cd': 1.35, 'limb': 1.25, 'bigarm': 2.1, 'neck': 2.0, 'sw': 0.16, 'hw': 0.065, 'tris': 4800,
                    'box': ((-0.6, -0.3, -0.01), (0.5, 0.3, 1.02))},
                    walk=dict(D=1.15, stride=0.95, duty=0.62, lift=0.07, bob=0.05, arm=10, lean=40, sway=0.05, crouch=0.06, armin=12, elbow=30),
                    hold={'neck': (28, 0, 0), 'head': (-32, 0, 0)}, atk='ram', die=1.3, file='foe_charger', skin='enemy', rigid={'rebar': 'forearm_R'}),
    'leaper': dict(kind='leaper', H=0.92 * M, p={'cw': 0.72, 'cd': 0.75, 'limb': 0.7, 'al': 1.45, 'hand': 1.35, 'sw': 0.11, 'tris': 3800, 'box': ((-0.58, -0.26, -0.01), (0.58, 0.22, 1.02))},
                   walk=dict(D=0.42, stride=0.55, duty=0.45, lift=0.10, bob=0.03, pitch=55, hipz=0.36, crouch=0.04, armin=10, elbow=20), quad=True, die=1.1, file='foe_leaper', skin='enemy'),
    'bulwark': dict(kind='bulwark', H=1.10 * M, p={'cw': 1.15, 'cd': 1.1, 'limb': 1.1, 'tris': 4600, 'box': ((-0.44, -0.27, -0.01), (0.44, 0.22, 1.02))},
                    walk=dict(D=0.95, stride=0.7, duty=0.62, lift=0.09, bob=0.03, arm=14, lean=10, sway=0.03, crouch=0.03, armin=20, elbow=25),
                    hold={'upperarm_L': (45, 0, -28), 'forearm_L': (85, 0, 0)}, hold_atk=True, atk='bash', die=1.2, file='foe_bulwark', skin='enemy', rigid={'door': 'chest'}),
    'howler': dict(kind='howler', H=1.02 * M, p={'cw': 0.8, 'cd': 0.7, 'limb': 0.72, 'neck': 0.8, 'al': 1.1},
                   walk=dict(D=0.9, stride=0.66, duty=0.6, lift=0.10, bob=0.03, arm=8, lean=6, sway=0.03, crouch=0.03, armin=-30, elbow=15),
                   hold={'neck': (-22, 0, 0), 'head': (-25, 0, 0)}, atk='howl', atkD=1.4, die=1.2, file='foe_howler', skin='enemy'),
    'husk': dict(kind='husk', H=1.14 * M, p={'cw': 1.35, 'cd': 1.35, 'limb': 0.95, 'belly': True, 'bellyk': 1.15, 'neck': 1.4, 'tris': 4600, 'box': ((-0.46, -0.3, -0.01), (0.46, 0.27, 1.02))},
                 walk=dict(D=1.3, stride=0.6, duty=0.66, lift=0.07, bob=0.04, arm=10, lean=16, sway=0.07, crouch=0.04, armin=8, elbow=30),
                 atk='swipe', die=1.3, dief='burst', scale=True, file='foe_husk', skin='enemy'),
    'mite': dict(kind='mite', H=0.55 * M, p={'cw': 0.85, 'cd': 0.85, 'limb': 0.9, 'al': 1.25, 'hand': 1.2, 'head': 1.35, 'tris': 3000, 'box': ((-0.52, -0.26, -0.01), (0.52, 0.22, 1.08))},
                 walk=dict(D=0.32, stride=0.42, duty=0.42, lift=0.12, bob=0.03, pitch=72, hipz=0.36, crouch=0.04, armin=10, elbow=20), quad=True, die=0.9, file='foe_mite', skin='enemy'),
    'bloater': dict(kind='bloater', H=1.20 * M, p={'cw': 1.5, 'cd': 1.4, 'limb': 1.3, 'neck': 1.8, 'hw': 0.08, 'sw': 0.15, 'tris': 4600, 'box': ((-0.5, -0.36, -0.01), (0.5, 0.26, 1.02))},
                    walk=dict(D=1.4, stride=0.42, duty=0.68, lift=0.06, bob=0.03, arm=6, lean=-6, sway=0.14, crouch=0.03, armin=-5, elbow=20, waddle=4.0),
                    atk='smash', die=1.3, file='foe_bloater', skin='enemy'),
    'foreman': dict(kind='foreman', H=1.90 * M, p={'cw': 1.35, 'cd': 1.2, 'limb': 1.3, 'neck': 1.6, 'sw': 0.14, 'hw': 0.066, 'tris': 5200, 'box': ((-0.68, -0.28, -0.01), (0.46, 0.24, 1.04))},
                    walk=dict(D=1.45, stride=1.3, duty=0.66, lift=0.07, bob=0.05, arm=10, lean=10, sway=0.06, crouch=0.03, armin=12, elbow=20),
                    atk='hammer', atkD=1.2, die=2.0, knees=True, file='foe_foreman', skin='enemy', tex=1024, rigid={'hammer': 'hand_R'}),
    'widow': dict(kind='widow', H=1.90 * M, p={'cw': 0.8, 'cd': 0.75, 'limb': 0.7, 'al': 1.3, 'tris': 5200, 'box': ((-0.52, -0.26, -0.01), (0.52, 0.38, 1.04))},
                  walk=dict(D=1.5, stride=1.25, duty=0.6, lift=0.09, bob=0.03, arm=6, lean=14, sway=0.03, crouch=0.03, armin=15, elbow=50),
                  atk='claw', die=2.0, knees=True, file='foe_widow', skin='enemy', tex=1024, rigid={'spines': 'chest', 'sac': 'spine'}),
})
ORDER = ['walker', 'soldier', 'brute', 'runner', 'spitter', 'cinder', 'furnace', 'charger', 'leaper', 'bulwark', 'howler', 'husk', 'mite', 'bloater', 'foreman', 'widow']
def adduct(s, a): return (0, 0, -a) if s == 'L' else (0, 0, a)
def stance(J, H, crouch=0.02, spread=1.0):
    an = J['an_L'].z
    return {'body': T(0, 0, -crouch * H), 'feet': {'L': (V((J['an_L'].x * spread, -0.03 * H, an)), 0), 'R': (V((J['an_R'].x * spread, 0.04 * H, an)), 0)}}
def arms_rest(w):
    a = w.get('armin', 20); e = w.get('elbow', 20)
    return {'upperarm_L': adduct('L', a), 'upperarm_R': adduct('R', a), 'forearm_L': (e, 0, 0), 'forearm_R': (e, 0, 0)}
def walk_clip(J, R, H, w):
    D, st, du, lift = w['D'], w['stride'], w['duty'], w['lift'] * H
    leg = R['thigh_L#len'] + R['shin_L#len']; drop = leg - math.sqrt(max(leg * leg - (st / 2) ** 2, 0.01)) + 0.015 * leg
    def f(t, D_):
        ph = t / D; pose = merge(arms_rest(w)); feet = {}
        for s, off in (('L', 0.0), ('R', 0.5)):
            q = (ph + off) % 1.0
            if q < du: u = q / du; y = -st / 2 + st * u; z = 0.0; pitch = 0.0
            else:
                u = (q - du) / (1 - du); y = st / 2 - st * ease(u); z = lift * math.sin(math.pi * u); pitch = 25 * math.sin(math.pi * u) - 10 * u
            feet[s] = (V((J['an_' + s].x * 0.9, y, J['an_' + s].z + z)), pitch)
            front = -y / (st / 2)
            pose = merge(pose, {'upperarm_' + s: (-w['arm'] * front, 0, 0), 'forearm_' + s: (abs(front) * 10, 0, 0)})
        c2, s1 = math.cos(4 * math.pi * ph), math.sin(2 * math.pi * ph)
        body = T(w['sway'] * H * 0.3 * s1, 0, -drop * 0.5 * (1 + c2) - 0.012 * leg - w['crouch'] * H * 0.4) @ Rz(5 * s1) @ Ry(-3 * s1 * w.get('waddle', 1.0))
        pose = merge(pose, {'body': body, 'feet': feet, 'spine': (w['lean'] * 0.5, 0, 0), 'chest': (w['lean'] * 0.5, -7 * s1, 0), 'neck': (-w['lean'] * 0.6, 0, 0),
                            'head': (-w['lean'] * 0.3, 4 * s1, 0)})
        if w.get('armin', 0) < 0:      # arms out wide
            for s in 'LR': pose['upperarm_' + s] = tuple(a + b for a, b in zip(pose['upperarm_' + s], (20, 0, 0)))
        return pose
    return f, st / (du * D)
def idle_clip(J, R, H, w):
    base = merge(stance(J, H, w['crouch']), arms_rest(dict(w, armin=max(w.get('armin', 20), 12))), {'spine': (w['lean'] * 0.4, 0, 0), 'neck': (-w['lean'] * 0.3, 0, 0)})
    def f(t, D):
        a = 2 * math.pi * t / D; p = dict(base)
        p['body'] = base['body'] @ T(0.008 * H * math.sin(a), 0, 0.004 * H * math.sin(2 * a)) @ Rz(2 * math.sin(a))
        return merge(p, {'chest': (1.5 * math.sin(2 * a), 0, 0), 'head': (2 * math.sin(a + 1), 8 * math.sin(a), 0),
                         'upperarm_L': (3 * math.sin(2 * a), 0, 0), 'upperarm_R': (3 * math.sin(2 * a + 1), 0, 0)})
    return f
def attack_clip(J, R, H, w, kind):
    st = merge(stance(J, H, w['crouch']), arms_rest(w))
    up = lambda a, e, z=0: {'upperarm_L': (a, 0, z + 12), 'upperarm_R': (a, 0, -z - 12), 'forearm_L': (e, 0, 0), 'forearm_R': (e, 0, 0)}
    if kind == 'swipe':
        k = [(0, st), (0.30, merge(st, up(125, 45, 10), {'chest': (-15, 15, 0), 'spine': (-5, 0, 0)})),
             (0.45, merge(st, up(35, 10, 10), {'chest': (25, -15, 0), 'spine': (10, 0, 0), 'body': T(0, -0.06 * H, -0.04 * H)})),
             (0.65, merge(st, up(-10, 15, 15), {'chest': (18, -8, 0)})), (1.0, st)]
    elif kind == 'claw':
        k = [(0, st), (0.25, merge(st, up(-40, 60, 20), {'chest': (10, 0, 0), 'body': T(0, 0.05 * H, -0.08 * H)})),
             (0.45, merge(st, up(80, 10, 5), {'chest': (35, 0, 0), 'spine': (15, 0, 0), 'body': T(0, -0.25 * H, -0.05 * H)})),
             (0.7, merge(st, up(20, 30, 15), {'chest': (20, 0, 0), 'body': T(0, -0.12 * H, -0.03 * H)})), (1.0, st)]
    elif kind == 'smash':
        k = [(0, st), (0.33, merge(st, up(165, 40, 15), {'chest': (-18, 0, 0), 'spine': (-8, 0, 0), 'body': T(0, 0.03 * H, 0)})),
             (0.45, merge(st, up(50, 5, 15), {'chest': (35, 0, 0), 'spine': (15, 0, 0), 'body': T(0, -0.04 * H, -0.08 * H)})),
             (0.65, merge(st, up(45, 10, 15), {'chest': (30, 0, 0), 'spine': (12, 0, 0), 'body': T(0, -0.04 * H, -0.07 * H)})), (1.0, st)]
    elif kind == 'spit':
        k = [(0, st), (0.33, merge(st, up(-10, 30, 25), {'chest': (-25, 0, 0), 'neck': (-25, 0, 0), 'head': (-15, 0, 0), 'body': T(0, 0.04 * H, 0)})),
             (0.45, merge(st, up(10, 20, 20), {'chest': (25, 0, 0), 'neck': (30, 0, 0), 'head': (15, 0, 0), 'body': T(0, -0.05 * H, -0.02 * H)})),
             (0.6, merge(st, up(10, 20, 20), {'chest': (18, 0, 0), 'neck': (18, 0, 0)})), (1.0, st)]
    elif kind == 'lunge':
        k = [(0, st), (0.25, merge(st, up(30, 70, 30), {'chest': (5, 0, 0), 'body': T(0, 0.06 * H, -0.08 * H)})),
             (0.45, merge(st, up(95, 5, 5), {'chest': (30, 0, 0), 'spine': (10, 0, 0), 'body': T(0, -0.35 * H, -0.06 * H)})),
             (0.7, merge(st, up(60, 20, 10), {'chest': (20, 0, 0), 'body': T(0, -0.2 * H, -0.04 * H)})), (1.0, st)]
    elif kind == 'ram':        # head down, the plated arm forward, a charge
        k = [(0, st), (0.28, merge(st, {'body': T(0, 0.08 * H, -0.04 * H), 'chest': (-8, 10, 0), 'upperarm_R': (-30, 0, -10), 'forearm_R': (40, 0, 0)})),
             (0.48, merge(st, {'body': T(0, -0.5 * H, -0.06 * H), 'chest': (40, -10, 0), 'spine': (15, 0, 0), 'neck': (10, 0, 0), 'upperarm_R': (75, 0, -15), 'forearm_R': (5, 0, 0)})),
             (0.7, merge(st, {'body': T(0, -0.42 * H, -0.05 * H), 'chest': (32, -5, 0), 'spine': (12, 0, 0), 'upperarm_R': (60, 0, -10), 'forearm_R': (10, 0, 0)})), (1.0, st)]
    elif kind == 'bash':       # a shove with the shield
        k = [(0, st), (0.3, merge(st, {'body': T(0, 0.06 * H, -0.03 * H), 'chest': (-6, -18, 0)})),
             (0.48, merge(st, {'body': T(0, -0.3 * H, -0.04 * H), 'chest': (18, 20, 0), 'spine': (8, 0, 0), 'upperarm_R': (40, 0, -15), 'forearm_R': (30, 0, 0)})),
             (0.7, merge(st, {'body': T(0, -0.24 * H, -0.03 * H), 'chest': (12, 10, 0), 'spine': (6, 0, 0)})), (1.0, st)]
    elif kind == 'howl':       # head back, jaw wide, arms flung out
        k = [(0, st), (0.25, merge(st, {'chest': (12, 0, 0), 'neck': (15, 0, 0), 'head': (10, 0, 0), 'upperarm_L': (10, 0, -10), 'upperarm_R': (10, 0, 10), 'body': T(0, 0, -0.03 * H)})),
             (0.42, merge(st, {'chest': (-28, 0, 0), 'spine': (-12, 0, 0), 'neck': (-40, 0, 0), 'head': (-35, 0, 0), 'upperarm_L': (25, 0, 75), 'upperarm_R': (25, 0, -75),
                               'forearm_L': (5, 0, 0), 'forearm_R': (5, 0, 0), 'body': T(0, 0.03 * H, 0.01 * H)})),
             (0.8, merge(st, {'chest': (-26, 6, 0), 'spine': (-12, 0, 0), 'neck': (-40, 0, 0), 'head': (-38, 0, 0), 'upperarm_L': (30, 0, 80), 'upperarm_R': (30, 0, -80),
                              'body': T(0, 0.03 * H, 0.01 * H)})), (1.0, st)]
    elif kind == 'hammer':     # the sledgehammer overhead in the right hand, down in front
        k = [(0, st), (0.35, merge(st, {'upperarm_R': (175, 0, -10), 'forearm_R': (55, 0, 0), 'chest': (-14, -22, 0), 'body': T(0, 0.03 * H, 0)})),
             (0.5, merge(st, {'upperarm_R': (45, 0, -8), 'forearm_R': (5, 0, 0), 'chest': (38, 18, 0), 'spine': (14, 0, 0), 'body': T(0, -0.06 * H, -0.08 * H)})),
             (0.72, merge(st, {'upperarm_R': (40, 0, -8), 'forearm_R': (8, 0, 0), 'chest': (34, 14, 0), 'spine': (12, 0, 0), 'body': T(0, -0.06 * H, -0.07 * H)})), (1.0, st)]
    else:      # slam: two fists into the ground
        k = [(0, st), (0.30, merge(st, up(170, 30, 10), {'chest': (-15, 0, 0), 'body': T(0, 0.03 * H, 0)})),
             (0.45, merge(st, up(80, 0, 12), {'chest': (55, 0, 0), 'spine': (25, 0, 0), 'neck': (-25, 0, 0), 'body': T(0, -0.06 * H, -0.16 * H)})),
             (0.70, merge(st, up(75, 5, 12), {'chest': (50, 0, 0), 'spine': (22, 0, 0), 'neck': (-25, 0, 0), 'body': T(0, -0.06 * H, -0.15 * H)})), (1.0, st)]
    return lambda t, D: keyed(k, t / D)
def die_clip(J, R, H, w, D, knees=False):
    st = merge(stance(J, H, w['crouch']), arms_rest(w))
    piv = (0, -0.06 * H, 0.0)
    def f(t, D_):
        u = t / D
        if knees:      # furnace: down onto its knees, then forward
            a = smooth(0.05, 0.45, u); b = smooth(0.45, 0.95, u)
            body = T(0, 0, 0.05 * H * b) @ Rax(84 * b, (1, 0, 0), (0, -0.25 * H, 0.0)) @ T(0, 0.04 * H * a, -0.22 * H * a)
            pose = merge(arms_rest(w), {'body': body, 'chest': (20 * a + 10 * b, 0, 0), 'neck': (25 * b, 0, 0),
                                        'thigh_L': (85 * a - 60 * b, 0, 0), 'thigh_R': (85 * a - 60 * b, 0, 0), 'shin_L': (-95 * a + 60 * b, 0, 0), 'shin_R': (-95 * a + 60 * b, 0, 0),
                                        'upperarm_L': (40 * b, 0, -30 * b), 'upperarm_R': (40 * b, 0, 30 * b)})
            if a < 0.3: pose['feet'] = st['feet']
            return pose
        a = smooth(0.0, 0.25, u); b = smooth(0.2, 0.5, u); c = smooth(0.45, 0.9, u)
        body = T(0, 0, 0.055 * H * c) @ Rax(86 * c, (1, 0, 0), piv) @ T(0, 0.06 * H * a, -0.12 * H * b * (1 - c)) @ Rx(-12 * a * (1 - c))
        pose = merge(arms_rest(w), {'body': body, 'chest': (-15 * a + 15 * b, 10 * a, 0), 'neck': (20 * c, 0, 0), 'head': (-10 * a + 30 * c, 20 * c, 0),
                                    'thigh_L': (35 * b * (1 - c), 0, 0), 'thigh_R': (20 * b * (1 - c), 0, 0), 'shin_L': (-60 * b * (1 - c), 0, 0), 'shin_R': (-40 * b * (1 - c), 0, 0),
                                    'upperarm_L': (60 * c - 20 * a, 0, -40 * c), 'upperarm_R': (80 * c - 20 * a, 0, 30 * c), 'forearm_L': (30 * c, 0, 0)})
        if u < 0.35: pose['feet'] = st['feet']
        return pose
    return f
GUNP = {'grip': V((0, -0.015, -0.07)), 'fore': V((0, 0.16, -0.025))}
def soldier_clips(J, R, H, w):
    walkf, speed = walk_clip(J, R, H, w)
    def hands(G, pose):
        g = G @ GUNP['grip']; f = G @ GUNP['fore']
        pose['hands'] = {'R': (g, (G.to_3x3() @ V((0.2, 0.3, -1))).normalized()), 'L': (f, (G.to_3x3() @ V((0.7, 0.2, 0.6))).normalized())}
        pose['gun'] = G; return pose
    base = merge(stance(J, H, 0.02), {'spine': (5, 0, 0)})
    def idle(t, D):
        a = 2 * math.pi * t / D
        G = T(-0.05 * H / 1.8, -0.30, 0.98 + 0.004 * math.sin(2 * a)) @ Rz(180) @ Rz(-15) @ Rx(-35)
        p = merge(base, {'chest': (1.5 * math.sin(2 * a), 0, 0), 'head': (0, 8 * math.sin(a), 0)}); return hands(G, p)
    def run(t, D):
        p = walkf(t, D); ph = t / D
        G = (p['body'] @ T(0, -0.24, 1.20 + 0.04)) @ Rz(180) @ Rz(50) @ Rx(15) @ Ry(-20)
        return hands(G, p)
    def fire(t, D):
        k = math.exp(-((t % 0.2) / 0.04) ** 2) if t < D else 0
        G = T(-0.09, -0.26 + 0.012 * k, 1.42) @ Rz(180) @ Rx(-1 - 3 * k)
        p = merge(base, {'chest': (6, -10, 0), 'neck': (8, 0, 0), 'head': (8, -8, 0)}); return hands(G, p)
    die = die_clip(J, R, H, w, 1.2)
    def dief(t, D):
        p = die(t, D); u = t / D; Gi = T(-0.05, -0.30, 0.98) @ Rz(180) @ Rz(-15) @ Rx(-35)
        drop = smooth(0.2, 0.6, u); G = T(0.05 * drop, -0.35 * drop, -0.9 * drop * drop) @ Gi @ Rx(-60 * drop)
        p['gun'] = G
        if u < 0.25: hands(G, p)
        return p
    return [('idle', 2.8, idle, True), ('run', w['D'], run, True), ('fire', 0.2, fire, True), ('die', 1.2, dief, False)], speed

def quad_pose(J, R, H, w, ph, moving=True):
    """on all fours: the body pitched forward about the hips, feet and hands planted by IK, a trot (each hand with the opposite foot)"""
    st = w['stride'] if moving else 0.0; du = w['duty']; lift = w['lift'] * H; pitch = w['pitch']; hz = w['hipz'] * H; mv = 1 if moving else 0
    body = T(0, 0, hz - J['hips'].z + w.get('bob', 0.02) * H * 0.5 * math.cos(4 * math.pi * ph) * mv) @ Rax(pitch, (1, 0, 0), tuple(J['hips'])) @ Rz(4 * math.sin(2 * math.pi * ph) * mv)
    shy = -(J['sh_L'].z - J['hips'].z) * math.sin(math.radians(pitch))
    feet, hands = {}, {}
    for s, off_f, off_h in (('L', 0.0, 0.5), ('R', 0.5, 0.0)):
        for what, off, y0, xx in (('f', off_f, 0.0, J['an_' + s].x * 1.15), ('h', off_h, shy - 0.02 * H, J['sh_' + s].x * 1.2)):
            q = (ph + off) % 1.0
            if not moving: y, z, fp = (0.04 * H if (what == 'f') == (s == 'L') else -0.04 * H), 0.0, 0.0
            elif q < du: u = q / du; y = -st / 2 + st * u; z = 0.0; fp = 0.0
            else: u = (q - du) / (1 - du); y = st / 2 - st * ease(u); z = lift * math.sin(math.pi * u); fp = 20 * math.sin(math.pi * u)
            if what == 'f': feet[s] = (V((xx, y0 + y, J['an_' + s].z + z)), -pitch + fp)
            else: hands[s] = (V((xx, y0 + y, 0.03 * H + z)), V((0.0, -0.5, -1.0)).normalized())
    s1 = math.sin(2 * math.pi * ph) * mv
    return {'body': body, 'feet': feet, 'hands': hands, 'spine': (4, 0, 0), 'chest': (4, -6 * s1, 0), 'neck': (-pitch * 0.55, 0, 0), 'head': (-pitch * 0.4, 6 * s1, 0)}
def quad_walk(J, R, H, w):
    return (lambda t, D: quad_pose(J, R, H, w, t / w['D'])), w['stride'] / (w['duty'] * w['D'])
def quad_idle(J, R, H, w):
    def f(t, D):
        a = 2 * math.pi * t / D; p = quad_pose(J, R, H, w, 0.0, False)
        p['body'] = T(0, 0, 0.006 * H * math.sin(2 * a)) @ p['body']; p['chest'] = (4 + 2 * math.sin(2 * a), 0, 0); p['head'] = (p['head'][0], 12 * math.sin(a), 0)
        return p
    return f
def pounce_clip(J, R, H, w):
    st = quad_pose(J, R, H, w, 0.0, False)
    def shifted(dy):
        p = dict(st); p['feet'] = {s: (v + V((0, dy, 0)), a) for s, (v, a) in st['feet'].items()}; p['hands'] = {s: (v + V((0, dy, 0)), d) for s, (v, d) in st['hands'].items()}
        p['body'] = T(0, dy, 0) @ st['body']; return p
    crouch = dict(st); crouch['body'] = T(0, 0.08 * H, -0.06 * H) @ st['body']
    leap = {k: v for k, v in st.items() if k != 'hands'}; leap['body'] = T(0, -0.55 * H, 0.16 * H) @ Rax(-20, (1, 0, 0), tuple(J['hips'])) @ st['body']
    leap.update({'upperarm_L': (70, 0, -15), 'upperarm_R': (70, 0, 15), 'forearm_L': (20, 0, 0), 'forearm_R': (20, 0, 0), 'neck': (-w['pitch'] * 0.4, 0, 0)})
    land = shifted(-0.5 * H)
    k = [(0, st), (0.3, crouch), (0.5, leap), (0.68, land), (1.0, st)]
    return lambda t, D: keyed(k, t / D)
def quad_die(J, R, H, w, D):
    st = quad_pose(J, R, H, w, 0.0, False)
    def f(t, D_):
        u = t / D; c = smooth(0.05, 0.6, u); d = smooth(0.4, 0.95, u)
        p = {'body': T(0, 0, -0.05 * H * c) @ Rax(80 * c, (0, 1, 0), tuple(J['hips'] + V((0, 0, -0.2 * H)))) @ st['body'], 'neck': (-w['pitch'] * 0.5 + 30 * d, 0, 0), 'head': (0, 25 * d, 0),
             'thigh_L': (50 * d, 0, 0), 'thigh_R': (70 * d, 0, 0), 'shin_L': (-90 * d, 0, 0), 'shin_R': (-110 * d, 0, 0),
             'upperarm_L': (60 * d, 0, -20 * d), 'upperarm_R': (80 * d, 0, 30 * d), 'forearm_L': (70 * d, 0, 0), 'forearm_R': (90 * d, 0, 0), 'spine': (10 * d, 0, 0)}
        if u < 0.3: p['feet'] = st['feet']; p['hands'] = st['hands']
        return p
    return f
def burst_die(J, R, H, w, D):
    """the husk swells, shudders and bursts: the torso blows up and is gone (the game spawns the mites), the legs fold"""
    st = merge(stance(J, H, w['crouch']), arms_rest(w))
    def f(t, D_):
        u = t / D; a = smooth(0.0, 0.42, u); b = smooth(0.42, 0.52, u); c = smooth(0.45, 0.95, u)
        jit = 5 * math.sin(t * 70) * a * (1 - b)
        body = T(0, 0, -0.30 * H * c) @ Rax(35 * c, (1, 0, 0), (0, -0.06 * H, 0)) @ Rz(jit)
        pose = merge(arms_rest(w), {'body': body, 'chest': (-25 * a + 20 * c, jit, 0), 'neck': (-20 * a, 0, 0), 'upperarm_L': (0, 0, 45 * a), 'upperarm_R': (0, 0, -45 * a),
                                    'thigh_L': (70 * c, 0, 0), 'thigh_R': (55 * c, 0, 0), 'shin_L': (-110 * c, 0, 0), 'shin_R': (-95 * c, 0, 0)})
        pose['scale'] = {'spine': 1 + 0.45 * a - 1.2 * b, 'chest': 1 + 0.2 * a - 0.85 * b}
        if u < 0.42: pose['feet'] = st['feet']
        return pose
    return f

# ---------------------------------------------------------------- build one figure
def clean(fid):
    c = bpy.data.collections.get('f_' + fid)
    if c:
        for ob in list(c.objects): bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.images):
        for d in list(coll):
            if (d.name == fid or d.name.startswith(fid + '_')) and d.users == 0: coll.remove(d)
    for a in list(bpy.data.actions):
        if a.name.startswith(fid + '_'): bpy.data.actions.remove(a)
    if c is None: c = bpy.data.collections.new('f_' + fid); scene.collection.children.link(c)
    return c
def build_figure(fid):
    global col
    F = FIGS[fid]; H = F['H']; kind = F['kind']; p = F['p']; w = F['walk']
    col = clean(fid); J, R = skeleton(H, p)
    full = figure_mesh(fid, J, H, p, kind)
    meshes = [full, decimated(full, 1200), decimated(full, 400)]
    gunk = soldier_gun() if kind == 'soldier' else None
    lods, gunfaces = [], {}
    for li, me in enumerate(meshes):
        triangulate(me)
        if gunk:
            gm = bpy.data.meshes.new('g'); kk = soldier_gun(); kk.bm.to_mesh(gm); kk.bm.free()
            bm = bmesh.new(); bm.from_mesh(me); n0 = len(bm.faces); nv0 = len(bm.verts); bm.from_mesh(gm); bmesh.ops.triangulate(bm, faces=bm.faces[:])
            bm.to_mesh(me); bm.free(); bpy.data.meshes.remove(gm); gunfaces[li] = set(range(n0, len(me.polygons))); gv = set(range(nv0, len(me.vertices)))
        else: gv = set()
        me.name = fid if li == 0 else '%s_lod%d' % (fid, li)
        me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
        for i in gunfaces.get(li, ()): me.polygons[i].use_smooth = False
        ob = bpy.data.objects.new(me.name, me); col.objects.link(ob); atlas_uv(ob, REGIONS[li])
        co = np.array([v.co[:] for v in me.vertices], np.float32); ws = bone_weights(co, R, H); vgs = {}
        if F.get('rigid'):     # props (shield, hammer, spines...) move with one bone only
            Gv = body_groups(co, J, H, p, kind); gn = list(Gv); near = np.array(gn)[np.argmin(np.stack([Gv[g] for g in gn], 1), 1)]
            for i, g in enumerate(near):
                if g in F['rigid']: ws[i] = (F['rigid'][g], 1.0, F['rigid'][g], 0.0)
        if li == 0: CO0, WS0 = co, ws
        for i, (b1, w1, b2, w2) in enumerate(ws):
            if i in gv: b1, w1, w2 = 'gun', 1.0, 0.0
            for b, ww in ((b1, w1), (b2, w2)):
                if ww < 0.01: continue
                if b not in vgs: vgs[b] = ob.vertex_groups.new(name=b)
                vgs[b].add([i], ww, 'REPLACE')
        lods.append(ob)
        log(fid, 'lod', li, len(me.polygons), 'triangles')
    img = figure_texture(fid, lods, J, H, p, kind, gunfaces)
    mat = image_material(fid, img, 0.85, 0.0)
    for ob in lods: ob.data.materials.append(mat)
    arm = bpy.data.armatures.new(fid + '_rig'); rig = bpy.data.objects.new(fid + '_rig', arm); col.objects.link(rig)
    vl = bpy.context.view_layer
    for o in list(vl.objects):
        if o is not None: o.select_set(False)
    vl.objects.active = rig; rig.select_set(True); bpy.ops.object.mode_set(mode='EDIT')
    names = BONES + (['gun'] if gunk else [])
    for b in names:
        eb = arm.edit_bones.new(b); eb.head = (0, 0, 0); eb.tail = (0, R[b + '#len'] if b != 'gun' else 0.1, 0); eb.matrix = R[b] if b != 'gun' else Matrix(); eb.use_deform = True
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in rig.pose.bones: pb.rotation_mode = 'QUATERNION'
    rig.animation_data_create()
    for ob in lods:
        ob.parent = rig; m = ob.modifiers.new('rig', 'ARMATURE'); m.object = rig
    RR = dict(R); RR['gun'] = Matrix()
    if kind == 'soldier': clips, speed = soldier_clips(J, R, H, w)
    elif F.get('quad'):
        wf, speed = quad_walk(J, R, H, w)
        clips = [('idle', 2.4, quad_idle(J, R, H, w), True), ('walk', w['D'], wf, True), ('attack', F.get('atkD', 0.8), pounce_clip(J, R, H, w), False),
                 ('die', F['die'], quad_die(J, R, H, w, F['die']), False)]
    else:
        wf, speed = walk_clip(J, R, H, w)
        hold = F.get('hold', {}); held = lambda fn: (lambda t, D: dict(fn(t, D), **hold)) if hold else fn
        dief = burst_die(J, R, H, w, F['die']) if F.get('dief') == 'burst' else die_clip(J, R, H, w, F['die'], knees=(kind == 'furnace' or F.get('knees', False)))
        atkf = attack_clip(J, R, H, w, F['atk'])
        clips = [('idle', 2.6, held(idle_clip(J, R, H, w)), True), ('walk', w['D'], held(wf), True), ('attack', F.get('atkD', 0.8), held(atkf) if F.get('hold_atk') else atkf, False),
                 ('die', F['die'], dief, False)]
    lens = {}
    def grounded(fn, D):
        """die: the lowest point of the body ends exactly on the ground (z = 0)"""
        Wm = fk(R, fn(D, D)); RR_ = dict(RR); Wm.setdefault('gun', Matrix())
        Mb = {b: np.array(Wm[b] @ RR_[b].inverted(), np.float32) for b in Wm}
        h = np.c_[CO0, np.ones(len(CO0), np.float32)]; zmin = 1e9
        for i in range(0, len(CO0), 3):
            b1, w1, b2, w2 = WS0[i]
            if b1 == 'gun' or b2 == 'gun': continue          # the soldier's dropped carbine is not part of the body
            v = w1 * (Mb[b1] @ h[i]) + w2 * (Mb[b2] @ h[i]); zmin = min(zmin, float(v[2]))
        log(fid, 'die ends %.3f m off the ground: corrected' % zmin)
        def g(t, D_):
            pose = fn(t, D_); k = smooth(0.5 * D, D, t); pose['body'] = T(0, 0, -zmin * k) @ pose.get('body', Matrix()); return pose
        return g
    clips = [(c, D, grounded(fn, D) if c == 'die' else fn, loop) for c, D, fn, loop in clips]
    for cname, D, fn, loop in clips:
        act = bpy.data.actions.new(fid + '_' + cname); act.use_fake_user = True; rig.animation_data.action = act
        n = int(round(D * FPS)); prev = {}
        for fr_ in range(n + 1):
            pose = fn(fr_ / FPS, D); Wm = fk(R, pose)
            if gunk: Wm['gun'] = pose.get('gun', Matrix())
            for b in names:
                pb = rig.pose.bones[b]; pb.matrix_basis = RR[b].inverted() @ Wm[b]
                q = pb.rotation_quaternion.copy()
                if b in prev: q.make_compatible(prev[b])
                pb.rotation_quaternion = q; prev[b] = q
                pb.keyframe_insert('location', frame=fr_, group=b); pb.keyframe_insert('rotation_quaternion', frame=fr_, group=b)
                if F.get('scale'): pb.keyframe_insert('scale', frame=fr_, group=b)
        lens[cname] = n / FPS
    use(rig, fid + '_idle'); scene.frame_set(0)
    sk = F['skin']; names_as = {fid: sk, fid + '_lod1': sk + '_lod1', fid + '_lod2': sk + '_lod2'}
    cfg = {'blend': 'figures.blend', 'out': '../../Ashfall/assets/' + F['file'], 'maxTexture': F.get('tex', 512),
           'skins': [{'name': sk, 'rig': fid + '_rig', 'lods': [fid, fid + '_lod1', fid + '_lod2'], 'as': names_as,
                      'clips': {c: dict({'action': fid + '_' + c}, **({'loop': True} if loop else {})) for c, D, fn, loop in clips}}]}
    with open(os.path.join(BASE, F['file'] + '.export.json'), 'w') as f: json.dump(cfg, f, indent=1)
    log(fid, 'done; clips', {k: round(v, 3) for k, v in lens.items()}, 'speed %.2f m/s' % speed, 'tris', [len(o.data.polygons) for o in lods])
    return {'rig': rig, 'lods': lods, 'H': H, 'clips': lens, 'speed': speed}
def use(rig, name):
    act = bpy.data.actions[name]; rig.animation_data.action = act
    if hasattr(rig.animation_data, 'action_slot') and len(act.slots): rig.animation_data.action_slot = act.slots[0]

# ---------------------------------------------------------------- run
col = bpy.data.collections.get('_work') or bpy.data.collections.new('_work')
if col.name not in scene.collection.children: scene.collection.children.link(col)
todo = [f for f in ORDER if 'only' not in OPT or f in OPT['only'].split(',')]
built = {f: build_figure(f) for f in todo}
if 'nosave' not in OPT: bpy.ops.wm.save_mainfile(); log('saved', bpy.data.filepath)

def previews(fid, info, what):
    rig, ob = info['rig'], info['lods'][0]; H = info['H']
    sc = bpy.data.scenes.new('fg_preview')
    for o in (rig, ob): sc.collection.objects.link(o)
    sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'TEXTURE'
    cd = bpy.data.cameras.new('fg_cam'); cam = bpy.data.objects.new('fg_cam', cd); sc.collection.objects.link(cam); sc.camera = cam
    cd.sensor_fit = 'VERTICAL'; cd.angle_y = math.radians(35)
    def grid(cells, cols, out, w=320, h=400):
        rows = (len(cells) + cols - 1) // cols; big = np.ones((rows * h, cols * w, 4), np.float32)
        for i, (act, f, view) in enumerate(cells):
            use(rig, fid + '_' + act); scene.frame_set(f); sc.frame_set(f)
            d = 1.75 * H; tg = V((0, 0, 0.5 * H))
            pos = {'front': V((0.25 * d, -d, 0.55 * H)), 'side': V((d, -0.15 * d, 0.55 * H)), 'back': V((-0.3 * d, d, 0.6 * H))}[view]
            cam.location = pos; cam.rotation_euler = (tg - pos).to_track_quat('-Z', 'Y').to_euler()
            sc.render.resolution_x, sc.render.resolution_y = w, h; tmp = os.path.join(CACHE, '_fc%d.png' % i); sc.render.filepath = tmp
            bpy.ops.render.render(write_still=True, scene=sc.name)
            im = bpy.data.images.load(tmp); a = np.array(im.pixels[:], np.float32).reshape(h, w, 4); bpy.data.images.remove(im); os.remove(tmp)
            r, c = divmod(i, cols); big[(rows - 1 - r) * h:(rows - r) * h, c * w:(c + 1) * w] = a
        im = bpy.data.images.new('fg_grid', cols * w, rows * h); im.pixels.foreach_set(big.ravel())
        im.filepath_raw = os.path.join(CACHE, out); im.file_format = 'PNG'; im.save(); bpy.data.images.remove(im); log('preview', out)
    cl = list(info['clips'])
    mv = cl[1]; at = cl[2]
    nf = lambda c: int(round(info['clips'][c] * FPS))
    for wv in what:
        if wv == 'pose': grid([('idle', 0, 'front'), ('idle', 0, 'side'), ('idle', 0, 'back')], 3, fid + '_pose.png')
        elif wv == 'move': grid([(mv, round(nf(mv) * k / 6.0), 'side') for k in range(6)], 6, fid + '_move.png', 240, 300)
        elif wv == 'act': grid([(at, round(nf(at) * k / 4.0), 'front') for k in range(5)] + [('die', nf('die'), 'side')], 6, fid + '_act.png', 240, 300)
    bpy.data.scenes.remove(sc); bpy.data.objects.remove(cam); bpy.data.cameras.remove(cd)
if 'preview' in OPT:
    for f in todo: previews(f, built[f], OPT['preview'].split(','))
log('done')
