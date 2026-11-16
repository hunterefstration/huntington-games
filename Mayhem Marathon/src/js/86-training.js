// ============================================================
// TRAINING (1.2): three lessons on the Tutor engine (85-tutor.js), the Training list (title screen), a one-time offer.
// Lessons 1 and 2 play training rounds (G.show.tut): no stats, kudos, fame or round records, the round never ends by itself,
// you are never knocked out (a fall puts you back at the start), so stats.crowns / stats.qualified (the leaderboards) never move.
// Lesson 3 tours the menus. Lessons done: save.tut[id] = 1 (mayhem_save); save.tutOffer: the offer was shown (new players, once).
// ============================================================
Tutor.config({ done: id => !!(save && save.tut && save.tut[id]), mark: id => { save.tut = save.tut || {}; save.tut[id] = 1; writeSave(); trainBadge(); }, z: 9000, nextKey: 'Enter' });
const kb = k => '<kbd>' + k + '</kbd>';
const tMe = () => { const C = byId(G.me); return C && C.inRound && !C.hide ? C : null; };
const tRound = rid => !!(G.R && G.show && G.show.tut && G.R.rid === rid);
const tPlay = rid => tRound(rid) && G.R.phase === 'play';
const tN = k => (G.show && G.show.tutN && G.show.tutN[k]) || 0;
const inTut = () => !!(G.show && G.show.tut && (G.screen === 'game' || G.screen === 'pause' || G.screen === 'set' || G.screen === 'how'));
const onTitle = () => !G.show && !NET.net && ['title', 'play', 'pick', 'ward', 'how', 'set', 'new'].includes(G.screen);
// a training round: only you (and a few easy bots for the round types that need others)
function trainRound(rid, bots) {
    if (NET.net) return false;
    if (G.R && G.show && G.show.tut && G.R.rid === rid) return true;
    netReset(); ac();
    const cfg = makeShowConfig([{ id: 0, name: myName(), look: save.look }], { bots: bots | 0, skill: 0, length: 1, scoring: 'knockout', practice: rid });
    cfg.tut = 1;
    G.host = true; G.me = 0; G.autopilot = false; beginShow(cfg); hostStartRound();
    return true;
}
function trainLeave() { G.autopilot = false; if (G.show && G.show.tut) UI.toTitle(); }

