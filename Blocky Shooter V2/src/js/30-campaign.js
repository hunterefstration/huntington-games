// ==========================================
// 5.0 CAMPAIGN: story missions with objectives, stars and rewards
// A mission is a normal arena run (same weapons, armory, zombies) with its own goal instead of endless waves.
// Progress is saved in its own key (blocky50_campaign). Nothing here touches the normal run save.
// ==========================================
const CAMP_KEY = 'blocky50_campaign';
const campSave = (() => {
    const s = loadJSON(CAMP_KEY, {}), o = { v: 1, done: {}, skins: {} };
    if (s && typeof s === 'object') {
        if (s.done && typeof s.done === 'object') for (const k in s.done) { const d = s.done[k]; if (d && typeof d === 'object') o.done[k] = { s: clamp(d.s | 0, 0, 3), t: Math.max(0, +d.t || 0), d: Math.max(0, d.d | 0) }; }
        if (s.skins && typeof s.skins === 'object') for (const k in s.skins) if (s.skins[k]) o.skins[k] = 1;
    }
    return o;
})();
CAMP.skins = campSave.skins;
function campOwns(kind, id) { return !!CAMP.skins[kind + ':' + id]; }
const CAMP_SKINS = ['ember', 'hazard', 'warden', 'static', 'toxin', 'outbreak'];
function campSkin(kind, id) { return kind === 'camo' && CAMP_SKINS.includes(id); }
function campWrite() { saveJSON(CAMP_KEY, campSave); }

// ---------- story people (blocky portraits drawn as tiny SVGs) ----------
const CAMP_PEOPLE = {
    rook:  { name: 'SGT. MARA ROOK', role: 'SQUAD LEADER', skin: '#d9a066', hair: '#3b2a1e', hat: '#4d5d2a', accent: '#65a30d', col: '#a3e635' },
    wren:  { name: 'WREN', role: 'RADIO OPERATOR', skin: '#f1c9a0', hair: '#7c3aed', hat: '#1f2937', accent: '#6d28d9', col: '#c4b5fd', phones: 1 },
    doc:   { name: 'DR. IMANI COLE', role: 'FIELD MEDIC', skin: '#8d5a3b', hair: '#111827', hat: '#e5e7eb', accent: '#16a34a', col: '#86efac' },
    gears: { name: 'TOBIAS "GEARS" VANCE', role: 'ENGINEER', skin: '#e0ac82', hair: '#7c2d12', hat: '#f59e0b', accent: '#c2410c', col: '#fdba74' },
    cmd:   { name: 'COMMAND', role: 'HQ - ENCRYPTED LINE', skin: '#64748b', hair: '#0f172a', hat: '#0f172a', accent: '#a16207', col: '#fde047', visor: 1 },
    lang:  { name: 'DR. HELEN LANG', role: 'LEAD RESEARCHER', skin: '#f1c9a0', hair: '#9ca3af', hat: '#e5e7eb', accent: '#0e7490', col: '#67e8f9', phones: 0 },
    zero:  { name: 'PATIENT ZERO', role: 'THE FIRST TO FALL', skin: '#9bbf6a', hair: '#1a2e05', hat: '#3f6212', accent: '#365314', col: '#bef264', scar: 1 },
    voss:  { name: 'COL. ADRIAN VOSS', role: 'THE WARLORD', skin: '#9ca3af', hair: '#e5e7eb', hat: '#4d5d2a', accent: '#3f3f46', col: '#f87171', scar: 1 }
};
function campPortrait(w, cls) {
    const p = CAMP_PEOPLE[w] || CAMP_PEOPLE.cmd;
    return `<svg class="cport ${cls}" viewBox="0 0 32 32" shape-rendering="crispEdges"><rect width="32" height="32" fill="#0f172a"/><rect x="4" y="25" width="24" height="7" fill="${p.accent}"/>` +
        `<rect x="9" y="7" width="14" height="17" fill="${p.skin}"/><rect x="8" y="6" width="16" height="4" fill="${p.hair}"/><rect x="7" y="3" width="18" height="4" fill="${p.hat}"/>` +
        (p.visor ? '<rect x="9" y="12" width="14" height="4" fill="#38bdf8" opacity=".85"/>' : '<rect x="12" y="13" width="3" height="2" fill="#111"/><rect x="18" y="13" width="3" height="2" fill="#111"/>') +
        (p.phones ? '<rect x="6" y="11" width="3" height="7" fill="#111827"/><rect x="23" y="11" width="3" height="7" fill="#111827"/><rect x="9" y="20" width="5" height="1" fill="#111827"/>' : '') +
        (p.scar ? '<rect x="19" y="10" width="1" height="9" fill="#7f1d1d"/>' : '') +
        `<rect x="13" y="19" width="6" height="1" fill="#7f1d1d"/><rect x="20" y="27" width="4" height="2" fill="#fff" opacity=".7"/></svg>`;
}

