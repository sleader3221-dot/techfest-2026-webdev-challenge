# Organizer Guide

Everything organizers need: one-time setup, the event-day runbook, and collecting results for the judges.
All tools are Python 3.9+ standard library. You also need `git` and the GitHub CLI (`gh auth login`).

---

## 1. How the system works

```
                    main  (protected: organizers only)
                     │   rules, guides, templates, validator
       ┌─────────────┼─────────────┬───────── … ─────────┐
    team-01       team-02       team-03                team-30    ← one pre-created branch per team
       │             │             │
 submissions/team-01/   (each team edits ONLY its own folder on its own branch)
   ├── TEAM_INFO.txt
   ├── ideation/IDEATION.md (+ images)
   └── team-01.zip

 every push ──► GitHub Actions validator ──► ✔ / ✘ + report + server timestamp
 1:30 PM    ──► manage_repo.py lock  (branches become read-only)
 after      ──► collect_submissions.py ──► evaluation/  (report, contacts, unzipped sites)
```

**Why it is designed this way**
- **Branch per team:** this matches the official requirement to report a "GitHub branch name". Teams cannot overwrite each other, and the branch history shows exactly what changed and when.
- **Pre-created branches and folders:** participants only *edit* and *upload* in the browser. They never type paths or branch names under time pressure.
- **Server-side timing:** commit dates can be faked, but GitHub's push log cannot. The collector evaluates the **last push made before 1:30 PM** and ignores anything later. Late pushes are listed, not silently accepted.
- **Validator from `main`:** the Actions workflow and the collector always use the official validator, so teams cannot weaken the checks.

---

## 2. One-time setup (do it the day before)

### 2.1 Account: use a GitHub Organization (recommended)

Use a **free GitHub Organization** rather than a personal account, e.g. `techfest-2026-webdev`:
- the repository isn't tied to one person, and several coordinators can be admins
- you can switch collaborators to **read-only** at the deadline, which works even on private repos

Create it at https://github.com/account/organizations/new → plan **Free**. Invite your co-organizers as **Owners**.

### 2.2 Public or private?

| | Public repo | Private repo (free org) |
|---|---|---|
| Participants' emails, USNs and phones | ⚠️ **visible to anyone on the internet** | ✅ visible only to invited people |
| Branch protection / rulesets | ✅ free | ❌ needs GitHub Team (free for schools via GitHub Education, but approval takes days) |
| Deadline lock | ruleset | read-only permissions (automatic fallback) |
| Teams can see other teams' work | yes | yes (all collaborators can read the repo) |

**Recommendation:** use a **private repo in a free organization**. Personal contact data of students should not be public.
You lose rulesets, so main isn't technically protected; the guide and the validator tell teams not to touch it,
and §5.3 shows how to check. If you choose **public**, run `manage_repo.py protect`, and make the repo private or
delete it straight after the event.

### 2.3 Create and push the repository

```bash
cd techfest-2026-webdev-challenge
git init -b main && git add . && git commit -m "Initial competition repository"
gh repo create <ORG>/techfest-2026-webdev-challenge --private --source . --push
#            (or --public)
```

### 2.4 Create the 30 team branches

```bash
python tools/setup_team_branches.py --push
```
This creates `team-01` … `team-30`, each with `submissions/team-NN/TEAM_INFO.txt` (team number and branch pre-filled)
and `ideation/IDEATION.md`. It doesn't touch your working tree. Commits are tagged `[skip ci]`.

> If you change templates on `main` later, branches that already exist are not updated. Create the branches **last**.

### 2.5 Protect (public repo, or private with GitHub Team)

```bash
python tools/manage_repo.py protect
```
This blocks direct pushes to `main`, deleting or force-pushing team branches, and creating new branches.
Repository admins (you) bypass all of it.

### 2.6 Give teams access

Collect **one GitHub username per team** (the leader), or all members if you prefer, in a CSV like
[`templates/github_usernames.csv`](../templates/github_usernames.csv), then:

```bash
python tools/manage_repo.py invite usernames.csv
```
- Everyone must **accept** the invite (`https://github.com/<ORG>/<REPO>/invitations`). Do this **before the event**.
- GitHub limits invitations to about **50 per 24 h** per repository. That's another reason to invite one account per team.
- Write access is needed to push to the team branch. A participant without it gets a "fork" prompt.

