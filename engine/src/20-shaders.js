// ============================================================
// Shaders. Lighting is worked out per VERTEX (hemisphere + up to two suns); where nothing needs doing per
// pixel the finished, tone-mapped, sRGB colour leaves the vertex shader and the fragment shader only fogs.
// Otherwise the fragment shader multiplies, takes at most one texture sample and one or four hardware-filtered
// shadow taps. Programs are a few hundred bytes of GLSL each (three.js' are 30-60 KB), so they compile fast.
// ============================================================
// the per-frame uniform block: written once per render() call, shared by every engine program
const UBO_GLSL = `layout(std140) uniform HGFrame {
 mat4 uViewProj; mat4 uView; mat4 uShadowMat; mat4 uProj;
 vec4 uCamPos; vec4 uHemiSky; vec4 uHemiGround; vec4 uHemiDir; vec4 uAmbient;
 vec4 uSunDir[2]; vec4 uSunCol[2];
 vec4 uFogColor; vec4 uFogParams; vec4 uShadowParams; vec4 uOut;
 vec4 uPLPos[8]; vec4 uPLCol[8];
};
`;
const U_VIEWPROJ = 0, U_VIEW = 16, U_SHADOWMAT = 32, U_PROJ = 48, U_CAMPOS = 64, U_HEMISKY = 68, U_HEMIGROUND = 72, U_HEMIDIR = 76, U_AMBIENT = 80, U_SUNDIR = 84, U_SUNCOL = 92,
    U_FOGCOLOR = 100, U_FOGPARAMS = 104, U_SHADOWPARAMS = 108, U_OUT = 112, U_PLPOS = 116, U_PLCOL = 148, U_FLOATS = 180, MAX_PL = 8;
const BUILTIN_ATTR = { position: 0, normal: 1, uv: 2, color: 3, instanceMatrix: 4, instanceColor: 8 };
const BUILTIN_UNI = { modelMatrix: 1, modelViewMatrix: 1, projectionMatrix: 1, viewMatrix: 1, normalMatrix: 1, cameraPosition: 1, isOrthographic: 1, uMat: 1, uUvT: 1, map: 1, uShadowMap: 1, uDepthVP: 1 };
const MAT_GLSL = `uniform vec4 uMat[4];
#define uDiffuse uMat[0]
#define uEmissive uMat[1].rgb
#define uAlphaTest uMat[1].a
#define uSpec uMat[2]
#define uSpecCol uMat[3].rgb
`;
const HEAD_GLSL = `#define texture2D texture
#ifdef FLAT
#define HGV flat
#else
#define HGV
#endif
`;
// point lights (three.js' physically based falloff): used per vertex, or per pixel when a light is in the scene
const PL_GLSL = `
vec3 hgPoint(vec3 N, vec3 wp){
 vec3 acc = vec3(0.0);
#if NUM_PL > 0
 for (int i = 0; i < NUM_PL; i++) {
  vec3 L = uPLPos[i].xyz - wp; float d = max(length(L), 0.0001); L /= d;
  float att = 1.0 / max(pow(d, uPLCol[i].w), 0.01);
  if (uPLPos[i].w > 0.0) { float q = d / uPLPos[i].w; q *= q; q *= q; float s = clamp(1.0 - q, 0.0, 1.0); att *= s * s; }
  acc += uPLCol[i].rgb * (att * max(dot(N, L), 0.0));
 }
#endif
 return acc;
}
`;
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
const defs = f => f.defines.map(d => '#define ' + d).join('\n');

