# Tech Fest 2026 — Ideation-Based Web Development Challenge

> **Think creatively. Build independently. Use AI responsibly.**

This is the official submission repository for the challenge. Every team submits its work here, on its own branch.

| | |
|---|---|
| **Event date** | Thursday, 26 November 2026 |
| **Reporting** | 9:30 AM |
| **Competition** | 10:00 AM – 1:30 PM |
| **Teams** | Max 30 teams · 1 to 3 members each |
| **Ideation upload deadline** | **11:00 AM** |
| **Final submission deadline** | **1:30 PM** (sharp) |

---

## Participants: start here

**[Step-by-step submission guide (docs/SUBMISSION_GUIDE.md)](docs/SUBMISSION_GUIDE.md)**: read it before the event.

Short version:

1. At registration you get a **team number**. Your branch is **`team-NN`** (e.g. `team-07`).
2. On GitHub, switch to your branch. Your folder `submissions/team-NN/` is already there.
3. **By 11:00 AM:** fill in `ideation/IDEATION.md` and add any images to `ideation/`.
4. **By 1:30 PM:** upload the two required items:

| # | Item | File |
|---|------|------|
| **A** | Team information: team name, every member's name, USN, email, phone, branch name | `TEAM_INFO.txt` (already in your folder; edit it) |
| **B** | **ONE ZIP** with the complete website plus a `WORKFLOW.md` describing your development workflow | `team-NN.zip` |

5. Look for the **green ✔** next to your latest commit. A **red ✘** means something is missing. Click it to see what to fix.

Never upload to `main`, and never touch another team's folder.

## Repository layout

```
├── README.md                      ← you are here
├── competition.json               ← event configuration (dates, deadlines, limits)
├── docs/
│   ├── SUBMISSION_GUIDE.md        ← participants: how to submit (step by step)
│   ├── RULES.md                   ← rules summary, incl. AI-usage rules
│   ├── ORGANIZER_GUIDE.md         ← organizers: setup, event-day runbook, judging
│   └── official/                  ← official guidelines (.docx) and briefing (.pptx)
├── templates/
│   ├── TEAM_INFO.txt              ← team information file template
│   ├── IDEATION.md                ← Phase 1 ideation template
│   ├── WORKFLOW.md                ← workflow doc to put INSIDE your ZIP
│   └── github_usernames.csv       ← organizers: access list template
├── submissions/                   ← team folders live on the team-NN branches
├── tools/                         ← validation and organizer automation (Python 3.9+, no dependencies)
└── .github/workflows/             ← automatic submission check on every push
```

## Rules at a glance

- Choose **one** of the five problem statements announced at 10:00 AM.
- Use **one** AI platform per team, free versions only (ChatGPT, Claude or Gemini).
- In Phase 2 you may send **at most 5 AI prompts**, and only for concepts, syntax, logic and debugging.
- **Do not use AI to generate the website or its source code.** Doing so leads to **immediate disqualification**.
- Late or incomplete submissions may not be evaluated. The judges' decisions are final.

Full rules: [docs/RULES.md](docs/RULES.md)
