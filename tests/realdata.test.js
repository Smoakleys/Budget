// Real-data upgrade test: make data with an actually released build's UI, switch the same origin to the new build,
// and prove nothing changed or went missing. Then switch back to the old build (stale cache case).
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
// Usage: node tests/realdata.test.js [commit ...]   (defaults: every released build that used margin.v2)
const root = path.join(__dirname,'..'), git = c => require('child_process').execSync('git show '+c+':index.html', {cwd:root, maxBuffer:1<<26}).toString();
const NEW = fs.readFileSync(path.join(root,'index.html'),'utf8');
const builds = process.argv.slice(2).length ? process.argv.slice(2) : ['fbad77d','d5faffd'];
const dump = p => p.evaluate(()=>{ const o={}; for (let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); o[k]=localStorage.getItem(k); } return o; });
const eq = (a,b) => JSON.stringify(a)===JSON.stringify(b);
(async()=>{ const b = await chromium.launch(); let fail = 0;
for (const bf of builds){
  let html = git(bf);
  const ctx = await b.newContext({viewport:{width:393,height:852}, serviceWorkers:'block'});
  await ctx.route('http://localhost:8765/', r=>r.fulfill({contentType:'text/html', body:html}));
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  // 1. Real use of the old build: setup, then log expenses and income through its own UI.
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(800);
  await p.click('[data-act="obnext"]'); await p.fill('#obpay','1850.50'); await p.click('[data-act="obnext"]');
  for (let i=0;i<3;i++){ await p.waitForTimeout(300); await p.click('[data-act="obnext"]'); }
  await p.waitForTimeout(300); await p.click('[data-act="obfinish"]'); await p.waitForTimeout(400); await p.click('[data-act="obclose"]'); await p.waitForTimeout(400);
  for (const k of ['4','7','1','9']){ await p.click('.add'); await p.waitForTimeout(350); await p.click(`[data-act="key"][data-k="${k}"]`); await p.click(`[data-act="key"][data-k="2"]`); await p.click('#saveTx'); await p.waitForTimeout(350); }
  await p.reload(); await p.waitForTimeout(800);
  const before = await dump(p), oldS = JSON.parse(before['margin.v2']);
  // 2. Upgrade: same origin, same storage, new build.
  html = NEW; await p.reload(); await p.waitForTimeout(1200);
  const afterLoad = await dump(p);
  const untouched = Object.keys(before).every(k=>afterLoad[k]===before[k]);
  const shows = await p.evaluate(()=>document.getElementById('onb').hidden && document.getElementById('app').innerHTML.length > 2000);
  // 3. Keep using it, reload, check every old record and field is intact.
  await p.click('.add'); await p.waitForTimeout(350); await p.click('[data-act="key"][data-k="5"]'); await p.click('#saveTx'); await p.waitForTimeout(500);
  await p.reload(); await p.waitForTimeout(900);
  const newS = JSON.parse((await dump(p))['margin.v2']);
  const txKept = oldS.txns.every(t=>newS.txns.some(n=>eq(n,t))) && newS.txns.length===oldS.txns.length+1;
  const fieldsKept = Object.keys(oldS).filter(k=>!['txns','updatedAt'].includes(k)).every(k=>eq(oldS[k], newS[k]));
  const changed = Object.keys(oldS).filter(k=>!['txns','updatedAt'].includes(k) && !eq(oldS[k], newS[k]));
  const snaps = Object.keys(await dump(p)).filter(k=>k.includes('.snap.')).length;
  // 4. Downgrade: a phone still running the cached old build opens the upgraded data.
  html = git(bf); await p.reload(); await p.waitForTimeout(1000);
  const back = await p.evaluate(()=>({onbHidden: document.getElementById('onb').hidden, tx: JSON.parse(localStorage.getItem('margin.v2')).txns.length}));
  const downOk = back.onbHidden && back.tx===newS.txns.length;
  const ok = untouched && shows && txKept && fieldsKept && downOk && !errs.length; if (!ok) fail++;
  console.log(ok?'PASS':'FAIL', 'build '+bf, `| ${oldS.txns.length} real txns, paycheck ${oldS.income.paycheck} | load changed nothing: ${untouched} | app shows data: ${shows} | every txn intact: ${txKept} | every field intact: ${fieldsKept}${changed.length?' ('+changed+')':''} | snapshots: ${snaps} | old build still opens it: ${downOk}`, errs.length?'| errors: '+errs:'');
  await ctx.close();
}
console.log(fail? fail+' FAILED':'ALL PASS'); await b.close(); process.exit(fail?1:0); })();
