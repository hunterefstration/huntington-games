// Technology, Goals (victories and achievements), Help (how it works, glossary, every country), tutorial.
const GLOSSARY = [
  ['GDP', 'Everything a country produces in a year, in US dollars. Growth is how fast it gets bigger.'],
  ['Inflation', 'How fast prices rise. A little (2%) is normal. A lot makes people poorer and angry.'],
  ['Unemployment', 'The share of people who want a job but cannot find one.'],
  ['Budget deficit', 'When the government spends more than it collects in taxes. It borrows the difference, which adds to debt.'],
  ['Government debt', 'Everything the government owes. Measured against GDP: 100% means debt equals one year of the whole economy.'],
  ['Borrowing cost (yield)', 'The interest lenders charge for new loans to the government. It rises when debt looks risky.'],
  ['Credit rating', 'A grade from AAA (safest) to D (default) that tells lenders how risky you are.'],
  ['Central bank', 'Sets interest rates and can print money. Independent banks fight inflation; controlled ones do what the government wants.'],
  ['Interest rate', 'Higher rates cool inflation but slow growth. Lower rates do the opposite.'],
  ['Printing money', 'Paying for things with newly created money. Easy now, inflation later, unless the world holds your currency.'],
  ['Reserve currency', 'A currency central banks around the world keep their savings in. The issuer can borrow cheaply and print with fewer consequences, as long as trust lasts.'],
  ['Currency peg', 'Fixing your money to another currency. Brings calm prices but you lose control of interest rates, and speculators may attack.'],
  ['Devaluation', 'Making your money worth less. Exports get cheaper, imports dearer.'],
  ['Default', 'Refusing to pay your debts. Debt shrinks, but nobody lends to you cheaply for years.'],
  ['IMF bailout', 'Emergency loans from the International Monetary Fund, in return for spending cuts.'],
  ['Sanctions', 'Cutting business with a country to punish it. An embargo stops all trade.'],
  ['Tariffs', 'Taxes on imports. They protect local factories but raise prices.'],
  ['Approval', 'How much people like you: the average of every group, weighted by how many people are in it.'],
  ['Stability', 'How calm the country is. Low stability brings protests, riots and even revolution.'],
  ['Political capital', 'Your power to get things done. Earned over time (faster when popular), spent on laws, deals and campaigns.'],
  ['Freedom', 'How free speech, press, protest and elections are. Free countries are trusted more abroad.'],
  ['Polarisation', 'How split society is. High polarisation makes protests bigger and laws harder to pass.'],
  ['War score', 'Who is winning a war, from -100 to +100. It decides peace terms.'],
  ['War weariness', 'How tired people are of a war, from casualties, lost land and time.']
];
const HOW = [
  ['Growth', 'Long-term trend + infrastructure, research, education and health built over years − taxes − tariffs + borrowing (short term) − high interest rates + money printing − inflation above 10% − unrest − debt worries + world economy + oil prices + laws, technology, trade deals − sanctions − war + luck.'],
  ['Inflation', 'Expectations (60%) and last year\'s inflation (40%) + borrowing and printing (less if the world holds your currency) + an overheating economy − higher real interest rates + tariffs and sales tax + a falling currency + oil and food prices.'],
  ['Unemployment', 'Its normal level − how much faster the economy grows than its trend + generous welfare − better skills + income tax + debt crises.'],
  ['Approval', 'Each group: general mood (economy, services, taxes, honeymoon, time in office) + your ideology + laws + what they care about in the budget + recent reactions. Approval is the average weighted by group size.'],
  ['Stability', 'Starting point + approval + unemployment + inflation + police + welfare + debt crisis + laws + war + events.'],
  ['Borrowing cost', 'Central bank rate + long-term premium + rating + too much debt + instability − reserve currency status + past defaults.'],
  ['Relations', 'History, alliances and ideology + remembered events (fade over time) + treaties − sanctions and tariffs.'],
  ['War', 'Each side: √troops × √equipment × technology × morale, plus part of allies and foreign aid. Defenders get a bonus; attackers lose supply as they go deeper. The stronger side pushes the front and loses fewer soldiers (Lanchester\'s law).'],
  ['Deals', 'Chance they say yes = what they get + 0.4 × relations + 0.3 × trust + their personality + your diplomacy skill.']
];
Object.assign(Panels, {
  technology(el) {
    const n = me(), T0 = G.tech, cur = TECHS.find(t => t.id === T0.current);
    el.innerHTML = this.head('Technology', `${researchPoints(n).toFixed(1)} research points a month (science spending, education, tech deals) · ${T0.done.length}/${TECHS.length} done`) +
      (cur ? `<div class="forecast"><b>Researching: ${esc(cur.name)}</b><div style="height:8px;background:rgba(255,255,255,.08);border-radius:4px;margin-top:6px"><div style="height:100%;width:${Math.min(100, T0.progress / cur.cost * 100)}%;background:var(--gold);border-radius:4px"></div></div><div class="sub">${T0.progress.toFixed(0)} / ${cur.cost}</div></div>` : '') +
      TECH_BRANCHES.map(b => `<h3>${b}</h3>` + TECHS.filter(t => t.branch === b).map(t => {
        const done = techDone(t.id), avail = techAvailable(t), fx = Object.entries(t.fx).map(([k, v]) => ({ g: 'growth', a: 'approval', s: 'stability', i: 'inflation', u: 'unemployment', mil: 'army', e: 'pollution', t: 'research', x: 'prestige', pop: 'lifespan', c: 'corruption', trust: 'trust in money' })[k] + ' ' + (v > 0 ? '+' : '') + v).join(', ');
        return `<div class="sumrow" style="opacity:${done || avail ? 1 : 0.5}"><span><b>${esc(t.name)}</b> <span class="sub">${esc(t.desc)} (${fx})${!done && !avail ? ' · needs ' + t.needs.map(id => TECHS.find(x => x.id === id).name).join(' + ') : ''}</span></span>
          ${done ? '<b class="up">Done</b>' : avail ? `<button class="btn small${T0.current === t.id ? ' gold' : ''}" data-tech="${t.id}">${T0.current === t.id ? 'Researching' : t.cost + ' pts'}</button>` : ''}</div>`; }).join('')).join('');
    $$('[data-tech]', el).forEach(b => b.onclick = () => { if (G.tech.current !== b.dataset.tech) { G.tech.current = b.dataset.tech; G.tech.progress *= 0.5; } this.technology(el); });
  },
  goals(el) {
    const n = me(), got = G.ach || {}, life = Store.get('ach', {});
    el.innerHTML = this.head('Goals', `Legacy score so far: ${legacyScore(n).total} · ${Object.keys(got).length}/${ACH.length} achievements`) +
      '<h3>Victories</h3>' + VICTORIES.map(v => `<div class="sumrow"><span><b>${esc(v.name)}</b> <span class="sub">${esc(v.desc)}</span></span>${G.vicStart && G.vicStart[v.id] ? '<span class="sub">already true when you started</span>' : G.vic && G.vic[v.id] ? '<b class="up">Won</b>' : (G.vicRun && G.vicRun[v.id] ? `<span class="sub">${G.vicRun[v.id]}/${v.months} months</span>` : '')}</div>`).join('') +
      '<h3>Achievements</h3><div class="kv">' + ACH.map(a => `<div style="opacity:${got[a.id] ? 1 : 0.45};cursor:default" title="${esc(a.desc)}"><small>${got[a.id] ? '🏆 ' + fmtDate(got[a.id]) : life[a.id] ? 'won in another game' : 'locked'}</small><b style="font-size:13px">${esc(a.name)}</b><div class="sub">${esc(a.desc)}</div></div>`).join('') + '</div>';
  },
  help(el) {
    this.helpTab = this.helpTab || 'how';
    const tabs = [['how', 'How it works'], ['words', 'Words'], ['countries', 'Countries'], ['keys', 'Controls']];
    let body = '';
    if (this.helpTab === 'how') body = '<div class="note-box">Every number has causes. Click any number at the top, or in a panel, to see exactly what pushed it up or down this month. The real number moves toward that total over a few months.</div>' + HOW.map(([k, v]) => `<h3>${k}</h3><div style="font-size:13px">${esc(v)}</div>`).join('');
    else if (this.helpTab === 'words') body = GLOSSARY.map(([k, v]) => `<div class="sumrow" style="display:block"><b>${k}</b><div class="sub" style="font-size:13px">${esc(v)}</div></div>`).join('');
    else if (this.helpTab === 'countries') body = `<input id="enc-q" type="search" placeholder="Search..." style="width:100%;padding:7px 10px;border-radius:8px;border:1px solid var(--line);background:rgba(0,0,0,.3);margin:6px 0">` +
      '<div id="enc-list">' + World.countries.filter(Boolean).map(c => `<div class="sumrow" data-enc="${c.idx}" style="cursor:pointer"><span>${c.flag} ${esc(c.name)}</span><span class="sub">${esc(G.nations[c.idx].leader)}</span></div>`).join('') + '</div>';
    else body = `<div class="facts"><b>Drag</b><span>Move the map</span><b>Scroll / pinch</b><span>Zoom (down to street level)</span><b>Double click</b><span>Zoom in there</span><b>Space</b><span>Pause / play</span><b>1 to 5</b><span>Game speed</span><b>WASD / arrows</b><span>Move the map</span><b>Q / E</b><span>Zoom</span><b>N</b><span>Night view</span><b>Home</b><span>Back to your country</span><b>Esc</b><span>Close / menu</span></div>`;
    el.innerHTML = this.head('Help', 'How Sovereign works') + `<div class="tabs">${tabs.map(([k, v]) => `<button class="chip${k === this.helpTab ? ' on' : ''}" data-ht="${k}">${v}</button>`).join('')}</div>` + body;
    $$('[data-ht]', el).forEach(b => b.onclick = () => { this.helpTab = b.dataset.ht; this.help(el); });
    $$('[data-enc]', el).forEach(r => r.onclick = () => UI.select(+r.dataset.enc, true));
    const q = $('#enc-q', el); if (q) q.oninput = () => $$('[data-enc]', el).forEach(r => r.style.display = World.countries[+r.dataset.enc].name.toLowerCase().includes(q.value.toLowerCase()) ? '' : 'none');
  }
});
// ---- tutorial: short tips the first time you play
const TUTORIAL = [
  ['Welcome, leader', 'This is your country. Everything on the map is alive: cities, ships, planes, protests and wars. Drag to look around and scroll to zoom, all the way down to the streets.'],
  ['Time', 'Time is paused. Press Space or the play button to start. Speeds 1 to 5 change how fast days pass. Big events pause the game for you.'],
  ['Why?', 'The bar at the top shows your key numbers. Click any of them to see exactly what is pushing it up or down.'],
  ['Running the country', 'Use the menu on the left: Budget for taxes and spending, Money & Debt for the central bank, Laws for over 80 laws, Projects to build on the map.'],
  ['People react', 'Every decision gets a reaction: headlines, posts, protests or rallies. Check People and News to see who loves you and who does not.'],
  ['The world', 'Click any other country to see its leader and do diplomacy: deals, sanctions, alliances or war. Other countries act on their own too.'],
  ['Good luck', 'Stay in power, make your country better, and build a legacy. Help in the menu explains every formula and word.']
];
const Tutorial = {
  i: 0,
  start() { if (Store.get('tutorialDone', false)) return; this.i = 0; this.show(); },
  show() {
    let el = $('#tut'); if (!el) { el = document.createElement('div'); el.id = 'tut'; el.className = 'panel'; document.body.appendChild(el); }
    const [t, x] = TUTORIAL[this.i];
    el.innerHTML = `<div class="sub">Adviser · ${this.i + 1}/${TUTORIAL.length}</div><b>${t}</b><p style="margin:6px 0 10px;font-size:13px">${x}</p><div class="btnrow" style="margin:0;justify-content:flex-end"><button class="btn small" id="tut-skip">Skip</button><button class="btn small gold" id="tut-next">${this.i + 1 < TUTORIAL.length ? 'Next' : 'Start'}</button></div>`;
    $('#tut-next').onclick = () => { this.i++; if (this.i >= TUTORIAL.length) this.end(); else this.show(); };
    $('#tut-skip').onclick = () => this.end();
  },
  end() { const el = $('#tut'); if (el) el.remove(); Store.set('tutorialDone', true); }
};
