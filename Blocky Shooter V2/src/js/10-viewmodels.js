// ==========================================
// 2b. VIEW MODELS
// Model space: -Z is forward, the origin sits at the trigger. Each model reports its sight
// height/position so aiming puts the sight EXACTLY on the screen center.
// ==========================================


const VM = {};
const cylCache = {};
function cylGeo(r, len, segs = 12, open = false) {
    const k = r + '_' + len + '_' + segs + '_' + open;
    if (!cylCache[k]) { const g = new THREE.CylinderGeometry(r, r, len, segs, 1, open); g.rotateX(Math.PI / 2); cylCache[k] = g; }
    return cylCache[k];
}
const _planeGeo = new THREE.PlaneGeometry(1, 1);
function vmMats() {
    if (VM.metal) return VM;
    const S = (color, roughness, metalness, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness, metalness }, extra));
    VM.metal = S(0x6b7380, 0.34, 0.5);
    VM.steel = S(0xa3adba, 0.28, 0.6);
    VM.poly = S(0x474b54, 0.68, 0.05);
    VM.polyDS = S(0x474b54, 0.68, 0.05, { side: THREE.DoubleSide });
    VM.wood = S(0x9a5a2c, 0.55, 0.0);
    VM.brass = S(0xd4a93c, 0.3, 1.0);
    VM.shellRed = S(0xb91c1c, 0.5, 0.1);
    VM.olive = S(0x6b7a3d, 0.8, 0.05);
    VM.glove = S(0x55555c, 0.85, 0.0);
    VM.gloveDark = S(0x3c3c42, 0.9, 0.0);
    VM.sleeve = S(0x66764f, 0.9, 0.0);
    VM.cuff = S(0x46523d, 0.9, 0.0);
    applyArmColors();
    VM.red = new THREE.MeshBasicMaterial({ color: 0xff2a2a, toneMapped: false });
    VM.green = new THREE.MeshBasicMaterial({ color: 0x5cff7a, toneMapped: false });
    VM.glass = S(0x9fc2ff, 0.05, 0.3, { transparent: true, opacity: 0.14, depthWrite: false });
    VM.lens = new THREE.MeshStandardMaterial({ color: 0x1d2d55, roughness: 0.05, metalness: 0.9, emissive: 0x1a2f66, emissiveIntensity: 0.7 });
    VM.flash = new THREE.MeshBasicMaterial({ map: flashTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    return VM;
}


function applyArmColors() {
    const sc = SLEEVES[settings.sleeve] ?? SLEEVES.navy, gc = GLOVES[settings.glove] ?? GLOVES.black;
    if (!VM.sleeve) return;
    VM.sleeve.color.setHex(sc); VM.cuff.color.setHex(sc).multiplyScalar(0.62);
    VM.glove.color.setHex(gc); VM.gloveDark.color.setHex(gc).multiplyScalar(0.7);
}
function limb(p, a, b, w, mat) {
    const m = new THREE.Mesh(sharedBox, mat);
    m.scale.set(w, w, a.distanceTo(b));
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(_Z, b.clone().sub(a).normalize());
    p.add(m); return m;
}
const WRISTS = { grip: [0, -0.035, 0.075], support: [-0.01, -0.05, 0.06], vgrip: [0, -0.05, 0.05], cup: [-0.035, -0.045, 0.05], top: [0, 0.02, 0.06] };
// A gloved hand posed for a grip style, plus a sleeve running off-screen to the elbow.
function makeArm(parent, pos, elbow, style, tilt = 0, sw = 0.1) {
    const mt = VM;
    const grp = new THREE.Group(); grp.position.fromArray(pos); parent.add(grp); grp.userData.style = style;
    const hand = new THREE.Group(); hand.rotation.x = tilt; grp.add(hand);
    const Bx = (sx, sy, sz, mat, x, y, z, rx = 0) => { const m = new THREE.Mesh(sharedBox, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.x = rx; hand.add(m); return m; };
    if (style === 'grip') {           // wraps a pistol grip: palm behind, fingers curled in front
        Bx(0.07, 0.08, 0.05, mt.glove, 0, 0, 0.037);
        Bx(0.074, 0.074, 0.032, mt.gloveDark, 0, -0.012, -0.036);
        Bx(0.072, 0.03, 0.06, mt.glove, 0, 0.038, 0.03);
        Bx(0.02, 0.018, 0.062, mt.glove, -0.036, 0.046, -0.004);     // thumb
        Bx(0.017, 0.017, 0.046, mt.glove, 0.031, 0.047, -0.047);     // trigger finger on the frame
    } else if (style === 'support') { // palm under a handguard, fingers curl up the far side
        Bx(0.07, 0.03, 0.1, mt.glove, 0, -0.045, 0);
        Bx(0.026, 0.06, 0.1, mt.gloveDark, 0.043, -0.014, 0);
        Bx(0.02, 0.02, 0.08, mt.glove, -0.04, -0.018, 0.01);
    } else if (style === 'vgrip') {   // fist around a vertical foregrip
        Bx(0.07, 0.07, 0.05, mt.glove, -0.005, 0, 0.032);
        Bx(0.07, 0.068, 0.03, mt.gloveDark, -0.005, -0.004, -0.03);
        Bx(0.018, 0.018, 0.055, mt.glove, -0.03, 0.04, -0.005);
    } else if (style === 'cup') {     // pistol support hand wrapped over the shooting hand
        Bx(0.075, 0.07, 0.055, mt.glove, -0.03, -0.005, 0.0);
        Bx(0.034, 0.07, 0.06, mt.gloveDark, 0.02, -0.01, -0.035);
        Bx(0.018, 0.018, 0.06, mt.glove, -0.03, 0.035, -0.035);
    }
    const wrist = new V3().fromArray(WRISTS[style]);
    const el = new V3().fromArray(elbow).sub(grp.position);
    const dir = el.clone().sub(wrist).normalize();
    // long blocky forearm running from the hand to the edge of the screen
    limb(grp, wrist, wrist.clone().addScaledVector(dir, 0.07), sw * 0.92, mt.cuff);
    limb(grp, wrist.clone().addScaledVector(dir, 0.06), el, sw, mt.sleeve);
    limb(grp, wrist.clone().addScaledVector(dir, 0.06 + el.distanceTo(wrist) * 0.55), wrist.clone().addScaledVector(dir, 0.1 + el.distanceTo(wrist) * 0.55), sw * 1.06, mt.cuff);
    return grp;
}


const models = {};
let vmModel = null;
const vm = { adsT: 0, kick: 0, kickRot: 0, kickRoll: 0, swayX: 0, swayY: 0, bob: 0, bobAmt: 0, land: 0, raise: 1, sprint: 0, inspect: 0,
             slideTilt: 0, slideKick: 0, pump: 0, bolt: -1, boltEjected: false, cylRot: 0, cylTarget: 0, hammer: 0, spinAngle: 0,
             slashT: 0, slashDur: 0.3, slashDir: 0, lungeK: 0, akSide: 0, slideKickL: 0, zapT: 0 };       // 4.0: katana / dual pistols / tesla


// 4.0 katana swing trail: a crescent (thick in the middle, fading toward the tail) in front of the camera
function slashGeo() {
    const N = 24, pos = [], col = [], idx = [], A = 2.3, R = 0.24;
    for (let i = 0; i <= N; i++) {
        const t = i / N, a = t * A, w = 0.06 * Math.sin(Math.PI * Math.min(1, t * 1.15)), k = Math.pow(t, 1.6);
        pos.push(Math.cos(a) * R, Math.sin(a) * R, 0, Math.cos(a) * (R + w), Math.sin(a) * (R + w), 0);
        col.push(k * 0.35, k * 0.35, k * 0.35, k, k, k);
        if (i < N) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
    return g;
}
function buildWeaponModel(id) {
    const w = weaponsDb[id], L = playerStats.upgrades[id] || 0;
    const accent = new THREE.MeshStandardMaterial({ color: w.color, roughness: 0.42, metalness: 0.35 });
    const body = new THREE.MeshStandardMaterial({ color: new THREE.Color(w.color).lerp(new THREE.Color(0x30343c), 0.55), roughness: 0.55, metalness: 0.3 });
    // upgrade finishes: L3 glowing trim, L4 gold, L5 animated plasma
    let mt = vmMats(), pulse = null, rainbow = null;
    const camo = CAMOS[settings.camo] && isUnlocked('camo', settings.camo) ? CAMOS[settings.camo] : CAMOS.stock;
    if (L < 4 && camo.c !== undefined) {
        // long guns wear the camo on their furniture, handguns on the slide / frame
        const cm = new THREE.MeshStandardMaterial({ color: camo.c, roughness: camo.metal ? 0.22 : 0.55, metalness: camo.metal ? 0.75 : 0.2, emissive: camo.emissive || 0, emissiveIntensity: camo.emissive ? 0.55 : 0 });
        if (isHandgun(id)) mt = Object.assign({}, mt, { metal: cm, steel: cm }); else body.copy(cm);
        if (camo.glow) { accent.color.setHex(camo.glow); accent.emissive.setHex(camo.glow); accent.emissiveIntensity = 1.2; }
    }
    if (L < 4 && camo.rainbow) {
        rainbow = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.4, emissive: 0xff0000, emissiveIntensity: 0.35 });
        if (isHandgun(id)) mt = Object.assign({}, mt, { metal: rainbow }); else body.copy(rainbow), rainbow = body;
    }
    if (L >= 3) { accent.emissive.setHex(w.color); accent.emissiveIntensity = 1.1; }
    if (L === 4) {
        const gold = new THREE.MeshStandardMaterial({ color: 0xf0b832, roughness: 0.32, metalness: 0.65, emissive: 0x6a4300, emissiveIntensity: 0.55 });
        const chrome = new THREE.MeshStandardMaterial({ color: 0x1c1c21, roughness: 0.18, metalness: 0.9 });
        const handgun = isHandgun(id);
        body.color.setHex(0xf0b832); body.metalness = 0.65; body.roughness = 0.32; body.emissive.setHex(0x6a4300); body.emissiveIntensity = 0.55;
        accent.color.setHex(handgun ? 0x17171b : 0xfff1b0); accent.emissive.setHex(0xffb830); accent.emissiveIntensity = handgun ? 0.6 : 0.3;
        mt = Object.assign({}, mt, { metal: handgun ? gold : chrome, steel: handgun ? chrome : mt.steel });
    }
    if (L >= 5) {
        body.color.setHex(0x2a2140); body.metalness = 0.5; body.roughness = 0.25; body.emissive.setHex(0x1c0f33); body.emissiveIntensity = 1;
        accent.color.setHex(0x9d4dff); accent.emissive.setHex(0x9d4dff); accent.emissiveIntensity = 1.4; pulse = accent;
        mt = Object.assign({}, mt, { metal: new THREE.MeshStandardMaterial({ color: 0x3a2d58, roughness: 0.25, metalness: 0.55, emissive: 0x160b2a, emissiveIntensity: 1 }), poly: new THREE.MeshStandardMaterial({ color: 0x241d33, roughness: 0.5, metalness: 0.2 }) });
    }
    const root = new THREE.Group(), g = new THREE.Group();
    const GS = VM_SCALE * (w.vmScale || 1);
    g.scale.setScalar(GS); root.add(g);
    const P = {};
    const B = (p, sx, sy, sz, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(sharedBox, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); if (rx || ry || rz) m.rotation.set(rx, ry, rz); p.add(m); return m; };
    const C = (p, r, len, mat, x, y, z, segs = 12, open = false) => { const m = new THREE.Mesh(cylGeo(r, len, segs, open), mat); m.position.set(x, y, z); p.add(m); return m; };
    const G = (p, x, y, z) => { const n = new THREE.Group(); n.position.set(x, y, z); p.add(n); return n; };
    const ring = (p, r, tube, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 24), mat); m.position.set(x, y, z); p.add(m); return m; };
    const trigger = (z, y = 0) => {
        B(g, 0.01, 0.008, 0.07, mt.poly, 0, y - 0.03, z); B(g, 0.01, 0.034, 0.008, mt.poly, 0, y - 0.015, z - 0.035);
        B(g, 0.006, 0.024, 0.006, mt.steel, 0, y - 0.012, z + 0.005, 0.3);
    };
    // elbows are placed in SCREEN space (camera units) so the forearms show as long blocks
    // coming in from the bottom corners, whatever the gun's size
    const toM = (c) => [(c[0] - w.hip[0]) / GS, (c[1] - w.hip[1]) / GS, (c[2] - w.hip[2]) / GS];
    const ER = toM([0.34, -0.42, -0.3]), EL = toM([-0.24, -0.34, -0.3]), ELP = toM([-0.15, -0.42, -0.3]);
    const SW = 0.058 / GS;
    let def;
    const FX = {};                 // 4.0: weapon-specific moving bits (charge glow, trail, ...) used by updateViewmodel
    const kitMatG = () => (L >= 5 ? body : mt.poly);


    switch (id) {
        case 'pistol': {
            P.slide = G(g, 0, 0, 0);
            B(P.slide, 0.046, 0.05, 0.25, mt.metal, 0, 0.057, -0.065);
            for (let i = 0; i < 4; i++) B(P.slide, 0.048, 0.034, 0.005, mt.poly, 0, 0.058, 0.02 + i * 0.011);
            B(P.slide, 0.004, 0.018, 0.05, mt.poly, 0.023, 0.066, -0.035);
            B(P.slide, 0.008, 0.012, 0.012, mt.poly, 0, 0.088, -0.175);              // front sight (top = 0.094)
            B(P.slide, 0.005, 0.005, 0.004, mt.green, 0, 0.0895, -0.1685);
            B(P.slide, 0.012, 0.013, 0.014, mt.poly, -0.013, 0.0875, 0.045); B(P.slide, 0.012, 0.013, 0.014, mt.poly, 0.013, 0.0875, 0.045);
            B(P.slide, 0.004, 0.004, 0.003, mt.green, -0.013, 0.089, 0.0375); B(P.slide, 0.004, 0.004, 0.003, mt.green, 0.013, 0.089, 0.0375);
            C(g, 0.011, 0.02, mt.steel, 0, 0.057, -0.19);
            B(g, 0.042, 0.034, 0.2, mt.poly, 0, 0.017, -0.06);
            B(g, 0.044, 0.01, 0.12, accent, 0, 0.004, -0.1);
            B(g, 0.04, 0.125, 0.062, mt.poly, 0, -0.052, 0.035, 0.22);
            B(g, 0.042, 0.08, 0.02, accent, 0, -0.05, 0.004, 0.22);
            trigger(-0.02);
            P.mag = G(g, 0, 0, 0);
            B(P.mag, 0.03, 0.12, 0.045, mt.metal, 0, -0.06, 0.037, 0.22);
            B(P.mag, 0.036, 0.014, 0.058, mt.poly, 0, -0.121, 0.052, 0.22);
            P.rh = makeArm(g, [0, -0.06, 0.04], ER, 'grip', 0.22, SW);
            P.lh = makeArm(g, [-0.035, -0.07, 0.02], ELP, 'cup', 0.2, SW);
            for (let i = 0; i < 4; i++) B(g, 0.042, 0.006, 0.02, mt.poly, 0, -0.03 - i * 0.022, 0.071 + i * 0.005, 0.22);   // grip texture
            B(g, 0.02, 0.012, 0.012, mt.steel, 0, 0.06, 0.066);                                                    // hammer spur
            def = { sight: [0.094, 0.045], muzzle: [0, 0.057, -0.205], eject: [0.03, 0.07, -0.03] };
            break;
        }
        case 'revolver': {
            B(g, 0.044, 0.062, 0.13, mt.steel, 0, 0.044, -0.02);
            B(g, 0.03, 0.012, 0.13, mt.steel, 0, 0.081, -0.02);
            B(g, 0.047, 0.03, 0.05, accent, 0, 0.03, 0.03);
            C(g, 0.015, 0.2, mt.steel, 0, 0.064, -0.185);
            B(g, 0.026, 0.026, 0.19, mt.steel, 0, 0.041, -0.18);
            B(g, 0.016, 0.01, 0.2, mt.metal, 0, 0.081, -0.185);
            B(g, 0.028, 0.012, 0.1, accent, 0, 0.041, -0.2);
            B(g, 0.007, 0.02, 0.02, accent, 0, 0.092, -0.272);                      // front blade (top 0.102)
            B(g, 0.005, 0.005, 0.005, mt.red, 0, 0.0995, -0.264);
            B(g, 0.01, 0.014, 0.012, mt.metal, -0.012, 0.095, 0.035); B(g, 0.01, 0.014, 0.012, mt.metal, 0.012, 0.095, 0.035);
            P.crane = G(g, 0, 0, 0);
            P.cyl = G(P.crane, 0, 0.045, -0.02);
            C(P.cyl, 0.036, 0.085, mt.metal, 0, 0, 0, 14);
            for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; B(P.cyl, 0.009, 0.009, 0.086, mt.poly, Math.cos(a) * 0.034, Math.sin(a) * 0.034, 0); }
            for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * Math.PI * 2; C(P.cyl, 0.008, 0.004, mt.brass, Math.cos(a) * 0.02, Math.sin(a) * 0.02, 0.043, 8); }
            P.hammer = G(g, 0, 0.072, 0.052);
            B(P.hammer, 0.012, 0.032, 0.016, mt.metal, 0, 0.012, 0.004);
            B(g, 0.04, 0.12, 0.058, mt.wood, 0, -0.045, 0.072, 0.35);
            B(g, 0.042, 0.02, 0.062, accent, 0, -0.1, 0.093, 0.35);
            trigger(-0.005, 0.02);
            P.rh = makeArm(g, [0, -0.055, 0.075], ER, 'grip', 0.35, SW);
            P.lh = makeArm(g, [-0.035, -0.065, 0.055], ELP, 'cup', 0.3, SW);
            def = { sight: [0.102, 0.035], muzzle: [0, 0.064, -0.29], eject: [0, 0.045, 0.03] };
            break;
        }
        case 'smg': {
            B(g, 0.052, 0.08, 0.34, mt.poly, 0, 0.03, -0.05);
            B(g, 0.055, 0.022, 0.2, accent, 0, 0.04, -0.06);
            B(g, 0.024, 0.012, 0.24, mt.metal, 0, 0.076, -0.05);
            for (let i = 0; i < 6; i++) B(g, 0.028, 0.004, 0.012, mt.metal, 0, 0.083, -0.15 + i * 0.035);
            P.sight = G(g, 0, 0, 0);                                                // (a SCOPE attachment replaces this holo)
            B(P.sight, 0.04, 0.012, 0.07, mt.metal, 0, 0.088, 0.02);
            B(P.sight, 0.006, 0.05, 0.05, mt.poly, -0.022, 0.119, 0.02); B(P.sight, 0.006, 0.05, 0.05, mt.poly, 0.022, 0.119, 0.02);
            B(P.sight, 0.05, 0.006, 0.05, mt.poly, 0, 0.147, 0.02);
            B(P.sight, 0.038, 0.046, 0.002, mt.glass, 0, 0.119, 0.0);
            ring(P.sight, 0.008, 0.0008, mt.red, 0, 0.119, 0.001); B(P.sight, 0.0025, 0.0025, 0.001, mt.red, 0, 0.119, 0.001);
            C(g, 0.02, 0.1, mt.metal, 0, 0.035, -0.27);
            C(g, 0.026, 0.17, mt.poly, 0, 0.035, -0.4, 14);
            B(g, 0.038, 0.11, 0.055, mt.poly, 0, -0.055, 0.05, 0.25);
            trigger(0.0);
            P.mag = G(g, 0, 0, 0); B(P.mag, 0.034, 0.2, 0.05, mt.metal, 0, -0.09, -0.1, -0.08);
            B(g, 0.03, 0.085, 0.036, mt.poly, 0, -0.035, -0.23);
            B(g, 0.03, 0.05, 0.18, mt.poly, 0, 0.02, 0.2); B(g, 0.03, 0.09, 0.02, mt.poly, 0, 0.0, 0.29);
            P.charge = B(g, 0.03, 0.012, 0.02, mt.metal, -0.03, 0.06, -0.15);
            P.rh = makeArm(g, [0, -0.055, 0.05], ER, 'grip', 0.25, SW);
            P.lh = makeArm(g, [0, -0.062, -0.23], EL, 'vgrip', 0, SW);
            for (let i = 0; i < 3; i++) B(g, 0.04, 0.005, 0.02, mt.poly, 0, -0.03 - i * 0.025, 0.077 + i * 0.006, 0.25);  // grip texture
            B(g, 0.04, 0.02, 0.05, mt.metal, 0, -0.005, -0.1);                                                     // mag well
            def = { sight: [0.119, 0.04], muzzle: [0, 0.035, -0.49], eject: [0.03, 0.05, -0.03] };
            break;
        }
        case 'ar': {
            B(g, 0.05, 0.07, 0.3, body, 0, 0.012, 0.0);
            B(g, 0.056, 0.058, 0.32, mt.metal, 0, 0.056, -0.02);
            B(g, 0.026, 0.01, 0.34, mt.metal, 0, 0.09, -0.08);
            B(g, 0.06, 0.072, 0.32, body, 0, 0.045, -0.35);
            for (let i = 0; i < 4; i++) B(g, 0.062, 0.01, 0.035, mt.poly, 0, 0.05, -0.24 - i * 0.07);
            B(g, 0.062, 0.012, 0.28, accent, 0, 0.018, -0.35);
            C(g, 0.013, 0.2, mt.steel, 0, 0.048, -0.6); C(g, 0.02, 0.06, mt.poly, 0, 0.048, -0.72);
            B(g, 0.004, 0.026, 0.06, mt.poly, 0.03, 0.055, -0.02);
            P.sight = G(g, 0, 0, 0);                                                // (a SCOPE attachment replaces this red dot)
            B(P.sight, 0.03, 0.012, 0.05, mt.metal, 0, 0.1, 0.0);                  // red dot mount
            C(P.sight, 0.024, 0.08, mt.polyDS, 0, 0.13, 0.0, 18, true);
            C(P.sight, 0.027, 0.012, mt.metal, 0, 0.13, -0.04, 18, true);
            C(P.sight, 0.022, 0.002, mt.glass, 0, 0.13, -0.036, 18);
            B(P.sight, 0.003, 0.003, 0.002, mt.red, 0, 0.13, -0.03);
            B(P.sight, 0.01, 0.012, 0.014, mt.metal, 0.028, 0.13, 0.0);
            P.mag = G(g, 0, 0, 0);
            B(P.mag, 0.04, 0.16, 0.07, mt.metal, 0, -0.085, -0.075, -0.18); B(P.mag, 0.04, 0.09, 0.068, mt.metal, 0, -0.18, -0.105, -0.4);
            B(g, 0.04, 0.11, 0.055, mt.poly, 0, -0.06, 0.1, 0.3);
            trigger(0.035, -0.015);
            C(g, 0.018, 0.2, mt.metal, 0, 0.04, 0.24); B(g, 0.045, 0.085, 0.22, body, 0, 0.02, 0.36); B(g, 0.05, 0.12, 0.03, mt.poly, 0, 0.0, 0.48);
            P.charge = B(g, 0.04, 0.012, 0.03, mt.metal, 0, 0.08, 0.14);
            P.rh = makeArm(g, [0, -0.06, 0.1], ER, 'grip', 0.3, SW);
            P.lh = makeArm(g, [0, 0.03, -0.36], EL, 'support', 0, SW);
            for (let i = 0; i < 8; i++) B(g, 0.03, 0.005, 0.014, mt.metal, 0, 0.097, 0.06 - i * 0.035);                 // rail teeth
            C(g, 0.009, 0.03, mt.steel, 0.033, 0.06, 0.05, 8);                                                     // forward assist
            for (let i = 0; i < 3; i++) B(P.mag, 0.042, 0.006, 0.066, mt.poly, 0, -0.04 - i * 0.04, -0.07 - i * 0.008, -0.18);   // mag ribs
            B(g, 0.012, 0.012, 0.03, mt.steel, 0, -0.02, 0.44);                                                    // sling loop
            def = { sight: [0.13, 0.04], muzzle: [0, 0.048, -0.76], eject: [0.035, 0.055, -0.02] };
            break;
        }
        case 'burst': {
            B(g, 0.06, 0.1, 0.62, body, 0, 0.03, 0.05);
            B(g, 0.062, 0.02, 0.4, accent, 0, 0.05, 0.0);
            B(g, 0.064, 0.05, 0.2, mt.poly, 0, 0.0, -0.2);
            B(g, 0.022, 0.02, 0.4, accent, 0, 0.14, -0.03);                        // carry handle
            B(g, 0.02, 0.06, 0.02, mt.poly, 0, 0.1, -0.2); B(g, 0.02, 0.06, 0.02, mt.poly, 0, 0.1, 0.14);
            P.sight = G(g, 0, 0, 0);                                                // rear aperture (a SCOPE replaces it)
            B(P.sight, 0.008, 0.028, 0.02, mt.poly, -0.019, 0.164, 0.13); B(P.sight, 0.008, 0.028, 0.02, mt.poly, 0.019, 0.164, 0.13);
            ring(P.sight, 0.012, 0.002, mt.poly, 0, 0.17, 0.13);
            B(g, 0.005, 0.02, 0.005, mt.poly, 0, 0.16, -0.2);                      // front post (top 0.17)
            B(g, 0.004, 0.004, 0.004, mt.red, 0, 0.168, -0.2);
            B(g, 0.006, 0.024, 0.012, mt.poly, -0.016, 0.158, -0.2); B(g, 0.006, 0.024, 0.012, mt.poly, 0.016, 0.158, -0.2);
            C(g, 0.013, 0.22, mt.steel, 0, 0.03, -0.35); C(g, 0.018, 0.05, mt.poly, 0, 0.03, -0.48);
            B(g, 0.04, 0.11, 0.055, mt.poly, 0, -0.07, -0.1, 0.3);
            trigger(-0.14, -0.02);
            P.mag = G(g, 0, 0, 0); B(P.mag, 0.035, 0.16, 0.065, mt.metal, 0, -0.09, 0.14, -0.15);
            B(g, 0.064, 0.13, 0.03, mt.poly, 0, 0.01, 0.37);
            P.rh = makeArm(g, [0, -0.07, -0.1], ER, 'grip', 0.3, SW);
            P.lh = makeArm(g, [0, -0.005, -0.3], EL, 'support', 0, SW);
            for (let i = 0; i < 5; i++) B(g, 0.064, 0.008, 0.02, mt.poly, 0, -0.015, -0.14 - i * 0.03);                  // front vents
            B(g, 0.014, 0.03, 0.05, mt.metal, 0.034, 0.05, 0.22);                                                  // charging handle
            def = { sight: [0.17, 0.13], muzzle: [0, 0.03, -0.51], eject: [0.035, 0.05, 0.12] };
            break;
        }
        case 'shotgun': {
            B(g, 0.058, 0.085, 0.3, mt.metal, 0, 0.03, 0.0);
            B(g, 0.06, 0.018, 0.2, accent, 0, 0.03, 0.0);
            B(g, 0.004, 0.03, 0.08, mt.poly, 0.03, 0.04, -0.02);
            C(g, 0.022, 0.6, mt.steel, 0, 0.05, -0.45, 14);
            B(g, 0.012, 0.008, 0.58, mt.metal, 0, 0.076, -0.45);
            B(g, 0.009, 0.009, 0.009, mt.red, 0, 0.084, -0.735);                   // bead
            C(g, 0.017, 0.5, mt.metal, 0, 0.004, -0.4);
            for (let i = 0; i < 4; i++) { B(g, 0.012, 0.055, 0.022, mt.shellRed, -0.035, 0.03, -0.08 + i * 0.028); B(g, 0.013, 0.014, 0.023, mt.brass, -0.035, 0.0, -0.08 + i * 0.028); }
            P.pump = G(g, 0, 0, -0.38);
            B(P.pump, 0.066, 0.058, 0.2, mt.wood, 0, 0.004, 0);
            for (let i = 0; i < 4; i++) B(P.pump, 0.068, 0.006, 0.01, mt.poly, 0, 0.004, -0.07 + i * 0.045);
            B(g, 0.045, 0.1, 0.06, mt.wood, 0, -0.05, 0.17, 0.45);
            B(g, 0.05, 0.095, 0.3, mt.wood, 0, -0.02, 0.33, 0.08);
            B(g, 0.052, 0.115, 0.03, mt.poly, 0, -0.04, 0.49, 0.08);
            trigger(0.09, -0.015);
            P.rh = makeArm(g, [0, -0.055, 0.17], ER, 'grip', 0.45, SW);
            P.lh = makeArm(P.pump, [0, 0.005, 0], [EL[0], EL[1], EL[2] + 0.38], 'support', 0, SW);
            B(g, 0.03, 0.006, 0.05, mt.steel, 0, -0.013, 0.03);                                                    // loading gate
            C(g, 0.024, 0.02, mt.metal, 0, 0.05, -0.18, 12); C(g, 0.019, 0.02, mt.metal, 0, 0.004, -0.62, 12);    // barrel/tube clamps
            def = { sight: [0.087, 0.12], muzzle: [0, 0.05, -0.76], eject: [0.035, 0.05, 0.0], shell: true };
            break;
        }
        case 'dmr': {
            B(g, 0.056, 0.09, 0.4, body, 0, 0.03, -0.03);
            B(g, 0.058, 0.028, 0.4, mt.metal, 0, 0.083, -0.03);
            B(g, 0.06, 0.02, 0.3, accent, 0, 0.02, -0.03);
            B(g, 0.058, 0.072, 0.34, body, 0, 0.045, -0.4);
            for (let i = 0; i < 3; i++) B(g, 0.06, 0.012, 0.05, mt.poly, 0, 0.05, -0.3 - i * 0.1);
            C(g, 0.014, 0.28, mt.steel, 0, 0.048, -0.7); B(g, 0.04, 0.035, 0.08, mt.poly, 0, 0.048, -0.87);
            B(g, 0.014, 0.045, 0.03, mt.metal, 0, 0.115, -0.08); B(g, 0.014, 0.045, 0.03, mt.metal, 0, 0.115, 0.08);
            C(g, 0.026, 0.24, mt.poly, 0, 0.15, 0, 16);
            C(g, 0.036, 0.07, mt.poly, 0, 0.15, -0.15, 16); C(g, 0.031, 0.05, mt.poly, 0, 0.15, 0.14, 16);
            C(g, 0.033, 0.003, mt.lens, 0, 0.15, -0.186, 16);
            B(g, 0.02, 0.02, 0.025, mt.metal, 0, 0.18, 0); B(g, 0.02, 0.02, 0.025, mt.metal, 0.032, 0.15, 0);
            P.mag = G(g, 0, 0, 0); B(P.mag, 0.04, 0.13, 0.07, mt.metal, 0, -0.075, -0.06, -0.1);
            B(g, 0.04, 0.11, 0.055, mt.poly, 0, -0.06, 0.12, 0.3);
            trigger(0.06, -0.015);
            B(g, 0.05, 0.1, 0.3, body, 0, 0.0, 0.34); B(g, 0.045, 0.035, 0.15, mt.poly, 0, 0.065, 0.33); B(g, 0.055, 0.13, 0.03, mt.poly, 0, -0.01, 0.5);
            P.charge = B(g, 0.04, 0.012, 0.03, mt.metal, -0.03, 0.08, 0.1);
            P.rh = makeArm(g, [0, -0.06, 0.12], ER, 'grip', 0.3, SW);
            P.lh = makeArm(g, [0, 0.03, -0.42], EL, 'support', 0, SW);
            for (let i = 0; i < 8; i++) B(g, 0.032, 0.005, 0.014, mt.metal, 0, 0.1, 0.13 - i * 0.035);                  // rail teeth
            C(g, 0.034, 0.012, accent, 0, 0.15, -0.19, 16); C(g, 0.032, 0.01, accent, 0, 0.15, 0.17, 16);          // scope rings
            B(g, 0.012, 0.012, 0.03, mt.steel, 0, -0.03, 0.46);
            def = { sight: [0.15, 0.2], muzzle: [0, 0.048, -0.92], eject: [0.035, 0.06, -0.02] };
            break;
        }
        case 'lmg': {
            B(g, 0.07, 0.11, 0.42, body, 0, 0.03, -0.02);
            B(g, 0.072, 0.02, 0.3, accent, 0, 0.02, -0.02);
            P.lid = G(g, 0, 0.09, 0.14);
            B(P.lid, 0.074, 0.02, 0.3, mt.metal, 0, 0, -0.15);
            P.sight = G(P.lid, 0, 0, 0);                                            // reflex sight on the feed cover (a SCOPE replaces it)
            B(P.sight, 0.04, 0.012, 0.05, mt.metal, 0, 0.016, -0.07);
            B(P.sight, 0.005, 0.045, 0.005, mt.poly, -0.02, 0.045, -0.08); B(P.sight, 0.005, 0.045, 0.005, mt.poly, 0.02, 0.045, -0.08);
            B(P.sight, 0.045, 0.005, 0.005, mt.poly, 0, 0.07, -0.08);
            B(P.sight, 0.036, 0.04, 0.001, mt.glass, 0, 0.045, -0.08);
            B(P.sight, 0.0035, 0.0035, 0.001, mt.red, 0, 0.045, -0.0795);
            B(g, 0.055, 0.055, 0.36, mt.poly, 0, 0.05, -0.42);
            for (let i = 0; i < 5; i++) B(g, 0.057, 0.012, 0.03, mt.metal, 0, 0.05, -0.28 - i * 0.065);
            C(g, 0.016, 0.5, mt.steel, 0, 0.05, -0.55); C(g, 0.022, 0.06, mt.poly, 0, 0.05, -0.82);
            B(g, 0.015, 0.03, 0.1, mt.poly, 0, 0.09, -0.3);
            P.mag = G(g, 0, 0, 0);
            B(P.mag, 0.09, 0.12, 0.13, mt.olive, -0.01, -0.09, -0.05);
            B(P.mag, 0.092, 0.012, 0.132, mt.metal, -0.01, -0.03, -0.05);
            for (let i = 0; i < 4; i++) B(P.mag, 0.012, 0.022, 0.012, mt.brass, 0.045, -0.02 + i * 0.018, -0.05);
            B(g, 0.04, 0.11, 0.055, mt.poly, 0, -0.06, 0.12, 0.3);
            trigger(0.06, -0.02);
            B(g, 0.05, 0.1, 0.28, body, 0, 0.0, 0.34); B(g, 0.055, 0.13, 0.03, mt.poly, 0, -0.01, 0.49);
            B(g, 0.01, 0.01, 0.3, mt.metal, 0.02, 0.01, -0.5); B(g, 0.01, 0.01, 0.3, mt.metal, -0.02, 0.01, -0.5);
            P.rh = makeArm(g, [0, -0.06, 0.12], ER, 'grip', 0.3, SW);
            P.lh = makeArm(g, [0, 0.03, -0.42], EL, 'support', 0, SW);
            for (let i = 0; i < 6; i++) B(P.lid, 0.076, 0.004, 0.012, mt.poly, 0, 0.011, -0.03 - i * 0.045);            // feed cover ribs
            B(g, 0.03, 0.008, 0.02, mt.metal, 0.02, 0.005, -0.66); B(g, 0.03, 0.008, 0.02, mt.metal, -0.02, 0.005, -0.66);   // bipod feet
            C(g, 0.012, 0.03, mt.steel, 0.04, 0.07, -0.2, 8);                                                      // barrel latch
            def = { sight: [0.135, 0.12], muzzle: [0, 0.05, -0.85], eject: [0.04, 0.03, 0.0] };
            break;
        }
        case 'sniper': {
            B(g, 0.056, 0.08, 0.44, body, 0, 0.03, 0.02);
            B(g, 0.06, 0.016, 0.34, accent, 0, 0.03, 0.02);
            B(g, 0.055, 0.12, 0.36, body, 0, -0.02, 0.42);
            B(g, 0.05, 0.035, 0.18, mt.poly, 0, 0.06, 0.4);
            B(g, 0.058, 0.14, 0.03, mt.poly, 0, -0.03, 0.6);
            C(g, 0.017, 0.75, mt.steel, 0, 0.04, -0.58, 14);
            B(g, 0.05, 0.045, 0.1, mt.poly, 0, 0.04, -1.0);
            B(g, 0.06, 0.07, 0.3, body, 0, 0.035, -0.3);
            B(g, 0.016, 0.05, 0.03, mt.metal, 0, 0.09, -0.08); B(g, 0.016, 0.05, 0.03, mt.metal, 0, 0.09, 0.1);
            C(g, 0.03, 0.34, mt.poly, 0, 0.13, 0.02, 16);
            C(g, 0.042, 0.1, mt.poly, 0, 0.13, -0.2, 16);
            C(g, 0.036, 0.07, mt.poly, 0, 0.13, 0.22, 16);
            C(g, 0.038, 0.004, mt.lens, 0, 0.13, -0.252, 16);
            B(g, 0.026, 0.028, 0.03, mt.metal, 0, 0.168, 0.02); B(g, 0.028, 0.026, 0.03, mt.metal, 0.036, 0.13, 0.02);
            P.bolt = G(g, 0.03, 0.055, 0.14);
            B(P.bolt, 0.055, 0.012, 0.012, mt.steel, 0.028, 0, 0);
            B(P.bolt, 0.022, 0.022, 0.022, mt.poly, 0.06, 0, 0);
            P.mag = G(g, 0, 0, 0); B(P.mag, 0.04, 0.08, 0.1, mt.metal, 0, -0.035, -0.02);
            B(g, 0.04, 0.11, 0.055, body, 0, -0.06, 0.18, 0.35);
            trigger(0.1, -0.012);
            B(g, 0.01, 0.01, 0.3, mt.metal, 0.02, 0.0, -0.35); B(g, 0.01, 0.01, 0.3, mt.metal, -0.02, 0.0, -0.35);
            P.rh = makeArm(g, [0, -0.062, 0.18], ER, 'grip', 0.35, SW);
            P.lh = makeArm(g, [0, 0.015, -0.28], EL, 'support', 0, SW);
            B(g, 0.07, 0.07, 0.012, mt.poly, 0, 0.13, -0.265); B(g, 0.06, 0.06, 0.012, mt.poly, 0, 0.13, 0.265);     // flip-up scope caps
            C(g, 0.02, 0.03, accent, 0, 0.04, -0.95, 12);                                                          // barrel band
            B(g, 0.012, 0.012, 0.03, mt.steel, 0, -0.1, 0.55);
            def = { sight: [0.13, 0.26], muzzle: [0, 0.04, -1.06], eject: [0.035, 0.06, 0.1] };
            break;
        }
        case 'rpg': {
            const olive = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x4d5a2b).lerp(body.color, L ? 0.8 : 0), roughness: 0.75, metalness: 0.1 });
            C(g, 0.045, 0.95, olive, 0, 0.07, -0.12, 16);                           // launch tube
            C(g, 0.058, 0.09, mt.polyDS, 0, 0.07, 0.4, 16, true);                   // rear blast cone
            C(g, 0.05, 0.05, mt.poly, 0, 0.07, -0.59, 16);                          // muzzle collar
            for (const z of [-0.42, -0.05, 0.22]) C(g, 0.047, 0.03, accent, 0, 0.07, z, 16);
            B(g, 0.03, 0.02, 0.5, mt.metal, 0, 0.117, -0.1);                        // top rail
            P.sight = G(g, 0, 0, 0); B(P.sight, 0.02, 0.028, 0.02, mt.poly, 0, 0.13, 0.1); ring(P.sight, 0.012, 0.002, mt.poly, 0, 0.15, 0.1);   // rear aperture (a SCOPE replaces it)
            B(g, 0.02, 0.02, 0.02, mt.poly, 0, 0.127, -0.35); B(g, 0.006, 0.03, 0.006, mt.poly, 0, 0.135, -0.35);  // front post (top 0.15)
            B(g, 0.004, 0.004, 0.004, mt.red, 0, 0.149, -0.35);
            B(g, 0.04, 0.11, 0.055, mt.poly, 0, -0.03, 0.05, 0.25);                // pistol grip
            B(g, 0.03, 0.09, 0.035, mt.poly, 0, -0.015, -0.2);                     // front grip
            B(g, 0.05, 0.035, 0.07, olive, 0, 0.03, 0.05);
            trigger(0.02, 0.01);
            P.mag = G(g, 0, 0.07, -0.6);                                            // the rocket
            C(P.mag, 0.03, 0.12, VM.olive, 0, 0, -0.03, 10);                        // rocket body
            C(P.mag, 0.05, 0.04, VM.olive, 0, 0, -0.1, 14);                         // taper
            C(P.mag, 0.078, 0.15, accent, 0, 0, -0.19, 16);                         // warhead bulb (wider than the tube)
            C(P.mag, 0.08, 0.015, mt.metal, 0, 0, -0.12, 16);
            const cone = new THREE.Mesh(new THREE.ConeGeometry(0.078, 0.2, 16), mt.metal); cone.rotation.x = -Math.PI / 2; cone.position.z = -0.365; P.mag.add(cone);
            C(P.mag, 0.012, 0.05, mt.steel, 0, 0, -0.49, 8);                        // fuse tip
            P.rh = makeArm(g, [0, -0.035, 0.05], ER, 'grip', 0.25, SW);
            P.lh = makeArm(g, [0, -0.03, -0.2], EL, 'vgrip', 0, SW);
            def = { sight: [0.15, 0.1], muzzle: [0, 0.07, -0.64], eject: [0, 0.07, 0.42] };
            break;
        }
        case 'crossbow': {
            const wood = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x6b4423).lerp(body.color, L ? 0.7 : 0), roughness: 0.7, metalness: 0.05 });
            B(g, 0.05, 0.07, 0.36, wood, 0, 0.02, 0.12);                             // stock
            B(g, 0.056, 0.12, 0.045, mt.poly, 0, 0.0, 0.31);                         // butt
            B(g, 0.036, 0.03, 0.56, mt.metal, 0, 0.05, -0.2);                        // rail
            B(g, 0.05, 0.05, 0.08, wood, 0, 0.04, -0.45);                            // bow head
            for (const sx of [-1, 1]) { B(g, 0.26, 0.022, 0.04, accent, sx * 0.14, 0.05, -0.44, 0, sx * -0.28, 0); B(g, 0.02, 0.03, 0.02, mt.steel, sx * 0.265, 0.05, -0.37); }   // limbs + cams
            for (const sx of [-1, 1]) B(g, 0.004, 0.004, 0.31, mt.steel, sx * 0.135, 0.056, -0.33, 0, sx * -1.02, 0);   // string, drawn back
            P.mag = G(g, 0, 0.07, -0.25);                                            // the bolt
            B(P.mag, 0.009, 0.009, 0.42, wood, 0, 0, -0.06);
            const tip = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.05, 8), mt.steel); tip.rotation.x = -Math.PI / 2; tip.position.z = -0.29; P.mag.add(tip);
            for (const sx of [-1, 1]) B(P.mag, 0.002, 0.016, 0.04, mt.red, sx * 0.006, 0.006, 0.13);
            P.sight = G(g, 0, 0, 0); B(P.sight, 0.02, 0.028, 0.02, mt.poly, 0, 0.1, 0.03); ring(P.sight, 0.012, 0.002, mt.poly, 0, 0.118, 0.03);   // rear aperture (a SCOPE replaces it)
            B(g, 0.006, 0.034, 0.006, mt.poly, 0, 0.1, -0.4); B(g, 0.004, 0.004, 0.004, mt.red, 0, 0.117, -0.4);   // front post
            B(g, 0.038, 0.11, 0.055, mt.poly, 0, -0.045, 0.03, 0.25);                // grip
            trigger(-0.02, 0.005);
            P.rh = makeArm(g, [0, -0.045, 0.03], ER, 'grip', 0.25, SW);
            P.lh = makeArm(g, [0, 0.02, -0.24], EL, 'support', 0, SW);
            def = { sight: [0.118, 0.03], muzzle: [0, 0.07, -0.5], eject: [0.03, 0.06, -0.05] };
            break;
        }
        case 'flamer': {
            B(g, 0.062, 0.085, 0.38, body, 0, 0.02, -0.02);                         // body
            C(g, 0.022, 0.44, mt.metal, 0, 0.035, -0.41);                            // nozzle tube
            C(g, 0.034, 0.07, mt.poly, 0, 0.035, -0.64, 14);                         // nozzle
            for (const z of [-0.3, -0.45]) C(g, 0.03, 0.025, mt.poly, 0, 0.035, z, 12);   // heat rings
            const pilot = new THREE.MeshStandardMaterial({ color: 0x60a5fa, emissive: 0x3b82f6, emissiveIntensity: 2 });
            B(g, 0.012, 0.012, 0.02, pilot, 0, 0.008, -0.63);                        // pilot light
            P.mag = G(g, 0, -0.07, -0.08);                                           // fuel tank
            C(P.mag, 0.052, 0.26, accent, 0, 0, 0, 16); C(P.mag, 0.054, 0.02, mt.metal, 0, 0, 0.1, 16); C(P.mag, 0.054, 0.02, mt.metal, 0, 0, -0.1, 16);
            B(P.mag, 0.02, 0.03, 0.02, mt.steel, 0, 0.05, 0.12);
            B(g, 0.016, 0.016, 0.2, mt.steel, 0.04, 0.0, -0.1);                      // fuel line
            B(g, 0.04, 0.11, 0.055, mt.poly, 0, -0.06, 0.12, 0.25);                  // rear grip
            B(g, 0.03, 0.1, 0.036, mt.poly, 0, -0.035, -0.28);                       // front grip
            B(g, 0.02, 0.03, 0.1, mt.poly, 0, 0.09, 0.0);                            // top handle
            trigger(0.09, -0.01);
            P.rh = makeArm(g, [0, -0.06, 0.12], ER, 'grip', 0.25, SW);
            P.lh = makeArm(g, [0, -0.035, -0.28], EL, 'vgrip', 0, SW);
            def = { sight: [0.12, 0.0], muzzle: [0, 0.035, -0.69], eject: [0.03, 0.05, 0.0] };
            break;
        }
        case 'minigun': {
            B(g, 0.13, 0.14, 0.34, body, 0, 0.0, 0.02);
            B(g, 0.135, 0.02, 0.3, accent, 0, 0.055, 0.02);
            C(g, 0.07, 0.12, mt.metal, 0, 0.0, -0.18, 16);
            P.barrels = G(g, 0, 0, -0.24);
            for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; C(P.barrels, 0.012, 0.55, mt.steel, Math.cos(a) * 0.036, Math.sin(a) * 0.036, -0.27, 8); }
            C(P.barrels, 0.056, 0.03, mt.metal, 0, 0, -0.46, 16); C(P.barrels, 0.056, 0.02, mt.metal, 0, 0, -0.18, 16);
            C(P.barrels, 0.016, 0.56, mt.poly, 0, 0, -0.27, 8);
            B(g, 0.02, 0.02, 0.2, mt.poly, 0, 0.12, 0.0); B(g, 0.02, 0.05, 0.02, mt.poly, 0, 0.09, -0.08); B(g, 0.02, 0.05, 0.02, mt.poly, 0, 0.09, 0.08);
            B(g, 0.035, 0.11, 0.05, mt.poly, 0.06, -0.12, 0.13, 0.2);
            B(g, 0.02, 0.1, 0.02, mt.poly, -0.08, -0.07, -0.1);
            P.mag = G(g, 0, 0, 0); B(P.mag, 0.1, 0.14, 0.16, mt.olive, -0.13, -0.06, 0.06); B(P.mag, 0.102, 0.012, 0.162, mt.metal, -0.13, 0.015, 0.06);
            for (let i = 0; i < 4; i++) B(g, 0.02, 0.012, 0.012, mt.brass, -0.075 + i * 0.012, 0.02 - i * 0.004, 0.06);
            P.rh = makeArm(g, [0.06, -0.12, 0.14], ER, 'grip', 0.2, SW);
            P.lh = makeArm(g, [-0.08, -0.07, -0.1], EL, 'vgrip', 0, SW);
            def = { sight: [0, 0], muzzle: [0, 0, -0.8], eject: [0.07, -0.02, 0.05] };
            break;
        }
        // ---------- 4.0 WEAPONS ----------
        case 'dual': {          // two compact machine pistols: this builds the RIGHT one; it's mirrored into the left hand after the kits
            const OX = 0.14;    // how far each gun sits from the middle of the screen (camera units)
            g.position.x = OX;
            P.slide = G(g, 0, 0, 0); P.slide.name = 'slide';
            B(P.slide, 0.044, 0.05, 0.25, mt.metal, 0, 0.057, -0.075);
            B(P.slide, 0.046, 0.013, 0.09, accent, 0, 0.077, -0.14);                 // lightening cut
            for (let i = 0; i < 4; i++) B(P.slide, 0.046, 0.034, 0.005, mt.poly, 0, 0.058, 0.0 + i * 0.011);
            B(P.slide, 0.008, 0.012, 0.012, mt.poly, 0, 0.088, -0.18); B(P.slide, 0.005, 0.005, 0.004, mt.green, 0, 0.0895, -0.174);
            B(P.slide, 0.03, 0.013, 0.014, mt.poly, 0, 0.0875, 0.04);
            C(g, 0.011, 0.02, mt.steel, 0, 0.057, -0.205);
            B(g, 0.048, 0.046, 0.05, mt.poly, 0, 0.062, -0.228);                    // compensator
            for (const sx of [-1, 1]) B(g, 0.004, 0.014, 0.03, accent, sx * 0.024, 0.07, -0.228);   // comp ports
            B(g, 0.042, 0.034, 0.21, mt.poly, 0, 0.017, -0.07);
            B(g, 0.044, 0.01, 0.12, accent, 0, 0.003, -0.11);
            B(g, 0.04, 0.125, 0.062, mt.poly, 0, -0.052, 0.035, 0.22);
            B(g, 0.042, 0.08, 0.02, accent, 0, -0.05, 0.004, 0.22);
            for (let i = 0; i < 4; i++) B(g, 0.042, 0.006, 0.02, mt.poly, 0, -0.03 - i * 0.022, 0.071 + i * 0.005, 0.22);
            trigger(-0.02);
            P.mag = G(g, 0, 0, 0); P.mag.name = 'mag';
            B(P.mag, 0.03, 0.17, 0.045, mt.metal, 0, -0.0844, 0.0426, 0.22);        // long mag sticking out of the grip
            B(P.mag, 0.036, 0.016, 0.058, accent, 0, -0.176, 0.063, 0.22);
            P.rh = makeArm(g, [0, -0.06, 0.04], toM([0.36 - OX, -0.43, -0.3]), 'grip', 0.22, SW);
            def = { sight: [0.17, 0.04], muzzle: [0, 0.062, -0.258], eject: [0.03, 0.07, -0.03] };
            FX.ox = OX;
            break;
        }
        case 'katana': {        // built along +Y in its own group, which is then tilted forward and across the screen
            const hold = P.sw = G(g, 0, 0, 0);
            hold.rotation.set(-1.0, 0, 0.25);
            const sw = G(hold, 0, 0, 0); sw.rotation.y = 0.9;                           // turn the flat of the blade toward you
            const blade = L >= 5 ? (pulse || accent) : new THREE.MeshStandardMaterial({ color: L === 1 ? 0x9aa4b2 : 0xdfe4ea, roughness: 0.2, metalness: 0.75 });
            const edge = L >= 3 ? (pulse || accent) : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.4, emissive: 0x8fa3b8, emissiveIntensity: 0.35 });
            const wrap = new THREE.MeshStandardMaterial({ color: L === 1 ? 0x0f0f12 : 0x24242a, roughness: 0.85, metalness: 0.05 });
            const fit = L >= 4 ? body : mt.metal;                                      // guard / collar / pommel: gold at L4, plasma at L5
            B(sw, 0.038, 0.024, 0.046, fit, 0, -0.302, 0);                             // kashira (pommel)
            B(sw, 0.032, 0.27, 0.04, wrap, 0, -0.16, 0);                               // tsuka (handle)
            for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) B(sw, 0.004, 0.02, 0.02, accent, sx * 0.017, -0.27 + i * 0.045, 0, Math.PI / 4);   // wrap diamonds
            const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.014, 16), fit); tsuba.scale.z = 0.78; tsuba.position.y = -0.018; sw.add(tsuba);
            B(sw, 0.022, 0.034, 0.034, mt.brass, 0, 0.007, 0.003);                     // habaki (collar)
            // blade: three gently curving sections (the curve bends toward the spine, +Z); the edge faces -Z
            const wide = L >= 2 ? 1.22 : 1;
            let seg = G(sw, 0, 0.02, 0);
            for (let k = 0; k < 3; k++) {
                const len = k < 2 ? 0.3 : 0.24;
                B(seg, 0.012, len, 0.052 * wide, blade, 0, len / 2, 0.002);
                B(seg, 0.007, len, 0.011, edge, 0, len / 2, -0.03 * wide);            // cutting edge
                B(seg, 0.015, len, 0.008, mt.metal, 0, len / 2, 0.027 * wide);         // spine
                if (L >= 2 && L < 5) for (let t = 0; t < 4; t++) B(seg, 0.014, 0.018, 0.018, mt.poly, 0, 0.04 + t * len / 4, 0.032 * wide, Math.PI / 4);   // HEAVY: serrated spine
                if (k < 2) { seg = G(seg, 0, len, 0); seg.rotation.x = 0.055; }
            }
            B(seg, 0.0118, 0.08, 0.044 * wide, blade, 0, 0.262, 0.008, 0.6);           // kissaki (tip)
            B(seg, 0.006, 0.065, 0.01, edge, 0, 0.262, -0.016, 0.6);
            if (L >= 1) { B(sw, 0.036, 0.02, 0.044, accent, 0, -0.04, 0); B(sw, 0.006, 0.12, 0.006, accent, 0.02, -0.33, 0.012, 0.3); }   // TACTICAL: collar band + sageo cord
            if (L >= 3) { const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.006, 16), pulse || accent); gl.scale.z = 0.78; gl.position.y = -0.009; sw.add(gl); }
            // hands on the handle: right at the guard, left at the pommel; elbows worked out in the sword's tilted frame
            hold.updateMatrix(); const inv = hold.matrix.clone().invert();
            const elR = new V3().fromArray(toM([0.42, -0.46, -0.3])).applyMatrix4(inv).toArray(), elL = new V3().fromArray(toM([0.0, -0.5, -0.28])).applyMatrix4(inv).toArray();
            P.rh = makeArm(hold, [0, -0.07, 0.0], elR, 'grip', 0, SW);
            P.lh = makeArm(hold, [0, -0.215, 0.0], elL, 'grip', 0, SW);
            // the swing trail: an additive arc in front of the camera (shown during slashes)
            FX.trail = new THREE.Mesh(slashGeo(), new THREE.MeshBasicMaterial({ color: L >= 5 ? 0xc084fc : (L >= 3 ? w.color : 0xdfe8ff), vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
            FX.trail.visible = false; FX.trail.renderOrder = 6;
            def = { sight: [0, 0], muzzle: [0, 0.6, -0.6], eject: [0, 0, 0] };
            break;
        }
        case 'glauncher': {     // six-shot drum launcher
            B(g, 0.058, 0.07, 0.2, body, 0, 0.055, 0.06);                             // frame
            B(g, 0.06, 0.016, 0.16, accent, 0, 0.045, 0.06);
            B(g, 0.05, 0.02, 0.3, mt.metal, 0, 0.11, -0.05);                          // top strap over the drum
            B(g, 0.03, 0.012, 0.26, mt.metal, 0, 0.126, -0.06);                       // top rail
            for (let i = 0; i < 7; i++) B(g, 0.034, 0.005, 0.012, mt.metal, 0, 0.134, 0.05 - i * 0.035);
            C(g, 0.034, 0.34, mt.metal, 0, 0.064, -0.36, 16);                          // fat barrel
            C(g, 0.04, 0.03, accent, 0, 0.064, -0.51, 16);                              // muzzle ring
            C(g, 0.026, 0.004, mt.poly, 0, 0.064, -0.527, 16);                          // bore
            C(g, 0.038, 0.02, mt.poly, 0, 0.064, -0.3, 16);
            B(g, 0.07, 0.012, 0.22, body, 0, 0.102, -0.38);                            // heat cover
            P.crane = G(g, 0, 0, 0);
            P.cyl = G(P.crane, 0, 0.014, -0.1);                                        // the drum (turns one chamber per shot)
            C(P.cyl, 0.074, 0.17, mt.metal, 0, 0, 0, 18);
            for (let i = 0; i < 6; i++) {
                const a = i / 6 * Math.PI * 2 + Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
                C(P.cyl, 0.022, 0.172, mt.poly, ca * 0.05, sa * 0.05, 0, 10);
                C(P.cyl, 0.018, 0.006, accent, ca * 0.05, sa * 0.05, 0.087, 10);    // grenade bases
                B(P.cyl, 0.012, 0.012, 0.172, body, Math.cos(a + 0.52) * 0.072, Math.sin(a + 0.52) * 0.072, 0);   // flutes
            }
            C(P.cyl, 0.02, 0.18, mt.steel, 0, 0, 0, 10);                                // axle
            B(g, 0.04, 0.11, 0.055, mt.poly, 0, -0.035, 0.13, 0.3);                     // pistol grip
            trigger(0.065, 0.01);
            B(g, 0.032, 0.11, 0.038, mt.poly, 0, -0.025, -0.4);                         // foregrip
            B(g, 0.042, 0.016, 0.06, mt.metal, 0, 0.032, -0.4);
            for (const sx of [-1, 1]) B(g, 0.012, 0.012, 0.24, mt.metal, sx * 0.018, 0.06, 0.28);   // stock rods
            B(g, 0.05, 0.13, 0.03, mt.poly, 0, 0.03, 0.41); B(g, 0.04, 0.02, 0.12, mt.poly, 0, 0.095, 0.33);
            P.sight = G(g, 0, 0, 0);                                                    // flip-up ladder sight (a SCOPE replaces it)
            for (const sx of [-1, 1]) B(P.sight, 0.006, 0.04, 0.012, mt.poly, sx * 0.014, 0.152, 0.03);
            ring(P.sight, 0.011, 0.002, mt.poly, 0, 0.165, 0.03); B(P.sight, 0.03, 0.006, 0.012, mt.poly, 0, 0.135, 0.03);
            B(g, 0.006, 0.036, 0.006, mt.poly, 0, 0.15, -0.18); B(g, 0.004, 0.004, 0.004, mt.red, 0, 0.167, -0.18);   // front post
            P.rh = makeArm(g, [0, -0.045, 0.13], ER, 'grip', 0.3, SW);
            P.lh = makeArm(g, [0, -0.045, -0.4], EL, 'vgrip', 0, SW);
            if (L >= 2) {       // HEAVY: perforated heat shield round the barrel, banded drum
                C(g, 0.046, 0.26, mt.polyDS, 0, 0.064, -0.36, 16, true);
                for (let i = 0; i < 4; i++) C(g, 0.048, 0.012, kitMatG(), 0, 0.064, -0.26 - i * 0.07, 16, true);
                for (const z of [-0.07, 0.07]) C(P.cyl, 0.077, 0.014, accent, 0, 0, z, 18);
            }
            if (L >= 5) P.cyl.traverse(o => { if (o.isMesh && o.material === accent) o.material = pulse; });
            def = { sight: [0.165, 0.06], muzzle: [0, 0.064, -0.545], eject: [0, 0.014, 0.0] };
            break;
        }
        case 'tesla': {         // coil gun: copper coils, a forked emitter with a crackling orb, a glowing capacitor
            const zap = FX.zap = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, emissive: L >= 5 ? 0xc084fc : 0x8ea2ff, emissiveIntensity: 1.6, roughness: 0.3, metalness: 0.2 });
            const copper = VM.copper || (VM.copper = new THREE.MeshStandardMaterial({ color: 0xb87333, roughness: 0.32, metalness: 0.85 }));
            const ceramic = VM.ceramic || (VM.ceramic = new THREE.MeshStandardMaterial({ color: 0xe7e2d6, roughness: 0.35, metalness: 0.05 }));
            B(g, 0.07, 0.085, 0.34, body, 0, 0.035, 0.02);
            B(g, 0.05, 0.03, 0.2, mt.metal, 0, 0.09, 0.0);
            B(g, 0.072, 0.014, 0.28, accent, 0, 0.05, 0.02);
            C(g, 0.018, 0.34, mt.metal, 0, 0.045, -0.3);                               // emitter rod
            const tor = new THREE.TorusGeometry(0.03, 0.008, 6, 18);
            for (let i = 0; i < 6; i++) { const t = new THREE.Mesh(tor, copper); t.position.set(0, 0.045, -0.18 - i * 0.045); g.add(t); }
            for (const z of [-0.14, -0.43]) C(g, 0.042, 0.012, ceramic, 0, 0.045, z, 14);
            for (const sx of [-1, 1]) {
                B(g, 0.012, 0.012, 0.12, mt.steel, sx * 0.028, 0.045, -0.53, 0, -sx * 0.32, 0);    // prongs
                B(g, 0.02, 0.02, 0.02, zap, sx * 0.047, 0.045, -0.585);
                B(g, 0.01, 0.05, 0.12, mt.poly, sx * 0.04, 0.04, 0.08);               // side fins
            }
            P.orb = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), zap); P.orb.position.set(0, 0.045, -0.565); g.add(P.orb);
            P.arc = G(g, 0, 0.045, -0.585);                                            // a little arc that flickers between the prongs
            B(P.arc, 0.034, 0.004, 0.004, zap, -0.022, 0.006, 0, 0, 0, 0.4); B(P.arc, 0.034, 0.004, 0.004, zap, 0.022, 0.006, 0, 0, 0, -0.4);
            P.mag = G(g, 0, 0, 0);                                                      // glass capacitor under the body
            C(P.mag, 0.03, 0.17, mt.glass, 0, -0.035, -0.04, 14);
            C(P.mag, 0.012, 0.16, zap, 0, -0.035, -0.04, 8);
            C(P.mag, 0.034, 0.02, mt.metal, 0, -0.035, 0.05, 14); C(P.mag, 0.034, 0.02, mt.metal, 0, -0.035, -0.13, 14);
            B(g, 0.04, 0.11, 0.055, mt.poly, 0, -0.06, 0.13, 0.25);
            trigger(0.07, -0.01);
            B(g, 0.03, 0.03, 0.05, mt.metal, 0, 0.02, -0.25); B(g, 0.03, 0.1, 0.036, mt.poly, 0, -0.04, -0.25);   // front grip
            B(g, 0.02, 0.02, 0.03, mt.metal, 0, 0.114, 0.03);                          // holo post + glowing ring
            ring(g, 0.018, 0.002, zap, 0, 0.142, 0.03); B(g, 0.003, 0.003, 0.002, mt.red, 0, 0.142, 0.03);
            B(g, 0.045, 0.08, 0.18, body, 0, 0.02, 0.27); B(g, 0.05, 0.11, 0.025, mt.poly, 0, 0.01, 0.37);
            P.rh = makeArm(g, [0, -0.06, 0.13], ER, 'grip', 0.25, SW);
            P.lh = makeArm(g, [0, -0.06, -0.25], EL, 'vgrip', 0, SW);
            if (L >= 2) {       // HEAVY: a second, bigger coil bank and capacitor rails
                const tor2 = new THREE.TorusGeometry(0.04, 0.01, 6, 18);
                for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(tor2, copper); t.position.set(0, 0.045, -0.2 - i * 0.09); g.add(t); }
                for (const sx of [-1, 1]) B(g, 0.012, 0.012, 0.26, zap, sx * 0.05, 0.075, -0.05);
            }
            def = { sight: [0.142, 0.06], muzzle: [0, 0.045, -0.57], eject: [0.03, 0.05, 0.0] };
            break;
        }
        case 'railgun': {       // twin magnetic rails with a glowing channel that brightens as it charges
            const coil = FX.coil = new THREE.MeshStandardMaterial({ color: 0x083344, emissive: 0x22d3ee, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.4 });
            B(g, 0.07, 0.1, 0.4, body, 0, 0.035, 0.0);                                 // receiver
            B(g, 0.072, 0.02, 0.32, accent, 0, 0.06, 0.0);
            B(g, 0.05, 0.022, 0.62, mt.metal, 0, 0.078, -0.5);                         // top rail
            B(g, 0.05, 0.022, 0.62, mt.metal, 0, 0.012, -0.5);                         // bottom rail
            B(g, 0.014, 0.042, 0.6, coil, 0, 0.045, -0.5);                             // the glowing channel between them
            for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) B(g, 0.008, 0.09, 0.024, mt.poly, sx * 0.03, 0.045, -0.28 - i * 0.15);   // braces
            for (const sx of [-1, 1]) {
                B(g, 0.016, 0.05, 0.2, mt.poly, sx * 0.043, 0.045, -0.12);            // capacitor banks
                B(g, 0.004, 0.012, 0.18, coil, sx * 0.052, 0.045, -0.12);
                B(g, 0.008, 0.07, 0.05, mt.metal, sx * 0.03, 0.045, -0.79);           // emitter fins
            }
            P.mag = G(g, 0, 0, 0);                                                      // power cell
            B(P.mag, 0.05, 0.09, 0.1, mt.metal, 0, -0.06, -0.06); B(P.mag, 0.052, 0.025, 0.102, coil, 0, -0.045, -0.06);
            for (const z of [-0.07, 0.07]) B(g, 0.016, 0.04, 0.03, mt.metal, 0, 0.105, z);   // scope mounts
            C(g, 0.028, 0.22, mt.poly, 0, 0.14, 0.0, 16);
            C(g, 0.034, 0.06, mt.poly, 0, 0.14, -0.13, 16); C(g, 0.031, 0.003, mt.lens, 0, 0.14, -0.161, 16);
            C(g, 0.031, 0.05, mt.poly, 0, 0.14, 0.12, 16); C(g, 0.035, 0.01, coil, 0, 0.14, -0.1, 16);
            B(g, 0.04, 0.11, 0.055, mt.poly, 0, -0.05, 0.14, 0.3);
            trigger(0.08, -0.01);
            B(g, 0.05, 0.1, 0.26, body, 0, 0.02, 0.33); B(g, 0.056, 0.13, 0.03, mt.poly, 0, 0.0, 0.47); B(g, 0.04, 0.025, 0.14, mt.poly, 0, 0.082, 0.3);
            P.rh = makeArm(g, [0, -0.055, 0.14], ER, 'grip', 0.3, SW);
            P.lh = makeArm(g, [0, 0.03, -0.34], EL, 'support', 0, SW);
            P.orb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), FX.orbMat = new THREE.MeshBasicMaterial({ color: 0x9ff5ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
            P.orb.position.set(0, 0.045, -0.83); P.orb.scale.setScalar(0.001); g.add(P.orb);
            if (L >= 2) {       // HEAVY: magnetic coil rings round the rails, bigger capacitors
                for (let i = 0; i < 3; i++) C(g, 0.05, 0.02, kitMatG(), 0, 0.045, -0.36 - i * 0.15, 16, true);
                for (const sx of [-1, 1]) B(g, 0.02, 0.06, 0.14, coil, sx * 0.05, 0.045, 0.06);
            }
            def = { sight: [0.14, 0.15], muzzle: [0, 0.045, -0.83], eject: [0.035, 0.06, 0.0] };
            break;
        }
    }
    // ---------- UPGRADE KITS: every level rebuilds the gun into a new model ----------
    // anchors per gun: barrel height, where the barrel section starts/ends, body width, stock end
    // rf/rr = receiver front/rear: the Heavy shroud covers everything from rf to the muzzle
    const A = { pistol: { by: 0.057, b0: -0.17, b1: -0.23, w: 0.046, rf: -0.17, rr: 0.05 }, revolver: { by: 0.064, b0: -0.1, b1: -0.27, w: 0.044, rf: -0.1, rr: 0.04 },
                smg: { by: 0.035, b0: -0.22, b1: -0.47, w: 0.052, stock: 0.29, rf: -0.19, rr: 0.1 }, ar: { by: 0.048, b0: -0.5, b1: -0.73, w: 0.058, stock: 0.49, rf: -0.19, rr: 0.12 },
                burst: { by: 0.03, b0: -0.26, b1: -0.48, w: 0.06, stock: 0.37, rf: -0.27, rr: 0.3 }, shotgun: { by: 0.05, b0: -0.52, b1: -0.74, w: 0.05, stock: 0.5, rf: -0.52, rr: 0.14 },
                dmr: { by: 0.048, b0: -0.58, b1: -0.85, w: 0.058, stock: 0.5, rf: -0.23, rr: 0.16 }, lmg: { by: 0.05, b0: -0.6, b1: -0.8, w: 0.068, stock: 0.49, rf: -0.24, rr: 0.18 },
                sniper: { by: 0.04, b0: -0.46, b1: -0.96, w: 0.056, stock: 0.6, rf: -0.16, rr: 0.22 }, minigun: { by: 0, b0: -0.44, b1: -0.74, w: 0.12, rf: -0.3, rr: 0.18 },
                rpg: { by: 0.07, b0: -0.3, b1: -0.57, w: 0.1, rf: -0.3, rr: 0.3 }, crossbow: { by: 0.05, b0: -0.28, b1: -0.44, w: 0.04, stock: 0.33, rf: -0.15, rr: 0.1 },
                flamer: { by: 0.035, b0: -0.2, b1: -0.6, w: 0.06, rf: -0.2, rr: 0.16 },
                // 4.0 weapons (the katana has its own per-level look). noPort/noShroud/noBrake/noStop skip kit parts that don't suit them
                dual: { by: 0.057, b0: -0.17, b1: -0.23, w: 0.044, rf: -0.17, rr: 0.05 },
                glauncher: { by: 0.064, b0: -0.19, b1: -0.53, w: 0.068, stock: 0.41, rf: -0.04, rr: 0.16, noPort: true, noShroud: true, noBrake: true },
                tesla: { by: 0.045, b0: -0.13, b1: -0.47, w: 0.07, stock: 0.38, rf: -0.15, rr: 0.19, noPort: true, noShroud: true, noBrake: true, noStop: true },
                railgun: { by: 0.045, b0: -0.19, b1: -0.81, w: 0.07, stock: 0.48, rf: -0.2, rr: 0.2, noPort: true, noShroud: true, noBrake: true } }[id];
    const handgun = isHandgun(id);
    // each tier has its own paint scheme (a camo, if you picked one, wins)
    if (camo === CAMOS.stock && L >= 1 && L <= 3) {
        const tone = [0, 0x2b2f36, 0x4a505a, 0xe5e7eb][L];
        if (handgun) mt = Object.assign({}, mt, { metal: new THREE.MeshStandardMaterial({ color: tone, roughness: 0.4, metalness: L === 3 ? 0.2 : 0.5 }) });
        else { body.color.setHex(tone); body.metalness = L === 3 ? 0.15 : 0.35; body.roughness = 0.45; }
    }
    const kitMat = L >= 5 ? body : (handgun ? mt.metal : body);
    const glowMatK = pulse || accent;
    if (A) {        // (the katana has no gun kits)
    const sy = def.sight[0] || 0.2;
    const sh = Math.max(0.03, Math.min(id === 'rpg' ? 0.11 : 0.066, 2 * (sy - A.by) - 0.022));     // shroud height that never blocks the sights
    const sw = A.w * 1.25, slen = A.b0 - A.b1, sz = (A.b0 + A.b1) / 2;
    // ---------- detail pass (every gun, every level): all of it sits below the sights ----------
    {
        const hx = A.w / 2 + 0.002, rmid = (A.rf + A.rr) / 2, rlen = Math.max(0.05, (A.rr - A.rf) * 0.62);
        if (!handgun && id !== 'minigun') {
            for (const s of [-1, 1]) {
                B(g, 0.003, 0.018, rlen, mt.poly, s * hx, A.by - 0.024, rmid);                                   // recessed side panel
                B(g, 0.0035, 0.004, rlen + 0.01, kitMat, s * hx, A.by - 0.012, rmid);                            // panel lip
                for (const z of [A.rf + 0.04, rmid, A.rr - 0.03]) B(g, 0.005, 0.008, 0.008, mt.steel, s * (hx + 0.001), A.by - 0.038, z);   // pins
            }
            if (id !== 'rpg' && !A.noPort) {
                B(g, 0.004, 0.02, 0.055, mt.poly, hx + 0.001, A.by - 0.004, A.rr - 0.07);                        // ejection port
                B(g, 0.005, 0.004, 0.058, mt.steel, hx + 0.002, A.by + 0.007, A.rr - 0.07);                      // dust cover hinge
            }
            B(g, 0.003, 0.009, 0.045, accent, -hx - 0.001, A.by - 0.034, A.rr - 0.11);                           // serial plate
            B(g, 0.008, 0.016, 0.016, mt.steel, 0, A.by - 0.055, A.b0 + 0.05);                                   // front sling swivel
            if (A.stock) { B(g, 0.03, 0.03, 0.006, mt.poly, 0, A.by - 0.03, A.stock - 0.004); B(g, 0.008, 0.016, 0.016, mt.steel, 0, A.by - 0.065, A.stock - 0.08); }   // butt pad + rear swivel
        } else if (id === 'pistol' || id === 'dual') {
            for (let i = 0; i < 5; i++) for (const s of [-1, 1]) B(P.slide || g, 0.003, 0.018, 0.004, mt.poly, s * hx, 0.072, 0.012 + i * 0.008);   // slide serrations
            for (const s of [-1, 1]) B(g, 0.004, 0.008, 0.008, mt.steel, s * hx, 0.04, -0.02);                  // slide stop pin
        } else if (id === 'revolver') {
            for (const s of [-1, 1]) B(g, 0.004, 0.01, 0.01, mt.steel, s * hx, 0.045, 0.01);                    // frame screws
            B(g, 0.012, 0.012, 0.09, mt.steel, 0, 0.042, -0.19);                                                  // ejector rod shroud
        }
    }
    const LASER = { pistol: [-0.03, 0.012, -0.11], revolver: [-0.024, 0.04, -0.2], smg: [-0.035, 0.035, -0.27], ar: [-0.038, 0.045, -0.46], burst: [-0.038, 0.0, -0.22],
                    shotgun: [-0.03, 0.05, -0.6], dmr: [-0.036, 0.045, -0.5], lmg: [-0.036, 0.05, -0.52], sniper: [-0.038, 0.035, -0.4], minigun: [-0.08, 0.03, -0.25], rpg: [-0.06, 0.04, -0.3], crossbow: [-0.03, 0.03, -0.3], flamer: [-0.045, 0.0, -0.3],
                    dual: [-0.03, 0.012, -0.11], glauncher: [-0.05, 0.064, -0.3], tesla: [-0.048, 0.025, -0.1], railgun: [-0.05, 0.012, -0.3] };
    if (L >= 1) {   // TACTICAL: laser sight, handstop, rubber buttpad
        const [lx, ly, lz] = LASER[id];
        B(g, 0.018, 0.024, 0.065, mt.poly, lx - (L >= 2 ? A.w * 0.12 : 0), ly, lz);
        B(g, 0.02, 0.01, 0.03, glowMatK, lx - (L >= 2 ? A.w * 0.12 : 0), ly + 0.016, lz);
        B(g, 0.008, 0.008, 0.004, mt.red, lx - (L >= 2 ? A.w * 0.12 : 0), ly, lz - 0.034);
        const beam = B(g, 0.0035, 0.0035, 4, VM.beam || (VM.beam = new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })), lx - (L >= 2 ? A.w * 0.12 : 0), ly, lz - 2.035);
        beam.renderOrder = 5;
        if (!handgun && id !== 'minigun' && id !== 'rpg' && !A.noStop) B(g, 0.03, 0.05, 0.03, mt.poly, 0, A.by - 0.07, A.b0 + 0.08, 0.5);
        if (!handgun && A.rf > A.b0) for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) B(g, 0.005, 0.028, (A.rf - A.b0) * 0.26, mt.poly, sx * (A.w / 2 + 0.004), A.by - 0.004, A.rf - (A.rf - A.b0) * (0.17 + k * 0.33));   // rail panels
        if (A.stock) B(g, 0.068, 0.15, 0.035, mt.poly, 0, A.by - 0.05, A.stock + 0.02);
        if (handgun) B(g, A.w * 1.05, 0.012, 0.09, mt.poly, 0, A.by - 0.035, -0.08);     // accessory rail
    }
    if (L >= 2) {   // HEAVY: vented barrel shroud, armor plates, extended mag
        // full-length shroud from the receiver to the muzzle
        const f0 = Math.max(A.rf, A.b0), flen = f0 - A.b1, fz = (f0 + A.b1) / 2;
        if (id === 'minigun') C(g, 0.066, flen, mt.polyDS, 0, 0, fz, 16, true);
        else if (!A.noShroud) {
            B(g, sw, sh, flen, kitMat, 0, A.by, fz);
            B(g, sw * 1.02, sh * 0.18, flen * 0.98, mt.poly, 0, A.by - sh * 0.32, fz);
            for (let v = 0; v < 5; v++) for (const sx of [-1, 1]) B(g, 0.004, sh * 0.4, flen * 0.09, mt.poly, sx * (sw / 2 + 0.001), A.by + sh * 0.1, f0 - flen * (0.1 + v * 0.19));
        }
        // chunky armor plates over the receiver
        const plen = (A.rr - A.rf) * 0.8, pz = (A.rr + A.rf) / 2;
        for (const sx of [-1, 1]) { B(g, 0.008, handgun ? 0.034 : 0.075, plen, kitMat, sx * (A.w / 2 + 0.006), A.by - (handgun ? 0.035 : 0.022), pz); B(g, 0.01, 0.01, plen * 0.9, mt.poly, sx * (A.w / 2 + 0.008), A.by - (handgun ? 0.035 : 0.022), pz); }
        if (P.mag) { if (id === 'lmg' || id === 'minigun') P.mag.scale.setScalar(1.18); else P.mag.scale.y = 1.3; }
        if (id === 'shotgun') for (let i = 0; i < 4; i++) { B(g, 0.012, 0.055, 0.022, VM.shellRed, 0.035, 0.03, -0.08 + i * 0.028); B(g, 0.013, 0.014, 0.023, VM.brass, 0.035, 0.0, -0.08 + i * 0.028); }
        if (id === 'revolver') for (let i = 0; i < 3; i++) C(g, 0.008, 0.004, VM.brass, -0.03, -0.02 - i * 0.02, 0.09, 8);
        if (def.muzzle[2] > A.b1 - 0.005) def.muzzle = [def.muzzle[0], def.muzzle[1], A.b1 - 0.005];
    }
    if (L >= 3) {   // ELITE: muzzle brake, glowing side strips, top fin, cheek riser
        if (id !== 'minigun' && id !== 'rpg' && id !== 'crossbow' && id !== 'flamer' && !A.noBrake) {
            const r = handgun ? 0.02 : 0.028;
            const md = G(g, def.muzzle[0], def.muzzle[1], def.muzzle[2] - 0.03);
            B(md, r * 2, r * 2, 0.06, mt.poly, 0, 0, 0);
            B(md, r * 2.15, r * 0.6, 0.012, glowMatK, 0, 0, -0.02);
            B(md, r * 0.5, r * 2.1, 0.034, mt.metal, 0, 0, 0.004);
            def.muzzle = [def.muzzle[0], def.muzzle[1], def.muzzle[2] - 0.062];
        }
        for (const sx of [-1, 1]) B(g, 0.004, 0.008, slen * 0.85 + (handgun ? 0.06 : 0.25), glowMatK, sx * (sw / 2 + 0.004), A.by + sh * 0.2, sz + (handgun ? 0.03 : 0.12));
        if (A.by + sh / 2 + 0.02 < sy - 0.035) B(g, 0.006, 0.02, slen * 0.7, glowMatK, 0, A.by + sh / 2 + 0.01, sz);
        if (A.stock) {   // angular elite stock shell with glowing windows (always kept below your eye line)
            const top = Math.min(A.by + 0.035, sy - 0.045), bot = A.by - 0.095;
            B(g, A.w * 1.18, top - bot, 0.3, kitMat, 0, (top + bot) / 2, A.stock - 0.15);
            B(g, A.w * 1.2, 0.03, 0.12, glowMatK, 0, Math.min(A.by - 0.01, top - 0.02), A.stock - 0.17);
        }
        if (handgun) for (const sx of [-1, 1]) B(g, 0.004, 0.012, 0.05, glowMatK, sx * (A.w / 2 + 0.004), A.by + 0.01, -0.1);   // slide windows
    }
    if (L >= 5) {   // PLASMA PROTOTYPE: energy coils, glowing cell, core, stock fins
        const cr = Math.max(sw * 0.62, sh * 0.62, id === 'minigun' ? 0.075 : 0);
        for (let k = 0; k < 4; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(cr, 0.006, 6, 18), glowMatK); t.position.set(0, A.by, A.b0 - slen * (0.12 + k * 0.25)); g.add(t); }
        if (P.mag) P.mag.traverse(o => { if (o.isMesh) o.material = glowMatK; });
        B(g, 0.012, 0.035, 0.07, glowMatK, -(A.w / 2 + 0.009), A.by - 0.01, handgun ? -0.03 : 0.03);
        if (A.stock) for (const sx of [-1, 1]) B(g, 0.006, 0.06, 0.12, kitMat, sx * (A.w * 0.6 + 0.01), Math.min(A.by + 0.01, sy - 0.07), A.stock - 0.05, 0, sx * 0.25, sx * 0.3);
    }
    }   // if (A)
    // ---------- 4.0 ATTACHMENTS: bolted onto the finished model ----------
    if (!VM.attC) {      // shared attachment paints (VM materials are never disposed)
        VM.attC = new THREE.MeshBasicMaterial({ color: ATTACH.scope.color, toneMapped: false });
        VM.attY = new THREE.MeshStandardMaterial({ color: ATTACH.mag.color, roughness: 0.45, metalness: 0.3, emissive: 0x6b5200, emissiveIntensity: 0.5 });
        VM.attG = new THREE.MeshStandardMaterial({ color: ATTACH.grip.color, roughness: 0.6, metalness: 0.1, emissive: 0x2d4a00, emissiveIntensity: 0.4 });
        VM.attRub = new THREE.MeshStandardMaterial({ color: 0x2b2e26, roughness: 0.95, metalness: 0.0 });
        VM.attTube = new THREE.MeshStandardMaterial({ color: 0x22252c, roughness: 0.5, metalness: 0.45, side: THREE.DoubleSide });
    }
    if (hasAtt(id, 'scope')) {     // a see-through 2x sight on a riser; you aim through the tube
        const [my, mz] = ATT_FIT[id].scope, par = id === 'lmg' ? P.lid : g;
        if (P.sight) P.sight.visible = false;                                    // the old sight comes off
        const R = 0.026, cy = my + 0.018 + R, sc = G(par, 0, cy, mz);
        C(sc, R, 0.15, VM.attTube, 0, 0, 0, 18, true);                           // main tube (open both ends)
        C(sc, R * 1.3, 0.05, VM.attTube, 0, 0, -0.095, 18, true);                // objective bell
        C(sc, R * 1.16, 0.045, VM.attTube, 0, 0, 0.088, 18, true);               // eyepiece
        C(sc, R * 1.32, 0.008, VM.attC, 0, 0, -0.118, 18, true);                 // glowing bezel
        C(sc, R * 1.2, 0.002, mt.glass, 0, 0, -0.105, 18);                       // front glass
        B(sc, 0.016, 0.014, 0.024, VM.attTube, 0, R + 0.006, -0.01); B(sc, 0.014, 0.016, 0.024, VM.attTube, R + 0.006, 0, -0.01);   // turrets
        B(sc, 0.0036, 0.0036, 0.002, VM.green, 0, 0, -0.03);                      // reticle: a glowing dot...
        for (const [x, y, w2, h2] of [[0, -R * 0.62, 0.0011, R * 0.62], [0, R * 0.62, 0.0011, R * 0.62], [-R * 0.62, 0, R * 0.62, 0.0011], [R * 0.62, 0, R * 0.62, 0.0011]])
            B(sc, w2, h2, 0.001, mt.poly, x, y, -0.03);                           // ...and fine cross lines
        for (const sx of [-1, 1]) for (const z of [-0.045, 0.045]) B(sc, 0.007, 0.02, 0.016, mt.metal, sx * 0.016, -R - 0.008, z);   // riser posts
        B(sc, 0.046, 0.006, 0.12, mt.metal, 0, -R - 0.015, 0);                    // mount plate
        def.sight = [cy + (par === g ? 0 : par.position.y), mz + 0.11 + (par === g ? 0 : par.position.z)];
    }
    if (hasAtt(id, 'grip')) {
        const f = ATT_FIT[id].grip;
        if (f[0] === 'hand') {      // handguns: a stippled rubber sleeve with green ridges
            const [, y, z, rx, gx, gy, gz] = f;
            B(g, gx + 0.006, gy * 0.82, gz + 0.006, VM.attRub, 0, y + 0.004, z, rx);
            for (let i = 0; i < 4; i++) B(g, gx + 0.009, 0.007, gz + 0.009, VM.attG, 0, y - 0.035 + i * 0.024, z + (0.035 - i * 0.024) * Math.tan(rx) * 0.5, rx);
        } else {                     // long guns: a vertical foregrip, and the support hand moves onto it
            const par = id === 'shotgun' ? P.pump : g, [y, z] = f;
            B(par, 0.04, 0.014, 0.06, mt.metal, 0, y - 0.006, z);                // rail clamp
            B(par, 0.03, 0.1, 0.036, VM.attRub, 0, y - 0.062, z + 0.006, 0.12);  // grip (raked a little)
            B(par, 0.034, 0.014, 0.04, VM.attG, 0, y - 0.11, z + 0.012, 0.12);   // green end cap
            if (P.lh && P.lh.userData.style === 'support') {
                P.lh.parent.remove(P.lh);
                P.lh = makeArm(par, [0, y - 0.078, z + 0.008], par === g ? EL : [EL[0], EL[1], EL[2] + 0.38], 'vgrip', 0.12, SW);
            }
        }
    }
    if (hasAtt(id, 'mag')) {
        if (id === 'shotgun') {      // a longer tube under the barrel with a yellow end cap
            C(g, 0.017, 0.14, mt.metal, 0, 0.004, -0.72); C(g, 0.021, 0.02, VM.attY, 0, 0.004, -0.795); C(g, 0.02, 0.014, mt.metal, 0, 0.004, -0.655);
        } else if (P.mag) {
            const meshes = P.mag.children.filter(c => c.isMesh);
            if (['lmg', 'minigun', 'flamer', 'tesla', 'railgun'].includes(id)) {
                // drums / tanks / cells just get bigger, with a yellow band round the middle
                P.mag.scale.multiplyScalar(1.16);
                const big = meshes.reduce((a, b) => (!a || b.scale.x * b.scale.y * b.scale.z > a.scale.x * a.scale.y * a.scale.z ? b : a), null);
                if (big) { const band = new THREE.Mesh(big.geometry, VM.attY); band.position.copy(big.position); band.rotation.copy(big.rotation);
                           if (big.geometry === sharedBox) band.scale.set(big.scale.x * 1.05, big.scale.y * 0.22, big.scale.z * 1.05); else band.scale.set(1.06, 1.06, 0.18);
                           P.mag.add(band); }
            } else {                // stick mags: longer, with a yellow base plate
                const k = 1.3;
                P.mag.scale.y *= k;
                const low = meshes.reduce((a, b) => (!a || b.position.y < a.position.y ? b : a), null);
                if (low) { const pl = new THREE.Mesh(sharedBox, VM.attY); pl.rotation.copy(low.rotation);
                           pl.scale.set(low.scale.x * 1.18, 0.022 / P.mag.scale.y, low.scale.z * 1.12);
                           pl.position.copy(low.position).add(new V3(0, -(low.scale.y / 2 + 0.008 / P.mag.scale.y), 0).applyEuler(low.rotation));
                           P.mag.add(pl); }
                // ...and a yellow band just under the mag well, where you can actually see it
                const top = meshes.reduce((a, b) => (!a || b.position.y > a.position.y ? b : a), null);
                if (top && !isHandgun(id)) { const bd = new THREE.Mesh(sharedBox, VM.attY); bd.rotation.copy(top.rotation);
                           bd.scale.set(top.scale.x * 1.1, 0.018 / P.mag.scale.y, top.scale.z * 1.08);
                           bd.position.copy(top.position).add(new V3(0, top.scale.y / 2 - 0.06 / P.mag.scale.y, 0).applyEuler(top.rotation));
                           P.mag.add(bd); }
            }
        }
    }
    if (id === 'dual') {   // akimbo: the finished right-hand gun (kits, attachments and all) is mirrored into the left hand
        const gL = g.clone(); gL.scale.x = -GS; gL.position.x = -g.position.x; root.add(gL);
        P.gunR = g; P.gunL = gL; P.slideL = gL.getObjectByName('slide'); P.magL = gL.getObjectByName('mag');
    }
    for (const k in P) { P[k].userData.p0 = P[k].position.clone(); P[k].userData.r0 = P[k].rotation.clone(); }


    // Muzzle flash: a camera-facing star plus two crossed planes along the barrel
    const flash = new THREE.Group(); flash.position.fromArray(def.muzzle);
    const fs = w.flash / GS;
    const f1 = new THREE.Mesh(_planeGeo, VM.flash); f1.scale.set(fs, fs, 1);
    const f2 = new THREE.Mesh(_planeGeo, VM.flash); f2.scale.set(fs * 1.7, fs * 0.55, 1); f2.rotation.y = Math.PI / 2; f2.position.z = -fs * 0.6;
    const f3 = new THREE.Mesh(_planeGeo, VM.flash); f3.scale.set(fs * 0.55, fs * 1.7, 1); f3.rotation.x = Math.PI / 2; f3.position.z = -fs * 0.6;
    flash.add(f1, f2, f3); flash.visible = false; g.add(flash);
    const muzzle = new THREE.Object3D(); muzzle.position.fromArray(def.muzzle); g.add(muzzle);
    const eject = new THREE.Object3D(); eject.position.fromArray(def.eject); g.add(eject);


    root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    root.visible = false;
    weaponCam.add(root);
    if (FX.trail) weaponCam.add(FX.trail);
    if (FX.ox) {           // dual pistols: where the left gun's muzzle / ejection port are, in the right gun's space
        FX.mx = [def.muzzle[0], -2 * FX.ox / GS - def.muzzle[0]]; FX.ex = [def.eject[0], -2 * FX.ox / GS - def.eject[0]];
    }
    return { id, root, g, P, def, flash, muzzle, eject, rack: 0, level: L, pulse, rainbow, camo: settings.camo, atts: attKey(id), fx: FX };
}
function getModel(id) {
    const L = playerStats.upgrades[id] || 0, m = models[id];
    if (m && m.level === L && m.camo === settings.camo && m.atts === attKey(id)) return m;
    if (m) {   // upgraded / new camo / new attachment: rebuild with the new look, free the old one's own materials
        weaponCam.remove(m.root); if (vmModel === m) vmModel = null;
        if (m.fx.trail) { weaponCam.remove(m.fx.trail); m.fx.trail.geometry.dispose(); m.fx.trail.material.dispose(); }
        const shared = new Set(Object.values(VM));
        m.root.traverse(o => { if (o.isMesh && !shared.has(o.material)) o.material.dispose(); });
    }
    return (models[id] = buildWeaponModel(id));
}


