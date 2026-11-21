// HG3D engine. BUILT FILE: edit engine/src/*.js, then run `node tools/build-engine.js`.
const HG3D = (() => {
'use strict';
// ---- 00-core.js ----
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
    try { gl = canvas.getContext('webgl2', Object.assign({ antialias: false, alpha: false, depth: true, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' }, attrs || {})); } catch (e) { gl = null; }
    if (!gl) return null;
    const E = {
        gl, canvas, gen: 1, lost: false, failed: null,
        programs: new Map(), nextProgId: 1, nextHookId: 1,
        S: null, ubo: null, uboData: new Float32Array(132), white: null, shadow: null,
        stats: { calls: 0, tris: 0, geometries: 0, textures: 0, programs: 0 },
        aniso: null, maxAniso: 1, floatLinear: false
    };
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); E.lost = true; }, false);
    canvas.addEventListener('webglcontextrestored', () => { E.gen++; E.programs.clear(); E.shadow = null; E.white = null; E.ubo = null; E.stats.geometries = E.stats.textures = E.stats.programs = 0; E.lost = false; initGL(E); }, false);
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

// ---- 20-shaders.js ----
// ============================================================
// Shaders. Lighting is worked out per VERTEX (hemisphere + up to two suns + up to four point lights);
// the fragment shader only multiplies, takes at most one texture sample and one or four shadow taps,
// then tone-maps, encodes sRGB and fogs in the same pass. Programs are a few hundred bytes of GLSL each
// (three.js' are 30-60 KB), so they compile fast and there are few of them.
// ============================================================
// the per-frame uniform block: written once per render() call, shared by every engine program
const UBO_GLSL = `layout(std140) uniform HGFrame {
 mat4 uViewProj; mat4 uView; mat4 uShadowMat;
 vec4 uCamPos; vec4 uHemiSky; vec4 uHemiGround; vec4 uHemiDir; vec4 uAmbient;
 vec4 uSunDir[2]; vec4 uSunCol[2];
 vec4 uFogColor; vec4 uFogParams; vec4 uShadowParams; vec4 uOut;
 vec4 uPLPos[4]; vec4 uPLCol[4];
};
`;
const U_VIEWPROJ = 0, U_VIEW = 16, U_SHADOWMAT = 32, U_CAMPOS = 48, U_HEMISKY = 52, U_HEMIGROUND = 56, U_HEMIDIR = 60, U_AMBIENT = 64, U_SUNDIR = 68, U_SUNCOL = 76, U_FOGCOLOR = 84, U_FOGPARAMS = 88, U_SHADOWPARAMS = 92, U_OUT = 96, U_PLPOS = 100, U_PLCOL = 116;
const BUILTIN_ATTR = { position: 0, normal: 1, uv: 2, color: 3, instanceMatrix: 4, instanceColor: 8 };
const BUILTIN_UNI = { modelMatrix: 1, modelViewMatrix: 1, projectionMatrix: 1, viewMatrix: 1, normalMatrix: 1, cameraPosition: 1, isOrthographic: 1, uMat: 1, uUvT: 1, map: 1, uShadowMap: 1, uDepthVP: 1 };

const ENCODE_GLSL = `
vec3 hgEncode(vec3 c){
#ifdef TONEMAP_ACES
 c *= uOut.x / 0.6;
 c = mat3(0.59719,0.07600,0.02840, 0.35458,0.90834,0.13383, 0.04823,0.01566,0.83777) * c;
 c = (c * (c + 0.0245786) - 0.000090537) / (c * (0.983729 * c + 0.4329510) + 0.238081);
 c = mat3(1.60475,-0.10208,-0.00327, -0.53108,1.10813,-0.07276, -0.07367,-0.00605,1.07602) * c;
#endif
 c = clamp(c, 0.0, 1.0);
#ifdef SRGB_OUT
 vec3 s1 = sqrt(c), s2 = sqrt(s1), s3 = sqrt(s2);
 c = 0.662002687 * s1 + 0.684122060 * s2 - 0.323583601 * s3 - 0.0225411470 * c;
#endif
 return c;
}
float hgFog(float d){
#ifdef FOG_EXP2
 return 1.0 - exp(-uFogParams.z * uFogParams.z * d * d);
#else
 float f = clamp((d - uFogParams.x) * uFogParams.y, 0.0, 1.0); return f * f * (3.0 - 2.0 * f);
#endif
}
`;

// f: { defines: ['USE_COLOR', ...], colorType: 'vec3'|'vec4', numSun, numPL, hook }
function litVertex(f) {
    const h = f.hook || {};
    return `#version 300 es
precision highp float; precision highp int;
${f.defines.map(d => '#define ' + d).join('\n')}
#define NUM_SUN ${f.numSun}
#define NUM_PL ${f.numPL}
${UBO_GLSL}
layout(location=0) in vec3 position;
#ifndef UNLIT
layout(location=1) in vec3 normal;
#endif
#ifdef USE_UV
layout(location=2) in vec2 uv; out vec2 vUv; uniform mat3 uUvT;
#endif
#ifdef USE_COLOR
layout(location=3) in ${f.colorType || 'vec3'} color;
#endif
#ifdef USE_INSTANCING
layout(location=4) in mat4 instanceMatrix;
#endif
#ifdef USE_INSTANCING_COLOR
layout(location=8) in vec3 instanceColor;
#endif
uniform mat4 modelMatrix;
uniform vec4 uMat[4];
#define uDiffuse uMat[0]
#define uEmissive uMat[1].rgb
#define uAlphaTest uMat[1].a
#define uSpec uMat[2]
#define uSpecCol uMat[3].rgb
out vec3 vAlb; out float vDepth;
#ifdef VFINAL
${ENCODE_GLSL}
#ifdef DOUBLE_SIDED
out vec3 vBack;
#endif
#endif
#ifdef USE_COLOR_ALPHA
out float vAlpha;
#endif
#ifndef UNLIT
out vec3 vLa; out vec3 vLs; out vec3 vEm;
#ifdef DOUBLE_SIDED
out vec3 vLaB; out vec3 vLsB;
#endif
#ifdef SPEC_VERTEX
out vec3 vSp;
#endif
#ifdef SPEC_PIXEL
out vec3 vN; out vec3 vWp; out vec3 vF;
#endif
#ifdef SHADOW
out vec3 vSh;
#endif
vec3 hgAmbient(vec3 N, vec3 wp){
 vec3 la = mix(uHemiGround.rgb, uHemiSky.rgb, dot(N, uHemiDir.xyz) * 0.5 + 0.5) + uAmbient.rgb;
#if NUM_SUN > 1
 la += uSunCol[1].rgb * max(dot(N, uSunDir[1].xyz), 0.0);
#endif
#if NUM_PL > 0
 for (int i = 0; i < NUM_PL; i++) {
  vec3 L = uPLPos[i].xyz - wp; float d = max(length(L), 0.0001); L /= d;
  float att = 1.0 / max(pow(d, uPLCol[i].w), 0.01);
  if (uPLPos[i].w > 0.0) { float q = d / uPLPos[i].w; q *= q; q *= q; float s = clamp(1.0 - q, 0.0, 1.0); att *= s * s; }
  la += uPLCol[i].rgb * (att * max(dot(N, L), 0.0));
 }
#endif
 return la;
}
#endif
${h.vDecl || ''}
void main(){
 vec4 p4 = vec4(position, 1.0);
${h.vPos || ''}
#ifdef USE_INSTANCING
 p4 = instanceMatrix * p4;
#endif
 vec4 wp4 = modelMatrix * p4; vec3 wp = wp4.xyz;
 vDepth = -(uView * wp4).z;
 gl_Position = uViewProj * wp4;
 vec3 alb = uDiffuse.rgb;
#ifdef USE_COLOR
 alb *= color.rgb;
#endif
#ifdef USE_COLOR_ALPHA
 vAlpha = color.a;
#endif
#ifdef USE_INSTANCING_COLOR
 alb *= instanceColor;
#endif
#ifdef USE_UV
 vUv = (uUvT * vec3(uv, 1.0)).xy;
#endif
#ifdef UNLIT
#ifdef VFINAL
 vAlb = hgEncode(alb);
#else
 vAlb = alb;
#endif
#else
 vec3 n = normal;
#ifdef USE_INSTANCING
 { mat3 im = mat3(instanceMatrix); n /= max(vec3(dot(im[0], im[0]), dot(im[1], im[1]), dot(im[2], im[2])), vec3(1e-12)); n = im * n; }
#endif
 { mat3 mm = mat3(modelMatrix); n /= max(vec3(dot(mm[0], mm[0]), dot(mm[1], mm[1]), dot(mm[2], mm[2])), vec3(1e-12)); n = mm * n; }
 vec3 N = normalize(n);
 float ndl = 0.0; vec3 sunc = vec3(0.0);
#if NUM_SUN > 0
 ndl = max(dot(N, uSunDir[0].xyz), 0.0); sunc = uSunCol[0].rgb;
#endif
 vLa = hgAmbient(N, wp); vLs = sunc * ndl; vEm = uEmissive;
#ifdef DOUBLE_SIDED
 vLaB = hgAmbient(-N, wp);
#if NUM_SUN > 0
 vLsB = sunc * max(dot(-N, uSunDir[0].xyz), 0.0);
#else
 vLsB = vec3(0.0);
#endif
#endif
 vec3 F = mix(uSpecCol, alb, uSpec.z);
 vAlb = alb * (1.0 - uSpec.z);
#ifdef SPEC_VERTEX
#if NUM_SUN > 0
 { vec3 V = normalize(uCamPos.xyz - wp); vec3 H = normalize(V + uSunDir[0].xyz); vSp = F * (uSpec.y * pow(max(dot(N, H), 0.0), uSpec.x) * ndl) * sunc; }
#else
 vSp = vec3(0.0);
#endif
#endif
#ifdef SPEC_PIXEL
 vN = N; vWp = wp; vF = F;
#endif
#ifdef SHADOW
 vSh = (uShadowMat * vec4(wp + N * uShadowParams.y, 1.0)).xyz;
#endif
#ifdef VFINAL
 {
  vec3 cf = vAlb * (vLa + vLs) + vEm;
#ifdef SPEC_VERTEX
  cf += vSp;
#endif
#ifdef DOUBLE_SIDED
  vBack = hgEncode(vAlb * (vLaB + vLsB) + vEm);
#endif
  vAlb = hgEncode(cf);
 }
#endif
#endif
${h.vMain || ''}
}`;
}
function litFragment(f) {
    const h = f.hook || {};
    return `#version 300 es
precision highp float; precision highp int; precision highp sampler2DShadow;
${f.defines.map(d => '#define ' + d).join('\n')}
#define NUM_SUN ${f.numSun}
${UBO_GLSL}
uniform vec4 uMat[4];
#define uDiffuse uMat[0]
#define uEmissive uMat[1].rgb
#define uAlphaTest uMat[1].a
#define uSpec uMat[2]
#define uSpecCol uMat[3].rgb
#ifdef USE_MAP
in vec2 vUv; uniform sampler2D map;
#endif
in vec3 vAlb; in float vDepth;
#ifdef USE_COLOR_ALPHA
in float vAlpha;
#endif
#if defined(VFINAL) && defined(DOUBLE_SIDED)
in vec3 vBack;
#endif
#if !defined(UNLIT) && !defined(VFINAL)
in vec3 vLa; in vec3 vLs; in vec3 vEm;
#ifdef DOUBLE_SIDED
in vec3 vLaB; in vec3 vLsB;
#endif
#ifdef SPEC_VERTEX
in vec3 vSp;
#endif
#ifdef SPEC_PIXEL
in vec3 vN; in vec3 vWp; in vec3 vF;
#endif
#ifdef SHADOW
in vec3 vSh; uniform sampler2DShadow uShadowMap;
#endif
#endif
out vec4 fragColor;
${ENCODE_GLSL}
${h.fDecl || ''}
void main(){
 vec3 alb = vAlb; float alpha = uDiffuse.a;
#ifdef USE_COLOR_ALPHA
 alpha *= vAlpha;
#endif
#ifdef USE_MAP
 vec4 tx = texture(map, vUv); alb *= tx.rgb; alpha *= tx.a;
#endif
${h.fAlbedo || ''}
#ifdef ALPHATEST
 if (alpha < uAlphaTest) discard;
#endif
#ifdef VFINAL
#ifdef DOUBLE_SIDED
 vec3 c = gl_FrontFacing ? alb : vBack;
#else
 vec3 c = alb;
#endif
#elif defined(UNLIT)
 vec3 c = alb;
#else
 float sh = 1.0;
#ifdef SHADOW
 if (vSh.x > 0.0 && vSh.x < 1.0 && vSh.y > 0.0 && vSh.y < 1.0 && vSh.z < 1.0) {
  vec3 sc = vec3(vSh.xy, vSh.z + uShadowParams.x);
#ifdef SHADOW_SOFT
  float t = uShadowParams.z * 0.75;
  sh = 0.25 * (texture(uShadowMap, sc + vec3(-t, -t, 0.0)) + texture(uShadowMap, sc + vec3(t, -t, 0.0)) + texture(uShadowMap, sc + vec3(-t, t, 0.0)) + texture(uShadowMap, sc + vec3(t, t, 0.0)));
#else
  sh = texture(uShadowMap, sc);
#endif
 }
#endif
#ifdef DOUBLE_SIDED
 vec3 la = gl_FrontFacing ? vLa : vLaB; vec3 ls = gl_FrontFacing ? vLs : vLsB;
#else
 vec3 la = vLa; vec3 ls = vLs;
#endif
 vec3 c = alb * (la + ls * sh) + vEm;
#ifdef SPEC_VERTEX
 c += vSp * sh;
#endif
#ifdef SPEC_PIXEL
#if NUM_SUN > 0
 { vec3 N = normalize(vN); vec3 V = normalize(uCamPos.xyz - vWp); vec3 H = normalize(V + uSunDir[0].xyz);
   c += vF * (uSpec.y * pow(max(dot(N, H), 0.0), uSpec.x) * max(dot(N, uSunDir[0].xyz), 0.0) * sh) * uSunCol[0].rgb; }
#endif
#endif
#endif
${h.fFinal || ''}
#ifndef VFINAL
 c = hgEncode(c);
#endif
#ifdef FOG
 c = mix(c, uFogColor.rgb, hgFog(vDepth));
#endif
 fragColor = vec4(c, alpha);
}`;
}
const DEPTH_VS = inst => `#version 300 es
precision highp float;
layout(location=0) in vec3 position;
${inst ? 'layout(location=4) in mat4 instanceMatrix;' : ''}
uniform mat4 modelMatrix; uniform mat4 uDepthVP;
void main(){ vec4 p = vec4(position, 1.0); ${inst ? 'p = instanceMatrix * p;' : ''} gl_Position = uDepthVP * (modelMatrix * p); }`;
const DEPTH_FS = `#version 300 es
precision mediump float;
void main(){}`;

// ---- a three.js ShaderMaterial's own GLSL, run unchanged: the same names three would have declared ----
const CHUNKS = {
    common: '#define PI 3.141592653589793\n#define PI2 6.283185307179586\n#define RECIPROCAL_PI 0.3183098861837907\n#define EPSILON 1e-6\n#ifndef saturate\n#define saturate( a ) clamp( a, 0.0, 1.0 )\n#endif\nfloat pow2( const in float x ) { return x*x; }\n',
    colorspace_fragment: 'gl_FragColor = vec4(hgSrgb(gl_FragColor.rgb), gl_FragColor.a);',
    tonemapping_fragment: '', fog_pars_vertex: '', fog_vertex: '', fog_pars_fragment: '', fog_fragment: '', logdepthbuf_pars_vertex: '', logdepthbuf_vertex: '', logdepthbuf_pars_fragment: '', logdepthbuf_fragment: '', clipping_planes_pars_vertex: '', clipping_planes_vertex: '', clipping_planes_pars_fragment: '', clipping_planes_fragment: ''
};
function resolveIncludes(src) { return src.replace(/^[ \t]*#include +<([\w\d./]+)>/gm, (m, name) => { if (CHUNKS[name] === undefined) { warnOnce('shader chunk <' + name + '> is not supported; left out'); return ''; } return CHUNKS[name]; }); }
function rawDefines(mat, inst, instColor) {
    let s = ''; const d = mat.defines; if (d) for (const k in d) if (d[k] !== false) s += '#define ' + k + ' ' + d[k] + '\n';
    if (mat.vertexColors) s += '#define USE_COLOR\n'; if (inst) s += '#define USE_INSTANCING\n'; if (instColor) s += '#define USE_INSTANCING_COLOR\n';
    return s;
}
function rawVertex(mat, inst, instColor) {
    return `#version 300 es
#define attribute in
#define varying out
#define texture2D texture
precision highp float; precision highp int;
#define HG3D 1
${rawDefines(mat, inst, instColor)}uniform mat4 modelMatrix; uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix; uniform mat4 viewMatrix; uniform mat3 normalMatrix; uniform vec3 cameraPosition; uniform bool isOrthographic;
layout(location=0) in vec3 position; layout(location=1) in vec3 normal; layout(location=2) in vec2 uv;
#ifdef USE_COLOR
layout(location=3) in vec3 color;
#endif
#ifdef USE_INSTANCING
layout(location=4) in mat4 instanceMatrix;
#endif
#ifdef USE_INSTANCING_COLOR
layout(location=8) in vec3 instanceColor;
#endif
${resolveIncludes(mat.vertexShader)}`;
}
function rawFragment(mat, inst, instColor) {
    return `#version 300 es
#define varying in
layout(location=0) out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
#define gl_FragDepthEXT gl_FragDepth
#define texture2D texture
#define textureCube texture
#define texture2DLodEXT textureLod
precision highp float; precision highp int; precision highp sampler2D;
#define HG3D 1
${rawDefines(mat, inst, instColor)}uniform mat4 viewMatrix; uniform vec3 cameraPosition; uniform bool isOrthographic;
vec3 hgSrgb(vec3 c){ c = clamp(c, 0.0, 1.0); vec3 s1 = sqrt(c), s2 = sqrt(s1), s3 = sqrt(s2); return 0.662002687 * s1 + 0.684122060 * s2 - 0.323583601 * s3 - 0.0225411470 * c; }
${resolveIncludes(mat.fragmentShader)}`;
}

// ---- compile + link, with reflection of uniforms and of the attributes the game declared itself ----
function compileShader(gl, type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s) || 'unknown error', m = /ERROR: \d+:(\d+)/.exec(log), line = m ? +m[1] : 0;
        const ctx = line ? src.split('\n').slice(Math.max(0, line - 2), line + 1).join(' | ') : '';
        gl.deleteShader(s); throw new Error('HG3D shader: ' + log.trim().slice(0, 300) + (ctx ? ' @ ' + ctx.slice(0, 200) : ''));
    }
    return s;
}
const ATTR_RE = /\b(?:attribute|in)\s+(?:(?:lowp|mediump|highp)\s+)?(float|vec[234]|mat[34]|int|ivec[234]|uint|uvec[234])\s+(\w+)\s*;/g;
function linkProgram(E, key, vsSrc, fsSrc) {
    const gl = E.gl, p = gl.createProgram(), vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc), fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
    gl.attachShader(p, vs); gl.attachShader(p, fs);
    const custom = {}; let loc = 9, m, layout = ''; ATTR_RE.lastIndex = 0;
    while ((m = ATTR_RE.exec(vsSrc))) {
        const name = m[2]; if (BUILTIN_ATTR[name] !== undefined || custom[name] !== undefined) continue;
        if (loc > 15) { warnOnce('too many custom vertex attributes; ' + name + ' ignored'); continue; }
        gl.bindAttribLocation(p, loc, name); custom[name] = loc; layout += name + loc + ','; loc += m[1] === 'mat4' ? 4 : m[1] === 'mat3' ? 3 : 1;
    }
    gl.linkProgram(p); gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { const log = gl.getProgramInfoLog(p); gl.deleteProgram(p); throw new Error('HG3D link: ' + String(log).slice(0, 300)); }
    const P = { id: E.nextProgId++, key, prog: p, custom, layout, u: {}, user: [], frame: -1, mat: null, matFrame: -1 };
    const bi = gl.getUniformBlockIndex(p, 'HGFrame'); if (bi !== gl.INVALID_INDEX) gl.uniformBlockBinding(p, bi, 0);
    useProgram(E, P);
    let unit = 2; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(p, i); if (!info) continue; const name = info.name.replace(/\[0\]$/, ''), l = gl.getUniformLocation(p, info.name); if (l === null) continue;
        const sampler = info.type === gl.SAMPLER_2D || info.type === gl.SAMPLER_2D_SHADOW || info.type === gl.SAMPLER_CUBE || info.type === gl.SAMPLER_3D || info.type === gl.SAMPLER_2D_ARRAY || info.type === gl.INT_SAMPLER_2D || info.type === gl.UNSIGNED_INT_SAMPLER_2D;
        const rec = { name, loc: l, type: info.type, size: info.size, unit: -1 };
        if (name === 'map') { rec.unit = 0; gl.uniform1i(l, 0); } else if (name === 'uShadowMap') { rec.unit = 1; gl.uniform1i(l, 1); } else if (sampler) { rec.unit = unit; gl.uniform1i(l, unit); unit++; }
        P.u[name] = rec; if (!BUILTIN_UNI[name]) P.user.push(rec);
    }
    E.programs.set(key, P); E.stats.programs = E.programs.size;
    return P;
}
function getProgram(E, key, makeVS, makeFS) { let P = E.programs.get(key); if (P === undefined) P = linkProgram(E, key, makeVS(), makeFS()); return P; }

// write the game's own uniforms ({ name: { value } }): numbers, three vectors/colours/matrices, arrays, textures
function setUserUniforms(E, P, uniforms) {
    const gl = E.gl, list = P.user;
    for (let i = 0; i < list.length; i++) {
        const r = list[i], u = uniforms[r.name]; if (u === undefined) continue; const v = u.value; if (v === undefined || v === null) { if (r.unit >= 0) bindTex(E, r.unit, gl.TEXTURE_2D, E.white); continue; }
        switch (r.type) {
            case gl.FLOAT: if (r.size > 1) gl.uniform1fv(r.loc, v); else gl.uniform1f(r.loc, v); break;
            case gl.INT: case gl.BOOL: gl.uniform1i(r.loc, v === true ? 1 : v === false ? 0 : v); break;
            case gl.FLOAT_VEC2: if (v.x !== undefined) gl.uniform2f(r.loc, v.x, v.y); else gl.uniform2fv(r.loc, v); break;
            case gl.FLOAT_VEC3: if (v.r !== undefined) gl.uniform3f(r.loc, v.r, v.g, v.b); else if (v.x !== undefined) gl.uniform3f(r.loc, v.x, v.y, v.z); else gl.uniform3fv(r.loc, v); break;
            case gl.FLOAT_VEC4: if (v.x !== undefined) gl.uniform4f(r.loc, v.x, v.y, v.z, v.w); else gl.uniform4fv(r.loc, v); break;
            case gl.FLOAT_MAT3: gl.uniformMatrix3fv(r.loc, false, v.elements || v); break;
            case gl.FLOAT_MAT4: gl.uniformMatrix4fv(r.loc, false, v.elements || v); break;
            default: if (r.unit >= 0) bindTex(E, r.unit, gl.TEXTURE_2D, textureFor(E, v));
        }
    }
}

// ---- 30-resources.js ----
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
    bindTex(E, 0, gl.TEXTURE_2D, r.tex);
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
    const tex = gl.createTexture(); bindTex(E, 1, gl.TEXTURE_2D, tex);
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

// ---- 40-render.js ----
// ============================================================
// The frame: walk the scene once (no recursion, no allocation), keep a small cached "item" on every
// drawable (program + vertex array), fill the frame uniform block, draw the shadow map, then draw
// opaque things grouped by program, the sky last (only the pixels nothing else covered), then
// transparent things back to front.
// ============================================================
const DEPTH_FUNCS = [0x0200, 0x0207, 0x0201, 0x0203, 0x0202, 0x0206, 0x0204, 0x0205];   // three's depthFunc 0..7 -> GL
const TMP = { mat: new Float32Array(16), m: new Float32Array(16), mv: new Float32Array(16), n3: new Float32Array(9), vp: new Float32Array(16), lv: new Float32Array(16), lp: new Float32Array(16), lvp: new Float32Array(16), id3: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), planes: new Float32Array(24), bias: new Float32Array([0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0.5, 0, 0.5, 0.5, 0.5, 1]) };
function setFrustumFast(pl, m) {
    let k = 0;
    for (let i = 0; i < 3; i++) for (let s = -1; s <= 1; s += 2) {
        const x = m[3] + s * m[i], y = m[7] + s * m[4 + i], z = m[11] + s * m[8 + i], d = m[15] + s * m[12 + i], l = 1 / (Math.hypot(x, y, z) || 1);
        pl[k++] = x * l; pl[k++] = y * l; pl[k++] = z * l; pl[k++] = d * l;
    }
}
function newLists() { return { stack: [], objs: [], n: 0, casters: [], nc: 0, opaque: [], no: 0, transp: [], nt: 0, sky: [], ns: 0 }; }
function newLights() { return { hemi: null, ar: 0, ag: 0, ab: 0, sun0: null, sun1: null, nSun: 0, pl: [null, null, null, null], nPL: 0 }; }

