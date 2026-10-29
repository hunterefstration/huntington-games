// ---------- puzzle mode ----------
// Boards are listed top to bottom and sit on the floor: '.' empty, IJLOSTZ coloured blocks, '#' grey junk.
// q = the fixed piece queue. p = [most pieces for 3 stars, most pieces for 2 stars]; any solve earns 1 star.
// g = goal: pc (empty the whole board), clear (remove every starting block), dig (remove all grey junk),
//     ts (T-Spin clearing k+ lines, c times), lines (clear k lines), tetris (c Tetrises), combo (reach COMBO xk).
// t = optional extra: the solve must also include t T-Spins. h = optional tip. s = one known solution for the Hint
//     button, one [used Hold, piece, rotation, x, y] per piece. Every puzzle here was checked by a solver that
//     plays by these exact rules (SRS kicks, the T-Spin corner rule, a fixed queue with Hold); p[0] is its best.
var PZ_PACKS=[
{id:'a',n:'First Steps',d:'Learn the moves: lines, Hold, wells and your first spin.',c:['#1f8a52','#0e4a3a'],need:0,list:[
 {n:'Hello, Line',b:['LLJ....LLS'],q:'I',g:'lines',k:1,p:[1,1],h:'Lay the I piece flat in the gap and hard drop.',s:[[0,0,2,3,21]]},
 {n:'Square Deal',b:['IISJ..ZSSI','JJSS..ZSSI'],q:'O',g:'lines',k:2,p:[1,1],s:[[0,3,0,3,22]]},
 {n:'Hold That Thought',b:['SSJ....SSS'],q:'OI',g:'lines',k:1,p:[1,2],h:'Press Hold to put the O away and bring out the I.',s:[[1,0,2,3,21]]},
 {n:'The Well',b:['IOLLLJLLZ.','IOLLLJLLZ.','ZOOJIJTTZ.','ZZZJIITTZ.'],q:'LI',g:'tetris',c:1,p:[1,2],h:'Hold the L, then send the I down the well.',s:[[1,0,1,7,20]]},
 {n:'Gap Filler',b:['ZZ..IIIIOO','.ZZ.IIIIOO'],q:'SLZS',g:'clear',p:[2,3],s:[[0,4,1,1,21],[1,6,1,-1,21]]},
 {n:'Twin Hooks',b:['LLL....TLO','ZZL....TTO'],q:'LZL',g:'pc',p:[2,3],h:'Two L pieces make a perfect 4 by 2 box.',s:[[0,2,2,3,21],[1,2,0,4,22]]},
 {n:'Dig In',b:['#####.####','#####.####','#####.####','####.#####'],q:'IOTSZ',g:'dig',p:[2,3],s:[[0,0,1,3,19],[1,5,3,3,21]]},
 {n:'Stair Master',b:['LLLL..SSSS','LLLL.SSSS.'],q:'LZLZOZ',g:'clear',p:[2,3],s:[[1,6,1,3,21],[0,2,3,8,21]]},
 {n:'First Spin',b:['SSS.......','TS...TJJTI','TSJ.SSSJ.I'],q:'T',g:'ts',k:1,p:[1,1],h:'Move the T next to the slot and rotate it in as your LAST move.',s:[[0,5,2,2,21]]},
 {n:'Clean Start',b:['LLL.....OO','L.......OO'],q:'OJI',g:'pc',p:[3,3],s:[[0,3,0,5,22],[0,1,2,3,21],[0,0,2,1,21]]}
]},
{id:'b',n:'Spin Academy',d:'T-Spin Singles, Doubles and Triples, then build your own slots.',c:['#7a34d8','#3a1580'],need:8,list:[
 {n:'Single File',b:['.......ZZZ','ZZZJT...OZ','Z.JJJJ.OOO'],q:'OT',g:'ts',k:1,p:[1,2],s:[[1,5,2,5,21]]},
 {n:'Double Dip',b:['JJTT......','III...IJLT','IIII.LLJLL'],q:'T',g:'ts',k:2,p:[1,1],h:'The roof on the left means the T has to spin in.',s:[[0,5,2,3,21]]},
 {n:'Right Hook',b:['......LSSS','TJJO...SZZ','TJJOO.SSSZ'],q:'IT',g:'ts',k:2,p:[1,2],s:[[1,5,2,4,21]]},
 {n:'Raise the Roof',b:['TT........','TZJ...TSSL','TZZL.TTSSL'],q:'OT',g:'ts',k:2,p:[2,2],h:'Use the O to finish the roof over the slot.',s:[[0,3,0,1,20],[0,5,2,3,21]]},
 {n:'Hidden Pocket',b:['O.........','OSS...LTOO','OOJJ.LLTTO'],q:'JZT',g:'ts',k:2,p:[2,3],s:[[0,1,3,2,19],[1,5,2,3,21]]},
 {n:'Triple Threat',b:['...LLSZZII','....SSZZOO','STS.ZSJJJO','LT..ZJJJOO','LLL.LLJJOO'],q:'T',g:'ts',k:3,p:[1,1],h:'Slide the T in under the overhang, then rotate it down into the shaft.',s:[[0,5,3,2,21]]},
 {n:'Mirror Triple',b:['JSIILLL...','JJJIIZ....','ZOOSIZ.TTO','ZOOSII..OO','ZZLLOO.TTO'],q:'OT',g:'ts',k:3,p:[1,2],s:[[1,5,1,5,21]]},
 {n:'Two-Step',b:['OOLL......','SOO...LILS','SSLL.LLLLS','SILL......','TII...LLLL','TTTI.LLLSS'],q:'TT',g:'ts',k:2,c:2,p:[2,2],s:[[0,5,2,3,18],[0,5,2,3,21]]},
 {n:'Roofer',b:['O.........','SL....IOLL','SSI.OOOOOL'],q:'LOT',g:'ts',k:2,p:[3,3],s:[[0,2,2,5,20],[0,3,0,0,20],[0,5,2,2,21]]},
 {n:'Build the Triple',b:['....OLLSSJ','....OIIISS','IOJ.OOIJJJ','IO..SOLJJI','III.SSLLLI'],q:'SZT',g:'ts',k:3,p:[2,3],h:'One of the first two pieces makes the overhang. Which one?',s:[[1,6,1,2,17],[0,5,3,2,21]]}
]},
{id:'c',n:'Clean Sweep',d:'Perfect Clears: leave nothing behind. Not one block.',c:['#c99a12','#7a4a08'],need:18,list:[
 {n:'Pipe Dream',b:['IIII..IIII'],q:'IIO',g:'pc',p:[3,3],s:[[0,0,2,0,20],[0,0,2,6,20],[0,3,0,3,22]]},
 {n:'Spare Square',b:['...JJJOO..','.....JOO..'],q:'LIOO',g:'pc',p:[3,4],s:[[0,2,2,0,21],[1,3,0,7,22],[1,0,2,1,21]]},
 {n:'Hook Line',b:['.....LLLL.','...LLLL...'],q:'ILJ',g:'pc',p:[3,3],s:[[0,0,2,1,20],[0,2,0,7,22],[0,1,0,0,22]]},
 {n:'Five Alive',b:['..OO......','..OO......'],q:'IOLJT',g:'pc',p:[4,5],s:[[0,0,2,5,21],[0,3,0,-1,22],[0,2,2,4,21],[0,1,2,7,21]]},
 {n:'Loose Ends',b:['..J...OOOO','#.JJJ#OOOO'],q:'LIIS',g:'pc',p:[4,4],s:[[0,2,0,3,21],[0,0,2,6,19],[1,4,1,-1,21],[0,0,2,1,21]]},
 {n:'Zig Zag Sweep',b:['...ZZ...SS','....ZZ.SSL','.....##LLL'],q:'TZOJZ',g:'pc',p:[4,5],s:[[0,5,2,5,20],[0,6,2,2,21],[0,3,0,-1,22],[0,1,2,0,21]]},
 {n:'Odd Couple',b:['.........T','OO..J...TT','OO.#JJJ.#T'],q:'OJSJ',g:'pc',p:[4,4],s:[[0,3,0,4,21],[0,1,1,6,21],[0,4,2,2,20],[0,1,2,0,21]]},
 {n:'Tall Order',b:['...IIII...','..SS.ZZ.OO','.SS...ZZOO'],q:'TZLOJLJ',g:'pc',p:[6,7],s:[[0,5,1,-1,21],[0,6,2,0,19],[0,2,3,6,20],[0,3,0,7,20],[0,1,2,2,20],[0,2,0,3,22]]},
 {n:'Skyline',b:['........II','.STTT..TII','.SST..TTII','..S....TII'],q:'SLIII',g:'pc',p:[5,5],s:[[0,4,2,4,20],[1,0,2,4,18],[0,0,1,-2,20],[1,2,2,1,21],[0,0,2,3,21]]},
 {n:'Grand Sweep',b:['.......I..','..T....I.J','.TT.ZZ.I.J','..T..ZZIJJ'],q:'JLJSTII',g:'pc',p:[6,7],s:[[0,1,1,7,20],[1,1,2,4,20],[1,2,1,2,21],[0,5,1,-1,20],[0,0,2,3,20],[1,4,2,0,21]]}
]},
{id:'d',n:'Deep Dig',d:'Grey junk is buried deep. Dig every last block of it out.',c:['#c0601a','#5a2a0a'],need:30,list:[
 {n:'Shovel Ready',b:['######.###','#########.','#######.##'],q:'OJIZ',g:'dig',p:[3,4],s:[[1,1,2,4,19],[0,0,1,7,19],[0,6,1,6,21]]},
 {n:'Bedrock',b:['########.#','#######.##','#.########','#.########'],q:'ZIZJ',g:'dig',p:[3,4],s:[[0,6,1,7,18],[0,0,1,5,18],[1,1,1,0,21]]},
 {n:'Tunnel Vision',b:['##.#######','##.#####.#','#########.'],q:'LITZL',g:'dig',p:[3,4],s:[[0,2,3,1,20],[1,5,3,7,20],[1,0,1,7,20]]},
 {n:'Two Holes',b:['####.#####','#.#######.'],q:'LOIZ',g:'dig',p:[3,4],s:[[0,2,2,4,20],[1,0,1,7,20],[0,6,1,0,21]]},
 {n:'Overhang',b:['.......L..','.....LLL..','###.######','#########.','#.########'],q:'JSJZ',g:'dig',p:[3,4],s:[[0,1,1,2,19],[0,4,1,7,20],[0,1,1,0,21]]},
 {n:'Rubble',b:['........OO','........OO','####.#####','#####.####','#.########'],q:'ZJZIJS',g:'dig',p:[3,4],s:[[1,1,2,2,19],[0,6,1,4,20],[0,0,1,-1,20]]},
 {n:'Crosscut',b:['##.#######','##.#######','.#######.#'],q:'SJLTS',g:'dig',p:[3,4],s:[[1,1,1,1,20],[0,2,3,7,21],[0,5,1,-1,21]]},
 {n:'Spin Drill',b:['TTZZ......','TTT...####','####.#####','####.#####'],q:'TIL',g:'dig',t:1,p:[2,3],h:'A T-Spin Double opens up the junk.',s:[[0,5,2,3,20],[0,0,1,2,20]]},
 {n:'Deep Core',b:['#######.##','#########.','##.######.','###.######'],q:'ISOTIL',g:'dig',p:[4,5],s:[[1,4,1,5,18],[1,0,1,7,19],[0,5,3,1,20],[0,0,1,1,20]]},
 {n:'The Mine',b:['..Z.......','.ZZ.ZZ....','.Z...ZZ...','###.######','###.###.##','.#########','.#########'],q:'JTJIIZ',g:'dig',p:[5,6],s:[[0,1,1,1,14],[0,5,2,4,15],[1,0,1,1,18],[1,1,1,6,19],[1,0,1,-2,20]]}
]},
{id:'e',n:'Combo Kitchen',d:'Cook up combos: clear lines with piece after piece. Plus Tetrises.',c:['#d02c44','#6a0a1e'],need:45,list:[
 {n:'Warm Up',b:['....JJLLLT','....JTIILT','....JTIILL','....STZIIL','....SSZILL','ZZ.ZJJZZLL'],q:'TLIII',g:'combo',k:3,p:[4,5],h:'Every piece has to clear a line. Keep the well flat.',s:[[0,5,1,1,21],[0,2,1,-1,21],[0,0,2,0,19],[0,0,2,0,19]]},
 {n:'Simmer',b:['....JJZZJJ','....LJJZLJ','....LJLLLJ','....LLLLLL','....ILLLTL','Z.ZZILJJTL'],q:'TZIJI',g:'combo',k:3,p:[4,5],s:[[0,5,2,0,21],[1,0,1,1,20],[0,1,2,0,21],[0,0,2,0,19]]},
 {n:'Four Wide',b:['....ZJSSII','....ZJOOOI','....ZZZOII','....TTZIII','...ZSTJJIS','Z..ZSSSJJS'],q:'JTJTO',g:'combo',k:3,p:[4,5],s:[[0,1,0,0,21],[0,5,2,1,21],[1,5,2,0,21],[1,1,2,1,21]]},
 {n:'Quad Squad',b:['#.#.###..#','###.####.#','########.#','########.#','########.#'],q:'OILJI',g:'tetris',c:1,p:[3,4],s:[[0,3,0,-1,17],[1,2,3,2,18],[1,0,1,6,20]]},
 {n:'Stir Fry',b:['....JZSOIJ','....SZSOOJ','....SSSIIJ','...ZSZZIIJ','..ZZIIZZSS'],q:'IOTZLZ',g:'combo',k:4,p:[5,6],s:[[0,0,2,0,19],[0,3,0,-1,22],[0,5,2,1,21],[0,6,1,-1,21],[0,2,1,1,21]]},
 {n:'Patch Job',b:['.###.##..#','####.#####','####.#####','####.#####'],q:'LZZI',g:'tetris',c:1,p:[3,4],h:'Patch the holes on top first, then the I can score.',s:[[0,2,1,6,18],[0,6,1,-1,18],[1,0,1,2,20]]},
 {n:'Hot Plate',b:['TSSSLL....','TJSSOL....','IJJLOL....','ITTLII....','TTTLLI....','TTTLLIZ.ZZ'],q:'LZOZOS',g:'combo',k:4,p:[5,6],s:[[0,2,2,7,21],[0,6,1,5,21],[0,3,0,7,22],[0,6,1,5,21],[0,3,0,7,22]]},
 {n:'Double Patch',b:['#..#######','##.##..##.','##.#######','##.#######','##.#######'],q:'IZIZI',g:'tetris',c:1,p:[4,5],s:[[1,6,2,0,17],[0,0,1,7,17],[0,6,2,4,18],[0,0,1,0,20]]},
 {n:'Pressure Cooker',b:['JIIIII....','JIJIIS....','JJJIIS....','ILLLLL....','ILLLIL....','IIJJII.ZZZ'],q:'ZITZTZJ',g:'combo',k:5,p:[7,7],s:[[0,6,1,-1,15],[1,5,1,5,21],[0,6,2,7,21],[1,0,1,7,20],[1,5,2,6,21],[0,1,2,6,21],[0,6,1,5,21]]},
 {n:'Chef\'s Special',b:['JSTTLL....','ZSSIZZ....','ZZLIIZ....','ZZLIJZ....','ZZLLJJZZ.Z'],q:'IZOIJTT',g:'combo',k:5,p:[7,7],s:[[0,0,2,0,16],[0,6,1,7,21],[0,3,0,5,22],[0,0,2,6,20],[1,5,2,7,21],[1,1,2,4,21],[0,5,0,7,22]]}
]},
{id:'f',n:'Demolition',d:'Every starting block is marked. Knock them all down.',c:['#139a9a','#08485a'],need:60,list:[
 {n:'Wrecking Ball',b:['.ZZ.JIIIIL','..ZZJJJLLL'],q:'SIJZLT',g:'clear',p:[3,4],s:[[1,0,1,-2,20],[0,1,1,2,20],[0,6,1,0,21]]},
 {n:'Teardown',b:['OO.T...T..','OOTTT.TTT.'],q:'LISTJO',g:'clear',p:[3,4],s:[[0,2,2,2,20],[1,4,1,7,21],[0,5,2,4,21]]},
 {n:'Knock Knock',b:['JJJJZZ.OO.','JJJJ.ZZOO.'],q:'OTILZ',g:'clear',p:[3,4],s:[[1,5,1,5,20],[0,0,1,7,20],[0,2,3,3,21]]},
 {n:'Brickwork',b:['..SS.LOOOO','.SSLLLOOOO'],q:'LOLI',g:'clear',p:[3,4],s:[[0,2,2,1,20],[1,2,2,4,20],[0,0,1,-2,20]]},
 {n:'Hammer Time',b:['...LLLLJJJ','...LLLL..J'],q:'JZTZJ',g:'clear',p:[3,4],s:[[0,1,3,1,21],[0,6,1,-1,21],[1,6,2,6,21]]},
 {n:'Bulldozer',b:['JJJJLLL.SS','JJJJL..SS.'],q:'ILTZL',g:'clear',p:[3,4],s:[[0,0,1,5,19],[0,2,1,4,21],[0,5,3,8,21]]},
 {n:'Scrap Heap',b:['JJZJJ.JSLL','JZZJ..JSSL','JZ.J.JJ.SL'],q:'LIZI',g:'clear',p:[4,4],s:[[0,2,3,5,18],[1,6,3,4,21],[0,0,1,0,20],[0,0,1,5,20]]},
 {n:'Crane Game',b:['.OO.IIIILL','.OOLOOTTTL','.LLLOO.T.L'],q:'ISIL',g:'clear',p:[4,4],s:[[0,0,1,1,18],[1,0,1,-2,20],[0,2,3,5,21],[0,4,1,6,21]]},
 {n:'Wrecking Crew',b:['OO.S..JJJJ','OOTSS.JZZJ','.TTTSJJ.ZZ'],q:'TJILI',g:'clear',p:[4,5],s:[[0,5,3,4,20],[0,1,1,1,20],[0,0,1,-2,20],[0,2,2,7,21]]},
 {n:'Implosion',b:['..JJ..ZJJJ','OOJ..ZZT.J','OOJ..ZTTT.'],q:'JSOIIS',g:'clear',p:[5,6],s:[[0,1,3,0,19],[0,4,2,4,19],[0,3,0,2,22],[0,0,1,6,19],[0,0,1,7,20]]}
]},
{id:'g',n:'Grand Finale',d:'The hardest boards: spins into Perfect Clears and more.',c:['#9a1048','#2a0620'],need:80,list:[
 {n:'Spin & Sweep',b:['IIO.......','JI...ITOOJ','JJI.IITO.J'],q:'TTI',g:'pc',t:1,p:[3,3],h:'Start with the T-Spin Single.',s:[[0,5,2,2,21],[0,5,2,7,21],[0,0,2,3,21]]},
 {n:'Blueprint',b:['..........','ZJ....SSOZ','ZJJ.LLLLOO'],q:'JOT',g:'ts',k:2,p:[3,3],s:[[0,1,1,4,20],[0,3,0,0,20],[0,5,2,2,21]]},
 {n:'Mirror Stack',b:['OOZZ......','OLL...TTTT','ZZLL.ZZZSJ','......OOSJ','LLJJ...SSJ','LLLJJ.TTTJ'],q:'TT',g:'ts',k:2,c:2,p:[2,2],s:[[0,5,2,3,18],[0,5,2,4,21]]},
 {n:'Double or Nothing',b:['SSOO......','LZZ...OOLL','LLLL.LLSSL'],q:'TOTLIIILSJ',g:'pc',t:1,p:[5,7],h:'A T-Spin Double first, then sweep the rest.',s:[[0,5,3,3,21],[0,3,0,7,21],[1,2,0,5,21],[0,0,2,0,20],[1,5,2,4,21]]},
 {n:'Tight Squeeze',b:['.........T','.T..LL.ZTT','.TT..LZZTT','.T...LZTTT'],q:'ISLLLS',g:'pc',p:[5,6],s:[[0,0,1,-2,20],[0,4,3,3,21],[0,2,2,6,20],[0,2,3,1,21],[0,2,2,3,21]]},
 {n:'Combo Tower',b:['TSZIZS....','JSIISS....','JJIIIS....','OJOOZZ...Z','OOOOOZ..ZZ'],q:'LZZTZS',g:'combo',k:4,p:[6,6],s:[[0,2,3,6,21],[0,6,1,7,20],[1,5,1,5,20],[0,6,1,7,20],[1,6,1,6,20],[0,4,1,4,21]]},
 {n:'Last Stand',b:['...Z.....T','..ZZLLL.TT','..Z.L....T'],q:'JIZTOI',g:'clear',p:[6,6],s:[[0,1,1,0,21],[0,0,1,-2,20],[1,5,2,6,20],[1,6,2,4,21],[0,0,1,1,20],[0,3,0,6,22]]},
 {n:'Endgame',b:['...S.L.T..','..TSSL.TT.','.TTTSLLT..'],q:'TJZLTZ',g:'pc',p:[6,6],s:[[0,5,3,8,20],[0,1,2,2,19],[1,2,3,5,20],[0,5,1,-1,21],[0,6,2,0,20],[0,6,2,7,21]]},
 {n:'Bottom Out',b:['##.#######','#######.##','###.######','###.######'],q:'OSJZL',g:'dig',p:[4,5],s:[[0,3,0,4,18],[0,4,1,0,18],[1,6,1,6,19],[1,1,1,2,21]]},
 {n:'Triple Crown',b:['...ZZILLZZ','....TIIIZ.','LLJ.TJJIZS','LL..IJLILL','LLZ.IILLLL'],q:'TTJLTJJI',g:'pc',t:1,p:[8,8],h:'It starts with a T-Spin Triple.',s:[[0,5,2,2,16],[0,5,3,2,21],[1,2,2,0,21],[0,5,0,4,21],[0,1,0,0,21],[0,1,2,7,21],[0,0,2,6,20],[0,1,0,1,22]]}
]}
];
var PZ_MARK=128,PZ_ALL=[],PZ_BY={},lastPack=0;
PZ_PACKS.forEach(function(pk,pi){pk.list.forEach(function(d,i){d.id=pk.id+(i+1);d.pi=pi;d.i=i;PZ_ALL.push(d);PZ_BY[d.id]=d;});});
function pzRec(id){return S.puz[id]||null;}
function pzStars(){var n=0;for(var id in S.puz)if(PZ_BY[id])n+=S.puz[id].s||0;return n;}
function pzSolvedCount(){var n=0;for(var id in S.puz)if(PZ_BY[id]&&S.puz[id].s>0)n++;return n;}
function pz3Count(){var n=0;for(var id in S.puz)if(PZ_BY[id]&&S.puz[id].s>=3)n++;return n;}
function packSolved(pk){var n=0;pk.list.forEach(function(d){var r=S.puz[d.id];if(r&&r.s>0)n++;});return n;}
function packStars(pk){var n=0;pk.list.forEach(function(d){var r=S.puz[d.id];if(r)n+=r.s||0;});return n;}
function pzBestPack(){var b=0;PZ_PACKS.forEach(function(pk){b=Math.max(b,Math.round(packSolved(pk)/pk.list.length*10));});return b;}
function packOpen(pk){return pzStars()>=pk.need;}
var PZ_NUM=['ZERO','ONE','TWO','THREE','FOUR','FIVE','SIX'];
function pzGoal(d){ // short goal line for the HUD and menus
  var c=d.c||1,g;
  switch(d.g){
    case 'pc':g='Perfect Clear: empty the whole board';break;
    case 'clear':g='Clear every starting block';break;
    case 'dig':g='Dig out all the grey junk';break;
    case 'ts':g=(c>1?'Make '+c+' ':'Make a ')+'T-Spin '+(['','Single','Double','Triple'][d.k]||'')+(c>1?'s':'')+(d.k<3?' (or better)':'');break;
    case 'lines':g='Clear '+d.k+' line'+(d.k>1?'s':'');break;
    case 'tetris':g=c>1?'Make '+c+' Tetrises':'Make a Tetris (4 lines at once)';break;
    case 'combo':g='Reach COMBO x'+d.k+' ('+(d.k+1)+' clears in a row)';break;
  }
  if(d.t)g+=', with '+(d.t>1?d.t+' T-Spins':'a T-Spin');
  return g;
}
function pzStarsFor(d,used){return used<=d.p[0]?3:(used<=d.p[1]?2:1);}
function starStr(n,of){var h='<span class="stars">';for(var i=0;i<(of||3);i++)h+=i<n?'&#9733;':'<i>&#9733;</i>';return h+'</span>';}
function pzLabel(d){return (d.pi+1)+'-'+(d.i+1);}

