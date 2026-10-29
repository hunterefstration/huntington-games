
(function(){
'use strict';
/* =====================================================================
   TETRIS SURGE - single file falling-block game
   Sections: utils/storage, data, audio, themes+sprites, game logic,
   rendering, input, UI screens, main loop.
   ===================================================================== */

// ---------- utils ----------
var $=function(id){return document.getElementById(id);};
function clamp(v,a,b){return v<a?a:(v>b?b:v);}
function lerp(a,b,t){return a+(b-a)*t;}
function pad2(n){return (n<10?'0':'')+n;}
function fmtTime(ms){ms=Math.max(0,ms);var m=Math.floor(ms/60000),s=Math.floor(ms/1000)%60,c=Math.floor(ms/10)%100;return m+':'+pad2(s)+'.'+pad2(c);}
function fmtSec(ms){ms=Math.max(0,ms);var m=Math.floor(ms/60000),s=Math.floor(ms/1000)%60;return m+':'+pad2(s);}
function fmtNum(n){return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,',');}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function shuffle(arr,rnd){for(var i=arr.length-1;i>0;i--){var j=Math.floor(rnd()*(i+1));var t=arr[i];arr[i]=arr[j];arr[j]=t;}return arr;}
function today(){var d=new Date();return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();}
function hexRGB(h){h=h.replace('#','');if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];return [parseInt(h.substr(0,2),16),parseInt(h.substr(2,2),16),parseInt(h.substr(4,2),16)];}
function rgba(h,a){var c=hexRGB(h);return 'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')';}
function shade(h,amt){var c=hexRGB(h);function f(v){return clamp(Math.round(amt>=0?v+(255-v)*amt:v*(1+amt)),0,255);}return 'rgb('+f(c[0])+','+f(c[1])+','+f(c[2])+')';}
function cleanName(s){return String(s||'').replace(/[^\x20-\x7e]/g,'').replace(/[<>&"']/g,'').slice(0,10).trim()||'PLAYER';}

// ---------- storage (always try/catch; sandboxed iframes throw) ----------
var KEY='huntingtonTetrisSurge1', mem={};
function lsGet(k){try{return window.localStorage.getItem(k);}catch(e){return Object.prototype.hasOwnProperty.call(mem,k)?mem[k]:null;}}
function lsSet(k,v){try{window.localStorage.setItem(k,v);}catch(e){mem[k]=v;}}
function defaults(){return {v:2,
  set:{sfx:70,music:30,hap:true,theme:'classic',skin:'auto',bg:'auto',ghost:true,grid:true,shake:true,fx:2,das:130,arr:25,sdf:2,touch:'auto',name:'PLAYER'},
  binds:{},best:{},ach:{},seen:{},last:{lv:1},
  rank:{},kills:{},pseen:{},
  puz:{},tut:{},
  daily:{h:{},streak:0,bestStreak:0,lastDay:0,plays:0,days:0},
  stats:{games:0,lines:0,pieces:0,tspins:0,tetrises:0,pcs:0,time:0,maxCombo:0,bosses:0,bestFloor:0,powers:0,bombs:0,lasers:0,frosts:0,quakes:0,golds:0,surges:0,holds:0,score:0,b2bMax:0}};}
var S=defaults();
function num(v,def){v=+v;return isFinite(v)?v:def;}
function cleanRank(o){
  var out={};
  if(!o||typeof o!=='object')return out;
  for(var m in o){
    var r=o[m];if(!r||typeof r!=='object')continue;
    out[m]={r:Math.max(0,num(r.r,0)),n:Math.max(0,num(r.n,0)),pk:Math.max(0,num(r.pk,0)),
      h:Array.isArray(r.h)?r.h.filter(function(v){return isFinite(+v);}).slice(-30):[],
      pl:Array.isArray(r.pl)?r.pl.filter(function(v){return isFinite(+v);}).slice(0,3):[]};
  }
  return out;
}
function cleanPuz(o){ // puzzle progress: id -> {s: best stars, p: fewest pieces, n: attempts}
  var out={};
  if(!o||typeof o!=='object')return out;
  for(var id in o){var e=o[id];if(!e||typeof e!=='object')continue;out[id]={s:clamp(Math.round(num(e.s,0)),0,3),p:Math.max(0,num(e.p,0)),n:Math.max(0,num(e.n,0))};}
  return out;
}
function loadSave(){
  var raw=lsGet(KEY),d=defaults();
  if(raw){try{var o=JSON.parse(raw);
    ['set','stats','last','daily'].forEach(function(k){if(o[k]&&typeof o[k]==='object'){for(var i in o[k]){if(Object.prototype.hasOwnProperty.call(d[k],i))d[k][i]=o[k][i];}}});
    ['binds','best','ach','seen','kills','pseen','tut'].forEach(function(k){if(o[k]&&typeof o[k]==='object')d[k]=o[k];});
    d.rank=cleanRank(o.rank);
    d.puz=cleanPuz(o.puz);
    if(!d.daily.h||typeof d.daily.h!=='object')d.daily.h={};
    // v1 -> v2: old Daily Run top scores become the start of the daily history
    if(!(o.v>=2)&&d.best.daily&&d.best.daily.length){
      d.best.daily.forEach(function(e){
        if(!e||!e.d)return;
        var h=d.daily.h[e.d];
        if(!h)d.daily.h[e.d]={k:'surge',s:e.s||0,l:e.l||0,t:e.t||0,f:e.f||1,w:0,n:1};
        else{h.n++;if((e.s||0)>h.s){h.s=e.s;h.l=e.l||0;h.t=e.t||0;h.f=e.f||1;}}
      });
      var ks=Object.keys(d.daily.h).map(Number).sort();
      if(ks.length){d.daily.lastDay=ks[ks.length-1];d.daily.days=ks.length;d.daily.plays=ks.length;d.daily.streak=1;d.daily.bestStreak=1;}
    }
  }catch(e){}}
  else{ // migrate the old single high score
    var old=parseInt(lsGet('tetrisHighScore'),10);
    if(old>0){d.best.marathon=[{s:old,l:0,lv:1,d:today(),n:'PLAYER'}];}
  }
  d.set.name=cleanName(d.set.name);
  S=d;
}
function save(){lsSet(KEY,JSON.stringify(S));}
loadSave();

// ---------- data ----------
var COLS=10,ROWS=24,HID=4,VIS=20;
var TYPES='IJLOSTZ';
var BASE={I:[[0,1],[1,1],[2,1],[3,1]],J:[[0,0],[0,1],[1,1],[2,1]],L:[[2,0],[0,1],[1,1],[2,1]],O:[[1,0],[2,0],[1,1],[2,1]],S:[[1,0],[2,0],[0,1],[1,1]],Z:[[0,0],[1,0],[1,1],[2,1]],T:[[1,0],[0,1],[1,1],[2,1]]};
var SHAPES=[];
(function(){
  for(var t=0;t<7;t++){
    var ch=TYPES[t],n=(ch==='I'||ch==='O')?4:3,st=[BASE[ch].map(function(p){return [p[0],p[1]];})];
    for(var r=1;r<4;r++){
      var prev=st[r-1];
      if(ch==='O'){st.push(prev);continue;}
      st.push(prev.map(function(p){return [n-1-p[1],p[0]];}));
    }
    SHAPES.push(st);
  }
})();
var KICK_JLSTZ={'01':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],'10':[[0,0],[1,0],[1,-1],[0,2],[1,2]],'12':[[0,0],[1,0],[1,-1],[0,2],[1,2]],'21':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],'23':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],'32':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],'30':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],'03':[[0,0],[1,0],[1,1],[0,-2],[1,-2]]};
var KICK_I={'01':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],'10':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],'12':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]],'21':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],'23':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],'32':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],'30':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],'03':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]]};
var SDF=[5,10,20,40,0];
var SDF_NAME=['5x','10x','20x','40x','Instant'];
var ULTRA_MS=120000, SPRINT_LINES=40;