// f: { defines: [...], colorType: 'vec3'|'vec4', numSun, numPL, hook }
// hook (material.userData.hg): { vDecl, vPos, vAlbedo, vMain, fDecl, fAlbedo, fFinal, uniforms, customMap, vertexLights, sky }
//   vAlbedo changes the base colour "alb" in the VERTEX shader (cheap: the fast vertex-finished path stays on);
//   fAlbedo / fFinal change "alb" / the lit colour "c" per pixel
function litVertex(f) {
    const h = f.hook || {};
    return `#version 300 es
precision highp float; precision highp int;
${defs(f)}
#define NUM_SUN ${f.numSun}
#define NUM_PL ${f.numPL}
${HEAD_GLSL}${UBO_GLSL}
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
${MAT_GLSL}
HGV out vec3 vAlb; out float vDepth;
#ifdef VFINAL
${ENCODE_GLSL}
#ifdef DOUBLE_SIDED
HGV out vec3 vBack;
#endif
#endif
#ifdef USE_COLOR_ALPHA
out float vAlpha;
#endif
#ifndef UNLIT
HGV out vec3 vLa; HGV out vec3 vLs; HGV out vec3 vEm;
#ifdef DOUBLE_SIDED
HGV out vec3 vLaB; HGV out vec3 vLsB;
#endif
#ifdef SPEC_VERTEX
HGV out vec3 vSp;
#endif
#ifdef NEED_NW
HGV out vec3 vN; out vec3 vWp;
#endif
#ifdef SPEC_PIXEL
HGV out vec3 vF;
#endif
#ifdef SHADOW
out vec3 vSh;
#endif
${PL_GLSL}
vec3 hgAmbient(vec3 N, vec3 wp){
 vec3 la = mix(uHemiGround.rgb, uHemiSky.rgb, dot(N, uHemiDir.xyz) * 0.5 + 0.5) + uAmbient.rgb;
#if NUM_SUN > 1
 la += uSunCol[1].rgb * max(dot(N, uSunDir[1].xyz), 0.0);
#endif
#ifdef VERTEX_PL
 la += hgPoint(N, wp);
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
${h.vAlbedo || ''}
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
#ifdef NEED_NW
 vN = N; vWp = wp;
#endif
#ifdef SPEC_PIXEL
 vF = F;
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
${defs(f)}
#define NUM_SUN ${f.numSun}
#define NUM_PL ${f.numPL}
${HEAD_GLSL}${UBO_GLSL}
${MAT_GLSL}
#ifdef USE_MAP
in vec2 vUv; uniform sampler2D map;
#endif
HGV in vec3 vAlb; in float vDepth;
#ifdef USE_COLOR_ALPHA
in float vAlpha;
#endif
#if defined(VFINAL) && defined(DOUBLE_SIDED)
HGV in vec3 vBack;
#endif
#if !defined(UNLIT) && !defined(VFINAL)
HGV in vec3 vLa; HGV in vec3 vLs; HGV in vec3 vEm;
#ifdef DOUBLE_SIDED
HGV in vec3 vLaB; HGV in vec3 vLsB;
#endif
#ifdef SPEC_VERTEX
HGV in vec3 vSp;
#endif
#ifdef NEED_NW
HGV in vec3 vN; in vec3 vWp;
#endif
#ifdef SPEC_PIXEL
HGV in vec3 vF;
#endif
#ifdef SHADOW
in vec3 vSh; uniform sampler2DShadow uShadowMap;
#endif
#ifdef PIXEL_PL
${PL_GLSL}
#endif
#endif
out vec4 fragColor;
${ENCODE_GLSL}
${h.fDecl || ''}
void main(){
 vec3 alb = vAlb; float alpha = uDiffuse.a;
#if defined(USE_COLOR_ALPHA) && !defined(CUSTOM_MAP)
 alpha *= vAlpha;
#endif
#ifdef USE_MAP
 vec4 tx = texture(map, vUv);
#ifndef CUSTOM_MAP
 alb *= tx.rgb; alpha *= tx.a;
#endif
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
#ifdef PIXEL_PL
#ifdef DOUBLE_SIDED
 la += hgPoint(gl_FrontFacing ? normalize(vN) : -normalize(vN), vWp);
#else
 la += hgPoint(normalize(vN), vWp);
#endif
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
 fragColor = vec4(c, max(alpha, uMat[3].a));     // uMat[3].a is 1 for an opaque material: its pixels stay solid whatever its texture's alpha
}`;
}