// ---------- tutorial lessons ----------
// Each step loads a board (same notation as puzzles, '*' marks the target outline) and a queue.
// need: hold (press Hold), lines (clear k+), ts (T-Spin clearing k+ lines), place (cover the outline).
// keep: carry on with the board, queue and hold from the step before. demo: the moves "Show me" plays.
var LESSONS=[
{id:'hold',n:'Hold',d:'Save a piece for later, then swap it back.',done:'You can Hold pieces now. Remember: one Hold per piece!',steps:[
  {t:'This S piece does not fit the well. Press {hold} to put it in the Hold box (top left).',b:['TTTTIIISS.','TTTTTIIIJ.','TTOTSILLJ.','TTOOSSLLL.'],q:'SIO',need:'hold',demo:'H',ok:'SAVED!'},
  {keep:1,t:'The I piece came out. Rotate it with {cw}, move it with {left} {right} and drop it down the well with {hard}!',need:'lines',k:4,demo:'CRRRRDDDDDDDDDDDDDDDDDX',ok:'TETRIS!'},
  {keep:1,t:'Your S is still in the Hold box. Press {hold} to swap it with this O.',need:'hold',demo:'H',ok:'SWAPPED!'},
  {keep:1,tg:['.**.......','**........'],t:'Now place the S on the glowing outline and press {hard}.',need:'place',demo:'CCLLLDDDDDDDDDDDDDDDDDDX',ok:'NICE!'},
  {t:'Only one Hold per piece! Clear both lines: one of these two pieces fits, the other does not.',b:['JJJT..JTJL','JTTT..JJJL'],q:'ZO',need:'lines',k:2,demo:'HDDDDDDDDDDDDDDDDDDDX',ok:'PERFECT!'}
]},
{id:'tspin',n:'T-Spins',d:'Spin the T piece into tight slots for big points.',done:'T-Spin Single, Double and Triple: done! The Spin Academy puzzle pack is a great next step.',steps:[
  {t:'This slot has a roof, so the T cannot drop straight in. Move it beside the slot, then ROTATE it in as your very last move and press {hard}.',b:['JLT.......','IL...IILJL','IIZ.SSSL.L'],q:'T',need:'ts',k:1,demo:'CLDDDDDDDDDDDDDDDDDDCX',ok:'T-SPIN SINGLE!'},
  {t:'Now a T-Spin Double: same idea, but this slot clears 2 lines. Point the T down and spin it in.',b:['ITII......','JTZ...ZLLL','JJZZ.ZZLLL'],q:'T',need:'ts',k:2,demo:'CDDDDDDDDDDDDDDDDDDCX',ok:'T-SPIN DOUBLE!'},
  {t:'No roof here yet! Put the L on the glowing outline to build one.',b:['..*.......','..*.......','J.**......','JLS...TLTL','JLLJ.ZZLLL'],q:'LT',need:'place',demo:'CLLDDDDDDDDDDDDDDDDX',ok:'ROOF BUILT!'},
  {keep:1,t:'Now spin the T into the slot under your new roof!',need:'ts',k:2,demo:'CDDDDDDDDDDDDDDDDDDCX',ok:'T-SPIN DOUBLE!'},
  {t:'The big one: a T-Spin Triple. Slide the T in under the overhang, then rotate it down into the deep shaft.',b:['...IISSSIL','....JJSLOL','IOJ.JOOLOO','LO..SOSSZZ','LLZ.SSSSZZ'],q:'T',need:'ts',k:3,demo:'LLLDDDDDDDDDDDDDDDDRWX',ok:'T-SPIN TRIPLE!'}
]}
];
var LES_BY={};LESSONS.forEach(function(l,i){l.i=i;LES_BY[l.id]=l;});
function tutDone(){var n=0;LESSONS.forEach(function(l){if(S.tut[l.id])n++;});return n;}

