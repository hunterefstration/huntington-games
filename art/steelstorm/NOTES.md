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

## WHITE PASS (pass.hgm) and STEELWORKS (works.hgm)
Both are made from make_dunes.py by a replaced ground section (scratchpad mkground.js; the sun, sky and far hills come from that section):
`blender -b art/steelstorm/<name>.blend -P tools/blender/make_<name>.py -- [nobake] [preview]` (first time `--factory-startup`), then
`node tools/export-art.mjs <name>`. The three tanks are inside each file, as in the valley.

### WHITE PASS: `tools/blender/make_pass.py`
- 420 m of snow. A mountain road (dark slush with tyre tracks) winds north-south along the valley floor between two shoulders that steepen to
  the edges; the frozen lake (52 x 36 m radii at (-35, 5)) is dead flat blue-grey ice with cracks, nothing on it; 420 pines in clumps on the
  lower slopes; a wrecked convoy (six burnt trucks, two slewed off the road, a tank hulk with debris); a ski-lift station on the west shoulder
  (building, bull wheel, five pylons up the slope with the cable and stopped chairs); road-edge posts. Low cool winter sun, snowy far mountains.
- 107,020 triangles, pass.hgm 5.96 MB (15 pictures). check_heights: drivable 74.7%, blocked by things 4.6%, too steep 20.7% (the shoulders:
  they are the walls of the pass); flood fill reaches 127,429 of 131,225; the rest are strips at the map edge behind the shoulders.
  Sky range 1.78.

### STEELWORKS: `tools/blender/make_works.py`
- An industrial plain: the steel plant (x 30..175, y 25..175 in Blender, a levelled concrete yard) is seven sheds with sawtooth roofs, a blast
  furnace with three stoves and a downcomer, a gas holder, four chimneys (38-52 m), 16 m streets between the blocks; five slag heaps (7-13 m,
  sides under 20 deg) as hills; two rail embankments (2.4 m, 5 m top, sides under 20 deg, level crossings at the roads) with rails and
  wagons; a canal (4.2 m deep, steep concrete walls, dark water) east-west across the south with two bridges (x -90 and 70; causeways in the
  ground, with railings and girders) and a continuous 1 m quay parapet so tanks cannot drive into it; asphalt roads; scrap and ingot heaps,
  a gantry crane, three trucks. Hazy dusty light.
- 88,116 triangles, works.hgm 4.73 MB (12 pictures). check_heights: drivable 92.6%, blocked by things 4.6%, too steep 2.8%; flood fill
  reaches 157,689 of 162,503: everything cut off is the canal floor (flat but walled in). Baked ambient 0.53 / 0.52 / 0.51.

### Rotation fix (valley, dunes)
The map props' `box()` passed radians to hgkit's Rz/Rx/Ry (degrees), so everything rotated was built unrotated: the valley's north-south field
wall came out as crosswise blocks 2.3 m apart, house walls and roof slabs did not follow their house, trucks were axis-aligned, and in the dunes
the depot fence sides and the north-south pipe were wrong too. make_valley.py and make_dunes.py now use radian rotations for props (rRz etc.;
the tanks keep the degree helpers); both maps rebuilt.

## Paint and gear: two materials on every vehicle (all battlefields + v_* re-exported)
Every vehicle now has TWO materials on its one picture: the paint keeps its old name (`tank`, `light_tank`, `heavy_tank`, `td_tank`,
`spaa_tank`, `arty_tank`, `apc_tank`, `truck_tank`, `atgun_tank`) and everything that is not paint is `<that name>_gear` (tracks, road wheels,
idlers, sprockets, tyres and hubs, exhausts, tools and stowage, lights and glass, vision slits and grilles, the dark bore of every gun).
The game tints only materials whose name does not end in `_gear`. The gear material is not metallic (roughness 0.9, metal 0): the game's
specular follows the material colour, not the picture, so a metallic gear material at colour 1 washed the dark wheels out to white.
- One shared kit now: `tools/blender/ss_tanks.py` (picture painting, wheels, tracks, the light and heavy tanks, the medium copied from
  `art/proof/range.blend` and repainted, the split). make_valley/dunes/pass/works.py and make_vehicles.py import it (their copies are gone).
  Kit models: a face is paint when its class is `olive`; road wheels are `alloy` (dark steel), idlers/sprockets `steel`, tracks and tyres
  `rubber`. Paint and gear UV islands are packed apart (paint in v 0.3..1, gear in v 0..0.3), so far-off mip levels do not mix green into the
  wheels. The medium (range) tank's faces carry the range's `part` number: 0 armour, 1 tracks, 3 dark metal (hooks, antenna, MG, grilles),
  4 glass, 5 stowage; part-0 islands shaped like a wheel low on the sides (road wheels, idler, sprocket hubs) are gear too.
