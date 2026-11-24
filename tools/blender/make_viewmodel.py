# Proof Slice first-person viewmodel: gloved arms + the carbine, rigged and animated (vm_rig, vm_arms, vm_gun, actions vm_*).
#   blender -b art/proof/shooter.blend -P tools/blender/make_viewmodel.py [-- preview=hold,fire,reload,draw,run,idle]
# The .blend is not in git: this script is the source. It is re-runnable: it deletes and rebuilds its own objects, actions,
# material and picture (art/proof/tex/vm_arms.png), touches nothing else, then saves the .blend.
# vm space = the `gun` object's local space (metres, Blender axes, barrel +Y, up +Z).
# How the arms are made: each arm is a signed distance field (palm, fingers, thumb, glove cuff, knuckle guard, sleeve, in cm,
# in an "arm" frame: wrist at 0, +Y along the hand, +Z back of the hand, right hand thumb on -X), meshed with surface nets,
# smoothed and decimated; the left arm is the mirror of the right and shares its UVs. The colour picture is computed per texel
# from the same field (panels, seams, stitching, weave, grip dots) times ambient occlusion baked in the hold pose.
# Fingers are posed by closing each joint until it touches the gun (BVH), so they wrap the grip and handguard.
import bpy, bmesh, math, os, sys, time
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

T0 = time.time()
def log(*a): print('[vm %5.1fs]' % (time.time() - T0), *a, flush=True)
ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OPT = dict((a.split('=', 1) + ['1'])[:2] for a in ARGV)
BASE = bpy.path.abspath('//')
TEX_ABS = os.path.join(BASE, 'tex', 'vm_arms.png')
CACHE = os.path.join(BASE, '_cache')
scene = bpy.context.scene
FPS = scene.render.fps / scene.render.fps_base
EYE = Vector((-0.17, -0.30, 0.155))             # game camera in vm space (looking +Y, 50 deg vertical, 16:9)
TEXN = 1024
ARM_TRIS = 4400                                # per arm

# ---------------------------------------------------------------- small math
def fr(head, ydir, zdir):
    y = Vector(ydir).normalized(); z = Vector(zdir); z = (z - z.dot(y) * y).normalized(); x = y.cross(z)
    return Matrix(((x[0], y[0], z[0], head[0]), (x[1], y[1], z[1], head[1]), (x[2], y[2], z[2], head[2]), (0, 0, 0, 1)))
def Rx(a): return Matrix.Rotation(math.radians(a), 4, 'X')
def Ry(a): return Matrix.Rotation(math.radians(a), 4, 'Y')
def Rz(a): return Matrix.Rotation(math.radians(a), 4, 'Z')
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

# ---------------------------------------------------------------- cleanup (only our own things)
def cleanup():
    s = bpy.data.scenes.get('vm_preview')
    if s: bpy.data.scenes.remove(s)
    for n in ('vm_rig', 'vm_gun', 'vm_arms', 'vm_tmp', 'vm_cam'):
        ob = bpy.data.objects.get(n)
        if ob: bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.armatures, bpy.data.cameras):
        for d in list(coll):
            if d.name.startswith('vm_') and d.users == 0: coll.remove(d)
    for a in list(bpy.data.actions):
        if a.name.startswith('vm_'): bpy.data.actions.remove(a)
    for coll, n in ((bpy.data.materials, 'vm_arms'), (bpy.data.images, 'vm_arms')):
        d = coll.get(n)
        if d: coll.remove(d)
cleanup()
col = bpy.data.collections.get('viewmodel')
if col is None:
    col = bpy.data.collections.new('viewmodel'); scene.collection.children.link(col)

