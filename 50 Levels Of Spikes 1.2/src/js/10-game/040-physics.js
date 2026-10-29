// ===================== Physics =====================

function checkCollision(r1, r2) {
    return r1.x < r2.x + r2.w &&
           r1.x + r1.w > r2.x &&
           r1.y < r2.y + r2.h &&
           r1.y + r1.h > r2.y;
}

function collideX(dx) {
    if (dx === 0) return;
    const b0 = bucketIndex(player.x), b1 = bucketIndex(player.x + player.w);
    for (let b = b0; b <= b1; b++) {
        const list = platBuckets[b];
        for (let i = 0; i < list.length; i++) {
            const p = list[i];
            if (!p.active || (player.od && player.od[p.group]) || !overlapsPlayer(p)) continue;
            if (p.type === T_DOOR && player.keys > 0) { openDoor(p); continue; }
            if (dx > 0) player.x = p.x - player.w;
            else player.x = p.x + p.w;
            player.vx = 0;
        }
    }
}

function collideY() {
    const b0 = bucketIndex(player.x), b1 = bucketIndex(player.x + player.w);
    for (let b = b0; b <= b1; b++) {
        const list = platBuckets[b];
        for (let i = 0; i < list.length; i++) {
            const p = list[i];
            if (!p.active || (player.od && player.od[p.group]) || !overlapsPlayer(p)) continue;
            if (p.type === T_DOOR && player.keys > 0) { openDoor(p); continue; }
            if (player.vy > 0) {
                player.y = p.y - player.h;
                player.vy = 0;
                if (player.grav > 0) { player.grounded = true; player.groundKind = 1; player.groundIdx = p.idx; }
            } else if (player.vy < 0) {
                player.y = p.y + p.h;
                player.vy = 0;
                if (player.grav < 0) { player.grounded = true; player.groundKind = 1; player.groundIdx = p.idx; }
            }
        }
    }
}

// Moving platforms are one-way: you land on them from above (from below when gravity is flipped)
function landOnMovers(prevY) {
    const g = player.grav;
    for (let i = 0; i < movers.length; i++) {
        const m = movers[i];
        if (player.x + player.w <= m.x || player.x >= m.x + m.w) continue;
        if (g > 0) {
            if (player.vy < 0) continue;
            if (player.y + player.h > m.y && prevY + player.h <= Math.max(m.y, m.py) + 0.5) {
                player.y = m.y - player.h;
                player.vy = 0;
                player.grounded = true; player.groundKind = 2; player.groundIdx = i;
            }
        } else {
            if (player.vy > 0) continue;
            const mb = m.y + MOVER_H;
            if (player.y < mb && prevY >= Math.min(m.y, m.py) + MOVER_H - 0.5) {
                player.y = mb;
                player.vy = 0;
                player.grounded = true; player.groundKind = 2; player.groundIdx = i;
            }
        }
    }
}

// Whatever is under your feet: crumbling blocks start to shake, bounce pads launch you
function feetScan() {
    const g = player.grav;
    const feet = g > 0 ? player.y + player.h : player.y;
    let pad = null;
    const b0 = bucketIndex(player.x), b1 = bucketIndex(player.x + player.w);
    for (let b = b0; b <= b1; b++) {
        const list = platBuckets[b];
        for (let i = 0; i < list.length; i++) {
            const p = list[i];
            if (!p.active || (p.type !== T_CRUMBLE && p.type !== T_BOUNCE)) continue;
            if (player.x >= p.x + p.w || player.x + player.w <= p.x) continue;
            const face = g > 0 ? p.y : p.y + p.h;
            if (Math.abs(face - feet) > 0.5) continue;
            if (p.type === T_CRUMBLE) {
                if (p.state === 0) { p.state = 1; p.timer = CRUMBLE_SHAKE; }
            } else pad = p;
        }
    }
    if (pad) {
        player.vy = BOUNCE_FORCE * g;
        player.bounced = true;
        player.grounded = false;
        player.groundKind = 0;
        player.groundIdx = -1;
        player.jumpBufferTimer = 0;
        player.coyoteTimer = 0;
        pad.timer = 10;
        createParticles(player.x + player.w / 2, feet, 8, '#a3e635');
    }
}

