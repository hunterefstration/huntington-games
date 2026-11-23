// ============================================================
// The guns. WEAPONS = the numbers (damage, rate, magazine, price, the rank that unlocks it). The model of each (arms,
// hands and gun as one animated piece, see tools/blender/make_viewmodel.py) comes from assets/w_<id>.hgm, and where its
// sight, muzzle and ejection port are from assets/weapons.json. A weapon whose model is not made yet is simply not offered.
// Gun = the one in the player's hands: firing, reloading, aiming down the sight, switching, and drawing it.
// ============================================================
// slot: 1 = a main gun (two carried), 2 = sidearm. rpm 0 = one shot per fire clip (pump, bolt). spread = [from the hip, aimed].
const WEAPONS = {
    pistol:   { name: 'P9 SERVICE', kind: 'Sidearm', slot: 2, price: 0, rank: 0, dmg: 26, head: 2.2, rpm: 380, auto: false, mag: 15, reserve: 90, spread: [0.016, 0.004], kick: 0.011, adsFov: 58, move: 1.05, snd: { vol: 0.42, crack: 7000, body: 190, tail: 0.22 }, desc: 'Always with you. Fast to draw, fast to reload, and it never runs dry for long.' },
    carbine:  { name: 'MK4 CARBINE', kind: 'Rifle', slot: 1, price: 0, rank: 0, dmg: 30, head: 2.6, rpm: 650, auto: true, mag: 30, reserve: 180, spread: [0.02, 0.003], kick: 0.008, adsFov: 50, move: 1, snd: { vol: 0.5, crack: 6000, body: 150, tail: 0.35 }, desc: 'The rifle everyone starts with, and plenty finish with. Does everything well.' },
    smg:      { name: 'VIPER SMG', kind: 'SMG', slot: 1, price: 900, rank: 0, dmg: 18, head: 2, rpm: 900, auto: true, mag: 32, reserve: 224, spread: [0.022, 0.006], kick: 0.005, adsFov: 56, move: 1.1, snd: { vol: 0.4, crack: 7500, body: 210, tail: 0.2 }, desc: 'A hose. Light enough to run with and quick enough to clear a doorway.' },
    revolver: { name: '.44 JUDGE', kind: 'Sidearm', slot: 2, price: 1100, rank: 1, dmg: 110, head: 2.5, rpm: 0, auto: false, mag: 6, reserve: 42, spread: [0.014, 0.002], kick: 0.04, adsFov: 56, move: 1.05, snd: { vol: 0.7, crack: 4500, body: 110, tail: 0.5 }, desc: 'Six answers to six problems. Slow, loud, final.' },
    shotgun:  { name: 'M90 BREACHER', kind: 'Shotgun', slot: 1, price: 1400, rank: 0, dmg: 15, pellets: 9, head: 1.5, rpm: 0, auto: false, mag: 6, reserve: 48, spread: [0.075, 0.055], kick: 0.035, adsFov: 60, move: 0.97, falloff: [7, 22], snd: { vol: 0.75, crack: 3800, body: 95, tail: 0.5 }, desc: 'Nine pellets a pull. Nothing that gets close stays standing.' },
    dmr:      { name: 'SR-10 MARKSMAN', kind: 'Marksman', slot: 1, price: 2400, rank: 2, dmg: 78, head: 2.6, rpm: 300, auto: false, mag: 10, reserve: 70, spread: [0.03, 0.0008], kick: 0.02, adsFov: 26, zoom: true, move: 0.96, pierce: 1, snd: { vol: 0.62, crack: 5200, body: 125, tail: 0.5 }, desc: 'One round, one target, through the hood of the one in front as well.' },
    lmg:      { name: 'HK-21 SUPPRESSOR', kind: 'Machine gun', slot: 1, price: 3600, rank: 3, dmg: 32, head: 2, rpm: 720, auto: true, mag: 100, reserve: 300, spread: [0.03, 0.006], kick: 0.007, adsFov: 54, move: 0.86, snd: { vol: 0.58, crack: 5000, body: 120, tail: 0.4 }, desc: 'A hundred rounds before it wants feeding. Hold a corridor by yourself.' },
    sniper:   { name: 'LR-7 LONGSHOT', kind: 'Sniper', slot: 1, price: 4200, rank: 3, dmg: 300, head: 3, rpm: 0, auto: false, mag: 5, reserve: 35, spread: [0.05, 0], kick: 0.05, adsFov: 13, zoom: true, move: 0.93, pierce: 4, snd: { vol: 0.9, crack: 4200, body: 85, tail: 0.9 }, desc: 'Reaches across the whole map and through whatever is standing in the way.' },
    rpg:      { name: 'RG-7 LAUNCHER', kind: 'Launcher', slot: 1, price: 5000, rank: 5, dmg: 450, blast: 5, rpm: 0, auto: false, mag: 1, reserve: 5, spread: [0.01, 0.002], kick: 0.06, adsFov: 56, move: 0.88, rocket: true, snd: { vol: 0.9, crack: 2500, body: 70, tail: 1 }, desc: 'For when the problem is a crowd, or a boss, or a crowd round a boss.' },
    minigun:  { name: 'M134 REAPER', kind: 'Rotary', slot: 1, price: 7000, rank: 6, dmg: 21, head: 1.6, rpm: 1500, auto: true, mag: 200, reserve: 400, spread: [0.035, 0.03], kick: 0.003, adsFov: 62, move: 0.78, spin: 0.55, noAds: true, snd: { vol: 0.45, crack: 5600, body: 130, tail: 0.18 }, desc: 'It takes a moment to wake up. Then it does not stop.' },
    // burst: rounds a pull. lob: a grenade on an arc. flame: everything in a short cone. bolt: silent, no flash. cleave: how many one swing can cut.
    burst:    { name: 'AK-9 TRIAD', kind: 'Burst rifle', slot: 1, price: 2000, rank: 1, dmg: 41, head: 2.4, rpm: 900, auto: false, burst: 3, burstGap: 0.3, mag: 30, reserve: 150, spread: [0.022, 0.0025], kick: 0.009, adsFov: 48, move: 0.99, snd: { vol: 0.55, crack: 5200, body: 135, tail: 0.38 }, desc: 'Three rounds for every pull, landing almost on top of each other. Rewards a steady hand.' },
    lever:    { name: 'M1894 RANCHER', kind: 'Lever rifle', slot: 1, price: 2600, rank: 1, dmg: 105, head: 2.5, rpm: 0, auto: false, mag: 8, reserve: 56, spread: [0.02, 0.0012], kick: 0.028, adsFov: 44, move: 1.02, pierce: 1, snd: { vol: 0.72, crack: 4300, body: 105, tail: 0.6 }, desc: 'A hundred and thirty years old and still the best answer to one thing at a time.' },
    crossbow: { name: 'RAVEN CROSSBOW', kind: 'Crossbow', slot: 1, price: 2800, rank: 2, dmg: 260, head: 2.4, rpm: 0, auto: false, mag: 6, reserve: 30, spread: [0.012, 0.0005], kick: 0.012, adsFov: 30, zoom: false, move: 1.04, pierce: 2, bolt: true, snd: { vol: 0.16, crack: 8000, body: 320, tail: 0.06 }, desc: 'No flash, no bang, and the bolt goes on through the next two. Nothing hears it coming.' },
    autoshot: { name: 'AA-12 STORM', kind: 'Shotgun', slot: 1, price: 3800, rank: 4, dmg: 12, pellets: 8, head: 1.4, rpm: 300, auto: true, mag: 20, reserve: 80, spread: [0.085, 0.06], kick: 0.022, adsFov: 60, move: 0.92, falloff: [6, 19], snd: { vol: 0.7, crack: 3600, body: 90, tail: 0.4 }, desc: 'A drum of twenty and no pump to work. Hold the trigger and walk forward.' },
    gl:       { name: 'MGL-6 THUMPER', kind: 'Launcher', slot: 1, price: 4200, rank: 4, dmg: 330, blast: 4.6, rpm: 100, auto: false, mag: 6, reserve: 24, spread: [0.012, 0.004], kick: 0.03, adsFov: 58, move: 0.92, lob: true, snd: { vol: 0.6, crack: 1400, body: 70, tail: 0.25 }, desc: 'Six grenades on a curve. Over the barricade, into the crowd behind it.' },
    flamer:   { name: 'M2 SCORCHER', kind: 'Flamethrower', slot: 1, price: 5500, rank: 5, dmg: 17, rpm: 600, auto: true, mag: 100, reserve: 300, spread: [0, 0], kick: 0.0008, adsFov: 64, move: 0.9, noAds: true, flame: { range: 9.5, cone: 0.1 }, snd: { vol: 0.16, crack: 1100, body: 60, tail: 0.14 }, desc: 'Ten metres of fire. Everything in front of you burns, and keeps burning.' },
    machete:  { name: 'MACHETE', kind: 'Blade', slot: 2, price: 1800, rank: 1, dmg: 170, melee: true, rpm: 0, auto: true, mag: 0, reserve: 0, spread: [0, 0], kick: 0, adsFov: 72, move: 1.12, noAds: true, cleave: 3, reach: 2.7, arc: 0.3, snd: { vol: 0.2, crack: 9000, body: 300, tail: 0.05 }, desc: 'A wide, heavy swing that goes through three of them at once.' },
    knife:    { name: 'COMBAT KNIFE', kind: 'Blade', slot: 2, price: 600, rank: 0, dmg: 120, melee: true, rpm: 0, auto: true, mag: 0, reserve: 0, spread: [0, 0], kick: 0, adsFov: 72, move: 1.18, noAds: true, snd: { vol: 0.2, crack: 9000, body: 300, tail: 0.05 }, desc: 'Quiet, quick, and you run faster with it out. One clean hit.' }
};
const WEAPON_ORDER = ['pistol', 'carbine', 'smg', 'shotgun', 'burst', 'revolver', 'knife', 'lever', 'machete', 'dmr', 'crossbow', 'sniper', 'lmg', 'autoshot', 'gl', 'rpg', 'flamer', 'minigun'];
const UP_MAX = 3, UP_NAMES = ['STOCK', 'MK II', 'MK III', 'ELITE'];
// where things are on each model, in the model's own space (written by the Blender script). The carbine's is known.
const HAVE = {};
let WINFO = { carbine: { eye: [-0.17, 0.155, 0.30], sight: [0.0025, 0.1784, -0.06], scope: 0.0135, muzzle: [0, 0.1085, -0.58], eject: [0.035, 0.125, -0.06], ejectDir: [1, 0.55, 0.15], ejectAt: 0.02, seat: 1.45 } };
const Weapons = {
    ready: false,
    // what is in the assets folder: weapons.json says where things are on each gun; every model file is asked for by name
    // (a HEAD request) so that a weapon, a map or a figure is only offered once its file is really there
    async init() {
        if (this.ready) return; await Packs.ready; let j = {}; try { const r = await fetch(AST('weapons.json')); if (r.ok) j = await r.json(); } catch (e) { }
        for (const k in j) WINFO[k] = Object.assign(WINFO[k] || {}, j[k]);
        const names = Object.keys(WINFO).map(id => 'w_' + id).concat(Object.keys(MAPS).map(id => MAPS[id].file), FOE_IDS.map(id => 'foe_' + id), ['soldier']);
        await Promise.all(names.map(n => fetch(AST(n + '.hgm'), { method: 'HEAD' }).then(r => { HAVE[n] = r.ok; }, () => { HAVE[n] = false; })));
        this.ready = true;
    },
    made(id) { return !!WINFO[id] && !!WEAPONS[id] && HAVE['w_' + id] !== false; },
    list() { return WEAPON_ORDER.filter(id => this.made(id)); },
    // a weapon's numbers at an upgrade level (each level: more damage, a bigger magazine, a faster reload, less kick)
    at(id, lvl) { const w = WEAPONS[id], l = lvl || 0; return Armory.mods(id, Object.assign({}, w, { id, lvl: l, dmg: w.dmg * (1 + 0.12 * l), mag: w.melee ? 0 : Math.round(w.mag * (1 + (w.mag > 2 ? 0.15 : 0) * l)), reloadK: 1 - 0.08 * l, kick: w.kick * (1 - 0.1 * l) })); },
    // the supply crate's price for this run: half for a weapon you own
    cost(id) { return Math.round((Armory.owns(id) ? WEAPONS[id].price / 2 : WEAPONS[id].price) * (Game.cls === 'engineer' ? 0.9 : 1) / 50) * 50; },
    upCost(id, lvl) { return Math.max(300, Math.round(WEAPONS[id].price * 0.35 / 50) * 50) * (lvl + 1); },
    // bars for the armory, 0..1
    bars(id, lvl) { const w = this.at(id, lvl), rate = w.rpm || 60 / ((WINFO[id] && WINFO[id].clips && WINFO[id].clips.vm_fire) || 0.9);
        return { Damage: clamp(w.dmg * (w.pellets || 1) / 320, 0.04, 1), 'Fire rate': clamp(rate / 1000, 0.04, 1), Accuracy: clamp(1 - w.spread[1] * 16 - w.spread[0] * 4, 0.05, 1), Control: clamp(1 - w.kick * 16, 0.05, 1), Mobility: clamp((w.move - 0.7) / 0.5, 0.05, 1), Magazine: clamp(w.mag / 100, 0.03, 1) }; }
};

