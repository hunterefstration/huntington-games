# Steel Storm Remastered: art notes

## IRON VALLEY + three tanks: DONE, exported (`Steel Storm Remastered/assets/valley.hgm`)
Source: `tools/blender/make_valley.py` builds `art/steelstorm/valley.blend` (not in git; the script is the source) and bakes three light pictures.
Rebuild + bake (about 2 min): `blender -b art/steelstorm/valley.blend -P tools/blender/make_valley.py -- [samples=32] [preview] [nobake]`,
then `node tools/export-art.mjs valley`. Check: `node tools/blender/check_heights.mjs "Steel Storm Remastered/assets/valley.hgm"`.

Same conventions as `art/proof/range.blend`: world collection `terrain` holds `terrain` (the ground), `backdrop` (far hills, outside `area`)
and `props`; the ground's light picture is colour x light (baked from a vertex-colour macro material) with the grey `ground_detail` picture
on top (gain 2); `props` and `backdrop` name their own light pictures (`hg_lightmap`). Heights at 1 m from `terrain`; probes follow the ground.

- Ground: 420 x 420 m (x, y -210..210), heights -2.0..15.1 m. A shallow valley runs SW to NE with a meandering dry river bed (sand),
  low ridges either side (about 8 m), a dirt road along the valley at +38 m from its axis, six hull-down berms (1.35 m). Slopes: 0.02 % of
  the ground is over 22 deg (steepest 23.7 deg on one berm flank). Terrain 45,000 triangles (150 x 150 quads at 2.8 m).
- Village of 11 broken stone houses on a 3 x 4 grid near (25, -30) (streets 11-15 m), field walls (1.15-1.4 m) with 22-25 m gaps,
  two woods (26 and 24 trees) on the ridges plus 14 single trees, 36 boulders (1 m and up), a wrecked convoy of 5 trucks on the road,
  low rubble (under 0.3 m: drivable). Nothing within 30 m of the edge except terrain. Props 10,576 triangles, backdrop 9,600.
- Light: sun 30 deg up from the south-west, warm (1.0, 0.86, 0.68), strength 4.6; cool blue sky. Exporter ambient 0.30 / 0.29 / 0.26.
  Pictures: ground_detail, stone, rock, bark, foliage, rust, wood, metal, brick (1024) + three light pictures + sky.
- Checked from the exported file: 98.9 % of 1 m cells drivable (tops - ground <= 0.8 m and slope <= 22 deg), 1.1 % blocked by things,
  0.02 % too steep; a flood fill from the middle reaches 173,656 of 173,659 drivable cells (3 isolated single cells).

