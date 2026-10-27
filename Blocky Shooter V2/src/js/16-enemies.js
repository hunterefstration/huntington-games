// ==========================================
// 5. ENEMIES
// Body parts are merged, vertex-coloured meshes built ONCE per enemy type and shared,
// so each enemy is ~7 draw calls instead of ~20.
// ==========================================


const enemyKits = {};
// glowing parts + a rim light (sky-colored edge) so enemies pop off the background, especially at night
function enemyGlowShader(sh) {
    Object.assign(sh.uniforms, { uRimE: LIGHT_U.uRimE, uCool: LIGHT_U.uCool });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vGlow;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGlow;\nuniform vec3 uRimE; uniform vec3 uCool;')
        .replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.indirectDiffuse *= uCool;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor * vGlow * 1.6;\nfloat rimE = 1.0 - abs(dot(normal, normalize(vViewPosition)));\ntotalEmissiveRadiance += uRimE * rimE * rimE * rimE * (1.0 - vGlow);');
}
const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
const extraMats = {};
function darken(c, k) { return new THREE.Color(c).multiplyScalar(k).getHex(); }
// glowList parts are merged into the same mesh and flagged to self-illuminate (fewer draw calls)
function partsGeo(list, s, glowList = []) {
    if (!list.length && !glowList.length) return null;
    const all = list.map(p => [p, 0]).concat(glowList.map(p => [p, 1]));
    const geos = all.map(([[w, h, d, x, y, z, c, rx = 0, ry = 0, rz = 0], glow]) => {
        const g = new THREE.BoxGeometry(w * s, h * s, d * s);
        if (rx || ry || rz) g.applyMatrix4(_m4.makeRotationFromEuler(_e.set(rx, ry, rz)));
        g.translate(x * s, y * s, z * s);
        g.deleteAttribute('uv');
        _col.setHex(c);
        const n = g.attributes.position.count, arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { arr[i * 3] = _col.r; arr[i * 3 + 1] = _col.g; arr[i * 3 + 2] = _col.b; }
        g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
        g.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(n).fill(glow), 1));
        return g;
    });
    const m = mergeGeometries(geos);
    geos.forEach(g => g.dispose());
    m.computeBoundingSphere();
    return m;
}


// Every enemy is a zombie. The type colour is its (torn, grimy) clothing, so each type still reads at a glance;
// skin, wounds and a signature feature per type are baked into the same merged meshes (no extra draw calls).
const ZLOOK = {
    grunt:    { skin: 0x7f9c6b, pants: 0x3b4a6b, hair: 0x2a2018, shoe: 0x3a2a1e, sleeves: 'mixed', blood: 0x7a1414 },
    sprinter: { skin: 0xa9ad8a, pants: 0x2a2a30, hair: 0x6b5a3a, shoe: 0xe5e7eb, sleeves: 'none', shorts: true, blood: 0x7a1414 },
    tank:     { skin: 0x6e8a5a, pants: 0x2f4f86, hair: null, shoe: 0x2a211a, sleeves: 'none', blood: 0x6a1212 },
    spitter:  { skin: 0x9aa56e, pants: 0x4a4a3a, hair: 0x1f1a14, shoe: 0x2a2a2a, sleeves: 'mixed', blood: 0x8fd13a },
    bomber:   { skin: 0xb3946e, pants: 0x6b3a1a, hair: null, shoe: 0x222222, sleeves: 'long', blood: 0xff7a1a },
    charger:  { skin: 0x7c6d5a, pants: 0x3a2a22, hair: 0x1a1410, shoe: null, sleeves: 'none', blood: 0x6a1212 },
    leaper:   { skin: 0x7f8a7e, pants: 0x2d3340, hair: null, shoe: 0x1f2937, sleeves: 'long', claws: true, bigEyes: true, noBelly: true, blood: 0x7a1414 },
    shielder: { skin: 0x7a9278, pants: 0x1e293b, hair: null, shoe: 0x111111, sleeves: 'long', armor: 0x334155, blood: 0x7a1414 },
    marksman: { skin: 0x738a66, pants: 0x3b4636, hair: null, shoe: 0x2a2419, sleeves: 'long', armor: 0x2f3a2a, blood: 0x7a1414 },
    medic:    { skin: 0x9eab96, pants: 0x4f8791, hair: 0x3a2e22, shoe: 0xe5e7eb, sleeves: 'long', noBelly: true, blood: 0x8b1a1a },
    boss:     { skin: 0x6e5a80, pants: 0x2a1f3a, hair: null, shoe: null, sleeves: 'none', claws: true, blood: 0x7a1fa8 },
    splitter: { skin: 0x8a7aa8, pants: 0x3a2f55, hair: null, shoe: 0x1f1a2e, sleeves: 'none', blood: 0xa78bfa },
    mite:     { skin: 0xb9a6e8, pants: 0x4c3d75, hair: null, shoe: null, sleeves: 'none', shorts: true, noBelly: true, bigEyes: true, blood: 0xa78bfa },
    screamer: { skin: 0x9c8f86, pants: 0x3b2a2a, hair: 0x111111, shoe: 0x222222, sleeves: 'long', noBelly: true, blood: 0x8b1a1a },
    jugg:     { skin: 0x7d6f62, pants: 0x292524, hair: null, shoe: 0x1c1917, sleeves: 'none', armor: 0x44403c, blood: 0x6a1212 },
    brood:    { skin: 0x8fa35a, pants: 0x3f4a1a, hair: null, shoe: null, sleeves: 'none', claws: true, bigEyes: true, noBelly: true, blood: 0x9be15a },
    pyro:     { skin: 0x5a2a1a, pants: 0x1c0f0a, hair: null, shoe: 0x111111, sleeves: 'none', claws: true, blood: 0xff7a1a },
    phantom:  { skin: 0x8a9aa8, pants: 0x0f172a, hair: 0x0b0f19, shoe: null, sleeves: 'long', claws: true, bigEyes: true, noBelly: true, blood: 0x22d3ee },
    warlord:  { skin: 0x6b7a5a, pants: 0x2f3a1e, hair: null, shoe: 0x1a1a14, sleeves: 'long', armor: 0x3a4a22, blood: 0x7a1414 },
    titan:    { skin: 0x8a8378, pants: 0x3a3530, hair: null, shoe: null, sleeves: 'none', claws: true, blood: 0x6a1212 },
    necro:    { skin: 0xb8b0c8, pants: 0x1e1b4b, hair: 0xe5e7eb, shoe: null, sleeves: 'long', noBelly: true, blood: 0x7c3aed },
    egg:      { skin: 0x9bbf4a, pants: 0x4d6b1a, hair: null, shoe: null, sleeves: 'none', noBelly: true, blood: 0x9be15a },
    acolyte:  { skin: 0xa7a3b8, pants: 0x2e1065, hair: null, shoe: null, sleeves: 'long', noBelly: true, blood: 0x7c3aed },
    risen:    { skin: 0xd6d3c4, pants: 0x3a3632, hair: null, shoe: null, sleeves: 'none', noBelly: true, blood: 0x9ca3af },
    shambler: { skin: 0x9aa58c, pants: 0x3a3a34, hair: 0x2a2620, shoe: null, sleeves: 'short', blood: 0x6a1212 },
    hound:    { skin: 0x8a7560, pants: 0x4a3a2c, hair: null, shoe: null, sleeves: 'none', claws: true, noBelly: true, blood: 0x7a1414 },
    crawler:  { skin: 0x8a8a74, pants: 0x3f3a33, hair: null, shoe: null, sleeves: 'none', claws: true, bigEyes: true, noBelly: true, blood: 0x7a1414 },
    shocker:  { skin: 0x7d8f98, pants: 0x1f2937, hair: null, shoe: 0x111111, sleeves: 'long', armor: 0x1e3a5f, bigEyes: true, blood: 0x7dd3fc },
    zero:     { skin: 0x7a8f55, pants: 0x2b3318, hair: null, shoe: null, sleeves: 'none', claws: true, bigEyes: true, noBelly: true, blood: 0xa3e635 }
};
const zLook = cfg => ZLOOK[cfg.look || cfg.id] || ZLOOK.grunt;
function mixHex(a, b, t) { return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex(); }