// ---------- CHAPTER 1: ASHFALL (6 missions) ----------
// stages: survive {n} / hold {secs,r} / rescue {n,need} / repair {n,secs,hp} / defend {secs,hp} / intel {n} / extract {secs} / boss {id}
// cap = most zombies alive at once, rate = seconds between spawns. lvl = zombie strength (like a wave number).
// s2 = star 2 (no deaths, or a time), s3 = the bonus objective.
const CAMP_CHAPTERS = [{
    id: 1, name: 'ASHFALL', blurb: 'The outbreak reaches the city. Rook\'s squad has one night to reach the evacuation point.',
    missions: [
        { id: 'c1m1', name: 'FIRST LIGHT', map: 'blockyard', light: 'sunset', diff: 'normal', lvl: 1, cash: 400, lives: 3,
          sum: 'Survive 3 waves at the Blockyard.',
          brief: [{ w: 'rook', t: 'Listen up, rookie. The dead started walking six hours ago and the Blockyard is the only place with walls and sightlines. We dig in here until the sun goes down.' },
                  { w: 'cmd', t: 'Command to Rook: sweep the yard clear. Three waves, then hold position for the next orders. Spend your starting cash at the ARMORY (pause menu) before you need it.' }],
          out: { w: 'rook', t: 'Not bad. You are still standing, and that is more than most. Get some rest. Tomorrow it gets worse.' },
          stages: [{ t: 'survive', n: 3 }], s2: { k: 'nodeath', txt: 'Finish without going down' }, s3: { k: 'heads', v: 12, txt: 'Get 12 headshots' },
          reward: { cash: 500, xp: 300 } },
        { id: 'c1m2', name: 'HOLD THE LINE', map: 'fortress', light: 'night', diff: 'normal', lvl: 3, cash: 700, lives: 3,
          sum: 'Hold the relay zone until the uplink is complete.',
          brief: [{ w: 'wren', t: 'Wren here. The old relay in the fortress yard can still reach the evac chopper, but the uplink needs a full minute and a quarter of power, and it only works while someone stands in the circle.' },
                  { w: 'rook', t: 'That someone is you. Stay inside the capture zone. If you leave, the signal bleeds off. They will come from every side, so use the walls.' }],
          out: { w: 'wren', t: 'Uplink is up! The chopper has our position. It cannot land here though. We need to move to the city.' },
          stages: [{ t: 'hold', secs: 75, r: 10, cap: 9, rate: 3.2 }], s2: { k: 'time', v: 140, txt: 'Finish in under 2:20' }, s3: { k: 'dmg', v: 80, txt: 'Lose less than 80 health in total' },
          reward: { cash: 700, xp: 450, skin: 'camo:ember' } },
        { id: 'c1m3', name: 'NO ONE LEFT BEHIND', map: 'downtown', light: 'sunset', diff: 'normal', lvl: 4, cash: 900, lives: 3,
          sum: 'Rescue 3 survivors and escort them to extraction.',
          brief: [{ w: 'doc', t: 'Doctor Cole. I have three civilians pinned down in the downtown blocks. They are hurt, scared, and out of ammunition.' },
                  { w: 'rook', t: 'Go to each one and stay close until they are free. They will follow you. Zombies will go for them too, so keep them alive and bring them back to the drop point where you started.' }],
          out: { w: 'doc', t: 'They are safe. I will patch them up. You did a good thing out there, soldier.' },
          stages: [{ t: 'rescue', n: 3, need: 2, cap: 11, rate: 4 }], s2: { k: 'nodeath', txt: 'Finish without going down' }, s3: { k: 'allsurv', txt: 'Bring all 3 survivors home alive' },
          reward: { cash: 800, xp: 500 } },
        { id: 'c1m4', name: 'DEAD GRID', map: 'shipyard', light: 'night', diff: 'normal', lvl: 6, cash: 1200, lives: 3,
          sum: 'Repair 3 generators, then defend the barricade.',
          brief: [{ w: 'gears', t: 'Gears. The shipyard cranes run on three generators and the whole grid is dead. Fix them and we can lift the container wall across the gate.' },
                  { w: 'gears', t: 'Stand next to a glowing generator and I will talk you through the repairs. The noise draws every zombie in the yard though. Protect the machines, then hold the barricade while the wall goes up.' }],
          out: { w: 'gears', t: 'Grid is humming and the wall is holding. Not bad for a soldier who cannot turn a wrench!' },
          stages: [{ t: 'repair', n: 3, secs: 12, hp: 420, cap: 12, rate: 3.6 }, { t: 'defend', secs: 60, hp: 1400, cap: 14, rate: 3 }],
          s2: { k: 'time', v: 330, txt: 'Finish in under 5:30' }, s3: { k: 'barr', v: 0.5, txt: 'Barricade ends above 50% health' },
          reward: { cash: 1000, xp: 650, skin: 'camo:hazard' } },
        { id: 'c1m5', name: 'BLACKOUT RUN', map: 'military', light: 'storm', diff: 'normal', lvl: 8, cash: 1600, lives: 3,
          sum: 'Collect 4 intel drives, then reach extraction before time runs out.',
          brief: [{ w: 'cmd', t: 'Command to all units. We have lost contact with the base commander, but the intel drives in the Military Base compound hold the location of the cure research. We need them.' },
                  { w: 'wren', t: 'Four drives, scattered across the base. Once you have them all I will mark the extraction point. The storm is knocking out my radio so you will only get a short window. Run!' }],
          out: { w: 'cmd', t: 'Drives received. The research was real. And it points to one place: the old temple. Colonel Voss is there.' },
          stages: [{ t: 'intel', n: 4, cap: 12, rate: 3.6 }, { t: 'extract', secs: 150, cap: 14, rate: 3 }],
          s2: { k: 'nodeath', txt: 'Finish without going down' }, s3: { k: 'timeleft', v: 45, txt: 'Reach extraction with 45s to spare' },
          reward: { cash: 1300, xp: 800 } },
        { id: 'c1m6', name: 'THE WARLORD', map: 'temple', light: 'bloodmoon', diff: 'normal', lvl: 10, cash: 2200, lives: 3,
          sum: 'Kill the Warlord.',
          brief: [{ w: 'voss', t: 'You came all this way to bury me, little soldier? I am the only one who survived the first night, and I have been building an army ever since.' },
                  { w: 'rook', t: 'Colonel Voss turned, and he took the temple with his own garrison. Everything we have been through leads here. End him, and the horde loses its general.' }],
          out: { w: 'rook', t: 'The Warlord is down. The dead are scattering. Chapter one is over, soldier. We made it through the night.' },
          stages: [{ t: 'boss', id: 'warlord', cap: 6, rate: 6 }], s2: { k: 'nodeath', txt: 'Finish without going down' }, s3: { k: 'bosstime', v: 150, txt: 'Kill the Warlord in under 2:30' },
          reward: { cash: 2000, xp: 1500, skin: 'camo:warden' } }
    ]
},{
    id: 2, name: 'DEAD AIR', blurb: 'A looping radio signal leads the squad underground. Someone down in the Metro is still alive, and still broadcasting.',
    missions: [
        { id: 'c2m1', name: 'STATIC', map: 'subway', light: 'night', diff: 'normal', lvl: 11, cash: 2600, lives: 3,
          sum: 'Survive 4 waves in the Metro station. Watch the floor vents.',
          brief: [{ w: 'wren', t: 'Wren. Since Voss went down I have been catching one signal on a loop: a woman reading out coordinates. It is coming from the old Metro station, and it is not a recording.' },
                  { w: 'rook', t: 'Underground at night. Great. Keep your eyes on the floor grates, soldier. Something has been living in those vents and it does not like visitors.' }],
          out: { w: 'wren', t: 'The signal just got stronger. She is deeper in the tunnels. Her name is Dr. Lang, and she says she knows where it all started.' },
          stages: [{ t: 'survive', n: 4 }], s2: { k: 'nodeath', txt: 'Finish without going down' }, s3: { k: 'heads', v: 20, txt: 'Get 20 headshots' },
          reward: { cash: 1500, xp: 1000 } },
        { id: 'c2m2', name: 'THE LAST BROADCAST', map: 'mall', light: 'storm', diff: 'normal', lvl: 12, cash: 2800, lives: 3,
          sum: 'Collect 5 transmitter parts, then hold the zone while the dish powers up.',
          brief: [{ w: 'lang', t: 'This is Doctor Helen Lang. I run the research team that the Warlord scattered. The mall radio mast could broadcast our location to every survivor, but its parts were stripped out.' },
                  { w: 'gears', t: 'Five parts, spread across both floors. Bring them to the mast, then hold the circle while it warms up. The storm is making it hard to think, so stay sharp.' }],
          out: { w: 'lang', t: 'The mast is live! Every survivor within fifty miles can hear us now. I will tell you everything at the next stop. Meet me at the barricades downtown.' },
          stages: [{ t: 'intel', n: 5, cap: 13, rate: 3.4 }, { t: 'hold', secs: 60, r: 11, cap: 12, rate: 3 }],
          s2: { k: 'time', v: 330, txt: 'Finish in under 5:30' }, s3: { k: 'dmg', v: 120, txt: 'Lose less than 120 health in total' },
          reward: { cash: 1600, xp: 1100 } },
        { id: 'c2m3', name: 'RIOT LINE', map: 'downtown', light: 'neon', diff: 'normal', lvl: 13, cash: 3000, lives: 3,
          sum: 'Defend the barricade against packs of zombie Hounds, then survive 2 waves.',
          brief: [{ w: 'doc', t: 'Doc Cole. The old police line downtown is the only choke point between us and the Metro entrance. The police kennels are open, and the dogs did not stay dead.' },
                  { w: 'gears', t: 'Hounds come in packs of three or four and circle you before they lunge, each from a different side. They are fast but fragile: keep moving and shoot them mid-leap. Stand near the barricade to patch it.' }],
          out: { w: 'doc', t: 'The line held. The pack is down. One more push and the way to Dr. Lang is open.' },
          stages: [{ t: 'defend', secs: 80, hp: 1600, cap: 14, rate: 3, mix: { shambler: 0.12 } }, { t: 'survive', n: 2 }],
          s2: { k: 'nodeath', txt: 'Finish without going down' }, s3: { k: 'barr', v: 0.6, txt: 'Barricade ends above 60% health' },
          reward: { cash: 1800, xp: 1200 } },
        { id: 'c2m4', name: 'SAFE PASSAGE', map: 'military', light: 'sunset', diff: 'hard', lvl: 14, cash: 3400, lives: 3,
          sum: 'Rescue 3 of Lang\'s researchers, then reach extraction in time.',
          brief: [{ w: 'lang', t: 'Three of my team are holed up in the base armory. Without them I cannot finish the antidote. They are tired and hurt, but they will follow you if you reach them.' },
                  { w: 'rook', t: 'Collect them one by one, then run for the extraction point. A chopper will not wait forever.' }],
          out: { w: 'lang', t: 'All three of them! Thank you. Now I can show you what we found: it all leads to a hospital. The first patient never died.' },
          stages: [{ t: 'rescue', n: 3, need: 3, cap: 13, rate: 3.6 }, { t: 'extract', secs: 130, cap: 14, rate: 3 }],
          s2: { k: 'time', v: 360, txt: 'Finish in under 6:00' }, s3: { k: 'allsurv', txt: 'Bring all 3 researchers home alive' },
          reward: { cash: 2000, xp: 1300 } },
        { id: 'c2m5', name: 'UNDER THE CITY', map: 'subway', light: 'bloodmoon', diff: 'hard', lvl: 15, cash: 3600, lives: 3,
          sum: 'Repair 2 signal boxes, then hold the platform while the crawlers swarm.',
          brief: [{ w: 'gears', t: 'Gears again. The Metro signal boxes control the tunnel doors. Fix two of them and we can seal the lower level before the horde breaks in.' },
                  { w: 'wren', t: 'Heads up: motion on the thermals in every vent. They are waiting for you to pass. Do not stand over a grate.' }],
          out: { w: 'gears', t: 'Doors are sealed and the rats are locked in. Now we only have the Colossus between us and the hospital.' },
          stages: [{ t: 'repair', n: 2, secs: 14, hp: 480, cap: 13, rate: 3.4, mix: { crawler: 0.3 } }, { t: 'hold', secs: 70, r: 11, cap: 13, rate: 3, mix: { crawler: 0.4 } }],
          s2: { k: 'nodeath', txt: 'Finish without going down' }, s3: { k: 'heads', v: 25, txt: 'Get 25 headshots' },
          reward: { cash: 2200, xp: 1400 } },
        { id: 'c2m6', name: 'THE COLOSSUS', map: 'fortress', light: 'storm', diff: 'hard', lvl: 16, cash: 4200, lives: 3,
          sum: 'Kill the Colossus.',
          brief: [{ w: 'cmd', t: 'Command to Rook. The road to the hospital runs straight through the fortress, and something huge is standing in the gate. Our satellites call it the Colossus.' },
                  { w: 'rook', t: 'It stomps, it throws rocks, and it does not stop. Stay moving, watch the circles on the ground, and jump the shockwaves. Take it down, soldier.' }],
          out: { w: 'rook', t: 'It is down! The road is open. Lang says the hospital is the last stop, so get some rest. Whatever is in there, we finish it.' },
          stages: [{ t: 'boss', id: 'titan', hpMul: 0.5, cap: 6, rate: 6 }], s2: { k: 'nodeath', txt: 'Finish without going down' }, s3: { k: 'bosstime', v: 200, txt: 'Kill the Colossus in under 3:20' },
          reward: { cash: 2800, xp: 2200, skin: 'camo:static' } }
    ]
},{
    id: 3, name: 'PATIENT ZERO', blurb: 'The trail ends at the Meridian Biolab. The first infected is still down there, and the dead are its army.',
    missions: [
        { id: 'c3m1', name: 'QUARANTINE', map: 'downtown', light: 'night', diff: 'hard', lvl: 17, cash: 4000, lives: 3,
          sum: 'Survive 5 waves around the quarantine zone. Stay out of the green clouds.',
          brief: [{ w: 'lang', t: 'The hospital district is under quarantine, and the quarantine failed. Some of the infected there carry canisters from the lab. When they burst, the air itself becomes poison.' },
                  { w: 'doc', t: 'Do not stand in the green. It will eat through your armour in seconds. Kill the carriers before they get the range on you.' }],
          out: { w: 'doc', t: 'We cleared the zone. Dr. Lang says the biolab entrance is two blocks from here. We are close.' },
          stages: [{ t: 'survive', n: 5 }], s2: { k: 'nodeath', txt: 'Finish without going down' }, s3: { k: 'heads', v: 30, txt: 'Get 30 headshots' },
          reward: { cash: 2200, xp: 1600 } },
        { id: 'c3m2', name: 'CODE RED', map: 'mall', light: 'bloodmoon', diff: 'hard', lvl: 18, cash: 4200, lives: 3,
          sum: 'Collect 4 access keycards and reach extraction.',
          brief: [{ w: 'cmd', t: 'Command. The biolab is locked down tight. The access keycards were dropped in the mall during the evacuation: four of them, one per department.' },
                  { w: 'wren', t: 'Once you have the fourth card I will open the extraction route. You will not have long, because the lockdown alarm just went off and the whole district is awake.' }],
          out: { w: 'wren', t: 'Cards verified! Doors are unlocked and the biolab convoy is on its way. Rook says to get your gear ready.' },
          stages: [{ t: 'intel', n: 4, cap: 14, rate: 3, mix: { shocker: 0.2 } }, { t: 'extract', secs: 120, cap: 15, rate: 2.8 }],
          s2: { k: 'nodeath', txt: 'Finish without going down' }, s3: { k: 'timeleft', v: 40, txt: 'Reach extraction with 40s to spare' },
          reward: { cash: 2400, xp: 1700 } },
        { id: 'c3m3', name: 'THE ANTIDOTE', map: 'temple', light: 'night', diff: 'hard', lvl: 19, cash: 4400, lives: 3,
          sum: 'Escort 3 scientists to the lab truck, then defend it.',
          brief: [{ w: 'lang', t: 'My last three colleagues are carrying the only antidote samples. They are hiding in the temple ruins, and the dead have surrounded them.' },
                  { w: 'rook', t: 'Get them out, bring them back to the drop point and then hold. When the samples are loaded on the truck we are one step away from ending this.' }],
          out: { w: 'lang', t: 'The samples are safe and the truck is rolling. Now there is only the lab, and the patient in the lower level.' },
          stages: [{ t: 'rescue', n: 3, need: 3, cap: 14, rate: 3.2 }, { t: 'defend', secs: 70, hp: 1800, cap: 15, rate: 2.8, mix: { shambler: 0.08, crawler: 0.2 } }],
          s2: { k: 'time', v: 420, txt: 'Finish in under 7:00' }, s3: { k: 'allsurv', txt: 'Bring all 3 scientists home alive' },
          reward: { cash: 2600, xp: 1800, skin: 'camo:toxin' } },
        { id: 'c3m4', name: 'FLASHPOINT', map: 'skybridge', light: 'storm', diff: 'hard', lvl: 20, cash: 4800, lives: 3,
          sum: 'Repair 3 power relays, then defend the lift barricade.',
          brief: [{ w: 'gears', t: 'Gears. The lab lift needs power, and the three relays are on the skybridge towers. It is a storm up there, and everything on the ground will be coming for the noise.' },
                  { w: 'rook', t: 'When the relays are up, hold the barricade at the lift. Hound packs will come first, then whatever else they have.' }],
          out: { w: 'gears', t: 'Power is on and the lift is humming. This is it, soldier. One more floor and we meet the patient.' },
          stages: [{ t: 'repair', n: 3, secs: 12, hp: 520, cap: 14, rate: 3.2 }, { t: 'defend', secs: 75, hp: 1900, cap: 16, rate: 2.7, mix: { shambler: 0.1, shocker: 0.15 } }],
          s2: { k: 'time', v: 420, txt: 'Finish in under 7:00' }, s3: { k: 'barr', v: 0.5, txt: 'Barricade ends above 50% health' },
          reward: { cash: 2800, xp: 1900 } },
        { id: 'c3m5', name: 'DESCENT', map: 'subway', light: 'bloodmoon', diff: 'hard', lvl: 21, cash: 5000, lives: 3,
          sum: 'Hold the platform, then run for the lab elevator.',
          brief: [{ w: 'lang', t: 'The elevator to the biolab is at the end of the Metro line. The tunnels are full of the first patient\'s children. Crawlers, carriers, everything.' },
                  { w: 'rook', t: 'Hold the platform until the rail switch is thrown, then sprint to the elevator. Stay out of the vents and out of the green.' }],
          out: { w: 'rook', t: 'We made it to the elevator. This is where we say it. Whatever is waiting down there, we finish what we started. For everyone upstairs.' },
          stages: [{ t: 'hold', secs: 80, r: 12, cap: 15, rate: 2.8, mix: { crawler: 0.45, shocker: 0.2 } }, { t: 'extract', secs: 110, cap: 16, rate: 2.6, mix: { crawler: 0.3 } }],
          s2: { k: 'nodeath', txt: 'Finish without going down' }, s3: { k: 'timeleft', v: 35, txt: 'Reach the elevator with 35s to spare' },
          reward: { cash: 3000, xp: 2100 } },
        { id: 'c3m6', name: 'PATIENT ZERO', map: 'biolab', light: 'bloodmoon', diff: 'hard', lvl: 22, cash: 6000, lives: 3,
          sum: 'Kill Patient Zero.',
          brief: [{ w: 'zero', t: 'You came all this way to cure me? There is nothing left to cure, little soldier. I was the first to fall, and I will be the last to stand.' },
                  { w: 'lang', t: 'He was my patient. Subject zero. Everything we did to save him made it worse. Do not let him reach the surface. It ends here.' }],
          out: { w: 'rook', t: 'It is over. Patient Zero is down and the horde is collapsing. Chapter three is done, soldier. You brought us home.' },
          stages: [{ t: 'boss', id: 'zero', hpMul: 0.6, cap: 6, rate: 6 }], s2: { k: 'nodeath', txt: 'Finish without going down' }, s3: { k: 'bosstime', v: 240, txt: 'Kill Patient Zero in under 4:00' },
          reward: { cash: 4000, xp: 4000, skin: 'camo:outbreak' } }
    ]
}
];
const CAMP_ALL = [];
CAMP_CHAPTERS.forEach(ch => ch.missions.forEach((m, i) => { m.ci = i; m.ch = ch.id; CAMP_ALL.push(m); m.n = CAMP_ALL.length; }));    // n = mission number across the whole campaign
const campDone = (m) => campSave.done[m.id];
const campUnlocked = (m) => m.n === 1 || !!campSave.done[CAMP_ALL[m.n - 2].id];
const campLives = () => CAMP.m ? Math.max(0, CAMP.m.lives - CAMP.deaths) : 0;
const campFmt = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const campStageName = { survive: 'Survive waves', hold: 'Hold a zone', rescue: 'Rescue survivors', repair: 'Repair generators', defend: 'Defend the barricade', intel: 'Collect intel', extract: 'Reach extraction', boss: 'Kill the boss' };

