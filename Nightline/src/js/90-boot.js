// ---- start
// for tests and for looking around from the console
window.__nightline = { App, R, HG3D, keys, hit, Save, World, Track, Race, Car, Cars, CARS, PAINTS, LEVELS, UI, Snd, LOOK, TRACKDATA,
    step(n, dt) { for (let i = 0; i < (n || 1); i++) Race.step(dt || STEP); }, draw(dt) { tick(dt || 0.016); return App.calls; } };
if (!R) UI.fatal('This device cannot run WebGL2, so Nightline cannot start here.');
else {
    Save.load(); Snd.setVol(Save.data.settings.sfx); resize(); requestAnimationFrame(frame);
    // ?go=race or ?go=trial starts at once (tests), otherwise the menu
    if (Q.get('circuit') && TRACKDATA[Q.get('circuit')]) Save.data.settings.circuit = Q.get('circuit');      // ?circuit=skyway (tests, pictures)
    if (Q.get('go')) { if (Q.get('car') && CARS[Q.get('car')]) { Save.data.car = Q.get('car'); Save.data.cars[Q.get('car')] = 1; } if (Q.get('level')) Save.data.settings.level = clamp(+Q.get('level'), 0, 2); UI.play(Q.get('go') === 'trial' ? 'trial' : 'race').then(ok => { window.__nightline.started = ok; }); }
    else UI.menu().then(() => { window.__nightline.started = true; });
}
