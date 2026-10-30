// ==========================================
// THE PEOPLE OF THE VALLEY: somebody waits by a lantern in every level. Walk up and they talk (E / Enter to hear them
// again). Each one only knows their own part; put together, what they say tells what happened to the valley, what The
// Gloom is, and who you are. The guardians and The Gloom talk too. "People" on the title keeps everything you heard.
// ==========================================
const CAST = {
    bram: { name: 'Old Bram', col: '#e0b070', about: 'A woodcutter from the Glowwood. Old friend of the Lamplighter.' },
    pip: { name: 'Pip', col: '#8fd0ff', about: 'A kid from the village, looking for a best friend who left without saying goodbye.' },
    marta: { name: 'Marta', col: '#ffb38a', about: 'A crystal miner who stayed in the caves when everybody else turned back.' },
    ilse: { name: 'Sister Ilse', col: '#e8d8ff', about: 'Keeper of the sky temples. She told the Lamplighter the truth, and was afraid of him.' },
    hob: { name: 'Hob', col: '#ff9a5a', about: 'The smith of the Ember Forge. He built the great lantern.' },
    moss: { name: 'Mossback', col: '#8fe07a' }, shard: { name: 'Shardwing', col: '#8ff0ff' }, bell: { name: 'The Bellkeeper', col: '#ffe08a' },
    tam: { name: 'Tamsin', col: '#9fe0c8', about: 'A mapmaker who walks the whole valley and draws what is left of it. Always looking for places other people walked past.' },
    quill: { name: 'Quill', col: '#d8b8ff', about: 'The last librarian of the sky temples. Took the best books down to the Forge so the fire could not have them.' },
    cinder: { name: 'Cinderjaw', col: '#ff8a3a' }, gloom: { name: 'The Gloom', col: '#b98aff' }, orin: { name: 'Orin, the Lamplighter', col: '#fff2c4' }
};
const TALKS = {
    '1-1': ['bram', ['Well, I’ll be. A light! A real one, walking about on its own.',
        'Haven’t seen one of those since the Lamplighter’s men came round with their carts. Took every lantern in the Glowwood. Said they’d bring them back.',
        'That was a long time ago, little light. The dark’s been creeping in ever since.',
        'Go on, then. Light the old lanterns as you pass. They remember what they’re for.']],
    '1-2': ['pip', ['Hey! HEY! Are you a firefly? No, too bright. ...Are you a ghost?',
        'I’m Pip. I’m looking for my friend Wren. She’s the Lamplighter’s daughter. She’s been sick, but she still beats me at everything.',
        'She left in the middle of the night. Didn’t even say goodbye. Her papa left first, though. Weeks ago.',
        'If you see a girl with a red ribbon, tell her Pip is mad at her. And that I miss her. Mostly the second one.']],
    '1-3': ['bram', ['You again! Getting around, aren’t you.',
        'Orin, the Lamplighter: he and I go way back. Best man in the valley, once. Lit every lantern by hand, every night, rain or snow.',
        'Then his girl got sick. Her light was fading, the healer said. Like a candle near the end.',
        'Something went out in him too, I think. He stopped talking to anyone. Just stared at the lanterns, like they owed him something.']],
    '1-10': ['pip', ['You made it this far? Me too! Well. I hid a lot.',
        'Careful up ahead. That’s Mossback’s clearing. He used to let us ride on his back, me and Wren. He guards the forest.',
        'But he’s... wrong now. All dark and twitchy. Like something crawled inside him.',
        'Wren would know what to do. Wren always knew what to do.']],
    // ---- 1.2: the new middle levels ----
    '1-5': ['bram', ['Mind the old log. It is hollow, and the bridges inside it are older than I am.',
        'Me and Orin carved our names in the inside, once. Somewhere up high, I think. He wrote "Orin" and I wrote "Bram", and the girl wrote "Wren" in the middle with a heart.']],
    '1-6': ['tam', ['Shh, hold still, I am drawing you. A light in a mushroom field. Lovely.',
        'Tamsin. Mapmaker. I mark where the valley used to be, and where it still is. There are little lanterns hidden all over, dropped by the carts.',
        'The best ones are never on the path. If the path goes left, look up and right.']],
    '1-9': ['pip', ['Whoa. You keep going. I would have turned around two lanterns ago.',
        'Mossback is just past that gate. Be nice to him. He cannot help it, the dark makes his legs jump on their own.',
        'Wait for him to squat down. That is when he is about to jump. Then slip under his back, okay?']],
    '2-5': ['marta', ['Echo Chamber. Say something and it says it back, three times, a little sadder each time.',
        'The old miners cut these steps so the lift would not be needed. I counted them once. I got tired around forty.']],
    '2-6': ['tam', ['Down here too! I am so happy to see a face. Well. A glow.',
        'There is a lantern hidden high up in this garden. The crystals grow in a ladder, if you stand just so. I mapped it. Do not tell Marta, she would have mined it.']],
    '2-7': ['pip', ['There is a river down here. Under the rock. I did not know that.',
        'The ledges ride it like little boats. Do not look down. I looked down. Do not.']],
    '2-9': ['marta', ['The pool ahead is as black as the sky between stars. Do not try to wade.',
        'Light your lantern here, little spark. Shardwing guards the Bell just beyond. It will not hurt you if you keep your head.',
        'And if it does, you are very, very quick.']],
    '3-5': ['ilse', ['The pillars were a bridge, once. Then the wind took the middle out of it.',
        'Push against a wall and jump away from it. The stone remembers being climbed. It likes it.']],
    '3-6': ['tam', ['Oh! You made it up here! Careful, the wind is rude.',
        'It rises from the old windmills. Nobody has fed them in years but they are still breathing. Stand in it and let it carry you.',
        'I left a lantern on a ledge in the east wing. Take it. It is lonely.']],
    '3-8': ['quill', ['Quiet, please. This is a library. Was a library.',
        'I carried the good books to the Forge before the dark came. Not that fire is any kinder to paper. But it is warmer than the dark.',
        'One bookcase is a lie. It opens a little way, if you know where to press.']],
    '3-9': ['ilse', ['The storm gate. Beyond it, the Bellkeeper.',
        'Do not fear him. He is only a bell that forgot what it was for. Remind him, if you can.']],
    '4-5': ['hob', ['Rivets! I put every one of those in by hand. Do you know how many rivets are in a world? A lot.',
        'You can dash over the long gaps, little light. Jump first, then dash. The dash is faster than falling.']],
    '4-6': ['tam', ['I knew I would find you. I followed the glow. Also the heat.',
        'The lifts here still run. They were made to carry lanterns, not people, but they carry people fine.',
        'There is a map in my pack that I never finished. It stops right where the Forge begins. I think I know why. I think nobody came back to draw it.']],
    '4-8': ['hob', ['The long run. I built it to carry molten iron, so it is wide, and it is hot, and it is a very long way down.',
        'Whatever you do, do not stop to rest on the molten bits.']],
    '4-9': ['quill', ['Oh, the books are fine! A little singed. They are all the way at the back.',
        'You will meet Cinderjaw next. He is a good guard who got a bad boss. Be firm, and be quick.',
        'A lost lantern is hidden in this hall, on the wind ledge. Tamsin told me. She tells everyone.']],
    '2-1': ['marta', ['Stop right there. Oh. You’re a light. Sorry, I’ve been talking to rocks for days.',
        'Name’s Marta. I mine crystal down here. Or I did, before the carts.',
        'Hundreds of them rolled through, full of lanterns, all the way down to the Forge. We followed. Thought the Lamplighter had gone mad.',
        'Most turned back when the lights went out behind us. I stayed. Somebody has to keep the crystals singing.']],
    '2-2': ['pip', ['Don’t tell anyone I’m down here. I’m supposed to be home.',
        'Look what I found, though. A ribbon. A RED ribbon. Wren did come this way!',
        'Why would she go to the Forge? She can barely walk to the well without getting tired.',
        '...Unless she was going after her papa.']],
    '2-3': ['marta', ['Still glowing! Good. You’d be surprised how many things down here stop glowing.',
        'That bell back there is the Deep Bell. Ring it when the dark comes, and the guardians wake. Old rule.',
        'Nobody rang it. The dark didn’t come with drums. It came quiet, rolling down the tunnels in a lantern.',
        'Strangest thing, though. A few nights back a girl came by. Small, pale, red ribbon gone. Walking down. Alone. Wouldn’t stop to rest.']],
    '2-10': ['marta', ['Shardwing’s cave is just ahead. That bat kept the Deep Bell. Used to sing to it.',
        'It doesn’t sing anymore. It screams.',
        'Wake it up, the old way, and there’s a path out of here. Up. Toward the sky temples.']],
    '3-1': ['ilse', ['Welcome, little flame. Mind the wind. It is all we have left up here.',
        'I am Ilse. I keep the temple, or what remains of it.',
        'We teach one thing here: the first light came up from the Forge as a gift, and a gift must be shared.',
        'Whoever keeps all the light keeps none of it. An old saying. I used to think it was only a saying.']],
    '3-2': ['pip', ['Okay. I’m officially lost. And cold. And it’s REALLY high up.',
        'Can I tell you something weird? Wren used to say lanterns get lonely in the daytime.',
        'And when you flicker like that... you look just like she does when she laughs.',
        'That’s dumb. Forget I said it. Go on, I’ll catch up.']],
    '3-3': ['ilse', ['Orin climbed these towers too, before the dark. He asked me how a flame could be held forever.',
        'I told him the truth. Light that is hoarded turns to shadow. It cannot be kept, only passed on.',
        'He said: then I will hoard it carefully. And he went down to the Forge with every lantern in the valley.',
        'I should have stopped him. I was afraid of him. That is a hard thing to say about a friend.']],
    '3-10': ['ilse', ['The Bellkeeper waits beyond. It rings the hours of the valley. It rang the last hour the night the girl came through.',
        'She asked me if her papa could be saved. I said: not by taking. Only by giving.',
        'She smiled at that. I did not understand why until much later.']],
    '4-1': ['hob', ['Hot enough for you? Ha. Sorry. Bad joke. I’m Hob. This is my forge. Was.',
        'Four thousand two hundred and eleven lanterns. I counted every one off the carts. Orin fed them to the Heart of Embers, one by one.',
        'He wanted one flame that could never go out. For his girl. I built him the lantern to hold it.',
        'Best work I ever did. Worst thing I ever made.']],
    '4-2': ['bram', ['Little light! Thank the stars. These old legs got me all the way down here.',
        'I came to talk sense into Orin. Old friends, you know. But what I found at the Heart wasn’t him.',
        'Just dark, pouring out of that great lantern like smoke. And in the middle of it his voice, saying her name over and over.',
        'Don’t go near him alone. ...Ah, who am I kidding. You’re the only light down here.']],
    '4-3': ['hob', ['You want the rest of it? Fine. You’ve earned it.',
        'The girl came. Wren. Barely standing. She walked straight up to her papa, into the dark around him.',
        'She said: you don’t need all the lights, Papa. You only ever needed one. And she put her own light in his lantern.',
        'The whole thing went black. That’s when the Gloom was born. But one spark flew out of it. Small. Bright. Up and out, toward home.',
        '...It looked a lot like you.']],
    '4-10': ['pip', ['I followed the ribbon all the way down. And I found you. I found... you.',
        'You’re her. Aren’t you? You’re Wren. The light of her. The part she gave away.',
        'You can’t talk. That’s okay. You always talked enough for both of us.',
        'Go get your papa back. I’ll be right here. I’m not going home without my best friend.']]
};
// the guardians: before the fight, during it (one line each time it is hit), and once the dark is out of them
const GUARD_TALK = {
    moss: { pre: ['Lanterns... gone. Forest... so cold.', 'YOU. Bright thing. Give... me... your LIGHT!'],
        mid: ['Cold... so cold...', 'MINE!', 'Stop... squirming!', 'Little... light...?', 'The dark... it itches...'],
        free: ['Ohh... my head. The dark is gone. Thank you, little light.', 'He came through here with a hundred carts. The Lamplighter. Took our lanterns and left something cold behind.',
            'Go down into the caves. The carts went that way. And... you smell like the little girl who used to ride on my back. Strange.'] },
    shard: { pre: ['SKREEEE... the bell... the bell is SILENT...', 'Light-thief! You will not take more!'],
        mid: ['Silent... SILENT!', 'Hurts... the dark hurts...', 'You cannot hide from me!', 'Ring... the bell...'],
        free: ['...I can hear the bell again. Oh, how I missed it.', 'Forgive me, little one. The cold got into my wings. I could not tell a friend from a thief.',
            'The girl passed here. She asked me the way to the Forge. I told her: up, through the temples. She was so very tired.'] },
    bell: { pre: ['DONG. The hour... is DARK.', 'No more hours. No more mornings. Only the TOLL.'],
        mid: ['TOLL!', 'The hour grows late...', 'You ring... out of time!', 'Who... rings me...?'],
        free: ['...The hour returns. Morning, I think. It has been so long since morning.', 'I rang for the girl, little flame. The last hour of the last night. She went down the mountain alone.',
            'The Forge lies below. He waits there. And so, I think, does she.'] },
    cinder: { pre: ['GRRRAAH. Another lantern for the Heart?', 'No... you are no lantern. You are HER. He will want you back.'],
        mid: ['BURN!', 'The Heart is hungry...', 'Hold STILL!', 'Stop... hitting...!'],
        free: ['Hrrm. The fire in me is my own again. You hit hard, for a spark.', 'I guarded the Forge for a thousand years. I let him in because he was the Lamplighter. I trusted him.',
            'Your father is past that gate. What is left of him. Go, Wren. Bring him back to the light.'] }
};
const GLOOM_TALK = {
    pre: [['gloom', 'Who... is there? Another light. Come closer. Come INTO the lantern.'], ['gloom', 'I need every one. Every one. She is fading. She is...'],
        ['gloom', '...Wren?'], ['gloom', 'NO. Wren is gone. Wren is IN HERE. And you will be too!']],
    mid: ['Give it BACK!', 'I only wanted to keep her...', 'Why do you burn so bright...', 'Not again... not you too...', 'The light is MINE!', 'Wren... is that you?', 'Please... stay...', 'Let me hold on...'],
    end: [['orin', '...The dark is lifting. I can see again.'], ['orin', 'Little light. I know you now. You were the one I could not take, because she gave you away.'],
        ['orin', 'I am so sorry, my girl. I held on so tight that I put out everything I loved.'], ['orin', 'Take them home, Wren. All of them. Light them all.']]
};
const talkCount = () => Object.keys(SAVE.d.talks || {}).filter(k => TALKS[k]).length;
const TALK_N = Object.keys(TALKS).length;

