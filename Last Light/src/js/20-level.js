// ==========================================
// LEVELS: the ASCII maps in 70-levels.js become a tile grid plus things that move.
//   #  ground          =  one-way ledge        ^  spikes (they point away from the ground they sit on)
//   l  lava            B  dark wall behind you C  crumbling block      D  door (opens with a key)
//   P  start           E  exit gate            L  lantern (checkpoint) o  spark   *  star (3 per level)
//   S  spring          k  key                  u  shrine (teaches the world's new move)
//   g  slime           b  bat                  t  flower turret        h  thornback (spiky: do not stomp)
//   M  moving ledge, left/right (runs between walls or '|' markers)    N  moving ledge, up/down (between '|' markers)
//   G  The Gloom (the last boss)  Q  the world's guardian (mini boss: def.guard says which)  r  a memory (lore)
// ==========================================
const T_AIR = 0, T_SOLID = 1, T_ONEWAY = 2, T_SPIKE = 3, T_LAVA = 4, T_BACK = 5;

function parseLevel(def) {
    const rows = def.map.slice(), h = rows.length, w = Math.max(...rows.map(r => r.length));
    const L = { def, w, h, world: def.world, tiles: new Uint8Array(w * h), spikes: [], lava: [], ents: [], crumbles: [], doors: [], movers: [],
        sparks: 0, moths: 0, start: null, marks: new Set() };
    const at = (x, y) => (rows[y] || '')[x] || ' ';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const c = at(x, y), px = x * TS + TS / 2, py = y * TS + TS / 2;
        const set = v => { L.tiles[y * w + x] = v; };
        switch (c) {
            case '#': set(T_SOLID); break;
            case '=': set(T_ONEWAY); break;
            case '^': set(T_SPIKE); break;
            case 'l': set(T_LAVA); break;
            case 'B': set(T_BACK); break;
            case '|': L.marks.add(y * w + x); break;
            case 'P': L.start = { x: px, y: py }; break;
            case 'C': L.crumbles.push({ tx: x, ty: y, x: x * TS, y: y * TS, state: 0, t: 0, alpha: 1 }); break;
            case 'D': {
                const above = L.doors.find(d => d.tx === x && d.ty + d.h === y);
                if (above) above.h++; else L.doors.push({ tx: x, ty: y, x: x * TS, y: y * TS, h: 1, open: false, slide: 0 });
                break;
            }
            case 'M': case 'N': {
                // a run of M's is one ledge
                if (at(x - 1, y) === c) break;
                let n = 1; while (at(x + n, y) === c) n++;
                L.movers.push({ kind: c, tx: x, ty: y, x: x * TS, y: y * TS, w: n * TS, h: 14, vx: 0, vy: 0, dx: 0, dy: 0, dir: 1, speed: c === 'M' ? 70 : 60 });
                break;
            }
            default:
                if ('oEL*SkubgthGQr'.includes(c)) {
                    const kind = { o: 'spark', E: 'gate', L: 'lantern', '*': 'moth', S: 'spring', k: 'key', u: 'shrine', g: 'slime', b: 'bat', t: 'turret', h: 'thorn', G: 'boss', Q: 'guard', r: 'memory' }[c];
                    L.ents.push({ kind, x: px, y: py, sx: px, sy: py, seed: (x * 7919 + y * 104729) % 1000 / 100 });
                    if (c === 'o') L.sparks++;
                    if (c === '*') L.moths++;
                }
        }
    }
    if (!L.start) L.start = { x: TS * 2, y: TS * 2 };
    // moving ledges: work out how far each one travels
    for (const m of L.movers) {
        if (m.kind === 'M') {
            let a = m.tx, b = m.tx + m.w / TS - 1;
            while (a > 0 && !L.marks.has(m.ty * w + a - 1) && tileAt(L, a - 1, m.ty) === T_AIR) a--;
            while (b < w - 1 && !L.marks.has(m.ty * w + b + 1) && tileAt(L, b + 1, m.ty) === T_AIR) b++;
            m.min = a * TS; m.max = (b + 1) * TS - m.w;
        } else {
            let a = m.ty, b = m.ty;
            while (a > 0 && !L.marks.has((a - 1) * w + m.tx) && tileAt(L, m.tx, a - 1) === T_AIR) a--;
            while (b < h - 1 && !L.marks.has((b + 1) * w + m.tx) && tileAt(L, m.tx, b + 1) === T_AIR) b++;
            m.min = a * TS; m.max = b * TS;
        }
    }
    // spikes point away from the ground they are fixed to
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const t = L.tiles[y * w + x];
        if (t === T_SPIKE) {
            const s = isSolidT(L, x, y + 1) ? 0 : isSolidT(L, x, y - 1) ? Math.PI : isSolidT(L, x - 1, y) ? Math.PI / 2 : isSolidT(L, x + 1, y) ? -Math.PI / 2 : 0;
            L.spikes.push({ tx: x, ty: y, rot: s });
        } else if (t === T_LAVA) L.lava.push({ tx: x, ty: y, top: tileAt(L, x, y - 1) !== T_LAVA });
    }
    return L;
}
const tileAt = (L, x, y) => (x < 0 || x >= L.w) ? T_SOLID : (y < 0) ? T_AIR : (y >= L.h) ? T_AIR : L.tiles[y * L.w + x];
const isSolidT = (L, x, y) => tileAt(L, x, y) === T_SOLID;
// what counts as ground for drawing (the level's edges look like solid rock)
const solidForArt = L => (x, y) => x < 0 || x >= L.w || (y >= 0 && y < L.h && L.tiles[y * L.w + x] === T_SOLID);

// ---------- collision against tiles + doors + crumbling blocks ----------
function solidAtPx(L, px, py) {
    const tx = Math.floor(px / TS), ty = Math.floor(py / TS);
    if (tileAt(L, tx, ty) === T_SOLID) return true;
    for (const c of L.crumbles) if (c.state < 3 && c.tx === tx && c.ty === ty) return true;
    for (const d of L.doors) if (!d.open && d.tx === tx && ty >= d.ty && ty < d.ty + d.h) return true;
    return false;
}
// does the box overlap anything solid?
function boxSolid(L, x, y, w, h) {
    const x0 = Math.floor(x / TS), x1 = Math.floor((x + w - 0.01) / TS), y0 = Math.floor(y / TS), y1 = Math.floor((y + h - 0.01) / TS);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solidAtPx(L, tx * TS + 1, ty * TS + 1)) return true;
    return false;
}
// one-way ledges and moving ledges only hold you from above
function ledgeBelow(L, x, w, yOld, yNew) {
    let best = null;
    const x0 = Math.floor(x / TS), x1 = Math.floor((x + w - 0.01) / TS);
    const ty0 = Math.floor(yOld / TS), ty1 = Math.floor(yNew / TS);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = x0; tx <= x1; tx++)
        if (tileAt(L, tx, ty) === T_ONEWAY) { const top = ty * TS; if (yOld <= top + 0.01 && yNew >= top && (best === null || top < best.y)) best = { y: top }; }
    for (const m of L.movers) if (x + w > m.x && x < m.x + m.w && yOld <= m.y + 0.01 && yNew >= m.y && (best === null || m.y < best.y)) best = { y: m.y, mover: m };
    return best;
}
