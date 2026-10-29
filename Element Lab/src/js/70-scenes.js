// ==========================================
// ELEMENT LAB - preset scenes (all positions are fractions of the grid, so every quality level looks the same)
// ==========================================
const fx_ = f => Math.round(f * (W - 1)), fy_ = f => Math.round(f * (H - 1));
function Rf(x0, y0, x1, y1, name) { fillRect(fx_(x0), fy_(y0), fx_(x1), fy_(y1), ID[name], true); }
function Sc(x0, y0, x1, y1, name, prob, aux0) {      // scatter
    for (let y = fy_(y0); y <= fy_(y1); y++) for (let x = fx_(x0); x <= fx_(x1); x++) {
        if (rnd() > prob) continue;
        const i = ix(x, y); if (el[i] !== 0) continue;
        setUser(i, ID[name]); if (aux0) aux[i] = aux0;
    }
}
function Pt(x, y, name) { const i = ix(fx_(x), fy_(y)); setUser(i, ID[name]); }
const SCENES = {
    volcano: {
        label: 'Volcano', desc: 'A lava fountain, an ocean and some plants.', build() {
            Rf(0, 0.9, 1, 1, 'stone'); Rf(0, 0.86, 1, 0.9, 'dirt');
            for (let x = 0; x < W; x++) {
                const u = x / (W - 1);
                if (u > 0.26 && u < 0.74) { const h = (1 - Math.abs(u - 0.5) / 0.24) * 0.46; fillRect(x, fy_(0.9 - h), x, fy_(0.9), ID.stone, true); }
            }
            const top = fy_(0.9 - 0.46) - 1;            // the peak: lava faucets sit on it and run down the sides
            for (let k = -2; k <= 2; k += 2) { const i = ix(fx_(0.5) + k, top); setUser(i, ID.clone); aux[i] = ID.lava; setUser(i - P, ID.lava); }
            Rf(0, 0.78, 0.19, 0.86, 'water'); Rf(0.19, 0.78, 0.215, 0.86, 'stone'); Rf(0, 0.74, 0.19, 0.78, 'empty');
            Sc(0.78, 0.8, 0.98, 0.86, 'seed', 0.15);
        }
    },
    forest: {
        label: 'Rain Forest', desc: 'Clouds, rain, seeds and a few ants and fish.', build() {
            Rf(0, 0.84, 1, 1, 'dirt'); Rf(0.35, 0.8, 0.55, 0.9, 'empty'); Rf(0.35, 0.86, 0.55, 0.9, 'water'); Rf(0.36, 0.82, 0.54, 0.86, 'water');
            Rf(0.35, 0.9, 0.55, 0.92, 'stone');
            Sc(0.02, 0.83, 0.33, 0.83, 'seed', 0.2); Sc(0.57, 0.83, 0.98, 0.83, 'seed', 0.2);
            Sc(0.1, 0.05, 0.9, 0.08, 'cloud', 0.4, 6);
            for (let k = 0; k < 6; k++) { Pt(0.05 + k * 0.05, 0.82, 'ant'); Pt(0.6 + k * 0.05, 0.82, 'ant'); }
            for (let k = 0; k < 14; k++) Pt(0.05 + rnd() * 0.9, 0.5 + rnd() * 0.3, 'firefly');
            Pt(0.4, 0.86, 'fish'); Pt(0.46, 0.84, 'fish'); Pt(0.5, 0.88, 'fish');
        }
    },
    factory: {
        label: 'Factory', desc: 'Wires, a lamp, TNT, C4, nitro and oil. Trigger it with fire or a spark.', build() {
            Rf(0, 0.93, 1, 1, 'stone'); Rf(0, 0.92, 1, 0.93, 'metal');
            Rf(0.06, 0.8, 0.1, 0.91, 'battery'); Rf(0.1, 0.85, 0.5, 0.855, 'metal'); Rf(0.28, 0.82, 0.31, 0.85, 'lamp');
            Rf(0.5, 0.78, 0.62, 0.92, 'tnt'); Rf(0.62, 0.84, 0.68, 0.92, 'c4');
            Rf(0.7, 0.62, 0.71, 0.92, 'metal'); Rf(0.84, 0.62, 0.85, 0.92, 'metal'); Rf(0.7, 0.92, 0.85, 0.93, 'metal');
            Rf(0.71, 0.7, 0.84, 0.92, 'oil'); Rf(0.71, 0.62, 0.84, 0.64, 'gunpowder');
            Rf(0.85, 0.915, 0.97, 0.92, 'fuse'); Rf(0.86, 0.9, 0.97, 0.915, 'gunpowder');
            Rf(0.2, 0.62, 0.45, 0.635, 'metal'); Rf(0.28, 0.5, 0.36, 0.62, 'nitro'); Rf(0.27, 0.5, 0.275, 0.62, 'glass'); Rf(0.365, 0.5, 0.37, 0.62, 'glass');
            Rf(0.28, 0.495, 0.36, 0.5, 'glass');
            Rf(0.88, 0.6, 0.96, 0.75, 'wood');
            Rf(0.1, 0.62, 0.14, 0.78, 'methane');
        }
    },
    lab: {
        label: 'Lab', desc: 'Beakers of acid, water, oil and mercury, a heater and a lump of sodium.', build() {
            Rf(0, 0.9, 1, 1, 'stone'); Rf(0.03, 0.78, 0.97, 0.82, 'metal'); Rf(0.06, 0.82, 0.08, 0.9, 'metal'); Rf(0.92, 0.82, 0.94, 0.9, 'metal');
            Rf(0.28, 0.76, 0.4, 0.78, 'heater');
            const wl = (x0, liquid) => { Rf(x0, 0.58, x0 + 0.015, 0.76, 'glass'); Rf(x0 + 0.1, 0.58, x0 + 0.115, 0.76, 'glass'); Rf(x0, 0.75, x0 + 0.115, 0.76, 'glass'); Rf(x0 + 0.015, 0.64, x0 + 0.1, 0.75, liquid); };
            wl(0.1, 'acid'); wl(0.27, 'water'); wl(0.46, 'oil'); wl(0.63, 'mercury');
            Rf(0.3, 0.64, 0.33, 0.67, 'ice');
            Rf(0.82, 0.74, 0.88, 0.78, 'freezer');
            Rf(0.28, 0.5, 0.31, 0.53, 'sodium'); Rf(0.49, 0.5, 0.52, 0.53, 'potassium');
            Rf(0.12, 0.7, 0.14, 0.73, 'stone');
            Sc(0.1, 0.45, 0.18, 0.55, 'hydrogen', 0.2); Rf(0.74, 0.7, 0.78, 0.78, 'wood');
        }
    }
};
function loadScene(name) {
    const s = SCENES[name]; if (!s) return false;
    pushUndo(); clearGrid(); flashes.length = 0; s.build(); wakeAll();
    return true;
}
