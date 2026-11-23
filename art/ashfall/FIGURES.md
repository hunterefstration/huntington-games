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

## Twelve more (wave 2): same script, rig, skin "enemy", clips idle / walk / attack / die (+ extras)
`blender -b art/ashfall/figures.blend -P tools/blender/make_figures.py -- only=stalker,shocker,... [preview=pose,move,act]`, then
`node tools/export-art.mjs foe_stalker foe_shocker foe_mender foe_gunner foe_lobber foe_burrower foe_lasher foe_risen foe_chiller foe_warden foe_hollow foe_pylon`.
Modelled at size x 1.8 m (the pylon at 2.6 m = 1.44 x 1.8). New in the script (section "wave 2"): `w2` figures take their clips from `wave2_clips`;
extra bones beside the 16 (`bones`: name -> (parent or 'world', rest matrix)): a held prop on bone `gun` that both hands hold by arm IK
(mender's sac, gunner's rifle, warden's staff; it drops in `die`), and the lasher's `tongue` (child of the head; scaled along its axis in the
attack, the exporter writes full bone matrices); `rigid_all` (the pylon: everything on `hips`, coil and lamp on `head`); `rise` = the grounded
`die` played back. Speeds are for no foot slide at size 1 (scale with size). Attack times: the moment the blow / shot / release happens.

| id | H (m) | look / silhouette | walk: cycle, speed | attack (length, moment) | extra clips | die | tris (lod0/1/2) | hgm + picture |
|---|---|---|---|---|---|---|---|---|
| stalker | 1.76 | thin, very long limbs and fingers, long swept-back skull, smooth and featureless (no face, no clothes) | low fast prowl (crouched, leaning 40 deg), 0.57 s, 3.75 m/s | claw 0.8 s, 0.36 s | | 1.1 s | 3800/1284/428 | 301 KB |
| shocker | 1.89 | cable wound round body and upper arms, car battery with brass terminals on its back, rods for forearms with glowing blue tips | 0.93 s, 1.12 m/s | both rods thrust forward 0.8 s, bolt leaves at 0.34 s | | 1.2 s | 4400/1263/981 | 417 KB |
| mender | 1.80 | hunched, hooded floor-length robe, glowing amber sac in a strap cage held out in both hands, tubes hanging from it and trailing behind | shuffle 1.13 s, 0.68 m/s | sac raised overhead 1.2 s: up by 0.35 s, held to 0.95 s (the heal), down by 1.2 s | | 1.3 s | 4399/2096/2096 | 611 KB |
| gunner | 1.84 | soldier's remains: helmet, rotten uniform, webbing and pouches, long rifle at the hip | 0.9 s, 1.25 m/s | aim 1.2 s: rifle to the shoulder by 0.3 s, held dead still, kick (fires) at 1.12 s | | 1.2 s, rifle drops | 4600/1267/696 | 408 KB |
| lobber | 2.07 | one enormous veined right arm, sack of glowing orange lumps on the left hip | lopsided 1.0 s, 1.14 m/s | overarm throw 0.9 s, wound back at 0.36 s, release 0.55 s | | 1.3 s | 4600/1234/410 | 306 KB |
| burrower | 1.62 | low on all fours, pangolin back of overlapping plates and a plated tail, mole snout, three big claws a hand | trot on all fours 0.5 s, 1.84 m/s | erupt 0.7 s: from 1 m under ground, claws flung wide at 0.28 s, down on all fours by 0.7 s | dig 0.6 s (sinks out of sight) | 1.1 s | 4200/1961/1961 | 510 KB |
| lasher | 1.80 | bloated red throat, a tendril from the mouth coiled round the right forearm, tongue lolling | 0.93 s, 1.16 m/s | lash 0.8 s: tongue straight out level, 8 m at 0.3 s, held to 0.36 s, back by 0.55 s | | 1.2 s | 4400/1260/512 | 367 KB |
| risen | 1.80 | burnt black, ribs and skull showing, embers in the cracks, rags of a black body bag (skirt and a shoulder flap, zip) | 1.07 s, 0.92 m/s | swipe 0.8 s, 0.36 s | rise 1.4 s (up from where die ends) | 1.3 s, knees then face down | 4400/1898/1898 | 596 KB |
| chiller | 1.94 | frosted blue-grey, ice shards bristling from the shoulders, back and forearms, rimed coat, white round the mouth | slow stiff 1.47 s, 0.57 m/s | overhead smash 0.8 s, 0.36 s | | 1.4 s | 4600/1266/876 | 434 KB |
| warden (boss, 1024) | 3.42 | huge prison guard: black riot armour fused on (chest plate with number, pauldrons, forearm and shin guards), cage helmet of bars, staff with a hazard-banded head | 1.47 s, 1.31 m/s | staff slam 1.1 s: overhead in both hands by 0.45 s, head hits the ground 3 m ahead at 0.6 s | | 2.0 s, knees then forward | 5200/1258/812 | 457 KB |
| hollow (boss, 1024) | 3.33 | THE HOLLOW KING: tall, emaciated, long arms, crown of rusted rebar spikes, robe of black body bags to the floor (zips, seams), a hole right through the chest (bone rim) | 1.53 s, 1.29 m/s | two-handed sweep 1.0 s, right to left, hit at 0.55 s | cast 1.2 s (arms up, head back, held 0.3-0.8 s) | 2.0 s, knees then forward | 5199/1622/1622 | 628 KB |
| pylon | 2.60 | generator pylon: steel post on a tripod with a ring brace, copper coil and insulators, caged lamp on top, hazard-striped generator box and cables at its foot | none (walk = idle) | none (attack = idle) | idle / walk / attack: 2.0 s loop, coil and lamp throb | 0.8 s, topples forward, lamp shivers | 3000/1255/417 | 214 KB |
Weak: mender, burrower, risen and hollow lod1 = lod2 (the decimator would not go lower, as with the widow); the robe-wearers' skirts stretch
between the legs on long strides; the burrower's erupt switches from free arms to planted hands at 0.62 s (a small pop); the lasher's
tendril is not the tongue (the tongue is a separate tube shot from the mouth); the chiller's breath fog is only painted (white round the mouth):
the game should puff it.