function checkZones() {
    const cx = Math.floor((player.x + player.w / 2) / TILE);
    const cy = Math.floor((player.y + player.h / 2) / TILE);
    const inZ = cx >= 0 && cx < gridW && cy >= 0 && cy < ROWS && zoneGrid[cy * gridW + cx] === 1;
    if (inZ && !player.inZone) {
        player.grav = -player.grav;
        player.vy *= 0.5;
        player.grounded = false;
        player.groundKind = 0;
        player.coyoteTimer = 0;
        player.bounced = false;
        createParticles(player.x + player.w / 2, player.y + player.h / 2, 12, '#c084fc');
    }
    player.inZone = inZ;
}


// One fixed 60Hz step. Returns 0 = keep playing, 1 = died, 2 = reached the goal.
function updatePhysics() { worldStep(); return bodyStep(); }
// the world moves once a frame; bodyStep moves whoever `player` is (in multiplayer the bots take turns being it)
function worldStep() {
    levelTick++;
    if (movers.length) updateMovers();
    if (saws.length) updateSaws();
    if (crumbles.length) updateCrumbles();
}
function bodyStep() {
    let carryX = 0;
    if (player.groundKind === 2) {
        const m = movers[player.groundIdx];
        carryX = m.dx;
        player.y += m.dy;
    } else if (player.groundKind === 1) {
        const gp = platforms[player.groundIdx];
        if (gp.active) {
            if (gp.type === T_CONV_L) carryX = -CONVEYOR_SPEED;
            else if (gp.type === T_CONV_R) carryX = CONVEYOR_SPEED;
        }
    }

    if (keys.left) player.vx -= ACCELERATION;
    else if (keys.right) player.vx += ACCELERATION;
    else player.vx *= FRICTION;


    if (player.vx > MAX_SPEED) player.vx = MAX_SPEED;
    if (player.vx < -MAX_SPEED) player.vx = -MAX_SPEED;
    if (Math.abs(player.vx) < 0.1) player.vx = 0;


    const dx = player.vx + carryX;
    player.x += dx;
    if (levelW > 0) {
        if (player.x < 0) { player.x = 0; if (player.vx < 0) player.vx = 0; }
        else if (player.x > levelW - player.w) { player.x = levelW - player.w; if (player.vx > 0) player.vx = 0; }
    }
    collideX(dx);


    player.vy += GRAVITY * player.grav;
    if (player.vy * player.grav > TERMINAL_VELOCITY) player.vy = TERMINAL_VELOCITY * player.grav;
    const prevY = player.y;
    player.y += player.vy;

    player.grounded = false;
    player.groundKind = 0;
    player.groundIdx = -1;
    collideY();
    if (movers.length) landOnMovers(prevY);
    if (player.grounded) feetScan();


    if (player.grounded) player.coyoteTimer = 6;
    else player.coyoteTimer--;


    if (player.jumpBufferTimer > 0) player.jumpBufferTimer--;


    if (player.jumpBufferTimer > 0 && player.coyoteTimer > 0) {
        player.vy = JUMP_FORCE * player.grav;
        player.jumpBufferTimer = 0;
        player.coyoteTimer = 0;
        player.grounded = false;
        player.groundKind = 0;
        player.bounced = false;
        createParticles(player.x + player.w/2, player.grav > 0 ? player.y + player.h : player.y, 5, '#cbd5e1');
    }


    if (player.bounced) {
        if (player.vy * player.grav >= 0) player.bounced = false;
    } else if (!keys.jump && player.vy * player.grav < -4) player.vy *= 0.6;

    if (zoneGrid) checkZones();
    if (player.y > canvas.height + 100 || player.y < -400 || (player.grav < 0 && player.y < -100 - player.h)) return 1;


    const hx = player.x + 3, hw = player.w - 6, hh = player.h - 3;
    const hy = player.grav > 0 ? player.y + 3 : player.y;
    const sb0 = bucketIndex(hx), sb1 = bucketIndex(hx + hw);
    for (let b = sb0; b <= sb1; b++) {
        const list = spikeBuckets[b];
        for (let i = 0; i < list.length; i++) {
            const s = list[i];
            if (hx < s.hx + s.hw && hx + hw > s.hx && hy < s.hy + s.hh && hy + hh > s.hy) return 1;
        }
    }
    for (let i = 0; i < saws.length; i++) {
        const s = saws[i];
        const nx = s.cx < hx ? hx : (s.cx > hx + hw ? hx + hw : s.cx);
        const ny = s.cy < hy ? hy : (s.cy > hy + hh ? hy + hh : s.cy);
        const ddx = s.cx - nx, ddy = s.cy - ny;
        if (ddx * ddx + ddy * ddy < SAW_HIT_R * SAW_HIT_R) return 1;
    }
    for (let i = 0; i < keyItems.length; i++) {
        const k = keyItems[i];
        const tk = player.tk;           // a bot keeps its own list of keys, so it does not take yours
        if (!(tk ? tk[i] : k.taken) && overlapsPlayer(k)) {
            if (tk) tk[i] = 1; else k.taken = true;
            player.keys++;
            if (!tk) updateKeyHud();
            createParticles(k.x + 9, k.y + 11, 16, '#facc15');
        }
    }
    if (checkCollision(player, goal)) return 2;


    if (!player.tk) { const targetCamX = clampCam(player.x - canvas.width / 3); camera.x += (targetCamX - camera.x) * 0.1; }
    return 0;
}


