# STEELWORKS: the ground's colour re-baked IN PLACE (nothing moves), after ss_repaint.py:
#   blender -b art/steelstorm/works.blend -P tools/blender/ss_works_ground.py -- [samples=32]
# then  node tools/export-art.mjs works
# The plain read pale in the game (its exposure lifts a uniformly darkened ground back up), so the ground is now told apart by contrast between
# its surfaces instead: near-black cinder and coal heaps with rust runs, dark oily dirt with soot patches and wheel ruts, mid-grey ballast,
# pale concrete slabs with joints and stains in the plant yard, dark asphalt. The colour comes from works_ground() below (linear) as a
# 2048 picture laid out like the light picture (0.2 m, so slab joints and ruts show); heights and layout are read from make_works.py's own
# height(), rails(), canal_y() and constants (taken from its source, so they stay one copy).
import bpy, bmesh, math, os, sys, ast
import numpy as np
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ss_mapkit as K
from hgkit import log, vnoise
from ss_tanks import drop_tanks, build_tanks, BASE

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OPT = dict((a.split('=', 1) + ['1'])[:2] for a in ARGV)
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'make_works.py'), encoding='utf-8').read()
NS = {'np': np, 'math': math, 'vnoise': vnoise}
keep = {'vn2', 'canal_y', 'rails', 'seg_dist', 'height'}
for node in ast.parse(src).body:
    if isinstance(node, ast.FunctionDef) and node.name in keep: exec(compile(ast.Module([node], []), 'make_works', 'exec'), NS)
    elif isinstance(node, ast.Assign) and all(isinstance(t, ast.Name) and t.id in ('HALF', 'PLANT', 'CANAL_Y', 'BRIDGES', 'SLAG', 'ROADS') for t in (node.targets[0].elts if isinstance(node.targets[0], ast.Tuple) else node.targets)):
        exec(compile(ast.Module([node], []), 'make_works', 'exec'), NS)
vn2, seg_dist, rails, canal_y = NS['vn2'], NS['seg_dist'], NS['rails'], NS['canal_y']
PLANT, BRIDGES, SLAG, ROADS, HALF = NS['PLANT'], NS['BRIDGES'], NS['SLAG'], NS['ROADS'], NS['HALF']

def works_ground(x, y):
    """linear colour of the steelworks ground"""
    x = np.asarray(x, np.float64); y = np.asarray(y, np.float64)
    n = vn2(x, y, 22.0, 7)[..., None]; n2 = vn2(x, y, 4.0, 9)[..., None]; n3 = vn2(x, y, 1.1, 13)[..., None]
    dirt = np.array((0.060, 0.052, 0.044)); soot = np.array((0.024, 0.023, 0.023)); cinder = np.array((0.055, 0.052, 0.054))
    slagc = np.array((0.030, 0.028, 0.030)); crust = np.array((0.070, 0.066, 0.064)); rust = np.array((0.22, 0.10, 0.045))
    ballast = np.array((0.17, 0.165, 0.155)); conc = np.array((0.34, 0.33, 0.31)); asph = np.array((0.055, 0.055, 0.06)); water = np.array((0.06, 0.08, 0.07))
    sm = lambda v, e, w: np.clip((v - e) / w + 0.5, 0, 1)
    # dirt: dark, broken by oily soot patches and lighter dry scuffs; cinder scatter
    c = dirt * (0.75 + 0.45 * n) * (0.85 + 0.3 * n2)
    sp = sm(vn2(x, y, 14.0, 31), 0.55, 0.05)[..., None]; c = c * (1 - sp * 0.85) + soot * (0.8 + 0.4 * n3) * sp * 0.85
    dry = sm(vn2(x, y, 6.0, 37), 0.72, 0.05)[..., None]; c = c * (1 - dry * 0.45) + np.array((0.12, 0.105, 0.085)) * (0.85 + 0.3 * n3) * dry * 0.45
    ci = (vn2(x, y, 0.6, 41) > 0.68)[..., None] * 0.6; c = c * (1 - ci) + cinder * ci
    # wheel ruts: pairs of dark lines wandering across the open ground
    for k in range(9):
        a0 = k * 0.7; ox = 150 * math.cos(a0 * 2.3); oy = 150 * math.sin(a0 * 1.7)
        d = np.abs((x - ox) * math.sin(a0) - (y - oy) * math.cos(a0) + 6 * np.sin((x * math.cos(a0) + y * math.sin(a0)) / 23.0 + k))
        rut = ((np.abs(d - 1.0) < 0.22) | (np.abs(d + 1.0) < 0.22))[..., None] * 0.5; c = c * (1 - rut) + soot * rut
    # slag and cinder heaps: near black, a lighter weathered crust on the tops, rust runs down the sides
    for cx, cy, hh, r in SLAG:
        m = np.clip(np.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (r * r * 1.4)) * 1.6 - 0.15, 0, 1)[..., None]
        top = np.clip(np.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (r * r * 0.25)) * 1.4 - 0.4, 0, 1)[..., None]
        flank = np.clip(1 - np.abs(np.hypot(x - cx, y - cy) / r - 0.75) / 0.3, 0, 1); run = (sm(vn2(x * 0.6, y * 0.6, 3.0, int(cx) & 63), 0.7, 0.06) * flank)[..., None] * 0.7
        h = slagc * (0.8 + 0.4 * n2); h = h * (1 - top) + crust * (0.85 + 0.3 * n3) * top; h = h * (1 - run * 0.8) + rust * (0.8 + 0.4 * n3) * run * 0.8
        c = c * (1 - m) + h * m
    # rail embankments: grey ballast with dark sleepers' oil
    for a in rails():
        d = seg_dist(x, y, a)[..., None]; e = np.clip((8.5 - d) / 2.0, 0, 1)
        b = ballast * (0.8 + 0.35 * n3) * (1 - 0.35 * (d < 2.2) * (n2 > 0.4)); c = c * (1 - e) + b * e
    # the plant yard: pale concrete slabs (5 m, dark joints), oil and rust stains
    x0, y0, x1, y1 = PLANT; ins = np.clip(np.minimum.reduce([x - x0, x1 - x, y - y0, y1 - y]) / 4.0, 0, 1)[..., None]
    joint = ((np.abs(np.mod(x, 5.0) - 2.5) > 2.42) | (np.abs(np.mod(y, 5.0) - 2.5) > 2.42))[..., None]
    sl = conc * (0.82 + 0.3 * vn2(np.floor(x / 5), np.floor(y / 5), 1.0, 51)[..., None]) * (0.92 + 0.12 * n3)
    st = sm(vn2(x, y, 7.0, 53), 0.62, 0.08)[..., None]; sl = sl * (1 - 0.55 * st)
    rs = sm(vn2(x, y, 5.0, 57), 0.72, 0.05)[..., None]; sl = sl * (1 - 0.5 * rs) + rust * 0.7 * 0.5 * rs
    sl = np.where(joint, sl * 0.45, sl); c = c * (1 - ins) + sl * ins
    # roads: dark asphalt, worn paler in the two wheel lanes, a dirt verge
    for rx0, ry0, rx1, ry1 in ROADS:
        d = seg_dist(x, y, (rx0, ry0, rx1, ry1))[..., None]; e = np.clip((4.5 - d) / 0.6, 0, 1)
        lane = (np.abs(np.abs(d) - 1.8) < 0.5) * 0.35; a = asph * (0.85 + 0.25 * n3) * (1 + lane)
        c = c * (1 - e) + a * e
    dc = np.abs(y - canal_y(x)); wa = np.clip((7.6 - dc) / 0.6, 0, 1)
    for bx in BRIDGES: wa = wa * np.clip((np.abs(x - bx) - 6.0) / 0.5, 0, 1)
    wall = np.clip((9.6 - dc) / 0.8, 0, 1) * (1 - wa)
    for bx in BRIDGES: wall = wall * np.clip((np.abs(x - bx) - 6.0) / 0.5, 0, 1)
    c = c * (1 - wall[..., None]) + conc * 0.8 * wall[..., None]; c = c * (1 - wa[..., None]) + water * (0.9 + 0.2 * n2) * wa[..., None]
    return np.clip(c, 0.02, 0.85)

