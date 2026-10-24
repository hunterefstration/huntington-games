// ---------- 4.0 MAP KIT (used by the Mall and the Military Base) ----------
// A piece built in its own frame (lx, lz), turned in 90 degree steps like addStructure. B = block, S = invisible solid, P = world spot.
function rotKit(cx, cz, rot) {
    const T = (lx, lz, w, d) => { let x = lx, z = lz, ww = w, dd = d; for (let i = 0; i < rot; i++) { [x, z] = [-z, x]; [ww, dd] = [dd, ww]; } return [cx + x, cz + z, ww, dd]; };
    return {
        B: (lx, lz, w, h, d, y0 = 0, key = 'concrete', solid = true) => { const [x, z, ww, dd] = T(lx, lz, w, d); addBlock(x, y0, z, ww, h, dd, key, solid); },
        S: (lx, lz, w, h, d, y0 = 0, thru = false) => { const [x, z, ww, dd] = T(lx, lz, w, d); addSolid(x, y0, z, ww, h, dd, thru); },
        P: (lx, lz) => { const [x, z] = T(lx, lz, 0, 0); return [x, z]; }
    };
}
// split a straight (axis-aligned) line into the runs between its gaps ([middle, half width] along the line): fn(cx, cz, length, alongX)
function eachRun(x1, z1, x2, z2, gaps, fn) {
    const alongX = Math.abs(z2 - z1) < 0.01, a0 = alongX ? Math.min(x1, x2) : Math.min(z1, z2), a1 = alongX ? Math.max(x1, x2) : Math.max(z1, z2);
    const cuts = gaps.map(([m, hw]) => [m - hw, m + hw]).sort((p, q) => p[0] - q[0]);
    const out = (b0, b1) => { if (b1 - b0 < 0.3) return; const m = (b0 + b1) / 2; fn(alongX ? m : x1, alongX ? z1 : m, b1 - b0, alongX); };
    let s = a0;
    for (const [g0, g1] of cuts) { if (g0 > s) out(s, Math.min(g0, a1)); s = Math.max(s, g1); }
    if (s < a1) out(s, a1);
}
// A railing on a floor at height y: glass panels (mall) or two steel bars (catwalks). Bullets and line of sight go
// through it; you and the zombies don't.
function railLine(x1, z1, x2, z2, y, gaps = [], style = 'glass') {
    eachRun(x1, z1, x2, z2, gaps, (cx, cz, len, alongX) => {
        const box = (y0, h, th, key) => addBlock(cx, y0, cz, alongX ? len : th, h, alongX ? th : len, key, false);
        if (style === 'glass') { box(y + 0.06, 0.94, 0.05, 'glass'); box(y, 0.07, 0.12, 'steel'); box(y + 1.0, 0.08, 0.1, 'rubber'); }
        else { box(y + 1.0, 0.08, 0.08, 'accY'); box(y + 0.5, 0.06, 0.06, 'steel'); }
        addSolid(cx, y, cz, alongX ? len : 0.16, 1.1, alongX ? 0.16 : len, true);
        const n = Math.max(1, Math.round(len / 2.4));
        for (let i = 0; i <= n; i++) { const t = -len / 2 + i * len / n; addBlock(alongX ? cx + t : cx, y, alongX ? cz : cz + t, 0.08, 1.04, 0.08, 'steel', false); }
    });
}
// Chain-link fence (h tall, barbed wire on top). You can jump it; zombies have to walk round to a gap.
function fenceLine(x1, z1, x2, z2, gaps = [], h = 3) {
    eachRun(x1, z1, x2, z2, gaps, (cx, cz, len, alongX) => {
        const box = (y0, hh, th, key) => addBlock(cx, y0, cz, alongX ? len : th, hh, alongX ? th : len, key, false);
        box(0.06, h - 0.12, 0.04, 'fence'); box(h - 0.1, 0.09, 0.09, 'steel'); box(0.05, 0.07, 0.07, 'steel');
        box(h + 0.25, 0.035, 0.035, 'post'); box(h + 0.5, 0.035, 0.035, 'post');
        addSolid(cx, 0, cz, alongX ? len : 0.22, h, alongX ? 0.22 : len, true);
        const n = Math.max(1, Math.round(len / 3));
        for (let i = 0; i <= n; i++) {
            const t = -len / 2 + i * len / n, e = i === 0 || i === n, th = e ? 0.22 : 0.11;
            addBlock(alongX ? cx + t : cx, 0, alongX ? cz : cz + t, th, h + 0.6, th, e ? 'steel' : 'post', false);
        }
    });
}
// A straight flight of stairs (+0.5 a step) from (x0, z0) at y0 up to (x1, z1) at y1, w wide. Solid underneath.
function stairRun(x0, z0, x1, z1, y0, y1, w, keys = ['concrete', 'concreteDark']) {
    const alongX = Math.abs(z1 - z0) < 0.01, n = Math.max(1, Math.round((y1 - y0) / 0.5)), len = alongX ? x1 - x0 : z1 - z0, run = Math.abs(len) / n;
    for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, h = (y1 - y0) * (i + 1) / n;
        addBlock(alongX ? x0 + len * t : x0, y0, alongX ? z0 : z0 + len * t, alongX ? run : w, h, alongX ? w : run, keys[i % keys.length]);
    }
}
// Rails up the sides of a stairRun (sides: -1 / 1 = left / right of the line). Stepped glass or steel, one solid wall for collision.
function stairSides(x0, z0, x1, z1, y0, y1, w, sides = [-1, 1], style = 'glass') {
    const alongX = Math.abs(z1 - z0) < 0.01, n = Math.max(1, Math.round((y1 - y0) / 0.5)), len = alongX ? x1 - x0 : z1 - z0, run = Math.abs(len) / n;
    for (const sd of sides) {
        const off = sd * (w / 2 + 0.08);
        addSolid(alongX ? (x0 + x1) / 2 : x0 + off, y0, alongX ? z0 + off : (z0 + z1) / 2, alongX ? Math.abs(len) : 0.14, y1 - y0 + 1.1, alongX ? 0.14 : Math.abs(len), true);
        for (let i = 0; i < n; i++) {
            const t = (i + 0.5) / n, h = (y1 - y0) * (i + 1) / n, x = alongX ? x0 + len * t : x0 + off, z = alongX ? z0 + off : z0 + len * t;
            const b = (y, hh, th, key) => addBlock(x, y0 + y, z, alongX ? run + 0.02 : th, hh, alongX ? th : run + 0.02, key, false);
            if (style === 'glass') { b(h, 0.95, 0.05, 'glass'); b(h + 0.95, 0.1, 0.1, 'rubber'); }
            else { b(h + 1.0, 0.08, 0.08, 'accY'); if (i % 2 === 0) b(h, 1.0, 0.08, 'steel'); }
        }
    }
}
// Two escalators side by side (one up, one down) running along x from the bottom at xb (floor y0) to the top at xt (y1).
// The lanes sit next to each other from z0 going toward +z (dz = 1) or -z. A landing at the top joins the floor above.
// Standing on a lane carries you along it (see updatePlayer); the step texture scrolls the same way.
function escalatorPair(xb, xt, z0, dz, y0, y1, lane = 2.6) {
    const dir = Math.sign(xt - xb), n = Math.round((y1 - y0) / 0.5), len = xt - xb, run = Math.abs(len) / n;
    for (let k = 0; k < 2; k++) {
        const zc = z0 + dz * (k * (lane + 0.3) + lane / 2), up = k === 0;
        const vx = (up ? 1 : -1) * dir * ESC_SPEED, key = vx > 0 ? 'escF' : 'escB';
        for (let i = 0; i < n; i++) addBlock(xb + len * (i + 0.5) / n, y0, zc, run, (y1 - y0) * (i + 1) / n, lane, key);
        addBlock(xb - dir * 0.6, y0, zc, 1.2, 0.03, lane, 'glowY', false);                      // comb plates
        addBlock(xt + dir * 0.5, y1, zc, 1.0, 0.03, lane, 'glowY', false);
        addBlock(xb - dir * 0.15, y0 + 1.2, zc + dz * (lane / 2 + 0.1), 0.3, 0.3, 0.12, up ? 'glowL' : 'glowR', false);   // up / down lamp
        escalators.push({ x0: Math.min(xb, xt), x1: Math.max(xb, xt), z0: zc - lane / 2, z1: zc + lane / 2, y0, y1, vx, vz: 0 });
        stairSides(xb, zc, xt, zc, y0, y1, lane);
    }
    // landing at the top (solid down to the floor) with a rail round its open sides
    const zA = z0 - dz * 0.2, zB = z0 + dz * (2 * lane + 0.5), lx = xt + dir * 1.5;
    addBlock(lx, y0, (zA + zB) / 2, 3, y1 - y0, Math.abs(zB - zA), 'tile');
    railLine(xt, zB, xt + dir * 3, zB, y1);
    railLine(xt + dir * 3, zA, xt + dir * 3, zB, y1);
}
// big block letters on a wall (a 5x5 pixel font). Runs along `axis` ('x' or 'z') in direction dir from (x, z); y = bottom.
const PIX_FONT = { M: ['10001', '11011', '10101', '10001', '10001'], E: ['11111', '10000', '11110', '10000', '11111'], G: ['01111', '10000', '10011', '10001', '01111'],
                   A: ['01110', '10001', '11111', '10001', '10001'], L: ['10000', '10000', '10000', '10000', '11111'], H: ['10001', '10001', '11111', '10001', '10001'],
                   Q: ['01110', '10001', '10101', '10010', '01101'], B: ['11110', '10001', '11110', '10001', '11110'], S: ['01111', '10000', '01110', '00001', '11110'], '7': ['11111', '00001', '00010', '00100', '00100'] };
