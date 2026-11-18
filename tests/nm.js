const ENV = require('./_env.js');
const { chromium } = require(ENV.PW);
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});
const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1300,height:900}});const page=await ctx.newPage();const errs=[];
page.on('pageerror',e=>errs.push(e.message));
await page.route('**/*',r=>{const u=r.request().url();
 if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK});
 if(u.includes('pptxgen'))return r.fulfill({path:ENV.PPTX});
 if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB});
 if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(800);
console.log(await page.evaluate(()=>APP.S.t.c2.map(c=>c.controller).join('|')));
await page.click('[data-tab="export"]');
for (const names of [false,true]) {
 if (names) await page.check('#withnames');
 const [dl]=await Promise.all([page.waitForEvent('download',{timeout:60000}),page.click('#pptbrief')]);
 if(dl) await dl.saveAs(`nm_${names}.pptx`);
}
console.log(errs.join('\n')||'ok'); await b.close();})();
