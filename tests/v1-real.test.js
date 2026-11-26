// First-release users: make data in the v1 build's own UI, then open the new build on the same storage.
const { chromium } = require('playwright'); const fs = require('fs');
const path = require('path'), root = path.join(__dirname,'..');
const NEW = fs.readFileSync(path.join(root,'index.html'),'utf8'); let html = require('child_process').execSync('git show 00de872:index.html', {cwd:root}).toString();
(async()=>{ const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:393,height:852}, serviceWorkers:'block'});
await ctx.route('http://localhost:8765/', r=>r.fulfill({contentType:'text/html', body:html}));
const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.goto('http://localhost:8765/'); await p.waitForTimeout(800);
for (const k of ['4','7','3']){ await p.click('#addBtn'); await p.waitForTimeout(350); await p.click(`[data-k="${k}"]`); await p.click('[data-k="5"]'); await p.click('#saveBtn'); await p.waitForTimeout(400); }
const v1raw = await p.evaluate(()=>localStorage.getItem('margin.v1')); const v1 = JSON.parse(v1raw);
html = NEW; await p.reload(); await p.waitForTimeout(1200);
const toast = await p.evaluate(()=>document.getElementById('toast')?.textContent || document.querySelector('.toast')?.textContent || '');
// finish the new setup, then check the v1 transactions are there and margin.v1 is untouched
await p.click('[data-act="obnext"]'); await p.fill('#obpay','1500'); await p.click('[data-act="obnext"]');
for (let i=0;i<3;i++){ await p.waitForTimeout(300); await p.click('[data-act="obnext"]'); }
await p.waitForTimeout(300); await p.click('[data-act="obfinish"]'); await p.waitForTimeout(400); await p.click('[data-act="obclose"]'); await p.waitForTimeout(400);
await p.reload(); await p.waitForTimeout(900);
const r = await p.evaluate(()=>({s: JSON.parse(localStorage.getItem('margin.v2')), v1: localStorage.getItem('margin.v1')}));
const kept = v1.txns.every(t=>r.s.txns.some(n=>n.id===t.id && n.amt===t.amt && n.date===t.date));
console.log(kept && r.v1===v1raw && !errs.length ? 'PASS':'FAIL', `v1 build | ${v1.txns.length} real v1 txns | all carried into new build: ${kept} | old margin.v1 left untouched: ${r.v1===v1raw} | budgets carried: ${Object.keys(r.s.cats).filter(k=>['groceries','restaurants','rent'].includes(k)).length>0} | toast: "${toast.trim().slice(0,60)}"`, errs.join(';'));
await b.close(); process.exit(kept && r.v1===v1raw && !errs.length ? 0 : 1); })();
