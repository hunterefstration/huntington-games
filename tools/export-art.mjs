#!/usr/bin/env node
// Blender file -> game assets, one command:
//   node tools/export-art.mjs              every art/**/<name>.export.json
//   node tools/export-art.mjs yard range   only these
// Each <name>.export.json sits beside its .blend ("blend": "file.blend" in the JSON, else <name>.blend, else the only
// .blend in the folder) and says what goes into the .hgm file (see tools/blender/hg_export.py). Needs Blender 4.x:
// on the PATH, in BLENDER (environment), or in the usual Windows / macOS place. No Blender window opens.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), want = process.argv.slice(2).filter(a => !a.startsWith('--'));
function findBlender() {
    if (process.env.BLENDER && fs.existsSync(process.env.BLENDER)) return process.env.BLENDER;
    const cands = [];
    for (const base of ['C:/Program Files/Blender Foundation', '/Applications']) if (fs.existsSync(base)) for (const d of fs.readdirSync(base).sort().reverse()) cands.push(path.join(base, d, 'blender.exe'), path.join(base, d, 'Contents/MacOS/Blender'));
    for (const c of cands) if (fs.existsSync(c)) return c;
    return 'blender';
}
const walk = d => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name.startsWith('_') ? [] : walk(path.join(d, e.name))) : e.name.endsWith('.export.json') ? [path.join(d, e.name)] : []) : [];
const jobs = walk(path.join(ROOT, 'art')).filter(f => !want.length || want.includes(path.basename(f, '.export.json')));
if (!jobs.length) { console.error('no art/**/*.export.json' + (want.length ? ' named ' + want.join(', ') : '')); process.exit(1); }
const blender = findBlender(); let bad = 0;
for (const job of jobs) {
    const dir = path.dirname(job), name = path.basename(job, '.export.json'), cfg = JSON.parse(fs.readFileSync(job, 'utf8'));
    const blends = fs.readdirSync(dir).filter(f => f.endsWith('.blend'));
    const blend = cfg.blend || (blends.includes(name + '.blend') ? name + '.blend' : blends.length === 1 ? blends[0] : null);
    if (!blend) { console.error(name + ': which .blend? add "blend": "file.blend" to ' + path.relative(ROOT, job)); bad++; continue; }
    console.log('== ' + name + '  (' + path.join(path.relative(ROOT, dir), blend) + ')');
    const r = spawnSync(blender, ['-b', path.join(dir, blend), '-P', path.join(ROOT, 'tools/blender/hg_export.py'), '--', job], { encoding: 'utf8', maxBuffer: 1 << 28 });
    const out = (r.stdout || '') + (r.stderr || ''), lines = out.split(/\r?\n/).filter(l => /\[hg_export|Traceback|Error|^\s+File "/.test(l));
    console.log(lines.join('\n'));
    if (r.error || r.status !== 0 || !/\[hg_export[^\]]*\] wrote /.test(out)) { console.error(name + ': FAILED' + (r.error ? ' (' + r.error.message + ')' : '')); bad++; }
}
process.exit(bad ? 1 : 0);
