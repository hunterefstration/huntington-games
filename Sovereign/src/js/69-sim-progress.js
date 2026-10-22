// Progress: technology tree, achievements, victory goals, mediating other countries' wars, the people around you.
// Effects: g growth, a approval, s stability, i inflation, u unemployment, mil army equipment, e pollution, t research speed, x prestige
const TECH_BRANCHES = ['Economy', 'Military', 'Energy', 'Health', 'Space & AI'];
const TECHS = [];
function T(branch, id, name, cost, needs, fx, desc) { TECHS.push({ branch: TECH_BRANCHES[branch], id, name, cost, needs, fx, desc }); }
T(0, 'logistics', 'Smart logistics', 40, [], { g: 0.1 }, 'Faster, cheaper shipping.');
T(0, 'fintech', 'Digital payments', 50, [], { g: 0.08, c: -0.01 }, 'Less cash, less corruption.');
T(0, 'automation', 'Factory automation', 80, ['logistics'], { g: 0.2, u: 0.3 }, 'More output, fewer factory jobs.');
T(0, 'robotics', 'Service robots', 140, ['automation'], { g: 0.25, u: 0.4 }, 'Robots in shops and warehouses.');
T(0, 'aieco', 'AI economy', 220, ['robotics', 'ai'], { g: 0.5, u: 0.6 }, 'AI runs much of the economy. Huge growth, many jobs change.');
T(0, 'cbdc', 'Digital currency', 90, ['fintech'], { g: 0.05, trust: 3 }, 'A central bank digital currency. Others trust our money more.');
T(0, 'smartcity', 'Smart cities', 120, ['fintech'], { g: 0.1, a: 2 }, 'Traffic, power and water managed by sensors.');
T(0, 'labfood', 'Lab-grown food', 160, ['genetics'], { i: -0.3, e: -0.5 }, 'Cheaper food, fewer cows.');
T(0, 'hyperloop', 'Hyperloop trains', 200, ['smartcity'], { g: 0.15, x: 2 }, 'City to city in minutes.');
T(1, 'drones', 'Combat drones', 50, [], { mil: 0.06 }, 'Cheap and effective.');
T(1, 'cyberwar', 'Cyber warfare', 70, [], { mil: 0.03 }, 'Attack networks instead of cities.');
T(1, 'stealth', 'Stealth aircraft', 120, ['drones'], { mil: 0.08 }, 'Planes radar cannot see.');
T(1, 'missiledef', 'Missile defence', 140, ['cyberwar'], { mil: 0.06, s: 2 }, 'Shoot down missiles mid-air.');
T(1, 'hypersonic', 'Hypersonic missiles', 180, ['stealth'], { mil: 0.1 }, 'Faster than any defence.');
T(1, 'exo', 'Powered armour', 160, ['robotics'], { mil: 0.08 }, 'Soldiers carry ten times more.');
T(1, 'swarm', 'Drone swarms', 220, ['drones', 'ai'], { mil: 0.15 }, 'Thousands of drones acting as one.');
T(1, 'spaceshield', 'Space shield', 300, ['missiledef', 'rockets'], { mil: 0.12, s: 3 }, 'Satellites that stop attacks from orbit.');
T(2, 'solar', 'Cheap solar', 40, [], { e: -0.5, g: 0.05 }, 'Solar becomes the cheapest power.');
T(2, 'batteries', 'Grid batteries', 70, ['solar'], { e: -0.4, g: 0.05 }, 'Store sun and wind for the night.');
T(2, 'smr', 'Small nuclear reactors', 110, [], { e: -0.6, g: 0.08 }, 'Factory-built reactors.');
T(2, 'hydrogen', 'Green hydrogen', 130, ['batteries'], { e: -0.5, g: 0.05 }, 'Clean fuel for ships and steel.');
T(2, 'carboncap', 'Carbon capture', 150, ['hydrogen'], { e: -0.8 }, 'Pull CO2 out of the air.');
T(2, 'fusion', 'Fusion power', 320, ['smr', 'quantum'], { e: -2, g: 0.4, x: 5, i: -0.5 }, 'Almost limitless clean energy.');
T(3, 'telemed', 'Telemedicine', 40, [], { a: 1 }, 'See a doctor from your phone.');
T(3, 'mrna', 'mRNA vaccines', 70, [], { s: 1 }, 'New vaccines in weeks, not years.');
T(3, 'genetics', 'Gene therapy', 120, ['mrna'], { a: 2 }, 'Cure inherited diseases.');
T(3, 'cancer', 'Cancer cure', 200, ['genetics', 'ai'], { a: 4, x: 3 }, 'Most cancers become curable.');
T(3, 'longevity', 'Longevity drugs', 260, ['cancer'], { a: 3, pop: 0.2 }, 'People live 15 years longer. Pensions cost more.');
T(3, 'brainlink', 'Brain-computer links', 240, ['ai', 'genetics'], { g: 0.1, x: 2 }, 'Paralysed people walk again.');
T(4, 'satellites', 'Satellite internet', 50, [], { g: 0.05 }, 'Internet everywhere, even deserts.');
T(4, 'ai', 'Advanced AI', 100, [], { g: 0.15, t: 0.2 }, 'AI assistants for every worker and scientist.');
T(4, 'rockets', 'Reusable rockets', 120, ['satellites'], { x: 2 }, 'Space gets cheap.');
T(4, 'quantum', 'Quantum computers', 160, ['ai'], { t: 0.3 }, 'Solve problems no normal computer can.');
T(4, 'moonmine', 'Moon mining', 250, ['rockets'], { g: 0.1, x: 4 }, 'Rare metals from the Moon.');
T(4, 'mars', 'Mars colony', 400, ['moonmine', 'fusion'], { x: 12, a: 5 }, 'The first city on another planet.');
T(4, 'agi', 'General AI', 450, ['quantum', 'aieco'], { g: 0.8, u: 1, x: 8 }, 'An AI as smart as people. Nothing will be the same.');

