# Development Workflow

## 1. Team

| Field | Value |
|-------|-------|
| Team name | sidequest |
| Website title | FairFix |
| Problem statement # | 2 (Finance & E-commerce) |

## 2. How to Run the Website

```
Option A (static site): open index.html in a browser.
Option B (local server for BroadcastChannel cross-tab sync): python -m http.server 8080
```

- No installation, no backend, no build step
- **For the two-role live demo:** open `index.html` (or `http://localhost:8080`) in two browser windows side by side (one as Customer, one as Service Provider); requests and responses sync between them

**Main entry file:** `index.html`

## 3. Project Structure

```
FairFix/
├── index.html
├── style.css
├── app.js
├── README.md
└── WORKFLOW.md
```

## 4. Tech Stack

- **HTML, CSS, vanilla JavaScript:** single-page app, no framework, runs by opening `index.html`
- **localStorage (`fairfix:` prefix):** stores reports, requests, offers, and early-access emails in the browser with `try/catch` and an in-memory fallback (no backend needed for a demo)
- **BroadcastChannel / `storage` events:** live cross-tab sync between the Customer and Provider tabs
- **Chart.js 4.4.1 (cdnjs):** Yearly Ledger monthly bar chart and spend-by-service doughnut chart
- **Google Fonts:** `Inter` and `JetBrains Mono` (with `system-ui` / `monospace` fallbacks)
- **Inline SVG:** custom FairFix logo, favicon, and neighbourhood illustration (no external images)
- **Seeded sample data:** 57 sample reports across 4 services / 16 jobs and 2 open requests, labelled as sample data in the site footer

## 5. Development Timeline

| Time | What we did |
|------|-------------|
| First 20 min | Finalized data model (`reports`, `requests`, 4-service/16-job catalogue), `fairfix:` localStorage wrapper, and pure `Stats` module (median, percentiles, outlier filtering, overcharge ratios) |
| 20 - 50 min | Built `style.css` (warm linen & forest sage palette, light/dark `prefers-color-scheme`, responsive 375px layout, range bars, 3D hero diorama & scroll reveal animations) |
| 50 - 85 min | Implemented Customer screens (Price Check, Request & Bargain with 70% floor & 20th-percentile marker, Report & Review with breakdown validation & receipt preview, Yearly Ledger with Chart.js & Suggestions panel) and Provider screens (Job Board, My Price Profile) |
| 85 - 105 min | Wired `BroadcastChannel` + `storage` cross-tab sync, role gating, Landing showcase (hero 3D stage, overcharge checker, Reviews, About Us, Real vs Simulated, Demo Controls), and fixed edge-case bugs |
| Last 15 min | Ran 28-assertion Node.js unit test suite on `Stats`, `Store`, seed data, and INR formatting; verified local server, pushed to GitHub, and prepared submission |

## 6. Team Contributions

| Member | USN | Contributions |
|--------|-----|---------------|
| Aditya Goel | 1ms24ec008 | Data store (`localStorage` + `BroadcastChannel` sync), pure `Stats` engine, Price Check, Request & Bargain logic, Report & Review validation |
| Disha Singh | 1ms24ai019 | UI design system (`style.css`), role gating & navigation, Provider Job Board & Price Profile, Landing showcase & 3D/scroll animations, Yearly Ledger & Chart.js integration |

## 7. Features: Planned vs Implemented

