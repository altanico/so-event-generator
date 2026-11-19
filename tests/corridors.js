const ENV = require('./_env.js');
// OAT corridors (AIP ENR 5.2.2.4): transit / airway use, mutual exclusion, never used to place exercise elements
const { chromium } = require(ENV.PW);
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const page=await b.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500);
const fail=await page.evaluate(()=>{const f=[]; const go=(th,ev)=>{APP.S.meta.theatre=th; APP.setEvents(ev); APP.generateGeneric(); APP.S.roster={pilots:[],controllers:[]}; APP.parseLines('4x F-35A\n2x AMX\n1x KC-767'); APP.tailor();};
 go('PU',['NAVI']); if(!(APP.S.cor||[]).includes('LI-CORYANKEE')) f.push('PU NAVI: YANKEE not used'); if(!APP.S.t.airspace.some(a=>a.kind==='IFR'&&a.names[0]==='YANKEE 1')) f.push('PU NAVI: IFR route not along YANKEE');
 go('SA',['MIX']); const c=APP.S.cor||[]; if(!c.some(x=>/TCPERDA/.test(x))) f.push('SA MIX: no TC-PERDA transit'); if(c.includes('LI-CORTCPERDAHIGH')&&c.includes('LI-CORTCPERDAMED')) f.push('TC-PERDA HIGH and MED together');
 if(APP.RES().some(z=>z.type==='COR')) f.push('corridor used as reserved area');
 if(APP.AIP().zones.some(z=>z.hours)) f.push('hours still in the data');
 return f;});
console.log(fail.length?'"err": '+fail.join('; '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
