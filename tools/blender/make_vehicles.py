# Steel Storm Remastered: six more ground vehicles, each exported to its own small file, in art/steelstorm/vehicles.blend.
#   blender -b art/steelstorm/vehicles.blend -P tools/blender/make_vehicles.py -- [only=td,spaa] [preview]   (first time: --factory-startup)
# then  node tools/export-art.mjs v_td v_spaa v_arty v_apc v_truck v_atgun  ->  Steel Storm Remastered/assets/v_<id>.hgm
# Same style, part layout and naming as the valley's light and heavy tanks (tools/blender/make_valley.py, whose texturing and track
# helpers are copied here): <id>_hull > <id>_turret > <id>_barrel, each with a _lod1 twin; forward -Y; hull origin on the ground
# under its centre, turret origin on its pivot, barrel origin on the trunnion; neutral grey-green paint. The truck has a hull only.
# The file is this script's own: every run rebuilds the vehicles it builds (and keeps the others).
import bpy, bmesh, math, os, sys, json, random
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hgkit import *

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OPT = dict((a.split('=', 1) + ['1'])[:2] for a in ARGV)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = os.path.join(ROOT, 'art', 'steelstorm'); TEXDIR = os.path.join(BASE, 'tex'); CACHE = os.path.join(BASE, '_cache')
for d in (TEXDIR, CACHE): os.makedirs(d, exist_ok=True)
scene = bpy.context.scene
if not bpy.data.filepath.replace('\\', '/').endswith('art/steelstorm/vehicles.blend'):
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    scene.render.fps = 30; bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, 'vehicles.blend')); log('created', bpy.data.filepath)
TEXN_V = {'truck': 512, 'atgun': 512}

# ---------------------------------------------------------------- the shared tank kit (picture, wheels, tracks, paint + _gear materials)
from ss_tanks import tank_texture, wheel, track_side, wheel_x, gun_tube, bore_disc, exhaust, make_tank

# ---------------------------------------------------------------- the vehicles (metres, forward -Y)
def model_td():
    k = Kit(2)
    k.prism([(-3.3, 0.45), (-3.45, 0.8), (3.2, 0.8), (3.35, 0.45)], -1.1, 1.1, 'olive', bev=0.04)
    k.prism([(-3.45, 0.8), (-2.2, 1.95), (1.8, 1.95), (3.3, 1.55), (3.35, 0.8)], -1.45, 1.45, 'olive', bev=0.04)
    k.box((0, -0.5, 1.95), (2.6, 3.4, 0.06), 'olive', bev=0.01); k.box((0, 2.5, 1.62), (2.2, 1.2, 0.04), 'dark', bev=0.0)
    for sx in (-1, 1):
        track_side(k, sx, 1.1, 1.62, -3.4, 3.3, 0.08, 1.0, 6, 0.38)
        for i in range(4): k.box((sx * 1.66, -2.4 + i * 1.6, 0.95), (0.05, 1.55, 0.7), 'olive', bev=0.01)
    k.lathe([(0.0, 0.0), (0.3, 0.0), (0.3, 0.12), (0.0, 0.13)], T(0.7, 0.3, 1.95) @ Rx(90), 14, 'olive')
    for sx in (-1, 1): exhaust(k, sx * 0.7, 3.32, 1.2, 0.07, 0.28)
    TP = Vector((0, -2.3, 1.45))
    k.lathe([(0.0, -0.05), (0.42, -0.05), (0.48, 0.1), (0.48, 0.3), (0.0, 0.32)], T(0, -2.45, 1.45) @ Rz(180), 16, 'olive', 'mag')
    TR = Vector((0, -2.6, 1.45))
    gun_tube(k, [(0.14, -2.6), (0.14, -3.2), (0.095, -3.3), (0.095, -6.6), (0.13, -6.65), (0.13, -6.95), (0.06, -6.95), (0.06, -2.6)], T(0, 0, 1.45), 16, r_in=0.06)
    for sx in (-1, 1): k.box((sx * 0.13, -6.8, 1.45), (0.02, 0.12, 0.16), 'dark', 'bolt', bev=0.0)
    return k, TP, TR