function researchPoints(n) { // per month
  return (1 + n.k.know * 6 + n.k.human * 0.4) * (0.5 + n.dev) * (G.player.traits.includes('scholar') ? 1.3 : 1) * (1 + ((n.lawFx || {}).t || 0) * 0.1 + (n.techFx ? n.techFx.t || 0 : 0))
    + G.treaties.filter(x => x.type === 'tech' && (x.a === n.idx || x.b === n.idx)).length * 1.5;
}
function techDone(id) { return G.tech.done.includes(id); }
function techAvailable(t) { return !techDone(t.id) && t.needs.every(techDone); }
function applyTech(n) {
  const fx = {}; for (const id of G.tech.done) { const t = TECHS.find(x => x.id === id); for (const k in t.fx) fx[k] = (fx[k] || 0) + t.fx[k]; }
  n.techFx = fx;
  setMod(n, 'growth', 'Technology', fx.g || 0); setMod(n, 'approval', 'Technology', fx.a || 0); setMod(n, 'stability', 'Technology', fx.s || 0);
  setMod(n, 'infl', 'Technology', fx.i || 0); setMod(n, 'unemp', 'Technology', fx.u || 0);
  n.techLv = Math.max(n.techLv || 0, G.tech.done.length * 3);
}
function techMonth() {
  const n = G.nations[G.player.idx], T0 = G.tech;
  if (!T0.current || techDone(T0.current)) T0.current = (TECHS.find(techAvailable) || {}).id || null;
  if (!T0.current) return;
  T0.progress += researchPoints(n) + (n.techLv || 0) * 0.02;
  const t = TECHS.find(x => x.id === T0.current);
  if (T0.progress >= t.cost) {
    T0.progress -= t.cost; T0.done.push(t.id); T0.current = null;
    if (t.fx.mil) n.army.E *= 1 + t.fx.mil; if (t.fx.x) n.prestige = (n.prestige || 0) + t.fx.x; if (t.fx.pop) { n.popGrowth0 += t.fx.pop; n.popGrowth += t.fx.pop; }
    if (t.fx.trust && G.cur[n.mon.cur]) G.cur[n.mon.cur].trust0 -= t.fx.trust; // more trust than before
    applyTech(n);
    inbox('good', 'Breakthrough: ' + t.name, t.desc);
    react(n, { title: 'Scientists announce ' + t.name, stance: { students: 3, business: 2, ...(t.fx.u ? { workers: -3 } : {}) }, size: 0.8, mood: 0.2, topic: t.name.replace(/ /g, '') });
  }
  // everyone else researches too
  for (const m of G.nations) if (m && m.idx !== n.idx) m.techLv = (m.techLv || 0) + (0.05 + m.dev * 0.25) * (0.5 + m.spend.science);
}

