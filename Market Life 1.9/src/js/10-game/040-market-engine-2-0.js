    // ===================== MARKET ENGINE (2.0) =====================
    // Every price wanders around a "fair value" that grows (or shrinks) a little each day. News, booms and
    // crashes push prices away from it and they drift back, so a 50-year life never runs off to infinity.
    function rp(p) { return p >= 100 ? Math.round(p * 10) / 10 : p >= 1 ? Math.round(p * 100) / 100 : +p.toPrecision(3); }
    function px(p) { return p >= 1000 ? money(p) : p >= 1 ? money(p, 2) : '$' + (p >= 0.01 ? p.toFixed(4) : p.toPrecision(2)); }
    function pct(a, b) { return b > 0 ? (a / b - 1) * 100 : 0; }
    function pctTxt(v) { return (v >= 0 ? '▲ ' : '▼ ') + Math.abs(v).toFixed(Math.abs(v) < 10 ? 2 : 1) + '%'; }
    function isCrypto(s) { return SDEF[s.id] && SDEF[s.id].sec === 'crypto'; }
    function secOf(s) { return SDEF[s.id] ? SDEF[s.id].sec : 'tech'; }
    function unitWord(s, n) { return isCrypto(s) ? (n === 1 ? 'coin' : 'coins') : (n === 1 ? 'share' : 'shares'); }

    // a few years of made-up history so charts are never empty (walks backwards from today's price)
    function backfill(s) {
        const D = SDEF[s.id];
        const v = (D.v || 0.025) * 0.45, g = D.sec === 'fund' ? 0.0003 : D.gd;
        const h = new Array(H_DAYS), hl = new Array(40);
        let x = Math.log(s.price);
        for (let i = H_DAYS - 1; i >= 0; i--) { h[i] = rp(Math.exp(x)); x -= g + (Math.random() - 0.5) * 2 * v; }
        x = Math.log(s.price);
        const vl = v * Math.sqrt(HL_STEP) * 0.7;
        for (let i = hl.length - 1; i >= 0; i--) { hl[i] = rp(Math.exp(x)); x -= g * HL_STEP + (Math.random() - 0.5) * 2 * vl; }
        s.h = h; s.hl = hl;
    }
    function fixStock(s) {
        let D = SDEF[s.id];
        if (!D) D = SDEF[s.id] = { id: s.id, name: String(s.name || s.id), sec: 'tech', p: +s.price || 10, v: clamp(+s.volatility || 0.03, 0.005, 0.3), g: 0.5, y: 0, d: 'A stock from an older version of the game.', gd: 0.00017 };
        s.name = D.name;
        if (D.sec !== 'fund') s.volatility = D.v;
        if (!(s.price > 0) || !Number.isFinite(s.price)) s.price = D.p;
        if (!(s.prevPrice > 0) || !Number.isFinite(s.prevPrice)) s.prevPrice = s.price;
        s.owned = Math.max(0, Math.floor(+s.owned || 0));
        if (!(s.fv > 0) || !Number.isFinite(s.fv)) { s.fv = s.price; s.trend = 0; }   // 1.x trends were permanent; now trend is a short news drift
        if (!Number.isFinite(+s.trend)) s.trend = 0;
        if (!(s.cost >= 0) || !s.owned) s.cost = s.owned ? s.owned * s.price : 0;    // unknown cost basis: today's price
        if (!Array.isArray(s.h) || s.h.length < 2 || !Array.isArray(s.hl) || !s.hl.length) backfill(s);
        if (s.tip && !(s.tip.days > 0)) delete s.tip;
        while (s.price >= SPLIT_AT && D.sec !== 'crypto') split(s, true);
        return s;
    }
    // make sure every asset exists (old saves had 10 stocks), in catalogue order; unknown stocks are kept
    function fixMarket() {
        if (!indexStock || typeof indexStock !== 'object') indexStock = { id: 'TOP2', name: 'TOP2 Index', price: 450, prevPrice: 450, owned: 0 };
        indexStock.id = 'TOP2'; indexStock.isIndex = true;
        fixStock(indexStock);
        const old = Array.isArray(stocks) ? stocks.filter(s => s && typeof s === 'object' && s.id && s.id !== 'TOP2') : [];
        const out = [];
        for (const a of STOCK_DEFS) {
            if (a[0] === 'TOP2') continue;
            const i = old.findIndex(s => s.id === a[0]);
            out.push(fixStock(i >= 0 ? old.splice(i, 1)[0] : { id: a[0], price: a[3], prevPrice: a[3], owned: 0, volatility: a[4], trend: 0 }));
        }
        for (const s of old) if (!out.some(x => x.id === s.id)) out.push(fixStock(s));
        stocks = out;
    }
    function split(s, quiet) {
        s.price /= 10; s.prevPrice /= 10; s.fv /= 10; s.owned *= 10;
        for (let i = 0; i < s.h.length; i++) s.h[i] = rp(s.h[i] / 10);
        for (let i = 0; i < s.hl.length; i++) s.hl[i] = rp(s.hl[i] / 10);
        if (L && L.mkt) for (const o of L.mkt.orders) if (o.id === s.id) { o.px = rp(o.px / 10); o.n *= 10; }
        if (!quiet) addNews('📣', `${s.name} splits its stock 10-for-1 (now ${px(s.price)})`, 0, s.id, s.owned > 0);
    }

    function addNews(icon, text, up, ref, loud) {
        const M = L.mkt;
        M.news.unshift([day, icon, text, up, ref || '']);
        if (M.news.length > 12) M.news.length = 12;
        // only log what matters to you: your holdings, the whole market, or big moments
        let mine = !!loud || ref === '*';
        if (!mine && ref) {
            if (SDEF[ref]) { const s = stockById(ref); mine = !!(s && s.owned > 0); }
            else for (const x of stocks) if (x.owned > 0 && secOf(x) === ref) { mine = true; break; }
        }
        if (mine) logMessage(`📰 ${icon} ${text}`, 'news-alert');
        dirty.market = true;
    }
    function nextRegime() {
        const M = L.mkt, r = Math.random();
        const next = M.reg === 'bull' ? (r < 0.6 ? 'calm' : 'bear') : M.reg === 'bear' ? (r < 0.5 ? 'calm' : 'bull') : (r < 0.55 ? 'bull' : 'bear');
        const R = REGIMES[next];
        M.reg = next; M.regD = rint(R.days[0], R.days[1]);
        addNews(R.icon, next === 'bull' ? 'Analysts say a bull market has begun' : next === 'bear' ? 'Stocks slide into a bear market' : 'Markets calm down after a wild run', next === 'bull' ? 1 : next === 'bear' ? -1 : 0, '*');
    }
    function crash() {
        const M = L.mkt;
        M.reg = 'bear'; M.regD = rint(60, 150); M.crashes++;
        for (const s of stocks) {
            const D = SDEF[s.id]; if (D.sec === 'fund') continue;
            const hit = D.haven ? rnd(0.03, 0.08) : D.sec === 'crypto' ? -rnd(0.3, 0.5) : -rnd(0.15, 0.3);
            s.price = Math.max(D.sec === 'crypto' ? 0.0001 : 0.5, s.price * (1 + hit));
            s.fv *= 1 + hit * 0.4;
        }
        if (assetValue('stocks') > 0) M.dh = day + 30;
        addNews('💥', 'MARKET CRASH! Panic selling everywhere', -1, '*', true);
        toast('💥 Market crash! Stocks are tumbling', 'bad');
    }
    function marketNews() {
        const M = L.mkt, N = pick(NEWS), sec = N[0], up = N[2], cr = sec === 'crypto';
        if (N[1]) {
            const pool = [];
            for (const s of stocks) { const k = secOf(s); if (k !== 'fund' && (sec === '*' ? k !== 'crypto' : k === sec)) pool.push(s); }
            if (!pool.length) return;
            const s = pick(pool), j = up * rnd(0.05, 0.13) * (cr ? 2 : 1);
            s.price = Math.max(cr ? 0.0001 : 0.5, s.price * (1 + j));
            s.fv *= 1 + j * 0.6;
            s.trend += up * (cr ? 0.012 : 0.006);
            addNews(SECTORS[secOf(s)].icon, N[3].replace('{N}', s.name), up, s.id);
        } else {
            for (const s of stocks) {
                const k = secOf(s);
                if (k === 'fund' || (sec === '*' ? k === 'crypto' || SDEF[s.id].haven : k !== sec)) continue;
                const j = up * rnd(0.015, 0.045) * (cr ? 2.5 : 1);
                s.price = Math.max(cr ? 0.0001 : 0.5, s.price * (1 + j));
                s.fv *= 1 + j * 0.5;
            }
            if (sec === '*') { for (const k of STOCK_SECTORS) M.sec[k] = (M.sec[k] || 0) + up * 0.002; }
            else M.sec[sec] = (M.sec[sec] || 0) + up * (cr ? 0.01 : 0.004);
            addNews(sec === '*' ? '🌎' : SECTORS[sec].icon, N[3], up, sec);
        }
    }
    function recordHist(s) {
        if (s.price >= SPLIT_AT && !isCrypto(s)) split(s);
        s.h.push(rp(s.price)); if (s.h.length > H_DAYS) s.h.shift();
        if (day % HL_STEP === 0) { s.hl.push(rp(s.price)); if (s.hl.length > HL_MAX) s.hl.shift(); }
    }
    // one market day (called from simDay)
    function stepMarket() {
        const M = L.mkt;
        indexStock.prevPrice = indexStock.price;
        for (const s of stocks) s.prevPrice = s.price;
        if (--M.regD <= 0) nextRegime();
        if (day > 30 && M.reg !== 'bear' && Math.random() < 1 / 900) crash();
        else if (Math.random() < 0.16) marketNews();
        const R = REGIMES[M.reg];
        let sum = 0, n = 0, a = null, b = null;
        for (const s of stocks) {
            const D = SDEF[s.id];
            if (D.sec === 'fund') continue;
            const cr = D.sec === 'crypto';
            const mult = Math.random() > 0.98 ? 1.4 : (Math.random() < 0.02 ? 0.6 : 1);
            let ch = (Math.random() - 0.5) * 2 * s.volatility * mult * R.vol;
            ch += (cr ? 0.02 : 0.03) * Math.log(s.fv / s.price);
            ch += s.trend + (M.sec[D.sec] || 0);
            if (s.tip) {
                ch += s.tip.dir > 0 ? 0.08 : -0.07;
                s.fv *= s.tip.dir > 0 ? 1.06 : 0.95;
                if (--s.tip.days <= 0) { logMessage(s.tip.dir > 0 ? `📈 That tip on ${s.name} was RIGHT!` : `📉 That tip on ${s.name} was bogus!`, s.tip.dir > 0 ? 'salary-alert' : 'tax-alert'); delete s.tip; }
            }
            s.price = Math.max(cr ? 0.0001 : 0.5, s.price * (1 + ch));
            let g = D.gd + (D.haven ? -R.drift * 0.6 : R.drift * (cr ? 2 : 1));
            if (cr) g += (Math.random() - 0.5) * 0.05;
            s.fv = Math.max(cr ? 0.0001 : 0.5, s.fv * (1 + g));
            s.trend = Math.abs(s.trend) < 1e-5 ? 0 : s.trend * 0.85;
            if (!cr) {
                s.cf = (s.cf > 0 ? s.cf : 1) * (s.price / s.prevPrice); sum += s.cf; n++;
                // rank by yesterday's price so today's move can't pick the winners
                if (!a || s.prevPrice > a.prevPrice) { b = a; a = s; } else if (!b || s.prevPrice > b.prevPrice) b = s;
            }
        }
        for (const k in M.sec) M.sec[k] = Math.abs(M.sec[k]) < 1e-5 ? 0 : M.sec[k] * 0.88;
        const mk = stockById('MKT');
        // the fund is a price level: base price x average split-adjusted growth of its stocks (no daily-rebalancing compounding)
        if (mk && n) { if (!(mk.mb > 0)) { mk.mb = mk.price; for (const s of stocks) if (SDEF[s.id].sec !== 'fund' && SDEF[s.id].sec !== 'crypto') s.cf = 1; sum = n; } mk.price = Math.max(0.5, mk.mb * sum / n); }
        // TOP2 follows the daily moves of the two most expensive stocks (so it never jumps when they change)
        if (a && b) indexStock.price = Math.max(0.5, indexStock.price * (1 + (a.price / a.prevPrice + b.price / b.prevPrice - 2) / 2));
        recordHist(indexStock);
        for (const s of stocks) recordHist(s);
        checkOrders();
        bondsDay();
        if (day % 30 === 15) payDividends();
        if (M.dh && day >= M.dh) { M.dh = 0; if (assetValue('stocks') > 0) M.held = true; }
    }

    function divYield(s) { return SDEF[s.id] ? SDEF[s.id].y : 0; }
    function payDividends() {
        let tot = 0, n = 0;
        const add = s => { if (s.owned > 0 && divYield(s) > 0) { tot += s.owned * s.price * divYield(s) / 100; n++; } };
        add(indexStock);
        for (const s of stocks) add(s);
        tot = Math.round(tot * 100) / 100;
        if (tot < 0.01) return;
        cash += tot; L.monthIncome += tot; L.mkt.divs += tot; L.stats.earned += tot;
        logMessage(`💵 DIVIDENDS: +${money(tot, 2)} from ${plural(n, 'holding')}`, 'salary-alert');
    }

    // ---------- trading ----------
    function feeRate(s) { return isCrypto(s) ? CRYPTO_FEE : 0; }
    function maxBuy(s) { return Math.floor(Math.max(0, cash) / (s.price * (1 + feeRate(s))) + 1e-9); }
    function tradeN(s, buy) { const q = L.mkt.qty; return buy ? Math.min(q || Infinity, maxBuy(s)) : Math.min(q || s.owned, s.owned); }
    function assetValue(kind) {   // undefined = stocks + crypto, 'crypto', or 'stocks' (stocks and funds)
        let v = kind === 'crypto' ? 0 : indexStock.price * indexStock.owned;
        for (const s of stocks) {
            if (!s.owned) continue;
            const cr = isCrypto(s);
            if (kind === 'crypto' ? cr : kind === 'stocks' ? !cr : true) v += s.price * s.owned;
        }
        return v;
    }
    function sectorsHeld() {
        let n = 0; const seen = {};
        for (const s of stocks) if (s.owned > 0) { const k = secOf(s); if (STOCK_SECTORS.includes(k) && !seen[k]) { seen[k] = 1; n++; } }
        return n;
    }

    // ---------- limit orders ----------
    const ORDER_TYPES = {
        buy: { name: 'Limit buy', icon: '🟢', verb: 'Buy', help: 'Buys when the price drops to your price or lower.' },
        tp:  { name: 'Take profit', icon: '🎯', verb: 'Sell', help: 'Sells when the price climbs to your price or higher.' },
        sl:  { name: 'Stop loss', icon: '🛡️', verb: 'Sell', help: 'Sells when the price falls to your price or lower, to limit a loss.' }
    };
    function orderHit(o, s) { return o.k === 'tp' ? s.price >= o.px : s.price <= o.px; }
    function checkOrders() {
        const O = L.mkt.orders;
        for (let i = O.length - 1; i >= 0; i--) {
            const o = O[i], s = stockById(o.id);
            if (!s) { O.splice(i, 1); continue; }
            if (!orderHit(o, s)) continue;
            O.splice(i, 1);
            dirty.market = true;
            const T = ORDER_TYPES[o.k];
            const n = o.k === 'buy' ? buyStock(o.id, o.n, true) : sellStock(o.id, o.n, true);
            if (!n) { logMessage(`📝 ${T.name} on ${s.id} cancelled: ${o.k === 'buy' ? 'not enough cash' : 'no shares left to sell'}`, 'tax-alert'); continue; }
            L.mkt.fills++;
            if (o.k === 'sl') L.mkt.stops++;
            const msg = `${T.icon} ${T.name} filled: ${T.verb.toLowerCase()} ${num(n)} ${s.id} at ${px(s.price)}`;
            logMessage(msg, o.k === 'buy' ? 'boost-alert' : 'salary-alert');
            toast(msg, o.k === 'sl' ? 'bad' : 'good');
        }
    }
    function cancelOrder(i) {
        const o = L.mkt.orders[+i]; if (!o) return;
        L.mkt.orders.splice(+i, 1);
        logMessage(`📝 Cancelled ${ORDER_TYPES[o.k].name.toLowerCase()} on ${o.id}`);
        changed();
    }
    let ordSel = null;
    function orderDefaults(k, s) {
        const p = rp(k === 'buy' ? s.price * 0.95 : k === 'tp' ? s.price * 1.1 : s.price * 0.9);
        const n = k === 'buy' ? Math.max(1, Math.min(L.mkt.qty || Infinity, Math.floor(Math.max(0, cash) / p) || 1)) : Math.max(1, Math.min(L.mkt.qty || s.owned, s.owned));
        return { px: p, n: n === Infinity ? 1 : n };
    }
    function openOrder(id) {
        const s = stockById(id); if (!s || L.phase !== 'play') return;
        if (L.mkt.orders.length >= MAX_ORDERS) { toast(`You can have ${MAX_ORDERS} open orders at most`, 'bad'); return; }
        const k = s.owned > 0 ? 'tp' : 'buy', d = orderDefaults(k, s);
        ordSel = { id, k };
        let h = `<div class="ev-icon">📝</div><h2>Order: ${esc(s.name)}</h2>
            <p class="center muted">${s.id} is at <b>${px(s.price)}</b> · you own ${num(s.owned)} · cash ${money(cash)}</p>
            <label class="lbl">Order type</label><div class="style-pick">`;
        for (const t in ORDER_TYPES) { const T = ORDER_TYPES[t]; h += `<button data-act="ordType" data-arg="${t}" class="${t === k ? 'on' : ''}"${t !== 'buy' && !s.owned ? ' disabled' : ''}><b>${T.icon} ${T.name}</b><small>${T.help}</small></button>`; }
        h += `</div><label class="lbl" for="ord-px">Trigger price ($)</label><input id="ord-px" type="number" min="0" step="any" value="${d.px}">
            <div class="pct-row">${[-20, -10, -5, -1, 1, 5, 10, 20].map(p => `<button class="btn gray" data-act="ordPct" data-arg="${p}">${p > 0 ? '+' : ''}${p}%</button>`).join('')}</div>
            <label class="lbl" for="ord-n">How many ${unitWord(s, 2)}</label><input id="ord-n" type="number" min="1" step="1" value="${d.n}">
            <p class="outcome" id="ord-say" style="margin-top:10px"></p>
            <div class="choices"><button class="choice" data-act="placeOrder" id="ord-go">Place order</button><button class="choice" data-act="modalOk">Cancel</button></div>`;
        openModal(h);
        orderSay();
    }
    function orderInputs() {
        const s = ordSel && stockById(ordSel.id), a = $('ord-px'), b = $('ord-n');
        if (!s || !a || !b) return null;
        return { s, px: +a.value, n: Math.floor(+b.value) };
    }
    function orderSay() {
        const o = orderInputs(); if (!o) return;
        const { s, px: p, n } = o, T = ORDER_TYPES[ordSel.k];
        const ok = p > 0 && n >= 1 && (ordSel.k === 'buy' || n <= s.owned);
        let t;
        if (!(p > 0)) t = 'Enter a trigger price above $0.';
        else if (!(n >= 1)) t = 'Enter how many to trade (1 or more).';
        else if (ordSel.k !== 'buy' && n > s.owned) t = `You only own ${num(s.owned)} ${unitWord(s, s.owned)}.`;
        else {
            t = `${T.icon} <b>${T.verb} ${num(n)} ${s.id}</b> when the price ${ordSel.k === 'tp' ? 'rises to' : 'drops to'} <b>${px(p)}</b> or ${ordSel.k === 'tp' ? 'higher' : 'lower'} (about ${money(n * p)}). Now ${px(s.price)}.`;
            if (orderHit({ k: ordSel.k, px: p }, s)) t += ' <span class="gold">The price is already there, so it fills on the next market day.</span>';
            if (ordSel.k === 'buy' && n * p > cash) t += ' <span class="bad">You do not have that much cash right now; it buys what you can afford when it fills.</span>';
        }
        $('ord-say').innerHTML = t;
        $('ord-go').disabled = !ok;
    }
    function ordType(k) {
        const s = ordSel && stockById(ordSel.id); if (!s || !ORDER_TYPES[k]) return;
        ordSel.k = k;
        document.querySelectorAll('#modal-box [data-act="ordType"]').forEach(b => b.classList.toggle('on', b.dataset.arg === k));
        const d = orderDefaults(k, s);
        $('ord-px').value = d.px; $('ord-n').value = d.n;
        orderSay();
    }
    function ordPct(p) {
        const s = ordSel && stockById(ordSel.id); if (!s) return;
        $('ord-px').value = rp(s.price * (1 + p / 100));
        orderSay();
    }
    function placeOrder() {
        const o = orderInputs(); if (!o) return;
        const { s, px: p, n } = o;
        if (!(p > 0) || !(n >= 1) || (ordSel.k !== 'buy' && n > s.owned) || L.mkt.orders.length >= MAX_ORDERS) return;
        L.mkt.orders.push({ k: ordSel.k, id: s.id, n, px: rp(p), d: day });
        logMessage(`📝 ${ORDER_TYPES[ordSel.k].name} placed: ${num(n)} ${s.id} at ${px(p)}`);
        closeModal(); changed();
    }