function pixelText(str, x, y, z, px, axis, dir, key, depth = 0.12) {
    let off = 0;
    for (const ch of str) {
        const g = PIX_FONT[ch];
        if (g) for (let r = 0; r < 5; r++) {
            const row = g[r];
            for (let c = 0; c < 5;) {
                if (row[c] !== '1') { c++; continue; }
                let e = c; while (e < 5 && row[e] === '1') e++;
                const a = off + (c + e) / 2 * px, len = (e - c) * px, yy = y + (4 - r) * px;
                if (axis === 'x') addBlock(x + dir * a, yy, z, len, px, depth, key, false); else addBlock(x, yy, z + dir * a, depth, px, len, key, false);
                c = e;
            }
        }
        off += 6 * px;
    }
}
// a parked car (one solid block, the rest is decoration). alongX: pointing along x.
function parkedCar(x, z, alongX, front = 1) {
    const { B } = rotKit(x, z, alongX ? (front > 0 ? 0 : 2) : (front > 0 ? 1 : 3));
    const acc = ['accR', 'accB', 'accG', 'accY', 'steel', 'plaster', 'post'][Math.floor(Math.random() * 7)];
    B(0, 0, 4, 1.15, 1.9, 0.12, acc);                                      // body (solid)
    B(-0.25, 0, 2.2, 0.72, 1.7, 1.27, acc, false);                        // cabin
    B(-0.25, 0, 2.26, 0.5, 1.6, 1.33, 'post', false);                     // windows
    B(2.0, 0, 0.06, 0.2, 1.4, 0.75, 'glowW', false); B(-2.0, 0, 0.06, 0.18, 1.5, 0.8, 'glowR', false);
    for (const [ox, oz] of [[1.25, 0.96], [-1.25, 0.96], [1.25, -0.96], [-1.25, -0.96]]) B(ox, oz, 0.7, 0.62, 0.22, 0, 'rubber', false);
}
const planter = (x, z, w = 2.6, d = 2.6) => { addBlock(x, 0, z, w, 0.8, d, 'stone'); addBlock(x, 0.8, z, w - 0.5, 0.75, d - 0.5, 'leaf', false); addBlock(x, 1.55, z, w - 1.3, 0.45, d - 1.3, 'leafDark', false); };
const bench = (x, z, alongX, y0 = 0) => { addBlock(x, y0, z, alongX ? 2.4 : 0.8, 0.5, alongX ? 0.8 : 2.4, 'wood'); addBlock(x, y0 + 0.5, z, alongX ? 2.4 : 0.1, 0.06, alongX ? 0.1 : 2.4, 'post', false); };