def model_spaa():
    k = Kit(2)
    k.prism([(-2.8, 0.45), (-3.0, 0.8), (-2.4, 1.35), (2.7, 1.35), (2.9, 1.0), (2.8, 0.45)], -1.05, 1.05, 'olive', bev=0.035)
    k.box((0, -0.05, 1.33), (3.0, 5.6, 0.07), 'olive', bev=0.015)
    for sx in (-1, 1): track_side(k, sx, 1.05, 1.48, -2.9, 2.8, 0.08, 1.0, 5, 0.37)
    k.box((0, 2.2, 1.4), (1.8, 0.9, 0.05), 'dark', bev=0.0)
    TP = Vector((0, 0.2, 1.38))
    k.lathe([(0.0, 0.0), (1.05, 0.0), (1.05, 0.08), (0.0, 0.09)], T(0, 0.2, 1.38) @ Rx(90), 24, 'olive', 'mag')
    for sx in (-1, 1): exhaust(k, sx * 0.6, 2.85, 0.95, 0.06, 0.25)
    for sx in (-1, 1):
        k.box((sx * 1.0, 0.2, 1.85), (0.06, 1.9, 0.8), 'olive', 'mag', bev=0.01)
    k.box((0, 1.15, 1.85), (2.0, 0.06, 0.8), 'olive', 'mag', bev=0.01); k.box((0, -0.75, 1.75), (2.0, 0.06, 0.6), 'olive', 'mag', bev=0.01)
    k.box((0.5, 0.6, 1.6), (0.5, 0.5, 0.45), 'olive', 'mag', bev=0.01); k.box((-0.5, 0.6, 1.6), (0.5, 0.5, 0.45), 'olive', 'mag', bev=0.01)
    TR = Vector((0, -0.2, 1.95))
    k.box((0, -0.2, 1.95), (0.9, 0.7, 0.5), 'olive', 'bolt', bev=0.02)
    for sx in (-0.3, 0.3):
        for sz in (-0.12, 0.12):
            gun_tube(k, [(0.045, -0.3), (0.045, -2.5), (0.06, -2.52), (0.06, -2.7), (0.025, -2.7), (0.025, -0.3)], T(sx, 0, 1.95 + sz), 12, r_in=0.025)
    for sx in (-0.48, 0.48): k.box((sx, 0.05, 1.95), (0.15, 0.5, 0.4), 'steel', 'bolt', bev=0.01)
    return k, TP, TR
def model_arty():
    k = Kit(2)
    k.prism([(-3.4, 0.45), (-3.6, 0.85), (-2.8, 1.4), (3.4, 1.4), (3.55, 1.0), (3.45, 0.45)], -1.15, 1.15, 'olive', bev=0.04)
    k.box((0, -0.05, 1.38), (3.3, 7.0, 0.07), 'olive', bev=0.015)
    for sx in (-1, 1): track_side(k, sx, 1.15, 1.65, -3.5, 3.4, 0.08, 1.05, 6, 0.4)
    k.box((0, -2.6, 1.45), (1.8, 0.9, 0.05), 'dark', bev=0.0)
    TP = Vector((0, 1.1, 1.42))
    for sx in (-1, 1): k.prism([(-1.4 + 1.1, 1.42), (-1.6 + 1.1, 2.1), (1.6 + 1.1, 2.6), (2.2 + 1.1, 2.6), (2.2 + 1.1, 1.42)], sx * 1.5, sx * 1.42, 'olive', 'mag', bev=0.01)
    k.prism([(-1.6 + 1.1, 1.42), (-1.75 + 1.1, 2.2), (-1.6 + 1.1, 2.25), (-1.45 + 1.1, 1.42)], -1.5, 1.5, 'olive', 'mag', bev=0.015)
    k.box((0, 3.25, 2.0), (3.0, 0.06, 1.2), 'olive', 'mag', bev=0.01)
    for x, y in ((0.9, 2.6), (-0.9, 2.6), (0.9, 1.9)): k.box((x, y, 1.65), (0.5, 0.4, 0.45), 'wood', 'mag', bev=0.01)
    TR = Vector((0, 0.6, 2.05))
    k.box((0, 0.7, 2.05), (0.8, 1.6, 0.6), 'olive', 'bolt', bev=0.03)
    k.lathe([(0.2, -0.1), (0.2, -0.9), (0.13, -1.0), (0.13, -4.1), (0.0, -4.1)], T(0, 0.6, 2.05) @ Rz(0), 16, 'olive', 'bolt')
    k.box((0, -3.5 + 0.0, 2.05), (0.5, 0.45, 0.4), 'olive', 'bolt', bev=0.03); k.box((0, -3.5, 2.05), (0.55, 0.2, 0.12), 'dark', 'bolt', bev=0.0)
    bore_disc(k, T(0, 0, 2.05), -3.729, 0.1)
    for sx in (-1, 1): exhaust(k, sx * 0.7, 3.45, 1.1, 0.07, 0.25)
    return k, TP, TR
