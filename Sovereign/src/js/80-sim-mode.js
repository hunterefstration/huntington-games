// ==========================================
// SIMULATOR MODE: watch the world run itself. The AI plays every country (pIdx() is -1, so no one is "the player").
// Speed time up, watch the wars, then take control of ANY country, on either side of any war, at any moment:
// from then on it is a normal game as that country's leader.
// ==========================================
const Sim = {
  start() {
    const c = World.countries.find(x => x && x.id === 'USA') || World.countries.find(x => x), n = World.nat0[c.idx];
    newGame({ idx: c.idx, name: n.leader, title: n.title, party: 'Governing party', econ: 0, social: 0, traits: [], face: faceFromName(n.leader), real: true });
    G.sim = true;
    Game.start(); Game.close(); Clock.paused = false; Bus.emit('clock');
    inbox('info', 'Simulator', 'The AI runs every country. Press play and speed time up (1-5). Click any country and choose Take control, or open Wars at the top to play either side of a war.');
    Game.refresh();
  },
  bar() {
    let b = $('#simbar');
    if (!b) {
      b = document.createElement('div'); b.id = 'simbar'; document.body.appendChild(b);
      b.addEventListener('click', e => { const t = e.target.closest('[data-sim]'); if (!t) return; if (t.dataset.sim === 'wars') Sim.wars(); else if (t.dataset.sim === 'pick') toast('Click a country on the globe, then press Take control.'); });
    }
    const on = !!(G && G.sim && (UI.screen === 'game' || UI.screen === 'hud'));
    b.classList.toggle('on', on);
    if (on) b.innerHTML = `<b>SIMULATOR</b><span>The AI runs every country (${G.wars.length} war${G.wars.length === 1 ? '' : 's'} going on).</span><button class="btn small" data-sim="wars">Wars</button><button class="btn small gold" data-sim="pick">Take control of a country</button>`;
    $('#hud-nation') && G && G.sim && ($('#hud-nation').innerHTML = `<span class="fl">🌍</span><span>Simulator<div class="sub">${fmtDate(G.day)}</div></span>`);
  },
  wars() {
    if (!G) return;
    const nm2 = i => World.countries[i].flag + ' ' + esc(World.countries[i].name);
    UI.modal(`<h2>Wars right now</h2>${G.wars.length ? '' : '<p class="sub">No wars at the moment. Speed time up and check back.</p>'}
      <div class="menu" style="width:auto">${G.wars.map(w => `<div class="note-box" style="text-align:left"><b>${nm2(w.a[0])}</b> vs <b>${nm2(w.d[0])}</b>
        <div class="sub">War score ${w.score > 0 ? '+' : ''}${Math.round(w.score)} for the attacker · started ${fmtDate(w.start || w.day || 0)}</div>
        <div class="btnrow"><button class="btn small" data-take="${w.a[0]}">Play as ${esc(World.countries[w.a[0]].name)}</button><button class="btn small" data-take="${w.d[0]}">Play as ${esc(World.countries[w.d[0]].name)}</button></div></div>`).join('')}</div>
      <div class="btnrow"><button class="btn" id="sim-close">Keep watching</button></div>`);
    $('#sim-close').onclick = () => UI.closeModal();
    $$('[data-take]').forEach(b => b.onclick = () => { UI.closeModal(); Sim.take(+b.dataset.take); });
  },
  take(idx) {
    const n = G.nations[idx], c = World.countries[idx];
    if (!n) return;
    if (n.owner != null) { toast(c.name + ' is controlled by ' + World.countries[n.owner].name + '. Take control of them instead.'); return; }
    G.sim = false;
    Object.assign(G.player, { idx, name: n.leader, title: n.title, party: 'Governing party', real: true, startDay: G.day, face: faceFromName(n.leader || c.name) });
    G.requests = []; G.pendingEvents = []; G.player.terms = null; G.people = null; G.vicStart = null;
    n.projects = n.projects || []; n.promises = n.promises || [];
    ensureSystems(G);           // the player-only systems (parliament, elections, people, tech...) for the new country
    Game.start(); Sim.bar();
    const w = G.wars.filter(x => x.a.includes(idx) || x.d.includes(idx));
    inbox('info', 'You now lead ' + c.name, (w.length ? c.name + ' is at war: see Military. ' : '') + 'It is ' + fmtDate(G.day) + '. Everything from here is up to you.');
    toast('You now lead ' + c.name);
  }
};
setInterval(() => { try { Sim.bar(); } catch (e) {} }, 1000);
