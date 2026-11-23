// Publish the working tree as the next test build. Nothing here touches HEAD or main.
//   node tools/proof-publish.mjs "what is in it"        (--dry: build everything, push nothing)
//
// jsDelivr refuses every file of a tag whose whole tree is over 50 MB, and the repo with all the game assets is. So a
// test build is several small tags, and the one piece of paste-in code (Proof Slice/loader.html) still only knows one:
//   1. a WIP snapshot of everything, pushed to wip/content-wave (the backup);
//   2. PACKS: for each game, the files of <game>/assets/ grouped by the first word of their name (yard_*, w_*, foe_* ...),
//      each group a commit of its own tagged pk-<game>-<word>-<hash of its content>. A pack whose content has not changed
//      keeps its tag, so it is not uploaded again and browsers keep their copy;
//   3. the CODE tag proof<N>: the built pages plus packs.json, which says which pack tag holds which group. The games read
//      it (Packs / AST in their 10-core.js) and fetch each asset from its pack's tag.
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GAMES = [{ slug: 'ashfall', dir: 'Ashfall' }, { slug: 'ssr', dir: 'Steel Storm Remastered' }];
const CODE = ['latest.json', 'Proof Slice/index.html', 'Lab/index.html', 'gv/account.js', 'hub/ashfall.jpg', 'hub/steelstormr.jpg'].concat(GAMES.map(g => g.dir + '/index.html'));
const LIMIT = 45e6, TRAILER = '\n\nCo-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>';
const args = process.argv.slice(2), dry = args.includes('--dry'), MSG = args.filter(a => a[0] !== '-')[0] || 'work in progress';
process.chdir(join(dirname(fileURLToPath(import.meta.url)), '..'));
const tmp = mkdtempSync(join(tmpdir(), 'hgpub-'));
let nIndex = 0;
const git = (a, o = {}) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28, input: o.input, env: { ...process.env, ...(o.index ? { GIT_INDEX_FILE: o.index } : {}) } }).replace(/\n$/, '');
const newIndex = () => join(tmp, 'index' + nIndex++);
const mb = b => (b / 1048576).toFixed(1) + ' MB';

// ---- 1. the snapshot of everything
const remote = git(['ls-remote', 'origin', 'refs/tags/proof*', 'refs/tags/pk-*', 'refs/heads/wip/content-wave']).split('\n').filter(Boolean).map(l => l.split('\t'));
const N = remote.reduce((m, r) => { const k = /^refs\/tags\/proof(\d+)$/.exec(r[1]); return k ? Math.max(m, +k[1]) : m; }, 0) + 1;
const have = new Set(remote.map(r => r[1]));
const wip = (remote.find(r => r[1] === 'refs/heads/wip/content-wave') || [])[0];
const all = newIndex(); git(['read-tree', 'HEAD'], { index: all }); git(['add', '-A'], { index: all });
const bad = git(['diff', '--cached', '--name-only', 'HEAD'], { index: all }).split('\n').filter(f => /secret|\.blend1?$|\.exr$|\/_cache\/|\.env$/i.test(f));
if (bad.length) { console.error('refusing: these must not be published:\n' + bad.join('\n')); process.exit(1); }
if (wip) { try { git(['cat-file', '-e', wip]); } catch (e) { git(['fetch', '-q', 'origin', 'wip/content-wave']); } }
const C = git(['commit-tree', git(['write-tree'], { index: all }), '-p', 'HEAD'].concat(wip ? ['-p', wip] : [], ['-m', 'WIP snapshot: test build ' + N + ' (' + MSG + ')' + TRAILER]));

// the files of a commit under some paths: [{ mode, type, sha, size, path }]
const filesOf = paths => git(['ls-tree', '-r', '-l', '-z', C, '--'].concat(paths)).split('\0').filter(Boolean).map(l => { const [head, path] = l.split('\t'), [mode, type, sha, size] = head.split(/\s+/); return { mode, type, sha, size: +size, path }; });
const treeOf = (files, extra) => { const ix = newIndex(); git(['read-tree', '--empty'], { index: ix }); git(['update-index', '-z', '--index-info'], { index: ix, input: files.map(f => f.mode + ' ' + f.type + ' ' + f.sha + '\t' + f.path).join('\0') + '\0' }); for (const x of extra || []) git(['update-index', '--add', '--cacheinfo', '100644,' + x.sha + ',' + x.path], { index: ix }); return git(['write-tree'], { index: ix }); };

// ---- 2. the packs
const packs = {}, push = [C + ':refs/heads/wip/content-wave']; let total = 0, fresh = 0;
for (const g of GAMES) {
    const groups = {};
    for (const f of filesOf([g.dir + '/assets'])) { const word = f.path.slice(g.dir.length + 8).split(/[_.]/)[0]; (groups[word] = groups[word] || []).push(f); }
    for (const word of Object.keys(groups).sort()) {
        const files = groups[word], bytes = files.reduce((s, f) => s + f.size, 0), tree = treeOf(files), tag = 'pk-' + g.slug + '-' + word.toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + tree.slice(0, 10);
        if (bytes > LIMIT) { console.error('refusing: pack ' + g.slug + '/' + word + ' is ' + mb(bytes) + ', over the CDN limit: split it (rename files so they start with different words)'); process.exit(1); }
        packs[g.slug + '/' + word] = tag; total += bytes;
        if (!have.has('refs/tags/' + tag)) { fresh += bytes; push.push(git(['commit-tree', tree, '-m', 'Asset pack ' + g.slug + '/' + word + TRAILER]) + ':refs/tags/' + tag); console.log('  new pack ' + tag + '  ' + mb(bytes)); }
    }
}

// ---- 3. the code tag
const blob = git(['hash-object', '-w', '--stdin'], { input: JSON.stringify(packs, null, 1) + '\n' });
const code = filesOf(CODE), codeBytes = code.reduce((s, f) => s + f.size, 0);
if (code.length !== CODE.length) { console.error('refusing: a page is missing (have ' + code.map(f => f.path).join(', ') + ')'); process.exit(1); }
const SC = git(['commit-tree', treeOf(code, [{ sha: blob, path: 'packs.json' }]), '-p', C, '-m', 'Test build ' + N + ': the pages and the list of asset packs (' + MSG + ')' + TRAILER]);
push.push(SC + ':refs/tags/proof' + N);
console.log('pages ' + mb(codeBytes) + ', ' + Object.keys(packs).length + ' packs ' + mb(total) + ' (' + mb(fresh) + ' new)');
if (dry) { console.log('dry run: nothing pushed (would be test build ' + N + ')'); process.exit(0); }
git(['push', '-q', 'origin'].concat(push));
console.log('published test build ' + N + ' = ' + SC + ' (snapshot ' + C + ')');
