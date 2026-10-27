// Military screen: forces, mobilisation, stance, current wars, spy networks.
Object.assign(Panels, {
  military(el) {
    const me = G.player.idx, n = G.nations[me], A = n.army, wars = War.myWars();
    const nets = Object.entries(G.spy).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    el.innerHTML = this.head('Military', `${fmtInt(A.troops)} troops · equipment ${usd(A.E)} · morale ${A.morale.toFixed(0)}`) +
      `<div class="kv"><div><small>Land power</small><b>${landPower(n).toFixed(0)}</b></div><div><small>Navy</small><b>${navyPower(n).toFixed(0)}</b></div><div><small>Air force</small><b>${airPower(n).toFixed(0)}</b></div>
        <div><small>Technology</small><b>${techOf(n).toFixed(2)}</b></div><div><small>Nuclear warheads</small><b>${fmtInt(n.nukes)}</b></div><div><small>Defence budget</small><b>${pct(n.spend.defence)}</b><em class="sub">of GDP</em></div></div>
      <div class="opt"><div class="lbl">Mobilisation<small>Calls up reserves: 40% stronger army, but costly and unpopular with the young.</small></div><div class="seg"><button data-mob="0" class="${A.mobilized ? '' : 'on'}">Peace</button><button data-mob="1" class="${A.mobilized ? 'on' : ''}">Mobilised</button></div></div>
      <div class="opt"><div class="lbl">Army stance</div><div class="seg">${['defend', 'balanced', 'attack'].map(s => `<button data-st="${s}" class="${A.stance === s ? 'on' : ''}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div></div>
      <h3>Wars</h3>` + (wars.length ? wars.map(w => {
        const mine = w.a.includes(me), enemy = World.countries[mine ? w.d[0] : w.a[0]], sc = mine ? w.score : -w.score;
        return `<div class="forecast"><b>${mine ? 'Our attack on' : 'Defending against'} ${esc(enemy.name)}</b> <span class="sub">since ${fmtDate(Math.max(0, w.start))} · goal: ${WAR_GOALS[w.goal] || ''}</span>
          <div class="sumrow"><span>War score</span><b class="${sc >= 0 ? 'up' : 'down'}">${sc > 0 ? '+' : ''}${sc}</b></div>
          ${w.fronts.map(f => `<div class="sumrow"><span>Front ${esc(World.countries[f.a].name)} / ${esc(World.countries[f.b].name)}</span><span>${f.prog > 0 ? 'pushed ' + Math.round(f.prog * 100) + '% into ' + esc(World.countries[f.b].name) : f.prog < 0 ? 'pushed back ' + Math.round(-f.prog * 100) + '%' : 'at the border'}</span></div>`).join('')}
          <div class="sumrow"><span>Our dead / theirs</span><span>${fmtInt(w.dead[me] || 0)} / ${fmtInt(w.dead[mine ? w.d[0] : w.a[0]] || 0)}</span></div>
          <div class="sumrow"><span>War weariness at home</span><b>${(w.weary[me] || 0).toFixed(0)}/100</b></div>
          <div class="btnrow"><button class="btn small" data-wt="${mine ? w.d[0] : w.a[0]}">Strikes and peace talks</button><button class="btn small" data-wlook="${w.id}">Look at the front</button></div></div>`; }).join('') : '<div class="sub">We are at peace. To go to war, open a country in Diplomacy.</div>') +
      controlledHtml() +
      `<h3>Wars around the world</h3>` + (G.wars.filter(w => !wars.includes(w)).map(w => `<div class="sumrow"><span>${World.countries[w.a[0]].flag} ${esc(World.countries[w.a[0]].name)} vs ${World.countries[w.d[0]].flag} ${esc(World.countries[w.d[0]].name)}</span><span><button class="btn small" data-med="${w.id}">Mediate (8)</button> <button class="btn small" data-wlook="${w.id}">Look</button></span></div>`).join('') || '<div class="sub">None.</div>') +
      `<h3>Spy networks</h3>` + (nets.length ? nets.map(([t, v]) => `<div class="sumrow"><span>${World.countries[t].flag} ${esc(World.countries[t].name)}${+t === G.spyFocus ? ' (focus)' : ''}</span><span>${v.toFixed(0)}/100 <button class="btn small" data-wt="${t}">Operations</button></span></div>`).join('') : '<div class="sub">No networks yet. Pick a focus country on its Diplomacy page. Intelligence spending makes them grow faster.</div>');
    $$('[data-med]', el).forEach(b => b.onclick = () => { toast(mediate(G.wars.find(x => x.id === +b.dataset.med))); Bus.emit('changed'); });
    bindControlled(el);
    $$('[data-mob]', el).forEach(b => b.onclick = () => War.mobilize(b.dataset.mob === '1'));
    $$('[data-st]', el).forEach(b => b.onclick = () => War.stance(b.dataset.st));
    $$('[data-wt]', el).forEach(b => b.onclick = () => { Panels.diploTarget = +b.dataset.wt; Game.panel = null; Game.open('diplomacy'); });
    $$('[data-wlook]', el).forEach(b => b.onclick = () => { const w = G.wars.find(x => x.id === +b.dataset.wlook), L = frontLine(w.fronts[0]).flat(), p = L[Math.floor(L.length / 2)] || [capitalOf(w.d[0]).lon, capitalOf(w.d[0]).lat]; flyTo(p[0], p[1], 0.12); });
  }
});