Tutor.define({
    id: 'steps', title: 'First steps', blurb: 'Run, the camera, jump, dive, grab, checkpoints and the finish, on a course where nobody is knocked out', coach: true, next: 'rounds',
    begin: () => onTitle() && trainRound('spin', 0), finish: () => trainLeave(), atEnd: () => trainLeave(), alive: () => inTut(),
    end: 'You can run, jump, dive and grab your way through a course. Next, <b>Round types</b> tries a race, a survival round, a team round and Bomb Tag.',
    steps: [
        { title: 'The rule card', text: 'Every round starts with a card: its name, what to do and how many get through. This is a training course: <b>nobody is knocked out and nothing counts</b>. Wait for GO!',
            wait: () => tPlay('spin') },
        { title: 'Look around', text: '<b>Click the game</b> so the mouse turns the camera, then move the mouse (or press ' + kb('←') + ' ' + kb('→') + ' / ' + kb('Q') + ' ' + kb('E') + '). ' + kb('Enter') + ' goes on in this lesson.',
            base: () => ({ y: G.camYaw }), wait: b => Math.abs(angDiff(b.y, G.camYaw)) > 0.7 },
        { title: 'Run', text: 'Hold ' + kb('W') + ' ' + kb('A') + ' ' + kb('S') + ' ' + kb('D') + ' to run. You run the way the camera looks.',
            base: () => { const C = tMe(); return C ? { x: C.vs.x, z: C.vs.z } : {}; }, wait: b => { const C = tMe(); return !!C && b.x != null && Math.hypot(C.vs.x - b.x, C.vs.z - b.z) > 4; } },
        { title: 'Jump', text: 'Press ' + kb('Space') + ' to jump.', base: () => ({ n: tN('jump') }), wait: b => tN('jump') > b.n },
        { title: 'Dive', text: 'Press ' + kb('Shift') + ' or ' + kb('C') + ' to <b>dive</b>: a forward lunge. Jump, then dive, to fly further over a gap.', base: () => ({ n: tN('dive') }), wait: b => tN('dive') > b.n },
        { title: 'Grab', text: 'Hold ' + kb('F') + ' (or the left mouse button) to <b>grab</b>: hold people back, steal tails, pass bombs.', base: () => ({ n: tN('grab') }), wait: b => tN('grab') - b.n > 8 },
        { title: 'Checkpoints', text: 'Run on to a <b>checkpoint</b> (the arch with flags). Fall off and you come back at the last one; ' + kb('R') + ' takes you there too.',
            when: () => !!(L.cps && L.cps.length), wait: () => { const C = tMe(); return !!C && (C.cpi >= 0 || !!C.done); } },
        { title: 'The finish', text: 'Dodge the bars and hammers and run through the <b>finish</b> at the end. Take your time: the clock does not matter here.',
            wait: () => { const C = byId(G.me); return !!(C && C.done); } }
    ]
});
Tutor.define({
    id: 'rounds', title: 'Round types', blurb: 'A race, a survival round, a team round and Bomb Tag, each with its rule card', coach: true, next: 'party',
    begin: () => onTitle() && trainRound('teeter', 5), finish: () => trainLeave(), atEnd: () => trainLeave(), alive: () => inTut(),
    end: 'Those are the round types. A real show mixes them, and the last round is always a <b>final</b>: win it for the crown! Last lesson: <b>Parties and custom shows</b>.',
    steps: [
        { title: 'Races', text: 'In a <b>race</b> only the first ones over the finish qualify. Read the card, then after GO run 12 metres along the course.', enter: () => trainRound('teeter', 5),
            base: () => ({ z: null }), wait: b => { const C = tMe(); if (!tPlay('teeter') || !C) return false; if (b.z == null) b.z = C.vs.z; return C.vs.z - b.z > 12; } },
        { title: 'Survival', text: 'In <b>survival</b> rounds you stay on until the time is up: here, jump the sweeping beam and duck the high one. Survive 10 seconds after GO.',
            enter: () => trainRound('beam', 3), wait: () => tPlay('beam') && G.R.t > 10 },
        { title: 'Team rounds', text: 'In <b>team</b> rounds the team that does worst is out. Tail Chase: grab a tail (' + kb('F') + ' or click) from someone who has one, and have a tail at the end. Play 10 seconds.',
            enter: () => trainRound('tail', 5), wait: () => tPlay('tail') && G.R.t > 10 },
        { title: 'Bomb Tag', text: '<b>Hunt</b> round: got a bomb? <b>Grab</b> someone to pass it on. Whoever holds one when the fuse runs out is out (not in training). Pass a bomb, or play 15 seconds.',
            enter: () => trainRound('bomb', 5), base: () => ({ n: tN('pass') }), wait: b => tPlay('bomb') && (tN('pass') > b.n || G.R.t > 15) },
        { title: 'Knockout or points', text: 'Solo shows are <b>knockout</b>: each round sends some Tumblers home. With 2-4 friends a show can be scored by <b>points</b>, so nobody is knocked out.' }
    ]
});
const scr = s => () => G.screen === s;
Tutor.define({
    id: 'party', title: 'Parties and custom shows', blurb: 'Solo shows, custom shows, hosting and joining a room, your Tumbler\'s look', next: null,
    begin: () => { if (!onTitle()) return false; if (G.screen !== 'title') UI.toTitle(); return true; }, alive: () => onTitle(),
    end: 'That is everything! Lessons stay in <b>Training</b> on the title screen if you want them again.',
    steps: [
        { title: 'Play', text: 'Press <b>PLAY</b>.', el: '#b-play', wait: scr('play') },
        { title: 'A solo show', text: '<b>Start solo show</b> puts you against 15 bots. Pick their skill and how many rounds first.', el: '#b-solo', enter: () => { if (G.screen !== 'play') UI.openPlay(); } },
        { title: 'Custom show', text: 'You can pick which rounds a show uses. Press <b>change</b>.', el: '#b-pick', enter: () => { if (G.screen !== 'play' && G.screen !== 'pick') UI.openPlay(); }, wait: scr('pick') },
        { title: 'Pick the rounds', text: 'Click rounds to switch them on or off (with none picked, a show uses them all). Click one.', el: '#pk-list', at: 'br',
            enter: () => { if (G.screen !== 'pick') UI.openPick('play'); }, base: () => ({ p: JSON.stringify(save.opts.pick) }), wait: b => JSON.stringify(save.opts.pick) !== b.p },
        { title: 'Done', text: 'Press <b>Done</b>. (<b>All</b> puts every round back.)', el: '#pk-done', wait: scr('play') },
        { title: 'Host a room', text: '<b>Host a room</b> to play with friends: you get a 6-digit code, bots fill the empty spots, and you choose the scoring and the rounds in the room.', el: '#b-host',
            enter: () => { if (G.screen !== 'play') UI.openPlay(); } },
        { title: 'Join a friend', text: 'Or type a friend\'s <b>6-digit code</b> here and press <b>Join</b>.', el: () => $('#j-code').parentElement, enter: () => { if (G.screen !== 'play') UI.openPlay(); } },
        { title: 'Back', text: 'Close this with the <b>&times;</b>.', el: '#s-play [data-back]', wait: scr('title') },
        { title: 'Customise', text: 'Open <b>Customise</b>.', el: '#b-ward', wait: scr('ward') },
        { title: 'Your look', text: 'Pick a tab, then click any item: ones you own are worn at once, locked ones are tried on (buy them with kudos or earn them by playing). Click one.',
            el: '#w-grid', at: 'tl', enter: () => { if (G.screen !== 'ward') UI.openWard(); },
            base: () => ({ l: JSON.stringify(save.look) }), wait: b => !!MENU.tryLook || JSON.stringify(save.look) !== b.l }
    ]
});

