# Steel Storm Remastered: the look pass done IN PLACE on a built battlefield (nothing moves: the map scripts' blobs are shaped through a
# set of vertices, so a full rebuild never gives exactly the same rocks, crowns and scatter placements; this keeps the layout as it is):
#   blender -b art/steelstorm/<map>.blend -P tools/blender/ss_repaint.py -- [samples=32] [pine] [nobake]
# then  node tools/export-art.mjs <map>   (range: range_ssr)
# 1. pictures: tree crowns (`foliage`) and hedges (`hedge`) get leaf-clump pictures in natural greens with light and shade (the old hedge
#    picture averaged 0.14 and read black in the game);
# 2. tree crowns (icosphere blobs of foliage): flat, shaded undersides (their tops and outlines stay, so the heights do not change); a
#    trunk left short under a raised crown is lengthened into it;
# 3. hedge boxes (8 vertices, at least 1.8 m tall): the top edges cut back (a clipped hedge, not a block); same footprint, same top line;
# 4. `pine`: the lone broadleaf trees (five soft foliage blobs round a trunk) become pines like the proof slice's (soft crowns: no heights);
# 5. the props light picture re-baked (props + props_soft joined for it, split again after), the three tanks rebuilt (ss_tanks).
import bpy, bmesh, math, os, sys, json
import numpy as np
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ss_mapkit as K
from hgkit import log, smart_uv
from ss_tanks import drop_tanks, build_tanks, BASE

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OPT = dict((a.split('=', 1) + ['1'])[:2] for a in ARGV)
NAME = os.path.splitext(os.path.basename(bpy.data.filepath))[0]; K.NAME = NAME

# ---------------------------------------------------------------- 1. pictures (written into the image the material already uses)
def put(imname, px, fname):
    im = bpy.data.images.get(imname)
    if im is None: return False
    N = px.shape[0]
    if tuple(im.size) != (N, N): im.scale(N, N)
    im.pixels.foreach_set(np.concatenate([px, np.ones((N, N, 1), np.float32)], 2).ravel())
    path = os.path.join(K.TEXDIR, fname + '.png'); im.filepath_raw = path; im.file_format = 'PNG'; im.save(); im.filepath = '//tex/' + fname + '.png'
    log('picture', imname, '->', path, 'mean', px.reshape(-1, 3).mean(0).round(3)); return True
put('foliage', K.foliage_px(), 'foliage') or put('foliage.png', K.foliage_px(), 'foliage')
put('hedge', K.hedge_px(), 'hedge')

# ---------------------------------------------------------------- 2-4. geometry
pr = bpy.data.objects['props']; so = bpy.data.objects.get('props_soft')
if so is not None:
    vl = bpy.context.view_layer
    for o in list(vl.objects):
        if o is not None: o.select_set(False)
    pr.select_set(True); so.select_set(True); vl.objects.active = pr; bpy.ops.object.join()
me = pr.data; mats = [m.name for m in me.materials]
bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table(); bm.verts.ensure_lookup_table()
soft = bm.faces.layers.int.get('soft'); uvl = bm.loops.layers.uv['UVMap']
FOL = mats.index('foliage') if 'foliage' in mats else -1; HED = mats.index('hedge') if 'hedge' in mats else -1; BARK = mats.index('bark') if 'bark' in mats else -1
def islands():
    seen = set(); out = []
    for f in bm.faces:
        if f.index in seen: continue
        st = [f]; comp = []; seen.add(f.index)
        while st:
            g = st.pop(); comp.append(g)
            for v in g.verts:
                for h in v.link_faces:
                    if h.index not in seen: seen.add(h.index); st.append(h)
        out.append(comp)
    return out
ISL = islands(); log('islands', len(ISL))
def verts_of(comp): return list(dict.fromkeys(v for f in comp for v in f.verts))
def tile_uv(faces, s):
    for f in faces:
        n = f.normal; ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            p = l.vert.co; u, v = ((p.y, p.z) if ax == 0 else (p.x, p.z) if ax == 1 else (p.x, p.y)); l[uvl].uv = (u / s, v / s)
