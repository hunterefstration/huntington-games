// ============================================================
// What is kept between visits: one key, 'nightline_save'. v counts the shape: a newer game reads an older save and fills
// in what is missing, it never wipes one. (For the launcher to sync it, gv/core.js GAME_KEYS needs 'nightline_': release.)
// ============================================================
const Save = { KEY: 'nightline_save', data: null,
    fresh() { return { v: 1, car: 'kite', paint: {}, cars: { kite: 1 }, best: {}, medals: {}, wins: 0, races: 0, podiums: 0, km: 0, seen: {},
        settings: { circuit: 'quay', laps: 3, level: 0, cam: 0, sfx: 0.8, quality: 'auto', stats: false, mph: false, shake: true } }; },
    load() {
        let d = null; try { d = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { }
        const f = this.fresh(); if (!d || typeof d !== 'object') d = f;
        for (const k in f) { if (d[k] === undefined) d[k] = f[k]; else if (f[k] && typeof f[k] === 'object' && !Array.isArray(f[k])) for (const j in f[k]) if (d[k][j] === undefined) d[k][j] = f[k][j]; }
        this.data = d; return d;
    },
    store() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { } },
    // the best lap and best race on a circuit in a car: best['quay|kite'] = { lap, race }
    best(circuit, car) { return this.data.best[circuit + '|' + car] || {}; },
    setBest(circuit, car, kind, t) { const k = circuit + '|' + car, b = this.data.best[k] || (this.data.best[k] = {}); if (!b[kind] || t < b[kind]) { b[kind] = +t.toFixed(3); return true; } return false; }
};
