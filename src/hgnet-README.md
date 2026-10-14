# HGNet - online multiplayer for Huntington Games

HGNet is one self-contained JavaScript file (`src/hgnet.js`, ES5, no build step) that gives any of our
games online play with a **6-digit room code**. Paste it inline into the game, call `HGNet.create()`,
and you get a host/join lobby, reliable and fast messages, reconnects and a "Test my connection" panel.

## Why it exists

Two players, one in New York and one in North Carolina, could not play: the guest joined and was
disconnected at once, even with the long manual codes. Our games connected players with WebRTC
peer-to-peer only (PeerJS, one Google STUN server, no TURN). WebRTC has to punch through both players'
routers (NATs), and between most homes and schools that fails. The long code only swaps the connection
details by hand, so it fails at the same point. Frontline's fallback relays also ran on ports 8084, 8884
and 8081, which school firewalls often block.

HGNet works the other way round:

* **Relays carry the game.** Every session is set up and runs through public MQTT-over-WebSocket
  servers ("relays"). These are ordinary outgoing `wss://` connections, preferably on port 443, and
  almost every network allows them.
* **Many relays at once.** The host connects to every relay it can reach and serves the room on all of
  them. Each guest uses whichever relays it can reach, so players behind different firewalls can still
  play together: the host passes their messages between them. If a relay dies, traffic moves to another
  one within a second or two.
* **WebRTC is only a speed-up.** After the session is running, HGNet tries a direct WebRTC link in the
  background. If it connects, traffic moves onto it. If it stalls or fails, traffic moves back to the
  relay and the game never notices. A WebRTC failure never ends a session.
* **Built for Chromebooks.** Background tabs get their timers throttled. Players are only marked
  *lagging* or *reconnecting* for the UI, and a player is removed only after 90 s of silence. A guest
  whose Wi-Fi blips reconnects by itself and keeps the same player id.

---

## Quick start

```html
<script>
/* paste the whole of src/hgnet.js here */
</script>
<script>
var net = HGNet.create({ game: 'blocky' });          // one HGNet object per session

net.on('status', function (text) { statusEl.textContent = text; });
net.on('join', function (peer) { addPlayer(peer); });
net.on('leave', function (peer, reason) { removePlayer(peer.id); });
net.on('message', function (peer, msg, meta) { handle(peer.id, msg); });
net.on('closed', function (reason, text) { showMenu(text); });

// HOST
net.host({ name: 'Ava', maxPlayers: 8 }).then(function (r) {
  codeEl.textContent = r.code;                         // e.g. "482913" - tell your friends
}, function (err) { errorEl.textContent = err.message; });

// GUEST
net.join('482913', { name: 'Ben' }).then(function (r) {
  myId = r.id;                                         // 1, 2, 3 ...  (the host is always 0)
}, function (err) { errorEl.textContent = err.message; }); // err.code: 'not-found', 'blocked', 'full' ...
</script>
```

HGNet loads mqtt.js (`mqtt@5.10.1`) and PeerJS (`peerjs@1.5.4`) from jsDelivr the first time they are
needed. If jsDelivr is blocked it tries unpkg. If `window.mqtt` / `window.Peer` already exist (for
example because the game inlines them), those are used and nothing is downloaded.

---

## API

### `HGNet.create(options)` -> `net`

One `net` is one session. After it closes, make a new one to host or join again.

| option | default | meaning |
|---|---|---|
| `game` | `'game'` | Short game id (`a-z 0-9 _ -`). Rooms of different games never see each other. |
| `relays` | 5 public brokers (below) | List of `'wss://host:port/path'` strings or `{ url, name, username, password }`. |
| `peer` | PeerJS cloud | PeerJS signalling server `{ host, port, path, secure, key }`, or `false` for no WebRTC. |
| `iceServers` | Google + Cloudflare STUN, PeerJS TURN | WebRTC ICE servers. |
| `forceRelay` | `false` | Never try WebRTC. |
| `noRelay` | `false` | *Testing:* game data may only travel over WebRTC (handshakes still use relays). |
| `dropRate` | `0` | *Testing:* drop this fraction (0-1) of every outgoing frame. |
| `latency`, `jitter` | `0` | *Testing:* delay every outgoing frame by `latency + random(jitter)` ms. |
| `guestToGuest` | `true` | Host forwards guest messages addressed to `'all'` or to another guest. |
| `resume` | `true` | Remember the session token in `sessionStorage`, so a reloaded page rejoins with its old id. |
| `log` | off | `true` = console, or a function `(line) => {}`. `net.logs()` always keeps the last 300 lines. |
| timings | see below | `lagMs` 4000, `reconnectingMs` 10000, `dropMs` 90000, `giveUpMs` 120000, `rejoinMs` 120000, `notFoundMs` 5000, `relayConnectMs` 8000, and more (`HGNet.defaults.timings`). |

