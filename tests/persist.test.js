// Setup + reload persistence for every pay frequency. Run: node tests/persist.test.js [url]
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8765/';
(async()=>{ const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:393,height:852}}); const p = await ctx.newPage();
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
for (const freq of ['weekly','biweekly','semimonthly','monthly']) {
  await p.goto(URL); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(800);
  await p.click('[data-act="obnext"]'); await p.fill('#obpay','1500'); await p.click(`[data-act="obfreq"][data-f="${freq}"]`); await p.click('[data-act="obnext"]');
  for (let i=0;i<3;i++){ await p.waitForTimeout(300); await p.click('[data-act="obnext"]'); }
  await p.waitForTimeout(300); await p.click('[data-act="obfinish"]'); await p.waitForTimeout(400); await p.click('[data-act="obclose"]'); await p.waitForTimeout(400);
  await p.click('.add'); await p.waitForTimeout(400); await p.click('[data-act="key"][data-k="7"]'); await p.click('#saveTx'); await p.waitForTimeout(400);
  await p.reload(); await p.waitForTimeout(1000);
  const st = await p.evaluate(()=>{ const s = JSON.parse(localStorage.getItem('margin.v2')); return {onb:s&&s.onboarded, tx:s&&s.txns.length, onbVisible: !document.getElementById('onb').hidden, appLen: document.getElementById('app').innerHTML.length}; });
  console.log(freq, JSON.stringify(st));
}
console.log(errs.join('\n')||'no errors'); await b.close(); })();
