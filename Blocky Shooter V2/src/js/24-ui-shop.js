// ==========================================
// 7. UI & SHOP
// ==========================================


function updateHUD() {
    setText(ui.txtLevel, `WAVE ${Math.max(1, waveActive || intermission <= 0 ? playerStats.level : playerStats.level - 1)}`);
    setText(ui.txtEnemies, `Enemies: ${enemies.length}`);
    setText(ui.txtMoney, `$${playerStats.money}`);


    const wp = W(playerStats.currentWeapon);
    setText(ui.txtWeapon, wp.name + (wp.level ? ' ' + '\u2605'.repeat(wp.level) : ''));
    ui.txtWeapon.style.color = hex(wp.color);
    updateAmmoHUD();


    refreshHealthHUD(true);
    ui.vignette.style.opacity = currentHp < 35 && currentGameState === 'playing' ? String(1 - currentHp / 35) : '0';


    const tier = playerStats.armorTier ? armorDb[playerStats.armorTier] : null;
    ui.armorWrap.classList.toggle('hidden', !tier);
    const slots = ownedWeapons().map((id, i) => `<span class="slot${id === playerStats.currentWeapon ? ' on' : ''}">${keyLabel(i) ? `<b>${keyLabel(i)}</b>` : ''}${weaponsDb[id].name.toUpperCase()}</span>`).join('');
    if (ui.slots._h !== slots) { ui.slots._h = slots; ui.slots.innerHTML = slots; }
    updateSecondaryHUD();
}
// Boss health bar across the top of the screen while a boss is alive
function updateBossBar() {
    let hp = 0, max = 0; const names = [], tags = [];
    let first = null;
    for (const e of enemies) {
        const u = e.userData; if (!u.config.boss || u.dead) continue;
        if (!first) first = u.config;
        hp += Math.max(0, u.hp); max += u.maxHp; names.push(u.config.name.toUpperCase());
        if (u.shielded) tags.push('SHIELDED'); else if (u.hp < u.maxHp * 0.5) tags.push('ENRAGED');
    }
    ui.boss.classList.toggle('hidden', !first);
    if (!first) return;
    setText(ui.bossName, `${names.join(' + ')}${tags.length ? '  \u00b7  ' + [...new Set(tags)].join(' / ') : ''}  \u00b7  ${Math.ceil(hp).toLocaleString()} / ${Math.round(max).toLocaleString()}`);
    setWidth(ui.bossBar, Math.max(0, hp / max * 100));
    if (ui.bossBar._c !== first.bar) { ui.bossBar._c = first.bar; ui.bossBar.style.background = `linear-gradient(90deg, ${first.bar}, #ffffff55)`; ui.bossName.style.color = first.bar; }
}
function updateAmmoHUD() {
    const wp = W(playerStats.currentWeapon);
    if (wp.melee) {      // 4.0 KATANA: no ammo - show the lunge instead (only rebuilt when the tenths change)
        const tenths = Math.ceil(lungeCd * 10);
        if (ui.txtAmmoCur._lc !== tenths) { ui.txtAmmoCur._lc = tenths; setText(ui.txtAmmoCur, tenths > 0 ? (tenths / 10).toFixed(1) + 's' : 'LUNGE'); }
        setText(ui.txtAmmoMax, tenths > 0 ? 'LUNGE' : 'RMB');
        ui.txtAmmoCur.classList.toggle('text-red-500', false); ui.txtAmmoCur.classList.toggle('text-white', true);
        return;
    }
    ui.txtAmmoCur._lc = null;
    setText(ui.txtAmmoCur, powerOn('ammo') ? '\u221e' : String(ammoState[wp.id]));
    setText(ui.txtAmmoMax, `/ ${wp.magSize}`);
    const low = !powerOn('ammo') && ammoState[wp.id] <= wp.magSize * 0.25;
    ui.txtAmmoCur.classList.toggle('text-red-500', low);
    ui.txtAmmoCur.classList.toggle('text-white', !low);
}


