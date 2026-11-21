const ENV = require('./_env.js');
// v1.18.8: CAS scenarios shown / hidden one by one on the staff map, threats toggle; "Serials" renamed "Task allocation"
const { chromium } = require(ENV.PW); const { execSync } = require('child_process');
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const ctx=await b.newContext({acceptDownloads:true});const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500); const fail=[];
await page.evaluate(()=>{ APP.S.custom=[]; APP.setTheatre('PU'); APP.S.resMode='auto'; APP.S.casCfg={nJtac:2,perJ:3,rw:0}; APP.setEvents(['CAS']); APP.generateGeneric(); APP.renderAll();
  window.__rec=[]; const wrap=n=>{ const o=L[n]; L[n]=function(){ const m=o.apply(this,arguments); window.__rec.push({n,a:arguments[0],o:arguments[1]}); return m; }; }; ['marker','polygon','polyline','circle'].forEach(wrap); });
await page.click('#tabcas'); await page.waitForTimeout(300);
const count=()=>page.evaluate(()=>{ const r=window.__rec; window.__rec=[]; return { wedges:r.filter(x=>x.n==='polygon'&&x.o&&x.o.color==='#d97706').length, ips:r.filter(x=>x.n==='marker'&&x.o&&x.o.icon&&/>I</.test(JSON.stringify(x.o.icon))).length, thr:r.filter(x=>x.n==='circle'&&x.o&&x.o.color==='#ef4444').length }; });
await page.evaluate(()=>{ window.__rec=[]; drawMap(); }); const all=await count();
await page.click('[data-cassolo="J1:J1S2"]'); await page.waitForTimeout(300); await page.evaluate(()=>{ window.__rec=[]; drawMap(); }); const solo=await count();
const st=await page.evaluate(()=>({ hidden:Object.keys(APP.casView().hide).sort().join(), vis:APP.S.cas.jtacs.flatMap(J=>J.tasks.filter(APP.casVis).map(T=>T.id)).join() }));
if(all.wedges!==6) fail.push('wedges with all visible '+all.wedges); if(solo.wedges!==1) fail.push('wedges with "solo questo" '+solo.wedges); if(st.vis!=='J1S2') fail.push('visible '+st.vis);
await page.click('[data-casall="J2:show"]'); await page.waitForTimeout(200); await page.evaluate(()=>{ window.__rec=[]; drawMap(); }); const j2=await count(); if(j2.wedges!==4) fail.push('J2 show all '+j2.wedges);
await page.click('[data-casvis="J1S2"]'); await page.waitForTimeout(200); await page.evaluate(()=>{ window.__rec=[]; drawMap(); }); const h=await count(); if(h.wedges!==3) fail.push('eye toggle '+h.wedges);
// threats toggle (phase 3 threats)
await page.evaluate(()=>{ APP.S.roster={pilots:[],controllers:[]}; APP.parseLines('2x Tornado IDS\n2x F-35A'); APP.tailor(); TAB='cas'; APP.renderAll(); });
await page.evaluate(()=>{ window.__rec=[]; drawMap(); }); const t1=await count(); await page.click('#casnothr'); await page.waitForTimeout(200); await page.evaluate(()=>{ window.__rec=[]; drawMap(); }); const t2=await count();
if(!(t1.thr>0&&t2.thr===0)) fail.push(`threats toggle ${t1.thr} -> ${t2.thr}`);
// documents unaffected by the hidden scenarios + Task allocation name
const n9=await page.evaluate(()=>APP.S.cas.jtacs.flatMap(J=>J.tasks).length);
const [d]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.evaluate(()=>exportMasterplan(document.createElement('button')))]); await d.saveAs('b29_mp.pdf');
const txt=execSync('pdftotext b29_mp.pdf -').toString(); if(!/Task allocation/.test(txt)) fail.push('Task allocation missing in the masterplan'); if(/\bSerials\b/.test(txt)) fail.push('"Serials" still in the masterplan');
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
