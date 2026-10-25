// ---------- SETTINGS ----------
const bootAA = settings.quality !== 'low';
function saveSettings() { saveJSON('blocky21_settings', settings); }
function renderSettings() {
    document.querySelectorAll('#set-quality .qbtn').forEach(b => b.classList.toggle('on', b.dataset.q === settings.quality));
    const aaNote = (settings.quality !== 'low') !== bootAA ? ' (Anti-aliasing change applies after reloading the page.)' : '';
    $('set-quality-desc').textContent = QUALITY_DESC[settings.quality] + aaNote;
    $('set-fov').value = settings.fov; $('set-fov-v').textContent = settings.fov + '\u00b0';
    $('set-sens').value = settings.sens; $('set-sens-v').textContent = settings.sens.toFixed(2) + 'x';
    $('set-vol').value = settings.volume; $('set-vol-v').textContent = Math.round(settings.volume * 100) + '%';
    $('set-fps').checked = settings.showFps;
}
document.querySelectorAll('#set-quality .qbtn').forEach(b => b.addEventListener('click', () => {
    settings.quality = b.dataset.q; saveSettings(); applyQuality(); renderSettings();
}));
$('set-fov').addEventListener('input', (e) => { settings.fov = +e.target.value; fovNow = settings.fov; camera.fov = fovNow; camera.updateProjectionMatrix(); saveSettings(); renderSettings(); });
$('set-sens').addEventListener('input', (e) => { settings.sens = +e.target.value; saveSettings(); renderSettings(); });
$('set-vol').addEventListener('input', (e) => { settings.volume = +e.target.value; if (master) master.gain.value = settings.volume; saveSettings(); renderSettings(); });
$('set-fps').addEventListener('change', (e) => { settings.showFps = e.target.checked; saveSettings(); });


function updateMenuBest() {
    const b = life.best[bestKey(settings.diff, settings.mode)], ml = settings.mode === 'rush' ? ' RUSH' : settings.mode === 'bossrush' ? ' BOSS RUSH' : '';
    ui.menuBest.textContent = settings.mode === 'sandbox' ? 'SANDBOX - JUST HAVE FUN' : (b ? `PERSONAL BEST (${DIFFICULTIES[settings.diff].name}${ml}): WAVE ${b}` : `NO BEST YET ON ${DIFFICULTIES[settings.diff].name}${ml}`);
}