ter = bpy.data.objects['terrain']; bd = bpy.data.objects['backdrop']
N = int(OPT.get('px', 2048))
xs = (np.arange(N) + 0.5) / N * 2 * HALF - HALF; X, Y = np.meshgrid(xs, xs, indexing='xy')
col = works_ground(X, Y).astype(np.float32); log('works ground picture', N, 'mean', col.reshape(-1, 3).mean(0).round(3), 'p10/p90 lum', np.percentile(col.mean(2), [10, 90]).round(3))
img = bpy.data.images.new('works_macro', N, N, alpha=False, float_buffer=True); img.pixels.foreach_set(np.concatenate([col, np.ones((N, N, 1), np.float32)], 2).ravel())
def macro_pic_material(name, image):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'); b.inputs['Roughness'].default_value = 1.0
    tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = image; tx.interpolation = 'Linear'; uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'Lightmap'
    nt.links.new(uvn.outputs['UV'], tx.inputs['Vector']); nt.links.new(tx.outputs['Color'], b.inputs['Base Color']); return m
mac = macro_pic_material('works_ground_macro', img)
# the backdrop's vertex colours follow the new ground at the map edge (its own 'macro' attribute, as the build made it)
bme = bd.data; vv = np.array([v.co[:] for v in bme.vertices]); bc = works_ground(np.clip(vv[:, 0], -HALF, HALF), np.clip(vv[:, 1], -HALF, HALF)) * 0.95
far = np.clip((np.maximum(np.abs(vv[:, 0]), np.abs(vv[:, 1])) - HALF) / 60.0, 0, 1)[:, None]; bc = bc * (1 - far) + np.array((0.12, 0.105, 0.09)) * far
ca = bme.color_attributes.get('macro') or bme.color_attributes.new('macro', 'FLOAT_COLOR', 'POINT')
ca.data.foreach_set('color', np.c_[bc, np.ones(len(vv))].astype(np.float32).ravel())
bmac = bpy.data.materials.new('works_bd_macro'); bmac.use_nodes = True; nt = bmac.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'); b.inputs['Roughness'].default_value = 1.0
at = nt.nodes.new('ShaderNodeAttribute'); at.attribute_name = 'macro'; nt.links.new(at.outputs['Color'], b.inputs['Base Color'])
detail_t, detail_b = ter.data.materials[0], bd.data.materials[0]
ter.data.materials[0] = mac; bd.data.materials[0] = bmac
drop_tanks()
S = int(OPT.get('samples', 32))
K.bake(ter, 2048, 'tex/works_light.exr', {'COLOR', 'DIRECT', 'INDIRECT'}, S)
K.bake(bd, 512, 'tex/works_backdrop_light.exr', {'COLOR', 'DIRECT', 'INDIRECT'}, max(8, S // 2))
ter.data.materials[0] = detail_t; bd.data.materials[0] = detail_b
for m in (mac, bmac): bpy.data.materials.remove(m)
bpy.data.images.remove(img)
build_tanks(bpy.context.scene)
bpy.ops.wm.save_mainfile(); log('works ground: saved', bpy.data.filepath)
