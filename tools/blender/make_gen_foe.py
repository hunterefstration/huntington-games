# ASHFALL: a zombie from a GENERATED model (the range simulator's pipeline: a reference picture -> image-to-3D with a rig -> Blender -> the game).
#   "C:/Program Files/Blender Foundation/Blender 4.5/blender.exe" -b --factory-startup -P tools/blender/make_gen_foe.py -- id=walker [glb=...] [tris=4200,1234,410] [tex=1024] [wide=1.1] [deep=1.04] [look=1]
#   then  node tools/export-art.mjs foe_walker      (ALWAYS by name)
# in:  art/ashfall/gen/foe_<id>.glb   the generated model (Higgsfield image_to_3d: textured, rigged, A-pose)
#      art/ashfall/figures.blend      OUR figure of that kind: its rig <id>_rig and its clips <id>_idle / _walk / _attack / _die / ...
# out: art/ashfall/gen/foe_<id>.blend and art/ashfall/foe_<id>.export.json pointing at it (the scripted figure's description is kept in art/ashfall/_cache/).
# WHAT IT DOES. The game's clips, their speeds and the timing of every attack belong to OUR skeleton, so the generated body is put on it:
#   1. the model is scaled to our figure's height, stood on the ground and turned to face the way ours does;
#   2. its own rig bends its arms and legs until they lie along OUR skeleton's limbs (both stand in an A-pose, so this is a few degrees), and the
#      mesh is frozen like that;
#   3. our skeleton's joints are moved to where the model's joints are (each bone keeps its direction and roll, so every clip still means the same);
#   4. the model's skin weights are handed to our bones (its shoulder to our chest, its toes to our foot, its fingers to our hand ...);
#   5. three levels of detail are cut from it (the triangle counts of the figure it replaces), with one picture, matte, no glow.
# The generated rig is then thrown away. Nothing here needs the internet.
import bpy, sys, os, json, math, re
from mathutils import Vector, Matrix

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OPT = dict((a.split('=', 1) + ['1'])[:2] for a in ARGV)
ID = OPT['id']
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ART = os.path.join(ROOT, 'art', 'ashfall'); GEN = os.path.join(ART, 'gen')
GLB = OPT.get('glb') or os.path.join(GEN, 'foe_%s.glb' % ID)
FIG = os.path.join(ART, 'figures.blend')
TEX = int(OPT.get('tex', 1024))
def log(*a): print('[gen_foe]', *a); sys.stdout.flush()

# ---------------------------------------------------------------- an empty file, then OUR rig, OUR clips, and the figure being replaced (for its size)
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
with bpy.data.libraries.load(FIG, link=False) as (src, dst):
    dst.objects = [n for n in src.objects if n in (ID + '_rig', ID, ID + '_lod1', ID + '_lod2')]
    dst.actions = [n for n in src.actions if n.startswith(ID + '_')]
col = bpy.context.scene.collection
for o in bpy.data.objects:
    if o.name not in col.objects: col.objects.link(o)
for a in bpy.data.actions: a.use_fake_user = True
rig = bpy.data.objects[ID + '_rig']; ref = bpy.data.objects[ID]
def tris_of(o): return sum(len(p.vertices) - 2 for p in o.data.polygons)
def bbox(o):
    c = [o.matrix_world @ Vector(v) for v in o.bound_box]
    return Vector((min(v.x for v in c), min(v.y for v in c), min(v.z for v in c))), Vector((max(v.x for v in c), max(v.y for v in c), max(v.z for v in c)))
bpy.context.view_layer.update()
H_REF = bbox(ref)[1].z - bbox(ref)[0].z
TRIS = [int(v) for v in OPT['tris'].split(',')] if 'tris' in OPT else [tris_of(ref)] + [tris_of(bpy.data.objects[ID + s]) for s in ('_lod1', '_lod2') if bpy.data.objects.get(ID + s)]
log('our figure', ID, 'height %.3f' % H_REF, 'triangles', TRIS, 'bones', len(rig.data.bones), 'clips', sorted(a.name for a in bpy.data.actions))
for n in (ID, ID + '_lod1', ID + '_lod2'):
    o = bpy.data.objects.get(n)
    if o: bpy.data.objects.remove(o, do_unlink=True)
OURS = {b.name: (rig.matrix_world @ b.head_local).copy() for b in rig.data.bones}