var MODES={
  surge:{name:'Surge Run',tag:'Rogue-lite! Power blocks, perks, bosses. Climb the tower.',sort:'score'},
  daily:{name:'Daily Surge',tag:'Surge Run with a seed shared by everyone today.',sort:'score'},
  marathon:{name:'Marathon',tag:'Endless levels. How far can you go?',sort:'score'},
  sprint:{name:'Sprint',tag:'Clear 40 lines. Fastest time wins.',sort:'time'},
  ultra:{name:'Ultra',tag:'Score as much as you can in 2 minutes.',sort:'score'},
  zen:{name:'Zen',tag:'No game over. Stack, relax, repeat.',sort:'score'},
  puzzle:{name:'Puzzles',tag:'Handcrafted boards. Solve them in as few pieces as you can.',sort:'score'},
  tutorial:{name:'Tutorial',tag:'Learn Hold and T-Spins step by step.',sort:'score'}
};
var MODE_ORDER=['surge','daily','marathon','sprint','ultra','zen'];

var POWERS={1:{n:'Bomb',d:'Clear its line and it explodes, wiping a big round area.'},
  2:{n:'Laser',d:'Clear its line and a beam wipes its entire column.'},
  3:{n:'Frost',d:'Clear its line to freeze gravity for a few seconds.'},
  4:{n:'Quake',d:'Clear its line and every block falls to fill gaps. Free chains!'},
  5:{n:'Gold',d:'Clear its line for a big pile of bonus points.'}};

