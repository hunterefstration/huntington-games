// ---- bans: a banned device is shut out of the whole launcher (games, chat, accounts), the moment it loads ----------------
// The server bans an account together with every device it ever signed in on (any ban, since 2026-11-04). Here:
// 1. a ban this device already knows about ('hgv:ban') locks the launcher before anything else runs, even offline;
// 2. as soon as Grapevine's code is in, we ask the server about this device (account or not) and lock, or unlock if it
//    was lifted; 3. a ban that lands while someone is playing (the server kicks every session) locks it on the spot.
var BAN = { on: false };
function banLock(text) {
  BAN.on = true;
  try { localStorage.setItem('hgv:ban', JSON.stringify({ text: text || '', at: Date.now() })); } catch (e) {}
  var d = document.getElementById('banwall');
  if (!d) { d = document.createElement('div'); d.id = 'banwall'; (document.body || document.documentElement).appendChild(d); }
  d.innerHTML = '<div class="bw-in"><div class="bw-ic">&#9940;</div><h1>Banned</h1><p>' + String(text || 'This device is banned from Huntington Games.').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }) +
    '</p><p class="bw-sub">This device can no longer use Huntington Games: no games, no chat, no accounts.</p></div>';
  document.documentElement.classList.add('banned');
  try { var f = document.getElementById('frame'); if (f) { f.removeAttribute('srcdoc'); f.src = 'about:blank'; } } catch (e) {}
  try { var g = document.getElementById('gvapp'); if (g) { g.removeAttribute('srcdoc'); g.src = 'about:blank'; } } catch (e) {}
  try { if (typeof popup !== 'undefined' && popup && !popup.closed) popup.close(); } catch (e) {}
}
function banLift() {
  BAN.on = false;
  try { localStorage.removeItem('hgv:ban'); } catch (e) {}
  var d = document.getElementById('banwall'); if (d) d.remove();
  document.documentElement.classList.remove('banned');
}
(function () {
  var b = null; try { b = JSON.parse(localStorage.getItem('hgv:ban') || 'null'); } catch (e) {}
  if (b) banLock(b.text);
  setTimeout(function () {
    // nothing starts while banned
    var p0 = play, pn0 = playNow;
    play = function () { if (BAN.on) return; return p0.apply(this, arguments); };
    playNow = function () { if (BAN.on) return; return pn0.apply(this, arguments); };
    loadGV().then(function (L) {
      if (!L) return;
      if (L.on) L.on('banned', function (e) { banLock(e && e.text); });
      var tries = 0;
      var ask = function () {        // no clear answer (the network was busy): ask again, a few times
        if (!L.banCheck) return;
        L.banCheck().then(function (r) { if (!r) { if (++tries < 8) setTimeout(ask, 6000); return; } if (r.banned) banLock(r.text); else if (BAN.on) banLift(); });
      };
      ask();
    }).catch(function () {});
  }, 0);
})();
