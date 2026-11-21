const ENV = require('./_env.js');
// OAT corridors (AIP ENR 5.2.2.4): transit / airway use, mutual exclusion, never used to place exercise elements
const { chromium } = require(ENV.PW);
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const page=await b.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500);
const fail=await page.evaluate(()=>{const f=[]; const go=(th,ev)=>{APP.S.meta.theatre=th; APP.setEvents(ev); APP.generateGeneric(); APP.S.roster={pilots:[],controllers:[]}; APP.parseLines('4x F-35A\n2x Tornado IDS\n1x KC-767'); APP.tailor();};
 go('PU',['NAVI']); if(!(APP.S.cor||[]).includes('LI-CORYANKEE')) f.push('PU NAVI: YANKEE not used'); if(!APP.S.t.airspace.some(a=>a.kind==='IFR'&&a.names[0]==='YANKEE 1')) f.push('PU NAVI: IFR route not along YANKEE');
 go('SA',['MIX']); const c=APP.S.cor||[]; if(!c.some(x=>/TCPERDA/.test(x))) f.push('SA MIX: no TC-PERDA transit'); if(c.includes('LI-CORTCPERDAHIGH')&&c.includes('LI-CORTCPERDAMED')) f.push('TC-PERDA HIGH and MED together');
 if(APP.RES().some(z=>z.type==='COR')) f.push('corridor used as reserved area');
 if(APP.AIP().zones.some(z=>z.hours)) f.push('hours still in the data');
 return f;});

// AAR tracks: visible in phase 1 for refuelling events, choosing one reserves its areas and the tanker flies it
const tk=await page.evaluate(()=>{ APP.S.custom=[]; APP.S.trkSel=[]; APP.S.t=null; APP.S.gen=null; APP.S.zones=[]; APP.setEvents(['AAR']); APP.setTheatre('CT'); const near=APP.aarNear().map(t=>t.id); const pick=near.find(id=>id==='TERRA')||near[0];
  APP.trkToggle(pick); const o={near, pick, mode:APP.S.resMode, res:APP.RES().map(z=>z.id)}; document.querySelector('[data-tab="scenario"]').click(); APP.WOPEN='asp'; APP.renderAll(); o.btn=!!document.querySelector(`[data-trk="${pick}"].primary`);
  APP.generateGeneric(); APP.parseLines('1x KC-767\n2x F-35A'); APP.tailor(); o.tracks=APP.S.t.airspace.filter(a=>a.type==='TRACK').map(a=>a.name); o.iss=(APP.containmentIssues()||[]).length;
  APP.S.t=null; APP.S.gen=null; APP.S.zones=[]; APP.setEvents(['NAVI']); APP.WOPEN='asp'; APP.renderAll(); o.casBtn=!!document.querySelector('[data-trk]'); return o; });
if(!tk.near.length) fail.push('no AAR track near CT'); if(tk.mode!=='manual'||!tk.res.length||!tk.btn) fail.push('track choice '+JSON.stringify(tk)); if(!tk.tracks.some(n=>n.includes(tk.pick))) fail.push('tanker not on the chosen track '+tk.tracks); if(tk.iss) fail.push(tk.iss+' containment issues with a chosen track'); if(tk.casBtn) fail.push('AAR tracks shown for an IFR navigation event');
const tz=await page.evaluate(()=>{ APP.setEvents(['AAR']); APP.setTheatre('CT'); return APP.TRK().filter(t=>t.kind==='AAR').map(t=>{APP.S.trkSel=[]; APP.S.reserved=[]; APP.trkToggle(t.id); return [t.id, APP.RES().length];}).filter(x=>!x[1]).map(x=>x[0]); });
if(tz.length) fail.push('AAR tracks without areas: '+tz);
console.log(fail.length?'"err": '+fail.join('; '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
