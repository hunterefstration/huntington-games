
// ===== Open parties, Quick Match, friends playing now =====
// Games that host a party tell the launcher (HG_partyOpen, or a code they send with HG_sendInvite), and the launcher
// tells Grapevine, which lists it for people on the same Wi-Fi and, if you allow it, for everyone (grapevine
// src/archive/076-parties.js). "Same Wi-Fi" = the same public address, found and hashed here like Blocky's LAN scan.
var PARTY = { net: null, netAsked: false, lastCode: '', lastGame: '', timer: 0 };
function partyNet() {
  if (PARTY.netAsked) return Promise.resolve(PARTY.net); PARTY.netAsked = true;
  return new Promise(function (res) {
    var done = false, fin = function (v) { if (done) return; done = true; PARTY.net = v; try { pc.close(); } catch (e) {} res(v); }, pc;
    try {
      pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }); pc.createDataChannel('x');
      pc.onicecandidate = function (e) { var c = e.candidate && e.candidate.candidate; if (!c || c.indexOf(' typ srflx') < 0) return;
        crypto.subtle.digest('SHA-256', new TextEncoder().encode(c.split(' ')[4] + 'hgparty')).then(function (b) { fin([].slice.call(new Uint8Array(b)).map(function (x) { return ('0' + x.toString(16)).slice(-2); }).join('').slice(0, 12)); }, function () { fin(null); }); };
      pc.createOffer().then(function (o) { return pc.setLocalDescription(o); }).catch(function () { fin(null); });
      setTimeout(function () { fin(null); }, 4500);
    } catch (e) { fin(null); }
  });
}
function partyPub() { var c = document.getElementById('mp-pub'); return !c || c.checked; }
// a game hosting a party: { game: 'blocky', code: '123456', n: players, max, mode }
window.HG_partyOpen = function (o) {
  var L = window.HGGrapevine; if (!L || !L.party || !o || !/^[A-Za-z0-9-]{4,12}$/.test(String(o.code))) return false;
  PARTY.lastCode = String(o.code); PARTY.lastGame = o.game;
  partyNet().then(function (net) { L.party.open({ game: o.game, code: o.code, n: o.n, max: o.max, mode: o.mode, pub: o.pub !== false && partyPub(), net: net }); });
  partyActivity(); return true;
};
window.HG_partyClose = function (code) { var L = window.HGGrapevine; if (L && L.party) L.party.close(code); if (PARTY.lastCode === String(code)) PARTY.lastCode = ''; partyActivity(); };
function partyActivity() {
  var L = window.HGGrapevine; if (!L || !L.party || !L.online()) return;
  var g = typeof current !== 'undefined' && current && current.game;
  var gid = g ? Object.keys(INVITE_GAMES).filter(function (k) { return INVITE_GAMES[k] === g.dir; })[0] : null;
  var away = typeof hgIdle === 'function' && hgIdle();      // AFK for 30 minutes: still shown in the game, but no party code, so no multiplayer bonus
  L.party.activity(g ? g.name.replace(/ [\d.]+$/, '') : null, g && gid === PARTY.lastGame && !away ? PARTY.lastCode : null, gid || null);
}
setInterval(partyActivity, 60000);
function partyGameName(id) { var g = id === 'hub' ? null : inviteGame(id); return id === 'hub' ? 'Hub room' : g ? g.name.replace(/ [\d.]+$/, '') : id; }
function partyJoin(game, code) { if (game === 'hub') { showTab('mp'); document.getElementById('mp-code').value = code; mpGo(); } else joinInvite(game, code); }
// the Multiplayer tab (2026-11-16): a live header, Quick Play as game cards (with how many open matches each has), "Live
// now" as cards (friends' games first), and the multiplayer bonus. It asks the server only while the tab is showing.
function partyThumb(id) { var g = id === 'hub' ? null : inviteGame(id); try { return g && g.img ? glThumb(g) : ''; } catch (e) { return ''; } }
function partyCard(p, friend) {
  var t = partyThumb(p.game), full = Math.min(100, Math.round(100 * p.n / Math.max(1, p.max)));
  return '<div class="mp-card' + (friend ? ' fr' : '') + '"><div class="mp-cimg"' + (t ? ' style="background-image:url(&quot;' + t + '&quot;)"' : '') + '>' + (p.near ? '<span class="mp-near">same Wi-Fi</span>' : '') + (friend ? '<span class="mp-frb">friend</span>' : '') + '</div>' +
    '<div class="mp-cbody"><b>' + profEsc(partyGameName(p.game)) + '</b><span class="mp-ph">' + profEsc(friend ? friend : p.host) + (p.mode ? ' · ' + profEsc(p.mode) : '') + '</span>' +
    (p.max ? '<div class="mp-fill"><i style="width:' + full + '%"></i></div><span class="mp-pn">' + p.n + ' / ' + p.max + ' players</span>' : '') +
    '<button class="mp-join" data-pj="' + profEsc(p.game) + '|' + profEsc(p.code) + '">Join</button></div></div>';
}
function partyBonus(b) {
  var box = document.getElementById('mp-bonus'); if (!box) return;
  if (!b) { box.innerHTML = '<div class="mp-bring"><i style="--v:0"></i><span>🎁</span></div><div><b>Multiplayer bonus</b><span>Goons for every 10 minutes you play with other people.</span></div>'; return; }
  var v = b.today >= b.cap ? 1 : b.min / b.every;
  box.className = 'mp-bonus' + (b.happy ? ' happy' : '') + (b.playing ? ' on' : '');
  box.innerHTML = '<div class="mp-bring"><i style="--v:' + v.toFixed(2) + '"></i><span>' + (b.happy ? '×2' : '🎁') + '</span></div><div><b>' + (b.happy ? 'Double goons right now!' : 'Multiplayer bonus') + '</b>' +
    '<span>' + (b.today >= b.cap ? 'All ' + b.cap + ' bonus goons earned today. Back tomorrow!' : (b.playing ? (b.every - b.min) + ' min to +' + b.pay + ' goons' : '+' + b.pay + ' goons every ' + b.every + ' min you play with others')) + '</span>' +
    '<span class="mp-today">' + b.today + ' / ' + b.cap + ' today</span></div>';
}
function partyPaint() {
  var L = window.HGGrapevine, box = document.getElementById('mp-parties'); if (!box || document.getElementById('view-mp').hidden || !hubShown()) return;   // server asks: only while it shows
  var qk = document.getElementById('mp-quick');
  var paintQuick = function (counts) {
    setHtml(qk, Object.keys(INVITE_GAMES).map(function (id) {
      if (!inviteGame(id)) return ''; var t = partyThumb(id), n = (counts || {})[id] || 0;
      return '<button class="mp-qm" data-qm="' + id + '"><span class="mp-qimg"' + (t ? ' style="background-image:url(&quot;' + t + '&quot;)"' : '') + '></span><b>' + profEsc(partyGameName(id)) + '</b><span class="mp-qn' + (n ? ' live' : '') + '">' + (n ? n + ' open' : 'Start one') + '</span></button>';
    }).join(''));
  };
  if (!qk.childElementCount) paintQuick();
  if (!L || !L.party || !L.online()) { setHtml(box, '<div class="rdesc">Sign in to see the games people are hosting.</div>'); partyBonus(null); return; }
  if (!partyPaint.hooked && L.on) { partyPaint.hooked = true; L.on('mpBonus', partyBonus); }
  partyBonus(L.party.bonus ? L.party.bonus() : null);
  partyNet().then(function (net) {
    L.party.list(net).then(function (m) {
      var all = (m.near || []).concat(m.pub || []), counts = {}, players = 0;
      all.forEach(function (p) { counts[p.game] = (counts[p.game] || 0) + 1; players += p.n || 0; });
      paintQuick(counts);
      setHtml(box, all.length ? all.map(function (p) { return partyCard(p); }).join('') : '<div class="mp-empty"><b>Nobody is hosting right now.</b><span>Be the first: pick a game in Quick Play and others can join you.</span></div>');
      var live = document.getElementById('mp-live');
      if (live) live.innerHTML = '<span class="mp-livedot' + (all.length ? ' on' : '') + '"></span>' + (all.length ? all.length + ' open game' + (all.length > 1 ? 's' : '') + ' · ' + players + ' playing' : 'No open games yet. Start one!');
      document.getElementById('mp-pnote').textContent = net ? '' : '(could not tell which network you are on: only public games)';
    }, function () {});
    L.party.friends().then(function (m) {
      var fr = L.friends().friends, nm = {}; fr.forEach(function (f) { nm[f.userId] = f.name; });
      var fb = document.getElementById('mp-friends'), list = (m.list || []).filter(function (a) { return nm[a.uid]; });
      setHtml(fb, list.map(function (a) { return a.code && a.gid ? partyCard({ game: a.gid, code: a.code, host: nm[a.uid], n: 0, max: 0 }, nm[a.uid] + ' is playing') :
        '<div class="mp-card fr off"><div class="mp-cimg"><span class="mp-frb">friend</span></div><div class="mp-cbody"><b>' + profEsc(nm[a.uid]) + '</b><span class="mp-ph">playing ' + profEsc(a.game) + '</span></div></div>'; }).join(''));
    }, function () {});
  });
}
function quickMatch(game) {
  var L = window.HGGrapevine; if (!L || !L.party || !L.online()) { hubToast('Sign in for Quick Match.'); return; }
  partyNet().then(function (net) {
    L.party.list(net, game).then(function (m) {
      var p = (m.near || [])[0] || (m.pub || [])[0];
      if (p) { hubToast('Joining ' + p.host + "'s party..."); joinInvite(game, p.code); }
      else { hubToast('No open party: hosting one for you. It shows up for others in a moment.'); window.HG_hostInvite(game, 'party:public'); }
    }, function () {});
  });
}
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('#view-mp button'); if (!b) return;
  if (b.dataset.qm) quickMatch(b.dataset.qm);
  else if (b.dataset.pj) { var x = b.dataset.pj.split('|'); partyJoin(x[0], x[1]); }
});
setInterval(partyPaint, 10000); hubWake(partyPaint);
document.getElementById('tab-mp').addEventListener('click', function () { setTimeout(partyPaint, 50); });