// ===================== Game flow =====================

function hideAllScreens() {
    for (let i = 0; i < ALL_SCREENS.length; i++) ALL_SCREENS[i].classList.add('hidden');
}

function enterPlay() {
    hideAllScreens();
    editorBar.classList.add('hidden');
    hud.classList.remove('hidden');
    pauseBtn.classList.remove('hidden');
    keys.left = keys.right = keys.jump = false;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    gameState = 'PLAYING';
    ensureLoop();
}

function startCampaign(level, oneLife, endless) {
    playMode = 'campaign';
    currentLevel = level;
    totalDeaths = 0;
    isOneLife = oneLife;
    isEndless = endless;
    loadCampaignLevel(currentLevel);
    enterPlay();
}

function startGame() {
    startCampaign(1, oneLifeToggle.checked, endlessToggle.checked);
}

function continueGame() {
    const lv = Math.max(1, Math.min(MAX_LEVELS, progress.unlocked));
    if (oneLifeToggle.checked) {
        // One Life runs always start at Level 1, so say so instead of quietly dropping the checkbox
        showModal({ title: 'One Life is ticked', text: 'One Life runs always start at Level 1. Continue from Level ' + lv + ' in normal mode, or start a One Life run?', buttons: [
            { label: 'Continue Level ' + lv, action: () => startCampaign(lv, false, endlessToggle.checked) },
            { label: 'One Life from Level 1', cls: 'btn-red', action: () => startCampaign(1, true, endlessToggle.checked) },
            { label: 'Cancel', cls: 'btn-grey' }] });
        return;
    }
    startCampaign(lv, false, endlessToggle.checked);
}


