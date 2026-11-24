# Blender -> game: writes one .hgm file (models, animation, baked light at ground level, a collision map) and the
# pictures beside it, for HG3D.load() (engine/src/85-assets.js).
#   blender -b art/proof/shooter.blend -P tools/blender/hg_export.py -- art/proof/yard.export.json
# The JSON beside the .blend says what goes in (paths are relative to that JSON):
#   { "out": "../../Proof Slice/assets/yard",            file name without the ending
#     "world":  { "collections": ["map"], "lightmap": "tex/map_light.exr", "lmSize": 2048, "gain": { "detail": 2 }, "plain": ["detail"] },
#               (an object with the custom property hg_lightmap = "tex/other.exr" reads its light from that picture;
#                one with hg_soft = 1 is drawn but left out of the collision grid and the heights' tops: nothing stops on it)
#     "parts":  ["gun", "gun_mag"],                       moving things: kept apart, parents kept
#     "skins":  [{ "name": "enemy", "rig": "enemy_rig", "lods": ["enemy", "enemy_lod1"], "clips": { "walk": { "loop": true } } }],
#               ("together": true: the "lods" are not detail levels but the pieces of one model, all drawn at once: first-person arms + gun)
#               ("as": { "blender name": "exported name" } renames pieces; a clip's "action": "blender action" plays that action under the clip's name)
#     a config with only "skins" (no world, grid, probes, sky) writes just the figures: weapons for first person
#     "grid":   { "cell": 0.25 },                         collision map (what is solid, per column)
#     "heights": { "cell": 1.0, "ground": ["terrain"] },  height of the ground, and of whatever stands on it ("tops")
#     "probes": { "cell": 1.0, "height": 1.0, "samples": 64, "follow": false },   baked light for moving things (follow: over hills)
#     "sky":    { "width": 1024 },  "maxTexture": 1024,
#     "area":   ["terrain"] }                           the objects whose extent the maps above cover (default: the whole world)
# Blender is Z up, the game is Y up: (x, y, z) -> (x, z, -y). Picture rows are flipped in the UVs (v -> 1 - v).
# World meshes: UV layer "UVMap" for the colour picture, "Lightmap" for the baked light. One mesh per material.
import bpy, sys, os, json, struct, math, time
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
CFG_PATH = os.path.abspath(argv[0])
CFG = json.load(open(CFG_PATH))
BASE = os.path.dirname(CFG_PATH)
OUT = os.path.normpath(os.path.join(BASE, CFG['out']))
OUT_DIR, NAME = os.path.split(OUT)
os.makedirs(OUT_DIR, exist_ok=True)
CACHE = os.path.join(BASE, '_cache'); os.makedirs(CACHE, exist_ok=True)
MAX_TEX = int(CFG.get('maxTexture', 1024))
C4 = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))
C4I = C4.inverted()
scene = bpy.context.scene
T0 = time.time()
def log(*a): print('[hg_export %5.1fs]' % (time.time() - T0), *a); sys.stdout.flush()

# Whatever was hidden in the viewport when the file was saved (a collection switched off while working on another) is
# not worked out by Blender at all: its objects would come out at the origin. Show everything in this copy in memory
# (the file on disk is not touched); what is drawn into the bakes is decided by hide_render, further down.
def show_all(lc):
    for c in lc.children: show_all(c)
    lc.hide_viewport = False; lc.exclude = False
show_all(bpy.context.view_layer.layer_collection)
for c in bpy.data.collections: c.hide_viewport = False
for o in scene.objects:
    o.hide_viewport = False
    try: o.hide_set(False)
    except Exception: pass
bpy.context.view_layer.update()

# ---------------------------------------------------------------- the binary block
blob = bytearray()
DT = {'f32': '<f4', 'u16': '<u2', 'u32': '<u4', 'u8': 'u1', 'i8': 'i1', 'i16': '<i2'}
def put(arr, typ, size=None, norm=False):
    a = np.ascontiguousarray(arr, dtype=DT[typ]); off = len(blob); blob.extend(a.tobytes())
    while len(blob) % 4: blob.append(0)
    v = {'type': typ, 'off': off, 'n': int(a.size)}
    if size: v['size'] = size
    if norm: v['norm'] = 1
    return v

# ---------------------------------------------------------------- pictures
def image_pixels(img):
    w, h = img.size
    a = np.empty(w * h * 4, np.float32); img.pixels.foreach_get(a)
    return a.reshape(h, w, 4)
def lin_to_srgb(a):
    a = np.clip(a, 0, 1)
    return np.where(a < 0.0031308, a * 12.92, 1.055 * np.power(a, 1 / 2.4) - 0.055)
def shrink(a, max_size):
    while max(a.shape[0], a.shape[1]) > max_size and a.shape[0] % 2 == 0 and a.shape[1] % 2 == 0:
        a = (a[0::2, 0::2] + a[1::2, 0::2] + a[0::2, 1::2] + a[1::2, 1::2]) * 0.25
    return a
