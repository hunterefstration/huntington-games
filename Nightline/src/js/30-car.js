// ============================================================
// A car: how it drives and how it is drawn.
// DRIVING is the "bicycle" a real car boils down to: one front tyre that steers, one rear tyre that drives, each pushing
// sideways against the way it is slipping. A tyre grips harder the more it slips, up to a peak at about nine degrees, then
// lets go a little: that curve (tyre()) is where the slides, the catches and the feel come from. The rear tyre shares its
// grip between driving and cornering, so power on the way out of a bend steps the back out, and the handbrake lets it go.
// Speeds are metres a second (x 3.6 = km/h); u = forward, v = sideways to the LEFT, w = turning left (radians a second).
// The car lives on the circuit: (tu, td) is where it is (14-track.js), the barriers are at Track.half.
// ============================================================
// Twenty cars in five classes of four. A class opens with a result (CLASSES[i].need); the cars of a class differ in character,
// not in rank. What a model measures (length, width, wheelbase, where its lamps are) comes from the model itself: FLEET,
// 27-fleetdata.js, written by tools/blender/make_nl_cars.py.
const CLASSES = [
    { id: 'STREET', need: null, test: () => true },
    { id: 'MUSCLE', need: 'Finish a race in the top three', test: (place, level) => place <= 3 },
    { id: 'SPORT', need: 'Win a race', test: (place, level) => place === 1 },
    { id: 'GT', need: 'Win a race against PRO drivers', test: (place, level) => place === 1 && level >= 1 },
    { id: 'SUPER', need: 'Win a race against ELITE drivers', test: (place, level) => place === 1 && level >= 2 }
];
const CARS = {};
[   // id, class, top speed (m/s), power (shown), pull (m/s2), grip, brakes, how much of the grip the rear has, what it is like
    ['kite', 0, 55, 150, 6.4, 12.6, 13.0, 1.0, 'A light hatchback. Forgiving and eager: the car to learn a circuit in.'],
    ['pixel', 0, 50, 110, 5.6, 13.4, 13.6, 1.03, 'Tiny and square. Slow on the straights, glued to the road in the bends.'],
    ['moth', 0, 57, 165, 6.6, 12.3, 12.8, 0.98, 'A small coupe with round eyes. Quick enough, and happy to slide a little.'],
    ['rascal', 0, 56, 175, 7.0, 13.2, 13.8, 1.0, 'A hatchback dressed for a rally stage. Punchy out of slow corners.'],
    ['vandal', 1, 66, 240, 8.2, 12.2, 12.5, 0.90, 'All engine. Ask for too much on the way out of a bend and the back comes round.'],
    ['brute', 1, 68, 270, 8.6, 11.9, 12.3, 0.88, 'A slab of a car. Enormous shove in a straight line, and it hates changing its mind.'],
    ['anvil', 1, 64, 230, 8.0, 12.7, 12.9, 0.93, 'The calm one of the muscle cars: less power, more car under you.'],
    ['howl', 1, 72, 300, 9.0, 12.8, 13.4, 0.94, 'Low, wide and loud. The fastest of its class, and the one that bites.'],
    ['aria', 2, 71, 245, 8.0, 14.2, 15.0, 1.02, 'Balanced and exact. What you put in is what you get back.'],
    ['sylph', 2, 67, 200, 7.6, 15.1, 15.4, 1.04, 'Almost no weight. It gives away the straights and takes back every corner.'],
    ['riptide', 2, 74, 280, 8.6, 14.4, 15.2, 0.99, 'A track car with number plates. The big wing is not for show.'],
    ['onyx', 2, 73, 265, 8.3, 14.0, 15.6, 1.01, 'A glass roof and bronze wheels. Late on the brakes, steady everywhere else.'],
    ['regent', 3, 76, 300, 8.4, 13.4, 14.6, 0.98, 'A long grand tourer. Heavy and unbothered: it eats a fast circuit.'],
    ['nocturne', 3, 79, 330, 8.9, 13.8, 15.0, 0.97, 'A fastback built for the dark. Quick everywhere without ever seeming to try.'],
    ['solace', 3, 75, 290, 8.5, 14.1, 14.8, 1.0, 'The engine sits far back under a long bonnet. It turns in like a smaller car.'],
    ['harbinger', 3, 81, 360, 9.2, 13.6, 15.2, 0.93, 'The biggest engine in the garage in the biggest car. Mind the exits.'],
    ['halo', 4, 84, 345, 9.6, 15.6, 17.0, 0.97, 'Brutal speed and the brakes to match. It punishes a late lift.'],
    ['vortex', 4, 86, 370, 9.9, 15.2, 16.6, 0.95, 'All edges. Faster than the Halo on any straight, twitchier in every bend.'],
    ['siren', 4, 83, 340, 9.4, 16.0, 17.2, 1.0, 'The gentle supercar: the most grip of anything here, and it tells you before it lets go.'],
    ['apex', 4, 90, 420, 10.4, 16.2, 17.8, 0.96, 'A racing car that somebody put lights on. Nothing is faster. Nothing is less forgiving.']
].forEach(([id, ci, top, pw, acc, grip, brake, rear, blurb]) => { const F = FLEET[id] || {}; CARS[id] = { id, name: id.toUpperCase(), cls: CLASSES[ci].id, ci, blurb, top, pw, acc, grip, brake, rear, L: F.L || 2.6, len: F.len || 4.3, wid: F.wid || 1.82, h: F.h || 1.3, need: CLASSES[ci].need }; });
const CAR_IDS = Object.keys(CARS);
// paints: the body colour and the colour of the light under the car
const PAINTS = [['EMBER', 0xff4a1c, [1, 0.35, 0.1]], ['ICE', 0x2fd0ff, [0.15, 0.8, 1]], ['ORCHID', 0xe23cff, [0.9, 0.2, 1]], ['LIME', 0x9dff2e, [0.5, 1, 0.15]], ['PEARL', 0xf2f4f8, [0.8, 0.9, 1]], ['SUN', 0xffc21a, [1, 0.75, 0.1]], ['ROSE', 0xff2e6e, [1, 0.15, 0.4]], ['MIDNIGHT', 0x2a3cff, [0.2, 0.3, 1]]];
const tyre = a => Math.sin(1.35 * Math.atan(11 * a));     // sideways push of a tyre slipping at angle a (radians): peak 1 at about 0.2, still 0.85 when sliding flat out (forgiving)

