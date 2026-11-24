// ============================================================
// What is kept between visits. One key, 'ashfall_save' (the launcher syncs keys that start with 'ashfall_').
// v counts the shape: a newer game reads an older save and fills in what is missing, it never wipes one.
// ============================================================
const RANKS = ['Drifter', 'Scavenger', 'Runner', 'Lookout', 'Rifleman', 'Pointman', 'Sergeant', 'Warden', 'Vanguard', 'Ashwalker', 'Cinder Captain', 'Stormcaller', 'Last Light', 'Ember Lord', 'Ashfall Legend'];
const Save = { KEY: 'ashfall_save', data: null,
    fresh() { return { v: 1, intro: false, name: '', credits: 0, xp: 0, weapons: { carbine: { lvl: 0 }, pistol: { lvl: 0 } }, loadout: { primary: 'carbine', secondary: 'pistol', throw: 'frag' }, perk: 'none', own: { frag: 1, none: 1 }, mastery: {}, contracts: { day: '', list: [] }, ops: {}, cls: {}, prestige: 0, run: null,
        settings: { map: 'yard', light: 'map', sens: 1, adsSens: 1, fov: 72, sfx: 0.8, music: 0.6, aimToggle: true, quality: 'auto', shake: true, tips: true, stats: false, nums: true }, stats: { kills: 0, heads: 0, games: 0, best: {}, time: 0, mpWins: 0 }, seen: {} }; },
    load() {
        let d = null; try { d = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { }
        const f = this.fresh(); if (!d || typeof d !== 'object') d = f;
        // fill in anything a newer version added (one level deep is enough for this shape)
        for (const k in f) { if (d[k] === undefined) d[k] = f[k]; else if (f[k] && typeof f[k] === 'object' && !Array.isArray(f[k])) for (const j in f[k]) if (d[k][j] === undefined) d[k][j] = f[k][j]; }
        this.data = d; return d;
    },
    store() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { } },
    // rank from experience: each rank costs a little more than the one before
    rank(xp) { let r = 0, need = 400, left = xp === undefined ? this.data.xp : xp; while (left >= need && r < RANKS.length - 1) { left -= need; r++; need = Math.round(need * 1.28 + 150); } return { index: r, name: RANKS[r], into: left, need, frac: r === RANKS.length - 1 ? 1 : left / need }; },
    owns(id) { return !!this.data.weapons[id]; },
    level(id) { return this.data.weapons[id] ? this.data.weapons[id].lvl || 0 : 0; } };
Save.load();