| Feature (from ideation) | Status (Done / Partial / Not done) | Notes |
|-------------------------|------------------------------------|-------|
| Role selector (Customer / Provider) | Done | Landing role buttons + header `Switch role` link; strict screen/nav gating per role |
| Price Check (median, range, report count) | Done | Includes labour/material/visit split bar, provider trust snippets, and custom typing fields |
| Overcharge checker | Done | Classifies quotes as Fair / High / Very High with rupee diff and copyable counter script; on Landing & Price Check |
| Post Request & Bargain | Done | Live offer marker, Counter / Accept / Walk away flow, "Deal Confirmed" panel prefilling Report form |
| Provider job board (Accept / Decline / Counter) | Done | Shows neighbour median & "At or above fair" / "Below fair" badge beside every offer, service/fairness filters, and history |
| Post Report / Review | Done | Validates `labour + material + visit === total`, 30-day hold toggle, would-call-again toggle, optional local receipt preview (`Verified` tag) |
| Yearly Ledger | Done | Total spend, savings vs median, monthly bar & service doughnut charts, provider breakdown, repeat-repair flags, suggestions panel, `Load sample year` |
| Fair-offer marker and price floor | Done | Warns below 20th percentile and blocks offers below 70% of median with inline explanation |
| Live cross-tab sync | Done | `BroadcastChannel('fairfix-sync')` with `window` `storage` event fallback |
| Trust rules (min 3 reports, outliers, Verified tag) | Done | Shows "Not enough data yet (n = X)" when `n < 3`; excludes `>50%` outliers into a separate Unusual Reports list |
| Printable ledger summary | Done | `Print` button paired with `@media print` stylesheet hiding nav/controls |

## 8. AI Prompt Log (Phase 2 - maximum 5 prompts)

**Platform used:** Claude (free version)

| # | Time | Member | Prompt (summary) | How the answer was used |
|---|------|--------|------------------|-------------------------|
| 1 | 00:35 | Aditya Goel | Explained `BroadcastChannel` vs `storage` event fallback behaviour across browser tabs | Used to implement cross-tab sync with fallback in `Store.initSync()` |
| 2 | 01:10 | Disha Singh | Clarified CSS `perspective` and `preserve-3d` layering for card hover/tilt effects | Used to structure the 3D hero showcase layers in `style.css` |

- Log only prompts actually sent during Phase 2
- Allowed: concepts, syntax, logic explanations, debugging
- Not allowed: generating the website, pages or sections of source code

## 9. Challenges & How We Solved Them

- **Chart.js SRI hash blocking script execution:** An incorrect `integrity` hash on the Chart.js cdnjs `<script>` tag blocked Chart.js from loading, causing `Chart is not defined` during `Ledger.init()` and halting `Provider.init()`. Removed the mismatched `integrity` attribute and added `typeof Chart === 'undefined'` guards in both chart renderers.
- **Empty-state canvas destruction in Yearly Ledger:** Replacing `ctx.parentElement.innerHTML` when a user had 0 personal reports destroyed `<canvas id="ledger-service-chart">`, so clicking `Load sample year` afterwards could not render the doughnut chart. Fixed by hiding the `<canvas>` and toggling a sibling `.chart-empty-msg` element instead.
- **Screen isolation across roles:** Added `.role-screen { display: none; }` and `.role-screen.active { display: block; }` in `style.css` so only the active role's active screen renders.
- **Cross-tab `storage` fallback:** Updated `App.initSync()` to handle `{ type: 'STORAGE' }` events in addition to `BroadcastChannel` messages (`REQUEST_ADDED`, `REQUEST_UPDATED`, `REPORT_ADDED`).
- **`Stats` module decoupling:** `Stats.overchargeLevel` initially referenced `UI.fmt`, throwing a `ReferenceError` when tested standalone; replaced with a local `_fmt` helper inside `Stats` so the module stays pure and testable.

## 10. Known Limitations & Future Improvements

**Limitations**
- Role-based access is front-end only (demo roles, no real authentication)
- Data is stored per browser, so live sync works only across tabs on one device
- All prices are seeded sample data, and the neighbour circle (`RAMAIAH-BLK-A`) and verification are simulated
- No payments, booking or post-job rating flow

**Future improvements**
- Real accounts and verified neighbour circles (apartment or society onboarding)
- Backend database so data is shared across devices
- Receipt and quote verification
- Provider profiles and availability

## 11. Credits

- Chart.js (https://www.chartjs.org/) v4.4.1, loaded from cdnjs
- Fonts: `Inter` and `JetBrains Mono` via Google Fonts (with `system-ui` / `monospace` fallbacks)
- Idea brainstorming during ideation: Claude (see ideation document)