# ---------------------------------------------------------------- the generated model
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=GLB)
new = [o for o in bpy.data.objects if o not in before]
arm = next(o for o in new if o.type == 'ARMATURE')
meshes = [o for o in new if o.type == 'MESH' and len(o.vertex_groups) > 0 and not o.name.lower().startswith('icosphere')]
log('glb:', [(o.name, o.type) for o in new], 'skinned meshes', [m.name for m in meshes], 'bones', [b.name for b in arm.data.bones])
def only(*obs):
    for o in bpy.context.view_layer.objects: o.select_set(False)
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
only(*meshes)
if len(meshes) > 1: bpy.ops.object.join()
mesh = bpy.context.view_layer.objects.active
for o in new:      # the importer's bone-display spheres and empties go
    if o is not arm and o is not mesh and o.name in bpy.data.objects and o.type == 'MESH': bpy.data.objects.remove(o, do_unlink=True)
# out of whatever hierarchy it came in, keeping where it is; then size, ground and facing, and all of that baked into both
for o in (arm, mesh):
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
bpy.context.view_layer.update()
def _n(n): return re.sub(r'[^a-z0-9]', '', n.lower())
def _wj(b): return arm.matrix_world @ b.head_local
def _src_len():
    B = arm.data.bones; hips = next((b for b in B if _n(b.name) in ('hips', 'pelvis')), B[0]); head = next(b for b in B if _n(b.name) == 'head')
    legs = []
    for t in B:
        k = _n(t.name)
        if ('upleg' in k or 'thigh' in k) and t.children and t.children[0].children:
            c = t.children[0]; legs.append((_wj(c) - _wj(t)).length + (_wj(c.children[0]) - _wj(c)).length)
    return (_wj(head) - _wj(hips)).length + sum(legs) / max(1, len(legs))
def _our_len():
    ch = [n for n in ('hips', 'spine', 'chest', 'neck', 'head') if n in OURS]
    return sum((OURS[b] - OURS[a]).length for a, b in zip(ch, ch[1:])) + (OURS['shin_L'] - OURS['thigh_L']).length + (OURS['foot_L'] - OURS['shin_L']).length
# fit=height (the default): as tall as our figure stands. fit=parts: by the length of trunk and leg, for our figures that rest bent
# over or on all fours (the Leaper, the Crawler), whose standing height says nothing about their size.
FIT = OPT.get('fit') or ('parts' if ID in ('leaper', 'mite') else 'height')
lo, hi = bbox(mesh); s = _our_len() / _src_len() if FIT == 'parts' else H_REF / (hi.z - lo.z)
S = Matrix.Scale(s, 4)
for o in (arm, mesh): o.matrix_world = S @ o.matrix_world
bpy.context.view_layer.update()
def gj(name): return arm.matrix_world @ arm.data.bones[name].head_local
def norm(n): return re.sub(r'[^a-z0-9]', '', n.lower())
NB = {b.name: norm(b.name) for b in arm.data.bones}
def find(pred): return [n for n, k in NB.items() if pred(k)]
hips_g = (find(lambda k: k in ('hips', 'pelvis')) or [arm.data.bones[0].name])[0]
# facing: the toes point the way the body faces
def facing_y(joint, a, b): return joint(b).y - joint(a).y
feet_g = find(lambda k: 'foot' in k); toes_g = find(lambda k: 'toe' in k)
fy_g = sum(gj(t).y for t in toes_g) / max(1, len(toes_g)) - sum(gj(f).y for f in feet_g) / max(1, len(feet_g)) if toes_g and feet_g else -1.0
foot_o = next(b for b in rig.data.bones if b.name.startswith('foot'))
fy_o = (rig.matrix_world @ foot_o.tail_local).y - (rig.matrix_world @ foot_o.head_local).y
if fy_g * fy_o < 0:
    Rz = Matrix.Rotation(math.pi, 4, 'Z')
    for o in (arm, mesh): o.matrix_world = Rz @ o.matrix_world
    log('turned round to face the way our figure does')
bpy.context.view_layer.update()
lo, hi = bbox(mesh); hp = gj(hips_g); T = Matrix.Translation(Vector((OURS['hips'].x - hp.x, OURS['hips'].y - hp.y, -lo.z)))
for o in (arm, mesh): o.matrix_world = T @ o.matrix_world
# a little broader than the generator makes them (the owner on the first one: "just stretch his body out horizontally a little bit"):
# seen from a first-person camera a true-to-life figure reads thin. wide = across the shoulders, deep = front to back, about the hips.
WIDE = float(OPT.get('wide', 1.1)); DEEP = float(OPT.get('deep', 1.04))
St = Matrix.Translation(Vector((OURS['hips'].x, OURS['hips'].y, 0))) @ Matrix.Diagonal((WIDE, DEEP, 1.0, 1.0)) @ Matrix.Translation(Vector((-OURS['hips'].x, -OURS['hips'].y, 0)))
for o in (arm, mesh): o.matrix_world = St @ o.matrix_world
for o in (arm, mesh):
    only(o); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.context.view_layer.update()
