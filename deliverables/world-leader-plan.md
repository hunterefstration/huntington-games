# World Leader: game plan

Working title: **World Leader** (folder `World Leader/`, debug hook `window.__wl`). A grand-strategy game in the
style of Civilization, Democracy and Geopolitics Simulator: you pick any country on Earth, become its leader, and try to
keep power while your country and the rest of the world react to everything you do.

Like every Huntington game it is one `index.html` with inline JS/CSS, runs on a Chromebook with no installs, and saves
in the browser.

---

## 1. The big idea in one paragraph

Each turn is one month. You read your briefing, handle events, set your budget and laws, talk to other leaders, and
press **End Month**. The game then runs a set of formulas (section 10) that move your economy, your people's mood,
your relations with every country and any wars that are going on. Nothing is scripted to "just happen": every number
has causes, and the game shows you those causes ("Approval −4: inflation −3, scandal −2, new hospitals +1"). Your
choices get delayed effects, so a good leader plans years ahead.

---

## 2. Pick ANY country

- **All 195 countries**: 193 UN members plus Taiwan, Kosovo, Palestine and Vatican City. Microstates (Monaco, Tuvalu,
  Nauru...) are clickable through dots on the map and a search box.
- **Real starting data (about 2025)** for every country: population, GDP, GDP per person, growth, inflation,
  unemployment, government debt, government type, military size and budget, nuclear weapons yes/no, main resources
  (oil, gas, food, minerals, rare earths, tech, tourism), neighbours, and memberships (UN Security Council, NATO, EU,
  African Union, ASEAN, BRICS, OPEC, Arab League, etc.). Numbers are rounded public figures, baked into the file.
- **Difficulty stars** worked out from the data: USA or China = easier (big and strong), Germany = medium, Haiti or
  Tuvalu = very hard. A "Challenge" tag on fragile states.
- **Country select screen**: world map, search box, filters (region, size, government type, difficulty), and a stat
  card for the country you hover.
