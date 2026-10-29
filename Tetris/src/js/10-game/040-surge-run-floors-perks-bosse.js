// ---------- Surge Run: floors, perks, bosses ----------
function bossFor(f){
  // every lap through the boss list is shuffled from its own seeded stream (daily: same bosses for everyone)
  var idx=f/3-1,lap=Math.floor(idx/BOSSES.length);
  while(G.bossOrd.length<=lap){var o=[];for(var i=0;i<BOSSES.length;i++)o.push(i);G.bossOrd.push(shuffle(o,G.rboss));}
  return BOSSES[G.bossOrd[lap][idx%BOSSES.length]];
}
function startFloor(f){
  if(G.curse)endCurse();
  G.floor=f;G.target=floorTarget(f);
  if(f>S.stats.bestFloor)S.stats.bestFloor=f;
  if(f>=5)ach('floor5');
  if(f>=10)ach('floor10');
  if(f>=15)ach('floor15');
  var gift='';
  if(f===1&&G.daily&&G.daily.gift&&!G.giftGiven){
    var gid=G.daily.gift;G.giftGiven=true;G.pk[gid]=(G.pk[gid]||0)+1;G.perkLog.push(gid);
    gift=PERK_BY[gid].n;G.target=floorTarget(f);
  }
  var sw=2*pkc('sweeper');
  if(sw>0){
    wipe(ROWS-sw,ROWS);
    var ng=G.grid.slice(0,ROWS-sw);while(ng.length<ROWS)ng.unshift(newRow());G.grid=ng;
  }
  if(pkc('overcharge'))G.meter=Math.max(G.meter,Math.min(100,40*pkc('overcharge')));
  mus.bpm=Math.min(172,132+f*3);
  if(isBoss(f)){
    var idx=f/3-1,b=bossFor(f);
    G.curse={b:b,cyc:Math.floor(idx/5),cnt:0,t:0,mir:false,warned:false,peek:0,inc:0,ft:0,flip:false,fk:0,
      dir:G.re()<.5?-1:1,shifts:0,slide:0,sdir:1};
    G.ward=2*pkc('ward');
    if(b.id==='blind')G.curse.peek=2200; // one last look once play starts, then the lights go out
    G.banner={t:0,dur:2800,title:b.name,sub:b.desc,sub2:G.ward?'Your Boss Ward blocks '+G.ward+' attacks':'',next:'play',boss:true};sfx.boss();shake(.8);
  }else{
    var nb=isBoss(f+1)?bossFor(f+1):null;
    G.banner={t:0,dur:(gift||nb)?2000:1300,title:'FLOOR '+f,sub:'Clear '+G.target+' lines',
      sub2:gift?'DAILY GIFT: '+gift.toUpperCase():(nb?'NEXT FLOOR BOSS: '+nb.name:''),next:'play'};sfx.ready();
  }
  G.state='banner';G.cur=null;
}
function floorComplete(){
  var boss=isBoss(G.floor),bonus=1000*G.floor*(boss?3*(1+.5*pkc('hunter')):1);
  G.floorLines-=G.target;if(G.floorLines<0)G.floorLines=0;
  bonus=Math.round(bonus*(1+.2*pkc('greed')));
  G.score+=bonus;
  if(boss){
    G.st.bosses++;S.stats.bosses++;ach('boss');
    var bid=G.curse?G.curse.b.id:'';
    if(bid){S.kills[bid]=(S.kills[bid]||0)+1;if(BOSS_ACH[bid])ach(BOSS_ACH[bid]);}
    if(S.stats.bosses>=10)ach('bosses10');
    if(bossKinds()>=BOSSES.length)ach('bestiary');
  }
  G.banner={t:0,dur:1700,title:boss?'BOSS DEFEATED!':'FLOOR '+G.floor+' CLEARED',sub:'+'+fmtNum(bonus)+' bonus',next:'draft',boss:boss};
  G.state='banner';G.cur=null;
  if(boss){sfx.win();flash('255,220,120',.5);confettiBurst();shake(1);kick(5);}else{sfx.level();flash('120,220,255',.25);}
  vibe(40);
  endCurse();
}
function endCurse(){
  for(var x=0;x<COLS;x++)if(G.ice[x])melt(x,true);
  G.curse=null;G.ward=0;
}
function makeDraft(boss){
  var W=boss?{common:20,uncommon:45,rare:35}:{common:60,uncommon:30,rare:10};
  var pool=PERKS.filter(function(p){return (G.pk[p.id]||0)<p.max;}),out=[],want=3+pkc('wide');
  while(out.length<want&&pool.length){
    var tot=0;pool.forEach(function(p){tot+=W[p.r];});
    var r=G.rd()*tot,pick=pool[0];
    for(var i=0;i<pool.length;i++){r-=W[pool[i].r];if(r<=0){pick=pool[i];break;}}
    out.push(pick.id);pool.splice(pool.indexOf(pick),1);
  }
  return out;
}
function openDraft(boss){
  G.draft={cards:makeDraft(boss),rerolls:1+pkc('lucky'),boss:boss};
  G.state='draft';
  showDraft();
}
function pickPerk(id){
  if(!G||G.state!=='draft')return;
  if(id==='skip'){G.score+=Math.round(1000*G.floor);addMeter(50);popup('SKIPPED +BONUS','#fff',1);}
  else{
    if(!PERK_BY[id])return;
    G.pk[id]=(G.pk[id]||0)+1;G.perkLog.push(id);sfx.perk();
    S.pseen[id]=1;
    var tot=0;for(var k in G.pk)tot+=G.pk[k];
    if(tot>=8)ach('perks');
    if(cntKeys(S.pseen)>=20)ach('perkdex');
  }
  G.draft=null;closeOv();
  startFloor(G.floor+1);
}
function rerollDraft(){
  if(!G||!G.draft||G.draft.rerolls<=0)return;
  G.draft.rerolls--;G.draft.cards=makeDraft(G.draft.boss);sfx.click();showDraft();
}
function bannerStep(dt){
  var b=G.banner;b.t+=dt;
  if(b.t>=b.dur){
    G.banner=null;
    if(b.next==='draft')openDraft(b.boss);
    else if(b.next==='tut')tutStep(0);
    else{
      spawnNext();
      if(G.state!=='over')G.state='play';
    }
  }
}
// ---- boss curses ----
function curseInterval(){
  var c=G.curse;if(!c)return 0;
  switch(c.b.id){
    case 'rumble':return Math.max(3,7-c.cyc);
    case 'hail':return Math.max(3,5-c.cyc);
    case 'blind':return Math.max(3,5-c.cyc);
    case 'conveyor':return Math.max(3,6-c.cyc);
    case 'cryo':return Math.max(3,5-c.cyc);
  }
  return 0;
}
function wardBlock(){
  if(G.ward>0){G.ward--;popup('WARD BLOCKED!','#9fe8ff',1.05,G.ward?G.ward+' block left':'Ward used up');sfx.ward();flash('160,230,255',.25);return true;}
  return false;
}
function curseOnLock(){
  var c=G.curse;if(!c)return;
  var id=c.b.id;
  if(id==='cryo')iceTick();
  if(id==='flood'){
    // queued junk only rises when you place a piece without clearing a line
    if(G.lc===0&&c.inc>0){
      var n=Math.min(c.inc,4);c.inc-=n;
      if(!wardBlock()){addGarbage(n);sfx.rumble();shake(1.1);popup('FLOOD! +'+n+' JUNK','#ff7a7a',1.15);vibe(50);}
    }
    return;
  }
  var iv=curseInterval();
  if(!iv)return;
  c.cnt++;
  if(c.cnt<iv)return;
  c.cnt=0;
  if(id==='blind'){c.peek=1300+250*Math.max(0,2-c.cyc);popup('PEEK!','#c9b8ff',.9);sfx.peek();return;}
  if(wardBlock())return;
  if(id==='rumble'){addGarbage(1);sfx.rumble();shake(1.2);popup('JUNK RISES!','#ff7a7a',1.1);}
  else if(id==='hail'){hail(2+c.cyc);sfx.rumble();shake(.7);popup('HAIL!','#9ad8ff',1.1);}
  else if(id==='conveyor')shiftStack();
  else if(id==='cryo')freezeColumn();
}
function floodPeriod(){return Math.max(4500,8000-1000*(G.curse?G.curse.cyc:0));}
function curseUpdate(dt){
  var c=G.curse;if(!c)return;
  var id=c.b.id;
  if(id==='mirror'){
    c.t+=dt;
    var off=Math.max(5000,9000-1500*c.cyc),on=4500+700*c.cyc,p=c.t%(off+on),mir=p>=off;
    if(!c.warned&&p>=off-1500&&p<off){c.warned=true;popup('MIRROR SOON!','#ff9aff',1.1);sfx.warn();}
    if(mir!==c.mir){
      c.mir=mir;
      if(mir){popup('MIRRORED!','#ff5aff',1.4,'Left and right swapped');sfx.boss();shake(.5);}
      else{popup('NORMAL AGAIN','#9fe',1);c.warned=false;}
    }
  }else if(id==='upside'){
    c.t+=dt;
    var off2=Math.max(6000,11000-1500*c.cyc),on2=6500+1000*c.cyc,p2=c.t%(off2+on2),fl=p2>=off2;
    if(!c.warned&&p2>=off2-1600&&p2<off2){c.warned=true;popup('FLIP INCOMING!','#ffd27a',1.05);sfx.warn();}
    if(fl!==c.flip){
      c.flip=fl;sfx.flip();
      if(fl){popup('GRAVITY FLIPPED!','#ffb84a',1.4,'The board is upside-down');shake(.6);}
      else{popup('RIGHT SIDE UP','#9fe',1);c.warned=false;}
    }
  }else if(id==='flood'){
    var per=floodPeriod();
    c.ft+=dt;
    if(c.ft>=per){
      if(c.inc<8){c.ft-=per;c.inc++;popup('+1 JUNK INCOMING','#ff9a9a',.75);sfx.flood();}
      else c.ft=per;
    }
  }
}
function curseVisual(dt){ // animation timers that keep running during clears and banners
  var c=G.curse;if(!c)return;
  if(c.peek>0&&(G.state==='play'||G.state==='clear'))c.peek=Math.max(0,c.peek-dt);
  if(c.slide>0)c.slide=Math.max(0,c.slide-dt/220);
  var tgt=c.flip?1:0;
  if(c.fk!==tgt){var st=dt/520;c.fk=tgt>c.fk?Math.min(tgt,c.fk+st):Math.max(tgt,c.fk-st);}
}
function boardFlipScale(){
  var c=G&&G.curse;if(!c||c.b.id!=='upside'||c.fk<=0||G.state==='paused')return 1;
  var s=Math.cos(c.fk*Math.PI);
  return Math.abs(s)<.03?(s<0?-.03:.03):s;
}
function shiftStack(){
  var c=G.curse,d=c.dir,x,y,r,v;
  for(y=0;y<ROWS;y++){
    r=G.grid[y];
    if(d>0){v=r[COLS-1];for(x=COLS-1;x>0;x--)r[x]=r[x-1];r[0]=v;}
    else{v=r[0];for(x=0;x<COLS-1;x++)r[x]=r[x+1];r[COLS-1]=v;}
  }
  c.slide=1;c.sdir=d;c.shifts++;
  if(c.shifts%3===0)c.dir=-c.dir;
  popup(d>0?'STACK SHIFT >>':'<< STACK SHIFT','#ffd27a',1.05);sfx.shift();shake(.5);kick(1.5);
}
var ICE_COLS=[0,1,2,7,8,9];
function freezeColumn(){
  var c=G.curse,maxP=c.cyc>=1?3:2,act=0,x,i;
  for(x=0;x<COLS;x++)if(G.ice[x])act++;
  if(act>=maxP)return;
  var cand=ICE_COLS.filter(function(x){return !G.ice[x];});
  shuffle(cand,G.re);
  for(i=0;i<cand.length;i++){
    x=cand[i];
    var top=ROWS;
    for(var xx=Math.max(0,x-1);xx<=Math.min(COLS-1,x+1);xx++)top=Math.min(top,colTop(xx));
    var len=Math.min(5+c.cyc,top-HID-5);
    if(len<2)continue;
    G.ice[x]=HID+len;G.iceT[x]=7;
    popup('COLUMN FROZEN!','#bff0ff',1.05,'Slide under the ice. Melts in 7 pieces');sfx.freeze();shake(.4);
    if(S.set.fx>0)for(var yy=HID;yy<HID+len;yy++)burstCell(x,yy,'#dff6ff',2,.6);
    return;
  }
}
function iceTick(){
  for(var x=0;x<COLS;x++)if(G.ice[x]){G.iceT[x]--;if(G.iceT[x]<=0)melt(x);}
}
function melt(x,quiet){
  var b=G.ice[x];G.ice[x]=0;G.iceT[x]=0;
  if(S.set.fx>0)for(var y=HID;y<b;y++)burstCell(x,y,'#bfeaff',2,.5);
  if(!quiet)sfx.melt();
}
function addGarbage(n){
  var holes=1+pkc('junkbreak'),hs=[],overflow=false,x,i;
  while(hs.length<holes){var h=Math.floor(G.re()*COLS);if(hs.indexOf(h)<0)hs.push(h);}
  for(i=0;i<n;i++){
    for(x=0;x<COLS;x++)if(G.grid[0][x]){overflow=true;break;}
    G.grid.shift();
    var row=new Array(COLS);for(x=0;x<COLS;x++)row[x]=(hs.indexOf(x)>=0)?0:8;
    G.grid.push(row);
    if(G.cur&&!fits(G.cur.t,G.cur.r,G.cur.x,G.cur.y))G.cur.y--;
  }
  kick(-1.5*n);
  if(overflow){topOut();}
}
function hail(n){
  for(var i=0;i<n;i++){
    var x=Math.floor(G.re()*COLS),y=HID;
    while(y<ROWS&&!G.grid[y][x])y++;
    if(y-1>=HID+1){G.grid[y-1][x]=8;var cc=cellCenter(x,y-1);spark(cc.x,cc.y,'#9ad8ff',5,.8);}
  }
}
function fireSurge(){
  if(!G||!G.surge||G.state!=='play')return;
  if(G.meter<100){sfx.warn();popup('SURGE NOT READY','#ff9a9a',.9,Math.floor(G.meter)+'%');return;}
  var k=3+2*pkc('overcharge'),rows=[];
  for(var y=ROWS-k;y<ROWS;y++)rows.push(y);
  G.meter=0;S.stats.surges++;ach('surge');
  popup('SHOCKWAVE!','#ffb84a',1.7);sfx.surge();shake(1.6);flash('255,200,120',.55);vibe(100);kick(7);
  beginClear(rows,{line:false,keepCur:true,shock:true});
  if(pkc('aftershock')){G.frost=Math.max(G.frost,3000*pkc('aftershock'));popup('AFTERSHOCK!','#bff0ff',1,'Gravity frozen');}
}

