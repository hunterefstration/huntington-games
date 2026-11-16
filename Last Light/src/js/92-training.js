// ==========================================
// TRAINING (1.6): three lessons on the Tutor engine (91-tutor.js), the Training list (title screen), a one-time offer.
// Lesson 1 runs in a practice room (G.start(ROOM): PRAC is set, so no best times, stats, play time or deaths reach the save;
// the room has no gate, so it never finishes). Only the moves you have earned are practised. Lessons 2 and 3 tour the menus.
// Lessons done: SAVE.d.tut[id] = 1 (lumi_save, synced); SAVE.d.tutOffer: the offer was shown (new players, once).
// ==========================================
const ROOM = { id: 'Training', name: 'Practice room', world: 0, gives: null, hint: null, guard: null, par: 0, map: [
    '############################################',
    '#                                          #',
    '#                                          #',
    '#                                          #',
    '#                              =====       #',
    '#                                          #',
    '#                                          #',
    '#                 ====                     #',
    '#                                          #',
    '#                                     ##   #',
    '#        ===                          ##   #',
    '#                                     ##   #',
    '#   P                  L              ##   #',
    '############################################',
    '############################################'] };
Tutor.config({ done: id => !!(SAVE.d.tut && SAVE.d.tut[id]), mark: id => { SAVE.d.tut = SAVE.d.tut || {}; SAVE.d.tut[id] = 1; SAVE.write(); trainBadge(); }, z: 9000, nextKey: 'Enter' });
const kb = k => '<kbd>' + k + '</kbd>';
const AB = () => SAVE.d.abilities || {};
const pc = k => (PRAC && PRAC[k]) || 0;
const inRoom = () => !!(G.L && G.L.def === ROOM && ['play', 'paused', 'dead', 'talk'].includes(G.state));
const onMenu = () => G.state === 'title' || G.state === 'map';
function trainLeave() {
    PRAC = null;
    if (G.L && G.L.def === ROOM && G.state !== 'title' && G.state !== 'map') {
        G.state = 'title'; $('#hud').classList.add('hidden'); UI.show('title'); titleStats(); Sound.musicFor(0);
    }
}
// where each move is learned (its shrine's world), for the moves you do not have yet
const MOVES = { double: 'Double jump', wall: 'Wall jump', dash: 'Dash', glide: 'Glide' };
function missingMoves() {
    return Object.keys(MOVES).filter(k => !AB()[k]).map(k => { const l = LEVELS.find(d => d.gives === k); return '<b>' + MOVES[k] + '</b>' + (l ? ' (' + WORLDS[l.world].name + ')' : ''); });
}
const toTitle = () => { if (G.state === 'map') { G.state = 'title'; UI.show('title'); titleStats(); } };