// ---------- world objects: beacons, survivors, generators, barricades ----------
const _cbox = new THREE.BoxGeometry(1, 1, 1);
const _cbGeo = new THREE.CylinderGeometry(1, 1, 60, 16, 1, true);
const _crGeo = new THREE.RingGeometry(0.92, 1, 40).rotateX(-Math.PI / 2);
const _cdGeo = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
const _cOct = new THREE.OctahedronGeometry(0.4, 0);
const _cv = new V3();
const campMat = (c, o) => new THREE.MeshBasicMaterial(Object.assign({ color: c, transparent: true, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide, forceSinglePass: true }, o));
function campBeacon(x, y, z, r, color) {
    const g = new THREE.Group(), br = Math.min(r, 1.1);
    const beam = new THREE.Mesh(_cbGeo, campMat(color, { opacity: 0.16, blending: THREE.AdditiveBlending })); beam.scale.set(br, 1, br); beam.position.y = 30;
    const ring = new THREE.Mesh(_crGeo, campMat(color, { opacity: 0.85 })); ring.scale.set(r, 1, r); ring.position.y = 0.1;
    const disc = new THREE.Mesh(_cdGeo, campMat(color, { opacity: 0.1 })); disc.scale.set(r, 1, r); disc.position.y = 0.07;
    const fill = new THREE.Mesh(_cdGeo, campMat(color, { opacity: 0.32 })); fill.scale.set(0.001, 1, 0.001); fill.position.y = 0.09;
    g.add(beam, ring, disc, fill); g.position.set(x, y, z); scene.add(g);
    const o = { g, ring, disc, fill, beam, r }; CAMP.objs.push(o); return o;
}
function campFree(o) {
    scene.remove(o.g);
    o.g.traverse(c => { if (c.material) c.material.dispose(); });
    CAMP.objs = CAMP.objs.filter(x => x !== o);
}
function campRecolor(b, color) { b.ring.material.color.setHex(color); b.disc.material.color.setHex(color); b.fill.material.color.setHex(color); b.beam.material.color.setHex(color); }
function campBox(g, w, h, d, x, y, z, mat) { const b = new THREE.Mesh(_cbox, mat); b.scale.set(w, h, d); b.position.set(x, y, z); g.add(b); return b; }
const campLam = (c) => new THREE.MeshLambertMaterial({ color: c });
function campNpc(color) {
    const g = new THREE.Group(), skin = campLam(0xe0b48c), shirt = campLam(color), pants = campLam(0x1f2937);
    campBox(g, 0.3, 0.8, 0.3, -0.15, 0.4, 0, pants); campBox(g, 0.3, 0.8, 0.3, 0.15, 0.4, 0, pants);
    campBox(g, 0.62, 0.8, 0.36, 0, 1.2, 0, shirt); campBox(g, 0.2, 0.7, 0.2, -0.42, 1.2, 0, skin); campBox(g, 0.2, 0.7, 0.2, 0.42, 1.2, 0, skin);
    campBox(g, 0.42, 0.42, 0.42, 0, 1.82, 0, skin); campBox(g, 0.47, 0.14, 0.47, 0, 2.06, 0, campLam(0x78350f));
    return g;
}
function campGen() {
    const g = new THREE.Group(), body = campLam(0x374151), led = new THREE.MeshBasicMaterial({ color: 0xef4444, toneMapped: false });
    campBox(g, 1.9, 1.3, 1.1, 0, 0.75, 0, body); campBox(g, 1.94, 0.22, 1.14, 0, 0.5, 0, campLam(0xeab308)); campBox(g, 0.3, 0.3, 0.3, 0.55, 1.55, 0, led);
    campBox(g, 0.35, 0.8, 0.35, -0.6, 1.6, 0, campLam(0x1f2937));
    g.userData.led = led; return g;
}
function campBarricade() {
    const g = new THREE.Group(), wood = campLam(0x78502d), dark = campLam(0x4b3320), sand = campLam(0xa8946a);
    for (let i = 0; i < 3; i++) campBox(g, 7, 0.42, 0.34, 0, 0.55 + i * 0.55, 0, i % 2 ? dark : wood);
    campBox(g, 0.4, 2.2, 0.5, -3.3, 1.1, 0, dark); campBox(g, 0.4, 2.2, 0.5, 3.3, 1.1, 0, dark); campBox(g, 0.4, 2.2, 0.5, 0, 1.1, 0, dark);
    for (let i = -3; i <= 3; i++) campBox(g, 0.9, 0.5, 0.7, i * 1.0, 0.25, 0.75, sand);
    return g;
}
function campObj(g, x, y, z) { g.position.set(x, y, z); scene.add(g); const o = { g }; CAMP.objs.push(o); return o; }
function campSpot(minD, maxD, fx, fz) {
    return navSpot(fx, fz, minD, maxD) || navSpot(fx, fz, 0, 9999) || [spawnPt[0] + 8, 0, spawnPt[1] + 8];
}
// spread several spots apart from each other
function campSpots(n, minD, maxD, fx, fz, apart) {
    const out = [];
    for (let i = 0; i < n; i++) {
        let s = null;
        for (let k = 0; k < 14; k++) { const c = campSpot(minD, maxD, fx, fz); if (out.every(o => Math.hypot(o[0] - c[0], o[2] - c[2]) >= apart)) { s = c; break; } s = c; }
        out.push(s);
    }
    return out;
}
function campDecoy(kind, x, y, z, ref) {
    const d = { id: 9100 + CAMP.decoys.length + Math.floor(Math.random() * 800), pos: new V3(x, y + 0.9, z), feet: y, local: false, alive: true, camp: true, k: kind, ref };
    CAMP.decoys.push(d); campSyncDecoys(); return d;
}
function campDropDecoy(d) { if (!d) return; d.alive = false; CAMP.decoys = CAMP.decoys.filter(x => x !== d); campSyncDecoys(); }
function campSyncDecoys() { CAMP.T.length = 0; CAMP.T.push(_localTarget); for (const d of CAMP.decoys) CAMP.T.push(d); }
const inZone = (x, z, y, r) => Math.hypot(camera.position.x - x, camera.position.z - z) < r && Math.abs(feetY - y) < 3.5;
// zombie spawner for objective missions: keeps up to def.cap alive, walking in from 22-62m away from the anchor
function campDirect(st, dt, ax, az, burst) {
    const d = st.def; if (!d.cap) return;
    st.spT -= dt;
    let n = burst ? Math.ceil(d.cap * 0.6) : (st.spT <= 0 && enemies.length < d.cap ? 1 : 0);
    if (n) st.spT = d.rate * (0.75 + Math.random() * 0.5);
    const lvl = CAMP.m.lvl;
    while (n-- > 0 && enemies.length < d.cap) {
        const counts = {};
        for (const e of enemies) { const id = e.userData.config.id; counts[id] = (counts[id] || 0) + 1; }
        let cfg = pickEnemyType(lvl, counts);
        if (d.mix) for (const id in d.mix) if (Math.random() < d.mix[id] && (counts[id] || 0) < (enemyTypes[id].cap || 99)) { cfg = enemyTypes[id]; break; }      // this part of the mission favours some zombie types
        let sp = null;
        for (let k = 0; k < 6 && !sp; k++) { const c = navSpot(ax, az, 22, 62); if (c && Math.hypot(c[0] - camera.position.x, c[2] - camera.position.z) > 16) sp = c; }
        if (sp) { const ne = spawnEnemy(cfg, sp[0], sp[2], sp[1] + 0.15, waveSpeed(lvl), waveReward(lvl) * 0.7); if (cfg.id === 'hound') spawnHoundPack(ne, sp[0], sp[2], sp[1] + 0.15, waveSpeed(lvl), waveReward(lvl) * 0.7); }
    }
}
function campMark(x, y, z, c, r, label) {
    const m = CAMP.marks[CAMP.nm] || (CAMP.marks[CAMP.nm] = {});
    m.x = x; m.y = y; m.z = z; m.c = c; m.r = r || 0; m.label = label || ''; CAMP.nm++;
}
const campHex = (n) => '#' + n.toString(16).padStart(6, '0');

