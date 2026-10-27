#!/usr/bin/env node
// Joins a game's sources into the one file the Launcher loads, <game>/index.html:
//   <game>/src/shell.html with <!--@css--> <- src/css/*.css, <!--@js--> <- src/js/*.js (both in file-name order),
//   <!--@data--> <- <game>/data/*.json|*.tsv as <script type="application/json" id="<prefix>-data-<name>"> tags.
// <!--@js indent=8--> indents every non-blank game line by 8 spaces (sources are kept unindented).
// Keeps the <!--HG-->...<!--/HG--> licence block of the current index.html as is.
// Usage: node tools/build-game.js "<game dir>" [--check]   (--check: syntax-check the joined script too)
// Games built this way: Sovereign, Blocky Shooter V2.
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const GAME = process.argv.slice(2).find(a => !a.startsWith('--'));
if (!GAME) { console.error('usage: node tools/build-game.js "<game dir>" [--check]'); process.exit(1); }
const DIR = path.join(__dirname, '..', GAME), SRC = path.join(DIR, 'src'), OUT = path.join(DIR, 'index.html');
const DATA_PREFIX = { Sovereign: 'sov' }[GAME] || GAME.toLowerCase().replace(/[^a-z0-9]+/g, '');
const list = (d, ext) => fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith(ext)).sort().map(f => path.join(d, f)) : [];
const read = f => fs.readFileSync(f, 'utf8');
const css = list(path.join(SRC, 'css'), '.css').map(read).join('\n');
const js = list(path.join(SRC, 'js'), '.js').map(f => '// ---- ' + path.basename(f) + ' ----\n' + read(f)).join('\n');
// data/*.json as is; data/*.tsv (first row = column names) become arrays of objects, numbers parsed
const tsv = t => { const [head, ...rows] = t.trim().split('\n').map(l => l.split('\t')); return rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] === '-' || r[i] == null ? '' : isNaN(+r[i]) || r[i] === '' ? r[i] : +r[i]]))); };
const data = list(path.join(DIR, 'data'), '.json').concat(list(path.join(DIR, 'data'), '.tsv')).map(f => {
  const id = path.basename(f).replace(/\.(json|tsv)$/, ''), v = f.endsWith('.tsv') ? tsv(read(f)) : JSON.parse(read(f));
  const body = JSON.stringify(v).replace(/<\//g, '<\\/');
  return '<script type="application/json" id="' + DATA_PREFIX + '-data-' + id + '">' + body + '</script>';
}).join('\n');
if (js.includes('</script')) throw new Error('"</script" inside the game code would end the script tag early');
if (process.argv.includes('--check')) {
  const tmp = path.join(os.tmpdir(), 'game-check-' + process.pid + '.mjs');
  fs.writeFileSync(tmp, js.replace(/^import .*$/mg, ''));
  try { cp.execFileSync(process.execPath, ['--check', tmp], { stdio: 'inherit' }); } finally { fs.unlinkSync(tmp); }
}
const indent = (s, n) => n ? s.split('\n').map(l => l ? ' '.repeat(n) + l : l).join('\n') : s;
let html = read(path.join(SRC, 'shell.html'))
  .replace('<!--@css-->', () => '<style>\n' + css + '\n</style>')
  .replace('<!--@data-->', () => data)
  .replace(/<!--@js(?: indent=(\d+))?-->/, (_, n) => '<script type="module">\n' + indent(js, +n || 0) + '\n</script>');
const old = fs.existsSync(OUT) ? read(OUT) : '', hg = /\n<!--HG-->[\s\S]*?<!--\/HG-->/.exec(old);
if (hg) { const m = /<head[^>]*>/i.exec(html); html = html.slice(0, m.index + m[0].length) + hg[0] + html.slice(m.index + m[0].length); }
fs.writeFileSync(OUT, html);
console.log('built ' + path.relative(path.join(__dirname, '..'), OUT) + ' (' + (html.length / 1024).toFixed(0) + ' KB)');
