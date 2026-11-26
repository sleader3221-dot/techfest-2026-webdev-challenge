# FairFix 🏘

> **Know the fair price for every home service, straight from your neighbours.**

A neighbourhood price book for home services — plumber, electrician, carpenter, AC repair — built as a fully self-contained, single-page web app with no backend.

---

## 🚀 How to run

Open directly - https://fairfix-eight.vercel.app

1. **Clone / download** the folder containing:
   - `index.html`
   - `style.css`
   - `app.js`

2. **Open `index.html`** directly in any modern browser (Chrome, Firefox, Edge, Safari).  
   No build step. No server. No install. Everything runs client-side.

> **Tip:** For the cross-tab sync demo, open `index.html` from a local web server (e.g. VS Code Live Server or `npx serve .`) so BroadcastChannel works across tabs under the same origin.  
> For a quick check, `python -m http.server` or similar in the project folder works fine.

---

## 🎬 Demo walkthrough (two-tab setup)

### Tab A — Customer
1. Open `index.html` → **Continue as Customer**
2. **Price Check** → Pick `AC Repair → General Service` → see the rate card with median, range bar, provider trust.
3. Try the **Overcharge checker** — enter `₹1800` → see "Very High ⚡"
4. **Request & Bargain** → pick `Plumber → Tap Leak`, write a description, set offer `₹300` → submit.
5. Keep this tab open.

### Tab B — Provider
1. Open another tab with the same `index.html` → **Continue as Provider**
2. Select your name from the dropdown (e.g. *Ravi Plumbing Works*)
3. **Job Board** → see the customer's request appear within 1 second.
4. Click **Counter** → enter a price near the median → Send Counter.

### Back in Tab A (Customer)
5. The request card updates to **Countered** status with the provider's price and note.
6. Click **Accept** → see "Deal Confirmed 🎉"
7. Click **Log this as a Report** → Report form is pre-filled.
8. **Report & Review** → fill in the breakdown → Submit → rate card updates immediately.
9. **Yearly Ledger** → click *Load sample year* to see charts.

### Demo Controls panel (bottom-left)
- **Reset demo data** – wipes localStorage and re-seeds everything.
- **Load sample year** – navigates to Yearly Ledger with seeded data.
- **Simulate provider reply** – waits 2–3 s, then has a seeded provider Accept or Counter your latest open request automatically (great for single-tab demos).

---

## ✅ What's real vs simulated

### Real (all runs in-browser)
| Feature | Details |
|---|---|
| Stats engine | Median, 10th/90th percentile, 20th percentile, outlier detection (>50% from median) |
| Overcharge checker | Ratio to median → Fair / High / Very High + counter script |
| Bargain logic | Fair-offer marker bar, 20th-percentile warning, 70% floor with block |
| Role gating | Customer and Provider see completely separate screens and nav |
| Cross-tab sync | `BroadcastChannel` with `storage` event fallback |
| Yearly ledger | Monthly bar chart, service doughnut, savings vs median, repeat flags |
| localStorage | All reads/writes wrapped in `try/catch`; falls back to in-memory |
| Dark mode | Full `prefers-color-scheme` support via CSS variables |
| Responsive | 375 px mobile to full desktop |

### Simulated (seeded / demo)
| Feature | Why simulated |
|---|---|
| Neighbour circle | Fixed code `RAMAIAH-BLK-A`; no real community auth |
| ~55 sample reports | Realistic INR amounts seeded across 12 months with deliberate outliers |
| 3–4 providers per service | Named providers drawn from seeded data |
| "Simulate provider reply" | 2–3 s timeout; randomly accepts or counters near the median |
| Receipt verification | File picker + `URL.createObjectURL` preview only; no cloud upload |
| Demo logins | No passwords; role selection is a UI toggle |

---

## 🗂 File structure

```
FairFix/
├── index.html   – All HTML: landing, customer screens, provider screens, demo panel
├── style.css    – CSS variables, light/dark, responsive layout, all components
├── app.js       – Commented in 7 sections:
│                   1. STORE   – localStorage, BroadcastChannel, seed data
│                   2. STATS   – pure functions: median, percentile, outliers, overcharge
│                   3. UI      – helpers: toast, range bar, format INR, empty state
│                   4. LANDING – hero, overcharge checker, CTA
│                   5. CUSTOMER – Price Check, Request & Bargain, Report & Review, Ledger
│                   6. PROVIDER – Job Board, My Price Profile
│                   7. BOOT    – App shell, routing, nav, demo controls
└── README.md
```

---

## 🧮 Stats engine reference

All stat functions live in the `Stats` module and are pure (no side-effects, no DOM):

```js
Stats.median(values)                // median of a numeric array
Stats.percentile(values, p)         // p-th percentile (0–100)
Stats.mean(values)                  // arithmetic mean
Stats.jobStats(reports)             // → { n, hasEnough, median, low, high, outliers, clean, p20 }
Stats.overchargeLevel(quote, stats) // → { level, label, ratio, diff, rangeText, script }
Stats.offerPosition(offer, stats)   // → { pct, zone, percentileRank }
Stats.providerStats(reports, name)  // → { n, againPct, heldPct, avgPrice }
```

Outlier rule: a report is excluded from the main stats if `|total − median| / median > 0.50`.  
Minimum n for a valid median: **3 reports**.

---

## 🎨 Design tokens

| Token | Value | Usage |
|---|---|---|
| `--accent` | `#0d7377` (deep teal) | Primary colour, CTAs, range bars |
| `--success` | `#16a34a` | Fair badge, accepted status, savings |
| `--warning` | `#d97706` | High badge, countered status |
| `--danger` | `#dc2626` | Very High badge, floor block |
| Font | Inter (Google Fonts) | All UI |
| Mono font | JetBrains Mono | Prices, amounts |
| Chart.js | 4.4.1 (cdnjs) | Ledger bar + doughnut charts |

---

## 📋 Acceptance checklist

| # | Criterion | Status |
|---|---|---|
| 1 | Landing overcharge checker: Fair / High / Very High | ✅ |
| 2 | Job with < 3 reports shows "Not enough data yet (n = X)" | ✅ |
| 3 | Offer below 70% of median blocked with explanation | ✅ |
| 4 | Request in Customer tab → Provider tab within 1 s; Counter flows back; Accept = Deal Confirmed + prefill | ✅ |
| 5 | Submitting a report changes that job's median/range immediately | ✅ |
| 6 | Ledger charts render for sample year and empty state | ✅ |
| 7 | Provider cannot reach Customer screens and vice versa | ✅ |
| 8 | Works at 375 px and in dark mode | ✅ |

---

*All prices shown are seeded sample data for demonstration purposes only.*
