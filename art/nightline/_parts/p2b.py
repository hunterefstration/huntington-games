
# ---------------------------------------------------------------- buildings: walls with a painted facade, lit windows as emissive quads, shop fronts, signs, neon trim
STY = {
 'harbor':   dict(w=(16, 30), dep=(12, 18), H=(7, 13),  fac=['fac_a', 'fac_b'], neon=['amber', 'red', 'cyan'],      lit=0.30, tower=0.0,  sign=0.45, setback=16.0),
 'terminal': dict(w=(20, 34), dep=(14, 22), H=(8, 14),  fac=['fac_b'],          neon=['amber', 'red'],              lit=0.25, tower=0.0,  sign=0.40, setback=17.0),
 'avenue':   dict(w=(14, 24), dep=(12, 18), H=(14, 32), fac=['fac_a', 'fac_b'], neon=['magenta', 'amber', 'green'], lit=0.50, tower=0.0,  sign=0.85, setback=15.5),
 'downtown': dict(w=(18, 28), dep=(16, 24), H=(38, 85), fac=['fac_b'],          neon=['cyan', 'magenta'],           lit=0.50, tower=0.85, sign=0.55, setback=16.0),
 'oldtown':  dict(w=(12, 20), dep=(10, 16), H=(9, 19),  fac=['fac_a'],          neon=['green', 'amber', 'red'],     lit=0.45, tower=0.0,  sign=0.70, setback=15.5),
}
NSIGN = [0]
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
        nk = int(w / 3.0)
        for n, wc, hw, front in walls:
            if n.dot(-front_n) > 0.9: continue                                 # no windows on the back
            A, B, eu = wall_pts(wc, n, hw); nk = int(2 * hw / 3.0); pl = lit * (1.0 if front else 0.65)
            for f in range(nf):
                zc = zg + zs + 3.2 * f + 1.8
                for k in range(nk):
                    if rng.random() > pl: continue
                    r = rng.random(); cn = 'wwarm' if r < 0.66 else ('wcool' if r < 0.80 else ac)
                    quad_on(A + eu * (3 * k + 1.5) + UP * zc + n * 0.045, eu, UP, 0.68, 0.83, n, 'emissive_' + cn)
            if front:
                for k in range(nk):
                    if rng.random() < 0.8:
                        sc_ = rng.choice(shop_colors or (['wwarm'] * 2 + ['wcool', ac])); p = A + eu * (3 * k + 1.5) + UP * (zg + 1.75) + n * 0.045
                        quad_on(p, eu, UP, 1.25, 1.12, n, 'emissive_' + sc_)
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
    if detail and not rowback:
        for _k in range(rng.randrange(2, 5)):
            q = c + ex * rng.uniform(-w / 2 + 2, w / 2 - 2) + ey * rng.uniform(-dep / 2 + 2, dep / 2 - 2); sz = rng.uniform(1.2, 3.0)
            obox(q + UP * (roofz + sz * 0.4), ex, ey, UP, sz / 2, sz / 2 * rng.uniform(0.6, 1.4), sz * 0.4, 'metal', dens=0.3, bottom=False)
        if rng.random() < 0.5: beam(c + UP * roofz, c + UP * (roofz + rng.uniform(5, 9)), 0.12, 'metal')
    if H > 42 and not rowback:
        p = c + UP * (roofz + 0.4); obox(p, ex, ey, UP, 0.3, 0.3, 0.3, 'emissive_red', dens=1.0); GLW(p, 'red', 9.0)
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