FORMATS = [i.identifier for i in bpy.types.Image.bl_rna.properties['file_format'].enum_items]
EXT, FMT = ('.webp', 'WEBP') if 'WEBP' in FORMATS else ('.jpg', 'JPEG')
def save_bytes(rgb, file, quality):
    # rgb: (h, w, 3+) floats 0..1, already encoded the way the bytes should read
    h, w = rgb.shape[:2]
    px = np.ones((h, w, 4), np.float32); px[:, :, :3] = np.clip(rgb[:, :, :3], 0, 1)
    im = bpy.data.images.new('hg_tmp_save', w, h, alpha=False, float_buffer=False)
    im.pixels.foreach_set(px.ravel()); im.filepath_raw = os.path.join(OUT_DIR, file); im.file_format = FMT
    try: im.save(quality=quality)
    except TypeError: im.save()
    bpy.data.images.remove(im)
textures, tex_index = [], {}
def add_texture(key, make, file, srgb, repeat, quality=86):
    if key in tex_index: return tex_index[key]
    px = make(); save_bytes(px, file, quality)
    textures.append({'file': file, 'srgb': bool(srgb), 'repeat': bool(repeat), 'w': int(px.shape[1]), 'h': int(px.shape[0])})
    tex_index[key] = len(textures) - 1
    log('picture', file, px.shape[1], 'x', px.shape[0], '%.0f KB' % (os.path.getsize(os.path.join(OUT_DIR, file)) / 1024))
    return tex_index[key]
def safe(name): return ''.join(c if c.isalnum() or c in '-_' else '_' for c in name)
PLAIN = set((CFG.get('world') or {}).get('plain', []))       # pictures that are plain numbers, not colours (a grey detail picture: 0.5 = no change at gain 2)
def colour_texture(img, repeat):
    plain = os.path.splitext(img.name)[0] in PLAIN
    def make():
        a = image_pixels(img)[:, :, :3]
        if img.is_float and not plain: a = lin_to_srgb(a)
        return shrink(a, MAX_TEX)
    return add_texture(('img', img.name), make, NAME + '_' + safe(os.path.splitext(img.name)[0]) + EXT, not plain, repeat)
LM_RANGE = {}
def light_texture(path, rng, size, tag):
    # rng 0: pick the range from the picture itself (its brightest 0.1% may clip)
    def make():
        img = bpy.data.images.load(path, check_existing=False)
        a = shrink(image_pixels(img)[:, :, :3], size); bpy.data.images.remove(img)
        r = rng if rng > 0 else float(min(max(np.percentile(a, 99.9) * 1.05, 1.0), 64.0)); LM_RANGE[path] = r
        return np.sqrt(np.clip(a / r, 0, 1))
    t = add_texture(('lm', path), make, NAME + tag + EXT, False, False, 92)
    return t, LM_RANGE[path]

# ---------------------------------------------------------------- materials
def shader_info(mat):
    info = {'image': None, 'color': (0.8, 0.8, 0.8), 'rough': 1.0, 'metal': 0.0, 'emit': None}
    if not mat or not mat.use_nodes: return info
    for n in mat.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED':
            bc = n.inputs['Base Color']
            if bc.is_linked:
                src = bc.links[0].from_node
                seen = 0
                while src and src.type != 'TEX_IMAGE' and seen < 6:      # through a mix / multiply to the first picture
                    nxt = None
                    for i in src.inputs:
                        if i.is_linked: nxt = i.links[0].from_node; break
                    src = nxt; seen += 1
                if src and src.type == 'TEX_IMAGE' and src.image: info['image'] = src.image
            else: info['color'] = tuple(bc.default_value[:3])
            info['rough'] = float(n.inputs['Roughness'].default_value); info['metal'] = float(n.inputs['Metallic'].default_value)
            es = n.inputs.get('Emission Strength'); ec = n.inputs.get('Emission Color') or n.inputs.get('Emission')
            if es and ec and es.default_value > 0 and max(ec.default_value[:3]) > 0 and not ec.is_linked: info['emit'] = (tuple(ec.default_value[:3]), float(es.default_value))
        elif n.type == 'EMISSION' and n.outputs[0].is_linked:
            info['emit'] = (tuple(n.inputs['Color'].default_value[:3]), float(n.inputs['Strength'].default_value))
    return info
materials, mat_index = [], {}
def material_for(mat, kind, lightmap=-1, lm_range=8, gain=None):
    key = (mat.name if mat else '', kind, lightmap)
    if key in mat_index: return mat_index[key]
    s = shader_info(mat); m = {'name': mat.name if mat else 'none'}
    emissive = (mat is not None and mat.name.lower().startswith('emissive')) or (s['emit'] is not None and s['image'] is None)
    if emissive:
        col, strength = s['emit'] if s['emit'] else (s['color'], 1.0)
        k = min(max(strength, 1.0), 4.0)
        m.update({'unlit': 1, 'map': -1, 'color': [col[0] * k, col[1] * k, col[2] * k]})
    else:
        m['map'] = colour_texture(s['image'], kind == 'world' or kind == 'tile') if s['image'] else -1
        if s['image'] is None: m['color'] = list(s['color'])
        if kind == 'world':
            m.update({'lightMap': lightmap, 'lmRange': lm_range})
            if gain and s['image']: m['color'] = [gain, gain, gain]
        else: m.update({'roughness': round(s['rough'], 3), 'metalness': round(s['metal'], 3)})
    if mat and not mat.use_backface_culling and kind != 'world': pass
    materials.append(m); mat_index[key] = len(materials) - 1
    return mat_index[key]

