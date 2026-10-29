// ----- the context panel (changes with what you have selected) -----
// 2.0: two-row cards share the space evenly (no cut-off text when there is room; scroll only when there is not)
function fitCards(el) {
  const cs = el.querySelector('.cards.compact'); if (!cs) return; let n = 0; for (const c of cs.children) n += c.classList.contains('stk') ? 2 : 1;
  const cols = Math.ceil(n / 2), w = cs.clientWidth; if (!w) return; const cw = clamp(Math.floor((w - (cols - 1) * 8 - 2) / cols), 178, 230); cs.style.setProperty('--cw', cw + 'px'); cs.classList.toggle('more', !cs.querySelector('.stk') && cols * (cw + 8) - 8 > w + 4);
}
// 2.1: the HUD is laid out once at 1280x720 and scaled to the window (Settings > Screen buttons size changes it)
function hudScale() {
  const h = $('#hud'); if (!h) return; const mul = SET.uiSize === 's' ? .88 : SET.uiSize === 'l' ? 1.12 : 1;
  const s = clamp(Math.min(innerWidth / 1280, innerHeight / 720) * mul, .55, 1.6); UI.uis = s;
  h.style.transform = 'scale(' + s + ')'; h.style.width = (innerWidth / s) + 'px'; h.style.height = (innerHeight / s) + 'px'; h.classList.toggle('narrow', innerWidth / s < 1150);
  if (inGame && W) { const el = $('#panel'); if (el) el.dataset.h = ''; hudUpdate(true); }
}
const hudDeckPx = () => (176 + 30) * (UI.uis || 1);   // screen px covered by the bottom deck
window.addEventListener('resize', hudScale);
// 2.1: HUD buttons act the moment the mouse button goes down (like most strategy games). The click that follows is
// swallowed, so nothing runs twice, and a button that changes while it is held can never lose the press.
const PRESS_SEL = 'button, [data-i], [data-hb], [data-qx], [data-grp], [data-pg], [data-sq], [data-call], [data-sp], [data-q2], [data-pt], [data-x], .tcard, .wmpt, .chip';
let pressAt = 0;
window.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button === 0) pressAt = 0;
  if (e.pointerType !== 'mouse' || e.button !== 0 || !e.target || !e.target.closest) return;
  const host = e.target.closest('#hud'); if (!host || e.target.closest('canvas, input, select, textarea')) return;
  const a = e.target.closest(PRESS_SEL); if (!a || !host.contains(a) || a.disabled) return;
  pressAt = performance.now(); e.preventDefault(); a.click();
}, true);
window.addEventListener('click', e => { if (e.isTrusted && pressAt && performance.now() - pressAt < 900) { e.stopImmediatePropagation(); e.preventDefault(); pressAt = 0; } }, true);   // (wherever the release lands, e.g. on a menu the press just opened)
window.addEventListener('pointerdown', e => { const t = $('#tip'); if (t) t.classList.add('hidden'); UI.hudDown = !!(e.target && e.target.closest && e.target.closest('#hud, #techp')) && e.target.id !== 'gl'; clearTimeout(UI.hudDownT); if (UI.hudDown) UI.hudDownT = setTimeout(() => { UI.hudDown = false; }, 1500); }, true);
const hudUp = () => { if (UI.hudDown) setTimeout(() => { UI.hudDown = false; if (inGame && W) hudUpdate(); }, 0); };
window.addEventListener('pointerup', hudUp, true); window.addEventListener('pointercancel', hudUp, true);   // 2.0: a click never leaves an old tooltip on screen
function tileHtml(o) {
  const img = o.img ? '<div class="ti" style="' + iconStyle(o.img) + '"></div>' : '<div class="ti" style="color:' + (o.col || 'var(--gold2)') + '">' + ic(o.ico || 'star') + '</div>';
  const cost = o.lock ? '<span class="tc">' + ic('lock') + esc(o.lockTxt || 'Locked') + '</span>' : (o.cost ? '<span class="tc">' + ic('coin') + o.cost + '</span>' : '<span></span>');
  const ros = o.rn ? '<span class="trq">' + o.rh + '/' + o.rn + '</span><span class="tqx" data-qx="' + (o.key || '') + '" data-tip="Remove one|Take one slot out of the roster. The troop stays, it just will not be replaced. (Right-click the tile does the same.)">&minus;</span>' : '';
  return '<div class="tt">' + cost + (o.hk ? '<span class="tk">' + o.hk + '</span>' : '') + '</div>' + img + '<div class="tn">' + esc(o.nm) + '</div>' + (o.big && o.s ? '<div class="ts">' + esc(o.s) + '</div>' : '') + ros + (o.pg ? '<div class="tb" style="width:' + Math.round(o.pg * 100) + '%"></div>' : '');
}
function cardHtml(i, o, compact) {
  const img = o.img ? '<div class="cimg" style="' + iconStyle(o.img) + '"></div>' : '<div class="cimg" style="color:' + (o.col || 'var(--gold2)') + ';display:flex;align-items:center;justify-content:center">' + ic(o.ico || 'star') + '</div>';
  const cost = o.lock ? '<span class="cc">' + ic('lock') + (o.lockTxt || 'Locked') + '</span>' : (o.cost ? '<span class="cc">' + ic('coin') + o.cost + '</span>' : '');
  const cls = 'card' + (compact ? ' c2' : '') + (o.cdn ? ' cdn' : '') + (o.off ? ' off' : '') + (o.lock ? ' lock' : '') + (o.on ? ' on' : '') + (o.go ? ' go' : '') + (o.stk ? ' stk' : '');
  const extra = (o.rn ? '<span class="rq" data-tip="In the roster|' + o.rh + ' alive out of ' + o.rn + ' wanted. The building keeps this many and replaces any that die.">' + o.rh + '/' + o.rn + '</span><span class="qx" data-qx="' + (o.key || '') + '" data-tip="Remove one|Take one slot out of the roster. The troop stays, it just will not be replaced. (Right-click the card does the same.)">&minus;</span>' : '') + (o.hk ? '<span class="hk">' + o.hk + '</span>' : '') + (o.pg ? '<div class="pg" style="width:' + Math.round(o.pg * 100) + '%"></div>' : '');
  if (compact) return '<div class="' + cls + '" data-i="' + i + '" data-key="' + (o.key || '') + '" data-tip="' + esc(o.tip || o.nm) + '">' + img + '<div class="ctx"><div class="cn">' + esc(o.nm) + '</div><div class="cs">' + cost + '<span class="cd">' + esc(o.s || o.d || '') + '</span></div></div>' + extra + '</div>';
  return '<div class="' + cls + '" data-i="' + i + '" data-key="' + (o.key || '') + '" data-tip="' + esc(o.tip || o.nm) + '"><div class="crow">' + img + '<div class="cn">' + esc(o.nm) + '</div></div><div class="cm">' + cost + '</div><div class="cd">' + esc(o.d || '') + '</div>' + extra + '</div>';
}
function rosStatus(b) {
  let have = 0; for (const k in b.ros) have += Math.min(rosHave(b, k), b.ros[k]); const tot = rosTotal(b), cap = rosCap(b);
  let h = '<b style="color:#ffe2a6">Roster ' + tot + '/' + cap + '</b> ';
  if (!tot) return h + '<span style="color:#9fd0ff">Click troop cards to pick what this building keeps.</span>';
  h += '<span style="color:#cdd8e6">' + have + ' alive.</span> ';
  if (b.wait) h += '<b style="color:#ff9a8c">' + (b.wait === 2 ? 'Army full' : 'Paused') + '</b>';
  else if (b.tr) h += '<b style="color:#ffd37a">' + (b.tr.re ? 'Respawning ' : 'Training ') + (UT[b.tr.u] ? UT[b.tr.u].n : 'troops') + ' (' + Math.ceil(Math.max(0, b.tr.dur - b.tr.t)) + 's)</b>';
  else h += '<b style="color:#8ff0b4">Full strength</b>';
  return h;
}
const FORMTIP = ['A tidy block.', 'A wide line facing the target: every gun can fire.', 'An arrow pointing at the enemy.', 'Spread far apart: less hurt by artillery and bombs.', 'Two by two in a long column: good on roads and bridges.', 'A ring around the spot: holds a flag from every side.', 'No formation: the group keeps its shape (squeezed together if it is spread out). Clicking the selected formation again also switches back to this.'];
function cycleTarget(us) { const tps = new Set(us.map(u => u.tp | 0)), cur = tps.size === 1 ? [...tps][0] : -1, nv = (cur + 1) % 5; if (issue({ k: 'tp', ids: us.map(u => u.id), v: nv })) { if (!W.mirror) for (const u of us) u.tp = nv; toast('Target: ' + TPN[nv]); sfx('click'); } UI.cardSig = ''; hudUpdate(true); }
function hpHtml(f, col) { return '<div class="hpbar"><i style="width:' + Math.round(f * 20) * 5 + '%' + (col ? ';background:' + col : '') + '"></i></div>'; }
function renderPanel(force) {
  const el = $('#panel'), p = P(ME), items = [], us = selUnitsArr(), b = selBld ? W.byId.get(selBld) : null; let head = '', wide = false, bh = false, hbtns = ''; const hb = {};
  const hql = playerHQLvl(p);
  if (us.length) {
    const by = {}; for (const u of us) (by[u.type] = by[u.type] || []).push(u);
    if (us.length === 1) {
      const u = us[0], T = u.T; head = '<div class="ph1"><div class="pic" style="' + iconStyle(u.type) + '"></div><div class="pt">' + T.n + (u.vet ? ' <span class="stars">' + '&#9733;'.repeat(u.vet) + '</span>' : '') + '<small>' + T.role + '</small></div></div>' + hpHtml(u.hp / u.maxHp) + (u.shpMax ? hpHtml(u.shp / u.shpMax, '#5ad8ff') : '') + '<div class="pm">' + (T.carry && !W.mirror ? '<b style="color:#8fd0ff">Aboard: ' + cargoPop(u) + ' / ' + T.carry + '</b> ' + esc(cargoPop(u) ? 'Click a beach to land them.' : 'Select soldiers, then click this boat to load them.') : esc(T.d)) + '</div>';
    } else {
      head = '<div class="pt">' + us.length + ' selected</div><div class="chips">' + Object.keys(by).map(t => '<div class="chip" data-grp="' + t + '" data-tip="' + esc(UT[t].n + '|' + by[t].length + ' selected. Click to pick only these.') + '" style="' + iconStyle(t) + '"><b>' + by[t].length + '</b><div class="h" style="width:' + Math.round(by[t].reduce((a, u) => a + u.hp / u.maxHp, 0) / by[t].length * 20) * 5 + '%"></div></div>').join('') + '</div>';
    }
    const ids = () => us.map(u => u.id);
    items.push({ nm: 'Move + Fight', ico: 'fight', d: 'Go there and fight.', hk: 'F', on: UI.mode === 'amove', tip: 'Move + Fight (tap F)|Your troops walk to the spot you click and attack any enemy they meet.', fn: () => setMode(UI.mode === 'amove' ? null : 'amove') });
    items.push({ nm: 'Stop', ico: 'stop', d: 'Stay here.', hk: 'H', tip: 'Stop (H)|Cancel orders. Troops stay put and shoot what comes close.', fn: () => issue({ k: 'stop', ids: ids() }) });
    items.push({ nm: 'Fall back', ico: 'back', d: 'Run to your nearest flag.', hk: 'R', tip: 'Fall back (R)|Retreat to the closest flag you own.', fn: retreatSel });
    if (us.some(u => u.T.carry)) { const cr = us.filter(u => u.T.carry), n = W.mirror ? -1 : cr.reduce((a, u) => a + cargoPop(u), 0); items.push({ nm: 'Unload', key: 'unload', ico: 'chute', d: n < 0 ? 'Land the soldiers aboard.' : n ? n + ' aboard: land them.' : 'Nobody aboard.', off: n === 0, tip: 'Unload|The Landing Craft sails to the nearest beach and puts everyone ashore. Or click a spot on land to land them there.|To load: select soldiers, then click the Landing Craft.', fn: () => { if (issue({ k: 'unload', ids: cr.map(u => u.id) })) sfx('order'); else { sfx('deny'); toast('Nobody aboard. Select soldiers, then click the Landing Craft to load them.'); } } }); }   // 3.0
    if (us.some(u => u.T.eng)) items.push({ nm: 'Sandbag Nest', ico: 'nest', cost: BT.nest.cost[0], d: 'Build a gun nest.', hk: 'N', on: UI.mode === 'nest', tip: 'Sandbag Nest (N)|' + (engN() === 'Engineer' ? 'An Engineer' : 'A Technician') + ' builds a small machine gun nest where you click.', fn: () => setMode(UI.mode === 'nest' ? null : 'nest') });
    items.push({ nm: 'Guard', key: 'guard', ico: 'hold', d: 'Hold a flag or spot.', hk: 'V', on: UI.mode === 'guard', tip: 'Guard (V)|Click a flag (or any spot) and these troops stand guard around it: they fight off anyone who comes near, then go back to their posts. Any other order ends guard duty.', fn: () => setMode(UI.mode === 'guard' ? null : 'guard') });
    { const tps = new Set(us.map(u => u.tp | 0)), tv = tps.size === 1 ? [...tps][0] : -1;
      items.push({ nm: 'Target: ' + (tv < 0 ? 'Mixed' : TPN[tv]), key: 'tp', ico: 'fight', d: 'What they shoot first.', on: tv > 0, tip: 'Target type (X)|Pick what these troops shoot first: Any, Soldiers, Vehicles, Aircraft or Buildings. Click to switch. They still fight back against anything they can hit.', fn: () => cycleTarget(us) }); }
    {
      items.push({ nm: 'Hold', ico: 'hold', d: 'Only shoot what comes close.', hk: 'J', tip: 'Hold position (J)|Troops stand still and only fire at enemies in range.', fn: () => issue({ k: 'hold', ids: ids() }) });
      items.push({ nm: 'Stay together', ico: 'army', d: 'Walk at the slowest speed.', hk: 'G', on: UI.gspd, tip: 'Stay together (G)|The whole group moves at the speed of its slowest unit.', fn: () => { UI.gspd = !UI.gspd; UI.cardSig = ''; hudUpdate(true); } });
    }
    // 4.1: formation picker, always visible
    FORMUI.forEach(i => { const f = FORMN[i]; hb['f' + i] = () => { UI.form = UI.form === i ? 6 : i; UI.cardSig = ''; sfx('click'); hudUpdate(true); }; hbtns += '<button class="sm' + (UI.form === i ? ' on' : '') + '" data-hb="f' + i + '" data-tip="' + esc('Formation: ' + f + '|' + FORMTIP[i] + ' Used the next time you give an order. Y cycles; click it again to go back to Free.') + '">' + f + '</button>'; });
    head += '<div class="hbtns fm">' + hbtns + '</div>';
  } else if (b && b.owner === ME) {
    const T = btx(b.type, bFac(b)), spn = b.spec ? T.specs.find(s => s.id === b.spec) : null;
    head = '<div class="ph1"><div class="pic" style="' + iconStyle(bIcon(b.type, bFac(b))) + '"></div><div class="pt">' + T.n + '<small>Level ' + b.lvl + (spn ? ' - ' + esc(spn.n) : '') + '</small></div></div>' + hpHtml(b.hp / b.maxHp) + '<div class="pm">' + (b.prog < 1 ? 'Building... ' + Math.floor(b.prog * 100) + '%' : (b.upg ? (b.upg.kind === 'lvl' ? 'Leveling up... ' : 'Adding upgrade... ') + Math.floor(b.upg.t / b.upg.dur * 100) + '% ' : '') + (b.ros ? rosStatus(b) : b.type === 'shieldgen' && b.sp !== undefined ? (b.sOn ? '<b style="color:#8fe8ff">Force field ' + Math.round(b.sp) + ' / ' + Math.round(shieldMax(b)) + '</b>' : '<b style="color:#ff9a8c">Field broken: recharging ' + Math.round(b.sp / shieldMax(b) * 100) + '% (back at 50%)</b>') : b.upg ? '' : esc(T.d))) + '</div>';
    if (b.prog >= 1) {
      let hk = 0;
      if (b.ros) for (const k of UTORD) {
        const U = UT[k], src = U.src.find(s => s[0] === b.type); if (!src || U.nobuild || !canTrainAt(b, k)) continue;
        const cost = slotCost(p, k, b), rn = b.ros[k] || 0, rh = Math.min(rosHave(b, k), rn), fits = rosFits(b, k);
        items.push({ nm: U.n, key: k, img: k, cost, d: U.d, s: U.role, off: !fits || (p.sup < cost && !W.o.sandbox), on: rn > 0, rn, rh, pg: b.tr && b.tr.u === k ? Math.max(.02, b.tr.t / b.tr.dur) : 0, tip: unitTip(k, b), fn: () => {
          if (!rosFits(b, k)) { sfx('deny'); toast(rosTotal(b) >= rosCap(b) ? 'This ' + T.n + ' is full (' + rosCap(b) + '). Level it up to hold more, or remove a troop first.' : 'The extra Drone Factory slots are for drones only.'); return; }
          if (p.sup < cost && !W.o.sandbox) { sfx('deny'); toast('A ' + U.n + ' slot costs ' + cost + '. Not enough money yet.'); return; }
          if (issue({ k: 'ros', b: b.id, u: k, d: 1 })) { UI.did.train = (UI.did.train || 0) + 1; sfx('click'); } else { sfx('deny'); toast('Could not add that troop.'); } UI.cardSig = ''; hudUpdate(true); } });
      }
      if (b.lvl < 3 && !b.upg && BT[b.type].cost[b.lvl] !== undefined) {
        const uc = bCost(p, b.type, b.lvl), gate = b.lvl === 2 && b.type !== 'hq' && hql < 2;
        items.push({ nm: 'Level ' + (b.lvl + 1), key: 'lvl', stk: 1, ico: 'up', cost: uc, d: T.up[b.lvl - 1], go: !gate && (p.sup >= uc), lock: gate, lockTxt: 'HQ Lv 2', off: !gate && p.sup < uc && !W.o.sandbox, hk: 'U', tip: 'Level up to ' + (b.lvl + 1) + '|' + (T.upl || T.up)[b.lvl - 1] + '|Costs ' + uc + '. Takes ' + BT[b.type].bt[b.lvl] + 's.' + (gate ? ' Level up your HQ to Level 2 first.' : ''), fn: () => { if (gate) { toast('Level up your HQ to Level 2 first.'); sfx('deny'); return; } if (issue({ k: 'upg', b: b.id })) { UI.did.upg = 1; sfx('click'); } else { sfx('deny'); toast('Not enough money yet.'); } } });
      }
      if (b.lvl >= 3 && !b.spec && !b.upg && T.specs.length) items.push({ nm: 'Pick upgrade', key: 'spec', stk: 1, ico: 'star', cost: SPEC_COST, d: 'Choose 1 of 3 upgrades.', go: p.sup >= SPEC_COST, off: p.sup < SPEC_COST && !W.o.sandbox, tip: 'Pick an upgrade|Choose 1 of 3 special upgrades for this building. It cannot be changed later.', fn: () => { UI.specOpen = true; UI.cardSig = ''; hudUpdate(true); } });
      if (b.upg) items.push({ nm: 'Working...', key: 'work', stk: 1, ico: 'build', d: b.upg.kind === 'lvl' ? 'Leveling up.' : 'Adding upgrade.', off: true, pg: b.upg.t / b.upg.dur, fn: () => { } });
      if (b.ros) {
        const sq = (UI.bsq || {})[b.id] || 0;
        hb.bsq = () => { UI.bsq = UI.bsq || {}; UI.bsq[b.id] = (sq + 1) % 6; sfx('click'); UI.cardSig = ''; hudUpdate(true); };
        hbtns += '<button class="sm' + (sq ? ' on' : '') + '" data-hb="bsq" data-tip="New troops join a squad|Troops from this building automatically join the squad you pick here and walk to it. Click to switch: none, then squads 1 to 5.">' + (sq ? 'Squad: ' + SQN[sq - 1] : 'Squad: none') + '</button>';
        hb.rhold = () => { issue({ k: 'rhold', b: b.id }); sfx('click'); UI.cardSig = ''; hudUpdate(true); };
        hbtns += '<button class="sm' + (b.hold ? ' on' : '') + '" data-hb="rhold" data-tip="' + (b.hold ? 'Paused|This building is not training or replacing troops. Click to start again.' : 'Pause training|Stop this building from training and replacing troops (to save money). Click again to start.') + '">' + (b.hold ? 'Paused' : 'Pause') + '</button>';
        if (b.hasRally) {
          hb.rallyauto = () => { issue({ k: 'rally', b: b.id, clear: 1 }); sfx('click'); toast('New troops will now wait next to the building.'); UI.cardSig = ''; hudUpdate(true); };
          hbtns += '<button class="sm on" data-hb="rallyauto" data-tip="Rally: point|New troops walk to the spot you picked. Click to remove it (new troops then wait next to the building).">Rally: point</button>';
          hb.rally = () => setMode(UI.mode === 'rally' ? null : 'rally'); hbtns += '<button class="sm' + (UI.mode === 'rally' ? ' on' : '') + '" data-hb="rally" data-tip="Move rally point|Click the ground to move the rally point.">Move</button>';
        } else { hb.rally = () => setMode(UI.mode === 'rally' ? null : 'rally'); hbtns += '<button class="sm' + (UI.mode === 'rally' ? ' on' : '') + '" data-hb="rally" data-tip="Rally: none|New troops wait next to the building. Click, then click the ground, to send them to a rally point instead.">' + (UI.mode === 'rally' ? 'Click the map' : 'Rally: none') + '</button>'; }
      }
    } else items.push({ nm: 'Under construction', ico: 'build', d: engN() + 's nearby build it faster.', off: true, pg: b.prog, fn: () => { } });
    if (b.type !== 'hq') { hb.sell = () => { if (issue({ k: 'sell', b: b.id })) { sfx('click'); selBld = 0; UI.cardSig = ''; hudUpdate(true); } }; head = head.replace('</small></div></div>', '</small></div><button class="sm sell" data-hb="sell" data-tip="Sell (K)|Remove this building and get half the money back.">Sell +' + Math.round(b.spent * .5) + '</button></div>'); }
    if (hbtns) head += '<div class="hbtns">' + hbtns + '</div>';
    bh = true;
  } else if (b) {
    const T = b.T; head = '<div class="ph1"><div class="pic" style="' + iconStyle(bIcon(b.type, bFac(b))) + '"></div><div class="pt" style="color:' + (b.team === MYTEAM ? '#9fd0ff' : '#ff9a8c') + '">' + T.n + '<small>' + (b.team === MYTEAM ? 'Ally' : 'Enemy') + ' Lv ' + b.lvl + '</small></div></div>' + hpHtml(b.hp / b.maxHp, b.team === MYTEAM ? '' : '#e14a3a') + '<div class="pm">' + (b.team === MYTEAM ? '' : 'Select your troops, then click this to attack.') + '</div>';
  } else if (UI.selEnemy && !UI.selEnemy.dead) {
    const e = UI.selEnemy, T = e.T; head = '<div class="ph1"><div class="pic" style="' + iconStyle(e.type) + '"></div><div class="pt" style="color:#ff9a8c">' + esc(e.nick || T.n) + '<small>Enemy ' + (e.boss ? 'BOSS' : T.role) + '</small></div></div>' + hpHtml(e.hp / e.maxHp, '#e14a3a') + '<div class="pm">Select your troops, then click it to attack.</div>';
  } else if (selPad && W.pts[selPad.pt]) {
    const pt = W.pts[selPad.pt];
    if (pt.owner === ME) {
      const free = pt.slots.filter(s => !s.b && !s.d && !s.sea).length, freeD = pt.slots.filter(s => !s.b && s.d).length, freeS = pt.slots.filter(s => !s.b && s.sea).length, wallOk = !pt.wall, onPad = selPad && selPad.slot >= 0 && pt.slots[selPad.slot] && !pt.slots[selPad.slot].b ? pt.slots[selPad.slot] : null;
      const slotFor = k => { if (onPad) return (onPad.d && !BT[k].def) || !onPad.sea !== !BT[k].sea ? -1 : selPad.slot; if (BT[k].sea) return pt.slots.findIndex(s => !s.b && s.sea); if (BT[k].def) { const d = pt.slots.findIndex(s => !s.b && s.d); if (d >= 0) return d; } return pt.slots.findIndex(s => !s.b && !s.d && !s.sea); };   // 3.0: coastal spots take only a Shipyard
      head = '<div class="ph1"><div class="pic" style="color:' + hex3(P(ME).color) + ';display:flex;align-items:center;justify-content:center">' + ic(pt.hq >= 0 ? 'hq' : 'flag') + '</div><div class="pt">' + esc(pt.hq >= 0 ? 'Your base' : pt.name) + '<small>Your flag</small></div></div><div class="pm" style="white-space:normal">' + (onPad && onPad.sea ? 'Coastal spot: build a Shipyard here.' : onPad && onPad.d ? 'Defense pad: pick a tower or gun.' : free || freeD ? 'Pick a building. ' + free + ' spot' + (free === 1 ? '' : 's') + (freeD ? ' and ' + freeD + ' defense pad' + (freeD === 1 ? '' : 's') : '') + ' free.' + (freeS ? ' This flag has a coastal spot for a Shipyard.' : '') : (wallOk && hql >= BT.wall.hq1 ? 'All spots used. You can still add walls.' : 'All spots used. Click a building to use it.')) + '</div>';
      const buildCard = (k) => {
        const T = BT[k], bc = bCost(p, k, 0), gate = (T.hq1 || 1) > hql && !W.o.sandbox, can = p.sup >= bc || W.o.sandbox, maxed = !gate && T.max && bCount(p, k) >= T.max && !W.o.sandbox && !W.o.war;
        return { nm: T.n, key: 'b_' + k, img: bIcon(k, p.fac), cost: bc, d: T.d, lock: gate || maxed, lockTxt: maxed ? 'Max ' + T.max : 'HQ Lv ' + T.hq1, off: !gate && !can, tip: bldTip(k, p.fac) + (gate ? '|Level up your HQ to Level ' + T.hq1 + ' to unlock this.' : maxed ? '|You already have ' + T.max + ', the most you can build.' : ''), fn: () => {
          if (gate) { lockMsg('the ' + T.n, T.hq1); return; }
          if (maxed) { sfx('deny'); toast('You can only have ' + T.max + ' ' + T.n + 's.'); return; }
          const slot = slotFor(k); if (slot < 0 && k !== 'wall') { toast(BT[k].sea ? 'A Shipyard needs the coastal spot of a flag by the sea.' : BT[k].def ? 'No free spots or defense pads here.' : 'No free build spots here (defense pads only take towers and guns, coastal spots only Shipyards).'); return; }
          if (issue({ k: 'build', pt: pt.id, slot: Math.max(0, slot), type: k })) { UI.did.build = k; sfx('click'); clearSel(); afterSel(); } else { sfx('deny'); toast('Not enough money yet.'); } } };
      };
      const lockedNext = [];
      for (const k of BUILDABLE) {
        const T = BT[k]; if (k === 'wall' ? (!wallOk || (onPad && (onPad.d || onPad.sea))) : slotFor(k) < 0) continue;
        if ((T.hq1 || 1) > hql && !W.o.sandbox) { if ((T.hq1 || 1) === hql + 1) lockedNext.push(k); continue; }
        items.push(buildCard(k));
      }
      if (lockedNext.length === 1) items.push(buildCard(lockedNext[0]));
      else if (lockedNext.length > 1) { const nms = lockedNext.map(k => BT[k].n); items.push({ nm: 'More buildings', key: 'b_more', ico: 'lock', lock: true, lockTxt: 'HQ Lv ' + (hql + 1), d: nms.length + ' more to build.', tip: 'More buildings|Level up your HQ to Level ' + (hql + 1) + ' to unlock: ' + nms.join(', ') + '.', fn: () => lockMsg('more buildings', hql + 1) }); }
      if (pt.wall && !pt.wall.dead) items.push({ nm: 'Walls', key: 'walls', img: bIcon('wall', p.fac), d: 'Level up or sell the walls.', tip: 'Fortified Walls|Select the walls around this flag to level them up.', fn: () => { selectBuilding(pt.wall); sfx('click'); } });
    } else {
      head = '<div class="ph1"><div class="pic" style="color:' + (pt.owner >= 0 ? hex3(P(pt.owner).color) : '#8d97a3') + ';display:flex;align-items:center;justify-content:center">' + ic('flag') + '</div><div class="pt">' + esc(pt.hq >= 0 ? 'Enemy base' : pt.name) + '<small>' + (pt.owner < 0 ? 'Empty flag' : 'Enemy flag') + '</small></div></div><div class="pm" style="white-space:normal">' + (pt.hq >= 0 ? 'Destroy the HQ to win!' : 'Send troops into the circle and wait. When it changes color, it is yours.') + '</div>';
      wide = true;
    }
  } else {
    const h = coachHint(); head = '<div class="coach">' + ic('flag') + '<div>' + esc(h[0]) + '<small>' + esc(h[1]) + '</small></div></div>'; wide = true;
    if (W.war && W.war.phase === 'prep' && !W.o.mp) { const w = W.war; wide = false; let rc = 0, rn = 0; for (const bb of W.bld) if (bb.owner === ME && !bb.dead && bb.prog >= 1 && bb.hp < bb.maxHp - .5) { rc += (bb.maxHp - bb.hp) * .3; rn++; } rc = Math.ceil(rc);
      if (rn) items.push({ nm: 'Repair all', key: 'repall', ico: 'build', cost: rc, off: p.sup < rc, d: rn + ' damaged', tip: 'Repair all|Fix all ' + rn + ' damaged buildings at once for ' + rc + ' money (' + engN() + 's do it for free, but slowly).', fn: () => { if (issue({ k: 'repall' })) sfx('done'); else { sfx('deny'); toast('Not enough money to repair everything (' + rc + ').'); } UI.cardSig = ''; hudUpdate(true); } }); items.push({ nm: w.go ? 'Starting...' : 'Start Wave ' + w.wave, key: 'warnow', big: 1, ico: 'fight', go: !w.go, off: !!w.go, d: w.def.title, s: w.def.title, tip: 'Start wave ' + w.wave + '|' + w.def.name + ' (' + w.def.title + ') lands in the ' + WDIRS[w.def.site] + '. Your progress is saved first.', fn: () => { initAudio(); ACT.warnow(); UI.cardSig = ''; hudUpdate(true); } }); }
  }
  // 2.1: the deck is built once; the selection side is replaced only when it changes, and the tiles are updated in
  // place (same elements), so a button never disappears from under the mouse
  if (!el.querySelector('.sel')) { el.innerHTML = '<div class="sel"></div><div class="cmd"><div class="tiles"></div><div class="pager"></div></div>'; el.dataset.hs = ''; }
  const selEl = el.querySelector('.sel'), tilesEl = el.querySelector('.tiles'), pagerEl = el.querySelector('.pager'), cmdEl = el.querySelector('.cmd');
  el.classList.toggle('wide', !items.length);
  if (el.dataset.hs !== head + hbtns || force) { el.dataset.hs = head + hbtns; selEl.innerHTML = head; }
  CARD = items.map(i => i.fn); CARD.hb = hb;
  // pages: as many columns as fit, two rows
  const pkey = us.length ? 'u' + us.length + ':' + us[0].id : b ? 'b' + b.id : selPad ? 'p' + selPad.pt + ':' + selPad.slot : 'n';
  if (UI.pageKey !== pkey) { UI.pageKey = pkey; UI.page = 0; }
  const cw = cmdEl.clientWidth || 600; let cols = Math.max(1, Math.floor((cw - 20 + 6) / 86)); let cells = 0; for (const o of items) cells += o.big ? 4 : 1;
  let pages = 1; if (cells > cols * 2) { cols = Math.max(1, Math.floor((cw - 20 - 34 + 6) / 86)); pages = Math.ceil(cells / (cols * 2)); }
  UI.page = clamp(UI.page || 0, 0, pages - 1);
  const per = cols * 2, vis = []; { let c = 0, pg = 0; items.forEach((o, i) => { const n = o.big ? 4 : 1; if (c + n > per) { pg++; c = 0; } if (pg === UI.page) vis.push([o, i]); c += n; }); }
  tilesEl.style.gridTemplateColumns = 'repeat(' + cols + ',80px)';
  vis.forEach(([o, i], k) => {
    let t = tilesEl.children[k]; const key = (o.key || o.nm) + (o.big ? '*' : '');
    if (!t || t.dataset.key2 !== key) { const n = document.createElement('div'); n.dataset.key2 = key; if (t) tilesEl.replaceChild(n, t); else tilesEl.appendChild(n); t = n; t.dataset.s = ''; }
    const cls = 'tile card' + (o.big ? ' tbig' : '') + (o.off ? ' off' : '') + (o.lock ? ' lock' : '') + (o.on ? ' on' : '') + (o.go ? ' go' : '');
    if (t.className !== cls) t.className = cls;
    t.dataset.i = i; t.dataset.key = o.key || ''; const tip = o.tip || o.nm; if (t.dataset.tip !== tip) t.dataset.tip = tip;
    const inner = tileHtml(o); if (t.dataset.s !== inner) { t.dataset.s = inner; t.innerHTML = inner; }
  });
  while (tilesEl.children.length > vis.length) tilesEl.lastChild.remove();
  const pg = pages > 1 ? '<button data-pg="-1"' + (UI.page <= 0 ? ' disabled' : '') + ' data-tip="Previous page">&#9650;</button><span class="pi">' + (UI.page + 1) + '/' + pages + '</span><button data-pg="1"' + (UI.page >= pages - 1 ? ' disabled' : '') + ' data-tip="More">&#9660;</button>' : '';
  if (pagerEl.dataset.s !== pg) { pagerEl.dataset.s = pg; pagerEl.innerHTML = pg; }
  renderSpec();
}
function renderSpec() {
  const b = selBld ? W.byId.get(selBld) : null, p = P(ME); let sp = $('#specp');
  if (!(UI.specOpen && b && b.owner === ME && b.lvl >= 3 && !b.spec && !b.upg)) { if (sp) sp.remove(); return; }
  const T = btx(b.type, bFac(b)); const sg = 'spec' + b.id + (p.sup >= SPEC_COST ? 1 : 0);
  if (!sp) { sp = document.createElement('div'); sp.id = 'specp'; sp.className = 'pop'; $('#hud').appendChild(sp); sp.addEventListener('click', e => { const c = e.target.closest('[data-sp]'); if (!c) return; const bb = W.byId.get(selBld); if (c.dataset.sp === 'x') { UI.specOpen = false; UI.cardSig = ''; hudUpdate(true); return; } if (bb && issue({ k: 'spec', b: bb.id, s: c.dataset.sp })) { UI.did.spec = 1; sfx('done'); } else { sfx('deny'); toast('You need ' + SPEC_COST + ' money for this.'); } UI.specOpen = false; UI.cardSig = ''; hudUpdate(true); }); }
  if (sp.dataset.k === sg) return; sp.dataset.k = sg;
  sp.innerHTML = '<div class="row" style="justify-content:space-between;margin-bottom:8px"><b style="color:#ffe2a6;font-size:17px">Choose 1 of 3 upgrades for your ' + T.n + '</b><button class="sm" data-sp="x">Cancel</button></div><div class="spgrid">' + T.specs.map(s => '<div class="spc' + (p.sup < SPEC_COST && !W.o.sandbox ? ' off' : '') + '" data-sp="' + s.id + '"><b>' + s.n + '</b>' + s.d + '<div style="margin-top:6px;color:#f6c04e;font-weight:800">' + ic('coin') + ' ' + SPEC_COST + '</div></div>').join('') + '</div><div class="note" style="margin-top:6px">You can only pick once, so choose what your army needs.</div>';
}
// ----- tooltip -----
function showTip(t, e) {
  const tip = $('#tip'); if (!t || !t.dataset.tip || (!inGame && !t.closest('#menus')) || UI.ptrType === 'touch') { tip.classList.add('hidden'); return; }
  const parts = t.dataset.tip.split('|').filter(Boolean); const k = t.dataset.tip; if (tip.dataset.k !== k) { tip.dataset.k = k; tip.innerHTML = '<b>' + esc(parts[0]) + '</b>' + parts.slice(1).map(s => '<div style="color:#cdd8e6">' + esc(s) + '</div>').join(''); }
  tip.classList.remove('hidden'); const w = tip.offsetWidth, h = tip.offsetHeight; let x = e.clientX + 14, y = e.clientY - h - 14; if (x + w > window.innerWidth - 6) x = window.innerWidth - w - 6; if (y < 6) y = e.clientY + 20; tip.style.left = x + 'px'; tip.style.top = y + 'px';
}
function showTouchBtns(on) {
  const tb = $('#touchbtns'); if (!on) { tb.classList.add('hidden'); return; } tb.classList.add('hidden'); UI.touch = true; lastQuick = '';
}
// =====================================================================
//  MENUS
// =====================================================================
const MENU = () => $('#menus');
let SCREEN = '', PREV = {}, SK = null, techOpen = false, CODEXTAB = 'units', BACKSCREEN = 'main', PAUSEDBYHELP = false;
const SUPPLY_OPT = { low: 300, normal: 600, high: 1200, rich: 3000 };
function defaultSK() { return { map: 'greenfield', type: '1v1', diff: 'easy', style: 'mixed', more: false, custom: false, seed: 0, fac: SET.fac | 0, efac: SET.efac || 'auto', slots: [{ kind: 'human', team: 0 }, { kind: 'ai', pers: 'hale', diff: 'easy', team: 1, fac: 'auto' }, { kind: 'closed', pers: 'vex', diff: 'easy', team: 2, fac: 'auto' }, { kind: 'closed', pers: 'stone', diff: 'easy', team: 3, fac: 'auto' }], tickets: 400, supplies: 'normal', fog: false, speed: 1, maxPop: 120, tod: 'map', wx: 'map' }; }
function applySimple(S) {
  const n = mapDef(S.map).maxP, pool = ['hale', 'vex', 'stone', 'kruger', 'voss', 'kael']; if (n < 3) S.type = '1v1';
  const T = S.slots;
  if (S.custom) { T[0].team = 0; T[0].kind = 'human'; for (let i = n; i < 4; i++) T[i].kind = 'closed'; if (!T.slice(1, n).some(x => x.kind === 'ai')) T[1].kind = 'ai'; if (T[1].team === 0 && !T.slice(1, n).some(x => x.kind === 'ai' && x.team !== 0)) T[1].team = 1; return; }
  for (let i = 1; i < 4; i++) { T[i].diff = S.diff; T[i].pers = S.style === 'mixed' ? pool[(i * 2 + (S.seed | 0)) % pool.length] : S.style; if (T[i].kind !== 'remote') T[i].fac = 'auto'; }   // quick setup: armies come from 'Enemy armies'
  if (S.type === '1v1') { T[0].team = 0; T[1].kind = 'ai'; T[1].team = 1; T[2].kind = 'closed'; T[3].kind = 'closed'; }
  else if (S.type === '2v2') { T[1].kind = T[2].kind = T[3].kind = 'ai'; T[0].team = 0; T[1].team = 0; T[2].team = 1; T[3].team = 1; }
  else { T[0].team = 0; for (let i = 1; i < 4; i++) { T[i].kind = 'ai'; T[i].team = i; } }
}
function mapDef(id) { return MAPS.find(m => m.id === id) || MAPS[0]; }
function mapPreview(id) {
  if (PREV[id]) return PREV[id]; const d = mapDef(id); const M = genMap(d); const cv = document.createElement('canvas'); cv.width = 132; cv.height = Math.round(132 * d.d / d.w); const c = cv.getContext('2d'); const im = c.createImageData(cv.width, cv.height); const tmp = [0, 0, 0];
  for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) { const wx = x / cv.width * M.w - M.hw, wz = y / cv.height * M.d - M.hd, h = M.H(wx, wz); let r, g, b; if (h < M.wl - .05) { _c4.set(M.biome.water); r = _c4.r * .9; g = _c4.g * .95; b = _c4.b; } else { terrainColor(M, wx, wz, h, M.slope(wx, wz), tmp); r = tmp[0]; g = tmp[1]; b = tmp[2]; } const i = (y * cv.width + x) * 4; im.data[i] = r * 255; im.data[i + 1] = g * 255; im.data[i + 2] = b * 255; im.data[i + 3] = 255; }
  c.putImageData(im, 0, 0); for (const p of M.points) { c.beginPath(); c.arc((p.x + M.hw) / M.w * cv.width, (p.z + M.hd) / M.d * cv.height, p.hq >= 0 ? 4.5 : 3, 0, TAU); c.fillStyle = p.hq >= 0 ? '#ffd24a' : '#fff'; c.fill(); c.strokeStyle = '#000a'; c.stroke(); }
  return PREV[id] = cv.toDataURL();
}
function seg(k, opts, cur, act) { return '<div class="seg">' + opts.map(o => '<button class="' + (String(o[0]) === String(cur) ? 'on' : '') + '" data-act="' + (act || 'opt') + '" data-k="' + k + '" data-v="' + o[0] + '">' + o[1] + '</button>').join('') + '</div>'; }
function sel(k, opts, cur, act, extra) { return '<select data-act="' + (act || 'optsel') + '" data-k="' + k + '" ' + (extra || '') + '>' + opts.map(o => '<option value="' + o[0] + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>'; }
function showScreen(name, arg) {
  { const ln = GVL.name(); if (ln && SET.name !== ln.slice(0, 14)) SET.name = ln.slice(0, 14); }   // the Grapevine name wins
  SCREEN = name; const m = MENU(); closeTech(); $('#tip').classList.add('hidden');
  const fn = SCREENS[name]; if (!fn) { m.innerHTML = ''; return; }
  const html = fn(arg); m.innerHTML = html; const ao = m.querySelector('[data-autofocus]'); if (ao) setTimeout(() => ao.focus(), 30); if (SCREENS_AFTER[name]) SCREENS_AFTER[name](arg);
}
function closeScreen() { SCREEN = ''; MENU().innerHTML = ''; }
const SCREENS = {}, SCREENS_AFTER = {};
SCREENS.main = () => {
  const r = rankOf(PROF.xp), first = !PROF.tutDone;
  return `<div class="scr"><div class="panel" style="width:min(430px,96vw);background:rgba(10,15,22,.88)">
  <div class="title">FRONTLINE</div><div class="sub">Command</div><div class="note" style="text-align:center;margin:-4px 0 6px;color:#d9c79a"><i>${esc(LORE.world.tagline)}</i></div>
  <button class="mbtn go" data-act="war" style="font-size:20px">Endless War${WAR ? ': Wave ' + WAR.wave : ''}<small>${WAR ? 'Your Bastion is waiting. Best wave: ' + WAR.best : 'Build a huge fortress and hold it against wave after wave. Everything saves.'}</small></button>
  <button class="mbtn" data-act="tutorial">${first ? 'New? Start here: ' : ''}Tutorial<small>Learn the game in about 3 minutes</small></button>
  <button class="mbtn" data-act="campaign">Campaign${CAMP && !CAMP.over ? ': Continue' : ''}<small>${CAMP && !CAMP.over ? 'Operation ' + esc(CAMP.name) + ' - stage ' + (CAMP.stage + 1) + ' of ' + CSTAGES : 'A run of ' + CSTAGES + ' different missions. Earn Doctrines as you win.'}</small></button>
  <button class="mbtn" data-act="skirmish">Quick Battle<small>Pick a map and an enemy commander</small></button>
  <button class="mbtn" data-act="mp">Play a Friend Online<small>Share a 6-digit code. 1 vs 1.</small></button>
  <div class="row" style="gap:6px;margin-top:6px"><button class="mbtn" style="flex:1;margin:0;text-align:center;font-size:15px;padding:10px 4px" data-act="help">How to Play</button><button class="mbtn" style="flex:1;margin:0;text-align:center;font-size:15px;padding:10px 4px" data-act="settings">Settings</button><button class="mbtn${genFree() > 0 ? ' gnew' : ''}" style="flex:1;margin:0;text-align:center;font-size:15px;padding:10px 4px" data-act="general">General${genFree() > 0 ? ' <span class="gbadge">' + genFree() + '</span>' : ''}</button></div>
  <div class="row" style="gap:6px;margin-top:6px"><button class="mbtn" style="flex:1;margin:0;text-align:center;font-size:14px;padding:8px 4px;min-height:44px" data-act="codex">Field Guide</button><button class="mbtn" style="flex:1;margin:0;text-align:center;font-size:14px;padding:8px 4px;min-height:44px" data-act="sandbox">Sandbox</button><button class="mbtn" style="flex:1;margin:0;text-align:center;font-size:14px;padding:8px 4px;min-height:44px" data-act="profile">Profile</button></div>
  ${PROF.games > 0 && PROF.seenVer !== VERSION ? `<div class="note" style="margin-top:10px;padding:8px 10px;border:1px solid #3a566f;border-radius:10px;background:#0d1a28"><b style="color:#ffe2a6">New in ${VERSION}:</b> the Iron Legion, warships, night and weather, General perks. <button class="sm" data-act="news">See everything</button> <button class="sm" data-act="newsok">Got it</button></div>` : ''}
  <div class="note" style="text-align:center;margin-top:12px">${esc(SET.name)} - <b style="color:#ffe2a6">${RANKS[r][0]}</b> - ${PROF.wins} wins - v${VERSION} <button class="sm" data-act="news" style="margin-left:4px">What's new</button></div></div></div>`;
};
SCREENS.welcome = () => `<div class="scr bg"><div class="panel" style="width:min(460px,96vw);text-align:center">
  <div class="title" style="font-size:clamp(30px,6vw,46px)">WELCOME</div><div class="sub">Commander</div>
  <div class="note" style="font-size:16px;color:#e6eef7">Your job is simple: <b style="color:#ffe2a6">capture flags</b>. Hold more flags than the enemy and they run out of score.</div>
  <button class="mbtn go" style="margin-top:16px" data-act="tutorial">Play the tutorial<small>Short and easy. Recommended for new players.</small></button>
  <button class="mbtn" data-act="skiptut">Skip, I will learn as I play</button></div></div>`;
SCREENS.skirmish = () => {
  const d = mapDef(SK.map), n = d.maxP; const mc = MAPS.map(m => `<div class="mc ${m.id === SK.map ? 'on' : ''}" data-act="map" data-v="${m.id}"><img src="${mapPreview(m.id)}"/>${m.name}<small>${m.maxP === 2 ? '2 players' : 'up to 4 players'}${m.naval ? ', ships' : ''}${m.tod === 'night' ? ', night' : ''}${m.wx ? ', ' + WXD[m.wx].n.toLowerCase() : ''}</small></div>`).join('');
  const dd = { easy: 'Slow and forgiving. Great for learning.', normal: 'A fair fight. Attacks late, in small waves, and gives you warning.', hard: 'Smarter and quicker. Expands, counters your army, attacks in waves.', brutal: 'Very hard. Quick, focused and gets a little extra money.' }[SK.diff];
  const adv = SK.more ? `<div class="row" style="gap:18px;margin-top:8px"><div><div class="lbl">Enemies</div>${seg('custom', [[0, 'Quick setup'], [1, 'Customize each']], SK.custom ? 1 : 0, 'scustom')}</div><div><div class="lbl">Starting score</div>${seg('tickets', [[200, '200'], [400, '400'], [700, '700'], [1000, '1000']], SK.tickets)}</div>
  <div><div class="lbl">Starting money</div>${seg('supplies', [['low', 'Low'], ['normal', 'Normal'], ['high', 'High'], ['rich', 'Rich']], SK.supplies)}</div>
  <div><div class="lbl">Fog of war</div>${seg('fog', [[1, 'On'], [0, 'Off']], SK.fog ? 1 : 0)}</div>
  <div><div class="lbl">Game speed</div>${seg('speed', [[1, 'Normal'], [1.5, 'Fast'], [2, 'Faster']], SK.speed)}</div>
  <div><div class="lbl">Army limit</div>${seg('maxPop', [[80, '80'], [120, '120'], [160, '160']], SK.maxPop)}</div>
  <div><div class="lbl">Field events</div>${seg('events', [[1, 'On'], [0, 'Off']], SK.events === false ? 0 : 1)}</div></div>` : '';
  return `<div class="scr bg"><div class="panel" style="width:min(860px,98vw)"><div class="row" style="justify-content:space-between"><h2 style="margin:0;color:#ffe2a6">Play vs Computer</h2><button class="tbtn" data-act="back">Back</button></div>
  <div class="lbl">1. Pick a map</div><div class="mapcards">${mc}</div><div class="note" style="margin-top:6px">${esc(d.desc)}</div>
  <div class="row" style="gap:18px;align-items:flex-start"><div><div class="lbl">Time of day</div>${seg('tod', [['map', 'Map: ' + TODD[d.tod || 'day'].n], ['day', 'Day'], ['night', 'Night'], ['random', 'Random']], SK.tod || 'map', 'swx')}</div><div><div class="lbl">Weather</div>${seg('wx', [['map', 'Map: ' + WXD[d.wx || 'clear'].n], ['clear', 'Clear'], ['rain', 'Rain'], ['fog', 'Fog'], ['snow', 'Snow'], ['random', 'Random']], SK.wx || 'map', 'swx')}</div></div>${skWxNote(d)}
  ${SK.custom ? `<div class="lbl">2. Players</div>${skRowsHtml()}<div class="note" style="margin-top:5px">Pick each commander, how hard they are, and which team they are on. Put players on different teams to fight.</div>` : `${n > 2 ? `<div class="lbl">2. Game type</div>${seg('type', [['1v1', '1 vs 1'], ['2v2', '2 vs 2 (you + 1 helper)'], ['ffa', 'Everyone for themselves']], SK.type, 'stype')}` : ''}
  <div class="lbl">${n > 2 ? '3' : '2'}. How hard is the enemy?</div>${seg('diff', Object.entries(AID).map(([k, v]) => [k, v.n]), SK.diff, 'sdiff')}<div class="note" style="margin-top:5px">${dd}</div>
  <div class="lbl">${n > 2 ? '4' : '3'}. Enemy style</div>${sel('style', [['mixed', 'Surprise me'], ...Object.values(AIP).map(p => [p.id, p.name + ' - ' + p.title])], SK.style, 'sstyle')}`}
  ${armiesHtml(!SK.custom)}
  <div style="margin-top:12px"><button class="tbtn" data-act="moreopt">${SK.more ? 'Hide' : 'Show'} extra options</button></div>${adv}
  <div class="stick"><button class="mbtn go" style="margin:0" data-act="startsk">Start Battle<small>Goal: capture flags and hold more than the enemy</small></button></div></div></div>`;
};
function skRowsHtml() {
  const n = mapDef(SK.map).maxP, colors = assignColors(SK); let rows = '';
  for (let i = 0; i < n; i++) {
    const sl = SK.slots[i]; rows += `<div class="slot"><span class="cdot" style="background:${hex3(PCOL[colors[i]].c)}"></span>`;
    if (i === 0) rows += `<b style="min-width:130px">${esc(SET.name)} (You)</b><span class="note" style="min-width:86px">${FACS[SK.fac | 0].n}</span>`;
    else rows += sel('kind' + i, [['ai', 'AI Commander'], ['closed', 'Closed']], sl.kind, 'slotkind', 'data-i="' + i + '"');
    if (sl.kind === 'ai') rows += sel('pers' + i, Object.values(AIP).map(p => [p.id, p.name + ' - ' + p.title]), sl.pers, 'slotpers', 'data-i="' + i + '"') + sel('diff' + i, Object.entries(AID).map(([k, v]) => [k, v.n]), sl.diff, 'slotdiff', 'data-i="' + i + '"') + slotFacSel(sl, i);
    if (sl.kind !== 'closed') rows += sel('team' + i, [[0, 'Team A'], [1, 'Team B'], [2, 'Team C'], [3, 'Team D']], sl.team, 'slotteam', 'data-i="' + i + '"');
    rows += '</div>';
  }
  return rows;
}
function assignColors(S) {
  const used = new Set(), out = []; const mine = PROF.color || 0; out[0] = mine; used.add(mine);
  for (let i = 1; i < 4; i++) { let c = 0; while (used.has(c)) c++; used.add(c); out[i] = c; } return out;
}
function skToCfg(S, mpRemote) {
  const d = mapDef(S.map); const colors = assignColors(S); const players = [];
  for (let i = 0; i < d.maxP; i++) {
    const s = S.slots[i]; if (!s || s.kind === 'closed') continue;
    const o = { team: s.team, color: PCOL[colors[i]].c };
    if (i === 0) { o.kind = 'human'; o.name = SET.name; o.fac = S.fac === 1 ? 1 : 0; }
    else if (s.kind === 'remote') { o.kind = 'remote'; o.name = s.name || 'Friend'; o.fac = s.fac === 1 ? 1 : 0; }
    else { o.kind = 'ai'; o.name = AIP[s.pers].name; o.ai = { pers: s.pers, diff: s.diff }; o.fac = aiFac(S, s); }
    players.push(o);
  }
  const wc = pickWx(d, S.tod, S.wx);   // 3.0 battle conditions
  return { map: S.map, players, tickets: S.tickets, supplies: SUPPLY_OPT[S.supplies], fog: !!S.fog, speed: S.speed, maxPop: S.maxPop, events: S.events !== false, tod: wc.tod, weather: wc.weather };
}
// 3.0 armies: an AI slot set to 'auto' follows 'Enemy armies' in the quick setup (auto = the commander's own army: Legate Kael leads the Iron Legion).
// Custom player lists and online lobbies pick each slot's army on its own row, so there 'auto' is always the commander's own army.
function aiFac(S, s) { if (s.fac === 0 || s.fac === 1) return s.fac; const e = !S.custom && NET.role !== 'host' ? S.efac || 'auto' : 'auto'; return e === 'banner' ? 0 : e === 'legion' ? 1 : e === 'random' ? (Math.random() < .5 ? 1 : 0) : ((AIP[s.pers] && AIP[s.pers].fac) | 0); }
function slotFacSel(sl, i) { return sel('fac' + i, [['auto', 'Own army'], [0, 'Banner Army'], [1, 'Iron Legion']], sl.fac === 0 || sl.fac === 1 ? sl.fac : 'auto', 'slotfac', 'data-i="' + i + '" data-tip="Army|Own army: Legate Kael leads the Iron Legion, the other commanders lead Banner armies."'); }
function armiesHtml(withEnemy) {
  return `<div class="row" style="gap:18px;align-items:flex-start"><div><div class="lbl">Your army</div>${seg('fac', FACS.map(f => [f.id, f.n]), SK.fac | 0, 'sfac')}</div>${withEnemy ? `<div><div class="lbl">Enemy armies</div>${seg('efac', [['auto', 'Their own'], ['banner', 'Banner'], ['legion', 'Iron Legion'], ['random', 'Random']], SK.efac || 'auto', 'sefac')}</div>` : ''}</div><div class="note" style="margin-top:4px">${esc(FACS[SK.fac | 0].n + ': ' + FACS[SK.fac | 0].d)}</div>`;
}
function skWxNote(d) {   // what the picked conditions do (random picks are explained when the battle starts)
  const t = SK.tod === 'day' || SK.tod === 'night' ? SK.tod : SK.tod === 'random' ? '' : d.tod || 'day', w = WXD[SK.wx] ? SK.wx : SK.wx === 'random' ? '' : d.wx || 'clear';
  const tx = [t === 'night' ? TODD.night.d : '', w && w !== 'clear' ? WXD[w].d : '', SK.tod === 'random' || SK.wx === 'random' ? 'Random: the conditions are rolled when the battle starts.' : ''].filter(Boolean).join(' ');
  return tx ? '<div class="note" style="margin-top:4px;color:#bcd3ee">' + esc(tx) + '</div>' : '';
}
function validSK(S) { const c = skToCfg(S); if (c.players.length < 2) return 'Add at least one opponent.'; const teams = new Set(c.players.map(p => p.team)); if (teams.size < 2) return 'Put at least two players on different teams.'; return ''; }
SCREENS.settings = () => {
  const o = (k, a) => seg(k, a, SET[k] ? 1 : 0, 'setb');
  const adv = SET.adv ? `<div class="lbl">Shadows</div>${o('shadows', [[1, 'On'], [0, 'Off']])}
  <div class="lbl">Effects (smoke, sparks): <b id="v_particles">${SET.particles}%</b></div><input type="range" min="0" max="150" step="5" value="${SET.particles}" data-act="rng" data-k="particles">
  <div class="lbl">Sharpness: <b id="v_scale">${SET.scale}%</b></div><input type="range" min="50" max="100" step="5" value="${SET.scale}" data-act="rng" data-k="scale">
  <div class="lbl">Trees and rocks: <b id="v_decor">${SET.decor}%</b></div><input type="range" min="0" max="100" step="5" value="${SET.decor}" data-act="rng" data-k="decor">
  <div class="lbl">Most units per player: <b id="v_maxUnits">${SET.maxUnits}</b></div><input type="range" min="60" max="400" step="10" value="${SET.maxUnits}" data-act="rng" data-k="maxUnits"><div class="note">Quick Battles and the Campaign only. Endless War always allows up to 320.</div>` : '';
  return `<div class="scr bg"><div class="panel" style="width:min(580px,98vw)"><div class="row" style="justify-content:space-between"><h2 style="margin:0;color:#ffe2a6">Settings</h2><button class="tbtn" data-act="back2">Back</button></div>
  <div class="lbl">Graphics</div>${seg('gfx', [['auto', 'Auto'], ['low', 'Fast'], ['medium', 'Normal'], ['high', 'Pretty']], SET.gfx === 'custom' ? '' : SET.gfx, 'gfxp')}
  <div class="note" style="margin-top:4px">Auto picks the best setting for your computer and adjusts if the game gets slow. Choose Fast on a school laptop.</div>
  <div class="lbl">Sound volume: <b id="v_vol">${SET.vol}%</b></div><input type="range" min="0" max="100" step="5" value="${SET.vol}" data-act="rng" data-k="vol">
  <div class="lbl">Music volume: <b id="v_music">${SET.music}%</b></div><input type="range" min="0" max="100" step="5" value="${SET.music}" data-act="rng" data-k="music">
  <div class="lbl">Camera speed: <b id="v_camSpd">${SET.camSpd}x</b></div><input type="range" min="0.5" max="2" step="0.1" value="${SET.camSpd}" data-act="rng" data-k="camSpd">
  <div class="row" style="gap:18px"><div><div class="lbl">Scroll with mouse edges</div>${o('edge', [[1, 'On'], [0, 'Off']])}</div><div><div class="lbl">Mouse wheel</div>${seg('scroll', [['pan', 'Moves the map'], ['zoom', 'Zooms']], SET.scroll === 'zoom' ? 'zoom' : 'pan', 'setv')}</div></div>
  <div class="lbl">Screen buttons size</div>${seg('uiSize', [['s', 'Small'], ['m', 'Normal'], ['l', 'Large']], SET.uiSize || 'm', 'setv')}
  <div class="row" style="gap:18px"><div><div class="lbl">Health bars</div>${seg('hpAlways', [[0, 'When hurt'], [1, 'Always']], SET.hpAlways ? 1 : 0, 'setb')}</div><div><div class="lbl">Show FPS</div>${o('fps', [[1, 'On'], [0, 'Off']])}</div></div>
  <div class="lbl">Commander name</div><input type="text" maxlength="14" value="${esc(SET.name)}" data-act="name"${GVL.name() ? ' readonly' : ''}>${GVL.name() ? '<div class="note">Your Grapevine name.</div>' : ''}
  <div style="margin-top:14px"><button class="tbtn" data-act="adv">${SET.adv ? 'Hide' : 'Show'} advanced graphics</button></div>${adv}</div></div>`;
};
SCREENS.profile = () => {
  const r = rankOf(PROF.xp), nxt = RANKS[r + 1]; const pct = nxt ? (PROF.xp - RANKS[r][1]) / (nxt[1] - RANKS[r][1]) * 100 : 100;
  let ach = ''; for (const k in ACH) ach += `<div class="ach ${PROF.ach[k] ? 'ok' : ''}"><span style="font-size:18px">${PROF.ach[k] ? '&#9733;' : '&#9734;'}</span><div><b>${ACH[k][0]}</b><br><i>${ACH[k][1]}</i></div></div>`;
  const cols = PCOL.map((c, i) => `<div class="mc" style="width:76px;${PROF.color === i ? 'border-color:#f6c04e' : ''};${r < c.rank ? 'opacity:.4' : ''}" data-act="color" data-v="${i}"><div style="height:24px;border-radius:5px;background:${hex3(c.c)}"></div>${c.n}${r < c.rank ? '<small>' + RANKS[c.rank][0] + '</small>' : ''}</div>`).join('');
  return `<div class="scr bg"><div class="panel" style="width:min(720px,98vw)"><div class="row" style="justify-content:space-between"><h2 style="margin:0;color:#ffe2a6">Commander Profile</h2><button class="tbtn" data-act="back2">Back</button></div>
  <div style="font-size:22px;margin-top:6px"><b style="color:#ffe2a6">${RANKS[r][0]}</b> ${esc(SET.name)}</div><div class="hpbar" style="height:11px;width:100%"><i style="width:${pct}%;background:#f6c04e"></i></div><div class="note">${PROF.xp} XP ${nxt ? '- next rank ' + nxt[0] + ' at ' + nxt[1] : '- top rank'}</div>
  <div class="kv" style="margin-top:10px"><span>Battles</span><b>${PROF.games}</b><span>Victories</span><b>${PROF.wins}</b><span>Defeats</span><b>${PROF.losses}</b><span>Online battles / wins</span><b>${PROF.mp} / ${PROF.mpWins}</b><span>Enemies destroyed</span><b>${PROF.kills}</b><span>Troops lost</span><b>${PROF.lost}</b><span>Buildings built</span><b>${PROF.built}</b><span>Flags captured</span><b>${PROF.captured}</b><span>Time in command</span><b>${fmtTime(PROF.time)}</b><span>Fastest win</span><b>${PROF.best ? fmtTime(PROF.best) : '-'}</b></div>
  <div class="lbl">Army color (unlocks with rank)</div><div class="mapcards">${cols}</div>
  <div class="lbl">Achievements</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:5px">${ach}</div></div></div>`;
};
// 3.0 What's new: the highlights of the whole 3.0 update
const NEWS30 = [
  ['A second army: the Iron Legion', 'Pick it on the Quick Battle screen, for an Endless War, online or in the Sandbox. 24 Legion troops (shielded Legionaries, Lancers, Jump Troopers that jet over walls, Arc Troopers, Praetorians, Combat Mechs, Hover Tanks, Warmechs, the Siege Titan, Drone Swarms, Wraiths and more), each with its own model, its own buildings look, 7 Legion upgrades and Drop Pod / Mech Drop support powers. Enemy commanders can lead it too, and the new commander Legate Kael leads it by default.'],
  ['Energy shields and energy weapons', 'Legion troops carry shields that take hits first and recharge out of combat (Tesla towers and Arc Troopers drain them twice as fast). Pulse, plasma and rail weapons have their own tracers, bolts, blasts and sounds.'],
  ['Warships and five new maps', 'Lighthouse Bay, Coral Straits and Harbor Run are coastal maps: flags by the sea have an anchor pad for a Shipyard that builds Gunboats, Landing Craft and Destroyers (Hydrofoils, Assault Barges and Leviathans for the Legion). Ships sail only on deep water; Landing Craft carry 8 soldiers to islands and beaches. The computer commanders build fleets and land troops too. Glacier Pass (a blizzard) and Moonlit Mesa (a night battle) complete the five.'],
  ['Night battles and weather', 'Pick Day or Night, and Clear, Rain, Fog or Snow on the Quick Battle screen (or let the map choose). Night and fog shorten everyone\'s sight; muzzle flashes give shooters away, vehicles drive with headlights, HQs and towers sweep searchlights. Rain bogs vehicles down and brings lightning; snow slows everyone. Some Campaign missions and Endless War waves now come at night or in a storm.'],
  ['General perks', 'Your commander XP now earns General points. Spend them on 18 perks in three branches (Economy, Assault, Defense) from the General button on the main menu. They work in Quick Battles, the Campaign and Endless War (which now gives XP for every wave won), and are off in online battles. Resetting is free.'],
  ['Also new', 'Six new achievements (Iron Will, Admiral, Night Owl, Storm Chaser, Island Hopper, Five Stars), a Legion chapter and new battlefields in the Field Guide story, a Banner / Iron Legion switch on every Field Guide page, and a How to Play card about ships, night and weather.']
];
SCREENS.news = () => `<div class="scr bg"><div class="panel" style="width:min(760px,98vw)"><div class="row" style="justify-content:space-between"><h2 style="margin:0;color:#ffe2a6">What's new in ${VERSION}</h2><button class="tbtn" data-act="newsok">Got it</button></div>
  ${NEWS30.map(n => '<div class="ach" style="margin-top:7px;align-items:flex-start"><span style="font-size:18px;color:#ffe2a6">&#9733;</span><div><b>' + esc(n[0]) + '</b><br><i style="color:#cfdbe8">' + esc(n[1]) + '</i></div></div>').join('')}</div></div>`;
// 3.0 General perks: spend the points your commander XP earns
SCREENS.general = () => {
  const G = PROF.gen, pts = genPts(PROF.xp), free = pts - genSpent(G), nxt = genXp(pts + 1), prv = genXp(pts), pct = clamp((PROF.xp - prv) / Math.max(1, nxt - prv) * 100, 0, 100);
  const col = B => {
    const sp = genSpent(G, B.id); let h = '<div class="gcol"><h5 style="color:' + B.c + '">' + B.n + ' <span class="note">(' + sp + ' spent)</span></h5><div class="note" style="margin:-2px 0 8px">' + esc(B.d) + '</div>';
    for (let t = 1; t <= 3; t++) {
      const open = sp >= GEN_TIER[t]; h += '<div class="gtier">' + (open ? '' : '<div class="glock">Needs ' + GEN_TIER[t] + ' points in ' + B.n + '</div>');
      for (const g of GEN.filter(x => x.br === B.id && x.tier === t)) {
        const r = G[g.id] | 0, why = genCanBuy(g.id), pips = '<span class="pips">' + Array.from({ length: g.max }, (_, i) => '<i class="' + (i < r ? 'on' : '') + '" style="' + (i < r ? 'background:' + B.c : '') + '"></i>').join('') + '</span>';
        h += '<button class="gcard' + (r ? ' have' : '') + (r >= g.max ? ' max' : '') + (why && why !== 'max' ? ' off' : '') + '" data-act="genbuy" data-v="' + g.id + '" style="--gc:' + B.c + '"><b>' + esc(g.n) + pips + '</b><span>' + esc(g.d(Math.max(1, r))) + '</span>' + (r && r < g.max ? '<span class="gnext">Next rank: ' + esc(g.d(r + 1)) + '</span>' : '') + '<span class="gst">' + (r >= g.max ? 'Maxed' : why === 'tier' ? 'Locked' : why === 'pts' ? 'Need a point' : r ? 'Rank up (1 point)' : 'Get it (1 point)') + '</span></button>';
      }
      h += '</div>';
    }
    return h + '</div>';
  };
  return `<div class="scr bg"><div class="panel" style="width:min(1000px,98vw)"><div class="row" style="justify-content:space-between"><h2 style="margin:0;color:#ffe2a6">General Perks</h2><button class="tbtn" data-act="back2">Back</button></div>
  <div class="row" style="gap:14px;margin-top:6px;align-items:center;flex-wrap:wrap"><div style="font-size:20px"><b style="color:#ffe2a6">${RANKS[rankOf(PROF.xp)][0]}</b> ${esc(SET.name)}</div><div class="gpts"><b>${free}</b> point${free === 1 ? '' : 's'} to spend</div><div class="note">${pts} earned from ${PROF.xp} commander XP. Next point at ${nxt} XP.</div></div>
  <div class="hpbar" style="height:9px;width:100%;margin-top:6px"><i style="width:${pct}%;background:#8fd0ff"></i></div>
  <div class="note" style="margin-top:6px">Win (or just fight) battles to earn commander XP; every few hundred XP gives a point. Perks work in Quick Battles, the Campaign and Endless War. They are switched off in online battles, so those stay fair. You can reset them for free at any time.</div>
  <div class="ggrid">${GEN_BR.map(col).join('')}</div>
  <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="tbtn" data-act="genreset">Reset all perks (free)</button></div></div></div>`;
};
let CODEXFAC = 0;   // 3.0: which army the Field Guide shows
SCREENS.codex = () => {
  let body = ''; const facNote = '<div class="row" style="margin:0 0 8px">' + seg('cfac', FACS.map(f => [f.id, f.n]), CODEXFAC, 'cfac') + '<span class="note" style="margin-left:8px">' + esc(FACS[CODEXFAC].d) + '</span></div>';
  if (CODEXTAB === 'units') {
    body = facNote + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:7px">' + UTORD.filter(k => facOfT(UT[k]) === CODEXFAC || UT[k].nobuild).map(k => { const T = UT[k], w = T.w; const src = T.nobuild ? 'Free with the Hire Mercenaries power' : 'Cost ' + T.cost + ' - made at the ' + T.src.filter(s => s[0] !== 'hq' || T.src.length === 1).map(s => { const B = BT[s[0]], sp = s[2] ? B.specs.find(x => x.id === s[2]) : null; return B.n + (s[1] > 1 || sp ? ' (' + (s[1] > 1 ? 'Level ' + s[1] : '') + (s[1] > 1 && sp ? ', ' : '') + (sp ? sp.n + ' upgrade' : '') + ')' : ''); }).join(' or '); return `<div class="ach" style="align-items:flex-start"><div class="chip" style="width:52px;height:52px;${iconStyle(k)}"></div><div><b>${T.n}</b> <i>${T.role}</i><br>${T.info}<br>${LORE.units[k] ? '<i style="color:#d9c79a">' + esc(LORE.units[k]) + '</i><br>' : ''}<i>${w ? strongWeak(w) : ''}</i>${unitExtra(T).split('|').filter(Boolean).map(x => '<br><i style="color:#8fe8ff">' + esc(x) + '</i>').join('')}<br><i>${src}</i></div></div>`; }).join('') + '</div>';
  } else if (CODEXTAB === 'buildings') {
    body = facNote + (CODEXFAC === 1 ? '<div class="note" style="margin-bottom:6px;color:#d9c79a"><i>' + esc(LORE.legionBuildings) + '</i></div>' : '') + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:7px">' + ['hq', ...BUILDABLE].map(k => { const T = btx(k, CODEXFAC); return `<div class="ach" style="align-items:flex-start"><div class="chip" style="width:58px;height:58px;${iconStyle(bIcon(k, CODEXFAC))}"></div><div><b>${T.n}</b>${T.cost[0] ? ' - costs ' + T.cost[0] : ''}<br>${T.info}<br>${(CODEXFAC === 1 && LORE.lgBuildings[k]) || LORE.buildings[k] ? '<i style="color:#d9c79a">' + esc((CODEXFAC === 1 && LORE.lgBuildings[k]) || LORE.buildings[k]) + '</i><br>' : ''}${T.specs.map(s => '<span style="color:#ffe2a6">' + s.n + '</span>: ' + s.d).join('<br>')}</div></div>`; }).join('') + '</div>';
  } else if (CODEXTAB === 'callins') {
    body = facNote + CALLORDER.map(id => { const C = callText(id, CODEXFAC); return `<div class="ach" style="margin-bottom:5px"><span style="font-size:24px;color:${C.col};width:28px;text-align:center">${C.ic}</span><div><b>${C.n}</b> (${C.key}) - costs ${C.cost}, recharges in ${C.cd}s, needs ${C.req[0] === 'hq' ? 'HQ Level ' + C.req[1] : 'a Level ' + C.req[1] + ' Radar Station'}<br><i style="color:#ccd">${C.d}</i></div></div>`; }).join('');
  } else if (CODEXTAB === 'lore') {
    const L = LORE; body = '<div class="note" style="font-size:15px;color:#ffe2a6;margin-bottom:8px"><b>' + esc(L.world.name) + '</b>: ' + esc(L.world.tagline) + '</div>'
      + L.chapters.map((c, i) => '<details class="lore"' + (i === 0 ? ' open' : '') + '><summary>' + (i + 1) + '. ' + esc(c.title) + '</summary><p>' + esc(c.text) + '</p></details>').join('')
      + '<div class="lbl">The commanders</div>' + Object.keys(AIP).map(id => { const c = L.commanders[id], A = AIP[id]; return c ? '<details class="lore"><summary>' + esc(A.name) + ' - ' + esc(A.title) + '</summary><p>' + esc(c.bio) + '</p><p><i style="color:#d9c79a">"' + esc(c.quotes[0]) + '"</i></p></details>' : ''; }).join('')
      + '<div class="lbl">Battlefields</div>' + MAPS.map(m => L.maps[m.id] ? '<details class="lore"><summary>' + esc(m.name) + '</summary><p>' + esc(L.maps[m.id]) + '</p></details>' : '').join('')
      + (WAR && WAR.seen ? '<div class="lbl">War reports (Endless War)</div>' + Object.keys(L.war.milestones).filter(k => WAR.seen[k]).map(k => '<details class="lore"><summary>Wave ' + k + '</summary><p>' + esc(L.war.milestones[k]) + '</p></details>').join('') : '');
  } else {
    const tl = techList(CODEXFAC); body = facNote + '<div class="note" style="margin-bottom:6px">Unlock Upgrades by leveling your HQ to Level 2. They help your whole army. One at a time. There are ' + tl.length + ' in total.' + (CODEXFAC === 1 ? ' The Iron Legion has its own versions of seven of them.' : '') + '</div><div class="tech">' + TBR.map(b => '<div class="tcol"><h5>' + b.n + '</h5>' + tl.filter(t => t.br === b.id).map(t => `<div class="tcard" style="cursor:default"><b>${t.n}</b>${t.d}<br><span style="color:#ffe2a6">Costs ${t.cost}</span></div>`).join('') + '</div>').join('') + '</div>';
  }
  return `<div class="scr bg"><div class="panel" style="width:min(1000px,98vw)"><div class="row" style="justify-content:space-between"><h2 style="margin:0;color:#ffe2a6">Field Guide</h2><button class="tbtn" data-act="back2">Back</button></div><div class="row" style="margin:8px 0">${seg('ctab', [['lore', 'Story'], ['units', 'Troops'], ['buildings', 'Buildings'], ['callins', 'Support'], ['tech', 'Upgrades']], CODEXTAB, 'ctab')}</div>${body}</div></div>`;
};
SCREENS_AFTER.codex = () => { if (!ICONS.rifleman && renderer) { try { makeIcons(); } catch (e) { } } };
SCREENS.howto = () => {
  const sol = (x, y, c) => `<div class="sol" style="left:${x}px;top:${y}px;--fc:${c || '#58a8ff'}"></div>`;
  return `<div class="scr bg"><div class="panel" style="width:min(1040px,98vw)"><div class="row" style="justify-content:space-between"><h2 style="margin:0;color:#ffe2a6">How to Play</h2><button class="tbtn" data-act="howback">${inGame ? 'Back to the game' : 'Back'}</button></div>
  <div class="note" style="font-size:16px;margin:6px 0 12px;color:#e6eef7"><b style="color:#ffe2a6">Goal:</b> capture flags. Hold more flags than the enemy and their score drops to zero. You can also destroy their HQ to win at once.</div>
  <div class="hw">
   <div class="hc"><h4>1. Capture flags</h4><div class="dg"><div class="c ring" style="left:128px;top:14px;width:80px;height:80px"></div><div class="pole" style="left:166px;top:34px"></div>${sol(40, 54)}${sol(60, 62)}${sol(80, 52)}<div class="arr" style="left:100px;top:72px;width:48px;transform:rotate(-12deg)"></div></div><p>Walk soldiers into the circle around a flag. When it turns your color, it is yours. Flags give you money.</p></div>
   <div class="hc"><h4>2. Build and train</h4><div class="dg dark"><div class="coin" style="left:16px;top:38px">$</div><div class="arr" style="left:46px;top:50px;width:30px"></div><div class="bld" style="left:92px;top:30px;width:50px;height:38px"></div><div class="arr" style="left:150px;top:50px;width:26px"></div>${sol(196, 40, '#58a8ff')}${sol(214, 46, '#58a8ff')}</div><p>Click a flag you own and pick a building. Click the building, then click troop cards to fill its <b>roster</b> (the number on a card shows alive / wanted). You pay once for each slot; the building trains the troop and <b>respawns it for free whenever it dies</b>, even if you look away. A Barracks holds 5 soldiers, 10 at Level 2 and 20 at Level 3 (Motor Pool 3/6/10, Airfield 2/3/4). Click the minus or right-click a card to remove a slot, and press <b>Pause</b> to stop training. New troops wait next to the building; use <b>Rally</b> to send them to a spot instead, or <b>Squad</b> to have them join a squad. Level the building up to hold more and unlock stronger troops. Every flag also has <b>defense pads</b> just outside its walls, for towers and guns only: MG Bunkers, Cannon Towers, Flak Towers, Mortar Pits, Artillery, Tesla Towers and Shield Generators.</p></div>
   <div class="hc"><h4>3. Select and move</h4><div class="dg"><div class="bx" style="left:20px;top:26px;width:80px;height:56px"></div>${sol(36, 44)}${sol(58, 54)}${sol(78, 44)}<div class="arr" style="left:110px;top:56px;width:60px;transform:rotate(-8deg)"></div><div class="cur" style="left:186px;top:34px"></div></div><p>Click a troop, or drag a box around many. Then click the ground to move there, or click an enemy to attack it. No right-click needed.</p></div>
   <div class="hc"><h4>4. Win the war</h4><div class="dg dark" style="padding:14px"><div style="height:14px;border-radius:7px;background:#000a;overflow:hidden;margin-bottom:8px"><i style="display:block;height:100%;width:78%;background:#58a8ff"></i></div><div style="height:14px;border-radius:7px;background:#000a;overflow:hidden;margin-bottom:8px"><i style="display:block;height:100%;width:42%;background:#ff6b5e"></i></div><div style="font-size:12px;color:#cdd8e6">You: 312 &nbsp;&nbsp; Enemy: 168</div></div><p>Holding fewer flags drains your score. Losing troops costs score too. At zero you lose. Hold more flags!</p></div>
   <div class="hc"><h4>5. Pick good counters</h4><div class="dg dark"><div class="tri"><div class="n" style="left:8px;top:6px">Soldiers</div><div class="n" style="left:176px;top:6px">Bazookas</div><div class="n" style="left:92px;top:66px">Tanks</div><div class="ln" style="left:86px;top:20px;width:84px"></div><div class="ln" style="left:214px;top:38px;width:60px;transform:rotate(148deg)"></div><div class="ln" style="left:98px;top:66px;width:54px;transform:rotate(211deg)"></div></div></div><p>Soldiers beat Bazookas. Bazookas beat Tanks. Tanks beat Soldiers. Anti-Air Guns and Sky Hunter jets shoot down helicopters, gunships and drones.</p></div>
   <div class="hc"><h4>6. Events and the Campaign</h4><div class="dg dark"><div class="coin" style="left:30px;top:34px">$</div><div class="arr" style="left:62px;top:46px;width:40px"></div>${sol(124, 38, '#58a8ff')}${sol(140, 44, '#58a8ff')}<div class="coin" style="left:196px;top:34px;background:#ff6a50">!</div></div><p>During a battle, <b>field events</b> pop up: a <b>supply crate</b> drops (keep troops next to it, with no enemies there, to claim money), an <b>Ace</b> is marked with a gold ring (destroy enemy Aces for a bounty), or an <b>artillery strike</b> is called on a busy flag (get out of the red circle, or lure the enemy in). In the <b>Campaign</b>, pick a mission at each stage, win to earn <b>Doctrines</b> that last the whole operation, and do not run out of Reserves. In <b>Endless War</b>, build up the Bastion between waves; every new enemy is tougher, and if you lose you rebuild from the start of that wave.</p></div>
   <div class="hc"><h4>7. Controls</h4><div class="kv" style="font-size:13px;gap:5px 14px"><span>Move the camera</span><b>Two-finger scroll, <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows</b><span>Zoom</span><b>Pinch, <kbd>Ctrl</kbd>+scroll, or + -</b><span>Support powers</span><b>Hold <kbd>F</kbd> + <kbd>1</kbd>-<kbd>8</kbd></b><span>Jump to your base</span><b><kbd>Space</kbd></b><span>Select all troops</span><b><kbd>Ctrl</kbd>+<kbd>A</kbd></b><span>Select idle troops</span><b><kbd>Tab</kbd></b><span>Move and fight</span><b>tap <kbd>F</kbd>, then click</b><span>Save / pick a group</span><b><kbd>Ctrl</kbd>+<kbd>1</kbd> / <kbd>1</kbd></b><span>Sell a building</span><b><kbd>K</kbd></b><span>Turn the camera</span><b><kbd>Q</kbd> <kbd>E</kbd></b><span>Pause</span><b><kbd>Esc</kbd></b><span>Squads</span><b>Press + on a squad to fill it, <kbd>1</kbd>-<kbd>5</kbd> to select</b><span>War Map</span><b><kbd>M</kbd></b><span>Guard a flag</span><b><kbd>V</kbd>, then click the flag</b><span>Target type</span><b><kbd>X</kbd></b><span>Formation</span><b><kbd>Y</kbd> or the buttons</b></div></div>
   <div class="hc"><h4>8. Ships, night and weather</h4><div class="dg"><div class="c" style="left:0;top:58px;width:100%;height:40px;background:#3f8fc4;border-radius:0"></div><div class="bld" style="left:22px;top:26px;width:46px;height:30px"></div><div class="arr" style="left:76px;top:70px;width:56px"></div><div class="c" style="left:140px;top:62px;width:56px;height:16px;background:#5b6352;border-radius:4px 4px 14px 14px"></div>${sol(152, 42, '#58a8ff')}${sol(172, 44, '#58a8ff')}<div class="c" style="left:196px;top:30px;width:52px;height:30px;background:#7fb25e;border-radius:40%"></div></div><p>On maps by the sea, some flags have an <b>anchor pad</b> for a <b>Shipyard</b>: it builds Gunboats, Landing Craft and (Level 2) Destroyers, which sail only on deep water. To reach an island, select soldiers and click a <b>Landing Craft</b> to load them, then click the island to land them. Battles can be fought at <b>night</b> or in <b>rain, fog or snow</b>. Night and fog cut everyone's sight and always turn fog of war on; muzzle flashes and searchlights give positions away, rain spoils aim, and mud and snow slow troops down. Earn commander XP to buy <b>General perks</b> from the main menu.</p></div>
  </div>
  <div class="note" style="margin-top:12px">Tip: more of the game unlocks as you level up your HQ and your buildings. Upgrades and Support powers (airstrikes, supply drops, mercenaries) open at HQ Level 2. Fire a Support power by holding F and pressing its number (Hold F + 1 is the first one). Lists and panels scroll with the wheel or two fingers on the touchpad. The enemy warns you with an orange message when it is massing an attack. A Level 3 building lets you pick a special upgrade, and some of them unlock giant units like the Titan mech, Gunships and Sky Hunter jets.</div></div></div>`;
};
SCREENS.pause = () => `<div class="scr bg"><div class="panel" style="width:min(360px,96vw)"><h2 style="margin:0 0 8px;color:#ffe2a6;text-align:center">${W && W.mirror || (W && W.o.mp) ? 'Menu' : 'Paused'}</h2>
  <button class="mbtn go" data-act="resume">Resume</button><button class="mbtn" data-act="help">How to Play</button><button class="mbtn" data-act="psettings">Settings</button><button class="mbtn" data-act="pcodex">Field Guide</button>
  ${W && W.o.mp ? '<div class="note" style="text-align:center">Online games cannot be paused.</div>' : ''}${W && W.o.camp && !W.over ? '<div class="note" style="text-align:center">Quitting a Campaign battle counts as a loss.</div>' : ''}${W && W.war ? '<div class="note" style="text-align:center">' + (W.war.phase === 'fight' ? 'Leaving during a wave restarts it from the beginning (your base as it was when the wave began).' : 'Your Bastion is saved. You can leave any time.') + '</div>' : ''}<button class="mbtn" data-act="quit" style="border-color:#8a3a30">${W && W.o.mp ? 'Give up and leave' : 'Quit to menu'}</button></div></div>`;
function openPause() { if (!inGame || !W) return; if (!W.o.mp) W.paused = true; showScreen('pause'); }
SCREENS.results = (r) => {
  const rows = r.rows.map(x => `<tr><td style="color:${hex3(x.color)}"><b>${esc(x.name)}</b></td><td>${x.kills}</td><td>${x.lost}</td><td>${x.built}</td><td>${x.captured}</td></tr>`).join('');
  return `<div class="scr bg"><div class="panel" style="width:min(540px,98vw);text-align:center"><div class="title" style="font-size:clamp(30px,6vw,52px);${r.win ? '' : 'background:linear-gradient(180deg,#ffd0c8,#d4483a 60%,#7a1d14);-webkit-background-clip:text;background-clip:text'}">${r.win ? 'VICTORY' : 'DEFEAT'}</div>
  <div class="sub">${esc(r.reason)} - ${fmtTime(r.time)}</div>
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin:6px 0"><tr style="color:#9fb0c3"><td>Commander</td><td>Kills</td><td>Lost</td><td>Built</td><td>Flags</td></tr>${rows}</table>
  <div class="note">${r.xp ? '+' + r.xp + ' XP' : ''} ${r.newAch.length ? '<br><b style="color:#ffe2a6">Achievement: ' + r.newAch.join(', ') + '</b>' : ''} ${r.rankUp ? '<br><b style="color:#7be08a">Promoted to ' + r.rankUp + '!</b>' : ''}${r.genUp ? '<br><b style="color:#8fd0ff">+' + r.genUp + ' General point' + (r.genUp > 1 ? 's' : '') + '!</b> <button class="sm" data-act="general">Spend ' + (r.genUp > 1 ? 'them' : 'it') + '</button>' : ''}</div>
  ${r.camp ? campResultHtml(r.camp) : (r.mp ? '<button class="mbtn go" data-act="tolobby">Back to lobby</button>' : (r.sandbox ? '' : '<button class="mbtn go" data-act="rematch">Play again</button>')) + '<button class="mbtn" data-act="quit2">Main menu</button>'}</div></div>`;
};
function campResultHtml(c) {
  if (c.over === 'won') return '<div class="note" style="font-size:16px;color:#7be08a;margin-top:8px"><b>OPERATION ' + esc(CAMP.name.toUpperCase()) + ' COMPLETE!</b></div><button class="mbtn go" data-act="tocamp">Campaign</button><button class="mbtn" data-act="quit2">Main menu</button>';
  if (c.over === 'lost') return '<div class="note" style="font-size:16px;color:#ff9a8c;margin-top:8px"><b>Out of Reserves. Operation ' + esc(CAMP.name) + ' failed.</b></div><button class="mbtn go" data-act="tocamp">Campaign</button><button class="mbtn" data-act="quit2">Main menu</button>';
  if (!c.win) return '<div class="note" style="margin-top:8px">You lost a Reserve. ' + campHearts() + ' Pick a new mission and try again.</div><button class="mbtn go" data-act="tocamp">Back to the operation</button>';
  return '<div class="note" style="margin-top:8px">' + (c.life ? '<b style="color:#7be08a">+1 Reserve!</b> ' : '') + campHearts() + '</div><div class="lbl" style="text-align:left">Choose a Doctrine (lasts the whole operation)</div>' + docCards(c.offer || []);
}
