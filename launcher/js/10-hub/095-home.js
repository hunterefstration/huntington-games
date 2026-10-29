
// ===== The Games page: a hello, and the games you played last one press away =====
function homeRecent(g) { try { var r = JSON.parse(localStorage.getItem('hgv:recent') || '[]').filter(function (d) { return d !== g.dir; }); r.unshift(g.dir); localStorage.setItem('hgv:recent', JSON.stringify(r.slice(0, 6))); } catch (e) {} homePaint(); }
function homePaint() {
  var L = window.HGGrapevine, me = L && L.me(), e = L && L.eco && L.eco.state(), h = document.getElementById('hello'), j = document.getElementById('jump');
  if (!h || !j) return;
  var hr = new Date().getHours(), part = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  h.innerHTML = me ? part + ', <b>' + profEsc(me.name) + '</b>.' + (e ? ' You have <b class="hgoons">' + (e.dev ? '∞' : e.goons) + ' goons</b> to spend in your <a href="#" id="hello-prof">Profile</a>.' : '') + ' Pick a game.' : 'Pick a game.';
  var hp = document.getElementById('hello-prof'); if (hp) hp.onclick = function (ev) { ev.preventDefault(); showTab('prof'); };
  var r = []; try { r = JSON.parse(localStorage.getItem('hgv:recent') || '[]'); } catch (x) {}
  var gs = r.map(function (d) { return GAMES.filter(function (g) { return g.dir === d; })[0]; }).filter(Boolean).slice(0, 4);
  j.innerHTML = gs.length ? '<div class="jlbl">Jump back in</div>' + gs.map(function (g, i) { return '<button class="jcard" data-jg="' + i + '"><span class="jimg" style="background-image:url(' + (local ? '' : (MIRRORS[0] || '')) + 'hub/' + g.img + '.jpg)"></span><span>' + profEsc(g.name.replace(/ [\d.]+$/, '')) + '</span></button>'; }).join('') : '';
  [].forEach.call(j.querySelectorAll('[data-jg]'), function (b) { b.onclick = function () { play(gs[+b.dataset.jg]); }; });
}
setTimeout(homePaint, 500); setInterval(homePaint, 15000);
