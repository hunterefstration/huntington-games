    // ===================== SHOP =====================
    function buyShop(id) {
        const item = SHOP.find(i => i.id === id); if (!item || L.phase !== 'play') return;
        let price = item.price;
        if (item.insured && insured()) price = Math.round(price * 0.25);
        if (cash < price) return;
        if (item.pet) { if (L.rel.pets.length >= MAX_PETS) return; cash -= price; addPet(item.pet, null, true); addScore(item.boost - PETS[item.pet].score); logMessage(`Bought ${item.name}!`, 'boost-alert'); changed(); return; }
        cash -= price; addScore(item.boost);
        // repeated purchases within 20 days give less happiness
        const r = L.recent[id] || { d: -99, n: 0 };
        r.n = day - r.d < 20 ? r.n + 1 : 0; r.d = day; L.recent[id] = r;
        const m = 1 / (1 + r.n);
        if (item.hap) boostHappy(item.hap * m);
        if (item.health) boostHealth(item.health * m);
        if (item.love) { if (L.rel.p) L.rel.p.love = clamp(L.rel.p.love + item.love * m, 0, 100); else if (item.parents) L.rel.parents = clamp(L.rel.parents + item.parents * m, 0, 100); }
        if (item.friends && Math.random() < 0.3) friendsAdd(1);
        logMessage(`Bought ${item.name}!`, 'boost-alert');
        changed();
    }
    // kept for older code/bookmarklets that called the 1.x shop directly
    function buyShopItem(id) { buyShop(id); }
    function toggleSub(id) {
        if (!SUBS[id]) return;
        L.subs[id] = !L.subs[id];
        logMessage(`${SUBS[id].icon} ${L.subs[id] ? 'Subscribed to' : 'Cancelled'} ${SUBS[id].name}${L.subs[id] ? ` (${money(SUBS[id].cost)}/mo)` : ''}`);
        changed();
    }

    // ===================== RANDOM LIFE EVENTS =====================
    const EVENTS = [
        { id: 'jobOffer', icon: '📞', title: 'A Recruiter Calls',
          w: () => L.age >= 18 ? (L.job ? 5 : 12) : 0,
          make: () => {
              const opts = [];
              for (const k in CAREERS) {
                  if (L.job && L.job.c === k) continue;
                  if (!canJoin(k)) continue;
                  // offer a job paying about what you make now (stars and athletes always start at the bottom)
                  const C = CAREERS[k]; let r = startRank(k);
                  if (!C.volatile && !C.endAge) {
                      const capPay = L.job ? rankOf(L.job)[1] * 1.3 : C.ranks[r][1];
                      for (let i = r + 1; i < C.ranks.length; i++) { if (meets(C.ranks[i][2]) && C.ranks[i][1] <= capPay) r = i; else break; }
                  } else r = 0;
                  if (L.job && C.ranks[r][1] * 1.2 < rankOf(L.job)[1]) continue;   // not worth a call
                  opts.push({ c: k, r });
              }
              if (!opts.length) return null;
              const o = pick(opts); o.b = Math.round(rnd(0.08, 0.2) * 100) / 100; return o;
          },
          text: d => { const C = CAREERS[d.c]; return `A ${C.name.toLowerCase()} company wants to hire you as <b>${C.ranks[d.r][0]}</b> for <b>${money(C.ranks[d.r][1] * (1 + d.b))}/wk</b>${L.job ? ` (your job pays ${money(weeklyWage())}/wk now).` : '.'}`; },
          choices: d => [
              { t: 'Accept the offer', run: () => { hire(d.c, d.r, d.b); return `You start as ${CAREERS[d.c].ranks[d.r][0]}!`; } },
              { t: 'Negotiate for more', sub: '50% chance of +10% more pay, or they walk away', run: () => { if (luck(0.5 + charm())) { hire(d.c, d.r, d.b + 0.1); return `They agreed! You start as ${CAREERS[d.c].ranks[d.r][0]} at ${money(weeklyWage())}/wk.`; } return 'They hired someone else.'; } },
              { t: 'Decline', run: () => 'You turned down the offer.' }
          ] },
        { id: 'medical', icon: '🏥', title: 'Medical Bill',
          w: () => 3 + (L.health < 50 ? 4 : 0) + (L.age > 45 ? 2 : 0),
          make: () => ({ cost: Math.round(rnd(150, 700) * (1 + Math.max(0, L.age - 35) / 25)), what: pick(['a nasty flu', 'a sprained ankle', 'a broken wrist', 'food poisoning', 'a bad back', 'a dental emergency']) }),
          text: d => `You came down with ${d.what}. Treatment costs <b>${money(billCost(d.cost))}</b>${insured() ? ' after insurance' : ' (no insurance: jobs with benefits pay 75%)'}.`,
          choices: d => [
              { t: `Get treated (${money(billCost(d.cost))})`, sub: 'Health +8', run: () => { cash -= billCost(d.cost); boostHealth(8); return 'You feel much better. Health +8.'; } },
              { t: 'Tough it out', sub: 'Health -15, Happiness -5', run: () => { boostHealth(-15); boostHappy(-5); return 'You struggled through it. Health -15.'; } }
          ] },
        { id: 'inherit', icon: '💌', title: 'An Inheritance',
          w: () => L.age >= 20 ? 1.5 : 0,
          make: () => ({ amt: Math.round(rnd(1500, 9000) * (1 + L.age / 50) / 10) * 10 }),
          text: d => `Your great-aunt Edna left you <b>${money(d.amt)}</b> in her will. She always said you were her favorite.`,
          choices: d => [
              { t: `Take the cash (+${money(d.amt)})`, run: () => { cash += d.amt; return `+${money(d.amt)} cash.`; } },
              { t: 'Invest it in the TOP2 Index', sub: `Buys ${Math.floor(d.amt / indexStock.price)} shares at ${money(indexStock.price, 2)}`, run: () => { const n = Math.floor(d.amt / indexStock.price); indexStock.owned += n; cash += d.amt - n * indexStock.price; return `You bought ${n} TOP2 Index shares.`; } },
              { t: 'Give half to charity', sub: '+Life Score, Happiness +12', run: () => { const h = Math.round(d.amt / 2); cash += d.amt - h; const s = Math.min(2000, Math.round(h / 4)); addScore(s); boostHappy(12); L.stats.charity += h; return `You kept ${money(d.amt - h)} and donated ${money(h)}. +${s} Life Score.`; } }
          ] },
        { id: 'tip', icon: '📈', title: 'Hot Stock Tip',
          w: () => 3,
          make: () => {
              const pool = stocks.filter(x => !x.tip); if (!pool.length) return null;
              const s = pick(pool);
              return { id: s.id, n: Math.max(1, Math.floor(Math.min(Math.max(0, cash) * 0.3, 4000) / s.price)), good: Math.random() < (L.trait === 'lucky' ? 0.7 : 0.55), who: pick(['Your neighbor', 'A guy at the gym', 'Your barber', 'An old classmate', 'Your dentist']) };
          },
          text: d => { const s = stockById(d.id); return `${d.who} swears <b>${s.name}</b> (now ${money(s.price, 2)}) is about to explode. Insider info... or nonsense?`; },
          choices: d => { const s = stockById(d.id), cost = d.n * s.price; return [
              { t: `Buy ${d.n} share${d.n > 1 ? 's' : ''} (${money(cost)})`, ok: cash >= s.price, run: () => { const n = Math.min(d.n, Math.floor(cash / s.price)); cash -= n * s.price; s.owned += n; s.tip = { dir: d.good ? 1 : -1, days: 3 }; return `You bought ${n} share${n > 1 ? 's' : ''} of ${s.name}. Watch the Market tab over the next few days...`; } },
              { t: 'Ignore it', run: () => { s.tip = { dir: d.good ? 1 : -1, days: 3 }; return "You ignored the tip. Let's see what happens..."; } }
          ]; } },
        { id: 'layoff', icon: '📉', title: 'Layoffs at Work',
          w: () => L.job && !CAREERS[L.job.c].volatile && L.job.c !== 'athlete' ? (L.style === 0 ? 2.5 : L.style === 2 ? 0.8 : 1.5) : 0,
          make: () => ({ sev: weeklyWage() * 4 }),
          text: d => `Your company is cutting jobs and your name is on the list. HR offers a severance package of <b>${money(d.sev)}</b> (4 weeks of pay).`,
          choices: d => [
              { t: `Take the severance (+${money(d.sev)})`, sub: 'You lose your job', run: () => { cash += d.sev; loseJob('Laid off'); boostHappy(-10); return 'You are unemployed. Check the Career tab for new jobs.'; } },
              { t: 'Plead to keep your job', sub: 'Better odds with high performance', ok: !!L.job, run: () => { if (luck(0.35 + L.job.perf / 300 + charm())) { L.job.perf = Math.max(0, L.job.perf - 25); return 'They kept you on! Performance -25.'; } loseJob('Laid off'); boostHappy(-14); return 'It did not work. You were let go with nothing.'; } }
          ] },
        { id: 'carTrouble', icon: '🔧', title: 'Car Trouble',
          w: () => L.car ? 1 + (100 - L.car.cond) / 15 : 0,
          make: () => ({ cost: Math.round(CARS[L.car.id].price * rnd(0.04, 0.12) + 60), what: pick(['The transmission is grinding', 'A warning light will not turn off', 'The brakes are squealing', 'You have a flat tire and a dead battery']) }),
          text: d => `${d.what}. The mechanic quotes <b>${money(d.cost)}</b>.`,
          choices: d => [
              { t: `Fix it (${money(d.cost)})`, run: () => { cash -= d.cost; L.car.cond = 100; return 'Good as new. Condition 100%.'; } },
              { t: 'Sell it for scrap', sub: `You get ${money(Math.round(L.car.value * 0.25) - (L.car.loan ? Math.round(L.car.loan.bal) : 0))} after the loan`, run: () => { cash += Math.round(L.car.value * 0.25) - (L.car.loan ? Math.round(L.car.loan.bal) : 0); L.car = null; return 'You are taking the bus again.'; } },
              { t: 'Ignore it', sub: 'Condition -25, Happiness -3', run: () => { L.car.cond = Math.max(0, L.car.cond - 25); boostHappy(-3); return 'That noise is getting louder...'; } }
          ] },
        { id: 'lottery', icon: '🎟️', title: 'Lottery Ticket',
          w: () => L.age >= 18 ? 2 : 0,
          text: () => 'The jackpot is <b>$5,000</b> this week. Tickets are $20.',
          choices: () => [
              { t: 'Buy a ticket ($20)', ok: cash >= 20, run: () => { cash -= 20; const r = Math.random() * (L.trait === 'lucky' ? 0.33 : 1); if (r < 0.02) { cash += 5000; addScore(100); boostHappy(20); return 'JACKPOT! You won $5,000!'; } if (r < 0.12) { cash += 100; return 'You matched a few numbers: +$100.'; } return 'No luck this time.'; } },
              { t: 'Save your money', run: () => 'Probably smart.' }
          ] },
        { id: 'wedding', icon: '💒', title: "A Friend's Wedding",
          w: () => L.age >= 20 && L.rel.friends > 0 ? 2.5 : 0,
          make: () => ({ who: pick(NAMES) }),
          text: d => `Your friend ${d.who} is getting married and invited you. The gift and travel cost about $150.`,
          choices: () => [
              { t: 'Attend ($150)', sub: 'Happiness +7', ok: cash >= 150, run: () => { cash -= 150; boostHappy(7); if (L.rel.s === 'single' && luck(0.25)) { newPartner(); return `Great party, and you met ${L.rel.p.name} on the dance floor!`; } if (Math.random() < 0.4) friendsAdd(1); return 'What a celebration!'; } },
              { t: 'Send a card', run: () => { boostHappy(-2); return 'You missed a fun one.'; } }
          ] },
        { id: 'relocate', icon: '🧳', title: 'Relocation Offer',
          w: () => { const j = L.job; if (!j || L.age < 20) return 0; const C = CAREERS[j.c]; return j.r < C.ranks.length - 1 && meets(C.ranks[j.r + 1][2]) ? 2 : 0; },
          make: () => ({ city: pick(['Denver', 'Seattle', 'Austin', 'Chicago', 'Miami', 'Boston', 'Phoenix']) }),
          text: d => { const j = L.job, C = CAREERS[j.c]; return `Your boss offers you a promotion to <b>${C.ranks[j.r + 1][0]}</b> if you move to the ${d.city} office. You would leave some friends behind.`; },
          choices: d => [
              { t: 'Pack your bags', sub: 'Promoted now. Happiness -10, a friend and some love lost', run: () => { promote(); boostHappy(-10); friendsAdd(-1); if (L.rel.p) L.rel.p.love = Math.max(0, L.rel.p.love - 12); return `Welcome to ${d.city}!`; } },
              { t: 'Stay put', run: () => 'You stay where your life is.' }
          ] },
        { id: 'burnout', icon: '🥵', title: 'Burnout Warning',
          w: () => L.job && (L.happy < 35 || L.health < 35 || L.style === 2) ? 4 : 0,
          text: () => 'You have been running on empty. Your doctor says you need a break.',
          choices: () => [
              { t: 'Take a week off (unpaid)', sub: 'Skip one paycheck. Health +12, Happiness +15', run: () => { L.skipPay = 1; boostHealth(12); boostHappy(15); L.job.perf = Math.max(0, L.job.perf - 10); return 'You came back refreshed.'; } },
              { t: 'Push through', sub: 'Performance +10, Health -10, Happiness -6', run: () => { L.job.perf = Math.min(100, L.job.perf + 10); boostHealth(-10); boostHappy(-6); checkPromotion(); return 'You powered through. Hope it was worth it.'; } }
          ] },
        { id: 'homeOffer', icon: '🏷️', title: 'Offer on Your Property',
          w: () => L.props.length ? 2 : 0,
          make: () => ({ i: rint(0, L.props.length - 1), mult: Math.round(rnd(1.12, 1.3) * 100) / 100 }),
          text: d => { const p = L.props[d.i]; if (!p) return 'A buyer wanted one of your properties.'; return `A buyer offers <b>${money(p.value * d.mult)}</b> for your ${HOMES[p.id].name} (worth ${money(p.value)})${p.live ? '. You live there, so you would have to move.' : '.'}`; },
          choices: d => [
              { t: 'Sell it', ok: !!L.props[d.i], run: () => { sellProp(d.i, d.mult); return 'Sold! Nice profit.'; } },
              { t: 'Keep it', run: () => 'You keep your property.' }
          ] },
        { id: 'audit', icon: '🧾', title: 'Tax Audit',
          w: () => L.age >= 20 && L.stats.earned > 4000 ? 1.5 : 0,
          make: () => ({ pen: Math.max(100, Math.round(Math.max(0, cash) * 0.05 / 10) * 10) }),
          text: d => `The tax office found mistakes in your returns. The penalty is <b>${money(d.pen)}</b>.`,
          choices: d => [
              { t: `Pay the penalty (${money(d.pen)})`, run: () => { cash -= d.pen; return 'Paid. Lesson learned.'; } },
              { t: `Hire an accountant (${money(d.pen * 0.4)})`, sub: '75% chance the penalty is dropped', run: () => { cash -= Math.round(d.pen * 0.4); if (luck(0.75)) return 'Your accountant got the penalty dropped!'; cash -= d.pen; return 'Even the accountant could not help. You paid the penalty too.'; } },
              { t: 'Fight it yourself', sub: '50/50: pay nothing, or pay double', run: () => { if (luck(0.5)) return 'You won the appeal!'; cash -= d.pen * 2; return 'You lost and paid double.'; } }
          ] },
        { id: 'stray', icon: '🐶', title: 'A Stray Needs a Home',
          w: () => L.rel.pets.length < MAX_PETS ? 2 : 0,
          make: () => ({ t: pick(['mutt', 'cat']), name: pick(PET_NAMES) }),
          text: d => `A friendly ${d.t === 'cat' ? 'kitten' : 'puppy'} followed you home. It looks hungry.`,
          choices: d => [
              { t: `Adopt ${d.name}`, sub: 'Pets add happiness (about $20-25/mo)', run: () => { addPet(d.t, d.name, true); return `${d.name} is part of the family now!`; } },
              { t: 'Take it to the shelter', sub: '+30 Life Score', run: () => { addScore(30); boostHappy(2); return 'The shelter will find it a good home.'; } }
          ] },
        { id: 'gig', icon: '🧰', title: 'Weekend Side Gig',
          w: () => 3,
          make: () => ({ pay: Math.round(Math.max(80, (L.job ? rankOf(L.job)[1] : 100) * rnd(0.5, 0.9))), what: pick(['help a neighbor move', 'cater a party', 'fix up a website', 'tutor a student', 'paint a fence', 'walk dogs all weekend']) }),
          text: d => `Someone will pay you <b>${money(d.pay)}</b> to ${d.what}.`,
          choices: d => [
              { t: `Take the gig (+${money(d.pay)})`, sub: 'Health -4, Happiness -2', run: () => { cash += d.pay; L.monthIncome += d.pay; boostHealth(-4); boostHappy(-2); return `+${money(d.pay)}. Your back hurts, but your wallet is happy.`; } },
              { t: 'Enjoy your weekend', sub: 'Happiness +3', run: () => { boostHappy(3); return 'A lazy, perfect weekend.'; } }
          ] },
        { id: 'charity', icon: '🤝', title: 'Charity Drive',
          w: () => cash > 200 ? 2 : 0,
          make: () => ({ amt: clamp(Math.round(cash * 0.04 / 10) * 10, 20, 2500), cause: pick(['the local food bank', "a children's hospital", 'an animal shelter', 'disaster relief', 'your old school']) }),
          text: d => `Volunteers are raising money for ${d.cause}. They ask if you can give <b>${money(d.amt)}</b>.`,
          choices: d => [
              { t: `Donate ${money(d.amt)}`, sub: `+${Math.round(d.amt / 4) + 20} Life Score, Happiness +6`, ok: cash >= d.amt, run: () => { cash -= d.amt; L.stats.charity += d.amt; addScore(Math.round(d.amt / 4) + 20); boostHappy(6); return 'Thank you! Giving feels good.'; } },
              { t: 'Not this time', run: () => 'Maybe next year.' }
          ] },
        { id: 'scholar', icon: '🎓', title: 'Scholarship!',
          w: () => L.school && PROGRAMS[L.school.id].cost > 0 && L.school.gpa >= 3.0 && !L.school.sch ? 4 : 0,
          make: () => ({ amt: PROGRAMS[L.school.id].cost }),
          text: d => `Your grades caught the dean's eye. You won a <b>${money(d.amt)}</b> scholarship!`,
          choices: d => [
              { t: 'Accept it!', run: () => { L.school.sch = 1; const l = L.loans.student; if (L.school.loan && l && l.bal > 0) { const r = Math.min(l.bal, d.amt); l.bal -= r; cash += d.amt - r; return `${money(r)} came off your student loan.`; } cash += d.amt; return `+${money(d.amt)} cash.`; } }
          ] },
        { id: 'wallet', icon: '👛', title: 'Found a Wallet',
          w: () => 2,
          make: () => ({ amt: rint(4, 40) * 10 }),
          text: d => `You found a wallet on the sidewalk with <b>${money(d.amt)}</b> inside, and the owner's ID.`,
          choices: d => [
              { t: 'Return it to the owner', sub: '+150 Life Score', run: () => { addScore(150); boostHappy(5); if (luck(0.4)) { const r = Math.round(d.amt * 0.25); cash += r; return `The owner was so grateful they gave you a ${money(r)} reward!`; } return 'The owner thanked you warmly.'; } },
              { t: `Keep the cash (+${money(d.amt)})`, sub: 'Happiness -3 (guilt)', run: () => { cash += d.amt; boostHappy(-3); return 'You feel a little guilty.'; } }
          ] },
        { id: 'cousin', icon: '🤲', title: 'Cousin Needs a Loan',
          w: () => L.age >= 20 && cash >= 300 && !L.iou ? 2 : 0,
          make: () => ({ amt: Math.round(Math.min(cash * 0.2, 2000) / 10) * 10, repay: Math.random() < (L.trait === 'lucky' ? 0.8 : 0.65) }),
          text: d => `Your cousin Vinny needs <b>${money(d.amt)}</b> to fix his food truck. He promises to pay you back with interest in a month.`,
          choices: d => [
              { t: `Lend ${money(d.amt)}`, ok: cash >= d.amt, run: () => { cash -= d.amt; L.iou = { amt: d.amt, due: day + 30, ok: d.repay }; L.rel.parents = clamp(L.rel.parents + 5, 0, 100); return 'Vinny hugs you. Hope he pays you back...'; } },
              { t: 'Say no', run: () => { L.rel.parents = clamp(L.rel.parents - 5, 0, 100); return 'Vinny is disappointed. So is your mom.'; } }
          ] },
        { id: 'proposal', icon: '💍', title: 'A Surprise Proposal',
          w: () => L.rel.s === 'dating' && L.rel.p && L.rel.p.love >= 70 && L.age >= 20 ? 3 : 0,
          text: () => `${L.rel.p.name} got down on one knee and asked you to marry them!`,
          choices: () => [
              { t: 'Say YES!', run: () => { engage(false); return `You are engaged to ${L.rel.p.name}! Plan the wedding in the Family tab.`; } },
              { t: 'Not yet', sub: 'Love -15', run: () => { L.rel.p.love = Math.max(0, L.rel.p.love - 15); return `${L.rel.p.name} is hurt, but understands.`; } }
          ] },
        { id: 'babyNews', icon: '🍼', title: 'Big News!',
          w: () => L.rel.s === 'married' && L.age >= 22 && L.age <= 44 && L.rel.kids.length < 4 && !livingWithParents() ? 1.5 : 0,
          make: () => ({ name: pick(NAMES) }),
          text: () => `${L.rel.p.name} has some news: a baby is on the way!`,
          choices: d => [{ t: 'Wonderful!', run: () => { haveBaby(d.name); return `Welcome to the world, ${d.name}!`; } }] },
        { id: 'kidGrown', icon: '🎒', title: 'Off to College', forced: true,
          text: d => `${esc(d.name)} just turned 18 and got into college! Tuition is about <b>${money(d.cost)}</b>.`,
          choices: d => [
              { t: `Pay the full tuition (${money(d.cost)})`, sub: '+800 Life Score, Happiness +8', run: () => { cash -= d.cost; addScore(800); boostHappy(8); growKid(d.i); return `${d.name} will graduate debt-free. Proud parent moment!`; } },
              { t: `Help a little (${money(d.cost / 4)})`, sub: '+200 Life Score', run: () => { cash -= Math.round(d.cost / 4); addScore(200); growKid(d.i); return `${d.name} is grateful for the help.`; } },
              { t: 'They are on their own', run: () => { growKid(d.i); boostHappy(-2); return `${d.name} takes out student loans.`; } }
          ] },
        { id: 'relTrouble', icon: '💔', title: 'Relationship Trouble',
          w: () => L.rel.p && L.rel.p.love < 30 ? 6 : 0,
          text: () => `You and ${L.rel.p.name} keep fighting. Things are not going well.`,
          choices: () => [
              { t: 'Couples counseling ($300)', sub: 'Love +30', ok: cash >= 300, run: () => { cash -= 300; L.rel.p.love = clamp(L.rel.p.love + 30, 0, 100); return 'Counseling helped a lot. Love +30.'; } },
              { t: 'Talk it out', sub: '55% chance to patch things up', run: () => { if (luck(0.55)) { L.rel.p.love = clamp(L.rel.p.love + 15, 0, 100); return 'You had a long talk. Love +15.'; } endRelationship(); return 'The talk went badly. It is over.'; } },
              { t: L.rel.s === 'married' ? 'File for divorce' : 'Break up', run: () => { endRelationship(); return 'You went your separate ways.'; } }
          ] },
        { id: 'hospital', icon: '🚑', title: 'Rushed to the Hospital', forced: true,
          text: d => `You collapsed from exhaustion and spent three days in the hospital. The bill is <b>${money(billCost(d.cost))}</b>${insured() ? ' after insurance' : ''}.`,
          choices: d => [{ t: 'Pay the bill and rest', run: () => { cash -= billCost(d.cost); L.health = 45; boostHappy(-10); if (L.job) L.job.perf = Math.max(0, L.job.perf - 20); return 'Take better care of yourself! Try a Relaxed pace, a gym membership or fewer overtime shifts.'; } }] },
        { id: 'parentsGift', icon: '👪', title: 'Help From Mom & Dad',
          w: () => L.age < 30 && L.rel.parents >= 60 ? 1.5 : 0,
          make: () => ({ amt: rint(3, 12) * 50 }),
          text: d => `Your parents want to help you get on your feet with <b>${money(d.amt)}</b>.`,
          choices: d => [
              { t: `Accept gratefully (+${money(d.amt)})`, run: () => { cash += d.amt; return 'Thanks, Mom and Dad!'; } },
              { t: 'Politely decline', sub: 'Parents +6, +50 Life Score', run: () => { L.rel.parents = clamp(L.rel.parents + 6, 0, 100); addScore(50); return 'They are proud of how independent you are.'; } }
          ] },
        { id: 'viral', icon: '🔥', title: 'You Went Viral!',
          w: () => L.job && L.job.c === 'creator' ? 5 : 0,
          text: () => 'One of your videos blew up overnight. Millions of views!',
          choices: () => [
              { t: 'Ride the wave', sub: 'Performance +35, Health -4', run: () => { L.job.perf = Math.min(100, L.job.perf + 35); boostHealth(-4); checkPromotion(); return 'You posted nonstop and your following exploded.'; } },
              { t: 'Take a sponsorship deal', sub: '+2 weeks of pay, Happiness +6', run: () => { const p = rankOf(L.job)[1] * 2; cash += p; L.monthIncome += p; boostHappy(6); return `A brand paid you ${money(p)}!`; } }
          ] },
        { id: 'injury', icon: '🤕', title: 'Injured on the Job',
          w: () => L.job && CAREERS[L.job.c].danger ? CAREERS[L.job.c].danger / 2 : 0,
          make: () => ({ cost: Math.round(rnd(800, 2500)) }),
          text: d => `You got hurt at work. Surgery would cost <b>${money(billCost(d.cost))}</b>${insured() ? ' after insurance' : ''}.`,
          choices: d => [
              { t: `Surgery (${money(billCost(d.cost))})`, sub: 'Health -5', run: () => { cash -= billCost(d.cost); boostHealth(-5); return 'The surgery went well.'; } },
              { t: 'Rest it off', sub: 'Health -18, Performance -20', run: () => { boostHealth(-18); L.job.perf = Math.max(0, L.job.perf - 20); return 'It is healing... slowly.'; } }
          ] },
        { id: 'marathon', icon: '🏃', title: 'Charity Marathon',
          w: () => L.health >= 60 ? 1.5 : 0,
          text: () => 'A charity marathon is coming up. Want to run 26.2 miles?',
          choices: () => [
              { t: 'Run it!', sub: L.health >= 75 ? 'You are in good shape' : 'Could be rough', run: () => { if (luck(L.health / 110)) { addScore(200); boostHealth(5); boostHappy(8); return 'You finished! +200 Life Score.'; } boostHealth(-8); boostHappy(-3); return 'You pulled a muscle at mile 18. Health -8.'; } },
              { t: 'Cheer from the sidelines', run: () => { boostHappy(2); return 'Go runners!'; } }
          ] },
        { id: 'reunion', icon: '🎉', title: 'Class Reunion',
          w: () => L.age >= 25 ? 1.5 : 0,
          text: () => 'Your class reunion is this weekend. Tickets are $100.',
          choices: () => [
              { t: 'Go ($100)', sub: 'Happiness +5, reconnect with old friends', ok: cash >= 100, run: () => { cash -= 100; boostHappy(5); if (L.rel.s === 'single' && luck(0.3)) { newPartner(); return `You reconnected with ${L.rel.p.name} and started dating!`; } friendsAdd(1); return 'You caught up with old friends. +1 friend.'; } },
              { t: 'Skip it', run: () => 'Maybe next time.' }
          ] },
        // 2.1 more things that can happen
        { id: 'recruiter', icon: '🪖', title: 'A Military Recruiter',
          w: () => L.age >= 17 && L.age <= 30 && !(L.job && CAREERS[L.job.c].mil) && !L.degrees.includes('mil_boot') && !(L.school && L.school.id.startsWith('mil')) ? 2.5 : 0,
          text: () => `A recruiter stops you outside the store. "Steady pay, health insurance, and after three years the GI Bill pays for college."${L.school && PROGRAMS[L.school.id].lvl === 'bach' ? ' Since you are in college, ROTC would pay your tuition right now.' : ''}`,
          choices: () => [
              { t: 'Sign up for Basic Training', sub: 'Paid while you train, then enlist', ok: canEnroll('mil_boot'), run: () => { enroll('mil_boot', false); return 'You ship out to Basic Training!'; } },
              ...(L.school && PROGRAMS[L.school.id].lvl === 'bach' && PROGRAMS[L.school.id].school === 'University' && !L.school.rotc ? [{ t: 'Join ROTC', sub: 'Free tuition, officer after you graduate', run: () => { joinRotc(); return 'Welcome to ROTC!'; } }] : []),
              { t: 'No thanks', run: () => 'You take a brochure, just in case.' }
          ] },
        { id: 'deploy', icon: '🌍', title: 'Deployment Orders',
          w: () => L.job && CAREERS[L.job.c].mil ? 3 : 0,
          make: () => ({ bonus: Math.round(rankOf(L.job)[1] * rnd(3, 6) / 10) * 10 }),
          text: d => `Your unit is deploying overseas for six months. Hazard pay comes to about <b>${money(d.bonus)}</b>.`,
          choices: d => [
              { t: 'Deploy with your unit', sub: `+${money(d.bonus)}, faster promotion, risky`, run: () => { cash += d.bonus; L.job.perf = Math.min(100, L.job.perf + 30); boostHappy(-6); if (luck(0.12)) { boostHealth(-25); return `You came home with an injury. +${money(d.bonus)}, Health -25.`; } addScore(150); return `Mission complete. +${money(d.bonus)}, +150 Life Score.`; } },
              { t: 'Ask for a stateside post', sub: 'Safe, but slower promotion', run: () => { L.job.perf = Math.max(0, L.job.perf - 15); return 'You stay home. Your commander is not thrilled.'; } }
          ] },
        { id: 'medal', icon: '🏅', title: 'A Medal Ceremony',
          w: () => L.job && CAREERS[L.job.c].mil && L.job.days > 60 ? 1 : 0,
          text: () => 'Your commander puts you in for a medal for outstanding service.',
          choices: () => [{ t: 'Accept it proudly', sub: '+300 Life Score, Happiness +10', run: () => { addScore(300); boostHappy(10); addTimeline('🏅', 'Awarded a medal'); return 'Decorated! +300 Life Score.'; } }] },
        { id: 'abroad', icon: '✈️', title: 'Study Abroad',
          w: () => L.school && ['bach', 'grad'].includes(PROGRAMS[L.school.id].lvl) ? 2 : 0,
          text: () => 'Your school offers a semester abroad in Spain for $900.',
          choices: () => [
              { t: 'Go ($900)', sub: 'Happiness +12, GPA +0.1', ok: cash >= 900, run: () => { cash -= 900; boostHappy(12); L.school.gpa = clamp(L.school.gpa + 0.1, 0, 4); addTimeline('✈️', 'Studied abroad'); return '¡Increíble! Happiness +12, GPA +0.1.'; } },
              { t: 'Stay home', run: () => 'You will see the world another time.' }
          ] },
        { id: 'intern', icon: '🧑‍💼', title: 'Summer Internship',
          w: () => L.school && PROGRAMS[L.school.id].lvl === 'bach' ? 2.5 : 0,
          text: () => 'A company offers you an unpaid summer internship.',
          choices: () => [
              { t: 'Take it', sub: 'Happiness -3, much better job offers later', run: () => { boostHappy(-3); L.payBonus = Math.max(L.payBonus, 0.05); addScore(100); return 'Great experience. Your next job pays 5% more. +100 Life Score.'; } },
              { t: 'Enjoy your summer', run: () => { boostHappy(6); return 'Beach days. Happiness +6.'; } }
          ] },
        { id: 'tuitionHike', icon: '📈', title: 'Tuition Is Going Up',
          w: () => L.school && PROGRAMS[L.school.id].cost && !L.school.rotc && !giBill() ? 1.5 : 0,
          make: () => ({ cost: Math.round(PROGRAMS[L.school.id].cost * 0.3 / 10) * 10 }),
          text: d => `The school raised fees. You owe an extra <b>${money(d.cost)}</b> this year.`,
          choices: d => [
              { t: `Pay it (${money(d.cost)})`, ok: cash >= d.cost, run: () => { cash -= d.cost; return 'Paid. Ouch.'; } },
              { t: 'Put it on the student loan', run: () => { const l = L.loans.student || (L.loans.student = { bal: 0, pay: 0, n: 0, rate: STUDENT_LOAN.rate, label: 'Student Loan' }); l.bal += d.cost; return 'Added to your student loan.'; } }
          ] },
        { id: 'jury', icon: '⚖️', title: 'Jury Duty',
          w: () => L.age >= 18 ? 1.5 : 0,
          text: () => 'You have been summoned for jury duty next week.',
          choices: () => [
              { t: 'Serve', sub: 'A week of lower pay, +Life Score', run: () => { cash -= Math.round(weeklyWage() * 0.5); addScore(80); return 'Justice served. +80 Life Score.'; } },
              { t: 'Ask to be excused', sub: '50% chance', run: () => luck(0.5) ? 'Excused!' : (cash -= Math.round(weeklyWage() * 0.5), 'Request denied. You serve anyway.') }
          ] },
        { id: 'phone', icon: '📱', title: 'Cracked Phone',
          w: () => 2,
          text: () => 'You dropped your phone and the screen shattered.',
          choices: () => [
              { t: 'New phone ($700)', sub: 'Happiness +3', ok: cash >= 700, run: () => { cash -= 700; boostHappy(3); return 'Shiny new phone.'; } },
              { t: 'Repair it ($150)', ok: cash >= 150, run: () => { cash -= 150; return 'Good as new. Mostly.'; } },
              { t: 'Live with the cracks', sub: 'Happiness -3', run: () => { boostHappy(-3); return 'Every text is a puzzle now.'; } }
          ] },
        { id: 'bonus', icon: '💰', title: 'Surprise Bonus',
          w: () => L.job && L.job.perf > 60 ? 2 : 0,
          make: () => ({ amt: Math.round(weeklyWage() * rnd(1, 3) / 10) * 10 }),
          text: d => `Your boss hands you a surprise bonus of <b>${money(d.amt)}</b> for great work.`,
          choices: d => [
              { t: `Take it (+${money(d.amt)})`, run: () => { cash += d.amt; boostHappy(4); return `+${money(d.amt)}!`; } },
              { t: 'Split it with your team', sub: 'Happiness +8, +Life Score', run: () => { cash += Math.round(d.amt / 2); boostHappy(8); addScore(60); return 'Your team loves you.'; } }
          ] },
        { id: 'identity', icon: '🕵️', title: 'Identity Theft',
          w: () => L.age >= 18 && cash > 2000 ? 1 : 0,
          make: () => ({ amt: Math.round(Math.min(cash * 0.15, 4000) / 10) * 10 }),
          text: d => `Someone used your card online. <b>${money(d.amt)}</b> is missing.`,
          choices: d => [
              { t: 'Call the bank right away', sub: '70% chance to get it back', run: () => luck(0.7) ? 'The bank reversed the charges.' : (cash -= d.amt, `The bank could not help. -${money(d.amt)}.`) },
              { t: 'Hire a fraud lawyer ($400)', sub: 'Always works', ok: cash >= 400, run: () => { cash -= 400; return 'Your lawyer got every penny back (minus the fee).'; } }
          ] },
        { id: 'foodtruck', icon: '🌮', title: 'Food Truck Idea',
          w: () => L.age >= 20 ? 1.2 : 0,
          text: () => 'Your friend wants you to invest $2,000 in their taco truck.',
          choices: () => [
              { t: 'Invest $2,000', sub: 'Could double, could vanish', ok: cash >= 2000, run: () => { cash -= 2000; if (luck(0.45)) { cash += 4500; return 'The tacos are a hit! You got $4,500 back.'; } return 'The truck broke down for good. The $2,000 is gone.'; } },
              { t: 'Pass', run: () => 'You wish them luck (and ask for free tacos).' }
          ] },
        { id: 'concert', icon: '🎸', title: 'Concert Tickets',
          w: () => L.age >= 15 ? 1.5 : 0,
          text: () => 'Your favorite band is in town. Tickets are $180.',
          choices: () => [
              { t: 'Go ($180)', sub: 'Happiness +10', ok: cash >= 180, run: () => { cash -= 180; boostHappy(10); return 'Best night of the year!'; } },
              { t: 'Stream it at home', run: () => { boostHappy(1); return 'Not quite the same.'; } }
          ] },
        { id: 'pipe', icon: '🚰', title: 'Burst Pipe',
          w: () => L.props && L.props.length ? 1.5 : 0,
          make: () => ({ cost: Math.round(rnd(600, 2500) / 10) * 10 }),
          text: d => `A pipe burst in your home. Repairs cost <b>${money(d.cost)}</b>.`,
          choices: d => [{ t: `Fix it (${money(d.cost)})`, run: () => { cash -= d.cost; return 'Dry again.'; } }] },
        { id: 'scholarshipGrad', icon: '🎓', title: 'Graduate School Fellowship',
          w: () => L.school && PROGRAMS[L.school.id].lvl === 'bach' && L.school.gpa >= 3.5 ? 1.5 : 0,
          make: () => ({ amt: 1500 }),
          text: () => 'Your professors nominate you for a fellowship toward a master\'s degree.',
          choices: d => [{ t: `Accept (+${money(d.amt)})`, run: () => { cash += d.amt; addScore(150); return 'Fellowship won! +150 Life Score.'; } }] }
    ];
    const EVBYID = {};
    for (const e of EVENTS) EVBYID[e.id] = e;

    function growKid(i) { const k = L.rel.kids[i]; if (k) { k.grown = true; addTimeline('🎒', `${k.name} left for college`); } markDirty(); }
    function queueEvent(id, d) { if (!L.queue.some(q => q.id === id) && !(L.pending && L.pending.id === id)) L.queue.push({ id, d: d || {} }); }
    function maybeEvent() {
        if (L.pending || L.phase !== 'play' || modalOpen) return;
        if (L.queue.length) { const q = L.queue.shift(); openEvent(q.id, q.d); return; }
        if (window.__market && window.__market.noEvents) return;
        if (day - L.lastEv < 12 || Math.random() > 0.07) return;
        L.lastEv = day;
        let total = 0; const cands = [];
        for (const ev of EVENTS) {
            if (ev.forced || ev.id === L.lastEvId) continue;
            const w = ev.w ? ev.w() : 1;
            if (w > 0) { cands.push([ev, w]); total += w; }
        }
        let r = Math.random() * total;
        for (const [ev, w] of cands) {
            r -= w;
            if (r <= 0) { const d = ev.make ? ev.make() : {}; if (d) openEvent(ev.id, d); return; }
        }
    }
    function openEvent(id, d) {
        L.pending = { id, d: d || {} };
        L.lastEvId = id; L.stats.events++;
        showEventModal();
    }
    function showEventModal() {
        const ev = EVBYID[L.pending.id], d = L.pending.d;
        const ch = ev.choices(d);
        let h = `<div class="ev-icon">${ev.icon}</div><h2>${ev.title}</h2><p class="center">${ev.text(d)}</p><div class="choices">`;
        ch.forEach((c, i) => { h += `<button class="choice" data-act="evChoice" data-arg="${i}" ${c.ok === false ? 'disabled' : ''}>${c.t}${c.sub ? `<small>${c.sub}</small>` : ''}</button>`; });
        h += `</div><div class="tiny muted center" style="margin-top:10px">Age ${L.age} · Cash ${money(cash)} · Time is paused</div>`;
        openModal(h);
    }
    function resolveEvent(i) {
        if (!L.pending) return;
        const ev = EVBYID[L.pending.id], d = L.pending.d;
        const c = ev.choices(d)[+i];
        if (!c || c.ok === false) return;
        L.pending = null;
        let msg = '';
        try { msg = c.run() || ''; } catch (e) { msg = 'Life moves on.'; if (window.console) console.warn('event', ev.id, e); }
        logMessage(`${ev.icon} ${ev.title}: ${msg.replace(/<[^>]+>/g, '')}`, 'life-alert');
        openModal(`<div class="ev-icon">${ev.icon}</div><h2>${ev.title}</h2><p class="outcome">${msg}</p><button class="btn big" data-act="modalOk">OK</button>`);
        changed();
    }

