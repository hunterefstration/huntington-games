// ---- loading screens --------------------------------------------------------------------------------------------
// 1. The launcher's own boot screen (#boot in shell.html): stays until the hub is ready, then zooms away. The very
//    first run ever gets a longer "welcome" version.
// 2. A loading screen over every game until it has really drawn itself: a little cube runs, hops the spikes and slides
//    back to where it started, on a loop, with silly status lines. 3D games (GL_SIGNAL) say when they are ready by
//    calling parent.HG_gameReady() after their first frame; the others are "ready" once the page has loaded and is
//    drawing smoothly (a few quick animation frames in a row). Never more than 45 s either way.
var GL_SIGNAL = { 'Blocky Shooter V2': 1, Sovereign: 1, 'Steel Storm': 1 };
var GL_QUIPS = ['Sharpening the spikes', 'Feeding the goons', 'Teaching the bots to aim (badly)', 'Polishing every pixel', 'Untangling the wires',
  'Waking up the hamsters', 'Reticulating splines', 'Bribing the final boss', 'Counting to infinity (twice)', 'Loading loading screen', 'Finding the any key',
  'Warming up the lasers', 'Blowing on the cartridge', 'Spawning dramatic music', 'Inflating the hitboxes', 'Herding the pixels', 'Charging the flux capacitor',
  'Buffering the vibes', 'Asking the cube nicely', 'Tightening the bolts'];
var GL = { el: null, t0: 0, armed: false, timer: 0, quipT: 0, id: 0 };
function glEl() {
  if (GL.el) return GL.el;
  var d = document.createElement('div'); d.id = 'gload'; d.hidden = true;
  d.innerHTML = '<div class="gl-bg"></div><div class="gl-in"><div class="gl-name"></div>' +
    '<div class="gl-stage"><div class="gl-track"></div><i class="gl-spike s1"></i><i class="gl-spike s2"></i><i class="gl-spike s3"></i><div class="gl-cube"><b></b><b></b></div></div>' +
    '<div class="gl-bar"><span></span></div><div class="gl-quip"></div></div>';
  document.getElementById('player').appendChild(d);
  return (GL.el = d);
}
function glThumb(g) { try { return BUNDLE ? (BUNDLE.files['img:' + g.img] || '') : (local ? '' : MIRRORS[0]) + 'hub/' + g.img + '.jpg'; } catch (e) { return ''; } }
function glQuip() { var q = GL.el && GL.el.querySelector('.gl-quip'); if (q) { q.classList.remove('in'); void q.offsetWidth; q.textContent = GL_QUIPS[Math.floor(Math.random() * GL_QUIPS.length)] + '...'; q.classList.add('in'); } }
function glShow(g) {
  var d = glEl(); GL.id++; GL.armed = false; GL.t0 = Date.now(); GL.game = g;
  d.querySelector('.gl-name').textContent = g.name;
  var t = g.img ? glThumb(g) : ''; d.querySelector('.gl-bg').style.backgroundImage = t ? 'url("' + t + '")' : '';
  d.style.top = (document.getElementById('ptop').offsetHeight || 41) + 'px'; d.hidden = false; d.classList.remove('out');
  glQuip(); clearInterval(GL.quipT); GL.quipT = setInterval(glQuip, 2200);
  clearTimeout(GL.timer); GL.timer = setTimeout(glHide, 45000);
}
function glHide() {
  var d = GL.el; if (!d || d.hidden || d.classList.contains('out')) return;
  var wait = Math.max(0, 900 - (Date.now() - GL.t0));        // never just a flash
  setTimeout(function () { d.classList.add('out'); clearInterval(GL.quipT); setTimeout(function () { if (d.classList.contains('out')) d.hidden = true; }, 450); }, wait);
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
  var t0 = (window.HG_BOOT_T0 || Date.now()), min = first ? 2600 : 1300;
  var go = function () { setTimeout(function () { b.classList.add('out'); setTimeout(function () { b.remove(); }, 700); }, Math.max(0, min - (Date.now() - t0))); };
  if (document.readyState === 'complete') go(); else addEventListener('load', go);
  setTimeout(function () { if (document.getElementById('boot')) go(); }, 8000);
})();