// the title's Training button says NEW until a lesson is done
function trainBadge() { const e = $('#b-train'); if (e && save) e.classList.toggle('newb', !Tutor.list.some(l => Tutor.done(l.id))); }
function trainHub() {
    if (!onTitle()) return;
    Tutor.hub({ title: 'Mayhem Marathon training', intro: 'Short lessons where you do each step yourself. Training rounds never count: no crowns, no qualifying, no kudos, and nobody is knocked out. Esc or "Skip lesson" leaves at any time.' });
}
// a new player's first visit: offer First steps once (the answer, or just seeing it, is remembered)
function trainOffer() {
    if (!save || save.tutOffer || Tutor.active || G.screen !== 'title' || save.stats.rounds > 0) return false;
    save.tutOffer = 1; writeSave();
    Tutor.offer({ kicker: 'Welcome', time: '2 minutes', les: 'steps', title: 'New here? Try First steps?', text: 'A training course where nobody is knocked out: run, jump, dive, grab and reach the finish. You do each step yourself.',
        answer: () => trainBadge() });
    return true;
}
$('#b-train').addEventListener('click', () => { sfx('click'); trainHub(); });
function trainHook() {
    return {
        start: id => Tutor.start(id), stop: how => Tutor.stop(how), next: () => Tutor.next(), back: () => Tutor.back(), hub: () => trainHub(), offer: () => trainOffer(), badge: () => trainBadge(),
        get active() { return Tutor.active; }, get lesson() { return Tutor.lesson && Tutor.lesson.id; }, get i() { return Tutor.i; }, get title() { return Tutor.step && Tutor.step.title; },
        get finale() { return Tutor.finale; }, get stepDone() { return Tutor.stepDone; }, get hubOpen() { return Tutor.hubOpen; }, get offerOpen() { return Tutor.offerOpen; },
        get lessons() { return Tutor.list.map(l => ({ id: l.id, title: l.title, steps: l.steps.length, done: Tutor.done(l.id) })); },
        get n() { return G.show && G.show.tutN; }
    };
}