Default relays, all tried in parallel. Port 443 is listed first because it gets through the most firewalls:

```
wss://mqtt.eclipseprojects.io:443/mqtt
wss://public.cloud.shiftr.io:443        (username/password 'public')
wss://broker.emqx.io:8084/mqtt
wss://broker.hivemq.com:8884/mqtt
wss://test.mosquitto.org:8081/mqtt
```

**URL overrides** (for testing a built game without editing it; the URL value wins over the code option):
`?hgRelays=ws://localhost:9001,wss://x/mqtt` · `hgPeer=localhost:9000/` (or `off`) · `hgForceRelay=1` ·
`hgNoRelay=1` · `hgDrop=0.2` · `hgLatency=100` · `hgJitter=50` · `hgLog=1` · `hgIce=none`.
Pass `urlParams: false` to `create()` to ignore them.

### `net.host({ name, maxPlayers, info, accept, code })` -> `Promise<{ code }>`

* `maxPlayers` counts the host (2-64, default 8).
* `info`: any JSON (max 4 KB) that guests receive as `hostInfo.info`, for example the map or mode.
* `accept(req)`: optional. Called with `{ name, info }` for each new player. Return `true` (or nothing)
  to let them in, `false` to refuse, or a **string** to refuse with that message, for example
  `return started ? 'That game has already started.' : true;`. It may return a Promise. While a Promise
  is pending the guest is told to wait.
  Players coming *back* with their token, after a reload or a long blip, skip `accept` and get their old id.
* `code`: ask for a specific code. If it is taken you get a different one.

HGNet picks a random code, checks that no other host answers for it on any relay, then resolves. This
usually takes about 2 s. Rejects with `err.code === 'blocked'` if no relay can be reached.

### `net.join(code, { name, info, token })` -> `Promise<{ id, hostInfo, code, rejoined }>`

* `code`: the 6 digits. Spaces and dashes are ignored.
* `id`: your player id (guests are 1..999, the host is 0).
* `hostInfo`: `{ name, info, maxPlayers }`.
* `rejoined`: `true` if you got your previous slot back (same tab rejoining within ~2 minutes).

**Errors**. Every rejection is an `Error` with `.code` and a message you can show as-is:

| `err.code` | message shown |
|---|---|
| `bad-code` | Game codes are 6 digits - check the code with the host. |
| `not-found` | No game with code 123456 - check the digits with the host. |
| `blocked` | Your network is blocking our game servers - try another network (like home Wi-Fi or a phone hotspot), or ask whoever runs this network to allow them. "Test my connection" shows which ones are blocked. |
| `full` | That game is full (8/8 players). |
| `refused` | Whatever your `accept()` returned, for example "That game has already started." |
| `busy` | This `net` was already used. Create a new one. |
| `closed` | You called `net.close()` while joining. |

### Events: `net.on(event, fn)` / `net.off(event, fn)`

