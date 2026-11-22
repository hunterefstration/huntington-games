# Set-piece kit for the ASHFALL map scripts that share the make_yard.py template (make_outpost/mall/carnival/lab.py).
#   from mapkit import install; install(globals())        (after box, cyl, quad, bm, MI, GROUND_FACES are defined)
# Everything is built so no two faces that face the same way share a plane: bands and rims stand 2 cm proud, boards sit on (not in)
# what carries them, decals lie 2 cm and more above the floor at staggered heights. Check with coplanar.py.
# z is the height of the bottom; things on the ground start at 0 (the scripts lift loose bottoms to 6 mm).
import math, random, bmesh
from mathutils import Vector, Matrix

def install(g):
    def bm(): return g['bm']
    def MI(): return g['MI']
    def box(*a, **k): return g['box'](*a, **k)
    def cyl(*a, **k): return g['cyl'](*a, **k)
    def T(x, y, z): return Matrix.Translation((x, y, z))
    def Rz(a): return Matrix.Rotation(a, 4, 'Z')
    def P(cx, cy, rz, dx, dy): return (cx + dx * math.cos(rz) - dy * math.sin(rz), cy + dx * math.sin(rz) + dy * math.cos(rz))
    def _mat(faces, mat):
        for f in faces: f.material_index = MI()[mat]
        return faces
    def DARK(): return 'grime' if 'grime' in MI() else 'metal'
    def PAINT(): return 'paint' if 'paint' in MI() else 'plaster'
    def grime_pic(N=1024):
        """dark oily grime: for drains, cables, tyres, stains"""
        import numpy as np
        n1 = g['tile_noise'](N, 90, 61); n2 = g['tile_noise'](N, 9, 63)
        a = np.array((0.15, 0.14, 0.13), np.float32) * (0.7 + 0.6 * n1[..., None]) * (0.85 + 0.3 * n2[..., None])
        return np.clip(a, 0.02, 1)
    def paint_pic(N=1024):
        """worn road paint: pale yellow-white, chipped to grey"""
        import numpy as np
        n1 = g['tile_noise'](N, 40, 71); n2 = g['tile_noise'](N, 5, 73)
        a = np.array((0.62, 0.56, 0.38), np.float32) * (0.85 + 0.2 * n1[..., None]); chip = (n2 * 0.6 + n1 * 0.4 > 0.62)[..., None]
        a = np.where(chip, np.array((0.30, 0.29, 0.27), np.float32) * (0.8 + 0.4 * n2[..., None]), a)
        return g['dust'](np.clip(a, 0.04, 1), 0.3, 75)
    def B(cx, cy, rz, dx, dy, z, s, mat, r=0.0, bevel=0.0):
        x, y = P(cx, cy, rz, dx, dy); return box((x, y, z), s, mat, rz + r, bevel)

    # ------------------------------------------------------------ floors: the ground cut round its patches (no patch lies on the ground)
    def floor(rects, base, x0, y0, x1, y1):
        """rects [(x0, y0, x1, y1, mat)], later ones win; the ground is split along every patch edge into one connected sheet at z = 0"""
        xs = sorted({x0, x1} | {min(max(v, x0), x1) for r in rects for v in (r[0], r[2])})
        ys = sorted({y0, y1} | {min(max(v, y0), y1) for r in rects for v in (r[1], r[3])})
        V = {}
        def vert(x, y):
            k = (round(x, 4), round(y, 4))
            if k not in V: V[k] = bm().verts.new((x, y, 0.0))
            return V[k]
        for j in range(len(ys) - 1):
            for i in range(len(xs) - 1):
                cx, cy = (xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2; m = base
                for r in rects:
                    if r[0] <= cx <= r[2] and r[1] <= cy <= r[3]: m = r[4]
                f = bm().faces.new((vert(xs[i], ys[j]), vert(xs[i + 1], ys[j]), vert(xs[i + 1], ys[j + 1]), vert(xs[i], ys[j + 1])))
                f.material_index = MI()[m]; g['GROUND_FACES'].add(f)
    DZ = [0]
    def _dz():
        DZ[0] = (DZ[0] + 1) % 3; return 0.056 + 0.012 * DZ[0]
    def blob(cx, cy, r, mat, n=10, jit=0.35, ry=None, z=None):
        """an irregular flat patch (oil, ash, a puddle) a couple of centimetres up"""
        z = _dz() if z is None else z; ry = ry or r; vs = []
        a0 = random.uniform(0, 6.28)
        for k in range(n):
            a = a0 + 2 * math.pi * k / n; s = 1 + random.uniform(-jit, jit) * 0.8
            vs.append(bm().verts.new((cx + r * s * math.cos(a), cy + ry * s * math.sin(a), z)))
        f = bm().faces.new(vs); f.material_index = MI()[mat]; return f
    def strip(x0, y0, x1, y1, w, mat, z=None):
        """a painted line or a flat strip from (x0, y0) to (x1, y1)"""
        z = 0.02 if z is None else z; L = math.hypot(x1 - x0, y1 - y0); nx_, ny_ = -(y1 - y0) / L * w / 2, (x1 - x0) / L * w / 2
        f = bm().faces.new([bm().verts.new(p) for p in ((x0 + nx_, y0 + ny_, z), (x0 - nx_, y0 - ny_, z), (x1 - nx_, y1 - ny_, z), (x1 + nx_, y1 + ny_, z))])
        f.normal_update()
        if f.normal.z < 0: f.normal_flip()
        f.material_index = MI()[mat]; return f
    def dashes(x0, y0, x1, y1, w, mat, on=3.0, off=3.0, z=None):
        L = math.hypot(x1 - x0, y1 - y0); t = 0.0
        while t < L:
            a, b = t / L, min(t + on, L) / L; strip(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a, x0 + (x1 - x0) * b, y0 + (y1 - y0) * b, w, mat, z); t += on + off

    # ------------------------------------------------------------ round things
    def tube(p0, p1, r, mat, seg=8):
        p0, p1 = Vector(p0), Vector(p1); d = p1 - p0; L = d.length
        if L < 1e-4: return []
        q = d.normalized().to_track_quat('Z', 'Y'); before = set(bm().faces)
        bmesh.ops.create_cone(bm(), cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r, depth=L, matrix=T(*((p0 + p1) / 2)) @ q.to_matrix().to_4x4())
        return _mat([f for f in bm().faces if f not in before], mat)
    def cone(c, r1, r2, h, mat, seg=12):
        before = set(bm().faces)
        bmesh.ops.create_cone(bm(), cap_ends=True, cap_tris=False, segments=seg, radius1=r1, radius2=r2, depth=h, matrix=T(c[0], c[1], c[2] + h / 2))
        return _mat([f for f in bm().faces if f not in before], mat)
    def pipe_run(pts, r, mat='metal', seg=8, joints=True):
        """a pipe along a polyline, a collar box at each bend (the pipe ends inside it)"""
        pts = [Vector(p) for p in pts]
        for a, b in zip(pts, pts[1:]): tube(a, b, r, mat, seg)
        if joints:
            for p in pts[1:-1]: box((p.x, p.y, p.z - r * 1.35), (r * 2.7, r * 2.7, r * 2.7), mat)
    def beam(p0, p1, th, mat):
        p0, p1 = Vector(p0), Vector(p1); d = p1 - p0; L = d.length
        if L < 1e-4: return
        q = d.normalized().to_track_quat('Y', 'Z'); before = set(bm().faces)
        bmesh.ops.create_cube(bm(), size=1.0, matrix=T(*((p0 + p1) / 2)) @ q.to_matrix().to_4x4() @ Matrix.Diagonal((th, L, th, 1)))
        _mat([f for f in bm().faces if f not in before], mat)
    def prism(cx, cy, rz, prof, L, mat, z=0.0):
        """a side profile [(dy, dz)] (convex, counter-clockwise) extruded along the local x axis, length L, centred on (cx, cy)"""
        M = T(cx, cy, z) @ Rz(rz); before = set(bm().faces)
        v0 = [bm().verts.new(M @ Vector((-L / 2, y, zz))) for y, zz in prof]; v1 = [bm().verts.new(M @ Vector((L / 2, y, zz))) for y, zz in prof]
        n = len(prof); bm().faces.new(v0); bm().faces.new(v1[::-1])
        for i in range(n): j = (i + 1) % n; bm().faces.new((v0[i], v0[j], v1[j], v1[i]))
        new = [f for f in bm().faces if f not in before]; bmesh.ops.recalc_face_normals(bm(), faces=new)
        return _mat(new, mat)

    # ------------------------------------------------------------ props
    def crate(x, y, s=1.0, rz=0.0, mat='wood', band='rust', h=None):
        h = h or s
        box((x, y, 0), (s, s, h), mat, rz)
        box((x, y, 0.05), (s + 0.04, s + 0.04, 0.08), band, rz); box((x, y, h - 0.13), (s + 0.04, s + 0.04, 0.08), band, rz)
    def crate_stack(x, y, rz=0.0, n=3, s=1.0, mat='wood'):
        """a 2 x 2 block, n crates high at one corner going down to 1: cover you cannot see over, with a step"""
        for k, (dx, dy) in enumerate(((0, 0), (1, 0), (0, 1), (1, 1))):
            hh = max(1, n - k)
            for lv in range(hh):
                px, py = P(x, y, rz, dx * (s + 0.06), dy * (s + 0.06))
                box((px, py, lv * s), (s, s, s - 0.004), mat, rz + random.uniform(-0.04, 0.04))
            px, py = P(x, y, rz, dx * (s + 0.06), dy * (s + 0.06)); box((px, py, hh * s - 0.12), (s + 0.04, s + 0.04, 0.07), 'rust', rz)
    def barrel(x, y, mat='rust', r=0.3, h=0.9, rim='metal'):
        cyl((x, y, 0), r, h, mat, 10)
        for z in (0.18, h - 0.24): cyl((x, y, z), r + 0.02, 0.05, rim, 10)
    def barrels(x, y, n=4, mat='rust'):
        for k in range(n):
            a = k * 2.4; barrel(x + 0.68 * (k % 2) + random.uniform(-0.04, 0.04), y + 0.68 * (k // 2) + random.uniform(-0.04, 0.04), random.choice((mat, 'metal')) if k % 3 == 2 else mat)
    def pallet(x, y, rz=0.0, load=None):
        """0.14 m: walkable; load: 'sacks' / 'boxes' / None"""
        for d in (-0.5, 0.0, 0.5): B(x, y, rz, 0, d, 0, (1.2, 0.1, 0.1), 'wood')
        for k in range(5): B(x, y, rz, -0.5 + k * 0.25, 0, 0.1, (0.18, 1.1, 0.025), 'wood')
        if load == 'sacks':
            for k in range(4): B(x, y, rz, -0.3 + 0.6 * (k % 2), -0.28 + 0.56 * (k // 2), 0.125, (0.56, 0.52, 0.22), 'sandbag', 0, 0.05)
            B(x, y, rz, 0, 0, 0.36, (0.56, 0.9, 0.22), 'sandbag', 0.3, 0.05)
        elif load == 'boxes':
            for k in range(4): B(x, y, rz, -0.3 + 0.6 * (k % 2), -0.27 + 0.54 * (k // 2), 0.125, (0.56, 0.52, 0.5 + 0.06 * (k % 3)), 'plaster')
    def sandbags(x0, y0, x1, y1, rows=4, mat='sandbag', deep=1):
        """a wall of bags: rows of 0.25 m, staggered; 4 rows = 1.0 m (cover you can see and shoot over)"""
        L = math.hypot(x1 - x0, y1 - y0); rz = math.atan2(y1 - y0, x1 - x0); n = max(1, int(round(L / 0.62)))
        bl = L / n
        for r in range(rows):
            off = (bl / 2) * (r % 2); k = 0
            for dpos in range(deep):
                t = -L / 2 + off
                while t < L / 2 - 0.05:
                    a, b = t, min(t + bl, L / 2)
                    if b - a > 0.2:
                        cx, cy = P((x0 + x1) / 2, (y0 + y1) / 2, rz, (a + b) / 2, (dpos - (deep - 1) / 2) * 0.46)
                        box((cx, cy, r * 0.25), (b - a - 0.02, 0.44, 0.24), mat, rz + random.uniform(-0.03, 0.03), 0.045)
                    t += bl
    def jersey(x, y, rz=0.0, L=3.0, mat='concrete'):
        prism(x, y, rz, [(-0.3, 0.0), (0.3, 0.0), (0.3, 0.08), (0.12, 0.3), (0.09, 0.82), (-0.09, 0.82), (-0.12, 0.3), (-0.3, 0.08)], L, mat)
    def kerb(x0, y0, x1, y1, w=0.3, h=0.15, mat='concrete'):
        L = math.hypot(x1 - x0, y1 - y0); rz = math.atan2(y1 - y0, x1 - x0); box(((x0 + x1) / 2, (y0 + y1) / 2, 0), (L, w, h), mat, rz)
    def drain(x, y, rz=0.0, w=0.7, d=0.45):
        B(x, y, rz, 0, 0, 0, (w, d, 0.018), DARK())
        for k in range(6): B(x, y, rz, -w / 2 + 0.07 + k * (w - 0.14) / 5, 0, 0.018, (0.035, d - 0.04, 0.025), 'metal')
    def cable(pts, r=0.025, mat='grime'):
        m = mat if mat in MI() else DARK()
        for a, b in zip(pts, pts[1:]): tube((a[0], a[1], r + 0.008), (b[0], b[1], r + 0.008), r, m, 6)
    def litter(cx, cy, r=1.2, n=8, mats=('plaster', 'metal', 'wood')):
        """low rubbish: flattened boxes, cans, planks (under 0.3 m, walkable)"""
        for k in range(n):
            a = random.uniform(0, 6.28); d = random.uniform(0.1, r); x, y = cx + d * math.cos(a), cy + d * math.sin(a); m = random.choice(mats)
            kind = random.random(); hk = 0.095 + 0.013 * k           # every piece its own height: no two tops share a plane
            if kind < 0.4: box((x, y, 0), (random.uniform(0.3, 0.7), random.uniform(0.2, 0.5), hk), m, random.uniform(0, 3.14))
            elif kind < 0.7: cyl((x, y, 0), 0.04, hk, 'metal', 6)
            else: box((x, y, 0), (random.uniform(0.6, 1.4), 0.1, hk), 'wood', random.uniform(0, 3.14))
    def tyres(x, y, n=3):
        for k in range(n): cyl((x, y, k * 0.26), 0.38 - 0.004 * k, 0.25, DARK(), 12)
    def sign(x, y, z, w, h, rz, mat, frame='metal', posts=False):
        """a board facing local -y (rz turns it), 3 cm off what it is fixed to; posts: two legs down to the ground"""
        B(x, y, rz, 0, 0.015, z - 0.05, (w + 0.1, 0.03, h + 0.1), frame)
        B(x, y, rz, 0, -0.025, z, (w, 0.05, h), mat)
        if posts:
            for s in (-1, 1): B(x, y, rz, s * (w / 2 - 0.1), 0.06, 0, (0.08, 0.06, z + h), frame)
    def cable_tray(p0, p1, z, w=0.45, mat='metal', hang=None, cables=True):
        """a U tray along p0 -> p1 at height z; hang: ceiling height for the hangers (every 2.5 m)"""
        L = math.hypot(p1[0] - p0[0], p1[1] - p0[1]); rz = math.atan2(p1[1] - p0[1], p1[0] - p0[0]); cx, cy = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
        B(cx, cy, rz, 0, 0, z, (L, w - 0.04, 0.02), mat)
        for s in (-1, 1): B(cx, cy, rz, 0, s * (w / 2 - 0.01), z - 0.01, (L + 0.02, 0.02, 0.11), mat)
        if cables:
            for k, (dy, rr) in enumerate(((-0.1, 0.03), (0.0, 0.035), (0.11, 0.025))):
                a = P(cx, cy, rz, -L / 2 + 0.05, dy); b = P(cx, cy, rz, L / 2 - 0.05, dy); tube((a[0], a[1], z + 0.02 + rr + 0.004), (b[0], b[1], z + 0.02 + rr + 0.004), rr, DARK(), 6)
        if hang:
            n = max(1, int(L / 2.5))
            for k in range(n + 1):
                for s in (-1, 1):
                    hx, hy = P(cx, cy, rz, -L / 2 + 0.2 + k * (L - 0.4) / n, s * (w / 2 + 0.03)); box((hx, hy, z - 0.05), (0.03, 0.03, hang - z + 0.05 - 0.005), mat)
                hx, hy = P(cx, cy, rz, -L / 2 + 0.2 + k * (L - 0.4) / n, 0); box((hx, hy, z - 0.06), (0.04, w + 0.1, 0.04), mat, rz)
    def awning(x, y, z, w, d, rz, mat='canvas', drop=0.35):
        """a sloping cloth roof on two front posts, fixed to a wall behind (local +y)"""
        x0, y0 = P(x, y, rz, 0, 0)
        ang = math.atan2(drop, d); before = set(bm().faces)
        cx, cy = P(x, y, rz, 0, -d / 2)
        bmesh.ops.create_cube(bm(), size=1.0, matrix=T(cx, cy, z - drop / 2) @ Rz(rz) @ Matrix.Rotation(-ang, 4, 'X') @ Matrix.Diagonal((w, math.hypot(d, drop), 0.04, 1)))
        _mat([f for f in bm().faces if f not in before], mat)
        B(x, y, rz, 0, -d + 0.04, z - drop - 0.32, (w, 0.03, 0.3), mat)            # the valance
    def lamp_cone(x, y, z, mat_shade='metal', mat_lit='emissive_lamp', r=0.32, cable_to=None):
        """a conical shade hanging at z with a lit disc under it; cable_to: ceiling height"""
        cone((x, y, z), r, 0.08, 0.26, mat_shade, 12); cyl((x, y, z - 0.03), r * 0.72, 0.025, mat_lit, 12)
        if cable_to: box((x, y, z + 0.26), (0.02, 0.02, cable_to - z - 0.26 - 0.005), 'metal')
    def czech(x, y, rz=0.0, s=1.4, mat='rust'):
        """a tank trap: three crossed beams, about 1.1 m: blocks feet, not eyes"""
        for ax in range(3):
            a = rz + ax * 2.094
            beam((x - math.cos(a) * s / 2, y - math.sin(a) * s / 2, 0.05 + (0.9 if ax == 1 else 0.0)), (x + math.cos(a) * s / 2, y + math.sin(a) * s / 2, 0.05 + (0.0 if ax == 1 else 0.9)), 0.12, mat)
    def wire_coil(x0, y0, x1, y1, r=0.45, mat='metal'):
        """concertina: a run of thin hoops, 0.9 m (blocks)"""
        L = math.hypot(x1 - x0, y1 - y0); n = max(2, int(L / 0.35)); rz = math.atan2(y1 - y0, x1 - x0)
        for k in range(n + 1):
            px, py = x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n
            for j in range(8):
                a0, a1 = 2 * math.pi * j / 8, 2 * math.pi * (j + 1) / 8; sh = 0.12 * (k % 2)
                pa = P(px, py, rz, sh, r * math.cos(a0)); pb = P(px, py, rz, sh, r * math.cos(a1))
                beam((pa[0], pa[1], r + 0.02 + r * math.sin(a0)), (pb[0], pb[1], r + 0.02 + r * math.sin(a1)), 0.015, mat)
    for k, v in list(locals().items()):
        if callable(v) and not k.startswith('_') and k not in ('install', 'bm', 'MI', 'box', 'cyl', 'T', 'Rz'): g.setdefault(k, v) if k in ('P', 'beam') else g.__setitem__(k, v)

def lightmap_uv(ob, log=print, margin=0.0012, size=2048):
    """the 'Lightmap' UV layer: islands by angle with no margin, then packed tight with a fixed margin (a fraction of the picture).
    (smart_project's own island margin scales with the island count: with thousands of small props it left the ground a few texels per metre)"""
    import bpy
    me = ob.data
    if 'Lightmap' not in me.uv_layers: me.uv_layers.new(name='Lightmap')
    me.uv_layers.active = me.uv_layers['Lightmap']
    vl = bpy.context.view_layer
    for o in list(vl.objects):
        if o is not None: o.select_set(False)
    vl.objects.active = ob; ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0)
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(rotate=True, margin_method='FRACTION', margin=margin)
    bpy.ops.object.mode_set(mode='OBJECT')
    uv = me.uv_layers['Lightmap'].data; ua = wa = 0.0
    for p in me.polygons:
        if p.normal.z > 0.9 and p.center.z < 0.01:
            pts = [uv[li].uv for li in p.loop_indices]
            a = 0.0
            for i in range(len(pts)): a += pts[i].x * pts[(i + 1) % len(pts)].y - pts[(i + 1) % len(pts)].x * pts[i].y
            ua += abs(a) / 2; wa += p.area
    log('lightmap: ground at %.1f texels per metre (%d px picture)' % (math.sqrt(ua / max(wa, 1e-6)) * size, size))
    try:
        from hgkit import collapse_thin_lightmap
        log('lightmap: %d thin faces take their light from a neighbour' % collapse_thin_lightmap(ob, size))
    except ImportError: pass
    me.uv_layers.active = me.uv_layers['UVMap']