lo, hi = bbox(mesh); log('scaled x%.4f (fit=%s): now %.3f tall standing (our figure stands %.3f as it rests), %d triangles' % (s, FIT, hi.z - lo.z, H_REF, tris_of(mesh)))

# ---------------------------------------------------------------- which of its bones is which of ours
side_o = 1 if OURS['upperarm_L'].x > 0 else -1          # the sign of x on OUR left
def side(n): return 'L' if gj(n).x * side_o > 0 else 'R'
ROLE = {}
for n, k in NB.items():
    if n == hips_g: ROLE[n] = 'hips'
    elif 'upleg' in k or 'thigh' in k: ROLE[n] = 'thigh_' + side(n)
    elif 'toe' in k: ROLE[n] = 'toe_' + side(n)
    elif 'foot' in k: ROLE[n] = 'foot_' + side(n)
    elif 'leg' in k or 'calf' in k or 'shin' in k: ROLE[n] = 'shin_' + side(n)
    elif 'forearm' in k or 'lowerarm' in k: ROLE[n] = 'forearm_' + side(n)
    elif 'shoulder' in k or 'clavicle' in k: ROLE[n] = 'shoulder_' + side(n)
    elif 'hand' in k: ROLE[n] = 'hand_' + side(n)
    elif 'arm' in k: ROLE[n] = 'upperarm_' + side(n)
    elif 'neck' in k: ROLE[n] = 'neck'
    elif 'head' in k: ROLE[n] = 'head'
    elif 'spine' in k or 'chest' in k: ROLE[n] = 'spine'
BY = {}
for n, r in ROLE.items():
    if r not in BY or len(arm.data.bones[n].parent_recursive) < len(arm.data.bones[BY[r]].parent_recursive): BY[r] = n      # the first of a name down the chain (Head before head_end)
log('roles:', {r: n for r, n in sorted(BY.items())})
need = ['hips', 'neck', 'head'] + [p + s2 for p in ('upperarm_', 'forearm_', 'hand_', 'thigh_', 'shin_', 'foot_') for s2 in 'LR']
miss = [r for r in need if r not in BY]
if miss: raise SystemExit('[gen_foe] the generated rig has no bone for: %s' % miss)

# ---------------------------------------------------------------- 2. its limbs along ours, and the mesh frozen so
CH = [('upperarm_', 'forearm_'), ('forearm_', 'hand_'), ('thigh_', 'shin_'), ('shin_', 'foot_')]
def pj(name): return arm.matrix_world @ arm.pose.bones[name].head
def turn(pa, cur, want):
    q = cur.rotation_difference(want); h = pa.head.copy(); pa.matrix = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ pa.matrix
    bpy.context.view_layer.update(); return math.degrees(q.angle)
worst = turn(arm.pose.bones[BY['hips']], (pj(BY['neck']) - pj(BY['hips'])).normalized(), (OURS['neck'] - OURS['hips']).normalized())      # the trunk (a figure of ours that rests bent over or on all fours)
worst = max(worst, turn(arm.pose.bones[BY['neck']], (pj(BY['head']) - pj(BY['neck'])).normalized(), (OURS['head'] - OURS['neck']).normalized()))
for a, b in CH:
    for s2 in 'LR':
        pa, pb = arm.pose.bones[BY[a + s2]], arm.pose.bones[BY[b + s2]]
        cur = (pj(BY[b + s2]) - pj(BY[a + s2])).normalized(); want = (OURS[b + s2] - OURS[a + s2]).normalized()
        q = cur.rotation_difference(want); worst = max(worst, math.degrees(q.angle))
        h = pa.head.copy(); pa.matrix = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ pa.matrix
        bpy.context.view_layer.update()
log('limbs laid along ours: the largest turn was %.1f degrees' % worst)
JG = {r: pj(n).copy() for r, n in BY.items()}
only(mesh)
for m in list(mesh.modifiers):
    if m.type == 'ARMATURE': bpy.ops.object.modifier_apply(modifier=m.name)
    else: mesh.modifiers.remove(m)
