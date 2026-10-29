
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
  L.party.activity(g ? g.name.replace(/ [\d.]+$/, '') : null, g && gid === PARTY.lastGame ? PARTY.lastCode : null, gid || null);
}
setInterval(partyActivity, 60000);
function partyGameName(id) { var g = id === 'hub' ? null : inviteGame(id); return id === 'hub' ? 'Hub room' : g ? g.name.replace(/ [\d.]+$/, '') : id; }
function partyJoin(game, code) { if (game === 'hub') { showTab('mp'); document.getElementById('mp-code').value = code; mpGo(); } else joinInvite(game, code); }
function partyPaint() {
  var L = window.HGGrapevine, box = document.getElementById('mp-parties'); if (!box || document.getElementById('view-mp').hidden) return;
  var qk = document.getElementById('mp-quick');
  if (!qk.childElementCount) qk.innerHTML = Object.keys(INVITE_GAMES).map(function (id) { return inviteGame(id) ? '<button class="mp-qm" data-qm="' + id + '">' + profEsc(partyGameName(id)) + '</button>' : ''; }).join('');
  if (!L || !L.party || !L.online()) { box.innerHTML = '<div class="rdesc">Sign in to see open parties.</div>'; return; }
  partyNet().then(function (net) {
    L.party.list(net).then(function (m) {
      var row = function (p) { return '<div class="mp-party"><span class="mp-pg">' + profEsc(partyGameName(p.game)) + '</span><span class="mp-ph">' + profEsc(p.host) + (p.mode ? ' · ' + profEsc(p.mode) : '') + '</span><span class="mp-pn">' + p.n + '/' + p.max + '</span>' + (p.near ? '<span class="mp-near">same Wi-Fi</span>' : '') + '<button data-pj="' + profEsc(p.game) + '|' + profEsc(p.code) + '">Join</button></div>'; };
      var all = (m.near || []).concat(m.pub || []);
      box.innerHTML = all.length ? all.map(row).join('') : '<div class="rdesc">No open parties right now. Host one (Quick Match does it for you) and it shows up here.</div>';
      document.getElementById('mp-pnote').textContent = net ? '' : '(could not tell which network you are on: only public parties)';
    }, function () {});
    L.party.friends().then(function (m) {
      var fr = L.friends().friends, nm = {}; fr.forEach(function (f) { nm[f.userId] = f.name; });
      var fb = document.getElementById('mp-friends');
      fb.innerHTML = (m.list || []).length ? m.list.map(function (a) { return '<div class="mp-party"><span class="mp-pg">' + profEsc(nm[a.uid] || 'A friend') + '</span><span class="mp-ph">playing ' + profEsc(a.game) + '</span>' +
        (a.code && a.gid ? '<button data-pj="' + profEsc(a.gid) + '|' + profEsc(a.code) + '">Join</button>' : '') + '</div>'; }).join('') : '<div class="rdesc">None of your friends are playing right now.</div>';
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
setInterval(partyPaint, 10000);
document.getElementById('tab-mp').addEventListener('click', function () { setTimeout(partyPaint, 50); });