- Only the tanks rebuilt inside a battlefield file (ground, props and baked light untouched, 25 s):
  `blender -b art/steelstorm/<map>.blend -P tools/blender/retank.py`, then `node tools/export-art.mjs <map>`.
- range.hgm (PROVING GROUND): rebuilt safely without touching the proof slice: `tools/blender/make_range.py` opens `art/proof/range.blend`,
  saves it as `art/steelstorm/range.blend` (pictures and light EXRs still read from art/proof/tex), swaps in the three tanks and writes
  `art/steelstorm/range_ssr.export.json`; export with `node tools/export-art.mjs range_ssr` (NOT `range`: that is the proof slice's).
  range.hgm now carries the light and heavy too: 2.18 -> 2.84 MB. Heights identical to the old file (97.0 % drivable, same flood fill).
- Model fixes while there: the truck rebuilt (the windscreen floated above an open cab box, the cover was a flat roof on hoops: now bonnet,
  closed cab with windscreen and side windows, mirrors, wings over the front wheels, a canvas arch over the bed with its open back, fuel tank,
  exhaust stack); every gun is a hollow tube with a dark bore (or a dark disc in its muzzle brake); exhaust pipes on the light, heavy, TD,
  SPAA, SPG and APC; tyres have steel hubs; the SPAA's dead code (a loop that built nothing) removed.
- Exporter fix (`tools/blender/hg_export.py`, heights only, used by the Steel Storm maps alone): the "tops" ray started 1 m above the
  ground's highest point, so anything taller than the highest hill (works' sheds and chimneys, every city block) was missing from the height
  map and tanks would drive through it. It now starts above the highest world point. All maps re-exported with it.

| file | size | triangles | check_heights: drivable / blocked / too steep | flood fill |
|---|---|---|---|---|

## Three more battlefields: IRON HARBOUR, GREEN LINE, BROKEN CITY (harbor.hgm, farmland.hgm, city.hgm)
One shared battlefield kit now, `tools/blender/ss_mapkit.py` (the generic half of make_works.py: pictures, prop primitives, terrain and
backdrop meshes, flat `water`, sun and Nishita sky, the bakes, the three tanks, the export config, preview renders). A map script sets its
height, colour, props and views and calls `run()`. Build (about 4 min with the bake), export, check:
`blender -b art/steelstorm/<map>.blend -P tools/blender/make_<map>.py -- [samples=32] [nobake] [preview]` (first time:
`blender -b --factory-startup -P tools/blender/make_<map>.py`), then `node tools/export-art.mjs <map>` and
`node tools/blender/check_heights.mjs "Steel Storm Remastered/assets/<map>.hgm"`. In the game before it has a MAPS entry:
`?go=1&ground=valley&map=assets/<map>.hgm`.
- Water (the harbour's sea, the farm stream, the city park's pond) is its own world object `water` (light picture `<map>_water_light`), not
  ground: the height map's tops stop at its surface, so deep water (sea: surface 5 m over the floor) blocks tanks while the stream (30 cm)
  and the pond can be forded. Terrain colours are given display-like and squared into linear for the bake (`lin()`).
- IRON HARBOUR: sea along the north (y > 115), walled by a continuous 1 m quay parapet (2.2 m on the breakwater's seaward side, riprap
  outside). Quay apron with four portal cranes (jibs over the water); a row of six warehouses (9.5-12 m, gable roofs, two with a roof section
  fallen in, loading platforms on their south faces as cover) with 15 m streets between; three rail sidings with box, tank and flat wagons;
  the container yard: nine blocks of stacks 1-3 high (red, blue, green, orange, rust) with 10 m lanes between and two straddle gantries, a
  smaller stack yard east of the dock, loose and toppled containers; the dry dock (30 x 76 m, 6 m deep, a 17 deg ramp down at its south end,
  the caisson at the sea end): a 51 m ship's hull on keel blocks with staging and its superstructure and funnel, 8 m alleys either side;
  the breakwater road (14 m wide, 80 m out then 120 m west) to a lighthouse, concrete blocks and two trucks on it as cover; a finger pier with
  a crane and a coaster alongside; a cargo ship alongside the west quay; inland: a tank farm (four tanks) inside 1.3 m bund walls, the port
  offices, the dockers' terraces (two rows of houses across a street, some gutted), workers' cottages, a timber yard, a scrapyard, a gate
  in a brick wall with four breaches, a low ridge with four hull-down berms, trees and boulders.
