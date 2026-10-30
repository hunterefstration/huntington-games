// ==========================================
// SAVE FILES: three of them. The one in use is always 'lumi_save' (so the launcher's cloud saves, achievements and
// leaderboards keep reading it); the others wait in 'lumi_slot0..2' (also synced: every key starting 'lumi_' is).
// Switching parks the current file in its slot, puts the chosen one in 'lumi_save' and reloads the game.
// A save code (export / import) is the file as base64 text, to move it anywhere or keep a backup.
// ==========================================
const SV_N = 3, SV_META = 'lumi_slots';
function svMeta() {
    let m = null; try { m = JSON.parse(localStorage.getItem(SV_META) || 'null'); } catch (e) {}
    if (!m || typeof m !== 'object') { m = { active: 0, names: ['File 1', 'File 2', 'File 3'] }; try { localStorage.setItem(SV_META, JSON.stringify(m)); } catch (e) {} }
    m.active = Math.max(0, Math.min(SV_N - 1, m.active | 0)); m.names = (m.names || []).slice(0, SV_N); while (m.names.length < SV_N) m.names.push('File ' + (m.names.length + 1));
    return m;
}
function svSaveMeta(m) { try { localStorage.setItem(SV_META, JSON.stringify(m)); } catch (e) {} }
function svData(k) {          // the file in slot k (the active one is the live save)
    const m = svMeta();
    if (k === m.active) return SAVE.d;
    try { return JSON.parse(localStorage.getItem('lumi_slot' + k) || 'null'); } catch (e) { return null; }
}
function svSummary(d) {
    if (!d || !d.levels || !Object.keys(d.levels).length) return null;
    const lv = Object.keys(d.levels).filter(id => LEVELS.some(l => l.id === id)).length, stars = Object.values(d.levels).reduce((n, r) => n + ((r && r.moths) || []).filter(Boolean).length, 0);
    const t = d.playTime || 0, h = Math.floor(t / 3600), mm = Math.floor(t % 3600 / 60);
    return `${lv} / ${LEVELS.length} levels · ${stars} stars · ${h ? h + 'h ' : ''}${mm}m played` + (d.at ? ' · ' + new Date(d.at).toLocaleDateString() : '');
}
function svSwitch(k) {
    const m = svMeta(); if (k === m.active) { UI.show('title'); titleStats(); return; }
    SAVE.write();
    window.__lumiSwitching = true;
    try {
        localStorage.setItem('lumi_slot' + m.active, localStorage.getItem('lumi_save') || JSON.stringify(SAVE.d));
        const next = localStorage.getItem('lumi_slot' + k);
        if (next) localStorage.setItem('lumi_save', next); else localStorage.removeItem('lumi_save');
        m.active = k; svSaveMeta(m);
    } catch (e) { window.__lumiSwitching = false; G.toast('Could not switch: storage is full'); return; }
    location.reload();
}
function svDelete(k) {
    const m = svMeta();
    try { localStorage.removeItem('lumi_slot' + k); } catch (e) {}
    if (k === m.active) { window.__lumiSwitching = true; try { localStorage.removeItem('lumi_save'); } catch (e) {} location.reload(); return; }
    svRender();
}
function svCode(d) { return btoa(unescape(encodeURIComponent(JSON.stringify(d)))); }
function svImport(k, code) {
    let d; try { d = JSON.parse(decodeURIComponent(escape(atob(String(code).trim())))); } catch (e) { return 'That is not a Last Light save code.'; }
    if (!d || typeof d !== 'object' || typeof d.levels !== 'object') return 'That is not a Last Light save code.';
    migrateSave(d);
    const m = svMeta(), v = JSON.stringify(d);
    try {
        if (k === m.active) { window.__lumiSwitching = true; localStorage.setItem('lumi_save', v); location.reload(); return ''; }
        localStorage.setItem('lumi_slot' + k, v);
    } catch (e) { window.__lumiSwitching = false; return 'Storage is full.'; }
    svRender(); return '';
}
const SVUI = { mode: {} };        // per slot: '', 'rename', 'del', 'export', 'import'
function svRender() {
    const m = svMeta(), box = $('#sv-list'); if (!box) return;
    box.innerHTML = Array.from({ length: SV_N }, (_, k) => {
        const d = svData(k), sum = svSummary(d), on = k === m.active, mode = SVUI.mode[k] || '';
        let extra = '';
        if (mode === 'rename') extra = `<div class="svb" style="width:100%"><input id="sv-name${k}" maxlength="20" value="${m.names[k].replace(/"/g, '')}"><button class="btn small" data-sv="name" data-k="${k}">Save name</button><button class="btn small" data-sv="cancel" data-k="${k}">Cancel</button></div>`;
        else if (mode === 'del') extra = `<div class="svb" style="width:100%"><b style="color:#ff9a8a">Delete ${m.names[k]} for good?</b><button class="btn small" data-sv="delyes" data-k="${k}">Yes, delete it</button><button class="btn small" data-sv="cancel" data-k="${k}">No</button></div>`;
        else if (mode === 'export') extra = `<div style="width:100%"><textarea readonly id="sv-code${k}">${d ? svCode(d) : ''}</textarea><div class="svb"><button class="btn small" data-sv="copy" data-k="${k}">Copy</button><button class="btn small" data-sv="cancel" data-k="${k}">Done</button></div></div>`;
        else if (mode === 'import') extra = `<div style="width:100%"><textarea id="sv-in${k}" placeholder="Paste a save code here"></textarea><div class="svb"><button class="btn small" data-sv="load" data-k="${k}">Load it into ${m.names[k]}</button><button class="btn small" data-sv="cancel" data-k="${k}">Cancel</button><span id="sv-err${k}" style="color:#ff9a8a"></span></div></div>`;
        return `<div class="sv${on ? ' on' : ''}"><div class="svn">${m.names[k].replace(/</g, '&lt;')}${on ? '<span class="badge">PLAYING</span>' : ''}<small>File ${k + 1}</small></div>` +
            `<div class="svs">${sum || '<i>Empty: a fresh start</i>'}</div><div class="svb">` +
            (on ? '' : `<button class="btn small" data-sv="play" data-k="${k}">${sum ? 'Play this file' : 'Start new'}</button>`) +
            `<button class="btn small" data-sv="rename" data-k="${k}">Rename</button>` + (sum ? `<button class="btn small" data-sv="export" data-k="${k}">Save code</button>` : '') +
            `<button class="btn small" data-sv="import" data-k="${k}">Load code</button>` + (sum ? `<button class="btn small" data-sv="del" data-k="${k}">Delete</button>` : '') + `</div>${extra}</div>`;
    }).join('');
}
$('#sv-list').addEventListener('click', e => {
    const b = e.target.closest('[data-sv]'); if (!b) return;
    const k = +b.dataset.k, a = b.dataset.sv, m = svMeta(); Sound.play('click');
    if (a === 'play') return svSwitch(k);
    if (a === 'cancel') SVUI.mode[k] = '';
    else if (a === 'rename' || a === 'del' || a === 'export' || a === 'import') SVUI.mode[k] = a;
    else if (a === 'name') { const v = ($('#sv-name' + k).value || '').trim().slice(0, 20); if (v) { m.names[k] = v; svSaveMeta(m); } SVUI.mode[k] = ''; titleStats(); }
    else if (a === 'delyes') { SVUI.mode[k] = ''; return svDelete(k); }
    else if (a === 'copy') { const t = $('#sv-code' + k); t.select(); try { navigator.clipboard.writeText(t.value); } catch (e2) { try { document.execCommand('copy'); } catch (e3) {} } G.toast('Save code copied'); return; }
    else if (a === 'load') { const err = svImport(k, $('#sv-in' + k).value); if (err) { $('#sv-err' + k).textContent = err; return; } SVUI.mode[k] = ''; G.toast('Save loaded'); }
    svRender();
});
$('#sv-list').addEventListener('keydown', e => e.stopPropagation());
$('#t-saves').addEventListener('click', () => { Sound.play('click'); SVUI.mode = {}; svRender(); UI.show('saves'); });
$('#sv-back').addEventListener('click', () => { Sound.play('click'); UI.show('title'); titleStats(); });
svMeta();
