#!/usr/bin/env python3
"""ORGANIZERS: configure GitHub repository protection, access and the deadline lock.
Requires the GitHub CLI (`gh auth login`) with admin rights on the repository.

    python tools/manage_repo.py protect          # once, before the event
    python tools/manage_repo.py invite leaders.csv   # invite team GitHub accounts (write access)
    python tools/manage_repo.py lock             # at 1:30 PM - freeze all team branches
    python tools/manage_repo.py unlock           # only if you must re-open submissions
    python tools/manage_repo.py status           # show active rulesets

Rulesets used (all bypassable by repository admins = organizers):
  * "Protect main"            - nobody can push directly to / delete / force-push main.
  * "Protect team branches"   - team branches cannot be deleted or force-pushed (history is evidence).
  * "Restrict branch creation"- participants cannot create new branches (team branches are pre-made).
  * "Submission lock"         - (lock only) blocks every push to team-* branches.

Note: rulesets are free on PUBLIC repositories. On PRIVATE repositories they need GitHub
Pro / Team (free for schools via GitHub Education / GitHub Campus).
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import load_config  # noqa: E402

ADMIN_BYPASS = [{"actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always"}]
LOCK_NAME = "Submission lock"
LOCK_STATE = Path(__file__).resolve().parent.parent / "evaluation" / "lock_state.json"


def gh(*args: str, payload: Optional[dict] = None, check: bool = True) -> str:
    cmd = ["gh", *args]
    if payload is not None:
        cmd += ["--input", "-"]
    res = subprocess.run(cmd, input=json.dumps(payload) if payload is not None else None,
                         capture_output=True, text=True, encoding="utf-8")
    if check and res.returncode != 0:
        raise SystemExit(f"{' '.join(cmd)} failed:\n{res.stderr.strip()}")
    return res.stdout


def repo_name(explicit: Optional[str]) -> str:
    return explicit or gh("repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner").strip()


def rulesets(repo: str) -> list:
    return json.loads(gh("api", f"repos/{repo}/rulesets", "--paginate") or "[]")


def upsert_ruleset(repo: str, body: dict) -> None:
    existing = next((r for r in rulesets(repo) if r["name"] == body["name"]), None)
    if existing:
        gh("api", "-X", "PUT", f"repos/{repo}/rulesets/{existing['id']}", payload=body)
        print(f"  updated ruleset: {body['name']}")
    else:
        gh("api", "-X", "POST", f"repos/{repo}/rulesets", payload=body)
        print(f"  created ruleset: {body['name']}")


def ruleset(name: str, include: list, rules: list, exclude: Optional[list] = None) -> dict:
    return {
        "name": name, "target": "branch", "enforcement": "active",
        "bypass_actors": ADMIN_BYPASS,
        "conditions": {"ref_name": {"include": include, "exclude": exclude or []}},
        "rules": rules,
    }


def cmd_protect(repo: str, prefix: str) -> None:
    upsert_ruleset(repo, ruleset("Protect main", ["~DEFAULT_BRANCH"], [
        {"type": "deletion"}, {"type": "non_fast_forward"},
        {"type": "pull_request", "parameters": {
            "required_approving_review_count": 1, "dismiss_stale_reviews_on_push": False,
            "require_code_owner_review": False, "require_last_push_approval": False,
            "required_review_thread_resolution": False}},
    ]))
    upsert_ruleset(repo, ruleset("Protect team branches", [f"refs/heads/{prefix}*"], [
        {"type": "deletion"}, {"type": "non_fast_forward"},
    ]))
    upsert_ruleset(repo, ruleset("Restrict branch creation", ["~ALL"], [{"type": "creation"}]))
    print("Done. Participants can now only push to the existing team branches.")


def cmd_lock(repo: str, prefix: str, mode: str) -> None:
    if mode in ("auto", "ruleset"):
        try:
            upsert_ruleset(repo, ruleset(LOCK_NAME, [f"refs/heads/{prefix}*"], [
                {"type": "update", "parameters": {"update_allows_fetch_and_merge": False}},
                {"type": "deletion"}, {"type": "non_fast_forward"},
            ]))
            print("LOCKED (ruleset). Team branches are now read-only for participants.")
            return
        except SystemExit as exc:
            if mode == "ruleset":
                raise
            print(f"  ruleset not available ({str(exc).splitlines()[-1]}); using permission downgrade.")
    lock_by_permissions(repo)


def cmd_unlock(repo: str) -> None:
    existing = None
    try:
        existing = next((r for r in rulesets(repo) if r["name"] == LOCK_NAME), None)
    except SystemExit:
        pass
    if existing:
        gh("api", "-X", "DELETE", f"repos/{repo}/rulesets/{existing['id']}")
        print("UNLOCKED (ruleset removed). Team branches accept pushes again.")
    if LOCK_STATE.exists():
        users = json.loads(LOCK_STATE.read_text(encoding="utf-8")).get("users", [])
        for u in users:
            gh("api", "-X", "PUT", f"repos/{repo}/collaborators/{u}", "-f", "permission=push", check=False)
        LOCK_STATE.unlink()
        print(f"UNLOCKED (write access restored for {len(users)} collaborator(s)).")
    elif not existing:
        print("No submission lock is active.")


def lock_by_permissions(repo: str) -> None:
    """Fallback for PRIVATE repos on the free plan (no rulesets): downgrade every
    non-admin collaborator from write to read. Works for ORGANIZATION-owned repos."""
    collabs = json.loads(gh("api", "--paginate", f"repos/{repo}/collaborators?affiliation=direct&per_page=100")
                         or "[]")
    users = [c["login"] for c in collabs
             if c.get("permissions", {}).get("push") and not c.get("permissions", {}).get("admin")]
    done = []
    for u in users:
        out = subprocess.run(["gh", "api", "-X", "PUT", f"repos/{repo}/collaborators/{u}", "-f", "permission=pull"],
                             capture_output=True, text=True)
        (done.append(u) if out.returncode == 0 else print(f"  FAIL {u}: {out.stderr.strip()}"))
    LOCK_STATE.write_text(json.dumps({"repo": repo, "users": done}, indent=2), encoding="utf-8")
    print(f"LOCKED (permissions). {len(done)} collaborator(s) set to read-only. State saved to {LOCK_STATE.name}.")
    if len(done) < len(users):
        print("  WARNING: some users could not be downgraded - on personal-account repos use an "
              "organization, or remove them via Settings > Collaborators.")


def cmd_status(repo: str) -> None:
    rs = rulesets(repo)
    if not rs:
        print("No rulesets configured.")
    for r in rs:
        print(f"  [{r.get('enforcement', '?'):8}] {r['name']}")


def cmd_invite(repo: str, csv_path: str) -> None:
    """CSV with a column named `github_username` (other columns ignored)."""
    with open(csv_path, newline="", encoding="utf-8-sig") as fh:
        rows = list(csv.DictReader(fh))
    if not rows or "github_username" not in rows[0]:
        raise SystemExit("CSV must have a header row with a `github_username` column.")
    users = []
    for row in rows:
        u = (row.get("github_username") or "").strip().lstrip("@")
        if u and re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})", u) and u.lower() not in map(str.lower, users):
            users.append(u)
        elif u:
            print(f"  skip invalid/duplicate username: {u!r}")
    print(f"Inviting {len(users)} user(s) to {repo} with write access ...")
    for u in users:
        res = subprocess.run(["gh", "api", "-X", "PUT", f"repos/{repo}/collaborators/{u}",
                              "-f", "permission=push"], capture_output=True, text=True)
        print(f"  {'ok  ' if res.returncode == 0 else 'FAIL'} {u}"
              + ("" if res.returncode == 0 else f"  ({res.stderr.strip().splitlines()[-1] if res.stderr else ''})"))
    print(f"\nEach person must ACCEPT the invite: https://github.com/{repo}/invitations")


def main() -> int:
    cfg = load_config()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["protect", "lock", "unlock", "status", "invite"])
    ap.add_argument("csv", nargs="?", help="for `invite`: CSV file with a github_username column")
    ap.add_argument("--repo", help="owner/name (default: the repo of the current directory)")
    ap.add_argument("--mode", choices=["auto", "ruleset", "permissions"], default="auto",
                    help="lock method (default auto: ruleset, falling back to read-only permissions)")
    args = ap.parse_args()
    repo = repo_name(args.repo)
    print(f"Repository: {repo}")
    if args.command == "protect":
        cmd_protect(repo, cfg.branch_prefix)
    elif args.command == "lock":
        LOCK_STATE.parent.mkdir(exist_ok=True)
        cmd_lock(repo, cfg.branch_prefix, args.mode)
    elif args.command == "unlock":
        cmd_unlock(repo)
    elif args.command == "status":
        cmd_status(repo)
    elif args.command == "invite":
        if not args.csv:
            raise SystemExit("usage: manage_repo.py invite leaders.csv")
        cmd_invite(repo, args.csv)
    return 0


if __name__ == "__main__":
    sys.exit(main())