| event | arguments | host side | guest side |
|---|---|---|---|
| `status` | `(text)` | Human-readable progress, e.g. "Room 482913 is open on 3 of 5 game servers", or "Lost the connection to the game servers - reconnecting..." when the host's own network drops | e.g. "Joined game 482913 (via game server)", "Connection lost - reconnecting..." |
| `join` | `(peer)` | A guest joined. `peer.rejoin === true` means they came back after leaving or timing out (same id): **send them the full game state**. | Fired for the host and for every player already in the room right after `join()` resolves, then for each new player. |
| `leave` | `(peer, reason)` | `reason`: `'left'` (closed the tab or called `close()`), `'timeout'` (silent for 90 s), `'kicked'` | Another player left (same reasons). |
| `message` | `(peer, msg, meta)` | `meta.fast` = sent as fast. `meta.to` = `'host'` or `'all'`. | `peer` is the sender (the host, or another guest whose message the host forwarded). |
| `route` | `(peer, 'direct' \| 'relay')` | Route to that guest changed. | Route to the host changed. |
| `lagging` | `(peer, isLagging)` | Nothing heard from that guest for 4 s (`true`), or they are back (`false`). | Same for the host, and for other players (told by the host). |
| `reconnecting` | `(peer?)` | Guest silent for 10 s (or its relays reported it gone). **Keep their character**, show a badge. | No `peer`: *we* lost the host and are reconnecting. With `peer`: another player is reconnecting. |
| `reconnected` | `(peer?, { rejoin })` | Guest is back. If `rejoin` is true their page restarted, so resend the full state. | No `peer`: we are back. `rejoin: true` means the host had dropped us; the host will resend state. |
| `closed` | `(reason, text)` | Fires once after a successful `host()`/`join()`. `reason`: `'closed'` (you called `close()`). | `'host-left'`, `'kicked'`, `'lost'` (no contact with the host for 2 minutes, or we came back after the host had already given our slot up: "You were away too long and lost your place - join again with the code."), `'closed'`. |

`peer` objects are `{ id, name, info, isHost, route, rtt, lagging, state }` with `state` one of
`'connected' | 'lagging' | 'reconnecting' | 'left'`. The same object is passed in every event for that
player, so you can keep a reference.

### Sending

```js
net.send(to, msg, { fast: false })   // returns true if queued
```

* `to`: a player id, `'host'` (or `0`), `'all'`, or (host only) an array of ids. The host can add
  `{ except: id | [ids] }`.
* `msg`: anything JSON-serialisable, up to 4 MB once encoded. Big messages are split into ≤ 32 KB pieces
  automatically.
* **Reliable** (default): delivered exactly once, in order per sender→receiver, even across relay
  switches, WebRTC up/downgrades and reconnects. Use it for joins, chat, purchases, "player died",
  game start/end, full-state resyncs.