var BOSSES=[
  {id:'rumble',name:'THE RUMBLER',desc:'Junk rows rise every few pieces!'},
  {id:'hourglass',name:'THE HOURGLASS',desc:'Gravity runs twice as fast!'},
  {id:'phantom',name:'THE PHANTOM',desc:'Your stack fades out of sight!'},
  {id:'mirror',name:'THE MIRROR',desc:'Left and right swap at random!'},
  {id:'hail',name:'THE HAILSTORM',desc:'Stray blocks rain from above!'},
  {id:'blind',name:'THE BLINDFOLD',desc:'Your Next queue is hidden! It only peeks every few pieces.'},
  {id:'upside',name:'THE UPSIDE',desc:'Gravity flips! The board turns upside-down.'},
  {id:'flood',name:'THE FLOODGATE',desc:'Junk floods in on a timer. Clear lines to block it!'},
  {id:'conveyor',name:'THE CONVEYOR',desc:'Your whole stack slides sideways every few pieces!'},
  {id:'cryo',name:'THE CRYOMANCER',desc:'Ice pillars freeze columns shut. Slide pieces under them!'}];
var BOSS_BY={};BOSSES.forEach(function(b){BOSS_BY[b.id]=b;});
var BOSS_ACH={blind:'b_blind',upside:'b_upside',flood:'b_flood',conveyor:'b_conv',cryo:'b_cryo'};

