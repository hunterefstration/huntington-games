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

### Build note for the next three maps
Each is `tools/blender/make_<name>.py`, made from make_yard.py by a build section (scratchpad mkmap2.js: the layout, extra tiling
pictures added through `add_pics`, the lights, PREVIEW_VIEWS). Run: `blender -b art/ashfall/<name>.blend -P tools/blender/make_<name>.py`
(first time `--factory-startup`), then `node tools/export-art.mjs <name>`.

### THE ARCADE: DONE (`Ashfall/assets/mall.hgm`), script `tools/blender/make_mall.py`
- Bounds 91 x 67 m, ceiling 6 m, 12,752 triangles, 1.2 MB. New picture: mall_tile (terrazzo checker).
- Tiled concourse (x -25..35) with planters and dead trees, benches, a dry fountain at (12, 0), two kiosk carts. Atrium at the centre under a
  broken skylight (more than half its panes gone): a dusk sun shaft falls on glass and rubble. Eight open shops a side (shelves, clothes rails,
  counters, empty); one per row fully shuttered, others with the shutter half down (bottom 1.95 m); every shop has a back door to the back
  corridor; store rooms behind. Food court in the west (five kiosks you can get behind, fixed tables with stools), lobby in the east (chained
  glass doors, two dead escalators, information desk). Exit signs, about half the lamps working.
- Check: 92.1% walkable; flood fill from (0, 0) reaches all 22,478 cells. Probes 0.13 at the atrium (sun 0.79), 0.34-0.36 in lit shops and
  the food court, near 0 in shops whose lamp is dead and the store rooms. Ambient 0.117 / 0.086 / 0.057.

### THE FAIRGROUND: DONE (`Ashfall/assets/carnival.hgm`), script `tools/blender/make_carnival.py`
- Bounds 101 x 91 m, 17,878 triangles, 1.8 MB. New pictures: carnival_canvas (faded red / cream stripes), carnival_turf (trampled grass and mud).
- Hoarding round the edge; ticket gate in the south (pillars, sign, turnstiles, two booths). An asphalt midway from the gate to the ferris
  wheel (backdrop: wheel 15 m radius, hub 17.5 m up, one gondola fallen; base and legs are the only parts in reach). 25 game stalls in rows with
  1.6 m gaps, each with a 1.2 m gap at one end of the counter to get behind. Carousel at (-24, 12) (the platform is a 0.3 m step), ghost-train
  shed at x 18..38, y 8..20 (entrance and exit doors, a winding inside, a red lamp, dark), three food trucks, a high striker, bales, barrels.
  Bulb strings zig-zag over the midway and out to the rides: 60 bulbs lit (warm), the rest dead. Night: blue moon, dark blue sky.
- Check: 96.6% walkable; flood fill from (0, 0) reaches 35,979 of 35,981 cells. Probes 0.23 on the midway under bulbs, 0.04-0.05 in the
  dark, 0.03 in the ghost train. Ambient 0.047 / 0.044 / 0.065.

### SUBLEVEL 3: DONE (`Ashfall/assets/lab.hgm`), script `tools/blender/make_lab.py`
- Bounds 81 x 61 m; rooms 4.2 m high, containment hall 7 m; 7,552 triangles, 0.8 MB. New picture: lab_panel (wall panels).
- Containment hall in the middle (28 x 20, four doors) with eight glass-fronted cells: panes broken out at random, glass shards on the floor,
  a toppled specimen tank, consoles, a gantry, hanging cables; the centre is open. A ring corridor round it; three labs to the north (benches,
  fume hoods, doors between them); the server room to the south (four rows of racks with status lights, cross aisles, one rack pulled over);
  medical bay, specimen-tank room and stores to the west; decontamination corridor to the east (three narrowed stages with shower heads and
  hazard strips, ending at a shut blast door), control room and offices north of it, generator room south of it. Cold blue-white lamps
  (about half dead), red alarm lamps, green exit signs. No sun.
