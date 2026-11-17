    // --- AFK PAUSE: after 30 minutes with no input, automatic progress stops until the next input ---
    const AFK_MS = 30 * 60 * 1000;
    let afkLast = Date.now(), afkBannerEl = null;
    function afkLimit() { const o = +window.__hgAfkMs; return o > 0 ? o : AFK_MS; }
    function afkIdle() {
        const idle = Date.now() - afkLast >= afkLimit();
        if (idle && !afkBannerEl && document.body) {
            afkBannerEl = document.createElement('div');
            afkBannerEl.id = 'hg-afk-banner';
            afkBannerEl.setAttribute('role', 'status');
            afkBannerEl.style.cssText = 'position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:99999;max-width:92vw;padding:8px 14px;border-radius:10px;background:#1f2937;color:#fde68a;border:2px solid #f59e0b;font:600 14px/1.3 system-ui,sans-serif;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,.4)';
            afkBannerEl.textContent = 'Away for 30 minutes: progress paused. Click or press a key to carry on.';
            document.body.appendChild(afkBannerEl);
        }
        return idle;
    }
    function afkInput(e) {
        const now = Date.now();
        if (e && e.type === 'mousemove' && now - afkLast < 1000) return;
        afkLast = now;
        if (afkBannerEl) { afkBannerEl.remove(); afkBannerEl = null; }
    }
    ['keydown', 'pointerdown', 'mousedown', 'touchstart', 'wheel', 'mousemove'].forEach(t => window.addEventListener(t, afkInput, { passive: true, capture: true }));
