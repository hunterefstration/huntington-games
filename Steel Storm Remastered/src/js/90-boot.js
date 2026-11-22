// ---- start
// for tests and for looking around from the console
window.__ssr = { App, R, HG3D, keys, hit, mouse, Input, Save, World, Units, TD, Game, HUD, UI, Snd,
    step(dt, n) { for (let i = 0; i < (n || 1); i++) tick(dt || 1 / 60); return App.calls; } };
if (!R) UI.fatal('This device cannot run WebGL2, so Steel Storm Remastered cannot start here.');
else {
    resize(); requestAnimationFrame(frame);
    // ?go=1 starts a skirmish at once (tests), ?menu=1 opens the menu, otherwise the name comes first
    if (Q.get('go')) UI.play().then(ok => { window.__ssr.started = ok; });
    else if (Q.get('menu')) UI.menu();
    else UI.intro();
}
