# Apply in the release worktree before build-release.py: rename the hub page to "Huntington Games Launcher".
import sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
reps = [
  ("<h1>HUNTINGTON GAMES</h1>", "<h1>HUNTINGTON GAMES LAUNCHER</h1>", 1),
  ("hubText.replace('<title>Huntington Games</title>', '<title>Huntington Games Offline</title>')",
   "hubText.replace('<title>Huntington Games Launcher</title>', '<title>Huntington Games Launcher Offline</title>')", 1),
  ("<title>Huntington Games</title>\n", "<title>Huntington Games Launcher</title>\n", 1),
]
for a, b, n in reps:
    if b in s: continue
    c = s.count(a)
    if c != n: sys.exit('expected %d of %r, found %d' % (n, a, c))
    s = s.replace(a, b)
open(p, 'w', encoding='utf-8').write(s)
print('rebranded', p)