// ---------- stage handlers ----------
// init(st) / tick(st, dt) -> true when done / hud(st, o) fills {main, sub, p} / marks(st) / end(st)
const CAMP_H = {
    survive: {
        title: (st) => `SURVIVE ${st.def.n} WAVES`,
        init(st) { st.cleared = 0; },
        tick() {},
        hud(st, o) { o.main = `Survive ${st.def.n} waves`; o.sub = `Wave ${Math.min(st.def.n, st.cleared + 1)} of ${st.def.n}  -  ${enemies.length} zombies left`; o.p = st.cleared / st.def.n; },
        marks() {}, end() {}
    },
    hold: {
        title: () => 'HOLD THE ZONE',
        init(st) {
            const s = campSpot(20, 48, spawnPt[0], spawnPt[1]); st.pos = s; st.p = 0; st.b = campBeacon(s[0], s[1], s[2], st.def.r, 0x38bdf8);
            campDirect(st, 0, s[0], s[2], true);
        },
        tick(st, dt) {
            const s = st.pos, inn = inZone(s[0], s[2], s[1], st.def.r);
            st.inn = inn; st.p = clamp(st.p + (inn ? dt : -dt * 0.5), 0, st.def.secs);
            const k = Math.max(0.001, st.p / st.def.secs); st.b.fill.scale.set(k * st.def.r, 1, k * st.def.r);
            if (st.col !== inn) { st.col = inn; campRecolor(st.b, inn ? 0x4ade80 : 0x38bdf8); }
            campDirect(st, dt, s[0], s[2], false);
            return st.p >= st.def.secs;
        },
        hud(st, o) { o.main = 'Hold the capture zone'; o.sub = st.inn ? 'CAPTURING... ' + Math.round(st.p / st.def.secs * 100) + '%' : 'GET BACK INTO THE ZONE!'; o.p = st.p / st.def.secs; },
        marks(st) { campMark(st.pos[0], st.pos[1], st.pos[2], st.inn ? 0x4ade80 : 0x38bdf8, st.def.r, 'ZONE'); },
        end(st) { if (st.b) campFree(st.b); }
    },
    rescue: {
        title: () => 'RESCUE THE SURVIVORS',
        init(st) {
            const spots = campSpots(st.def.n, 26, 75, spawnPt[0], spawnPt[1], 22), cols = [0x38bdf8, 0xf472b6, 0xfacc15, 0x4ade80];
            st.sv = spots.map((s, i) => {
                const g = campNpc(cols[i % cols.length]); campObj(g, s[0], s[1], s[2]);
                const o = { x: s[0], y: s[1], z: s[2], state: 'cap', hp: 140, max: 140, fill: 0, g, b: campBeacon(s[0], s[1], s[2], 3.2, 0x22d3ee), stuck: 0, ph: i * 2, dec: null };
                for (let k = 0; k < 3; k++) {          // a few zombies guard each survivor
                    const sp = navSpot(s[0], s[2], 5, 12);
                    if (sp) spawnEnemy(pickEnemyType(CAMP.m.lvl, {}), sp[0], sp[2], sp[1] + 0.15, waveSpeed(CAMP.m.lvl), waveReward(CAMP.m.lvl) * 0.7);
                }
                return o;
            });
            st.ext = null; st.rescued = 0; st.exT = 0;
            campDirect(st, 0, spawnPt[0], spawnPt[1], true);
        },
        tick(st, dt) {
            const px = camera.position.x, pz = camera.position.z;
            let caps = 0, alive = 0, near = 0;
            for (const s of st.sv) {
                if (s.state === 'cap') {
                    caps++; alive++;
                    if (Math.hypot(px - s.x, pz - s.z) < 3.4 && Math.abs(feetY - s.y) < 2.5) s.fill += dt / 2.5; else s.fill = Math.max(0, s.fill - dt);
                    const k = Math.max(0.001, s.fill) * 3.2; s.b.fill.scale.set(k, 1, k);
                    s.g.rotation.y += dt * 0.6;
                    if (s.fill >= 1) {
                        s.state = 'follow'; st.rescued++; campFree(s.b); s.b = null; s.dec = campDecoy('surv', s.x, s.y, s.z, s);
                        toast(`SURVIVOR RESCUED  ${st.rescued}/${st.def.n}`, '#22d3ee', 2); sfx('power'); caps--;
                    }
                } else if (s.state === 'follow') {
                    alive++;
                    campFollow(s, dt, px, pz);
                    if (st.ext && Math.hypot(s.x - st.ext.x, s.z - st.ext.z) < 10) near++;
                }
            }
            CAMP.stat.alive = alive;
            if (alive < st.def.need) { campFail('Too many survivors were lost'); return false; }
            if (!caps && !st.ext) {
                st.ext = campBeacon(spawnPt[0], 0, spawnPt[1], 6, 0x4ade80); st.ext.x = spawnPt[0]; st.ext.z = spawnPt[1];
                toast('ALL FREE - ESCORT THEM TO THE EXTRACTION POINT', '#4ade80', 2.6); sfx('wave');
            }
            campDirect(st, dt, px, pz, false);
            if (st.ext && inZone(st.ext.x, st.ext.z, 0, 6) && near >= alive - 0 && alive >= st.def.need) { CAMP.stat.alive = alive; return true; }
            return false;
        },
        hud(st, o) {
            if (!st.ext) { o.main = `Rescue the survivors  ${st.rescued}/${st.def.n}`; o.sub = 'Stand next to a survivor to free them'; o.p = st.rescued / st.def.n; }
            else { o.main = 'Escort survivors to extraction'; o.sub = `${CAMP.stat.alive} survivor(s) alive (need ${st.def.need}) - keep them close`; o.p = 1; }
        },
        marks(st) {
            for (const s of st.sv) if (s.state === 'cap') campMark(s.x, s.y, s.z, 0x22d3ee, 3, 'SURVIVOR'); else if (s.state === 'follow') campMark(s.x, s.y, s.z, 0xfacc15, 0, '');
            if (st.ext) campMark(st.ext.x, 0, st.ext.z, 0x4ade80, 6, 'EXTRACTION');
        },
        end(st) { for (const s of st.sv) { if (s.b) campFree(s.b); campDropDecoy(s.dec); } if (st.ext) campFree(st.ext); }
    },
    repair: {
        title: () => 'REPAIR THE GENERATORS',
        init(st) {
            const first = campSpot(20, 46, spawnPt[0], spawnPt[1]);
            st.gens = [first]; for (let i = 1; i < st.def.n; i++) st.gens.push(campSpot(9, 17, first[0], first[2]));
            st.gens = st.gens.map((s, i) => { const g = campGen(); g.rotation.y = i * 1.3; campObj(g, s[0], s[1], s[2]); return { x: s[0], y: s[1], z: s[2], g, hp: st.def.hp, max: st.def.hp, prog: 0, done: false, b: campBeacon(s[0], s[1], s[2], 4.2, 0xfbbf24) }; });
            st.i = 0; st.dec = null; campGenFocus(st);
            campDirect(st, 0, first[0], first[2], true);
        },
        tick(st, dt) {
            const cur = st.gens[st.i]; if (!cur) return true;
            if (inZone(cur.x, cur.z, cur.y, 4.2)) {
                cur.prog = Math.min(1, cur.prog + dt / st.def.secs);
                if (Math.random() < dt * 8) spawnParticles(new V3(cur.x, cur.y + 1.6, cur.z), 0xfde047, 2, 3, 0.4, 0.1, true);
            }
            const k = Math.max(0.001, cur.prog) * 4.2; cur.b.fill.scale.set(k, 1, k);
            if (cur.prog >= 1) {
                cur.done = true; cur.g.userData.led.color.setHex(0x4ade80); campFree(cur.b); cur.b = null; campDropDecoy(st.dec); st.dec = null; st.i++;
                toast(`GENERATOR ${st.i}/${st.def.n} ONLINE`, '#4ade80', 2); sfx('power');
                if (st.i >= st.def.n) return true;
                campGenFocus(st);
            }
            const c = st.gens[st.i]; campDirect(st, dt, c.x, c.z, false);
            return false;
        },
        hud(st, o) {
            const c = st.gens[Math.min(st.i, st.gens.length - 1)];
            o.main = `Repair generators  ${st.i}/${st.def.n}`; o.sub = `Stay near the glowing generator\nGenerator health ${Math.round(c.hp / c.max * 100)}%`; o.p = (st.i + (st.gens[st.i] ? st.gens[st.i].prog : 0)) / st.def.n;
        },
        marks(st) { const c = st.gens[st.i]; if (c) campMark(c.x, c.y, c.z, 0xfbbf24, 4.2, 'GENERATOR'); },
        end(st) { for (const g of st.gens) if (g.b) campFree(g.b); campDropDecoy(st.dec); }
    },
    defend: {
        title: () => 'DEFEND THE BARRICADE',
        init(st) {
            const s = CAMP.lastPos ? campSpot(6, 12, CAMP.lastPos[0], CAMP.lastPos[2]) : campSpot(18, 40, spawnPt[0], spawnPt[1]);
            st.pos = s; st.hp = st.def.hp; st.max = st.def.hp; st.left = st.def.secs;
            st.g = campBarricade(); st.g.rotation.y = Math.random() * 3.14; campObj(st.g, s[0], s[1], s[2]);
            st.b = campBeacon(s[0], s[1], s[2], 8, 0xfb923c); st.dec = campDecoy('bar', s[0], s[1], s[2], st);
            CAMP.stat.barEnd = 1; campDirect(st, 0, s[0], s[2], true);
        },
        tick(st, dt) {
            st.left -= dt;
            if (st.hp > 0 && st.hp < st.max && Math.hypot(camera.position.x - st.pos[0], camera.position.z - st.pos[2]) < 4.5) st.hp = Math.min(st.max, st.hp + 14 * dt);   // stand close to patch it up
            CAMP.stat.barEnd = st.hp / st.max;
            st.g.scale.y = 0.45 + 0.55 * Math.max(0, st.hp / st.max);
            const k = clamp(1 - st.left / st.def.secs, 0.001, 1) * 8; st.b.fill.scale.set(k, 1, k);
            campDirect(st, dt, st.pos[0], st.pos[2], false);
            return st.left <= 0;
        },
        hud(st, o) { o.main = 'Defend the barricade'; o.sub = `Barricade ${Math.round(st.hp / st.max * 100)}%  -  ${campFmt(st.left)} to go\nStand close to patch it up`; o.p = 1 - st.left / st.def.secs; },
        marks(st) { campMark(st.pos[0], st.pos[1], st.pos[2], 0xfb923c, 8, 'BARRICADE'); },
        end(st) { if (st.b) campFree(st.b); if (st.g) { const o = CAMP.objs.find(x => x.g === st.g); if (o) campFree(o); } campDropDecoy(st.dec); }
    },
    intel: {
        title: () => 'COLLECT THE INTEL',
        init(st) {
            st.items = campSpots(st.def.n, 24, 90, spawnPt[0], spawnPt[1], 24).map(s => {
                const g = new THREE.Group(), core = new THREE.Mesh(_cOct, campMat(0xfde047, { opacity: 1 }));
                const beam = new THREE.Mesh(_cbGeo, campMat(0xfde047, { opacity: 0.18, blending: THREE.AdditiveBlending })); beam.scale.set(0.35, 1, 0.35); beam.position.y = 29;
                core.position.y = 1.2; g.add(core, beam); campObj(g, s[0], s[1], s[2]);
                return { x: s[0], y: s[1], z: s[2], g, core, got: false };
            });
            st.got = 0; campDirect(st, 0, camera.position.x, camera.position.z, true);
        },
        tick(st, dt) {
            for (const it of st.items) {
                if (it.got) continue;
                it.core.rotation.y += dt * 2.4; it.core.position.y = 1.2 + Math.sin(gameTime * 3 + it.x) * 0.2;
                if (Math.hypot(camera.position.x - it.x, camera.position.z - it.z) < 2.3 && Math.abs(feetY - it.y) < 3) {
                    it.got = true; it.g.visible = false; st.got++; sfx('power'); toast(`INTEL DRIVE ${st.got}/${st.def.n}`, '#fde047', 1.8);
                }
            }
            campDirect(st, dt, camera.position.x, camera.position.z, false);
            return st.got >= st.def.n;
        },
        hud(st, o) { o.main = `Collect intel drives  ${st.got}/${st.def.n}`; o.sub = 'Follow the markers'; o.p = st.got / st.def.n; },
        marks(st) { for (const it of st.items) if (!it.got) campMark(it.x, it.y, it.z, 0xfde047, 0, 'INTEL'); },
        end() {}
    },
    extract: {
        title: (st) => `REACH EXTRACTION - ${campFmt(st.def.secs)}`,
        init(st) {
            const s = campSpot(50, 110, camera.position.x, camera.position.z); st.pos = s; st.left = st.def.secs;
            st.b = campBeacon(s[0], s[1], s[2], 5.5, 0x4ade80); campDirect(st, 0, camera.position.x, camera.position.z, true);
        },
        tick(st, dt) {
            st.left -= dt;
            if (inZone(st.pos[0], st.pos[2], st.pos[1], 5.5)) { CAMP.stat.left = st.left; return true; }
            if (st.left <= 0) { campFail('Extraction timer ran out'); return false; }
            campDirect(st, dt, camera.position.x, camera.position.z, false);
            return false;
        },
        hud(st, o) { o.main = 'Reach the extraction point'; o.sub = `TIME LEFT ${campFmt(st.left)}`; o.p = clamp(st.left / st.def.secs, 0, 1); },
        marks(st) { campMark(st.pos[0], st.pos[1], st.pos[2], 0x4ade80, 5.5, 'EXTRACTION'); },
        end(st) { if (st.b) campFree(st.b); }
    },
    boss: {
        title: (st) => `KILL ${enemyTypes[st.def.id].name.toUpperCase()}`,
        init(st) {
            const s = campSpot(35, 70, camera.position.x, camera.position.z), L = CAMP.m.lvl;
            st.boss = spawnEnemy(enemyTypes[st.def.id], s[0], s[2], s[1] + 0.15, waveSpeed(L), waveReward(L)); st.name = enemyTypes[st.def.id].name;
            if (st.def.hpMul) { st.boss.userData.hp *= st.def.hpMul; st.boss.userData.maxHp = st.boss.userData.hp; }
        },
        tick(st, dt) {
            const b = st.boss;
            if (!enemies.includes(b) || b.userData.dead) { CAMP.stat.bossT = st.t; return true; }
            campDirect(st, dt, camera.position.x, camera.position.z, false);
            return false;
        },
        hud(st, o) { const u = st.boss.userData; o.main = `Kill ${st.name}`; o.sub = 'Its health bar is at the top of the screen'; o.p = clamp(1 - u.hp / u.maxHp, 0, 1); },
        marks(st) { if (st.boss && st.boss.parent) campMark(st.boss.position.x, st.boss.position.y, st.boss.position.z, 0xe879f9, 0, 'BOSS'); },
        end() {}
    }
};
function campGenFocus(st) {
    const c = st.gens[st.i]; if (!c) return;
    st.dec = campDecoy('gen', c.x, c.y, c.z, c); c.dec = st.dec;
    st.gens.forEach((g, i) => { if (g.b) campRecolor(g.b, i === st.i ? 0xfbbf24 : 0x64748b); });
}
// a rescued survivor walks after you
function campFollow(s, dt, px, pz) {
    const dx = px - s.x, dz = pz - s.z, d = Math.hypot(dx, dz);
    if (d > 38 || s.stuck > 4) {
        const sp = navSpot(px, pz, 5, 11);
        if (sp) { s.x = sp[0]; s.y = sp[1]; s.z = sp[2]; s.stuck = 0; }
    } else if (d > 3.8) {
        const stp = 6.4 * dt, nx = s.x + dx / d * stp, nz = s.z + dz / d * stp;
        const tryMove = (x, z) => { const gy = groundAt(x, z, 0.3, s.y + 1.3); if (gy - s.y < 1.25 && !pointInSolid(_cv.set(x, gy + 0.9, z), 0.35)) { s.x = x; s.z = z; s.y += (gy - s.y) * Math.min(1, dt * 12); return true; } return false; };
        if (tryMove(nx, nz) || tryMove(nx, s.z) || tryMove(s.x, nz)) s.stuck = Math.max(0, s.stuck - dt); else s.stuck += dt;
        s.g.rotation.y = Math.atan2(dx, dz);
    }
    s.g.position.set(s.x, s.y + Math.abs(Math.sin(gameTime * 9 + s.ph)) * (d > 3.8 ? 0.06 : 0), s.z);
    if (s.dec) { s.dec.pos.set(s.x, s.y + 0.9, s.z); s.dec.feet = s.y; }
}
// zombies hit a decoy (survivor / generator / barricade)
function campDamage(tp, amount) {
    if (CAMP.over) return;
    const o = tp.ref; if (!o || o.hp <= 0) return;
    o.hp -= amount * (tp.k === 'bar' ? 0.6 : tp.k === 'gen' ? 0.7 : 1);
    spawnParticles(tp.pos, tp.k === 'surv' ? 0xef4444 : 0xfacc15, 3, 4, 0.4, 0.12, true);
    if (o.hp > 0) return;
    o.hp = 0;
    if (tp.k === 'surv') {
        o.state = 'dead'; campFree({ g: o.g }); campDropDecoy(tp); toast('A SURVIVOR WAS LOST', '#f87171', 2); sfx('hurt'); CAMP.stat.lost = (CAMP.stat.lost || 0) + 1;
    } else campFail(tp.k === 'gen' ? 'A generator was destroyed' : 'The barricade was destroyed');
}

