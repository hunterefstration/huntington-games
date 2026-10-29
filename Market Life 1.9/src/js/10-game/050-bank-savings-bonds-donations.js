    // ---------- bank: savings, bonds, donations ----------
    function savRate() { return Math.max(0.05, Math.round((L.bank.rate - 0.25) * 100) / 100); }
    function bondRate(k) { return Math.round((L.bank.rate + BONDS[k].prem) * 100) / 100; }
    function bondValue() { let v = 0; for (const b of L.bank.bonds) v += b.amt; return v; }
    function bankAmt(max) { const a = L.mkt.amt; return Math.floor(Math.max(0, a ? Math.min(a, max) : max)); }
    function deposit() {
        const a = bankAmt(cash); if (a < 1 || L.phase !== 'play') return;
        cash -= a; L.bank.sav += a;
        logMessage(`🏦 Deposited ${money(a)} into savings (earns interest from next month)`);
        changed();
    }
    function withdraw() {
        const B = L.bank; let a = bankAmt(B.sav);
        if (a >= Math.floor(B.sav)) a = B.sav;
        if (a <= 0) return;
        B.sav = Math.max(0, B.sav - a); B.min = Math.min(B.min, B.sav); cash += a;
        logMessage(`🏦 Withdrew ${money(a, 2)} from savings`);
        changed();
    }
    function buyBond(k) {
        const D = BONDS[k]; if (!D || L.phase !== 'play' || L.bank.bonds.length >= MAX_BONDS) return;
        const a = bankAmt(cash); if (a < BOND_MIN) return;
        cash -= a;
        L.bank.bonds.push({ k, amt: a, rate: bondRate(k), d0: day, last: day, end: day + D.days, paid: 0 });
        L.bank.bought++;
        logMessage(`${D.icon} Bought a ${D.name}: ${money(a)} at ${bondRate(k).toFixed(2)}%/mo`, 'boost-alert');
        toast(`${D.icon} Bond bought: ${money(a)}`, 'good');
        changed();
    }
    function sellBond(i) {
        const b = L.bank.bonds[+i]; if (!b) return;
        const back = Math.round(b.amt * (1 - BOND_EARLY));
        confirmBox(BONDS[b.k].icon, 'Sell this bond early?', `You get <b>${money(back)}</b> back (a ${BOND_EARLY * 100}% penalty on ${money(b.amt)}) and stop earning ${b.rate.toFixed(2)}%/mo.`, 'Sell the bond', () => {
            const j = L.bank.bonds.indexOf(b); if (j < 0) return;
            L.bank.bonds.splice(j, 1); cash += back;
            logMessage(`📜 Sold your ${BONDS[b.k].name} early for ${money(back)}`);
            changed();
        });
    }
    function bondCoupon(b, upTo) {
        const to = Math.min(upTo, b.end), days = Math.max(0, to - b.last);
        b.last = Math.max(b.last, to);
        const c = b.amt * b.rate / 100 * days / 30;
        b.paid += c;
        return c;
    }
    function bondsDay() {
        const B = L.bank;
        for (let i = B.bonds.length - 1; i >= 0; i--) {
            const b = B.bonds[i]; if (day < b.end) continue;
            const c = bondCoupon(b, b.end);
            B.bonds.splice(i, 1);
            cash += b.amt + c; B.int += c; L.monthIncome += c;
            logMessage(`📜 Your ${BONDS[b.k].name} matured: +${money(b.amt + c)} back`, 'salary-alert');
            dirty.market = true;
        }
    }
    // with the monthly bills: savings interest (on the lowest balance this month) and bond interest
    function bankMonth() {
        const B = L.bank;
        const si = Math.round(Math.min(B.min, B.sav) * savRate()) / 100;
        B.sav += si; B.int += si; B.min = B.sav;
        let cp = 0;
        for (let i = B.bonds.length - 1; i >= 0; i--) {
            const b = B.bonds[i], D = BONDS[b.k];
            if (D.risk && Math.random() < D.risk) {
                const back = Math.round(b.amt * 0.4);
                B.bonds.splice(i, 1); cash += back;
                logMessage(`💥 The company behind your ${D.name} went bust! You got back ${money(back)} of ${money(b.amt)}.`, 'tax-alert');
                toast('💥 One of your bonds defaulted', 'bad');
                continue;
            }
            cp += bondCoupon(b, day);
        }
        cp = Math.round(cp * 100) / 100;
        cash += cp; B.int += cp;
        L.monthIncome += si + cp;
        if (si + cp >= 0.01) logMessage(`🏦 INTEREST: +${money(si + cp, 2)}${si && cp ? ` (savings ${money(si, 2)}, bonds ${money(cp, 2)})` : ''}`, 'salary-alert');
        if (si + cp > 0) dirty.market = true;
    }
    // once a year the central bank moves interest rates; banks like hikes, growth stocks do not
    function rateYear() {
        const B = L.bank, old = B.rate;
        B.rate = clamp(Math.round((B.rate + pick([-0.1, -0.05, 0, 0, 0.05, 0.1])) * 100) / 100, 0.2, 1);
        if (B.rate === old) return;
        const up = B.rate > old;
        for (const s of stocks) { const k = secOf(s); if (STOCK_SECTORS.includes(k)) s.trend += (k === 'finance' ? 1 : -1) * (up ? 0.003 : -0.003); }
        addNews('🏛️', `Central bank ${up ? 'raises' : 'cuts'} interest rates to ${B.rate.toFixed(2)}%/mo`, up ? -1 : 1, '*');
    }
    function donate() {
        const a = bankAmt(cash); if (a < 10 || L.phase !== 'play') return;
        const pts = Math.round(a * 0.15);
        confirmBox('🤝', 'Donate to charity?', `Give <b>${money(a)}</b> to a good cause. You get +${num(pts)} Life Score and feel great.`, 'Donate', () => {
            if (cash < a) return;
            cash -= a; L.stats.charity += a; addScore(pts); boostHappy(Math.min(12, 3 + a / 1000));
            logMessage(`🤝 Donated ${money(a)} to charity. +${num(pts)} Life Score`, 'life-alert');
            addTimeline('🤝', `Donated ${money(a)} to charity`);
            changed();
        });
    }
    // when the bank has to step in: sell investments before anything else
    function liquidate() {
        let raised = L.bank.sav; L.bank.sav = 0; L.bank.min = 0;
        for (const b of L.bank.bonds) raised += Math.round(b.amt * (1 - BOND_EARLY));
        L.bank.bonds = [];
        const sellAll = s => { if (s.owned > 0) { raised += s.owned * s.price * (1 - feeRate(s)); s.owned = 0; s.cost = 0; } };
        sellAll(indexStock);
        for (const s of stocks) sellAll(s);
        L.mkt.orders = [];
        cash += raised;
        return raised;
    }

    // ===================== HEALTH & HAPPINESS =====================
    // Both stats drift toward a target built from your life; purchases and events push them temporarily.
    function healthTarget(out) {
        let t = 0;
        const f = (k, v) => { t += v; if (out && Math.round(v)) out.push([k, Math.round(v)]); };
        t += 82;
        if (L.age > 30) f('Age ' + L.age, -(L.age - 30) * 0.7);
        if (L.trait === 'athletic') f('Athletic', 8);
        if (L.job || L.school) f(STYLES[L.style].name + ' pace', STYLES[L.style].health);
        if (L.subs.gym) f('Gym', 10);
        if (L.subs.meals) f('Healthy meals', 6);
        if (L.rel.pets.some(p => PETS[p.t].dog)) f('Dog walks', 3);
        const C = L.job && CAREERS[L.job.c];
        if (C && C.danger) f('Risky job', -C.danger);
        if (L.happy < 25 && !L.subs.therapy) f('Stress', -6);
        if (crowded()) f('Crowded home', -3);
        return clamp(Math.round(t), 5, 100);
    }
    function happyTarget(out) {
        let t = 0;
        const f = (k, v) => { t += v; if (out && Math.round(v)) out.push([k, Math.round(v)]); };
        t += 46;
        const res = residence();
        if (livingWithParents()) f("Parents' house", L.age < 21 ? 3 : -6);
        else f(res.d.name, res.d.hap);
        if (crowded()) f('Crowded home', -8);
        if (L.car) { f(CARS[L.car.id].name, CARS[L.car.id].hap); if (L.car.cond < 30) f('Car falling apart', -3); if (L.car.id === 'suv' && kidsHome()) f('Room for the kids', 2); }
        else if (L.age >= 18 && (L.job || L.school)) f('Bus commute', -4);
        if (L.job) { f(CAREERS[L.job.c].name + ' job', CAREERS[L.job.c].sat); f(STYLES[L.style].name + ' pace', STYLES[L.style].hap); }
        else if (L.school) f('Student life', 3);
        else if (L.age >= 18) f('Unemployed', -10);
        const R = L.rel;
        if (R.p) {
            const base = R.s === 'married' ? 5 + R.p.love / 12 : R.s === 'engaged' ? 4 + R.p.love / 15 : 3 + R.p.love / 20;
            f(R.s === 'married' ? 'Married' : R.s === 'engaged' ? 'Engaged' : 'Dating', base);
        }
        const kids = R.kids.length; if (kids) f('Kids', Math.min(12, kids * 4));
        const little = R.kids.filter(k => k.age < 5).length; if (little) f('Sleepless nights', -2 * little);
        let pets = 0; for (const p of R.pets) pets += PETS[p.t].hap; if (pets) f('Pets', Math.min(8, pets));
        if (R.friends > 0) f('Friends', Math.min(8, R.friends * 1.5)); else f('Lonely', -5);
        f('Parents', (R.parents - 50) / 10);
        f('Health', (L.health - 60) / 4);
        if (cash < 0) f('Debt', -12);
        if (L.subs.stream) f('Streaming', 3);
        if (L.subs.therapy) f('Therapy', 7);
        const nw = netWorth();
        if (nw >= 1000000) f('Rich', 6); else if (nw >= 100000) f('Comfortable', 3);
        return clamp(Math.round(t), 5, 100);
    }

    // ===================== HOUSING =====================
    function rentHome(id) {
        const R = RENTALS[id];
        if (!R || L.phase !== 'play') return;
        const res = residence();
        if (!res.own && L.rent === id) return;
        if (cash < R.rent) return;
        cash -= R.rent;
        for (const p of L.props) p.live = false;
        L.rent = id;
        boostHappy(id === 'parents' ? -3 : 4);
        logMessage(`📦 Moved into ${R.name}${R.rent ? ` (deposit ${money(R.rent)}, then ${money(R.rent)}/mo)` : ''}`, 'life-alert');
        addTimeline(R.icon, 'Moved into ' + R.name);
        if (res.own) logMessage(`🏠 Your ${res.d.name} is now rented out (+${money(rentIncome(res.p))}/mo)`);
        changed();
    }
    function buyHome(id, mortgage) {
        const H = HOMES[id]; if (!H || L.phase !== 'play' || L.props.length >= MAX_PROPS) return;
        if (L.age < 18) return;
        const price = homePrice(id);
        const down = mortgage ? Math.round(price * MORTGAGE.down) : price;
        if (cash < down) return;
        cash -= down;
        const prev = residence();
        for (const p of L.props) p.live = false;
        L.rent = null;
        L.props.push({ id, value: price, loan: mortgage ? makeLoan(price - down, MORTGAGE, 'Mortgage') : null, live: true, bought: L.age });
        L.stats.homes++;
        let pts = 0;
        if (!L.ownedTypes[id]) { L.ownedTypes[id] = 1; pts = H.score; addScore(pts); }
        boostHappy(12);
        logMessage(`🔑 Bought ${H.name} for ${money(price)}${mortgage ? ` (mortgage ${money(L.props[L.props.length - 1].loan.pay)}/mo)` : ''}${pts ? ` +${pts} Life Score` : ''}`, 'boost-alert');
        toast(`${H.icon} Welcome home! You bought a ${H.name}`, 'good');
        addTimeline(H.icon, 'Bought a ' + H.name);
        if (prev.own) logMessage(`🏠 Your ${prev.d.name} is now rented out (+${money(rentIncome(prev.p))}/mo)`);
        changed();
    }
    function sellProp(i, mult) {
        const p = L.props[i]; if (!p) return;
        const H = HOMES[p.id];
        const price = Math.round(p.value * (mult || 0.94));
        const proceeds = price - (p.loan ? Math.round(p.loan.bal) : 0);
        cash += proceeds;
        L.props.splice(i, 1);
        logMessage(`🏷️ Sold ${H.name} for ${money(price)} (you keep ${money(proceeds)})`, 'salary-alert');
        addTimeline('🏷️', 'Sold the ' + H.name);
        if (p.live) {
            if (L.props.length) { L.props[0].live = true; logMessage(`📦 Moved into your ${HOMES[L.props[0].id].name}`); }
            else { L.rent = L.age >= 25 ? 'studio' : 'parents'; logMessage(`📦 Moved into ${RENTALS[L.rent].name} for now`); }
        }
        markDirty();
    }
    function askSellProp(i) {
        const p = L.props[i]; if (!p) return;
        const price = Math.round(p.value * 0.94), proceeds = price - (p.loan ? Math.round(p.loan.bal) : 0);
        confirmBox(HOMES[p.id].icon, `Sell your ${HOMES[p.id].name}?`, `Sale price ${money(price)} after 6% fees${p.loan ? `, minus the ${money(p.loan.bal)} mortgage` : ''}. You get <b>${money(proceeds)}</b>.${p.live ? ' You will have to move out.' : ''}`, 'Sell', () => { sellProp(i); changed(); });
    }
    function moveIn(i) {
        const p = L.props[i]; if (!p || p.live) return;
        for (const q of L.props) q.live = false;
        p.live = true; L.rent = null;
        logMessage(`📦 Moved into your ${HOMES[p.id].name}`, 'life-alert');
        changed();
    }
    function payMortgage(i) {
        const p = L.props[i]; if (!p || !p.loan || cash < p.loan.bal) return;
        cash -= Math.round(p.loan.bal); p.loan = null; L.stats.paidOff = (L.stats.paidOff || 0) + 1;
        addScore(300);
        logMessage(`🔑 Paid off the mortgage on your ${HOMES[p.id].name}! +300 Life Score`, 'boost-alert');
        addTimeline('🔑', 'Paid off the ' + HOMES[p.id].name);
        changed();
    }

    // ===================== CARS =====================
    function buyCar(id, finance) {
        const C = CARS[id]; if (!C || L.phase !== 'play' || L.age < 16) return;
        if (L.car && L.car.id === id && L.car.cond > 60) return;
        const net = C.price - carEquity();
        const down = finance ? Math.max(0, Math.round(net * CAR_LOAN.down)) : net;
        if (cash < down) return;
        if (L.car) logMessage(`🔁 Traded in your ${CARS[L.car.id].name} (worth ${money(carEquity())})`);
        cash -= down;
        const loanAmt = finance ? Math.max(0, net - down) : 0;
        L.car = { id, value: C.price, cond: 100, loan: loanAmt > 0 ? makeLoan(loanAmt, CAR_LOAN, 'Car loan') : null };
        L.stats.cars++;
        let pts = 0;
        if (!L.carTypes[id]) { L.carTypes[id] = 1; pts = C.score; addScore(pts); }
        boostHappy(8);
        logMessage(`🚗 Bought a ${C.name}${L.car.loan ? ` (loan ${money(L.car.loan.pay)}/mo)` : ''}${pts ? ` +${pts} Life Score` : ''}`, 'boost-alert');
        toast(`${C.icon} You got a ${C.name}!`, 'good');
        addTimeline(C.icon, 'Bought a ' + C.name);
        changed();
    }
    function sellCar() {
        if (!L.car) return;
        const v = carEquity(), n = CARS[L.car.id].name;
        cash += v; L.car = null;
        logMessage(`🏷️ Sold your ${n} for ${money(v)}`, 'salary-alert');
        changed();
    }
    function serviceCar() {
        if (!L.car) return;
        const c = repairCost(); if (cash < c) return;
        cash -= c; L.car.cond = 100;
        logMessage(`🔧 Car serviced: -${money(c)} (condition 100%)`);
        changed();
    }
    function payCarLoan() {
        if (!L.car || !L.car.loan || cash < L.car.loan.bal) return;
        cash -= Math.round(L.car.loan.bal); L.car.loan = null;
        logMessage('🚗 Car loan paid off!', 'boost-alert');
        changed();
    }
    function payStudentLoan() {
        const l = L.loans.student; if (!l || cash < l.bal) return;
        cash -= Math.round(l.bal); L.loans.student = null;
        addScore(200);
        logMessage('🎓 Student loan paid off! +200 Life Score', 'boost-alert');
        addTimeline('🎉', 'Paid off student loans');
        changed();
    }

    // ===================== FAMILY & RELATIONSHIPS =====================
    function newPartner() {
        const job = pick(PARTNER_JOBS);
        L.rel.p = { name: pick(NAMES), love: rint(45, 60), job: job[0], pay: job[1], met: L.age };
        L.rel.s = 'dating';
        addScore(100);
        logMessage(`💕 You started dating ${L.rel.p.name}! +100 Life Score`, 'life-alert');
        addTimeline('💕', 'Started dating ' + L.rel.p.name);
        markDirty();
    }
    function findDate() {
        if (L.rel.s !== 'single' || cash < 40 || !cdReady('findDate')) return;
        cash -= 40; setCd('findDate', 8);
        let p = 0.3 + L.happy / 250 + charm() + (L.car && CARS[L.car.id].hap >= 10 ? 0.1 : L.car && CARS[L.car.id].hap >= 5 ? 0.05 : 0) + (L.props.some(x => x.live) ? 0.05 : 0);
        if (Math.random() < p) { newPartner(); toast(`💕 It's a match! You are dating ${L.rel.p.name}`, 'good'); }
        else { boostHappy(-2); logMessage('💔 The date was a dud. Try again in a few days.'); toast('The date was a dud...', 'bad'); }
        changed();
    }
    function dateNight() {
        const p = L.rel.p; if (!p || cash < 80 || !cdReady('date')) return;
        cash -= 80; setCd('date', 6);
        p.love = clamp(p.love + (L.trait === 'charming' ? 11 : 8), 0, 100); boostHappy(3);
        logMessage(`🍝 Date night with ${p.name}: love ${Math.round(p.love)}`, 'life-alert');
        changed();
    }
    function propose() {
        const p = L.rel.p; if (!p || L.rel.s !== 'dating' || L.age < 18 || cash < 1500) return;
        cash -= 1500;
        if (Math.random() < p.love / 100 + charm()) engage(true);
        else { cash += 1200; p.love = Math.max(0, p.love - 15); boostHappy(-8); logMessage(`💔 ${p.name} said "not yet". You returned the ring (+$1,200).`, 'tax-alert'); toast('They said not yet...', 'bad'); }
        changed();
    }
    function engage(you) {
        const p = L.rel.p;
        L.rel.s = 'engaged'; p.love = clamp(p.love + 10, 0, 100);
        addScore(300); boostHappy(12);
        logMessage(`💍 ${you ? `${p.name} said YES!` : `You said YES to ${p.name}!`} You are engaged. +300 Life Score`, 'life-alert');
        toast('💍 Engaged!', 'good');
        addTimeline('💍', 'Got engaged to ' + p.name);
        markDirty();
    }
    function wedding(big) {
        const p = L.rel.p; if (!p || L.rel.s !== 'engaged') return;
        const cost = big ? 8000 : 2000; if (cash < cost) return;
        cash -= cost;
        L.rel.s = 'married';
        const pts = big ? 1500 : 1000; addScore(pts);
        boostHappy(big ? 25 : 15); p.love = clamp(p.love + (big ? 20 : 10), 0, 100);
        logMessage(`💒 You married ${p.name}! +${pts} Life Score. ${p.name}'s ${money(p.pay)}/wk salary now joins your household.`, 'life-alert');
        toast(`💒 Just married! ${big ? 'What a party!' : ''}`, 'good');
        addTimeline('💒', 'Married ' + p.name);
        changed();
    }
    function haveBaby(name, age) {
        const k = { name: name || pick(NAMES), age: age || 0, cd: 0, grown: false };
        L.rel.kids.push(k);
        addScore(800); boostHappy(15);
        if (L.rel.p) L.rel.p.love = clamp(L.rel.p.love + 5, 0, 100);
        logMessage(`👶 Welcome, ${k.name}! +800 Life Score`, 'life-alert');
        toast(`👶 ${k.name} joined the family!`, 'good');
        addTimeline('👶', (age ? 'Adopted ' : 'Welcomed baby ') + k.name);
        markDirty();
    }
    function canHaveBaby() { return (L.rel.s === 'married' || L.rel.s === 'engaged') && L.age >= 18 && L.age <= 45 && !livingWithParents() && L.rel.kids.length < 6; }
    function tryBaby() {
        if (!canHaveBaby() || !cdReady('baby')) return;
        setCd('baby', 20);
        if (luck(0.5)) haveBaby();
        else { logMessage('🍼 No baby news yet. Try again later.'); toast('Not this time...'); }
        changed();
    }
    function adoptKid() {
        if (L.rel.s !== 'married' || L.age < 25 || L.age > 55 || cash < 3000 || !cdReady('adopt') || livingWithParents() || L.rel.kids.length >= 6) return;
        cash -= 3000; setCd('adopt', 30);
        haveBaby(pick(NAMES), rint(1, 6));
        changed();
    }
    function endRelationship() {
        const p = L.rel.p; if (!p) return;
        if (L.rel.s === 'married') {
            const loss = Math.max(0, Math.round(cash * 0.35));
            cash -= loss; boostHappy(-20);
            logMessage(`💔 Divorced ${p.name}. Lawyers and the settlement cost ${money(loss)}.`, 'tax-alert');
            addTimeline('💔', 'Divorced ' + p.name);
        } else {
            boostHappy(-10);
            logMessage(`💔 You and ${p.name} broke up.`, 'tax-alert');
            addTimeline('💔', 'Broke up with ' + p.name);
        }
        L.rel.p = null; L.rel.s = 'single';
        markDirty();
    }
    function askBreakUp() {
        const p = L.rel.p; if (!p) return;
        confirmBox('💔', L.rel.s === 'married' ? 'File for divorce?' : `Break up with ${esc(p.name)}?`, L.rel.s === 'married' ? 'A divorce costs 35% of your cash and a lot of happiness.' : 'You will be single again.', L.rel.s === 'married' ? 'Divorce' : 'Break up', () => { endRelationship(); changed(); });
    }
    function playKid(i) {
        const k = L.rel.kids[i]; if (!k || k.grown || day < (k.cd || 0)) return;
        k.cd = day + 10; boostHappy(4); addScore(10);
        logMessage(`🧸 You spent the afternoon with ${k.name}`, 'life-alert');
        changed();
    }
    function visitParents() {
        if (!cdReady('visit')) return;
        setCd('visit', 12);
        L.rel.parents = clamp(L.rel.parents + 12, 0, 100); boostHappy(3);
        logMessage('👪 You visited Mom and Dad', 'life-alert');
        changed();
    }
    function askParents() {
        if (!cdReady('askParents') || L.age >= 30 || L.rel.parents < 40) return;
        setCd('askParents', YEAR_DAYS);
        const amt = rint(2, 8) * 50;
        cash += amt; L.rel.parents = clamp(L.rel.parents - 8, 0, 100);
        logMessage(`👪 Your parents lent a hand: +${money(amt)}`, 'salary-alert');
        changed();
    }
    function friendsAdd(n) { L.rel.friends = clamp(L.rel.friends + n, 0, 10); }
    function hangOut() {
        if (cash < 30 || !cdReady('hang')) return;
        cash -= 30; setCd('hang', 5); boostHappy(4);
        if (Math.random() < 0.25 && L.rel.friends < 10) { friendsAdd(1); logMessage('🤝 You made a new friend!', 'life-alert'); }
        else logMessage('🍔 Hung out with friends');
        changed();
    }
    function party() {
        if (cash < 300 || !cdReady('party')) return;
        cash -= 300; setCd('party', 30); boostHappy(8); boostHealth(-2);
        const n = rint(1, 2); friendsAdd(n);
        logMessage(`🎉 You threw a party! +${n} friend${n > 1 ? 's' : ''}`, 'life-alert');
        changed();
    }
    function addPet(t, name, free) {
        const P = PETS[t]; if (!P || L.rel.pets.length >= MAX_PETS) return false;
        if (P.needHome && !L.props.length) return false;
        if (!free) { if (cash < P.price) return false; cash -= P.price; }
        const pet = { t, name: name || pick(PET_NAMES), age: 0 };
        L.rel.pets.push(pet);
        addScore(P.score); boostHappy(6);
        logMessage(`${P.icon} ${pet.name} the ${P.name} joined the family! +${P.score} Life Score`, 'life-alert');
        addTimeline(P.icon, `Adopted ${pet.name} the ${P.name}`);
        markDirty();
        return true;
    }
    function adoptPet(t) { if (addPet(t)) changed(); }

