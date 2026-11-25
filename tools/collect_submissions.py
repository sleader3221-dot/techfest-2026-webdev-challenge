#!/usr/bin/env python3
"""ORGANIZERS / JUDGES: collect, verify and unpack every team's submission after the deadline.

    python tools/collect_submissions.py                 # fetch + validate + extract all teams
    python tools/collect_submissions.py --grace 5       # allow pushes up to 5 min after 1:30 PM
    python tools/collect_submissions.py --no-push-log   # offline: use branch heads & commit times

What it does, for every team-NN branch on origin:
  1. Reads GitHub's server-side PUSH LOG (via `gh`) - commit dates can be faked, push times cannot.
  2. Selects the LAST PUSH MADE BEFORE THE DEADLINE as the version to evaluate
     (later pushes are reported as late and ignored).
  3. Checks whether ideation was submitted before the ideation deadline and whether
     it was changed afterwards.
  4. Re-runs the official validator from *this* checkout (teams cannot tamper with it).
  5. Copies TEAM_INFO.txt, ideation and the ZIP into evaluation/team-NN/ and safely
     extracts the website into evaluation/team-NN/website/.
  6. Flags cross-team issues: identical ZIPs, duplicate USNs/emails, people pushing to
     another team's branch.

Outputs (evaluation/ is git-ignored - it contains personal data):
  evaluation/SUMMARY.md                 human-readable overview for judges
  evaluation/submissions_report.csv     one row per team (opens in Excel)
  evaluation/contacts.csv               all participants with USN / email / phone
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import shutil
import subprocess
import sys
import tarfile
import zipfile
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path, PurePosixPath
from typing import Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import REPO_ROOT, Config, load_config  # noqa: E402
from validate_submission import Report, check_ideation, validate_folder  # noqa: E402


# --------------------------------------------------------------------------
# git / gh helpers
# --------------------------------------------------------------------------
def git(*args: str, binary: bool = False, check: bool = True):
    res = subprocess.run(["git", *args], cwd=REPO_ROOT, capture_output=True, check=False)
    if check and res.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {res.stderr.decode(errors='replace').strip()}")
    return res.stdout if binary else res.stdout.decode(errors="replace").strip()


def gh_json(*args: str):
    res = subprocess.run(["gh", *args], capture_output=True, text=True, encoding="utf-8")
    if res.returncode != 0:
        raise RuntimeError(res.stderr.strip())
    out = res.stdout.strip()
    if not out:
        return []
    # `gh api --paginate` concatenates JSON arrays page by page: "[...][...]"
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        merged = []
        for chunk in out.replace("][", "]\n[").splitlines():
            merged += json.loads(chunk)
        return merged


@dataclass
class Push:
    when: datetime
    after: str
    actor: str


@dataclass
class TeamResult:
    branch: str
    eval_sha: str = ""
    eval_source: str = ""
    last_push: Optional[Push] = None
    late_pushes: List[Push] = field(default_factory=list)
    pushers: List[str] = field(default_factory=list)
    ideation_status: str = ""
    report: Optional[Report] = None
    flags: List[str] = field(default_factory=list)
    extracted: str = ""


def push_log(repo: str, branch: str) -> List[Push]:
    data = gh_json("api", "--paginate", "-X", "GET", f"repos/{repo}/activity",
                   "-f", f"ref=refs/heads/{branch}", "-f", "per_page=100", "-f", "direction=asc")
    pushes = []
    for a in data:
        if a.get("activity_type") not in ("push", "force_push", "branch_creation"):
            continue
        ts = datetime.fromisoformat(a["timestamp"].replace("Z", "+00:00"))
        pushes.append(Push(ts, a.get("after", ""), (a.get("actor") or {}).get("login", "?")))
    return sorted(pushes, key=lambda p: p.when)


def commit_exists(sha: str) -> bool:
    return subprocess.run(["git", "cat-file", "-e", f"{sha}^{{commit}}"], cwd=REPO_ROOT,
                          capture_output=True).returncode == 0


def last_before(pushes: List[Push], deadline: datetime) -> Optional[Push]:
    ok = [p for p in pushes if p.when <= deadline and p.after and set(p.after) != {"0"}]
    return ok[-1] if ok else None


def export_folder(sha: str, path: str, dest: Path) -> bool:
    """Write the tree at `sha:path` into dest (via git archive - no checkout needed)."""
    data = git("archive", "--format=tar", sha, path, binary=True, check=False)
    if not data:
        return False
    with tarfile.open(fileobj=io.BytesIO(data)) as tf:
        for m in tf.getmembers():
            p = PurePosixPath(m.name)
            if p.is_absolute() or ".." in p.parts or not (m.isfile() or m.isdir()):
                continue
            if hasattr(tarfile, "data_filter"):
                tf.extract(m, dest, filter="data")
            else:
                tf.extract(m, dest)
    return True


def safe_extract_zip(zip_path: Path, dest: Path) -> int:
    count = 0
    with zipfile.ZipFile(zip_path) as zf:
        for info in zf.infolist():
            name = info.filename.replace("\\", "/")
            p = PurePosixPath(name)
            if (name.startswith("/") or ".." in p.parts or (len(name) > 1 and name[1] == ":")
                    or name.startswith("__MACOSX/")):
                continue
            target = dest.joinpath(*p.parts)
            if info.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(info) as src, open(target, "wb") as dst:
                shutil.copyfileobj(src, dst)
            count += 1
    return count


# --------------------------------------------------------------------------
# Main per-team processing
# --------------------------------------------------------------------------
def process_team(branch: str, cfg: Config, repo: Optional[str], out: Path, grace: timedelta,
                 extract: bool) -> TeamResult:
    tr = TeamResult(branch=branch)
    remote_ref = f"origin/{branch}"
    final_dl = cfg.final_deadline_dt + grace
    idea_dl = cfg.ideation_deadline_dt + grace
    folder_path = f"{cfg.submissions_dir}/{branch}"

    pushes: Optional[List[Push]] = None
    if repo:
        try:
            pushes = push_log(repo, branch)
        except RuntimeError as exc:
            tr.flags.append(f"Push log unavailable ({exc}); used branch head.")

    if pushes:
        tr.last_push = pushes[-1]
        event_start = cfg.ideation_deadline_dt.replace(hour=0, minute=0)
        tr.pushers = sorted({p.actor for p in pushes if p.when >= event_start})  # ignore organizer setup
        tr.late_pushes = [p for p in pushes if p.when > final_dl]
        chosen = last_before(pushes, final_dl)
        if chosen and commit_exists(chosen.after):
            tr.eval_sha, tr.eval_source = chosen.after, f"last push before deadline ({cfg.fmt(chosen.when)})"
        else:
            tr.eval_sha, tr.eval_source = git("rev-parse", remote_ref), "branch head (no on-time push found)"
            tr.flags.append("No push before the final deadline - evaluated version is LATE.")
        if tr.late_pushes:
            tr.flags.append(f"{len(tr.late_pushes)} push(es) after the deadline were IGNORED.")
    else:
        tr.eval_sha, tr.eval_source = git("rev-parse", remote_ref), "branch head (commit times unverified)"

    # Fresh output folder
    team_out = out / branch
    if team_out.exists():
        shutil.rmtree(team_out)
    snap = out / ".snapshots" / branch
    if snap.exists():
        shutil.rmtree(snap)
    snap.mkdir(parents=True)
    export_folder(tr.eval_sha, folder_path, snap)
    folder = snap / folder_path

    changed = [l for l in git("diff", "--name-only", "--no-renames", f"origin/main...{tr.eval_sha}",
                              check=False).splitlines() if l.strip()]
    report = validate_folder(folder, branch, cfg, max(cfg.final_deadline_dt, cfg.ideation_deadline_dt), changed)
    tr.report = report

    # Ideation timeliness (only provable with the push log)
    if pushes:
        idea_push = last_before(pushes, idea_dl)
        if idea_push is None:
            tr.ideation_status = "Not submitted by deadline"
        else:
            isnap = out / ".snapshots" / f"{branch}-ideation"
            if isnap.exists():
                shutil.rmtree(isnap)
            isnap.mkdir(parents=True)
            export_folder(idea_push.after, folder_path, isnap)
            tmp = Report(branch=branch, folder=folder_path)
            if (isnap / folder_path).is_dir():
                check_ideation(isnap / folder_path, tmp)
            if not tmp.ideation_ok:
                tr.ideation_status = "Not submitted by deadline"
            else:
                diff = git("diff", "--name-only", idea_push.after, tr.eval_sha, "--",
                           f"{folder_path}/ideation", check=False)
                tr.ideation_status = "On time, modified later" if diff else "On time"
            shutil.rmtree(isnap, ignore_errors=True)
        if tr.ideation_status != "On time":
            tr.flags.append(f"Ideation: {tr.ideation_status}.")
    else:
        tr.ideation_status = "Submitted (time unverified)" if report.ideation_ok else "Missing"

    # Copy deliverables for judges
    team_out.mkdir(parents=True)
    if folder.is_dir():
        for item in folder.iterdir():
            dst = team_out / item.name
            shutil.copytree(item, dst) if item.is_dir() else shutil.copy2(item, dst)
        if extract and report.zip and report.zip.file_count:
            zp = next(folder.rglob(report.zip.name), None)
            if zp:
                try:
                    n = safe_extract_zip(zp, team_out / "website")
                    tr.extracted = f"{n} files"
                except (zipfile.BadZipFile, OSError) as exc:
                    tr.flags.append(f"ZIP extraction failed: {exc}")
    shutil.rmtree(snap, ignore_errors=True)
    return tr


def cross_team_checks(results: List[TeamResult]) -> List[str]:
    notes = []
    index = {tr.branch: tr for tr in results}

    def flag(teams, msg):
        notes.append(msg)
        for t in set(teams):
            index[t].flags.append(msg)

    by_hash: Dict[str, List[str]] = defaultdict(list)
    by_usn: Dict[str, List[str]] = defaultdict(list)
    by_email: Dict[str, List[str]] = defaultdict(list)
    for tr in results:
        r = tr.report
        if r and r.zip and r.zip.sha256:
            by_hash[r.zip.sha256].append(tr.branch)
        if r and r.team_info:
            for m in r.team_info.active_members:
                if m.usn:
                    by_usn[m.usn].append(tr.branch)
                if m.email:
                    by_email[m.email].append(tr.branch)
    for h, teams in by_hash.items():
        if len(teams) > 1:
            flag(teams, f"IDENTICAL ZIP submitted by {', '.join(teams)} (sha256 {h[:12]}...) - possible plagiarism.")
    for usn, teams in by_usn.items():
        if len(set(teams)) > 1:
            flag(teams, f"USN {usn} appears in multiple teams: {', '.join(sorted(set(teams)))}.")
    for em, teams in by_email.items():
        if len(set(teams)) > 1:
            flag(teams, f"Email {em} appears in multiple teams: {', '.join(sorted(set(teams)))}.")
    pusher_teams: Dict[str, set] = defaultdict(set)
    for tr in results:
        for p in tr.pushers:
            pusher_teams[p].add(tr.branch)
    for user, teams in pusher_teams.items():
        if len(teams) > 1:
            flag(teams, f"GitHub user `{user}` pushed to several team branches: {', '.join(sorted(teams))} "
                         "(expected only for organizers).")
    return notes


# --------------------------------------------------------------------------
# Output
# --------------------------------------------------------------------------
def write_outputs(results: List[TeamResult], cross: List[str], cfg: Config, out: Path, repo: Optional[str]) -> None:
    rows, contacts = [], []
    for tr in results:
        r = tr.report
        ti = r.team_info if r else None
        g = (lambda k: ti.get(k) if ti else "")
        leader = ti.members[0] if ti else None
        overall = ("INCOMPLETE" if not (r and r.ok) else "COMPLETE (see flags)" if tr.flags else "COMPLETE")
        rows.append({
            "Team": tr.branch, "Team Name": g("TEAM_NAME"), "Website Title": g("WEBSITE_TITLE"),
            "Problem #": g("PROBLEM_STATEMENT_NUMBER"), "AI Platform": g("AI_PLATFORM_USED"),
            "Members": len(ti.active_members) if ti else 0,
            "Leader": leader.name if leader else "", "Leader USN": leader.usn if leader else "",
            "Leader Email": leader.email if leader else "", "Leader Phone": leader.phone if leader else "",
            "Status": overall,
            "Team Info": "OK" if r and r.team_info_ok else "Incomplete",
            "Ideation": tr.ideation_status,
            "ZIP": ("OK" if r and r.final_ok else ("Invalid" if r and r.zip else "Missing")),
            "ZIP MB": f"{r.zip.size_bytes / 1048576:.2f}" if r and r.zip else "",
            "Entry Point": r.zip.entry_points[0] if r and r.zip and r.zip.entry_points else "",
            "Last Push": cfg.fmt(tr.last_push.when) if tr.last_push else "",
            "Evaluated Commit": tr.eval_sha[:12], "Evaluated Version": tr.eval_source,
            "Errors": " | ".join(e.replace("`", "") for e in (r.errors if r else [])),
            "Warnings": " | ".join(w.replace("`", "") for w in (r.warnings if r else [])),
            "Flags": " | ".join(tr.flags),
        })
        if ti:
            for m in ti.active_members:
                contacts.append({"Team": tr.branch, "Team Name": g("TEAM_NAME"), "Role": m.role,
                                 "Name": m.name, "USN": m.usn, "Email": m.email, "Phone": m.phone})

    def write_csv(path: Path, data: List[dict]) -> None:
        if not data:
            return
        with open(path, "w", newline="", encoding="utf-8-sig") as fh:  # utf-8-sig: Excel-friendly
            w = csv.DictWriter(fh, fieldnames=list(data[0].keys()))
            w.writeheader()
            w.writerows(data)

    write_csv(out / "submissions_report.csv", rows)
    write_csv(out / "contacts.csv", contacts)

    complete = sum(1 for r in rows if r["Status"].startswith("COMPLETE"))
    md = [f"# Submission Summary - {cfg.event_name}", "",
          f"Generated: {cfg.fmt(datetime.now(cfg.tz))}  ",
          f"Final deadline: {cfg.fmt(cfg.final_deadline_dt)}  ",
          f"Timing source: {'GitHub server push log (' + repo + ')' if repo else 'branch heads (commit times unverified)'}",
          "", f"**{len(rows)} team branches - {complete} complete, {len(rows) - complete} need review.**", "",
          "| Team | Name | Title | PS# | Ideation | ZIP | Status | Last push |",
          "|------|------|-------|-----|----------|-----|--------|-----------|"]
    for r in rows:
        md.append(f"| {r['Team']} | {r['Team Name']} | {r['Website Title']} | {r['Problem #']} | {r['Ideation']} "
                  f"| {r['ZIP']} | {r['Status']} | {r['Last Push']} |")
    if cross:
        md += ["", "## Cross-team alerts", ""] + [f"- {c}" for c in cross]
    md += ["", "## Per-team details", ""]
    for tr in results:
        r = tr.report
        md += [f"### {tr.branch}", f"- Evaluated: `{tr.eval_sha[:12]}` - {tr.eval_source}"]
        if tr.extracted:
            md.append(f"- Website extracted to `{tr.branch}/website/` ({tr.extracted})")
        for label, items in (("Error", r.errors if r else []), ("Warning", r.warnings if r else []),
                             ("Flag", tr.flags)):
            md += [f"- **{label}:** {i}" for i in items]
        md.append("")
    (out / "SUMMARY.md").write_text("\n".join(md), encoding="utf-8")


def main() -> int:
    cfg = load_config()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(REPO_ROOT / "evaluation"), help="output folder (default: evaluation/)")
    ap.add_argument("--repo", help="owner/name for the push log (default: detected with gh)")
    ap.add_argument("--no-push-log", action="store_true", help="do not query GitHub; use branch heads")
    ap.add_argument("--no-fetch", action="store_true", help="skip `git fetch`")
    ap.add_argument("--no-extract", action="store_true", help="do not unzip websites")
    ap.add_argument("--grace", type=int, default=0, help="grace minutes after each deadline (default 0)")
    ap.add_argument("--teams", nargs="*", help="only these branches, e.g. team-03 team-07")
    args = ap.parse_args()

    if not args.no_fetch:
        print("Fetching all branches from origin ...")
        git("fetch", "origin", "--prune")

    repo = None
    if not args.no_push_log:
        res = subprocess.run(["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"],
                             cwd=REPO_ROOT, capture_output=True, text=True)
        repo = args.repo or (res.stdout.strip() if res.returncode == 0 else None)
        if not repo:
            print("WARNING: gh not available - falling back to branch heads (times unverified).")

    remote = git("for-each-ref", "--format=%(refname:short)", f"refs/remotes/origin/{cfg.branch_prefix}*")
    branches = sorted(b.split("/", 1)[1] for b in remote.splitlines() if b.strip())
    valid = [b for b in branches if cfg.team_number_from_branch(b)]
    for b in sorted(set(branches) - set(valid)):
        print(f"  ignoring non-team branch {b}")
    if args.teams:
        valid = [b for b in valid if b in set(args.teams)]
    if not valid:
        print("No team branches found on origin.")
        return 1

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    results = []
    for b in valid:
        print(f"Processing {b} ...", end=" ", flush=True)
        try:
            tr = process_team(b, cfg, repo, out, timedelta(minutes=args.grace), not args.no_extract)
        except Exception as exc:  # keep going - one broken branch must not stop the rest
            tr = TeamResult(branch=b, flags=[f"PROCESSING FAILED: {exc}"])
            tr.report = Report(branch=b, folder="", errors=[f"Processing failed: {exc}"])
        results.append(tr)
        print("OK" if tr.report and tr.report.ok else "needs review")

    shutil.rmtree(out / ".snapshots", ignore_errors=True)
    cross = cross_team_checks(results)
    write_outputs(results, cross, cfg, out, repo)
    print(f"\nDone. Open {out / 'SUMMARY.md'} and {out / 'submissions_report.csv'}")
    for c in cross:
        print(f"  ALERT: {c}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