// perks: id, name, desc, rarity, max, short code
var PERKS=[
  {id:'slow',n:'Slow Fall',d:'Gravity is 12% slower.',r:'common',max:4,c:'SF'},
  {id:'charged',n:'Charged Bricks',d:'Power blocks show up more often.',r:'common',max:4,c:'CB'},
  {id:'greed',n:'Greed',d:'All points +20%.',r:'common',max:5,c:'GR'},
  {id:'battery',n:'Surge Battery',d:'The Surge meter charges 35% faster.',r:'common',max:3,c:'SB'},
  {id:'sweeper',n:'Floor Sweeper',d:'Bottom 2 rows vanish at the start of every floor.',r:'common',max:3,c:'FS'},
  {id:'sticky',n:'Sticky Floor',d:'Longer lock delay and more move resets.',r:'common',max:2,c:'ST'},
  {id:'bigbomb',n:'Mega Bombs',d:'Bomb blasts are bigger.',r:'uncommon',max:2,c:'MB'},
  {id:'widelaser',n:'Wide Laser',d:'Lasers also hit the neighbouring columns.',r:'uncommon',max:2,c:'WL'},
  {id:'deepfreeze',n:'Deep Freeze',d:'Frost lasts 4 seconds longer.',r:'uncommon',max:3,c:'DF'},
  {id:'combofuel',n:'Combo Fuel',d:'Combos score double and charge Surge.',r:'uncommon',max:2,c:'CF'},
  {id:'spinner',n:'Spin Doctor',d:'T-Spins score 50% more and charge Surge.',r:'uncommon',max:3,c:'SD'},
  {id:'ilove',n:'Long Bag',d:'An extra I piece in every bag.',r:'uncommon',max:2,c:'IP'},
  {id:'phoenix',n:'Phoenix Feather',d:'Survive a top-out once: the top of the board is wiped.',r:'rare',max:3,c:'PH'},
  {id:'pocket',n:'Pocket Dimension',d:'A second Hold slot.',r:'rare',max:1,c:'PD'},
  {id:'overcharge',n:'Overcharge',d:'Shockwave clears 2 more rows. Each floor starts with 40% Surge.',r:'rare',max:3,c:'OC'},
  {id:'midas',n:'Midas Touch',d:'Gold blocks are common and worth triple.',r:'rare',max:2,c:'MT'},
  {id:'hardhit',n:'Heavy Hands',d:'Hard drops score double and each one adds 1% Surge.',r:'common',max:3,c:'HH'},
  {id:'steady',n:'Short Floors',d:'Normal floors need 1 fewer line to clear.',r:'common',max:3,c:'SH'},
  {id:'conductor',n:'Conductor',d:'Every power block you set off adds 6% Surge.',r:'common',max:3,c:'CO'},
  {id:'lucky',n:'Lucky Draw',d:'+1 free reroll on every perk draft.',r:'common',max:2,c:'LD'},
  {id:'quad',n:'Quad Power',d:'Tetrises score +50% and add 15% Surge.',r:'uncommon',max:3,c:'QP'},
  {id:'keeper',n:'Combo Keeper',d:'Your combo survives one piece that clears nothing.',r:'uncommon',max:2,c:'CK'},
  {id:'tparty',n:'T-Party',d:'An extra T piece in every bag.',r:'uncommon',max:2,c:'TP'},
  {id:'junkbreak',n:'Junk Breaker',d:'Clearing a grey junk row pays bonus points and 8% Surge. Junk rows get an extra hole.',r:'uncommon',max:2,c:'JB'},
  {id:'hunter',n:'Boss Hunter',d:'Boss floors need 2 fewer lines and pay +50% bonus.',r:'uncommon',max:2,c:'BH'},
  {id:'secondwind',n:'Second Wind',d:'When your stack nears the top, gravity slows to a crawl.',r:'uncommon',max:2,c:'2W'},
  {id:'aftershock',n:'Aftershock',d:'Shockwaves score double and freeze gravity for 3 seconds.',r:'rare',max:2,c:'AS'},
  {id:'wide',n:'Wide Choice',d:'Perk drafts offer 4 cards instead of 3.',r:'rare',max:1,c:'4C'},
  {id:'ward',n:'Boss Ward',d:'Blocks the first 2 boss attacks (junk, hail, floods, shifts, ice) on every boss floor.',r:'rare',max:2,c:'BW'},
  {id:'nova',n:'Nova Clear',d:'Perfect Clears score triple and fully charge Surge.',r:'rare',max:1,c:'NC'}
];
var PERK_BY={};PERKS.forEach(function(p){PERK_BY[p.id]=p;});

