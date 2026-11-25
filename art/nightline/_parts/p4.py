
# ---------------------------------------------------------------- the park: lit trees
def blob(c, r, mat='foliage'):
    c = Vector(c); ring = []
    for k in range(8):
        a = k * math.pi / 4 + rng.uniform(-0.15, 0.15); rr = r * rng.uniform(0.85, 1.1); ring.append(c + Vector((rr * math.cos(a), rr * math.sin(a), rng.uniform(-0.1, 0.1) * r)))
    top = c + Vector((0, 0, r * 0.95)); bot = c - Vector((0, 0, r * 0.7))
    for k in range(8):
        a = ring[k]; b = ring[(k + 1) % 8]
        F([top, a, b], mat, None, None, (top + a + b) / 3 - c, 1.5, 4.0); F([bot, b, a], mat, None, None, (bot + a + b) / 3 - c, 1.5, 4.0)
def make_tree(p, g, to_road, s, cnt, rr=2.0):
    h = rng.uniform(2.6, 3.6) * s; yaw = rng.uniform(0, 3)
    bbox(p.x, p.y, g - 0.3, yaw, 0.7, 0.7, h + 0.3, 'concrete', dens=2.0, bottom=False)
    cz = g + h + 1.6 * s; blob(Vector((p.x, p.y, cz)), 2.5 * s); blob(Vector((p.x + 1.0 * s, p.y + 0.5 * s, cz - 1.1 * s)), 1.9 * s)
    for _k in range(3):
        a = rng.uniform(-1.2, 1.2); dirv = Vector((to_road.x * math.cos(a) - to_road.y * math.sin(a), to_road.x * math.sin(a) + to_road.y * math.cos(a), 0))
        q = Vector((p.x, p.y, cz + rng.uniform(-1.0, 0.6) * s)) + dirv * 2.6 * s
        quad_on(q, RIGHT(dirv), UP, 0.14, 0.14, dirv, 'emissive_' + rng.choice(('amber', 'wwarm', 'amber', 'green')))
    if cnt % 4 == 0: LT(Vector((p.x, p.y, g + 0.6)) + to_road * 1.5, COL[rng.choice(('amber', 'green', 'cyan', 'amber'))], 450.0, 0.3)
    if cnt % 3 == 0: GLW(Vector((p.x, p.y, cz)) + to_road * 2.4, 'amber', 6.0)
    occupy(p.x, p.y, rr)
def park_trees():
    cnt = 0
    for i in range(int(0.45 * N), int(0.60 * N), 2):
        for sg in (1, -1):
            for _ in range(rng.choice((1, 1, 2, 3))):
                d = sg * rng.uniform(14.5, 52.0); p = P(i, d); g = GC(i); p = Vector((p.x, p.y, g))
                if nearest(p.x, p.y)[1] < 13.5 or not free(p.x, p.y, 2.0, 2.0): continue
                make_tree(p, g, zdir(P(i, 0), p), rng.uniform(0.9, 1.4), cnt); cnt += 1
    for i in range(0, N, 10):                             # street trees on the sidewalk between the lamps, in the city stretches
        if zone(i / N) not in ('avenue', 'downtown', 'oldtown') or blocked_zone(i): continue
        for sg in (1, -1):
            ii = i + 5 if sg > 0 else i + 10; p = P(ii, sg * 11.9); g = GC(ii); p = Vector((p.x, p.y, g - 0.1))
            if sg * 0 == 0 and not free(p.x, p.y, 1.5, 0.5): continue
            make_tree(p, g - 0.1, zdir(P(ii, 0), p), 0.7, cnt, 1.5); cnt += 1
    log('trees:', cnt)
park_trees()
place_rows()
log('city:', NFACE[0], 'faces,', len(LIGHTS), 'lights,', len(GLOWS), 'glows')

