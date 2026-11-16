// Training (1.5): four lessons on the Tutor engine (87-tutor.js), the Training list (title screen), a one-time offer.
// Lessons 1-3 play a TRAINING GAME (G.tut): saveTo() refuses it (no autosave, no quit-save), sovAch() skips it (sov.hgach: the
// leaderboard), lifetime achievements (sov.ach) and the Hall of Leaders are not written, and it is thrown away when the lesson
// ends (G = null, back to the title). Lesson 1 builds it through the real New Game screens; lessons 2-3 start one for France.
// Lessons done: Store 'tut' (sov.tut = { id: 1 }); 'tutOffer' (sov.tutOffer): the offer was shown (new players, once).
const TRN = { want: false, cid: 'FRA', n: { law: 0, diplo: 0, peace: 0, lobby: 0 } };
function trainWants() { return TRN.want; }
Tutor.config({ done: id => !!(Store.get('tut', {}) || {})[id], mark: id => { const o = Store.get('tut', {}) || {}; o[id] = 1; Store.set('tut', o); }, z: 9000 });
// count what the player does in a training game (laws proposed, diplomacy, peace offers, lobbying)
for (const [o, k, c] of [[Politics, 'propose', 'law'], [DiploAct, 'run', 'diplo'], [War, 'peace', 'peace'], [Council, 'lobby', 'lobby']]) {
  const f = o[k]; o[k] = function () { if (G && G.tut) TRN.n[c]++; return f.apply(this, arguments); };
}
const tG = () => !!(G && G.tut);
const tMe = () => G.nations[G.player.idx];
const navBtn = id => () => $(`#nav [data-panel="${id}"]`);
const tPanel = id => () => { if (tG() && Game.panel !== id) { Game.panel = null; Game.open(id); } };
const shown = sel => { const e = $(sel); return !!e && !e.classList.contains('hidden'); };
// throw the training game away and go back to the title
function trainEnd() {
  TRN.want = false;
  if (G && G.tut) { Clock.pause(); UI.closeModal(); Game.close(); G = null; UI.show('title'); }
}
// a training game for lessons 2 and 3 (France: a big economy, a Security Council seat, many neighbours)
function trainGame() {
  if (tG()) return true;
  if (G) return false;
  const c = World.byId[TRN.cid], n0 = World.nat0[c.idx];
  TRN.want = true;
  try {
    newGame({ idx: c.idx, name: n0.leader, title: n0.title, party: 'Governing party', econ: 0, social: 0, traits: [TRAITS[0].id, TRAITS[1].id], face: faceFromName(n0.leader), real: true, scenario: 'standard' });
  } finally { TRN.want = false; }
  Game.start();
  const n = tMe(); n.pc = Math.max(n.pc, 90);      // plenty of political capital to try everything
  return true;
}
const onTitle = () => UI.screen === 'title' && !G;
const chosen = () => G.inbox.filter(m => /^You chose/.test(m.text || '')).length;      // event decisions so far

