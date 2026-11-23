// ============================================================
// The frame: walk the scene once (no recursion, no allocation), keep a small cached "item" on every
// drawable (program + vertex array), fill the frame uniform block, draw the shadow map, then draw
// opaque things grouped by program, the sky last (only the pixels nothing else covered), then
// transparent things back to front.
// ============================================================
const DEPTH_FUNCS = [0x0200, 0x0207, 0x0201, 0x0203, 0x0202, 0x0206, 0x0204, 0x0205];   // three's depthFunc 0..7 -> GL
const TMP = { mat: new Float32Array(16), m: new Float32Array(16), mv: new Float32Array(16), n3: new Float32Array(9), vp: new Float32Array(16), lv: new Float32Array(16), lp: new Float32Array(16), lvp: new Float32Array(16),
    id3: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), planes: new Float32Array(24), bias: new Float32Array([0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0.5, 0, 0.5, 0.5, 0.5, 1]) };
const K_LIT = 0, K_UNLIT = 1, K_RAW = 2, K_POINTS = 3, K_SPRITE = 4;
function setFrustumFast(pl, m) {
    let k = 0;
    for (let i = 0; i < 3; i++) for (let s = -1; s <= 1; s += 2) {
        const x = m[3] + s * m[i], y = m[7] + s * m[4 + i], z = m[11] + s * m[8 + i], d = m[15] + s * m[12 + i], l = 1 / (Math.hypot(x, y, z) || 1);
        pl[k++] = x * l; pl[k++] = y * l; pl[k++] = z * l; pl[k++] = d * l;
    }
}
function newLists() { return { stack: [], objs: [], n: 0, casters: [], nc: 0, opaque: [], no: 0, transp: [], nt: 0, sky: [], ns: 0 }; }
function newLights() { return { hemi: null, ar: 0, ag: 0, ab: 0, sun0: null, sun1: null, nSun: 0, pl: [null, null, null, null, null, null, null, null], nPL: 0 }; }
// the one quad every sprite shares
function spriteGeometry(E) {
    if (E.spriteGeo) return E.spriteGeo;
    const A = (array, itemSize) => ({ array, itemSize, count: array.length / itemSize, version: 1, normalized: false, usage: 35044 });
    return E.spriteGeo = { attributes: { position: A(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3), uv: A(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2) }, index: A(new Uint16Array([0, 1, 2, 0, 2, 3]), 1), drawRange: { start: 0, count: Infinity }, boundingSphere: null };
}