// ---- point clouds (PointsMaterial) and camera-facing sprites (SpriteMaterial) ----
function pointsVertex(f) {
    return `#version 300 es
precision highp float; precision highp int;
${defs(f)}
${UBO_GLSL}
layout(location=0) in vec3 position;
#ifdef USE_COLOR
layout(location=3) in vec3 color;
#endif
uniform mat4 modelMatrix; uniform vec4 uMat[4];
out vec3 vAlb; out float vDepth;
void main(){
 vec4 wp4 = modelMatrix * vec4(position, 1.0); vec4 mv = uView * wp4; vDepth = -mv.z; gl_Position = uViewProj * wp4;
 gl_PointSize = uMat[1].y > 0.0 ? uMat[1].x * (uMat[1].y / max(-mv.z, 0.0001)) : uMat[1].x;
 vAlb = uMat[0].rgb;
#ifdef USE_COLOR
 vAlb *= color;
#endif
}`;
}
function spriteVertex(f) {
    return `#version 300 es
precision highp float; precision highp int;
${defs(f)}
${UBO_GLSL}
layout(location=0) in vec3 position; layout(location=2) in vec2 uv;
uniform mat4 modelMatrix; uniform vec4 uMat[4]; uniform mat3 uUvT;
out vec3 vAlb; out float vDepth; out vec2 vUv;
void main(){
 vUv = (uUvT * vec3(uv, 1.0)).xy;
 vec4 mv = uView * (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0));
 vec2 sc = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
 if (uMat[1].w < 0.5) sc *= -mv.z;
 vec2 al = (position.xy - (uMat[1].xy - vec2(0.5))) * sc; float sn = sin(uMat[1].z), cs = cos(uMat[1].z);
 mv.xy += vec2(cs * al.x - sn * al.y, sn * al.x + cs * al.y);
 vDepth = -mv.z; gl_Position = uProj * mv; vAlb = uMat[0].rgb;
}`;
}
function flatFragment(f, points) {
    return `#version 300 es
precision highp float; precision highp int;
${defs(f)}
${UBO_GLSL}
uniform vec4 uMat[4];
in vec3 vAlb; in float vDepth;
#ifdef USE_MAP
uniform sampler2D map;
${points ? '' : 'in vec2 vUv;'}
#endif
out vec4 fragColor;
${ENCODE_GLSL}
void main(){
 vec3 c = vAlb; float alpha = uMat[0].a;
#ifdef USE_MAP
 vec4 tx = texture(map, ${points ? 'vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y)' : 'vUv'}); c *= tx.rgb; alpha *= tx.a;
#endif
#ifdef ALPHATEST
 if (alpha < uMat[2].x) discard;
#endif
 c = hgEncode(c);
#ifdef FOG
 c = mix(c, uFogColor.rgb, hgFog(vDepth));
#endif
 fragColor = vec4(c, max(alpha, uMat[3].a));     // uMat[3].a is 1 for an opaque material: its pixels stay solid whatever its texture's alpha
}`;
}
// a texture as the scene background: one screen-covering triangle, no vertex buffers
const BG_VS = `#version 300 es
out vec2 vUv;
void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); vUv = p; gl_Position = vec4(p * 2.0 - 1.0, 1.0, 1.0); }`;
const bgFragment = (tone, srgb) => `#version 300 es
precision highp float; precision highp int;
${tone ? '#define TONEMAP_ACES' : ''}
${srgb ? '#define SRGB_OUT' : ''}
${UBO_GLSL}
uniform sampler2D map; in vec2 vUv; out vec4 fragColor;
${ENCODE_GLSL}
void main(){ fragColor = vec4(hgEncode(texture(map, vUv).rgb), 1.0); }`;
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