Tutor.define({
  id: 'first', title: 'Your first year', blurb: 'Pick a country, the main panels, a tax rate, a law, time and your first event (a practice game, thrown away after)', next: 'war',
  begin: () => { if (!onTitle()) return false; TRN.want = true; UI.show('select'); UI.renderList(); return true; },
  finish: () => trainEnd(), atEnd: () => trainEnd(),
  alive: () => !(G && !G.tut) && (UI.screen === 'select' || UI.screen === 'setup' || UI.screen === 'game'),
  end: 'That is a year in office: taxes, laws, time and events. This practice game is thrown away now. Next: <b>War and peace</b>.',
  steps: [
    { title: 'Pick a country', text: 'This is a <b>practice game</b>: it is thrown away afterwards. Click a country on the globe or in this list (search works too).', el: '#sel-list', free: true,
      wait: () => UI.selected != null },
    { title: 'Lead it', text: 'Its card shows the numbers and how hard it is. Press <b>Lead ...</b> to take over.', el: '#sel-card', wait: () => UI.screen === 'setup' },
    { title: 'Take office', text: 'Choose your leader: the real one or your own. Pick <b>2 traits</b>, then press <b>Take office</b>.', el: '#setup .setup-box', at: 'tr', wait: () => tG() && UI.screen === 'game' },
    { title: 'Your numbers', text: 'The bar at the top shows how your country is doing. <b>Click any number</b> to see exactly what pushes it up or down.', el: '#stats', wait: () => shown('#why') },
    { title: 'The panels', text: 'This menu runs the country: <b>Economy</b>, <b>Budget</b> (taxes), <b>Diplomacy</b>, <b>Military</b> and more. Open <b>Economy</b>.', el: '#nav',
      enter: () => $('#why').classList.add('hidden'), wait: () => Game.panel === 'economy' },
    { title: 'Set a tax rate', text: 'Open <b>Budget</b>, move any tax slider (the forecast shows what it will do), then press <b>Pass budget</b>.', el: () => Game.panel === 'budget' ? $('#panel') : navBtn('budget')(),
      base: () => ({ t: JSON.stringify(tMe().tax), s: JSON.stringify(tMe().spend) }), wait: b => JSON.stringify(tMe().tax) !== b.t || JSON.stringify(tMe().spend) !== b.s },
    { title: 'Pass a law', text: 'Open <b>Laws</b>, click a different level of any law, check who cheers and who is angry, then press <b>Propose</b>. Parliament votes on it.', el: () => Game.panel === 'laws' ? $('#panel') : navBtn('laws')(),
      base: () => ({ n: TRN.n.law }), wait: b => TRN.n.law > b.n },
    { title: 'Let time run', text: 'Time is paused. Press <b>play</b> (or Space) and let a month go by. Speeds 1 to 5 make days pass faster.', el: () => $('#btn-pause').parentElement,
      enter: () => Game.close(), base: () => ({ d: G.day }), wait: b => G.day >= b.d + 30 || (G.pendingEvents && G.pendingEvents.length > 0) || !$('#modal').classList.contains('hidden') },
    { title: 'An event', text: 'Things happen: events need a decision. Read it and <b>pick a choice</b>. Each one shows what it will do.', el: () => shown('#modal') ? $('#modal-box') : null,
      enter() {
        Clock.pause();
        if (!shown('#modal')) {
          if (!(G.pendingEvents && G.pendingEvents.length)) { const ctx = eventContext(tMe()), e = EVENTS.find(x => !x.disaster && !x.needRival && !x.needFriend && !x.needPoor && x.choices && x.choices.length > 1); if (e) G.pendingEvents.push({ id: e.id, ctx }); }
          showNextEvent();
        }
      },
      base: () => ({ n: chosen() }), wait: b => chosen() > b.n },
    { title: 'The news', text: '<b>News</b> and <b>People</b> show how everyone reacts to you. Keep your approval up and you stay in power!', el: navBtn('news') }
  ]
});
Tutor.define({
  id: 'war', title: 'War and peace', blurb: 'Relations, alliances, declaring and ending a war, armies (in a practice game)', next: 'council',
  begin: () => onTitle() && trainGame(), finish: () => trainEnd(), atEnd: () => trainEnd(), alive: () => tG() && UI.screen === 'game',
  end: 'Wars are easy to start and hard to end. Most of the time a trade deal does more for you. Next: <b>The World Council and crises</b>.',
  steps: [
    { title: 'Diplomacy', text: 'This is a practice game as France: nothing here counts. Open <b>Diplomacy</b>.', el: navBtn('diplomacy'), wait: () => Game.panel === 'diplomacy' },
    { title: 'Friends and rivals', text: 'Every country has a <b>relation</b> with you, from -100 to +100. Click a country in <b>Closest friends</b> or <b>Biggest rivals</b> (or on the map, then Diplomacy).', el: '#panel', at: 'tr',
      enter: () => { if (Game.panel !== 'diplomacy') { Panels.diploTarget = null; tPanel('diplomacy')(); } }, wait: () => Game.panel === 'diplomacy' && Panels.diploTarget != null },
    { title: 'Make friends', text: 'Their leader, their numbers and what you can do. The % shows how likely they are to say yes. Try an action: a <b>state visit</b>, a <b>trade deal</b>... (talks ask how you open: pick one).', el: () => shown('#modal') ? $('#modal-box') : $('#panel'), at: 'tr', free: true,
      base: () => ({ n: TRN.n.diplo }), wait: b => TRN.n.diplo > b.n && !shown('#modal') },
    { title: 'Alliances', text: 'Good relations open treaties: <b>defence pacts</b> pull allies into your wars (and you into theirs). The Diplomacy overview also lets you join groups like NATO or BRICS.', el: '#panel', at: 'tr' },
    { title: 'Declare war', text: 'Scroll to <b>Military</b> on a country\'s page, pick a goal and press <b>Declare war</b>, then confirm. (Practice: nothing is real.)', el: () => shown('#modal') ? $('#modal-box') : $('#panel'), at: 'tr', free: true,
      wait: () => G.wars.some(w => w.a.includes(G.player.idx)) },
    { title: 'Your army', text: 'Open <b>Military</b>: your forces, your wars and their fronts.', el: navBtn('military'), enter: () => UI.closeModal(), wait: () => Game.panel === 'military' },
    { title: 'Stance', text: 'Set the army\'s <b>stance</b> (defend, balanced, attack) or <b>mobilise</b> the reserves.', el: '#panel', at: 'tr', enter: tPanel('military'),
      base: () => ({ s: tMe().army.stance, m: !!tMe().army.mobilized }), wait: b => tMe().army.stance !== b.s || !!tMe().army.mobilized !== b.m },
    { title: 'Make peace', text: 'Under your war, press <b>Strikes and peace talks</b>, then offer peace: a <b>ceasefire</b> or harder terms. The % is the chance they accept.', el: '#panel', at: 'tr', free: true,
      enter: tPanel('military'), base: () => ({ n: TRN.n.peace }), wait: b => TRN.n.peace > b.n || !G.wars.some(w => w.a.includes(G.player.idx)) }
  ]
});
const votes = () => JSON.stringify(G.council.agenda.map(it => it.vote));
const cnBtn = sel => () => { const e = $('#panel ' + sel); return e && (e.closest('.btnrow') || e); };
Tutor.define({
  id: 'council', title: 'The World Council and crises', blurb: 'Propose a resolution, lobby, vote, fund a global crisis (in a practice game)', next: 'online',
  begin: () => onTitle() && trainGame(), finish: () => trainEnd(), atEnd: () => trainEnd(), alive: () => tG() && UI.screen === 'game',
  end: 'Every four months the votes are counted. Passing resolutions and helping in crises raise your influence. Last lesson: <b>Playing online</b>.',
  steps: [
    { title: 'The World Council', text: 'A practice game as France. Open the <b>Council</b>.', el: navBtn('council'), wait: () => Game.panel === 'council' },
    { title: 'Propose a resolution', text: 'Pick a resolution (sanctions, a world law on climate...), a country if it needs one, and press <b>Propose</b>.', el: cnBtn('#cn-prop'), enter: tPanel('council'),
      wait: () => G.council.agenda.some(it => it.by === G.player.idx) },
    { title: 'Lobby', text: 'Each item on the agenda shows the expected vote. <b>Lobby</b> friendly governments to move it your way.', el: cnBtn('[data-clob]'), enter: tPanel('council'),
      base: () => ({ n: TRN.n.lobby }), wait: b => TRN.n.lobby > b.n },
    { title: 'Vote', text: 'Choose <b>our vote</b> on an item: Yes, No or Abstain. (Tick the box below to let your ambassador vote for you.)', el: cnBtn('[data-cvote]'), enter: tPanel('council'),
      base: () => ({ v: votes() }), wait: b => votes() !== b.v },
    { title: 'A global crisis', text: 'A <b>global crisis</b> just hit (practice). Every country pledges to a world fund; the fuller it is, the less everyone suffers. <b>Pledge</b> some money.',
      el: () => shown('#modal') ? $('#modal-box') : cnBtn('[data-cpl]')(), free: true,
      enter: () => { if (!G.council.crisis) Council.startCrisis('pandemic'); tPanel('council')(); }, wait: () => !!G.council.crisis && (G.council.crisis.pledged[G.player.idx] || 0) > 0 },
    { title: 'Influence', text: 'Your <b>influence</b> decides how far lobbying moves other countries. It grows with your economy, aid, a Security Council seat and a good record.', el: '#panel', at: 'tr',
      enter: () => { UI.closeModal(); tPanel('council')(); } }
  ]
});
Tutor.define({
  id: 'online', title: 'Playing online', blurb: 'Hosting and joining a room, the lobby, scenarios', next: null,
  begin: () => onTitle(), alive: () => UI.screen === 'title' && !G,
  end: 'That is everything! Lessons stay in <b>Training</b> on the title screen if you want them again.',
  steps: [
    { title: 'Play online', text: 'Up to 6 leaders share one world. Press <b>Play online with friends</b>.', el: '#title [data-act="online"]', wait: () => !!$('#on-host') && shown('#modal') },
    { title: 'Open a room', text: '<b>Open a room</b> to host: you get a 6-digit code to give your friends.', el: '#on-host', enter: () => { if (!$('#on-host')) Online.open(); } },
    { title: 'Join a room', text: 'Or type a friend\'s <b>code</b> here and press <b>Join</b>.', el: () => $('#on-code') && $('#on-code').parentElement, enter: () => { if (!$('#on-host')) Online.open(); } },
    { title: 'The lobby', text: 'In the room everyone picks a <b>different country</b>. The host starts the game; countries nobody picked are run by the AI, and the AI takes over if someone leaves.',
      el: () => shown('#modal') ? $('#modal-box') : null, enter: () => { if (!$('#on-host')) Online.open(); } },
    { title: 'Scenarios', text: 'The host also picks the <b>scenario</b>: ' + SCENARIOS.map(s => s.name).join(', ') + '. Each one starts a different world with its own goal. Everyone needs the same version of Sovereign.',
      el: () => shown('#modal') ? $('#modal-box') : null, enter: () => { if (!$('#on-host')) Online.open(); } },
    { title: 'Close', text: 'Press <b>Close</b> to finish.', el: '#on-close', wait: () => !shown('#modal') }
  ]
});

