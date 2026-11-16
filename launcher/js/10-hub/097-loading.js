// ---- loading screens --------------------------------------------------------------------------------------------
// 1. The launcher's own boot screen (launcher/boot.html + boot.css, the same screen loader.html shows while it downloads
//    the launcher, so it carries on seamlessly): stays until the hub is ready, then fades away. The very first run ever
//    gets a longer "welcome" version.
// 2. A loading screen over every game until it has really drawn itself: the game's picture as a card over its own
//    blurred colours, a moving bar, what is happening, and tips (for that game and in general) with the odd silly line. 3D games (GL_SIGNAL) say when they are ready by
//    calling parent.HG_gameReady() after their first frame; the others are "ready" once the page has loaded and is
//    drawing smoothly (a few quick animation frames in a row). Never more than 45 s either way.
var GL_SIGNAL = { 'Blocky Shooter V2': 1, Sovereign: 1, 'Steel Storm': 1 };
var GL_QUIPS = ['Sharpening the spikes', 'Feeding the goons', 'Teaching the bots to aim (badly)', 'Polishing every pixel', 'Untangling the wires',
  'Waking up the hamsters', 'Reticulating splines', 'Bribing the final boss', 'Counting to infinity (twice)', 'Loading loading screen', 'Finding the any key',
  'Warming up the lasers', 'Blowing on the cartridge', 'Spawning dramatic music', 'Inflating the hitboxes', 'Herding the pixels', 'Charging the flux capacitor',
  'Buffering the vibes', 'Asking the cube nicely', 'Tightening the bolts'];
var GL_TIPS = ['Press T in any game to chat without leaving it.', 'Play every day: the daily check-in gives you a goon.', 'Goons buy pets, frames and chat bubbles in the Profile shop.',
  'Start a party in Multiplayer and your friends join your game in one click.', 'Every game has a leaderboard. Can you get on one?', 'Your saves live in your account: sign in on any device and keep playing.',
  'Found a bug? Tell us in #bugs-and-ideas or with the Report button.', 'Rare titles shimmer, and you only get them by playing.', 'Make your own songs in Beat Lab and share them in #music.'];