function materialInfo(E, mat) {
    let mi = mat.__hgm;
    if (mi !== undefined && mi.v === mat.version) return mi;
    mi = mat.__hgm = { v: mat.version, kind: -1, hook: null, hookId: 0, sky: false, spec: 0, shin: 1, specScale: 0, metal: 0, rawId: 0, transparent: false, blend: 0, depthTest: 1, depthWrite: 1, depthFunc: 0x0203, cull: 1, poly: 0, pf: 0, pu: 0 };
    const ud = mat.userData && mat.userData.hg;
    if (ud) { mi.sky = !!ud.sky; if (ud.vDecl || ud.vPos || ud.vNormal || ud.vAlbedo || ud.vMain || ud.fDecl || ud.fAlbedo || ud.fFinal || ud.customMap || ud.vertexLights) { mi.hook = ud; if (!ud.__id) { if (ud.key) { const hk = E.hookKeys || (E.hookKeys = {}); ud.__id = hk[ud.key] || (hk[ud.key] = E.nextHookId++); } else ud.__id = E.nextHookId++; } mi.hookId = ud.__id; } }
    if (mat.isShaderMaterial) {
        mi.kind = K_RAW; const src = mat.vertexShader + '\u0000' + mat.fragmentShader + '\u0000' + JSON.stringify(mat.defines || {}) + (mat.vertexColors ? 'c' : '');
        if (!E.rawIds) E.rawIds = new Map(); let id = E.rawIds.get(src); if (id === undefined) { id = E.rawIds.size + 1; E.rawIds.set(src, id); } mi.rawId = id;
    } else if (mat.isMeshBasicMaterial || mat.isLineBasicMaterial) mi.kind = K_UNLIT;
    else if (mat.isPointsMaterial) mi.kind = K_POINTS;
    else if (mat.isSpriteMaterial) mi.kind = K_SPRITE;
    else if (mat.isMeshLambertMaterial || mat.isMeshStandardMaterial || mat.isMeshPhongMaterial || mat.isMeshToonMaterial || mat.isMeshMatcapMaterial) {
        mi.kind = K_LIT;
        if (mat.isMeshStandardMaterial) {      // roughness -> a Blinn-Phong lobe of about the same width
            const r = Math.max(0.05, mat.roughness === undefined ? 1 : mat.roughness), a2 = r * r * r * r, n = Math.min(256, Math.max(1, 2 / a2 - 2));
            mi.metal = mat.metalness || 0; mi.shin = n; mi.specScale = (n + 8) / 8;
            mi.spec = (r < 0.9 || mi.metal > 0.05) ? (r < 0.4 ? 2 : 1) : 0;
        } else if (mat.isMeshPhongMaterial) { mi.shin = Math.max(1, mat.shininess === undefined ? 30 : mat.shininess); mi.specScale = 0.25 * (mi.shin * 0.5 + 1); mi.spec = mi.shin > 60 ? 2 : 1; }
    } else warnOnce('material type ' + (mat.type || '?') + ' is not supported; object skipped');
    return mi;
}
function refreshState(mi, mat) {     // cheap, every frame: games flip these without telling anyone
    const tr = mat.transparent === true, bl = mat.blending === undefined ? 1 : mat.blending;
    mi.transparent = tr; mi.blend = (bl === 1 && !tr) ? 0 : bl;
    mi.depthTest = mat.depthTest === false ? 0 : 1; mi.depthWrite = mat.depthWrite === false ? 0 : 1; mi.depthFunc = DEPTH_FUNCS[mat.depthFunc === undefined ? 3 : mat.depthFunc];
    mi.cull = mat.side === 2 ? 0 : mat.side === 1 ? 2 : 1;
    mi.poly = mat.polygonOffset === true ? 1 : 0; mi.pf = mat.polygonOffsetFactor || 0; mi.pu = mat.polygonOffsetUnits || 0;
}
function newItem(E, o, geo) {
    const old = o.__hg, mat = o.material;
    if (old !== undefined && old.vao && old.gen === E.gen) { E.gl.deleteVertexArray(old.vao); if (E.S.vao === old.vao) E.S.vao = null; E.stats.geometries--; }
    const it = o.__hg = { gen: E.gen, o, geo, mat, matV: mat.version, mi: null, iCol: o.instanceColor || null, iMat: o.instanceMatrix || null, recv: o.receiveShadow === true, pos: geo.attributes ? geo.attributes.position : null,
        inst: o.isInstancedMesh === true, gInst: false, gMax: Infinity, env: -1, prog: null, vao: null, layout: null, attrs: [], attrInst: [], na: 0, idx: null, idxType: 0, idxBytes: 2, mode: 4, key: 0, z: 0, ro: 0 };
    if (Array.isArray(mat)) { warnOnce('multi-material meshes are not supported; object skipped'); it.mi = { kind: -1 }; return it; }
    it.mi = materialInfo(E, mat);
    it.mode = o.isLineSegments ? 1 : o.isLineLoop ? 2 : o.isLine ? 3 : o.isPoints ? 0 : 4;
    return it;
}
function resolveItem(E, it) {
    const mi = it.mi, mat = it.mat, geo = it.geo, ga = geo.attributes, env = E.env; it.env = E.envCode; it.prog = null;
    if (mi.kind < 0 || !ga || !ga.position) return;
    try {
        let P;
        if (mi.kind === K_RAW) {
            const inst = it.inst, ic = !!it.iCol;
            P = getProgram(E, 'R' + mi.rawId + (inst ? 'I' : '') + (ic ? 'K' : ''), () => rawVertex(mat, inst, ic), () => rawFragment(mat, inst, ic));
        } else {
            const d = [], lit = mi.kind === K_LIT, tri = it.mode === 4; let colorType = 'vec3';
            const hasMap = !!(mat.map && (ga.uv || mi.kind === K_POINTS));
            if (mat.vertexColors && ga.color) { d.push('USE_COLOR'); if (ga.color.itemSize === 4 && (lit || mi.kind === K_UNLIT)) { colorType = 'vec4'; d.push('USE_COLOR_ALPHA'); } }
            if (hasMap) d.push('USE_MAP');
            if (env.fog && mat.fog !== false) d.push(env.fog === 2 ? 'FOG_EXP2' : 'FOG_LINEAR', 'FOG');
            if (env.tone && mat.toneMapped !== false) d.push('TONEMAP_ACES');
            if (env.srgb) d.push('SRGB_OUT');
            if (mat.alphaTest > 0) d.push('ALPHATEST');
            if (mi.kind === K_POINTS) { const f = { defines: d }; P = getProgram(E, 'P' + d.join(','), () => pointsVertex(f), () => flatFragment(f, true)); }
            else if (mi.kind === K_SPRITE) { const f = { defines: d }; P = getProgram(E, 'S' + d.join(','), () => spriteVertex(f), () => flatFragment(f, false)); }
            else {
                const litTri = lit && tri, hk = mi.hook, pixPL = litTri && env.nPL > 0 && !(hk && hk.vertexLights);
                if (!litTri) d.push('UNLIT');
                if (hasMap) d.push('USE_UV');
                if (it.inst) d.push('USE_INSTANCING'); if (it.inst && it.iCol) d.push('USE_INSTANCING_COLOR');
                if (litTri && mat.side === 2) d.push('DOUBLE_SIDED');
                if (litTri && mat.flatShading === true) d.push('FLAT');
                const specV = litTri && mi.spec === 1 && env.nSun > 0, specP = litTri && mi.spec === 2 && env.nSun > 0, shadow = litTri && it.recv && env.shadow;
                if (specV) d.push('SPEC_VERTEX'); if (specP) d.push('SPEC_PIXEL');
                if (pixPL) d.push('PIXEL_PL'); else if (litTri && env.nPL > 0) d.push('VERTEX_PL');
                if (specP || pixPL) d.push('NEED_NW');
                if (shadow) { d.push('SHADOW'); if (env.soft) d.push('SHADOW_SOFT'); }
                if (hk && hk.customMap) d.push('CUSTOM_MAP');
                // nothing needs doing per pixel: light, tone-map and encode at the vertex, the fragment shader only fogs
                if (!shadow && !hasMap && !(hk && (hk.fAlbedo || hk.fFinal)) && !specP && !pixPL) d.push('VFINAL');
                const f = { defines: d, colorType, numSun: litTri ? env.nSun : 0, numPL: litTri ? env.nPL : 0, hook: hk };
                P = getProgram(E, 'L' + d.join(',') + '|' + f.numSun + f.numPL + '|' + mi.hookId, () => litVertex(f), () => litFragment(f));
            }
        }
        if (P.loc === undefined) { const u = P.u, L = n => u[n] ? u[n].loc : null; P.loc = { model: L('modelMatrix'), mat: L('uMat'), uvT: L('uUvT'), mv: L('modelViewMatrix'), proj: L('projectionMatrix'), view: L('viewMatrix'), normal: L('normalMatrix'), camPos: L('cameraPosition'), ortho: L('isOrthographic'), depthVP: L('uDepthVP') }; P.mm = new Float32Array(16); P.mmSet = false; }
        it.prog = P;
        if (it.vao === null || it.layout !== P.layout) buildVAO(E, it);
    } catch (e) { it.prog = null; if (!E.failed) E.failed = String(e && e.message || e); warnOnce(String(e && e.message || e)); }
}
function prepItem(E, o) {
    const mat = o.material, geo = o.isSprite === true ? spriteGeometry(E) : o.geometry; let it = o.__hg;
    if (it === undefined || it.gen !== E.gen || it.geo !== geo || it.mat !== mat || it.matV !== mat.version || it.iCol !== (o.instanceColor || null) || it.iMat !== (o.instanceMatrix || null) || it.recv !== (o.receiveShadow === true) || it.pos !== geo.attributes.position) it = newItem(E, o, geo);
    if (it.env !== E.envCode) resolveItem(E, it);
    return it.prog === null ? null : it;
}