# ---------------------------------------------------------------- the ground away from the road (a heightfield from the ground heights), water, the base plane, a skyline all round
X0, X1, Y0, Y1 = -346.0, 338.0, -266.0, 296.0
def heightfield(cell=10.0):
    xs = np.arange(X0, X1 + 0.1, cell); ys = np.arange(Y0, 190.0, cell); nx, ny = len(xs), len(ys)
    Z = np.zeros((ny, nx)); DM = np.zeros((ny, nx)); DB = np.full((ny, nx), 1e9); PK = np.zeros((ny, nx), bool)
    br = np.arange(IB0 - 8, IB1 + 8) % N; bpts = C[br, :2]
    for r, y in enumerate(ys):
        d2 = (CSXY[None, :, 0] - xs[:, None]) ** 2 + (CSXY[None, :, 1] - y) ** 2
        DM[r] = np.sqrt(d2.min(1)); w = 1.0 / (d2[:, ::2] + 120.0) ** 1.5; Z[r] = (w * GCS[None, :]).sum(1) / w.sum(1)
        db = (bpts[None, :, 0] - xs[:, None]) ** 2 + (bpts[None, :, 1] - y) ** 2; DB[r] = np.sqrt(db.min(1))
        nn = d2.argmin(1); PK[r] = [zone(k / N) == 'park' for k in nn]
    n = 0
    for r in range(ny - 1):
        for c in range(nx - 1):
            blk = (DM[r:r + 2, c:c + 2].min() < 21.0) or (DB[r:r + 2, c:c + 2].min() < 52.0)
            if blk or ys[r + 1] > 184: continue
            v = lambda rr, cc: Vector((xs[cc], ys[rr], Z[rr, cc] - 0.5))
            F([v(r, c), v(r, c + 1), v(r + 1, c + 1), v(r + 1, c)], 'grass' if PK[r:r + 2, c:c + 2].all() else 'pave', None, None, UP, 0.1, 6.0); n += 1
    log('heightfield cells:', n)
heightfield()
F([Vector((X0, Y0, -1.3)), Vector((X1, Y0, -1.3)), Vector((X1, Y1, -1.3)), Vector((X0, Y1, -1.3))], 'pave', None, None, UP, 0.02, 12.0)
F([Vector((X0, 183.0, -0.3)), Vector((X1, 183.0, -0.3)), Vector((X1, Y1, -0.3)), Vector((X0, Y1, -0.3))], 'water', None, None, UP, 0.05, 24.0)
ribbon(IB0 - 8, IB1 + 8, lambda i: [PA(i, -50.0, -0.3), PA(i, 50.0, -0.3)], 'water', UP, tile=(24, 24), dens=0.05, chunk=24)
for (a, b, n, ln) in (((X0, Y1), (X1, Y1), (0, -1), X1 - X0), ((X1, Y1), (X1, Y0), (-1, 0), Y1 - Y0), ((X1, Y0), (X0, Y0), (0, 1), X1 - X0), ((X0, Y0), (X0, Y1), (1, 0), Y1 - Y0)):
    rep = ln / 240.0
    F([Vector((a[0], a[1], -1.0)), Vector((b[0], b[1], -1.0)), Vector((b[0], b[1], 69.0)), Vector((a[0], a[1], 69.0))], 'sky', [(0, 0), (rep, 0), (rep, 1), (0, 1)], None, Vector((n[0], n[1], 0)), 0.01)
log('geometry done:', NFACE[0], 'faces')

# ---------------------------------------------------------------- build the object, weld, light-picture patches
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
BLOCKS = {}
for k, zv in (('A', -1.4), ('B', -1.45)):
    f = F([Vector((0, 0, zv)), Vector((6, 0, zv)), Vector((6, 6, zv)), Vector((0, 6, zv))], 'concrete', None, [(0, 0), (8, 0), (8, 8), (0, 8)], -UP, 1.0)
me = bpy.data.meshes.new('quay'); bm.to_mesh(me); bm.free()
for m in mats: me.materials.append(m)
mc = bpy.data.collections.new('map'); scene.collection.children.link(mc)
ob = bpy.data.objects.new('quay', me); mc.objects.link(ob)
me.calc_loop_triangles(); NTRI = len(me.loop_triangles); log('quay mesh:', NTRI, 'triangles,', len(me.vertices), 'verts,', len(me.polygons), 'faces')
NP = len(me.polygons); BLOCK_POLY = {}
for p in me.polygons:                                    # the two light-picture patches are the only faces under the base plane (z -1.4 / -1.45)
    zs = [me.vertices[v].co.z for v in p.vertices]
    if all(-1.5 < z < -1.38 for z in zs): BLOCK_POLY['A' if zs[0] > -1.42 else 'B'] = p.index