// achievements: id, name, description, category, optional progress fn -> [current,goal]
function cntKeys(o){var n=0;for(var k in o)if(Object.prototype.hasOwnProperty.call(o,k))n++;return n;}
function bossKinds(){var n=0;BOSSES.forEach(function(b){if(S.kills[b.id])n++;});return n;}
function rankedModes(){var n=0;for(var m in RANKED)if(S.rank[m]&&S.rank[m].n>=PLACE)n++;return n;}
var ACH=[
  ['first','First Blood','Clear your first line','basic'],
  ['tetris','Four Play','Clear 4 lines at once','basic'],
  ['tspin','Spin Doctor','Perform a T-Spin','basic'],
  ['pc','Spotless','Perform a Perfect Clear','basic'],
  ['games25','Regular','Play 25 games','basic',function(){return [S.stats.games,25];}],
  ['games100','Dedicated','Play 100 games','basic',function(){return [S.stats.games,100];}],
  ['lines1000','Line Legend','Clear 1000 lines in total','basic',function(){return [S.stats.lines,1000];}],
  ['lines5000','Line Lord','Clear 5000 lines in total','basic',function(){return [S.stats.lines,5000];}],
  ['tspin2','Spin Master','Clear 2 or more lines with a T-Spin','skill'],
  ['combo5','Combo Cook','Reach a 5x combo','skill',function(){return [S.stats.maxCombo,5];}],
  ['combo10','Combo King','Reach a 10x combo','skill',function(){return [S.stats.maxCombo,10];}],
  ['b2b','Back to Back','Make two difficult clears in a row','skill'],
  ['b2b5','Chain Gang','Reach a Back-to-Back streak of 5','skill',function(){return [S.stats.b2bMax,5];}],
  ['tetris10','Quad Squad','Clear 10 Tetrises in one game','skill'],
  ['pps2','Fast Fingers','Average 2 pieces per second in a game of 100+ pieces','skill'],
  ['sprint2','Speed Demon','Finish Sprint in under 2:00','modes'],
  ['sprint1','Lightning','Finish Sprint in under 1:00','modes'],
  ['ultra','Point Blaster','Score 20,000 in Ultra','modes'],
  ['ultra50','Point Storm','Score 50,000 in Ultra','modes'],
  ['lvl10','Hot Streak','Reach level 10 in Marathon','modes'],
  ['lvl20','Speed of Light','Reach level 20 in Marathon','modes'],
  ['bomb','Demolition','Destroy 25+ blocks with one power-block blast','surge'],
  ['laser','Beam Me Up','Trigger a Laser block','surge'],
  ['surge','Overload','Fire a Surge Shockwave','surge'],
  ['floor5','Climber','Reach Floor 5 in a Surge Run','surge',function(){return [S.stats.bestFloor,5];}],
  ['floor10','Skyscraper','Reach Floor 10 in a Surge Run','surge',function(){return [S.stats.bestFloor,10];}],
  ['floor15','Cloud Walker','Reach Floor 15 in a Surge Run','surge',function(){return [S.stats.bestFloor,15];}],
  ['perks','Collector','Hold 8 perk levels in one run','surge'],
  ['perkdex','Perk Scholar','Pick 20 different perks across all your runs','surge',function(){return [cntKeys(S.pseen),20];}],
  ['boss','Giant Slayer','Defeat a boss','boss'],
  ['bosses10','Boss Hunter','Defeat 10 bosses in total','boss',function(){return [S.stats.bosses,10];}],
  ['bestiary','Bestiary','Defeat every one of the 10 bosses','boss',function(){return [bossKinds(),BOSSES.length];}],
  ['b_blind','Eyes Open','Defeat The Blindfold','boss'],
  ['b_upside','Right Side Up','Defeat The Upside','boss'],
  ['b_flood','Flood Control','Defeat The Floodgate','boss'],
  ['b_conv','Off the Belt','Defeat The Conveyor','boss'],
  ['b_cryo','Ice Breaker','Defeat The Cryomancer','boss'],
  ['rk_silver','Moving Up','Reach Silver in any ranked mode','rank'],
  ['rk_gold','Golden','Reach Gold in any ranked mode','rank'],
  ['rk_plat','Platinum Player','Reach Platinum in any ranked mode','rank'],
  ['rk_dia','Diamond Hands','Reach Diamond in any ranked mode','rank'],
  ['rk_master','Master Stacker','Reach Master in any ranked mode','rank'],
  ['rk_gm','Grandmaster','Reach Grandmaster in any ranked mode','rank'],
  ['rk_all','Well Rounded','Get ranked in all 4 ranked modes','rank',function(){return [rankedModes(),4];}],
  ['daily1','Daily Habit','Play a Daily Challenge','daily'],
  ['daily3','Three-peat','Play the Daily 3 days in a row','daily',function(){return [S.daily.bestStreak||0,3];}],
  ['daily7','Week Warrior','Play the Daily 7 days in a row','daily',function(){return [S.daily.bestStreak||0,7];}],
  ['daily10','Challenger','Play the Daily on 10 different days','daily',function(){return [S.daily.days||0,10];}],
  ['tut','Good Student','Finish both tutorial lessons','puzzle',function(){return [tutDone(),LESSONS.length];}],
  ['pz1','Puzzled','Solve your first puzzle','puzzle'],
  ['pz10','Problem Solver','Solve 10 puzzles','puzzle',function(){return [pzSolvedCount(),10];}],
  ['pz3s','Perfectionist','Get 3 stars on 10 puzzles','puzzle',function(){return [pz3Count(),10];}],
  ['pzpack','Pack Leader','Solve every puzzle in one pack','puzzle',function(){return [pzBestPack(),10];}],
  ['pzstars','Star Collector','Earn 120 puzzle stars','puzzle',function(){return [pzStars(),120];}],
  ['pzall','Puzzle Master','Solve every puzzle','puzzle',function(){return [pzSolvedCount(),PZ_ALL.length];}]
];
var ACH_CATS=[['basic','Basics'],['skill','Skill'],['modes','Modes'],['surge','Surge Run'],['boss','Bosses'],['rank','Ranks'],['daily','Daily Challenge'],['puzzle','Puzzles & Tutorial']];
var ACH_BY={};ACH.forEach(function(a){ACH_BY[a[0]]=a;});