var GL_GAME_TIPS = {
  'Steel Storm': ['Hold your aim on a target for half a second: a red LOCK means the missile will guide.', 'Mix your lineup: a bomber for tanks, a fighter to clear the sky.', 'Flares (F) fool heat-seeking missiles some of the time.'],
  'Last Light': ['Every guardian you beat gives you a new move.', 'Moths are hidden off the main path. Look up.', 'Dying is fine. The fastest runs come from learning each room.'],
  'Blocky Shooter V2': ['Headshots count double.', 'Each class plays differently: try them all in the armory.', 'Prestige resets your rank but keeps your best gear.'],
  'Sovereign': ['A strong economy wins long games.', 'Defend your capital: losing it costs you the most.'],
  'Brown E Clicker': ['Golden Es are rare: click them fast.', 'Ascending gives heavenly chips that make every run faster.'],
  'Beat Lab': ['Space plays and stops. Try a demo song first.', 'Simple mode is a great sketchpad: open your idea in the Studio later.'],
  'Mayhem Marathon': ['Grab the tail and hold on: the timer is your friend.'],
  'Market Life 1.9': ['Buy low, sell high, and never put everything in one stock.']
};
var GL = { el: null, t0: 0, armed: false, timer: 0, quipT: 0, id: 0 };
function glEl() {
  if (GL.el) return GL.el;
  var d = document.createElement('div'); d.id = 'gload'; d.hidden = true;
  d.innerHTML = '<div class="gl-bg"></div><div class="gl-in"><div class="gl-card"></div><div class="gl-name"></div>' +

    '<div class="gl-bar"><span></span></div><div class="gl-stage-txt"></div><div class="gl-quip"></div><div class="gl-err" hidden></div></div>';
  document.getElementById('player').appendChild(d);
  return (GL.el = d);
}
function glThumb(g) { try { return BUNDLE ? (BUNDLE.files['img:' + g.img] || '') : (local ? '' : MIRRORS[0]) + 'hub/' + g.img + '.jpg'; } catch (e) { return ''; } }
// what is really happening, under the bar ("Downloading", "Starting"), and a failed load with a way to try again
function glStage(t) { var e = GL.el && GL.el.querySelector('.gl-stage-txt'); if (e) e.textContent = t ? t + '...' : ''; }
function glFail(g, why) {
  var d = glEl(); clearInterval(GL.quipT); clearTimeout(GL.timer); d.classList.add('fail');
  d.querySelector('.gl-quip').textContent = '';
  d.querySelector('.gl-stage-txt').innerHTML = '';
  var box = d.querySelector('.gl-err'); box.hidden = false;
  box.innerHTML = '<b>Could not load ' + String(g.name).replace(/[<&]/g, '') + '</b><span></span><button class="mbtn" id="gl-retry">Try again</button><button class="mbtn ghost" id="gl-back">Back to the games</button>';
  box.querySelector('span').textContent = why;
  box.querySelector('#gl-retry').onclick = function () { window.HG_retryGame(); };
  box.querySelector('#gl-back').onclick = function () { document.getElementById('back').click(); };
}
function glQuip() {
  var q = GL.el && GL.el.querySelector('.gl-quip'); if (!q) return;
  var own = (GL.game && (GL_GAME_TIPS[GL.game.dir] || GL_GAME_TIPS[GL.game.name])) || [], r = Math.random(), t;
  if (own.length && r < .5) t = own[Math.floor(Math.random() * own.length)];
  else if (r < .85) t = GL_TIPS[Math.floor(Math.random() * GL_TIPS.length)];
  else t = GL_QUIPS[Math.floor(Math.random() * GL_QUIPS.length)] + '...';
  q.classList.remove('in'); void q.offsetWidth; q.textContent = t; q.classList.add('in');
}
function glShow(g) {
  var d = glEl(); GL.id++; GL.armed = false; GL.t0 = Date.now(); GL.game = g;
  d.querySelector('.gl-name').textContent = g.name;
  var t = g.img ? glThumb(g) : ''; d.querySelector('.gl-bg').style.backgroundImage = d.querySelector('.gl-card').style.backgroundImage = t ? 'url("' + t + '")' : '';
  d.style.top = (document.getElementById('ptop').offsetHeight || 41) + 'px'; d.hidden = false; d.classList.remove('out'); d.classList.remove('fail'); d.querySelector('.gl-err').hidden = true; glStage('');
  glQuip(); clearInterval(GL.quipT); GL.quipT = setInterval(glQuip, 3600);
  clearTimeout(GL.timer); GL.timer = setTimeout(glHide, 45000);
}
function glHide() {
  var d = GL.el; if (!d || d.hidden || d.classList.contains('out')) return;
  var wait = Math.max(0, 450 - (Date.now() - GL.t0));        // never just a flash (was 900 ms: a saved game is ready sooner than that)
  setTimeout(function () { d.classList.add('out'); clearInterval(GL.quipT); glFocus(); setTimeout(function () { if (d.classList.contains('out')) d.hidden = true; }, 450); }, wait);
}
// hand the keyboard to the game once it is showing: a game started without a click inside it (an invite, Join, a
// party) otherwise kept the keyboard on the launcher, and you spawned in unable to move until you clicked
function glFocus() {
  var a = document.activeElement;
  if (a && a !== document.body && a !== frame && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;      // typing in the chat dock
  try { frame.focus(); frame.contentWindow.focus(); } catch (e) {}
}
// the real game page has been put into the frame: from now on its load counts
function glArm() {
  GL.armed = true;
  if (!GL.game || GL_SIGNAL[GL.game.dir]) return;
  var id = GL.id;
  var onLoad = function () {
    frame.removeEventListener('load', onLoad);
    if (id !== GL.id) return;
    var w; try { w = frame.contentWindow; w.document; } catch (e) { setTimeout(glHide, 800); return; }
    var last = 0, good = 0, start = performance.now();
    var tick = function (t) {
      if (id !== GL.id || !GL.el || GL.el.hidden) return;
      if (last) { if (t - last < 50) good++; else good = 0; }
      last = t;
      if (good >= 8 && performance.now() - start > 400) return glHide();
      try { w.requestAnimationFrame(tick); } catch (e) { glHide(); }
    };
    try { w.requestAnimationFrame(tick); } catch (e) { glHide(); }
  };
  frame.addEventListener('load', onLoad);
}
window.HG_gameReady = function () { if (GL.armed) glHide(); };
// hook into the player (020 piece): show when a game opens, arm when its page goes in, hide when it closes
(function () {
  var pn = playNow, cp = closePlayer;
  playNow = function (g) {
    glShow(g);
    var r = pn.apply(this, arguments);
    if (local) glArm();
    else { var id = GL.id, iv = setInterval(function () { if (id !== GL.id || !current) return clearInterval(iv); if (current.html) { clearInterval(iv); glArm(); } }, 50); }
    return r;
  };
  closePlayer = function () { GL.id++; clearTimeout(GL.timer); clearInterval(GL.quipT); if (GL.el) { GL.el.hidden = true; } return cp.apply(this, arguments); };
})();
// the boot screen: away once the hub has drawn its cards
(function () {
  var b = document.getElementById('boot'); if (!b) return;
  var first = false; try { first = !localStorage.getItem('hgv:booted'); localStorage.setItem('hgv:booted', '1'); } catch (e) {}
  if (first) b.classList.add('first');
  var t0 = (window.HG_BOOT_T0 || Date.now()), min = first ? 2000 : 600;      // (was 2600 / 1300 ms)
  // progress carries on from where loader.html left it (an older pasted loader leaves nothing: start part way)
  var p = Math.max(.35, Math.min(.85, +window.HG_LOAD_P || 0)), msg = document.getElementById('msg'), tip = b.querySelector('.bt-tip');
  b.style.setProperty('--p', p); if (msg) msg.textContent = 'Opening the launcher';
  var creep = setInterval(function () { p = Math.min(.95, p + (.95 - p) * .18); b.style.setProperty('--p', p); }, 300);
  var ti = Math.floor(Math.random() * GL_TIPS.length); if (tip && !tip.textContent) tip.textContent = GL_TIPS[ti];
  var tipT = setInterval(function () { if (!tip) return; tip.classList.add('dim'); setTimeout(function () { ti = (ti + 1) % GL_TIPS.length; tip.textContent = GL_TIPS[ti]; tip.classList.remove('dim'); }, 400); }, 3800);
  var go = function () {
    if (go.done) return; go.done = true; clearInterval(creep);
    b.style.setProperty('--p', 1); if (msg) msg.textContent = 'Ready';
    setTimeout(function () { clearInterval(tipT); b.classList.add('out'); setTimeout(function () { b.remove(); }, 700); }, Math.max(250, min - (Date.now() - t0)));
  };
  if (document.readyState === 'complete') go(); else addEventListener('load', go);
  setTimeout(function () { if (document.getElementById('boot')) go(); }, 8000);
})();
