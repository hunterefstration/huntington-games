// ============================================================
// GPU resources: vertex buffers (uploaded only when their data changed, and only the live part of an
// instance buffer), vertex array objects, textures. Each cache lives on the source object itself and
// carries the context generation, so everything rebuilds by itself after a lost context.
// ============================================================
function glArrayType(gl, a) {
    return a instanceof Float32Array ? gl.FLOAT : a instanceof Uint16Array ? gl.UNSIGNED_SHORT : a instanceof Uint32Array ? gl.UNSIGNED_INT : (a instanceof Uint8Array || a instanceof Uint8ClampedArray) ? gl.UNSIGNED_BYTE
        : a instanceof Int16Array ? gl.SHORT : a instanceof Int8Array ? gl.BYTE : a instanceof Int32Array ? gl.INT : gl.FLOAT;
}
// make sure the first `need` elements of attr.array are on the GPU (need < 0: all of it)
function syncAttr(E, attr, target, need) {
    const gl = E.gl, arr = attr.array; let r = attr.__hg;
    if (need < 0 || need > arr.length) need = arr.length;
    if (r === undefined || r.gen !== E.gen) { r = attr.__hg = { gen: E.gen, buf: gl.createBuffer(), version: -1, fresh: 0, bytes: -1, type: glArrayType(gl, arr) }; }
    if (r.bytes !== arr.byteLength) {            // first upload, or the game swapped in a bigger array: everything
        gl.bindBuffer(target, r.buf); gl.bufferData(target, arr, attr.usage || gl.STATIC_DRAW); r.bytes = arr.byteLength; r.version = attr.version; r.fresh = arr.length;
    } else if (r.version !== attr.version) {
        gl.bindBuffer(target, r.buf); if (need > 0) gl.bufferSubData(target, 0, arr, 0, need); r.version = attr.version; r.fresh = need;
    } else if (need > r.fresh) {                 // more instances became live without the data being touched again
        gl.bindBuffer(target, r.buf); gl.bufferSubData(target, 0, arr, 0, need); r.fresh = need;
    }
    return r;
}
function itemInstances(it) {
    if (it.inst) return it.o.count;
    if (it.gInst) { const g = it.geo; let n = g.instanceCount; if (n === undefined || n === Infinity) n = g._maxInstanceCount !== undefined ? g._maxInstanceCount : it.gMax; return Math.min(n, it.gMax); }
    return -1;
}
function buildVAO(E, it) {
    const gl = E.gl, P = it.prog, geo = it.geo, ga = geo.attributes;
    if (it.vao) gl.deleteVertexArray(it.vao); else E.stats.geometries++;
    it.vao = gl.createVertexArray(); bindVAO(E, it.vao); it.layout = P.layout; it.na = 0; it.gMax = Infinity; it.gInst = false;
    const add = (attr, loc, instanced, slots) => {
        if (!attr) return; if (attr.isInterleavedBufferAttribute) { warnOnce('interleaved vertex buffers are not supported'); return; }
        const r = syncAttr(E, attr, gl.ARRAY_BUFFER, -1); gl.bindBuffer(gl.ARRAY_BUFFER, r.buf);
        const size = attr.itemSize, bpe = attr.array.BYTES_PER_ELEMENT;
        if (slots > 1) { const per = size / slots; for (let k = 0; k < slots; k++) { gl.enableVertexAttribArray(loc + k); gl.vertexAttribPointer(loc + k, per, r.type, false, size * bpe, k * per * bpe); if (instanced) gl.vertexAttribDivisor(loc + k, attr.meshPerAttribute || 1); } }
        else { gl.enableVertexAttribArray(loc); if (r.type === gl.FLOAT || attr.normalized || attr.gpuType !== 1013) gl.vertexAttribPointer(loc, size, r.type, !!attr.normalized, 0, 0); else gl.vertexAttribIPointer(loc, size, r.type, 0, 0); if (instanced) gl.vertexAttribDivisor(loc, attr.meshPerAttribute || 1); }
        it.attrs[it.na] = attr; it.attrInst[it.na] = instanced ? size : 0; it.na++;
        if (instanced && !it.inst) { it.gInst = true; it.gMax = Math.min(it.gMax, attr.count * (attr.meshPerAttribute || 1)); }
    };
    add(ga.position, 0, false, 1); add(ga.normal, 1, false, 1); add(ga.uv, 2, false, 1); add(ga.color, 3, false, 1);
    if (it.inst) { add(it.o.instanceMatrix, 4, true, 4); if (it.o.instanceColor) add(it.o.instanceColor, 8, true, 1); }
    for (const name in P.custom) { const a = ga[name]; if (a) add(a, P.custom[name], !!a.isInstancedBufferAttribute, a.itemSize === 16 ? 4 : a.itemSize === 9 ? 3 : 1); }
    const idx = geo.index;
    if (idx) { const r = syncAttr(E, idx, gl.ELEMENT_ARRAY_BUFFER, -1); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, r.buf); it.idxType = r.type; it.idxBytes = idx.array.BYTES_PER_ELEMENT; }
    it.idx = idx || null;
}
// called with the item's VAO bound: re-upload whatever the game changed since the last draw
function syncItem(E, it) {
    const gl = E.gl, live = it.inst ? it.o.count : -1;
    for (let i = 0; i < it.na; i++) {
        const a = it.attrs[i], r = a.__hg, per = it.attrInst[i], need = per > 0 && live >= 0 ? live * per : -1;
        if (r.version !== a.version || r.bytes !== a.array.byteLength || (need > r.fresh)) syncAttr(E, a, gl.ARRAY_BUFFER, need);
    }
    const idx = it.idx; if (idx !== null) { const r = idx.__hg; if (r.version !== idx.version || r.bytes !== idx.array.byteLength) syncAttr(E, idx, gl.ELEMENT_ARRAY_BUFFER, -1); }
}