var ACTIONS=[['left','Move left'],['right','Move right'],['soft','Soft drop'],['hard','Hard drop'],['cw','Rotate right'],['ccw','Rotate left'],['r180','Rotate 180'],['hold','Hold'],['surge','Surge Shockwave'],['undo','Undo / Show me (puzzles)'],['retry','Retry puzzle'],['hint','Hint (puzzles)'],['pause','Pause']];
var DEFK={left:['ArrowLeft','KeyA'],right:['ArrowRight','KeyD'],soft:['ArrowDown','KeyS'],hard:['Space'],cw:['ArrowUp','KeyX','KeyW'],ccw:['KeyZ'],r180:['KeyR'],hold:['KeyC','ShiftLeft','ShiftRight'],surge:['KeyV','KeyE'],undo:['KeyU','Backspace'],retry:['KeyT'],hint:['KeyH'],pause:['KeyP','Escape']};
var codeMap={};
function bindsFor(a){return (S.binds[a]&&S.binds[a].length)?S.binds[a]:DEFK[a];}
function rebuildCodes(){codeMap={};ACTIONS.forEach(function(a){bindsFor(a[0]).forEach(function(c){if(!codeMap[c])codeMap[c]=a[0];});});}
function keyName(c){
  if(!c)return '-';
  var m={ArrowLeft:'Left',ArrowRight:'Right',ArrowUp:'Up',ArrowDown:'Down',Space:'Space',ShiftLeft:'L-Shift',ShiftRight:'R-Shift',ControlLeft:'L-Ctrl',ControlRight:'R-Ctrl',AltLeft:'L-Alt',AltRight:'R-Alt',Escape:'Esc',Enter:'Enter',Backspace:'Bksp',Tab:'Tab',Comma:',',Period:'.',Slash:'/',Semicolon:';',Quote:"'",BracketLeft:'[',BracketRight:']',Backslash:'\\',Minus:'-',Equal:'=',Backquote:'`'};
  if(m[c])return m[c];
  if(/^Key[A-Z]$/.test(c))return c.charAt(3);
  if(/^Digit\d$/.test(c))return c.charAt(5);
  if(/^Numpad/.test(c))return 'Num'+c.substr(6);
  return c.replace(/[^\x20-\x7e]/g,'').slice(0,8);
}
rebuildCodes();

