    // ===================== 2.0 UI: BUSINESS =====================
    function buildBiz() {
        L.bizNew = false;
        const R = REGIMES[L.mkt.reg];
        let h = `<div class="section-title">Your businesses <span>${L.firms.length}/${MAX_FIRMS} · ${plural(staffCount(), 'employee')} · ${R.icon} ${R.name}</span></div>`;
        if (!L.firms.length) h += '<div class="tiny muted" style="margin-bottom:10px">You do not own a business yet. Pick one below. Hire staff to serve customers, advertise to get more of them, and read the monthly report.</div>';
        L.firms.forEach((f, i) => {
            const T = BIZ[f.t], r = firmCalc(f), m = f.mo, last = f.last, me = maxEmp(f);
            const starved = r.dem > r.cap * 1.02;
            h += `<div class="item firm"><div class="flex-row"><div class="t">${T.icon} ${esc(f.nm)} <span class="chip">LVL ${f.lvl}/${T.maxL}</span></div><span class="rep-pill">Reputation ${Math.round(f.rep)}</span></div>
                <div class="s">Expected: <b class="${r.net >= 0 ? 'up' : 'dn'}">${r.net >= 0 ? '+' : ''}${money(r.net)}/wk</b> · demand ${num(r.dem)} customers/wk, you can serve ${num(r.cap)}${starved ? ' <span class="dn">(customers are being turned away: hire staff!)</span>' : ''}${f.fx ? ` · <span class="gold">${f.fx.m > 1 ? 'Buzz' : 'Slump'} x${f.fx.m.toFixed(2)} (${f.fx.w}w)</span>` : ''}</div>
                <div class="s">This month so far: sales ${money(m.sales)} − wages ${money(m.wages + m.mgr)} − rent ${money(m.rent)} − ads ${money(m.mkt)} = <b>${money(m.net + m.extra)}</b> (${m.wks}/4 weeks)</div>`;
            if (last) {
                h += `<div class="tbl-wrap"><table class="tbl"><tr><th>Last monthly report</th><th>Sales</th><th>Wages</th><th>Manager</th><th>Rent</th><th>Ads</th><th>Profit</th><th>Customers</th></tr>
                    <tr><td>Month</td><td>${money(last.sales)}</td><td>${money(last.wages)}</td><td>${money(last.mgr)}</td><td>${money(last.rent)}</td><td>${money(last.mkt)}</td><td>${plSpan(last.net, 0)}</td><td>${num(last.cust)}</td></tr></table></div>`;
                if (f.hist.length > 1) {
                    const mx = Math.max(1, ...f.hist.map(Math.abs));
                    h += `<div class="bars" title="Profit of the last ${f.hist.length} months">${f.hist.map(v => `<i class="${v < 0 ? 'neg' : ''}" style="height:${Math.max(4, Math.abs(v) / mx * 100).toFixed(0)}%"></i>`).join('')}</div>`;
                }
            } else h += '<div class="tiny muted">The first monthly report arrives with your next bills.</div>';
            h += `<div class="ctl"><span class="lbl2">Staff</span><span class="stepper">${btn('−', 'fire', i, { cls: 'gray', lock: f.emp <= 0 })}<b>${f.emp}/${me}</b>${btn('+', 'hire', i, { cls: 'green', lock: f.emp >= me })}</span>
                <span class="lbl2">${money(T.wage)}/wk each</span>${btn(f.mgr ? 'Fire manager' : 'Hire manager (' + money(T.mgrW) + '/wk)', 'mgr', i, { cls: f.mgr ? 'gray' : 'sky' })}</div>
                <div class="ctl"><span class="lbl2">Marketing</span><span class="seg">${MKT_TIERS.map((t, k) => `<button data-act="mkt" data-arg="${i}:${k}" class="${f.mk === k ? 'on' : ''}" title="${k ? money(T.mkU * t.cost) + '/wk' : 'Free'}">${t.icon} ${t.name}</button>`).join('')}</span></div>
                <div class="row">${f.lvl < T.maxL ? btn('Upgrade (' + money(upgCost(f)) + ')', 'upgrade', i, { cls: 'amber', cost: upgCost(f) }) : '<span class="chip pos">Max level</span>'}${btn('Sell for ' + money(firmValue(f)), 'sellFirm', i, { cls: 'gray' })}</div></div>`;
        });
        h += '<div class="section-title">Start a business</div><div class="cards">';
        for (const t in BIZ) {
            if (L.firms.some(f => f.t === t)) continue;
            const T = BIZ[t], pr = firmProblems(t);
            h += `<div class="item"><div class="t">${T.icon} ${T.name}</div><div class="s" style="color:#38bdf8">${money(T.cost)} · up to ${me2(T)} staff</div><div class="s">${esc(T.desc)}</div>
                <div class="row">${pr.length ? `<span class="chip neg">Needs ${esc(pr.join(', '))}</span>` : btn('Open for ' + money(T.cost), 'startFirm', t, { cls: 'green', cost: T.cost, lock: L.firms.length >= MAX_FIRMS })}</div></div>`;
        }
        h += '</div><div class="section-title">Corporations <span>passive weekly profit that follows the economy</span></div><div class="cards">';
        h += `<div class="item"><div class="t">🚀 Startup Inc. ${hasBiz1 ? `<span class="chip">LVL ${biz1Level}</span>` : ''}</div><div class="s">${hasBiz1 ? 'Profit' : 'Cost ' + money(BIZ1_INIT_COST) + ' · profit'}: ${money(hasBiz1 ? biz1Profit() : BIZ1_INIT_PROFIT)}/wk (tech economy)</div>
            <div class="row">${btn(hasBiz1 ? 'Upgrade (' + money(Math.floor(1500 * Math.pow(1.5, biz1Level - 1))) + ')' : 'Found it (' + money(BIZ1_INIT_COST) + ')', 'biz1', null, { cls: 'amber', cost: hasBiz1 ? Math.floor(1500 * Math.pow(1.5, biz1Level - 1)) : BIZ1_INIT_COST })}</div></div>`;
        h += `<div class="item"><div class="t">🏢 Conglomerate Corp. ${hasBiz2 ? `<span class="chip">LVL ${biz2Level}</span>` : ''}</div><div class="s">${hasBiz2 ? 'Profit' : 'Cost ' + money(BIZ2_INIT_COST) + ' · profit'}: ${money(hasBiz2 ? biz2Profit() : BIZ2_INIT_PROFIT)}/wk (finance economy)</div>
            <div class="row">${btn(hasBiz2 ? 'Upgrade (' + money(Math.floor(10000 * Math.pow(1.6, biz2Level - 1))) + ')' : 'Found it (' + money(BIZ2_INIT_COST) + ')', 'biz2', null, { cls: 'amber', cost: hasBiz2 ? Math.floor(10000 * Math.pow(1.6, biz2Level - 1)) : BIZ2_INIT_COST })}</div></div></div>`;
        return h;
    }
    function me2(T) { return Math.round(T.per * 1.6); }

    // ===================== 2.0 UI: STATS & ACHIEVEMENTS =====================
    function buildStats() {
        L.achNew = false;
        const S = L.stats, M = L.mkt, B = L.bank;
        const got = ACH.filter(a => L.ach[a.id]).length;
        const k = (l, v) => `<div class="kpi"><small>${l}</small><b>${v}</b></div>`;
        let h = `<div class="section-title">Your life in numbers</div><div class="kpis">
            ${k('Age', L.age)}${k('Days lived', num(day))}${k('Net worth', money(netWorth()))}${k('Peak net worth', money(S.peakNw))}${k('Total earned', money(S.earned))}
            ${k('Trading profit (sold)', plSpan(M.real, 0))}${k('Best single trade', money(M.best))}${k('Trades made', num(M.buys + M.sells))}${k('Dividends', money(M.divs, 2))}${k('Interest', money(B.int, 2))}
            ${k('Orders filled', M.fills)}${k('Market crashes seen', M.crashes)}${k('Businesses started', S.firms)}${k('Best business month', money(S.bestMonth))}${k('Given to charity', money(S.charity))}
            ${k('Promotions', S.promos)}${k('Life events', S.events)}${k('Average happiness', S.hapDays ? Math.round(S.hapSum / S.hapDays) : '—')}</div>`;
        if (S.nwHist.length > 1) {
            const mx = Math.max(1, ...S.nwHist.map(Math.abs));
            h += `<div class="section-title">Net worth by month</div><div class="bars">${S.nwHist.map(v => `<i class="${v < 0 ? 'neg' : ''}" style="height:${Math.max(3, Math.abs(v) / mx * 100).toFixed(0)}%"></i>`).join('')}</div><div style="height:10px"></div>`;
        }
        h += `<div class="section-title">Achievements <span>${got}/${ACH.length} unlocked</span></div><div class="ach">`;
        for (const a of ACH) {
            const on = !!L.ach[a.id];
            h += `<div class="a ${on ? 'got' : 'no'}"><div class="i">${a.icon}</div><div><b>${esc(a.name)}</b><small>${esc(a.desc)}</small><small>${on ? '✅ Day ' + L.ach[a.id] : '+' + num(a.pts) + ' Life Score'}</small></div></div>`;
        }
        return h + '</div>';
    }
    function checkAch() {
        if (!L || L.phase !== 'play') return;
        let nw = 0; try { nw = netWorth(); } catch (e) { }
        for (const a of ACH) {
            if (L.ach[a.id]) continue;
            let ok = false;
            try { ok = !!a.test(nw); } catch (e) { ok = false; }
            if (!ok) continue;
            L.ach[a.id] = day || 1; addScore(a.pts); L.achNew = true; dirty.stats = true;
            toast(`🏆 ${a.name}: +${num(a.pts)} Life Score`, 'ach');
            logMessage(`🏆 Achievement: ${a.name} (+${num(a.pts)} Life Score)`, 'boost-alert');
        }
    }
    function dailyStats() {
        const nw = netWorth(), S = L.stats;
        if (nw > S.peakNw) S.peakNw = nw;
        if (day % 30 === 0) { S.nwHist.push(Math.round(nw)); if (S.nwHist.length > 80) S.nwHist.shift(); dirty.stats = true; }
    }
    function showWhatsNew() {
        openModal(`<div class="ev-icon">✨</div><h2>What's new in Market & Life 2.1</h2><ul class="whats">
            <li>🪖 <b>The military</b>: enlist after Basic Training, or become an officer through the Military Academy, ROTC or Officer Training School. Deployments, medals, and the GI Bill (free tuition after 3 years of service).</li>
            <li>🎓 <b>Bigger college</b>: community college credits transfer (a Bachelor's in 2 years), ROTC during any Bachelor's, an offer to stay for a master's when you graduate, and two new master's degrees.</li>
            <li>🎲 <b>14 new things that can happen</b>: study abroad, internships, jury duty, identity theft, surprise bonuses, a taco truck and more.</li>
            <li style="margin-top:8px;color:var(--muted)">2.0:</li>
            <li>📈 <b>42 stocks, funds and coins</b> in 6 sectors, with a price chart, history ranges and a mini chart for every one.</li>
            <li>📰 <b>Market news</b>: sector and company headlines, bull and bear markets, and the odd crash.</li>
            <li>💵 <b>Dividends</b> paid every month on stocks that pay them.</li>
            <li>🪙 <b>Volatile crypto</b> with a 1% fee: huge pumps, huge dumps.</li>
            <li>🎯 <b>Limit orders</b>: limit buy, take profit and stop loss that fill by themselves.</li>
            <li>💼 <b>Portfolio screen</b> with profit and loss, allocation and open orders.</li>
            <li>🏦 <b>Savings and bonds</b> that earn monthly interest; rates change every year.</li>
            <li>🏪 <b>10 business types</b> with employees, managers, upgrades, marketing and monthly reports.</li>
            <li>🏆 <b>${ACH.length} achievements</b> and a Stats page.</li>
            <li>🎓 Life Mode: school, careers, homes, cars, family, health, events and retirement.</li></ul>
            <button class="btn big" data-act="modalOk">Nice!</button>`, true);
    }

    function buildHome() {
        const res = residence(), R = L.rel;
        const need = roomsNeeded();
        let h = `<div class="card" style="border-left:4px solid #10b981"><div class="flex-row"><div><div class="h2">${res.d.icon} ${res.d.name}</div>
            <div class="tiny muted">${res.own ? 'You own this home' : res.d.rent ? `Renting for ${money(res.d.rent)}/mo` : 'Living rent-free with Mom and Dad'} · ${res.d.rooms} bedroom${res.d.rooms > 1 ? 's' : ''} (you need ${need})${crowded() ? ' · <span class="bad">Crowded!</span>' : ''}</div></div>
            <div style="text-align:right"><div class="tiny muted">Housing market</div><div class="h2 ${L.hTrend >= 0 ? 'ok' : 'bad'}">${L.hTrend >= 0 ? '▲' : '▼'} ${Math.abs(L.hTrend * 100).toFixed(1)}%</div><div class="tiny muted">prices ×${L.hIdx.toFixed(2)}</div></div></div>
            ${L.age < 18 ? '<div class="tiny gold" style="margin-top:4px">You can rent at any age, but you must be 18 to buy a home.</div>' : ''}</div>`;
        if (L.props.length) {
            h += `<div class="section-title">My properties <span class="muted">homes you do not live in are rented out</span></div><div class="cards">`;
            L.props.forEach((p, i) => {
                const H = HOMES[p.id], eq = p.value - (p.loan ? p.loan.bal : 0);
                h += `<div class="item ${p.live ? 'cur' : ''}"><div class="t">${H.icon} ${H.name}</div>
                    <div class="s">Value ${money(p.value)} · Equity <b class="ok">${money(eq)}</b></div>
                    <div class="s">${p.loan ? `Mortgage ${money(p.loan.bal)} · ${money(p.loan.pay)}/mo · ${p.loan.n} left` : 'No mortgage 🎉'}</div>
                    <div class="s">${p.live ? '🏠 You live here' : `💵 Rented out: +${money(rentIncome(p))}/mo`} · upkeep ${money(p.value * 0.003)}/mo</div>
                    <div class="row">${p.live ? '' : btn('Move in', 'moveIn', i, { cls: 'sky' })}${p.loan ? btn('Pay off', 'payMortgage', i, { cls: 'green', cost: p.loan.bal }) : ''}${btn('Sell', 'sellProp', i, { cls: 'red' })}</div></div>`;
            });
            h += '</div>';
        }
        h += `<div class="section-title">Rent <span class="muted">moving in costs one month's rent as a deposit</span></div><div class="cards">`;
        for (const id in RENTALS) {
            const X = RENTALS[id], cur = !res.own && L.rent === id;
            h += `<div class="item ${cur ? 'cur' : ''}"><div class="t">${X.icon} ${X.name}</div>
                <div class="s">${X.rent ? money(X.rent) + '/mo' : 'Free'} · ${X.rooms} bedroom${X.rooms > 1 ? 's' : ''} · ${id === 'parents' ? (L.age < 21 ? '+3' : '-6') : (X.hap >= 0 ? '+' : '') + X.hap} happiness</div>
                <div class="s">${X.desc}</div>
                <div class="row">${cur ? '<span class="chip cur">You live here</span>' : btn(X.rent ? `Move in (${money(X.rent)})` : 'Move back', 'rent', id, { cls: 'sky', cost: X.rent })}</div></div>`;
        }
        h += `</div><div class="section-title">Homes for sale <span class="muted">mortgage: ${MORTGAGE.down * 100}% down, ${MORTGAGE.rate * 100}%/mo, ${MORTGAGE.n} payments</span></div><div class="cards">`;
        for (const id in HOMES) {
            const H = HOMES[id], price = homePrice(id), down = Math.round(price * MORTGAGE.down), pay = loanPayment(price - down, MORTGAGE.rate, MORTGAGE.n);
            const lock = L.age < 18 || L.props.length >= MAX_PROPS;
            h += `<div class="item"><div class="t">${H.icon} ${H.name}</div>
                <div class="s">${money(price)} · ${H.rooms} bedrooms · +${H.hap} happiness</div>
                <div class="s">${L.ownedTypes[id] ? 'Owned before' : `+${num(H.score)} Life Score`} · Mortgage ${money(pay)}/mo · Rents for ${money(price * 0.007)}/mo</div>
                <div class="row">${btn(`Buy ${money(price)}`, 'buyHome', id, { cls: 'green', cost: price, lock })}${btn(`${money(down)} down`, 'mortgage', id, { cls: 'sky', cost: down, lock })}</div></div>`;
        }
        return h + '</div>';
    }

    function buildCars() {
        const c = L.car;
        let h = '';
        if (c) {
            const C = CARS[c.id];
            h += `<div class="card" style="border-left:4px solid #f59e0b"><div class="flex-row"><div><div class="h2">${C.icon} ${C.name}</div>
                <div class="tiny muted">Worth ${money(carValue())}${c.loan ? ` · Loan ${money(c.loan.bal)} (${money(c.loan.pay)}/mo, ${c.loan.n} left)` : ''} · Upkeep ${money(C.upkeep)}/mo · +${C.hap} happiness${C.perk ? ' · ' + C.perk : ''}</div></div></div>
                <div class="flex-row tiny" style="margin-top:6px"><span class="muted">Condition</span><b data-b="carCond"></b></div>${bar(c.cond, 'amber', 'carCond')}
                <div class="tiny muted">Cars wear down every day. Low condition means breakdowns and unhappiness. They also lose 12% of value each year.</div>
                <div class="row" style="display:flex; gap:6px; margin-top:8px; flex-wrap:wrap">${btn(`🔧 Service (${money(repairCost())})`, 'service', null, { cls: 'amber', cost: repairCost(), lock: c.cond > 97 })}${c.loan ? btn(`Pay off loan (${money(c.loan.bal)})`, 'payCar', null, { cls: 'green', cost: c.loan.bal }) : ''}${btn(`Sell (${money(carEquity())})`, 'sellCar', null, { cls: 'red' })}</div></div>`;
        } else {
            h += `<div class="card" style="border-left:4px solid #64748b"><div class="h2">🚌 Taking the bus</div><div class="tiny muted">Bus pass ${money(30)}/mo. Once you are 18, the long commute costs -4 happiness and -10% work performance.</div></div>`;
        }
        h += `<div class="section-title">Dealership <span class="muted">financing: ${CAR_LOAN.down * 100}% down, ${CAR_LOAN.rate * 100}%/mo, ${CAR_LOAN.n} payments${c ? ' · your car is traded in' : ''}</span></div><div class="cards">`;
        const trade = carEquity();
        for (const id in CARS) {
            const C = CARS[id], net = C.price - trade, down = Math.max(0, Math.round(net * CAR_LOAN.down));
            const cur = c && c.id === id;
            const lock = L.age < 16 || (cur && c.cond > 60);
            h += `<div class="item ${cur ? 'cur' : ''}"><div class="t">${C.icon} ${C.name}</div>
                <div class="s">${money(C.price)}${c ? ` · after trade-in ${money(net)}` : ''} · upkeep ${money(C.upkeep)}/mo · +${C.hap} happiness</div>
                <div class="s">${C.perk || 'Gets you to work on time'}${L.carTypes[id] ? '' : ` · +${num(C.score)} Life Score`}</div>
                <div class="row">${btn(net > 0 ? `Buy ${money(net)}` : `Swap (+${money(-net)})`, 'buyCar', id, { cls: 'green', cost: Math.max(0, net), lock })}${net > 0 ? btn(`Finance ${money(down)} down`, 'financeCar', id, { cls: 'sky', cost: down, lock }) : ''}</div></div>`;
        }
        return h + '</div>';
    }

    function buildFamily() {
        const R = L.rel, p = R.p;
        let h = '<div class="grid2">';
        if (p) {
            const st = R.s === 'married' ? 'Married' : R.s === 'engaged' ? 'Engaged' : 'Dating';
            h += `<div class="card" style="border-left:4px solid #db2777"><div class="flex-row"><div><div class="h2">💕 ${esc(p.name)}</div><div class="tiny muted">${st} · ${p.job} (${money(p.pay)}/wk${R.s === 'married' ? ', added to your weekly pay' : ''})</div></div></div>
                <div class="flex-row tiny" style="margin-top:6px"><span class="muted">Love</span><b data-b="love"></b></div>${bar(p.love, 'love', 'love')}
                <div class="tiny muted">Love fades slowly (faster on Hustle). Below 30 means trouble.</div>
                <div class="row" style="display:flex; gap:6px; margin-top:8px; flex-wrap:wrap">
                    ${btn('🍝 Date night $80', 'dateNight', null, { cls: 'pink', cost: 80, cd: L.cd.date || 0 })}
                    ${btn('🎁 Gift $150', 'shop', 'gift', { cls: 'pink', cost: 150 })}
                    ${R.s === 'dating' ? btn('💍 Propose ($1,500 ring)', 'propose', null, { cls: 'amber', cost: 1500, lock: L.age < 18 }) : ''}
                    ${R.s === 'engaged' ? btn('💒 Small wedding $2,000', 'wedding', 0, { cls: 'amber', cost: 2000 }) + btn('💒 Dream wedding $8,000', 'wedding', 1, { cls: 'amber', cost: 8000 }) : ''}
                    ${R.s !== 'dating' ? btn('🍼 Try for a baby', 'baby', null, { cls: 'sky', cd: L.cd.baby || 0, lock: !canHaveBaby(), title: livingWithParents() ? 'Move out of your parents\' house first' : '' }) : ''}
                    ${R.s === 'married' ? btn('🧸 Adopt $3,000', 'adoptKid', null, { cls: 'sky', cost: 3000, cd: L.cd.adopt || 0, lock: L.age < 25 || L.age > 55 || livingWithParents() || R.kids.length >= 6 }) : ''}
                    ${btn(R.s === 'married' ? 'Divorce' : 'Break up', 'breakUp', null, { cls: 'gray' })}
                </div>
                ${R.s !== 'dating' && livingWithParents() ? '<div class="tiny gold" style="margin-top:4px">Move out of your parents\' house to start a family.</div>' : ''}</div>`;
        } else {
            h += `<div class="card" style="border-left:4px solid #64748b"><div class="h2">💔 Single</div><div class="tiny muted">Your odds are better when you are happy${L.trait === 'charming' ? ' (and charming)' : ''}, own a home or drive a nice car.</div>
                <div class="row" style="display:flex; gap:6px; margin-top:8px">${btn('💕 Find a date ($40)', 'findDate', null, { cls: 'pink', cost: 40, cd: L.cd.findDate || 0 })}</div></div>`;
        }
        h += `<div class="card"><div class="card-title">👪 Mom & Dad <b data-b="parents"></b></div>${bar(R.parents, 'sky', 'parents')}
            <div class="row" style="display:flex; gap:6px; margin-top:6px; flex-wrap:wrap">${btn('☕ Visit', 'visitParents', null, { cls: 'sky', cd: L.cd.visit || 0 })}${L.age < 30 ? btn('💵 Ask for help', 'askParents', null, { cls: 'gray', cd: L.cd.askParents || 0, lock: R.parents < 40 }) : ''}</div>
            <div class="card-title" style="margin-top:10px">🤝 Friends <b>${R.friends}</b></div>
            <div class="row" style="display:flex; gap:6px; flex-wrap:wrap">${btn('🍔 Hang out $30', 'hangOut', null, { cls: 'sky', cost: 30, cd: L.cd.hang || 0 })}${btn('🎉 Throw a party $300', 'party', null, { cls: 'amber', cost: 300, cd: L.cd.party || 0 })}</div></div>`;
        h += '</div>';
        h += `<div class="section-title">Kids <span class="muted">$80/mo each until they leave for college at 18</span></div>`;
        if (R.kids.length) {
            h += '<div class="cards">';
            R.kids.forEach((k, i) => {
                h += `<div class="item"><div class="t">${k.grown ? '🎓' : k.age < 4 ? '👶' : k.age < 13 ? '🧒' : '🧑'} ${esc(k.name)}</div><div class="s">Age ${k.age}${k.grown ? ' · moved out' : ''}</div>
                    <div class="row">${k.grown ? '' : btn('🧸 Play together', 'playKid', i, { cls: 'sky', cd: k.cd || 0 })}</div></div>`;
            });
            h += '</div>';
        } else h += '<div class="card tiny muted">No kids yet. Get engaged or married, move into your own place, then try for a baby.</div>';
        h += `<div class="section-title">Pets <span class="muted">${R.pets.length}/${MAX_PETS}</span></div>`;
        if (R.pets.length) h += '<div class="chips" style="margin-bottom:8px">' + R.pets.map(x => `<span class="chip">${PETS[x.t].icon} ${esc(x.name)} the ${PETS[x.t].name}, ${x.age} yr</span>`).join('') + '</div>';
        h += '<div class="cards">';
        for (const t in PETS) {
            const P = PETS[t], lock = R.pets.length >= MAX_PETS || (P.needHome && !L.props.length);
            h += `<div class="item"><div class="t">${P.icon} ${P.name}</div><div class="s">${money(P.price)} · ${money(P.cost)}/mo · +${P.hap} happiness · lives ~${P.life} yrs${P.needHome ? ' · needs a home you own' : ''}</div>
                <div class="row">${btn('Adopt', 'adoptPet', t, { cls: 'green', cost: P.price, lock })}</div></div>`;
        }
        return h + '</div>';
    }

    function buildShop() {
        let h = `<div class="section-title">Life Shop <span class="muted">treats boost happiness for a while; buying the same thing again soon gives less</span></div><div id="shop" class="cards">`;
        for (const item of SHOP) {
            const price = item.insured && insured() ? Math.round(item.price * 0.25) : item.price;
            h += `<div class="item"><div class="t">${item.icon} ${item.name}</div>
                <div class="s" style="color:#38bdf8">${money(price)} | +${num(item.boost)} Score</div><div class="s">${item.desc}</div>
                <div class="row">${btn('BUY', 'shop', item.id, { cls: '', cost: price, lock: !!item.pet && L.rel.pets.length >= MAX_PETS })}</div></div>`;
        }
        h += `<div class="item"><div class="t">🏠 Suburban House</div><div class="s">Homes are now real property: rent, buy outright or take a mortgage, and watch the value change.</div>
            <div class="row">${btn('Go to Home tab', 'tab', 'home', { cls: 'sky' })}</div></div></div>`;
        h += `<div class="section-title">Subscriptions <span class="muted">charged with your monthly bills</span></div><div class="cards">`;
        for (const id in SUBS) {
            const S = SUBS[id], on = !!L.subs[id];
            h += `<div class="item ${on ? 'cur' : ''}"><div class="t">${S.icon} ${S.name}</div><div class="s">${money(S.cost)}/mo · ${S.desc}</div>
                <div class="row">${btn(on ? 'Cancel' : 'Subscribe', 'sub', id, { cls: on ? 'gray' : 'green' })}</div></div>`;
        }
        return h + '</div>';
    }

    // live values shown inside panels (updated every tick without rebuilding the panel)
    function bindText(k) {
        switch (k) {
            case 'perf': return L.job ? Math.floor(L.job.perf) + ' / 100' : '';
            case 'gpa': return L.school ? L.school.gpa.toFixed(2) : '';
            case 'schoolLeft': { if (!L.school) return ''; const left = L.school.total - L.school.d; return `${left} days left (${(left / YEAR_DAYS).toFixed(1)} yrs)`; }
            case 'carCond': return L.car ? Math.round(L.car.cond) + '%' : '';
            case 'love': return L.rel.p ? Math.round(L.rel.p.love) + ' / 100' : '';
            case 'parents': return Math.round(L.rel.parents) + ' / 100';
            case 'health': return Math.round(L.health);
            case 'happy': return Math.round(L.happy);
            case 'retire': { const y = RETIRE_AGE - L.age; return `Retires at ${RETIRE_AGE} (in ${y} year${y === 1 ? '' : 's'})`; }
            case 'pbs': return `${num(pbScore)} pts · ${money(pbMoney)}`;
            case 'portfolio': { let v = indexStock.price * indexStock.owned; for (const s of stocks) v += s.price * s.owned; return money(v, 2); }
        }
        if (k.startsWith('cd:')) { const r = +k.slice(3) - day; return r > 0 ? ` (${r}d)` : ''; }
        return '';
    }
    function bindWidth(k) {
        switch (k) {
            case 'perf': return L.job ? L.job.perf : 0;
            case 'school': return L.school ? L.school.d / L.school.total * 100 : 0;
            case 'study': return studyProgress;
            case 'carCond': return L.car ? L.car.cond : 0;
            case 'love': return L.rel.p ? L.rel.p.love : 0;
            case 'parents': return L.rel.parents;
            case 'health': return L.health;
            case 'happy': return L.happy;
        }
        return 0;
    }
    function collectBinds(el) {
        el._btns = Array.from(el.querySelectorAll('[data-cost],[data-cd]'));
        el._txt = Array.from(el.querySelectorAll('[data-b]'));
        el._w = Array.from(el.querySelectorAll('[data-w]'));
        el._built = false;
    }
    function refreshBinds(el) {
        if (!el._btns) return;
        for (const b of el._btns) b.disabled = b.dataset.lock === '1' || cash < (+b.dataset.cost || 0) || day < (+b.dataset.cd || 0);
        for (const t of el._txt) setText(t, String(bindText(t.dataset.b)));
        for (const w of el._w) setWidth(w, bindWidth(w.dataset.w));
    }
    function renderPanel() {
        const t = L.tab;
        for (const x of TABS) {
            const on = x.id === t;
            const p = $('p-' + x.id), b = $('tab-' + x.id);
            if (p._on !== on) { p.classList.toggle('on', on); p._on = on; }
            if (b && b._on !== on) { b.classList.toggle('on', on); b._on = on; }
        }
        const el = $('p-' + t);
        if (PANELS[t] && dirty[t] && !(pointerDown && performance.now() - pointerDown < 1500)) {
            el.innerHTML = PANELS[t]();
            collectBinds(el);
            dirty[t] = false;
        }
        refreshBinds(el);
        if (t === 'market') refreshMarket(el);
        // little dots on tabs that need attention
        const alerts = { career: !L.job && L.age >= 16 && !L.school || !!(L.job && L.job.perf >= 100 && nextRankBlocked()), school: !!(L.school && L.school.gpa < 2.3), home: crowded() || (livingWithParents() && L.age >= 22), family: !!(L.rel.p && L.rel.p.love < 30), biz: !!L.bizNew, stats: !!L.achNew };
        for (const k in alerts) { const b = $('tab-' + k); if (b && b._al !== alerts[k]) { b.classList.toggle('alert', alerts[k]); b._al = alerts[k]; } }
    }

    const E = {};
    function updateUI() {
        if (!E.cash) for (const id of ['cash', 'net-worth', 'life-score', 'pb-score', 'pb-money', 'day-display', 'age-display', 'year-fill', 'who-av', 'who-name', 'health-num', 'happy-num', 'health-bar', 'happy-bar', 'work-progress', 'job-title', 'career-stats', 'next-rank-progress', 'ot-btn', 'study-card', 'study-title', 'study-sub', 'study-gpa', 'study-progress', 'flow-payday', 'flow-pay', 'flow-billday', 'flow-bills']) E[id] = $(id);
        const netWorth_ = netWorth();
        currentSalary = weeklyWage();
        promotionCount = L.stats.promos;

        setText(E.cash, money(cash, 2));
        E.cash.style.color = cash < 0 ? '#ef4444' : '#10b981';
        setText(E['net-worth'], money(netWorth_, 2));
        setText(E['life-score'], num(lifeScore));
        setText(E['pb-score'], `Best: ${num(pbScore)}`);
        setText(E['pb-money'], `Best: ${money(parseFloat(pbMoney))}`);
        setText(E['day-display'], `Day ${day}`);
        setText(E['age-display'], `Age ${L.age}`);
        setWidth(E['year-fill'], L.yday / YEAR_DAYS * 100);
        setText(E['who-av'], L.avatar);
        setText(E['who-name'], L.phase === 'play' || L.phase === 'retired' ? L.name : 'Market & Life');
        setText(E['health-num'], String(Math.round(L.health)));
        setText(E['happy-num'], String(Math.round(L.happy)));
        setWidth(E['health-bar'], L.health);
        setWidth(E['happy-bar'], L.happy);
        setWidth(E['work-progress'], workProgress);

        if (L.job) {
            const C = CAREERS[L.job.c];
            setText(E['job-title'], `${C.icon} ${jobTitle()}`);
            setText(E['career-stats'], `Salary: ${money(currentSalary)}/wk${L.school ? ' (part-time)' : ''}`);
            const blk = L.job.perf >= 100 && nextRankBlocked();
            setText(E['next-rank-progress'], L.job.r >= C.ranks.length - 1 && L.job.perf >= 100 ? 'Top rank 👑' : blk ? '🔒 Needs degree' : `${Math.floor(L.job.perf)} / 100`);
            setText(E['ot-btn'], 'WORK OVERTIME');
        } else {
            setText(E['job-title'], L.school ? '🎓 Student' : '😶 Unemployed');
            setText(E['career-stats'], 'No salary. Find a job in the Career tab.');
            setText(E['next-rank-progress'], '—');
            setText(E['ot-btn'], 'DO ODD JOBS');
        }
        if (L.school) {
            const P = PROGRAMS[L.school.id];
            if (E['study-card']._show !== true) { E['study-card'].style.display = ''; E['study-card']._show = true; }
            setText(E['study-title'], `${P.icon} ${P.school === 'High School' ? 'High School' : P.name}`);
            setText(E['study-sub'], `Year ${Math.min(P.years, Math.floor(L.school.d / YEAR_DAYS) + 1)} of ${P.years} · ${L.school.total - L.school.d} days left`);
            setText(E['study-gpa'], L.school.gpa.toFixed(2));
            setWidth(E['study-progress'], studyProgress);
        } else if (E['study-card']._show !== false) { E['study-card'].style.display = 'none'; E['study-card']._show = false; }

        setText(E['flow-payday'], `${7 - day % 7}d`);
        setText(E['flow-pay'], '+' + money(weeklyIncome()));
        setText(E['flow-billday'], `${30 - day % 30}d`);
        setText(E['flow-bills'], '-' + money(sumLines(billLines(weeklyIncome() * 30 / 7))));

        renderPanel();
        saveGame(netWorth_);
    }

    // ===================== INPUT =====================
    const ACTIONS = {
        mview: a => { L.mkt.view = a; changed(); }, qty: a => { L.mkt.qty = +a; changed(); }, bamt: a => { L.mkt.amt = +a; changed(); },
        msel: a => { if (L.mkt.view === 'crypto') L.mkt.csel = a; else L.mkt.sel = a; changed(); }, mfilt: a => { L.mkt.filt = a; changed(); }, mrange: a => { L.mkt.range = +a; changed(); },
        order: a => openOrder(a), cancelOrder: a => cancelOrder(a), ordType: a => ordType(a), ordPct: a => ordPct(+a), placeOrder: () => placeOrder(),
        deposit: () => deposit(), withdraw: () => withdraw(), bond: a => buyBond(a), sellBond: a => sellBond(a), donate: () => donate(),
        startFirm: a => startFirm(a), hire: a => hireEmp(a), fire: a => fireEmp(a), mgr: a => toggleMgr(a), mkt: a => setMkt(a), upgrade: a => upgradeFirm(a), sellFirm: a => sellFirm(a),
        whatsNew: () => showWhatsNew(),
        tab: a => setTab(a), speed: a => setSpeed(+a), reset: () => startNewRound(),
        overtime: () => doOvertime(), study: () => doStudy(),
        buy: a => buyStock(a), sell: a => sellStock(a), biz1: () => handleBusiness1(), biz2: () => handleBusiness2(),
        shop: a => buyShop(a), sub: a => toggleSub(a), style: a => setStyle(+a),
        apply: a => applyJob(a), quit: () => quitJob(), raise: () => askRaise(),
        enroll: a => enroll(a, false), enrollLoan: a => enroll(a, true), dropout: () => dropOut(), rotc: () => joinRotc(), payStudent: () => payStudentLoan(),
        rent: a => rentHome(a), buyHome: a => buyHome(a, false), mortgage: a => buyHome(a, true), sellProp: a => askSellProp(+a), moveIn: a => moveIn(+a), payMortgage: a => payMortgage(+a),
        buyCar: a => buyCar(a, false), financeCar: a => buyCar(a, true), sellCar: () => sellCar(), service: () => serviceCar(), payCar: () => payCarLoan(),
        findDate: () => findDate(), dateNight: () => dateNight(), propose: () => propose(), wedding: a => wedding(+a === 1), baby: () => tryBaby(), adoptKid: () => adoptKid(),
        breakUp: () => askBreakUp(), playKid: a => playKid(+a), visitParents: () => visitParents(), askParents: () => askParents(), hangOut: () => hangOut(), party: () => party(), adoptPet: a => adoptPet(a),
        retire: () => askRetire(), evChoice: a => resolveEvent(a), modalOk: () => closeModal(), confirmYes: () => confirmYes(),
        rename: () => showRename(), saveName: () => saveName(),
        newLife: () => newLife(), startLife: () => startLife(), pickAvatar: a => pickSetup('avatar', a, 'av-pick'), pickTrait: a => pickSetup('trait', a, 'trait')
    };
    document.addEventListener('click', e => {
        const b = e.target.closest('[data-act]');
        if (!b || b.disabled) return;
        // while a modal is open only its own buttons work
        if (modalOpen && !b.closest('#modal')) return;
        const f = ACTIONS[b.dataset.act];
        if (f) f(b.dataset.arg);
    });
    document.addEventListener('input', e => { const i = e.target && e.target.id; if (i === 'ord-px' || i === 'ord-n') orderSay(); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target && e.target.id === 'setup-name') startLife();
        if (e.key === 'Enter' && e.target && e.target.id === 'rename-input') saveName();
    });
    // never rebuild a panel while the mouse button is held down (that would swallow the click)
    window.addEventListener('pointerdown', () => { pointerDown = performance.now(); }, true);
    window.addEventListener('pointerup', () => { pointerDown = 0; setTimeout(() => { if (L && !pointerDown) renderPanel(); }, 0); }, true);
    window.addEventListener('pointercancel', () => { pointerDown = 0; }, true);
    window.addEventListener('blur', () => { pointerDown = 0; });
    window.addEventListener('pagehide', () => { if (L) saveGame(netWorth()); });

    // test / debug hook
    window.__market = {
        noEvents: false,
        get state() { return { cash, day, lifeScore, pbScore, pbMoney, life: L, stocks, indexStock, hasBiz1, biz1Level, hasBiz2, biz2Level, netWorth: netWorth(), modalOpen, totalWorkCompleted, promotionCount, currentSalary }; },
        days(n) { let i = 0; for (; i < n && L.phase === 'play' && !modalOpen; i++) simDay(); markDirty(); updateUI(); return i; },
        set(o) { if (o.cash !== undefined) cash = o.cash; if (o.lifeScore !== undefined) lifeScore = o.lifeScore; if (o.life) Object.assign(L, o.life); markDirty(); updateUI(); },
        event(id, d) { const ev = EVBYID[id]; if (!ev) return false; openEvent(id, d || (ev.make ? ev.make() : {}) || {}); return true; },
        act(name, arg) { ACTIONS[name](arg); },
        ach: ACH, checkAch, sdef: SDEF, news: () => marketNews(),
        careers: CAREERS, programs: PROGRAMS, events: EVENTS.map(e => e.id)
    };

    initGame();