// ---------- rank ladder ----------
var TIERS=[
  {id:'bronze',n:'Bronze',min:0,c:'#e0925a',c2:'#7a3f17',div:true},
  {id:'silver',n:'Silver',min:600,c:'#d4ddeb',c2:'#5d6b82',div:true},
  {id:'gold',n:'Gold',min:1000,c:'#ffd23a',c2:'#a86f00',div:true},
  {id:'plat',n:'Platinum',min:1400,c:'#5fe3d0',c2:'#16707a',div:true},
  {id:'diamond',n:'Diamond',min:1800,c:'#8cc4ff',c2:'#2a4fc0',div:true},
  {id:'master',n:'Master',min:2200,c:'#d68bff',c2:'#5e1a9c',div:false},
  {id:'gm',n:'Grandmaster',min:2600,c:'#ff6464',c2:'#7a0b25',div:false}];
var RANK_ACH=['','rk_silver','rk_gold','rk_plat','rk_dia','rk_master','rk_gm'];
var PLACE=3;
// performance tables: result -> performance rating (sprint uses seconds, surge uses floor reached)
var RANKED={
  sprint:{n:'Sprint',tab:[[20,3000],[30,2600],[45,2200],[60,1800],[90,1400],[120,1000],[180,600],[300,200],[600,0]]},
  ultra:{n:'Ultra',tab:[[0,0],[5000,300],[10000,600],[20000,1000],[35000,1400],[55000,1800],[80000,2200],[110000,2600],[150000,3000]]},
  marathon:{n:'Marathon',tab:[[0,0],[10000,300],[25000,600],[50000,1000],[100000,1400],[180000,1800],[300000,2200],[500000,2600],[800000,3000]]},
  surge:{n:'Surge Run',tab:[[1,0],[2,250],[3,450],[4,600],[7,1000],[10,1400],[13,1800],[16,2200],[19,2600],[24,3000]]}
};
var RANK_ORDER=['surge','sprint','ultra','marathon'];
function interp(tab,x){
  var n=tab.length;
  var inc=tab[n-1][0]>tab[0][0];
  if(inc?x<=tab[0][0]:x<=tab[n-1][0])return inc?tab[0][1]:tab[n-1][1];
  if(inc?x>=tab[n-1][0]:x>=tab[0][0])return inc?tab[n-1][1]:tab[0][1];
  for(var i=0;i<n-1;i++){
    var a=tab[i],b=tab[i+1],lo=Math.min(a[0],b[0]),hi=Math.max(a[0],b[0]);
    if(x>=lo&&x<=hi)return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);
  }
  return 0;
}
function invInterp(tab,r){ // performance rating -> result needed
  for(var i=0;i<tab.length-1;i++){
    var a=tab[i],b=tab[i+1],lo=Math.min(a[1],b[1]),hi=Math.max(a[1],b[1]);
    if(r>=lo&&r<=hi&&a[1]!==b[1])return a[0]+(b[0]-a[0])*(r-a[1])/(b[1]-a[1]);
  }
  return tab[tab.length-1][0];
}
function tierOf(r){
  var t=0,i;
  for(i=TIERS.length-1;i>=0;i--)if(r>=TIERS[i].min){t=i;break;}
  var T=TIERS[t],lo=T.min,hi=t<TIERS.length-1?TIERS[t+1].min:T.min+600,d=-1;
  if(T.div){var span=(hi-lo)/3;d=Math.min(2,Math.floor((r-lo)/span));lo=T.min+d*span;hi=lo+span;}
  return {t:t,d:d,step:t*3+(d<0?0:d),lo:lo,hi:hi,prog:clamp((r-lo)/(hi-lo),0,1)};
}
function rankName(ti){return TIERS[ti.t].n+(ti.d>=0?' '+['III','II','I'][ti.d]:'');}
function rankRec(m){var R=S.rank[m];if(!R){R=S.rank[m]={r:0,n:0,pk:0,h:[],pl:[]};}return R;}

