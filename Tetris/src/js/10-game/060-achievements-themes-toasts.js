// ---------- achievements / themes / toasts ----------
function ach(id){
  if(S.ach[id])return;
  S.ach[id]=today();save();
  var a=ACH_BY[id];toast('Achievement: '+a[1],a[2]);sfx.ach();
}
function checkProgressAch(quiet){
  var n=0;
  ACH.forEach(function(a){
    if(S.ach[a[0]]||!a[4])return;
    var pr=a[4]();
    if(pr[0]>=pr[1]){if(quiet){S.ach[a[0]]=today();n++;}else ach(a[0]);}
  });
  if(n)save();
}
function checkThemes(quiet){
  var ch=false;
  function chk(key,ok,label,name){
    if(ok&&!S.seen[key]){S.seen[key]=1;ch=true;if(!quiet&&label)toast(label+' unlocked: '+name,'Pick it in Customize');}
  }
  THEMES.forEach(function(t){chk('t_'+t.id,themeUnlocked(t),t.id!=='classic'?'Theme':'',t.name);});
  SKINS.forEach(function(k){if(k.id!=='auto')chk('u_k'+k.id,k.test(),k.how.indexOf('start')>=0?'':'Block skin',k.name);});
  BGS.forEach(function(b){if(b.id!=='auto')chk('u_g'+b.id,b.test(),b.how.indexOf('start')>=0?'':'Background',b.name);});
  if(ch)save();
}
function toast(a,b){
  var el=document.createElement('div');el.className='toast';
  el.innerHTML=esc(a)+(b?'<small>'+esc(b)+'</small>':'');
  var host=$('toasts');host.appendChild(el);
  while(host.children.length>3)host.removeChild(host.firstChild);
  setTimeout(function(){try{host.removeChild(el);}catch(e){}},3600);
}

// ---------- effects helpers ----------
function cellCenter(x,y){return {x:L.bx+(x+.5)*L.c,y:L.by+(y-HID+.5)*L.c};}
function spark(px,py,col,n,spd){
  if(S.set.fx===0)return;
  n=Math.round(n*(S.set.fx===1?.5:1));
  for(var i=0;i<n&&parts.length<650;i++){
    var a=Math.random()*6.283,sp=L.c*(1.5+Math.random()*5)*(spd||1);
    parts.push({x:px,y:py,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-L.c*2,g:L.c*9,l:500+Math.random()*500,m:900,s:Math.max(1.5,L.c*(.1+Math.random()*.12)),c:col});
  }
}
function burstCell(x,y,col,n,spd){var c=cellCenter(x,y);spark(c.x,c.y,col,n,spd);}
function confettiBurst(){
  if(S.set.fx===0)return;
  var cols=['#ff3d55','#ffd92b','#38d64a','#00d2e6','#b44cff','#ff9a1f'],n=S.set.fx===2?90:25;
  for(var i=0;i<n&&parts.length<700;i++){
    var a=-Math.PI/2+(Math.random()-.5)*2.6,sp=L.c*(6+Math.random()*12);
    parts.push({x:L.bx+COLS*L.c/2,y:L.by+VIS*L.c*.55,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,g:L.c*14,l:1400+Math.random()*900,m:2200,s:Math.max(2,L.c*.2),c:cols[i%cols.length]});
  }
}
function shake(a){if(S.set.shake&&S.set.fx>0)shakeAmt=Math.max(shakeAmt,a);}
function kick(v){if(S.set.shake&&S.set.fx>0)kickV+=v*L.c;} // springy board bump (cells per second)
var COMBO_COLS=['#7ff0ff','#7fffb0','#d6ff6b','#ffe24a','#ffb84a','#ff7a4a','#ff4a8a','#e04aff'];
function comboCol(n){return COMBO_COLS[clamp(Math.floor((n-1)/2),0,COMBO_COLS.length-1)];}
function flash(rgb,a){if(S.set.fx===2){flashC=rgb;flashA=Math.max(flashA,a);}}
function popup(text,color,size,sub){
  pops.push({text:text,color:color||'#fff',size:size||1,sub:sub||'',t:0,life:1700});
  if(pops.length>7)pops.shift();
}
function fxUpdate(dt){
  var sec=dt/1000,i;
  for(i=parts.length-1;i>=0;i--){
    var p=parts[i];p.l-=dt;
    if(p.l<=0){parts[i]=parts[parts.length-1];parts.pop();continue;}
    p.vy+=p.g*sec;p.x+=p.vx*sec;p.y+=p.vy*sec;
  }
  for(i=pops.length-1;i>=0;i--){pops[i].t+=dt;if(pops[i].t>pops[i].life)pops.splice(i,1);}
  for(i=rings.length-1;i>=0;i--){rings[i].t+=dt;if(rings[i].t>rings[i].life)rings.splice(i,1);}
  for(i=beams.length-1;i>=0;i--){beams[i].t+=dt;if(beams[i].t>beams[i].life)beams.splice(i,1);}
  shakeAmt*=Math.pow(0.004,sec);if(shakeAmt<.01)shakeAmt=0;
  flashA=Math.max(0,flashA-sec*1.6);
  if(kickY!==0||kickV!==0){
    kickV+=(-kickY*320-kickV*15)*sec;kickY+=kickV*sec;
    var lim=L.c*.5;if(kickY>lim){kickY=lim;if(kickV>0)kickV=0;}else if(kickY<-lim){kickY=-lim;if(kickV<0)kickV=0;}
    if(Math.abs(kickY)<.05&&Math.abs(kickV)<.5){kickY=0;kickV=0;}
  }
  if(lockFx.t<999)lockFx.t+=dt;
}