- Check: 91.2% walkable; flood fill from (0, 0) reaches 18,210 of 18,213. Probes 0.71-0.92 in the hall, 0.28-0.37 in the corridor and server
  room, 0.11-0.14 in the generator room. Ambient 0.054 / 0.055 / 0.059.

### Ground detail, all eight maps (yard, street, depot, subway, outpost, mall, carnival, lab)
The ground already had a tiling picture under the light; the yard's (and outpost's, street's back lots) was the painted "dirt": soft blobs over
6 m tiles, a blur at eye height. Now `gravel_px` (hgkit: mottled ash dirt, thousands of small lit pebbles with contact shadows, hairline
cracks, grain) at 3 m tiles, and concrete and asphalt get `grit` (aggregate specks, pits, hairline cracks) for floors and roads. All eight
rebuilt, rebaked and exported; collision and paths unchanged. (The yard was exported with hg_export directly: `export-art.mjs yard` would also
re-run art/proof/yard.)

## Round after build 23 (the owner's notes): subway, yard, depot, street
New checks (run them after every map change):
- `node tools/blender/check_reach.mjs Ashfall/assets/<map>.hgm [x z]`: grows every solid cell of the game's collision grid by 0.5 m (the
  game's own solid test: over 0.45 m, or something overhead below 1.85 m) and flood-fills; lists every place reachable only through a
  gap under 1.5 m, and checks the game's ring of 12 start spots (0.3 x the smaller side round the middle).
- `blender -b art/ashfall/<map>.blend -P tools/blender/check_overlap.py`: coplanar overlapping faces (they flicker). The map scripts now
  call hgkit `separate_coplanar` after building: the smaller face of each pair moves 1.2 cm along its normal (floor patches lift, boxes grow
  a little), the base ground never moves.

### THE UNDERGROUND (subway), reworked
- Light: no more scatter of little lamps. Strip fittings over both platform edges in 6 m sections, about half dead in runs (dark stretches);
  the two lit train cars glow through their windows and doors (the middle car is dead); red emergency lamps in the service corridor, at the
  doors and the tunnel signals; two work lamps on tripods (the trolley in the middle, the generator in the corridor); a little daylight down
  the closed stair; green exit signs. World 0.015, no sun.
  Ambient 0.029 / 0.017 / 0.013; probes: median 0.022, p90 0.56, lit platform 0.23-0.5, ticket hall 0.79, brightest 3.65 inside the work
  lamp's beam. In the game: exposure = bright / max(0.05, ambient) is clamped to 20 at bright 1 (all white); bright about 0.1 (exposure 2)
  looks right (checked with ?exp=0.1).
- Ways through: train doors 2 m clear (door leaves now inside the car, grab rails above 1.85 m), every wall door 2.4 m, alcove doors 2.4 m,
  booth doors 1.8 m. check_reach: 99.7% of the floor reachable through 1.5 m+; left: the two tunnel stubs behind the buffer stops (2 m2
  each, dead ends) and a 1 m2 nook behind crates; all 12 ring spots fine. (The old map had no gap under 1.5 m in the grid either: what
  stopped the owner was most likely a door leaf beside a train door or the 1.2 m booth doors.)
- Coplanar: 165 faces moved apart, 0 pairs left.
- Set pieces: a tunnel mouth at each end (buffer stop, fallen tunnel, signal); the maintenance trolley with cable drums under a work lamp in
  the middle gap (landmark; the centre stays open); a sandbagged firing point with crates (north platform); the collapsed ceiling with
  slabs, a fallen girder and hanging cables (south-east); a mail-cart barricade (south-west); vending machines, benches back to back,
  hanging name boards, posters, cable trays both walls, drains, puddles, rubbish; ticket hall: barricade in front of the stair, ticket
  machines, notice boards; corridor: electrical cabinets, a generator, crates, cable drums.
- 9,094 triangles, subway.hgm 950 KB.
- (all four maps) hgkit `collapse_thin_lightmap`: faces whose light-picture island is under 1.5 texels wide (rails, ribs, cables) baked
  to black streaks; they now take the light of the nearest well-resolved face facing the same way.