// the title's Training button (NEW until a lesson is done)
function trainButton() { const any = Tutor.list.some(l => Tutor.done(l.id)); return `<button class="btn" data-act="training">🎓 Training${any ? '' : ' <span class="tut-new" id="t-train-new">NEW</span>'}</button>`; }
function trainHub() {
  if (!onTitle()) return;
  Tutor.hub({ title: 'Sovereign training', intro: 'Short lessons where you do each step yourself. Lessons 1 to 3 play a practice game that is thrown away afterwards: it never saves and never counts for achievements or leaderboards. Esc or "Skip lesson" leaves at any time.' });
}
// a new player's first title screen (no saves yet): offer Your first year once
function trainOffer() {
  if (Store.get('tutOffer', false) || Tutor.active || !onTitle() || Saves.latest() || !$('#modal').classList.contains('hidden')) return false;
  Store.set('tutOffer', 1);
  Tutor.offer({ kicker: 'Welcome', time: '4 minutes', les: 'first', title: 'New here? Play a practice year?', text: 'Pick a country, set a tax, pass a law and handle your first event in a practice game that is thrown away afterwards. You do each step yourself.',
    answer: () => { if (UI.screen === 'title') UI.titleButtons(); } });
  return true;
}
// marking a lesson done redraws the title's button
Tutor.config({ mark: id => { const o = Store.get('tut', {}) || {}; o[id] = 1; Store.set('tut', o); if (UI.screen === 'title') UI.titleButtons(); } });
function trainHook() { return {
  start: id => Tutor.start(id), stop: how => Tutor.stop(how), next: () => Tutor.next(), back: () => Tutor.back(), hub: () => trainHub(), offer: () => trainOffer(),
  get active() { return Tutor.active; }, get lesson() { return Tutor.lesson && Tutor.lesson.id; }, get i() { return Tutor.i; }, get title() { return Tutor.step && Tutor.step.title; },
  get finale() { return Tutor.finale; }, get stepDone() { return Tutor.stepDone; }, get hubOpen() { return Tutor.hubOpen; }, get offerOpen() { return Tutor.offerOpen; },
  get lessons() { return Tutor.list.map(l => ({ id: l.id, title: l.title, steps: l.steps.length, done: Tutor.done(l.id) })); }, n: TRN.n, game: () => trainGame()
}; }
