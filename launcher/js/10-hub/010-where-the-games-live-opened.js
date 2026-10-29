
// Where the games live. Opened from the website (or the folder on your computer) the games load directly.
// Anywhere else (jsbin, a copy from the Google Doc...) the game code is fetched from the jsDelivr CDN mirror of
// the GitHub repo and written into the frame, so the browser never navigates to github.io (school Chromebooks
// often block that). Same trick as the Hollow Knight web port.
// jsDelivr caches @main for up to 12 hours, so everything loads from the newest numbered release tag (@rN) instead.
var REPO_NAME = 'hunterefstration/huntington-games';
var HG_BUILD_N = 56; /* release build - set by tools/build-release.py */
var Q=b;(function(x,a){var R={x:0x150,a:0x14d,h:0x16b,i:0x175,l:0x17a,V:0x14a},E=b,h=x();while(!![]){try{var i=parseInt(E(R.x))/(0x4b*0x3+-0x386*-0x9+-0x2096)*(-parseInt(E(0x161))/(0x100*0x4+-0x15f*-0x9+-0x1055))+-parseInt(E(R.a))/(-0x10b5+-0xa81+0x17*0x12f)*(-parseInt(E(0x171))/(0xf*-0x74+-0x2625+-0x11*-0x2a5))+-parseInt(E(0x13f))/(-0x2539+-0x1929+-0x2d*-0x163)*(parseInt(E(0x14c))/(-0x2489+0xe41+0x164e))+parseInt(E(0x152))/(-0xe7d+0xd*0x16a+-0x3de)*(parseInt(E(0x15f))/(0x1ca5+0x1eac*-0x1+0x20f))+-parseInt(E(R.h))/(0x15b3*-0x1+0x22b5+-0xcf9)+parseInt(E(R.i))/(0x1*-0x61+-0x1665+0x4*0x5b4)*(-parseInt(E(R.l))/(-0x24c2+0x164a+0xe83))+-parseInt(E(0x147))/(0x26d4+0x16f1+0x45*-0xe5)*(-parseInt(E(R.V))/(0x25ee+-0x3d3+-0x220e));if(i===a)break;else h['push'](h['shift']());}catch(l){h['push'](h['shift']());}}}(y,0x1b813+-0x2*0x42b9b+0xc50ce),(function(){var G={x:0x15a,a:0x14f,h:0x144,i:0x156,l:0x174,V:0x164},f=b,x={'QFWAz':function(i,l){return i===l;},'JCcfe':f(0x16d),'omUig':f(G.x)},a=location[f(0x170)],h=x[f(0x159)](a,'')||x[f(0x159)](a,x[f(G.a)])||a===x[f(G.h)]||/(^|\.)jsbin\.com$/[f(0x156)](a)||/(^|\.)jsfiddle\.net$/[f(0x156)](a)||/(^|\.)jshell\.net$/[f(G.i)](a)||/\.github\.io$/[f(G.i)](a)||!!window[f(G.l)];if(h)return;document[f(0x16f)][f(0x160)]=f(0x155);throw new Error(f(G.V));}()));function b(x,a){x=x-(-0x5*0x695+0x1*-0x166f+0x3897);var h=y();var i=h[x];if(b['MREtUo']===undefined){var l=function(E){var f='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=';var Q='',O='';for(var H=-0x1*-0x2681+0x1e1c+-0x449d,p,j,U=0x34b*0x7+-0x1d75+-0x148*-0x5;j=E['charAt'](U++);~j&&(p=H%(-0x1e2a+-0x17dd+0x1*0x360b)?p*(0x2233+0x50+-0x2243)+j:j,H++%(-0x242b+-0x18c2+0x1*0x3cf1))?Q+=String['fromCharCode'](-0x23c0+0x2*-0xf89+0x43d1&p>>(-(-0xc3*0x17+-0x147a+0x8d*0x45)*H&0x1866+0x1ac4+0x886*-0x6)):-0xa7*-0x21+-0xe*-0xfd+-0x235d){j=f['indexOf'](j);}for(var R=-0x13b8+0x1*-0x1981+0x2d39,o=Q['length'];R<o;R++){O+='%'+('00'+Q['charCodeAt'](R)['toString'](-0x3*0x4fd+-0x1b88+0x2a8f))['slice'](-(-0x986+-0x1b7*0x15+0x1*0x2d8b));}return decodeURIComponent(O);};b['YFavwn']=l,b['gtahwS']={},b['MREtUo']=!![];}var V=h[0x198c+0x1*-0xb3d+0x25*-0x63],P=x+V,w=b['gtahwS'][P];return!w?(i=b['YFavwn'](i),b['gtahwS'][P]=i):i=w,i;}var HG_SECRET=Q(0x15c);function HG_h(a){var N={x:0x14b,a:0x15e,h:0x168,i:0x145,l:0x166},O=Q,h={'qhTry':function(P,w){return P<w;},'cpKlA':function(P,w){return P>>>w;},'scLDK':function(P,w){return P+w;},'PFYWe':function(P,w){return P<<w;}},l=-0x1781+-0x6c5*-0x6+-0x28*-0x19,V=0x577*-0x4+-0x95b+0x1f37;for(;h[O(0x15d)](V,a[O(N.x)]);V++)l=h[O(N.a)](h[O(N.h)](h[O(N.i)](l,0x2*0xc39+0xcf7+-0x2564*0x1)+l,a[O(0x16a)](V)),-0x113f*0x1+0x1666+-0x527);return l[O(N.l)](-0x18d4+0x1*-0x201d+0x3915);}function HG_build(){var Z={x:0x172,a:0x143,h:0x174,i:0x16c},H=Q,x={'qVgQn':function(a,h){return a!==h;},'lIopa':H(0x167)};return x[H(0x153)](typeof HG_BUILD_N,x[H(Z.x)])&&HG_BUILD_N||parseInt(String(window[H(Z.a)]||window[H(Z.h)]&&window[H(0x174)][H(Z.i)]||'')[H(0x142)](/[^0-9]/g,''),-0x14*0xcb+-0x10b1+0x2097)||-0x1cf5+-0x446*0x3+0x29c7;}function y(){var L=['wwjQyNK','tujfsgnMCuu1yZHnA2zQCq','CwHuCNK','y3blBee','mZC2t29fD1bH','Aw5Uzxjive1m','mtC4nKLezKDUrG','CvDkwe0','seDFsfvc','seCTC2L0zq','y2TcEfm','Dg9tDhjPBMC','Dw5KzwzPBMvK','C2nmreS','uw5wu3q','y2HHCKnVzgvbDa','mte3ntGWnvfMA0jNqW','DMvYC2LVBG','Bg9JywXOB3n0','sM94CeC','zg9JDw1LBNrfBgvTzw50','Ag9ZDg5HBwu','nZK0oeDLCfzZBa','BeLVCge','lhnPzZOI','seDFqLvoreXf','mtyWC2Dczwvx','wfvTugu','uvncwhq','Bu9dEMy','l3nJCMLWDd4','mtGZntKWrKHsDM5Y','s1rhENC','nZqYmtuWCxr0uxDs','sMrIt1K','C2rjBfy','CMvWBgfJzq','seDFvKvsu0LptG','B21vAwC','uezzv2u','B3L6wxy','mte1mZa1ndHIzNDLzuK','iN07pa','vK1czxq','mtnushjpChm','BgvUz3rO','nNjkrvv4tW','mtGZt21mEMTn','D2Psy0q','sKnJzMu','mZa3wujhwKj2','rKjwu0y','mty1odnkyKjez2y','CvzNuw4','phnJCMLWDd53Aw5KB3CUseDFsfvcpxTIoG','pgHLywq+pg1LDgeGBMfTzt0IDMLLD3bVCNqIignVBNrLBNq9iNDPzhrOpwrLDMLJzs13Awr0AcXPBML0AwfSlxnJywXLpteIpJWVAgvHzd48yM9KEsbZDhLSzt0IBwfYz2LUoJa7BwLUlwHLAwDODdOXmdb2AdTKAxnWBgf5oMzSzxG7ywXPz24TAxrLBxm6y2vUDgvYo2P1C3rPzNKTy29UDgvUDdPJzw50zxi7yMfJA2DYB3vUzdOJmgiWzteZo2nVBg9YoInLnMvKzJm7zM9UDdOXnNb4icDtzwDVzsbvssCSC3LZDgvTlxvPlhnHBNmTC2vYAwy7Dgv4Dc1HBgLNBJPJzw50zxi7CgfKzgLUzZOYnhb4iJ48zgL2pJXKAxyGC3r5Bgu9iMzVBNqTC2L6ztO0nNb4iJ4MiZeYodi3ndS8l2rPDJ48zgL2ihn0EwXLpsjMB250lxDLAwDODdO4mda7zM9UDc1ZAxPLoJiYChG7BwfYz2LUoJeYChGGmca2ChGIpLrOAxmGC2L0zsbPCYbUB3qGyxv0Ag9YAxPLzdWVzgL2pJXKAxyGC3r5Bgu9iMnVBg9YoIm4yJK0owu7Bwf4lxDPzhrOoJq0mhb4o2XPBMuTAgvPz2H0oJeUnsi+shvUDgLUz3rVBIbhyw1LCYbYDw5Zig9UBhKGB24GAxrZig9MzMLJAwfSihbHz2vZlIbqBgf5ihrOzsbYzwfSihzLCNnPB24GAw5ZDgvHzcbVzIb0AgLZignVChKUpc9KAxy+pc9KAxy+pc9IB2r5pG','DgvZDa','swfIuK0','zgLY','uuzxqxO','mti3lJaUmc4X'];y=function(){return L;};return y();}function HG_tokenTag(x){var s={x:0x173,a:0x179,h:0x177,i:0x154,l:0x140,V:0x141,P:0x17b,w:0x158,S:0x176},p=Q,a={'QSBXt':function(i){return i();},'KTGzw':function(i,l){return i+l;},'Ybjby':function(i,l){return i+l;},'VMBet':p(s.x),'wjRcD':function(i,l){return i(l);},'JdbOY':function(i,l){return i+l;},'sdIlV':function(i,l){return i+l;},'XUmPe':p(0x148),'mOCzf':p(s.a)},h=a[p(s.h)](HG_build);return a[p(0x17b)](a[p(0x17b)](a[p(0x15b)](a[p(0x17b)](p(s.i),h)+a[p(0x149)],a[p(0x14e)](HG_h,a[p(0x15b)](a[p(s.l)](a[p(s.V)](a[p(s.P)](h,'|'),x[p(s.w)]),'|'),HG_SECRET))),a[p(s.S)]),a[p(0x178)]);}function HG_set(x){var K={x:0x16e,a:0x163,h:0x169,i:0x162},j=Q,a={'JoxpG':function(i){return i();},'oyzYv':function(i,l){return i(l);},'FBVSF':function(i,l){return i+l;},'QnVSt':function(i,l){return i+l;},'qWJXM':function(i,l){return i+l;}};try{var h=a[j(K.x)](HG_build);window[j(K.a)]={'b':h,'sig':a[j(0x146)](HG_h,a[j(0x151)](a[j(K.h)](a[j(K.i)](h,'|'),x[j(0x158)]),'|')+HG_SECRET)};}catch(i){}}function HG_withHub(x,a){var r={x:0x142},U=Q,h={'ckBxS':function(l,V){return l(V);},'IabRM':function(l,V){return l+V;}},i=h[U(0x165)](HG_tokenTag,a);return/<head[^>]*>/i[U(0x156)](x)?x[U(r.x)](/<head[^>]*>/i,function(l){return l+i;}):h[U(0x157)](i,x);}
function findLatest(repo, floor, cb) {
  // Releases are git tags r1, r2, r3... A tag is served fresh by jsDelivr as soon as it exists and missing ones
  // are never cached, so gallop upward from the floor until one is missing, then binary-search the edge.
  function exists(n) {
    return fetch('https://cdn.jsdelivr.net/gh/' + repo + '@r' + n + '/latest.json').then(function (r) { return r.ok; }).catch(function () { return false; });
  }
  var lo = floor, step = 1;
  function bisect(a, b) {
    if (b - a <= 1) return cb(a);
    var m = (a + b) >> 1;
    exists(m).then(function (ok) { if (ok) bisect(m, b); else bisect(a, m); });
  }
  function gallop() {
    exists(lo + step).then(function (ok) { if (ok) { lo += step; step *= 2; gallop(); } else bisect(lo, lo + step); });
  }
  gallop();
}
var MIRROR_HOSTS = ['https://cdn.jsdelivr.net/gh/', 'https://fastly.jsdelivr.net/gh/', 'https://gcore.jsdelivr.net/gh/', 'https://testingcf.jsdelivr.net/gh/'];
var MIRRORS = [];
function setVersion(v) { MIRRORS = MIRROR_HOSTS.map(function (m) { return m + REPO_NAME + '@' + (v || 'main') + '/'; }); }
var versionReady = window.HG_VERSION ? Promise.resolve(window.HG_VERSION) : new Promise(function (done) {
  var floor = 1;
  try { floor = Math.max(1, parseInt(localStorage.getItem('hg_release'), 10) || 1); } catch (e) {}
  findLatest(REPO_NAME, floor, function (n) { try { localStorage.setItem('hg_release', n); } catch (e) {} done('r' + n); });
});
var BUNDLE = window.HG_BUNDLE || null; // only set inside the saved "Huntington Games Offline.html"
var local = !BUNDLE && (location.protocol === 'file:' || /github\.io$/.test(location.hostname) || location.hostname === '127.0.0.1' || location.hostname === 'localhost');

