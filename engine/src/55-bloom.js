// ============================================================
// GLOW (bloom): the bright parts of the finished picture spread into a soft light around them: a low sun, lamps, muzzle
// flashes, fire. The engine draws straight to the canvas (no second pass of its own), so this works on the finished
// drawing buffer, and a game asks for it once a frame AFTER its last render():
//   renderer.bloom({ strength: 0.6, threshold: 0.7, knee: 0.25, wide: 0.6 })
// What it does: copies the picture, keeps what is brighter than the threshold at a quarter of the size, blurs that, blurs
// it again at an eighth of the size for the wide part, and adds both back. Cost: one copy of the picture and five small
// passes, so a game turns it off when the frame rate is short (it is a look, nothing depends on it).
// ============================================================
const BLOOM_VS = '#version 300 es\nlayout(location=0) in vec2 p; out vec2 uv; void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }';
const BLOOM_FS = {
    // four taps of the picture (a box that also stops single bright pixels from flickering), then only the bright part
    bright: 'uniform sampler2D a; uniform vec4 k; void main(){ vec3 c = (texture(a, uv + k.zw * vec2(-1.0, -1.0)).rgb + texture(a, uv + k.zw * vec2(1.0, -1.0)).rgb + texture(a, uv + k.zw * vec2(-1.0, 1.0)).rgb + texture(a, uv + k.zw).rgb) * 0.25;' +
        ' float l = max(c.r, max(c.g, c.b)); o = vec4(c * smoothstep(k.x, k.x + k.y, l), 1.0); }',
    // nine weights of a bell curve read with five taps (the pairs are read between two texels)
    blur: 'uniform sampler2D a; uniform vec4 k; void main(){ vec2 d = k.zw; vec3 c = texture(a, uv).rgb * 0.2270270270;' +
        ' c += (texture(a, uv + d * 1.3846153846).rgb + texture(a, uv - d * 1.3846153846).rgb) * 0.3162162162; c += (texture(a, uv + d * 3.2307692308).rgb + texture(a, uv - d * 3.2307692308).rgb) * 0.0702702703; o = vec4(c, 1.0); }',
    add: 'uniform sampler2D a; uniform sampler2D b; uniform vec4 k; void main(){ o = vec4((texture(a, uv).rgb + texture(b, uv).rgb * k.y) * k.x, 1.0); }'
};
function bloomSetup(E, w, h) {
    const gl = E.gl; let B = E.bloom;
    if (B && B.gen === E.gen && B.w === w && B.h === h) return B;
    if (B && B.gen === E.gen) { for (const t of B.targets) { gl.deleteTexture(t.tex); if (t.fbo) gl.deleteFramebuffer(t.fbo); } }
    else {      // first use, or a new context: the programs and the one triangle that covers the picture
        B = E.bloom = { gen: E.gen, progs: {}, vao: gl.createVertexArray(), vbo: gl.createBuffer(), targets: [] };
        gl.bindVertexArray(B.vao); E.S.vao = B.vao; gl.bindBuffer(gl.ARRAY_BUFFER, B.vbo); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        for (const n in BLOOM_FS) {
            const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
            const p = gl.createProgram(), vs = mk(gl.VERTEX_SHADER, BLOOM_VS), fs = mk(gl.FRAGMENT_SHADER, '#version 300 es\nprecision mediump float; in vec2 uv; out vec4 o; ' + BLOOM_FS[n]);
            gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
            if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn('[HG3D] glow shader "' + n + '": ' + (gl.getProgramInfoLog(p) || gl.getShaderInfoLog(fs))); E.bloom = null; return null; }
            gl.useProgram(p); E.S.prog = null; gl.uniform1i(gl.getUniformLocation(p, 'a'), 0); const b = gl.getUniformLocation(p, 'b'); if (b) gl.uniform1i(b, 1);
            B.progs[n] = { prog: p, k: gl.getUniformLocation(p, 'k') };
        }
    }
    const tex = (tw, th, fbo) => {
        const t = { tex: gl.createTexture(), fbo: null, w: tw, h: th }; bindForUpload(E, t.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        if (fbo) { t.fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0); }
        return t;
    };
    const qw = Math.max(2, w >> 2), qh = Math.max(2, h >> 2), ew = Math.max(2, w >> 3), eh = Math.max(2, h >> 3);
    B.w = w; B.h = h; B.src = tex(w, h, false); B.A = tex(qw, qh, true); B.B = tex(qw, qh, true); B.C = tex(ew, eh, true); B.D = tex(ew, eh, true); B.targets = [B.src, B.A, B.B, B.C, B.D];
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return B;
}
function bloomPass(E, o) {
    const gl = E.gl, w = gl.drawingBufferWidth, h = gl.drawingBufferHeight; if (E.lost || E.failed || w < 16 || h < 16) return false;
    const strength = o.strength === undefined ? 0.6 : o.strength; if (!(strength > 0)) return false;
    const B = bloomSetup(E, w, h); if (!B) return false;
    setDepth(E, 0, 0, gl.LEQUAL); setBlend(E, 0); setCull(E, 0); setPoly(E, 0, 0, 0); setColorMask(E, true); bindVAO(E, B.vao);
    // the finished picture, as a texture
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); bindForUpload(E, B.src.tex); gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, w, h);
    const pass = (name, from, to, kx, ky, kz, kw, from2) => {
        for (let u = 0; u < 2; u++) if (to && E.S.tex[u] === to.tex) bindTex(E, u, gl.TEXTURE_2D, null);      // never read a picture while drawing into it
        gl.bindFramebuffer(gl.FRAMEBUFFER, to ? to.fbo : null); gl.viewport(0, 0, to ? to.w : w, to ? to.h : h);
        const P = B.progs[name]; gl.useProgram(P.prog); gl.uniform4f(P.k, kx, ky, kz, kw);
        if (from2) bindTex(E, 1, gl.TEXTURE_2D, from2.tex); bindTex(E, 0, gl.TEXTURE_2D, from.tex);
        gl.drawArrays(gl.TRIANGLES, 0, 3); E.stats.calls++;
    };
    pass('bright', B.src, B.A, o.threshold === undefined ? 0.7 : o.threshold, o.knee === undefined ? 0.25 : o.knee, 1 / w, 1 / h);
    pass('blur', B.A, B.B, 0, 0, 1 / B.A.w, 0); pass('blur', B.B, B.A, 0, 0, 0, 1 / B.A.h);
    pass('blur', B.A, B.C, 0, 0, 1 / B.A.w, 0); pass('blur', B.C, B.D, 0, 0, 0, 1 / B.C.h);
    // add it to the picture (colour only: the canvas keeps the cover it has)
    gl.colorMask(true, true, true, false); E.S.colorMask = -1; setBlend(E, 2);
    pass('add', B.A, null, strength, o.wide === undefined ? 0.6 : o.wide, 0, 0, B.D);
    setBlend(E, 0); setColorMask(E, true); E.S.prog = null;
    return true;
}
