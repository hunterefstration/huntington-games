// ============================================================
// Native scenes: everything a game needs to draw with HG3D and no three.js at all (no 1.2 MB download, no
// big library to parse on a slow Chromebook). The renderer only reads plain fields, so these are plain
// objects: node / mesh / instanced (matrixWorld is a Float32Array you fill with M4.compose), lights, a
// camera with projection + view matrices, a few geometry builders.
//   const r = HG3D.createRenderer({ canvas }), scene = HG3D.node(), cam = HG3D.camera(60, 16 / 9, 0.1, 500);
//   scene.add(HG3D.light.hemi(0xdff3ff, 0x9a7fb0, 1.2), HG3D.light.sun(0xfff2d9, 2, [30, 60, 20]));
//   const box = HG3D.mesh(HG3D.geo.box(2, 2, 2), HG3D.material({ color: 0xff5fa2 })); scene.add(box);
//   HG3D.M4.compose(box.matrixWorld.elements, x, y, z, 0, 0, 0, 1, 1, 1, 1);  cam.lookFrom(0, 6, 14, 0, 0, 0);  r.render(scene, cam);
// Colours are given as 0xRRGGBB (sRGB) and stored linear, like three.js does.
// ============================================================
const sToL = c => c < 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
function color(hex) { return { r: sToL((hex >> 16 & 255) / 255), g: sToL((hex >> 8 & 255) / 255), b: sToL((hex & 255) / 255), isColor: true }; }
function attr(array, itemSize, instanced) {
    const a = { array, itemSize, count: array.length / itemSize, version: 1, normalized: false, usage: instanced ? 35048 : 35044, isInstancedBufferAttribute: !!instanced, meshPerAttribute: 1 };
    Object.defineProperty(a, 'needsUpdate', { set(v) { if (v) a.version++; } });
    return a;
}
function geometry(attributes, index) {
    const g = { attributes: {}, index: null, drawRange: { start: 0, count: Infinity }, boundingSphere: null };
    for (const k in attributes) { const v = attributes[k]; g.attributes[k] = v.array ? v : attr(v, k === 'uv' ? 2 : 3); }
    if (index) g.index = index.array ? index : attr(index, 1);
    return g;
}
let NEXT_MAT = 1;
// material({ color, emissive, lit: true, map, vertexColors, transparent, opacity, side, roughness, metalness, fog, hg: {hooks} })
function material(o) {
    o = o || {}; const lit = o.lit !== false, pbr = lit && (o.roughness !== undefined || o.metalness !== undefined);
    const m = { id: NEXT_MAT++, version: 1, visible: true, isMeshBasicMaterial: !lit, isMeshLambertMaterial: lit && !pbr, isMeshStandardMaterial: pbr, type: lit ? 'lit' : 'unlit',
        color: color(o.color === undefined ? 0xffffff : o.color), emissive: color(o.emissive || 0), emissiveIntensity: 1, roughness: o.roughness === undefined ? 1 : o.roughness, metalness: o.metalness || 0,
        map: o.map || null, vertexColors: !!o.vertexColors, transparent: !!o.transparent, opacity: o.opacity === undefined ? 1 : o.opacity, alphaTest: o.alphaTest || 0, side: o.side || 0, blending: o.blending || 1,
        depthTest: o.depthTest !== false, depthWrite: o.depthWrite !== false, fog: o.fog !== false, toneMapped: o.toneMapped !== false, flatShading: !!o.flatShading, polygonOffset: false, userData: { hg: o.hg || null } };
    Object.defineProperty(m, 'needsUpdate', { set(v) { if (v) m.version++; } });
    return m;
}
// texture(canvasOrImage, { repeat: true, srgb: true }) or texture({ data, width, height }, {...})
function texture(image, o) { o = o || {}; const t = { image, version: 1, flipY: !image.data, colorSpace: o.srgb === false ? '' : 'srgb', wrapS: o.repeat ? 1000 : 1001, wrapT: o.repeat ? 1000 : 1001, magFilter: o.nearest ? 1003 : 1006, minFilter: o.nearest ? 1003 : 1008, generateMipmaps: !o.nearest, anisotropy: o.anisotropy || 1, format: o.format || 1023, type: o.type || 1009, isTexture: true }; Object.defineProperty(t, 'needsUpdate', { set(v) { if (v) t.version++; } }); return t; }
function node() {
    const n = { visible: true, children: [], parent: null, matrixWorld: { elements: M4.ident(new Float32Array(16)) }, renderOrder: 0, frustumCulled: true, castShadow: false, receiveShadow: false };
    n.add = function () { for (let i = 0; i < arguments.length; i++) { const c = arguments[i]; if (c.parent) c.parent.remove(c); c.parent = n; n.children.push(c); } return n; };
    n.remove = function (c) { const i = n.children.indexOf(c); if (i >= 0) { n.children.splice(i, 1); c.parent = null; } return n; };
    return n;
}
function mesh(geo, mat) { const n = node(); n.isMesh = true; n.geometry = geo; n.material = mat; return n; }
// instanced(geo, mat, max, { colors: true }): fill instanceMatrix.array (16 floats each), set count, then instanceMatrix.needsUpdate = true
function instanced(geo, mat, max, o) {
    const n = mesh(geo, mat); n.isInstancedMesh = true; n.count = 0; n.frustumCulled = false; n.boundingSphere = null;
    n.instanceMatrix = attr(new Float32Array(max * 16), 16, true); n.instanceColor = o && o.colors ? attr(new Float32Array(max * 3).fill(1), 3, true) : null;
    return n;
}
const light = {
    hemi(sky, ground, intensity) { const n = node(); n.isLight = n.isHemisphereLight = true; n.color = color(sky); n.groundColor = color(ground); n.intensity = intensity === undefined ? 1 : intensity; n.matrixWorld.elements[13] = 1; return n; },
    // sun(colour, intensity, [x, y, z] where it stands, { shadow: mapSize, size: half-width of the shadowed box, far })
    sun(col, intensity, pos, o) {
        const n = node(); n.isLight = n.isDirectionalLight = true; n.color = color(col); n.intensity = intensity === undefined ? 1 : intensity; n.target = node();
        n.matrixWorld.elements[12] = pos ? pos[0] : 0; n.matrixWorld.elements[13] = pos ? pos[1] : 1; n.matrixWorld.elements[14] = pos ? pos[2] : 0;
        const s = (o && o.size) || 40; n.castShadow = !!(o && o.shadow);
        n.shadow = { camera: { left: -s, right: s, top: s, bottom: -s, near: 0.5, far: (o && o.far) || 200 }, mapSize: { width: (o && o.shadow) || 1024, height: (o && o.shadow) || 1024 }, bias: -0.0008, normalBias: 0.03 };
        return n;
    },
    point(col, intensity, distance, decay) { const n = node(); n.isLight = n.isPointLight = true; n.color = color(col); n.intensity = intensity === undefined ? 1 : intensity; n.distance = distance || 0; n.decay = decay === undefined ? 2 : decay; return n; },
    ambient(col, intensity) { const n = node(); n.isLight = n.isAmbientLight = true; n.color = color(col); n.intensity = intensity === undefined ? 1 : intensity; return n; }
};
function camera(fovDeg, aspect, near, far) {
    const c = node(); c.isCamera = true; c.fov = fovDeg; c.aspect = aspect; c.near = near; c.far = far;
    c.projectionMatrix = { elements: new Float32Array(16) }; c.matrixWorldInverse = { elements: M4.ident(new Float32Array(16)) };
    c.updateProjection = () => { M4.perspective(c.projectionMatrix.elements, c.fov, c.aspect, c.near, c.far); return c; };
    c.lookFrom = (ex, ey, ez, tx, ty, tz) => { M4.lookAt(c.matrixWorldInverse.elements, ex, ey, ez, tx, ty, tz); M4.invert(c.matrixWorld.elements, c.matrixWorldInverse.elements); return c; };
    return c.updateProjection();
}
function fog(col, near, far) { return { isFog: true, color: color(col), near, far }; }
// ---- geometry builders (positions, normals, uvs, 16-bit indices) ----
const geo = {
    box(w, h, d) {
        const P = [], N = [], U = [], I = [], x = w / 2, y = h / 2, z = d / 2;
        const face = (nx, ny, nz, ux, uy, uz, vx, vy, vz) => { const b = P.length / 3; for (let j = 0; j < 4; j++) { const s = j === 0 || j === 3 ? -1 : 1, t = j < 2 ? -1 : 1; P.push((nx + ux * s + vx * t) * x, (ny + uy * s + vy * t) * y, (nz + uz * s + vz * t) * z); N.push(nx, ny, nz); U.push((s + 1) / 2, (t + 1) / 2); } I.push(b, b + 1, b + 2, b, b + 2, b + 3); };
        face(1, 0, 0, 0, 0, -1, 0, 1, 0); face(-1, 0, 0, 0, 0, 1, 0, 1, 0); face(0, 1, 0, 1, 0, 0, 0, 0, -1); face(0, -1, 0, 1, 0, 0, 0, 0, 1); face(0, 0, 1, 1, 0, 0, 0, 1, 0); face(0, 0, -1, -1, 0, 0, 0, 1, 0);
        return geometry({ position: new Float32Array(P), normal: new Float32Array(N), uv: new Float32Array(U) }, new Uint16Array(I));
    },
    plane(w, d, sx, sz) {       // flat on the ground (facing +Y)
        sx = sx || 1; sz = sz || 1; const P = [], N = [], U = [], I = [];
        for (let j = 0; j <= sz; j++) for (let i = 0; i <= sx; i++) { P.push((i / sx - 0.5) * w, 0, (j / sz - 0.5) * d); N.push(0, 1, 0); U.push(i / sx, 1 - j / sz); }
        for (let j = 0; j < sz; j++) for (let i = 0; i < sx; i++) { const a = j * (sx + 1) + i, b = a + sx + 1; I.push(a, b, a + 1, a + 1, b, b + 1); }
        return geometry({ position: new Float32Array(P), normal: new Float32Array(N), uv: new Float32Array(U) }, P.length / 3 > 65535 ? new Uint32Array(I) : new Uint16Array(I));
    },
    sphere(r, ws, hs) {
        ws = ws || 16; hs = hs || 12; const P = [], N = [], U = [], I = [];
        for (let j = 0; j <= hs; j++) { const v = j / hs, ph = v * Math.PI; for (let i = 0; i <= ws; i++) { const u = i / ws, th = u * Math.PI * 2, x = -Math.cos(th) * Math.sin(ph), y = Math.cos(ph), z = Math.sin(th) * Math.sin(ph); P.push(x * r, y * r, z * r); N.push(x, y, z); U.push(u, 1 - v); } }
        for (let j = 0; j < hs; j++) for (let i = 0; i < ws; i++) { const a = j * (ws + 1) + i, b = a + ws + 1; if (j !== 0) I.push(a, b, a + 1); if (j !== hs - 1) I.push(a + 1, b, b + 1); }
        return geometry({ position: new Float32Array(P), normal: new Float32Array(N), uv: new Float32Array(U) }, new Uint16Array(I));
    },
    cylinder(rTop, rBot, h, seg) {
        seg = seg || 16; const P = [], N = [], U = [], I = [], sl = (rBot - rTop) / h;
        for (let j = 0; j <= 1; j++) for (let i = 0; i <= seg; i++) { const th = i / seg * Math.PI * 2, s = Math.sin(th), c = Math.cos(th), r = j ? rBot : rTop, l = Math.hypot(1, sl); P.push(s * r, (0.5 - j) * h, c * r); N.push(s / l, sl / l, c / l); U.push(i / seg, 1 - j); }
        for (let i = 0; i < seg; i++) { const a = i, b = i + seg + 1; I.push(a, b, a + 1, a + 1, b, b + 1); }
        for (let cap = 0; cap < 2; cap++) { const r = cap ? rBot : rTop, y = (0.5 - cap) * h, ny = cap ? -1 : 1, c0 = P.length / 3; if (r <= 0) continue; P.push(0, y, 0); N.push(0, ny, 0); U.push(0.5, 0.5);
            for (let i = 0; i <= seg; i++) { const th = i / seg * Math.PI * 2; P.push(Math.sin(th) * r, y, Math.cos(th) * r); N.push(0, ny, 0); U.push(Math.sin(th) * 0.5 + 0.5, Math.cos(th) * 0.5 + 0.5); }
            for (let i = 0; i < seg; i++) { if (cap) I.push(c0, c0 + i + 2, c0 + i + 1); else I.push(c0, c0 + i + 1, c0 + i + 2); } }
        return geometry({ position: new Float32Array(P), normal: new Float32Array(N), uv: new Float32Array(U) }, new Uint16Array(I));
    },
    // merge([{ geo, matrix (Float32Array 16, optional), color: 0xRRGGBB (optional) }, ...]) -> one static geometry with vertex colours
    merge(parts) {
        let nv = 0, ni = 0; for (const p of parts) { nv += p.geo.attributes.position.count; ni += p.geo.index ? p.geo.index.count : p.geo.attributes.position.count; }
        const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), C = new Float32Array(nv * 3), I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni), n3 = new Float32Array(9); let vo = 0, io = 0;
        for (const p of parts) {
            const g = p.geo, ps = g.attributes.position.array, ns = g.attributes.normal.array, m = p.matrix, c = color(p.color === undefined ? 0xffffff : p.color), cnt = g.attributes.position.count; if (m) M4.normal3(n3, m);
            for (let i = 0; i < cnt; i++) {
                const x = ps[i * 3], y = ps[i * 3 + 1], z = ps[i * 3 + 2], a = ns[i * 3], b = ns[i * 3 + 1], d = ns[i * 3 + 2], o = (vo + i) * 3;
                if (m) { P[o] = m[0] * x + m[4] * y + m[8] * z + m[12]; P[o + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]; P[o + 2] = m[2] * x + m[6] * y + m[10] * z + m[14]; const nx = n3[0] * a + n3[3] * b + n3[6] * d, ny = n3[1] * a + n3[4] * b + n3[7] * d, nz = n3[2] * a + n3[5] * b + n3[8] * d, l = Math.hypot(nx, ny, nz) || 1; N[o] = nx / l; N[o + 1] = ny / l; N[o + 2] = nz / l; }
                else { P[o] = x; P[o + 1] = y; P[o + 2] = z; N[o] = a; N[o + 1] = b; N[o + 2] = d; }
                C[o] = c.r; C[o + 1] = c.g; C[o + 2] = c.b;
            }
            if (g.index) { const ix = g.index.array; for (let i = 0; i < ix.length; i++) I[io++] = ix[i] + vo; } else for (let i = 0; i < cnt; i++) I[io++] = vo + i;
            vo += cnt;
        }
        return geometry({ position: P, normal: N, color: C }, I);
    }
};
