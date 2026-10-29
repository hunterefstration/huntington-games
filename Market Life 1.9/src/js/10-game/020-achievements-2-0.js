    // ===================== ACHIEVEMENTS (2.0) =====================
    // test(nw) runs every update for the ones you have not unlocked yet, so keep them cheap.
    const ACH = [
        { id: 'trade', icon: '📈', name: 'First Trade', desc: 'Buy your first stock.', pts: 100, test: () => L.mkt.buys > 0 },
        { id: 'divers', icon: '🧺', name: 'Diversified', desc: 'Own stocks from 5 different sectors at once.', pts: 300, test: () => sectorsHeld() >= 5 },
        { id: 'divs', icon: '💵', name: 'Dividend Collector', desc: 'Earn $1,000 in dividends.', pts: 300, test: () => L.mkt.divs >= 1000 },
        { id: 'limit', icon: '🎯', name: 'Sharpshooter', desc: 'Get a limit order filled.', pts: 200, test: () => L.mkt.fills > 0 },
        { id: 'stop', icon: '🛡️', name: 'Safety Net', desc: 'Let a stop-loss order sell for you.', pts: 200, test: () => L.mkt.stops > 0 },
        { id: 'double', icon: '✌️', name: 'Doubled Up', desc: 'Sell shares for twice what you paid.', pts: 400, test: () => !!L.mkt.x2 },
        { id: 'wizard', icon: '🧙', name: 'Market Wizard', desc: 'Make $25,000 of trading profit.', pts: 800, test: () => L.mkt.real >= 25000 },
        { id: 'crypto', icon: '🪙', name: 'To the Moon', desc: 'Own $10,000 of crypto.', pts: 400, test: () => assetValue('crypto') >= 10000 },
        { id: 'diamond', icon: '💎', name: 'Diamond Hands', desc: 'Keep holding stocks for 30 days after a crash.', pts: 500, test: () => !!L.mkt.held },
        { id: 'whale', icon: '🐋', name: 'Whale', desc: 'Own $1,000,000 of stocks and crypto.', pts: 1500, test: () => assetValue() >= 1e6 },
        { id: 'saver', icon: '🐷', name: 'Rainy Day Fund', desc: 'Keep $5,000 in savings.', pts: 200, test: () => L.bank.sav >= 5000 },
        { id: 'bond', icon: '📜', name: 'Bondholder', desc: 'Buy a bond.', pts: 150, test: () => L.bank.bought > 0 },
        { id: 'interest', icon: '🏦', name: 'Money Makes Money', desc: 'Earn $5,000 of interest.', pts: 500, test: () => L.bank.int >= 5000 },
        { id: 'founder', icon: '🍋', name: 'Entrepreneur', desc: 'Start your first business.', pts: 200, test: () => L.stats.firms > 0 },
        { id: 'staff', icon: '👥', name: 'Job Creator', desc: 'Employ 15 people at once.', pts: 400, test: () => staffCount() >= 15 },
        { id: 'empire', icon: '🏬', name: 'Business Empire', desc: 'Own 3 businesses at once.', pts: 600, test: () => L.firms.length >= 3 },
        { id: 'stars', icon: '⭐', name: 'Five Stars', desc: 'Get a business to 90+ reputation.', pts: 300, test: () => L.firms.some(f => f.rep >= 90) },
        { id: 'bigmonth', icon: '📊', name: 'Big Month', desc: 'Make $10,000 profit in one business report.', pts: 600, test: () => L.stats.bestMonth >= 10000 },
        { id: 'maxed', icon: '🏗️', name: 'Fully Upgraded', desc: 'Upgrade a business to its max level.', pts: 500, test: () => L.firms.some(f => f.lvl >= BIZ[f.t].maxL) },
        { id: 'tycoon', icon: '🏢', name: 'Tycoon', desc: 'Found Conglomerate Corp.', pts: 500, test: () => hasBiz2 },
        { id: 'nw10k', icon: '💰', name: 'Five Figures', desc: 'Reach a $10,000 net worth.', pts: 150, test: nw => nw >= 1e4 },
        { id: 'nw1m', icon: '💎', name: 'Millionaire', desc: 'Reach a $1,000,000 net worth.', pts: 1000, test: nw => nw >= 1e6 },
        { id: 'nw10m', icon: '👑', name: 'Multi-Millionaire', desc: 'Reach a $10,000,000 net worth.', pts: 2500, test: nw => nw >= 1e7 },
        { id: 'home', icon: '🏠', name: 'Homeowner', desc: 'Buy a home.', pts: 200, test: () => L.stats.homes > 0 },
        { id: 'island', icon: '🏝️', name: 'Island Life', desc: 'Own a private island.', pts: 1500, test: () => L.props.some(p => p.id === 'island') },
        { id: 'debtfree', icon: '🔑', name: 'Debt Free', desc: 'Pay off a mortgage.', pts: 300, test: () => L.stats.paidOff > 0 },
        { id: 'scholar', icon: '🎓', name: 'Scholar', desc: 'Earn 3 degrees.', pts: 400, test: () => L.degrees.length >= 3 },
        { id: 'top', icon: '👔', name: 'Top of the Ladder', desc: 'Reach the top rank of any career.', pts: 800, test: () => { for (const c in L.best) if (CAREERS[c] && L.best[c] >= CAREERS[c].ranks.length - 1) return true; return false; } },
        { id: 'family', icon: '👨‍👩‍👧', name: 'Family Life', desc: 'Get married and have a kid.', pts: 400, test: () => L.rel.s === 'married' && L.rel.kids.length > 0 },
        { id: 'zen', icon: '🧘', name: 'Inner Peace', desc: 'Have health and happiness both at 90+.', pts: 300, test: () => L.health >= 90 && L.happy >= 90 },
        { id: 'giver', icon: '🤝', name: 'Philanthropist', desc: 'Donate $5,000 to charity.', pts: 500, test: () => L.stats.charity >= 5000 },
        { id: 'speed', icon: '🏁', name: 'Need for Speed', desc: 'Own a hypercar.', pts: 600, test: () => !!(L.car && L.car.id === 'hyper') },
        { id: 'golden', icon: '🏖️', name: 'Golden Years', desc: 'Make it all the way to retirement at 65.', pts: 500, test: () => false }
    ];
    const ACHBYID = {};
    for (const a of ACH) ACHBYID[a.id] = a;

    // which careers each degree helps unlock (for the School tab)
    for (const pid in PROGRAMS) {
        const P = PROGRAMS[pid]; P.unlocks = [];
        for (const cid in CAREERS) {
            const used = CAREERS[cid].ranks.some(r => r[2] && (r[2].includes(pid) || r[2].includes(P.lvl)));
            if (used) P.unlocks.push(CAREERS[cid].icon + ' ' + CAREERS[cid].name);
        }
    }

    let cash, day, lifeScore, workProgress, stocks, indexStock;
    let hasBiz1, biz1Level, hasBiz2, biz2Level;
    let pbScore, pbMoney, totalWorkCompleted, promotionCount, currentSalary;
    let L;               // the life state (saved inside marketLifeSave as "life")
    let studyProgress = 0;
    let modalOpen = false, tickTimer = null, pointerDown = 0;
    const dirty = {};

    // ===================== HELPERS =====================
    const $ = id => document.getElementById(id);
    function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
    function money(n, dec) {
        n = +n || 0; const neg = n < 0; n = Math.abs(n);
        const s = dec ? n.toFixed(dec) : Math.round(n).toString();
        const dot = s.indexOf('.');
        const i = (dot < 0 ? s : s.slice(0, dot)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return (neg ? '-$' : '$') + i + (dot < 0 ? '' : s.slice(dot));
    }
    function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
    function num(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function rint(a, b) { return Math.floor(rnd(a, b + 1)); }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function luck(p) { return Math.random() < p + (L.trait === 'lucky' ? 0.12 : 0); }
    function charm() { return L.trait === 'charming' ? 0.15 : 0; }
    function setText(el, s) { if (el && el._t !== s) { el.textContent = s; el._t = s; } }
    function setWidth(el, pct) { const s = clamp(pct, 0, 100).toFixed(1) + '%'; if (el && el._w !== s) { el.style.width = s; el._w = s; } }
    function addScore(n) { lifeScore = Math.round(lifeScore + n); }
    function boostHappy(n) { L.happy = clamp(L.happy + n, 0, 100); }
    function boostHealth(n) { L.health = clamp(L.health + n, 0, 100); }
    function setCd(key, days) { L.cd[key] = day + days; }
    function cdReady(key) { return day >= (L.cd[key] || 0); }
    function stockById(id) { return id === 'TOP2' ? indexStock : stocks.find(s => s.id === id); }
    function markDirty() { for (const t of TABS) dirty[t.id] = true; }
    function changed() { markDirty(); if (typeof checkAch === 'function') checkAch(); updateUI(); }
    function addTimeline(icon, text) { L.timeline.push([L.age, icon, text]); if (L.timeline.length > 60) L.timeline.splice(1, 1); }

    // ===================== STATE: NEW / LOAD / MIGRATE =====================
    function newLifeState() {
        return {
            v: SAVE_VERSION, phase: 'setup', name: 'You', avatar: '🧑', trait: '',
            age: START_AGE, yday: 0, health: 80, happy: 70,
            degrees: [], honors: [], school: { id: 'hs', d: 0, total: 2 * YEAR_DAYS, gpa: 3.0, loan: false, paid: 0 },
            job: null, payBonus: 0, style: 1, best: {}, jobsHeld: 0,
            rent: 'parents', props: [], hIdx: 1, hTrend: 0, ownedTypes: {},
            car: null, carTypes: {},
            rel: { s: 'single', p: null, kids: [], pets: [], parents: 70, friends: 2 },
            loans: { student: null }, subs: {}, cd: {}, recent: {},
            monthIncome: 0, skipPay: 0, iou: null, debtMonths: 0,
            pending: null, queue: [], lastEv: 0, lastEvId: '',
            stats: { promos: 0, earned: 0, events: 0, hapSum: 0, hapDays: 0, charity: 0, homes: 0, cars: 0, firms: 0, bestMonth: 0, paidOff: 0, peakNw: 0, nwHist: [] },
            timeline: [], legacy: 0, final: null, seenIntro: true,
            speed: 1, tab: 'life',
            // 2.0 market & business
            mkt: { reg: 'calm', regD: 120, sec: {}, news: [], orders: [], qty: 1, amt: 1000, view: 'stocks', sel: 'NVDA', csel: 'BITB', filt: 'all', range: 1,
                   buys: 0, sells: 0, real: 0, divs: 0, fees: 0, fills: 0, stops: 0, best: 0, x2: false, crashes: 0, dh: 0, held: false },
            bank: { sav: 0, min: 0, rate: 0.5, bonds: [], int: 0, bought: 0 },
            firms: [], ach: {}, achNew: false, bizNew: false
        };
    }

    // fill in any fields missing from older/newer saves so the game never crashes on load
    function fixLife(o) {
        const d = newLifeState();
        for (const k in d) if (o[k] === undefined) o[k] = d[k];
        for (const k of ['rel', 'stats', 'loans', 'subs', 'cd', 'recent', 'best', 'ownedTypes', 'carTypes', 'mkt', 'bank', 'ach']) {
            if (!o[k] || typeof o[k] !== 'object' || Array.isArray(o[k])) o[k] = d[k];
            for (const kk in d[k]) if (o[k][kk] === undefined) o[k][kk] = d[k][kk];
        }
        const M = o.mkt, B = o.bank;
        if (!REGIMES[M.reg]) M.reg = 'calm';
        if (!M.sec || typeof M.sec !== 'object') M.sec = {};
        for (const k of ['news', 'orders']) if (!Array.isArray(M[k])) M[k] = [];
        M.orders = M.orders.filter(x => x && SDEF[x.id] && ['buy', 'tp', 'sl'].includes(x.k) && x.px > 0 && x.n >= 1);
        if (!TRADE_SIZES.includes(M.qty)) M.qty = 1;
        if (!BANK_AMTS.includes(M.amt)) M.amt = 1000;
        if (!['stocks', 'crypto', 'bank', 'port'].includes(M.view)) M.view = 'stocks';
        if (!SDEF[M.sel] || SDEF[M.sel].sec === 'crypto') M.sel = 'NVDA';
        if (!SDEF[M.csel] || SDEF[M.csel].sec !== 'crypto') M.csel = 'BITB';
        if (M.filt !== 'all' && !SECTORS[M.filt]) M.filt = 'all';
        if (![0, 1, 2, 3].includes(M.range)) M.range = 1;
        for (const k of ['buys', 'sells', 'real', 'divs', 'fees', 'fills', 'stops', 'best', 'crashes', 'dh']) if (!Number.isFinite(+M[k])) M[k] = 0;
        if (!Array.isArray(B.bonds)) B.bonds = [];
        B.bonds = B.bonds.filter(b => b && BONDS[b.k] && b.amt > 0);
        for (const k of ['sav', 'min', 'int', 'bought']) B[k] = Math.max(0, +B[k] || 0);
        B.rate = clamp(+B.rate || 0.5, 0.2, 1);
        if (!Array.isArray(o.stats.nwHist)) o.stats.nwHist = [];
        if (!Array.isArray(o.firms)) o.firms = [];
        o.firms = o.firms.filter(f => f && BIZ[f.t]);
        for (const f of o.firms) fixFirm(f);
        if (!Array.isArray(o.degrees)) o.degrees = [];
        if (!Array.isArray(o.honors)) o.honors = [];
        if (!Array.isArray(o.rel.kids)) o.rel.kids = [];
        if (!Array.isArray(o.rel.pets)) o.rel.pets = [];
        if (!Array.isArray(o.props)) o.props = [];
        if (!Array.isArray(o.queue)) o.queue = [];
        if (!Array.isArray(o.timeline)) o.timeline = [];
        if (o.job && !CAREERS[o.job.c]) o.job = null;
        if (o.school && !PROGRAMS[o.school.id]) o.school = null;
        if (o.car && !CARS[o.car.id]) o.car = null;
        o.props = o.props.filter(p => HOMES[p.id]);
        if (!RENTALS[o.rent]) o.rent = null;
        if (!o.props.some(p => p.live) && !o.rent) o.rent = 'parents';
        if (o.pending && !EVBYID[o.pending.id]) o.pending = null;
        if (![0, 1, 2, 4, 8].includes(o.speed)) o.speed = 1;
        if (!TABS.some(t => t.id === o.tab)) o.tab = 'life';
        o.health = clamp(+o.health || 0, 0, 100); o.happy = clamp(+o.happy || 0, 0, 100);
        return o;
    }

    // Saves from Market & Life 1.x had no life data: turn them into a Corporate career mid-life.
    function migrateOldSave() {
        const o = newLifeState();
        o.phase = 'play'; o.seenIntro = false; o.migrated = true;
        o.age = Math.min(55, 22 + Math.floor((day || 1) / YEAR_DAYS));
        o.yday = (day || 1) % YEAR_DAYS;
        o.school = null; o.degrees = ['hs'];
        if (promotionCount >= 2) o.degrees.push('b_bus');
        if (promotionCount >= 6) o.degrees.push('m_mba');
        const ranks = CAREERS.corporate.ranks;
        const r = Math.min(promotionCount || 0, ranks.length - 1);
        o.job = { c: 'corporate', r: r, perf: (totalWorkCompleted || 0) % 100, days: Math.max(0, day || 0) };
        o.payBonus = Math.max(0, Math.round(((currentSalary || 0) / ranks[r][1] - 1) * 100) / 100);
        o.best = { corporate: r }; o.jobsHeld = 1;
        o.rent = 'studio';
        o.stats.promos = promotionCount || 0;
        o.timeline.push([22, '💼', 'Joined the company as an Intern']);
        if (r > 0) o.timeline.push([o.age, '📈', 'Climbed to ' + ranks[r][0]]);
        return o;
    }

    function initGame() {
        const savedData = localStorage.getItem('marketLifeSave');
        pbScore = parseFloat(localStorage.getItem('lifeScorePB')) || 0;
        pbMoney = parseFloat(localStorage.getItem('netWorthPB')) || 0;

        let data = null;
        try { data = savedData ? JSON.parse(savedData) : null; } catch (e) { data = null; }
        if (data && Array.isArray(data.stocks) && data.indexStock) {
            cash = Number.isFinite(+data.cash) ? +data.cash : 1000; day = +data.day || 1; lifeScore = Math.round(+data.lifeScore || 0);
            stocks = data.stocks; indexStock = data.indexStock;
            hasBiz1 = data.hasBiz1 || false; biz1Level = data.biz1Level || 1;
            hasBiz2 = data.hasBiz2 || false; biz2Level = data.biz2Level || 1;
            totalWorkCompleted = data.totalWorkCompleted || 0;
            promotionCount = data.promotionCount || 0; currentSalary = data.currentSalary || 100;
            if (data.life && typeof data.life === 'object') {
                L = fixLife(data.life);
            } else {
                L = migrateOldSave();
                logMessage('✨ Save upgraded to Life Mode! Your cash, stocks, businesses and scores are kept.', 'boost-alert');
            }
            if (!Number.isFinite(cash)) cash = 0;
            fixMarket();
        } else {
            resetState();
        }
        workProgress = 0;
        buildTabs();
        markDirty();
        setSpeed(L.speed, true);
        updateUI();
        resumeFlow();
    }

    function resetState() {
        const keep = L ? { speed: L.speed, tab: 'life' } : null;
        cash = 1000; day = 1; lifeScore = 0;
        hasBiz1 = false; biz1Level = 1;
        hasBiz2 = false; biz2Level = 1;
        totalWorkCompleted = 0; promotionCount = 0; currentSalary = 100;
        // every life gets a fresh market: all 40 assets are created (with a few years of price history) by fixMarket
        stocks = [];
        indexStock = { id: 'TOP2', name: 'TOP2 Index', price: 450, prevPrice: 450, owned: 0, isIndex: true };
        L = newLifeState();
        if (keep) { L.speed = keep.speed; }
        fixMarket();
    }

    // After loading: re-open whatever screen the player was on (setup, an event, the retirement summary...)
    function resumeFlow() {
        if (L.phase === 'setup') showSetup();
        else if (L.phase === 'retired') showSummary();
        else if (L.pending) showEventModal();
        else if (!L.seenIntro) showIntro();
    }

    function startNewRound() {
        confirmBox('🔄', 'Reset all progress?', 'This starts a brand new life. Your personal bests and Hall of Lives are kept.', 'Reset everything', () => {
            resetState(); saveGame(cash); markDirty(); updateUI(); logMessage("--- DATA RESET ---"); showSetup();
        });
    }

    let lastSave = 0;
    function saveGame(currentNetWorth) {
        L.v = SAVE_VERSION;
        lastSave = performance.now();
        const saveData = { cash, day, lifeScore, stocks, indexStock, hasBiz1, biz1Level, hasBiz2, biz2Level, totalWorkCompleted, promotionCount, currentSalary, v: SAVE_VERSION, life: L };
        try { localStorage.setItem('marketLifeSave', JSON.stringify(saveData)); } catch (e) {}
        if (lifeScore > pbScore) { pbScore = lifeScore; try { localStorage.setItem('lifeScorePB', pbScore); } catch (e) {} }
        if (currentNetWorth > pbMoney) { pbMoney = currentNetWorth; try { localStorage.setItem('netWorthPB', pbMoney); } catch (e) {} }
    }

    // ===================== EDUCATION =====================
    function hasTok(t) {
        if (t === 'bach' || t === 'assoc' || t === 'grad') return L.degrees.some(d => PROGRAMS[d] && PROGRAMS[d].lvl === t);
        return L.degrees.includes(t);
    }
    function meets(req) { return !req || !req.length || req.some(hasTok); }
    function tokName(t) {
        if (t === 'bach') return "any Bachelor's";
        if (t === 'assoc') return "any Associate's";
        if (t === 'grad') return 'a graduate degree';
        return PROGRAMS[t] ? PROGRAMS[t].name : t;
    }
    function reqText(req) { return !req || !req.length ? 'No degree needed' : req.map(tokName).join(' or '); }
    function inSchool() { return !!L.school; }

    function canEnroll(id) {
        const P = PROGRAMS[id];
        if (id === 'hs' || L.school || L.degrees.includes(id)) return false;
        if (!meets(P.req)) return false;
        if (P.minHealth && L.health < P.minHealth) return false;
        return true;
    }
    function enroll(id, useLoan) {
        const P = PROGRAMS[id];
        if (!P || !canEnroll(id) || L.phase !== 'play') return;
        if (!useLoan && P.cost > cash) return;
        // community college credits transfer: a Bachelor's after an Associate's takes two years, not four
        const transfer = P.lvl === 'bach' && P.school === 'University' && hasTok('assoc');
        const yrs = transfer ? Math.max(2, P.years - 2) : P.years;
        L.school = { id, d: 0, total: yrs * YEAR_DAYS, years: yrs, gpa: L.trait === 'brainy' ? 3.4 : 3.0, loan: !!useLoan, paid: 0, transfer };
        if (transfer) logMessage(`📘 Your community college credits transfer: you start as a junior (${yrs} years to go).`, 'boost-alert');
        if (L.loans.student) L.loans.student.n = 0; // payments pause while you are a student
        chargeTuition();
        logMessage(`🎓 Enrolled: ${P.name} (${L.school.years} yr${L.school.years > 1 ? 's' : ''})`, 'boost-alert');
        toast(`${P.icon} Enrolled in ${P.name}!`, 'good');
        addTimeline(P.icon, 'Started ' + P.name);
        if (L.job) logMessage('Your job is part-time while you study (half pay, slower promotions).');
        changed();
    }
    function chargeTuition() {
        const s = L.school, P = PROGRAMS[s.id];
        if (!P.cost) return;
        if (s.rotc) { logMessage(`⭐ ROTC scholarship covered this year's tuition (${money(P.cost)})`, 'boost-alert'); return; }
        if (giBill()) { logMessage(`🪖 The GI Bill covered this year's tuition (${money(P.cost)})`, 'boost-alert'); return; }
        if (s.loan) {
            const l = L.loans.student || (L.loans.student = { bal: 0, pay: 0, n: 0, rate: STUDENT_LOAN.rate, label: 'Student Loan' });
            l.bal += P.cost; l.n = 0; l.pay = 0;
            logMessage(`🎓 Tuition ${money(P.cost)} added to your student loan`, 'tax-alert');
        } else {
            cash -= P.cost;
            logMessage(`🎓 Tuition paid: -${money(P.cost)}`, 'tax-alert');
        }
        s.paid += P.cost;
    }
    function startLoanRepayment() {
        const l = L.loans.student;
        if (!l || l.bal <= 0 || L.school) return;
        l.n = STUDENT_LOAN.n; l.pay = loanPayment(l.bal, l.rate, l.n);
        logMessage(`🏦 Student loan repayment starts: ${money(l.pay)}/mo for ${l.n} months`, 'tax-alert');
    }
    function schoolDay() {
        const s = L.school; if (!s) return;
        s.d++;
        let drift = L.job ? -0.0012 : 0.0006;
        if (L.style === 0) drift += 0.0015; else if (L.style === 2) drift -= 0.004;
        if (L.happy < 30) drift -= 0.003;
        s.gpa = clamp(s.gpa + drift, 0, 4);
        if (s.d >= s.total) graduate();
        else if (s.d % YEAR_DAYS === 0) chargeTuition();
    }
    // ROTC: join while studying for a Bachelor's. Tuition is free from then on; in return you serve as an officer.
    function joinRotc() {
        const s = L.school; if (!s || s.rotc || PROGRAMS[s.id].lvl !== 'bach' || PROGRAMS[s.id].school !== 'University') return;
        if (L.health < 50) { toast('ROTC needs health 50+', 'bad'); return; }
        s.rotc = true; boostHealth(3);
        logMessage('⭐ Joined ROTC: tuition is covered, and you will be commissioned as an officer when you graduate.', 'boost-alert');
        toast('⭐ You joined ROTC!', 'good'); addTimeline('⭐', 'Joined ROTC'); changed();
    }
    function offerAfterGrad(id, wasRotc) {
        const P = PROGRAMS[id];
        if (COMMISSION.includes(id) || wasRotc) {
            const go = () => { hire('officer', startRank('officer'), 0); changed(); };
            if (canJoin('officer') && !(L.job && L.job.c === 'officer')) setTimeout(() => confirmBox('🎖️', 'Commissioned!', `You are now a <b>Second Lieutenant</b>. Report for duty as an officer (${money(CAREERS.officer.ranks[startRank('officer')][1])}/wk, health insurance included)?`, 'Report for duty', go), 400);
            return;
        }
        const m = MASTERS_FOR[id];
        if (P.lvl === 'bach' && m && !L.degrees.includes(m) && canEnroll(m)) {
            const M = PROGRAMS[m], free = !M.cost || giBill();
            setTimeout(() => confirmBox(M.icon, "Stay for a master's?", `You could go straight on to a <b>${M.name}</b> (${M.years} years, ${free ? 'free' + (giBill() ? ' with the GI Bill' : '') : money(M.cost) + '/yr'}). It unlocks better jobs: ${M.unlocks.join(', ') || 'higher pay'}.`, 'Enroll', () => enroll(m, !free && cash < M.cost)), 400);
        }
    }
    function graduate() {
        const s = L.school, P = PROGRAMS[s.id];
        if (s.gpa < 2.0) {
            s.d = Math.max(0, s.total - YEAR_DAYS); s.gpa = 2.3;
            logMessage(`📉 GPA too low to graduate! You must repeat your final year of ${P.school}.`, 'tax-alert');
            toast('GPA too low: repeating the final year', 'bad');
            chargeTuition();
            return;
        }
        const honors = s.gpa >= 3.5;
        L.degrees.push(s.id);
        if (s.rotc && !L.degrees.includes('rotc')) L.degrees.push('rotc');
        if (honors) L.honors.push(s.id);
        const pts = Math.round(P.score * (honors ? 1.25 : 1));
        addScore(pts); boostHappy(12);
        L.school = null;
        logMessage(`🎓 GRADUATED: ${P.name}${honors ? ' with honors' : ''}! +${pts} Life Score`, 'boost-alert');
        toast(`🎓 You earned your ${P.name}${honors ? ' with honors!' : '!'}`, 'good');
        addTimeline('🎓', `Graduated: ${P.name}${honors ? ' (honors)' : ''}`);
        startLoanRepayment();
        offerAfterGrad(s.id, !!s.rotc);
        markDirty();
    }
    function dropOut() {
        if (!L.school || L.school.id === 'hs') return;
        const P = PROGRAMS[L.school.id];
        confirmBox('🚪', 'Drop out?', `You will lose your progress in ${P.name}. Any student loan stays.`, 'Drop out', () => {
            L.school = null; boostHappy(-8);
            logMessage(`🚪 Dropped out of ${P.name}`, 'tax-alert');
            addTimeline('🚪', 'Dropped out of ' + P.name);
            startLoanRepayment(); changed();
        });
    }
    function doStudy() {
        if (!L.school || L.phase !== 'play') return;
        studyProgress += 12.5;
        if (studyProgress >= 100) {
            studyProgress = 0;
            const g = L.trait === 'brainy' ? 0.075 : 0.05;
            L.school.gpa = clamp(L.school.gpa + g, 0, 4);
            boostHappy(-0.2);
            logMessage(`📖 Studied hard: GPA ${L.school.gpa.toFixed(2)}`);
        }
        updateUI();
    }

