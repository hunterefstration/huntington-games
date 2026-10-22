# Grapevine Lite

The launcher's second tab: your normal Grapevine account (same recovery key) in the Huntington Games launcher.

* `core.js` - account, relay link, friends, and the `window.HGLite` API games use (`parent.HGLite` inside the launcher's iframe).
* `ui.js` - the tab. Themed purely with the launcher's Grapevine variables.
* `vendor/` - copies from the Grapevine repo: `hgnet.js` and `gvlink.js` (`relay/`), `ed25519.js` (`parts/`).
* `lite.js` - built by `tools/build-lite.sh` (HGNet minified + vendor + core + ui). The launcher downloads it when the tab is opened,
  or at start-up if someone signed in before. Commit it with the sources.

Connection: GVLink over public MQTT relays on port 443 (encrypted end to end; see `relay/server.js` in the Grapevine repo).
`lite: 1` in the hello makes the server send this session only friends/profile frames (no chat).

Games: a host sends `{t:'gvq', n:<challenge>}`, the guest answers `{t:'gva', p:HGLite.prove(n, '<game>')}`, and the host calls
`HGLite.check(p, n, '<game>')`, which verifies the signature and that the server really has that name bound to that key.
Only then is a player shown as verified with a Friend button. Games work unchanged when there is no launcher or nobody is signed in.
