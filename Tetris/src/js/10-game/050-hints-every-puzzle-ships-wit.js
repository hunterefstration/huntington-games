// ---- hints: every puzzle ships with one known solution, [hold?, piece, rotation, x, y] per piece ----
function pzStepCells(st,out){var sh=SHAPES[st[1]][st[2]];for(var i=0;i<4;i++){out[i*2]=st[3]+sh[i][0];out[i*2+1]=st[4]+sh[i][1];}return out;}
var hintCells=[0,0,0,0,0,0,0,0];
function pzTrack(c){ // called as a piece locks: are we still following the stored solution?
  var z=G.pz,d=z.d;z.hint=false;
  if(!d||!d.s||z.on<0)return;
  var st=d.s[z.on];
  if(!st||st[1]!==c.t){z.on=-1;return;}
  pzStepCells(st,hintCells);
  var sh=SHAPES[c.t][c.r];
  for(var i=0;i<4;i++){
    var x=c.x+sh[i][0],y=c.y+sh[i][1],hit=false;
    for(var j=0;j<8;j+=2)if(hintCells[j]===x&&hintCells[j+1]===y){hit=true;break;}
    if(!hit){z.on=-1;return;}
  }
  z.on++;
}
function pzHint(){
  var z=G&&G.pz;if(!z||G.mode!=='puzzle'||G.state!=='play'||!z.d.s)return;
  if(z.on<0){sfx.warn();popup('OFF THE SOLUTION PATH','#ff9a9a',.85,'Undo ('+kl('undo')+') back a step, or restart');return;}
  var st=z.d.s[z.on];if(!st)return;
  var first=!z.hinted;
  z.hint=true;z.hinted=true;sfx.peek();
  popup(G.cur&&G.cur.t!==st[1]?'HOLD, THEN PLACE IT HERE':'PLACE IT HERE','#ffd96b',.9,first?'Using a hint caps this solve at 2 stars':'');
}
function pzSolved(){
  var z=G.pz,d=z.d,x,y,ok=false;
  switch(d.g){
    case 'pc':ok=gridEmpty();break;
    case 'clear':ok=true;for(y=0;y<ROWS&&ok;y++)for(x=0;x<COLS;x++)if(G.grid[y][x]&PZ_MARK){ok=false;break;}break;
    case 'dig':ok=true;for(y=0;y<ROWS&&ok;y++)for(x=0;x<COLS;x++)if((G.grid[y][x]&15)===8){ok=false;break;}break;
    case 'ts':ok=z.tsc>=(d.c||1);break;
    case 'lines':ok=G.lines>=d.k;break;
    case 'tetris':ok=z.tet>=(d.c||1);break;
    case 'combo':ok=G.combo>=d.k;break;
  }
  return ok&&z.tsAny>=(d.t||0);
}
function pzAfter(){ // after every lock (and its line clear)
  if(G.mode==='tutorial'){tutAfter();return;}
  if(pzSolved()){pzEnd('solved');return;}
  spawnNext(); // ends the puzzle when the queue and the Hold box are empty
}
function pzLeft(){return G.queue.length+G.hold.length+(G.cur?1:0);}
function pzUndo(){
  var z=G&&G.pz;if(!z||z.demo)return;
  if(G.mode==='tutorial'){tutShow();return;}
  if(G.state!=='play'||!z.snaps.length)return;
  var last=z.snaps[z.snaps.length-1];
  if(!(G.holdUsed&&!last.hu)){ // nothing done with this piece yet: step back a whole piece
    if(z.snaps.length<=1){popup('NOTHING TO UNDO','rgba(160,200,255,.85)',.7);return;}
    z.snaps.pop();last=z.snaps[z.snaps.length-1];
  }
  pzRestore(last);
  popup('UNDO','#9fe8ff',.8);sfx.hold();
}
function pzRetry(){
  if(!G||!G.pz)return;
  if(G.mode==='tutorial'){if(G.state==='play'||G.state==='pzwait'){G.pz.demo=null;G.pz.wait=0;pzRestore(G.pz.save);popup('RESTART STEP','#9fe8ff',.8);}return;}
  startGame('puzzle',{pz:G.pz.d.id,quick:true});
}
function openPacks(){var o=[];PZ_PACKS.forEach(function(pk,i){if(packOpen(pk))o.push(i);});return o;}
function pzNextId(d){ // the puzzle after this one (crossing into the next pack if it is open)
  var pk=PZ_PACKS[d.pi];
  if(d.i+1<pk.list.length)return pk.list[d.i+1].id;
  var np=PZ_PACKS[d.pi+1];
  return (np&&packOpen(np))?np.list[0].id:'';
}
function pzEnd(reason){
  if(!G||G.state==='over')return;
  var z=G.pz;
  G.over=reason;G.state='over';G.overT=0;G.cur=null;
  musicStop();
  S.stats.time+=G.time/1000;
  if(G.mode==='puzzle'&&reason!=='quit'){
    var d=z.d,r=S.puz[d.id]||(S.puz[d.id]={s:0,p:0,n:0}),before=openPacks();
    r.n++;
    z.res={stars:0,prev:r.s,prevP:r.p,used:G.pieces,first:!(r.s>0),newPacks:[]};
    if(reason==='solved'){
      var st=pzStarsFor(d,G.pieces);
      if(z.hinted)st=Math.min(st,2);
      z.res.stars=st;
      if(st>r.s)r.s=st;
      if(!r.p||G.pieces<r.p)r.p=G.pieces;
      ach('pz1');
      var pk=PZ_PACKS[d.pi];if(packSolved(pk)>=pk.list.length)ach('pzpack');
      checkProgressAch(false);checkThemes();
      openPacks().forEach(function(i){if(before.indexOf(i)<0){z.res.newPacks.push(PZ_PACKS[i].n);toast('Puzzle pack unlocked: '+PZ_PACKS[i].n,PZ_PACKS[i].d);}});
      sfx.win();confettiBurst();flash('255,240,160',.35);kick(4);
    }else{sfx.over();shake(.6);}
  }
  save();updateTouchUI();
}
function pzWaitStep(dt){
  var z=G.pz;z.wait-=dt;
  if(z.wait<=0){var f=z.then;z.then=null;z.wait=0;if(f)f();}
}
function pzWait(ms,f){G.pz.wait=ms;G.pz.then=f;G.state='pzwait';}
// ---- tutorial ----
function kl(a){ // what to press, for the coach text
  if(touchMode()!=='off'){return {hold:'HOLD',cw:'the rotate button',ccw:'the rotate-left button',hard:'HARD DROP',soft:'the down button',left:'left',right:'right',undo:(G&&G.mode==='tutorial')?'SHOW':'UNDO',retry:'Restart (pause menu)',hint:'Hint (pause menu)'}[a]||a;}
  return keyName(bindsFor(a)[0]);
}
function tutText(t){return String(t||'').replace(/\{(\w+)\}/g,function(m,a){return kl(a);});}
function tutStep(i){
  var z=G.pz,st=z.l.steps[i];
  z.step=i;z.demo=null;z.wait=0;z.then=null;
  G.pend.rot=0;G.pend.hold=false;
  if(!st.keep){
    G.hold.length=0;G.cur=null;G.holdUsed=false;G.combo=-1;G.b2b=false;G.b2bN=0;
    z.tgt=pzLoadBoard(st.b);pzQueue(st.q);
    spawnNext();
  }else{
    if(!G.cur)spawnNext();
    z.tgt=st.tg?pzTargets(st.tg):null;
  }
  if(G.state==='over')return;
  G.state='play';
  z.coach=tutText(st.t);
  z.save=pzSnapTake();
}
function tutPass(){
  var z=G.pz,l=z.l,st=l.steps[z.step];
  sfx.perk();popup(st.ok||'NICE!','#7fffb0',1.3);
  z.coach=tutText(st.ok2||'');
  if(z.step>=l.steps.length-1){
    S.tut[l.id]=1;save();
    checkProgressAch(false);checkThemes();
    pzWait(1500,function(){G.over='lesson';G.state='over';G.overT=0;musicStop();confettiBurst();sfx.win();updateTouchUI();});
  }else if(st.need==='hold')tutStep(z.step+1);
  else pzWait(1300,function(){tutStep(z.step+1);});
}
function tutFail(msg){
  var z=G.pz;
  sfx.warn();popup(msg||'NOT QUITE!','#ff9a9a',1.1,'Try again');
  pzWait(1300,function(){pzRestore(z.save);});
}
function tutAfter(){
  var z=G.pz,st=z.l.steps[z.step],ok=false,i;
  if(z.demo){z.demo=null;pzWait(1100,function(){pzRestore(z.save);popup('YOUR TURN!','#9fe8ff',1.1);});return;}
  if(st.need==='lines')ok=z.lastN>=st.k;
  else if(st.need==='ts')ok=z.lastTs===2&&z.lastN>=st.k;
  else if(st.need==='place'){ok=true;for(i=0;i<z.tgt.length;i+=2)if(!G.grid[z.tgt[i+1]][z.tgt[i]]){ok=false;break;}}
  if(ok){tutPass();return;}
  if(st.need==='ts'&&z.lastN>=st.k&&z.lastTs===0)tutFail('NO SPIN!');
  else if(st.need==='ts'&&z.lastTs===1)tutFail('MINI SPIN!');
  else tutFail(st.need==='hold'?'HOLD FIRST!':'NOT QUITE!');
}
function tutHold(){
  var z=G.pz,st=z.l.steps[z.step];
  if(z.demo){z.demo=null;pzWait(900,function(){pzRestore(z.save);popup('YOUR TURN!','#9fe8ff',1.1);});return;}
  if(st.need==='hold')tutPass();
}
function tutShow(){ // "Show me": the game plays the step's moves, then hands control back
  var z=G.pz,st=z.l.steps[z.step];
  if(!st.demo||(G.state!=='play'&&G.state!=='pzwait'))return;
  pzRestore(z.save);
  z.demo={s:st.demo,i:0,t:-350};
  popup('WATCH!','#ffd96b',.9);
}
function demoStep(dt){
  var dm=G.pz.demo;dm.t+=dt;
  while(dm&&G.state==='play'&&dm.i<dm.s.length){
    var ch=dm.s.charAt(dm.i),wait=(ch==='D')?45:170;
    if(dm.t<wait)break;
    dm.t-=wait;dm.i++;
    switch(ch){
      case 'L':tryMove(-1,0);break;case 'R':tryMove(1,0);break;case 'D':stepDown(true);break;
      case 'C':tryRotate(1);break;case 'W':tryRotate(-1);break;case 'F':tryRotate(2);break;
      case 'H':doHold();break;case 'X':hardDrop();break;
    }
    dm=G.pz.demo;
  }
}