def model_apc():
    k = Kit(2)
    k.prism([(-3.6, 0.55), (-3.5, 0.95), (-2.4, 1.9), (3.3, 1.9), (3.6, 1.4), (3.5, 0.55)], -1.25, 1.25, 'olive', bev=0.05)
    k.prism([(-3.5, 0.55), (-3.0, 0.4), (3.0, 0.4), (3.5, 0.55)], -1.0, 1.0, 'olive', bev=0.03)
    for y in (-2.5, -0.9, 0.9, 2.5):
        for sx in (-1, 1): wheel_x(k, sx * 1.35, y, 0.55, 0.55, 0.4)
    for sx in (-1, 1): k.box((sx * 1.27, 0.0, 1.5), (0.05, 2.2, 0.5), 'dark', bev=0.0)
    for sx in (-1, 1): k.lathe([(0.0, 0.0), (0.09, 0.0), (0.09, 0.05), (0.0, 0.06)], T(sx * 0.8, -3.55, 1.2) @ Rx(90), 10, 'bright')
    TP = Vector((0, -0.6, 1.9))
    k.lathe([(0.0, 0.0), (0.78, 0.0), (0.72, 0.42), (0.5, 0.55), (0.0, 0.56)], T(0, -0.6, 1.9) @ Rx(90), 18, 'olive', 'mag')
    k.lathe([(0.0, 0.0), (0.2, 0.0), (0.2, 0.1), (0.0, 0.11)], T(0.3, -0.4, 2.45) @ Rx(90), 12, 'olive', 'mag')
    TR = Vector((0, -1.2, 2.15))
    k.box((0, -1.25, 2.15), (0.4, 0.25, 0.3), 'olive', 'bolt', bev=0.02)
    gun_tube(k, [(0.05, -1.3), (0.05, -3.2), (0.07, -3.22), (0.07, -3.4), (0.03, -3.4), (0.03, -1.3)], T(0, 0, 2.15), 12, r_in=0.03)
    exhaust(k, -1.0, 3.55, 1.0, 0.06, 0.22)
    return k, TP, TR
