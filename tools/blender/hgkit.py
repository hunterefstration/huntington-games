# Shared helpers for the art scripts (make_figures.py, make_street.py): matrices and easing, signed distance primitives,
# surface nets, the box/prism/lathe/sweep modelling kit, rasterising per-texel attributes, value noise, picture saving.
# Pure functions over numpy / mathutils / bpy; no side effects on import.
import bpy, bmesh, math, os, time
import numpy as np
from mathutils import Vector, Matrix
_T0 = time.time()
def log(*a): print("[art %5.1fs]" % (time.time() - _T0), *a, flush=True)
CLS = ['steel', 'alloy', 'polymer', 'tan', 'wood', 'bright', 'rubber', 'brass', 'olive', 'white', 'dark', 'red']
BASEC = {'steel': (0.17, 0.175, 0.18), 'alloy': (0.125, 0.125, 0.13), 'polymer': (0.105, 0.105, 0.105), 'tan': (0.45, 0.38, 0.28),
         'wood': (0.36, 0.20, 0.10), 'bright': (0.50, 0.50, 0.51), 'rubber': (0.07, 0.07, 0.07), 'brass': (0.62, 0.46, 0.20),
         'olive': (0.27, 0.30, 0.19), 'white': (0.80, 0.80, 0.78), 'dark': (0.055, 0.055, 0.06), 'red': (0.45, 0.08, 0.06)}
WEAR = {'steel': (0.55, 0.55, 0.56), 'alloy': (0.48, 0.48, 0.5), 'polymer': (0.2, 0.2, 0.2), 'tan': (0.58, 0.51, 0.40), 'wood': (0.5, 0.33, 0.18),
        'olive': (0.45, 0.45, 0.38)}
GRP = ['gun', 'mag', 'bolt', 'trigger', 'pump', 'spin']
def fr(head, ydir, zdir):
    y = Vector(ydir).normalized(); z = Vector(zdir); z = (z - z.dot(y) * y).normalized(); x = y.cross(z)
    return Matrix(((x[0], y[0], z[0], head[0]), (x[1], y[1], z[1], head[1]), (x[2], y[2], z[2], head[2]), (0, 0, 0, 1)))
def Rx(a): return Matrix.Rotation(math.radians(a), 4, 'X')
def Ry(a): return Matrix.Rotation(math.radians(a), 4, 'Y')
def Rz(a): return Matrix.Rotation(math.radians(a), 4, 'Z')
def Rax(a, axis, pivot=(0, 0, 0)): return T(*pivot) @ Matrix.Rotation(math.radians(a), 4, Vector(axis)) @ T(*(-Vector(pivot)))
def T(x, y, z): return Matrix.Translation((x, y, z))
def smooth(a, b, x):
    t = min(max((x - a) / (b - a), 0.0), 1.0); return t * t * (3 - 2 * t)
def ease(t): t = min(max(t, 0.0), 1.0); return t * t * t * (t * (t * 6 - 15) + 10)
def lerp(a, b, t): return a + (b - a) * t
def mlerp(A, B, t):
    la, ra, _ = A.decompose(); lb, rb, _ = B.decompose()
    if ra.dot(rb) < 0: rb = -rb
    M = ra.slerp(rb, t).to_matrix().to_4x4(); M.translation = la.lerp(lb, t); return M
def bump(t, c, w): return math.exp(-((t - c) / w) ** 2)
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
# ---------------------------------------------------------------- tiling ground detail (sharp at eye height: the ground is seen at a grazing angle)
def ptile(N, cells, seed, oct=3):
    """periodic value noise, N x N, wraps at the edges"""
    out = np.zeros((N, N), np.float32); amp, tot = 1.0, 0.0
    for o in range(oct):
        c = max(2, int(cells * 2 ** o)); g = np.random.default_rng(seed + o).random((c, c)).astype(np.float32)
        u = np.arange(N, dtype=np.float32) * c / N; i0 = np.floor(u).astype(int); f = u - i0; f = f * f * (3 - 2 * f); i1 = (i0 + 1) % c
        a = g[i0][:, i0] * (1 - f)[None, :] + g[i0][:, i1] * f[None, :]; b = g[i1][:, i0] * (1 - f)[None, :] + g[i1][:, i1] * f[None, :]
        out += amp * (a * (1 - f)[:, None] + b * f[:, None]); tot += amp; amp *= 0.5
    return out / tot