function newCar(id, paint) {
    const d = CARS[id] || CARS.kite;
    return { id, def: d, paint: paint || 0, x: 0, y: 0, z: 0, yaw: 0, u: 0, v: 0, w: 0, steer: 0, pitch: 0, roll: 0, tu: 0, td: 0, prog: 0, lap: 0, slip: 0, slipR: 0, hitT: 0, spin: 0, rpm: 0, gear: 1, ax: 0, ay: 0,
        ctl: { steer: 0, gas: 0, brake: 0, hand: false }, bot: null, me: false, done: 0, laps: [], lapT0: 0, mdl: null, o: {}, wrong: 0, stuck: 0 };
}
const Car = {};
// put a car on the circuit at (u, d), standing still, pointing along it
Car.place = function (c, u, d) {
    const o = c.o; Track.spot(u, d, o); c.x = o.x; c.y = o.y; c.z = o.z; c.yaw = Math.atan2(o.tx, o.tz); c.u = c.v = c.w = c.steer = 0; c.tu = ((u % Track.N) + Track.N) % Track.N; c.td = d; c.slip = c.slipR = 0;
};
Car.step = function (c, dt) {
    const d = c.def, k = c.ctl, a = d.L / 2, sp = Math.abs(c.u), us = Math.max(sp, 3), grip = d.grip * (c.gripK || 1), fwd = c.u >= 0 ? 1 : -1;
    // the wheel: quick at a crawl, calmer the faster the car goes (never much more lock than the tyres can use)
    const dmax = Math.min(0.56, 1.7 * grip * d.L / Math.max(sp * sp, 1) + 0.03), want = clamp(k.steer, -1, 1) * dmax, rate = (Math.abs(want) < Math.abs(c.steer) ? 5.5 : 3.2) * dt;
    c.steer += clamp(want - c.steer, -rate, rate);
    // what the driver asks of the engine and the brakes
    let ax = 0, drive = 0; const gas = clamp(k.gas, 0, 1), brk = clamp(k.brake, 0, 1);
    if (gas > 0 && c.u > -1) drive = gas * Math.min(d.acc, d.pw / Math.max(sp, 5)) * (c.powK || 1);
    if (brk > 0) { if (c.u > 1.2) ax -= brk * d.brake; else if (gas === 0) drive = -brk * (c.u > -9 ? 4.5 : 0); else ax -= brk * d.brake * fwd * Math.min(1, sp); }
    if (gas === 0 && brk === 0) ax -= fwd * Math.min(sp * 2, 1.3);                     // lifting off: the engine holds the car back
    ax += drive - (d.pw / (d.top * d.top * d.top)) * c.u * sp - fwd * Math.min(sp * 3, 0.25);
    // the two tyres. The front one is turned by `steer` (and a little into a slide, which is what catching one is).
    const sr = Math.atan2(c.v - a * c.w, us), st = c.steer + clamp(sr * 0.6, -0.2, 0.2) * (sp > 6 ? 1 : 0), cs = Math.cos(st), sn = Math.sin(st);
    const sf = Math.atan2((c.v + a * c.w) * cs - c.u * sn, us);
    const share = Math.sqrt(Math.max(0.2, 1 - Math.pow(Math.min(1, Math.abs(drive) / (grip * 1.25)), 2)));     // grip the rear has left over while it drives
    const Ff = -grip * 0.5 * tyre(sf), Fr = -grip * 0.5 * d.rear * share * (k.hand ? 0.36 : 1) * tyre(sr);
    if (k.hand && sp > 0.5) ax -= fwd * 4.5;
    if (c.scrape > 0) { c.scrape -= dt; ax -= fwd * Math.min(sp * 2, 7); }      // along a barrier: it costs speed for as long as the car leans on it
    // a slide is damped a little (the hands a good driver has): it can be held and caught, it does not snap round
    const ay = Ff * cs + Fr, wAcc = (a * Ff * cs - a * Fr) / (a * a * 1.05) - c.w * 1.6 * clamp((Math.abs(sr) - 0.14) / 0.3, 0, 1) * (k.hand ? 0.3 : 1);
    c.u += (ax - Ff * sn + c.w * c.v) * dt; c.v += (ay - c.w * c.u) * dt; c.w += wAcc * dt;
    if (sp < 3) { const q = 1 - sp / 3; c.w = lerp(c.w, c.u * Math.tan(c.steer) / d.L, q); c.v *= 1 - Math.min(1, dt * 12) * q; }
    if (sp < 0.15 && gas === 0 && brk === 0) c.u *= 1 - Math.min(1, dt * 6);
    c.ax = ax; c.ay = ay; c.slip = Math.max(Math.abs(sf), Math.abs(sr)); c.slipR = sr;
    // move
    const sy = Math.sin(c.yaw), cy = Math.cos(c.yaw); c.x += (sy * c.u + cy * c.v) * dt; c.z += (cy * c.u - sy * c.v) * dt; c.yaw += c.w * dt;
    Car.onTrack(c);
    // the engine note: five gears, each taking the revs from low to the top of its share of the speed
    const g = clamp(Math.floor(sp / d.top * 5.4), 0, 4), lo = g * d.top / 5.4, hi = (g + 1) * d.top / 5.4; c.gear = c.u < -0.5 ? 0 : g + 1; c.rpm = lerp(c.rpm, clamp(0.22 + 0.78 * (sp - lo * 0.78) / (hi - lo * 0.78), 0.12, 1) + (c.slip > 0.3 && gas > 0.5 ? 0.1 : 0), Math.min(1, dt * 10));
    c.spin += c.u * dt / (c.mdl && c.mdl.R || 0.33);
};
// where it is on the circuit; the barriers; the height and lean of the road under it
Car.onTrack = function (c) {
    const o = c.o, d = c.def, N = Track.N, u0 = c.tu; Track.locate(c.x, c.z, c.tu, o); let u = o.u, dd = o.d; const lim = Track.half - d.wid / 2 - 0.08;
    Track.at(u, o);
    if (Math.abs(dd) > lim) {
        const s = dd > 0 ? 1 : -1, nx = o.tz * s, nz = -o.tx * s, over = Math.abs(dd) - lim; c.x -= nx * over; c.z -= nz * over; dd = s * lim; c.scrape = 0.12;
        const sy = Math.sin(c.yaw), cy = Math.cos(c.yaw); let vx = sy * c.u + cy * c.v, vz = cy * c.u - sy * c.v; const vn = vx * nx + vz * nz;
        if (vn > 0) {
            vx -= nx * vn * 1.18; vz -= nz * vn * 1.18; const loss = 1 - Math.min(0.22, vn * 0.012); vx *= loss; vz *= loss;
            c.u = sy * vx + cy * vz; c.v = cy * vx - sy * vz;
            // the nose is turned along the barrier, so a car glances off instead of grinding into it
            const along = Math.atan2(o.tx, o.tz), tgt = Math.abs(angDiff(along, c.yaw)) < Math.PI / 2 ? along : along + Math.PI; c.yaw += angDiff(tgt, c.yaw) * Math.min(0.7, 0.15 + vn * 0.06); c.w *= 0.4; c.v *= 0.5;
            if (vn > 1.2 || Math.abs(c.u) > 12) { c.hit = Math.max(c.hit || 0, vn); c.hitSide = s; }
        }
    }
    c.prog += Track.ahead(u0, u); c.tu = u; c.td = dd;
    // height, and the road's slope along and across the car
    const i = Math.floor(u), grade = (Track.S[(i + 1) % N][1] - Track.S[i][1]) / Track.step, fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), al = fx * o.tx + fz * o.tz, ac = fx * o.tz - fz * o.tx;      // along the track, and to its left
    c.y = o.y - dd * o.bank; c.gradeP = al * grade - ac * o.bank; c.gradeR = al * o.bank + ac * grade;
};
Car.frame = function (c, dt) {
    // how the body sits: on the road's slope, leaning out of the bend, nose down under the brakes
    const k = Math.min(1, dt * 9); c.pitch = lerp(c.pitch, Math.atan(c.gradeP || 0) - clamp(c.ax, -16, 10) * 0.0035, k); c.roll = lerp(c.roll, Math.atan(c.gradeR || 0) - clamp(c.ay, -16, 16) * 0.0052, k);
    if (c.mdl) c.mdl.set(c, dt);
};