// ---------- textures (three.js Texture / CanvasTexture / DataTexture, or the same shape) ----------
function textureFor(E, t) {
    if (!t) return E.white;
    let r = t.__hg;
    if (r !== undefined && r.gen === E.gen && r.version === t.version) return r.tex;
    const img = t.image; if (!img || img.width === 0 || img.complete === false) return E.white;
    const gl = E.gl;
    if (r === undefined || r.gen !== E.gen) { r = t.__hg = { gen: E.gen, tex: gl.createTexture(), version: -1 }; E.stats.textures++; }
    bindForUpload(E, r.tex);
    const isData = !!(img.data && img.width !== undefined && !(img instanceof Element)), type3 = t.type || 1009, fmt3 = t.format || 1023, srgb = t.colorSpace === 'srgb';
    let type = gl.UNSIGNED_BYTE, fmt = gl.RGBA, ifmt = srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8, isFloat = false;
    if (type3 === 1015) { type = gl.FLOAT; isFloat = true; } else if (type3 === 1016) { type = gl.HALF_FLOAT; isFloat = true; }
    if (fmt3 === 1028) { fmt = gl.RED; ifmt = type3 === 1015 ? gl.R32F : type3 === 1016 ? gl.R16F : gl.R8; }
    else if (fmt3 === 1030) { fmt = gl.RG; ifmt = type3 === 1015 ? gl.RG32F : type3 === 1016 ? gl.RG16F : gl.RG8; }
    else if (isFloat) ifmt = type3 === 1015 ? gl.RGBA32F : gl.RGBA16F;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, !isData && t.flipY !== false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !!t.premultiplyAlpha); gl.pixelStorei(gl.UNPACK_ALIGNMENT, t.unpackAlignment || 4);
    if (isData) gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, img.width, img.height, 0, fmt, type, img.data);
    else gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, fmt, type, img);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    const wrap = w => w === 1000 ? gl.REPEAT : w === 1002 ? gl.MIRRORED_REPEAT : gl.CLAMP_TO_EDGE;
    let min = t.minFilter === undefined ? 1008 : t.minFilter, mag = t.magFilter === 1003 ? gl.NEAREST : gl.LINEAR;
    if (isFloat && type3 === 1015 && !E.floatLinear) { min = 1003; mag = gl.NEAREST; }
    const mip = min !== 1003 && min !== 1006 && t.generateMipmaps !== false && !isFloat;
    const minGL = min === 1003 ? gl.NEAREST : min === 1006 || !mip ? gl.LINEAR : min === 1004 ? gl.NEAREST_MIPMAP_NEAREST : min === 1005 ? gl.NEAREST_MIPMAP_LINEAR : min === 1007 ? gl.LINEAR_MIPMAP_NEAREST : gl.LINEAR_MIPMAP_LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap(t.wrapS)); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap(t.wrapT));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minGL); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mag);
    if (E.aniso && mip && t.anisotropy > 1) gl.texParameterf(gl.TEXTURE_2D, E.aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(t.anisotropy, E.maxAniso));
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
    r.version = t.version;
    return r.tex;
}

// ---------- the sun's shadow map: a depth texture read with hardware comparison (free 2x2 filtering) ----------
function shadowTarget(E, size) {
    const gl = E.gl; let s = E.shadow;
    if (s && s.size === size) return s;
    if (s) { gl.deleteTexture(s.tex); gl.deleteFramebuffer(s.fbo); }
    const tex = gl.createTexture(); bindForUpload(E, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, size);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0); gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    s = E.shadow = { size, tex, fbo, drawn: false };
    return s;
}