// ---------- puzzle & tutorial engine ----------
// Puzzles use a fixed queue, no gravity and no lock timer: pieces only lock when you hard drop.
function pzLoadBoard(rows){ // fills the grid from board rows, returns the '*' target cells as [x,y,x,y...]
  var tg=[],y0=ROWS-rows.length,x,y,r;
  for(y=0;y<ROWS;y++)for(x=0;x<COLS;x++)G.grid[y][x]=0;
  for(r=0;r<rows.length;r++){
    y=y0+r;
    for(x=0;x<COLS;x++){
      var ch=rows[r].charAt(x),t=TYPES.indexOf(ch);
      if(ch==='*')tg.push(x,y);
      else if(ch==='#')G.grid[y][x]=8|PZ_MARK;
      else if(t>=0)G.grid[y][x]=(t+1)|PZ_MARK;
    }
  }
  return tg;
}
function pzTargets(rows){var tg=[],y0=ROWS-rows.length;for(var r=0;r<rows.length;r++)for(var x=0;x<COLS;x++)if(rows[r].charAt(x)==='*')tg.push(x,y0+r);return tg;}
function pzQueue(q){G.queue.length=0;for(var i=0;i<q.length;i++){var t=TYPES.indexOf(q.charAt(i));if(t>=0)G.queue.push({t:t,pi:-1,pt:0});}}
function pzBegin(o){
  var z=G.pz={id:o.pz||'',d:null,l:null,step:0,snaps:[],save:null,tsc:0,tsAny:0,tet:0,lastN:0,lastTs:0,tgt:null,mk:false,
    wait:0,then:null,demo:null,coach:'',res:null,on:0,hint:false,hinted:false};
  G.state='banner';
  mus.bpm=112;
  if(G.mode==='puzzle'){
    var d=z.d=PZ_BY[o.pz];
    lastPack=d.pi;
    pzLoadBoard(d.b);pzQueue(d.q);
    z.mk=(d.g==='clear');
    if(o.quick){spawnNext();}
    else G.banner={t:0,dur:2100,title:d.n.toUpperCase(),sub:pzGoal(d),sub2:'Puzzle '+pzLabel(d)+'  |  '+d.q.length+' pieces  |  3 stars: '+d.p[0]+(d.p[0]===1?' piece':' pieces'),next:'play'};
  }else{
    z.l=LES_BY[o.les]||LESSONS[0];
    G.banner={t:0,dur:1700,title:'LESSON: '+z.l.n.toUpperCase(),sub:z.l.d,next:'tut'};
  }
  musicStart();
}
function pzSnapTake(){
  var z=G.pz,g=new Uint8Array(ROWS*COLS),c=G.cur;
  for(var y=0;y<ROWS;y++)for(var x=0;x<COLS;x++)g[y*COLS+x]=G.grid[y][x];
  return {g:g,q:G.queue.slice(),h:G.hold.slice(),c:c?{t:c.t,pi:c.pi,pt:c.pt}:null,hu:G.holdUsed,sc:G.score,ln:G.lines,cb:G.combo,b2b:G.b2b,bn:G.b2bN,pc:G.pieces,ts:z.tsc,ta:z.tsAny,tt:z.tet,on:z.on};
}
function pzSnap(){ // called each time a new piece spawns (the undo history)
  var z=G.pz;z.lastN=0;z.lastTs=0;z.hint=false;
  if(G.mode==='puzzle'){z.snaps.push(pzSnapTake());if(z.snaps.length>40)z.snaps.splice(1,1);}
}
function pzRestore(sn){
  var z=G.pz;
  for(var y=0;y<ROWS;y++)for(var x=0;x<COLS;x++)G.grid[y][x]=sn.g[y*COLS+x];
  G.queue=sn.q.slice();G.hold=sn.h.slice();
  G.score=sn.sc;G.lines=sn.ln;G.combo=sn.cb;G.b2b=sn.b2b;G.b2bN=sn.bn;G.pieces=sn.pc;z.tsc=sn.ts;z.tsAny=sn.ta;z.tet=sn.tt;
  if(sn.on!==undefined)z.on=sn.on;
  G.clear=null;G.pend.rot=0;G.pend.hold=false;z.lastN=0;z.lastTs=0;z.hint=false;
  G.cur=null;if(sn.c)spawn(sn.c);
  G.holdUsed=sn.hu;G.state='play';lockFx.t=999;
}
function pzNote(n,ts){ // what the last lock did (puzzle goals and tutorial checks)
  var z=G.pz,d=z.d;
  z.lastN=n;z.lastTs=ts;
  if(ts===2&&n>=1){z.tsAny++;if(!d||d.g!=='ts'||n>=d.k)z.tsc++;}
  if(n===4)z.tet++;
}
