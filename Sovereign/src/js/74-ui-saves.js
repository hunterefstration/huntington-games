// Save / load screen: 3 slots, the autosave, and a copyable save code for moving between computers.
const Saves = {
  SLOTS: ['1', '2', '3', 'auto'],
  meta(slot) { try { return localStorage.getItem('sov.save.' + slot) ? Store.get('meta.' + slot, null) : null; } catch (e) { return null; } },
  latest() { let best = null, at = 0; for (const s of this.SLOTS) { const m = this.meta(s); if (m && m.at > at) { at = m.at; best = s; } } return best; },
  open(saving) {
    const rows = this.SLOTS.map(s => {
      const m = this.meta(s), name = s === 'auto' ? 'Autosave' : 'Slot ' + s;
      const info = m ? `${m.flag} ${esc(m.country)} · ${esc(m.leader)}<small>${esc(m.date)} · saved ${new Date(m.at).toLocaleString()}</small>` : '<small>Empty</small>';
      const btn = saving ? (s === 'auto' ? '' : `<button class="btn small" data-save="${s}">Save here</button>`) : (m ? `<button class="btn small gold" data-loadslot="${s}">Load</button>` : '');
      return `<div class="slot"><div class="info"><b>${name}</b><br>${info}</div>${btn}</div>`;
    }).join('');
    UI.modal(`<h2>${saving ? 'Save game' : 'Load game'}</h2><div class="slots">${rows}</div>
      <h3 style="font-size:13px;color:var(--dim);margin:14px 0 6px">Save code</h3>
      <div class="sub">Copy this code to move your game to another computer, or paste a code to load it.</div>
      <textarea class="code" id="save-code" placeholder="${saving ? 'Press Make code' : 'Paste a save code here'}"></textarea>
      <div class="actions">${saving ? '<button class="btn small" data-code="make">Make code</button>' : '<button class="btn small" data-code="load">Load code</button>'}<button class="btn small gold" data-act="close-modal">Close</button></div>`);
    const box = $('#modal-box');
    $$('[data-save]', box).forEach(b => b.onclick = async () => { if (await saveTo(b.dataset.save)) { toast('Saved'); this.open(true); } });
    $$('[data-loadslot]', box).forEach(b => b.onclick = async () => {
      try { if (await loadFrom(b.dataset.loadslot)) { UI.closeModal(); Game.start(); toast('Loaded'); } } catch (e) { toast(e.message); }
    });
    const code = $('[data-code]', box);
    if (code) code.onclick = async () => {
      const ta = $('#save-code');
      if (code.dataset.code === 'make') { ta.value = await exportSave(); ta.select(); try { await navigator.clipboard.writeText(ta.value); toast('Code copied'); } catch (e) {} }
      else { try { await importSave(ta.value); UI.closeModal(); Game.start(); toast('Loaded'); } catch (e) { toast('That code did not work'); } }
    };
  }
};
