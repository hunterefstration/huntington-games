// Huntington Games licence gate (game side). Injected as the first <head> script of every game.
// A game runs only when our hub launched it with a valid per-launch token. Pirated hubs and lone
// stolen game files have no valid token, so they get a shut-down screen instead of the game.
// Dev/test hosts (localhost) and an explicit window.HG_DEV flag are allowed so local play and tests work.
(function () {
  try {
    var B = __BUILD__, ID = '__ID__', S = '__SECRET__';
    function h(x) { var n = 5381, i = 0; for (; i < x.length; i++) n = ((n << 5) + n + x.charCodeAt(i)) >>> 0; return n.toString(36); }
    var host = location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || window.HG_DEV) return;
    var hub = window.HG_HUB;
    if (!hub) { try { if (window.parent && window.parent !== window) hub = window.parent.HG_HUB; } catch (e) {} }
    if (!hub) { try { if (window.opener && window.opener.HG_HUB) hub = window.opener.HG_HUB; } catch (e) {} }
    var ok = hub && hub.b >= B - 0 && hub.sig === h(hub.b + '|' + ID + '|' + S);
    if (ok) { window.HG_OK = 1; return; }
    try { window.stop && window.stop(); } catch (e) {}
    var m = document.documentElement;
    m.innerHTML = '<head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0e13;color:#e6edf3;font:16px \'Segoe UI\',system-ui,sans-serif;text-align:center;padding:24px"><div><div style="font-size:46px">&#128274;</div><div style="font-weight:800;font-size:22px;margin:12px 0 6px">This copy has been shut down</div><div style="color:#8b949e;max-width:440px;line-height:1.5">This is an unauthorized copy of a Huntington Games game. Play the real, up-to-date version at Huntington Games.</div></div></body>';
    throw new Error('HG-gate');
  } catch (e) { if (String(e && e.message) !== 'HG-gate') return; throw e; }
})();
