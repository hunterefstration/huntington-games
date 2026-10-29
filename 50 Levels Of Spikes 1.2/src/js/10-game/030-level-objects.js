// ===================== Level objects =====================

function resetLevelObjects() {
    platforms = [];
    spikes = [];
    movers = [];
    saws = [];
    keyItems = [];
    crumbles = [];
    doorGroups = [];
    zoneRects = [];
    zoneGrid = null;
    gridW = 0;
    levelW = 0;
    levelTick = 0;
    levelHasKeys = false;
    clearParticles();
}

function makePlat(x, y, w, h, type) {
    const p = { x: x, y: y, w: w, h: h, type: type, active: true, idx: platforms.length,
                state: 0, timer: 0, group: -1, faceUp: true, faceDown: false };
    platforms.push(p);
    if (type === T_CRUMBLE) crumbles.push(p);
    return p;
}

// Spike hitboxes are a bit smaller than the drawn triangle (same as the original game)
function makeSpike(x, y, dir) {
    const w = dir >= 2 ? 20 : 24, h = dir >= 2 ? 24 : 20;
    const s = { x: x, y: y, w: w, h: h, dir: dir, hx: 0, hy: 0, hw: w - 8, hh: h - 8 };
    if (dir === 0) { s.hx = x + 4; s.hy = y + 8; }
    else if (dir === 1) { s.hx = x + 4; s.hy = y; }
    else if (dir === 2) { s.hx = x + 8; s.hy = y + 4; }
    else { s.hx = x; s.hy = y + 4; }
    spikes.push(s);
    return s;
}

function bucketIndex(x) {
    const b = Math.floor((x + BUCKET_ORIGIN) / BUCKET);
    return b < 0 ? 0 : (b >= nBuckets ? nBuckets - 1 : b);
}

function buildBuckets() {
    let maxX = levelW;
    for (let i = 0; i < platforms.length; i++) maxX = Math.max(maxX, platforms[i].x + platforms[i].w);
    for (let i = 0; i < spikes.length; i++) maxX = Math.max(maxX, spikes[i].x + spikes[i].w);
    nBuckets = Math.floor((maxX + BUCKET_ORIGIN) / BUCKET) + 2;
    platBuckets = [];
    spikeBuckets = [];
    for (let i = 0; i < nBuckets; i++) { platBuckets.push([]); spikeBuckets.push([]); }
    for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        for (let b = bucketIndex(p.x), e = bucketIndex(p.x + p.w); b <= e; b++) platBuckets[b].push(p);
    }
    for (let i = 0; i < spikes.length; i++) {
        const s = spikes[i];
        for (let b = bucketIndex(s.hx), e = bucketIndex(s.hx + s.hw); b <= e; b++) spikeBuckets[b].push(s);
    }
}

function resetPlayer(x, y) {
    player.x = x;
    player.y = y;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;
    player.coyoteTimer = 0;
    player.jumpBufferTimer = 0;
    player.grav = 1;
    player.keys = 0;
    player.bounced = false;
    player.groundKind = 0;
    player.groundIdx = -1;
    player.inZone = false;
}


function generateLevel(levelNum) {
    resetLevelObjects();
    levelName = '';
    levelHint = '';

    const segments = 4 + Math.floor(levelNum * 0.7);
    const minGap = 20 + (levelNum * 1.5);
    const maxGap = Math.min(220, 80 + (levelNum * 3));
    const platformMinWidth = Math.max(30, 150 - (levelNum * 2.5));
    const platformMaxWidth = Math.max(80, 250 - (levelNum * 3));
    const spikeChance = Math.min(0.85, 0.1 + (levelNum * 0.015));

    let curX = 0;
    let curY = 400;
    makePlat(-100, curY, 300, 400, T_SOLID);
    curX = 200;


    for (let i = 0; i < segments; i++) {
        let gapX = minGap + Math.random() * (maxGap - minGap);
        let heightVariation = (Math.random() * 160) - 80;
        let nextY = curY + heightVariation;
        if (nextY < 150) nextY = 150 + Math.random() * 50;
        if (nextY > 480) nextY = 480 - Math.random() * 50;
        let pWidth = platformMinWidth + Math.random() * (platformMaxWidth - platformMinWidth);
        curX += gapX;
        makePlat(curX, nextY, pWidth, 600, T_SOLID);
        if (Math.random() < spikeChance) {
            let maxSpikes = Math.floor((pWidth - 20) / 25);
            if (maxSpikes > 0) {
                let numSpikes = 1 + Math.floor(Math.random() * Math.min(maxSpikes, Math.ceil(levelNum/8)));
                let clusterWidth = numSpikes * 24;
                let maxOffset = pWidth - clusterWidth - 10;
                let startOffset = 5 + (Math.random() * maxOffset);
                for(let s = 0; s < numSpikes; s++) {
                    makeSpike(curX + startOffset + (s * 24), nextY - 20, 0);
                }
            }
        }
        curX += pWidth;
        curY = nextY;
    }
    curX += (60 + Math.random() * 60);
    makePlat(curX, curY, 200, 600, T_SOLID);
    goal.x = curX + 80;
    goal.y = curY - goal.h;
    resetPlayer(50, 300);
    camera.x = 0;
    buildBuckets();
    updateHud();
}


