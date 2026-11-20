const ENV = require('./_env.js');
// v1.18.6: CAS task cards on several rows (no horizontal scroll), holding notes under the select, offset LEFT / RIGHT (text, map band, suggestion)
const { chromium } = require(ENV.PW); const { execSync } = require('child_process');
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1280,height:800}});const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500); const fail=[];
await page.evaluate(()=>{ APP.S.custom=[]; APP.setTheatre('PU'); APP.S.resMode='auto'; APP.S.casCfg={nJtac:1,perJ:3,rw:34}; APP.setEvents(['CAS']); APP.generateGeneric(); APP.S.t=null; const J=APP.S.cas.jtacs[0]; J.ref='KEYHOLE'; J.hold='WHEEL'; APP.casDeconf(J); APP.renderAll(); });
await page.click('#tabcas'); await page.waitForTimeout(300);
const w=await page.evaluate(()=>{ const p=document.getElementById('panel'); return { sw:p.scrollWidth, cw:p.clientWidth, cards:document.querySelectorAll('.tcard').length, opts:[...document.querySelectorAll('select[data-cf="hold"] option')].map(o=>o.textContent).join('|'), cut:[...document.querySelectorAll('.tcard select')].filter(s=>s.scrollWidth>s.clientWidth+2).length }; });
if(w.sw>w.cw+2) fail.push(`horizontal scroll in the panel (${w.sw} > ${w.cw})`); if(w.cards!==3) fail.push('task cards '+w.cards); if(/blocchi/.test(w.opts)) fail.push('holding options too long '+w.opts);
await page.selectOption('select[data-cask="J1:0"][data-cf="offset"]','LEFT'); await page.waitForTimeout(200);
const r=await page.evaluate(()=>{ const J=APP.S.cas.jtacs[0], T=J.tasks[0]; const o={ off:T.offset, band:!!APP.offsetBand(J,T), txt:document.body.textContent };
  J.tasks[1].offset=''; const tgt=J.targets.find(x=>x.id===J.tasks[1].target), ip=J.ips.find(x=>x.name===J.tasks[1].ip), h=bearing(ip.pos,tgt.pos);
  J.friendlies=[{desc:'F',pos:dest(tgt.pos,h+90,1),mark:'none'}]; o.sug=APP.offsetSuggest(J,J.tasks[1]); J.friendlies=[{desc:'F',pos:dest(tgt.pos,h-90,1),mark:'none'}]; o.sug2=APP.offsetSuggest(J,J.tasks[1]); return o; });
if(r.off!=='LEFT'||!r.band) fail.push('offset not set'); if(!/, OFFSET LEFT/.test(r.txt)) fail.push('line 2 offset missing'); if(!/OFFSET LEFT: MANOEUVRE ONLY LEFT OF THE (IP|BP)-TARGET LINE/.test(r.txt)) fail.push('offset restriction missing');
if(r.sug!=='LEFT'||r.sug2!=='RIGHT') fail.push('offset suggestion '+r.sug+' '+r.sug2);
const [d]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.evaluate(()=>APP.exportJtacPack('ALL'))]); await d.saveAs('b27_jtac.pdf');
if(!/OFFSET LEFT/.test(execSync('pdftotext b27_jtac.pdf -').toString())) fail.push('JTAC pack without the offset');
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