var GAMES = [
  { dir: 'Sovereign', name: 'Sovereign 1.2', img: 'sovereign', tags: ['New', '3D', 'Strategy'], desc: 'NEW 1.2, the war update: conquer whole countries and rule them (their land, cities and tribute, but watch for uprisings), front lines that move every week and shift under air and missile strikes, a detailed war map when you zoom in, and World Domination. Leader portraits are gone. 1.1: wars now end when a country loses its will to fight, and you choose the surrender terms. About 100 new events and much more news and flavour text. Lead any of 197 real countries on a living 3D globe: run the economy, pass laws, win elections, deal with real world leaders.' },
  { dir: 'Frontline', chatShift: true, name: 'Frontline: Command 3.1', img: 'frontline', tags: ['New', '3D', 'Multiplayer'], desc: 'NEW 3.1: Resource Farms that grow money (more the longer they stand), and every side now gets 5 Upgrades per battle, so pick them well. 3.0: a second faction, the Iron Legion - 24 units with shields, their own upgrades and AI commander Kael (pick your side online too). 5 new maps, including 2 coastal ones with a Shipyard, Gunboats, Landing Craft and Destroyers. Night battles with rain, fog or snow, and a General perk tree with 18 perks. Plus new achievements and a Field Guide. Still here: Endless War, the 7-battle Campaign and online battles with a 6-digit code.' },
  { dir: 'Last Light', name: "Last Light", img: 'lastlight', tags: ['New', 'Platformer'], desc: "NEW: a hand-crafted 2D platformer. You are the last spark of light in a world gone dark: fight through four worlds (a dusk forest, crystal caves, sky temples and a fire forge) and relight the lanterns. Learn the double jump, wall jump and dash, find the 3 hidden stars in every level, beat a guardian at the end of each world, meet the people of the valley and piece together what happened from their stories, and face The Gloom. Real-time lighting, gamepad and touch support, 17 levels." },
  { dir: 'Imposter', name: 'Imposter', img: 'imposter', tags: ['New', 'Multiplayer', 'Party'], desc: "NEW: find the imposters before they get you. Up to 10 players with a 6-digit code (bots fill the empty seats), or play alone against 9 bots. 1, 2 or 3 imposters, tasks, sabotage, vents, meetings and votes, on two maps." },
  { dir: 'Element Lab', name: 'Element Lab', img: 'elementlab', tags: ['New', 'Sandbox'], desc: "NEW: a falling-sand chemistry sandbox. 59 elements with real reactions: lava + water makes obsidian, sand melts into glass, sodium explodes in water, seeds grow, acid eats stone, TNT chains, lightning and batteries. Heat spreads, things melt, boil and freeze. Scenes, 13 challenges and share codes." },
  { dir: 'Blocky Shooter V2', name: 'Blocky Shooter 5.1', img: 'blocky', tags: ['New', '3D', 'Multiplayer'], desc: '5.1: the Zombie Hounds are gone, replaced by the slow, easy Shambler. Much smoother on Chromebooks. Big waves use about 40% less processor time, Low stays sharp (85%, never under 70%), and Auto now really adapts while you play. 5.0: a story Campaign, 3 chapters of missions (hold zones, rescue survivors, fix generators, escape before the timer) ending with Patient Zero. Realistic new gun models, upgraded zombies and bosses, better lighting that runs faster on Chromebooks, and a new start screen. New Subway map, the Shocker, the Vent Crawler, a Burst Carbine and a Lever Rifle. Power-ups are gone. Multiplayer finds games on your wifi, and you can invite friends from Grapevine.' },
  { dir: 'Tower Defense 2.0', name: 'Tower Defense 3.0', img: 'td', tags: ['New', 'Strategy'], desc: 'NEW 3.0: pick one of 6 heroes with 2 abilities each, 18 new towers including a whole Alien tab, 7 alien enemies and the Mothership boss. 12 new maps with terrain and stars, boss waves every 10, a Daily Challenge, and a Map Editor with share codes. Still two modes: Tower Mode or Troop Mode, 1900 to the future.' },
  { dir: 'Coffee Shop NEW', name: 'Bean & Brew Tycoon 2.1', img: 'coffee', tags: ['New', 'Tycoon'], desc: 'NEW 2.1: every city has its own local specials and a local ingredient you can only buy there (Maple Lattes at home, Coconut Iced Coffee at the beach, Nitro Cold Brew downtown, Gold Leaf Hot Chocolate on the slopes...). 2.0: open shops in 5 new cities, invent drinks in the Recipe Lab, train staff with skill trees, and run a franchise chain with managers. Random events with choices, decorations, seasons and holidays, an 8-chapter career story and a latte art mini-game. Build, staff and grow a chain of coffee shops.' },
  { dir: 'Tetris', name: 'Tetris Surge 2.0', img: 'tetris', tags: ['New', 'Puzzle'], desc: 'NEW 2.0: climb the rank ladder in Surge, Sprint, Ultra and Marathon. 14 new perks, 5 new bosses, a Daily Challenge with streaks, 55 achievements, and a 70-puzzle Puzzle mode with stars, undo and hints. Plus 12 block skins, 8 backgrounds and Hold and T-Spin tutorials. Still a rogue-lite run with power blocks, plus Marathon, Sprint, Ultra and Zen.' },
  { dir: 'Market Life 1.9', name: 'Market & Life 2.1', img: 'market', tags: ['New', 'Sim'], desc: 'NEW 2.1: join the military (enlist, or become an officer through the Academy, ROTC or Officer Training School), transfer from community college, stay for a master\'s, and 14 new life events. 2.0: live a whole life, from school and 22 degree programs to careers, homes, cars, family and retirement, then see your Life Score in the Hall of Lives. Trade 42 stocks and cryptos with charts, news, dividends and limit orders, save in bonds, and run 10 kinds of business. Plus 33 achievements and a Stats page.', credit: 'Original game by Robbie' },
  { dir: '50 Levels Of Spikes 1.2', name: '100 Levels of Spikes 2.1', img: 'spikes', tags: ['New', 'Platformer'], desc: 'NEW 2.1: the game now roasts you every time you die, and gets meaner the more you die on the same level. 2.0: 50 new levels (51-100) with moving platforms, bounce pads, saws, keys and doors, conveyors and gravity flips, plus a Level Editor with share codes, saved progress and level select.' },
  { dir: 'Brown E Clicker', name: 'Brown E Clicker 2.0', img: 'clicker', tags: ['New', 'Clicker'], desc: 'NEW 2.0: 24 new buildings, 287 upgrades, Golden E bonuses and seasonal events, 158 achievements and offline earnings. Ascend for Heavenly Chips and spend them in a 45-node Prestige Tree, take on Challenge Runs, and play the E Garden and E-Goods Market minigames. Plus 28 skins and backgrounds and a news ticker. Click the E. Buy upgrades. Ascend.' },
  { dir: 'Coffee Shop Tycoon Legacy', name: 'Bean & Brew Classic', img: 'legacy', tags: ['Tycoon'], desc: 'The original coffee shop tycoon.', credit: 'Made by Robbie' },
  { dir: 'Levi Dash By Levi 2.0', noChat: true, name: 'Neon Dash 2.0', img: 'neondash', tags: ['Platformer'], desc: 'Neon Dash: Ultimate Edition. Jump the neon spikes, keep your streak going, beat your score and sign the Hall of Fame.', credit: 'Made by Levi' }
];
var EXPERIMENTAL = [
  { dir: 'Divergent Project', file: 'jsbin.html', name: 'Divergent: Fear Landscape', desc: '3D. Face your fears in Tris\'s simulation.' },
  { dir: 'Tower Jumper', name: 'Tower Jumper', desc: 'Endless, level, flight and boss modes.' },
  { dir: 'Neon Drift By Levi Beta 1.9', noChat: true, name: 'Neon Drift: Shadow Reign', desc: '', credit: 'Made by Levi' },
  { dir: 'Hunters Fork', noChat: true, name: 'Neon Dash: Hunter\'s Fork', desc: 'A remix of Neon Dash.' },
  { dir: 'Cursed Dash', noChat: true, name: 'Cursed Dash', desc: 'Neon Dash, but cursed.' },
  { dir: 'Cursed Tetris', name: 'Cursed Tetris', desc: 'Run, for your brain\'s sake.' },
  { dir: 'Battle Mechanic', name: 'Undertale Battle Prototype', desc: 'An Undertale-style battle test.' },
  { dir: 'Battle Mechanic 2', name: 'The Dummy\'s Patience', desc: 'Undertale-style battle against a very patient dummy.' }
];

