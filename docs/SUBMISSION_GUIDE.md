# How to Submit (step by step)

You only need a free GitHub account (https://github.com/signup) and a browser. You don't need git.

---

## 1. Ideation upload (10:45 – 11:00 AM)

1. Download the template [`templates/IDEATION.md`](../templates/IDEATION.md) (open it → **Download raw file**) and fill it in:
   website title, problem, solution, key features, pages, tech stack, references.
   A PDF or PPT with the same content is also fine.
2. On your computer, make a folder named after your team, e.g. **`code-crafters`**, and put `IDEATION.md`
   and any images in it.
3. **If your team leader received an invite** (check email, or open
   https://github.com/sleader3221-dot/techfest-2026-webdev-challenge/invitations): click **Accept invitation**, then:
   - open the **`submissions`** folder of the main repository → **Add file → Upload files**
   - **drag the whole `code-crafters` folder** onto the upload area (Chrome or Edge)
   - choose **"Create a new branch for this commit and start a pull request"**, name the branch after your team
   - **Propose changes** → **Create pull request**
   - Only upload into **your own team folder**. Deleting or editing other teams' files leads to disqualification.
4. **No invite?** Use a fork instead:
   - Open https://github.com/sleader3221-dot/techfest-2026-webdev-challenge → **Fork** (top right) → **Create fork**
   - In **your fork**: **`submissions`** → **Add file → Upload files** → drag the whole team folder → **Commit changes**
   - Your fork's main page → **Contribute** → **Open pull request** → **Create pull request**

✅ Done. Your pull request is your ideation submission, and its time is recorded.

## 2. Final submission (before 1:30 PM)

### Prepare
1. Download [`templates/TEAM_INFO.txt`](../templates/TEAM_INFO.txt) and fill it in.
2. Download [`templates/WORKFLOW.md`](../templates/WORKFLOW.md), fill it in, and put it **inside your project folder**.
3. Delete `node_modules/` if you have it. Judges can run `npm install`.
4. Make **one ZIP** of your project folder and name it after your team, e.g. `code-crafters.zip`.
   - Windows: right-click the folder → *Send to* → *Compressed (zipped) folder*
   - Mac: right-click → *Compress*
   - Keep it **under 25 MB**, the browser upload limit.

### Upload
Put `TEAM_INFO.txt` and `code-crafters.zip` in your `code-crafters` folder (same name as before), then upload the same way as
for ideation (step 3 if you accepted the invite, step 4 if you use a fork) and create a pull request.

> It's fine if your team ends up with more than one pull request (one for ideation, one for the final).
> Judges look at all of them.

---

## Final checklist

- [ ] Ideation uploaded **before 11:00 AM**
- [ ] `TEAM_INFO.txt`: team name, each member's name, USN, email, leader's phone
- [ ] **One** ZIP containing the full website **and** `WORKFLOW.md`
- [ ] Pull request created **before 1:30 PM**

## Common problems

| Problem | Fix |
|---|---|
| "Uploads are disabled. File uploads require push access" | Accept your invite first (…/invitations link in step 3), then reload. No invite? Use a fork (step 4). |
| "Sign in to upload" | Log in to your GitHub account first. |
| ZIP too large | Remove `node_modules`, videos and build folders, and compress images. |
| Uploaded the wrong file | Upload again (same folder name) and create a new pull request. |
| Stuck at 1:29 PM | Tell a coordinator immediately. |
