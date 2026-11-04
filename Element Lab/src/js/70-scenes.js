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
// absolute layouts: drawn on a 160x90 base, bottom-centred on bigger grids
let OX = 0, OY = 0;
function base(w, h) { OX = Math.max(0, (W - w) >> 1); OY = Math.max(0, H - h); }
function A(x0, y0, x1, y1, name) { fillRect(OX + x0, OY + y0, OX + x1, OY + y1, name === 'empty' ? 0 : ID[name], true); }
function Ad(x0, y0, x1, y1, name, dir) { A(x0, y0, x1, y1, name); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(OX + x, OY + y)) life[ix(OX + x, OY + y)] = dir; }
function Ax(x0, y0, x1, y1, name, a) { A(x0, y0, x1, y1, name); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(OX + x, OY + y)) aux[ix(OX + x, OY + y)] = a; }
function Am(x0, y0, x1, y1, name, dir, a) { A(x0, y0, x1, y1, name); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(OX + x, OY + y)) { const i = ix(OX + x, OY + y); life[i] = dir; aux[i] = a; } }
function Ah(x, y) { const i = ix(OX + x, OY + y); if (inb(OX + x, OY + y) && el[i] === 0) setUser(i, ID.human); }
function ground(name, rows) { fillRect(0, H - rows, W - 1, H - 1, ID[name], true); }
// a 3x3 logic gate with a battery + switch on each input side and a light underneath
function gateDemo(cx, cy, gate, light, sides) {
    A(cx - 1, cy - 1, cx + 1, cy + 1, gate);
    if (sides.includes('L')) { A(cx - 20, cy, cx - 2, cy, 'wire'); A(cx - 22, cy, cx - 21, cy, 'switch'); A(cx - 25, cy - 1, cx - 23, cy + 1, 'battery'); }
    if (sides.includes('R')) { A(cx + 2, cy, cx + 20, cy, 'wire'); A(cx + 21, cy, cx + 22, cy, 'switch'); A(cx + 23, cy - 1, cx + 25, cy + 1, 'battery'); }
    if (sides.includes('T')) { A(cx, cy - 8, cx, cy - 2, 'wire'); A(cx, cy - 10, cx, cy - 9, 'switch'); A(cx - 1, cy - 13, cx + 1, cy - 11, 'battery'); }
    A(cx, cy + 2, cx, cy + 8, 'wire'); A(cx - 3, cy + 9, cx + 3, cy + 11, light);
}
const SCENES = {
    reactor: {
        label: 'Nuclear Reactor', desc: 'Water-moderated uranium core, steam rising through a turbine, power lighting a bank of bulbs. Erase control rods to run hotter, add rods to cool it.', build() {
            base(160, 90); ground('concrete', 4);
            A(40, 50, 100, 51, 'concrete'); A(64, 50, 76, 51, 'empty');                 // vessel lid with the steam outlet
            A(40, 50, 41, 85, 'concrete'); A(99, 50, 100, 85, 'concrete'); A(40, 84, 100, 85, 'concrete');
            A(42, 58, 98, 83, 'water');
            for (let k = 0; k < 7; k++) { const x = 45 + k * 8; A(x, 64, x + 1, 83, 'uranium'); }
            for (let k = 0; k < 6; k++) { const x = 49 + k * 8; A(x, 54, x + 1, 69, 'controlrod'); }
            A(56, 82, 56, 83, 'nsource'); A(88, 82, 88, 83, 'nsource');
            Am(41, 58, 41, 59, 'spout', 0, ID.water);   // keeps the water level up
            A(62, 31, 63, 51, 'concrete'); A(77, 31, 78, 51, 'concrete');               // chimney
            A(62, 30, 78, 30, 'turbine');
            A(50, 8, 51, 30, 'concrete'); A(89, 8, 90, 30, 'concrete'); A(50, 8, 90, 9, 'concrete');   // condenser hall
            A(52, 30, 61, 30, 'concrete'); A(79, 30, 88, 30, 'wire'); A(89, 30, 118, 30, 'wire');
            A(119, 25, 142, 31, 'lamp');
            A(77, 40, 77, 40, 'pressuresensor'); A(78, 40, 84, 40, 'wire'); A(85, 39, 86, 41, 'led_r');   // steam pressure alarm
            A(99, 70, 99, 70, 'heatsensor'); A(100, 70, 112, 70, 'wire'); A(113, 69, 114, 71, 'led_g');   // "boiling" light
        }
    },
    logic: {
        label: 'Logic Gates', desc: 'AND, OR, XOR and NOT gates with switches. Flip switches with the Hand tool (U) and watch the lights.', build() {
            base(160, 90); ground('wall', 3);
            gateDemo(40, 16, 'and_gate', 'lamp', 'LR');
            gateDemo(120, 16, 'or_gate', 'led_g', 'LR');
            gateDemo(40, 56, 'xor_gate', 'led_b', 'LR');
            gateDemo(120, 60, 'not_gate', 'led_r', 'T');
            A(76, 76, 84, 76, 'solar'); A(80, 77, 80, 80, 'wire'); A(77, 81, 83, 83, 'led_g');   // a solar panel in the open
            A(66, 30, 94, 30, 'glass');
        }
    },
    city: {
        label: 'City', desc: 'Houses with solar lights, a park, a pond and people walking about. Drop fire or lava near them and they run.', build() {
            const gy = H - 10;
            fillRect(0, gy, W - 1, H - 1, ID.dirt, true); fillRect(0, gy, W - 1, gy, ID.asphalt, true); fillRect(0, H - 3, W - 1, H - 1, ID.stone, true);
            const n = Math.max(3, Math.floor(W / 60)), span = Math.floor((W - 10) / n);
            for (let k = 0; k < n; k++) {
                const x0 = 6 + k * span, w = Math.min(span - 14, 30), h = Math.min(gy - 6, 22 + (k % 2) * 6);
                if (k === 1) {                     // the park: grass, trees, flowers and a pond
                    fillRect(x0, gy, x0 + span - 10, gy, ID.dirt, true); fillRect(x0, gy - 1, x0 + span - 10, gy - 1, ID.grass, true);
                    fillRect(x0 + 6, gy - 1, x0 + 18, gy + 4, 0, true); fillRect(x0 + 6, gy, x0 + 18, gy + 4, ID.water, true); fillRect(x0 + 5, gy + 5, x0 + 19, gy + 5, ID.stone, true);
                    setUser(ix(x0 + 10, gy + 2), ID.fish); setUser(ix(x0 + 14, gy + 3), ID.fish);
                    setUser(ix(x0 + 24, gy - 2), ID.sapling); setUser(ix(x0 + 32, gy - 2), ID.sapling); setUser(ix(x0 + 2, gy - 2), ID.sapling);
                    for (let q = 0; q < 4; q++) setUser(ix(x0 + 21 + q * 3, gy - 2), ID.flowerseed);
                    setUser(ix(x0 + 28, gy - 12), ID.bird); setUser(ix(x0 + 12, gy - 20), ID.bird);
                    continue;
                }
                fillRect(x0, gy - h, x0 + 1, gy - 1, ID.brick, true); fillRect(x0 + w - 1, gy - h, x0 + w, gy - 1, ID.brick, true);
                fillRect(x0 - 2, gy - h - 2, x0 + w + 2, gy - h - 1, ID.wood, true);
                fillRect(x0, gy - 3, x0 + 1, gy - 1, 0, true); fillRect(x0 + w - 1, gy - 3, x0 + w, gy - 1, 0, true);   // doors
                fillRect(x0, gy - h + 4, x0 + 1, gy - h + 6, ID.glass, true); fillRect(x0 + w - 1, gy - h + 4, x0 + w, gy - h + 6, ID.glass, true);
                const fl = gy - (h >> 1);                // upper floor, reached by one-cell steps
                fillRect(x0 + 2, fl, x0 + w - 2, fl, ID.wood, true);
                for (let s = 0; s < gy - fl - 1; s++) fillRect(x0 + w - 4 - s, gy - 1 - s, x0 + w - 4 - s, gy - 1, ID.wood, true);
                fillRect(x0 + w - 3 - (gy - fl - 1), fl, x0 + w - 2, fl, 0, true);
                const lx = x0 + (w >> 1);              // a light under the roof, fed by a solar panel on top
                fillRect(lx - 1, gy - h - 3, lx + 1, gy - h - 3, ID.solar, true); fillRect(lx, gy - h - 2, lx, gy - h - 1, ID.wire, true); fillRect(lx - 1, gy - h, lx + 1, gy - h, ID.lamp, true);
                for (let q = 0; q < 2; q++) { const hx = x0 + 4 + q * 7; setUser(ix(hx, gy - 1), ID.human); setUser(ix(hx + 2, fl - 1), ID.human); }
            }
            for (let q = 0; q < 5; q++) setUser(ix(Math.floor(W * (0.1 + q * 0.19)), gy - 1), ID.human);
        }
    },
    machines: {
        label: 'Factory', desc: 'Conveyor belt feeding ore into a furnace, a piston ram run by a NOT-gate clock, and a pump moving water through pipes.', build() {
            base(160, 90); ground('concrete', 4); A(0, 84, 159, 85, 'steel');
            // 1. ore hopper -> belt -> furnace -> molten copper -> cooling tray
            Ax(14, 40, 16, 40, 'clone', ID.copperore);
            A(4, 46, 6, 48, 'battery'); Ad(7, 47, 62, 47, 'conveyor', 0);
            A(58, 50, 59, 70, 'brick'); A(76, 50, 77, 70, 'brick'); A(58, 71, 77, 72, 'brick'); A(60, 70, 73, 70, 'furnace');
            A(61, 71, 61, 72, 'tungsten'); A(60, 73, 62, 74, 'battery');
            A(74, 70, 75, 72, 'empty');                                     // the tap hole
            A(68, 75, 100, 76, 'steel'); A(68, 73, 68, 74, 'steel'); A(100, 73, 100, 74, 'steel'); A(80, 77, 92, 77, 'freezer');
            // 2. a sand hopper and a piston ram on a NOT-gate clock (a NOT gate feeding itself flips every pass)
            Ax(110, 50, 114, 50, 'clone', ID.sand);
            A(106, 56, 108, 64, 'steel'); A(116, 56, 118, 64, 'steel');
            A(100, 62, 100, 62, 'not_gate'); A(100, 63, 103, 63, 'wire'); A(101, 62, 101, 62, 'wire'); A(103, 64, 103, 64, 'wire');
            Ad(103, 65, 103, 65, 'piston', 0);
            A(104, 66, 118, 66, 'steel'); Ad(119, 66, 150, 66, 'conveyor', 0); A(130, 67, 132, 69, 'battery');
            A(151, 70, 151, 83, 'glass'); A(159, 70, 159, 83, 'glass');
            // 3. pump: tank -> pipe -> tank
            A(4, 66, 4, 83, 'glass'); A(30, 66, 30, 83, 'glass'); A(5, 70, 29, 83, 'water');
            Ad(17, 82, 17, 82, 'pump', 3); A(16, 82, 16, 82, 'battery'); A(18, 82, 18, 82, 'battery');
            A(17, 50, 17, 81, 'pipe'); A(16, 68, 16, 81, 'steel'); A(18, 68, 18, 81, 'steel'); A(18, 50, 44, 50, 'pipe'); A(44, 51, 44, 62, 'pipe');
            A(36, 66, 36, 83, 'glass'); A(52, 66, 52, 83, 'glass');
        }
    },
    chem: {
        label: 'Chemistry Set', desc: 'Vinegar and baking soda fizz, copper sulfate crystals grow on a heater, acid eats zinc, milk curdles, a Bunsen burner boils water.', build() {
            base(160, 90); ground('wall', 3); A(0, 80, 159, 81, 'wood'); A(0, 82, 159, 86, 'wood');
            const beaker = (x0, w, top, fill, what) => { A(x0, top, x0, 79, 'glass'); A(x0 + w, top, x0 + w, 79, 'glass'); A(x0, 79, x0 + w, 79, 'glass'); if (what) A(x0 + 1, fill, x0 + w - 1, 78, what); };
            beaker(6, 16, 56, 66, 'vinegar'); A(9, 50, 18, 53, 'bakingsoda');
            beaker(28, 16, 56, 62, 'cuso4sol'); A(28, 79, 44, 79, 'eheater'); A(26, 79, 27, 80, 'battery'); A(29, 64, 30, 66, 'cuso4crystal');
            beaker(50, 16, 56, 64, 'acid'); A(55, 72, 59, 78, 'zinc');
            beaker(72, 16, 56, 64, 'milk'); A(76, 50, 82, 52, 'vinegar'); A(75, 53, 83, 53, 'paper');
            beaker(94, 14, 50, 62, 'water'); A(96, 80, 106, 80, 'torch'); A(94, 79, 108, 79, 'metal');
            beaker(116, 18, 56, 64, 'saltwater'); A(121, 70, 128, 78, 'iron');
            A(140, 70, 156, 79, 'stone'); A(143, 66, 150, 69, 'thermite'); A(152, 67, 155, 69, 'sodium');
            A(6, 30, 40, 31, 'glass'); A(12, 24, 34, 29, 'copper'); A(8, 24, 10, 29, 'tin');
            A(44, 30, 70, 31, 'steel'); A(46, 22, 68, 29, 'salt');
        }
    },
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
        label: 'Demolition Yard', desc: 'Wires, a lamp, TNT, C4, nitro and oil. Trigger it with fire or a spark.', build() {
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
