// ==========================================
// LORE: one memory hidden in every level (The Gloom leaves the last one). Read in order they tell what happened to the
// valley: who took the lanterns, what The Gloom is, and who you are. The journal on the title screen keeps them.
// ==========================================
const LORE = {
    '1-1': ['A lamplighter’s list', 'Dusk round, Glowwood path: forty lanterns, all lit. Wren walked the whole way with me tonight and named every one of them. She says lanterns get lonely in the daytime. — O.'],
    '1-2': ['Carved into a tree', 'WREN + THE BIG LANTERN, in a child’s careful letters. Below it, newer and deeper, as if cut by a grown hand: I WILL FIX THIS.'],
    '1-3': ['A torn page', 'The healer says Wren’s light is fading, the way a candle gutters near the end. She is not afraid. I am. — O.'],
    '1-4': ['A notice nailed to a post', 'BY ORDER OF THE LAMPLIGHTER: every lantern in the valley is to be carried to the Forge. They will be returned. — Orin'],
    '2-1': ['Scratched into the rock', 'We followed the lanterns down into the caves. Nobody brought them back. The forest went dark behind us, one light at a time.'],
    '2-2': ['A miner’s tally', 'Ninth day without light. The crystals still glow a little if you sing to them. The great bat in the bell cave has stopped singing back.'],
    '2-3': ['A child’s drawing', 'A tall man carrying a lantern bigger than he is, with a tiny star on top. Underneath: PAPA IS MAKING A LIGHT THAT NEVER GOES OUT. FOR ME.'],
    '2-4': ['Words on the Deep Bell', 'Ring me when the dark comes, and the guardians will wake. — No one rang it. The dark came quietly, carried in a lantern.'],
    '3-1': ['A temple tablet', 'The first light came up from the Forge as a gift, and a gift must be shared. Whoever keeps all the light keeps none of it.'],
    '3-2': ['A priest’s warning', 'Orin climbed the towers to ask how a flame could be held forever. We told him the truth. Light that is hoarded turns to shadow. He did not like it.'],
    '3-3': ['Orin’s journal', 'Then I will hoard it carefully. One flame, every light in the valley poured into it, too bright to ever go out. Wren has three days.'],
    '3-4': ['Scratched by the Bellkeeper’s door', 'At the last hour of the last night, a small light went down the mountain alone, toward the Forge. It did not look back.'],
    '4-1': ['The Forge ledger', 'Lanterns received: 4,211. Lanterns returned: none. The Heart of Embers is hungry, and the Lamplighter feeds it with his own hands.'],
    '4-2': ['Orin’s last page', 'It is done. Every light in the valley, in one flame, and the flame in her lantern. But it is not light that pours out of it. Wren, forgive me.'],
    '4-3': ['A note in small handwriting', 'Papa, you didn’t need all the lights. You only ever needed one. I’m giving you mine. Light them all again for me. — W'],
    '4-4': ['Burned into the great anvil', 'The flame he made became the Gloom, and the Gloom became him. Every light was taken. Only one got away: the one that was given, not taken.'],
    '5-1': ['What the Gloom left behind', '“Little light. You came all this way. I know you now: you were the one I could not take, because she gave you away. Take them home, Wren. Light them all.”']
};
const loreCount = () => Object.keys(SAVE.d.lore || {}).filter(k => LORE[k]).length;
UI.memory = function (id) {
    const m = LORE[id]; if (!m) return;
    const fresh = !SAVE.d.lore[id]; SAVE.d.lore[id] = true; if (fresh) ST('memories'); SAVE.write();
    G.state = 'read'; Input.clear(); $('#touch').classList.add('hidden');
    $('#rd-n').textContent = 'Memory ' + (Object.keys(LORE).indexOf(id) + 1) + ' of ' + Object.keys(LORE).length + (fresh ? '' : ' (found before)');
    $('#rd-t').textContent = m[0]; $('#rd-x').textContent = m[1];
    this.show('read');
};
UI.readDone = function () { if (G.state !== 'read') return; G.state = 'play'; this.show(null); Input.clear(); };
UI.journal = function () {
    const ids = Object.keys(LORE), n = loreCount();
    $('#lo-n').textContent = n + ' of ' + ids.length + ' memories found' + (n === ids.length ? ': the whole story.' : '');
    $('#lo-list').innerHTML = ids.map((id, i) => SAVE.d.lore[id]
        ? `<div class="lore"><span>${i + 1}. ${LORE[id][0]}</span><p>${LORE[id][1]}</p></div>`
        : `<div class="lore lost"><span>${i + 1}. ???</span><p>Hidden somewhere in ${id === '5-1' ? 'the last fight' : 'level ' + id}.</p></div>`).join('');
    this.show('lore');
};
// the end of the game: the epilogue, then the usual results
UI.ending = function (r) {
    const n = loreCount(), all = n === Object.keys(LORE).length;
    const lines = ['The Gloom came apart like smoke in the wind.', 'Four thousand lights flew home across the valley, and one by one the lanterns woke.',
        'In the morning they found an old lamplighter’s lantern at the Heart of Embers, still warm.',
        all ? 'Inside it, very softly, a small light was singing. Wren had come home.' : 'Some say there is more to the story. (' + n + ' of ' + Object.keys(LORE).length + ' memories found)'];
    $('#en-lines').innerHTML = lines.map((l, i) => `<p style="animation-delay:${0.6 + i * 1.6}s">${l}</p>`).join('');
    $('#en-stats').innerHTML = `<span>${fmtTime(SAVE.d.playTime || 0)} played</span><span>${SAVE.d.deaths} falls</span><span>${n} memories</span>`;
    $('#en-go').onclick = () => { Sound.play('click'); UI.results(r); };
    $('#hud').classList.add('hidden'); UI.bossbar(null); this.show('end');
};
UI.bossbar = function (B) {
    const el = $('#bossbar'); if (!el) return;
    if (!B) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden'); $('#bb-name').textContent = B.D.name; $('#bb-fill').style.width = (100 * Math.max(0, B.hp) / B.max) + '%';
    $('#bb-fill').style.background = B.D.col;
};