// The game has opinions about how you died. Roasts get meaner the more times you die on the same level; never the same
// one twice in a row. {n} = deaths on this level, {lv} = the level.
const INSULTS = {
    first: [
        "You hit a spike. A stationary spike. It did not move.",
        "Bold strategy. Let's see if it works next time.",
        "The spike thanks you for your contribution.",
        "Gravity: 1. You: 0.",
        "That was a jump in the sense that you left the ground.",
        "Have you tried not touching the pointy things?",
        "Even the tutorial is embarrassed for you.",
        "Somewhere, a spike is telling its friends about you.",
        "That spike has been there the whole time, you know.",
        "Your keyboard did nothing wrong.",
        "Speedrun to the death screen: new personal best.",
        "Was that a plan, or more of a vibe?",
        "Level {lv} would like to see your ID. It does not believe you are a gamer.",
        "The void said hi. You said hi back. Too enthusiastically.",
        "That landing was more of a suggestion.",
        "Spikes: famously hard to see. Wait, no, they are bright red.",
        "You died so fast the music did not notice.",
        "Hint: the floor is the part without spikes.",
        "That spike has a 100% win rate against you. Respect it.",
        "You jumped like the floor owed you money.",
        "Bold of you to assume the spike would move.",
        "The level designer is laughing. So is the spike.",
        "Fun fact: spikes are pointy. Now you know.",
        "You were doing so well. For about a second.",
        "Your reaction time is buffering.",
        "Did you blink? You blinked.",
        "Nice try. Well. A try.",
        "Gravity checked your homework and found errors.",
        "That was a speedrun, just in the wrong direction.",
        "Your cube has left the chat.",
        "Plot armor not included.",
        "Skill issue detected. Scanning for skill... none found.",
        "That jump had main character energy and side character results."
    ],
    again: [
        "Death {n}. The spikes are starting a fan club.",
        "{n} deaths. You are not learning, you are collecting.",
        "Same spike, same result. Science!",
        "The definition of insanity is right here, {n} times.",
        "At this point the spike should pay rent for living in your head.",
        "{n} tries. Have you considered a different hobby? Knitting has fewer spikes.",
        "Your character has filed a complaint.",
        "This level is not hard. You are just very consistent.",
        "You have died more times than a phone battery.",
        "Respawning is not a strategy. Well, technically it is. A bad one.",
        "{n} deaths on level {lv}. Legendary. Not in a good way.",
        "The spikes are getting bored of winning.",
        "Somewhere a speedrunner felt that and winced.",
        "Plot twist: the spike was the main character all along.",
        "Your reflexes called. They are on vacation.",
        "Bro really said 'what if I jump INTO it this time'.",
        "Do you want the level to just move the spikes for you?",
        "Achievement unlocked: Spike Magnet.",
        "Death {n}. Your character is now on a first-name basis with that spike.",
        "{n} times. The spike has started charging you admission.",
        "You keep coming back. The spikes call it loyalty.",
        "Your deaths have their own leaderboard now. You're winning it.",
        "Have you tried jumping a little bit earlier? Or later? Or at all?",
        "Level {lv} has seen things. Mostly you, dying.",
        "At this rate you'll clear it by graduation.",
        "{n} deaths. Your keyboard is filing for emotional damages.",
        "The spikes are taking notes. On how to beat you faster.",
        "Respawn speedrun: going great. Actual level: not so much.",
        "That spike is not even trying anymore.",
        "Somebody get this player a map. And a helmet.",
        "Plan B was also bad. Try plan C.",
        "{n} deaths and the goal is still right there. Waiting. Patiently.",
        "You're not stuck. You're just exploring every way to fail."
    ],
    many: [
        "{n} deaths. I'm not mad, I'm just disappointed.",
        "Death number {n}. Even the void is asking you to stop visiting.",
        "{n}. I have run out of jokes. You have not run out of ways to die.",
        "Are you okay? Blink twice if the spikes are holding you hostage.",
        "Level {lv} is now legally your landlord.",
        "{n} deaths. That is not a skill issue, that is a skill crisis.",
        "The spikes have unionized. They want you to keep going. You are their only work.",
        "Fun fact: {n} is also how many times the game thought about quitting on you.",
        "At {n} deaths, you are basically part of the level design.",
        "I would say 'so close', but I have seen the replay.",
        "You know you can stop, right? ...Fine. Try again.",
        "{n} deaths. The game would like to remind you it is free and you are choosing this.",
        "{n} deaths. The spikes have built you a little memorial.",
        "Your death count is higher than your grade in this class.",
        "{n}. The game is considering a restraining order.",
        "I've seen bots with more hope than this.",
        "Death {n}. The level is now legally a part of your daily routine.",
        "{n} deaths. Teachers have finished grading faster than this.",
        "The spike has retired. Its son took over. You died to him too.",
        "Your future kids will hear about level {lv}.",
        "{n} deaths. Scientists want to study you.",
        "Even the loading screen feels bad for you.",
        "Honestly? Iconic. {n} deaths and still going.",
        "The goal has moved on emotionally. You have not.",
        "{n} deaths: that's not a number, that's a lifestyle.",
        "You are now the reason they add an Easy Mode.",
        "The spikes have started cheering for you. Out of pity."
    ]
};
let insultLevelKey = '', insultDeaths = 0, lastInsult = '';
function deathInsult() {
    const key = playMode + ':' + (playMode === 'campaign' ? currentLevel : (customLevel ? customLevel.name : ''));
    if (key !== insultLevelKey) { insultLevelKey = key; insultDeaths = 0; }
    insultDeaths++;
    const pool = insultDeaths <= 1 ? INSULTS.first : insultDeaths <= 6 ? INSULTS.again : INSULTS.many;
    let line = lastInsult;
    for (let i = 0; i < 8 && line === lastInsult; i++) line = pool[Math.floor(Math.random() * pool.length)];
    lastInsult = line;
    return line.replace(/\{n\}/g, insultDeaths).replace(/\{lv\}/g, playMode === 'campaign' ? currentLevel : 'this');
}

