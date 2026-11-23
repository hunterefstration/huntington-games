# Coplanar overlap finder for the map scripts (make_outpost/mall/carnival/lab.py): faces that face the same way, lie within `tol` of the
# same plane and overlap by more than `min_area` fight in the depth buffer (and in the light picture). Run it on the map's bmesh before
# it becomes a mesh:  from coplanar import report; report(bm, MATS, log)
# A fight is skipped when it cannot be seen: the overlap is covered (something lies within 2 tol in front of it) or lies inside a solid.
# Faces under the ground (bottoms at z < 2 cm facing down) are skipped. Returns the list of fights (area, materials, centre).
import math
from mathutils import Vector
from mathutils.bvhtree import BVHTree

def _clip(poly, a, b):
    """Sutherland-Hodgman: keep the part of convex poly on the left of edge a->b"""
    out = []; n = len(poly)
    if n == 0: return out
    def side(p): return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
    for i in range(n):
        p, q = poly[i], poly[(i + 1) % n]; sp, sq = side(p), side(q)
        if sp >= 0: out.append(p)
        if (sp >= 0) != (sq >= 0):
            t = sp / (sp - sq); out.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
    return out
def _area(poly):
    s = 0.0
    for i in range(len(poly)): x0, y0 = poly[i]; x1, y1 = poly[(i + 1) % len(poly)]; s += x0 * y1 - x1 * y0
    return s / 2
def _ccw(poly): return poly if _area(poly) >= 0 else poly[::-1]

def report(bm, MATS, log, tol=0.01, min_area=0.004, show=25):
    bm.faces.ensure_lookup_table(); bm.normal_update()
    bvh = BVHTree.FromBMesh(bm)
    groups = {}
    for f in bm.faces:
        if f.calc_area() < 1e-4: continue
        n = f.normal
        if n.length < 0.5: continue
        c = f.calc_center_median()
        if n.z < -0.9 and c.z < 0.02: continue
        key = (round(n.x, 2), round(n.y, 2), round(n.z, 2))
        groups.setdefault(key, []).append(f)
    fights = []
    for key, fs in groups.items():
        n = Vector(key).normalized()
        u = n.cross(Vector((0, 0, 1)) if abs(n.z) < 0.9 else Vector((1, 0, 0))).normalized(); v = n.cross(u)
        recs = []
        for f in fs:
            pts = [(p.co.dot(u), p.co.dot(v)) for p in f.verts]; d = sum(p.co.dot(n) for p in f.verts) / len(f.verts)
            xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
            recs.append((d, min(xs), min(ys), max(xs), max(ys), _ccw(pts), f))
        recs.sort(key=lambda r: r[0])
        # sweep along d; inside the window, a 2 m hash on the projected box
        j0 = 0
        for i, A in enumerate(recs):
            while recs[j0][0] < A[0] - tol: j0 += 1
            for B in recs[j0:i]:
                if B[1] >= A[3] or A[1] >= B[3] or B[2] >= A[4] or A[2] >= B[4]: continue
                poly = A[5]
                for k in range(len(B[5])):
                    poly = _clip(poly, B[5][k], B[5][(k + 1) % len(B[5])])
                    if len(poly) < 3: break
                if len(poly) < 3: continue
                ar = _area(poly)
                if ar < min_area: continue
                cu = sum(p[0] for p in poly) / len(poly); cv = sum(p[1] for p in poly) / len(poly)
                P = u * cu + v * cv + n * (max(A[0], B[0]) + 0.004)
                loc, nor, idx, dist = bvh.ray_cast(P, n, 10.0)
                if loc is not None and (dist < 2 * tol or nor.dot(n) > 0.1): continue        # covered, or inside something
                fights.append((ar, MATS[A[6].material_index], MATS[B[6].material_index], tuple(round(x, 2) for x in P), round(abs(A[0] - B[0]), 4)))
    fights.sort(key=lambda r: -r[0])
    log('coplanar fights: %d (%.1f m2)' % (len(fights), sum(f[0] for f in fights)))
    for ar, ma, mb, P, dd in fights[:show]: log('   %.3f m2  %s / %s  at %s  gap %.4f' % (ar, ma, mb, P, dd))
    return fights
