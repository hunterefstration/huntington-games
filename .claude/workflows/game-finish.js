export const meta = {
  name: 'game-finish',
  description: 'Lean per-game pipeline: build remaining content chunks, one play-test, one fix pass (Sonnet, medium effort)',
  whenToUse: 'Finishing a Huntington Games content update. args: {chains:[{slug,title,dir,port,version,claims?:[],chunks:[{name,brief}]}], model?, effort?}',
  phases: [{ title: 'Build' }, { title: 'Playtest' }, { title: 'Fix' }],
}
// Cost rules: every agent runs on a cheaper model at medium effort, reads files in slices, verifies with
// debug hooks instead of screenshots, and returns short reports. One play-test round; the fixer re-tests its own fixes.
const MODEL = args.model || 'sonnet', EFFORT = args.effort || 'medium'
const T = '/tmp/hg-tools'
function rules(c) {
  return `Huntington Games: single-file browser games for school Chromebooks. Repo /home/user/huntington-games.
GAME: ${c.title} | FILE: ${c.dir}/index.html (edit ONLY this file)

RULES
- Never change the <!--HG-->...<!--/HG--> licence block. No git writes (read-only git diff/show is fine). Never kill processes you did not start.
- Keep existing features and saves working; migrate old saves, never wipe progress. Extend the game's existing systems; match its style.
- Chromebook speed: no per-frame allocations in hot loops, cap entity counts, no full DOM rebuilds per frame. No new libraries, no networking.
- Machine is small and shared: at most ONE browser open at a time, close it in finally, keep runs short.

EFFICIENCY (strict - usage is limited)
- NEVER read the whole game file. Find code with Grep (-n, small -C) and Read only the line ranges you need (offset/limit, <=200 lines per read).
- Make targeted Edits; do not rewrite large sections.
- Verify through the game's debug hook (window.__${c.slug} or existing window.__* hooks; add small ones if missing) with page.evaluate assertions. Take at most 2 screenshots total, only for new UI layout, at 1280x720.
- Keep test scripts small; put them in ${T}/tests/${c.slug}/. Do not paste large logs into your context (tail/grep them).
- Final report: short items (<=20 words each). No essays.

TEST SETUP
- Server: (cd /home/user/huntington-games && setsid nohup python3 -m http.server PORT >/dev/null 2>&1 &). Open http://localhost:PORT/${encodeURIComponent(c.dir)}/index.html (localhost skips the licence gate).
- Playwright: NODE_PATH=/opt/node22/lib/node_modules; chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']}).
- No internet. Route: cdn.jsdelivr.net/npm/three@0.160.0/<p> -> ${T}/cdn/package/<p>; tailwind (cdn.tailwindcss.com or tailwindcss-cdn) -> ${T}/node_modules/tailwindcss-cdn/tailwindcss.js; fonts -> empty CSS; abort other external requests.
- Listen for pageerror and console errors. Use page.mouse for clicks.`
}
const S = (d) => ({ type: 'string', description: d })
const LIST = (d) => ({ type: 'array', maxItems: 25, items: { type: 'string', description: d } })
const IMPL = { type: 'object', properties: { added: LIST('one player-facing feature, <=20 words'), tested: LIST('<=15 words'), notDone: LIST('<=20 words') }, required: ['added', 'tested', 'notDone'] }
const PLAY = { type: 'object', properties: {
  broken: LIST('claimed feature that does not work, <=20 words'),
  issues: { type: 'array', maxItems: 15, items: { type: 'object', properties: { title: S('<=15 words'), severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, repro: S('<=40 words') }, required: ['title', 'severity'] } },
  checked: { type: 'integer', description: 'number of claimed features verified working' },
  gateIntact: { type: 'boolean' } }, required: ['broken', 'issues', 'checked', 'gateIntact'] }
const opt = (label, phase, schema) => ({ label, phase, schema, model: MODEL, effort: EFFORT })

const out = await pipeline(args.chains,
  async (c) => {
    const added = (c.claims || []).slice()
    for (let i = 0; i < c.chunks.length; i++) {
      const ch = c.chunks[i], last = i === c.chunks.length - 1
      const r = await agent(`${rules(c)}\nYour server port: ${c.port}.\n\nCHUNK ${i + 1}/${c.chunks.length}: ${ch.name}\n${ch.brief}\n\nAlready in the file (do not redo): ${added.join('; ') || 'none'}.\nIf git diff shows partial work for this chunk, finish it instead of restarting.${last ? `\nLast chunk: set the visible version to ${c.version} and list all highlights in any What's New area.` : ''}\nImplement fully, verify via the debug hook, report briefly.`, opt(`${c.slug}:${ch.name}`, 'Build', IMPL))
      if (r) added.push(...r.added)
    }
    return added
  },
  async (claimed, c) => {
    const play = await agent(`${rules(c)}\nYour server port: ${c.port + 100}. You are an independent PLAY-TESTER: do NOT edit the game file.\n\nVersion ${c.version} claims:\n- ${claimed.join('\n- ')}\n\nCheck each claim mostly through debug-hook assertions (reach new menus via real clicks for a sample of them). Then a short regression pass: start a normal game, run some simulated time, save + reload, watch for errors. Confirm the HG block equals \`git show HEAD:'${c.dir}/index.html'\`. Report only what is broken.`, opt(`${c.slug}:playtest`, 'Playtest', PLAY))
    if (!play) return { slug: c.slug, version: c.version, claimed: claimed.length, remaining: ['playtest did not run'] }
    const issues = play.issues.concat(play.broken.map(t => ({ title: 'Broken: ' + t, severity: 'major' })))
    if (!play.gateIntact) issues.unshift({ title: 'Licence block modified - restore it exactly from git HEAD', severity: 'blocker' })
    let fix = null
    if (issues.length) fix = await agent(`${rules(c)}\nYour server port: ${c.port}.\n\nFix these play-test findings in the ${c.version} update at the root cause (all blockers and majors, minors if cheap). Re-test each fix via the debug hook. Report briefly.\n${JSON.stringify(issues)}`, opt(`${c.slug}:fix`, 'Fix', IMPL))
    return { slug: c.slug, version: c.version, claimed: claimed.length, checked: play.checked, issues: issues.map(x => x.severity + ': ' + x.title), fixed: fix ? fix.added : [], notFixed: fix ? fix.notDone : [] }
  }
)
return out