function triggerDeath() {
    gameState = 'DEAD';
    if (playMode === 'campaign') totalDeaths++; else customDeaths++;
    deathDisplay.textContent = `Deaths: ${playMode === 'campaign' ? totalDeaths : customDeaths}`;
    createParticles(player.x + player.w/2, player.y + player.h/2, 30, '#38bdf8');

    if (playMode === 'campaign' && isOneLife) {
        if (currentLevel - 1 > progress.bestOneLife) { progress.bestOneLife = currentLevel - 1; saveProgress(); }
        currentLevel = 1;
        document.getElementById('deathHeader').textContent = "LIFE LOST";
        document.getElementById('deathMessage').textContent = "One Life Mode: Progress reset to Level 1. " + deathInsult();
        document.getElementById('retryBtn').textContent = "Restart Journey";
    } else {
        document.getElementById('deathHeader').textContent = "You Died";
        document.getElementById('deathMessage').textContent = deathInsult();
        document.getElementById('retryBtn').textContent = "Try Again";
    }
    document.getElementById('deathBackBtn').textContent = backLabel();

    const token = ++deathToken;
    setTimeout(() => { if (gameState === 'DEAD' && token === deathToken) deathScreen.classList.remove('hidden'); }, 500);
}


function retryLevel() {
    if (gameState !== 'DEAD') return;
    deathScreen.classList.add('hidden');
    if (playMode === 'campaign') loadCampaignLevel(currentLevel);
    else loadCustomLevel();
    enterPlay();
}


function levelComplete() {
    createParticles(goal.x + goal.w/2, goal.y + goal.h/2, 50, '#10b981');

    if (playMode !== 'campaign') {
        gameState = 'CLEARED';
        if (playMode === 'test') markEditorVerified();
        document.getElementById('clearText').textContent =
            `"${customLevel.name}" cleared with ${customDeaths} death${customDeaths === 1 ? '' : 's'}.` +
            (playMode === 'test' ? ' Your level is now marked Verified.' : '');
        document.getElementById('clearBackBtn').textContent = backLabel();
        setTimeout(() => { if (gameState === 'CLEARED') { clearScreen.classList.remove('hidden'); pauseBtn.classList.add('hidden'); } }, 700);
        return;
    }

    if (!isEndless && currentLevel >= MAX_LEVELS) {
        gameState = 'VICTORY';
        let modeType = isOneLife ? "One Life" : "Normal";
        progress.beaten = true;
        if (isOneLife) progress.bestOneLife = MAX_LEVELS;
        saveProgress();
        document.getElementById('finalStats').textContent = `Total Deaths: ${totalDeaths} (${modeType})`;
        setTimeout(() => {
            victoryScreen.classList.remove('hidden');
            hud.classList.add('hidden');
            pauseBtn.classList.add('hidden');
        }, 1000);
    } else {
        currentLevel++;
        loadCampaignLevel(currentLevel);
    }
}


function resetGame() {
    showMainMenu();
}

function showMainMenu() {
    hideAllScreens();
    editorBar.classList.add('hidden');
    hud.classList.add('hidden');
    pauseBtn.classList.add('hidden');
    gameState = 'MENU';
    refreshMenu();
    startScreen.classList.remove('hidden');
    draw();
}

function backLabel() {
    return playMode === 'test' ? 'Back to Editor' : (playMode === 'custom' ? 'My Levels' : 'Main Menu');
}

// "Back" from the death / pause / clear screens
function goBack() {
    if (playMode === 'test') { reopenEditor(); return; }
    if (playMode === 'custom') { hideAllScreens(); hud.classList.add('hidden'); pauseBtn.classList.add('hidden'); gameState = 'MENU'; openCustomScreen(); return; }
    showMainMenu();
}

function pauseGame() {
    if (gameState !== 'PLAYING') return;
    gameState = 'PAUSED';
    keys.left = keys.right = keys.jump = false;
    document.getElementById('pauseBackBtn').textContent = backLabel();
    // restarting a One Life run would just re-roll the level, so it is not offered there
    document.getElementById('pauseRestartBtn').classList.toggle('hidden', playMode === 'campaign' && isOneLife);
    pauseScreen.classList.remove('hidden');
}

function resumeGame() {
    if (gameState !== 'PAUSED') return;
    pauseScreen.classList.add('hidden');
    enterPlay();
}

function restartFromPause() {
    if (gameState !== 'PAUSED') return;
    pauseScreen.classList.add('hidden');
    if (playMode === 'campaign') loadCampaignLevel(currentLevel);
    else loadCustomLevel();
    enterPlay();
}

function replayCustom() {
    if (gameState !== 'CLEARED' || !customLevel) return;
    customDeaths = 0;
    loadCustomLevel();
    enterPlay();
}