// 5.0 boss detail layer: extra armour plates, exposed parts and glowing cores merged into the same kit meshes (no extra draw calls)
function bossExtras(id, k, o) {
    const { sl, hd, eye, BONE, IRON, BLACK, skin, skinD, cloth, clothD, rot } = o;
    const T = k.torso, H = k.head, push = (a, ...p) => a.push(...p);
    switch (id) {
        case 'boss': {   // Abomination: spine of bone spikes, tusks, chained skull belt, bone-blade forearms, glowing veins
            for (let i = 0; i < 6; i++) push(T, [0.12, 0.34 - i * 0.025, 0.12, 0, 2.3 - i * 0.17, -hd - 0.1, BONE, 0.5, 0, 0]);
            for (let i = 0; i < 4; i++) { push(T, [0.5, 0.05, 0.05, 0, 1.55 + i * 0.2, hd + 0.04, BONE, 0, 0, i % 2 ? 0.12 : -0.12]); k.torsoGlow.push([0.04, 0.5, 0.04, -0.4 + i * 0.27, 1.9, hd + 0.03, eye]); }
            push(T, [1.14, 0.12, 0.7, 0, 1.38, 0, IRON], [0.2, 0.22, 0.2, -0.3, 1.3, hd + 0.1, BONE], [0.2, 0.22, 0.2, 0.3, 1.3, hd + 0.1, BONE], [0.08, 0.1, 0.04, -0.3, 1.3, hd + 0.21, BLACK], [0.08, 0.1, 0.04, 0.3, 1.3, hd + 0.21, BLACK]);
            push(T, [0.3, 0.8, 0.3, -1.0, 2.9, 0, BONE, 0, 0, 0.5], [0.3, 0.8, 0.3, 1.0, 2.9, 0, BONE, 0, 0, -0.5]);
            push(H, [0.1, 0.4, 0.1, -0.28, -0.4, 0.34, BONE, 0.3, 0, 0.2], [0.1, 0.4, 0.1, 0.28, -0.4, 0.34, BONE, 0.3, 0, -0.2], [0.8, 0.12, 0.4, 0, 0.4, 0.3, skinD]);
            for (const A of [k.armL, k.armR]) push(A, [0.1, 1.1, 0.34, 0, -1.4, -0.06, BONE, 0, 0, 0], [0.4, 0.14, 0.4, 0, -0.8, 0, IRON], [0.14, 0.4, 0.14, 0, -0.5, -0.24, BONE, -0.5, 0, 0]);
            k.armLGlow.push([0.06, 0.5, 0.04, 0, -0.45, 0.17, eye]); k.armRGlow.push([0.06, 0.5, 0.04, 0, -0.45, 0.17, eye]);
            for (const L of [k.legL, k.legR]) push(L, [0.46, 0.14, 0.5, 0, -0.55, 0.02, IRON], [0.12, 0.3, 0.12, 0, -0.55, 0.28, BONE, -0.4, 0, 0]);
            break;
        }
        case 'jugg': {   // Juggernaut: tower slab on the back, exhaust stacks, spiked knuckles, greaves
            const PL = 0x57534e, PLD = 0x3a3633, RIV = 0xa8a29e;
            push(T, [1.3, 1.5, 0.16, 0, 1.95, -hd - 0.24, PLD], [1.1, 1.3, 0.1, 0, 1.95, -hd - 0.33, PL], [0.3, 0.5, 0.3, -0.4, 2.9, -hd - 0.2, IRON], [0.3, 0.5, 0.3, 0.4, 2.9, -hd - 0.2, IRON]);
            k.torsoGlow.push([0.2, 0.06, 0.2, -0.4, 3.18, -hd - 0.2, 0xff7a1a], [0.2, 0.06, 0.2, 0.4, 3.18, -hd - 0.2, 0xff7a1a]);
            for (let i = 0; i < 4; i++) push(T, [1.2, 0.06, 0.06, 0, 1.5 + i * 0.28, -hd - 0.4, RIV]);
            push(T, [0.5, 0.5, 0.1, -0.5, 1.9, hd + 0.18, PLD], [0.5, 0.5, 0.1, 0.5, 1.9, hd + 0.18, PLD], [0.12, 0.6, 0.12, -1.2, 2.9, 0, RIV, 0, 0, 0.2], [0.12, 0.6, 0.12, 1.2, 2.9, 0, RIV, 0, 0, -0.2]);
            k.torsoGlow.push([0.5, 0.05, 0.03, 0, 1.55, hd + 0.2, eye]);
            push(H, [0.16, 0.5, 0.16, -0.5, 0.5, 0, RIV, 0, 0, 0.5], [0.16, 0.5, 0.16, 0.5, 0.5, 0, RIV, 0, 0, -0.5], [0.12, 0.7, 0.9, 0, 0.58, 0, PLD]);
            for (const A of [k.armL, k.armR]) for (const x of [-0.14, 0.14]) push(A, [0.09, 0.18, 0.09, x, -1.5, 0.2, RIV]);
            for (const L of [k.legL, k.legR]) push(L, [0.5, 0.5, 0.52, 0, -0.5, 0.02, PL], [0.4, 0.2, 0.2, 0, -0.5, 0.3, PLD], [0.5, 0.1, 0.6, 0, -0.1, 0, PLD], [0.14, 0.14, 0.2, 0, -0.45, 0.4, RIV]);
            break;
        }
        case 'brood': {  // Broodmother: extra spider legs, egg sacs, dorsal spines, bristles
            for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) push(T, [0.14, 1.4, 0.14, sd * 0.9, 1.5 + i * 0.15, -0.4 - i * 0.3, skinD, 0.3, 0, sd * (1.1 + i * 0.1)], [0.1, 0.9, 0.1, sd * 1.7, 0.7 + i * 0.12, -0.4 - i * 0.3, skin, 0.3, 0, sd * -0.3], [0.1, 0.2, 0.1, sd * 1.8, 0.1, -0.4 - i * 0.3, BONE]);
            for (let i = 0; i < 7; i++) push(T, [0.14, 0.4, 0.14, 0, 2.05 - i * 0.05, -0.2 - i * 0.28, BONE, -0.3, 0, 0]);
            for (const [x, y, z] of [[-0.75, 1.4, -1.0], [0.75, 1.4, -1.0], [-0.55, 1.2, -1.7], [0.55, 1.2, -1.7]]) { push(T, [0.5, 0.5, 0.5, x, y, z, 0x65751f]); k.torsoGlow.push([0.34, 0.34, 0.34, x, y, z, 0xd9f99d]); }
            for (let i = 0; i < 6; i++) push(T, [0.05, 0.3, 0.05, -0.4 + i * 0.16, 1.4, -1.9, rot, 0.4, 0, 0]);
            push(T, [0.9, 0.5, 0.5, 0, 2.3, -0.1, skinD], [0.7, 0.14, 0.1, 0, 1.55, hd + 0.04, BONE]);
            push(H, [0.12, 0.5, 0.12, -0.3, -0.5, 0.4, BONE, 0.5, 0, 0.5], [0.12, 0.5, 0.12, 0.3, -0.5, 0.4, BONE, 0.5, 0, -0.5], [0.8, 0.12, 0.3, 0, 0.4, 0.3, skinD]);
            for (const A of [k.armL, k.armR]) push(A, [0.12, 0.6, 0.12, 0, -1.8, 0.1, BONE, 0.4, 0, 0], [0.4, 0.12, 0.4, 0, -0.7, 0, skinD]);
            break;
        }
        case 'pyro': {   // Pyromancer: fuel tanks with hoses, shoulder flame vents, horns, glowing leg cracks
            const TK = 0x7f1d1d, TKD = 0x450a0a;
            push(T, [0.5, 1.3, 0.5, -0.32, 2.0, -hd - 0.35, TK], [0.5, 1.3, 0.5, 0.32, 2.0, -hd - 0.35, TK], [0.54, 0.1, 0.54, -0.32, 1.5, -hd - 0.35, TKD], [0.54, 0.1, 0.54, 0.32, 1.5, -hd - 0.35, TKD], [0.54, 0.1, 0.54, -0.32, 2.5, -hd - 0.35, TKD], [0.54, 0.1, 0.54, 0.32, 2.5, -hd - 0.35, TKD], [0.2, 0.2, 0.2, -0.32, 2.75, -hd - 0.35, IRON], [0.2, 0.2, 0.2, 0.32, 2.75, -hd - 0.35, IRON]);
            push(T, [0.1, 0.1, 0.9, -0.5, 2.45, 0.25, BLACK], [0.1, 0.1, 0.9, 0.5, 2.45, 0.25, BLACK], [1.12, 0.1, 0.62, 0, 1.45, 0, IRON]);
            for (const x of [-0.72, 0.72]) { push(T, [0.34, 0.4, 0.34, x, 2.82, 0, BLACK]); k.torsoGlow.push([0.24, 0.1, 0.24, x, 3.05, 0, 0xffd24d]); }
            k.torsoGlow.push([0.12, 0.12, 0.05, -0.32, 2.0, -hd - 0.62, 0xff6a1f], [0.12, 0.12, 0.05, 0.32, 2.0, -hd - 0.62, 0xff6a1f]);
            push(H, [0.14, 0.6, 0.14, -0.36, 0.62, 0, BLACK, 0, 0, 0.4], [0.14, 0.6, 0.14, 0.36, 0.62, 0, BLACK, 0, 0, -0.4], [0.9, 0.12, 0.3, 0, -0.15, 0.3, BLACK]);
            for (const L of [k.legL, k.legR]) { push(L, [0.44, 0.1, 0.46, 0, -0.5, 0, BLACK]); }
            k.legLGlow = [[0.04, 0.5, 0.03, 0.1, -0.5, 0.215, 0xff6a1f]]; k.legRGlow = [[0.04, 0.5, 0.03, -0.1, -0.5, 0.215, 0xff6a1f]];
            for (const A of [k.armL, k.armR]) push(A, [0.46, 0.14, 0.46, 0, -0.6, 0, BLACK], [0.14, 0.5, 0.14, 0, -1.7, 0.14, BLACK, 0.2, 0, 0]);
            break;
        }
        case 'phantom': {  // Phantom: tattered cloak strips, shoulder spikes, hanging chains, floating shards, bone mask
            for (let i = 0; i < 7; i++) push(T, [0.22, 1.1 + (i % 3) * 0.3, 0.04, -0.66 + i * 0.22, 0.9 - (i % 3) * 0.1, -hd - 0.1 - (i % 2) * 0.05, i % 2 ? clothD : cloth, 0.1 * (i % 3 - 1), 0, 0.08 * (i % 3 - 1)]);
            push(T, [0.14, 0.9, 0.14, -0.58, 2.9, -0.1, 0xcbd5e1, 0, 0, 0.35], [0.14, 0.9, 0.14, 0.58, 2.9, -0.1, 0xcbd5e1, 0, 0, -0.35], [0.12, 0.6, 0.12, -0.9, 2.7, -0.1, 0xcbd5e1, 0, 0, 0.9], [0.12, 0.6, 0.12, 0.9, 2.7, -0.1, 0xcbd5e1, 0, 0, -0.9]);
            for (let i = 0; i < 6; i++) push(T, [0.06, 0.1, 0.06, 0.4, 1.7 - i * 0.12, hd + 0.08, IRON, 0, i * 0.4, 0]);
            for (const [x, y, z, r] of [[-0.9, 1.9, 0.5, 0.3], [0.95, 2.4, 0.6, -0.2], [-0.7, 3.2, -0.2, 0.5], [0.8, 1.2, -0.5, -0.5]]) { push(T, [0.2, 0.5, 0.2, x, y, z, 0x1e3a4a, r, r, r]); k.torsoGlow.push([0.08, 0.3, 0.08, x, y, z, eye, r, r, r]); }
            k.torsoGlow.push([0.5, 0.05, 0.03, 0, 2.3, hd + 0.04, eye], [0.05, 0.5, 0.03, 0, 2.1, hd + 0.04, eye]);
            push(H, [0.5, 0.5, 0.06, 0, -0.04, 0.42, BONE], [0.1, 0.7, 0.1, -0.42, 0.7, -0.1, 0xcbd5e1, 0, 0, 0.3], [0.1, 0.7, 0.1, 0.42, 0.7, -0.1, 0xcbd5e1, 0, 0, -0.3]);
            for (const A of [k.armL, k.armR]) push(A, [0.5, 0.1, 0.5, 0, -0.9, 0, IRON], [0.06, 0.7, 0.1, 0.2, -1.9, 0.12, 0xcbd5e1, 0.3, 0, 0], [0.06, 0.7, 0.1, -0.2, -1.9, 0.12, 0xcbd5e1, 0.3, 0, 0]);
            break;
        }
        case 'warlord': {  // Warlord: war banner on the back, spiked pauldrons, medals, ammo drum, helmet crest
            const OL = 0x3a4a22, AM = 0xc9a227;
            push(T, [0.1, 2.4, 0.1, 0.5, 2.9, -hd - 0.3, 0x5c4a2a], [0.9, 0.7, 0.06, 0.95, 3.8, -hd - 0.3, 0x7f1d1d], [0.3, 0.3, 0.02, 0.95, 3.8, -hd - 0.34, AM], [0.14, 0.14, 0.14, 0.5, 4.15, -hd - 0.3, AM]);
            k.torsoGlow.push([0.18, 0.18, 0.02, 0.95, 3.8, -hd - 0.35, 0xff2020]);
            push(T, [0.8, 0.8, 0.5, -0.2, 1.9, -hd - 0.3, OL], [0.7, 0.1, 0.52, -0.2, 2.2, -hd - 0.3, AM], [0.7, 0.1, 0.52, -0.2, 1.6, -hd - 0.3, AM]);
            for (const x of [-0.8, 0.8]) for (let i = 0; i < 3; i++) push(T, [0.1, 0.5, 0.1, x + (i - 1) * 0.22, 2.8, (i - 1) * 0.2, IRON, 0, 0, (i - 1) * -0.1]);
            for (let i = 0; i < 4; i++) push(T, [0.1, 0.12, 0.03, -0.45 + i * 0.12, 2.15, hd + 0.16, i % 2 ? AM : 0xb91c1c]);
            push(T, [1.1, 0.14, 0.7, 0, 1.38, 0, 0x1a1a14], [0.24, 0.24, 0.1, 0, 1.38, hd + 0.1, AM]);
            push(H, [0.1, 0.34, 0.9, 0, 0.62, 0, 0x7f1d1d], [0.2, 0.1, 0.2, 0, 0.8, 0.0, AM]);
            for (const L of [k.legL, k.legR]) push(L, [0.48, 0.3, 0.2, 0, -0.45, 0.3, OL], [0.1, 0.16, 0.1, 0, -0.45, 0.42, AM]);
            push(k.armL, [0.5, 0.2, 0.5, 0, -0.2, 0, OL], [0.3, 0.7, 0.14, 0.24, -1.0, 0.04, IRON]);
            break;
        }
        case 'titan': {  // Titan: glowing crystals on shoulders and back, jagged stone crown, boulder knees, cracks
            const ST = 0x78716c, STD = 0x57534e, CR = 0xfbbf24;
            for (const [x, y, z, r] of [[-0.9, 2.95, 0.1, 0.3], [0.9, 2.95, -0.1, -0.3], [-0.5, 2.6, -0.7, 0.2], [0.6, 2.4, -0.7, -0.2], [0, 2.9, -0.8, 0]]) { push(T, [0.34, 0.9, 0.34, x, y, z, STD, 0, r, r]); k.torsoGlow.push([0.2, 0.7, 0.2, x, y + 0.08, z, CR, 0, r, r]); }
            push(T, [1.2, 0.3, 0.9, 0, 1.4, 0, STD], [0.6, 0.7, 0.2, -0.6, 1.9, hd + 0.2, ST, 0, 0, 0.1], [0.6, 0.7, 0.2, 0.6, 1.9, hd + 0.2, STD, 0, 0, -0.1], [1.4, 0.3, 0.3, 0, 2.2, -hd - 0.3, ST]);
            k.torsoGlow.push([0.3, 0.3, 0.05, 0, 2.0, hd + 0.31, CR]);
            for (let i = 0; i < 5; i++) push(H, [0.16, 0.5 + (i % 2) * 0.3, 0.16, (i - 2) * 0.17, 0.6, (i % 2) * -0.1, STD, 0, 0, (i - 2) * 0.12]);
            for (const L of [k.legL, k.legR]) { push(L, [0.7, 0.5, 0.7, 0, -0.4, 0, ST], [0.5, 0.4, 0.2, 0, -0.5, 0.4, STD], [0.7, 0.2, 0.8, 0, -0.1, 0, STD]); }
            k.legLGlow = [[0.04, 0.4, 0.03, 0, -0.8, 0.22, CR]]; k.legRGlow = [[0.04, 0.4, 0.03, 0, -0.8, 0.22, CR]];
            for (const A of [k.armL, k.armR]) push(A, [0.8, 0.3, 0.8, 0, -1.55, 0, ST], [0.14, 0.4, 0.14, -0.3, -1.8, 0.3, STD], [0.14, 0.4, 0.14, 0.3, -1.8, 0.3, STD]);
            k.armLGlow.push([0.04, 0.6, 0.03, 0, -0.8, 0.28, CR]); k.armRGlow.push([0.04, 0.6, 0.03, 0, -0.8, 0.28, CR]);
            break;
        }
        case 'necro': {  // Necromancer: floating bone ribs, skull belt, soul jars, spiked collar, rune hem
            for (let i = 0; i < 4; i++) push(T, [0.9 - i * 0.1, 0.06, 0.06, 0, 2.0 + i * 0.14, hd + 0.1, BONE]);
            for (let i = 0; i < 4; i++) push(T, [0.1, 0.5, 0.06, -0.4 + i * 0.27, 1.85, hd + 0.1, BONE, 0, 0, (i - 1.5) * 0.08]);
            for (const x of [-0.5, 0, 0.5]) { push(T, [0.26, 0.28, 0.26, x, 1.25, hd + 0.14, BONE], [0.18, 0.08, 0.04, x, 1.22, hd + 0.28, BLACK]); }
            for (const x of [-0.7, 0.7]) { push(T, [0.3, 0.4, 0.3, x, 1.05, 0.3, 0x1e1b4b]); k.torsoGlow.push([0.2, 0.28, 0.2, x, 1.05, 0.3, eye]); push(T, [0.08, 0.5, 0.04, x * 0.6, 1.4, 0.3, IRON]); }
            for (let i = 0; i < 8; i++) push(T, [0.1, 0.5, 0.1, Math.cos(i * 0.785) * 0.55, 2.7, Math.sin(i * 0.785) * 0.4, BONE, 0, 0, Math.cos(i * 0.785) * -0.5]);
            for (let i = 0; i < 5; i++) k.torsoGlow.push([0.2, 0.03, 0.03, -0.4 + i * 0.2, 0.66, hd + 0.4, eye]);
            push(T, [1.3, 0.1, 0.9, 0, 0.58, 0, 0x4c1d95], [0.9, 1.2, 0.04, 0, 1.0, -hd - 0.1, 0x312e81]);
            for (let i = 0; i < 3; i++) push(H, [0.1, 0.5, 0.1, -0.1 + i * 0.1, 0.9 + (i % 2) * 0.2, 0, BONE, 0, 0, (i - 1) * 0.3]);
            k.headGlow.push([0.08, 0.1, 0.03, -0.17, 0.08, 0.385, eye], [0.08, 0.1, 0.03, 0.17, 0.08, 0.385, eye]);
            push(k.armL, [0.5, 0.1, 0.5, 0, -0.7, 0, BONE], [0.14, 0.14, 0.4, 0, -1.3, 0.1, BONE]);
            k.armLGlow.push([0.16, 0.16, 0.16, 0, -1.5, 0.3, eye]);
            break;
        }
    }
}