- **Leader setup**: your name, title (President / Prime Minister / King / Queen / Chancellor / Supreme Leader, from the
  country's system), party name, ideology (left / centre / right, liberal / authoritarian), and 2 starting traits out of
  about 20 (Charismatic, Economist, War Hero, Corrupt, Honest, Stubborn, Diplomat...).
- **Start options**: Modern (2026, the main mode). Later scenario packs: Cold War 1962, Rebuild After Civil War,
  Tiny Nation Challenge, Sandbox (edit any stat).

---

## 3. The map

- Real world map embedded in the file (simplified country borders, about 150 KB), drawn on a canvas with pan, zoom and
  click.
- **Map modes**: Political, Relations with you (green to red), Alliances and blocs, Economy (GDP), Military power,
  Unrest, Trade partners, Wars and fronts, Spy network, Resources.
- Small icons on the map for live things: wars, protests, disasters, summits, your spies, trade routes.
- Each country is split into **3 to 8 regions** (generated from its shape and data: capital, industrial, farming,
  coast, border...). Regions matter for elections, rebellions, disasters, wars and projects.

---

## 4. Your country: the stats you manage

| Area | Stats |
|---|---|
| Economy | GDP, growth, inflation, unemployment, debt, deficit, interest rate, credit rating, currency strength, trade balance, inequality |
| Budget | tax income vs spending on 12 ministries, interest payments |
| People | approval, happiness, stability, health, education, crime, freedom, corruption, population growth |
| Power | military strength, readiness, technology, intelligence, prestige ("soft power") |
| Planet | pollution, emissions, energy mix (oil, gas, coal, nuclear, renewables) |

### Interest groups (the people you have to keep happy)
Military, Business, Workers and Unions, Farmers, Religious groups, Youth, Retirees, Environmentalists, Media,
Minorities and regions, Police, Wealthy elite. Each one has **support** (how happy it is with you) and **clout** (how
much it matters). Clout changes with the government type: in a democracy voters matter most; in a military dictatorship
the generals do; in a monarchy the elite and religious leaders do.

---

## 5. Running your country

- **Budget**: sliders for 12 ministries (Defence, Health, Education, Infrastructure, Welfare, Police, Science,
  Environment, Culture, Foreign Aid, Intelligence, Space) and 5 taxes (income, corporate, sales, tariffs,
  wealth). Borrow, print money (inflation!), or cut spending (protests!).
- **Laws and policies (about 100)** in categories: economy, rights and freedoms, justice, health, education, energy,
  environment, immigration, media, religion, military service, technology and AI. Most have levels (for example the
  minimum wage: none / low / medium / high). Each law has costs, effects that build up over months, and reactions from
  interest groups. Some need parliament to pass (democracies) and some are blocked by your constitution.
- **Big projects** that take months or years: high-speed rail, nuclear plant, solar farms, new capital city, ports,
  universities, hospitals, border wall, space program, moon base, data centres, Olympics or World Cup bid, national
  monument.
- **Cabinet**: you appoint about 8 ministers from generated people. Each has skill, loyalty, ambition, honesty,
  faction and a hidden scandal risk. Good ministers make their ministry work better; ambitious ones may plot against
  you, leak to the press or resign at the worst moment.
- **Central bank**: set interest rates yourself or leave it independent (safer, less control).
- **Speeches and press conferences**: answer reporters with choices; your answers move approval, interest groups and
  foreign relations.
- **Government type**: Democracy, Constitutional Monarchy, One-Party State, Military Junta, Theocracy, Absolute
  Monarchy. You can reform it slowly (constitution changes) or fast (emergency powers, which everyone notices).

### Staying in power
- **Democracies**: elections every 4 or 5 years (by country), campaign events, debates, polls by region, coalitions if
  no one wins a majority. Lose and the game ends (or you keep playing as Opposition Leader, an optional mode).
- **Non-democracies**: no elections, but **coup risk** from the army, **revolution risk** from the people, and
  **palace intrigue** from your own ministers.
- Term limits, impeachment, votes of no confidence, health and assassination attempts (rare, non-graphic).

---

## 6. Foreign relations

- **Relations score (−100 to +100) with every country**, plus **trust** (do they believe your promises) and a
  **memory** of what you did (insults and betrayals fade slowly, broken treaties fade very slowly).
- **World leaders** for every country: generated fictional people with real titles (so nobody real is put in a war and
  the game never goes out of date). Each has a personality: aggressive or peaceful, greedy, proud, honourable,
  paranoid, ideological, and a list of things they like and hate. They remember you.
- **Things you can do**: open or close embassies, state visits, phone calls, send aid, trade deals, tariffs,
  sanctions, embargoes, arms sales, loans, non-aggression pacts, defence alliances, joint military drills, denounce,
  apologise, demand, ultimatum, recognise or refuse to recognise, settle border disputes, host a summit, expel
  diplomats, declare war, peace talks.
- **Every offer shows a chance**: "They would accept: 72%", with the reasons listed ("they hate your trade
  tariffs −15, you are both in the African Union +10").
- **Organisations**: the UN (General Assembly votes, Security Council with vetoes, peacekeepers, resolutions you can
  propose), military alliances, trade blocs, an oil cartel, development banks (emergency loans with conditions). Join,
  leave, get kicked out, or found your own.
- **Trade**: 8 goods (oil, gas, food, metals, rare earths, manufactured goods, tech, services). Each country produces
  and needs some. Prices move with world supply and demand, so an oil embargo really hurts oil importers.
- **The AI world lives on its own**: other countries sign deals, fight wars, have elections, coups and crises with each
  other. A monthly "World News" feed shows what happened. Big powers compete for influence.

---

## 7. Military, war and spies

- **Forces**: army, navy, air force, missiles, cyber, space, special forces, plus nuclear weapons for the countries that
  really have them (others can try to build them, which causes a crisis).
- Recruit, train, buy equipment, research better tech, set conscription by law, pick generals (skill, loyalty).
- **War**: fought by region along fronts. Each month the formula (section 10.7) decides gains and losses. Occupy
  regions, blockade coasts, bomb infrastructure. **War score** decides peace terms: take a region, reparations, regime
  change, make them a puppet, or a white peace.
- **War weariness** builds at home; allies may join or abandon you; the UN may sanction you.
- **Nuclear weapons**: mostly deterrence. Using one brings massive world reaction; full nuclear war ends the game for
  everyone (shown as a grey screen and a score, nothing graphic).
- **Intelligence agency**: place spies in countries, steal tech, sabotage, fund opposition, election meddling,
  support or stop a coup, counter-intelligence at home. Getting caught is a huge diplomatic scandal.

All war is shown as maps, numbers and news headlines, nothing gory, to keep it school-friendly.

---

## 8. Events (the "anything can happen" part)

- **300+ events** with choices and chains. Examples: earthquake, hurricane, flood, drought, wildfire, pandemic, stock
  market crash, oil shock, bank collapse, general strike, student protests, minister scandal, leaked documents,
  refugee wave, border clash, hijacking, cyber attack, tech breakthrough, gold discovery, Olympics win, celebrity
  endorsement, royal wedding, famous athlete defects, alien signal (very rare joke event).
- **Country-specific chances**: hurricanes for the Caribbean, earthquakes for Japan and Chile, monsoons for South Asia,
  sandstorms for the Sahel, oil price events for oil exporters.
- Event chances use the formulas too: a strike is more likely when workers are unhappy, a coup rumour when the army is
  unhappy, a pandemic is worse when health spending is low.

## 9. People you deal with

Ministers, the opposition leader, generals, the central bank chief, CEOs of big companies, union bosses, religious
leaders, journalists, activists, foreign leaders, the UN Secretary-General and your own family. Each is a generated
person with a portrait (simple drawn faces), traits, loyalty and a relationship score with you. They send messages,
ask favours, make threats and remember what you did.

---

## 10. The formulas (how the game decides what happens)

Every monthly turn runs these steps in order. All randomness uses a **seeded random number generator**, so a save
always replays the same way and cheating by reloading does not help. Effects with a delay are stored in a queue and
applied over the following months.

Most "soft" stats are 0-100. `clamp` keeps a number in range. `noise` is a small random value.

### 10.1 Economy
```
growth (per year) = potential
                  + 0.04 * (investment - 20)          investment = infrastructure + science + business confidence
                  + 0.03 * (education_5yrs_ago - 50)   education pays off after about 5 years
                  + 0.02 * trade_openness
                  - 0.05 * max(0, total_tax - 35)      high taxes slow growth
                  - 0.06 * max(0, 50 - stability)      chaos scares investors
                  - war_penalty - sanction_penalty
                  + world_cycle + noise(±0.5)
potential = 1.5% for rich countries, up to 6% for poor ones (catch-up growth)
GDP_next_month = GDP * (1 + growth / 12)
```
- **Inflation** = last inflation × 0.8 + expectations + money printed + 0.3 × (deficit % of GDP) + oil/food shocks
  − 0.5 × (interest rate − neutral rate).
- **Unemployment** moves opposite to growth (Okun's law): every 1% growth below potential adds about 0.4%
  unemployment.
- **Budget**: tax income = Σ(rate × tax base × collection), where collection falls with corruption. Spending = Σ
  ministries + debt × interest rate. The deficit adds to debt.
- **Interest rate on debt** = world rate + risk premium; the premium rises fast when debt goes over about 90% of GDP or
  stability is low. Too much debt leads to a credit downgrade, then a debt crisis, then default (a crisis event, not an
  instant loss).

### 10.2 Interest groups and approval
```
group_support_next = group_support * 0.9                 drifts back toward neutral
                   + 0.1 * (50 + Σ policy_effects_on_group + economy_feel + recent_events)
economy_feel = -2 * (inflation - 3) - 1.5 * (unemployment - 5) + 0.5 * (growth - 2)
approval = Σ(group_support * group_share_of_population) + honeymoon(first 12 months) + noise(±1)
```

### 10.3 Stability, protests, revolution
```
stability = 0.35 * approval + 0.15 * police_strength + 0.15 * army_loyalty
          - 0.2 * inequality - 0.15 * youth_unemployment * 2
          + 0.1 * freedom (democracies) or + 0.1 * repression (dictatorships, but it raises anger over time)
```
Below 40: protests. Below 25: riots and strikes. Below 12 for several months: chance of revolution or civil war.

### 10.4 Coups (each month)
```
coup_chance% = max(0, (60 - military_support) * military_clout / 400 - army_loyalty / 50 - institutions / 40)
```
Higher in juntas and one-party states, nearly zero in strong democracies. Your counter-moves (pay rises, purges,
loyal generals) change the inputs, and each has side effects.

### 10.5 Elections
```
vote_share(region) = approval_in_region + 0.5 * (economy_feel over last year)
                   + campaign_spending effect + debate result + media bias - scandals + noise(±3)
```
Seats are counted by region with the country's voting system (first-past-the-post or proportional). Polls are shown
with a margin of error, so you are never 100% sure.

### 10.6 Relations and diplomacy
```
relation_next = relation
              + 0.02 * (base_attitude - relation)     slow pull back to history and ideology
              + shared_alliance (+0.5) + same_ideology (+0.3) + trade_volume (+0 to +0.5)
              - border_dispute (-0.5) - rivalry (-1) + Σ memories (each fades over time)
accept_chance = sigmoid((value_to_them + 0.4 * relation + 0.3 * trust + personality_bias - 20) / 10)
```
The game shows `accept_chance` and its reasons before you send an offer.

### 10.7 War (each month, each front)
```
power = soldiers * equipment * tech * morale * supply * terrain * general_skill
losses_A = k * power_B^2 / (power_A + power_B)        Lanchester square law: bigger force wins faster
front_move = (power_A - power_B) / (power_A + power_B) * speed
war_weariness += casualties / population * 1000 + months_at_war * 0.5
```

### 10.8 AI countries
Every AI country runs a lighter version of the same model each month (economy, stability, relations) and picks
actions by scoring them against its leader's personality. All 195 run in a few milliseconds.

### 10.9 Showing the math
- Every stat has a **"Why?" breakdown** listing what pushed it up or down this month.
- Every decision shows a **preview with a range**: "Approval +2 to +5, Debt +1.2%".
- A history chart for every stat (last 10 years).

---

## 11. Goals, winning and losing

- **Open-ended**, play as long as you stay in power. Your **Legacy Score** grows with how much better your country got.
- **Optional victories**: Economic Superpower (top 3 GDP), Peacemaker (end 5 wars, win a peace prize), World Power
  (lead the biggest alliance), Science (moon base, then Mars), Happiest Nation (top of the happiness index),
  Long Reign (20 years in power).
- **Ways to lose**: voted out, removed by coup, revolution, impeachment, conquered, assassinated, or nuclear war.
  Each ending gets its own screen and newspaper front page.
- **Hall of Leaders**: past games with country, years in power, ending and score.
- **Achievements** (about 80), e.g. "Win an election as Tuvalu", "Survive 10 coup attempts", "Zero debt".

## 12. Technology

A tech tree of about 40 techs over 5 branches (economy, military, energy, health, space and AI). Research is paid for
by the Science budget and moves your country into future events: self-driving cars, fusion power, AI automation (which
raises unemployment), lab-grown food, Mars colony.

---

## 13. Screens

Title → Country Select → Leader Setup → Main Game.

Main game: map in the middle, top bar (date, approval, GDP, budget, stability, End Month), left menu with these screens:
Overview, Economy, Budget, Laws, Projects, Cabinet, People, Diplomacy, Organisations, Trade, Military, Intelligence,
Technology, World News, Charts, Encyclopedia (every country's facts), Settings. Right side: inbox of events and
messages. A Monthly Report pops up after each turn. Tutorial for the first 6 months (can be skipped).

## 14. Saves

3 save slots + autosave every month, export/import save code (copy text), versioned saves that migrate on update
(never wiped), settings saved separately.

---

## 15. Technical notes

- One `World Leader/index.html`, canvas map, Tailwind like the other games. Expected size 1 to 1.5 MB (map ~150 KB,
  country data ~80 KB, events and text ~300 KB, code ~500 KB), similar to Frontline.
- Debug hook `window.__wl` (`?debug`) with functions to jump months, set stats, force events and run fast simulations.
- **Balance testing**: a headless test runs 50 years of AI-only play for many countries and checks nothing explodes
  (no endless growth, no instant collapse, wars end, debt stays sane).
- Works offline once loaded; no internet needed for the data.

---

## 16. Build order (one chunk per session, through `game-finish`)

| # | Chunk | Playable result |
|---|---|---|
| 1 | Core: map, all 195 countries with data, country select, leader setup, monthly turn loop, economy + budget + approval formulas, Why? breakdowns, saves | You can rule any country and watch the economy react |
| 2 | Home politics: 100 laws, interest groups, cabinet, projects, central bank, elections, coups, revolutions, government types | Staying in power is hard and interesting |
| 3 | Diplomacy: world leaders, relations, all diplomatic actions with accept chances, UN and organisations, trade goods and prices, sanctions, AI countries acting | The world reacts and lives on its own |
| 4 | Military and spies: forces, generals, wars with fronts, peace deals, nukes as deterrence, intelligence agency | Wars and cold wars |
| 5 | Events and people: 300+ events, country-specific disasters, press conferences, characters with memories, World News feed | Every game tells a different story |
| 6 | Goals and polish: victories, Legacy Score, Hall of Leaders, achievements, tech tree, tutorial, charts, encyclopedia, balance pass | Release 1.0 |

After that, possible extras: scenario packs (Cold War 1962 etc.), Opposition Leader mode, and multiplayer summits once
the `hgnet` library is fixed.

---

## 17. Things for you to decide

1. **Name**: "World Leader" or something else?
2. **Leaders**: fictional generated leaders for every country (my recommendation, safer for school and never
   out of date), or real current leaders' names?
3. **Turn length**: 1 month per turn (recommended) or 1 week (slower, more detail)?
4. **Losing an election**: game over, or keep playing as Opposition Leader?
5. **Release**: one big release after chunk 6, or release after chunk 1 as "Early Access" and update it?
