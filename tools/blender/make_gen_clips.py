# ASHFALL: motion-library clips put onto OUR zombie skeletons (the range simulator's "animation" and "feet that plant" steps, without Unity).
#   "C:/Program Files/Blender Foundation/Blender 4.5/blender.exe" -b art/ashfall/gen/foe_<id>.blend -P tools/blender/make_gen_clips.py -- clips=walk_m:monsterwalk,die_m:fallback [look=1]
# in:  art/ashfall/gen/foe_<id>.blend     a zombie from tools/blender/make_gen_foe.py (its mesh on OUR skeleton <id>_rig)
#      art/ashfall/gen/anim/<source>.glb  a clip from the generator's motion library, on ITS skeleton (Higgsfield 3d_rigging with enable_animation; any
#                                         character of that generator will do: they all carry the same 24 bones)
# out: an action <id>_<name> for each "name:source" pair, saved in the same .blend. The exporter takes it when the figure's export description names it.
# HOW. A clip is what each bone does to its rest direction. Our skeleton's rest is not the generator's (make_gen_foe lays the limbs along OURS), so for
# every frame and every bone: the turn the source bone has made from ITS rest, less the turn that lies between the two rests, applied to our bone.
# The hips also carry the body's travel, scaled to our figure's size; a clip that walks away (a walk, a run) has that travel taken out, so it walks on
# the spot and the game moves the figure (the clip is then driven by the ground covered: Ashfall/src/js/40-enemies.js, FEET THAT PLANT).
# For each walk the script MEASURES the clip's own pace on our figure (the planted foot's speed under the body, the median over the clip): that number
# is the kind's `walkV` in the game (40-enemies.js). Nothing here needs the internet.
import bpy, sys, os, math, re, json
from mathutils import Vector, Matrix, Quaternion

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OPT = dict((a.split('=', 1) + ['1'])[:2] for a in ARGV)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GEN = os.path.join(ROOT, 'art', 'ashfall', 'gen')
rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE' and o.name.endswith('_rig')); ID = rig.name[:-4]
PAIRS = [p.split(':') for p in OPT.get('clips', '').split(',') if ':' in p]
sc = bpy.context.scene; sc.render.fps = 30
def log(*a): print('[gen_clips]', *a); sys.stdout.flush()
def norm(n): return re.sub(r'[^a-z0-9]', '', n.lower())
def rot3(m): return m.to_3x3().normalized()

OB = {b.name: b for b in rig.data.bones}
RO = {n: rot3(b.matrix_local) for n, b in OB.items()}          # our rest, armature space (the rig stands at the origin, unturned)
HO = {n: b.head_local.copy() for n, b in OB.items()}
side_o = 1 if HO['upperarm_L'].x > 0 else -1
foot_o = OB['foot_L']; face_o = -1.0 if (foot_o.tail_local.y - foot_o.head_local.y) < 0 else 1.0      # which way along y our figure faces
log('figure', ID, 'bones', len(OB), 'faces y%+d' % face_o, 'root', [n for n, b in OB.items() if b.parent is None])

# our figures' skeletons are FLAT (no bone has a parent: every clip says where each bone is as well as how it is turned), so the body's
# own order is written here: what hangs on what
EXTRA = {'rebar': 'forearm_R', 'door': 'chest', 'hammer': 'hand_R', 'spines': 'chest', 'sac': 'spine', 'jaw': 'head', 'tongue': 'head', 'gun': 'hand_R'}
def lparent(b):
    if b == 'hips': return None
    t = {'spine': 'hips', 'chest': 'spine', 'neck': 'chest', 'head': 'neck'}.get(b)
    if t is None and b[-2:] in ('_L', '_R'):
        t = {'upperarm_': 'chest', 'forearm_': 'upperarm_' + b[-1], 'hand_': 'forearm_' + b[-1], 'thigh_': 'hips', 'shin_': 'thigh_' + b[-1], 'foot_': 'shin_' + b[-1]}.get(b[:-1])
    if t is None: t = EXTRA.get(b) or min((n for n in OB if n != b and n in ('hips', 'spine', 'chest', 'head')), key=lambda n: (HO[n] - HO[b]).length)
    while t and t not in OB: t = lparent(t) if t != 'hips' else None
    return t
def depth(b):
    k = 0
    while lparent(b): b = lparent(b); k += 1
    return k
