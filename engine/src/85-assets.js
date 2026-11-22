// ============================================================
// Assets: real models made in Blender, with the expensive light worked out there and baked into pictures
// (tools/blender/hg_export.py writes the files). The game then only multiplies: colour x baked light.
//   const a = await HG3D.load('assets/yard.hgm');      // one binary file + the pictures beside it
//   scene.add(a.scene);                                 // the static world, already lightmapped
//   const gun = a.objects.gun;  HG3D.place(gun, matrix) // a moving thing: its parts follow their parent
//   const tank2 = a.copy('tank_hull');                   // another one of a part tree, with its own materials
//   const crowd = a.crowd('enemy', 48);                 // animated figures: one draw call per detail level
//   a.probe(x, z, out)                                  // the baked light at a spot, for things that move
// File: 'HGM1', uint32 JSON length, the JSON (padded to 4 bytes), then one block of raw arrays the JSON points
// into. Pictures are loaded upside-down-free (the exporter flips v), so they decode off the main thread.
// ============================================================
const HGM_TYPES = { f32: Float32Array, u16: Uint16Array, u32: Uint32Array, u8: Uint8Array, i8: Int8Array, i16: Int16Array };
const IDENT16 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

// a picture from a file. The texture can be used at once (white until it has arrived); t.ready resolves when it is in.
function loadTexture(url, o) {
    o = o || {};
    const t = texture({ width: 0, height: 0 }, o); t.flipY = false; t.url = url; t.releaseImage = o.keep !== true; t.image = { width: 0, height: 0 };
    let busy = false;
    const get = () => { busy = true; return fetch(url).then(r => { if (!r.ok) throw new Error(url + ': ' + r.status); return r.blob(); })
        .then(b => createImageBitmap(b, o.resize ? { premultiplyAlpha: 'none', colorSpaceConversion: 'none', resizeWidth: o.resize[0], resizeHeight: o.resize[1], resizeQuality: 'high' } : { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }))
        .then(bm => { busy = false; t.image = bm; t.width = bm.width; t.height = bm.height; t.needsUpdate = true; return t; }, e => { busy = false; throw e; }); };
    t.restore = () => { if (!busy) get().catch(() => { }); };        // after a lost context: the picture was let go once it was on the GPU
    t.ready = get();
    return t;
}

// ---- the three shader add-ons the assets use (hook points: 20-shaders.js) ----
// static world: unlit colour x the baked light picture (second UV set; stored as sqrt(light / range))
function lightmapHook(tex, range) {
    return { key: 'hg-lightmap', vDecl: 'in vec2 uv2; out vec2 vUv2;', vMain: ' vUv2 = uv2;',
        fDecl: 'in vec2 vUv2; uniform sampler2D uLightMap; uniform float uLmRange;',
        fAlbedo: ' { vec3 lm = texture(uLightMap, vUv2).rgb; alb *= lm * lm * uLmRange; }',
        uniforms: { uLightMap: { value: tex }, uLmRange: { value: range } } };
}
// a moving thing: the scene's own lights give it shape, the baked light at the spot it stands on gives the amount
// (rgb scales the ambient part, a the sun). Set material.probe (4 floats) from asset.probe().
const PROBE_MAIN = '#if !defined(UNLIT) && !defined(VFINAL)\n vLa *= HG_L.rgb; vLs *= HG_L.a;\n#ifdef SPEC_VERTEX\n vSp *= HG_L.a;\n#endif\n#endif';
function probeHook() { const v = new Float32Array([1, 1, 1, 1]); return { key: 'hg-probe', vDecl: 'uniform vec4 uProbe;\n#define HG_L uProbe', vMain: PROBE_MAIN, fFinal: '\n', uniforms: { uProbe: { value: v } } }; }
// animated figures: every instance reads its bones for its own frame from a float texture (3 texels = one 3x4 bone
// matrix, one row per frame), two bones per vertex. aSkin = bone, bone, weight*255, weight*255; per instance:
// aAnim = frame, flash, a second frame, how much of it (0: none; blends two poses: between frames, or from one clip into the next); aLight = the probe.
function skinHook(tex) {
    return { key: 'hg-skin',
        vDecl: `in vec4 aSkin; in vec4 aAnim; in vec4 aLight; uniform highp sampler2D uSkinTex;
#define HG_L aLight
mat4 hgBone(float b, int f){ int x = int(b + 0.5) * 3; vec4 r0 = texelFetch(uSkinTex, ivec2(x, f), 0), r1 = texelFetch(uSkinTex, ivec2(x + 1, f), 0), r2 = texelFetch(uSkinTex, ivec2(x + 2, f), 0);
 return mat4(vec4(r0.x, r1.x, r2.x, 0.0), vec4(r0.y, r1.y, r2.y, 0.0), vec4(r0.z, r1.z, r2.z, 0.0), vec4(r0.w, r1.w, r2.w, 1.0)); }`,
        vPos: ' int hgF = int(aAnim.x + 0.5); mat4 hgSk = hgBone(aSkin.x, hgF) * (aSkin.z / 255.0) + hgBone(aSkin.y, hgF) * (aSkin.w / 255.0); if (aAnim.w > 0.0) { int hgG = int(aAnim.z + 0.5); hgSk = hgSk * (1.0 - aAnim.w) + (hgBone(aSkin.x, hgG) * (aSkin.z / 255.0) + hgBone(aSkin.y, hgG) * (aSkin.w / 255.0)) * aAnim.w; } p4 = hgSk * p4;',
        vNormal: ' n = mat3(hgSk) * n;',
        vMain: PROBE_MAIN + '\n#if !defined(UNLIT) && !defined(VFINAL)\n vEm += vec3(aAnim.y);\n#endif', fFinal: '\n', uniforms: { uSkinTex: { value: tex } } };
}