const Gun = { models: {}, cur: null, W: null, state: {}, flashRot: 0, hipAdj: [0.017, -0.035, -0.02], scale: 0.9 };
const GM = new Float32Array(16), GF = [0, 0, 0];
// bring a weapon's model in (once): its own file, or, for the first rifle, the copy the map file carries
Gun.load = async function (id) {
    if (Gun.models[id]) return Gun.models[id];
    let A = null; try { A = await HG3D.load(AST('w_' + id + '.hgm'), { anisotropy: 1 }); } catch (e) { A = null; }
    if ((!A || !A.skins.viewmodel) && World.A && World.A.skins.viewmodel && id === 'carbine') A = World.A;
    if (!A || !A.skins.viewmodel) throw new Error('the model of the ' + id + ' is missing');
    const vm = A.crowd('viewmodel', 1), I = WINFO[id] || WINFO.carbine, adj = I.hipAdj || (id === 'carbine' ? Gun.hipAdj : [0, -0.008, 0]);      // the carbine sits a little lower and further right than it was framed: the owner liked it there for (const m of vm.node.children) m.frustumCulled = false;
    // every weapon file carries the same picture of the arms: only the first one is ever sent to the graphics card
    for (const m of vm.node.children) if (m.name === 'vm_arms' && m.material.map) { if (Gun.armsTex) m.material.map = Gun.armsTex; else Gun.armsTex = m.material.map; }
    vm.node.visible = false; World.gunScene.add(vm.node);
    const len = n => vm.clips[n] ? vm.clips[n].count / vm.clips[n].fps : 0;
    if (!I.eye) I.eye = WINFO.carbine.eye; if (!I.sight) I.sight = [0, 0.1, -0.1]; if (!I.muzzle) I.muzzle = [0, 0.08, -0.4];
    const M = Gun.models[id] = { id, A, vm, node: vm.node, I, clips: vm.clips, len,
        hip: [-Gun.scale * I.eye[0] + adj[0], -Gun.scale * I.eye[1] + adj[1], -Gun.scale * I.eye[2] + adj[2]],
        ads: [-Gun.scale * I.sight[0], -Gun.scale * I.sight[1], -0.18 - Gun.scale * I.sight[2]] };
    Armory.paint(M); return M;
};
// a weapon that is no longer carried gives its memory back
Gun.drop = function (id) { const M = Gun.models[id]; if (!M || M === Gun.cur || M.A === World.A) return; World.gunScene.remove(M.node); R.release(M.node, M.A.textures.filter(t => t !== Gun.armsTex).concat([M.A.skins.viewmodel.tex])); delete Gun.models[id]; };
// what the player carries in a run: ids in slots, rounds in each
Gun.reset = function (ids, levels) {
    Gun.state = {}; Gun.slots = ids.slice(); if (Gun.cur) Gun.cur.node.visible = false; Gun.cur = null; Gun.W = null; Gun.next = null;
    for (const id of Object.keys(Gun.models)) if (ids.indexOf(id) < 0) Gun.drop(id);          // what the last run bought is not carried into this one
    ids.forEach(id => { if (id) Gun.give(id, levels ? levels[id] : 0); });
};
Gun.give = function (id, lvl) { const w = Weapons.at(id, lvl || 0); Gun.state[id] = { ammo: w.mag, reserve: w.reserve, lvl: lvl || 0 }; };
Gun.stats = id => Weapons.at(id, Gun.state[id] ? Gun.state[id].lvl : 0);
// take a weapon in hand (it comes up with its draw clip)
Gun.equip = function (id, P) {
    const M = Gun.models[id]; if (!M || !Gun.state[id]) return false;
    if (Gun.cur) Gun.cur.node.visible = false;
    Gun.cur = M; Gun.W = Gun.stats(id); Gun.S = Gun.state[id]; M.node.visible = true; Gun.next = null;
    P.reload = 0; P.cool = Math.min(0.35, M.len('vm_draw') * 0.7); P.melee = 0; P.spin = 0; P.burstQ = 0; P.eject = -1; Input.aimOn = false;
    P.vm = { cur: M.clips.vm_draw ? 'vm_draw' : 'vm_idle', t: 0, prev: '', pt: 0, fade: 0, fadeT: 0 };
    Snd.tone(240, 0.06, 0.08, 'triangle', 420); Snd.noise(0.08, 3000, 800, 0.08, 800);
    return true;
};
Gun.play = function (V, name, fade) { if (!Gun.cur || !Gun.cur.clips[name]) return false; V.prev = V.cur; V.pt = V.t; V.cur = name; V.t = 0; V.fadeT = V.fade = fade || 0; return true; };
Gun.pose = function (V, out) {      // out = [a frame, a second frame, how much of the second]
    const C = Gun.cur.clips, A = Gun.cur.A, c = C[V.cur] || C.vm_idle;
    if (V.fade > 0 && C[V.prev]) { const k = 1 - V.fade / V.fadeT; out[0] = A.frame(C[V.prev], V.pt); out[1] = A.frame(c, V.t); out[2] = k * k * (3 - 2 * k); }
    else A.frame2(c, V.t, out);
    return out;
};
const SWAP = 0.3;          // seconds to change guns: down in the first half, the other one up in the second
Gun.startReload = function (P) {
    const W = Gun.W, S = Gun.S; if (W.melee || P.reload > 0 || S.ammo >= W.mag || S.reserve <= 0 || P.jam > 0) return;
    const M = Gun.cur, base = M.len('vm_reload') || 2; P.reloadLen = base * W.reloadK * (P.fastHands || 1); P.reload = P.reloadLen; P.seated = false; P.reloadRate = base / P.reloadLen;
    Gun.play(P.vm, 'vm_reload', 0.1); Input.aimOn = false; Snd.tone(300, 0.07, 0.07, 'square', 200); Snd.noise(0.1, 2500, 600, 0.09, 600);
};
// one frame of the gun. fire = the trigger is held, tap = it went down this frame. G = the game (G.shot, G.rocket, G.meleeHit).
Gun.update = function (dt, P, fire, tap, G) {
    const W = Gun.W, S = Gun.S, M = Gun.cur, V = P.vm; if (!M) return; if (P.jam > 0) { P.jam -= dt; fire = false; tap = false; }          // a shocker's bolt: nothing fires
    P.cool -= dt; P.kick = Math.max(0, P.kick - dt * 9); P.bloom = Math.max(0, P.bloom - dt * 0.07); P.flashT -= dt; if (P.flashT <= 0) World.flash.visible = false;
    if (tap) P.tapT = 0.14; else P.tapT = Math.max(0, (P.tapT || 0) - dt);
    if (tap && P.reload > 0 && !P.seated && S.ammo > 0 && !W.melee) { P.reload = 0; Gun.play(V, 'vm_idle', 0.06); P.cool = Math.max(P.cool, 0.08); }          // a click a moment early still counts
    // a casing leaves a moment into the fire clip (after the pump or the bolt on those guns)
    if (P.eject >= 0) { P.eject -= dt; if (P.eject < 0 && M.I.eject) Gun.casing(P); }
    // reloading: the rounds are in at the "seat" moment of the clip, the gun is ready at its end
    if (P.reload > 0) {
        P.reload -= dt; const into = (P.reloadLen - P.reload) * P.reloadRate;
        if (!P.seated && into >= (M.I.seat || P.reloadLen * 0.66)) { P.seated = true; const need = W.mag - S.ammo, take = Math.min(need, S.reserve); S.ammo += take; S.reserve -= take; Snd.tone(170, 0.06, 0.1, 'square', 120); Snd.noise(0.12, 2000, 500, 0.06, 400); }
        if (P.reload <= 0) Snd.tone(440, 0.05, 0.05, 'square', 520);
    } else if (!W.melee && S.ammo <= 0 && S.reserve > 0 && P.cool <= 0 && !P.dead) Gun.startReload(P);
    if (hit.KeyR && !P.dead) Gun.startReload(P);
    // melee with whatever is in hand
    if (P.melee > 0) { const was = P.melee; P.melee -= dt; if (was > P.meleeAt && P.melee <= P.meleeAt) G.meleeHit(P, W.melee ? W.dmg : 60); }
    else if (hit.KeyV && !P.dead && P.reload <= 0 && !W.melee) { P.melee = M.len('vm_melee') || 0.4; P.meleeAt = P.melee * 0.55; P.cool = Math.max(P.cool, P.melee); Gun.play(V, M.clips.vm_melee ? 'vm_melee' : 'vm_fire', 0.05); Snd.noise(0.18, 1200, 300, 0.16, 200); }
    // a rotary gun has to spin up before it fires
    if (W.spin) P.spin = clamp((P.spin || 0) + (fire && S.ammo > 0 && P.reload <= 0 ? dt : -dt * 1.5) / W.spin, 0, 1);
    const can = P.cool <= 0 && P.reload <= 0 && P.melee <= 0 && !P.dead && !P.running && (W.melee || S.ammo > 0) && (!W.spin || P.spin >= 1);
    const want = W.auto ? fire : (P.tapT > 0 || P.burstQ > 0);
    if (can && want) {
        P.tapT = 0;
        if (W.melee) { const clip = Math.random() < 0.5 && M.clips.vm_fire2 ? 'vm_fire2' : 'vm_fire'; Gun.play(V, clip, 0.04); P.melee = M.len(clip) || 0.35; P.meleeAt = P.melee * 0.5; P.cool = P.melee; Snd.noise(0.2, 6000, 900, 0.14, 1200); }
        else { Gun.fire(P, G); if (W.burst) { if (P.burstQ > 0) { if (--P.burstQ === 0 || S.ammo <= 0) { P.burstQ = 0; P.cool = W.burstGap; } } else P.burstQ = S.ammo > 0 ? W.burst - 1 : 0; } }
    } else if (want && !W.melee && S.ammo <= 0 && S.reserve <= 0 && tap) Snd.tone(900, 0.05, 0.03, 'square', 700);      // empty: a dry click
    // which clip the arms play: a one-shot clip (fire, reload, draw, melee) runs to its end, then idle or the sprint carry
    const c = M.clips[V.cur]; V.t += dt * (V.cur === 'vm_reload' ? P.reloadRate || 1 : 1); V.fade = Math.max(0, V.fade - dt);
    if (V.cur === 'vm_fire' && W.auto && W.rpm && fire && S.ammo > 0 && !P.dead) V.t = W.spin || W.flame ? V.t % (c.count / c.fps) : Math.min(V.t, 2 / c.fps);          // sustained fire: the finger stays on the trigger (a rotary gun: the barrels keep turning)
    const busy = c && !c.loop && V.t < c.count / c.fps, wantClip = P.running && !P.dead ? 'vm_run' : 'vm_idle';
    if (!busy && V.cur !== wantClip) Gun.play(V, wantClip, V.cur === 'vm_fire' ? 0.1 : 0.2);
    // aiming: the sight comes to the eye
    const aim = Input.aim() && !W.noAds && P.reload <= 0 && !P.running && P.melee <= 0 && !P.dead && !App.demo;
    P.ads = lerp(P.ads, aim ? 1 : 0, Math.min(1, dt * 13)); if (P.ads < 0.002) P.ads = 0;
};
Gun.fire = function (P, G) {
    const W = Gun.W, S = Gun.S, M = Gun.cur, V = P.vm, d = G.dir;
    const again = V.cur === 'vm_fire', loops = W.spin || W.flame; if (!(loops && again)) Gun.play(V, 'vm_fire', 0); if (again && W.auto && W.rpm && !loops) V.t = 1 / M.clips.vm_fire.fps;
    S.ammo--; P.cool = W.rpm ? 60 / W.rpm : (M.len('vm_fire') || 0.8); P.kick = 1; P.flashT = 0.05; P.shots = (P.shots || 0) + 1;
    P.eject = M.I.eject ? (M.I.ejectAt || 0.02) : -1;
    Snd.gun(W.snd); World.flash.visible = !W.rocket && !W.lob && !W.flame && !W.bolt; Gun.flashRot = Math.random() * 6.28;
    const sp = lerp(W.spread[0], W.spread[1] * (P.aimK || 1), P.ads) * (1 - 0.3 * (P.crouch || 0)) + P.bloom * lerp(1, 0.35, P.ads) + P.moving * 0.02 * (1 - P.ads);
    P.bloom = Math.min(0.035, P.bloom + (W.rpm > 500 ? 0.005 : 0.012));
    if (W.rocket) G.rocket(P, d[0], d[1], d[2], W);
    else if (W.lob) G.lob(P, d[0], d[1], d[2], W);
    else if (W.flame) G.flame(P, d[0], d[1], d[2], W);
    else for (let i = 0; i < (W.pellets || 1); i++) {
        const ex = d[0] + (Math.random() - 0.5) * sp, ey = d[1] + (Math.random() - 0.5) * sp, ez = d[2] + (Math.random() - 0.5) * sp, l = Math.hypot(ex, ey, ez);
        G.shot(P, ex / l, ey / l, ez / l, W, i);
    }
    // the kick: the view climbs and wanders, less when aimed
    if (!App.demo) { const k = W.kick * (P.steady || 1); P.pitch = Math.min(1.45, P.pitch + lerp(k, k * 0.65, P.ads)); P.yaw += (Math.random() - 0.5) * lerp(k * 0.9, k * 0.4, P.ads); }
    if (S.ammo <= W.mag * 0.25 && W.mag > 4) Snd.tone(1300, 0.04, 0.03, 'triangle', 1100);       // the magazine is running low: a lighter ring to each shot
};
Gun.casing = function (P) {
    const c = World.camera.matrixWorld.elements, I = Gun.cur.I, g = Gun.cur.node.matrixWorld.elements, e = I.eject, d = I.ejectDir || [1, 0.5, 0];
    // the port's place: in the gun's own little scene, which sits in front of the camera
    const lx = g[0] * e[0] + g[4] * e[1] + g[8] * e[2] + g[12], ly = g[1] * e[0] + g[5] * e[1] + g[9] * e[2] + g[13], lz = Math.min(-0.3, g[2] * e[0] + g[6] * e[1] + g[10] * e[2] + g[14]);
    const sp = 1.6 + Math.random() * 0.9, vx = d[0] * sp + rand(-0.3, 0.3), vy = d[1] * sp + rand(0.4, 1), vz = -d[2] * sp + rand(-0.3, 0.3);
    World.casing(c[12] + c[0] * lx + c[4] * ly + c[8] * lz, c[13] + c[1] * lx + c[5] * ly + c[9] * lz, c[14] + c[2] * lx + c[6] * ly + c[10] * lz, c[0] * vx + c[4] * vy + c[8] * vz, c[1] * vx + c[5] * vy + c[9] * vz, c[2] * vx + c[6] * vy + c[10] * vz);
};
// where the muzzle is in the world (tracers start there)
Gun.muzzleWorld = function (out) {
    const c = World.camera.matrixWorld.elements, g = Gun.cur.node.matrixWorld.elements, m = Gun.cur.I.muzzle;
    const lx = g[0] * m[0] + g[4] * m[1] + g[8] * m[2] + g[12], ly = g[1] * m[0] + g[5] * m[1] + g[9] * m[2] + g[13], lz = g[2] * m[0] + g[6] * m[1] + g[10] * m[2] + g[14];
    out[0] = c[12] + c[0] * lx + c[4] * ly + c[8] * lz; out[1] = c[13] + c[1] * lx + c[5] * ly + c[9] * lz; out[2] = c[14] + c[2] * lx + c[6] * ly + c[10] * lz; return out;
};
// draw the gun over the finished world picture. Returns the view's field of view for this frame (aiming narrows it).
Gun.render = function (P) {
    const M = Gun.cur, cam = World.camera, W = Gun.W; if (!M) return;
    const v = cam.matrixWorldInverse.elements, J = World.A.json, sd = J.sun ? J.sun.dir : [0, 1, 0];
    World.gunRig.set([v[0] * sd[0] + v[4] * sd[1] + v[8] * sd[2], v[1] * sd[0] + v[5] * sd[1] + v[9] * sd[2], v[2] * sd[0] + v[6] * sd[1] + v[10] * sd[2]], J.sun ? J.sun.color : null);
    World.gunRig.up(v[4], v[5], v[6]);
    const bob = Math.sin(P.bob * 3.4), bob2 = Math.cos(P.bob * 1.7), ad = P.ads * P.ads * (3 - 2 * P.ads), loose = 1 - ad * 0.8, S = Gun.scale, sk = P.swap > SWAP / 2 ? (SWAP - P.swap) / (SWAP / 2) : P.swap / (SWAP / 2), drop = P.swap > 0 ? clamp(sk, 0, 1) * clamp(sk, 0, 1) * (3 - 2 * clamp(sk, 0, 1)) : 0;
    const q = quatEuler(P.kick * 0.05 * (1 - ad * 0.6) - P.swayY * loose + drop * 0.8, 0.035 * (1 - ad) + P.swayX * loose, 0);
    M4.compose(GM, lerp(M.hip[0], M.ads[0], ad) + (bob2 * 0.006 + P.swayX * 0.5) * loose, lerp(M.hip[1], M.ads[1], ad) + (bob * 0.006 + P.swayY * 0.5) * loose - drop * 0.42, lerp(M.hip[2], M.ads[2], ad) + P.kick * 0.045 * (1 - ad * 0.5), q[0], q[1], q[2], q[3], S, S, S);
    const scoped = W.zoom && ad > 0.85, base = Save.data.settings.fov, f1 = lerp(base, Math.min(base, W.adsFov), ad), f2 = lerp(50, 36, ad);
    if (cam.fov !== f1) { cam.fov = f1; cam.updateProjection(); World.gunCam.fov = f2; World.gunCam.updateProjection(); }
    HUD.aim(ad, scoped, W);
    const fr = Gun.pose(P.vm, GF); M.vm.begin(); M.vm.add(0, 0, 0, 0, 1, fr[0], P.light, 0, 0, fr[1], fr[2]); M.vm.end();
    HG3D.place(M.node, GM);
    if (World.flash.visible) { const m = M.I.muzzle, e = World.flash.matrixWorld.elements, s = (0.2 + Math.random() * 0.1) * (W.pellets ? 1.6 : 1), c = Math.cos(Gun.flashRot) * s, sn = Math.sin(Gun.flashRot) * s, g = M.node.matrixWorld.elements;
        e[0] = c; e[1] = sn; e[2] = 0; e[4] = -sn; e[5] = c; e[6] = 0; e[8] = 0; e[9] = 0; e[10] = 1; e[12] = g[0] * m[0] + g[4] * m[1] + g[8] * m[2] + g[12]; e[13] = g[1] * m[0] + g[5] * m[1] + g[9] * m[2] + g[13]; e[14] = g[2] * m[0] + g[6] * m[1] + g[10] * m[2] + g[14]; }
    if (!scoped) { R.clearDepth(); draw(World.gunScene, World.gunCam, false); }
};