// ---- achievements (kept for this game and across all games)
const ACH = [];
function A(id, name, desc, test) { ACH.push({ id, name, desc, test }); }
const P_ = () => G.nations[G.player.idx];
A('first_month', 'Day one', 'Survive your first month', n => n.months >= 1);
A('year1', 'One year in', 'Stay in office for a year', n => G.day >= 365);
A('year5', 'Five years', 'Stay in office for 5 years', n => G.day >= 365 * 5);
A('year10', 'A decade of power', 'Stay in office for 10 years', n => G.day >= 3650);
A('year20', 'Long reign', 'Stay in office for 20 years', n => G.day >= 7300);
A('appr60', 'Popular', 'Reach 60% approval', n => n.approval >= 60);
A('appr75', 'Beloved', 'Reach 75% approval', n => n.approval >= 75);
A('appr90', 'Living legend', 'Reach 90% approval', n => n.approval >= 90);
A('appr15', 'Rock bottom', 'Survive with approval under 15%', n => n.approval < 15);
A('stab90', 'Calm waters', 'Reach 90 stability', n => n.stability >= 90);
A('growth5', 'Tiger economy', 'Grow 5% in a year', n => n.growth >= 5);
A('growth8', 'Miracle', 'Grow 8% in a year', n => n.growth >= 8);
A('recession', 'It happens', 'Go through a recession', n => n.growth < 0);
A('infl1', 'Price stability', 'Inflation between 1% and 3% for a whole year', n => (n.hist.infl || []).slice(-12).length >= 12 && n.hist.infl.slice(-12).every(v => v >= 1 && v <= 3));
A('hyper', 'Wheelbarrows of cash', 'Let inflation pass 100%', n => n.infl > 100);
A('unemp3', 'Full employment', 'Unemployment under 3%', n => n.unemp < 3);
A('nodebt', 'Debt free', 'Pay off all government debt', n => n.debt <= 0);
A('debt200', 'Mountain of debt', 'Debt above 200% of GDP', n => debtPct(n) > 200);
A('surplus', 'In the black', 'Run a budget surplus', n => (n.budget || budgetOf(n)).deficit < 0);
A('aaa', 'Triple A', 'Get a AAA credit rating', n => n.rating >= 21);
A('junk', 'Junk', 'Fall to a CCC rating or worse', n => n.rating <= 4);
A('default', 'We are not paying', 'Default on your debt', n => n.defaulted > 0 && n.defaulted < 72 && G.day > 30);
A('imf', 'Bailed out', 'Take an IMF bailout', n => n.imf > 0);
A('reserve10', 'Exorbitant privilege', 'Make your currency 10% of world reserves', n => reserveShareOf(n) >= 0.1);
A('reserve1', 'King dollar', 'Have the world\'s top reserve currency', n => { const c = G.cur[n.mon.cur]; return c && Object.values(G.cur).every(o => o.share <= c.share); });
A('printer', 'Money printer go brrr', 'Print 10% of GDP a year', n => n.mon.qe >= 10);
A('peg', 'Locked in', 'Peg your currency', n => n.mon.type === 'peg' && World.nat0[n.idx].mon.type !== 'peg');
A('float', 'Free floating', 'Float a pegged currency', n => n.mon.type === 'float' && World.nat0[n.idx].mon.type === 'peg');
A('gdp1t', 'Trillion club', 'GDP over $1 trillion', n => gdpUsd(n) >= 1e12);
A('gdp10t', 'Superpower economy', 'GDP over $10 trillion', n => gdpUsd(n) >= 1e13);
A('gdpx2', 'Doubled', 'Double the size of your economy', n => n.real >= World.nat0[n.idx].real * 2);
A('rich', 'Rich country', 'GDP per person over $50,000', n => gdpUsd(n) / n.pop >= 5e4);
A('laws5', 'Reformer', 'Change 5 laws', n => Object.keys(n.laws).filter(k => n.laws[k] !== n.laws0[k]).length >= 5);
A('laws20', 'Revolution on paper', 'Change 20 laws', n => Object.keys(n.laws).filter(k => n.laws[k] !== n.laws0[k]).length >= 20);
A('const', 'New constitution', 'Change a constitutional law', n => LAWS.filter(l => l.cat === 'Constitution').some(l => n.laws[l.id] !== n.laws0[l.id]));
A('free90', 'Land of the free', 'Reach 90 freedom', n => n.freedom >= 90);
A('free10', 'Iron grip', 'Fall below 10 freedom', n => n.freedom < 10);
A('court', 'Above the law', 'Defy the Supreme Court', n => n.court && n.court.indep < 0.3 && World.nat0[n.idx].dem > 5);
A('proj1', 'Builder', 'Finish a big project', n => n.projects.some(p => p.done));
A('proj5', 'Master builder', 'Finish 5 big projects', n => n.projects.filter(p => p.done).length >= 5);
A('hsr', 'All aboard', 'Open a high-speed railway', n => n.projects.some(p => p.id === 'hsr' && p.done));
A('moon', 'Moonshot', 'Build a Moon base', n => n.projects.some(p => p.id === 'moon' && p.done));
A('olympics', 'Let the games begin', 'Host the Olympics', n => n.projects.some(p => p.id === 'olympics' && p.done));
A('newcap', 'New capital', 'Build a new capital city', n => n.projects.some(p => p.id === 'capital' && p.done));
A('elect1', 'Mandate', 'Win an election', n => G.player.terms >= 2 && !G.player.real || G.player.terms >= (REAL_TERMS[n.id] || 1) + 1);
A('elect3', 'Dynasty', 'Win three elections', n => G.player.terms >= 3 + (G.player.real ? (REAL_TERMS[n.id] || 1) - 1 : 0));
A('coupsurv', 'Still standing', 'Survive a coup attempt', n => (G.log || []).length && n.evStab > 4 && (G.inbox || []).some(m => m.title === 'The coup failed'));
A('rally', 'Crowd pleaser', 'Draw a rally of 800+ people', n => (n.crowds || []).some(c => c.kind === 'rally' && c.size >= 800));
A('protest', 'Under siege', 'Face a protest of 800+ people', n => (n.crowds || []).some(c => c.kind === 'protest' && c.size >= 800));
A('polar', 'Divided nation', 'Polarisation above 80', n => n.polar > 80);
A('unite', 'Unifier', 'Polarisation below 15', n => n.polar < 15);
A('allgroups', 'Everyone\'s friend', 'Every group above 50%', n => GROUPS.every(g => n.groups[g.id] > 50));
A('pc100', 'Political genius', 'Hold 100 political capital', n => n.pc >= 100);
A('friend80', 'Best friends', 'Relations of +80 with another country', n => G.nations.some(m => m && m.idx !== n.idx && relation(m.idx, n.idx) >= 80));
A('enemy', 'Public enemy', 'Relations of -90 with another country', n => G.nations.some(m => m && m.idx !== n.idx && relation(m.idx, n.idx) <= -90));
A('trade5', 'Free trader', 'Sign 5 free trade deals', n => G.treaties.filter(t => t.type === 'trade' && (t.a === n.idx || t.b === n.idx)).length >= 5);
A('pacts3', 'Alliance builder', 'Sign 3 defence pacts', n => G.treaties.filter(t => t.type === 'defence' && (t.a === n.idx || t.b === n.idx)).length >= 3);
A('sanction', 'Economic weapon', 'Sanction another country', n => G.sanctions.some(s => s.by === n.idx && s.since > 0));
A('embargo', 'Total embargo', 'Embargo a country', n => G.sanctions.some(s => s.by === n.idx && s.level >= 2 && s.since > 0));
A('sanctioned', 'Pariah', 'Be sanctioned by 10 countries', n => G.sanctions.filter(s => s.on === n.idx).length >= 10);
A('join', 'Joiner', 'Join an organisation', n => n.blocs.some(b => !World.nat0[n.idx].blocs.includes(b)));
A('leave', 'Going it alone', 'Leave an organisation', n => World.nat0[n.idx].blocs.some(b => !n.blocs.includes(b)));
A('un', 'Diplomat at the UN', 'Pass a UN resolution', n => (G.log || []).some(l => /^UN vote .* passed/.test(l.text)));
A('warwin', 'Victory', 'Win a war', n => (n.warsWon || 0) >= 1);
A('warlose', 'Defeat', 'Lose a war', n => (n.warsLost || 0) >= 1);
A('war3', 'Warlord', 'Win three wars', n => (n.warsWon || 0) >= 3);
A('defend', 'They shall not pass', 'Push an invader back over the border', n => G.wars.some(w => w.d.includes(n.idx) && w.fronts.some(f => f.b === n.idx && f.prog < -0.05)));
A('mobil', 'To arms', 'Mobilise the army', n => n.army && n.army.mobilized);
A('nuke', 'Doomsday', 'Use a nuclear weapon', n => (G.nuked || 0) > 0);
A('spy', 'Spymaster', 'Build a spy network to 80', n => Object.values(G.spy).some(v => v >= 80));
A('peace1', 'Peacemaker', 'Mediate an end to another country\'s war', n => (G.peaceMade || 0) >= 1);
A('peace5', 'Nobel material', 'Mediate 5 peace deals', n => (G.peaceMade || 0) >= 5);
A('tech5', 'Inventive', 'Research 5 technologies', n => G.tech.done.length >= 5);
A('tech15', 'Innovation nation', 'Research 15 technologies', n => G.tech.done.length >= 15);
A('fusiontech', 'Star in a jar', 'Research fusion power', n => techDone('fusion'));
A('agi', 'Singularity', 'Research general AI', n => techDone('agi'));
A('marstech', 'Red planet', 'Found a Mars colony', n => techDone('mars'));
A('prestige20', 'Soft power', 'Reach 20 prestige', n => (n.prestige || 0) >= 20);
A('green', 'Green leader', 'Environment spending above 1.5% of GDP', n => n.spend.environment >= 1.5);
A('hawk', 'Arsenal', 'Defence spending above 5% of GDP', n => n.spend.defence >= 5);
A('welfare', 'Cradle to grave', 'Health, education and welfare all above 8% of GDP', n => n.spend.health >= 8 && n.spend.education >= 8 && n.spend.welfare >= 8);
A('lowtax', 'Tax haven', 'Income tax under 10% with a balanced budget', n => n.tax.income < 10 && (n.budget || budgetOf(n)).deficit <= 0);
A('wealth', 'Tax the rich', 'Wealth tax of 2% or more', n => n.tax.wealth >= 2);
A('carbon', 'Polluter pays', 'Carbon tax of $100/t', n => n.tax.carbon >= 100);
A('event10', 'Crisis manager', 'Handle 10 events', n => (G.inbox || []).filter(m => m.text.startsWith('You chose:')).length >= 10);
A('quake', 'Shaken, not stirred', 'Lead through an earthquake', n => (G.inbox || []).some(m => /^Earthquake/.test(m.title)));
A('pandemic', 'Flatten the curve', 'Lead through a pandemic', n => (G.inbox || []).some(m => /virus/.test(m.title)));
A('cup', 'Champions!', 'Win the cup', n => (G.inbox || []).some(m => /wins the cup/.test(m.title)));
A('meme', 'Internet famous', 'Become a meme', n => (G.inbox || []).some(m => /meme/.test(m.title)));
A('alien', 'We are not alone?', 'Pick up a signal from space', n => (G.inbox || []).some(m => /signal from space/.test(m.title)));
A('tiny', 'Small but mighty', 'Survive 5 years as a country under 1 million people', n => n.pop < 1e6 && G.day >= 1825);
A('fragile', 'Against the odds', 'Survive 5 years in a 5-star country', n => difficultyOf(n.idx) >= 5 && G.day >= 1825);
A('happy', 'Happiest nation', 'Approval over 70 and stability over 80 at once', n => n.approval > 70 && n.stability > 80);
A('topgdp', 'Number one', 'Biggest economy in the world', n => G.nations.every(m => !m || gdpUsd(m) <= gdpUsd(n)));
A('top3', 'Great power', 'Top 3 economy in the world', n => G.nations.filter(m => m && gdpUsd(m) > gdpUsd(n)).length < 3);
A('topmil', 'Mightiest army', 'Strongest land army in the world', n => G.nations.every(m => !m || landPower(m) <= landPower(n)));
A('saved', 'Save point', 'Save your game', n => !!Saves.latest());
function achMonth() {
  const n = P_(); G.ach = G.ach || {};
  const life = Store.get('ach', {});
  for (const a of ACH) {
    if (G.ach[a.id]) continue;
    let ok = false; try { ok = a.test(n); } catch (e) {}
    if (ok) { G.ach[a.id] = G.day; life[a.id] = (life[a.id] || 0) + 1; toast('🏆 Achievement: ' + a.name, 3500); }
  }
  Store.set('ach', life);
  checkVictories(n);
}