- GREEN LINE: rolling ground (+-3 m) with fields 55 x 60 m boxed in by hedgerows (2.3-3 m tall, 2.2-2.8 m thick, on 0.9 m earth banks;
  they block sight and movement) with one or two 8 m gates each (posts), several hedges left out for bigger fields and longer lanes of fire;
  two sunken lanes (1.6 m deep between double hedges, ramps up where they meet, at x -37, at y -96 and at their ends); two farms (stone
  farmhouse with a tiled roof and chimney, a barn, a shed, a walled yard with three gaps, hay, a cart, a well); an orchard of 42 fruit trees
  behind a wall; the church on an 8 m rise (nave, apse, a 22 m tower with spire, churchyard wall with three gaps, 40 graves, trees); a
  stream with steep 1.8 m banks (not drivable) crossed only by the stone bridge (x 70, on the road to the church) and a ford (x -95, gentle
  banks, stones); a copse of 18 trees, hedgerow oaks, burnt trucks and cars, sandbag posts.
- BROKEN CITY: flat (+-0.5 m). Seven columns x six rows of 40 m blocks between 14 m streets, the boulevard 30 m wide east-west (median of
  trees, lamp posts, five burnt-out trams); the blocks are solid: two to four broken buildings each (3-7 floors, jagged tops, walls standing
  proud, window rows, a sixth of them collapsed into high rubble heaps); the park (two blocks: low walls with gates and blown gaps, 22
  trees, a pond, a bandstand, sandbag posts); three rubble-filled squares (low rubble you drive over, chunks you do not, a monument, wrecks);
  the railway cutting north-south (x 120, 16 m floor, 6.5 m deep, steep walls, ramps at both ends, a ledge down the west wall into the middle
  stretch) with two tracks and a derailed train, crossed by two bridges (the boulevard and the street at y 116, causeways with parapets,
  girders and piers); ten barricades across streets (sandbags or hedgehog rows with a 4.6 m gap, sometimes an overturned bus), forty burnt
  cars, shell-torn street.

| file | hgm + pictures | triangles | check_heights: drivable / blocked by things / too steep | flood fill from the middle |
|---|---|---|---|---|
| harbor.hgm | 5.9 + 3.2 MB | 106,426 | 67.4 % / 31.2 % (sea, buildings, stacks) / 1.3 % | 117,939 of 118,356 (417 cut off: small pockets on the pier end, by the lighthouse, behind cottages) |
| farmland.hgm | 6.6 + 3.5 MB | 113,218 | 90.9 % / 7.4 % / 1.7 % | 159,495 of 159,572 (77 cut off) |
| city.hgm | 7.2 + 2.4 MB | 123,258 | 67.9 % / 30.2 % / 2.0 % | 118,875 of 119,134 (259 cut off: courtyard pockets inside blocks) |
| range.hgm | 2.8 + 1.4 MB | 74,100 | 96.8 / 2.6 / 0.6 | 38,262 of 38,326 (as before) |
| valley.hgm | 6.2 + 2.8 MB | 107,400 | 98.3 / 1.7 / 0.02 | 172,438 of 172,494 |
| dunes.hgm | 4.7 + 1.9 MB | 86,960 | 99.0 / 1.0 / 0 | all |
| pass.hgm | 6.0 + 2.6 MB | 107,592 | 74.7 / 4.6 / 20.7 | as before (strips behind the shoulders) |
| works.hgm | 4.8 + 1.8 MB | 88,688 | 90.5 / 6.7 (was 4.6: sheds now in the height map) / 2.8 | as before (the canal floor) |
v_*.hgm: td 342 KB, spaa 326, arty 343, apc 174, truck 196, atgun 110 (+ one picture each).
Weak: the new maps' blind windows read nearly black in the game; hedges are boxes with blobs on top (no leaf cards); the city's courtyards
are a few closed pockets; harbour concrete reads very light under the game's exposure.

## Round after build 23: greener grass, more objects on all eight grounds (all re-exported, same file names)
### Grass
- FARMLAND / VALLEY / RANGE: natural green with darker lush and lighter patches, dry tufts, a few stubble / ploughed fields (farmland),
  tank tracks, shell craters (farmland, 26, shallow 0.45 m bowls in height()). Checked in game pictures at clear, dusk and overcast.
- The ground colour for the bake can now be a 0.2 m picture instead of the 2.8 m vertex colours: `K.MACRO_PX = 2048` (ss_mapkit maps) or
  `K.macro_node(macro_material, 2048)` (older scripts, after K.hookup). It is evaluated from the map's height()/macro_colour() on a 2048 grid
  laid out like the light picture (planar Lightmap UV). `K.stroke_grid(polylines, width)` draws thin lines (tracks) cheaply.
- VALLEY read pale beige because half the grass was mixed with dry grass AND macro_colour ended in `np.clip(c, 0.05, 1)` on LINEAR colours:
  every blue was lifted to 0.05 and the green greyed. Now clip 0.003. Watch for that floor in the other older scripts (their colours are linear).
