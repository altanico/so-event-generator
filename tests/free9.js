const ENV = require('./_env.js');
// v1.37: "Cambia tipo di missione" in the multi-participant modes, live area search with suggestions in step 3 of simple missions, SEAD / Strike fixed + mobile SAM and planned + dynamic targets with controller injects
const { chromium } = require(ENV.PW);
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const ctx=await b.newContext({viewport:{width:1280,height:900}});const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html'); await page.waitForTimeout(1500); const fail=[];
await page.waitForFunction(()=>!!APP.NAV&&!!APP.CSN,{timeout:15000}).catch(()=>fail.push('navdb not loaded'));
// change mission type from the internal and the official event
for (const k of ['internal','official']) {
  await page.evaluate(k=>{ APP.S=APP.newScenario(); APP.S.kind=k; APP.renderAll(); document.querySelector('[data-tab="scenario"]').click(); },k);
  const btn=await page.$('#panel [data-kindreset]'); if(!btn){ fail.push(k+': no change-type button'); continue; }
  await btn.click(); await page.waitForTimeout(200); const r=await page.evaluate(()=>({kind:APP.S.kind, chooser:!!document.querySelector('#panel [data-kind="free"]')}));
  if(r.kind!==''||!r.chooser) fail.push(k+': back to the chooser '+JSON.stringify(r)); }
// step 3: live search with suggestions
await page.evaluate(()=>{ APP.S=APP.newScenario(); APP.renderAll(); }); await page.click('[data-kind="free"]');
await page.evaluate(()=>{ const F=APP.FREE(); F.mis='CAS'; F.sub=''; F.flights=[]; F.areas=null; F.built=0; F.step=2; APP.renderAll(); });
await page.click('.b.primary[data-fstep="3"]'); await page.waitForTimeout(800);
await page.click('#faq'); await page.keyboard.type('R21'); await page.waitForTimeout(250);
let s=await page.evaluate(()=>({ open:!document.getElementById('faqdd').hidden, opts:[...document.querySelectorAll('#faqdd [data-faqpick]')].map(o=>o.textContent).slice(0,3), focus:document.activeElement&&document.activeElement.id }));
const first=(s.opts[0]||'').split(' ')[0];
if(!s.open||!/^R21[AB]$/.test(first)||!s.opts.some(o=>/R21A/.test(o))||!s.opts.some(o=>/R21B/.test(o))||s.focus!=='faq') fail.push('suggestions '+JSON.stringify(s));
await page.click('#faqdd [data-faqpick]'); await page.waitForTimeout(500);
s=await page.evaluate(()=>({ areas:(APP.FREE().areas||[]).map(id=>(APP.LIBF().find(z=>z.id===id)||{}).name), open:!document.getElementById('faqdd').hidden, focus:document.activeElement&&document.activeElement.id, built:!!APP.S.t }));
if(!s.areas.some(n=>n.startsWith(first))||!s.open||s.focus!=='faq'||!s.built) fail.push('click pick '+JSON.stringify(s));
await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
s=await page.evaluate(()=>(APP.FREE().areas||[]).map(id=>(APP.LIBF().find(z=>z.id===id)||{}).name)); if(!s.some(n=>/R21A/.test(n))||!s.some(n=>/R21B/.test(n))) fail.push('keyboard pick '+s);
await page.keyboard.press('Escape'); if(await page.evaluate(()=>!document.getElementById('faqdd').hidden)) fail.push('Esc does not close');
// SEAD / Strike variants
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1200); await page.evaluate(()=>{ APP.S=APP.newScenario(); APP.S.kind='official'; APP.renderAll(); });
const sd=async(sam,tgt)=>page.evaluate(([sam,tgt])=>{ APP.S.custom=[]; APP.setTheatre('NE'); APP.setEvents(['SEAD']); APP.S.variants.SEAD={sam,tgt}; APP.S.resMode='auto'; APP.generateGeneric(); APP.S.roster={pilots:[],controllers:[{id:'c1',name:'M',pref:'GCI'}]}; APP.parseLines('2x Tornado ECR\n2x F-35A'); APP.tailor();
  const t=APP.S.t; return { th:t.threats.filter(x=>x.flight).map(x=>x.type+(x.mobile?'(mob)':'')+(x.dyn?'(dyn)':'')), inj:t.gci?t.gci.injects.map(i=>i[2]):[], pub:JSON.stringify((APP.publicData?APP.publicData():null)||'') }; },[sam,tgt]);
let r=await sd(['FIXED','MOBILE'],['PLANNED','DYNAMIC']);
if(!r.th.some(x=>/^SAM.*\(mob\)/.test(x))||!r.th.some(x=>/^SAM_[A-Z]+$/.test(x))||!r.th.includes('HVT')||!r.th.includes('HVT(dyn)')) fail.push('both variants '+r.th);
if(!r.inj.some(x=>/^RETASK – time-sensitive target: .*N\d.*TOT H\+/.test(x))||!r.inj.some(x=>/relocated: new position/.test(x))) fail.push('injects '+r.inj);
if(/RETASK|relocated/.test(r.pub)) fail.push('inject in public data');
r=await sd(['FIXED'],['PLANNED']); if(r.th.some(x=>/\((mob|dyn)\)/.test(x))||r.inj.some(x=>/RETASK|relocated/.test(x))) fail.push('fixed / planned only '+r.th);
r=await sd(['MOBILE'],['DYNAMIC']); if(!r.th.some(x=>/\(mob\)/.test(x))||r.th.includes('HVT')||!r.th.includes('HVT(dyn)')) fail.push('mobile / dynamic only '+r.th);
const ui=await page.evaluate(()=>{ document.querySelector('[data-tab="scenario"]').click(); APP.WOPEN='ev'; APP.renderAll(); const a=document.querySelector('[data-var="SEAD|sam|FIXED"]'), m=document.querySelector('[data-var="SEAD|sam|MOBILE"]'); return !!(a&&m); });
if(ui){ await page.evaluate(()=>{ APP.S.variants.SEAD={sam:['FIXED'],tgt:['PLANNED']}; APP.renderAll(); }); await page.click('[data-var="SEAD|sam|MOBILE"]'); const v=await page.evaluate(()=>APP.S.variants.SEAD.sam.slice().sort().join()); if(v!=='FIXED,MOBILE') fail.push('SAM multi choice '+v); } else fail.push('SEAD variant buttons not found '+await page.evaluate(()=>APP.S.kind+' '+document.querySelector('#panel').textContent.slice(0,300)));
if(errs.length) fail.push(...errs);
console.log(fail.length?'FAIL\n'+fail.join('\n'):'PASS free9'); await b.close(); process.exit(fail.length?1:0);})();