// ---------- per-frame game step ----------
function das(dt,chargeOnly){
  var l=isHeld('left'),r=isHeld('right'),d;
  if(l&&r)d=G.lastDir||-1;else d=l?-1:(r?1:0);
  if(d!==G.dasDir){G.dasDir=d;G.dasT=0;G.autoMoved=0;return;}
  if(!d)return;
  G.dasT+=dt;
  if(chargeOnly){if(G.dasT>S.set.das)G.dasT=S.set.das;return;}
  var DAS=S.set.das,ARR=S.set.arr;
  if(G.dasT>=DAS){
    var due=ARR<=0?99:Math.floor((G.dasT-DAS)/ARR)+1,sg=dirSign();
    while(G.autoMoved<due){
      if(!tryMove(d*sg,0)){G.autoMoved=due;break;}
      G.autoMoved++;
    }
  }
}
function playStep(dt){
  G.time+=dt;
  if(G.mode==='ultra'&&G.time>=ULTRA_MS){G.time=ULTRA_MS;endGame('time');return;}
  if(G.hint){G.hint.t-=dt;if(G.hint.t<=0)G.hint=null;}
  G.vis=Math.max(0,G.vis-dt/1500);
  if(G.frost>0)G.frost=Math.max(0,G.frost-dt);
  curseUpdate(dt);
  if(!G.cur)return;
  das(dt,false);
  var c=G.cur;
  if(!c||G.state!=='play')return;
  var gi=gravityMs(),soft=isHeld('soft'),interval=G.frost>0?1e12:gi;
  if(soft){var si=SDF[S.set.sdf]===0?0.4:Math.max(0.4,(G.pz?1000:gi)/SDF[S.set.sdf]);interval=Math.min(interval,si);}
  G.acc+=dt;
  var n=0;
  while(G.acc>=interval&&n<50){G.acc-=interval;n++;if(!stepDown(soft)){G.acc=0;break;}}
  if(n>=50)G.acc=0;
  c=G.cur;
  if(!c)return;
  if(!fits(c.t,c.r,c.x,c.y+1)){G.lockT+=dt;if(G.lockT>=lockDelay())lockPiece();}
  else G.lockT=0;
  // danger tracking
  var top=ROWS;
  for(var y=HID;y<ROWS&&top===ROWS;y++)for(var x=0;x<COLS;x++)if(G.grid[y][x]){top=y;break;}
  var nd=(top<=HID+4)?1:0;
  if(nd&&!G.dangerT&&G.surge&&pkc('secondwind')&&G.time-(G.swT||-1e9)>8000){G.swT=G.time;popup('SECOND WIND!','#9fe8ff',.9,'Gravity slowed');}
  G.dangerT=nd;
}
function update(dt){
  fxUpdate(dt);
  if(!G)return;
  if(G.state!=='paused'){
    G.cpulse+=dt;G.bpulse+=dt;
    if(G.curse)curseVisual(dt);
  }
  switch(G.state){
    case 'countdown':case 'resume':{
      G.cd-=dt;
      var dg=G.cd>1500?3:(G.cd>800?2:(G.cd>150?1:0));
      if(G.state==='resume')dg=G.cd>1000?3:(G.cd>500?2:(G.cd>100?1:0));
      if(dg!==G.lastDigit){G.lastDigit=dg;if(dg>0)sfx.beep();else sfx.go();}
      if(G.cd<=0){
        if(G.state==='resume'){G.state=G.pstate||'play';}
        else{
          if(G.surge)startFloor(1);
          else{spawnNext();if(G.state!=='over')G.state='play';}
        }
        if(S.set.music>0&&G.state!=='over')musicStart();
      }
      break;}
    case 'play':if(G.pz&&G.pz.demo)demoStep(dt);if(G.state==='play')playStep(dt);break;
    case 'clear':clearStep(dt);break;
    case 'banner':bannerStep(dt);break;
    case 'pzwait':G.time+=dt;pzWaitStep(dt);break;
    case 'over':G.overT+=dt;if(G.overT>(G.over==='quit'?50:(G.over==='out'||G.over==='top')&&G.pz?650:1100)&&!G.shown){G.shown=true;showResult();}break;
  }
}

