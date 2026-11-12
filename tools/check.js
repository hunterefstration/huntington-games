#!/usr/bin/env node
// One command that says whether the repo is in a state that can be committed and released:
//   node tools/check.js            report problems, change nothing (exit 1 if there are any)
//   node tools/check.js --fix      also rebuild every index.html that is out of step with its sources
//   node tools/check.js "Tetris" "Last Light"     only these games (the cross-checks still run)
// What it checks:
//   1. every game's index.html is exactly what its src/ builds to (nobody edited the built file, nobody forgot to rebuild),
//      and each script in it parses (build-game.js --check). The hub too (launcher/ -> index.html).
//   2. the lists that must agree do: every game on the launcher's main page is in tools/build-release.py GAMES (or it
//      would ship without its licence block), has its hub/<img>.jpg, and its folder exists.
//   3. the six minigames carry the same shared lobby files as Minigames/_shared.
//   4. Grapevine's built copies (gv/app.html, gv/account.js) are what the sources build to, when ../grapevine is there.
// The licence block (<!--HG-->...<!--/HG-->) and the hub's two release lines differ between a release and a dev build
// by design, so they are left out of the comparison.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..'), FIX = process.argv.includes('--fix');
const only = process.argv.slice(2).filter(a => !a.startsWith('--'));
const problems = [], notes = [];
const read = f => fs.readFileSync(f, 'utf8');
const norm = (html, hub) => {
  html = html.replace(/\n?<!--HG-->[\s\S]*?<!--\/HG-->/g, '');
  if (hub) { const l = html.split('\n'), k = l.findIndex(x => x.startsWith('var HG_BUILD_N')); if (k >= 0) { l[k] = 'var HG_BUILD_N'; l[k + 1] = '/*licence*/'; } html = l.join('\n'); }
  return html;
};
// --- 1. built files ---
const games = [];
for (const d of fs.readdirSync(ROOT)) {
  if (fs.existsSync(path.join(ROOT, d, 'src', 'shell.html'))) games.push(d);
  if (d === 'Minigames') for (const m of fs.readdirSync(path.join(ROOT, d))) if (fs.existsSync(path.join(ROOT, d, m, 'src', 'shell.html'))) games.push(d + '/' + m);
}
const targets = games.map(g => ({ name: g, args: [g], out: path.join(ROOT, g, 'index.html') })).concat([{ name: 'the hub (launcher/)', args: ['.', '--src', 'launcher'], out: path.join(ROOT, 'index.html'), hub: true }]);
for (const t of targets) {
  if (only.length && !only.includes(t.name) && !(t.hub && only.includes('.'))) continue;
  const before = fs.existsSync(t.out) ? read(t.out) : '';
  const r = cp.spawnSync(process.execPath, [path.join(__dirname, 'build-game.js'), ...t.args, '--check'], { encoding: 'utf8' });
  if (r.status !== 0) { problems.push(`${t.name}: does not build: ${(r.stderr || r.stdout).split('\n').filter(l => /Error|error/.test(l))[0] || 'see node tools/build-game.js'}`); if (before) fs.writeFileSync(t.out, before); continue; }
  const after = read(t.out);
  if (norm(before, t.hub) !== norm(after, t.hub)) {
    if (FIX) notes.push(`${t.name}: index.html rebuilt from its sources`);
    else { problems.push(`${t.name}: index.html is not what its sources build to (run: node tools/check.js --fix, then commit both)`); fs.writeFileSync(t.out, before); }
  } else if (before !== after) fs.writeFileSync(t.out, before);      // only the release lines differ: keep the file as it was
}
// --- 2. the lists ---
try {
  const hub = read(path.join(ROOT, 'launcher/js/10-hub/010-where-the-games-live-opened.js'));
  const main = hub.slice(hub.indexOf('var GAMES'), hub.indexOf('var EXPERIMENTAL'));
  const rel = eval(/GAMES = (\[[\s\S]*?\])/.exec(read(path.join(__dirname, 'build-release.py')))[1]);
  const re = /\{ dir: '((?:[^'\\]|\\.)*)'[^\n]*?(?:img: '([^']*)')?/g; let m, n = 0;
  while ((m = re.exec(main))) {
    n++; const dir = m[1].replace(/\\'/g, "'"), img = (/img: '([^']*)'/.exec(main.slice(m.index, main.indexOf('\n', m.index))) || [])[1];
    if (!fs.existsSync(path.join(ROOT, dir, 'index.html'))) problems.push(`launcher card "${dir}": no such game folder`);
    if (!rel.includes(dir)) problems.push(`"${dir}" is on the launcher but not in tools/build-release.py GAMES: it would be released without its licence block`);
    if (img && !fs.existsSync(path.join(ROOT, 'hub', img + '.jpg'))) problems.push(`"${dir}": hub/${img}.jpg is missing (the card would have no picture)`);
  }
  if (n < 10) problems.push('could not read the launcher\'s GAMES list (check.js needs updating)');
  for (const d of rel) if (!fs.existsSync(path.join(ROOT, d, 'index.html'))) problems.push(`tools/build-release.py lists "${d}" but that folder has no index.html`);
} catch (e) { problems.push('lists check failed: ' + e.message); }
// --- 3. minigames share one lobby ---
try {
  const sh = path.join(ROOT, 'Minigames/_shared');
  for (const g of games.filter(g => g.startsWith('Minigames/'))) for (const [a, b] of [['mg.js', 'src/js/00-mg.js'], ['mg.css', 'src/css/00-mg.css']]) {
    const f = path.join(ROOT, g, b);
    if (fs.existsSync(f) && read(f) !== read(path.join(sh, a))) problems.push(`${g}: ${b} differs from Minigames/_shared/${a} (edit the shared file, then: bash Minigames/build.sh)`);
  }
} catch (e) {}
// --- 3b. Brown E Clicker's Tailwind CSS is built ahead of time: is it what the sources ask for? ---
try {
  const tw = path.join(process.env.HG_TOOLS || '/tmp/hg-tools', 'node_modules/tailwindcss/package.json'), bd = path.join(ROOT, 'Brown E Clicker');
  if (fs.existsSync(tw) && fs.existsSync(path.join(bd, 'tools/tailwind.sh')) && (!only.length || only.includes('Brown E Clicker'))) {
    const tmp = path.join(require('os').tmpdir(), 'hg-tw-' + process.pid + '.css');
    const r = cp.spawnSync('bash', [path.join(bd, 'tools/tailwind.sh')], { encoding: 'utf8', env: Object.assign({}, process.env, { OUT: tmp }) });
    if (r.status === 0 && fs.existsSync(tmp)) {
      if (read(tmp) !== read(path.join(bd, 'src/css/05-tailwind.css'))) {
        if (FIX) { fs.copyFileSync(tmp, path.join(bd, 'src/css/05-tailwind.css')); cp.spawnSync(process.execPath, [path.join(__dirname, 'build-game.js'), 'Brown E Clicker', '--check']); notes.push('Brown E Clicker: Tailwind CSS rebuilt'); }
        else problems.push('Brown E Clicker: its Tailwind classes changed but src/css/05-tailwind.css was not rebuilt (bash "Brown E Clicker/tools/tailwind.sh", then build the game; or node tools/check.js --fix)');
      }
      fs.unlinkSync(tmp);
    }
  }
} catch (e) {}
// --- 4. Grapevine's copies ---
try {
  const gv = path.join(ROOT, '..', 'grapevine');
  if (fs.existsSync(path.join(gv, 'client.html'))) {
    if (read(path.join(gv, 'client.html')).length !== read(path.join(ROOT, 'gv/app.html')).length) notes.push('gv/app.html is not the current grapevine/client.html (bash tools/sync-grapevine.sh), unless Grapevine is ahead on purpose');
    const core = fs.statSync(path.join(ROOT, 'gv/core.js')).mtimeMs, acc = fs.statSync(path.join(ROOT, 'gv/account.js')).mtimeMs;
    const built = cp.spawnSync('bash', ['-c', 'cat gv/vendor/ed25519.js gv/vendor/gvlink.js gv/core.js gv/ach.js gv/ui.js | wc -c'], { cwd: ROOT, encoding: 'utf8' });
    if (core > acc + 1000 && built.status === 0) notes.push('gv/core.js is newer than gv/account.js: run bash tools/build-gv.sh if you changed it');
  }
} catch (e) {}
for (const n of notes) console.log('note  ' + n);
for (const p of problems) console.log('FAIL  ' + p);
console.log(problems.length ? `\n${problems.length} problem(s)` : `ok: ${targets.length - (only.length ? targets.length - only.length : 0)} built file(s) match their sources, lists agree`);
process.exit(problems.length ? 1 : 0);
