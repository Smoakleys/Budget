# Margin

A private personal-finance app for iPhone, built as an installable web app. One data model drives every screen: paychecks fund the plan, the plan drives the forecast, the what-if simulator forks the forecast, and Next actions read all of it.

- **Overview** – safe to spend until payday (the smaller of what cash allows after bills and set-asides, and what the plan allows), the top next actions, a 12-month net worth forecast, budgets, debt and recent activity.
- **Plan** – paycheck by paycheck: each bill is paid from the check that lands before it's due; everyday spending, savings and extra debt payments are split by days. Shortfalls are flagged. The Categories view is the monthly budget.
- **Future** – a 1/2/5-year forecast of net worth, cash, debt and savings, with a what-if simulator (raise, spending cut, extra debt, new monthly cost, one-time cost, income gap, lump sums) and the debt elimination engine (avalanche vs snowball, rollover, payoff order, this month's payments).
- **Next actions** – bills due before payday, paycheck shortfalls, forecast cash dips, budgets running hot, unassigned money, cushion gaps, extra-paycheck months, logging gaps, subscriptions. Each can be snoozed.
- **Copilot** – with a Claude API key (Settings → Copilot), questions go straight from the phone to the Claude API with a summary the app computes; Claude can run the app's own forecast and debt engine as tools. Without a key it answers common questions offline from the same engine.
- **Receipt scanner** – the Scan button in the add sheet. With a key, Claude reads the photo (merchant, date, total, line items by category, optional split). Without one, Tesseract OCR runs on the phone and a parser finds the total and date. You review before anything is saved.

## Privacy

Data lives in the browser's local storage on the device. This repo is code only; there is no server, database, or analytics. The only data that ever leaves the phone is a Copilot question or receipt photo sent to Anthropic with your own API key. The key is stored on the device and is not exported.

## Install

Open the site in Safari, tap Share, then **Add to Home Screen**. It launches full screen and works offline (Copilot and the first on-device scan need a connection).

## Develop

No build step. Serve the folder and open it:

```sh
python3 -m http.server 8000
```

Add `?demo` to the URL to load sample data. Pushes to `main` deploy to GitHub Pages via `.github/workflows/pages.yml`. Bump `VERSION` in `sw.js` with each release so installed copies update.
