# Margin

A private personal-finance app for iPhone, built as an installable web app. One data model drives every screen: paychecks fund the plan, the plan drives the forecast, the what-if simulator forks the forecast, and Next actions read all of it.

- **Overview** – safe to spend until payday (the smaller of what cash allows after bills and set-asides, and what the plan allows), the top next actions, a 12-month net worth forecast, budgets, debt and recent activity.
- **Plan** – paycheck by paycheck: each bill is paid from the check that lands before it's due; everyday spending, savings and extra debt payments are split by days. Shortfalls are flagged. The Categories view is the monthly budget.
- **Future** – a 1/2/5-year forecast of net worth, cash, debt and savings, with a what-if simulator (raise, spending cut, extra debt, new monthly cost, one-time cost, income gap, lump sums) and the debt elimination engine (avalanche vs snowball, rollover, payoff order, this month's payments).
- **Next actions** – bills due before payday, paycheck shortfalls, forecast cash dips, budgets running hot, unassigned money, cushion gaps, extra-paycheck months, logging gaps, subscriptions. Each can be snoozed.
- **Copilot** – with a Claude API key (Settings → Copilot), questions go straight from the phone to the Claude API with a summary the app computes; Claude can run the app's own forecast and debt engine as tools. Without a key it answers common questions offline from the same engine.
- **Receipt scanner** – the Scan button in the add sheet. With a key, Claude reads the photo (merchant, date, total, line items by category, optional split). Without one, Tesseract OCR runs on the phone and a parser finds the total and date. You review before anything is saved.

## Privacy and saving

Data lives in the browser's local storage on the device. Setup progress is saved as you go, and the app warns if the browser refuses to save (Private Browsing). Settings has **Back up to a file** and **Restore from a file**.

### Data safety rules (don't break these)

- `load()` never writes. A record it can't parse is copied to `margin.v2.unreadable` and the newest snapshot is used instead.
- Schema changes go through `MIGRATIONS` and only add. Unknown fields are carried along, and the stored `v` is never lowered, so an older cached build can't strip what a newer one wrote. The first release's `margin.v1` data is carried over and the old key is left in place.
- Snapshots (`margin.v2.snap.*`, newest 12) are taken daily and before every upgrade, sync replace, restore, rollback, setup re-run, erase and sign-out. Settings → Snapshots rolls back to any of them.
- Sync is three-way against the last account copy this device saw. If both sides changed, transactions, loans and custom categories are merged by id (deletes are tracked so they stick). Empty or sample data is never uploaded, and sign-out refuses if the upload fails.
- The service worker only manages its own caches; it never touches storage.

Tests (Playwright): `python3 -m http.server 8765` in the repo root, then `node tests/realdata.test.js` (makes data with each released build's own UI, upgrades, downgrades), `node tests/v1-real.test.js`, `node tests/upgrade.test.js`, `node tests/sync.test.js`, `node tests/persist.test.js`. Run the upgrade test before every release that touches state, and add a case to it for any new shape.

Optional accounts: fill `SYNC_URL` and `SYNC_KEY` in `index.html` with a Supabase project URL and its public anon key, and the app shows email + password sign-in and syncs one row per user (table `margin_state`, row-level security on). With those empty, accounts stay hidden and nothing leaves the device. The Claude API key is never synced or exported; Copilot questions and receipt photos go only to Anthropic with your own key.

## Install

Open the site in Safari, tap Share, then **Add to Home Screen**. It launches full screen and works offline (Copilot and the first on-device scan need a connection).

## Develop

No build step. Serve the folder and open it:

```sh
python3 -m http.server 8000
```

Add `?demo` to the URL to load sample data. Pushes to `main` deploy to GitHub Pages via `.github/workflows/pages.yml`. Bump `VERSION` in `sw.js` with each release so installed copies update.
