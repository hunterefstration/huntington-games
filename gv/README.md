# Grapevine in the launcher

The launcher is Grapevine: you need an account to use it (a device that signed in before opens offline too).

* `core.js` - account, encrypted relay link (GVLink) to the Grapevine server, friends, **cloud saves** (`HGGrapevine.sync`: every game's
  localStorage keys, newest wins, cloud wins on a new device, signing out saves then clears the device) and the `window.HGGrapevine` API
  games use as `window.parent.HGGrapevine` (or `window.opener.HGGrapevine` in a new tab).
* `ui.js` - the sign-in gate and the Account tab. Themed with the launcher's Grapevine variables.
* `vendor/` - copies from the Grapevine repo: `hgnet.js`, `gvlink.js` (`relay/`), `ed25519.js` (`parts/`).
* `account.js` - built by `tools/build-gv.sh` (commit it with the sources). `app.html` - the Grapevine app, copied from the Grapevine repo's
  `client.html` by `tools/sync-grapevine.sh`; it is what the launcher's Grapevine tab runs, signed in as the same account.
* New game with saves? Add its localStorage key prefix to `GAME_KEYS` in `core.js`, or its progress will not follow the account.

Games prove who a player is with `HGGrapevine.prove(challenge, game)` / `check(proof, challenge, game)` (signature plus the server's record of that
name's key), so a typed name is never mistaken for an account. Games work unchanged with no launcher or nobody signed in.
