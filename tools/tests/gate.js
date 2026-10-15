const { chromium } = require('playwright'); const fs=require('fs'),path=require('path');
const SP=process.env.HG_TOOLS||'/tmp/hg-tools', ROOT=process.env.HG_ROOT||'/home/user/hg-release', B=+process.env.HG_BUILD, SECRET=process.env.HG_SECRET;
if(!B) throw new Error('set HG_BUILD (and HG_SECRET for gate.js)');
function h(x){var n=5381,i=0;for(;i<x.length;i++)n=((n<<5)+n+x.charCodeAt(i))>>>0;return n.toString(36);}
(async()=>{
  const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const results=[];
  async function run(label, host, urlpath, file, {token,expectDead,expectText,checkGlobal}={}){
    const page=await b.newPage(); const errs=[];
    page.on('pageerror',e=>errs.push(e.message));
    await page.route('**/*',r=>{const u=r.request().url();
      if(u.startsWith('https://'+host+'/')){ let html=fs.readFileSync(path.join(ROOT,file),'utf8');
        if(token) html=html.replace(/<head[^>]*>/i,m=>m+'<script>window.HG_HUB='+JSON.stringify(token)+'<\/script>');
        return r.fulfill({contentType:'text/html',body:html}); }
      const m=u.match(/three@0\.160\.0\/(.*)$/); if(m){const f=path.join(SP,'cdn/package',m[1]); if(fs.existsSync(f))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(f)});}
      if(u.includes('tailwind'))return r.fulfill({contentType:'application/javascript',body:''});
      if(u.includes('gate.json'))return r.fulfill({contentType:'application/json',body:'{"min":1}'});
      return r.abort();});
    try{ await page.goto('https://'+host+'/'+urlpath,{waitUntil:'load',timeout:20000}); }catch(e){}
    await page.waitForTimeout(2500);
    const body=await page.evaluate(()=>document.body?document.body.innerText:'');
    const dead=/shut down|not authorized|expired/i.test(body);
    let glob=null; if(checkGlobal) glob=await page.evaluate(g=>!!window[g], checkGlobal);
    let pass=true,why='';
    if(expectDead!==undefined){ if(dead!==expectDead){pass=false;why='dead='+dead+' want '+expectDead;} }
    if(expectText && !new RegExp(expectText,'i').test(body)){pass=false;why+=' no "'+expectText+'"';}
    if(checkGlobal){ if(glob!==!expectDead){pass=false;why+=' global '+checkGlobal+'='+glob;} }
    results.push((pass?'PASS ':'FAIL ')+label+(why?' ['+why.trim()+']':'')+(errs.length?' errs:'+errs.slice(0,1):''));
    await page.close();
  }
  const sig=h(B+'|Blocky Shooter V2|'+SECRET);
  await run('1 stolen standalone game (pirate domain, no token)','evil.test','g.html','Blocky Shooter V2/index.html',{expectDead:true,checkGlobal:'__blocky'});
  await run('2 game WITH valid hub token (pirate domain)','evil.test','g.html','Blocky Shooter V2/index.html',{token:{b:B,sig},expectDead:false,checkGlobal:'__blocky'});
  await run('3 game with WRONG token','evil.test','g.html','Blocky Shooter V2/index.html',{token:{b:B,sig:'deadbeef'},expectDead:true,checkGlobal:'__blocky'});
  await run('4 stolen HUB on pirate domain','evil.test','','index.html',{expectDead:true,expectText:'not authorized'});
  await run('5 HUB on github.io (allowed)','player.github.io','','index.html',{expectDead:false});
  await run('6 HUB on jsfiddle result host','fiddle.jshell.net','','index.html',{expectDead:false});
  console.log(results.join('\n'));
  await b.close();
})().catch(e=>{console.error(e);process.exit(1);});
