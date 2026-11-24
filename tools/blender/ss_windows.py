# Steel Storm Remastered: the blind window bands (picture `window`, tiled every 3 m) drawn as panes instead of a near-black band:
#   blender -b art/steelstorm/<map>.blend -P tools/blender/ss_windows.py      (farmland, harbor, city), then node tools/export-art.mjs <map>
# Two by two panes a tile, a pale frame and glazing bars, dark blue-grey glass with a sky reflection that changes pane to pane, some panes
# blown out (black). Picture only: nothing else changes, no bake.
import bpy, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ss_mapkit as K
from hgkit import log, ptile

def window_px(N=512, seed=19):
    rng = np.random.default_rng(seed); y, x = np.mgrid[0:N, 0:N].astype(np.float32) / N
    n1 = ptile(N, 24, seed, 2); img = np.zeros((N, N, 3), np.float32)
    P = 2; px, py = np.floor(x * P).astype(int), np.floor(y * P).astype(int); fx, fy = x * P - px, y * P - py
    for i in range(P):
        for j in range(P):
            m = (px == i) & (py == j); k = rng.random()
            sky = np.array((0.30, 0.36, 0.42), np.float32) * (0.6 + 0.6 * k); glass = np.array((0.10, 0.12, 0.14), np.float32)
            refl = np.clip(fy * 1.2 - 0.15 + 0.25 * (fx - 0.5), 0, 1)[..., None]       # brighter towards the top: the sky in the glass
            c = glass + (sky - glass) * refl * (0.5 + 0.5 * k)
            if rng.random() < 0.25: c = c * 0.25                                        # blown out
            img[m] = (c * (0.9 + 0.2 * n1[..., None]))[m]
    frame = (np.minimum.reduce([fx, 1 - fx, fy, 1 - fy]) < 0.045); bar = (np.abs(fx - 0.5) < 0.015) | (np.abs(fy - 0.55) < 0.015)
    img[frame | bar] = np.array((0.42, 0.40, 0.36), np.float32) * (0.85 + 0.3 * n1[frame | bar][:, None])
    return np.clip(img, 0.02, 1)

im = bpy.data.images.get('window')
if im is None: log('no window picture here')
else:
    px = window_px(im.size[0] if im.size[0] else 512); N = px.shape[0]
    if tuple(im.size) != (N, N): im.scale(N, N)
    im.pixels.foreach_set(np.concatenate([px, np.ones((N, N, 1), np.float32)], 2).ravel())
    path = os.path.join(K.TEXDIR, 'window.png'); im.filepath_raw = path; im.file_format = 'PNG'; im.save(); im.filepath = '//tex/window.png'
    bpy.ops.wm.save_mainfile(); log('windows: saved', bpy.data.filepath, 'mean', px.reshape(-1, 3).mean(0).round(3))
