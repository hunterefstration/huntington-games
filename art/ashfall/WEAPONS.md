# ASHFALL weapons: build log

Source: `tools/blender/make_weapons.py` builds `art/ashfall/weapons.blend` (not in git; the script is the source).
Rebuild one weapon: `blender -b art/ashfall/weapons.blend -P tools/blender/make_weapons.py -- only=pistol [preview=hold,reload,clips]`
Export: `node tools/export-art.mjs w_<id>` writes `Ashfall/assets/w_<id>.hgm` + `w_<id>_*.webp`. `Ashfall/assets/weapons.json` is rewritten by every script run.
Previews go to `art/ashfall/_cache/<id>_*.png`.

## carbine: DONE, exported
Proof Slice carbine and arms unchanged (copied from art/proof/shooter.blend). vm_fire now keeps the index on the trigger in every frame.
Clips: idle 2.8, fire 0.1, reload 2.2 (seat 1.45), draw 0.5, run 0.7, melee 0.467 (jab). Gun 3980 tris.
Weak: trigger finger pad about 1 cm off the trigger centre.

## pistol: DONE, exported
9 mm polymer pistol, slide on `bolt`, magazine in the grip on `mag`, two-handed grip (left hand wraps the right fist).
Clips: idle 2.8, fire 0.1 (slide 30 mm back), reload 1.6 (mag drops free, new mag from below, seat 0.98, left hand racks the slide), draw 0.5, run 0.7, melee 0.467.
Weak: right thumb is not quite forward along the frame.

## shotgun: DONE, exported
12-gauge pump, wood pump (`pump`) and stock, AR-style pistol grip, bolt face in the ejection port (`bolt`), shell on `mag`.
Clips: idle 2.8, fire 0.733 (shot, pump back 0.22-0.37, casing out at 0.36, pump forward by 0.57), reload 2.8 (gun rolled to show the loading port, three shells pushed in at 0.72/1.32/1.92, seat 1.98, then a pump stroke), draw 0.5, run 0.7, melee 0.467 (butt stroke).
Weak: left little finger tucks into a fist (does not reach the pump); the shell is held in a fixed pinch.

## smg: DONE, exported
Compact 9 mm, skeleton stock, vertical foregrip (left hand), long straight magazine, hollow red-dot tube (inner radius 10.5 mm), left-side cocking lever on `bolt` (HK style).
Clips: idle 2.8, fire 0.1, reload 2.0 (seat 1.20, lever pulled at 1.45 and let go), draw 0.5, run 0.7, melee 0.467.
Weak: blocky receiver; right middle/ring fingers curl less (touch the magazine well).

## sniper: DONE, exported
Bolt action, tan stock, hollow scope (inner radius 17 mm, 26 cm long, centre z 0.14), box magazine on `mag`, bolt + handle on `bolt` (lifts 62 deg, back 85 mm).
Clips: idle 2.8, fire 1.267 (shot, right hand leaves the grip at 0.25, works the bolt, casing out at 0.66, back on the grip by 1.12), reload 2.6 (mag change, seat 1.30, then the bolt cycle from 1.55), draw 0.5, run 0.7, melee 0.467 (butt).
Weak: the bolt handle sits near the right screen edge in the hip view, so the cycle is only partly on screen.

## lmg: DONE, exported
Belt-fed, olive ammo box on `mag` hanging under the left side, folded bipod, carry handle offset left (keeps the sight line clear), raised iron sights (line at z 0.172), cocking handle on the left on `bolt`.
Clips: idle 2.8, fire 0.1, reload 4.2 (box swap, seat 2.70, handle pulled at 3.15), draw 0.8, run 0.7, melee 0.467 (butt).
Weak: no feed-cover opening in the reload; right middle/ring curl less than on the carbine.

## revolver, dmr, rpg, minigun, knife: BUILT in weapons.blend, NOT exported yet (paused for figures and the street map)
To do when resuming: minigun needs the barrel spin inside vm_fire (60 deg per loop, spinBone null) and more triangles (1452 now);
knife needs more triangles (852) and its thumb checked; revolver left thumb; then export each and rerun the script so weapons.json lists them.
