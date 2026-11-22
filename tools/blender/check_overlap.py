# Coplanar overlapping faces (they flicker through each other in the game) in a .blend's mesh objects.
#   blender -b art/ashfall/subway.blend -P tools/blender/check_overlap.py -- [collection=map] [eps=0.006] [list=12]
import bpy, bmesh, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hgkit import coplanar_pairs
A = dict((a.split('=', 1) + ['1'])[:2] for a in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []))
col = bpy.data.collections.get(A.get('collection', 'map')); obs = [o for o in (col.all_objects if col else bpy.data.objects) if o.type == 'MESH']
bm = bmesh.new()
for o in obs: me = o.data.copy(); me.transform(o.matrix_world); bm.from_mesh(me); bpy.data.meshes.remove(me)
mats = [m.name if m else '-' for o in obs for m in o.data.materials][:64]
pairs = coplanar_pairs(bm, float(A.get('eps', 0.006)), skip=lambda f: f.normal.z < -0.9 and f.calc_center_median().z < 0.05)      # undersides on the floor are never seen
pairs.sort(key=lambda t: -t[2]); tot = sum(p[2] for p in pairs)
print('COPLANAR %s: %d overlapping pairs, %.2f m2 in all' % (os.path.basename(bpy.data.filepath), len(pairs), tot))
for a, b, ar in pairs[:int(A.get('list', 12))]:
    c = a.calc_center_median(); print('  %.3f m2 at (%.2f, %.2f, %.2f) normal (%.0f, %.0f, %.0f) %s / %s' % (ar, c.x, c.y, c.z, a.normal.x, a.normal.y, a.normal.z,
          mats[a.material_index] if a.material_index < len(mats) else a.material_index, mats[b.material_index] if b.material_index < len(mats) else b.material_index))
