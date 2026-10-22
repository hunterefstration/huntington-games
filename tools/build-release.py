#!/usr/bin/env python3
# Release build: picks a NEW random licence secret, bakes it (obfuscated) into the hub and every main game's
# gate together with the release number. The secret is never stored in the repo; it is written only to
# SECRET_OUT (outside the repo) so tests can mint tokens. Usage: tools/build-release.py <release-number>
import os, re, sys, subprocess, pathlib, secrets
N = int(sys.argv[1]); ROOT = pathlib.Path(os.environ.get('HG_ROOT') or pathlib.Path(__file__).resolve().parent.parent)
SECRET = secrets.token_urlsafe(12)
SECRET_OUT = pathlib.Path(os.environ.get('HG_TOOLS', '/tmp/hg-tools')) / 'hg_secret.txt'
GAMES = ['Sovereign', 'Frontline','Blocky Shooter V2','Tower Defense 2.0','Coffee Shop NEW','Tetris','Market Life 1.9','50 Levels Of Spikes 1.2','Brown E Clicker','Coffee Shop Tycoon Legacy']
def obf(js): return subprocess.run(['node', str(pathlib.Path(__file__).resolve().parent/'obf.js')], input=js, capture_output=True, text=True, check=True).stdout.strip()
# hub
hub = ROOT/'index.html'; lines = hub.read_text().split('\n')
k = [i for i, l in enumerate(lines) if l.startswith('var HG_BUILD_N')]; assert len(k) == 1, 'HG_BUILD_N line not found exactly once'
k = k[0]; lines[k] = 'var HG_BUILD_N = %d; /* release build - set by tools/build-release.py */' % N
lines[k + 1] = obf((ROOT/'src/hub-licence.tpl.js').read_text().replace('__SECRET__', SECRET))
hub.write_text('\n'.join(lines))
# games
tmpl = (ROOT/'src/gate-game.js').read_text()
for d in GAMES:
    f = ROOT/d/'index.html'; s = f.read_text()
    s = re.sub(r'\n<!--HG-->.*?<!--/HG-->', '', s, flags=re.S)   # idempotent: strip only what we insert
    snip = '\n<!--HG--><script>' + obf(tmpl.replace('__BUILD__', str(N)).replace('__ID__', d).replace('__SECRET__', SECRET)) + '</script><!--/HG-->'
    m = re.search(r'<head[^>]*>', s, re.I); assert m, d
    f.write_text(s[:m.end()] + snip + s[m.end():])
SECRET_OUT.write_text(SECRET)
assert SECRET not in hub.read_text() and all(SECRET not in (ROOT/d/'index.html').read_text() for d in GAMES), 'secret leaked in plain text'
print('release build', N, 'done; secret rotated (kept outside repo)')
