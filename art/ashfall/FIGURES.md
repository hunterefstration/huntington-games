# ASHFALL figures: build log

Source: `tools/blender/make_figures.py` (shared helpers in `tools/blender/hgkit.py`) builds `art/ashfall/figures.blend` (not in git).
Rebuild: `blender -b art/ashfall/figures.blend -P tools/blender/make_figures.py -- only=walker [preview=pose,move,act]`
Export: `node tools/export-art.mjs foe_walker soldier foe_brute foe_runner foe_spitter foe_cinder foe_furnace`.
Previews: `art/ashfall/_cache/<id>_pose|move|act.png`.

All figures: stand at the origin, face Blender -Y, modelled at their listed height (size 1). 16 bones (hips, spine, chest, neck, head,
upper arm / forearm / hand, thigh / shin / foot each side; the soldier adds `gun`). Three detail levels share one 1024 picture
(LOD0 in the top three quarters, LOD1 and LOD2 side by side below). Clip frames at 30 fps. `attack` is 0.8 s with the blow (or the
spit leaving) at 45 % = 0.36 s. Walk speeds below are the speed at which the planted foot does not slide (at size 1; scale with size).

| file | figure | height | triangles (LOD0/1/2) | walk cycle | speed (m/s) | attack | die |
|---|---|---|---|---|---|---|---|
| foe_walker.hgm | Ashen: hooded coat (folds, belt, torn hem), ash-grey hands and face | 1.8 | 4200 / 1238 / 412 | 1.0 s shamble | 1.00 | two-arm swipe | 1.2 s, falls forward |
| foe_runner.hgm | thin, rags, long arms, leans far forward | 1.7 | 4199 / 1251 / 417 | 0.5 s sprint | 4.21 | leaping claw | 1.2 s |
| foe_brute.hgm | huge, thick neck, big right arm, crusted ash slabs | 2.5 | 4799 / 1239 / 413 | 1.3 s heavy | 0.99 | overhead smash | 1.3 s |
| foe_spitter.hgm | hunched, glowing green-yellow throat sack, thin limbs | 1.75 | 4200 / 1251 / 417 | 1.1 s | 0.76 | rears back, spits forward | 1.2 s |
| foe_cinder.hgm | cracked black skin, glowing orange fissures, runs arms out | 1.7 | 4200 / 1246 / 414 | 0.6 s run | 3.37 | lunge | 1.2 s |
| foe_furnace.hgm | boss: furnace belly (grate + fire), chains, metal slab on the left arm | 3.9 | 5000 / 1250 / 416 | 1.4 s stomp | 1.31 | two-fist ground slam | 2.2 s, to its knees then forward |
| soldier.hgm | survivor: light olive-grey jacket and pack (tintable), helmet, gloves, carbine | 1.8 | 4649 / 1505 / 668 | run 0.7 s | 3.04 | fire 0.2 s loop (shouldered) | 1.2 s |

Skin names: `enemy` (foes, clips idle / walk / attack / die), `soldier` (clips idle / run / fire / die). Pieces export as
`enemy`, `enemy_lod1`, `enemy_lod2` (soldier: `soldier`, `soldier_lod1`, `soldier_lod2`).

Weak: faces are simple (eye sockets and a mouth line painted on); hands are mitts with a thumb; the coat skirt stretches between the
legs on long strides; walk cycles are computed (planted-foot IK, 2-bone weights), not motion capture; the soldier's carbine is a
low-detail third-person model held by arm IK, so hands sit near but not exactly on it.