* **Fast** (`{ fast: true }`): no acknowledgements. A fast message may be lost, and it is dropped if a
  newer fast message from the same sender already arrived. You never get stale data after fresh data.
  ("Same sender" means the original sender: fast messages the host forwards from different guests do not
  shadow each other or the host's own snapshots.)
  Use it for things that are replaced 10-20 times a second: positions, inputs, snapshots.
  Keep fast messages under ~8 KB.
* A guest sending to `'all'` reaches the host (as a `message` with `meta.to === 'all'`) **and** every other
  guest. The host forwards it. A guest can also send to one other player's id.
* `net.forward(fromId, to, msg, opts)`, host only: send `msg` to `to` so it arrives as if `fromId` sent it.
  For example, relay a chat line after filtering it.
* `net.kick(id, text)`, host only: the guest gets `closed('kicked', text)`.
* `net.backlog(id)` = reliable messages to that peer not yet confirmed (guests: `net.backlog()`). If this
  keeps growing, slow down.

### Other members

`net.peers()` (copies of the peer objects; a guest's list includes the host) · `net.id` · `net.isHost` ·
`net.code` · `net.state` (`idle | connecting | hosting | joining | joined | reconnecting | closed`) ·
`net.statusText` · `net.hostInfo` · `net.getStats()` (bytes per route, retransmits, malformed frames,
relay list with up/down and ms) · `net.logs()` · `net.close()` (says goodbye to everybody; also runs
automatically when the page is closed or reloaded) · `HGNet.isValidCode(s)` · `HGNet.version` ·
`HGNet.defaults`.

---

## Message patterns for host-authoritative games (Frontline, Blocky Shooter, Tower Defense)

The host runs the real simulation. Guests send *inputs* and draw what the host tells them.

```js
// ---- host ----
net.on('join', function (p) {
  spawnPlayer(p.id, p.name);
  net.send(p.id, { t: 'full', state: world.serialize() });        // reliable, chunked if big
});
net.on('reconnecting', function (p) { markAway(p.id); });          // keep the character in the world
net.on('reconnected', function (p, info) {
  unmarkAway(p.id);
  if (info.rejoin) net.send(p.id, { t: 'full', state: world.serialize() });
});
net.on('leave', function (p, reason) { removePlayer(p.id); });     // 'timeout' only after 90 s
net.on('message', function (p, m) {
  if (m.t === 'in') applyInput(p.id, m);                           // fast inputs
  else if (m.t === 'buy') tryBuy(p.id, m.item);                    // reliable actions
});
setInterval(function () {                                           // 20 Hz snapshots, fast
  net.send('all', { t: 'snap', tick: world.tick, s: world.snapshot() }, { fast: true });
}, 50);
// events that must not be missed: reliable
function onKill(a, b) { net.send('all', { t: 'kill', a: a, b: b }); }

// ---- guest ----
net.on('message', function (p, m) {
  if (m.t === 'full') world.load(m.state);
  else if (m.t === 'snap') world.applySnapshot(m);                 // newest only, never stale
  else if (m.t === 'kill') showKill(m.a, m.b);
});
setInterval(function () { net.send('host', { t: 'in', keys: keys, aim: aim }, { fast: true }); }, 50);
buyButton.onclick = function () { net.send('host', { t: 'buy', item: 'tank' }); };
```

Tips:

* **Fast snapshots to `'all'` are cheap through relays.** HGNet publishes one copy per relay instead of
  one per player. 9 guests at 20 Hz with 1.4 KB snapshots cost the host about 22 KB/s. Players on WebRTC
  get their own copy. Per-player snapshots (fog of war) cost one copy per player.
* **Lower the snapshot rate on the relay route.** If `peer.route === 'relay'` or `peer.rtt > 250`, sending
  10 Hz instead of 20 Hz with client-side interpolation feels the same and halves the traffic.
* **Lobby / game started.** Use `accept()` to refuse new players once the match started. Returning players
  are let back in automatically.
* **Peer-to-peer style games (Tetris battles, the stock-market room).** Guests can send to `'all'` or to
  one player's id. The host forwards it, so you need no relay code yourself.
* **Do not trust guests.** The host should validate guest messages (ranges, cooldowns) like any server.
* **Background tabs.** HGNet keeps a hidden player connected, but the browser stops
  `requestAnimationFrame` in hidden tabs. A host that runs its simulation inside `requestAnimationFrame`
  freezes the game for everyone while its tab is hidden. Run the host simulation on `setInterval`, or
  tell the host to keep the game tab visible.

## Showing connection status

* Show the `status` text under the code / join box while connecting.
* Show a small route badge per player: `Direct` (WebRTC) or `Relay`, and `peer.rtt` in ms
  (`net.peers()` refreshes these each tick; redraw about once a second).
* `lagging` → grey the name or show an hourglass. `reconnecting` → "Reconnecting...". On a guest, show a
  banner when `reconnecting` fires without a peer argument.
* Map `closed` reasons to screens: `host-left` → "The host left the game." `kicked` → show the text.
  `lost` → "Lost connection to the host." with a *Test my connection* button.

### "Test my connection"

```html
<button id="testBtn">Test my connection</button>
<div id="diag"></div>
<script>
testBtn.onclick = function () {
  HGNet.renderDiagnostics(document.getElementById('diag'), null, { game: 'blocky' });  // returns Promise<results>
};
</script>
```

`HGNet.diagnose(opts)` returns a Promise with the raw results, without drawing anything:

```js
{ relays: [{ name, url, ok, connectMs, rttMs, error }],     // connect + publish/receive round trip per relay
  peerServer: { ok, ms, error },                             // PeerJS signalling server reachable?
  webrtc: { ok, host, srflx, relay, error },                 // could WebRTC gather public (STUN) / TURN candidates?
  summary: { level: 'good' | 'ok' | 'bad', canPlay, text, advice } }
```

`renderDiagnostics(el, results)` draws a small dark panel: one row per route with **OK** / **Blocked** /
**Limited** and the time in ms, plus a summary sentence and advice. Pass the same `relays` / `peer`
options as the game so the test checks the servers the game really uses.

---

## How it works (for maintainers)

* **Topics** on every relay: `hgnet1/<game>/<code>/h` (host inbox), `.../g/<endpoint-id>` (one inbox per
  player), `.../b` (host → everyone: fast broadcasts, goodbye, the host's last will).
* **Joining.** The guest connects to all relays in parallel and sends a join request ("hello") on each as
  soon as it is subscribed, repeating every 1.5 s. The host answers on the relay each hello came in on.
  That is how the host learns which relays reach which guest.
* **Routes.** Both sides send heartbeats on every relay they share: every 2 s on the main relay, 5 s on the
  spares, 1 s on WebRTC. Each heartbeat gives an RTT, and unanswered heartbeats give a loss estimate per
  relay. Data goes on WebRTC if it is healthy, else on the relay with the best RTT + loss score among those
  that recently carried that peer's heartbeats, so an overloaded public broker that silently drops part
  of the traffic is avoided even when its RTT looks fine. Retransmissions rotate through other routes, so
  a dead route costs at most one retry.
* **Reliable stream.** Per peer and direction: sequence numbers, cumulative + selective acks piggy-backed on
  any frame, RTO from the measured RTT, early retransmit of holes, a 128-message window, an in-order
  reorder buffer, and duplicates dropped. A malformed frame is rejected *before* it can use up a sequence
  number.
* **Liveness.** Heartbeats are answered straight from the network event (not from a timer), so a throttled
  background tab still answers within milliseconds. If our own timers were frozen (laptop asleep), that
  time is not counted against the other players.
* **Relay health.** An idle relay connection is self-checked with an echo through our own inbox every
  10 s. Two missed echoes recycle the connection. As soon as a peer starts lagging, the computer wakes up,
  or the browser reports the network is back, every relay is checked at once and a single missed echo
  recycles it, so a connection that died silently (Wi-Fi switch, sleep) is replaced within about 6 s.
  A connection that had been up for a while reconnects after 0.3 s; one that a broker keeps closing right
  after connecting backs off (0.5, 1, 2, 4, then every 5 s), so a misbehaving relay is never hammered.
  Relays that never worked back off up to 30 s.
* **Last will.** Each MQTT connection registers a "connection lost" message. If a tab crashes or its
  network dies, the broker tells the other side at once, so the UI shows *reconnecting* after about 2 s
  instead of 10 s.
* **Goodbye.** On `close()` and on `pagehide` HGNet writes the goodbye and an MQTT DISCONNECT straight onto
  the WebSocket, because mqtt.js would only send them on a later tick and that never comes when a tab is
  closing. Guests learn "host left" in milliseconds.
* **Codes.** Before serving a code the host publishes a probe on it and listens for 1.5 s. If two hosts
  pick the same code at the same moment, the lower probe nonce keeps it.
* **Host outage.** If the host itself loses every relay (its Wi-Fi drops), its status says "Lost the
  connection to the game servers - reconnecting...", guests show as lagging/reconnecting, and messages
  queue up. Nobody is dropped for the host's own outage, and rejoin slots are extended by its length.
  When the host is back, its guests get `reconnected` and the queued messages are delivered in order.
  (Guests still give up on their own after 2 minutes without the host.)
* **Rejoin.** A guest the host no longer knows gets a "not known" reply. It then rejoins with its session
  token under a fresh endpoint id, so nothing from the old connection can mix into the new one, and the
  host restores the same id. The token lives in `sessionStorage`, so a reloaded page does the same. If the
  host has already forgotten the slot (dropped after `dropMs` and not back within `rejoinMs`), the guest
  is told so and closes with `'lost'`; it is never silently given a different id.
* **Duplicated tabs.** Duplicating a browser tab copies its `sessionStorage`, token included. If a join
  arrives with a token whose owner is still connected and answering, the newcomer becomes a new player
  instead of taking over the slot, so the two tabs cannot keep stealing it from each other.

## Limits and caveats

* **Public relays are public.** Anyone who knows the topic can read room traffic, and someone who
  deliberately sniffs a room could inject messages. HGNet validates and size-limits everything it receives
  and ignores junk, but it does not encrypt or authenticate. Never send passwords or personal data, and
  treat guest messages as untrusted on the host.
* The public brokers are free community services with no uptime guarantee. That is why there are five. If
  one disappears for good, replace it in `DEFAULT_RELAYS` (or pass `relays`).
* Guests are only connected through the host (a star). If the host's network goes down for longer than
  about 2 minutes, the room is gone.
* If the host and a guest share **no** relay (each network blocks the other's), the guest sees
  "No game with code ...". *Test my connection* on both machines shows the blocked relays.
* jsDelivr (or unpkg) must be reachable for mqtt.js/PeerJS unless the game inlines those libraries.

## Testing locally

`src/hgnet-test.html` is a test bench (host/join/send buttons, a player table, the diagnostics panel, and
`window.T` hooks for Playwright). With a local broker and PeerJS server, open for example:

```
hgnet-test.html?relays=ws://localhost:9001&peer=localhost:9000/
```

The Playwright suite used during development covers: 3-guest rooms; messages in every direction;
500-message ordering under 25 % loss + jitter; fast-message ordering; 130-150 KB messages; the WebRTC
upgrade; forceRelay; dead and black-hole relays; guests on different relays bridged by the host; a relay
dying and coming back; a relay that silently drops 40 % of messages; a relay that keeps closing the
connection; a relay connection that dies silently; the host losing every relay for longer than the drop
timeout; WebRTC stalling or closing mid-game; hidden/throttled and fully paused tabs; drop + token
rejoin; rejoining after the slot expired; duplicated tabs; page reload; tab crash; garbage injection;
`accept()` (including a guest that gives up while it is pending); code collisions; 10-player load; the
host's tab closing; and the diagnostics panel.

---

## Player troubleshooting (for the help screen)

**"No game with code 123456"**
Check the six digits with the host. The code changes every time the host makes a new game, and it stops
working when the host leaves the lobby or closes the tab. If the digits are right and it still fails, the
two of you may be on networks that block different game servers. Both press **Test my connection**.

**"Your network is blocking our game servers"**
The network you are on (often school or work Wi-Fi) blocks all of our game servers. Press **Test my
connection** to see which ones. Then:
1. Try another network: home Wi-Fi, or a phone hotspot.
2. On a school network, ask IT to allow secure WebSocket (`wss://`) connections to the servers shown as
   **Blocked**. The first two use port 443, the normal web port.

**"Reconnecting..."**
Your connection to the host dropped for a moment (Wi-Fi switching, a busy network). Do nothing and keep
the game tab open. It reconnects by itself and you keep your place. You have about 2 minutes. Switching
to another tab for a minute is fine.

**"Lost connection to the host" / "The host left the game"**
The host closed or reloaded the game, or their internet went down. Ask them for a new code.

**Lag or rubber-banding**
* Look at the ms numbers in **Test my connection**: under 150 ms is great, 150-400 ms is playable, over
  400 ms will feel laggy.
* *Relay* next to a name is normal and fine. *Direct* is a bit faster, but only some networks allow it.
* Close video tabs and downloads, move closer to the Wi-Fi router, or use a different network.
* The **host's** connection matters most, because everything goes through the host. The player with the
  best internet should host and keep the game tab in front.

**What the "Test my connection" rows mean**

| row | OK means | Blocked / Limited means |
|---|---|---|
| Game server *name* | You can reach this relay. The ms is a full round trip. | This network blocks it. You only need **one** working server, ideally the same one as the host. |
| WebRTC signalling | Direct connections can be set up. | No direct connections. Games still work through the game servers. |
| Direct connection (WebRTC) | Your network allows direct links (faster). | *Limited* = direct links only work on the same Wi-Fi. Games still work through the game servers. |

The coloured sentence at the top sums it up. If it says online play should work but a game still fails,
both players should run the test and compare: you need at least one game server that is **OK** for both of
you.
