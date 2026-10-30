// ==========================================
// PEOPLE: the villagers you meet, drawn from the feet up (origin = between their feet). face = 1 right, -1 left.
// They breathe, blink, and bob when they talk. Everyone carries a lantern that went dark.
// ==========================================
function personBase(x, t, face, speaking) {
    const br = Math.sin(t * 2.2) * 0.8, bob = speaking ? Math.abs(Math.sin(t * 14)) * 1.6 : 0;
    x.scale(face < 0 ? -1 : 1, 1); x.translate(0, -bob);
    return { br, blink: (t * 0.7) % 4 > 3.85 };
}
function eyesP(x, ex, ey, blink, col = '#1a1020') {
    x.fillStyle = col;
    for (const dx of [-3.2, 3.2]) { if (blink) x.fillRect(ex + dx - 1.6, ey, 3.2, 1); else { x.beginPath(); x.ellipse(ex + dx, ey, 1.5, 2, 0, 0, 7); x.fill(); } }
}
function darkLantern(x, lx, ly) {
    x.strokeStyle = '#2a2420'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(lx, ly - 9); x.lineTo(lx, ly - 13); x.stroke();
    x.fillStyle = '#3a3230'; x.fillRect(lx - 4, ly - 9, 8, 10); x.fillStyle = 'rgba(120,110,140,.5)'; x.fillRect(lx - 2.5, ly - 7, 5, 6);
}
const PEOPLE = {
    // Old Bram: big, red knit cap, white beard, green woodsman's coat
    bram(x, t, face = 1, speaking = false) {
        const { br, blink } = personBase(x, t, face, speaking);
        x.fillStyle = '#3a2618'; x.fillRect(-9, -8, 7, 8); x.fillRect(2, -8, 7, 8);                      // boots
        x.fillStyle = '#3f6a3a'; x.beginPath(); x.ellipse(0, -20, 14, 15 + br * 0.5, 0, 0, 7); x.fill();          // coat
        x.fillStyle = '#2c4a28'; x.fillRect(-14, -18, 28, 4);                                              // belt
        x.fillStyle = '#c99a6a'; x.beginPath(); x.arc(0, -37, 10, 0, 7); x.fill();                        // face
        x.fillStyle = '#f2efe8'; x.beginPath(); x.moveTo(-10, -37); x.quadraticCurveTo(-11, -20, 0, -18 - (speaking ? Math.abs(Math.sin(t * 14)) * 2 : 0)); x.quadraticCurveTo(11, -20, 10, -37); x.quadraticCurveTo(0, -31, -10, -37); x.fill();   // beard
        x.fillStyle = '#c4423a'; x.beginPath(); x.ellipse(0, -44, 11, 7, 0, Math.PI, 0); x.fill(); x.fillRect(-11, -45, 22, 3);
        x.beginPath(); x.arc(9, -50, 3, 0, 7); x.fill();                                                   // cap + bobble
        eyesP(x, 1, -39, blink); x.fillStyle = '#e0a080'; x.beginPath(); x.arc(4, -36, 2.2, 0, 7); x.fill();       // nose
        darkLantern(x, -16, -12);
    },
    // Pip: small, big head, green hoodie, scarf, freckles
    pip(x, t, face = 1, speaking = false) {
        const { br, blink } = personBase(x, t, face, speaking);
        x.fillStyle = '#2a2a3a'; x.fillRect(-6, -7, 4, 7); x.fillRect(2, -7, 4, 7);
        x.fillStyle = '#4f9a5a'; x.beginPath(); x.ellipse(0, -14, 9, 9 + br * 0.4, 0, 0, 7); x.fill();
        x.fillStyle = '#e8b048'; x.fillRect(-9, -21, 18, 4); x.beginPath(); x.moveTo(-7, -19); x.lineTo(-12 - Math.sin(t * 3) * 2, -10); x.lineTo(-8, -10); x.fill();    // scarf
        x.fillStyle = '#f0c8a0'; x.beginPath(); x.arc(0, -30, 10, 0, 7); x.fill();
        x.fillStyle = '#7a4a2a'; x.beginPath(); x.ellipse(0, -36, 11, 6, 0, Math.PI, 0); x.fill(); x.beginPath(); x.moveTo(-2, -41); x.quadraticCurveTo(4, -48, 6, -40); x.fill();   // hair + tuft
        eyesP(x, 1.5, -31, blink); x.fillStyle = '#d88a6a'; for (const dx of [-3, 0, 6]) x.fillRect(dx, -27, 1.2, 1.2);   // freckles
        if (speaking) { x.fillStyle = '#5a2a2a'; x.beginPath(); x.ellipse(2, -25, 2, 1.5 + Math.abs(Math.sin(t * 14)), 0, 0, 7); x.fill(); }
    },
    // Marta: miner's helmet with a dead lamp, orange overalls, pickaxe
    marta(x, t, face = 1, speaking = false) {
        const { br, blink } = personBase(x, t, face, speaking);
        x.fillStyle = '#2a1e18'; x.fillRect(-8, -8, 6, 8); x.fillRect(2, -8, 6, 8);
        x.fillStyle = '#d8762a'; x.beginPath(); x.roundRect ? x.roundRect(-10, -30, 20, 24, 6) : x.rect(-10, -30, 20, 24); x.fill();
        x.fillStyle = '#b85a1a'; x.fillRect(-6, -30, 3, 10); x.fillRect(3, -30, 3, 10);
        x.fillStyle = '#7a4e34'; x.beginPath(); x.arc(0, -38, 9.5, 0, 7); x.fill();
        x.fillStyle = '#2a1a14'; x.beginPath(); x.ellipse(-6, -36, 4, 7, 0, 0, 7); x.fill();               // braid
        x.fillStyle = '#e8c23a'; x.beginPath(); x.ellipse(0, -44, 11, 7, 0, Math.PI, 0); x.fill(); x.fillRect(-12, -45, 24, 2.5);
        x.fillStyle = '#555'; x.beginPath(); x.arc(5, -48, 2.6, 0, 7); x.fill();                             // the dead lamp
        eyesP(x, 1.5, -39, blink, '#120a08');
        x.strokeStyle = '#6a4a2a'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(12, -6); x.lineTo(15, -32); x.stroke();
        x.strokeStyle = '#9aa0aa'; x.lineWidth = 3; x.beginPath(); x.moveTo(8, -30); x.quadraticCurveTo(15, -36, 22, -30); x.stroke();      // pickaxe
    },
    // Sister Ilse: tall, hooded white-and-lilac robe, gold trim, a staff with a dark lamp
    ilse(x, t, face = 1, speaking = false) {
        const { br, blink } = personBase(x, t, face, speaking);
        const g = x.createLinearGradient(0, -50, 0, 0); g.addColorStop(0, '#f4eefc'); g.addColorStop(1, '#b8a8d8');
        x.fillStyle = g; x.beginPath(); x.moveTo(-6, -44); x.quadraticCurveTo(-15, -20, -14, 0); x.lineTo(14, 0); x.quadraticCurveTo(15, -20, 6, -44); x.fill();
        x.fillStyle = '#e8c86a'; x.fillRect(-13, -3, 26, 2.5); x.fillRect(-1.2, -40, 2.4, 38);
        x.fillStyle = '#d8b898'; x.beginPath(); x.arc(0, -45 + br * 0.3, 7.5, 0, 7); x.fill();
        x.fillStyle = '#f4eefc'; x.beginPath(); x.arc(0, -47, 10, Math.PI * 0.85, Math.PI * 2.15); x.lineTo(7, -38); x.lineTo(-7, -38); x.fill();   // hood
        eyesP(x, 1.5, -45, blink);
        x.strokeStyle = '#8a6a3a'; x.lineWidth = 2; x.beginPath(); x.moveTo(-15, 0); x.lineTo(-15, -50); x.stroke();
        darkLantern(x, -15, -48);
    },
    // Hob: wide, bald, sooty, leather apron, big hammer
    hob(x, t, face = 1, speaking = false) {
        const { br, blink } = personBase(x, t, face, speaking);
        x.fillStyle = '#2a1a14'; x.fillRect(-10, -8, 8, 8); x.fillRect(2, -8, 8, 8);
        x.fillStyle = '#a86a4a'; x.beginPath(); x.ellipse(0, -22, 16, 15 + br * 0.5, 0, 0, 7); x.fill();          // body
        x.fillStyle = '#5a3a24'; x.beginPath(); x.roundRect ? x.roundRect(-10, -30, 20, 26, 4) : x.rect(-10, -30, 20, 26); x.fill();    // apron
        x.fillStyle = '#a86a4a'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 16, -22, 5, 9, s * 0.2, 0, 7); x.fill(); }   // arms
        x.fillStyle = '#b87858'; x.beginPath(); x.arc(0, -40, 9, 0, 7); x.fill();
        x.fillStyle = 'rgba(30,20,20,.35)'; x.beginPath(); x.arc(-4, -36, 3, 0, 7); x.fill(); x.beginPath(); x.arc(5, -43, 2, 0, 7); x.fill();   // soot
        x.fillStyle = '#3a2418'; x.fillRect(-7, -35, 14, 3);                                                // moustache
        eyesP(x, 1, -42, blink);
        x.fillStyle = '#5a4a40'; x.fillRect(18, -26, 3, 20); x.fillStyle = '#7a7a84'; x.fillRect(13, -30, 13, 7);   // hammer
    },
    // Orin, the Lamplighter, as he was: tall hat, long coat, a lamplighter's pole; drawn in light
    orin(x, t, face = 1, speaking = false) {
        const { br, blink } = personBase(x, t, face, speaking);
        x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.85;
        x.fillStyle = '#ffe6a8'; x.beginPath(); x.moveTo(-8, -42); x.quadraticCurveTo(-13, -18, -12, 0); x.lineTo(12, 0); x.quadraticCurveTo(13, -18, 8, -42); x.fill();
        x.fillStyle = '#fff6d8'; x.beginPath(); x.arc(0, -47 + br * 0.3, 8, 0, 7); x.fill();
        x.fillStyle = '#ffeab8'; x.fillRect(-7, -64, 14, 14); x.fillRect(-11, -52, 22, 3);
        x.fillStyle = '#fffbe6'; x.beginPath(); x.moveTo(-7, -46); x.quadraticCurveTo(0, -30, 7, -46); x.fill();
        x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; eyesP(x, 1.5, -48, blink, '#a07040');
        x.strokeStyle = '#ffe6a8'; x.lineWidth = 2; x.beginPath(); x.moveTo(15, 0); x.lineTo(15, -66); x.stroke();
    },
    // Tamsin (1.2): a mapmaker: green scarf, big satchel, a rolled map and a pencil behind her ear
    tam(x, t, face = 1, speaking = false) {
        const { br, blink } = personBase(x, t, face, speaking);
        x.fillStyle = '#3a2a22'; x.fillRect(-8, -8, 6, 8); x.fillRect(2, -8, 6, 8);
        x.fillStyle = '#5a7a68'; x.beginPath(); x.ellipse(0, -19, 11, 13 + br * 0.4, 0, 0, 7); x.fill();
        x.fillStyle = '#9a6a3a'; x.fillRect(-12, -22, 7, 12); x.fillStyle = '#6a4424'; x.fillRect(-12, -22, 7, 3);                       // satchel
        x.fillStyle = '#e8d8a8'; x.save(); x.translate(10, -22); x.rotate(-0.5); x.fillRect(-2, -10, 4, 20); x.restore();             // rolled map
        x.fillStyle = '#e0b890'; x.beginPath(); x.arc(0, -36, 9.5, 0, 7); x.fill();
        x.fillStyle = '#3a2418'; x.beginPath(); x.ellipse(0, -41, 11, 7, 0, Math.PI, 0); x.fill(); x.fillRect(-11, -42, 4, 12);      // hair
        x.fillStyle = '#7ad0b0'; x.fillRect(-9, -29, 18, 4);                                                                         // scarf
        x.fillStyle = '#d8c040'; x.fillRect(6, -43, 1.6, 8);                                                                         // pencil
        eyesP(x, 1.5, -37, blink);
        if (speaking) { x.fillStyle = '#6a2a2a'; x.beginPath(); x.ellipse(2, -32, 2, 1.5 + Math.abs(Math.sin(t * 14)), 0, 0, 7); x.fill(); }
        darkLantern(x, -16, -10);
    },
    // Quill (1.2): the librarian: round glasses, a long lilac robe, a stack of books
    quill(x, t, face = 1, speaking = false) {
        const { br, blink } = personBase(x, t, face, speaking);
        x.fillStyle = '#2a2230'; x.fillRect(-7, -6, 5, 6); x.fillRect(2, -6, 5, 6);
        x.fillStyle = '#7a5aa8'; x.beginPath(); x.moveTo(-12, -4); x.lineTo(-8, -34 - br); x.lineTo(8, -34 - br); x.lineTo(12, -4); x.closePath(); x.fill();
        x.fillStyle = '#5a3a86'; x.fillRect(-1, -32, 2, 28);
        x.fillStyle = '#c04a3a'; x.fillRect(5, -22, 11, 4); x.fillStyle = '#3a6a9a'; x.fillRect(6, -26, 10, 4); x.fillStyle = '#e0c060'; x.fillRect(5, -30, 11, 4);   // books
        x.fillStyle = '#f0d4b0'; x.beginPath(); x.arc(0, -41, 9, 0, 7); x.fill();
        x.fillStyle = '#d8d0e0'; x.beginPath(); x.ellipse(0, -46, 10, 6, 0, Math.PI, 0); x.fill();                                   // white hair
        x.strokeStyle = '#3a3040'; x.lineWidth = 1.2; for (const dx of [-3.4, 3.4]) { x.beginPath(); x.arc(dx + 1, -41, 3.4, 0, 7); x.stroke(); }
        eyesP(x, 1.5, -41, blink);
        if (speaking) { x.fillStyle = '#6a2a2a'; x.beginPath(); x.ellipse(1.5, -36, 2, 1.2 + Math.abs(Math.sin(t * 14)), 0, 0, 7); x.fill(); }
        darkLantern(x, -16, -12);
    }
};
