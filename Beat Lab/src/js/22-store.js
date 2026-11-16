// ===== projects in localStorage (one key per project), settings, user presets, undo/redo =====
// Keys: beatlab_p_<id> (a project, compact JSON), beatlab_set (settings), beatlab_up (user presets). All start with
// beatlab_ so the launcher syncs them to the player's account (gv/core.js GAME_KEYS). The account allows 400 KB per
// key and 6 MB in all, so a project over the limit still saves here but we warn that it will not sync.
const KEY_P = 'beatlab_p_', KEY_SET = 'beatlab_set', KEY_UP = 'beatlab_up';
const LIMIT_KEY = 400 * 1024, LIMIT_ALL = 6 * 1024 * 1024;
const Store = {
  warned: {},
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  put(k, v) {
    try { localStorage.setItem(k, v); return true; }
    catch (e) { toast('Could not save: this browser\'s storage is full. Delete an old project or export this one.', 5000); return false; }
  },
  list() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i); if (!k || !k.startsWith(KEY_P)) continue;
        const v = localStorage.getItem(k); if (!v) continue;
        try { const p = JSON.parse(v); out.push({ id: k.slice(KEY_P.length), name: p.name || 'Untitled', mode: p.mode || 'studio', t: p.t || 0, size: v.length, bpm: p.bpm }); } catch (e) {}
      }
    } catch (e) {}
    return out.sort((a, b) => b.t - a.t);
  },
  count() { let n = 0; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(KEY_P)) n++; } } catch (e) {} return n; },
  usage() { let n = 0; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('beatlab_')) n += (localStorage.getItem(k) || '').length; } } catch (e) {} return n; },
  load(id) { const v = Store.get(KEY_P + id); if (!v) return null; try { return openProject(JSON.parse(v)); } catch (e) { reportErr(e); return null; } },
  save(p) {
    if (!p) return false;
    if (A.temp.has(p.id)) return true;                // a tutorial's practice song: never saved unless the player keeps it
    p.t = Date.now();
    const json = JSON.stringify(p);
    if (json.length > LIMIT_KEY && !Store.warned[p.id]) {
      Store.warned[p.id] = 1;
      toast('This project is ' + Math.round(json.length / 1024) + ' KB: it still saves on this computer, but projects over 400 KB do not sync to your account. Export it to keep a copy.', 7000);
    }
    const ok = Store.put(KEY_P + p.id, json);
    const now = Date.now(), check = ok && now - (Store.lastCheck || 0) > 30000;          // the storage-wide checks, at most every 30 s
    if (check) Store.lastCheck = now;
    if (check && !Store.warned.keys && Store.count() > 300) { Store.warned.keys = 1; toast('You have over 300 Beat Lab projects; your account syncs at most 400 saves in all. Delete ones you no longer need.', 7000); }
    if (check && !Store.warned.all && Store.usage() > LIMIT_ALL * 0.9) { Store.warned.all = 1; toast('Your Beat Lab projects are close to the 6 MB your account can sync. Export and delete old ones to make room.', 7000); }
    return ok;
  },
  remove(id) { try { localStorage.removeItem(KEY_P + id); } catch (e) {} },
  loadSet() { try { Object.assign(A.set, JSON.parse(Store.get(KEY_SET) || '{}')); } catch (e) {} },
  saveSet() { Store.put(KEY_SET, JSON.stringify(A.set)); },
  userPresets() { try { const a = JSON.parse(Store.get(KEY_UP) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } },
  saveUserPreset(name, params) {
    const list = Store.userPresets(), id = 'user-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30) + '-' + uid().slice(-4);
    list.push({ id, n: name, c: 'User', p: params });
    Store.put(KEY_UP, JSON.stringify(list));
    return id;
  },
  deleteUserPreset(id) { Store.put(KEY_UP, JSON.stringify(Store.userPresets().filter(x => x.id !== id))); }
};
function presetById(id) {
  const p = E.presetInfo(id); if (p) return p;
  return Store.userPresets().find(x => x.id === id) || null;
}