BLK = set(BLOCK_POLY.values()); assert len(BLK) == 2, BLOCK_POLY
BAKED = np.array([(p.material_index not in EMISSIVE and p.material_index not in SELFI) and p.index not in BLK for p in me.polygons])
def activate(o):
    vl = bpy.context.view_layer
    for q in list(vl.objects):
        if q is not None: q.select_set(False)
    vl.objects.active = o; o.select_set(True)
def pack():
    me.uv_layers.active = me.uv_layers['Lightmap']; activate(ob)
    bpy.ops.object.mode_set(mode='EDIT'); b2 = bmesh.from_edit_mesh(me); b2.faces.ensure_lookup_table()
    for f in b2.faces: f.select_set(bool(BAKED[f.index]) or f.index in BLK)
    b2.select_flush_mode(); bmesh.update_edit_mesh(me)
    bpy.ops.uv.select_all(action='SELECT')
    try: bpy.ops.uv.pack_islands(rotate=True, margin_method='FRACTION', margin=0.0011, shape_method='AABB')
    except TypeError: bpy.ops.uv.pack_islands(rotate=True, margin=0.0011)
    bpy.ops.object.mode_set(mode='OBJECT'); me.uv_layers.active = me.uv_layers['UVMap']
t0 = time.time(); pack(); log('packed the light picture UVs in %.0f s' % (time.time() - t0))
lmd = me.uv_layers['Lightmap'].data
def poly_uvbox(pi):
    us = [lmd[li].uv for li in me.polygons[pi].loop_indices]; return min(u.x for u in us), max(u.x for u in us), min(u.y for u in us), max(u.y for u in us)
bx = {k: poly_uvbox(v) for k, v in BLOCK_POLY.items()}
# a road density report: texels per metre on the road
rp = [p for p in me.polygons if p.material_index == MI['road']][:200]; ta = ua = 0.0
for p in rp:
    pts = [lmd[li].uv for li in p.loop_indices]; a = sum(pts[k].x * pts[(k + 1) % 4].y - pts[(k + 1) % 4].x * pts[k].y for k in range(4)) / 2; ua += abs(a); ta += p.area
RD = math.sqrt(ua / ta) * LMSIZE; log('road light density: %.1f texels per metre (%d px picture)' % (RD, LMSIZE))
log('thin faces given a neighbour texel:', mapkit.collapse_thin(ob, LMSIZE, min_width=0.9, reach=1.2))
for p in me.polygons:                                    # not baked: self-lit faces look at their bright patch, emissive ones sit in a corner texel
    mi = p.material_index
    if p.index in BLK: continue
    if mi in SELFI:
        k = SELFI[mi]; u0, u1, v0, v1 = bx[k]; cu, cv = (u0 + u1) / 2, (v0 + v1) / 2
        for li in p.loop_indices: lmd[li].uv = (cu, cv)
    elif mi in EMISSIVE:
        for li, (du, dv) in zip(p.loop_indices, TINY): lmd[li].uv = (0.9996 + du * 0.1, 0.9996 + dv * 0.1)

