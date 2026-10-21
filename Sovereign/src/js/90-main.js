// Boot: read the data, build the 110m globe, show the title, then build the detailed 50m map in the background.
const frame = () => new Promise(r => requestAnimationFrame(() => r()));
async function runSliced(gen, onProgress, budget = 14) { // run a generator in small slices so the page never freezes
  let t0 = performance.now(), r;
  while (!(r = gen.next()).done) {
    if (onProgress && typeof r.value === 'number') onProgress(r.value);
    if (performance.now() - t0 > budget) { await frame(); t0 = performance.now(); }
  }
  return r.value;
}
function loadStep(p, text) { $('#load-fill').style.width = Math.round(p * 100) + '%'; if (text) $('#load-text').textContent = text; }

async function boot() {
  applyUiScale(); $('#fps').classList.toggle('hidden', !Settings.fps);
  loadStep(0.05, 'Reading the atlas...'); await frame();
  initCountries(readData('countries'), readData('cities'));
  World.stats = Object.fromEntries(readData('stats').map(r => [r.id, r]));
  World.nat0 = [null]; for (const c of World.countries) if (c) World.nat0[c.idx] = makeNation(c, World.stats[c.id]);
  const topo110 = readData('map110m');
  World.maps['110m'] = decodeTopo(topo110);
  assignColors(); computeLabels(World.maps['110m']); prepareLabels();
  loadStep(0.25, 'Drawing the continents...'); await frame();
  Perf.init(); Overlay.init($('#overlay')); initGlobe($('#globe')); Input.init($('#globe'));
  const geo = await runSliced(buildLand(World.maps['110m'], 2.5), p => loadStep(0.25 + p * 0.6));
  setLandGeometry('110m', geo, buildLines(World.maps['110m'], 1, 1.5));
  buildCityPoints();
  UI.init();
  loadStep(1, 'Ready'); updateCamera();
  requestAnimationFrame(loop);
  await frame();
  $('#loading').classList.remove('on');
  UI.show('title');
  window.__sov.ready = true;
  // detailed borders for zooming in, built while the player looks at the title screen
  const topo50 = readData('map50m');
  World.maps['50m'] = decodeTopo(topo50); await frame();
  const geo50 = await runSliced(buildLand(World.maps['50m'], 1.2), null, 8);
  setLandGeometry('50m', geo50, buildLines(World.maps['50m'], 1, 0.8));
  if (UI.selected != null) setSelectedOutline(UI.selected);
  window.__sov.detailed = true;
}

let lastT = 0, ambientT = 0, labelsDirty = true;
function loop(now) {
  requestAnimationFrame(loop);
  const t = now / 1000, dt = Math.min(0.1, lastT ? t - lastT : 0.016); lastT = t;
  const moved = stepCamera(dt);
  if (Clock.step(dt)) Game.refresh();
  UI.updateHover();
  // ambient animation (clouds drifting, selection glow) only needs a few frames per second
  const ambient = (Globe.clouds && Globe.clouds.visible) || UI.selected != null || Globe.night !== Globe.nightTarget;
  let draw = Globe.dirty || moved;
  if (!draw && ambient && t - ambientT > (Perf.level === 'high' ? 1 / 30 : 1 / 15)) draw = true;
  if (!draw) return;
  if (Globe.dirty || moved) labelsDirty = true;
  ambientT = t;
  renderGlobe(dt, t);
  if (labelsDirty) { Overlay.draw(); labelsDirty = false; }
  Perf.tick(dt, moved || !!Input.down);
}

window.__sov = {
  ready: false, detailed: false, World, Cam, Globe, UI, Perf, Settings, MapModes, Clock, Gov, Panels, Setup,
  get G() { return G; }, newGame, worldMonth, nextMonth, forecast, budgetOf, gdpUsd, debtPct, serialize, saveTo, loadFrom, Game,
  flyTo, flyToCountry, screenToLL, llToScreen, pickLL,
  pick: (lon, lat) => { const h = pickLL(lon, lat); return h && h.c ? World.countries[h.c].id : null; },
  select: id => UI.select(id == null ? null : World.byId[id].idx, true),
  country: id => World.byId[id],
  info: () => ({ screen: UI.screen, lod: Globe.lod, alt: Cam.alt, lon: Cam.lon, lat: Cam.lat, fps: Perf.fps, level: Perf.level,
    tris: Globe.renderer.info.render.triangles, calls: Globe.renderer.info.render.calls, selected: UI.selected && World.countries[UI.selected].id })
};
boot().catch(e => { console.error(e); $('#load-text').textContent = 'Something went wrong while loading: ' + e.message; });
