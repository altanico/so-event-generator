const ENV = require('./_env.js');
// v1.19: terrain (DEM) – elevations, run-in headings on the terrain, holding blocks above terrain, map styles; custom areas without duplicates, NOTAM limits
const { chromium } = require(ENV.PW);
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const page=await b.newPage({viewport:{width:1280,height:800}});const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(2500); const fail=[];
const r=await page.evaluate(async()=>{ const o={}; o.on=APP.DEM.on; await APP.demLoad([[46.03,12.6],[45.83,6.86],[46.5,11.8],[43.5,9.5]],0.1);
  o.aviano=APP.elevFt([46.0319,12.5965]); o.blanc=APP.elevFt([45.8326,6.8652]); o.sea=APP.elevFt([43.5,9.5]);
  APP.S.custom=[]; APP.setTheatre('NE'); APP.S.resMode='auto'; APP.S.casCfg={nJtac:1,perJ:3,rw:0}; APP.setEvents(['CAS']); APP.generateGeneric(); await APP.demRefresh();
  const J=APP.S.cas.jtacs[0]; o.style=APP.mapStyle(); o.elev=J.targets.map(x=>[x.elev,x.elevDem]);
  J.targets[0].elev=1234; APP.demFill(); o.kept=J.targets[0].elev; o.keptFlag=J.targets[0].elevDem; J.targets[1].elev=''; APP.demFill(); o.refill=[J.targets[1].elev,J.targets[1].elevDem];
  // terrain floor: a holding over the Dolomites
  J.holdMan=true; J.hold='RACETRACK'; J.ref='CP'; J.cps[0].man=true; J.cps[0].pos=[46.45,11.85]; await APP.demLoad([J.cps[0].pos],0.5); APP.casDeconf(J); o.tf=J.terrainFloor; o.blocks=J.tasks.filter(T=>!T.rw).map(T=>T.block);
  // headings: the chosen run-in is not worse than the generated bearing
  const T=J.tasks.find(x=>!x.rw), ip=J.ips.find(x=>x.name===T.ip), tg=J.targets.find(x=>x.id===T.target); o.runT=T.runTerrain; const tm=APP.elevM(tg.pos)||0;
  o.scoreNow=APP.runScore(ip.pos,tg.pos,tm); o.scoreBase=APP.runScore(dest(tg.pos,ip.tb0,dist(tg.pos,ip.pos)),tg.pos,tm);
  APP.setEvents(['ID']); APP.S.mapStyle=undefined; o.styleID=APP.mapStyle(); APP.setEvents(['CAS']);
  // custom areas: same parts twice = one area; bare number limits; overlaps
  APP.S.custom=[]; const ids=LIB().filter(z=>/^R49[A-F]/.test(z.name)).map(z=>z.id); const a1=APP.cusFromParts(ids,'2000 FT AGL','370'); const a2=APP.cusFromParts(ids,'SFC','FL250');
  o.ncus=APP.S.custom.length; o.same=a1===a2; o.limits=[a2.lower,a2.upper]; o.norm=[APP.limNorm('370'),APP.limNorm('95'),APP.limNorm('FL 80'),APP.limNorm('2000 FT AGL')]; o.ok=[APP.limOk('FL370'),APP.limOk('37O')];
  cusAdd(cusMake('draw',a2.poly.slice())); o.ov=APP.cusOverlaps().length; const nt=APP.notamList().filter(n=>/EXERCISE AREA/.test(n.text)); o.notams=nt.length; o.g=nt.map(n=>(n.text.match(/G\) ([^)]*)\)/)||[])[1]);
  return o; });
if(!r.on) fail.push('DEM not loaded'); if(!(r.aviano>250&&r.aviano<500)) fail.push('Aviano elevation '+r.aviano); if(!(r.blanc>15000)) fail.push('Mont Blanc '+r.blanc); if(r.sea!==0) fail.push('sea '+r.sea);
if(r.elev.some(([v,d])=>typeof v!=='number'||!d)) fail.push('targets not filled '+JSON.stringify(r.elev)); if(r.kept!==1234||r.keptFlag) fail.push('staff elevation overwritten '+r.kept); if(typeof r.refill[0]!=='number'||!r.refill[1]) fail.push('cleared elevation not refilled');
if(!(r.tf>=10)) fail.push('terrain floor over the Dolomites '+r.tf); if(+r.blocks[0].split('-')[0]<r.tf) fail.push('blocks below terrain '+r.blocks+' tf '+r.tf);
if(r.scoreNow==null||r.scoreBase==null||r.scoreNow>r.scoreBase+1) fail.push(`run-in on the terrain ${r.scoreNow} vs ${r.scoreBase}`);
if(r.style!=='relief'||r.styleID!=='clean') fail.push('default styles '+r.style+'/'+r.styleID);
if(r.ncus!==1||!r.same||r.limits.join()!=='SFC,FL250') fail.push('combined area duplicated '+r.ncus+' '+r.limits); if(r.norm.join()!=='FL370,FL095,FL080,2000 FT AGL') fail.push('limNorm '+r.norm); if(!r.ok[0]||r.ok[1]) fail.push('limOk');
if(r.ov!==1) fail.push('overlap not detected'); if(r.g.some(g=>!/^(FL\d{3}|SFC|GND|UNL|\d+FT)/.test(g))) fail.push('NOTAM G) '+r.g);
// CAS tab: run-in terrain line, style selector; PDF map with relief
await page.click('#tabcas'); await page.waitForTimeout(400); const txt=await page.evaluate(()=>document.getElementById('panel').textContent);
if(!/Run-in .* bersaglio \d+ ft · rilievo max \d+ ft/.test(txt)) fail.push('run-in terrain line missing');
const st=await page.$$eval('#mapstyle option',os=>os.map(o=>o.value).join()); if(st!=='clean,relief,tint,dark') fail.push('style selector '+st);
const img=await page.evaluate(async()=>{ APP.S.mapStyle='tint'; const m=await renderMap('brief',{light:true,w:600,h:400}); return typeof m==='string'?m.length:0; }); if(img<10000) fail.push('PDF map with relief');
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
