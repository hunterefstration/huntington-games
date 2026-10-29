    // ===================== UI: TABS & PANELS =====================
    function buildTabs() {
        let h = '';
        for (const t of TABS) h += `<button data-act="tab" data-arg="${t.id}" id="tab-${t.id}">${t.icon} ${t.name}<span class="dot"></span></button>`;
        $('tabs').innerHTML = h;
    }
    function setTab(t) {
        if (!TABS.some(x => x.id === t)) return;
        L.tab = t; dirty[t] = true;
        $('panels').scrollTop = 0;
        updateUI();
    }

    function bar(pct, cls, bind) { return `<div class="bar ${cls || ''}"><i ${bind ? `data-w="${bind}"` : ''} style="width:${clamp(pct, 0, 100).toFixed(1)}%"></i></div>`; }
    function chipList(list) { return list.map(([k, v]) => `<span class="chip ${v > 0 ? 'pos' : 'neg'}">${v > 0 ? '+' : ''}${v} ${esc(k)}</span>`).join(''); }
    // data-cost: disabled while cash < cost; data-cd: disabled until that day; data-lock="1": always disabled
    function btn(label, act, arg, o) {
        o = o || {};
        return `<button class="btn ${o.cls || ''}" data-act="${act}"${arg !== undefined && arg !== null ? ` data-arg="${arg}"` : ''}${o.cost ? ` data-cost="${Math.ceil(o.cost)}"` : ''}${o.cd ? ` data-cd="${o.cd}"` : ''}${o.lock ? ' data-lock="1" disabled' : ''}${o.title ? ` title="${esc(o.title)}"` : ''}>${label}${o.cd ? `<span data-b="cd:${o.cd}"></span>` : ''}</button>`;
    }

    const PANELS = {
        life: buildLife, career: buildCareer, school: buildSchool, market: buildMarket,
        home: buildHome, cars: buildCars, family: buildFamily, shop: buildShop, biz: buildBiz, stats: buildStats
    };

    function buildLife() {
        const R = L.rel, hf = [], pf = [];
        const ht = healthTarget(hf), pt = happyTarget(pf);
        const res = residence();
        const trait = TRAITS[L.trait];
        const status = [L.school ? 'Student' : '', L.job ? jobTitle() + (L.school ? ' (part-time)' : '') : (!L.school ? 'Unemployed' : '')].filter(Boolean).join(' · ');
        const inc = weeklyIncome() * 30 / 7;
        const bills = billLines(inc);
        let budget = `<div class="kv"><span>Income (≈${money(weeklyIncome())}/wk)</span><b class="ok">+${money(inc)}</b></div>`;
        for (const [k, v] of bills) budget += `<div class="kv"><span>${k}</span><b class="${v < 0 ? 'ok' : 'bad'}">${v < 0 ? '+' + money(-v) : '-' + money(v)}</b></div>`;
        const net = inc - sumLines(bills);
        budget += `<div class="kv total"><span>Left over each month</span><b class="${net >= 0 ? 'ok' : 'bad'}">${net >= 0 ? '+' : ''}${money(net)}</b></div>`;

        const tips = [];
        if (cash < 0) tips.push('⚠️ You are in debt! Cut costs or sell something before the bank does it for you.');
        if (L.school && L.school.id === 'hs') tips.push('🏫 Finish high school at 18. Hit STUDY to keep your GPA up (3.5+ = honors).');
        if (L.school && L.school.gpa < 2.3) tips.push('📉 Your GPA is dangerously low. Study, or you will repeat a year.');
        if (!L.job && L.age >= 16) tips.push('💼 Get a job in the Career tab.');
        if (L.age >= 18 && !L.school && L.degrees.length <= 1) tips.push('🎓 Enroll in college or trade school to unlock better careers (student loans available).');
        const blk = nextRankBlocked();
        if (blk && L.job.perf >= 100) tips.push(`🔒 Promotion blocked: you need ${reqText(blk)}.`);
        if (livingWithParents() && L.age >= 20) tips.push('🏢 Time to move out! Rent an apartment in the Home tab.');
        if (!L.car && L.age >= 18 && L.job) tips.push('🚗 A car ends the long bus commute (+happiness, +performance).');
        if (L.health < 40) tips.push('❤️ Your health is low. Try a Relaxed pace, a gym membership or a checkup.');
        if (L.happy < 40) tips.push('😊 Feeling down? Hang out with friends, take a vacation, or adopt a pet.');
        if (R.s === 'single' && L.age >= 18) tips.push('💕 Looking for love? Find a date in the Family tab.');
        if (!L.props.length && cash > homePrice('condo') * 0.25 && L.age >= 20) tips.push('🏠 You could afford a down payment on a home.');
        if (!hasBiz1 && cash >= BIZ1_INIT_COST) tips.push('🚀 You can found a startup in the Business tab.');
        if (!tips.length) tips.push('✅ Life is good. Keep investing, keep growing.');

        let story = '';
        for (const t of L.timeline.slice(-8).reverse()) story += `<div class="tl"><b>Age ${t[0]}</b><span>${t[1]} ${esc(t[2])}</span></div>`;
        const hall = loadHall();
        let hallH = '';
        hall.slice(0, 5).forEach((x, i) => { hallH += `<div class="kv"><span>${i + 1}. ${x.a || '🧑'} ${esc(x.n)} <span class="tiny">${esc(x.t)}, ${money(x.w)}</span></span><b>${num(x.s)}</b></div>`; });

        let h = `<div class="grid2">
            <div class="card"><div class="flex-row" style="justify-content:flex-start; gap:12px">
                <div class="big-emoji">${L.avatar}</div>
                <div style="min-width:0"><div class="h2">${esc(L.name)} <button class="btn gray" data-act="rename" title="Change your name" style="padding:2px 7px; font-size:0.7rem; vertical-align:middle">✏️</button></div>
                    <div class="muted tiny">Age ${L.age}${trait ? ` · ${trait.icon} ${trait.name}` : ''} · ${status}</div>
                    <div class="muted tiny"><span data-b="retire"></span></div></div></div>
                <div class="chips" style="margin-top:6px">
                    <span class="chip">${res.d.icon} ${res.d.name}${res.own ? ' (owned)' : ''}</span>
                    <span class="chip">${L.car ? CARS[L.car.id].icon + ' ' + CARS[L.car.id].name : '🚌 Bus'}</span>
                    <span class="chip">${R.p ? `💕 ${R.s === 'married' ? 'Married to' : R.s === 'engaged' ? 'Engaged to' : 'Dating'} ${esc(R.p.name)}` : '💔 Single'}</span>
                    ${R.kids.length ? `<span class="chip">👶 ${R.kids.length} kid${R.kids.length > 1 ? 's' : ''}</span>` : ''}
                    ${R.pets.length ? `<span class="chip">🐾 ${R.pets.length} pet${R.pets.length > 1 ? 's' : ''}</span>` : ''}
                    <span class="chip">🎓 ${L.degrees.length ? L.degrees.length + ' degree' + (L.degrees.length > 1 ? 's' : '') : 'No diploma yet'}</span>
                </div>
            </div>
            <div class="card"><div class="card-title">Next steps</div><div class="tips">${tips.slice(0, 4).map(t => `<div>${t}</div>`).join('')}</div></div>
        </div>
        <div class="grid2">
            <div class="card"><div class="card-title">❤️ Health <b><span data-b="health"></span> → ${ht}</b></div>${bar(L.health, 'love', 'health')}
                <div class="chips">${chipList(hf)}</div><div class="tiny muted" style="margin-top:4px">Health drifts toward ${ht}. Overtime, injuries and illness knock it down.</div></div>
            <div class="card"><div class="card-title">😊 Happiness <b><span data-b="happy"></span> → ${pt}</b></div>${bar(L.happy, 'amber', 'happy')}
                <div class="chips">${chipList(pf)}</div><div class="tiny muted" style="margin-top:4px">Happiness drifts toward ${pt}. Treats from the Shop give a temporary boost.</div></div>
        </div>
        <div class="card"><div class="card-title">Work-life balance <span class="muted">affects work and school</span></div><div class="style-pick">`;
        STYLES.forEach((s, i) => { h += `<button data-act="style" data-arg="${i}" class="${L.style === i ? 'on' : ''}"><b>${s.icon} ${s.name}</b><small>${s.desc}</small></button>`; });
        h += `</div></div>
        <div class="grid2">
            <div class="card"><div class="card-title">Monthly budget <span class="muted">bills every 30 days</span></div>${budget}</div>
            <div class="card"><div class="card-title">Life story</div>${story || '<div class="muted tiny">Your story starts now.</div>'}</div>
        </div>
        <div class="grid2">
            <div class="card"><div class="card-title">Hall of Lives <span class="muted">best Life Scores</span></div>${hallH || '<div class="muted tiny">Retire to put a life in the Hall.</div>'}
                <div class="kv total"><span>Personal bests</span><b data-b="pbs"></b></div></div>
            <div class="card"><div class="card-title">Retirement</div>
                <div class="tiny muted">You retire automatically at ${RETIRE_AGE}. Your final Life Score adds bonuses for wealth, career, education, family and wellbeing.</div>
                ${L.age >= EARLY_RETIRE_AGE ? btn('🏖️ Retire now', 'retire', null, { cls: 'amber' }) : `<div class="tiny gold" style="margin-top:6px">Early retirement unlocks at ${EARLY_RETIRE_AGE}.</div>`}
            </div>
        </div>`;
        return h;
    }

    function buildCareer() {
        const j = L.job;
        let h = '';
        if (j) {
            const C = CAREERS[j.c], rk = C.ranks[j.r], nx = C.ranks[j.r + 1];
            const blk = nextRankBlocked();
            h += `<div class="card" style="border-left:4px solid #8b5cf6">
                <div class="flex-row"><div><div class="h2">${C.icon} ${rk[0]}</div>
                    <div class="tiny muted">${C.name} · ${Math.floor(j.days / YEAR_DAYS)} yr in this career${C.benefits ? ' · 🩺 Health insurance' : ' · No benefits'}${L.school ? ' · Part-time while studying' : ''}</div></div>
                    <div style="text-align:right"><div class="h2 ok">${money(weeklyWage())}/wk</div><div class="tiny muted">${L.payBonus ? `+${Math.round(L.payBonus * 100)}% raises · ` : ''}${STYLES[L.style].name} pace${C.volatile ? ' · pay varies' : ''}</div></div></div>
                <div class="flex-row tiny" style="margin-top:6px"><span class="muted">Promotion progress</span><b data-b="perf"></b></div>
                ${bar(j.perf, '', 'perf')}
                <div class="tiny">${nx ? `Next: <b>${nx[0]}</b> (${money(nx[1] * (1 + L.payBonus))}/wk) · ${blk ? `<span class="bad">🔒 needs ${reqText(blk)}</span>` : '<span class="ok">✔ you qualify</span>'}` : '<span class="gold">👑 You are at the top of this career!</span>'}</div>
                <div class="tiny muted" style="margin-top:3px">Progress grows every day (faster when happy and on Hustle) and with each overtime shift.${C.endAge ? ` Pro athletes retire from sports at ${C.endAge}.` : ''}</div>
                <div class="row" style="display:flex; gap:6px; margin-top:8px; flex-wrap:wrap">
                    ${btn('🤝 Ask for a raise', 'raise', null, { cls: 'green', cd: L.cd.raise || 0 })}
                    ${btn('🚪 Quit job', 'quit', null, { cls: 'gray' })}
                </div>
                <div class="chips" style="margin-top:8px">${C.ranks.map((r, i) => `<span class="chip ${i === j.r ? 'cur' : i > j.r && !meets(r[2]) ? 'lock' : ''}" title="${esc(reqText(r[2]))}">${i > j.r && !meets(r[2]) ? '🔒 ' : ''}${r[0]} ${money(r[1])}</span>`).join('')}</div>
            </div>`;
        } else {
            h += `<div class="card" style="border-left:4px solid #ef4444"><div class="h2">${L.school ? '🎓 Full-time student' : '😶 Unemployed'}</div>
                <div class="tiny muted">${L.school ? 'You can still take a part-time job below (half pay).' : 'No salary coming in. Pick a job below. Jobs you qualify for are hired on the spot.'}</div></div>`;
        }
        h += `<div class="section-title">Job board <span class="muted">14 careers · requirements are for the entry job</span></div><div class="cards">`;
        for (const c in CAREERS) {
            const C = CAREERS[c], ok = canJoin(c), cur = j && j.c === c, top = C.ranks[C.ranks.length - 1];
            h += `<div class="item ${cur ? 'cur' : ok ? '' : 'locked'}">
                <div class="t">${C.icon} ${C.name}</div>
                <div class="s">${C.ranks[0][0]} ${money(C.ranks[0][1])}/wk → ${top[0]} ${money(top[1])}/wk</div>
                <div class="s">${C.benefits ? '🩺 Benefits · ' : ''}${C.sat > 4 ? '😊 Fulfilling' : C.sat < 0 ? '😐 Draining' : '🙂 Decent'}${C.danger ? ' · ⚠️ Risky' : ''}${C.volatile ? ' · 🎲 Pay varies' : ''}</div>
                <div class="s ${ok ? 'ok' : 'bad'}">${ok ? '✔ ' : '✖ '}${joinProblems(c)}</div>
                ${ok && !cur && startRank(c) > 0 ? `<div class="s gold">You would start as ${C.ranks[startRank(c)][0]} (${money(C.ranks[startRank(c)][1])}/wk)</div>` : ''}
                ${L.best[c] !== undefined && !cur ? `<div class="s gold">Best: ${C.ranks[Math.min(L.best[c], C.ranks.length - 1)][0]}</div>` : ''}
                <div class="row">${cur ? '<span class="chip cur">Your job</span>' : btn(L.best[c] !== undefined ? 'Rejoin' : 'Apply', 'apply', c, { cls: 'green', lock: !ok })}</div>
            </div>`;
        }
        return h + '</div>';
    }

    function buildSchool() {
        const s = L.school;
        let h = '';
        if (s) {
            const P = PROGRAMS[s.id];
            const yrs = s.years || P.years, yr = Math.min(yrs, Math.floor(s.d / YEAR_DAYS) + 1);
            h += `<div class="card" style="border-left:4px solid #0284c7">
                <div class="flex-row"><div><div class="h2">${P.icon} ${P.name}</div><div class="tiny muted">${P.school} · Year ${yr} of ${yrs}${s.transfer ? ' (transfer)' : ''}${s.rotc ? ' · ⭐ ROTC' : ''} · ${P.cost ? (s.loan ? 'Paid with student loans' : 'Paying cash') + ` (${money(P.cost)}/yr)` : P.stipend ? `Stipend ${money(P.stipend)}/wk` : 'Free'}</div></div>
                <div style="text-align:right"><div class="tiny muted">GPA</div><div class="h2 gold" data-b="gpa"></div></div></div>
                <div class="flex-row tiny" style="margin-top:6px"><span class="muted">Progress to graduation</span><b data-b="schoolLeft"></b></div>
                ${bar(s.d / s.total * 100, 'sky', 'school')}
                <div class="tiny muted">Graduate with a 3.5+ GPA for honors (+25% Life Score). Below 2.0 and you repeat the final year. Studying raises GPA; Hustle and unhappiness lower it.</div>
                <div class="progress-bg" style="height:14px"><div data-w="study" style="height:100%; width:0; background:linear-gradient(90deg,#0284c7,#38bdf8)"></div></div>
                <div class="row" style="display:flex; gap:6px; flex-wrap:wrap">${btn('📖 STUDY', 'study', null, { cls: 'sky' })}${s.id !== 'hs' ? btn('🚪 Drop out', 'dropout', null, { cls: 'gray' }) : ''}${P.lvl === 'bach' && P.school === 'University' && !s.rotc ? btn('⭐ Join ROTC (free tuition, serve as an officer)', 'rotc', null, { cls: 'green' }) : ''}</div>
            </div>`;
        }
        h += `<div class="grid2"><div class="card"><div class="card-title">Your degrees</div><div class="chips">${L.degrees.length ? L.degrees.map(d => `<span class="chip pos">${PROGRAMS[d].icon} ${PROGRAMS[d].name}${L.honors.includes(d) ? ' ⭐' : ''}</span>`).join('') : '<span class="muted tiny">None yet. Finish high school first!</span>'}</div></div>`;
        const l = L.loans.student;
        h += `<div class="card"><div class="card-title">Student loan</div>${l && l.bal > 0 ? `<div class="kv"><span>Balance</span><b class="bad">${money(l.bal)}</b></div><div class="kv"><span>Payment</span><b>${l.n > 0 ? `${money(l.pay)}/mo · ${l.n} left` : 'Paused while in school'}</b></div>${btn(`Pay off (${money(l.bal)})`, 'payStudent', null, { cls: 'green', cost: l.bal })}` : '<div class="tiny muted">No student debt. Loans let you study now and pay later (0.8%/mo over 40 months after you finish).</div>'}</div></div>`;
        for (const g of SCHOOL_GROUPS) {
            h += `<div class="section-title">${g}</div><div class="cards">`;
            if (g === 'Military') h += `<div class="tiny muted" style="margin:-4px 0 8px">Enlist after Basic Training, or become an officer: the Military Academy (a free Bachelor's), ROTC during any university Bachelor's, or Officer Training School after one. Three years of service earns the GI Bill: free tuition after that.${milYears() ? ` You have served ${milYears().toFixed(1)} years${giBill() ? ' - GI Bill earned!' : ''}.` : ''}</div>`;
            for (const id in PROGRAMS) {
                const P = PROGRAMS[id]; if (P.school !== g || P.hidden) continue;
                const has = L.degrees.includes(id), cur = s && s.id === id, ok = canEnroll(id);
                let why = '';
                if (!meets(P.req)) why = 'Needs ' + reqText(P.req);
                else if (P.minHealth && L.health < P.minHealth) why = `Needs health ${P.minHealth}+`;
                h += `<div class="item ${cur ? 'cur' : has ? '' : ok ? '' : 'locked'}">
                    <div class="t">${P.icon} ${P.name}</div>
                    <div class="s">${P.years} yr${P.years > 1 ? 's' : ''} · ${P.cost ? money(P.cost) + '/yr' : P.stipend ? `Paid ${money(P.stipend)}/wk stipend` : 'Free'} · +${P.score} Life Score</div>
                    <div class="s">Unlocks: ${P.unlocks.length ? P.unlocks.join(', ') : '—'}</div>
                    ${why ? `<div class="s bad">✖ ${why}</div>` : ''}
                    <div class="row">${has ? '<span class="chip pos">✔ Earned</span>' : cur ? '<span class="chip cur">Enrolled</span>' :
                        (P.cost ? btn(`Pay ${money(P.cost)}/yr`, 'enroll', id, { cls: 'green', cost: P.cost, lock: !ok }) + btn('Student loan', 'enrollLoan', id, { cls: 'sky', lock: !ok }) : btn('Enroll', 'enroll', id, { cls: 'green', lock: !ok }))}</div>
                </div>`;
            }
            h += '</div>';
        }
        return h;
    }

    // ===================== 2.0 UI: MARKET =====================
    const MK_VIEWS = [['stocks', '📈 Stocks'], ['crypto', '🪙 Crypto'], ['bank', '🏦 Bank & Bonds'], ['port', '💼 Portfolio']];
    const RANGES = [['14D', 14], ['60D', 60], ['120D', 120], ['Life', 0]];
    const SIZE_LBL = { 1: '1', 10: '10', 100: '100', 1000: '1K', 0: 'Max' };
    const PIE_COL = { Cash: '#10b981', Stocks: '#38bdf8', Crypto: '#facc15', Savings: '#a78bfa', Bonds: '#fb923c', Businesses: '#f472b6' };
    function plSpan(v, dec) { return `<span class="${v >= 0 ? 'up' : 'dn'}">${v >= 0 ? '+' : ''}${money(v, dec === undefined ? 2 : dec)}</span>`; }
    function volWord(v) { return v <= 0 ? 'Very low' : v < 0.02 ? 'Low' : v < 0.05 ? 'Medium' : v < 0.1 ? 'High' : 'Extreme'; }
    // polyline points for a price list (no allocation beyond the string); sets ptsOf.lo / ptsOf.hi
    function ptsOf(a, from, w, h) {
        let lo = Infinity, hi = -Infinity;
        for (let i = from; i < a.length; i++) { const v = a[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
        const n = a.length - from, dx = n > 1 ? w / (n - 1) : 0, span = hi - lo || 1;
        let out = '';
        for (let i = 0; i < n; i++) out += (i ? ' ' : '') + (i * dx).toFixed(1) + ',' + (h - 3 - (a[from + i] - lo) / span * (h - 6)).toFixed(1);
        ptsOf.lo = lo; ptsOf.hi = hi;
        return out;
    }
    function rangeSeries(s, r) { return r === 3 ? [s.hl, 0] : [s.h, Math.max(0, s.h.length - RANGES[r][1])]; }
    function selId() { return L.mkt.view === 'crypto' ? L.mkt.csel : L.mkt.sel; }
    function stockRow(s, sel) {
        const D = SDEF[s.id], S = SECTORS[D.sec] || SECTORS.tech;
        return `<div class="srow ${s.id === sel ? 'sel' : ''}" data-act="msel" data-arg="${s.id}" data-sid="${s.id}">
            <div class="nm"><b>${S.icon} ${esc(s.id)}</b><small>${esc(D.name)}</small></div>
            <svg class="spark" viewBox="0 0 70 24" preserveAspectRatio="none"><polyline fill="none" stroke="currentColor" stroke-width="1.5" points=""/></svg>
            <div class="px"><span class="p"></span><small class="c"></small></div><div class="own"></div>
            <div class="bs"><button class="btn green" data-act="buy" data-arg="${s.id}">Buy</button><button class="btn red" data-act="sell" data-arg="${s.id}">Sell</button></div></div>`;
    }
    function detailHtml(s) {
        const M = L.mkt, D = SDEF[s.id], S = SECTORS[D.sec] || SECTORS.tech, cr = isCrypto(s);
        let h = `<div class="item mk-detail" id="md"><div class="t">${S.icon} ${esc(D.name)} <span class="tiny muted">${esc(s.id)}</span></div>
            <div class="flex-row"><b id="md-px" style="font-size:1.3rem;font-family:monospace"></b><b id="md-chg"></b></div>
            <div class="s">${esc(D.d)}</div>
            <div class="seg">${RANGES.map((r, i) => `<button data-act="mrange" data-arg="${i}" class="${M.range === i ? 'on' : ''}">${r[0]}</button>`).join('')}</div>
            <svg class="chart" viewBox="0 0 300 120" preserveAspectRatio="none"><polygon id="md-fill" fill="currentColor" opacity="0.12" points=""/><polyline id="md-line" fill="none" stroke="currentColor" stroke-width="1.8" points=""/></svg>
            <div class="flex-row tiny muted"><span>Low <b id="md-lo"></b></span><span>High <b id="md-hi"></b></span></div>
            <div class="kpis" style="margin:6px 0 0"><div class="kpi"><small>You own</small><b id="md-own"></b></div><div class="kpi"><small>Profit / loss</small><b id="md-pl"></b></div></div>
            <div class="s">${S.name} · Volatility: ${volWord(D.v)} · ${D.y > 0 ? `Dividend ${D.y}%/mo` : 'No dividend'}${cr ? ` · ${CRYPTO_FEE * 100}% trading fee` : ''}</div>
            <div class="row"><button class="btn green" data-act="buy" data-arg="${s.id}" id="md-buy"></button><button class="btn red" data-act="sell" data-arg="${s.id}" id="md-sell"></button><button class="btn sky" data-act="order" data-arg="${s.id}">📝 Order</button></div>`;
        const os = M.orders.map((o, i) => [o, i]).filter(x => x[0].id === s.id);
        if (os.length) {
            h += '<div class="tiny muted" style="margin-top:6px">Open orders</div>';
            for (const [o, i] of os) h += `<div class="flex-row tiny"><span>${ORDER_TYPES[o.k].icon} ${ORDER_TYPES[o.k].name}: ${num(o.n)} @ ${px(o.px)}</span><button class="btn gray" data-act="cancelOrder" data-arg="${i}">Cancel</button></div>`;
        }
        return h + '</div>';
    }
    function buildMarket() {
        const M = L.mkt, R = REGIMES[M.reg], v = M.view;
        let h = `<div class="mk-head"><div class="subtabs">${MK_VIEWS.map(x => `<button data-act="mview" data-arg="${x[0]}" class="${v === x[0] ? 'on' : ''}">${x[1]}</button>`).join('')}</div>`;
        if (v === 'stocks' || v === 'crypto') h += `<div><span class="tiny muted">Trade size </span><div class="seg">${TRADE_SIZES.map(n => `<button data-act="qty" data-arg="${n}" class="${M.qty === n ? 'on' : ''}">${SIZE_LBL[n]}</button>`).join('')}</div></div>`;
        else h += `<div><span class="tiny muted">Amount </span><div class="seg">${BANK_AMTS.map(n => `<button data-act="bamt" data-arg="${n}" class="${M.amt === n ? 'on' : ''}">${n ? (n >= 1000 ? n / 1000 + 'K' : n) : 'All'}</button>`).join('')}</div></div>`;
        h += `</div><div class="mk-strip"><span class="chip">${R.icon} ${R.name}</span><span class="chip">Portfolio <b data-b="portfolio"></b></span><span class="chip">Bank rate ${L.bank.rate.toFixed(2)}%/mo</span><span class="chip">${M.orders.length}/${MAX_ORDERS} orders</span></div>`;
        if (M.news.length) {
            h += '<div class="ticker">';
            for (let i = 0; i < Math.min(5, M.news.length); i++) { const n = M.news[i]; h += `<div class="news"><b>Day ${n[0]}</b><span class="${n[3] > 0 ? 'up' : n[3] < 0 ? 'dn' : ''}">${n[1]} ${esc(n[2])}</span></div>`; }
            h += '</div>';
        }
        if (v === 'bank') return h + buildBank();
        if (v === 'port') return h + buildPort();
        const cr = v === 'crypto', sel = selId();
        let list = [indexStock, ...stocks].filter(s => (SDEF[s.id].sec === 'crypto') === cr);
        if (!cr) {
            h += `<div class="filters">${['all', ...Object.keys(SECTORS).filter(k => k !== 'crypto')].map(k => `<button data-act="mfilt" data-arg="${k}" class="${M.filt === k ? 'on' : ''}">${k === 'all' ? 'All' : SECTORS[k].icon + ' ' + SECTORS[k].name}</button>`).join('')}</div>`;
            if (M.filt !== 'all') list = list.filter(s => SDEF[s.id].sec === M.filt);
        } else h += '<div class="tiny muted" style="margin-bottom:8px">Crypto is wild: huge swings, a 1% fee on every trade, and a crash can wipe out half your coins.</div>';
        const cur = stockById(sel);
        h += '<div class="mk-wrap"><div class="mk-list">';
        for (const s of list) h += stockRow(s, sel);
        h += '</div>' + (cur ? detailHtml(cur) : '') + '</div>';
        return h;
    }
    let mkRefs = [], mkDay = -1, mkDet = null;
    function refreshMarket(el) {
        if (el._built !== true) {
            mkRefs = []; mkDay = -1; mkDet = null;
            for (const r of el.querySelectorAll('.srow')) {
                const s = stockById(r.dataset.sid);
                if (s) mkRefs.push({ s, r, p: r.querySelector('.p'), c: r.querySelector('.c'), o: r.querySelector('.own'), l: r.querySelector('polyline'), v: r.querySelector('.spark'), b: r.querySelector('[data-act="buy"]'), x: r.querySelector('[data-act="sell"]'), dn: null });
            }
            if ($('md')) mkDet = { s: stockById(selId()), px: $('md-px'), chg: $('md-chg'), line: $('md-line'), fill: $('md-fill'), lo: $('md-lo'), hi: $('md-hi'), own: $('md-own'), pl: $('md-pl'), b: $('md-buy'), x: $('md-sell') };
            el._built = true;
        }
        const newDay = mkDay !== day; mkDay = day;
        for (const q of mkRefs) {
            const s = q.s, dn = s.price < s.prevPrice;
            setText(q.p, px(s.price));
            setText(q.c, pctTxt(pct(s.price, s.prevPrice)));
            if (q.dn !== dn) { q.dn = dn; q.v.setAttribute('class', 'spark ' + (dn ? 'dn' : 'up')); q.c.className = 'c ' + (dn ? 'dn' : 'up'); }
            setText(q.o, s.owned ? `${num(s.owned)} · ${money(s.owned * s.price)}` : '');
            q.b.disabled = maxBuy(s) < 1; q.x.disabled = s.owned <= 0;
            if (newDay) q.l.setAttribute('points', ptsOf(s.h, Math.max(0, s.h.length - 30), 70, 24));
        }
        const d = mkDet;
        if (d && d.s) {
            const s = d.s, dn = s.price < s.prevPrice;
            setText(d.px, px(s.price));
            setText(d.chg, pctTxt(pct(s.price, s.prevPrice)));
            if (d.dn !== dn) { d.dn = dn; d.chg.className = dn ? 'dn' : 'up'; d.line.parentNode.style.color = dn ? '#f87171' : '#34d399'; }
            if (newDay) {
                const rs = rangeSeries(s, L.mkt.range), pts = ptsOf(rs[0], rs[1], 300, 120);
                d.line.setAttribute('points', pts); d.fill.setAttribute('points', pts + ' 300,120 0,120');
                setText(d.lo, px(ptsOf.lo)); setText(d.hi, px(ptsOf.hi));
            }
            setText(d.own, s.owned ? `${num(s.owned)} (${money(s.owned * s.price)})` : 'None');
            const pl = s.owned * s.price - (s.cost || 0);
            if (s.owned) { setText(d.pl, (pl >= 0 ? '+' : '') + money(pl, 2) + ` (${pctTxt(pct(s.owned * s.price, s.cost || 1)).slice(2)})`); d.pl.className = pl >= 0 ? 'up' : 'dn'; } else setText(d.pl, '—');
            const bn = tradeN(s, true), sn = tradeN(s, false);
            setText(d.b, `Buy ${bn >= 1 ? num(bn) : (L.mkt.qty || 1)}`); setText(d.x, `Sell ${sn >= 1 ? num(sn) : (L.mkt.qty || 1)}`);
            d.b.disabled = bn < 1; d.x.disabled = sn < 1;
        }
    }

    function buildBank() {
        const B = L.bank, M = L.mkt, amtTxt = M.amt ? money(M.amt) : 'all';
        let h = `<div class="kpis"><div class="kpi"><small>Savings</small><b>${money(B.sav, 2)}</b></div><div class="kpi"><small>Bonds</small><b>${money(bondValue())}</b></div>
            <div class="kpi"><small>Interest earned</small><b class="up">${money(B.int, 2)}</b></div><div class="kpi"><small>Central bank rate</small><b>${B.rate.toFixed(2)}%/mo</b></div></div>`;
        h += `<div class="cards"><div class="item"><div class="t">🐷 Savings account</div><div class="s">Pays ${savRate().toFixed(2)}% a month on the lowest balance you kept all month. Safe, flexible, and it covers your bills if you run out of cash.</div>
            <div class="row">${btn('Deposit ' + amtTxt, 'deposit', null, { cls: 'green', cost: 1 })}${btn('Withdraw ' + amtTxt, 'withdraw', null, { cls: 'amber', lock: B.sav < 1 })}</div></div>
            <div class="item"><div class="t">🤝 Charity</div><div class="s">Give ${amtTxt} away for Life Score (15% of the gift) and a happiness boost. You have given ${money(L.stats.charity)}.</div>
            <div class="row">${btn('Donate ' + amtTxt, 'donate', null, { cls: 'sky', cost: 10 })}</div></div></div>`;
        h += `<div class="section-title">Bonds <span>min ${money(BOND_MIN)} · ${B.bonds.length}/${MAX_BONDS} held · interest is paid every month, principal at the end</span></div><div class="cards">`;
        for (const k in BONDS) {
            const D = BONDS[k];
            h += `<div class="item"><div class="t">${D.icon} ${D.name}</div><div class="s" style="color:#38bdf8">${bondRate(k).toFixed(2)}%/mo · ${D.days / YEAR_DAYS} year${D.days > YEAR_DAYS ? 's' : ''}</div><div class="s">${D.desc}</div>
                <div class="row">${btn('Buy ' + amtTxt, 'bond', k, { cls: '', cost: BOND_MIN, lock: B.bonds.length >= MAX_BONDS })}</div></div>`;
        }
        h += '</div>';
        if (B.bonds.length) {
            h += '<div class="tbl-wrap"><table class="tbl"><tr><th>Bond</th><th>Amount</th><th>Rate</th><th>Matures</th><th>Paid</th><th></th></tr>';
            B.bonds.forEach((b, i) => { h += `<tr><td>${BONDS[b.k].icon} ${BONDS[b.k].name}</td><td>${money(b.amt)}</td><td>${b.rate.toFixed(2)}%</td><td>${Math.max(0, b.end - day)}d</td><td>${money(b.paid || 0, 2)}</td><td>${btn('Sell', 'sellBond', i, { cls: 'gray' })}</td></tr>`; });
            h += '</table></div>';
        }
        return h;
    }

    function buildPort() {
        const M = L.mkt, B = L.bank;
        const rows = [];
        let stV = 0, crV = 0, cost = 0;
        for (const s of [indexStock, ...stocks]) if (s.owned > 0) {
            const v = s.owned * s.price; rows.push([s, v]);
            if (isCrypto(s)) crV += v; else stV += v;
            cost += s.cost || 0;
        }
        rows.sort((a, b) => b[1] - a[1]);
        const unreal = stV + crV - cost, firms = firmsValue();
        const parts = [['Cash', Math.max(0, cash)], ['Stocks', stV], ['Crypto', crV], ['Savings', B.sav], ['Bonds', bondValue()], ['Businesses', firms]];
        const tot = parts.reduce((a, p) => a + p[1], 0) || 1;
        let h = `<div class="kpis"><div class="kpi"><small>Net worth</small><b>${money(netWorth())}</b></div><div class="kpi"><small>Invested (stocks + crypto)</small><b>${money(stV + crV)}</b></div>
            <div class="kpi"><small>Unrealized P/L</small><b>${plSpan(unreal, 0)}</b></div><div class="kpi"><small>Realized P/L</small><b>${plSpan(M.real, 0)}</b></div>
            <div class="kpi"><small>Dividends earned</small><b>${money(M.divs, 2)}</b></div><div class="kpi"><small>Crypto fees paid</small><b>${money(M.fees, 2)}</b></div></div>`;
        h += `<div class="section-title">Where your money is</div><div class="alloc">${parts.map(p => `<i style="width:${(p[1] / tot * 100).toFixed(2)}%;background:${PIE_COL[p[0]]}"></i>`).join('')}</div>
            <div class="legend">${parts.map(p => `<span style="--c:${PIE_COL[p[0]]}">${p[0]} ${money(p[1])} (${Math.round(p[1] / tot * 100)}%)</span>`).join('')}</div>`;
        h += '<div class="section-title" style="margin-top:12px">Holdings</div>';
        if (!rows.length) h += '<div class="tiny muted">You do not own any stocks or crypto yet. Pick something in the Stocks or Crypto view.</div>';
        else {
            h += '<div class="tbl-wrap"><table class="tbl"><tr><th>Asset</th><th>Qty</th><th>Avg cost</th><th>Price</th><th>Value</th><th>P/L</th><th>%</th></tr>';
            for (const [s, v] of rows) {
                const c = s.cost || 0, pl = v - c;
                h += `<tr><td><b>${esc(s.id)}</b> <span class="tiny muted">${esc(SDEF[s.id].name)}</span></td><td>${num(s.owned)}</td><td>${px(c / s.owned)}</td><td>${px(s.price)}</td><td>${money(v)}</td><td>${plSpan(pl, 0)}</td><td class="${pl >= 0 ? 'up' : 'dn'}">${c > 0 ? (pl >= 0 ? '+' : '') + (pl / c * 100).toFixed(1) + '%' : '—'}</td></tr>`;
            }
            h += '</table></div>';
        }
        h += `<div class="section-title" style="margin-top:12px">Open orders <span>${M.orders.length}/${MAX_ORDERS}</span></div>`;
        if (!M.orders.length) h += '<div class="tiny muted">No orders. Open a stock and press Order to buy low, take profit or set a stop loss.</div>';
        else {
            h += '<div class="tbl-wrap"><table class="tbl"><tr><th>Order</th><th>Asset</th><th>Qty</th><th>Trigger</th><th>Now</th><th></th></tr>';
            M.orders.forEach((o, i) => { const s = stockById(o.id); h += `<tr><td>${ORDER_TYPES[o.k].icon} ${ORDER_TYPES[o.k].name}</td><td>${esc(o.id)}</td><td>${num(o.n)}</td><td>${px(o.px)}</td><td>${s ? px(s.price) : ''}</td><td>${btn('Cancel', 'cancelOrder', i, { cls: 'gray' })}</td></tr>`; });
            h += '</table></div>';
        }
        return h;
    }