function showWeaponModel(id) {
    if (vmModel) vmModel.root.visible = false;
    vmModel = getModel(id);
    vmModel.root.visible = true;
    vm.raise = 0; vm.inspect = 0; vm.pump = 0; vm.bolt = -1; vm.hammer = 0; vm.slideKick = 0;
    spinT = 0; burstLeft = 0; heat = 0;
    vm.slashT = 0; vm.slideKickL = 0; slashAt = -1; if (railC > 0) railCancel();       // 4.0 weapons
}


// Spent casings fly out of the ejection port (they live in the gun's camera space)
const casings = [];
function ejectCasing(m, kind = 'brass', count = 1, flip = 0) {
    if (!m || !m.root.visible) return;
    m.root.updateMatrixWorld(true); weaponCam.updateMatrixWorld(true);
    for (let c = 0; c < count; c++) {
        let cs = casings.find(x => x.life <= 0);
        if (!cs) {
            if (casings.length >= 18) cs = casings[0];
            else { const mesh = new THREE.Mesh(sharedBox, VM.brass); mesh.frustumCulled = false; weaponCam.add(mesh); cs = { mesh, life: 0, v: new V3(), spin: new V3() }; casings.push(cs); }
        }
        const shell = kind === 'shell';
        cs.mesh.material = shell ? VM.shellRed : VM.brass;
        cs.mesh.scale.set(shell ? 0.016 : 0.007, shell ? 0.016 : 0.007, shell ? 0.045 : 0.02);
        m.eject.getWorldPosition(_p); weaponCam.worldToLocal(_p);
        cs.mesh.position.copy(_p);
        if (kind === 'dump') cs.v.set((Math.random() - 0.5) * 0.3, -0.6 - Math.random() * 0.4, 0.15 + Math.random() * 0.2);
        else cs.v.set((0.8 + Math.random() * 0.5) * (flip ? -1 : 1), 0.8 + Math.random() * 0.5, 0.2 + Math.random() * 0.3);
        cs.spin.set(Math.random() * 30, Math.random() * 30, Math.random() * 30);
        cs.mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
        cs.life = 0.6; cs.mesh.visible = true;
    }
}
function updateCasings(dt) {
    for (const cs of casings) {
        if (cs.life <= 0) continue;
        cs.life -= dt;
        cs.v.y -= 6 * dt;
        cs.mesh.position.addScaledVector(cs.v, dt);
        cs.mesh.rotation.x += cs.spin.x * dt; cs.mesh.rotation.y += cs.spin.y * dt;
        if (cs.life <= 0) cs.mesh.visible = false;
    }
}