def model_truck():
    k = Kit(2)
    k.box((0, 0.2, 0.62), (1.1, 7.0, 0.28), 'steel', bev=0.02)                                  # chassis rails
    k.box((0, -2.83, 1.05), (1.7, 1.55, 0.9), 'olive', bev=0.06)                                # bonnet
    k.box((0, -3.62, 1.05), (1.3, 0.03, 0.6), 'dark', bev=0.0)                                  # radiator grille
    k.box((0, -3.66, 0.66), (2.2, 0.14, 0.24), 'steel', bev=0.02)                               # bumper
    for sx in (-1, 1):
        k.lathe([(0.0, 0.0), (0.11, 0.0), (0.11, 0.05), (0.0, 0.06)], T(sx * 0.68, -3.61, 1.25) @ Rx(90), 10, 'bright')
        k.prism([(-3.25, 1.0), (-3.15, 1.16), (-2.05, 1.16), (-1.95, 1.0)], sx * 0.86, sx * 1.3, 'olive', bev=0.01)   # front wing
        k.box((sx * 1.14, -1.4, 1.95), (0.02, 0.75, 0.5), 'dark', bev=0.0)                     # side window
        k.box((sx * 1.2, -2.0, 1.7), (0.04, 0.08, 0.2), 'steel', bev=0.0)                      # mirror
    k.box((0, -1.4, 1.5), (2.24, 1.3, 1.8), 'olive', bev=0.06)                                  # cab
    k.box((0, -2.06, 1.95), (1.95, 0.02, 0.55), 'dark', bev=0.0)                                # windscreen
    k.box((0, 1.6, 1.16), (2.4, 4.4, 0.24), 'olive', bev=0.02)                                   # bed
    for sx in (-1, 1): k.box((sx * 1.19, 1.6, 1.45), (0.04, 4.4, 0.5), 'olive', bev=0.01)     # side boards
    k.box((0, 3.79, 1.45), (2.4, 0.04, 0.5), 'olive', bev=0.01)                                 # tailgate
    k.prism([(-1.18, 1.68), (-1.18, 2.35), (-0.95, 2.78), (-0.5, 2.97), (0.5, 2.97), (0.95, 2.78), (1.18, 2.35), (1.18, 1.68)], -0.6, 3.75, 'olive', bev=0.03,
            M=Rz(90))                                                                            # canvas cover (an arch along the bed)
    k.box((0, 3.76, 2.3), (1.7, 0.02, 0.9), 'dark', bev=0.0)                                    # the open back of the cover
    for i in range(4): k.box((0, 0.2 + i * 1.05, 2.97), (2.0, 0.05, 0.02), 'tan', bev=0.0)      # ribs showing through the canvas
    k.box((0.85, -0.25, 0.85), (0.4, 0.7, 0.4), 'steel', bev=0.02)                              # fuel tank
    k.sweep([(-0.85, -0.68, 0.9), (-0.85, -0.68, 2.6), (-0.85, -0.6, 2.75)], 0.05, 8, 'steel')  # exhaust stack
    for y in (-2.6, 0.75, 2.15):
        for sx in (-1, 1): wheel_x(k, sx * 1.02, y, 0.52, 0.52, 0.34)
    return k, Vector((0, 0, 0)), Vector((0, 0, 0))
def model_atgun():
    k = Kit(2)
    for sx in (-1, 1):
        k.sweep([(sx * 0.25, 0.1, 0.5), (sx * 0.9, 2.0, 0.3), (sx * 1.25, 3.4, 0.12)], 0.08, 8, 'olive')
        k.box((sx * 1.27, 3.5, 0.06), (0.25, 0.3, 0.12), 'steel', bev=0.01)
        wheel_x(k, sx * 1.0, 0.0, 0.5, 0.5, 0.25)
    k.lathe([(0.06, -0.95), (0.06, 0.95)], T(0, 0, 0.5) @ Rz(90), 10, 'steel')
    k.box((0, 0.05, 0.62), (0.6, 0.5, 0.25), 'olive', bev=0.02)
    TP = Vector((0, 0.0, 0.75))
    k.box((0, 0.0, 0.85), (0.5, 0.6, 0.25), 'olive', 'mag', bev=0.02)
    k.prism([(-0.55, 0.65), (-0.55, 1.75), (-0.5, 1.85), (-0.45, 0.65)], -0.95, 0.95, 'olive', 'mag', bev=0.01)
    for sx in (-1, 1): k.prism([(-0.55, 0.65), (-0.2, 0.65), (-0.2, 1.6), (-0.55, 1.75)], sx * 0.95, sx * 1.0, 'olive', 'mag', bev=0.01)
    TR = Vector((0, -0.2, 1.1))
    k.box((0, 0.3, 1.1), (0.3, 1.2, 0.28), 'olive', 'bolt', bev=0.02)
    k.lathe([(0.075, -0.3), (0.075, -0.6), (0.055, -0.7), (0.055, -3.3), (0.0, -3.3)], T(0, 0, 1.1), 12, 'olive', 'bolt')
    k.box((0, -3.35, 1.1), (0.22, 0.25, 0.16), 'olive', 'bolt', bev=0.015); k.box((0, -3.35, 1.1), (0.24, 0.08, 0.06), 'dark', 'bolt', bev=0.0)
    bore_disc(k, T(0, 0, 1.1), -3.478, 0.045)
    return k, TP, TR
