const ENV = require('./_env.js');
// v1.21: bases with side (BLUE / RED players / both) and roles; civil airfields only for civil purposes; RED-held picker
const { chromium } = require(ENV.PW); const { execSync } = require('child_process');
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1280,height:900}});const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500); const fail=[];
await page.evaluate(()=>{ APP.S.custom=[]; APP.setTheatre('NE'); APP.S.resMode='auto'; APP.setEvents(['MIX']); APP.WOPEN='th'; APP.renderAll(); });
await page.click('[data-tab="scenario"]'); await page.waitForTimeout(300); await page.evaluate(()=>{ APP.WOPEN='th'; APP.renderAll(); }); await page.waitForTimeout(200);
if(!(await page.$('[data-bside="LIPA"]'))) fail.push('no base picker in the theatre step');
const setCk=(k,v)=>page.evaluate(([k,v])=>{ const e=document.querySelector(`[data-brole="${k}"]`); if(!e) return; e.checked=v; e.dispatchEvent(new Event('change',{bubbles:true})); },[k,v]);
// UI: LIPA blue tankers only; LIPZ (civil) blue; LIPS blue fighters + CAS + SEAD; LIPI shared with RED players
await page.selectOption('[data-bside="LIPA"]','BLUE'); await page.waitForTimeout(150);
await setCk('LIPA:roles:ALL',false); await page.waitForTimeout(150); await setCk('LIPA:roles:TKR',true); await page.waitForTimeout(150);
await page.selectOption('[data-bside="LIPS"]','BLUE'); await page.waitForTimeout(150); await setCk('LIPS:roles:FTR',true); await page.waitForTimeout(150); await setCk('LIPS:roles:CAS',true); await setCk('LIPS:roles:ATK',true); await page.waitForTimeout(150);
await page.selectOption('[data-bside="LIPZ"]','BLUE').catch(()=>fail.push('LIPZ not listed')); await page.waitForTimeout(150);
const civRoles=await page.$$eval('[data-brole^="LIPZ:roles:"]',x=>x.map(e=>e.dataset.brole.split(':')[2]).join());
if(/FTR|ATK|CAS|TKR/.test(civRoles)) fail.push('military roles offered on a civil airfield '+civRoles);
const st=await page.evaluate(()=>({ bases:APP.S.blueBases.join(), lipa:APP.S.bases.LIPA.roles.join(), lips:APP.S.bases.LIPS.roles.join() }));
if(st.lipa!=='TKR') fail.push('LIPA roles '+st.lipa); if(!/FTR/.test(st.lips)||/ALL/.test(st.lips)) fail.push('LIPS roles '+st.lips);
const r=await page.evaluate(()=>{ APP.generateGeneric(); APP.S.roster={pilots:[],controllers:[]}; APP.parseLines('1x KC-767A\n2x EF-2000\n2x Tornado IDS\n2x HH-139A\n2x F-35A'); APP.tailor(); const t=APP.S.t;
  return { fl:t.flights.map(f=>[f.cs,f.task,f.base]), warn:t.warnings.filter(w=>/^Basi:/.test(w)) }; });
const by=task=>r.fl.filter(f=>f[1]===task);
if(by('AAR').some(f=>f[2]!=='LIPA')) fail.push('tanker base '+JSON.stringify(by('AAR')));
if(r.fl.some(f=>f[2]==='LIPZ'&&!['STANDBY','SAR','AIB','HEMS','MEDEVAC','HUMAN','IFRNAV','HOSPITAL'].includes(f[1]))) fail.push('military flight on a civil airfield '+JSON.stringify(r.fl.filter(f=>f[2]==='LIPZ')));
if(['DCA','OCA','CAS','SEAD','STRIKE','ESCORT'].some(k=>by(k).some(f=>f[2]!=='LIPS'))) fail.push('fighters not at LIPS '+JSON.stringify(r.fl));
if(r.fl.some(f=>['CSAR','INSERT','RESCORT'].includes(f[1]))&&!r.warn.length) fail.push('no warning for a role without base');
// shared base BLUE + RED players: not flagged; masterplan lists the roles
const sh=await page.evaluate(()=>{ APP.S.bases.LIPI={side:'BOTH',roles:['ALL'],rroles:['FTR']}; APP.syncBases(); return { inBlue:APP.S.blueBases.includes('LIPI'), iss:APP.borderIssues().filter(x=>/LIPI/.test(x)).length }; });
if(!sh.inBlue||sh.iss) fail.push('shared base '+JSON.stringify(sh));
const [d]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.evaluate(()=>{ APP.S.t.flights[0].base='LIPI'; return exportMasterplan(document.createElement('button')); })]); await d.saveAs('b33_mp.pdf');
const mp=execSync('pdftotext b33_mp.pdf -').toString().replace(/\s+/g,' '); if(!/Used by: BLUE – tankers/.test(mp)) fail.push('masterplan roles of LIPA'); if(!/BLUE \(all roles\) and RED players \(fighters\)/.test(mp)) fail.push('masterplan shared base');
// RED-held picker in step 5
await page.evaluate(()=>{ APP.WOPEN='thr'; APP.renderAll(); }); await page.waitForTimeout(200); const held=await page.$$eval('[data-rheld]',x=>x.length); if(!held) fail.push('no RED-held picker');
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
