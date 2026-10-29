// ---------- game state ----------
var G=null;
var L={c:20,bx:0,by:0,m:12,W:1,H:1,pw:0,pad:4};
var parts=[],pops=[],rings=[],beams=[],shakeAmt=0,flashA=0,flashC='255,255,255';
var kickY=0,kickV=0,cellOX=0,lockFx={x:[0,0,0,0],y:[0,0,0,0],t:999};
var held={},srcs={};
function isHeld(a){return !!held[a];}
function newRow(){var r=new Array(COLS);for(var i=0;i<COLS;i++)r[i]=0;return r;}
function pkc(id){return (G&&G.pk[id])||0;}
function scoreLvl(){return G.surge?G.floor:G.level;}
function gravLevel(){return G.surge?Math.min(28,G.floor+Math.floor(G.floor/4)):G.level;}
function gravityMs(){
  if(G.pz)return 1e12; // puzzles: no gravity, line it up and hard drop
  if(G.mode==='zen')return 1100;
  var ms=1000*Math.pow(0.79,gravLevel()-1);
  if(G.surge){
    ms*=Math.pow(1.12,pkc('slow'));
    if(G.curse&&G.curse.b.id==='hourglass')ms/=(2+0.25*G.curse.cyc);
    if(G.dangerT&&pkc('secondwind'))ms*=1+1.5*pkc('secondwind');
  }
  return Math.max(ms,0.4);
}
function lockDelay(){return (G&&G.pz)?1e12:500+200*pkc('sticky');}
function maxResets(){return 15+5*pkc('sticky');}
function dirSign(){return (G&&G.curse&&G.curse.mir)?-1:1;}
function isBoss(f){return f%3===0;}
function floorTarget(f){var t=isBoss(f)?12-2*pkc('hunter'):(f>9?10:8)-pkc('steady');return Math.max(4,t);}
function themeCol(id){return theme().cols[id]||'#fff';}
function modeName(){return G.daily?DAILY_NAME[G.daily.kind]:MODES[G.mode].name;}

function startGame(mode,opts){
  opts=opts||{};
  initAudio();musicStop();
  var daily=null;
  if(mode==='daily'){daily=dailyInfo(today());if(daily.kind!=='surge')mode=daily.kind;}
  var seed=daily?daily.seed:((Math.random()*4294967296)>>>0);
  var surge=(mode==='surge'||mode==='daily');
  var lv=(mode==='marathon')?clamp(opts.level||S.last.lv||1,1,15):1;
  // separate random streams so player choices never change the piece sequence (daily seed = same pieces for everyone)
  G={mode:mode,surge:surge,seed:seed,daily:daily,rb:mulberry32(seed),rp:mulberry32((seed^0x9e3779b9)>>>0),
    rd:mulberry32((seed^0x85ebca6b)>>>0),re:mulberry32((seed^0xc2b2ae35)>>>0),rx:mulberry32((seed^0x27d4eb2f)>>>0),rboss:mulberry32((seed^0x1b873593)>>>0),
    grid:[],cur:null,bag:[],queue:[],hold:[],holdUsed:false,made:0,
    score:0,lines:0,level:lv,startLevel:lv,time:0,pieces:0,combo:-1,b2b:false,b2bN:0,keepLeft:0,lc:0,cpulse:9999,bpulse:9999,
    state:'countdown',pstate:'',cd:2400,lastDigit:4,acc:0,lockT:0,resets:0,lowest:0,lastRot:false,lastKick:0,
    dasDir:0,dasT:0,autoMoved:0,lastDir:0,clear:null,chain:0,frost:0,pend:{rot:0,hold:false},vis:1,
    st:{tspins:0,tetrises:0,pcs:0,maxCombo:0,powers:0,holds:0,bosses:0,lines:0,b2bs:0,b2bMax:0},
    floor:1,floorLines:0,target:8,pk:{},perkLog:[],meter:0,curse:null,banner:null,draft:null,hint:null,
    bossOrd:[],ice:new Array(COLS),iceT:new Array(COLS),ward:0,giftGiven:false,
    over:'',overT:0,shown:false,rank:-1,record:false,rk:null,dres:null,promoDone:false,dangerT:0,seenDanger:false,pz:null};
  for(var i=0;i<COLS;i++){G.ice[i]=0;G.iceT[i]=0;}
  for(var y=0;y<ROWS;y++)G.grid.push(newRow());
  refill();
  parts.length=0;pops.length=0;rings.length=0;beams.length=0;shakeAmt=0;flashA=0;kickY=0;kickV=0;lockFx.t=999;
  mus.idx=0;mus.pos=0;mus.bpm=132;
  if(mode==='puzzle'||mode==='tutorial')pzBegin(opts);
  closeOv();
  try{if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();}catch(e){}
  try{cv.focus();}catch(e){}
  for(var k in held)held[k]=false;srcs={};
  updateTouchUI();
  sfx.ready();
}