MODELS_V = {'td': model_td, 'spaa': model_spaa, 'arty': model_arty, 'apc': model_apc, 'truck': model_truck, 'atgun': model_atgun}

# ---------------------------------------------------------------- run
todo = [v for v in MODELS_V if 'only' not in OPT or v in OPT['only'].split(',')]
info = {}
for vid in todo:
    old = bpy.data.collections.get('v_' + vid)
    if old:
        for ob in list(old.objects): bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.collections.remove(old)
    for coll_ in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for d in list(coll_):
            if d.name.startswith(vid + '_') and d.users == 0: coll_.remove(d)
    c = bpy.data.collections.new('v_' + vid); scene.collection.children.link(c)
    info[vid] = make_tank(vid, MODELS_V[vid], c, TEXN_V.get(vid, 1024))
    parts = [o.name for o in c.objects if o.type == 'MESH']
    cfg = {'blend': 'vehicles.blend', 'out': '../../Steel Storm Remastered/assets/v_' + vid, 'parts': sorted(parts, key=lambda n: (n.endswith('_lod1'), ['hull', 'turret', 'barrel'].index(n.split('_')[1]))),
           'maxTexture': TEXN_V.get(vid, 1024)}
    with open(os.path.join(BASE, 'v_%s.export.json' % vid), 'w') as f: json.dump(cfg, f, indent=1)
prev = {}
p = os.path.join(CACHE, 'vehicles.json')
if os.path.exists(p): prev = json.load(open(p))
prev.update(info); json.dump(prev, open(p, 'w'), indent=1)
bpy.ops.wm.save_mainfile(); log('saved', bpy.data.filepath)
if 'preview' in OPT:
    sc = bpy.data.scenes.new('vprev'); sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'TEXTURE'
    cd = bpy.data.cameras.new('vc'); cam = bpy.data.objects.new('vc', cd); sc.collection.objects.link(cam); sc.camera = cam; cd.angle = math.radians(40)
    big = np.ones((2 * 270, 3 * 360, 4), np.float32)
    for i, vid in enumerate(MODELS_V):
        c = bpy.data.collections.get('v_' + vid)
        if not c: continue
        for o in c.objects:
            if not o.name.endswith('_lod1'): sc.collection.objects.link(o)
        off = Vector(((i % 3) * 40.0, (i // 3) * 40.0, 0)); bpy.data.objects[vid + '_hull'].location = off
        cam.location = off + Vector((8.5, -9.0, 5.5)); cam.rotation_euler = (off + Vector((0, 0, 1.0)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.resolution_x, sc.render.resolution_y = 360, 270; tmp = os.path.join(CACHE, '_vc.png'); sc.render.filepath = tmp
        bpy.ops.render.render(write_still=True, scene=sc.name)
        im = bpy.data.images.load(tmp); a = np.array(im.pixels[:], np.float32).reshape(270, 360, 4); bpy.data.images.remove(im); os.remove(tmp)
        r, q = divmod(i, 3); big[(1 - r) * 270:(2 - r) * 270, q * 360:(q + 1) * 360] = a
        bpy.data.objects[vid + '_hull'].location = (0, 0, 0)
    im = bpy.data.images.new('vg', 1080, 540); im.pixels.foreach_set(big.ravel()); im.filepath_raw = os.path.join(CACHE, 'vehicles.png'); im.file_format = 'PNG'; im.save()
    log('preview vehicles.png')
log('done')