### Tanks (forward -Y, metres; hull origin on the ground under the centre)
| tank | parts | triangles (part / lod1) | muzzle (hull space, barrel level) | half width | half length | height | turret pivot | trunnion |
|---|---|---|---|---|---|---|---|---|
| medium (the range's tank, reused) | tank_hull / tank_turret / tank_barrel | 7016+1008+344 / 2250+900+260 | (0, -7.20, 2.02) | 1.86 | 4.09 | ~3.1 | (0, -0.2, 1.58) | (0, -1.65, 2.02) |
| light scout | light_hull / light_turret / light_barrel | 3824+488+332 / 764+96+66 | (0, -4.08, 1.62) | 1.48 | 2.59 | 2.16 | (0, 0.55, 1.25) | (0, -0.42, 1.62) |
| heavy | heavy_hull / heavy_turret / heavy_barrel | 5828+680+584 / 1164+136+116 | (0, -6.59, 2.42) | 1.87 | 3.79 | 3.06 | (0, 0.30, 1.95) | (0, -1.75, 2.42) |

Light and heavy: one 1024 picture each (`light_tank`, `heavy_tank`), neutral light grey-green (0.58, 0.60, 0.54) with panel lines,
rivet rows, wear on the bevels, dirt towards the tracks, streaks and ray-cast AO; tracks and vision slits dark. The medium keeps its picture.
LOD1 twins are 20 % decimations sharing the picture.

Weak: the medium tank's picture was not improved; the light's width over the wheels is 2.96 m (target 2.7) and the heavy's 3.74 m (target 3.6);
houses are stone boxes with beams and a tilted roof slab (no tiled roofs); trees are blobs (no foliage cards); the terrain and props
light pictures are about 5 and 6-8 texels per metre.

## Polish round (re-exported, same file names; valley.hgm 5.0 -> 6.2 MB)
- Sky: a Nishita sky (blue overhead, warm haze toward the sun; sun disc off, its sun placed where the lamp's light comes from, strength 0.1).
  All three light pictures and the probes re-baked under it. Exporter: sky range 2.96, horizon 0.55 / 0.50 / 0.37, ambient 0.31 / 0.34 / 0.42
  (cool), sun 1.84 / 1.58 / 1.25. The backdrop's faces now face up (it baked nearly black before).
- Village: houses rebuilt with a doorway and lintel, two windows with sills and lintels per long wall and one in each gable wall,
  gable ends (one whole, one broken), ridge beam and rafters (some missing), a patch of roof tiles on one slope, low rubble round the
  walls. Trees: a trunk with two forks and layered, flattened foliage clumps (geometry; no alpha cards). Props 26,372 triangles.
- Medium tank: picture repainted like the light and heavy (neutral grey-green, panel lines, edge wear from convexity, dirt, ray-cast AO),
  keeping the old picture's light/dark detail as a multiplier.
- Check: 98.6 % drivable, 0.02 % too steep; flood fill reaches 172,938 of 173,044 drivable cells. The ~100 cut-off cells are house interiors
  behind 1 m doorways (the lintel blocks; tanks cannot enter houses anyway) and one pocket among trees at (-117, -70).

## Six more vehicles: DONE, exported, one small file each (`Steel Storm Remastered/assets/v_<id>.hgm`)
Source: `tools/blender/make_vehicles.py` builds `art/steelstorm/vehicles.blend` (texturing and track helpers copied from make_valley.py).
Rebuild: `blender -b art/steelstorm/vehicles.blend -P tools/blender/make_vehicles.py -- [only=td] [preview]`; export `node tools/export-art.mjs v_td ...`.
A config with only "parts" exports just those objects (no world), so each vehicle is its own file. Parts: `<id>_hull`, `<id>_turret`,
`<id>_barrel` (+ `_lod1` twins, parented like the tanks); forward -Y; positions in hull space, metres.

| file | vehicle | parts | muzzle | half width / half length / height | turret pivot / trunnion | triangles (with lod1) | size (hgm + picture) |
|---|---|---|---|---|---|---|---|
| v_td.hgm | tank destroyer: low casemate, long gun in the hull front | td_hull, td_turret (the gun mantlet: swing it a few degrees), td_barrel | (0, -6.95, 1.45) | 1.77 / 3.44 / 2.08 | (0, -2.3, 1.45) / (0, -2.6, 1.45) | 6,732 | 324 + 101 KB |
| v_spaa.hgm | anti-aircraft tank: open turret, quad autocannon | spaa_hull, spaa_turret, spaa_barrel | (0, -2.70, 1.95) (four barrels at x +-0.3, z +-0.12) | 1.63 / 2.99 / 2.25 | (0, 0.2, 1.38) / (0, -0.2, 1.95) | 6,450 | 309 + 94 KB |
| v_arty.hgm | self-propelled howitzer: open-topped fighting compartment | arty_hull, arty_turret (the open superstructure), arty_barrel | (0, -3.73, 2.05) | 1.80 / 3.59 / 2.60 | (0, 1.1, 1.42) / (0, 0.6, 2.05) | 6,510 | 322 + 98 KB |
| v_apc.hgm | 8-wheeled armoured car, small autocannon turret | apc_hull, apc_turret, apc_barrel | (0, -3.40, 2.15) | 1.57 / 3.64 / 2.56 (wheel base 5.0 m, track 2.7 m) | (0, -0.6, 1.9) / (0, -1.2, 2.15) | 2,936 | 139 + 78 KB |
| v_truck.hgm | supply truck, canvas-covered cargo bed (soft target) | truck_hull only | none | 1.28 / 3.65 / 2.78 (6 wheels, base 4.6 m) | none | 3,042 | 142 + 32 KB |
| v_atgun.hgm | towed anti-tank gun with shield (static) | atgun_hull (carriage, split trail, wheels), atgun_turret (gun cradle + shield), atgun_barrel | (0, -3.48, 1.10) | 1.40 / 3.65 (trail spread to y +3.5) / 1.84 | (0, 0, 0.75) / (0, -0.2, 1.1) | 1,940 | 96 + 23 KB |
Weak: wheels of the APC/truck/AT gun are plain discs with a hub; the SPAA's open turret is box walls; the truck's cover is a flat roof on hoops.

## RED DUNES (dunes.hgm), tools/blender/make_dunes.py

`blender -b art/steelstorm/dunes.blend -P tools/blender/make_dunes.py` (first time `--factory-startup`), then `node tools/export-art.mjs dunes`.
Built from make_valley.py (same height-map export, tank set, light bake): ~420 m red desert. Dune ridges run 20 deg off the x axis;
a dry river bed snakes from south-west to north-east (pale sand, ~1.8 m deep, gentle banks); the oil depot (four tanks, pipe runs,
pump house, fence with four gaps) sits on a flattened pad at (-125, -125); the ruined fort (40 m square, one 10 m breach per side,
corner towers, inner cross walls, rubble) stands on a 6.5 m rise at (60, 70); rock outcrops at seven points; two wrecked trucks.
The three tanks are included as in valley.hgm (drop them if the game loads them from valley.hgm only: saves ~1 MB).
- 86,388 triangles, 13 pictures, dunes.hgm 4.69 MB, 6.5 MB on disk with the pictures.
- check_heights: drivable 99.5%, blocked by things 0.5%, too steep 0%, steepest 21.5 deg; flood fill from the middle 174,658 of 174,659.
- Light: ambient 0.31 / 0.34 / 0.42, sky range 2.96, horizon 0.55 / 0.50 / 0.37.

## The air line (a_ftr / a_atk / a_bmb / a_heli), tools/blender/make_aircraft.py

`blender -b art/steelstorm/aircraft.blend -P tools/blender/make_aircraft.py -- [only=ftr] [preview]`, then `node tools/export-art.mjs a_ftr a_atk a_bmb a_heli`.
Same texturing and part split as the ground vehicles (grey paint, lighter belly, panel lines). Forward -Y, z up, origin at the centre of mass
(solid volume of the whole aircraft), wheels up. Positions below are in the aircraft's own space, metres.

| file | aircraft | parts | span x length x height | gun muzzle | bombs / rockets start | tris (lod0 + lod1) | size (hgm + picture) |
|---|---|---|---|---|---|---|---|
| a_ftr.hgm | single-engine jet fighter, swept wings, side intakes | ftr_hull | 9.56 x 15.30 x 5.03 | (0.55, -6.18, -0.34) right side of the nose | missiles (+-3.0, -1.93, -0.63); bomb drop (0, -0.18, -1.79) | 1,682 + 336 | 70 + 96 KB |
| a_atk.hgm | ground attack: straight wings, twin tail, rear engine pods, 5-barrel nose gun, 4 rocket pods | atk_hull | 17.88 x 17.05 x 4.27 | (0, -9.14, -0.50) | rockets (+-4.0 and +-6.0, -1.99, -1.13); bomb drop (0, -0.14, -1.55) | 2,768 + 552 | 130 + 125 KB |
| a_bmb.hgm | twin-jet bomber, glazed nose, tail turret | bmb_hull | 21.02 x 19.60 x 5.62 | nose guns (0, -8.81, -0.71) forward; tail guns (0, 10.79, 0.04) pointing +Y | bomb bay (0, 1.09, -1.56) | 1,822 + 364 | 83 + 107 KB |
| a_heli.hgm | attack helicopter, tandem cockpit, stub wings | heli_hull, heli_turret = main rotor (pivot (0, 0.77, 2.30), spin about z), heli_barrel = chin gun (trunnion (0, -3.83, -1.60), parented to the hull, not the rotor) | 5.30 (stub wings) x 15.36 x 4.44, rotor 14.81 across | (0, -5.78, -1.60) | rockets (+-1.7, -0.48, -1.12); missiles (+-2.55, -0.48, -0.82) | 1,798 + 358 (rotor 180, gun 136) | 100 + 84 KB |
Weak: the fighter's intakes are plain slabs; the tail rotor is two crossed blades (static, part of the hull).