// ---------- pieces / bag ----------
function refill(){
  if(G.mode==='puzzle'||G.mode==='tutorial')return; // fixed queue
  while(G.queue.length<8){
    if(G.bag.length===0){
      // the 7-bag always comes from its own stream; perk extras are slotted in with a separate stream
      var b=[0,1,2,3,4,5,6],ex=pkc('ilove'),et=pkc('tparty'),i;
      shuffle(b,G.rb);
      for(i=0;i<ex;i++)b.splice(Math.floor(G.rx()*(b.length+1)),0,0);
      for(i=0;i<et;i++)b.splice(Math.floor(G.rx()*(b.length+1)),0,5);
      G.bag=b;
    }
    G.queue.push(makePiece(G.bag.pop()));
  }
}
function pickPower(r){
  var f=G.floor,w=[0,30,26,f>=2?14:0,f>=3?14:0,14*(1+2*pkc('midas'))],tot=0,i;
  for(i=1;i<=5;i++)tot+=w[i];
  r*=tot;
  for(i=1;i<=5;i++){if(r<w[i])return i;r-=w[i];}
  return 1;
}
function makePiece(t){
  var p={t:t,pi:-1,pt:0};
  if(G.surge){
    G.made++;
    var r1=G.rp(),r2=G.rp(),r3=G.rp(); // always 3 draws per piece so the stream stays in step
    if(G.made>3){
      var ch=0.20+0.07*pkc('charged')+Math.min(.10,G.floor*.01);
      if(r1<ch){p.pi=Math.floor(r2*4);p.pt=pickPower(r3);}
    }
  }
  return p;
}
function fits(t,r,x,y){
  var s=SHAPES[t][r],ice=G.ice;
  for(var i=0;i<4;i++){
    var cx=x+s[i][0],cy=y+s[i][1];
    if(cx<0||cx>=COLS||cy<0||cy>=ROWS||G.grid[cy][cx]||cy<ice[cx])return false;
  }
  return true;
}
function colTop(x){for(var y=0;y<ROWS;y++)if(G.grid[y][x])return y;return ROWS;}
function spawn(pc){
  G.cur={t:pc.t,r:0,x:3,y:HID-1,pi:pc.pi,pt:pc.pt};
  G.lockT=0;G.resets=0;G.lowest=G.cur.y;G.acc=0;G.lastRot=false;G.lastKick=0;
  return fits(G.cur.t,0,3,HID-1);
}
function spawnNext(){
  if(G.pz&&!G.queue.length){ // the fixed queue ran out: a piece in the Hold box is your last one
    if(G.hold.length)G.queue.push(G.hold.shift());
    else{pzEnd('out');return;}
  }
  var pc=G.queue.shift();refill();
  if(!spawn(pc)){G.queue.unshift(pc);G.cur=null;if(topOut())spawnNext();return;}
  G.state='play';
  if(G.pz)pzSnap();
  if(pc.pt&&!S.seen['p'+pc.pt]){S.seen['p'+pc.pt]=1;save();G.hint={text:POWERS[pc.pt].n.toUpperCase()+' BLOCK: '+POWERS[pc.pt].d,t:5200};}
  var rot=G.pend.rot,hd=G.pend.hold;G.pend.rot=0;G.pend.hold=false;
  if(rot)tryRotate(rot);
  if(hd)doHold();
}
function topOut(){
  if(G.mode==='zen'){wipe(0,ROWS);popup('FRESH START','#9ff',1.2);sfx.level();return true;}
  if(G.surge&&pkc('phoenix')>0){G.pk.phoenix--;wipe(0,ROWS-8);popup('PHOENIX!','#ffb84a',1.6);sfx.perk();flash('255,170,60',.6);shake(1);return true;}
  endGame('top');return false;
}
function wipe(y0,y1){
  for(var y=y0;y<y1;y++)for(var x=0;x<COLS;x++){
    var v=G.grid[y][x];
    if(v){if(y>=HID)burstCell(x,y,themeCol(v&15),3,1);G.grid[y][x]=0;}
  }
}

