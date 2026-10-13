#!/usr/bin/env python3
import re, sys, subprocess, pathlib
BUILD = sys.argv[1] if len(sys.argv) > 1 else '31'
SECRET = 'hGx9__k3v7'
ROOT = pathlib.Path('/home/user/huntington-games')
GAMES = ['Frontline','Blocky Shooter V2','Tower Defense 2.0','Coffee Shop NEW','Tetris',
         'Market Life 1.9','50 Levels Of Spikes 1.2','Brown E Clicker','Coffee Shop Tycoon Legacy']
tmpl = (ROOT/'src/gate-game.js').read_text()
def obf(js):
    return subprocess.run(['node', str(ROOT/'tools/obf.js')], input=js, capture_output=True, text=True, check=True).stdout
for d in GAMES:
    f = ROOT/d/'index.html'; s = f.read_text()
    s = re.sub(r'\n?<!--HG-->.*?<!--/HG-->\n?', '\n', s, flags=re.S)
    body = tmpl.replace('__BUILD__', BUILD).replace('__ID__', d).replace('__SECRET__', SECRET)
    snip = '\n<!--HG--><script>'+obf(body).strip()+'</script><!--/HG-->\n'
    m = re.search(r'<head[^>]*>', s, re.I); assert m, d
    s = s[:m.end()] + snip + s[m.end():]; f.write_text(s); print('gated+obf', d)
