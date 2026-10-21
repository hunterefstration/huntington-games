#!/usr/bin/env node
// Joins Sovereign/src (shell.html, css/*.css, js/*.js in name order) and Sovereign/data/*.json into the one file the
// Launcher loads: Sovereign/index.html. Keeps the <!--HG-->...<!--/HG--> licence block of the current index.html as is.
// Usage: node tools/build-sovereign.js [--check]   (--check: syntax-check the joined script too)
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const DIR = path.join(__dirname, '..', 'Sovereign'), SRC = path.join(DIR, 'src'), OUT = path.join(DIR, 'index.html');
const list = (d, ext) => fs.readdirSync(d).filter(f => f.endsWith(ext)).sort().map(f => path.join(d, f));
const read = f => fs.readFileSync(f, 'utf8');
const css = list(path.join(SRC, 'css'), '.css').map(read).join('\n');
const js = list(path.join(SRC, 'js'), '.js').map(f => '// ---- ' + path.basename(f) + ' ----\n' + read(f)).join('\n');
const data = list(path.join(DIR, 'data'), '.json').map(f => {
  const id = path.basename(f, '.json'), body = JSON.stringify(JSON.parse(read(f))).replace(/<\//g, '<\\/');
  return '<script type="application/json" id="sov-data-' + id + '">' + body + '</script>';
}).join('\n');
if (js.includes('</script')) throw new Error('"</script" inside the game code would end the script tag early');
if (process.argv.includes('--check')) {
  const tmp = path.join(os.tmpdir(), 'sov-check-' + process.pid + '.mjs');
  fs.writeFileSync(tmp, js.replace(/^import .*$/mg, ''));
  try { cp.execFileSync(process.execPath, ['--check', tmp], { stdio: 'inherit' }); } finally { fs.unlinkSync(tmp); }
}
let html = read(path.join(SRC, 'shell.html'))
  .replace('<!--@css-->', () => '<style>\n' + css + '\n</style>')
  .replace('<!--@data-->', () => data)
  .replace('<!--@js-->', () => '<script type="module">\n' + js + '\n</script>');
const old = fs.existsSync(OUT) ? read(OUT) : '', hg = /\n<!--HG-->[\s\S]*?<!--\/HG-->/.exec(old);
if (hg) { const m = /<head[^>]*>/i.exec(html); html = html.slice(0, m.index + m[0].length) + hg[0] + html.slice(m.index + m[0].length); }
fs.writeFileSync(OUT, html);
console.log('Sovereign/index.html', (html.length / 1024).toFixed(0) + ' KB', hg ? '(licence block kept)' : '');