// ---- project model
function openProject(p) {
  p = p && typeof p === 'object' ? p : {};
  if (!p.id) p.id = uid();
  if (!p.name) p.name = 'Untitled';
  if (p.mode === 'simple') { p.simple = simpleNormalize(p.simple); return p; }
  p.mode = 'studio';
  return E.normalize(p);
}
function newChannel(p, presetId, o) {
  const info = presetById(presetId) || presetById('saw-lead');
  const c = E.addChannel(p, E.presetInfo(info.id) ? info.id : 'saw-lead', o);
  if (!E.presetInfo(info.id)) { c.p = info.id; c.n = (o && o.n) || info.n; c.s = E.normParams(info.p); }       // a user preset
  c.col = CH_COLS[(c.id - 1) % CH_COLS.length];
  return c;
}
function freeInsert(p) {
  const used = new Set(p.ch.map(c => c.mix));
  for (let i = 1; i < p.mix.length; i++) if (!used.has(i)) return i;
  if (p.mix.length < 25) { p.mix.push(Object.assign(E.clone(E.TRACK_DEFAULT), { n: 'Insert ' + p.mix.length })); return p.mix.length - 1; }
  return 0;
}
function newStudioProject(name) {
  const p = E.normalize({ id: uid(), name: name || 'New song', mode: 'studio', bpm: 120 });
  [['808-kick', 'Kick'], ['808-clap', 'Clap'], ['808-closed-hat', 'Hat'], ['808-snare', 'Snare'], ['juno-keys', 'Keys'], ['808-bass', '808']].forEach(([id, n], i) => {
    const c = newChannel(p, id, { n }); c.mix = i + 1; p.mix[i + 1].n = n;
  });
  p.pl.cl.push([1, 0, 0, 16]);
  return p;
}
function patById(id) { return A.p.pat.find(x => x.id === id) || A.p.pat[0]; }
function chById(id) { return A.p.ch.find(x => x.id === id) || null; }
function curPat() { return patById(A.ui.pat); }
function curCh() { return chById(A.ui.ch) || A.p.ch[0] || null; }

// ---- undo / redo: whole-project snapshots (projects are small JSON). Every edit runs between begin() and end().
const Hist = {
  undo: [], redo: [], pending: null, label: '',
  begin() { if (this.pending == null && A.p) this.pending = JSON.stringify(A.p); },
  end(label) {
    if (this.pending == null) return false;
    const before = this.pending; this.pending = null;
    if (JSON.stringify(A.p) === before) return false;
    this.undo.push({ s: before, l: label || 'Edit' }); if (this.undo.length > 120) this.undo.shift();
    this.redo.length = 0;
    changed();
    return true;
  },
  edit(label, fn) { this.begin(); try { fn(); } finally { this.end(label); } },
  cancel() { this.pending = null; },
  clear() { this.undo.length = 0; this.redo.length = 0; this.pending = null; },
  doUndo() { if (!this.undo.length) return toast('Nothing to undo'); const u = this.undo.pop(); this.redo.push({ s: JSON.stringify(A.p), l: u.l }); this.restore(u.s); toast('Undo: ' + u.l, 1200); },
  doRedo() { if (!this.redo.length) return toast('Nothing to redo'); const r = this.redo.pop(); this.undo.push({ s: JSON.stringify(A.p), l: r.l }); this.restore(r.s); toast('Redo: ' + r.l, 1200); },
  restore(s) { const id = A.p.id; A.p = JSON.parse(s); A.p.id = id; fixUi(); changed(true); }
};
// keep the UI's pointers (current channel, pattern) valid after loads and undo
function fixUi() {
  if (A.p.mode !== 'studio') return;
  if (!A.p.pat.some(x => x.id === A.ui.pat)) A.ui.pat = A.p.pat[0].id;
  if (!A.p.pat.some(x => x.id === A.ui.brush)) A.ui.brush = A.ui.pat;
  if (!A.p.ch.some(x => x.id === A.ui.ch)) A.ui.ch = A.p.ch[0] ? A.p.ch[0].id : null;
}
// something in the project changed: tell the engine, redraw, autosave soon
let saveT = 0;
function changed(all) {
  if (!A.p) return;
  try { if (A.p.mode === 'studio') A.eng.load(A.p); else simpleSync(); } catch (e) { reportErr(e); }
  emit('changed', all);
  clearTimeout(saveT); saveT = setTimeout(() => Store.save(A.p), 1200);
}
function saveNow() { clearTimeout(saveT); return Store.save(A.p); }
// before switching projects: save only if something changed, so opening a lesson (or another song) leaves an unchanged song's save as it was
function saveIfChanged() { if (!A.p) return; let same = false; try { same = Store.get(KEY_P + A.p.id) === JSON.stringify(A.p); } catch (e) {} if (same) clearTimeout(saveT); else saveNow(); }
window.addEventListener('pagehide', () => { if (A.p) saveNow(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && A.p) saveNow(); });