# ---------------------------------------------------------------- the gun as one mesh, rigid weights
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
OPTIC = {}
def hollow_optic(bm):
    """the optic was a solid cylinder: replace it by a tube you can look through along +Y (3 mm wall, open ends)"""
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
    prof = [(0.0165, lo.y), (0.0165, lo.y + 0.006), (0.018, lo.y + 0.006), (0.018, 0.113), (hi.z - zc, 0.113), (hi.z - zc, hi.y),
            (ri, hi.y), (ri, lo.y)]
    area = sum(prof[i][0] * prof[(i + 1) % len(prof)][1] - prof[(i + 1) % len(prof)][0] * prof[i][1] for i in range(len(prof)))
    uvl = bm.loops.layers.uv['UVMap']; N = 32
    ring = [[bm.verts.new((r * math.cos(2 * math.pi * j / N), y, zc + r * math.sin(2 * math.pi * j / N))) for j in range(N)] for r, y in prof]
    for i in range(len(prof)):
        a, b = prof[i], prof[(i + 1) % len(prof)]
        dr, dy = b[0] - a[0], b[1] - a[1]; nr, ny = (dy, -dr) if area > 0 else (-dy, dr)
        for j in range(N):
            k = (j + 1) % N; th = 2 * math.pi * (j + 0.5) / N
            f = bm.faces.new((ring[i][j], ring[i][k], ring[(i + 1) % len(prof)][k], ring[(i + 1) % len(prof)][j]))
            want = Vector((nr * math.cos(th), ny, nr * math.sin(th)))
            f.normal_update()
            if f.normal.dot(want) < 0: f.normal_flip()
            for n_, l in enumerate(f.loops): l[uvl].uv = (0.025 + 0.01 * (n_ % 2), 0.69 + 0.01 * (n_ // 2))
            f.smooth = abs(nr) > 0.5; f.material_index = 0
    OPTIC.update({'center_x': 0.0, 'center_z': zc, 'inner_r': ri, 'outer_r': hi.z - zc, 'y': (round(lo.y, 4), round(hi.y, 4)), 'removed_verts': len(kill)})
    log('optic', OPTIC)
def build_gun():
    gun, mag = bpy.data.objects['gun'], bpy.data.objects['gun_mag']
    bm = bmesh.new(); bm.from_mesh(gun.data); hollow_optic(bm); n_gun = len(bm.verts)
    bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
    groups = {'gun': set(range(n_gun)), 'mag': set(), 'bolt': set(), 'trigger': set()}
    for p in loose_parts(bm):
        cs = [bm.verts[i].co for i in p]
        mn = Vector([min(c[k] for c in cs) for k in range(3)]); mx = Vector([max(c[k] for c in cs) for k in range(3)])
        c, sz = (mn + mx) / 2, mx - mn
        if (c - Vector((0, -0.066, 0.1265))).length < 0.006 and sz.x > 0.025: groups['bolt'] |= p       # AR charging handle
        if (c - Vector((0, 0.0375, 0.0375))).length < 0.006 and sz.x < 0.008: groups['trigger'] |= p     # trigger blade
    groups['gun'] -= groups['bolt'] | groups['trigger']
    tmp = mag.data.copy(); tmp.transform(gun.matrix_world.inverted() @ mag.matrix_world)
    bm.from_mesh(tmp); bpy.data.meshes.remove(tmp)
    groups['mag'] = set(range(n_gun, len(bm.verts)))
    me = bpy.data.meshes.new('vm_gun'); bm.to_mesh(me); bm.free()
    me.materials.clear(); me.materials.append(gun.data.materials[0])
    for p in me.polygons: p.material_index = 0
    ob = bpy.data.objects.new('vm_gun', me); col.objects.link(ob)
    for g, idx in groups.items():
        vg = ob.vertex_groups.new(name=g); vg.add(sorted(idx), 1.0, 'REPLACE')
    log('gun', len(me.vertices), 'verts, groups', {g: len(i) for g, i in groups.items()})
    return ob, groups
gun_ob, gun_groups = build_gun()
def bvh_of(ob, names):
    keep = set().union(*[gun_groups[n] for n in names])
    vs = [v.co.copy() for v in ob.data.vertices]
    ps = [list(p.vertices) for p in ob.data.polygons if p.vertices[0] in keep]
    return BVHTree.FromPolygons(vs, ps)
BVH_GUN = bvh_of(gun_ob, ['gun', 'mag', 'bolt', 'trigger'])
BVH_NOTRIG = bvh_of(gun_ob, ['gun', 'mag', 'bolt'])
BVH_MAG = bvh_of(gun_ob, ['mag'])
BVH_BOLT = bvh_of(gun_ob, ['bolt'])
MV = [gun_ob.data.vertices[i].co for i in gun_groups['gun']]
MUZZLE = max(MV, key=lambda v: v.y)
MAG_REST = T(0, 0.1284, 0.0783)
BOLT_REST = T(0, -0.066, 0.1265)
TRIG_REST = T(0, 0.0365, 0.0475)

# ---------------------------------------------------------------- the hand skeleton (right hand, arm frame, cm)
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
    for o in vl.objects: o.select_set(False)
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
def palm_hits(H, side, bvh, clear):
    for p in PALM_LOCAL:
        q = Vector((-p.x, p.y, p.z)) if side == 'L' else p
        if bvh.find_nearest(H @ q, clear)[0] is not None: return True
    for c in CHAINS[:4]:              # the finger roots too
        F = c['F'][0]
        for t in (0.0, 0.8):
            p = F @ Vector((0, t, 0)) * 0.01
            if side == 'L': p.x = -p.x
            if bvh.find_nearest(H @ p, c['R'][0][0] * 0.009 + clear)[0] is not None: return True
    return False
def settle(H, side, bvh, direction=None, clear=0.0015):
    """slide the hand along `direction` (default: the way its palm faces) from 4 cm off until the palm touches"""
    d = (Vector(direction) if direction is not None else -H.col[2].to_3d()).normalized()
    M = T(*(-d * 0.04)) @ H
    for i in range(80):
        N = T(*(d * 0.001)) @ M
        if palm_hits(N, side, bvh, clear): break
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
GRIP_DOWN = Vector((0, -0.213, -0.977))
def right_hold():
    """the grip runs diagonally across the palm (web of the thumb at the top, heel of the hand at the bottom), back of the hand
    facing right: so the wrist sits below and behind the grip and the forearm runs down and back"""
    ga = math.radians(float(OPT.get('rga', 10))); phi = math.radians(float(OPT.get('rphi', 25)))
    e1 = Vector((math.cos(ga), -math.sin(ga), 0)); e2 = Vector((0, 0, 1)); e3 = e1.cross(e2)
    f2 = Matrix.Rotation(phi, 3, GRIP_DOWN) @ Vector((1, 0, 0)); f1 = GRIP_DOWN.normalized(); f3 = f1.cross(f2)
    R = Matrix((f1, f2, f3)).transposed() @ Matrix((e1, e2, e3))
    M = R.to_4x4(); anchor = Vector(eval(OPT.get('ranchor', '(0.03, -0.032, -0.002)')))
    M.translation = anchor - R @ (Vector((0, 4.8, -1.8)) * 0.01)
    return settle(M, 'R', BVH_GUN, direction=(-1, 0, 0))
def left_hold():
    return settle(place((0, 5.4, -1.7), eval(OPT.get('lanchor', '(-0.002, 0.27, 0.08)')), eval(OPT.get('ly', '(0.72, 0.62, 0.30)')), eval(OPT.get('lz', '(-0.18, 0.05, -0.98)')), 'L'), 'L', BVH_GUN)
co_cm, tris, tuv = build_arm_mesh()
weights, vpart = arm_weights(co_cm)
_cv, _nrm = None, None
def _palm_points():
    a, b, c = co_cm[tris[:, 0]], co_cm[tris[:, 1]], co_cm[tris[:, 2]]; fn = np.cross(b - a, c - a)
    nrm = np.zeros_like(co_cm)
    for k in range(3): np.add.at(nrm, tris[:, k], fn)
    nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
    sel = [i for i in range(len(co_cm)) if GROUPS[vpart[i]] == 'palm' and nrm[i, 2] < -0.3 and 0.5 < co_cm[i, 1] < 9.5]
    return [Vector(co_cm[i] * 0.01) for i in sel[::2]]
PALM_LOCAL[:] = _palm_points()
log('palm points', len(PALM_LOCAL))
HR0 = right_hold(); HL0 = left_hold()
ER_DIR = Vector((0.42, -0.50, -0.76)).normalized(); EL_DIR = Vector((-0.42, -0.50, -0.76)).normalized()
ER0 = HR0.translation + ER_DIR * 0.26; EL0 = HL0.translation + EL_DIR * 0.26

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
        for ds in np.arange(-20, 46, 2.5):
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

_v = lambda v: '(%.3f %.3f %.3f)' % tuple(v)
log('fitting the hold: right wrist', _v(HR0.translation), 'index mcp', _v(HR0 @ Vector((-0.0285, 0.093, -0.0035))), 'middle mcp',
    _v(HR0 @ Vector((-0.0095, 0.0975, -0.002))), 'cmc', _v(HR0 @ Vector((-0.0185, 0.019, -0.0115))), '| left wrist', _v(HL0.translation))
FR_HOLD = grasp(HR0, 'R', BVH_GUN, skip=('index', 'thumb'))
FR_HOLD['index'] = fit_index_straight(HR0)
RTHUMB_TIP = Vector(eval(OPT.get('rthumb', '(-0.024, 0.012, 0.058)')))
FR_HOLD['thumb'] = reach(HR0, 'R', 'thumb', RTHUMB_TIP, BVH_GUN, range(-30, 61, 5), range(0, 61, 10), range(0, 61, 10), range(-60, 61, 5))
FR_TRIG = dict(FR_HOLD); FR_TRIG['index'] = fit_index_trigger(HR0)
FL_HOLD = grasp(HL0, 'L', BVH_GUN)
log('right', {k: tuple(round(x) for x in v) for k, v in FR_HOLD.items()}, 'trigger', tuple(round(x) for x in FR_TRIG['index']))
log('left', {k: tuple(round(x) for x in v) for k, v in FL_HOLD.items()})

# ---------------------------------------------------------------- the rig
BONES = []          # (name, rest matrix vm, length, parent)
for side, A in (('R', HR0), ('L', HL0)):
    mir = (lambda M: M) if side == 'R' else mirror
    BONES.append(('forearm_' + side, A @ cm2m(mir(T(0, -FORE_LEN, 0))), FORE_LEN * 0.01, None))
    BONES.append(('hand_' + side, A.copy(), 0.095, None))
    for c in CHAINS:
        for k in range(3):
            BONES.append(('%s%d_%s' % (c['name'], k + 1, side), A @ cm2m(mir(c['F'][k])), c['L'][k] * 0.01,
                          'hand_' + side if k == 0 else '%s%d_%s' % (c['name'], k, side)))
BONES += [('gun', Matrix(), 0.1, None), ('mag', MAG_REST, 0.05, None), ('bolt', BOLT_REST, 0.03, None), ('trigger', TRIG_REST, 0.02, None)]
def build_rig():
    arm = bpy.data.armatures.new('vm_rig'); rig = bpy.data.objects.new('vm_rig', arm); col.objects.link(rig)
    vl = bpy.context.view_layer
    for o in vl.objects: o.select_set(False)
    vl.objects.active = rig; rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for name, M, L, par in BONES:
        eb = arm.edit_bones.new(name); eb.head = (0, 0, 0); eb.tail = (0, L, 0); eb.matrix = M; eb.use_deform = True
    for name, M, L, par in BONES:
        if par: arm.edit_bones[name].parent = arm.edit_bones[par]; arm.edit_bones[name].use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in rig.pose.bones: pb.rotation_mode = 'QUATERNION'
    rig.animation_data_create()
    return rig
rig = build_rig()

# ---------------------------------------------------------------- the arms mesh
def build_arms():
    n = len(co_cm)
    vR = [HR0 @ Vector(p * 0.01) for p in co_cm]
    vL = [HL0 @ Vector((-p[0] * 0.01, p[1] * 0.01, p[2] * 0.01)) for p in co_cm]
    faces = [tuple(t) for t in tris] + [(t[0] + n, t[2] + n, t[1] + n) for t in tris]
    me = bpy.data.meshes.new('vm_arms'); me.from_pydata([tuple(v) for v in vR + vL], [], faces)
    uvl = me.uv_layers.new(name='UVMap')
    uvR = tuv.reshape(-1, 2); uvLt = tuv[:, [0, 2, 1], :].reshape(-1, 2)
    uvl.data.foreach_set('uv', np.concatenate([uvR, uvLt]).ravel())
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    me.update()
    ob = bpy.data.objects.new('vm_arms', me); col.objects.link(ob)
    vgs = {}
    for i, ws in enumerate(weights):
        for side, off in (('R', 0), ('L', n)):
            for b, w in ws:
                if w <= 0.002: continue
                nm = b + '_' + side
                if nm not in vgs: vgs[nm] = ob.vertex_groups.new(name=nm)
                vgs[nm].add([i + off], w, 'REPLACE')
    return ob
arms_ob = build_arms()
for ob in (arms_ob, gun_ob):
    ob.parent = rig
    md = ob.modifiers.new('rig', 'ARMATURE'); md.object = rig
log('arms', len(arms_ob.data.vertices), 'verts', len(arms_ob.data.polygons), 'tris')

# ---------------------------------------------------------------- posing
REST = {name: M for name, M, L, par in BONES}
def forearm_matrix(H, E, side):
    F0 = H @ cm2m(T(0, -FORE_LEN, 0) if side == 'R' else mirror(T(0, -FORE_LEN, 0)))
    W = H.translation; d = (W - E).normalized()
    y0 = F0.col[1].to_3d().normalized()
    q = y0.rotation_difference(d)
    R = q.to_matrix() @ F0.to_3x3()
    M = R.to_4x4(); M.translation = W - d * FORE_LEN * 0.01; return M
def apply_pose(P):
    pbs = rig.pose.bones
    def root(name, M): pbs[name].matrix_basis = REST[name].inverted() @ M
    G = P['G']; root('gun', G)
    root('mag', P.get('mag') or G @ MAG_REST)
    root('bolt', G @ T(0, -P.get('bolt', 0.0), 0) @ BOLT_REST)
    root('trigger', G @ TRIG_REST @ Rx(P.get('trig', 0.0)))
    for side in 'RL':
        H, E = P['H' + side], P['E' + side]
        root('hand_' + side, H); root('forearm_' + side, forearm_matrix(H, E, side))
        sg = 1 if side == 'R' else -1
        for name, ang in P['f' + side].items():
            c = CH[name]; ds = ang[3] if len(ang) > 3 else 0.0
            pbs['%s1_%s' % (name, side)].matrix_basis = Rz(sg * ds) @ Rx(-(ang[0] - c['rest'][0]))
            pbs['%s2_%s' % (name, side)].matrix_basis = Rx(-(ang[1] - c['rest'][1]))
            pbs['%s3_%s' % (name, side)].matrix_basis = Rx(-(ang[2] - c['rest'][2]))
def fmix(A, B, t):
    return {n: tuple(lerp(a, b, t) for a, b in zip(A[n] + (0,) * (4 - len(A[n])), B[n] + (0,) * (4 - len(B[n])))) for n in A}
def fadd(A, d):
    return {n: tuple(v + (d.get(n, (0, 0, 0, 0))[i] if i < 4 else 0) for i, v in enumerate(a + (0,) * (4 - len(a)))) for n, a in A.items()}
OPEN = {n: (4, 6, 4, 0) for n in FINGERS}; OPEN['thumb'] = (-8, 4, 6, 0)
def hold_pose(G=None):
    G = G or Matrix()
    return {'G': G, 'HR': G @ HR0, 'HL': G @ HL0, 'ER': ER0.copy(), 'EL': EL0.copy(), 'fR': dict(FR_HOLD), 'fL': dict(FL_HOLD)}

# ---------------------------------------------------------------- clips
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
    return settle(place((0, 5.6, -1.75), (-0.02, 0.124, -0.02), (0.08, 0.80, 0.60), (-0.98, 0.12, 0.0), 'L'), 'L', BVH_MAG)
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
        (0.86, T(-0.10, -0.06, -0.38) @ LM @ Rx(25), FL_MAG), (1.02, T(-0.08, -0.04, -0.40) @ LM @ Rx(15), FL_MAG),
        (1.26, down(-0.075), FL_MAG), (1.38, down(-0.014), FL_MAG), (MAG_CLICK, T(0, 0, 0.003) @ LM, FL_MAG),
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
    M = Rz(5 * tilt + 4 * ch) @ Rx(7 * tilt + 3 * ch) @ Ry(24 * tilt + 10 * ch)
    G = T(-0.012 * tilt - 0.02 * ch, -0.01 * ch, 0.018 * tilt + 0.01 * ch) @ about(GRIP_PIVOT, M)
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
            pb.keyframe_insert('location', frame=f, group=pb.name)
            pb.keyframe_insert('rotation_quaternion', frame=f, group=pb.name)
    log('clip', name, '%.3f s' % (n / FPS), n + 1, 'keys')
for name, D, fn, loop in CLIPS: bake(name, D, fn)
use_action('vm_idle')
scene.frame_set(0)

# ---------------------------------------------------------------- the colour picture
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
def raster(tuv, attrs):
    N = TEXN; img = [np.zeros((N, N, a.shape[2]), np.float32) for a in attrs]; mask = np.zeros((N, N), bool)
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
    im = bpy.data.images.new('vm_arms', TEXN, TEXN, alpha=False)
    px4 = np.concatenate([img, np.ones((TEXN, TEXN, 1), np.float32)], 2)
    im.pixels.foreach_set(px4.ravel())
    im.filepath_raw = TEX_ABS; im.file_format = 'PNG'; im.save()
    bpy.data.images.remove(im)
    im = bpy.data.images.load(TEX_ABS); im.name = 'vm_arms'; im.filepath = '//tex/vm_arms.png'
    log('texture', TEX_ABS, int(mask.sum()), 'texels')
    return im
img = build_texture()
mat = bpy.data.materials.new('vm_arms'); mat.use_nodes = True
nt = mat.node_tree; bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = img; tx.location = (-400, 300)
nt.links.new(tx.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.85; bsdf.inputs['Metallic'].default_value = 0.0
nt.nodes.active = tx
arms_ob.data.materials.append(mat)

use_action('vm_idle'); scene.frame_set(0)
log('muzzle tip', tuple(round(x, 4) for x in MUZZLE), 'eye', tuple(EYE))
if 'nosave' not in OPT:
    bpy.ops.wm.save_mainfile()
    log('saved', bpy.data.filepath)

# ---------------------------------------------------------------- previews (after the save; never saved)
def previews(what):
    os.makedirs(CACHE, exist_ok=True)
    sc = bpy.data.scenes.new('vm_preview')
    for o in (rig, arms_ob, gun_ob): sc.collection.objects.link(o)
    sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'TEXTURE'; sh.show_cavity = False
    sc.render.film_transparent = False
    sc.render.fps = scene.render.fps
    cd = bpy.data.cameras.new('vm_cam'); cam = bpy.data.objects.new('vm_cam', cd); sc.collection.objects.link(cam); sc.camera = cam
    cd.sensor_fit = 'VERTICAL'; cd.clip_start = 0.01
    eye = Vector(eval(OPT['eye'])) if 'eye' in OPT else EYE
    VIEWS = {'game': (eye, eye + Vector((0, 1, 0)), 50), 'side': ((0.55, 0.05, 0.06), (0, 0.05, 0.06), 40),
             'left': ((-0.45, 0.2, 0.0), (0, 0.27, 0.07), 40), 'below': ((0.30, -0.25, -0.20), (0, 0.1, 0.05), 40),
             'rside': ((0.22, 0.12, -0.02), (0.01, 0.0, 0.02), 40), 'rleft': ((-0.22, 0.10, 0.08), (0.0, -0.01, 0.03), 40),
             'lbelow': ((-0.20, 0.34, -0.06), (0.0, 0.26, 0.09), 40), 'lright': ((0.22, 0.36, 0.14), (0.0, 0.26, 0.10), 40)}
    for i, e in enumerate(eval(OPT.get('eyelist', '((-0.189, -0.478, 0.294), (-0.15, -0.40, 0.20), (-0.13, -0.32, 0.19), (-0.12, -0.26, 0.185))'))):
        VIEWS['e%d' % i] = (Vector(e), Vector(e) + Vector((0, 1, 0)), 50)
    def shoot(view, path, w, h):
        p, tg, fov = VIEWS[view]; cam.location = p
        cam.rotation_euler = (Vector(tg) - Vector(p)).to_track_quat('-Z', 'Y').to_euler(); cd.angle_y = math.radians(fov)
        sc.render.resolution_x, sc.render.resolution_y = w, h; sc.render.filepath = path
        bpy.ops.render.render(write_still=True, scene=sc.name)
    def grid(cells, cols, out, w=480, h=270):
        rows = (len(cells) + cols - 1) // cols; big = np.ones((rows * h, cols * w, 4), np.float32)
        for i, (act, f, view) in enumerate(cells):
            use_action(act); scene.frame_set(f); sc.frame_set(f)
            tmp = os.path.join(CACHE, '_cell%d.png' % i); shoot(view, tmp, w, h)
            im = bpy.data.images.load(tmp); a = np.array(im.pixels[:], np.float32).reshape(h, w, 4); bpy.data.images.remove(im); os.remove(tmp)
            r, c = divmod(i, cols); big[(rows - 1 - r) * h:(rows - r) * h, c * w:(c + 1) * w] = a
        im = bpy.data.images.new('vm_grid', cols * w, rows * h); im.pixels.foreach_set(big.ravel())
        im.filepath_raw = os.path.join(CACHE, out); im.file_format = 'PNG'; im.save(); bpy.data.images.remove(im)
        log('preview', out)
    n = lambda a: int(round(dict((c[0], c[1]) for c in CLIPS)[a] * FPS))
    for w_ in what:
        if w_ == 'hold': grid([('vm_idle', 0, v) for v in ('game', 'side', 'left', 'below')], 2, 'vm_hold.png')
        elif w_ == 'check': grid([('vm_idle', 0, v) for v in ('game', 'rside', 'rleft', 'lright')], 2, 'vm_check.png')
        elif w_ == 'eyes': grid([('vm_idle', 0, 'e%d' % i) for i in range(4)], 2, 'vm_eyes.png')
        elif w_ == 'clips': grid([('vm_fire', 1, 'game'), ('vm_draw', 5, 'game'), ('vm_run', 0, 'game'), ('vm_run', 10, 'game')], 2, 'vm_clips.png')
        elif w_ == 'hands': grid([('vm_idle', 0, v) for v in ('rside', 'rleft', 'lbelow', 'lright')], 2, 'vm_hands.png')
        elif w_ == 'game': grid([('vm_idle', 0, 'game')], 1, 'vm_game.png', 960, 540)
        elif w_ == 'reload': grid([('vm_reload', round(n('vm_reload') * k / 5.0), 'game') for k in range(6)], 3, 'vm_reload.png')
        elif w_ == 'reloadside': grid([('vm_reload', round(n('vm_reload') * k / 5.0), 'left') for k in range(6)], 3, 'vm_reload_side.png')
        elif w_ in ('fire', 'draw', 'run', 'idle'):
            a = 'vm_' + w_; N = n(a); fs = [0, 1, 2, 3] if w_ == 'fire' else [round(N * k / 3.0) for k in range(4)]
            grid([(a, f, 'game') for f in fs], 2, 'vm_%s.png' % w_)
        elif w_ in VIEWS: grid([('vm_idle', 0, w_)], 1, 'vm_%s.png' % w_, 960, 540)
    bpy.data.scenes.remove(sc); bpy.data.objects.remove(cam); bpy.data.cameras.remove(cd)
if 'preview' in OPT: previews(OPT['preview'].split(','))
log('done')