// ---- how it looks ----
// A car is `assets/car_<id>.hgm` when that file is there (tools/blender/make_nl_cars.py; what the game expects in it is listed at carModel below), and a
// plain block car until then. Either way the game asks the same four things of a model: set(car), lamps, tint, remove.
const Cars = { A: {}, tried: {} };
Cars.load = async function (ids) {
    await Packs.ready;
    await Promise.all(ids.filter(id => !Cars.tried[id]).map(async id => { Cars.tried[id] = 1; if (Q.get('blocks') === '1') return; try { const A = await HG3D.load(AST('car_' + id + '.hgm'), { anisotropy: 4 }); if (A.objects.body) Cars.A[id] = A; } catch (e) { } }));
};
const HEXC = h => HG3D.color(h);
// HG3D's own hook for things lit from a file's baked light (engine/src/85-assets.js, probeHook: not exported, so its two lines are repeated here)
const PROBE_MAIN = ['#if !defined(UNLIT) && !defined(VFINAL)', ' vLa *= HG_L.rgb; vLs *= HG_L.a;', '#ifdef SPEC_VERTEX', ' vSp *= HG_L.a;', '#endif', '#endif'].join(String.fromCharCode(10));
// A model's paint, glass and trim: lit where the car stands (uProbe, as before), and on top of that the CITY IN THE PAINT: the glow of the
// horizon and bands of light that slide over the body as the car moves (uShine: x = how far it has gone, y = how glossy this material is).
// Worked out at the corners of the model's triangles, which a car has plenty of.
const CAR_MAIN = PROBE_MAIN + String.fromCharCode(10) + ['#if !defined(UNLIT) && !defined(VFINAL)',
    ' vLa *= 0.42 + 0.78 * max(N.y, 0.0) + 0.2 * (1.0 - abs(N.y));',      // the light of a night street comes from above and from the sides: what faces down is dark, so the body has a shape
    ' { vec3 nlV = normalize(uCamPos.xyz - wp); vec3 nlR = reflect(-nlV, N); float nlF = pow(1.0 - max(dot(N, nlV), 0.0), 3.0);',
    '   float nlH = exp(-nlR.y * nlR.y * 16.0) * smoothstep(-0.3, 0.02, nlR.y);',
    '   float nlB = pow(max(0.0, sin(atan(nlR.z, nlR.x) * 4.0 + nlR.y * 2.5 + uShine.x)), 7.0) * smoothstep(0.03, 0.3, nlR.y) * (1.0 - smoothstep(0.55, 0.98, nlR.y));',
    '   vEm += (uProbe.rgb * (nlH * 0.9 + nlB * 1.5) + vec3(0.02, 0.035, 0.07) * max(nlR.y, 0.0)) * (0.22 + 0.78 * nlF) * uShine.y; }', '#endif'].join(String.fromCharCode(10));