Tutor.define({
    id: 'moves', title: 'Controls refresher', blurb: 'A practice room for every move you have earned: run, jump, double jump, wall jump, dash, glide', coach: true, next: 'trials',
    begin: () => { if (G.mp || !onMenu()) return false; PRAC = {}; G.trial = null; G.run = null; G.start(ROOM); return inRoom(); },
    finish: () => trainLeave(), atEnd: () => trainLeave(), alive: () => inRoom(),
    end: 'Those are all the moves you have so far. The levels teach the rest at their shrines. Next: <b>Trials, medals and ghosts</b>.',
    steps: [
        { title: 'Run', text: 'This is a practice room: nothing here counts. Hold ' + kb('←') + ' ' + kb('→') + ' (or ' + kb('A') + ' ' + kb('D') + ') to run.',
            base: () => ({ d: pc('dist') }), wait: b => pc('dist') - b.d > 5 },
        { title: 'Jump', text: 'Press ' + kb('Space') + ' (or ' + kb('W') + ', ' + kb('↑') + ', ' + kb('Z') + ') to jump. Hold it to jump higher, tap it for a small hop.',
            base: () => ({ n: pc('jumps') }), wait: b => pc('jumps') > b.n },
        { title: 'Light a lantern', text: 'Run to the <b>lantern</b> and touch it. If you fall, you come back to the last lantern you lit (' + kb('R') + ' takes you there too).',
            base: () => ({ n: pc('lanterns') }), wait: b => pc('lanterns') > b.n },
        { title: 'Double jump', text: 'In the air, press jump <b>again</b> for a second jump.', when: () => AB().double,
            base: () => ({ n: pc('djumps') }), wait: b => pc('djumps') > b.n },
        { title: 'Wall jump', text: 'Jump at a wall and hold toward it to slide down slowly, then press jump to kick off it. Try the pillar on the right.', when: () => AB().wall,
            base: () => ({ n: pc('walljumps') }), wait: b => pc('walljumps') > b.n },
        { title: 'Dash', text: 'Press ' + kb('Shift') + ' or ' + kb('X') + ' to dash. Hold ' + kb('↑') + ' to dash upward. You get one dash in the air until you land.', when: () => AB().dash,
            base: () => ({ n: pc('dashes') }), wait: b => pc('dashes') > b.n },
        { title: 'Glide', text: 'After your double jump, press jump once more and <b>hold</b> it: you float down slowly.', when: () => AB().glide,
            base: () => ({ t: pc('glide') }), wait: b => pc('glide') - b.t > 0.5 },
        { title: 'Still to find', text: '', when: () => missingMoves().length > 0,
            enter() { this.text = 'You have not learned these yet: ' + missingMoves().join(', ') + '. A shrine in that world teaches each one.'; } }
    ]
});
Tutor.define({
    id: 'trials', title: 'Trials, medals and ghosts', blurb: 'Beat the clock on levels you have cleared, win medals, race your ghost', next: 'light',
    begin: () => { if (!onMenu()) return false; toTitle(); return true; }, alive: () => onMenu(),
    end: 'Clear levels in the story to open more trials. Last lesson: <b>Your light</b>.',
    steps: [
        { title: 'Trials', text: 'Open <b>Trials</b>.', el: '#t-trials', enter: () => { if (G.state === 'map' && UI.mapMode !== 'trial') toTitle(); }, wait: () => UI.cur === 'map' && UI.mapMode === 'trial' },
        { title: 'Every level you cleared', text: 'Each level you have cleared in the story is a trial: run it against the clock. Levels you have not cleared yet say <b>Clear it first</b>.',
            el: '#worlds', at: 'tr', enter: () => { if (UI.cur !== 'map' || UI.mapMode !== 'trial') { G.state = 'title'; UI.map('trial'); } } },
        { title: 'Medals', text: 'Beat a time to win a medal: <b>Gold</b> is the level\'s target time, <b>Silver</b> a bit slower, <b>Bronze</b> slower again, and <b>Lumen</b> beats gold by 15%. Your medals are counted here.',
            el: '#m-total', enter: () => { if (UI.cur !== 'map' || UI.mapMode !== 'trial') { G.state = 'title'; UI.map('trial'); } } },
        { title: 'Your ghost', text: 'In a trial a see-through <b>ghost</b> of your best run races you, so you can see where you lose time. Ghosts stay on this device.' },
        { title: 'Start over fast', text: 'In a trial, ' + kb('R') + ' starts the run over at once. Lanterns still catch you, but the clock never stops.' },
        { title: 'Leaderboards', text: 'Medal points (Bronze 1, Silver 2, Gold 3, Lumen 4) go on the launcher\'s <b>Last Light medals</b> board. Story times have boards too.' },
        { title: 'Back to the story', text: 'This button switches between <b>Story</b> and <b>Trials</b>. Press it.', el: '#m-mode',
            enter: () => { if (UI.cur !== 'map') { G.state = 'title'; UI.map('trial'); } }, wait: () => UI.cur === 'map' && UI.mapMode === 'story' }
    ]
});
const scr = id => () => UI.cur === id;
Tutor.define({
    id: 'light', title: 'Your light', blurb: 'Colours and flames, the people you met, playing together', next: null,
    begin: () => { if (!onMenu()) return false; toTitle(); return true; }, alive: () => onMenu() && UI.cur !== 'map',
    end: 'That is everything! Lessons stay in <b>Training</b> on the title screen if you want them again.',
    steps: [
        { title: 'Your light', text: 'Open <b>Your light</b>.', el: '#t-look', wait: scr('look') },
        { title: 'Pick a flame', text: 'Choose the <b>shape</b> of your flame. You can change it back any time.', el: '#lk-shapes', enter: () => { if (UI.cur !== 'look') UI.looks(); },
            base: () => ({ s: SAVE.d.look.shape, p: SAVE.d.look.pal }), wait: b => SAVE.d.look.shape !== b.s || SAVE.d.look.pal !== b.p },
        { title: 'Colours', text: 'Six colours to start with and five more to earn: free a guardian, find the frozen lanterns, win gold medals... Click a locked one to see what it needs.',
            el: '#lk-list', at: 'tl', enter: () => { if (UI.cur !== 'look') UI.looks(); } },
        { title: 'Done', text: 'Press <b>Done</b>.', el: '#lk-done', wait: scr('title') },
        { title: 'People', text: 'Open <b>People</b>: everyone you have met on the way.', el: '#t-lore-btn', wait: scr('lore') },
        { title: 'What they told you', text: 'Everything the people you met told you is kept here, even the lost lanterns\' stories. Press <b>Back</b>.', el: '#lo-done', wait: scr('title') },
        { title: 'Play together', text: 'Open <b>Play together</b>.', el: '#t-mp', wait: scr('mp') },
        { title: 'Open a room', text: '<b>Open a room</b> to host: you get a 6-digit code, pick the level and press Start. Up to 6 lights in one level.', el: '#mp-host',
            enter: () => { if (UI.cur !== 'mp') mpOpen(); } },
        { title: 'Join a friend', text: 'Or type a friend\'s <b>6-digit code</b> here and press <b>Join</b>. Bump into people to push them; ' + kb('F') + ' shoves.', el: '#mp-join-code',
            enter: () => { if (UI.cur !== 'mp') mpOpen(); } },
        { title: 'Back', text: 'Press <b>Back</b> to finish.', el: '#mp-back', wait: scr('title') }
    ]
});