// ---------- the dialogue box: a portrait, a name, the words typing out; jump / Enter / click goes on ----------
const TK = { lines: null, i: 0, shown: 0, done: null, back: 'play' };
UI.talk = function (lines, done) {
    if (!lines || !lines.length) { if (done) done(); return; }
    TK.lines = lines; TK.i = 0; TK.shown = 0; TK.done = done || null; TK.back = G.state === 'talk' ? TK.back : G.state;
    G.state = 'talk'; Input.clear(); $('#touch').classList.add('hidden');
    $('#talk').classList.remove('hidden'); talkLine();
};
function talkLine() {
    const [who, text] = TK.lines[TK.i], c = CAST[who] || { name: who, col: '#fff' };
    $('#tk-name').textContent = c.name; $('#tk-name').style.color = c.col; $('#tk-text').textContent = ''; TK.shown = 0;
    $('#talk').style.setProperty('--tk', c.col); drawPortrait(who);
    Sound.play('blip');
}
UI.talkTick = function (dt) {
    if (G.state !== 'talk' || !TK.lines) return;
    const text = TK.lines[TK.i][1];
    if (TK.shown < text.length) {
        const before = Math.floor(TK.shown); TK.shown = Math.min(text.length, TK.shown + dt * 48);
        if (Math.floor(TK.shown) !== before) { $('#tk-text').textContent = text.slice(0, Math.floor(TK.shown)); if (Math.floor(TK.shown) % 3 === 0 && text[Math.floor(TK.shown) - 1] !== ' ') Sound.play('talk', TK.lines[TK.i][0]); }
    }
    $('#talk').classList.toggle('more', TK.shown >= text.length);
    drawPortrait(TK.lines[TK.i][0], G.t + performance.now() / 1000, TK.shown < text.length);
};
UI.talkNext = function () {
    if (G.state !== 'talk' || !TK.lines) return;
    const text = TK.lines[TK.i][1];
    if (TK.shown < text.length) { TK.shown = text.length; $('#tk-text').textContent = text; return; }
    TK.i++;
    if (TK.i < TK.lines.length) return talkLine();
    $('#talk').classList.add('hidden'); TK.lines = null; G.state = TK.back; Input.clear();
    const d = TK.done; TK.done = null; if (d) d();
};
// a person in a level: the first time you come close they talk; afterwards E / Enter hears them again
function meet(G, e, again) {
    const t = TALKS[G.L.def.id]; if (!t) return;
    const [who, lines] = t, first = !SAVE.d.talks[G.L.def.id];
    e.talked = true; e.who = who;
    SAVE.d.talks[G.L.def.id] = true; if (first) ST('talks'); SAVE.write();
    UI.talk(lines.map(l => [who, l]));
}
function drawPortrait(who, t = 0, speaking = false) {
    const cv = $('#tk-face'), x = cv.getContext('2d'), c = CAST[who] || { col: '#fff' };
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, 96, 96);
    const g = x.createRadialGradient(48, 52, 4, 48, 52, 60); g.addColorStop(0, c.col + '55'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 96, 96);
    if (PEOPLE[who]) { x.translate(48, 108); x.scale(1.9, 1.9); PEOPLE[who](x, t, 1, speaking); }
    else if (GUARD_ART[who]) {
        const base = { moss: 38, shard: 30, bell: 36, cinder: 36 }[who];
        x.translate(48, 54); x.scale(0.95, 0.95);
        GUARD_ART[who](x, { D: { r: base }, state: 'idle', face: 1, vx: 0, vy: 0, squat: speaking ? Math.abs(Math.sin(t * 12)) * 0.3 : 0, land: 0, glow: speaking ? 0.6 : 0, open: false, spit: speaking ? 1 : 0, clean: !!(G.guard && G.guard.state === 'free') }, t, false);
    } else if (who === 'gloom') {
        x.translate(48, 50);
        for (let i = 0; i < 6; i++) { const a = i / 6 * 7 + t; x.fillStyle = 'rgba(40,10,70,.8)'; x.beginPath(); x.arc(Math.cos(a) * 12, Math.sin(a) * 10, 24, 0, 7); x.fill(); }
        const e = x.createRadialGradient(0, 0, 1, 0, 0, 16); e.addColorStop(0, '#fffbe6'); e.addColorStop(0.5, '#c9a0ff'); e.addColorStop(1, 'rgba(200,160,255,0)');
        x.fillStyle = e; x.beginPath(); x.ellipse(0, 0, 16, speaking ? 12 : 8, 0, 0, 7); x.fill(); x.fillStyle = '#12021e'; x.beginPath(); x.ellipse(0, 0, 4, 7, 0, 0, 7); x.fill();
    }
}