// node.matrixWorld = parent x node.local, and the same for everything under it (asset parts carry .local)
function place(n, parent) {
    const e = n.matrixWorld.elements; if (n.local) M4.mul(e, parent, n.local); else M4.copy(e, parent);
    const ch = n.children; for (let i = 0; i < ch.length; i++) place(ch[i], e);
    return n;
}

// the sky as a picture all the way round (Blender's equirectangular layout), drawn last behind everything
function skyDome(tex, radius) {
    const g = geo.sphere(radius || 400, 32, 16), uv = g.attributes.uv.array;
    for (let i = 0; i < uv.length; i += 2) { uv[i] = 1 - uv[i]; uv[i + 1] = 1 - uv[i + 1]; }
    tex.wrapS = 1000;
    const m = mesh(g, material({ lit: false, map: tex, side: 1, fog: false, depthWrite: false, hg: { sky: true } })); m.frustumCulled = false;
    return m;
}

async function load(url, o) {
    o = o || {};
    const res = await fetch(url); if (!res.ok) throw new Error(url + ': ' + res.status);
    const buf = await res.arrayBuffer(), dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x314d4748) throw new Error(url + ' is not an HGM file');
    const jl = dv.getUint32(4, true), J = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, jl))), base = 8 + jl, dir = url.replace(/[^/]*$/, '');
    const view = v => new HGM_TYPES[v.type](buf, base + v.off, v.n);
    const A = { json: J, url, bytes: buf.byteLength, scene: node(), objects: {}, skins: {}, textures: [], materials: [], view };
    // o.shrink(file, w, h) -> the most pixels across this picture may have (0: as it is): memory against sharpness, the game's call
    const small = t => { const m = o.shrink && t.w ? o.shrink(t.file, t.w, t.h) : 0; return m && t.w > m ? [m, Math.max(1, Math.round(t.h * m / t.w))] : null; };
    A.textures = (J.textures || []).map(t => loadTexture(dir + t.file, { srgb: t.srgb !== false, repeat: !!t.repeat, anisotropy: t.repeat ? (o.anisotropy || 1) : 1, resize: small(t) }));
    A.materials = (J.materials || []).map(m => {
        const map = m.map >= 0 ? A.textures[m.map] : null; let mat;
        if (m.lightMap >= 0) mat = material({ lit: false, map, hg: lightmapHook(A.textures[m.lightMap], m.lmRange || 8) });
        else if (m.unlit) mat = material({ lit: false, map });
        else { mat = material({ map, roughness: m.roughness === undefined ? 1 : m.roughness, metalness: m.metalness || 0, hg: probeHook() }); mat.probe = mat.userData.hg.uniforms.uProbe.value; }
        if (m.color) { mat.color.r = m.color[0]; mat.color.g = m.color[1]; mat.color.b = m.color[2]; }      // linear, may be above 1 (a lamp)
        if (m.doubleSided) mat.side = 2;
        mat.name = m.name; return mat;
    });
    A.geo = p => {
        const at = {}; for (const k in p.attrs) { const v = p.attrs[k], a = attr(view(v), v.size); if (v.norm) a.normalized = true; at[k] = a; }
        const g = geometry(at, attr(view(p.index), 1)); g.boundingSphere = { center: { x: p.bs[0], y: p.bs[1], z: p.bs[2] }, radius: p.bs[3] }; return g;
    };
    const skinned = {}; for (const s of J.skins || []) for (const n of s.lods) skinned[n] = 1;
    for (const ob of J.objects || []) {
        const n = node(); n.name = ob.name; n.local = new Float32Array(ob.local || IDENT16); n.rest = new Float32Array(n.local); n.parentName = ob.parent || null; n.info = ob;
        if (!skinned[ob.name]) for (const p of ob.prims) { const m = mesh(A.geo(p), A.materials[p.material]); m.name = ob.name; n.add(m); }
        A.objects[ob.name] = n;
    }
    for (const ob of J.objects || []) { const n = A.objects[ob.name], p = ob.parent && A.objects[ob.parent]; if (p) p.add(n); else if (ob.world) A.scene.add(n); }
    // another copy of a part and everything under it (call it after the file's own tree is linked). The copy shares the
    // geometry but has materials of its own, so each copy is lit where it stands (material.probe) and can be tinted
    // (material.color). copy.materials lists them; copy.find(name) gives a node of the copy.
    A.copy = name => {
        const src = A.objects[name]; if (!src) return null; const mats = new Map(), byName = {};
        const cm = m => { if (!m.probe) return m; let c = mats.get(m); if (!c) { c = material({ map: m.map, roughness: m.roughness, metalness: m.metalness, hg: probeHook() }); c.probe = c.userData.hg.uniforms.uProbe.value; c.color.r = m.color.r; c.color.g = m.color.g; c.color.b = m.color.b; c.side = m.side; c.name = m.name; mats.set(m, c); } return c; };
        const walk = n => { const c = node(); c.name = n.name; c.local = new Float32Array(n.rest || n.local || IDENT16); c.rest = new Float32Array(c.local); c.info = n.info; byName[n.name] = c; for (const ch of n.children) { if (ch.isMesh) { const m = mesh(ch.geometry, cm(ch.material)); m.name = ch.name; c.add(m); } else c.add(walk(ch)); } return c; };
        const out = walk(src); out.materials = [...mats.values()]; out.find = n => byName[n] || null; return out;
    };
    place(A.scene, IDENT16);
    for (const s of J.skins || []) {
        const tex = texture({ data: view(s.tex), width: s.width, height: s.height }, { nearest: true, srgb: false, type: 1015 });
        A.skins[s.name] = { name: s.name, bones: s.bones, clips: s.clips, lods: s.lods, together: !!s.together, tex, frames: s.height };
    }
    // the frame of a clip at a time (seconds since the clip began)
    // the same, smoothly: out = [this frame, the next one, how far between them] (for a model seen close, like first-person arms)
    A.frame2 = (clip, t, out) => { const x = Math.max(0, t * clip.fps), f = Math.floor(x), n = clip.count; out[0] = clip.start + (clip.loop ? f % n : Math.min(f, n - 1)); out[1] = clip.start + (clip.loop ? (f + 1) % n : Math.min(f + 1, n - 1)); out[2] = x - f; return out; };
    A.frame = (clip, t) => { const f = Math.floor(t * clip.fps); return clip.start + (clip.loop ? f % clip.count : Math.min(f, clip.count - 1)); };
    A.crowd = (name, max) => crowd(A, name, max || 32);
    const P = J.probes;
    if (P) {
        const d = view(P.data), nx = P.nx, nz = P.nz;
        // the baked light at a spot: out = [r, g, b of the ambient light, how much of the sun reaches it]
        A.probe = (x, z, out) => {
            let fx = (x - P.x0) / P.cell, fz = (z - P.z0) / P.cell; fx = fx < 0 ? 0 : fx > nx - 1.001 ? nx - 1.001 : fx; fz = fz < 0 ? 0 : fz > nz - 1.001 ? nz - 1.001 : fz;
            const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, a = (iz * nx + ix) * 4, b = a + 4, c = a + nx * 4, e = c + 4, w0 = (1 - tx) * (1 - tz), w1 = tx * (1 - tz), w2 = (1 - tx) * tz, w3 = tx * tz;
            for (let k = 0; k < 4; k++) out[k] = d[a + k] * w0 + d[b + k] * w1 + d[c + k] * w2 + d[e + k] * w3;
            return out;
        };
    } else A.probe = (x, z, out) => { out[0] = out[1] = out[2] = out[3] = 1; return out; };
    A.ready = Promise.all(A.textures.map(t => t.ready)).then(() => A);
    if (o.wait !== false) await A.ready;
    return A;
}

