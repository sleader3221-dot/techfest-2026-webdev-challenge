# FinLens — Financial Product Discovery & Loan Affordability Platform

**See every card, loan, and EMI with clarity.**

**FinLens** is a web-based financial planning and product discovery platform that helps users explore debit and credit cards, match cards to their monthly spending habits, plan goal-based loans, and evaluate whether a proposed loan repayment fits their monthly budget—all in one numbers-first, transparent interface.

> **Prototype & Estimation Disclaimer:** FinLens is an information and estimation prototype powered by curated sample and reference datasets and deterministic financial calculations. It does **not** connect to live bank accounts, pull credit reports, approve loans, guarantee card/loan eligibility, process payments, or provide personalized financial or legal advice.

## Table of Contents

1. [The Idea & Problem Statement](#1-the-idea--problem-statement)

2. [Key Features & User Journeys](#2-key-features--user-journeys)

3. [Financial Formulas & Decision Rules](#3-financial-formulas--decision-rules)

4. [Architecture & Project Structure](#4-architecture--project-structure)

5. [Backend REST API Reference](#5-backend-rest-api-reference)

6. [Getting Started & Running Locally](#6-getting-started--running-locally)

7. [Data Integrity & Scope Limitations](#7-data-integrity--scope-limitations)

## 1\. The Idea & Problem Statement

### Why FinLens Exists

Consumers evaluating banking cards or planning major life goals (such as buying a vehicle or home, funding education, or covering an emergency) often have to jump across multiple websites to compare fees, eligibility rules, and loan terms. In addition, borrowers frequently focus on a headline monthly EMI without checking how that repayment stacks alongside existing EMIs and monthly living expenses.

### How FinLens Solves It

FinLens brings product comparison, spend-based card ranking, goal-based loan estimation, and budget-first EMI evaluation into a single cohesive workflow:

* **Card Discovery \+ Side-by-Side Comparison:** Browse and compare debit and credit cards across account tiers (*Basic, Standard, Premium, Platinum*) with clear disclosure when issuer details are unlisted (`"Not published"`).

* **Spend-Based Net Benefit Ranking:** Evaluate cards against actual monthly spending across categories and rank them by **estimated net annual rupee savings** after factoring in annual fees and spend-based fee waivers.

* **Goal-to-Loan Planning:** Map life goals to realistic loan amount and tenure boundaries, adjust estimated interest rates by CIBIL score band, and hand off any offer directly into affordability checking.

* **Zero-Double-Counting Affordability Check:** Calculate **FOIR** (Fixed Obligation to Income Ratio) and **Disposable Income** while keeping living expenses (excluding EMIs) distinct from existing debt obligations.

### Target Users

* **Students & First-Time Account Holders:** Comparing zero-fee or starter debit and credit cards.

* **Everyday Spenders:** Finding which card yields the highest net annual rupee value for their specific monthly spend mix.

* **Goal-Based Borrowers:** Estimating EMIs and checking monthly budget safety before committing to debt.

* **Beginners:** Learning how reducing-balance EMIs, FOIR thresholds, and net card rewards work through visible formulas.

## 2\. Key Features & User Journeys

### Home Dashboard & Browser Budget Profile (`localStorage`)

* Quick-launch entry points into **Debit Cards**, **Credit Cards**, **Match My Spends**, **Plan a Goal**, and **EMI Check**.

* Optional browser-saved budget profile (`localStorage`) storing monthly take-home income, living expenses, existing EMIs, and CIBIL band so values can be reused across tools without requiring sign-up or backend persistence of personal budgets.

### Debit & Credit Card Explorer & 3-Card Comparison

* Switch between **Debit Cards** and **Credit Cards**.

* Search by bank or card name, filter by tier, annual fee band, network (*Visa, Mastercard, RuPay*), and perks (*Lounge access, Cashback/Rewards, Insurance cover, Fee waiver*), and sort by popularity, rewards/cashback, beginner friendliness, or lowest annual fee.

* Select up to **3 cards** for a side-by-side comparison table that highlights strong values and displays `"Not published"` when an issuer field is not listed.

### Smart Card Suggestion Engine ("Match My Spends")

* Evaluates monthly spending across card-eligible categories—**Online Shopping** (`online`), **Dining & Food Delivery** (`dining`), **Travelling, Flights & Hotels** (`travel`), **Groceries, Utilities & UPI Bills** (`utility`), and **Offline Retail & Everyday Swipes** (`offline`)—while keeping **Rent & Fixed Living** (`living`) separate from rewardable card spends.

* Computes **Gross Annual Rewards**, checks **Annual Fee Waiver** eligibility, subtracts the **Effective Annual Fee**, and ranks cards by **Net Annual Savings**.

### Plan-a-Goal Loan Planner

* Supports 9 life goals (*Car / Vehicle, Home / Property, Education, Personal / Wedding, Medical / Emergency, Business, Consumer Durable, Debt Consolidation,* and *Other*) mapped to loan categories with realistic amount and tenure bounds.

* Adjusts estimated rates across CIBIL bands (`Below 650`, `650–699`, `700–749`, `750–799`, `800+`) or displays an EMI range when `"Not sure"` is chosen.

* Supports sorting by lowest rate, lowest EMI, fastest disbursal, or popularity, comparing up to 3 offers, and sending a chosen loan directly into **EMI Check**.

### EMI Affordability Advisor (EMI Check)

* Supports calculating proposed EMI from **Loan Amount \+ Interest Rate \+ Tenure** or entering a **known monthly EMI** directly.

* Displays a semicircular **FOIR gauge**, a stacked monthly cashflow breakdown bar, and exact formulas for proposed EMI, total interest/repayment, FOIR, and disposable income.

* Applies a CIBIL score strictly as an eligibility caveat—never overriding an unaffordable budget result.

## 3\. Financial Formulas & Decision Rules

### A. Card-Eligible Spend & Net Annual Savings

For card-eligible monthly category spends `s_c` across categories `c` in `{online, dining, travel, utility, offline}`:

* **Annual Eligible Spend:** `12 × sum(s_c)` across all card-eligible categories  
* **Gross Annual Rewards:** `sum(s_c × 12 × rate_c)` across all card-eligible categories

For a credit card with an annual fee waiver threshold (`hasWaiver === true` and `waiverSpend > 0`):

* **Effective Annual Fee:** `0` if the credit card has a waiver and `Annual Eligible Spend >= waiverSpend`; otherwise `annualFee`  
* **Net Annual Savings:** `Gross Annual Rewards − Effective Annual Fee`

### B. Reducing-Balance Monthly EMI

Given principal loan amount `P`, annual interest rate `R` (in percent), and tenure `n` in months, with monthly interest rate `r = R / (12 × 100)`:

* When `r = 0`: `EMI = P / n`  
* When `r > 0`: `EMI = (P × r × (1 + r)^n) / ((1 + r)^n − 1)`

### C. FOIR & Monthly Disposable Income

Let `I` be monthly take-home income, `E_living` be monthly living expenses (excluding loan EMIs), `E_existing` be existing monthly EMIs, and `E_proposed` be the proposed monthly EMI:

* **FOIR (%):** `((E_existing + E_proposed) / I) × 100`  
* **Disposable Income:** `I − E_living − E_existing − E_proposed`

### D. Affordability Verdict Thresholds

The verdict takes the more cautious outcome of **FOIR (%)** and **Remaining Disposable Income Share** (`(Disposable Income / I) × 100`):

| Verdict | FOIR (%) | Disposable Income Left (% of Income) |
| :---- | :---- | :---- |
| **Good** | `<= 35%` | `>= 20%` |
| **Manageable** | `> 35%` to `45%` | `10%` to `< 20%` |
| **Risky** | `> 45%` to `55%` | `5%` to `< 10%` |
| **Not Recommended** | `> 55%` | `< 5%`, zero, or negative |

## 4\. Architecture & Project Structure

FinLens uses a lightweight **HTML5 \+ CSS3 \+ Vanilla JavaScript** frontend paired with an optional **Node.js \+ Express** server:

* **Standalone / Static Mode:** Opening `index.html` directly in a browser works immediately using built-in data and client-side calculations, persisting optional user profile settings in `localStorage`.

* **Server / API Mode:** Running `server.js` serves static assets and exposes REST endpoints backed by `data/cards.json` and `data/loan-offers.json` so frontend calculations and API responses can be tested or inspected directly.

```
finlens/
├── index.html              # Single-file web application (UI, client state, & interactive tools)
├── server.js               # Express server & REST API endpoints
├── package.json            # Node.js dependencies and start script
├── .gitignore              # Ignored files (e.g., node_modules)
├── README.md               # Project documentation
└── data/
    ├── cards.json          # Card catalog dataset (fees, tiers, networks, perks, reward rates)
    └── loan-offers.json    # Sample loan offer dataset across loan categories
```

5\. Backend REST API Reference

When `server.js` is running (default port `3000`), the following endpoints are available:

| Method & Endpoint | Description | Query / Body Parameters |
| :---- | :---- | :---- |
| `GET /api/health` | Service health check and prototype disclaimer | None |
| `GET /api/cards` | Returns cards from `data/cards.json` | Optional query: `type` (`debit`, `credit`), `tier` (`Basic`, `Standard`, `Premium`, `Platinum`) |
| `GET /api/loan-offers` | Returns sample loan offers from `data/loan-offers.json` | Optional query: `category` (e.g., `Auto Loan`, `Home Loan`, `Personal Loan`) |
| `POST /api/suggest-cards` | Ranks cards by net annual savings for a given spend mix | JSON body: `{ "type": "all", "spends": { "online": 5000, "dining": 4000, "travel": 3000, "utility": 4000, "offline": 2000 } }` |
| `POST /api/calculate-affordability` | Computes FOIR, disposable income, and affordability verdict | JSON body: `{ "income": 80000, "expenses": 30000, "existingEmis": 5000, "proposedEmi": 19360 }` |

## 6\. Deployed Version

[FinLens — Financial Product Discovery & Loan Affordability Platform](https://finlens-t8cv.onrender.com/)&nbsp;

GitHub repo (`[https://github.com/Aman-2040/Finlens](https://github.com/Aman-2040/Finlens)`)&nbsp;

\*deployed on render

## 7\. Data Integrity & Scope Limitations

* **No Live Integrations:** FinLens does not integrate with bank APIs, account aggregators, payment gateways, or credit bureaus.

* **No Guessing Unlisted Fields:** Fields not published for a given card are surfaced as `"Not published"` rather than fabricated.

* **Headline Rates in Spend Calculations:** Card savings estimates use headline category reward rates and spend-based annual fee waiver thresholds, and do not model every issuer-specific monthly cap, merchant exclusion, or promotional tier.

* **Illustrative Loan Offers:** Sample loan offers, rate ranges, processing fees, and disbursal timelines are for demonstration only; actual terms and approvals are determined solely by lenders.