// ---------- 4.0 MALL ----------
// A two-floor mall built round an open-air concourse (so the sky still lights the middle): a food court under a glass
// skylight, a balcony ring on the 2nd floor joined by two sky bridges, escalators and grand stairs up, a row of stores on
// both floors along each side and a department store at each end. Parking lots all round; stairs up the outside of
// both department stores lead to the roof. Ground floor 0-4.5, 2nd floor 5-9.5, roof at 10.
const MALL_FH = 5, MALL_X = 54, MALL_Z = 30, MALL_ROW = 41, MALL_CX = 36, MALL_CZ = 13, MALL_FRONT = 18;
const STORE_KINDS = ['fashion', 'tech', 'toys', 'books', 'arcade', 'sports', 'shoes', 'cafe', 'jewelry'];
const STORE_SIGN = { fashion: 'glowP', tech: 'glowC', toys: 'glowY', books: 'glowW', arcade: 'glowB', sports: 'glowR', shoes: 'glowL', cafe: 'glowY', jewelry: 'glowW', closed: 'glowR' };
// the inside of one store: u across it (0..w), d in from the front (0..11.6)
function mallStore(kind, xa, w, s, y0) {
    const I = (u, d, ww, h, dd, y = 0, key = 'plaster', solid = true) => addBlock(xa + u, y0 + y, s * (MALL_FRONT + 0.4 + d), ww, h, dd, key, solid);
    const acc = ['accR', 'accB', 'accG', 'accY'], A = (i) => acc[i % 4];
    const counter = (u, key = 'wood') => { I(u, 10, 3, 1.1, 1.0, 0, key); I(u + 0.8, 10, 0.45, 0.32, 0.35, 1.1, 'glowL', false); };
    switch (kind) {
        case 'fashion':
            for (const u of [w * 0.3, w * 0.7]) {                  // clothes racks
                I(u, 5, 0.45, 1.5, 3.4, 0, 'steel');
                for (let j = 0; j < 4; j++) I(u, 3.7 + j * 0.85, 0.7, 0.95, 0.55, 0.45, A(j + Math.round(u)), false);
            }
            for (const u of [1.3, w - 1.3]) {                      // mannequins in the window
                I(u, 1.2, 0.5, 1.7, 0.4, 0, 'plaster'); I(u, 1.2, 0.36, 0.36, 0.36, 1.7, 'plaster', false); I(u, 1.2, 0.58, 0.75, 0.48, 0.85, A(Math.round(u)), false);
            }
            counter(w / 2); break;
        case 'tech':
            for (const [u, d, ww, dd] of [[w * 0.28, 4, 1.6, 2.6], [w * 0.72, 4, 1.6, 2.6], [w / 2, 7.6, 3.8, 1.4]]) {
                I(u, d, ww, 0.9, dd, 0, 'plaster');
                I(u, d, ww * 0.55, 0.04, dd * 0.6, 0.9, 'glowC', false);
            }
            for (let j = 0; j < 4; j++) for (const y of [1.3, 2.6]) I(1.3 + j * (w - 2.6) / 3, 11.48, 1.7, 0.95, 0.06, y, (j + (y > 2 ? 1 : 0)) % 2 ? 'glowB' : 'glowC', false);
            counter(w * 0.75, 'post'); break;
        case 'toys':
            for (const u of [0.8, w - 0.8]) { I(u, 6, 1.0, 1.8, 6, 0, 'wood'); for (let j = 0; j < 6; j++) I(u, 3.6 + j * 0.95, 0.55, 0.55, 0.55, 1.8, A(j + (u > 2 ? 1 : 0)), false); }
            I(w / 2, 7.6, 1.7, 1.5, 1.4, 0, 'woodDark');                   // a giant teddy bear
            I(w / 2, 7.6, 1.15, 1.05, 1.0, 1.5, 'woodDark', false); I(w / 2, 7.0, 0.5, 0.35, 0.25, 1.75, 'sand', false);
            for (const o of [-0.45, 0.45]) I(w / 2 + o, 7.6, 0.36, 0.36, 0.3, 2.5, 'woodDark', false);
            for (const [u, d, y, k] of [[w * 0.35, 2.4, 0, 0], [w * 0.47, 2.2, 0, 1], [w * 0.41, 2.3, 0.9, 3], [w * 0.62, 2.8, 0, 2]]) I(u, d, 0.9, 0.9, 0.9, y, A(k));
            counter(w / 2); break;
        case 'books':
            for (const u of [w * 0.2, w * 0.5, w * 0.8]) {
                I(u, 6.6, 0.8, 2.4, 5, 0, 'woodDark');
                for (const o of [-0.41, 0.41]) for (let j = 0; j < 3; j++) I(u + o, 6.6, 0.04, 0.42, 4.6, 0.35 + j * 0.7, A(j + Math.round(u)), false);
            }
            I(w * 0.3, 1.8, 1.2, 0.8, 1.2, 0, 'accR'); I(w * 0.7, 1.8, 1.2, 0.8, 1.2, 0, 'accB'); counter(w / 2); break;
        case 'arcade':
            for (let j = 0; j < 4; j++) {
                const d = 1.6 + j * 2.5, scr = j % 2 ? 'glowP' : 'glowC';
                for (const [u, f] of [[0.75, 1], [w - 0.75, -1]]) { I(u, d, 1.0, 2.2, 1.0, 0, 'post'); I(u + f * 0.52, d, 0.04, 0.7, 0.75, 1.2, scr, false); I(u, d, 1.04, 0.26, 1.04, 2.0, 'glowY', false); }
            }
            I(w / 2, 5.5, 1.4, 1.0, 1.4, 0, 'accR'); I(w / 2, 5.5, 1.4, 1.1, 1.4, 1.0, 'glass', false);   // claw machine
            I(w / 2 - 0.3, 5.4, 0.35, 0.35, 0.35, 1.0, 'accY', false); I(w / 2 + 0.3, 5.7, 0.35, 0.35, 0.35, 1.0, 'accB', false);
            I(w / 2, 10.4, w - 3, 1.1, 0.9, 0, 'post'); I(w / 2, 9.93, w - 3, 0.14, 0.04, 0.95, 'glowY', false); break;
        case 'sports':
            for (const u of [w * 0.28, w * 0.72]) {                // treadmills
                I(u, 4, 0.9, 0.45, 2.0, 0, 'rubber'); I(u, 3.1, 0.9, 0.12, 0.3, 1.5, 'steel', false);
                for (const o of [-0.4, 0.4]) I(u + o, 3.1, 0.07, 1.1, 0.07, 0.45, 'steel', false);
            }
            I(1.0, 8, 0.8, 1.2, 3, 0, 'steel'); for (let j = 0; j < 4; j++) I(1.0, 6.9 + j * 0.7, 0.4, 0.4, 0.4, 1.2, j % 2 ? 'accR' : 'accY', false);
            I(w / 2, 11.5, 1.9, 1.2, 0.05, 2.7, 'paint', false);       // basketball hoop
                    I(w / 2, 11.15, 0.6, 0.05, 0.6, 2.85, 'accR', false);
            I(w * 0.7, 8.4, 0.55, 0.6, 1.6, 0, 'rubber'); I(w * 0.7, 8.0, 1.9, 0.06, 0.06, 1.25, 'steel', false); counter(w / 2, 'post'); break;
        case 'shoes':
            for (const u of [0.45, w - 0.45]) { I(u, 6.2, 0.6, 2.4, 9, 0, 'plaster'); for (let j = 0; j < 3; j++) I(u + (u < 1 ? 0.31 : -0.31), 6.2, 0.04, 0.3, 8.4, 0.5 + j * 0.7, A(j + 1), false); }
            bench(xa + w / 2, s * (MALL_FRONT + 0.4 + 4), true, y0); bench(xa + w / 2, s * (MALL_FRONT + 0.4 + 7), true, y0);
            I(w / 2, 1.8, 1.2, 1.0, 1.2, 0, 'plaster'); I(w / 2, 1.8, 0.6, 0.26, 0.28, 1.0, 'glowL', false); counter(w / 2); break;
        case 'cafe':
            I(w / 2, 9.6, w - 2.4, 1.1, 1.0, 0, 'wood'); I(w / 2 - 1.6, 9.7, 0.9, 0.7, 0.6, 1.1, 'steel', false);
            I(w / 2, 11.5, 4.4, 1.3, 0.06, 2.3, 'post', false); I(w / 2, 11.45, 4.0, 0.12, 0.06, 3.35, 'glowY', false); I(w / 2, 11.45, 4.0, 0.12, 0.06, 2.4, 'glowY', false);
            for (const [u, d] of [[w * 0.28, 2.6], [w * 0.72, 2.6], [w * 0.28, 6.2], [w * 0.72, 6.2]]) { I(u, d, 1.1, 0.85, 1.1, 0, 'wood'); I(u + 0.9, d, 0.45, 0.45, 0.45, 0, A(Math.round(d))); }
            break;
        case 'jewelry':
            I(w / 2, 8.6, w - 3, 0.9, 0.9, 0, 'plaster'); I(w / 2, 8.6, w - 3, 0.42, 0.9, 0.9, 'glass', false); I(w / 2, 8.6, w - 3.3, 0.05, 0.6, 0.93, 'glowW', false);
            for (const u of [1.1, w - 1.1]) { I(u, 5, 0.9, 0.9, 4, 0, 'plaster'); I(u, 5, 0.9, 0.42, 4, 0.9, 'glass', false); I(u, 5, 0.6, 0.05, 3.7, 0.93, 'glowW', false); }
            I(w / 2, 4, 0.8, 1.15, 0.8, 0, 'plaster'); I(w / 2, 4, 0.42, 0.42, 0.42, 1.3, 'glowC', false); break;
    }
}
// a department store floor (one end of the mall): s = -1 west / 1 east, y0 = floor height
function deptStore(s, y0) {
    const xm = s * (MALL_X + MALL_ROW) / 2, B = (x, z, w, h, d, y = 0, key = 'plaster', solid = true) => addBlock(s * x, y0 + y, z, w, h, d, key, solid);
    // the open front onto the concourse: pillars and a big lit sign
    for (let z = -MALL_FRONT; z <= MALL_FRONT + 0.01; z += 6) B(MALL_ROW, z, 1.0, 4.5, 1.0, 0, 'plaster');
    B(MALL_ROW, 0, 0.8, 0.8, 2 * MALL_FRONT, 3.7, 'plaster');
    B(MALL_ROW - 0.45, 0, 0.06, 0.5, 24, 3.85, s > 0 ? 'glowR' : 'glowB', false);
    for (const z of [-20, 0, 20]) addCeilingLight(xm, z, y0, 4.5, 11, false, 2.2);
    if (y0 === 0) {
        // perfume / makeup counters, clothes racks and mannequins
        for (const z of [-21, -3, 15]) { B(47.5, z, 3.2, 1.0, 3.2, 0, 'plaster'); B(47.5, z, 3.2, 0.4, 3.2, 1.0, 'glass', false); B(47.5, z, 2.4, 0.05, 2.4, 1.03, 'glowW', false); }
        for (const z of [-12, 6, 24]) for (const x of [45, 50]) { B(x, z, 0.45, 1.5, 3.4, 0, 'steel'); for (let j = 0; j < 4; j++) B(x, z - 1.3 + j * 0.85, 0.7, 0.95, 0.55, 0.45, ['accR', 'accB', 'accG', 'accY'][(j + Math.round(z)) & 3], false); }
        for (const z of [-26, 27]) { B(52.6, z, 0.5, 1.7, 0.4, 0, 'plaster'); B(52.6, z, 0.36, 0.36, 0.36, 1.7, 'plaster', false); }
    } else {
        // furniture: sofas, beds, lamps
        for (const z of [-22, -8, 6, 20]) {
            const c = ['accB', 'accR', 'accG', 'woodDark'][Math.floor(Math.random() * 4)];
            B(46, z, 1.3, 0.6, 3.2, 0, c); B(45.5, z, 0.35, 0.65, 3.2, 0.6, c, false);
            B(50.5, z, 2.4, 0.6, 3.0, 0, 'plaster'); B(50.5, z + 0.3, 2.4, 0.12, 2.2, 0.6, ['accB', 'accY', 'accR'][Math.floor(Math.random() * 3)], false); B(50.5, z - 1.15, 1.8, 0.2, 0.5, 0.6, 'paint', false);
            B(48.3, z + 2, 0.15, 1.5, 0.15, 0, 'post', false); B(48.3, z + 2, 0.5, 0.35, 0.5, 1.5, 'glowW', false);
        }
    }
}
function mapMall() {
    const FH = MALL_FH, X = MALL_X, Z = MALL_Z, ROW = MALL_ROW, CX = MALL_CX, CZ = MALL_CZ, FR = MALL_FRONT, SW = 2 * ROW / 9;
    spawnPt = [0, 8.5];
    cageOverride = [0, -47];
    // ---- floors, the 2nd floor and the roof ----
    addBlock(0, 0, 0, 2 * X, 0.01, 2 * Z, 'tile', false);
    for (const s of [-1, 1]) {
        addBlock(0, FH - 0.5, s * (CZ + Z) / 2, 2 * ROW, 0.5, Z - CZ, 'tile');          // 2nd floor of a store row + its balcony
        addBlock(s * (X + ROW) / 2, FH - 0.5, 0, X - ROW, 0.5, 2 * Z, 'tile');          // 2nd floor of a department store
        addBlock(s * (ROW + CX) / 2, FH - 0.5, 0, ROW - CX, 0.5, 2 * CZ, 'tile');       // end balcony
        addBlock(0, 2 * FH - 0.5, s * (FR + Z) / 2, 2 * ROW, 0.5, Z - FR, 'concrete');   // roofs
        addBlock(s * (X + ROW) / 2, 2 * FH - 0.5, 0, X - ROW, 0.5, 2 * Z, 'concrete');
        for (let x = -ROW + 4.5; x < ROW; x += 9.1) addCeilingLight(x, s * 15.5, 0, FH - 0.5, 7, false, 1.3);         // lights under the balcony
    }
    // ---- outside walls: the entrance in the middle of each long side, two doors into each department store ----
    const wallZ = (z, x0, x1, y0, y1, key = 'plaster') => addBlock((x0 + x1) / 2, y0, z, x1 - x0, y1 - y0, 0.6, key);
    const wallX = (x, z0, z1, y0, y1, key = 'plaster') => addBlock(x, y0, (z0 + z1) / 2, 0.6, y1 - y0, z1 - z0, key);
    for (const s of [-1, 1]) {
        const wz = s * (Z + 0.3), wx = s * (X + 0.3), d1 = s * 6, d2 = s * 16;          // department store doors at z = d..d+4 (s side)
        wallZ(wz, -X - 0.6, -4.5, 0, FH - 0.5); wallZ(wz, 4.5, X + 0.6, 0, FH - 0.5); wallZ(wz, -X - 0.6, X + 0.6, FH - 0.5, 2 * FH + 0.4);
        const dz = [[d1, d1 + s * 4], [d2, d2 + s * 4]].map(([a, b]) => [Math.min(a, b), Math.max(a, b)]).sort((p, q) => p[0] - q[0]);
        let zc = -Z;
        for (const [a, b] of dz) { wallX(wx, zc, a, 0, FH - 0.5); wallX(wx, a, b, 3.8, FH - 0.5); zc = b; }
        wallX(wx, zc, Z, 0, FH - 0.5); wallX(wx, -Z, Z, FH - 0.5, 2 * FH + 0.4);
        for (const [a, b] of dz) { addBlock(wx + s * 0.32, 3.8, (a + b) / 2, 0.06, 0.25, b - a, 'glowW', false); for (const z of [a, b]) addBlock(wx + s * 0.3, 0, z, 0.2, 3.8, 0.2, 'steel', false); }
        // base band, pilasters and lit windows on the outside
        eachRun(-X - 0.66, wz + s * 0.06, X + 0.66, wz + s * 0.06, [[0, 4.5]], (cx, cz, len) => addBlock(cx, 0, cz, len, 0.8, 0.66, 'concreteDark', false));
        for (let x = -X + 4; x <= X - 3.9; x += 10) {
            if (Math.abs(x) > 6) addBlock(x, 0, wz + s * 0.36, 0.9, 2 * FH + 0.4, 0.14, 'concrete', false);
            if (Math.abs(x + 5) > 19 && x + 5 < X - 2) addBlock(x + 5, 6.6, wz + s * 0.33, 6.4, 1.6, 0.06, 'glowW', false);
        }
        for (let z = -Z + 6; z < Z - 3; z += 12) if (!(s > 0 ? z < 4 && z > -26 : z > -4 && z < 26)) addBlock(wx + s * 0.33, 6.6, z, 0.06, 1.6, 7, 'glowW', false);
        // entrance canopy and the big sign: MEGA MALL
        addBlock(0, FH - 0.6, s * (Z + 2.6), 14, 0.5, 4, 'concrete');
        addBlock(0, FH - 0.66, s * (Z + 2.6), 12, 0.06, 3.2, 'glowW', false);
        for (const x of [-6.6, 6.6]) addBlock(x, 0, s * (Z + 4.3), 0.35, FH - 0.6, 0.35, 'steel');
        for (const x of [-4.5, 4.5]) addBlock(x, 0, s * (Z + 0.3), 0.3, FH - 0.5, 0.75, 'steel', false);
        pixelText('MEGA MALL', -s * 14.6, 6.1, s * (Z + 0.68), 0.55, 'x', s, 'glowP');
        addBlock(0, 5.85, s * (Z + 0.66), 31, 0.12, 0.08, 'glowC', false);
        addBlock(0, 0, s * (Z + 5.5), 18, 0.012, 9.6, 'concrete', false);              // entrance walkway
        for (const x of [-7.5, 7.5]) planter(x, s * (Z + 8.2), 2.4, 2.4);
        // stairs up the outside of the department store to the roof
        const sz0 = -s * 24, sz1 = -s * 4, sx = s * (X + 1.9);
        stairRun(sx, sz0, sx, sz1, 0, 2 * FH, 2.6);
        stairSides(sx, sz0, sx, sz1, 0, 2 * FH, 2.6, [s], 'steel');
        addBlock(sx, 0, sz1 + s * 1.5, 2.6, 2 * FH, 3, 'concrete');
        railLine(sx + s * 1.3, sz1, sx + s * 1.3, sz1 + s * 3, 2 * FH, [], 'steel');
        railLine(sx - 1.3, sz1 + s * 3, sx + 1.3, sz1 + s * 3, 2 * FH, [], 'steel');
    }
    // ---- store rows (both floors) ----
    let bag = [];
    for (const s of [-1, 1]) for (let f = 0; f < 2; f++) {
        const y0 = f * FH, closed = 1 + Math.floor(Math.random() * 7);
        for (let k = 0; k <= 9; k++) {
            const x = -ROW + k * SW;
            addBlock(x, y0, s * (FR + Z) / 2, 0.4, FH - 0.5, Z - FR, 'plaster');             // walls between the stores
            addBlock(x, y0, s * FR, 1.0, 3.7, 0.8, 'plaster');                              // storefront pillar
        }
        addBlock(0, y0 + 3.7, s * FR, 2 * ROW, 0.8, 0.8, 'plaster');                         // header over the shop fronts
        for (let i = 0; i < 9; i++) {
            const xa = -ROW + i * SW, xc = xa + SW / 2;
            if (f === 0 && i === 4) {        // the entrance hall
                addBlock(xc, 0, s * (FR + Z) / 2, SW - 1, 0.014, Z - FR, 'post', false);
                addBlock(xc, 3.86, s * (FR - 0.44), SW * 0.6, 0.42, 0.06, 'glowW', false);
                bench(xc - 2.6, s * 23, false); bench(xc + 2.6, s * 23, false);
                addCeilingLight(xc, s * 24, 0, 4.5, 8, false, 2.4);
                continue;
            }
            if (!bag.length) bag = STORE_KINDS.slice().sort(() => Math.random() - 0.5);
            const kind = i === closed ? 'closed' : bag.pop();
            addBlock(xc, y0 + 3.86, s * (FR - 0.44), SW * 0.62, 0.42, 0.06, STORE_SIGN[kind], false);
            if (kind === 'closed') {          // rolling shutter pulled down
                addBlock(xc, y0, s * FR, SW - 1.0, 3.7, 0.16, 'steel');
                for (let y = 0.35; y < 3.6; y += 0.42) addBlock(xc, y0 + y, s * (FR - 0.1), SW - 1.1, 0.05, 0.04, 'post', false);
                continue;
            }
            addCeilingLight(xc, s * 24.5, y0, 4.5, 8, false, 2.4);
            mallStore(kind, xa + 0.2, SW - 0.4, s, y0);
        }
    }
    deptStore(-1, 0); deptStore(-1, FH); deptStore(1, 0); deptStore(1, FH);
    // ---- the concourse: balcony railings, sky bridges, escalators, grand stairs ----
    const BR = 15;
    for (const s of [-1, 1]) {
        railLine(-CX, s * CZ, CX, s * CZ, FH, [[-BR, 2], [BR, 2], [-s * 32.5, 1.5]]);
        railLine(s * CX, -CZ, s * CX, CZ, FH, [[0, 2.5]]);
        addBlock(s * BR, FH - 0.5, 0, 4, 0.5, 2 * CZ, 'tile');
        railLine(s * BR - 2, -CZ, s * BR - 2, CZ, FH); railLine(s * BR + 2, -CZ, s * BR + 2, CZ, FH);
        addBlock(s * BR, FH - 0.56, 0, 1.2, 0.05, 2 * CZ - 2, 'glowW', false);
        stairRun(s * 26, 0, s * CX, 0, 0, FH, 5, ['tile', 'plaster']);                         // grand stairs
        stairSides(s * 26, 0, s * CX, 0, 0, FH, 5);
        for (let x = -ROW + 9.1; x < ROW - 4; x += 18.2) addBlock(x, FH, s * (CZ + 0.7), 0.3, 0.8, 0.3, 'glowW', false);   // balcony bollard lights
    }
    escalatorPair(21, 31, -12.8, 1, 0, FH);          // up to the north balcony
    escalatorPair(-21, -31, 12.8, -1, 0, FH);        // up to the south balcony
    // ---- food court: fountain, tables, four food stalls, a glass skylight on four pillars ----
    for (const [x, z, w, d] of [[0, -3.2, 7, 0.6], [0, 3.2, 7, 0.6], [-3.2, 0, 0.6, 5.8], [3.2, 0, 0.6, 5.8]]) addBlock(x, 0, z, w, 0.55, d, 'stone');   // a step: you can walk in
    addBlock(0, 0.02, 0, 5.8, 0.05, 5.8, 'accB', false); addBlock(0, 0.36, 0, 5.8, 0.04, 5.8, 'glass', false);
    addBlock(0, 0, 0, 1.2, 2.4, 1.2, 'stone'); addBlock(0, 2.4, 0, 2.6, 0.3, 2.6, 'stone'); addBlock(0, 2.7, 0, 0.5, 1.4, 0.5, 'glowC', false);
    for (const [x, z] of [[6, 2.6], [6, -2.6], [-6, 2.6], [-6, -2.6], [2.6, 6], [-2.6, 6], [2.6, -6], [-2.6, -6]]) {
        addBlock(x, 0, z, 1.5, 0.9, 1.5, 'wood'); addBlock(x, 0.9, z, 1.7, 0.06, 1.7, 'woodDark', false);
        for (const [ox, oz] of [[1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]]) addBlock(x + ox, 0, z + oz, 0.5, 0.45, 0.5, Math.abs(x) > 4 ? 'accR' : 'accY');
    }
    const stalls = [['glowY', 'accR'], ['glowP', 'accB'], ['glowL', 'accG'], ['glowC', 'accY']];
    [[-7.8, -7.8], [7.8, -7.8], [7.8, 7.8], [-7.8, 7.8]].forEach(([x, z], i) => {
        const [g, a] = stalls[i];
        for (const [ox, oz, w, d] of [[0, -1.65, 4, 0.7], [0, 1.65, 4, 0.7], [-1.65, 0, 0.7, 2.6]]) addBlock(x + ox, 0, z + oz, w, 1.1, d, 'wood');
        addBlock(x + 1.65, 0, z + 1.0, 0.7, 1.1, 1.3, 'wood');                                    // (a gap to get behind the counter)
        addBlock(x - 0.6, 0, z, 1.0, 1.0, 1.6, 'steel'); addBlock(x - 0.6, 1.0, z, 0.8, 0.05, 1.2, 'glowR', false);
        for (const [ox, oz] of [[-1.9, -1.9], [1.9, -1.9], [1.9, 1.9], [-1.9, 1.9]]) addBlock(x + ox, 1.1, z + oz, 0.12, 2.1, 0.12, 'steel', false);
        addBlock(x, 3.2, z, 4.6, 0.3, 4.6, a, false); addBlock(x, 3.5, z, 2.6, 0.55, 2.6, g, false);
    });
    for (const [x, z] of [[-11, -11], [11, -11], [11, 11], [-11, 11]]) { addBlock(x, 0, z, 0.9, 15, 0.9, 'steel'); addBlock(x, 0, z, 1.5, 0.7, 1.5, 'plaster'); }
    for (const t of [-11, -5.5, 0, 5.5, 11]) { addBlock(t, 15, 0, 0.25, 0.35, 22.9, 'steel', false); addBlock(0, 15, t, 22.9, 0.35, 0.25, 'steel', false); }
    addBlock(0, 15.12, 0, 22.4, 0.06, 22.4, 'glass', false);
    addBlock(0, 15.35, 0, 8, 1.8, 8, 'glass', false);
    for (const [x, z, w, d] of [[0, -4, 8.2, 0.2], [0, 4, 8.2, 0.2], [-4, 0, 0.2, 8.2], [4, 0, 0.2, 8.2]]) addBlock(x, 17.1, z, w, 0.2, d, 'steel', false);
    for (const [x, z] of [[-5.5, -5.5], [5.5, -5.5], [5.5, 5.5], [-5.5, 5.5]]) addCeilingLight(x, z, 0, 14.9, 12, true, 1.1);
    // ---- the rest of the concourse: a carousel, a phone-case cart, benches and planters ----
    const cx = 26.5, cz = 8.6;
    addBlock(cx, 0, cz, 6.6, 0.35, 6.6, 'woodDark'); addBlock(cx, 0, cz, 8, 0.35, 3.6, 'woodDark'); addBlock(cx, 0, cz, 3.6, 0.35, 8, 'woodDark');
    addBlock(cx, 0.35, cz, 1.3, 3.2, 1.3, 'accR'); addBlock(cx, 3.55, cz, 7.4, 0.3, 7.4, 'accR', false); addBlock(cx, 3.85, cz, 4.4, 0.6, 4.4, 'accY', false); addBlock(cx, 4.45, cz, 1.2, 0.6, 1.2, 'glowP', false);
    for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2, px = cx + Math.cos(a) * 2.9, pz = cz + Math.sin(a) * 2.9;
        addBlock(px, 0.35, pz, 0.08, 3.2, 0.08, 'glowY', false);
        addBlock(px, 1.0 + (i % 2) * 0.5, pz, 0.45, 0.6, 1.1, ['paint', 'accB', 'accY', 'accG'][i % 4], false);
        addBlock(cx + Math.cos(a) * 3.6, 3.5, cz + Math.sin(a) * 3.6, 0.25, 0.25, 0.25, 'glowW', false);
    }
    addBlock(-27, 0, -9, 3.2, 1.1, 1.6, 'accB'); addBlock(-27, 1.1, -9, 3.4, 0.08, 1.8, 'woodDark', false);
    for (const [ox, oz] of [[-1.6, -0.8], [1.6, -0.8], [1.6, 0.8], [-1.6, 0.8]]) addBlock(-27 + ox, 1.1, -9 + oz, 0.08, 1.5, 0.08, 'steel', false);
    addBlock(-27, 2.6, -9, 3.8, 0.15, 2.2, 'accY', false); addBlock(-27, 2.75, -9, 2.2, 0.4, 0.1, 'glowP', false);
    addBlock(-20.5, 0, -11.2, 0.3, 2.2, 0.3, 'steel'); addBlock(-20.5, 1.0, -11.2, 1.6, 1.1, 0.14, 'post', false); addBlock(-20.5, 1.1, -11.11, 1.4, 0.9, 0.04, 'glowC', false);
    for (const [x, z] of [[-21, -4], [-33, -4], [20, -4.6], [33, -4.6], [-20, 4.6], [-33, 4.6], [20, 4.2]]) planter(x, z, 2.2, 2.2);
    for (const [x, z, ax] of [[0, -11.7, true], [0, 11.7, true], [-27, -4.6, true], [8.5, -11.7, true], [-8.5, 11.7, true]]) bench(x, z, ax);
    for (const s of [-1, 1]) for (let x = -ROW + 13.6; x < ROW - 4; x += 27.3) bench(x, s * 16.6, true);
    // ---- roof: air-con units and vents ----
    for (let i = 0; i < 14; i++) {
        const s = i % 2 ? 1 : -1, end = i % 7 === 0, x = end ? s * (47 + Math.random() * 4) : -36 + Math.random() * 72, z = end ? -24 + Math.random() * 48 : s * (21 + Math.random() * 6);
        addBlock(x, 2 * FH, z, 2.8, 1.5, 2.0, 'steel'); addBlock(x, 2 * FH + 1.5, z, 1.4, 0.06, 1.4, 'post', false);
    }
    // ---- parking lots ----
    const lot = (x0, x1, zc) => {
        for (let x = x0; x <= x1 + 0.01; x += 3) addBlock(x, 0, zc, 0.12, 0.012, 11, 'paint', false);
        addBlock((x0 + x1) / 2, 0, zc, x1 - x0, 0.012, 0.12, 'paint', false);
        for (let x = x0 + 1.5; x < x1; x += 3) for (const h of [-1, 1]) {
            if (Math.abs(((x - x0) % 18) - 9) < 2) continue;                     // keep room round the lamp posts
            if (Math.random() < 0.3) parkedCar(x, zc + h * 2.75, false, h);
        }
        for (let x = x0 + 9; x < x1; x += 18) addLamp(x, zc);
    };
    for (const s of [-1, 1]) {
        lot(-66, -12, s * 44); lot(12, 66, s * 44); lot(-66, 66, s * 61);
        // service road on the department store side: a delivery truck, dumpsters and pallets
        const tx = s * 64, tz = s * 18;
        const { B } = rotKit(tx, tz, s > 0 ? 3 : 1);
        B(-1.2, 0, 6.2, 3.0, 2.5, 0.7, 'plaster'); B(3.3, 0, 2.2, 2.1, 2.4, 0.6, 'accR'); B(4.42, 0, 0.06, 0.8, 2.0, 1.6, 'post', false);
        for (const [ox, oz] of [[3.3, 1.2], [3.3, -1.2], [-3, 1.2], [-3, -1.2], [-0.6, 1.2], [-0.6, -1.2]]) B(ox, oz, 0.9, 0.9, 0.25, 0, 'rubber', false);
        addBlock(s * 58.8, 0, s * 26, 1.8, 1.6, 3.2, 'accG'); addBlock(s * 58.8, 0, s * 22, 1.8, 1.6, 3.2, 'accB');
        addBlock(s * 66, 0, -s * 27, 1.3, 0.9, 1.3, 'wood'); addBlock(s * 68, 0, -s * 27, 1.3, 0.45, 1.3, 'woodDark');
    }
}


