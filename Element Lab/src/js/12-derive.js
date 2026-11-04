// ==========================================
// ELEMENT LAB - lookup tables derived from the element table (one typed array per property)
// ==========================================
const NE = DEFS.length;
const ID = {};
DEFS.forEach((d, i) => { ID[d.name] = i; });
const KIND = new Uint8Array(NE), FLUID = new Uint8Array(NE), DENS = new Float32Array(NE);
const HI = new Int16Array(NE).fill(32767), HIE = new Uint16Array(NE), HIA = new Uint16Array(NE), HIAP = new Float32Array(NE);
const LO = new Int16Array(NE).fill(-32768), LOE = new Uint16Array(NE), LOA = new Uint16Array(NE), LOAP = new Float32Array(NE);
const TINIT = new Int16Array(NE).fill(AMB), COND = new Float32Array(NE), COOL = new Float32Array(NE);
const IGN = new Int16Array(NE), BIGN = new Float32Array(NE), BLIFE = new Uint8Array(NE), BTEMP = new Int16Array(NE), BPROD = new Uint16Array(NE);
const FLAM = new Float32Array(NE), BOOM = new Uint8Array(NE), BDELAY = new Uint8Array(NE), HARD = new Float32Array(NE);
const RUB = new Uint16Array(NE), UNB = new Uint8Array(NE), MOVEP = new Float32Array(NE), DISP = new Uint8Array(NE), SLIDE = new Float32Array(NE);
const L0 = new Uint8Array(NE), L1 = new Uint8Array(NE), AUX0 = new Uint16Array(NE), AWAKE = new Uint8Array(NE), LEAK = new Uint8Array(NE);
const SELF = new Uint8Array(NE), GLR = new Uint8Array(NE), GLG = new Uint8Array(NE), GLB = new Uint8Array(NE), GLS = new Uint8Array(NE);
const CONDUCT = new Uint8Array(NE), DOUSE = new Uint8Array(NE), ALPHA = new Float32Array(NE), VARY = new Float32Array(NE);
// 2.0
const ELC = new Uint8Array(NE);                    // 1 conductor, 2 source, 3 device, 4 gate, 5 sensor, 6 switch
const E_C = 1, E_SRC = 2, E_DEV = 3, E_GATE = 4, E_SENSOR = 5, E_SWITCH = 6;
const FIS = new Float32Array(NE), MOD = new Uint8Array(NE), ABSN = new Float32Array(NE), REFL = new Uint8Array(NE), RADN = new Float32Array(NE);
const DIRL = new Uint8Array(NE), HIDE = new Uint8Array(NE), DANGER = new Uint8Array(NE), BURST = new Uint8Array(NE);
const DECP = new Float32Array(NE), DECE = new Uint16Array(NE), CLEAR = new Uint8Array(NE), ORGANIC = new Uint8Array(NE), LIVING = new Uint8Array(NE);
const GROUPS = {};
const nm = n => { if (!(n in ID)) throw new Error('unknown element ' + n); return ID[n]; };
const ELCODE = { c: E_C, src: E_SRC, dev: E_DEV, gate: E_GATE, sensor: E_SENSOR, 'switch': E_SWITCH };
DEFS.forEach((d, e) => {
    KIND[e] = d.kind; FLUID[e] = d.kind === K.LIQUID || d.kind === K.GAS ? 1 : 0;
    DENS[e] = d.dens !== undefined ? d.dens : 5000;
    if (d.hi) { HI[e] = d.hi[0]; HIE[e] = nm(d.hi[1]); if (d.hi[2]) { HIA[e] = nm(d.hi[2]); HIAP[e] = d.hi[3]; } }
    if (d.lo) { LO[e] = d.lo[0]; LOE[e] = nm(d.lo[1]); if (d.lo[2]) { LOA[e] = nm(d.lo[2]); LOAP[e] = d.lo[3]; } }
    if (d.ti !== undefined) TINIT[e] = d.ti;
    const gas = d.kind === K.GAS;
    COND[e] = d.cond !== undefined ? d.cond : gas ? .12 : .1;
    COOL[e] = d.cool !== undefined ? d.cool : gas ? .1 : .03;
    if (d.ign) { IGN[e] = d.ign; BIGN[e] = d.ip !== undefined ? d.ip : .3; }
    if (d.burn) { BLIFE[e] = d.burn[0]; BTEMP[e] = d.burn[1]; BPROD[e] = d.burn[2] === 'empty' ? 0 : nm(d.burn[2]); }
    FLAM[e] = d.flam || 0; BOOM[e] = d.boom || 0; BDELAY[e] = d.bd || 1; HARD[e] = d.hard || 0;
    RUB[e] = d.rub ? nm(d.rub) : 0; UNB[e] = d.unb ? 1 : 0;
    MOVEP[e] = d.mv !== undefined ? d.mv : gas ? .85 : 1;
    DISP[e] = d.disp || 3; SLIDE[e] = d.slide !== undefined ? d.slide : 1;
    if (d.life) { L0[e] = d.life[0]; L1[e] = d.life[1]; }
    AUX0[e] = d.aux0 || 0;
    AWAKE[e] = d.awake || gas || d.dec || d.rad ? 1 : 0; LEAK[e] = d.leak !== undefined ? d.leak : 1;
    SELF[e] = d.self ? 1 : 0;
    if (d.glow) { GLR[e] = d.glow[0]; GLG[e] = d.glow[1]; GLB[e] = d.glow[2]; GLS[e] = d.glow[3]; }
    ALPHA[e] = d.alpha !== undefined ? d.alpha : gas ? .45 : 1;
    VARY[e] = d.var !== undefined ? d.var : .06;
    if (d.elc) ELC[e] = ELCODE[d.elc];
    FIS[e] = d.fis || 0; MOD[e] = d.mod ? 1 : 0; REFL[e] = d.refl ? 1 : 0; RADN[e] = d.rad || 0;
    ABSN[e] = d.abs !== undefined ? d.abs : d.kind === K.SOLID ? .12 : d.kind === K.POWDER ? .08 : d.kind === K.LIQUID ? .04 : d.kind === K.CREATURE ? .1 : 0;
    DIRL[e] = d.dir ? 1 : 0; HIDE[e] = d.hide ? 1 : 0; DANGER[e] = d.danger ? 1 : 0; BURST[e] = d.burst || 0; CLEAR[e] = d.clear ? 1 : 0;
    if (d.dec) { DECP[e] = d.dec[0]; DECE[e] = d.dec[1] === 'empty' ? 0 : nm(d.dec[1]); }
    (d.g || []).forEach(g => { (GROUPS[g] = GROUPS[g] || []).push(e); });
});
for (let e = 1; e < NE; e++) if (ELC[e] === E_C || ELC[e] === E_DEV) CONDUCT[e] = 1;
(GROUPS.douse || []).forEach(e => { DOUSE[e] = 1; });
(GROUPS.organic || []).forEach(e => { ORGANIC[e] = 1; });
(GROUPS.living || []).forEach(e => { LIVING[e] = 1; });
(GROUPS.molten || []).forEach(e => { DANGER[e] = 1; });
const WALL = ID.wall;
// an element's colour as css, for the palette chips
const cssCol = e => { const c = DEFS[e].col; return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; };
