// Export ONE Ashfall map from Blender without losing the pictures that were repainted by hand after their last export
// (the skies by tools/blender/sky_only.py, the less-rusty metal / rust / glass pictures): the exporter writes the old ones.
//   node tools/ash-export.mjs <map> [<map> ...] --keep=<folder with a copy of Ashfall/assets taken BEFORE>
// For each map: runs `node tools/export-art.mjs <map>` (one name: never the bare command), then puts back from the copy
// every file of that map EXCEPT the model (<map>.hgm) and its baked light pictures (<map>_light*), and says what changed.
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
const maps = process.argv.slice(2).filter(a => !a.startsWith('--')), keep = (process.argv.find(a => a.startsWith('--keep=')) || '').slice(7), A = 'Ashfall/assets';
if (!maps.length || !keep || !fs.existsSync(keep)) { console.log('usage: node tools/ash-export.mjs <map> [...] --keep=<copy of Ashfall/assets from before>'); process.exit(1); }
const same = (a, b) => fs.existsSync(a) && fs.existsSync(b) && fs.statSync(a).size === fs.statSync(b).size && fs.readFileSync(a).equals(fs.readFileSync(b));
for (const m of maps) {
    if (!/^[a-z]+$/.test(m) || !fs.existsSync(path.join(A, m + '.hgm'))) { console.log(m + ': not an Ashfall map'); process.exit(1); }
    const out = cp.spawnSync(process.execPath, ['tools/export-art.mjs', m], { encoding: 'utf8' }); if (out.status !== 0) { console.log(m + ': the export failed\n' + (out.stdout + out.stderr).split('\n').slice(-8).join('\n')); process.exit(1); }
    let back = 0; const fresh = [], added = [];
    for (const f of fs.readdirSync(A).filter(f => f === m + '.hgm' || f.startsWith(m + '_'))) {
        const now = path.join(A, f), was = path.join(keep, f), own = f === m + '.hgm' || f.startsWith(m + '_light');
        if (!fs.existsSync(was)) { added.push(f); continue; }
        if (same(now, was)) continue;
        if (own) fresh.push(f + ' ' + Math.round(fs.statSync(now).size / 1024) + ' KB (was ' + Math.round(fs.statSync(was).size / 1024) + ')'); else { fs.copyFileSync(was, now); back++; }
    }
    console.log(m + ': new ' + (fresh.join(', ') || 'NOTHING (was it baked?)') + '; ' + back + ' repainted pictures put back' + (added.length ? '; NEW FILES: ' + added.join(', ') : ''));
}
