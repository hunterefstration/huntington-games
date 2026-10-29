// ==========================================
// ELEMENT LAB - reactions: built from data/reactions.tsv (columns: a b p ra rb heat pa pb tmin boom note)
//   a, b   element names, or #group (all elements in that group, unless the pair has its own row)
//   p      chance per contact; ra/rb  what a / b turn into (blank = unchanged, "empty" = gone)
//   heat   added to the new cells; pa/pb chance each one actually changes; tmin needs one of them this hot; boom blast radius
// Each row works in both directions, so "acid metal" also covers "metal acid".
// ==========================================
const RXI = new Int16Array(NE * NE).fill(-1);
const RXL = [];
const REACTIONS = [];
(function buildReactions() {
    let rows = [];
    try { rows = JSON.parse(document.getElementById('elementlab-data-reactions').textContent); } catch (e) { rows = []; }
    const members = s => s.charAt(0) === '#' ? (GROUPS[s.slice(1)] || []) : [nm(s)];
    const prod = v => v === '' || v === undefined ? -1 : v === 'empty' ? 0 : nm(v);
    const num = (v, d) => v === '' || v === undefined ? d : +v;
    const specific = new Set();
    rows.forEach(r => { if (r.a.charAt(0) !== '#' && r.b.charAt(0) !== '#') { specific.add(nm(r.a) * NE + nm(r.b)); specific.add(nm(r.b) * NE + nm(r.a)); } });
    function add(a, b, r) {
        const o = { p: +r.p, ra: prod(r.ra), rb: prod(r.rb), heat: num(r.heat, 0), pa: num(r.pa, 1), pb: num(r.pb, 1), tmin: num(r.tmin, -99999), boom: num(r.boom, 0), note: r.note };
        const k = a * NE + b;
        if (RXI[k] < 0) { RXI[k] = RXL.length; RXL.push([]); }
        RXL[RXI[k]].push(o);
    }
    rows.forEach(r => {
        const grp = r.a.charAt(0) === '#' || r.b.charAt(0) === '#';
        REACTIONS.push(r);
        members(r.a).forEach(a => members(r.b).forEach(b => {
            if (grp && specific.has(a * NE + b)) return;
            add(a, b, r);
            if (a !== b) add(b, a, { p: r.p, ra: r.rb, rb: r.ra, heat: r.heat, pa: r.pb, pb: r.pa, tmin: r.tmin, boom: r.boom, note: r.note });
        }));
    });
})();

// returns true when something happened. i = this cell, j = the neighbour in direction d
function react(i, j, x, y, d, list) {
    for (let q = 0; q < list.length; q++) {
        const r = list[q];
        if (rnd() >= r.p) continue;
        if (r.tmin > -99999 && (tp[i] > tp[j] ? tp[i] : tp[j]) < r.tmin) continue;
        const h = r.heat, xj = x + DX[d], yj = y + DY[d];
        if (r.ra >= 0 && (r.pa >= 1 || rnd() < r.pa)) { if (r.ra === 0) clr(i); else put(i, r.ra, h); } else if (h && el[i]) tp[i] += h;
        if (r.rb >= 0 && (r.pb >= 1 || rnd() < r.pb)) { if (r.rb === 0) clr(j); else put(j, r.rb, h); } else if (h && el[j]) tp[j] += h;
        if (tp[i] > 4000) tp[i] = 4000;
        if (tp[j] > 4000) tp[j] = 4000;
        if (tp[i] < -273) tp[i] = -273;
        if (tp[j] < -273) tp[j] = -273;
        wk(x, y); wk(xj, yj);
        if (r.ra === ID.steam || r.rb === ID.steam) sfx('sizzle', 0.7);
        if (r.note === 'infect') STAT.infected++;
        if (r.boom) { if (r.note === 'alkali') STAT.alk++; queueBoom(x, y, r.boom, 1, -1); }
        else if (r.note === 'alkali') STAT.alk++;
        return true;
    }
    return false;
}