function enemyKit(cfg) {
    if (enemyKits[cfg.id]) return enemyKits[cfg.id];
    if (cfg.id === 'egg') return (enemyKits.egg = eggKit(cfg));
    if (cfg.id === 'hound') return (enemyKits.hound = houndKit(cfg));
    const s = cfg.scale, sl = cfg.slim || 1, id = cfg.look || cfg.id, Z = zLook(cfg);
    const eye = cfg.eye || 0xd9ff5a;
    const cloth = mixHex(cfg.color, 0x55554a, 0.18), clothD = darken(cloth, 0.58);
    const skin = Z.skin, skinD = darken(skin, 0.74), rot = darken(skin, 0.42), pants = Z.pants, pantsD = darken(pants, 0.6);
    const BONE = 0xd9cfb0, TEETH = 0xcfc39a, BLOOD = 0x7a1414, DRIED = 0x4a1010, HOLE = 0x140808, BLACK = 0x17181c, IRON = 0x4b5563;
    const k = { legL: [], legR: [], armL: [], armR: [], torso: [], head: [], torsoGlow: [], headGlow: [], armLGlow: [], armRGlow: [] };
    const hd = 0.29 * sl, T = k.torso, H = k.head;

    // ---- legs: left keeps its trouser leg (knee poking through a hole), right is ripped open to a bony, bloody shin
    const vein = darken(mixHex(skin, 0x3b2a5a, 0.5), 0.62);
    for (const [L, torn] of [[k.legL, false], [k.legR, true]]) {
        L.push([0.4 * sl, 0.62, 0.42 * sl, 0, -0.3, 0, pants]);
        if (Z.shorts) L.push([0.42 * sl, 0.1, 0.44 * sl, 0, -0.6, 0, pantsD], [0.28 * sl, 0.52, 0.3 * sl, 0, -0.85, 0, skin], [0.02, 0.2, 0.12, 0.145 * sl, -0.8, 0, rot]);
        else if (torn) L.push([0.42 * sl, 0.1, 0.44 * sl, 0, -0.63, 0, pantsD], [0.08, 0.18, 0.02, -0.12, -0.74, 0.22 * sl, pantsD], [0.08, 0.12, 0.02, 0.1, -0.71, 0.22 * sl, pantsD],
                              [0.3 * sl, 0.42, 0.32 * sl, 0, -0.86, 0, skin], [0.08, 0.22, 0.02, 0.04, -0.88, 0.165 * sl, BONE], [0.14, 0.1, 0.02, -0.05, -0.99, 0.165 * sl, BLOOD], [0.02, 0.18, 0.14, 0.155 * sl, -0.82, 0, rot]);
        else L.push([0.38 * sl, 0.5, 0.4 * sl, 0, -0.84, 0, pants], [0.2 * sl, 0.16, 0.02, 0, -0.58, 0.21 * sl, skin], [0.1, 0.08, 0.02, 0, -0.58, 0.222 * sl, BONE]);
        if (Z.shoe != null) {
            L.push([0.42 * sl, 0.2, 0.56 * sl, 0, -1.0, 0.07, Z.shoe]);
            if (torn) L.push([0.4 * sl, 0.05, 0.22, 0, -1.1, 0.36, BLACK, 0.35, 0, 0], [0.3 * sl, 0.07, 0.06, 0, -1.04, 0.37, rot]);   // sole flapping open, toes showing
            else L.push([0.44 * sl, 0.06, 0.58 * sl, 0, -1.08, 0.07, BLACK]);
        } else L.push([0.34 * sl, 0.16, 0.5 * sl, 0, -1.02, 0.07, skinD], [0.3 * sl, 0.07, 0.07, 0, -1.06, 0.34, rot]);
    }

    // ---- torso: torn shirt in the type colour with flaps hanging off, a belly wound, bare ribs, and the spine showing through the back
    T.push([0.96 * sl, 0.32, 0.56 * sl, 0, 1.26, 0, pants], [1.02 * sl, 0.08, 0.6 * sl, 0, 1.42, 0, BLACK], [1.0 * sl, 0.92, 0.58 * sl, 0, 1.9, 0, cloth]);
    T.push([0.22 * sl, 0.32, 0.03, -0.26 * sl, 1.29, hd + 0.02, cloth], [0.16 * sl, 0.2, 0.03, 0.06 * sl, 1.35, hd + 0.02, clothD], [0.3 * sl, 0.26, 0.03, 0.2 * sl, 1.32, -hd - 0.02, cloth]);
    T.push([0.64 * sl, 0.1, 0.5 * sl, 0, 2.36, 0, clothD], [0.3, 0.3, 0.28, 0, 2.48, 0.05, skinD], [0.1, 0.12, 0.02, 0.1, 2.46, 0.195, BLOOD], [0.04, 0.26, 0.02, -0.06, 2.47, 0.195, rot]);
    if (!Z.armor) {
        if (!Z.noBelly) T.push([0.34 * sl, 0.3, 0.02, 0.2 * sl, 1.62, hd + 0.005, skin], [0.2 * sl, 0.12, 0.02, 0.22 * sl, 1.6, hd + 0.012, HOLE],
                               [0.12, 0.06, 0.03, 0.2 * sl, 1.58, hd + 0.02, 0x8a2b2b], [0.08, 0.05, 0.03, 0.27 * sl, 1.63, hd + 0.02, 0x6e1f1f]);
        T.push([0.36 * sl, 0.42, 0.02, -0.22 * sl, 1.98, hd + 0.005, HOLE]);
        for (let i = 0; i < 3; i++) T.push([0.32 * sl, 0.05, 0.03, -0.22 * sl, 1.84 + i * 0.12, hd + 0.015, BONE]);
        T.push([0.24 * sl, 0.34, 0.02, 0.26 * sl, 2.1, hd + 0.005, DRIED], [0.1, 0.22, 0.02, 0.3 * sl, 1.86, hd + 0.008, BLOOD], [0.04, 0.3, 0.02, 0.33 * sl, 1.72, hd + 0.01, BLOOD]);
        T.push([0.3 * sl, 0.7, 0.02, 0, 1.95, -hd - 0.006, HOLE], [0.2, 0.16, 0.02, -0.25 * sl, 2.15, -hd - 0.01, BONE]);
        for (let i = 0; i < 4; i++) T.push([0.1, 0.08, 0.04, 0, 1.7 + i * 0.16, -hd - 0.02, BONE]);
    }

    // ---- arms: long, with bony elbows, veins, a bite, a chewed forearm, and big hooked four-finger claws
    for (const [A, side] of [[k.armL, -1], [k.armR, 1]]) {
        const sleeve = Z.sleeves === 'long' || (Z.sleeves === 'mixed' && side < 0);
        if (sleeve) A.push([0.36, 0.72, 0.36, 0, -0.3, 0, cloth], [0.38, 0.08, 0.38, 0, -0.66, 0, clothD], [0.1, 0.2, 0.02, 0.1, -0.74, 0.19, clothD], [0.26, 0.42, 0.26, 0, -0.9, 0, skin]);
        else A.push([0.36, 0.26, 0.38, 0, -0.03, 0, Z.sleeves === 'none' ? skinD : clothD], [0.27, 0.5, 0.27, 0, -0.38, 0, skin], [0.14, 0.12, 0.06, 0, -0.62, -0.14, BONE],
                    [0.25, 0.44, 0.25, 0, -0.88, 0, skin], [0.02, 0.2, 0.14, side * 0.14, -0.42, 0, BLOOD]);
        A.push([0.02, 0.3, 0.02, -side * 0.13, -0.92, 0.06, vein]);
        A.push([0.3, 0.22, 0.32, 0, -1.18, 0.02, skinD]);
        const fl = Z.claws ? 0.38 : 0.24, fc = Z.claws ? BONE : skinD;
        for (const fx of [-0.11, -0.037, 0.037, 0.11]) A.push([0.06, fl, 0.07, fx, -1.29 - fl / 2, 0.08, fc, 0.35, 0, 0]);
        A.push([0.07, 0.16, 0.08, -side * 0.17, -1.2, 0.1, skinD]);
        if (side < 0) A.push([0.27, 0.14, 0.27, 0, -0.82, 0, rot], [0.1, 0.16, 0.1, 0.06, -0.82, 0.1, BONE]);
    }

    // ---- head: sunken sockets (one eye bigger than the other), rotten nose, torn cheek, broken teeth, crooked slack jaw, cracked skull
    H.push([0.76, 0.74, 0.74, 0, 0.02, 0, skin], [0.7, 0.1, 0.1, 0, 0.16, 0.34, skinD]);
    H.push([0.22, 0.17, 0.03, -0.18, 0.05, 0.37, HOLE], [0.22, 0.15, 0.03, 0.18, 0.02, 0.37, HOLE]);
    H.push([0.1, 0.1, 0.03, 0, -0.07, 0.375, HOLE], [0.44, 0.18, 0.03, 0, -0.24, 0.372, HOLE], [0.38, 0.05, 0.03, 0, -0.17, 0.385, TEETH], [0.05, 0.05, 0.03, 0.08, -0.17, 0.39, HOLE]);
    H.push([0.02, 0.16, 0.22, 0.385, -0.2, 0.2, HOLE], [0.02, 0.05, 0.18, 0.39, -0.18, 0.2, TEETH]);
    H.push([0.62, 0.14, 0.6, 0.03, -0.42, 0.08, skinD, 0, 0, 0.1]);
    H.push([0.07, 0.06, 0.03, -0.13, -0.33, 0.39, TEETH], [0.07, 0.07, 0.03, 0.02, -0.34, 0.39, TEETH], [0.06, 0.05, 0.03, 0.14, -0.32, 0.39, TEETH], [0.07, 0.2, 0.02, 0.12, -0.56, 0.37, BLOOD]);
    H.push([0.06, 0.2, 0.14, -0.4, 0.02, -0.02, skinD], [0.03, 0.12, 0.12, 0.385, 0.02, -0.12, BLOOD]);
    H.push([0.02, 0.22, 0.02, -0.3, -0.06, 0.372, vein], [0.16, 0.12, 0.02, -0.2, 0.28, 0.372, skinD], [0.12, 0.02, 0.02, 0.24, 0.26, 0.372, vein]);
    if (Z.hair != null) H.push([0.5, 0.08, 0.5, -0.1, 0.42, -0.06, Z.hair], [0.26, 0.08, 0.3, 0.2, 0.42, 0.12, Z.hair], [0.6, 0.3, 0.06, 0, 0.2, -0.385, Z.hair],
                               [0.05, 0.42, 0.05, -0.36, 0.12, -0.22, Z.hair], [0.05, 0.3, 0.05, 0.37, 0.18, -0.26, Z.hair], [0.04, 0.34, 0.03, -0.27, 0.12, 0.39, Z.hair]);
    H.push([0.3, 0.03, 0.26, 0.16, 0.395, -0.12, rot], [0.18, 0.03, 0.16, 0.18, 0.405, -0.12, BONE], [0.03, 0.02, 0.2, 0.05, 0.4, 0.08, HOLE]);
    let eyes = true, extra = null, shield = null;

    switch (id) {
        case 'grunt': {
            // office zombie: loosened tie, collar, a dangling ID badge, a bandaged forearm and a wristwatch
            const TIE = 0xb91c1c;
            T.push([0.16, 0.7, 0.03, 0, 2.0, hd + 0.015, TIE], [0.2, 0.14, 0.04, 0, 2.3, hd + 0.02, darken(TIE, 0.8)], [0.5, 0.1, 0.1, 0, 2.38, hd - 0.04, 0xe5e7eb, 0, 0, 0.1]);
            T.push([0.2, 0.26, 0.02, -0.28 * sl, 1.82, hd + 0.02, 0xf1f5f9], [0.2, 0.05, 0.03, -0.28 * sl, 1.97, hd + 0.03, 0x2563eb], [0.02, 0.2, 0.02, -0.28 * sl, 2.1, hd + 0.02, BLACK]);
            for (let i = 0; i < 3; i++) k.armR.push([0.3, 0.07, 0.3, 0, -0.72 - i * 0.1, 0.01, i % 2 ? 0xd6d3c4 : 0xece8d8]);
            k.armR.push([0.04, 0.2, 0.04, 0.02, -0.98, 0.15, BLOOD]);
            k.armL.push([0.28, 0.06, 0.28, 0, -1.04, 0, 0x9ca3af], [0.06, 0.07, 0.03, 0, -1.04, 0.15, 0x7ee8fa]);
            break;
        }
        case 'sprinter':
            // skinny runner: tank top, running shorts, white sneakers, ribs on both sides, glowing sweatband
            T.push([0.36 * sl, 0.42, 0.02, 0.2 * sl, 2.02, -hd - 0.012, HOLE]);
            for (let i = 0; i < 3; i++) T.push([0.3 * sl, 0.05, 0.03, 0.2 * sl, 1.88 + i * 0.12, -hd - 0.024, BONE]);
            k.headGlow.push([0.8, 0.07, 0.78, 0, 0.27, 0, 0xfacc15]);
            break;
        case 'tank':
            // bloated brute in overalls: gut bursting out, flesh humps on the shoulders, shackles on the wrists
            T.push([1.16 * sl, 0.72, 0.36, 0, 1.68, 0.24, skin], [0.5, 0.04, 0.02, 0.1, 1.74, 0.425, rot], [0.34, 0.04, 0.02, -0.2, 1.54, 0.425, rot]);
            T.push([0.6, 0.3, 0.04, 0, 2.2, hd + 0.01, cloth], [0.16, 0.5, 0.04, -0.3, 2.14, hd + 0.01, cloth], [0.16, 0.5, 0.04, 0.3, 2.14, hd + 0.01, cloth]);
            T.push([0.55, 0.38, 0.75, -0.72, 2.36, 0, skinD], [0.55, 0.38, 0.75, 0.72, 2.36, 0, skinD], [0.9, 0.7, 0.2, 0, 2.0, -0.36, skinD]);
            T.push([0.14, 0.14, 0.06, -0.25, 2.15, -0.47, rot], [0.12, 0.12, 0.06, 0.2, 1.9, -0.47, rot]);
            for (const A of [k.armL, k.armR]) A.push([0.44, 0.5, 0.44, 0, -0.72, 0, skin], [0.48, 0.12, 0.48, 0, -0.94, 0, IRON], [0.08, 0.28, 0.08, 0, -1.1, -0.24, 0x6b7280], [0.4, 0.28, 0.4, 0, -1.1, 0, skinD]);
            H.push([0.3, 0.03, 0.02, 0, 0.3, 0.375, BLACK], [0.03, 0.08, 0.02, -0.08, 0.3, 0.378, BLACK], [0.03, 0.08, 0.02, 0.08, 0.3, 0.378, BLACK]);
            break;
        case 'spitter':
            // acid spitter: swollen glowing throat sac, acid in the mouth and dripping down, acid sac on the back
            extra = { size: [0.6, 0.6, 0.6], pos: [0, 2.0, -0.5], color: 0xa3e635 };
            k.headGlow.push([0.5, 0.24, 0.4, 0, -0.44, 0.12, 0x9be15a], [0.36, 0.1, 0.02, 0, -0.25, 0.382, 0x7bd12a], [0.08, 0.34, 0.04, 0.02, -0.6, 0.37, 0xa3e635], [0.06, 0.2, 0.04, -0.14, -0.5, 0.38, 0xa3e635]);
            k.headGlow.push([0.12, 0.12, 0.04, -0.3, -0.1, 0.38, 0x9be15a], [0.1, 0.1, 0.04, 0.3, -0.06, 0.38, 0x9be15a]);
            k.torsoGlow.push([0.1, 0.3, 0.02, 0.05, 2.1, hd + 0.02, 0x8fd13a], [0.08, 0.18, 0.02, -0.05, 1.7, hd + 0.02, 0x8fd13a]);
            break;
        case 'bomber':
            // exploder: swollen gut split open over a glowing core (it flashes when the fuse is lit), boils all over
            T.push([1.2 * sl, 0.8, 0.44, 0, 1.66, 0.2, skin], [0.8, 0.08, 0.06, 0, 1.98, 0.43, rot], [0.8, 0.08, 0.06, 0, 1.34, 0.43, rot]);
            extra = { size: [0.7, 0.54, 0.2], pos: [0, 1.66, 0.42], color: 0xff5a00 };
            k.torsoGlow.push([0.16, 0.16, 0.06, -0.32, 2.15, hd + 0.02, 0xff8a1a], [0.12, 0.12, 0.06, 0.34, 2.05, hd + 0.02, 0xff8a1a], [0.18, 0.18, 0.06, 0.1, 2.0, -hd - 0.02, 0xff8a1a], [0.14, 0.14, 0.06, -0.25, 1.7, -hd - 0.02, 0xff8a1a]);
            k.headGlow.push([0.14, 0.14, 0.05, 0.24, -0.08, 0.385, 0xff8a1a], [0.12, 0.12, 0.05, -0.2, 0.3, 0.2, 0xff8a1a]);
            k.armLGlow.push([0.12, 0.12, 0.05, 0, -0.4, 0.19, 0xff8a1a]); k.armRGlow.push([0.1, 0.1, 0.05, 0, -0.55, 0.19, 0xff8a1a]);
            // a bandolier of dynamite across the chest with a sparking fuse
            for (let i = 0; i < 4; i++) T.push([0.14, 0.5, 0.14, -0.38 + i * 0.25, 2.0 - i * 0.04, hd + 0.18, 0xb91c1c, 0, 0, 0.1], [0.15, 0.06, 0.15, -0.38 + i * 0.25, 2.18 - i * 0.04, hd + 0.18, 0xe5e7eb]);
            T.push([0.9 * sl, 0.07, 0.1, 0, 2.0, hd + 0.08, BLACK, 0, 0, 0.05]);
            k.torsoGlow.push([0.06, 0.1, 0.06, -0.38, 2.3, hd + 0.18, 0xffd24d], [0.06, 0.1, 0.06, 0.12, 2.26, hd + 0.18, 0xffd24d]);
            break;
        case 'charger':
            // the ram: bone horns out of its skull, a spiked hump, one massive club arm, bare feet
            H.push([0.14, 0.14, 0.55, -0.42, 0.24, 0.18, BONE, 0, 0.5, 0], [0.14, 0.14, 0.55, 0.42, 0.24, 0.18, BONE, 0, -0.5, 0]);
            T.push([1.3 * sl, 0.55, 0.62, 0, 2.2, -0.14, skinD]);
            for (let i = 0; i < 3; i++) T.push([0.1, 0.28, 0.1, (i - 1) * 0.32, 2.55, -0.26, BONE, -0.3, 0, 0]);
            k.armR.push([0.52, 0.62, 0.52, 0, -0.7, 0, skin], [0.6, 0.42, 0.6, 0, -1.1, 0, skinD], [0.12, 0.1, 0.12, -0.16, -1.34, 0.12, BONE], [0.12, 0.1, 0.12, 0.16, -1.34, 0.12, BONE]);
            for (const L of [k.legL, k.legR]) L.push([0.48, 0.5, 0.5, 0, -0.3, 0, pants]);
            break;
        case 'leaper':
            // hunter in a pink hoodie: hood up, eyes glowing out of the shadow, long bone claws
            H.push([0.9, 0.1, 0.86, 0, 0.45, -0.04, cloth], [0.08, 0.8, 0.84, -0.44, 0.06, -0.04, cloth], [0.08, 0.8, 0.84, 0.44, 0.06, -0.04, cloth], [0.9, 0.8, 0.08, 0, 0.06, -0.44, cloth], [0.9, 0.08, 0.06, 0, 0.42, 0.39, clothD]);
            T.push([0.6 * sl, 0.22, 0.03, 0, 1.62, hd + 0.012, clothD], [0.03, 0.3, 0.02, -0.1, 2.2, hd + 0.02, 0xf1f5f9], [0.03, 0.26, 0.02, 0.1, 2.22, hd + 0.02, 0xf1f5f9]);
            for (const L of [k.legL, k.legR]) L.push([0.48, 0.5, 0.52, 0, -0.28, 0.05, pants]);
            break;
        case 'shielder':
            // zombie riot cop: helmet with the visor flipped up, body armour, cracked and bloody riot shield
            H.push([0.86, 0.34, 0.86, 0, 0.32, 0, 0x1f2937], [0.9, 0.06, 0.9, 0, 0.16, 0, 0x111827]);
            k.headGlow.push([0.7, 0.14, 0.04, 0, 0.44, 0.45, 0x7ee8fa]);
            T.push([1.06 * sl, 0.78, 0.64 * sl, 0, 1.94, 0, Z.armor], [0.7 * sl, 0.1, 0.02, 0, 2.14, 0.325 * sl, 0xe5e7eb], [0.22, 0.24, 0.02, -0.22, 1.78, 0.325 * sl, BLOOD]);
            for (const x of [-0.3, 0, 0.3]) T.push([0.2, 0.2, 0.1, x * sl, 1.58, 0.34 * sl, 0x1f2937]);
            for (const A of [k.armL, k.armR]) A.push([0.44, 0.26, 0.44, 0, -0.02, 0, Z.armor]);
            shield = partsGeo([[1.55, 2.3, 0.12, 0, 0, 0, 0x3f4a5a], [1.62, 0.12, 0.16, 0, 1.1, 0, 0x1f2937], [1.62, 0.12, 0.16, 0, -1.1, 0, 0x1f2937], [0.9, 0.34, 0.14, 0, 0.62, 0, 0x7ee8fa],
                               [1.2, 0.14, 0.02, 0, 0.2, 0.07, 0xe5e7eb], [0.06, 0.6, 0.02, -0.35, -0.35, 0.07, 0x111827, 0, 0, 0.5], [0.05, 0.4, 0.02, -0.18, -0.55, 0.07, 0x111827, 0, 0, -0.6],
                               [0.3, 0.34, 0.02, 0.35, -0.35, 0.07, BLOOD], [0.1, 0.5, 0.02, 0.42, -0.75, 0.07, DRIED], [0.24, 0.2, 0.02, -0.4, 0.62, 0.08, DRIED]], s);
            break;
        case 'crawler':
            // vent crawler: pale, hairless and half-starved, spine bumps along the back, bony elbows, huge yellow eyes
            for (let i = 0; i < 5; i++) T.push([0.14, 0.14, 0.12, 0, 1.55 + i * 0.2, -hd - 0.07, BONE]);
            T.push([0.9 * sl, 0.2, 0.5, 0, 2.3, -0.1, rot], [0.3, 0.1, 0.02, 0.1, 1.9, hd + 0.02, rot]);
            H.push([0.04, 0.3, 0.04, -0.2, 0.46, 0.0, BONE, 0.3, 0, 0], [0.04, 0.3, 0.04, 0.2, 0.46, 0.0, BONE, 0.3, 0, 0]);
            k.headGlow.push([0.2, 0.16, 0.04, -0.17, 0.06, 0.39, 0xfacc15], [0.2, 0.16, 0.04, 0.17, 0.06, 0.39, 0xfacc15]);
            for (const A of [k.armL, k.armR]) A.push([0.3, 0.12, 0.3, 0, -0.62, 0, BONE]);
            break;
        case 'shocker':
            // electrified lineman: scorched skin, hard hat with a glowing cyan lamp, insulated cuffs, a crackling coil pack on the back, a glowing chest core
            H.push([0.88, 0.26, 0.88, 0, 0.4, 0, 0xfacc15], [0.96, 0.06, 1.0, 0, 0.26, 0.06, 0xca8a04], [0.14, 0.14, 0.06, 0, 0.42, 0.46, 0xe0f2fe]);
            k.headGlow.push([0.2, 0.1, 0.04, 0, 0.42, 0.5, 0x7dd3fc]);
            T.push([1.08 * sl, 0.94, 0.64 * sl, 0, 1.95, 0, Z.armor], [1.1 * sl, 0.08, 0.66 * sl, 0, 1.5, 0, 0x0f172a], [0.9 * sl, 0.06, 0.02, 0, 2.2, hd + 0.34, 0xfacc15]);
            T.push([0.8, 0.9, 0.34, 0, 2.0, -hd - 0.2, 0x27272a], [0.1, 0.6, 0.1, -0.26, 2.7, -hd - 0.2, 0x94a3b8], [0.1, 0.6, 0.1, 0.26, 2.7, -hd - 0.2, 0x94a3b8], [0.1, 0.45, 0.1, 0, 2.62, -hd - 0.2, 0x94a3b8]);
            k.torsoGlow.push([0.34, 0.34, 0.05, 0, 1.92, hd + 0.04, 0x7dd3fc], [0.18, 0.18, 0.18, -0.26, 3.06, -hd - 0.2, 0xe0f2fe], [0.18, 0.18, 0.18, 0.26, 3.06, -hd - 0.2, 0xe0f2fe], [0.14, 0.14, 0.14, 0, 2.92, -hd - 0.2, 0xe0f2fe]);
            extra = { size: [0.5, 0.5, 0.2], pos: [0, 2.0, -hd - 0.45], color: 0x7dd3fc };
            for (const A of [k.armL, k.armR]) A.push([0.42, 0.22, 0.42, 0, -1.04, 0, 0x1d4ed8]);
            k.armLGlow.push([0.04, 0.5, 0.04, 0, -0.5, 0.14, 0x7dd3fc]); k.armRGlow.push([0.04, 0.5, 0.04, 0, -0.5, 0.14, 0x7dd3fc]);
            break;
        case 'zero':
            // Patient Zero: a swollen patient in a torn hospital gown with a wristband and drip line, glowing boils, a huge pulsing tumour on the back
            T.push([1.1 * sl, 1.0, 0.64 * sl, 0, 1.92, 0, 0xcbd5e1], [0.5, 0.4, 0.02, -0.24, 1.7, hd + 0.02, 0x93c5fd], [0.12, 1.1, 0.02, 0.35, 1.8, hd + 0.02, 0x93c5fd], [0.3, 0.5, 0.02, 0.1, 1.3, hd + 0.02, BLOOD]);
            T.push([0.7, 0.45, 0.9, -0.8, 2.45, 0, skinD], [0.7, 0.45, 0.9, 0.8, 2.45, 0, skinD]);
            for (let i = 0; i < 5; i++) T.push([0.12, 0.5, 0.12, -0.5 + i * 0.25, 2.8, -0.1, BONE, 0, 0, (i - 2) * 0.12]);
            k.torsoGlow.push([0.3, 0.3, 0.06, -0.3, 2.1, hd + 0.04, 0xa3e635], [0.22, 0.22, 0.06, 0.28, 1.6, hd + 0.04, 0xa3e635], [0.26, 0.26, 0.06, 0.05, 1.5, -hd - 0.04, 0xa3e635], [0.2, 0.2, 0.06, -0.3, 2.2, -hd - 0.04, 0xa3e635]);
            extra = { size: [1.3, 1.2, 1.0], pos: [0, 2.15, -0.95], color: 0x84cc16 };
            k.headGlow.push([0.4, 0.14, 0.04, 0, -0.3, 0.385, 0xa3e635], [0.1, 0.1, 0.1, -0.41, 0.5, 0, 0xa3e635], [0.1, 0.1, 0.1, 0.41, 0.5, 0, 0xa3e635]);
            for (const A of [k.armL, k.armR]) A.push([0.46, 0.12, 0.46, 0, -0.62, 0, BONE], [0.12, 0.5, 0.12, 0, -0.64, 0.3, BONE, 0.4, 0, 0]);
            k.armL.push([0.3, 0.1, 0.3, 0, -0.98, 0, 0xe5e7eb]);
            break;
        case 'marksman':
            // zombie sniper: combat helmet, glowing red scope over one eye, tactical vest, backpack, rifle
            H.push([0.86, 0.3, 0.86, 0, 0.34, -0.02, 0x3a4432], [0.9, 0.06, 0.9, 0, 0.2, -0.02, 0x2c3426], [0.08, 0.22, 0.06, -0.18, 0.26, 0.42, BLACK]);
            k.headGlow.push([0.15, 0.15, 0.14, -0.18, 0.06, 0.44, eye]);
            T.push([1.06 * sl, 0.72, 0.64 * sl, 0, 1.95, 0, Z.armor], [0.3, 0.2, 0.02, -0.2, 2.15, 0.325 * sl, 0x4d5a3a], [0.24, 0.18, 0.02, 0.25, 1.8, 0.325 * sl, 0x4d5a3a]);
            for (const x of [-0.3, 0, 0.3]) T.push([0.18, 0.24, 0.1, x * sl, 1.72, 0.36 * sl, 0x1f2937]);
            T.push([1.0, 0.9, 0.22, 0, 1.85, -0.42, darken(cloth, 0.7)], [0.8, 0.1, 0.24, 0, 2.3, -0.42, BLACK]);
            k.armR.push([0.12, 1.35, 0.16, 0, -1.25, -0.06, 0x111827], [0.1, 0.32, 0.12, 0, -1.05, -0.2, 0x1f2937]);
            break;
        case 'medic':
            // zombie doctor: blood-soaked lab coat, surgical mask, nurse cap, glowing IV bag on its back
            T.push([1.04 * sl, 0.62, 0.6 * sl, 0, 1.25, 0, cloth], [0.4 * sl, 0.5, 0.02, 0.18 * sl, 1.62, hd + 0.02, BLOOD], [0.2, 0.3, 0.02, -0.3 * sl, 1.3, hd + 0.02, DRIED]);
            for (const L of [k.legL, k.legR]) L.push([0.44 * sl, 0.36, 0.46 * sl, 0, -0.16, 0, cloth]);
            k.torsoGlow.push([0.1, 0.36, 0.05, 0.25 * sl, 2.12, hd + 0.03, 0xef4444], [0.36, 0.1, 0.05, 0.25 * sl, 2.12, hd + 0.03, 0xef4444]);
            H.push([0.58, 0.28, 0.03, 0, -0.2, 0.395, 0x9fd8c8], [0.2, 0.12, 0.02, 0.1, -0.25, 0.412, BLOOD], [0.82, 0.16, 0.82, 0, 0.46, 0, 0xffffff]);
            k.headGlow.push([0.08, 0.2, 0.03, 0, 0.46, 0.42, 0xef4444], [0.2, 0.08, 0.03, 0, 0.46, 0.42, 0xef4444]);
            extra = { size: [0.32, 0.44, 0.12], pos: [0, 2.3, -0.46], color: 0x4ade80 };
            break;
        case 'splitter':
            // bloated with mites: a huge belly covered in glowing purple sacs that wriggle
            T.push([1.24 * sl, 0.86, 0.5, 0, 1.66, 0.2, skin], [0.9, 0.06, 0.04, 0, 1.98, 0.46, rot], [0.8, 0.06, 0.04, 0, 1.36, 0.46, rot]);
            k.torsoGlow.push([0.22, 0.22, 0.08, -0.3, 1.8, hd + 0.2, 0xc084fc], [0.18, 0.18, 0.08, 0.28, 1.55, hd + 0.2, 0xc084fc], [0.16, 0.16, 0.08, 0.05, 2.05, hd + 0.2, 0xd8b4fe], [0.2, 0.2, 0.08, 0.1, 2.0, -hd - 0.03, 0xc084fc], [0.14, 0.14, 0.08, -0.25, 1.6, -hd - 0.03, 0xc084fc]);
            k.headGlow.push([0.12, 0.12, 0.05, 0.22, 0.3, 0.2, 0xc084fc]);
            break;
        case 'mite':
            // tiny, fast, all eyes: a glowing sac on its back
            k.torsoGlow.push([0.3, 0.3, 0.1, 0, 2.0, -hd - 0.04, 0xd8b4fe]);
            break;
        case 'screamer':
            // the shrieker: jaw hanging wide open on a glowing throat, wild hair, torn shroud
            k.headGlow.push([0.44, 0.34, 0.04, 0, -0.3, 0.39, 0xff4d4d], [0.2, 0.12, 0.04, 0, -0.52, 0.37, 0xff8a8a]);
            H.push([0.5, 0.06, 0.04, 0, -0.1, 0.4, BONE], [0.5, 0.06, 0.04, 0, -0.5, 0.4, BONE]);
            T.push([1.08 * sl, 0.9, 0.62 * sl, 0, 1.55, 0, cloth], [0.4, 0.5, 0.02, -0.2, 1.4, hd + 0.02, clothD]);
            k.torsoGlow.push([0.2, 0.3, 0.04, 0, 2.3, hd + 0.02, 0xff4d4d]);
            break;
        case 'jugg': {
            // walking siege engine: riveted chest plate, huge pauldrons, a bucket helm with a glowing slit, iron gauntlets
            const PL = 0x57534e, PLD = 0x3a3633, RIV = 0xa8a29e;
            T.push([1.12 * sl, 1.0, 0.14, 0, 1.88, hd + 0.06, PL], [1.12 * sl, 1.0, 0.14, 0, 1.88, -hd - 0.06, PLD], [1.16 * sl, 0.12, 0.7 * sl, 0, 1.4, 0, PLD]);
            for (const x of [-0.4, 0, 0.4]) T.push([0.08, 0.08, 0.04, x * sl, 2.28, hd + 0.14, RIV], [0.08, 0.08, 0.04, x * sl, 1.48, hd + 0.14, RIV]);
            T.push([0.8, 0.46, 0.92, -0.86, 2.46, 0, PL], [0.8, 0.46, 0.92, 0.86, 2.46, 0, PL], [0.84, 0.1, 0.96, -0.86, 2.24, 0, PLD], [0.84, 0.1, 0.96, 0.86, 2.24, 0, PLD]);
            T.push([0.14, 0.4, 0.14, -0.95, 2.82, 0, RIV, 0, 0, 0.3], [0.14, 0.4, 0.14, 0.95, 2.82, 0, RIV, 0, 0, -0.3]);
            k.torsoGlow.push([0.36, 0.08, 0.04, 0, 1.7, hd + 0.135, eye], [0.2, 0.2, 0.06, 0, 1.95, -hd - 0.14, eye]);
            H.push([0.86, 0.56, 0.84, 0, 0.12, 0, PL], [0.9, 0.08, 0.88, 0, 0.42, 0, PLD], [0.9, 0.1, 0.88, 0, -0.16, 0, PLD], [0.08, 0.5, 0.06, 0, 0.12, 0.43, PLD]);
            k.headGlow.push([0.62, 0.07, 0.04, 0, 0.06, 0.435, eye]);
            for (const A of [k.armL, k.armR]) A.push([0.48, 0.56, 0.48, 0, -0.95, 0, PL], [0.52, 0.1, 0.52, 0, -0.66, 0, PLD], [0.4, 0.3, 0.44, 0, -1.22, 0.02, PLD]);
            eyes = false;
            break;
        }
        case 'brood': {
            // bloated spider-queen: a huge glowing egg abdomen on her back, extra legs out of the ribs, a crown of little eyes, mandibles
            T.push([1.3, 1.05, 1.15, 0, 1.55, -0.8, skin], [1.0, 0.8, 0.9, 0, 1.6, -1.35, skinD], [0.5, 0.06, 0.02, 0, 1.75, -1.82, rot]);
            for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) T.push([0.1, 1.1, 0.1, sd * 0.78, 1.55 + i * 0.22, -0.2 - i * 0.18, skinD, 0, 0, sd * (0.9 + i * 0.15)], [0.08, 0.7, 0.08, sd * 1.25, 1.0 + i * 0.22, -0.2 - i * 0.18, BONE, 0, 0, -sd * 0.25]);
            extra = { size: [0.9, 0.7, 0.8], pos: [0, 1.7, -1.0], color: 0xbef264 };
            for (let i = 0; i < 5; i++) k.torsoGlow.push([0.16, 0.16, 0.06, (i - 2) * 0.24, 1.3 + (i % 2) * 0.4, -1.92, 0xd9f99d]);
            for (const [x, y] of [[-0.24, 0.18], [0.24, 0.18], [-0.1, 0.28], [0.1, 0.28], [-0.3, 0.02], [0.3, 0.02]]) k.headGlow.push([0.09, 0.09, 0.03, x, y, 0.385, eye]);
            H.push([0.1, 0.32, 0.1, -0.2, -0.46, 0.36, BONE, 0.4, 0, 0.3], [0.1, 0.32, 0.1, 0.2, -0.46, 0.36, BONE, 0.4, 0, -0.3]);
            eyes = false;
            break;
        }
        case 'pyro':
            // a walking furnace: charred skin split by glowing lava cracks, a molten core in the chest, a crown of fire, burning fists
            extra = { size: [0.44, 0.44, 0.2], pos: [0, 1.95, 0.36], color: 0xffb020 };
            for (const [x, y, w, h] of [[-0.3, 1.6, 0.05, 0.5], [0.3, 2.2, 0.05, 0.36], [0.1, 1.45, 0.4, 0.05], [-0.15, 2.3, 0.3, 0.05]]) k.torsoGlow.push([w, h, 0.03, x * sl, y, hd + 0.02, 0xff6a1f]);
            for (const [x, y] of [[-0.2, 1.7], [0.15, 2.05], [0, 1.4]]) k.torsoGlow.push([0.05, 0.4, 0.03, x * sl, y, -hd - 0.02, 0xff6a1f]);
            for (let i = 0; i < 5; i++) k.headGlow.push([0.12, 0.3 + (i % 2) * 0.22, 0.12, (i - 2) * 0.17, 0.52 + (i % 2) * 0.1, 0, i % 2 ? 0xffd24d : 0xff6a1f]);
            k.headGlow.push([0.4, 0.06, 0.03, 0, -0.24, 0.385, 0xff8a1f], [0.04, 0.3, 0.03, -0.25, 0.1, 0.385, 0xff6a1f]);
            k.armLGlow = [[0.34, 0.3, 0.36, 0, -1.18, 0.02, 0xff8a1f], [0.04, 0.5, 0.03, 0, -0.5, 0.15, 0xff6a1f]];
            k.armRGlow = [[0.34, 0.3, 0.36, 0, -1.18, 0.02, 0xff8a1f], [0.04, 0.5, 0.03, 0, -0.6, 0.15, 0xff6a1f]];
            T.push([0.55, 0.3, 0.7, -0.72, 2.4, 0, BLACK], [0.55, 0.3, 0.7, 0.72, 2.4, 0, BLACK]);
            break;
        case 'phantom':
            // tall hooded wraith: a long tattered coat, a deep hood hiding the face, glowing eyes and long blade claws
            T.push([1.06 * sl, 1.5, 0.64 * sl, 0, 1.45, 0, cloth], [0.24, 0.6, 0.04, -0.3, 0.55, hd + 0.04, clothD], [0.3, 0.5, 0.04, 0.25, 0.6, -hd - 0.04, clothD]);
            T.push([0.8, 0.5, 0.7, 0, 2.5, -0.1, clothD]);
            H.push([0.9, 0.9, 0.36, 0, 0.06, -0.26, clothD], [0.9, 0.24, 0.92, 0, 0.46, 0, clothD], [0.12, 0.9, 0.92, -0.42, 0.06, 0, clothD], [0.12, 0.9, 0.92, 0.42, 0.06, 0, clothD], [0.6, 0.62, 0.03, 0, -0.02, 0.39, BLACK]);
            for (const A of [k.armL, k.armR]) for (const fx of [-0.1, 0, 0.1]) A.push([0.05, 0.8, 0.1, fx, -1.75, 0.12, 0xcbd5e1, 0.3, 0, 0]);
            k.armRGlow = [[0.02, 0.8, 0.11, 0, -1.75, 0.13, eye, 0.3, 0, 0]]; k.armLGlow = [[0.02, 0.8, 0.11, 0, -1.75, 0.13, eye, 0.3, 0, 0]];
            k.headGlow.push([0.14, 0.07, 0.03, -0.15, 0.04, 0.4, eye], [0.14, 0.07, 0.03, 0.15, 0.04, 0.4, eye]);
            eyes = false;
            break;
        case 'warlord': {
            // zombie general: armored vest, crossed ammo belts, an officer cap with a red star, and a MINIGUN for a right arm
            const OL = 0x3a4a22, AM = 0xc9a227;
            T.push([1.08 * sl, 0.9, 0.66 * sl, 0, 1.9, 0, OL], [0.12, 1.2, 0.06, 0, 1.9, hd + 0.08, 0x5c4a2a, 0, 0, 0.6], [0.12, 1.2, 0.06, 0, 1.9, hd + 0.09, 0x5c4a2a, 0, 0, -0.6]);
            for (let i = 0; i < 5; i++) T.push([0.07, 0.14, 0.04, -0.34 + i * 0.17, 1.62 + i * 0.12, hd + 0.12, AM]);
            T.push([0.66, 0.34, 0.84, -0.8, 2.42, 0, OL], [0.66, 0.34, 0.84, 0.8, 2.42, 0, OL], [0.3, 0.06, 0.3, -0.8, 2.6, 0.1, AM]);
            H.push([0.84, 0.18, 0.84, 0, 0.44, 0, OL], [0.84, 0.05, 0.32, 0, 0.36, 0.5, BLACK], [0.86, 0.06, 0.86, 0, 0.34, 0, 0x5c4a2a]);
            k.headGlow.push([0.14, 0.14, 0.03, 0, 0.45, 0.43, 0xff2020]);
            k.armR = [[0.4, 0.4, 0.44, 0, -0.05, 0, OL], [0.5, 1.0, 0.5, 0, -0.75, 0, IRON], [0.56, 0.18, 0.56, 0, -1.2, 0, BLACK],
                      [0.11, 0.9, 0.11, -0.13, -1.75, -0.13, BLACK], [0.11, 0.9, 0.11, 0.13, -1.75, -0.13, BLACK], [0.11, 0.9, 0.11, -0.13, -1.75, 0.13, BLACK], [0.11, 0.9, 0.11, 0.13, -1.75, 0.13, BLACK],
                      [0.4, 0.08, 0.4, 0, -2.1, 0, IRON], [0.3, 0.5, 0.2, 0.36, -0.8, 0, 0x5c4a2a]];
            k.armRGlow = [[0.36, 0.04, 0.36, 0, -2.2, 0, 0xff6a1f]];
            break;
        }
        case 'titan': {
            // living mountain: stone plates grown over its shoulders, boulders on its back, moss, glowing amber cracks, fists like rocks
            const ST = 0x78716c, STD = 0x57534e, MOSS = 0x4d7c0f;
            T.push([0.8, 0.6, 1.0, -0.84, 2.45, 0, ST, 0, 0, 0.2], [0.8, 0.6, 1.0, 0.84, 2.45, 0, ST, 0, 0, -0.2], [0.6, 0.12, 0.7, -0.8, 2.78, 0, MOSS], [0.5, 0.12, 0.6, 0.85, 2.76, 0.05, MOSS]);
            T.push([0.9, 0.8, 0.6, -0.2, 2.1, -0.55, STD, 0.2, 0.3, 0], [0.7, 0.6, 0.5, 0.35, 1.6, -0.5, ST, 0, 0.5, 0.2], [1.0, 0.5, 0.2, 0, 1.75, hd + 0.08, ST]);
            k.torsoGlow.push([0.05, 0.6, 0.03, -0.2, 1.9, hd + 0.19, 0xfbbf24], [0.4, 0.05, 0.03, 0.1, 1.65, hd + 0.19, 0xfbbf24], [0.05, 0.4, 0.03, 0.3, 2.2, -hd - 0.02, 0xfbbf24]);
            for (const A of [k.armL, k.armR]) A.push([0.64, 0.64, 0.64, 0, -1.15, 0, STD], [0.5, 0.4, 0.5, 0, -0.5, 0, ST], [0.3, 0.1, 0.3, 0, -0.25, 0.1, MOSS]);
            H.push([0.3, 0.3, 0.3, -0.25, 0.48, 0, ST, 0, 0, 0.3], [0.34, 0.34, 0.34, 0.2, 0.5, -0.05, STD, 0, 0, -0.2], [0.8, 0.2, 0.8, 0, 0.36, 0, ST]);
            break;
        }
        case 'necro':
            // the lich: long robes, a skull face under a tall bone crown, a high spiked collar and a staff topped with a glowing orb
            T.push([1.1 * sl, 1.6, 0.72 * sl, 0, 1.4, 0, cloth], [1.16 * sl, 0.12, 0.76 * sl, 0, 0.62, 0, clothD], [0.2, 1.4, 0.04, 0, 1.5, hd + 0.08, 0x7c3aed]);
            T.push([0.2, 0.6, 0.1, -0.4, 2.7, -0.15, clothD, 0, 0, 0.3], [0.2, 0.6, 0.1, 0.4, 2.7, -0.15, clothD, 0, 0, -0.3], [0.9, 0.5, 0.1, 0, 2.6, -0.32, clothD]);
            for (let i = 0; i < 5; i++) H.push([0.08, 0.34 + (i % 2) * 0.24, 0.08, (i - 2) * 0.17, 0.56 + (i % 2) * 0.12, 0, BONE]);
            k.headGlow.push([0.1, 0.1, 0.1, 0, 0.82, 0, eye]);
            k.armR.push([0.09, 3.0, 0.09, 0, -0.9, 0.26, 0x3f2a1e], [0.2, 0.12, 0.2, 0, 0.5, 0.26, BONE]);
            k.armRGlow = [[0.3, 0.3, 0.3, 0, 0.72, 0.26, eye]];
            break;
        case 'acolyte':
            // kneeling cultist: hooded robe, hands raised to the Necromancer, a glowing rune on its chest
            T.push([1.04 * sl, 1.2, 0.66 * sl, 0, 1.55, 0, cloth]);
            H.push([0.84, 0.84, 0.3, 0, 0.06, -0.26, clothD], [0.84, 0.2, 0.86, 0, 0.44, 0, clothD], [0.1, 0.84, 0.86, -0.4, 0.06, 0, clothD], [0.1, 0.84, 0.86, 0.4, 0.06, 0, clothD]);
            k.torsoGlow.push([0.24, 0.24, 0.04, 0, 1.95, hd + 0.04, eye]);
            k.armLGlow = [[0.16, 0.16, 0.16, 0, -1.3, 0.08, eye]]; k.armRGlow = [[0.16, 0.16, 0.16, 0, -1.3, 0.08, eye]];
            break;
        case 'risen':
            // a raised skeleton: bare ribs front and back
            for (let i = 0; i < 4; i++) T.push([0.7 * sl, 0.05, 0.03, 0, 1.75 + i * 0.13, hd + 0.03, BONE], [0.7 * sl, 0.05, 0.03, 0, 1.75 + i * 0.13, -hd - 0.03, BONE]);
            break;
        case 'boss':
            // abomination: ribcage torn open over a glowing heart, bone crown, fangs, spine of glowing pustules, shoulder spikes
            T.push([0.36 * sl, 0.42, 0.02, 0.2 * sl, 1.98, hd + 0.012, HOLE]);
            for (let i = 0; i < 3; i++) T.push([0.32 * sl, 0.05, 0.03, 0.2 * sl, 1.84 + i * 0.12, hd + 0.024, BONE]);
            k.torsoGlow.push([0.26, 0.24, 0.06, 0, 1.96, hd + 0.01, eye]);
            for (let i = 0; i < 4; i++) k.torsoGlow.push([0.16, 0.16, 0.08, (i % 2 ? 0.08 : -0.08), 1.55 + i * 0.26, -hd - 0.03, eye]);
            T.push([0.6, 0.35, 0.8, -0.78, 2.4, 0, skinD], [0.6, 0.35, 0.8, 0.78, 2.4, 0, skinD], [0.12, 0.5, 0.12, -0.8, 2.72, -0.05, BONE, 0, 0, 0.4], [0.12, 0.5, 0.12, 0.8, 2.72, -0.05, BONE, 0, 0, -0.4]);
            for (const y of [1.55, 1.7]) T.push([0.5, 0.03, 0.02, 0.1, y, hd + 0.01, BLACK]);
            H.push([0.14, 0.62, 0.14, -0.3, 0.62, 0, BONE, 0, 0, 0.35], [0.14, 0.62, 0.14, 0.3, 0.62, 0, BONE, 0, 0, -0.35], [0.12, 0.44, 0.12, 0, 0.6, -0.1, BONE, -0.2, 0, 0]);
            k.headGlow.push([0.1, 0.1, 0.1, -0.41, 0.9, 0, eye], [0.1, 0.1, 0.1, 0.41, 0.9, 0, eye], [0.08, 0.08, 0.08, 0, 0.83, -0.17, eye]);
            H.push([0.07, 0.18, 0.05, -0.2, -0.22, 0.39, BONE], [0.07, 0.18, 0.05, 0.2, -0.22, 0.39, BONE]);
            for (const A of [k.armL, k.armR]) A.push([0.34, 0.1, 0.34, 0, -0.6, 0, IRON]);
            break;
    }
    bossExtras(id, k, { sl, hd, eye, BONE, IRON, BLACK, skin, skinD, cloth, clothD, rot });
    if (eyes) {
        const e = Z.bigEyes ? 0.13 : 0.09;
        k.headGlow.push([e * 0.7, e * 0.6, 0.03, -0.17, 0.05, 0.38, eye], [e * 1.15, e, 0.035, 0.18, 0.02, 0.382, eye]);
    }
    // how far forward the upper body hunches (the torso, arms and head hang off a hip joint)
    const hunch = { grunt: 0.22, sprinter: 0.34, tank: 0.12, spitter: 0.16, bomber: 0.06, charger: 0.3, leaper: 0.4, shielder: 0.06, marksman: 0.1, medic: 0.18, boss: 0.18, splitter: 0.08, mite: 0.42, screamer: 0.14, jugg: 0.1, brood: 0.3, pyro: 0.14, phantom: 0.26, warlord: 0.06, titan: 0.2, necro: 0.06, acolyte: 0.3, risen: 0.26, shambler: 0.38, hound: 1.5, crawler: 1.15, shocker: 0.12, zero: 0.3 }[id] ?? 0.2;
    return (enemyKits[cfg.id] = finishKit(cfg, k, s, sl, { id: cfg.id, hunch, rough: id === 'jugg' || id === 'warlord' ? 0.55 : 0.84, shield, extra, headZ: 0.06 }));
}
// 5.0 Zombie Hound: a four-legged dog. The body is the usual hip/torso/head rig tipped flat (hunch 1.5): the torso runs forward,
// the 'arms' are the front legs (they counter-rotate to hang down) and the 'legs' are the hind legs.
function houndKit(cfg) {
    const s = cfg.scale, Z = zLook(cfg), skin = Z.skin, skinD = darken(skin, 0.74), rot = darken(skin, 0.45), eye = cfg.eye;
    const BONE = 0xd9cfb0, BLOOD = 0x7a1414, HOLE = 0x140808, BLACK = 0x17181c;
    const k = { legL: [], legR: [], armL: [], armR: [], torso: [], head: [], torsoGlow: [], headGlow: [], armLGlow: [], armRGlow: [] };
    for (const [L, torn] of [[k.legL, false], [k.legR, true]]) {      // hind legs: thigh, hock, paw
        L.push([0.32, 0.56, 0.42, 0, -0.22, -0.04, skin], [0.2, 0.56, 0.22, 0, -0.74, 0.1, torn ? rot : skinD], [0.24, 0.14, 0.36, 0, -1.03, 0.2, skinD], [0.2, 0.05, 0.1, 0, -1.09, 0.4, BONE]);
        if (torn) L.push([0.07, 0.3, 0.02, 0.1, -0.7, 0.2, BONE], [0.12, 0.1, 0.02, 0, -0.5, 0.22, BLOOD]);
    }
    for (const A of [k.armL, k.armR]) A.push([0.3, 0.6, 0.32, 0, -0.3, 0, skin], [0.2, 0.55, 0.22, 0, -0.82, 0.04, skinD], [0.24, 0.14, 0.36, 0, -1.03, 0.12, skinD], [0.2, 0.05, 0.1, 0, -1.09, 0.32, BONE]);
    const T = k.torso;
    T.push([0.62, 1.5, 0.62, 0, 1.72, 0, skin], [0.66, 0.5, 0.66, 0, 1.3, 0, skinD], [0.72, 0.42, 0.68, 0, 2.2, 0, skinD]);
    for (let i = 0; i < 4; i++) T.push([0.66, 0.05, 0.46, 0, 1.55 + i * 0.17, 0.02, BONE]);
    for (let i = 0; i < 5; i++) T.push([0.1, 0.1, 0.14, 0, 1.2 + i * 0.28, -0.36, BONE]);
    T.push([0.02, 0.34, 0.3, 0.32, 1.62, 0.04, BLOOD], [0.02, 0.18, 0.16, -0.32, 1.85, 0.06, HOLE]);
    T.push([0.11, 0.8, 0.11, 0, 0.62, -0.24, skinD, 0.55, 0, 0], [0.12, 0.2, 0.12, 0, 0.3, -0.5, rot, 0.55, 0, 0]);       // tail
    const H = k.head;
    H.push([0.5, 0.56, 0.5, 0, 0, 0, skin], [0.3, 0.52, 0.26, 0, 0.5, 0.06, skinD], [0.26, 0.4, 0.07, 0, 0.5, 0.25, rot], [0.14, 0.08, 0.12, 0, 0.78, 0.04, BLACK]);
    for (const x of [-0.1, 0.1]) H.push([0.04, 0.08, 0.06, x, 0.58, 0.19, BONE], [0.04, 0.06, 0.06, x * 1.3, 0.62, 0.16, BONE]);
    H.push([0.1, 0.18, 0.16, -0.2, -0.14, -0.3, skinD], [0.1, 0.12, 0.14, 0.2, -0.14, -0.3, rot]);
    k.headGlow.push([0.12, 0.06, 0.1, -0.15, 0.27, -0.1, eye], [0.12, 0.06, 0.1, 0.15, 0.27, -0.1, eye]);
    return (enemyKits.hound = finishKit(cfg, k, s, 1, { id: 'hound', hunch: 1.5, rough: 0.84, headZ: -0.05, legX: 0.2, armX: 0.2 }));
}
// the Broodmother's egg sac: a lumpy, veiny, glowing blob on a puddle of goo (no real arms or legs)
function eggKit(cfg) {
    const s = cfg.scale, Z = zLook(cfg), skin = Z.skin, skinD = darken(skin, 0.7), vein = darken(skin, 0.45), G = 0xd9f99d;
    const nub = (y) => [[0.04, 0.04, 0.04, 0, y, 0, skinD]];
    const k = { legL: nub(-0.5), legR: nub(-0.5), armL: nub(-0.3), armR: nub(-0.3), torso: [], head: [], torsoGlow: [], headGlow: [] };
    k.torso.push([1.7, 0.08, 1.7, 0, 0.04, 0, 0x3f6212], [1.15, 1.2, 1.15, 0, 0.7, 0, skin], [1.3, 0.7, 0.95, 0, 0.65, 0, skinD], [0.95, 0.5, 0.95, 0, 1.45, 0, skin], [0.55, 0.3, 0.55, 0, 1.78, 0, skinD]);
    k.torso.push([0.05, 1.0, 0.03, -0.25, 0.9, 0.59, vein], [0.05, 0.8, 0.03, 0.3, 0.8, -0.59, vein], [0.03, 0.9, 0.05, 0.59, 0.85, 0.1, vein]);
    for (const [x, y, z] of [[-0.3, 0.8, 0.6], [0.32, 1.1, 0.6], [0.05, 0.5, -0.6], [0.6, 0.6, -0.2], [-0.6, 1.0, 0.1]]) k.torsoGlow.push([0.2, 0.2, 0.2, x, y, z, G]);
    k.head.push([0.32, 0.3, 0.32, 0, -0.9, 0, skinD]); k.headGlow.push([0.12, 0.08, 0.34, 0, -0.84, 0, G]);
    return finishKit(cfg, k, s, 1, { id: cfg.id, hunch: 0, rough: 0.6, extra: { size: [0.7, 0.7, 0.7], pos: [0, 0.9, 0], color: 0xbef264 }, headZ: 0 });
}
// build the merged part meshes. Torso (and anything riding on it) is stored relative to the hip joint.
function finishKit(cfg, k, s, sl, o) {
    const kit = { s, sl, id: o.id, hunch: o.hunch, rough: o.rough, headZ: o.headZ, legX: o.legX, armX: o.armX };
    for (const key of ['legL', 'legR']) kit[key] = partsGeo(k[key], s, k[key + 'Glow'] || []);
    kit.armL = partsGeo(k.armL, s, k.armLGlow || []); kit.armR = partsGeo(k.armR, s, k.armRGlow || []);
    kit.torso = partsGeo(k.torso, s, k.torsoGlow); kit.torso.translate(0, -HIP_Y * s, 0);
    kit.head = partsGeo(k.head, s, k.headGlow);
    kit.shield = o.shield || null;
    if (o.extra) {
        const g = new THREE.BoxGeometry(o.extra.size[0] * s, o.extra.size[1] * s, o.extra.size[2] * s);
        kit.extra = { geo: g, pos: [o.extra.pos[0] * s, (o.extra.pos[1] - HIP_Y) * s, o.extra.pos[2] * s] };
        extraMats[cfg.id] = extraMats[cfg.id] || new THREE.MeshBasicMaterial({ color: o.extra.color, toneMapped: false });
    }
    return kit;
}
const HIP_Y = 1.1;
// The caged ram keeps the classic pre-zombie Charger look (blocky brute with horns)
function classicKit(cfg) {
    const key = 'classic_' + cfg.id;
    if (enemyKits[key]) return enemyKits[key];
    const s = cfg.scale, sl = cfg.slim || 1;
    const body = cfg.color, dark = darken(cfg.color, 0.45), eye = cfg.eye || 0xfff4a8, mid = darken(cfg.color, 0.72);
    const light = new THREE.Color(cfg.color).lerp(new THREE.Color(0xffffff), 0.28).getHex(), black = 0x17181c;
    const k = { legL: [], legR: [], armL: [], armR: [], torso: [], head: [], torsoGlow: [], headGlow: [] };
    for (const L of [k.legL, k.legR]) L.push([0.38 * sl, 1.1, 0.4 * sl, 0, -0.55, 0, dark], [0.42 * sl, 0.22, 0.55 * sl, 0, -1.0, 0.06, body],
        [0.44 * sl, 0.16, 0.1, 0, -0.55, 0.2, mid], [0.42 * sl, 0.12, 0.2, 0, -1.05, 0.3, dark],
        [0.46 * sl, 0.07, 0.6 * sl, 0, -1.12, 0.06, black], [0.3 * sl, 0.05, 0.12, 0, -0.93, 0.34, light], [0.4 * sl, 0.3, 0.06, 0, -0.78, 0.22, mid], [0.4 * sl, 0.08, 0.42 * sl, 0, -0.02, 0, black],
        [0.46, 0.5, 0.5, 0, -0.3, 0, body]);
    k.torso.push([1.0 * sl, 1.25, 0.58 * sl, 0, 1.72, 0, body], [1.04 * sl, 0.16, 0.62 * sl, 0, 1.16, 0, dark],
        [0.9 * sl, 0.45, 0.08, 0, 2.05, 0.3, mid], [0.34, 0.2, 0.32, 0, 2.42, 0, dark], [0.2, 0.12, 0.05, 0, 1.16, 0.33, 0xc9a227], [0.7 * sl, 0.1, 0.06, 0, 1.55, 0.3, mid],
        [0.22, 0.22, 0.14, -0.33 * sl, 1.3, 0.33, mid], [0.22, 0.22, 0.14, 0.33 * sl, 1.3, 0.33, mid], [0.22, 0.18, 0.12, 0, 1.3, -0.33, mid],
        [0.14, 0.9, 0.05, -0.28 * sl, 1.85, 0.31, dark], [0.14, 0.9, 0.05, 0.28 * sl, 1.85, 0.31, dark], [0.64, 0.14, 0.5, 0, 2.35, 0, mid], [0.14, 0.9, 0.06, 0, 1.8, -0.31, dark],
        [1.35, 0.6, 0.85, 0, 2.2, -0.08, dark]);
    for (const A of [k.armL, k.armR]) A.push([0.3, 1.05, 0.3, 0, -0.45, 0, dark], [0.34, 0.26, 0.34, 0, -1.0, 0, body],
        [0.4, 0.28, 0.4, 0, -0.02, 0, body], [0.33, 0.08, 0.33, 0, -0.5, 0, mid], [0.12, 0.12, 0.1, 0.12, -0.96, 0.13, body],
        [0.36, 0.22, 0.36, 0, -0.72, 0, mid], [0.36, 0.08, 0.1, 0, -1.08, 0.14, light], [0.08, 0.1, 0.1, -0.1, -1.16, 0.14, dark], [0.08, 0.1, 0.1, 0, -1.17, 0.15, dark], [0.08, 0.1, 0.1, 0.1, -1.16, 0.14, dark]);
    k.head.push([0.78, 0.78, 0.78, 0, 0, 0, body], [0.4, 0.07, 0.05, 0, -0.22, 0.4, dark],
        [0.62, 0.08, 0.07, 0, 0.18, 0.4, dark], [0.1, 0.14, 0.08, 0, -0.03, 0.43, mid], [0.06, 0.2, 0.16, -0.41, 0, 0, mid], [0.06, 0.2, 0.16, 0.41, 0, 0, mid], [0.5, 0.08, 0.05, 0, -0.33, 0.38, mid],
        [0.5, 0.14, 0.1, 0, -0.29, 0.38, light], [0.12, 0.06, 0.04, -0.12, -0.27, 0.43, 0xf8fafc], [0.12, 0.06, 0.04, 0.12, -0.27, 0.43, 0xf8fafc],
        [0.26, 0.2, 0.03, -0.19, 0.07, 0.395, black], [0.26, 0.2, 0.03, 0.19, 0.07, 0.395, black], [0.8, 0.1, 0.8, 0, 0.4, 0, mid], [0.6, 0.3, 0.06, 0, 0.05, -0.41, dark],
        [0.14, 0.14, 0.55, -0.42, 0.2, 0.18, 0xf5e6c8, 0, 0.5, 0], [0.14, 0.14, 0.55, 0.42, 0.2, 0.18, 0xf5e6c8, 0, -0.5, 0]);
    k.headGlow.push([0.22, 0.05, 0.05, 0, -0.1, 0.42, 0xfbbf24], [0.16, 0.12, 0.05, -0.19, 0.07, 0.4, eye], [0.16, 0.12, 0.05, 0.19, 0.07, 0.4, eye]);
    return (enemyKits[key] = finishKit(cfg, k, s, sl, { id: key, hunch: 0, rough: 0.62, headZ: 0 }));
}


