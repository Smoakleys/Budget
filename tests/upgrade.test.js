// Upgrade test: seeds every state shape Margin has ever stored, loads the current build, edits, reloads, and checks nothing was lost.
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8765/';
const d = (n)=>{ const x = new Date(); x.setDate(x.getDate()-n); return x.toISOString().slice(0,10); };
const tx = (n, cat, amt) => Array.from({length:n}, (_,i)=>({id:'t'+i+cat, date:d(i%20), cat, amt, note:'n'+i}));
const v1 = {txns:[...tx(5,'groceries',-4200), ...tx(2,'income',250000), ...tx(3,'dining',-1800)], budgets:{groceries:60000, dining:30000, rent:145000}};
const v2early = {v:2, onboarded:true, income:{paycheck:200000, freq:'biweekly', monthly:433333}, cats:{groceries:{budget:50000}, rent:{budget:120000}}, custom:[{id:'c1', name:'Climbing', icon:'dots', group:'fun'}], loans:[{id:'l1', name:'Car', type:'auto', balance:1200000, apr:6.9, payment:35000}], txns:tx(12,'groceries',-3000)};
const v2suite = {...v2early, income:{...v2early.income, anchor:d(3)}, cash:{amt:150000, ts:Date.now()-864e5}, saved:null, debtPlan:{extra:5000, strategy:'snowball'}, snooze:{x:1}, merchants:{'Trader Joes':'groceries'}, since:d(30), txns:tx(20,'groceries',-2500)};
const v2current = {...v2suite, updatedAt:Date.now()-5e3, txns:tx(25,'groceries',-2500)};
const future = {...v2current, v:3, wishlist:[{id:'w1', name:'Bike'}], income:{...v2current.income, bonus:{amt:100000}}, txns:tx(30,'groceries',-2500)};
const cases = [
  {name:'v1 (first release)', keys:{'margin.v1':v1}, expectTx:10, setup:true},
  {name:'v1 sample data only', keys:{'margin.v1':{...v1, sample:true}}, expectTx:0, setup:true, fresh:true},
  {name:'v2 guided-setup era', keys:{'margin.v2':v2early}, expectTx:12},
  {name:'v2 suite era', keys:{'margin.v2':v2suite}, expectTx:20},
  {name:'v2 current', keys:{'margin.v2':v2current}, expectTx:25},
  {name:'future v3 (newer app wrote it)', keys:{'margin.v2':future}, expectTx:30, check:s=>s.v===3 && s.wishlist?.[0]?.name==='Bike' && s.income.bonus?.amt===100000},
  {name:'unreadable + snapshot', raw:{'margin.v2':'{"v":2,"onboarded":tr', 'margin.v2.snap.000001700000000':JSON.stringify({why:'daily', at:Date.now()-864e5, state:v2current})}, expectTx:25, check:(s,ls)=>ls['margin.v2.unreadable']==='{"v":2,"onboarded":tr'},
  {name:'unreadable, no snapshot', raw:{'margin.v2':'garbage'}, expectTx:0, setup:true, fresh:true, check:(s,ls)=>ls['margin.v2.unreadable']==='garbage'},
  {name:'nulls in fields', keys:{'margin.v2':{...v2current, loans:null, merchants:null, debtPlan:{extra:0}}}, expectTx:25, check:s=>Array.isArray(s.loans) && s.debtPlan.strategy==='avalanche'},
];
(async()=>{ const b = await chromium.launch(); let fail = 0;
for (const c of cases){
  const ctx = await b.newContext({viewport:{width:393,height:852}}); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e=>errs.push(e.message));
  await p.goto(URL); await p.evaluate(({keys, raw})=>{ localStorage.clear(); for (const k in keys||{}) localStorage.setItem(k, JSON.stringify(keys[k])); for (const k in raw||{}) localStorage.setItem(k, raw[k]); }, {keys:c.keys, raw:c.raw});
  await p.reload(); await p.waitForTimeout(900);
  const untouched = await p.evaluate(({keys, raw})=>Object.entries({...keys, ...raw}).every(([k,v])=>localStorage.getItem(k)===(typeof v==='string'?v:JSON.stringify(v))), {keys:c.keys, raw:c.raw});
  if (c.setup){ // walk setup through to the end
    await p.click('[data-act="obnext"]'); await p.fill('#obpay','1500'); await p.click('[data-act="obnext"]');
    for (let i=0;i<3;i++){ await p.waitForTimeout(300); await p.click('[data-act="obnext"]'); }
    await p.waitForTimeout(300); await p.click('[data-act="obfinish"]'); await p.waitForTimeout(400); await p.click('[data-act="obclose"]'); await p.waitForTimeout(400);
  }
  await p.click('.add'); await p.waitForTimeout(400); await p.click('[data-act="key"][data-k="7"]'); await p.click('#saveTx'); await p.waitForTimeout(400);
  await p.reload(); await p.waitForTimeout(900);
  const r = await p.evaluate(()=>{ const ls = {}; for (let i=0;i<localStorage.length;i++){ const k = localStorage.key(i); ls[k] = localStorage.getItem(k); } return {s: JSON.parse(ls['margin.v2']), ls, onbHidden: document.getElementById('onb').hidden}; });
  const ok = untouched && r.s.txns.length===c.expectTx+1 && r.onbHidden && (!c.check || c.check(r.s, r.ls)) && (!c.keys?.['margin.v1'] || r.ls['margin.v1']===JSON.stringify(c.keys['margin.v1'])) && !errs.length;
  if (!ok) fail++;
  console.log(ok?'PASS':'FAIL', c.name, '| load wrote nothing:', untouched, '| txns', r.s.txns.length, '/', c.expectTx+1, '| v', r.s.v, '| snapshots', Object.keys(r.ls).filter(k=>k.includes('.snap.')).length, errs.length? '| errors: '+errs.join('; '):'');
  await ctx.close();
}
console.log(fail ? fail+' FAILED' : 'ALL PASS'); await b.close(); process.exit(fail?1:0); })();
