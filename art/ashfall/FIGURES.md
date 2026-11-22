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

Update: every `die` (soldier included) now ends with the lowest point of the body on the ground (z = 0).

Weak: faces are simple (eye sockets and a mouth line painted on); hands are mitts with a thumb; the coat skirt stretches between the
legs on long strides; walk cycles are computed (planted-foot IK, 2-bone weights), not motion capture; the soldier's carbine is a
low-detail third-person model held by arm IK, so hands sit near but not exactly on it.

## Nine new kinds (same script, rig, skin "enemy", clips idle / walk / attack / die)
`blender -b art/ashfall/figures.blend -P tools/blender/make_figures.py -- only=charger,leaper,... [preview=pose,move,act]`, then
`node tools/export-art.mjs foe_<id> ...`. Modelled at size x 1.8 m (H below). New in the script: per-figure SDF bounds (`box`), props that
move rigidly with one bone (`rigid`: shield with the chest, hammer with the right hand, spines with the chest, sac with the spine, rebar with
the right forearm), a held pose over walk/idle (`hold`), an all-fours trot with hands and feet planted by IK (`quad`), bone scale in the
clips (husk's burst; the exporter already writes full bone matrices).

| id | H (m) | look / silhouette | walk (speed for no foot slide) | attack | die | tris (lod0/1/2) | size (hgm + picture) |
|---|---|---|---|---|---|---|---|
| charger | 2.20 | huge hump and shoulders, one massive right arm with a plate, strapped rebar ram past the fist, plate cap; head thrust down and forward | heavy forward lean, 1.33 m/s | ram (0.8 s): charges 0.5 H forward behind the plated arm | fall forward | 4800/1282/930 | 422 + 37 KB |
| leaper | 1.66 | thin, very long bare arms with claws, vertebrae ridge, loin rag | low trot on all fours, 2.91 m/s | pounce (0.8 s): crouch, leap 0.55 H forward, land | rolls onto its side | 3800/1274/424 | 290 + 31 KB |
| bulwark | 1.98 | car door (red, window hole, handle) held in front, riot helmet with dark visor, padded jacket | shield forward (left arm braced behind it), 1.19 m/s | bash (0.8 s): shield shove | fall forward | 4600/1234/410 | 293 + 19 KB |
| howler | 1.84 | gaunt, ribs raised, jaw hanging open (dark maw), head thrown back, arms spread | head back, arms out, 1.22 m/s | howl (1.4 s): head right back, arms flung out wide | fall forward | 4199/1261/420 | 328 + 44 KB |
| husk | 2.05 | swollen torso with red tears, pale growth clusters on shoulder, belly, back, hip | lumbering, 0.70 m/s | swipe | burst: swells to 1.7x and shudders (0-0.5 s), torso blows apart (scale 0.1), legs fold | 4600/1246/414 | 349 + 57 KB |
| mite | 0.99 | small, pale, big head, all fours | fast trot, 3.12 m/s | pounce | rolls onto its side | 3000/1251/417 | 257 + 43 KB |
| bloater | 2.16 | enormous belly with seven glowing green patches (bright colour in the picture, as the spitter's), wide legs | waddle (big side roll), 0.44 m/s | smash | fall forward | 4600/1236/412 | 314 + 46 KB |
| foreman (boss) | 3.42 | torn hi-vis jacket hanging open with reflective stripes, hard hat, sledgehammer in the right hand, chains across the chest and round the left forearm | heavy, 1.36 m/s | hammer (1.2 s): overhead one-handed smash | down on its knees, then forward | 5200/1270/974 | 492 + 169 KB |
| widow (boss) | 3.42 | tall and thin, torn nurse's dress and cap, eight long curved spines from the back, swollen sac behind | stalking, 1.39 m/s | claw (spines swing with the chest) | knees, then forward | 5200/1616/1616 | 576 + 175 KB |
Faces: every enemy (the six older ones too, not the soldier) now has a brow ridge, a nose and eye sockets cut into the head, shadowed in the picture; all fifteen re-exported. Widow's lod1 and lod2 came out the same (the decimator would not go lower on the spines).
