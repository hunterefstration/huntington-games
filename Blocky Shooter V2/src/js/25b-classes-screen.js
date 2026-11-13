// ---------- 5.4 CLASSES SCREEN: pick a class, see its level, spend skill points, pick specialisations, respec, mastery ----------
// Opened from the home menu (CLASSES), the Play tab's class card and the multiplayer lobby. All class upgrading happens here,
// never during a run. Works over the main menu and over the multiplayer lobby (it sits above both).
const CLSV = { k: 'assault', armRespec: 0 };
function openClasses(k) {
    if (currentGameState === 'playing' || currentGameState === 'paused') return;       // out of game only
    CLSV.k = CLASSES[k] ? k : validClass(settings.cls); CLSV.armRespec = 0;
    $('cls-overlay').classList.remove('hidden');
    renderClasses();
}
function closeClasses() {
    $('cls-overlay').classList.add('hidden');
    if (currentGameState === 'main') { if (menuView === 'setup') renderMenu(); else homeClassesLabel(); }
    if (NET.on && !ui.mp.classList.contains('hidden')) renderMP();
}
function homeClassesLabel() {
    const el = $('btn-classes-sub'); if (!el) return;
    const pts = CLASS_ORDER.reduce((a, k) => a + Math.max(0, clsPts(k)), 0);
    el.textContent = pts > 0 ? `${pts} POINT${pts > 1 ? 'S' : ''}` : `${CLASSES[validClass(settings.cls)].name} ${clsLvl(validClass(settings.cls))}`;
}
const clsXpLine = (k) => { const P = clsP(k), lv = clsLvl(k); return lv >= CLS_MAX_LV ? { pct: 100, txt: 'MAX LEVEL' } : { pct: (P.xp - CLS_XP_AT[lv]) / clsNeed(lv) * 100, txt: `${Math.floor(P.xp - CLS_XP_AT[lv]).toLocaleString()} / ${clsNeed(lv).toLocaleString()} XP to level ${lv + 1}` }; };
function renderClasses() {
    const k = CLSV.k, C = CLASSES[k], P = clsP(k), lv = clsLvl(k), pts = clsPts(k), cur = validClass(settings.cls), tot = clsTotal(), mt = masteryTier(tot);
    const nextM = MASTERY[mt], xl = clsXpLine(k);
    let h = `<div class="cls-head"><div class="htitle text-3xl text-white">CLASSES</div>
        <div class="cls-mast" title="Mastery: every class level counts">${masteryEmblem(mt, 26)}<div><div class="font-black" style="color:${mt ? MASTERY[mt - 1].c : '#9ca3af'}">${mt ? MASTERY[mt - 1].n : 'NO MASTERY'} <span class="text-gray-400 text-xs">MASTERY</span></div>
        <div class="text-[11px] text-gray-400 font-bold">${tot} class levels${nextM ? ` · ${nextM.n} at ${nextM.at}` : ' · maxed'}</div></div></div>
        <button class="hbtn sm" data-cact="close">CLOSE &times;</button></div>`;
    // the eight classes
    h += `<div class="cls-list">${CLASS_ORDER.map(id => { const c = CLASSES[id], l = clsLvl(id), p = clsPts(id), x = clsXpLine(id);
        return `<button class="cls-card${id === k ? ' on' : ''}" data-cact="sel" data-k="${id}" style="--cc:${c.css}"><span class="cls-ico" style="background:${c.css}">${c.icon}</span>
            <span class="cls-cn">${c.name}${id === cur ? ' <i title="Your class">✔</i>' : ''}</span><span class="cls-lv">LV ${l}</span>${p > 0 ? `<span class="cls-pts">${p}</span>` : ''}
            <span class="cls-bar"><i style="width:${x.pct.toFixed(1)}%;background:${c.css}"></i></span></button>`; }).join('')}</div>`;
    // the picked class
    h += `<div class="cls-main" style="--cc:${C.css}"><div class="cls-top"><div class="cls-big" style="background:${C.css}">${C.icon}</div><div class="flex-1" style="min-width:0">
        <div class="flex items-baseline gap-3 flex-wrap"><span class="font-black text-2xl" style="color:${C.css}">${C.name}</span><span class="text-xs font-black tracking-widest text-gray-400">${C.role.toUpperCase()}</span><span class="font-black text-white">LEVEL ${lv} / ${CLS_MAX_LV}</span></div>
        <div class="cls-bar big"><i style="width:${xl.pct.toFixed(1)}%;background:${C.css}"></i></div><div class="text-[11px] text-gray-400 font-bold">${xl.txt} · ${(P.runs | 0)} runs · ${(P.kills | 0)} kills</div>
        <div class="text-xs text-gray-200 mt-1"><span class="key">X</span> <b style="color:${C.css}">${C.ability}</b> - ${C.abilityDesc} <span class="text-gray-400">${C.cd}s cooldown.</span></div>
        <div class="text-xs text-gray-300"><b class="text-white">PASSIVE</b> - ${C.passive}</div></div>
        <div class="cls-acts">${k === cur ? '<div class="cls-using">YOUR CLASS</div>' : `<button class="hbtn pri" data-cact="use">PLAY AS ${C.name}</button>`}
        <div class="cls-ptsbig">${pts} <small>SKILL POINT${pts === 1 ? '' : 'S'}</small></div>
        <button class="chip" data-cact="respec">${CLSV.armRespec > performance.now() ? 'CLICK AGAIN TO RESET' : 'RESPEC (FREE)'}</button></div></div>`;
    // specialisations
    h += `<div class="mlabel">SPECIALISATIONS <span class="text-gray-500">- PICK ONE IN EACH ROW, CHANGE ANY TIME (FREE)</span></div>`;
    h += C.specs.map((T, t) => { const open = lv >= CLS_SPEC_LV[t];
        return `<div class="cls-specrow"><div class="cls-speclv${open ? '' : ' lock'}">LV ${CLS_SPEC_LV[t]}</div>${T.map(sp => { const on = P.spec[t] === sp.id;
            return `<button class="cls-spec${on ? ' on' : ''}${open ? '' : ' lock'}" ${open ? `data-cact="spec" data-t="${t}" data-id="${sp.id}"` : ''}><b>${on ? '✔ ' : ''}${sp.name}</b><span>${sp.desc}</span></button>`; }).join('<span class="cls-or">OR</span>')}</div>`; }).join('');
    // the tree: 3 branches x 5 rows
    h += `<div class="mlabel">SKILL TREE <span class="text-gray-500">- 1 POINT PER LEVEL. EACH NODE NEEDS THE ONE ABOVE IT AND THE LEVEL SHOWN</span></div><div class="cls-tree">`;
    for (let b = 0; b < 3; b++) {
        h += `<div class="cls-branch"><div class="cls-bname">${CLS_BRANCHES[b]}</div>`;
        for (const n of C.tree.filter(x => x.b === b).sort((x, y) => x.r - y.r)) {
            const r = P.tree[n.id] | 0, can = clsCanBuy(k, n.id), gate = lv < CLS_ROW_LV[n.r];
            h += `<button class="cls-node${r ? ' own' : ''}${r >= n.max ? ' max' : ''}${can ? ' can' : ''}${!r && !can ? ' lock' : ''}" ${can ? `data-cact="buy" data-id="${n.id}"` : ''} title="${n.desc}">
                <div class="flex justify-between gap-2"><b>${n.name}</b><span class="cls-rk">${r}/${n.max}</span></div><div class="cls-nd">${n.desc}</div>${gate ? `<div class="cls-gate">🔒 LEVEL ${CLS_ROW_LV[n.r]}</div>` : ''}</button>`;
        }
        h += `</div>`;
    }
    h += `</div><div class="cls-rule"><b>FAIR PLAY:</b> in PvP modes and tournaments every class plays at the <b>level-1 baseline</b>: its ability and passive work, the skill tree and specialisations give nothing. Your class and level still show on the scoreboard. Everything a tree can add is capped (about +25% at most in co-op and solo).</div>`;
    h += `<div class="mlabel">MASTERY <span class="text-gray-500">- EVERY LEVEL OF EVERY CLASS COUNTS. TITLES AND EMBLEMS, NO POWER</span></div><div class="cls-mlist">${MASTERY.map((m, i) => `<div class="cls-mt${mt > i ? ' got' : ''}">${masteryEmblem(i + 1, 22)}<div><b style="color:${m.c}">${m.n}</b><span>${m.at} levels${m.qol ? ' · ' + m.qol : ''}</span></div></div>`).join('')}</div>`;
    h += `</div>`;
    $('cls-box').innerHTML = h;
}
$('cls-box').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cact]'); if (!b) return;
    initAudio();
    const a = b.dataset.cact, k = CLSV.k;
    if (a === 'close') { sfx('click'); closeClasses(); return; }
    if (a === 'sel') { CLSV.k = b.dataset.k; CLSV.armRespec = 0; sfx('click'); }
    else if (a === 'use') { settings.cls = k; saveSettings(); if (!NET.inGame && currentGameState === 'main') playerStats.cls = k; CS.s = null; try { if (NET.on) updateMyLook(); } catch (x) {} sfx('upgrade'); }
    else if (a === 'buy') { if (clsBuy(k, b.dataset.id)) sfx('upgrade'); else sfx('deny'); }
    else if (a === 'spec') { if (clsPickSpec(k, +b.dataset.t, b.dataset.id)) sfx('upgrade'); else sfx('deny'); }
    else if (a === 'respec') {
        if (CLSV.armRespec > performance.now()) { CLSV.armRespec = 0; clsRespec(k); sfx('wave'); }
        else { CLSV.armRespec = performance.now() + 4000; sfx('click'); setTimeout(() => { if (!$('cls-overlay').classList.contains('hidden')) renderClasses(); }, 4100); }
    }
    const sc = $('cls-box').scrollTop; renderClasses(); $('cls-box').scrollTop = sc;
});
$('cls-overlay').addEventListener('click', (e) => { if (e.target.id === 'cls-overlay') closeClasses(); });
document.addEventListener('keydown', (e) => { if (e.code === 'Escape' && !$('cls-overlay').classList.contains('hidden')) { e.stopPropagation(); closeClasses(); } }, true);
$('btn-classes').addEventListener('click', () => { initAudio(); sfx('click'); openClasses(validClass(settings.cls)); });
homeClassesLabel();

