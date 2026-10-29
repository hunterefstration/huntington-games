#!/usr/bin/env python3
"""Split a single-file game (<game>/index.html) into <game>/src/ so it can be edited in pieces:
  src/shell.html          the page, with every big <style>/<script> body replaced by <!--@inline ...-->
  src/css/NN-name.css     each stylesheet
  src/js/NN-name.js       each small script; a big one becomes a folder src/js/NN-name/ of chunks (cut at its own
                          section banners or between top-level functions), pasted back in order
Nothing is rewritten: `node tools/build-game.js "<game>"` puts the very same bytes back, and this script refuses to
finish unless the rebuilt index.html is byte-for-byte the original. The <!--HG--> licence block is left to the build.
Usage: python3 tools/split-game.py "<game dir>"
"""
import os, re, sys, subprocess

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
GAME = sys.argv[1]
DIR = os.path.join(ROOT, GAME); SRC = os.path.join(DIR, 'src'); OUT = os.path.join(DIR, 'index.html')
orig = open(OUT, encoding='utf-8', newline='').read()
hg = re.search(r'\n<!--HG-->[\s\S]*?<!--/HG-->', orig)
html = orig[:hg.start()] + orig[hg.end():] if hg else orig
if os.path.exists(SRC): sys.exit(GAME + ' already has src/')

def slug(t, n=28):
    t = re.sub(r'[^a-z0-9]+', '-', t.lower()).strip('-')
    return (t[:n].rstrip('-')) or 'part'

BANNER = re.compile(r'^\s*(//\s*(=|-|#|\*){3,}|/\*\s*(=|-|\*){3,}|//\s*[A-Z][A-Z0-9 &/,:()\'-]{6,}$|// ---- |// ==== )')
TOP = re.compile(r'^(async\s+function|function|class|const|let|var)\b')

def label(lines):
    for l in lines[:40]:
        s = l.strip()
        if not s: continue
        m = re.match(r'^(?://+|/\*+|\*)\s*[=\-#*]*\s*([A-Za-z][A-Za-z0-9 &/,:()\'.-]{3,})', s)
        if m and not re.match(r'^[=\-#* ]+$', m.group(1)): return slug(m.group(1))
        m = re.match(r'^(?:async\s+)?(?:function\s*\*?\s*|class\s+|const\s+|let\s+|var\s+)([A-Za-z_$][\w$]*)', s)
        if m: return slug(m.group(1))
    return 'part'

def chunks(body):
    """cut a long script at its own section banners (or, failing that, between top-level declarations)"""
    lines = body.splitlines(keepends=True)
    if len(lines) < 450: return [body]
    ind = min((len(l) - len(l.lstrip(' \t')) for l in lines if l.strip()), default=0)
    def ok(i, banner):
        l = lines[i]
        if not l.strip() or len(l) - len(l.lstrip(' \t')) != ind: return False
        if banner: return bool(BANNER.match(l))
        return bool(TOP.match(l.strip()) or l.strip().startswith('//')) and not lines[i - 1].strip()
    out, start = [], 0
    while len(lines) - start > 600:
        cut = None
        for banner, lo, hi in ((True, 300, 700), (False, 350, 650)):
            for i in range(start + lo, min(len(lines), start + hi)):
                if ok(i, banner): cut = i; break
            if cut: break
        if not cut: cut = start + 500
        out.append(''.join(lines[start:cut])); start = cut
    out.append(''.join(lines[start:]))
    return out

os.makedirs(os.path.join(SRC, 'css')); os.makedirs(os.path.join(SRC, 'js'))
parts, pos, n_css, n_js, made = [], 0, 0, 0, []
for m in re.finditer(r'(<style\b[^>]*>)([\s\S]*?)(</style>)|(<script\b[^>]*>)([\s\S]*?)(</script>)', html, re.I):
    open_tag, body = (m.group(1), m.group(2)) if m.group(1) else (m.group(4), m.group(5))
    is_js = not m.group(1)
    if is_js and (re.search(r'\bsrc\s*=', open_tag, re.I) or re.search(r'type=["\']?(importmap|application/json|text/template|x-)', open_tag, re.I)): continue
    if len(body) < 300: continue
    start = m.start(2) if m.group(1) else m.start(5)
    parts.append(html[pos:start])
    if not is_js:
        n_css += 10; rel = 'css/%02d-%s.css' % (n_css, 'style' if n_css == 10 else 'style%d' % (n_css // 10))
        open(os.path.join(SRC, rel), 'w', encoding='utf-8', newline='').write(body); made.append(rel)
    else:
        n_js += 10; ch = chunks(body); name = label(body.splitlines())
        if len(ch) == 1:
            rel = 'js/%02d-%s.js' % (n_js, name)
            open(os.path.join(SRC, rel), 'w', encoding='utf-8', newline='').write(body); made.append(rel)
        else:
            rel = 'js/%02d-%s/' % (n_js, 'game' if n_js == 10 else name)
            os.makedirs(os.path.join(SRC, rel))
            for i, c in enumerate(ch):
                f = rel + '%03d-%s.js' % ((i + 1) * 10, label(c.splitlines()))
                open(os.path.join(SRC, f), 'w', encoding='utf-8', newline='').write(c); made.append(f)
    parts.append('<!--@inline ' + rel + '-->')
    pos = start + len(body)
parts.append(html[pos:])
open(os.path.join(SRC, 'shell.html'), 'w', encoding='utf-8', newline='').write(''.join(parts))
if not os.listdir(os.path.join(SRC, 'css')): os.rmdir(os.path.join(SRC, 'css'))

# the proof: rebuild and compare with the original, byte for byte
subprocess.run(['node', os.path.join(ROOT, 'tools', 'build-game.js'), GAME, '--check'], check=True, cwd=ROOT, stdout=subprocess.DEVNULL)
new = open(OUT, encoding='utf-8', newline='').read()
if new != orig:
    open(OUT, 'w', encoding='utf-8', newline='').write(orig)
    import shutil; shutil.rmtree(SRC)
    i = next((k for k in range(min(len(new), len(orig))) if new[k] != orig[k]), min(len(new), len(orig)))
    sys.exit('%s: rebuilt file differs at char %d: %r vs %r (src/ removed, index.html restored)' % (GAME, i, orig[i - 40:i + 40], new[i - 40:i + 40]))
print('%-26s %3d files, rebuilt index.html identical (%d KB)' % (GAME, len(made), len(orig) // 1024))