### 2.7 Dry run (10 minutes, strongly recommended)

1. Invite a second account of your own. Switch to `team-30` in the browser, fill `TEAM_INFO.txt`, upload a test ZIP.
2. Check that the Actions tab shows the ✔ / ✘ report.
3. Run `python tools/collect_submissions.py --teams team-30` and open `evaluation/SUMMARY.md`.
4. Reset that branch afterwards. With rulesets on, delete it in the web UI as an admin, then re-run `setup_team_branches.py --push`.

Before the event, also update the placeholders `<ORG>/<REPO>` in `docs/SUBMISSION_GUIDE.md` with the real URL.

---

## 3. Event-day runbook

| Time | Organizer action |
|---|---|
| **9:30 – 10:00** | Registration desk: give each team a **team number → branch `team-NN`**. Keep a paper or sheet roster (number, team name, leader). Confirm each team can open its branch and edit `TEAM_INFO.txt`. |
| **10:00** | Announce the 5 problem statements. Optionally commit them to `main` as `docs/PROBLEM_STATEMENTS.md` so everyone has the same text. |
| **10:45** | Remind teams: ideation upload **closes at 11:00**. |
| **11:00** | Snapshot of who submitted ideation: `python tools/collect_submissions.py --no-extract`. Look at the *Ideation* column. |
| **11:00 – 1:30** | Faculty coordinators monitor AI prompt usage (max 5 per team). Watch the **Actions** tab for red ✘ runs and help those teams. |
| **1:15** | Announce: 15 minutes left. ZIP plus green tick. |
| **1:30** | **Lock:** `python tools/manage_repo.py lock`. Late pushes are blocked and are also ignored by the collector. |
| **1:35** | **Collect:** `python tools/collect_submissions.py` → hand `evaluation/` to the judges. |

### If a team has a genuine upload problem at the deadline
Note the time and take their ZIP on a USB stick. Later, push it to their branch yourself (admins bypass the lock) and
record why in the commit message. The collector shows it as a late push, so the judges decide openly.

To re-open submissions temporarily: `python tools/manage_repo.py unlock`.

---

## 4. After the deadline: collection and judging

```bash
python tools/collect_submissions.py              # all teams
python tools/collect_submissions.py --grace 2    # accept pushes up to 1:32 PM
python tools/collect_submissions.py --teams team-04 team-11
```

Output in `evaluation/` (git-ignored, because it contains personal data):

| File | Content |
|---|---|
| `SUMMARY.md` | Overview table, cross-team alerts, per-team errors, warnings and flags |
| `submissions_report.csv` | One row per team: name, title, problem #, AI platform, leader contact, status, ideation timing, ZIP, last push, evaluated commit |
| `contacts.csv` | Every participant: team, role, name, USN, email, phone (for certificates and results) |
| `team-NN/` | `TEAM_INFO.txt`, `ideation/`, the ZIP, and **`website/`** (the extracted site, ready to open) |

**Cross-team alerts** flag: identical ZIP files (possible copying), the same USN or email in several teams, and one
GitHub account pushing to several team branches.

**Ideation status** (from the push log):
`On time` · `On time, modified later` (ideation changed after 11:00) · `Not submitted by deadline`.

Judges can open `team-NN/website/.../index.html`, or follow the *How to run* section in each team's `WORKFLOW.md`.
`WORKFLOW.md` also contains the team's **AI prompt log** and **contributions**, which are useful for checking the AI rules.

---

## 5. Reference

### 5.1 Changing event settings
Edit [`competition.json`](../competition.json) on `main`: date, timezone offset, deadlines, team count, number of problem
statements, ZIP size guidance. The validator and collector both read it.

### 5.2 Validating one branch locally
```bash
git fetch origin && git switch team-07
python tools/validate_submission.py --branch team-07 --base origin/main
git switch main
```

### 5.3 Making sure `main` was not tampered with (private repo without rulesets)
```bash
git fetch origin && git log --format="%h %an %ad %s" origin/main
```
Only organizer commits should appear. Run the collector from your own checkout of `main`.

### 5.4 After the event
- Download `evaluation/` and keep it off GitHub.
- Make the repo private, or archive it (Settings → General → Archive), or delete it once the results are final.
- Remove outside collaborators.
