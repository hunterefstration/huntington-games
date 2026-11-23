# ASHFALL weapon set: first-person gloved arms + one gun per weapon, rigged and animated, in art/ashfall/weapons.blend.
#   blender -b art/ashfall/weapons.blend -P tools/blender/make_weapons.py -- [only=carbine,pistol] [preview=hold,aim,reload,clips]
#   (first time, with no file: blender -b --factory-startup -P tools/blender/make_weapons.py  creates art/ashfall/weapons.blend)
# then  node tools/export-art.mjs w_carbine w_pistol ...  writes Ashfall/assets/w_<id>.hgm (+ pictures).
# The .blend is not in git: this script is the source. Per weapon it deletes and rebuilds its own things (collection w_<id>:
# <id>_rig, <id>_arms, <id>_gun, actions <id>_vm_*, material/picture <id>_gun), writes art/ashfall/w_<id>.export.json and
# rewrites Ashfall/assets/weapons.json from every weapon in the file. The arms are the Proof Slice arms (make_viewmodel.py):
# a signed distance field meshed with surface nets, fingers closed onto the gun until they touch. Guns other than the carbine
# are modelled here from boxes, extruded side profiles, lathed tubes and swept rods; their pictures are computed per texel
# (material, wear on the bevels, grain, ambient occlusion by ray casting).
import bpy, bmesh, math, os, sys, time, json, shutil
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

T0 = time.time()
def log(*a): print('[wp %5.1fs]' % (time.time() - T0), *a, flush=True)
ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OPT = dict((a.split('=', 1) + ['1'])[:2] for a in ARGV)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = os.path.join(ROOT, 'art', 'ashfall')
TEXDIR = os.path.join(BASE, 'tex'); CACHE = os.path.join(BASE, '_cache')
OUTDIR = os.path.join(ROOT, 'Ashfall', 'assets')
SHOOTER = os.path.join(ROOT, 'art', 'proof', 'shooter.blend')
for d in (TEXDIR, CACHE, OUTDIR): os.makedirs(d, exist_ok=True)
scene = bpy.context.scene
if not bpy.data.filepath.replace('\\', '/').endswith('art/ashfall/weapons.blend'):
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    scene.render.fps = 30; scene.render.fps_base = 1.0
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, 'weapons.blend'))
    log('created', bpy.data.filepath)
FPS = scene.render.fps / scene.render.fps_base
ARM_TRIS = 4400
TEXN = 1024
ORDER = ['carbine', 'pistol', 'shotgun', 'smg', 'sniper', 'lmg', 'revolver', 'dmr', 'rpg', 'minigun', 'knife', 'burst', 'lever', 'autoshot', 'gl', 'flamer', 'crossbow', 'machete']

# ---------------------------------------------------------------- small math
def fr(head, ydir, zdir):
    y = Vector(ydir).normalized(); z = Vector(zdir); z = (z - z.dot(y) * y).normalized(); x = y.cross(z)
    return Matrix(((x[0], y[0], z[0], head[0]), (x[1], y[1], z[1], head[1]), (x[2], y[2], z[2], head[2]), (0, 0, 0, 1)))
def Rx(a): return Matrix.Rotation(math.radians(a), 4, 'X')
def Ry(a): return Matrix.Rotation(math.radians(a), 4, 'Y')
def Rz(a): return Matrix.Rotation(math.radians(a), 4, 'Z')
def Rax(a, axis, pivot=(0, 0, 0)): return T(*pivot) @ Matrix.Rotation(math.radians(a), 4, Vector(axis)) @ T(*(-Vector(pivot)))
def T(x, y, z): return Matrix.Translation((x, y, z))
S4 = Matrix.Diagonal((-1, 1, 1, 1))
def mirror(M): return S4 @ M @ S4
def cm2m(M): M = M.copy(); M.translation = M.translation * 0.01; return M
def smooth(a, b, x):
    t = min(max((x - a) / (b - a), 0.0), 1.0); return t * t * (3 - 2 * t)
def ease(t): t = min(max(t, 0.0), 1.0); return t * t * t * (t * (t * 6 - 15) + 10)
def lerp(a, b, t): return a + (b - a) * t
def mlerp(A, B, t):
    la, ra, _ = A.decompose(); lb, rb, _ = B.decompose()
    if ra.dot(rb) < 0: rb = -rb
    M = ra.slerp(rb, t).to_matrix().to_4x4(); M.translation = la.lerp(lb, t); return M
def bump(t, c, w): return math.exp(-((t - c) / w) ** 2)
def game(v): return [round(v[0], 4), round(v[2], 4), round(-v[1], 4)]
def gamedir(v): v = Vector(v).normalized(); return [round(v[0], 3), round(v[2], 3), round(-v[1], 3)]
col = None

FLAT = 0.86          # finger thickness / width
FINGER_DEF = [  # name, MCP joint, spread toward thumb (deg), lengths, radii (start, end) per bone, rest curl per joint
    ('index',  (-2.85, 9.30, -0.35),   8, (3.95, 2.35, 1.95), ((.95, .88), (.87, .80), (.78, .69)), (12, 22, 10)),
    ('middle', (-0.95, 9.75, -0.20),   2, (4.25, 2.7, 2.0), ((.96, .89), (.88, .81), (.79, .70)), (14, 24, 10)),
    ('ring',   ( 0.95, 9.35, -0.30),  -6, (4.0, 2.6, 1.95), ((.92, .85), (.84, .77), (.75, .67)), (16, 26, 11)),
    ('pinky',  ( 2.70, 8.40, -0.60), -15, (3.2, 1.95, 1.75), ((.84, .77), (.76, .69), (.69, .61)), (18, 28, 12)),
]
THUMB_DEF = ('thumb', (-1.85, 1.9, -1.15), (-0.55, 0.74, -0.40), (-0.72, 0.05, 0.69), (4.3, 3.1, 2.6),
             ((1.30, 1.06), (1.06, .97), (.95, .82)), (0, 14, 16))
META_BASE = {'index': (-1.5, 2.0, -0.1), 'middle': (-0.4, 2.0, 0.1), 'ring': (0.65, 2.0, 0.0), 'pinky': (1.7, 1.8, -0.3)}
KNUCKLE_R = {'index': 1.0, 'middle': 1.02, 'ring': 0.96, 'pinky': 0.86}
FORE_LEN = 26.0
CHAINS = []
for name, mcp, spread, L, R, rest in FINGER_DEF:
    s, p = math.radians(spread), math.radians(4)
    F0 = fr(mcp, (-math.sin(s) * math.cos(p), math.cos(s) * math.cos(p), -math.sin(p)), (0, 0, 1))
    F1 = F0 @ Rx(-rest[0]); F2 = F1 @ T(0, L[0], 0) @ Rx(-rest[1]); F3 = F2 @ T(0, L[1], 0) @ Rx(-rest[2])
    CHAINS.append({'name': name, 'F': [F1, F2, F3], 'L': L, 'R': R, 'rest': rest, 'w': (0.8, 0.5, 0.4)})
_n, _cmc, _d, _z, _L, _R, _rest = THUMB_DEF
_F1 = fr(_cmc, _d, _z) @ Rx(-_rest[0]); _F2 = _F1 @ T(0, _L[0], 0) @ Rx(-_rest[1]); _F3 = _F2 @ T(0, _L[1], 0) @ Rx(-_rest[2])
CHAINS.append({'name': 'thumb', 'F': [_F1, _F2, _F3], 'L': _L, 'R': _R, 'rest': _rest, 'w': (1.2, 0.6, 0.45)})
CH = {c['name']: c for c in CHAINS}
FINGERS = [c['name'] for c in CHAINS]

# ---------------------------------------------------------------- signed distance field of one (right) arm, cm
def loc(P, F):
    R = np.array(F.to_3x3(), np.float32); t = np.array(F.translation, np.float32)
    return (P - t) @ R
def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h)
def sd_rcone(q, r1, r2, h):          # along local +y from 0 to h
    b = (r1 - r2) / h; a = math.sqrt(max(1 - b * b, 1e-6))
    qx = np.sqrt(q[:, 0] ** 2 + q[:, 2] ** 2); qy = q[:, 1]
    k = -b * qx + a * qy
    d1 = np.sqrt(qx * qx + qy * qy) - r1; d2 = np.sqrt(qx * qx + (qy - h) ** 2) - r2; d3 = a * qx + b * qy - r1
    return np.where(k < 0, d1, np.where(k > a * h, d2, d3))
def sd_ell(q, r):
    r = np.array(r, np.float32); k0 = np.linalg.norm(q / r, axis=1); k1 = np.linalg.norm(q / (r * r), axis=1)
    return k0 * (k0 - 1) / np.maximum(k1, 1e-6)
def sd_rbox(q, b, r):
    d = np.abs(q) - np.array(b, np.float32)
    return np.linalg.norm(np.maximum(d, 0), axis=1) + np.minimum(d.max(axis=1), 0) - r
def sd_tube(P, y0, y1, rx, rz, cz, edge):      # elliptic tube along y from y0 (top) to y1 < y0, rx/rz/cz arrays or floats
    x, y, z = P[:, 0], P[:, 1], P[:, 2] - cz
    e = np.sqrt((x / rx) ** 2 + (z / rz) ** 2); dr = (e - 1) * np.minimum(rx, rz)
    dy = np.maximum(y - y0, y1 - y)
    wx, wy = dr + edge, dy + edge
    return np.minimum(np.maximum(wx, wy), 0) + np.sqrt(np.maximum(wx, 0) ** 2 + np.maximum(wy, 0) ** 2) - edge
def seg_frame(a, b): return fr(a, Vector(b) - Vector(a), (0, 0, 1))
def chain_sd(P, c, pad=True):
    d = None
    for k in range(3):
        F = c['F'][k]; q = loc(P, F); L = c['L'][k]; r1, r2 = c['R'][k]
        h = L - r2 if k == 2 else L
        qq = q.copy(); qq[:, 2] /= FLAT
        dk = sd_rcone(qq, r1, r2, h) * (0.5 + 0.5 * FLAT)
        if k > 0:
            jb = np.linalg.norm(q - np.array((0, 0, 0.22 * r1), np.float32), axis=1) - r1 * 0.9
            dk = smin(dk, jb, 0.25)
        d = dk if d is None else smin(d, dk, 0.22)
    if pad:
        k = 1 if c['name'] == 'thumb' else 0
        q = loc(P, c['F'][k]); r1 = c['R'][k][0]
        pd = sd_ell(q - np.array((0, 0.52 * c['L'][k], r1 * FLAT * 0.93), np.float32), (0.62 * r1, 0.27 * c['L'][k], 0.2))
        d = smin(d, pd, 0.1)
    return d
def pad_sd(P, c):
    k = 1 if c['name'] == 'thumb' else 0
    q = loc(P, c['F'][k]); r1 = c['R'][k][0]
    return sd_ell(q - np.array((0, 0.52 * c['L'][k], r1 * FLAT * 0.93), np.float32), (0.62 * r1, 0.27 * c['L'][k], 0.2))
def palm_sd(P):
    ds = []
    ds.append(sd_ell(P - np.array((0, 1.2, -0.45), np.float32), (2.75, 2.0, 1.65)))
    q = P - np.array((0, 5.6, -0.62), np.float32); q = q.copy()
    q[:, 0] /= 0.84 + 0.16 * np.clip((P[:, 1] - 2.0) / 7.5, 0, 1)
    ds.append(sd_rbox(q, (2.75, 3.3, 0.55), 0.82))
    for name, mcp, *_ in FINGER_DEF:
        a, b = Vector(META_BASE[name]), Vector(mcp) + Vector((0, -0.1, -0.15))
        qq = loc(P, seg_frame(a, b)); qq[:, 2] /= 0.85
        ds.append(sd_rcone(qq, 1.0, 0.92, (b - a).length) * 0.92)
        ds.append(np.linalg.norm(P - np.array(Vector(mcp) + Vector((0, -0.15, 0.05)), np.float32), axis=1) - KNUCKLE_R[name])
    th = fr((-2.25, 3.7, -1.35), (-0.45, 0.89, 0), (0, 0, 1))
    ds.append(sd_ell(loc(P, th), (1.45, 2.55, 1.25)))
    ds.append(sd_ell(P - np.array((2.45, 4.4, -1.05), np.float32), (1.2, 3.0, 1.15)))
    qq = loc(P, seg_frame((-2.7, 8.4, -1.45), (2.5, 7.6, -1.5))); ds.append(sd_rcone(qq, 0.85, 0.75, 5.26))
    ds.append(sd_tube(P, 1.2, -9.0, 2.65, 1.85, -0.35, 1.0))
    d = ds[0]
    for e in ds[1:]: d = smin(d, e, 1.0)
    return d
def cuff_parts(P):
    band = sd_tube(P, -0.6, -7.5, 3.0, 2.22, -0.35, 0.3)
    strap = sd_tube(P, -1.5, -3.7, 3.13, 2.35, -0.35, 0.12)
    tab = sd_rbox(P - np.array((1.0, -2.6, -0.35 + 2.33), np.float32), (1.25, 1.0, 0.1), 0.12)
    return band, strap, tab
def guard_sd(P):
    d = None
    for name, mcp, *_ in FINGER_DEF:
        c = Vector(mcp) + Vector((0, -0.3, 1.02))
        e = sd_ell(P - np.array(c, np.float32), (1.02, 1.3, 0.38))
        d = e if d is None else smin(d, e, 0.5)
    return d
def sleeve_parts(P):
    y = P[:, 1]; u = np.maximum(-y - 5.2, 0)
    rx = 3.85 + 0.055 * u; rz = 3.25 + 0.06 * u; cz = -0.35 - 0.02 * u
    th = np.arctan2(P[:, 2] - cz, P[:, 0])
    env = np.clip((u - 2.5) / 3, 0, 1) * np.clip((28 - u) / 6, 0, 1)
    fold = 0.21 * env * np.sin(2 * np.pi * u / 4.8 + 1.4 * np.sin(th) + 0.6 * np.cos(2 * th))
    fold += 0.12 * env * np.sin(2 * np.pi * (u + 1.6 * th) / 7.5)
    fold += 0.18 * np.clip((u - 13) / 4, 0, 1) * np.clip((24 - u) / 3, 0, 1) * np.clip(-np.sin(th), 0, 1) * np.sin(2 * np.pi * u / 2.6)
    body = sd_tube(P, -5.2, -34.0, rx, rz, cz, 0.35) - fold
    hem = sd_tube(P, -5.2, -8.4, 3.85 + 0.25 + 0.055 * u, 3.25 + 0.25 + 0.06 * u, cz, 0.28)
    return body, hem
GROUPS = ['palm', 'thumb', 'index', 'middle', 'ring', 'pinky', 'cuff', 'guard', 'sleeve']
def groups_sd(P, hand=True, sleeve=True):
    big = np.full(len(P), 50.0, np.float32); G = {}
    if hand:
        G['palm'] = palm_sd(P)
        for c in CHAINS: G[c['name']] = chain_sd(P, c)
        b, s, t = cuff_parts(P); G['cuff'] = smin(np.minimum(b, s), t, 0.08)
        G['guard'] = guard_sd(P)
    else:
        for g in GROUPS[:-1]: G[g] = big
    if sleeve:
        b, h = sleeve_parts(P); G['sleeve'] = np.minimum(b, h)
    else: G['sleeve'] = big
    return G
def combine(G):
    D = None
    for c in CHAINS:
        e = smin(G['palm'], G[c['name']], 1.1 if c['name'] == 'thumb' else 0.8)
        D = e if D is None else np.minimum(D, e)
    D = smin(D, G['cuff'], 0.35)
    D = smin(D, G['guard'], 0.12)
    return np.minimum(D, G['sleeve'])

def surface_nets(F, org, h):
    nx, ny, nz = F.shape; s = F < 0
    cs = np.zeros((nx - 1, ny - 1, nz - 1, 3), np.float32); cn = np.zeros((nx - 1, ny - 1, nz - 1), np.float32)
    I, J, K = np.meshgrid(np.arange(nx, dtype=np.float32), np.arange(ny, dtype=np.float32), np.arange(nz, dtype=np.float32), indexing='ij')
    em = []
    for ax in range(3):
        a0 = [slice(None)] * 3; a1 = [slice(None)] * 3; a0[ax] = slice(0, -1); a1[ax] = slice(1, None); a0, a1 = tuple(a0), tuple(a1)
        f0, f1 = F[a0], F[a1]; m = s[a0] != s[a1]
        t = np.where(m, f0 / np.where(m, f0 - f1, 1), 0).astype(np.float32)
        pos = np.stack([I[a0], J[a0], K[a0]], -1); pos[..., ax] += t
        oth = [d for d in range(3) if d != ax]
        for d1 in (0, 1):
            for d2 in (0, 1):
                sl = [slice(None)] * 3
                sl[oth[0]] = slice(d1, d1 + F.shape[oth[0]] - 1); sl[oth[1]] = slice(d2, d2 + F.shape[oth[1]] - 1); sl = tuple(sl)
                mm = m[sl]; cn += mm; cs += pos[sl] * mm[..., None]
        em.append((m, s[a0]))
    act = cn > 0
    vid = np.full(cn.shape, -1, np.int64); vid[act] = np.arange(act.sum())
    verts = cs[act] / cn[act][:, None] * h + np.array(org, np.float32)
    quads = []
    for ax, (m, lo_in) in enumerate(em):
        i, j, k = np.nonzero(m)
        if ax == 0:
            ok = (j >= 1) & (j <= ny - 2) & (k >= 1) & (k <= nz - 2); i, j, k = i[ok], j[ok], k[ok]
            q = np.stack([vid[i, j - 1, k - 1], vid[i, j, k - 1], vid[i, j, k], vid[i, j - 1, k]], 1)
        elif ax == 1:
            ok = (i >= 1) & (i <= nx - 2) & (k >= 1) & (k <= nz - 2); i, j, k = i[ok], j[ok], k[ok]
            q = np.stack([vid[i - 1, j, k - 1], vid[i - 1, j, k], vid[i, j, k], vid[i, j, k - 1]], 1)
        else:
            ok = (i >= 1) & (i <= nx - 2) & (j >= 1) & (j <= ny - 2); i, j, k = i[ok], j[ok], k[ok]
            q = np.stack([vid[i - 1, j - 1, k], vid[i, j - 1, k], vid[i, j, k], vid[i - 1, j, k]], 1)
        flip = ~lo_in[i, j, k]
        q[flip] = q[flip][:, ::-1]
        quads.append(q)
    return verts, np.concatenate(quads)

def build_arm_mesh():
    h = float(OPT.get('grid', 0.2))
    xs = np.arange(-9.5, 7.5 + h / 2, h, dtype=np.float32); ys = np.arange(-35.0, 21.5 + h / 2, h, dtype=np.float32)
    zs = np.arange(-7.0, 6.2 + h / 2, h, dtype=np.float32)
    F = np.full((len(xs), len(ys), len(zs)), 50.0, np.float32)
    def pts(ysub):
        X, Y, Z = np.meshgrid(xs, ysub, zs, indexing='ij'); return np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
    jh = int(np.searchsorted(ys, -10.0)); js = int(np.searchsorted(ys, -3.5))
    Gs = groups_sd(pts(ys[:js]), hand=False); Fs = combine(Gs).reshape(len(xs), js, len(zs))
    Gh = groups_sd(pts(ys[jh:]), sleeve=True); Fh = combine(Gh).reshape(len(xs), len(ys) - jh, len(zs))
    F[:, :js, :] = Fs; F[:, jh:, :] = np.minimum(F[:, jh:, :], Fh)
    log('field', F.shape)
    v, q = surface_nets(F, (xs[0], ys[0], zs[0]), h)
    log('surface nets', len(v), 'verts', len(q), 'quads')
    me = bpy.data.meshes.new('vm_tmp'); me.from_pydata((v * 0.01).tolist(), [], q.tolist())
    ob = bpy.data.objects.new('vm_tmp', me); col.objects.link(ob)
    m1 = ob.modifiers.new('s', 'SMOOTH'); m1.factor = 0.5; m1.iterations = 3
    m2 = ob.modifiers.new('d', 'DECIMATE'); m2.ratio = ARM_TRIS / (2.0 * len(q))
    dg = bpy.context.evaluated_depsgraph_get()
    me2 = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob, do_unlink=True); bpy.data.meshes.remove(me)
    bm = bmesh.new(); bm.from_mesh(me2); bmesh.ops.triangulate(bm, faces=bm.faces[:]); bm.to_mesh(me2); bm.free()
    ob = bpy.data.objects.new('vm_tmp', me2); col.objects.link(ob)
    vl = bpy.context.view_layer
    for o in list(vl.objects):
        if o is not None: o.select_set(False)
    vl.objects.active = ob; ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.006)
    bpy.ops.object.mode_set(mode='OBJECT')
    n = len(me2.vertices); co = np.empty(n * 3, np.float32); me2.vertices.foreach_get('co', co); co = co.reshape(-1, 3) * 100
    nl = len(me2.loops); lv = np.empty(nl, np.int64); me2.loops.foreach_get('vertex_index', lv)
    uv = np.empty(nl * 2, np.float32); me2.uv_layers.active.data.foreach_get('uv', uv)
    ls = np.empty(len(me2.polygons), np.int64); me2.polygons.foreach_get('loop_start', ls)
    tri_l = ls[:, None] + np.arange(3)[None, :]
    tris = lv[tri_l]; tuv = uv.reshape(-1, 2)[tri_l]
    bpy.data.objects.remove(ob, do_unlink=True); bpy.data.meshes.remove(me2)
    log('arm mesh', n, 'verts', len(tris), 'tris')
    return co, tris, tuv

# ---------------------------------------------------------------- weights (per vertex, at most two bones)
def chain_weight(p, c, prev, prev_dir):
    J = [Vector(F.translation) for F in c['F']]; Y = [Vector(F.col[1][:3]) for F in c['F']]
    L = list(c['L'])
    best, kb = 1e9, 0
    for k in range(3):
        t = min(max((p - J[k]).dot(Y[k]), 0), L[k]); d = (p - J[k] - Y[k] * t).length - c['R'][k][0]
        if d < best: best, kb = d, k
    nm = lambda k: '%s%d' % (c['name'], k + 1)
    a_head = (p - J[kb]).dot(((prev_dir if kb == 0 else Y[kb - 1]) + Y[kb]).normalized())
    w = c['w'][kb]
    if a_head < w:
        wc = smooth(-w, w, a_head); return [(nm(kb), wc), (prev if kb == 0 else nm(kb - 1), 1 - wc)]
    if kb < 2:
        w = c['w'][kb + 1]; a_tail = (p - J[kb + 1]).dot((Y[kb] + Y[kb + 1]).normalized())
        if a_tail > -w:
            wc = smooth(-w, w, a_tail); return [(nm(kb + 1), wc), (nm(kb), 1 - wc)]
    return [(nm(kb), 1.0)]
def arm_weights(co):
    G = groups_sd(co.astype(np.float32))
    part = np.argmin(np.stack([G[g] for g in GROUPS], 1), 1)
    HY = Vector((0, 1, 0)); out = []
    for i, p in enumerate(co):
        p = Vector(p); g = GROUPS[part[i]]
        if g == 'sleeve': out.append([('forearm', 1.0)]); continue
        if g in ('cuff',):
            w = smooth(-2.2, 0.6, p.y); out.append([('hand', w), ('forearm', 1 - w)]); continue
        if g == 'guard': out.append([('hand', 1.0)]); continue
        if g in FINGERS:
            out.append(chain_weight(p, CH[g], 'hand', HY if g != 'thumb' else Vector(CH['thumb']['F'][0].col[1][:3]))); continue
        # palm: wrist, then the finger bases (MCP), then the thumb ball
        if p.y < 1.0:
            w = smooth(-2.2, 0.6, p.y); out.append([('hand', w), ('forearm', 1 - w)]); continue
        best = None
        for c in CHAINS[:4]:
            J0 = Vector(c['F'][0].translation); Y0 = Vector(c['F'][0].col[1][:3])
            a = (p - J0).dot((HY + Y0).normalized()); lat = abs((p - J0).x)
            if a > -c['w'][0] and (best is None or lat < best[0]): best = (lat, c, a)
        if best:
            wc = smooth(-best[1]['w'][0], best[1]['w'][0], best[2]); out.append([(best[1]['name'] + '1', wc), ('hand', 1 - wc)]); continue
        c = CH['thumb']; J0 = Vector(c['F'][0].translation); Y0 = Vector(c['F'][0].col[1][:3])
        t = min(max((p - J0).dot(Y0), 0), c['L'][0]); d = (p - J0 - Y0 * t).length
        wt = 0.75 * (1 - smooth(c['R'][0][0] - 0.3, c['R'][0][0] + 1.0, d)) * smooth(-0.5, 1.0, t)
        out.append([('thumb1', wt), ('hand', 1 - wt)] if wt > 0.01 else [('hand', 1.0)])
    return out, part

# ---------------------------------------------------------------- forward kinematics for the fingers (vm space, metres)
CHM = {side: {c['name']: [cm2m(F if side == 'R' else mirror(F)) for F in c['F']] for c in CHAINS} for side in 'RL'}
def chain_fk(H, side, name, ang):
    c = CH[name]; Fm = CHM[side][name]; sg = 1 if side == 'R' else -1
    c1, c2, c3 = ang[:3]; ds = ang[3] if len(ang) > 3 else 0.0
    M1 = H @ Fm[0] @ Rz(sg * ds) @ Rx(-(c1 - c['rest'][0]))
    M2 = M1 @ T(0, c['L'][0] * 0.01, 0) @ Rx(-c2)
    M3 = M2 @ T(0, c['L'][1] * 0.01, 0) @ Rx(-c3)
    return [M1, M2, M3]
def seg_points(M, c, k, n=5):
    L = c['L'][k] * 0.01; r1, r2 = c['R'][k]; h = L - r2 * 0.01 if k == 2 else L
    out = []
    for i in range(n):
        t = i / (n - 1); out.append((M @ Vector((0, h * t, 0)), (r1 + (r2 - r1) * t) * 0.01))
    return out
def collides(Ms, c, ks, bvh, margin=0.0008):
    for k in ks:
        for p, r in seg_points(Ms[k], c, k):
            if bvh.find_nearest(p, r * 0.9 + margin)[0] is not None: return True
    return False
def close_chain(H, side, name, bvh, start, maxc=(95, 110, 80), step=1.0, ds=0.0, ratio=(1.0, 1.2, 0.8)):
    """close all three joints together; a bone that touches stops (with the ones before it), the rest keep closing"""
    c = CH[name]; a = list(start) + [ds]
    while collides(chain_fk(H, side, name, a), c, (0, 1, 2), bvh) and a[0] > -20:
        a[0] -= 2; a[1] = max(a[1] - 3, 0); a[2] = max(a[2] - 2, 0)
    frozen = [False] * 3
    for it in range(300):
        act = [k for k in range(3) if not frozen[k] and a[k] < maxc[k]]
        if not act: break
        old = list(a)
        for k in act: a[k] = min(a[k] + step * ratio[k], maxc[k])
        Ms = chain_fk(H, side, name, a)
        hit = [k for k in range(3) if collides(Ms, c, (k,), bvh)]
        if hit:
            km = max(hit)
            for k in range(3): a[k] = old[k]
            for k in range(km + 1): frozen[k] = True
    return tuple(a)
PALM_LOCAL = []      # palm surface points of the right hand (arm frame, metres), filled once the mesh exists
def palm_hits(H, side, bvh, clear, roots=True):
    for p in PALM_LOCAL:
        q = Vector((-p.x, p.y, p.z)) if side == 'L' else p
        if bvh.find_nearest(H @ q, clear)[0] is not None: return True
    for c in (CHAINS[:4] if roots else []):              # the finger roots too
        F = c['F'][0]
        for t in (0.0, 0.8):
            p = F @ Vector((0, t, 0)) * 0.01
            if side == 'L': p.x = -p.x
            if bvh.find_nearest(H @ p, c['R'][0][0] * 0.009 + clear)[0] is not None: return True
    return False
def settle(H, side, bvh, direction=None, clear=0.0015, roots=True):
    """slide the hand along `direction` (default: the way its palm faces) from 4 cm off until the palm touches"""
    d = (Vector(direction) if direction is not None else -H.col[2].to_3d()).normalized()
    M = T(*(-d * 0.04)) @ H
    for i in range(80):
        N = T(*(d * 0.001)) @ M
        if palm_hits(N, side, bvh, clear, roots): break
        M = N
    return M