// ---------- audio (WebAudio synth, no files) ----------
var AC=null,gMaster=null,gSfx=null,gMus=null,audioOK=true,noiseBuf=null;
function initAudio(){
  if(AC){if(AC.state==='suspended'){try{AC.resume();}catch(e){}}return;}
  if(!audioOK)return;
  try{
    var C=window.AudioContext||window.webkitAudioContext;
    if(!C){audioOK=false;return;}
    AC=new C();
    gMaster=AC.createGain();gMaster.gain.value=1;
    var comp=AC.createDynamicsCompressor();gMaster.connect(comp);comp.connect(AC.destination);
    gSfx=AC.createGain();gSfx.connect(gMaster);
    gMus=AC.createGain();gMus.connect(gMaster);
    applyVol();
  }catch(e){AC=null;audioOK=false;}
}
function applyVol(){if(!AC)return;try{gSfx.gain.value=S.set.sfx/100*0.9;gMus.gain.value=S.set.music/100*0.30;}catch(e){}}
function tone(f,d,type,v,f2,delay,dest){
  if(!AC)return;
  if(!dest&&S.set.sfx<=0)return;
  try{
    var t=AC.currentTime+(delay||0),o=AC.createOscillator(),g=AC.createGain();
    o.type=type||'square';o.frequency.setValueAtTime(f,t);
    if(f2)o.frequency.exponentialRampToValueAtTime(Math.max(20,f2),t+d);
    g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(0.0002,v||0.2),t+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001,t+d);
    o.connect(g);g.connect(dest||gSfx);o.start(t);o.stop(t+d+0.05);
  }catch(e){}
}
function noise(d,v,f,delay,f2){
  if(!AC||S.set.sfx<=0)return;
  try{
    if(!noiseBuf){noiseBuf=AC.createBuffer(1,AC.sampleRate,AC.sampleRate);var a=noiseBuf.getChannelData(0);for(var i=0;i<a.length;i++)a[i]=Math.random()*2-1;}
    var t=AC.currentTime+(delay||0),s=AC.createBufferSource(),fl=AC.createBiquadFilter(),g=AC.createGain();
    s.buffer=noiseBuf;s.loop=true;fl.type='lowpass';fl.frequency.setValueAtTime(f||1000,t);
    if(f2)fl.frequency.exponentialRampToValueAtTime(Math.max(30,f2),t+d);
    g.gain.setValueAtTime(v||0.3,t);g.gain.exponentialRampToValueAtTime(0.0001,t+d);
    s.connect(fl);fl.connect(g);g.connect(gSfx);s.start(t);s.stop(t+d+0.05);
  }catch(e){}
}
var lastMoveSfx=0;
var sfx={
  click:function(){tone(740,.05,'square',.07);},
  move:function(){var n=Date.now();if(n-lastMoveSfx<35)return;lastMoveSfx=n;tone(260,.035,'square',.045);},
  rot:function(){tone(480,.06,'square',.07,720);},
  hold:function(){tone(380,.09,'triangle',.14,640);},
  lock:function(){tone(170,.07,'triangle',.18,110);},
  hard:function(){noise(.1,.28,900,0,200);tone(130,.12,'sine',.3,55);},
  clear:function(n,big){
    var sc=[523.25,659.25,783.99,1046.5,1318.5];
    for(var i=0;i<Math.min(n,4)+1;i++)tone(sc[i],.16+(big?.1:0),'square',.09,0,i*.05);
    if(n>=4){tone(1568,.5,'triangle',.14,0,.22);noise(.35,.2,3000,0,300);}
  },
  tspin:function(){var s=[392,523,659,784,1047];for(var i=0;i<s.length;i++)tone(s[i],.14,'sawtooth',.07,0,i*.045);},
  combo:function(c){tone(330*Math.pow(2,Math.min(c,12)/12),.1,'square',.09,0,0);tone(495*Math.pow(2,Math.min(c,12)/12),.12,'triangle',.09,0,.05);},
  level:function(){var s=[523,659,784,1047,1319];for(var i=0;i<s.length;i++)tone(s[i],.18,'square',.09,0,i*.07);},
  over:function(){for(var i=0;i<6;i++)tone(400-i*45,.28,'sawtooth',.1,0,i*.13);},
  win:function(){var s=[523,659,784,1047,784,1047,1319];for(var i=0;i<s.length;i++)tone(s[i],.2,'square',.09,0,i*.1);},
  bomb:function(){noise(.55,.5,1500,0,60);tone(90,.5,'sawtooth',.3,28);tone(200,.2,'square',.12,50);},
  laser:function(){tone(2400,.45,'sawtooth',.1,160);tone(1200,.45,'square',.06,90,.05);},
  frost:function(){[1568,1976,2349,2637].forEach(function(f,i){tone(f,.5,'sine',.1,0,i*.07);});},
  quake:function(){noise(.8,.45,300,0,50);tone(55,.8,'square',.22,28);},
  gold:function(){tone(988,.08,'square',.09);tone(1319,.3,'square',.09,0,.08);},
  perk:function(){[523,784,1047,1568].forEach(function(f,i){tone(f,.16,'triangle',.12,0,i*.06);});},
  boss:function(){tone(110,.9,'sawtooth',.2,0);tone(116.5,.9,'sawtooth',.18,0);tone(55,.9,'square',.15,0);},
  rumble:function(){noise(.5,.4,250,0,60);tone(60,.5,'square',.2,30);},
  beep:function(){tone(660,.12,'square',.09);},
  go:function(){tone(990,.35,'square',.11);},
  ready:function(){[392,587,880,1175].forEach(function(f,i){tone(f,.14,'sawtooth',.08,0,i*.05);});},
  surge:function(){noise(.9,.55,6000,0,100);tone(80,.9,'sawtooth',.3,900);tone(1800,.5,'square',.1,200,.1);},
  pc:function(){[523,659,784,1047,1319,1568,2093].forEach(function(f,i){tone(f,.25,'triangle',.12,0,i*.06);});},
  warn:function(){tone(220,.15,'square',.1);tone(220,.15,'square',.1,0,.2);},
  ach:function(){[880,1109,1319].forEach(function(f,i){tone(f,.15,'triangle',.11,0,i*.08);});},
  b2b:function(){tone(784,.1,'square',.07);tone(1175,.16,'square',.07,0,.07);},
  promo:function(){[523,659,784,1047,1319,1568,2093].forEach(function(f,i){tone(f,.22,'square',.08,0,i*.08);});tone(1047,.9,'triangle',.12,0,.6);tone(1568,.9,'triangle',.09,0,.6);noise(.6,.12,6000,.55,800);},
  demote:function(){tone(392,.2,'triangle',.1);tone(311,.4,'triangle',.1,0,.18);},
  flip:function(){tone(300,.35,'sawtooth',.09,1200);tone(1200,.35,'sawtooth',.05,300,.1);},
  shift:function(){noise(.25,.3,600,0,150);tone(140,.22,'square',.12,90);},
  freeze:function(){[2637,2093,1568].forEach(function(f,i){tone(f,.3,'sine',.09,0,i*.05);});noise(.3,.15,5000,0,1500);},
  melt:function(){tone(900,.25,'sine',.06,300);},
  flood:function(){tone(180,.18,'square',.09,120);},
  peek:function(){tone(1200,.08,'triangle',.08);tone(1600,.1,'triangle',.08,0,.06);},
  ward:function(){tone(880,.2,'triangle',.12,1760);noise(.2,.15,4000,0,800);}
};
// background music: public-domain folk tune on a chip-style synth
var MEL=[[659,1],[494,.5],[523,.5],[587,1],[523,.5],[494,.5],[440,1],[440,.5],[523,.5],[659,1],[587,.5],[523,.5],[494,1.5],[523,.5],[587,1],[659,1],[523,1],[440,1],[440,1],[0,1],[587,1.5],[698,.5],[880,1],[784,.5],[698,.5],[659,1.5],[523,.5],[659,1],[587,.5],[523,.5],[494,1],[494,.5],[523,.5],[587,1],[659,1],[523,1],[440,1],[440,1],[0,1]];
var BASS=[110,165,110,165,98,147,110,165,110,165,98,147,82.4,123.5,110,165];
var mus={on:false,idx:0,next:0,pos:0,timer:0,bpm:132};
function musicStart(){
  if(!AC||mus.on||S.set.music<=0)return;
  mus.on=true;mus.next=AC.currentTime+0.12;
  mus.timer=setInterval(musicTick,60);
}
function musicStop(){mus.on=false;if(mus.timer){clearInterval(mus.timer);mus.timer=0;}}
function musicTick(){
  if(!AC||!mus.on)return;
  var guard=0;
  while(mus.next<AC.currentTime+0.3&&guard++<20){
    var n=MEL[mus.idx],beat=60/mus.bpm,dl=mus.next-AC.currentTime;
    if(n[0])tone(n[0],Math.max(.06,n[1]*beat*.92),'square',.5,0,dl,gMus);
    var b0=Math.ceil(mus.pos-1e-6),b1=mus.pos+n[1];
    for(var b=b0;b<b1-1e-6;b++){
      var bd=dl+(b-mus.pos)*beat;
      tone(BASS[b%BASS.length],beat*.8,'triangle',.7,0,Math.max(0,bd),gMus);
    }
    mus.next+=n[1]*beat;mus.pos+=n[1];mus.idx=(mus.idx+1)%MEL.length;
  }
}
function vibe(ms){if(!S.set.hap||!isTouch)return;try{if(navigator.userActivation&&!navigator.userActivation.hasBeenActive)return;if(navigator.vibrate)navigator.vibrate(ms);}catch(e){}}

