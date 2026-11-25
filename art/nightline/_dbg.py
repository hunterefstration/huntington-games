import bpy
me=bpy.data.objects['quay'].data; NP=len(me.polygons); d=me.uv_layers['Lightmap'].data
for pi in (NP-2,NP-1):
    p=me.polygons[pi]; print('BLK',pi,p.material_index,[tuple(round(c,4) for c in d[li].uv) for li in p.loop_indices], [tuple(round(c,2) for c in me.vertices[v].co) for v in p.vertices])