// ---------- pass 1: one walk over the scene ----------
function collect(E, scene, camera) {
    const L = E.L, st = L.stack, Lt = E.lights, pl = TMP.planes, camMask = camera.layers ? camera.layers.mask : -1;
    let sp = 0; st[sp++] = scene; L.n = L.nc = 0;
    Lt.hemi = null; Lt.ar = Lt.ag = Lt.ab = 0; Lt.sun0 = Lt.sun1 = null; Lt.nSun = 0; Lt.nPL = 0;
    while (sp > 0) {
        const o = st[--sp];
        if (o.visible === false) continue;
        const ch = o.children; if (ch !== undefined) for (let i = ch.length - 1; i >= 0; i--) st[sp++] = ch[i];
        if (o.layers !== undefined && (o.layers.mask & camMask) === 0) continue;
        if (o.isMesh === true || o.isLine === true || o.isPoints === true) {
            const g = o.geometry, m = o.material; if (!g || !m || m.visible === false) continue;
            const inst = o.isInstancedMesh === true; if (inst && o.count === 0) continue;
            if (o.castShadow === true) L.casters[L.nc++] = o;
            if (o.frustumCulled !== false) {
                let bs = inst ? o.boundingSphere : g.boundingSphere;
                if (bs === null || bs === undefined) { if (inst && o.computeBoundingSphere) { o.computeBoundingSphere(); bs = o.boundingSphere; } else if (g.computeBoundingSphere) { g.computeBoundingSphere(); bs = g.boundingSphere; } else bs = g.boundingSphere = sphereOf(g); }
                if (bs) {
                    const e = o.matrixWorld.elements, c = bs.center, x = e[0] * c.x + e[4] * c.y + e[8] * c.z + e[12], y = e[1] * c.x + e[5] * c.y + e[9] * c.z + e[13], z = e[2] * c.x + e[6] * c.y + e[10] * c.z + e[14];
                    const s2 = Math.max(e[0] * e[0] + e[1] * e[1] + e[2] * e[2], e[4] * e[4] + e[5] * e[5] + e[6] * e[6], e[8] * e[8] + e[9] * e[9] + e[10] * e[10]);
                    if (!sphereVisible(pl, x, y, z, bs.radius * Math.sqrt(s2))) continue;
                }
            }
            L.objs[L.n++] = o;
        } else if (o.isSprite === true) { if (o.material && o.material.visible !== false) L.objs[L.n++] = o; }
        else if (o.isLight === true) {
            if (o.isHemisphereLight === true) { if (Lt.hemi === null) Lt.hemi = o; }
            else if (o.isAmbientLight === true) { const k = o.intensity / Math.PI; Lt.ar += o.color.r * k; Lt.ag += o.color.g * k; Lt.ab += o.color.b * k; }
            else if (o.isDirectionalLight === true) { if (Lt.sun0 === null) Lt.sun0 = o; else if (Lt.sun1 === null) { if (o.castShadow === true && Lt.sun0.castShadow !== true) { Lt.sun1 = Lt.sun0; Lt.sun0 = o; } else Lt.sun1 = o; } Lt.nSun = Lt.sun1 ? 2 : 1; }
            else if (o.isPointLight === true) { if (Lt.nPL < MAX_PL) Lt.pl[Lt.nPL++] = o; }
        }
    }
}
function sphereOf(g) {
    const p = g.attributes.position, a = p.array, n = p.count; let x0 = 1e30, y0 = 1e30, z0 = 1e30, x1 = -1e30, y1 = -1e30, z1 = -1e30;
    for (let i = 0; i < n * 3; i += 3) { const x = a[i], y = a[i + 1], z = a[i + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    const c = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 }; let r2 = 0;
    for (let i = 0; i < n * 3; i += 3) { const dx = a[i] - c.x, dy = a[i + 1] - c.y, dz = a[i + 2] - c.z, d = dx * dx + dy * dy + dz * dz; if (d > r2) r2 = d; }
    return { center: c, radius: Math.sqrt(r2) };
}

// ---------- the frame uniform block ----------
function fillFrame(E, scene, camera, R) {
    const d = E.uboData, Lt = E.lights, env = E.env, view = camera.matrixWorldInverse.elements, proj = camera.projectionMatrix.elements, cw = camera.matrixWorld.elements;
    for (let i = 0; i < 16; i++) { d[U_VIEWPROJ + i] = TMP.vp[i]; d[U_VIEW + i] = view[i]; d[U_PROJ + i] = proj[i]; }
    d[U_CAMPOS] = cw[12]; d[U_CAMPOS + 1] = cw[13]; d[U_CAMPOS + 2] = cw[14]; d[U_CAMPOS + 3] = E.time;
    const h = Lt.hemi;
    if (h !== null) {
        const k = h.intensity / Math.PI, e = h.matrixWorld.elements; let x = e[12], y = e[13], z = e[14], l = Math.hypot(x, y, z); if (l < 1e-6) { x = 0; y = 1; z = 0; l = 1; }
        d[U_HEMISKY] = h.color.r * k; d[U_HEMISKY + 1] = h.color.g * k; d[U_HEMISKY + 2] = h.color.b * k;
        d[U_HEMIGROUND] = h.groundColor.r * k; d[U_HEMIGROUND + 1] = h.groundColor.g * k; d[U_HEMIGROUND + 2] = h.groundColor.b * k;
        d[U_HEMIDIR] = x / l; d[U_HEMIDIR + 1] = y / l; d[U_HEMIDIR + 2] = z / l;
    } else { for (let i = 0; i < 3; i++) d[U_HEMISKY + i] = d[U_HEMIGROUND + i] = 0; d[U_HEMIDIR] = 0; d[U_HEMIDIR + 1] = 1; d[U_HEMIDIR + 2] = 0; }
    d[U_AMBIENT] = Lt.ar; d[U_AMBIENT + 1] = Lt.ag; d[U_AMBIENT + 2] = Lt.ab;
    for (let s = 0; s < 2; s++) {
        const sun = s === 0 ? Lt.sun0 : Lt.sun1, o = s * 4;
        if (sun !== null) {
            const e = sun.matrixWorld.elements, t = sun.target ? sun.target.matrixWorld.elements : null, k = sun.intensity / Math.PI;
            let x = e[12] - (t ? t[12] : 0), y = e[13] - (t ? t[13] : 0), z = e[14] - (t ? t[14] : 0); const l = Math.hypot(x, y, z) || 1;
            d[U_SUNDIR + o] = x / l; d[U_SUNDIR + o + 1] = y / l; d[U_SUNDIR + o + 2] = z / l;
            d[U_SUNCOL + o] = sun.color.r * k; d[U_SUNCOL + o + 1] = sun.color.g * k; d[U_SUNCOL + o + 2] = sun.color.b * k;
        } else { d[U_SUNDIR + o] = 0; d[U_SUNDIR + o + 1] = 1; d[U_SUNDIR + o + 2] = 0; d[U_SUNCOL + o] = d[U_SUNCOL + o + 1] = d[U_SUNCOL + o + 2] = 0; }
    }
    for (let i = 0; i < MAX_PL; i++) {
        const p = i < Lt.nPL ? Lt.pl[i] : null, o = i * 4;
        if (p !== null) { const e = p.matrixWorld.elements, k = p.intensity / Math.PI; d[U_PLPOS + o] = e[12]; d[U_PLPOS + o + 1] = e[13]; d[U_PLPOS + o + 2] = e[14]; d[U_PLPOS + o + 3] = p.distance || 0; d[U_PLCOL + o] = p.color.r * k; d[U_PLCOL + o + 1] = p.color.g * k; d[U_PLCOL + o + 2] = p.color.b * k; d[U_PLCOL + o + 3] = p.decay === undefined ? 2 : p.decay; Lt.pl[i] = null; }
        else { d[U_PLPOS + o + 3] = 0; d[U_PLCOL + o] = d[U_PLCOL + o + 1] = d[U_PLCOL + o + 2] = 0; d[U_PLCOL + o + 3] = 2; }
    }
    const fog = scene.fog;
    if (env.fog) {
        const c = fog.color, s = env.srgb;
        d[U_FOGCOLOR] = s ? linToSrgb(c.r) : c.r; d[U_FOGCOLOR + 1] = s ? linToSrgb(c.g) : c.g; d[U_FOGCOLOR + 2] = s ? linToSrgb(c.b) : c.b;
        d[U_FOGPARAMS] = fog.near || 0; d[U_FOGPARAMS + 1] = 1 / Math.max(1e-6, (fog.far || 1) - (fog.near || 0)); d[U_FOGPARAMS + 2] = fog.density || 0;
    }
    d[U_OUT] = R.toneMappingExposure; d[U_OUT + 1] = R.gradeSaturation || 0; d[U_OUT + 2] = R.gradeContrast || 0;      // the grade: more (or less) colour and contrast in the finished picture; 0 and 0 change nothing
}

// ---------- the sun's shadow map ----------
function shadowPass(E, R) {
    const gl = E.gl, Lt = E.lights, sun = Lt.sun0, L = E.L, d = E.uboData, sh = sun.shadow, cam = sh.camera;
    const size = (sh.mapSize && (sh.mapSize.width || sh.mapSize.x)) || 1024, T = shadowTarget(E, size), SM = R.shadowMap;
    d[U_SHADOWPARAMS] = sh.bias || 0; d[U_SHADOWPARAMS + 1] = sh.normalBias || 0; d[U_SHADOWPARAMS + 2] = 1 / size; d[U_SHADOWPARAMS + 3] = 1;
    // a game may ask for the map to be redrawn only now and then: the matrix it is read with stays the one it was drawn with
    if (T.drawn && SM.autoUpdate === false && SM.needsUpdate !== true) { for (let i = 0; i < L.nc; i++) L.casters[i] = null; return; }
    SM.needsUpdate = false; T.drawn = true;
    const e = sun.matrixWorld.elements, t = sun.target ? sun.target.matrixWorld.elements : null;
    M4.lookAt(TMP.lv, e[12], e[13], e[14], t ? t[12] : 0, t ? t[13] : 0, t ? t[14] : 0);
    M4.ortho(TMP.lp, cam.left, cam.right, cam.top, cam.bottom, cam.near, cam.far);
    M4.mul(TMP.lvp, TMP.lp, TMP.lv); M4.mul(TMP.m, TMP.bias, TMP.lvp);
    for (let i = 0; i < 16; i++) d[U_SHADOWMAT + i] = TMP.m[i];
    if (E.S.tex[1] === T.tex) bindTex(E, 1, gl.TEXTURE_2D, null);       // never sample the map while drawing into it
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.fbo); gl.viewport(0, 0, size, size);
    setDepth(E, 1, 1, gl.LEQUAL); setBlend(E, 0); setPoly(E, 0, 0, 0); gl.clear(gl.DEPTH_BUFFER_BIT);
    for (let i = 0; i < L.nc; i++) {
        const o = L.casters[i], it = prepItem(E, o); L.casters[i] = null; if (it === null || it.mi.kind > K_UNLIT || it.mode !== 4) continue;
        const P = depthProgram(E, it.inst); if (P === null) continue;
        useProgram(E, P); if (P.frame !== E.frame) { P.frame = E.frame; gl.uniformMatrix4fv(P.loc.depthVP, false, TMP.lvp); }
        refreshState(it.mi, it.mat); setCull(E, it.mi.cull === 1 ? 2 : it.mi.cull === 2 ? 1 : 0);
        const me = o.matrixWorld.elements, m = TMP.m; for (let k = 0; k < 16; k++) m[k] = me[k]; gl.uniformMatrix4fv(P.loc.model, false, m);
        drawGeometry(E, it, false);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
function depthProgram(E, inst) {
    try { const P = getProgram(E, inst ? 'D1' : 'D0', () => DEPTH_VS(inst), () => DEPTH_FS); if (P.loc === undefined) P.loc = { model: P.u.modelMatrix ? P.u.modelMatrix.loc : null, depthVP: P.u.uDepthVP ? P.u.uDepthVP.loc : null }; return P; }
    catch (e) { if (!E.failed) E.failed = String(e.message); return null; }
}

// ---------- drawing ----------
function drawGeometry(E, it, count) {
    const gl = E.gl, geo = it.geo, idx = it.idx, dr = geo.drawRange;
    bindVAO(E, it.vao); syncItem(E, it);
    let start = dr ? dr.start : 0, n = (idx !== null ? idx.count : it.pos.count) - start; if (dr && dr.count < n) n = dr.count; if (n <= 0) return;
    const inst = it.inst ? it.o.count : it.gInst ? itemInstances(it) : -1; if (inst === 0) return;
    if (idx !== null) { if (inst >= 0) gl.drawElementsInstanced(it.mode, n, it.idxType, start * it.idxBytes, inst); else gl.drawElements(it.mode, n, it.idxType, start * it.idxBytes); }
    else if (inst >= 0) gl.drawArraysInstanced(it.mode, start, n, inst); else gl.drawArrays(it.mode, start, n);
    if (count) { E.stats.calls++; E.stats.tris += (it.mode === 4 ? n / 3 : it.mode === 1 ? n / 2 : n) * (inst >= 0 ? inst : 1); }
}
function drawItem(E, it, camera, skyPass) {
    const gl = E.gl, P = it.prog, mi = it.mi, mat = it.mat, o = it.o, loc = P.loc, kind = mi.kind;
    useProgram(E, P);
    setBlend(E, mi.blend); setDepth(E, mi.depthTest, skyPass ? 0 : mi.depthWrite, skyPass ? gl.LEQUAL : mi.depthFunc); setCull(E, kind === K_SPRITE ? 0 : mi.cull); setPoly(E, mi.poly, mi.pf, mi.pu);
    const me = o.matrixWorld.elements, m = TMP.m, pm = P.mm; let same = P.mmSet;
    for (let k = 0; k < 16; k++) { const v = me[k]; m[k] = v; if (pm[k] !== v) { same = false; pm[k] = v; } }
    if (!same) { P.mmSet = true; gl.uniformMatrix4fv(loc.model, false, pm); }
    if (kind === K_RAW) {
        if (P.frame !== E.frame) { P.frame = E.frame; gl.uniformMatrix4fv(loc.proj, false, camera.projectionMatrix.elements); gl.uniformMatrix4fv(loc.view, false, camera.matrixWorldInverse.elements); const cw = camera.matrixWorld.elements; gl.uniform3f(loc.camPos, cw[12], cw[13], cw[14]); gl.uniform1i(loc.ortho, camera.isOrthographicCamera ? 1 : 0); }
        if (loc.mv !== null || loc.normal !== null) { M4.mul(TMP.mv, camera.matrixWorldInverse.elements, m); gl.uniformMatrix4fv(loc.mv, false, TMP.mv); if (loc.normal !== null) gl.uniformMatrix3fv(loc.normal, false, M4.normal3(TMP.n3, TMP.mv)); }
        if (mat.uniforms) setUserUniforms(E, P, mat.uniforms);
    } else if (P.mat !== mat || P.matFrame !== E.frame || kind === K_SPRITE) {
        P.mat = mat; P.matFrame = E.frame;
        const u = TMP.mat, c = mat.color;
        if (c) { u[0] = c.r; u[1] = c.g; u[2] = c.b; } else { u[0] = u[1] = u[2] = 1; } u[3] = mat.opacity === undefined ? 1 : mat.opacity;
        if (kind === K_POINTS) { u[4] = (mat.size === undefined ? 1 : mat.size) * E.pixelRatio; u[5] = mat.sizeAttenuation === false || camera.isOrthographicCamera ? 0 : gl.drawingBufferHeight * 0.5; u[6] = u[7] = 0; u[8] = mat.alphaTest || 0; }
        else if (kind === K_SPRITE) { const ce = o.center; u[4] = ce ? ce.x : 0.5; u[5] = ce ? ce.y : 0.5; u[6] = mat.rotation || 0; u[7] = mat.sizeAttenuation === false ? 0 : 1; u[8] = mat.alphaTest || 0; }
        else {
            const em = mat.emissive, ek = mat.emissiveIntensity === undefined ? 1 : mat.emissiveIntensity, sp = mat.isMeshPhongMaterial ? mat.specular : null;
            if (em) { u[4] = em.r * ek; u[5] = em.g * ek; u[6] = em.b * ek; } else { u[4] = u[5] = u[6] = 0; } u[7] = mat.alphaTest || 0;
            u[8] = mi.shin; u[9] = mi.specScale; u[10] = mi.metal; u[11] = 0;
            if (sp) { u[12] = sp.r; u[13] = sp.g; u[14] = sp.b; } else { u[12] = u[13] = u[14] = 0.04; }
        }
        u[15] = mi.transparent ? 0 : 1;
        gl.uniform4fv(loc.mat, u);          // one call for the whole material
        const map = mat.map;
        if (map && P.u.map) { bindTex(E, 0, gl.TEXTURE_2D, textureFor(E, map)); if (loc.uvT !== null) { if (map.matrixAutoUpdate === true && map.updateMatrix) map.updateMatrix(); gl.uniformMatrix3fv(loc.uvT, false, map.matrix ? map.matrix.elements : TMP.id3); } }
        if (mi.hook !== null && mi.hook.uniforms) setUserUniforms(E, P, mi.hook.uniforms);
    }
    drawGeometry(E, it, true);
}
function drawBackground(E, tex) {
    const gl = E.gl, env = E.env, tone = !!(env.tone && tex.colorSpace !== 'srgb'), srgb = !!env.srgb; let P;
    try { P = getProgram(E, 'B' + (tone ? 'T' : '') + (srgb ? 'S' : ''), () => BG_VS, () => bgFragment(tone, srgb)); } catch (e) { warnOnce(String(e.message)); return; }
    useProgram(E, P); setBlend(E, 0); setDepth(E, 0, 0, gl.LEQUAL); setCull(E, 0); setPoly(E, 0, 0, 0);
    bindTex(E, 0, gl.TEXTURE_2D, textureFor(E, tex)); bindVAO(E, null); gl.drawArrays(gl.TRIANGLES, 0, 3);
}
// opaque order = three.js' own (renderOrder, then material in creation order, then near to far): games were tuned around
// it, e.g. the ground is made before the backdrop and so hides most of it before it is shaded
function sortOpaque(a, n) { for (let i = 1; i < n; i++) { const x = a[i], k = x.key, z = x.z; let j = i - 1; while (j >= 0 && (a[j].key > k || (a[j].key === k && a[j].z > z))) { a[j + 1] = a[j]; j--; } a[j + 1] = x; } }
function sortTransparent(a, n) { for (let i = 1; i < n; i++) { const x = a[i]; let j = i - 1; while (j >= 0 && (a[j].ro > x.ro || (a[j].ro === x.ro && a[j].z < x.z))) { a[j + 1] = a[j]; j--; } a[j + 1] = x; } }

// R is the renderer facade (50-facade.js): it carries the settings a three.js game expects to set
function renderScene(E, R, scene, camera) {
    if (E.lost) return;
    const gl = E.gl, L = E.L, Lt = E.lights, env = E.env;
    E.frame++; E.time = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    if (scene.matrixWorldAutoUpdate === true && scene.updateMatrixWorld) scene.updateMatrixWorld();
    if (camera.parent === null && camera.matrixWorldAutoUpdate === true && camera.updateMatrixWorld) camera.updateMatrixWorld();
    M4.mul(TMP.vp, camera.projectionMatrix.elements, camera.matrixWorldInverse.elements); setFrustumFast(TMP.planes, TMP.vp);
    collect(E, scene, camera);
    const fog = scene.fog, SM = R.shadowMap;
    env.fog = fog ? (fog.isFogExp2 ? 2 : 1) : 0; env.nSun = Lt.nSun; env.nPL = Lt.nPL;
    env.shadow = (SM.enabled === true && Lt.sun0 !== null && Lt.sun0.castShadow === true && Lt.sun0.shadow) ? 1 : 0; env.soft = SM.type >= 1 ? 1 : 0;
    env.tone = R.toneMapping === 4 ? 1 : 0; env.srgb = R.outputColorSpace === 'srgb' ? 1 : 0;
    E.envCode = env.fog | env.nSun << 2 | env.nPL << 4 | env.shadow << 8 | env.soft << 9 | env.tone << 10 | env.srgb << 11;
    fillFrame(E, scene, camera, R);
    if (env.shadow) shadowPass(E, R); else { E.uboData[U_SHADOWPARAMS + 3] = 0; for (let i = 0; i < L.nc; i++) L.casters[i] = null; L.nc = 0; }
    gl.bindBuffer(gl.UNIFORM_BUFFER, E.ubo); gl.bufferSubData(gl.UNIFORM_BUFFER, 0, E.uboData);
    // pass 2: items, sorted into the three lists
    const view = camera.matrixWorldInverse.elements; L.no = L.nt = L.ns = 0;
    for (let i = 0; i < L.n; i++) {
        const o = L.objs[i]; L.objs[i] = null; const it = prepItem(E, o); if (it === null) continue;
        const mi = it.mi, e = o.matrixWorld.elements; refreshState(mi, it.mat); it.ro = o.renderOrder || 0;
        it.z = -(view[2] * e[12] + view[6] * e[13] + view[10] * e[14] + view[14]);
        if (mi.sky) L.sky[L.ns++] = it;
        else if (mi.transparent) L.transp[L.nt++] = it;
        else { it.key = (it.ro + 512) * 4194304 + ((it.mat.id || 0) & 4194303); L.opaque[L.no++] = it; }
    }
    sortOpaque(L.opaque, L.no); sortTransparent(L.transp, L.nt);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    if (R.autoClear !== false) {
        const bg = scene.background;
        if (bg && bg.isColor) { const s = env.srgb; gl.clearColor(s ? linToSrgb(bg.r) : bg.r, s ? linToSrgb(bg.g) : bg.g, s ? linToSrgb(bg.b) : bg.b, 1); setColorMask(E, true); setDepth(E, 1, 1, gl.LEQUAL); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); }
        else { R.clear(); if (bg && bg.isTexture) drawBackground(E, bg); }
    }
    if (env.shadow && E.shadow) bindTex(E, 1, gl.TEXTURE_2D, E.shadow.tex);
    for (let i = 0; i < L.no; i++) { drawItem(E, L.opaque[i], camera, false); L.opaque[i] = null; }
    for (let i = 0; i < L.ns; i++) { drawItem(E, L.sky[i], camera, true); L.sky[i] = null; }
    for (let i = 0; i < L.nt; i++) { drawItem(E, L.transp[i], camera, false); L.transp[i] = null; }
}
