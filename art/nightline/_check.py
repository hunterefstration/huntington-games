# scratch checks on quay.blend:  blender -b art/nightline/quay.blend -P art/nightline/_check.py
import bpy, json, os, math, sys
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
BASE = os.path.dirname(os.path.abspath(__file__))
T = json.load(open(os.path.join(BASE, 'quay.track.json'))); S = np.array(T['s']); N = len(S)
C = np.stack([S[:, 0], -S[:, 2], S[:, 1]], 1); LF = np.stack([S[:, 4], S[:, 3]], 1); BK = S[:, 5]
ob = bpy.data.objects['quay']; me = ob.data
mi = {m.name: i for i, m in enumerate(me.materials)}
road = mi['nl_road']
vs = [v.co for v in me.vertices]
tris = [t for t in me.loop_triangles] if me.loop_triangles else (me.calc_loop_triangles() or list(me.loop_triangles))
rt = [t for t in me.loop_triangles if me.polygons[t.polygon_index].material_index == road]
bvh = BVHTree.FromPolygons([tuple(v) for v in vs], [tuple(t.vertices) for t in rt])
worst = 0.0; bad = 0
for i in np.linspace(0, N - 1, 20).astype(int):
    for d in (-6.95, 0.0, 6.95):
        x = C[i, 0] + LF[i, 0] * d; y = C[i, 1] + LF[i, 1] * d; z = C[i, 2] - d * BK[i]
        h = bvh.ray_cast(Vector((x, y, z + 40)), Vector((0, 0, -1)), 100)
        e = abs(h[0].z - z) if h[0] is not None else 99.0
        worst = max(worst, e); bad += e > 0.05
print('CHECK1 road height: 60 probes (20 samples x centre, +-7 m), worst error %.4f m, over 5 cm: %d' % (worst, bad))
# corridor: no vertex of anything but the road, runoff, kerb, paint and the barrier's own faces inside |d| < 8.45 and 0.05 < height above the road plane < 6.0
P = np.array([tuple(v.co) for v in me.vertices]); mats = np.zeros(len(me.vertices), int)
vm = [set() for _ in me.vertices]
for p in me.polygons:
    for v in p.vertices: vm[v].add(p.material_index)
allowed = {mi['nl_road'], mi['nl_pave'], mi['nl_kerb'], mi['nl_paint']}
viol = []
for k0 in range(0, len(P), 2000):
    Q = P[k0:k0 + 2000]; d2 = (Q[:, None, 0] - C[None, :, 0]) ** 2 + (Q[:, None, 1] - C[None, :, 1]) ** 2; j = d2.argmin(1)
    for q, jj, vi in zip(Q, j, range(k0, k0 + len(Q))):
        dd = (q[0] - C[jj, 0]) * LF[jj, 0] + (q[1] - C[jj, 1]) * LF[jj, 1]; h = q[2] - (C[jj, 2] - dd * BK[jj])
        if abs(dd) < 8.45 and 0.05 < h < 6.0 and math.sqrt(d2[vi - k0, jj]) < 12 and not (vm[vi] <= allowed): viol.append((int(jj), round(float(dd), 2), round(float(h), 2), sorted(me.materials[m].name for m in vm[vi])))
print('CHECK2 corridor: %d vertices inside |d|<8.45, 0.05..6 m above the road that are not road/runoff/kerb/paint' % len(viol), viol[:8])
# barrier: inner face vertices (concrete at |d| 8.5) distance from the 8.5 m line, over all samples
inner = []
for p in me.polygons:
    if p.material_index == mi['nl_concrete'] and abs(p.normal.z) < 0.1:
        for v in p.vertices:
            q = P[v]; jj = int(((q[0] - C[:, 0]) ** 2 + (q[1] - C[:, 1]) ** 2).argmin()); dd = (q[0] - C[jj, 0]) * LF[jj, 0] + (q[1] - C[jj, 1]) * LF[jj, 1]
            if 8.2 < abs(dd) < 8.8 and 0 < q[2] - (C[jj, 2] - dd * BK[jj]) < 1.05: inner.append(abs(dd))
inner = np.array(inner); print('CHECK3 barrier inner face: %d vertices, |d| min %.3f max %.3f' % (len(inner), inner.min(), inner.max()))
# CHECK4: baked light on the road (needs tex/quay_light.exr): luminance at the middle of each road quad, longest dark run
p = os.path.join(BASE, 'tex', 'quay_light.exr')
if os.path.exists(p):
    im = bpy.data.images.load(p); W, H = im.size; a = np.array(im.pixels[:], np.float32).reshape(H, W, 4)[:, :, :3]; lum = a @ np.array((0.3, 0.59, 0.11), np.float32)
    uvd = me.uv_layers['Lightmap'].data; L = np.zeros(N)
    rp = [pl for pl in me.polygons if pl.material_index == road][:N]
    for k, pl in enumerate(rp):
        us = [uvd[li].uv for li in pl.loop_indices]; u = sum(q.x for q in us) / 4; v = sum(q.y for q in us) / 4; L[k] = lum[min(H - 1, int(v * H)), min(W - 1, int(u * W))]
    step = T['length'] / N
    for thr in (0.15, 0.3, 0.6):
        run = best = 0
        for k in range(2 * N):
            if L[k % N] < thr: run += 1; best = max(best, run)
            else: run = 0
        print('CHECK4 road light: longest run under L=%.2f: %.0f m' % (thr, min(best, N) * step))
    print('CHECK4 road light L (centre of road): min %.2f  p5 %.2f  median %.2f  p95 %.2f  max %.2f' % (L.min(), np.percentile(L, 5), np.median(L), np.percentile(L, 95), L.max()))
