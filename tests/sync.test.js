// Two-device sync against a mocked Supabase (served via Playwright routes). Run: node tests/sync.test.js (needs `python3 -m http.server 8765` in the repo root).
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs');
const DB = {}; const OFF = new Set(); http.createServer((q,r)=>{ r.setHeader('Access-Control-Allow-Origin','*'); r.setHeader('Access-Control-Allow-Headers','*'); if (q.method==='OPTIONS'){ r.end(); return; }
  const id = decodeURIComponent(q.url.slice(1)); if (q.method==='GET'){ r.end(JSON.stringify(DB[id]||null)); return; } let b=''; q.on('data',c=>b+=c); q.on('end',()=>{ DB[id]=JSON.parse(b); r.end('{}'); }); }).listen(8799);
const FAKE = `const S='http://localhost:8799/';
export function createClient(){ let user=null; const k='fake.session';
 try{ user=JSON.parse(localStorage.getItem(k)); }catch(e){}
 const sess=u=>({user:u});
 return { auth:{ getSession: async()=>({data:{session:user?sess(user):null}}),
   signUp: async({email})=>{ user={id:email,email}; localStorage.setItem(k,JSON.stringify(user)); return {data:{session:sess(user),user}}; },
   signInWithPassword: async({email,password})=>{ if(password==='bad') return {error:{message:'Invalid login credentials'},data:{}}; user={id:email,email}; localStorage.setItem(k,JSON.stringify(user)); return {data:{session:sess(user),user}}; },
   signOut: async()=>{ user=null; localStorage.removeItem(k); } },
  from: ()=>({ select: ()=>({ maybeSingle: async()=>{ const d = await (await fetch(S+encodeURIComponent(user.id))).json(); return {data:d, error:null}; } }),
    upsert: async(row)=>{ await fetch(S+encodeURIComponent(row.user_id),{method:'POST',body:JSON.stringify({data:row.data})}); return {error:null}; } }) }; }`;
const html = fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').replace("const SYNC_URL = '', SYNC_KEY = '';","const SYNC_URL = 'https://x.supabase.co', SYNC_KEY = 'pk';");
(async()=>{ const b = await chromium.launch(); const errs=[];
const mk = async () => { const ctx = await b.newContext({viewport:{width:393,height:852}}); await ctx.route('**/supabase-js@*/**', r=>r.fulfill({contentType:'application/javascript', body:FAKE})); await ctx.route('http://localhost:8799/**', async r=>{ if (OFF.has(ctx)) return r.abort(); const id = decodeURIComponent(new URL(r.request().url()).pathname.slice(1)); if (r.request().method()==='GET') return r.fulfill({body:JSON.stringify(DB[id]||null), headers:{'Access-Control-Allow-Origin':'*'}}); DB[id]=JSON.parse(r.request().postData()); r.fulfill({body:'{}', headers:{'Access-Control-Allow-Origin':'*'}}); }); await ctx.route('http://localhost:8765/index.html', r=>r.fulfill({contentType:'text/html', body:html})); const p = await ctx.newPage(); p.ctx = ctx; p.on('pageerror', e=>errs.push(e.message)); return p; };
// Device A: has local data (old user), creates account -> uploads
const A = await mk(); await A.goto('http://localhost:8765/index.html'); await A.waitForTimeout(800);
console.log('A auth shown:', await A.isVisible('#auth'));
await A.click('[data-act="authskip"]'); await A.waitForTimeout(300);
await A.click('[data-act="obnext"]'); await A.fill('#obpay','2000'); await A.click('[data-act="obnext"]'); await A.waitForTimeout(300);
await A.reload(); await A.waitForTimeout(800);
console.log('A draft resumed at step:', await A.evaluate(()=>document.querySelector('.onb h2')?.textContent));
for (let i=0;i<2;i++){ await A.click('[data-act="obnext"]'); await A.waitForTimeout(300); }
await A.click('[data-act="obnext"]'); await A.waitForTimeout(300); await A.click('[data-act="obfinish"]'); await A.waitForTimeout(300); await A.click('[data-act="obclose"]'); await A.waitForTimeout(300);
await A.click('[data-act="settings"]'); await A.waitForTimeout(500); await A.click('[data-act="authopen"]'); await A.waitForTimeout(400);
await A.fill('#aemail','b@x.com'); await A.fill('#apw','secret1'); await A.click('#authgo'); await A.waitForTimeout(1000);
console.log('aerr:', await A.textContent('#aerr').catch(()=>'-'), await A.evaluate(()=>fetch('http://localhost:8799/x').then(r=>r.text()).catch(e=>'ERR '+e.message))); console.log('DB after A signup:', !!DB['b@x.com'], DB['b@x.com']?.data?.income?.paycheck);
await A.click('.add'); await A.waitForTimeout(400); await A.click('[data-act="key"][data-k="9"]'); await A.click('#saveTx'); await A.waitForTimeout(2000);
console.log('DB txns after A expense:', DB['b@x.com'].data.txns.length);
// Device B: fresh, signs in -> gets data
const B = await mk(); await B.goto('http://localhost:8765/index.html'); await B.waitForTimeout(800);
await B.click('[data-act="authmode"][data-v="signin"]'); await B.fill('#aemail','b@x.com'); await B.fill('#apw','bad'); await B.click('#authgo'); await B.waitForTimeout(500);
console.log('B bad pw msg:', await B.textContent('#aerr'));
await B.fill('#apw','secret1'); await B.click('#authgo'); await B.waitForTimeout(1200);
console.log('B state:', await B.evaluate(()=>{ const s=JSON.parse(localStorage.getItem('margin.v2')); return {onb:s.onboarded, tx:s.txns.length, onbVisible:!document.getElementById('onb').hidden, auth:!document.getElementById('auth').hidden}; }));
// B adds expense, A pulls on visibility
await B.click('.add'); await B.waitForTimeout(400); await B.click('[data-act="key"][data-k="4"]'); await B.click('#saveTx'); await B.waitForTimeout(2000);
await A.evaluate(()=>{ Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true}); document.dispatchEvent(new Event('visibilitychange')); }); await A.waitForTimeout(800);
console.log('A after pull tx:', await A.evaluate(()=>JSON.parse(localStorage.getItem('margin.v2')).txns.length));
await A.reload(); await A.waitForTimeout(1000); console.log('A reload, auth hidden:', !(await A.isVisible('#auth')), 'tx', await A.evaluate(()=>JSON.parse(localStorage.getItem('margin.v2')).txns.length));

