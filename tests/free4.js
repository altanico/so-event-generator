const ENV = require('./_env.js');
// v1.31: simple mission in 5 steps (flight plan step), user-built routes, navigation layer kept across steps, AEW INDIA areas, VGAT layers, airways off, symmetric options, readable A5 kneeboard
const { chromium } = require(ENV.PW);
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1280,height:900}});const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.includes('pptxgen'))return r.fulfill({path:ENV.PPTX}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html'); await page.waitForTimeout(1500); const fail=[];
await page.waitForFunction(()=>!!APP.NAV,{timeout:15000}).catch(()=>fail.push('navdb not loaded'));
await page.evaluate(()=>{ APP.S=APP.newScenario(); APP.renderAll(); }); await page.click('[data-kind="free"]');
// symmetric sub-type options
await page.click('[data-fmis="AIRMOB"]'); await page.waitForTimeout(100);
const og=await page.evaluate(()=>{ const l=[...document.querySelectorAll('.optgrid label')].map(e=>e.getBoundingClientRect()); const rows={}; l.forEach(r=>{ (rows[Math.round(r.top)]=rows[Math.round(r.top)]||[]).push(r); });
  return { n:l.length, widths:[...new Set(l.map(r=>Math.round(r.width)))], rowsOk:Object.values(rows).every(rr=>new Set(rr.map(r=>Math.round(r.height))).size===1), minH:Math.min(...l.map(r=>r.height)) }; });
if(og.n!==5||og.widths.length!==1||!og.rowsOk||og.minH<44) fail.push('sub-type options not symmetric '+JSON.stringify(og));
// 5 steps
const steps=await page.evaluate(()=>[...document.querySelectorAll('[data-fstep]')].filter(b=>b.style.flex).map(b=>b.textContent.trim()));
if(steps.length!==5||!/Piano di volo/.test(steps[3])||!/Pacchetto/.test(steps[4])) fail.push('steps '+steps);
// AEW: nearest INDIA area by default, INDIA areas first, drawn
await page.click('[data-fmis="AEW"]'); await page.click('.b.primary[data-fstep="2"]'); await page.waitForTimeout(200); await page.click('.b.primary[data-fstep="3"]'); await page.waitForTimeout(1200);
const aew=await page.evaluate(()=>{ const F=APP.FREE(), c=APP.freeCands(), z=APP.RES()[0]; const f=APP.S.t.flights[0];
  const pip=(p,q)=>{let i=false;for(let a=0,b=q.length-1;a<q.length;b=a++){const xi=q[a][0],yi=q[a][1],xj=q[b][0],yj=q[b][1];if(((yi>p[1])!==(yj>p[1]))&&(p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi))i=!i;}return i;};
  const trk=APP.S.t.airspace.filter(a=>a.flight===f.id&&(a.pts||[]).length).some(a=>a.pts.every(p=>pip(p,z.poly)));
  return { area:F.areas[0], type:z&&z.type, first:c.slice(0,2).map(x=>x.z.type), task:f.task, trk, drawn:APP.freeMapZones().filter(q=>q.type==='IND').length }; });
if(!/^INDIA-/.test(aew.area)||aew.type!=='IND'||aew.first[0]!=='IND') fail.push('AEW INDIA area '+JSON.stringify(aew));
if(!aew.trk) fail.push('AEW track not inside the INDIA area '+JSON.stringify(aew)); if(aew.drawn<3) fail.push('INDIA areas not drawn '+aew.drawn);
// navigation layer: on in step 4 the first time, then as the user leaves it (4 -> 3 -> change area -> 4)
await page.click('.b.primary[data-fstep="4"]'); await page.waitForTimeout(400);
const n1=await page.evaluate(()=>({ on:APP.S.navOn, l:JSON.stringify(APP.S.navL), cta:!!document.getElementById('fplcta'), edit:APP.routeEditOn() }));
if(!n1.on||!n1.cta||!n1.edit) fail.push('step 4 '+JSON.stringify(n1));
await page.evaluate(()=>{ APP.S.navL.ndb=0; APP.S.navL.vrp=1; });
const keep=await page.evaluate(()=>JSON.stringify(APP.S.navL));
await page.click('[data-fstep="3"]'); await page.waitForTimeout(300);
const n2=await page.evaluate(()=>({ on:APP.S.navOn, l:JSON.stringify(APP.S.navL) })); if(!n2.on||n2.l!==keep) fail.push('nav layer changed going back to step 3 '+JSON.stringify(n2));
const other=await page.evaluate(()=>{ const c=APP.freeCands().find(x=>!(APP.FREE().areas||[]).includes(x.z.id)); return c&&c.z.id; });
if(other){ await page.check(`[data-farea="${other}"]`); await page.waitForTimeout(800); }
const n3=await page.evaluate(()=>({ on:APP.S.navOn, l:JSON.stringify(APP.S.navL), layers:document.querySelectorAll('.navsym').length })); if(!n3.on||n3.l!==keep) fail.push('nav layer changed after an area change '+JSON.stringify(n3));
await page.click('.b.primary[data-fstep="4"]'); await page.waitForTimeout(300);
const n4=await page.evaluate(()=>({ on:APP.S.navOn, l:JSON.stringify(APP.S.navL) })); if(!n4.on||n4.l!==keep) fail.push('nav layer changed back in step 4 '+JSON.stringify(n4));
// the empty route: a click on the map adds the first point; the route survives a regeneration
const rt=await page.evaluate(()=>{ const f=APP.S.t.flights[0], b=APP.AIRPORTS[f.base]; APP.routeMapClick([b[1]+0.6,b[2]+0.4]); const n=APP.routeOf(f).pts.length; APP.FREE().built=0; APP.freeBuild(); return { n, after:APP.routeOf(APP.S.t.flights[0]).pts.length, no:APP.fplAll()[0].p.noRoute }; });
if(rt.n!==1||rt.after!==1||rt.no) fail.push('first point on the map / kept '+JSON.stringify(rt));
// VGAT profile: only radio aids and VRP; airways off
await page.evaluate(()=>{ const F=APP.FREE(); F.mis='NAV'; F.prof='VGAT'; F.flights=[]; F.areas=null; F.built=0; F.step=2; APP.S.fpl=null; APP.renderAll(); });
await page.click('.b.primary[data-fstep="3"]'); await page.waitForTimeout(900); await page.click('.b.primary[data-fstep="4"]'); await page.waitForTimeout(300);
const vg=await page.evaluate(()=>{ APP.drawNav(); const l=APP.S.navL, f=APP.S.t.flights[0], p=APP.fplAll()[0].p; return { l, leg:APP.routeOf(f).legs[0].type, f8:p.out.f8 }; });
const L0=vg.l; if(!(L0.vor&&L0.vortac&&L0.tacan&&L0.ndb&&L0.vrp)||L0.fe||L0.fra||L0.mil||L0.gate||L0.awy) fail.push('VGAT layers '+JSON.stringify(L0));
if(vg.leg!=='VGAT'||vg.f8!=='VG') fail.push('VGAT plan '+JSON.stringify(vg));
// VGAT above FL195 warned
const vw=await page.evaluate(()=>{ const f=APP.S.t.flights[0], R=APP.routeOf(f); R.legs[0].lvl=210; const w=APP.fplAll()[0].p.warn.join(' | '); R.legs[0].lvl=95; return w; }); if(!/VGAT sopra FL195/.test(vw)) fail.push('VGAT level check '+vw);
// airways forced off when not chosen by the user (old saved state)
const aw=await page.evaluate(()=>{ APP.S.navL.awy=1; delete APP.S.navAwyMan; APP.drawNav(); return APP.S.navL.awy; }); if(aw!==0) fail.push('airways not off by default');
// readable kneeboard: no text under 9 pt, nothing past the page edge
await page.evaluate(()=>{ const F=APP.FREE(); F.mis='CAS'; F.flights=[]; F.areas=null; F.built=0; F.step=2; APP.S.fpl=null; APP.renderAll(); });
await page.click('.b.primary[data-fstep="3"]'); await page.waitForTimeout(1200);
const kb=await page.evaluate(async()=>{ const P=PDFLib.PDFPage.prototype, o=P.drawText; let min=99, over=[], n=0; P.drawText=function(t,op){ n++; const s=op.size||24; if(s<min) min=s; const w=op.font?op.font.widthOfTextAtSize(t,s):0; if(op.x<0||op.x+w>this.getWidth()-10) over.push(t.slice(0,30)); return o.call(this,t,op); };
  try { const pdf=await APP.kneeboardPdf(); const pg=pdf.getPages(); return { min, over, n, pages:pg.length, w:Math.round(pg[0].getWidth()), h:Math.round(pg[0].getHeight()) }; } finally { P.drawText=o; } });
if(kb.min<9||kb.over.length||kb.w!==420||kb.h!==595||kb.pages<4) fail.push('kneeboard '+JSON.stringify(kb));
// events: flight plan tab, one flight at a time, tabs by callsign, call to action, Export warning
await page.evaluate(()=>{ APP.S=APP.newScenario(); APP.S.kind='internal'; APP.S.custom=[]; APP.setTheatre('NE'); APP.S.resMode='auto'; APP.setEvents(['CAS']); APP.generateGeneric(); APP.S.meta.hHour='19:00Z'; APP.S.meta.date='12 DEC 2026';
  APP.S.roster={pilots:[],controllers:[]}; APP.parseLines('2x EF-2000\n2x AMX'); APP.tailor(); APP.TAB='fpl'; APP.renderAll(); });
const ev=await page.evaluate(()=>({ tabs:document.querySelectorAll('[data-fplsel]').length, fl:APP.S.t.flights.length, cards:document.querySelectorAll('[data-fpltxt]').length, cta:!!document.getElementById('fplcta'), noR:APP.fplAll().every(x=>x.p.noRoute) }));
if(ev.tabs!==(ev.fl>1?ev.fl:0)||ev.cards!==1||!ev.cta||!ev.noR) fail.push('events flight plan tab '+JSON.stringify(ev));
await page.evaluate(()=>{ APP.TAB='export'; APP.renderAll(); }); if(!/Flight senza rotta/.test(await page.textContent('#panel'))) fail.push('Export warning for flights without a route');
console.log(JSON.stringify({kb,aew}));
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