TOGETHER = {'index': -11.0, 'middle': 0.0, 'ring': 8.0, 'pinky': 17.0}   # spread change that closes the gaps between the fingers
def grasp(H, side, bvh, start=(22, 30, 14), thumb_start=(-10, 0, 0), skip=(), maxc=None):
    out = {}
    for n in FINGERS:
        if n in skip: continue
        if n == 'thumb': out[n] = close_chain(H, side, n, bvh, thumb_start, (55, 70, 80))
        else: out[n] = close_chain(H, side, n, bvh, start, maxc or (95, 110, 80), ds=TOGETHER[n])
    return out

# ---------------------------------------------------------------- the hold
def place(local_cm, target, ydir, zdir, side):
    R = fr((0, 0, 0), ydir, zdir); lp = Vector(local_cm) * 0.01
    if side == 'L': lp.x = -lp.x
    R.translation = Vector(target) - R.to_3x3() @ lp; return R
def reach(H, side, name, target, bvh, r1, r2, r3, rs, margin=0.0006):
    """the collision-free pose whose finger tip comes closest to `target`"""
    c = CH[name]; best = None; tgt = Vector(target)
    for c1 in r1:
        for ds in rs:
            for c2 in r2:
                for c3 in r3:
                    a = (c1, c2, c3, ds); Ms = chain_fk(H, side, name, a)
                    e = (Ms[2] @ Vector((0, c['L'][2] * 0.01, 0)) - tgt).length
                    if best is not None and e > best[0]: continue
                    if collides(Ms, c, (0, 1, 2), bvh, margin): continue
                    best = (e, a)
    log('reach', side, name, 'miss %.1f cm' % (best[0] * 100) if best else 'none')
    return best[1] if best else (0, 0, 0, 0)
def fit_index_straight(H):
    c = CH['index']; best = None
    for c1 in np.arange(-10, 46, 2.5):
        for ds in np.arange(CUR.get('idx_ds', (-20, 45))[0], CUR.get('idx_ds', (-20, 45))[1] + 1, 2.5):
            a = (c1, 8, 5, ds); Ms = chain_fk(H, 'R', 'index', a)
            if collides(Ms, c, (0, 1, 2), BVH_GUN, 0.0012): continue
            sc = 0
            for k in (0, 1):
                for p, r in seg_points(Ms[k], c, k, 4):
                    d = BVH_GUN.find_nearest(p, 0.06)[3] or 0.06; sc += (d - r * 0.9 - 0.0015) ** 2
            dv = Ms[1].col[1].to_3d(); sc += 1e-8 * (c1 - 15) ** 2 + 2e-3 * ((dv.z - 0.08) ** 2 + (1 - dv.y) ** 2)
            if best is None or sc < best[0]: best = (sc, a)
    return best[1] if best else (15, 8, 5, 0)
def fit_index_trigger(H):
    c = CH['index']; tgt = Vector((0, 0.0335, 0.041)); best = None
    for c1 in np.arange(0, 81, 4):
        for c2 in np.arange(0, 101, 5):
            for c3 in np.arange(0, 61, 6):
                for ds in (-12, -6, 0, 6, 12):
                    a = (c1, c2, c3, ds); Ms = chain_fk(H, 'R', 'index', a)
                    pad = Ms[2] @ Vector((0, c['L'][2] * 0.0045, -c['R'][2][1] * 0.0085))
                    e = (pad - tgt).length
                    if best is not None and e > best[0]: continue
                    if collides(Ms, c, (0, 1, 2), BVH_NOTRIG, 0.0005): continue
                    best = (e, a)
    return best[1]


def forearm_matrix(H, E, side, k=1.0):
    F0 = H @ cm2m(T(0, -FORE_LEN, 0) if side == 'R' else mirror(T(0, -FORE_LEN, 0)))
    W = H.translation; d = (W - E).normalized()
    y0 = F0.col[1].to_3d().normalized()
    q = y0.rotation_difference(d)
    R = q.to_matrix() @ F0.to_3x3()
    M = R.to_4x4() @ Matrix.Diagonal((1.0, k, 1.0, 1.0)); M.translation = W - d * FORE_LEN * 0.01 * k; return M      # k > 1: a longer forearm (the minigun's reach)
def fmix(A, B, t):
    return {n: tuple(lerp(a, b, t) for a, b in zip(A[n] + (0,) * (4 - len(A[n])), B[n] + (0,) * (4 - len(B[n])))) for n in A}
def fadd(A, d):
    return {n: tuple(v + (d.get(n, (0, 0, 0, 0))[i] if i < 4 else 0) for i, v in enumerate(a + (0,) * (4 - len(a)))) for n, a in A.items()}
OPEN = {n: (20, 30, 16, 0) for n in FINGERS}; OPEN['thumb'] = (2, 10, 8, 0)      # a hand off the gun relaxes (straight fingers read as a paddle)


# ---------------------------------------------------------------- gun kit (metres, gun space: barrel +Y, up +Z)
CLS = ['steel', 'alloy', 'polymer', 'tan', 'wood', 'bright', 'rubber', 'brass', 'olive', 'white', 'dark', 'red']
BASEC = {'steel': (0.17, 0.175, 0.18), 'alloy': (0.125, 0.125, 0.13), 'polymer': (0.105, 0.105, 0.105), 'tan': (0.45, 0.38, 0.28),
         'wood': (0.36, 0.20, 0.10), 'bright': (0.50, 0.50, 0.51), 'rubber': (0.07, 0.07, 0.07), 'brass': (0.62, 0.46, 0.20),
         'olive': (0.27, 0.30, 0.19), 'white': (0.80, 0.80, 0.78), 'dark': (0.055, 0.055, 0.06), 'red': (0.45, 0.08, 0.06)}
WEAR = {'steel': (0.55, 0.55, 0.56), 'alloy': (0.48, 0.48, 0.5), 'polymer': (0.2, 0.2, 0.2), 'tan': (0.58, 0.51, 0.40), 'wood': (0.5, 0.33, 0.18),
        'olive': (0.45, 0.45, 0.38)}
GRP = ['gun', 'mag', 'bolt', 'trigger', 'pump', 'spin']
class Kit:
    def __init__(s, seg=1):
        s.bm = bmesh.new(); s.seg = seg
        s.cls = s.bm.faces.layers.int.new('cls'); s.bev = s.bm.faces.layers.int.new('bev'); s.grp = s.bm.verts.layers.int.new('grp')
    def _finish(s, before, cls, grp, bevfaces=(), smooth=False, axis=None):
        new = set(s.bm.faces) - before; bf = set(bevfaces)
        for f in new:
            f[s.cls] = CLS.index(cls); f[s.bev] = 1 if f in bf else 0
            f.smooth = smooth and not (axis is not None and abs(f.normal.dot(axis)) > 0.9)
            for v in f.verts: v[s.grp] = GRP.index(grp)
        return new
    def _bevel(s, faces, bev):
        if bev <= 0: return []
        edges = list({e for f in faces for e in f.edges})
        try: return bmesh.ops.bevel(s.bm, geom=edges, offset=bev, segments=s.seg, affect='EDGES', profile=0.5, clamp_overlap=True)['faces']
        except Exception as e: log('bevel failed', e); return []
    def box(s, c, size, cls='steel', grp='gun', bev=0.0012, M=None):
        b = set(s.bm.faces)
        bmesh.ops.create_cube(s.bm, size=1.0, matrix=(M or Matrix()) @ T(*c) @ Matrix.Diagonal((size[0], size[1], size[2], 1)))
        bf = s._bevel(list(set(s.bm.faces) - b), bev)
        return s._finish(b, cls, grp, bf)
    def prism(s, prof, x0, x1, cls='steel', grp='gun', bev=0.0012, M=None):
        """side profile [(y, z)] extruded across x from x0 to x1"""
        b = set(s.bm.faces); M = M or Matrix()
        v0 = [s.bm.verts.new(M @ Vector((x0, y, z))) for y, z in prof]; v1 = [s.bm.verts.new(M @ Vector((x1, y, z))) for y, z in prof]
        n = len(prof); s.bm.faces.new(v0); s.bm.faces.new(v1[::-1])
        for i in range(n): j = (i + 1) % n; s.bm.faces.new((v0[i], v0[j], v1[j], v1[i]))
        faces = list(set(s.bm.faces) - b); bmesh.ops.recalc_face_normals(s.bm, faces=faces)
        bf = s._bevel(faces, bev)
        return s._finish(b, cls, grp, bf)
    def lathe(s, prof, M=None, segs=16, cls='steel', grp='gun', loop=False, caps=True, smooth=True):
        """profile [(r, y)] turned round the local Y axis of M (default: the gun's Y axis through the origin)"""
        b = set(s.bm.faces); M = M or Matrix(); rings = []
        for r, y in prof:
            if r <= 1e-7: rings.append([s.bm.verts.new(M @ Vector((0, y, 0)))])
            else: rings.append([s.bm.verts.new(M @ Vector((r * math.cos(2 * math.pi * j / segs), y, r * math.sin(2 * math.pi * j / segs)))) for j in range(segs)])
        n = len(rings)
        for i in range(n if loop else n - 1):
            A, B = rings[i], rings[(i + 1) % n]
            for j in range(segs):
                k = (j + 1) % segs
                if len(A) == 1 and len(B) == 1: continue
                if len(A) == 1: s.bm.faces.new((A[0], B[k], B[j]))
                elif len(B) == 1: s.bm.faces.new((A[j], A[k], B[0]))
                else: s.bm.faces.new((A[j], A[k], B[k], B[j]))
        if not loop and caps:
            for R in (rings[0], rings[-1]):
                if len(R) > 2: s.bm.faces.new(R)
        faces = list(set(s.bm.faces) - b); bmesh.ops.recalc_face_normals(s.bm, faces=faces)
        for f in faces: f.normal_update()
        return s._finish(b, cls, grp, (), smooth, M.col[1].to_3d().normalized())
    def sweep(s, pts, r, segs=8, cls='steel', grp='gun', caps=True):
        b = set(s.bm.faces); pts = [Vector(p) for p in pts]; rings = []; u = None
        for i, p in enumerate(pts):
            t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
            if u is None: u = t.cross(Vector((1, 0, 0)) if abs(t.x) < 0.9 else Vector((0, 0, 1))).normalized()
            u = (u - u.dot(t) * t).normalized(); w = t.cross(u)
            rings.append([s.bm.verts.new(p + r * (math.cos(2 * math.pi * j / segs) * u + math.sin(2 * math.pi * j / segs) * w)) for j in range(segs)])
        for i in range(len(rings) - 1):
            A, B = rings[i], rings[i + 1]
            for j in range(segs): k = (j + 1) % segs; s.bm.faces.new((A[j], A[k], B[k], B[j]))
        if caps: s.bm.faces.new(rings[0]); s.bm.faces.new(rings[-1])
        faces = list(set(s.bm.faces) - b); bmesh.ops.recalc_face_normals(s.bm, faces=faces)
        return s._finish(b, cls, grp, (), True)
    def tube(s, r_out, r_in, y0, y1, cx=0.0, cz=0.0, segs=24, cls='alloy', grp='gun'):
        """hollow tube along +Y (a sight or scope you can look through)"""
        return s.lathe([(r_out, y0), (r_out, y1), (r_in, y1), (r_in, y0)], T(cx, 0, cz), segs, cls, grp, loop=True)
def ypos(c, dy): return T(0, dy, 0) @ c
def make_mesh_object(name, me):
    ob = bpy.data.objects.new(name, me); col.objects.link(ob); return ob
def smart_uv(ob, angle=66, margin=0.004):
    me = ob.data
    if not me.uv_layers: me.uv_layers.new(name='UVMap')
    vl = bpy.context.view_layer
    for o in list(vl.objects):
        if o is not None: o.select_set(False)
    vl.objects.active = ob; ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(angle), island_margin=margin)
    bpy.ops.object.mode_set(mode='OBJECT')
def kit_object(kit, name):
    me = bpy.data.meshes.new(name); kit.bm.to_mesh(me); kit.bm.free()
    ob = make_mesh_object(name, me); smart_uv(ob)
    g = me.attributes['grp'].data; gi = np.empty(len(me.vertices), np.int64); me.attributes['grp'].data.foreach_get('value', gi)
    groups = {}
    for i, v in enumerate(gi): groups.setdefault(GRP[v], set()).add(i)
    for gname, idx in groups.items():
        vg = ob.vertex_groups.new(name=gname); vg.add(sorted(idx), 1.0, 'REPLACE')
    return ob, groups

