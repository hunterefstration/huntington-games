# Steel Storm Remastered's PROVING GROUND (range.hgm): the proof slice's range (art/proof/range.blend, built by hand through the
# Blender MCP; its ground, props and baked light are kept as they are) with the three Steel Storm tanks of tools/blender/ss_tanks.py
# (paint + _gear materials) in place of the old medium. The proof slice's own file and Proof Slice/assets/range.hgm are never touched.
#   blender -b art/proof/range.blend -P tools/blender/make_range.py      (saves art/steelstorm/range.blend, writes range.export.json)
# then  node tools/export-art.mjs range_ssr  ->  Steel Storm Remastered/assets/range.hgm
import bpy, os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hgkit import log
from ss_tanks import drop_tanks, build_tanks, BASE, TANK_PARTS

src = bpy.data.filepath.replace('\\', '/')
if src.endswith('art/proof/range.blend'):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, 'range.blend'), relative_remap=True); log('copied to', bpy.data.filepath)
    for ob in bpy.data.objects:                         # the light pictures stay in art/proof/tex
        p = ob.get('hg_lightmap')
        if p and str(p).startswith('tex/'): ob['hg_lightmap'] = '../proof/' + str(p)
elif not src.endswith('art/steelstorm/range.blend'):
    raise SystemExit('run this on art/proof/range.blend (or art/steelstorm/range.blend)')
drop_tanks()
TK = build_tanks(bpy.context.scene)
proof = json.load(open(os.path.join(os.path.dirname(BASE), 'proof', 'range.export.json')))
cfg = dict(proof, blend='range.blend', out='../../Steel Storm Remastered/assets/range', parts=TANK_PARTS)
cfg['world'] = dict(proof['world'], lightmap='../proof/' + proof['world']['lightmap'])
with open(os.path.join(BASE, 'range_ssr.export.json'), 'w') as f: json.dump(cfg, f, indent=1)
with open(os.path.join(BASE, '_cache', 'range_tanks.json'), 'w') as f: json.dump(TK, f, indent=1)
bpy.ops.wm.save_mainfile(); log('saved', bpy.data.filepath)
