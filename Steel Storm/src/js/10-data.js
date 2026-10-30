// ============================================================
// VEHICLES + RESEARCH TREE. 3 lines (ground / air / naval), tiers I-IV, 10 vehicles each.
// hp, ar (armor: damage / (1 + ar/100)), sp (top speed u/s), tn (hull turn rad/s), tt (turret rad/s)
// w1 main, w2 secondary, w3 bombs. k = shell | bullet | rocket | bomb. pierce = share of armor ignored.
// ============================================================
const LINES = { g: { name: 'Ground', tag: 'TANKS', col: '#9bc44a' }, a: { name: 'Air', tag: 'JETS', col: '#58b8ff' }, n: { name: 'Naval', tag: 'WARSHIPS', col: '#3ad0c4' } };
const RP_COST = [0, 0, 350, 1100, 3000], CR_COST = [0, 0, 1800, 6500, 22000];
const COL = { OL: 0x5b6b3a, OL2: 0x76874a, TN: 0xa89463, TN2: 0xc2ad74, GR: 0x66707a, GR2: 0x8893a0, DK: 0x3a3d44, DK2: 0x50555e, NV: 0x3b4d6b, RD: 0x8a3b2f, WH: 0xdfe3e8, SD: 0xc2a35a, BL: 0x2e6fa8 };
const VEHS = [];
function GT(id, t, n, req, hp, ar, sp, tt, dmg, rl, v, m, desc, o) {
    VEHS.push(Object.assign({ id, ln: 'g', t, n, req, hp, ar, sp, tn: 2.1 - t * 0.12, tt, r: Math.max(m.hull[0], m.hull[2] * 0.5) * 0.6 + 0.8, cd: 15 + m.hull[2] * 0.6,
        w1: { n: 'Cannon', k: 'shell', dmg, rl, v, sp: 2 + dmg / 35, life: 4, g: 14, snd: dmg > 120 ? 'heavy' : 'cannon' },
        w2: { n: 'Machine gun', k: 'bullet', dmg: 2 + t * 1.2, rl: 0.1, v: 430, life: 0.9, g: 3, sprd: 0.02 }, m, desc }, o || {}));
}
function AT(id, t, n, req, hp, ar, minSp, maxSp, turn, gd, grl, rk, bm, m, desc) {
    const o = { id, ln: 'a', t, n, req, hp, ar, sp: maxSp, minSp, turn, r: 2.6 + m.len * 0.12, cd: 20 + m.len * 0.6, m, desc,
        w1: { n: 'Cannons', k: 'bullet', dmg: gd, rl: grl, v: 560, life: 0.85, g: 2, sprd: 0.012 } };
    if (rk) o.w2 = { n: 'Rockets', k: 'rocket', dmg: rk[1], cnt: rk[0], rl: 0.4, rel: 22, v: 340, sp: 7, life: 3.2, g: 3, pierce: 0.4 };
    if (bm) o.w3 = { n: 'Bombs', k: 'bomb', dmg: bm[1], cnt: bm[0], rl: 0.6, rel: 40, sp: bm[2], life: 12, g: 20, pierce: 0.7 };
    VEHS.push(o);
}
function NT(id, t, n, req, hp, ar, sp, tn, dmg, rl, salvo, v, m, desc) {
    VEHS.push({ id, ln: 'n', t, n, req, hp, ar, sp, tn, tt: 0.55 - t * 0.04, r: m.w * 0.5 + m.len * 0.2, cd: 28 + m.len * 0.9, m, desc,
        w1: { n: 'Main guns', k: 'shell', dmg, rl, v, nn: salvo, spread: 0.014, sp: 5 + dmg / 28, life: 6, g: 22, snd: dmg > 150 ? 'heavy' : 'cannon' },
        w2: { n: 'Secondary guns', k: 'bullet', dmg: 4 + t * 2.5, rl: 0.12, v: 400, life: 0.9, g: 5, sprd: 0.03 } });
}
// ----- ground: id, tier, name, requires, hp, armor, speed, turret speed, dmg, reload, shell speed, model
GT('g1a', 1, 'M-1 Scout', null, 140, 8, 17, 2.6, 38, 1.5, 290, { hull: [3, .9, 5], tur: [1.9, .8, 2.2], tz: -.2, gun: [3.2, .14, 1], c: [COL.OL, COL.OL2] }, 'Fast light tank. Weak armor, quick gun.');
GT('g1b', 1, 'Bruiser', null, 200, 20, 12, 2.2, 55, 2.4, 280, { hull: [3.6, 1.1, 5.8], tur: [2.4, 1, 2.8], tz: -.3, gun: [3.8, .18, 1], c: [COL.OL, COL.OL2] }, 'Sturdy medium tank. A good all-rounder.');
GT('g2a', 2, 'Hornet', 'g1a', 180, 10, 19, 2.8, 26, .85, 330, { hull: [3, .9, 5.4], tur: [1.7, .9, 2], tz: 0, gun: [3, .12, 2], c: [COL.TN, COL.TN2] }, 'Twin autocannons: a storm of small shells.');
GT('g2b', 2, 'Warhammer', 'g1b', 280, 35, 13, 2.2, 80, 2.8, 300, { hull: [3.8, 1.2, 6.2], tur: [2.6, 1.1, 3], tz: -.3, gun: [4.4, .2, 1], c: [COL.TN, COL.TN2], sk: 1 }, 'Armored medium tank with a hard-hitting gun.');
GT('g2c', 2, 'Stalker TD', 'g1b', 240, 45, 11, 1.4, 120, 4, 340, { hull: [3.6, 1.1, 6.4], tur: [3.2, 1, 4.2], tz: -.8, gun: [5.2, .2, 1], c: [COL.TN2, COL.TN], cas: 1 }, 'Tank destroyer. Slow turret, big punch.');
GT('g3a', 3, 'Viper', 'g2a', 260, 25, 18, 2.8, 70, 2, 350, { hull: [3.2, 1, 6], tur: [2, .9, 2.6], tz: -.2, gun: [4.6, .17, 1], c: [COL.GR, COL.GR2] }, 'Fast hunter with a long gun.');
GT('g3b', 3, 'Bastion', 'g2b', 480, 80, 9, 1.8, 110, 3.4, 320, { hull: [4.6, 1.5, 6.8], tur: [3.4, 1.4, 3.6], tz: -.4, gun: [4.8, .26, 1], c: [COL.GR, COL.GR2], sk: 1 }, 'Heavy tank. Thick plates, slow.');
GT('g3c', 3, 'Longbow', 'g2c', 300, 55, 10, 1.3, 170, 5, 400, { hull: [3.8, 1.2, 7.2], tur: [3.4, 1.1, 4.6], tz: -1, gun: [6.6, .22, 1], c: [COL.GR2, COL.GR], cas: 1 }, 'Long-range tank destroyer.');
GT('g4a', 4, 'Colossus', 'g3b', 750, 120, 8, 1.7, 90, 3.4, 330, { hull: [5.4, 1.8, 8.2], tur: [4.2, 1.6, 4.4], tz: -.5, gun: [5.6, .26, 2], c: [COL.DK, COL.DK2], sk: 1 }, 'Super-heavy twin-gun fortress.');
GT('g4b', 4, 'Ghost', 'g3a', 420, 70, 20, 3, 105, 2.2, 420, { hull: [3.6, 1, 6.6], tur: [2.4, .9, 3.2], tz: -.3, gun: [5.4, .18, 1], c: [COL.DK2, COL.NV] }, 'Fast modern battle tank.');
// ----- air: id, tier, name, requires, hp, armor, minSpeed, maxSpeed, turn, gun dmg, gun reload, [rockets, dmg], [bombs, dmg, radius], model
AT('a1a', 1, 'Sparrow', null, 70, 0, 42, 82, 1.7, 4, .06, null, null, { k: 'prop', len: 7, span: 9, c: [COL.SD, COL.RD] }, 'Nimble propeller fighter.');
AT('a1b', 1, 'Mule', null, 90, 3, 38, 70, 1.3, 3.5, .08, null, [2, 160, 14], { k: 'prop', len: 8, span: 11, c: [COL.OL, COL.OL2], belly: 1 }, 'Light attack plane with 2 bombs.');
AT('a2a', 2, 'Falcon', 'a1a', 85, 0, 48, 98, 1.9, 5, .05, [4, 60], null, { k: 'prop', len: 8, span: 9.5, c: [COL.GR2, COL.NV] }, 'Fast fighter with rockets.');
AT('a2b', 2, 'Hawk J1', 'a1a', 100, 2, 55, 112, 1.7, 6, .06, [4, 60], null, { k: 'jet', len: 9, span: 10, c: [COL.GR2, COL.DK], sweep: 0.1 }, 'First jet. Straight wings.');
AT('a2c', 2, 'Stormer', 'a1b', 160, 8, 38, 68, 1, 4, .09, null, [4, 200, 16], { k: 'bomber', len: 12, span: 17, c: [COL.OL, COL.DK] }, 'Twin-engine bomber: 4 bombs.');
AT('a3a', 3, 'Lancer', 'a2b', 130, 4, 60, 128, 1.8, 7, .05, [6, 70], null, { k: 'jet', len: 12, span: 11, c: [COL.GR, COL.NV], sweep: 0.5 }, 'Swept-wing jet fighter.');
AT('a3b', 3, 'Anvil', 'a2c', 240, 14, 48, 100, 1.1, 6, .07, [4, 70], [6, 240, 18], { k: 'heavy', len: 15, span: 16, c: [COL.DK2, COL.GR] }, 'Heavy jet bomber, 6 big bombs.');
AT('a3c', 3, 'Wraith', 'a2a', 110, 3, 66, 152, 2, 8, .045, [6, 70], null, { k: 'delta', len: 11, span: 10, c: [COL.NV, COL.WH] }, 'Delta-wing interceptor. Very fast.');
AT('a4a', 4, 'Spectre', 'a3a', 190, 10, 70, 168, 2, 9, .04, [10, 80], null, { k: 'jet', len: 14, span: 12, c: [COL.DK, COL.BL], sweep: 0.55, twin: 1 }, 'Twin-tail superfighter.');
AT('a4b', 4, 'Hammerhead', 'a3b', 300, 22, 55, 138, 1.4, 8, .05, [8, 90], [6, 320, 22], { k: 'heavy', len: 16, span: 15, c: [COL.DK2, COL.RD], twin: 1 }, 'Strike jet: rockets and huge bombs.');
// ----- naval: id, tier, name, requires, hp, armor, speed, turn, dmg, reload, shells/salvo, shell speed, model
NT('n1a', 1, 'Gull', null, 260, 10, 14, .5, 45, 2.5, 1, 250, { len: 14, w: 3.6, tur: [[3, .9, 1]], br: [-2, 1.2], c: [0x7d8791, 0x5a636d] }, 'Fast patrol boat.');
NT('n1b', 1, 'Pike', null, 320, 14, 12, .42, 62, 3, 1, 250, { len: 17, w: 4.2, tur: [[4, 1, 1], [-5, .8, 1]], br: [-1, 1.4], c: [0x7d8791, 0x5a636d] }, 'Gunboat with two turrets.');
NT('n2a', 2, 'Marlin', 'n1a', 450, 25, 15, .5, 60, 1.8, 1, 270, { len: 22, w: 4.6, tur: [[6, 1, 1], [-6, 1, 1]], br: [0, 1.6], fun: 1, c: [0x6c7b8a, 0x4d5a68] }, 'Quick corvette.');
NT('n2b', 2, 'Dagger', 'n1b', 600, 30, 13, .42, 80, 2.8, 2, 270, { len: 28, w: 5, tur: [[8, 1.2, 2], [-7, 1.2, 2]], br: [1, 1.8], fun: 2, c: [0x6c7b8a, 0x4d5a68] }, 'Destroyer with twin-barrel turrets.');
NT('n2c', 2, 'Monitor', 'n1b', 650, 45, 6, .3, 200, 6, 1, 300, { len: 24, w: 8, h: 2.2, tur: [[4, 2.2, 2]], br: [-6, 1.6], c: [0x6a6f55, 0x4a4e3b] }, 'Slow barge with a huge gun.');
NT('n3a', 3, 'Sentinel', 'n2a', 800, 45, 14, .42, 85, 2.2, 2, 290, { len: 30, w: 5.4, tur: [[9, 1.2, 2], [0, 1, 1], [-9, 1.2, 2]], br: [3, 2], fun: 2, c: [0x5f6f82, 0x44505f] }, 'Fast frigate.');
NT('n3b', 3, 'Bulwark', 'n2b', 1000, 60, 11, .34, 115, 3.5, 3, 300, { len: 38, w: 6, tur: [[11, 1.5, 3], [-11, 1.5, 3]], br: [1, 2.4], fun: 2, c: [0x5f6f82, 0x44505f] }, 'Cruiser with triple turrets.');
NT('n3c', 3, 'Thunder', 'n2c', 1200, 70, 9, .3, 210, 6, 2, 330, { len: 42, w: 6.6, tur: [[13, 1.7, 2], [8, 1.6, 2], [-12, 1.7, 2]], br: [-2, 2.6], fun: 2, c: [0x586a7a, 0x3e4b58] }, 'Heavy cruiser. Hits very hard.');
NT('n4a', 4, 'Leviathan', 'n3b', 1800, 100, 8.5, .27, 280, 7, 3, 340, { len: 52, w: 8, tur: [[16, 2, 3], [10, 2, 3], [-14, 2, 3]], br: [0, 3.2], fun: 2, c: [0x4f5f70, 0x38444f] }, 'Battleship.');
NT('n4b', 4, 'Titan', 'n3c', 2400, 130, 7, .24, 360, 9, 3, 360, { len: 60, w: 9, tur: [[20, 2.2, 3], [13, 2.2, 3], [-14, 2.2, 3], [-22, 2.2, 3]], br: [0, 3.6], fun: 2, c: [0x46535f, 0x333d46] }, 'Super-battleship. A floating fortress.');
// balance pass: jets are made of paper next to their guns, so they get a lot more hit points; tanks a little more.
const HPK = { g: 1.6, a: 2.4, n: 1.5 };
VEHS.forEach(v => { v.hp = Math.round(v.hp * HPK[v.ln]); });
const VBY = {};
VEHS.forEach((v, i) => {
    v.i = i; VBY[v.id] = v;
    const idx = VEHS.filter(o => o.ln === v.ln && o.t === v.t).indexOf(v);
    v.rp = v.t === 1 ? 0 : Math.round(RP_COST[v.t] * (1 + idx * 0.12) / 10) * 10;
    v.cost = v.t === 1 ? 0 : Math.round(CR_COST[v.t] * (1 + idx * 0.1) / 50) * 50;
    // top damage per second, used by the host to sanity-check hits
    let dps = 0; for (const k of ['w1', 'w2', 'w3']) { const w = v[k]; if (w) dps += w.dmg * (w.nn || 1) / Math.max(0.04, w.rl) * (w.sp ? 1.6 : 1); }
    v.maxDps = dps;
});
const TIER_ROMAN = ['', 'I', 'II', 'III', 'IV'];
function vStats(v) {
    const w = v.w1, s = [['Hit points', v.hp], ['Armor', v.ar], ['Top speed', Math.round(v.sp * (v.ln === 'a' ? 3.6 : 3.6)) + ' km/h']];
    s.push(['Main gun', w.dmg + (w.nn > 1 ? ' x' + w.nn : '') + ' dmg']);
    if (v.ln !== 'a') s.push(['Reload', (w.rl).toFixed(1) + ' s']); else s.push(['Cannon rate', Math.round(1 / w.rl) + '/s']);
    if (v.w2 && v.ln === 'a') s.push(['Rockets', v.w2.cnt + ' x ' + v.w2.dmg]);
    if (v.w3) s.push(['Bombs', v.w3.cnt + ' x ' + v.w3.dmg]);
    return s;
}
// ---------- research / purchase rules ----------
function isResearched(id) { return !!save.researched[id]; }
function isOwned(id) { return !!save.owned[id]; }
function canResearch(id) { const v = VBY[id]; return !isResearched(id) && (!v.req || isResearched(v.req)); }
function rpOf(id) { return save.rp[id] || 0; }
function addRp(n) {      // match RP go to the vehicle being researched, leftovers to free RP
    n = Math.round(n); if (n <= 0) return;
    const id = save.target;
    if (id && VBY[id] && canResearch(id)) {
        const v = VBY[id], need = v.rp - rpOf(id), put = Math.min(need, n);
        save.rp[id] = rpOf(id) + put; n -= put;
        if (rpOf(id) >= v.rp) { save.researched[id] = true; delete save.rp[id]; save.target = null; toast(v.n + ' researched! Buy it with credits.'); }
    }
    save.freeRp += n;
}
function setTarget(id) { if (!canResearch(id)) return false; save.target = id; writeSave(); return true; }
function spendFreeRp(id) {
    if (!canResearch(id)) return false; const v = VBY[id], need = v.rp - rpOf(id), put = Math.min(need, save.freeRp);
    if (put <= 0) return false; save.freeRp -= put; save.rp[id] = rpOf(id) + put;
    if (rpOf(id) >= v.rp) { save.researched[id] = true; delete save.rp[id]; if (save.target === id) save.target = null; }
    writeSave(); return true;
}
function buyVeh(id) {
    const v = VBY[id]; if (!v || !isResearched(id) || isOwned(id) || save.credits < v.cost) return false;
    save.credits -= v.cost; save.owned[id] = true; if (save.lineup.length < 5) save.lineup.push(id); writeSave(); return true;
}
function lineupToggle(id) {
    const i = save.lineup.indexOf(id);
    if (i >= 0) { if (save.lineup.length > 1) save.lineup.splice(i, 1); }
    else if (isOwned(id) && save.lineup.length < 5) save.lineup.push(id);
    else return false;
    save.sel = clamp(save.sel, 0, save.lineup.length - 1); writeSave(); return true;
}
