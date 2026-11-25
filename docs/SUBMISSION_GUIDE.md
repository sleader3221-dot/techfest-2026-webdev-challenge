# Submission Guide for Participants

Everything is done in the browser on github.com. You don't need to install git.
(Git users can skip to [Option B: git command line](#option-b-git-command-line).)

---

## Before the event (do this today)

- [ ] Each team has **at least one GitHub account** (the team leader's). Sign up free at https://github.com/signup.
- [ ] Send the leader's GitHub username to the organizers.
- [ ] Accept the repository invitation. You get an email, or you can open `https://github.com/<ORG>/<REPO>/invitations`.
      **Without accepting, you cannot upload.**
- [ ] Practise once: create any repo of your own and use **Add file → Upload files**.
- [ ] Know how to make a ZIP:
  - **Windows:** right-click the project folder → *Send to* → *Compressed (zipped) folder*
  - **macOS:** right-click → *Compress*
  - **Linux:** `zip -r team-07.zip my-project -x "*/node_modules/*"`

## What you will submit

```
submissions/team-NN/            (on YOUR branch team-NN)
├── TEAM_INFO.txt               A. Team information file    → by 1:30 PM (fill it early!)
├── ideation/
│   ├── IDEATION.md             Ideation write-up           → by 11:00 AM
│   └── sketch.png, ...         images / PDF / PPT (optional)
└── team-NN.zip                 B. ONE ZIP: website + WORKFLOW.md → by 1:30 PM
```

---

## Option A: GitHub website (recommended)

### Step 1. Open your branch (always check this first)

1. Open the repository page.
2. Click the branch dropdown at the top left. It shows **`main`**.
3. Type your branch, e.g. `team-07`, and select it.
4. The dropdown must now show **`team-07`**. Every step below happens on this branch.
5. Open the folder `submissions` → `team-07`.

> ⚠️ If a commit screen ever says *"Create a new branch"* or *"fork this repository"*, **stop**. You are on the wrong branch or have not accepted the invitation.

### Step 2. Fill in the Team Information file (A)

1. Click `TEAM_INFO.txt`, then the **✏️ pencil icon** (Edit).
2. Fill in every value **after the colon**. `TEAM_NUMBER` and `BRANCH_NAME` are already filled in, so don't change them.

   ```
   TEAM_NAME: Code Crafters
   PROBLEM_STATEMENT_NUMBER: 3
   WEBSITE_TITLE: GreenRoute - Smart Campus Commute
   AI_PLATFORM_USED: Gemini

   LEADER_NAME: Ananya Rao
   LEADER_USN: 1AB23CS001
   LEADER_EMAIL: ananya.rao@gmail.com
   LEADER_PHONE: 9876543210
   ```
   Leave the `MEMBER3_…` lines empty if you are a team of two.
3. Click **Commit changes…** → keep **"Commit directly to the `team-07` branch"** → **Commit changes**.

### Step 3. Ideation submission (10:45 – 11:00 AM)

1. Open `ideation/IDEATION.md` → ✏️ → replace each `_..._` placeholder with your content:
   website title, problem, solution description, key features, pages, tech stack, references.
   → **Commit changes** (directly to your branch).
2. *(Optional)* Images, sketches, a PDF or PPT: open the `ideation` folder → **Add file → Upload files** →
   drag the files in → **Commit changes**.
3. To show an image inside IDEATION.md, write `![Home page sketch](home-sketch.png)`.

> ⏰ The ideation upload must be done **before 11:00 AM**. Changes after 11:00 are recorded and visible to the judges.

### Step 4. Prepare your project for zipping (around 1:00 PM)

1. Download [`templates/WORKFLOW.md`](../templates/WORKFLOW.md) (open it → **Download raw file** icon),
   put it in the **root of your project folder** and fill it in:
   how to run, project structure, timeline, who did what, **your AI prompt log (max 5 prompts)**, challenges.
2. Delete `node_modules/` and other build output (judges can run `npm install`).
3. Make sure the site runs from the folder: `index.html` opens, or `npm install && npm start` works.
4. Make **one** ZIP of the whole project folder and name it **`team-07.zip`** (your team number).
   Keep it under **25 MB**, the limit for uploading through the browser.

   ```
   team-07.zip
   └── my-project/
       ├── index.html          (or package.json for Node/React projects)
       ├── css/  js/  assets/
       └── WORKFLOW.md         ← required
   ```

### Step 5. Upload the ZIP (B), before 1:30 PM

1. Go to `submissions/team-07/` on your branch.
2. **Add file → Upload files** → drop `team-07.zip` → **Commit changes** (directly to your branch).
3. Need to fix something? Upload a new ZIP **with the same name** and it replaces the old one.
   There must be **exactly one** ZIP. Delete extra ZIPs (open the file → `⋯` → **Delete file**).

> Don't upload loose website files into your team folder. Only the ZIP counts.

### Step 6. Check your result ✔ / ✘

About 30 seconds after each upload, a mark appears next to your latest commit:

| Mark | Meaning |
|---|---|
| 🟡 dot | Checking… wait a moment |
| ✅ green tick | Everything required for this stage is present and valid |
| ❌ red cross | Something is missing or wrong. Click it → **Details** → **Summary** to see exactly what to fix |

Before 11:00 AM a red cross only means something is wrong with your team info or ideation. A missing ZIP is OK until Phase 2.
**After 11:00 AM the check also requires the ZIP**, so it stays red until you upload it.

---

## Option B: git command line

```bash
git clone https://github.com/<ORG>/<REPO>.git
cd <REPO>
git switch team-07                          # YOUR branch only
# edit submissions/team-07/TEAM_INFO.txt and ideation/IDEATION.md
git add submissions/team-07
git commit -m "Team 07: ideation"
git push

# final submission
cp ~/projects/my-site.zip submissions/team-07/team-07.zip
git add submissions/team-07/team-07.zip
git commit -m "Team 07: final submission"
git push
```

Force-pushing and deleting branches are blocked. Don't commit to `main`.

---

## Common problems

| Problem | Fix |
|---|---|
| "You need to fork this repository" | You have not accepted the invitation, or you are signed in to the wrong account. |
| Can't find my folder | You are still on `main`. Switch the branch dropdown to `team-NN`. |
| `TEAM_INFO.txt.txt` | Windows hid the extension. Edit the existing file on GitHub instead of uploading a new one. |
| ZIP over 25 MB | Remove `node_modules`, videos and build folders. Compress images. |
| "Only your own team folder may change" error | You edited a file outside `submissions/team-NN/`. Ask an organizer to help undo it. |
| Upload stuck or failing at 1:29 PM | Tell an organizer **immediately** and show the error. Don't wait. |

## Submission checklist

- [ ] On my branch `team-NN` (not `main`)
- [ ] `TEAM_INFO.txt`: team name, problem #, website title, AI platform, each member's **name, USN, email**, leader's **phone**
- [ ] `ideation/IDEATION.md` filled in **before 11:00 AM**
- [ ] **One** ZIP named `team-NN.zip` containing the full website source plus **`WORKFLOW.md`**
- [ ] No `node_modules`, no real passwords or API keys in the ZIP
- [ ] Green ✅ on the latest commit **before 1:30 PM**
