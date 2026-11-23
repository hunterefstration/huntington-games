# ASHFALL maps: the painted-metal and old-steel pictures, one palette per map (round after build 23: "less rusty").
# The old `metal` picture was blue paint eaten by orange rust and `rust` was rust all over; nearly every wall and prop carried orange.
# Now `metal` is painted metal (each map its own colour) with grime streaks and chips down to grey primer and dark steel, with only
# specks of rust in the deepest chips; `rust` is old bare steel (dark, mottled, streaked) with rust as patches on a part of it.
# Each make_<map>.py calls repaint() right after its own pictures:  import ash_paint; ash_paint.repaint(PICS, save_image, dust, TEXDIR, 'street_', 'yard')
import numpy as np

def pn(N, cx, cy, seed, oct=3):
    """periodic value noise with cx cells across and cy cells down (wraps, so tiles repeat seamlessly); 0..1"""
    out = np.zeros((N, N), np.float32); amp = 1.0; tot = 0.0
    for o in range(oct):
        nx, ny = max(2, int(cx * 2 ** o)), max(2, int(cy * 2 ** o)); g = np.random.default_rng(seed * 31 + o).random((ny, nx)).astype(np.float32)
        u = np.arange(N, dtype=np.float32) * nx / N; i0 = np.floor(u).astype(int); fu = u - i0; fu = fu * fu * (3 - 2 * fu); i1 = (i0 + 1) % nx
        v = np.arange(N, dtype=np.float32) * ny / N; j0 = np.floor(v).astype(int); fv = v - j0; fv = fv * fv * (3 - 2 * fv); j1 = (j0 + 1) % ny
        a = g[j0][:, i0] * (1 - fu)[None, :] + g[j0][:, i1] * fu[None, :]; b = g[j1][:, i0] * (1 - fu)[None, :] + g[j1][:, i1] * fu[None, :]
        out += amp * (a * (1 - fv)[:, None] + b * fv[:, None]); tot += amp; amp *= 0.5
    return out / tot

RUST = np.array((0.34, 0.245, 0.18), np.float32)        # a brown rust, not orange
PRIMER = np.array((0.42, 0.42, 0.40), np.float32); STEEL = np.array((0.23, 0.23, 0.24), np.float32)

def painted_metal(N, base, seed, chips=0.08, rust=0.01, seams=True):
    b = np.array(base, np.float32)
    low = pn(N, 2, 2, seed); mid = pn(N, 9, 9, seed + 1); fine = pn(N, 80, 80, seed + 2, 2); streak = pn(N, 40, 2, seed + 3, 2)
    a = b * (0.86 + 0.24 * low[..., None]) * (0.95 + 0.1 * fine[..., None])
    g = a.mean(2, keepdims=True); f = (0.15 * low)[..., None]; a = a * (1 - f) + g * 1.08 * f                 # sun-faded toward chalky grey in places
    gs = np.clip((streak - 0.55) * 3.0, 0, 1) * (0.5 + 0.5 * mid); a *= (1 - 0.2 * gs)[..., None]             # grime runs (dark, not orange)
    cn = pn(N, 22, 22, seed + 5, 3) * 0.75 + fine * 0.25; th = np.quantile(cn, 1 - chips)
    edge = (cn > th - 0.025) & (cn <= th); chip = cn > th
    a[edge] *= 0.78
    m = (0.5 + 0.5 * fine)[..., None]; bare = PRIMER * m + STEEL * (1 - m); a[chip] = bare[chip]
    if rust > 0: rs = cn > np.quantile(cn, 1 - rust); a[rs] = (RUST * (0.75 + 0.4 * fine[..., None]))[rs]
    if seams:                                                                                                  # panel seams every half tile
        for c in (0, N // 2):
            a[:, max(0, c - 2):c + 2] *= 0.72
            for r in range(N // 16, N, N // 8): a[max(0, r - 2):r + 2, c + 5:c + 9] *= 0.6
    return np.clip(a, 0.04, 1)

def old_steel(N, seed, base=(0.31, 0.30, 0.29), rust=0.22):
    b = np.array(base, np.float32)
    low = pn(N, 3, 3, seed); mid = pn(N, 10, 10, seed + 1); fine = pn(N, 90, 90, seed + 2, 2); streak = pn(N, 36, 2, seed + 3, 2)
    a = b * (0.78 + 0.36 * low[..., None]) * (0.9 + 0.2 * fine[..., None])
    gs = np.clip((streak - 0.5) * 2.5, 0, 1) * (0.4 + 0.6 * mid); a *= (1 - 0.25 * gs)[..., None]
    rn = pn(N, 11, 11, seed + 7, 3) * 0.65 + mid * 0.25 + fine * 0.1; th = np.quantile(rn, 1 - rust)
    m = np.clip((rn - th) / 0.035, 0, 1)[..., None]; rc = RUST * (0.7 + 0.45 * mid[..., None]) * (0.9 + 0.2 * fine[..., None])
    a = a * (1 - m) + rc * m
    run = np.clip((streak - 0.6) * 3, 0, 1)[..., None] * np.clip((rn - th + 0.08) / 0.08, 0, 1)[..., None] * 0.35       # a little rust run below the patches
    a = a * (1 - run) + rc * run
    pits = fine > np.quantile(fine, 0.985); a[pits] *= 0.6
    return np.clip(a, 0.04, 1)

# per map: painted metal colour, its chips and rust specks; old steel's tone and how much of it is rust
PALETTE = {
    'yard':     dict(metal=(0.39, 0.42, 0.39), chips=0.09, specks=0.010, steel=(0.31, 0.30, 0.29), rust=0.17),   # faded rail-yard green-grey
    'depot':    dict(metal=(0.36, 0.41, 0.47), chips=0.08, specks=0.008, steel=(0.27, 0.27, 0.28), rust=0.10),   # warehouse blue-grey
    'street':   dict(metal=(0.50, 0.48, 0.42), chips=0.10, specks=0.012, steel=(0.27, 0.26, 0.26), rust=0.20),   # dull cream (cars, signs, bins)
    'subway':   dict(metal=(0.40, 0.48, 0.42), chips=0.10, specks=0.010, steel=(0.29, 0.29, 0.29), rust=0.16),   # institutional green
    'outpost':  dict(metal=(0.36, 0.38, 0.27), chips=0.07, specks=0.008, steel=(0.30, 0.29, 0.27), rust=0.15),   # olive drab
    'mall':     dict(metal=(0.52, 0.48, 0.42), chips=0.06, specks=0.006, steel=(0.32, 0.31, 0.30), rust=0.12),   # warm taupe
    'carnival': dict(metal=(0.30, 0.44, 0.45), chips=0.12, specks=0.010, steel=(0.29, 0.28, 0.28), rust=0.20),   # faded fairground teal
    'lab':      dict(metal=(0.60, 0.62, 0.63), chips=0.03, specks=0.002, steel=(0.34, 0.35, 0.36), rust=0.07),   # clean pale grey
}

def repaint(PICS, save_image, dust, texdir, prefix, name, N=1024):
    P = PALETTE[name]
    PICS['metal'] = save_image(dust(painted_metal(N, P['metal'], 11, P['chips'], P['specks']), 0.3, 35), prefix + 'metal', texdir)
    PICS['rust'] = save_image(dust(old_steel(N, 13, P['steel'], P['rust']), 0.28, 28), prefix + 'rust', texdir)
    return PICS
