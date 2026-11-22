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