lo, hi = bbox(mesh)
SH = Vector((OURS['hips'].x - JG['hips'].x, OURS['hips'].y - JG['hips'].y, -lo.z))          # on the ground, its hips over ours
mesh.location += SH; only(mesh); bpy.ops.object.transform_apply(location=True); [JG.__setitem__(r, v + SH) for r, v in list(JG.items())]

# ---------------------------------------------------------------- 3. our joints to where its joints are (direction and roll kept: the clips mean the same)
SPINE = sorted([n for n, r in ROLE.items() if r == 'spine'], key=lambda n: gj(n).z)
only(rig); bpy.ops.object.mode_set(mode='EDIT'); EB = rig.data.edit_bones
old = {b.name: (b.head.copy(), b.tail.copy()) for b in EB}
for b in EB: b.use_connect = False
target = {r: JG[r] for r in need}
if 'spine' in OURS and SPINE: target['spine'] = pj(SPINE[0]).copy() + SH
if 'chest' in OURS and len(SPINE) > 1: target['chest'] = pj(SPINE[-1]).copy() + SH
NEXT = {'upperarm_': 'forearm_', 'forearm_': 'hand_', 'thigh_': 'shin_', 'shin_': 'foot_'}
def order(b): return len(b.parent_recursive)
moved = {}
for b in sorted(EB, key=order):
    h0, t0 = old[b.name]; d = (t0 - h0); L = d.length; d.normalize()
    if b.name in target: h = target[b.name].copy()
    elif b.parent and b.parent.name in moved: h = h0 + moved[b.parent.name]          # what we have and it has not (a jaw, a carried thing): rides with its parent
    else: h = h0.copy()
    for pre, nx in NEXT.items():
        if b.name.startswith(pre) and (nx + b.name[-1]) in target: L = (target[nx + b.name[-1]] - h).length
    b.head = h; b.tail = h + d * max(L, 0.02); moved[b.name] = h - h0
bpy.ops.object.mode_set(mode='OBJECT')
log('our skeleton fitted: joints moved by up to %.3f m' % max(v.length for v in moved.values()))

# ---------------------------------------------------------------- 4. its skin weights to our bones
ours_names = set(b.name for b in rig.data.bones)
def to_ours(n):
    b = arm.data.bones.get(n)
    while b is not None:
        r = ROLE.get(b.name)
        if r:
            if r.startswith('toe_'): r = 'foot_' + r[-1]
            if r.startswith('shoulder_'): r = 'chest' if 'chest' in ours_names else 'spine'
            if r == 'spine':
                r = 'chest' if ('chest' in ours_names and len(SPINE) > 1 and b.name != SPINE[0]) else 'spine'
            if r in ours_names: return r
        b = b.parent
    return 'hips'
gmap = {g.index: to_ours(g.name) for g in mesh.vertex_groups}
W = [dict() for _ in mesh.data.vertices]
for v in mesh.data.vertices:
    for ge in v.groups:
        if ge.weight > 1e-4: W[v.index][gmap[ge.group]] = W[v.index].get(gmap[ge.group], 0.0) + ge.weight
for g in list(mesh.vertex_groups): mesh.vertex_groups.remove(g)
VG = {}
for i, w in enumerate(W):
    if not w: w = {'hips': 1.0}
    top = sorted(w.items(), key=lambda kv: -kv[1])[:4]; tot = sum(x for _, x in top)
    for name, x in top:
        g = VG.get(name) or VG.setdefault(name, mesh.vertex_groups.new(name=name))
        g.add([i], x / tot, 'REPLACE')
log('weights handed over to', sorted(VG))
bpy.data.objects.remove(arm, do_unlink=True)
for a in list(bpy.data.actions):          # the clip the generated file came with is not ours
    if not a.name.startswith(ID + '_'): bpy.data.actions.remove(a)

# ---------------------------------------------------------------- 5. one picture, matte, no glow; three levels of detail
img = None
for m in mesh.data.materials:
    if not m or not m.use_nodes: continue
    bs = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bs and bs.inputs['Base Color'].is_linked:
        n = bs.inputs['Base Color'].links[0].from_node
        while n.type != 'TEX_IMAGE' and any(i.is_linked for i in n.inputs): n = next(i for i in n.inputs if i.is_linked).links[0].from_node
        if n.type == 'TEX_IMAGE' and n.image: img = n.image; break
