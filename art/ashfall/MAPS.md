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
