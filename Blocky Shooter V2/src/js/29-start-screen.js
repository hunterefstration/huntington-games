// ---------- 5.0 START SCREEN: home menu + animated 3D scene (shambling zombies, drifting camera, fog, firelight) ----------
function setMenuView(v) {
    menuView = v;
    const o = $('main-menu-overlay'); o.dataset.view = v;
    $('home-menu').classList.toggle('hidden', v !== 'home');
    $('setup-menu').classList.toggle('hidden', v !== 'setup');
    $('camp-menu').classList.toggle('hidden', v !== 'camp'); $('camp-brief').classList.add('hidden');
    if (v === 'camp') renderCampMenu(); else if (CAMP.ready) campMenuLabel();
    if (v === 'setup') { renderMenu(); $('menu-panel').scrollTop = 0; }
    else { updateContinueBtn(); renderRankBar(); updateMenuBest(); }
}
$('btn-home-play').addEventListener('click', () => { initAudio(); sfx('click'); setMenuView('setup'); });
$('btn-setup-back').addEventListener('click', () => { initAudio(); sfx('click'); setMenuView('home'); });
$('btn-campaign').addEventListener('click', () => { initAudio(); sfx('click'); setMenuView('camp'); });

function buildMenuZombies() {
    const G = (w, h, d, y) => new THREE.BoxGeometry(w, h, d).translate(0, y, 0);
    const geo = { torso: G(0.62, 0.86, 0.36, 0), head: G(0.42, 0.42, 0.42, 0), arm: G(0.2, 0.76, 0.2, -0.36), leg: G(0.25, 0.8, 0.27, -0.4), eyes: G(0.3, 0.06, 0.02, 0) };
    const L = (c) => new THREE.MeshLambertMaterial({ color: c });
    const skins = [L(0x6f8f5c), L(0x7f9a70), L(0x5e7d6b), L(0x8a8f68)], shirts = [L(0x3a4766), L(0x5a3a3a), L(0x3d5a3d), L(0x4a4a52), L(0x6a5a3a)];
    const pants = L(0x22252e), eye = new THREE.MeshBasicMaterial({ color: 0xff3b2a });
    MZ.grp = new THREE.Group(); MZ.grp.visible = false; scene.add(MZ.grp);
    MZ.n = (Q && Q.lite) ? 8 : 12;
    for (let i = 0; i < MZ.n; i++) {
        const skin = skins[i % skins.length], shirt = shirts[(i * 3 + 1) % shirts.length];
        const g = new THREE.Group(), body = new THREE.Group();
        const mk = (geom, mat, x, y, z, par) => { const m = new THREE.Mesh(geom, mat); m.position.set(x, y, z); (par || g).add(m); return m; };
        const legL = mk(geo.leg, pants, -0.15, 0.8, 0), legR = mk(geo.leg, pants, 0.15, 0.8, 0);
        body.position.y = 1.23; g.add(body);
        mk(geo.torso, shirt, 0, 0, 0, body);
        const head = mk(geo.head, skin, 0, 0.66, 0.02, body); mk(geo.eyes, eye, 0, 0.04, 0.22, head);
        const armL = mk(geo.arm, skin, -0.41, 0.38, 0, body), armR = mk(geo.arm, skin, 0.41, 0.38, 0, body);
        const sc = 0.92 + (i % 4) * 0.06; g.scale.set(sc, sc * (i % 3 === 0 ? 1.06 : 1), sc);
        const a = (i / MZ.n) * 6.283 + (i % 2) * 0.5, r = 2.5 + (i * 1.37 % 5.5);
        MZ.zs.push({ g, body, head, legL, legR, armL, armR, x: Math.cos(a) * r, z: Math.sin(a) * r, h: a + 3.14 + (i % 5) * 0.4, sp: 0.38 + (i % 5) * 0.09, ph: i * 1.7, sd: i * 2.3 });
        MZ.grp.add(g);
    }
    // a flickering fire glow on the ground in the middle of the pack (sprite, no real light)
    MZ.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, color: 0xff8a3a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6, fog: false }));
    MZ.glow.position.set(0, 0.6, 0); MZ.glow.scale.set(5, 5, 1); MZ.grp.add(MZ.glow);
}
function menuSceneOn(on) {
    if (MZ.grp) MZ.grp.visible = on;
    if (!on && MZ.mood) { MZ.mood = false; if (scene.fog) { scene.fog.near = theme.fogNear; scene.fog.far = theme.fogFar; } }
}
const _mzAd = (a, b) => { let d = b - a; while (d > 3.1416) d -= 6.2832; while (d < -3.1416) d += 6.2832; return d; };
function updateMenuScene(dt) {
    if (!MZ.grp) buildMenuZombies();
    if (dt > 0.1) dt = 0.1;
    const cx = spawnPt[0], cz = spawnPt[1], key = currentMap + ':' + cx + ':' + cz;
    if (key !== MZ.key) { MZ.key = key; MZ.gy = groundAt(cx, cz, 2, 3); }
    MZ.grp.visible = true; MZ.grp.position.set(cx, MZ.gy, cz);
    const t = MZ.t += dt;
    if (!MZ.mood) { MZ.mood = true; }
    if (scene.fog) { scene.fog.near = theme.fogNear * 0.3; scene.fog.far = Math.min(theme.fogFar, 95) * 0.55; }   // moodier, closer fog on the menu
    for (let i = 0; i < MZ.zs.length; i++) {
        const z = MZ.zs[i];
        z.h += Math.sin(t * 0.31 + z.sd) * 0.35 * dt;
        const d = Math.hypot(z.x, z.z);
        if (d > 9) z.h += _mzAd(z.h, Math.atan2(-z.x, -z.z)) * Math.min(1, dt * 1.4);
        else if (d < 1.8) z.h += _mzAd(z.h, Math.atan2(z.x, z.z)) * Math.min(1, dt * 1.4);
        z.x += Math.sin(z.h) * z.sp * dt; z.z += Math.cos(z.h) * z.sp * dt;
        z.ph += dt * z.sp * 4.2;
        const s = Math.sin(z.ph), s2 = Math.sin(z.ph * 2), g = z.g;
        g.position.set(z.x, Math.abs(s) * 0.05, z.z); g.rotation.y = z.h;
        z.legL.rotation.x = s * 0.55; z.legR.rotation.x = -s * 0.55;
        z.body.rotation.x = 0.16 + s2 * 0.03; z.body.rotation.y = s * 0.14;
        z.head.rotation.z = Math.sin(t * 0.7 + z.sd) * 0.22; z.head.rotation.x = 0.12 + Math.sin(t * 0.5 + z.sd) * 0.08;
        z.armL.rotation.x = -1.35 + Math.sin(z.ph * 0.5 + z.sd) * 0.14; z.armR.rotation.x = -1.25 + Math.sin(z.ph * 0.5 + z.sd + 1.3) * 0.14;
        z.armL.rotation.z = -0.08; z.armR.rotation.z = 0.08;
    }
    MZ.glow.material.opacity = 0.45 + Math.sin(t * 11) * 0.06 + Math.sin(t * 7.3) * 0.08 + Math.sin(t * 23) * 0.04;
    // camera: slow drift round the pack at head height (the spawn area is kept clear of props)
    const ang = t * 0.075 + 0.6, r = 8.5 + 2.2 * Math.sin(t * 0.05), cyy = MZ.gy + 1.7 + 0.45 * Math.sin(t * 0.11);
    const px = cx + Math.cos(ang) * r, pz = cz + Math.sin(ang) * r;
    camera.position.set(px, cyy, pz);
    let dx = cx - px, dz = cz - pz; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    const S = menuView === 'home' ? 3.6 : 4.4;     // look to the left of the pack so it sits on the right of the screen
    camera.lookAt(cx + dz * S, MZ.gy + 1.35 + 0.15 * Math.sin(t * 0.17), cz - dx * S);
    camera.rotateZ(Math.sin(t * 0.23) * 0.018);
}