if img is None: raise SystemExit('[gen_foe] the model has no colour picture')
os.makedirs(os.path.join(GEN, 'tex'), exist_ok=True)
log('picture', img.name, tuple(img.size), '->', TEX)
if max(img.size) > TEX: img.scale(TEX, TEX)
img.name = ID; img.filepath_raw = os.path.join(GEN, 'tex', 'foe_%s.png' % ID); img.file_format = 'PNG'; img.save()
mat = bpy.data.materials.new(ID); mat.use_nodes = True; nt = mat.node_tree
bs = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'); ti = nt.nodes.new('ShaderNodeTexImage'); ti.image = img
nt.links.new(ti.outputs['Color'], bs.inputs['Base Color']); bs.inputs['Roughness'].default_value = 0.85; bs.inputs['Metallic'].default_value = 0.0
for nm in ('Emission Strength',):
    if nm in bs.inputs: bs.inputs[nm].default_value = 0.0
mesh.data.materials.clear(); mesh.data.materials.append(mat)
for p in mesh.data.polygons: p.material_index = 0; p.use_smooth = True
# keep only the first UV layer, named as ours is
while len(mesh.data.uv_layers) > 1: mesh.data.uv_layers.remove(mesh.data.uv_layers[-1])
mesh.data.uv_layers[0].name = 'UVMap'
names = [ID, ID + '_lod1', ID + '_lod2'][:len(TRIS)]; full = tris_of(mesh); made = []
for nm, want in zip(names, TRIS):
    o = mesh.copy(); o.data = mesh.data.copy(); o.name = nm; o.data.name = nm; col.objects.link(o); only(o)
    if want < full:
        d = o.modifiers.new('dec', 'DECIMATE'); d.decimate_type = 'COLLAPSE'; d.ratio = want / full; d.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=d.name)
    o.parent = rig; a = o.modifiers.new('Armature', 'ARMATURE'); a.object = rig; made.append((nm, tris_of(o)))
bpy.data.objects.remove(mesh, do_unlink=True)
log('levels of detail:', made)

# ---------------------------------------------------------------- pictures to look at (look=1): the rest pose, and the middle of each clip
if OPT.get('look'):
    sc = bpy.context.scene; sc.render.engine = 'BLENDER_WORKBENCH' if 'BLENDER_WORKBENCH' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else sc.render.engine
    try: sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'TEXTURE'
    except Exception: pass
    sc.render.resolution_x = 420; sc.render.resolution_y = 620; sc.render.film_transparent = False
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); col.objects.link(cam); sc.camera = cam; cam.data.lens = 60
    for o in bpy.data.objects:
        if o.name in (ID + '_lod1', ID + '_lod2'): o.hide_render = True
    if not rig.animation_data: rig.animation_data_create()
    shots = [('rest', None, 0, (2.2, -3.4, 1.3))] + [(a.name[len(ID) + 1:], a, 0.5, (2.6, -3.2, 1.2)) for a in sorted(bpy.data.actions, key=lambda a: a.name)]
    for nm, act, at, eye in shots:
        rig.animation_data.action = act
        if act: sc.frame_set(int(act.frame_range[0] + (act.frame_range[1] - act.frame_range[0]) * at))
        cam.location = eye; d = Vector((0, 0, 0.9)) - Vector(eye); cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(ROOT, 'art', 'mockups', 'gen-%s-%s.png' % (ID, nm)); bpy.ops.render.render(write_still=True)
    rig.animation_data.action = None
    for o in bpy.data.objects: o.hide_render = False
    bpy.data.objects.remove(cam, do_unlink=True)

# ---------------------------------------------------------------- the file, and the description the exporter reads
out = os.path.join(GEN, 'foe_%s.blend' % ID); bpy.ops.wm.save_as_mainfile(filepath=out)
desc_p = os.path.join(ART, 'foe_%s.export.json' % ID)
desc = json.load(open(desc_p)); keep = os.path.join(ART, '_cache', 'foe_%s.export.scripted.json' % ID)
if desc.get('blend') != 'gen/foe_%s.blend' % ID:
    os.makedirs(os.path.dirname(keep), exist_ok=True)
    if not os.path.exists(keep): json.dump(desc, open(keep, 'w'), indent=1)
    desc['blend'] = 'gen/foe_%s.blend' % ID; json.dump(desc, open(desc_p, 'w'), indent=1)
log('saved', out, '| next: node tools/export-art.mjs foe_' + ID)