def roles(arm, Wp):
    """the source rig's bones by what they are (the same reading as make_gen_foe.py)"""
    NB = {b.name: norm(b.name) for b in arm.data.bones}
    def side(n): return 'L' if (Wp @ arm.data.bones[n].head_local).x * side_o > 0 else 'R'
    R = {}
    for n, k in NB.items():
        if k in ('hips', 'pelvis'): R[n] = 'hips'
        elif 'upleg' in k or 'thigh' in k: R[n] = 'thigh_' + side(n)
        elif 'toe' in k: R[n] = 'toe_' + side(n)
        elif 'foot' in k: R[n] = 'foot_' + side(n)
        elif 'leg' in k or 'calf' in k or 'shin' in k: R[n] = 'shin_' + side(n)
        elif 'forearm' in k or 'lowerarm' in k: R[n] = 'forearm_' + side(n)
        elif 'shoulder' in k or 'clavicle' in k: R[n] = 'shoulder_' + side(n)
        elif 'hand' in k: R[n] = 'hand_' + side(n)
        elif 'arm' in k: R[n] = 'upperarm_' + side(n)
        elif 'neck' in k: R[n] = 'neck'
        elif 'head' in k: R[n] = 'head'
        elif 'spine' in k or 'chest' in k: R[n] = 'spine'
    BY = {}
    for n, r in R.items():
        if r == 'spine': continue
        if r not in BY or len(arm.data.bones[n].parent_recursive) < len(arm.data.bones[BY[r]].parent_recursive): BY[r] = n
    sp = sorted([n for n, r in R.items() if r == 'spine'], key=lambda n: (Wp @ arm.data.bones[n].head_local).z)
    if sp: BY['spine'] = sp[0]
    if len(sp) > 1: BY['chest'] = sp[-1]
    return BY

def retarget(name, src):
    path = os.path.join(GEN, 'anim', src + '.glb'); before = set(bpy.data.objects); acts0 = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]; arm = next(o for o in new if o.type == 'ARMATURE')
    act = arm.animation_data.action if arm.animation_data and arm.animation_data.action else next(a for a in bpy.data.actions if a not in acts0)
    if arm.animation_data is None: arm.animation_data_create()
    arm.animation_data.action = act
    bpy.context.view_layer.update()
    # the source in OUR frame: its object's own turn and size, and half a turn more if it faces the other way
    W = arm.matrix_world.copy(); BYs = None
    toes = [b for b in arm.data.bones if 'toe' in norm(b.name)]; feet = [b for b in arm.data.bones if 'foot' in norm(b.name)]
    fy = (sum((W @ b.head_local).y for b in toes) / len(toes) - sum((W @ b.head_local).y for b in feet) / len(feet)) if toes and feet else -1.0
    F = Matrix.Rotation(math.pi, 4, 'Z') if fy * face_o < 0 else Matrix.Identity(4)
    Wp = F @ W; W3 = rot3(Wp); BY = roles(arm, Wp)
    need = [r for r in OB if r in BY or r in ('hips',)]
    def sj(r): return Wp @ arm.data.bones[BY[r]].head_local
    # the turn between the two rests, limb by limb (as make_gen_foe laid them: the upper part first, then the lower part on top of it)
    Q = {r: Quaternion() for r in OB}
    if 'neck' in BY and 'neck' in OB:      # the trunk first, then the head on it (make_gen_foe's order)
        q0 = (sj('neck') - sj('hips')).normalized().rotation_difference((HO['neck'] - HO['hips']).normalized())
        qn = (q0 @ (sj('head') - sj('neck')).normalized()).rotation_difference((HO['head'] - HO['neck']).normalized())
        for r in OB: Q[r] = q0.copy()
        Q['neck'] = qn @ q0; Q['head'] = qn @ q0
    else: q0 = Quaternion()
    for up, lo, end in (('upperarm_', 'forearm_', 'hand_'), ('thigh_', 'shin_', 'foot_')):
        for s in 'LR':
            if not all((p + s) in BY and (p + s) in OB for p in (up, lo, end)): continue
            q1 = (q0 @ (sj(lo + s) - sj(up + s)).normalized()).rotation_difference((HO[lo + s] - HO[up + s]).normalized()) @ q0
            d2 = q1 @ (sj(end + s) - sj(lo + s)).normalized(); q2 = d2.rotation_difference((HO[end + s] - HO[lo + s]).normalized())
            Q[up + s] = q1; Q[lo + s] = q2 @ q1; Q[end + s] = q2 @ q1
    RS = {r: W3 @ rot3(arm.data.bones[n].matrix_local) for r, n in BY.items()}
    f0, f1 = int(round(act.frame_range[0])), int(round(act.frame_range[1])); n = f1 - f0 + 1
    hips_src_rest = sj('hips'); k = HO['hips'].z / max(hips_src_rest.z, 1e-3)
    frames = []
    for f in range(f0, f1 + 1):
        sc.frame_set(f); P = {}
        for r, bn in BY.items():
            if r not in OB: continue
            D = (W3 @ rot3(arm.pose.bones[bn].matrix)) @ RS[r].inverted()
            P[r] = D @ Q[r].inverted().to_matrix() @ RO[r]
        hp = (Wp @ arm.pose.bones[BY['hips']].head) - hips_src_rest
        frames.append((P, hp * k))
    # travel: a clip that walks away is made to walk on the spot (the straight-line part of the hips' way over the ground is taken out)
    d0, d1 = frames[0][1], frames[-1][1]; travel = Vector((d1.x - d0.x, d1.y - d0.y, 0)); inplace = name.startswith('walk') or name.startswith('run')      # a fall keeps its travel
    new_name = '%s_%s' % (ID, name); old = bpy.data.actions.get(new_name)
    if old: bpy.data.actions.remove(old)
    A = bpy.data.actions.new(new_name); A.use_fake_user = True
    if rig.animation_data is None: rig.animation_data_create()
    rig.animation_data.action = A
    order = sorted(OB, key=depth); prev = {}
    for i, (P, hp) in enumerate(frames):
        full = {}
        d = hp.copy()
        if inplace: t = i / max(1, n - 1); d.x -= d0.x + travel.x * t; d.y -= d0.y + travel.y * t
        pos = {}
        for b in order:
            par = lparent(b)
            if b in P: full[b] = P[b]
            elif par: full[b] = full[par] @ (RO[par].inverted() @ RO[b])          # a bone the source has not got rides with its parent
            else: full[b] = RO[b]
            pos[b] = (HO[b] + d) if not par else pos[par] + (full[par] @ RO[par].inverted()) @ (HO[b] - HO[par])
        for b in order:
            pb = rig.pose.bones[b]; par = OB[b].parent.name if OB[b].parent else None
            basis = (RO[b].inverted() @ full[b]) if not par else ((RO[par].inverted() @ RO[b]).inverted() @ (full[par].inverted() @ full[b]))
            if not par: pb.location = RO[b].inverted() @ (pos[b] - HO[b]); pb.keyframe_insert('location', frame=i)      # our figures' bones hang on nothing: each is told where it is
            if pb.rotation_mode == 'QUATERNION':
                q = basis.to_quaternion()
                if b in prev and prev[b].dot(q) < 0: q.negate()
                pb.rotation_quaternion = q; prev[b] = q.copy(); pb.keyframe_insert('rotation_quaternion', frame=i)
            else:
                e = basis.to_euler(pb.rotation_mode, prev[b]) if b in prev else basis.to_euler(pb.rotation_mode)
                pb.rotation_euler = e; prev[b] = e.copy(); pb.keyframe_insert('rotation_euler', frame=i)
    for o in new:
        if o.name in bpy.data.objects: bpy.data.objects.remove(o, do_unlink=True)
    for a in list(bpy.data.actions):
        if a not in acts0 and a is not A: bpy.data.actions.remove(a)
    # the clip's own pace on our figure: the planted (lower) foot's speed under the body
    pace = None
    if inplace:
        pts = []
        for i in range(n):
            sc.frame_set(i); bpy.context.view_layer.update(); pts.append((rig.pose.bones['foot_L'].head.copy(), rig.pose.bones['foot_R'].head.copy()))
        # only the frames where a foot is really ON the ground (within 3 cm of the lowest it ever gets): a run has frames with both feet
        # in the air, and a swinging foot moves the other way; the median of the planted foot's backward speed is the clip's pace
        lowz = [min(p[j].z for p in pts) for j in (0, 1)]; v = []
        for i in range(1, n):
            a, b = pts[i - 1], pts[i]
            for j in (0, 1):
                if a[j].z < lowz[j] + 0.03 and b[j].z < lowz[j] + 0.03: v.append(abs(b[j].y - a[j].y) * sc.render.fps)
        v.sort(); pace = v[len(v) // 2] if v else None
        if travel.length > 0.25: log('   (its own travel was %.2f m/s)' % (travel.length / (n / 30.0)))
    log('%-10s <- %-14s %3d frames (%.2f s)%s%s' % (name, src, n, n / 30.0, '  walks on the spot now (it travelled %.2f m)' % travel.length if inplace else '', '  PACE %.2f m/s' % pace if pace else ''))
    return A, n, pace

made = [(nm, retarget(nm, src)) for nm, src in PAIRS]
rig.animation_data.action = None
for pb in rig.pose.bones: pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0)

