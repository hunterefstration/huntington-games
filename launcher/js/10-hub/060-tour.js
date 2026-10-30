
// ===== The tour: ONE walkthrough for the launcher and Grapevine =====
// It used to be two (a slideshow here, and Grapevine's own point-and-press tour). Now this one goes through the games,
// your profile, the Goon Shop, the leaderboards and multiplayer, then into Grapevine itself (targets inside its frame),
// in one style, one counter. Grapevine hands /guide and its welcome offer to this (window.HG_tour) and reports what you
// do in it (HG_tour.event: 'sent', 'closed', ...). The ? in the top bar replays it any time.
var HT = { on: false, i: 0, steps: [], target: null, raf: 0, lastBox: '', clickOff: null };
function htGv() { try { var f = document.getElementById('gvapp'); return f && f.contentDocument && f.contentDocument.getElementById('text') ? f.contentDocument : null; } catch (e) { return null; } }
function htSteps() {
  var gvFind = function (fn) { return function () { var d = htGv(); return d ? fn(d) : null; }; };
  return [
    { title: 'Welcome to Huntington Games', text: 'One account for every game, your profile, and Grapevine chat. Two minutes: we point at things, you press them. Skip any time.', center: true, next: 'Start' },
    { target: '#grid .game', title: 'Games', text: 'Every card is a game. Press one to play: it saves to your account by itself, on any computer you sign in on.', next: 'Next' },
    { target: '#chip', title: 'Your profile', text: 'This is you: your picture, your goons and your title. Press it.', wait: 'click' },
    { target: '[data-ptab="shop"]', title: 'The Goon Shop', text: '<b>Goons</b> come from playing: every achievement, 15 minutes of play, Blocky waves and ranks, daily top spots. Spend them here on pictures, banners, titles and Blocky skins. Press it.', wait: 'click' },
    { target: '#tab-lb', title: 'Leaderboards', text: 'Every game has global leaderboards, all in this tab. Your rank (R1 is the best, R5 the lowest) shows next to your name in chat, and first place is the <b>Record Holder</b>. Press it.', wait: 'click' },
    { target: '#tab-mp', title: 'Multiplayer', text: 'Type <b>any 6-digit code</b> and you are in a room with whoever types the same one: chat, then start a game together. Press it.', wait: 'click' },
    { target: '#tab-chat', title: 'Grapevine', text: 'Chat rooms, DMs and friends, built in. Press it and we will show you around inside.', wait: 'click' },
    { gv: true, target: gvFind(function (d) { return d.querySelector('#convs [data-conv="main"]'); }),
      title: 'Rooms', text: '<b>#main</b> is where everyone hangs out (it starts fresh every day). Press it.', wait: 'click' },
    { gv: true, target: gvFind(function (d) { return d.getElementById('text'); }), title: 'Say hi', text: 'Type anything and press <b>Enter</b>. Try the 😊 button for emojis.', wait: 'sent', focus: true },
    { gv: true, target: gvFind(function (d) { return d.getElementById('actBtn'); }), title: 'Actions', text: 'Polls, dice, a coin, custom-length timers, confetti. Press <b>+</b> to look (close it to go on).', wait: 'click' },
    { gv: true, target: gvFind(function (d) { return d.getElementById('friendsBtn'); }), title: 'Friends', text: 'Add people by name, see who is online, start a DM. Press a name anywhere for their card: you can give them a <b>nickname</b> only you see.', next: 'Next' },
    { target: '#tab-acct', title: 'Your account', text: 'Your <b>recovery key</b> IS your account: nobody can reset it. Press here and save it somewhere safe (Copy or Download).', wait: 'click' },
    { title: 'That is everything', text: 'Have fun. The <b>?</b> at the top replays this tour whenever you want.', center: true, next: 'Done' }
  ];
}
function htEl() {
  var s = HT.steps[HT.i]; if (!s || !s.target) return null;
  var t = typeof s.target === 'function' ? s.target() : document.querySelector(s.target);
  if (!t) return null; var r = t.getBoundingClientRect(); if (!r.width || !r.height) return null;
  return t;
}
function htRect(t) {
  var r = t.getBoundingClientRect(), s = HT.steps[HT.i];
  if (s && s.gv) { var f = document.getElementById('gvapp').getBoundingClientRect(); return { left: r.left + f.left, top: r.top + f.top, width: r.width, height: r.height, right: r.right + f.left, bottom: r.bottom + f.top }; }
  return r;
}
function htStart(from) {
  if (HT.on) return;
  HT.steps = htSteps(); HT.i = 0; HT.on = true;
  if (from === 'chat') { HT.i = HT.steps.findIndex(function (s) { return s.gv; }); showTab('chat'); }
  var root = document.getElementById('htour');
  if (!root) {
    root = document.createElement('div'); root.id = 'htour';
    root.innerHTML = '<div id="htHole"></div><div id="htCard"><div class="httop"><span id="htN"></span><button id="htSkip">Skip tour</button></div><b id="htT"></b><div id="htX"></div><div class="htfoot"><span id="htHint"></span><button id="htNext">Next</button></div></div>';
    document.body.appendChild(root);
    document.getElementById('htSkip').onclick = function () { htEnd(false); };
    document.getElementById('htNext').onclick = htNext;
  }
  root.className = 'on'; htShow();
}
function htEnd(done) {
  HT.on = false; cancelAnimationFrame(HT.raf); if (HT.clickOff) HT.clickOff();
  var r = document.getElementById('htour'); if (r) r.className = '';
  try { localStorage.setItem('hgv:tour', '2'); } catch (e) {}
  if (typeof hubToast === 'function') hubToast(done ? 'Tour done. The ? at the top replays it.' : 'Skipped. The ? at the top replays the tour any time.');
}
function htNext() { if (!HT.on) return; HT.i++; if (HT.i >= HT.steps.length) return htEnd(true); htShow(); }
function htShow() {
  var s = HT.steps[HT.i]; if (!s) return htEnd(true);
  if (HT.clickOff) { HT.clickOff(); HT.clickOff = null; }
  var t = s.target ? htEl() : null;
  if (s.target && !t) {           // not on screen yet (the chat still loading, a tab still opening): wait, then skip
    s._tries = (s._tries || 0) + 1; document.getElementById('htour').classList.add('bare');
    if (s._tries < (s.gv ? 45 : 12)) { setTimeout(function () { if (HT.on && HT.steps[HT.i] === s) htShow(); }, 350); return; }
    return htNext();
  }
  HT.target = t;
  document.getElementById('htN').textContent = (HT.i + 1) + ' / ' + HT.steps.length;
  document.getElementById('htT').textContent = s.title;
  document.getElementById('htX').innerHTML = s.text;
  var nb = document.getElementById('htNext'); nb.style.display = s.next ? '' : 'none'; nb.textContent = s.next || 'Next';
  document.getElementById('htHint').textContent = s.wait === 'click' ? 'press the highlighted thing' : s.wait === 'sent' ? 'send a message to go on' : '';
  var card = document.getElementById('htCard'); card.className = s.center ? 'center' : '';
  document.getElementById('htour').classList.toggle('bare', !t);
  if (t && s.wait === 'click') {
    var doc = t.ownerDocument, h = function (e) { var cur = htEl(); if ((cur && cur.contains(e.target)) || (HT.target && HT.target.contains(e.target))) setTimeout(htNext, 120); };   // Grapevine redraws its lists: match the current element
    doc.addEventListener('click', h, true); HT.clickOff = function () { doc.removeEventListener('click', h, true); };
  }
  if (t && s.focus) setTimeout(function () { try { t.focus(); } catch (e) {} }, 80);
  HT.lastBox = ''; cancelAnimationFrame(HT.raf); htPlace();
}
function htPlace() {
  if (!HT.on) return;
  var hole = document.getElementById('htHole'), card = document.getElementById('htCard'), s = HT.steps[HT.i];
  if (HT.target && !HT.target.isConnected) HT.target = htEl() || HT.target;      // redrawn: follow the new one
  if (HT.target && HT.target.isConnected) {
    var r = htRect(HT.target), pad = 6, box = [r.left, r.top, r.width, r.height].map(Math.round).join('|');
    if (box !== HT.lastBox) {
      HT.lastBox = box;
      hole.style.left = (r.left - pad) + 'px'; hole.style.top = (r.top - pad) + 'px'; hole.style.width = (r.width + pad * 2) + 'px'; hole.style.height = (r.height + pad * 2) + 'px';
      if (!s.center) {
        var cw = card.offsetWidth || 320, ch = card.offsetHeight || 150, below = r.bottom + 14 + ch < innerHeight;
        var top = below ? r.bottom + 14 : Math.max(8, r.top - 14 - ch), left = Math.min(Math.max(8, r.left), innerWidth - 8 - cw);
        card.style.left = left + 'px'; card.style.top = top + 'px'; card.classList.toggle('above', !below);
      } else card.style.left = card.style.top = '';
    }
  } else if (HT.lastBox !== 'none') {
    HT.lastBox = 'none'; hole.style.left = '50%'; hole.style.top = '50%'; hole.style.width = hole.style.height = '0px'; card.style.left = card.style.top = '';
  }
  HT.raf = requestAnimationFrame(htPlace);
}
window.HG_tour = {
  start: function (from) { htStart(from); },
  // Grapevine reports what you did; a step waiting for it moves on
  event: function (name) {
    if (!HT.on) return; var s = HT.steps[HT.i]; if (!s || s.wait !== name) return;
    if (name === 'closed') { setTimeout(function () { var d = htGv(); if (HT.on && HT.steps[HT.i] === s && !(d && d.querySelector('.modal.on'))) htNext(); }, 300); return; }
    setTimeout(htNext, 250);
  },
  on: function () { return HT.on; }
};
document.addEventListener('keydown', function (e) { if (HT.on && e.key === 'Escape') htEnd(false); });
document.getElementById('tourBtn').onclick = function () { closePlayer(); showTab('games'); setTimeout(function () { htStart(); }, 50); };
