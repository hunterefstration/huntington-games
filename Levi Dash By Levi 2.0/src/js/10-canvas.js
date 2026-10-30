
   const canvas = document.getElementById('gameCanvas');
   const ctx = canvas.getContext('2d');
   const ui = document.getElementById('ui');
   const scoreList = document.getElementById('scoreList');
   const levelMsg = document.getElementById('levelMsg');


   canvas.width = 800;
   canvas.height = 400;
  
   let score = 0;
   let gameActive = true;
   let gameSpeed = 6.5;
   let frameCount = 0;
   let nextObstacleFrame = 0;
   let godMode = false;
   let enteringName = false;
   let goSnap = null; // frame under the game-over overlay, so typing redraws don't stack darkness
   let nameBuf = '';
  
   // Rotation Variables
   let rotation = 0;
   let targetRotation = 0;
  
   const stars = Array.from({ length: 50 }, () => ({
       x: Math.random() * canvas.width,
       y: Math.random() * 300,
       size: Math.random() * 2,
       speed: Math.random() * 0.5 + 0.1
   }));


   const particles = [];
  
   const player = {
       x: 80, y: 350, width: 32, height: 32, color: '#0ff',
       dy: 0, jumpForce: 14.5, gravity: 0.75, grounded: false,
       visualWidth: 32, visualHeight: 32
   };
  
   const obstacles = [];


   // Storage can throw (sandboxed iframe, blocked cookies) so never let it stop the game
   function loadScores() {
       try { return JSON.parse(localStorage.getItem('neonScores')) || []; } catch (e) { return []; }
   }

   function updateLeaderboardUI() {
       const scores = loadScores();
       scoreList.innerHTML = scores
           .map(s => `<div class="score-entry"><span>${s.name}</span><span>${Number(s.val).toLocaleString()}</span></div>`)
           .join('');
   }


   // World leaderboard (Neon Dash 2.1): everyone's best score, from the launcher's Grapevine account
   function hgAcct() { try { const L = window.parent && window.parent.HGGrapevine; return L && L.me && L.me() && L.eco ? L : null; } catch (e) { return null; } }
   function updateWorldUI() {
       const el = document.getElementById('worldList'), L = hgAcct(); if (!el) return;
       if (!L) { el.innerHTML = '<div class="score-entry"><span>Open in the launcher and sign in</span><span></span></div>'; return; }
       L.eco.lbGet('neon:best').then(m => {
           const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
           const rows = (m && m.rows || []).slice(0, 5).map(r => `<div class="score-entry${r.me ? ' me' : ''}"><span>${r.pos}. ${esc(r.n)}</span><span>${Number(r.s).toLocaleString()}</span></div>`);
           if (m && m.me && m.me.pos > 5) rows.push(`<div class="score-entry me"><span>${m.me.pos}. You</span><span>${Number(m.me.s).toLocaleString()}</span></div>`);
           el.innerHTML = rows.join('') || '<div class="score-entry"><span>No scores yet. Be first!</span><span></span></div>';
       }, () => {});
   }
   setTimeout(updateWorldUI, 1500);

   function saveScore(newName, newScore) {
       const L = hgAcct(); if (L && newScore > 0) { L.eco.lbSubmit('neon:best', newScore); setTimeout(updateWorldUI, 1200); }
       let scores = loadScores();
       scores.push({ name: newName, val: newScore });
       scores.sort((a, b) => b.val - a.val);
       try { localStorage.setItem('neonScores', JSON.stringify(scores.slice(0, 5))); } catch (e) {}
       updateLeaderboardUI();
   }


   window.addEventListener('keydown', (e) => {
       // Name entry after a crash (replaces the blocking prompt() box that froze the page)
       if (enteringName) {
           if (e.code === 'Enter') {
               saveScore(nameBuf || 'Player 1', score);
               enteringName = false;
           } else if (e.key === 'Backspace') {
               nameBuf = nameBuf.slice(0, -1);
           } else if (e.key.length === 1 && /[A-Za-z0-9 _-]/.test(e.key) && nameBuf.length < 12) {
               nameBuf += e.key;
           }
           e.preventDefault();
           drawGameOver();
           return;
       }
       if ((e.code === 'Space' || e.code === 'ArrowUp') && player.grounded && gameActive) {
           player.dy = -player.jumpForce;
           player.grounded = false;
          
           // Trigger 90 degree turn (PI / 2)
           targetRotation += Math.PI / 2;
          
           player.visualWidth = 24;
           player.visualHeight = 40;
       }
       if (e.key === 'c' || e.key === 'C') {
           score = 100000000000000000;
           player.color = '#ffd700';
           godMode = true;
           showLevelUp("LEGEND MODE");
       }
       if (!gameActive && e.code === 'Enter') restart();
   });


   function showLevelUp(text = "LEVEL UP!") {
       levelMsg.innerText = text;
       levelMsg.style.opacity = "1";
       setTimeout(() => { levelMsg.style.opacity = "0"; }, 1200);
   }


   function spawnObstacle() {
       if (frameCount > nextObstacleFrame) {
           const rand = Math.random();
           let type = 'single';
           let color = '#f0f';


           if (rand < 0.15) {
               type = 'triple';
               color = '#ffcc00';
           } else if (rand < 0.45) {
               type = 'double';
               color = '#ff0055';
           }
          
           const size = 32 + Math.random() * 8;
           obstacles.push({ x: canvas.width, width: size, height: size, color: color, type: type });


           let gapBase = type === 'triple' ? 180 : (type === 'double' ? 115 : 75);
           nextObstacleFrame = frameCount + (gapBase + Math.random() * 40) / (gameSpeed/6.5);
       }
   }


   function restart() {
       score = 0;
       obstacles.length = 0;
       particles.length = 0;
       gameSpeed = 6.5;
       player.color = '#0ff';
       player.y = 350;
       player.dy = 0;
       gameActive = true;
       godMode = false;
       rotation = 0;
       targetRotation = 0;
       frameCount = 0;
       nextObstacleFrame = 0;
       update();
   }


   function drawSpikeSet(o) {
       ctx.shadowColor = o.color;
       ctx.fillStyle = o.color;
       ctx.shadowBlur = 10;
      
       const count = o.type === 'triple' ? 3 : (o.type === 'double' ? 2 : 1);
       const spacing = o.width * 0.82;


       for (let i = 0; i < count; i++) {
           const curX = o.x + (i * spacing);
           ctx.beginPath();
           ctx.moveTo(curX, 380);
           ctx.lineTo(curX + o.width / 2, 380 - o.height);
           ctx.lineTo(curX + o.width, 380);
           ctx.closePath();
           ctx.fill();
       }
   }


   function update() {
       if (!gameActive) return;
       frameCount++;


       ctx.fillStyle = '#050510';
       ctx.fillRect(0, 0, canvas.width, canvas.height);


       ctx.fillStyle = '#fff';
       stars.forEach(s => {
           s.x -= s.speed * (gameSpeed / 5);
           if (s.x < 0) s.x = canvas.width;
           ctx.fillRect(s.x, s.y, s.size, s.size);
       });


       if (frameCount % 3 === 0) {
           particles.push({
               x: player.x,
               y: player.y + Math.random() * player.height,
               size: Math.random() * 4 + 2,
               life: 1.0,
               color: player.color
           });
       }


       particles.forEach((p, i) => {
           p.x -= gameSpeed * 0.5;
           p.life -= 0.02;
           ctx.globalAlpha = p.life;
           ctx.fillStyle = p.color;
           ctx.fillRect(p.x, p.y, p.size, p.size);
           if (p.life <= 0) particles.splice(i, 1);
       });
       ctx.globalAlpha = 1.0;


       player.dy += player.gravity;
       player.y += player.dy;
       player.visualWidth += (32 - player.visualWidth) * 0.2;
       player.visualHeight += (32 - player.visualHeight) * 0.2;


       if (player.y + player.height > 380) {
           if (!player.grounded) {
               player.visualWidth = 42;
               player.visualHeight = 22;
               // Snap to target rotation on landing to keep it clean
               rotation = targetRotation;
           }
           player.y = 380 - player.height;
           player.dy = 0;
           player.grounded = true;
       }


       // Draw Player with Rotation
       ctx.save();
       ctx.shadowBlur = 20;
       ctx.shadowColor = player.color;
       ctx.fillStyle = player.color;
      
       // Handle rotation math
       if (godMode) {
           rotation += 0.15;
       } else {
           // Smoothly interpolate to the next 90-degree increment
           rotation += (targetRotation - rotation) * 0.12;
       }


       // Move to player center, rotate, then draw
       ctx.translate(player.x + 16, player.y + 16);
       ctx.rotate(rotation);
       ctx.fillRect(-player.visualWidth/2, -player.visualHeight/2, player.visualWidth, player.visualHeight);
       ctx.restore();


       ctx.shadowBlur = 15;
       ctx.strokeStyle = '#0ff';
       ctx.lineWidth = 4;
       ctx.beginPath();
       ctx.moveTo(0, 382);
       ctx.lineTo(canvas.width, 382);
       ctx.stroke();


       spawnObstacle();


       for (let i = obstacles.length - 1; i >= 0; i--) {
           let o = obstacles[i];
           o.x -= gameSpeed;
           drawSpikeSet(o);


           const totalWidth = o.width + (o.type === 'triple' ? o.width * 1.64 : (o.type === 'double' ? o.width * 0.82 : 0));
           const hPadding = 10;
          
           if (player.x + player.width - hPadding > o.x &&
               player.x + hPadding < o.x + totalWidth &&
               player.y + player.height - 4 > 380 - o.height) {
              
               gameActive = false;
               enteringName = true;
               nameBuf = '';
               goSnap = null;
           }


           if (o.x + totalWidth < 0) {
               obstacles.splice(i, 1);
               score++;
               if (score % 10 === 0) {
                   gameSpeed += 0.4;
                   showLevelUp();
               }
           }
       }


       ui.innerText = `Score: ${score.toLocaleString()}`;
      
       if (gameActive) {
           requestAnimationFrame(update);
       } else {
           drawGameOver();
       }
   }


   function drawGameOver() {
       ctx.shadowBlur = 0;
       if (!goSnap) goSnap = ctx.getImageData(0, 0, canvas.width, canvas.height);
       else ctx.putImageData(goSnap, 0, 0);
       ctx.fillStyle = "rgba(0,0,0,0.85)";
       ctx.fillRect(0,0, canvas.width, canvas.height);
       ctx.fillStyle = "#fff";
       ctx.textAlign = "center";
       ctx.font = "bold 28px Courier New";
       ctx.fillText("CONNECTION LOST", canvas.width/2, canvas.height/2 - 20);
       ctx.font = "18px Courier New";
       ctx.save();
       ctx.fillStyle = "#000";
       ctx.fillRect(0, canvas.height/2, canvas.width, 70);
       ctx.restore();
       if (enteringName) {
           ctx.fillText("TYPE YOUR NAME: " + nameBuf + "_", canvas.width/2, canvas.height/2 + 20);
           ctx.fillText("PRESS ENTER TO SAVE SCORE", canvas.width/2, canvas.height/2 + 50);
       } else {
           ctx.fillText("PRESS ENTER TO RECONNECT", canvas.width/2, canvas.height/2 + 30);
       }
   }


   updateLeaderboardUI();
   update();
