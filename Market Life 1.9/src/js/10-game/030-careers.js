    // ===================== CAREERS =====================
    function rankOf(job) { return CAREERS[job.c].ranks[job.r]; }
    function jobTitle() { return L.job ? rankOf(L.job)[0] : (L.school ? 'Student' : 'Unemployed'); }
    function canJoin(c) {
        const C = CAREERS[c];
        if (L.age < (C.minAge || 16)) return false;
        if (C.maxJoin && L.age > C.maxJoin) return false;
        if (C.minHealth && L.health < C.minHealth - (L.trait === 'athletic' ? 10 : 0)) return false;
        return meets(C.ranks[0][2]);
    }
    function joinProblems(c) {
        const C = CAREERS[c], out = [];
        if (L.age < (C.minAge || 16)) out.push('age ' + (C.minAge || 16) + '+');
        if (C.maxJoin && L.age > C.maxJoin) out.push('age ' + C.maxJoin + ' or younger');
        if (C.minHealth) out.push('health ' + (C.minHealth - (L.trait === 'athletic' ? 10 : 0)) + '+');
        if (C.ranks[0][2]) out.push(reqText(C.ranks[0][2]));
        return out.length ? out.join(', ') : 'No requirements';
    }
    // the rank you would start at if you joined career c today
    function startRank(c) {
        const C = CAREERS[c]; let r = 0;
        for (const [req, rank] of (STARTS[c] || [])) if (rank > r && meets(req) && meets(C.ranks[rank][2])) r = rank;
        const back = Math.max(0, (L.best[c] || 0) - 1);   // returning to an old career: one step below your best
        for (let i = r + 1; i <= back; i++) { if (meets(C.ranks[i][2])) r = i; else break; }
        return Math.min(r, C.ranks.length - 1);
    }
    function weeklyWage() {
        if (!L.job) return 0;
        let pay = rankOf(L.job)[1] * (1 + L.payBonus) * STYLES[L.style].pay;
        if (L.school) pay *= 0.5;
        return Math.round(pay);
    }
    function insured() { return L.age < 18 || !!(L.job && CAREERS[L.job.c].benefits); }   // kids are on their parents' plan
    function billCost(c) { return Math.round(insured() ? c * 0.25 : c); }

    function hire(c, r, bonus, quiet) {
        const C = CAREERS[c];
        if (L.best[c] === undefined) addScore(50);   // first job in a new career
        L.job = { c, r, perf: 0, days: 0 };
        L.payBonus = bonus || 0;
        L.jobsHeld++;
        L.best[c] = Math.max(L.best[c] || 0, r);
        addTimeline(C.icon, `Hired as ${C.ranks[r][0]}`);
        if (!quiet) {
            logMessage(`💼 Hired: ${C.ranks[r][0]} (${money(weeklyWage())}/wk)`, 'boost-alert');
            toast(`${C.icon} New job: ${C.ranks[r][0]}!`, 'good');
        }
        markDirty();
    }
    function applyJob(c) {
        if (!CAREERS[c] || !canJoin(c) || (L.job && L.job.c === c) || L.phase !== 'play') return;
        const go = () => { hire(c, startRank(c), 0); changed(); };
        const C = CAREERS[c], sr = C.ranks[startRank(c)];
        if (L.job) confirmBox(C.icon, 'Switch careers?', `You will leave your job as ${jobTitle()} (${money(weeklyWage())}/wk) and start as <b>${sr[0]}</b> in ${C.name} (${money(sr[1])}/wk${L.school ? ', half while studying' : ''}).`, 'Switch', go);
        else go();
    }
    function loseJob(why) {
        if (!L.job) return;
        const t = jobTitle();
        logMessage(`📦 ${why}: you are no longer ${t}`, 'tax-alert');
        addTimeline('📦', `${why} (${t})`);
        L.job = null; L.payBonus = 0;
        markDirty();
    }
    function quitJob() {
        if (!L.job) return;
        confirmBox('🚪', 'Quit your job?', `You will stop earning a salary as ${jobTitle()}.`, 'Quit', () => { loseJob('Quit'); boostHappy(3); changed(); });
    }
    function askRaise() {
        if (!L.job || !cdReady('raise')) return;
        setCd('raise', YEAR_DAYS);
        if (luck(0.15 + L.job.perf / 150 + charm())) {
            const b = Math.round(rnd(0.05, 0.1) * 100) / 100;
            L.payBonus = Math.round((L.payBonus + b) * 100) / 100;
            boostHappy(5);
            logMessage(`🤝 Raise approved! +${Math.round(b * 100)}% pay (${money(weeklyWage())}/wk)`, 'boost-alert');
            toast('Raise approved!', 'good');
        } else {
            boostHappy(-4); L.job.perf = Math.max(0, L.job.perf - 10);
            logMessage('🙅 Your raise was denied. Boost your performance and try again next year.', 'tax-alert');
            toast('Raise denied', 'bad');
        }
        changed();
    }
    function perfGain() {
        const j = L.job; if (!j) return 0;
        const C = CAREERS[j.c];
        // balanced pace at 70 happiness: about 2 years for the first promotion, 5+ years per step near the top
        let g = 0.9 * STYLES[L.style].perf * (0.6 + L.happy / 250);
        if (L.health < 30) g *= 0.6;
        if (L.school) g *= 0.5;
        if (L.trait === 'brainy') g *= 1.1;
        if (!L.car && L.age >= 18) g *= 0.9;
        if (C.trade && L.car && L.car.id === 'pickup') g *= 1.15;
        if (j.c === 'athlete' && L.health < 50) g *= 0.2;
        return g / (1 + j.r * 0.35);
    }
    function nextRankBlocked() {
        const j = L.job; if (!j) return null;
        const C = CAREERS[j.c];
        if (j.r >= C.ranks.length - 1) return null;
        const req = C.ranks[j.r + 1][2];
        return meets(req) ? null : req;
    }
    function checkPromotion() {
        const j = L.job; if (!j || j.perf < 100) return;
        const C = CAREERS[j.c];
        j.perf = 100;
        if (j.r >= C.ranks.length - 1) return;
        const block = nextRankBlocked();
        if (block) {
            if (!j.noted) { j.noted = true; logMessage(`🔒 Ready for promotion, but ${C.ranks[j.r + 1][0]} needs: ${reqText(block)}`, 'tax-alert'); toast('Promotion blocked: you need more education', 'bad'); markDirty(); }
            return;
        }
        promote();
    }
    function promote() {
        const j = L.job; if (!j) return;
        const C = CAREERS[j.c];
        if (j.r >= C.ranks.length - 1) return;
        j.r++; j.perf = 0; j.noted = false;
        L.stats.promos++; promotionCount = L.stats.promos;
        L.best[j.c] = Math.max(L.best[j.c] || 0, j.r);
        addScore(250 + 50 * j.r);
        boostHappy(8);
        logMessage(`🎊 PROMOTED to ${C.ranks[j.r][0]}! New Salary: ${money(weeklyWage())}/wk`, 'boost-alert');
        toast(`🎊 Promoted to ${C.ranks[j.r][0]}!`, 'good');
        addTimeline('📈', 'Promoted to ' + C.ranks[j.r][0]);
        if (j.r === C.ranks.length - 1) {
            addScore(1000);
            logMessage(`👑 You reached the top of ${C.name}! +1000 Life Score`, 'boost-alert');
            addTimeline('👑', `Reached the top of ${C.name}`);
        }
        markDirty();
    }
    function setStyle(i) { if (STYLES[i]) { L.style = i; changed(); } }

    // ===================== MONEY: LOANS, PAY, BILLS =====================
    function loanPayment(bal, rate, n) { return Math.round(bal * rate / (1 - Math.pow(1 + rate, -n))); }
    function makeLoan(bal, T, label) { return { bal: bal, rate: T.rate, n: T.n, pay: loanPayment(bal, T.rate, T.n), label }; }
    function loanMonth(l) {
        if (!l || l.n <= 0) return 0;
        const interest = l.bal * l.rate;
        let pay = Math.min(l.pay, l.bal + interest);
        l.bal = l.bal + interest - pay; l.n--;
        if (l.bal < 1 || l.n <= 0) { pay += Math.max(0, l.bal); l.bal = 0; l.n = 0; }
        return pay;
    }
    // expected weekly business income (for forecasts): the corporation track plus each business at its current settings
    function weeklyBiz() {
        let t = corpProfit(true);
        for (const f of L.firms) t += firmCalc(f).net;
        return Math.round(t);
    }
    function spousePay() { return L.rel.s === 'married' && L.rel.p ? L.rel.p.pay : 0; }
    function stipend() { return L.school && PROGRAMS[L.school.id].stipend || 0; }
    function weeklyIncome() { return weeklyWage() + spousePay() + stipend() + weeklyBiz(); }

    function payday() {
        let wage = 0;
        if (L.job) {
            wage = weeklyWage();
            if (CAREERS[L.job.c].volatile) wage = Math.round(wage * rnd(0.3, 1.8));
            if (L.skipPay) { wage = 0; L.skipPay = 0; logMessage('🏖️ Unpaid week off: no salary this week'); }
        }
        const corp = corpProfit(false), firms = firmsWeek(), sp = spousePay(), st = stipend();
        const pay = wage + corp + sp + st;
        cash += pay + firms;
        L.monthIncome += wage + corp + firms + st;
        L.stats.earned += Math.max(0, pay + firms);
        if (pay > 0) logMessage(`💰 WEEKLY PAY: +${money(pay)}${sp ? ` (incl. ${L.rel.p.name} ${money(sp)})` : ''}`, 'salary-alert');
        if (L.firms.length) logMessage(`🏪 Businesses this week: ${firms >= 0 ? '+' : ''}${money(firms)}`, firms >= 0 ? 'salary-alert' : 'tax-alert');
    }

    // ===================== BUSINESSES (2.0) =====================
    // how the economy treats a sector right now (bull/bear market and sector news): about 0.65x to 1.35x
    function econ(sec) { const M = L.mkt; return clamp(1 + REGIMES[M.reg].econ + (M.sec[sec] || 0) * 8, 0.65, 1.35); }
    function biz1Profit() { return BIZ1_INIT_PROFIT + (biz1Level - 1) * BIZ1_LVL_PROFIT; }
    function biz2Profit() { return BIZ2_INIT_PROFIT + (biz2Level - 1) * BIZ2_LVL_PROFIT; }
    // the 1.x corporation track (passive). roll = this week's actual result, otherwise the expected one
    function corpProfit(exp) {
        let p = 0;
        if (hasBiz1) p += biz1Profit() * econ('tech') * (exp ? 1 : rnd(0.85, 1.15));
        if (hasBiz2) p += biz2Profit() * econ('finance') * (exp ? 1 : rnd(0.85, 1.15));
        return Math.round(p);
    }
    function emptyMo() { return { sales: 0, wages: 0, mgr: 0, rent: 0, mkt: 0, extra: 0, net: 0, cust: 0, lost: 0, wks: 0 }; }
    function maxEmp(f) { return Math.round(BIZ[f.t].per * 1.6 * Math.pow(1.5, f.lvl - 1)); }
    function upgCost(f) { return Math.round(BIZ[f.t].cost * 0.8 * Math.pow(1.6, f.lvl - 1) / 10) * 10; }
    function degBonus(T) { return T.deg && T.deg.some(hasTok) ? 1.25 : 1; }
    function fixFirm(f) {
        const T = BIZ[f.t];
        f.lvl = clamp(Math.floor(+f.lvl || 1), 1, T.maxL);
        f.emp = clamp(Math.floor(+f.emp || 0), 0, maxEmp(f));
        f.mk = clamp(Math.floor(+f.mk || 0), 0, MKT_TIERS.length - 1);
        f.mgr = !!f.mgr;
        f.rep = clamp(Number.isFinite(+f.rep) ? +f.rep : 50, 0, 100);
        f.inv = Math.max(0, +f.inv || T.cost);
        if (!f.mo || typeof f.mo !== 'object') f.mo = emptyMo();
        for (const k in emptyMo()) if (!Number.isFinite(+f.mo[k])) f.mo[k] = 0;
        if (!Array.isArray(f.hist)) f.hist = [];
        if (!f.wk || typeof f.wk !== 'object') f.wk = null;
        if (!f.last || typeof f.last !== 'object') f.last = null;
        if (f.fx && !(f.fx.w > 0 && f.fx.m > 0)) f.fx = null;
        if (!f.nm) f.nm = T.name;
        return f;
    }
    // one week of a business. Demand comes from size, marketing, reputation and the economy;
    // you can only serve as many customers as your staff can handle (you count as a worker without a manager).
    function firmCalc(f, roll) {
        const T = BIZ[f.t], lv = f.lvl, mk = MKT_TIERS[f.mk];
        let dem = T.dem * Math.pow(1.5, lv - 1) * (1 + mk.boost / (1 + 0.1 * (lv - 1))) * (0.5 + f.rep / 100) * econ(T.sec);
        if (f.fx) dem *= f.fx.m;
        if (roll) dem *= rnd(1 - T.vol, 1 + T.vol);
        const cap = (f.emp + (f.mgr ? 0 : 1)) * T.cap;
        const served = Math.min(dem, cap);
        const sales = served * T.mar * Math.pow(1.08, lv - 1) / (1 + 0.075 * (lv - 1)) * (f.mgr ? 1.2 : 1) * degBonus(T);   // big firms hit diminishing returns (competition, overhead)
        const scale = 1 + 0.06 * (lv - 1), wages = f.emp * T.wage * scale, mgr = f.mgr ? T.mgrW * scale : 0, rent = T.rent * (1 + 0.6 * (lv - 1)), mkt = T.mkU * mk.cost;
        return { dem, cap, served, sales, wages, mgr, rent, mkt, net: sales - wages - mgr - rent - mkt };
    }
    // reputation drifts toward how well you serve customers (long lines hurt, a manager helps)
    function repTarget(f, r) { const ratio = r.dem > 0 ? r.served / r.dem : 1; return clamp(25 + 55 * ratio * ratio + (f.mgr ? 10 : 0) + f.lvl * 2, 0, 100); }
    function firmWeek(f) {
        const r = firmCalc(f, true);
        f.rep = clamp(f.rep + (repTarget(f, r) - f.rep) * 0.25, 0, 100);
        if (f.fx && --f.fx.w <= 0) f.fx = null;
        f.wk = { net: Math.round(r.net), cust: Math.round(r.served), dem: Math.round(r.dem) };
        const m = f.mo;
        m.sales += r.sales; m.wages += r.wages; m.mgr += r.mgr; m.rent += r.rent; m.mkt += r.mkt; m.net += r.net;
        m.cust += r.served; m.lost += r.dem - r.served; m.wks++;
        return r.net;
    }
    function firmsWeek() {
        let t = 0;
        for (const f of L.firms) t += firmWeek(f);
        if (L.firms.length) dirty.biz = true;
        return Math.round(t);
    }
    // monthly report for every business (with the bills)
    function firmsReport() {
        for (const f of L.firms) {
            const m = f.mo; if (!m.wks) continue;
            const T = BIZ[f.t];
            f.last = { sales: Math.round(m.sales), wages: Math.round(m.wages), mgr: Math.round(m.mgr), rent: Math.round(m.rent), mkt: Math.round(m.mkt), extra: Math.round(m.extra), net: Math.round(m.net + m.extra), cust: Math.round(m.cust), lost: Math.round(m.lost), wks: m.wks, rep: Math.round(f.rep), age: L.age };
            f.hist.push(f.last.net); if (f.hist.length > 12) f.hist.shift();
            if (f.last.net > L.stats.bestMonth) L.stats.bestMonth = f.last.net;
            f.mo = emptyMo();
            logMessage(`📊 ${T.icon} ${f.nm} report: ${f.last.net >= 0 ? '+' : ''}${money(f.last.net)} profit, ${num(f.last.cust)} customers${f.last.lost >= 1 ? `, ${num(f.last.lost)} turned away` : ''}`, f.last.net >= 0 ? 'salary-alert' : 'tax-alert');
            L.bizNew = true;
        }
        if (L.firms.length) dirty.biz = true;
    }
    // what a buyer would pay: 60% of what you put in plus ~15 weeks of recent profit
    function firmValue(f) {
        let s = 0, n = 0;
        for (let i = Math.max(0, f.hist.length - 3); i < f.hist.length; i++) { s += f.hist[i]; n++; }
        const wk = n ? s / n / 4.3 : (f.wk ? f.wk.net : 0);
        return Math.round((0.6 * f.inv + Math.max(0, wk) * 15) / 10) * 10;
    }
    function firmsValue() { let v = 0; for (const f of L.firms) v += firmValue(f); return v; }
    function staffCount() { let n = 0; for (const f of L.firms) n += f.emp + (f.mgr ? 1 : 0); return n; }
    function unmanaged() { let n = 0; for (const f of L.firms) if (!f.mgr) n++; return n; }
    function firmProblems(t) {
        const T = BIZ[t], out = [];
        if (L.age < T.minAge) out.push(`age ${T.minAge}+`);
        if (T.req && !meets(T.req)) out.push(reqText(T.req));
        return out;
    }
    function canStartFirm(t) { return L.phase === 'play' && L.firms.length < MAX_FIRMS && !L.firms.some(f => f.t === t) && !firmProblems(t).length; }
    function startFirm(t) {
        const T = BIZ[t]; if (!T || !canStartFirm(t) || cash < T.cost) return;
        cash -= T.cost;
        const f = fixFirm({ t, nm: `${L.name}'s ${T.name}`, lvl: 1, emp: 0, mgr: false, mk: 0, rep: 50, inv: T.cost, d0: day });
        f.emp = clamp(Math.ceil(firmCalc(f).dem / T.cap) - 1, 0, maxEmp(f));   // a starting crew that roughly matches demand
        L.firms.push(f);
        L.stats.firms++;
        const key = 'biz:' + t, first = !L.ownedTypes[key];
        if (first) { L.ownedTypes[key] = 1; addScore(T.score); }
        boostHappy(6);
        logMessage(`🏪 Opened ${f.nm} with ${plural(f.emp, 'employee')}!${first ? ` +${num(T.score)} Life Score` : ''}`, 'boost-alert');
        toast(`${T.icon} Your ${T.name} is open for business!`, 'good');
        addTimeline(T.icon, `Opened a ${T.name}`);
        changed();
    }
    function hireEmp(i) { const f = L.firms[+i]; if (!f || f.emp >= maxEmp(f)) return; f.emp++; changed(); }
    function fireEmp(i) {
        const f = L.firms[+i]; if (!f || f.emp <= 0) return;
        const sev = BIZ[f.t].wage;
        f.emp--; cash -= sev; f.mo.extra -= sev;
        logMessage(`👋 Let an employee go at ${f.nm} (severance ${money(sev)})`);
        changed();
    }
    function toggleMgr(i) {
        const f = L.firms[+i]; if (!f) return;
        f.mgr = !f.mgr;
        logMessage(f.mgr ? `🧑‍💼 Hired a manager for ${f.nm} (${money(BIZ[f.t].mgrW)}/wk)` : `🧑‍💼 You run ${f.nm} yourself again`);
        changed();
    }
    function setMkt(arg) {
        const p = String(arg).split(':'), f = L.firms[+p[0]], t = +p[1];
        if (!f || !MKT_TIERS[t] || f.mk === t) return;
        f.mk = t;
        logMessage(`📣 ${f.nm} marketing: ${MKT_TIERS[t].icon} ${MKT_TIERS[t].name}${t ? ` (${money(BIZ[f.t].mkU * MKT_TIERS[t].cost)}/wk)` : ''}`);
        changed();
    }
    function upgradeFirm(i) {
        const f = L.firms[+i]; if (!f) return;
        const T = BIZ[f.t];
        if (f.lvl >= T.maxL) return;
        const c = upgCost(f); if (cash < c) return;
        cash -= c; f.lvl++; f.inv += c;
        const pts = Math.round(T.score * 0.3);
        addScore(pts);
        logMessage(`🏗️ ${f.nm} upgraded to level ${f.lvl}! +${num(pts)} Life Score`, 'boost-alert');
        toast(`🏗️ ${T.name} is now level ${f.lvl}`, 'good');
        changed();
    }
    function sellFirm(i) {
        const f = L.firms[+i]; if (!f) return;
        const v = firmValue(f), T = BIZ[f.t];
        confirmBox(T.icon, `Sell ${esc(f.nm)}?`, `A buyer will pay <b>${money(v)}</b> (60% of the ${money(f.inv)} you put in, plus about 15 weeks of recent profit). Your staff stay with the new owner.`, 'Sell it', () => {
            const j = L.firms.indexOf(f); if (j < 0) return;
            L.firms.splice(j, 1); cash += v;
            logMessage(`🏷️ Sold ${f.nm} for ${money(v)}`, 'salary-alert');
            addTimeline('🏷️', `Sold the ${T.name}`);
            changed();
        });
    }

    function residence() {
        const p = L.props.find(x => x.live);
        return p ? { own: true, p, d: HOMES[p.id] } : { own: false, id: L.rent, d: RENTALS[L.rent] || RENTALS.parents };
    }
    function livingWithParents() { return !L.props.some(x => x.live) && L.rent === 'parents'; }
    function kidsHome() { let n = 0; for (const k of L.rel.kids) if (!k.grown) n++; return n; }
    function roomsNeeded() { return 1 + Math.ceil(kidsHome() / 2); }
    function crowded() { return roomsNeeded() > residence().d.rooms; }
    function homePrice(id) { return Math.round(HOMES[id].price * L.hIdx / 10) * 10; }
    function rentIncome(p) { return Math.round(p.value * 0.007); }
    function carValue() { return L.car ? Math.round(L.car.value * (0.5 + L.car.cond / 200)) : 0; }
    function carEquity() { return L.car ? carValue() - (L.car.loan ? L.car.loan.bal : 0) : 0; }
    function repairCost() { return L.car ? Math.round((100 - L.car.cond) * CARS[L.car.id].price * 0.0006 + 20) : 0; }

    // one month's bills; tax is based on what you actually earned this month (estimate for the forecast)
    function billLines(income) {
        const out = [];
        const add = (k, v) => { v = Math.round(v); if (v) out.push([k, v]); };
        if (L.age >= 18 && income > 0) add('Taxes', 0.10 * income + Math.min(MONTHLY_TAX * 0.5, 0.10 * income));
        if (!L.props.some(p => p.live) && L.rent) add('Rent', RENTALS[L.rent].rent);
        let mort = 0, upkeep = 0, rentIn = 0;
        for (const p of L.props) { if (p.loan) mort += p.loan.pay; upkeep += p.value * 0.003; if (!p.live) rentIn += rentIncome(p); }
        add('Mortgage', mort); add('Home upkeep', upkeep); add('Rental income', -rentIn);
        if (L.car) { add('Car upkeep', CARS[L.car.id].upkeep); if (L.car.loan) add('Car loan', L.car.loan.pay); }
        else if (L.age >= 16) add('Bus pass', 30);
        add('Food & living', livingWithParents() ? 20 : 60);
        add('Kids', kidsHome() * 80);
        let pets = 0; for (const p of L.rel.pets) pets += PETS[p.t].cost; add('Pets', pets);
        let subs = 0; for (const k in L.subs) if (L.subs[k] && SUBS[k]) subs += SUBS[k].cost; add('Subscriptions', subs);
        if (L.loans.student && L.loans.student.n > 0) add('Student loan', L.loans.student.pay);
        return out;
    }
    function sumLines(lines) { let t = 0; for (const l of lines) t += l[1]; return t; }

    function payBills() {
        bankMonth();      // interest first, so it is taxed with this month's income
        firmsReport();
        const lines = billLines(L.monthIncome);
        // loans are paid through loanMonth so balances go down (forecast lines used the flat payment)
        let total = 0;
        for (const [k, v] of lines) if (k !== 'Mortgage' && k !== 'Car loan' && k !== 'Student loan') total += v;
        for (const p of L.props) if (p.loan) {
            total += loanMonth(p.loan);
            if (p.loan.bal <= 0) { p.loan = null; logMessage(`🏠 Mortgage on your ${HOMES[p.id].name} is PAID OFF!`, 'boost-alert'); addTimeline('🔑', 'Paid off the ' + HOMES[p.id].name); addScore(300); L.stats.paidOff = (L.stats.paidOff || 0) + 1; markDirty(); }
        }
        if (L.car && L.car.loan) { total += loanMonth(L.car.loan); if (L.car.loan.bal <= 0) { L.car.loan = null; logMessage('🚗 Car loan paid off!', 'boost-alert'); markDirty(); } }
        const sl = L.loans.student;
        if (sl && sl.n > 0) { total += loanMonth(sl); if (sl.bal <= 0) { L.loans.student = null; logMessage('🎓 Student loan PAID OFF!', 'boost-alert'); addTimeline('🎉', 'Paid off student loans'); addScore(200); markDirty(); } }
        total = Math.round(total);
        cash -= total;
        L.monthIncome = 0;
        const tax = (lines.find(l => l[0] === 'Taxes') || [0, 0])[1];
        logMessage(`⚖️ MONTHLY BILLS: -${money(total)}${tax ? ` (taxes ${money(tax)})` : ''}`, 'tax-alert');
        if (cash < 0 && L.bank.sav > 0) {   // overdraft protection from your savings account
            const t = Math.min(L.bank.sav, -cash);
            L.bank.sav -= t; L.bank.min = Math.min(L.bank.min, L.bank.sav); cash += t;
            logMessage(`🏦 Moved ${money(t, 2)} from savings to cover your bills`, 'boost-alert');
        }
        if (cash < 0) {
            L.debtMonths++;
            logMessage(`⚠️ You are in debt (${money(cash)}). Cut costs or sell something! (${L.debtMonths}/4)`, 'tax-alert');
            if (L.debtMonths >= 4) bankruptcy();
        } else L.debtMonths = 0;
        markDirty();
    }
    function bankruptcy() {
        // the bank sells your investments first; if that covers the debt, you keep your car and home
        const inv = liquidate();
        if (inv > 0) {
            logMessage(`💸 The bank sold your savings, bonds and investments (${money(inv)}) to cover your debts.`, 'tax-alert');
            if (cash >= 0) { L.debtMonths = 0; boostHappy(-8); toast('💸 Your investments were sold to pay your debts', 'bad'); markDirty(); return; }
        }
        let raised = 0;
        if (L.car) { raised += carEquity(); L.car = null; }
        for (let i = L.props.length - 1; i >= 0; i--) { const p = L.props[i]; raised += Math.round(p.value * 0.85) - (p.loan ? p.loan.bal : 0); }
        L.props = [];
        cash += raised;
        if (!RENTALS[L.rent] || L.rent !== 'parents') L.rent = L.age >= 25 ? 'room' : 'parents';
        if (cash < 0) {
            // the leftover debt becomes a bank loan (carried in the loan slot) instead of vanishing
            const d = Math.ceil(-cash), l = L.loans.student;
            if (l && l.bal > 0) { l.bal += d; l.n = Math.max(l.n, 120); l.pay = loanPayment(l.bal, l.rate, l.n); }
            else L.loans.student = makeLoan(d, STUDENT_LOAN, 'Bank Debt');
            cash = 0;
            logMessage(`🏦 The bank turned your leftover ${money(d)} debt into a loan.`, 'tax-alert');
        }
        L.debtMonths = 0;
        addScore(-500); boostHappy(-25);
        logMessage('💥 BANKRUPT! Your car and properties were sold to pay your debts. -500 Life Score', 'tax-alert');
        addTimeline('💥', 'Went bankrupt');
        toast('💥 Bankruptcy! Assets sold to cover debts.', 'bad');
        markDirty();
    }

    function netWorth() {
        let nw = cash;
        for (const s of stocks) nw += s.price * s.owned;
        nw += indexStock.price * indexStock.owned;
        nw += L.bank.sav + bondValue() + firmsValue();
        for (const p of L.props) nw += p.value - (p.loan ? p.loan.bal : 0);
        nw += carEquity();
        if (L.loans.student) nw -= L.loans.student.bal;
        return nw;
    }

