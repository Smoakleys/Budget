# Margin

A private budget tracker for iPhone, built as an installable web app.

- **Your data never leaves your phone.** Transactions and budgets live in the browser's local storage on the device. This repo contains code only; there is no server, database, or analytics.
- **Install:** open the site in Safari, tap Share, then **Add to Home Screen**. It launches full screen and works offline.
- **Back up:** Budgets tab → Export CSV copies every transaction to the clipboard.

## Develop

No build step. Serve the folder and open it:

```sh
python3 -m http.server 8000
```

Add `?demo` to the URL to load sample data. Pushes to `main` deploy to GitHub Pages via `.github/workflows/pages.yml`. Bump `VERSION` in `sw.js` with each release so installed copies update.
