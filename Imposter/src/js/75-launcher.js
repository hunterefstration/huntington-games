// ---- the launcher: invites, Quick Match, open parties ----
// The Huntington Games launcher hands us a code to join (HG_takeJoin / window.__hgJoin) or asks us to host for a chat
// or for Quick Match (HG_takeHost / window.__hgHost, then we send the code back with HG_sendInvite). While we host a
// lobby that has room, it is listed as an open party (HG_partyOpen, every 30 s; HG_partyClose when it ends).
const LP = () => { try { const p = window.parent; return p && p !== window ? p : null; } catch (e) { return null; } };
function hgJoinCode(raw) {
  const c = String(raw || '').replace(/\D/g, ''); if (c.length !== 6) return false;
  showScreen('s-join'); $('j-code').value = c; setTimeout(() => $('j-go').click(), 50); return true;
}
window.__hgJoin = hgJoinCode;
function hgHostFor(convId) {
  openHostLobby();
  const t0 = Date.now(), iv = setInterval(() => {
    if (Date.now() - t0 > 25000) { clearInterval(iv); return; }
    if (NET.host && /^\d{6}$/.test(NET.code || '')) { clearInterval(iv); const p = LP(); try { p && p.HG_sendInvite && p.HG_sendInvite(convId, { game: 'imposter', code: NET.code, max: MAXP }); } catch (e) {} }
  }, 300);
}
window.__hgHost = hgHostFor;
setTimeout(() => {
  const p = LP(); if (!p) return;
  let c = ''; try { c = p.HG_takeJoin ? p.HG_takeJoin('imposter') || '' : ''; } catch (e) {}
  if (c) return hgJoinCode(c);
  let h = null; try { h = p.HG_takeHost ? p.HG_takeHost('imposter') : null; } catch (e) {}
  if (h && h.convId) hgHostFor(h.convId);
}, 300);
let lpOpen = '';
setInterval(() => {
  const p = LP(); if (!p || !p.HG_partyOpen) return;
  const open = NET.host && /^\d{6}$/.test(NET.code || '') && !G;          // a lobby, not a match in progress
  if (open) { const n = lobbyPlayers().length; if (n < MAXP) { p.HG_partyOpen({ game: 'imposter', code: NET.code, n, max: MAXP }); lpOpen = NET.code; } }
  else if (lpOpen) { try { p.HG_partyClose(lpOpen); } catch (e) {} lpOpen = ''; }
}, 30000);
