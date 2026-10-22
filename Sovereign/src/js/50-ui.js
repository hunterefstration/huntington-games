// Screens, menus, map modes and the country cards.
const REGION_COLORS = { Africa: '#c99a5b', Americas: '#7fae74', Asia: '#c97a6b', Europe: '#7f9fd0', Oceania: '#58b3b0', Antarctic: '#c8d0d8' };
const MapModes = {
  list: [],
  add(id, name, color, legend) { this.list.push({ id, name, color, legend }); },
  get(id) { return this.list.find(m => m.id === id) || this.list[0]; }
};
MapModes.add('political', 'Political', c => c.color);
MapModes.add('regions', 'Regions', c => REGION_COLORS[c.region] || '#999');
MapModes.add('size', 'Size', c => { const t = clamp(Math.log10(c.area || 1) / 7.2, 0, 1); return '#' + new THREE.Color().setHSL(0.6 - t * 0.55, 0.45, 0.32 + t * 0.25).getHexString(); });

const UI = {
  screen: 'loading', selected: null, hover: null, home: null, mode: 'political', region: 'All', list: [],

  show(name) {
    this.screen = name;
    const el = name === 'game' ? 'hud' : name;
    $$('.screen').forEach(s => s.classList.toggle('on', s.id === el));
    $('#hud').classList.toggle('playing', name === 'game');
    Overlay.visible = name === 'select' || name === 'hud' || name === 'game';
    if (name !== 'game') { Clock.paused = true; $('#panel').classList.add('hidden'); $('#why').classList.add('hidden'); }
    showLegend(MapModes.get(this.mode));
    if (name === 'title') this.titleButtons();
    const cam = Globe.camera;
    if (name === 'title') {
      Cam.spin = 4; flyTo(Cam.lon, 18, 2.5, 1.2);
      cam.setViewOffset(innerWidth, innerHeight, -innerWidth * 0.16, 0, innerWidth, innerHeight);
      this.select(null); this.home = null; Globe.uni.home.value = -1;
    } else { Cam.spin = 0; cam.clearViewOffset(); }
    cam.updateProjectionMatrix(); Globe.dirty = true;
  },

  init() {
    $('#title .ver').textContent = 'version ' + VERSION;
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const a = b.dataset.act;
      if (a === 'new') { G = null; this.show('select'); this.renderList(); $('#sel-search').focus(); }
      else if (a === 'continue') { const slot = Saves.latest(); if (slot) loadFrom(slot).then(ok => ok && Game.start(), e => toast(e.message)); }
      else if (a === 'load') Saves.open(false);
      else if (a === 'save') Saves.open(true);
      else if (a === 'setup-back') this.show('select');
      else if (a === 'hall') Hall.open();
      else if (a === 'take-office') Setup.go();
      else if (a === 'explore') { G = null; this.home = null; this.startHud(); }
      else if (a === 'settings') this.settings();
      else if (a === 'credits') this.credits();
      else if (a === 'back') this.show('title');
      else if (a === 'menu') this.menu();
      else if (a === 'zin') { Cam.fly = null; camZoom(0.5); }
      else if (a === 'zout') { Cam.fly = null; camZoom(2); }
      else if (a === 'home') this.goHome();
      else if (a === 'night') this.toggleNight();
      else if (a === 'lead') Setup.open(+b.dataset.idx);
      else if (a === 'fly') { const c = World.countries[+b.dataset.idx]; flyToCountry(c); }
      else if (a === 'close-card') this.select(null);
      else if (a === 'close-modal') this.closeModal();
      else if (a === 'quit') { this.closeModal(); Clock.pause(); (G && !G.over ? saveTo('auto') : Promise.resolve()).then(() => { G = null; this.show('title'); }); }
      else if (a === 'confirm-ok') { this.closeModal(); if (this.onOk) this.onOk(); }
    });
    // country select
    const regions = ['All', 'Africa', 'Americas', 'Asia', 'Europe', 'Oceania'];
    $('#sel-regions').innerHTML = regions.map(r => `<button class="chip${r === 'All' ? ' on' : ''}" data-r="${r}">${r}</button>`).join('');
    $('#sel-regions').addEventListener('click', e => {
      const b = e.target.closest('[data-r]'); if (!b) return;
      this.region = b.dataset.r; $$('#sel-regions .chip').forEach(x => x.classList.toggle('on', x === b)); this.renderList();
    });
    $('#sel-search').addEventListener('input', () => this.renderList());
    $('#sel-search').addEventListener('keydown', e => { if (e.key === 'Enter' && this.list[0]) this.select(this.list[0].idx, true); });
    $('#sel-list').addEventListener('click', e => { const r = e.target.closest('[data-idx]'); if (r) this.select(+r.dataset.idx, true); });
    // map modes
    $('#hud-modes').innerHTML = MapModes.list.map(m => `<button data-mode="${m.id}">${m.name}</button>`).join('');
    $('#hud-modes').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (b) this.setMode(b.dataset.mode); });
    this.setMode('political');
    // globe interaction
    Bus.on('click', (x, y) => {
      if (this.screen !== 'select' && this.screen !== 'hud' && this.screen !== 'game') return;
      const small = Overlay.hitSmall(x, y);
      if (small != null) return this.select(small, false);
      const ll = screenToLL(x, y), hit = ll && pickLL(ll.lon, ll.lat);
      this.select(hit && hit.c ? hit.c : null, false);
    });
    Bus.on('hover', (x, y) => { this.hoverAt = [x, y]; });
    Bus.on('key', (k, e) => {
      if (k === 'Escape') {
        if (!$('#modal').classList.contains('hidden')) this.closeModal();
        else if (!$('#why').classList.contains('hidden')) $('#why').classList.add('hidden');
        else if (this.screen === 'game' && Game.panel) Game.close();
        else if (this.selected != null && this.screen !== 'title') this.select(null);
        else if (this.screen === 'hud' || this.screen === 'game') this.menu();
        else if (this.screen === 'setup') this.show('select');
        else if (this.screen === 'select') this.show('title');
      } else if ((this.screen === 'hud' || this.screen === 'game') && k === 'n') this.toggleNight();
      else if ((this.screen === 'hud' || this.screen === 'game') && k === 'Home') this.goHome();
      else if (this.screen === 'hud' && /^[1-9]$/.test(k) && MapModes.list[+k - 1]) this.setMode(MapModes.list[+k - 1].id);
    });
  },

  // hover is resolved once per frame, not on every mouse event
  updateHover() {
    if (!this.hoverAt || Input.down) return;
    const [x, y] = this.hoverAt; this.hoverAt = null;
    let idx = null;
    if (this.screen === 'select' || this.screen === 'hud' || this.screen === 'game') {
      idx = Overlay.hitSmall(x, y);
      if (idx == null) { const ll = screenToLL(x, y), hit = ll && pickLL(ll.lon, ll.lat); idx = hit && hit.c ? hit.c : null; }
    }
    if (idx !== this.hover) {
      this.hover = idx; Globe.uni.hover.value = idx == null ? -1 : idx;
      $('#globe').style.cursor = idx == null ? '' : 'pointer'; Globe.dirty = true;
    }
  },

  setMode(id) {
    this.mode = id; const m = MapModes.get(id);
    setCountryColors(m.color);
    $$('#hud-modes button').forEach(b => b.classList.toggle('on', b.dataset.mode === id));
    showLegend(m);
  },

  renderList() {
    const q = $('#sel-search').value.trim().toLowerCase();
    this.list = World.countries.filter(c => c && (this.region === 'All' || c.region === this.region) &&
      (!q || c.name.toLowerCase().includes(q) || c.official.toLowerCase().includes(q) || c.capital.toLowerCase().includes(q) || c.id.toLowerCase() === q));
    if (q) this.list.sort((a, b) => (b.name.toLowerCase().startsWith(q)) - (a.name.toLowerCase().startsWith(q)));
    $('#sel-list').innerHTML = this.list.map(c => `<div class="row${c.idx === this.selected ? ' on' : ''}" data-idx="${c.idx}"><span class="fl">${c.flag}</span><span class="nm">${esc(c.name)}<div class="sub">${esc(c.sub || c.region)}</div></span></div>`).join('')
      || '<div class="row"><span class="nm sub">No country matches.</span></div>';
  },

  select(idx, fly) {
    this.selected = idx;
    setSelectedOutline(idx);
    $$('#sel-list .row').forEach(r => r.classList.toggle('on', +r.dataset.idx === idx));
    const card = this.screen === 'select' ? $('#sel-card') : $('#info');
    if (idx == null) { $('#sel-card').classList.add('hidden'); $('#info').classList.add('hidden'); return; }
    const c = World.countries[idx];
    if (fly) flyToCountry(c);
    card.innerHTML = this.cardHtml(c);
    card.classList.remove('hidden');
    if (this.screen === 'select') { const row = $(`#sel-list [data-idx="${idx}"]`); if (row) row.scrollIntoView({ block: 'nearest' }); }
  },

  cardHtml(c) {
    const nb = c.borders.map(id => World.byId[id].name);
    const facts = nationFacts(c).concat([['Region', c.sub || c.region], ['Area', fmtInt(c.area) + ' km²'], ['Languages', c.langs.join(', ') || '-'],
      ['Neighbours', nb.length ? (nb.length > 6 ? nb.slice(0, 6).join(', ') + ' +' + (nb.length - 6) : nb.join(', ')) : 'none (island or coast only)']]);
    const isSel = this.screen === 'select';
    if (isSel) facts.unshift(['Difficulty', '★'.repeat(difficultyOf(c.idx)) + '☆'.repeat(5 - difficultyOf(c.idx))]);
    return `<button class="icon x" data-act="close-card" title="Close">&times;</button>
      <div class="big-flag">${c.flag}</div><h3>${esc(c.name)}</h3><div class="off">${esc(c.official)}</div>
      <div class="facts">${facts.map(([k, v]) => `<b>${k}</b><span>${esc(v)}</span>`).join('')}</div>
      ${isSel ? `<button class="btn gold" data-act="lead" data-idx="${c.idx}">Lead ${esc(c.name)}</button>`
        : `<div class="btnrow"><button class="btn small" data-act="fly" data-idx="${c.idx}">Fly here</button>${G && c.idx !== G.player.idx ? `<button class="btn small gold" data-act="diplo" data-idx="${c.idx}">Diplomacy</button>` : ''}</div>`}`;
  },

  titleButtons() {
    const has = !!Saves.latest();
    $('#title .menu').innerHTML = (has ? '<button class="btn gold" data-act="continue">Continue</button><button class="btn" data-act="new">New Game</button><button class="btn" data-act="load">Load Game</button>'
      : '<button class="btn gold" data-act="new">New Game</button>') +
      '<button class="btn" data-act="explore">Explore the World</button><button class="btn" data-act="hall">Hall of Leaders</button><button class="btn" data-act="settings">Settings</button><button class="btn" data-act="credits">Credits</button>';
  },
  confirm(title, text, ok, fn) {
    this.onOk = fn;
    this.modal(`<h2>${esc(title)}</h2><p class="sub" style="font-size:14px">${esc(text)}</p><div class="actions"><button class="btn small" data-act="close-modal">Cancel</button><button class="btn small gold" data-act="confirm-ok">${esc(ok)}</button></div>`);
  },
  startHud() {
    this.show('hud'); this.select(null);
    const c = this.home != null ? World.countries[this.home] : null;
    $('#hud-nation').innerHTML = c ? `<span class="fl">${c.flag}</span>${esc(c.name)}` : '<span class="fl">🌍</span>Explore mode';
    $('#hud-note').textContent = 'Drag to move · scroll to zoom · click a country';
    if (c) flyToCountry(c); else flyTo(Cam.lon, 25, 2.2);
  },
  goHome() { if (this.home != null) flyToCountry(World.countries[this.home]); else flyTo(Cam.lon, Cam.lat, 2.2); },
  toggleNight() { Globe.nightTarget = Globe.nightTarget ? 0 : 1; $('[data-act="night"]').classList.toggle('on', !!Globe.nightTarget); },

  modal(html) { $('#modal-box').innerHTML = html; $('#modal').classList.remove('hidden'); },
  closeModal() { $('#modal').classList.add('hidden'); },
  menu() {
    this.modal(`<h2>Menu</h2><div class="menu" style="width:auto">
      <button class="btn" data-act="close-modal">Resume</button>
      ${G ? '<button class="btn" data-act="save">Save game</button><button class="btn" data-act="load">Load game</button>' : ''}
      <button class="btn" data-act="settings">Settings</button>
      <button class="btn" data-act="credits">Credits</button>
      <button class="btn" data-act="quit">Quit to title</button></div>`);
  },
  settings() {
    const seg = (key, opts) => `<div class="seg" data-set="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(Settings[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    this.modal(`<h2>Settings</h2>
      <div class="opt"><div class="lbl">Graphics<small>Auto lowers detail if the game gets slow</small></div>${seg('quality', [['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']])}</div>
      <div class="opt"><div class="lbl">Clouds</div>${seg('clouds', [[true, 'On'], [false, 'Off']])}</div>
      <div class="opt"><div class="lbl">Map labels</div>${seg('labels', [['low', 'Fewer'], ['normal', 'Normal'], ['high', 'More']])}</div>
      <div class="opt"><div class="lbl">Interface size</div>${seg('ui', [[0.9, '90%'], [1, '100%'], [1.15, '115%'], [1.3, '130%']])}</div>
      <div class="opt"><div class="lbl">Show frame rate</div>${seg('fps', [[true, 'On'], [false, 'Off']])}</div>
      <div class="actions"><button class="btn small gold" data-act="close-modal">Done</button></div>`);
    $$('#modal-box .seg').forEach(s => s.addEventListener('click', e => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      const k = s.dataset.set, raw = b.dataset.v;
      Settings[k] = raw === 'true' ? true : raw === 'false' ? false : isNaN(+raw) ? raw : +raw;
      $$('button', s).forEach(x => x.classList.toggle('on', x === b));
      if (k === 'quality') { Settings.autoLevel = 'medium'; Perf.set(raw === 'auto' ? 'medium' : raw); }
      saveSettings();
    }));
  },
  credits() {
    this.modal(`<h2>Credits</h2><div class="credits">
      <div class="hg">A Huntington Games production</div>
      <p><b>Sovereign</b> version ${VERSION}. Made by Huntington Games.</p>
      <p><b>Country figures:</b> rounded public estimates for 2025. Leaders as of mid 2026. Portraits are drawings, not photos.</p>
      <p><b>Map borders:</b> Natural Earth (public domain), via world-atlas.</p>
      <p><b>Country facts:</b> mledoze/countries (Open Database License).</p>
      <p><b>Cities:</b> GeoNames (CC BY 4.0).</p>
      <p><b>3D engine:</b> three.js (MIT licence).</p>
      <p>Borders and names follow the map data and are shown for gameplay only.</p>
      </div><div class="actions"><button class="btn small gold" data-act="close-modal">Close</button></div>`);
  }
};
function applyUiScale() { document.documentElement.style.setProperty('--ui', Settings.ui || 1); }
Bus.on('settings', () => { applyUiScale(); $('#fps').classList.toggle('hidden', !Settings.fps); Globe.dirty = true; });
