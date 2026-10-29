// ---- settings ----
function setRow(label,hint,ctl){return '<div class="set"><div><label>'+label+'</label>'+(hint?'<small>'+hint+'</small>':'')+'</div>'+ctl+'</div>';}
function fmtSet(k,v){
  if(k==='sfx'||k==='music')return v+'%';
  if(k==='das')return v+' ms';
  if(k==='arr')return v===0?'Instant':v+' ms';
  if(k==='sdf')return SDF_NAME[v];
  return String(v);
}
function rangeCtl(k,min,max,step){return '<input type="range" data-s="'+k+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+S.set[k]+'"><span class="val" data-v="'+k+'">'+fmtSet(k,S.set[k])+'</span>';}
function togCtl(k){return '<button class="btn sm" data-a="tog:'+k+'">'+(S.set[k]?'On':'Off')+'</button>';}
var FX_NAME={2:'High',1:'Low',0:'Off'},TOUCH_NAME={auto:'Auto',buttons:'Buttons only',swipe:'Swipe only',off:'Off'};
function showSettings(back,keepScroll){
  var sc=0;try{var pn=ov.querySelector('.panel');if(pn&&keepScroll)sc=pn.scrollTop;}catch(e){}
  var th=theme();
  var h='<div class="panel narrow"><h2>SETTINGS</h2>';
  h+=setRow('Sound effects','',rangeCtl('sfx',0,100,5));
  h+=setRow('Music','',rangeCtl('music',0,100,5));
  h+=setRow('Theme','Unlock more by playing',' <button class="btn sm" data-a="cyc:theme">'+esc(th.name)+'</button>');
  h+=setRow('Skin &amp; background','Block skins and animated backgrounds','<button class="btn sm" data-a="custom">Customize</button>');
  h+=setRow('Ghost piece','Shows where the piece will land',togCtl('ghost'));
  h+=setRow('Grid lines','',togCtl('grid'));
  h+=setRow('Screen shake','',togCtl('shake'));
  h+=setRow('Effects','Lower this on slow computers','<button class="btn sm" data-a="cyc:fx">'+FX_NAME[S.set.fx]+'</button>');
  h+=setRow('Vibration','Phones only',togCtl('hap'));
  h+=setRow('DAS (delay)','How long before a held key repeats',rangeCtl('das',50,300,5));
  h+=setRow('ARR (repeat)','Time between repeats. 0 = instant',rangeCtl('arr',0,100,1));
  h+=setRow('Soft drop speed','',rangeCtl('sdf',0,4,1));
  h+=setRow('Touch controls','Buttons and/or swipe on the board','<button class="btn sm" data-a="cyc:touch">'+TOUCH_NAME[S.set.touch]+'</button>');
  h+=setRow('Player name','Shown on your high scores','<input type="text" data-n="name" maxlength="10" value="'+esc(S.set.name)+'">');
  h+='<div class="row"><button class="btn" data-a="controls">Keyboard controls</button><button class="btn sm" data-a="reset">'+(resetArmed&&Date.now()-resetArmed<5000?'Click again to ERASE ALL':'Reset all data')+'</button></div>';
  h+=backBtn()+'</div>';
  openOv(h,'settings',back||ovBackFn);
  try{var pn2=ov.querySelector('.panel');if(pn2&&sc)pn2.scrollTop=sc;}catch(e){}
}
function showControls(back){
  var h='<div class="panel narrow"><h2>KEYBOARD CONTROLS</h2><div class="tag" style="margin:0 0 8px">Click Rebind, then press a key</div><div class="kb">';
  ACTIONS.forEach(function(a){
    var ks=bindsFor(a[0]).map(function(c){return '<span class="key">'+esc(keyName(c))+'</span>';}).join('');
    h+='<div style="text-align:left">'+a[1]+'</div><div>'+(listening===a[0]?'<span class="key listen">press a key...</span>':ks+' <button class="btn sm" data-a="rebind:'+a[0]+'">Rebind</button>')+'</div>';
  });
  h+='</div><div style="font-size:12px;color:#93a0c8;margin-top:8px">Touch: use the on-screen buttons, or swipe on the board (left/right move, down soft drop, fast flick down hard drop, up swipe = hold, tap = rotate).</div>';
  h+='<div class="row"><button class="btn sm" data-a="rebreset">Reset to defaults</button></div>'+backBtn()+'</div>';
  openOv(h,'controls',back||ovBackFn);
}
function doRebind(code){
  var a=listening;listening=null;
  if(code!=='Escape'&&a){
    ACTIONS.forEach(function(x){
      if(x[0]===a)return;
      var l=bindsFor(x[0]).slice(),i=l.indexOf(code);
      if(i>=0){l.splice(i,1);S.binds[x[0]]=l.length?l:[''];}
    });
    var cur=bindsFor(a).slice();cur[0]=code;
    S.binds[a]=cur.filter(function(v,i,ar){return ar.indexOf(v)===i;});
    rebuildCodes();save();
  }
  showControls(ovBackFn);
}
function shortList(ids){return ids;}
function showHow(back){
  var h='<div class="panel"><h2>HOW TO PLAY</h2><div class="how">';
  h+='<h3>The basics</h3><p>Pieces fall into a 10-wide well. Move and rotate them to fill rows. A full row <b>clears</b>. If the stack reaches the top, it is game over. Use <b>Hold</b> to save a piece for later, and the <b>ghost</b> outline to see where a piece will land.</p>';
  h+='<p><b>Score big:</b> clear 4 lines at once (<b>Tetris</b>), spin a T-piece into a tight slot (<b>T-Spin</b>), keep a <b>combo</b> going, chain <b>Back-to-Back</b> difficult clears for x1.5, or empty the whole board for a <b>Perfect Clear</b>.</p>';
  h+='<h3>Modes</h3><p><b>Puzzles</b> - handcrafted boards to solve (see below). <b>Surge Run</b> - the twist (see below). <b>Daily Challenge</b> - a new seeded challenge every day. <b>Marathon</b> - endless, speeds up every 10 lines. <b>Sprint</b> - clear 40 lines fast. <b>Ultra</b> - best score in 2 minutes. <b>Zen</b> - no game over, the board just resets.</p>';
  h+='<h3>Surge Run: power blocks</h3><p>Some pieces carry one glowing <b>power block</b>. Clear the line it sits in to set it off:</p>';
  for(var p=1;p<=5;p++)h+='<div class="pw"><canvas class="pico" width="36" height="36" data-p="'+p+'"></canvas><div><b>'+POWERS[p].n+'</b> - '+POWERS[p].d+'</div></div>';
  h+='<p>Explosions can set off other power blocks they touch. Chain them for huge scores!</p>';
  h+='<h3>Surge Run: floors, perks, bosses</h3><p>Clear the line quota to finish a <b>floor</b>, then pick 1 of 3 <b>perks</b> that stack ('+PERKS.length+' to discover: slower gravity, bigger bombs, a second Hold, a Phoenix Feather that saves you, a Boss Ward...). Every 3rd floor is a <b>Boss</b> with a curse that twists the board. The bosses come in a different order every run. Beat one for a rare reward.</p>';
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:4px;margin:4px 0">';
  BOSSES.forEach(function(b){var k=S.kills[b.id]||0;h+='<div class="pw" style="display:block;margin:0"><b style="color:#ffb0b0">'+esc(b.name)+'</b>'+(k?' <small style="color:#ffd96b">beaten x'+k+'</small>':'')+'<br><span style="font-size:12px">'+esc(b.desc)+'</span></div>';});
  h+='</div>';
  h+='<p>Clears also charge the <b>Surge meter</b>. When full, press <b>V</b> (or the SURGE button) to fire a <b>Shockwave</b> that wipes the bottom rows of your stack.</p>';
  h+='<h3>Ranks</h3><p><b>Surge Run, Sprint, Ultra and Marathon</b> are ranked. Play '+PLACE+' placement games, then every run moves your rating up or down depending on how well it went. Climb from <b>Bronze</b> through <b>Silver, Gold, Platinum, Diamond</b> and <b>Master</b> to <b>Grandmaster</b>. Runs shorter than 10 pieces do not count.</p>';
  h+='<h3>Daily Challenge</h3><p>A new challenge every day (Daily Surge, Daily Sprint or Daily Ultra). Everyone gets the <b>same pieces</b> that day, so compare with friends! Your best for each day is saved in your daily history, and playing on back-to-back days builds a streak.</p>';
  h+='<h3>Puzzles</h3><p>'+PZ_ALL.length+' handcrafted boards in '+PZ_PACKS.length+' packs. Each one has a goal (a <b>Perfect Clear</b>, a <b>T-Spin</b>, <b>dig out</b> the grey junk, clear the <b>marked</b> blocks, a <b>combo</b>...) and a fixed list of pieces. Nothing falls on its own: line a piece up and hard drop it. Solve it in fewer pieces for up to <b>3 stars</b>; stars open new packs. <b>Undo</b> ('+esc(keyName(bindsFor('undo')[0]))+') is free, <b>Retry</b> is '+esc(keyName(bindsFor('retry')[0]))+', and <b>Hint</b> ('+esc(keyName(bindsFor('hint')[0]))+') shows where the next piece goes, but caps that solve at 2 stars.</p>';
  h+='<h3>Tutorial</h3><p>Short lessons with a coach for <b>Hold</b> and <b>T-Spins</b>. Stuck? "Show me" plays the move for you.</p>';
  h+='<h3>Customize</h3><p>Pick a colour theme, one of '+(SKINS.length-1)+' block skins and one of '+(BGS.length-1)+' animated backgrounds. Most of them unlock through achievements, ranks and puzzle stars.</p>';
  h+='<h3>Controls</h3><div class="kb">';
  ACTIONS.forEach(function(a){h+='<div>'+a[1]+'</div><div>'+bindsFor(a[0]).map(function(c){return '<span class="key">'+esc(keyName(c))+'</span>';}).join('')+'</div>';});
  h+='</div><p style="margin-top:8px"><b>Phone:</b> on-screen buttons, or swipe on the board: left/right to move, drag down to soft drop, flick down to hard drop, swipe up to hold, tap to rotate. You can rebind keys and tune DAS/ARR in Settings.</p>';
  h+='</div>'+backBtn()+'</div>';
  openOv(h,'how',back||ovBackFn);
}
// ---- puzzles & tutorial screens ----
var PZ_SHORT={pc:'Perfect Clear',clear:'Clear the marked blocks',dig:'Dig out the junk',lines:'Clear lines',tetris:'Tetris',combo:'Combo'};
function pzShort(d){
  var g;
  if(d.g==='ts')g=(d.c>1?d.c+'x ':'')+'T-Spin '+(['','Single','Double','Triple'][d.k]||'');
  else if(d.g==='lines')g='Clear '+d.k+' line'+(d.k>1?'s':'');
  else if(d.g==='combo')g='Combo x'+d.k;
  else if(d.g==='tetris')g=(d.c>1?d.c+' Tetrises':'Tetris');
  else g=PZ_SHORT[d.g]||'';
  if(d.t)g+=' + T-Spin';
  return g+' \u00b7 '+d.q.length+(d.q.length===1?' piece':' pieces');
}
function lessonTiles(){
  var h='<div class="lessons">';
  LESSONS.forEach(function(l,i){
    var done=!!S.tut[l.id];
    h+='<div class="pzt'+(done?' done':'')+'" tabindex="0" data-a="les:'+l.id+'"'+(!done&&!h.match(/data-focus/)?' data-focus="1"':'')+'><span class="num">LESSON '+(i+1)+(done?' &middot; DONE &#10003;':'')+'</span><b>'+esc(l.n)+'</b><small>'+esc(l.d)+' ('+l.steps.length+' steps)</small></div>';
  });
  return h+'</div>';
}
function showPuzzles(){
  var tot=pzStars(),all=PZ_ALL.length;
  var h='<div class="panel"><h2>PUZZLES</h2><div class="tag" style="margin-top:0">'+all+' handcrafted puzzles &middot; <span class="stars">&#9733;</span> '+tot+' / '+all*3+' stars &middot; '+pzSolvedCount()+' solved</div>';
  h+='<div style="font-size:12px;color:#b9c4ec;margin:-4px 0 6px">Nothing falls on its own: line each piece up, then hard drop. Undo is free. Fewer pieces = more stars. Stars open new packs.</div>';
  h+='<div class="packs">';
  var focus=false;
  PZ_PACKS.forEach(function(pk,i){
    var open=packOpen(pk),ps=packStars(pk),pn=pk.list.length,sv=packSolved(pk);
    var fa=(open&&!focus&&(i===lastPack||sv<pn))?' data-focus="1"':'';if(fa)focus=true;
    h+='<div class="pack'+(open?'':' lock')+'" style="background:linear-gradient(135deg,'+pk.c[0]+','+pk.c[1]+')" '+(open?'tabindex="0" data-a="pack:'+i+'"'+fa:'')+'>';
    if(!open)h+='<span class="lk">LOCKED &middot; '+pk.need+' &#9733;</span>';
    else if(sv>=pn)h+='<span class="lk" style="background:#0009;color:#ffd96b">COMPLETE</span>';
    h+='<h3>'+(i+1)+'. '+esc(pk.n)+'</h3><p>'+esc(pk.d)+'</p>';
    h+='<div class="pst">'+(open?sv+'/'+pn+' solved &middot; ':'Earn '+Math.max(0,pk.need-tot)+' more stars to open &middot; ')+'<span class="stars">&#9733;</span> '+ps+'/'+pn*3+'</div><div class="pbar"><i style="width:'+Math.round(ps/(pn*3)*100)+'%"></i></div></div>';
  });
  h+='</div><h3>Tutorial</h3>'+lessonTiles();
  h+=backBtn('Back to menu')+'</div>';
  openOv(h,'puzzles',showMenu);
}
function showPack(i){
  var pk=PZ_PACKS[i];if(!pk||!packOpen(pk)){showPuzzles();return;}
  lastPack=i;
  var h='<div class="panel"><h2>'+esc(pk.n.toUpperCase())+'</h2><div class="tag" style="margin-top:0">Pack '+(i+1)+' &middot; '+esc(pk.d)+'</div>';
  h+='<div style="font-size:13px;font-weight:800">'+packSolved(pk)+'/'+pk.list.length+' solved &middot; <span class="stars">&#9733;</span> '+packStars(pk)+'/'+pk.list.length*3+'</div><div class="pzgrid">';
  var nextUp=-1;pk.list.forEach(function(d,j){var r=S.puz[d.id];if(nextUp<0&&!(r&&r.s>=3))nextUp=j;});
  pk.list.forEach(function(d,j){
    var r=S.puz[d.id],st=r?r.s:0;
    h+='<div class="pzt'+(st>=3?' gold':(st>0?' done':''))+'" tabindex="0" data-a="pz:'+d.id+'"'+(j===nextUp?' data-focus="1"':'')+'><span class="num">'+pzLabel(d)+(j===nextUp&&st===0?' &middot; NEXT':'')+'</span><b>'+esc(d.n)+'</b><small>'+esc(pzShort(d))+'</small>'+starStr(st)+(r&&r.p&&st?' <small style="display:inline">best '+r.p+'</small>':'')+'</div>';
  });
  h+='</div><div class="row">'+(i>0&&packOpen(PZ_PACKS[i-1])?'<button class="btn" data-a="pack:'+(i-1)+'">&lt; Pack '+i+'</button>':'')+'<button class="btn" data-a="puzzles">All packs</button>'+(PZ_PACKS[i+1]&&packOpen(PZ_PACKS[i+1])?'<button class="btn" data-a="pack:'+(i+1)+'">Pack '+(i+2)+' &gt;</button>':'')+'<button class="btn" data-a="menu">Menu</button></div></div>';
  openOv(h,'pack',showPuzzles);
}
function showTutorial(){
  var h='<div class="panel narrow"><h2>TUTORIAL</h2><div class="tag" style="margin-top:0">Short, hands-on lessons</div>';
  h+='<div style="font-size:13px;color:#d6defa;text-align:left;margin-bottom:6px">Each lesson walks you through a few boards. A coach box tells you what to do; if you get stuck, press <b>'+(touchMode()!=='off'?'SHOW':esc(keyName(bindsFor('undo')[0])))+'</b> and the game shows you. Nothing falls on its own here, so take your time.</div>';
  h+=lessonTiles();
  h+='<div class="row"><button class="btn" data-a="puzzles">Puzzles</button><button class="btn" data-a="menu">Menu</button></div></div>';
  openOv(h,'tutorial',showMenu);
}
function showPzResult(){
  var z=G.pz,d=z.d,res=z.res||{stars:0,newPacks:[]},solved=G.over==='solved',i;
  var title=solved?(res.stars>=3?'PERFECT SOLVE!':'SOLVED!'):(G.over==='top'?'TOPPED OUT':'OUT OF PIECES');
  var h='<div class="panel narrow"><h2>'+title+'</h2><div class="tag" style="margin-top:0">Puzzle '+pzLabel(d)+' &middot; '+esc(d.n)+'</div>';
  h+='<div class="bigstars">';for(i=0;i<3;i++)h+='<span class="'+(i<res.stars?'on':'')+'" style="animation-delay:'+(.15+i*.2)+'s">&#9733;</span>';h+='</div>';
  if(solved){
    h+='<div style="font-size:15px">Solved with <b>'+G.pieces+'</b> piece'+(G.pieces===1?'':'s')+'.</div>';
    if(z.hinted)h+='<div style="font-size:12px;color:#ff9a9a;margin-top:3px">You used a hint, so this solve counts as 2 stars at most. Try it again without one!</div>';
    else if(res.stars<3)h+='<div style="font-size:12px;color:#93a0c8;margin-top:3px">Use '+(res.stars===2?d.p[0]:d.p[1])+' or fewer pieces for '+(res.stars+1)+' stars.</div>';
    if(res.stars>res.prev&&res.prev>0)h+='<div class="rec" style="margin-top:4px">NEW BEST!</div>';
  }else{
    h+='<div class="goal"><b>Goal:</b> '+esc(pzGoal(d))+(d.h?'<br><small style="color:#ffd96b">Tip: '+esc(d.h)+'</small>':'')+'</div>';
    h+='<div style="font-size:12px;color:#93a0c8">'+(touchMode()!=='off'?'Tap <b>UNDO</b> during a puzzle to take back a piece, or pause for a hint.':'Press <b>'+esc(keyName(bindsFor('undo')[0]))+'</b> during a puzzle to take back a piece, or <b>'+esc(keyName(bindsFor('hint')[0]))+'</b> for a hint.')+'</div>';
  }
  res.newPacks.forEach(function(n){h+='<div class="rec" style="margin-top:6px;animation:none">NEW PACK UNLOCKED: '+esc(n.toUpperCase())+'</div>';});
  var pk=PZ_PACKS[d.pi];
  h+='<div class="sum">'+sumBox('Pack solved',packSolved(pk)+'/'+pk.list.length)+sumBox('Pack stars',packStars(pk)+'/'+pk.list.length*3)+sumBox('All stars',pzStars()+'/'+PZ_ALL.length*3)+'</div>';
  var nx=pzNextId(d);
  h+='<div class="row">';
  if(solved&&nx)h+='<button class="btn pri" data-a="pz:'+nx+'" data-focus="1">Next puzzle</button><button class="btn" data-a="restart">Retry</button>';
  else h+='<button class="btn pri" data-a="restart" data-focus="1">Retry</button>'+(nx?'<button class="btn" data-a="pz:'+nx+'">Skip to next</button>':'');
  h+='<button class="btn" data-a="pack:'+d.pi+'">Puzzle list</button><button class="btn" data-a="menu">Menu</button></div></div>';
  openOv(h,'result',null,true);
}
function showLessonDone(){
  var l=G.pz.l,nx=LESSONS[l.i+1];
  var h='<div class="panel narrow"><h2>LESSON COMPLETE!</h2><div class="tag" style="margin-top:0">'+esc(l.n)+'</div>';
  h+='<div class="bigstars"><span class="on">&#10003;</span></div>';
  h+='<div style="font-size:14px;color:#d6defa">'+esc(l.done||'Nice work!')+'</div>';
  if(tutDone()>=LESSONS.length)h+='<div style="font-size:12px;color:#ffd96b;margin-top:6px">All lessons done! The Gumdrop block skin is yours (Customize).</div>';
  h+='<div class="row">'+(nx?'<button class="btn pri" data-a="les:'+nx.id+'" data-focus="1">Next lesson: '+esc(nx.n)+'</button>':'<button class="btn pri" data-a="puzzles" data-focus="1">Try the puzzles</button>');
  h+='<button class="btn" data-a="restart">Replay</button><button class="btn" data-a="tutorial">All lessons</button><button class="btn" data-a="menu">Menu</button></div></div>';
  openOv(h,'result',null,true);
}
// ---- what's new ----
var VERSION='2.0';
function showNews(back){
  var h='<div class="panel"><h2>WHAT\'S NEW IN '+VERSION+'</h2><div class="tag" style="margin-top:0">Tetris Surge 2.0, the big update</div><div class="wn">';
  h+='<h3>Puzzles &amp; Tutorial</h3><ul>';
  h+='<li><b>Puzzle mode:</b> '+PZ_ALL.length+' handcrafted puzzles in '+PZ_PACKS.length+' packs (T-Spins, Perfect Clears, digging, combos, demolition and a final exam). Up to 3 stars each for using fewer pieces; stars open new packs.</li>';
  h+='<li>Free <b>Undo</b>, instant Retry and a <b>Hint</b> that shows where the next piece goes. Every puzzle was checked by a solver.</li>';
  h+='<li><b>Tutorial:</b> hands-on lessons for Hold and T-Spins (Single, Double, Triple) with a coach and a "Show me" button.</li></ul>';
  h+='<h3>Customize</h3><ul><li><b>'+(SKINS.length-1)+' block skins</b> (Gemstone, Toy Brick, Chrome, Jelly, Stone, Wireframe...) and <b>'+(BGS.length-1)+' animated backgrounds</b> (Starfield, Deep Sea, Night City, Aurora, Snowfall, Lava Lamp, Code Rain, Synthwave). Many unlock through achievements, ranks and puzzle stars.</li></ul>';
  h+='<h3>Ranks</h3><ul><li>Ranked ladder for Surge Run, Sprint, Ultra and Marathon: Bronze to Grandmaster with divisions, placement games, promotion animations, rank cards on results and a Ranks screen with your rating history.</li></ul>';
  h+='<h3>Surge Run</h3><ul><li><b>14 new perks</b> (30 in total) and <b>5 new bosses</b> (10 in total): The Blindfold, The Upside, The Floodgate, The Conveyor and The Cryomancer. Bosses now come in a different order every run.</li></ul>';
  h+='<h3>Daily Challenge</h3><ul><li>A new challenge every day (Daily Surge, Daily Sprint or Daily Ultra) with the same pieces for everyone, streaks, personal bests and a 60-day history.</li></ul>';
  h+='<h3>More</h3><ul><li>'+ACH.length+' achievements in '+ACH_CATS.length+' categories with progress bars.</li><li>Juicier clears: sweep bands, Tetris glow, springy board, combo and Back-to-Back callouts.</li><li>New keys: Undo (U), Retry (T) and Hint (H) in puzzles. All rebindable.</li></ul>';
  h+='</div><div class="row"><button class="btn pri" data-a="puzzles" data-focus="1">Play Puzzles</button><button class="btn" data-a="custom">Customize</button><button class="btn" data-a="back">Back</button></div></div>';
  openOv(h,'news',back||showMenu);
}
// ---- customize: colour theme, block skin and background ----
function previewScene(c2,id){
  var g=c2.getContext('2d'),W=c2.width,H=c2.height;
  if(id==='auto'){
    var th=theme(),gr=g.createLinearGradient(0,0,0,H);gr.addColorStop(0,th.bg[0]);gr.addColorStop(1,th.bg[1]);g.fillStyle=gr;g.fillRect(0,0,W,H);
    var r=mulberry32(7);for(var i=0;i<9;i++){var s=H*(.25+r()*.35);g.save();g.translate(r()*W,r()*H);g.rotate(r()*3);g.globalAlpha=.18;g.fillStyle=th.cols[1+i%7];g.fillRect(-s/2,-s/2,s,s);g.restore();}
    g.globalAlpha=1;return;
  }
  var save=scn.meta,m=[],arr=[];
  scn.meta=m;
  paintScene(g,id,W,H,m);sceneParts(id,W,H,arr);
  for(var k=0;k<3;k++)sceneDyn(g,id,W,H,2000+k*700,16,arr,false);
  scn.meta=save;scn.key=''; // the main scene rebuilds next frame (previews share its sprite helpers)
}
var PREV_BOARD=['..........','....T.....','...TTT..Z.','J.OO....ZZ','JJOO.SS.LZ','IIIISSLLL.'];
function previewCustom(c2){
  var g=c2.getContext('2d'),W=c2.width,H=c2.height,th=theme(),st=skinStyle(th);
  previewScene(c2,bgId());
  var cs=Math.floor(H/(PREV_BOARD.length+.6)),bw=cs*10,bx=Math.round((W-bw)/2),by=Math.round((H-cs*PREV_BOARD.length)/2);
  g.fillStyle=th.board;g.fillRect(bx,by,bw,cs*PREV_BOARD.length);
  g.strokeStyle=th.grid;g.lineWidth=1;g.beginPath();
  for(var x=1;x<10;x++){g.moveTo(bx+x*cs+.5,by);g.lineTo(bx+x*cs+.5,by+cs*PREV_BOARD.length);}g.stroke();
  for(var y=0;y<PREV_BOARD.length;y++)for(x=0;x<10;x++){var t=TYPES.indexOf(PREV_BOARD[y].charAt(x));if(t>=0)drawBlockStyle(g,st,th.cols[t+1],bx+x*cs,by+y*cs,cs);}
  g.strokeStyle=rgba(th.acc,.85);g.lineWidth=2;g.strokeRect(bx-1,by-1,bw+2,cs*PREV_BOARD.length+2);
  g.font='bold '+Math.round(H*.11)+'px '+FONT;g.textAlign='left';g.textBaseline='top';
  var lab=[th.name,(SKIN_BY[S.set.skin]&&SKIN_BY[S.set.skin].style&&SKIN_BY[S.set.skin].test())?SKIN_BY[S.set.skin].name:'Theme blocks',BG_BY[bgId()].name];
  for(var i=0;i<3;i++){g.fillStyle='rgba(0,0,0,.55)';g.fillText(lab[i],11,9+i*H*.15);g.fillStyle=i?'#dfe6ff':th.acc;g.fillText(lab[i],10,8+i*H*.15);}
}
function newTag(kind,id,un){return un&&id!=='auto'&&!S.seen[kind+id]?' new':'';}
function showCustomize(back,keepScroll){
  var sc=0;try{var pn=ov.querySelector('.panel');if(pn&&keepScroll)sc=pn.scrollTop;}catch(e){}
  var h='<div class="panel"><h2>CUSTOMIZE</h2><div class="tag" style="margin:0 0 4px">Colours, block skins and backgrounds &middot; unlock more by playing</div>';
  h+='<canvas class="cprev" width="720" height="150"></canvas>';
  var nT=THEMES.filter(themeUnlocked).length,nK=SKINS.filter(function(k){return k.style&&k.test();}).length,nB=BGS.filter(function(b){return b.id!=='auto'&&b.test();}).length;
  h+='<h3>Colour theme <span style="color:#93a0c8;font-size:12px">'+nT+'/'+THEMES.length+'</span></h3><div class="thm">';
  THEMES.forEach(function(t){
    var un=themeUnlocked(t),sel=S.set.theme===t.id;
    h+='<div class="'+(sel?'sel':'')+(un?'':' lock')+newTag('c_t',t.id,un&&t.id!=='classic')+'" '+(un?'data-a="theme:'+t.id+'" tabindex="0"':'')+'><canvas class="tp" width="160" height="46" data-t="'+t.id+'"></canvas><b>'+esc(t.name)+'</b><br><small>'+(un?(sel?'Selected':'Click to use'):'Locked: '+esc(t.how))+'</small></div>';
  });
  h+='</div><h3>Block skin <span style="color:#93a0c8;font-size:12px">'+nK+'/'+(SKINS.length-1)+'</span></h3><div class="thm">';
  SKINS.forEach(function(k){
    var un=k.test(),sel=(S.set.skin||'auto')===k.id;
    h+='<div class="'+(sel?'sel':'')+(un?'':' lock')+newTag('c_k',k.id,un)+'" '+(un?'data-a="skin:'+k.id+'" tabindex="0"':'')+'><canvas class="tp" width="160" height="46" data-t="'+theme().id+'"'+(k.style?' data-k="'+k.id+'"':'')+'></canvas><b>'+esc(k.name)+'</b><br><small>'+(un?(sel?'Selected':(k.id==='auto'?'Use the theme\'s own blocks':'Click to use')):'Locked: '+esc(k.how))+'</small></div>';
  });
  h+='</div><h3>Background <span style="color:#93a0c8;font-size:12px">'+nB+'/'+(BGS.length-1)+'</span></h3><div class="thm">';
  BGS.forEach(function(b){
    var un=b.test(),sel=(S.set.bg||'auto')===b.id;
    h+='<div class="'+(sel?'sel':'')+(un?'':' lock')+newTag('c_g',b.id,un)+'" '+(un?'data-a="bg:'+b.id+'" tabindex="0"':'')+'><canvas class="bgp" width="200" height="60" data-g="'+b.id+'"></canvas><b>'+esc(b.name)+'</b><br><small>'+(un?(sel?'Selected':(b.id==='auto'?'Floating blocks in theme colours':'Click to use')):'Locked: '+esc(b.how))+'</small></div>';
  });
  h+='</div><div class="row"><button class="btn pri" data-a="back" data-focus="1">Done</button></div></div>';
  openOv(h,'custom',back||showMenu);
  try{var pn2=ov.querySelector('.panel');if(pn2&&sc)pn2.scrollTop=sc;}catch(e){}
  // everything unlocked has now been seen (the green "new" outline only shows once)
  var ch=false;
  SKINS.forEach(function(k){if(k.id!=='auto'&&k.test()&&!S.seen['c_k'+k.id]){S.seen['c_k'+k.id]=1;ch=true;}});
  BGS.forEach(function(b){if(b.id!=='auto'&&b.test()&&!S.seen['c_g'+b.id]){S.seen['c_g'+b.id]=1;ch=true;}});
  THEMES.forEach(function(t){if(themeUnlocked(t)&&!S.seen['c_t'+t.id]){S.seen['c_t'+t.id]=1;ch=true;}});
  if(ch)save();
}
function ladderReq(m,r){
  var x=invInterp(RANKED[m].tab,r);
  if(r<=0)return '-';
  if(m==='sprint')return 'under '+fmtSec(Math.round(x)*1000);
  if(m==='surge')return 'Floor '+Math.floor(x);
  var k=x>=100000?10000:(x>=10000?1000:500);
  return fmtNum(Math.round(x/k)*k);
}
function ranksHtml(){
  var h='<div class="ranks">';
  RANK_ORDER.forEach(function(m){
    var R=S.rank[m],placed=!!(R&&R.n>=PLACE),t=placed?tierOf(R.r):null,col=placed?TIERS[t.t].c:'#dfe6ff';
    h+='<div class="rkcard"><canvas class="emb" width="128" height="128" data-tier="'+(placed?t.t:-1)+'" data-div="'+(placed?t.d:-1)+'"></canvas><div class="rki">';
    h+='<div class="rkm">'+RANKED[m].n+'</div>';
    if(placed){
      var nx=nextRankName(t);
      h+='<div class="rkt" style="color:'+col+'">'+rankName(t)+'<span class="rkr">'+R.r+'</span></div>';
      h+='<div class="rbar"><i style="width:'+Math.round(t.prog*100)+'%;background:linear-gradient(90deg,'+TIERS[t.t].c2+','+col+')"></i></div>';
      h+='<small>'+(nx?'Next: '+nx+' at '+Math.ceil(t.hi):'Top of the ladder!')+' &middot; Peak '+rankName(tierOf(R.pk))+' ('+R.pk+') &middot; '+R.n+' games</small>';
      h+='<canvas class="spk" data-m="'+m+'" data-c="'+col+'"></canvas>';
    }else{
      h+='<div class="rkt">Unranked</div><small>Placement '+(R?R.n:0)+'/'+PLACE+'. Finish '+(PLACE-(R?R.n:0))+' more '+RANKED[m].n+' game'+(PLACE-(R?R.n:0)===1?'':'s')+' to get your rank.</small>';
    }
    h+='<div style="margin-top:4px"><button class="btn sm" data-a="play:'+m+'">Play '+RANKED[m].n+'</button></div></div></div>';
  });
  h+='</div><h3>The ladder</h3><div style="overflow-x:auto"><table class="ladder"><tr><th>Tier</th><th class="r">Rating</th><th class="r">Surge Run</th><th class="r">Sprint</th><th class="r">Ultra</th><th class="r">Marathon</th></tr>';
  TIERS.forEach(function(T){
    h+='<tr><td><b style="color:'+T.c+'">'+T.n+'</b>'+(T.div?' <small style="color:#93a0c8">III-II-I</small>':'')+'</td><td class="r">'+T.min+'+</td>';
    RANK_ORDER.forEach(function(m){h+='<td class="r">'+ladderReq(m,T.min)+'</td>';});
    h+='</tr>';
  });
  h+='</table></div><div style="font-size:12px;color:#93a0c8;margin-top:6px;text-align:left;line-height:1.45">Each run gets a <b>performance rating</b> from the table above (Surge Run counts the floor you reach, Sprint your time, Ultra and Marathon your score). Beat your rating and it climbs; fall short and it drops a little. After '+PLACE+' placement games you get your starting rank. Daily and Zen runs are not ranked.</div>';
  return h;
}
function achHtml(){
  var got=achCount(),h='<div style="margin:0 0 2px;color:#ffd96b;font-weight:800">'+got+' / '+ACH.length+' unlocked</div>';
  h+='<div class="rbar" style="max-width:420px;margin:0 auto 6px"><i style="width:'+Math.round(got/ACH.length*100)+'%"></i></div>';
  ACH_CATS.forEach(function(cat){
    var list=ACH.filter(function(a){return a[3]===cat[0];}),gc=0;
    list.forEach(function(a){if(S.ach[a[0]])gc++;});
    h+='<h3>'+cat[1]+' <span style="color:#93a0c8;font-size:12px">'+gc+'/'+list.length+'</span></h3><div class="ach">';
    list.forEach(function(a){
      var ok=!!S.ach[a[0]],pr=(!ok&&a[4])?a[4]():null;
      h+='<div class="'+(ok?'got':'')+'"><b><span class="ck">'+(ok?'&#10003;':'')+'</span>'+esc(a[1]);
      if(pr)h+='<span class="pv">'+fmtNum(Math.min(pr[0],pr[1]))+' / '+fmtNum(pr[1])+'</span>';
      h+='</b>'+esc(a[2]);
      if(pr)h+='<div class="pb"><i style="width:'+Math.round(Math.min(1,pr[0]/pr[1])*100)+'%"></i></div>';
      if(ok&&+S.ach[a[0]]>19000000)h+='<span class="dt">Unlocked '+dateStr(S.ach[a[0]])+'</span>';
      h+='</div>';
    });
    h+='</div>';
  });
  return h;
}
function showStats(tab,back){
  tab=tab||'scores';
  var h='<div class="panel"><h2>PROGRESS</h2><div class="tabs">';
  [['ranks','Ranks'],['scores','High Scores'],['daily','Daily'],['stats','Stats'],['ach','Achievements'],['themes','Customize']].forEach(function(t){h+='<div class="tab'+(tab===t[0]?' on':'')+'" tabindex="0" data-a="stats:'+t[0]+'">'+t[1]+'</div>';});
  h+='</div>';
  if(tab==='ranks'){
    h+=ranksHtml();
  }else if(tab==='daily'){
    var D=S.daily,pb=dailyBests();
    h+='<div class="sum">'+sumBox('Streak',nDays(dailyStreakNow()))+sumBox('Best streak',nDays(D.bestStreak))+sumBox('Days played',D.days||0)+sumBox('Daily runs',D.plays||0)+'</div>';
    h+='<h3>Personal bests</h3><div class="sum">'+sumBox('Daily Surge',pb.surge?dailyResStr(pb.surge):'--')+sumBox('Daily Sprint',pb.sprint?fmtTime(pb.sprint.t):'--')+sumBox('Daily Ultra',pb.ultra?fmtNum(pb.ultra.s):'--')+'</div>';
    h+='<div class="row"><button class="btn pri" data-a="daily">Today\'s challenge</button></div>';
    h+='<h3>History</h3>'+dailyHistHtml(60);
  }else if(tab==='scores'){
    MODE_ORDER.forEach(function(id){
      var l=S.best[id]||[];
      h+='<h3>'+MODES[id].name+'</h3>';
      if(!l.length){h+='<div style="color:#7f8bb8;font-size:13px;text-align:left">No scores yet.</div>';return;}
      h+='<table><tr><th>#</th><th>Name</th><th class="r">'+(id==='sprint'?'Time':'Score')+'</th><th class="r">Lines</th><th class="r">'+((id==='surge'||id==='daily')?'Floor':'Date')+'</th></tr>';
      l.forEach(function(e,i){h+='<tr><td>'+(i+1)+'</td><td>'+esc(e.n||'PLAYER')+'</td><td class="r">'+(id==='sprint'?fmtTime(e.t):fmtNum(e.s))+'</td><td class="r">'+e.l+'</td><td class="r">'+((id==='surge'||id==='daily')?(e.f||1):dateStr(e.d))+'</td></tr>';});
      h+='</table>';
    });
  }else if(tab==='stats'){
    var st=S.stats;
    h+='<div class="sum">'+sumBox('Games',st.games)+sumBox('Lines',fmtNum(st.lines))+sumBox('Pieces',fmtNum(st.pieces))+sumBox('Play time',Math.floor(st.time/3600)+'h '+Math.floor(st.time/60)%60+'m')+sumBox('T-Spins',st.tspins)+sumBox('Tetrises',st.tetrises)+sumBox('Perfect clears',st.pcs)+sumBox('Best combo',st.maxCombo)+sumBox('Holds',fmtNum(st.holds))+sumBox('Bosses beaten',st.bosses)+sumBox('Best floor',st.bestFloor)+sumBox('Power blocks',st.powers)+sumBox('Bombs',st.bombs)+sumBox('Lasers',st.lasers)+sumBox('Frosts',st.frosts)+sumBox('Quakes',st.quakes)+sumBox('Gold',st.golds)+sumBox('Shockwaves',st.surges)+sumBox('Best B2B streak',st.b2bMax||0)+sumBox('Bosses met',bossKinds()+'/'+BOSSES.length)+sumBox('Perks found',cntKeys(S.pseen)+'/'+PERKS.length)+sumBox('Puzzles solved',pzSolvedCount()+'/'+PZ_ALL.length)+sumBox('Puzzle stars',pzStars()+'/'+PZ_ALL.length*3)+sumBox('Lessons done',tutDone()+'/'+LESSONS.length)+'</div>';
  }else if(tab==='ach'){
    h+=achHtml();
  }else{
    h+='<div class="thm">';
    THEMES.forEach(function(t){
      var un=themeUnlocked(t),sel=S.set.theme===t.id;
      h+='<div class="'+(sel?'sel':'')+(un?'':' lock')+'" '+(un?'data-a="theme:'+t.id+'" tabindex="0"':'')+'><canvas class="tp" width="240" height="46" data-t="'+t.id+'"></canvas><b>'+esc(t.name)+'</b><br><small>'+(un?(sel?'Selected':'Click to use'):'Locked: '+esc(t.how))+'</small></div>';
    });
    h+='</div>';
  }
  h+=backBtn('Back to menu')+'</div>';
  openOv(h,'stats',back||showMenu);
  var pn=ov.querySelector('.panel');if(pn&&tab==='scores'){}
}
function ovBack(){
  if(ovState==='pause'){resumeGame();return;}
  if(ovBackFn)ovBackFn();
}
function act(a,el){
  var p=a.split(':'),k=p[0],v=p[1];
  sfx.click();
  switch(k){
    case 'play':startGame(v);break;
    case 'again':if(G&&G.pz){act('restart');break;}startGame(G?(G.daily?'daily':G.mode):'marathon',{level:G?G.startLevel:1});break;
    case 'puzzles':if(G&&G.state!=='over')save();G=null;updateTouchUI();showPuzzles();break;
    case 'tutorial':if(G&&G.state!=='over')save();G=null;updateTouchUI();showTutorial();break;
    case 'pack':if(G&&G.state!=='over')save();G=null;updateTouchUI();showPack(+v);break;
    case 'pz':if(PZ_BY[v]&&packOpen(PZ_PACKS[PZ_BY[v].pi]))startGame('puzzle',{pz:v});else showPuzzles();break;
    case 'les':if(LES_BY[v])startGame('tutorial',{les:v});break;
    case 'pzundo':closeOv();resumeGame();pzUndo();break;
    case 'pzhint':closeOv();resumeGame();pzHint();break;
    case 'pzretry':closeOv();resumeGame();pzRetry();break;
    case 'news':showNews(ovState==='menu'?showMenu:ovBackFn);break;
    case 'daily':showDaily();break;
    case 'promo':showResult(true);break;
    case 'menu':goMenu();break;
    case 'resume':resumeGame();break;
    case 'restart':
      if(G&&G.pz){if(G.mode==='puzzle')startGame('puzzle',{pz:G.pz.d.id,quick:true});else startGame('tutorial',{les:G.pz.l.id});break;}
      startGame(G.daily?'daily':G.mode,{level:G.startLevel});break;
    case 'quit':
      if(G.mode==='sprint'){goMenu();}
      else{closeOv();endGame('quit');}
      break;
    case 'settings':{var fromPause=(ovState==='pause');showSettings(fromPause?showPause:(G?showPause:showMenu));break;}
    case 'controls':{
      if(ovState==='pause')showControls(showPause);
      else{var sb0=ovBackFn;showControls(function(){showSettings(sb0);});}
      break;}
    case 'how':{var fp2=(ovState==='pause');showHow(fp2?showPause:showMenu);break;}
    case 'stats':if(v==='themes'){showCustomize(showMenu);break;}showStats(v,showMenu);break;
    case 'back':ovBack();break;
    case 'lv':S.last.lv=clamp((S.last.lv||1)+(+v),1,15);save();showMenu();break;
    case 'perk':pickPerk(v);break;
    case 'reroll':rerollDraft();break;
    case 'theme':S.set.theme=v;sprCache={};save();if(ovState==='custom')showCustomize(ovBackFn,true);else showStats('themes',showMenu);break;
    case 'skin':S.set.skin=v;sprCache={};save();showCustomize(ovBackFn,true);break;
    case 'bg':S.set.bg=v;scn.key='';save();showCustomize(ovBackFn,true);break;
    case 'custom':{var cb=(ovState==='pause')?showPause:(ovState==='settings'?(function(b){return function(){showSettings(b);};})(ovBackFn):showMenu);showCustomize(cb);break;}
    case 'tog':S.set[v]=!S.set[v];save();showSettings(null,true);break;
    case 'cyc':
      if(v==='fx')S.set.fx=(S.set.fx+2)%3;   // 2->1->0->2
      else if(v==='touch'){var o=['auto','buttons','swipe','off'];S.set.touch=o[(o.indexOf(S.set.touch)+1)%o.length];updateTouchUI();}
      else if(v==='theme'){var un=THEMES.filter(themeUnlocked),i=0;un.forEach(function(t,j){if(t.id===S.set.theme)i=j;});S.set.theme=un[(i+1)%un.length].id;sprCache={};}
      save();showSettings(null,true);break;
    case 'rebind':listening=v;showControls(ovBackFn);break;
    case 'rebreset':S.binds={};rebuildCodes();save();showControls(ovBackFn);break;
    case 'reset':
      if(resetArmed&&Date.now()-resetArmed<5000){
        var nm=S.set.name;S=defaults();S.set.name=nm;save();rebuildCodes();applyVol();sprCache={};resetArmed=0;checkThemes();showSettings(null,true);
      }else{resetArmed=Date.now();showSettings(null,true);}
      break;
  }
}
ov.addEventListener('click',function(e){
  var t=e.target.closest?e.target.closest('[data-a]'):null;
  if(!t||!ov.contains(t))return;
  initAudio();act(t.getAttribute('data-a'),t);
});
ov.addEventListener('input',function(e){
  var t=e.target,k=t.getAttribute&&t.getAttribute('data-s');
  if(!k)return;
  S.set[k]=+t.value;
  var sp=ov.querySelector('[data-v="'+k+'"]');if(sp)sp.textContent=fmtSet(k,S.set[k]);
  if(k==='sfx'||k==='music'){initAudio();applyVol();}
  if(k==='music'&&S.set.music<=0)musicStop();
});
ov.addEventListener('change',function(e){
  var t=e.target,k=t.getAttribute&&t.getAttribute('data-s'),n=t.getAttribute&&t.getAttribute('data-n');
  if(k){if(k==='sfx')sfx.click();save();}
  if(n==='name'){S.set.name=cleanName(t.value);t.value=S.set.name;save();}
});
function menuKey(e){
  var c=e.code,list=Array.prototype.slice.call(ov.querySelectorAll('[data-a],input[type=range]')),ae=document.activeElement,i=list.indexOf(ae);
  if(ovState==='draft'&&/^(Digit|Numpad)[1-4]$/.test(c)){
    e.preventDefault();var id=G.draft&&G.draft.cards[+c.slice(-1)-1];if(id){initAudio();pickPerk(id);}return;
  }
  if(c==='Escape'||(c==='KeyP'&&ovState==='pause')){e.preventDefault();if(ovState==='draft'||ovState==='menu')return;ovBack();return;}
  if(c==='Enter'||c==='Space'){
    if(ae&&ae.getAttribute&&ae.getAttribute('data-a')&&ae.tagName!=='BUTTON'){e.preventDefault();act(ae.getAttribute('data-a'),ae);}
    else if(ae&&ae.tagName==='BUTTON'){/* native click */}
    return;
  }
  var isRange=ae&&ae.tagName==='INPUT'&&ae.type==='range';
  var next=(c==='ArrowDown'||(c==='ArrowRight'&&!isRange)),prev=(c==='ArrowUp'||(c==='ArrowLeft'&&!isRange));
  if(next||prev){
    e.preventDefault();if(!list.length)return;
    i=i<0?0:(next?(i+1)%list.length:(i-1+list.length)%list.length);
    try{list[i].focus();}catch(_){}
  }
}

