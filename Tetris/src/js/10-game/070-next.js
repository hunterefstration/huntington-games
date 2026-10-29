    if(rows[i][0]==='TIME LEFT'&&ULTRA_MS-G.time<10000)col='#ff7a7a';
    txtFit(rows[i][1],lx+lw/2,y+lh*.64,vs,col,'center',lw);
    y+=lh;
  }
  drawCallout(lx,cr?bottom-cr:bottom-m*2.3,lw,m,!cr);
  // NEXT
  y=L.by;
  txtFit(blind?'NEXT  ???':(G.pz?'NEXT ('+G.queue.length+')':'NEXT'),rx+rw/2,y+fs*.6,fs,blind?'#c9b8ff':th.acc,'center',rw);
  y+=fs*1.3;
  var nh=m*3.1+ m*2.5*4;
  panelBox(rx,y,rw,nh);
  var ny=y+m*1.6;
  if(blind){
    qBox(rx,y+m*.2,rw,m*2.8,ts);
    txtFit('HIDDEN',rx+rw/2,y+m*4.4,m*.75,'#c9b8ff','center',rw-6);
    txtFit('Peek in '+(curseInterval()-cu.cnt)+' pieces',rx+rw/2,y+m*5.6,m*.6,'rgba(200,190,255,.8)','center',rw-6);
  }else{
    for(var n=0;n<5;n++){
      var q=G.queue[n];
      if(q){
        var cell=n===0?Math.min(m*.95,rw/4.4):Math.min(m*.75,rw/5.2);
        drawPiecePrev(q.t,q.pi,q.pt,rx+rw/2,ny,cell,1,ts);
      }
      ny+=(n===0?m*2.8:m*2.5);
    }
  }
  y+=nh+m*.5;
  if(G.pz)drawGoalPanel(rx,y,rw,m,fs,th,ts);
  // surge extras
  if(G.surge){
    var mh=m*1.25;
    txtFit('SURGE',rx+rw/2,y+fs*.4,fs*.9,'rgba(255,200,255,.9)','center',rw);
    y+=fs*.9;
    panelBox(rx,y,rw,mh);
    var fillw=Math.max(0,(rw-4)*G.meter/100);
    var gr=ctx.createLinearGradient(rx,0,rx+rw,0);gr.addColorStop(0,'#a02a8a');gr.addColorStop(1,G.meter>=100?'#ffb84a':'#ff5ad1');
    ctx.fillStyle=gr;ctx.fillRect(rx+2,y+2,fillw,mh-4);
    if(G.meter>=100&&S.set.fx>0){ctx.fillStyle='rgba(255,255,255,'+(.15+.15*Math.sin(ts/90))+')';ctx.fillRect(rx+2,y+2,rw-4,mh-4);}
    txtFit(G.meter>=100?'READY!':Math.floor(G.meter)+'%',rx+rw/2,y+mh/2,m*.8,'#fff','center',rw);
    y+=mh+m*.5;
    if(cu){
      panelBox(rx,y,rw,m*3.4);
      txtFit(G.ward>0?'BOSS  |  WARD x'+G.ward:'BOSS',rx+rw/2,y+m*.55,fs*.85,G.ward>0?'#9fe8ff':'#ff8a8a','center',rw-4);
      txtFit(cu.b.name,rx+rw/2,y+m*1.35,m*.78,'#fff','center',rw-6);
      txtFit(curseLine(cu),rx+rw/2,y+m*2.25,m*.7,'#ffd96b','center',rw-6);
      var pw2=rw-8;ctx.fillStyle='rgba(255,255,255,.15)';ctx.fillRect(rx+4,y+m*2.75,pw2,m*.35);
      ctx.fillStyle='#ff5a5a';ctx.fillRect(rx+4,y+m*2.75,pw2*Math.min(1,G.floorLines/G.target),m*.35);
      y+=m*3.4+m*.4;
    }
    // perk chips
    var chipW=Math.max(m*1.5,rw/3-3),chipH=m*1.05,cx0=rx,cx=cx0,cy=y;
    var seen={};
    G.perkLog.forEach(function(id){seen[id]=(seen[id]||0)+1;});
    var ids=Object.keys(seen);
    for(var k=0;k<ids.length;k++){
      if(cx+chipW>rx+rw+1){cx=cx0;cy+=chipH+3;}
      if(cy+chipH>L.by+VIS*c)break;
      var pk=PERK_BY[ids[k]],rc=pk.r==='rare'?'#ffb84a':(pk.r==='uncommon'?'#5be39a':'#8fb3ff');
      ctx.fillStyle='rgba(10,14,44,.8)';rr(ctx,cx,cy,chipW,chipH,3);ctx.fill();
      ctx.strokeStyle=rc;ctx.lineWidth=1;ctx.stroke();
      txtFit(pk.c+(seen[ids[k]]>1?' x'+seen[ids[k]]:''),cx+chipW/2,cy+chipH/2,m*.65,'#fff','center',chipW-4);
      cx+=chipW+3;
    }
  }
}
function pzProgress(){ // the live 'how far along' line for the goal panel
  var z=G.pz,d=z.d,n=0,x,y;
  switch(d.g){
    case 'pc':for(y=0;y<ROWS;y++)for(x=0;x<COLS;x++)if(G.grid[y][x])n++;return 'Blocks left: '+n;
    case 'clear':for(y=0;y<ROWS;y++)for(x=0;x<COLS;x++)if(G.grid[y][x]&PZ_MARK)n++;return 'Marked left: '+n;
    case 'dig':for(y=0;y<ROWS;y++)for(x=0;x<COLS;x++)if((G.grid[y][x]&15)===8)n++;return 'Junk left: '+n;
    case 'ts':return 'T-Spins: '+z.tsc+' / '+(d.c||1);
    case 'lines':return 'Lines: '+Math.min(G.lines,d.k)+' / '+d.k;
    case 'tetris':return 'Tetrises: '+z.tet+' / '+(d.c||1);
    case 'combo':return 'Combo: x'+Math.max(0,G.combo)+' / x'+d.k;
  }
  return '';
}
function drawGoalPanel(x,y,w,m,fs,th,ts){
  var bottom=L.by+VIS*L.c,h=bottom-y;
  if(h<m*3)return;
  panelBox(x,y,w,h);
  var z=G.pz,cy=y+m*.7,lh=m*.72;
  if(G.mode==='tutorial'){
    txtFit('LESSON',x+w/2,cy,fs*.85,th.acc,'center',w-6);cy+=m*.95;
    ctx.font='bold '+Math.round(m*.56)+'px '+FONT;
    var tl=wrapCached('les',z.l.d,w-m*.6);
    for(var i=0;i<tl.length&&cy<bottom-m;i++){txt(tl[i],x+w/2,cy,m*.56,'#dfe6ff','center');cy+=lh;}
    cy+=m*.3;
    var tch=touchMode()!=='off';
    if(cy<bottom-m*1.6){txtFit(tch?'Stuck? Tap SHOW':'Stuck? '+keyName(bindsFor('undo')[0])+' = Show me',x+w/2,cy,m*.55,'#ffd96b','center',w-6);cy+=lh;}
    if(cy<bottom-m*.8)txtFit(tch?'Pause = restart step':keyName(bindsFor('retry')[0])+' = Restart step',x+w/2,cy,m*.55,'#9fb0e0','center',w-6);
    return;
  }
  var d=z.d;
  txtFit('GOAL',x+w/2,cy,fs*.85,th.acc,'center',w-6);cy+=m*.95;
  ctx.font='bold '+Math.round(m*.6)+'px '+FONT;
  var gl=wrapCached('goal',pzGoal(d),w-m*.6);
  for(var j=0;j<gl.length&&cy<bottom-m*2;j++){txt(gl[j],x+w/2,cy,m*.6,'#fff','center');cy+=lh*1.05;}
  cy+=m*.25;
  if(cy<bottom-m*1.5){txtFit(pzProgress(),x+w/2,cy,m*.66,'#7fffb0','center',w-6);cy+=m*1.05;}
  if(cy<bottom-m*1.2){txtFit('\u2605\u2605\u2605 \u2264'+d.p[0]+'   \u2605\u2605 \u2264'+d.p[1],x+w/2,cy,m*.6,'#ffd23a','center',w-6);cy+=m*.95;}
  if(cy<bottom-m*.9)txtFit(z.hinted?'Hint used: max 2 \u2605':(touchMode()!=='off'?'Pause for a hint':keyName(bindsFor('hint')[0])+' = hint  '+keyName(bindsFor('undo')[0])+' = undo'),x+w/2,cy,m*.52,z.hinted?'#ff9a9a':'#9fb0e0','center',w-6);
}
var dashT=[0,0],dashH=[0,0],dashC=0;
function drawPzMarks(bx,by,c,ts){ // tutorial outlines and puzzle hints
  var z=G.pz,i,a=.55+.45*Math.sin(ts/160);
  if(dashC!==c){dashC=c;dashT[0]=Math.max(3,c*.22);dashT[1]=Math.max(2,c*.14);dashH[0]=Math.max(3,c*.2);dashH[1]=Math.max(2,c*.12);}
  ctx.save();
  ctx.lineWidth=Math.max(2,c*.1);
  if(z.tgt&&z.tgt.length&&(G.state==='play'||G.state==='pzwait')){
    ctx.setLineDash(dashT);ctx.lineDashOffset=-ts/40;
    ctx.strokeStyle='rgba(255,255,255,'+(.55+.45*a)+')';ctx.fillStyle='rgba(255,217,107,'+(.22+.22*a)+')';
    for(i=0;i<z.tgt.length;i+=2){var tx=z.tgt[i],ty=z.tgt[i+1];if(ty<HID||G.grid[ty][tx])continue;ctx.fillRect(bx+tx*c+2,by+(ty-HID)*c+2,c-4,c-4);ctx.strokeRect(bx+tx*c+3,by+(ty-HID)*c+3,c-6,c-6);}
  }
  if(z.hint&&z.d&&z.d.s&&z.on>=0&&z.d.s[z.on]&&G.state==='play'){
    pzStepCells(z.d.s[z.on],hintCells);
    ctx.setLineDash(dashH);ctx.lineDashOffset=ts/40;
    ctx.strokeStyle='rgba(255,255,255,'+(.6+.4*a)+')';ctx.fillStyle='rgba(255,217,107,'+(.25+.25*a)+')';
    if(S.set.fx===2){ctx.shadowColor='#ffd96b';ctx.shadowBlur=c*.6;}
    for(i=0;i<8;i+=2){var hx=hintCells[i],hy=hintCells[i+1];if(hy<HID)continue;ctx.fillRect(bx+hx*c+2,by+(hy-HID)*c+2,c-4,c-4);ctx.strokeRect(bx+hx*c+3,by+(hy-HID)*c+3,c-6,c-6);}
  }
  ctx.restore();
}
function drawCell(x,y,id,pw,alpha,ts){
  var c=L.c,px=L.bx+x*c+cellOX,py=L.by+(y-HID)*c;
  if(alpha<1)ctx.globalAlpha=alpha;
  ctx.drawImage(spr(curTh,id,c),px,py);
  if(pw){if(alpha<1)ctx.globalAlpha=Math.max(alpha,.55);drawPower(ctx,pw,px,py,c,ts);}
  if(alpha<1)ctx.globalAlpha=1;
}
function pzMarkCell(px,py,c){ // 'Clear every starting block' puzzles: a small diamond marks the blocks that must go
  var cx=px+c/2,cy=py+c/2,r=c*.17;
  ctx.fillStyle='rgba(0,0,0,.45)';ctx.beginPath();ctx.moveTo(cx,cy-r-1.5);ctx.lineTo(cx+r+1.5,cy);ctx.lineTo(cx,cy+r+1.5);ctx.lineTo(cx-r-1.5,cy);ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.92)';ctx.beginPath();ctx.moveTo(cx,cy-r);ctx.lineTo(cx+r,cy);ctx.lineTo(cx,cy+r);ctx.lineTo(cx-r,cy);ctx.closePath();ctx.fill();
}
function drawIce(bx,by,c,ts){
  for(var x=0;x<COLS;x++){
    var ib=G.ice[x];if(!ib)continue;
    var px=bx+x*c,h=(ib-HID)*c;
    if(h<=0)continue;
    ctx.fillStyle='rgba(150,220,255,.50)';ctx.fillRect(px+1,by,c-2,h-c*.3);
    ctx.beginPath();ctx.moveTo(px+1,by+h-c*.3);ctx.lineTo(px+c/2,by+h);ctx.lineTo(px+c-1,by+h-c*.3);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(255,255,255,'+(.45+.15*Math.sin(ts/300+x))+')';ctx.fillRect(px+c*.18,by,Math.max(1,c*.12),h-c*.45);
    ctx.fillRect(px+c*.6,by+c*.3,Math.max(1,c*.07),h*.5);
    ctx.strokeStyle='rgba(220,250,255,.9)';ctx.lineWidth=1;ctx.strokeRect(px+1.5,by+.5,c-3,h-c*.3);
    txtOut(String(G.iceT[x]),px+c/2,by+c*.55,c*.55,'#e8fbff','center',c);
  }
}
function drawBoard(th,ts){
  var c=L.c,bx=L.bx,by=L.by,bw=COLS*c,bh=VIS*c,x,y,i;
  ctx.fillStyle=th.board;ctx.fillRect(bx,by,bw,bh);
  if(S.set.grid){
    ctx.strokeStyle=th.grid;ctx.lineWidth=1;ctx.beginPath();
    for(x=1;x<COLS;x++){ctx.moveTo(bx+x*c+.5,by);ctx.lineTo(bx+x*c+.5,by+bh);}
    for(y=1;y<VIS;y++){ctx.moveTo(bx,by+y*c+.5);ctx.lineTo(bx+bw,by+y*c+.5);}
    ctx.stroke();
  }
  var cu=G.curse;
  if(G.state==='paused'){
    txtOut('PAUSED',bx+bw/2,by+bh/2,c*1.6,'#fff','center',bw*.9);
  }else{
    ctx.save();ctx.beginPath();ctx.rect(bx,by-c*1.2,bw,bh+c*1.2);ctx.clip();
    var clr=G.clear,p=clr?clr.t/clr.dur:0;
    var phantom=(cu&&cu.b.id==='phantom'),sal=phantom?lerp(.07,1,Math.min(1,G.vis*1.6)):1,mk=!!(G.pz&&G.pz.mk);
    cellOX=(cu&&cu.slide>0)?-cu.sdir*c*cu.slide*cu.slide:0; // Conveyor: the stack glides into its new place
    for(y=HID;y<ROWS;y++)for(x=0;x<COLS;x++){
      var v=G.grid[y][x];if(!v)continue;
      if(clr&&clr.kill[y*COLS+x]){
        if(S.set.fx===0)continue;
        var px=bx+x*c,py=by+(y-HID)*c;
        if(p<.5){drawCell(x,y,v&15,(v>>4)&7,1,ts);ctx.fillStyle='rgba(255,255,255,'+(p*2*.95)+')';ctx.fillRect(px,py,c,c);}
        else{var sc=1-(p-.5)*2;ctx.fillStyle='rgba(255,255,255,'+(.3+.7*sc)+')';var s2=c*sc;ctx.fillRect(px+(c-s2)/2,py+(c-s2)/2,s2,s2);}
      }else{drawCell(x,y,v&15,(v>>4)&7,sal,ts);if(mk&&(v&PZ_MARK))pzMarkCell(bx+x*c+cellOX,by+(y-HID)*c,c);}
    }
    cellOX=0;
    // line-clear sweep: a bright band shoots out from the middle of every cleared row
    if(clr&&clr.line&&S.set.fx>0){
      var e=Math.min(1,p*2.4),fa=Math.max(0,1-p*1.1),big=clr.n>=4,wv=bw*e;
      for(i=0;i<clr.rows.length;i++){
        var ry=clr.rows[i];if(ry<HID)continue;
        var ty=by+(ry-HID)*c;
        ctx.fillStyle=big?'rgba(255,226,120,'+(fa*.5)+')':'rgba(150,220,255,'+(fa*.42)+')';
        ctx.fillRect(bx+(bw-wv)/2,ty-c*.3*(1-p),wv,c+c*.6*(1-p));
        ctx.fillStyle='rgba(255,255,255,'+(fa*.95)+')';
        ctx.fillRect(bx+(bw-wv)/2,ty+c*.4,wv,Math.max(2,c*.2));
      }
    }
    // lock flash
    if(lockFx.t<150&&S.set.fx>0&&!clr&&!(cu&&cu.slide>0)){
      ctx.fillStyle='rgba(255,255,255,'+((1-lockFx.t/150)*.5)+')';
      for(i=0;i<4;i++)if(lockFx.y[i]>=HID)ctx.fillRect(bx+lockFx.x[i]*c,by+(lockFx.y[i]-HID)*c,c,c);
    }
    if(cu&&cu.b.id==='cryo')drawIce(bx,by,c,ts);
    // ghost + current piece
    var cur=G.cur;
    if(cur&&(G.state==='play'||G.state==='clear'||G.state==='resume'||G.state==='countdown')){
      var s=SHAPES[cur.t][cur.r];
      if(S.set.ghost&&G.state==='play'){
        var d=dropDist();
        if(d>0){
          var gc=th.cols[cur.t+1];
          for(i=0;i<4;i++){
            var gx=bx+(cur.x+s[i][0])*c,gy=by+(cur.y+d+s[i][1]-HID)*c;
            ctx.fillStyle=rgba(gc,.16);ctx.fillRect(gx+1,gy+1,c-2,c-2);
            ctx.strokeStyle=rgba(gc,.85);ctx.lineWidth=Math.max(1.5,c*.07);ctx.strokeRect(gx+c*.06+.5,gy+c*.06+.5,c-c*.12-1,c-c*.12-1);
          }
        }
      }
      if(G.pz)drawPzMarks(bx,by,c,ts); // tutorial outlines and hints sit above the ghost, below the piece
      var gr=!fits(cur.t,cur.r,cur.x,cur.y+1),la=gr?1-.38*Math.min(1,G.lockT/lockDelay()):1;
      for(i=0;i<4;i++){
        var yy=cur.y+s[i][1];
        drawCell(cur.x+s[i][0],yy,cur.t+1,i===cur.pi?cur.pt:0,la,ts);
      }
    }
    // frost overlay
    if(G.frost>0&&S.set.fx>0){
      ctx.fillStyle='rgba(150,225,255,'+(.10+.05*Math.sin(ts/200))+')';ctx.fillRect(bx,by,bw,bh);
      ctx.strokeStyle='rgba(200,240,255,.6)';ctx.lineWidth=Math.max(2,c*.12);ctx.strokeRect(bx+2,by+2,bw-4,bh-4);
    }
    // Floodgate: tint the rows that are about to rise
    if(cu&&cu.b.id==='flood'&&cu.inc>0&&S.set.fx>0){
      ctx.fillStyle='rgba(255,60,60,'+(.09+.06*Math.sin(ts/150))+')';ctx.fillRect(bx,by+bh-Math.min(bh,cu.inc*c),bw,Math.min(bh,cu.inc*c));
    }
    // Conveyor: chevrons warn one piece before the stack slides
    if(cu&&cu.b.id==='conveyor'&&curseInterval()-cu.cnt===1&&(G.state==='play'||G.state==='clear')){
      var ph=(ts/450)%1;
      ctx.save();ctx.globalAlpha=.55+.3*Math.sin(ts/120);
      for(i=0;i<4;i++)txtOut(cu.dir>0?'>>':'<<',bx+((i+ph*cu.dir+4)%4+.5)*bw/4,by+bh*.5,c*1.1,'#ffd27a','center',bw/4);
      ctx.restore();
    }
    // explosion rings + beams
    for(i=0;i<rings.length;i++){
      var r=rings[i],k=r.t/r.life,cc=cellCenter(r.x,r.y);
      var rad=(r.r+.8)*c*Math.sin(Math.min(1,k*1.4)*1.5708);
      var rg=ctx.createRadialGradient(cc.x,cc.y,rad*.1,cc.x,cc.y,rad);
      rg.addColorStop(0,'rgba(255,255,220,'+(.9*(1-k))+')');rg.addColorStop(.5,'rgba('+r.col+','+(.6*(1-k))+')');rg.addColorStop(1,'rgba('+r.col+',0)');
      ctx.fillStyle=rg;ctx.beginPath();ctx.arc(cc.x,cc.y,rad,0,6.2832);ctx.fill();
    }
    for(i=0;i<beams.length;i++){
      var bm=beams[i],kb=1-bm.t/bm.life,wd=(1+2*bm.w)*c;
      var gb=ctx.createLinearGradient(bx+(bm.x-bm.w)*c,0,bx+(bm.x+bm.w+1)*c,0);
      gb.addColorStop(0,'rgba(60,220,255,0)');gb.addColorStop(.5,'rgba(220,255,255,'+(.95*kb)+')');gb.addColorStop(1,'rgba(60,220,255,0)');
      ctx.fillStyle=gb;ctx.fillRect(bx+(bm.x-bm.w-.4)*c,by,wd+.8*c,bh);
    }
    ctx.restore();
  }
  // border
  ctx.save();
  var danger=G&&G.dangerT&&G.state==='play';
  ctx.strokeStyle=danger?'rgba(255,70,70,'+(.6+.4*Math.sin(ts/110))+')':rgba(th.acc,.75);
  ctx.lineWidth=Math.max(2,c*.1);
  if(S.set.fx===2){ctx.shadowColor=danger?'#ff3030':th.acc;ctx.shadowBlur=c*.6;}
  ctx.strokeRect(bx-ctx.lineWidth/2,by-ctx.lineWidth/2,bw+ctx.lineWidth,bh+ctx.lineWidth);
  ctx.restore();
  // floor progress bar (Surge Run)
  if(G.surge){
    var fw=Math.max(4,Math.round(c*.22)),fh=bh*Math.min(1,G.floorLines/G.target);
    ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(bx-fw-Math.max(3,c*.2),by,fw,bh);
    ctx.fillStyle=G.curse?'#ff5a5a':'#7ff0ff';ctx.fillRect(bx-fw-Math.max(3,c*.2),by+bh-fh,fw,fh);
  }
  // Floodgate meter: red = junk waiting to rise, pink = the next row filling up
  if(cu&&cu.b.id==='flood'){
    var mw=Math.max(4,Math.round(c*.22)),mx=bx+bw+Math.max(3,c*.2),ih=Math.min(bh,cu.inc*c),tp=Math.min(1,cu.ft/floodPeriod())*c;
    ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(mx,by,mw,bh);
    ctx.fillStyle='#ff4a4a';ctx.fillRect(mx,by+bh-ih,mw,ih);
    ctx.fillStyle='rgba(255,160,160,.75)';ctx.fillRect(mx,by+bh-ih-tp,mw,tp);
  }
}
function drawOverlays(th,ts){
  var c=L.c,bx=L.bx,by=L.by,bw=COLS*c,bh=VIS*c,i;
  // popups (newest on top, older ones stack below and fade)
  var n=pops.length,py=by+bh*.26;
  for(i=n-1;i>=0;i--){
    var p=pops[i],k=p.t/p.life;
    var a=k<.7?1:1-(k-.7)/.3,sc=1+.45*Math.max(0,1-p.t/160);
    var ph=c*(1.05*p.size)+(p.sub?c*.75:0);
    var yy=py+c*.55*p.size;
    ctx.save();ctx.globalAlpha=Math.max(0,a);ctx.translate(bx+bw/2,yy);ctx.scale(sc,sc);
    txtOut(p.text,0,0,c*.95*p.size,p.color,'center',bw*.96/sc);
    if(p.sub)txtOut(p.sub,0,c*.8*p.size,c*.55*Math.max(.85,p.size*.8),'#fff','center',bw*.96/sc);
    ctx.restore();
    py+=ph+c*.1;
  }
  // hint
  if(G.hint&&G.state==='play'){
    ctx.font='bold '+Math.round(c*.62)+'px '+FONT;
    var lines=wrapText(G.hint.text,bw*.88),lh=c*.8,hh=lines.length*lh+c*.5,hy=by+bh-hh-c*.3;
    ctx.globalAlpha=Math.min(1,G.hint.t/400);
    ctx.fillStyle='rgba(8,10,34,.88)';rr(ctx,bx+bw*.04,hy,bw*.92,hh,c*.3);ctx.fill();
    ctx.strokeStyle=rgba(th.acc,.8);ctx.lineWidth=1;ctx.stroke();
    for(i=0;i<lines.length;i++)txt(lines[i],bx+bw/2,hy+c*.25+lh*(i+.5),c*.62,'#fff','center');
    ctx.globalAlpha=1;
  }
  // countdown
  if(G.state==='countdown'||G.state==='resume'){
    var dg=G.lastDigit,label=dg>0&&dg<4?String(dg):(dg===0?'GO!':'');
    if(label){
      var tt=(G.state==='resume')?(G.cd%500)/500:(G.cd%700)/700;
      ctx.save();ctx.globalAlpha=.4+.6*tt;txtOut(label,bx+bw/2,by+bh*.45,c*(2.8+(1-tt)*1.2),'#fff','center',bw);ctx.restore();
    }
  }
  // banner
  if(G.banner&&G.state==='banner'){
    var b=G.banner,k2=b.t/b.dur,a2=k2<.12?k2/.12:(k2>.85?(1-k2)/.15:1);
    var bandH=c*(b.sub2?4.6:3.6),yy2=by+bh*.4-bandH/2,u=c*3.6;
    ctx.save();ctx.globalAlpha=clamp(a2,0,1);
    var gb=ctx.createLinearGradient(bx,0,bx+bw,0);
    var base=b.boss?'160,20,40':'30,40,120';
    gb.addColorStop(0,'rgba('+base+',0)');gb.addColorStop(.2,'rgba('+base+',.92)');gb.addColorStop(.8,'rgba('+base+',.92)');gb.addColorStop(1,'rgba('+base+',0)');
    ctx.fillStyle=gb;ctx.fillRect(bx-c,yy2,bw+2*c,bandH);
    var tsc=1+.25*Math.max(0,1-b.t/220);
    txtOut(b.title,bx+bw/2,yy2+u*.38,c*1.35*tsc,b.boss?'#ffb0b0':'#fff','center',bw*.95);
    txtOut(b.sub,bx+bw/2,yy2+u*.76,c*.68,'#ffe9a8','center',bw*.95);
    if(b.sub2)txtOut(b.sub2,bx+bw/2,yy2+u*1.05,c*.56,b.boss?'#9fe8ff':'#9fe8ff','center',bw*.95);
    ctx.restore();
  }
  // tutorial coach
  if(G.pz&&G.mode==='tutorial'&&G.pz.coach&&(G.state==='play'||G.state==='pzwait')){
    ctx.font='bold '+Math.round(c*.6)+'px '+FONT;
    var cl=wrapCached('coach',G.pz.coach,bw*.86),clh=c*.78,ch2=cl.length*clh+c*.6,cyy=by+bh*.56-ch2/2;
    ctx.fillStyle='rgba(8,10,34,.86)';rr(ctx,bx+bw*.04,cyy,bw*.92,ch2,c*.3);ctx.fill();
    ctx.strokeStyle='rgba(255,217,107,.85)';ctx.lineWidth=Math.max(1.5,c*.07);ctx.stroke();
    for(i=0;i<cl.length;i++)txt(cl[i],bx+bw/2,cyy+c*.3+clh*(i+.5),c*.6,'#fff','center');
  }
  if(G.state==='over'){
    ctx.fillStyle='rgba(0,0,10,'+Math.min(.6,G.overT/1000*.6)+')';ctx.fillRect(bx,by,bw,bh);
    var lab=G.over==='win'?'FINISH!':(G.over==='time'?"TIME!":(G.over==='quit'?'':(G.over==='solved'?'SOLVED!':(G.over==='out'?'OUT OF PIECES':(G.over==='lesson'?'LESSON DONE!':'GAME OVER')))));
    if(lab)txtOut(lab,bx+bw/2,by+bh*.45,c*1.7,'#fff','center',bw*.95);
  }
}
function drawParts(){
  for(var i=0;i<parts.length;i++){
    var p=parts[i],a=Math.min(1,p.l/(p.m*.5));
    ctx.globalAlpha=a;ctx.fillStyle=p.c;
    ctx.fillRect(Math.round(p.x-p.s/2),Math.round(p.y-p.s/2),Math.ceil(p.s),Math.ceil(p.s));
  }
  ctx.globalAlpha=1;
}
function draw(ts,dt){
  curTh=theme();curStyle=skinStyle(curTh);
  drawBg(curTh,ts,dt);
  if(!G)return;
  ctx.save();
  if(shakeAmt>0){var sa=shakeAmt*L.c*.28;ctx.translate(Math.round((Math.random()-.5)*2*sa),Math.round((Math.random()-.5)*2*sa));}
  drawPanels(curTh,ts);
  // the board (and its particles) gets the springy kick and The Upside's gravity flip
  var fl=boardFlipScale(),kx=Math.round(kickY);
  if(fl!==1||kx){
    ctx.save();ctx.translate(0,kx);
    if(fl!==1){var fcy=L.by+VIS*L.c/2;ctx.translate(0,fcy);ctx.scale(1,fl);ctx.translate(0,-fcy);}
  }
  drawBoard(curTh,ts);
  drawParts();
  if(fl!==1||kx)ctx.restore();
  drawOverlays(curTh,ts);
  ctx.restore();
  if(flashA>0&&S.set.fx===2){ctx.fillStyle='rgba('+flashC+','+Math.min(.7,flashA)+')';ctx.fillRect(0,0,L.W,L.H);}
  if(G.dangerT&&G.state==='play'&&S.set.fx>0){
    var rg=ctx.createRadialGradient(L.W/2,L.H/2,Math.min(L.W,L.H)*.35,L.W/2,L.H/2,Math.max(L.W,L.H)*.75);
    rg.addColorStop(0,'rgba(255,0,0,0)');rg.addColorStop(1,'rgba(255,0,0,'+(.12+.08*Math.sin(ts/120))+')');
    ctx.fillStyle=rg;ctx.fillRect(0,0,L.W,L.H);
  }
}

