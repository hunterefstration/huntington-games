const { chromium } = require('playwright'); const fs=require('fs'),path=require('path');
const SP=process.env.HG_TOOLS||'/tmp/hg-tools', ROOT=process.env.HG_ROOT||'/home/user/hg-release', B=+process.env.HG_BUILD, SECRET=process.env.HG_SECRET;
if(!B) throw new Error('set HG_BUILD (and HG_SECRET for gate.js)');
(async()=>{
  const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const out=[];
  // ---- End-to-end: real hub on jsfiddle host launches Blocky through srcdoc, hub mints its own token ----
  {
    const page=await b.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(e.message));
    await page.route('**/*',r=>{const u=r.request().url();
      if(u==='https://fiddle.jshell.net/'){ let html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8').replace(/<head[^>]*>/i,m=>m+'<script>window.HG_VERSION="r'+B+'"<\/script>'); return r.fulfill({contentType:'text/html',body:html}); }
      if(/\/Blocky Shooter V2\/index\.html/.test(decodeURIComponent(u))) return r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(ROOT,'Blocky Shooter V2/index.html'),'utf8')});
      if(/hub\/blocky\.jpg/.test(u)) return r.fulfill({contentType:'image/jpeg',body:fs.readFileSync(path.join(ROOT,'hub/blocky.jpg'))});
      const m=u.match(/three@0\.160\.0\/(.*)$/); if(m){const f=path.join(SP,'cdn/package',m[1]); if(fs.existsSync(f))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(f)});}
      if(u.includes('tailwind'))return r.fulfill({contentType:'application/javascript',body:''});
      if(u.includes('gate.json'))return r.fulfill({contentType:'application/json',body:'{"min":1}'});
      if(u.includes('data.jsdelivr.com'))return r.fulfill({contentType:'application/json',body:'{"files":[]}'});
      return r.abort();});
    // the launcher needs an account; this player has signed in on this device before, so it opens straight away
    await page.addInitScript(()=>{ try{ localStorage.setItem('hgv:key','x'.repeat(43)); localStorage.setItem('hgv:name','Tester'); }catch(e){} });
    await page.goto('https://fiddle.jshell.net/',{waitUntil:'load',timeout:20000});
    await page.waitForTimeout(1500);
    const grid=await page.evaluate(()=>document.querySelectorAll('.game').length);
    await page.evaluate(()=>{ const g=[...document.querySelectorAll('.game')].find(e=>/Blocky/.test(e.textContent)); g&&g.click(); });
    await page.waitForTimeout(4000);
    const fr=page.frames().find(f=>f.name()==='' && f!==page.mainFrame());
    let booted=false, dead=false;
    for(const f of page.frames()){ try{ if(await f.evaluate(()=>!!window.__blocky)) booted=true; const t=await f.evaluate(()=>document.body?document.body.innerText:''); if(/shut down/i.test(t))dead=true; }catch(e){} }
    out.push((grid>0&&booted&&!dead?'PASS':'FAIL')+' 7 real hub (jsfiddle) launches Blocky: grid='+grid+' booted='+booted+' dead='+dead+(errs.length?' '+errs.slice(0,2):''));
    await page.close();
  }
  // ---- Offline bundle expired (>3 days) ----
  for(const [label,days,wantDead] of [['8 offline bundle 4 days old -> expired',4,true],['9 offline bundle 1 day old -> ok',1,false]]){
    const page=await b.newPage();
    await page.addInitScript((ago)=>{ try{localStorage.setItem('hg_lastok', String(Date.now()-ago*86400000));}catch(e){} window.__noNet=1; }, days);
    await page.route('**/*',r=>{const u=r.request().url();
      if(u==='https://x.github.io/'){ let html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8').replace(/<head[^>]*>/i,m=>m+'<script>window.HG_VERSION="r'+B+'";window.HG_BUNDLE={version:"r'+B+'",builtAt:Date.now()-10*86400000,files:{},meta:{libs:{},mods:{}}};<\/script>'); return r.fulfill({contentType:'text/html',body:html}); }
      if(u.includes('gate.json')) return r.abort();  // simulate no connection
      return r.abort();});
    await page.goto('https://x.github.io/',{waitUntil:'load',timeout:20000}).catch(()=>{});
    await page.waitForTimeout(1500);
    const t=await page.evaluate(()=>document.body?document.body.innerText:'');
    const dead=/expired/i.test(t);
    out.push((dead===wantDead?'PASS':'FAIL')+' '+label+' (dead='+dead+')');
    await page.close();
  }
  console.log(out.join('\n'));
  await b.close();
})().catch(e=>{console.error(e);process.exit(1);});