// ---------- daily challenge ----------
var DAILY_KINDS=['surge','sprint','ultra'];
var DAILY_NAME={surge:'Daily Surge',sprint:'Daily Sprint',ultra:'Daily Ultra'};
var DAILY_DESC={surge:'A Surge Run where everyone gets the same pieces, power blocks, bosses and gift perk.',
  sprint:'Clear 40 lines as fast as you can. Everyone gets the exact same pieces today.',
  ultra:'Score as much as you can in 2 minutes. Everyone gets the exact same pieces today.'};
var DAILY_GIFTS=['bigbomb','widelaser','charged','pocket','overcharge','midas','phoenix','combofuel','spinner','battery','conductor','aftershock','hunter','quad','ward','keeper'];
function ymd(dt){return dt.getFullYear()*10000+(dt.getMonth()+1)*100+dt.getDate();}
function dayDate(d){return new Date(Math.floor(d/10000),Math.floor(d/100)%100-1,d%100);}
function prevDay(d){var x=dayDate(d);x.setDate(x.getDate()-1);return ymd(x);}
function nextDay(d){var x=dayDate(d);x.setDate(x.getDate()+1);return ymd(x);}
function dayNum(d){return Math.round(Date.UTC(Math.floor(d/10000),Math.floor(d/100)%100-1,d%100)/86400000);}
function dailyInfo(d){
  var kind=DAILY_KINDS[((dayNum(d)%3)+3)%3],r=mulberry32(Math.imul(d,0x9E3779B1)>>>0);
  r();r();
  return {d:d,kind:kind,seed:d>>>0,gift:kind==='surge'?DAILY_GIFTS[Math.floor(r()*DAILY_GIFTS.length)]:null};
}
function dailyBetter(a,b){
  if(a.k==='sprint'){if((a.w||0)!==(b.w||0))return (a.w||0)>(b.w||0);if(a.w)return a.t<b.t;return a.l>b.l;}
  return a.s>b.s;
}
function dailyResStr(e){
  if(!e)return '--';
  if(e.k==='sprint')return e.w?fmtTime(e.t):(e.l+'/'+SPRINT_LINES+' lines');
  return fmtNum(e.s)+(e.k==='surge'?' (Floor '+(e.f||1)+')':'');
}

