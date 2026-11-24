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

## Polish round
- minigun: re-posed: eye (-0.32, -0.35, 0.22) Blender (weapons.json eye updated); barrels run from the lower right toward the centre; the left
  hand sits on the top handle at the right edge and its forearm (bone stretched 1.7x so the sleeve reaches out of frame) drops down out of
  view instead of crossing the middle. The arm rig has no upper arm, so a forearm coming in from the left edge would have shown its cut end.
- pistol, revolver, knife: vm_run carried flatter and higher (pitch -12 / -8 deg, drop 1.5 / 1 cm): hands stay in the lower third.
- revolver: left thumb aimed lower along the frame (reach miss 5.3 -> 2.5 cm).
- Not done: carbine trigger pad (still about 1 cm off) and LMG/SMG middle/ring curl.

## Round 2 weapons: DONE, exported (w_burst, w_lever, w_autoshot, w_gl, w_flamer, w_crossbow, w_machete); `dual` SKIPPED
| id | gun | tris | clips (s) | notes |
|---|---|---|---|---|
| burst | AK-pattern battle rifle, wood furniture, curved magazine, right-side charging handle | 2512 | fire 0.1 (one shot), reload 2.3 (seat 1.35) | brass right |
| lever | lever-action rifle, tube magazine, pistol-grip stock | 1426 | fire 0.733 (shot, lever down 0.25-0.38, up by 0.55; brass at 0.34), reload 2.8 (three rounds through the loading gate, seat 1.98, lever cycle) | lever on `bolt`, cartridge on `mag` |
| autoshot | drum-fed automatic shotgun, vertical foregrip | 2058 | fire 0.1, reload 2.4 (drum swap, seat 1.45, handle at 1.78) | |
| gl | six-shot revolving grenade launcher, reflex tube (inner radius 14 mm), foregrip | 2084 | fire 0.3 (heavy thump, cylinder advances 60 deg), reload 3.0 (cylinder swung out, fed in three passes, seat 2.45) | no brass |
| flamer | wand with nozzle, pilot light, valve wheel, hose down out of view, foregrip | 1450 | fire 0.2 LOOPING shake, reload 1.8 (valve turned, seat 1.25) | muzzle = nozzle tip; notional sight line over the wand |
| crossbow | compound crossbow, cams, string on `bolt`, bolt on `mag`, small scope (inner radius 12 mm) | 1520 | fire 1.3 (release, string pulled back 0.48-0.78, new bolt laid by 1.25), reload 1.0 (lay a bolt, seat 0.68) | the string moves as one piece (its ends leave the cams while it is forward) |
| machete | long blade, wood grip with rivets, right hand only | 1046 | fire 0.433 (wide forehand slash), fire2 0.467 (backhand slash) | like the knife: no reload / melee |
- dual (TWIN P9s): skipped. The rig has one gun bone held by both hands; two pistols need a second gun bone, a mirrored grip for the left hand and their own fire clips per hand, which is more than this round allowed.
- Sizes: the seven .hgm files are 0.5-0.74 MB each (gun pictures 512 or 1024; the arms picture is the shared one).

## Hold and reload round (checked in game pictures)
Tool: `node tools/tests/ashfall-vm.mjs <outdir> [ids] [--reload=0.12,0.32,...]` gives one sheet per weapon from the real game, with these cells:
hip, aimed, run, draw, fire and five reload moments. It runs headless and never locks the pointer. No seat time, clip name or weapon id changed.
- All: a hand off the gun now relaxes (OPEN curl 20/30/16, was nearly straight). Box-magazine reloads (`box_mag_reload`, the carbine's own)
  lift and roll the gun more, so the old magazine is seen leaving and the fresh one is seen coming up the last 12 cm and seating.
- knife, machete: new `blade_hold`: the handle lies along the grip axis, blade up out of the fist, edge forward (pitch -34 / -48).
  New eyes: knife (-0.17,-0.31,0.17), machete (-0.18,-0.33,0.18). The sleeve no longer fills the screen.
- revolver: the right thumb is lower (it filled the aimed view); `lofs` sets the left-hand offset. The reload uses a moon clip,
  six rounds on a new `pump` bone: the cylinder swings out, the ejector throws the clip, then a fresh clip is pushed in by hand (seat 1.75).
- pistol: two-handed cup kept. The reload no longer racks the slide overhand next to the eye: the slide locks back and the thumb
  drops the release. During the swap the gun is lifted out and up, so the magazine falling and the left hand pushing the new one home are seen.
- minigun: the left hand is on a new vertical foregrip under the barrels, not a top-handle fist in the middle of the view.
  The belt box moved back and down, and the box swap dips 28 cm instead of 50, so it stays near the bottom of the view. New eye (-0.24,-0.42,0.19), sight (-0.04,-0.12,0.26).
- gl, rpg: the reload swings the tube toward the loading hand (gl more, rpg only a little). The hand stays on the round.
- lever: the loading hand comes from under the right side to the gate, not through the receiver.
- lmg: the feed cover is now a real hinged part (`pump` bone, 50 deg), with a feed tray and a belt of 7 rounds with links. The reload
  (`lmg_reload`, seat unchanged) goes: cover up with the hand on it, box off and a fresh box on, the belt laid on the tray, the cover
  slammed shut, then the handle pulled. During the cover work the gun goes out and low; during the box change it is lifted and rolled
  so the box stays in view. The open cover still reads as a dark slab at the top right for about a second.
- shotgun, crossbow, sniper, smg, dmr, burst, autoshot, flamer, carbine: holds checked, fine. They changed only through the shared
  edits above.
- Still not done: the carbine trigger pad is about 1 cm off, and the SMG/LMG right middle and ring fingers curl a little loose.

## Hip positions round (numbers only)
Where a gun sits at the hip comes only from `eye` in `weapons.json` (game: hip = -0.9 * eye + [0,-0.008,0]; a larger eye y = gun lower, a larger eye z = gun further out and smaller, a more negative eye x = gun further right). `sight` (aimed) was not touched.
`weapons.json` is GENERATED by `tools/blender/make_weapons.py` (from `hg_info` stored in each weapon collection of the .blend, then written out at the end of the script), so the eyes were changed in BOTH places: the `'eye': Vector((x, -z, y))` of each weapon in the script (Blender axes: json [x, y, z] = Vector((x, -z, y))) and the json. A rebuild of a weapon keeps the new position. Never edit only the json.
New eyes (json order, old -> new):
- pistol (-0.08,0.148,0.28) -> (-0.10,0.168,0.28); revolver (-0.08,0.152,0.28) -> (-0.10,0.168,0.28)
- smg y 0.176 -> 0.186; dmr y 0.186 -> 0.216; sniper (-0.19,0.158,0.33) -> (-0.20,0.208,0.33); crossbow y 0.18 -> 0.195
- lmg (-0.20,0.19,0.34) -> (-0.22,0.255,0.34); minigun (-0.24,0.19,0.42) -> (-0.27,0.31,0.42)
- autoshot y 0.185 -> 0.23; gl (-0.19,0.205,0.30) -> (-0.21,0.262,0.30); flamer (-0.19,0.17,0.30) -> (-0.21,0.24,0.30)
- knife (-0.17,0.17,0.31) -> (-0.20,0.22,0.31); machete (-0.18,0.18,0.33) -> (-0.21,0.23,0.33)
- unchanged: carbine, burst, lever, shotgun, rpg.