// ---------- MAIN MENU ----------
let menuTab = 'play';
const BESTIARY = {
    grunt: 'A shambling walker zombie. Lurches straight at you and claws. The basic enemy.',
    sprinter: 'A skinny runner zombie. Very fast, but fragile. Arrives from wave 1.',
    tank: 'A bloated brute zombie in chains. Slow and tough, hits hard - keep your distance.',
    spitter: 'A swollen acid zombie. Lobs acid balls from medium range (about 24m) - back off out of range or sidestep them.',
    bomber: 'A glowing, bloated exploder zombie. Rushes you and bursts. Pop it early - it hurts its friends too.',
    splitter: 'A bloated zombie full of Mites. Kill it and three fast little Mites burst out. From wave 7.',
    mite: 'A tiny, very fast critter that bursts out of a dead Splitter. One hit kills it.',
    screamer: 'Hangs back behind the horde and shrieks: every zombie near it goes into a rage (faster, harder hits) for 5 seconds. From wave 10.',
    boss: 'A giant zombie abomination. Ground-slams when you get close and calls in sprinters for backup.'
};
const hexC = (c) => '#' + new THREE.Color(c).getHexString();
const KEY_KIND = { sleeve: 'sleeve', glove: 'glove', xhStyle: 'xhStyle', xhColor: 'xhColor', camo: 'camo', tracer: 'tracer', killfx: 'killfx' };
const menuLocked = (key, v) => !!KEY_KIND[key] && v !== 'random' && !isUnlocked(KEY_KIND[key], v);
function chipRow(label, key, entries, desc, extra = '') {
    return `<div class="mlabel">${label}</div><div class="flex flex-wrap gap-2">${entries.map(([v, text, dot]) => { const lk = menuLocked(key, v);
        return `<button class="chip${extra}${settings[key] === v ? ' on' : ''}${lk ? ' locked' : ''}" data-set="${key}" data-val="${v}"${lk ? ` data-rank="${lockTag(KEY_KIND[key], v)}"` : ''}>${dot ? `<span class="pdot" style="background:${dot};color:${dot}"></span>` : ''}${text}${lk ? ` <span class="text-[10px]">\ud83d\udd12${lockTag(KEY_KIND[key], v)}</span>` : ''}</button>`; }).join('')}</div>${desc !== undefined ? `<div class="mdesc">${desc}</div>` : ''}`;
}
function swatchRow(label, key, table) {
    return `<div class="mlabel">${label}</div><div class="flex flex-wrap gap-2">${Object.entries(table).map(([k, c]) => { const lk = menuLocked(key, k);
        return `<button class="sw${settings[key] === k ? ' on' : ''}${lk ? ' locked' : ''}" title="${k}${lk ? (campSkin(KEY_KIND[key], k) ? ' - campaign reward' : prestigeNeed(KEY_KIND[key], k) ? ' - prestige ' + prestigeNeed(KEY_KIND[key], k) : ' - rank ' + unlockRank(KEY_KIND[key], k)) : ''}" style="background:${typeof c === 'number' ? hexC(c) : c}" data-set="${key}" data-val="${k}"${lk ? ` data-rank="${lockTag(KEY_KIND[key], k)}"` : ''}></button>`; }).join('')}</div>`;
}
function renderRankBar() {
    const ri = rankInfo(), P = prestigeLvl();
    let next = null;
    if (!P) for (let r = ri.rank + 1; r <= MAX_RANK && !next; r++) { const u = shownUnlocksAtRank(r); if (u.length) next = { r, u }; }
    const after = ri.rank >= MAX_RANK ? (canPrestige() ? 'MAX RANK - you can PRESTIGE!' : 'MAX RANK - MAX PRESTIGE') : `${ri.into} / ${ri.need} XP`;
    $('menu-rank').innerHTML = (P ? prestigeBadge(P, 26) : '') + `<div class="font-black text-lg whitespace-nowrap" style="color:${P ? PRESTIGE_COLORS[P] : '#fcd34d'}">${P ? `P${P} \u00b7 ` : ''}RANK ${ri.rank}</div>
        <div class="flex-1"><div class="h-2.5 bg-black/50 rounded overflow-hidden border border-white/10"><div class="h-full bg-gradient-to-r from-amber-500 to-yellow-300" style="width:${ri.rank >= MAX_RANK ? 100 : ri.into / ri.need * 100}%"></div></div>
        <div class="text-[11px] text-gray-400 font-bold mt-1">${after}${next ? `  \u00b7  Next unlock at rank ${next.r}: ${next.u.map(u => unlockLabel(u.kind, u.id)).slice(0, 2).join(', ')}` : (P && ri.rank < MAX_RANK ? `  \u00b7  Prestige ${P + 1 <= MAX_PRESTIGE ? P + 1 + ' at rank ' + MAX_RANK : 'maxed'}  \u00b7  +${5 * P}% XP, +$${100 * P} start cash` : '')}</div></div>` +
        (canPrestige() ? `<button class="chip prest" data-act="goprestige">PRESTIGE</button>` : '');
}
// 4.0: the HUD line under the enemy count - your rank and prestige badge
let rankHudKey = '';
function updateRankHUD() {
    const P = prestigeLvl(), r = rankInfo().rank, key = P + ':' + r;
    if (key === rankHudKey) return;
    rankHudKey = key;
    ui.hudRank.innerHTML = (P ? prestigeBadge(P, 16) + `<span style="color:${PRESTIGE_COLORS[P]}">PRESTIGE ${P}</span><span class="text-gray-400">\u00b7</span>` : '') + `<span>RANK ${r}</span>`;
}
function renderMenu() {
    document.querySelectorAll('#menu-tabs .mtab').forEach(b => b.classList.toggle('on', b.dataset.tab === menuTab));
    const P = $('menu-panel');
    let h = '';
    if (menuTab === 'play') {
        h += chipRow('CLASS', 'cls', CLASS_ORDER.map(k => [k, CLASSES[k].name, hexC(CLASSES[k].color)]));
        h += classInfoCard(validClass(settings.cls));
        h += chipRow('MODE', 'mode', Object.entries(MODES).map(([k, m]) => [k, m.name, m.color]), MODES[settings.mode].desc);
        h += chipRow('MAP', 'map', [['random', 'RANDOM']].concat(Object.entries(MAPS).filter(([, m]) => !m.hidden).map(([k, m]) => [k, m.chip || m.name])), settings.map === 'random' ? 'A different map every run.' : MAPS[settings.map].desc, ' sm');
        h += chipRow('LIGHTING', 'light', [['random', 'RANDOM']].concat(Object.entries(THEMES).map(([k, t]) => [k, t.name, hexC(t.neon)])), settings.light === 'random' ? 'A different time of day every run.' : 'Preview it on the right.');
        h += chipRow('DIFFICULTY', 'diff', Object.entries(DIFFICULTIES).map(([k, d]) => [k, d.name, d.color]), DIFFICULTIES[settings.diff].desc);
    } else if (menuTab === 'challenges') {
        h += chPanel();
    } else if (menuTab === 'news') {
        h += whatsNew();
    } else if (menuTab === 'customize') {
        h += swatchRow('SLEEVES', 'sleeve', SLEEVES);
        h += swatchRow('GLOVES', 'glove', GLOVES);
        h += chipRow('WEAPON CAMO', 'camo', Object.entries(CAMOS).map(([k, c]) => [k, c.name, c.rainbow ? '#f472b6' : (c.c !== undefined ? hexC(c.c) : '#9ca3af')]), 'Applies to every gun. Upgrade levels 4 and 5 keep their gold / plasma finish.');
        h += chipRow('TRACERS', 'tracer', Object.entries(TRACERS).map(([k, c]) => [k, c.name, c.rainbow ? '#a78bfa' : (c.c !== undefined ? hexC(c.c) : '#ffe9a8')]));
        h += chipRow('KILL EFFECT', 'killfx', Object.entries(KILLFX).map(([k, c]) => [k, c.name]), 'What enemies burst into when they die.');
        h += chipRow('CROSSHAIR', 'xhStyle', Object.entries(XH_STYLES));
        h += swatchRow('CROSSHAIR COLOR', 'xhColor', Object.fromEntries(XH_COLORS.map(c => [c, c])));
        h += `<div class="mlabel">PREVIEW</div><div class="relative w-40 h-24 rounded-lg bg-gradient-to-b from-slate-600 to-slate-800 border border-white/10"><div id="xh-preview" class="xhair ${'xh-' + settings.xhStyle}" style="position:absolute;left:50%;top:50%;width:0;height:0;--gap:6px;--xh:${settings.xhColor}"><div class="ch-t"></div><div class="ch-b"></div><div class="ch-l"></div><div class="ch-r"></div><div class="ch-dot"></div><div class="ch-c"></div></div></div>
              <div class="mdesc">Your arms update live - look at the gun on the right.</div>`;
    } else if (menuTab === 'stats') {
        const acc = life.shots ? Math.round(life.hits / life.shots * 100) : 0, hs = life.kills ? Math.round(life.headshots / life.kills * 100) : 0;
        const hrs = Math.floor(life.time / 3600), mins = Math.floor(life.time % 3600 / 60);
        const tile = (k, v) => `<div class="stat"><div class="v">${v}</div><div class="k">${k}</div></div>`;
        h += `<div class="mlabel">LIFETIME</div><div class="grid grid-cols-3 gap-2">${tile('RUNS', life.runs)}${tile('KILLS', life.kills)}${tile('HEADSHOTS', `${life.headshots} <span class="text-sm text-gray-400">${hs}%</span>`)}${tile('ACCURACY', acc + '%')}${tile('BOSSES', life.bosses)}${tile('WAVES CLEARED', life.waves)}${tile('TIME PLAYED', hrs ? `${hrs}h ${mins}m` : `${mins}m`)}${tile('DAMAGE', life.damage >= 10000 ? Math.round(life.damage / 1000) + 'k' : life.damage)}${tile('AVG WAVE', life.runs ? (life.waves / life.runs + 1).toFixed(1) : '-')}${tile('PRESTIGE', prestigeLvl() ? `<span class="flex items-center gap-2">${prestigeBadge(prestigeLvl(), 24)}${prestigeLvl()}</span>` : '0')}${tile('DAILY CHALLENGES', chState.doneD)}${tile('WEEKLY CHALLENGES', chState.doneW)}</div>`;
        h += `<div class="mlabel">BEST WAVES</div><div class="grid grid-cols-4 gap-y-1 text-sm font-bold bg-black/30 rounded-lg p-3"><div class="text-gray-400">DIFFICULTY</div><div class="text-gray-400">CLASSIC</div><div class="text-gray-400">RUSH</div><div class="text-gray-400">BOSS RUSH</div>${Object.entries(DIFFICULTIES).map(([k, d]) => `<div style="color:${d.color}">${d.name}</div><div>${life.best[k] || '-'}</div><div>${life.best[k + '_rush'] || '-'}</div><div>${life.best[k + '_boss'] || '-'}</div>`).join('')}</div>`;
        h += `<div class="mlabel">CLASSES</div><div class="grid grid-cols-4 gap-y-1 text-sm font-bold bg-black/30 rounded-lg p-3"><div class="text-gray-400">CLASS</div><div class="text-gray-400">RUNS</div><div class="text-gray-400">KILLS</div><div class="text-gray-400">BEST WAVE</div>${CLASS_ORDER.map(k => { const c = life.cls[k] || {}; return `<div style="color:${CLASSES[k].css}">${CLASSES[k].name}</div><div>${c.runs || '-'}</div><div>${c.kills || '-'}</div><div>${c.best || '-'}</div>`; }).join('')}</div>`;
        h += `<div class="mlabel">MAPS</div><div class="grid grid-cols-4 gap-y-1 text-sm font-bold bg-black/30 rounded-lg p-3"><div class="text-gray-400">MAP</div><div class="text-gray-400">RUNS</div><div class="text-gray-400">WAVES CLEARED</div><div class="text-gray-400">BEST WAVE</div>${Object.entries(MAPS).filter(([, m]) => !m.hidden).map(([k, m]) => { const c = life.maps[k] || {}; return `<div>${m.name}</div><div>${c.runs || '-'}</div><div>${c.waves || '-'}</div><div>${c.best || '-'}</div>`; }).join('')}</div>`;
        const wk = Object.entries(life.weaponKills).sort((a, b) => b[1] - a[1]).slice(0, 6), top = wk.length ? wk[0][1] : 1;
        h += `<div class="mlabel">FAVORITE WEAPONS</div>` + (wk.length ? wk.map(([k, n]) => `<div class="flex items-center gap-3 text-sm font-bold mb-1"><div class="w-28 truncate">${killerName(k)}</div><div class="flex-1 h-3 bg-black/40 rounded overflow-hidden"><div class="h-full" style="width:${n / top * 100}%;background:${weaponsDb[k] ? hex(weaponsDb[k].color) : '#f97316'}"></div></div><div class="w-12 text-right">${n}</div></div>`).join('') : '<div class="mdesc">Play a run to start tracking.</div>');
        h += `<button class="chip mt-4" data-act="resetstats">RESET STATS</button>`;
    } else if (menuTab === 'ranks') {
        h += prestigePanel();
        const cur = unlockLevel();
        h += `<div class="mdesc">Ranks unlock cosmetics (sleeves, gloves, weapon camos, tracers, kill effects, crosshairs), the seven newest WEAPONS (Dual Pistols, Katana, Grenade Launcher, Tesla Gun, Railgun, Burst Carbine, Lever Rifle - buy them in the Armory once unlocked). The other weapons, gadgets, maps and modes are always available. Earn XP from kills (bosses give a lot), headshots, clearing waves and CHALLENGES. Hard gives 1.5x XP, Nightmare 2.2x, Rush +20%. Sandbox gives none.${prestigeLvl() ? ' You have prestiged, so everything below stays unlocked.' : ''}</div><div class="flex flex-col gap-1.5 mt-3">`;
        for (let r = 2; r <= 25; r++) {
            const u = shownUnlocksAtRank(r); if (!u.length) continue;
            const got = cur >= r;
            h += `<div class="bcard items-center" style="${got ? 'border-color:rgba(250,204,21,0.5)' : 'opacity:0.75'}"><div class="w-14 text-center font-black ${got ? 'text-amber-300' : 'text-gray-500'}">${got ? '\u2713' : '\ud83d\udd12'} ${r}</div><div class="flex-1 text-sm font-bold ${got ? 'text-white' : 'text-gray-400'}">${u.map(x => unlockLabel(x.kind, x.id)).join('  \u00b7  ')}</div></div>`;
        }
        h += `</div>`;
    } else if (menuTab === 'bestiary') {
        const order = ['grunt', 'sprinter', 'tank', 'charger', 'spitter', 'leaper', 'shielder', 'bomber', 'splitter', 'mite', 'marksman', 'medic', 'screamer', 'riot', 'crawler', 'blighter'];
        h += `<div class="flex flex-col gap-2 mt-3">${order.map(id => { const t = enemyTypes[id];
            return `<div class="bcard"><div class="bswatch" style="background:${hexC(t.color)};border-top:6px solid ${hexC(t.eye || 0xfff4a8)}"></div><div class="flex-1"><div class="flex justify-between items-baseline"><div class="font-black tracking-wide">${t.name.toUpperCase()}</div><div class="text-xs font-bold text-gray-400">${Math.round(ENEMY_BASE_HP * t.hp)} HP \u00b7 ${'from wave ' + (t.minLvl || 1)}</div></div><div class="text-xs text-gray-300 mt-0.5">${t.intel || BESTIARY[id]}</div></div></div>`; }).join('')}</div>`;
        // 3.9: the bosses - one every 5th wave (the Abomination first, then the rest in a random order), pairs from wave 25
        const seenB = life.bossSeen || {}, killsB = life.bossKills || {};
        h += `<div class="mlabel mt-5">BOSSES</div><div class="mdesc">A boss every 5th wave: the Abomination first, then the other seven in a random order. From wave 25 they come in pairs. Every boss is ENRAGED below half health. Boss Rush mode fights them all back to back. Patient Zero only appears as the Campaign finale.</div>`;
        h += `<div class="flex flex-col gap-2 mt-2">${BOSS_IDS.map(id => { const t = enemyTypes[id], met = seenB[id] || killsB[id];
            return `<div class="bcard" style="border-color:${t.bar}55"><div class="bswatch" style="background:${hexC(t.color)};border-top:6px solid ${t.bar}"></div><div class="flex-1"><div class="flex justify-between items-baseline gap-2"><div><span class="font-black tracking-wide" style="color:${t.bar}">${t.name.toUpperCase()}</span> <span class="text-[10px] font-black text-gray-400 tracking-widest">${t.title}</span></div><div class="text-xs font-bold text-gray-400 whitespace-nowrap">${killsB[id] ? 'DEFEATED x' + killsB[id] : met ? 'MET' : 'NOT MET YET'}</div></div><div class="text-xs text-gray-300 mt-0.5">${t.tip}</div></div></div>`; }).join('')}</div>`;
        // 4.0: how the horde gets round the new maps
        h += `<div class="mlabel">HOW THEY MOVE</div><div class="mdesc" style="margin-top:0">Zombies can climb anything up to about 5m, but not glass railings or chain-link fences. In the MALL they come in through the entrances and the department-store doors and take the stairs and escalators up (they can't climb the 2nd-floor balconies). On the MILITARY BASE they walk round to the gates - you can jump the fences, they can't. A zombie that lands on a roof just drops off the edge. Special zombies (anything but Walkers and Runners) count for the "special zombies" challenge.</div>`;
    } else if (menuTab === 'controls') {
        const rows = [['W A S D', 'Move'], ['SPACE', 'Jump (hold to bunny hop)'], ['SHIFT', 'Sprint'], ['C', 'Slide (while running)'], ['LEFT CLICK', 'Shoot'], ['RIGHT CLICK / E', 'Aim down sights (hold) / spin up minigun'], ['R', 'Reload'], ['V', 'Melee shove (interrupts attacks)'], ['Q', 'Use secondary gadget'], ['G', 'Call airstrike (earned with a 12-kill streak)'], ['X', 'Class ability (pick your class on the Play tab)'], ['F', 'Inspect weapon'], ['1-9, 0, - / WHEEL', 'Switch weapons (the keys follow the order of the guns you own)'], ['RIGHT CLICK (KATANA)', 'Lunge forward, cutting through everything in your path'], ['HOLD CLICK (RAILGUN)', 'Charge the railgun - let go to fire'], ['ESC', 'Pause']];
        h += `<div class="flex flex-col gap-2 mt-3">${rows.map(([k, v]) => `<div class="flex items-center gap-3 text-sm"><div class="w-40 flex flex-wrap gap-1">${k.split(' / ').map(x => `<span class="key">${x}</span>`).join('')}</div><div class="text-gray-300 font-semibold">${v}</div></div>`).join('')}</div>`;
        h += `<div class="mdesc mt-4">Tip: a Charger that hits a wall is stunned and takes +50% damage. Melee a Marksman to cancel its shot.</div>`;
        h += `<div class="mdesc">Maps: in the MALL, stand on an escalator and it carries you up (or down). On the MILITARY BASE you can JUMP the chain-link fences - zombies have to go round to a gate.</div>`;
    }
    P.innerHTML = h;
    renderRankBar();
    updateMenuPreview();
    updateMenuBest();
}
// 4.0: what a class does, for the Play tab and the multiplayer menu
function classInfoCard(id) {
    const C = CLASSES[id], col = hexC(C.color);
    return `<div class="bcard flex-col mt-2" style="gap:4px;border-color:${col}66">
        <div class="flex items-baseline justify-between gap-2"><div class="font-black tracking-wide" style="color:${col}">${C.name} <span class="text-[10px] text-gray-400 tracking-widest">${C.role.toUpperCase()}</span></div><div class="text-[10px] font-bold text-gray-400 whitespace-nowrap">OFF IN PVP</div></div>
        <div class="text-xs text-gray-200"><span class="key">X</span> <b style="color:${col}">${C.ability}</b> - ${C.abilityDesc} <span class="text-gray-400">${C.cd[0]}s cooldown.</span></div>
        <div class="text-xs text-gray-300"><b class="text-white">PASSIVE</b> - ${C.passive}</div>
        <div class="text-[11px] text-gray-400"><b class="text-gray-300">UPGRADES</b> (Armory, during a run): ${C.tree.map((t, i) => `<b class="text-gray-200" title="${t.desc}" style="cursor:help">${i + 1}. ${t.name}</b>`).join(' › ')}</div>
    </div>`;
}
// 4.0 PRESTIGE: the section at the top of the Ranks tab (two clicks to prestige - the first one arms the button)
let prestigeArm = 0, prestigeJust = 0;
const PRESTIGE_REWARD = { 1: 'OBSIDIAN weapon camo', 2: 'OBSIDIAN sleeves', 3: 'STARLIGHT tracers', 4: 'STARDUST kill effect', 5: 'OBSIDIAN gloves' };
function prestigePanel() {
    const P = prestigeLvl(), ri = rankInfo();
    let h = `<div class="mlabel">PRESTIGE</div>`;
    if (prestigeJust) {
        const c = PRESTIGE_COLORS[prestigeJust];
        h += `<div class="bcard items-center mb-2" style="border-color:${c}">${prestigeBadge(prestigeJust, 40)}<div><div class="font-black text-lg" style="color:${c}">YOU ARE NOW PRESTIGE ${prestigeJust}!</div><div class="text-xs text-gray-300">Back to rank 1, with everything you unlocked still unlocked.${PRESTIGE_REWARD[prestigeJust] ? ' New: ' + PRESTIGE_REWARD[prestigeJust] + ' (Customize tab).' : ''}</div></div></div>`;
        prestigeJust = 0;
    }
    h += `<div class="mdesc" style="margin-top:0">Reach rank ${MAX_RANK} to PRESTIGE: your rank goes back to 1 and your prestige level goes up (up to ${MAX_PRESTIGE}). You keep everything you've unlocked. Every level gives a new badge (shown next to your rank here and on the HUD), +5% XP and +$100 starting cash, and prestige 1-5 each unlock a prestige-only cosmetic.</div>`;
    h += `<div class="flex flex-wrap gap-2 mt-2">${Array.from({ length: MAX_PRESTIGE }, (_, i) => i + 1).map(i => `<div title="Prestige ${i}${PRESTIGE_REWARD[i] ? ': ' + PRESTIGE_REWARD[i] : ''}" style="opacity:${P >= i ? 1 : 0.35}">${prestigeBadge(i, 30)}</div>`).join('')}</div>`;
    h += `<div class="mdesc">${Object.entries(PRESTIGE_REWARD).map(([i, t]) => `<span style="color:${P >= +i ? '#86efac' : '#9ca3af'}">P${i}: ${t}${P >= +i ? ' ✓' : ''}</span>`).join('  ·  ')}</div>`;
    if (canPrestige()) h += `<button class="chip prest mt-2" data-act="prestige">${prestigeArm > performance.now() ? 'CLICK AGAIN TO CONFIRM - YOUR RANK GOES BACK TO 1' : `PRESTIGE NOW → PRESTIGE ${P + 1}`}</button>`;
    else h += `<div class="mdesc text-amber-300" style="font-weight:800">${P >= MAX_PRESTIGE ? 'MAX PRESTIGE - nothing left to prove.' : `Rank ${ri.rank} / ${MAX_RANK}: ${MAX_RANK - ri.rank} more rank${MAX_RANK - ri.rank === 1 ? '' : 's'} to prestige ${P + 1}.`}</div>`;
    return h + `<div class="mlabel">RANK UNLOCKS</div>`;
}
// 4.0: the version line on the menu opens this - the highlights of the whole update
function whatsNew() {
    const sec = (title, col, items) => `<div class="mlabel" style="color:${col}">${title}</div><ul class="news text-sm text-gray-200">${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
    return `<div class="text-2xl font-black text-white mt-2">WHAT'S NEW IN 5.0</div>` +
        sec('PERFORMANCE + LIGHTING', '#86efac', ['Baked ambient occlusion and soft contact shadows on every building and block, on all quality tiers. Dithered sky with no colour banding.',
            'Low settings get a muzzle flash and explosion light with no real lights. Zombies far away think less often and are skipped when off screen: less lag in big waves.']) +
        sec('REALISTIC GUNS', '#fca5a5', ['All 18 weapons rebuilt: real receivers, rails, magazines, sights, grips, stocks and muzzle devices, with metal, polymer and wood textures.',
            'Bolts cycle with each shot, the katana is one curved blade, and every gun is only about 10 to 13 draw calls. Upgrades, attachments and camos all work.']) +
        sec('ENEMY + WORLD UPGRADES', '#7dd3fc', ['Props on every map: wrecked cars, barricades, sandbags, barrels, rubble, trees and more. New wall textures, drifting clouds, haze and a distant ridge line.',
            'Surface-aware bullet impacts, cracked bullet holes, big explosions with smoke and scorch marks, bright tracers, muzzle sparks and punchier screen shake.',
            'Zombies flinch when shot, lunge when they swing, walk with a bob and flop when they die. Office grunts and Bombers have new looks; some zombies shed embers, wisps and acid.']) +
        sec('NEW LOOK', '#fde047', ['New start screen with a live 3D scene behind the menu and a big 5.0 logo. A clean home menu: PLAY, CONTINUE, CAMPAIGN, MULTIPLAYER, ARMORY, SETTINGS.',
            'One shared button style, panel and colour theme on every screen, including the multiplayer lobby.']) +
        sec('CAMPAIGN: 3 CHAPTERS', '#fde047', ['<b>CAMPAIGN</b> now has three chapters of six story missions each: Ashfall, Dead Air and Patient Zero, ending in a new final boss on a new arena.',
            'Eight objective types, story briefings, 3 lives, 3 stars per mission and campaign-only weapon skins. It has its own save and never touches your normal run.']) +
        sec('NEW MAP, ENEMIES + WEAPONS', '#f0abfc', ['New map: <b>SUBWAY</b> (night). New zombies: <b>RIOT BREAKER</b> (breakable shield), <b>VENT CRAWLER</b> (ambushes from floor vents) and <b>BLIGHTER</b> (poison clouds).',
            'New guns: <b>BURST CARBINE</b> (rank 4) and <b>LEVER RIFLE</b> (rank 6).']) +
        sec('POWER-UPS REMOVED', '#9ca3af', ['No more power-up orbs, menu row or timers. Supply drops now give ammo or medical supplies. Old saves load fine and nothing was lost.']) +
        sec('WIFI GAME SCAN', '#7dd3fc', ['Open the <b>MULTIPLAYER</b> tab and games hosted on the same wifi show up in a list with a JOIN button. Hosts can switch this off with <b>Show my game on this wifi</b>.']) +
        sec('GRAPEVINE INVITES', '#86efac', ['In a party lobby, press <b>INVITE A FRIEND</b> to send your party to a Grapevine friend. If you get an invite, the game opens and joins the party for you.']) +
        `<div class="text-2xl font-black text-white mt-4">4.0 - THE MEGA UPDATE</div>` +
        sec('CLASSES', '#fb923c', ['Pick <b>ASSAULT</b>, <b>MEDIC</b>, <b>ENGINEER</b> or <b>RECON</b> on the Play tab. Each has an ability on <span class="key">X</span>, a passive and a 3-step upgrade tree in the Armory.',
            'Assault: Adrenaline (instant reload, speed and damage). Medic: a Healing Field. Engineer: a mini sentry and an ammo crate. Recon: a Radar Pulse that shows zombies through walls.',
            'Switch class for free between waves - each class keeps its own upgrades. Works in co-op too.']) +
        sec('NEW WEAPONS + ATTACHMENTS', '#f0abfc', ['<b>DUAL PISTOLS</b> (rank 2), a <b>KATANA</b> with a lunge (rank 3), a <b>GRENADE LAUNCHER</b> (rank 4), a <b>TESLA GUN</b> with chain lightning (rank 5) and a charge-up <b>RAILGUN</b> (rank 6).',
            'Attachments for your guns in the Armory: <b>SCOPE</b>, <b>EXTENDED MAG</b> and <b>GRIP</b>.', 'Number keys pick from the guns you own, in Armory order.']) +
        sec('NEW MAPS', '#7dd3fc', ['<b>MALL</b>: two floors of stores round a food court under a glass skylight, escalators that carry you, sky bridges, department stores and a roof you can climb to.',
            '<b>MILITARY BASE</b>: hangars with a jet and a helicopter, watchtowers joined by a catwalk, bunkers, a helipad, a runway, a fuel depot and a motor pool behind chain-link fences.']) +
        sec('CHALLENGES', '#c4b5fd', ['3 <b>daily</b> and 3 <b>weekly</b> challenges with XP and cash rewards. They carry over between runs and change every day / every Monday. See the CHALLENGES tab (and the pause menu).']) +
        sec('PRESTIGE', '#fcd34d', ['At rank 50, prestige (up to 10 times): back to rank 1 with a badge on the menu and HUD, +5% XP and +$100 starting cash per level and prestige-only cosmetics. You keep all your unlocks.']) +
        sec('ALSO', '#9ca3af', ['STATS tab: tables for every class and every map. Zombies find their way round walls and through doorways better. Clicks between two frames still fire on slow computers.']);
}
function updateMenuPreview() {
    $('menu-preview-name').textContent = MAPS[currentMap].name;
    $('menu-preview-sub').textContent = theme.name + (settings.map === 'random' || settings.light === 'random' ? '  \u00b7  random each run' : '');
    $('menu-preview-name').style.color = hexC(theme.horizon === 0x1c2048 ? 0x93a4ff : theme.horizon);
}
function applyCrosshair() {
    [...ui.crosshair.classList].filter(c => c.startsWith('xh-')).forEach(c => ui.crosshair.classList.remove(c));
    ui.crosshair.classList.add('xh-' + settings.xhStyle);
    ui.crosshair.style.setProperty('--xh', settings.xhColor);
}
$('menu-tabs').addEventListener('click', (e) => { const b = e.target.closest('.mtab'); if (!b) return; menuTab = b.dataset.tab; initAudio(); sfx('click'); renderMenu(); });
// 4.0: the PRESTIGE button on the rank bar opens the Ranks tab; the version line opens What's New
$('menu-rank').addEventListener('click', (e) => { if (!e.target.closest('[data-act="goprestige"]')) return; menuTab = 'ranks'; initAudio(); sfx('click'); setMenuView('setup'); $('menu-panel').scrollTop = 0; });
$('menu-version').addEventListener('click', () => { menuTab = 'news'; initAudio(); sfx('click'); setMenuView('setup'); $('menu-panel').scrollTop = 0; });
// the challenges tab counts down (and rolls over at midnight) while it's open
setInterval(() => { if (currentGameState === 'main' && menuTab === 'challenges' && !document.hidden) renderMenu(); }, 30000);
$('menu-panel').addEventListener('click', (e) => {
    const b = e.target.closest('[data-set],[data-act]'); if (!b) return;
    initAudio(); sfx('click');
    if (b.dataset.act === 'prestige') {          // 4.0: two clicks (the first one arms it)
        if (!canPrestige()) return;
        if (prestigeArm > performance.now()) {
            prestigeArm = 0;
            if (doPrestige()) { prestigeJust = prestigeLvl(); sfx('wave'); rankHudKey = ''; }
        } else { prestigeArm = performance.now() + 5000; setTimeout(() => { if (menuTab === 'ranks' && currentGameState === 'main') renderMenu(); }, 5100); }
        renderMenu(); return;
    }
    if (b.dataset.act === 'resetstats') {
        if (confirm('Reset all lifetime stats and best waves?')) { for (const k of ['runs', 'kills', 'headshots', 'bosses', 'shots', 'hits', 'damage', 'time', 'waves']) life[k] = 0; life.best = {}; life.weaponKills = {}; life.cls = {}; life.maps = {}; saveJSON('blocky21_life', life); }
        renderMenu(); return;
    }
    const key = b.dataset.set, val = b.dataset.val;
    if (b.dataset.rank) { const t = b.dataset.rank; sfx('deny'); const d = document.createElement('div'); d.className = 'mdesc'; d.style.color = '#fcd34d'; d.textContent = t === 'C' ? 'Win this skin as a CAMPAIGN reward.' : t[0] === 'P' ? `Reach PRESTIGE ${t.slice(1)} to unlock this (Ranks tab).` : `Reach RANK ${t} to unlock this.`; b.parentElement.after(d); setTimeout(() => d.remove(), 1600); return; }
    settings[key] = val; saveSettings();
    if (key === 'cls' && currentGameState === 'main') playerStats.cls = validClass(val);
    if (key === 'map') buildWorld(val === 'random' ? pickRandom(MAP_IDS()) : val);
    if (key === 'light') applyTheme(val === 'random' ? pickRandom(Object.keys(THEMES)) : val);
    if (key === 'sleeve' || key === 'glove') applyArmColors();
    if (key === 'camo') showWeaponModel(vmModel ? vmModel.id : 'ar');
    if (key === 'xhStyle' || key === 'xhColor') applyCrosshair();
    renderMenu();
});