const _arcMat = new THREE.MeshBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const _laserMat = new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const _auraMat = new THREE.MeshBasicMaterial({ map: null, color: 0x4ade80, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, toneMapped: false });
const _auraGeo = new THREE.RingGeometry(0.94, 1, 48); _auraGeo.rotateX(-Math.PI / 2);


// ---------- ZOMBIE INSTANCING ----------
// Enemies keep their normal part meshes for hit detection and animation, but those meshes sit on a hidden
// layer. Every frame their world matrices are copied into ONE InstancedMesh per (model, body part), so all
// the zombies of a type draw in ~6 draw calls total instead of ~7 each. Per-instance: skin tint + hit flash.
const ENEMY_LAYER = 3;
const zombieSet = new Set();
const ZI = { sets: new Map(), mats: new Map() };
function enemyInstShader(sh) {
    enemyGlowShader(sh);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float iFlash;\nvarying float vFlash;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlash = iFlash;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFlash;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vFlash > 1.5 ? vec3(0.08, 0.24, 0.95) : vec3(vFlash);');      // 4.0: 2 = tesla zap (electric blue)
}
function ziMat(kit, boss) {        // boss = the boss's glow colour (0 for normal zombies)
    const key = (kit.rough + (boss ? 'b' + boss : '')) + (Q.lite ? 'L' : 'S');
    if (ZI.mats.has(key)) return ZI.mats.get(key);
    const m = Q.lite ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: kit.rough, metalness: 0, envMapIntensity: theme.envInt * 0.6 });
    if (boss) { m.emissive.setHex(boss); m.emissiveIntensity = 0.6; }
    m.onBeforeCompile = enemyInstShader;
    m.customProgramCacheKey = () => 'zinst';
    ZI.mats.set(key, m);
    return m;
}
function ziSet(kit, part, boss, need) {
    const key = kit.id + '|' + part;
    let z = ZI.sets.get(key);
    if (z && z.cap >= need) return z;
    let cap = z ? z.cap : 8; while (cap < need) cap *= 2;
    if (z) { scene.remove(z.mesh); z.mesh.dispose(); }
    const geo = kit[part].clone();
    const flash = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1); flash.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iFlash', flash);
    const mesh = new THREE.InstancedMesh(geo, ziMat(kit, boss), cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, _col.setRGB(1, 1, 1)); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false; mesh.count = 0;
    mesh.castShadow = Q.enemyShadows >= ((part === 'torso' || part === 'head') ? 1 : 2);
    scene.add(mesh);
    z = { mesh, flash, cap, n: 0, part, kit, boss };
    ZI.sets.set(key, z);
    return z;
}
// quality changed (fast lighting / shadows): rebuild the shared materials + shadow flags
function ziReset() {
    for (const z of ZI.sets.values()) { scene.remove(z.mesh); z.mesh.geometry.dispose(); z.mesh.dispose(); }
    for (const m of ZI.mats.values()) m.dispose();
    ZI.sets.clear(); ZI.mats.clear();
    for (const k of ZM.kinds.values()) { scene.remove(k.mesh); k.mesh.geometry.dispose(); k.mesh.dispose(); }
    for (const m of ZM.mats.values()) m.dispose();
    ZM.kinds.clear(); ZM.mats.clear();
}
// ---------- 5.1: ONE DRAW CALL PER ZOMBIE TYPE ----------
// A type's 6 body parts are merged into one mesh (each vertex knows its part), and every visible zombie's 6 part
// matrices go into one float texture that the vertex shader reads (WebGL2). A type then costs 1 draw call and 2 small
// uploads instead of 6 draw calls and 18 uploads, which was a big share of each frame on a slow Chromebook processor.
// Without WebGL2 the per-part sets above are used.
const ZM_PARTS = ['legL', 'legR', 'torso', 'armL', 'armR', 'head'], ZM_PI = { legL: 0, legR: 1, torso: 2, armL: 3, armR: 4, head: 5 };
const ZM = { kinds: new Map(), geos: new Map(), mats: new Map(), tex: null, data: null, rows: 0, texU: { value: null }, depth: null };
const zmOn = () => renderer.capabilities.isWebGL2;
const _zmHide = new Float32Array(16); _zmHide[15] = 1;      // a part that's gone (head shot off): squashed to a point
function zmVert(sh) {
    sh.uniforms.zMatTex = ZM.texU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aPart;\nattribute vec2 iData;\nuniform highp sampler2D zMatTex;\nmat4 zMat;\n#define instanceMatrix zMat')
        .replace('void main() {', 'void main() {\n{ int zr = int(iData.y + 0.5), zp = int(aPart + 0.5) * 4; zMat = mat4(texelFetch(zMatTex, ivec2(zp, zr), 0), texelFetch(zMatTex, ivec2(zp + 1, zr), 0), texelFetch(zMatTex, ivec2(zp + 2, zr), 0), texelFetch(zMatTex, ivec2(zp + 3, zr), 0)); }');
}
function zmShader(sh) {
    enemyGlowShader(sh); zmVert(sh);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vFlash;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlash = iData.x;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFlash;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vFlash > 1.5 ? vec3(0.08, 0.24, 0.95) : vec3(vFlash);');
}
function zmMat(kit, boss) {
    const key = (kit.rough + (boss ? 'b' + boss : '')) + (Q.lite ? 'L' : 'S');
    if (ZM.mats.has(key)) return ZM.mats.get(key);
    const m = Q.lite ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: kit.rough, metalness: 0, envMapIntensity: theme.envInt * 0.6 });
    if (boss) { m.emissive.setHex(boss); m.emissiveIntensity = 0.6; }
    m.onBeforeCompile = zmShader;
    m.customProgramCacheKey = () => 'zmerge';
    ZM.mats.set(key, m);
    return m;
}
function zmDepth() {
    if (ZM.depth) return ZM.depth;
    const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    m.onBeforeCompile = zmVert; m.customProgramCacheKey = () => 'zmdepth';
    return (ZM.depth = m);
}
function zmGeo(kit) {
    let g = ZM.geos.get(kit.id);
    if (g) return g;
    const parts = ZM_PARTS.map((p, i) => { const pg = kit[p].clone(); pg.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(pg.attributes.position.count).fill(i), 1)); return pg; });
    g = mergeGeometries(parts, false); parts.forEach(pg => pg.dispose());
    ZM.geos.set(kit.id, g);
    return g;
}
function zmKind(kit, boss, need) {
    let k = ZM.kinds.get(kit.id);
    if (k && k.cap >= need) return k;
    let cap = k ? k.cap : 8; while (cap < need) cap *= 2;
    if (k) { scene.remove(k.mesh); k.mesh.geometry.dispose(); k.mesh.dispose(); }
    const geo = zmGeo(kit).clone();
    const data = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2); data.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iData', data);
    const mesh = new THREE.InstancedMesh(geo, zmMat(kit, boss), cap);
    mesh.setColorAt(0, _zc.setRGB(1, 1, 1)); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false; mesh.count = 0;
    mesh.castShadow = Q.enemyShadows >= 1; mesh.customDepthMaterial = zmDepth();
    scene.add(mesh);
    k = { mesh, data, cap, n: 0 };
    ZM.kinds.set(kit.id, k);
    return k;
}
function zmTex(rows) {
    if (ZM.tex && ZM.rows >= rows) return;
    let r = ZM.rows || 32; while (r < rows) r *= 2;
    if (ZM.tex) ZM.tex.dispose();
    ZM.data = new Float32Array(24 * 4 * r);           // a row per zombie: 6 matrices x 4 texels
    ZM.tex = new THREE.DataTexture(ZM.data, 24, r, THREE.RGBAFormat, THREE.FloatType);
    ZM.rows = r; ZM.texU.value = ZM.tex;
}
function zmUpdate() {
    const need = _ziNeed; need.clear();
    let rows = 0;
    for (const e of zombieSet) {
        if (!e.parent || !e.visible || !ziInView(e)) continue;
        const id = e.userData.kit.id; need.set(id, (need.get(id) || 0) + 1); rows++;
    }
    for (const k of ZM.kinds.values()) k.n = 0;
    if (rows) zmTex(rows);
    let row = 0;
    for (const e of zombieSet) {
        if (!e.parent || !e.visible || !ziInView(e)) continue;
        const u = e.userData, k = zmKind(u.kit, u.config.glow || 0, need.get(u.kit.id)), base = row * 96;
        for (const p of u.iparts) ZM.data.set(p.mesh.visible ? p.mesh.matrixWorld.elements : _zmHide, base + ZM_PI[p.part] * 16);
        k.mesh.setColorAt(k.n, u.tint);
        k.data.array[k.n * 2] = u.zapT > gameTime ? 2 : (u.flash > 0 ? 0.8 : 0); k.data.array[k.n * 2 + 1] = row;
        k.n++; row++;
    }
    for (const k of ZM.kinds.values()) {
        k.mesh.count = k.n; k.mesh.visible = k.n > 0;
        if (k.n) { const c = k.mesh.instanceColor; c.addUpdateRange(0, k.n * 3); c.needsUpdate = true; k.data.addUpdateRange(0, k.n * 2); k.data.needsUpdate = true; }
    }
    if (row) ZM.tex.needsUpdate = true;
}
const _zc = new THREE.Color();
const _ziNeed = new Map(), _ziFwd = new V3();
let _ziCx = 0, _ziCz = 0, _ziFx = 0, _ziFz = 0, _ziCos = -2;
// cheap view culling: zombies well outside the camera's side-to-side view (and not close) aren't written into the instance buffers
function ziInView(e) {
    const dx = e.position.x - _ziCx, dz = e.position.z - _ziCz, d2 = dx * dx + dz * dz;
    if (d2 < 100) return true;
    return (dx * _ziFx + dz * _ziFz) > _ziCos * Math.sqrt(d2);
}
function updateZombieInstances() {
    camera.getWorldDirection(_ziFwd);
    const fl = Math.hypot(_ziFwd.x, _ziFwd.z);
    if (fl > 0.2) {
        _ziFx = _ziFwd.x / fl; _ziFz = _ziFwd.z / fl; _ziCx = camera.position.x; _ziCz = camera.position.z;
        const halfH = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
        _ziCos = Math.cos(Math.min(3.1, halfH + (Q.shadows ? 0.95 : 0.55)));
    } else _ziCos = -2;      // looking straight up / down: draw everything
    if (zmOn()) { zmUpdate(); updateXray(); return; }
    // count first so each set is big enough, then fill (cached keys + one reused Map: nothing is allocated per frame)
    const need = _ziNeed; need.clear();
    for (const e of zombieSet) {
        if (!e.parent || !e.visible || !ziInView(e)) continue;
        const ip = e.userData.iparts, id = e.userData.kit.id;
        for (let i = 0; i < ip.length; i++) { const p = ip[i], k = p.k || (p.k = id + '|' + p.part); need.set(k, (need.get(k) || 0) + 1); }
    }
    for (const z of ZI.sets.values()) z.n = 0;
    for (const e of zombieSet) {
        if (!e.parent || !e.visible || !ziInView(e)) continue;
        const u = e.userData;     // its matrices are fresh: frame() updates the whole scene just before this (once, not twice)
        const fl = u.zapT > gameTime ? 2 : (u.flash > 0 ? 0.8 : 0);
        for (const p of u.iparts) {
            if (!p.mesh.visible) continue;
            const z = ziSet(u.kit, p.part, u.config.glow || 0, need.get(p.k));
            z.mesh.setMatrixAt(z.n, p.mesh.matrixWorld);
            z.mesh.setColorAt(z.n, u.tint);
            z.flash.array[z.n] = fl;
            z.n++;
        }
    }
    for (const z of ZI.sets.values()) {
        z.mesh.count = z.n; z.mesh.visible = z.n > 0;
        if (z.n) { instUpload(z.mesh, z.n); z.flash.addUpdateRange(0, z.n); z.flash.needsUpdate = true; }
    }
    updateXray();
}
// ---------- 4.0 RECON MARKS: X-RAY OUTLINES ----------
// A marked zombie gets a glowing copy of its body drawn on top of everything (so you see it through walls): brightest
// along its edges, like an outline. Same part geometry as the instances above, one extra InstancedMesh per part, and
// only while something is marked - nothing at all runs when nobody is marked.
const XR = { sets: new Map(), need: new Map(), on: false, mat: null };
const _xc = new THREE.Color();
function xrayMat() {
    if (XR.mat) return XR.mat;
    XR.mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: `varying float vRim; varying vec3 vCol;
            void main() {
                vec4 p = vec4(position, 1.0); vec3 n = normal;
                #ifdef USE_INSTANCING
                    p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
                #endif
                #ifdef USE_INSTANCING_COLOR
                    vCol = instanceColor;
                #else
                    vCol = vec3(1.0, 0.35, 0.25);
                #endif
                vec4 mv = modelViewMatrix * p;
                vRim = 1.0 - abs(dot(normalize(normalMatrix * n), normalize(-mv.xyz)));
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: `uniform float uTime; varying float vRim; varying vec3 vCol;
            void main() {
                // blocky bodies are mostly flat faces looking straight at you, so they get a solid see-through
                // fill (the silhouette) and the faces turned edge-on glow brighter (the outline)
                float r = pow(vRim, 2.2), k = 0.85 + 0.15 * sin(uTime * 9.0);
                gl_FragColor = vec4((vCol * (0.26 + 0.74 * r) + vec3(0.38) * r * r) * k, 1.0);
                #include <colorspace_fragment>
            }`,
        transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending
    });
    return XR.mat;
}
function xraySet(kit, part, key, need) {
    let z = XR.sets.get(key);
    if (z && z.cap >= need) return z;
    let cap = z ? z.cap : 8; while (cap < need) cap *= 2;
    if (z) { scene.remove(z.mesh); z.mesh.dispose(); }
    const mesh = new THREE.InstancedMesh(kit[part], xrayMat(), cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, _xc.setRGB(1, 1, 1)); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false; mesh.count = 0; mesh.renderOrder = 50;
    scene.add(mesh);
    z = { mesh, cap, n: 0 };
    XR.sets.set(key, z);
    return z;
}
const xrMarked = (e) => { const u = e.userData; return !!e.parent && !u.dead && u.markT > gameTime; };
function updateXray() {
    if (!(markUntil > gameTime)) {
        if (XR.on) { XR.on = false; for (const z of XR.sets.values()) { z.mesh.count = 0; z.mesh.visible = false; } }
        return;
    }
    XR.on = true;
    XR.need.clear();
    for (const e of zombieSet) {
        if (!xrMarked(e)) continue;
        for (const p of e.userData.iparts) { const k = p.xk || (p.xk = e.userData.kit.id + '|' + p.part); XR.need.set(k, (XR.need.get(k) || 0) + 1); }
    }
    for (const z of XR.sets.values()) z.n = 0;
    for (const e of zombieSet) {
        if (!xrMarked(e)) continue;
        const u = e.userData;
        if (!e.visible) e.updateMatrixWorld(true);         // cloaked (the Phantom): the normal pass skipped it
        _xc.setHex(u.config.boss ? 0xffc23c : 0xff4a32).multiplyScalar(Math.min(1, (u.markT - gameTime) / 0.6));
        for (const p of u.iparts) {
            if (!p.mesh.visible) continue;
            const z = xraySet(u.kit, p.part, p.xk, XR.need.get(p.xk));
            z.mesh.setMatrixAt(z.n, p.mesh.matrixWorld); z.mesh.setColorAt(z.n, _xc); z.n++;
        }
    }
    for (const z of XR.sets.values()) {
        z.mesh.count = z.n; z.mesh.visible = z.n > 0;
        if (z.n) instUpload(z.mesh, z.n);
    }
    XR.mat.uniforms.uTime.value = gameTime;
}


function createEnemy(cfg, opt = {}) {
    const kit = opt.classic ? classicKit(cfg) : enemyKit(cfg), s = kit.s, sl = kit.sl;
    const group = new THREE.Group();
    // stand-in "material": the real one is shared by the instanced meshes. Hit flash reads u.flash.
    const mat = { emissive: new THREE.Color(cfg.glow || 0), emissiveIntensity: cfg.glow ? 0.6 : 1, dispose() {} };
    const shadowParts = [], hitParts = [], iparts = [];
    const mk = (geo, parent, part, flags = {}) => {
        const m = new THREE.Mesh(geo, flags.mat || glowMat);
        m.userData = { parentEnemy: group, isHead: !!flags.head, isShield: !!flags.shield };
        if (part) { m.layers.set(ENEMY_LAYER); iparts.push({ mesh: m, part }); if (part !== 'head') m.matrixAutoUpdate = false; }     // limbs + torso never move on their pivot (the head nods)
        else { m.castShadow = Q.enemyShadows >= 1; if (m.castShadow) shadowParts.push(m); }
        parent.add(m); hitParts.push(m); return m;
    };
    const pivot = (parent, x, y, z) => { const p = new THREE.Group(); p.position.set(x * s, y * s, z * s); parent.add(p); return p; };


    const lx = kit.legX ?? 0.27 * sl, ax = kit.armX ?? 0.68 * sl;
    const legL = pivot(group, -lx, HIP_Y, 0), legR = pivot(group, lx, HIP_Y, 0);
    mk(kit.legL, legL, 'legL'); mk(kit.legR, legR, 'legR');
    legL.visible = legR.visible = false;      // their meshes only feed the instancing: the renderer needn't walk them
    // upper body hangs off the hips so it can hunch, sway and lurch
    const body = pivot(group, 0, HIP_Y, 0); body.rotation.x = kit.hunch;
    mk(kit.torso, body, 'torso');
    const armL = pivot(body, -ax, 2.2 - HIP_Y, 0), armR = pivot(body, ax, 2.2 - HIP_Y, 0);
    mk(kit.armL, armL, 'armL'); mk(kit.armR, armR, 'armR');
    armL.visible = armR.visible = false;
    const head = mk(kit.head, body, 'head', { head: true });
    head.position.set(0, (2.78 - HIP_Y) * s, kit.headZ * s);

    let extra = null, shield = null, laser = null, aura = null;
    if (kit.extra) { extra = new THREE.Mesh(kit.extra.geo, extraMats[cfg.id]); extra.position.fromArray(kit.extra.pos); body.add(extra); }
    if (kit.shield) {
        shield = mk(kit.shield, group, null, { shield: true, mat: Q.lite ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.6, envMapIntensity: theme.envInt }) });
        shield.position.set(0.05 * s, 1.55 * s, 0.78 * s);
    }
    if (cfg.ai === 'marksman') { laser = new THREE.Mesh(sharedBox, _laserMat.clone()); laser.visible = false; laser.frustumCulled = false; scene.add(laser); }
    let arcs = null;      // 5.0 Shocker: 3 lightning links, each drawn as a 2-piece zigzag
    if (cfg.ai === 'shocker') { arcs = []; for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(sharedBox, _arcMat); m.visible = false; m.frustumCulled = false; scene.add(m); arcs.push(m); } }
    let bubble = null;
    if (cfg.ai === 'necro') { bubble = new THREE.Mesh(_bubbleGeo, fxMat(0xa78bfa, 0.2)); bubble.scale.setScalar(2.3 * s); bubble.position.y = 1.7 * s; bubble.visible = false; group.add(bubble); }
    if (cfg.ai === 'medic' || cfg.ai === 'screamer') { aura = new THREE.Mesh(_auraGeo, _auraMat.clone()); aura.position.y = 0.06; aura.scale.setScalar(cfg.ai === 'screamer' ? 18 : 11); if (cfg.ai === 'screamer') aura.material.color.setHex(0xef4444); group.add(aura); }


    // HP bar: drawn by one shared instanced mesh for all enemies (see updateHpBars)
    const bw = 1.5 * Math.max(1, s * 0.8);
    // every zombie is a slightly different shade (instance colour, free)
    const tv = opt.classic ? 1 : 0.86 + Math.random() * 0.24;
    const tint = new THREE.Color(tv * (0.97 + Math.random() * 0.06), tv, tv * (0.95 + Math.random() * 0.08));


    group.userData = {
        isEnemy: true, velocityY: 0, onGround: false, dead: false,
        totalHeight: (cfg.id === 'hound' ? 1.8 : 3.2) * s, radius: 0.62 * s * (cfg.id === 'sprinter' ? 0.85 : 1),
        config: cfg, kit, iparts, tint, hitParts, shadowParts, far: false, legL, legR, armL, armR, head, body, extra, shield, laser, arcs, links: arcs ? [] : null, aura, bubble, barShow: false, barW: bw, barY: (cfg.id === 'hound' ? 1.9 : 3.6) * s + 0.3,
        mat, baseEmissive: mat.emissive.getHex(), baseEmissiveI: mat.emissiveIntensity, flash: 0,
        bodyY: HIP_Y * s, hitT: 0, hitSide: 1, hitHead: false, lodD: 0, walkPhase: Math.random() * 6, knock: new V3(), limp: 0.55 + Math.random() * 0.4, tilt: (Math.random() - 0.5) * 0.3, lurch: 0.7 + Math.random() * 0.6,
        wanderT: 0, wanderDir: new V3(), stuckT: 0, lastX: 0, lastZ: 0,
        attackCooldown: 0, shootCooldown: 1 + Math.random() * 2, fuse: -1,
        state: 'walk', stateT: 0, aiT: 1 + Math.random() * 2, losT: 0, lostT: 0, cdir: new V3(), air: new V3(), leaping: false, airT: 0,
        strafe: Math.random() < 0.5 ? 1 : -1, strafeT: 2 + Math.random() * 2, summonT: 10, slamT: 3, aimFrom: new V3(), aimTo: new V3()
    };
    zombieSet.add(group);
    return group;
}
// zombie shamble: uneven grasping arms and a drooping, lolling head (the right leg limps, see u.limp)
function zombieArms(u, reach, sw) {
    const p = Math.sin(u.walkPhase * 0.5);
    u.armL.rotation.x = reach + 0.14 + sw * 0.25; u.armR.rotation.x = reach - 0.1 - sw * 0.25;
    u.armL.rotation.z = -0.06 + p * 0.07; u.armR.rotation.z = 0.06 + p * 0.07;
}
function zombieHead(u) {
    u.head.rotation.z = u.tilt + Math.sin(u.walkPhase * 0.5) * 0.14;
    u.head.rotation.x = 0.18 + Math.sin(u.walkPhase) * 0.06;
    // the upper body lurches side to side and bobs with each step
    if (u.kit.hunch) { u.body.rotation.x = u.kit.hunch + Math.sin(u.walkPhase * 2) * 0.05 * u.lurch; u.body.rotation.z = Math.sin(u.walkPhase) * 0.08 * u.lurch; }
}
// Attack lunge, hit flinch and per-type ambient effects, layered on top of the walk cycle.
// The body leans into a swing, jerks back when shot (a headshot snaps the head back), and some types shed embers / acid / wisps.
const _ambP = new V3();
const AMBIENT = { pyro: [0xff8a1f, 'ember'], boss: [0xc084fc, 'mote'], necro: [0xa78bfa, 'mote'], phantom: [0x22d3ee, 'wisp'], spitter: [0xa3e635, 'drip'], bomber: [0xffb020, 'spark'], splitter: [0xc084fc, 'drip'], brood: [0xbef264, 'drip'], titan: [0x57534e, 'dust'], shocker: [0x7dd3fc, 'spark'] };
function animReact(u, e, delta, cfg) {
    const kit = u.kit;
    let a = u.armSwing > 0 ? Math.sin(Math.PI * Math.min(0.3, u.armSwing) / 0.3) : 0;
    const h = u.hitT > 0 ? Math.sin(Math.PI * Math.min(1, u.hitT / 0.24)) * (cfg.boss ? 0.35 : 1) : 0;
    if (u.hitT > 0) { u.hitT -= delta; if (u.hitT <= 0) { u.hitT = 0; if (!kit.hunch) { u.body.rotation.x = 0; u.body.rotation.z = 0; } u.body.rotation.y = 0; u.head.rotation.y = 0; } }
    if ((a > 0 || h > 0) && cfg.ai !== 'egg') {
        const b = u.body.rotation;
        b.x += 0.38 * a - 0.34 * h;
        b.z += u.hitSide * 0.22 * h;
        b.y = u.hitSide * 0.2 * h;
        u.head.rotation.x += 0.25 * a - (u.hitHead ? 0.8 : 0.3) * h;
        u.head.rotation.y = u.hitSide * (u.hitHead ? 0.5 : 0.2) * h;
        if (h > 0 && cfg.ai !== 'shielder' && cfg.ai !== 'marksman') { u.armL.rotation.x -= 0.5 * h; u.armR.rotation.x -= 0.5 * h; u.armL.rotation.z -= 0.3 * h; u.armR.rotation.z += 0.3 * h; }
    }
    // shambling bob: the whole upper body rises and falls with each step and twists against the legs
    if (cfg.ai !== 'egg' && u.onGround && u.hitT <= 0) { u.body.position.y = u.bodyY + Math.abs(Math.sin(u.walkPhase)) * 0.045 * kit.s; if (!cfg.boss) u.body.rotation.y = Math.sin(u.walkPhase) * 0.1 * u.lurch; }
    const am = AMBIENT[cfg.id];
    if (am && Q.particles > 300) {
        u.ambT = (u.ambT || 0) - delta;
        if (u.ambT <= 0 && u.lodD < 45) {
            u.ambT = 0.12 + Math.random() * 0.12;
            const sc = cfg.scale, kind = am[1];
            _ambP.set(e.position.x + (Math.random() - 0.5) * sc * 0.8, e.position.y + (kind === 'drip' ? 2.3 : kind === 'dust' ? 2.4 : 1 + Math.random() * 2) * sc, e.position.z + (Math.random() - 0.5) * sc * 0.8);
            if (kind === 'ember') { spawnParticles(_ambP, am[0], 1, 1.5, 0.9, 0.07 * sc, false, { grav: -3 }); if (Math.random() < 0.35) spawnSmoke(_ambP, 1, 0.5 * sc, 0.12, 1.2, 0.4, 1.0, 0.3); }
            else if (kind === 'wisp') spawnSmoke(_ambP, 1, 0.5 * sc, 0.06, 0.5, 0.5, 1.0, 0.35);
            else if (kind === 'drip') spawnParticles(_ambP, am[0], 1, 0.6, 0.6, 0.07 * sc, false, { grav: 12 });
            else if (kind === 'dust') spawnParticles(_ambP, 0x8a8378, 1, 0.8, 0.8, 0.09 * sc, true, { grav: 6 });
            else spawnParticles(_ambP, am[0], 1, 2, 0.5, 0.05 * sc, false, { grav: 2 });
        }
    }
}
function disposeEnemy(e) {
    const u = e.userData;
    zombieSet.delete(e);
    if (u.shield) u.shield.material.dispose();
    if (u.laser) { scene.remove(u.laser); u.laser.material.dispose(); }
    if (u.arcs) for (const m of u.arcs) scene.remove(m);
    if (u.aura) u.aura.material.dispose();
    if (u.bubble) u.bubble.material.dispose();
}
const _bubbleGeo = new THREE.IcosahedronGeometry(1, 1);


function pickEnemyType(level, counts) {
    const r = Math.random();
    let acc = 0;
    const table = [['sprinter', 0.14], ['tank', 0.09], ['charger', 0.08], ['spitter', 0.09], ['leaper', 0.09], ['bomber', 0.07], ['shielder', 0.08], ['marksman', 0.07], ['medic', 0.05], ['splitter', 0.06], ['screamer', 0.03], ['crawler', 0.035], ['shambler', 0.05], ['shocker', 0.03]];
    const sk = 0.9 * (twist && twist.special || 1);   // 3.8: two new types share the old odds; SPECIALISTS waves double them
    for (const [id, chance] of table) {
        const t = enemyTypes[id];
        if (level < t.minLvl) continue;
        acc += chance * sk;
        if (r < acc) { if (t.cap && (counts[id] || 0) >= t.cap) return enemyTypes.grunt; return t; }
    }
    return enemyTypes.grunt;
}


function spawnEnemy(cfg, x, z, y, baseSpeed, baseReward) {
    const enemy = createEnemy(cfg);
    enemy.position.set(x, y, z);
    const u = enemy.userData;
    // normal enemies have fixed health; the boss scales with the wave (2000 HP on wave 5, 10000 on wave 25)
    u.hp = ENEMY_BASE_HP * cfg.hp * bossHpMul(cfg); u.maxHp = u.hp;
    u.speed = baseSpeed * cfg.speed * DIFF().speed;
    u.reward = baseReward * cfg.reward;
    u.lastX = x; u.lastZ = z; u.dropping = true;
    if (cfg.id === 'crawler') {        // 5.0: starts hidden in a vent (or a manhole) and ambushes when you get close
        u.hidden = true; enemy.visible = false; u.wakeT = 16 + Math.random() * 14;
        const v = pickVent(x, z); if (v) { enemy.position.x = v[0]; enemy.position.z = v[1]; enemy.position.y = groundAt(v[0], v[1], 0, 6) + 0.05; u.lastX = v[0]; u.lastZ = v[1]; }
    }
    u.netId = netEnemySeq = (netEnemySeq % 65000) + 1; enemyById.set(u.netId, enemy);
    scene.add(enemy);
    enemies.push(enemy);
    if (cfg.boss) bossIntro(cfg);
    return enemy;
}
// 5.0 Zombie Hounds come in packs of 3-4: the first one spawned calls this to add its packmates around it (each gets its own side to circle from)
function spawnHoundPack(lead, x, z, y, spd, rew) {
    const n = (NET.inGame || Math.random() < 0.5) ? 3 : 4, ul = lead.userData;
    ul.packN = n; ul.packIdx = 0; ul.packDir = Math.random() < 0.5 ? 1 : -1; ul.aiT = 1 + Math.random() * 0.6;
    for (let i = 1; i < n && enemies.length < 70; i++) {
        const a = i / n * Math.PI * 2 + Math.random() * 0.5, m = spawnEnemy(enemyTypes.hound, x + Math.cos(a) * 2.2, z + Math.sin(a) * 2.2, y, spd, rew), um = m.userData;
        um.packN = n; um.packIdx = i; um.packDir = ul.packDir; um.aiT = 1 + i * 0.7 + Math.random() * 0.6;      // staggered, so they do not all pounce at once
    }
}
// vents (floor grates) that Vent Crawlers hide in: filled in by the map (Subway, Biolab); other maps use the spot the wave picked
function pickVent(x, z) {
    if (!ventSpots.length) return null;
    let best = null, bd = 1e9;
    for (const v of ventSpots) {
        if (Math.hypot(v[0] - camera.position.x, v[1] - camera.position.z) < 14) continue;
        const d = Math.hypot(v[0] - x, v[1] - z) + Math.random() * 10 + (v.n || 0) * 12;     // closest to the wanted spot, spread out a little
        if (d < bd) { bd = d; best = v; }
    }
    if (best) best.n = (best.n || 0) + 1;
    return best;
}
let netEnemySeq = 0; const enemyById = new Map();
const SPIT_RANGE = 24;         // spitter acid can't fly further than this
// a random walkable spot (from the pathfinding grid) between minD and maxD from (px, pz): [x, y, z].
// Used on Sky Islands, where a random x/z is usually thin air.
// Safe drop-in spots (open, flat, solid, not near an edge, not a stair or crate top), worked out once per map.
let safeSpots = null, safeFor = null;
function buildSafeSpots() {
    safeFor = nav; safeSpots = [];
    for (let n = 0; n < nav.Y.length; n++) {
        const c = nav.cell[n], x = -nav.A + (c % nav.N) + 0.5, z = -nav.A + Math.floor(c / nav.N) + 0.5, y = nav.Y[n];
        if (y >= 9 || inCage(x, z)) continue;
        if (groundAt(x, z, 0, y + 0.6) < y - 0.05) continue;
        if ([[2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5]].some(([dx, dz]) => groundAt(x + dx, z + dz, 0, y + 0.6) < y - 0.7)) continue;
        if ([[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]].some(([dx, dz]) => { const m = navNodeAt(x + dx, z + dz, y); return m < 0 || Math.abs(nav.Y[m] - y) > 0.6; })) continue;
        safeSpots.push([x, y, z]);
    }
}
// a random safe spot between minD and maxD from (px, pz): [x, y, z] (Sky Islands, where a random x/z is usually thin air)
function navSpot(px, pz, minD, maxD) {
    if (!nav || !nav.Y.length) return null;
    if (safeFor !== nav) buildSafeSpots();
    if (!safeSpots.length) return null;
    for (let t = 0; t < 80; t++) {
        const s = safeSpots[(Math.random() * safeSpots.length) | 0], d = Math.hypot(s[0] - px, s[2] - pz);
        if (d >= minD && d <= maxD) return s;
    }
    return null;
}
// 3.8: from wave 6, most waves (not boss waves) come with a twist that pays extra (single player)
const TWISTS = {
    horde:       { name: 'HORDE',       color: '#f87171', desc: '40% more zombies. +30% cash.', count: 1.4, cash: 1.3 },
    armored:     { name: 'ARMORED',     color: '#93c5fd', desc: 'Zombies have 50% more health. +40% cash.', hp: 1.5, cash: 1.4 },
    frenzy:      { name: 'FRENZY',      color: '#fbbf24', desc: 'Zombies move 20% faster. +30% cash.', speed: 1.2, cash: 1.3 },
    goldrush:    { name: 'GOLD RUSH',   color: '#fde047', desc: 'Double cash this wave!', cash: 2 },
    specialists: { name: 'SPECIALISTS', color: '#c084fc', desc: 'Twice as many special zombies. +30% cash.', special: 2, cash: 1.3 }
};
let twist = null;
function waveSpeed(level) { return Math.min(3 + level * 0.3, 9); }
function waveReward(level) { return 10 + level * 5; }
