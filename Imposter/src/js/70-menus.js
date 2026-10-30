// ==========================================
// MENUS: title, join, lobby, settings, stats
// ==========================================
let LMODE = 'off';          // 'off' (bots only) | 'host' | 'guest'
const LSET = [
  { k: 'imps', label: 'Shades', opts: [1, 2, 3] },
  { k: 'kcd', label: 'Snuff cooldown', min: 10, max: 60, step: 5, fmt: v => v + 's' },
  { k: 'speed', label: 'Player speed', opts: [.75, 1, 1.25, 1.5], fmt: v => v + 'x' },
  { k: 'tasks', label: 'Chores per Keeper', min: 1, max: 8, step: 1 },
  { k: 'map', label: 'Map', opts: MAP_KEYS, fmt: k => MAPS[k].name },
  { k: 'disc', label: 'Discussion time', min: 0, max: 60, step: 5, fmt: v => v + 's' },
  { k: 'vote', label: 'Voting time', min: 15, max: 90, step: 5, fmt: v => v + 's' },
  { k: 'meet', label: 'Bell rings per Keeper', min: 0, max: 3, step: 1 },
  { k: 'confirm', label: 'Reveal who was cast out', opts: [1, 0], fmt: v => v ? 'On' : 'Off' }];
function refreshTitle() {
  const s = stats; $('t-foot').textContent = 'v' + VERSION + '   Games ' + s.games + '   Keeper wins ' + s.crewWins + '   Shade wins ' + s.impWins;
  drawLogo();
}
function showLobbyScreen() { showScreen('s-lobby'); renderLobby(); }
function renderLobby() {
  if ($('s-lobby').classList.contains('hidden')) return;
  const host = LMODE !== 'guest', off = LMODE === 'off', set = LB.set;
  $('l-code').textContent = off ? 'OFFLINE' : (NET.code || '------'); $('l-code').style.fontSize = off ? '36px' : ''; $('l-copy').classList.toggle('hidden', off);
  $('l-status').classList.toggle('hidden', off); $('l-start').classList.toggle('hidden', !host); $('l-wait').textContent = host ? '' : 'Waiting for the host to start...';
  const names = off ? [{ name: playerName() }] : LB.players; const list = $('l-list'); list.innerHTML = '';
  for (let i = 0; i < MAXP; i++) {
    const d = document.createElement('div'), p = names[i]; d.className = 'plc' + (p ? '' : ' bot');
    if (p) { const dot = document.createElement('i'); dot.style.background = i === 0 ? '#ffd36b' : '#59e0ff'; d.appendChild(dot); d.appendChild(document.createTextNode(p.name)); if (i === 0 && !off) { const e = document.createElement('em'); e.textContent = 'host'; d.appendChild(e); } if (p.lag) { const e = document.createElement('em'); e.textContent = 'lagging'; d.appendChild(e); } }
    else { d.textContent = 'AI bot'; }
    list.appendChild(d);
  }
  $('l-count').textContent = '(' + names.length + ' / ' + MAXP + ')';
  const box = $('l-set'); box.innerHTML = '';
  for (const o of LSET) {
    const row = document.createElement('div'); row.className = 'lset'; const lab = document.createElement('span'); lab.textContent = o.label; row.appendChild(lab);
    const seg = document.createElement('div'); seg.className = 'seg' + (host ? '' : ' ro'); const fmt = o.fmt || (v => v);
    if (o.opts) for (const v of o.opts) { const b = document.createElement('button'); b.textContent = fmt(v); if (set[o.k] === v) b.classList.add('on'); b.onclick = () => setOpt(o.k, v); seg.appendChild(b); }
    else { const m = document.createElement('button'); m.textContent = '-'; m.onclick = () => setOpt(o.k, clamp(set[o.k] - o.step, o.min, o.max)); const v = document.createElement('b'); v.textContent = fmt(set[o.k]); const pl = document.createElement('button'); pl.textContent = '+'; pl.onclick = () => setOpt(o.k, clamp(set[o.k] + o.step, o.min, o.max)); seg.appendChild(m); seg.appendChild(v); seg.appendChild(pl); }
    row.appendChild(seg); box.appendChild(row);
  }
}
function setOpt(k, v) {
  if (LMODE === 'guest') return; LB.set[k] = v; settings.hostSet = Object.assign({}, LB.set); saveSettings(); sfx.click();
  if (LMODE === 'host') sendLobby(); else renderLobby();
}
function openOfflineLobby() { LMODE = 'off'; netReset(); LB.set = Object.assign({}, DEFAULT_SET, settings.hostSet); showLobbyScreen(); }
function openHostLobby() {
  LMODE = 'host'; LB.set = Object.assign({}, DEFAULT_SET, settings.hostSet); NET.code = ''; showLobbyScreen(); $('l-status').textContent = 'Opening a room...'; $('l-status').className = 'status';
  hostRoom((code, err) => {
    if (!code) { $('l-status').textContent = err; $('l-status').className = 'status err'; toast(err, 3500); showScreen('s-title'); return; }
    $('l-status').textContent = 'Room open. Share the code!'; sendLobby();
  });
}
function bindMenus() {
  const on = (id, fn) => { $(id).onclick = () => { ac(); sfx.click(); fn(); }; };
  on('t-off', openOfflineLobby);
  on('t-host', () => { openHostLobby(); });
  on('t-join', () => { showScreen('s-join'); $('j-status').textContent = ''; $('j-code').focus(); });
  on('t-how', () => showScreen('s-how')); on('how-done', () => showScreen('s-title'));
  on('t-set', () => { $('o-name').value = settings.name; $('o-vol').value = settings.vol; $('o-touch').value = settings.touch; showScreen('s-set'); });
  on('set-done', () => { settings.name = cleanText($('o-name').value, 12); saveSettings(); showScreen('s-title'); });
  $('o-vol').oninput = e => { settings.vol = +e.target.value; saveSettings(); };
  $('o-vol').onchange = () => sfx.ok(); $('o-touch').onchange = e => { settings.touch = e.target.value; saveSettings(); };
  on('t-stats', showStats); on('st-done', () => showScreen('s-title'));
  on('j-back', () => { showScreen('s-title'); });
  on('j-test', () => { const d = $('j-diag'); d.textContent = 'Testing...'; loadHG().then(H => { if (!H || !H.renderDiagnostics) { d.textContent = 'Multiplayer needs the launcher'; return; } d.textContent = ''; H.renderDiagnostics(d, null, { game: 'imposter' }); }); });
  const go = () => {
    const code = $('j-code').value.replace(/[\s.-]/g, ''); const st = $('j-status'); st.className = 'status';
    if (!/^\d{6}$/.test(code)) { st.textContent = 'Enter the 6-digit code.'; st.className = 'status err'; return; }
    st.textContent = 'Connecting...'; $('j-go').disabled = true; LMODE = 'guest';
    joinRoom(code, (c, err) => {
      $('j-go').disabled = false;
      if (!c) { st.textContent = err; st.className = 'status err'; return; }
      LB.players = []; showLobbyScreen();
    });
  };
  $('j-go').onclick = () => { ac(); go(); }; $('j-code').addEventListener('keydown', e => { if (e.key === 'Enter') go(); e.stopPropagation(); });
  $('o-name').addEventListener('keydown', e => e.stopPropagation());
  on('l-start', () => { if (LMODE === 'off') startOffline(); else lobbyStart(); });
  on('l-leave', () => { if (LMODE === 'off') showScreen('s-title'); else leaveToMenu(); });
  on('l-copy', () => { const t = NET.code; try { navigator.clipboard.writeText(t).then(() => toast('Code copied')); } catch (e) { toast('Code: ' + t); } });
}
function showStats() {
  const s = stats, rows = [['Games played', s.games], ['Played as Keeper', s.crewGames], ['Keeper wins', s.crewWins], ['Played as Shade', s.impGames], ['Shade wins', s.impWins], ['Lamps snuffed', s.kills], ['Chores done', s.tasks], ['Gatherings called', s.meetings], ['Times dimmed', s.deaths]];
  const box = $('st-rows'); box.innerHTML = ''; for (const r of rows) { const d = document.createElement('div'); d.className = 'strow'; d.appendChild(document.createTextNode(r[0])); const b = document.createElement('b'); b.textContent = r[1]; d.appendChild(b); box.appendChild(d); }
  showScreen('s-stats');
}
