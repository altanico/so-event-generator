const ENV = require('./_env.js');
// v1.28: missione semplice – one Navigazione card with a BOAT / VOAT / IOAT / GAT / MISTO profile, route by leg, several and free areas, HAAR only for helicopters,
// free aerodromes (foreign ICAO, ZZZZ ship) and aircraft, compact flight card, navigation points on in step 3
const { chromium } = require(ENV.PW); const { execSync } = require('child_process');
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1280,height:900}});const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.includes('pptxgen'))return r.fulfill({path:ENV.PPTX}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html'); await page.waitForTimeout(1500); const fail=[];
await page.waitForFunction(()=>!!APP.NAV,{timeout:15000}).catch(()=>fail.push('navdb not loaded'));
await page.evaluate(()=>{ APP.S=APP.newScenario(); APP.renderAll(); }); await page.click('[data-kind="free"]');
// one Navigazione card, profiles
const cards=await page.evaluate(()=>[...document.querySelectorAll('[data-fmis]')].map(b=>b.textContent.trim()));
if(cards.filter(c=>/^Navigation/.test(c)).length!==1||cards.some(c=>/Low-Level|bassa quota/.test(c))) fail.push('navigation cards '+cards);
await page.click('[data-fmis="NAV"]'); const pr=await page.evaluate(()=>[...document.querySelectorAll('[data-fprof]')].map(x=>x.dataset.fprof).join(','));
if(pr!=='IOAT,VOAT,IGAT,VGAT,BOAT,MIX') fail.push('profiles '+pr);
if(!(await page.evaluate(()=>[...document.querySelectorAll('[data-fmis]')].every(b=>getComputedStyle(b).whiteSpace!=='nowrap')))) fail.push('mission cards do not wrap');
await page.click('[data-fprof="MIX"]'); await page.click('.b.primary[data-fstep="2"]'); await page.waitForTimeout(200);
// compact flight card: 2 rows, ICAO only in the aerodrome fields
const cc=await page.evaluate(()=>{ const c=document.querySelector('.fcard'), dep=c.querySelector('[data-k="dep"]'); return { grids:c.querySelectorAll(':scope > div[style*="grid"]').length, depTag:dep.tagName, depVal:dep.value, depW:dep.getBoundingClientRect().width, h:c.getBoundingClientRect().height }; });
if(cc.grids!==2||cc.depTag!=='INPUT'||cc.depVal!=='LIPS'||cc.depW>110) fail.push('compact card '+JSON.stringify(cc));
// step 3: areas only (no route); step 4: the user builds the route (v1.31)
await page.click('.b.primary[data-fstep="3"]'); await page.waitForTimeout(1200);
const r2=await page.evaluate(()=>({ areas:APP.FREE().areas, at:APP.RES().some(z=>/^AT\s/i.test(z.name)||/^LI-AT/.test(z.id)), rows:document.querySelectorAll('[data-rl]').length }));
if(!r2.areas.length||!r2.at) fail.push('MIX: AT area '+JSON.stringify(r2)); if(r2.rows) fail.push('route table in step 3');
await page.click('.b.primary[data-fstep="4"]'); await page.waitForTimeout(600);
const e0=await page.evaluate(()=>{ const p=APP.fplAll()[0].p; return { no:p.noRoute, f15:p.out.f15, cta:!!document.getElementById('fplcta'), navOn:APP.S.navOn }; });
if(!e0.no||!/ DCT$/.test(e0.f15)||!e0.cta) fail.push('empty route at first '+JSON.stringify(e0)); if(!e0.navOn) fail.push('navigation points not switched on in step 4');
const r3=await page.evaluate(()=>{ const f=APP.S.t.flights[0], z=APP.RES().find(z=>/^AT\s/i.test(z.name)||/^LI-AT/.test(z.id)), c=z.poly.reduce((a,p)=>[a[0]+p[0]/z.poly.length,a[1]+p[1]/z.poly.length],[0,0]);
  const pin=(p,q)=>{let i=false;for(let a=0,b=q.length-1;a<q.length;b=a++){const xi=q[a][0],yi=q[a][1],xj=q[b][0],yj=q[b][1];if(((yi>p[1])!==(yj>p[1]))&&(p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi))i=!i;}return i;};
  const v=z.poly.map(p=>[p[0]+(c[0]-p[0])*0.3,p[1]+(c[1]-p[1])*0.3]).filter(p=>pin(p,z.poly)).slice(0,2);
  const R=APP.routeOf(f); R.pts=[c,...v].map(p=>({id:'',name:'P',pos:p,k:''})); R.legs=[{type:'IOAT',lvl:150,agl:1000},{type:'BOAT',lvl:95,agl:1000},{type:'BOAT',lvl:95,agl:1000},{type:'IOAT',lvl:150,agl:1000}];
  APP.routeSync(); APP.renderAll(); const p=APP.fplAll()[0].p; return { n:R.pts.length, f8:p.out.f8, f15:p.out.f15, f18:p.out.f18, rows:document.querySelectorAll('[data-rl][data-k="type"]').length, legs:p.legs.length }; });
if(r3.f8!=='YM'||!/ VFR /.test(r3.f15)||!/ IFR$/.test(r3.f15)||!/\/N\d{4}A\d{3}/.test(r3.f15)||!/OPAREA\//.test(r3.f18)) fail.push('MIX flight plan '+JSON.stringify([r3.f8,r3.f15,r3.f18]));
if(r3.rows!==r3.legs) fail.push('legs table');
// BOAT above 2000 ft AGL -> warning; IGAT leg -> EUROCONTROL note
const w=await page.evaluate(()=>{ const R=APP.routeOf(APP.S.t.flights[0]), i=R.legs.findIndex(l=>l.type==='BOAT'); R.legs[i].agl=2500; R.legs[0].type='IGAT'; const p=APP.fplAll()[0].p; const out={warn:p.warn.join(' | '), f8:p.out.f8}; R.legs[i].agl=1000; R.legs[0].type='IOAT'; return out; });
if(!/non è BOAT/.test(w.warn)||!/EUROCONTROL/.test(w.warn)) fail.push('route checks '+w.warn);
// insert a point by clicking the map (add mode)
const ins=await page.evaluate(()=>{ const f=APP.S.t.flights[0], R=APP.routeOf(f), n=R.pts.length, a=R.pts[0].pos, b2=R.pts[1].pos; document.getElementById('faddpt').click(); APP.routeMapClick([(a[0]+b2[0])/2+0.01,(a[1]+b2[1])/2]); return { before:n, after:APP.routeOf(f).pts.length }; });
if(ins.after!==ins.before+1) fail.push('add point '+JSON.stringify(ins));
// one route only: the engine route of the flight follows the flight plan route; drag a leg = new waypoint
const one=await page.evaluate(()=>{ const f=APP.S.t.flights[0], R=APP.routeOf(f), n=R.pts.length; APP.routeDrop(f,1,[(R.pts[0].pos[0]+R.pts[1].pos[0])/2-0.05,(R.pts[0].pos[1]+R.pts[1].pos[1])/2]); const R2=APP.routeOf(f);
  const eng=APP.S.t.airspace.filter(a=>a.type==='ROUTE'&&a.flight===f.id); return { n, after:R2.pts.length, legs:R2.legs.length, same:eng.every(a=>JSON.stringify(a.pts.slice(1,-1))===JSON.stringify(R2.pts.map(p=>p.pos))), eng:eng.length }; });
if(one.after!==one.n+1||one.legs!==one.after+1) fail.push('leg drag insert '+JSON.stringify(one));
if(!one.same) fail.push('engine route differs from the flight plan route');
ins.after=one.after;
// navigation points: no distance filter, radio aids and fixes shown
const nc=await page.evaluate(()=>{ APP.S.navL.fe=1; const b=document.querySelector('[data-mapwin="nav"]'); if(b&&!document.getElementById('navcount')) b.click(); APP.drawNav(); return (document.getElementById('navcount')||{}).textContent||''; });
if(!(+((nc.match(/(\d+) punti visibili/)||[])[1]||0) > 500)) fail.push('navigation points '+nc);
// several areas, search any area, free choice with warnings
const ar=await page.evaluate(()=>{ const s=APP.freeSearch('R313'); const z=s[0]; APP.freeAreaToggle(z.id); APP.freeBuild(); return { found:s.length, ids:APP.FREE().areas, res:APP.RES().map(x=>x.id), warn:APP.freeAreaWarn(z).join(';'), route:APP.routeOf(APP.S.t.flights[0]).pts.length }; });
if(!ar.found||ar.ids.length<2||!ar.res.includes('LI-R313')||!/AT/.test(ar.warn)) fail.push('several / searched areas '+JSON.stringify(ar));
if(ar.route!==ins.after) fail.push('the edited route was lost when regenerating');
// HAAR only for helicopters
const haar=await page.evaluate(()=>{ const F=APP.FREE(); F.mis='AAR'; F.flights=[{id:'a1',cs:'VIPER 1',type:'F-35A',size:2,dep:'LIPS',arr:'LIPS',form:true,task:'RECEIVER'}]; F.areas=null; const jet=APP.freeCands().map(x=>x.z.name).join(','); F.flights[0].type='HH-101'; F.flights[0].task='HAARRCV'; const helo=APP.freeCands().map(x=>x.z.name).join(','); return {jet,helo}; });
if(/HAAR/i.test(haar.jet)) fail.push('HAAR area proposed to jets '+haar.jet); if(!/HAAR/i.test(haar.helo)) fail.push('no HAAR area for helicopters '+haar.helo);
// free aerodromes and aircraft: foreign ICAO, ZZZZ ship, type not in the list
await page.evaluate(()=>{ const F=APP.FREE(); F.mis='NAV'; F.prof='IOAT'; F.areas=null; F.route=null; F.built=0; F.flights=[{id:'z1',cs:'SHARK 1',type:'F-35B',size:1,dep:'LIPS',arr:'LIPS',form:true,task:'IFRNAV'}]; F.step=2; APP.renderAll(); });
await page.fill('[data-k="dep"]','zzzz'); await page.dispatchEvent('[data-k="dep"]','change'); await page.waitForTimeout(100);
if(!/posto senza codice ICAO/.test(await page.textContent('#panel'))) fail.push('ZZZZ asks for the place');
if(!(await page.$eval('.b.primary[data-fstep="3"]',e=>e.disabled))) fail.push('ZZZZ without position accepted');
await page.fill('[data-fp][data-pk="name"]','Nave Cavour'); await page.dispatchEvent('[data-fp][data-pk="name"]','change');
await page.click('[data-fpick]'); await page.evaluate(()=>APP.freeMapClick([43.2,10.2]));
await page.fill('[data-k="arr"]','LFMI'); await page.dispatchEvent('[data-k="arr"]','change'); await page.waitForTimeout(100);
await page.fill('[data-fp][data-k="arr"][data-pk="pos"]','43.52 4.92'); await page.dispatchEvent('[data-fp][data-k="arr"][data-pk="pos"]','change');
await page.fill('[data-k="type"]','Super Tucano'); await page.dispatchEvent('[data-k="type"]','change'); await page.waitForTimeout(100);
if(!(await page.$('[data-fa][data-k="cat"]'))) fail.push('unknown aircraft without its fields');
await page.selectOption('[data-fa][data-k="cat"]','ATTACK'); await page.fill('[data-fa][data-k="desig"]','EMB4'); await page.dispatchEvent('[data-fa][data-k="desig"]','change');
await page.click('.b.primary[data-fstep="3"]'); await page.waitForTimeout(1200);
const zz=await page.evaluate(()=>{ const p=APP.fplAll()[0].p; return { f9:p.out.f9, f13:p.out.f13, f16:p.out.f16, f18:p.out.f18 }; });
if(!/^ZZZZ/.test(zz.f13)||!/^LFMI/.test(zz.f16)||!/DEP\/NAVE CAVOUR 4312N01012E/.test(zz.f18)||!/EMB4\//.test(zz.f9)) fail.push('free aerodromes / aircraft in the FPL '+JSON.stringify(zz));
// kneeboard with the route legs
await page.click('.b.primary[data-fstep="4"]'); await page.waitForTimeout(300); await page.click('.b.primary[data-fstep="5"]'); await page.waitForTimeout(300);
const [d]=await Promise.all([page.waitForEvent('download',{timeout:60000}),page.click('#fknee')]); await d.saveAs('free2_knee.pdf');
const kt=execSync('pdftotext free2_knee.pdf -').toString(); if(!/IOAT/.test(kt)||!/FPL-SHARK1/.test(kt)) fail.push('kneeboard route '+kt.slice(0,300));
console.log(JSON.stringify({f15:r3.f15}));
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
