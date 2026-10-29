// ===================== Test hook (used by automated tests; harmless for players) =====================

function simSnapshot() {
    const s = [player.x, player.y, player.vx, player.vy, player.grounded ? 1 : 0, player.coyoteTimer,
               player.jumpBufferTimer, player.grav, player.keys, player.bounced ? 1 : 0, player.groundKind,
               player.groundIdx, player.inZone ? 1 : 0, keys.jump ? 1 : 0, levelTick];
    for (let i = 0; i < crumbles.length; i++) s.push(crumbles[i].state, crumbles[i].timer);
    for (let i = 0; i < doorGroups.length; i++) s.push(doorGroups[i][0].active ? 1 : 0);
    for (let i = 0; i < keyItems.length; i++) s.push(keyItems[i].taken ? 1 : 0);
    return s;
}

function simRestore(s) {
    player.x = s[0]; player.y = s[1]; player.vx = s[2]; player.vy = s[3]; player.grounded = s[4] === 1;
    player.coyoteTimer = s[5]; player.jumpBufferTimer = s[6]; player.grav = s[7]; player.keys = s[8];
    player.bounced = s[9] === 1; player.groundKind = s[10]; player.groundIdx = s[11]; player.inZone = s[12] === 1;
    keys.jump = s[13] === 1; levelTick = s[14];
    let k = 15;
    for (let i = 0; i < crumbles.length; i++) { crumbles[i].state = s[k++]; crumbles[i].timer = s[k++]; crumbles[i].active = crumbles[i].state !== 2; }
    for (let i = 0; i < doorGroups.length; i++) { const a = s[k++] === 1; for (let j = 0; j < doorGroups[i].length; j++) doorGroups[i][j].active = a; }
    for (let i = 0; i < keyItems.length; i++) keyItems[i].taken = s[k++] === 1;
    setMoversAt(levelTick);
    updateSaws();
}

function simStep(l, r, j) {
    keys.left = !!l;
    keys.right = !!r;
    if (j && !keys.jump) player.jumpBufferTimer = 8;
    keys.jump = !!j;
    return updatePhysics();
}

// Test playback inside the real game loop: actions are 0-5 (none/left/right, +3 = jump held), k frames each
let autoplay = null;
function runAutoplay() {
    const ap = autoplay;
    if (ap.level !== currentLevel || ap.mode !== playMode || levelTick === 0 && ap.i > 0) { autoplay = null; return; }
    const idx = Math.floor(ap.i / ap.k);
    ap.i++;
    if (idx >= ap.actions.length) { keys.left = keys.right = keys.jump = false; if (idx > ap.actions.length + 60) autoplay = null; return; }
    const a = ap.actions[idx], dir = a % 3, j = a >= 3;
    keys.left = dir === 1;
    keys.right = dir === 2;
    if (j && !keys.jump) player.jumpBufferTimer = 8;
    keys.jump = j;
}

window.__spikes = {
    version: GAME_VERSION,
    TILE: TILE, ROWS: ROWS, TILE_CHARS: TILE_CHARS,
    info: () => ({ gameState, playMode, currentLevel, totalDeaths, customDeaths, levelTick, levelW, levelName,
                   player: { x: player.x, y: player.y, vx: player.vx, vy: player.vy, grav: player.grav, keys: player.keys, grounded: player.grounded },
                   goal: { x: goal.x, y: goal.y }, counts: { platforms: platforms.length, spikes: spikes.length, movers: movers.length,
                   saws: saws.length, keys: keyItems.length, crumbles: crumbles.length, doors: doorGroups.length, zones: zoneRects.length } }),
    handLevels: () => HAND_LEVELS.map(d => ({ name: d.name, hint: d.hint || '', rows: d.rows.slice() })),
    simBegin: (spec) => {
        simMode = true;
        if (typeof spec === 'number') loadCampaignLevel(spec);
        else { const p = parseRows(spec); buildTileLevel(p.w, p.grid); }
        return { w: gridW, levelW: levelW, start: { x: player.x, y: player.y }, goal: { x: goal.x, y: goal.y, w: goal.w, h: goal.h } };
    },
    simEnd: () => { simMode = false; keys.left = keys.right = keys.jump = false; },
    snap: simSnapshot,
    restore: simRestore,
    step: simStep,
    player: () => player,
    keyItems: () => keyItems.map(k => ({ x: k.x, y: k.y, taken: k.taken })),
    setPhys: (o) => { if (o && o.speed) MAX_SPEED = o.speed; if (o && o.jump) JUMP_FORCE = o.jump; },
    encode: encodeLevel,
    decode: decodeLevel,
    goto: (n) => startCampaign(n, false, false),
    autoplay: (actions, k) => { autoplay = { actions: actions, k: k || 4, i: 0, level: currentLevel, mode: playMode }; },
    autoplayActive: () => !!autoplay,
    // draws a whole tile level into one image (for checking layouts); returns a PNG data URL
    overview: (spec) => {
        const was = simMode;
        simMode = true;
        if (typeof spec === 'number') loadCampaignLevel(spec); else { const p = parseRows(spec); buildTileLevel(p.w, p.grid); }
        simMode = was;
        const oldW = canvas.width, oldCam = camera.x, oldState = gameState;
        canvas.width = Math.max(960, levelW);
        camera.x = 0;
        bgGradient = null;
        gameState = 'DEAD';   // (hides the player and banner)
        draw();
        const url = canvas.toDataURL('image/png');
        canvas.width = oldW;
        camera.x = oldCam;
        bgGradient = null;
        gameState = oldState;
        draw();
        return url;
    },
    progress: () => JSON.parse(JSON.stringify(progress)),
    customs: () => customLevels.map(l => Object.assign({}, l)),
    editor: () => ({ w: editor.w, name: editor.name, tool: editor.tool, unsaved: editor.unsaved, verified: editor.verified, id: editor.id,
                     camX: editor.camX, rows: Array.from({ length: ROWS }, (_, y) => editor.grid.slice(y * editor.w, (y + 1) * editor.w).join('')) })
};


loadSaves();
refreshMenu();
generateLevel(1);
draw();
