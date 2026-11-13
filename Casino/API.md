# Casino: how the game page talks to the server

The casino page runs inside the launcher. All money is on the Grapevine server (`grapevine/src/archive/077-casino.js`);
the page only asks and shows. Goons have no money value; 1 goon = 100 chips.

```js
const L = window.parent.HGGrapevine;                     // null when not in the launcher / not signed in
L.eco.casino(op, args) -> Promise<reply>                  // rejects with Error(message from the server) (show it)
L.on('casino', ev => ...)                                 // live-table events while "entered"
```
Every reply has `bal: { chips, goons }` (goons is -1 for developers = unlimited) and `now` (server clock, ms: use
`offset = reply.now - Date.now()` for countdowns). "Slow down a little." means wait a second and retry.
Bets are whole chips, `limits.min`..`limits.max` (5..5000). A result's `win` is what was handed back (stake included);
profit = win - bet.

## Start and money
| op | args | reply |
|---|---|---|
| `enter` | – | `limits {min,max,rate}`, `stats {plays,wag,won,big}`, `edge {game: house edge %}`, `names {game: title}`, `feed [ {n,g,bet,win,at} ]` (recent big wins), `live` (see below), `tables` (pay tables: `slots {C,L,B,S,D,7,W,C2}` per line stake, `plinko {"12med":[...]}`, `wheel [60 slice multipliers]`, `keno {picks:[mult by hits]}`, `scratch [costs]`, `vp [[name,mult]]`), `turn` (`{g,bet}` if a hand is unfinished), `daily` (true = free spin available). Also subscribes to events. |
| `leave` | – | stop events |
| `live` | – | `live` + `bal` |
| `buy` | `{goons}` | chips += goons*100 |
| `cash` | `{goons}` | chips -= goons*100 |
| `daily` | – | `{slice, prizes[12], win}` once a day (free chips) |

## One-shot games: reply `r`
| op | args | `r` |
|---|---|---|
| `coin` | `{bet, pick:'h'|'t'}` | `{side, win, bet}` pays 1.96x |
| `dice` | `{bet, target:2..98, over:bool}` | `{roll 0..99.99, mult, win}` (over wins when roll >= target, under when roll < target) |
| `roulette` | `{bets:[{k,a}]}` | `{n 0..36, win, bet}`. `k`: `n0`..`n36` (36x), `red` `black` `odd` `even` `low` `high` (2x), `d1` `d2` `d3` dozens, `c1` `c2` `c3` columns (3x) |
| `slots` | `{bet}` | `{grid[3 rows][3 reels] of C L B S D 7 W, lines:[{line,m}], win}` lines: 0,1,2 = rows, 3 = diagonal down, 4 = diagonal up; W is wild; bet is split over 5 lines |
| `plinko` | `{bet, rows:8|12|16, risk:'low'|'med'|'high'}` | `{path:[0|1 per row], slot, mult, win}` |
| `wheel` | `{bet}` | `{slice 0..59, mult, win}` |
| `keno` | `{bet, picks:[1..40] (1-10 numbers)}` | `{drawn[10], hits, mult, win}` |
| `baccarat` | `{bets:{p,b,t}}` | `{P[cards], B[cards], pt, bt, res:'p'|'b'|'t', win}` player 2x, banker 1.95x, tie 9x (+ p/b stakes back) |
| `craps` | `{bet, side:'pass'|'dont'}` | `{rolls:[[d1,d2],...], point, pass, win}` |
| `sicbo` | `{bets:[{k,a}]}` | `{d[3], total, win}`. `k`: `big` `small` `odd` `even` (2x, lose on a triple), `triple` (31x), `t4`..`t17` totals, `s1`..`s6` a face (2x/3x/4x for 1/2/3 dice) |
| `scratch` | `{tier:0|1|2}` | `{cells[9 emoji], mult, win, bet}` three matching = win |
| `crashx` | `{bet, target:1.01..1000}` | `{crash, target, win}` instant rocket |
Cards are `{ r: 1..13 (1 ace, 11 J, 12 Q, 13 K), s: 0..3 }`.

## Games with turns (one at a time per player): reply `r = { view, bet, win?, over? }`
- `bj` (`act`: `deal {bet}`, `hit`, `stand`, `double`, `split`): `view { hands:[{cards,bet,v,done}], active, dealer:[cards], dv, over, can:[acts] }`.
- `vp` (`deal {bet}`, `draw {hold:[indexes]}`): `view { hand[5], rank, mult?, over? }`.
- `mines` (`start {bet, mines:1..24}`, `pick {i:0..24}`, `cash`): `view { mines, picked[], mult, next, bombs?[], hit?, over?, cashed? }`.
- `hilo` (`start {bet}`, `guess {g:'hi'|'lo'}`, `cash`): `view { card, n, mult, hiX, loX, was?, same?, over?, cashed? }`.
- any of them with `act:'state'` returns the unfinished hand (`r.resume`) or `r: null`.

## Live tables (everyone shares them; rounds run on the server clock)
`live = { lr, crash, race, pot, duels }`, each with `r` (round number), `cyc` (ms per round), `bet` (ms of betting from
the round start; round start = `r * cyc` in server time) and `players [{n, a}]`.
- **Live roulette** `lr {bets:[{k,a}]}` (same bets as roulette; can add more until betting closes) -> `r {round, bets}`.
  Events: `{ev:'lr', r, n}` when betting closes (spin to `n`), `{ev:'paid', g:'lr', r, results:[{n,win,stake}]}` at `pay` ms.
- **Live rocket** `crash {bet, auto?}` during betting, then `crash {act:'cash'}` in flight -> `r {mult, win}`.
  Multiplier in flight = `exp(live.crash.k * msSinceFlightStart)`. Events: `crashGo {r}`, `out {r,n,mult,win}`, `crash {r,c}` (blew up at c), `paid`.
- **Horse racing** `race {bets:[{h:0..5, a}]}`; `live.race.names`, `.odds`. Events: `race {r, order:[horse indexes, winner first]}` when betting closes (animate ~12 s), `paid`.
- **The Pot** `pot {bet}`: winner takes 97% of everyone's chips, chance = your share. Events: `bet {g:'pot', n, a, total}`, `paid {g:'pot', winner, total, results}`.
- **Duels** `duel {act:'open', bet}` -> `r {id}`; `duel {act:'take', id}` -> `r {won, prize, vs}`; `duel {act:'cancel', id}`.
  Events: `duels {list:[{id,n,bet,at}]}`, `duel {a, b, bet, winner, prize}`.
- Also: `bet {g, r, n, a}` whenever anyone bets, `feed {item}` for big wins, `bal {bal}` when your balance changes
  outside a reply (a live round paid you).