// ---------- mission flow ----------
function campStart(id) {
    const m = CAMP_ALL.find(x => x.id === id);
    if (!m || (!campUnlocked(m) && !CAMP.dbg) || currentGameState !== 'main' && currentGameState !== 'campend') return false;
    campClean();
    CAMP.on = true; CAMP.m = m; CAMP.over = false;
    initAudio();
    resetRun();
    changeGameState('playing');
    return true;
}
function campClean() {
    for (const o of [...CAMP.objs]) campFree(o);
    CAMP.objs = []; CAMP.decoys = []; campSyncDecoys(); CAMP.nm = 0; CAMP.tg = null;
    if (CAMP.st) { try { CAMP_H[CAMP.st.def.t].end(CAMP.st); } catch (e) {} }
    CAMP.st = null; CAMP.waves = false;
}
function campBegin() {       // called by startFreshRun once the arena is built
    const m = CAMP.m;
    playerStats.money = m.cash; playerStats.level = m.lvl;
    Object.assign(CAMP, { t: 0, deaths: 0, dmg: 0, inv: 0, kills: 0, heads: 0, k0: runStats.kills, h0: runStats.headshots, si: -1, st: null, stat: {}, supT: 50, hudT: 0, lastPos: null, objs: [], nm: 0, tg: null });
    CAMP.decoys = []; campSyncDecoys();
    showIntel(`<div class="text-xs font-black text-amber-300 hud-text">MISSION ${m.n}</div><div class="text-sm font-black text-white hud-text">${m.name}</div><div class="text-xs text-gray-100">${m.sum}</div>`, 6);
    campNextStage();
}
function campNextStage() {
    if (CAMP.st) {
        const st = CAMP.st; CAMP.lastPos = st.pos || (st.gens && [st.gens[0].x, 0, st.gens[0].z]) || null;
        CAMP_H[st.def.t].end(st);
    }
    CAMP.si++;
    const def = CAMP.m.stages[CAMP.si];
    if (!def) { CAMP.st = null; campWin(); return; }
    const st = { def, t: 0, spT: 1 };
    CAMP.st = st; CAMP.waves = def.t === 'survive';
    CAMP_H[def.t].init(st);
    toast(CAMP_H[def.t].title(st), '#fbbf24', 2.6); sfx('wave');
    if (def.t === 'survive' && CAMP.si > 0) spawnWave();
    campHud(true);
}
function campWaveCleared() {
    const st = CAMP.st; if (!st || st.def.t !== 'survive' || CAMP.over) return;
    st.cleared++;
    if (st.cleared >= st.def.n) { intermission = 0; campNextStage(); }
}
function campTick(dt) {
    if (CAMP.over || currentGameState !== 'playing') return;
    CAMP.t += dt; CAMP.inv = Math.max(0, CAMP.inv - dt);
    CAMP.kills = runStats.kills - CAMP.k0; CAMP.heads = runStats.headshots - CAMP.h0;
    const st = CAMP.st; if (!st) return;
    st.t += dt;
    if (CAMP.si >= 0 && !CAMP.waves && (CAMP.supT -= dt) <= 0) { CAMP.supT = 55; if (!supplies.length) spawnSupply(); }
    const H = CAMP_H[st.def.t];
    if (H.tick(st, dt) && !CAMP.over) campNextStage();
    if (CAMP.over) return;
    CAMP.nm = 0;
    if (CAMP.st) CAMP_H[CAMP.st.def.t].marks(CAMP.st);
    campPickTarget();
    campHud(false, dt);
    campArrow();
}
function campPickTarget() {       // the nearest marker with a label gets the on-screen arrow
    let best = null, bd = 1e9;
    for (let i = 0; i < CAMP.nm; i++) {
        const m = CAMP.marks[i]; if (!m.label) continue;
        const d = Math.hypot(m.x - camera.position.x, m.z - camera.position.z); if (d < bd) { bd = d; best = m; }
    }
    CAMP.tg = best; CAMP.tgD = bd;
}
const _campO = { main: '', sub: '', p: 0 };
function campHud(force, dt) {
    const el = $('hud-obj');
    el.classList.toggle('hidden', !CAMP.on || CAMP.over);
    if (!CAMP.on || !CAMP.st) return;
    CAMP.hudT -= dt || 0; if (CAMP.hudT > 0 && !force) return; CAMP.hudT = 0.12;
    const o = _campO; o.main = ''; o.sub = ''; o.p = 0;
    CAMP_H[CAMP.st.def.t].hud(CAMP.st, o);
    const m = CAMP.m, stg = m.stages.length > 1 ? `  -  PART ${CAMP.si + 1}/${m.stages.length}` : '';
    setText($('obj-mis'), `MISSION ${m.n}: ${m.name}${stg}`);
    setText($('obj-main'), o.main); setText($('obj-sub'), o.sub + (m.stages.length ? '' : ''));
    setWidth($('obj-fill'), clamp(o.p, 0, 1) * 100);
    setText($('obj-lives'), '♥'.repeat(campLives()) + '♡'.repeat(m.lives - campLives()) + '   ' + campFmt(CAMP.t));
}
function campArrow() {
    const el = $('camp-arrow'), t = CAMP.tg;
    if (!t || currentGameState !== 'playing' || CAMP.over) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    _cv.set(t.x, t.y + 2.4, t.z).project(camera);
    let sx = _cv.x, sy = _cv.y; const behind = _cv.z > 1;
    if (behind) { sx = -sx; sy = -sy; if (Math.abs(sx) < 0.06) sx = 0.06; }
    const W = innerWidth, H = innerHeight, on = !behind && Math.abs(sx) < 0.9 && Math.abs(sy) < 0.82;
    let ang;
    if (on) { ang = 180; sy += 0.06; } else { const k = 1 / Math.max(Math.abs(sx) / 0.88, Math.abs(sy) / 0.76, 0.001); sx *= k; sy *= k; ang = Math.atan2(sx, sy) * 57.296; }
    setStyle(el, 'left', Math.round((sx * 0.5 + 0.5) * W) + 'px'); setStyle(el, 'top', Math.round((-sy * 0.5 + 0.5) * H) + 'px');
    setStyle($('camp-arr-i'), 'transform', `rotate(${Math.round(ang)}deg)`);
    setText($('camp-arr-t'), `${t.label} ${Math.round(CAMP.tgD)}m`);
}
function campMinimap(c, scale, off) {
    const pulse = 3.5 + Math.sin(gameTime * 6) * 1.2;
    for (let i = 0; i < CAMP.nm; i++) {
        const m = CAMP.marks[i], x = (m.x + off) * scale, y = (m.z + off) * scale;
        c.strokeStyle = c.fillStyle = campHex(m.c); c.lineWidth = 2;
        if (m.r > 0) { c.globalAlpha = 0.5; c.beginPath(); c.arc(x, y, Math.max(4, m.r * scale), 0, 6.283); c.stroke(); c.globalAlpha = 1; }
        if (m.label) { c.beginPath(); c.arc(x, y, pulse, 0, 6.283); c.fill(); } else c.fillRect(x - 2, y - 2, 4, 4);
    }
}
function campDeath() {
    CAMP.deaths++;
    if (CAMP.deaths >= CAMP.m.lives) { currentHp = 0; campFail('You ran out of lives'); return; }
    currentHp = maxHp; const tier = playerStats.armorTier ? armorDb[playerStats.armorTier] : null; if (tier) currentArmor = tier.max;
    camera.position.set(spawnPt[0], EYE_STAND, spawnPt[1]); feetY = 0; velocity.set(0, 0, 0); push.set(0, 0, 0);
    CAMP.inv = 3; screenFlash('rgba(255,255,255,0.5)');
    toast(`YOU WENT DOWN - ${campLives()} ${campLives() === 1 ? 'LIFE' : 'LIVES'} LEFT`, '#f87171', 2.6); sfx('hurt');
    updateHUD();
}
function campBonus(s3) {
    switch (s3.k) {
        case 'heads': return CAMP.heads >= s3.v;
        case 'dmg': return CAMP.dmg <= s3.v;
        case 'allsurv': { const rs = CAMP.m.stages.find(x => x.t === 'rescue'); return (CAMP.stat.lost || 0) === 0 && (CAMP.stat.alive || 0) >= (rs ? rs.n : 3); }
        case 'barr': return (CAMP.stat.barEnd || 0) >= s3.v;
        case 'timeleft': return (CAMP.stat.left || 0) >= s3.v;
        case 'bosstime': return CAMP.stat.bossT !== undefined && CAMP.stat.bossT <= s3.v;
    }
    return false;
}
function campStars(win) {
    const m = CAMP.m;
    return [win, win && (m.s2.k === 'nodeath' ? CAMP.deaths === 0 : CAMP.t <= m.s2.v), win && campBonus(m.s3)];
}
function campEnd(win, reason) {
    CAMP.over = true; $('hud-obj').classList.add('hidden'); $('camp-arrow').classList.add('hidden');
    const m = CAMP.m, ea = campStars(win), stars = ea.filter(Boolean).length, prev = campDone(m);
    let cash = 0, xp = 0, skin = '';
    if (win) {
        const mult = prev ? 0.25 : 1; cash = Math.round(m.reward.cash * mult); xp = Math.round(m.reward.xp * mult);
        if (typeof chRoll === 'function') chRoll();
        if (chState) { chState.bank = (chState.bank || 0) + cash; chSave(); }
        gainXP(xp, true); saveJSON('blocky21_life', life);
        if (m.reward.skin && !CAMP.skins[m.reward.skin]) { CAMP.skins[m.reward.skin] = 1; skin = m.reward.skin.split(':')[1].toUpperCase(); }
        const best = !prev || stars > prev.s || (stars === prev.s && CAMP.t < prev.t);
        campSave.done[m.id] = { s: Math.max(stars, prev ? prev.s : 0), t: best ? CAMP.t : prev.t, d: best ? CAMP.deaths : prev.d };
        campWrite();
    }
    const nx = CAMP_ALL[m.n], next = win && nx && campUnlocked(nx) ? nx : null;
    const rows = [['Complete the mission', ea[0]], [m.s2.txt, ea[1]], [m.s3.txt, ea[2]]];
    let h = `<div class="cbox panel"><div class="text-center"><div class="htitle text-4xl ${win ? 'text-green-300' : 'text-red-400'}">${win ? 'MISSION COMPLETE' : 'MISSION FAILED'}</div>
        <div class="text-sm font-black tracking-widest text-gray-300 mt-1">MISSION ${m.n}: ${m.name}</div>${win ? '' : `<div class="text-red-300 font-bold mt-1">${reason}</div>`}
        <div class="my-3">${ea.map((e, i) => `<span class="cres-star${e ? ' on' : ''}">★</span>`).join('')}</div></div>
        <div class="mb-3">${rows.map(([t, e]) => `<div class="cstar-row${e ? ' on' : ''}"><span class="s">${e ? '★' : '☆'}</span>${t}</div>`).join('')}</div>
        <div class="grid grid-cols-4 gap-2 text-center mb-3">${[['TIME', campFmt(CAMP.t)], ['KILLS', CAMP.kills], ['HEADSHOTS', CAMP.heads], ['DEATHS', CAMP.deaths]].map(([k, v]) => `<div class="stat"><div class="v">${v}</div><div class="k">${k}</div></div>`).join('')}</div>`;
    if (win) h += `<div class="text-center text-sm font-black mb-2"><span class="text-green-300">+$${cash} (added to your next run)</span> &nbsp; <span class="text-amber-300">+${xp} XP</span>${skin ? `<div class="text-fuchsia-300 mt-1">NEW WEAPON SKIN: ${skin} (Customize tab)</div>` : ''}${prev ? '<div class="text-xs text-gray-400">Replay rewards are reduced.</div>' : ''}</div>` +
        `<div class="cline"><div>${campPortrait(m.out.w, 'cp-sm')}</div><div><div class="who" style="color:${CAMP_PEOPLE[m.out.w].col}">${CAMP_PEOPLE[m.out.w].name}</div><div class="txt">${m.out.t}</div></div></div>`;
    h += `<div class="flex gap-3 justify-center flex-wrap mt-4">${next ? '<button class="hbtn pri lg" data-act="next">NEXT MISSION &#9654;</button>' : ''}<button class="hbtn lg" data-act="retry">${win ? 'REPLAY' : 'TRY AGAIN'}</button><button class="hbtn lg" data-act="map">CAMPAIGN MAP</button></div></div>`;
    $('camp-result').innerHTML = h; $('camp-result').dataset.next = next ? next.id : '';
    sfx(win ? 'upgrade' : 'hurt');
    changeGameState('campend');
}
function campWin() { if (!CAMP.over) campEnd(true, ''); }
function campFail(reason) { if (!CAMP.over) campEnd(false, reason); }
function campLeave(toMap = true) {
    campClean(); CAMP.on = false; CAMP.over = false; CAMP.m = null;
    $('hud-obj').classList.add('hidden'); $('camp-arrow').classList.add('hidden');
    resetRun(); changeGameState('main');
    setMenuView(toMap ? 'camp' : 'home');
}
$('camp-result').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    sfx('click');
    const a = b.dataset.act, id = CAMP.m && CAMP.m.id, nx = $('camp-result').dataset.next;
    if (a === 'map') campLeave(true);
    else if (a === 'retry') { campRestart(id); }
    else if (a === 'next') campRestart(nx);
});
function campRestart(id) {
    campClean(); CAMP.on = false; CAMP.over = false;
    campStart(id);
}

