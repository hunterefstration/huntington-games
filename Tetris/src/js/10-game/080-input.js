// ---------- input ----------
var isTouch=false;
try{isTouch=('ontouchstart' in window)||(navigator.maxTouchPoints>0)||(window.matchMedia&&window.matchMedia('(pointer:coarse)').matches);}catch(e){}
function touchMode(){var t=S.set.touch;if(t==='auto')return isTouch?'both':'off';return t==='buttons'?'buttons':(t==='swipe'?'swipe':'off');}
var ICO={
  left:'<svg viewBox="0 0 24 24"><path d="M16 4L6 12l10 8z"/></svg>',
  right:'<svg viewBox="0 0 24 24"><path d="M8 4l10 8-10 8z"/></svg>',
  down:'<svg viewBox="0 0 24 24"><path d="M4 8l8 10 8-10z"/></svg>',
  cw:'<svg viewBox="0 0 24 24"><path d="M12 4.5a7.5 7.5 0 1 1-7.2 5.4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M12 0.5l5 4.2-5 4.2z"/></svg>',
  ccw:'<svg viewBox="0 0 24 24" style="transform:scaleX(-1)"><path d="M12 4.5a7.5 7.5 0 1 1-7.2 5.4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M12 0.5l5 4.2-5 4.2z"/></svg>',
  pause:'<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>'
};
var TB=[['left','b-left',ICO.left],['soft','b-down',ICO.down],['right','b-right',ICO.right],['ccw','b-ccw',ICO.ccw],['cw','b-cw',ICO.cw],['hold','b-hold','HOLD'],['hard','b-hard','HARD DROP'],['surge','b-surge','SURGE'],['undo','b-undo','UNDO'],['pause','b-pause',ICO.pause]];
(function buildTouch(){
  var h='';
  TB.forEach(function(b){h+='<div class="tb '+b[1]+(b[0]==='surge'?' surge':'')+'" data-act="'+b[0]+'" role="button" aria-label="'+b[0]+'">'+b[2]+'</div>';});
  touchEl.innerHTML=h;
  var btns=touchEl.querySelectorAll('.tb');
  Array.prototype.forEach.call(btns,function(el){
    var act=el.getAttribute('data-act');
    el.addEventListener('pointerdown',function(e){
      e.preventDefault();initAudio();
      try{el.setPointerCapture(e.pointerId);}catch(_){}
      el.classList.add('dn');press(act,'t'+e.pointerId);
    });
    var up=function(e){el.classList.remove('dn');release(act,'t'+e.pointerId);};
    el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('lostpointercapture',up);
    el.addEventListener('contextmenu',function(e){e.preventDefault();});
  });
})();
var lastCtrl=-1;
function updateTouchUI(noResize){
  var mode=touchMode(),on=!!G&&mode!=='off'&&G.state!=='over';
  var w=window.innerWidth||800,h=window.innerHeight||600,ls=w>h*1.05,ctrl=0,cls='hide';
  if(on){
    cls='on'+(mode==='swipe'?' mini':'')+(ls?' ls':'')+(G.surge?'':' ns')+(G.pz?' pz':'');
    if(!ls)ctrl=mode==='swipe'?64:Math.round(clamp(h*.30,170,250));
  }
  touchEl.className=cls;
  app.style.setProperty('--ctrl',ctrl+'px');
  var sb=touchEl.querySelector('.b-surge');
  if(sb){sb.classList.toggle('ready',!!(G&&G.surge&&G.meter>=100));}
  var ub=touchEl.querySelector('.b-undo');
  if(ub&&G&&G.pz){var ut=G.mode==='tutorial'?'SHOW':'UNDO';if(ub.textContent!==ut)ub.textContent=ut;}
  if(ctrl!==lastCtrl){lastCtrl=ctrl;if(!noResize)resize();}
}
function press(a,src){
  var s=srcs[a]||(srcs[a]={}),was=held[a];
  s[src]=1;held[a]=true;
  if(!was)onPress(a);
}
function release(a,src){
  var s=srcs[a];if(!s)return;
  delete s[src];
  if(!Object.keys(s).length&&held[a])held[a]=false;
}
function onPress(a){
  if(!G)return;
  if(a==='pause'){togglePause();return;}
  if(G.pz){
    if(G.pz.demo&&G.state!=='paused')return; // "Show me" is playing
    if(a==='undo'){pzUndo();return;}
    if(a==='retry'){if(G.state!=='paused')pzRetry();return;}
    if(a==='hint'){pzHint();return;}
    if(G.state==='pzwait')return;
  }
  if(G.state==='paused'||G.state==='over'||G.state==='draft')return;
  if(G.state!=='play'){
    if(a==='cw')G.pend.rot=1;else if(a==='ccw')G.pend.rot=-1;else if(a==='r180')G.pend.rot=2;
    else if(a==='hold')G.pend.hold=true;
    else if(a==='left')G.lastDir=-1;else if(a==='right')G.lastDir=1;
    return;
  }
  switch(a){
    case 'left':G.lastDir=-1;tryMove(-dirSign(),0);break;
    case 'right':G.lastDir=1;tryMove(dirSign(),0);break;
    case 'cw':tryRotate(1);break;
    case 'ccw':tryRotate(-1);break;
    case 'r180':tryRotate(2);break;
    case 'hold':doHold();break;
    case 'hard':hardDrop();break;
    case 'surge':fireSurge();updateTouchUI();break;
    case 'soft':break;
  }
}
var listening=null;
function ovOpen(){return !ov.classList.contains('hide');}
window.addEventListener('keydown',function(e){
  initAudio();
  var tg=e.target,tn=tg&&tg.tagName;
  if(listening){e.preventDefault();e.stopPropagation();doRebind(e.code);return;}
  if(tn==='INPUT'&&tg.type==='text'){if(e.code==='Enter'||e.code==='Escape'){tg.blur();}return;}
  if(ovOpen()){menuKey(e);return;}
  if(!G)return;
  var a=codeMap[e.code];
  if(a){e.preventDefault();if(e.repeat)return;press(a,e.code);}
},true);
window.addEventListener('keyup',function(e){
  var a=codeMap[e.code];
  if(a)release(a,e.code);
},true);
window.addEventListener('blur',function(){for(var k in held)held[k]=false;srcs={};});
document.addEventListener('visibilitychange',function(){
  if(document.hidden){pauseGame();musicStop();if(AC&&AC.suspend){try{AC.suspend();}catch(e){}}}
  else if(AC&&AC.resume){try{AC.resume();}catch(e){}}
});
window.addEventListener('pagehide',function(){pauseGame();save();});
window.addEventListener('resize',resize);
window.addEventListener('orientationchange',function(){setTimeout(resize,120);});
window.addEventListener('touchstart',function(){if(!isTouch){isTouch=true;updateTouchUI();}},{passive:true});
document.addEventListener('contextmenu',function(e){e.preventDefault();});
cv.addEventListener('pointerdown',function(){try{window.focus();cv.focus();}catch(e){}});
// swipe gestures on the board
var gs=null;
cv.addEventListener('pointerdown',function(e){
  initAudio();
  var mode=touchMode();
  if(!G||e.pointerType==='mouse'||(mode!=='both'&&mode!=='swipe')||G.state!=='play')return;
  gs={id:e.pointerId,x0:e.clientX,y0:e.clientY,lx:e.clientX,ly:e.clientY,t0:Date.now(),moved:false,ax:0,ay:0,hold:false};
  try{cv.setPointerCapture(e.pointerId);}catch(_){}
  e.preventDefault();
});
cv.addEventListener('pointermove',function(e){
  if(!gs||e.pointerId!==gs.id||!G||G.state!=='play')return;
  var cell=Math.max(8,L.c/DPR*.85);
  gs.ax+=e.clientX-gs.lx;gs.ay+=e.clientY-gs.ly;gs.lx=e.clientX;gs.ly=e.clientY;
  var sg=dirSign();
  while(gs.ax>=cell){gs.ax-=cell;tryMove(sg,0);gs.moved=true;}
  while(gs.ax<=-cell){gs.ax+=cell;tryMove(-sg,0);gs.moved=true;}
  while(gs.ay>=cell*1.1){gs.ay-=cell*1.1;if(G.cur&&stepDown(true))G.acc=0;gs.moved=true;}
  if(gs.ay<0)gs.ay=Math.max(gs.ay,-cell*3);
  if(!gs.hold&&e.clientY-gs.y0<-cell*2.6&&Math.abs(e.clientX-gs.x0)<cell*2){gs.hold=true;gs.moved=true;doHold();}
});
function gestureEnd(e){
  if(!gs||e.pointerId!==gs.id)return;
  var g=gs;gs=null;
  if(!G||G.state!=='play')return;
  var dt=Math.max(1,Date.now()-g.t0),dx=e.clientX-g.x0,dy=e.clientY-g.y0,cell=Math.max(8,L.c/DPR*.85);
  if(!g.moved&&dt<300&&Math.abs(dx)<12&&Math.abs(dy)<12){tryRotate(dx<0&&false?-1:1);return;}
  if(dy>cell*3&&dy/dt>.6&&Math.abs(dx)<dy*.6&&!g.hold)hardDrop();
}
cv.addEventListener('pointerup',gestureEnd);
cv.addEventListener('pointercancel',function(e){if(gs&&e.pointerId===gs.id)gs=null;});

