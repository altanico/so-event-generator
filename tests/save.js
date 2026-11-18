const ENV = require('./_env.js');
const { chromium } = require(ENV.PW);
const mock = `(()=>{const store={};const subs=[];
const snapOf=()=>{const docs=Object.entries(store).filter(([k])=>k.startsWith('events/')).map(([k,v])=>({id:k.split('/')[1],exists:true,data:()=>v,metadata:{fromCache:false}})).sort((a,b)=>b.data().savedAt-a.data().savedAt);return {docs,size:docs.length,empty:!docs.length,metadata:{fromCache:false,hasPendingWrites:false}}};
const fire=()=>subs.forEach(f=>f(snapOf()));
const coll=c=>({orderBy:()=>coll(c),onSnapshot:(n,e)=>{subs.push(n);setTimeout(()=>n(snapOf()),50);return()=>{}},doc:id=>({get:async()=>({exists:(c+'/'+id) in store,data:()=>store[c+'/'+id]}),set:async d=>{if(JSON.stringify(d).length>262144)throw {code:'invalid_argument'};store[c+'/'+id]=JSON.parse(JSON.stringify(d));fire()},delete:async()=>{delete store[c+'/'+id];fire()}})});
window.__store=store;
const db={collection:coll};const user={id:async()=>'u1',profiles:async ids=>Object.fromEntries(ids.map(i=>[i,{name:'Staff Test'}])),isOwner:async()=>true,canEdit:async()=>true};
window.claude={use:async n=>n==='db'?(window.__nodb?null:db):n==='user'?user:null};})();`;
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});
for (const nodb of [true,false]) {
const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1300,height:900}});const page=await ctx.newPage();const errs=[];
page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.addInitScript(`window.__nodb=${nodb};`+mock);
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(900);
await page.evaluate(()=>{APP.setEvents(['AIB']); APP.generateGeneric(); APP.parseLines('3x CL-415'); APP.tailor();});
const name1=await page.evaluate(()=>APP.S.meta.op);
await page.click('#evbtn'); await page.waitForTimeout(200); await page.click('#evsave'); await page.waitForTimeout(400);
await page.click('#evnew'); await page.waitForTimeout(300);  // clean after save -> no confirm
const name2=await page.evaluate(()=>APP.S.meta.op);
await page.click('#evbtn'); await page.waitForTimeout(200);
await page.screenshot({path:`save_${nodb?'local':'db'}.png`});
const rows=await page.$$eval('[data-evopen]',x=>x.length);
await page.click('[data-evopen]'); await page.waitForTimeout(150); // current is new & unchanged (no zones) -> opens directly
await page.waitForTimeout(500);
const after=await page.evaluate(()=>({op:APP.S.meta.op, ev:APP.S.meta.events, flights:APP.S.t&&APP.S.t.flights.length, badge:document.getElementById('evbadge').textContent}));
const st=await page.evaluate(()=>window.__store?Object.keys(window.__store):[]);
console.log(nodb?'LOCAL':'DB', JSON.stringify({name1,name2,rows,after,st}));
console.log(errs.join('\n')||'no errors'); await ctx.close();}
await b.close();})();