def _stamp(img, cx, cy, r, col, N, rng):
    """one pebble: a lit top, a dark rim, a contact shadow; wraps at the edges"""
    R = int(r) + 2; yy, xx = np.mgrid[-R:R + 1, -R:R + 1].astype(np.float32); ex = rng.uniform(0.6, 1.0); rot = rng.uniform(0, math.pi)
    xr = xx * math.cos(rot) + yy * math.sin(rot); yr = (-xx * math.sin(rot) + yy * math.cos(rot)) / ex; d = np.sqrt(xr ** 2 + yr ** 2) / r
    ys = (np.arange(-R, R + 1) + int(cy)) % N; xs = (np.arange(-R, R + 1) + int(cx)) % N; sub = img[np.ix_(ys, xs)]
    sh = (np.sqrt((xx - 0.35 * r) ** 2 + (yy + 0.35 * r) ** 2) / r < 1.15) & (d >= 1); sub[sh] *= 0.6
    inside = d < 1; light = np.clip(1.15 - 0.5 * d - 0.25 * (xx - yy) / (r + 1e-3), 0.45, 1.3)
    sub[inside] = np.array(col, np.float32) * light[inside][:, None]
    img[np.ix_(ys, xs)] = sub
def gravel_px(N=1024, seed=5, base=(0.36, 0.33, 0.29)):
    """ash-grey dirt and gravel: mottled ground, many small pebbles, a few bigger stones, hairline cracks, grain"""
    rng = np.random.default_rng(seed); n1 = ptile(N, 6, seed); n2 = ptile(N, 40, seed + 10, 2)
    img = np.array(base, np.float32) * (0.75 + 0.45 * n1[..., None]) * (0.85 + 0.3 * n2[..., None])
    for k in range(int(N * N / 260)):
        r = rng.choice([1.6, 2.2, 3.0, 4.5, 7.0], p=[0.42, 0.3, 0.17, 0.08, 0.03]); g = rng.uniform(0.55, 1.25)
        col = np.clip(np.array(base, np.float32) * g * rng.uniform(0.9, 1.1, 3), 0.05, 0.9); _stamp(img, rng.uniform(0, N), rng.uniform(0, N), r, col, N, rng)
    crack = np.abs(ptile(N, 5, seed + 20, 4) - 0.5) < 0.006; img[crack] *= 0.55
    img *= (0.9 + 0.2 * rng.random((N, N, 1)).astype(np.float32))
    return np.clip(img, 0.03, 1)
def grit(a, seed=1, amount=1.0):
    """sharpen a worn hard surface (concrete, asphalt): aggregate specks, pits, hairline cracks"""
    N = a.shape[0]; rng = np.random.default_rng(seed); a = a.copy()
    r = rng.random((N, N)); a[r < 0.035 * amount] *= 0.62; a[r > 1 - 0.03 * amount] *= 1.25
    for k in range(int(N * N / 1800 * amount)):
        x, y = rng.integers(0, N, 2); s = rng.integers(1, 3); a[y:y + s, x:x + s] *= 0.45
    crack = np.abs(ptile(N, 4, seed + 7, 4) - 0.5) < 0.004; a[crack] *= 0.6
    return np.clip(a * (0.93 + 0.14 * rng.random((N, N, 1)).astype(np.float32)), 0.03, 1)
def save_image(img, name, texdir):
    N = img.shape[0]; path = os.path.join(texdir, name + '.png')
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