// ---------- themes & block sprites ----------
var THEMES=[
  {id:'classic',name:'Classic',style:'bevel',how:'Unlocked from the start',test:function(){return true;},
   bg:['#10152e','#1c1245'],acc:'#5ad1ff',board:'rgba(4,6,20,.80)',grid:'rgba(255,255,255,.07)',
   cols:[null,'#00d2e6','#2f6bff','#ff9a1f','#ffd92b','#38d64a','#b44cff','#ff3d55','#7d869b']},
  {id:'neon',name:'Neon',style:'neon',how:'Clear 25 lines in total',test:function(){return S.stats.lines>=25;},
   bg:['#05030f','#14052e'],acc:'#ff2bd6',board:'rgba(2,2,12,.88)',grid:'rgba(120,80,255,.16)',
   cols:[null,'#18f0ff','#4d7bff','#ff8a1c','#fff23a','#2dff6a','#c04dff','#ff2e63','#8a8fb0']},
  {id:'candy',name:'Candy',style:'candy',how:'Play 3 games',test:function(){return S.stats.games>=3;},
   bg:['#3a1c5e','#c23b8a'],acc:'#ffd1f2',board:'rgba(60,15,70,.60)',grid:'rgba(255,255,255,.10)',
   cols:[null,'#46e0e8','#6a8cff','#ffa24a','#ffe45a','#6bea6f','#d27cff','#ff5c7e','#b5a4c8']},
  {id:'retro',name:'Retro Handheld',style:'pixel',how:'Clear 100 lines in total',test:function(){return S.stats.lines>=100;},
   bg:['#0f380f','#1b4d1b'],acc:'#9bbc0f',board:'rgba(139,172,15,.20)',grid:'rgba(15,56,15,.45)',
   cols:[null,'#c8e060','#7fa80f','#a8c82a','#e2f59a','#5f9a1a','#306230','#8bac0f','#4a6a3a']},
  {id:'sunset',name:'Sunset',style:'glass',how:'Perform a T-Spin',test:function(){return S.stats.tspins>=1;},
   bg:['#2b1040','#ff6a3d'],acc:'#ffd27a',board:'rgba(30,8,40,.62)',grid:'rgba(255,255,255,.10)',
   cols:[null,'#ffe08a','#ff7a59','#ff9f43','#fff1a8','#ffb36b','#e8508a','#ff4d4d','#b08a9a']},
  {id:'ice',name:'Glacier',style:'glass',how:'Trigger 3 Frost blocks',test:function(){return S.stats.frosts>=3;},
   bg:['#07203a','#1e6a9a'],acc:'#bff0ff',board:'rgba(4,22,44,.66)',grid:'rgba(190,240,255,.12)',
   cols:[null,'#7ff0ff','#4d9bff','#9ad8ff','#e6fbff','#58e0c8','#8d8dff','#6fb6ff','#8fa8bd']},
  {id:'inferno',name:'Inferno',style:'flat',how:'Defeat a boss in Surge Run',test:function(){return S.stats.bosses>=1;},
   bg:['#1a0505','#6a1608'],acc:'#ff8a2b',board:'rgba(20,3,3,.78)',grid:'rgba(255,140,60,.12)',
   cols:[null,'#ffcf4a','#ff5a1f','#ff8c1a','#ffe14a','#ff3d2e','#c2185b','#ff1744','#7a5a4a']},
  {id:'gold',name:'Midas Gold',style:'glass',how:'Perform a Perfect Clear',test:function(){return S.stats.pcs>=1;},
   bg:['#1a1405','#4a3508'],acc:'#ffe27a',board:'rgba(20,14,2,.72)',grid:'rgba(255,226,122,.12)',
   cols:[null,'#fff0a0','#e8b830','#ffcf40','#fff7c0','#d9a520','#c8923a','#f2c94c','#9c8a5a']}
];
var TH_BY={};THEMES.forEach(function(t){TH_BY[t.id]=t;});
function themeUnlocked(t){return t.test();}
function theme(){var t=TH_BY[S.set.theme];if(!t||!themeUnlocked(t))t=THEMES[0];return t;}
// block skins: the shape every block is drawn with ('auto' = the colour theme's own style)
function always(){return true;}
var SKINS=[
  {id:'auto',name:'Theme default',how:'',test:always},
  {id:'bevel',name:'Classic Bevel',style:'bevel',how:'Unlocked from the start',test:always},
  {id:'flat',name:'Flat',style:'flat',how:'Unlocked from the start',test:always},
  {id:'glass',name:'Glass',style:'glass',how:'Clear 50 lines in total',test:function(){return S.stats.lines>=50;}},
  {id:'pixel',name:'Pixel',style:'pixel',how:'Play 10 games',test:function(){return S.stats.games>=10;}},
  {id:'neon',name:'Neon Tube',style:'neon',how:'Achievement: Spin Doctor (do a T-Spin)',test:function(){return !!S.ach.tspin;}},
  {id:'candy',name:'Gumdrop',style:'candy',how:'Finish both tutorial lessons',test:function(){return tutDone()>=LESSONS.length;}},
  {id:'wire',name:'Wireframe',style:'wire',how:'Achievement: Back to Back',test:function(){return !!S.ach.b2b;}},
  {id:'brick',name:'Toy Brick',style:'brick',how:'Solve 10 puzzles',test:function(){return pzSolvedCount()>=10;}},
  {id:'gem',name:'Gemstone',style:'gem',how:'Reach Gold rank in any mode',test:function(){return !!S.ach.rk_gold;}},
  {id:'stone',name:'Stone',style:'stone',how:'Defeat 10 bosses',test:function(){return S.stats.bosses>=10;}},
  {id:'jelly',name:'Jelly',style:'jelly',how:'Earn 60 puzzle stars',test:function(){return pzStars()>=60;}},
  {id:'chrome',name:'Chrome',style:'chrome',how:'Reach Platinum rank in any mode',test:function(){return !!S.ach.rk_plat;}}
];
// stage backgrounds: animated scenes behind the board ('auto' = the colour theme's floating blocks)
var BGS=[
  {id:'auto',name:'Theme default',how:'',test:always},
  {id:'stars',name:'Starfield',how:'Unlocked from the start',test:always},
  {id:'ocean',name:'Deep Sea',how:'Solve 5 puzzles',test:function(){return pzSolvedCount()>=5;}},
  {id:'city',name:'Night City',how:'Play a Daily Challenge',test:function(){return !!S.ach.daily1;}},
  {id:'aurora',name:'Aurora',how:'Reach Silver rank in any mode',test:function(){return !!S.ach.rk_silver;}},
  {id:'snow',name:'Snowfall',how:'Achievement: Pack Leader (solve a whole puzzle pack)',test:function(){return !!S.ach.pzpack;}},
  {id:'lava',name:'Lava Lamp',how:'Reach Floor 10 in a Surge Run',test:function(){return S.stats.bestFloor>=10;}},
  {id:'rain',name:'Code Rain',how:'Achievement: Perfectionist (3 stars on 10 puzzles)',test:function(){return !!S.ach.pz3s;}},
  {id:'synth',name:'Synthwave',how:'Reach Diamond rank in any mode',test:function(){return !!S.ach.rk_dia;}}
];
var SKIN_BY={},BG_BY={};SKINS.forEach(function(k){SKIN_BY[k.id]=k;});BGS.forEach(function(b){BG_BY[b.id]=b;});
function skinStyle(th){var k=SKIN_BY[S.set.skin];return (k&&k.style&&k.test())?k.style:th.style;}
function bgId(){var b=BG_BY[S.set.bg];return (b&&b.id!=='auto'&&b.test())?b.id:'auto';}

