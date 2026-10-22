# SOVEREIGN: game plan (version 2)

**Sovereign** (folder `Sovereign/`, debug hook `window.__sov`) is a grand-strategy game. You pick any country on
Earth, take over its government, and run everything: the economy, the money supply, parliament, the courts, the army,
spies, foreign deals and wars. Everything happens on a live world map you can zoom from the whole planet down to one
city, where you can see soldiers marching, crowds protesting, trains moving and people going about their lives.

The title screen says **"A Huntington Games production"**, and Huntington Games is credited on the About/Credits
screen and on the loading screen.

What changed from version 1: full visual map with zoom, real-time with pause, public reactions to everything, real
government strategies (reserve currency, money printing, pegs, sanctions, tax havens...), a lot more war and politics,
and a multi-file project.

---

## 1. How it plays

- **Real time with pause** (like Hearts of Iron or Europa Universalis), so you can watch armies move and events
  happen. Time runs day by day at 5 speeds (pause, 1 day/2 s up to about 1 month/3 s). Space bar pauses.
- You can act at any moment: change laws, give orders, call leaders, move troops. Big events pause the game
  automatically (you can turn that off).
- The economy, budget and polls update every month; armies, fleets, protests and disasters update every day.
- Every number has causes, and the game shows them: click any stat to see **Why?**
  ("Approval −4: inflation −3, scandal −2, new hospitals +1").

---

## 2. Pick ANY country

- **All 195 countries**: 193 UN members plus Taiwan, Kosovo, Palestine and Vatican City. Microstates are shown as dots
  you can click, and every country can be found with search.
- **Real starting data (about 2025)**: population, GDP, growth, inflation, unemployment, debt, credit rating,
  currency and its share of world reserves, government type, parliament layout, military size and budget, nuclear
  weapons, resources, main trade partners, neighbours, alliances and blocs.
- **Difficulty stars** worked out from the data (USA easier, Haiti or Tuvalu very hard).
- **Country select**: spin the globe, search, filters (region, size, government type, difficulty) and a stat card.
- **Leader setup**: name, title from the country's system, party, ideology, 2 traits from about 25 (Charismatic,
  Economist, War Hero, Diplomat, Populist, Technocrat, Corrupt, Honest...), and a simple face maker for your portrait.
- **Start modes**: Modern 2026 (main mode). Later packs: Cold War 1962, Rebuild After Civil War, Tiny Nation
  Challenge, Sandbox (edit any number).

---

## 3. The living world map (the visual part)

One map you can zoom smoothly through 4 levels. What you see always comes from the real simulation numbers: a big
protest on the map means unrest really is high there.

| Zoom | What you see |
|---|---|
| **Globe** | A 3D globe with day and night (city lights at night), clouds and storms, country colours by map mode, alliance lines, trade ships and cargo planes moving on real routes, war arrows, disaster and news icons popping up |
| **Continent** | Flat map with borders, regions, capitals and big cities, army groups as soldier figures with numbers, fleets as ships, front lines that move, air raids, missile arcs, refugee streams, pipelines and cables |
| **Region** | Cities as clusters of buildings, roads and railways, farms, factories, power plants, mines, military bases, airports and ports. Your projects appear here as they are built (cranes, then the finished building) |
| **City** | Tiny people walking, cars and buses, trains, smoke from factories, crowds at rallies or protests with signs, police lines, soldiers marching through, ambulances and fire trucks during disasters, fireworks on national holidays and election nights |

- **Map modes**: Political, Relations with you, Alliances, Economy, Military, Unrest, Public opinion of you,
  Trade, Resources, Spy network, Elections (results by region), Pollution, Wars.
- **Things you can watch**: armies driving to a border, paratroopers, naval battles, air battles, a new railway
  appearing piece by piece, a city growing, a town emptying in a recession, a hurricane crossing the sea, an election
  night map turning colours region by region.
- **Click anything**: a city (population, mood, jobs), an army (size, morale, supply, general), a protest (who, why,
  how big), a ship (cargo, owner), a building.
- **Style**: clean, colourful low-poly look, like a board game come to life. Nothing gory: battles show smoke,
  flashes, units retreating and numbers, never blood.