// the title's Training button says "new" until a lesson is done
function trainBadge() { const e = $('#t-train-new'); if (e) e.classList.toggle('hidden', Tutor.list.some(l => Tutor.done(l.id))); }
function trainHub() {
    if (!onMenu()) return;
    Tutor.hub({ title: 'Last Light training', intro: 'Short lessons where you do each step yourself. The practice room never records times, stats or medals. Esc or "Skip lesson" leaves at any time.' });
}
// a new player's first title screen: offer the practice room once (the answer, or just seeing it, is remembered)
function trainOffer() {
    if (SAVE.d.tutOffer || Tutor.active || G.state !== 'title' || Object.keys(SAVE.d.levels).length) return false;
    SAVE.d.tutOffer = 1; SAVE.write();
    Tutor.offer({ kicker: 'Welcome', time: '1 minute', les: 'moves', title: 'New here? Try the practice room?', text: 'Run and jump in a room where nothing counts, then start the story. You do each step yourself.',
        answer: () => trainBadge() });
    return true;
}
on('t-train', () => trainHub());
trainBadge();
setTimeout(trainOffer, 2300);       // after the splash
window.__lumi.tut = {
    start: id => Tutor.start(id), stop: how => Tutor.stop(how), next: () => Tutor.next(), back: () => Tutor.back(), hub: () => trainHub(), offer: () => trainOffer(),
    get active() { return Tutor.active; }, get lesson() { return Tutor.lesson && Tutor.lesson.id; }, get i() { return Tutor.i; }, get title() { return Tutor.step && Tutor.step.title; },
    get finale() { return Tutor.finale; }, get stepDone() { return Tutor.stepDone; }, get hubOpen() { return Tutor.hubOpen; }, get offerOpen() { return Tutor.offerOpen; },
    get lessons() { return Tutor.list.map(l => ({ id: l.id, title: l.title, steps: l.steps.length, done: Tutor.done(l.id) })); },
    get prac() { return PRAC; }, get inRoom() { return inRoom(); }, ROOM
};