// ---------- overlay screens ----------
var ovState='',ovBackFn=null,resetArmed=0;
function openOv(html,state,back,clearBg){
  ovState=state||'';ovBackFn=back||null;
  ov.className=clearBg?'clear':'';
  ov.innerHTML=html;
  ov.classList.remove('hide');
  afterRender();
}
function closeOv(){ov.classList.add('hide');ov.innerHTML='';ovState='';ovBackFn=null;listening=null;}
// ---- rank emblems: drawn once into small canvases (never per frame) ----
function shieldPath(g,cx,cy,r){g.beginPath();g.moveTo(cx,cy-r);g.quadraticCurveTo(cx+r*.55,cy-r*.72,cx+r*.95,cy-r*.8);g.lineTo(cx+r*.9,cy+r*.1);g.quadraticCurveTo(cx+r*.75,cy+r*.78,cx,cy+r*1.12);g.quadraticCurveTo(cx-r*.75,cy+r*.78,cx-r*.9,cy+r*.1);g.lineTo(cx-r*.95,cy-r*.8);g.quadraticCurveTo(cx-r*.55,cy-r*.72,cx,cy-r);g.closePath();}
function polyPath(g,cx,cy,r,n,rot){g.beginPath();for(var i=0;i<n;i++){var a=rot+i*2*Math.PI/n;if(i)g.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);else g.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);}g.closePath();}
function starPath(g,cx,cy,r1,r2,n){g.beginPath();for(var i=0;i<n*2;i++){var r=i%2?r2:r1,a=-Math.PI/2+i*Math.PI/n;if(i)g.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);else g.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);}g.closePath();}
function gemPath(g,cx,cy,r){g.beginPath();g.moveTo(cx-r*.95,cy-r*.3);g.lineTo(cx-r*.52,cy-r*.85);g.lineTo(cx+r*.52,cy-r*.85);g.lineTo(cx+r*.95,cy-r*.3);g.lineTo(cx,cy+r*1.05);g.closePath();}
function drawEmblem(g,t,d,s){
  var cx=s/2,cy=s/2,i;
  g.clearRect(0,0,s,s);g.save();
  g.lineJoin='round';g.lineCap='round';
  if(t<0){ // unranked
    g.fillStyle='rgba(120,135,180,.35)';g.strokeStyle='rgba(200,210,255,.6)';g.lineWidth=Math.max(1.5,s*.03);
    shieldPath(g,cx,cy-s*.02,s*.34);g.fill();g.stroke();
    g.fillStyle='#dfe6ff';g.font='bold '+Math.round(s*.32)+'px '+FONT;g.textAlign='center';g.textBaseline='middle';g.fillText('?',cx,cy+s*.02);
    g.restore();return;
  }
  var T=TIERS[t],gr=g.createLinearGradient(0,s*.12,0,s*.9);
  gr.addColorStop(0,shade(T.c,.45));gr.addColorStop(.5,T.c);gr.addColorStop(1,T.c2);
  g.shadowColor=T.c;g.shadowBlur=s*.1;
  if(t>=5){ // Master+: a star burst behind the badge
    g.fillStyle=t===6?'#ffd23a':shade(T.c,.25);starPath(g,cx,cy,s*.48,s*.31,8);g.fill();
  }
  if(t>=2){ // Gold+: wings
    g.fillStyle=shade(T.c,-.12);
    for(i=-1;i<=1;i+=2){g.beginPath();g.moveTo(cx+i*s*.18,cy-s*.14);g.quadraticCurveTo(cx+i*s*.5,cy-s*.32,cx+i*s*.47,cy+s*.03);g.quadraticCurveTo(cx+i*s*.36,cy+s*.03,cx+i*s*.18,cy+s*.16);g.closePath();g.fill();
      g.strokeStyle='rgba(255,255,255,.5)';g.lineWidth=Math.max(1,s*.012);g.beginPath();g.moveTo(cx+i*s*.24,cy-s*.06);g.lineTo(cx+i*s*.42,cy-s*.18);g.moveTo(cx+i*s*.24,cy+s*.02);g.lineTo(cx+i*s*.43,cy-s*.06);g.stroke();}
  }
  g.fillStyle=gr;g.strokeStyle='rgba(255,255,255,.9)';g.lineWidth=Math.max(1.5,s*.025);
  if(t<=2)shieldPath(g,cx,cy-s*.03,s*.32);
  else if(t===4)gemPath(g,cx,cy-s*.02,s*.34);
  else polyPath(g,cx,cy,s*.32,6,-Math.PI/2);
  g.fill();g.shadowBlur=0;g.stroke();
  if(t===1||t===3){g.strokeStyle='rgba(255,255,255,.45)';g.lineWidth=Math.max(1,s*.012);if(t===1)shieldPath(g,cx,cy-s*.03,s*.25);else polyPath(g,cx,cy,s*.25,6,-Math.PI/2);g.stroke();}
  if(t===4){ // gem facets
    g.strokeStyle='rgba(255,255,255,.55)';g.lineWidth=Math.max(1,s*.012);g.beginPath();
    g.moveTo(cx-s*.32,cy-s*.12);g.lineTo(cx+s*.32,cy-s*.12);g.moveTo(cx-s*.18,cy-s*.31);g.lineTo(cx-s*.1,cy-s*.12);g.lineTo(cx,cy+s*.33);
    g.moveTo(cx+s*.18,cy-s*.31);g.lineTo(cx+s*.1,cy-s*.12);g.lineTo(cx,cy+s*.33);g.stroke();
  }
  // shine
  g.fillStyle='rgba(255,255,255,.22)';g.beginPath();g.ellipse(cx-s*.07,cy-s*.17,s*.13,s*.06,-.5,0,6.2832);g.fill();
  if(t===6){ // Grandmaster crown
    var ky=cy-s*.36;
    g.beginPath();g.moveTo(cx-s*.17,ky+s*.07);g.lineTo(cx-s*.2,ky-s*.08);g.lineTo(cx-s*.09,ky-s*.01);g.lineTo(cx,ky-s*.13);g.lineTo(cx+s*.09,ky-s*.01);g.lineTo(cx+s*.2,ky-s*.08);g.lineTo(cx+s*.17,ky+s*.07);g.closePath();
    g.fillStyle='#ffd23a';g.fill();g.strokeStyle='#7a4a00';g.lineWidth=Math.max(1,s*.015);g.stroke();
  }
  // centre mark: division chevrons (III = 1, II = 2, I = 3) or a letter for Master / Grandmaster
  if(d>=0){
    var n=d+1,hh=s*.065,w=s*.12,y0=cy+s*.02-(n-1)*hh*.8;
    for(var pass=0;pass<2;pass++){
      g.strokeStyle=pass?'#fff':'rgba(0,0,0,.45)';g.lineWidth=pass?s*.04:s*.07;
      for(i=0;i<n;i++){var yy=y0+i*hh*1.6;g.beginPath();g.moveTo(cx-w,yy+hh*.6);g.lineTo(cx,yy-hh*.6);g.lineTo(cx+w,yy+hh*.6);g.stroke();}
    }
  }else{
    g.font='900 '+Math.round(s*(t===6?.2:.24))+'px '+FONT;g.textAlign='center';g.textBaseline='middle';
    g.lineWidth=s*.04;g.strokeStyle='rgba(0,0,0,.5)';g.strokeText(t===6?'GM':'M',cx,cy+s*.02);g.fillStyle='#fff';g.fillText(t===6?'GM':'M',cx,cy+s*.02);
  }
  g.restore();
}
function drawSpark(c2,arr,col){
  var w=Math.max(60,c2.clientWidth||200),h=Math.max(16,c2.clientHeight||26);
  c2.width=w;c2.height=h;
  var g=c2.getContext('2d'),i;
  g.clearRect(0,0,w,h);
  if(!arr||arr.length<2){g.fillStyle='rgba(150,165,210,.75)';g.font='11px '+FONT;g.textBaseline='middle';g.fillText('Your rating trend shows up here',2,h/2);return;}
  var mn=Infinity,mx=-Infinity;
  for(i=0;i<arr.length;i++){if(arr[i]<mn)mn=arr[i];if(arr[i]>mx)mx=arr[i];}
  if(mx-mn<60){var mid=(mx+mn)/2;mn=mid-30;mx=mid+30;}
  function Y(v){return h-2-(v-mn)/(mx-mn)*(h-4);}
  g.lineWidth=1;
  TIERS.forEach(function(T){if(T.min>mn&&T.min<mx){g.strokeStyle=rgba(T.c,.4);g.beginPath();g.moveTo(0,Y(T.min)+.5);g.lineTo(w,Y(T.min)+.5);g.stroke();}});
  g.strokeStyle=col;g.lineWidth=2;g.beginPath();
  for(i=0;i<arr.length;i++){var x=2+i/(arr.length-1)*(w-6);if(i)g.lineTo(x,Y(arr[i]));else g.moveTo(x,Y(arr[i]));}
  g.stroke();
  g.fillStyle=col;g.beginPath();g.arc(w-4,Y(arr[arr.length-1]),3,0,6.2832);g.fill();
}
function afterRender(){
  var pico=ov.querySelectorAll('canvas.pico');
  Array.prototype.forEach.call(pico,function(c2){
    var g=c2.getContext('2d'),p=+c2.getAttribute('data-p'),sz=c2.width;
    g.clearRect(0,0,sz,sz);
    drawBlockStyle(g,'glass',theme().cols[p===1?7:(p===2?1:(p===3?2:(p===4?3:4)))],0,0,sz);
    drawPower(g,p,0,0,sz,0);
  });
  var tc=ov.querySelectorAll('canvas.tp');
  Array.prototype.forEach.call(tc,function(c2){
    var th=TH_BY[c2.getAttribute('data-t')],g=c2.getContext('2d'),W=c2.width,H=c2.height;
    var gr=g.createLinearGradient(0,0,0,H);gr.addColorStop(0,th.bg[0]);gr.addColorStop(1,th.bg[1]);
    g.fillStyle=gr;g.fillRect(0,0,W,H);
    var s=Math.floor(Math.min(H/2.2,(W-12)/7-3)),st=c2.getAttribute('data-k')?SKIN_BY[c2.getAttribute('data-k')].style||th.style:th.style;
    for(var i=1;i<=7;i++)drawBlockStyle(g,st,th.cols[i],Math.round((W-7*s-18)/2+(i-1)*(s+3)),Math.round((H-s)/2),s);
  });
  Array.prototype.forEach.call(ov.querySelectorAll('canvas.bgp'),function(c2){try{previewScene(c2,c2.getAttribute('data-g'));}catch(e){}});
  Array.prototype.forEach.call(ov.querySelectorAll('canvas.cprev'),function(c2){try{previewCustom(c2);}catch(e){}});
  Array.prototype.forEach.call(ov.querySelectorAll('canvas.emb'),function(c2){
    try{drawEmblem(c2.getContext('2d'),+c2.getAttribute('data-tier'),+(c2.getAttribute('data-div')||-1),c2.width);}catch(e){}
  });
  Array.prototype.forEach.call(ov.querySelectorAll('canvas.spk'),function(c2){
    var R=S.rank[c2.getAttribute('data-m')];
    try{drawSpark(c2,R?R.h:null,c2.getAttribute('data-c')||'#5ad1ff');}catch(e){}
  });
  // animated rating bars and counters (one short timer each, they stop by themselves)
  var bars=ov.querySelectorAll('.rbar i[data-w1]');
  if(bars.length)setTimeout(function(){Array.prototype.forEach.call(bars,function(b){b.style.width=b.getAttribute('data-w1')+'%';});},120);
  Array.prototype.forEach.call(ov.querySelectorAll('.cnt'),function(el){
    var a=+el.getAttribute('data-from'),b=+el.getAttribute('data-to'),t0=Date.now();
    if(a===b)return;
    el.textContent=a;
    var iv=setInterval(function(){
      var k=Math.min(1,(Date.now()-t0)/1100);k=1-(1-k)*(1-k);
      el.textContent=Math.round(a+(b-a)*k);
      if(k>=1||!el.isConnected)clearInterval(iv);
    },40);
  });
  var f=ov.querySelector('[data-focus]')||ov.querySelector('.btn.pri')||ov.querySelector('.card')||ov.querySelector('.btn');
  if(f&&ovState!=='settings'&&ovState!=='controls'){try{f.focus({preventScroll:true});}catch(e){}}
}
function backBtn(label){return '<div class="row"><button class="btn" data-a="back">'+(label||'Back')+'</button></div>';}
function dateStr(d){d=String(d||'');return d.length===8?d.substr(0,4)+'-'+d.substr(4,2)+'-'+d.substr(6,2):'';}
function rankBadge(m){
  var R=S.rank[m];
  if(!R||R.n<PLACE)return '<div class="rk"><small>Unranked &middot; placement '+(R?R.n:0)+'/'+PLACE+'</small></div>';
  var t=tierOf(R.r);
  return '<div class="rk" style="color:'+TIERS[t.t].c+'">'+rankName(t)+' <small>'+R.r+'</small></div>';
}
function nDays(n){n=n||0;return n+' day'+(n===1?'':'s');}
function dailyStreakNow(){var D=S.daily,t=today();return (D.lastDay===t||D.lastDay===prevDay(t))?(D.streak||0):0;}
function cardHtml(id,feat){
  var m=MODES[id],b=bestOf(id),bt='',extra='',badge='',act='play:'+id,name=m.name,tag=m.tag;
  if(b){bt=(id==='sprint')?fmtTime(b.t):fmtNum(b.s);if(MODES[id].sort==='score'&&(id==='surge'||id==='daily')&&b.f)bt+='  (Floor '+b.f+')';}
  if(id==='marathon')extra='<div class="lv">Start level <button class="btn" data-a="lv:-1">-</button><b>'+(S.last.lv||1)+'</b><button class="btn" data-a="lv:1">+</button></div>';
  if(feat)badge='<span class="badge">THE TWIST</span>';
  if(id==='daily'){
    var di=dailyInfo(today()),dh=S.daily.h[di.d],sk=dailyStreakNow();
    badge='<span class="badge">'+dateStr(today())+'</span>';act='daily';name='Daily Challenge';
    tag='Today: '+DAILY_NAME[di.kind]+'. Same pieces for everyone.';
    bt='';
    extra='<div class="best">'+(dh&&dh.k===di.kind?'Today: '+dailyResStr(dh):'Not played today')+(sk?' &middot; Streak '+sk:'')+'</div>';
  }
  if(RANKED[id])extra+=rankBadge(id);
  return '<div class="card'+(feat?' feat':'')+'" tabindex="0" data-a="'+act+'">'+badge+'<h3>'+name+'</h3><p>'+tag+'</p>'+extra+(bt?'<div class="best">Best: '+bt+'</div>':'')+'</div>';
}
function achCount(){var n=0;ACH.forEach(function(a){if(S.ach[a[0]])n++;});return n;}
function showMenu(){
  if(G&&G.state==='over'){G=null;updateTouchUI();}
  var h='<div class="panel"><div class="logo"><span>TETRIS</span><b>SURGE</b></div><div class="tag">Stack. Charge. Detonate.<span class="ver" data-a="news" title="What\'s new">v'+VERSION+'</span></div><div class="cards">';
  h+=cardHtml('surge',true);
  ['daily','marathon','sprint','ultra','zen'].forEach(function(id){h+=cardHtml(id,false);});
  var ps=pzStars(),pt=PZ_ALL.length*3,np=PZ_PACKS.filter(packOpen).length;
  h+='</div><div class="cards duo"><div class="card pz" tabindex="0" data-a="puzzles"><span class="badge">NEW</span><h3>PUZZLES</h3><p>'+PZ_ALL.length+' handcrafted boards in '+PZ_PACKS.length+' packs: T-Spins, Perfect Clears, digging, combos.</p><div class="best">&#9733; '+ps+' / '+pt+' stars &middot; '+pzSolvedCount()+' solved &middot; '+np+'/'+PZ_PACKS.length+' packs open</div><div class="pbar"><i style="width:'+Math.round(ps/Math.max(1,pt)*100)+'%"></i></div></div>';
  h+='<div class="card tut" tabindex="0" data-a="tutorial"><h3>TUTORIAL</h3><p>Learn Hold and T-Spins step by step.</p><div class="best">'+tutDone()+'/'+LESSONS.length+' lessons done</div></div></div>';
  h+='<div class="row mrow"><button class="btn" data-a="stats:ranks">Ranks</button><button class="btn" data-a="stats:ach">Achievements</button><button class="btn" data-a="stats:scores">Scores &amp; Stats</button><button class="btn" data-a="custom">Customize</button><button class="btn" data-a="settings">Settings</button><button class="btn" data-a="how">How to Play</button><button class="btn" data-a="news">What\'s New</button></div>';
  h+='<div style="font-size:11px;color:#7f8bb8;margin-top:10px">Achievements: '+achCount()+'/'+ACH.length+' &nbsp;|&nbsp; Best Surge floor: '+S.stats.bestFloor+' &nbsp;|&nbsp; Keys: arrows / Z X / Space / C / P</div></div>';
  openOv(h,'menu',null);
}
function showPause(){
  if(G.pz){showPzPause();return;}
  var h='<div class="panel narrow"><h2>PAUSED</h2><div class="tag" style="margin-top:0">'+esc(modeName())+'</div>';
  if(G.curse)h+='<div style="font-size:12px;color:#ffb0b0;margin:-4px 0 6px"><b>'+esc(G.curse.b.name)+':</b> '+esc(G.curse.b.desc)+'</div>';
  if(G.surge&&G.perkLog.length){
    var pseen={};G.perkLog.forEach(function(id){pseen[id]=(pseen[id]||0)+1;});
    h+='<div style="font-size:12px;color:#b9c4ec;margin:2px 0 8px;line-height:1.5"><b style="color:#fff">Your perks:</b> '+Object.keys(pseen).map(function(id){return esc(PERK_BY[id].n)+(pseen[id]>1?' x'+pseen[id]:'');}).join(', ')+'</div>';
  }
  if(RANKED[G.mode]&&!G.daily)h+='<div style="font-size:12px;color:#93a0c8;margin:0 0 6px">Ranked run: ending it counts for your '+RANKED[G.mode].n+' rank.</div>';
  h+='<div class="row" style="flex-direction:column;align-items:stretch">';
  h+='<button class="btn pri" data-a="resume" data-focus="1">Resume</button>';
  h+='<button class="btn" data-a="restart">Restart</button>';
  h+='<button class="btn" data-a="settings">Settings</button>';
  h+='<button class="btn" data-a="controls">Controls</button>';
  h+='<button class="btn" data-a="how">How to Play</button>';
  h+='<button class="btn" data-a="quit">'+(G.mode==='sprint'?'Quit to Menu':'End Run (save score)')+'</button>';
  h+='</div></div>';
  openOv(h,'pause',resumeGame);
}
function showPzPause(){
  var z=G.pz,h='<div class="panel narrow"><h2>PAUSED</h2>';
  if(G.mode==='puzzle'){
    var d=z.d;
    h+='<div class="tag" style="margin-top:0">Puzzle '+pzLabel(d)+' &middot; '+esc(d.n)+'</div><div class="goal"><b>Goal:</b> '+esc(pzGoal(d))+'<br><small style="color:#93a0c8">'+d.q.length+' pieces. 3 stars: '+d.p[0]+' or fewer, 2 stars: '+d.p[1]+' or fewer.'+(d.h?' Tip: '+esc(d.h):'')+'</small></div>';
    h+='<div class="row" style="flex-direction:column;align-items:stretch">';
    h+='<button class="btn pri" data-a="resume" data-focus="1">Resume</button>';
    h+='<button class="btn" data-a="pzundo">Undo last piece</button>';
    h+='<button class="btn" data-a="pzhint">Show a hint'+(z.hinted?'':' (max 2 stars)')+'</button>';
    h+='<button class="btn" data-a="restart">Restart puzzle</button>';
    h+='<button class="btn" data-a="pack:'+d.pi+'">Puzzle list</button>';
  }else{
    h+='<div class="tag" style="margin-top:0">Lesson: '+esc(z.l.n)+' &middot; step '+(z.step+1)+'/'+z.l.steps.length+'</div>';
    h+='<div class="row" style="flex-direction:column;align-items:stretch">';
    h+='<button class="btn pri" data-a="resume" data-focus="1">Resume</button>';
    h+='<button class="btn" data-a="pzundo">Show me how</button>';
    h+='<button class="btn" data-a="pzretry">Restart this step</button>';
    h+='<button class="btn" data-a="tutorial">All lessons</button>';
  }
  h+='<button class="btn" data-a="settings">Settings</button><button class="btn" data-a="controls">Controls</button><button class="btn" data-a="menu">Quit to Menu</button></div></div>';
  openOv(h,'pause',resumeGame);
}
function sumBox(l,v){return '<div><small>'+l+'</small><span>'+v+'</span></div>';}
function deltaHtml(d){return d>0?'<span class="up">+'+d+'</span>':(d<0?'<span class="down">'+d+'</span>':'<span>+0</span>');}
function nextRankName(t){
  if(t.d>=0&&t.d<2)return TIERS[t.t].n+' '+['III','II','I'][t.d+1];
  if(t.t<TIERS.length-1){var nt=TIERS[t.t+1];return nt.n+(nt.div?' III':'');}
  return '';
}
function rankCardHtml(res){
  if(!res)return '';
  var nm=RANKED[res.mode].n;
  if(res.skip)return '<div class="rkcard"><canvas class="emb" width="120" height="120" data-tier="-1"></canvas><div class="rki"><div class="rkm">'+nm+' rank</div><small>Too short to count. Place at least 10 pieces for a run to affect your rank.</small></div></div>';
  var R=S.rank[res.mode],pt=tierOf(res.perf),pc=TIERS[pt.t].c;
  if(res.placing)return '<div class="rkcard"><canvas class="emb" width="120" height="120" data-tier="-1"></canvas><div class="rki"><div class="rkm">'+nm+' rank</div><div class="rkt">Placement '+R.n+'/'+PLACE+'</div><small>This run played like <b style="color:'+pc+'">'+rankName(pt)+'</b> ('+res.perf+'). Finish '+(PLACE-R.n)+' more to get ranked.</small></div></div>';
  var t=res.tier,T=TIERS[t.t],bt=tierOf(res.before);
  var w1=Math.round(t.prog*100),w0=res.placed?0:(bt.step===t.step?Math.round(bt.prog*100):(t.step>bt.step?0:100));
  var msg=res.placed?'Placement done!':(res.promo?'Promoted!':(res.demo?'Demoted. Win it back!':(res.delta>=0?'Rating up.':'Rating down.')));
  var nx=nextRankName(t);
  var h='<div class="rkcard"><canvas class="emb" width="120" height="120" data-tier="'+t.t+'" data-div="'+t.d+'"></canvas><div class="rki"><div class="rkm">'+nm+' rank</div>';
  h+='<div class="rkt" style="color:'+T.c+'">'+rankName(t)+'<span class="rkr"><b class="cnt" data-from="'+(res.placed?0:res.before)+'" data-to="'+res.after+'">'+res.after+'</b> '+(res.placed?'':deltaHtml(res.delta))+'</span></div>';
  h+='<div class="rbar"><i data-w1="'+w1+'" style="width:'+w0+'%;background:linear-gradient(90deg,'+T.c2+','+T.c+')"></i></div>';
  h+='<small>'+msg+' This run: <b style="color:'+pc+'">'+rankName(pt)+'</b> pace ('+res.perf+').'+(nx?' Next: '+nx+' at '+Math.ceil(t.hi)+'.':' Top of the ladder!')+'</small></div></div>';
  return h;
}
function dailyResHtml(){
  var r=G.dres;if(!r||!G.daily)return '';
  var D=S.daily;
  return '<div class="rkcard"><div class="rki"><div class="rkm">'+DAILY_NAME[G.daily.kind]+' &middot; '+dateStr(G.daily.d)+'</div><div class="rkt" style="color:'+(r.best?'#ffd96b':'#fff')+'">'+(r.best?(r.first?'First run today!':'NEW DAILY BEST!'):'Today\'s best: '+dailyResStr(r.entry))+'</div><small>Try #'+r.tries+' today &middot; Streak: '+nDays(D.streak)+' (best '+(D.bestStreak||0)+') &middot; Everyone gets the same pieces today.</small></div></div>';
}
function showPromo(){
  var res=G.rk,t=res.tier,T=TIERS[t.t];
  var title=res.promo==='placed'?'RANKED!':(res.tierUp?'PROMOTED!':'RANK UP!');
  var h='<div class="panel narrow promo"><div class="ptag" style="color:'+T.c+'">'+title+'</div><div class="tag" style="margin:2px 0 0">'+esc(RANKED[res.mode].n)+(res.promo==='placed'?' placement complete':'')+'</div>';
  h+='<div class="ewrap" style="--rc:'+T.c+'"><div class="rays"></div><canvas class="emb" width="320" height="320" data-tier="'+t.t+'" data-div="'+t.d+'"></canvas></div>';
  h+='<h2 style="color:'+T.c+'">'+esc(rankName(t).toUpperCase())+'</h2>';
  h+='<div style="font-size:15px">Rating <b class="cnt" data-from="'+(res.promo==='placed'?0:res.before)+'" data-to="'+res.after+'">'+res.after+'</b> '+(res.promo==='placed'?'':deltaHtml(res.delta))+'</div>';
  var nx=nextRankName(t);
  if(nx)h+='<div style="font-size:12px;color:#93a0c8;margin-top:4px">Next up: '+nx+' at '+Math.ceil(t.hi)+'</div>';
  h+='<div class="row"><button class="btn pri" data-a="promo" data-focus="1">Continue</button></div></div>';
  openOv(h,'promo',function(){showResult(true);},true);
  sfx.promo();confettiBurst();flash('255,240,200',.35);
}
function showResult(skipPromo){
  if(!G)return;
  if(G.pz){if(G.mode==='puzzle')showPzResult();else showLessonDone();return;}
  if(!skipPromo&&G.rk&&G.rk.promo&&!G.promoDone){G.promoDone=true;showPromo();return;}
  var isTime=G.mode==='sprint',reason=G.over;
  var title=reason==='win'?'SPRINT COMPLETE!':(reason==='time'?"TIME'S UP!":(reason==='quit'?'RUN ENDED':'GAME OVER'));
  var h='<div class="panel"><h2>'+title+'</h2><div class="tag" style="margin-top:0">'+esc(modeName())+'</div>';
  h+='<div class="big">'+(isTime&&reason==='win'?fmtTime(G.time):fmtNum(G.score))+'</div>';
  if(G.record)h+='<div class="rec">NEW HIGH SCORE!</div>';
  else if(G.rank>0)h+='<div style="color:#ffd96b;font-weight:800">Top 5: rank #'+(G.rank+1)+'</div>';
  h+=rankCardHtml(G.rk)+dailyResHtml();
  h+='<div class="sum">';
  if(isTime)h+=sumBox('Score',fmtNum(G.score));
  h+=sumBox('Lines',G.lines)+sumBox('Time',fmtTime(G.time))+sumBox('Pieces',G.pieces);
  if(G.surge)h+=sumBox('Floor',G.floor)+sumBox('Bosses',G.st.bosses);
  else if(G.mode==='marathon'||G.mode==='ultra')h+=sumBox('Level',G.level);
  h+=sumBox('Pieces/sec',G.time>0?(G.pieces/(G.time/1000)).toFixed(2):'0')+sumBox('Max combo',G.st.maxCombo)+sumBox('T-Spins',G.st.tspins)+sumBox('Tetrises',G.st.tetrises);
  if(G.st.b2bMax)h+=sumBox('Best B2B',G.st.b2bMax);
  if(G.st.pcs)h+=sumBox('Perfect clears',G.st.pcs);
  if(G.surge)h+=sumBox('Power blocks',G.st.powers);
  h+='</div>';
  if(G.surge&&G.perkLog.length){
    var seen={};G.perkLog.forEach(function(id){seen[id]=(seen[id]||0)+1;});
    h+='<div style="font-size:12px;color:#b9c4ec;margin:4px 0 8px"><b style="color:#fff">Perks:</b> '+Object.keys(seen).map(function(id){return esc(PERK_BY[id].n)+(seen[id]>1?' x'+seen[id]:'');}).join(', ')+'</div>';
  }
  h+='<div class="row"><button class="btn pri" data-a="again" data-focus="1">Play Again</button><button class="btn" data-a="menu">Menu</button>';
  if(G.daily)h+='<button class="btn" data-a="stats:daily">Daily History</button>';
  else if(RANKED[G.mode])h+='<button class="btn" data-a="stats:ranks">Ranks</button>';
  h+='<button class="btn" data-a="stats:scores">Scores</button></div></div>';
  openOv(h,'result',null,true);
  if(G.rk&&G.rk.demo)sfx.demote();
}
function showDraft(){
  var d=G.draft,pk=G.pk,nc=d.cards.length;
  var h='<div class="panel"><h2>'+(d.boss?'BOSS REWARD':'CHOOSE A PERK')+'</h2><div class="tag" style="margin-top:0">Floor '+G.floor+' cleared &nbsp;|&nbsp; Score '+fmtNum(G.score)+'</div><div class="perks">';
  d.cards.forEach(function(id,i){
    var p=PERK_BY[id],own=pk[id]||0;
    h+='<div class="perk '+p.r+'" tabindex="0" data-a="perk:'+id+'"'+(i===0?' data-focus="1"':'')+'><span class="num">'+(i+1)+'</span><div class="rar">'+p.r+'</div><h3>'+esc(p.n)+'</h3><p>'+esc(p.d)+'</p><div class="own">'+(own?'Owned: '+own+'/'+p.max+' (stacks!)':'New! (max '+p.max+')')+'</div></div>';
  });
  h+='</div><div class="row">';
  if(d.rerolls>0)h+='<button class="btn" data-a="reroll">Reroll ('+d.rerolls+')</button>';
  h+='<button class="btn" data-a="perk:skip">Skip: +'+fmtNum(1000*G.floor)+' pts &amp; 50% Surge</button></div>';
  var nb=isBoss(G.floor+1)?bossFor(G.floor+1):null;
  if(nb)h+='<div style="font-size:12px;color:#ffb0b0;margin-top:6px"><b>Next floor boss: '+esc(nb.name)+'</b> - '+esc(nb.desc)+'</div>';
  h+='<div style="font-size:11px;color:#7f8bb8;margin-top:8px">Press '+(nc>=4?'1 to 4':'1, 2 or 3')+' to choose</div></div>';
  openOv(h,'draft',null,true);
}
function dailyHistHtml(n){
  var ks=Object.keys(S.daily.h).map(Number).sort(function(a,b){return b-a;}).slice(0,n),td=today();
  if(!ks.length)return '<div style="color:#7f8bb8;font-size:13px;text-align:left">No daily runs yet. Today is a great day to start!</div>';
  var h='<table><tr><th>Date</th><th>Challenge</th><th class="r">Your best</th><th class="r">Tries</th></tr>';
  ks.forEach(function(d){var e=S.daily.h[d];h+='<tr'+(d===td?' style="color:#ffd96b"':'')+'><td>'+dateStr(d)+(d===td?' (today)':'')+'</td><td>'+(DAILY_NAME[e.k]||DAILY_NAME.surge)+'</td><td class="r">'+dailyResStr(e)+'</td><td class="r">'+(e.n||1)+'</td></tr>';});
  return h+'</table>';
}
function dailyBests(){ // personal bests across the whole daily history, per challenge type
  var b={surge:null,sprint:null,ultra:null};
  for(var d in S.daily.h){var e=S.daily.h[d],k=e.k||'surge';if(!b.hasOwnProperty(k))continue;if(k==='sprint'&&!e.w)continue;if(!b[k]||dailyBetter(e,b[k]))b[k]=e;}
  return b;
}
function showDaily(){
  var di=dailyInfo(today()),D=S.daily,h=D.h[di.d],tm=dailyInfo(nextDay(di.d)),pb=dailyBests();
  if(h&&h.k!==di.kind)h=null;
  var x='<div class="panel"><h2>DAILY CHALLENGE</h2><div class="tag" style="margin-top:0">'+dateStr(di.d)+' &middot; same pieces for everyone today</div>';
  x+='<div class="dhero"><h3>'+DAILY_NAME[di.kind]+'</h3><p>'+DAILY_DESC[di.kind]+'</p>';
  if(di.gift)x+='<span class="gift">Today\'s gift perk: '+esc(PERK_BY[di.gift].n)+'</span>';
  x+='</div>';
  x+='<div class="sum">'+sumBox('Today\'s best',h?dailyResStr(h):'--')+sumBox('Tries today',h?h.n:0)+sumBox('Streak',nDays(dailyStreakNow()))+sumBox('Best streak',nDays(D.bestStreak))+sumBox('Days played',D.days||0)+'</div>';
  x+='<div class="row"><button class="btn pri" data-a="play:daily" data-focus="1">Play '+DAILY_NAME[di.kind]+'</button><button class="btn" data-a="back">Back</button></div>';
  x+='<div style="font-size:12px;color:#93a0c8;margin-top:6px">Tomorrow: '+DAILY_NAME[tm.kind]+'. Play every day to grow your streak. Daily runs do not change your rank.</div>';
  x+='<h3>Personal bests</h3><div class="sum">'+sumBox('Daily Surge',pb.surge?dailyResStr(pb.surge):'--')+sumBox('Daily Sprint',pb.sprint?fmtTime(pb.sprint.t):'--')+sumBox('Daily Ultra',pb.ultra?fmtNum(pb.ultra.s):'--')+'</div>';
  x+='<h3>History</h3>'+dailyHistHtml(14)+'</div>';
  openOv(x,'daily',showMenu);
}
