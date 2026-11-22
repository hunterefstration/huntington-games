# ASHFALL maps: build log

## MAIN STREET: DONE, exported (`Ashfall/assets/street.hgm`)
Source: `tools/blender/make_street.py` builds `art/ashfall/street.blend` (not in git) and bakes `art/ashfall/tex/street_light.exr`.
Rebuild + bake (about 1 min): `blender -b art/ashfall/street.blend -P tools/blender/make_street.py -- [samples=48] [preview] [nobake]`,
then `node tools/export-art.mjs street`. Check: `node tools/blender/check_map.mjs Ashfall/assets/street.hgm [x z ...]` (game axes).

- Layout (Blender x across, y along; game x = x, game z = -y): street x -5..5, sidewalks to +-8, shop rows x -16..-8 / 8..16,
  back lot (west, x -22..-16) and service lane (east, x 16..22). Alleys through the rows at y -14..-12 and 0..2.5 (west),
  -16..-13.5 and 10..12.5 (east). Open shops with one room, a counter, shelves and a back door: W2 (y -12..0), W4 (14..24), E2 (-13.5..-2).
  Petrol station with canopy, pumps and kiosk at the north end (y 24..35); collapsed building (rubble on a solid base) closes the south end;
  4 m boundary wall all round. Bus slewed across the street at y -7.5; six wrecked cars; sandbag barricades; two burning barrels; dead lamp posts.
- Light: low sun from the south-south-west (elevation about 19 deg, warm, strength 5), dusk sky gradient (dark grey, orange band at the horizon),
  warm point lamps in the three rooms, under the station canopy and at the barrels; emissive shop signs and lamps (`emissive_*` materials).
- 6,710 triangles, 10 tiling pictures (ash-dusted asphalt, concrete, brick, plaster, metal, rust, wood, sandbag, glass, dirt; 1024) +
  one 2048 light picture + the sky. Ground at z = 0 everywhere, nothing below it (bounds min y = 0).
- Checked from the exported file: 65.0 % of the 0.25 m columns walkable (sandbags, counters, cars, rubble all block); flood fill on the 0.5 m path grid from mid-street reaches every
  open cell inside the boundary (the unreached ~1000 cells are the 1 m pad outside the boundary wall), including the three rooms, the alleys,
  the back lot, the service lane and the station. Probes: street about 0.21-0.36 ambient with sun visibility 0 / 1 in shadow / sun strips;
  rooms 0.58-0.87 (lamps). Exporter ambient 0.22 / 0.16 / 0.12.
- Weak: low triangle count (boxy facades, no roof detail); the light picture is about 6-8 texels per metre on facades (soft shadows);
  ash drifts are low heaps plus dusted pictures, not painted per wall.
- Gotchas fixed on the way (both maps): nothing may go below z = 0 (the exporter measures the grid and the probe height from the lowest
  point); and whatever stands on the ground starts 6 mm above it, because a bottom face coplanar with the ground lets the exporter's
  down-rays hit the ground instead and file the object as a thin overhead sheet (walkable underneath).

## THE DEPOT: DONE, exported (`Ashfall/assets/depot.hgm`)
Source: `tools/blender/make_depot.py` (same pipeline as the street) builds `art/ashfall/depot.blend`, bakes `art/ashfall/tex/depot_light.exr`.
Rebuild + bake: `blender -b art/ashfall/depot.blend -P tools/blender/make_depot.py -- [samples=48] [preview]`, then `node tools/export-art.mjs depot`.

- Rail freight warehouse, 50 x 36 m inside (x -25..25, y -18..18), 8.5 m walls, closed metal roof on beams with six skylights.
  Big doors rolled shut in the east wall with a lit sign; ground-level loading bays there (pallets, a forklift, drums).
  Rail track with two freight wagons (12 m) down the north side, 2 m walkable lane behind them. Four rows of pallet racking (5 m tall, solid
  bottom row of crates, lanes 3.8 m, cross aisle at x -4..2), crate stacks, scattered drums and pallets (pallets are walkable, 0.14 m).
  Office block in the south-west corner (x -25..-15, y -18..-8): two rooms, door to the hall and between the rooms, windows, desks, cabinets.