// Many animated figures drawn as one instanced mesh per detail level. Each frame: begin(), add(...) per figure, end().
function crowd(A, name, max) {
    const S = A.skins[name]; if (!S) throw new Error('no animated model "' + name + '" in ' + A.url);
    const C = { node: node(), clips: S.clips, lods: [], lodDist: [14, 30], max, drawn: 0, together: S.together };     // together: the meshes are pieces of one model, not detail levels
    for (const obName of S.lods) {
        const p = A.objects[obName].info.prims[0], g = A.geo(p);
        g.attributes.aAnim = attr(new Float32Array(max * 4), 4, true); g.attributes.aLight = attr(new Float32Array(max * 4), 4, true);
        const m = instanced(g, material({ map: A.materials[p.material].map, hg: skinHook(S.tex) }), max); m.name = obName;
        C.node.add(m); C.lods.push(m);
    }
    C.begin = () => { for (let i = 0; i < C.lods.length; i++) C.lods[i].count = 0; C.drawn = 0; };
    // where it stands, which way it faces (radians about the up axis), size, animation frame (asset.frame), light = [r,g,b,sun]
    // from asset.probe, flash 0..1 (a hit), and how far the camera is (picks the detail level)
    // frame2, blend: a second pose and how much of it (asset.frame2, or a fade from one clip into another)
    C.add = (x, y, z, yaw, scale, frame, light, flash, dist, frame2, blend) => {
        const L = C.lods.length; if (C.together) { for (let k = 0; k < L; k++) put(C.lods[k]); C.drawn++; return; }
        put(C.lods[dist < C.lodDist[0] || L < 2 ? 0 : dist < C.lodDist[1] || L < 3 ? 1 : 2]); C.drawn++;
        function put(m) { const i = m.count; if (i >= max) return;
        const e = m.instanceMatrix.array, o = i * 16, c = Math.cos(yaw) * scale, s = Math.sin(yaw) * scale;
        e[o] = c; e[o + 1] = 0; e[o + 2] = -s; e[o + 3] = 0; e[o + 4] = 0; e[o + 5] = scale; e[o + 6] = 0; e[o + 7] = 0; e[o + 8] = s; e[o + 9] = 0; e[o + 10] = c; e[o + 11] = 0; e[o + 12] = x; e[o + 13] = y; e[o + 14] = z; e[o + 15] = 1;
        const an = m.geometry.attributes.aAnim.array, li = m.geometry.attributes.aLight.array, q = i * 4;
        an[q] = frame; an[q + 1] = flash || 0; an[q + 2] = frame2 || 0; an[q + 3] = blend || 0; li[q] = light[0]; li[q + 1] = light[1]; li[q + 2] = light[2]; li[q + 3] = light[3];
        m.count = i + 1; }
    };
    C.end = () => { for (let i = 0; i < C.lods.length; i++) { const m = C.lods[i]; if (m.count === 0) continue; m.instanceMatrix.needsUpdate = true; m.geometry.attributes.aAnim.needsUpdate = true; m.geometry.attributes.aLight.needsUpdate = true; } };
    return C;
}
