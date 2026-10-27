// Leader setup: play as the real leader or create your own, with a simple face maker.
const FACE = {
  skin: ['#f6d7c3', '#e8b896', '#c98e66', '#a0694a', '#7a4a32', '#4f2f22'],
  hairColor: ['#1d1a19', '#4a3123', '#7b5534', '#c7a46a', '#d9d4cc', '#8f2f1f'],
  hair: ['short', 'side', 'long', 'bun', 'curly', 'bald'],
  beard: ['none', 'stubble', 'full', 'mustache'],
  suit: ['#1d2b4a', '#2b2b2f', '#4a1f28', '#24433a', '#5a5f6b', '#8a6a2e'],
  glasses: [false, true]
};
function hashStr(s) { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }
function faceFromName(name) {
  const r = makeRng(hashStr(name)), pick = a => a[Math.floor(r() * a.length)];
  return { skin: pick(FACE.skin), hairColor: pick(FACE.hairColor), hair: pick(FACE.hair), beard: r() < 0.25 ? pick(FACE.beard) : 'none', suit: pick(FACE.suit), glasses: r() < 0.3 };
}
function faceSvg(f) {
  const hc = f.hairColor, sk = f.skin, shade = '#' + new THREE.Color(sk).multiplyScalar(0.85).getHexString();
  const hair = {
    short: `<path d="M30 40 Q30 18 50 17 Q70 18 70 40 Q66 28 50 27 Q34 28 30 40Z" fill="${hc}"/>`,
    side: `<path d="M29 42 Q28 16 52 16 Q72 18 71 40 Q64 25 44 29 Q34 31 29 42Z" fill="${hc}"/>`,
    long: `<path d="M28 62 Q24 18 50 16 Q76 18 72 62 L68 62 Q70 32 50 27 Q30 32 32 62Z" fill="${hc}"/>`,
    bun: `<circle cx="50" cy="14" r="8" fill="${hc}"/><path d="M30 40 Q30 18 50 18 Q70 18 70 40 Q64 27 50 27 Q36 27 30 40Z" fill="${hc}"/>`,
    curly: `<path d="M28 42 Q22 22 36 17 Q44 10 54 15 Q66 11 72 24 Q78 34 71 42 Q68 28 50 27 Q32 28 28 42Z" fill="${hc}"/>`,
    bald: `<path d="M31 44 Q30 36 33 34 L33 44Z M69 44 Q70 36 67 34 L67 44Z" fill="${hc}"/>`
  }[f.hair] || '';
  const beard = { none: '', stubble: `<path d="M36 52 Q38 70 50 72 Q62 70 64 52 Q60 64 50 65 Q40 64 36 52Z" fill="${hc}" opacity=".35"/>`,
    full: `<path d="M34 50 Q35 74 50 76 Q65 74 66 50 Q62 66 50 66 Q38 66 34 50Z" fill="${hc}"/>`, mustache: `<path d="M42 59 Q50 55 58 59 Q50 58 42 59Z" fill="${hc}" stroke="${hc}" stroke-width="2"/>` }[f.beard] || '';
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 100 Q16 78 38 74 L62 74 Q84 78 86 100Z" fill="${f.suit}"/>
    <path d="M42 74 L50 90 L58 74Z" fill="#f2f2f2"/><path d="M48 78 L52 78 L53 92 L50 96 L47 92Z" fill="#a8323a"/>
    <rect x="43" y="60" width="14" height="16" rx="5" fill="${shade}"/>
    <ellipse cx="31" cy="47" rx="4" ry="6" fill="${shade}"/><ellipse cx="69" cy="47" rx="4" ry="6" fill="${shade}"/>
    <ellipse cx="50" cy="45" rx="19" ry="23" fill="${sk}"/>
    ${hair}
    <path d="M40 40 Q43 38 46 40 M54 40 Q57 38 60 40" stroke="${hc}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <circle cx="43" cy="45" r="1.9" fill="#1b1b1b"/><circle cx="57" cy="45" r="1.9" fill="#1b1b1b"/>
    <path d="M50 46 Q48 53 51 54" stroke="${shade}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M44 60 Q50 63 56 60" stroke="#8a4a3f" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    ${beard}
    ${f.glasses ? '<g fill="none" stroke="#222" stroke-width="1.5"><circle cx="43" cy="45" r="5"/><circle cx="57" cy="45" r="5"/><path d="M48 45 L52 45"/></g>' : ''}
  </svg>`;
}
function ideologyName(econ, social) {
  const e = econ < -0.5 ? 'Left' : econ < -0.15 ? 'Centre-left' : econ <= 0.15 ? 'Centre' : econ <= 0.5 ? 'Centre-right' : 'Right';
  const s = social < -0.3 ? 'progressive' : social > 0.3 ? 'traditional' : 'moderate';
  return e + ', ' + s;
}
function difficultyOf(idx) {
  const n = World.nat0[idx];
  const d = 1 + (1 - n.dev) * 2 + (n.stability < 35 ? 1 : 0) + (debtPct(n) > 100 ? 0.5 : 0) + (n.approval < 35 ? 0.5 : 0) - (gdpUsd(n) > 1e12 ? 1 : 0) + (n.pop < 2e5 ? 0.5 : 0);
  return clamp(Math.round(d), 1, 5);
}

const Setup = {
  o: null,
  open(idx) {
    const n = World.nat0[idx], c = World.countries[idx];
    this.o = { idx, real: true, name: n.leader, title: n.title, party: '', econ: 0, social: 0, traits: [], face: faceFromName(n.leader), custom: { name: '', face: faceFromName('custom' + idx) } };
    UI.show('setup'); this.render();
  },
  render() {
    const o = this.o, n = World.nat0[o.idx], c = World.countries[o.idx], stars = difficultyOf(o.idx);
    const seg = (key, opts) => `<div class="seg" data-o="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(o[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const sw = (key, arr) => `<div class="swatches" data-face="${key}">${arr.map(v => `<button class="sw${o.face[key] === v ? ' on' : ''}" data-v="${v}" style="background:${v}"></button>`).join('')}</div>`;
    $('#setup-body').innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-top:8px"><span style="font-size:40px">${c.flag}</span>
        <div><b style="font-size:18px">${esc(c.name)}</b><div class="sub">${esc(GOV[n.gov].name)} · Difficulty <span class="stars">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</span></div></div></div>
      <div class="setup-grid"><div>
        <div class="who"><button class="btn${o.real ? ' on' : ''}" data-who="real">Play as ${esc(n.leader)}</button><button class="btn${o.real ? '' : ' on'}" data-who="custom">Create my own leader</button></div>
        ${o.real ? `<div class="note-box">You take over from ${esc(n.title + ' ' + n.leader)} as of mid 2026, partway through their time in office.</div>` :
          `<div class="field"><label>Your name</label><input type="text" id="su-name" maxlength="40" value="${esc(o.name)}" placeholder="Your leader's name"></div>
           <div class="field"><label>Title</label><input type="text" id="su-title" maxlength="30" value="${esc(o.title)}"></div>`}
        <div class="field"><label>Party name</label><input type="text" id="su-party" maxlength="40" value="${esc(o.party)}" placeholder="${o.real ? 'Their party' : 'e.g. New Dawn Party'}"></div>
        <div class="field"><label>Economy</label>${seg('econ', [[-0.75, 'Left'], [-0.35, 'Centre-left'], [0, 'Centre'], [0.35, 'Centre-right'], [0.75, 'Right']])}</div>
        <div class="field"><label>Society</label>${seg('social', [[-0.6, 'Progressive'], [0, 'Moderate'], [0.6, 'Traditional']])}</div>
        <div class="field"><label>Pick 2 traits (${o.traits.length}/2)</label><div class="traits">${TRAITS.map(t => `<button class="trait${o.traits.includes(t.id) ? ' on' : ''}" data-trait="${t.id}">${t.name}<small>${t.desc}</small></button>`).join('')}</div></div>
      </div><div>
        <div class="facts" style="margin-top:12px"><b>People</b><span>${fmtBig(n.pop)}</span><b>GDP</b><span>$${fmtBig(gdpUsd(n))}</span><b>Debt</b><span>${debtPct(n).toFixed(0)}% of GDP</span><b>Approval</b><span>${n.approval.toFixed(0)}%</span></div>
        <button class="btn gold" style="width:100%;text-align:center;margin-top:8px" data-act="take-office">Take office</button>
      </div></div>`;
    const body = $('#setup-body');
    $$('[data-who]', body).forEach(b => b.onclick = () => {
      const real = b.dataset.who === 'real'; if (real === o.real) return;
      if (real) { o.custom = { name: o.name, face: o.face, title: o.title }; o.name = n.leader; o.title = n.title; o.face = faceFromName(n.leader); }
      else { o.name = o.custom.name; o.title = o.custom.title || n.title; o.face = o.custom.face; }
      o.real = real; this.render();
    });
    $$('[data-o]', body).forEach(s => s.onclick = e => { const b = e.target.closest('[data-v]'); if (b) { o[s.dataset.o] = +b.dataset.v; this.render(); } });
    $$('[data-trait]', body).forEach(b => b.onclick = () => {
      const id = b.dataset.trait, i = o.traits.indexOf(id);
      if (i >= 0) o.traits.splice(i, 1); else { o.traits.push(id); if (o.traits.length > 2) o.traits.shift(); }
      this.render();
    });
    $$('[data-face]', body).forEach(s => s.onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; const v = b.dataset.v; o.face[s.dataset.face] = v === 'true' ? true : v === 'false' ? false : v; this.render(); });
    const bind = (id, key) => { const inp = $(id, body); if (inp) inp.oninput = () => { o[key] = inp.value; }; };
    bind('#su-name', 'name'); bind('#su-title', 'title'); bind('#su-party', 'party');
  },
  go() {
    const o = this.o, n = World.nat0[o.idx];
    if (!o.real && !o.name.trim()) { toast('Give your leader a name first'); return; }
    if (o.traits.length < 2) { toast('Pick 2 traits'); return; }
    newGame({ idx: o.idx, name: o.name.trim(), title: (o.title || n.title).trim(), party: o.party.trim() || (o.real ? 'Governing party' : 'Independent'),
      econ: o.econ, social: o.social, traits: o.traits, face: o.face, real: o.real });
    Game.start();
    inbox('info', 'Welcome to office, ' + G.player.title + ' ' + G.player.name, 'Press play (space) to start time. Click any number at the top to see what drives it. Open Budget to change taxes and spending, and Money & Debt to run the central bank and currency.');
    Game.refresh();
  }
};