function updateSecondaryHUD() {
    const id = playerStats.currentSecondary;
    if (!id) { setText(ui.secName, 'NONE'); setStyle(ui.secName, 'color', '#6b7280'); setText(ui.secStatus, 'Buy in Armory'); setWidth(ui.secCd, 0); return; }
    const sec = secondariesDb[id];
    setText(ui.secName, sec.name); setStyle(ui.secName, 'color', hex(sec.color));
    if (id === 'c4' && activeC4) { setText(ui.secStatus, 'ARMED - Q to detonate'); setWidth(ui.secCd, 100); setStyle(ui.secCd, 'background', '#ef4444'); }
    else if (id === 'turret' && mainTurret()) { const t = mainTurret(); setText(ui.secStatus, `ACTIVE - ${t.ammo} ammo, ${Math.max(0, Math.round(t.hp / t.st.hp * 100))}% hp`); setWidth(ui.secCd, Math.max(0, t.hp / t.st.hp * 100)); setStyle(ui.secCd, 'background', '#38bdf8'); }
    else if (id === 'turret' && turretCd > 0) { setText(ui.secStatus, `Cooldown ${turretCd.toFixed(1)}s`); setWidth(ui.secCd, (1 - turretCd / turretStats(playerStats.upgrades.turret || 0).cooldown) * 100); setStyle(ui.secCd, 'background', '#fbbf24'); }
    else if (secondaryCooldown > 0) { setText(ui.secStatus, `Cooldown ${secondaryCooldown.toFixed(1)}s`); setWidth(ui.secCd, (1 - secondaryCooldown / (id === 'turret' ? turretStats(playerStats.upgrades.turret || 0).cooldown : sec.cooldown)) * 100); setStyle(ui.secCd, 'background', '#fbbf24'); }
    else { setText(ui.secStatus, 'READY'); setWidth(ui.secCd, 100); setStyle(ui.secCd, 'background', '#4ade80'); }
}


function shopCard({ title, color, tag, rows, btnText, btnKind, onclick, highlight, desc, extra, tallDesc, addon }) {
    const kinds = {
        buy: 'bg-blue-600 hover:bg-blue-500 text-white', poor: 'bg-red-900/40 text-red-400 cursor-not-allowed',
        equip: 'bg-gray-600 hover:bg-gray-500 text-white', on: 'bg-green-600/30 text-green-300 border border-green-500/50 cursor-default',
        off: 'bg-gray-700 text-gray-400 cursor-not-allowed', red: 'bg-red-600 hover:bg-red-500 text-white', gold: 'bg-amber-500 hover:bg-amber-400 text-black'
    };
    const disabled = (btnKind === 'poor' || btnKind === 'on' || btnKind === 'off') ? 'disabled' : '';
    const extraBtn = extra ? `<button ${(extra.kind === 'poor' || extra.kind === 'off') ? 'disabled' : ''} onclick="${extra.onclick}" class="w-full py-1.5 mt-2 font-bold rounded text-xs transition-colors ${kinds[extra.kind]}">${extra.text}</button>` : '';
    return `<div class="bg-gray-800 border rounded-lg p-4 flex flex-col justify-between transition-transform transform hover:scale-105 ${highlight ? 'border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'border-gray-600'}">
        <div>
            <h3 class="${title.replace(/[\u2605 ]+$/, '').length > 14 ? 'text-lg' : 'text-xl'} font-black mb-1 truncate" style="color:${color}">${title}</h3>
            <div class="text-[10px] text-gray-400 font-mono uppercase mb-2 bg-black/30 inline-block px-2 py-0.5 rounded">${tag}</div>
            ${desc ? `<div class="text-xs text-gray-400 mb-2 leading-4" style="min-height:${tallDesc ? 48 : 32}px">${desc}</div>` : ''}
            <div class="space-y-1 text-xs text-gray-300 bg-black/20 p-2 rounded">
                ${rows.map(([k, v]) => `<div class="flex justify-between"><span>${k}:</span> <span class="font-bold text-white">${v}</span></div>`).join('')}
            </div>
        </div>
        <div>
            <button ${disabled} onclick="${onclick || ''}" class="w-full py-2 mt-3 font-bold rounded text-sm transition-colors ${kinds[btnKind]}">${btnText}</button>
            ${extraBtn}${addon || ''}
        </div>
    </div>`;
}
function upgradeCost(id) {
    const lvl = playerStats.upgrades[id] || 0;
    if (id === 'turret') return Math.round(700 * (lvl + 1) * gadgetMul() / 10) * 10;      // ENGINEER: -25%
    return Math.round(Math.max(250, weaponsDb[id].cost * 0.25) * (lvl + 1) / 10) * 10;
}