// ---------- end of game / records ----------
function recordScore(){
  var m=G.mode,list=S.best[m]||(S.best[m]=[]),isTime=(m==='sprint');
  if(G.daily&&m!=='daily')return -1; // daily sprint/ultra results live in the daily history
  if(isTime){if(G.over!=='win')return -1;}else if(G.score<=0)return -1;
  var e={s:G.score,l:G.lines,t:Math.round(G.time),lv:G.level,f:G.floor,d:today(),n:S.set.name};
  list.push(e);
  list.sort(isTime?function(a,b){return a.t-b.t;}:function(a,b){return b.s-a.s;});
  var idx=list.indexOf(e);
  if(list.length>5)list.length=5;
  return idx>=5?-1:idx;
}
function endGame(reason){
  if(!G||G.state==='over')return;
  if(G.pz){pzEnd(reason);return;}
  G.over=reason;G.state='over';G.overT=0;
  musicStop();
  S.stats.games++;S.stats.time+=G.time/1000;S.stats.score+=G.score;
  if(G.surge&&G.floor>S.stats.bestFloor)S.stats.bestFloor=G.floor;
  G.rank=recordScore();G.record=(G.rank===0);
  G.rk=rateRun(reason);
  if(G.daily)G.dres=recordDaily(reason);
  if(G.mode==='sprint'&&reason==='win'){if(G.time<120000)ach('sprint2');if(G.time<60000)ach('sprint1');}
  if(G.mode==='ultra'&&G.score>=20000)ach('ultra');
  if(G.mode==='ultra'&&G.score>=50000)ach('ultra50');
  if(G.pieces>=100&&G.time>0&&G.pieces/(G.time/1000)>=2)ach('pps2');
  if(S.stats.lines>=1000)ach('lines1000');
  if(S.stats.lines>=5000)ach('lines5000');
  if(S.stats.games>=25)ach('games25');
  if(S.stats.games>=100)ach('games100');
  checkProgressAch(false);
  checkThemes();
  save();
  if(reason==='win'||reason==='time'){sfx.win();confettiBurst();}
  else if(reason==='quit'){}
  else{sfx.over();shake(1);}
  updateTouchUI();
}
// ---- rank ladder: each finished run moves your rating toward how well that run played ----
function perfOf(m,reason){
  var tab=RANKED[m].tab;
  if(m==='sprint'){
    if(reason==='win')return interp(tab,G.time/1000);
    if(G.lines<4)return 0;
    return interp(tab,G.time/1000*SPRINT_LINES/G.lines*1.35); // topped out: judged on a slowed-down pace
  }
  if(m==='surge')return interp(tab,G.floor+Math.min(.95,G.target?G.floorLines/G.target:0));
  return interp(tab,G.score);
}
function rateRun(reason){
  var m=G.mode;
  if(G.daily||!RANKED[m])return null;
  if(G.pieces<10&&!(m==='sprint'&&reason==='win'))return {mode:m,skip:true};
  var perf=Math.round(perfOf(m,reason)),R=rankRec(m),before=R.r,wasPlaced=R.n>=PLACE,bt=tierOf(before);
  var res={mode:m,perf:perf,before:before,after:before,delta:0,placing:false,placed:false,promo:'',demo:false,tierUp:false};
  R.n++;
  if(!wasPlaced){
    R.pl.push(perf);
    if(R.n>=PLACE){
      var sum=0,mx=0;R.pl.forEach(function(v){sum+=v;if(v>mx)mx=v;});
      R.r=Math.round(.6*sum/R.pl.length+.4*mx);res.placed=true;res.promo='placed';
    }else res.placing=true;
  }else{
    var diff=perf-R.r,delta=Math.round(diff*(diff>=0?.3:.16));
    delta=diff>=0?clamp(delta,3,220):clamp(delta,-90,-2);
    R.r=Math.max(0,R.r+delta);
  }
  res.after=R.r;res.delta=R.r-before;
  var at=tierOf(R.r);res.tier=at;
  if(R.n>=PLACE){
    R.h.push(R.r);if(R.h.length>30)R.h.shift();
    if(R.r>R.pk)R.pk=R.r;
    if(wasPlaced){
      if(at.step>bt.step){res.promo='up';res.tierUp=at.t>bt.t;}
      else if(at.step<bt.step)res.demo=true;
    }
    for(var i=1;i<=at.t;i++)ach(RANK_ACH[i]);
    if(rankedModes()>=4)ach('rk_all');
  }
  return res;
}
// ---- daily challenge history ----
function recordDaily(reason){
  var D=S.daily,d=G.daily.d,k=G.daily.kind,h=D.h[d];
  var e={k:k,s:G.score,l:G.lines,t:Math.round(G.time),f:G.floor,w:(k==='sprint'&&reason==='win')?1:0,n:(h?h.n:0)+1};
  var better=!h||h.k!==k||dailyBetter(e,h);
  if(better)D.h[d]=e;else h.n=e.n;
  if(D.lastDay!==d){
    D.streak=(D.lastDay===prevDay(d))?(D.streak||0)+1:1;
    D.lastDay=d;D.days=(D.days||0)+1;
  }
  D.bestStreak=Math.max(D.bestStreak||0,D.streak||0);
  D.plays=(D.plays||0)+1;
  var ks=Object.keys(D.h).map(Number).sort(function(a,b){return b-a;});
  for(var i=60;i<ks.length;i++)delete D.h[ks[i]];
  ach('daily1');
  if(D.bestStreak>=3)ach('daily3');
  if(D.bestStreak>=7)ach('daily7');
  if(D.days>=10)ach('daily10');
  return {best:better,first:!h,tries:e.n,entry:D.h[d]};
}

// ---------- pause ----------
function pauseGame(){
  if(!G)return;
  if(G.state==='play'||G.state==='clear'||G.state==='banner'||G.state==='countdown'||G.state==='resume'||G.state==='pzwait'){
    if(G.state==='resume'){G.state='paused';}
    else{G.pstate=G.state;G.state='paused';}
    for(var k in held)held[k]=false;srcs={};
    musicStop();save();showPause();updateTouchUI();
  }
}
function resumeGame(){
  if(!G||G.state!=='paused')return;
  closeOv();
  if(G.pstate==='countdown'){G.state='countdown';}
  else if(G.pz){G.state=G.pstate||'play';initAudio();if(S.set.music>0)musicStart();} // nothing falls in puzzles, so no countdown
  else{G.state='resume';G.cd=1500;G.lastDigit=4;}
  initAudio();
  updateTouchUI();
}
function togglePause(){
  if(!G)return;
  if(G.state==='paused')resumeGame();else pauseGame();
}
function goMenu(){
  musicStop();
  if(G&&G.state!=='over')save();
  G=null;for(var k in held)held[k]=false;srcs={};
  showMenu();updateTouchUI();
}

