const ENV = require('./_env.js');
// v1.30: every mission type in the simple mission (groups, options), English category names, "+ Nuova missione", example in the saved-missions window
const { chromium } = require(ENV.PW); const { execSync } = require('child_process');
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1280,height:900}});const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.includes('pptxgen'))return r.fulfill({path:ENV.PPTX}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html'); await page.waitForTimeout(1500); const fail=[];
await page.waitForFunction(()=>!!APP.NAV,{timeout:15000}).catch(()=>fail.push('navdb not loaded'));
// header: "+ Nuova missione", no reset / example; example in the saved-missions window
if(!(await page.$('#newmis'))||await page.$('header #fullreset')||await page.$('#fullreset')) fail.push('header buttons');
if(await page.evaluate(()=>!!document.querySelector('#demo')&&!document.querySelector('#evpanel #demo'))) fail.push('example still in the header');
await page.click('#evbtn'); if(!(await page.$('#evpanel #demo'))) fail.push('example not in the saved-missions window'); await page.click('#evclose');
// English names of the event types and role groups
const en=await page.evaluate(()=>{ APP.S=APP.newScenario(); APP.S.kind='official'; APP.S.level='division'; APP.renderAll(); return document.getElementById('panel').textContent+' '+Object.values(APP.EVT).map(e=>e.it).join(' | '); });
['Air Mobility','Close Air Support','Combat Search and Rescue','Maritime Operations','Aerial Firefighting','Low-Level Navigation'].forEach(n=>{ if(!en.includes(n)) fail.push('event name missing: '+n); });
if(/Mobilità aerea|Navigazione a bassa quota|Operazioni marittime/.test(en)) fail.push('Italian event names left');
// simple mission: groups and every type
await page.evaluate(()=>{ APP.S=APP.newScenario(); APP.renderAll(); }); await page.click('[data-kind="free"]');
const st1=await page.textContent('#panel'); ['COMBAT','AIR MOBILITY & RESCUE','NAVIGATION & TRAINING'].forEach(g=>{ if(!st1.includes(g)) fail.push('group '+g); });
const keys=await page.evaluate(()=>[...document.querySelectorAll('[data-fmis]')].map(x=>x.dataset.fmis).join(','));
if(keys!=='CAS,STRIKE,ID,MAR,AEW,AIRMOB,CSAR,SAR,MED,AIB,NAV') fail.push('cards '+keys);
await page.click('[data-fmis="AIRMOB"]'); const subs=await page.evaluate(()=>[...document.querySelectorAll('[data-fsub]')].map(x=>x.dataset.fsub).join(','));
if(subs!=='AIRLIFT,AIRDROP,INSERT,HUMAN,AAR') fail.push('air mobility options '+subs);
const run=async(mis,sub,type,dep)=>page.evaluate(([mis,sub,type,dep])=>{ const F=APP.FREE(); F.mis=mis; F.sub=sub||''; F.flights=[]; F.areas=null; F.route=null; F.built=0; F.step=2; APP.renderAll();
  F.flights=[{id:'q1',cs:'TEST 1',type,size:1,dep,arr:dep,form:true,task:''}]; F.flights[0].task=''; APP.freePrep();
  const t=APP.S.t, p=t?APP.fplAll()[0].p:null; return { ok:!!t, ev:APP.S.meta.events.join(','), task:t&&t.flights[0].task, areas:F.areas, res:APP.RES().map(z=>z.name).join('; '), f18:p&&p.out.f18, ser:t?t.serials.length:0 }; },[mis,sub,type,dep]);
const cases=[['MAR','MPA','P-72A','LICZ','MAR','MPA'],['MAR','ANTISHIP','EF-2000 Typhoon','LIPA','MAR','ANTISHIP'],['AIRMOB','AIRLIFT','C-130J','LIRP','AIRMOB','AIRLIFT'],['AIRMOB','AIRDROP','C-130J','LIRP','AIRMOB','AIRDROP'],
  ['AIRMOB','INSERT','HH-139','LIRV','AIRMOB','INSERT'],['AIRMOB','HUMAN','C-27J','LIRP','HUMAN','HUMAN'],['AIRMOB','AAR','F-35A','LIPS','AAR','RECEIVER'],['CSAR','','HH-101','LIRS','CSAR','CSAR'],
  ['MED','MEDEVAC','C-130J','LIRP','MEDEVAC','MEDEVAC'],['MED','HEMS','AS350 / H125 (light single helo)','LIRF','HEMS','HEMS'],['MED','HOSPITAL','AS350 / H125 (light single helo)','LIRF','HOSPITAL','HOSPITAL']];
const types=await page.evaluate(()=>APP.AC?APP.AC.map(a=>a.type):[]);
for(const [m,sb,ty,dp,ev,task] of cases){ const t2=types.find(x=>x===ty)||types.find(x=>x.startsWith(ty.split(' ')[0]))||ty; const r=await run(m,sb,t2,dp);
  if(!r.ok||r.ev!==ev||r.task!==task) fail.push(`${m}/${sb}: ${JSON.stringify(r)}`);
  if(['AIRDROP','INSERT'].includes(sb)&&!r.areas.length) fail.push(`${sb}: no PARA / helicopter area proposed`);
  if(['MEDEVAC','HEMS','HOSPITAL','HUMAN'].includes(sb)&&!/STS\//.test(r.f18||'')) fail.push(`${sb}: STS missing in the FPL ${r.f18}`); }
// kneeboard of a new type
await page.evaluate(()=>{ const F=APP.FREE(); F.step=4; APP.renderAll(); });
const [d]=await Promise.all([page.waitForEvent('download',{timeout:60000}),page.click('#fknee')]); await d.saveAs('free3_knee.pdf');
const kt=execSync('pdftotext free3_knee.pdf -').toString(); if(!/Inter-Hospital Transfer/i.test(kt)) fail.push('kneeboard title '+kt.slice(0,200));
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
