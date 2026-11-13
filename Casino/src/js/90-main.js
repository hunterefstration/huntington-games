// Start-up: the launcher (signed in, online) or the practice mock; the entrance screen; keys; the debug hook.
const forcePractice = /[?&]practice=1\b/.test(location.search);

function gate(reason, waiting) {
  clearView(); document.body.classList.add('at-lobby'); view = { kind: 'gate' };
  const prSw = sw('Practice mode (pretend chips)', false, v => { if (v) boot(true); });
  $('#main').append(h('div', { class: 'gate' }, h('div', { class: 'card' },
    h('div', { class: 'big-ico' }, '🍀🎰'), h('h1', null, 'The Lucky Goon'),
    h('p', null, reason || 'Open the casino from the Huntington Games launcher and sign in to play.'),
    waiting ? h('p', { class: 'small' }, 'Waiting for the Grapevine connection…') : null,
    h('div', { class: 'warn' }, h('b', null, 'Play money only. '), 'Goons and chips are not worth anything outside Huntington Games: they cannot be bought, sold or cashed out for real money or anything else.'),
    h('p', { class: 'small' }, 'Want to look around first? Practice mode plays every game with pretend chips and never talks to the server.'),
    h('div', { class: 'mrow center' }, prSw))));
}
function welcome() {
  if (store.get('welcomed', false) || S.practice) return;
  modal(h('h2', null, '🍀 Welcome to The Lucky Goon'),
    h('p', null, 'Swap goons for chips at the cage (', h('b', { class: 'gold' }, '1 goon = ' + S.limits.rate + ' chips'), ') and play tables, machines and live games with everyone in the casino.'),
    h('div', { class: 'warn' }, h('b', null, 'Play money only. '), 'Goons and chips have no real-money value and cannot be bought, sold or cashed out for anything outside Huntington Games.'),
    h('p', { class: 'small' }, 'Every game keeps a small house edge (listed on the ? page), so over time the house wins. Play for fun.'),
    h('div', { class: 'mrow end' }, h('button', { class: 'btn', onclick: () => { closeModal(); openOdds(); } }, 'See the odds'), h('button', { class: 'btn gold', onclick: () => { store.set('welcomed', true); closeModal(); } }, 'Let\'s play')));
}

let booting = false;
async function boot(practice) {
  if (booting) return; booting = true;
  try {
    if (practice == null) practice = forcePractice;
    if (!practice && mockApi) mockApi.eco.casino('leave').catch(() => {});
    S.ready = false; setApi(practice);
    $('#foot-x').textContent = practice ? '· PRACTICE: pretend chips, nothing is saved.' : '';
    if (!practice) {
      const L = S.api;
      if (!L) return gate();
      if (!L.me || !L.me()) return gate('Sign in to Grapevine in the launcher to play.', false);
      if (L.online && !L.online()) { gate('Connecting to the casino…', true); waitOnline(); return; }
    }
    try { await enter(); } catch (e) { return gate(e.message || 'The casino did not answer.'); }
    openLobby(); welcome();
  } finally { booting = false; }
}
function waitOnline() {           // the launcher is still connecting: try again when it is online
  const L = S.api; let tries = 0;
  const iv = setInterval(() => { tries++; if (S.practice || S.ready || !L || S.api !== L) return clearInterval(iv); if (L.online()) { clearInterval(iv); boot(false); } else if (tries > 60) { clearInterval(iv); gate('The casino is offline right now. Try again in a minute.'); } }, 1000);
}

// ---------- wiring ----------
$('#b-back').onclick = () => openLobby();
$('#b-buy').onclick = () => (S.ready ? cage('buy') : toast('Sign in from the launcher first (or try practice mode).', 'err'));
$('#b-cash').onclick = () => (S.ready ? cage('cash') : toast('Sign in from the launcher first (or try practice mode).', 'err'));
$('#b-odds').onclick = () => openOdds();
$('#b-fast').onclick = () => setFast(!S.fast);
$('#b-mute').onclick = () => setMute(!S.mute);
$('#b-set').onclick = () => openSettings();
$('#logo').onclick = () => (S.ready ? openLobby() : null);
$('#modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal') closeModal(); });
$('#main').addEventListener('pointerdown', () => { sfx.unlock(); if (animating) skip(); }, true);
document.addEventListener('pointerdown', () => sfx.unlock(), { once: true });
setMute(S.mute); setFast(S.fast);

addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) { if (e.key === 'Escape' || e.key === 'Enter') e.target.blur(); return; }
  if (modalOpen()) { if (e.key === 'Escape') closeModal(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape') { if (view && view.kind !== 'lobby' && S.ready) openLobby(); return; }
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (e.repeat) return; if (animating) skip(); else if (S.game && S.game.primary && !S.busy) S.game.primary(); return; }
  if (S.game && S.game.key && !e.repeat && S.game.key(e)) { e.preventDefault(); return; }
  const k = e.key.toLowerCase(); if (k === 'm') setMute(!S.mute); else if (k === 'f') setFast(!S.fast);
});
addEventListener('pagehide', () => { try { if (S.api && S.ready) S.api.eco.casino('leave').catch(() => {}); } catch {} });
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.ready) refreshLive(); });

// ---------- debug hook (tests) ----------
window.__casino = {
  get state() { return S; }, get api() { return S.api; }, get practice() { return S.practice; }, get view() { return view && view.kind === 'game' ? view.id : view && view.kind; },
  open: openGame, lobby: openLobby, odds: openOdds, setFast, setMute, skip, call, boot,
  resolveNext: nextDone, next: nextDone, games: () => GAMES.map(g => ({ id: g.id, group: g.group, title: g.title })),
  shown: () => shownChips()
};
boot();
