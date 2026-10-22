// Government screens: Laws, Parliament, Cabinet, Projects, People (public opinion), News feed.
const fxNames = { g: ['Growth', '%', 1], i: ['Inflation', '%', -1], u: ['Unemployment', '%', -1], s: ['Stability', '', 1], a: ['Approval', '', 1], c: ['Corruption', '', -1], f: ['Freedom', '', 1], $: ['Cost', '% of GDP a year', -1], y: ['Borrowing cost', '%', -1], t: ['Research', '', 1], e: ['Pollution', '', -1], x: ['Prestige', '', 1] };
function fxList(fx, steps) {
  return Object.entries(fx).filter(([k]) => fxNames[k]).map(([k, v]) => {
    const d = v * steps * (k === 'c' ? 100 : 1), [name, unit, good] = fxNames[k];
    return `<span class="${(d > 0) === (good > 0) ? 'up' : 'down'}">${name} ${sgn(d, Math.abs(d) < 1 ? 2 : 1)}${unit && unit.length < 3 ? unit : ''}</span>`;
  }).join(' · ');
}
function reactLine(pre) {
  const h = pre.happy.length ? '<span class="up">Cheering: ' + pre.happy.join(', ') + '</span>' : '';
  const a = pre.angry.length ? '<span class="down">Angry: ' + pre.angry.join(', ') + '</span>' : '';
  return [h, a].filter(Boolean).join('<br>') || '<span class="sub">Few people care much either way.</span>';
}
Object.assign(Panels, {
  lawCat: 'Economy', lawSel: null,
  laws(el) {
    const n = me(); this.lawCat = this.lawCat || LAW_CATS[0];
    const list = LAWS.filter(l => l.cat === this.lawCat);
    let detail = '';
    if (this.lawSel) {
      const [id, lvl] = this.lawSel, law = LAWS.find(l => l.id === id), steps = lvl - n.laws[id];
      if (steps) {
        const v = lawVote(n, law, lvl), cost = lawCost(n, law, lvl), pre = reactionPreview(n, lawStances(law, steps), 1);
        detail = `<div class="forecast"><b>${esc(law.name)}: ${esc(law.levels[n.laws[id]])} → ${esc(law.levels[lvl])}</b>
          <div style="margin:6px 0">${fxList(law.fx, steps) || '<span class="sub">No direct effect on the numbers.</span>'}</div>
          <div>${reactLine(pre)}</div>
          <div style="margin-top:6px">Parliament: <b class="${v.pass ? 'up' : 'down'}">${v.yes} yes</b> of ${v.total} (needs ${v.need}${law.sup && free(n) ? ', two thirds' : ''})${law.k > 0 && free(n) ? ' · <span class="down">courts may strike it down</span>' : ''}</div>
          <div class="btnrow"><button class="btn gold small" data-law-go>Propose (${cost} capital)</button><button class="btn small" data-law-cancel>Cancel</button></div></div>`;
      }
    }
    el.innerHTML = this.head('Laws', `Political capital: <b>${n.pc.toFixed(0)}</b>/100 · Freedom ${n.freedom.toFixed(0)} · Corruption ${(n.corruption * 100).toFixed(0)}`) +
      `<div class="tabs">${LAW_CATS.map(c => `<button class="chip${c === this.lawCat ? ' on' : ''}" data-lcat="${c}">${c}</button>`).join('')}</div>` + detail +
      list.map(l => `<div style="padding:7px 0;border-bottom:1px solid var(--line)"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(l.name)}</b>${l.sup && free(n) ? '<span class="sub">constitutional</span>' : ''}</div>
        <div class="seg" style="margin-top:5px;flex-wrap:wrap">${l.levels.map((name, i) => `<button data-law="${l.id}" data-lv="${i}" class="${n.laws[l.id] === i ? 'on' : ''}" title="${esc(name)}">${esc(name)}</button>`).join('')}</div></div>`).join('');
    $$('[data-lcat]', el).forEach(b => b.onclick = () => { this.lawCat = b.dataset.lcat; this.lawSel = null; this.laws(el); });
    $$('[data-law]', el).forEach(b => b.onclick = () => { this.lawSel = [b.dataset.law, +b.dataset.lv]; this.laws(el); el.scrollTop = 0; });
    const go = $('[data-law-go]', el); if (go) go.onclick = () => { const r = Politics.propose(this.lawSel[0], this.lawSel[1]); toast(r.ok ? 'Law passed' : r.msg); this.lawSel = null; this.laws(el); };
    const no = $('[data-law-cancel]', el); if (no) no.onclick = () => { this.lawSel = null; this.laws(el); };
  },
  parliament(el) {
    const n = me(), P = n.parl, govSeats = P.parties.filter(p => p.gov).reduce((a, p) => a + p.seats, 0);
    el.innerHTML = this.head('Parliament', `${P.total} seats · government ${govSeats} (${(govSeats / P.total * 100).toFixed(0)}%)${n.nextElection ? ' · next election ' + fmtDate(n.nextElection) : ''}`) +
      `<canvas id="hemi" style="width:100%;height:190px"></canvas>
      <table class="rank"><thead><tr><th></th><th>Party</th><th>Seats</th><th>Side</th></tr></thead><tbody>${P.parties.map(p => `<tr><td><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${p.color}"></span></td><td>${esc(p.name)}${p.id === 'me' ? ' (yours)' : ''}</td><td>${p.seats}</td><td>${p.gov ? 'Government' : 'Opposition'}</td></tr>`).join('')}</tbody></table>
      <div class="note-box">Laws need a majority (two thirds for the constitution). Your party almost always votes with you; partners usually do; the opposition rarely does unless a law fits their ideas or is popular. Political capital helps win votes.</div>
      <h3>Courts</h3><div class="facts"><b>Court independence</b><span>${(n.court.indep * 100).toFixed(0)}%</span><b>Cases pending</b><span>${n.court.pending.length}</span></div>`;
    drawHemicycle($('#hemi', el), P);
  },
  cabinet(el) {
    const n = me();
    el.innerHTML = this.head('Cabinet', 'Skilled ministers make their area work better. Disloyal, ambitious ones may quit or plot.') +
      POSTS.map(([p, title]) => { const m = n.cabinet[p];
        return `<div class="slot" style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line)"><div style="width:44px" class="portrait">${faceSvg(faceFromName(m.name))}</div>
        <div style="flex:1"><b>${esc(m.name)}</b><div class="sub">${title} · skill ${m.skill}/10 · loyalty ${m.loyalty.toFixed(0)} · ambition ${m.ambition}</div></div><button class="btn small" data-post="${p}">Replace</button></div>`; }).join('') +
      (this.postSel ? `<div class="forecast"><b>Candidates for ${POSTS.find(x => x[0] === this.postSel)[1]}</b> (5 capital)${this.cands.map((c, i) => `<div class="sumrow"><span>${esc(c.name)} <span class="sub">skill ${c.skill}, loyalty ${c.loyalty}, ambition ${c.ambition}, honesty ${c.honesty}</span></span><button class="btn small gold" data-hire="${i}">Hire</button></div>`).join('')}</div>` : '');
    $$('[data-post]', el).forEach(b => b.onclick = () => { this.postSel = b.dataset.post; this.cands = Politics.candidates(this.postSel); this.cabinet(el); });
    $$('[data-hire]', el).forEach(b => b.onclick = () => { if (!Politics.hire(this.postSel, this.cands[+b.dataset.hire])) toast('Not enough political capital'); this.postSel = null; this.cabinet(el); });
  },
  projects(el) {
    const n = me(), gl = gdpUsd(n), cities = World.cities.filter(c => c.c === n.idx).sort((a, b) => b.pop - a.pop).slice(0, 12);
    this.projCity = this.projCity != null && World.cities[this.projCity] && World.cities[this.projCity].c === n.idx ? this.projCity : World.cities.indexOf(cities[0]);
    const active = n.projects.map((p, i) => { const P = PROJECTS.find(x => x.id === p.id); return `<div class="sumrow"><span>${esc(P.name)} · ${esc(World.cities[p.city].name)}</span><span>${p.done ? '<b class="up">Open</b>' : `<b>${(p.progress * 100).toFixed(0)}%</b> <button class="btn small" data-cancel="${i}">Cancel</button>`}</span></div>`; }).join('');
    el.innerHTML = this.head('Projects', 'Big building projects appear on the map. Each start costs 6 political capital; the money is spread over the build.') +
      (active ? '<h3>Your projects</h3>' + active : '') +
      `<h3>Build in</h3><select id="pcity" style="background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:5px">${cities.map(c => `<option value="${World.cities.indexOf(c)}"${World.cities.indexOf(c) === this.projCity ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <h3>Available</h3>` + PROJECTS.map(P => { const busy = n.projects.some(p => p.id === P.id && !p.done), locked = P.needs && !n.projects.some(p => p.id === P.needs && p.done);
        return `<div style="padding:6px 0;border-bottom:1px solid var(--line)"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(P.name)}</b><button class="btn small" data-proj="${P.id}"${busy || locked ? ' disabled' : ''}>${busy ? 'Building' : locked ? 'Needs ' + PROJECTS.find(x => x.id === P.needs).name : 'Build'}</button></div>
        <div class="sub">${usd(P.cost / 100 * gl)} over ${P.months} months · ${Object.keys(P.fx).filter(k => fxNames[k] || ['infra', 'human', 'health', 'know'].includes(k)).map(k => ({ infra: 'better infrastructure', human: 'better education', health: 'better health', know: 'more research' })[k] || fxNames[k][0] + ' +').join(', ')}</div></div>`; }).join('');
    $('#pcity', el).onchange = e => { this.projCity = +e.target.value; };
    $$('[data-proj]', el).forEach(b => b.onclick = () => { if (!Politics.startProject(b.dataset.proj, this.projCity)) toast('Not enough political capital, or not possible yet'); else flyTo(World.cities[this.projCity].lon, World.cities[this.projCity].lat, 0.02); });
    $$('[data-cancel]', el).forEach(b => b.onclick = () => Politics.cancelProject(+b.dataset.cancel));
  },
  people(el) {
    const n = me();
    el.innerHTML = this.head('People', `Polarisation ${n.polar.toFixed(0)}/100 · Stock market ${(n.stocks || 100).toFixed(0)} · Freedom ${n.freedom.toFixed(0)}`) +
      `<div class="sub" style="margin:6px 0">Approval is the average of these groups, weighted by how many people are in each. Power is how much they matter for your survival. Click a group to see why.</div>` +
      GROUPS.map(g => { const v = n.groups[g.id];
        return `<div class="sl" data-gwhy="${g.id}" style="cursor:pointer;grid-template-columns:150px 1fr 120px"><span>${g.icon} ${g.name}</span>
          <div style="height:10px;background:rgba(255,255,255,.08);border-radius:5px;overflow:hidden"><div style="height:100%;width:${v}%;background:${v > 55 ? 'var(--green)' : v < 35 ? 'var(--red)' : 'var(--gold)'}"></div></div>
          <span class="val">${v.toFixed(0)}%<small>${(g.share(n) * 100).toFixed(0)}% of people · power ${cloutOf(n, g.id).toFixed(1)}</small></span></div>`; }).join('') +
      `<h3>Who's who</h3>${(G.people || []).map(p => `<div class="sumrow"><span><b>${esc(p.name)}</b> <span class="sub">${esc(p.role)}</span></span><span class="sub">${esc(p.note)}</span></div>`).join('')}
      <h3>Spin doctors</h3><div class="btnrow"><button class="btn small" data-spin="press">Press conference (4)</button><button class="btn small" data-spin="blame">Blame the opposition (3)</button><button class="btn small" data-spin="bury">Bury bad news (2)</button></div>
      <div class="sub" style="margin-top:6px">Spin softens the next reaction, but can backfire.</div>` +
      ((n.crowds || []).length ? '<h3>In the streets</h3>' + n.crowds.map(c => `<div class="sumrow"><span>${c.kind === 'protest' ? '✊ Protest' : '🎉 Rally'} by ${esc(c.group.toLowerCase())} in ${esc(World.cities[c.city].name)}</span><button class="btn small" data-goto="${c.city}">Look</button></div>`).join('') : '');
    $$('[data-gwhy]', el).forEach(r => r.onclick = () => { const id = r.dataset.gwhy, gr = GROUPS[G_IDX[id]]; n.why['g_' + id] = n.gwhy && n.gwhy[id]; WHY_TITLES['g_' + id] = gr.name + ': what they think of you'; Game.why('g_' + id, r); });
    $$('[data-spin]', el).forEach(b => b.onclick = () => toast(Spin[b.dataset.spin]()));
    $$('[data-goto]', el).forEach(b => b.onclick = () => { const c = World.cities[+b.dataset.goto]; flyTo(c.lon, c.lat, 0.004); });
  },
  news(el) {
    const f = G.feed || [];
    el.innerHTML = this.head('News', 'Headlines and what people are posting') + (f.map(x => x.type === 'news'
      ? `<div class="mail"><div class="t"><span class="dot" style="background:${x.mood > 0 ? '#5fd38d' : x.mood < 0 ? '#ef6b5b' : '#93a3bd'}"></span>${esc(x.text)}</div><p>${esc(x.outlet)} · ${fmtDate(x.day)}</p></div>`
      : `<div class="mail" style="background:rgba(106,167,255,.05)"><div class="t" style="font-weight:500">${esc(x.text)}</div><p>@${esc(x.author.replace(/ .*/, ''))} · ${esc(x.group)} · ♥ ${fmtBig(x.likes)} · ${fmtDate(x.day)}</p></div>`).join('') || '<div class="sub">Quiet so far.</div>');
  }
});
function drawHemicycle(cv, P) {
  const pr = Math.min(devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight; cv.width = W * pr; cv.height = H * pr;
  const c = cv.getContext('2d'); c.setTransform(pr, 0, 0, pr, 0, 0);
  const rows = Math.ceil(Math.sqrt(P.total / 3)), R = Math.min(W / 2 - 6, H - 10), seats = [];
  for (let r = 0; r < rows; r++) { const rad = R * (0.45 + 0.55 * r / Math.max(1, rows - 1)), cnt = Math.round(P.total * rad / (R * rows * 0.75)); for (let i = 0; i < cnt; i++) seats.push([rad, Math.PI * (1 - i / Math.max(1, cnt - 1))]); }
  seats.sort((a, b) => b[1] - a[1]);
  const cols = []; for (const p of P.parties) for (let i = 0; i < p.seats; i++) cols.push(p.color);
  const dot = Math.max(1.5, R / rows / 3.2);
  seats.slice(0, cols.length).forEach(([rad, a], i) => { c.fillStyle = cols[Math.floor(i / seats.length * cols.length)] || '#555'; c.beginPath(); c.arc(W / 2 + Math.cos(a) * rad, H - 4 - Math.sin(a) * rad, dot, 0, 7); c.fill(); });
}
UI.courtRuling = (law, from) => {
  const n = G.nations[G.player.idx];
  UI.modal(`<h2>The Supreme Court rules</h2><p class="sub" style="font-size:14px">The court says your change to <b>${esc(law.name)}</b> breaks the constitution and must be undone.</p>
    <div class="actions"><button class="btn small" id="ct-defy">Ignore the court</button><button class="btn small gold" id="ct-ok">Obey the ruling</button></div>`);
  Clock.pause();
  $('#ct-ok').onclick = () => { UI.closeModal(); courtStrike(n, law, from, true); };
  $('#ct-defy').onclick = () => { UI.closeModal(); courtStrike(n, law, from, false); };
};
Object.assign(Panels, ElectionPanel);
