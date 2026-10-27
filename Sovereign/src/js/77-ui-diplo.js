// Diplomacy screen: overview (requests, organisations, UN, friends and rivals, world prices) and one page per country.
Object.assign(Panels, {
  diploTarget: null,
  diplomacy(el) {
    const me = G.player.idx, n = G.nations[me], t = this.diploTarget;
    if (t != null && t !== me) return this.diploCountry(el, t);
    const rels = G.nations.filter(m => m && m.idx !== me).map(m => [m, relation(m.idx, me)]).sort((a, b) => b[1] - a[1]);
    const row = ([m, v]) => `<div class="sumrow" style="cursor:pointer" data-dt="${m.idx}"><span>${World.countries[m.idx].flag} ${esc(World.countries[m.idx].name)}</span><b class="${v > 0 ? 'up' : 'down'}">${v > 0 ? '+' : ''}${v.toFixed(0)}</b></div>`;
    const myTreaties = G.treaties.filter(x => x.a === me || x.b === me), mySanc = G.sanctions.filter(s => s.by === me || s.on === me);
    const P = G.world.prices || {};
    el.innerHTML = this.head('Diplomacy', `Political capital ${n.pc.toFixed(0)} · Click any country on the map, or one below`) +
      (G.requests.length ? '<h3>Requests</h3>' + G.requests.map((r, i) => `<div class="sumrow"><span>${World.countries[r.from].flag} ${esc(r.text)}</span><span><button class="btn small gold" data-req="${i}" data-yes="1">${r.type === 'threat' ? 'Give in' : 'Accept'}</button> <button class="btn small" data-req="${i}" data-yes="0">${r.type === 'threat' ? 'Refuse' : 'Decline'}</button></span></div>`).join('') : '') +
      `<h3>Organisations</h3><div class="sub">Member of: ${n.blocs.map(b => BLOCS[b] || b).join(', ') || 'none'}</div>
      <div class="btnrow">${Object.entries(ORGS).map(([id, o]) => n.blocs.includes(id) ? `<button class="btn small" data-leave="${id}">Leave ${esc(o.name)}</button>` : o.can(World.countries[me], n) ? `<button class="btn small" data-join="${id}">Join ${esc(o.name)}</button>` : '').join('')}</div>
      <h3>UN Security Council</h3><div class="sub">Permanent (veto): USA, China, Russia, UK, France. This year also: ${G.unsc.map(i => World.countries[i].name).join(', ')}.</div>
      <div class="btnrow"><select id="un-t" style="background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:5px">${rels.slice().reverse().slice(0, 40).map(([m]) => `<option value="${m.idx}">${esc(World.countries[m.idx].name)}</option>`).join('')}</select>
        <button class="btn small" data-un="condemn">Propose: condemn (6)</button><button class="btn small" data-un="sanction">Propose: UN sanctions (6)</button></div>
      <h3>Closest friends</h3>${rels.slice(0, 8).map(row).join('')}
      <h3>Biggest rivals</h3>${rels.slice(-8).reverse().map(row).join('')}
      ${myTreaties.length ? '<h3>Our treaties</h3>' + myTreaties.map(x => `<div class="sumrow"><span>${TREATIES[x.type].name}</span><span>${World.countries[x.a === me ? x.b : x.a].flag} ${esc(World.countries[x.a === me ? x.b : x.a].name)}</span></div>`).join('') : ''}
      ${mySanc.length ? '<h3>Sanctions</h3>' + mySanc.map(s => `<div class="sumrow"><span>${s.by === me ? 'We sanction' : 'Sanctioned by'} ${esc(World.countries[s.by === me ? s.on : s.by].name)}</span><span>${s.level > 1 ? 'embargo' : 'sanctions'}</span></div>`).join('') : ''}
      <h3>World prices (100 = 2026)</h3><div class="kv">${Object.entries(GOODS).map(([k, name]) => `<div><small>${name}</small><b class="${(P[k] || 100) > 115 ? 'down' : ''}">${(P[k] || 100).toFixed(0)}</b></div>`).join('')}</div>`;
    $$('[data-dt]', el).forEach(r => r.onclick = () => { this.diploTarget = +r.dataset.dt; UI.select(+r.dataset.dt, true); this.diplomacy(el); });
    $$('[data-req]', el).forEach(b => b.onclick = () => { DiploAct.answer(+b.dataset.req, b.dataset.yes === '1'); Bus.emit('changed'); });
    $$('[data-join]', el).forEach(b => b.onclick = () => { toast(DiploAct.joinOrg(b.dataset.join)); Bus.emit('changed'); });
    $$('[data-leave]', el).forEach(b => b.onclick = () => UI.confirm('Leave ' + ORGS[b.dataset.leave].name + '?', 'Members will be upset, and some benefits end.', 'Leave', () => { toast(DiploAct.leaveOrg(b.dataset.leave)); Bus.emit('changed'); }));
    $$('[data-un]', el).forEach(b => b.onclick = () => { toast(DiploAct.resolution(b.dataset.un, +$('#un-t', el).value)); Bus.emit('changed'); });
  },
  diploCountry(el, t) {
    const me = G.player.idx, n = G.nations[me], m = G.nations[t], c = World.countries[t], rel = relation(t, me), p = m.persona || (m.persona = makePersona(m));
    const tr = G.treaties.filter(x => (x.a === me && x.b === t) || (x.a === t && x.b === me));
    n.why.rel = relWhy(me, t); WHY_TITLES.rel = 'Relations with ' + c.name;
    el.innerHTML = this.head(c.flag + ' ' + esc(c.name), `<a href="#" data-back style="color:var(--gold2)">← all countries</a>`) +
      `<div style="display:flex;gap:12px;align-items:center;margin:10px 0"><div style="font-size:44px;line-height:1;flex:none">${World.countries[m.idx].flag}</div>
        <div><b>${esc(m.title + ' ' + m.leader)}</b><div class="sub">${esc(GOV[m.gov].name)} · ${esc(personaText(p))}</div>
        <div class="sub">GDP ${usd(gdpUsd(m))} · ${fmtInt(m.mil)} troops${m.nukes ? ' · nuclear power' : ''}</div></div></div>
      <div class="kv"><div data-why="rel"><small>Relations with us</small><b class="${rel > 0 ? 'up' : 'down'}">${rel > 0 ? '+' : ''}${rel.toFixed(0)}</b></div><div><small>Trust</small><b>${(G.trust[PAIR(t, me)] == null ? 50 : G.trust[PAIR(t, me)]).toFixed(0)}</b></div><div><small>Stability</small><b>${m.stability.toFixed(0)}</b></div></div>
      ${tr.length ? '<div class="sub" style="margin-top:6px">Treaties: ' + tr.map(x => TREATIES[x.type].name).join(', ') + '</div>' : ''}
      <h3>Actions</h3>` + DiploAct.available(t).map(a => {
        const ch = a.ask ? DiploAct.chance(a.id, t) : null, cd = DiploAct.cooldown(a.id, t);
        return `<div style="padding:6px 0;border-bottom:1px solid var(--line)"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>${a.name}</b>
          <span>${ch ? `<span class="${ch.p > 0.5 ? 'up' : 'down'}" title="${ch.parts.map(q => q[0] + ' ' + q[1].toFixed(0)).join(', ')}">${Math.round(ch.p * 100)}% yes</span> ` : ''}<button class="btn small" data-da="${a.id}"${cd ? ' disabled' : ''}>${cd ? cd + ' days' : a.pc + ' capital'}</button></span></div><div class="sub">${a.desc}</div></div>`;
      }).join('') + (typeof warActionsHtml === 'function' ? warActionsHtml(t) : '');
    $('[data-back]', el).onclick = e => { e.preventDefault(); this.diploTarget = null; this.diplomacy(el); };
    $$('[data-da]', el).forEach(b => b.onclick = () => {
      const run = () => { toast(DiploAct.run(b.dataset.da, t)); Bus.emit('changed'); };
      if (['embargo', 'cancel', 'expel'].includes(b.dataset.da)) UI.confirm(ACTIONS.find(a => a.id === b.dataset.da).name + '?', 'This will badly damage relations with ' + c.name + '.', 'Do it', run); else run();
    });
    if (typeof bindWarActions === 'function') bindWarActions(el, t);
  }
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act="diplo"]'); if (!b || !G) return;
  Panels.diploTarget = +b.dataset.idx; Game.panel = null; Game.open('diplomacy');
}, true);
