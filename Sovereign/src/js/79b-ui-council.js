// World Council screen (1.4): the agenda with forecasts, your votes and lobbying, proposals, world laws, global crises.
const VOTE_WORD = { 1: 'Yes', '-1': 'No', 0: 'Abstain' };
Object.assign(Panels, {
  cnKind: 'climate', cnT: null, cnW: null,
  council(el) {
    const C = G.council, n = me(), inf = Council.influence(n), sim = !!G.sim;
    const infTip = Council.influenceWhy(n).filter(r => Math.abs(r[1]) >= 0.5).map(r => r[0] + ': ' + (r[1] > 0 ? '+' : '') + r[1].toFixed(0)).join('\n');
    let h = this.head('🕊 World Council', `Every country votes, every four months. Next session: <b>${fmtDate(Council.nextSessionDay())}</b> · session ${C.sessions + 1}`);
    h += `<div class="kv"><div title="${esc(infTip)}"><small>Your influence ⓘ</small><b>${inf.toFixed(0)}<span class="sub">/100</span></b></div>
      <div title="Your own resolutions passed / proposed"><small>Your resolutions</small><b>${C.stats.passed || 0}<span class="sub">/${C.stats.proposed || 0}</span></b></div>
      <div title="World laws in force right now"><small>World laws</small><b>${C.laws.filter(l => !RESOLUTIONS[l.kind].target).length}</b></div></div>
      <div class="sub" style="margin:4px 0 8px">Influence decides how far your lobbying moves other countries. It grows with your economy, a Security Council seat, prestige, foreign aid and your record: voting with the winning side, passing resolutions and helping in global crises. Defying world laws lowers it.</div>`;
    // ---- global crisis
    const c = C.crisis;
    if (c) {
      const K = WORLD_CRISES[c.id], prog = Council.progress(), mine = c.pledged[n.idx] || 0;
      h += `<h3>${K.icon} Global crisis: ${esc(K.name)}</h3><div class="note-box" style="text-align:left"><div class="sub">${esc(K.text)}</div>
        <div style="height:10px;background:rgba(255,255,255,.08);border-radius:5px;margin:8px 0 4px"><div style="height:100%;width:${Math.min(100, prog * 100)}%;background:${prog >= 1 ? 'var(--good,#5bd47a)' : 'var(--gold)'};border-radius:5px"></div></div>
        <div class="sub">World fund ${Math.round(prog * 100)}% full · ${c.left} month${c.left === 1 ? '' : 's'} left · damage to every country is ${Math.round(clamp(1 - prog, 0, 1) * 100)}% of the worst case. We pledged <b>${mine}% of GDP</b>.</div>
        ${sim ? '' : `<div class="btnrow">${PLEDGES.filter(([p]) => p > mine).map(([p, l]) => `<button class="btn small" data-cpl="${p}" title="Costs $${fmtBig(p / 100 * gdpUsd(n))} (added to our debt)">Pledge ${p}%</button>`).join('')}<button class="btn small gold" data-crally title="A speech at the emergency session: other countries add more, the more influence you have">Rally the world (8 PC)</button></div>`}</div>`;
    }
    // ---- agenda
    h += `<h3>Agenda for ${fmtDate(Council.nextSessionDay())}</h3>`;
    if (!C.agenda.length) h += `<div class="sub">Nothing on the agenda yet. Countries table resolutions a month before each session, and you can propose one below.</div>`;
    h += C.agenda.map((it, i) => {
      const d = RESOLUTIONS[it.kind], f = Council.forecast(it), mine = it.vote;
      return `<div class="note-box" style="text-align:left"><b>${d.icon} ${esc(Council.itemName(it))}</b> <span class="sub">proposed by ${it.by === n.idx && !sim ? 'us' : cnFlag(it.by) + ' ' + esc(cnName(it.by))}</span>
        <div class="sub">${esc(d.desc)}${d.sc ? ' <b>Security Council vote: any permanent member can veto.</b>' : ''}</div>
        <div class="sub">Expected now: <b class="up">${f.yes} yes</b>, <b class="down">${f.no} no</b>, ${f.abst} abstain${f.veto != null ? ` · <b class="down">veto by ${esc(cnName(f.veto))}</b>` : ''} → <b>${f.pass ? 'passes' : 'fails'}</b></div>
        ${sim ? '' : `<div class="btnrow"><span class="sub" style="align-self:center">Our vote:</span>${[[1, 'Yes'], [-1, 'No'], [0, 'Abstain']].map(([v, l]) => `<button class="btn small${mine === v ? ' gold' : ''}" data-cvote="${i}:${v}">${l}</button>`).join('')}</div>
        <div class="btnrow"><button class="btn small" data-clob="${i}:1:pc" title="Talk to friendly governments (works better with more influence and better relations)">Lobby for (5 PC)</button><button class="btn small" data-clob="${i}:-1:pc">Lobby against (5 PC)</button><button class="btn small" data-clob="${i}:${mine === -1 ? -1 : 1}:aid" title="Promise aid to poor countries for their votes">Aid for votes ($${fmtBig(0.0015 * gdpUsd(n))})</button><span class="sub" style="align-self:center">${it.nLobby || 0}/3 used</span></div>`}</div>`;
    }).join('');
    // ---- propose
    if (!sim) {
      const d = RESOLUTIONS[this.cnKind] || RESOLUTIONS.climate;
      const countries = World.countries.filter(x => x && G.nations[x.idx] && G.nations[x.idx].owner == null && x.idx !== n.idx).sort((a, b) => a.name.localeCompare(b.name));
      h += `<h3>Propose a resolution</h3><div class="sub">One per session; costs 10 political capital. AI countries vote on what is good for them, who proposed it and your lobbying.</div>
        <div class="btnrow"><select id="cn-kind" style="background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:6px">${Object.entries(RESOLUTIONS).map(([k, r]) => `<option value="${k}" ${k === this.cnKind ? 'selected' : ''}>${r.icon} ${esc(r.target ? { country: { sanction: 'Sanctions on...', condemn: 'Condemn...' }[k], war: 'Peacekeepers for a war...' }[r.target] : r.name({}))}</option>`).join('')}</select>
        ${d.target === 'country' ? `<select id="cn-t" style="background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:6px;max-width:180px"><option value="">Country...</option>${countries.map(x => `<option value="${x.idx}" ${this.cnT === x.idx ? 'selected' : ''}>${x.flag} ${esc(x.name)}</option>`).join('')}</select>` : ''}
        ${d.target === 'war' ? `<select id="cn-w" style="background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:6px;max-width:220px"><option value="">War...</option>${G.wars.map(w => `<option value="${w.id}" ${this.cnW === w.id ? 'selected' : ''}>${esc(cnName(w.a[0]) + ' vs ' + cnName(w.d[0]))}</option>`).join('')}</select>` : ''}
        <button class="btn small gold" id="cn-prop"${Council.canPropose() ? '' : ' disabled'}>Propose (10 PC)</button></div><div class="sub">${esc(d.desc)}${!d.target && Council.lawActive(this.cnKind) ? ' <b>Already in force.</b>' : ''}</div>`;
      h += `<div class="btnrow"><label class="sub" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="cn-auto" ${C.auto ? 'checked' : ''}> Let my ambassador vote when I have not chosen (votes the way our interests point)</label></div>`;
    }
    // ---- world laws
    const laws = C.laws;
    h += '<h3>In force</h3>' + (laws.length ? laws.map(l => {
      const d = RESOLUTIONS[l.kind], ok = !d.ok || sim || d.ok(n, l), key = l.kind + (l.t != null ? ':' + l.t : '') + (l.w != null ? ':w' + l.w : ''), months = (C.defy || {})[key] || 0;
      return `<div class="sumrow"><span><b>${d.icon} ${esc(Council.itemName(l))}</b> <span class="sub">until ${fmtDate(l.until)}${d.need ? ' · rule: ' + esc(d.need(l)) : ''}</span></span>${sim || !d.ok ? '' : ok ? '<b class="up">Keeping it</b>' : `<b class="down">Defying (${months} mo)</b>`}</div>`;
    }).join('') : '<div class="sub">No world laws or Council measures in force.</div>');
    // ---- history
    if (C.history.length) h += '<h3>Recent votes</h3>' + C.history.slice(0, 10).map(o => `<div class="sumrow"><span>${RESOLUTIONS[o.kind] ? RESOLUTIONS[o.kind].icon : ''} ${esc(o.title)} <span class="sub">${fmtDate(o.day)}${!sim && o.mine != null ? ' · we voted ' + VOTE_WORD[o.mine] : ''}</span></span><b class="${o.pass ? 'up' : 'down'}">${esc(o.result)}</b></div>`).join('');
    if ((C.crisisLog || []).length) h += '<h3>Past global crises</h3>' + C.crisisLog.map(x => `<div class="sumrow"><span>${WORLD_CRISES[x.id].icon} ${esc(WORLD_CRISES[x.id].name)} <span class="sub">${fmtDate(x.day)} · we gave ${x.mine || 0}% of GDP</span></span><b class="${x.won ? 'up' : 'down'}">${x.won ? 'Beaten' : 'Not stopped'}</b></div>`).join('');
    el.innerHTML = h;
    const re = msg => { if (msg) toast(msg, 3200); Bus.emit('changed'); this.council(el); };
    $$('[data-cvote]', el).forEach(b => b.onclick = () => { const [i, v] = b.dataset.cvote.split(':').map(Number); if (C.agenda[i]) C.agenda[i].vote = v; re(); });
    $$('[data-clob]', el).forEach(b => b.onclick = () => { const [i, dir, how] = b.dataset.clob.split(':'); re(Council.lobby(+i, +dir, how)); });
    $$('[data-cpl]', el).forEach(b => b.onclick = () => re(Council.pledge(+b.dataset.cpl)));
    const ra = $('[data-crally]', el); if (ra) ra.onclick = () => re(Council.rally());
    const k = $('#cn-kind', el); if (k) k.onchange = () => { this.cnKind = k.value; this.council(el); };
    const t = $('#cn-t', el); if (t) t.onchange = () => { this.cnT = t.value === '' ? null : +t.value; };
    const w = $('#cn-w', el); if (w) w.onchange = () => { this.cnW = w.value === '' ? null : +w.value; };
    const pr = $('#cn-prop', el); if (pr) pr.onclick = () => re(Council.propose(this.cnKind, this.cnT, this.cnW));
    const au = $('#cn-auto', el); if (au) au.onchange = () => { C.auto = au.checked; };
  }
});
HOW.push(['World Council (new in 1.4)', 'Every four months the countries of the world vote on resolutions: sanctions, condemnations, peacekeepers for a war, and world laws (climate, arms control, minimum tax, aid, trade, AI and space). A country votes yes when the resolution suits it, when it likes whoever proposed it, and when lobbying pushes it. Sanctions and peacekeepers also need 9 of the 15 Security Council members and no veto from a permanent member. Passed world laws last years: break one and every month costs relations with the countries that voted for it, plus Council influence, until someone proposes sanctions on you.'],
  ['Global crises (new in 1.4)', 'Pandemics, financial panics, food crises, solar storms, cyber plagues and even an asteroid hit the whole world. Every country pledges money to a world fund; the damage everyone takes each month shrinks as the fund fills, and a full fund ends the crisis early. Big givers win prestige and influence; rich countries that give nothing lose standing.'],
  ['Scenarios (new in 1.4)', 'New Game, Simulator and online rooms can start from a different world: Cold War II, After the Crash, Resource Scramble or Age of Peace. Each has its own victory goal in Goals.']);
GLOSSARY.push(['Council influence', 'Your voice at the World Council (0 to 100): economy size, Security Council seat, prestige, foreign aid and your record. More influence makes lobbying move more votes.'],
  ['Veto', 'Any of the five permanent Security Council members (USA, China, Russia, UK, France) can block sanctions and peacekeepers by voting no.'],
  ['Defying the Council', 'Not keeping a world law that passed. Costs relations and influence every month, and invites sanctions.']);