// ---------- People: everyone you met and everything they told you ----------
UI.people = function () {
    const order = ['bram', 'pip', 'marta', 'ilse', 'hob', 'tam', 'quill'], heard = SAVE.d.talks || {};
    $('#lo-n').textContent = talkCount() + ' of ' + TALK_N + ' conversations heard' + (talkCount() === TALK_N ? ': the whole story.' : '');
    $('#lo-list').innerHTML = order.map(who => {
        const ids = Object.keys(TALKS).filter(id => TALKS[id][0] === who), got = ids.filter(id => heard[id]);
        if (!got.length) return `<div class="lore lost"><span>???</span><p>Somebody is waiting somewhere in world ${ids[0].split('-')[0]}.</p></div>`;
        return `<div class="lore"><span style="color:${CAST[who].col}">${CAST[who].name}</span> <em>${got.length} of ${ids.length} talks</em><p class="ab">${CAST[who].about}</p>`
            + ids.map(id => heard[id] ? `<p><b>${id}</b> ${TALKS[id][1].join(' ')}</p>` : `<p class="miss"><b>${id}</b> (not heard yet)</p>`).join('') + '</div>';
    }).join('');
    this.show('lore');
};
// the end of the game: the epilogue, then the usual results
UI.ending = function (r) {
    const n = talkCount(), all = n === TALK_N;
    const lines = ['The Gloom came apart like smoke in the wind.', 'Four thousand two hundred and eleven lights flew home across the valley, and one by one the lanterns woke.',
        'At the edge of the Forge a boy with a red ribbon in his fist was waiting, exactly where he said he would be.',
        all ? 'And in the morning, in the Lamplighter’s house, a girl opened her eyes, and laughed, and asked why everyone was crying.' : 'Some say there is more to the story. (' + n + ' of ' + TALK_N + ' conversations heard)'];
    $('#en-lines').innerHTML = lines.map((l, i) => `<p style="animation-delay:${0.6 + i * 1.6}s">${l}</p>`).join('');
    $('#en-stats').innerHTML = `<span>${fmtTime(SAVE.d.playTime || 0)} played</span><span>${SAVE.d.deaths} falls</span><span>${n} of ${TALK_N} stories</span>`;
    $('#en-go').onclick = () => { Sound.play('click'); UI.results(r); };
    $('#hud').classList.add('hidden'); UI.bossbar(null); this.show('end');
};
UI.bossbar = function (B) {
    const el = $('#bossbar'); if (!el) return;
    if (!B) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden'); $('#bb-name').textContent = B.D ? B.D.name : 'The Gloom'; $('#bb-fill').style.width = (100 * Math.max(0, B.hp) / B.max) + '%';
    $('#bb-fill').style.background = B.D ? B.D.col : '#b98aff';
};
// a speech bubble over a guardian or The Gloom while it fights
function drawSay(x, sx, sy, say) {
    if (!say || say.t <= 0) return;
    x.save(); x.font = 'bold 15px system-ui, sans-serif'; const w = x.measureText(say.text).width + 22, h = 28, a = Math.min(1, say.t * 3, (2.6 - say.t) * 6);
    x.globalAlpha = Math.max(0, a); x.translate(sx - w / 2, sy - h);
    x.fillStyle = 'rgba(14,8,30,.88)'; x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1.5;
    x.beginPath(); x.roundRect ? x.roundRect(0, 0, w, h, 10) : x.rect(0, 0, w, h); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(w / 2 - 7, h); x.lineTo(w / 2, h + 9); x.lineTo(w / 2 + 7, h); x.fill();
    x.fillStyle = '#fff'; x.textBaseline = 'middle'; x.fillText(say.text, 11, h / 2 + 1); x.restore();
}