### THE YARD, filled
- Set pieces: an engine shed you can fight through (x 6..30, y 27..42: two 5 m doors and a side door each way, rails in, a flatcar with an
  engine block, benches, lathes, a crane beam, a lantern roof, hanging lamps); a water tower beside it (landmark, 13 m); coal bunkers with
  four heaped bays under an overhead conveyor (south); a wrecked tanker in the south middle; a two-storey signal box with a glazed cabin
  (east, the lower room open); overhead line poles and wires along both tracks; a sandbagged checkpoint and a jersey-barrier chicane inside
  the gate. Ground: kerbs along the road, a painted centre line, drains, puddles, oil stains, pallets. Walls: lamps on brackets (every
  other one lit), signs, a pipe run, wire along the top. The walk-through box car's crates moved to its sides; the gate hut door is 1.8 m.
- Floor patches now sit 2 cm up (they were 2 mm and flickered); 91 coplanar faces moved apart, 0 visible pairs left.
- check_reach: 99.5% reachable through 1.5 m+; left: the backs of the coal bays behind their heaps (3-4 m2 each) and small nooks by the
  signal-box steps; all 12 ring spots fine. 90.2% walkable; flood fill 32,242 of 33,439 (rest: outside the wall).
- 22,284 triangles, yard.hgm 2.0 MB. Ambient 0.295 / 0.222 / 0.176 (unchanged look: dusk sun), brightest probe 0.90 under a wall lamp.

### Collision: walls the game could walk through (exporter fixed)
`hg_export.py` column(): a solid was only started by a top face, so a wall whose top was hidden (piercing a ceiling slab, under a ceiling
beam, a roof slab sitting exactly on it) lost its whole span: in the subway export every wall probed was open (outer, platform, corridor,
booths, train sides). Now an underside with no top seen counts as solid up to the previous span, and a floor patch running under a wall or
prop (a top face within 5 cm of the floor met while inside something) closes that solid instead of turning it into a thin sheet. Walls
thinner than ~0.13 m can still slip between the grid's samples (two per 0.25 m cell): keep walls 0.2 m or more (the train cars and booths
are now 0.2). Every map needs a re-export with the fixed exporter; subway, yard, depot done.
Probe a spot: scratchpad col.mjs (prints SOLID/open and the spans for a Blender x, y).

### THE DEPOT, filled and fixed
- Leak: the roof sat exactly on the 9 m wall tops; wall columns vanished and the floor ran out past the walls. Roof now 1 cm up, plus the
  exporter fix. Office doors 1.9 m (were 1.0), office and machine-room entrances 2.0 m.
- Set pieces: a packing line (roller conveyor with a skirt, parcels, sorting tables, a control box: crouch cover) south of the middle;
  wrapped pallet stacks (full cover) in pairs; a shipping container with a door ajar (landmark, north-east); a barricade of an overturned
  forklift, sandbags and crates facing the dock; spilled crates in two rack aisles; chains hanging from the roof beams; yellow walkway lines
  along the aisles, a hatched strip at the dock, drains, damp patches, tyre marks; wall signs, extinguisher boxes, a pipe run on the west
  wall. The middle and the 12 start spots stay clear.
- 702 coplanar faces moved apart (racks, crates and slats), 0 left. check_reach: 99.5% through 1.5 m+ (left: the gaps between the trucks
  and the dock wall, inside the barricade arc); ring 12/12. 87.5% walkable.
- 20,560 triangles, depot.hgm 1.5 MB. Ambient 0.097 / 0.075 / 0.051, probes median 0.08, p90 0.50, brightest 1.50 under a lamp by the
  wagons.
- Puddle decals in yard and depot are damp asphalt patches now (the dark glass ones read as holes).

