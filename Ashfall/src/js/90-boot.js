// ---- start
// for tests and for looking around from the console
window.__ash = { App, R, HG3D, keys, hit, mouse, Input, Save, World, Weapons, WEAPONS, Gun, Foes, FOES, Game, HUD, UI, Net, Snd, Music, Armory, Ops, OPS, Marks, Extras, CLASSES,
    step(dt, n) { for (let i = 0; i < (n || 1); i++) tick(dt || 1 / 60); return App.calls; } };
if (!R) UI.fatal('This device cannot run WebGL2, so Ashfall cannot start here.');
else {
    resize(); requestAnimationFrame(frame);
    // ?go=yard starts a run at once (tests), ?menu=1 opens the menu, otherwise the opening plays (in full the first time)
    if (Q.get('go')) UI.play({ map: Q.get('go'), diff: Q.get('diff') || 'normal', cls: Q.get('cls') || 'assault' }).then(ok => { window.__ash.started = ok; });
    else if (Q.get('menu')) UI.menu();
    else UI.intro(!Save.data.intro || Q.get('intro') === '1');
}