// ---- victories: you can keep playing afterwards
const VICTORIES = [
  { id: 'econ', name: 'Economic Superpower', desc: 'Top 3 economy in the world for 2 years', test: n => G.nations.filter(m => m && gdpUsd(m) > gdpUsd(n)).length < 3, months: 24 },
  { id: 'reserve', name: 'Reserve Currency', desc: 'Your currency is the world\'s first or second reserve currency', test: n => { const c = G.cur[n.mon.cur]; return c && Object.values(G.cur).filter(o => o.share > c.share).length < 2 && c.share > 0.1; }, months: 12 },
  { id: 'peace', name: 'Peacemaker', desc: 'Mediate an end to 5 wars', test: () => (G.peaceMade || 0) >= 5, months: 0 },
  { id: 'power', name: 'World Power', desc: 'Strongest army and 10 defence pacts', test: n => G.nations.every(m => !m || landPower(m) <= landPower(n)) && G.treaties.filter(t => t.type === 'defence' && (t.a === n.idx || t.b === n.idx)).length >= 10, months: 6 },
  { id: 'science', name: 'Science', desc: 'Found a colony on Mars', test: () => techDone('mars'), months: 0 },
  { id: 'happy', name: 'Happiest Nation', desc: 'Approval over 70 and stability over 80 for a year', test: n => n.approval > 70 && n.stability > 80, months: 12 },
  { id: 'reign', name: 'Long Reign', desc: 'Stay in power for 20 years', test: () => G.day >= 7300, months: 0 }
];
function checkVictories(n) {
  G.vic = G.vic || {}; G.vicRun = G.vicRun || {};
  for (const v of VICTORIES) {
    if (G.vic[v.id] || (G.vicStart && G.vicStart[v.id])) continue;
    G.vicRun[v.id] = v.test(n) ? (G.vicRun[v.id] || 0) + 1 : 0;
    if (G.vicRun[v.id] >= Math.max(1, v.months)) {
      G.vic[v.id] = G.day; Clock.pause(); n.prestige = (n.prestige || 0) + 5;
      UI.modal(`<h2>🏆 Victory: ${esc(v.name)}</h2><p class="sub" style="font-size:15px">${esc(v.desc)}. History will remember this.</p><div class="actions"><button class="btn small" id="vic-end">Retire as a winner</button><button class="btn small gold" data-act="close-modal">Keep playing</button></div>`);
      $('#vic-end').onclick = () => { UI.closeModal(); endGame('victory', 'Victory: ' + v.name, `${G.player.title} ${G.player.name} retires in triumph.`); };
      return;
    }
  }
}
// ---- mediate other countries' wars
function mediate(w) {
  const me = G.player.idx, n = G.nations[me]; if (n.pc < 8) return 'Not enough political capital (8).';
  n.pc -= 8;
  const a = w.a[0], d = w.d[0], ch = clamp(0.25 + (relation(a, me) + relation(d, me)) / 300 + (w.weary[a] + w.weary[d]) / 300 + (n.prestige || 0) / 100 + (G.player.traits.includes('diplomat') ? 0.15 : 0), 0.05, 0.9);
  if (G.rng() < ch) { endWar(w, 'white', 'talks'); G.peaceMade = (G.peaceMade || 0) + 1; n.prestige = (n.prestige || 0) + 3; addRel(me, a, 10); addRel(me, d, 10); react(n, { title: 'Peace deal signed in our capital', stance: { media: 4 }, size: 1.5, mood: 0.6, abroad: 8 }); return 'Peace! Both sides signed.'; }
  addRel(me, a, -3); addRel(me, d, -3); return 'Talks collapsed (' + Math.round(ch * 100) + '% chance).';
}
// ---- the people around you
function makePeople(g) {
  const n = g.nations[g.player.idx], c = World.countries[n.idx], r = makeRng(g.seed + 21);
  const opp = n.parl.parties.filter(p => !p.gov).sort((a, b) => b.seats - a.seats)[0];
  return [
    { role: 'Opposition leader', name: personName(c, r), note: opp ? 'Leads ' + opp.name : 'Leads the opposition' },
    { role: 'Central bank governor', name: personName(c, r), note: n.mon.type === 'float' ? 'Runs the ' + n.mon.cur : 'Watches the ' + n.mon.anchor + ' peg' },
    { role: 'Army chief', name: personName(c, r), note: 'Loyalty follows the military\'s mood' },
    { role: 'Union boss', name: personName(c, r), note: 'Speaks for workers' },
    { role: 'Richest CEO', name: personName(c, r), note: 'Speaks for business' },
    { role: 'Top journalist', name: personName(c, r), note: 'Hosts the biggest news show' },
    { role: 'Religious leader', name: personName(c, r), note: 'Speaks for the faithful' },
    { role: 'Pop star', name: personName(c, r), note: 'Millions of young fans' },
    { role: 'Your spouse', name: personName(c, r), note: 'Your closest adviser' }
  ];
}
SYSTEM_INITS.push(g => {
  g.tech = g.tech || { done: [], current: null, progress: 0 }; g.ach = g.ach || {};
  if (!g.vicStart) { const G0 = G; G = g; g.vicStart = {}; for (const v of VICTORIES) { try { if (v.months && v.test(g.nations[g.player.idx])) g.vicStart[v.id] = true; } catch (e) {} } G = G0 || g; }
  if (!g.people) g.people = makePeople(g);
  const G0 = G; G = g; applyTech(g.nations[g.player.idx]); G = G0 || g;
});
MONTHLY.push(techMonth);
MONTHLY.push(achMonth);
