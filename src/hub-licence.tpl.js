/* ===== Huntington Games licence ===== */
(function () {
  var H = location.hostname;
  var ok = H === '' || H === 'localhost' || H === '127.0.0.1'
    || /(^|\.)jsbin\.com$/.test(H) || /(^|\.)jsfiddle\.net$/.test(H)
    || /(^|\.)jshell\.net$/.test(H) || /\.github\.io$/.test(H) || !!window.HG_BUNDLE;
  if (ok) return;
  document.documentElement.innerHTML = '<head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0e13;color:#e6edf3;font:16px \'Segoe UI\',system-ui,sans-serif;text-align:center;padding:24px"><div><div style="font-size:46px">&#128274;</div><div style="font-weight:800;font-size:22px;margin:12px 0 6px">This site is not authorized</div><div style="color:#8b949e;max-width:440px;line-height:1.5">Huntington Games runs only on its official pages. Play the real version instead of this copy.</div></div></body>';
  throw new Error('HG-site');
})();
var HG_SECRET = '__SECRET__';
function HG_h(x) { var n = 5381, i = 0; for (; i < x.length; i++) n = ((n << 5) + n + x.charCodeAt(i)) >>> 0; return n.toString(36); }
function HG_build() { return (typeof HG_BUILD_N !== 'undefined' && HG_BUILD_N) || parseInt(String(window.HG_VERSION || (window.HG_BUNDLE && window.HG_BUNDLE.version) || '').replace(/[^0-9]/g, ''), 10) || 0; }
function HG_tokenTag(g) { var b = HG_build(); return '<script>window.HG_HUB={b:' + b + ',sig:"' + HG_h(b + '|' + g.dir + '|' + HG_SECRET) + '"};<' + '/script>'; }
function HG_set(g) { try { var b = HG_build(); window.HG_HUB = { b: b, sig: HG_h(b + '|' + g.dir + '|' + HG_SECRET) }; } catch (e) {} }
function HG_withHub(html, g) { var tag = HG_tokenTag(g); return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, function (m) { return m + tag; }) : tag + html; }
