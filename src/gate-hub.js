// Readable reference for the hub-side licence code (the shipped copy in index.html is obfuscated).
// 1) Site lock: hub runs only on official hosts; anywhere else -> shutdown screen.
(function () {
  var H = location.hostname;
  var ok = H === '' || H === 'localhost' || H === '127.0.0.1'
    || /(^|\.)jsbin\.com$/.test(H) || /(^|\.)jsfiddle\.net$/.test(H)
    || /(^|\.)jshell\.net$/.test(H) || /\.github\.io$/.test(H) || !!window.HG_BUNDLE;
  if (ok) return;
  /* replace document with "This site is not authorized" */ throw new Error('HG-site');
})();
var HG_BUILD_N = 31, HG_SECRET = 'hGx9__k3v7';
function HG_h(x) { var n = 5381, i = 0; for (; i < x.length; i++) n = ((n << 5) + n + x.charCodeAt(i)) >>> 0; return n.toString(36); }
function HG_build() { return HG_BUILD_N || parseInt(String(window.HG_VERSION || (window.HG_BUNDLE && window.HG_BUNDLE.version) || '').replace(/[^0-9]/g, ''), 10) || 0; }
function HG_tokenTag(g) { var b = HG_build(); return '<script>window.HG_HUB={b:' + b + ',sig:"' + HG_h(b + '|' + g.dir + '|' + HG_SECRET) + '"};<' + '/script>'; }
function HG_set(g) { try { var b = HG_build(); window.HG_HUB = { b: b, sig: HG_h(b + '|' + g.dir + '|' + HG_SECRET) }; } catch (e) {} }
function HG_withHub(html, g) { var tag = HG_tokenTag(g); return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, function (m) { return m + tag; }) : tag + html; }
// 2) prepare(html,g,base): now calls HG_withHub(h,g) before withBase, so every srcdoc game carries a token.
// 3) play(): local mode calls HG_set(g) before frame.src; new-tab (local) calls HG_set before window.open.
// 4) HG_guard(): BUNDLE -> read localStorage hg_lastok (seed from BUNDLE.builtAt); ping @main/gate.json and
//    refresh hg_lastok on success; if now-lastok > 3 days -> "Offline copy expired" and stop.
//    Online hub -> fetch newest-release gate.json {min}; if HG_build() < min -> "This version has been shut down".
