const ENV = require('./_env.js');
// Custom areas (combined / drawn / around the threats) and ICAO NOTAM
const { chromium } = require(ENV.PW); const { execSync } = require('child_process');
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const ctx=await b.newContext({acceptDownloads:true});const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500);
const fail=await page.evaluate(()=>{const f=[]; const pip=(p,poly)=>{let ins=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const[yi,xi]=poly[i],[yj,xj]=poly[j];if(((yi>p[0])!==(yj>p[0]))&&(p[1]<(xj-xi)*(p[0]-yi)/(yj-yi)+xi))ins=!ins;}return ins;};
 APP.S.custom=[]; APP.S.meta.theatre='NE'; APP.S.meta.date='12 DEC 2026'; APP.S.meta.hHour='19:00Z'; APP.setEvents(['MIX']); APP.generateGeneric(); APP.S.roster={pilots:[],controllers:[]}; APP.parseLines('4x F-35A\n2x AMX\n1x E-3'); APP.tailor();
 const c1=APP.cusFromParts(['LI-R49A','LI-R49B','LI-R49C','LI-R49D'],'FL100','FL240'); if(!c1||!c1.joined) f.push('combined area');
 const c2=APP.cusFromThreats(); if(!c2) f.push('threat area'); else { if(c2.poly.length>10) f.push('threat area: too many vertices'); for (const t of APP.S.t.threats) if(!pip(t.pos,c2.poly)) f.push('threat outside '+t.id); }
 APP.S.cusDraft=[[45.9,12.2],[45.9,12.6],[45.6,12.6],[45.6,12.2]]; const c3=APP.cusFinishDraw(); if(!c3||c3.poly.length!==4) f.push('drawn area');
 for (const c of [c1,c2,c3].filter(Boolean)) if(!APP.RES().some(z=>z.id===c.id)) f.push(c.name+' not reserved');
 const N=APP.notamList().map(n=>n.text); const re=/^\([A-Z]\d{4}\/\d{2} NOTAMN\nQ\) [A-Z]{4}\/Q[A-Z]{4}\/IV\/BO\/W\/\d{3}\/\d{3}\/\d{4}[NS]\d{5}[EW]\d{3}\nA\) [A-Z]{4} B\) \d{10} C\) \d{10}\nE\) .+\nF\) .+ G\) .+\)$/;
 N.forEach(t=>{ if(!re.test(t)) f.push('bad NOTAM format: '+t.slice(0,60)); });
 const t2=N.find(t=>t.includes('EXERCISE AREA BRAVO')); if(!t2||!/BOUNDED BY: (\d{6}[NS]\d{7}[EW] - )+\d{6}[NS]\d{7}[EW]\./.test(t2)) f.push('custom NOTAM without lat/long');
 const t1=N.find(t=>t.includes('EXERCISE AREA ALPHA')); if(!t1||!/LI R49A/.test(t1)||!/F\) FL100 G\) FL240/.test(t1)) f.push('combined NOTAM');
 if(!N.every(t=>/AVOID THE (AREA|CORRIDOR)/.test(t))) f.push('avoid phrase'); if(!N[0].includes('B) 2612121830')) f.push('B) time');
 return f;});
await page.evaluate(()=>APP.renderAll()); await page.click('[data-tab="export"]'); await page.waitForTimeout(200);
const [d]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.click('#mpdf')]); await d.saveAs('cus_mp.pdf');
const mp=execSync('pdftotext cus_mp.pdf -').toString(); if(!/NOTAMN/.test(mp)||!/EXERCISE AREA BRAVO/.test(mp)) fail.push('NOTAM not in masterplan');
console.log(fail.length?'"err": '+fail.join('; '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