// ---------- movement ----------
function afterMove(){
  var c=G.cur;if(!c)return;
  if(c.y>G.lowest){G.lowest=c.y;G.resets=0;G.lockT=0;}
  var gr=!fits(c.t,c.r,c.x,c.y+1);
  if(gr){if(G.resets<maxResets()){if(G.lockT>0)G.resets++;G.lockT=0;}}
  else G.lockT=0;
}
function tryMove(dx,dy){
  var c=G.cur;if(!c)return false;
  if(fits(c.t,c.r,c.x+dx,c.y+dy)){c.x+=dx;c.y+=dy;G.lastRot=false;afterMove();if(dx)sfx.move();return true;}
  return false;
}
function stepDown(soft){
  var c=G.cur;
  if(fits(c.t,c.r,c.x,c.y+1)){c.y++;G.lastRot=false;if(soft)G.score+=1;afterMove();return true;}
  return false;
}
var K180=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1]];
function tryRotate(dir){
  var c=G.cur;if(!c||c.t===3)return false;
  var from=c.r,to=(c.r+(dir===2?2:(dir>0?1:3)))%4,list;
  if(dir===2)list=K180;else list=(c.t===0?KICK_I:KICK_JLSTZ)[''+from+to];
  for(var i=0;i<list.length;i++){
    var nx=c.x+list[i][0],ny=c.y-list[i][1];
    if(fits(c.t,to,nx,ny)){c.r=to;c.x=nx;c.y=ny;G.lastRot=true;G.lastKick=(dir===2?0:i);afterMove();sfx.rot();return true;}
  }
  return false;
}
function dropDist(){var c=G.cur,d=0;while(fits(c.t,c.r,c.x,c.y+d+1))d++;return d;}
function doHold(){
  if(!G.cur||G.holdUsed||G.state!=='play')return;
  var cap=1+(pkc('pocket')?1:0),c=G.cur,mine={t:c.t,pi:c.pi,pt:c.pt},next;
  if(G.pz&&G.hold.length<cap&&!G.queue.length){sfx.warn();popup('NO PIECES LEFT TO SWAP','#ff9a9a',.8);return;}
  G.holdUsed=true;G.st.holds++;S.stats.holds++;sfx.hold();
  if(G.hold.length<cap){G.hold.push(mine);next=G.queue.shift();refill();}
  else{next=G.hold.shift();G.hold.push(mine);}
  if(!spawn(next)){G.cur=null;if(topOut())spawnNext();return;}
  if(G.pz&&G.mode==='tutorial')tutHold();
}
function hardDrop(){
  if(!G.cur||G.state!=='play')return;
  var c=G.cur,d=dropDist(),s=SHAPES[c.t][c.r];
  if(d>0&&S.set.fx>0){
    for(var i=0;i<4;i++){
      var px=L.bx+(c.x+s[i][0]+.5)*L.c,py0=L.by+(c.y+s[i][1]-HID)*L.c,py1=py0+d*L.c;
      var n=S.set.fx===2?3:1;
      for(var k=0;k<n;k++)parts.push({x:px+(Math.random()-.5)*L.c*.6,y:lerp(py0,py1,Math.random()),vx:0,vy:L.c*3,g:0,l:240,m:240,s:Math.max(1,L.c*.08),c:'rgba(255,255,255,.7)'});
    }
  }
  c.y+=d;if(d>0)G.lastRot=false;
  var hh=pkc('hardhit');
  G.score+=2*d*(1+hh);sfx.hard();shake(d>0?.3:.12);vibe(10);kick(2+Math.min(d,20)*.12);
  if(hh&&G.surge)addMeter(hh);
  lockPiece();
}
function tCorners(c){
  var occ=function(x,y){return x<0||x>=COLS||y>=ROWS||(y>=0&&G.grid[y][x]);};
  var A=occ(c.x,c.y),B=occ(c.x+2,c.y),C=occ(c.x,c.y+2),D=occ(c.x+2,c.y+2),front;
  switch(c.r){case 0:front=A&&B;break;case 1:front=B&&D;break;case 2:front=C&&D;break;default:front=A&&C;}
  var n=(A?1:0)+(B?1:0)+(C?1:0)+(D?1:0);
  if(n<3)return 0;
  return (front||G.lastKick===4)?2:1;
}
function lockPiece(){
  var c=G.cur;if(!c)return;
  var ts=(c.t===5&&G.lastRot)?tCorners(c):0;
  if(G.pz&&G.mode==='puzzle')pzTrack(c);
  var s=SHAPES[c.t][c.r],allHidden=true;
  for(var i=0;i<4;i++){
    var x=c.x+s[i][0],y=c.y+s[i][1];
    G.grid[y][x]=(c.t+1)|((i===c.pi?c.pt:0)<<4);
    lockFx.x[i]=x;lockFx.y[i]=y;
    if(y>=HID){allHidden=false;if(S.set.fx>0)burstCell(x,y,themeCol(c.t+1),S.set.fx===2?2:1,.5);}
  }
  lockFx.t=0;
  G.cur=null;G.holdUsed=false;G.pieces++;S.stats.pieces++;G.vis=1;
  sfx.lock();
  if(allHidden){if(!topOut())return;}
  afterLock(ts);
}
function fullRows(){
  var r=[];
  for(var y=0;y<ROWS;y++){var f=true;for(var x=0;x<COLS;x++){if(!G.grid[y][x]){f=false;break;}}if(f)r.push(y);}
  return r;
}
function gridEmpty(){for(var y=0;y<ROWS;y++)for(var x=0;x<COLS;x++)if(G.grid[y][x])return false;return true;}