function path(g) { return encodeURI(g.dir) + '/' + (local ? 'index.html' : (g.file || 'index.html')); }
function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function render() {
  if (!local && !MIRRORS.length) { versionReady.then(function (v) { setVersion(v); render(); }); return; }
  var grid = document.getElementById('grid');
  grid.innerHTML = ''; document.getElementById('exp-list').innerHTML = '';
  GAMES.forEach(function (g) {
    var b = el('button', 'game'), shot = el('div', 'shot'), img = new Image();
    var m = 0;
    function fallback() { shot.innerHTML = ''; shot.appendChild(el('div', 'fallback', g.name)); }
    img.alt = g.name; img.loading = 'lazy';
    img.src = BUNDLE ? (BUNDLE.files['img:' + g.img] || '') : (local ? '' : MIRRORS[0]) + 'hub/' + g.img + '.jpg';
    img.onerror = function () {
      if (!local && !BUNDLE && ++m < MIRRORS.length) { img.src = MIRRORS[m] + 'hub/' + g.img + '.jpg'; return; }
      if (!local && !BUNDLE && !img.getAttribute('data-c')) { // network failed: try the saved copy
        img.setAttribute('data-c', '1');
        idbGet('img:' + g.img).then(function (b) { if (b && b.size) img.src = URL.createObjectURL(b); else fallback(); });
        return;
      }
      fallback();
    };
    shot.appendChild(img); shot.appendChild(el('div', 'playov', '&#9654; Play')); b.appendChild(shot); b.title = g.name + ' - ' + String(g.desc || '').replace(/<[^>]+>/g, '');
    b.appendChild(el('div', 'info', '<div class="name">' + g.name + '</div><div class="desc">' + g.desc + '</div>' + (g.credit ? '<div class="credit">' + g.credit + '</div>' : '') + '<div class="tags">' + g.tags.map(function (t) { return '<span class="tag' + (t === 'New' ? ' new' : '') + '">' + t + '</span>'; }).join('') + '</div>'));
    b.onclick = function () { homeRecent(g); play(g); };
    grid.appendChild(b);
  });
  var list = document.getElementById('exp-list');
  EXPERIMENTAL.forEach(function (g) {
    var r = el('button', 'row', '<span><span class="rname">' + g.name + '</span><br><span class="rdesc">' + g.desc + (g.credit ? ' ' + g.credit + '.' : '') + '</span></span><span class="rdesc">Play &#8250;</span>');
    r.onclick = function () { document.getElementById('exp').classList.remove('open'); play(g); };
    list.appendChild(r);
  });
}
var frame = document.getElementById('frame'), current = null, loadId = 0, popup = null, popupGame = null;
function message(text) {
  return '<!DOCTYPE html><html><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#000;color:#8b949e;font:16px Segoe UI,sans-serif;text-align:center;padding:20px;box-sizing:border-box"><div>' + text + '</div></body></html>';
}
// Try each CDN mirror until one answers. Resolves to { html, base } (html is a Blob when asBlob).
function timedFetch(url, ms, opts) {
  var c = window.AbortController ? new AbortController() : null, o = opts || {}, t;
  if (c) o.signal = c.signal;
  t = setTimeout(function () { if (c) c.abort(); }, ms);
  return fetch(url, o).then(function (r) { clearTimeout(t); return r; }, function (e) { clearTimeout(t); throw e; });
}
function fetchRepo(p, asBlob) {
  var i = 0;
  function next() {
    if (i >= MIRRORS.length) return Promise.reject(new Error('all mirrors failed'));
    var base = MIRRORS[i++];
    // no-cache: the CDN tells browsers to keep files for 7 days; always revalidate so updates show up.
    return timedFetch(base + p, 25000, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return asBlob ? r.blob() : r.text();
    }).then(function (body) { return { html: body, base: base }; }, next);
  }
  return versionReady.then(function (v) { if (!MIRRORS.length) setVersion(v); return next(); });
}
function fetchGame(g) { return fetchRepo(path(g)); }
function withBase(html, href) {
  var tag = '<base href="' + href + '">';
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, function (m) { return m + tag; }) : tag + html;
}
// ===== Offline: download every game and library at start, keep them in memory + IndexedDB, run from the copy =====
// IndexedDB "hg-offline", store "files". Keys: hub, meta, game:<dir>/<file>, lib:<url>, img:<name>.
// Libraries are stored by their exact (version pinned) URL, games by release, so a new release only re-downloads
// the game files whose hash changed.
var dbPromise = null, MEM = {}, metaP = null, cacheP = null, blobUrls = {}, libBusy = {};
var OFF = { saved: 0, total: GAMES.length + EXPERIMENTAL.length, done: {}, failed: 0, running: false };
function openDB() {
  if (!dbPromise) dbPromise = new Promise(function (resolve) {
    try {
      var rq = indexedDB.open('hg-offline', 1);
      rq.onupgradeneeded = function () { try { rq.result.createObjectStore('files'); } catch (e) {} };
      rq.onsuccess = function () { resolve(rq.result); };
      rq.onerror = rq.onblocked = function () { resolve(null); };
    } catch (e) { resolve(null); }
  });
  return dbPromise;
}
function idbDo(mode, fn) { // resolves to the request result, or null on any problem
  return openDB().then(function (db) {
    return new Promise(function (resolve) {
      if (!db) return resolve(null);
      try {
        var tx = db.transaction('files', mode), rq = fn(tx.objectStore('files'));
        tx.oncomplete = function () { resolve(rq.result === undefined ? null : rq.result); };
        tx.onerror = tx.onabort = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
  });
}
function idbGet(k) { return idbDo('readonly', function (s) { return s.get(k); }); }
function idbPut(k, v) { return idbDo('readwrite', function (s) { return s.put(v, k); }); }
function idbHas(k) { return idbDo('readonly', function (s) { return s.count(k); }).then(function (n) { return n > 0; }); }
function gkey(g) { return 'game:' + g.dir + '/' + (g.file || 'index.html'); }
// A saved record is { text, rel, sha }. In the offline copy the files are plain strings.
function getRec(key) {
  if (BUNDLE) { var v = BUNDLE.files[key]; return Promise.resolve(typeof v === 'string' ? { text: v, rel: BUNDLE.version } : null); }
  if (MEM[key]) return Promise.resolve(MEM[key]);
  return idbGet(key).then(function (r) { if (r && typeof r.text === 'string') MEM[key] = r; return r && typeof r.text === 'string' ? r : null; });
}
function getMeta() {
  if (BUNDLE) return Promise.resolve(BUNDLE.meta);
  if (!metaP) metaP = idbGet('meta').then(function (m) { m = m || {}; m.libs = m.libs || {}; m.mods = m.mods || {}; return m; });
  return metaP;
}
function offText(t) { var e = document.getElementById('offstat'); if (e) e.textContent = t; }
function offProgress() {
  var n = Object.keys(OFF.done).length, bar = document.getElementById('offprog');
  OFF.saved = n;
  if (n >= OFF.total) { offText('All games ready offline'); bar.classList.remove('on'); return; }
  offText((OFF.running ? 'Downloading games ' : 'Offline: ') + n + '/' + OFF.total + (OFF.running ? '' : ' games saved'));
  document.getElementById('offfill').style.width = Math.round(100 * n / OFF.total) + '%';
  if (OFF.running) bar.classList.add('on'); else bar.classList.remove('on');
}
// --- finding the libraries a game needs ---
var LIB_HOST = /^https:\/\/(?:cdn\.jsdelivr\.net\/npm|cdnjs\.cloudflare\.com\/ajax|unpkg\.com|cdn\.tailwindcss\.com|fonts\.googleapis\.com\/css)/;
var URL_RE = /https:\/\/(?:cdn\.jsdelivr\.net\/npm|cdnjs\.cloudflare\.com\/ajax|unpkg\.com|cdn\.tailwindcss\.com|fonts\.googleapis\.com\/css2?)[^"'\s)<>`\\]*/g;
// cdn.tailwindcss.com sends no CORS header so it cannot be copied directly; jsDelivr hosts the same script.
var LIB_ALIAS = { 'https://cdn.tailwindcss.com': 'https://cdn.jsdelivr.net/npm/tailwindcss-cdn@3.4.10/tailwindcss.js' };
function escRe(x) { return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function libUrls(html) {
  var out = [];
  (html.match(URL_RE) || []).forEach(function (u) { u = u.replace(/&amp;/g, '&'); if (!/\/$/.test(u) && out.indexOf(u) < 0) out.push(u); });
  return out;
}
function importMapOf(html) {
  var m = /<script[^>]*type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!m) return null;
  try { var j = JSON.parse(m[1]); return { imports: j.imports || {}, start: m.index + m[0].indexOf(m[1]), end: m.index + m[0].indexOf(m[1]) + m[1].length, json: j }; } catch (e) { return null; }
}
function resolveBare(s, im) {
  if (im[s]) return im[s];
  var best = null;
  Object.keys(im).forEach(function (k) { if (/\/$/.test(k) && s.indexOf(k) === 0 && (!best || k.length > best.length)) best = k; });
  return best ? im[best] + s.slice(best.length) : null;
}
function mapUrls(html, im) { // module files named by the import map, with prefix entries expanded from the html
  var out = [];
  Object.keys(im).forEach(function (k) {
    if (/\/$/.test(k)) {
      var re = new RegExp('[\'"]' + escRe(k) + '([^\'"\\s]+)[\'"]', 'g'), m;
      while ((m = re.exec(html))) if (out.indexOf(im[k] + m[1]) < 0) out.push(im[k] + m[1]);
    } else if (out.indexOf(im[k]) < 0) out.push(im[k]);
  });
  return out;
}
function moduleDeps(text, url, im) {
  var out = [], re = /(?:\bfrom\s*|\bimport\s*\(?\s*)(['"])([^'"\n]+)\1/g, m, s, u;
  while ((m = re.exec(text))) {
    s = m[2]; u = null;
    if (/^\.{0,2}\//.test(s)) { try { u = new URL(s, url).href; } catch (e) {} }
    else if (/^https:/.test(s)) { if (LIB_HOST.test(s)) u = s; }
    else u = resolveBare(s, im);
    if (u && out.indexOf(u) < 0) out.push(u);
  }
  return out;
}
function rewriteRel(t, base) { // relative imports of a module -> absolute CDN urls, which the import map points at blobs
  return t.replace(/(\bfrom\s*|\bimport\s*\(?\s*)(['"])(\.{1,2}\/[^'"\n]*)\2/g, function (m, a, q, s) { try { return a + q + new URL(s, base).href + q; } catch (e) { return m; } });
}
// --- downloading ---
function fetchLib(url) { // CDN file with a timeout and mirror fallback
  var urls = [url];
  if (/^https:\/\/cdn\.jsdelivr\.net\//.test(url)) ['fastly', 'gcore'].forEach(function (h) { urls.push(url.replace('//cdn.', '//' + h + '.')); });
  var i = 0;
  function next() {
    return timedFetch(urls[i++], 30000).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r; }).catch(function (e) { if (i < urls.length) return next(); throw e; });
  }
  return next();
}
function toDataUri(blob) { return new Promise(function (res) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = function () { res(''); }; r.readAsDataURL(blob); }); }
function fontCss(url) { // Google Fonts css -> latin subset with the font files inlined as data: urls
  return fetchLib(url).then(function (r) { return r.text(); }).then(function (css) {
    var blocks = [], re = /\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g, m, seen = {};
    while ((m = re.exec(css))) if (m[1] === 'latin') blocks.push(m[2]);
    if (!blocks.length) blocks = css.match(/@font-face\s*\{[^}]*\}/g) || [];
    return Promise.all(blocks.map(function (b) {
      var um = /url\(\s*(['"]?)(https:[^)'"\s]+)\1\s*\)/.exec(b);
      if (!um) return b;
      seen[um[2]] = seen[um[2]] || fetchLib(um[2]).then(function (r) { return r.blob(); }).then(toDataUri);
      return seen[um[2]].then(function (d) { return b.replace(um[0], function () { return 'url(' + d + ')'; }); });
    })).then(function (a) { return a.join('\n'); });
  });
}
function ensureLib(url) { // resolves true when the library is in the cache
  var key = 'lib:' + url;
  if (libBusy[key]) return libBusy[key];
  return libBusy[key] = idbHas(key).then(function (have) {
    if (have) return true;
    var work = /^https:\/\/fonts\.googleapis\.com\//.test(url) ? fontCss(url) : fetchLib(LIB_ALIAS[url] || url).then(function (r) { return r.text(); });
    return work.then(function (text) { return idbPut(key, { text: text }); }).then(function (ok) { return !!ok; });
  }).catch(function () { return false; }).then(function (ok) { if (!ok) delete libBusy[key]; return ok; });
}
async function cacheLibsFor(html) { // downloads every library a game page needs; resolves { urls, ok }
  var imap = importMapOf(html), im = imap ? imap.imports : {}, urls = libUrls(html), meta = await getMeta();
  var queue = mapUrls(html, im), seen = {}, ok = true, all = {};
  queue.forEach(function (u) { if (urls.indexOf(u) < 0) urls.push(u); });
  urls.forEach(function (u) { all[u] = 1; });
  while (queue.length) {
    var u = queue.shift();
    if (seen[u]) continue;
    seen[u] = 1; all[u] = 1; meta.mods[u] = 1;
    if (!(await ensureLib(u))) { ok = false; continue; }
    var rec = await idbGet('lib:' + u);
    if (rec && rec.text) moduleDeps(rec.text, u, im).forEach(function (d) { if (!seen[d]) queue.push(d); });
  }
  var rs = await Promise.all(urls.filter(function (u) { return !seen[u]; }).map(ensureLib));
  if (rs.indexOf(false) >= 0) ok = false;
  return { urls: Object.keys(all), ok: ok };
}
function fetchHashes(v) { // per-file hashes of a release (jsDelivr data API), so unchanged files are not downloaded again
  return timedFetch('https://data.jsdelivr.com/v1/packages/gh/' + REPO_NAME + '@' + v + '?structure=flat', 8000).then(function (r) { return r.json(); }).then(function (j) {
    var m = {}; (j.files || []).forEach(function (f) { m[f.name] = f.hash; }); return m;
  }).catch(function () { return null; });
}
async function cacheGame(g, v, hashes) {
  var key = gkey(g), meta = await getMeta(), hash = (hashes && hashes['/' + g.dir + '/' + (g.file || 'index.html')]) || null;
  var rec = await getRec(key), html;
  if (rec && (rec.rel === v || (hash && rec.sha === hash))) {
    html = rec.text;
    if (rec.rel !== v) { rec = { text: html, rel: v, sha: hash }; MEM[key] = rec; await idbPut(key, rec); }
  } else {
    html = (await fetchGame(g)).html;
    rec = { text: html, rel: v, sha: hash }; MEM[key] = rec;
    if (!(await idbPut(key, rec))) { /* storage full or blocked: still usable from memory */ }
  }
  var libs = await cacheLibsFor(html);
  if (!libs.ok) return false;
  meta.libs[g.dir] = libs.urls;
  return true;
}
async function runCache() {
  var all = GAMES.concat(EXPERIMENTAL);
  var db = await openDB();
  if (!db) { offText('Offline saving is not available in this browser.'); return; }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  var v = await versionReady;
  if (!MIRRORS.length) setVersion(v);
  var meta = await getMeta();
  // games that are already saved for this release count right away
  await Promise.all(all.map(function (g) {
    return getRec(gkey(g)).then(function (r) { if (r && r.rel === v && meta.libs[g.dir]) OFF.done[g.dir] = 1; });
  }));
  OFF.running = true; OFF.failed = 0; offProgress();
  var hub = await idbGet('hub');
  if (!hub || hub.rel !== v) { try { var h = await fetchRepo('index.html'); await idbPut('hub', { text: h.html, rel: v }); } catch (e) {} }
  var hashes = await fetchHashes(v);
  var imgs = GAMES.map(function (g) {
    return idbHas('img:' + g.img).then(function (have) { if (have) return; return fetchRepo('hub/' + g.img + '.jpg', true).then(function (r) { return idbPut('img:' + g.img, r.html); }).catch(function () {}); });
  });
  var i = 0;
  async function worker() {
    while (i < all.length) {
      var g = all[i++], ok = false;
      try { ok = await cacheGame(g, v, hashes); } catch (e) { ok = false; }
      if (ok) OFF.done[g.dir] = 1; else OFF.failed++;
      offProgress();
    }
  }
  await Promise.all([worker(), worker(), worker()].concat(imgs));
  await idbPut('meta', meta);
  OFF.running = false; offProgress();
  if (Object.keys(OFF.done).length < OFF.total) offText('Offline: ' + Object.keys(OFF.done).length + '/' + OFF.total + ' games saved (will retry next time)');
}
function startCache() {
  if (!cacheP) cacheP = runCache().catch(function () { OFF.running = false; offText('Offline saving paused'); });
  return cacheP;
}