// ---------- 4.0 MILITARY BASE ----------
// A full-size base: a parade ground in the middle (you start here), the HQ with two watchtowers behind it joined by a
// steel catwalk, barracks, a motor pool and a fuel depot behind chain-link fences, two hangars (one with a jet, one with
// a helicopter) on the runway, a control tower, bunkers, and two helipads. You can jump the fences; zombies use the gates.
function towerTop(x, z, h, size, lightDir = null) {
    const e = size / 2 - 0.25;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) addBlock(x + sx * e, h + 1.1, z + sz * e, 0.14, 1.9, 0.14, 'post', false);
    addBlock(x, h + 3.0, z, size + 0.8, 0.3, size + 0.8, 'olive', false);
    addBlock(x, h + 3.3, z, size - 1, 0.25, size - 1, 'olive', false);
    if (lightDir) {          // a floodlight on an arm, lighting the ground below it
        const lx = x + lightDir[0] * (size / 2 + 2), lz = z + lightDir[1] * (size / 2 + 2);
        addBlock((x + lx) / 2, h + 2.9, (z + lz) / 2, Math.abs(lx - x) + 0.15, 0.12, Math.abs(lz - z) + 0.15, 'steel', false);
        addCeilingLight(lx, lz, 0, h + 2.9, 18, true, 0.9);
    }
}
function helicopter(cx, cz, y0, rot = 0) {
    const { B } = rotKit(cx, cz, rot);
    B(0, 0, 5.2, 2.1, 2.4, y0 + 0.9, 'olive');
    B(3.2, 0, 1.4, 1.3, 2.0, y0 + 0.9, 'olive'); B(3.1, 0, 1.2, 0.75, 1.9, y0 + 2.2, 'glass', false);
    for (const sz of [-1, 1]) B(0.8, sz * 1.21, 2.2, 0.8, 0.04, y0 + 2.0, 'post', false);
    B(-5, 0, 5.2, 0.7, 0.7, y0 + 2.0, 'olive');
    B(-7.4, 0, 0.7, 2.2, 0.25, y0 + 2.0, 'olive', false); B(-7.4, 0.3, 1.9, 0.12, 0.06, y0 + 3.4, 'post', false); B(-7.4, 0.3, 0.12, 1.9, 0.06, y0 + 2.45, 'post', false);
    B(0, 0, 0.5, 0.7, 0.5, y0 + 3.0, 'steel', false);
    B(0, 0, 13, 0.1, 0.45, y0 + 3.7, 'post', false); B(0, 0, 0.45, 0.1, 13, y0 + 3.7, 'post', false); B(0, 0, 0.8, 0.25, 0.8, y0 + 3.65, 'steel', false);
    for (const sz of [-1, 1]) { B(0, sz * 1.1, 5.6, 0.15, 0.18, y0, 'steel', false); for (const ox of [-1.6, 1.6]) B(ox, sz * 1.1, 0.12, 0.95, 0.12, y0, 'steel', false); }
    B(2.4, 1.22, 0.25, 0.25, 0.06, y0 + 1.4, 'glowR', false); B(2.4, -1.22, 0.25, 0.25, 0.06, y0 + 1.4, 'glowL', false);
}
function jet(cx, cz) {          // nose toward +z
    addBlock(cx, 1.1, cz, 1.9, 1.7, 11, 'steel');
    addBlock(cx, 1.3, cz + 6.2, 1.3, 1.2, 1.5, 'steel'); addBlock(cx, 1.55, cz + 7.35, 0.7, 0.65, 0.9, 'concreteDark', false);
    addBlock(cx, 2.8, cz + 3.0, 1.1, 0.7, 2.8, 'glass', false);
    addBlock(cx, 1.6, cz - 0.6, 10, 0.25, 4, 'steel'); addBlock(cx, 1.62, cz - 1.3, 12.4, 0.2, 1.6, 'steel', false);
    for (const sx of [-1, 1]) {
        addBlock(cx + sx * 0.8, 2.8, cz - 4.7, 0.2, 2.3, 1.8, 'steel', false);
        addBlock(cx + sx * 6.2, 1.62, cz - 1.3, 0.25, 0.22, 0.3, sx < 0 ? 'glowR' : 'glowL', false);
        addBlock(cx + sx * 0.45, 1.4, cz - 5.6, 0.7, 0.7, 0.3, 'post', false);
        addBlock(cx + sx * 1.8, 0, cz - 1, 0.15, 1.6, 0.15, 'post', false); addBlock(cx + sx * 1.8, 0, cz - 1, 0.3, 0.6, 0.6, 'rubber', false);
    }
    addBlock(cx, 1.5, cz - 5, 6, 0.2, 1.8, 'steel', false);
    addBlock(cx, 0, cz + 4.6, 0.15, 1.2, 0.15, 'post', false); addBlock(cx, 0, cz + 4.6, 0.3, 0.55, 0.55, 'rubber', false);
    addBlock(cx, 2.82, cz - 2, 0.3, 0.06, 4, 'accY', false);
}
function hangar(cx, cz, kind) {
    const W = 28, D = 22, H = 10, T = 0.8, x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2;
    addBlock(cx, 0, z0 + T / 2, W, H, T, 'olive');                                              // back wall
    for (const sx of [-1, 1]) {                                                                 // side walls, a small door near the front
        const x = cx + sx * (W / 2 - T / 2);
        addBlock(x, 0, (z0 + z1 - 7) / 2, T, H, D - 7, 'olive'); addBlock(x, 0, z1 - 1, T, H, 2, 'olive'); addBlock(x, 3.8, z1 - 4.5, T, H - 3.8, 5, 'olive');
        addBlock(x + sx * 0.42, 3.8, z1 - 4.5, 0.06, 0.2, 5, 'glowW', false);
        addBlock(cx + sx * (W / 2 - 2), 0, z1 - T / 2, 4, H, T, 'olive');                          // front corners
    }
    addBlock(cx, 8, z1 - T / 2, W - 8, H - 8, T, 'olive');                                       // over the big door
    for (let x = -9.5; x < 10; x += 2) addBlock(cx + x, 8.6, z1 + 0.04, 1, 0.8, 0.06, (x / 2 + 10) % 2 ? 'accY' : 'post', false);
    addBlock(cx, H, cz, W + 0.6, 0.6, D + 0.6, 'steel'); addBlock(cx, H + 0.6, cz, W - 6, 0.6, D + 0.6, 'steel'); addBlock(cx, H + 1.2, cz, W - 14, 0.5, D + 0.6, 'steel');
    for (const ox of [-7, 7]) { addCeilingLight(cx + ox, cz + 2, 0, H, 14, true, 2.2); addBlock(cx + ox, H - 0.15, cz - 4, 0.6, 0.08, 8, 'glowW', false); }
    // mezzanine along the back wall, stairs down along the side wall
    addBlock(cx, 4.5, z0 + T + 1.5, W - 2 * T, 0.5, 3, 'steel');
    railLine(x0 + T, z0 + T + 3, x1 - T, z0 + T + 3, 5, [[x1 - T - 1.3, 1.4]], 'steel');
    stairRun(x1 - T - 1.3, z0 + T + 13, x1 - T - 1.3, z0 + T + 3, 0, 5, 2.6, ['steel', 'concreteDark']);
    stairSides(x1 - T - 1.3, z0 + T + 13, x1 - T - 1.3, z0 + T + 3, 0, 5, 2.6, [-1], 'steel');
    for (const x of [-9, -3, 3]) { addBlock(cx + x, 5, z0 + T + 0.6, 1.6, 1.0, 1.0, 'olive'); }
    addBlock(cx, 0, cz, W - 2 * T, 0.012, D - T, 'concrete', false);
    if (kind === 'jet') { jet(cx, cz + 1); addBlock(cx - 9, 0, cz + 5, 2.4, 1.2, 1.4, 'accR'); addBlock(cx + 9, 0, cz + 6, 2.2, 1.0, 3.2, 'accY'); addBlock(cx + 9, 1.0, cz + 7, 1.6, 0.9, 1.0, 'accY', false); }
    else { helicopter(cx - 2, cz + 2, 0, 1); container(cx - 9.5, cz + 6, 0, false, 'olive'); addStructure('crates', cx + 8, cz + 5, 0); }
    fireEscape(cx, cz, W, D, H + 0.6, 0);                                                         // up to the roof from the back
}
function bunker(cx, cz, rot) {      // the firing slit faces local +z, the door is at the back
    const { B, P } = rotKit(cx, cz, rot), W = 10, D = 7, H = 3.6, T = 0.8;
    B(-3.2, -D / 2 + T / 2, 3.6, H, T, 0, 'concrete'); B(3.2, -D / 2 + T / 2, 3.6, H, T, 0, 'concrete');
    B(-W / 2 + T / 2, 0, T, H, D, 0, 'concrete'); B(W / 2 - T / 2, 0, T, H, D, 0, 'concrete');
    B(0, D / 2 - T / 2, W, 1.3, T, 0, 'concrete'); B(0, D / 2 - T / 2, W, H - 2.0, T, 2.0, 'concrete');
    B(0, 0, W + 0.6, 0.6, D + 0.6, H, 'concreteDark');
    for (const lx of [-3.6, 0, 3.6]) B(lx, D / 2 - 0.1, 2.6, 0.55, 0.7, H + 0.6, 'sand');
    for (const lx of [-3.6, 3.6]) B(lx, D / 2 + 2.3, 3.2, 1.2, 0.9, 0, 'sand');
    B(-3.2, -1.6, 1.2, 0.8, 0.8, 0, 'olive'); B(3.2, 1.4, 1.2, 0.8, 0.8, 0, 'olive');
    B(0, -D / 2 - 0.05, 3.0, 0.14, 0.06, 2.9, 'glowY', false);
    const [lx, lz] = P(0, 0); addCeilingLight(lx, lz, 0, H, 6, false, 1.0);
}
function fuelTank(cx, cz, r, h) {
    const s = r * 0.85, c = r * 0.42;
    for (const [w, d] of [[2 * s, 2 * s], [2 * r, 2 * c], [2 * c, 2 * r]]) { addBlock(cx, 0, cz, w, h, d, 'paint'); addBlock(cx, h * 0.62, cz, w + 0.08, 0.6, d + 0.08, 'accR', false); }
    addBlock(cx, h, cz, 2 * c, 0.35, 2 * c, 'steel', false);
}
function milTruck(x, z, rot) {
    const { B } = rotKit(x, z, rot);
    B(3.0, 0, 2.0, 2.1, 2.3, 0.6, 'olive'); B(4.02, 0, 0.06, 0.7, 2.0, 1.75, 'glass', false);
    B(-1.2, 0, 6.0, 0.4, 2.4, 0.9, 'olive'); B(-1.4, 0, 5.6, 2.0, 2.4, 1.3, 'khaki');
    for (const [ox, oz] of [[3.0, 1.2], [3.0, -1.2], [-2.6, 1.2], [-2.6, -1.2], [-0.4, 1.2], [-0.4, -1.2]]) B(ox, oz, 1.0, 1.0, 0.3, 0, 'rubber', false);
}
function jeep(x, z, rot) {
    const { B } = rotKit(x, z, rot);
    B(0, 0, 3.8, 0.9, 1.9, 0.45, 'olive'); B(1.2, 0, 1.4, 0.2, 1.8, 1.35, 'olive', false); B(0.4, 0, 0.08, 0.85, 1.8, 1.35, 'post', false);
    B(-0.6, 0, 0.7, 0.5, 1.5, 1.35, 'rubber', false); B(-0.9, 0, 0.1, 1.2, 1.8, 1.35, 'post', false); B(-1.95, 0, 0.2, 0.8, 0.8, 0.7, 'rubber', false);
    for (const [ox, oz] of [[1.25, 0.95], [-1.25, 0.95], [1.25, -0.95], [-1.25, -0.95]]) B(ox, oz, 0.8, 0.8, 0.3, 0.05, 'rubber', false);
}
function tankVehicle(x, z, rot) {
    const { B } = rotKit(x, z, rot);
    for (const sz of [-1, 1]) { B(0, sz * 1.45, 6.8, 1.0, 0.9, 0, 'rubber'); for (let i = -3; i <= 3; i++) B(i * 0.95, sz * 1.92, 0.6, 0.6, 0.06, 0.2, 'concreteDark', false); }
    B(0, 0, 6.4, 1.0, 2.1, 0.4, 'olive'); B(0, 0, 7.0, 0.35, 3.9, 1.0, 'olive');
    B(-0.4, 0, 3.2, 1.0, 2.6, 1.35, 'olive'); B(3.4, 0, 4.4, 0.3, 0.3, 1.75, 'olive', false); B(5.65, 0, 0.5, 0.42, 0.42, 1.69, 'post', false);
    B(-0.9, 0.5, 0.8, 0.18, 0.8, 2.35, 'olive', false); B(-1.2, -0.7, 0.08, 0.9, 0.08, 2.35, 'post', false);
}
function helipad(cx, cz, withHeli) {
    addBlock(cx, 0, cz, 14, 0.3, 14, 'concrete');
    for (const [x, z, w, d] of [[-2.2, 0, 0.9, 6], [2.2, 0, 0.9, 6], [0, 0, 3.5, 0.9]]) addBlock(cx + x, 0.3, cz + z, w, 0.012, d, 'paint', false);
    for (const [x, z, w, d] of [[0, -5.4, 10.8, 0.4], [0, 5.4, 10.8, 0.4], [-5.4, 0, 0.4, 10.8], [5.4, 0, 0.4, 10.8]]) addBlock(cx + x, 0.3, cz + z, w, 0.012, d, 'accY', false);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, r = 6.6 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))); addBlock(cx + Math.cos(a) * r, 0.3, cz + Math.sin(a) * r, 0.3, 0.14, 0.3, i % 3 ? 'glowY' : 'glowL', false); }
    addBlock(cx + 8, 0, cz - 6.5, 0.14, 4.5, 0.14, 'steel'); addBlock(cx + 8.9, 4.0, cz - 6.5, 1.6, 0.45, 0.45, 'accR', false); addBlock(cx + 9.9, 3.95, cz - 6.5, 0.6, 0.35, 0.35, 'paint', false);
    if (withHeli) helicopter(cx, cz, 0.3, 0);
}
function mapMilitary() {
    spawnPt = [0, 0];
    // ---- parade ground, roads, flag ----
    addBlock(0, 0, 0, 44, 0.012, 32, 'concrete', false);
    for (const [x, z, w, d] of [[0, -15.8, 44, 0.3], [0, 15.8, 44, 0.3], [-21.8, 0, 0.3, 32], [21.8, 0, 0.3, 32]]) addBlock(x, 0, z, w, 0.016, d, 'paint', false);
    for (const [x, z, w, d] of [[0, 30, 184, 7], [0, -25.5, 7, 19], [-46, -16, 7, 18], [46, -16, 7, 18], [-48, 66, 22, 8], [2, 66, 22, 8]]) addBlock(x, 0, z, w, 0.01, d, 'asphalt', false);
    for (let x = -88; x <= 88; x += 8) addBlock(x, 0, 30, 3.6, 0.014, 0.25, 'paint', false);
    addBlock(0, 0, -12, 2.2, 0.6, 2.2, 'stone'); addBlock(0, 0.6, -12, 0.25, 13.5, 0.25, 'steel'); addBlock(1.55, 11.6, -12, 2.8, 1.7, 0.06, 'accB', false); addBlock(1.55, 12.2, -12, 2.8, 0.5, 0.07, 'paint', false);
    for (const [x, z] of [[-14, -9], [14, -9], [-14, 9], [14, 9]]) {          // sandbag rings round the parade ground
        addBlock(x, 0, z - Math.sign(z) * 1.6, 4.2, 1.2, 0.9, 'sand'); addBlock(x - 1.7, 0, z, 0.9, 1.2, 2.4, 'sand'); addBlock(x + 1.7, 0, z, 0.9, 1.2, 2.4, 'sand');
    }
    addStructure('crates', -9, 6, 0); jeep(9, 5, 1);
    // ---- HQ, with two watchtowers behind it joined by a steel catwalk ----
    building(0, -42, 30, 14, 8, 'concrete');
    fireEscape(0, -42, 30, 14, 8.4, 2);
    addBlock(-8, 8.4, -44, 0.4, 3.0, 0.4, 'steel'); addBlock(-8, 11.4, -44, 3.2, 0.25, 3.2, 'paint', false); addBlock(-8, 11.65, -44, 2.0, 0.3, 2.0, 'paint', false); addBlock(-8, 11.95, -44, 0.3, 0.8, 0.3, 'steel', false);
    addBlock(9, 8.4, -45, 0.3, 9, 0.3, 'steel'); addBlock(9, 17.2, -45, 0.4, 0.4, 0.4, 'glowR', false);
    addBlock(0, 3.2, -34.9, 8, 1.0, 0.1, 'glowY', false); pixelText('HQ', -0.88, 3.3, -34.82, 0.16, 'x', 1, 'post', 0.06);
    for (const x of [-11, 11]) addBlock(x, 0, -28.6, 4.4, 1.2, 0.9, 'sand');
    for (const sx of [-1, 1]) { stairTower(sx * 26, -60, 12, 5, 'olive', sx < 0 ? 1 : 3, 'steel'); towerTop(sx * 26, -60, 12, 5, [0, 1]); }
    ropeBridge(-23.5, -60, 12, 23.5, -60, 12, { steel: true, width: 2.4 });
    // ---- barracks ----
    for (const sx of [-1, 1]) {
        building(sx * 52, -32, 24, 9, 4.2, 'khaki');
        for (const x of [-8, 0, 8]) addBlock(sx * 52 + x, 0, -32 + 4.53, 1.4, 2.6, 0.06, 'woodDark', false);
        addBlock(sx * 52 + sx * 13.6, 0, -30, 1.8, 1.6, 1.8, 'olive'); addBlock(sx * 52 - sx * 9, 4.6, -33, 2.2, 1.0, 1.6, 'steel');
    }
    // ---- motor pool (fenced): a vehicle shed, trucks, a tank and jeeps ----
    fenceLine(40, -8, 78, -8, [[59, 5]]); fenceLine(40, 22, 78, 22, [[50, 4]]); fenceLine(40, -8, 40, 22, [[7, 4.5]]); fenceLine(78, -8, 78, 22);
    for (const z of [-7, 7, 21]) for (const x of [66.5, 76.5]) addBlock(x, 0, z, 0.4, 4.6, 0.4, 'steel');
    addBlock(71.5, 4.6, 7, 11.4, 0.4, 28.8, 'olive'); addBlock(71.5, 4.5, 7, 9, 0.08, 1, 'glowW', false);
    milTruck(71.5, -2, 2); milTruck(71.5, 9, 2); jeep(71.5, 17, 2);
    tankVehicle(54, 2, 0); jeep(48, 15, 1);
    for (const [x, z] of [[44, -4], [45.2, -4], [44, -2.8]]) addBlock(x, 0, z, 0.8, 1.1, 0.8, 'accR');
    for (const [x, z] of [[62, 17], [63.2, 17]]) addBlock(x, 0, z, 1.1, 1.3, 1.1, 'rubber');
    // ---- fuel depot (fenced): tanks joined by a catwalk, stairs up one of them ----
    fenceLine(-80, -8, -42, -8, [[-61, 5]]); fenceLine(-80, 22, -42, 22); fenceLine(-42, -8, -42, 22, [[7, 4.5]]); fenceLine(-80, -8, -80, 22);
    fuelTank(-70, 0, 4, 7); fuelTank(-54, 0, 4, 7); fuelTank(-70, 15, 3, 5);
    ropeBridge(-66, 0, 7, -58, 0, 7, { steel: true, width: 2.2 });
    stairRun(-44.5, 5.2, -53.5, 5.2, 0, 7, 2.4, ['steel', 'concreteDark']); stairSides(-44.5, 5.2, -53.5, 5.2, 0, 7, 2.4, [1], 'steel');
    addBlock(-52, 0, 16, 6, 3.2, 4, 'concrete'); addBlock(-52, 3.2, 16, 6.4, 0.3, 4.4, 'olive');
    addBlock(-61, 0.6, 16, 12, 0.3, 0.3, 'steel', false); addBlock(-61, 0.6, 15.4, 12, 0.3, 0.3, 'steel', false);
    addBlock(-41.6, 1.2, 1.8, 0.06, 1.0, 1.4, 'accY', false);
    // ---- hangars on the runway, a control tower ----
    hangar(-48, 51, 'jet'); hangar(2, 51, 'heli');
    stairTower(40, 52, 14, 6, 'concrete', 0, 'steel');
    for (const [x, z, w, d] of [[40, 48.95, 6.2, 0.06], [40, 55.05, 6.2, 0.06], [36.95, 52, 0.06, 6.2], [43.05, 52, 0.06, 6.2]]) addBlock(x, 15.1, z, w, 1.9, d, 'glass', false);
    towerTop(40, 52, 14, 6, [-1, 0]); addBlock(40, 17.6, 52, 0.25, 2.5, 0.25, 'steel', false); addBlock(40, 20.1, 52, 0.5, 0.5, 0.5, 'glowR', false);
    // runway: asphalt, centre line, edge lights (green at the west end, red at the east end)
    addBlock(0, 0, 80, 188, 0.01, 16, 'asphalt', false);
    for (let x = -84; x <= 84; x += 12) addBlock(x, 0, 80, 6, 0.014, 0.5, 'paint', false);
    for (const z of [72.6, 87.4]) addBlock(0, 0, z, 186, 0.014, 0.25, 'paint', false);
    for (const sx of [-1, 1]) for (let k = -5; k <= 5; k++) if (k) addBlock(sx * 89, 0, 80 + k * 1.3, 4, 0.014, 0.6, 'paint', false);
    for (let x = -90; x <= 90; x += 10) for (const z of [71.6, 88.4]) addBlock(x, 0, z, 0.3, 0.22, 0.3, Math.abs(x) >= 90 ? (x < 0 ? 'glowL' : 'glowR') : 'glowW', false);
    // ---- bunkers ----
    bunker(-30, 18, 0); bunker(29, 18, 0); bunker(-78, -62, 3); bunker(70, 38, 0);
    // ---- helipads (one with a helicopter) and a container yard ----
    helipad(52, -72, true); helipad(76, -72, false);
    for (const [x, z, l, k] of [[-52, -66, 0, 'olive'], [-52, -66, 1, 'accG'], [-52, -60.5, 0, 'rust'], [-44, -66, 0, 'khaki']]) container(x, z, l, true, k);
    addStructure('crates', -60, -54, 1);
    // ---- firing range on the west side ----
    for (let z = -46; z <= -26; z += 5) { addBlock(-90, 0, z, 0.15, 1.6, 0.15, 'woodDark'); addBlock(-90, 1.6, z, 0.06, 1.4, 1.2, 'paint', false); addBlock(-89.95, 2.0, z, 0.06, 0.5, 0.5, 'accR', false); }
    addBlock(-76, 0, -36, 1.2, 1.0, 22, 'sand'); addBlock(-74.5, 0, -36, 1.2, 0.8, 3, 'wood');
    // ---- scattered cover: jersey barriers and crate stacks along the roads ----
    for (const [x, z, ax] of [[-62, 26, true], [-20, 26, true], [20, 34, true], [62, 34, true], [-36, -8, false], [36, -6, false], [-30, -24, true], [30, -24, true]]) addBlock(x, 0, z, ax ? 3.2 : 0.8, 1.1, ax ? 0.8 : 3.2, 'concrete');
    addStructure('crates', -30, 36, 0); addStructure('containers', 30, -10, 1);
    // ---- lamps ----
    for (const [x, z] of [[-20, -14], [20, -14], [-20, 14], [20, 14], [-84, 25], [-60, 25], [-12, 25], [12, 25], [60, 25], [84, 25], [-40, -20], [40, -20], [-6, -27], [6, -27],
                          [-85, 64], [-23, 64], [27, 64], [85, 64], [-64, -46], [64, -50], [-30, -80], [30, -80], [88, 0], [-88, 0]])
        if (!pointInSolid(new V3(x, 1, z), 1.6)) addLamp(x, z);
}