### Keeping it fast on Chromebooks
- Drawn with **three.js** (already used by Frontline and Blocky Shooter, so it is already cached by the Launcher and
  set up in our tests). People, cars, soldiers and buildings are **instanced**: thousands of them in a single draw call.
- **Only what is on screen is detailed.** Zoomed out, a city is one dot. Tiny people and cars only exist in the area
  you are looking at, capped at a few thousand. Off-screen, everything is just numbers.
- Country shapes come in 3 detail levels; the map swaps to the cheapest one that still looks right.
- The simulation is separate from the drawing, so a slow frame never slows the game clock. Heavy work (AI countries,
  path finding) runs in a background worker.
- **Graphics setting**: Low / Medium / High / Auto. Auto watches the frame rate and lowers detail (fewer tiny people,
  no clouds, lower resolution) if it drops below 30 fps. The map also stops drawing when the tab is hidden.
- Target: smooth 30+ fps on a basic school Chromebook at Medium, and a first load under 10 seconds.

---

## 4. Running a full government

### 4.1 The branches of government
- **Executive (you)**: decrees and executive orders, appoint the cabinet, propose the budget, command the army.
- **Legislature**: a real parliament with seats per party (taken from the country's real layout, simplified).
  Your laws need votes. You can negotiate with parties, offer favours, trade projects for votes, use party discipline,
  form or break coalitions, or call early elections. Some countries have two houses.
- **Courts**: a supreme or constitutional court that can strike down your laws and decrees. Judges have leanings.
  You can appoint judges when seats open, try to expand the court (big backlash), or ignore rulings (huge backlash,
  the "rule of law" stat drops).
- **Constitution**: term limits, emergency powers, federal or unitary system, official religion, rights. You can
  change it by a vote, a referendum, or by force.
- **Regions and governors**: in federal countries regions have their own leaders who can resist you, and separatist
  movements that can ask for a referendum.
- **Central bank**: independent or controlled by you (see section 5).

### 4.2 Running the country
- **Budget**: 14 ministries (Defence, Health, Education, Infrastructure, Welfare, Pensions, Police, Justice, Science,
  Environment, Culture, Foreign Aid, Intelligence, Space) and 7 taxes (income, corporate, sales/VAT, tariffs, wealth,
  property, carbon).
- **About 150 laws** in levels and categories: economy, labour, rights, justice, health, education, energy,
  environment, immigration, media and internet, religion, military service, technology and AI, guns, housing, drugs
  policy, elections and voting rules.
- **Big projects**: high-speed rail, motorways, nuclear plants, dams, solar and wind farms, ports, airports,
  universities, hospitals, new capital city, border wall, space program, moon base, chip factories, data centres,
  stadiums, Olympics or World Cup bid, national monuments. Each is built visibly on the map.
- **Cabinet** of about 10 ministers with skill, loyalty, ambition, honesty and hidden scandal risk. They can resign,
  leak, plot, or run against you.
- **State companies**: nationalise or privatise oil, airlines, railways, banks, telecoms.

### 4.3 Staying in power
- **Democracies**: elections on the real schedule, campaigns you plan (rallies in regions, ads, debates, promises you
  must keep later), polls with a margin of error, election night on the map, coalitions, recounts, contested results.
  Also: no-confidence votes, impeachment, party leadership challenges, term limits.
- **Non-democracies**: coups, revolutions, palace plots by ministers and family, succession in monarchies, rigged
  elections (risky: if exposed, it can trigger mass protests).
- **Political tricks** (each with real risks and backlash): emergency powers, extending term limits, redrawing voting
  districts, controlling the media, censoring the internet, arresting opposition leaders, "rally around the flag"
  by picking a foreign fight, blaming a scapegoat, burying bad news on busy days, leaking a rival's scandal.

---

## 5. Real economic and power strategies

The game models real tools that real governments use, with their real trade-offs.

| Strategy | What it does | The catch |
|---|---|---|
| **Reserve currency** ("exorbitant privilege") | If the world holds your currency, you borrow cheaply, can run big deficits and print money with little inflation, and you can cut countries off from your payment system | Only possible with a huge economy, trusted institutions and a strong military. Abusing it (too many sanctions, high inflation, political chaos) slowly makes other countries switch away ("de-dollarisation") and a rival bloc builds its own payment system |
| **Printing money / quantitative easing** | Pays for spending without taxes | Inflation; for small countries without a reserve currency it can spiral into hyperinflation |
| **Currency peg** | Ties your money to another currency for stability | You lose control of interest rates; speculators can attack the peg |
| **Devaluation** | Makes your exports cheap, boosts factories | Imports cost more, people feel poorer, trade partners get angry |
| **Dollarisation** | Use another country's currency (like Ecuador) | Ends inflation, but you lose your own monetary policy |
| **Capital controls** | Stop money fleeing in a crisis | Investors stay away |
| **Sovereign wealth fund** (like Norway) | Save oil or export money for the future | Less to spend now |
| **Tax haven** (like Ireland, Luxembourg) | Low company tax draws headquarters and money | Big countries pressure and blacklist you |
| **Export-led growth** (like China, Germany) | Cheap currency, factories, special economic zones | Trade wars and tariffs from partners |
| **Debt diplomacy** | Lend to poor countries for ports and railways, gain influence and sometimes the port | They may default or turn on you |
| **Energy weapon** | Cut gas or oil to pressure countries | They find new suppliers over time and you lose income |
| **Chokepoints** | Control or threaten sea lanes like Hormuz, Suez, Malacca, Panama | World prices jump; big navies may respond |
| **Export bans** (rare earths, chips, food) | Hurt rivals' industries | They build their own supply in a few years |
| **Sanctions and secondary sanctions** | Punish a country and anyone who trades with it | Smugglers, shadow fleets, and lost trust in your currency |
| **Soft power** | Films, music, sport, universities, aid make the world like you | Slow and expensive |
| **Neutrality** (like Switzerland) or **balancing** between blocs (like India) | Trade with everyone, stay out of wars | Nobody fully protects you |
| **Nuclear ambiguity** | Nobody knows if you have the bomb | Spies and inspectors keep trying to find out |
| **IMF-style bailout** | Emergency loan when you are broke | Strict cuts that make people angry |
| **Default and restructuring** | Stop paying debts | Credit is cut off for years; your currency crashes |
| **Strategic reserves** | Store oil, food, gold | Costs money that could be used elsewhere |
| **Brain gain** | Easy visas for skilled people | Some voters dislike immigration |
| **Crypto as legal money** | Attract tech investors | Wild swings in value |
| **Austerity vs stimulus** | Cut to calm lenders, or spend to fight a recession | Unpopular now vs debt later |

Also: stock market index, bond market, credit rating agencies, gold reserves, banking crises and bank bailouts,
housing bubbles, minimum wage, unions and strikes, automation and AI changing jobs, remittances from people working
abroad, tourism.

---

## 6. Public reaction to EVERYTHING

Every single action you take (a law, a speech, a budget cut, a war, a handshake with a foreign leader, an appointment)
gets a public reaction, and that reaction changes the game.

- **Who reacts**: 14 domestic groups (Military, Business, Workers and Unions, Farmers, Religious groups, Youth,
  Students, Retirees, Women, Minorities, Environmentalists, Media, Police, Wealthy elite), every region of your country,
  the **public of every other country**, and the **markets**.
- **Where you see it**:
  - **News headlines** from fictional outlets with different slants (a state broadcaster, a business paper, a
    tabloid, an international wire).
  - **Social feed** ("Chirp") with short posts from citizens, celebrities, foreign leaders and bots, with trending
    tags and like counts.
  - **Polls** by group and region, updated monthly with a margin of error.
  - **On the map**: rallies and celebrations when people love it, protests, strikes, boycotts and graffiti when they
    hate it, with crowd sizes that match the numbers.
  - **Markets**: stock index, currency and bond yields move the same day.
  - **Abroad**: protests at your embassies, boycotts of your products, tourists staying away, or foreign fans.
- **What it changes**: group support, approval, stability, polarisation, your currency and borrowing costs, foreign
  leaders' willingness to deal with you (leaders in democracies must follow their own public), tourism and trade, and
  it can trigger events (strikes, riots, resignations, impeachment attempts, a foreign boycott).
- **Before you act** you see a **reaction preview**: which groups will cheer, which will be angry, and the likely
  market move. It is a forecast, so it can be wrong.
- **Spin**: press conference, blame someone else, release the news on a holiday, propaganda (if the press is not free),
  pay for ads. Spin softens reactions but has a chance of making them much worse if exposed.

---

## 7. Foreign relations

- **Relations (−100 to +100), trust, and memory** with every country. Insults fade fast, broken treaties very slowly.
- **World leaders**: the **real leaders** of every country (as of 2026, kept in an editable data file), each with a
  personality (aggressive, greedy, proud, honourable, paranoid, ideological), likes and dislikes, and their own
  domestic problems that change how they act. When a leader loses an election, resigns or is removed, the game
  generates a fictional successor. Real people are never shown being hurt or killed.
- **Talk to them**: phone calls and summits are short conversations with choices (flatter, threaten, offer, bluff,
  bring up the past). A **summit screen** shows both leaders and the deal table.
- **Actions**: embassies, state visits, aid, loans, trade deals, tariffs, sanctions, embargoes, arms sales, military
  bases abroad, joint drills, defence pacts, non-aggression pacts, technology sharing, visa deals, extraditions,
  recognise or refuse to recognise, border settlements, denounce, apologise, ultimatums, peace talks, mediate other
  countries' wars.
- **Every offer shows a chance of acceptance with reasons.**
- **Organisations**: the UN (General Assembly votes, Security Council with vetoes, peacekeepers, resolutions you write),
  military alliances, trade blocs, an oil cartel, development banks, regional unions. Join, leave, get suspended, or
  found your own bloc with its own currency and payment system.
- **Trade**: 10 goods (oil, gas, food, metals, rare earths, chips, manufactured goods, weapons, services, tourism) with
  world prices driven by supply and demand. Ships carrying them are visible on the map.
- **Blocs and influence**: superpowers compete for influence in every country. You can see the influence split.
- **The AI world lives on its own**: other countries trade, fight, hold elections, have coups and crises. A World News
  feed reports it.

---

## 8. War

### 8.1 Forces
- **Army**: infantry, armour, artillery, air defence, special forces, engineers, logistics.
- **Navy**: carriers, destroyers, submarines, amphibious ships, patrol boats.
- **Air force**: fighters, bombers, drones, transport, helicopters.
- **Missiles, cyber units, satellites**, and nuclear weapons for countries that really have them.
- Units are grouped into **divisions** led by **generals** with skill, traits and loyalty. Equipment comes from your
  own factories or arms deals, and quality depends on technology.

### 8.2 Before a war
- **Reasons for war** (claims, defending an ally, protecting citizens abroad, a UN mandate). War without a reason
  angers the world much more.
- **Mobilisation** (calls up reserves, hurts the economy), conscription laws, readiness levels, border build-ups the
  other side will notice, **DEFCON-style alert level**.
- **War goals**: take a region, regime change, force a treaty, liberate an ally, punish.

### 8.3 Fighting
- Fronts drawn on the map; divisions move along roads and rail. **Supply lines** matter: cut-off units weaken.
- Terrain, weather, seasons and night affect battles. Rivers and mountains are hard to cross.
- **Air war** for control of the sky, **naval war** for sea lanes and blockades, **amphibious landings**,
  **paratroopers**, **missile strikes** on bases, factories and power plants, **cyber attacks** on banks and power
  grids, **drones**.
- **Occupation**: occupied regions resist; you choose how to govern them; insurgencies can follow.
- **Civilian side** (shown without gore): refugees moving on the map, damaged cities that must be rebuilt, war
  weariness at home, protests against the war, rallies for it at the start.
- **Allies**: call them in; they may refuse. Others may send weapons, volunteers or money without joining
  (**proxy wars**).
- **Ceasefires, peace talks, peace treaties** (regions, reparations, demilitarised zones, regime change, puppets,
  white peace), UN peacekeepers, frozen conflicts.
- **Civil wars and rebellions**: if stability collapses, a region or the army can split off; you may fight your own
  country. Foreign powers may back a side.
- **Nuclear weapons**: deterrence, doctrine (no first use or not), missile defence, tests that shock the world.
  Use brings enormous world reaction; full nuclear exchange ends the game for everyone (grey screen and a score).

### 8.4 Spies
Intelligence agency with agents in other countries: gather info (fog of war on their army and plans), steal
technology, sabotage, fund opposition groups, influence elections, back or stop coups, counter-spies at home, and
satellite surveillance. Getting caught is a public scandal at home and abroad.

---

## 9. Events and people

- **400+ events** with choices and chains: natural disasters (country-specific: hurricanes, earthquakes, monsoons,
  droughts, wildfires), pandemics, market crashes, bank failures, strikes, scandals, leaks, refugee waves, border
  clashes, cyber attacks, tech breakthroughs, discoveries, sports wins, royal weddings, a celebrity running for
  office, and rare joke events.
- **Event chances come from the formulas**: strikes when workers are angry, coup rumours when the army is unhappy,
  worse pandemics when health spending is low.
- **People**: ministers, opposition leaders, party rivals, generals, judges, the central bank chief, CEOs, union
  bosses, religious leaders, journalists, activists, celebrities, foreign leaders and your family. Each has a portrait,
  traits, loyalty and a memory of you.

---

## 10. The formulas

Daily for armies, protests and disasters; monthly for the economy, polls and relations. Randomness uses a **seeded
generator** so reloading does not change outcomes. Delayed effects go into a queue and land over the following months.

### 10.1 Economy
```
growth/year = potential
            + 0.04*(investment - 20) + 0.03*(education 5 years ago - 50) + 0.02*trade_openness
            - 0.05*max(0, total_tax - 35) - 0.06*max(0, 50 - stability)
            - war_penalty - sanctions_penalty + world_cycle + noise(±0.5)
potential: about 1.5% for rich countries up to 6% for poor ones
inflation = 0.8*last + expectations + money_printed*(1 - reserve_absorb) + 0.3*deficit%GDP + oil/food shocks
          - 0.5*(policy_rate - neutral_rate)
unemployment: +0.4 points for every 1% of growth below potential
```

### 10.2 Debt, borrowing and the reserve currency
```
reserve_share of every currency starts at real values (USD ~58%, EUR ~20%, JPY ~6%, GBP ~5%, CNY ~2%, others small)
currency_trust = 0.3*economy_size_share + 0.2*rule_of_law + 0.15*military_power + 0.15*(100 - inflation_score)
               + 0.1*stability + 0.1*payment_network - sanctions_overuse
reserve_share_next = reserve_share + 0.002*(currency_trust - trust_of_rivals_average)
safe_debt (% of GDP) = 60 + 150*reserve_share
interest_on_debt = world_rate + 0.05*max(0, debt% - safe_debt) + 0.1*max(0, 50 - stability) + default_history
reserve_absorb = reserve_share*1.2 (capped at 0.8): how much printed money the world soaks up instead of prices rising
seigniorage income = reserve_share * world_trade * 0.002
```
So the reserve-currency country really can borrow and print with fewer consequences, but only as long as trust holds.

### 10.3 Public reaction
```
for each action a and each group g:
  stance[g][a]  from -3 (hate) to +3 (love), set per action and per ideology
  salience      = base_importance(a) * media_reach * drama
  reaction[g]   = stance * salience * (1 + polarisation * |stance| / 3) + spin_effect + noise
  group_support[g] += reaction[g] now, and a memory that fades with a 6 month half-life
if a big group's reaction < -6: protest chance (size grows with group size and anger), shown on the map
if > +6: rally
foreign_public[c] += stance_abroad[c][a] * salience; their leader weighs it by how democratic they are
markets: currency, stock index and bond yields move by business and investor reactions plus fiscal risk
polarisation rises with divisive actions, which makes laws harder to pass and protests bigger on both sides
```

### 10.4 Approval, stability, coups, revolutions
```
approval    = Σ(group_support * group_share) + honeymoon(first 12 months) + noise(±1)
economy_feel = -2*(inflation - 3) - 1.5*(unemployment - 5) + 0.5*(growth - 2)
stability   = 0.35*approval + 0.15*police + 0.15*army_loyalty - 0.2*inequality - 0.3*youth_unemployment
            + 0.1*freedom (democracies) or + 0.1*repression (dictatorships, which builds hidden anger)
            - 0.2*polarisation
coup_chance%/month = max(0, (60 - military_support)*military_clout/400 - army_loyalty/50 - institutions/40)
revolution: stability below 12 for 3+ months, chance rises each month; foreign backing raises it
```

### 10.5 Parliament and courts
```
yes_votes(party) = seats * (0.5 + 0.01*(law_alignment + favours + coalition_bonus + discipline) - 0.01*public_anger)
court_strikes_law_chance = unconstitutionality * judge_opposition * court_independence
```

### 10.6 Elections
```
vote_share(region, party) = base_loyalty + approval_effect + 0.5*economy_feel(last year)
                          + campaign_effort(region) + debate + promises - scandals + noise(±3)
```
Seats counted per region with the country's real voting system (first past the post or proportional).

### 10.7 Relations and deals
```
relation_next = relation + 0.02*(base_attitude - relation) + alliance(+0.5) + ideology(+0.3)
              + trade(0 to +0.5) - disputes(-0.5) - rivalry(-1) + Σ fading memories + public_opinion_push
accept_chance = sigmoid((value_to_them + 0.4*relation + 0.3*trust + personality - 20) / 10)
```

### 10.8 War
```
combat_power = soldiers * equipment_quality * tech * morale * supply * terrain * weather * general_skill * air_support
losses_A     = k * power_B^2 / (power_A + power_B)         Lanchester square law
front_move   = (power_A - power_B)/(power_A + power_B) * mobility
supply       = depots and rail connected to the unit, minus distance, damaged roads and enemy air
war_weariness += casualties/population*1000 + 0.5 per month at war - early rally effect
```

### 10.9 AI countries
Every AI country runs a lighter version of the same model and scores possible actions by its leader's personality and
goals. All 195 together take a few milliseconds per month, run in a background worker.

### 10.10 Showing the maths
Every stat has a **Why?** breakdown, every decision a **preview with a range**, and every stat a **history chart**
(10 years).

---

## 11. Goals, winning and losing

- Open-ended. Your **Legacy Score** grows with how much better your country got and how the world remembers you.
- **Optional victories**: Economic Superpower, Reserve Currency (make yours the world's top reserve currency),
  Peacemaker, World Power (lead the biggest bloc), Science (moon base, then Mars), Happiest Nation, Long Reign
  (20 years).
- **Losing**: voted out, coup, revolution, impeachment, conquered, assassinated, or nuclear war. Each has its own
  ending screen with a newspaper front page and a history-book summary of your rule.
- **Hall of Leaders** with past games, about **100 achievements**.
- **Tech tree**: about 50 techs in 5 branches (economy, military, energy, health, space and AI) leading to future
  events (fusion, AI automation, lab-grown food, Mars colony).

## 12. Screens

Title (globe spinning, "A Huntington Games production") → Country Select → Leader Setup → Main Game.

Main game: map fills the screen; top bar (date, speed, approval, GDP, budget, stability, currency); left menu:
Overview, Economy, Money and Debt, Budget, Laws, Parliament, Courts, Projects, Cabinet, People, Public Opinion, Social
Feed, Diplomacy, Organisations, Trade, Military, War Room, Intelligence, Technology, World News, Charts, Encyclopedia,
Settings, Credits. Right side: inbox of events and messages, news ticker along the bottom. Tutorial for the first
months (skippable).

## 13. Saves

3 slots + monthly autosave, export/import save code, versioned saves that migrate on update (never wiped).

---

## 14. Files and how it loads in the Launcher

You allowed many files for this game. Here is how that works safely with the Launcher:

- The Launcher only fetches `<game folder>/index.html` from jsDelivr and runs it in a frame, and the offline copy
  and the licence tools (`build-release.py`) also only handle that one file.
- So the game is **written as many files** (about 40 source files: engine, map, each system, data, events, UI) in
  `Sovereign/src/`, plus data files (countries, map shapes, events, names) in `Sovereign/data/`.
- A small build script, `tools/build-sovereign.js`, **joins them into `Sovereign/index.html`** automatically. That
  one file is what the Launcher loads, so it loads exactly like every other game, works in the offline copy, and the
  licence block works as normal. No Launcher code changes are needed.
- Pictures (soldiers, buildings, cars, faces) are drawn by code at load time instead of image files, which keeps
  the game small and fast.
- Expected `index.html` size: 3 to 5 MB (map shapes about 1 MB at 3 detail levels, country data about 200 KB,
  events and text about 600 KB, code about 1.5 MB). If it grows past that, rarely used extras (scenario packs,
  extra-detailed borders) can become separate files the game downloads and caches when needed.
- Map borders come from Natural Earth (public domain), credited on the Credits screen.

**The other agent editing the Launcher**: this plan does not touch `index.html` (the hub), `loader.html` or `hub/`.
The only Launcher change is adding the game card and its picture at release time, which I will do on top of whatever
that agent has merged by then.

---

## 15. Build order (one chunk per session, through `game-finish`)

| # | Chunk | Playable result |
|---|---|---|
| 1 | **Engine and map**: build script, three.js globe and flat map, zoom levels, borders for all 195 countries, map modes, performance settings, title screen with credits | Spin and zoom the whole world smoothly |
| 2 | **Country and economy core**: all country data, country select, leader setup, real-time clock with speeds, economy, budget, debt, reserve currency and money tools, Why? breakdowns, charts, saves | Rule any country and watch its economy |
| 3 | **Living map**: cities, buildings, roads, rail, ships and planes on trade routes, tiny people and cars when zoomed in, day/night, weather, Auto quality | The world looks alive |
| 4 | **Government**: parliament, courts, constitution, regions, 150 laws, cabinet, projects built on the map, central bank, state companies | Run a full government |
| 5 | **Public reaction**: groups, polls, reaction previews, news outlets, social feed, protests and rallies on the map, markets, spin, polarisation | Everything you do gets a reaction |
| 6 | **Staying in power**: elections and campaigns, election night map, coups, revolutions, impeachment, political tricks | Power can be lost |
| 7 | **Diplomacy and trade**: world leaders, conversations and summits, all diplomatic actions, UN and blocs, trade goods and prices, sanctions, real strategies table (section 5), AI countries acting | The world reacts and lives on its own |
| 8 | **War**: forces, divisions, generals, fronts, supply, air, naval, missiles, cyber, occupation, civil wars, proxy wars, peace deals, nukes, spies, with soldiers and battles shown on the map | Wars you can watch and command |
| 9 | **Events and people**: 400+ events, characters with memories, World News, disasters shown on the map | Every game tells a different story |
| 10 | **Goals and polish**: victories, Legacy Score, endings, Hall of Leaders, achievements, tech tree, tutorial, encyclopedia, balance testing (50-year AI-only runs), Chromebook speed pass | Release 1.0 |

Possible later: scenario packs (Cold War 1962...), Opposition Leader mode, multiplayer summits once `hgnet` is fixed.

---

## 16. Decisions

1. **Name**: Sovereign (decided).
2. **Leaders**: real leaders (decided).
3. **Losing an election**: still open (default: game over with an ending screen; Opposition Leader mode later).
4. **Release**: still open (one big release after chunk 10, or Early Access after chunk 3 or 4).

## 17. Progress

All 10 chunks are built (version 1.0). What is in the game, honestly counted:
- 197 countries with 2025 data and mid-2026 leaders; 3D globe with zoom to street level; cities, roads, ships on 14 sea
  lanes, planes, people, cars, crowds, project landmarks, war fronts, soldiers, explosions, disaster icons.
- Economy, budget (7 taxes, 14 ministries), central bank, pegs, euro, dollarisation, reserve currencies, IMF, default.
- 14 groups of society, about 80 laws in 13 categories, parliament with votes, courts, cabinet of 8, 25 projects.
- Public reaction to every action: headlines from 4 outlets, social posts, protests and rallies, markets, spin.
- Elections with campaigns, debates, promises, election night map; term limits; coups, revolutions, no-confidence, impeachment.
- Diplomacy: relations for every pair, leader personalities, 17 actions, treaties, sanctions, tariffs, organisations, UN
  Security Council with vetoes, 6 world goods prices, AI countries acting, requests to the player.
- War: armies from real data, fronts on real borders, allies and foreign aid, strikes, blockades, nuclear weapons, peace
  deals, annexation, spies with 5 operations. The Russia-Ukraine war is under way at the start.
- 133 events (fewer than the 400 first planned, each with 2-3 choices), 9 key people, 36 technologies, 97 achievements,
  7 victories, Legacy Score, endings with a newspaper front page, Hall of Leaders, tutorial, help and encyclopedia.
- Not built: scenario packs (Cold War 1962...), Opposition Leader mode, multiplayer.
