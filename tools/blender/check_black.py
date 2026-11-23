# Faces in the open that baked black in the light picture (they read as holes or missing textures in the game).
#   blender -b art/ashfall/yard.blend -P tools/blender/check_black.py -- [object=yard] [list=10] [min_area=0.1]
# A face counts when every one of its triangles samples black (< 0.02), it is not facing down, and a short ray out of it along its normal
# is clear (so faces hidden inside or against other geometry are ignored). The light picture is read from the object's hg_lightmap or
# tex/<object>_light.exr next to the .blend.
import bpy, sys, os, math
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
A = dict((a.split('=', 1) + ['1'])[:2] for a in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []))
name = A.get('object') or os.path.splitext(os.path.basename(bpy.data.filepath))[0]
ob = bpy.data.objects[name]; me = ob.data; uvd = me.uv_layers['Lightmap'].data; me.calc_loop_triangles()
im = bpy.data.images.load(bpy.path.abspath(ob.get('hg_lightmap') and '//' + ob['hg_lightmap'] or '//tex/%s_light.exr' % name)); N = im.size[0]
px = np.array(im.pixels[:], np.float32).reshape(N, N, 4)
bvh = BVHTree.FromObject(ob, bpy.context.evaluated_depsgraph_get())
lit = {}
for t in me.loop_triangles:
    u = sum((uvd[li].uv for li in t.loops), Vector((0, 0))) / 3
    lit[t.polygon_index] = max(lit.get(t.polygon_index, 0.0), float(px[min(N - 1, max(0, int(u.y * N))), min(N - 1, max(0, int(u.x * N))), :3].sum()))
bad = []
for f in me.polygons:
    if lit.get(f.index, 1) >= 0.02 or f.normal.z < -0.5 or f.area < float(A.get('min_area', 0.1)): continue
    h = bvh.ray_cast(f.center + f.normal * 0.02, f.normal, 60.0)
    if h[0] is not None and (h[3] < 0.6 or h[1].dot(f.normal) > 0.2): continue      # against something, or inside a solid (the ray meets a face from behind)
    bad.append(f)
bad.sort(key=lambda f: -f.area); tot = sum(f.area for f in bad)
print('BLACK %s: %d open faces baked black, %.1f m2' % (name, len(bad), tot))
for f in bad[:int(A.get('list', 10))]:
    print('  %.2f m2 at (%.1f, %.1f, %.1f) normal (%.1f, %.1f, %.1f) %s' % (f.area, f.center.x, f.center.y, f.center.z, f.normal.x, f.normal.y, f.normal.z, me.materials[f.material_index].name))
