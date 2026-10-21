// Side panels: Overview, Economy, Budget, Money & Debt, World, Inbox.
const pct = (v, d = 1) => v.toFixed(d) + '%';
const sgn = (v, d = 1) => (v >= 0 ? '+' : '') + v.toFixed(d);
const usd = v => '$' + fmtBig(v);
const me = () => G.nations[G.player.idx];
const histLabel = (h) => i => { const back = h.length - 1 - i, d = dateOf(G.day); return MONTHS[((d.getUTCMonth() - back) % 12 + 1200) % 12] + ' ' + (d.getUTCFullYear() + Math.floor((d.getUTCMonth() - back) / 12)); };
const MON_TEXT = {
  float: c => `The <b>${c}</b> is our own currency and floats freely. We can set interest rates (if we control the central bank) and print money.`,
  union: () => 'We use the <b>euro</b>. The European Central Bank sets our interest rate for the whole euro area, and we cannot print money.',
  peg: (c, a) => `The <b>${c}</b> is pegged to the <b>${a}</b>. Our interest rate follows theirs. If the peg looks too high, speculators can force a devaluation.`,
  adopted: (c, a) => `We use the <b>${a}</b> as our money. We have no central bank policy of our own: no rate setting, no printing.`
};

const Panels = {
  draft: null,
  head(title, sub) { return `<button class="icon x" data-act="close-panel" title="Close">&times;</button><h2>${title}</h2>${sub ? `<div class="sub">${sub}</div>` : ''}`; },
  tiles(n) {
    const b = n.budget || budgetOf(n);
    return `<div class="kv">
      <div data-why="approval"><small>Approval</small><b>${pct(n.approval, 0)}</b></div>
      <div data-why="stability"><small>Stability</small><b>${n.stability.toFixed(0)}</b><em class="sub">/100</em></div>
      <div data-why="growth"><small>GDP</small><b>${usd(gdpUsd(n))}</b><em class="${n.growth >= 0 ? 'up' : 'down'}">${sgn(n.growth)}%</em></div>
      <div data-why="growth"><small>GDP per person</small><b>${usd(gdpUsd(n) / n.pop)}</b></div>
      <div data-why="infl"><small>Inflation</small><b>${pct(n.infl)}</b></div>
      <div data-why="unemp"><small>Unemployment</small><b>${pct(n.unemp)}</b></div>
      <div data-why="budget"><small>Government debt</small><b>${pct(debtPct(n), 0)}</b><em class="sub">of GDP</em></div>
      <div data-why="budget"><small>Budget ${b.deficit > 0 ? 'deficit' : 'surplus'}</small><b class="${b.deficit > 0 ? 'down' : 'up'}">${pct(Math.abs(b.deficit))}</b></div>
      <div data-why="yield"><small>Borrowing cost</small><b>${pct(n.yield, 2)}</b></div>
    </div>`;
  },
  warnings(n) {
    const w = [], b = n.budget || budgetOf(n);
    if (n.crisis) w.push('Debt crisis: lenders are fleeing. See Money & Debt.');
    if (n.infl > 10) w.push('Inflation is ' + pct(n.infl) + '. Higher interest rates, less printing or a smaller deficit would cool it.');
    if (b.deficit > 6) w.push('The deficit is ' + pct(b.deficit) + ' of GDP. Debt is piling up.');
    if (n.yield > 9) w.push('Lenders charge us ' + pct(n.yield) + '. Interest is eating the budget.');
    if (n.approval < 35) w.push('Approval is low (' + pct(n.approval, 0) + '). People want better services, lower prices or jobs.');
    if (n.stability < 35) w.push('Stability is ' + n.stability.toFixed(0) + '. Unrest could turn into protests.');
    if (n.unemp > 12) w.push('Unemployment is ' + pct(n.unemp) + '.');
    return w.length ? w.map(t => `<div class="note-box">${t}</div>`).join('') : '<div class="sub">No urgent problems. Your advisers are calm.</div>';
  },

  overview(el) {
    const n = me(), c = World.countries[n.idx], P = G.player;
    const traits = P.traits.map(id => TRAITS.find(t => t.id === id).name).join(', ');
    el.innerHTML = this.head(c.flag + ' ' + esc(c.name), esc(GOV[n.gov].name) + ' · ' + fmtDate(G.day)) + `
      <div style="display:flex;gap:14px;align-items:center;margin:12px 0">
        <div class="portrait" style="width:84px;flex:none">${faceSvg(P.face)}</div>
        <div><b style="font-size:16px">${esc(P.title + ' ' + P.name)}</b><div class="sub">${esc(P.party)} · ${ideologyName(P.econ, P.social)}</div>
        <div class="sub">Traits: ${esc(traits)}</div><div class="sub">In office ${Math.floor(n.months / 12)} years ${n.months % 12} months</div></div>
      </div>
      ${this.tiles(n)}
      <h3>Advisers</h3>${this.warnings(n)}
      <h3>Latest</h3>${G.inbox.slice(0, 3).map(m => this.mail(m)).join('') || '<div class="sub">Nothing yet. Press play (space) to start time.</div>'}
      <h3>Your country</h3>
      <div class="facts"><b>Blocs</b><span>${n.blocs.map(b => BLOCS[b] || b).join(', ') || 'none'}</span>
      <b>Strengths</b><span>${n.res.map(r => RES_NAMES[r] || r).join(', ')}</span>
      <b>Military</b><span>${fmtInt(n.mil)} troops, ${usd(n.milx)} a year${n.nukes ? ', about ' + fmtInt(n.nukes) + ' nuclear warheads' : ''}</span>
      <b>Currency</b><span>${esc(World.countries[n.idx].curName)} (${n.mon.cur})</span></div>
      <div class="note-box">This early build runs the economy, budget and money. Laws, parliament, elections, diplomacy and war arrive in the next updates.</div>`;
  },

  economy(el) {
    const n = me();
    const keys = [['gdp', 'GDP ($)', v => usd(v)], ['growth', 'Growth', v => sgn(v) + '%'], ['infl', 'Inflation', v => pct(v)], ['unemp', 'Unemployment', v => pct(v)],
      ['approval', 'Approval', v => pct(v, 0)], ['stability', 'Stability', v => v.toFixed(0)], ['debt', 'Debt (% GDP)', v => pct(v, 0)], ['deficit', 'Deficit (% GDP)', v => pct(v)],
      ['rate', 'Interest rate', v => pct(v, 2)], ['yield', 'Borrowing cost', v => pct(v, 2)], ['fx', 'Currency value', v => v.toFixed(1)]];
    this.chartKey = this.chartKey || 'growth';
    const k = keys.find(x => x[0] === this.chartKey);
    el.innerHTML = this.head('Economy', 'Click a number to see what drives it.') + this.tiles(n) +
      `<h3>History</h3><div class="tabs">${keys.map(([id, name]) => `<button class="chip${id === this.chartKey ? ' on' : ''}" data-chart="${id}">${name}</button>`).join('')}</div>
      <div class="sub">${k[1]}${k[0] === 'fx' ? ' (US dollars per unit, 100 at the start)' : ''}</div><div class="chart" id="ch-main"></div>
      <h3>Foundations (built by spending over years)</h3>
      <div class="facts"><b>Infrastructure</b><span>${sgn(n.k.infra - n.base.k.infra, 2)}% of GDP vs start</span><b>Research</b><span>${sgn(n.k.know - n.base.k.know, 2)}</span>
      <b>Education</b><span>${sgn(n.k.human - n.base.k.human, 2)}</span><b>Health</b><span>${sgn(n.k.health - n.base.k.health, 2)}</span></div>`;
    $$('[data-chart]', el).forEach(b => b.onclick = () => { this.chartKey = b.dataset.chart; this.economy(el); });
    const h = n.hist[k[0]] || [];
    drawChart($('#ch-main', el), h, { fmt: k[2], label: histLabel(h), zero: ['growth', 'deficit'].includes(k[0]) });
  },

  budget(el) {
    const n = me();
    if (!this.draft || this.draft.idx !== n.idx) this.draft = { idx: n.idx, tax: Object.assign({}, n.tax), spend: Object.assign({}, n.spend) };
    const D = this.draft, sim = Object.assign({}, n, { tax: D.tax, spend: D.spend }), b = budgetOf(sim), rev = revenueOf(sim), gl = gdpUsd(n);
    const row = (kind, id, name, val, max, step, unit, sub) => {
      const changed = Math.abs(val - n[kind][id]) > 1e-9;
      return `<div class="sl${changed ? ' changed' : ''}"><span class="lbl">${name}</span><input type="range" min="0" max="${max}" step="${step}" value="${val}" data-k="${kind}" data-id="${id}">
        <span class="val">${unit === '$/t' ? '$' + val + '/t' : val.toFixed(step < 0.1 ? 2 : 1) + '%'}<small>${sub}</small></span></div>`;
    };
    el.innerHTML = this.head('Budget', 'Taxes and spending per year. Changes take effect when you press Pass budget.') +
      (n.imf > 0 ? '<div class="note-box">IMF programme: the IMF expects us to keep spending down for ' + n.imf + ' more months.</div>' : '') +
      '<h3>Taxes</h3>' + TAXES.map(t => row('tax', t.id, t.name, D.tax[t.id], t.max, t.step, t.unit, usd(rev.parts[t.id] / 100 * gl))).join('') +
      `<div class="sumrow"><span>Tax income</span><b>${pct(b.rev)} of GDP · ${usd(b.rev / 100 * gl)}</b></div>` +
      (b.rent > 0.05 ? `<div class="sumrow"><span>Oil and gas income</span><b>${pct(b.rent)} · ${usd(b.rent / 100 * gl)}</b></div>` : '') +
      '<h3>Spending</h3>' + MINISTRIES.map(m => row('spend', m.id, m.name, D.spend[m.id], Math.max(15, Math.ceil(n.spend[m.id] * 2.5)), 0.05, '%', usd(D.spend[m.id] / 100 * gl))).join('') +
      `<div class="sumrow"><span>Spending</span><b>${pct(b.spend)} · ${usd(b.spend / 100 * gl)}</b></div>
      <div class="sumrow"><span>Interest on debt</span><b>${pct(b.interest)} · ${usd(b.interest / 100 * gl)}</b></div>
      <div class="sumrow"><span>${b.deficit > 0 ? 'Deficit (new borrowing)' : 'Surplus'}</span><b class="${b.deficit > 0 ? 'down' : 'up'}">${pct(Math.abs(b.deficit))} · ${usd(Math.abs(b.deficit) / 100 * gl)}</b></div>
      <div class="forecast" id="fc">Move a slider to see a 12-month forecast.</div>
      <div class="btnrow"><button class="btn gold small" data-bud="apply">Pass budget</button><button class="btn small" data-bud="reset">Reset</button></div>`;
    $$('input[type=range]', el).forEach(inp => inp.oninput = () => {
      D[inp.dataset.k][inp.dataset.id] = +inp.value;
      clearTimeout(this.bt); this.bt = setTimeout(() => this.budget(el), 120);
    });
    $('[data-bud="apply"]', el).onclick = () => { Gov.applyBudget(D.tax, D.spend); this.draft = null; };
    $('[data-bud="reset"]', el).onclick = () => { this.draft = null; this.budget(el); };
    const dirty = TAXES.some(t => D.tax[t.id] !== n.tax[t.id]) || MINISTRIES.some(m => D.spend[m.id] !== n.spend[m.id]);
    if (dirty) this.showForecast($('#fc', el), x => { Object.assign(x.tax, D.tax); Object.assign(x.spend, D.spend); });
  },
  showForecast(box, change) {
    const f = forecast(change, 12), r = (name, v, good, d = 1, unit = '') => {
      const s = Math.abs(v) < 0.05 ? 'no change' : `<b class="${(v > 0) === (good > 0) ? 'up' : 'down'}">${sgn(v * 0.7, d)} to ${sgn(v * 1.3, d)}${unit}</b>`;
      return `<div>${name}: ${s}</div>`;
    };
    box.innerHTML = '<b>Forecast after 12 months</b> (compared with no change)<div class="fx">' + r('Approval', f.approval, 1) + r('Stability', f.stability, 1) + r('Growth', f.growth, 1, 2, '%') +
      r('Inflation', f.infl, -1, 2, '%') + r('Unemployment', f.unemp, -1, 2, '%') + r('Debt', f.debt, -1, 1, '% GDP') + '</div>';
  },

  money(el) {
    const n = me(), mon = n.mon, c = World.countries[n.idx], cur = G.cur[mon.cur], share = reserveShareOf(n);
    const trust = cur ? cur.trust : currencyTrust(mon.cur).total, canFloat = mon.type === 'float';
    const res = Object.entries(G.cur).sort((a, b) => b[1].share - a[1].share).map(([k, v]) => `<div class="sumrow"><span>${k}${k === mon.cur ? ' (ours)' : ''}</span><b>${pct(v.share * 100)}</b></div>`).join('');
    el.innerHTML = this.head('Money & Debt', esc(c.curName) + ' (' + mon.cur + ')') +
      `<div class="note-box">${MON_TEXT[mon.type](mon.cur, mon.anchor)}</div>
      <div class="kv">
        <div><small>Central bank rate</small><b>${pct(mon.rate, 2)}</b></div>
        <div data-why="infl"><small>Inflation</small><b>${pct(n.infl)}</b></div>
        <div><small>Currency value</small><b>${n.fx.toFixed(1)}</b><em class="sub">start 100</em></div>
        <div data-why="trust"><small>Trust in the ${mon.cur}</small><b>${trust.toFixed(0)}</b><em class="sub">/100</em></div>
      </div>
      ${canFloat ? `<h3>Central bank</h3>
        <div class="opt"><div class="lbl">Independent central bank<small>${mon.independent ? 'It sets rates to hit ' + mon.target + '% inflation. Markets trust this.' : 'You set rates. Markets worry you will print money.'}</small></div>
          <div class="seg"><button data-mon="indep" class="${mon.independent ? 'on' : ''}">Independent</button><button data-mon="control" class="${mon.independent ? '' : 'on'}">You control it</button></div></div>
        ${mon.independent ? '' : `<div class="sl"><span class="lbl">Interest rate</span><input type="range" min="0" max="${Math.max(30, Math.ceil(mon.rate * 1.5))}" step="0.25" value="${mon.rate}" data-mon="rate"><span class="val">${pct(mon.rate, 2)}</span></div>`}
        <div class="sl"><span class="lbl">Print money</span><input type="range" min="0" max="20" step="0.5" value="${mon.qe}" data-mon="qe"><span class="val">${pct(mon.qe)}<small>of GDP a year</small></span></div>
        <div class="sub">Printed money pays for spending, but raises inflation${share > 0.05 ? '. Because the world holds ' + pct(share * 100, 0) + ' of its reserves in our currency, much of it is soaked up abroad' : ''}.</div>` : ''}
      <h3>Exchange rate</h3>
      <div class="btnrow">
        ${mon.type === 'peg' || canFloat ? '<button class="btn small" data-mon="dev10">Devalue 10%</button><button class="btn small" data-mon="dev25">Devalue 25%</button>' : ''}
        ${mon.type === 'peg' ? '<button class="btn small" data-mon="float">Let it float</button>' : ''}
        ${canFloat && mon.cur !== 'USD' ? '<button class="btn small" data-mon="pegUSD">Peg to US dollar</button>' : ''}
        ${canFloat && mon.cur !== 'EUR' && mon.cur !== 'USD' ? '<button class="btn small" data-mon="pegEUR">Peg to euro</button>' : ''}
      </div>
      ${mon.type === 'peg' ? `<div class="sub" style="margin-top:6px">Pressure on the peg: ${(mon.pressure * 100).toFixed(0)}%</div>` : ''}
      <h3>Debt</h3>
      <div class="kv">
        <div data-why="budget"><small>Debt</small><b>${pct(debtPct(n), 0)}</b><em class="sub">${usd(n.debt * n.fx / 100)}</em></div>
        <div data-why="yield"><small>New borrowing costs</small><b>${pct(n.yield, 2)}</b></div>
        <div><small>Average rate we pay</small><b>${pct(n.effRate, 2)}</b></div>
        <div><small>Credit rating</small><b>${RATINGS[clamp(n.rating, 0, 21)]}</b>${n.unrated ? '<em class="sub">est.</em>' : ''}</div>
        <div><small>Safe debt level</small><b>${pct(Math.max(n.base.debtPct, safeDebt(n)), 0)}</b><em class="sub">markets stay calm below this</em></div>
      </div>
      <div class="chart" id="ch-debt"></div>
      <div class="btnrow">
        ${(n.crisis || n.rating <= 7) && !(n.imf > 0) ? '<button class="btn small gold" data-mon="imf">Ask the IMF for a bailout</button>' : ''}
        ${n.debt > 0 && n.defaulted <= 0 ? '<button class="btn small" data-mon="default">Stop paying our debts (default)</button>' : ''}
      </div>
      <h3>World reserve currencies</h3>
      <div class="sub">Central banks around the world keep savings in currencies they trust. A top reserve currency can borrow cheaply and print with fewer consequences, as long as trust holds.</div>
      ${res}`;
    const h = n.hist.debt || []; drawChart($('#ch-debt', el), h, { fmt: v => pct(v, 0), label: histLabel(h) });
    $$('[data-mon]', el).forEach(b => {
      const k = b.dataset.mon;
      if (b.tagName === 'INPUT') { b.onchange = () => k === 'rate' ? Gov.setRate(+b.value) : Gov.setQE(+b.value); return; }
      b.onclick = () => {
        if (k === 'indep') Gov.setIndependent(true); else if (k === 'control') Gov.setIndependent(false);
        else if (k === 'dev10') Gov.devalue(10); else if (k === 'dev25') Gov.devalue(25); else if (k === 'float') Gov.floatCurrency();
        else if (k === 'pegUSD') Gov.pegCurrency('USD'); else if (k === 'pegEUR') Gov.pegCurrency('EUR'); else if (k === 'imf') Gov.imf();
        else if (k === 'default') UI.confirm('Stop paying our debts?', 'Lenders lose more than half of what they lent us. Our debt shrinks, but the currency crashes, the economy takes a big hit and nobody lends to us cheaply for years.', 'Default', () => Gov.default());
      };
    });
  },

  world(el) {
    const cols = [['gdp', 'GDP', n => gdpUsd(n), v => usd(v)], ['pc', 'Per person', n => gdpUsd(n) / n.pop, v => usd(v)], ['growth', 'Growth', n => n.growth, v => sgn(v) + '%'],
      ['infl', 'Inflation', n => n.infl, v => pct(v)], ['debt', 'Debt', n => debtPct(n), v => pct(v, 0)], ['pop', 'People', n => n.pop, v => fmtBig(v)]];
    this.sortBy = this.sortBy || 'gdp';
    const col = cols.find(c => c[0] === this.sortBy), list = G.nations.filter(Boolean).sort((a, b) => col[2](b) - col[2](a));
    const W = G.world;
    el.innerHTML = this.head('World', 'World economy ' + usd(W.worldGdp) + ' · oil price index ' + W.oil.toFixed(0) + ' · ' + (W.cycle < -0.6 ? 'slowdown' : W.cycle > 0.6 ? 'boom' : 'normal times')) +
      `<table class="rank"><thead><tr><th>#</th><th>Country</th>${cols.map(c => `<th data-sort="${c[0]}">${c[1]}${c[0] === this.sortBy ? ' ▼' : ''}</th>`).join('')}</tr></thead><tbody>
      ${list.map((n, i) => `<tr data-go="${n.idx}" class="${n.idx === G.player.idx ? 'me' : ''}"><td>${i + 1}</td><td>${World.countries[n.idx].flag} ${esc(World.countries[n.idx].name)}</td>${cols.map(c => `<td>${c[3](c[2](n))}</td>`).join('')}</tr>`).join('')}
      </tbody></table>` + (G.log.length ? '<h3>World news</h3>' + G.log.slice(0, 10).map(l => `<div class="mail"><div class="t">${esc(l.text)}</div><p>${fmtDate(l.day)}</p></div>`).join('') : '');
    $$('[data-sort]', el).forEach(t => t.onclick = () => { this.sortBy = t.dataset.sort; this.world(el); });
    $$('[data-go]', el).forEach(r => r.onclick = () => UI.select(+r.dataset.go, true));
  },

  mail(m) {
    const col = { report: '#6da7ec', bad: '#ef6b5b', crisis: '#ef6b5b', good: '#5fd38d', info: '#e2b65c' }[m.type] || '#999';
    return `<div class="mail${m.read ? '' : ' unread'}"><div class="t"><span class="dot" style="background:${col}"></span>${esc(m.title)}<span class="sub" style="margin-left:auto">${fmtDate(m.day)}</span></div><p>${esc(m.text)}</p></div>`;
  },
  inbox(el) {
    el.innerHTML = this.head('Inbox', 'Reports and messages') + (G.inbox.map(m => this.mail(m)).join('') || '<div class="sub">No messages yet.</div>');
    G.inbox.forEach(m => m.read = true); Game.refresh();
  }
};

// Country card on the map, with live numbers when a game is running
function nationFacts(c) {
  const n = nat(c);
  return [['Leader', n.title + ' ' + n.leader], ['Government', GOV[n.gov].name], ['Capital', c.capital || '-'], ['Population', fmtBig(n.pop)],
    ['GDP', usd(gdpUsd(n)) + ' (' + sgn(n.growth) + '%)'], ['Per person', usd(gdpUsd(n) / n.pop)], ['Inflation', pct(n.infl)], ['Debt', pct(debtPct(n), 0) + ' of GDP'],
    ['Military', fmtInt(n.mil) + ' troops' + (n.nukes ? ', nuclear' : '')], ['Blocs', n.blocs.join(', ') || '-'], ['Strengths', n.res.map(r => RES_NAMES[r]).join(', ')], ['Currency', c.curName ? c.curName + ' (' + c.cur + ')' : '-']];
}
