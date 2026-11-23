// ============================================================
// HG3D core: WebGL2 context, GL state cache, small allocation-free math.
// Built for 4 GB Chromebooks with integrated graphics: few GL calls, tiny shaders, no garbage per frame.
// The engine never imports three.js. It draws any scene made of objects shaped like three's
// (visible, children, matrixWorld.elements, geometry.attributes, material...), so the same renderer
// serves the three.js games through the facade (50-facade.js) and native scenes (60-native.js).
// ============================================================
const VERSION = '1.0.0';
const WARNED = {};
function warnOnce(msg) { if (!WARNED[msg]) { WARNED[msg] = 1; try { console.warn('[HG3D] ' + msg); } catch (e) { } } }

// ---------- math: column-major 4x4 in Float32Array(16) ----------
const M4 = {
    ident(o) { o[0] = 1; o[1] = 0; o[2] = 0; o[3] = 0; o[4] = 0; o[5] = 1; o[6] = 0; o[7] = 0; o[8] = 0; o[9] = 0; o[10] = 1; o[11] = 0; o[12] = 0; o[13] = 0; o[14] = 0; o[15] = 1; return o; },
    copy(o, a) { for (let i = 0; i < 16; i++) o[i] = a[i]; return o; },
    mul(o, a, b) {          // o = a * b (o may be a or b)
        const a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], a4 = a[4], a5 = a[5], a6 = a[6], a7 = a[7], a8 = a[8], a9 = a[9], a10 = a[10], a11 = a[11], a12 = a[12], a13 = a[13], a14 = a[14], a15 = a[15];
        for (let c = 0; c < 16; c += 4) {
            const b0 = b[c], b1 = b[c + 1], b2 = b[c + 2], b3 = b[c + 3];
            o[c] = a0 * b0 + a4 * b1 + a8 * b2 + a12 * b3; o[c + 1] = a1 * b0 + a5 * b1 + a9 * b2 + a13 * b3;
            o[c + 2] = a2 * b0 + a6 * b1 + a10 * b2 + a14 * b3; o[c + 3] = a3 * b0 + a7 * b1 + a11 * b2 + a15 * b3;
        }
        return o;
    },
    invert(o, m) {
        const n11 = m[0], n21 = m[1], n31 = m[2], n41 = m[3], n12 = m[4], n22 = m[5], n32 = m[6], n42 = m[7], n13 = m[8], n23 = m[9], n33 = m[10], n43 = m[11], n14 = m[12], n24 = m[13], n34 = m[14], n44 = m[15];
        const t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44,
            t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44,
            t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44,
            t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;
        const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;
        if (det === 0) return M4.ident(o);
        const d = 1 / det;
        o[0] = t11 * d; o[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * d;
        o[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * d;
        o[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * d;
        o[4] = t12 * d; o[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * d;
        o[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * d;
        o[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * d;
        o[8] = t13 * d; o[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * d;
        o[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * d;
        o[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * d;
        o[12] = t14 * d; o[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * d;
        o[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * d;
        o[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * d;
        return o;
    },
    ortho(o, l, r, t, b, n, f) {
        const w = 1 / (r - l), h = 1 / (t - b), p = 1 / (f - n);
        o[0] = 2 * w; o[1] = 0; o[2] = 0; o[3] = 0; o[4] = 0; o[5] = 2 * h; o[6] = 0; o[7] = 0; o[8] = 0; o[9] = 0; o[10] = -2 * p; o[11] = 0;
        o[12] = -(r + l) * w; o[13] = -(t + b) * h; o[14] = -(f + n) * p; o[15] = 1; return o;
    },
    perspective(o, fovDeg, aspect, n, f) {
        const t = 1 / Math.tan(fovDeg * Math.PI / 360), p = 1 / (n - f);
        o[0] = t / aspect; o[1] = 0; o[2] = 0; o[3] = 0; o[4] = 0; o[5] = t; o[6] = 0; o[7] = 0; o[8] = 0; o[9] = 0; o[10] = (f + n) * p; o[11] = -1;
        o[12] = 0; o[13] = 0; o[14] = 2 * f * n * p; o[15] = 0; return o;
    },
    lookAt(o, ex, ey, ez, tx, ty, tz) {      // a VIEW matrix looking from eye to target, world up = +Y
        let zx = ex - tx, zy = ey - ty, zz = ez - tz, l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
        let ux = 0, uy = 1, uz = 0; if (Math.abs(zy) > 0.9999) { ux = 0; uy = 0; uz = zy > 0 ? -1 : 1; }
        let xx = uy * zz - uz * zy, xy = uz * zx - ux * zz, xz = ux * zy - uy * zx; l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
        const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
        o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0; o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0; o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
        o[12] = -(xx * ex + xy * ey + xz * ez); o[13] = -(yx * ex + yy * ey + yz * ez); o[14] = -(zx * ex + zy * ey + zz * ez); o[15] = 1; return o;
    },
    compose(o, px, py, pz, qx, qy, qz, qw, sx, sy, sz) {
        const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz, xx = qx * x2, xy = qx * y2, xz = qx * z2, yy = qy * y2, yz = qy * z2, zz = qz * z2, wx = qw * x2, wy = qw * y2, wz = qw * z2;
        o[0] = (1 - (yy + zz)) * sx; o[1] = (xy + wz) * sx; o[2] = (xz - wy) * sx; o[3] = 0;
        o[4] = (xy - wz) * sy; o[5] = (1 - (xx + zz)) * sy; o[6] = (yz + wx) * sy; o[7] = 0;
        o[8] = (xz + wy) * sz; o[9] = (yz - wx) * sz; o[10] = (1 - (xx + yy)) * sz; o[11] = 0;
        o[12] = px; o[13] = py; o[14] = pz; o[15] = 1; return o;
    },
    normal3(o, m) {         // 3x3 inverse-transpose of the upper-left of m (for normals)
        const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], i = m[10];
        const A = e * i - f * h, B = f * g - d * i, C = d * h - e * g, det = a * A + b * B + c * C, k = det ? 1 / det : 0;
        o[0] = A * k; o[1] = B * k; o[2] = C * k; o[3] = (c * h - b * i) * k; o[4] = (a * i - c * g) * k; o[5] = (b * g - a * h) * k;
        o[6] = (b * f - c * e) * k; o[7] = (c * d - a * f) * k; o[8] = (a * e - b * d) * k; return o;
    }
};
// frustum planes (6 x [nx,ny,nz,d]) from a view-projection matrix, and a sphere test against them
function setFrustum(pl, m) {
    const rows = [[m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]], [m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]], [m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]],
        [m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]], [m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]], [m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]]];
    for (let i = 0; i < 6; i++) { const r = rows[i], l = 1 / (Math.hypot(r[0], r[1], r[2]) || 1); pl[i * 4] = r[0] * l; pl[i * 4 + 1] = r[1] * l; pl[i * 4 + 2] = r[2] * l; pl[i * 4 + 3] = r[3] * l; }
}
function sphereVisible(pl, x, y, z, r) { for (let i = 0; i < 24; i += 4) if (pl[i] * x + pl[i + 1] * y + pl[i + 2] * z + pl[i + 3] < -r) return false; return true; }
function linToSrgb(c) { return c <= 0 ? 0 : c < 0.0031308 ? c * 12.92 : c >= 1 ? 1 : 1.055 * Math.pow(c, 0.41666) - 0.055; }

// ---------- the engine object: context + cached GL state ----------
function createEngine(canvas, attrs) {
    if (typeof WebGL2RenderingContext === 'undefined') return null;
    let gl = null;
    // alpha is always on, as in three.js: an opaque drawing buffer costs the browser an extra full-screen step on some
    // graphics stacks. The picture stays opaque because opaque materials write alpha 1 and the clear alpha is 1.
    try { gl = canvas.getContext('webgl2', Object.assign({ antialias: false, depth: true, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' }, attrs || {}, { alpha: true })); } catch (e) { gl = null; }
    if (!gl) return null;
    const E = {
        gl, canvas, gen: 1, lost: false, failed: null,
        programs: new Map(), nextProgId: 1, nextHookId: 1,
        S: null, ubo: null, uboData: new Float32Array(U_FLOATS), pixelRatio: 1, spriteGeo: null, white: null, shadow: null,
        stats: { calls: 0, tris: 0, geometries: 0, textures: 0, programs: 0, texBytes: 0 },
        aniso: null, maxAniso: 1, floatLinear: false
    };
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); E.lost = true; }, false);
    canvas.addEventListener('webglcontextrestored', () => { E.gen++; E.programs.clear(); E.shadow = null; E.white = null; E.ubo = null; E.stats.geometries = E.stats.textures = E.stats.programs = E.stats.texBytes = 0; E.lost = false; initGL(E); }, false);
    initGL(E);
    return E;
}
function initGL(E) {
    const gl = E.gl;
    E.aniso = gl.getExtension('EXT_texture_filter_anisotropic'); E.maxAniso = E.aniso ? gl.getParameter(E.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1;
    E.floatLinear = !!gl.getExtension('OES_texture_float_linear'); gl.getExtension('EXT_color_buffer_float');
    E.S = { prog: null, vao: null, blend: -1, depthTest: -1, depthMask: -1, depthFunc: -1, cull: -1, poly: -1, polyF: 0, polyU: 0, colorMask: -1, unit: -1, tex: [] };
    gl.frontFace(gl.CCW); gl.clearDepth(1);
    E.ubo = gl.createBuffer(); gl.bindBuffer(gl.UNIFORM_BUFFER, E.ubo); gl.bufferData(gl.UNIFORM_BUFFER, E.uboData.byteLength, gl.DYNAMIC_DRAW); gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, E.ubo);
    E.white = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, E.white); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
}
// state setters: each one talks to GL only when the value really changes
function useProgram(E, p) { if (E.S.prog !== p) { E.S.prog = p; E.gl.useProgram(p.prog); } }
function bindVAO(E, v) { if (E.S.vao !== v) { E.S.vao = v; E.gl.bindVertexArray(v); } }
function bindTex(E, unit, target, tex) {
    const S = E.S, gl = E.gl; if (S.tex[unit] === tex) return;
    if (S.unit !== unit) { S.unit = unit; gl.activeTexture(gl.TEXTURE0 + unit); }
    S.tex[unit] = tex; gl.bindTexture(target, tex);
}
// for uploads: make unit 0 the ACTIVE unit with this texture on it (bindTex alone may leave another unit active)
function bindForUpload(E, tex) {
    const S = E.S, gl = E.gl;
    if (S.unit !== 0) { S.unit = 0; gl.activeTexture(gl.TEXTURE0); }
    if (S.tex[0] !== tex) { S.tex[0] = tex; gl.bindTexture(gl.TEXTURE_2D, tex); }
}
function setBlend(E, mode) {         // 0 none, 1 normal, 2 additive, 3 subtractive, 4 multiply (three's numbers)
    const S = E.S, gl = E.gl; if (S.blend === mode) return; S.blend = mode;
    if (mode === 0) { gl.disable(gl.BLEND); return; }
    gl.enable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD);
    if (mode === 2) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    else if (mode === 3) gl.blendFuncSeparate(gl.ZERO, gl.ONE_MINUS_SRC_COLOR, gl.ZERO, gl.ONE);
    else if (mode === 4) gl.blendFunc(gl.ZERO, gl.SRC_COLOR);
    else gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
}
function setDepth(E, test, write, func) {
    const S = E.S, gl = E.gl;
    if (S.depthTest !== test) { S.depthTest = test; test ? gl.enable(gl.DEPTH_TEST) : gl.disable(gl.DEPTH_TEST); }
    if (S.depthMask !== write) { S.depthMask = write; gl.depthMask(!!write); }
    if (S.depthFunc !== func) { S.depthFunc = func; gl.depthFunc(func); }
}
function setCull(E, mode) {          // 0 off, 1 cull back faces, 2 cull front faces
    const S = E.S, gl = E.gl; if (S.cull === mode) return;
    if (mode === 0) gl.disable(gl.CULL_FACE); else { if (S.cull <= 0) gl.enable(gl.CULL_FACE); gl.cullFace(mode === 1 ? gl.BACK : gl.FRONT); }
    S.cull = mode;
}
function setPoly(E, on, f, u) {
    const S = E.S, gl = E.gl;
    if (S.poly !== on) { S.poly = on; on ? gl.enable(gl.POLYGON_OFFSET_FILL) : gl.disable(gl.POLYGON_OFFSET_FILL); }
    if (on && (S.polyF !== f || S.polyU !== u)) { S.polyF = f; S.polyU = u; gl.polygonOffset(f, u); }
}
function setColorMask(E, on) { const S = E.S; if (S.colorMask !== on) { S.colorMask = on; E.gl.colorMask(on, on, on, on); } }
