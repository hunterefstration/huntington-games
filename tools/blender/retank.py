# Rebuild only the three tanks (medium / light / heavy, with their paint + _gear materials) inside an existing Steel Storm battlefield
# file, leaving the ground, props and baked light alone (a full map rebuild re-bakes for minutes):
#   blender -b art/steelstorm/valley.blend -P tools/blender/retank.py      (dunes, pass, works, range, harbor, farmland, city the same)
# then  node tools/export-art.mjs valley
import bpy, os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hgkit import log
from ss_tanks import drop_tanks, build_tanks, BASE

name = os.path.splitext(os.path.basename(bpy.data.filepath))[0]
drop_tanks()
TK = build_tanks(bpy.context.scene)
os.makedirs(os.path.join(BASE, '_cache'), exist_ok=True)
with open(os.path.join(BASE, '_cache', ('tanks' if name == 'valley' else name + '_tanks') + '.json'), 'w') as f: json.dump(TK, f, indent=1)
bpy.ops.wm.save_mainfile(); log('retank: saved', bpy.data.filepath)