// Reload animation: returns root offsets and poses the mag / hand / moving parts
const RP = { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0 };
function reloadPose(m) {
    RP.px = RP.py = RP.pz = RP.rx = RP.ry = RP.rz = 0;
    const P = m.P;
    let magDy = 0, magDz = 0, magVis = true, lx = 0, ly = 0, lz = 0, lidR = 0, craneX = 0, boltOpen = 0, rack = 0;
    if (isReloading || (reloadStyle === 'shell' && reloadEnding > 0)) {
        const t = isReloading ? clamp(1 - reloadTimer / reloadTotal, 0, 1) : 1;
        switch (reloadStyle) {
            case 'mag': case 'box': case 'bolt': {
                const heavy = reloadStyle === 'box';
                const k = ease(Math.min(seg(t, 0, 0.14), 1 - seg(t, 0.86, 1)));
                RP.rz = (heavy ? 0.3 : 0.5) * k; RP.rx = 0.14 * k; RP.px = -0.04 * k; RP.py = 0.01 * k; RP.ry = -0.12 * k;
                if (reloadStyle === 'bolt') boltOpen = Math.min(seg(t, 0.04, 0.16), 1 - seg(t, 0.8, 0.92));
                if (heavy) lidR = Math.min(seg(t, 0.08, 0.2), 1 - seg(t, 0.78, 0.88));
                if (t < 0.38) { magDy = -0.5 * Math.pow(seg(t, 0.16, 0.38), 2); magVis = t < 0.37; }
                const hd = bump(t, 0.24, 0.64);               // hand dips off-screen for a fresh mag
                lx = -0.02 * hd; ly = -0.32 * hd; lz = 0.08 * hd;
                if (t >= 0.38 && t < 0.64) { magDy = ly; magDz = lz; }
                const seat = bump(t, 0.62, 0.7);
                RP.py -= 0.012 * seat; RP.rx += 0.06 * seat;
                rack = bump(t, 0.72, 0.86); RP.rz += 0.12 * rack; RP.pz += 0.02 * rack;
                break;
            }
            case 'dual': {      // 4.0 akimbo: both guns tip down, the mags drop out, fresh ones slide up, slides rack
                const k = ease(Math.min(seg(t, 0, 0.16), 1 - seg(t, 0.82, 1)));
                RP.rx = -0.5 * k; RP.py = -0.06 * k; RP.pz = 0.03 * k;
                if (t < 0.4) { magDy = -0.5 * Math.pow(seg(t, 0.12, 0.38), 2); magVis = t < 0.37; }
                else magDy = -0.14 * (1 - ease(seg(t, 0.42, 0.62)));
                const seat = bump(t, 0.6, 0.68); RP.py -= 0.01 * seat; RP.rx += 0.05 * seat;
                rack = bump(t, 0.72, 0.86); RP.rx += 0.14 * rack;
                break;
            }
            case 'revolver': {
                const k = ease(Math.min(seg(t, 0, 0.14), 1 - seg(t, 0.84, 1)));
                RP.rz = 0.95 * k; RP.rx = 0.35 * k; RP.py = 0.03 * k; RP.px = -0.05 * k;
                craneX = Math.min(seg(t, 0.1, 0.2), 1 - seg(t, 0.72, 0.8));
                const hd = bump(t, 0.3, 0.66); lx = 0.03 * hd; ly = -0.28 * hd; lz = 0.05 * hd;
                RP.rx -= 0.3 * bump(t, 0.2, 0.32);            // flick to dump the empties
                break;
            }
            case 'shell': {
                const k = ease(clamp(reloadElapsed / 0.22, 0, 1)) * (isReloading ? 1 : clamp(reloadEnding / 0.3, 0, 1));
                RP.rz = -0.35 * k; RP.ry = 0.12 * k; RP.rx = 0.12 * k; RP.py = 0.01 * k;
                const st = W(m.id).shellTime / 1000;
                const c = (isReloading && reloadElapsed > 0.25) ? 1 - shellTimer / st : 0;
                const b = Math.sin(Math.PI * clamp(c, 0, 1));
                lx = 0; ly = -0.05 * k - 0.07 * b; lz = 0.34 * k + 0.05 * b;
                break;
            }
        }
    }
    if (P.mag) { const p0 = P.mag.userData.p0; P.mag.position.set(p0.x, p0.y + magDy, p0.z + magDz); P.mag.visible = magVis; }
    if (P.magL) { const p0 = P.magL.userData.p0; P.magL.position.set(p0.x, p0.y + magDy, p0.z + magDz); P.magL.visible = magVis; }
    m.rackK = rack;
    if (m.id === 'rpg' && P.mag) P.mag.visible = isReloading ? (1 - reloadTimer / reloadTotal) > 0.38 : ammoState.rpg > 0;
    if (P.lh) { const p0 = P.lh.userData.p0; P.lh.position.set(p0.x + lx, p0.y + ly, p0.z + lz); }
    if (P.lid) P.lid.rotation.x = -1.1 * ease(lidR);
    if (P.crane) P.crane.position.x = -0.05 * ease(craneX);
    if (P.charge) P.charge.position.z = P.charge.userData.p0.z + 0.05 * rack;
    m.boltOpen = boltOpen; m.craneOpen = craneX;
    return RP;
}