// ---------- Tile levels (hand-built levels, editor levels, share codes) ----------

function parseRows(rows) {
    let w = 0;
    for (let i = 0; i < rows.length; i++) w = Math.max(w, rows[i].length);
    const grid = new Array(w * ROWS);
    const pad = ROWS - rows.length;
    for (let y = 0; y < ROWS; y++) {
        const r = y < pad ? '' : rows[y - pad];
        for (let x = 0; x < w; x++) {
            const ch = x < r.length ? r[x] : '.';
            grid[y * w + x] = TILE_CHARS.indexOf(ch) >= 0 ? ch : '.';
        }
    }
    return { w: w, grid: grid };
}

function tileAt(grid, w, x, y) {
    return (x < 0 || y < 0 || x >= w || y >= ROWS) ? '' : grid[y * w + x];
}
function isPlayerSolid(ch) {
    return ch === '#' || ch === 'C' || ch === 'D' || ch === 'B' || ch === '{' || ch === '}';
}
// Moving platforms turn around at blocks, spikes, stoppers (x) and the level edges
function isMoverBlock(ch) {
    return isPlayerSolid(ch) || ch === 'x' || ch === '^' || ch === 'v' || ch === '<' || ch === '>';
}

// Greedy rectangles of one tile type (rows merged when the run is identical). Returns tile units.
function tileRects(grid, w, ch) {
    const out = [];
    let open = {};
    for (let y = 0; y < ROWS; y++) {
        const next = {};
        let x = 0;
        while (x < w) {
            if (grid[y * w + x] !== ch) { x++; continue; }
            let x1 = x;
            while (x1 < w && grid[y * w + x1] === ch) x1++;
            const k = x + ':' + x1;
            if (open[k]) { open[k].y1 = y + 1; next[k] = open[k]; }
            else { const r = { x0: x, x1: x1, y0: y, y1: y + 1 }; out.push(r); next[k] = r; }
            x = x1;
        }
        open = next;
    }
    return out;
}

// Travel range of a moving platform run [x0, x1) on row y. axis 0 = sideways, 1 = up/down.
function moverRange(grid, w, x0, x1, y, axis) {
    const runW = (x1 - x0) * TILE;
    if (axis === 0) {
        let lo = x0, hi = x1;
        while (lo > 0 && !isMoverBlock(tileAt(grid, w, lo - 1, y))) lo--;
        while (hi < w && !isMoverBlock(tileAt(grid, w, hi, y))) hi++;
        return { min: lo * TILE, max: hi * TILE - runW, start: x0 * TILE };
    }
    // the platform's top stops flush with the top of the highest / lowest free row
    let minY = 0, maxY = (ROWS - 1) * TILE;
    for (let c = x0; c < x1; c++) {
        let r = y;
        while (r > 0 && !isMoverBlock(tileAt(grid, w, c, r - 1))) r--;
        // keep a tile of headroom under real blocks so a rider is never squashed
        const top = r * TILE + (r > 0 && isPlayerSolid(tileAt(grid, w, c, r - 1)) ? TILE : 0);
        let r2 = y;
        while (r2 < ROWS - 1 && !isMoverBlock(tileAt(grid, w, c, r2 + 1))) r2++;
        const bottom = r2 * TILE;
        if (top > minY) minY = top;
        if (bottom < maxY) maxY = bottom;
    }
    if (maxY < minY) maxY = minY;
    const start = Math.min(maxY, Math.max(minY, y * TILE));
    return { min: minY, max: maxY, start: start };
}