# ---------------------------------------------------------------- lights, moon, painted night sky
def make_sky(W=1024):
    M = Vector((-0.45, 0.55, 0.70)).normalized()
    sky = ash_paint.night_sky(W, tuple(M), aurora=0.0, zen=(0.004, 0.007, 0.028), mid=(0.010, 0.020, 0.055), hor=(0.05, 0.04, 0.07), moon_col=(0.55, 0.58, 0.62), halo=(0.55, 0.75, 1.0),
                              moon2=(0.01, 0.0, -1.0), moon2_col=(0, 0, 0), glow2=(0, 0, 0)); H = sky.shape[0]
    v = (np.arange(H, dtype=np.float32) + 0.5) / H; u = (np.arange(W, dtype=np.float32) + 0.5) / W; th = (v - 0.5) * np.pi; ph = -(u - 0.5) * 2 * np.pi
    ct = np.cos(th)[:, None]; X = ct * np.cos(ph)[None, :]; Y = ct * np.sin(ph)[None, :]; Z = np.repeat(np.sin(th)[:, None], W, 1)
    wS = np.clip(-Y, 0, 1) ** 1.5; wW = np.clip(-X, 0, 1) ** 2; wE = np.clip(X, 0, 1) ** 2; wN = np.clip(Y, 0, 1)
    gcol = wS[..., None] * v3(1.0, 0.38, 0.14) + wW[..., None] * v3(0.9, 0.18, 0.6) * 0.7 + wE[..., None] * v3(0.2, 0.55, 0.95) * 0.6 + wN[..., None] * v3(0.1, 0.35, 0.55) * 0.5 + 0.12
    zp = np.clip(Z, 0, 1); glow = np.exp(-zp / 0.05) * 0.9 + np.exp(-zp / 0.22) * 0.25; glow = np.where(Z > -0.05, glow, 0.0)
    sky = sky + gcol * glow[..., None] * 0.13
    cl = np.clip((tn(H, W, 14, 30, 7) * 0.6 + tn(H, W, 30, 70, 8) * 0.4 - 0.52) * 3.5, 0, 1) * np.clip((Z - 0.02) / 0.1, 0, 1) * np.clip((0.62 - Z) / 0.3, 0, 1)
    lit = np.exp(-zp / 0.30)[..., None] * gcol * 0.5 + v3(0.05, 0.07, 0.11)
    sky = sky * (1 - 0.4 * cl[..., None]) + cl[..., None] * lit * 0.35
    path = os.path.join(TEXDIR, 'quay_night_sky.exr'); old = bpy.data.images.get('quay_night_sky')
    if old: bpy.data.images.remove(old)
    im = bpy.data.images.new('quay_night_sky', W, H, alpha=False, float_buffer=True); im.pixels.foreach_set(np.concatenate([sky.astype(np.float32), np.ones((H, W, 1), np.float32)], 2).ravel())
    ash_paint.save_exr_linear(im, path); bpy.data.images.remove(im); im = bpy.data.images.load(path); im.name = 'quay_night_sky'
    w = bpy.data.worlds.new('quay_sky'); scene.world = w; w.use_nodes = True; nt = w.node_tree
    for nd in list(nt.nodes): nt.nodes.remove(nd)
    out = nt.nodes.new('ShaderNodeOutputWorld'); bg = nt.nodes.new('ShaderNodeBackground'); env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = im
    nt.links.new(env.outputs['Color'], bg.inputs['Color']); nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    lp = nt.nodes.new('ShaderNodeLightPath'); mr = nt.nodes.new('ShaderNodeMapRange'); nt.links.new(lp.outputs['Is Camera Ray'], mr.inputs['Value'])
    mr.inputs['To Min'].default_value = float(OPT.get('skyk', 3.0)); mr.inputs['To Max'].default_value = 1.0; nt.links.new(mr.outputs['Result'], bg.inputs['Strength'])
    scene.view_settings.exposure = 0.0
    return M
def build_lights():
    lc = bpy.data.collections.new('lights'); scene.collection.children.link(lc)
    M = make_sky(int(OPT.get('skyw', 2048)))
    sd = bpy.data.lights.new('Moon', 'SUN'); sd.energy = float(OPT.get('moon', 0.9)); sd.color = (0.58, 0.70, 1.0); sd.angle = math.radians(1.2)
    so = bpy.data.objects.new('Moon', sd); lc.objects.link(so); so.rotation_euler = (-M).to_track_quat('-Z', 'Y').to_euler()
    for k, (p, col, W, r) in enumerate(LIGHTS):
        ld = bpy.data.lights.new('L%d' % k, 'POINT'); ld.energy = W * float(OPT.get('lk', 1.0)); ld.color = col; ld.shadow_soft_size = r
        lo = bpy.data.objects.new('L%d' % k, ld); lc.objects.link(lo); lo.location = p
    gl = bpy.data.collections.new('glows'); scene.collection.children.link(gl)
    for k, (p, col, size) in enumerate(GLOWS):
        e = bpy.data.objects.new('glow.%03d' % k, None); e.empty_display_type = 'PLAIN_AXES'; e.empty_display_size = 0.3; gl.objects.link(e); e.location = p
        e['r'], e['g'], e['b'], e['size'] = col[0], col[1], col[2], size
    log('lights:', len(LIGHTS), 'glows:', len(GLOWS))