function renderShopItems() {
    const container = document.getElementById('shop-items');
    const money = playerStats.money;
    ui.shopMoney.innerText = `$${money}`;
    const section = (title, sub, cards, cols = 'lg:grid-cols-5') => `<div><div class="flex items-baseline gap-3 mb-3"><h3 class="text-2xl font-black text-white tracking-wide">${title}</h3><span class="text-sm text-gray-400">${sub}</span></div><div class="grid grid-cols-2 md:grid-cols-3 ${cols} gap-4">${cards.join('')}</div></div>`;


    const ownedList = ownedWeapons(), myRank = unlockLevel();
    const weaponCards = WEAPON_ORDER.map((id) => {
        const base = weaponsDb[id], wpn = W(id);
        const owned = playerStats.weapons.includes(id), eq = playerStats.currentWeapon === id;
        const needR = unlockRank('weapon', id), locked = !owned && myRank < needR;      // 4.0: the new weapons unlock with rank
        let btnText, btnKind, onclick = '', extra = null, addon = '';
        if (eq) { btnText = 'EQUIPPED'; btnKind = 'on'; }
        else if (owned) { btnText = 'EQUIP'; btnKind = 'equip'; onclick = `window.equipWeapon('${id}')`; }
        else if (locked) { btnText = `\ud83d\udd12 RANK ${needR} \u00b7 $${base.cost}`; btnKind = 'off'; }
        else { btnText = `BUY $${base.cost}`; btnKind = money >= base.cost ? 'buy' : 'poor'; onclick = `window.buyWeapon('${id}')`; }
        if (owned) {
            const lvl = wpn.level, cost = upgradeCost(id);
            extra = lvl >= UPGRADE_MAX ? { text: `MAXED \u00b7 ${TIER_NAMES[UPGRADE_MAX]}`, kind: 'off', onclick: '' }
                : { text: `LV${lvl + 1} ${TIER_NAMES[lvl + 1]}  $${cost}`, kind: money >= cost ? 'gold' : 'poor', onclick: `window.upgradeWeapon('${id}')` };
            // 4.0 attachments this gun can take: one small button each
            const fits = ATT_ORDER.filter(a => attFits(id, a));
            if (fits.length) addon = `<div class="flex gap-1 mt-2">${fits.map(a => { const A = ATTACH[a], have = hasAtt(id, a), c = A.cost, col = hex(A.color);
                return `<button ${have || money < c ? 'disabled' : ''} title="${A.name}: ${A.desc}" onclick="window.buyAttachment('${id}','${a}')" class="attb flex-1 py-1 rounded text-[10px] font-black leading-tight border ${have || money >= c ? '' : 'cursor-not-allowed'}" style="border-color:${col}${have ? '' : '88'};color:${have ? '#0b0f14' : col};background:${have ? col : 'rgba(0,0,0,0.25)'}${have || money >= c ? '' : ';opacity:0.45'}">${have ? '\u2713 ' + A.name : `${A.name}<br>$${c}`}</button>`; }).join('')}</div>`;
        }
        const special = base.melee ? 'Melee \u00b7 lunge' : base.rail ? 'Charge \u00b7 pierces all' : base.tesla ? `Chains ${wpn.chain + 1}` : base.grenade ? 'Bouncing grenades' : base.akimbo ? 'Akimbo'
            : base.pierce ? `Pierces ${base.pierce}` : base.burst ? `Auto burst x${base.burst}` : base.spinUp ? 'Spin-up' : base.knock ? 'Knockback' : base.hsMult > 2 ? `Head x${base.hsMult}` : (base.auto ? 'Full auto' : 'Semi auto');
        const ki = ownedList.indexOf(id), keyTxt = ki >= 0 && keyLabel(ki) ? ` \u00b7 Key ${keyLabel(ki)}` : '';
        const rps = (base.burst ? base.burst * 1000 / Math.max(wpn.fireRate, base.burstGap * base.burst) : 1000 / wpn.fireRate).toFixed(1);
        const rows = base.melee ? [['DMG', `${Math.round(wpn.damage)} per slash`], ['SLASHES/S', rps], ['LUNGE', `${Math.round(wpn.damage * base.lunge)} dmg`], ['LUNGE CD', wpn.lungeCd.toFixed(1) + 's']]
            : [['DMG', wpn.pellets > 1 ? `${Math.round(wpn.damage)} x${wpn.pellets}` : Math.round(wpn.damage) + (base.rail ? ' (full)' : '')],
               base.rail ? ['CHARGE', wpn.charge.toFixed(2) + 's'] : base.grenade ? ['BLAST', wpn.radius.toFixed(1) + 'm'] : base.tesla ? ['RPS', `${rps} \u00b7 ${wpn.jump}m jumps`] : ['RPS', rps],
               ['MAG', wpn.magSize], ['RELOAD', base.reloadStyle === 'shell' ? `${(wpn.shellTime / 1000).toFixed(2)}s/shell` : (wpn.reloadTime / 1000).toFixed(1) + 's']];
        return shopCard({
            title: base.name + (wpn.level ? ' ' + '\u2605'.repeat(wpn.level) : ''), color: hex(base.color), tag: `${wpn.level ? TIER_NAMES[wpn.level] + ' \u00b7 ' : ''}${special}${keyTxt}${needR > 1 && !owned ? ' \u00b7 NEW' : ''}`, desc: base.desc, highlight: eq, btnText, btnKind, onclick, extra, addon, tallDesc: true, rows
        });
    });

    const secCards = Object.values(secondariesDb).map(sec => {
        const owned = playerStats.secondaries.includes(sec.id), eq = playerStats.currentSecondary === sec.id;
        let btnText, btnKind, onclick = '';
        if (eq) { btnText = 'EQUIPPED (Q)'; btnKind = 'on'; }
        else if (owned) { btnText = 'EQUIP'; btnKind = 'equip'; onclick = `window.equipSecondary('${sec.id}')`; }
        else { const c = secCost(sec); btnText = `BUY $${c}${c < sec.cost ? ' (-25%)' : ''}`; btnKind = money >= c ? 'buy' : 'poor'; onclick = `window.buySecondary('${sec.id}')`; }
        let rows, extra = null, title = sec.name;
        if (sec.id === 'turret') {
            const L = playerStats.upgrades.turret || 0, ts = turretStats(L);
            title += L ? ' ' + '\u2605'.repeat(L) : '';
            rows = [['MODEL', TURRET_TIERS[L]], ['DMG', `${Math.round(ts.damage)} per hit`], ['HEALTH', ts.hp], ['AMMO', ts.ammo], ['COOLDOWN', ts.cooldown + 's after it\'s gone']];
            if (ts.rockets) rows.push(['ROCKETS', `every ${ts.rockets}s`]);
            if (owned) { const c = upgradeCost('turret'); extra = L >= UPGRADE_MAX ? { text: 'MAXED \u00b7 PLASMA CORE', kind: 'off', onclick: '' } : { text: `LV${L + 1} ${TURRET_TIERS[L + 1]}  $${c}`, kind: money >= c ? 'gold' : 'poor', onclick: 'window.upgradeTurret()' }; }
        } else if (sec.id === 'molotov') rows = [['BURN', sec.damage + '/s'], ['AREA', sec.radius + 'm'], ['COOLDOWN', sec.cooldown + 's']];
        else rows = sec.heal ? [['HEAL', `+${sec.heal} HP`], ['COOLDOWN', sec.cooldown + 's']] : [['DMG', sec.damage], ['BLAST', sec.radius + 'm'], ['COOLDOWN', sec.cooldown + 's']];
        return shopCard({ title, color: hex(sec.color), tag: 'Secondary \u00b7 Q', desc: sec.desc, highlight: eq, btnText, btnKind, onclick, rows, extra });
    });


    const curTierIdx = playerStats.armorTier ? ARMOR_ORDER.indexOf(playerStats.armorTier) : -1;
    const armorCards = ARMOR_ORDER.map((id, idx) => {
        const a = armorDb[id];
        let btnText, btnKind, onclick = '';
        if (idx === curTierIdx) { btnText = 'WEARING'; btnKind = 'on'; }
        else if (idx < curTierIdx) { btnText = 'OUTCLASSED'; btnKind = 'off'; }
        else { btnText = `BUY $${a.cost}`; btnKind = money >= a.cost ? 'buy' : 'poor'; onclick = `window.buyArmor('${id}')`; }
        return shopCard({ title: a.name, color: hex(a.color), tag: 'Armor', highlight: idx === curTierIdx, btnText, btnKind, onclick,
            rows: [['ARMOR', a.max], ['ABSORBS', Math.round(a.absorb * 100) + '% of hits']] });
    });
    const tier = playerStats.armorTier ? armorDb[playerStats.armorTier] : null;
    const armorFull = !tier || currentArmor >= tier.max;
    armorCards.push(shopCard({ title: 'Repair Armor', color: '#7dd3fc', tag: 'Consumable', btnText: !tier ? 'NO ARMOR' : (armorFull ? 'ARMOR FULL' : `REPAIR $${ARMOR_REPAIR_COST}`),
        btnKind: (!tier || armorFull) ? 'off' : (money >= ARMOR_REPAIR_COST ? 'buy' : 'poor'), onclick: 'window.repairArmor()',
        rows: [['RESTORES', 'Full plates'], ['CURRENT', tier ? `${Math.ceil(currentArmor)} / ${tier.max}` : '-']] }));
    const hpFull = currentHp >= maxHp;
    armorCards.push(shopCard({ title: `+${HEALTH_AMOUNT} Health`, color: '#ef4444', tag: 'Consumable', btnText: hpFull ? 'MAX HEALTH' : `BUY $${HEALTH_COST}`,
        btnKind: hpFull ? 'off' : (money >= HEALTH_COST ? 'red' : 'poor'), onclick: 'window.buyHealth()',
        rows: [['HEAL', `+${HEALTH_AMOUNT} HP`], ['CURRENT', `${Math.ceil(currentHp)} / ${maxHp}`]] }));


    // player upgrades (5 levels each, reset every run)
    const perkCards = Object.entries(PERKS).map(([id, p]) => {
        const L = perk(id), cost = PERK_COSTS[L];
        const now = { hp: `${maxHp} max HP`, speed: `+${7 * L}% speed`, dmg: `+${8 * L}% damage`, reload: `${8 * L}% faster`, regen: L ? `${L} HP/s` : 'off' }[id];
        return shopCard({ title: p.name + (L ? ' ' + '\u2605'.repeat(L) : ''), color: hex(p.color), tag: `Upgrade \u00b7 level ${L} / 5`, desc: p.desc, highlight: L > 0,
            btnText: L >= 5 ? 'MAXED' : `UPGRADE $${cost}`, btnKind: L >= 5 ? 'off' : (money >= cost ? 'gold' : 'poor'), onclick: L >= 5 ? '' : `window.buyPerk('${id}')`,
            rows: [['NOW', now], ['LEVEL', `${L} / 5`]] });
    });
    // 4.0 classes: pick / switch (between waves) and the current class's 3-step upgrade tree
    const cid = validClass(playerStats.cls), CC = CLASSES[cid], CL = clsLvl(cid), canSwitch = classSwitchOK();
    const classCards = CLASS_ORDER.map(id => {
        const c = CLASSES[id], mine = id === cid, L = clsLvl(id);
        return shopCard({ title: c.name + (L ? ' ' + '\u2605'.repeat(L) : ''), color: hex(c.color), tag: `${c.ability} \u00b7 X \u00b7 ${c.cd[Math.min(3, L)]}s`, desc: c.abilityDesc, tallDesc: true, highlight: mine,
            btnText: mine ? 'YOUR CLASS' : (canSwitch ? 'SWITCH' : 'SWITCH BETWEEN WAVES'), btnKind: mine ? 'on' : (canSwitch ? 'equip' : 'off'), onclick: mine || !canSwitch ? '' : `window.pickClass('${id}')`,
            rows: [['ROLE', c.role], ['UPGRADES', `${L} / 3`]] });
    });
    const treeCards = CC.tree.map((t, i) => {
        const own = CL > i, next = CL === i, cost = CLASS_COSTS[i];
        return shopCard({ title: `${['I', 'II', 'III'][i]} \u00b7 ${t.name}`, color: hex(CC.color), tag: `${CC.name} upgrade \u00b7 step ${i + 1} of 3`, desc: t.desc, tallDesc: true, highlight: own,
            btnText: own ? 'OWNED' : next ? `UNLOCK $${cost}` : `NEEDS STEP ${['I', 'II', 'III'][i - 1]}`, btnKind: own ? 'on' : next ? (money >= cost ? 'gold' : 'poor') : 'off', onclick: next ? `window.buyClassUp(${i})` : '',
            rows: [['COST', `$${cost}`], ['STATUS', own ? 'Active' : next ? 'Next up' : 'Locked']] });
    });
    const classSub = NET.pvp ? 'Classes are off in PvP.' : `Your ability is on X. ${canSwitch ? 'Switch class any time between waves' : 'You can switch class between waves'} - upgrades stay with each class.`;
    container.innerHTML =
        section(`CLASS \u00b7 <span style="color:${hex(CC.color)}">${CC.name}</span>`, classSub, classCards, 'lg:grid-cols-4') +
        section(`${CC.name} UPGRADES`, `<b class="text-gray-200">Passive:</b> ${CC.passive} Buy the steps in order - they last until the run ends.`, treeCards, 'lg:grid-cols-3') +
        section('PLAYER UPGRADES', 'Make yourself tougher, faster and deadlier. 5 levels each - they last until the run ends.', perkCards) +
        section('WEAPONS', 'Switch in-game with 1-9, 0, - or the scroll wheel (the keys follow the order of the guns you own). Upgrades: 5 levels, each a new gun model (Tactical, Heavy, Elite, Gold Elite, Plasma Prototype). Per level: +18% damage, +20% mag, -10% reload, +5% fire rate, tighter spread, less recoil. ATTACHMENTS bolt onto guns you own: <b style="color:#22d3ee">SCOPE</b> (more zoom, -35% aim spread, +10% headshots), <b style="color:#facc15">EXT MAG</b> (+40% mag), <b style="color:#a3e635">GRIP</b> (-30% recoil, steadier hip fire). New weapons unlock with your rank.', weaponCards) +
        section('SECONDARIES', 'Press Q to use. One equipped at a time, on a cooldown. The Sentry Turret upgrades to level 5.' + (gadgetMul() < 1 ? ' <b class="text-yellow-300">ENGINEER: gadgets and sentry upgrades cost 25% less.</b>' : ''), secCards, 'lg:grid-cols-3') +
        section('ARMOR & SUPPLIES', 'Armor soaks up part of every hit until it breaks.', armorCards);
}


