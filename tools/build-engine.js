#!/usr/bin/env node
// Joins engine/src/*.js into engine/hg3d.js (one `const HG3D = (() => {...})()`, no imports, so it pastes into
// a module or a plain script) and copies it into every game that uses the engine (same model as Minigames/_shared).
//   node tools/build-engine.js            build + copy
//   node tools/build-engine.js --check    exit 1 if engine/hg3d.js or a game's copy is out of step
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), SRC = path.join(ROOT, 'engine', 'src'), OUT = path.join(ROOT, 'engine', 'hg3d.js');
// game folder -> where its copy of the engine lives (edit engine/src, never the copies)
const TARGETS = {
    'Mayhem Marathon': 'src/js/05-hg3d.js',
    'Steel Storm': 'src/js/05-hg3d.js',
    'Proof Slice': 'src/js/05-hg3d.js'        // native scenes only: no three.js at all
    // Sovereign was ported and measured (2026-11): pixel-identical, but only 11% faster with a slowed CPU and no faster on
    // pixels (its time goes to its own globe shaders and its simulation, which a renderer cannot change). Stays on three.js.
    // Frontline was ported and measured (2026-11): 22% faster median frames with a slowed CPU, but its slow frames (the
    // ones with a 20 Hz simulation tick) and its pixel cost did not improve, so it stays on three.js. Its port is kept on
    // branch engine/hg3d-frontline (there this list also has  'Frontline': 'src/js/10-game/005-hg3d.js').
};
const EXPORTS = 'VERSION, createRenderer, pick, bail, choose, chosen, M4, governor, meter, speedTest, benchCard, benchResults, '
    + 'color, attr, geometry, material, texture, node, mesh, instanced, light, camera, fog, geo, '
    + 'load, loadTexture, place, skyDome';
const CHECK = process.argv.includes('--check');

const files = fs.readdirSync(SRC).filter(f => f.endsWith('.js')).sort();
const body = files.map(f => '// ---- ' + f + ' ----\n' + fs.readFileSync(path.join(SRC, f), 'utf8').replace(/\r\n/g, '\n').trimEnd()).join('\n\n');
const exportsList = fs.existsSync(path.join(SRC, 'exports.txt')) ? fs.readFileSync(path.join(SRC, 'exports.txt'), 'utf8').trim() : EXPORTS;
const built = '// HG3D engine. BUILT FILE: edit engine/src/*.js, then run `node tools/build-engine.js`.\n'
    + 'const HG3D = (() => {\n\'use strict\';\n' + body + '\nreturn { ' + exportsList + ' };\n})();\n';
try { new Function(built + '\nreturn HG3D;'); } catch (e) { console.error('engine/hg3d.js does not parse: ' + e.message); process.exit(1); }

let stale = 0;
const put = (file, text, what) => {
    const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : null;
    if (cur === text) return;
    if (CHECK) { console.error('out of step: ' + what + ' (run node tools/build-engine.js)'); stale++; return; }
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); console.log('wrote ' + what);
};
put(OUT, built, 'engine/hg3d.js');
for (const game in TARGETS) put(path.join(ROOT, game, TARGETS[game]), built, game + '/' + TARGETS[game]);
if (CHECK && stale) process.exit(1);
if (!CHECK) console.log('HG3D: ' + files.length + ' source files, ' + (built.length / 1024).toFixed(1) + ' KB');
module.exports = { TARGETS };