function buildTileLevel(w, grid) {
    resetLevelObjects();
    gridW = w;
    levelW = w * TILE;
    zoneGrid = new Uint8Array(w * ROWS);
    let hasZone = false;
    let sx = 1, sy = ROWS - 4, gx = w - 3, gy = ROWS - 4;

    const solids = tileRects(grid, w, '#');
    for (let i = 0; i < solids.length; i++) {
        const r = solids[i];
        makePlat(r.x0 * TILE, r.y0 * TILE, (r.x1 - r.x0) * TILE, (r.y1 - r.y0) * TILE, T_SOLID);
    }
    const doorTiles = {};
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < w; x++) {
            const ch = grid[y * w + x];
            const px = x * TILE, py = y * TILE;
            switch (ch) {
                case 'C': makePlat(px, py, TILE, TILE, T_CRUMBLE); break;
                case 'D': doorTiles[y * w + x] = makePlat(px, py, TILE, TILE, T_DOOR); break;
                case 'B': {
                    const p = makePlat(px, py, TILE, TILE, T_BOUNCE);
                    p.faceUp = !isPlayerSolid(tileAt(grid, w, x, y - 1));
                    p.faceDown = !isPlayerSolid(tileAt(grid, w, x, y + 1));
                    break;
                }
                case '^': makeSpike(px + 3, py + 10, 0); break;
                case 'v': makeSpike(px + 3, py, 1); break;
                case '<': makeSpike(px + 10, py + 3, 2); break;
                case '>': makeSpike(px, py + 3, 3); break;
                case 'K': keyItems.push({ x: px + 6, y: py + 4, w: 18, h: 22, taken: false }); break;
                case 'O': saws.push({ orbit: false, px: px + 15, py: py + 15, cx: px + 15, cy: py + 15, dir: 1, a0: 0 }); break;
                case 'R': saws.push({ orbit: true, px: px + 15, py: py + 15, cx: px + 15 + ORBIT_R, cy: py + 15, dir: 1, a0: 0 }); break;
                case 'r': saws.push({ orbit: true, px: px + 15, py: py + 15, cx: px + 15 - ORBIT_R, cy: py + 15, dir: -1, a0: Math.PI }); break;
                case 'g': zoneGrid[y * w + x] = 1; hasZone = true; break;
                case 'S': sx = x; sy = y; break;
                case 'G': gx = x; gy = y; break;
            }
        }
    }
    // conveyor belts and moving platforms: horizontal runs of the same tile
    for (let y = 0; y < ROWS; y++) {
        let x = 0;
        while (x < w) {
            const ch = grid[y * w + x];
            if (ch !== '{' && ch !== '}' && ch !== '-' && ch !== '|') { x++; continue; }
            let x1 = x;
            while (x1 < w && grid[y * w + x1] === ch) x1++;
            if (ch === '{' || ch === '}') {
                makePlat(x * TILE, y * TILE, (x1 - x) * TILE, TILE, ch === '{' ? T_CONV_L : T_CONV_R);
            } else {
                const axis = ch === '-' ? 0 : 1;
                const rg = moverRange(grid, w, x, x1, y, axis);
                const m = { axis: axis, x: x * TILE, y: y * TILE, w: (x1 - x) * TILE,
                            min: rg.min, max: rg.max, travel: Math.max(0, rg.max - rg.min),
                            off: 0, speed: axis === 0 ? MOVER_SPEED_X : MOVER_SPEED_Y,
                            px: 0, py: 0, dx: 0, dy: 0 };
                if (axis === 0) m.off = rg.start - rg.min;
                else { m.off = rg.max - rg.start; m.y = rg.start; }
                movers.push(m);
            }
            x = x1;
        }
    }
    // doors: every group of touching door tiles opens together
    for (const k in doorTiles) {
        const first = doorTiles[k];
        if (first.group >= 0) continue;
        const gi = doorGroups.length, list = [], stack = [+k];
        first.group = gi;
        while (stack.length) {
            const idx = stack.pop();
            list.push(doorTiles[idx]);
            const tx = idx % w, ty = Math.floor(idx / w);
            const nb = [tx > 0 ? idx - 1 : -1, tx < w - 1 ? idx + 1 : -1, ty > 0 ? idx - w : -1, ty < ROWS - 1 ? idx + w : -1];
            for (let n = 0; n < 4; n++) {
                const d = nb[n] >= 0 ? doorTiles[nb[n]] : null;
                if (d && d.group < 0) { d.group = gi; stack.push(nb[n]); }
            }
        }
        doorGroups.push(list);
    }
    if (hasZone) zoneRects = tileRects(grid, w, 'g');
    else zoneGrid = null;
    levelHasKeys = keyItems.length > 0;

    goal.x = gx * TILE - 5;
    goal.y = gy * TILE + TILE - goal.h;
    resetPlayer(sx * TILE + 3, sy * TILE + TILE - player.h);
    if (zoneGrid) player.inZone = zoneGrid[sy * w + sx] === 1;
    setMoversAt(0);
    updateSaws();
    buildBuckets();
    camera.x = clampCam(player.x - canvas.width / 3);
}

function clampCam(x) {
    if (x < 0) x = 0;
    if (levelW > 0 && x > levelW - canvas.width) x = Math.max(0, levelW - canvas.width);
    return x;
}

