# Repaint ONLY the eight Ashfall sky pictures (Ashfall/assets/<map>_sky.webp) at 2048x1024, sharper, same look.
# Same painter (ash_paint.night_sky) and parameters as each make_<map>.py, same encoding as hg_export.py
# (lin_to_srgb(sky / sky.range), webp quality 90); `range` is read from the map's .hgm, which is not rewritten.
# Run (background only):  blender -b --python tools/blender/sky_only.py -- [W=2048] [maps...]
#   (Blender: "C:/Program Files/Blender Foundation/Blender 4.5/blender.exe"). Optional env SKY_OUT=<dir> writes there instead.
import sys, os, json, struct
import numpy as np, bpy
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import ash_paint
A = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
W = next((int(a[2:]) for a in A if a.startswith('W=')), 2048); maps = [a for a in A if '=' not in a]          # Q=100: webp quality
OUT = os.environ.get('SKY_OUT') or os.path.join(ROOT, 'Ashfall', 'assets')
# the exact night_sky arguments of each map: (moon, sky kwargs); moon is normalised inside the painter's caller, so repeat that here
D = dict
MAPS = {
 'yard':    ((0.36, 0.79, 0.50), D(aurora=0.30)),
 'street':  ((-0.28, 0.80, 0.53), D(zen=(0.010, 0.006, 0.030), mid=(0.008, 0.006, 0.028), hor=(0.022, 0.012, 0.036), alo=(1.0, 0.25, 0.62), ahi=(0.42, 0.14, 0.9),
             a0=170.0, aurora=0.18, moon_col=(0.44, 0.41, 0.48), halo=(0.85, 0.7, 1.0), moon2=(0.55, -0.35, 0.76), glow2=(0.010, 0.020, 0.030))),
 'outpost': ((0.15, -0.45, 0.88), D(zen=(0.004, 0.007, 0.026), mid=(0.006, 0.011, 0.030), hor=(0.026, 0.028, 0.018), alo=(0.35, 1.0, 0.30), ahi=(1.0, 0.62, 0.18),
             a0=10.0, aurora=0.26, moon_col=(0.40, 0.44, 0.50), halo=(0.6, 0.8, 1.0), moon2=(-0.6, 0.5, 0.62), moon2_col=(0.6, 0.5, 0.35), glow2=(0.025, 0.015, 0.004))),
 'carnival': ((0.3, 0.62, 0.72), D(zen=(0.006, 0.010, 0.032), mid=(0.006, 0.016, 0.036), hor=(0.014, 0.045, 0.055), alo=(0.1, 0.9, 1.0), ahi=(1.0, 0.25, 0.7),
             a0=-15.0, aurora=0.30, moon_col=(0.40, 0.44, 0.48), halo=(0.55, 0.9, 1.0), moon2=(-0.35, 0.3, 0.89), moon2_col=(0.62, 0.40, 0.55), glow2=(0.030, 0.008, 0.025))),
 'depot':   ((0.3, 0.5, 0.81), D(aurora=0.2)),
 'mall':    ((-0.2, 0.3, 0.93), D(aurora=0.25)),
 'subway':  ((0.2, 0.4, 0.9), D(aurora=0.2)),
 'lab':     ((0.2, 0.4, 0.9), D(aurora=0.2)),
}
def hgm_range(name):
    b = open(os.path.join(ROOT, 'Ashfall', 'assets', name + '.hgm'), 'rb').read()
    n = struct.unpack('<I', b[4:8])[0]; return float(json.loads(b[8:8 + n])['sky']['range'])
def lin_to_srgb(a):
    a = np.clip(a, 0, 1); return np.where(a < 0.0031308, a * 12.92, 1.055 * np.power(a, 1 / 2.4) - 0.055)
for name in (maps or MAPS):
    moon, kw = MAPS[name]; m = np.array(moon, float); m /= np.linalg.norm(m)
    sky = ash_paint.night_sky(W, tuple(float(v) for v in m), **kw); rng = hgm_range(name); H = sky.shape[0]
    px = np.ones((H, W, 4), np.float32); px[:, :, :3] = np.clip(lin_to_srgb(sky / rng), 0, 1)       # row 0 = bottom, as Blender stores images
    im = bpy.data.images.new('hg_tmp_save', W, H, alpha=False, float_buffer=False); im.pixels.foreach_set(px.ravel())
    path = os.path.join(OUT, name + '_sky.webp'); im.filepath_raw = path; im.file_format = 'WEBP'
    try: im.save(quality=next((int(a[2:]) for a in A if a.startswith('Q=')), 100))          # 100: at 90 the dark aurora showed square blocks once the game brightens it
    except TypeError: im.save()
    bpy.data.images.remove(im); print('SKY', name, 'range', rng, W, 'x', H, os.path.getsize(path), 'bytes', flush=True)