- Light: sun through the skylights (shafts on the floor), eight warm lamps hanging over the aisles, two in the office, emissive lamp boxes.
  Dark sky picture exported (only seen through the skylights). Exporter ambient 0.155 / 0.121 / 0.086 (the average indoor light).
- 6,148 triangles, 9 tiling pictures + one 2048 light picture + sky.
- Checked from the exported file: 86.1 % of columns walkable (includes the empty 1 m pad outside the walls); flood fill on the 0.5 m path
  grid reaches 6642 of 6645 walkable cells (all aisles, behind the wagons, both office rooms). Probes 0.19-0.6 in the hall, 1.5 under the office lamps.
- Weak: no volumetric dust (shafts are only light patches on the floor); racks are simple frames; low triangle count.

## Detail pass (both maps re-exported, same file names)
- MAIN STREET: 6,710 -> 16,230 triangles. Cars rebuilt as shaped bodies (hood, cabin, boot) with tyres, glass all round, bumpers and lights;
  shop signs with block lettering (STORE, DINER, PHARMACY, HARDWARE, CAFE, FUEL), pleated awnings with valances, window frames with
  mullions and sills, drainpipes and meters, kerbs (0.14 m, walkable) and drain grates, street lamps with arms and heads (replacing bare
  poles), wheelie bins and dumpsters, bricks and beams on the rubble. Tiling pictures repeat more often on large surfaces (less blur).
  Check: 64.9 % walkable (was 65.0 %); flood fill reaches every open cell inside the boundary (7696 of 8650; the rest is the outside pad).
- THE DEPOT: 6,148 -> 14,580 triangles. Racking with zig-zag end-frame braces, pallets with stringers and boards, crates with corner and
  rail battens, wagons with bogies (wheels, side frames), couplers and buffers, side ribs, three cable trays with hangers, conical lamp
  shades, pedestal desks with drawers, monitors and papers, drum rims. Check: 85.8 % walkable (was 86.1 %); flood fill 6635 of 6637.
- Weak: still no broken glass shards or tiled roofs; letters are lit blocks (no font texture).

## Bigger maps (this round): all three rebuilt, same file names
Note: every map script now uses radian rotations locally (hgkit's Rx/Ry/Rz take degrees, so earlier angled objects (the slewed bus,
angled cars, rubble) were nearly unrotated in the old street and depot).

### THE YARD: DONE, exported (`Ashfall/assets/yard.hgm`), new script `tools/blender/make_yard.py`, source `art/ashfall/yard.blend`
- Bounds 101 x 91 m (x -50.6..50.6, y -45.6..45.6 incl. walls); 18,788 triangles, 10 meshes; 3.0 MB on disk (hgm + 11 pictures).
- Two rail lines along the north side (box cars, a walk-through open car standing on the ground with both doors open, a flatcar with a container,
  a locomotive), container stacks in lanes (3 m) under a gantry crane (south-west), an open-sided warehouse with half walls, crate stacks and
  lamps (south-east) plus a raised loading platform (1.2 m) with a ramp (9.7 deg) at its east end, a fuel point with tanks and a pump canopy
  (north-west), the gate and a guard hut (enterable) in the west wall, scrap piles, floodlights, low ash heaps, an open middle with low covers,
  a 3 m lane inside the walls all round.
- Check: 90.5 % walkable; flood fill from (0, 0) reaches 32,530 of 33,707 walkable cells (the rest is the pad outside the walls); probes
  0.34-0.42 ambient. Ambient 0.33 / 0.25 / 0.20, sky range 2.48. The old Proof Slice yard's leftover pictures (yard_gun, yard_enemy,
  yard_vm_arms, yard_asphalt, ...) were removed from Ashfall/assets (the new yard.hgm does not use them).
- Odd: the loading platform is 1.2 m high: walkable only if the game climbs the ramp (if it treats heights over 0.45 m as blocked, the platform
  is a blocker and the ramp a slope up to it).

### THE DEPOT: DONE, exported (`Ashfall/assets/depot.hgm`)
- Bounds 71 x 56 m inside the walls (x -35..35, y -27.5..27.5); 17,352 triangles; 2.4 MB on disk.
- Shelving hall in the west half (12 rack rows), open middle (start spot), rail track with three wagons along the north wall (3.7 m lane
  behind), loading dock on the east wall (three shut bays, two box trucks backed in, pallets, a dock desk), office block with four rooms in the
  south-east corner, machine room (generators, compressor, pipes) in the south-west corner. Thirteen hanging lamps: four dead, the rest dim.
