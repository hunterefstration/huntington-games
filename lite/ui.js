// Grapevine Lite - the launcher tab. Draws into any element with HGLiteUI.mount(el).
// Styled by the launcher's Grapevine theme variables (--panel, --raise, --line, --signal ...); the
// small stylesheet below only uses those, so it follows the theme wherever it is mounted.
(function () {
  'use strict';
  if (window.HGLiteUI) return;
  var L = window.HGLite;

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

  var root, view = 'friends', mode = 'in', pendingKey = null, toastT = null, busy = false, diagHtml = null;

  function toast(msg, bad) {
    var old = root && root.querySelector('.toast'); if (old) old.remove();
    var t = h('div', { class: 'toast' + (bad ? ' bad' : ''), text: msg, role: 'status' });
    root.appendChild(t); clearTimeout(toastT); toastT = setTimeout(function () { t.remove(); }, 4200);
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
  function signedOut() {
    var wrap = h('div', { class: 'card' });
    wrap.appendChild(h('h2', { text: 'Grapevine Lite' }));
    wrap.appendChild(h('p', { class: 'sub', text: 'Your Grapevine account, right here. Keep one name in every game, see who is online, and make friends with people you meet in multiplayer - they show up in the full Grapevine too.' }));
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
      wrap.appendChild(h('button', { class: 'mbtn', text: 'Copy', onclick: function () { copy(pendingKey.key, 'Key copied - now paste it somewhere safe.'); } }));
      wrap.appendChild(h('p', { class: 'hint', text: 'This key IS your account. Nobody can reset it - not even us. Save it in a password manager or a note before you go on.' }));
      wrap.appendChild(h('label', { class: 'chk' }, saved, 'I saved my key somewhere safe'));
      wrap.appendChild(hint);
      wrap.appendChild(fin);
    }
    return wrap;
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
      h('button', { class: 'mbtn warn', id: 'gl-out', text: 'Sign out', onclick: function () { if (confirm('Sign out of Grapevine Lite on this device? Your account is not deleted - you can sign in again with your key.')) { L.signOut(); view = 'friends'; render(); } } })));
    var nIn = f.incoming.length;
    var tabs = [['friends', 'Friends'], ['requests', 'Requests' + (nIn ? ' (' + nIn + ')' : '')], ['met', 'Met in games'], ['conn', 'Connection']];
    wrap.appendChild(h('div', { class: 'seg' }, tabs.map(function (t) {
      return h('button', { class: view === t[0] ? 'on' : '', 'data-view': t[0], text: t[1], onclick: function () { view = t[0]; render(); } });
    })));
    wrap.appendChild(view === 'friends' ? friendsView(f) : view === 'requests' ? requestsView(f) : view === 'met' ? metView() : connView());
    return wrap;
  }

  function act(btn, p, okMsg) {
    btn.disabled = true;
    p.then(function () { if (okMsg) toast(okMsg); }, function (e) { toast(e.message || 'That did not work.', true); }).then(function () { btn.disabled = false; });
  }

  function friendsView(f) {
    var box = h('div');
    var inp = h('input', { type: 'text', id: 'gl-add', maxlength: '24', autocomplete: 'off', placeholder: 'add a friend by exact name' });
    var btn = h('button', { class: 'mbtn', id: 'gl-add-go', text: 'Add', onclick: function () {
      var n = inp.value.trim(); if (!n) return;
      act(btn, L.addFriend(n).then(function () { inp.value = ''; }), L.friendState(n) === 'incoming' ? 'You are now friends with ' + n : 'Friend request sent to ' + n);
    } });
    inp.onkeydown = function (e) { if (e.key === 'Enter') btn.click(); };
    box.appendChild(h('div', { class: 'add' }, inp, btn));
    box.appendChild(h('div', { class: 'hint', text: 'Names are case-sensitive. Friends you make here are your friends in Grapevine too.' }));
    var online = f.friends.filter(function (x) { return x.online; }).length;
    box.appendChild(h('div', { class: 'sect', text: 'friends - ' + online + ' online of ' + f.friends.length }));
    if (!f.friends.length) box.appendChild(h('div', { class: 'empty', text: f.loaded ? 'No friends yet. Add someone above, or play multiplayer and tap + Friend next to a player.' : 'Loading your friends...' }));
    f.friends.forEach(function (x) {
      var rm = h('button', { class: 'mbtn warn', text: 'Remove', onclick: function () { if (confirm('Remove ' + x.name + ' from your friends?')) act(rm, L.removeFriend(x.name), x.name + ' removed'); } });
      box.appendChild(h('div', { class: 'row', 'data-friend': x.name }, h('span', { class: 'dot ' + (x.online ? 'on' : '') }), h('span', { class: 'nm', text: x.name }), h('span', { class: 'sm', text: x.online ? 'online' : 'offline' }), h('span', { class: 'btns' }, rm)));
    });
    return box;
  }

  function requestsView(f) {
    var box = h('div');
    box.appendChild(h('div', { class: 'sect', text: 'asked to be your friend' }));
    if (!f.incoming.length) box.appendChild(h('div', { class: 'empty', text: 'No one is waiting on you.' }));
    f.incoming.forEach(function (x) {
      var ok = h('button', { class: 'mbtn', text: 'Accept', onclick: function () { act(ok, L.acceptFriend(x.name), 'You are now friends with ' + x.name); } });
      var no = h('button', { class: 'mbtn warn', text: 'Decline', onclick: function () { act(no, L.declineFriend(x.name)); } });
      box.appendChild(h('div', { class: 'row', 'data-incoming': x.name }, h('span', { class: 'nm', text: x.name }), h('span', { class: 'btns' }, ok, no)));
    });
    box.appendChild(h('div', { class: 'sect', text: 'you asked' }));
    if (!f.outgoing.length) box.appendChild(h('div', { class: 'empty', text: 'No requests sent.' }));
    f.outgoing.forEach(function (x) {
      var no = h('button', { class: 'mbtn warn', text: 'Cancel', onclick: function () { act(no, L.declineFriend(x.name)); } });
      box.appendChild(h('div', { class: 'row', 'data-outgoing': x.name }, h('span', { class: 'nm', text: x.name }), h('span', { class: 'sm', text: 'waiting' }), h('span', { class: 'btns' }, no)));
    });
    return box;
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

  function connView() {
    var box = h('div');
    box.appendChild(h('div', { class: 'sect', text: 'connection' }));
    box.appendChild(h('p', { class: 'sub', text: 'Grapevine Lite reaches the server through public relay servers on port 443, so it works on school networks. Everything between you and the server is encrypted.' }));
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
    if (!root) return;
    var scroll = root.scrollTop;
    var focus = document.activeElement && document.activeElement.id;
    var val = focus && document.activeElement.value;
    root.textContent = '';
    var body = L.me() ? signedIn() : signedOut();
    root.appendChild(body);
    if (focus) { var el = root.querySelector('#' + focus); if (el) { if (val != null && 'value' in el && el.type !== 'checkbox') el.value = val; try { el.focus(); } catch (e) {} } }
    root.scrollTop = scroll;
  }

  var style;
  function mount(el) {
    if (!style) { style = document.createElement('style'); style.textContent = css; document.head.appendChild(style); }
    root = h('div', { class: 'gl' });
    el.textContent = ''; el.appendChild(root);
    ['change', 'friends', 'met'].forEach(function (ev) { L.on(ev, function () { if (root && root.isConnected && !busy) render(); }); });
    render();
    return root;
  }

  window.HGLiteUI = { mount: mount, render: render };
})();