// ---------- campaign map screen + briefing ----------
let campSel = null;
const campStarsHtml = (n) => `<div class="cstars">${[0, 1, 2].map(i => `<span class="${i < n ? 'on' : ''}">★</span>`).join('')}</div>`;
const CAMP_POS = [[9, 72], [26, 30], [42, 68], [58, 28], [75, 66], [91, 32]];
let campChap = 1;
const campChapUnlocked = (ch) => ch.id === 1 || !!campDone(CAMP_CHAPTERS[ch.id - 2].missions[CAMP_CHAPTERS[ch.id - 2].missions.length - 1]);
function renderCampMenu() {
    if (!campSel || !CAMP_ALL.includes(campSel)) { campSel = CAMP_ALL.find(m => campUnlocked(m) && !campDone(m)) || CAMP_ALL[CAMP_ALL.length - 1]; campChap = campSel.ch; }
    const ch = CAMP_CHAPTERS[campChap - 1], ms = ch.missions;
    if (campSel.ch !== campChap) campSel = ms.find(m => campUnlocked(m) && !campDone(m)) || ms[ms.length - 1];
    const total = CAMP_ALL.reduce((a, m) => a + (campDone(m) ? campDone(m).s : 0), 0);
    $('camp-total').textContent = `★ ${total} / ${CAMP_ALL.length * 3}`;
    $('camp-chap').innerHTML = `<div class="cchaps">${CAMP_CHAPTERS.map(c => { const lk = !campChapUnlocked(c), n = c.missions.filter(m => campDone(m)).length;
        return `<button class="hbtn sm${c.id === campChap ? ' pri' : ''}" data-ch="${c.id}"${lk ? ' disabled style="opacity:.45"' : ''}>${lk ? '🔒 ' : ''}CHAPTER ${c.id}: ${c.name} <span class="text-[10px] opacity-80">${n}/${c.missions.length}</span></button>`; }).join('')}</div>CHAPTER ${ch.id}: ${ch.name}  -  ${ch.blurb}`;
    const pts = CAMP_POS.slice(0, ms.length);
    let h = `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="rgba(148,163,184,0.45)" stroke-width="0.7" stroke-dasharray="2 1.6" vector-effect="non-scaling-stroke"/></svg>`;
    ms.forEach((m, i) => {
        const d = campDone(m), lock = !campUnlocked(m), cur = !lock && !d;
        h += `<button class="cnode${lock ? ' lock' : ''}${d ? ' done' : ''}${cur ? ' cur' : ''}${i === ms.length - 1 ? ' boss' : ''}${campSel === m ? ' sel' : ''}" data-m="${m.id}" style="left:${pts[i][0]}%;top:${pts[i][1]}%"><div class="dot">${lock ? '🔒' : m.n}</div><div class="nm">${m.name}</div>${campStarsHtml(d ? d.s : 0)}</button>`;
    });
    $('camp-map').innerHTML = h;
    const m = campSel, d = campDone(m), lock = !campUnlocked(m), who = m.brief[0].w;
    const stageTxt = m.stages.map(s => campStageName[s.t]).join('  +  ');
    $('camp-detail').innerHTML = `<div class="flex gap-3 items-center mb-2">${campPortrait(who, 'cp-sm')}<div><div class="text-xs font-black tracking-widest text-amber-300">MISSION ${m.n}</div><div class="htitle text-xl text-white leading-tight">${m.name}</div></div></div>
        <div class="text-[11px] font-black tracking-wider text-gray-400 mb-2">${MAPS[m.map].name} &middot; ${THEMES[m.light].name} &middot; ${DIFFICULTIES[m.diff].name}</div>
        <div class="cobj"><b>OBJECTIVE</b> ${m.sum}</div><div class="cobj text-gray-400">${stageTxt}</div>
        <div class="mt-3 text-[11px] font-black tracking-widest text-gray-400">STARS</div>
        <div class="cstar-row${d ? ' on' : ''}"><span class="s">${d ? '★' : '☆'}</span>Complete the mission</div>
        <div class="cstar-row${d && d.s >= 2 ? ' on' : ''}"><span class="s">${d && d.s >= 2 ? '★' : '☆'}</span>${m.s2.txt}</div>
        <div class="cstar-row${d && d.s >= 3 ? ' on' : ''}"><span class="s">${d && d.s >= 3 ? '★' : '☆'}</span>${m.s3.txt}</div>
        <div class="mt-2 text-[11px] font-black tracking-widest text-gray-400">REWARDS ${d ? '(replays pay 25%)' : ''}</div>
        <div class="cobj">$${m.reward.cash} cash &middot; ${m.reward.xp} XP${m.reward.skin ? ` &middot; <b style="color:#e879f9">${m.reward.skin.split(':')[1].toUpperCase()} weapon skin${campOwns('camo', m.reward.skin.split(':')[1]) ? ' (owned)' : ''}</b>` : ''}</div>
        <button class="hbtn pri lg w-full mt-4" id="camp-play"${lock ? ' disabled style="opacity:.45"' : ''}>${lock ? 'COMPLETE MISSION ' + (m.n - 1) + ' FIRST' : (d ? 'REPLAY MISSION' : 'START MISSION') + ' &#9654;'}</button>`;
}
$('camp-chap').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ch]'); if (!b || b.disabled) return;
    const c = CAMP_CHAPTERS[+b.dataset.ch - 1]; if (!c || !campChapUnlocked(c)) return;
    initAudio(); sfx('click'); campChap = c.id; campSel = null; campSel = c.missions.find(m => campUnlocked(m) && !campDone(m)) || c.missions[c.missions.length - 1]; renderCampMenu();
});
$('camp-map').addEventListener('click', (e) => {
    const b = e.target.closest('.cnode'); if (!b) return;
    const m = CAMP_ALL.find(x => x.id === b.dataset.m); if (!m) return;
    initAudio(); sfx(campUnlocked(m) ? 'click' : 'deny'); campSel = m; renderCampMenu();
});
$('camp-detail').addEventListener('click', (e) => { if (e.target.closest('#camp-play') && campUnlocked(campSel)) { initAudio(); sfx('click'); campBrief(campSel); } });
$('btn-camp-back').addEventListener('click', () => { initAudio(); sfx('click'); setMenuView('home'); });
function campBrief(m) {
    const first = CAMP_PEOPLE[m.brief[0].w];
    $('camp-brief').innerHTML = `<div class="cbox panel"><div class="text-xs font-black tracking-widest text-amber-300">CHAPTER ${m.ch} &middot; MISSION ${m.n} &middot; BRIEFING</div>
        <div class="htitle text-3xl text-white mb-1">${m.name}</div><div class="text-[11px] font-black tracking-wider text-gray-400 mb-2">${MAPS[m.map].name} &middot; ${THEMES[m.light].name} &middot; START CASH $${m.cash} &middot; ${m.lives} LIVES</div>
        ${m.brief.map(l => `<div class="cline">${campPortrait(l.w, m.brief.indexOf(l) ? 'cp-sm' : 'cp-lg')}<div><div class="who" style="color:${CAMP_PEOPLE[l.w].col}">${CAMP_PEOPLE[l.w].name} <span class="text-gray-500">${CAMP_PEOPLE[l.w].role}</span></div><div class="txt">${l.t}</div></div></div>`).join('')}
        <div class="cobj mt-2"><b>OBJECTIVE</b> ${m.sum}</div>
        <div class="flex gap-3 mt-4 justify-end"><button class="hbtn lg" data-act="back">BACK</button><button class="hbtn pri lg" data-act="go">DEPLOY &#9654;</button></div></div>`;
    $('camp-brief').classList.remove('hidden'); $('camp-brief').dataset.m = m.id;
}
$('camp-brief').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    sfx('click');
    if (b.dataset.act === 'back') $('camp-brief').classList.add('hidden');
    else { const id = $('camp-brief').dataset.m; $('camp-brief').classList.add('hidden'); campStart(id); }
});
function campMenuLabel() {
    const n = CAMP_ALL.filter(m => campDone(m)).length;
    $('btn-campaign').innerHTML = `CAMPAIGN <em>${n ? n + '/' + CAMP_ALL.length : 'CHAPTER 1'}</em>`;
}
campMenuLabel(); CAMP.ready = true;
