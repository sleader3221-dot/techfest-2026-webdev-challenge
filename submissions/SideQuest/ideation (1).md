# Ideation Submission

## 1. Proposed Website Title

- **FairFix**
- *Tagline: Know the fair price for every home service, straight from your neighbours.*

## 2. Problem Statement Selected

**Problem statement number:** 2 (Finance & E-commerce)

- Home repairs (plumbing, electrical, carpentry, AC service) are recurring, unplanned expenses with no price transparency
- Quotes vary by how affluent the customer looks, and most people find out they overpaid only later
- Existing platforms show ratings or listed prices, not what neighbours actually paid
- Affects every household, PG and hostel, and silently drains money every year

## 3. Target Users

- **Customers:** residents of apartments, PGs and hostels who need local repair services
  - Need: know a fair price, negotiate with data, track repair spending
- **Service providers:** local plumbers, electricians, carpenters and other home-service workers
  - Need: see nearby job requests with fair-price context, and accept, decline or counter

## 4. Proposed Solution

- Neighbourhood price book where neighbours report what each job actually cost
- **Name Your Price:** customers post a request with their own offer, and providers accept, decline or counter
- Role-based access: separate Customer and Provider views
- **Fair-offer marker** based on neighbour data, so bargaining is informed
- **Fair-price floor** blocks extremely low offers, so it doesn't become a race to the bottom
- Yearly ledger turns repair spending into trends and savings
- **What's different:**
  - Peer-reported actual prices, not listed or quoted ones
  - Bargaining anchored on real data
  - Reviews at job level: price, split, time taken, and whether the fix held after 30 days

## 5. Key Features & Functionalities

| # | Feature | What it does | Priority (Must / Should / Nice) |
|---|---------|--------------|---------------------------------|
| 1 | Role selector | Customer or Provider entry, each with its own screens | Must |
| 2 | Price Check | Median, range and report count per job; labour vs material split | Must |
| 3 | Overcharge checker | Enter a quote and get Fair / High / Very high plus a counter-script | Must |
| 4 | Post Request & Bargain | Post a request with your offer; track Pending, Countered, Accepted, Declined | Must |
| 5 | Provider job board | View open requests with the neighbour median; Accept, Decline or Counter | Must |
| 6 | Post Report / Review | Job, price paid, cost split, time taken, 30-day "did it hold?", "would call again" | Must |
| 7 | Yearly Ledger | Monthly spend chart, category breakdown, savings vs median, repeat-repair flags | Must |
| 8 | Fair-offer marker and price floor | Warns on low offers and blocks offers below about 70% of the median | Should |
| 9 | Live cross-tab sync | A request posted in the Customer tab appears instantly in the Provider tab | Should |
| 10 | Trust rules | Minimum 3 reports before showing a median; outliers flagged; Verified tag for proof | Should |
| 11 | Printable ledger summary | Export or print the yearly summary | Nice |

## 6. Pages & User Flow

- **Landing:** hero with the overcharge checker, how it works, what's real vs simulated, early-access CTA
- **Role select:** Customer or Provider
- **Customer screens:**
  - Price Check
  - Request & Bargain
  - Report & Review
  - Yearly Ledger
- **Provider screens:**
  - Job Board
  - My Price Profile
- **Flow:**
  - Customer: Landing → Customer → Price Check → Post Request with offer → Counter or Accept → Deal done → Log report → Ledger updates
  - Provider: Landing → Provider → Job Board → Accept / Decline / Counter → Status updates in the customer view

## 7. Planned Tech Stack

- HTML, CSS, vanilla JavaScript (single page, no backend)
- Browser storage for data (localStorage, with try/catch and empty-state handling)
- BroadcastChannel / storage events for live cross-tab sync
- Chart.js (via cdnjs) for ledger charts
- Seeded sample data (JSON in the script), labelled as sample data

## 8. Visual Concepts, Images & References

- Sketches and wireframes: to be added
- **References (for inspiration only, not copied):**
  - Urban Company
  - Justdial
  - Google Maps reviews
- **Visual direction:** clean, trust-focused look with a rupee-first layout; price ranges shown as bars, green (fair) to red (high)

## 9. Development Plan (approx. 2 hours)

| Time | Task | Member |
|------|------|--------|
| T+0 to T+20 min | Setup, shared data store, seeded data, price stats engine | Member 1 |
| T+0 to T+20 min | UI base: layout, theme, role selector, navigation | Member 2 |
| T+20 to T+50 min | Customer Price Check and overcharge checker | Member 1 |
| T+20 to T+50 min | Provider job board UI | Member 2 |
| T+50 to T+85 min | Request & Bargain logic with live cross-tab sync | Member 1 |
| T+50 to T+85 min | Request & Bargain UI, landing page and showcase sections | Member 2 |
| T+85 to T+105 min | Report & Review screen | Member 1 |
| T+85 to T+105 min | Yearly Ledger with charts | Member 2 |
| T+105 to T+120 min | Integration, two-tab testing of both roles, polish, demo rehearsal | Member 1 + 2 |

## 10. AI Usage During Ideation

**Platform used (only ONE, free version):** Claude / Antigravity

- Brainstorming and filtering ideas against the problem statements
- Refining the concept and feature list
- Pointing out risks (cold start, race to the bottom) and how to handle them honestly
- The idea, role design, screens and final decisions are our team's own
