// ============================================================
// What is kept between visits: one key, 'steelstorm_remaster' (the launcher syncs keys that start with 'steelstorm_').
// v counts the shape: a newer game fills in what an older save lacks, it never wipes one.
// ============================================================
const Save = { KEY: 'steelstorm_remaster', data: null,
    fresh() { return { v: 2, intro: false, trained: false, rp: 0, cr: 0, own: { lt1: 1, mt1: 1, ht1: 1 }, res: {}, veh: 'mt1', mods: {}, settings: { sens: 1, adsSens: 1, fov: 66, sfx: 0.8, music: 0.5, aimToggle: true, quality: 'auto', shake: true, stats: false }, stats: { games: 0, kills: 0, bestWave: 0, bestScore: 0, shots: 0, hits: 0, battles: 0, wins: 0 } }; },
    load() {
        let d = null; try { d = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { }
        const f = this.fresh(); if (!d || typeof d !== 'object') d = f;
        for (const k in f) { if (d[k] === undefined) d[k] = f[k]; else if (f[k] && typeof f[k] === 'object') for (const j in f[k]) if (d[k][j] === undefined) d[k][j] = f[k][j]; }
        if (!d.look2) { d.look2 = 1; if (d.settings.fov === 58) d.settings.fov = 66; }      /* the camera moved back and the view widened (build 32): a setting nobody touched follows */
        this.data = d; return d;
    },
    store() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { } } };
Save.load();