function moverPos(m, tick) {
    if (m.travel <= 0) return 0;
    const span = m.travel * 2;
    const ph = (m.off + m.speed * tick) % span;
    return ph <= m.travel ? ph : span - ph;
}

function setMoversAt(tick) {
    for (let i = 0; i < movers.length; i++) {
        const m = movers[i];
        const d0 = moverPos(m, tick > 0 ? tick - 1 : 0), d1 = moverPos(m, tick);
        if (m.axis === 0) { m.px = m.min + d0; m.x = m.min + d1; m.py = m.y; }
        else { m.py = m.max - d0; m.y = m.max - d1; m.px = m.x; }
        m.dx = m.x - m.px;
        m.dy = m.y - m.py;
    }
}

function updateMovers() {
    for (let i = 0; i < movers.length; i++) {
        const m = movers[i];
        m.px = m.x; m.py = m.y;
        const d = moverPos(m, levelTick);
        if (m.axis === 0) m.x = m.min + d; else m.y = m.max - d;
        m.dx = m.x - m.px;
        m.dy = m.y - m.py;
    }
}

function updateSaws() {
    for (let i = 0; i < saws.length; i++) {
        const s = saws[i];
        if (!s.orbit) continue;
        const a = s.a0 + s.dir * levelTick * ORBIT_SPEED;
        s.cx = s.px + Math.cos(a) * ORBIT_R;
        s.cy = s.py + Math.sin(a) * ORBIT_R;
    }
}

function overlapsPlayer(r) {
    return player.x < r.x + r.w && player.x + player.w > r.x && player.y < r.y + r.h && player.y + player.h > r.y;
}

function updateCrumbles() {
    for (let i = 0; i < crumbles.length; i++) {
        const c = crumbles[i];
        if (c.state === 1) {
            if (--c.timer <= 0) {
                c.state = 2; c.active = false; c.timer = CRUMBLE_GONE;
                createParticles(c.x + 15, c.y + 15, 10, '#fb923c');
            }
        } else if (c.state === 2) {
            if (--c.timer <= 0) {
                if (overlapsPlayer(c)) c.timer = 10;
                else { c.state = 0; c.active = true; }
            }
        }
    }
}

function openDoor(p) {
    if (player.od) { player.od[p.group] = 1; player.keys--; return; }     // a bot opens it only for itself
    const grp = doorGroups[p.group];
    for (let i = 0; i < grp.length; i++) grp[i].active = false;
    player.keys--;
    updateKeyHud();
    createParticles(p.x + 15, p.y + 15, 20, '#facc15');
}


function loadCampaignLevel(n) {
    const def = (n > GENERATED_LEVELS && n <= MAX_LEVELS) ? HAND_LEVELS[n - GENERATED_LEVELS - 1] : null;
    if (def) {
        const parsed = parseRows(def.rows);
        buildTileLevel(parsed.w, parsed.grid);
        levelName = 'Level ' + n + ': ' + def.name;
        levelHint = def.hint || '';
        bannerTimer = levelHint ? 330 : 180;
        bannerY = bannerTarget();
        updateHud();
    } else {
        generateLevel(n);
        bannerTimer = 0;
    }
    if (!simMode) noteLevelReached(n);
}

function loadCustomLevel() {
    buildTileLevel(customLevel.w, customLevel.grid);
    levelName = customLevel.name;
    levelHint = '';
    bannerTimer = 150;
    bannerY = bannerTarget();
    updateHud();
}

function updateHud() {
    if (simMode) return;
    if (playMode === 'campaign') {
        levelDisplay.textContent = isEndless ? `Level: ${currentLevel}` : `Level: ${currentLevel}/${MAX_LEVELS}`;
        deathDisplay.textContent = `Deaths: ${totalDeaths}`;
        let modeText = "";
        if (isOneLife) modeText = "ONE LIFE";
        if (isEndless) modeText = modeText ? "ONE LIFE ENDLESS" : "ENDLESS";
        modeDisplay.textContent = modeText;
    } else {
        const nm = customLevel ? customLevel.name : '';
        levelDisplay.textContent = (playMode === 'test' ? 'Testing: ' : '') + (nm.length > 18 ? nm.slice(0, 17) + '…' : nm);
        deathDisplay.textContent = `Deaths: ${customDeaths}`;
        modeDisplay.textContent = playMode === 'test' ? 'EDITOR TEST' : 'CUSTOM';
    }
    updateKeyHud();
}

function updateKeyHud() {
    if (simMode) return;
    keyDisplay.classList.toggle('hidden', !levelHasKeys);
    if (levelHasKeys) keyDisplay.textContent = `Keys: ${player.keys}`;
}


