const ENV = require('./_env.js');
// Default bases: one BLUE and one RED; military events never get a civil BLUE base
const { chromium } = require(ENV.PW);
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const page=await b.newPage();const errs=[];
page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(800);
const fail=await page.evaluate(()=>{const f=[]; for (const ev of [['CAS'],['MIX'],['SAR'],['AIB']]) for (const th of ['NE','NO','CT','SA','SI','PU']) { APP.S.meta.theatre=th; APP.setEvents(ev); APP.generateGeneric();
  const B=APP.S.blueBases, R=APP.S.redBases; if (B.length!==1||R.length>1) f.push(`${ev} ${th} count ${B}/${R}`);
  if (!APP.PROF().civil && B.some(k=>APP.AIRPORTS[k][3]==='CIV')) f.push(`${ev} ${th} civil blue base ${B}`); } return f;});
console.log(fail.length?'"err": '+fail.join('; '):'checks ok');
console.log(errs.join('\n')||'no errors'); await b.close();})();