function carModel(c, scene) {
    const d = c.def, P = PAINTS[c.paint % PAINTS.length], A = Cars.A[c.id], root = HG3D.node(), M = { root, wheels: [], probe: [], shine: [], lampT: null, lampH: null, e: new Float32Array(16), w: new Float32Array(16) };
    const halfL = d.len / 2, halfW = d.wid / 2, wr = 0.33, wx = halfW - 0.14, wz = d.L / 2;
    M.tail = [[wx - 0.18, 0.72, -halfL + 0.03], [-(wx - 0.18), 0.72, -halfL + 0.03]]; M.head = [[wx - 0.2, 0.62, halfL - 0.05], [-(wx - 0.2), 0.62, halfL - 0.05]];
    if (A) {
        const body = A.copy('body'); M.body = body; root.add(body); M.copy = body;
        // the file's three lit materials (paint, glass, detail = a palette picture) are swapped for the game's own, which carry the city in the paint
        const made = {}, shiny = (src, o, k) => { const v = new Float32Array([1, 1, 1, 1]), sh = new Float32Array([0, k, 0, 0]); if (src.map) o.map = src.map;
            o.hg = { key: 'nl-car', vDecl: 'uniform vec4 uProbe;' + String.fromCharCode(10) + '#define HG_L uProbe' + String.fromCharCode(10) + 'uniform vec4 uShine;', fFinal: String.fromCharCode(10), vMain: CAR_MAIN, uniforms: { uProbe: { value: v }, uShine: { value: sh } } };
            const m = HG3D.material(o); M.probe.push(v); M.shine.push(sh); return m; };
        const swap = n => { for (const ch of n.children) { if (!ch.isMesh) { swap(ch); continue; } const src = ch.material, nm = src.name || ''; if (!src.probe) continue;
            ch.material = made[nm] || (made[nm] = /paint/.test(nm) ? shiny(src, { color: P[1], roughness: 0.26, metalness: 0.45 }, 1.0) : /glass/.test(nm) ? shiny(src, { color: 0x05080c, roughness: 0.05, metalness: 0.9 }, 1.6) : shiny(src, { color: 0xffffff, roughness: 0.4, metalness: 0.3 }, 0.2)); } };
        swap(body);
        for (const n of ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']) { const wn = body.find(n); if (wn) M.wheels.push({ n: wn, rest: new Float32Array(wn.rest || wn.local), front: n[6] === 'f' }); }
        const lamp = (name, col) => { const n = body.find(name); if (!n) return null; const mat = HG3D.material({ lit: false, color: 0xffffff }); mat.color = { r: col[0], g: col[1], b: col[2] }; const walk = x => { if (x.isMesh) x.material = mat; for (const ch of x.children) walk(ch); }; walk(n); return mat; };
        M.lampT = lamp('lamp_tail', [2.4, 0.1, 0.08]); M.lampH = lamp('lamp_head', [3.2, 3.0, 2.6]);
        const I = FLEET[c.id] || {}; if (I.tail && I.tail.length) M.tail = I.tail; if (I.head && I.head.length) M.head = I.head; M.R = I.R || 0.33;
    } else {
        // the shape made in 28-carshape.js. Its paint, glass and trim are lit where the car stands (the same hook a model file's materials get)
        const G = carGeo(CARS[c.id] ? c.id : 'kite'), lit = (o) => { const v = new Float32Array([1, 1, 1, 1]); o.hg = { key: 'hg-probe', vDecl: 'uniform vec4 uProbe;' + String.fromCharCode(10) + '#define HG_L uProbe', fFinal: String.fromCharCode(10), vMain: PROBE_MAIN, uniforms: { uProbe: { value: v } } }; const m = HG3D.material(o); M.probe.push(v); return m; };
        const paint = lit({ color: P[1], roughness: 0.3, metalness: 0.35 }), glass = lit({ color: 0x0b1018, roughness: 0.06, metalness: 0.85 }), dark = lit({ color: 0x0d0e12, roughness: 0.55, metalness: 0.15 }), wheel = lit({ color: 0xffffff, vertexColors: true, roughness: 0.4, metalness: 0.3 });
        root.add(HG3D.mesh(G.paint, paint), HG3D.mesh(G.glass, glass), HG3D.mesh(G.dark, dark));
        M.lampT = HG3D.material({ lit: false, color: 0xffffff }); M.lampT.color = { r: 2.4, g: 0.1, b: 0.08 }; M.lampH = HG3D.material({ lit: false, color: 0xffffff }); M.lampH.color = { r: 3.4, g: 3.2, b: 2.8 };
        root.add(HG3D.mesh(G.tailGeo, M.lampT), HG3D.mesh(G.headGeo, M.lampH)); M.tail = G.tail; M.head = G.head;
        for (const [sx, sz, front] of [[1, 1, 1], [-1, 1, 1], [1, -1, 0], [-1, -1, 0]]) { const wn = HG3D.node(), rest = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, sx * G.wheelX, G.R, sz * G.wheelZ, 1]); wn.local = new Float32Array(rest); wn.add(HG3D.mesh(G.wheel, wheel)); root.add(wn); M.wheels.push({ n: wn, rest, front: !!front }); }
        M.R = G.R;
    }
    scene.add(root);
    const PR = new Float32Array(4);
    M.set = (car, dt) => {
        poseMatrix(M.e, car.x, car.y, car.z, car.yaw, car.pitch, car.roll);
        // wheels: spun by the road, the front pair turned by the wheel
        for (const w of M.wheels) { const r = w.rest, l = w.n.local, cs = Math.cos(car.spin), sn = Math.sin(car.spin), st = w.front ? car.steer : 0, cy = Math.cos(st), sy = Math.sin(st);
            // local = rest * turn(steer about up) * spin(about the axle, which is the model's x)
            const m = M.w; m[0] = cy; m[1] = 0; m[2] = -sy; m[3] = 0; m[4] = sy * sn; m[5] = cs; m[6] = cy * sn; m[7] = 0; m[8] = sy * cs; m[9] = -sn; m[10] = cy * cs; m[11] = 0; m[12] = 0; m[13] = 0; m[14] = 0; m[15] = 1; M4.mul(l, r, m); }
        HG3D.place(root, M.e);
        for (const sh of M.shine) sh[0] = car.tu * Track.step * 0.45;
        if (M.probe.length) { World.lightAt(car.tu, PR); for (const p of M.probe) { p[0] = PR[0]; p[1] = PR[1]; p[2] = PR[2]; p[3] = 1; } }      // the light all round it is the city's; the light from above is always there
        const b = car.ctl.brake > 0.05 && car.u > 0.5 ? 1 : 0; car.brakeL = lerp(car.brakeL || 0, b, Math.min(1, dt * 18)); if (M.lampT) { const v = 0.8 + car.brakeL * 1.5; M.lampT.color.r = v; M.lampT.color.g = 0.02 + car.brakeL * 0.1; M.lampT.color.b = 0.03; }
    };
    M.remove = () => { scene.remove(root); R.release(root); };
    M.glow = P[2];
    return M;
}