// ---------- main loop ----------
var lastT=0,themeTick=0,errShown=false;
function frame(ts){
  requestAnimationFrame(frame);
  var dt=ts-lastT;lastT=ts;
  if(dt>50)dt=50;if(dt<0)dt=0;
  if(document.hidden)return;
  try{
    update(dt);
    draw(ts,dt);
    themeTick+=dt;
    if(themeTick>1500){themeTick=0;if(G){checkThemes();var sb=touchEl.querySelector('.b-surge');if(sb&&G.surge)sb.classList.toggle('ready',G.meter>=100);}}
  }catch(err){
    if(!errShown){errShown=true;try{console.error('Tetris Surge error: '+(err&&err.stack?err.stack:err));}catch(_){}}
  }
}
function init(){
  if(window.ResizeObserver){try{new ResizeObserver(function(){resize();}).observe(stage);}catch(e){}}
  resize();
  S.seen.t_classic=1;
  checkProgressAch(true);
  var upd=!S.seen.v20;
  if(upd){S.seen.v20=1;checkThemes(true);save();}else checkThemes(); // first launch of 2.0: unlock quietly, then show what is new
  showMenu();
  if(upd&&S.stats.games>0)showNews(showMenu);
  requestAnimationFrame(frame);
  try{window.parent.postMessage({tetrisSurge:'ready'},'*');}catch(e){}
}
if(/[?&]debug/.test(String(location.search))){
  window.__tg={ac:function(){return AC?AC.state+':'+mus.on:'none';},get G(){return G;},get S(){return S;},startGame:startGame,tryRotate:tryRotate,tryMove:tryMove,hardDrop:hardDrop,lockPiece:lockPiece,afterLock:afterLock,fits:fits,spawn:spawn,
    fullRows:fullRows,beginClear:beginClear,update:update,fireSurge:fireSurge,openDraft:openDraft,floorComplete:floorComplete,startFloor:startFloor,endGame:endGame,showResult:showResult,SHAPES:SHAPES,press:press,release:release,ach:ach,topOut:topOut,addGarbage:addGarbage,popup:popup,resize:resize,nextTurn:nextTurn,
    BOSSES:BOSSES,PERKS:PERKS,ACH:ACH,TIERS:TIERS,RANKED:RANKED,tierOf:tierOf,rankName:rankName,perfOf:perfOf,rateRun:rateRun,interp:interp,dailyInfo:dailyInfo,recordDaily:recordDaily,bossFor:bossFor,
    curseOnLock:curseOnLock,curseUpdate:curseUpdate,gravityMs:gravityMs,refill:refill,spawnNext:spawnNext,shiftStack:shiftStack,freezeColumn:freezeColumn,pickPerk:pickPerk,makeDraft:makeDraft,showStats:showStats,showDaily:showDaily,showMenu:showMenu,save:save,loadSave:loadSave,
    PZ_PACKS:PZ_PACKS,PZ_BY:PZ_BY,LESSONS:LESSONS,pzUndo:pzUndo,pzHint:pzHint,pzRetry:pzRetry,doHold:doHold,showPuzzles:showPuzzles,showPack:showPack,showTutorial:showTutorial,
    showCustomize:showCustomize,showNews:showNews,showPause:showPause,pauseGame:pauseGame,tutShow:tutShow,SKINS:SKINS,BGS:BGS,act:act,checkThemes:checkThemes,
    forceBoss:function(id){ // jump straight to a boss floor with the chosen boss (testing)
      var bi=-1;BOSSES.forEach(function(b,i){if(b.id===id)bi=i;});if(bi<0||!G)return false;
      bossFor(3);var o=G.bossOrd[0],j=o.indexOf(bi);o[j]=o[0];o[0]=bi;
      G.cur=null;startFloor(3);return true;}};
}
init();
})();