build_lights()

# ---------------------------------------------------------------- bake the light picture
def bake(samples=48):
    lm = me.uv_layers['Lightmap']; me.uv_layers.active = lm
    img = bpy.data.images.new('quay_light', LMSIZE, LMSIZE, alpha=False, float_buffer=True)
    for m in me.materials:
        nt = m.node_tree; n = nt.nodes.new('ShaderNodeTexImage'); n.name = 'hg_bake'; n.image = img; nt.nodes.active = n
    scene.render.engine = 'CYCLES'; scene.cycles.samples = samples; scene.cycles.device = 'CPU'
    try: scene.cycles.use_denoising = False
    except Exception: pass
    for a, v in (('diffuse_bounces', 2), ('max_bounces', 4), ('sample_clamp_indirect', 4.0), ('sample_clamp_direct', 40.0), ('use_adaptive_sampling', False)):
        try: setattr(scene.cycles, a, v)
        except Exception: pass
    activate(ob); scene.render.bake.margin = 5
    t0 = time.time(); bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=5, use_clear=True); log('baked in %.0f s' % (time.time() - t0))
    a = np.array(img.pixels[:], np.float32).reshape(LMSIZE, LMSIZE, 4)
    rgb, fired = mapkit.clean_light(a[:, :, :3]); log('fireflies replaced:', fired)
    a[:, :, :3] = rgb
    for k in 'AB':                                        # the self-lit patches: a fixed brightness the colour picture is multiplied by
        u0, u1, v0, v1 = bx[k]; x0 = int(math.ceil(u0 * LMSIZE)) + 3; x1 = int(math.floor(u1 * LMSIZE)) - 3; y0 = int(math.ceil(v0 * LMSIZE)) + 3; y1 = int(math.floor(v1 * LMSIZE)) - 3
        a[y0:y1, x0:x1, :3] = SELF_L[k]; log('self-lit patch', k, 'texels', x1 - x0, 'x', y1 - y0, 'L', SELF_L[k])
    img.pixels.foreach_set(a.ravel())
    path = os.path.join(TEXDIR, 'quay_light.exr'); ash_paint.save_exr_linear(img, path)
    for m in me.materials:
        n = m.node_tree.nodes.get('hg_bake')
        if n: m.node_tree.nodes.remove(n)
    me.uv_layers.active = me.uv_layers['UVMap']
    lum = rgb @ np.array((0.3, 0.59, 0.11), np.float32); nz = lum[lum > 0]
    log('light picture: median %.2f, 90%% %.2f, 99%% %.2f, 99.9%% %.2f' % (float(np.median(nz)), float(np.percentile(nz, 90)), float(np.percentile(nz, 99)), float(np.percentile(nz, 99.9))))
    bpy.data.images.remove(img)
if 'nobake' not in OPT: bake(int(OPT.get('samples', 48)))
cfg = {'blend': 'quay.blend', 'out': '../../Nightline/assets/quay',
       'world': {'collections': ['map'], 'lightmap': 'tex/quay_light.exr', 'lmSize': LMSIZE, 'lmRange': 8},
       'sky': {'width': 2048}, 'maxTexture': 2048}
with open(os.path.join(BASE, 'quay.export.json'), 'w') as f: json.dump(cfg, f, indent=1)
bpy.ops.wm.save_mainfile(); log('saved', bpy.data.filepath, '|', NTRI, 'triangles,', len(mats), 'materials,', len(LIGHTS), 'lights,', len(GLOWS), 'glows')
log('done')
