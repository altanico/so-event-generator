const ENV = require('./_env.js');
// Low-level navigation: routes inside the AIP ENR 5.2.2.6 tactical areas (handled as D areas), helicopters lower band
const { chromium } = require(ENV.PW);
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const page=await b.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500);
const fail=await page.evaluate(()=>{const f=[]; const pip=(p,poly)=>{let ins=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const[yi,xi]=poly[i],[yj,xj]=poly[j];if(((yi>p[0])!==(yj>p[0]))&&(p[1]<(xj-xi)*(p[0]-yi)/(yj-yi)+xi))ins=!ins;}return ins;};
 for (const th of ['NO','CT','SI','PU']) { APP.S.meta.theatre=th; APP.setEvents(['NAVL']); APP.generateGeneric(); APP.S.roster={pilots:[],controllers:[]}; APP.parseLines('4x Tornado IDS\n2x NH90'); APP.tailor();
  const lz=APP.RES().filter(z=>(z.use||[]).includes('LOWLEVEL')); if(!lz.length){f.push(th+' no AT area');continue;}
  for (const a of APP.S.t.airspace.filter(a=>a.kind==='LOW')) { if (!a.pts.every(p=>lz.some(z=>pip(p,z.poly)))) f.push(th+' '+a.name+' outside AT'); }
  if(!APP.S.t.airspace.some(a=>a.kind==='LOW'&&/^150/.test(a.alt))) f.push(th+' no helicopter band');
  const txt=JSON.stringify(APP.S.t.serials); if(!/not a reserved area/.test(txt)) f.push(th+' AT note missing'); if((APP.containmentIssues()||[]).length) f.push(th+' containment'); }
 return f;});
console.log(fail.length?'"err": '+fail.join('; '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
