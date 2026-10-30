// --- running a game from the saved copy ---
function blobFor(url) { // library -> blob: url, made once per session
  if (blobUrls[url]) return blobUrls[url];
  return blobUrls[url] = getRec('lib:' + url).then(function (r) {
    if (!r) return null;
    return getMeta().then(function (meta) {
      var t = r.text, type = /\.css$|fonts\.googleapis\.com/.test(url) ? 'text/css' : 'text/javascript';
      if (meta.mods[url]) t = rewriteRel(t, url);
      return URL.createObjectURL(new Blob([t], { type: type }));
    });
  });
}
async function inlineLibs(html, g) {
  var meta = await getMeta(), urls = (meta.libs || {})[g.dir];
  if (!urls || !urls.length) return html;
  var blobs = {}, have = [];
  for (var k = 0; k < urls.length; k++) { var b = await blobFor(urls[k]); if (b) { blobs[urls[k]] = b; have.push(urls[k]); } }
  var imap = importMapOf(html), holder = '\u0001HGMAP\u0001', mapText = null;
  if (imap) {
    var im = imap.imports;
    have.forEach(function (u) {
      Object.keys(im).forEach(function (key) {
        var val = im[key];
        if (val === u) im[key] = blobs[u];
        else if (/\/$/.test(key) && /\/$/.test(val) && u.indexOf(val) === 0) im[key + u.slice(val.length)] = blobs[u];
      });
      if (meta.mods[u]) im[u] = blobs[u]; // rewritten relative imports point here
    });
    mapText = JSON.stringify(imap.json);
    html = html.slice(0, imap.start) + holder + html.slice(imap.end);
  }
  have.sort(function (a, c) { return c.length - a.length; }).forEach(function (u) {
    html = html.split(u).join(blobs[u]);
    if (u.indexOf('&') >= 0) html = html.split(u.replace(/&/g, '&amp;')).join(blobs[u]);
  });
  if (mapText) html = html.replace(holder, function () { return mapText; });
  return html;
}
// Saved copy first (instant, no network). Fall back to the network, and to the saved copy if the network is slow.
function loadGameHtml(g) {
  var key = gkey(g);
  if (BUNDLE) return getRec(key).then(function (r) { if (!r) throw new Error('missing'); return { html: r.text, base: '' }; });
  return versionReady.then(function (v) {
    if (!MIRRORS.length) setVersion(v);
    return getRec(key).then(function (rec) {
      if (rec && rec.rel === v) return { html: rec.text, base: MIRRORS[0], cached: true };
      return new Promise(function (resolve, reject) {
        var done = false, timer = setTimeout(function () { if (rec && !done) { done = true; resolve({ html: rec.text, base: MIRRORS[0], cached: true }); } }, 4000);
        fetchGame(g).then(function (r) {
          clearTimeout(timer);
          if (!rec || rec.text !== r.html) { var nr = { text: r.html, rel: v, sha: null }; MEM[key] = nr; idbPut(key, nr); }
          if (!done) { done = true; resolve(r); }
        }, function (err) {
          clearTimeout(timer);
          if (done) return;
          done = true;
          if (rec) resolve({ html: rec.text, base: MIRRORS[0], cached: true }); else reject(err);
        });
      });
    });
  });
}
function prepare(html, g, base) {
  return inlineLibs(html, g).catch(function () { return html; }).then(function (h) { h = HG_withHub(h, g); return BUNDLE ? h : withBase(h, base + encodeURI(g.dir) + '/'); });
}
// --- the one-file offline copy ---
var offlineUrl = null;
async function buildOfflineHtml() {
  if (cacheP) await cacheP;
  cacheP = null; await startCache(); // fills any gaps; quick when everything is already saved
  var v = await versionReady, meta = await getMeta(), files = {}, libs = {}, missing = [];
  var all = GAMES.concat(EXPERIMENTAL);
  for (var i = 0; i < all.length; i++) {
    var g = all[i], r = await getRec(gkey(g)), urls = meta.libs[g.dir];
    if (!r || !urls) { missing.push(g.name); continue; }
    files[gkey(g)] = r.text; libs[g.dir] = urls;
    for (var j = 0; j < urls.length; j++) if (!files['lib:' + urls[j]]) { var l = await idbGet('lib:' + urls[j]); if (l) files['lib:' + urls[j]] = l.text; }
  }
  for (var k = 0; k < GAMES.length; k++) { var im = await idbGet('img:' + GAMES[k].img); if (im && im.size) files['img:' + GAMES[k].img] = await toDataUri(im); }
  var hub = await idbGet('hub'), hubText = hub && hub.text;
  if (!hubText) hubText = (await fetchRepo('index.html')).html;
  var json = JSON.stringify({ version: v, builtAt: Date.now(), files: files, meta: { libs: libs, mods: meta.mods } })
    .replace(/[\u007f-\uffff]/g, function (c) { return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4); }).replace(/</g, '\\u003c');
  var tag = '<script>window.HG_VERSION=' + JSON.stringify(v) + ';window.HG_BUNDLE=' + json + ';<\/script>';
  var html = hubText.replace('<title>Huntington Games Launcher</title>', '<title>Huntington Games Launcher Offline</title>');
  html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, function (m) { return m + tag; }) : tag + html;
  return { html: html, missing: missing };
}
function showOfflineDialog(title, text, canSave) {
  document.getElementById('offdlg-title').textContent = title;
  document.getElementById('offdlg-text').innerHTML = text;
  document.getElementById('offdlg-again').style.display = document.getElementById('offdlg-tab').style.display = canSave ? '' : 'none';
  document.getElementById('offdlg').classList.add('open');
}
function saveOffline() {
  if (!offlineUrl) return;
  try { var a = document.createElement('a'); a.href = offlineUrl; a.download = 'Huntington Games Offline.html'; document.body.appendChild(a); a.click(); a.remove(); } catch (e) {}
}
async function downloadOffline() {
  var btn = document.getElementById('offdl');
  btn.disabled = true; var old = btn.textContent; btn.textContent = 'Preparing...';
  showOfflineDialog('Offline copy', 'Getting every game ready. This can take a minute on a slow connection...', false);
  try {
    var res = await buildOfflineHtml(), size = res.html.length;
    var blob = new Blob([res.html], { type: 'text/html' });
    if (offlineUrl) { try { URL.revokeObjectURL(offlineUrl); } catch (e) {} }
    offlineUrl = URL.createObjectURL(blob);
    saveOffline();
    showOfflineDialog('Offline copy ready',
      '<b>Huntington Games Offline.html</b> (' + (size / 1048576).toFixed(1) + ' MB) should now be in your Downloads folder.' +
      (res.missing.length ? '<br><br>Not included (could not be downloaded): ' + res.missing.join(', ') + '.' : '') +
      '<br><br>If nothing downloaded (some school browsers block it here), press <b>Open in a new tab</b>, then press <b>Ctrl+S</b> and choose "Webpage, HTML Only".' +
      '<br><br>Keep the file in your Files app and open it any time, with no internet. Online multiplayer (Frontline, Blocky Shooter) still needs internet.', true);
  } catch (e) {
    showOfflineDialog('Offline copy', 'Could not build the offline copy. Check your connection and try again.', false);
  }
  btn.disabled = false; btn.textContent = old;
}
// Games save into this page's storage, and so does the Grapevine chat (a cache of recent messages per conversation). After a
// busy day that cache could fill the browser's quota (about 5 MB), and then a game's save failed without a word: progress
// looked fine, and was gone the next time the game opened. So keep room for saves: if ~1 MB will not fit, drop the biggest
// chat caches (the chat server holds the real history), then old save backups, until it does.
function roomForSaves() {
  // cheap on purpose: a 300K-character probe (not 1 MB), and caches are dropped without reading them to measure
  // (reading every cache to size it froze the page for a moment once a minute when the storage was full)
  var probe = 'hg:room', blob = roomForSaves.blob || (roomForSaves.blob = new Array(300001).join('x'));
  for (var round = 0; round < 10; round++) {
    try { localStorage.setItem(probe, blob); localStorage.removeItem(probe); return true; } catch (e) {}
    try { localStorage.removeItem(probe); } catch (e) {}
    var logs = [], baks = [];
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (/^gv:log:/.test(k)) logs.push(k); else if (/^hgv:bak:/.test(k)) baks.push(k); } } catch (e) { return false; }
    var drop = logs.length ? logs : baks;
    if (!drop.length) return false;
    drop.slice(0, Math.max(2, Math.ceil(drop.length / 3))).forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
  }
  return false;
}
// at start, then every 5 minutes when the page is idle (never in the middle of a frame), and before any game opens
var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 1); };
setTimeout(function () { idle(roomForSaves); }, 3000); setInterval(function () { idle(roomForSaves, { timeout: 10000 }); }, 300000);
function play(g, fast) { if (document.getElementById('gate').hidden === false) return; roomForSaves(); if (window.HGAch) window.HGAch.played(g.dir); gvBeforePlay(g, function () { playNow(g); }, fast); }
// an unlocked achievement, posted into a chat as a card
window.HG_shareAch = function (id, convId) {
  var A = window.HGAch, a = A && A.byId(id), api = chatApi(), L = window.HGGrapevine, me = L && L.me();
  if (!a || !api || !A.got()[id]) return false;
  return !!api.send(convId, (me ? me.name : 'I') + ' unlocked ' + a.i + ' ' + a.n + ' in ' + A.games[a.g] + ': ' + a.d + ' - hg-ach:' + a.g + ':' + a.id);
};
var skipWait = null;
window.HG_skipWait = function () { if (skipWait) skipWait(); };
function playNow(g) {
  var id = ++loadId;
  current = { game: g, html: null };
  document.getElementById('ptitle').textContent = g.name;
  var hint = document.getElementById('chathint'), Lg = window.HGGrapevine;
  hint.textContent = g.noChat || !(Lg && Lg.me()) ? '' : (g.chatShift ? 'Shift+T to chat' : 'T to chat');
  document.getElementById('player').classList.add('open'); document.documentElement.classList.add('playing');
  try { history.replaceState(null, '', '#' + encodeURIComponent(g.dir)); } catch (e) {}
  if (local) { HG_set(g); frame.removeAttribute('srcdoc'); frame.src = path(g) + (window.HG_TEST_QUERY || ''); return; }   // HG_TEST_QUERY: tests only (local copies)
  frame.srcdoc = message('Loading ' + g.name + '...');
  loadGameHtml(g).then(function (r) {
    if (id !== loadId) return;
    return prepare(r.html, g, r.base).then(function (h) {
      if (id !== loadId) return;
      current.html = h;
      frame.srcdoc = h;
      gvStartApp();
    });
  }).catch(function () {
    if (id !== loadId) return;
    frame.srcdoc = message('Could not load ' + g.name + '.<br>' + (BUNDLE ? 'This game is missing from the offline copy.' : 'The game CDN (cdn.jsdelivr.net) may be blocked on this network, or you are offline and this game is not saved yet.'));
  });
}
function closePlayer() {
  if (typeof DOCK !== 'undefined' && DOCK && DOCK.open) dockClose();      // (closePlayer also runs while the page is still loading)
  setTimeout(function () { if (typeof feedNow === 'function') feedNow(); }, 4000);      // new bests and achievements -> goons and leaderboards
  var wasOpen = !!current;
  if (MP.live) liveStop();
  loadId++; current = null;
  document.getElementById('player').classList.remove('open'); document.documentElement.classList.remove('playing');
  frame.removeAttribute('srcdoc'); frame.src = 'about:blank';
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  if (wasOpen) gvAfterPlay();
}
// New tab: opens a blank page (about:blank, so the address bar shows nothing) and writes the game into it. It shares this
// page's storage, so saves and the Grapevine account work there too (the game finds this launcher as window.opener).
document.getElementById('newtab').onclick = function () {
  if (!current) return;
  var g = current.game;
  // The game opens as a page of its own: a real address when the games are served from here, otherwise the game's code as a
  // blob: page made by this launcher. Writing into an about:blank tab broke wherever the launcher runs inside another
  // page (jsfiddle, jsbin, Google Sites): the browser opens the tab but hands back no window to write into, so it stayed
  // blank and the launcher said the tab was blocked. A blob: page needs no window handle, and it shares this page's
  // storage, so saves still work. When we do get the window back, the chat and pop-ups are added to it.
  var url;
  if (local) { HG_set(g); url = new URL(path(g), location.href).href; }
  else if (current.html) url = URL.createObjectURL(new Blob([current.html], { type: 'text/html' }));
  else { hubToast('The game is still loading. Try again in a moment.'); return; }
  var w = null;
  try { w = window.open(url, '_blank'); } catch (e) {}
  if (!w) hubToast(g.name + ' opened in a new tab.');        // (some pages open the tab but hand back no window: that is fine now)
  else {
    popup = w; popupGame = g;
    var hook = function () { try { if (w.document && w.document.body) { w.document.title = g.name; attachChat(w.document, g); gvStartApp(); } } catch (e) {} };
    try { w.addEventListener('load', hook); } catch (e) {}
  }
  if (!local) setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
};
document.getElementById('back').onclick = closePlayer;
document.getElementById('full').onclick = function () { var p = document.getElementById('player'); if (document.fullscreenElement) document.exitFullscreen(); else if (p.requestFullscreen) p.requestFullscreen().catch(function () {}); };
document.addEventListener('fullscreenchange', function () { document.getElementById('ptop').classList.toggle('hide', !!document.fullscreenElement); });
document.getElementById('exp-btn').onclick = function () { document.getElementById('exp').classList.add('open'); };
document.getElementById('exp-close').onclick = function () { document.getElementById('exp').classList.remove('open'); };
document.getElementById('exp').onclick = function (e) { if (e.target.id === 'exp') e.target.classList.remove('open'); };
document.getElementById('note').textContent = BUNDLE ? 'Offline copy of release ' + BUNDLE.version + '. Online multiplayer (Frontline, Blocky Shooter) needs internet.' : local ? '' : 'Games load from the jsDelivr CDN.';
document.getElementById('offdl').onclick = downloadOffline;
document.getElementById('offdlg-close').onclick = function () { document.getElementById('offdlg').classList.remove('open'); };
document.getElementById('offdlg-again').onclick = saveOffline;
document.getElementById('offdlg-tab').onclick = function () { if (offlineUrl) { try { window.open(offlineUrl, '_blank'); } catch (e) {} } };
if (local || BUNDLE) document.getElementById('offbar').className = 'off';
function HG_dead(msg, sub) { document.documentElement.innerHTML = '<head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0e13;color:#e6edf3;font:16px \'Segoe UI\',system-ui,sans-serif;text-align:center;padding:24px"><div><div style="font-size:46px">&#128274;</div><div style="font-weight:800;font-size:22px;margin:12px 0 6px">' + msg + '</div><div style="color:#8b949e;max-width:440px;line-height:1.5">' + sub + '</div></div></body>'; }
function HG_guard() {
  var KEY = 'hg_lastok', DAY = 86400000, now = Date.now();
  if (BUNDLE) {
    var last = 0; try { last = parseInt(localStorage.getItem(KEY), 10) || 0; } catch (e) {}
    if (!last) { last = BUNDLE.builtAt || now; try { localStorage.setItem(KEY, last); } catch (e) {} }
    try { fetch(MIRROR_HOSTS[0] + REPO_NAME + '@main/gate.json', { cache: 'no-store' }).then(function (r) { if (r.ok) { try { localStorage.setItem(KEY, Date.now()); } catch (e) {} } }).catch(function () {}); } catch (e) {}
    if (now - last > 3 * DAY) { HG_dead('Offline copy expired', 'Connect to the internet to refresh this saved copy, then open it again.'); return false; }
    return true;
  }
  versionReady.then(function (v) {
    if (!MIRRORS.length) setVersion(v);
    try { fetch(MIRRORS[0] + 'gate.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.min && HG_build() < j.min) HG_dead('This version has been shut down', 'Reload the page to get the newest version.'); try { localStorage.setItem(KEY, Date.now()); } catch (e) {} }).catch(function () {}); } catch (e) {}
  });
  return true;
}
if (!HG_guard()) throw new Error('HG-expired');
render();
// Saving every game for offline play is a big download. It used to start the moment the page opened, in competition with the
// Grapevine connection (on a busy school network that alone could add many seconds to signing in). It now waits until the account
// is connected, with a limit of 30 seconds either way.
var cacheTimer = 0;
function startCacheLater(ms) { if (cacheTimer < 0) return; clearTimeout(cacheTimer); cacheTimer = setTimeout(function () { cacheTimer = -1; startCache(); }, ms); }
if (!local && !BUNDLE) startCacheLater(30000);
var start = decodeURIComponent(location.hash.slice(1));
GAMES.concat(EXPERIMENTAL).forEach(function (g) { if (g.dir === start) play(g); });

// ===== Grapevine: the account behind the whole launcher (gv/account.js, gv/app.html) =====
// One account for everything: it gates the launcher, puts your name and friends in the games (they read it as
// window.parent.HGGrapevine), saves every game to the account so another device can load it, and the Grapevine tab runs
// the full Grapevine app signed in as the same person. The code is downloaded on demand to keep the launcher small.
// Start the relay library downloading now, alongside gv/account.js, instead of after it (the account needs both).
var MQTT_URL = 'https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js', MQTT_SRI = 'sha384-u4uqeACkFcoKl57rBQJHVGDd1pqhW4w8X3WjTu1ZksPdxoLqdt34jpoNkJisE25W';
function preloadMqtt() {
  if (BUNDLE || window.mqtt || window.__gvMqtt) return;
  window.__gvMqtt = new Promise(function (resolve) {
    var sc = document.createElement('script');
    sc.src = MQTT_URL; sc.integrity = MQTT_SRI; sc.crossOrigin = 'anonymous';
    sc.onload = sc.onerror = function () { resolve(); };
    document.head.appendChild(sc);
  });
}
// Downloads of the account code and the Grapevine app are kept per release, so a repeat visit starts instantly.
function fetchGV(file) {
  if (BUNDLE) return Promise.reject(new Error('Grapevine needs the internet, so it is not in the offline copy.'));
  if (local) return fetch(file, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); });
  return versionReady.then(function (v) {
    return idbGet('gv:' + file).then(function (rec) {
      if (rec && rec.rel === v && typeof rec.text === 'string') return rec.text;
      return fetchRepo(file).then(function (r) { idbPut('gv:' + file, { text: r.html, rel: v }); return r.html; },
        function (e) { if (rec && typeof rec.text === 'string') return rec.text; throw e; });   // offline: last copy
    });
  });
}
var guestMode = false, gvP = null, acctMounted = false, gateMounted = false, chatLoaded = false;
function loadGV() {
  if (gvP) return gvP;
  preloadMqtt();
  gvP = new Promise(function (resolve, reject) {
    if (window.HGGrapevine) return resolve(window.HGGrapevine);
    fetchGV('gv/account.js').then(function (code) {
      try { var sc = document.createElement('script'); sc.textContent = code; document.head.appendChild(sc); resolve(window.HGGrapevine); } catch (e) { reject(e); }
    }, function () { reject(new Error('Could not load Grapevine. The game CDN (cdn.jsdelivr.net) may be blocked on this network.')); });
  }).then(function (L) { L.on('change', onGvChange); L.on('notify', function (n) { window.HG_notify(n); });
    if (window.HGAch) window.HGAch.on('unlock', function (a) { window.HG_notify({ kind: 'ach', title: a.i + ' ' + a.n, text: a.d + ' (' + window.HGAch.games[a.g] + ', +' + a.p + ' points)' }); });
    onGvChange(); return L; }, function (e) { gvP = null; throw e; });
  return gvP;
}
function savedName() { try { return localStorage.getItem('hgv:name') || ''; } catch (e) { return ''; } }
function hasSavedKey() { try { return !!localStorage.getItem('hgv:key'); } catch (e) { return false; } }
// The launcher wears the theme chosen in Grapevine's settings (dark / light / oled, one of 18 flavors, an accent colour).
// The Grapevine app keeps it with its other settings in this page's storage, so the launcher just reads it.
var GV_FLAVORS = 'amber midnight slate forest plum ember ocean velvet paper glacier terminal mono neon sunset aurora cherry gold cyber'.split(' ');
function applyGvTheme() {
  var r = document.documentElement, set = {}, uid = '';
  try { var L = window.HGGrapevine; uid = (L && L.me() && L.me().userId) || localStorage.getItem('hgv:uid') || ''; set = JSON.parse(localStorage.getItem('gv:set:' + uid) || '{}') || {}; } catch (e) {}
  var base = set.base === 'system' ? (window.matchMedia && !matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark') : (['dark', 'light', 'oled'].indexOf(set.base) >= 0 ? set.base : 'dark');
  var flavor = GV_FLAVORS.indexOf(set.flavor) >= 0 ? set.flavor : 'amber';
  if (r.dataset.base !== base) r.dataset.base = base;
  if (r.dataset.flavor !== flavor) r.dataset.flavor = flavor;
  var accent = /^#[0-9a-fA-F]{6}$/.test(set.accent || '') ? set.accent : '';
  if (accent) r.style.setProperty('--signal', accent); else r.style.removeProperty('--signal');
}
window.addEventListener('storage', function (e) { if (!e.key || e.key.indexOf('gv:set:') === 0) applyGvTheme(); });
setInterval(applyGvTheme, 2500);   // the Grapevine frame is a different document in this page: a safety net for the event above
applyGvTheme();
// A first look around, once, after the first sign-in: the one tour (launcher/js/10-hub/060-tour.js), which also covers
// Grapevine. 'hgv:tour' remembers it (the old slideshow wrote '1', so people who saw only that get the new one once).
function maybeTour() {
  var seen = ''; try { seen = localStorage.getItem('hgv:tour') || ''; } catch (e) {}
  if (seen === '2' || window.__tourOpen || BUNDLE) return;
  window.__tourOpen = true;
  setTimeout(function () { if (window.HG_tour && !HG_tour.on() && document.getElementById('player').className.indexOf('open') < 0) HG_tour.start(); }, 1200);
}
function paintChip() {
  var L = window.HGGrapevine, me = L && L.me(), name = me ? me.name : (hasSavedKey() ? savedName() : '');
  var chip = document.getElementById('chip');
  chip.className = name ? 'on' : '';
  if (!name) return;
  document.getElementById('chip-nm').textContent = name;
  var s = L ? L.status().status : 'connecting';
  document.getElementById('chip-dot').className = 'cdot' + (s === 'online' ? ' on' : s === 'signed-out' || s === 'error' ? '' : ' wait');
  // your picture and goons on the chip: the way into your profile and the shop
  var e = L && L.eco && L.eco.state();
  document.getElementById('chip-pfp').innerHTML = e && e.equip && e.equip.pfp && typeof profPfp === 'function' ? profPfp(e.equip.pfp, 22) : '';
  document.getElementById('chip-goons').textContent = e ? (e.dev ? '∞' : e.goons) + ' goons' : '';
}
function onGvChange() {
  paintChip(); applyGvTheme();
  var L = window.HGGrapevine, signedIn = !!(L && L.me());
  if (L && L.eco) { profMount(); feedMount(); }
  if (signedIn && !guestMode) maybeTour();
  if (signedIn && L.online() && !window.__cacheKicked) { window.__cacheKicked = 1; startCacheLater(5000); }
  document.getElementById('gate').hidden = signedIn || guestMode || BUNDLE;
  if (!signedIn && chatLoaded) { chatLoaded = false; document.getElementById('gvapp').removeAttribute('srcdoc'); showTab('games'); closePlayer(); }
  // The full app starts in the background once the account is connected (so it never competes with it for the network),
  // and messages arrive while you play. It is ~600 KB to parse and start: wait for a quiet moment so it does not land on
  // top of the game you just opened (opening the chat tab starts it at once anyway).
  if (signedIn && L.online() && (!chatLoaded || chatLoaded === 'pending') && !BUNDLE) {
    chatLoaded = 'pending';
    var ric = window.requestIdleCallback || function (f) { return setTimeout(f, 1); };
    setTimeout(function () { ric(function () { if (chatLoaded === 'pending') startChat(); }, { timeout: 5000 }); }, 2500);
  }
}
// The gate: nothing in the launcher works without an account. A device that signed in before opens straight away
// (offline too); the account reconnects quietly in the background.
function showGate() {
  var gate = document.getElementById('gate'), box = document.getElementById('gate-box');
  gate.hidden = false;
  box.innerHTML = '<div class="sub" style="text-align:center">Loading Grapevine...</div>';
  loadGV().then(function (L) {
    if (!gateMounted) { gateMounted = true; window.HGGrapevineUI.mount(box, { gate: true }); }
    var oldNote = document.getElementById('gate-note'); if (oldNote) oldNote.remove();
    var note = document.createElement('div'); note.id = 'gate-note'; note.className = 'sub'; note.style.cssText = 'text-align:center;margin-top:14px'; box.parentNode.appendChild(note);
    // If Grapevine cannot be reached from this network at all, do not lock anybody out of the games.
    L.probe().then(function (ok) {
      if (ok || !document.getElementById('gate-note')) return;
      note.innerHTML = 'Grapevine cannot be reached from here right now (the server may be down, or this network blocks it). ';
      var b = document.createElement('button'); b.className = 'tab'; b.id = 'gate-guest'; b.textContent = 'Play without an account for now';
      b.onclick = function () { guestMode = true; note.remove(); onGvChange(); };
      note.appendChild(document.createElement('br')); note.appendChild(b);
    });
    onGvChange();
  }, function (e) {
    box.innerHTML = ''; var d = document.createElement('div'); d.className = 'sub'; d.style.textAlign = 'center'; d.textContent = e.message;
    var b = document.createElement('button'); b.className = 'tab'; b.textContent = 'Try again'; b.onclick = showGate; d.appendChild(document.createElement('br')); d.appendChild(b); box.appendChild(d);
  });
}
// The Grapevine tab runs the real Grapevine app in a frame, already signed in as this account. It shares this page's
// storage, so the key is handed over the same way Grapevine's own sign-in keeps it; its own sign-out is hidden because
// signing out belongs to the launcher.
function startChat() {
  var L = window.HGGrapevine, me = L && L.me(), frm = document.getElementById('gvapp');
  if (!me) { chatLoaded = 'pending'; return; }
  if (chatLoaded === true) return;
  chatLoaded = true;
  frm.srcdoc = '<!DOCTYPE html><html><body style="margin:0;background:#0b0b0d;color:#8a8a96;font:14px sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">Loading Grapevine...</body></html>';
  fetchGV('gv/app.html').then(function (html) {
    try {
      localStorage.setItem('gv:key', L.key()); localStorage.setItem('gv:name', me.name); localStorage.setItem('gv:bound:' + me.userId, '1');
    } catch (e) {}
    html = html.replace('</head>', '<style>#signOut,#srvOut{display:none!important}</style></head>')
      .replace(/<\/body>\s*<\/html>\s*$/i, '<script>try{if(document.querySelector("#userid").value)document.querySelector("#goIn").click()}catch(e){}<\/script></body></html>');
    frm.srcdoc = html;
  }, function (e) { chatLoaded = false; frm.srcdoc = '<body style="font:14px sans-serif;background:#0b0b0d;color:#e5484d;padding:30px">' + String(e.message).replace(/</g, '&lt;') + '</body>'; });
}
function showTab(which) {
  if (guestMode && which !== 'games' && which !== 'mp') { guestMode = false; onGvChange(); return; }   // those need an account: show the sign-in screen again
  var chat = which === 'chat';
  document.getElementById('view-games').hidden = which !== 'games';
  document.getElementById('view-acct').hidden = which !== 'acct';
  document.getElementById('view-prof').hidden = which !== 'prof';
  if (which === 'prof') loadGV().then(function () { profMount(); profRender(); }, function () {});
  document.getElementById('view-lb').hidden = which !== 'lb';
  if (which === 'lb') loadGV().then(function () { profMount(); lbRender(); }, function () {});
  document.getElementById('view-mp').hidden = which !== 'mp';
  document.getElementById('view-chat').hidden = !chat;
  document.body.className = chat ? 'chat' : '';
  ['games', 'prof', 'lb', 'mp', 'chat', 'acct'].forEach(function (t) { document.getElementById('tab-' + t).className = 'tab' + (which === t ? ' on' : ''); });
  if (chat) {
    document.getElementById('view-chat').style.setProperty('--topbar', Math.ceil(document.getElementById('topbar').getBoundingClientRect().bottom + 1) + 'px');
    if (chatLoaded !== true) loadGV().then(startChat, function () {});
  }
  if (which === 'acct' && !acctMounted) {
    var box = document.getElementById('view-acct');
    box.innerHTML = '<div class="sub" style="text-align:center;padding:30px 0">Loading...</div>';
    loadGV().then(function () { acctMounted = true; window.HGGrapevineUI.mount(box); });
  }
}
// What the full app is showing, carried to the launcher: unread chats and friend requests as a badge on its tab.
setInterval(function () {
  var t = document.getElementById('tab-chat'), L = window.HGGrapevine, n = 0;
  try { var m = /^\((\d+)\)/.exec(document.getElementById('gvapp').contentDocument.title || ''); if (m) n = +m[1]; } catch (e) {}
  if (L && L.me()) n += L.friends().incoming.length;
  var label = n ? 'Grapevine (' + (n > 99 ? '99+' : n) + ')' : 'Grapevine';
  if (t.textContent !== label) t.textContent = label;
}, 2000);
// "Friends" and "Friend requests" buttons in the Account tab open the full app's own friends window.
window.HG_openGrapevine = function (friendsTab) {
  showTab('chat');
  if (!friendsTab) return;
  var tries = 0, iv = setInterval(function () {
    tries++;
    try { var w = document.getElementById('gvapp').contentWindow; if (w.S && w.S.joined && w.openFriends) { clearInterval(iv); w.openFriends(friendsTab); } } catch (e) {}
    if (tries > 60) clearInterval(iv);
  }, 500);
};

