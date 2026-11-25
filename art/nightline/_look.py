# scratch: driver's-eye renders of quay.blend.  blender -b art/nightline/quay.blend -P art/nightline/_look.py -- 3 100 160 ...  (sample indices)
import bpy, sys, os, json, math
import numpy as np
from mathutils import Vector
A = sys.argv[sys.argv.index('--') + 1:]
idx = [int(a) for a in A if a.lstrip('-').isdigit()]
OPT = dict((a.split('=', 1) + ['1'])[:2] for a in A if '=' in a)
BASE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(BASE, '_look'); os.makedirs(OUT, exist_ok=True)
S = json.load(open(os.path.join(BASE, 'quay.track.json')))['s']; N = len(S)
scene = bpy.context.scene
# self-lit pictures glow in the game (a patch of light): make them emit in this preview only
for name, k in (('nl_sign', 3.2), ('nl_tower', 1.5), ('nl_sky', 1.5)):
    m = bpy.data.materials.get(name)
    if not m: continue
    nt = m.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'); tx = next(n for n in nt.nodes if n.type == 'TEX_IMAGE')
    nt.links.new(tx.outputs['Color'], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = k
scene.render.engine = 'CYCLES'; scene.cycles.samples = int(OPT.get('s', 32)); scene.cycles.device = 'CPU'
try: scene.cycles.use_denoising = True
except Exception: pass
scene.view_settings.view_transform = 'Standard'; scene.view_settings.exposure = float(OPT.get('exp', 0.0))
W, H = 640, 360; scene.render.resolution_x = W; scene.render.resolution_y = H; scene.render.resolution_percentage = 100
cd = bpy.data.cameras.new('c'); cam = bpy.data.objects.new('c', cd); scene.collection.objects.link(cam); scene.camera = cam; cd.angle = math.radians(float(OPT.get('fov', 75)))
ims = []
for i in idx:
    s = S[i % N]; x, y, z = s[0], -s[2], s[1]; tx, ty = s[3], -s[4]
    j = (i + 6) % N; tx2, ty2 = S[j][3], -S[j][4]
    d = float(OPT.get('d', 0.0)); lx, ly = s[4], s[3]
    p = Vector((x + lx * d, y + ly * d, z - d * s[5] + float(OPT.get('h', 1.2)) + 0.1)); look = Vector((x + lx * d + tx * 40 + float(OPT.get('yaw', 0)) * ly * 0, y + ly * d + ty * 40, z + 1.4))
    cam.location = p; cam.rotation_euler = (look - p).to_track_quat('-Z', 'Y').to_euler()
    path = os.path.join(OUT, 'p%03d.png' % i); scene.render.filepath = path; bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(path); ims.append(np.array(im.pixels[:], np.float32).reshape(H, W, 4)); bpy.data.images.remove(im)
    print('LOOK', i, 'mean', float(ims[-1][:, :, :3].mean()), flush=True)
cols = 2; rows = (len(ims) + 1) // 2; sheet = np.zeros((rows * H, cols * W, 4), np.float32); sheet[:, :, 3] = 1
for k, a in enumerate(ims): r, c = divmod(k, cols); sheet[(rows - 1 - r) * H:(rows - r) * H, c * W:(c + 1) * W] = a
im = bpy.data.images.new('sheet', cols * W, rows * H, alpha=False); im.pixels.foreach_set(sheet.ravel()); im.filepath_raw = os.path.join(OUT, OPT.get('name', 'sheet') + '.png'); im.file_format = 'PNG'; im.save()