# ---------------------------------------------------------------- meshes
def uv_array(me, name, nl):
    layer = me.uv_layers.get(name)
    if layer is None: return None
    a = np.empty(nl * 2, np.float32); layer.data.foreach_get('uv', a); a = a.reshape(-1, 2); a[:, 1] = 1.0 - a[:, 1]
    return a
def corners(ob, M, skin=None):
    """Triangle corners of the object as it is with its modifiers on, moved by the 4x4 M. skin = (rig, bone names) keeps the rest pose and adds weights."""
    off = []
    if skin:
        for md in ob.modifiers:
            if md.type == 'ARMATURE' and md.show_viewport: md.show_viewport = False; off.append(md)
        bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get(); ev = ob.evaluated_get(dg); me = ev.to_mesh()
    me.calc_loop_triangles()
    nv, nl, nt = len(me.vertices), len(me.loops), len(me.loop_triangles)
    out = None
    if nt:
        co = np.empty(nv * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
        lv = np.empty(nl, np.int32); me.loops.foreach_get('vertex_index', lv)
        cn = np.empty(nl * 3, np.float32); me.corner_normals.foreach_get('vector', cn); cn = cn.reshape(-1, 3)
        tl = np.empty(nt * 3, np.int32); me.loop_triangles.foreach_get('loops', tl); tl = tl.reshape(-1, 3)
        tm = np.empty(nt, np.int32); me.loop_triangles.foreach_get('material_index', tm)
        M3 = np.array(M.to_3x3(), np.float64); T = np.array(M.translation, np.float64)
        if np.linalg.det(M3) < 0: tl = tl[:, ::-1]
        tl = tl.ravel()
        pos = co[lv[tl]].astype(np.float64) @ M3.T + T
        N3 = np.linalg.inv(M3).T
        nrm = cn[tl].astype(np.float64) @ N3.T; nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
        uv = uv_array(me, 'UVMap', nl)
        if uv is None and len(me.uv_layers): uv = uv_array(me, me.uv_layers[0].name, nl)
        uv2 = uv_array(me, 'Lightmap', nl)
        out = {'pos': pos.astype(np.float32), 'nrm': nrm.astype(np.float32), 'uv': uv[tl] if uv is not None else np.zeros((len(tl), 2), np.float32),
               'uv2': uv2[tl] if uv2 is not None else None, 'mat': np.repeat(tm, 3), 'skin': None}
        if skin:
            rig, bones = skin; bi = {b: i for i, b in enumerate(bones)}; gname = {g.index: g.name for g in ob.vertex_groups}
            sk = np.zeros((nv, 4), np.float32); sk[:, 2] = 255
            for v in me.vertices:
                ws = sorted(((g.weight, bi[gname[g.group]]) for g in v.groups if gname.get(g.group) in bi and g.weight > 0), reverse=True)[:2]
                if not ws: continue
                if len(ws) == 1: sk[v.index] = (ws[0][1], ws[0][1], 255, 0)
                else:
                    w0 = round(255 * ws[0][0] / (ws[0][0] + ws[1][0])); sk[v.index] = (ws[0][1], ws[1][1], w0, 255 - w0)
            out['skin'] = sk[lv[tl]]
    ev.to_mesh_clear()
    for md in off: md.show_viewport = True
    if off: bpy.context.view_layer.update()
    return out
def weld(cols):
    """per-corner columns -> unique vertices + an index"""
    rec = np.ascontiguousarray(np.concatenate([np.round(c, 5) for c in cols], axis=1).astype(np.float32))
    key = rec.view(np.dtype((np.void, rec.dtype.itemsize * rec.shape[1]))).ravel()
    _, first, inv = np.unique(key, return_index=True, return_inverse=True)
    return first, inv.ravel()
def prim(pos, nrm, uv, uv2, skin, material):
    cols = [pos, nrm, uv] + ([uv2] if uv2 is not None else []) + ([skin] if skin is not None else [])
    first, idx = weld(cols)
    p, n = pos[first], nrm[first]
    lo, hi = p.min(axis=0), p.max(axis=0); c = (lo + hi) / 2; r = float(np.sqrt(((p - c) ** 2).sum(axis=1).max()))
    attrs = {'position': put(p, 'f32', 3), 'normal': put(np.clip(np.round(n * 127), -127, 127), 'i8', 3, True), 'uv': put(uv[first], 'f32', 2)}
    if uv2 is not None: attrs['uv2'] = put(np.clip(np.round(uv2[first] * 65535), 0, 65535), 'u16', 2, True)
    if skin is not None: attrs['aSkin'] = put(skin[first], 'u8', 4)
    return {'material': material, 'attrs': attrs, 'index': put(idx, 'u16' if len(first) < 65536 else 'u32'),
            'bs': [float(c[0]), float(c[1]), float(c[2]), r], 'min': [float(x) for x in lo], 'max': [float(x) for x in hi], 'verts': int(len(first)), 'tris': int(len(idx) // 3)}
def flat16(M): return [float(M[r][c]) for c in range(4) for r in range(4)]      # column-major
def mesh_objects(coll):
    return [o for o in coll.all_objects if o.type == 'MESH' and not o.hide_render]

objects = []
world_obs = []
# ---- the static world: everything joined, one mesh per material, in world space
W = CFG.get('world')
if W:
    lm_cfg = float(W.get('lmRange', 0))
    lm_main, lm_main_range = light_texture(os.path.join(BASE, W['lightmap']), lm_cfg, int(W.get('lmSize', 2048)), '_light') if W.get('lightmap') else (-1, 8)
    gains = W.get('gain', {})                # material name -> how much brighter its colour picture is drawn (a grey detail picture: 2)
    chunks = {}
    for cname in W['collections']:
        for ob in mesh_objects(bpy.data.collections[cname]):
            world_obs.append(ob)
            c = corners(ob, C4 @ ob.matrix_world)
            if c is None: continue
            lm, lm_range = lm_main, lm_main_range
            if ob.get('hg_lightmap'):            # this object's light is in another picture (custom property: path beside the JSON)
                lp = str(ob['hg_lightmap']); lm, lm_range = light_texture(os.path.join(BASE, lp), lm_cfg, int(ob.get('hg_lightmap_size', 1024)), '_light_' + safe(os.path.splitext(os.path.basename(lp))[0]))
            for slot in np.unique(c['mat']):
                mat = ob.material_slots[slot].material if slot < len(ob.material_slots) else None
                sel = c['mat'] == slot
                s = shader_info(mat)
                emissive = (mat is not None and mat.name.lower().startswith('emissive')) or (s['emit'] is not None and s['image'] is None)
                use_lm = lm >= 0 and c['uv2'] is not None and not emissive
                mi = material_for(mat, 'world' if use_lm else 'tile', lm if use_lm else -1, lm_range, gains.get(mat.name) if mat else None)
                chunks.setdefault((mi, use_lm), []).append((c['pos'][sel], c['nrm'][sel], c['uv'][sel], c['uv2'][sel] if use_lm else None))
    prims = []
    for (mi, use_lm), parts in chunks.items():
        cat = lambda k: np.concatenate([p[k] for p in parts])
        prims.append(prim(cat(0), cat(1), cat(2), cat(3) if use_lm else None, None, mi))
    objects.append({'name': 'world', 'world': 1, 'prims': prims})
    log('world:', len(world_obs), 'objects ->', len(prims), 'meshes,', sum(p['tris'] for p in prims), 'triangles')

# ---- moving things: geometry in the object's own space, parents kept
part_names = CFG.get('parts', [])
for name in part_names:
    ob = bpy.data.objects.get(name)
    if ob is None: log('part not found, skipped:', name); continue
    c = corners(ob, C4)
    parent = ob.parent.name if ob.parent and ob.parent.name in part_names else None
    if parent: L = C4 @ (ob.parent.matrix_world.inverted() @ ob.matrix_world) @ C4I
    else: Mw = ob.matrix_world.copy(); Mw.translation = (0, 0, 0); L = C4 @ Mw @ C4I
    prims = []
    if c is not None:
        for slot in np.unique(c['mat']):
            mat = ob.material_slots[slot].material if slot < len(ob.material_slots) else None
            sel = c['mat'] == slot
            prims.append(prim(c['pos'][sel], c['nrm'][sel], c['uv'][sel], None, None, material_for(mat, 'part')))
    o = {'name': name, 'local': flat16(L), 'prims': prims}
    if parent: o['parent'] = parent
    objects.append(o)
    log('part', name, sum(p['tris'] for p in prims), 'triangles')

# ---- animated figures: rest-pose meshes with two bones per vertex, every frame of every clip as bone matrices
skins = []
for S in CFG.get('skins', []):
    rig = bpy.data.objects.get(S['rig'])
    if rig is None: log('rig not found, figure skipped:', S['rig']); continue
    lod_obs = [bpy.data.objects[n] for n in S['lods'] if bpy.data.objects.get(n)]
    used = set()
    for ob in lod_obs: used.update(g.name for g in ob.vertex_groups)
    bones = [b.name for b in rig.data.bones if b.use_deform and b.name in used]
    R = C4 @ rig.matrix_world; RI = R.inverted()
    for ob in lod_obs:
        c = corners(ob, C4 @ ob.matrix_world, skin=(rig, bones))
        mat = ob.material_slots[0].material if ob.material_slots else None
        objects.append({'name': S.get('as', {}).get(ob.name, ob.name), 'prims': [prim(c['pos'], c['nrm'], c['uv'], None, c['skin'], material_for(mat, 'part'))]})
        log('figure', objects[-1]['name'], objects[-1]['prims'][0]['tris'], 'triangles')
    rows, clips = [], {}
    if rig.animation_data is None: rig.animation_data_create()
    rest = {b: rig.data.bones[b].matrix_local.inverted() for b in bones}
    for cname, copt in S['clips'].items():
        act = bpy.data.actions.get(copt.get('action', cname))
        if act is None: log('action not found, skipped:', copt.get('action', cname)); continue
        rig.animation_data.action = act
        try:
            if hasattr(rig.animation_data, 'action_slot') and len(act.slots): rig.animation_data.action_slot = act.slots[0]
        except Exception as e: log('slot:', e)
        f0, f1 = int(round(act.frame_range[0])), int(round(act.frame_range[1]))
        loop = bool(copt.get('loop'))
        frames = list(range(f0, f1 if loop else f1 + 1))
        clips[cname] = {'start': len(rows), 'count': len(frames), 'fps': scene.render.fps, 'loop': loop}
        for f in frames:
            scene.frame_set(f); row = []
            for b in bones:
                G = R @ (rig.pose.bones[b].matrix @ rest[b]) @ RI
                for r in range(3): row.extend((G[r][0], G[r][1], G[r][2], G[r][3]))
            rows.append(row)
    tex = np.array(rows, np.float32)
    skins.append({'name': S['name'], 'bones': bones, 'lods': [S.get('as', {}).get(o.name, o.name) for o in lod_obs], 'clips': clips, 'together': bool(S.get('together')), 'width': len(bones) * 3, 'height': len(rows), 'tex': put(tex, 'f32')})
    log('skin', S['name'], len(bones), 'bones,', len(rows), 'frames:', ', '.join('%s %d' % (k, v['count']) for k, v in clips.items()))

J = {'version': 1, 'name': NAME}

# ---------------------------------------------------------------- the sun
sun = next((o for o in scene.objects if o.type == 'LIGHT' and o.data.type == 'SUN' and not o.hide_render), None)
sun_dir_b = None
if sun:
    d = sun.matrix_world.to_3x3() @ Vector((0, 0, 1)); d.normalize(); sun_dir_b = d
    J['sun'] = {'dir': [d.x, d.z, -d.y], 'color': [1, 1, 1], 'strength': float(sun.data.energy), 'lampColor': list(sun.data.color)}

# ---------------------------------------------------------------- collision map + heights (rays straight down through the world)
def world_bvh(only=None):
    verts, polys = [], []
    dg = bpy.context.evaluated_depsgraph_get()
    for ob in world_obs:
        if only and ob.name not in only: continue
        if not only and ob.get('hg_soft'): continue      # drawn, but not solid: no tops, no collision (bushes, fences, poles, crop rows)
        ev = ob.evaluated_get(dg); me = ev.to_mesh(); base = len(verts); mw = ob.matrix_world
        verts.extend(mw @ v.co for v in me.vertices); polys.extend(tuple(base + i for i in p.vertices) for p in me.polygons)
        ev.to_mesh_clear()
    return BVHTree.FromPolygons(verts, polys), verts
bounds = None
if world_obs:
    bvh, bverts = world_bvh()
    TOPZ = max((v.z for v in bverts), default=0.0)       # the highest world point: the tops ray starts above it (a building taller than the ground's highest hill was missed)
    if CFG.get('area'): bverts = world_bvh(set(CFG['area']))[1]      # 'area': the objects whose extent is the playable ground (not a far backdrop)
    xs = [v.x for v in bverts]; ys = [v.y for v in bverts]; zs = [v.z for v in bverts]
    bounds = (min(xs), max(xs), min(ys), max(ys), min(zs), max(zs))
    J['bounds'] = {'min': [bounds[0], bounds[4], -bounds[3]], 'max': [bounds[1], bounds[5], -bounds[2]]}
DOWN = Vector((0, 0, -1))
def column(x, y, top):
    """solid spans [lo, hi] (heights) under (x, y), from the top down"""
    spans, z, enter, last = [], top, None, top
    for _ in range(64):                       # (was 12: a roof, beams and shelves stacked over one spot can take more hits than that)
        loc, nor, idx, dist = bvh.ray_cast(Vector((x, y, z)), DOWN, 1000)
        if loc is None: break
        if nor.z >= 0:                        # a top face: going into something
            if enter is not None and loc.z - bounds[4] < 0.05: spans.append((loc.z, enter))   # a floor patch running under a wall or a prop:
                                                                                              # the thing stands on it (it is not a thin sheet)
            elif enter is not None: spans.append((enter - 0.06, enter))      # the one before was a thin sheet
            enter = loc.z
        elif enter is not None: spans.append((loc.z, enter)); enter = None; last = loc.z    # an underside: coming out
        else: spans.append((loc.z, last)); last = loc.z      # an underside with no top seen: a solid whose top is hidden (a wall that meets or
                                                             # pierces the roof or a beam above it): it runs up to where the last span ended
        z = loc.z - 0.002
    if enter is not None: spans.append((-1000.0, enter))
    return spans
G = CFG.get('grid')
if G and bounds:
    cell = float(G.get('cell', 0.25)); sub = int(G.get('sub', 2)); pad = float(G.get('pad', 1.0))
    x0 = bounds[0] - pad; z0 = -bounds[3] - pad
    nx = int(math.ceil((bounds[1] - bounds[0] + 2 * pad) / cell)); nz = int(math.ceil((bounds[3] - bounds[2] + 2 * pad) / cell))
    floor = float(G.get('floor', bounds[4])); top = bounds[5] + 1
    data = np.zeros((nz, nx, 4), np.uint8); data[:, :, 0] = 255; data[:, :, 2] = 255
    data2 = np.zeros((nz, nx, 2), np.uint8); data2[:, :, 0] = 255      # a third block per column: whatever is above the second (a roof over a table)
    Q = 0.05
    for iz in range(nz):
        for ix in range(nx):
            a = [1e9, -1e9]; ups = []       # the lower block (touches the ground); every span above it, to be grouped
            for sz in range(sub):
                for sx in range(sub):
                    gx = x0 + (ix + (sx + 0.5) / sub) * cell; gz = z0 + (iz + (sz + 0.5) / sub) * cell
                    for lo, hi in column(gx, -gz, top):
                        lo -= floor; hi -= floor
                        if hi < 0.12: continue                    # the ground itself
                        if lo < 0.45: a[0] = min(a[0], max(lo, 0)); a[1] = max(a[1], hi)
                        else: ups.append((lo, hi))
            if a[1] > 0: data[iz, ix, 0] = max(0, int(a[0] / Q)); data[iz, ix, 1] = min(255, int(math.ceil(a[1] / Q)))
            # what is above the ground block, from the bottom up: spans less than half a metre apart are one thing (nothing gets between them);
            # a thing thinner than 10 cm that only part of the cell's rays met is a wire or a cable: nothing stops on it, no shot, no jump.
            # The lowest thing is the second block (a table top, a truck bed, a railing, a beam); all that is above it is the third (a roof).
            groups = []
            for lo, hi in sorted(ups):
                if groups and lo - groups[-1][1] < 0.5: groups[-1][1] = max(groups[-1][1], hi); groups[-1][2] += 1
                else: groups.append([lo, hi, 1])
            groups = [g for g in groups if not (g[1] - g[0] < 0.1 and g[2] <= sub)]
            if groups:
                data[iz, ix, 2] = min(254, int(groups[0][0] / Q)); data[iz, ix, 3] = min(255, int(math.ceil(groups[0][1] / Q)))
                if len(groups) > 1: data2[iz, ix, 0] = min(254, int(min(g[0] for g in groups[1:]) / Q)); data2[iz, ix, 1] = min(255, int(math.ceil(max(g[1] for g in groups[1:]) / Q)))
    J['grid'] = {'x0': x0, 'z0': z0, 'cell': cell, 'nx': nx, 'nz': nz, 'q': Q, 'floor': floor, 'data': put(data, 'u8'), 'data2': put(data2, 'u8')}
    log('collision map', nx, 'x', nz, 'cells of', cell, 'm;', int((data[:, :, 1] > 0).sum()), 'blocked')
GROUND = None
H = CFG.get('heights')
if H and bounds:
    cell = float(H.get('cell', 1.0)); x0 = bounds[0]; z0 = -bounds[3]
    nx = int(round((bounds[1] - bounds[0]) / cell)) + 1; nz = int(round((bounds[3] - bounds[2]) / cell)) + 1
    hs = np.zeros((nz, nx), np.float32); tops = np.zeros((nz, nx), np.float32)
    ground_bvh = world_bvh(set(H['ground']))[0] if H.get('ground') else bvh       # 'ground': the objects that are the ground itself
    for iz in range(nz):
        for ix in range(nx):
            gx = min(x0 + ix * cell, bounds[1] - 0.01); gy = max(-(z0 + iz * cell), bounds[2] + 0.01); gx = max(gx, bounds[0] + 0.01); gy = min(gy, bounds[3] - 0.01)
            loc, nor, idx, dist = ground_bvh.ray_cast(Vector((gx, gy, bounds[5] + 1)), DOWN, 1000)
            hs[iz, ix] = loc.z if loc is not None else bounds[4]
            loc, nor, idx, dist = bvh.ray_cast(Vector((gx, gy, max(bounds[5], TOPZ) + 1)), DOWN, 2000)
            tops[iz, ix] = loc.z if loc is not None else hs[iz, ix]
    GROUND = (ground_bvh, x0, z0, cell, nx, nz, hs)
    J['heights'] = {'x0': x0, 'z0': z0, 'cell': cell, 'nx': nx, 'nz': nz, 'data': put(hs, 'f32'), 'tops': put(tops, 'f32')}
    log('height map', nx, 'x', nz)

# ---------------------------------------------------------------- baked light for moving things
def bake_plane(x0, y0, nx, ny, cell, h, samples, follow):
    me = bpy.data.meshes.new('hg_probe')
    if follow:                                # a sheet that keeps h above the ground (hills)
        gb = follow[0]; vs, fs, uvs = [], [], []
        for j in range(ny + 1):
            for i in range(nx + 1):
                px = min(max(x0 + i * cell, bounds[0] + 0.01), bounds[1] - 0.01); py = min(max(y0 + j * cell, bounds[2] + 0.01), bounds[3] - 0.01)
                loc, nor, idx, dist = gb.ray_cast(Vector((px, py, bounds[5] + 1)), DOWN, 1000)
                vs.append((x0 + i * cell, y0 + j * cell, (loc.z if loc is not None else bounds[4]) + h))
        for j in range(ny):
            for i in range(nx): a = j * (nx + 1) + i; fs.append((a, a + 1, a + nx + 2, a + nx + 1))
        me.from_pydata(vs, [], fs)
        uvl = me.uv_layers.new(name='UVMap')
        for lp in me.loops: v = lp.vertex_index; uvl.data[lp.index].uv = ((v % (nx + 1)) / nx, (v // (nx + 1)) / ny)
    else:
        me.from_pydata([(x0, y0, h), (x0 + nx * cell, y0, h), (x0 + nx * cell, y0 + ny * cell, h), (x0, y0 + ny * cell, h)], [], [(0, 1, 2, 3)])
        uvl = me.uv_layers.new(name='UVMap')
        for i, uv in enumerate(((0, 0), (1, 0), (1, 1), (0, 1))): uvl.data[i].uv = uv
    ob = bpy.data.objects.new('hg_probe', me); scene.collection.objects.link(ob)
    ob.visible_shadow = False; ob.visible_diffuse = False; ob.visible_glossy = False; ob.visible_camera = False
    mat = bpy.data.materials.new('hg_probe'); mat.use_nodes = True
    img = bpy.data.images.new('hg_probe', nx, ny, alpha=False, float_buffer=True)
    tn = mat.node_tree.nodes.new('ShaderNodeTexImage'); tn.image = img; mat.node_tree.nodes.active = tn
    me.materials.append(mat)
    for o in bpy.context.view_layer.objects: o.select_set(False)
    ob.select_set(True); bpy.context.view_layer.objects.active = ob
    scene.render.engine = 'CYCLES'; scene.cycles.samples = samples
    try: scene.cycles.use_denoising = False
    except Exception: pass
    def bake(passes):
        bpy.ops.object.bake(type='DIFFUSE', pass_filter=passes, margin=0, use_clear=True)
        return image_pixels(img)[:, :, :3].copy()
    undo = []
    for o in scene.objects:              # only the world is in the picture: no gun, no figure, no helper standing at the origin
        if o.type != 'LIGHT' and o is not ob and o not in world_obs and not o.hide_render: o.hide_render = True; undo.append(lambda o=o: setattr(o, 'hide_render', False))
    full = bake({'DIRECT', 'INDIRECT'})
    # the sun alone: no sky, no lamps
    world = scene.world; scene.world = None
    for o in scene.objects:
        if o.type == 'LIGHT' and o is not sun and not o.hide_render: o.hide_render = True; undo.append(lambda o=o: setattr(o, 'hide_render', False))
    for m in bpy.data.materials:
        if not m.use_nodes: continue
        for n in m.node_tree.nodes:
            i = n.inputs.get('Emission Strength') if n.type == 'BSDF_PRINCIPLED' else n.inputs.get('Strength') if n.type == 'EMISSION' else None
            if i is not None and not i.is_linked and i.default_value > 0: v = i.default_value; i.default_value = 0; undo.append(lambda i=i, v=v: setattr(i, 'default_value', v))
    sun_only = bake({'DIRECT'}) if sun else np.zeros_like(full)
    scene.world = world
    for u in undo: u()
    bpy.data.objects.remove(ob); bpy.data.meshes.remove(me); bpy.data.materials.remove(mat); bpy.data.images.remove(img)
    return full, sun_only
PB = CFG.get('probes')
if PB and bounds:
    follow = GROUND if PB.get('follow') else None
    cell = float(PB.get('cell', 1.0)); h = float(PB.get('height', 1.0)) + (0 if follow else bounds[4])
    x0, y0 = bounds[0], bounds[2]
    nx = int(math.ceil((bounds[1] - bounds[0]) / cell)); ny = int(math.ceil((bounds[3] - bounds[2]) / cell))
    cache = os.path.join(CACHE, NAME + '_probes.npz')
    stamp = [x0, y0, nx, ny, cell, h, 1 if follow else 0, os.path.getmtime(bpy.data.filepath) if bpy.data.filepath else 0]
    full = None
    if os.path.exists(cache) and not CFG.get('rebake'):
        z = np.load(cache)
        if list(z['stamp']) == stamp: full, sun_only = z['full'], z['sun']; log('baked light: from cache')
    if full is None:
        log('baking light at', nx, 'x', ny, 'spots...')
        full, sun_only = bake_plane(x0, y0, nx, ny, cell, h, int(PB.get('samples', 64)), follow)
        np.savez(cache, stamp=np.array(stamp), full=full, sun=sun_only)
    lum = lambda a: a[:, :, 0] * 0.2126 + a[:, :, 1] * 0.7152 + a[:, :, 2] * 0.0722
    sl = lum(sun_only); peak = float(np.percentile(sl, 99.5)) if sl.max() > 0 else 0.0
    vis = np.clip(sl / peak, 0, 1) if peak > 0 else np.zeros_like(sl)
    amb = np.clip(full - sun_only, 0, None)
    # spots inside something solid came out black: fill them from their neighbours
    bad = lum(full) < 0.02 * float(np.median(lum(full)) + 1e-6)
    for _ in range(4):
        if not bad.any(): break
        acc = np.zeros_like(amb); av = np.zeros_like(vis); cnt = np.zeros_like(vis); ok = ~bad
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sa = np.roll(amb, (dy, dx), (0, 1)); sv = np.roll(vis, (dy, dx), (0, 1)); so = np.roll(ok, (dy, dx), (0, 1))
            acc += sa * so[:, :, None]; av += sv * so; cnt += so
        fill = bad & (cnt > 0)
        amb[fill] = acc[fill] / cnt[fill][:, None]; vis[fill] = av[fill] / cnt[fill]; bad = bad & ~fill
    data = np.concatenate([amb, vis[:, :, None]], axis=2)[::-1]          # rows: Blender +y -> game -z
    J['probes'] = {'x0': x0 + cell / 2, 'z0': -(y0 + ny * cell) + cell / 2, 'cell': cell, 'nx': nx, 'nz': ny, 'data': put(data, 'f32')}
    if sun and peak > 0:
        k = np.array([float(np.percentile(sun_only[:, :, c], 99.5)) for c in range(3)]) / max(sun_dir_b.z, 0.05)
        J['sun']['color'] = [float(v) for v in k]
    J['ambient'] = [float(v) for v in np.median(amb.reshape(-1, 3), axis=0)]
    log('baked light: sun', J.get('sun', {}).get('color'), 'ambient', J['ambient'])

# ---------------------------------------------------------------- the sky, all the way round
SK = CFG.get('sky')
if SK and scene.world:
    w = int(SK.get('width', 1024)); path = os.path.join(CACHE, NAME + '_sky.exr')
    tmp = bpy.data.scenes.new('hg_sky'); tmp.world = scene.world; tmp.render.engine = 'CYCLES'; tmp.cycles.samples = int(SK.get('samples', 16))
    cam = bpy.data.cameras.new('hg_sky'); cam.type = 'PANO'
    try: cam.panorama_type = 'EQUIRECTANGULAR'
    except Exception: cam.cycles.panorama_type = 'EQUIRECTANGULAR'
    co = bpy.data.objects.new('hg_sky', cam); tmp.collection.objects.link(co); tmp.camera = co
    co.rotation_euler = (math.pi / 2, 0, -math.pi / 2)       # looks along +X: the middle of the picture is +X, as Blender's world map has it
    tmp.render.resolution_x = w; tmp.render.resolution_y = w // 2; tmp.render.resolution_percentage = 100
    tmp.render.image_settings.file_format = 'OPEN_EXR'; tmp.render.image_settings.color_depth = '32'; tmp.render.filepath = path
    bpy.ops.render.render(scene=tmp.name, write_still=True)
    img = bpy.data.images.load(path, check_existing=False); a = image_pixels(img)[:, :, :3].copy(); bpy.data.images.remove(img)
    bpy.data.scenes.remove(tmp); bpy.data.objects.remove(co); bpy.data.cameras.remove(cam)
    rng = float(min(max(np.percentile(a, 99.0) * 1.5, 1.0), 16.0))
    t = add_texture(('sky',), lambda: lin_to_srgb(a / rng), NAME + '_sky' + EXT, True, False, 90)
    low = a[: a.shape[0] // 2 - 2].reshape(-1, 3).mean(axis=0); hor = a[a.shape[0] // 2 + 2: a.shape[0] // 2 + 12].reshape(-1, 3).mean(axis=0)
    J['sky'] = {'map': t, 'range': rng, 'horizon': [float(v) for v in hor]}
    log('sky: range', round(rng, 2), 'horizon', J['sky']['horizon'])

# ---------------------------------------------------------------- glow points: empties named glow.NNN (custom properties r, g, b in 0..1 linear,
# size = metres the light reaches), for halos and lit motes in the game: "glows": [[x, y, z, r, g, b, size], ...] in game axes. Only when there are some.
GLOWS = sorted((o for o in scene.objects if o.type == 'EMPTY' and o.name.startswith('glow.')), key=lambda o: o.name)
if GLOWS:
    J['glows'] = [[round(p.x, 3), round(p.z, 3), round(-p.y, 3)] + [round(float(o.get(k, 1.0)), 3) for k in ('r', 'g', 'b')] + [round(float(o.get('size', 3.0)), 2)]
                  for o in GLOWS for p in (o.matrix_world.translation,)]
    log('glow points:', len(GLOWS))

J.update({'textures': textures, 'materials': materials, 'objects': objects, 'skins': skins})
J['exposure'] = float(2 ** scene.view_settings.exposure)
js = json.dumps(J, separators=(',', ':')).encode('utf8')
js += b' ' * ((4 - len(js) % 4) % 4)
with open(OUT + '.hgm', 'wb') as f:
    f.write(b'HGM1'); f.write(struct.pack('<I', len(js))); f.write(js); f.write(blob)
log('wrote', OUT + '.hgm', '%.0f KB' % ((8 + len(js) + len(blob)) / 1024), '|', len(textures), 'pictures,', len(objects), 'objects,',
    sum(p['tris'] for o in objects for p in o['prims']), 'triangles')