// ---------- locking / line clears / power blocks ----------
var LN=['','SINGLE','DOUBLE','TRIPLE','TETRIS'];
function afterLock(ts){
  var rows=fullRows();
  G.lc=rows.length;
  if(rows.length===0){
    if(ts){
      var pts=(ts===2?400:100)*scoreLvl()*(1+.2*pkc('greed'))*(1+.5*pkc('spinner'));
      G.score+=Math.round(pts);G.st.tspins++;S.stats.tspins++;
      popup((ts===1?'MINI ':'')+'T-SPIN','#d58cff',1.2,'+'+fmtNum(pts));sfx.tspin();ach('tspin');
      if(G.surge)addMeter(10+5*pkc('spinner'));
    }
    if(G.pz)pzNote(0,ts);
    if(G.combo>=0&&G.keepLeft>0){G.keepLeft--;popup('COMBO KEPT','#7ff0ff',.8,G.keepLeft?G.keepLeft+' save left':'');}
    else{
      if(G.combo>=3)popup('COMBO x'+G.combo+' ENDED','rgba(160,200,255,.85)',.7);
      G.combo=-1;
    }
    nextTurn();
  }else beginClear(rows,{ts:ts,line:true});
}
function addMeter(v){
  if(!G.surge)return;
  var before=G.meter;
  G.meter=Math.min(100,G.meter+v*(1+.35*pkc('battery')));
  if(before<100&&G.meter>=100){popup('SURGE READY!','#ffb84a',1.2,'Press V or SURGE');sfx.ready();vibe(30);}
}
function beginClear(rows,o){
  var n=rows.length,lvl=scoreLvl(),cnt=0,pq=[],kill=new Uint8Array(ROWS*COLS);
  function mark(x,y){
    if(x<0||x>=COLS||y<0||y>=ROWS)return;
    var i=y*COLS+x;if(kill[i])return;
    var v=G.grid[y][x];if(!v)return;
    kill[i]=1;cnt++;if((v>>4)&7)pq.push([x,y,(v>>4)&7]);
  }
  var junkRows=0;
  rows.forEach(function(y){var g=0;for(var x=0;x<COLS;x++){if((G.grid[y][x]&15)===8)g++;mark(x,y);}if(g>=5)junkRows++;});
  var fxk={bombs:0,lasers:0,golds:0,frost:false,quake:false},powerCount=0,goldPts=0;
  while(pq.length){
    var q=pq.pop(),x=q[0],y=q[1],p=q[2];powerCount++;
    if(p===1){
      var r=2+pkc('bigbomb');fxk.bombs++;
      rings.push({x:x,y:y,r:r,t:0,life:520,col:'255,170,60'});
      for(var dy=-r;dy<=r;dy++)for(var dx=-r;dx<=r;dx++)if(dx*dx+dy*dy<=r*r+r)mark(x+dx,y+dy);
    }else if(p===2){
      var w=pkc('widelaser');fxk.lasers++;
      beams.push({x:x,w:w,t:0,life:520});
      for(var xx=x-w;xx<=x+w;xx++)for(var yy=0;yy<ROWS;yy++)mark(xx,yy);
    }else if(p===3){fxk.frost=true;}
    else if(p===4){fxk.quake=true;}
    else if(p===5){fxk.golds++;goldPts+=300*lvl*(1+2*pkc('midas'));
      var cc=cellCenter(x,y);spark(cc.x,cc.y,'#ffd23a',10,1.2);}
  }
  var pts=0,ts=o.ts||0,b2bHit=false,sub=[];
  if(o.line){
    var base;
    if(ts===2)base=[400,800,1200,1600][n];
    else if(ts===1)base=[100,200,400][n]||400;
    else base=[0,100,300,500,800][n]||800;
    var hard=(n>=4)||ts>0,brokeB2B=0;
    if(hard){
      if(G.b2b){base*=1.5;b2bHit=true;G.st.b2bs++;G.b2bN++;G.bpulse=0;
        if(G.b2bN>G.st.b2bMax)G.st.b2bMax=G.b2bN;if(G.b2bN>S.stats.b2bMax)S.stats.b2bMax=G.b2bN;}
      else G.b2bN=0;
      G.b2b=true;
    }else{if(G.b2bN>=2)brokeB2B=G.b2bN;G.b2b=false;G.b2bN=0;}
    if(ts&&pkc('spinner'))base*=1+.5*pkc('spinner');
    if(n>=4&&pkc('quad'))base*=1+.5*pkc('quad');
    pts+=base*lvl;
    if(!o.chain){G.combo++;G.keepLeft=pkc('keeper');if(G.combo>0)G.cpulse=0;}
    if(G.combo>0){pts+=50*G.combo*lvl*(1+pkc('combofuel'));if(G.combo>G.st.maxCombo)G.st.maxCombo=G.combo;if(G.combo>S.stats.maxCombo)S.stats.maxCombo=G.combo;}
    if(o.chain)pts*=1.5;
    if(junkRows&&pkc('junkbreak'))pts+=300*lvl*junkRows*pkc('junkbreak');
    G.lines+=n;G.floorLines+=n;G.st.lines+=n;S.stats.lines+=n;
    if(n===4){G.st.tetrises++;S.stats.tetrises++;}
    if(ts){G.st.tspins++;S.stats.tspins++;}
    ach('first');
    if(n===4)ach('tetris');
    if(G.st.tetrises>=10)ach('tetris10');
    if(ts)ach('tspin');
    if(ts&&n>=2)ach('tspin2');
    if(G.combo>=5)ach('combo5');
    if(G.combo>=10)ach('combo10');
    if(b2bHit)ach('b2b');
    if(G.b2bN>=5)ach('b2b5');
    if(G.pz)pzNote(n,ts);
    // Floodgate boss: every line cleared blocks one incoming junk row
    var cu=G.curse;
    if(cu&&cu.b.id==='flood'&&cu.inc>0){var cn=Math.min(cu.inc,n+(ts?1:0));cu.inc-=cn;popup('BLOCKED '+cn+' JUNK','#9fe8ff',.85);}
  }else{pts+=150*lvl*n;}
  var extra=cnt-(o.line?n*COLS:0);
  if(extra>0)pts+=extra*10*lvl;
  pts+=goldPts;
  pts*=1+.2*pkc('greed');
  if(o.shock&&pkc('aftershock'))pts*=1+pkc('aftershock');
  pts=Math.round(pts);G.score+=pts;
  if(powerCount&&cnt>=25)ach('bomb');
  // meter
  if(G.surge&&o.line){
    var gain=([0,6,12,20,34][n]||34)+(ts?12+5*pkc('spinner'):0)+powerCount*3;
    if(G.combo>1)gain+=pkc('combofuel')*3;
    if(n>=4)gain+=15*pkc('quad');
    if(junkRows)gain+=8*junkRows*pkc('junkbreak');
    addMeter(gain);
  }
  if(G.surge&&powerCount&&pkc('conductor'))addMeter(6*powerCount*pkc('conductor'));
  // stats for power blocks
  if(powerCount){G.st.powers+=powerCount;S.stats.powers+=powerCount;}
  S.stats.bombs+=fxk.bombs;S.stats.lasers+=fxk.lasers;S.stats.golds+=fxk.golds;
  if(fxk.lasers)ach('laser');
  // popups + sounds
  var big=n===4||ts>0||fxk.bombs>0||fxk.lasers>0;
  if(o.line){
    var title=(ts?(ts===1?'MINI T-SPIN ':'T-SPIN '):'')+LN[n];
    if(o.chain)title='CHAIN! '+title;
    popup(title,ts?'#d58cff':(n===4?'#ffe24a':'#fff'),n===4||ts?1.5:1.1,'+'+fmtNum(pts));
    if(b2bHit)popup(G.b2bN>1?'BACK-TO-BACK x'+G.b2bN:'BACK-TO-BACK','#ffb84a',.9+Math.min(.4,G.b2bN*.06),'+50% bonus');
    else if(brokeB2B)popup('B2B STREAK ENDED','rgba(255,190,120,.85)',.7);
    if(G.combo>0&&!o.chain)popup('COMBO x'+G.combo,comboCol(G.combo),.95+Math.min(.55,G.combo*.05));
    if(junkRows&&pkc('junkbreak'))popup('JUNK BROKEN x'+junkRows,'#c8d0e0',.8);
    if(ts)sfx.tspin();
    sfx.clear(n,big);
    if(G.combo>0&&!o.chain)setTimeout(function(){if(G)sfx.combo(G.combo);},120);
    if(b2bHit)setTimeout(function(){sfx.b2b();},60);
    if(n===4){flash('255,240,160',.35);kick(6);
      if(S.set.fx>0)rings.push({x:4.5,y:rows[rows.length-1]-1.5,r:6,t:0,life:620,col:'255,230,140'});}
    else kick(1+n*.8);
  }else popup('+'+fmtNum(pts),'#ffb84a',1.2);
  if(fxk.bombs){sfx.bomb();shake(1.4);popup('BOOM! '+cnt+' blocks','#ffb04a',1.1);flash('255,160,60',.45);vibe(60);}
  if(fxk.lasers){sfx.laser();shake(.8);popup('LASER!','#7ff4ff',1.1);}
  if(fxk.golds){sfx.gold();popup('GOLD +'+fmtNum(goldPts),'#ffd23a',1.1);}
  if(fxk.frost){
    G.frost=5000+4000*pkc('deepfreeze');sfx.frost();popup('FROZEN!','#bff0ff',1.2,'Gravity stops for '+Math.round(G.frost/1000)+'s');S.stats.frosts++;flash('160,230,255',.3);
  }
  if(fxk.quake){S.stats.quakes++;sfx.quake();shake(1.5);popup('QUAKE!','#ffc46b',1.2);vibe(80);}
  // particles from cleared cells
  for(var yy2=0;yy2<ROWS;yy2++)for(var xx2=0;xx2<COLS;xx2++){
    if(kill[yy2*COLS+xx2]&&yy2>=HID-1){
      var v=G.grid[yy2][xx2],cc2=cellCenter(xx2,yy2);
      spark(cc2.x,cc2.y,themeCol(v&15),S.set.fx===2?(n===4?5:3):1,n===4?1.6:1);
    }
  }
  if(n===4||big)shake(.55);else shake(.22);
  if(o.line&&(n===4||ts))vibe(25);
  var dur=S.set.fx===2?(n===4||big?560:400):(S.set.fx===1?280:140);
  G.clear={rows:rows,kill:kill,t:0,dur:dur,quake:fxk.quake,line:!!o.line,n:n,keepCur:!!o.keepCur,cnt:cnt};
  G.state='clear';
}
function clearStep(dt){
  G.time+=dt;
  if(G.mode==='ultra'&&G.time>=ULTRA_MS){G.time=ULTRA_MS;endGame('time');return;}
  das(dt,true);
  if(G.frost>0)G.frost=Math.max(0,G.frost-dt);
  G.clear.t+=dt;
  if(G.clear.t>=G.clear.dur)endClear();
}
function endClear(){
  var c=G.clear,i;
  for(var y=0;y<ROWS;y++)for(var x=0;x<COLS;x++)if(c.kill[y*COLS+x])G.grid[y][x]=0;
  var rs={};c.rows.forEach(function(y){rs[y]=1;});
  var ng=[],removed=0;
  for(y=0;y<ROWS;y++){if(rs[y])removed++;else ng.push(G.grid[y]);}
  while(removed-->0)ng.unshift(newRow());
  G.grid=ng;
  if(c.quake)sandGravity();
  G.clear=null;
  var rows2=fullRows();
  if(rows2.length){G.chain++;beginClear(rows2,{line:true,chain:true,keepCur:c.keepCur});return;}
  G.chain=0;
  if(c.line&&gridEmpty()){
    var pc=[800,1200,1800,2000][Math.min(c.n,4)-1]||800;
    pc*=scoreLvl();if(c.n===4&&G.b2b)pc=Math.round(pc*1.6);
    pc=Math.round(pc*(1+.2*pkc('greed'))*(pkc('nova')?3:1));
    G.score+=pc;G.st.pcs++;S.stats.pcs++;
    popup(pkc('nova')?'NOVA CLEAR!':'PERFECT CLEAR!','#ffe24a',1.8,'+'+fmtNum(pc));sfx.pc();flash('255,255,200',.6);shake(1);ach('pc');kick(8);
    confettiBurst();
    if(G.surge)addMeter(pkc('nova')?100:40);
  }
  if(c.keepCur&&G.cur){G.state='play';afterMove();return;}
  nextTurn();
}
function sandGravity(){
  var moved=false;
  for(var x=0;x<COLS;x++){
    var w=ROWS-1;
    for(var y=ROWS-1;y>=0;y--){
      var v=G.grid[y][x];
      if(v){if(w!==y){G.grid[w][x]=v;G.grid[y][x]=0;moved=true;}w--;}
    }
  }
  if(moved&&S.set.fx>0)for(var k=0;k<(S.set.fx===2?30:8);k++)parts.push({x:L.bx+Math.random()*COLS*L.c,y:L.by+(.4+Math.random()*.6)*VIS*L.c,vx:(Math.random()-.5)*L.c*2,vy:-Math.random()*L.c*2,g:L.c*6,l:600,m:600,s:Math.max(1.5,L.c*.12),c:'rgba(255,196,107,.8)'});
}
function updateLevel(){
  if(G.mode==='marathon'||G.mode==='ultra'){
    var nl=Math.min(30,(G.mode==='marathon'?G.startLevel:1)+Math.floor(G.lines/10));
    if(nl>G.level){
      G.level=nl;levelFx();mus.bpm=Math.min(172,132+nl*2);
      if(G.mode==='marathon'&&nl>=10)ach('lvl10');
      if(G.mode==='marathon'&&nl>=20)ach('lvl20');
    }
  }
}
function levelFx(){
  popup('LEVEL '+G.level,'#7ff0ff',1.6);sfx.level();flash('120,220,255',.3);shake(.4);
  for(var i=0;i<(S.set.fx===2?36:(S.set.fx===1?10:0));i++){
    var a=Math.random()*6.283,sp=L.c*(3+Math.random()*7);
    parts.push({x:L.bx+COLS*L.c/2,y:L.by+VIS*L.c*.45,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,g:L.c*5,l:900,m:900,s:Math.max(2,L.c*.15),c:'rgba(127,240,255,.9)'});
  }
}
function nextTurn(){
  if(G.state==='over')return;
  if(G.pz){pzAfter();return;}
  updateLevel();
  if(G.mode==='sprint'&&G.lines>=SPRINT_LINES){endGame('win');return;}
  if(G.surge){
    curseOnLock();
    if(G.state==='over')return;
    if(G.floorLines>=G.target){floorComplete();return;}
  }
  spawnNext();
}

