// ---- small shared helpers (used by the pieces after this one) -------------------------------------------------------
// hubShown(): the launcher page itself is on screen (tab showing, no game over it). A timer that only repaints the hub, or
// asks the server for something only the hub shows, skips its work otherwise and registers with hubWake(f) to run as soon
// as the hub is back (tab shown again, game closed).
function hubShown() { return !document.hidden && !document.documentElement.classList.contains('playing'); }
var HUB_WAKE = [];
function hubWake(f) { HUB_WAKE.push(f); }
(function () {
  var was = hubShown();
  function check() { var now = hubShown(); if (now && !was) HUB_WAKE.forEach(function (f) { try { f(); } catch (e) {} }); was = now; }
  document.addEventListener('visibilitychange', check);
  new MutationObserver(check).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
})();
// setHtml(el, html): write innerHTML only when it changed, so a repaint timer does not re-parse the same markup, reload its
// pictures or drop hover/focus every few seconds. Only for elements whose markup is always written through setHtml.
function setHtml(el, html) { if (el && el.hgHtml !== html) { el.hgHtml = html; el.innerHTML = html; } }
