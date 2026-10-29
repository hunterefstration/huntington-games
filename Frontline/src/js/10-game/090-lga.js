// ---------------- 3.0 Iron Legion models: gunmetal armor, glowing Embercore cyan, team colour on shoulders and stripes ----------------
const LGA = 0x4a5260, LGB = 0x3a414c, LGC = 0x2c323b, LGK = 0x22262c, CYN = 0x59d8ff, CYB = 0x9ff0ff;
function buildLegionModels() {
  const lgInf = o => infModel(Object.assign({ vest: LGA, rig: LGC, pants: LGC, skin: LGK, sleeve: LGB, gc: LGK, hat: 'lg', pack: 'cell', gun: 'pulse' }, o));
  MDL.legionary = lgInf({ extra: g => { g.box(.1, .07, .22, -.42, 1.0, .22, CYN); g.box(.5, .05, .02, 0, 1.3, .18, CYN); } });                 // shield emitter on the forearm, glowing chest seam
  MDL.lancer = lgInf({ gun: 'lance', vest: 0x515a66, extra: g => { g.box(.5, .05, .02, 0, 1.3, .18, CYN); } });
  MDL.technician = lgInf({ gun: 'tool', vest: 0x5a5f66, rig: 0x8a5a2a, hc: 0, hat: 'lg', helm: 0xc8782a, pack: 'tools2', extra: g => { g.box(.68, .05, .42, 0, 1.3, 0, 0xc8782a); g.box(.07, .3, .07, -.42, .84, .12, STEEL); g.box(.12, .08, .08, -.42, .68, .12, CYN); } });
  MDL.jumptrooper = lgInf({ pack: 'jet', w: .95, vest: 0x56606e, extra: g => { for (const x of [-.15, .15]) g.box(.27, .2, .3, x, .66, .08, LGB); g.box(.5, .05, .02, 0, 1.3, .18, CYN); } });
  MDL.shredder = lgInf({ gun: 'rotary', w: 1.18, vest: 0x3f4652, extra: g => { for (const s of [-1, 1]) g.box(.3, .2, .44, s * .44, 1.5, 0, LGB); g.box(.6, .06, .02, 0, 1.28, .2, CYN); } });
  MDL.railgunner = lgInf({ gun: 'rail', vest: 0x434b57, helm: 0x2c323b, extra: g => { g.box(.08, .08, .12, .13, 1.74, .2, CYB); } });
  MDL.nanomedic = lgInf({ vest: 0xd8dee6, rig: 0xaab3bd, pants: 0x5a636e, sleeve: 0xc4cbd3, helm: 0xe6eaee, gun: 'tool', pack: 'nano', extra: g => { g.box(.22, .07, .02, 0, 1.24, .215, CYN); g.box(.07, .22, .02, 0, 1.24, .215, CYN); } });
  MDL.arctrooper = lgInf({ gun: 'arc', pack: 'coil', vest: 0x4d4f52, rig: 0x3a3226, extra: g => { g.box(.5, .05, .02, 0, 1.3, .18, 0xb0763a); } });
  MDL.praetorian = lgInf({ hat: 'lgcrest', w: 1.12, vest: 0x2c323b, rig: 0x1f2328, sleeve: 0x2c323b, gun: 'rotary', extra: g => { g.box(.36, .5, .03, 0, .95, .2, 0, { acc: 1 }); for (const s of [-1, 1]) g.box(.32, .22, .46, s * .46, 1.5, 0, LGA); g.box(.12, .08, .26, -.45, 1.0, .24, CYN); } });
  MDL.plasmortar = lgInf({ gun: 'pmortar', vest: 0x4b525c, pack: 'cell', extra: g => { g.box(.5, .05, .02, 0, 1.3, .18, CYN); for (const x of [-.12, .12]) g.cyl(.06, .06, .26, 6, x, 1.5, -.3, CYB); } });   // spare plasma cells on the back
  { // Servitor: four-legged repair robot with a welding arm
    const g = new GB(); g.box(.7, .38, .8, 0, .7, 0, LGB); dome(g, .32, .22, .36, 0, .89, -.02, LGA); g.box(.5, .05, .5, 0, 1.0, -.05, 0, { acc: 1 }); g.box(.22, .1, .05, 0, .78, .41, CYN);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { strut(g, sx * .3, .7, sz * .3, sx * .6, .85, sz * .55, .08, .08, LGA); strut(g, sx * .6, .85, sz * .55, sx * .72, .02, sz * .66, .07, .07, LGK); }
    strut(g, .25, .85, .3, .45, 1.15, .6, .08, .08, LGA); strut(g, .45, 1.15, .6, .4, .85, .95, .07, .07, LGA); ball(g, .06, .06, .06, .4, .82, .98, 0xff8a3a); g.box(.3, .25, .3, -.15, .98, -.3, LGC); g.box(.04, .5, .04, -.25, 1.3, -.35, BLACK);
    MDL.servitor = [part(g, 'aim')];
  }
  // legs: biped (thigh forward, shin back) and four-legged spider legs; the torso / gun deck is the turret part
  const leg2 = (g, x, hipY, kneeY, kneeZ, footZ, tw, sw, fw, fl) => { strut(g, x, hipY, 0, x * 1.06, kneeY, kneeZ, tw, tw * 1.08, LGA); ball(g, tw * .62, tw * .62, tw * .62, x * 1.06, kneeY, kneeZ, LGK); strut(g, x * 1.06, kneeY, kneeZ, x * 1.06, fw * .5, footZ, sw, sw, LGB); g.box(fw, fw * .38, fl, x * 1.06, fw * .19, footZ + fl * .12, LGK); };
  const leg4 = (g, bx, by, bz, kx, ky, kz, fx, fz, w) => { strut(g, bx, by, bz, kx, ky, kz, w, w, LGA); ball(g, w * .75, w * .75, w * .75, kx, ky, kz, LGK); strut(g, kx, ky, kz, fx, .2, fz, w * .85, w * .85, LGB); g.box(w * 1.7, w * .7, w * 1.7, fx, w * .35, fz, LGK); };
  { // Strider: quick two-legged scout walker, cockpit pod with twin pulse guns
    const g = new GB(); g.box(1.0, .45, .8, 0, 2.45, 0, LGC); g.box(.5, .08, .5, 0, 2.7, 0, 0, { acc: .9 });
    for (const s of [-1, 1]) { leg2(g, s * .55, 2.4, 1.4, .45, -.25, .32, .26, .46, .8); g.box(.06, .06, .06, s * .66, 2.45, .3, CYN); }
    const t = new GB(); t.box(1.05, .62, 1.4, 0, .28, -.05, LGA); wedge(t, 1.05, .45, .6, 0, .18, .95, LGA, { ry: PI }); t.box(1.07, .07, 1.0, 0, .62, -.15, 0, { acc: .95 }); t.box(.8, .16, .05, 0, .42, .66, CYN);
    for (const s of [-1, 1]) { t.box(.14, .14, .6, s * .62, .18, .4, LGK); rod(t, .045, 6, s * .62, .18, .6, s * .62, .18, 1.25, LGB); ball(t, .06, .06, .06, s * .62, .18, 1.28, CYB); }
    t.box(.03, .9, .03, -.35, 1.0, -.55, BLACK);
    MDL.strider = [part(g), part(t, 'turret', 0, 2.62, 0)];
  }
  { // Combat Mech: armored biped, pulse gatling on the right arm, plasma launcher on the left
    const g = new GB(); g.box(1.5, .55, 1.0, 0, 2.95, 0, LGC);
    for (const s of [-1, 1]) { leg2(g, s * .72, 2.9, 1.6, .4, -.15, .48, .4, .66, 1.1); g.box(.5, .5, .1, s * .8, 2.25, .47, 0, { acc: .85, rx: -.3 }); }
    const t = new GB(); t.box(1.9, 1.2, 1.4, 0, .55, -.05, LGA); wedge(t, 1.9, .7, .5, 0, .35, .9, LGA, { ry: PI }); t.box(1.92, .12, 1.3, 0, 1.17, -.1, 0, { acc: 1 }); t.box(1.0, .22, .06, 0, .78, .66, CYN);
    for (const s of [-1, 1]) t.box(.7, .55, .9, s * 1.25, .85, -.05, LGB);
    t.box(.5, .5, 1.1, 1.25, .35, .5, LGK); for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + .4; rod(t, .05, 5, 1.25 + Math.cos(a) * .1, .35 + Math.sin(a) * .1, 1.0, 1.25 + Math.cos(a) * .1, .35 + Math.sin(a) * .1, 1.6, LGB); } t.cyl(.15, .15, .05, 8, 1.25, .35, 1.62, CYN, { rx: PI / 2 });
    t.box(.5, .55, 1.0, -1.25, .35, .45, LGK); t.cyl(.16, .16, .7, 8, -1.25, .35, 1.1, LGB, { rx: PI / 2 }); t.cyl(.13, .13, .06, 8, -1.25, .35, 1.47, CYN, { rx: PI / 2 });
    t.box(1.1, .8, .5, 0, .65, -.95, LGK); t.box(.7, .4, .03, 0, .7, -1.21, CYN); t.box(.03, 1.2, .03, -.6, 1.7, -.6, BLACK);
    MDL.combatmech = [part(g), part(t, 'turret', 0, 3.25, 0)];
  }
  { // Hover Tank: sleek wedge hull on four glowing hover pads, plasma cannon with coils
    const g = new GB(); g.box(2.3, .55, 4.0, 0, 1.0, -.1, LGA); wedge(g, 2.3, .5, 1.1, 0, .98, 2.45, LGA, { ry: PI }); g.box(1.9, .3, 3.4, 0, .62, -.1, LGC);
    for (const s of [-1, 1]) { g.box(.22, .55, 3.7, s * 1.24, .85, -.1, LGB); g.box(.04, .16, 3.3, s * 1.36, 1.05, -.1, 0, { acc: .9 }); for (const z of [-1.3, 1.1]) { g.cyl(.42, .5, .14, 10, s * .9, .45, z, LGK); g.cyl(.36, .36, .05, 10, s * .9, .37, z, CYN); } g.box(.2, .1, .06, s * .75, 1.05, 2.0, CYB); }
    g.box(1.5, .5, .7, 0, 1.25, -1.85, LGK); for (const s of [-1, 1]) g.cyl(.17, .2, .3, 8, s * .45, 1.2, -2.25, CYN, { rx: PI / 2 }); g.box(1.6, .05, 1.0, 0, 1.29, .9, 0x1e2228);
    const t = new GB(); fcyl(t, 6, .72, .95, .5, 1.05, 0, .25, -.1, LGA, { ry: PI / 6 }); fcyl(t, 6, 1, .7, .05, .77, 0, .52, -.1, 0, { acc: 1, ry: PI / 6 });
    t.box(.4, .3, .5, 0, .25, .75, LGB); rod(t, .12, 8, 0, .26, .8, 0, .26, 3.1, LGK); for (const z of [1.4, 1.9, 2.4]) t.cyl(.17, .17, .1, 8, 0, .26, z, CYN, { rx: PI / 2 }); ball(t, .14, .14, .14, 0, .26, 3.15, CYB);
    t.box(.03, 1.0, .03, .45, .9, -.6, BLACK); t.box(.3, .2, .3, -.35, .6, -.3, LGK);
    MDL.hovertank = [part(g), part(t, 'turret', 0, 1.3, -.2)];
  }
  const spider = (g, by, bw, bd, w, reach, lift) => { g.box(bw, .75, bd, 0, by, 0, LGC); g.box(bw * .72, .08, bd * .65, 0, by + .41, 0, 0, { acc: .85 }); for (const sx of [-1, 1]) for (const sz of [-1, 1]) leg4(g, sx * bw * .45, by - .05, sz * bd * .4, sx * (bw * .45 + reach * .9), by + lift, sz * (bd * .4 + reach * .6), sx * (bw * .45 + reach * 1.1), sz * (bd * .4 + reach * .9), w); };
  { // Artillery Walker: four legs and a very long gun with glowing rails
    const g = new GB(); spider(g, 2.35, 1.9, 2.4, .26, 1.0, .5);
    const t = new GB(), e = .35, BL = 4.4, ey = Math.sin(e), ez = Math.cos(e); t.box(1.7, .85, 2.0, 0, .4, -.25, LGA); t.box(1.72, .08, 1.8, 0, .84, -.3, 0, { acc: 1 });
    rod(t, .17, 8, 0, .5, .7, 0, .5 + BL * ey, .7 + BL * ez, LGB); for (const s of [-1, 1]) strut(t, s * .2, .5, .7, s * .2, .5 + (BL - .4) * ey, .7 + (BL - .4) * ez, .06, .2, LGK);
    for (const k of [1.4, 2.4, 3.4]) t.cyl(.25, .25, .1, 8, 0, .5 + k * ey, .7 + k * ez, CYN, { rx: PI / 2 - e });
    t.box(.4, .36, .4, 0, .5 + BL * ey, .7 + BL * ez, LGK, { rx: -e }); t.box(1.0, .6, .6, 0, .45, -1.4, LGK); t.box(.6, .3, .03, 0, .48, -1.71, CYN);
    MDL.artwalker = [part(g), part(t, 'turret', 0, 2.75, 0)];
  }
  { // Skyguard: smaller spider walker with two seeker-missile pods and a spinning sensor
    const g = new GB(); spider(g, 2.0, 1.6, 1.8, .2, .8, .4);
    const t = new GB(), e = .75, ey = Math.sin(e), ez = Math.cos(e); t.box(1.2, .6, 1.2, 0, .3, 0, LGA); t.box(1.22, .07, 1.1, 0, .62, 0, 0, { acc: 1 });
    for (const s of [-1, 1]) { t.box(.55, .55, 1.1, s * .85, .55, .1, LGB, { rx: -e }); for (const a of [-.13, .13]) for (const b of [-.13, .13]) t.cyl(.07, .07, .05, 6, s * .85 + a, .55 + ey * .56 + b * ez, .1 + ez * .56 - b * ey, CYN, { rx: PI / 2 - e }); }
    const r = new GB(); scyl(r, 10, 4, .14, .1, .14, 0, .05, 0, 0x8a95a3); r.box(.08, .25, .08, 0, -.12, 0, LGK); r.box(.08, .04, .5, 0, .12, 0, CYN);
    MDL.skyguard = [part(g), part(t, 'turret', 0, 2.35, 0), part(r, 'rotor', 0, 3.3, -.3, 2.5)];
  }
  { // Warmech: heavy biped, plasma cannon arm, pulse gun arm, shoulder missiles, glowing reactor
    const g = new GB(); g.box(2.0, .7, 1.3, 0, 3.85, 0, LGC);
    for (const s of [-1, 1]) { leg2(g, s * .95, 3.8, 2.1, .55, -.2, .62, .54, .9, 1.5); g.box(.66, .7, .12, s * 1.05, 2.95, .62, 0, { acc: .85, rx: -.3 }); g.box(.06, .5, .06, s * 1.4, 2.9, .2, CYN); }
    const t = new GB(); t.box(2.6, 1.6, 1.9, 0, .75, -.1, LGA); wedge(t, 2.6, .9, .6, 0, .45, 1.15, LGA, { ry: PI }); t.box(2.62, .14, 1.8, 0, 1.56, -.15, 0, { acc: 1 }); t.box(1.3, .28, .06, 0, 1.05, .86, CYN);
    for (const s of [-1, 1]) t.box(.95, .8, 1.2, s * 1.7, 1.1, -.1, LGB);
    t.box(.75, .75, 1.5, 1.75, .5, .6, LGK); rod(t, .2, 8, 1.75, .5, 1.3, 1.75, .5, 3.0, LGB); for (const z of [1.7, 2.2, 2.7]) t.cyl(.27, .27, .1, 8, 1.75, .5, z, CYN, { rx: PI / 2 }); ball(t, .2, .2, .2, 1.75, .5, 3.05, CYB);
    t.box(.65, .65, 1.3, -1.75, .5, .5, LGK); for (const dy of [-.12, .12]) rod(t, .06, 5, -1.75, .5 + dy, 1.1, -1.75, .5 + dy, 1.9, LGB);
    t.box(.8, .5, .9, -1.1, 1.85, -.3, LGK); for (const x of [-1.3, -.9]) t.cyl(.08, .08, .04, 6, x, 1.85, .16, 0xff8a3a, { rx: PI / 2 });
    t.box(1.6, 1.1, .6, 0, .8, -1.3, LGK); t.box(1.0, .5, .04, 0, .85, -1.62, CYN); t.box(.04, 1.6, .04, .8, 2.3, -1.0, BLACK);
    MDL.warmech = [part(g), part(t, 'turret', 0, 4.25, 0)];
  }
  { // Storm Walker: spider walker with a raised eight-tube plasma rocket box
    const g = new GB(); spider(g, 2.3, 1.9, 2.3, .26, 1.0, .5);
    const t = new GB(), e = .45, dy = Math.sin(e), dz = Math.cos(e), uy = Math.cos(e), uz = -Math.sin(e), cy = .95, cz = .1;
    t.cyl(.8, .9, .25, 10, 0, 0, 0, LGB); t.box(1.8, .9, 2.4, 0, cy, cz, LGA, { rx: -e }); t.box(1.84, .16, 2.44, 0, cy, cz, 0, { acc: 1, rx: -e });
    for (const v of [-.2, .2]) for (const x of [-.6, -.2, .2, .6]) { const py = cy + dy * 1.21 + uy * v, pz = cz + dz * 1.21 + uz * v; t.cyl(.15, .15, .06, 8, x, py, pz, LGK, { rx: PI / 2 - e }); t.cone(.1, .12, 6, x, py + dy * .07, pz + dz * .07, CYN, { rx: PI / 2 - e }); }
    MDL.stormwalker = [part(g), part(t, 'turret', 0, 2.75, -.3)];
  }
  { // Siege Titan: a colossal four-legged walking fortress, siege cannon, pulse turrets and shield fins
    const g = new GB(); g.box(4.0, 1.9, 5.0, 0, 5.4, 0, LGC); g.box(3.4, .12, 4.2, 0, 6.36, 0, 0, { acc: .85 }); g.box(2.4, 1.2, .5, 0, 5.2, 2.6, LGB); g.box(1.6, .3, .06, 0, 5.4, 2.86, CYN);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { leg4(g, sx * 1.7, 5.2, sz * 2.0, sx * 3.0, 6.0, sz * 3.1, sx * 3.25, sz * 3.4, .72); g.box(1.0, .9, .14, sx * 2.35, 5.75, sz * 2.95, 0, { acc: .8, ry: sx * sz * .6 }); g.box(.12, 1.6, .12, sx * 3.05, 3.2, sz * 3.6, CYN); }
    const t = new GB(), e = .12, BL = 4.6, ey = Math.sin(e), ez = Math.cos(e); t.box(3.2, 1.6, 3.4, 0, .8, -.3, LGA); t.box(3.22, .16, 3.3, 0, 1.6, -.35, 0, { acc: 1 });
    rod(t, .45, 10, 0, 1.0, 1.3, 0, 1.0 + BL * ey, 1.3 + BL * ez, LGK); t.cyl(.6, .6, 1.0, 10, 0, 1.0 + .6 * ey, 1.3 + .6 * ez, LGB, { rx: PI / 2 - e }); for (const k of [2.2, 3.2]) t.cyl(.55, .55, .14, 10, 0, 1.0 + k * ey, 1.3 + k * ez, CYN, { rx: PI / 2 - e }); t.box(.95, .95, .6, 0, 1.0 + BL * ey, 1.3 + BL * ez, LGB, { rx: -e });
    for (const s of [-1, 1]) { t.box(.8, .7, 1.0, s * 1.9, .9, .5, LGB); for (const d of [-.12, .12]) rod(t, .07, 5, s * 1.9, .9 + d, 1.0, s * 1.9, .9 + d, 1.9, LGK); }
    for (const x of [-1.1, 0, 1.1]) { t.box(.14, 1.6, 1.0, x, 2.3, -1.4, LGB); t.box(.16, 1.5, .08, x, 2.3, -.88, CYN); }
    ball(t, .35, .35, .35, 0, 3.3, -1.4, CYB); t.box(.05, 2.2, .05, 1.4, 2.6, -1.9, BLACK);
    MDL.siegetitan = [part(g), part(t, 'turret', 0, 6.45, 0)];
  }
  { // Drone Swarm: three small attack drones circling together (the whole trio slowly turns)
    const r = new GB(); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU, x = Math.cos(a) * 1.0, z = Math.sin(a) * 1.0, y = (i - 1) * .18; fcyl(r, 8, .55, .42, .14, .42, x, y, z, LGA); fcyl(r, 8, 1, .3, .04, .3, x, y + .09, z, 0, { acc: .95 }); ball(r, .12, .1, .12, x, y - .08, z, CYN); for (const s of [-1, 1]) r.box(.6, .03, .07, x, y + .02, z, LGK, { ry: a + s * .8 }); }
    MDL.swarm = [part(r, 'rotor', 0, 0, 0, 2.2)];
  }
  { // Seeker Drone: dart with a glowing plasma warhead
    const g = new GB(); g.cyl(.16, .2, 1.3, 8, 0, 0, -.1, LGA, { rx: PI / 2 }); g.cone(.16, .5, 8, 0, 0, .8, CYB, { rx: PI / 2 }); fcyl(g, 3, 1, .8, .06, .9, 0, 0, -.45, LGB); fcyl(g, 3, 1, .6, .02, .7, 0, .04, -.5, 0, { acc: .95 }); g.cyl(.12, .12, .1, 8, 0, 0, -.8, CYN, { rx: PI / 2 }); for (const s of [-1, 1]) g.box(.04, .3, .25, s * .25, .1, -.7, LGK);
    MDL.seeker = [part(g)];
  }
  { // Wraith: rotorless anti-gravity gunship with two glowing engine pods
    const g = new GB(); g.sph(.7, .5, 1.9, 0, 0, 0, LGA); g.sph(.4, .3, .8, 0, .32, .8, 0x7fe0ff); g.box(1.2, .25, 1.6, 0, -.1, -.4, LGB);
    for (const s of [-1, 1]) { strut(g, s * .5, -.05, -.2, s * 1.7, -.2, -.6, .7, .1, LGB); g.box(.9, .04, .6, s * 1.3, -.08, -.5, 0, { acc: .9, ry: -s * .3 }); g.cyl(.3, .3, 1.4, 10, s * 1.75, -.2, -.5, LGK, { rx: PI / 2 }); g.cyl(.26, .26, .06, 10, s * 1.75, -.2, -1.22, CYN, { rx: PI / 2 }); g.cyl(.24, .24, .06, 10, s * 1.75, -.48, -.5, CYN); }
    g.box(.25, .25, .8, 0, -.45, 1.1, LGK); g.cyl(.08, .08, .7, 6, 0, -.45, 1.7, LGB, { rx: PI / 2 }); ball(g, .08, .08, .08, 0, -.45, 2.05, CYB);
    g.box(.08, .7, .9, 0, .5, -1.6, 0, { acc: .95, rx: .3 }); g.box(1.2, .06, .5, 0, .1, -1.9, LGB); g.cyl(.4, .4, .05, 12, 0, -.42, -.2, CYN);
    MDL.wraith = [part(g)];
  }
  { // Harbinger: a shielded flying wing with four engines and twin plasma cannons
    const g = new GB(); fcyl(g, 3, 1, 3.6, .7, 3.0, 0, 0, -.6, LGA); fcyl(g, 3, 1, 3.0, .08, 2.5, 0, .38, -.8, 0, { acc: .95 }); g.sph(.9, .6, 2.0, 0, .1, .4, LGB); g.sph(.45, .3, .7, 0, .45, 1.4, 0x7fe0ff);
    for (const s of [-1, 1]) { for (const x of [1.2, 2.4]) { g.cyl(.3, .32, 1.2, 10, s * x, -.25, -1.2, LGK, { rx: PI / 2 }); g.cyl(.27, .27, .06, 10, s * x, -.25, -1.82, CYN, { rx: PI / 2 }); } g.box(.5, .4, .9, s * 1.0, -.35, .6, LGK); rod(g, .09, 6, s * 1.0, -.35, 1.0, s * 1.0, -.35, 1.9, LGB); ball(g, .1, .1, .1, s * 1.0, -.35, 1.95, CYB); }
    g.cyl(.8, .8, .06, 14, 0, -.42, -.4, CYN);
    MDL.harbinger = [part(g)];
  }
  { // Raptor: forward-swept jet fighter with a glowing engine
    const g = new GB(); g.cyl(.38, .45, 3.4, 8, 0, 0, -.6, LGA, { rx: PI / 2 }); g.cone(.38, 1.8, 8, 0, 0, 2.0, LGA, { rx: PI / 2 }); g.sph(.26, .22, .7, 0, .3, 1.1, 0x7fe0ff);
    for (const s of [-1, 1]) { strut(g, s * .3, 0, -1.2, s * 2.2, 0, .1, .7, .08, LGB); g.box(.04, .06, 1.8, s * 1.3, .05, -.55, 0, { acc: .95, ry: s * .62 }); g.box(.08, .8, .8, s * .55, .5, -2.0, 0, { acc: .95, rz: -s * .3 }); rod(g, .06, 6, s * 1.6, -.12, -.3, s * 1.6, -.12, .7, 0x9aa3ad); }
    g.cyl(.34, .4, .4, 8, 0, 0, -2.5, LGK, { rx: -PI / 2 }); g.cyl(.3, .3, .05, 8, 0, 0, -2.72, CYN, { rx: PI / 2 });
    const r = new GB(); ball(r, .22, .22, .22, 0, 0, 0, CYB);
    MDL.raptor = [part(g), part(r, 'rotor', 0, 0, -2.85, 25)];
  }
  { // drop pod for Legion call-ins: falls nose first, thruster ring on top
    const g = new GB(); g.cyl(.75, .85, 2.0, 8, 0, 1.4, 0, LGB); g.cone(.85, 1.0, 8, 0, .15, 0, LGA, { rx: PI }); for (const k of [.9, 1.95]) g.cyl(.82, .82, .08, 8, 0, k, 0, CYN);
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + PI / 4; g.box(.08, 1.2, .55, Math.cos(a) * .85, 1.9, Math.sin(a) * .85, LGK, { ry: -a }); } g.cyl(.5, .6, .3, 8, 0, 2.55, 0, LGK); g.cyl(.45, .45, .05, 8, 0, 2.72, 0, CYB); g.box(.3, .5, .04, 0, 1.4, .84, 0, { acc: .9 });
    MDL.pod = [part(g)];
  }
  { const g = new GB(); g.box(1.0, .8, 2.1, 0, .4, 0, 0x3a404a); g.box(1.06, .16, 2.16, 0, .86, 0, 0, { acc: 1 }); g.box(.5, .5, .25, 0, .3, 1.05, LGC); g.box(.5, .5, .25, 0, .3, -1.05, LGC); for (const s of [-1, 1]) g.box(.06, .07, 1.9, s * .52, .62, 0, CYN); MDL.wallsegL = [part(g)]; }   // Legion wall segment
}
// ---------------- 3.0 ships: bow at +z, the waterline at y = 0 (hulls sit a little below it) ----------------
function buildNavalModels() {
  { // Gunboat: low patrol boat, wheelhouse, bow machine gun, rocket rack aft
    const g = new GB(), c = 0x5f6b72, c2 = shade(c, .7), dk = 0x3a4248, deck = 0x8a8170;
    g.box(2.0, .9, 4.4, 0, 0, -.7, c2); fcyl(g, 3, 1, 1.16, .9, 2.0, 0, 0, 1.5, c2);
    g.box(1.84, .08, 4.2, 0, .47, -.7, deck); fcyl(g, 3, 1, 1.0, .08, 1.75, 0, .47, 1.45, deck); g.box(2.04, .12, 4.42, 0, .38, -.7, 0, { acc: .9 });
    g.box(1.3, .85, 1.4, 0, .92, -.7, c); g.box(1.32, .28, .06, 0, 1.12, .02, GLASS); for (const s of [-1, 1]) g.box(.06, .28, 1.0, s * .66, 1.12, -.7, GLASS); g.box(1.42, .1, 1.52, 0, 1.38, -.7, c2);
    g.cyl(.04, .04, 1.5, 5, 0, 2.1, -1.0, DARK); g.box(.6, .05, .05, 0, 2.55, -1.0, DARK); g.box(.3, .2, .02, .2, 2.7, -1.0, 0, { acc: 1 });
    for (const s of [-1, 1]) { g.box(.3, .22, 1.1, s * .62, .62, -2.2, dk); for (const k of [-.06, .06]) g.cyl(.06, .06, 1.0, 6, s * .62 + k, .78, -2.2, 0x4a5056, { rx: PI / 2 }); }
    g.box(1.2, .25, .5, 0, .55, -2.9, dk); g.cyl(.18, .18, .5, 8, 0, .2, -2.95, BLACK, { rx: PI / 2 });
    const t = new GB(); t.cyl(.32, .36, .22, 8, 0, 0, 0, c); t.box(.4, .28, .5, 0, .2, .05, c2); rod(t, .05, 6, 0, .24, .3, 0, .24, 1.25, BLACK); t.box(.62, .34, .05, 0, .28, .32, 0, { acc: .9 });
    MDL.gunboat = [part(g), part(t, 'turret', 0, .55, 1.25)];
  }
  { // Landing Craft: boxy hull, open well deck, bow ramp, pilot house and a pintle gun at the stern
    const g = new GB(), c = 0x6b7461, c2 = shade(c, .72);
    g.box(2.8, .9, 5.6, 0, 0, 0, c2); for (const s of [-1, 1]) g.box(.2, .75, 5.0, s * 1.3, .8, -.25, c); g.box(2.42, .08, 4.1, 0, .47, .25, 0x4a4f44);
    g.box(2.7, 1.1, .2, 0, .95, 2.72, c, { rx: -.14 }); for (const s of [-1, 1]) g.box(.06, .9, .06, s * 1.0, .95, 2.82, DARK);
    g.box(2.84, .12, 5.64, 0, .32, 0, 0, { acc: .9 }); for (const s of [-1, 1]) g.box(.04, .18, 3.2, s * 1.41, .95, .3, 0, { acc: .9 });
    g.box(1.2, .95, 1.0, .55, 1.0, -2.25, c); g.box(1.0, .26, .05, .55, 1.2, -1.74, GLASS); g.box(1.3, .1, 1.1, .55, 1.5, -2.25, c2);
    for (let i = 0; i < 3; i++) g.box(.6, .3, .45, -.6 + i * .6, .65, .9, i % 2 ? 0x4d5a3a : 0x5a5f4a);
    const t = new GB(); t.cyl(.06, .06, .3, 5, 0, -.12, 0, STEEL); t.box(.18, .18, .5, 0, .1, .1, BLACK); rod(t, .04, 5, 0, .12, .3, 0, .12, 1.0, BLACK); t.box(.5, .32, .05, 0, .16, .3, 0, { acc: .9 });
    MDL.lcraft = [part(g), part(t, 'turret', -.65, 1.45, -2.2)];
  }
  { // Destroyer: long grey hull, bridge, funnel, a twin-gun turret forward, an aft gun, flak mounts and a spinning radar
    const g = new GB(), c = 0x7b858c, c2 = shade(c, .66), dk = 0x4a5258, deck = 0x7d7a70;
    g.box(3.0, 1.3, 8.4, 0, 0, -1.2, c2); fcyl(g, 3, 1, 1.72, 1.3, 3.5, 0, 0, 3.4, c2);
    g.box(2.8, .1, 8.2, 0, .69, -1.2, deck); fcyl(g, 3, 1, 1.55, .1, 3.2, 0, .69, 3.3, deck); g.box(3.04, .14, 8.44, 0, .52, -1.2, 0, { acc: .9 });
    g.box(2.0, 1.2, 3.0, 0, 1.3, -.9, c); g.box(1.6, 1.0, 1.5, 0, 2.4, -.3, c); g.box(1.5, .3, .06, 0, 2.6, .46, GLASS); for (const s of [-1, 1]) g.box(.5, .1, .6, s * 1.05, 2.0, -.2, c2);
    g.cyl(.45, .55, 1.7, 8, 0, 2.6, -2.3, dk); g.cyl(.47, .47, .22, 8, 0, 3.4, -2.3, BLACK); g.box(.5, .12, .5, 0, 3.0, -2.3, 0, { acc: .9 });
    g.cyl(.06, .08, 2.6, 5, 0, 4.1, -.4, DARK); g.box(1.0, .05, .05, 0, 4.7, -.4, DARK);
    g.cyl(.55, .65, .35, 8, 0, .9, -4.3, c); g.box(.9, .5, 1.0, 0, 1.25, -4.3, c); rod(g, .09, 6, 0, 1.3, -4.8, 0, 1.3, -6.1, dk);
    for (const s of [-1, 1]) { g.cyl(.3, .34, .3, 8, s * 1.15, .9, -3.0, dk); for (const k of [-.1, .1]) rod(g, .04, 5, s * 1.15 + k, 1.05, -3.0, s * 1.15 + k, 1.6, -2.7, BLACK); }
    g.box(.7, .3, .4, 0, .8, 1.3, dk); for (const x of [-.9, .9]) g.cyl(.12, .12, .25, 6, x, .8, 3.6, BLACK);
    const t = new GB(); t.cyl(.7, .8, .32, 8, 0, 0, 0, c); t.box(1.2, .6, 1.3, 0, .3, -.1, c); t.box(1.22, .08, 1.32, 0, .62, -.1, 0, { acc: .9 }); for (const x of [-.22, .22]) rod(t, .1, 6, x, .32, .4, x, .38, 2.4, dk);
    const r = new GB(); r.box(1.4, .28, .08, 0, 0, 0, DARK); r.box(.12, .3, .12, 0, -.2, 0, DARK);
    MDL.destroyer = [part(g), part(t, 'turret', 0, .78, 2.0), part(r, 'rotor', 0, 4.9, -.4, 2.2)];
  }
  // Iron Legion ships: the same hulls in Vault steel with Embercore lights, plus their own kit
  const lg = (src, extra) => src.map((p, i) => { const geo = p.geo.clone(); lgRecolor(geo); const o = Object.assign({}, p, { geo }); if (i === 0 && extra) { const g = new GB(); extra(g); o.geo = geoMerge(geo, g.build()); } return o; });
  MDL.hydrofoil = lg(MDL.gunboat, g => { for (const s of [-1, 1]) { strut(g, s * .85, -.1, 1.1, s * 1.25, -.75, 1.1, .1, .08, LGK); strut(g, s * .85, -.1, -2.2, s * 1.25, -.75, -2.2, .1, .08, LGK); } g.box(2.8, .06, .5, 0, -.78, 1.1, CYN); g.box(2.8, .06, .5, 0, -.78, -2.2, CYN); for (const s of [-1, 1]) g.box(.05, .06, 4.0, s * 1.03, .44, -.7, CYN); });
  MDL.assaultbarge = lg(MDL.lcraft, g => { for (const s of [-1, 1]) { g.box(.05, .08, 4.6, s * 1.42, 1.15, -.25, CYN); g.cyl(.35, .4, .5, 8, s * 1.0, .1, -2.9, LGK, { rx: PI / 2 }); g.cyl(.3, .3, .05, 8, s * 1.0, .1, -3.17, CYB, { rx: PI / 2 }); } g.box(2.4, .06, .12, 0, 1.45, 2.78, CYN); });
  MDL.leviathan = lg(MDL.destroyer, g => { for (const s of [-1, 1]) g.box(.05, .1, 8.0, s * 1.53, .62, -1.2, CYN); g.cyl(.3, .3, .5, 8, 0, 3.9, -2.3, CYB); for (const z of [-3.6, -3.0]) for (const s of [-1, 1]) g.box(.5, .4, .3, s * .7, 1.05, z, LGK); ball(g, .35, .35, .35, 0, 4.5, -.4, CYB); });
}
// ---------------- building models ----------------
function bModel(type, lvl, spec) {
  const g = new GB(), L = lvl; const parts = [];
  // a ring of sandbags; gap (radians) leaves an opening centred on angle ga (default: the front, +z)
  const sandbags = (g, r, n, gap, y0, ga) => { ga = ga === undefined ? PI / 2 : ga; for (let i = 0; i < n; i++) { const a = i / n * TAU + (y0 ? PI / n : 0); if (gap && Math.abs(Math.atan2(Math.sin(a - ga), Math.cos(a - ga))) < gap) continue; ball(g, .6, .3, .36, Math.cos(a) * r, (y0 || 0) + .27, Math.sin(a) * r, i % 2 ? TAN : 0xa8956a, { ry: -a - PI / 2 }); } };
  const flag = (g, x, y, z, h) => { h = h || 3.2; g.cyl(.07, .07, h, 5, x, y + h / 2, z, 0xcfd3d8); g.box(1.2, .7, .06, x + .65, y + h - .3, z, 0, { acc: 1 }); ball(g, .1, .1, .1, x, y + h + .05, z, 0xffc94a); };
  const crate = (g, x, y, z, s, c) => { g.box(s, s, s, x, y + s / 2, z, c); g.box(s * 1.03, s * .14, s * 1.03, x, y + s / 2, z, shade(c, .7)); };
  const lattice = (g, x, z, y0, y1, b0, b1, c) => {   // tapering lattice mast with zig-zag bracing
    const n = Math.max(2, Math.round((y1 - y0) / 1.4)), at = k => b0 + (b1 - b0) * k;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) strut(g, x + sx * b0, y0, z + sz * b0, x + sx * b1, y1, z + sz * b1, .1, .1, c);
    for (let i = 0; i < n; i++) { const k0 = i / n, k1 = (i + 1) / n, ya = y0 + (y1 - y0) * k0, yb = y0 + (y1 - y0) * k1, a = at(k0), b = at(k1);
      for (const s of [-1, 1]) { strut(g, x - a, ya, z + s * a, x + b, yb, z + s * b, .05, .05, c); strut(g, x + s * a, ya, z - a, x + s * b, yb, z + b, .05, .05, c); } }
  };
  switch (type) {
    case 'hq': {   // command post: grows a second storey, comms mast and garage (L2), then guard towers, a side wing and a satellite dish (L3)
      g.box(11, .5, 11, 0, .25, 0, CONC2); g.box(3.2, .04, 2.6, 0, .52, 4.1, 0x9a9890);
      g.box(7, 3.4, 6, 0, 2.2, -.4, CONC); g.box(7.3, .4, 6.3, 0, 4.05, -.4, 0, { acc: .92 }); g.box(6.5, .12, 5.5, 0, 4.28, -.4, CONC2);
      g.box(5.8, .55, .08, 0, 3.15, 2.63, GLASS);
      for (const s of [-1, 1]) { g.box(.08, .55, 4.8, s * 3.53, 3.15, -.4, GLASS); g.box(1.3, .8, .08, s * 2.3, 1.7, 2.63, GLASS); g.box(.3, 3.4, .3, s * 3.45, 2.2, 2.5, CONC2); g.box(.14, 2.2, .14, s * 1.2, 1.6, 3.75, STEEL); }
      g.box(1.6, 2.1, .1, 0, 1.55, 2.63, DARK); g.box(2.6, .14, 1.4, 0, 2.75, 3.2, 0, { acc: .9 }); g.box(2.6, .2, .8, 0, .6, 3.0, CONC2);
      g.box(1.2, .6, 1.0, -2.3, 4.64, -2.1, STEEL); g.box(.9, .5, .9, 2.4, 4.59, -2.3, STEEL); g.cyl(.3, .3, .1, 8, 2.4, 4.88, -2.3, DARK);
      sandbags(g, 5.2, 24, .45); flag(g, 3.0, 4.34, 1.9);
      let ry = 5.55, rz = -.4, rb = 4.34;
      if (L >= 2) {
        g.box(4.6, 1.9, 4.0, 0, 5.3, -.9, CONC); g.box(4.9, .35, 4.3, 0, 6.4, -.9, 0, { acc: .95 }); g.box(4.2, .1, 3.6, 0, 6.62, -.9, CONC2); g.box(4.0, .5, .08, 0, 5.5, 1.11, GLASS); for (const s of [-1, 1]) g.box(.08, .5, 3.2, s * 2.31, 5.5, -.9, GLASS);
        lattice(g, -1.6, -2.3, 6.67, 10.2, .32, .1, STEEL); g.box(.03, 2.4, .03, 1.6, 7.9, -2.4, BLACK); g.box(.03, 1.8, .03, 1.9, 7.6, -2.0, BLACK);
        g.box(1.3, 2.0, 3.0, -4.15, 1.5, -2.3, CONC2); g.box(1.5, .2, 3.2, -4.15, 2.6, -2.3, 0, { acc: .9 }); g.box(.9, 1.4, .08, -4.15, 1.2, -.78, 0x3a3f44);
        ry = 7.75; rz = -.9; rb = 6.67;
      }
      if (L >= 3) {
        for (const s of [-1, 1]) { g.box(1.5, 5.2, 1.5, s * 4.6, 3.1, -4.6, CONC2); g.box(1.8, .4, 1.8, s * 4.6, 5.9, -4.6, 0, { acc: 1 }); g.box(1.4, .5, .08, s * 4.6, 4.9, -3.83, GLASS); g.box(.3, .3, .4, s * 4.6, 6.25, -4.4, LAMP); }
        g.box(1.3, 2.4, 3.6, 4.15, 1.7, -.8, CONC2); g.box(1.5, .2, 3.8, 4.15, 2.95, -.8, 0, { acc: .9 });
        g.cyl(.12, .2, 1.0, 6, 4.15, 3.5, -.8, STEEL); scyl(g, 12, 4, .4, .45, .4, 4.15, 4.25, -.8, WHITE, { rx: .6 }); rod(g, .04, 6, 4.15, 4.3, -.8, 4.15, 5.0, -.25, STEEL);
      }
      g.cyl(.12, .12, ry - rb - .1, 6, 0, (ry + rb) / 2 - .05, rz, STEEL);
      const r = new GB(); r.box(2.6, .55, .1, 0, .3, .1, 0xd0d4d8); r.box(2.4, .08, .3, 0, .02, .05, STEEL); r.cyl(.14, .14, .3, 6, 0, -.05, 0, STEEL);
      if (spec === 'fortress') { g.box(1.6, 2.7, 1.6, 4.4, 1.85, 4.4, CONC2); g.box(1.8, .2, 1.8, 4.4, 3.25, 4.4, 0, { acc: 1 }); }
      parts.push(part(g), part(r, 'rotor', 0, ry, rz, 1.6));
      if (spec === 'fortress') {
        const t = new GB(); t.cyl(.5, .6, .25, 8, 0, -.05, 0, STEEL); t.box(.8, .45, .8, 0, .25, 0, STEEL); t.box(.7, .04, .7, 0, .49, 0, 0, { acc: 1 }); rod(t, .07, 6, 0, .28, .4, 0, .28, 1.6, BLACK); t.box(.9, .5, .06, 0, .3, .45, STEEL); parts.push(part(t, 'turret', 4.4, 3.5, 4.4)); }
      return parts;
    }
    case 'barracks': {   // Quonset huts: one (L1), two (L2), plus a watchtower (L3)
      g.box(6, .4, 6, 0, .2, 0, CONC2);
      const hut = (x, z, r, len, c) => {
        hcyl(g, 12, r, len, x, .4, z, c); for (const k of [-1, 0, 1]) hcyl(g, 12, r + .04, .2, x, .4, z + k * (len / 2 - .3), 0, { acc: .9 });
        g.box(r * .7, r * .85, .1, x, .4 + r * .43, z + len / 2 + .02, DARK); g.box(r * 1.0, .08, .5, x, .4 + r * .9, z + len / 2 + .24, 0, { acc: .9 });
        for (const s of [-1, 1]) for (const k of [-1, 1]) g.box(.06, .3, .5, x + s * r * .83, .4 + r * .55, z + k * len * .2, GLASS, { rz: s * .61 });
        g.cyl(.08, .08, .7, 6, x + r * .4, .4 + r, z - len * .3, DARK);
      };
      if (L === 1) { hut(0, -.4, 1.7, 4.6, 0x6b7350); flag(g, 2.3, .4, 2.3); }
      else { hut(-.95, -.4, 1.45, 4.6, 0x6b7350); hut(1.85, -.9, 1.0, 3.6, 0x7a7d5a); g.box(.9, .05, 1.6, .45, .43, 1.3, 0x9a9890); }
      crate(g, -2.2, .4, 2.1, .6, WOOD); crate(g, -1.55, .4, 2.35, .45, 0x5d6e46);
      if (L >= 3) {
        const tx = 2.0, tz = 2.0;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) { strut(g, tx + sx * .55, .4, tz + sz * .55, tx + sx * .42, 4.0, tz + sz * .42, .12, .12, WOOD); g.box(.06, .8, .06, tx + sx * .6, 4.5, tz + sz * .6, WOOD); }
        strut(g, tx - .5, 1.0, tz + .5, tx + .46, 3.0, tz + .46, .06, .06, WOOD); strut(g, tx + .5, 1.0, tz - .5, tx + .46, 3.0, tz + .46, .06, .06, WOOD);
        g.box(1.4, .14, 1.4, tx, 4.05, tz, WOOD); g.box(1.4, .4, .06, tx, 4.32, tz + .68, WOOD); g.box(.06, .4, 1.4, tx + .68, 4.32, tz, WOOD); g.box(.06, .4, 1.4, tx - .68, 4.32, tz, WOOD);
        g.cone(1.15, .7, 4, tx, 5.25, tz, 0, { acc: 1, ry: PI / 4 }); g.box(.3, .25, .35, tx + .3, 4.4, tz + .5, LAMP); flag(g, -2.7, .4, -2.7, 4.2);
        sandbags(g, 3.5, 18, .7, 0, PI * .35);
      } else sandbags(g, 3.5, 18, .5);
      return [part(g)];
    }
    case 'medical': {   // field hospital: a big ridge tent (L1), a second tent and cots (L2), an ambulance and water tank (L3)
      g.box(5, .3, 5, 0, .15, 0, CONC2);
      const CNV = 0xe6e9e4;
      const tent = (x, z, W, Hw, Hr, Lz) => {   // ridge along z, red crosses on both roof slopes
        g.box(W, Hw, Lz, x, .3 + Hw / 2, z, CNV); const by = .3 + Hw, a = Math.atan2(Hr, W / 2);
        fcyl(g, 3, 1, (W + .2) / 1.732, Lz + .2, Hr / 1.5, x, by + Hr / 3, z, CNV, { rx: -PI / 2 });
        g.box(.16, .1, Lz + .3, x, by + Hr + .02, z, 0, { acc: 1 }); for (const s of [-1, 1]) g.box(.1, .16, Lz + .22, x + s * (W / 2 + .08), by + .02, z, 0, { acc: .9 });
        for (const s of [-1, 1]) { const cx = x + s * W / 4 + s * Math.sin(a) * .03, cy = by + Hr / 2 + Math.cos(a) * .03; g.box(Math.min(1.1, W * .32), .03, .3, cx, cy, z, RED, { rz: -s * a }); g.box(.3, .03, Math.min(1.1, Lz * .3), cx, cy, z, RED, { rz: -s * a }); }
        g.box(W * .3, Hw * .85, .06, x, .3 + Hw * .43, z + Lz / 2 + .02, 0x8a9096);
      };
      tent(-.4, -.2, 3.0, 1.2, 1.5, 3.4);
      g.box(.5, .45, .5, -2.2, .52, -2.2, WHITE); g.box(.34, .02, .1, -2.2, .755, -2.2, RED); g.box(.1, .02, .34, -2.2, .755, -2.2, RED); flag(g, -2.1, .3, 2.0);
      if (L >= 2) { tent(1.85, -.8, 1.3, .9, 1.0, 2.6); for (const z of [1.85, 2.3]) { g.box(1.3, .12, .42, -1.0, .55, z, 0x5d6e46); g.box(1.0, .05, .36, -.95, .63, z, WHITE); } }
      if (L >= 3) { g.box(1.1, 1.0, 1.7, 1.8, .9, 1.4, WHITE); g.box(.9, .45, .05, 1.8, 1.1, 2.26, GLASS); g.box(.06, .3, .9, 2.36, 1.0, 1.4, RED); g.box(.06, .3, .9, 1.24, 1.0, 1.4, RED); g.box(.5, .05, .16, 1.8, 1.42, 1.3, RED); g.box(.16, .05, .5, 1.8, 1.42, 1.3, RED); g.box(.4, .12, .2, 1.8, 1.46, 1.9, 0, { acc: 1 });
        for (const x of [1.45, 2.15]) for (const z of [.85, 1.95]) g.cyl(.2, .2, .2, 8, x, .4, z, TIRE, { rz: PI / 2 }); g.cyl(.3, .3, 1.4, 10, .5, 1.0, -2.2, 0x8fa6b8); g.cyl(.32, .32, .12, 10, .5, 1.65, -2.2, 0, { acc: .9 }); }
      return [part(g)];
    }
    case 'factory': {   // Motor Pool: saw-tooth workshop (L1), gantry crane and lean-to (L2), roof office, second chimney, parked tank (L3)
      g.box(8, .4, 7.5, 0, .2, 0, CONC2); g.box(4.4, .04, 1.6, 0, .42, 2.95, 0x55585c); for (const s of [-1, 1]) g.box(.12, .03, 1.5, s * 2.0, .45, 2.95, 0xe8c840);
      g.box(6.6, 3.0, 5.4, 0, 1.9, -.6, 0x7d868f); g.box(6.7, .3, 5.5, 0, 3.25, -.6, 0, { acc: .9 });
      for (let i = 0; i < 3; i++) { wedge(g, 6.6, .9, 1.8, 0, 3.85, -3.3 + i * 1.8 + .9, CONC2); g.box(6.4, .7, .04, 0, 3.85, -3.3 + (i + 1) * 1.8 + .02, GLASS); }
      g.box(4.0, 2.4, .1, 0, 1.6, 2.15, 0x3a3f44); for (let k = 0; k < 5; k++) g.box(3.9, .05, .04, 0, .7 + k * .45, 2.21, 0x2a2e33);
      g.box(4.4, .25, .14, 0, 2.92, 2.17, 0, { acc: .95 }); for (const s of [-1, 1]) g.box(.2, 2.5, .14, s * 2.1, 1.65, 2.17, 0xe8c840);
      g.box(.08, 1.6, .9, 3.32, 1.2, .5, DARK); g.cyl(.38, .48, 3.2, 8, -2.6, 5.0, -2.6, CONC2); g.cyl(.5, .5, .25, 8, -2.6, 6.2, -2.6, 0, { acc: .9 });
      for (const [x, z, c] of [[-3.55, 1.2, 0x8a3a30], [-3.55, 1.85, 0x3d5a80], [-3.55, 2.5, 0x8a3a30]]) g.cyl(.26, .26, .65, 8, x, .72, z, c);
      if (L >= 2) {
        const Y = 0xe8b830; for (const s of [-1, 1]) g.box(.25, 4.1, .25, s * 2.6, 2.45, 3.35, Y); g.box(5.6, .35, .35, 0, 4.6, 3.35, Y); g.box(.6, .3, .5, .8, 4.3, 3.35, DARK); g.box(.03, 1.4, .03, .8, 3.45, 3.35, BLACK); g.box(.7, .6, .7, .8, 2.45, 3.35, 0, { acc: .9 });
        g.box(.7, 1.8, 3.0, 3.7, 1.3, -1.2, KHAKI); wedge(g, 3.0, .5, .8, 3.7, 2.45, -1.2, CONC2, { ry: -PI / 2 });
      }
      if (L >= 3) {
        g.cyl(.34, .42, 2.8, 8, -1.4, 4.8, -2.7, CONC2); g.cyl(.45, .45, .22, 8, -1.4, 5.9, -2.7, 0, { acc: .9 });
        g.box(2.0, 2.2, 1.6, 2.0, 4.5, -2.4, CONC); g.box(2.1, .15, 1.7, 2.0, 5.65, -2.4, 0, { acc: 1 }); g.box(1.8, .45, .05, 2.0, 5.0, -1.58, GLASS); g.box(.04, 1.6, .04, 2.7, 6.4, -2.8, BLACK);
        g.box(2.0, .45, 1.2, -1.2, .65, 3.0, OLIVE); for (const z of [2.42, 3.58]) g.box(2.0, .3, .12, -1.2, .55, z, TRK); g.box(.9, .35, .85, -1.3, 1.05, 3.0, OLIVE); g.box(1.0, .08, .08, -.4, 1.07, 3.0, DARK); g.box(.7, .04, .65, -1.3, 1.24, 3.0, 0, { acc: 1 });
      }
      return [part(g)];
    }
    case 'airfield': {   // helipad, control tower and hangar (L1), second hangar and windsock (L2), radar mast and pad lights (L3)
      g.box(9, .3, 9, 0, .15, 0, CONC2); g.box(5.0, .04, 5.0, -1.2, .32, 1.8, 0x55585c);
      g.cyl(2.1, 2.1, .03, 16, -1.2, .35, 1.8, 0xe8c840); g.cyl(1.85, 1.85, .04, 16, -1.2, .36, 1.8, 0x55585c);
      g.box(.35, .03, 1.8, -1.85, .39, 1.8, WHITE); g.box(.35, .03, 1.8, -.55, .39, 1.8, WHITE); g.box(1.0, .03, .35, -1.2, .39, 1.8, WHITE);
      g.box(1.5, 4.4, 1.5, -3.0, 2.5, -2.9, CONC); fcyl(g, 8, 1, 1.35, .1, 1.35, -3.0, 4.65, -2.9, CONC2, { ry: PI / 8 }); fcyl(g, 8, 1.2, 1.1, 1.1, 1.1, -3.0, 5.25, -2.9, GLASS, { ry: PI / 8 });
      fcyl(g, 8, .75, 1.6, .35, 1.6, -3.0, 5.98, -2.9, 0, { acc: 1, ry: PI / 8 }); g.box(.05, 1.4, .05, -3.0, 6.8, -2.9, BLACK);
      hcyl(g, 12, 1.65, 4.6, 2.7, .3, -1.6, 0x8a9299); for (const k of [-1, 1]) hcyl(g, 12, 1.69, .22, 2.7, .3, -1.6 + k * 2.2, 0, { acc: .9 }); g.box(2.2, 1.3, .06, 2.7, .95, .72, 0x3a3f44);
      if (L >= 2) { hcyl(g, 12, 1.15, 3.2, -.35, .3, -2.6, 0x8a9299); hcyl(g, 12, 1.19, .2, -.35, .3, -1.1, 0, { acc: .9 }); g.box(1.5, .9, .06, -.35, .75, -.98, 0x3a3f44);
        g.cyl(.05, .05, 2.4, 5, 2.5, 1.5, 3.9, 0xcfd3d8); g.cone(.22, .9, 6, 2.5, 2.55, 4.35, 0xff7a2a, { rx: PI / 2 + .2 }); }
      if (L >= 3) { lattice(g, 3.4, 2.5, .3, 4.6, .45, .18, STEEL); const r = new GB(); scyl(r, 12, 4.4, .3, .35, .3, 0, .1, .1, WHITE, { rx: .8 }); r.cyl(.1, .1, .4, 6, 0, -.25, 0, STEEL); parts.push(part(r, 'rotor', 3.4, 5.0, 2.5, 1.2));
        for (const x of [-3.6, 1.2]) for (const z of [-.6, 1.8, 4.2]) g.box(.18, .14, .18, x, .4, z, 0x8be05a); }
      parts.unshift(part(g)); return parts;
    }
    case 'farm': {   // tilled soil, crop rows and a grain silo (L1); more rows and a red barn (L2); a second silo and a windmill (L3)
      g.box(5, .22, 5, 0, .11, 0, 0x6b4f2e);
      const rows = L >= 2 ? 5 : 3; for (let i = 0; i < rows; i++) g.box(.42, .34 + (i % 2) * .08, 2.6, -2 + i * .7, .36, 1.0, i % 2 ? 0x7fae3a : 0x9cc24a);
      g.cyl(.62, .62, 2.6, 12, 1.65, 1.5, -1.55, 0xc9ccd0); ball(g, .62, .45, .62, 1.65, 2.8, -1.55, 0xb0b4b8); for (const y of [.9, 1.7, 2.4]) g.cyl(.64, .64, .06, 12, 1.65, y, -1.55, STEEL);
      g.box(.06, .7, 4.8, -2.45, .55, 0, WOOD); g.box(4.8, .06, .06, 0, .75, 2.45, WOOD);
      if (L >= 2) { g.box(1.7, 1.2, 1.4, -1.35, .82, -1.6, 0x9b2f24); g.box(1.9, .12, 1.6, -1.35, 1.48, -1.6, 0x5a2a20, { rz: .0 }); g.box(.6, .8, .06, -1.35, .62, -.88, 0xe8e2d0); }
      if (L >= 3) { g.cyl(.48, .48, 2.0, 12, .55, 1.2, -1.9, 0xc9ccd0); ball(g, .48, .35, .48, .55, 2.2, -1.9, 0xb0b4b8);
        g.box(.14, 3.2, .14, 2.1, 1.7, 1.9, STEEL); for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; g.box(.08, 1.1, .22, 2.1 + Math.sin(a) * .55, 3.3 + Math.cos(a) * .55, 1.78, 0xe8e2d0, { rz: -a }); } }
      return [part(g)];
    }
    case 'depot': {   // fuel tank and crates (L1), a second tank and more stock (L2), a covered store (L3)
      g.box(5, .3, 5, 0, .15, 0, CONC2);
      g.cyl(.8, .8, 2.8, 10, -.6, 1.25, -1.45, 0xb8bec4, { rz: PI / 2 }); for (const x of [-2.0, .8]) ball(g, .3, .8, .8, x, 1.25, -1.45, 0xb8bec4); g.cyl(.83, .83, .35, 10, -.6, 1.25, -1.45, 0, { acc: .95, rz: PI / 2 });
      for (const x of [-1.6, .4]) g.box(.25, .55, 1.3, x, .55, -1.45, DARK); g.box(.06, 1.6, .06, .95, 1.1, -.75, STEEL);
      crate(g, .9, .3, 1.0, .9, WOOD); crate(g, 1.85, .3, 1.2, .8, 0x5d6e46); g.box(.65, .65, .65, 1.85, 1.43, 1.2, 0, { acc: .9 }); g.box(.67, .1, .67, 1.85, 1.43, 1.2, DARK);
      g.box(1.1, .12, 1.1, -1.4, .36, 1.4, WOOD); for (const [x, z, c] of [[-1.65, 1.15, 0x8a3a30], [-1.15, 1.15, 0x3d5a80], [-1.4, 1.65, 0x5d6e46]]) g.cyl(.24, .24, .7, 8, x, .77, z, c);
      if (L >= 2) { g.cyl(.62, .62, 2.3, 10, 1.7, 1.45, -1.5, 0xb8bec4); ball(g, .62, .25, .62, 1.7, 2.6, -1.5, 0xb8bec4); g.cyl(.65, .65, .3, 10, 1.7, 1.9, -1.5, 0, { acc: .95 }); crate(g, .9, 1.2, 1.0, .65, WOOD); crate(g, -.2, .3, 2.1, .6, WOOD); }
      if (L >= 3) { for (const x of [-.1, 2.3]) for (const z of [.15, 2.2]) g.box(.12, 2.4, .12, x, 1.5, z, STEEL); g.box(2.8, .12, 2.5, 1.1, 2.75, 1.15, 0, { acc: .95 }); g.box(2.9, .08, 2.6, 1.1, 2.66, 1.15, DARK);
        g.box(1.0, .8, .9, -1.5, .8, -.1, 0xd8a52c); g.box(.08, 1.3, .08, -1.85, 1.3, .3, DARK); g.box(.5, .08, .4, -1.85, .5, .75, DARK); }
      return [part(g)];
    }
    case 'radar': {   // ops hut and lattice mast with a turning dish; taller mast (L2); radome and a second dish (L3)
      g.box(3.8, .3, 3.8, 0, .15, 0, CONC2); const H = L >= 2 ? 6.2 : 4.4;
      g.box(1.4, 1.2, 1.3, -.95, .9, 1.05, CONC); g.box(1.5, .12, 1.4, -.95, 1.56, 1.05, 0, { acc: 1 }); g.box(.9, .4, .05, -.95, 1.05, 1.72, GLASS); g.box(.4, .8, .05, -.6, .7, 1.72, DARK);
      g.box(.8, .6, .7, 1.15, .6, 1.2, STEEL); g.box(.82, .08, .72, 1.15, .94, 1.2, 0, { acc: .9 });
      lattice(g, 0, -.4, .3, H, .6, .22, STEEL); g.box(.9, .12, .9, 0, H, -.4, STEEL);
      if (L >= 2) { g.box(1.2, 1.0, 1.2, -1.2, .8, -1.3, CONC2); g.box(1.3, .1, 1.3, -1.2, 1.35, -1.3, 0, { acc: .9 }); }
      const r = new GB(); scyl(r, 12, 4.4, .36, .45, .36, 0, .1, .1, WHITE, { rx: .8 }); rod(r, .04, 6, 0, .2, .2, 0, 1.0, 1.0, STEEL); r.box(.2, .2, .2, 0, 1.0, 1.0, 0, { acc: 1 }); r.box(.5, .5, .5, 0, -.15, -.15, STEEL, { rx: .8 }); r.cyl(.15, .15, .5, 6, 0, -.4, 0, STEEL);
      if (L >= 3) { g.box(1.3, .5, 1.3, 1.3, .55, -1.3, CONC2); g.sph(.85, .85, .85, 1.3, 1.35, -1.3, WHITE); g.box(1.32, .1, 1.32, 1.3, .82, -1.3, 0, { acc: 1 }); g.cyl(.07, .07, .6, 6, -.95, 1.9, 1.05, STEEL); }
      parts.push(part(g), part(r, 'rotor', 0, H + .75, -.4, 1.4));
      if (L >= 3) { const r2 = new GB(); scyl(r2, 10, 4, .25, .3, .25, 0, .08, .08, WHITE, { rx: .8 }); parts.push(part(r2, 'rotor', -.95, 2.3, 1.05, -1.1)); }
      return parts;
    }
    case 'wall': { // only used for the build icon; the real walls are drawn as a ring (see wallPools)
      for (let i = -2; i <= 2; i++) { g.box(2.1, .8, 1.0, i * 2.2, .4, Math.abs(i) * -.5, CONC); g.box(2.16, .16, 1.06, i * 2.2, .86, Math.abs(i) * -.5, 0, { acc: 1 }); }
      g.box(.5, 1.4, .5, -5.2, .7, -1.3, CONC2); g.box(.5, 1.4, .5, 5.2, .7, -1.3, CONC2);
      return [part(g)];
    }
    case 'turret': {   // MG bunker: concrete pillbox (L1), thicker and taller with a radio mast (L2), armour plates and a searchlight (L3)
      const top = L >= 2 ? 1.75 : 1.65;
      fcyl(g, 10, .88, 2.2, .5, 2.2, 0, .25, 0, CONC2); sandbags(g, 2.35, 13);
      fcyl(g, 8, .82, 1.4, top - .5, 1.4, 0, (top + .5) / 2, 0, CONC, { ry: PI / 8 }); fcyl(g, 8, 1, 1.27, .15, 1.27, 0, top - .42, 0, DARK, { ry: PI / 8 }); fcyl(g, 8, 1, 1.2, .06, 1.2, 0, top + .02, 0, 0, { acc: .9, ry: PI / 8 });
      if (L >= 2) { fcyl(g, 10, .9, 1.9, .45, 1.9, 0, .72, 0, CONC2); g.box(.04, 1.6, .04, -.75, top + .8, -.75, BLACK); g.box(.5, .35, .4, 1.15, 1.12, -.9, 0x4d5a3a, { ry: .8 }); }
      if (L >= 3) { for (let i = 0; i < 8; i++) { const a = (i + .5) / 8 * TAU; g.box(.95, .85, .12, Math.sin(a) * 1.5, .95, Math.cos(a) * 1.5, 0x5a636c, { ry: a, rx: -.18 }); } g.box(.3, .3, .35, .75, top + .2, -.75, LAMP); g.box(.36, .1, .4, .75, top + .02, -.75, DARK); }
      const t = new GB(), tc = 0x6a737c; t.cyl(.62, .72, .3, 8, 0, -.12, 0, STEEL); t.box(1.3, .55, 1.3, 0, .2, 0, tc); t.box(1.1, .04, 1.1, 0, .49, 0, 0, { acc: 1 });
      if (spec === 'at') { t.box(1.5, .75, .14, 0, .25, .72, tc, { rx: -.25 }); rod(t, .14, 8, 0, .2, .6, 0, .2, 3.1, DARK); t.cyl(.2, .2, .45, 8, 0, .2, 1.4, DARK, { rx: PI / 2 }); t.box(.4, .3, .35, 0, .2, 3.1, STEEL); }
      else if (spec === 'flak') { const e = .55; for (const x of [-.42, .42]) { rod(t, .08, 6, x, .4, .3, x, .4 + 2.1 * Math.sin(e), .3 + 2.1 * Math.cos(e), BLACK); t.cyl(.12, .12, .3, 6, x, .4 + 2.0 * Math.sin(e), .3 + 2.0 * Math.cos(e), DARK, { rx: PI / 2 - e }); } t.cyl(.5, .14, .1, 8, 0, .62, -.45, STEEL); t.box(.3, .3, .4, 0, .62, .2, DARK); }
      else if (spec === 'twin') { t.box(1.3, .55, .1, 0, .22, .68, tc, { rx: -.2 }); t.box(1.32, .1, .12, 0, .47, .64, 0, { acc: .9, rx: -.2 }); for (const x of [-.32, .32]) { rod(t, .08, 6, x, .14, .6, x, .14, 2.2, BLACK); t.box(.22, .25, .3, x * 1.9, .14, .1, 0x4d5a3a); } }
      else { t.box(1.2, .55, .08, 0, .22, .68, tc, { rx: -.2 }); t.box(1.22, .1, .1, 0, .47, .64, 0, { acc: .9, rx: -.2 }); rod(t, .075, 6, 0, .15, .6, 0, .15, 1.9 + L * .2, BLACK); t.cyl(.11, .11, .3, 6, 0, .15, 1.0, DARK, { rx: PI / 2 }); t.box(.24, .26, .3, .4, .14, .1, 0x4d5a3a); }
      parts.push(part(g), part(t, 'turret', 0, top + .3, 0)); return parts;
    }
    case 'arty': {   // gun pit: howitzer on a concrete plinth (L1), double sandbag wall and shell racks (L2), ammo bunker and radio mast (L3)
      g.box(4.4, .5, 4.4, 0, .25, 0, CONC2); fcyl(g, 10, .92, 1.5, .8, 1.5, 0, .9, 0, CONC); fcyl(g, 10, 1, 1.4, .06, 1.4, 0, 1.31, 0, 0, { acc: .85 });
      sandbags(g, 1.8, 14, .4, .5, -PI / 2); crate(g, 1.8, .5, 1.8, .5, WOOD);
      if (L >= 2) { sandbags(g, 1.8, 14, .4, .78, -PI / 2); for (let i = 0; i < 4; i++) g.cyl(.08, .08, .55, 6, -2.0 + i * .2, .83, 1.85, 0x8a7a3a); g.box(.8, .08, .3, -1.7, .55, 1.85, WOOD); }
      if (L >= 3) { g.box(.75, .65, .65, -1.85, .82, -1.85, CONC); g.box(.85, .1, .75, -1.85, 1.19, -1.85, 0, { acc: .9 }); g.box(.04, 2.0, .04, 1.95, 1.5, -1.95, BLACK); g.box(.35, .3, .3, 1.85, .65, -1.75, 0x4d5a3a); }
      const t = new GB(), c = OLIVE, e = .5, BL = 4.0 + (spec === 'howitzer' ? 1.5 : 0), br = .2 + L * .03, py = .4, pz = .4, ey = Math.sin(e), ez = Math.cos(e);
      t.box(1.6, .5, 1.8, 0, -.2, 0, c); for (const s of [-1, 1]) t.box(.2, .7, .9, s * .52, .3, .25, shade(c, .8)); t.box(1.4, .04, 1.0, 0, .06, -.4, 0, { acc: 1 });
      t.box(1.9, 1.0, .14, 0, .4, .95, c, { rx: -.15 }); t.box(1.92, .14, .16, 0, .86, .88, 0, { acc: 1, rx: -.15 });
      rod(t, br, 8, 0, py, pz, 0, py + BL * ey, pz + BL * ez, STEEL); rod(t, br * .5, 6, 0, py + .25, pz - .1, 0, py + .25 + 1.6 * ey, pz - .1 + 1.6 * ez, DARK);
      t.box(br * 2.6 + (spec === 'howitzer' ? .15 : 0), br * 1.8, .45, 0, py + BL * ey, pz + BL * ez, DARK, { rx: -e });
      if (spec === 'salvo') { for (const x of [-1.15, 1.15]) { t.box(.45, .45, 2.2, x, .7, .5, DARK, { rx: -.5 }); t.box(.38, .38, .04, x, .7 + 1.1 * Math.sin(.5) + .01, .5 + 1.1 * Math.cos(.5), RED, { rx: -.5 }); } }
      if (spec === 'shock') { for (const x of [-.75, .75]) t.cyl(.12, .12, .5, 6, x, .9, .7, WHITE, { rx: PI / 2 - .5 }); }
      parts.push(part(g), part(t, 'turret', 0, 1.8, 0)); return parts;
    }
    case 'cannon': {   // 4.2 cannon tower: square concrete tower, armored gun house with a long barrel
      const H = 1.6 + L * .45; g.box(3.2, .4, 3.2, 0, .2, 0, CONC2); fcyl(g, 4, .82, 1.6, H, 1.6, 0, .4 + H / 2, 0, CONC, { ry: PI / 4 }); g.box(2.4, .12, 2.4, 0, .45 + H, 0, 0, { acc: .9 });
      if (L >= 2) for (const s of [-1, 1]) g.box(.18, H * .8, 2.2, s * 1.05, .4 + H * .45, 0, 0x5a636c); if (L >= 3) { g.box(.05, 1.8, .05, -1, H + 1.3, -1, BLACK); sandbags(g, 2.1, 12); }
      const t = new GB(), c = 0x5f6a55, BL = spec === 'lbarrel' ? 4.4 : 3.4; t.box(1.6, .8, 1.8, 0, .2, -.1, c); t.box(1.62, .12, 1.82, 0, .62, -.1, 0, { acc: 1 }); wedge(t, 1.6, .5, .5, 0, .25, .95, c);
      rod(t, spec === 'hgun' ? .22 : .16, 8, 0, .25, .9, 0, .25, .9 + BL, DARK); t.cyl(.25, .25, .4, 8, 0, .25, .9 + BL, BLACK, { rx: PI / 2 }); if (spec === 'autol') t.box(.6, .5, .7, .8, .25, -.6, STEEL);
      parts.push(part(g), part(t, 'turret', 0, .9 + H, 0)); return parts;
    }
    case 'flakt': {   // flak tower: tall hexagonal tower, four raised flak barrels on top
      const H = 2.6 + L * .5; fcyl(g, 6, .78, 1.7, H, 1.7, 0, H / 2, 0, CONC); fcyl(g, 6, 1, 1.9, .3, 1.9, 0, H, 0, CONC2); fcyl(g, 6, 1, 1.92, .08, 1.92, 0, H + .17, 0, 0, { acc: .9 });
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.box(.3, .5, .1, Math.cos(a) * 1.75, H + .4, Math.sin(a) * 1.75, CONC2, { ry: -a + PI / 2 }); } if (L >= 2) g.box(.6, .8, .6, 1.2, .4, 1.2, CONC2); if (L >= 3) g.box(.05, 1.6, .05, -1.2, H + 1.1, -1.2, BLACK);
      const t = new GB(), e = .7; t.cyl(.55, .65, .35, 8, 0, 0, 0, STEEL); t.box(1.2, .5, .9, 0, .3, 0, OLIVE); t.box(1.22, .08, .92, 0, .56, 0, 0, { acc: 1 });
      for (const x of [-.45, -.15, .15, .45]) rod(t, .07, 6, x, .45, .3, x, .45 + 1.8 * Math.sin(e), .3 + 1.8 * Math.cos(e), BLACK);
      parts.push(part(g), part(t, 'turret', 0, H + .4, 0)); return parts;
    }
    case 'mortarpit': {   // mortar pit: round sandbagged pit with two mortar tubes and shell stacks
      g.cyl(1.7, 1.8, .3, 10, 0, .15, 0, TAN); sandbags(g, 1.7, 14, .45, 0, -PI / 2); if (L >= 2) sandbags(g, 1.7, 14, .45, .28, -PI / 2); if (L >= 3) sandbags(g, 1.75, 14, .45, .56, -PI / 2);
      for (let i = 0; i < 3 + L; i++) g.cyl(.09, .09, .45, 6, -1 + i * .22, .5, -1.15, 0x8a7a3a); crate(g, 1.05, .3, -1.05, .45, WOOD); flag(g, -1.3, .3, 1.3, 2.4);
      const t = new GB(), e = .9; for (const x of [-.45, .45]) { rod(t, .14, 8, x, 0, 0, x, 1.3 * Math.sin(e), 1.3 * Math.cos(e), DARK); t.box(.5, .08, .5, x, -.05, 0, STEEL); }
      t.box(.24, .24, .24, 0, .1, -.3, 0, { acc: .9 }); parts.push(part(g), part(t, 'turret', 0, .4, 0)); return parts;
    }
    case 'tesla': {   // tesla tower: steel lattice mast with coil rings and a glowing ball
      const H = 3.2 + L * .5; g.cyl(1.3, 1.5, .4, 8, 0, .2, 0, CONC2); g.cyl(1.32, 1.32, .08, 8, 0, .42, 0, 0, { acc: .9 }); lattice(g, 0, 0, .4, H, .7, .25, STEEL);
      for (let i = 0; i < 3 + L; i++) g.cyl(.55 - i * .05, .55 - i * .05, .1, 10, 0, 1.2 + i * (H - 1.6) / (3 + L), 0, 0xb0763a);
      ball(g, .55, .55, .55, 0, H + .4, 0, 0x8fe8ff); for (const a of [0, PI * 2 / 3, PI * 4 / 3]) rod(g, .05, 5, 0, H + .3, 0, Math.cos(a) * .9, H + .9, Math.sin(a) * .9, 0x8fe8ff);
      if (spec === 'tarc') ball(g, .25, .25, .25, 0, H + 1.2, 0, 0x8fe8ff);
      parts.push(part(g)); return parts;
    }
    case 'shieldgen': {   // shield generator: core under a glowing dome, three emitter pylons
      g.cyl(1.8, 1.9, .4, 10, 0, .2, 0, CONC2); g.cyl(1.82, 1.82, .08, 10, 0, .42, 0, 0, { acc: .9 }); g.cyl(.7, .9, 1.0 + L * .2, 8, 0, .9, 0, STEEL);
      dome(g, 1.2, 1.0 + L * .15, 1.2, 0, 1.4 + L * .2, 0, 0x6fd6ff); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; rod(g, .09, 6, Math.cos(a) * 1.5, .4, Math.sin(a) * 1.5, Math.cos(a) * 1.5, 2.2 + L * .4, Math.sin(a) * 1.5, STEEL); ball(g, .18, .18, .18, Math.cos(a) * 1.5, 2.3 + L * .4, Math.sin(a) * 1.5, 0x8fe8ff); }
      parts.push(part(g)); return parts;
    }
    case 'shipyard': {   // slipway and pier over the water (+z), a work shed, a gantry crane; L2 a dry-dock wall, L3 a second crane
      g.box(7.2, .5, 5, 0, .25, -1.6, CONC2); g.box(7.3, .08, .3, 0, .52, .85, 0, { acc: .9 });
      g.box(3.2, .3, 6.6, 1.3, .38, 3.0, WOOD); for (let z = 1.2; z <= 6; z += 1.6) for (const x of [-.15, 2.75]) g.cyl(.14, .14, 2.6, 6, x, -.8, z, 0x4a3b2b);
      for (const z of [1.6, 3.6, 5.6]) g.cyl(.12, .14, .3, 6, 2.75, .65, z, BLACK);
      g.box(2.8, 2.4, 3.2, -2.1, 1.45, -2.2, CONC); g.box(3.0, .2, 3.4, -2.1, 2.75, -2.2, 0, { acc: .92 }); g.box(1.9, 1.6, .1, -2.1, 1.1, -.58, 0x3a3f44); g.box(1.6, .1, .12, -2.1, 1.96, -.55, LAMP);
      const H = 5.2 + L * .4; lattice(g, 2.9, -2.6, .5, H, .38, .22, 0xd8a52c); strut(g, 2.9, H + .1, -3.4, 2.9, H + .1, 3.4, .26, .26, 0xd8a52c); g.box(.6, .5, .6, 2.9, H + .1, -3.3, 0x8a6a2a); rod(g, .03, 4, 2.9, H, 2.9, 2.9, H - 2.4, 2.9, BLACK); g.box(.3, .25, .3, 2.9, H - 2.5, 2.9, STEEL);
      g.box(1.3, .7, 3.2, 1.3, .88, 3.4, STEEL); fcyl(g, 3, 1, .74, .7, 1.1, 1.3, .88, 5.5, STEEL); g.box(.8, .5, .9, 1.3, 1.45, 2.9, 0x8a9096);   // a hull on the slipway
      crate(g, -3.2, .5, .1, .7, WOOD); crate(g, -2.4, .5, .3, .5, 0x6a7a50); flag(g, -3.3, .5, -3.9, 3.2);
      if (L >= 2) { g.box(.3, 1.2, 6.2, -.3, .7, 3.0, CONC2); g.box(.36, .1, 6.3, -.3, 1.32, 3.0, 0, { acc: .9 }); }
      if (L >= 3) { lattice(g, -1.2, 5.6, -.4, H - .6, .3, .18, 0xd8a52c); strut(g, -1.2, H - .5, 5.6, 1.6, H - .5, 5.6, .2, .2, 0xd8a52c); }
      parts.push(part(g)); return parts;
    }
    case 'nest': {   // engineer-built sandbag MG nest
      g.cyl(.9, 1.0, .25, 8, 0, .12, 0, TAN); sandbags(g, 1.3, 9, .5, 0, -PI / 2); sandbags(g, 1.25, 8, .55, .26, -PI / 2);
      const t = new GB(); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + PI / 2; strut(t, 0, -.05, 0, Math.sin(a) * .4, -.7, Math.cos(a) * .4, .05, .05, DARK); }
      t.box(.16, .18, .6, 0, .05, .15, BLACK); rod(t, .045, 6, 0, .07, .4, 0, .07, 1.15, BLACK); t.box(.18, .18, .2, .17, .0, .1, 0x4d5a3a); t.box(.62, .42, .06, 0, .12, .42, 0, { acc: .9 });
      parts.push(part(g), part(t, 'turret', 0, .9, 0)); return parts;
    }
  }
  return [part(g)];
}
// 3.0: Legion buildings get their own pools (and icons, 'b_<type>~L')
const bFac = b => { const p = W && W.players[b.owner]; return p && p.fac === 1 ? 1 : 0; };
const BPOOLKEY = (b) => b.type + '|' + b.lvl + '|' + ((BT[b.type].def || b.type === 'hq') ? b.spec : '') + (bFac(b) ? '|L' : '');
const bIcon = (type, fac) => 'b_' + type + (fac === 1 ? '~L' : '');
function bModelF(type, lvl, spec, fac) { return fac === 1 ? lgBModel(type, lvl, spec) : bModel(type, lvl, spec); }