def gun_texture(ob, N, name):
    me = ob.data; me.calc_loop_triangles(); nt = len(me.loop_triangles)
    tl = np.empty(nt * 3, np.int64); me.loop_triangles.foreach_get('loops', tl); tl = tl.reshape(-1, 3)
    tp = np.empty(nt, np.int64); me.loop_triangles.foreach_get('polygon_index', tp)
    nl = len(me.loops); lv = np.empty(nl, np.int64); me.loops.foreach_get('vertex_index', lv)
    nv = len(me.vertices); co = np.empty(nv * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    uv = np.empty(nl * 2, np.float32); me.uv_layers['UVMap'].data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
    npl = len(me.polygons); fn = np.empty(npl * 3, np.float32); me.polygons.foreach_get('normal', fn); fn = fn.reshape(-1, 3)
    cl = np.empty(npl, np.int64); me.attributes['cls'].data.foreach_get('value', cl)
    bv = np.empty(npl, np.int64); me.attributes['bev'].data.foreach_get('value', bv)
    P3 = co[lv[tl]]; Nf = np.repeat(fn[tp][:, None, :], 3, 1)
    Cf = np.repeat(cl[tp].astype(np.float32)[:, None, None], 3, 1); Bf = np.repeat(bv[tp].astype(np.float32)[:, None, None], 3, 1)
    mask, (Pi, Ni, Ci, Bi) = raster(uv[tl], [P3, Nf, Cf, Bf], N)
    bvh = BVHTree.FromPolygons([Vector(c) for c in co], [list(p.vertices) for p in me.polygons])
    rng = np.random.default_rng(5); NR = 14; u1, u2 = rng.random(NR), rng.random(NR)
    dirs = np.stack([np.sqrt(u1) * np.cos(2 * np.pi * u2), np.sqrt(u1) * np.sin(2 * np.pi * u2), np.sqrt(1 - u1)], 1)
    aoh = np.ones((N, N), np.float32); sub = mask.copy(); sub[1::2, :] = False; sub[:, 1::2] = False
    for y, x in zip(*np.nonzero(sub)):
        n = Vector(Ni[y, x]);
        if n.length < 1e-6: continue
        n.normalize(); t = n.orthogonal().normalized(); b2 = n.cross(t); o = Vector(Pi[y, x]) + n * 0.0004; occ = 0.0
        for d in dirs:
            h = bvh.ray_cast(o, t * d[0] + b2 * d[1] + n * d[2], 0.03)
            if h[0] is not None: occ += 1 - h[3] / 0.03
        aoh[y, x] = 1 - occ / NR
    ao = aoh.copy(); ys, xs = np.nonzero(mask & ~sub)
    ao[ys, xs] = aoh[(ys // 2) * 2, (xs // 2) * 2]
    ao = 0.25 * (ao + np.roll(ao, 1, 0) + np.roll(ao, 1, 1) + np.roll(np.roll(ao, 1, 0), 1, 1))
    idx = np.nonzero(mask); P = Pi[idx]; C = np.rint(Ci[idx][:, 0]).astype(int).clip(0, len(CLS) - 1); B = Bi[idx][:, 0] > 0.5
    px, py = idx[1].astype(np.float32), idx[0].astype(np.float32)
    base = np.array([BASEC[c] for c in CLS], np.float32)[C]; wear = np.array([WEAR.get(c, BASEC[c]) for c in CLS], np.float32)[C]
    grain = fbm(P, 0.0015, 3); mott = fbm(P, 0.02, 9); fine = vnoise(P, 0.0005, 17)
    colr = base * (0.9 + 0.2 * grain[:, None]) * (0.93 + 0.14 * mott[:, None])
    wd = C == CLS.index('wood')
    if wd.any():
        st = 0.5 + 0.5 * np.sin(P[wd, 0] * 900 + P[wd, 2] * 600 + 14 * fbm(P[wd], 0.03, 4))
        colr[wd] *= (0.78 + 0.3 * st[:, None])
    pl = np.isin(C, [CLS.index('polymer'), CLS.index('tan'), CLS.index('rubber')])
    colr[pl] *= (0.9 + 0.2 * (fine[pl] > 0.55))[:, None]
    met = np.isin(C, [CLS.index('steel'), CLS.index('alloy'), CLS.index('bright')])
    colr[met] *= (0.95 + 0.1 * vnoise(P[met] * np.array((1, 0.05, 1), np.float32), 0.0004, 23))[:, None]
    wearf = (B * (0.35 + 0.35 * grain)) + (~B) * 0.04 * np.clip(mott - 0.6, 0, 1) * 5
    colr = colr * (1 - wearf[:, None]) + wear * wearf[:, None]
    a = ao[idx]; colr *= (0.30 + 0.70 * np.clip(a, 0, 1) ** 1.2)[:, None]
    colr = np.clip(colr, 0.03, 1)
    img = np.zeros((N, N, 3), np.float32); img[idx] = colr; filled = mask.copy()
    for it in range(6):
        acc = np.zeros_like(img); cnt = np.zeros((N, N), np.float32)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            acc += np.roll(np.roll(img * filled[..., None], dy, 0), dx, 1); cnt += np.roll(np.roll(filled, dy, 0), dx, 1)
        new = (~filled) & (cnt > 0); img[new] = acc[new] / cnt[new][:, None]; filled |= new
    img[~filled] = 0.1
    return save_image(img, name)
def save_image(img, name):
    N = img.shape[0]; path = os.path.join(TEXDIR, name + '.png')
    old = bpy.data.images.get(name)
    if old: bpy.data.images.remove(old)
    im = bpy.data.images.new(name + '_tmp', img.shape[1], N, alpha=False)
    im.pixels.foreach_set(np.concatenate([img, np.ones((N, img.shape[1], 1), np.float32)], 2).ravel())
    im.filepath_raw = path; im.file_format = 'PNG'; im.save(); bpy.data.images.remove(im)
    im = bpy.data.images.load(path); im.name = name; im.filepath = '//tex/' + name + '.png'
    return im
def image_material(name, img, rough=0.6, metal=0.2):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tx = next((n for n in nt.nodes if n.type == 'TEX_IMAGE'), None) or nt.nodes.new('ShaderNodeTexImage')
    tx.image = img; nt.links.new(tx.outputs['Color'], bsdf.inputs['Base Color']); nt.nodes.active = tx
    bsdf.inputs['Roughness'].default_value = rough; bsdf.inputs['Metallic'].default_value = metal
    return m

def vnoise(P, scale, seed):
    Q = P / scale; i = np.floor(Q).astype(np.int64); f = Q - i; u = f * f * (3 - 2 * f)
    def hsh(ix, iy, iz):
        n = (ix.astype(np.uint64) * np.uint64(73856093)) ^ (iy.astype(np.uint64) * np.uint64(19349663)) ^ (iz.astype(np.uint64) * np.uint64(83492791)) ^ np.uint64(seed * 2654435761 & 0xffffffff)
        n = (n ^ (n >> np.uint64(13))) * np.uint64(1274126177); n = n ^ (n >> np.uint64(16))
        return (n & np.uint64(0xffff)).astype(np.float32) / 65535.0
    r = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (u[:, 0] if dx else 1 - u[:, 0]) * (u[:, 1] if dy else 1 - u[:, 1]) * (u[:, 2] if dz else 1 - u[:, 2])
                r = r + w * hsh(i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz)
    return r
def fbm(P, scale, seed, oct=3):
    s, a, tot = 0, 1.0, 0
    for o in range(oct): s = s + a * vnoise(P, scale / (2 ** o), seed + o); tot += a; a *= 0.5
    return s / tot
def vertex_ao():
    dg = bpy.context.evaluated_depsgraph_get(); ev = arms_ob.evaluated_get(dg); me = ev.to_mesh()
    vs = [v.co.copy() for v in me.vertices]; ns = [v.normal.copy() for v in me.vertices]
    bvh = BVHTree.FromPolygons(vs, [list(p.vertices) for p in me.polygons]); ev.to_mesh_clear()
    rng = np.random.default_rng(3); NR = 48
    u1, u2 = rng.random(NR), rng.random(NR)
    dirs = np.stack([np.sqrt(u1) * np.cos(2 * np.pi * u2), np.sqrt(u1) * np.sin(2 * np.pi * u2), np.sqrt(1 - u1)], 1)
    ao = np.zeros(len(vs))
    for i, (p, n) in enumerate(zip(vs, ns)):
        t = n.orthogonal().normalized(); b = n.cross(t); occ = 0.0; o = p + n * 0.0006
        for d in dirs:
            dv = t * d[0] + b * d[1] + n * d[2]
            hit = bvh.ray_cast(o, dv, 0.035)
            if hit[0] is not None: occ += 1 - hit[3] / 0.035
        ao[i] = 1 - occ / NR
    n = len(co_cm); return 0.5 * (ao[:n] + ao[n:])
def convexity(co, tris):
    n = len(co); nb = np.zeros((n, 3)); cnt = np.zeros(n); nrm = np.zeros((n, 3))
    a, b, c = co[tris[:, 0]], co[tris[:, 1]], co[tris[:, 2]]; fn = np.cross(b - a, c - a)
    for k in range(3):
        np.add.at(nrm, tris[:, k], fn)
        for j in range(3):
            if j != k: np.add.at(nb, tris[:, k], co[tris[:, j]]); np.add.at(cnt, tris[:, k], 1)
    nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
    lap = co - nb / np.maximum(cnt, 1)[:, None]
    return (lap * nrm).sum(1), nrm
def raster(tuv, attrs, N=1024):
    img = [np.zeros((N, N, a.shape[2]), np.float32) for a in attrs]; mask = np.zeros((N, N), bool)
    for t in range(len(tuv)):
        p = tuv[t] * N
        x0, y0 = np.floor(p.min(0)).astype(int); x1, y1 = np.ceil(p.max(0)).astype(int)
        x0, y0 = max(x0 - 1, 0), max(y0 - 1, 0); x1, y1 = min(x1 + 1, N), min(y1 + 1, N)
        if x1 <= x0 or y1 <= y0: continue
        X, Y = np.meshgrid(np.arange(x0, x1) + 0.5, np.arange(y0, y1) + 0.5)
        (ax, ay), (bx, by), (cx, cy) = p
        den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(den) < 1e-12: continue
        l0 = ((by - cy) * (X - cx) + (cx - bx) * (Y - cy)) / den; l1 = ((cy - ay) * (X - cx) + (ax - cx) * (Y - cy)) / den; l2 = 1 - l0 - l1
        ins = (l0 >= -0.02) & (l1 >= -0.02) & (l2 >= -0.02)
        if not ins.any(): continue
        ys_, xs_ = np.nonzero(ins); ys_ += y0; xs_ += x0
        L = np.stack([l0[ins], l1[ins], l2[ins]], 1)
        for im, a in zip(img, attrs): im[ys_, xs_] = L @ a[t]
        mask[ys_, xs_] = True
    return mask, img
def build_texture():
    ao_v = vertex_ao(); cv_v, nrm_v = convexity(co_cm, tris)
    cv_v = np.clip(cv_v / 0.08, -1, 1)
    attrs = [co_cm[tris].astype(np.float32), nrm_v[tris].astype(np.float32), ao_v[tris][..., None].astype(np.float32), cv_v[tris][..., None].astype(np.float32)]
    mask, (P_img, N_img, AO_img, CV_img) = raster(tuv, attrs)
    idx = np.nonzero(mask); P = P_img[idx]; Nn = N_img[idx]; Nn /= np.maximum(np.linalg.norm(Nn, axis=1, keepdims=True), 1e-6)
    AO = AO_img[idx][:, 0]; CV = CV_img[idx][:, 0]; px, py = idx[1].astype(np.float32), idx[0].astype(np.float32)
    G = groups_sd(P); D = np.stack([G[g] for g in GROUPS], 1); order = np.argsort(D, 1)
    part = order[:, 0]; gap = np.take_along_axis(D, order[:, 1:2], 1)[:, 0] - np.take_along_axis(D, order[:, :1], 1)[:, 0]
    pname = np.array(GROUPS)[part]
    FAB, LEA, RUB, NEO, STR, SLV, THR = [np.array(c, np.float32) for c in (
        (0.30, 0.31, 0.28), (0.40, 0.33, 0.25), (0.20, 0.205, 0.20), (0.235, 0.24, 0.225), (0.27, 0.275, 0.25), (0.30, 0.325, 0.245), (0.55, 0.53, 0.48))]
    col_ = np.zeros((len(P), 3), np.float32)
    grain = fbm(P, 0.09, 1); mott = fbm(P, 1.6, 7); dirt = fbm(P, 4.5, 13)
    weave = 0.5 + 0.5 * np.sin(px * np.pi * 0.66) * np.sin(py * np.pi * 0.66)
    twill = 0.5 + 0.5 * np.sin((px + py) * np.pi * 0.5)
    palmar = np.zeros(len(P), bool); seam = np.full(len(P), 9.0, np.float32); stitch = np.zeros(len(P), bool)
    for c in CHAINS:
        sel = np.nonzero(pname == c['name'])[0]
        if not len(sel): continue
        Q = P[sel]; best = np.full(len(sel), 1e9); phi = np.zeros(len(sel)); rho = np.zeros(len(sel)); s_ax = np.zeros(len(sel)); acc = 0.0
        for k in range(3):
            q = loc(Q, c['F'][k]); L = c['L'][k]; t = np.clip(q[:, 1], 0, L if k < 2 else L + 1)
            d = np.sqrt(q[:, 0] ** 2 + (q[:, 1] - t) ** 2 + q[:, 2] ** 2); m = d < best
            best[m] = d[m]; ph = np.arctan2(q[:, 2] / FLAT, np.abs(q[:, 0])); phi[m] = ph[m]
            rho[m] = np.sqrt(q[:, 0] ** 2 + (q[:, 2]) ** 2)[m]; s_ax[m] = (acc + q[:, 1])[m]; acc += L
        s0 = math.radians(12)
        palmar[sel] = phi < s0
        arc = rho * np.abs(phi - s0); seam[sel] = arc
        stitch[sel] = (phi > s0) & (arc > 0.09) & (arc < 0.15) & (np.mod(s_ax, 0.30) < 0.17)
    pm = pname == 'palm'
    nz = Nn[:, 2]
    palmar[pm] = nz[pm] < -0.22
    seam[pm] = np.abs(nz[pm] + 0.22) * 1.6
    stitch[pm] = (nz[pm] > -0.12) & (nz[pm] < -0.06) & (np.mod(P[pm, 1] + 0.5 * P[pm, 0], 0.30) < 0.17)
    isfab = np.isin(pname, ['palm'] + FINGERS) & ~palmar
    islea = np.isin(pname, ['palm'] + FINGERS) & palmar
    col_[isfab] = FAB * (0.90 + 0.10 * weave[isfab, None]) * (0.92 + 0.16 * grain[isfab, None])
    dots = ((np.mod(px, 7) - 3.5) ** 2 + (np.mod(py + 3.5 * (np.floor(px / 7) % 2), 7) - 3.5) ** 2) < 3.2
    col_[islea] = LEA * (0.88 + 0.22 * grain[islea, None]) * (0.92 + 0.14 * mott[islea, None])
    dsel = islea & dots & (P[:, 1] > 3.0); col_[dsel] *= 0.72
    pads = np.zeros(len(P), bool)
    for c in CHAINS: pads |= (pad_sd(P, c) < 0.03) & (pname == c['name'])
    rub = (pname == 'guard') | pads
    col_[rub] = RUB * (0.92 + 0.14 * grain[rub, None])
    cu = pname == 'cuff'
    if cu.any():
        b, s, tb = cuff_parts(P[cu]); w = np.argmin(np.stack([b, s, tb], 1), 1)
        cc = np.where(w[:, None] == 0, NEO, np.where(w[:, None] == 1, STR, NEO * 0.95))
        hook = 0.85 + 0.3 * vnoise(P[cu], 0.035, 21)[:, None]
        col_[cu] = cc * np.where(w[:, None] == 1, hook, 0.94 + 0.12 * grain[cu, None])
        Pc = P[cu]; e1 = (np.abs(Pc[:, 1] + 1.65) < 0.05) | (np.abs(Pc[:, 1] + 3.55) < 0.05)
        col_[np.nonzero(cu)[0][e1 & (np.mod(np.arctan2(Pc[:, 2], Pc[:, 0]) * 3.0, 0.3) < 0.17)]] = THR * 0.8
    sl = pname == 'sleeve'
    col_[sl] = SLV * (0.9 + 0.1 * twill[sl, None]) * (0.90 + 0.18 * mott[sl, None]) * (0.95 + 0.1 * grain[sl, None])
    Ps = P[sl]; ang = np.arctan2(Ps[:, 2], Ps[:, 0])
    hem = ((np.abs(Ps[:, 1] + 5.65) < 0.05) | (np.abs(Ps[:, 1] + 8.05) < 0.05)) & (np.mod(ang * 4.0, 0.32) < 0.18)
    col_[np.nonzero(sl)[0][hem]] = SLV * 1.45
    sm = seam < 0.055; col_[sm & ~rub] *= 0.55
    st = stitch & ~rub & ~sm; col_[st] = THR * (0.9 + 0.2 * grain[st, None])
    second = np.array(GROUPS)[order[:, 1]]; spec = ['guard', 'cuff', 'sleeve']
    edge = (gap < 0.05) & (np.isin(pname, spec) | np.isin(second, spec)); col_[edge] *= 0.62
    wear = np.clip(CV, 0, 1); col_ *= (1 + 0.22 * wear[:, None] * (1 - rub[:, None] * 0.5))
    col_ *= (0.94 + 0.12 * dirt[:, None])
    col_ *= (0.28 + 0.72 * np.clip(AO, 0, 1) ** 1.3)[:, None] * (1 - 0.25 * np.clip(-CV, 0, 1))[:, None]
    col_ = np.clip(col_, 0.035, 1)
    img = np.zeros((TEXN, TEXN, 3), np.float32); img[idx] = col_
    filled = mask.copy()
    for it in range(8):                       # pad the islands
        acc = np.zeros_like(img); cnt = np.zeros((TEXN, TEXN), np.float32)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            acc += np.roll(np.roll(img * filled[..., None], dy, 0), dx, 1); cnt += np.roll(np.roll(filled, dy, 0), dx, 1)
        new = (~filled) & (cnt > 0); img[new] = acc[new] / cnt[new][:, None]; filled |= new
    img[~filled] = SLV
    return save_image(img, 'ashfall_arms')


# ---------------------------------------------------------------- per-weapon state (module globals the shared code reads)
BVH_GUN = BVH_NOTRIG = BVH_MAG = BVH_BOLT = None
HR0 = HL0 = None; ER0 = EL0 = None; FR_HOLD = FR_TRIG = FL_HOLD = None; rig = None; REST = {}; CUR = {}; gun_groups = {}
ER_DIR = Vector((0.42, -0.50, -0.76)).normalized(); EL_DIR = Vector((-0.42, -0.50, -0.76)).normalized()
def bvh_of(ob, names, extra=None):
    keep = set().union(*[gun_groups.get(n, set()) for n in names])
    vs = [v.co.copy() for v in ob.data.vertices]
    ps = [list(p.vertices) for p in ob.data.polygons if p.vertices[0] in keep]
    if extra:
        b = len(vs); vs += extra[0]; ps += [[b + i for i in p] for p in extra[1]]
    return BVHTree.FromPolygons(vs, ps)
def right_hand_proxy(H, fingers):
    """boxes round the right hand's fingers (so the left hand can wrap them)"""
    vs, ps = [], []
    for n, ang in fingers.items():
        c = CH[n]; Ms = chain_fk(H, 'R', n, ang)
        for k in range(3):
            r = c['R'][k][0] * 0.0095; L = c['L'][k] * 0.01; b = len(vs)
            for sx in (-1, 1):
                for sy in (0, 1):
                    for sz in (-1, 1): vs.append(Ms[k] @ Vector((sx * r, sy * L, sz * r * FLAT)))
            ps += [[b + 0, b + 1, b + 3, b + 2], [b + 4, b + 6, b + 7, b + 5], [b + 0, b + 4, b + 5, b + 1], [b + 2, b + 3, b + 7, b + 6],
                   [b + 0, b + 2, b + 6, b + 4], [b + 1, b + 5, b + 7, b + 3]]
    return vs, ps
def fit_index_trigger(H):
    c = CH['index']; tgt = CUR['trigger_pt']; best = None
    for c1 in np.arange(-10, 91, 4):
        for c2 in np.arange(0, 101, 5):
            for c3 in np.arange(0, 61, 6):
                for ds in np.arange(-30, 31, 5):
                    a = (c1, c2, c3, ds); Ms = chain_fk(H, 'R', 'index', a)
                    pad = Ms[2] @ Vector((0, c['L'][2] * 0.0045, -c['R'][2][1] * 0.0085))
                    e = (pad - tgt).length
                    if best is not None and e > best[0]: continue
                    if collides(Ms, c, (0, 1, 2), BVH_NOTRIG, 0.0005): continue
                    best = (e, a)
    log('trigger finger miss %.1f mm' % (best[0] * 1000))
    return best[1]

# ---------------------------------------------------------------- the carbine (from art/proof/shooter.blend)
def loose_parts(bm):
    seen, parts = set(), []
    for f in bm.faces:
        if f.index in seen: continue
        stack, fs = [f], []; seen.add(f.index)
        while stack:
            g = stack.pop(); fs.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen: seen.add(h.index); stack.append(h)
        parts.append({v.index for g in fs for v in g.verts})
    return parts
def hollow_optic(bm):
    bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
    kill, lo, hi = set(), Vector((1, 1, 1)), Vector((-1, -1, -1))
    for p in loose_parts(bm):
        cs = [bm.verts[i].co for i in p]
        mn = Vector([min(c[k] for c in cs) for k in range(3)]); mx = Vector([max(c[k] for c in cs) for k in range(3)])
        if mn.z > 0.156 and mn.y > 0.057 and mx.y < 0.125 and abs(mn.x + mx.x) < 0.004 and mx.x - mn.x > 0.025:
            kill |= p; lo = Vector(map(min, lo, mn)); hi = Vector(map(max, hi, mx))
    zc = round((lo.z + hi.z) / 2, 4)
    bm.verts.ensure_lookup_table(); bmesh.ops.delete(bm, geom=[bm.verts[i] for i in kill], context='VERTS')
    ri = 0.0135
    prof = [(0.0165, lo.y), (0.0165, lo.y + 0.006), (0.018, lo.y + 0.006), (0.018, 0.113), (hi.z - zc, 0.113), (hi.z - zc, hi.y), (ri, hi.y), (ri, lo.y)]
    area = sum(prof[i][0] * prof[(i + 1) % len(prof)][1] - prof[(i + 1) % len(prof)][0] * prof[i][1] for i in range(len(prof)))
    uvl = bm.loops.layers.uv['UVMap']; N = 32
    ring = [[bm.verts.new((r * math.cos(2 * math.pi * j / N), y, zc + r * math.sin(2 * math.pi * j / N))) for j in range(N)] for r, y in prof]
    for i in range(len(prof)):
        a, b = prof[i], prof[(i + 1) % len(prof)]
        dr, dy = b[0] - a[0], b[1] - a[1]; nr, ny = (dy, -dr) if area > 0 else (-dy, dr)
        for j in range(N):
            k = (j + 1) % N; th = 2 * math.pi * (j + 0.5) / N
            f = bm.faces.new((ring[i][j], ring[i][k], ring[(i + 1) % len(prof)][k], ring[(i + 1) % len(prof)][j]))
            want = Vector((nr * math.cos(th), ny, nr * math.sin(th))); f.normal_update()
            if f.normal.dot(want) < 0: f.normal_flip()
            for n_, l in enumerate(f.loops): l[uvl].uv = (0.025 + 0.01 * (n_ % 2), 0.69 + 0.01 * (n_ // 2))
            f.smooth = abs(nr) > 0.5; f.material_index = 0
    return {'center_z': zc, 'inner_r': ri, 'y': (lo.y, hi.y)}
def ensure_carbine_sources():
    if bpy.data.objects.get('carbine_src_gun'): return
    with bpy.data.libraries.load(SHOOTER, link=False) as (src, dst): dst.objects = ['gun', 'gun_mag']
    sc = bpy.data.collections.get('sources') or bpy.data.collections.new('sources')
    if sc.name not in scene.collection.children: scene.collection.children.link(sc)
    g, m = dst.objects
    for o in (g, m): sc.objects.link(o); o.hide_render = True
    g.name = g.data.name = 'carbine_src_gun'; m.name = m.data.name = 'carbine_src_mag'
    shutil.copy(os.path.join(ROOT, 'art', 'proof', 'tex', 'gun.png'), os.path.join(TEXDIR, 'carbine_gun.png'))
    mat = g.data.materials[0]; mat.name = 'carbine_gun'
    img = next(n.image for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE'); img.name = 'carbine_gun'; img.filepath = '//tex/carbine_gun.png'; img.reload()
    log('carbine copied from', SHOOTER)
def carbine_gun_object(name):
    gun, mag = bpy.data.objects['carbine_src_gun'], bpy.data.objects['carbine_src_mag']
    bm = bmesh.new(); bm.from_mesh(gun.data); hollow_optic(bm); n_gun = len(bm.verts)
    bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
    groups = {'gun': set(range(n_gun)), 'mag': set(), 'bolt': set(), 'trigger': set()}
    for p in loose_parts(bm):
        cs = [bm.verts[i].co for i in p]
        mn = Vector([min(c[k] for c in cs) for k in range(3)]); mx = Vector([max(c[k] for c in cs) for k in range(3)])
        c, sz = (mn + mx) / 2, mx - mn
        if (c - Vector((0, -0.066, 0.1265))).length < 0.006 and sz.x > 0.025: groups['bolt'] |= p
        if (c - Vector((0, 0.0375, 0.0375))).length < 0.006 and sz.x < 0.008: groups['trigger'] |= p
    groups['gun'] -= groups['bolt'] | groups['trigger']
    tmp = mag.data.copy(); tmp.transform(gun.matrix_world.inverted() @ mag.matrix_world)
    bm.from_mesh(tmp); bpy.data.meshes.remove(tmp)
    groups['mag'] = set(range(n_gun, len(bm.verts)))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.clear(); me.materials.append(gun.data.materials[0])
    for p in me.polygons: p.material_index = 0
    ob = make_mesh_object(name, me)
    for g, idx in groups.items():
        vg = ob.vertex_groups.new(name=g); vg.add(sorted(idx), 1.0, 'REPLACE')
    return ob, groups
GF_CARBINE = fr((0, 0.0075, 0.045), (0, 0.977, -0.213), (0, 0.213, 0.977))
HF_CARBINE = T(0, 0.27, 0.087)
GRIP_DOWN = Vector((0, -0.213, -0.977))
def right_hold():
    ga = math.radians(10); phi = math.radians(25)
    e1 = Vector((math.cos(ga), -math.sin(ga), 0)); e2 = Vector((0, 0, 1)); e3 = e1.cross(e2)
    f2 = Matrix.Rotation(phi, 3, GRIP_DOWN) @ Vector((1, 0, 0)); f1 = GRIP_DOWN.normalized(); f3 = f1.cross(f2)
    R = Matrix((f1, f2, f3)).transposed() @ Matrix((e1, e2, e3))
    M = R.to_4x4(); M.translation = Vector((0.03, -0.032, -0.002)) - R @ (Vector((0, 4.8, -1.8)) * 0.01)
    return settle(M, 'R', BVH_GUN, direction=(-1, 0, 0))
def left_hold():
    return settle(place((0, 5.4, -1.7), (-0.002, 0.27, 0.08), (0.72, 0.62, 0.30), (-0.18, 0.05, -0.98), 'L'), 'L', BVH_GUN)
REF = {}
def carbine_reference():
    """the carbine's hold, relative to its grip and handguard: the other guns' hands start from it"""
    global BVH_GUN, gun_groups
    ensure_carbine_sources()
    ob, gun_groups = carbine_gun_object('tmp_carbine_ref'); BVH_GUN = bvh_of(ob, ['gun', 'mag', 'bolt', 'trigger'])
    hr, hl = right_hold(), left_hold()
    REF['HR'] = GF_CARBINE.inverted() @ hr; REF['HL'] = HF_CARBINE.inverted() @ hl
    REF['thumb'] = GF_CARBINE.inverted() @ Vector((-0.024, 0.012, 0.058))
    me = ob.data; bpy.data.objects.remove(ob, do_unlink=True); bpy.data.meshes.remove(me)

def model_carbine():
    ensure_carbine_sources()
    return {'carbine': True, 'tex': 1024, 'bones': {'gun': Matrix(), 'mag': T(0, 0.1284, 0.0783), 'bolt': T(0, -0.066, 0.1265), 'trigger': T(0, 0.0365, 0.0475)},
            'boltdir': Vector((0, -1, 0)), 'grip': GF_CARBINE, 'trigger_pt': Vector((0, 0.0335, 0.041)), 'left': ('carbine', None),
            'eye': Vector((-0.189, -0.322, 0.194)), 'sight': (0, 0.060, 0.1784), 'sightFront': (0, 0.1218, 0.1784), 'scope': 0.0135,
            'muzzle': (0, 0.5498, 0.1085), 'eject': (0.016, 0.055, 0.110), 'ejectDir': (0.85, 0.15, 0.5), 'ejectAt': 1 / 30.0,
            'pivot': (0.0, -0.01, 0.03), 'anim': carbine_anim}

# ---------------------------------------------------------------- shared clip pieces
OPEN = {n: (20, 30, 16, 0) for n in FINGERS}; OPEN['thumb'] = (2, 10, 8, 0)      # a hand off the gun relaxes (straight fingers read as a paddle)
def about(pivot, M): return T(*pivot) @ M @ T(*(-Vector(pivot)))
def hold_pose(G=None):
    G = Matrix() if G is None else G
    return {'G': G, 'HR': G @ HR0, 'HL': G @ HL0, 'ER': ER0.copy(), 'EL': EL0.copy(), 'fR': dict(FR_HOLD), 'fL': dict(FL_HOLD)}
def follow(P, G, k=1.0):
    """elbows go along with a big move of the gun"""
    P['ER'] = ER0 + (G.translation) * k; P['EL'] = EL0 + (G.translation) * k
def key_interp(keys, t):
    for i in range(len(keys) - 1):
        a, b = keys[i], keys[i + 1]
        if a[0] <= t <= b[0]:
            u = ease((t - a[0]) / max(b[0] - a[0], 1e-6))
            return mlerp(a[1], b[1], u), fmix(a[2], b[2], min(1.0, u * 1.25))
    return keys[-1][1], keys[-1][2]
def c_idle(t, D):
    w = 2 * math.pi * t / D; s1, s2 = math.sin(w), math.sin(2 * w)
    G = about(CUR['pivot'], T(0, 0, 0.0011 * s1) @ Rx(0.10 * s1) @ Rz(0.06 * s1 * s1))
    P = hold_pose(G)
    P['ER'] = ER0 + Vector((0.0, 0.0, 0.0045 * s1)); P['EL'] = EL0 + Vector((0.001 * s2, 0.0, 0.005 * s1))
    P['fR'] = fadd(P['fR'], {'middle': (1.2 * s1, 1.5 * s1, 0, 0), 'ring': (1.0 * s2, 1.2 * s1, 0, 0), 'pinky': (1.2 * s1, 0, 0, 0),
                             'index': (1.5 * s2, 1.0 * s1, 0.5 * s1, 0), 'thumb': (0, 1.2 * s2, 1.5 * s1, 0)})
    P['fL'] = fadd(P['fL'], {'index': (-1.5 * s1, -1.5 * s2, 0, 0), 'middle': (-1.0 * s2, -1.2 * s1, 0, 0), 'thumb': (1.2 * s1, 1.5 * s2, 0, 0)})
    return P
def make_fire(kick=0.005, rise=0.45, bolt=(0, 0.022, 0.008, 0), trig=(0, -13, -8, -3)):
    def c_fire(t, D):
        f = min(round(t * FPS), 3); k = [0, 1.0, 0.45, 0][f]
        G = about(CUR['pivot'], T(0, -kick * k, 0.12 * kick * k) @ Rx(rise * k))
        P = hold_pose(G); P['bolt'] = bolt[f]; P['trig'] = trig[f]
        P['ER'] = ER0 + Vector((0, -0.003, 0.001)) * k; P['EL'] = EL0 + Vector((0, -0.003, 0.0015)) * k
        P['fR'] = fadd(dict(FR_TRIG), {n: (2 * k, 2 * k, 0, 0) for n in ('middle', 'ring', 'pinky')})
        P['fL'] = fadd(P['fL'], {n: (1.5 * k, 2 * k, 0, 0) for n in ('index', 'middle', 'ring', 'pinky')})
        return P
    return c_fire
def make_draw(down=0.30, back=0.06, side=0.04, pitch=-38, roll=-30, yaw=-12):
    def c_draw(t, D):
        u = ease(t / D); v = 1 - u
        G = T(side * v, -back * v, -down * v) @ about(CUR['pivot'], Rx(pitch * v) @ Ry(roll * v) @ Rz(yaw * v))
        P = hold_pose(G); P['ER'] = ER0 + Vector((side * v, -back * v, -down * v)); P['EL'] = EL0 + Vector((side * 0.5 * v, -back * v, -down * v))
        P['fL'] = fmix(FL_HOLD, OPEN, max(0.0, 1 - t / (0.6 * D)) * 0.6)
        return P
    return c_draw
def make_run(yaw=30, pitch=18, roll=-32, off=(-0.02, 0.02, -0.075), bob=0.012):
    def c_run(t, D):
        w = 2 * math.pi * t / D; s1, c1, s2 = math.sin(w), math.cos(w), math.sin(2 * w); b = abs(math.sin(w)) - 0.64
        M = Rz(yaw + 3 * s1) @ Rx(pitch + 2 * s2) @ Ry(roll + 2.5 * c1)
        G = T(off[0] + 0.010 * s1, off[1], off[2] + bob * b) @ about(CUR['pivot'], M)
        P = hold_pose(G)
        P['ER'] = G.translation + ER0 + Vector((0.02 * s1, -0.03 * s1, 0.01 * c1)) + Vector((0.02, 0, -0.05))
        P['EL'] = G.translation + EL0 + Vector((0.03, -0.02 * s1, -0.08 + 0.01 * c1))
        return P
    return c_run
def make_melee(reach=0.13, kind='jab'):
    def c_melee(t, D):
        wind = bump(t, 0.06, 0.04); hit = smooth(0.07, 0.17, t) * (1 - smooth(0.22, D, t))
        if kind == 'jab':
            M = T(-0.02 * hit, -0.035 * wind + reach * hit, 0.015 * hit) @ about(CUR['pivot'], Rz(6 * wind - 14 * hit) @ Rx(-4 * wind - 6 * hit) @ Ry(-18 * hit))
        else:      # butt stroke: swing the stock forward
            M = T(-0.06 * hit, 0.05 * hit - 0.02 * wind, 0.05 * hit) @ about(CUR['pivot'], Rz(-35 * hit + 8 * wind) @ Ry(-40 * hit) @ Rx(15 * hit))
        P = hold_pose(M); follow(P, M, 0.8)
        P['fL'] = fadd(P['fL'], {n: (4 * hit, 4 * hit, 0, 0) for n in ('index', 'middle', 'ring', 'pinky')})
        return P
    return c_melee
def std_clips(fire=None, draw=None, run=None, melee=None, idle=2.8):
    return [('vm_idle', idle, c_idle, True), ('vm_fire', 0.1, fire or make_fire(), False), ('vm_draw', 0.5, draw or make_draw(), False),
            ('vm_run', 0.7, run or make_run(), True), ('vm_melee', 0.45, melee or make_melee(), False)]

def carbine_anim(W):
    MAG_REST = T(0, 0.1284, 0.0783)
    def about(pivot, M): return T(*pivot) @ M @ T(*(-Vector(pivot)))
    GRIP_PIVOT = (0.0, -0.01, 0.03)
    def clip_idle(t, D):
        w = 2 * math.pi * t / D; s1, s2 = math.sin(w), math.sin(2 * w)
        G = about(GRIP_PIVOT, T(0, 0, 0.0011 * s1) @ Rx(0.10 * s1) @ Rz(0.06 * math.sin(w) * math.sin(w)))
        P = hold_pose(G)
        P['ER'] = ER0 + Vector((0.0, 0.0, 0.0045 * s1)); P['EL'] = EL0 + Vector((0.001 * s2, 0.0, 0.005 * s1))
        P['fR'] = fadd(P['fR'], {'middle': (1.2 * s1, 1.5 * s1, 0, 0), 'ring': (1.0 * s2, 1.2 * s1, 0, 0), 'pinky': (1.2 * s1, 0, 0, 0),
                                 'index': (1.5 * s2, 1.0 * s1, 0.5 * s1, 0), 'thumb': (0, 1.2 * s2, 1.5 * s1, 0)})
        P['fL'] = fadd(P['fL'], {'index': (-1.5 * s1, -1.5 * s2, 0, 0), 'middle': (-1.0 * s2, -1.2 * s1, 0, 0), 'thumb': (1.2 * s1, 1.5 * s2, 0, 0)})
        return P
    def clip_fire(t, D):
        f = round(t * FPS)
        k = [0, 1.0, 0.45, 0][min(f, 3)]
        G = about(GRIP_PIVOT, T(0, -0.005 * k, 0.0006 * k) @ Rx(0.45 * k))
        P = hold_pose(G)
        P['bolt'] = [0, 0.022, 0.008, 0][min(f, 3)]; P['trig'] = [0, -13, -6, 0][min(f, 3)]
        P['ER'] = ER0 + Vector((0, -0.003, 0.001)) * k; P['EL'] = EL0 + Vector((0, -0.003, 0.0015)) * k
        if 0 < f < 3: P['fR'] = dict(FR_TRIG)
        P['fR'] = fadd(P['fR'], {n: (2 * k, 2 * k, 0, 0) for n in ('middle', 'ring', 'pinky')})
        P['fL'] = fadd(P['fL'], {n: (1.5 * k, 2 * k, 0, 0) for n in ('index', 'middle', 'ring', 'pinky')})
        return P

    # reload: key poses of the left hand in gun space
    def left_on_mag():
        return settle(place((0, 5.6, -1.75), (-0.02, 0.124, -0.02), (0.08, 0.80, 0.60), (-0.98, 0.12, 0.0), 'L'), 'L', BVH_MAG, roots=False)
    LM = left_on_mag()
    FL_MAG = grasp(LM, 'L', BVH_MAG)
    OFF_MAG = LM.inverted() @ MAG_REST
    def left_on_handle():
        return settle(place((-2.85, 9.3, -1.2), (-0.026, -0.056, 0.121), (0.15, 0.25, 0.96), (-0.97, 0.05, 0.2), 'L'), 'L', BVH_GUN, clear=0.002)
    LC = left_on_handle()
    FL_CH = grasp(LC, 'L', BVH_GUN, start=(10, 10, 5), thumb_start=(-10, 0, 0))
    log('mag grip', {k: tuple(round(x) for x in v) for k, v in FL_MAG.items()})
    log('handle grip', {k: tuple(round(x) for x in v) for k, v in FL_CH.items()})
    MAG_CLICK = 1.45
    def reload_keys():
        down = lambda dz, dx=0.0, rot=0.0: T(dx, 0, dz) @ LM @ Rx(rot)
        return [  # time, left hand (gun space), fingers, elbow dir
            (0.00, HL0, FL_HOLD), (0.12, HL0, FL_HOLD), (0.28, T(-0.03, -0.04, -0.03) @ mlerp(HL0, LM, 0.5), OPEN),
            (0.42, T(-0.012, 0, -0.016) @ LM, OPEN), (0.50, LM, FL_MAG), (0.56, LM, FL_MAG), (0.64, down(-0.07), FL_MAG),
            (0.86, T(-0.10, -0.06, -0.38) @ LM @ Rx(25), FL_MAG), (0.96, T(-0.08, -0.04, -0.40) @ LM @ Rx(15), FL_MAG),
            (1.15, down(-0.12, -0.02, 8), FL_MAG), (1.35, down(-0.016), FL_MAG), (MAG_CLICK, T(0, 0, 0.003) @ LM, FL_MAG),
            (1.50, LM, FL_MAG), (1.56, T(-0.02, -0.01, -0.02) @ LM, OPEN), (1.66, T(-0.004, 0.006, 0.022) @ LC, OPEN),
            (1.73, LC, FL_CH), (1.88, T(0, -0.064, -0.004) @ LC, FL_CH), (1.92, T(-0.006, -0.078, 0.004) @ LC, OPEN),
            (2.05, T(-0.03, -0.02, -0.02) @ mlerp(LC, HL0, 0.6), OPEN), (2.13, HL0, OPEN), (2.20, HL0, FL_HOLD)]
    RKEYS = reload_keys()
    def key_interp(keys, t):
        for i in range(len(keys) - 1):
            a, b = keys[i], keys[i + 1]
            if a[0] <= t <= b[0]:
                u = ease((t - a[0]) / (b[0] - a[0]))
                return mlerp(a[1], b[1], u), fmix(a[2], b[2], min(1.0, u * 1.25))
        return keys[-1][1], keys[-1][2]
    def reload_gun(t):
        tilt = ease(t / 0.30) * (1 - ease((t - 1.52) / 0.20))
        ch = ease((t - 1.52) / 0.20) * (1 - ease((t - 1.95) / 0.25))
        M = Rz(5 * tilt + 4 * ch) @ Rx(16 * tilt + 3 * ch) @ Ry(32 * tilt + 10 * ch)      # muzzle up and rolled: the magazine well faces the camera
        G = T(-0.025 * tilt - 0.02 * ch, 0.02 * tilt - 0.01 * ch, 0.06 * tilt + 0.01 * ch) @ about(GRIP_PIVOT, M)      # lifted into view for the swap
        bump = math.exp(-((t - MAG_CLICK - 0.03) / 0.04) ** 2) * 0.004 + math.exp(-((t - 1.95) / 0.035) ** 2) * 0.003
        pull = smooth(0.5, 0.64, t) * (1 - smooth(0.64, 0.75, t))
        return T(0, 0, bump - 0.003 * pull) @ G
    def clip_reload(t, D):
        G = reload_gun(t); P = hold_pose(G)
        L, fL = key_interp(RKEYS, t)
        P['HL'] = G @ L; P['fL'] = fL
        low = smooth(0.55, 0.85, t) * (1 - smooth(1.05, 1.30, t)); up = smooth(1.52, 1.68, t) * (1 - smooth(1.92, 2.12, t))
        ed = (EL_DIR + Vector((0.15, 0.15, 0.25)) * low + Vector((-0.05, -0.35, -0.25)) * up).normalized()
        P['EL'] = P['HL'].translation + ed * 0.26
        P['ER'] = ER0 + Vector((0.01, 0, 0.02)) * ease(t / 0.3) * (1 - ease((t - 1.9) / 0.3))
        if 0.50 <= t <= MAG_CLICK: P['mag'] = G @ L @ OFF_MAG
        if 0.36 < t < 0.58:          # right index presses the magazine release
            k = smooth(0.36, 0.45, t) * (1 - smooth(0.50, 0.58, t))
            P['fR'] = fadd(P['fR'], {'index': (8 * k, 18 * k, 10 * k, -6 * k)})
        P['bolt'] = 0.064 * smooth(1.73, 1.88, t) * (1 - smooth(1.88, 1.94, t))
        return P
    def clip_draw(t, D):
        u = ease(t / D); v = 1 - u
        G = T(0.04 * v, -0.06 * v, -0.30 * v) @ about(GRIP_PIVOT, Rx(-38 * v) @ Ry(-30 * v) @ Rz(-12 * v))
        P = hold_pose(G); P['ER'] = ER0 + Vector((0.04 * v, -0.06 * v, -0.30 * v)); P['EL'] = EL0 + Vector((0.02 * v, -0.06 * v, -0.30 * v))
        open_k = max(0.0, 1 - t / (0.6 * D))
        P['fL'] = fmix(FL_HOLD, OPEN, open_k * 0.6)
        return P
    def clip_run(t, D):
        w = 2 * math.pi * t / D; s1, c1, s2 = math.sin(w), math.cos(w), math.sin(2 * w)
        bob = abs(math.sin(w)) - 0.64
        M = Rz(30 + 3 * s1) @ Rx(18 + 2 * s2) @ Ry(-32 + 2.5 * c1)
        G = T(-0.02 + 0.010 * s1, 0.02, -0.075 + 0.012 * bob) @ about(GRIP_PIVOT, M)
        P = hold_pose(G)
        P['ER'] = G.translation + ER0 + Vector((0.02 * s1, -0.03 * s1, 0.01 * c1)) + Vector((0.02, 0, -0.05))
        P['EL'] = G.translation + EL0 + Vector((0.03, -0.02 * s1, -0.08 + 0.01 * c1))
        return P
    CLIPS = [('vm_idle', 2.8, clip_idle, True), ('vm_fire', 0.1, clip_fire, False), ('vm_reload', 2.2, clip_reload, False),
             ('vm_draw', 0.5, clip_draw, False), ('vm_run', 0.7, clip_run, True)]
    clips =[c for c in CLIPS if c[0] != 'vm_fire'] + [('vm_fire', 0.1, make_fire(), False), ('vm_melee', 0.45, make_melee(0.13, 'jab'), False)]
    return clips, {'seat': MAG_CLICK}


# ---------------------------------------------------------------- the pistol: 9 mm service pistol, polymer frame
def grip_frame(top, angle):
    a = math.radians(angle); return fr(top, (0, math.cos(a), -math.sin(a)), (0, math.sin(a), math.cos(a)))
def gpt(GF, f, u): p = GF @ Vector((0, f, u)); return (p.y, p.z)
def model_pistol():
    k = Kit(2); GF = grip_frame((0, -0.006, 0.058), 18)
    k.prism([gpt(GF, f, u) for f, u in [(-0.021, 0.004), (0.019, 0.004), (0.018, -0.035), (0.016, -0.07), (0.016, -0.1), (-0.019, -0.1),
                                         (-0.022, -0.06), (-0.024, -0.02), (-0.026, 0.0)]], -0.0145, 0.0145, 'polymer', bev=0.002)
    k.prism([(-0.035, 0.058), (-0.035, 0.074), (0.128, 0.074), (0.128, 0.061), (0.072, 0.058), (0.068, 0.054), (0.004, 0.054)], -0.0105, 0.0105, 'polymer', bev=0.0015)
    k.box((0, -0.038, 0.066), (0.022, 0.012, 0.012), 'polymer', bev=0.002)
    k.sweep([(0, 0.002, 0.056), (0, 0.005, 0.036), (0, 0.014, 0.027), (0, 0.058, 0.027), (0, 0.07, 0.036), (0, 0.073, 0.057)], 0.0032, 8, 'polymer')
    k.prism([(0.026, 0.056), (0.031, 0.056), (0.031, 0.047), (0.034, 0.037), (0.031, 0.034), (0.027, 0.045)], -0.003, 0.003, 'polymer', 'trigger', bev=0.0005)
    k.prism([(-0.045, 0.074), (-0.045, 0.101), (-0.041, 0.106), (0.136, 0.106), (0.141, 0.101), (0.141, 0.076), (0.13, 0.074)], -0.0122, 0.0122, 'steel', 'bolt', bev=0.0016)
    for i in range(6):
        for sx in (-1, 1): k.box((sx * 0.0124, -0.041 + i * 0.0042, 0.091), (0.0012, 0.0018, 0.022), 'steel', 'bolt', bev=0.0003)
    k.box((0.0035, 0.044, 0.1058), (0.013, 0.03, 0.0012), 'bright', 'bolt', bev=0.0003)
    k.tube(0.0062, 0.0045, 0.128, 0.1418, 0, 0.090, 16, 'steel', 'bolt')
    k.lathe([(0.0028, 0.128), (0.0028, 0.1405)], T(0, 0, 0.0795), 10, 'bright')
    k.box((0, 0.108, 0.0598), (0.019, 0.034, 0.003), 'polymer', bev=0.0005)
    for sx in (-1, 1):
        k.box((sx * 0.0042, -0.038, 0.1095), (0.0034, 0.008, 0.007), 'steel', 'bolt', bev=0.0005)
        k.box((sx * 0.0042, -0.0423, 0.1105), (0.0016, 0.0006, 0.0016), 'white', 'bolt', bev=0)
    k.box((0, 0.131, 0.1095), (0.0028, 0.006, 0.007), 'steel', 'bolt', bev=0.0004)
    k.box((0, 0.1279, 0.1105), (0.0016, 0.0006, 0.0016), 'white', 'bolt', bev=0)
    k.box((-0.0118, 0.04, 0.0755), (0.0025, 0.02, 0.0042), 'steel', bev=0.0005)
    k.box((-0.0112, 0.065, 0.068), (0.002, 0.008, 0.003), 'steel', bev=0.0004)
    k.box((-0.0148, 0.003, 0.052), (0.002, 0.007, 0.006), 'polymer', bev=0.0005)
    k.prism([gpt(GF, f, u) for f, u in [(-0.016, -0.012), (0.014, -0.012), (0.014, -0.1), (-0.016, -0.1)]], -0.0105, 0.0105, 'steel', 'mag', bev=0.001)
    k.prism([gpt(GF, f, u) for f, u in [(-0.0195, -0.1), (0.0165, -0.1), (0.0165, -0.108), (-0.0205, -0.108)]], -0.013, 0.013, 'polymer', 'mag', bev=0.0012)
    mag = GF @ T(0, -0.002, -0.055)
    return {'kit': k, 'tex': 512, 'bones': {'gun': Matrix(), 'mag': Matrix.Translation(mag.translation), 'bolt': T(0, -0.045, 0.09), 'trigger': T(0, 0.0285, 0.055)},
            'boltdir': Vector((0, -1, 0)), 'grip': GF, 'trigger_pt': Vector((0, 0.0335, 0.041)), 'left': ('pistol', None), 'grip_up': 0.022, 'lthumb': (-0.024, 0.07, 0.064), 'rthumb': (-0.022, 0.05, 0.066),
            'eye': Vector((-0.08, -0.28, 0.148)), 'sight': (0, -0.038, 0.113), 'sightFront': (0, 0.131, 0.113), 'scope': 0.0,
            'muzzle': (0, 0.1418, 0.090), 'eject': (0.013, 0.045, 0.104), 'ejectDir': (0.7, -0.15, 0.7), 'ejectAt': 1 / 30.0,
            'pivot': (0, -0.01, 0.05), 'rough': 0.55, 'anim': pistol_anim}
def pistol_anim(W):
    GF = W['grip']; U = GF.col[2].to_3d(); F = GF.col[1].to_3d()
    bottom = GF @ Vector((0, -0.002, -0.108))
    LMP = settle(place((0, 4.8, -1.8), bottom - U * 0.004, F, -U, 'L'), 'L', BVH_GUN, direction=U)
    FL_MAG = grasp(LMP, 'L', BVH_GUN, start=(15, 20, 10)); OFFM = LMP.inverted() @ REST['mag']
    LS = settle(place((0, 4.8, -1.8), (-0.004, -0.022, 0.128), (0.9, 0.0, -0.35), (0.35, 0.0, 0.94), 'L'), 'L', BVH_BOLT)      # overhand on the slide's rear
    FL_S = grasp(LS, 'L', BVH_BOLT, start=(10, 10, 5))
    SEAT = 0.98
    keys = [(0.0, HL0, FL_HOLD), (0.08, T(-0.01, 0, -0.01) @ HL0, OPEN), (0.32, T(-0.07, -0.06, -0.33) @ LMP @ Rx(20), OPEN),
            (0.46, T(-0.07, -0.05, -0.30) @ LMP @ Rx(15), FL_MAG), (0.62, T(-0.03, -0.03, -0.13) @ LMP, FL_MAG), (0.84, T(0, 0, -0.045) @ LMP, FL_MAG),
            (0.95, LMP, FL_MAG), (SEAT, T(0, 0, 0.004) @ LMP, FL_MAG), (1.04, T(-0.02, -0.01, -0.01) @ LMP, OPEN),
            (1.22, T(-0.015, 0, -0.012) @ HL0, OPEN), (1.36, HL0, FL_HOLD), (1.60, HL0, FL_HOLD)]      # the left hand goes straight back to the support grip
    def c_reload(t, D):
        a = ease(t / 0.25) * (1 - ease((t - 1.04) / 0.16)); b = 0.0
        G = T(-0.04 * a, 0.09 * a, 0.085 * a) @ about(W['pivot'], Rz(10 * a) @ Rx(18 * a) @ Ry(26 * a))      # lifted, muzzle up, rolled: the grip's bottom and the magazine swap are in view
        G = T(0, 0, 0.004 * bump(t, SEAT + 0.02, 0.03) + 0.003 * bump(t, 1.37, 0.03)) @ G
        P = hold_pose(G); L, fL = key_interp(keys, t); P['HL'] = G @ L; P['fL'] = fL
        low = smooth(0.1, 0.3, t) * (1 - smooth(0.6, 0.85, t))
        rk = smooth(1.02, 1.14, t) * (1 - smooth(1.38, 1.52, t))
        P['EL'] = P['HL'].translation + (EL_DIR + Vector((0.1, 0.1, 0.3)) * low + Vector((0.1, 0.35, -0.3)) * rk).normalized() * 0.26
        P['ER'] = ER0 + G.translation
        if t >= 0.12 and t < 0.46:
            fall = 0.5 * 9.8 * (t - 0.12) ** 2 + 0.04 * smooth(0.06, 0.14, t)
            P['mag'] = G @ T(0, 0, -fall) @ REST['mag']
        elif 0.46 <= t <= SEAT: P['mag'] = G @ L @ OFFM
        k = bump(t, 0.1, 0.05); P['fR'] = fadd(P['fR'], {'thumb': (6 * k, 18 * k, 20 * k, 0)})
        P['bolt'] = 0.046 * smooth(0.02, 0.06, t) * (1 - smooth(1.16, 1.19, t))      # slide locked back (empty), released by the right thumb at 1.16
        kt = bump(t, 1.14, 0.05); P['fR'] = fadd(P['fR'], {'thumb': (4 * kt, 14 * kt, 16 * kt, 0)})
        return P
    clips = std_clips(fire=make_fire(0.008, 4.0, (0, 0.030, 0.012, 0)), draw=make_draw(0.25, 0.05, 0.03, -30, -20, -8),
                      run=make_run(18, -12, -8, (0.02, 0.0, -0.015), 0.010), melee=make_melee(0.12, 'jab'))
    return clips + [('vm_reload', 1.6, c_reload, False)], {'seat': SEAT}
MODELS = {'carbine': model_carbine, 'pistol': model_pistol}

# ---------------------------------------------------------------- the shotgun: 12-gauge pump, wood pump and stock, pistol grip
CARBINE_GRIP = [(-0.013, 0.048), (0.028, 0.048), (0.024, 0.02), (0.02, -0.01), (0.006, -0.047), (-0.031, -0.047), (-0.027, -0.02), (-0.02, 0.01)]
def ar_guard(k, y0=-0.002, y1=0.074, z=0.022, top=0.048):
    k.sweep([(0, y0, top), (0, y0 + 0.002, top - 0.018), (0, y0 + 0.014, z), (0, y1 - 0.016, z), (0, y1 - 0.004, z + 0.01), (0, y1, top)], 0.0032, 8, 'alloy')
def model_shotgun():
    k = Kit(2)
    k.prism([(-0.062, 0.048), (-0.062, 0.094), (-0.05, 0.1), (0.125, 0.1), (0.13, 0.095), (0.13, 0.05), (0.12, 0.048)], -0.0145, 0.0145, 'steel', bev=0.0015)
    k.box((0, 0.075, 0.0476), (0.02, 0.07, 0.0012), 'dark', bev=0)
    k.box((0.0149, 0.06, 0.08), (0.0006, 0.05, 0.02), 'dark', bev=0)
    k.box((0.0154, 0.06, 0.08), (0.0008, 0.038, 0.013), 'bright', 'bolt', bev=0.0002)
    k.tube(0.0115, 0.0092, 0.13, 0.62, 0, 0.088, 20, 'steel')
    k.box((0, 0.37, 0.1003), (0.006, 0.48, 0.0018), 'steel', bev=0.0004)
    k.lathe([(0, -0.002), (0.0015, -0.0015), (0.002, 0), (0.0015, 0.0015), (0, 0.002)], T(0, 0.605, 0.1035), 8, 'brass')
    for sx in (-1, 1): k.box((sx * 0.0032, -0.05, 0.1025), (0.0024, 0.006, 0.007), 'steel', bev=0.0004)
    k.box((0, -0.05, 0.1005), (0.012, 0.008, 0.002), 'steel', bev=0.0004)
    k.lathe([(0.0115, 0.13), (0.0115, 0.555), (0.0125, 0.555), (0.0125, 0.575), (0.0, 0.577)], T(0, 0, 0.062), 16, 'steel')
    k.box((0, 0.56, 0.075), (0.016, 0.012, 0.034), 'steel', bev=0.001)
    prof = [(0.0185, 0.19), (0.021, 0.196)]
    for i in range(8):
        y = 0.205 + i * 0.018; prof += [(0.0215, y), (0.0215, y + 0.006), (0.0203, y + 0.009), (0.0203, y + 0.015)]
    prof += [(0.021, 0.355), (0.0185, 0.36)]
    k.lathe(prof, T(0, 0, 0.066), 20, 'wood', 'pump')
    for sx in (-1, 1): k.box((sx * 0.0105, 0.16, 0.07), (0.002, 0.08, 0.004), 'steel', 'pump', bev=0.0004)
    ar_guard(k)
    k.prism([(0.032, 0.048), (0.038, 0.048), (0.038, 0.04), (0.041, 0.03), (0.037, 0.028), (0.033, 0.04)], -0.003, 0.003, 'steel', 'trigger', bev=0.0005)
    k.prism([(-0.062, 0.048), (0.12, 0.048), (0.12, 0.044), (-0.062, 0.044)], -0.012, 0.012, 'alloy', bev=0.001)
    k.prism(CARBINE_GRIP, -0.013, 0.013, 'polymer', bev=0.002)
    k.prism([(-0.062, 0.092), (-0.062, 0.05), (-0.09, 0.04), (-0.33, 0.02), (-0.335, 0.086), (-0.2, 0.087)], -0.017, 0.017, 'wood', bev=0.003)
    k.prism([(-0.335, 0.088), (-0.335, 0.017), (-0.355, 0.015), (-0.355, 0.09)], -0.018, 0.018, 'rubber', bev=0.002)
    k.box((-0.0148, 0.012, 0.052), (0.0016, 0.006, 0.005), 'steel', bev=0.0004)
    k.lathe([(0, 0.0), (0.0098, 0.0), (0.0098, 0.012)], T(0, 0.2, 0.062), 12, 'brass', 'mag', caps=False)
    k.lathe([(0.0093, 0.012), (0.0093, 0.066), (0.006, 0.069), (0.0, 0.0695)], T(0, 0.2, 0.062), 12, 'red', 'mag', caps=True)
    return {'kit': k, 'tex': 1024, 'bones': {'gun': Matrix(), 'mag': T(0, 0.235, 0.062), 'bolt': T(0, 0.06, 0.08), 'trigger': T(0, 0.035, 0.047),
                                               'pump': T(0, 0.275, 0.066)},
            'boltdir': Vector((0, -1, 0)), 'grip': GF_CARBINE, 'trigger_pt': Vector((0, 0.0385, 0.034)), 'left': ('handguard', T(0, 0.275, 0.045)),
            'eye': Vector((-0.19, -0.32, 0.126)), 'sight': (0, -0.05, 0.1045), 'sightFront': (0, 0.605, 0.1053), 'scope': 0.0,
            'muzzle': (0, 0.62, 0.088), 'eject': (0.017, 0.06, 0.082), 'ejectDir': (0.8, -0.1, 0.6), 'pivot': (0.0, -0.01, 0.03), 'rough': 0.55,
            'anim': shotgun_anim}
def shotgun_anim(W):
    PUMP = 0.085
    def pump_pose(P, G, p):
        P['d'] = {'pump': T(0, -PUMP * p, 0), 'bolt': T(0, -PUMP * p, 0)}; P['HL'] = G @ T(0, -PUMP * p, 0) @ HL0
        P['EL'] = EL0 + G.translation + Vector((0, -PUMP * p, 0))
    def c_fire(t, D):
        k = smooth(0.0, 0.03, t) * (1 - smooth(0.05, 0.22, t))
        p = smooth(0.22, 0.37, t) * (1 - smooth(0.42, 0.57, t))
        G = about(W['pivot'], T(-0.006 * p, -0.022 * k - 0.006 * p, 0.003 * k - 0.008 * p) @ Rx(6 * k - 2 * p) @ Ry(-5 * p) @ Rz(2 * p))
        P = hold_pose(G); pump_pose(P, G, p); P['ER'] = ER0 + G.translation
        P['trig'] = -13 * smooth(0.0, 0.03, t) * (1 - smooth(0.1, 0.25, t))
        P['fR'] = dict(FR_TRIG); P['fL'] = fadd(P['fL'], {n: (5 * p, 5 * p, 0, 0) for n in ('index', 'middle', 'ring', 'pinky')})
        return P
    PORT = T(0, 0.04, 0.050)           # a shell lying in the loading port, pointing forward
    LP = place((-1.5, 11.0, -1.4), (0.0, 0.03, 0.047), (0.15, 0.98, 0.15), (-0.35, 0.0, -0.94), 'L')
    OFFS = LP.inverted() @ PORT
    PINCH = {'index': (30, 35, 25, -11), 'middle': (35, 45, 30, 0), 'ring': (55, 70, 45, 8), 'pinky': (60, 75, 45, 17), 'thumb': (25, 25, 20, 0)}
    BELOW = T(-0.06, -0.08, -0.32) @ LP @ Rx(25)
    keys = [(0.0, HL0, FL_HOLD), (0.10, T(-0.01, 0, -0.01) @ HL0, OPEN)]
    pushes = []
    for t0 in (0.30, 0.90, 1.50):
        keys += [(t0, BELOW, PINCH), (t0 + 0.30, T(0, -0.035, -0.012) @ LP, PINCH), (t0 + 0.42, LP, PINCH), (t0 + 0.48, T(0, 0.025, 0.004) @ LP, PINCH)]
        pushes.append(t0 + 0.42)
    SEAT = pushes[-1] + 0.06
    keys += [(2.12, T(-0.02, 0, -0.03) @ HL0, OPEN), (2.24, HL0, FL_HOLD), (2.80, HL0, FL_HOLD)]
    def c_reload(t, D):
        r = ease(t / 0.3) * (1 - ease((t - 2.0) / 0.25))
        p = smooth(2.30, 2.45, t) * (1 - smooth(2.50, 2.66, t))
        G = T(-0.03 * r, 0.0, 0.035 * r) @ about(W['pivot'], Rz(8 * r) @ Rx(10 * r) @ Ry(55 * r))
        G = T(0, 0, sum(0.003 * bump(t, tp + 0.03, 0.03) for tp in pushes)) @ G
        P = hold_pose(G); L, fL = key_interp(keys, t); P['HL'] = G @ L; P['fL'] = fL
        low = max(bump(t, t0 + 0.08, 0.12) for t0 in (0.30, 0.90, 1.50)) * (1 - smooth(1.95, 2.1, t))
        P['EL'] = P['HL'].translation + (EL_DIR + Vector((0.15, 0.2, 0.2)) * low).normalized() * 0.26
        P['ER'] = ER0 + G.translation
        sh = None
        for tp in pushes:
            if tp - 0.62 < t <= tp: sh = G @ L @ OFFS
            elif tp < t <= tp + 0.06:
                s = (t - tp) / 0.06; sh = G @ T(0, 0.07 * s, 0.012 * s) @ PORT
        if sh is not None: P['mag'] = sh
        if t >= 2.2: pump_pose(P, G, p)
        return P
    clips = [c if c[0] != 'vm_fire' else ('vm_fire', 0.75, c_fire, False) for c in std_clips(fire=c_fire, melee=make_melee(0.13, 'butt'))]
    return clips + [('vm_reload', 2.8, c_reload, False)], {'seat': SEAT, 'ejectAt': 0.36}
MODELS['shotgun'] = model_shotgun

# ---------------------------------------------------------------- shared: box magazine change (the carbine's moves, for any gun)
def mag_grab(magc, approach=(0.08, 0.80, 0.60), palm=(-0.98, 0.12, 0.0)):
    LM = settle(place((0, 5.6, -1.75), Vector(magc) + Vector((-0.02, -0.006, 0)), approach, palm, 'L'), 'L', BVH_MAG, roots=False)
    return LM, grasp(LM, 'L', BVH_MAG)
def lever_grab(pt, ydir=(0.15, 0.25, 0.96), zdir=(-0.97, 0.05, 0.2)):
    LC = settle(place((-2.85, 9.3, -1.2), pt, ydir, zdir, 'L'), 'L', BVH_GUN, clear=0.002)
    return LC, grasp(LC, 'L', BVH_GUN, start=(10, 10, 5))
def box_mag_reload(W, D, seat, grab, LM, FL_MAG, drop=0.38, tilt=(5, 7, 24), lever=None, pull=0.05, post=None, finish_end=None):
    """left hand: support -> magazine -> pull it down out of view -> fresh one up -> seat at `seat` -> optional lever pull -> support.
    lever = (LC, FL_CH, t0): grab the lever at t0, pull it back by `pull` (bolt bone), let go."""
    OFF = LM.inverted() @ REST['mag']; g = grab; s = seat
    down = lambda dz, dx=0.0, rot=0.0: T(dx, 0, dz) @ LM @ Rx(rot)
    keys = [(0.0, HL0, FL_HOLD), (0.10, HL0, FL_HOLD), (0.5 * g + 0.05, T(-0.03, -0.04, -0.03) @ mlerp(HL0, LM, 0.5), OPEN),
            (g - 0.08, T(-0.012, 0, -0.016) @ LM, OPEN), (g, LM, FL_MAG), (g + 0.06, LM, FL_MAG), (g + 0.14, down(-0.07), FL_MAG),
            (g + 0.36, T(-0.10, -0.06, -drop) @ LM @ Rx(25), FL_MAG), (0.5 * (g + s) - 0.02, T(-0.08, -0.04, -drop - 0.02) @ LM @ Rx(15), FL_MAG),
            (s - 0.30, down(-0.12, -0.02, 8), FL_MAG), (s - 0.10, down(-0.016), FL_MAG), (s, T(0, 0, 0.003) @ LM, FL_MAG), (s + 0.05, LM, FL_MAG)]      # the fresh one is seen coming up and going home
    end = s + 0.05
    if lever:
        LC, FL_CH, t0 = lever
        keys += [(t0 - 0.12, T(-0.02, -0.01, -0.02) @ mlerp(LM, LC, 0.4), OPEN), (t0 - 0.04, T(-0.004, 0.006, 0.018) @ LC, OPEN),
                 (t0, LC, FL_CH), (t0 + 0.14, T(0, -pull, -0.003) @ LC, FL_CH), (t0 + 0.18, T(-0.006, -pull - 0.012, 0.004) @ LC, OPEN)]
        end = t0 + 0.18
    t_back = finish_end or (D - 0.08)
    keys += [(0.5 * (end + t_back), T(-0.03, -0.02, -0.02) @ mlerp(keys[-1][1], HL0, 0.6), OPEN), (t_back, HL0, fmix(OPEN, FL_HOLD, 0.6)), (D, HL0, FL_HOLD)]
    def c_reload(t, D_):
        tl = ease(t / 0.30) * (1 - ease((t - s - 0.07) / 0.20))
        ch = (smooth(lever[2] - 0.2, lever[2], t) * (1 - smooth(lever[2] + 0.2, lever[2] + 0.4, t))) if lever else 0.0
        M = Rz(tilt[0] * tl + 4 * ch) @ Rx((tilt[1] + 9) * tl + 3 * ch) @ Ry((tilt[2] + 8) * tl + 10 * ch)      # muzzle up and rolled: the magazine well faces the camera
        G = T(-0.025 * tl - 0.02 * ch, 0.02 * tl - 0.01 * ch, 0.06 * tl + 0.01 * ch) @ about(W['pivot'], M)      # lifted into view for the swap
        bmp = 0.004 * bump(t, s + 0.03, 0.04) + ((0.003 * bump(t, lever[2] + 0.2, 0.035)) if lever else 0.0)
        G = T(0, 0, bmp - 0.003 * smooth(g, g + 0.14, t) * (1 - smooth(g + 0.14, g + 0.25, t))) @ G
        P = hold_pose(G); L, fL = key_interp(keys, t); P['HL'] = G @ L; P['fL'] = fL
        low = smooth(g + 0.05, g + 0.35, t) * (1 - smooth(s - 0.35, s - 0.1, t))
        up = (smooth(lever[2] - 0.2, lever[2] - 0.05, t) * (1 - smooth(lever[2] + 0.2, lever[2] + 0.4, t))) if lever else 0.0
        P['EL'] = P['HL'].translation + (EL_DIR + Vector((0.15, 0.15, 0.25)) * low + Vector((-0.05, -0.35, -0.25)) * up).normalized() * 0.26
        P['ER'] = ER0 + Vector((0.01, 0, 0.02)) * tl + G.translation * 0.5
        if g <= t <= s: P['mag'] = G @ L @ OFF
        if lever: P['bolt'] = pull * smooth(lever[2], lever[2] + 0.14, t) * (1 - smooth(lever[2] + 0.15, lever[2] + 0.19, t))
        if post: post(t, P, G)
        return P
    return c_reload

# ---------------------------------------------------------------- the SMG: compact 9 mm, folding stock, vertical foregrip, red dot
def model_smg():
    k = Kit(2)
    k.box((0, 0.045, 0.1125), (0.026, 0.25, 0.045), 'alloy', bev=0.0018)
    k.box((0, 0.045, 0.1385), (0.020, 0.24, 0.007), 'alloy', bev=0.0008)
    for i in range(16): k.box((0, -0.065 + i * 0.0145, 0.1435), (0.021, 0.006, 0.003), 'alloy', bev=0.0005)
    k.prism([(-0.065, 0.048), (-0.065, 0.09), (0.13, 0.09), (0.13, 0.06), (0.10, 0.048), (0.10, 0.02), (0.06, 0.02), (0.06, 0.048)], -0.0125, 0.0125, 'polymer', bev=0.0015)
    k.prism(CARBINE_GRIP, -0.013, 0.013, 'polymer', bev=0.002)
    ar_guard(k)
    k.prism([(0.032, 0.048), (0.038, 0.048), (0.038, 0.04), (0.041, 0.03), (0.037, 0.028), (0.033, 0.04)], -0.003, 0.003, 'steel', 'trigger', bev=0.0005)
    k.box((0, 0.235, 0.110), (0.036, 0.13, 0.046), 'polymer', bev=0.004)
    for i in range(4):
        for sx in (-1, 1): k.box((sx * 0.0181, 0.195 + i * 0.026, 0.112), (0.0012, 0.016, 0.008), 'dark', bev=0)
    k.lathe([(0.011, 0.298), (0.011, 0.335), (0.0095, 0.34), (0.0095, 0.345), (0.0045, 0.345), (0.0045, 0.298)], T(0, 0, 0.112), 16, 'steel', loop=True)
    for i in range(3): k.box((0, 0.31 + i * 0.009, 0.1235), (0.006, 0.004, 0.003), 'dark', bev=0)
    k.prism([(0.068, 0.06), (0.092, 0.06), (0.092, -0.15), (0.068, -0.15)], -0.0105, 0.0105, 'steel', 'mag', bev=0.0012)
    k.prism([(0.064, -0.15), (0.096, -0.15), (0.096, -0.158), (0.064, -0.158)], -0.0125, 0.0125, 'polymer', 'mag', bev=0.0012)
    k.lathe([(0.0, 0.0), (0.0135, 0.0), (0.0145, 0.015)] + [(0.0145 if i % 2 else 0.0133, 0.015 + i * 0.0135) for i in range(1, 7)] + [(0.0145, 0.1), (0.0, 0.102)],
            T(0, 0.24, 0.087) @ Rx(-90), 16, 'polymer')
    for sx in (-1, 1): k.sweep([(sx * 0.009, -0.065, 0.12), (sx * 0.009, -0.17, 0.11), (sx * 0.009, -0.28, 0.095)], 0.0045, 8, 'steel')
    k.box((0, -0.072, 0.11), (0.03, 0.016, 0.04), 'polymer', bev=0.002)
    k.prism([(-0.28, 0.13), (-0.28, 0.03), (-0.296, 0.028), (-0.296, 0.132)], -0.018, 0.018, 'rubber', bev=0.002)
    k.box((-0.0135, 0.13, 0.126), (0.0012, 0.07, 0.006), 'dark', bev=0)
    k.box((-0.024, 0.16, 0.126), (0.022, 0.006, 0.006), 'steel', 'bolt', bev=0.0008)
    k.lathe([(0.0, 0.0), (0.006, 0.002), (0.006, 0.012), (0.0, 0.014)], T(-0.036, 0.16, 0.126) @ Rz(90), 10, 'polymer', 'bolt')
    k.box((0.0131, 0.055, 0.112), (0.0008, 0.045, 0.016), 'dark', bev=0)
    k.box((-0.0128, -0.03, 0.078), (0.002, 0.012, 0.005), 'steel', bev=0.0004)
    k.box((0, 0.035, 0.1455), (0.016, 0.028, 0.006), 'alloy', bev=0.0008)
    k.tube(0.0125, 0.0105, 0.02, 0.05, 0, 0.158, 24, 'alloy')
    k.box((0.0135, 0.035, 0.158), (0.004, 0.01, 0.008), 'alloy', bev=0.0008)
    return {'kit': k, 'tex': 1024, 'bones': {'gun': Matrix(), 'mag': T(0, 0.08, -0.04), 'bolt': T(-0.03, 0.16, 0.126), 'trigger': T(0, 0.035, 0.047)},
            'boltdir': Vector((0, -1, 0)), 'grip': GF_CARBINE, 'trigger_pt': Vector((0, 0.0385, 0.034)),
            'left': ('vgrip', fr((0, 0.24, 0.087), (0, 1, 0), (0, 0, 1))),
            'eye': Vector((-0.18, -0.30, 0.176)), 'sight': (0, 0.02, 0.158), 'sightFront': (0, 0.05, 0.158), 'scope': 0.0105,
            'muzzle': (0, 0.345, 0.112), 'eject': (0.015, 0.06, 0.113), 'ejectDir': (0.85, 0.1, 0.5), 'ejectAt': 1 / 30.0,
            'pivot': (0.0, -0.01, 0.03), 'magc': (0, 0.08, -0.06), 'anim': smg_anim}
def smg_anim(W):
    LM, FL_MAG = mag_grab(W['magc'])
    LC, FL_CH = lever_grab((-0.03, 0.163, 0.126), (0.1, 0.35, 0.93), (-0.97, 0.05, 0.2))
    seat = 1.20
    rel = box_mag_reload(W, 2.0, seat, 0.42, LM, FL_MAG, lever=(LC, FL_CH, 1.45), pull=0.05)
    clips = std_clips(fire=make_fire(0.004, 0.5, (0, 0.008, 0.003, 0)), melee=make_melee(0.12, 'jab'))
    return clips + [('vm_reload', 2.0, rel, False)], {'seat': seat}
MODELS['smg'] = model_smg

# ---------------------------------------------------------------- the sniper: bolt action, tan stock, long scope (hollow)
BORE_Z = 0.095
def model_sniper():
    k = Kit(2)
    k.lathe([(0.0, -0.072), (0.016, -0.07), (0.016, 0.14), (0.0, 0.142)], T(0, 0, BORE_Z), 20, 'steel')
    prof = [(0.012, 0.14), (0.0118, 0.30), (0.0095, 0.62), (0.0088, 0.70), (0.0105, 0.70), (0.0105, 0.735), (0.0055, 0.735), (0.0055, 0.14)]
    k.lathe(prof, T(0, 0, BORE_Z), 18, 'steel', loop=True)
    for i in range(4): k.box((0, 0.708 + i * 0.007, BORE_Z + 0.0105), (0.006, 0.0035, 0.002), 'dark', bev=0)
    k.lathe([(0.0, -0.11), (0.0105, -0.108), (0.0115, -0.09), (0.0115, -0.07), (0.0, -0.068)], T(0, 0, BORE_Z), 16, 'steel', 'bolt')
    k.lathe([(0.0098, -0.07), (0.0098, 0.02)], T(0, 0, BORE_Z), 16, 'bright', 'bolt', caps=False)
    k.sweep([(0.010, -0.035, BORE_Z), (0.028, -0.04, BORE_Z - 0.004), (0.042, -0.046, BORE_Z - 0.010)], 0.0032, 8, 'steel', 'bolt')
    k.lathe([(0.0, -0.011), (0.006, -0.009), (0.009, -0.003), (0.009, 0.004), (0.006, 0.009), (0.0, 0.011)],
            T(0.049, -0.048, BORE_Z - 0.013) @ Rz(-75) @ Rx(-15), 12, 'polymer', 'bolt')
    k.box((0.0155, 0.04, BORE_Z + 0.004), (0.002, 0.06, 0.014), 'dark', bev=0)
    stock = [(-0.07, 0.092), (-0.07, 0.048), (-0.10, 0.04), (-0.37, 0.02), (-0.38, 0.098), (-0.30, 0.096), (-0.25, 0.104), (-0.12, 0.104), (-0.10, 0.092)]
    k.prism(stock, -0.019, 0.019, 'tan', bev=0.003)
    k.prism([(-0.38, 0.1), (-0.38, 0.018), (-0.398, 0.016), (-0.398, 0.102)], -0.02, 0.02, 'rubber', bev=0.002)
    k.prism([(-0.072, 0.085), (0.36, 0.085), (0.36, 0.062), (0.33, 0.045), (0.14, 0.045), (0.135, 0.06), (0.075, 0.06), (0.07, 0.045), (-0.002, 0.045), (-0.072, 0.048)],
            -0.02, 0.02, 'tan', bev=0.003)
    k.prism(CARBINE_GRIP, -0.0135, 0.0135, 'tan', bev=0.002)
    ar_guard(k, top=0.046)
    k.prism([(0.032, 0.048), (0.038, 0.048), (0.038, 0.04), (0.041, 0.03), (0.037, 0.028), (0.033, 0.04)], -0.003, 0.003, 'steel', 'trigger', bev=0.0005)
    k.prism([(0.077, 0.062), (0.133, 0.062), (0.133, 0.022), (0.077, 0.022)], -0.0125, 0.0125, 'steel', 'mag', bev=0.0012)
    k.prism([(0.074, 0.022), (0.136, 0.022), (0.136, 0.015), (0.074, 0.015)], -0.0145, 0.0145, 'polymer', 'mag', bev=0.0012)
    SZ = 0.14; y0 = -0.065
    k.lathe([(0.0215, y0), (0.0215, y0 + 0.07), (0.0195, y0 + 0.085), (0.0195, y0 + 0.17), (0.0245, y0 + 0.205), (0.0245, y0 + 0.26), (0.017, y0 + 0.26), (0.017, y0)],
            T(0, 0, SZ), 28, 'alloy', loop=True)
    k.lathe([(0.0, 0.0), (0.0085, 0.0), (0.0085, 0.0045), (0.0, 0.0047)], T(0, 0.055, SZ + 0.0195) @ Rx(90), 14, 'alloy')
    k.lathe([(0.0, 0.0), (0.0085, 0.0), (0.0085, 0.012), (0.0, 0.0125)], T(0.0195, 0.055, SZ) @ Rz(-90), 14, 'alloy')
    k.lathe([(0.0, 0.0), (0.007, 0.0), (0.007, 0.01), (0.0, 0.0105)], T(-0.0195, 0.055, SZ) @ Rz(90), 12, 'alloy')
    for yy in (0.0, 0.11):
        k.lathe([(0.0225, yy - 0.008), (0.0225, yy + 0.008)], T(0, 0, SZ), 20, 'alloy', caps=False)
        k.box((0, yy, 0.121), (0.014, 0.016, 0.024), 'alloy', bev=0.0015)
    k.box((0, 0.05, 0.1125), (0.012, 0.15, 0.004), 'alloy', bev=0.0008)
    return {'kit': k, 'tex': 1024, 'bones': {'gun': Matrix(), 'mag': T(0, 0.105, 0.04), 'bolt': T(0, -0.07, BORE_Z), 'trigger': T(0, 0.035, 0.047)},
            'boltdir': Vector((0, -1, 0)), 'grip': GF_CARBINE, 'trigger_pt': Vector((0, 0.0385, 0.034)), 'left': ('handguard', T(0, 0.27, 0.045)),
            'eye': Vector((-0.19, -0.33, 0.158)), 'sight': (0, y0, SZ), 'sightFront': (0, y0 + 0.26, SZ), 'scope': 0.017,
            'muzzle': (0, 0.735, BORE_Z), 'eject': (0.017, 0.04, BORE_Z + 0.006), 'ejectDir': (0.85, -0.2, 0.5), 'pivot': (0.0, -0.01, 0.03),
            'magc': (0, 0.105, 0.03), 'rough': 0.6, 'anim': sniper_anim}
def bolt_action(W):
    knob = Vector((0.049, -0.048, BORE_Z - 0.013))
    HK = place((-2.85, 9.3, -1.0), knob + Vector((0.004, 0.006, 0.013)), (-0.25, 0.55, -0.8), (0.75, 0.25, 0.6), 'R')
    PIN = grasp(HK, 'R', BVH_BOLT, start=(10, 15, 10), thumb_start=(0, 10, 10))
    PIN['thumb'] = close_chain(HK, 'R', 'thumb', BVH_BOLT, (0, 10, 10), (55, 70, 80))
    def state(u):
        lift = 62 * smooth(0.20, 0.30, u) * (1 - smooth(0.59, 0.68, u)); pull = 0.085 * smooth(0.31, 0.43, u) * (1 - smooth(0.47, 0.59, u))
        return T(0, -pull, 0) @ Rax(-lift, (0, 1, 0), (0, 0, BORE_Z))
    def apply(P, G, u):
        if u < 0 or u > 0.9: return
        Db = state(u); w = smooth(0.0, 0.17, u) * (1 - smooth(0.70, 0.87, u))
        A = G @ HR0; B = G @ Db @ HK
        P['HR'] = T(0, 0, 0.03 * math.sin(math.pi * w)) @ mlerp(A, B, w)
        P['fR'] = fmix(FR_HOLD, PIN, min(1.0, w * 1.3)); P['d'] = dict(P.get('d', {}), bolt=Db)
        P['ER'] = ER0 + G.translation + Vector((0.03, 0.02, 0.06)) * w
    return apply
def sniper_anim(W):
    cyc = bolt_action(W)
    def c_fire(t, D):
        k = smooth(0.0, 0.03, t) * (1 - smooth(0.06, 0.30, t)); s = smooth(0.25, 0.4, t) * (1 - smooth(0.95, 1.15, t))
        G = about(W['pivot'], T(-0.01 * s, -0.016 * k, 0.004 * k + 0.012 * s) @ Rx(7 * k + 3 * s) @ Ry(12 * s) @ Rz(4 * s))
        P = hold_pose(G); P['ER'] = ER0 + G.translation
        P['trig'] = -12 * smooth(0, 0.03, t) * (1 - smooth(0.12, 0.25, t))
        P['fR'] = dict(FR_TRIG) if t < 0.25 or t > 1.12 else dict(FR_HOLD)
        cyc(P, G, t - 0.25)
        return P
    LM, FL_MAG = mag_grab(W['magc'])
    seat = 1.30
    rel = box_mag_reload(W, 2.6, seat, 0.40, LM, FL_MAG, finish_end=1.65,
                         post=lambda t, P, G: cyc(P, G, t - 1.55))
    clips = [c if c[0] != 'vm_fire' else ('vm_fire', 1.25, c_fire, False) for c in std_clips(melee=make_melee(0.13, 'butt'))]
    return clips + [('vm_reload', 2.6, rel, False)], {'seat': seat, 'ejectAt': 0.25 + 0.41}
MODELS['sniper'] = model_sniper

# ---------------------------------------------------------------- the LMG: belt-fed light machine gun, box under the left side, folded bipod
def model_lmg():
    k = Kit(2)
    k.box((0, 0.03, 0.10), (0.046, 0.26, 0.08), 'steel', bev=0.002)
    k.box((0, 0.05, 0.1475), (0.044, 0.18, 0.015), 'steel', 'pump', bev=0.0015)      # feed cover (hinged at its front edge)
    k.box((0, 0.05, 0.1405), (0.04, 0.17, 0.002), 'dark', bev=0)                       # feed tray under it
    k.prism([(-0.05, 0.065), (0.09, 0.065), (0.09, 0.05), (0.07, 0.046), (-0.05, 0.046)], -0.014, 0.014, 'polymer', bev=0.0015)
    k.prism(CARBINE_GRIP, -0.013, 0.013, 'polymer', bev=0.002)
    ar_guard(k)
    k.prism([(0.032, 0.048), (0.038, 0.048), (0.038, 0.04), (0.041, 0.03), (0.037, 0.028), (0.033, 0.04)], -0.003, 0.003, 'steel', 'trigger', bev=0.0005)
    k.lathe([(0.0125, 0.16), (0.0125, 0.64), (0.0145, 0.64), (0.0145, 0.70), (0.006, 0.70), (0.006, 0.16)], T(0, 0, 0.105), 18, 'steel', loop=True)
    for i in range(5): k.box((0, 0.648 + i * 0.01, 0.1195), (0.006, 0.004, 0.003), 'dark', bev=0)
    k.lathe([(0.008, 0.16), (0.008, 0.49), (0.0, 0.492)], T(0, 0, 0.083), 12, 'steel')
    k.box((0, 0.26, 0.10), (0.044, 0.20, 0.05), 'polymer', bev=0.004)
    for i in range(5):
        for sx in (-1, 1): k.box((sx * 0.0222, 0.185 + i * 0.035, 0.10), (0.001, 0.022, 0.01), 'dark', bev=0)
    k.sweep([(-0.016, 0.165, 0.145), (-0.03, 0.19, 0.185), (-0.03, 0.29, 0.185), (-0.016, 0.315, 0.125)], 0.006, 10, 'steel')
    k.box((-0.03, 0.24, 0.185), (0.016, 0.07, 0.016), 'polymer', bev=0.004)
    for sx in (-1, 1): k.sweep([(sx * 0.009, 0.52, 0.084), (sx * 0.011, 0.45, 0.079), (sx * 0.012, 0.37, 0.077)], 0.0045, 8, 'steel')
    k.box((0, 0.525, 0.084), (0.03, 0.02, 0.014), 'steel', bev=0.0015)
    k.prism([(-0.10, 0.135), (-0.10, 0.065), (-0.13, 0.055), (-0.38, 0.03), (-0.385, 0.125), (-0.2, 0.128)], -0.02, 0.02, 'polymer', bev=0.003)
    k.prism([(-0.385, 0.127), (-0.385, 0.028), (-0.402, 0.026), (-0.402, 0.129)], -0.021, 0.021, 'rubber', bev=0.002)
    k.box((-0.03, 0.08, -0.02), (0.05, 0.10, 0.16), 'olive', 'mag', bev=0.003)
    k.box((-0.03, 0.08, 0.063), (0.054, 0.104, 0.006), 'olive', 'mag', bev=0.0015)
    k.box((-0.056, 0.08, 0.0), (0.004, 0.05, 0.03), 'dark', 'mag', bev=0.001)
    k.sweep([(-0.03, 0.06, 0.066), (-0.028, 0.06, 0.085), (-0.02, 0.06, 0.098)], 0.008, 8, 'olive', 'mag')
    for x, z in ((-0.036, 0.074), (-0.037, 0.088), (-0.036, 0.102), (-0.033, 0.116), (-0.027, 0.128), (-0.018, 0.1385), (-0.008, 0.1425)):     # belt out of the box onto the tray
        k.lathe([(0.0, 0.088), (0.0042, 0.088), (0.0042, 0.122), (0.0026, 0.130), (0.0, 0.1305)], T(x, 0, z), 8, 'brass', 'mag')
        k.box((x, 0.098, z), (0.0095, 0.006, 0.0095), 'dark', 'mag', bev=0)
    k.box((-0.024, 0.12, 0.10), (0.0012, 0.08, 0.008), 'dark', bev=0)
    k.box((-0.034, 0.15, 0.10), (0.02, 0.008, 0.008), 'steel', 'bolt', bev=0.001)
    k.box((0, 0.645, 0.137), (0.012, 0.012, 0.048), 'steel', bev=0.0015)
    k.box((0, 0.645, 0.1665), (0.0028, 0.005, 0.011), 'steel', bev=0.0004)
    k.box((0, -0.03, 0.1595), (0.016, 0.01, 0.009), 'steel', bev=0.001)
    k.tube(0.0065, 0.0028, -0.034, -0.026, 0, 0.172, 14, 'steel')
    k.box((0.0235, 0.05, 0.11), (0.001, 0.07, 0.02), 'dark', bev=0)
    return {'kit': k, 'tex': 1024, 'bones': {'gun': Matrix(), 'mag': T(-0.03, 0.08, -0.02), 'bolt': T(-0.034, 0.15, 0.10), 'trigger': T(0, 0.035, 0.047), 'pump': T(0, 0.14, 0.155)},
            'boltdir': Vector((0, -1, 0)), 'grip': GF_CARBINE, 'trigger_pt': Vector((0, 0.0385, 0.034)), 'left': ('handguard', T(0, 0.27, 0.075)),
            'eye': Vector((-0.20, -0.34, 0.19)), 'sight': (0, -0.03, 0.172), 'sightFront': (0, 0.645, 0.172), 'scope': 0.0,
            'muzzle': (0, 0.70, 0.105), 'eject': (0.02, 0.07, 0.065), 'ejectDir': (0.4, 0.0, -0.9), 'ejectAt': 1 / 30.0, 'pivot': (0.0, -0.01, 0.03),
            'magc': (-0.03, 0.08, -0.03), 'anim': lmg_anim}
def lmg_anim(W):
    LM, FL_MAG = mag_grab(W['magc'], (0.05, 0.6, 0.8), (-0.98, 0.1, 0.0))
    LC, FL_CH = lever_grab((-0.036, 0.153, 0.10), (0.1, 0.35, 0.93), (-0.97, 0.05, 0.2))
    seat = 2.70
    rel = lmg_reload(W, 4.2, seat, LM, FL_MAG, LC, FL_CH)
    clips = std_clips(fire=make_fire(0.006, 0.6, (0, 0.006, 0.002, 0)), draw=make_draw(0.34, 0.07, 0.05, -40, -32, -12),
                      run=make_run(26, 14, -28, (-0.02, 0.02, -0.09), 0.016), melee=make_melee(0.11, 'butt'))
    clips = [c if c[0] != 'vm_draw' else ('vm_draw', 0.8, c[2], False) for c in clips]
    return clips + [('vm_reload', 4.2, rel, False)], {'seat': seat}
def lmg_reload(W, D, s, LM, FL_MAG, LC, FL_CH, pull=0.06):
    """feed cover up, box out and a fresh one in (seat at s), belt laid on the tray, cover slammed shut, cocking handle pulled"""
    HINGE = (0, 0.14, 0.155)
    def cover(a): return Rax(-50 * a, (1, 0, 0), HINGE)
    B_COV = bvh_of(gun_ob, ['pump'])
    LCOV = settle(place((0, 5.4, -1.7), (-0.004, -0.024, 0.163), (0.80, 0.45, -0.25), (0.15, 0.05, 0.98), 'L'), 'L', B_COV)
    FL_COV = grasp(LCOV, 'L', B_COV, start=(10, 15, 10))
    PIN = {'index': (30, 35, 25, -11), 'middle': (35, 45, 30, 0), 'ring': (55, 70, 45, 8), 'pinky': (60, 75, 45, 17), 'thumb': (25, 25, 20, 0)}
    LBELT = place((-1.5, 11.0, -1.4), (-0.02, 0.09, 0.146), (0.55, 0.35, -0.75), (-0.70, 0.10, 0.70), 'L')
    OFF = LM.inverted() @ REST['mag']; g = 0.95
    down = lambda dz, dx=0.0, rot=0.0: T(dx, 0, dz) @ LM @ Rx(rot)
    up1, up2 = (0.38, 0.62), (3.18, 3.32)                              # the hand rides the cover up, and slams it down
    keys = [(0.0, HL0, FL_HOLD), (0.12, HL0, FL_HOLD), (0.30, T(-0.01, 0, 0.03) @ LCOV, OPEN), (up1[0], LCOV, FL_COV), (up1[1], cover(1) @ LCOV, FL_COV),
            (0.72, T(-0.01, -0.01, 0.03) @ cover(1) @ LCOV, OPEN), (g - 0.08, T(-0.012, 0, -0.016) @ LM, OPEN), (g, LM, FL_MAG), (g + 0.06, LM, FL_MAG),
            (g + 0.14, down(-0.07), FL_MAG), (g + 0.40, T(-0.07, -0.05, -0.24) @ LM @ Rx(20), FL_MAG), (0.5 * (g + s) + 0.12, T(-0.06, -0.04, -0.25) @ LM @ Rx(12), FL_MAG),
            (s - 0.40, down(-0.13, -0.02, 8), FL_MAG), (s - 0.19, down(-0.06), FL_MAG), (s - 0.07, down(-0.014), FL_MAG), (s, T(0, 0, 0.003) @ LM, FL_MAG), (s + 0.05, LM, FL_MAG),
            (2.80, T(-0.01, -0.01, 0.01) @ mlerp(LM, LBELT, 0.5), OPEN), (2.92, LBELT, PIN), (3.02, T(0.012, 0, -0.004) @ LBELT, PIN), (3.08, T(0.008, 0, 0.02) @ LBELT, OPEN),
            (3.14, T(0, 0, 0.02) @ cover(1) @ LCOV, OPEN), (up2[0], cover(1) @ LCOV, FL_COV), (up2[1], LCOV, FL_COV), (3.40, T(-0.01, 0, 0.025) @ LCOV, OPEN),
            (3.52, T(-0.004, 0.006, 0.018) @ LC, OPEN), (3.58, LC, FL_CH), (3.72, T(0, -pull, -0.003) @ LC, FL_CH), (3.76, T(-0.006, -pull - 0.012, 0.004) @ LC, OPEN),
            (D - 0.12, HL0, fmix(OPEN, FL_HOLD, 0.6)), (D, HL0, FL_HOLD)]
    def c_reload(t, D_):
        ca = smooth(up1[0], up1[1], t) * (1 - smooth(up2[0], up2[1], t))
        tl = ease(t / 0.30) * (1 - ease((t - 3.40) / 0.25)); ch = smooth(3.40, 3.58, t) * (1 - smooth(3.78, 3.98, t))
        cv = smooth(0.15, 0.35, t) * (1 - smooth(0.70, 0.90, t)) + smooth(2.75, 2.95, t) * (1 - smooth(3.32, 3.50, t))      # top work: gun out and low
        op = smooth(0.15, 0.35, t) * (1 - smooth(3.32, 3.50, t))      # cover open: the gun further out so the cover is not a slab over the camera
        bx = smooth(g - 0.25, g + 0.05, t) * (1 - smooth(s - 0.05, s + 0.25, t))      # box change: gun lifted and rolled so the box and the hand are in view
        M = Rz(6 * tl + 4 * ch) @ Rx(6 * tl + 3 * ch - 14 * cv) @ Ry(28 * tl * (1 - cv) + 10 * ch + 12 * bx)
        G = T(-0.012 * tl - 0.02 * ch - 0.04 * bx, -0.01 * ch + 0.08 * op + 0.06 * cv, 0.018 * tl + 0.01 * ch - 0.09 * cv + 0.05 * bx) @ about(W['pivot'], M)
        bmp = 0.004 * bump(t, s + 0.03, 0.04) + 0.004 * bump(t, up2[1] + 0.02, 0.035) + 0.003 * bump(t, 3.76, 0.035)
        G = T(0, 0, bmp - 0.003 * smooth(g, g + 0.14, t) * (1 - smooth(g + 0.14, g + 0.25, t))) @ G
        P = hold_pose(G); L, fL = key_interp(keys, t)
        if up1[0] <= t <= up1[1] or up2[0] <= t <= up2[1]: L = cover(ca) @ LCOV          # the hand stays on the cover through the arc
        P['HL'] = G @ L; P['fL'] = fL; P['d'] = {'pump': cover(ca)}
        low = smooth(g + 0.05, g + 0.35, t) * (1 - smooth(s - 0.35, s - 0.1, t))
        hi = smooth(0.25, 0.40, t) * (1 - smooth(0.62, 0.80, t)) + smooth(3.05, 3.15, t) * (1 - smooth(3.78, 3.95, t))
        P['EL'] = P['HL'].translation + (EL_DIR + Vector((0.15, 0.15, 0.25)) * low + Vector((-0.25, 0.15, -0.10)) * hi).normalized() * 0.26      # elbow out and down, not back at the camera
        P['ER'] = ER0 + Vector((0.01, 0, 0.02)) * tl + G.translation * 0.5
        if g <= t <= s: P['mag'] = G @ L @ OFF
        P['bolt'] = pull * smooth(3.58, 3.72, t) * (1 - smooth(3.73, 3.77, t))
        return P
    return c_reload
MODELS['lmg'] = model_lmg

# ---------------------------------------------------------------- the revolver: big-frame .44, stainless, swing-out cylinder (`mag`), hammer (`bolt`)
CYL_Z = 0.081; CRANE = (-0.012, 0.0, 0.062)
def model_revolver():
    k = Kit(2); GF = grip_frame((0, -0.028, 0.064), 22)
    k.box((0, 0.019, 0.1085), (0.016, 0.08, 0.009), 'bright', bev=0.0012)
    k.box((0, -0.029, 0.088), (0.03, 0.022, 0.056), 'bright', bev=0.0018)
    k.box((0, 0.064, 0.092), (0.026, 0.016, 0.044), 'bright', bev=0.0015)
    k.box((0, 0.019, 0.056), (0.022, 0.08, 0.009), 'bright', bev=0.0012)
    k.lathe([(0.0205, -0.016), (0.0205, 0.050), (0.018, 0.054), (0.0, 0.054)], T(0, 0, CYL_Z), 24, 'bright', 'mag')
    for i in range(6):
        a = math.radians(90 + 60 * i); cx, cz = 0.0135 * math.cos(a), CYL_Z + 0.0135 * math.sin(a)
        k.box((cx, 0.0545, cz), (0.0085, 0.001, 0.0085), 'dark', 'mag', bev=0)
        a2 = math.radians(120 + 60 * i)
        k.box((0.0202 * math.cos(a2), 0.02, CYL_Z + 0.0202 * math.sin(a2)), (0.0035, 0.045, 0.0035), 'dark', 'mag', bev=0, M=None)
    k.lathe([(0.0028, 0.054), (0.0028, 0.098), (0.0035, 0.098), (0.0035, 0.104), (0.0, 0.105)], T(0, 0, 0.066), 10, 'bright', 'mag')
    k.box((-0.006, 0.058, 0.066), (0.008, 0.008, 0.014), 'bright', 'mag', bev=0.0008)
    k.lathe([(0.0095, 0.072), (0.0095, 0.205), (0.0055, 0.205), (0.0055, 0.072)], T(0, 0, 0.095), 18, 'bright', loop=True)
    k.box((0, 0.138, 0.0785), (0.016, 0.132, 0.022), 'bright', bev=0.002)
    k.box((0, 0.138, 0.1055), (0.009, 0.132, 0.004), 'bright', bev=0.001)
    k.prism([(0.178, 0.1075), (0.2, 0.1075), (0.198, 0.1165), (0.192, 0.1165)], -0.0015, 0.0015, 'steel', bev=0.0003)
    for sx in (-1, 1): k.box((sx * 0.0035, -0.015, 0.1145), (0.003, 0.006, 0.0045), 'steel', bev=0.0004)
    k.prism([(-0.041, 0.098), (-0.033, 0.098), (-0.034, 0.113), (-0.05, 0.124), (-0.054, 0.12), (-0.043, 0.108)], -0.004, 0.004, 'steel', 'bolt', bev=0.0006)
    k.sweep([(0, -0.006, 0.054), (0, -0.004, 0.036), (0, 0.012, 0.03), (0, 0.032, 0.034), (0, 0.04, 0.046), (0, 0.04, 0.054)], 0.003, 8, 'bright')
    k.prism([(0.004, 0.054), (0.010, 0.054), (0.011, 0.045), (0.016, 0.037), (0.012, 0.035), (0.006, 0.045)], -0.0028, 0.0028, 'bright', 'trigger', bev=0.0005)
    k.prism([gpt(GF, f, u) for f, u in [(-0.02, 0.004), (0.017, 0.004), (0.019, -0.03), (0.017, -0.07), (0.018, -0.105), (-0.022, -0.108),
                                         (-0.024, -0.07), (-0.026, -0.03), (-0.025, 0.0)]], -0.0155, 0.0155, 'wood', bev=0.003)
    k.box((-0.016, -0.012, 0.084), (0.003, 0.012, 0.007), 'steel', bev=0.0006)
    for i in range(6):                     # six rounds in a moon clip (on 'pump'): they sit in the chambers, eject and load as one piece
        a = math.radians(90 + 60 * i); cx, cz = 0.0135 * math.cos(a), CYL_Z + 0.0135 * math.sin(a)
        k.lathe([(0.0, -0.0145), (0.0043, -0.0145), (0.0043, 0.022), (0.0031, 0.028), (0.0, 0.0292)], T(cx, 0, cz), 10, 'brass', 'pump')
        k.lathe([(0.0, -0.0172), (0.0052, -0.0172), (0.0052, -0.0148), (0.0, -0.0148)], T(cx, 0, cz), 10, 'brass', 'pump')
    k.lathe([(0.0, -0.0181), (0.0175, -0.0181), (0.0175, -0.0172), (0.0, -0.0172)], T(0, 0, CYL_Z), 18, 'steel', 'pump')
    return {'kit': k, 'tex': 512, 'bones': {'gun': Matrix(), 'mag': T(0, 0.02, CYL_Z), 'bolt': T(0, -0.036, 0.098), 'trigger': T(0, 0.006, 0.054), 'pump': T(0, -0.016, CYL_Z)},
            'boltdir': Vector((0, -1, 0)), 'grip': GF, 'grip_up': 0.020, 'rthumb': (-0.021, 0.018, 0.062), 'trigger_pt': Vector((0, 0.013, 0.04)),
            'left': ('pistol', None), 'lofs': T(0, 0.006, -0.018), 'idx_ds': (-12, 12), 'lthumb': (-0.026, 0.035, 0.040), 'eye': Vector((-0.08, -0.28, 0.152)), 'sight': (0, -0.015, 0.1167), 'sightFront': (0, 0.195, 0.1167), 'scope': 0.0,
            'muzzle': (0, 0.205, 0.095), 'eject': None, 'pivot': (0, -0.03, 0.06), 'rough': 0.45, 'metal': 0.5, 'anim': revolver_anim}
def revolver_anim(W):
    def swing(a): return Rax(-80 * a, (0, 1, 0), CRANE)
    def hammer(h): return REST['bolt'] @ Rx(-32 * h) @ REST['bolt'].inverted()
    def c_fire(t, D):
        h = smooth(0.0, 0.06, t) * (1 - smooth(0.06, 0.075, t)); k = smooth(0.065, 0.09, t) * (1 - smooth(0.12, 0.30, t))
        G = about(W['pivot'], T(0, -0.016 * k, 0.006 * k) @ Rx(12 * k) @ Rz(-2 * k))
        P = hold_pose(G); P['d'] = {'bolt': hammer(h)}; P['trig'] = -18 * smooth(0, 0.065, t) * (1 - smooth(0.1, 0.22, t))
        P['fR'] = dict(FR_TRIG); P['ER'] = ER0 + Vector((0, -0.01, 0.012)) * k + G.translation; P['EL'] = EL0 + Vector((0, -0.01, 0.012)) * k + G.translation
        return P
    PIN = {'index': (30, 35, 25, -11), 'middle': (35, 45, 30, 0), 'ring': (55, 70, 45, 8), 'pinky': (60, 75, 45, 17), 'thumb': (25, 25, 20, 0)}
    rod = swing(1) @ Vector((0, 0.106, 0.066)); rear = swing(1) @ Vector((0, -0.02, CYL_Z))
    LROD = place((0, 4.8, -1.8), rod + Vector((0, 0.022, 0)), (0.2, -0.1, 0.97), (0, 1, 0), 'L')
    LLOAD = place((-1.5, 11.0, -1.4), rear + Vector((-0.004, -0.012, 0)), (0.1, 0.95, 0.3), (-0.5, 0.0, -0.86), 'L')
    LCLOSE = place((-2.0, 6.0, -1.8), Vector((-0.032, 0.02, CYL_Z)), (0.1, 0.5, 0.85), (-0.95, 0.1, 0.15), 'L')
    BELOW = T(-0.06, -0.06, -0.30) @ LLOAD @ Rx(25)
    CLIP_HELD = swing(1) @ T(0, -0.05, 0) @ REST['pump']; OFFC = LLOAD.inverted() @ CLIP_HELD      # the fresh clip, 5 cm behind the open cylinder
    SEAT = 1.75
    keys = [(0.0, HL0, FL_HOLD), (0.12, T(-0.01, 0, -0.008) @ HL0, OPEN), (0.32, T(-0.03, 0, -0.02) @ LCLOSE, OPEN), (0.55, T(0, 0.03, 0) @ LROD, OPEN),
            (0.64, LROD, OPEN), (0.70, T(0, -0.025, 0) @ LROD, OPEN), (0.95, BELOW, PIN), (1.12, BELOW, PIN), (1.45, T(0, -0.04, -0.01) @ LLOAD, PIN),
            (1.62, LLOAD, PIN), (SEAT, T(0, 0.05, 0) @ LLOAD, PIN), (SEAT + 0.05, T(-0.01, 0.045, -0.01) @ LLOAD, OPEN), (1.88, LCLOSE, OPEN), (2.02, T(0.014, 0, 0.004) @ LCLOSE, OPEN),
            (2.35, T(-0.01, 0, -0.01) @ HL0, OPEN), (2.6, HL0, FL_HOLD)]
    def c_reload(t, D):
        s = smooth(0.18, 0.32, t) * (1 - smooth(1.9, 2.02, t))
        up = smooth(0.35, 0.55, t) * (1 - smooth(0.70, 0.86, t)); dn = smooth(0.80, 1.0, t) * (1 - smooth(1.9, 2.2, t)); a = ease(t / 0.2) * (1 - ease((t - 2.05) / 0.3))
        G = T(-0.05 * a, 0.12 * a, -0.05 * a + 0.02 * up) @ about(W['pivot'], Rx(40 * up - 20 * dn) @ Rz(16 * a) @ Ry(28 * a))      # well out in front and low, not in the face
        G = T(0, 0, 0.003 * bump(t, 2.02, 0.03)) @ G
        P = hold_pose(G); L, fL = key_interp(keys, t); P['HL'] = G @ L; P['fL'] = fL; P['d'] = {'mag': swing(s)}
        low = smooth(0.75, 0.95, t) * (1 - smooth(1.2, 1.45, t))
        P['EL'] = P['HL'].translation + (EL_DIR + Vector((0.1, 0.1, 0.3)) * low).normalized() * 0.26; P['ER'] = ER0 + G.translation
        P['fR'] = fadd(P['fR'], {'thumb': (5 * bump(t, 0.12, 0.06), 15 * bump(t, 0.12, 0.06), 0, 0)})
        # the moon clip: in the cylinder, kicked out by the ejector (0.66) and falling, a fresh one up in the left hand, pushed in at 1.62-SEAT
        if t < 0.66: P['w'] = {'pump': G @ swing(s) @ REST['pump']}
        elif t < 1.0: u = t - 0.66; P['w'] = {'pump': G @ T(-0.02 * u, -0.25 * u, -4.9 * u * u) @ swing(1) @ T(0, -0.03 * min(1.0, u / 0.05), 0) @ REST['pump']}
        elif t < 1.62: P['w'] = {'pump': G @ L @ OFFC}
        elif t < SEAT: p = smooth(1.62, SEAT, t); P['w'] = {'pump': G @ swing(1) @ T(0, -0.05 * (1 - p), 0) @ REST['pump']}
        else: P['w'] = {'pump': G @ swing(s) @ REST['pump']}
        return P
    clips = [c if c[0] != 'vm_fire' else ('vm_fire', 0.3, c_fire, False) for c in
             std_clips(draw=make_draw(0.25, 0.05, 0.03, -30, -20, -8), run=make_run(18, -12, -8, (0.02, 0.0, -0.015), 0.010), melee=make_melee(0.12, 'jab'))]
    return clips + [('vm_reload', 2.6, c_reload, False)], {'seat': SEAT}
MODELS['revolver'] = model_revolver

# ---------------------------------------------------------------- the DMR: semi-auto 7.62 marksman rifle, 10-round magazine, medium scope (hollow)
def model_dmr():
    k = Kit(2)
    k.box((0, 0.06, 0.1125), (0.026, 0.26, 0.045), 'alloy', bev=0.0018)
    k.box((0, 0.06, 0.1385), (0.020, 0.25, 0.007), 'alloy', bev=0.0008)
    for i in range(17): k.box((0, -0.06 + i * 0.0145, 0.1435), (0.021, 0.006, 0.003), 'alloy', bev=0.0005)
    k.prism([(-0.065, 0.048), (-0.065, 0.09), (0.15, 0.09), (0.15, 0.06), (0.135, 0.048), (0.135, 0.022), (0.065, 0.022), (0.065, 0.048)], -0.0125, 0.0125, 'alloy', bev=0.0015)
    k.prism(CARBINE_GRIP, -0.013, 0.013, 'polymer', bev=0.002)
    ar_guard(k)
    k.prism([(0.032, 0.048), (0.038, 0.048), (0.038, 0.04), (0.041, 0.03), (0.037, 0.028), (0.033, 0.04)], -0.003, 0.003, 'steel', 'trigger', bev=0.0005)
    k.lathe([(0.024, 0.19), (0.024, 0.46), (0.0, 0.462)], T(0, 0, 0.112) @ Ry(22.5), 8, 'alloy', smooth=False)
    for i in range(5):
        for a in (-1, 1): k.box((a * 0.0225, 0.22 + i * 0.05, 0.112), (0.002, 0.03, 0.008), 'dark', bev=0)
    k.lathe([(0.0095, 0.46), (0.0095, 0.64), (0.012, 0.64), (0.012, 0.69), (0.0045, 0.69), (0.0045, 0.46)], T(0, 0, 0.112), 16, 'steel', loop=True)
    for i in range(3): k.box((0, 0.652 + i * 0.012, 0.1245), (0.007, 0.005, 0.002), 'dark', bev=0)
    k.lathe([(0.0145, -0.065), (0.0145, -0.25), (0.0, -0.252)], T(0, 0, 0.112), 16, 'alloy')
    k.prism([(-0.16, 0.135), (-0.16, 0.09), (-0.20, 0.05), (-0.33, 0.04), (-0.335, 0.13), (-0.25, 0.135)], -0.02, 0.02, 'polymer', bev=0.003)
    k.prism([(-0.335, 0.132), (-0.335, 0.038), (-0.352, 0.036), (-0.352, 0.134)], -0.021, 0.021, 'rubber', bev=0.002)
    k.prism([(0.07, 0.06), (0.128, 0.06), (0.126, -0.004), (0.072, -0.008)], -0.0115, 0.0115, 'polymer', 'mag', bev=0.0012)
    k.prism([(0.068, -0.006), (0.13, -0.002), (0.13, -0.01), (0.068, -0.014)], -0.0135, 0.0135, 'polymer', 'mag', bev=0.0012)
    k.box((0, -0.075, 0.127), (0.034, 0.01, 0.009), 'alloy', 'bolt', bev=0.001)
    k.box((0.0132, 0.06, 0.112), (0.0008, 0.05, 0.016), 'dark', bev=0)
    k.box((-0.0135, 0.07, 0.078), (0.002, 0.018, 0.01), 'steel', bev=0.0005)
    SZ = 0.168; y0 = -0.012
    k.lathe([(0.0185, y0), (0.0185, y0 + 0.045), (0.0165, y0 + 0.055), (0.0165, y0 + 0.11), (0.021, y0 + 0.13), (0.021, y0 + 0.16), (0.014, y0 + 0.16), (0.014, y0)],
            T(0, 0, SZ), 28, 'alloy', loop=True)
    k.lathe([(0.0, 0.0), (0.0075, 0.0), (0.0075, 0.003), (0.0, 0.0032)], T(0, 0.075, SZ + 0.0165) @ Rx(90), 12, 'alloy')
    k.lathe([(0.0, 0.0), (0.0075, 0.0), (0.0075, 0.01), (0.0, 0.0105)], T(0.0165, 0.075, SZ) @ Rz(-90), 12, 'alloy')
    for yy in (0.035, 0.11):
        k.lathe([(0.0185, yy - 0.007), (0.0185, yy + 0.007)], T(0, 0, SZ), 20, 'alloy', caps=False)
        k.box((0, yy, 0.152), (0.012, 0.014, 0.016), 'alloy', bev=0.0012)
    return {'kit': k, 'tex': 1024, 'bones': {'gun': Matrix(), 'mag': T(0, 0.1, 0.03), 'bolt': T(0, -0.075, 0.127), 'trigger': T(0, 0.035, 0.047)},
            'boltdir': Vector((0, -1, 0)), 'grip': GF_CARBINE, 'trigger_pt': Vector((0, 0.0385, 0.034)), 'left': ('handguard', T(0, 0.29, 0.088)),
            'eye': Vector((-0.19, -0.33, 0.186)), 'sight': (0, y0, SZ), 'sightFront': (0, y0 + 0.16, SZ), 'scope': 0.014,
            'muzzle': (0, 0.69, 0.112), 'eject': (0.015, 0.06, 0.113), 'ejectDir': (0.85, 0.15, 0.5), 'ejectAt': 1 / 30.0, 'pivot': (0.0, -0.01, 0.03),
            'magc': (0, 0.1, 0.02), 'anim': dmr_anim}
def dmr_anim(W):
    LM, FL_MAG = mag_grab(W['magc'])
    LC, FL_CH = lever_grab((-0.026, -0.066, 0.122))
    seat = 1.40
    rel = box_mag_reload(W, 2.3, seat, 0.45, LM, FL_MAG, lever=(LC, FL_CH, 1.72), pull=0.065)
    clips = std_clips(fire=make_fire(0.008, 1.2, (0, 0.03, 0.012, 0)), melee=make_melee(0.13, 'butt'))
    return clips + [('vm_reload', 2.3, rel, False)], {'seat': seat}
MODELS['dmr'] = model_dmr

# ---------------------------------------------------------------- the RPG: shoulder rocket launcher, warhead on `mag`
TUBE_Z = 0.085
def model_rpg():
    k = Kit(2)
    k.lathe([(0.033, -0.52), (0.033, -0.50), (0.021, -0.44), (0.0205, 0.40), (0.023, 0.40), (0.023, 0.415), (0.0175, 0.415), (0.0175, -0.52)],
            T(0, 0, TUBE_Z), 22, 'olive', loop=True)
    for y0, y1 in ((-0.12, 0.02), (0.05, 0.16)): k.lathe([(0.029, y0), (0.031, y0 + 0.01), (0.031, y1 - 0.01), (0.029, y1)], T(0, 0, TUBE_Z), 20, 'wood')
    k.box((0, 0.03, 0.058), (0.026, 0.14, 0.018), 'steel', bev=0.0015)
    k.prism(CARBINE_GRIP, -0.013, 0.013, 'wood', bev=0.002)
    ar_guard(k)
    k.prism([(0.032, 0.048), (0.038, 0.048), (0.038, 0.04), (0.041, 0.03), (0.037, 0.028), (0.033, 0.04)], -0.003, 0.003, 'steel', 'trigger', bev=0.0005)
    k.lathe([(0.0, 0.0), (0.0135, 0.0), (0.0145, 0.015)] + [(0.0145 if i % 2 else 0.0133, 0.015 + i * 0.0135) for i in range(1, 7)] + [(0.0145, 0.1), (0.0, 0.102)],
            T(0, 0.22, 0.066) @ Rx(-90), 16, 'wood')
    k.box((0, 0.22, 0.064), (0.024, 0.03, 0.01), 'steel', bev=0.001)
    k.box((-0.036, 0.03, 0.105), (0.024, 0.09, 0.03), 'dark', bev=0.003)
    k.tube(0.009, 0.006, -0.03, -0.012, -0.036, 0.108, 14, 'rubber')
    k.box((-0.022, 0.03, 0.095), (0.012, 0.03, 0.012), 'steel', bev=0.001)
    k.box((0, -0.02, 0.112), (0.012, 0.006, 0.014), 'steel', bev=0.0008)
    for sx in (-1, 1): k.box((sx * 0.003, -0.02, 0.1215), (0.0025, 0.005, 0.005), 'steel', bev=0.0004)
    k.box((0, 0.30, 0.110), (0.008, 0.008, 0.012), 'steel', bev=0.0008)
    k.box((0, 0.30, 0.1185), (0.0025, 0.004, 0.006), 'steel', bev=0.0004)
    k.lathe([(0.0, 0.38), (0.019, 0.38), (0.019, 0.46), (0.042, 0.52), (0.042, 0.62), (0.03, 0.70), (0.012, 0.78), (0.004, 0.82), (0.0, 0.825)],
            T(0, 0, TUBE_Z), 22, 'olive', 'mag')
    k.lathe([(0.0425, 0.555), (0.0425, 0.585)], T(0, 0, TUBE_Z), 22, 'dark', 'mag', caps=False)
    return {'kit': k, 'tex': 1024, 'bones': {'gun': Matrix(), 'mag': T(0, 0.6, TUBE_Z), 'trigger': T(0, 0.035, 0.047)},
            'boltdir': Vector((0, -1, 0)), 'grip': GF_CARBINE, 'trigger_pt': Vector((0, 0.0385, 0.034)),
            'left': ('vgrip', fr((0, 0.22, 0.066), (0, 1, 0), (0, 0, 1))),
            'eye': Vector((-0.11, -0.27, 0.14)), 'sight': (0, -0.02, 0.1215), 'sightFront': (0, 0.30, 0.1215), 'scope': 0.0,
            'muzzle': (0, 0.415, TUBE_Z), 'eject': None, 'pivot': (0.0, -0.05, 0.08), 'rough': 0.7, 'metal': 0.1, 'anim': rpg_anim,
            'er': Vector((0.40, -0.55, -0.73)).normalized()}
def rpg_anim(W):
    def c_fire(t, D):
        k = smooth(0.0, 0.025, t) * (1 - smooth(0.06, 0.42, t)); sh = bump(t, 0.05, 0.04)
        G = about(W['pivot'], T(0.004 * sh, -0.04 * k, 0.012 * k) @ Rx(7 * k) @ Rz(2 * sh) @ Ry(-3 * sh))
        P = hold_pose(G); P['fR'] = dict(FR_TRIG); P['trig'] = -14 * smooth(0, 0.02, t) * (1 - smooth(0.2, 0.35, t))
        P['ER'] = ER0 + G.translation + Vector((0.01, -0.02, 0.0)) * k; P['EL'] = EL0 + G.translation
        if 0.0 < t < D - 0.01: P['mag'] = G @ T(0, 2.0 + 60 * t, 0) @ REST['mag']
        return P
    LW = settle(place((0, 5.6, -1.75), Vector((-0.05, 0.6, TUBE_Z - 0.012)), (0.1, 0.25, 0.96), (-0.97, 0.0, 0.1), 'L'), 'L', BVH_MAG, roots=False)
    FL_W = grasp(LW, 'L', BVH_MAG); OFF = LW.inverted() @ REST['mag']
    BELOW = T(-0.10, -0.12, -0.36) @ LW @ Rx(30)
    SEAT = 1.70
    keys = [(0.0, HL0, FL_HOLD), (0.10, T(-0.01, 0, -0.01) @ HL0, OPEN), (0.45, BELOW, OPEN), (0.65, BELOW, FL_W), (1.05, T(0, 0.30, 0.0) @ LW, FL_W),
            (1.30, T(0, 0.13, 0) @ LW, FL_W), (1.62, LW, FL_W), (SEAT, T(0, -0.004, 0) @ LW, FL_W), (1.80, T(-0.02, 0, -0.01) @ LW, OPEN),
            (2.15, T(-0.01, 0, -0.015) @ HL0, OPEN), (2.4, HL0, FL_HOLD)]
    def c_reload(t, D):
        a = ease(t / 0.35) * (1 - ease((t - 1.8) / 0.4))
        G = T(-0.02 * a, -0.03 * a, -0.03 * a) @ about(W['pivot'], Rx(-6 * a) @ Rz(15 * a) @ Ry(10 * a))      # muzzle a little down and left, toward the loading hand
        G = T(0, -0.005 * bump(t, SEAT, 0.04), 0) @ G
        P = hold_pose(G); L, fL = key_interp(keys, t); P['HL'] = G @ L; P['fL'] = fL
        low = smooth(0.15, 0.45, t) * (1 - smooth(0.7, 1.05, t))
        P['EL'] = P['HL'].translation + (EL_DIR + Vector((0.15, 0.15, 0.3)) * low).normalized() * 0.26; P['ER'] = ER0 + G.translation
        if t < 0.62: P['mag'] = G @ T(0, 3.0, 0) @ REST['mag']
        elif t <= SEAT: P['mag'] = G @ L @ OFF
        return P
    clips = std_clips(draw=make_draw(0.30, 0.06, 0.05, -30, -20, -10), run=make_run(15, 20, -10, (0.0, 0.0, -0.08), 0.014), melee=make_melee(0.12, 'jab'))
    clips = [c if c[0] not in ('vm_fire', 'vm_draw') else (('vm_fire', 0.5, c_fire, False) if c[0] == 'vm_fire' else ('vm_draw', 0.8, c[2], False)) for c in clips]
    return clips + [('vm_reload', 2.4, c_reload, False)], {'seat': SEAT}
MODELS['rpg'] = model_rpg

# ---------------------------------------------------------------- the minigun: hand-carried six-barrel rotary gun, chainsaw grip, belt box
SPIN_Z = 0.10
def model_minigun():
    k = Kit(2)
    k.box((0, 0.04, 0.10), (0.09, 0.24, 0.11), 'steel', bev=0.003)
    k.lathe([(0.0, 0.0), (0.04, 0.0), (0.04, 0.08), (0.0, 0.082)], T(0, -0.16, SPIN_Z), 20, 'alloy')
    k.prism([(-0.05, 0.048), (0.12, 0.048), (0.12, 0.045), (-0.05, 0.045)], -0.02, 0.02, 'steel', bev=0.001)
    k.prism(CARBINE_GRIP, -0.013, 0.013, 'rubber', bev=0.002)
    ar_guard(k)
    k.prism([(0.032, 0.048), (0.038, 0.048), (0.038, 0.04), (0.041, 0.03), (0.037, 0.028), (0.033, 0.04)], -0.003, 0.003, 'steel', 'trigger', bev=0.0005)
    for i in range(6):
        a = math.radians(60 * i + 30); cx, cz = 0.022 * math.cos(a), SPIN_Z + 0.022 * math.sin(a)
        k.lathe([(0.0068, 0.16), (0.0068, 0.62), (0.0075, 0.62), (0.0075, 0.64), (0.0042, 0.64), (0.0042, 0.16)], T(cx, 0, cz), 14, 'steel', 'spin', loop=True)
    for yy, ww in ((0.17, 0.03), (0.40, 0.012), (0.60, 0.012)):
        k.lathe([(0.032, yy), (0.032, yy + ww), (0.0, yy + ww + 0.001)] if yy < 0.2 else [(0.031, yy), (0.031, yy + ww)], T(0, 0, SPIN_Z), 20, 'alloy', 'spin',
                caps=yy < 0.2)
    k.lathe([(0.012, 0.16), (0.012, 0.645), (0.0, 0.646)], T(0, 0, SPIN_Z), 12, 'steel', 'spin')
    k.sweep([(0.045, 0.12, 0.15), (0.045, 0.12, 0.205), (0.025, 0.12, 0.225), (-0.035, 0.12, 0.225), (-0.05, 0.12, 0.205), (-0.05, 0.12, 0.15)], 0.0115, 10, 'rubber')
    k.box((-0.09, -0.03, 0.0), (0.06, 0.13, 0.12), 'olive', 'mag', bev=0.003)          # belt box low and back (clear of the line to the front grip)
    k.box((-0.09, -0.03, 0.063), (0.064, 0.134, 0.006), 'olive', 'mag', bev=0.0015)
    k.box((-0.121, -0.03, 0.0), (0.004, 0.05, 0.03), 'dark', 'mag', bev=0.001)
    k.sweep([(-0.07, -0.01, 0.066), (-0.06, 0.0, 0.10), (-0.045, 0.01, 0.12)], 0.012, 8, 'olive', 'mag')
    k.box((0, 0.10, 0.044), (0.03, 0.05, 0.002), 'dark', bev=0)
    k.box((0.046, 0.0, 0.11), (0.004, 0.12, 0.05), 'alloy', bev=0.002)
    for i in range(5): k.box((0.0465, -0.06 + i * 0.03, 0.135), (0.003, 0.012, 0.012), 'steel', bev=0.001)
    k.lathe([(0.0, 0.0), (0.03, 0.0), (0.03, 0.05), (0.022, 0.06), (0.0, 0.061)], T(0.0, -0.08, 0.16) @ Rx(-90), 16, 'alloy')
    for sx in (-1, 1): k.box((sx * 0.046, 0.10, 0.08), (0.004, 0.04, 0.03), 'steel', bev=0.001)
    k.box((0, 0.30, 0.064), (0.03, 0.05, 0.03), 'steel', bev=0.002); vfore(k, 0.30, 0.05, 'rubber')      # forward grip clamp and grip under the barrels
    return {'kit': k, 'tex': 1024, 'bones': {'gun': Matrix(), 'mag': T(-0.09, -0.03, 0.0), 'trigger': T(0, 0.035, 0.047), 'spin': T(0, 0.4, SPIN_Z)},
            'boltdir': Vector((0, -1, 0)), 'grip': GF_CARBINE, 'trigger_pt': Vector((0, 0.0385, 0.034)), 'spin': None,
            'left': ('vgrip', fr((0, 0.30, 0.05), (0, 1, 0), (0, 0, 1))), 'eye': Vector((-0.24, -0.42, 0.19)), 'sight': (-0.04, -0.12, 0.26), 'sightFront': (-0.04, 0.62, 0.26), 'scope': 0.0,
            'muzzle': (0, 0.645, SPIN_Z), 'eject': (0, 0.10, 0.042), 'ejectDir': (0.1, 0.0, -1.0), 'ejectAt': 1 / 30.0, 'pivot': (0.0, 0.0, 0.05),
            'magc': (-0.09, -0.03, -0.01), 'er': Vector((0.35, -0.45, -0.82)).normalized(), 'anim': minigun_anim}
def minigun_anim(W):
    LM, FL_MAG = mag_grab(W['magc'], (0.05, 0.6, 0.8), (-0.98, 0.1, 0.0))
    seat = 3.0
    rel = box_mag_reload(W, 4.5, seat, 0.9, LM, FL_MAG, drop=0.28, tilt=(4, 4, 20))
    def c_fire(t, D):
        f = min(round(t * FPS), 3); k = [0, 1.0, 0.6, 0.2][f]
        G = about(W['pivot'], T(0.0015 * (f % 2), -0.006 * k, 0.003 * k) @ Rx(0.8 * k) @ Rz(0.5 * (f % 2 - 0.5) * k))
        P = hold_pose(G); P['fR'] = dict(FR_TRIG); P['trig'] = -13 * (1 if f else 0)
        P['ER'] = ER0 + G.translation; P['EL'] = EL0 + G.translation
        P['d'] = {'spin': Rax(60.0 * t / D, (0, 1, 0), (0, 0, SPIN_Z))}      # six barrels: 60 deg per loop of the clip is seamless
        return P
    clips = std_clips(fire=c_fire, draw=make_draw(0.34, 0.07, 0.05, -25, -20, -10), run=make_run(15, 10, -15, (0.0, 0.0, -0.06), 0.02), melee=make_melee(0.10, 'jab'))
    clips = [c if c[0] != 'vm_draw' else ('vm_draw', 0.8, c[2], False) for c in clips]
    return clips + [('vm_reload', 4.5, rel, False)], {'seat': seat}
MODELS['minigun'] = model_minigun

# ---------------------------------------------------------------- the knife: combat knife, right hand only
def blade_hold(k, handle_c, pitch):
    """hold a blade like a pistol grip: knife handle (local -y) along the carbine's grip axis, blade up out of the fist, edge (local -z) forward;
    then tip blade, hand and elbow forward together by `pitch` deg about the grip. Moves the kit; returns (grip frame, rotation, pivot)."""
    U = (-GRIP_DOWN).normalized(); Fp = Vector((0, 0.977, -0.213)); gc = Vector((0, -0.002, 0.001))
    A = Matrix(((1, 0, 0), tuple(U), tuple(-Fp))).transposed().to_4x4(); A.translation = gc - A.to_3x3() @ Vector(handle_c)
    Q = Rax(pitch, (1, 0, 0), tuple(gc)); M = Q @ A
    bmesh.ops.transform(k.bm, matrix=M, verts=k.bm.verts[:])
    return Q @ GF_CARBINE, Q, tuple(gc)
def model_knife():
    k = Kit(2)
    k.prism([(0.004, 0.012), (0.12, 0.012), (0.155, 0.008), (0.172, 0.002), (0.178, -0.004), (0.15, -0.012), (0.08, -0.016), (0.004, -0.014)],
            -0.0022, 0.0022, 'steel', bev=0.0012)
    k.box((0, 0.09, 0.0095), (0.0046, 0.07, 0.003), 'dark', bev=0.0003)
    k.box((0, 0.0, -0.002), (0.016, 0.008, 0.05), 'steel', bev=0.0015)
    prof = [(0.0, -0.004), (0.012, -0.004)] + [(0.0135 if i % 2 else 0.0122, -0.004 - i * 0.012) for i in range(1, 9)] + [(0.0125, -0.11), (0.0, -0.111)]
    k.lathe(prof, T(0, 0, 0.0), 24, 'rubber')
    k.lathe([(0.0, -0.11), (0.0135, -0.11), (0.0135, -0.122), (0.008, -0.128), (0.0, -0.129)], T(0, 0, 0.0), 24, 'steel')
    for i in range(9): k.box((0, 0.012 + i * 0.006, 0.0125), (0.0046, 0.0022, 0.003), 'steel', bev=0.0005)
    k.lathe([(0.0, 0.0), (0.004, 0.0), (0.004, 0.003), (0.0, 0.0032)], T(0, -0.13, 0.0) @ Rx(180), 12, 'steel')
    for i in range(3): k.lathe([(0.0138, -0.03 - i * 0.03), (0.0138, -0.024 - i * 0.03)], T(0, 0, 0.0), 24, 'dark', caps=False)
    GF, Q, gc = blade_hold(k, (0, -0.055, 0.0), -34)
    free = T(-0.22, -0.30, -0.45) @ fr((0, 0, 0), (0.1, 0.3, -0.95), (-0.95, 0.0, -0.1))
    return {'kit': k, 'tex': 512, 'bones': {'gun': Matrix()}, 'boltdir': Vector((0, -1, 0)), 'grip': GF, 'trigger_pt': None, 'wrap': True,
            'left': ('free', free), 'er': (Q.to_3x3() @ ER_DIR).normalized(),
            'eye': Vector((-0.17, -0.31, 0.17)), 'sight': None, 'sightFront': None, 'scope': 0.0, 'muzzle': None, 'eject': None,
            'pivot': gc, 'rough': 0.45, 'metal': 0.4, 'anim': knife_anim}
def knife_anim(W):
    def c_slash(t, D):
        w = smooth(0.0, 0.07, t) * (1 - smooth(0.07, 0.14, t)); s = smooth(0.07, 0.19, t); back = smooth(0.2, 0.35, t)
        a = s * (1 - back)
        G = T(0.06 * w - 0.20 * a, 0.03 * a, 0.05 * w - 0.06 * a) @ about(W['pivot'], Rz(-15 * w + 55 * a) @ Ry(-25 * w + 50 * a) @ Rx(10 * w - 15 * a))
        P = hold_pose(G); P['ER'] = ER0 + G.translation * 0.9
        return P
    def c_stab(t, D):
        w = smooth(0.0, 0.1, t) * (1 - smooth(0.1, 0.16, t)); s = smooth(0.1, 0.19, t) * (1 - smooth(0.24, 0.4, t))
        G = T(-0.03 * s, -0.05 * w + 0.22 * s, 0.02 * s) @ about(W['pivot'], Rx(-6 * w + 8 * s) @ Rz(-8 * s))
        P = hold_pose(G); P['ER'] = ER0 + G.translation * 0.9
        return P
    clips = [('vm_idle', 2.8, c_idle, True), ('vm_draw', 0.5, make_draw(0.25, 0.05, 0.03, -40, -30, -10), False),
             ('vm_run', 0.7, make_run(8, -8, -6, (0.01, 0.0, -0.01), 0.014), True), ('vm_fire', 0.35, c_slash, False), ('vm_fire2', 0.4, c_stab, False)]
    return clips, {}
MODELS['knife'] = model_knife

# ---------------------------------------------------------------- round 2 weapons
TRIG_PROF = [(0.032, 0.048), (0.038, 0.048), (0.038, 0.04), (0.041, 0.03), (0.037, 0.028), (0.033, 0.04)]
def rifle_lower(k, grip_cls='polymer'):
    k.prism(CARBINE_GRIP, -0.013, 0.013, grip_cls, bev=0.002); ar_guard(k)
    k.prism(TRIG_PROF, -0.003, 0.003, 'steel', 'trigger', bev=0.0005)
def vfore(k, y, z, cls='polymer'):
    k.lathe([(0.0, 0.0), (0.0135, 0.0), (0.0145, 0.015)] + [(0.0145 if i % 2 else 0.0133, 0.015 + i * 0.0135) for i in range(1, 7)] + [(0.0145, 0.1), (0.0, 0.102)],
            T(0, y, z) @ Rx(-90), 16, cls)
def base_w(**kw):
    W = {'boltdir': Vector((0, -1, 0)), 'grip': GF_CARBINE, 'trigger_pt': Vector((0, 0.0385, 0.034)), 'pivot': (0.0, -0.01, 0.03), 'ejectAt': 1 / 30.0}
    W.update(kw); return W

def model_burst():
    k = Kit(2)
    k.prism([(-0.07, 0.05), (-0.07, 0.125), (0.16, 0.125), (0.17, 0.11), (0.17, 0.05)], -0.0145, 0.0145, 'steel', bev=0.0015)
    k.box((0, 0.045, 0.129), (0.026, 0.22, 0.01), 'steel', bev=0.003)
    rifle_lower(k, 'wood')
    k.prism([(0.17, 0.072), (0.40, 0.076), (0.40, 0.104), (0.17, 0.104)], -0.022, 0.022, 'wood', bev=0.004)
    k.box((0, 0.29, 0.135), (0.032, 0.22, 0.024), 'wood', bev=0.006)
    k.lathe([(0.009, 0.40), (0.009, 0.58), (0.013, 0.58), (0.013, 0.625), (0.0055, 0.625), (0.0055, 0.40)], T(0, 0, 0.11), 14, 'steel', loop=True)
    k.box((0, 0.41, 0.125), (0.02, 0.03, 0.05), 'steel', bev=0.002); k.box((0, 0.56, 0.124), (0.016, 0.02, 0.03), 'steel', bev=0.002)
    k.box((0, 0.56, 0.141), (0.003, 0.004, 0.012), 'steel', bev=0.0004)
    for sx in (-1, 1): k.box((sx * 0.004, 0.15, 0.14), (0.003, 0.012, 0.008), 'steel', bev=0.0005)
    k.box((0, 0.15, 0.133), (0.02, 0.03, 0.008), 'steel', bev=0.001)
    k.prism([(-0.07, 0.118), (-0.07, 0.06), (-0.32, 0.03), (-0.33, 0.108), (-0.2, 0.114)], -0.019, 0.019, 'wood', bev=0.003)
    k.prism([(-0.33, 0.11), (-0.33, 0.028), (-0.342, 0.027), (-0.342, 0.111)], -0.02, 0.02, 'steel', bev=0.002)
    k.prism([(0.07, 0.05), (0.122, 0.05), (0.14, -0.03), (0.165, -0.11), (0.125, -0.125), (0.095, -0.04), (0.075, 0.0)], -0.012, 0.012, 'tan', 'mag', bev=0.0015)
    k.box((0.022, 0.10, 0.112), (0.02, 0.012, 0.012), 'steel', 'bolt', bev=0.002); k.box((0.0152, 0.06, 0.112), (0.002, 0.09, 0.012), 'steel', 'bolt', bev=0.0004)
    k.box((0.0152, 0.0, 0.085), (0.003, 0.05, 0.012), 'steel', bev=0.0005)
    return base_w(kit=k, tex=1024, bones={'gun': Matrix(), 'mag': T(0, 0.11, -0.03), 'bolt': T(0.02, 0.1, 0.112), 'trigger': T(0, 0.035, 0.047)},
                  left=('handguard', T(0, 0.28, 0.072)), eye=Vector((-0.19, -0.32, 0.165)), sight=(0, 0.15, 0.1445), sightFront=(0, 0.56, 0.1445), scope=0.0,
                  muzzle=(0, 0.625, 0.11), eject=(0.018, 0.07, 0.112), ejectDir=(0.9, 0.1, 0.4), magc=(0, 0.11, -0.03), anim=burst_anim)
def burst_anim(W):
    LM, FL_MAG = mag_grab(W['magc']); LC, FL_CH = lever_grab((-0.026, 0.10, 0.118))
    rel = box_mag_reload(W, 2.3, 1.35, 0.42, LM, FL_MAG, lever=(LC, FL_CH, 1.7), pull=0.06)
    clips = std_clips(fire=make_fire(0.006, 0.8, (0, 0.03, 0.01, 0)), melee=make_melee(0.13, 'butt'))
    return clips + [('vm_reload', 2.3, rel, False)], {'seat': 1.35}

def model_lever():
    k = Kit(2)
    k.prism([(-0.06, 0.055), (-0.06, 0.12), (0.11, 0.12), (0.12, 0.1), (0.12, 0.058)], -0.014, 0.014, 'steel', bev=0.0015)
    k.box((0.0143, 0.03, 0.085), (0.001, 0.035, 0.014), 'dark', bev=0)
    k.lathe([(0.0095, 0.12), (0.0095, 0.62), (0.0055, 0.62), (0.0055, 0.12)], T(0, 0, 0.105), 14, 'steel', loop=True)
    k.lathe([(0.009, 0.12), (0.009, 0.56), (0.0, 0.562)], T(0, 0, 0.083), 12, 'steel')
    k.lathe([(0.016, 0.13), (0.021, 0.14), (0.021, 0.32), (0.016, 0.33)], T(0, 0, 0.09), 16, 'wood')
    k.prism(CARBINE_GRIP, -0.013, 0.013, 'wood', bev=0.002)
    k.prism([(-0.06, 0.112), (-0.06, 0.06), (-0.33, 0.02), (-0.34, 0.105), (-0.2, 0.108)], -0.019, 0.019, 'wood', bev=0.003)
    k.prism(TRIG_PROF, -0.003, 0.003, 'steel', 'trigger', bev=0.0005)
    k.sweep([(0, 0.004, 0.052), (0, 0.004, 0.03), (0, 0.025, 0.012), (0, 0.075, 0.012), (0, 0.098, 0.03), (0, 0.10, 0.052)], 0.0045, 8, 'steel', 'bolt')
    for sx in (-1, 1): k.box((sx * 0.004, 0.20, 0.118), (0.003, 0.006, 0.01), 'steel', bev=0.0005)
    k.box((0, 0.60, 0.117), (0.003, 0.006, 0.01), 'brass', bev=0.0004)
    k.lathe([(0.0, 0.0), (0.006, 0.0), (0.006, 0.05), (0.003, 0.06), (0.0, 0.062)], T(0, 0.3, 0.083), 10, 'brass', 'mag')
    return base_w(kit=k, tex=1024, bones={'gun': Matrix(), 'mag': T(0, 0.33, 0.083), 'bolt': T(0, 0.10, 0.055), 'trigger': T(0, 0.035, 0.047)},
                  left=('handguard', T(0, 0.23, 0.069)), eye=Vector((-0.19, -0.32, 0.14)), sight=(0, 0.20, 0.1225), sightFront=(0, 0.60, 0.1225), scope=0.0,
                  muzzle=(0, 0.62, 0.105), eject=(0.0, 0.03, 0.125), ejectDir=(0.3, -0.2, 1.0), anim=lever_anim)
def lever_anim(W):
    PIV = (0, 0.10, 0.055)
    def lev(a): return Rax(48 * a, (1, 0, 0), PIV)
    def c_fire(t, D):
        k = smooth(0.0, 0.03, t) * (1 - smooth(0.05, 0.22, t)); a = smooth(0.25, 0.38, t) * (1 - smooth(0.42, 0.55, t))
        G = about(W['pivot'], T(0, -0.016 * k, 0.003 * k) @ Rx(6 * k + 3 * a) @ Ry(4 * a))
        P = hold_pose(G); P['d'] = {'bolt': lev(a)}; P['HR'] = G @ Rax(30 * a, (1, 0, 0), PIV) @ HR0
        P['fR'] = dict(FR_TRIG) if t < 0.2 or t > 0.6 else dict(FR_HOLD); P['trig'] = -13 * smooth(0, 0.03, t) * (1 - smooth(0.1, 0.25, t))
        P['ER'] = ER0 + G.translation + Vector((0, 0, -0.02)) * a
        return P
    PORT = T(0.014, 0.03, 0.085)
    LP = place((-1.5, 11.0, -1.4), (0.028, 0.026, 0.076), (-0.25, 0.90, 0.35), (0.90, 0.15, -0.40), 'L'); OFFS = LP.inverted() @ PORT      # under the right side, fingertips at the gate
    PINCH = {'index': (30, 35, 25, -11), 'middle': (35, 45, 30, 0), 'ring': (55, 70, 45, 8), 'pinky': (60, 75, 45, 17), 'thumb': (25, 25, 20, 0)}
    BELOW = T(-0.06, -0.08, -0.32) @ LP @ Rx(25); keys = [(0.0, HL0, FL_HOLD), (0.10, T(-0.01, 0, -0.01) @ HL0, OPEN)]; pushes = []
    for t0 in (0.30, 0.90, 1.50):
        keys += [(t0, BELOW, PINCH), (t0 + 0.30, T(0, -0.035, -0.012) @ LP, PINCH), (t0 + 0.42, LP, PINCH), (t0 + 0.48, T(0, 0.025, 0.004) @ LP, PINCH)]; pushes.append(t0 + 0.42)
    keys += [(2.12, T(-0.02, 0, -0.03) @ HL0, OPEN), (2.24, HL0, FL_HOLD), (2.80, HL0, FL_HOLD)]
    def c_reload(t, D):
        r = ease(t / 0.3) * (1 - ease((t - 2.0) / 0.25)); a = smooth(2.30, 2.43, t) * (1 - smooth(2.47, 2.6, t))
        G = T(-0.03 * r, 0.0, 0.03 * r) @ about(W['pivot'], Rz(8 * r) @ Rx(8 * r) @ Ry(-35 * r))
        P = hold_pose(G); L, fL = key_interp(keys, t); P['HL'] = G @ L; P['fL'] = fL; P['ER'] = ER0 + G.translation
        P['EL'] = P['HL'].translation + (EL_DIR + Vector((0.15, 0.2, 0.2)) * max(bump(t, t0 + 0.08, 0.12) for t0 in (0.3, 0.9, 1.5))).normalized() * 0.26
        for tp in pushes:
            if tp - 0.62 < t <= tp: P['mag'] = G @ L @ OFFS
            elif tp < t <= tp + 0.06: s = (t - tp) / 0.06; P['mag'] = G @ T(-0.01 * s, 0.05 * s, 0.0) @ PORT
        P['d'] = {'bolt': lev(a)}; P['HR'] = G @ Rax(30 * a, (1, 0, 0), PIV) @ HR0
        return P
    clips = [c if c[0] != 'vm_fire' else ('vm_fire', 0.75, c_fire, False) for c in std_clips(melee=make_melee(0.13, 'butt'))]
    return clips + [('vm_reload', 2.8, c_reload, False)], {'seat': pushes[-1] + 0.06, 'ejectAt': 0.34}

def model_autoshot():
    k = Kit(2)
    k.box((0, 0.08, 0.10), (0.05, 0.42, 0.095), 'polymer', bev=0.006)
    k.box((0, 0.06, 0.152), (0.03, 0.34, 0.012), 'alloy', bev=0.002)
    for sx in (-1, 1): k.box((sx * 0.0045, -0.03, 0.163), (0.003, 0.01, 0.012), 'steel', bev=0.0005)
    k.box((0, 0.22, 0.163), (0.003, 0.008, 0.012), 'steel', bev=0.0005)
    k.lathe([(0.021, 0.29), (0.021, 0.45), (0.0, 0.452)], T(0, 0, 0.10), 18, 'steel')
    for i in range(6): k.box((0, 0.31 + i * 0.022, 0.121), (0.02, 0.01, 0.002), 'dark', bev=0)
    k.lathe([(0.0125, 0.45), (0.0125, 0.49), (0.009, 0.49), (0.009, 0.45)], T(0, 0, 0.10), 14, 'steel', loop=True)
    rifle_lower(k); vfore(k, 0.25, 0.053)
    k.prism([(-0.13, 0.135), (-0.13, 0.06), (-0.33, 0.04), (-0.34, 0.13)], -0.02, 0.02, 'polymer', bev=0.003)
    k.lathe([(0.0, -0.03), (0.07, -0.03), (0.075, -0.02), (0.075, 0.02), (0.07, 0.03), (0.0, 0.03)], T(0, 0.10, -0.035) @ Rz(90), 22, 'polymer', 'mag')
    k.box((0, 0.10, 0.04), (0.026, 0.05, 0.03), 'polymer', 'mag', bev=0.002)
    k.box((-0.028, 0.16, 0.12), (0.012, 0.012, 0.01), 'steel', 'bolt', bev=0.002)
    return base_w(kit=k, tex=1024, bones={'gun': Matrix(), 'mag': T(0, 0.10, -0.03), 'bolt': T(-0.028, 0.16, 0.12), 'trigger': T(0, 0.035, 0.047)},
                  left=('vgrip', fr((0, 0.25, 0.053), (0, 1, 0), (0, 0, 1))), eye=Vector((-0.19, -0.30, 0.185)), sight=(0, -0.03, 0.169), sightFront=(0, 0.22, 0.169),
                  scope=0.0, muzzle=(0, 0.49, 0.10), eject=(0.026, 0.08, 0.11), ejectDir=(0.9, 0.0, 0.4), magc=(0, 0.1, -0.035), anim=autoshot_anim)
def autoshot_anim(W):
    LM, FL_MAG = mag_grab(W['magc'], (0.05, 0.6, 0.8), (-0.98, 0.1, 0.0)); LC, FL_CH = lever_grab((-0.03, 0.163, 0.12), (0.1, 0.35, 0.93), (-0.97, 0.05, 0.2))
    rel = box_mag_reload(W, 2.4, 1.45, 0.45, LM, FL_MAG, drop=0.4, lever=(LC, FL_CH, 1.78), pull=0.05)
    clips = std_clips(fire=make_fire(0.012, 2.2, (0, 0.02, 0.008, 0)), melee=make_melee(0.12, 'jab'))
    return clips + [('vm_reload', 2.4, rel, False)], {'seat': 1.45}

GL_CYL = 0.075; GL_CRANE = (-0.03, 0.0, 0.035)
def model_gl():
    k = Kit(2)
    rifle_lower(k); k.box((0, 0.02, 0.07), (0.04, 0.14, 0.05), 'steel', bev=0.003)
    k.lathe([(0.0, 0.05), (0.058, 0.05), (0.062, 0.06), (0.062, 0.19), (0.058, 0.2), (0.0, 0.2)], T(0, 0, GL_CYL), 24, 'steel', 'mag')
    for i in range(6):
        a = math.radians(90 + 60 * i); k.box((0.038 * math.cos(a), 0.201, GL_CYL + 0.038 * math.sin(a)), (0.03, 0.002, 0.03), 'dark', 'mag', bev=0)
    k.lathe([(0.028, 0.20), (0.028, 0.50), (0.021, 0.50), (0.021, 0.20)], T(0, 0, GL_CYL + 0.038), 20, 'olive', loop=True)
    k.box((0, 0.12, GL_CYL + 0.08), (0.03, 0.30, 0.012), 'alloy', bev=0.002)
    k.box((0, 0.36, 0.105), (0.03, 0.06, 0.03), 'steel', bev=0.002); vfore(k, 0.36, 0.09)
    k.tube(0.017, 0.014, 0.0, 0.04, 0, GL_CYL + 0.11, 20, 'alloy'); k.box((0, 0.02, GL_CYL + 0.089), (0.02, 0.03, 0.01), 'alloy', bev=0.001)
    for sx in (-1, 1): k.sweep([(sx * 0.012, -0.05, 0.08), (sx * 0.012, -0.2, 0.075), (sx * 0.012, -0.30, 0.07)], 0.006, 8, 'steel')
    k.prism([(-0.30, 0.12), (-0.30, 0.03), (-0.315, 0.028), (-0.315, 0.122)], -0.02, 0.02, 'rubber', bev=0.002)
    k.box((-0.016, 0.03, 0.08), (0.002, 0.02, 0.01), 'steel', 'bolt', bev=0.0005)
    return base_w(kit=k, tex=1024, bones={'gun': Matrix(), 'mag': T(0, 0.125, GL_CYL), 'bolt': T(-0.016, 0.03, 0.08), 'trigger': T(0, 0.035, 0.047)},
                  left=('vgrip', fr((0, 0.36, 0.09), (0, 1, 0), (0, 0, 1))), eye=Vector((-0.19, -0.30, 0.205)), sight=(0, 0.0, GL_CYL + 0.11), sightFront=(0, 0.04, GL_CYL + 0.11),
                  scope=0.014, muzzle=(0, 0.50, GL_CYL + 0.038), eject=None, anim=gl_anim)
def gl_anim(W):
    def swing(a): return Rax(-70 * a, (0, 1, 0), GL_CRANE)
    def c_fire(t, D):
        k = smooth(0.0, 0.03, t) * (1 - smooth(0.06, 0.30, t))
        G = about(W['pivot'], T(0, -0.03 * k, 0.008 * k) @ Rx(9 * k) @ Rz(-2 * k)); P = hold_pose(G); P['fR'] = dict(FR_TRIG)
        P['trig'] = -14 * smooth(0, 0.03, t) * (1 - smooth(0.1, 0.25, t)); P['ER'] = ER0 + G.translation; P['EL'] = EL0 + G.translation
        P['d'] = {'mag': Rax(-60 * smooth(0.08, 0.2, t), (0, 1, 0), (0, 0, GL_CYL))}
        return P
    PIN = {'index': (30, 35, 25, -11), 'middle': (35, 45, 30, 0), 'ring': (55, 70, 45, 8), 'pinky': (60, 75, 45, 17), 'thumb': (25, 25, 20, 0)}
    front = swing(1) @ Vector((0.0, 0.21, GL_CYL)); LLOAD = place((-1.5, 11.0, -1.4), front + Vector((-0.01, 0.02, 0.0)), (0.1, -0.2, 0.97), (-0.95, 0.1, 0.1), 'L')
    BELOW = T(-0.06, -0.06, -0.30) @ LLOAD @ Rx(25)
    keys = [(0.0, HL0, FL_HOLD), (0.15, T(-0.01, 0, -0.01) @ HL0, OPEN), (0.45, LLOAD, OPEN)]
    for i, t0 in enumerate((0.7, 1.35, 2.0)): keys += [(t0, BELOW, PIN), (t0 + 0.3, T(0, 0.03, 0.0) @ LLOAD, PIN), (t0 + 0.45, LLOAD, PIN)]
    keys += [(2.6, T(0.02, 0, 0) @ LLOAD, OPEN), (2.85, HL0, OPEN), (3.0, HL0, FL_HOLD)]
    def c_reload(t, D):
        s = smooth(0.2, 0.4, t) * (1 - smooth(2.5, 2.65, t)); a = ease(t / 0.3) * (1 - ease((t - 2.55) / 0.35)); up = smooth(0.35, 0.6, t) * (1 - smooth(2.4, 2.6, t))
        G = T(-0.03 * a, 0.05 * a, -0.02 * a) @ about(W['pivot'], Rx(-10 * up) @ Rz(18 * a) @ Ry(32 * a)); G = T(0, 0, 0.003 * bump(t, 2.62, 0.03)) @ G
        P = hold_pose(G); L, fL = key_interp(keys, t); P['HL'] = G @ L; P['fL'] = fL; P['d'] = {'mag': swing(s)}; P['ER'] = ER0 + G.translation
        P['EL'] = P['HL'].translation + (EL_DIR + Vector((0.1, 0.1, 0.3)) * max(bump(t, t0 + 0.05, 0.12) for t0 in (0.7, 1.35, 2.0))).normalized() * 0.26
        return P
    clips = [c if c[0] != 'vm_fire' else ('vm_fire', 0.3, c_fire, False) for c in std_clips(melee=make_melee(0.12, 'butt'))]
    return clips + [('vm_reload', 3.0, c_reload, False)], {'seat': 2.45}

def model_flamer():
    k = Kit(2)
    rifle_lower(k)
    k.box((0, 0.02, 0.07), (0.035, 0.14, 0.05), 'olive', bev=0.004)
    k.lathe([(0.02, -0.06), (0.02, 0.46), (0.0, 0.462)], T(0, 0, 0.10), 16, 'olive')
    k.lathe([(0.022, 0.44), (0.03, 0.47), (0.03, 0.52), (0.012, 0.52), (0.012, 0.46)], T(0, 0, 0.10), 16, 'steel', loop=True)
    for yy in (0.47, 0.51): k.lathe([(0.04, yy), (0.04, yy + 0.006)], T(0, 0, 0.10), 16, 'steel', caps=False)
    k.box((0, 0.495, 0.075), (0.008, 0.03, 0.01), 'steel', bev=0.001); k.box((0, 0.512, 0.075), (0.006, 0.004, 0.006), 'red', bev=0)
    k.lathe([(0.0, 0.0), (0.03, 0.0), (0.03, 0.008), (0.0, 0.009)], T(0, 0.25, 0.125) @ Rx(90), 12, 'red', 'bolt')
    k.lathe([(0.004, 0.0), (0.004, 0.006)], T(0, 0.25, 0.12) @ Rx(90), 8, 'steel')
    vfore(k, 0.30, 0.08)
    k.sweep([(0, -0.05, 0.08), (0.01, -0.10, 0.05), (0.03, -0.15, -0.05), (0.05, -0.18, -0.25), (0.07, -0.2, -0.65)], 0.016, 10, 'rubber')
    return base_w(kit=k, tex=1024, bones={'gun': Matrix(), 'bolt': T(0, 0.25, 0.125), 'trigger': T(0, 0.035, 0.047)},
                  left=('vgrip', fr((0, 0.30, 0.08), (0, 1, 0), (0, 0, 1))), eye=Vector((-0.19, -0.30, 0.17)), sight=(0, 0.0, 0.15), sightFront=(0, 0.45, 0.15),
                  scope=0.0, muzzle=(0, 0.52, 0.10), eject=None, anim=flamer_anim)
def flamer_anim(W):
    def c_fire(t, D):
        w = 2 * math.pi * t / D
        G = about(W['pivot'], T(0.0015 * math.sin(2 * w), -0.004 * (1 - math.cos(w)) / 2, 0.002 * math.sin(3 * w)) @ Rx(0.6 * math.sin(2 * w)) @ Rz(0.4 * math.sin(w)))
        P = hold_pose(G); P['fR'] = dict(FR_TRIG); P['trig'] = -13; P['ER'] = ER0 + G.translation; P['EL'] = EL0 + G.translation
        return P
    LV = settle(place((-2.85, 9.3, -1.2), (-0.02, 0.25, 0.128), (0.15, 0.25, 0.96), (-0.97, 0.05, 0.2), 'L'), 'L', BVH_BOLT, clear=0.002)
    FV = grasp(LV, 'L', BVH_BOLT, start=(10, 10, 5))
    keys = [(0.0, HL0, FL_HOLD), (0.15, T(-0.01, 0, 0) @ HL0, OPEN), (0.45, LV, FV), (1.1, LV @ Ry(-60), FV), (1.25, LV @ Ry(-60), OPEN), (1.6, HL0, OPEN), (1.8, HL0, FL_HOLD)]
    def c_reload(t, D):
        a = ease(t / 0.3) * (1 - ease((t - 1.4) / 0.35)); G = T(-0.01 * a, 0, 0.01 * a) @ about(W['pivot'], Ry(10 * a) @ Rx(4 * a))
        P = hold_pose(G); L, fL = key_interp(keys, t); P['HL'] = G @ L; P['fL'] = fL; P['ER'] = ER0 + G.translation
        P['d'] = {'bolt': REST['bolt'] @ Rz(-120 * smooth(0.45, 1.1, t)) @ REST['bolt'].inverted()}
        P['EL'] = P['HL'].translation + (EL_DIR + Vector((-0.05, -0.3, -0.2)) * smooth(0.2, 0.45, t) * (1 - smooth(1.25, 1.6, t))).normalized() * 0.26
        return P
    clips = [c if c[0] != 'vm_fire' else ('vm_fire', 0.2, c_fire, True) for c in std_clips(melee=make_melee(0.12, 'jab'))]
    return clips + [('vm_reload', 1.8, c_reload, False)], {'seat': 1.25}

def model_crossbow():
    k = Kit(2)
    rifle_lower(k)
    k.prism([(-0.30, 0.13), (-0.30, 0.04), (-0.07, 0.05), (0.05, 0.06), (0.42, 0.075), (0.42, 0.105), (-0.05, 0.11)], -0.016, 0.016, 'polymer', bev=0.003)
    k.box((0, 0.2, 0.112), (0.012, 0.48, 0.008), 'alloy', bev=0.001)
    for sx in (-1, 1):
        k.sweep([(sx * 0.016, 0.43, 0.09), (sx * 0.12, 0.42, 0.09), (sx * 0.24, 0.39, 0.09), (sx * 0.30, 0.35, 0.09)], 0.009, 8, 'polymer')
        k.lathe([(0.0, -0.008), (0.022, -0.008), (0.022, 0.008), (0.0, 0.008)], T(sx * 0.30, 0.35, 0.09), 14, 'alloy')
        k.sweep([(sx * 0.30, 0.35, 0.095), (sx * 0.15, 0.20, 0.104), (0.0, 0.07, 0.11)], 0.0018, 6, 'dark', 'bolt')
    k.lathe([(0.0, 0.07), (0.0035, 0.075), (0.0035, 0.50), (0.006, 0.505), (0.0, 0.53)], T(0, 0, 0.122), 8, 'alloy', 'mag')
    for sx in (-1, 1): k.box((sx * 0.006, 0.09, 0.122), (0.01, 0.03, 0.001), 'red', 'mag', bev=0)
    k.tube(0.0145, 0.012, -0.03, 0.09, 0, 0.165, 20, 'alloy'); k.box((0, 0.03, 0.145), (0.012, 0.04, 0.02), 'alloy', bev=0.002)
    k.box((0.0, 0.0, 0.14), (0.03, 0.02, 0.01), 'polymer', 'trigger', bev=0.001)
    return base_w(kit=k, tex=1024, bones={'gun': Matrix(), 'mag': T(0, 0.3, 0.122), 'bolt': T(0, 0.07, 0.11), 'trigger': T(0, 0.035, 0.047)},
                  left=('handguard', T(0, 0.26, 0.072)), eye=Vector((-0.19, -0.32, 0.18)), sight=(0, -0.03, 0.165), sightFront=(0, 0.09, 0.165), scope=0.012,
                  muzzle=(0, 0.53, 0.122), eject=None, anim=crossbow_anim)
def crossbow_anim(W):
    LS = settle(place((-2.85, 9.3, -1.2), (0.0, 0.07, 0.125), (0.15, -0.3, 0.94), (-0.95, -0.05, 0.25), 'L'), 'L', BVH_BOLT, clear=0.002)
    FS = grasp(LS, 'L', BVH_BOLT, start=(15, 15, 10)); LB = place((-1.5, 11.0, -1.4), Vector((-0.004, 0.2, 0.128)), (0.15, 0.98, 0.1), (-0.3, 0.0, 0.95), 'L')
    PIN = {'index': (30, 35, 25, -11), 'middle': (35, 45, 30, 0), 'ring': (55, 70, 45, 8), 'pinky': (60, 75, 45, 17), 'thumb': (25, 25, 20, 0)}
    OFFB = LB.inverted() @ REST['mag']; BELOW = T(-0.06, -0.06, -0.28) @ LB @ Rx(20)
    def cycle(t, t0, P, G):
        u = t - t0
        keys = [(0.0, HL0, FL_HOLD), (0.12, T(-0.01, 0, 0) @ HL0, OPEN), (0.28, T(0, 0.30, 0.0) @ LS, OPEN), (0.34, T(0, 0.30, 0) @ LS, FS), (0.58, LS, FS),
                (0.62, LS, OPEN), (0.78, BELOW, PIN), (0.95, T(0, -0.04, 0.02) @ LB, PIN), (1.05, LB, PIN), (1.12, T(-0.01, 0, -0.01) @ LB, OPEN), (1.3, HL0, FL_HOLD)]
        L, fL = key_interp(keys, max(0.0, u)); P['HL'] = G @ L; P['fL'] = fL
        pull = 0.30 * (1 - smooth(0.34, 0.58, u)) if u >= 0.0 else 0.0
        P['bolt'] = -pull if 0.0 < u < 0.62 else 0.0
        if 0.62 <= u <= 1.05: P['mag'] = G @ L @ OFFB
        P['EL'] = P['HL'].translation + (EL_DIR + Vector((0.1, 0.1, 0.3)) * bump(u, 0.8, 0.1)).normalized() * 0.26
    def c_fire(t, D):
        k = smooth(0.0, 0.02, t) * (1 - smooth(0.04, 0.2, t)); G = about(W['pivot'], T(0, -0.006 * k, 0.002 * k) @ Rx(2 * k)); P = hold_pose(G)
        P['fR'] = dict(FR_TRIG); P['trig'] = -10 * smooth(0, 0.02, t) * (1 - smooth(0.1, 0.2, t)); P['ER'] = ER0 + G.translation
        if t < 0.2: P['bolt'] = -0.30 * min(1.0, t / 0.04)
        if 0.0 < t < 0.82: P['mag'] = G @ T(0, 2.0 + 40 * t, 0) @ REST['mag']
        if t >= 0.2: cycle(t, 0.2, P, G); P['bolt'] = P.get('bolt', 0.0) - 0.0 if t > 0.82 else (-0.30 if t < 0.48 else P['bolt'])
        return P
    def c_reload(t, D):
        G = Matrix(); P = hold_pose(G); u = t + 0.62
        keys = [(0.0, HL0, FL_HOLD), (0.15, BELOW, PIN), (0.35, BELOW, PIN), (0.55, T(0, -0.04, 0.02) @ LB, PIN), (0.68, LB, PIN), (0.76, T(-0.01, 0, -0.01) @ LB, OPEN), (1.0, HL0, FL_HOLD)]
        L, fL = key_interp(keys, t); P['HL'] = G @ L; P['fL'] = fL
        if t < 0.68: P['mag'] = (G @ T(0, 0, -3.0) @ REST['mag']) if t < 0.15 else G @ L @ OFFB
        P['EL'] = P['HL'].translation + (EL_DIR + Vector((0.1, 0.1, 0.3)) * bump(t, 0.25, 0.12)).normalized() * 0.26
        return P
    clips = [c if c[0] != 'vm_fire' else ('vm_fire', 1.3, c_fire, False) for c in std_clips(melee=make_melee(0.12, 'butt'))]
    return clips + [('vm_reload', 1.0, c_reload, False)], {'seat': 0.68}

def model_machete():
    k = Kit(2)
    k.prism([(0.004, 0.016), (0.20, 0.022), (0.30, 0.024), (0.335, 0.012), (0.33, -0.012), (0.25, -0.024), (0.12, -0.022), (0.004, -0.016)], -0.0018, 0.0018, 'steel', bev=0.0012)
    k.box((0, 0.17, -0.0195), (0.0038, 0.33, 0.004), 'bright', bev=0.0003)
    k.box((0, 0.0, -0.002), (0.014, 0.008, 0.038), 'steel', bev=0.0015)
    prof = [(0.0, -0.004), (0.012, -0.004)] + [(0.0135 if i % 2 else 0.0122, -0.004 - i * 0.012) for i in range(1, 10)] + [(0.0125, -0.12), (0.0, -0.121)]
    k.lathe(prof, T(0, 0, 0.0), 20, 'wood')
    k.lathe([(0.0, -0.12), (0.0135, -0.12), (0.0135, -0.13), (0.0, -0.135)], T(0, 0, 0.0), 20, 'steel')
    for i in range(3): k.lathe([(0.0035, 0.0), (0.0035, 0.03), (0.0, 0.031)], T(0.0, -0.03 - i * 0.035, 0.0) @ Rz(90), 8, 'brass')
    GF, Q, gc = blade_hold(k, (0, -0.06, 0.0), -48); free = T(-0.22, -0.30, -0.45) @ fr((0, 0, 0), (0.1, 0.3, -0.95), (-0.95, 0.0, -0.1))
    return {'kit': k, 'tex': 512, 'bones': {'gun': Matrix()}, 'boltdir': Vector((0, -1, 0)), 'grip': GF, 'trigger_pt': None, 'wrap': True,
            'left': ('free', free), 'er': (Q.to_3x3() @ ER_DIR).normalized(), 'eye': Vector((-0.18, -0.33, 0.18)), 'sight': None, 'sightFront': None, 'scope': 0.0,
            'muzzle': None, 'eject': None, 'pivot': gc, 'rough': 0.45, 'metal': 0.4, 'anim': machete_anim}
def machete_anim(W):
    def c_slash(t, D):
        w = smooth(0.0, 0.08, t) * (1 - smooth(0.08, 0.16, t)); s = smooth(0.08, 0.22, t); a = s * (1 - smooth(0.24, 0.42, t))
        G = T(0.10 * w - 0.30 * a, 0.05 * a, 0.10 * w - 0.10 * a) @ about(W['pivot'], Rz(-25 * w + 75 * a) @ Ry(-35 * w + 70 * a) @ Rx(15 * w - 25 * a))
        P = hold_pose(G); P['ER'] = ER0 + G.translation * 0.9; return P
    def c_back(t, D):
        w = smooth(0.0, 0.1, t) * (1 - smooth(0.1, 0.18, t)); s = smooth(0.1, 0.25, t); a = s * (1 - smooth(0.27, 0.45, t))
        G = T(-0.15 * w + 0.28 * a, 0.04 * a, 0.06 * w - 0.05 * a) @ about(W['pivot'], Rz(30 * w - 70 * a) @ Ry(50 * w - 60 * a) @ Rx(-10 * a))
        P = hold_pose(G); P['ER'] = ER0 + G.translation * 0.9; return P
    clips = [('vm_idle', 2.8, c_idle, True), ('vm_draw', 0.5, make_draw(0.25, 0.05, 0.03, -40, -30, -10), False),
             ('vm_run', 0.7, make_run(8, -8, -6, (0.01, 0.0, -0.01), 0.014), True), ('vm_fire', 0.42, c_slash, False), ('vm_fire2', 0.45, c_back, False)]
    return clips, {}
MODELS.update({'burst': model_burst, 'lever': model_lever, 'autoshot': model_autoshot, 'gl': model_gl, 'flamer': model_flamer, 'crossbow': model_crossbow, 'machete': model_machete})

# ---------------------------------------------------------------- one weapon, start to finish
def clean_weapon(wid):
    c = bpy.data.collections.get('w_' + wid)
    if c:
        for ob in list(c.objects): bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.armatures):
        for d in list(coll):
            if d.name.startswith(wid + '_') and d.users == 0: coll.remove(d)
    for a in list(bpy.data.actions):
        if a.name.startswith(wid + '_vm_'): bpy.data.actions.remove(a)
    if wid != 'carbine':
        for coll, n in ((bpy.data.materials, wid + '_gun'), (bpy.data.images, wid + '_gun')):
            d = coll.get(n)
            if d: coll.remove(d)
    if c is None:
        c = bpy.data.collections.new('w_' + wid); scene.collection.children.link(c)
    return c
def build_rig(wid, bones):
    arm = bpy.data.armatures.new(wid + '_rig'); r = bpy.data.objects.new(wid + '_rig', arm); col.objects.link(r)
    vl = bpy.context.view_layer
    for o in list(vl.objects):
        if o is not None: o.select_set(False)
    vl.objects.active = r; r.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for name, M, L, par in bones:
        eb = arm.edit_bones.new(name); eb.head = (0, 0, 0); eb.tail = (0, L, 0); eb.matrix = M; eb.use_deform = True
    for name, M, L, par in bones:
        if par: arm.edit_bones[name].parent = arm.edit_bones[par]; arm.edit_bones[name].use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in r.pose.bones: pb.rotation_mode = 'QUATERNION'
    r.animation_data_create()
    return r
def arm_bones():
    out = []
    for side, A in (('R', HR0), ('L', HL0)):
        mir = (lambda M: M) if side == 'R' else mirror
        out.append(('forearm_' + side, A @ cm2m(mir(T(0, -FORE_LEN, 0))), FORE_LEN * 0.01, None))
        out.append(('hand_' + side, A.copy(), 0.095, None))
        for c in CHAINS:
            for k in range(3):
                out.append(('%s%d_%s' % (c['name'], k + 1, side), A @ cm2m(mir(c['F'][k])), c['L'][k] * 0.01,
                            'hand_' + side if k == 0 else '%s%d_%s' % (c['name'], k, side)))
    return out
def build_arms(wid):
    n = len(co_cm)
    vR = [HR0 @ Vector(p * 0.01) for p in co_cm]; vL = [HL0 @ Vector((-p[0] * 0.01, p[1] * 0.01, p[2] * 0.01)) for p in co_cm]
    faces = [tuple(t) for t in tris] + [(t[0] + n, t[2] + n, t[1] + n) for t in tris]
    me = bpy.data.meshes.new(wid + '_arms'); me.from_pydata([tuple(v) for v in vR + vL], [], faces)
    uvl = me.uv_layers.new(name='UVMap')
    uvl.data.foreach_set('uv', np.concatenate([tuv.reshape(-1, 2), tuv[:, [0, 2, 1], :].reshape(-1, 2)]).ravel())
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons)); me.update()
    ob = make_mesh_object(wid + '_arms', me); vgs = {}
    for i, ws in enumerate(weights):
        for side, off in (('R', 0), ('L', n)):
            for b, w in ws:
                if w <= 0.002: continue
                nm = b + '_' + side
                if nm not in vgs: vgs[nm] = ob.vertex_groups.new(name=nm)
                vgs[nm].add([i + off], w, 'REPLACE')
    return ob
def apply_pose(P):
    pbs = rig.pose.bones
    def root(name, M): pbs[name].matrix_basis = REST[name].inverted() @ M
    G = P['G']; root('gun', G); d = P.get('d', {}); w = dict(P.get('w', {}))
    if P.get('mag') is not None: w['mag'] = P['mag']
    for b in CUR['bones']:
        if b == 'gun': continue
        if b in w: root(b, w[b]); continue
        Dm = d.get(b)
        if Dm is None:
            if b == 'bolt' and P.get('bolt'): Dm = T(*(CUR['boltdir'] * P['bolt']))
            elif b == 'trigger' and P.get('trig'): Dm = REST['trigger'] @ Rx(P['trig']) @ REST['trigger'].inverted()
            else: Dm = Matrix()
        root(b, G @ Dm @ REST[b])
    for side in 'RL':
        H, E = P['H' + side], P['E' + side]
        root('hand_' + side, H); root('forearm_' + side, forearm_matrix(H, E, side, CUR.get('stretch', {}).get(side, 1.0)))
        sg = 1 if side == 'R' else -1
        for name, ang in P['f' + side].items():
            c = CH[name]; ds = ang[3] if len(ang) > 3 else 0.0
            pbs['%s1_%s' % (name, side)].matrix_basis = Rz(sg * ds) @ Rx(-(ang[0] - c['rest'][0]))
            pbs['%s2_%s' % (name, side)].matrix_basis = Rx(-(ang[1] - c['rest'][1]))
            pbs['%s3_%s' % (name, side)].matrix_basis = Rx(-(ang[2] - c['rest'][2]))
def use_action(name):
    act = bpy.data.actions[name]; rig.animation_data.action = act
    if hasattr(rig.animation_data, 'action_slot') and len(act.slots): rig.animation_data.action_slot = act.slots[0]
def bake(name, D, fn):
    act = bpy.data.actions.new(name); act.use_fake_user = True
    rig.animation_data.action = act
    n = int(round(D * FPS)); prev = {}
    for f in range(n + 1):
        apply_pose(fn(f / FPS, D))
        for pb in rig.pose.bones:
            q = pb.rotation_quaternion.copy()
            if pb.name in prev: q.make_compatible(prev[pb.name])
            pb.rotation_quaternion = q; prev[pb.name] = q
            pb.keyframe_insert('location', frame=f, group=pb.name); pb.keyframe_insert('rotation_quaternion', frame=f, group=pb.name)
    return n
def arms_material():
    m = bpy.data.materials.get('ashfall_arms'); img = bpy.data.images.get('ashfall_arms')
    if m and img and 'arms' not in OPT: return m, False
    return None, True
def build_weapon(wid):
    global col, gun_groups, BVH_GUN, BVH_NOTRIG, BVH_MAG, BVH_BOLT, HR0, HL0, ER0, EL0, FR_HOLD, FR_TRIG, FL_HOLD, rig, REST, CUR, arms_ob, gun_ob
    col = clean_weapon(wid); W = MODELS[wid](); W['id'] = wid; CUR = W
    if W.get('carbine'): gun_ob, gun_groups = carbine_gun_object(wid + '_gun')
    else:
        gun_ob, gun_groups = kit_object(W['kit'], wid + '_gun')
        img = gun_texture(gun_ob, W['tex'], wid + '_gun')
        gun_ob.data.materials.append(image_material(wid + '_gun', img, W.get('rough', 0.6), W.get('metal', 0.25)))
    names = list(W['bones'])
    BVH_GUN = bvh_of(gun_ob, names); BVH_NOTRIG = bvh_of(gun_ob, [n for n in names if n != 'trigger'])
    BVH_MAG = bvh_of(gun_ob, ['mag'] if 'mag' in gun_groups else names); BVH_BOLT = bvh_of(gun_ob, ['bolt'] if 'bolt' in gun_groups else names)
    GF = W['grip']
    if W.get('carbine'): HR0 = right_hold()
    else: HR0 = settle(GF @ T(0, W.get('grip_fwd', 0.0), W.get('grip_up', 0.0)) @ REF['HR'], 'R', BVH_GUN, direction=-GF.col[0].to_3d())
    FR_HOLD = grasp(HR0, 'R', BVH_GUN, skip=('thumb',) if W.get('wrap') else ('index', 'thumb'))
    if not W.get('wrap'): FR_HOLD['index'] = fit_index_straight(HR0)
    FR_HOLD['thumb'] = reach(HR0, 'R', 'thumb', Vector(W['rthumb']) if W.get('rthumb') else GF @ REF['thumb'], BVH_GUN, range(-30, 61, 5), range(0, 61, 10), range(0, 61, 10), range(-60, 61, 5))
    FR_TRIG = dict(FR_HOLD)
    if W.get('trigger_pt') is not None: FR_TRIG['index'] = fit_index_trigger(HR0)
    kind, LF = W['left']
    if kind == 'carbine': HL0 = left_hold(); FL_HOLD = grasp(HL0, 'L', BVH_GUN)
    elif kind == 'handguard': HL0 = settle(LF @ REF['HL'], 'L', BVH_GUN); FL_HOLD = grasp(HL0, 'L', BVH_GUN)
    elif kind == 'vgrip':
        HL0 = settle(LF @ S4 @ REF['HR'] @ S4, 'L', BVH_GUN, direction=LF.col[0].to_3d())
        FL_HOLD = grasp(HL0, 'L', BVH_GUN, skip=('thumb',)); FL_HOLD['thumb'] = close_chain(HL0, 'L', 'thumb', BVH_GUN, (-10, 0, 0), (55, 70, 80))
    elif kind == 'pistol':
        b = bvh_of(gun_ob, names, right_hand_proxy(HR0, FR_HOLD))
        H = GF @ T(-0.024, 0.004, -0.014) @ W.get('lofs', Matrix()) @ S4 @ REF['HR'] @ S4 @ Rx(-12)
        HL0 = settle(H, 'L', b, direction=GF.col[0].to_3d()); FL_HOLD = grasp(HL0, 'L', b)
        if W.get('lthumb'): FL_HOLD['thumb'] = reach(HL0, 'L', 'thumb', Vector(W['lthumb']), b, range(-30, 61, 5), range(0, 61, 10), range(0, 61, 10), range(-60, 61, 5))
    elif kind == 'bar':      # minigun top handle: palm down over a bar running across the gun
        H = place((0, 4.8, -1.8), Vector((-0.005, 0.105, 0.245)), (0.35, 0.93, 0.05), (-0.1, 0.0, 1.0), 'L')
        HL0 = settle(H, 'L', BVH_GUN); FL_HOLD = grasp(HL0, 'L', BVH_GUN)
    else:      # 'free': W['left'][1] is the hand pose (a knife fighter's empty hand)
        HL0 = LF; FL_HOLD = dict(OPEN)
    ER0 = HR0.translation + W.get('er', ER_DIR) * 0.26; EL0 = HL0.translation + W.get('el', EL_DIR) * 0.26
    log(wid, 'right', {k: tuple(round(x) for x in v) for k, v in FR_HOLD.items()}, '| left', {k: tuple(round(x) for x in v) for k, v in FL_HOLD.items()})
    bones = arm_bones() + [(n, M, 0.03, None) for n, M in W['bones'].items()]
    rig = build_rig(wid, bones); REST = {n: M for n, M, L, p in bones}
    arms_ob = build_arms(wid)
    for ob in (arms_ob, gun_ob):
        ob.parent = rig; md = ob.modifiers.new('rig', 'ARMATURE'); md.object = rig
    clips, extra = W['anim'](W)
    lens = {}
    for name, D, fn, loop in clips: lens[name] = bake(wid + '_' + name, D, fn) / FPS
    use_action(wid + '_vm_idle'); scene.frame_set(0)
    m, need = arms_material()
    if need:
        img = build_texture(); m = image_material('ashfall_arms', img, 0.85, 0.0)
    arms_ob.data.materials.append(m)
    gun_ob.data.calc_loop_triangles(); ntris = len(gun_ob.data.loop_triangles)
    info = {'eye': game(W['eye']), 'sight': game(W['sight']) if W.get('sight') else None, 'sightFront': game(W['sightFront']) if W.get('sightFront') else None,
            'scope': W.get('scope', 0.0), 'muzzle': game(W['muzzle']) if W.get('muzzle') else None,
            'eject': game(W['eject']) if W.get('eject') else None, 'ejectDir': gamedir(W['ejectDir']) if W.get('ejectDir') else None,
            'ejectAt': round(extra.get('ejectAt', W.get('ejectAt', 0.0)), 3) if W.get('eject') else None, 'seat': round(extra['seat'], 3) if extra.get('seat') else None,
            'clips': {k: round(v, 3) for k, v in lens.items()}, 'spinBone': W.get('spin'), 'tris': ntris}
    col['hg_info'] = json.dumps(info)
    cfg = {'blend': 'weapons.blend', 'out': '../../Ashfall/assets/w_' + wid, 'maxTexture': 1024,
           'skins': [{'name': 'viewmodel', 'rig': wid + '_rig', 'lods': [wid + '_arms', wid + '_gun'], 'together': True,
                      'as': {wid + '_arms': 'vm_arms', wid + '_gun': 'vm_gun'},
                      'clips': {n: dict({'action': wid + '_' + n}, **({'loop': True} if loop else {})) for n, D, fn, loop in clips}}]}
    with open(os.path.join(BASE, 'w_%s.export.json' % wid), 'w') as f: json.dump(cfg, f, indent=1)
    log(wid, 'done:', ntris, 'gun triangles, clips', info['clips'], 'seat', info['seat'])
    return W

# ---------------------------------------------------------------- run
col = bpy.data.collections.get('_work') or bpy.data.collections.new('_work')
if col.name not in scene.collection.children: scene.collection.children.link(col)
co_cm, tris, tuv = build_arm_mesh()
weights, vpart = arm_weights(co_cm)
def _palm_points():
    a, b, c = co_cm[tris[:, 0]], co_cm[tris[:, 1]], co_cm[tris[:, 2]]; fn = np.cross(b - a, c - a)
    nrm = np.zeros_like(co_cm)
    for k in range(3): np.add.at(nrm, tris[:, k], fn)
    nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
    sel = [i for i in range(len(co_cm)) if GROUPS[vpart[i]] == 'palm' and nrm[i, 2] < -0.3 and 0.5 < co_cm[i, 1] < 9.5]
    return [Vector(co_cm[i] * 0.01) for i in sel[::2]]
PALM_LOCAL[:] = _palm_points()
carbine_reference()
todo = [w for w in ORDER if w in MODELS and ('only' not in OPT or w in OPT['only'].split(','))]
built = {}
for wid in todo: built[wid] = build_weapon(wid)
wj = {}
for wid in ORDER:
    c = bpy.data.collections.get('w_' + wid)
    if c is not None and c.get('hg_info') and bpy.data.objects.get(wid + '_rig') and os.path.exists(os.path.join(OUTDIR, 'w_%s.hgm' % wid)):
        wj[wid] = json.loads(c['hg_info'])      # only weapons whose .hgm has been exported (the game offers every weapon listed)
with open(os.path.join(OUTDIR, 'weapons.json'), 'w') as f: json.dump(wj, f, indent=1)
log('weapons.json:', list(wj))
if 'nosave' not in OPT: bpy.ops.wm.save_mainfile(); log('saved', bpy.data.filepath)

# ---------------------------------------------------------------- previews (after the save; never saved)
def previews(wid, W, what):
    global rig, arms_ob, gun_ob
    rig = bpy.data.objects[wid + '_rig']; arms_ob = bpy.data.objects[wid + '_arms']; gun_ob = bpy.data.objects[wid + '_gun']
    sc = bpy.data.scenes.new('wp_preview')
    for o in (rig, arms_ob, gun_ob): sc.collection.objects.link(o)
    sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'TEXTURE'
    sc.render.fps = scene.render.fps
    cd = bpy.data.cameras.new('wp_cam'); cam = bpy.data.objects.new('wp_cam', cd); sc.collection.objects.link(cam); sc.camera = cam
    cd.sensor_fit = 'VERTICAL'; cd.clip_start = 0.01
    bb = [gun_ob.matrix_world @ Vector(c) for c in gun_ob.bound_box]; ctr = sum(bb, Vector()) / 8; size = max((bb[6] - bb[0]).length, 0.2)
    eye = W['eye']; sight = Vector(W['sight']) if W.get('sight') else eye
    V = {'game': (eye, eye + Vector((0, 1, 0)), 50), 'aim': (sight - Vector((0, 0.15, 0)), sight + Vector((0, 1, 0)), 30),
         'side': (ctr + Vector((size * 1.1, 0, 0.02)), ctr, 40), 'left': (ctr + Vector((-size * 0.9, size * 0.2, -0.05)), ctr, 40),
         'below': (ctr + Vector((0.25, -0.3, -0.25)), ctr, 40)}
    def shoot(view, path, w, h):
        p, tg, fov = V[view]; cam.location = p
        cam.rotation_euler = (Vector(tg) - Vector(p)).to_track_quat('-Z', 'Y').to_euler(); cd.angle_y = math.radians(fov)
        sc.render.resolution_x, sc.render.resolution_y = w, h; sc.render.filepath = path
        bpy.ops.render.render(write_still=True, scene=sc.name)
    def grid(cells, cols, out, w=480, h=270):
        rows = (len(cells) + cols - 1) // cols; big = np.ones((rows * h, cols * w, 4), np.float32)
        for i, (act, f, view) in enumerate(cells):
            use_action(wid + '_' + act); scene.frame_set(f); sc.frame_set(f)
            tmp = os.path.join(CACHE, '_cell%d.png' % i); shoot(view, tmp, w, h)
            im = bpy.data.images.load(tmp); a = np.array(im.pixels[:], np.float32).reshape(h, w, 4); bpy.data.images.remove(im); os.remove(tmp)
            r, c = divmod(i, cols); big[(rows - 1 - r) * h:(rows - r) * h, c * w:(c + 1) * w] = a
        im = bpy.data.images.new('wp_grid', cols * w, rows * h); im.pixels.foreach_set(big.ravel())
        im.filepath_raw = os.path.join(CACHE, out); im.file_format = 'PNG'; im.save(); bpy.data.images.remove(im)
        log('preview', out)
    acts = {a.name[len(wid) + 1:]: int(round(a.frame_range[1])) for a in bpy.data.actions if a.name.startswith(wid + '_vm_')}
    for w_ in what:
        if w_ == 'hold': grid([('vm_idle', 0, v) for v in ('game', 'aim', 'side', 'left')], 2, '%s_hold.png' % wid)
        elif w_ == 'reload' and 'vm_reload' in acts: grid([('vm_reload', round(acts['vm_reload'] * k / 5.0), 'game') for k in range(6)], 3, '%s_reload.png' % wid)
        elif w_ == 'fire': grid([('vm_fire', round(acts['vm_fire'] * k / 5.0), 'game') for k in range(6)], 3, '%s_fire.png' % wid)
        elif w_ == 'clips': grid([('vm_fire', 1, 'game'), ('vm_melee', 5, 'game'), ('vm_draw', acts['vm_draw'] // 2, 'game'), ('vm_run', 0, 'game')], 2, '%s_clips.png' % wid)
        elif w_ == 'run': grid([('vm_run', f, 'game') for f in (0, 5, 10, 15)], 4, '%s_run.png' % wid, 320, 180)
        elif w_ == 'game': grid([('vm_idle', 0, 'game')], 1, '%s_game.png' % wid, 480, 270)
        elif w_ == 'side': grid([('vm_idle', 0, v) for v in ('side', 'left', 'below', 'game')], 2, '%s_side.png' % wid)
    bpy.data.scenes.remove(sc); bpy.data.objects.remove(cam); bpy.data.cameras.remove(cd)
if 'preview' in OPT:
    for wid in todo: previews(wid, built[wid], OPT['preview'].split(','))
log('done')