// Warm up shaders up front so the first wave / first weapon swap doesn't stutter
function prewarm() {
    const tmp = [createEnemy(enemyTypes.grunt), createEnemy(enemyTypes.shielder), createEnemy(enemyTypes.medic), createEnemy(enemyTypes.boss)];
    tmp.forEach((e, i) => { e.position.set(i * 3, -40, 0); scene.add(e); e.userData.markT = 1e9; });
    markUntil = 1e9;            // 4.0: compile the Recon x-ray shader too
    updateZombieInstances();
    markUntil = -1;
    const orb = new THREE.Mesh(_orbGeo, _spitMat); orb.position.set(0, -40, 3); scene.add(orb);
    WEAPON_ORDER.forEach(id => { const m = getModel(id); m.root.visible = true; if (m.fx.trail) m.fx.trail.visible = true; });
    const gl = new THREE.Mesh(_glGeo, _glMat); gl.position.set(0, -40, 6); scene.add(gl);      // 4.0 launcher grenade
    try { renderer.compile(scene, camera); renderer.compile(viewScene, weaponCam); } catch (e) {}
    WEAPON_ORDER.forEach(id => { models[id].root.visible = false; if (models[id].fx.trail) models[id].fx.trail.visible = false; });
    scene.remove(gl);
    // keep the temp materials alive so their compiled shader programs stay cached
    tmp.forEach(e => { scene.remove(e); zombieSet.delete(e); }); scene.remove(orb);
    updateXray();
}