function materialInfo(E, mat) {
    let mi = mat.__hgm;
    if (mi !== undefined && mi.v === mat.version) return mi;
    mi = mat.__hgm = { v: mat.version, kind: -1, hook: null, hookId: 0, sky: false, spec: 0, shin: 1, specScale: 0, metal: 0, rawId: 0, transparent: false, blend: 0, depthTest: 1, depthWrite: 1, depthFunc: 0x0203, cull: 1, poly: 0, pf: 0, pu: 0 };
    const ud = mat.userData && mat.userData.hg;
    if (ud) { mi.sky = !!ud.sky; if (ud.vDecl || ud.vPos || ud.vMain || ud.fDecl || ud.fAlbedo || ud.fFinal) { mi.hook = ud; if (!ud.__id) ud.__id = E.nextHookId++; mi.hookId = ud.__id; } }
    if (mat.isShaderMaterial) {
        mi.kind = 2; const src = mat.vertexShader + '\u0000' + mat.fragmentShader + '\u0000' + JSON.stringify(mat.defines || {}) + (mat.vertexColors ? 'c' : '');
        if (!E.rawIds) E.rawIds = new Map(); let id = E.rawIds.get(src); if (id === undefined) { id = E.rawIds.size + 1; E.rawIds.set(src, id); } mi.rawId = id;
    } else if (mat.isMeshBasicMaterial) mi.kind = 1;
    else if (mat.isMeshLambertMaterial || mat.isMeshStandardMaterial || mat.isMeshPhongMaterial || mat.isMeshToonMaterial || mat.isMeshMatcapMaterial) {
        mi.kind = 0;
        if (mat.isMeshStandardMaterial) {      // roughness -> a Blinn-Phong lobe of about the same width
            const r = Math.max(0.05, mat.roughness === undefined ? 1 : mat.roughness), a2 = r * r * r * r, n = Math.min(256, Math.max(1, 2 / a2 - 2));
            mi.metal = mat.metalness || 0; mi.shin = n; mi.specScale = (n + 8) / 8;
            mi.spec = (r < 0.9 || mi.metal > 0.05) ? (r < 0.4 ? 2 : 1) : 0;
        } else if (mat.isMeshPhongMaterial) { mi.shin = Math.max(1, mat.shininess || 30); mi.specScale = 0.25 * (mi.shin * 0.5 + 1); mi.spec = mi.shin > 60 ? 2 : 1; }
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
function newItem(E, o) {
    const old = o.__hg, mat = o.material, geo = o.geometry;
    if (old !== undefined && old.vao && old.gen === E.gen) { E.gl.deleteVertexArray(old.vao); if (E.S.vao === old.vao) E.S.vao = null; E.stats.geometries--; }
    const it = o.__hg = { gen: E.gen, o, geo, mat, matV: mat.version, mi: null, iCol: o.instanceColor || null, iMat: o.instanceMatrix || null, recv: o.receiveShadow === true, pos: geo.attributes ? geo.attributes.position : null,
        inst: o.isInstancedMesh === true, gInst: false, gMax: Infinity, env: -1, prog: null, dprog: null, vao: null, layout: null, attrs: [], attrInst: [], na: 0, idx: null, idxType: 0, idxBytes: 2, mode: 4, key: 0, z: 0, ro: 0 };
    if (Array.isArray(mat)) { warnOnce('multi-material meshes are not supported; object skipped'); it.mi = { kind: -1 }; return it; }
    it.mi = materialInfo(E, mat);
    it.mode = o.isLineSegments ? 1 : o.isLine ? 3 : o.isPoints ? 0 : 4;
    return it;
}
function resolveItem(E, it) {
    const mi = it.mi, mat = it.mat, geo = it.geo, ga = geo.attributes, o = it.o, env = E.env; it.env = E.envCode; it.prog = null;
    if (mi.kind < 0 || !ga || !ga.position) return;
    try {
        let P;
        if (mi.kind === 2) {
            const inst = it.inst, ic = !!it.iCol;
            P = getProgram(E, 'R' + mi.rawId + (inst ? 'I' : '') + (ic ? 'K' : ''), () => rawVertex(mat, inst, ic), () => rawFragment(mat, inst, ic));
        } else {
            const d = [], lit = mi.kind === 0; let colorType = 'vec3';
            if (!lit) d.push('UNLIT');
            if (it.inst) d.push('USE_INSTANCING'); if (it.inst && it.iCol) d.push('USE_INSTANCING_COLOR');
            if (mat.vertexColors && ga.color) { d.push('USE_COLOR'); if (ga.color.itemSize === 4) { colorType = 'vec4'; d.push('USE_COLOR_ALPHA'); } }
            if (mat.map && ga.uv) d.push('USE_UV', 'USE_MAP');
            if (lit && mat.side === 2) d.push('DOUBLE_SIDED');
            if (lit && mi.spec === 1 && env.nSun > 0) d.push('SPEC_VERTEX'); if (lit && mi.spec === 2 && env.nSun > 0) d.push('SPEC_PIXEL');
            if (lit && it.recv && env.shadow) { d.push('SHADOW'); if (env.soft) d.push('SHADOW_SOFT'); }
            if (env.fog && mat.fog !== false) d.push(env.fog === 2 ? 'FOG_EXP2' : 'FOG_LINEAR', 'FOG');
            if (env.tone && mat.toneMapped !== false) d.push('TONEMAP_ACES');
            if (env.srgb) d.push('SRGB_OUT');
            if (mat.alphaTest > 0) d.push('ALPHATEST');
            // nothing needs doing per pixel: light, tone-map and encode at the vertex, the fragment shader only fogs
            if (!(lit && it.recv && env.shadow) && !(mat.map && ga.uv) && !(mi.hook && (mi.hook.fAlbedo || mi.hook.fFinal)) && !(lit && mi.spec === 2 && env.nSun > 0)) d.push('VFINAL');
            const f = { defines: d, colorType, numSun: lit ? env.nSun : 0, numPL: lit ? env.nPL : 0, hook: mi.hook };
            P = getProgram(E, 'L' + d.join(',') + '|' + f.numSun + f.numPL + '|' + mi.hookId, () => litVertex(f), () => litFragment(f));
        }
        if (P.loc === undefined) { const u = P.u, L = n => u[n] ? u[n].loc : null; P.loc = { model: L('modelMatrix'), mat: L('uMat'), uvT: L('uUvT'), mv: L('modelViewMatrix'), proj: L('projectionMatrix'), view: L('viewMatrix'), normal: L('normalMatrix'), camPos: L('cameraPosition'), ortho: L('isOrthographic'), depthVP: L('uDepthVP') }; }
        if (P.mm === undefined) { P.mm = new Float32Array(16); P.mmSet = false; }
        it.prog = P;
        if (it.vao === null || it.layout !== P.layout) buildVAO(E, it);
    } catch (e) { it.prog = null; if (!E.failed) E.failed = String(e && e.message || e); warnOnce(String(e && e.message || e)); }
}
function prepItem(E, o) {
    const mat = o.material; let it = o.__hg;
    if (it === undefined || it.gen !== E.gen || it.geo !== o.geometry || it.mat !== mat || it.matV !== mat.version || it.iCol !== (o.instanceColor || null) || it.iMat !== (o.instanceMatrix || null) || it.recv !== (o.receiveShadow === true) || it.pos !== o.geometry.attributes.position) it = newItem(E, o);
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
        if (o.isMesh === true || o.isLineSegments === true || o.isPoints === true) {
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
        } else if (o.isLight === true) {
            if (o.isHemisphereLight === true) { if (Lt.hemi === null) Lt.hemi = o; }
            else if (o.isAmbientLight === true) { const k = o.intensity / Math.PI; Lt.ar += o.color.r * k; Lt.ag += o.color.g * k; Lt.ab += o.color.b * k; }
            else if (o.isDirectionalLight === true) { if (Lt.sun0 === null) Lt.sun0 = o; else if (Lt.sun1 === null) { if (o.castShadow === true && Lt.sun0.castShadow !== true) { Lt.sun1 = Lt.sun0; Lt.sun0 = o; } else Lt.sun1 = o; } Lt.nSun = Lt.sun1 ? 2 : 1; }
            else if (o.isPointLight === true) { if (Lt.nPL < 4) Lt.pl[Lt.nPL++] = o; }
        } else if (o.isSprite === true || o.isLine === true) warnOnce((o.type || 'object') + ' objects are not drawn by HG3D yet');
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
    const d = E.uboData, Lt = E.lights, env = E.env, view = camera.matrixWorldInverse.elements, cw = camera.matrixWorld.elements;
    for (let i = 0; i < 16; i++) { d[U_VIEWPROJ + i] = TMP.vp[i]; d[U_VIEW + i] = view[i]; }
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
    for (let i = 0; i < 4; i++) {
        const p = i < Lt.nPL ? Lt.pl[i] : null, o = i * 4;
        if (p !== null) { const e = p.matrixWorld.elements, k = p.intensity / Math.PI; d[U_PLPOS + o] = e[12]; d[U_PLPOS + o + 1] = e[13]; d[U_PLPOS + o + 2] = e[14]; d[U_PLPOS + o + 3] = p.distance || 0; d[U_PLCOL + o] = p.color.r * k; d[U_PLCOL + o + 1] = p.color.g * k; d[U_PLCOL + o + 2] = p.color.b * k; d[U_PLCOL + o + 3] = p.decay === undefined ? 2 : p.decay; }
        else { d[U_PLPOS + o + 3] = 0; d[U_PLCOL + o] = d[U_PLCOL + o + 1] = d[U_PLCOL + o + 2] = 0; d[U_PLCOL + o + 3] = 2; }
    }
    const fog = scene.fog;
    if (env.fog) {
        const c = fog.color, s = env.srgb;
        d[U_FOGCOLOR] = s ? linToSrgb(c.r) : c.r; d[U_FOGCOLOR + 1] = s ? linToSrgb(c.g) : c.g; d[U_FOGCOLOR + 2] = s ? linToSrgb(c.b) : c.b;
        d[U_FOGPARAMS] = fog.near || 0; d[U_FOGPARAMS + 1] = 1 / Math.max(1e-6, (fog.far || 1) - (fog.near || 0)); d[U_FOGPARAMS + 2] = fog.density || 0;
    }
    d[U_OUT] = R.toneMappingExposure;
}

// ---------- the sun's shadow map ----------
function shadowPass(E, R) {
    const gl = E.gl, Lt = E.lights, sun = Lt.sun0, L = E.L, d = E.uboData, sh = sun.shadow, cam = sh.camera;
    const size = (sh.mapSize && (sh.mapSize.width || sh.mapSize.x)) || 1024, T = shadowTarget(E, size);
    const e = sun.matrixWorld.elements, t = sun.target ? sun.target.matrixWorld.elements : TMP.id16;
    M4.lookAt(TMP.lv, e[12], e[13], e[14], t ? t[12] : 0, t ? t[13] : 0, t ? t[14] : 0);
    M4.ortho(TMP.lp, cam.left, cam.right, cam.top, cam.bottom, cam.near, cam.far);
    M4.mul(TMP.lvp, TMP.lp, TMP.lv); M4.mul(TMP.m, TMP.bias, TMP.lvp);
    for (let i = 0; i < 16; i++) d[U_SHADOWMAT + i] = TMP.m[i];
    d[U_SHADOWPARAMS] = sh.bias || 0; d[U_SHADOWPARAMS + 1] = sh.normalBias || 0; d[U_SHADOWPARAMS + 2] = 1 / size; d[U_SHADOWPARAMS + 3] = 1;
    const SM = R.shadowMap; if (T.drawn && SM.autoUpdate === false && SM.needsUpdate !== true) return; SM.needsUpdate = false; T.drawn = true;
    if (E.S.tex[1] === T.tex) bindTex(E, 1, gl.TEXTURE_2D, null);       // never sample the map while drawing into it
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.fbo); gl.viewport(0, 0, size, size);
    setDepth(E, 1, 1, gl.LEQUAL); setBlend(E, 0); setPoly(E, 0, 0, 0); gl.clear(gl.DEPTH_BUFFER_BIT);
    for (let i = 0; i < L.nc; i++) {
        const o = L.casters[i], it = prepItem(E, o); L.casters[i] = null; if (it === null || it.mi.kind === 2 || it.mode !== 4) continue;
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
    const gl = E.gl, P = it.prog, mi = it.mi, mat = it.mat, o = it.o, loc = P.loc;
    useProgram(E, P);
    setBlend(E, mi.blend); setDepth(E, mi.depthTest, skyPass ? 0 : mi.depthWrite, skyPass ? gl.LEQUAL : mi.depthFunc); setCull(E, mi.cull); setPoly(E, mi.poly, mi.pf, mi.pu);
    const me = o.matrixWorld.elements, m = TMP.m, pm = P.mm; let same = P.mmSet; for (let k = 0; k < 16; k++) { const v = me[k]; m[k] = v; if (pm[k] !== v) { same = false; pm[k] = v; } }
    if (!same) { P.mmSet = true; gl.uniformMatrix4fv(loc.model, false, pm); }
    if (mi.kind === 2) {
        if (P.frame !== E.frame) { P.frame = E.frame; gl.uniformMatrix4fv(loc.proj, false, camera.projectionMatrix.elements); gl.uniformMatrix4fv(loc.view, false, camera.matrixWorldInverse.elements); const cw = camera.matrixWorld.elements; gl.uniform3f(loc.camPos, cw[12], cw[13], cw[14]); gl.uniform1i(loc.ortho, camera.isOrthographicCamera ? 1 : 0); }
        if (loc.mv !== null || loc.normal !== null) { M4.mul(TMP.mv, camera.matrixWorldInverse.elements, m); gl.uniformMatrix4fv(loc.mv, false, TMP.mv); if (loc.normal !== null) gl.uniformMatrix3fv(loc.normal, false, M4.normal3(TMP.n3, TMP.mv)); }
        if (mat.uniforms) setUserUniforms(E, P, mat.uniforms);
    } else if (P.mat !== mat || P.matFrame !== E.frame) {
        P.mat = mat; P.matFrame = E.frame;
        const u = TMP.mat, c = mat.color, em = mat.emissive, ek = mat.emissiveIntensity === undefined ? 1 : mat.emissiveIntensity, sp = mat.isMeshPhongMaterial ? mat.specular : null;
        if (c) { u[0] = c.r; u[1] = c.g; u[2] = c.b; } else { u[0] = u[1] = u[2] = 1; } u[3] = mat.opacity === undefined ? 1 : mat.opacity;
        if (em) { u[4] = em.r * ek; u[5] = em.g * ek; u[6] = em.b * ek; } else { u[4] = u[5] = u[6] = 0; } u[7] = mat.alphaTest || 0;
        u[8] = mi.shin; u[9] = mi.specScale; u[10] = mi.metal; u[11] = 0;
        if (sp) { u[12] = sp.r; u[13] = sp.g; u[14] = sp.b; } else { u[12] = u[13] = u[14] = 0.04; }
        gl.uniform4fv(loc.mat, u);          // one call for the whole material
        const map = mat.map;
        if (map && P.u.map) { bindTex(E, 0, gl.TEXTURE_2D, textureFor(E, map)); if (loc.uvT !== null) { if (map.matrixAutoUpdate === true && map.updateMatrix) map.updateMatrix(); gl.uniformMatrix3fv(loc.uvT, false, map.matrix ? map.matrix.elements : TMP.id3); } }
        if (mi.hook !== null && mi.hook.uniforms) setUserUniforms(E, P, mi.hook.uniforms);
    }
    drawGeometry(E, it, true);
}
function sortOpaque(a, n) { for (let i = 1; i < n; i++) { const x = a[i], k = x.key; let j = i - 1; while (j >= 0 && a[j].key > k) { a[j + 1] = a[j]; j--; } a[j + 1] = x; } }
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
    env.shadow = (SM.enabled === true && Lt.sun0 !== null && Lt.sun0.castShadow === true && Lt.sun0.shadow) ? 1 : 0; env.soft = SM.type === 2 ? 1 : 0;
    env.tone = R.toneMapping === 4 ? 1 : 0; env.srgb = R.outputColorSpace === 'srgb' ? 1 : 0;
    E.envCode = env.fog | env.nSun << 2 | env.nPL << 4 | env.shadow << 7 | env.soft << 8 | env.tone << 9 | env.srgb << 10;
    fillFrame(E, scene, camera, R);
    if (env.shadow) shadowPass(E, R); else { E.uboData[U_SHADOWPARAMS + 3] = 0; L.nc = 0; }
    gl.bindBuffer(gl.UNIFORM_BUFFER, E.ubo); gl.bufferSubData(gl.UNIFORM_BUFFER, 0, E.uboData);
    // pass 2: items, sorted into the three lists
    const view = camera.matrixWorldInverse.elements; L.no = L.nt = L.ns = 0;
    for (let i = 0; i < L.n; i++) {
        const o = L.objs[i]; L.objs[i] = null; const it = prepItem(E, o); if (it === null) continue;
        const mi = it.mi; refreshState(mi, it.mat); it.ro = o.renderOrder || 0;
        if (mi.sky) L.sky[L.ns++] = it;
        else if (mi.transparent) { const e = o.matrixWorld.elements; it.z = -(view[2] * e[12] + view[6] * e[13] + view[10] * e[14] + view[14]); L.transp[L.nt++] = it; }
        else { it.key = (it.ro + 512) * 4194304 + it.prog.id * 2048 + ((it.mat.id || 0) & 2047); L.opaque[L.no++] = it; }
    }
    sortOpaque(L.opaque, L.no); sortTransparent(L.transp, L.nt);
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight; gl.viewport(0, 0, w, h);
    if (R.autoClear !== false) R.clear();
    if (env.shadow && E.shadow) bindTex(E, 1, gl.TEXTURE_2D, E.shadow.tex);
    for (let i = 0; i < L.no; i++) { drawItem(E, L.opaque[i], camera, false); L.opaque[i] = null; }
    for (let i = 0; i < L.ns; i++) { drawItem(E, L.sky[i], camera, true); L.sky[i] = null; }
    for (let i = 0; i < L.nt; i++) { drawItem(E, L.transp[i], camera, false); L.transp[i] = null; }
}

// ---- 50-facade.js ----
// ============================================================
// The renderer object a game holds. It answers to the part of THREE.WebGLRenderer the games use
// (render, setSize, setPixelRatio, shadowMap, info, ...), so a game switches engines by changing one
// line: the place where it creates its renderer. Returns null when WebGL2 is not available.
// ============================================================
function createRenderer(opts) {
    opts = opts || {};
    const canvas = opts.canvas || document.createElement('canvas');
    const E = createEngine(canvas, { antialias: !!opts.antialias, alpha: !!opts.alpha, stencil: !!opts.stencil, depth: opts.depth !== false, powerPreference: opts.powerPreference || 'high-performance', preserveDrawingBuffer: !!opts.preserveDrawingBuffer });
    if (!E) return null;
    E.L = newLists(); E.lights = newLights(); E.env = { fog: 0, nSun: 0, nPL: 0, shadow: 0, soft: 0, tone: 0, srgb: 0 }; E.envCode = 0; E.frame = 0; E.time = 0;
    const gl = E.gl, clear = { r: 0, g: 0, b: 0, a: 1 };
    let pixelRatio = 1, cssW = canvas.width, cssH = canvas.height;
    const R = {
        isHG3D: true, engine: E, domElement: canvas,
        autoClear: true, sortObjects: true, outputColorSpace: 'srgb', toneMapping: 0, toneMappingExposure: 1,
        shadowMap: { enabled: false, type: 1, autoUpdate: true, needsUpdate: false },
        capabilities: { isWebGL2: true, getMaxAnisotropy: () => E.maxAniso, maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE), precision: 'highp' },
        info: {
            autoReset: true, render: { calls: 0, triangles: 0, frame: 0, lines: 0, points: 0 }, memory: { geometries: 0, textures: 0 }, programs: [],
            reset() { E.stats.calls = 0; E.stats.tris = 0; this.render.calls = 0; this.render.triangles = 0; }
        },
        getContext() { return gl; },
        getPixelRatio() { return pixelRatio; },
        setPixelRatio(v) { if (v === undefined || v === pixelRatio) return; pixelRatio = v; this.setSize(cssW, cssH, false); },
        getSize(target) { if (target && target.set) return target.set(cssW, cssH); return { width: cssW, height: cssH }; },
        getDrawingBufferSize(target) { if (target && target.set) return target.set(canvas.width, canvas.height); return { width: canvas.width, height: canvas.height }; },
        setSize(w, h, updateStyle) {
            cssW = w; cssH = h; const pw = Math.max(1, Math.floor(w * pixelRatio)), ph = Math.max(1, Math.floor(h * pixelRatio));
            if (canvas.width !== pw) canvas.width = pw; if (canvas.height !== ph) canvas.height = ph;
            if (updateStyle !== false && canvas.style) { canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; }
        },
        setClearColor(c, a) { if (c && c.r !== undefined) { clear.r = c.r; clear.g = c.g; clear.b = c.b; } else if (typeof c === 'number') { clear.r = (c >> 16 & 255) / 255; clear.g = (c >> 8 & 255) / 255; clear.b = (c & 255) / 255; } if (a !== undefined) clear.a = a; },
        getClearColor(target) { if (target && target.setRGB) return target.setRGB(clear.r, clear.g, clear.b); return clear; },
        getClearAlpha() { return clear.a; }, setClearAlpha(a) { clear.a = a; },
        clear(color, depth) {
            let bits = 0; if (color !== false) { setColorMask(E, true); gl.clearColor(clear.r, clear.g, clear.b, clear.a); bits |= gl.COLOR_BUFFER_BIT; }
            if (depth !== false) { setDepth(E, 1, 1, gl.LEQUAL); bits |= gl.DEPTH_BUFFER_BIT; }
            if (bits) gl.clear(bits);
        },
        clearDepth() { this.clear(false, true); }, clearColor() { this.clear(true, false); },
        setRenderTarget() { }, getRenderTarget() { return null; }, setViewport() { }, setScissorTest() { },
        // build every program and vertex array a scene needs now, so nothing compiles in the middle of play
        compile(scene, camera) {
            if (!scene || !camera || E.lost) return;
            const hidden = [];
            const walk = o => { if (o.visible === false) { hidden.push(o); o.visible = true; } const ch = o.children; if (ch) for (let i = 0; i < ch.length; i++) walk(ch[i]); };
            walk(scene);
            const fc = [], cull = o => { if (o.frustumCulled !== false && (o.isMesh || o.isPoints || o.isLineSegments)) { fc.push(o); o.frustumCulled = false; } const ch = o.children; if (ch) for (let i = 0; i < ch.length; i++) cull(ch[i]); };
            cull(scene);
            try { renderScene(E, R, scene, camera); } finally { for (const o of hidden) o.visible = false; for (const o of fc) o.frustumCulled = true; }
        },
        render(scene, camera) {
            if (this.info.autoReset) this.info.reset();
            renderScene(E, this, scene, camera);
            const i = this.info; i.render.calls = E.stats.calls; i.render.triangles = E.stats.tris; i.render.frame = E.frame; i.memory.geometries = E.stats.geometries; i.memory.textures = E.stats.textures;
            if (i.programs.length !== E.stats.programs) i.programs.length = E.stats.programs;
        },
        get failed() { return E.failed; },
        dispose() { const l = gl.getExtension('WEBGL_lose_context'); if (l) l.loseContext(); },
        forceContextLoss() { const l = gl.getExtension('WEBGL_lose_context'); if (l) l.loseContext(); }
    };
    return R;
}

// Which renderer should this game use? '?r=three' / '?r=hg' in the address decides for one visit; a failed
// start is remembered per game (so the next visit goes straight to three.js); otherwise HG3D when it can run.
function pick(game, fallbackDefault) {
    let q = null; try { const m = /[?&]r=(three|hg)\b/.exec(location.search); if (m) q = m[1]; } catch (e) { }
    if (q === 'three') return 'three';
    if (typeof WebGL2RenderingContext === 'undefined') return 'three';
    if (q === 'hg') return 'hg';
    try { if (localStorage.getItem('hgq:r:' + game) === 'three') return 'three'; } catch (e) { }
    return fallbackDefault || 'hg';
}
// HG3D could not draw this game here: remember it and start again on three.js (once)
function bail(game, why) {
    try { console.warn('[HG3D] falling back to three.js: ' + why); localStorage.setItem('hgq:r:' + game, 'three'); if (!/[?&]r=hg\b/.test(location.search) && !sessionStorage.getItem('hgq:bailed')) { sessionStorage.setItem('hgq:bailed', '1'); location.reload(); } } catch (e) { }
}
return { VERSION, createRenderer, pick, bail, M4 };
})();