function afterPurchase() { renderShopItems(); updateHUD(); sfx('pickup'); }


window.buyWeapon = (id) => {
    const wpn = weaponsDb[id];
    if (!rankOK('weapon', id)) return;                 // 4.0: the new weapons unlock with rank
    if (playerStats.money >= wpn.cost && !playerStats.weapons.includes(id)) {
        playerStats.money -= wpn.cost;
        playerStats.weapons.push(id);
        playerStats.currentWeapon = id;
        ammoState[id] = W(id).magSize;
        updateGunModel(); afterPurchase();
    }
};
window.equipWeapon = (id) => {
    if (playerStats.weapons.includes(id)) { playerStats.currentWeapon = id; updateGunModel(); afterPurchase(); }
};
window.upgradeWeapon = (id) => {
    const lvl = playerStats.upgrades[id] || 0, cost = upgradeCost(id);
    if (!playerStats.weapons.includes(id) || lvl >= UPGRADE_MAX || playerStats.money < cost) return;
    playerStats.money -= cost;
    playerStats.upgrades[id] = lvl + 1;
    clearWCache();
    ammoState[id] = W(id).magSize;
    if (playerStats.currentWeapon === id) showWeaponModel(id);   // new look for the new level
    renderShopItems(); updateHUD(); sfx('upgrade');
};
// 4.0 attachments: one of each kind per gun, kept for the run
window.buyAttachment = (id, a) => {
    const A = ATTACH[a];
    if (!A || !playerStats.weapons.includes(id) || !attFits(id, a) || hasAtt(id, a) || playerStats.money < A.cost) return;
    playerStats.money -= A.cost;
    if (!playerStats.atts || typeof playerStats.atts !== 'object') playerStats.atts = {};
    playerStats.atts[id] = Object.assign({}, playerStats.atts[id], { [a]: 1 });
    clearWCache();
    if (a === 'mag') ammoState[id] = W(id).magSize;
    if (playerStats.currentWeapon === id) showWeaponModel(id);   // it shows up on the gun straight away
    renderShopItems(); updateHUD(); sfx('upgrade');
};
window.upgradeTurret = () => {
    const lvl = playerStats.upgrades.turret || 0, cost = upgradeCost('turret');
    if (!playerStats.secondaries.includes('turret') || lvl >= UPGRADE_MAX || playerStats.money < cost) return;
    playerStats.money -= cost; playerStats.upgrades.turret = lvl + 1;
    renderShopItems(); updateHUD(); sfx('upgrade');
};
window.buySecondary = (id) => {
    const sec = secondariesDb[id], cost = secCost(sec);
    if (playerStats.money >= cost && !playerStats.secondaries.includes(id)) {
        playerStats.money -= cost;
        playerStats.secondaries.push(id);
        window.equipSecondary(id);
    }
};
window.equipSecondary = (id) => {
    if (!playerStats.secondaries.includes(id)) return;
    if (activeC4 && id !== 'c4') { scene.remove(activeC4.mesh); projectiles = projectiles.filter(p => p !== activeC4); activeC4 = null; }
    if (playerStats.currentSecondary !== id) secondaryCooldown = Math.min(secondaryCooldown, 3); // no cooldown dodging by swapping
    playerStats.currentSecondary = id;
    afterPurchase();
};
window.buyArmor = (id) => {
    const a = armorDb[id];
    const curIdx = playerStats.armorTier ? ARMOR_ORDER.indexOf(playerStats.armorTier) : -1;
    if (playerStats.money >= a.cost && ARMOR_ORDER.indexOf(id) > curIdx) {
        playerStats.money -= a.cost; playerStats.armorTier = id; currentArmor = a.max; afterPurchase();
    }
};
window.repairArmor = () => {
    const tier = playerStats.armorTier ? armorDb[playerStats.armorTier] : null;
    if (tier && currentArmor < tier.max && playerStats.money >= ARMOR_REPAIR_COST) { playerStats.money -= ARMOR_REPAIR_COST; currentArmor = tier.max; afterPurchase(); }
};
window.buyPerk = (id) => {
    const L = perk(id), cost = PERK_COSTS[L];
    if (L >= 5 || playerStats.money < cost) return;
    playerStats.money -= cost;
    playerStats.perks = playerStats.perks || {};
    playerStats.perks[id] = L + 1;
    if (id === 'hp') { maxHp = 100 + 20 * perk('hp'); currentHp = Math.min(maxHp, currentHp + 20); }
    if (id === 'dmg' || id === 'reload') clearWCache();
    renderShopItems(); updateHUD(); sfx('upgrade');
};
window.buyHealth = () => {
    if (playerStats.money >= HEALTH_COST && currentHp < maxHp) {
        playerStats.money -= HEALTH_COST;
        currentHp = Math.min(maxHp, currentHp + HEALTH_AMOUNT);
        afterPurchase();
    }
};


// 4.0 classes: switching is free but only between waves (or from the main menu); each class keeps its own upgrades
function classSwitchOK() { return !NET.pvp && (returnMenuState === 'main' || !waveActive); }
window.pickClass = (id) => {
    if (!CLASSES[id] || id === playerStats.cls || !classSwitchOK()) return;
    playerStats.cls = id; settings.cls = id; saveSettings();       // the menu remembers it for the next run too
    abilityCd = Math.min(abilityCd, abilityCooldown(id)); abilityT = 0; radarT = 0;
    applyMinimapSize();
    renderShopItems(); updateHUD(); sfx('upgrade');
};
window.buyClassUp = (i) => {
    const id = validClass(playerStats.cls), L = clsLvl(id), cost = CLASS_COSTS[i];
    if (NET.pvp || i !== L || L >= 3 || playerStats.money < cost) return;
    playerStats.money -= cost;
    if (!playerStats.clsUp || typeof playerStats.clsUp !== 'object') playerStats.clsUp = {};
    playerStats.clsUp[id] = L + 1;
    abilityCd = Math.min(abilityCd, abilityCooldown(id));      // a shorter cooldown applies straight away
    renderShopItems(); updateHUD(); sfx('upgrade');
};