// Conflict: A edits while offline, B edits online, then A reconnects. Both edits must survive.
OFF.add(A.ctx); await A.click('.add'); await A.waitForTimeout(400); await A.click('[data-act="key"][data-k="3"]'); await A.click('#saveTx'); await A.waitForTimeout(1800);
await B.click('.add'); await B.waitForTimeout(400); await B.click('[data-act="key"][data-k="2"]'); await B.click('#saveTx'); await B.waitForTimeout(1800);
const before = DB['b@x.com'].data.txns.length;
OFF.delete(A.ctx); await A.evaluate(()=>dispatchEvent(new Event('online'))); await A.waitForTimeout(1500);
const amts = DB['b@x.com'].data.txns.map(t=>t.amt);
console.log('CONFLICT: account had', before, '-> after A reconnects', amts.length, '| has A offline edit', amts.includes(-300), '| has B edit', amts.includes(-200));
await B.evaluate(()=>{ Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true}); document.dispatchEvent(new Event('visibilitychange')); }); await B.waitForTimeout(1000);
console.log('B converged:', await B.evaluate(()=>JSON.parse(localStorage.getItem('margin.v2')).txns.length)===amts.length);
// Delete on A must not be resurrected by B's older copy
const snapsA = await A.evaluate(()=>Object.keys(localStorage).filter(k=>k.includes('.snap.')).length); console.log('A snapshots kept:', snapsA);
// Delete on A while B is offline and editing: the delete must stick after B reconnects.
OFF.add(B.ctx);
await A.evaluate(()=>document.querySelector('[data-tab="activity"]').click()); await A.waitForTimeout(500);
const delId = await A.evaluate(()=>JSON.parse(localStorage.getItem('margin.v2')).txns.find(t=>t.amt===-900).id);
await A.evaluate(id=>{ const b=document.querySelector(`.row-del[data-id="${id}"]`); if (b) b.click(); else console.log('no row'); }, delId).catch(()=>{}); await A.waitForTimeout(1800);
const deleted = !DB['b@x.com'].data.txns.some(t=>t.id===delId);
await B.click('.add'); await B.waitForTimeout(400); await B.click('[data-act="key"][data-k="6"]'); await B.click('#saveTx'); await B.waitForTimeout(1500);
OFF.delete(B.ctx); await B.evaluate(()=>dispatchEvent(new Event('online'))); await B.waitForTimeout(1500);
const t2 = DB['b@x.com'].data.txns;
console.log('DELETE: A deleted on account:', deleted, '| still deleted after B reconnects:', !t2.some(t=>t.id===delId), '| B offline edit kept:', t2.some(t=>t.amt===-600));

OFF.add(B.ctx); await B.evaluate(()=>{}); 
console.log(errs.join('\n')||'no errors'); await b.close(); process.exit(errs.length?1:0); })();
