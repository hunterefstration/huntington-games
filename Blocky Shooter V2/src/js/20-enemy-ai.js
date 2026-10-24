// ---------- ENEMY AI ----------
const lvlDmg = () => (1 + (playerStats.level - 1) * 0.05) * DIFF().dmg;


// ---------- WHO CAN ENEMIES GO AFTER? (you, plus other players in multiplayer) ----------
const _localTarget = { id: 0, pos: null, feet: 0, local: true, alive: true };
let _aiT = _localTarget;                 // the player the enemy being updated is going after
function aiTargets() {
    _localTarget.id = NET.id; _localTarget.pos = camera.position; _localTarget.feet = feetY; _localTarget.alive = currentHp > 0 && !NET.dead;
    return NET.inGame ? netAiTargets(_localTarget) : [_localTarget];
}
function pickAITarget(u, enemy, T, dt) {
    if (T.length === 1) return T[0];
    if ((u.tgtT = (u.tgtT || 0) - dt) > 0 && u.tgt && u.tgt.alive && T.includes(u.tgt)) return u.tgt;
    u.tgtT = 0.6 + Math.random() * 0.3;
    let best = u.tgt && u.tgt.alive && T.includes(u.tgt) ? u.tgt : null, bd = best ? Math.hypot(best.pos.x - enemy.position.x, best.pos.z - enemy.position.z) * 0.75 : 1e9;
    for (const t of T) { if (!t.alive) continue; const d = Math.hypot(t.pos.x - enemy.position.x, t.pos.z - enemy.position.z); if (d < bd) { bd = d; best = t; } }
    return (u.tgt = best || T[0]);
}
// hurt a player (you -> straight away, someone else -> send it to their computer). kb = knockback [x, up, z]
function hurtTarget(tp, amount, fromPos, kb, by) {
    if (!tp || !tp.alive) return;
    if (tp.local) {
        takeDamage(amount, fromPos, by);
        if (kb) { push.x += kb[0]; push.z += kb[2]; if (kb[1]) { velocity.y = Math.max(velocity.y, kb[1]); onGround = false; } }
    } else netSendDamage(tp.id, amount, fromPos, kb, by);
}
function meleeHit(u, cfg, enemy, mult = 1, kb) {
    if (u.attackCooldown > 0) return;
    hurtTarget(_aiT, cfg.damage * lvlDmg() * mult * (u.rage > 0 ? 1.25 : 1), enemy.position, kb, cfg.name.startsWith('The ') ? 'the' + cfg.name.slice(3) : 'a ' + cfg.name);
    u.attackCooldown = cfg.id === 'charger' ? 2.6 : 1.3; u.armSwing = 0.3;
}
function slam(pos, radius, dmg, color, by = 'a ground slam') {
    spawnBlastFx(pos, radius, color, true, 0.5);
    spawnParticles(new V3(pos.x, pos.y + 0.2, pos.z), 0x9ca3af, 12, 6, 0.7, 0.3, true, { grav: 6, drag: 2, jitter: radius * 0.5 });
    sfx('slam');
    if (NET.inGame) netSendFx('slam', pos, radius, color);
    const d = Math.hypot(camera.position.x - pos.x, camera.position.z - pos.z);
    shake = Math.max(shake, clamp(0.8 - d / 25, 0, 0.6));
    for (const t of aiTargets()) {
        const dt = Math.hypot(t.pos.x - pos.x, t.pos.z - pos.z);
        if (!t.alive || dt >= radius || Math.abs(t.feet - pos.y) >= 2.2) continue;
        const k = 10 / (dt || 1);
        hurtTarget(t, dmg * (1 - 0.5 * dt / radius), pos, [(t.pos.x - pos.x) * k, 10, (t.pos.z - pos.z) * k], by);
    }
}
