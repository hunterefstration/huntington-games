// ============================================================
// THE 3D LOBBY: your vehicle on a lit pad, party members' vehicles on pads beside it with their names above.
// ============================================================
const Lobby = {
    scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(42, 1, 0.5, 200), pads: [], items: [], t: 0, built: false,
    PADX: [0, -4.6, 4.6, -8.6, 8.6],
    init() {
        const s = this.scene, cv = document.createElement('canvas'); cv.width = 4; cv.height = 256; const x = cv.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
        g.addColorStop(0, '#0b1230'); g.addColorStop(.55, '#2a2f7a'); g.addColorStop(1, '#5a3a8a'); x.fillStyle = g; x.fillRect(0, 0, 4, 256);
        s.background = new THREE.CanvasTexture(cv);
        s.add(new THREE.HemisphereLight(0xaab8ff, 0x302040, 0.9));
        const d = new THREE.DirectionalLight(0xfff0d8, 1.1); d.position.set(-6, 14, 10); s.add(d);
        const d2 = new THREE.DirectionalLight(0x6a8aff, 0.5); d2.position.set(8, 4, -6); s.add(d2);
        const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 40).rotateX(-PI / 2), new THREE.MeshLambertMaterial({ color: 0x1b1f45 })); floor.position.y = -0.02; s.add(floor);
        const padG = new THREE.CylinderGeometry(2.0, 2.15, 0.5, 28), ringG = new THREE.TorusGeometry(2.05, 0.09, 5, 40).rotateX(PI / 2), beamG = new THREE.CylinderGeometry(1.9, 2.1, 14, 20, 1, true);
        for (let i = 0; i < 5; i++) {
            const g2 = new THREE.Group(), me = i === 0;
            const pad = new THREE.Mesh(padG, new THREE.MeshLambertMaterial({ color: 0x2b3170, flatShading: true })); pad.position.y = 0.25;
            const ring = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ color: me ? 0xffd21f : 0x4fe0ff })); ring.position.y = 0.52;
            const beam = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ color: me ? 0xffd21f : 0x4fe0ff, transparent: true, opacity: 0.045, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); beam.position.y = 7.5;
            g2.add(pad, ring, beam); g2.position.set(this.PADX[i], 0, i === 0 ? 0 : -1.2 - Math.abs(this.PADX[i]) * 0.04); s.add(g2); this.pads.push(g2);
        }
        const pts = new Float32Array(300); for (let i = 0; i < 100; i++) { pts[i * 3] = rnd(-25, 25); pts[i * 3 + 1] = rnd(0, 14); pts[i * 3 + 2] = rnd(-20, 6); }
        const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pts, 3)); this.dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xaab8ff, size: 0.12 })); s.add(this.dust);
        this.cam.position.set(0, 4.2, 17); this.cam.lookAt(0, 1.8, 0); this.built = true;
    },
    label(name, sub, star, me) {
        const cv = document.createElement('canvas'); cv.width = 320; cv.height = 96; const x = cv.getContext('2d');
        x.fillStyle = 'rgba(8,12,34,.8)'; x.fillRect(0, 10, 320, 76); x.strokeStyle = me ? '#ffd21f' : '#4fe0ff'; x.lineWidth = 4; x.strokeRect(2, 12, 316, 72);
        x.textAlign = 'center'; x.fillStyle = '#fff'; x.font = 'bold 34px Trebuchet MS,sans-serif'; x.fillText((star ? '★ ' : '') + name, 160, 50); x.fillStyle = '#9fb0e8'; x.font = '22px Trebuchet MS,sans-serif'; x.fillText(sub, 160, 76);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false })); sp.scale.set(me ? 5.2 : 4, me ? 1.56 : 1.2, 1); return sp;
    },
    refresh() {
        if (!this.built) return;
        for (const it of this.items) { this.scene.remove(it.root); if (it.sp) { this.scene.remove(it.sp); it.sp.material.map.dispose(); it.sp.material.dispose(); } }
        this.items = [];
        const list = rosterNow().slice(), meId = PARTY.net ? PARTY.myId : 0;
        const mi = list.findIndex(p => p.id === meId); if (mi > 0) list.unshift(list.splice(mi, 1)[0]);
        list.forEach((p, i) => {
            if (i >= 5) return; const def = VBY[p.veh] || VBY.g1a, m = makeModel(def, 0), P = getParts(def);
            const size = def.ln === 'a' ? Math.max(P.len, P.span) * 0.9 : P.len, k = (i === 0 ? 4.4 : 3.3) / size; m.root.scale.setScalar(k);
            const pad = this.pads[i]; m.root.position.set(pad.position.x, def.ln === 'a' ? 2.3 : def.ln === 'n' ? 0.55 + 1.2 * k : 0.55, pad.position.z);
            this.scene.add(m.root);
            const sp = this.label(p.name, def.n + ' (' + TIER_ROMAN[def.t] + ')', p.id === 0 && !!PARTY.net, i === 0); sp.position.set(pad.position.x, i === 0 ? 5.6 : 4.4, pad.position.z); this.scene.add(sp);
            this.items.push({ root: m.root, sp, def, m, ry: Math.random() * TAU });
        });
        this.pads.forEach((p, i) => { p.children[2].visible = i < this.items.length; p.children[1].material.color.setHex(i < this.items.length ? (i === 0 ? 0xffd21f : 0x4fe0ff) : 0x333a66); });
    },
    render(dt) {
        if (!this.built) return; this.t += dt;
        this.items.forEach((it, i) => {
            it.ry += dt * (i === 0 ? 0.55 : 0.35); const r = it.root; r.rotation.set(0, it.ry, 0);
            if (it.def.ln === 'a') { r.position.y = 2.4 + Math.sin(this.t * 1.6 + i) * 0.18; r.rotation.z = Math.sin(this.t + i) * 0.12; for (const p of it.m.props) p.rotation.z += dt * 30; }
            else if (it.def.ln === 'n') r.position.y = 0.55 + Math.sin(this.t * 1.2 + i) * 0.05 + 0.25;
        });
        this.dust.rotation.y += dt * 0.02;
        this.cam.aspect = innerWidth / innerHeight; this.cam.position.set(0, 5.4 + Math.sin(this.t * .3) * .2, 23.5 + (innerWidth / innerHeight < 1.4 ? 7 : 0)); this.cam.lookAt(0, 1.9, 0); this.cam.updateProjectionMatrix();
        renderer.render(this.scene, this.cam);
        if (!window.__hgReady) { window.__hgReady = 1; try { if (parent !== window && parent.HG_gameReady) setTimeout(() => parent.HG_gameReady(), 80); } catch (e) {} }      // the launcher's loading screen can go
    }
};