### MAIN STREET, filled
- Set pieces, one per back lot: a construction site with a scaffold tower (planks overhead), cement mixer, stacked pipes, a skip, sand and a
  site toilet (north-east); a car park with bay lines, three wrecks, a ticket machine, a garden shed you can enter (1.8 m door) and a
  washing line with sheets (north-west); a beer garden / playground with picnic tables, a climbing frame, a slide and low brick walls
  (south-east); a survivors' camp with two tents, a fire barrel, seats, sandbag walls and a pickup (south-west).
  Street: traffic lights over the junction, a bus shelter (against the shopfront), a phone box, bollards round the square, projecting shop
  signs, cables and a banner strung over the main street, a fuel price pylon at the petrol station (north landmark); centre-line dashes,
  zebra crossings, drains, rubbish bags.
- Fixes: shop doors 2.0 m (back doors 1.8 m); no 0.5 m slot between the main-street and cross-street rows; floor patches 2 cm and 3.5 cm
  up; 445 coplanar faces moved apart, 0 left.
- check_reach: 99.5% through 1.5 m+; two ring spots fall inside closed blocks (as before), the game moves them about 4 m to the street.

### Light pictures, all four maps (after the street showed a black car)
smart_uv sizes islands by real area, so a big ground ate the 2048 picture and props got a texel or two (100 of a car's 103 faces). Now:
hgkit `lightmap_weight` scales every island except the ground and big floor patches by 2 and repacks; `collapse_thin_lightmap` only for
truly sub-texel faces with a lit neighbour within 1 m; and after baking `relight_black_faces` gives slivers in the open that came out
black (kerb sides, rails, sills; under 0.6 m2) the light of the nearest lit face. `tools/blender/check_black.py` lists faces in the open
that baked black (it skips faces inside solids).
- Ground decals: no dark patch decals any more on my four maps (oil stains, damp patches, subway puddles): an opaque quad cannot fade at
  its edges and they read as holes. Painted lines and drain grates stay.
- Ticket hall (subway): its strip fittings are dead now; light from the daylight pool at the stair (weaker), a warm lamp in each booth
  and the red lamp; the wall between hall and platform is brick.
- Ticket hall final: strips dead; warm pools from four bulkheads on the back wall, the two booth lamps and the stair's daylight; probes
  0.18-0.45 in the pools, 0.02-0.03 between. Subway ambient now 0.036 / 0.023 / 0.018. At the game's exposure 1.5 the hall is very dark
  between the pools (screenshot checked); exposure 2 if it plays too dark.
- Yard: the black shape by the shed's platform is gone (checked in game picture): it was small heap faces borrowing a black texel.
- Final numbers (all four rebuilt, checked, exported): subway 948 KB, 9.1k tris; yard 2.0 MB, 22.3k; depot 1.5 MB, 20.6k; street 2.7 MB,
  36.2k. check_reach 99.3-99.5% through 1.5 m+, ring 12/12 (street 10/12, the two moved 4 m by the game as before), 0 coplanar pairs.

## Round after build 23: CHECKPOINT 9, THE ARCADE, THE FAIRGROUND, SUBLEVEL 3 (outpost, mall, carnival, lab)
Same pipeline and file names. New shared pieces (mine; hgkit untouched):
- `tools/blender/mapkit.py`: the set-piece kit for these four scripts (`install(globals())`): `floor()` cuts the ground round its
  patches into one connected sheet at z = 0 (no patch lies on the ground any more), `blob/strip/dashes` decals 2-8 cm up at staggered
  heights (no dark patches: they read as holes), `tube/pipe_run/cable_tray/cable`, `crate/crate_stack/barrel(s)/pallet/sandbags/jersey/
  kerb/drain/litter/tyres/sign/awning/lamp_cone/czech/wire_coil/prism`, `grime_pic/paint_pic` (two new pictures per map),
  `lightmap_uv()` (islands by angle, then packed with a fixed 0.12 % margin: smart_project's own margin grew with the island count and
  left the outpost ground 2-3 texels per metre; now 7-10.5) followed by `collapse_thin()` (a stricter hgkit collapse_thin_lightmap:
  under 0.9 texels, same-facing neighbour within 1 m, else left alone; the loose rule pointed whole cylinders at an unbaked texel and
  canisters, barrels and wheels drew pure black), and `clean_light()` for the
  baked light picture: lone noisy texels replaced by their neighbours, then a 3 x 3 blur over baked texels only (the old 5-tap cross blur
  turned every noisy texel into a small white "+" on the walls). Bakes also clamp indirect samples at 3. The glass and grime pictures
  are lighter (a glass tank and tyres read as black holes at the game's exposure).
- `tools/blender/coplanar.py`: run in each script on the finished bmesh (`... -- coponly` stops there): faces facing the same way within
  1 cm of one plane and overlapping more than 0.004 m2, skipping what is covered or inside a solid. All four maps now: 0.
- `tools/blender/check_ways.mjs`: the game's own solid rule (20-world.js), solid grown by 0.5 m, flood fill from the middle: lists
  areas only reachable through gaps under ~1.5 m ("NARROW") or sealed, the 12 ring spots, `--png` picture, and the light at 1 m
  (ambient, probe percentiles, brightest probe and where).
- Indoor lights: `LIGHTS` entries may carry a 6th value (a spot cone: the lamp shines down only, ceilings stay dark), and `AREAS`
  (lab, mall) are large dim ceiling-wide area lights with no fixture: a soft fill in the light picture and the probes alike, so no room
  is pitch black and the gun is not black in a dark room.
- Every wall the player must not pass is >= 0.2 m thick or stands on a >= 0.5 m base (glass panes sit on a 0.5 m kerb; the outpost
  fence stands on a 0.55 m footing); ways through are >= 1.8 m by construction (doors 1.9 m, stall counters leave 1.8 m).

### CHECKPOINT 9 (outpost)
- Added: the gate as a set piece (jersey chicane under a lit inspection canopy with a CHECKPOINT board, chevrons, stop line, the barrier
  arm now RAISED: lowered, it closed the road to a 1 m gap in the game's grid; booth against the hesco, a bagged firing point with a burn
  barrel, a queue of three cars), a command post hut you can enter (map table, radio desk, map board, lamp) with a 14 m radio mast (lit
  tip, landmark), generator and cables; the vehicle park under a camo net (trucks with real wheels, the APC as a sloped hull, drums,
  tyres, bench, parking lines, tracks, a work lamp under the net); the helipad painted (H, ring, edge lights, windsock, fuel bladder);
  a supply dump (2 x 2 crate stacks you cannot see over, sack pallets you can); a mortar pit; cots and lockers in the tents; towers
  with ladders; a flagpole and two waist-high bag walls in the open middle; outside the walls a refugee camp (tarps, fire, burnt car),
  tank traps, a gun nest with wire coils, a two-high container stack, a burnt truck; a power line along the road; road paint; warning
  plates on the fence. 14k -> 54k triangles.
- Overlaps fixed: road/pads now cut into the ground; berm corners, doubled fence posts at corners, hesco corners, tent cot/locker, tower
  bags, canopy fascia, wheel caps flush with bodies, litter heights. Ways: barrier arm, CP door 1.8 m, mortar pit 2.9 m way in, a car
  moved out of the chicane, hesco gaps 2.5-3 m, booth slit closed.
- Light: moon 0.3 (was 0.7), sky 0.22; sodium floodlights at the gate, CP, dump, helipad, vehicle park (+ work lamp) and three outside;
  burn barrels; tent lamps. Ambient 0.032 (luminance), probes median 0.032, 90 % 0.12, 99 % 0.33, brightest 2.26 (at the refugee fire).
- Check: 90.3 % walkable; check_ways 0 narrow, 0 sealed, 12/12 ring spots; check_reach 99.8 % through 1.5 m+, 0 regions. 4.1 MB hgm.

### THE ARCADE (mall)
- Added: shops by kind with real contents (grocery gondolas, wall shelving, checkout, trolleys; clothes rounders, mannequins, changing
  booths; electronics counter and dead screens; a cafe with tables, chairs and menu board; looted shops), a sign board on every fascia,
  shopfront glass on a kerb; the survivors' barricade across the east concourse (vending machines, tables on their sides, trolleys,
  boards; two 2 m ways through); banners round the atrium, ducts over the shopfronts, a lit directory board, trolleys, a puddle under
  the skylight; food court kiosk menu boards, tray return, vending machines, hanging signs; lobby cash machine, benches, lit mall map;
  back corridors with pipes, a cable tray, fuse boxes, a yellow line, emergency lamps; store rooms with shelving and pallets.
  12.8k -> 45k triangles.
- Overlaps fixed: floor patches (tile on concrete), ceiling vs outer walls (walls stop under it, the slab runs past them), shop back
  walls whose random door gap could come out inverted (two walls overlapping), skylight mullion crossings, overlapping trolleys and
  crates, fuse-box plates. Ways: back doors, store-room doors and kiosk gaps 1.9 m; gondola aisles 1.8 m; vending machines to the wall.
- Light: dusk sun through the broken skylight (2.6, was 4), six warm pendant domes as downward spots (pools on the floor, the ceiling
  stays dark; was ~60 strip lamps, half lit), three lit shops, red emergency lamps in the corridors, exit signs glow only; dim warm area
  fill. Ambient 0.022, probes median 0.022, 90 % 0.13, 99 % 0.35, brightest 1.51 (beside the lit directory board).
- Check: 86.6 % walkable; check_ways 0 narrow, 0 sealed, 12/12; check_reach 98.4 %, 9 pockets of 1.0-1.9 m2 (changing booths,
  shopfront corners). 3.0 MB hgm.

### THE FAIRGROUND (carnival)
- Added: a big top (canvas wall with two 4.7 m ways in, a ring you step over, banked seats as cover, a lamp inside), the dodgems (rail
  with two 4 m ways in, cars as waist cover, roof on posts, lamp), an eating place with bench tables round a third food truck,
  generator and cables, queue rails at the gate and the wheel, a ticket box, stall sign boards and prizes, two burning stalls, banners
  high across the midway, bunting, posters on the hoarding, puddles, litter. The gate now has gates (it opened on to the outside pad:
  check_reach saw the outside leaking in). Midway stalls now FACE the midway (they faced away); the stall where the cross path meets
  the midway is gone (it narrowed the path to 1.8 m). 17.9k -> 26.5k triangles.
- Overlaps fixed: path/turf patches, ghost-train roof vs facade, gate sign vs pillars, doubled bulb poles, stall roof/walls, food truck
  wheels and cab, wheel spokes and hangers, seat rows. Ways: stall counters leave 1.8 m (the sloping awning beam of one stall in five
  dropped to 0.9 m across the opening; now 2.0-2.6 m), stalls 3.0 m deep, bleachers 1.8 m from the tent wall, fewer carousel horses.
- Light: the 60 lit bulbs threw 60 small lights; now bulbs glow only and five lighting masts make the pools (gate, midway x2, eating
  place, wheel) plus the carousel crown, ghost-train sign, big top, dodgems and the two fires. Moon 0.3, sky 0.45.
  Ambient 0.037, probes median 0.037, 90 % 0.11, 99 % 0.23, brightest 1.78 (inside the carousel's lit drum).
- Check: 94.5 % walkable; check_ways 0 narrow, 0 sealed, 12/12; check_reach 99.4 %, 4 pockets of 1.1-1.7 m2 (carousel, wall slivers).
  2.3 MB hgm.

### SUBLEVEL 3 (lab)
- Added: hall control island (U desk, see-over), cryo canisters, a crate stack, a gantry walkway with rails, crane rail, hanging and floor
  cables, drains, hazard bands at every cell; cells with beds against the wall and signs; server rows with LED strips, cable trays over
  every row, CRAC units, a pulled-over rack; labs with microscopes, stools, whiteboards, freezers, fume hoods; medical bay beds, drip
  stands; specimen tanks piped to the ceiling; store racking with boxes; control-room chairs; generator exhausts, a tank pipe header;
  corridor pipes, cable trays, gurneys, a desk barricade (2.3 m left open), signs, floor lines. 7.5k -> 17k triangles.
- Overlaps fixed: ceiling vs outer walls, cell roofs overlapping, corridor walls now run to the outer wall (no slits). Ways: every door
  1.9 m, cell doors 2.2 m, decon frames 1.74 m, hood/bed/freezer pockets removed. Glass cell fronts sit on a 0.5 m kerb (the 0.08 m
  panes alone let the player walk through; four cells with the door shut are now sealed, as meant).
- Light: the hall was 0.7-0.9 under eight 650 W strips (with ~40 strip lamps round the level, half dead): now one kind of square ceiling
  panel as downward spots (two lit in the hall, about one per room or corridor corner), red beacons (30 W), exit signs and rack LEDs glow
  only, and a cold area fill so dead rooms are dim, not black. Ambient 0.033, probes median 0.034, 90 % 0.14, 99 % 0.37, brightest
  0.81 (beside the control-island screens).
- Check: 85.7 % walkable; check_ways 0 narrow, 4 sealed (the cells whose glass door is shut, meant); check_reach 99.0 %, 5 slivers
  of 1.0-1.1 m2 against outer walls. 1.4 MB hgm.

## Round after build 23: "less rusty" (all eight maps rebuilt, re-baked, exported; geometry, collision and lights unchanged)
Nearly every wall and prop carried orange rust: the shared `metal` picture (art/proof/tex/metal_painted.png, dusted) was blue paint eaten by
orange rust and `rust` was rust all over. Both are now painted by script in `tools/blender/ash_paint.py`, called by every make_<map>.py at the
end of make_pictures (`ash_paint.repaint(PICS, save_image, dust, TEXDIR, prefix, '<map>')`):
- `metal` = painted metal in the map's own colour (PALETTE: yard faded green-grey, depot blue-grey, street dull cream, subway institutional
  green, outpost olive drab, mall warm taupe, carnival faded teal, lab clean pale grey) with grime runs (dark, not orange), panel seams, chips
  down to grey primer and dark steel, and rust only as specks in the deepest chips (0.2-1.2 %).
- `rust` = old bare steel (dark, mottled, streaked) with brown rust patches on a part of it (lab 7 %, depot 10 %, mall 12 %, outpost 15 %,
  subway 16 %, yard 17 %, street and carnival 20 %). Rust colour is a brown (0.34, 0.245, 0.18), not orange.
- Rust is now an accent on box cars, wrecks, girders and drums; walls stay brick, concrete, plaster and painted metal.
- Gotcha: the four later maps (outpost, mall, carnival, lab) and yard, street, subway all write `art/ashfall/tex/street_*.png`; each map's
  export reads them from disk, so build and export one map before building the next (the palette differs per map).
- Checks after the rebuild (same as before the round): coplanar 0 pairs on all eight; check_reach rings 12/12 (street 10/12, the same two the
  game moves); check_ways 0 narrow everywhere; ambient unchanged. The yard is exported with hg_export directly (export-art.mjs yard would also run
  art/proof/yard): `blender -b art/ashfall/yard.blend -P tools/blender/hg_export.py -- <abs path>/art/ashfall/yard.export.json`.
- Before/after pictures were taken with ashfall-shot.mjs from a fixed spot (`P.x=4; P.z=4; P.yaw=..`): the game's own start spot is random.
- Numbers after the rebuild (triangles / hgm): yard 22,266 / 2.0 MB; depot 20,544 / 1.5 MB; street 36,150 / 2.7 MB; subway 9,062 / 950 KB;
  outpost 53,930 / 4.1 MB; mall 44,856 / 3.1 MB; carnival 26,498 / 2.3 MB; lab 16,886 / 1.4 MB. check_ways: street's own check reports the middle
  closed (the fountain) and 7/12 ring spots reached directly (unchanged geometry; check_reach finds room for 10/12 within 2.5 m, as before).