- Check: 89.8 % walkable; flood fill from (0, 0) reaches 13,682 of 14,474 (rest: outside pad); probes 0.11-0.51 (middle 0.51 under a skylight).
  Ambient 0.073 / 0.055 / 0.037: darker than before (0.155) because of the dead lamps, as asked.

### MAIN STREET: DONE, exported (`Ashfall/assets/street.hgm`)
- Bounds 81 x 111 m (x -40.4..40.4, y -55.4..55.4); 32,434 triangles; 3.7 MB on disk.
- Main street (north-south) crossed by a cross street; the junction is a paved square with a fountain basin (0.6 m, blocks), plinth and statue,
  four benches. Four quadrants, each with a row of three shops on the main street and two on the cross street (eight open shops with a room,
  counter and back door in all), alleys between the rows into back lots with fences (gaps) and clutter: the back alleys loop through the lots,
  the row gaps and the back doors. Petrol station at the north end, collapsed building across the south end, the bus slewed across the east arm,
  nine wrecks, barricades, barrels, lamps, bins.
- Check: 76.5 % walkable; flood fill from (6, 6) reaches 26,080 of 27,971 (rest: outside pad; (0, 0) itself is the fountain); probes 0.29-0.68.
- Depot follow-up: working lamps raised (dead ones stay dead); exporter ambient now 0.103 / 0.080 / 0.053 (was 0.073); collision and paths unchanged (89.8 %, 13,682 reached).

## Not done yet: THE UNDERGROUND (subway.hgm) and CHECKPOINT 9 (outpost.hgm)
Planned the same way as the yard (copy make_yard.py, new layout): stopped before starting them for budget.

### THE UNDERGROUND: DONE, exported (`Ashfall/assets/subway.hgm`), script `tools/blender/make_subway.py` (from make_yard.py)
- Bounds 91 x 51 m (x -45.6..45.6, y -25.6..25.6), ceiling at 5.2 m; 5,012 triangles; 2.0 MB on disk.
- Station: the two platforms and the boarded-over track (planks with the rails let in flush) are one flat floor; a stalled three-car train on
  the track with three open doors each side per car (walk through), a 10 m gap at the centre; pillar rows, benches, a kiosk, bins.
  Ticket hall (north): a turnstile line with gaps, two ticket booths (enterable), the stair block up to the street (closed).
  Maintenance corridor (south) split by an inner wall with doors: it loops along the whole station and back onto the platforms through
  four doors; pipes, cable trays, junk. Side alcoves at both ends. Fluorescent strips (about half dead) and red emergency lamps. No sun.
- Check: 96.2 % walkable (mostly open platform); flood fill from (0, 0) reaches 18,407 of 18,425; probes 0.12-0.21 on the platforms and
  corridor. Ambient 0.088 / 0.073 / 0.073. Odd: walls that reach exactly to a ceiling's underside vanish from the grid (coplanar); the
  ceiling now starts 1 cm above them.

### CHECKPOINT 9: DONE, exported (`Ashfall/assets/outpost.hgm`), script `tools/blender/make_outpost.py`
- Bounds 102 x 102 m (x, y -51.2..51.2 incl. the earth berm); 14,112 triangles; 2.7 MB on disk. Night: a high, dim, blue moon.
- A road through a checkpoint (jersey-barrier chicane, barrier pole, guard booth) at the south; hesco walls round the camp with gaps;
  four frame tents (low walls, pitched roofs, both ends open: walk through); two watch towers (sandbagged bases, blockers); two trucks,
  an APC and a third truck outside; a helipad with an H and a dead helicopter (rotor blades drooping); sandbag nests, crate stacks,
  containers; a perimeter fence 4 m inside the berm with three breaks per side; eight floodlights making pools of light. Open middle.
- Check: 91.6 % walkable; flood fill from (0, 0) reaches 36,977 of 38,652 (the rest is the pad outside the berm); probes 0.06 in the dark,
  0.35-0.46 under floodlights (sun visibility = moon). Ambient 0.059 / 0.047 / 0.038.