var sprCache={};
var curStyle='bevel'; // block skin in use, refreshed once per frame (skin unlock tests are too slow for every cell)
function spr(th,id,s){
  var st=curStyle,k=th.id+'|'+st+'|'+id+'|'+s;
  if(sprCache[k])return sprCache[k];
  var cv2=document.createElement('canvas');cv2.width=cv2.height=s;
  var g=cv2.getContext('2d'),col=th.cols[id]||'#888';
  drawBlockStyle(g,st,col,0,0,s);
  sprCache[k]=cv2;return cv2;
}
function drawBlockStyle(g,style,col,x,y,s){
  var b=Math.max(1,Math.round(s*.14)),i;
  g.save();g.translate(x,y);
  if(style==='bevel'){
    g.fillStyle=col;g.fillRect(0,0,s,s);
    g.fillStyle='rgba(255,255,255,.42)';g.beginPath();g.moveTo(0,0);g.lineTo(s,0);g.lineTo(s-b,b);g.lineTo(b,b);g.lineTo(b,s-b);g.lineTo(0,s);g.closePath();g.fill();
    g.fillStyle='rgba(0,0,0,.34)';g.beginPath();g.moveTo(s,s);g.lineTo(0,s);g.lineTo(b,s-b);g.lineTo(s-b,s-b);g.lineTo(s-b,b);g.lineTo(s,0);g.closePath();g.fill();
    var gr=g.createLinearGradient(0,b,0,s-b);gr.addColorStop(0,'rgba(255,255,255,.18)');gr.addColorStop(1,'rgba(0,0,0,.08)');
    g.fillStyle=gr;g.fillRect(b,b,s-2*b,s-2*b);
  }else if(style==='glass'){
    var r=Math.max(2,s*.2);
    rr(g,1,1,s-2,s-2,r);
    var g2=g.createLinearGradient(0,0,0,s);g2.addColorStop(0,shade(col,.45));g2.addColorStop(.5,col);g2.addColorStop(1,shade(col,-.35));
    g.fillStyle=g2;g.fill();
    g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=1;g.stroke();
    rr(g,s*.14,s*.1,s*.72,s*.32,r*.7);g.fillStyle='rgba(255,255,255,.30)';g.fill();
  }else if(style==='neon'){
    g.fillStyle=rgba(col,.16);g.fillRect(1,1,s-2,s-2);
    g.shadowColor=col;g.shadowBlur=s*.28;g.strokeStyle=col;g.lineWidth=Math.max(1.5,s*.09);
    g.strokeRect(s*.14,s*.14,s*.72,s*.72);
    g.shadowBlur=0;g.fillStyle=rgba(col,.55);g.fillRect(s*.34,s*.34,s*.32,s*.32);
  }else if(style==='candy'){
    var cx=s/2,cy=s/2,rad=s/2-1;
    var rg=g.createRadialGradient(cx-s*.15,cy-s*.18,s*.05,cx,cy,rad);rg.addColorStop(0,shade(col,.7));rg.addColorStop(.45,col);rg.addColorStop(1,shade(col,-.4));
    g.fillStyle=rg;g.beginPath();g.arc(cx,cy,rad,0,6.2832);g.fill();
    g.fillStyle='rgba(255,255,255,.65)';g.beginPath();g.arc(cx-s*.17,cy-s*.2,s*.1,0,6.2832);g.fill();
  }else if(style==='pixel'){
    g.fillStyle=shade(col,-.55);g.fillRect(0,0,s,s);
    g.fillStyle=col;g.fillRect(b,b,s-2*b,s-2*b);
    g.fillStyle=shade(col,.45);g.fillRect(b,b,s-2*b,Math.max(1,b));g.fillRect(b,b,Math.max(1,b),s-2*b);
    g.fillStyle=shade(col,-.3);g.fillRect(s*.38,s*.38,s*.24,s*.24);
  }else if(style==='gem'){ // cut gemstone: four bevel facets around a bright table
    var m=Math.max(2,s*.24);
    g.fillStyle=shade(col,.42);g.beginPath();g.moveTo(0,0);g.lineTo(s,0);g.lineTo(s-m,m);g.lineTo(m,m);g.closePath();g.fill();
    g.fillStyle=shade(col,.12);g.beginPath();g.moveTo(0,0);g.lineTo(m,m);g.lineTo(m,s-m);g.lineTo(0,s);g.closePath();g.fill();
    g.fillStyle=shade(col,-.32);g.beginPath();g.moveTo(s,0);g.lineTo(s,s);g.lineTo(s-m,s-m);g.lineTo(s-m,m);g.closePath();g.fill();
    g.fillStyle=shade(col,-.5);g.beginPath();g.moveTo(0,s);g.lineTo(m,s-m);g.lineTo(s-m,s-m);g.lineTo(s,s);g.closePath();g.fill();
    var gg=g.createLinearGradient(m,m,s-m,s-m);gg.addColorStop(0,shade(col,.55));gg.addColorStop(1,col);
    g.fillStyle=gg;g.fillRect(m,m,s-2*m,s-2*m);
    g.fillStyle='rgba(255,255,255,.85)';g.beginPath();var sx=m+s*.12,sy=m+s*.12,sr=Math.max(1,s*.07);
    g.moveTo(sx,sy-sr*1.6);g.lineTo(sx+sr*.5,sy);g.lineTo(sx,sy+sr*1.6);g.lineTo(sx-sr*.5,sy);g.closePath();g.fill();
  }else if(style==='brick'){ // toy brick with a round stud on top
    g.fillStyle=col;g.fillRect(0,0,s,s);
    g.fillStyle='rgba(255,255,255,.30)';g.fillRect(0,0,s,Math.max(1,b*.6));g.fillRect(0,0,Math.max(1,b*.6),s);
    g.fillStyle='rgba(0,0,0,.30)';g.fillRect(0,s-Math.max(1,b*.7),s,Math.max(1,b*.7));g.fillRect(s-Math.max(1,b*.7),0,Math.max(1,b*.7),s);
    var cr=s*.25;
    g.fillStyle='rgba(0,0,0,.28)';g.beginPath();g.arc(s/2+s*.04,s/2+s*.06,cr,0,6.2832);g.fill();
    g.fillStyle=shade(col,.12);g.beginPath();g.arc(s/2,s/2,cr,0,6.2832);g.fill();
    g.strokeStyle='rgba(255,255,255,.55)';g.lineWidth=Math.max(1,s*.05);g.beginPath();g.arc(s/2,s/2,cr*.72,3.4,4.9);g.stroke();
  }else if(style==='wire'){ // glowing wireframe outline
    var lw=Math.max(1.5,s*.1);
    g.fillStyle=rgba(col,.12);g.fillRect(1,1,s-2,s-2);
    g.strokeStyle=col;g.lineWidth=lw;g.strokeRect(lw/2+1,lw/2+1,s-lw-2,s-lw-2);
    g.strokeStyle=rgba(col,.55);g.lineWidth=Math.max(1,s*.04);
    g.beginPath();g.moveTo(lw+2,lw+2);g.lineTo(s-lw-2,s-lw-2);g.moveTo(s-lw-2,lw+2);g.lineTo(lw+2,s-lw-2);g.stroke();
    g.fillStyle='#fff';g.fillRect(s/2-Math.max(1,s*.05),s/2-Math.max(1,s*.05),Math.max(2,s*.1),Math.max(2,s*.1));
  }else if(style==='chrome'){ // polished metal with a sharp reflection band and rivets
    var cg=g.createLinearGradient(0,0,s,s);
    cg.addColorStop(0,shade(col,.75));cg.addColorStop(.38,shade(col,.15));cg.addColorStop(.5,shade(col,-.45));cg.addColorStop(.62,shade(col,.35));cg.addColorStop(1,shade(col,-.2));
    g.fillStyle=cg;g.fillRect(0,0,s,s);
    g.strokeStyle='rgba(0,0,0,.45)';g.lineWidth=1;g.strokeRect(.5,.5,s-1,s-1);
    g.strokeStyle='rgba(255,255,255,.5)';g.strokeRect(1.5,1.5,s-3,s-3);
    g.fillStyle='rgba(30,30,40,.55)';var rv=Math.max(1,s*.055),ro=s*.17;
    [[ro,ro],[s-ro,ro],[ro,s-ro],[s-ro,s-ro]].forEach(function(p){g.beginPath();g.arc(p[0],p[1],rv,0,6.2832);g.fill();});
  }else if(style==='stone'){ // rough stone: speckles and a crack, same pattern every time
    var rs=mulberry32(col.length*977+col.charCodeAt(1)*31+col.charCodeAt(3));
    g.fillStyle=shade(col,-.18);g.fillRect(0,0,s,s);
    for(i=0;i<16;i++){g.fillStyle=rs()<.5?'rgba(255,255,255,.16)':'rgba(0,0,0,.20)';var ps=Math.max(1,s*(.05+rs()*.08));g.fillRect(rs()*(s-ps),rs()*(s-ps),ps,ps);}
    g.strokeStyle='rgba(0,0,0,.38)';g.lineWidth=Math.max(1,s*.04);g.beginPath();
    var cx2=s*(.2+rs()*.3);g.moveTo(cx2,0);g.lineTo(cx2+s*.15,s*.3);g.lineTo(cx2+s*.05,s*.55);g.lineTo(cx2+s*.25,s*.8);g.stroke();
    g.fillStyle='rgba(255,255,255,.22)';g.fillRect(0,0,s,Math.max(1,b*.5));g.fillRect(0,0,Math.max(1,b*.5),s);
    g.fillStyle='rgba(0,0,0,.32)';g.fillRect(0,s-Math.max(1,b*.6),s,Math.max(1,b*.6));g.fillRect(s-Math.max(1,b*.6),0,Math.max(1,b*.6),s);
  }else if(style==='jelly'){ // soft see-through jelly cube with a glossy shine
    var jr=Math.max(2,s*.3);
    rr(g,1,1,s-2,s-2,jr);
    var jg=g.createLinearGradient(0,0,0,s);jg.addColorStop(0,rgba(col,.55));jg.addColorStop(1,rgba(col,.95));
    g.fillStyle=jg;g.fill();
    g.strokeStyle=shade(col,-.35);g.lineWidth=Math.max(1,s*.05);g.stroke();
    g.fillStyle='rgba(255,255,255,.55)';g.beginPath();g.ellipse(s*.38,s*.28,s*.2,s*.09,-.35,0,6.2832);g.fill();
    g.fillStyle='rgba(255,255,255,.35)';g.beginPath();g.arc(s*.72,s*.72,s*.07,0,6.2832);g.fill();
  }else{ // flat
    g.fillStyle=shade(col,-.30);g.fillRect(0,0,s,s);
    g.fillStyle=col;g.fillRect(1,1,s-2,s-2-Math.max(1,b/2));
    g.fillStyle='rgba(255,255,255,.28)';g.fillRect(1,1,s-2,Math.max(1,b));
  }
  g.restore();
}
function rr(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.lineTo(x+w-r,y);g.quadraticCurveTo(x+w,y,x+w,y+r);g.lineTo(x+w,y+h-r);g.quadraticCurveTo(x+w,y+h,x+w-r,y+h);g.lineTo(x+r,y+h);g.quadraticCurveTo(x,y+h,x,y+h-r);g.lineTo(x,y+r);g.quadraticCurveTo(x,y,x+r,y);g.closePath();}