# trees: crowns flattened underneath; trunks (bark islands) under them found by position
barks = []
for comp in ISL:
    if all(f.material_index == BARK for f in comp):
        vs = verts_of(comp); P = np.array([v.co[:] for v in vs]); barks.append((vs, P))
from mathutils.bvhtree import BVHTree
_tb = bmesh.new(); _tb.from_mesh(bpy.data.objects['terrain'].data); _tb.transform(bpy.data.objects['terrain'].matrix_world); GROUND = BVHTree.FromBMesh(_tb); _tb.free()
def ground(x, y):
    h = GROUND.ray_cast(Vector((x, y, 1000.0)), Vector((0, 0, -1)), 3000.0); return h[0].z if h[0] is not None else 0.0
crowns = []
for comp in ISL:
    if FOL < 0 or not all(f.material_index == FOL for f in comp): continue
    vs = verts_of(comp)
    if len(vs) not in (12, 42, 162): continue           # icosphere blobs (cones and the proof's pines are left alone)
    P = np.array([v.co[:] for v in vs]); cz = float(P[:, 2].mean()); old_bot = float(P[:, 2].min())
    if old_bot < ground(P[:, 0].mean(), P[:, 1].mean()) + 0.6: continue      # a bush on the ground, not a crown
    crowns.append((comp, vs, P))
    for f in comp: f.smooth = True                     # a soft leaf mass in the light bake, not facets
    if 'pine' in OPT: continue
    for v in vs:
        if v.co.z < cz: v.co.z = cz + (v.co.z - cz) * 0.82
    new_bot = min(v.co.z for v in vs); cx, cy = P[:, 0].mean(), P[:, 1].mean(); rad = float(np.hypot(P[:, 0] - cx, P[:, 1] - cy).max())
    for bvs, BP in barks:           # a trunk or fork ending inside the old underside: carried up into the new one
        top = BP[:, 2].max()
        if old_bot - 0.3 < top < new_bot + 0.15 and np.hypot(BP[:, 0].mean() - cx, BP[:, 1].mean() - cy) < rad * 0.6:
            for v in bvs:
                if v.co.z > top - 0.05: v.co.z = new_bot + 0.25
log('crowns', len(crowns))
# hedges: boxes cut back along the top
nh = 0
if HED >= 0:
    s_h = K.TILE.get('hedge', 2.5); kill = []
    for comp in ISL:
        if not all(f.material_index == HED for f in comp) or len(comp) != 6: continue
        vs = verts_of(comp)
        if len(vs) != 8: continue
        zs = sorted(v.co.z for v in vs); zb, zt = (zs[0] + zs[3]) / 2, (zs[4] + zs[7]) / 2
        if zt - zb < 2.2: continue
        top = sorted(vs, key=lambda v: v.co.z)[4:]; bot = sorted(vs, key=lambda v: v.co.z)[:4]
        c = sum((v.co for v in top), Vector()) / 4
        # the long axis: the longer of the top rectangle's two edge directions
        e = sorted([(top[0].co - t.co) for t in top[1:]], key=lambda d: d.length)
        ax = e[1].copy(); ax.z = 0; ax.normalize(); sd = Vector((-ax.y, ax.x, 0))
        L = max(abs((v.co - c).dot(ax)) for v in vs) * 2; W = max(abs((v.co - c).dot(sd)) for v in vs) * 2; hw = W / 2
        sf = comp[0][soft] if soft is not None else 0
        def at(along, across, z): return c + ax * along + sd * across + Vector((0, 0, z - c.z))
        ends = []
        for a in (-L / 2, L / 2):
            zb_end = min(v.co.z for v in bot if (v.co - c).dot(ax) * a > 0); zt_end = max(v.co.z for v in top if (v.co - c).dot(ax) * a > 0)
            H = zt_end - zb_end; zs_ = zt_end - 0.32 * (H - 0.4)
            ends.append([bm.verts.new(at(a, x, z)) for x, z in ((-hw, zb_end), (hw, zb_end), (hw, zs_), (hw * 0.5, zt_end), (-hw * 0.5, zt_end), (-hw, zs_))])
        A, B = ends; new = [bm.faces.new(A), bm.faces.new(B[::-1])]
        for i in range(1, 6):
            j = (i + 1) % 6; new.append(bm.faces.new((A[i], A[j], B[j], B[i])))
        bmesh.ops.recalc_face_normals(bm, faces=new)
        for f in new:
            f.material_index = HED
            if soft is not None: f[soft] = sf
        tile_uv(new, s_h); kill += comp; nh += 1
    bmesh.ops.delete(bm, geom=list(set(kill)), context='FACES')
