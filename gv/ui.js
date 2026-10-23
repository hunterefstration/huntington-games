// Grapevine - the launcher tab. Draws into any element with HGGrapevineUI.mount(el).
// Styled by the launcher's Grapevine theme variables (--panel, --raise, --line, --signal ...); the
// small stylesheet below only uses those, so it follows the theme wherever it is mounted.
(function () {
  'use strict';
  if (window.HGGrapevineUI) return;
  var L = window.HGGrapevine;

  var css = [
    '.gl{max-width:640px;margin:0 auto;font-family:var(--sans)}',
    '.gl *{box-sizing:border-box}',
    '.gl .k{font-family:var(--mono);font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim)}',
    '.gl .sect{font-family:var(--mono);font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--dimmer);padding:16px 2px 6px}',
    '.gl h2{margin:0 0 4px;font-family:var(--mono);font-weight:600;font-size:14px;letter-spacing:.28em;text-transform:uppercase;color:var(--signal)}',
    '.gl p.sub{color:var(--dim);font-size:13px;margin:0 0 18px;line-height:1.55}',
    '.gl .card{background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:18px}',
    '.gl .field{margin-bottom:14px}',
    '.gl .field label{display:block;font-family:var(--mono);font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);margin-bottom:6px}',
    '.gl input[type=text],.gl input[type=password]{width:100%;background:var(--ground);border:1px solid var(--line);color:var(--text);padding:10px 12px;border-radius:3px;font-family:var(--mono);font-size:13px;outline:none;transition:border-color .15s}',
    '.gl input:focus{border-color:var(--signal)}',
    '.gl .hint{font-size:12px;color:var(--dim);margin-top:5px;line-height:1.5}',
    '.gl .hint.bad{color:var(--danger)}',
    '.gl .go{width:100%;background:linear-gradient(100deg,var(--signal),var(--signal2));color:var(--on-signal);border:0;padding:11px;border-radius:3px;box-shadow:0 6px 22px color-mix(in srgb,var(--signal) 28%,transparent);font-family:var(--mono);font-weight:600;font-size:12px;letter-spacing:.16em;text-transform:uppercase;cursor:pointer;margin-top:6px}',
    '.gl .go:hover{filter:brightness(1.1)}.gl .go:disabled{opacity:.45;cursor:default;filter:none}',
    '.gl .mbtn{background:var(--raise);border:1px solid var(--line2);border-radius:3px;padding:7px 12px;font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--text);cursor:pointer}',
    '.gl .mbtn:hover{border-color:var(--signal);color:var(--signal)}',
    '.gl .mbtn.warn{color:var(--danger);border-color:color-mix(in srgb,var(--danger) 45%,transparent)}.gl .mbtn.warn:hover{border-color:var(--danger)}',
    '.gl .mbtn:disabled{opacity:.5;cursor:default}',
    '.gl .seg{display:flex;gap:4px;margin-bottom:16px;border-bottom:1px solid var(--line)}',
    '.gl .seg button{background:none;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;padding:8px 12px;font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);cursor:pointer}',
    '.gl .seg button:hover{color:var(--text)}.gl .seg button.on{color:var(--signal);border-bottom-color:var(--signal)}',
    '.gl .me{display:flex;align-items:center;gap:12px;margin-bottom:16px}',
    '.gl .av{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none;background:linear-gradient(135deg,var(--signal),var(--signal2));color:var(--on-signal);font-family:var(--mono);font-weight:600;font-size:17px}',
    '.gl .me .nm{font-weight:600;font-size:17px}',
    '.gl .me .st{font-size:12px;color:var(--dim);display:flex;align-items:center;gap:6px}',
    '.gl .me .sp{flex:1}',
    '.gl .dot{width:8px;height:8px;border-radius:50%;background:var(--dimmer);flex:none;display:inline-block}',
    '.gl .dot.on{background:var(--live);box-shadow:0 0 8px color-mix(in srgb,var(--live) 60%,transparent)}',
    '.gl .dot.wait{background:var(--signal)}.gl .dot.bad{background:var(--danger)}',
    '.gl .row{display:flex;align-items:center;gap:10px;padding:9px 4px;border-top:1px solid var(--line)}',
    '.gl .row:first-child{border-top:0}',
    '.gl .row .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}',
    '.gl .row .sm{font-size:11.5px;color:var(--dim)}',
    '.gl .row .btns{display:flex;gap:6px;flex:none}',
    '.gl .add{display:flex;gap:8px;margin-bottom:6px}.gl .add input{flex:1}',
    '.gl .empty{color:var(--dim);font-size:13px;padding:18px 4px;line-height:1.6}',
    '.gl .keybox{font-family:var(--mono);font-size:13px;word-break:break-all;background:var(--ground);border:1px dashed var(--signal);border-radius:3px;padding:12px;margin:10px 0;user-select:all}',
    '.gl .chk{display:flex;gap:8px;align-items:center;font-size:13px;color:var(--dim);margin:10px 0}',
    '.gl .diag{font-family:var(--mono);font-size:12px;line-height:1.7;margin-top:10px}',
    '.gl .diag .ok{color:var(--live)}.gl .diag .no{color:var(--danger)}',
    '.gl .hero{text-align:center;margin:6px 0 22px}',
    '.gl .hero h1{margin:0 0 6px;font-family:var(--mono);font-weight:600;font-size:clamp(15px,3.4vw,20px);letter-spacing:.24em;text-transform:uppercase;color:var(--signal);-webkit-text-fill-color:initial;background:none;white-space:normal}',
    '.gl .hero p{margin:0;color:var(--dim);font-size:14px;line-height:1.55}',
    '.gl .perks{display:grid;grid-template-columns:repeat(auto-fit,minmax(138px,1fr));gap:10px;margin:0 0 18px}',
    '.gl .perk{background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:12px 13px}',
    '.gl .perk b{display:block;font-size:13.5px;margin-bottom:3px}',
    '.gl .perk span{font-size:12.5px;color:var(--dim);line-height:1.5}',
    '.gl .perk i{font-style:normal;font-family:var(--mono);color:var(--signal);font-size:10px;letter-spacing:.16em;text-transform:uppercase;display:block;margin-bottom:4px}',
    '.gl details{border-top:1px solid var(--line);padding:10px 2px}',
    '.gl details:last-child{border-bottom:1px solid var(--line)}',
    '.gl summary{cursor:pointer;font-size:13.5px;font-weight:600;list-style:none}',
    '.gl summary::before{content:"+";display:inline-block;width:1.2em;color:var(--signal);font-family:var(--mono)}',
    '.gl details[open] summary::before{content:"-"}',
    '.gl details p{margin:8px 0 2px 1.2em;font-size:13px;color:var(--dim);line-height:1.6}',
    '.gl .note{background:color-mix(in srgb,var(--signal) 9%,transparent);border:1px solid color-mix(in srgb,var(--signal) 35%,transparent);border-radius:4px;padding:10px 12px;font-size:12.5px;line-height:1.55;margin:10px 0}',
    '.gl .toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:var(--raise);border:1px solid var(--line2);border-radius:3px;padding:9px 14px;font-size:13px;z-index:30;max-width:90vw}',
    '.gl .toast.bad{border-color:var(--danger);color:var(--danger)}'
  ].join('\n');

  function h(tag, attrs) {
    var e = document.createElement(tag), i, c;
    if (attrs) for (var k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') e[k] = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    for (i = 2; i < arguments.length; i++) {
      c = arguments[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) { c.forEach(function (x) { if (x) e.appendChild(x); }); continue; }
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }

  var root, gate = false, mounts = [], view = 'saves', mode = 'in', pendingKey = null, toastT = null, busy = false, diagHtml = null;

  function toast(msg, bad) {
    var old = document.getElementById('gl-toast'); if (old) old.remove();
    var w = h('div', { class: 'gl', id: 'gl-toast' }, h('div', { class: 'toast' + (bad ? ' bad' : ''), text: msg, role: 'status' }));
    document.body.appendChild(w); clearTimeout(toastT); toastT = setTimeout(function () { w.remove(); }, 4200);
  }
  function statusDot() {
    var s = L.status().status;
    return s === 'online' ? 'on' : (s === 'connecting' || s === 'offline') ? 'wait' : s === 'error' ? 'bad' : '';
  }
  function statusLine() {
    var s = L.status();
    if (s.status === 'online') return 'Connected to Grapevine';
    if (s.status === 'connecting') return s.text || 'Connecting...';
    if (s.status === 'offline') return 'Offline - trying again';
    if (s.status === 'error') return s.text || 'Something went wrong';
    return '';
  }

  // ---------------- signed out ----------------
  // What a brand-new player needs to know, in the order they will wonder about it.
  function explainer() {
    var box = h('div');
    box.appendChild(h('div', { class: 'hero' }, h('h1', { text: 'Welcome to Huntington Games' }),
      h('p', { text: 'Free games that run right in your browser, now with one account for everything.' })));
    box.appendChild(h('div', { class: 'perks' },
      h('div', { class: 'perk' }, h('i', { text: 'Saves' }), h('b', { text: 'Your progress follows you' }), h('span', { text: 'Every game saves to your account. Sign in on another computer and it is all there.' })),
      h('div', { class: 'perk' }, h('i', { text: 'Friends' }), h('b', { text: 'One name in every game' }), h('span', { text: 'Play Blocky Shooter or Frontline with someone and tap + Friend. They show up in Grapevine.' })),
      h('div', { class: 'perk' }, h('i', { text: 'Grapevine' }), h('b', { text: 'Chat is built in' }), h('span', { text: 'Rooms, direct messages and friends, without leaving the launcher.' })),
      h('div', { class: 'perk' }, h('i', { text: 'No password' }), h('b', { text: 'Just a recovery key' }), h('span', { text: 'No email and no password. You get a long code that is your account. Keep it safe.' }))));
    return box;
  }
  function faq() {
    var box = h('div', { style: 'margin-top:20px' });
    box.appendChild(h('div', { class: 'sect', text: 'questions' }));
    [['What is a recovery key?', 'A long random code that works like a password you never have to think up. When you create an account it is shown once. Save it in a notes app, a password manager, or download it as a file here. To use your account on a new device, sign in with it.'],
     ['What if I lose it?', 'Nobody can get it back, not even us, because we never see it. Without it that account and its saves are gone and you would have to start a new one. Save it before you click Continue.'],
     ['Is it private and safe?', 'Your key stays on your device and is never shown to games. What you send to Grapevine is encrypted on the way. Do not share your key with anyone, and do not use your full real name or personal details.'],
     ['Does it work on school Wi-Fi?', 'Yes. It connects the same way a normal website does, so most school networks allow it. The Connection tab in your account can test it.'],
     ['Do I have to make an account?', 'To play, yes: it keeps your saves and your name. If Grapevine cannot be reached from your network at all, you will be offered a way to play without one.'],
     ['What name should I pick?', 'Anything you like that is not your full real name. Names are first come, first served, and capital letters count: Alex and alex are different.']]
      .forEach(function (q) { box.appendChild(h('details', null, h('summary', { text: q[0] }), h('p', { text: q[1] }))); });
    return box;
  }
  function download(name, text) {
    try { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); } catch (e) { toast('Could not make the file. Copy the key instead.', true); }
  }
  function keyFile(key, name) { return 'Huntington Games / Grapevine recovery key\n' + (name ? 'Account name: ' + name + '\n' : '') + '\n' + key + '\n\nThis key IS your account. Anyone who has it can sign in as you, and nobody can reset it. Keep it private and safe.\n'; }

  function signedOut() {
    var wrap = h('div', null, gate ? explainer() : null);
    var card = wrap; wrap = h('div', { class: 'card' }); card.appendChild(wrap); var outer = card;
    wrap.appendChild(h('h2', { text: 'Grapevine' }));
    wrap.appendChild(h('p', { class: 'sub', text: gate
      ? 'One account for everything here. Your name in every game, your saves on every device, and friends, chat and rooms in Grapevine. Sign in with your recovery key, or create an account to get started.'
      : 'Your Grapevine account.' }));
    var seg = h('div', { class: 'seg' },
      h('button', { class: mode === 'in' ? 'on' : '', text: 'Sign in', onclick: function () { mode = 'in'; pendingKey = null; render(); } }),
      h('button', { class: mode === 'up' ? 'on' : '', text: 'Create account', onclick: function () { mode = 'up'; pendingKey = null; render(); } }));
    wrap.appendChild(seg);
    var hint = h('div', { class: 'hint' });
    var go;
    if (mode === 'in') {
      var key = h('input', { type: 'password', id: 'gl-key', autocomplete: 'off', spellcheck: 'false', placeholder: 'paste your recovery key' });
      var show = h('label', { class: 'chk' }, h('input', { type: 'checkbox', onchange: function () { key.type = this.checked ? 'text' : 'password'; } }), 'Show the key');
      go = h('button', { class: 'go', id: 'gl-go', text: 'Sign in', onclick: function () {
        if (busy) return;
        busy = true; go.disabled = true; hint.className = 'hint'; hint.textContent = 'Signing in...';
        L.signIn(key.value).then(function () { busy = false; render(); }, function (e) { busy = false; go.disabled = false; hint.className = 'hint bad'; hint.textContent = e.message || 'Could not sign in.'; });
      } });
      key.onkeydown = function (e) { if (e.key === 'Enter') go.click(); };
      wrap.appendChild(h('div', { class: 'field' }, h('label', { text: 'Recovery key' }), key, hint));
      wrap.appendChild(show);
      wrap.appendChild(go);
      wrap.appendChild(h('p', { class: 'hint', text: 'It is the same key you use in Grapevine. It stays on this device and is never shown to games.' }));
    } else if (!pendingKey) {
      var nm = h('input', { type: 'text', id: 'gl-name', maxlength: '24', autocomplete: 'off', placeholder: 'pick a name' });
      var inv = h('input', { type: 'text', id: 'gl-invite', autocomplete: 'off', placeholder: 'only if the server asks for one' });
      go = h('button', { class: 'go', id: 'gl-go', text: 'Create account', onclick: function () {
        if (!nm.value.trim()) { hint.className = 'hint bad'; hint.textContent = 'Pick a name first.'; return; }
        pendingKey = { key: L.newKey(), name: nm.value.trim(), invite: inv.value.trim() }; render();
      } });
      nm.onkeydown = function (e) { if (e.key === 'Enter') go.click(); };
      wrap.appendChild(h('div', { class: 'field' }, h('label', { text: 'Name' }), nm, hint,
        h('div', { class: 'hint', text: 'Names are case-sensitive and first come, first served. This is the name other players see.' })));
      wrap.appendChild(h('div', { class: 'field' }, h('label', { text: 'Invite code (optional)' }), inv));
      wrap.appendChild(go);
    } else {
      var saved = h('input', { type: 'checkbox', id: 'gl-saved', onchange: function () { fin.disabled = !this.checked; } });
      var fin = h('button', { class: 'go', id: 'gl-fin', text: 'Create it', disabled: 'disabled', onclick: function () {
        if (busy) return;
        busy = true; fin.disabled = true; hint.className = 'hint'; hint.textContent = 'Creating your account...';
        L.signUp(pendingKey.key, pendingKey.name, pendingKey.invite).then(function () { pendingKey = null; busy = false; render(); },
          function (e) { busy = false; pendingKey = null; mode = 'up'; render(); toast(e.message || 'Could not create the account.', true); });
      } });
      wrap.appendChild(h('div', { class: 'k', text: 'Your recovery key' }));
      wrap.appendChild(h('div', { class: 'keybox', id: 'gl-newkey', text: pendingKey.key }));
      wrap.appendChild(h('div', { class: 'add' },
        h('button', { class: 'mbtn', text: 'Copy', onclick: function () { copy(pendingKey.key, 'Key copied - now paste it somewhere safe.'); } }),
        h('button', { class: 'mbtn', id: 'gl-dl', text: 'Download as a file', onclick: function () { download('grapevine-recovery-key.txt', keyFile(pendingKey.key, pendingKey.name)); } })));
      wrap.appendChild(h('p', { class: 'hint', text: 'This key IS your account. Nobody can reset it - not even us. Save it in a password manager or a note before you go on.' }));
      wrap.appendChild(h('label', { class: 'chk' }, saved, 'I saved my key somewhere safe'));
      wrap.appendChild(hint);
      wrap.appendChild(fin);
    }
    if (gate) outer.appendChild(faq());
    return outer;
  }

  function copy(text, msg) {
    var done = function () { toast(msg); };
    try { navigator.clipboard.writeText(text).then(done, function () { toast('Select it and copy it by hand.', true); }); }
    catch (e) { toast('Select it and copy it by hand.', true); }
  }

  // ---------------- signed in ----------------
  function signedIn() {
    var me = L.me(), f = L.friends();
    var wrap = h('div');
    wrap.appendChild(h('div', { class: 'me' },
      h('div', { class: 'av', text: me.name.slice(0, 1).toUpperCase() }),
      h('div', null, h('div', { class: 'nm', id: 'gl-me', text: me.name }), h('div', { class: 'st' }, h('span', { class: 'dot ' + statusDot() }), h('span', { id: 'gl-status', text: statusLine() }))),
      h('div', { class: 'sp' }),
      h('button', { class: 'mbtn', text: 'My key', title: 'Copy your recovery key', onclick: function () { copy(L.key(), 'Key copied. Keep it private.'); } }),
      h('button', { class: 'mbtn', text: 'Download key', title: 'Save your recovery key as a file', onclick: function () { download('grapevine-recovery-key.txt', keyFile(L.key(), me.name)); } }),
      h('button', { class: 'mbtn warn', id: 'gl-out', text: 'Sign out', onclick: function () {
        var b = this; b.disabled = true;
        L.signOut().then(function (r) {
          if (r.saved) { view = 'saves'; render(); return; }
          if (confirm('Grapevine could not save your games to your account right now (no connection). Signing out would clear them from this device. Sign out anyway?')) { L.signOut({ force: true }).then(function () { view = 'saves'; render(); }); }
          else b.disabled = false;
        });
      } })));
    var nIn = f.incoming.length;
    wrap.appendChild(h('div', { class: 'card', style: 'margin-bottom:16px' },
      h('div', { class: 'k', text: 'chat, friends, rooms and messages' }),
      h('p', { class: 'sub', style: 'margin:6px 0 12px', text: 'They all live in the Grapevine tab, signed in as you.' + (nIn ? ' ' + nIn + ' friend request' + (nIn > 1 ? 's are' : ' is') + ' waiting.' : '') }),
      h('div', { class: 'add' },
        h('button', { class: 'mbtn', id: 'gl-open-chat', text: 'Open Grapevine', onclick: function () { window.HG_openGrapevine && window.HG_openGrapevine(); } }),
        h('button', { class: 'mbtn', id: 'gl-open-friends', text: nIn ? 'Friend requests (' + nIn + ')' : 'Friends', onclick: function () { window.HG_openGrapevine && window.HG_openGrapevine(nIn ? 'requests' : 'friends'); } }))));
    var tabs = [['saves', 'Saves'], ['met', 'Met in games'], ['conn', 'Connection']];
    wrap.appendChild(h('div', { class: 'seg' }, tabs.map(function (t) {
      return h('button', { class: view === t[0] ? 'on' : '', 'data-view': t[0], text: t[1], onclick: function () { view = t[0]; render(); } });
    })));
    wrap.appendChild(view === 'met' ? metView() : view === 'conn' ? connView() : savesView());
    return wrap;
  }

  function act(btn, p, okMsg) {
    btn.disabled = true;
    p.then(function () { if (okMsg) toast(okMsg); }, function (e) { toast(e.message || 'That did not work.', true); }).then(function () { btn.disabled = false; });
  }

  function metView() {
    var box = h('div'), list = L.recent();
    box.appendChild(h('div', { class: 'sect', text: 'people you played with' }));
    if (!list.length) box.appendChild(h('div', { class: 'empty', text: 'When you play multiplayer, verified players show up here so you can friend them.' }));
    list.forEach(function (r) {
      var s = L.friendState(r.name), right;
      if (s === 'none') { right = h('button', { class: 'mbtn', text: '+ Friend', onclick: function () { act(this, L.addFriend(r.name), 'Friend request sent to ' + r.name); } }); }
      else right = h('span', { class: 'sm', text: s === 'friend' ? 'friends' : s === 'outgoing' ? 'request sent' : s === 'incoming' ? 'asked you' : '' });
      box.appendChild(h('div', { class: 'row', 'data-met': r.name }, h('span', { class: 'nm', text: r.name }), h('span', { class: 'sm', text: r.game || '' }), h('span', { class: 'btns' }, right)));
    });
    return box;
  }

  function ago(t) {
    if (!t) return 'never';
    var s = Math.round((Date.now() - t) / 1000);
    return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' days ago';
  }
  function savesView() {
    var box = h('div'), st = L.sync.status();
    box.appendChild(h('div', { class: 'sect', text: 'saves and devices' }));
    box.appendChild(h('p', { class: 'sub', text: 'Every game\'s progress is saved to your account. Sign in on another device with the same recovery key and it all loads there. Saves are kept up to date automatically; closing a game saves it right away.' }));
    box.appendChild(h('div', { class: 'row' }, h('span', { class: 'dot ' + (st.state === 'ok' ? 'on' : st.state === 'error' ? 'bad' : 'wait') }),
      h('span', { class: 'nm', id: 'gl-sync', text: st.text || (st.at ? 'Last saved ' + ago(st.at) : 'Not saved yet') }), h('span', { class: 'sm', text: st.at ? ago(st.at) : '' })));
    var b = h('button', { class: 'mbtn', id: 'gl-sync-go', text: 'Save and sync now', onclick: function () {
      b.disabled = true; L.sync.run().then(function (r) { toast(r.pulled ? 'Loaded ' + r.pulled + ' item(s) from your account.' : 'Everything is saved.'); }, function (e) { toast(e.message || 'Could not sync.', true); }).then(function () { b.disabled = false; render(); });
    } });
    box.appendChild(h('div', { style: 'margin-top:12px' }, b));
    return box;
  }

  function connView() {
    var box = h('div');
    box.appendChild(h('div', { class: 'sect', text: 'connection' }));
    box.appendChild(h('p', { class: 'sub', text: 'Grapevine reaches the server through public relay servers on port 443, so it works on school networks. Everything between you and the server is encrypted.' }));
    var tlv = L.timeline();
    if (tlv.steps.length > 1) {
      box.appendChild(h('div', { class: 'sect', text: 'last connection - ' + (tlv.total / 1000).toFixed(1) + ' s in all' }));
      var tb = h('div', { class: 'diag', id: 'gl-timeline' }), prev = 0;
      tlv.steps.forEach(function (st) { tb.appendChild(h('div', null, h('span', { class: st[1] - prev > 3000 ? 'no' : '', text: '+' + ((st[1] - prev) / 1000).toFixed(1) + ' s  ' }), st[0])); prev = st[1]; });
      box.appendChild(tb);
      box.appendChild(h('p', { class: 'hint', text: 'If sign-in feels slow, this shows which step took the time (anything over 3 s is marked). It helps to tell whoever looks after Grapevine.' }));
    }
    var out = h('div', { class: 'diag', id: 'gl-diag' });
    if (diagHtml) out.appendChild(diagHtml);
    var b = h('button', { class: 'mbtn', id: 'gl-test', text: 'Test my connection', onclick: function () {
      b.disabled = true; out.textContent = 'Testing...';
      L.diagnose().then(function (r) {
        var frag = document.createElement('div');
        (r.relays || []).forEach(function (x) { frag.appendChild(h('div', null, h('span', { class: x.ok ? 'ok' : 'no', text: x.ok ? 'OK ' : 'BLOCKED ' }), (x.name || x.url) + (x.ok && x.rttMs != null ? ' - ' + Math.round(x.rttMs) + ' ms' : ''))); });
        if (r.summary) frag.appendChild(h('div', { class: 'hint', text: r.summary.text + (r.summary.advice ? ' ' + r.summary.advice : '') }));
        diagHtml = frag; out.textContent = ''; out.appendChild(frag);
      }, function (e) { out.textContent = 'The test could not run: ' + (e && e.message); }).then(function () { b.disabled = false; });
    } });
    box.appendChild(b); box.appendChild(out);
    return box;
  }

  function render() {
    var saved = root;
    mounts.forEach(function (m) { root = m.el; gate = m.gate; renderOne(); });
    root = saved;
  }
  function renderOne() {
    if (!root) return;
    var scroll = root.scrollTop;
    var focus = document.activeElement && document.activeElement.id;
    var val = focus && document.activeElement.value;
    root.textContent = '';
    var body = gate ? (L.me() ? h('div') : signedOut()) : (L.me() ? signedIn() : signedOut());
    root.appendChild(body);
    if (focus) { var el = root.querySelector('#' + focus); if (el) { if (val != null && 'value' in el && el.type !== 'checkbox') el.value = val; try { el.focus(); } catch (e) {} } }
    root.scrollTop = scroll;
  }

  var style;
  function mount(el, opts) {
    if (!style) {
      style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
      ['change', 'friends', 'met', 'sync'].forEach(function (ev) { L.on(ev, function () { if (!busy) render(); }); });
    }
    var r = h('div', { class: 'gl' });
    el.textContent = ''; el.appendChild(r);
    mounts.push({ el: r, gate: !!(opts && opts.gate) });
    render();
    return r;
  }

  window.HGGrapevineUI = { mount: mount, render: render };
})();