function addLamp(x, z) {
    addBlock(x, 0, z, 0.4, 7, 0.4, 'post');
    addBlock(x, 7, z, 1.1, 0.3, 1.1, 'post');
    addBlock(x, 6.78, z, 0.8, 0.22, 0.8, 'lampHead', false);
    lampSpots.push([x, z, 0, 7, 17, true]);
}
// 4.0: a light hanging from a ceiling (or a floodlight on a tower) - a glowing panel, a pool of light on the floor below,
// and a light shaft when `cone` is on. y0 = the floor it lights, h = how high above that floor it hangs.
function addCeilingLight(x, z, y0, h, size = 9, cone = false, w = 1.6) {
    addBlock(x, y0 + h - 0.12, z, w, 0.08, w, 'lampHead', false);
    lampSpots.push([x, z, y0, h, size, cone]);
}


function finalizeWorld() {
    const groups = {};
    for (const b of worldBlocks) (groups[b.key] || (groups[b.key] = [])).push(b);
    for (const key in groups) {
        const geos = groups[key].map(blockGeo);
        const merged = mergeGeometries(geos, false);
        geos.forEach(g => g.dispose());
        const mesh = new THREE.Mesh(merged, worldMat(key));
        mesh.userData.matKey = key;
        const lit = GLOW_COLORS[key] === undefined && key !== 'lampHead';
        const isCloud = key === 'cloud' || key === 'cloudShade';
        mesh.castShadow = lit && !isCloud && key !== 'bound' && !SEE_THRU[key]; mesh.receiveShadow = lit && !isCloud && key !== 'glass';
        if (key === 'glass') mesh.renderOrder = 3;
        worldGroup.add(mesh);
    }
    // outlines for every solid block, all in one draw call
    const unit = new THREE.EdgesGeometry(sharedBox).attributes.position.array;
    const sb = worldBlocks.filter(b => b.solid && b.key !== 'bound' && b.key !== 'cloud' && b.key !== 'cloudShade');
    const arr = new Float32Array(sb.length * unit.length);
    sb.forEach((b, i) => {
        const o = i * unit.length;
        for (let j = 0; j < unit.length; j += 3) {
            arr[o + j] = b.x + unit[j] * b.w; arr[o + j + 1] = b.y + unit[j + 1] * b.h; arr[o + j + 2] = b.z + unit[j + 2] * b.d;
        }
    });
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    worldGroup.add(new THREE.LineSegments(eg, edgeMat));
    // light pools under the lamps
    if (!mats.pool) mats.pool = new THREE.MeshBasicMaterial({ map: poolTex, color: theme.lamp, transparent: true, opacity: theme.lampPool, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    if (lampSpots.length) {
        const pg = lampSpots.map(([x, z, y0, h, size]) => { const g = new THREE.PlaneGeometry(size, size); g.rotateX(-Math.PI / 2); g.translate(x, y0 + 0.04, z); return g; });
        const pm = new THREE.Mesh(mergeGeometries(pg), mats.pool); pm.renderOrder = 2;
        pg.forEach(g => g.dispose());
        worldGroup.add(pm);
        // light shafts under each lamp (High / Cinematic), merged into one mesh
        if (!mats.cone) {
            const [c, g] = makeCanvas(64);
            const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
            mats.cone = new THREE.MeshBasicMaterial({ map: canvasTex(c), color: theme.lamp, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
        }
        // (4.0: lamps can stand on an upper floor or hang from a ceiling; ceiling lights in low rooms get no shaft)
        const cg = lampSpots.filter(l => l[5]).map(([x, z, y0, h]) => { const H = h - 0.3, k = H / 6.7, g = new THREE.CylinderGeometry(0.4, 4.4 * Math.sqrt(k), H, 18, 1, true); g.translate(x, y0 + H / 2, z); return g; });
        coneMesh = cg.length ? new THREE.Mesh(mergeGeometries(cg), mats.cone) : null;
        if (coneMesh) { coneMesh.renderOrder = 4; worldGroup.add(coneMesh); }
        cg.forEach(g => g.dispose());
    } else coneMesh = null;
    updateCones();
}
let coneMesh = null;
function updateCones() {
    if (mats.cone) { mats.cone.color.setHex(theme.lamp); mats.cone.opacity = 0.06 + theme.lampPool * 0.16; }
    if (coneMesh) coneMesh.visible = !!Q.cones && theme.lampPool > 0.1;
}
// Cinematic / High: a few REAL point lights hop to whichever lamps are nearest you
let lampLightT = 0;
function updateLampLights(dt) {
    if (!lampLights.length) return;
    lampLightT -= dt; if (lampLightT > 0) return; lampLightT = 0.4;
    const p = camera.position;
    // (4.0: a lamp on another floor counts as further away, so the lights stay on the floor you're on)
    const near = lampSpots.map(l => [l, (l[0] - p.x) ** 2 + (l[1] - p.z) ** 2 + 6 * (l[2] + 1.6 - p.y) ** 2]).sort((a, b) => a[1] - b[1]);
    lampLights.forEach((L, i) => {
        const n = near[i];
        if (!n) { L.intensity = 0; return; }
        L.position.set(n[0][0], n[0][2] + n[0][3] - 0.6, n[0][1]); L.color.setHex(theme.lamp);
        L.intensity = 90 * Math.min(1, theme.lampPool * 2);
    });
}


function addStructure(type, cx, cz, rot) {
    const accent = ['accR', 'accB', 'accG', 'accY'][Math.floor(Math.random() * 4)];
    const glow = ['glowC', 'glowP', 'glowL', 'glowY'][Math.floor(Math.random() * 4)];


    // Local -> world with 90 degree rotation steps
    const B = (lx, lz, w, h, d, y0 = 0, key = 'concrete', solid = true) => {
        let x = lx, z = lz, ww = w, dd = d;
        for (let i = 0; i < rot; i++) { [x, z] = [-z, x]; [ww, dd] = [dd, ww]; }
        addBlock(cx + x, y0, cz + z, ww, h, dd, key, solid);
    };
    const pad = (lx, lz, w, d, y) => B(lx, lz, w, 0.08, d, y, glow, false);


    switch (type) {
        case 'crates': {
            const hts = [];
            for (let i = 0; i < 9; i++) hts.push(Math.random() < 0.55 ? (Math.random() < 0.4 ? 2 : 1) : 0);
            if (hts.every(h => h === 0)) hts[4] = 1;
            const nb = [1, 3, 5, 7].some(i => hts[i] >= 1);
            if (nb && Math.random() < 0.4) hts[4] = 3;
            for (let i = 0; i < 9; i++) {
                const lx = (i % 3 - 1) * 2, lz = (Math.floor(i / 3) - 1) * 2;
                for (let l = 0; l < hts[i]; l++) B(lx, lz, 2, 2, 2, l * 2, (l + i) % 2 ? 'wood' : 'woodDark');
            }
            break;
        }
        case 'stairs': {
            for (let i = 0; i < 4; i++) B(-4.5 + i * 3, 0, 3, 2 * (i + 1), 6, 0, i % 2 ? 'concrete' : 'concreteDark');
            pad(4.5, 0, 2.4, 5.4, 8);
            break;
        }
        case 'fort': {
            B(0, -5.25, 12, 3, 1.5, 0, 'sand'); B(-5.25, 0.75, 1.5, 3, 10.5, 0, 'sand'); B(5.25, 0.75, 1.5, 3, 10.5, 0, 'sand');
            B(-3.5, 5.25, 2, 3, 1.5, 0, 'sand'); B(3.5, 5.25, 2, 3, 1.5, 0, 'sand');   // front wall with a doorway
            B(-5.25, -5.25, 2, 1.5, 2, 3, 'concreteDark'); B(5.25, -5.25, 2, 1.5, 2, 3, 'concreteDark'); // corner turrets
            B(1.5, -1.5, 2, 2, 2, 0, 'wood');
            break;
        }
        case 'wall': {
            B(0, 0, 12, 3, 1.5, 0, 'concrete'); B(-4, 2.2, 3, 1.5, 3, 0, 'concreteDark'); B(4.5, -2.2, 3, 1.5, 3, 0, 'concreteDark');
            break;
        }
        case 'arch': {
            B(-4.5, 0, 2.5, 3, 2.5, 0, 'steel'); B(4.5, 0, 2.5, 3, 2.5, 0, 'steel'); B(0, 0, 11.5, 1, 2.5, 3, accent);
            pad(0, 0, 10.5, 1.6, 4);
            break;
        }
        case 'ziggurat': {
            B(0, 0, 14, 2, 14, 0, 'sand'); B(0, 0, 10, 2, 10, 2, 'concrete'); B(0, 0, 6, 2, 6, 4, 'sand');
            pad(0, 0, 4.5, 4.5, 6);
            break;
        }
        case 'tower': {
            B(0, 0, 6, 7, 6, 0, 'steel'); B(4.5, 1.5, 3, 5, 3, 0, 'concreteDark'); B(4.5, -1.5, 3, 2.5, 3, 0, 'concrete');
            B(0, 0, 6.6, 0.4, 6.6, 3.2, accent, false);
            pad(0, 0, 5, 5, 7);
            break;
        }
        case 'pillars': {
            const n = 4 + Math.floor(Math.random() * 3);
            for (let i = 0; i < n; i++) {
                const a = (i / n) * Math.PI * 2, r = 5;
                B(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r), 2, 2 + Math.floor(Math.random() * 3), 2, 0, i % 2 ? 'concrete' : 'steel');
            }
            B(0, 0, 2.5, 1, 2.5, 0, accent);
            break;
        }
        case 'containers': {
            B(0, -2.2, 12, 3, 4, 0, accent); B(0, 2.2, 12, 3, 4, 0, 'steel'); B(-3, 0, 6, 3, 4, 3, 'concreteDark');
            B(7.5, 2.2, 2, 1.5, 2, 0, 'wood');
            break;
        }
        case 'catwalk': {
            // raised steel walkway on legs, with steps up one end
            B(-4.5, -1.6, 0.8, 4, 0.8, 0, 'steel'); B(-4.5, 1.6, 0.8, 4, 0.8, 0, 'steel');
            B(4.5, -1.6, 0.8, 4, 0.8, 0, 'steel'); B(4.5, 1.6, 0.8, 4, 0.8, 0, 'steel');
            B(0, 0, 11, 0.5, 4, 4, 'steel');
            B(-9.25, 0, 1.5, 1.5, 3, 0, 'concrete'); B(-7.75, 0, 1.5, 3, 3, 0, 'concreteDark'); B(-6.25, 0, 1.5, 4, 3, 0, 'concrete');
            B(0, -1.9, 11, 0.6, 0.2, 4.5, accent); B(0, 1.9, 11, 0.6, 0.2, 4.5, accent);
            pad(0, 0, 9, 3, 4.5);
            break;
        }
        case 'rubble': {
            const n = 6 + Math.floor(Math.random() * 5);
            for (let i = 0; i < n; i++) {
                const a = Math.random() * Math.PI * 2, r = Math.random() * 6;
                const s = 1 + Math.random() * 1.6;
                B(Math.cos(a) * r, Math.sin(a) * r, s, 0.5 + Math.random() * 1.6, s * (0.6 + Math.random() * 0.6), 0, Math.random() < 0.5 ? 'concrete' : (Math.random() < 0.5 ? 'sand' : 'concreteDark'));
            }
            break;
        }
        case 'scaffold': {
            // two-deck scaffold: a step up to the 3m deck, a crate on it up to the 6m deck
            for (const [lx, lz] of [[-5, -3], [5, -3], [-5, 3], [5, 3]]) B(lx, lz, 0.35, 2.7, 0.35, 0, 'post');
            B(0, 0, 10.4, 0.3, 6.4, 2.7, 'steel');
            for (const [lx, lz] of [[-5, -3], [0, -3], [-5, 3], [0, 3]]) B(lx, lz, 0.35, 2.7, 0.35, 3, 'post');
            B(-2.5, 0, 5.4, 0.3, 6.4, 5.7, accent);
            B(6.2, 0, 2, 1.5, 2, 0, 'wood'); B(1.2, 1.5, 2, 1.5, 2, 3, 'woodDark');
            pad(-2.5, 0, 4, 5, 6);
            break;
        }
        case 'lookout': {
            // small watchtower with stairs winding up the outside
            const s = [[0, 0], [1, 0], [1, 1], [0, 1]][rot];
            stairTower(cx, cz, 7.5, 4, s[0] ? 'steel' : 'concrete', rot, 'concreteDark');
            break;
        }
        case 'bunker': {
            // L-shaped walls with firing windows (cover you can peek through)
            const wallPiece = (lx, lz, w, d) => { B(lx, lz, w, 1.3, d, 0, 'concreteDark'); B(lx, lz, w, 1.2, d, 2.3, 'concreteDark'); };
            B(-5, -4, 2, 3.5, 1.2, 0, 'concrete'); wallPiece(-1, -4, 6, 1.2); B(3, -4, 2, 3.5, 1.2, 0, 'concrete');
            B(-5.4, -0.6, 1.2, 3.5, 2, 0, 'concrete'); wallPiece(-5.4, 2.4, 1.2, 4); B(-5.4, 5.2, 1.2, 3.5, 1.6, 0, 'concrete');
            B(-5, -4, 2.4, 0.3, 1.6, 3.5, accent);
            B(0.5, 1, 2, 1, 2, 0, 'sand');
            break;
        }
    }
}
