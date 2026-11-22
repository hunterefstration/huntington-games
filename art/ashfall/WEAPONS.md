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

## revolver: DONE, exported
Big-frame .44, stainless, swing-out cylinder on `mag` (swings 80 deg out to the left on the crane), hammer on `bolt`, one-handed grip with the left hand supporting.
Clips: idle 2.8, fire 0.3 (double action: hammer back and falls at 0.067, big muzzle rise), reload 2.6 (cylinder out 0.18-0.32, muzzle up + ejector slap, hand down for rounds, seat 1.75, cylinder closed by 2.02), draw 0.5, run 0.7, melee 0.467. No ejection on fire (eject null).
Weak: no cartridges or speedloader modelled; the left thumb points up beside the frame; hands come close to the camera during the reload.

## dmr: DONE, exported
AR-10 style 7.62 marksman rifle, octagonal free-float handguard, 10-round magazine, hollow scope (inner radius 14 mm, 16 cm long, centre z 0.168), AR charging handle on `bolt`.
Clips: idle 2.8, fire 0.1 (semi, bigger rise), reload 2.3 (seat 1.40, charging handle pulled at 1.72), draw 0.5, run 0.7, melee 0.467 (butt).

## rpg: DONE, exported
RPG-7 style tube (olive) with wood heat shields, pistol grip + front vertical grip, side optic body (decor) and top iron sights (line z 0.1215), warhead on `mag`. 37 bones (no bolt).
Clips: idle 2.8, fire 0.5 (kick and back-blast jolt; the warhead flies off forward and is back in the tube on the last frame, so play vm_reload next), reload 2.4 (hand down for a warhead, pushes it into the muzzle, seat 1.70), draw 0.8, run 0.7, melee 0.467.

## minigun: DONE, exported
Hand-carried six-barrel rotary gun, rear chainsaw grip (right), top handle across the gun (left, palm down), belt box on the left side on `mag`, barrel cluster on `spin`.
vm_fire (0.1 s, 4 frames) turns the barrels exactly 60 deg over the clip, so looping it is seamless; spinBone is null (the spin is baked in the clip).
Clips: idle 2.8, fire 0.1, reload 4.5 (box swap, seat 3.0), draw 0.8, run 0.7, melee 0.467. No real sights: weapons.json sight / sightFront are a notional line left of the top handle (z 0.20), clear of the gun.
Weak: from the hip eye the left forearm crosses the lower view on its way to the top handle.

## knife: DONE, exported
Combat knife (clip-point blade with spine serrations, guard, ridged rubber handle, pommel), right hand only; the left arm is parked out of view. Bones: arms + `gun` (35).
Clips: idle 2.8, draw 0.5, run 0.7, fire 0.333 (slash right to left, contact about 0.12-0.19), fire2 0.4 (stab, full reach at 0.19). No reload or melee. sight / muzzle / eject are null.
