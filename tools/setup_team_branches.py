#!/usr/bin/env python3
"""ORGANIZERS: create the team branches team-01 ... team-NN, each pre-loaded with
its own submission folder and templates:

    submissions/team-07/TEAM_INFO.txt        (TEAM_NUMBER and BRANCH_NAME pre-filled)
    submissions/team-07/ideation/IDEATION.md

Uses git plumbing (a temporary index), so your working tree and current branch
are never touched. Existing branches are skipped unless --force is given.

    python tools/setup_team_branches.py              # create locally
    python tools/setup_team_branches.py --push       # create and push to origin
    python tools/setup_team_branches.py --teams 5    # only team-01..team-05
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import REPO_ROOT, load_config  # noqa: E402


def git(*args: str, env=None, input_bytes: bytes | None = None) -> str:
    res = subprocess.run(["git", *args], cwd=REPO_ROOT, env=env, input=input_bytes,
                         capture_output=True, check=False)
    if res.returncode != 0:
        raise SystemExit(f"git {' '.join(args)} failed:\n{res.stderr.decode(errors='replace')}")
    return res.stdout.decode().strip()


def ref_exists(ref: str) -> bool:
    return subprocess.run(["git", "rev-parse", "--verify", "--quiet", ref], cwd=REPO_ROOT,
                          capture_output=True).returncode == 0


def main() -> int:
    cfg = load_config()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", default="main", help="branch to start from (default: main)")
    ap.add_argument("--teams", type=int, default=cfg.max_teams, help=f"number of teams (default {cfg.max_teams})")
    ap.add_argument("--push", action="store_true", help="push the created branches to origin")
    ap.add_argument("--force", action="store_true", help="re-create branches that already exist (DANGEROUS)")
    args = ap.parse_args()

    if not 1 <= args.teams <= 99:
        raise SystemExit("--teams must be between 1 and 99")
    base_sha = git("rev-parse", args.base)
    info_tmpl = (REPO_ROOT / "templates" / "TEAM_INFO.txt").read_text(encoding="utf-8")
    idea_tmpl = (REPO_ROOT / "templates" / "IDEATION.md").read_text(encoding="utf-8")

    created = []
    with tempfile.TemporaryDirectory() as tmp:
        env = dict(os.environ, GIT_INDEX_FILE=str(Path(tmp) / "index"))
        for n in range(1, args.teams + 1):
            branch = cfg.team_branch(n)
            if ref_exists(f"refs/heads/{branch}") and not args.force:
                print(f"  skip   {branch} (already exists)")
                continue
            folder = f"{cfg.submissions_dir}/{branch}"
            files = {
                f"{folder}/TEAM_INFO.txt": info_tmpl.replace("{{TEAM_NUMBER}}", f"{n:02d}")
                                                    .replace("{{BRANCH_NAME}}", branch),
                f"{folder}/ideation/IDEATION.md": idea_tmpl,
            }
            git("read-tree", base_sha, env=env)
            for path, content in files.items():
                blob = git("hash-object", "-w", "--stdin", input_bytes=content.encode("utf-8"))
                git("update-index", "--add", "--cacheinfo", f"100644,{blob},{path}", env=env)
            tree = git("write-tree", env=env)
            commit = git("commit-tree", tree, "-p", base_sha, "-m",
                         f"Initialize submission folder for {branch} [skip ci]")
            git("update-ref", f"refs/heads/{branch}", commit)
            created.append(branch)
            print(f"  create {branch} -> {commit[:10]}")

    print(f"\n{len(created)} branch(es) created from {args.base} ({base_sha[:10]}).")
    if args.push and created:
        print("Pushing to origin ...")
        force = ["--force"] if args.force else []
        out = subprocess.run(["git", "push", *force, "origin", *[f"refs/heads/{b}:refs/heads/{b}" for b in created]],
                             cwd=REPO_ROOT)
        return out.returncode
    if created:
        print("Run again with --push (or: git push origin --all) to publish them.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
