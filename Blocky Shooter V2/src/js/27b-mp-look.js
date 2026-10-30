// ---------- 5.2 LOOK: goon-shop skins + avatars, gamer tags, better player models, the weapon in their hands ----------
// Players buy skins / avatars / titles with goons in the launcher (Profile tab) and wear them there. The game only READS them
// (window.parent.HGGrapevine.eco) and draws them: on your own first-person arms, and on your third-person model for everyone else.
// Everything works with defaults when the game runs on its own: every parent access is wrapped in try/catch.
const SKIN_PATS = ['solid', 'camo', 'stripe', 'glow', 'metal', 'check'];
const AVATAR_IDS = ['robot', 'knight', 'astronaut', 'ninja', 'pirate', 'zombie', 'alien', 'cowboy', 'wizard', 'samurai'];
const AVATAR_NAMES = { robot: 'Robot', knight: 'Knight', astronaut: 'Astronaut', ninja: 'Ninja', pirate: 'Pirate', zombie: 'Zombie', alien: 'Alien', cowboy: 'Cowboy', wizard: 'Wizard', samurai: 'Samurai' };
const LOOK = { stand: null, key: '' };               // stand: what the launcher says about you (rank tier, record boards, title)
const CROWNED = new Set();                           // names of tournament winners this session (they wear a crown on their name tag)
const tourneyWins = () => (life && life.tourneyWins) | 0;

// the launcher's Grapevine object (parent frame, opener, or - for tests - this window); null when the game runs on its own
function hgG() {
    for (const f of [() => window.parent.HGGrapevine, () => window.opener.HGGrapevine, () => window.HGGrapevine]) {
        try { const g = f(); if (g && g.eco && typeof g.eco.state === 'function') return g; } catch (e) {}
    }
    return null;
}
const hexNum = (c) => { try { return new THREE.Color(c).getHex(); } catch (e) { return 0x888888; } };
function readMyLook() {
    const out = { sk: null, av: '', t: '', r: 0, rec: 0, w: tourneyWins() };
    try {
        const G = hgG(); if (!G) return out;
        const st = G.eco.state() || {}, eq = st.equip || {};
        const items = ((G.eco.catalog() || {}).items) || [];
        const by = (id) => id ? items.find(i => i.id === id) : null;
        const sk = by(eq.skin);
        if (sk && sk.c && sk.c.length > 1) out.sk = { c: [hexNum(sk.c[0]), hexNum(sk.c[1])], pat: SKIN_PATS.includes(sk.pat) ? sk.pat : 'solid' };
        const av = String(eq.avatar || '').replace(/^avatar:/, ''); if (AVATAR_IDS.includes(av)) out.av = av;
        const ti = by((LOOK.stand && LOOK.stand.t) || eq.title) || by(eq.title); if (ti) out.t = String(ti.n || '').replace(/[<>]/g, '').slice(0, 28);
        if (LOOK.stand) { out.r = LOOK.stand.r | 0; out.rec = LOOK.stand.rec ? 1 : 0; }
    } catch (e) {}
    return out;
}
// the rank tier + record boards come from the server through cos(); asked now and then, never blocks anything
function refreshStanding() {
    try {
        const G = hgG(); if (!G || typeof G.eco.cos !== 'function') return;
        const me = G.me && G.me(); if (!me || !me.userId) return;
        Promise.resolve(G.eco.cos([me.userId])).then((map) => {
            const e = map && (map[me.userId] || map[String(me.userId)]); if (!e) return;
            const rk = e.ranks && +e.ranks['Blocky Shooter'], rec = e.rec;
            const has = rec && (Array.isArray(rec) ? rec.some(k => String(k).startsWith('blocky:')) : Object.keys(rec).some(k => k.startsWith('blocky:')));
            LOOK.stand = { r: rk >= 1 && rk <= 5 ? rk | 0 : 0, rec: !!has, t: e.t || '' };
            updateMyLook();
        }).catch(() => {});
    } catch (e) {}
}
function updateMyLook() {
    const l = readMyLook(), key = JSON.stringify(l);
    if (key === LOOK.key) return false;
    LOOK.key = key; LOOK_MINE = l;
    try { applyArmColors(); } catch (e) {}
    if (NET.on) netSendMyLook();
    return true;
}
function cleanLook(l) {
    if (!l || typeof l !== 'object') return null;
    const o = { sk: null, av: '', t: '', r: 0, rec: 0, w: 0 };
    const ok = (c) => Number.isInteger(c) && c >= 0 && c <= 0xffffff;
    if (l.sk && Array.isArray(l.sk.c) && ok(l.sk.c[0]) && ok(l.sk.c[1])) o.sk = { c: [l.sk.c[0], l.sk.c[1]], pat: SKIN_PATS.includes(l.sk.pat) ? l.sk.pat : 'solid' };
    if (AVATAR_IDS.includes(l.av)) o.av = l.av;
    if (typeof l.t === 'string') o.t = l.t.replace(/[<>&"']/g, '').slice(0, 28);
    o.r = l.r >= 1 && l.r <= 5 ? l.r | 0 : 0; o.rec = l.rec ? 1 : 0; o.w = clamp(l.w | 0, 0, 999);
    return o;
}
const lookOf = (p) => p ? (p.id === NET.id ? LOOK_MINE : p.look) : null;
function netSendMyLook() {
    if (!NET.on || !LOOK_MINE) return;
    if (NET.host) {
        if (NET.me) NET.me.look = LOOK_MINE;
        if (NET.inGame) netBroadcast({ t: 'plook', id: NET.id, look: LOOK_MINE }); else hostLobbyUpdate();
    } else sendRel(NET.hostPeer, { t: 'look', look: LOOK_MINE });
}
function applyPlayerLook(p, look) {
    const c = cleanLook(look); if (!p) return;
    if (JSON.stringify(c) === JSON.stringify(p.look || null)) return;
    p.look = c;
    if (p.av) rebuildAvatar(p);
}
function rebuildAvatar(p) {
    if (!p.av) return;
    const pos = p.av.g.position.clone(), vis = p.av.g.visible;
    disposeAvatar(p.av); scene.remove(p.av.g);
    p.av = makeAvatar(p); p.av.g.position.copy(pos); p.av.g.visible = vis;
}
function disposeAvatar(a) { try { if (a.tag) { a.tag.material.map.dispose(); a.tag.material.dispose(); } } catch (e) {} }

// ---------- gamer tags: title, Blocky rank tier (R1 best .. R5), Record Holder, tournament crown ----------
const TIER_COL = ['', '#fbbf24', '#e5e7eb', '#d6a06a', '#93c5fd', '#9ca3af'];
function tagHtml(p) {
    const l = lookOf(p); if (!p) return '';
    let h = '';
    if (CROWNED.has(p.name)) h += '<span title="Tournament winner" style="color:#fbbf24">&#9819;</span> ';
    if (l && l.r) h += `<span style="background:${TIER_COL[l.r]};color:#111;border-radius:4px;padding:0 4px;font-size:10px;font-weight:900;margin-right:4px" title="Blocky Shooter rank tier">R${l.r}</span>`;
    return h;
}
function tagSub(p) {
    const l = lookOf(p); if (!l) return '';
    const bits = [];
    if (l.t) bits.push(`<span style="color:#7dd3fc;font-size:10px;font-weight:800">${escHtml(l.t)}</span>`);
    if (l.rec) bits.push('<span style="color:#fbbf24;font-size:10px;font-weight:900">RECORD HOLDER</span>');
    return bits.length ? `<div>${bits.join(' &middot; ')}</div>` : '';
}
function nameTag(p, color) {
    const l = lookOf(p) || {}, crown = CROWNED.has(p.name);
    const c = document.createElement('canvas'); c.width = 320; c.height = 128; const g = c.getContext('2d');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    let y = 98;
    if (l.rec) { g.font = '900 20px Segoe UI, sans-serif'; g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText('RECORD HOLDER', 160, y); g.fillStyle = '#fbbf24'; g.fillText('RECORD HOLDER', 160, y); }
    // name line (rank tier badge on the left, crown on the right)
    const nm = String(p.name || '').slice(0, 16); g.font = 'bold 36px Segoe UI, sans-serif';
    const nw = g.measureText(nm).width, bw = l.r ? 44 : 0, tot = nw + (bw ? bw + 8 : 0), x0 = 160 - tot / 2;
    g.textAlign = 'left'; g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,0.85)';
    if (bw) {
        g.fillStyle = TIER_COL[l.r]; g.beginPath(); g.roundRect ? g.roundRect(x0, 40, bw, 30, 7) : g.rect(x0, 40, bw, 30); g.fill();
        g.font = '900 22px Segoe UI, sans-serif'; g.fillStyle = '#111'; g.textAlign = 'center'; g.fillText('R' + l.r, x0 + bw / 2, 56); g.textAlign = 'left'; g.font = 'bold 36px Segoe UI, sans-serif';
    }
    const nx = x0 + (bw ? bw + 8 : 0);
    g.strokeText(nm, nx, 56); g.fillStyle = hex(color); g.fillText(nm, nx, 56);
    // title line
    if (l.t) { g.textAlign = 'center'; g.font = '800 22px Segoe UI, sans-serif'; g.lineWidth = 5; g.strokeText(l.t, 160, 22); g.fillStyle = '#7dd3fc'; g.fillText(l.t, 160, 22); }
    if (crown) {   // a little gold crown over the name
        const cx = 160, cy = l.t ? 8 : 12; g.fillStyle = '#fbbf24'; g.strokeStyle = '#78350f'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(cx - 14, cy + 12); g.lineTo(cx - 14, cy - 2); g.lineTo(cx - 7, cy + 5); g.lineTo(cx, cy - 6); g.lineTo(cx + 7, cy + 5); g.lineTo(cx + 14, cy - 2); g.lineTo(cx + 14, cy + 12); g.closePath(); g.fill(); g.stroke();
    }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(c), transparent: true, depthWrite: false }));
    sp.scale.set(2.5, 1.0, 1); sp.renderOrder = 5;
    return sp;
}