# ---------------------------------------------------------------- pictures to look at: each clip at five moments, side by side (look=1)
if OPT.get('look') and made:
    try: sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.light = 'FLAT'; sc.display.shading.color_type = 'TEXTURE'
    except Exception: pass
    sc.render.resolution_x = 300; sc.render.resolution_y = 460
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 55
    eye = Vector((2.9 * 0.7, face_o * 2.9, 1.15)); cam.location = eye; cam.rotation_euler = (Vector((0, 0, 0.9)) - eye).to_track_quat('-Z', 'Y').to_euler()
    for o in bpy.data.objects:
        if o.name.endswith('_lod1') or o.name.endswith('_lod2'): o.hide_render = True
    os.makedirs(os.path.join(ROOT, 'art', 'mockups', 'genclip'), exist_ok=True)
    for nm, (A, n, pace) in made:
        rig.animation_data.action = A
        for j, t in enumerate((0.0, 0.25, 0.5, 0.75, 0.97)):
            sc.frame_set(int(round(t * (n - 1)))); sc.render.filepath = os.path.join(ROOT, 'art', 'mockups', 'genclip', '%s-%s-%d.png' % (ID, nm, j)); bpy.ops.render.render(write_still=True)
    rig.animation_data.action = None
    for o in bpy.data.objects: o.hide_render = False
    bpy.data.objects.remove(cam, do_unlink=True)
bpy.ops.wm.save_mainfile()
log('saved', bpy.data.filepath, '| clips:', json.dumps({nm: {'frames': n, 'pace': round(p, 2) if p else None} for nm, (A, n, p) in made}))
