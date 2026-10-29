    // ===================== DAILY / YEARLY LIFE =====================
    function lifeDay() {
        // collapsed from overwork, illness or injuries: checked before the daily recovery
        if (L.health < 5) queueEvent('hospital', { cost: Math.round(1500 * (1 + L.age / 40)) });
        schoolDay();
        if (L.job) { L.job.days++; L.job.perf = Math.min(100, L.job.perf + perfGain()); checkPromotion(); if (CAREERS[L.job.c].mil) { L.milDays = (L.milDays || 0) + 1; if (L.milDays === 3 * YEAR_DAYS) { logMessage('🪖 Three years of service: the GI Bill now pays your tuition.', 'boost-alert'); toast('🪖 GI Bill earned: free tuition', 'good'); } } }
        L.health = clamp(L.health + (healthTarget() - L.health) * 0.02, 0, 100);
        L.happy = clamp(L.happy + (happyTarget() - L.happy) * 0.03, 0, 100);
        L.stats.hapSum += L.happy; L.stats.hapDays++;
        const R = L.rel;
        if (R.p) {
            let decay = 0.06 * STYLES[L.style].love * (L.trait === 'charming' ? 0.6 : 1);
            if (L.happy > 65) decay -= 0.04;
            R.p.love = clamp(R.p.love - decay, 0, 100);
            if (R.p.love <= 0) { endRelationship(); toast('💔 Your relationship fell apart', 'bad'); }
        }
        R.parents = clamp(R.parents - 0.02, 0, 100);
        if (L.car) L.car.cond = Math.max(0, L.car.cond - CARS[L.car.id].wear);
        if (L.health < 25 && Math.random() < 0.05) {
            if (L.job) L.job.perf = Math.max(0, L.job.perf - 3);
            logMessage('🤒 You called in sick. Low health slows you down.', 'tax-alert');
        }
        if (L.iou && day >= L.iou.due) {
            if (L.iou.ok) { const back = Math.round(L.iou.amt * 1.25); cash += back; logMessage(`🤲 Vinny paid you back ${money(back)} with interest!`, 'salary-alert'); }
            else logMessage(`🤲 Vinny's food truck went under. Your ${money(L.iou.amt)} is gone.`, 'tax-alert');
            L.iou = null;
        }
        L.yday++;
        if (L.yday >= YEAR_DAYS) { L.yday = 0; birthday(); }
        if (L.phase === 'play') maybeEvent();
    }

    function birthday() {
        L.age++;
        rateYear();
        const bonus = Math.round((L.health + L.happy) / 4);
        addScore(bonus);
        logMessage(`🎂 Happy birthday! You are ${L.age}. +${bonus} Life Score`, 'boost-alert');
        // housing market moves once a year
        const ch = rnd(-0.05, 0.09);
        L.hTrend = ch; L.hIdx *= 1 + ch;
        for (const p of L.props) p.value = Math.round(p.value * (1 + ch + rnd(-0.02, 0.02)));
        if (L.props.length) logMessage(`🏠 Housing market ${ch >= 0 ? 'up' : 'down'} ${Math.abs(ch * 100).toFixed(1)}% this year`);
        if (L.car) L.car.value = Math.round(L.car.value * 0.88);
        L.rel.kids.forEach((k, i) => { k.age++; if (k.age === 18 && !k.grown) queueEvent('kidGrown', { i, name: k.name, cost: 4000 }); });
        for (let i = L.rel.pets.length - 1; i >= 0; i--) {
            const pet = L.rel.pets[i]; pet.age++;
            if (pet.age >= PETS[pet.t].life) {
                L.rel.pets.splice(i, 1); boostHappy(-8);
                logMessage(`🌈 ${pet.name} lived a long, happy life and crossed the rainbow bridge.`, 'life-alert');
                addTimeline('🌈', `Said goodbye to ${pet.name}`);
            }
        }
        const C = L.job && CAREERS[L.job.c];
        if (C && C.endAge && L.age >= C.endAge) {
            addScore(300 * L.job.r);
            loseJob('Retired from pro sports');
            toast('🏅 Your sports career is over. Time for a new career!');
        }
        if (L.age === 18) toast('🎉 You are 18! More careers and schools are open to you.', 'good');
        if (L.age >= RETIRE_AGE) { retire(false); return; }
        if (L.age >= RETIRE_AGE - 3) toast(`🎂 ${L.age}! ${RETIRE_AGE - L.age} year${RETIRE_AGE - L.age > 1 ? 's' : ''} until retirement`);
        else toast(`🎂 Happy ${L.age}th birthday! +${bonus} Life Score`);
        markDirty();
    }

    // ===================== RETIREMENT & HALL OF LIVES =====================
    function loadHall() { try { const h = JSON.parse(localStorage.getItem('marketLifeHall') || '[]'); return Array.isArray(h) ? h : []; } catch (e) { return []; } }
    function bestCareer() {
        let best = null, bestPay = -1;
        for (const c in L.best) { const C = CAREERS[c]; if (!C) continue; const r = Math.min(L.best[c], C.ranks.length - 1); if (C.ranks[r][1] > bestPay) { bestPay = C.ranks[r][1]; best = { c, r }; } }
        return best;
    }
    function retireBonuses(nw) {
        const b = {};
        b.wealth = Math.min(12000, Math.round(3000 * Math.log10(1 + Math.max(0, nw) / 1000)));   // caps at $10M
        let career = 0;
        for (const c in L.best) { const C = CAREERS[c]; if (!C) continue; const v = L.best[c] * 400 + (L.best[c] >= C.ranks.length - 1 ? 2000 : 0); if (v > career) career = v; }
        b.career = career;
        b.education = L.degrees.length * 200;
        b.family = (L.rel.s === 'married' ? 1500 : 0) + L.rel.kids.length * 1000 + L.rel.pets.length * 200 + L.rel.friends * 50;
        const avg = L.stats.hapDays ? L.stats.hapSum / L.stats.hapDays : L.happy;
        b.avgHappy = Math.round(avg);
        b.wellbeing = Math.round(avg * 30 + L.health * 10);
        return b;
    }
    function retire(early) {
        if (L.phase !== 'play') return;
        const nw = netWorth();
        const b = retireBonuses(nw);
        const before = lifeScore;
        const bonus = b.wealth + b.career + b.education + b.family + b.wellbeing;
        addScore(bonus);
        const bc = bestCareer();
        L.final = {
            score: lifeScore, before, b, nw: Math.round(nw), age: L.age, early: !!early,
            title: L.job ? jobTitle() : (bc ? CAREERS[bc.c].ranks[bc.r][0] : 'a free spirit'),
            pb: lifeScore > pbScore, prevPb: pbScore
        };
        L.phase = 'retired';
        L.pending = null; L.queue = [];
        L.legacy = Math.min(5000, Math.round(Math.max(0, nw) * 0.05));
        addTimeline('🏖️', early ? 'Retired early' : 'Retired');
        const hall = loadHall();
        hall.push({ n: L.name, a: L.avatar, s: lifeScore, w: Math.round(nw), t: L.final.title, age: L.age });
        hall.sort((x, y) => y.s - x.s);
        try { localStorage.setItem('marketLifeHall', JSON.stringify(hall.slice(0, 10))); } catch (e) {}
        logMessage(`🏆 RETIRED at ${L.age}! Final Life Score: ${num(lifeScore)}`, 'boost-alert');
        saveGame(nw);
        markDirty();
        updateUI();
        showSummary();
    }
    function askRetire() {
        if (L.age < EARLY_RETIRE_AGE || L.phase !== 'play') return;
        confirmBox('🏖️', 'Retire early?', 'Your life ends here and you get your final Life Score summary. You cannot undo this.', 'Retire now', () => retire(true));
    }

    // ===================== MODALS & TOASTS =====================
    let confirmFn = null;
    function openModal(html, wide) {
        const box = $('modal-box');
        box.className = 'modal-box' + (wide ? ' wide' : '');
        box.innerHTML = html;
        $('modal').classList.remove('hidden');
        modalOpen = true;
        box.scrollTop = 0;
        updateSpeedUI();
    }
    function closeModal() {
        $('modal').classList.add('hidden');
        $('modal-box').innerHTML = '';
        modalOpen = false; confirmFn = null;
        updateSpeedUI();
        if (L.phase === 'retired') showSummary();
        else if (L.phase === 'setup') showSetup();
        else if (L.pending) showEventModal();
    }
    function confirmBox(icon, title, text, yes, fn) {
        confirmFn = fn;
        openModal(`<div class="ev-icon">${icon}</div><h2>${title}</h2><p class="center">${text}</p><div class="choices"><button class="choice" data-act="confirmYes">${yes}</button><button class="choice" data-act="modalOk">Cancel</button></div>`);
    }
    function confirmYes() { const f = confirmFn; confirmFn = null; $('modal').classList.add('hidden'); modalOpen = false; if (f) f(); if (!modalOpen) closeModal(); }
    function toast(msg, kind) {
        const box = $('toasts');
        while (box.children.length >= 3) box.removeChild(box.firstChild);
        const t = document.createElement('div');
        t.className = 'toast' + (kind ? ' ' + kind : '');
        t.textContent = msg;
        box.appendChild(t);
        setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 3500);
    }

    let setupSel = { avatar: '🧑', trait: 'brainy' };
    function showSetup() {
        setupSel = { avatar: L.avatar || '🧑', trait: L.trait || 'brainy' };
        const legacy = L.legacy || 0;
        let h = `<div class="ev-icon">🌱</div><h2>A New Life Begins</h2>
            <p class="center muted">You are 16, starting your last two years of high school with ${money(1000 + legacy)} in the bank${legacy ? ` (including a <b class="gold">${money(legacy)}</b> family legacy)` : ''}.
            Study, work, fall in love, buy a home, play the market, and retire at ${RETIRE_AGE} with the best Life Score you can.</p>
            <label class="lbl" for="setup-name">Your name</label><input id="setup-name" maxlength="16" autocomplete="off" value="${esc(pick(NAMES))}">
            <label class="lbl">Look</label><div class="avatars">`;
        for (const a of AVATARS) h += `<button class="av-pick ${a === setupSel.avatar ? 'on' : ''}" data-act="pickAvatar" data-arg="${a}">${a}</button>`;
        h += `</div><label class="lbl">Talent</label><div class="traits">`;
        for (const t in TRAITS) h += `<button class="trait ${t === setupSel.trait ? 'on' : ''}" data-act="pickTrait" data-arg="${t}"><b>${TRAITS[t].icon} ${TRAITS[t].name}</b><small>${TRAITS[t].desc}</small></button>`;
        h += `</div><button class="btn big" data-act="startLife">Start my life ▶</button>`;
        openModal(h, true);
    }
    function pickSetup(kind, v, cls) {
        setupSel[kind] = v;
        document.querySelectorAll('#modal-box .' + cls).forEach(b => b.classList.toggle('on', b.dataset.arg === v));
    }
    function startLife() {
        const inp = $('setup-name');
        const name = (inp && inp.value.trim().slice(0, 16)) || pick(NAMES);
        const legacy = L.phase === 'setup' ? (L.legacy || 0) : 0;
        resetState();
        L.name = name; L.avatar = setupSel.avatar; L.trait = TRAITS[setupSel.trait] ? setupSel.trait : '';
        L.phase = 'play';
        if (L.trait === 'brainy') L.school.gpa = 3.4;
        if (L.trait === 'athletic') L.health = 90;
        cash += legacy;
        addTimeline('🌱', `${name} started junior year of high school`);
        if (legacy) logMessage(`💎 Family legacy: +${money(legacy)}`, 'salary-alert');
        hire('retail', 0, 0, true);
        logMessage(`🌱 Welcome, ${name}! You are 16 with a part-time job at the store.`, 'boost-alert');
        $('modal').classList.add('hidden'); modalOpen = false;
        markDirty(); setTab('life'); updateSpeedUI(); updateUI();
        toast('🌱 Your life begins! Check the tabs to plan your future.', 'good');
    }
    function showIntro() {
        L.seenIntro = true;
        openModal(`<div class="ev-icon">✨</div><h2>Market & Life 2.0: Life Mode</h2>
            <p class="center">Your save was upgraded. You are <b>${L.age}</b> and working as <b>${jobTitle()}</b>. Your cash, stocks, businesses, Life Score and personal bests are all kept.</p>
            <div class="chips center">
                <span class="chip">🎓 High school, college, trade &amp; grad school</span><span class="chip">💼 14 careers with promotion ladders</span>
                <span class="chip">🏠 Rent or buy homes with mortgages</span><span class="chip">🚗 Cars</span><span class="chip">❤️ Dating, marriage, kids &amp; pets</span>
                <span class="chip">🩺 Health &amp; happiness</span><span class="chip">🎲 Life events with choices</span><span class="chip">🏖️ Retire at ${RETIRE_AGE} for a final Life Score</span>
            </div>
            <button class="btn big" data-act="modalOk">Let's go!</button>`);
    }
    function showSummary() {
        const F = L.final; if (!F) { L.phase = 'setup'; showSetup(); return; }
        const b = F.b;
        const row = (k, v) => `<div class="kv"><span>${k}</span><b>+${num(v)}</b></div>`;
        let story = '';
        for (const t of L.timeline.slice(-14)) story += `<div class="tl"><b>Age ${t[0]}</b><span>${t[1]} ${esc(t[2])}</span></div>`;
        const hall = loadHall();
        let hallH = '';
        hall.slice(0, 5).forEach((x, i) => { hallH += `<div class="kv"><span>${i + 1}. ${x.a || '🧑'} ${esc(x.n)} <span class="tiny">(${esc(x.t)})</span></span><b>${num(x.s)}</b></div>`; });
        openModal(`<div class="ev-icon">🏆</div><h2>${F.early ? 'Early Retirement' : 'Happy Retirement!'}</h2>
            <div class="center muted">${L.avatar} ${esc(L.name)} retired at ${F.age} as ${esc(F.title)}</div>
            <div class="final-score">${num(F.score)}</div>
            <div class="center muted">Final Life Score${F.pb ? '<span class="pbnew">NEW PERSONAL BEST!</span>' : ` · Best: ${num(Math.max(pbScore, F.score))}`}</div>
            <div class="sum-grid">
                <div class="card" style="margin:0"><div class="card-title">Score breakdown</div>
                    <div class="kv"><span>Earned during life</span><b>${num(F.before)}</b></div>
                    ${row(`Wealth (net worth ${money(F.nw)})`, b.wealth)}${row('Career', b.career)}${row(`Education (${L.degrees.length} degree${L.degrees.length === 1 ? '' : 's'})`, b.education)}
                    ${row('Family & friends', b.family)}${row(`Wellbeing (avg happiness ${b.avgHappy})`, b.wellbeing)}
                    <div class="kv total"><span>Final Life Score</span><b>${num(F.score)}</b></div>
                </div>
                <div class="card" style="margin:0"><div class="card-title">Hall of Lives</div>${hallH || '<div class="muted tiny">No lives yet.</div>'}
                    <div class="chips" style="margin-top:6px"><span class="chip">💰 Earned ${money(L.stats.earned)}</span><span class="chip">📈 ${plural(L.stats.promos, 'promotion')}</span><span class="chip">🎲 ${plural(L.stats.events, 'life event')}</span><span class="chip">👶 ${plural(L.rel.kids.length, 'kid')}</span><span class="chip">🏠 ${plural(L.stats.homes, 'home')} bought</span><span class="chip">🤝 ${money(L.stats.charity)} donated</span></div>
                </div>
            </div>
            <div class="card" style="margin-top:10px"><div class="card-title">Life story</div>${story}</div>
            <button class="btn big" data-act="newLife">Start a new life${L.legacy ? ` (+${money(L.legacy)} family legacy)` : ''} ▶</button>`, true);
    }
    function showRename() {
        openModal(`<div class="ev-icon">✏️</div><h2>Change your name</h2>
            <input id="rename-input" maxlength="16" autocomplete="off" value="${esc(L.name)}">
            <div class="choices"><button class="choice" data-act="saveName">Save</button><button class="choice" data-act="modalOk">Cancel</button></div>`);
        const i = $('rename-input'); if (i) { i.focus(); i.select(); }
    }
    function saveName() {
        const i = $('rename-input');
        const n = i && i.value.trim().slice(0, 16);
        if (n) L.name = n;
        closeModal(); changed();
    }
    function newLife() { L.phase = 'setup'; saveGame(netWorth()); showSetup(); }

    // ===================== CORE ACTIONS (1.x functions kept) =====================
    function handleBusiness1() {
        if (!hasBiz1) {
            if (cash >= BIZ1_INIT_COST) { cash -= BIZ1_INIT_COST; hasBiz1 = true; lifeScore += 500; addTimeline('🚀', 'Founded Startup Inc.'); changed(); logMessage("🚀 Startup Founded!"); }
        } else {
            let cost = Math.floor(1500 * Math.pow(1.5, biz1Level - 1));
            if (cash >= cost) { cash -= cost; biz1Level++; lifeScore += 200; changed(); logMessage(`📈 Startup to LVL ${biz1Level}!`); }
        }
    }

    function handleBusiness2() {
        if (!hasBiz2) {
            if (cash >= BIZ2_INIT_COST) { cash -= BIZ2_INIT_COST; hasBiz2 = true; lifeScore += 2500; addTimeline('🏢', 'Founded Conglomerate Corp.'); changed(); logMessage("🏢 Conglomerate Founded!"); }
        } else {
            let cost = Math.floor(10000 * Math.pow(1.6, biz2Level - 1));
            if (cash >= cost) { cash -= cost; biz2Level++; lifeScore += 1000; changed(); logMessage(`🏙️ Corp to LVL ${biz2Level}!`); }
        }
    }

    function doOvertime() {
        if (L.phase !== 'play') return;
        workProgress += 12.5;
        if (workProgress >= 100) {
            const base = L.job ? rankOf(L.job)[1] : 60;
            let bonus = Math.round(base * (0.2 + Math.random() * 0.3)); cash += bonus; workProgress = 0; totalWorkCompleted++;
            L.monthIncome += bonus;
            boostHealth(-0.5); boostHappy(-0.25);
            logMessage(L.job ? `🛠️ Overtime: +${money(bonus)}` : `🧹 Odd job: +${money(bonus)}`);
            if (L.job) { L.job.perf = Math.min(100, L.job.perf + 1); checkPromotion(); }
        }
        updateUI();
    }

    // 1.x bought/sold one share per click; 2.0 uses the trade size picked in the Market tab (n = how many, quiet = no redraw)
    function buyStock(id, n, quiet) {
        const s = stockById(id); if (!s) return 0;
        if (n === undefined || n === null) n = L.mkt.qty || Infinity;
        n = Math.min(Math.floor(n), maxBuy(s));
        if (!(n >= 1)) return 0;
        const fee = n * s.price * feeRate(s), total = n * s.price + fee;
        cash -= total; s.owned += n; s.cost = (s.cost || 0) + total;
        L.mkt.buys++; L.mkt.fees += fee;
        if (!quiet) { checkAch(); updateUI(); }
        return n;
    }

    function sellStock(id, n, quiet) {
        const s = stockById(id); if (!s || s.owned <= 0) return 0;
        if (n === undefined || n === null) n = L.mkt.qty || s.owned;
        n = Math.min(Math.floor(n), s.owned);
        if (!(n >= 1)) return 0;
        const basis = (s.cost || 0) * n / s.owned;
        const gross = n * s.price, fee = gross * feeRate(s), got = gross - fee;
        cash += got; s.owned -= n; s.cost = s.owned ? Math.max(0, (s.cost || 0) - basis) : 0;
        const pl = got - basis;
        L.mkt.real += pl; L.mkt.sells++; L.mkt.fees += fee;
        if (basis > 0 && got >= basis * 2) L.mkt.x2 = true;
        if (pl > L.mkt.best) L.mkt.best = pl;
        if (!quiet) { checkAch(); updateUI(); }
        return n;
    }

    function logMessage(msg, type = '') {
        const log = $('log'); if (!log) return;
        const entry = document.createElement('div');
        if (type) entry.className = type;
        entry.innerText = `[D${day}] ${msg}`;
        log.prepend(entry);
        while (log.childNodes.length > 80) log.removeChild(log.lastChild);
    }

    // one simulated day (market + life). marketTick only runs it when the game is not paused.
    function simDay() {
        day++;
        if (day % 7 === 0) payday();
        if (day % 30 === 0) payBills();
        stepMarket();
        if (L.phase === 'play') lifeDay();
        if (L.phase === 'play') { dailyStats(); checkAch(); }
        if (L.tab === 'market' && L.mkt.view === 'port') dirty.market = true;   // portfolio profit/loss table follows prices
    }
    function isPaused() { return L.phase !== 'play' || modalOpen || L.speed === 0; }
    function marketTick() {
        if (isPaused()) return;
        simDay();
        updateUI();
    }
    function setSpeed(s, quiet) {
        if (![0, 1, 2, 4, 8].includes(s)) s = 1;
        L.speed = s;
        if (tickTimer) clearInterval(tickTimer);
        tickTimer = s ? setInterval(marketTick, BASE_TICK_MS / s) : null;
        updateSpeedUI();
        if (!quiet) updateUI();
    }
    function updateSpeedUI() {
        const sp = $('speed'); if (!sp || !L) return;
        for (const b of sp.children) b.classList.toggle('on', +b.dataset.arg === L.speed);
        sp.classList.toggle('paused', isPaused());
    }