// ---------- skins as textures ----------
const hexStr = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
const shadeHex = (c, k) => hexStr(darken(c, k));
function paintSkin(g, S, c1, c2, pat, seed) {
    const rnd = mulberry32(seed), h1 = hexStr(c1), h2 = hexStr(c2);
    g.fillStyle = h1; g.fillRect(0, 0, S, S);
    if (pat === 'camo') {
        for (let i = 0; i < 26; i++) { g.fillStyle = i % 3 === 0 ? shadeHex(c1, 0.55) : h2; g.beginPath(); g.ellipse(rnd() * S, rnd() * S, S * (0.07 + rnd() * 0.16), S * (0.05 + rnd() * 0.12), rnd() * 3, 0, 6.3); g.fill(); }
    } else if (pat === 'stripe') {
        g.fillStyle = h2; const w = S / 6;
        for (let x = -S; x < S * 2; x += w * 2) { g.beginPath(); g.moveTo(x, S); g.lineTo(x + w, S); g.lineTo(x + w + S, 0); g.lineTo(x + S, 0); g.closePath(); g.fill(); }
    } else if (pat === 'check') {
        g.fillStyle = h2; const n = 4, w = S / n; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if ((x + y) & 1) g.fillRect(x * w, y * w, w, w);
    } else if (pat === 'metal') {
        const gr = g.createLinearGradient(0, 0, S, S); gr.addColorStop(0, h1); gr.addColorStop(0.5, h2); gr.addColorStop(1, h1); g.fillStyle = gr; g.fillRect(0, 0, S, S);
        for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${0.04 + rnd() * 0.1})`; g.fillRect(0, rnd() * S, S, 1); }
        for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, rnd() * S, S, 1); }
    } else if (pat === 'glow') {
        g.fillStyle = shadeHex(c1, 0.55); g.fillRect(0, 0, S, S);
        const gr = g.createRadialGradient(S / 2, S / 2, 1, S / 2, S / 2, S * 0.7); gr.addColorStop(0, h2); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
        g.fillStyle = h2; for (let y = S / 8; y < S; y += S / 4) g.fillRect(0, y, S, 2);
    } else {     // solid: main colour with a trim band in the second colour
        g.fillStyle = h2; g.fillRect(0, S * 0.72, S, S * 0.28); g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, 0, S, 2);
    }
}
const _skinTex = new Map();
function vmSkinTex(sk, secondary) {       // first-person arms: a tiling 64px texture, sleeves lead with colour 1, gloves with colour 2
    const key = sk.c[0] + '|' + sk.c[1] + '|' + sk.pat + '|' + (secondary ? 1 : 0);
    let t = _skinTex.get(key); if (t) return t;
    const [c, g] = makeCanvas(64);
    paintSkin(g, 64, secondary ? sk.c[1] : sk.c[0], secondary ? sk.c[0] : sk.c[1], sk.pat, 7 + (secondary ? 3 : 0));
    t = canvasTex(c, 1); t.wrapS = t.wrapT = THREE.RepeatWrapping; _skinTex.set(key, t); return t;
}

// ---------- the player model: parts are merged into one geometry per limb (shared by everyone), colours come from vertex colours ----------
// part = [sx, sy, sz, x, y, z, colour, rotX]. colour < 0 means "outfit": drawn with the skin texture (brightness = -colour)
const _pc = new THREE.Color();
function mergeParts(parts) {
    const gs = parts.map(([sx, sy, sz, x, y, z, col, rx]) => {
        const g = new THREE.BoxGeometry(sx, sy, sz); if (rx) g.rotateX(rx); g.translate(x, y, z);
        const n = g.attributes.position.count, ca = new Float32Array(n * 3), uv = g.attributes.uv, outfit = col < 0;
        let r, gg, b; if (outfit) r = gg = b = -col; else { _pc.setHex(col); r = _pc.r; gg = _pc.g; b = _pc.b; }
        for (let i = 0; i < n; i++) { ca[i * 3] = r; ca[i * 3 + 1] = gg; ca[i * 3 + 2] = b; if (outfit) uv.setXY(i, uv.getX(i) * 0.45, uv.getY(i) * 0.45); else uv.setXY(i, 0.97, 0.97); }
        g.setAttribute('color', new THREE.BufferAttribute(ca, 3));
        return g;
    });
    const m = mergeGeometries(gs, false); gs.forEach(g => g.dispose()); return m;
}
const _geoCache = new Map();
function cachedGeo(key, mk) { let g = _geoCache.get(key); if (!g) { g = mk(); g.userData.cached = true; _geoCache.set(key, g); } return g; }

const C_M = 0x3a3f47, C_D = 0x23262c, C_G = 0x7b8390, C_W = 0x7b4a25, C_B = 0x14161a, SKINTONE = 0xd9a066;
const faceParts = (tone) => [[0.3, 0.3, 0.3, 0, 0.2, 0, tone], [0.05, 0.045, 0.02, -0.075, 0.23, -0.155, 0x1b1b1b], [0.05, 0.045, 0.02, 0.075, 0.23, -0.155, 0x1b1b1b]];
// each avatar: skin tone of head + hands, glove colour, parts for the head (origin at the neck) and extra body parts
const AV = {
    soldier: { tone: SKINTONE, glove: 0x2b2d33, head: [...faceParts(SKINTONE), [0.34, 0.12, 0.34, 0, 0.36, 0, -1], [0.3, 0.07, 0.03, 0, 0.24, -0.165, 0x60a5fa]], body: [] },
    robot: { tone: 0x9aa3ad, glove: 0x6b7280, head: [[0.32, 0.30, 0.32, 0, 0.2, 0, 0x9aa3ad], [0.26, 0.09, 0.03, 0, 0.24, -0.17, 0x22d3ee], [0.04, 0.1, 0.1, -0.18, 0.2, 0, 0x6b7280], [0.04, 0.1, 0.1, 0.18, 0.2, 0, 0x6b7280],
        [0.02, 0.18, 0.02, 0.1, 0.42, 0, 0x6b7280], [0.05, 0.05, 0.05, 0.1, 0.53, 0, 0xef4444], [0.18, 0.04, 0.03, 0, 0.1, -0.17, 0x4b5563]], body: [[0.3, 0.2, 0.04, 0, 1.3, -0.16, 0xb7c0ca], [0.08, 0.08, 0.02, 0, 1.32, -0.185, 0x22d3ee]] },
    knight: { tone: SKINTONE, glove: 0x9aa3ad, head: [[0.36, 0.34, 0.36, 0, 0.2, 0, 0xb8c0cc], [0.28, 0.04, 0.02, 0, 0.22, -0.19, 0x0b0b0b], [0.04, 0.14, 0.03, 0, 0.17, -0.19, 0x9aa3ad], [0.06, 0.16, 0.34, 0, 0.45, 0, 0xdc2626], [0.38, 0.05, 0.38, 0, 0.04, 0, 0x8d96a3]],
        body: [[0.5, 0.36, 0.04, 0, 1.3, -0.16, 0xaeb6c2], [0.18, 0.12, 0.3, -0.34, 1.5, 0, 0xaeb6c2], [0.18, 0.12, 0.3, 0.34, 1.5, 0, 0xaeb6c2], [0.46, 0.1, 0.3, 0, 0.8, 0, 0x8d96a3]] },
    astronaut: { tone: SKINTONE, glove: 0xf1f5f9, head: [[0.42, 0.40, 0.42, 0, 0.22, 0, 0xf1f5f9], [0.32, 0.26, 0.04, 0, 0.22, -0.21, 0xd4a017], [0.34, 0.08, 0.34, 0, 0.0, 0, 0xcbd5e1], [0.04, 0.12, 0.04, 0.2, 0.46, 0, 0xcbd5e1]],
        body: [[0.5, 0.52, 0.2, 0, 1.25, 0.24, 0xe2e8f0], [0.14, 0.1, 0.03, 0.12, 1.34, -0.155, 0xef4444], [0.1, 0.1, 0.03, -0.12, 1.34, -0.155, 0x2563eb]] },
    ninja: { tone: SKINTONE, glove: 0x15161a, head: [[0.32, 0.32, 0.32, 0, 0.2, 0, 0x15161a], [0.24, 0.07, 0.02, 0, 0.24, -0.165, SKINTONE], [0.34, 0.06, 0.34, 0, 0.3, 0, 0xdc2626], [0.06, 0.05, 0.22, -0.06, 0.3, 0.26, 0xdc2626], [0.06, 0.05, 0.18, 0.07, 0.28, 0.24, 0xdc2626]],
        body: [[0.34, 0.12, 0.34, 0, 1.52, 0, 0x15161a], [0.5, 0.08, 0.3, 0, 0.98, 0, 0xdc2626]] },
    pirate: { tone: SKINTONE, glove: 0x3b2a1a, head: [...faceParts(SKINTONE), [0.1, 0.07, 0.02, 0.075, 0.23, -0.165, 0x111111], [0.2, 0.09, 0.06, 0, 0.07, -0.15, 0x3b2a1a], [0.5, 0.05, 0.42, 0, 0.37, 0, 0x1f1d1b], [0.32, 0.14, 0.32, 0, 0.45, 0, 0x2a2623], [0.1, 0.08, 0.02, 0, 0.46, -0.17, 0xf8fafc]],
        body: [[0.52, 0.09, 0.3, 0, 1.0, 0, 0xb91c1c], [0.12, 0.12, 0.3, -0.34, 1.46, 0, 0x3b2a1a]] },
    zombie: { tone: 0x7fa86a, glove: 0x7fa86a, head: [[0.3, 0.3, 0.3, 0, 0.2, 0, 0x7fa86a], [0.06, 0.06, 0.02, -0.075, 0.24, -0.155, 0xf8fafc], [0.06, 0.06, 0.02, 0.075, 0.24, -0.155, 0xef4444], [0.2, 0.04, 0.02, 0, 0.1, -0.155, 0x3f1d1d],
        [0.14, 0.08, 0.14, 0.05, 0.37, -0.02, 0xd97786], [0.31, 0.06, 0.2, 0, 0.34, 0.06, 0x2f3a24]], body: [[0.2, 0.16, 0.03, -0.1, 1.28, -0.155, 0x4a1111], [0.12, 0.12, 0.03, 0.14, 1.12, -0.155, 0x4a1111]] },
    alien: { tone: 0x84cc16, glove: 0x84cc16, head: [[0.4, 0.36, 0.34, 0, 0.24, 0, 0x84cc16], [0.13, 0.09, 0.02, -0.1, 0.25, -0.175, 0x0a0a0a], [0.13, 0.09, 0.02, 0.1, 0.25, -0.175, 0x0a0a0a], [0.02, 0.18, 0.02, -0.1, 0.52, 0, 0x65a30d], [0.02, 0.18, 0.02, 0.1, 0.52, 0, 0x65a30d],
        [0.06, 0.06, 0.06, -0.1, 0.63, 0, 0xfacc15], [0.06, 0.06, 0.06, 0.1, 0.63, 0, 0xfacc15]], body: [] },
    cowboy: { tone: SKINTONE, glove: 0x7c4a21, head: [...faceParts(SKINTONE), [0.56, 0.04, 0.5, 0, 0.37, 0, 0x7c4a21], [0.32, 0.16, 0.32, 0, 0.46, 0, 0x8a5527], [0.34, 0.04, 0.34, 0, 0.4, 0, 0x3b2a1a], [0.3, 0.1, 0.12, 0, 0.0, -0.14, 0xdc2626]],
        body: [[0.1, 0.1, 0.03, 0.14, 1.36, -0.155, 0xfacc15], [0.5, 0.3, 0.04, 0, 1.28, -0.16, 0x7c4a21]] },
    wizard: { tone: SKINTONE, glove: 0xf1f5f9, head: [...faceParts(SKINTONE), [0.2, 0.22, 0.08, 0, 0.02, -0.14, 0xf1f5f9], [0.52, 0.04, 0.52, 0, 0.36, 0, 0x4c1d95], [0.32, 0.14, 0.32, 0, 0.45, 0, 0x5b21b6], [0.24, 0.14, 0.24, 0, 0.58, 0, 0x5b21b6], [0.16, 0.14, 0.16, 0, 0.71, 0, 0x5b21b6],
        [0.09, 0.12, 0.09, 0, 0.83, 0.03, 0x5b21b6], [0.06, 0.06, 0.02, 0, 0.46, -0.17, 0xfacc15]], body: [[0.52, 0.5, 0.34, 0, 0.62, 0, -0.8]] },
    samurai: { tone: SKINTONE, glove: 0x7f1d1d, head: [[0.3, 0.3, 0.3, 0, 0.2, 0, SKINTONE], [0.05, 0.045, 0.02, -0.075, 0.24, -0.155, 0x1b1b1b], [0.05, 0.045, 0.02, 0.075, 0.24, -0.155, 0x1b1b1b], [0.36, 0.18, 0.36, 0, 0.35, 0, 0x7f1d1d], [0.44, 0.1, 0.44, 0, 0.2, 0.03, 0x5c1414],
        [0.3, 0.14, 0.06, 0, 0.08, -0.16, 0x111827], [0.04, 0.28, 0.04, -0.1, 0.52, -0.1, 0xfacc15, -0.5], [0.04, 0.28, 0.04, 0.1, 0.52, -0.1, 0xfacc15, -0.5]], body: [[0.22, 0.08, 0.34, -0.35, 1.5, 0, 0x7f1d1d], [0.22, 0.08, 0.34, 0.35, 1.5, 0, 0x7f1d1d], [0.5, 0.1, 0.3, 0, 0.88, 0, 0xfacc15]] }
};
function avGeos(av) {
    const d = AV[av] || AV.soldier, id = AV[av] ? av : 'soldier';
    return {
        head: cachedGeo('head|' + id, () => mergeParts(d.head)),
        torso: cachedGeo('torso|' + id, () => mergeParts([
            [0.52, 0.4, 0.28, 0, 1.3, 0, -1], [0.44, 0.22, 0.26, 0, 1.0, 0, -0.8], [0.46, 0.07, 0.28, 0, 0.89, 0, 0x1d1f24], [0.14, 0.1, 0.3, -0.33, 1.47, 0, -0.9], [0.14, 0.1, 0.3, 0.33, 1.47, 0, -0.9],
            [0.34, 0.34, 0.14, 0, 1.25, 0.21, 0x2b2d33], [0.06, 0.4, 0.29, -0.13, 1.3, 0, 0x1d1f24], [0.06, 0.4, 0.29, 0.13, 1.3, 0, 0x1d1f24], [0.12, 0.1, 0.12, 0, 1.52, 0, d.tone],
            [0.12, 0.12, 0.05, -0.12, 1.1, -0.15, 0x1d1f24], [0.12, 0.12, 0.05, 0.12, 1.1, -0.15, 0x1d1f24]].concat(d.body))),
        arm: cachedGeo('arm|' + id, () => mergeParts([[0.1, 0.1, 0.3, 0, 0, 0.15, -0.85], [0.085, 0.085, 0.27, 0, 0, 0.44, -1], [0.095, 0.095, 0.05, 0, 0, 0.3, 0x1d1f24], [0.09, 0.09, 0.1, 0, 0, 0.6, d.glove]]))
    };
}
const legGeo = () => cachedGeo('leg', () => mergeParts([[0.2, 0.42, 0.22, 0, -0.2, 0, -0.85], [0.18, 0.36, 0.2, 0, -0.6, 0, -0.7], [0.2, 0.12, 0.06, 0, -0.45, -0.12, 0x2b2d33], [0.2, 0.12, 0.28, 0, -0.8, -0.04, 0x1d1f24]]));
const markGeo = () => cachedGeo('mark', () => mergeParts([[0.54, 0.06, 0.3, 0, 1.17, 0, 0xffffff], [0.12, 0.06, 0.32, -0.33, 1.55, 0, 0xffffff], [0.12, 0.06, 0.32, 0.33, 1.55, 0, 0xffffff], [0.22, 0.05, 0.3, 0, 1.5, 0.0, 0xffffff]]));

// ---------- what they hold: one simple model per weapon class, origin = the right hand's grip, barrel toward -z ----------
function weaponSpec(id, A) {
    const M = C_M, D = C_D, G = C_G, W = C_W;
    const rifle = (hg, bar, st) => [[0.06, 0.10, 0.34, 0, 0.03, -0.14, M], [0.055, 0.07, hg, 0, 0.03, -0.31 - hg / 2, D], [0.022, 0.022, bar, 0, 0.04, -0.31 - hg - bar / 2, G], [0.05, 0.11, st, 0, 0, 0.03 + st / 2, D],
        [0.04, 0.16, 0.07, 0, -0.12, -0.08, D, 0.2], [0.045, 0.1, 0.05, 0, -0.07, 0.04, D], [0.03, 0.04, 0.04, 0, 0.1, -0.2, D], [0.062, 0.03, 0.2, 0, 0.09, -0.1, A]];
    switch (id) {
        case 'pistol': return { p: [[0.05, 0.06, 0.2, 0, 0.05, -0.09, M], [0.03, 0.03, 0.05, 0, 0.05, -0.21, D], [0.045, 0.12, 0.055, 0, -0.05, 0.01, D, -0.12], [0.03, 0.03, 0.07, 0, -0.01, -0.04, D], [0.052, 0.02, 0.1, 0, 0.085, -0.09, A]], fore: [0, -0.04, -0.02], mz: -0.25 };
        case 'dual': { const one = (x) => [[0.05, 0.06, 0.2, x, 0.05, -0.09, M], [0.03, 0.03, 0.05, x, 0.05, -0.21, D], [0.045, 0.12, 0.055, x, -0.05, 0.01, D, -0.12], [0.052, 0.02, 0.1, x, 0.085, -0.09, A]]; return { p: one(0).concat(one(-0.34)), fore: [-0.34, 0, 0], mz: -0.25, twin: true }; }
        case 'revolver': return { p: [[0.05, 0.07, 0.16, 0, 0.04, -0.07, M], [0.035, 0.035, 0.22, 0, 0.07, -0.25, G], [0.07, 0.07, 0.07, 0, 0.04, -0.06, G], [0.045, 0.12, 0.055, 0, -0.06, 0.02, W, -0.15], [0.03, 0.03, 0.07, 0, -0.01, -0.04, D]], fore: [0, -0.04, -0.02], mz: -0.37 };
        case 'smg': return { p: [[0.06, 0.09, 0.3, 0, 0.03, -0.12, M], [0.025, 0.025, 0.1, 0, 0.04, -0.32, D], [0.04, 0.18, 0.05, 0, -0.12, -0.1, D], [0.045, 0.1, 0.05, 0, -0.07, 0.03, D], [0.04, 0.05, 0.12, 0, 0.03, 0.13, D], [0.03, 0.025, 0.2, 0, 0.09, -0.12, A], [0.04, 0.08, 0.04, 0, -0.07, -0.2, D]], fore: [0, -0.06, -0.2], mz: -0.38 };
        case 'carbine': return { p: rifle(0.14, 0.1, 0.16), fore: [0, -0.04, -0.34], mz: -0.55 };
        case 'burst': return { p: rifle(0.2, 0.12, 0.18).concat([[0.04, 0.04, 0.05, 0, 0.04, -0.7, D]]), fore: [0, -0.04, -0.38], mz: -0.7 };
        case 'ar': return { p: rifle(0.22, 0.14, 0.2), fore: [0, -0.04, -0.4], mz: -0.64 };
        case 'shotgun': return { p: [[0.06, 0.09, 0.24, 0, 0.03, -0.1, M], [0.035, 0.035, 0.5, 0, 0.05, -0.5, G], [0.03, 0.03, 0.4, 0, -0.01, -0.45, D], [0.06, 0.06, 0.16, 0, -0.01, -0.36, W], [0.05, 0.11, 0.24, 0, 0, 0.2, W], [0.05, 0.02, 0.1, 0, 0.09, -0.1, A]], fore: [0, -0.03, -0.36], mz: -0.76 };
        case 'lever': return { p: [[0.05, 0.08, 0.26, 0, 0.03, -0.12, M], [0.03, 0.03, 0.46, 0, 0.05, -0.42, G], [0.05, 0.11, 0.22, 0, 0, 0.17, W], [0.05, 0.05, 0.2, 0, 0.0, -0.35, W], [0.03, 0.12, 0.12, 0, -0.08, -0.02, G], [0.05, 0.02, 0.1, 0, 0.08, -0.1, A]], fore: [0, -0.03, -0.35], mz: -0.68 };
        case 'dmr': return { p: rifle(0.26, 0.3, 0.2).concat([[0.04, 0.05, 0.22, 0, 0.14, -0.14, D], [0.05, 0.055, 0.03, 0, 0.14, -0.27, 0x38bdf8]]), fore: [0, -0.04, -0.42], mz: -0.92 };
        case 'sniper': return { p: [[0.055, 0.09, 0.3, 0, 0.03, -0.14, M], [0.03, 0.03, 0.7, 0, 0.04, -0.64, G], [0.05, 0.12, 0.26, 0, 0, 0.2, D], [0.05, 0.06, 0.26, 0, 0.13, -0.15, D], [0.06, 0.07, 0.03, 0, 0.13, -0.29, 0x38bdf8],
            [0.02, 0.12, 0.02, -0.05, -0.08, -0.6, D], [0.02, 0.12, 0.02, 0.05, -0.08, -0.6, D], [0.045, 0.045, 0.07, 0, 0.04, -1.0, D], [0.052, 0.02, 0.16, 0, 0.08, -0.1, A]], fore: [0, -0.03, -0.5], mz: -1.05 };
        case 'crossbow': return { p: [[0.05, 0.08, 0.5, 0, 0, -0.1, W], [0.8, 0.03, 0.04, 0, 0.04, -0.4, W], [0.7, 0.01, 0.01, 0, 0.05, -0.28, 0xe5e7eb], [0.015, 0.015, 0.35, 0, 0.07, -0.32, G], [0.04, 0.03, 0.1, 0, 0.07, -0.5, A]], fore: [0, -0.02, -0.34], mz: -0.5 };
        case 'lmg': return { p: [[0.08, 0.12, 0.42, 0, 0.03, -0.15, M], [0.03, 0.03, 0.3, 0, 0.05, -0.5, G], [0.02, 0.14, 0.02, -0.05, -0.08, -0.55, D], [0.02, 0.14, 0.02, 0.05, -0.08, -0.55, D], [0.12, 0.12, 0.14, 0, -0.12, -0.05, A], [0.05, 0.11, 0.2, 0, 0, 0.2, D],
            [0.03, 0.04, 0.2, 0, 0.12, -0.2, D], [0.045, 0.1, 0.05, 0, -0.07, 0.04, D]], fore: [0, -0.05, -0.42], mz: -0.68 };
        case 'minigun': return { p: [[0.1, 0.1, 0.5, 0, 0.03, -0.45, G], [0.12, 0.12, 0.04, 0, 0.03, -0.3, D], [0.12, 0.12, 0.04, 0, 0.03, -0.55, D], [0.12, 0.14, 0.22, 0, 0.03, -0.1, M], [0.14, 0.14, 0.14, 0, -0.14, 0, A], [0.04, 0.1, 0.04, 0, 0.14, -0.1, D]], fore: [0, 0.12, -0.2], mz: -0.75 };
        case 'glauncher': return { p: [[0.1, 0.1, 0.34, 0, 0.04, -0.25, D], [0.13, 0.13, 0.1, 0, 0.03, -0.1, A], [0.08, 0.08, 0.18, 0, 0.04, -0.5, G], [0.05, 0.1, 0.18, 0, 0, 0.17, D], [0.045, 0.1, 0.05, 0, -0.07, 0.04, D], [0.03, 0.05, 0.04, 0, 0.12, -0.3, D]], fore: [0, -0.04, -0.3], mz: -0.6 };
        case 'rpg': return { p: [[0.1, 0.1, 0.8, 0, 0.08, -0.35, 0x4d5a2a], [0.15, 0.15, 0.18, 0, 0.08, -0.84, A], [0.14, 0.14, 0.08, 0, 0.08, 0.06, G], [0.04, 0.1, 0.04, 0, -0.02, 0, D], [0.03, 0.06, 0.03, 0, 0.16, -0.2, D]], fore: [0, 0.0, -0.4], mz: -0.95 };
        case 'flamer': return { p: [[0.06, 0.06, 0.4, 0, 0.04, -0.35, G], [0.09, 0.09, 0.05, 0, 0.04, -0.58, A], [0.1, 0.1, 0.34, 0, -0.1, -0.1, A], [0.07, 0.11, 0.2, 0, 0.03, 0, M], [0.04, 0.04, 0.04, 0, 0.04, -0.62, 0xf97316], [0.045, 0.1, 0.05, 0, -0.07, 0.04, D]], fore: [0, -0.02, -0.34], mz: -0.64 };
        case 'tesla': return { p: [[0.07, 0.1, 0.3, 0, 0.03, -0.1, M], [0.14, 0.14, 0.03, 0, 0.04, -0.3, A], [0.14, 0.14, 0.03, 0, 0.04, -0.38, A], [0.14, 0.14, 0.03, 0, 0.04, -0.46, A], [0.05, 0.05, 0.3, 0, 0.04, -0.35, 0x818cf8], [0.08, 0.08, 0.05, 0, 0.04, -0.6, 0xc7d2fe], [0.045, 0.1, 0.05, 0, -0.07, 0.04, D]], fore: [0, -0.04, -0.3], mz: -0.65 };
        case 'railgun': return { p: [[0.025, 0.05, 0.7, -0.04, 0.05, -0.45, A], [0.025, 0.05, 0.7, 0.04, 0.05, -0.45, A], [0.08, 0.1, 0.34, 0, 0.03, -0.1, M], [0.03, 0.03, 0.6, 0, 0.06, -0.4, 0x22d3ee], [0.1, 0.1, 0.1, 0, 0.03, -0.35, D], [0.05, 0.11, 0.2, 0, 0, 0.18, D], [0.045, 0.1, 0.05, 0, -0.07, 0.04, D]], fore: [0, -0.04, -0.4], mz: -0.82 };
        case 'katana': return { p: [[0.035, 0.035, 0.22, 0, 0, 0.02, 0x1f2937], [0.09, 0.09, 0.015, 0, 0, -0.1, 0xd4a017], [0.012, 0.05, 0.8, 0, 0.02, -0.52, 0xe5e7eb], [0.01, 0.02, 0.8, 0, 0.0, -0.52, 0xfda4af]], fore: [0, 0, 0.1], mz: -0.9, melee: true };
        default: return { p: rifle(0.2, 0.14, 0.2), fore: [0, -0.04, -0.4], mz: -0.64 };
    }
}
function weaponAsset(id) {
    const wd = weaponsDb[id] || weaponsDb.ar;
    return cachedGeo('w|' + id, () => {
        const sp = weaponSpec(id, darken(wd.color, 0.8)), g = mergeParts(sp.p);
        g.userData.fore = sp.fore; g.userData.mz = sp.mz; g.userData.melee = !!sp.melee; return g;
    });
}

// materials per look (a 128px atlas: the skin pattern in the corner, plain white elsewhere, so the same shader draws both)
const _lookMats = new Map(), _markMats = new Map();
function lookMat(sk, fallback) {
    const c1 = sk ? sk.c[0] : fallback, c2 = sk ? sk.c[1] : darken(fallback, 0.55), pat = sk ? sk.pat : 'solid';
    const key = c1 + '|' + c2 + '|' + pat;
    let m = _lookMats.get(key); if (m) return m;
    const [c, g] = makeCanvas(128);
    g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128);
    g.save(); g.translate(0, 64); paintSkin(g, 64, c1, c2, pat, c1 ^ c2); g.restore();      // bottom-left of the canvas = the texture's (0..0.5, 0..0.5) corner the outfit UVs use
    const tex = canvasTex(c); tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
    m = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true });
    if (pat === 'glow') { m.emissive = new THREE.Color(c2); m.emissiveIntensity = 0.35; }
    _lookMats.set(key, m); return m;
}
const markMat = (col) => _markMats.get(col) || (_markMats.set(col, new THREE.MeshLambertMaterial({ color: col })), _markMats.get(col));
const _flashM = new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false });
const _flashGeo = new THREE.BoxGeometry(0.16, 0.16, 0.1);
const _avUp = new V3(0, 0, 1), _avD = new V3(), _avQ = new THREE.Quaternion();

function pcol(p) { return NET.mode === 'tourney' ? (p.spec ? p.color : TEAM_COLORS[p.team]) : (NET.pvp ? TEAM_COLORS[p.team] : p.color); }
function makeAvatar(p) {
    const col = pcol(p), l = lookOf(p) || null, ge = avGeos(l && l.av), mat = lookMat(l && l.sk, col);
    const g = new THREE.Group(), hip = new THREE.Group(), inner = new THREE.Group();
    hip.position.y = 0.86; inner.position.y = -0.86; g.add(hip); hip.add(inner);
    const mesh = (geo, m, parent, shadow) => { const o = new THREE.Mesh(geo, m); o.castShadow = !!shadow; parent.add(o); return o; };
    const mk = (parent, x) => { const lg = new THREE.Group(); lg.position.set(x, 0.86, 0); mesh(legGeo(), mat, lg, true); parent.add(lg); return lg; };
    const legL = mk(inner, -0.12), legR = mk(inner, 0.12);
    mesh(ge.torso, mat, inner, true); mesh(markGeo(), markMat(col), inner, false);
    const head = new THREE.Group(); head.position.y = 1.5; inner.add(head); mesh(ge.head, mat, head, true);
    const aim = new THREE.Group(); aim.position.y = 1.4; inner.add(aim);
    const wp = new THREE.Group(); aim.add(wp);
    const gun = new THREE.Mesh(weaponAsset('ar'), mat); gun.castShadow = false; wp.add(gun); gun.material = _gunMat;
    const flash = new THREE.Mesh(_flashGeo, _flashM); flash.visible = false; wp.add(flash);
    const armL = mesh(ge.arm, mat, aim, false), armR = mesh(ge.arm, mat, aim, false);
    const tag = nameTag(p, col); tag.position.y = 2.6; g.add(tag);
    scene.add(g);
    return { g, hip, inner, legL, legR, head, arms: aim, aim, wp, gun, flash, armL, armR, tag, phase: 0, px: 0, pz: 0, w: -1, slK: 0, aimK: 0, hp: 0, melee: false, fore: [0, 0, -0.3] };
}
const _gunMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const SH_R = new V3(0.3, 0, 0), SH_L = new V3(-0.3, 0, 0), _t1 = new V3(), _t2 = new V3(), _eu = new THREE.Euler();
function pointArm(arm, shoulder, hand) {
    _avD.copy(hand).sub(shoulder); const len = _avD.length() || 0.01;
    arm.position.copy(shoulder); arm.quaternion.copy(_avQ.setFromUnitVectors(_avUp, _avD.multiplyScalar(1 / len)));
    arm.scale.z = clamp(len / 0.63, 0.55, 1.5);
}
function netUpdateAvatars(dt) {
    const now = performance.now(), tz = NET.mode === 'tourney';
    for (const p of netPlayers.values()) {
        if (!p.av) continue;
        const src = NET.host ? p.peer : NET.hostPeer;
        const rt = now + (src && src.off !== undefined ? src.off : 0) - INTERP_MS;
        const a = p.av;
        let pitch = 0;
        if (p.buf.sample(rt, p.cur)) {
            a.g.position.set(p.cur[0], p.cur[3], p.cur[2]);
            a.g.rotation.y = p.cur[4];
        }
        pitch = clamp(p.cur[5], -1.2, 1.2);
        const sp = Math.hypot(a.g.position.x - a.px, a.g.position.z - a.pz) / Math.max(dt, 1e-3);
        a.px = a.g.position.x; a.pz = a.g.position.z;
        const f = p.f | 0, sliding = !!(f & 8), aiming = !!(f & 2), reloading = !!(f & 16), alive = !!(f & 1);
        a.slK = damp(a.slK, sliding ? 1 : 0, 14, dt);
        a.aimK = damp(a.aimK, (aiming || p.fireT > 0) ? 1 : 0, 10, dt);
        const walk = clamp(sp / 4, 0, 1) * (1 - a.slK);
        a.phase += Math.min(sp, 12) * dt * 2.1;
        const sw = Math.sin(a.phase) * walk * 0.8;
        a.legL.rotation.x = lerp(sw, 0.8, a.slK); a.legR.rotation.x = lerp(-sw, 0.65, a.slK);
        a.hip.rotation.x = 0.5 * a.slK; a.hip.position.y = 0.86 - 0.36 * a.slK + Math.abs(Math.cos(a.phase)) * 0.03 * walk;
        a.head.rotation.x = pitch * 0.6 - 0.3 * a.slK;
        // weapon change
        if (a.w !== p.w) {
            a.w = p.w; const id = WEAPON_ORDER[p.w] || 'ar', geo = weaponAsset(id);
            a.gun.geometry = geo; a.fore = geo.userData.fore; a.melee = geo.userData.melee; a.flash.position.set(0, 0.04, geo.userData.mz - 0.05);
        }
        const spec = tz && p.spec;
        a.wp.visible = !spec;
        const kick = p.fireT > 0 ? p.fireT / 0.08 : 0;
        if (spec) {         // audience: arms down by the sides, clapping now and then
            const cl = Math.max(0, Math.sin(gameTime * 3 + p.id)) * 0.25;
            a.aim.rotation.x = 0; a.aim.position.y = 1.4;
            pointArm(a.armR, SH_R, _t1.set(0.3, -0.5 + cl, -0.12 - cl)); pointArm(a.armL, SH_L, _t2.set(-0.3, -0.5 + cl, -0.12 - cl));
        } else {
            a.aim.position.y = 1.4;
            a.aim.rotation.x = pitch * 0.85 - 0.32 * (1 - a.aimK) - 0.35 * a.slK;
            const sway = Math.sin(a.phase * 0.5) * 0.012 * walk;
            // the weapon sits at the right hand; aiming pulls it to the middle, in front of the face
            a.wp.position.set(lerp(0.17, 0.04, a.aimK), lerp(-0.18, -0.09, a.aimK) + sway, lerp(-0.3, -0.38, a.aimK) + kick * 0.07);
            a.wp.rotation.set(reloading ? -0.7 : kick * 0.1, 0, reloading ? 0.5 : 0);
            if (a.melee && kick > 0) a.wp.rotation.x = -1.3 * kick;
            a.flash.visible = p.fireT > 0 && !a.melee; if (a.flash.visible) a.flash.rotation.z = Math.random() * 3;
            _t1.copy(a.wp.position);
            _eu.copy(a.wp.rotation); _t2.set(a.fore[0], a.fore[1], a.fore[2]).applyEuler(_eu).add(a.wp.position);
            pointArm(a.armR, SH_R, _t1); pointArm(a.armL, SH_L, _t2);
        }
        a.g.scale.y = 1;
        // in PvP dead players vanish (burst of blocks); in co-op a downed player lies on the floor; tournament audience stays in the stands
        if (NET.pvp) a.g.visible = alive || !!spec;
        else { a.g.visible = true; a.g.rotation.x = alive ? 0 : -1.4; }
        if (p.fireT > 0) p.fireT -= dt;
        // host: remote positions also drive the enemy AI, blocked when they've gone quiet
        if (NET.host && now - p.seenT > 3000) p.tgt.alive = false;
    }
}

// ---------- the launcher's goons screen link + a slow refresh so a skin you just put on shows up ----------
setInterval(() => { try { updateMyLook(); } catch (e) {} }, 2500);
setInterval(() => { try { refreshStanding(); } catch (e) {} }, 60000);
setTimeout(() => { try { updateMyLook(); refreshStanding(); } catch (e) {} }, 400);