- RANGE: art/proof is never touched. make_range.py must be run on art/proof/range.blend; it copies it to art/steelstorm/range.blend, bakes the
  proof's own `terrain_macro` as colour only, recolours the green parts (g/r > ~1) and re-bakes ground + props into art/steelstorm/tex/range_*.exr
  (range_ssr.export.json now points at tex/range_light.exr). The old prop objects are joined with the new things into one `props` mesh.
- Washed out: works (dirt 0.30 -> 0.155 linear; in the game only ~12 % darker, the game's exposure/haze lifts it), harbour and city concrete
  and paving darker. Farmland hedges a little lighter.
- NOTE for testing: `?go=farmland` does NOT choose the ground (it loads the valley); use `?go=1&ground=farmland`.
### Objects
- Shared builders in ss_mapkit.py: bale/bales/bale_stack (new `hay` material), wreck_tank, tank_cubes, gun_pit, shed, ruin, container,
  wall_line, outcrop, lone_tree (trunk solid, crown not), and not solid: bush, fence, pole_line (with wires), log_pile, stones.
- Not solid: faces made while `K.SOFT` is on (the builders above set it) are split off after the bake into `props_soft` (same materials and
  the same light picture: no extra draw calls) with the custom property `hg_soft = 1`; hg_export.py leaves hg_soft objects out of the heights'
  tops and the collision grid. Shells, sight and tanks pass through them.
- Placement: `K.occ_snapshot()` after the map's own props, then `K.scatter(weights, n, ok, KEEP, rng)`: each solid thing needs its footprint +
  9.5 m free of any other prop (rays down on a 1.2 m grid; `tall=0.8` lets low drivable rubble count only near the footprint) and outside the
  KEEP circles: the middle, both base ends and the three conquest points (the game picks the base axis with the most open ground at 90-150 m and
  puts the points at +-0.5 R, off 0.14 x size; `node tools/blender/check_layout.mjs <ground> [--w=9] [--png out.png]` redoes that pick, prints the budgets and checks 9 m routes) and three straight 12 m lanes end to end. An `ok(x, y)` per map
  keeps things off roads, rivers, lakes, the plant, the container yard, steep ground; noise gating (`vn2(x, y, 55, 77) > ~0.47`) makes clusters.
- The older scripts (valley, dunes, pass, works) have their own kit copy; they use the builders through `K.hookup(bm, MI, height, name)`
  (new material names must be in their PM list and PIC; `K.split_soft(pr)` after the props bake).
- Overlaps fixed on the way: wall and sandbag segments (L/n + 0.05, coplanar sides) now alternate thickness; harbour rails 12.05 -> 11.98 m
  and quay parapets alternate. Harbour 1300 -> 116 coplanar pairs, farmland 313 -> 29 (the rest are old: depot pipes, truck cabs, walls).

| ground | draw calls | triangles (all) | files MB | drivable | flood fill cut off | new solid / not solid |
|---|---|---|---|---|---|---|
| farmland | 16 -> 18 | 113k -> 131k | 9.8 -> 11.4 | 90.4 % | 71 | 80 placed + 30 trees / 93 bushes, fences, 2 pole lines, stones, logs |
| valley | 11 -> 14 | 107k -> 122k | 8.8 -> 10.2 | 97.8 % | 53 | 62 / 100 bushes, stones, paddock fences, pole line |
| range | 7 -> 10 | 74k -> 78k | 4.1 -> 5.4 | 96.2 % | 64 | 22 / 40 bushes, stones |
| dunes | 7 -> 10 | 87k -> 97k | 6.4 -> 7.6 | 98.5 % | 0 | 56 / 40 stone groups, scrub, pole line |
| pass | 9 -> 11 | 108k -> 114k | 8.3 -> 9.2 | 74.2 % | 3795 (behind the shoulders, as before) | 52 / stones |
| works | 6 -> 10 | 89k -> 95k | 6.4 -> 7.6 | 90.0 % | 4817 (canal floor, as before) | 52 / stones, pole line |
| harbor | 19 -> 22 | 106k -> 112k | 8.8 -> 9.6 | 67.0 % | 417 (as before) | 42 / bushes, stones, pole line |
| city | 14 -> 16 | 123k -> 129k | 9.3 -> 10.0 | 67.8 % | 261 (as before) | 1 / 60 rubble stone groups, 27 park bushes |
City: the streets were already tight (barricades with 4.6 m gaps, 40 cars) and the squares and park full; with the 9.5 m rule only one sandbag line
fitted, so the city got detail but not double the cover (on purpose, after bots got stuck on the denser valley).
Weak: the lone trees are broadleaf blobs (on the range they stand among the proof's pines); bales and containers are plain primitives.