// Boot
init3D();
prewarm();
showWeaponModel('pistol');
applyCrosshair();
updateHUD();
renderMenu(); updateContinueBtn();
animate();


window.__blocky = {
    campaign: {
        start: (id) => { CAMP.dbg = true; const r = campStart(id); CAMP.dbg = false; return r; },
        win: () => { if (CAMP.on) campWin(); }, fail: (why) => { if (CAMP.on) campFail(why || 'debug'); },
        skip: () => { if (CAMP.on && CAMP.st && !CAMP.over) campNextStage(); }, leave: () => campLeave(true),
        get focus() { return CAMP.tg ? { x: CAMP.tg.x, y: CAMP.tg.y, z: CAMP.tg.z, label: CAMP.tg.label } : null; }, get missions() { return CAMP_ALL.map(m => m.id); }, get save() { return campSave; },
        get state() { return { on: CAMP.on, over: CAMP.over, mission: CAMP.m && CAMP.m.id, stage: CAMP.st && CAMP.st.def.t, si: CAMP.si, deaths: CAMP.deaths, lives: campLives(), t: CAMP.t, dmg: CAMP.dmg, kills: CAMP.kills, heads: CAMP.heads, stat: CAMP.stat, decoys: CAMP.decoys.length, objs: CAMP.objs.length, marks: CAMP.nm, stars: CAMP.on && CAMP.m ? campStars(true) : null, gs: currentGameState }; }
    },
    get state() { return { currentGameState, playerStats, currentHp, currentArmor, enemies, solids, projectiles, secondaryCooldown, waveActive, intermission, camera, velocity, onGround, vm, Q, dynScale, theme: themeId, runStats, supplies, fovNow, vmModel, weaponCam, viewScene, renderer, scene, THREE }; },
    debug(on = true) { debugNoLock = on; },
    prof: PROF, get lightU() { return LIGHT_U; }, get scene() { return scene; }, get renderer() { return renderer; },
    get info() { return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, enemies: enemies.length }; },
    hurt: (n) => takeDamage(n, null, 'test'),
    clearWave: () => { enemies.forEach(e => { scene.remove(e); disposeEnemy(e); }); enemies.length = 0; checkWaveStatus(); },
    save: () => autoSaveRun(false), saveStatus: () => saveStatus(), get savedWave() { return savedWave; }, runSave: () => loadRunSave(),
    god(on = true) { debugGod = on; }, freeze(on = true) { debugFreeze = on; },
    start() { debugNoLock = true; changeGameState('playing'); },
    giveAll(money = 50000) { playerStats.weapons = WEAPON_ORDER.slice(); playerStats.money = money; updateHUD(); },
    equip: (id) => { if (!playerStats.weapons.includes(id)) playerStats.weapons.push(id); switchWeapon(id); },
    aim: (on) => { aimHeld = on; },
    fire: (on) => { isMouseDown = on; triggerFresh = on; },
    look: (yaw, pitch) => { _euler.set(pitch, yaw, 0); camera.quaternion.setFromEuler(_euler); },
    theme: (id) => applyTheme(id),
    map: (id) => buildWorld(id),
    menu: () => changeGameState('main'),
    charges: (n) => { strikeCharges = n; },
    turret: (L, x, z) => { playerStats.upgrades.turret = L; deployTurret(x, groundAt(x, z, 0.3, 1), z); },
    get twist() { return twist; }, heal: () => { currentHp = maxHp; }, get lastHurtBy() { return lastHurtBy; }, get bossFx() { return bossFx; }, waveBosses: (n) => waveBosses(n), netBossFx: (m) => netBossFx(m), get runInfo() { return run; }, fresh: () => { resetRun(); needsNewWorld = true; changeGameState("playing"); },
    get nav() { return nav; }, skyOK: (x, z, f) => skyOK(x, z, f), ground: (x, z, m, f) => groundAt(x, z, m, f), ceil: (x, z, m, t) => ceilingAt(x, z, m, t), navSteer: (x, z, y) => navSteer(x, z, y, camera.position.x, camera.position.z) ? { ...navGoal } : null, navField: (d) => updateNavField(d || 1),
    get turrets() { return turrets; }, get arena() { return ARENA; }, get spawnPt() { return spawnPt; },
    tpy: (x, y, z) => { camera.position.set(x, y + EYE_STAND, z); feetY = y; },
    rebuildGun: () => showWeaponModel(playerStats.currentWeapon),
    // gun-model debug: draw calls / triangles per model, and a sight-line ray test
    vmRoot: () => vmModel.root,
    vmRay: (id) => { const m = getModel(id); m.root.updateMatrixWorld(true); const [sy, sz] = m.def.sight, rc = new THREE.Raycaster(), res = [];
        const objs = []; m.g.traverse(o => { if (o.isMesh && o.visible && !o.material.transparent) objs.push(o); });
        for (const dx of [0, 0.004, -0.004]) { const o = m.g.localToWorld(new V3(dx, sy, sz)), d = new V3(0, 0, -1).transformDirection(m.g.matrixWorld); rc.set(o, d);
            const h = rc.intersectObjects(objs, false)[0]; res.push(h ? +(h.distance / m.g.scale.x).toFixed(3) + ':' + (h.object.material.userData.cls || h.object.material.type.slice(4, 9)) + '@' + h.point.z.toFixed(3) : 'clear'); }
        return res.join(' '); },
    vmInfo: (id) => { const m = getModel(id); let calls = 0, tris = 0; m.root.traverse(o => { if (o.isMesh && o.visible && o.parent !== m.flash) { calls++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } }); return { calls, tris: Math.round(tris)}; },
    gainXP: (n) => gainXP(n),
    boom: (x, z, d = 200, r = 7) => explode(new V3(x, 1, z), d, r),
    fx: () => ({ smoke: smokeParts.length, scorch: scorchCount, decals: decalCount, blocks: worldBlocks.length, solids: solids.length, spark: glowParts.length, corpses: corpses.length }),
    impact: (x, y, z, nx, ny, nz) => { const p = new V3(x, y, z), n = new V3(nx, ny, nz); const k = surfaceAt(p, n); impactFx(p, n, k); return k; },
    hitEnemy: (i, head) => { const e = enemies[i]; damageEnemy(e, 1, !!head, new V3(e.position.x, e.position.y + 2, e.position.z)); return { hitT: e.userData.hitT, body: e.userData.body.rotation.x }; },
    lightning: () => { lightningFlash = 0.28; },
    q: (k, v) => { Q[k] = v; setupPointLights(); applyShadowSettings(); setupPost(); recompileAll(); },
    post: () => ({ passes: composer ? composer.passes.length : 0 }),
    fps: (f, secs = 1) => { for (let i = 0; i < f * secs; i++) trackFps(1 / f); return { scale: dynScale, shadows: Q.shadows, lite: Q.lite }; },
    setting: (k, v) => { settings[k] = v; },
    spawn: (id, x, z) => spawnEnemy(enemyTypes[id], x, z, groundAt(x, z, 0, 50), waveSpeed(playerStats.level), waveReward(playerStats.level)),
    killAll: () => { [...enemies].forEach(e => killEnemy(e)); },
    clear: () => { enemies.forEach(e => { scene.remove(e); disposeEnemy(e); }); enemies = []; },
    tp: (x, z) => { camera.position.set(x, EYE_STAND, z); feetY = 0; },
    wave: (n) => { playerStats.level = n; spawnWave(); },
    supply: () => spawnSupply(),
    inspect: () => { vm.inspect = 2.4; },
    reload: () => triggerReload(),
    slide: () => startSlide(),
    // 4.0 weapons
    lvl: (id, L) => { playerStats.upgrades[id] = L; clearWCache(); ammoState[id] = W(id).magSize; showWeaponModel(playerStats.currentWeapon); },
    att: (id, list) => { playerStats.atts[id] = {}; (list || []).forEach(a => { playerStats.atts[id][a] = 1; }); clearWCache(); ammoState[id] = W(id).magSize; showWeaponModel(playerStats.currentWeapon); },
    W: (id) => W(id || playerStats.currentWeapon),
    lunge: () => lunge(W(playerStats.currentWeapon)),
    teslaTarget: () => { camera.getWorldDirection(_fwd); const o = camera.position, e = teslaFirst(W('tesla'), o, 30, null); if (!e) return null; zapAt(e, _tzB); return { id: e.userData.netId, los: losClear(o.x, o.y, o.z, _tzB.x, _tzB.y, _tzB.z), d: o.distanceTo(_tzB) }; },
    holdSlash: (dir, t) => { if (dir === null) { debugSlashHold = false; vm.slashT = 0; return; } debugSlashHold = true; vm.slashDir = dir; vm.slashDur = 0.3; vm.slashT = Math.max(0.0001, 0.3 * (1 - t)); },
    get wpn() { return { railC, lungeT, lungeCd, slashT: vm.slashT, slashDir: vm.slashDir, gl: projectiles.filter(p => p.kind === 'gl').length, ammo: { ...ammoState }, cur: playerStats.currentWeapon, reloading: isReloading,
                         tracers: tracerList.length, def: vmModel && vmModel.def, pos: [camera.position.x, camera.position.y, camera.position.z], kills: runStats.kills, wk: { ...runStats.weaponKills }, money: playerStats.money }; },
    keyDown: (code) => onKeyDown({ code, preventDefault() {}, repeat: false }),
    rayT: (yaw, maxT = 60) => { const d = new V3(-Math.sin(yaw), 0, -Math.cos(yaw)); const o = new V3(camera.position.x, feetY + 1.2, camera.position.z); const h = raySolids(o, d, maxT); return h ? h.t : maxT; },
    mouse: (btn, down) => (down ? onMouseDown : onMouseUp)({ button: btn }),
    // 4.0 classes
    cls: (id) => { playerStats.cls = validClass(id); applyMinimapSize(); },
    clsUp: (id, L) => { playerStats.clsUp[id] = L; },
    ability: () => useAbility(),
    resetCd: () => { abilityCd = 0; },
    pause: () => changeGameState('paused'),
    hit: (i, n) => { const e = enemies[i]; if (!e) return null; damageEnemy(e, n, false, null); return e.userData.hp; },
    get abil() { const m = miniTurret(); return { cd: abilityCd, t: abilityT, dur: abilityDur, cls: myClass(), radarT, markUntil, gameTime, healFields: healFields.length, healing: healingNow,
                                                 crates: crates.map(c => ({ n: c.n, x: c.x, y: c.y, z: c.z })), mini: m ? { hp: m.hp, ammo: m.ammo, t: m.t, x: m.g.position.x, z: m.g.position.z } : null,
                                                 marked: enemies.filter(e => e.userData.markT > gameTime).length, ammo: { ...ammoState }, armor: currentArmor, hp: currentHp, maxHp, feetY, dmgMul: clsDmg(),
                                                 fieldR: healFields.length ? healFields[healFields.length - 1].r : 0, fieldT: healFields.length ? healFields[healFields.length - 1].T : 0, fieldH: healFields.length ? healFields[healFields.length - 1].h : 0,
                                                 sentry: m ? { hp: m.st.hp, rockets: m.st.rockets, life: m.st.life } : null, cdMax: abilityCooldown(), turretCost: upgradeCost('turret'), grenadeCost: secCost(secondariesDb.grenade) }; },
    // 4.0 challenges + prestige
    get ch() { return chState; }, chAdd: (t, n, a) => chAdd(t, n, a), chLoad: () => chLoad(), chKill: (id, head, src) => chKill(enemyTypes[id], head, src), chWave: (n) => chWave(n),
    get life() { return life; }, setXP: (xp) => { life.xp = xp; rankHudKey = ''; updateRankHUD(); }, prestige: () => doPrestige(), get escalators() { return escalators; },
    // 4.0: step only the zombies + pathfinding (no rendering) - fast map/navigation tests
    sim(seconds, fps = 30) { const d = 1 / fps; for (let i = 0; i < seconds * fps; i++) { gameTime += d; updateNavField(d); updateEnemies(d); updateCorpses(d); } },
    // drive frames by hand (for automated testing when the tab is hidden)
    run(seconds, fps = 60) { let t = prevTime ?? performance.now(); for (let i = 0; i < seconds * fps; i++) { t += 1000 / fps; frame(t); } }
};
