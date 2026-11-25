
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
    occupy(ctr.x, ctr.y + 0, 0.1)
for ii in (24, 62, 98): crane(ii)

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
            LT(PA(ip, sg * 10.6, y + 14.0) - LFv(ip) * sg * 0.8, COL['cyan'], 3000.0, 0.5)
        LT(PA(ip, 0, y + 19.0), COL['cyan'], 4500.0, 0.6)
pylons()

# the arch over the road at the park gate, a needle tower (avenue), a clock tower (old town)
def arch(i):
    y = C[i % N, 2]; ex = TGv(i); ey = LFv(i); back = -ex
    for sg in (1, -1):
        b = P(i, sg * 10.9); obox(Vector((b.x, b.y, (b.z - 0.4 + y + 10.4) / 2)), ex, ey, UP, 0.65, 0.65, (y + 10.4 - b.z + 0.4) / 2, 'metal', dens=1.5, bottom=False)
    obox(PA(i, 0, y + 9.8), ex, ey, UP, 0.7, 11.3, 0.7, 'metal', dens=1.5, bottom=True)
    F([PA(i, -10.5, y + 9.4) + back * 0.72, PA(i, 10.5, y + 9.4) + back * 0.72, PA(i, 10.5, y + 9.7) + back * 0.72, PA(i, -10.5, y + 9.7) + back * 0.72], 'emissive_amber', None, None, back)
    c = PA(i, 0, y + 11.9) + back * 0.1; n = back; quad_on(c, RIGHT(n), UP, 4.0, 1.0, n, 'sign', panel_uv(5)); LT(c + back * 2.5, COL['amber'], 900.0, 0.5)
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