log('hedges cut back', nh)
# lone broadleaf trees -> pines (range): five soft 42-vertex blobs round one trunk
if 'pine' in OPT:
    groups = []
    for comp, vs, P in crowns:
        if soft is None or comp[0][soft] != 1: continue
        cx, cy = P[:, 0].mean(), P[:, 1].mean()
        for g in groups:
            if math.hypot(g['x'] - cx, g['y'] - cy) < 3.5: g['m'].append((comp, P)); break
        else: groups.append({'x': cx, 'y': cy, 'm': [(comp, P)]})
    kill = []; s_f = K.TILE.get('foliage', 3.0); npine = 0
    for g in groups:
        if len(g['m']) < 4: continue
        P = np.concatenate([p for _, p in g['m']]); x, y = P[:, 0].mean(), P[:, 1].mean()
        zb, zt = P[:, 2].min(), P[:, 2].max(); s = float(np.hypot(P[:, 0] - x, P[:, 1] - y).max()) / 3.6
        z0 = zb - 0.6; h = (zt + 2.2) - z0; new = []
        for zf, r in ((0.0, 2.5), (0.3, 1.95), (0.56, 1.35)):
            b4 = set(bm.faces)
            bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=7, radius1=r * s, radius2=0.0, depth=h * 0.5, matrix=Matrix.Translation((x, y, z0 + h * zf + h * 0.25)) @ Matrix.Rotation(zf * 2.0, 4, 'Z'))
            new += [f for f in bm.faces if f not in b4]
        for f in new:
            f.material_index = FOL; f[soft] = 1
        tile_uv(new, s_f); kill += [f for comp, _ in g['m'] for f in comp]; npine += 1
        for bvs, BP in barks:         # the two forks (soft bark beams) of this tree go: a pine has a straight trunk
            if np.hypot(BP[:, 0].mean() - x, BP[:, 1].mean() - y) < 2.0 and len(bvs) == 8 and bvs[0].is_valid and bvs[0].link_faces and bvs[0].link_faces[0][soft] == 1:
                kill += list({f for v in bvs for f in v.link_faces})
    bmesh.ops.delete(bm, geom=list(set(kill)), context='FACES'); log('pines', npine)
bm.to_mesh(me); bm.free(); me.update()

# ---------------------------------------------------------------- 5. light picture again, soft split, tanks
lu = me.uv_layers['Lightmap']; me.uv_layers.active = lu; smart_uv(pr, 66, 0.002); me.uv_layers.active = me.uv_layers['UVMap']
drop_tanks()
me.calc_loop_triangles(); log('props (solid + soft)', len(me.loop_triangles), 'triangles')
if 'nobake' not in OPT:
    K.bake(pr, int(pr['hg_lightmap_size']), pr['hg_lightmap'], {'DIRECT', 'INDIRECT'}, int(OPT.get('samples', 32)))
K.split_soft(pr)
TK = build_tanks(bpy.context.scene)
os.makedirs(os.path.join(BASE, '_cache'), exist_ok=True)
with open(os.path.join(BASE, '_cache', ('tanks' if NAME == 'valley' else NAME + '_tanks') + '.json'), 'w') as f: json.dump(TK, f, indent=1)
bpy.ops.wm.save_mainfile(); log('repaint: saved', bpy.data.filepath)