// power-block icons (drawn live so they can pulse)
function drawPower(g,p,x,y,s,t){
  var cx=x+s/2,cy=y+s/2,pu=.5+.5*Math.sin(t/180+p);
  g.save();
  g.fillStyle='rgba(8,10,30,'+(.38+.12*pu)+')';g.fillRect(x+s*.1,y+s*.1,s*.8,s*.8);
  g.lineWidth=Math.max(1.5,s*.07);g.lineCap='round';g.lineJoin='round';
  if(p===1){ // bomb
    g.fillStyle='#22262e';g.beginPath();g.arc(cx,cy+s*.05,s*.26,0,6.2832);g.fill();
    g.strokeStyle='#ff9a3a';g.beginPath();g.arc(cx,cy+s*.05,s*.26,0,6.2832);g.stroke();
    g.fillStyle='rgba(255,255,255,.55)';g.beginPath();g.arc(cx-s*.09,cy-s*.04,s*.06,0,6.2832);g.fill();
    g.strokeStyle='#d9c27a';g.beginPath();g.moveTo(cx+s*.1,cy-s*.15);g.quadraticCurveTo(cx+s*.2,cy-s*.28,cx+s*.28,cy-s*.28);g.stroke();
    g.fillStyle=pu>.5?'#fff27a':'#ff6a2a';g.beginPath();g.arc(cx+s*.3,cy-s*.3,s*(.07+.05*pu),0,6.2832);g.fill();
  }else if(p===2){ // laser
    g.strokeStyle='#8ff4ff';g.shadowColor='#3ae0ff';g.shadowBlur=s*.3*pu+2;
    g.beginPath();g.moveTo(cx,y+s*.18);g.lineTo(cx,y+s*.82);g.stroke();
    g.beginPath();g.moveTo(cx-s*.16,y+s*.34);g.lineTo(cx,y+s*.18);g.lineTo(cx+s*.16,y+s*.34);g.stroke();
    g.beginPath();g.moveTo(cx-s*.16,y+s*.66);g.lineTo(cx,y+s*.82);g.lineTo(cx+s*.16,y+s*.66);g.stroke();
  }else if(p===3){ // frost
    g.strokeStyle='#e6fbff';g.shadowColor='#7fe6ff';g.shadowBlur=s*.25*pu+1;
    for(var i=0;i<3;i++){var a=i*1.0472;var dx=Math.cos(a)*s*.28,dy=Math.sin(a)*s*.28;g.beginPath();g.moveTo(cx-dx,cy-dy);g.lineTo(cx+dx,cy+dy);g.stroke();}
    g.lineWidth=Math.max(1,s*.04);
    for(var j=0;j<6;j++){var b=j*1.0472;var ex=cx+Math.cos(b)*s*.2,ey=cy+Math.sin(b)*s*.2;g.beginPath();g.moveTo(ex+Math.cos(b+1.9)*s*.08,ey+Math.sin(b+1.9)*s*.08);g.lineTo(ex,ey);g.lineTo(ex+Math.cos(b-1.9)*s*.08,ey+Math.sin(b-1.9)*s*.08);g.stroke();}
  }else if(p===4){ // quake
    g.strokeStyle='#ffc46b';
    g.beginPath();g.moveTo(x+s*.18,cy-s*.1);g.lineTo(x+s*.34,cy+s*.12);g.lineTo(x+s*.5,cy-s*.12);g.lineTo(x+s*.66,cy+s*.12);g.lineTo(x+s*.82,cy-s*.1);g.stroke();
    g.beginPath();g.moveTo(cx,y+s*.64+s*.04*pu);g.lineTo(cx,y+s*.84);g.moveTo(cx-s*.1,y+s*.76);g.lineTo(cx,y+s*.86);g.lineTo(cx+s*.1,y+s*.76);g.stroke();
  }else if(p===5){ // gold coin
    g.fillStyle='#ffd23a';g.beginPath();g.arc(cx,cy,s*.27,0,6.2832);g.fill();
    g.strokeStyle='#b8860b';g.beginPath();g.arc(cx,cy,s*.27,0,6.2832);g.stroke();
    g.fillStyle='#8a5a00';g.font='bold '+Math.round(s*.34)+'px Arial,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('$',cx,cy+s*.02);
    g.fillStyle='rgba(255,255,255,'+(.3+.5*pu)+')';g.beginPath();g.arc(cx-s*.12,cy-s*.14,s*.05,0,6.2832);g.fill();
  }
  g.restore();
}