function updateViewmodel(dt, sprinting, moving) {
    const m = vmModel; if (!m) return;
    const id = m.id, w = W(id), d = m.def, S = VM_SCALE * (w.vmScale || 1), hip = weaponsDb[id].hip;
    const a = ease(vm.adsT);


    vm.sprint = damp(vm.sprint, sprinting && onGround ? 1 : 0, 10, dt);
    if (moving) vm.bob += dt * (sprinting ? 13.5 : 9.5);
    vm.bobAmt = damp(vm.bobAmt, moving ? (sprinting ? 0.02 : 0.011) : 0, 8, dt);
    vm.raise = Math.min(1, vm.raise + dt * 3.2);
    vm.kick = damp(vm.kick, 0, 14, dt); vm.kickRot = damp(vm.kickRot, 0, 11, dt); vm.kickRoll = damp(vm.kickRoll, 0, 10, dt);
    vm.land = damp(vm.land, 0, 8, dt);
    vm.swayX = damp(vm.swayX, 0, 7, dt); vm.swayY = damp(vm.swayY, 0, 7, dt);
    vm.slideTilt = damp(vm.slideTilt, slideT > 0 ? 1 : 0, 10, dt);
    vm.inspect = Math.max(0, vm.inspect - dt);
    vm.slideKick = damp(vm.slideKick, 0, 22, dt);
    vm.hammer = Math.max(0, vm.hammer - dt / 0.3);
    vm.pump = Math.max(0, vm.pump - dt);
    vm.melee = Math.max(0, (vm.melee || 0) - dt);


    let px, py, pz;
    if (w.noAds) { px = lerp(hip[0], hip[0] - 0.04, a); py = lerp(hip[1], hip[1] + 0.025, a); pz = lerp(hip[2], hip[2] + 0.05, a); }
    else { px = lerp(hip[0], 0, a); py = lerp(hip[1], -d.sight[0] * S, a); pz = lerp(hip[2], -w.adsDist - d.sight[1] * S, a); }
    let rx = 0, ry = lerp(0.03, 0, a), rz = 0;
    const free = 1 - a * 0.85;
    const sp = vm.sprint * (1 - a);
    px -= 0.03 * sp; py -= 0.05 * sp; pz += 0.03 * sp; rx -= 0.3 * sp; ry += 0.65 * sp; rz += 0.3 * sp;
    const bA = vm.bobAmt * (1 - 0.9 * a);
    px += Math.cos(vm.bob) * bA; py -= Math.abs(Math.sin(vm.bob)) * bA * 1.2; rz += Math.cos(vm.bob) * bA * 1.6; rx += Math.sin(vm.bob * 2) * bA * 0.5;
    py += Math.sin(gameTime * 1.7) * 0.0022 * free; rx += Math.sin(gameTime * 1.3) * 0.004 * free;
    px += vm.swayX * (1 - 0.8 * a); py += vm.swayY * (1 - 0.8 * a);
    ry += vm.swayX * 2.4 * (1 - 0.7 * a); rx += vm.swayY * 1.5 * (1 - 0.7 * a); rz -= vm.swayX * 1.4 * (1 - 0.5 * a);
    pz += vm.kick; rx += vm.kickRot; rz += vm.kickRoll; py += vm.kickRot * 0.03;
    py -= vm.land; rx -= vm.land * 0.9;
    const r = 1 - ease(vm.raise); py -= r * 0.28; rx -= r * 1.1; rz += r * 0.3;
    rz += vm.slideTilt * 0.35 * (1 - a * 0.7); px -= vm.slideTilt * 0.025 * (1 - a); py -= vm.slideTilt * 0.015;
    if (vm.inspect > 0) {
        const t = 1 - vm.inspect / 2.4;
        const k1 = ease(Math.min(seg(t, 0, 0.18), 1 - seg(t, 0.82, 1)));
        const k2 = bump(t, 0.4, 0.8);
        ry += 0.95 * k1 - 1.5 * k2; rz -= 0.35 * k1; px -= 0.07 * k1; py += 0.03 * k1; pz += 0.04 * k1; rx += 0.3 * k2;
    }
    if (vm.melee > 0) {   // melee shove: gun jabs forward and cants over
        const t = 1 - vm.melee / 0.4, k = bump(t, 0, 0.55), back = bump(t, 0.4, 1) * 0.3;
        pz -= 0.16 * k - 0.03 * back; px -= 0.06 * k; py += 0.03 * k; rz += 0.9 * k; ry += 0.35 * k; rx -= 0.15 * k;
    }
    if (m.fx.trail) {          // 4.0 KATANA: slashes (3 directions in turn) and the lunge thrust
        if (vm.slashT > 0) {
            if (!debugSlashHold) vm.slashT = Math.max(0, vm.slashT - dt);
            const t = 1 - vm.slashT / vm.slashDur, W0 = SLASH_POSE[vm.slashDir][0], S1 = SLASH_POSE[vm.slashDir][1];
            const k1 = ease(seg(t, 0, 0.18)), k2 = ease(seg(t, 0.18, 0.5)), k3 = ease(seg(t, 0.58, 1));
            for (let i = 0; i < 6; i++) _pose[i] = t < 0.18 ? W0[i] * k1 : (t < 0.58 ? W0[i] + (S1[i] - W0[i]) * k2 : S1[i] * (1 - k3));
            px += _pose[0]; py += _pose[1]; pz += _pose[2]; rx += _pose[3]; ry += _pose[4]; rz += _pose[5];
            const tr = m.fx.trail, op = 0.6 * bump(t, 0.16, 0.62);
            tr.visible = op > 0.01; tr.material.opacity = op;
            // right-to-left: arc over the top from the right; backhand: mirrored; overhead: a steep arc down the middle
            if (vm.slashDir === 2) { tr.position.set(0.06, 0.0, -0.5); tr.rotation.set(0, 0, Math.PI / 2 - 0.2); tr.scale.set(0.5, 1, 1); }
            else { tr.position.set(vm.slashDir === 1 ? -0.02 : 0.02, -0.1, -0.5); tr.rotation.set(0, vm.slashDir === 1 ? Math.PI : 0, -0.25); tr.scale.set(1.25, 0.8, 1); }
        } else m.fx.trail.visible = false;
        if (lungeT > 0 || vm.lungeK > 0) {
            vm.lungeK = lungeT > 0 ? Math.min(1, vm.lungeK + dt * 14) : Math.max(0, vm.lungeK - dt * 5);
            const k = ease(vm.lungeK);
            px -= 0.12 * k; py += 0.05 * k; pz -= 0.14 * k; rx -= 0.75 * k; ry += 0.25 * k; rz -= 0.5 * k;
        }
    }
    const R = reloadPose(m);
    px += R.px; py += R.py; pz += R.pz; rx += R.rx; ry += R.ry; rz += R.rz;


    // weapon-specific moving parts
    const P = m.P;
    if (P.slide) P.slide.position.z = 0.035 * Math.max(vm.slideKick, ammoState[id] <= 0 && !isReloading ? 1 : 0);
    if (P.hammer) P.hammer.rotation.x = -0.55 * (1 - vm.hammer);
    if (P.cyl) {
        if (m.craneOpen > 0.5) vm.cylTarget += dt * 14;
        vm.cylRot = damp(vm.cylRot, vm.cylTarget, 18, dt); P.cyl.rotation.z = vm.cylRot;
    }
    if (P.pump) {
        const k = vm.pump > 0 ? bump(1 - vm.pump / 0.5, 0.18, 0.95) : 0;
        P.pump.position.z = P.pump.userData.p0.z + 0.11 * k;
        rx += 0.05 * k; rz -= 0.04 * k;
    }
    if (P.bolt) {
        let open = m.boltOpen || 0, back = m.boltOpen || 0;
        if (vm.bolt >= 0) {
            vm.bolt += dt;
            const t = (vm.bolt - 0.12) / 0.7;
            if (t > 0) {
                open = Math.max(open, Math.min(seg(t, 0, 0.2), 1 - seg(t, 0.8, 1)));
                back = Math.max(back, Math.min(seg(t, 0.2, 0.45), 1 - seg(t, 0.55, 0.8)));
                rz += 0.12 * Math.min(seg(t, 0, 0.2), 1 - seg(t, 0.8, 1)); ry -= 0.06 * back;
                if (t > 0.45 && !vm.boltEjected) { vm.boltEjected = true; ejectCasing(m); sfx('bolt'); }
            }
            if (t >= 1) vm.bolt = -1;
        }
        P.bolt.rotation.z = 1.1 * ease(open);
        P.bolt.position.z = P.bolt.userData.p0.z + 0.08 * ease(back);
    }
    if (P.barrels) { vm.spinAngle += spinT * 42 * dt; P.barrels.rotation.z = vm.spinAngle; px += (Math.random() - 0.5) * 0.002 * (isMouseDown && spinT >= 1 ? 1 : 0); }
    // 4.0 weapons
    vm.slideKickL = damp(vm.slideKickL || 0, 0, 22, dt);
    if (P.gunL) {              // DUAL PISTOLS: each gun kicks on its own; aiming pulls them in and toes them in
        const ox = lerp(m.fx.ox, m.fx.ox * 0.64, a), empty = ammoState[id] <= 0 && !isReloading;
        P.gunR.position.x = ox; P.gunL.position.x = -ox;
        P.gunR.rotation.set(0.16 * vm.slideKick, -0.07 * a, 0); P.gunL.rotation.set(0.16 * vm.slideKickL, 0.07 * a, 0);
        const rk = m.rackK || 0;
        if (P.slide) P.slide.position.z = 0.035 * Math.max(vm.slideKick, empty ? 1 : 0, rk);
        if (P.slideL) P.slideL.position.z = 0.035 * Math.max(vm.slideKickL, empty ? 1 : 0, rk);
    }
    if (m.fx.coil) {           // RAILGUN: the channel and the muzzle orb glow brighter as it charges
        const c = railC, full = c >= 1;
        m.fx.coil.emissiveIntensity = 0.5 + 3.2 * c + (full ? Math.sin(gameTime * 45) * 0.6 : 0);
        P.orb.scale.setScalar(0.001 + c * (full ? 1.15 + Math.sin(gameTime * 32) * 0.18 : 0.9));
        m.fx.orbMat.opacity = 0.45 + 0.55 * c;
        if (c > 0) { px += (Math.random() - 0.5) * 0.0025 * c; py += (Math.random() - 0.5) * 0.0025 * c; }
    }
    if (m.fx.zap) {            // TESLA: the orb and capacitor flicker, and an arc crackles between the prongs
        vm.zapT = Math.max(0, (vm.zapT || 0) - dt);
        const fl = Math.random(), hot = vm.zapT > 0;
        m.fx.zap.emissiveIntensity = 1.1 + fl * 1.1 + (hot ? 3 : 0);
        P.orb.scale.setScalar(0.8 + fl * 0.35 + (hot ? 0.7 : 0));
        P.arc.visible = hot || fl < 0.3; P.arc.rotation.z = fl * 6.28;
    }


    m.root.position.set(px, py, pz);
    m.root.rotation.set(rx, ry, rz);


    if (m.pulse) m.pulse.emissive.setHSL((gameTime * 0.12) % 1, 0.85, 0.55);
    if (m.rainbow) { m.rainbow.color.setHSL((gameTime * 0.1) % 1, 0.75, 0.55); m.rainbow.emissive.setHSL((gameTime * 0.1) % 1, 0.9, 0.3); }
    const fm = VM.flash;
    fm.opacity = Math.max(0, fm.opacity - dt * 20);
    m.flash.visible = fm.opacity > 0.01;
    vmLight.intensity = Math.max(0, vmLight.intensity - dt * 60);
    weaponCam.fov = lerp(VM_FOV, VM_FOV - 8, w.noAds ? 0 : a);
    weaponCam.updateProjectionMatrix();
}