// ---------- 5.4 what's new (the menu's WHAT'S NEW tab, and a one-time note on the home menu) ----------
function whatsNew54(sec) {
    return sec('CLASSES LEVEL UP FOR GOOD', '#fb923c', ['Every class now has its <b>own level, 1 to 30</b>, earned by playing it: kills, waves, objectives, challenges and match results, in every mode including multiplayer and PvP. It is saved with the rest of your save and syncs.',
            'Each level gives a <b>skill point</b>. Spend them in the new <b>CLASSES</b> screen (home menu, the Play tab or the multiplayer lobby) on a <b>15-node skill tree</b> in 3 branches (Ability, Class, Utility), and pick a <b>specialisation</b> at levels 10 and 20 that changes how the ability works. Respec is free.',
            'Your old XP counts: existing players start every class above level 1 (more for the four original classes).']) +
        sec('IN-RUN CLASS UPGRADES ARE GONE', '#fca5a5', ['The Armory no longer sells class upgrades for cash. All class upgrading happens out of game; in a run you just use your class. Cash still buys guns, upgrades, gadgets and armor.',
            'A run saved with class upgrades bought gets that cash back when you continue it.']) +
        sec('FOUR NEW CLASSES', '#7dd3fc', ['<b>HEAVY</b> - Bulwark: a ground slam, then half damage for 6s. <b>DEMOLITIONS</b> - Cluster Charge: a thrown blast that scatters bomblets.',
            '<b>MARKSMAN</b> - Mark for Death: marked zombies take more damage and are finished off at low health. <b>SCOUT</b> - Dash (and a double jump).']) +
        sec('FAIR PLAY + MASTERY', '#86efac', ['PvP and tournaments use the level-1 baseline for every class (ability and passive on, tree and specialisations off). Your class and its level show on the scoreboard and lobby.',
            'A <b>mastery</b> track counts every level of every class: 8 titles with emblems, and at ELITE you can switch class mid-wave.']);
}
function showNews54() {
    const el = $('news54'); if (!el) return;
    if (settings.seen54) { el.classList.add('hidden'); return; }
    el.innerHTML = `<div class="n54"><div class="font-black text-amber-300 tracking-widest text-xs">NEW IN 5.4 - CLASS REWORK</div>
        <div class="text-sm text-gray-100">Classes now level up for good (1-30) as you play them, with a skill tree and specialisations you upgrade in <b>CLASSES</b>. The cash class upgrades in the Armory are gone. Four new classes: Heavy, Demolitions, Marksman and Scout.</div>
        <div class="flex gap-2 mt-1"><button class="chip" data-n54="open">OPEN CLASSES</button><button class="chip" data-n54="news">WHAT'S NEW</button><button class="chip" data-n54="ok">GOT IT</button></div></div>`;
    el.classList.remove('hidden');
}
$('news54').addEventListener('click', (e) => {
    const b = e.target.closest('[data-n54]'); if (!b) return;
    initAudio(); sfx('click');
    settings.seen54 = 1; saveSettings(); $('news54').classList.add('hidden');
    if (b.dataset.n54 === 'open') openClasses(validClass(settings.cls));
    else if (b.dataset.n54 === 'news') { menuTab = 'news'; setMenuView('setup'); $('menu-panel').scrollTop = 0; }
});
showNews54();