// ---------- rendering ----------
var app=$('app'),stage=$('stage'),cv=$('cv'),ctx=cv.getContext('2d',{alpha:false}),ov=$('ov'),touchEl=$('touch');
var FONT='"Trebuchet MS","Segoe UI",Roboto,Helvetica,Arial,sans-serif';
var DPR=1,curTh=THEMES[0],bgItems=[],lastTs=0;
for(var bi=0;bi<22;bi++)bgItems.push({x:Math.random(),y:Math.random(),s:.02+Math.random()*.05,v:.01+Math.random()*.03,a:Math.random()*6,c:1+Math.floor(Math.random()*7)});

function layout(){
  var W=cv.width,H=cv.height;
  var pad=Math.max(3,Math.round(Math.min(W,H)*0.012));
  var cH=Math.floor((H-2*pad)/VIS),cW=Math.floor((W-2*pad)/(COLS+5.9));
  var c=Math.max(6,Math.min(cH,cW));
  L.W=W;L.H=H;L.c=c;L.pad=pad;
  L.bx=Math.floor((W-COLS*c)/2);L.by=Math.floor((H-VIS*c)/2);
  L.pw=L.bx-pad;
  L.m=Math.max(5,Math.min(c*.85,(L.pw-c*.5)/4));
}
function resize(){
  var w=window.innerWidth||document.documentElement.clientWidth||800,h=window.innerHeight||document.documentElement.clientHeight||600;
  app.style.width=w+'px';app.style.height=h+'px';
  updateTouchUI(true);
  var r=stage.getBoundingClientRect();
  DPR=Math.min(window.devicePixelRatio||1,3);
  var cw=Math.max(2,Math.floor((r.width||w)*DPR)),ch=Math.max(2,Math.floor((r.height||h)*DPR));
  if(cv.width!==cw||cv.height!==ch){cv.width=cw;cv.height=ch;}
  sprCache={};
  layout();
}
function txt(s,x,y,size,color,align,weight){
  ctx.font=(weight||'bold')+' '+Math.max(6,Math.round(size))+'px '+FONT;
  ctx.fillStyle=color;ctx.textAlign=align||'left';ctx.textBaseline='middle';ctx.fillText(s,x,y);
}
function txtFit(s,x,y,size,color,align,maxW,weight){
  ctx.font=(weight||'bold')+' '+Math.max(6,Math.round(size))+'px '+FONT;
  var w=ctx.measureText(s).width;
  if(w>maxW&&w>0)size=size*maxW/w;
  txt(s,x,y,size,color,align,weight);
}
function txtOut(s,x,y,size,color,align,maxW){
  ctx.font='bold '+Math.max(6,Math.round(size))+'px '+FONT;
  var w=ctx.measureText(s).width;
  if(maxW&&w>maxW)size=size*maxW/w;
  ctx.font='bold '+Math.max(6,Math.round(size))+'px '+FONT;
  ctx.textAlign=align||'center';ctx.textBaseline='middle';
  ctx.lineWidth=Math.max(2,size*.18);ctx.strokeStyle='rgba(0,0,0,.75)';ctx.lineJoin='round';
  ctx.strokeText(s,x,y);ctx.fillStyle=color;ctx.fillText(s,x,y);
}
function wrapText(s,maxW){
  var words=s.split(' '),lines=[],cur='';
  for(var i=0;i<words.length;i++){
    var t=cur?cur+' '+words[i]:words[i];
    if(ctx.measureText(t).width>maxW&&cur){lines.push(cur);cur=words[i];}else cur=t;
  }
  if(cur)lines.push(cur);
  return lines;
}
var wrapMemo={};
function wrapCached(slot,str,maxW){ // wrapText, but only re-measured when the text, width or font changes
  var m=wrapMemo[slot],k=str+'|'+Math.round(maxW)+'|'+ctx.font;
  if(m&&m.k===k)return m.l;
  m=wrapMemo[slot]={k:k,l:wrapText(str,maxW)};
  return m.l;
}
function panelBox(x,y,w,h){
  ctx.fillStyle='rgba(6,8,26,.55)';rr(ctx,x,y,w,h,Math.max(3,L.m*.35));ctx.fill();
  ctx.strokeStyle='rgba(150,180,255,.22)';ctx.lineWidth=1;ctx.stroke();
}
function drawPiecePrev(t,pi,pt,cx,cy,cell,alpha,ts){
  cell=Math.max(4,Math.round(cell));
  var s=SHAPES[t][0],minx=9,maxx=-9,miny=9,maxy=-9,i;
  for(i=0;i<4;i++){minx=Math.min(minx,s[i][0]);maxx=Math.max(maxx,s[i][0]);miny=Math.min(miny,s[i][1]);maxy=Math.max(maxy,s[i][1]);}
  var w=(maxx-minx+1)*cell,h=(maxy-miny+1)*cell,ox=Math.round(cx-w/2),oy=Math.round(cy-h/2);
  ctx.globalAlpha=alpha;
  for(i=0;i<4;i++){
    var px=ox+(s[i][0]-minx)*cell,py=oy+(s[i][1]-miny)*cell;
    ctx.drawImage(spr(curTh,t+1,cell),px,py);
    if(i===pi)drawPower(ctx,pt,px,py,cell,ts);
  }
  ctx.globalAlpha=1;
}
// ---- stage backgrounds: a static layer painted once per size + a few cheap moving parts ----
var scn={key:'',cv:null,parts:[],meta:[],blob:null,atlas:null,gs:0},AURORA_COLS=['#3dffb0','#3de0ff','#b06bff'];
function vgrad(g,H,stops){var gr=g.createLinearGradient(0,0,0,H);for(var i=0;i<stops.length;i++)gr.addColorStop(i/(stops.length-1),stops[i]);return gr;}
function hills(g,W,H,y0,amp,col,r,n){ // a wavy silhouette along the bottom
  g.fillStyle=col;g.beginPath();g.moveTo(0,H);
  var ph=r()*6,f=(1+r()*2)*Math.PI*2/W;
  for(var x=0;x<=W;x+=Math.max(4,W/80))g.lineTo(x,y0-Math.abs(Math.sin(x*f+ph))*amp-Math.sin(x*f*2.7+ph)*amp*.25);
  g.lineTo(W,H);g.closePath();g.fill();
}
function paintScene(g,id,W,H,meta){
  var r=mulberry32(4242+id.charCodeAt(0)*131),i,x,y,s,gr,u=Math.min(W,H);
  meta.length=0;
  function dots(n,a0,a1,hmax){for(var k=0;k<n;k++){g.globalAlpha=a0+r()*(a1-a0);g.fillStyle=r()<.2?'#bcd4ff':'#fff';var d=Math.max(1,u*(.0015+r()*.0025));g.fillRect(r()*W,r()*H*(hmax||1),d,d);}g.globalAlpha=1;}
  if(id==='stars'){
    g.fillStyle=vgrad(g,H,['#02030c','#070a22','#0b0f2a']);g.fillRect(0,0,W,H);
    [['106,43,209',.20],['31,107,209',.16],['209,43,138',.11]].forEach(function(c){
      var cx=r()*W,cy=r()*H,rad=Math.max(W,H)*(.25+r()*.25);
      gr=g.createRadialGradient(cx,cy,0,cx,cy,rad);gr.addColorStop(0,'rgba('+c[0]+','+c[1]+')');gr.addColorStop(1,'rgba('+c[0]+',0)');
      g.fillStyle=gr;g.fillRect(0,0,W,H);
    });
    dots(240,.15,.75);
  }else if(id==='aurora'){
    g.fillStyle=vgrad(g,H,['#020a14','#04182a','#0a2a2e']);g.fillRect(0,0,W,H);
    dots(130,.2,.7,.6);
    hills(g,W,H,H*.80,H*.10,'#061c24',r);hills(g,W,H,H*.88,H*.06,'#030f15',r);
  }else if(id==='city'){
    g.fillStyle=vgrad(g,H,['#0b0820','#24103c','#5a2050']);g.fillRect(0,0,W,H);
    dots(80,.2,.6,.5);
    var mx=W*.78,my=H*.2,mr=u*.07;
    gr=g.createRadialGradient(mx,my,mr*.8,mx,my,mr*3);gr.addColorStop(0,'rgba(255,240,190,.25)');gr.addColorStop(1,'rgba(255,240,190,0)');g.fillStyle=gr;g.fillRect(mx-mr*3,my-mr*3,mr*6,mr*6);
    g.fillStyle='#fff3c4';g.beginPath();g.arc(mx,my,mr,0,6.2832);g.fill();
    for(x=0;x<W;){s=u*(.05+r()*.07);var bh=H*(.18+r()*.22);g.fillStyle='#1c1234';g.fillRect(x,H-bh,s,bh);x+=s+u*.005;}
    for(x=-u*.02;x<W;){
      s=u*(.06+r()*.09);var h2=H*(.12+r()*.3),top=H-h2;
      g.fillStyle='#0c0818';g.fillRect(x,top,s,h2);
      var ww=Math.max(2,u*.009),wh=Math.max(2,u*.012);
      for(y=top+wh;y<H-wh*2;y+=wh*2.2)for(var wx=x+ww;wx<x+s-ww*1.5;wx+=ww*2.4){
        if(r()<.42){g.fillStyle=r()<.8?'rgba(255,211,107,'+(.35+r()*.5)+')':'rgba(127,211,255,.7)';g.fillRect(wx,y,ww,wh);}
        else if(r()<.06&&meta.length<60)meta.push([wx,y,ww,wh]); // dark windows that blink on and off
      }
      if(h2>H*.33&&meta.length<62)meta.push([x+s/2,top,-1,0]); // antenna light
      x+=s+u*.004;
    }
  }else if(id==='ocean'){
    g.fillStyle=vgrad(g,H,['#0a3a62','#062a4a','#021226']);g.fillRect(0,0,W,H);
    g.fillStyle='rgba(255,255,255,.045)';
    for(i=0;i<6;i++){x=r()*W;s=W*(.04+r()*.07);g.beginPath();g.moveTo(x,0);g.lineTo(x+s,0);g.lineTo(x+s*3+W*.1,H);g.lineTo(x+W*.1,H);g.closePath();g.fill();}
    hills(g,W,H,H*.94,H*.04,'#0a1a24',r);
    g.strokeStyle='#0e4a3a';g.lineCap='round';
    for(i=0;i<14;i++){x=r()*W;var len=H*(.08+r()*.16);g.lineWidth=Math.max(2,u*.008);g.beginPath();g.moveTo(x,H);
      for(y=0;y<=len;y+=len/6)g.lineTo(x+Math.sin(y/len*5+i)*u*.012,H-y);g.stroke();}
  }else if(id==='synth'){
    var hz=H*.62;
    g.fillStyle=vgrad(g,hz,['#12002a','#4a0a5a','#ff3d7f']);g.fillRect(0,0,W,hz);
    dots(70,.2,.7,.45);
    var sr=H*.17,sx=W/2,sy=hz-sr*.35;
    gr=g.createLinearGradient(0,sy-sr,0,sy+sr);gr.addColorStop(0,'#ffe35a');gr.addColorStop(1,'#ff3d9a');
    g.fillStyle=gr;g.beginPath();g.arc(sx,sy,sr,0,6.2832);g.fill();
    for(i=0;i<6;i++){var sy2=sy+sr*(.05+i*.16),sh=sr*(.03+i*.022);g.fillStyle=vgrad(g,hz,['#12002a','#4a0a5a','#ff3d7f']);g.fillRect(sx-sr,sy2,sr*2,sh);}
    hills(g,W,hz+1,hz-H*.01,H*.07,'#2a0638',r);
    g.fillStyle='#0d0018';g.fillRect(0,hz,W,H-hz);
    g.strokeStyle='rgba(255,79,216,.55)';g.lineWidth=Math.max(1,u*.003);g.beginPath();
    for(i=-14;i<=14;i++){g.moveTo(W/2+i*W*.012,hz);g.lineTo(W/2+i*W*.16,H);}g.stroke();
    meta.push([hz]);
  }else if(id==='snow'){
    g.fillStyle=vgrad(g,H,['#0a1838','#14295a','#1d3a6a']);g.fillRect(0,0,W,H);
    dots(90,.2,.6,.5);
    g.fillStyle='rgba(235,245,255,.45)';g.beginPath();g.arc(W*.5,H*.14,u*.05,0,6.2832);g.fill();
    hills(g,W,H,H*.78,H*.08,'#24406e',r);
    for(i=0;i<26;i++){x=r()*W;y=H*(.74+r()*.12);s=u*(.03+r()*.04);g.fillStyle='#0c1a2e';g.beginPath();g.moveTo(x,y-s*2.2);g.lineTo(x+s*.7,y);g.lineTo(x-s*.7,y);g.closePath();g.fill();}
    hills(g,W,H,H*.9,H*.05,'#cfe0f5',r);hills(g,W,H,H*.95,H*.03,'#e8f1ff',r);
  }else if(id==='lava'){
    g.fillStyle=vgrad(g,H,['#1a0006','#3a0410','#120004']);g.fillRect(0,0,W,H);
    gr=g.createRadialGradient(W/2,H/2,u*.2,W/2,H/2,Math.max(W,H)*.75);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,0,.55)');g.fillStyle=gr;g.fillRect(0,0,W,H);
  }else if(id==='rain'){
    g.fillStyle=vgrad(g,H,['#000a04','#00140a','#001a0c']);g.fillRect(0,0,W,H);
  }
}
function sceneParts(id,W,H,arr){ // the moving bits; allocated once when the scene or size changes
  var r=mulberry32(99+id.length),i,u=Math.min(W,H),n={stars:46,aurora:3,city:0,ocean:44,synth:1,snow:85,lava:8,rain:0}[id]||0;
  arr.length=0;
  if(id==='rain'){var gs=Math.max(8,Math.round(u*.022));n=Math.min(36,Math.floor(W/(gs*1.6)));scn.gs=gs;}
  for(i=0;i<n;i++)arr.push({x:r()*W,y:r()*H,s:r(),v:r(),ph:r()*6.283,k:0});
  if(id==='city')for(i=0;i<scn.meta.length;i++)arr.push({x:scn.meta[i][0],y:scn.meta[i][1],s:scn.meta[i][2],v:scn.meta[i][3],ph:r()*6.283,k:r()});
  if(id==='aurora')arr.forEach(function(p,j){p.k=j;});
  if(id==='lava'&&!scn.blob){ // one soft blob sprite, scaled for every blob
    var b=document.createElement('canvas');b.width=b.height=128;var bg=b.getContext('2d'),gr=bg.createRadialGradient(64,64,4,64,64,64);
    gr.addColorStop(0,'rgba(255,190,80,.95)');gr.addColorStop(.45,'rgba(255,80,30,.6)');gr.addColorStop(1,'rgba(255,40,20,0)');bg.fillStyle=gr;bg.fillRect(0,0,128,128);scn.blob=b;
  }
  if(id==='rain'){ // glyph atlas: row 0 green, row 1 bright heads
    var a=document.createElement('canvas'),gsz=scn.gs,ch='0123456789ABCDEF+=*<>#';a.width=gsz*ch.length;a.height=gsz*2;
    var ag=a.getContext('2d');ag.font='bold '+Math.round(gsz*.9)+'px monospace';ag.textAlign='center';ag.textBaseline='middle';
    for(i=0;i<ch.length;i++){ag.fillStyle='#46e27a';ag.fillText(ch[i],i*gsz+gsz/2,gsz/2);ag.fillStyle='#d8ffe4';ag.fillText(ch[i],i*gsz+gsz/2,gsz*1.5);}
    scn.atlas=a;scn.nch=ch.length;
    for(i=0;i<n;i++)arr[i].x=(i+.5)*W/n;
  }
}
function sceneDyn(g,id,W,H,ts,dt,arr,moving){
  var i,p,u=Math.min(W,H),sec=moving?dt/1000:0;
  if(id==='stars'){
    for(i=0;i<arr.length;i++){p=arr[i];p.y+=sec*u*(.004+p.v*.012);if(p.y>H)p.y=0;
      g.globalAlpha=.25+.75*(.5+.5*Math.sin(ts*(.0012+p.v*.003)+p.ph));g.fillStyle=p.s<.2?'#ffe9b0':'#fff';var d=Math.max(1,u*(.002+p.s*.003));g.fillRect(p.x,p.y,d,d);}
  }else if(id==='aurora'){
    var step=Math.max(6,W/48);
    for(i=0;i<arr.length;i++){p=arr[i];var base=H*(.16+i*.07),amp=H*.05,hh=H*(.16+i*.03);
      g.fillStyle=AURORA_COLS[i%3];
      for(var x=0;x<W;x+=step){var y=base+Math.sin(x/W*6+ts*.0004*(1+i*.3)+p.ph)*amp+Math.sin(x/W*13-ts*.0007)*amp*.3;
        var al=.08+.05*Math.sin(x/W*9+ts*.001+i);
        g.globalAlpha=al;g.fillRect(x,y,step+1,hh*.35);g.globalAlpha=al*.6;g.fillRect(x,y+hh*.35,step+1,hh*.35);g.globalAlpha=al*.25;g.fillRect(x,y+hh*.7,step+1,hh*.3);
        g.globalAlpha=.22;g.fillRect(x,y,step+1,Math.max(1,u*.004));}
    }
  }else if(id==='city'){
    for(i=0;i<arr.length;i++){p=arr[i];
      if(p.s<0){g.globalAlpha=.4+.6*Math.max(0,Math.sin(ts*.003+p.ph));g.fillStyle='#ff3040';g.fillRect(p.x-1.5,p.y-u*.012,3,3);continue;}
      if(Math.sin(ts*.0006*(1+p.k)+p.ph)>.3){g.globalAlpha=.75;g.fillStyle='#ffd36b';g.fillRect(p.x,p.y,p.s,p.v);}
    }
  }else if(id==='ocean'){
    g.strokeStyle='rgba(190,235,255,.55)';g.lineWidth=Math.max(1,u*.002);
    for(i=0;i<arr.length;i++){p=arr[i];p.y-=sec*u*(.03+p.v*.06);if(p.y<-10){p.y=H+10;p.x=Math.random()*W;}
      var rad=Math.max(1.5,u*(.003+p.s*.008));g.globalAlpha=.35+p.s*.4;g.beginPath();g.arc(p.x+Math.sin(ts*.002+p.ph)*u*.008,p.y,rad,0,6.2832);g.stroke();}
  }else if(id==='synth'){
    var hz=scn.meta[0]?scn.meta[0][0]:H*.62,off=(ts/1000*.35)%1;
    g.strokeStyle='#ff4fd8';g.lineWidth=Math.max(1,u*.003);
    for(i=0;i<12;i++){var z=(i+off)/12,yy=hz+(H-hz)*z*z;g.globalAlpha=.15+.6*z;g.beginPath();g.moveTo(0,yy);g.lineTo(W,yy);g.stroke();}
  }else if(id==='snow'){
    g.fillStyle='#fff';
    for(i=0;i<arr.length;i++){p=arr[i];p.y+=sec*u*(.02+p.s*.06);if(p.y>H+4){p.y=-4;p.x=Math.random()*W;}
      g.globalAlpha=.45+p.s*.5;var sz=Math.max(1,u*(.0025+p.s*.005));g.fillRect(p.x+Math.sin(ts*.0012+p.ph)*u*.015,p.y,sz,sz);}
  }else if(id==='lava'&&scn.blob){
    g.globalCompositeOperation='lighter';
    for(i=0;i<arr.length;i++){p=arr[i];var bs=u*(.18+p.s*.2),bx=p.x+Math.sin(ts*.00025+p.ph)*W*.06,by=H*(.5+.42*Math.sin(ts*.00016*(1+p.v)+p.ph));
      g.globalAlpha=.55;g.drawImage(scn.blob,bx-bs/2,by-bs/2,bs,bs);}
    g.globalCompositeOperation='source-over';
  }else if(id==='rain'&&scn.atlas){
    var gs=scn.gs,nc=scn.nch;
    for(i=0;i<arr.length;i++){p=arr[i];var len=8+Math.floor(p.s*10);p.y+=sec*gs*(5+p.v*9);if(p.y-len*gs>H){p.y=-Math.random()*H*.5;}
      var head=Math.floor(p.y/gs);
      for(var k=0;k<len;k++){var cy=(head-k)*gs;if(cy<-gs||cy>H)continue;var gi=(Math.floor(p.ph*7)+(head-k)*7+(k===0?Math.floor(ts/120):0))%nc;if(gi<0)gi+=nc;
        g.globalAlpha=k===0?.75:(1-k/len)*.45;g.drawImage(scn.atlas,gi*gs,k===0?gs:0,gs,gs,p.x,cy,gs,gs);}
    }
  }
  g.globalAlpha=1;
}
function drawScene(id,ts,dt){
  var W=L.W,H=L.H,key=id+'|'+W+'|'+H;
  if(scn.key!==key){
    if(!scn.cv)scn.cv=document.createElement('canvas');
    scn.cv.width=W;scn.cv.height=H;
    paintScene(scn.cv.getContext('2d'),id,W,H,scn.meta);
    sceneParts(id,W,H,scn.parts);scn.key=key;
  }
  ctx.drawImage(scn.cv,0,0);
  if(S.set.fx>0)sceneDyn(ctx,id,W,H,ts,dt,scn.parts,!(G&&G.state==='paused'));
}
var bgGrad={key:'',g:null};
function drawBg(th,ts,dt){
  var W=L.W,H=L.H,sid=bgId();
  if(sid!=='auto'){drawScene(sid,ts,dt);return;}
  if(bgGrad.key!==th.id+'|'+H){bgGrad.key=th.id+'|'+H;bgGrad.g=ctx.createLinearGradient(0,0,0,H);bgGrad.g.addColorStop(0,th.bg[0]);bgGrad.g.addColorStop(1,th.bg[1]);}
  ctx.fillStyle=bgGrad.g;ctx.fillRect(0,0,W,H);
  if(S.set.fx===0)return;
  var sz=Math.min(W,H);
  for(var i=0;i<bgItems.length;i++){
    var b=bgItems[i];
    if(!(G&&(G.state==='paused')))b.y-=b.v*dt/1000*(G?1:1.6);
    if(b.y<-.1){b.y=1.1;b.x=Math.random();}
    var s=b.s*sz*1.6,x=b.x*W,y=b.y*H;
    ctx.save();ctx.translate(x,y);ctx.rotate(b.a+ts/9000*(i%2?1:-1));
    ctx.globalAlpha=.10;ctx.fillStyle=th.cols[b.c]||'#fff';
    ctx.fillRect(-s/2,-s/2,s,s);
    ctx.globalAlpha=.16;ctx.strokeStyle=th.cols[b.c]||'#fff';ctx.lineWidth=Math.max(1,s*.06);ctx.strokeRect(-s/2,-s/2,s,s);
    ctx.restore();
  }
  ctx.globalAlpha=1;
}
function modeStats(){
  var best=bestOf(G.mode),a=[],bl='BEST';
  if(G.daily){ // today's personal best for the daily challenge
    var dh=S.daily.h[G.daily.d];bl='TODAY BEST';
    best=(dh&&dh.k===G.daily.kind&&(G.daily.kind!=='sprint'||dh.w))?dh:null;
  }
  if(G.pz){
    var z=G.pz;
    if(G.mode==='tutorial'){a.push(['LESSON',z.l.n.toUpperCase()]);a.push(['STEP',(z.step+1)+' / '+z.l.steps.length]);a.push(['SHOW ME',touchMode()!=='off'?'SHOW':keyName(bindsFor('undo')[0])]);return a;}
    var pd=z.d,pr=S.puz[pd.id];
    a.push(['PUZZLE',pzLabel(pd)]);a.push(['PIECES',G.pieces+' / '+pd.q.length]);a.push(['3 STARS','\u2264 '+pd.p[0]]);
    a.push(['BEST',pr&&pr.s?'\u2605\u2605\u2605'.slice(0,pr.s)+'\u2606\u2606\u2606'.slice(pr.s):'--']);
    return a;
  }
  if(G.mode==='sprint'){
    a.push(['TIME',fmtTime(G.time)]);a.push(['LINES',G.lines+'/'+SPRINT_LINES]);a.push(['SCORE',fmtNum(G.score)]);
    a.push([bl,best?fmtTime(best.t):'--']);
  }else if(G.mode==='ultra'){
    a.push(['TIME LEFT',fmtTime(ULTRA_MS-G.time)]);a.push(['SCORE',fmtNum(G.score)]);a.push(['LINES',String(G.lines)]);a.push([bl,best?fmtNum(best.s):'--']);
  }else if(G.surge){
    a.push(['SCORE',fmtNum(G.score)]);a.push(['FLOOR',String(G.floor)]);a.push(['LINES',G.floorLines+'/'+G.target]);a.push(['TIME',fmtSec(G.time)]);a.push([bl,best?fmtNum(best.s):'--']);
  }else if(G.mode==='zen'){
    a.push(['SCORE',fmtNum(G.score)]);a.push(['LINES',String(G.lines)]);a.push(['TIME',fmtSec(G.time)]);
  }else{
    a.push(['SCORE',fmtNum(G.score)]);a.push(['LEVEL',String(G.level)]);a.push(['LINES',String(G.lines)]);a.push(['TIME',fmtSec(G.time)]);a.push(['BEST',best?fmtNum(best.s):'--']);
  }
  return a;
}
function bestOf(m){var l=S.best[m];return (l&&l.length)?l[0]:null;}
function qBox(x,y,w,h,ts){ // a hidden piece slot (The Blindfold)
  ctx.fillStyle='rgba(120,90,200,'+(.16+.07*Math.sin(ts/170+y*.05))+')';ctx.fillRect(x+3,y+3,w-6,h-6);
  txtOut('?',x+w/2,y+h/2,Math.min(h*.7,L.m*1.5),'#c9b8ff','center',w);
}
function curseLine(cu){
  var iv=curseInterval(),id=cu.b.id;
  switch(id){
    case 'rumble':return 'JUNK IN '+(iv-cu.cnt);
    case 'hail':return 'HAIL IN '+(iv-cu.cnt);
    case 'mirror':return cu.mir?'MIRRORED!':'WATCH OUT';
    case 'hourglass':return 'GRAVITY x'+(2+.25*cu.cyc).toFixed(1).replace(/\.0$/,'');
    case 'phantom':return 'STACK FADES';
    case 'blind':return cu.peek>0?'PEEKING...':'PEEK IN '+(iv-cu.cnt);
    case 'upside':return cu.flip?'UPSIDE-DOWN!':(cu.warned?'FLIP SOON!':'UPRIGHT');
    case 'flood':return cu.inc?'INCOMING '+cu.inc:'HOLDING BACK';
    case 'conveyor':return 'SHIFT '+(cu.dir>0?'>> ':'<< ')+'IN '+(iv-cu.cnt);
    case 'cryo':return 'FREEZE IN '+(iv-cu.cnt);
  }
  return '';
}
function drawCallout(x,y,w,m,compact){
  var cx=x+w/2;
  if(compact){ // cramped panel (portrait phones): one small line each
    if(G.combo>0){txtFit('COMBO x'+G.combo,cx,y+m*.5,m*.8,comboCol(G.combo),'center',w);y+=m*1.1;}
    if(G.b2bN>0)txtFit('B2B x'+G.b2bN,cx,y+m*.5,m*.75,'#ffb84a','center',w);
    else if(G.b2b)txtFit('B2B',cx,y+m*.5,m*.7,'#ffb84a','center',w);
    return;
  }
  if(G.combo>0){
    var k=Math.max(0,1-G.cpulse/240),col=comboCol(G.combo);
    txtOut('COMBO',cx,y+m*.45,m*.62,col,'center',w);
    txtOut('x'+G.combo,cx,y+m*1.55,m*(1.3+.55*k),col,'center',w);
  }
  if(G.b2bN>0){
    var k2=Math.max(0,1-G.bpulse/240);
    txtOut('B2B x'+G.b2bN,cx,y+m*3.05,m*(.8+.35*k2),'#ffb84a','center',w);
  }else if(G.b2b&&!G.pz)txtFit('B2B READY',cx,y+m*3.05,m*.6,'rgba(255,184,74,.85)','center',w);
}
function drawPanels(th,ts){
  var c=L.c,m=L.m,pad=L.pad,bx=L.bx,bw=COLS*c;
  var lx=pad,lw=bx-pad*2,rx=bx+bw+pad,rw=L.W-rx-pad;
  var y=L.by,fs=Math.max(8,m*.62),cu=G.curse;
  var blind=!!(cu&&cu.b.id==='blind'&&!(cu.peek>0)),blindHold=blind&&cu.cyc>=1;
  // HOLD
  var cap=1+(pkc('pocket')?1:0);
  txtFit('HOLD',lx+lw/2,y+fs*.6,fs,th.acc,'center',lw);
  y+=fs*1.3;
  for(var h=0;h<cap;h++){
    var bh=m*3.0;
    panelBox(lx,y,lw,bh);
    var hp=G.hold[h];
    if(hp&&blindHold)qBox(lx,y,lw,bh,ts);
    else if(hp)drawPiecePrev(hp.t,hp.pi,hp.pt,lx+lw/2,y+bh/2,Math.min(m*.95,lw/4.4),G.holdUsed?.35:1,ts);
    y+=bh+m*.3;
  }
  y+=m*.3;
  var rows=modeStats(),bottom=L.by+VIS*c,avail=bottom-y,cr=(avail-rows.length*m*1.6>=m*3.9)?m*3.9:0;
  var lh=Math.min(m*2.25,(avail-cr)/rows.length);
  for(var i=0;i<rows.length;i++){
    txtFit(rows[i][0],lx+lw/2,y+lh*.22,fs*.9,'rgba(190,205,255,.75)','center',lw);
    var vs=m*1.05,col='#fff';
