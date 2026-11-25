#!/usr/bin/env python3
"""Validate one team's submission folder.

Used in three places:
  * GitHub Actions - automatically on every push to a team branch.
  * Organizers     - by tools/collect_submissions.py after the deadline.
  * Anyone locally - python tools/validate_submission.py --branch team-07

Exit code 0 = no errors (warnings allowed), 1 = errors found, 2 = usage problem.
"""
from __future__ import annotations

import argparse
import hashlib
import os
import subprocess
import sys
import zipfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (  # noqa: E402
    EMAIL_RE, NAME_RE, USN_RE, REPO_ROOT, Config, TeamInfo, added_text_chars,
    load_config, parse_team_info, phone_is_valid,
)

IDEATION_DOC_EXT = {".md", ".pdf", ".docx", ".doc", ".pptx", ".ppt", ".txt", ".odt", ".odp"}
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp"}
WORKFLOW_DOC_EXT = {".md", ".txt", ".pdf", ".docx", ".doc"}
ARCHIVE_EXT = {".zip", ".rar", ".7z", ".tar", ".gz", ".tgz"}
MIN_IDEATION_CHARS = 150
MAX_UNCOMPRESSED_MB = 500


@dataclass
class ZipSummary:
    name: str = ""
    size_bytes: int = 0
    sha256: str = ""
    file_count: int = 0
    uncompressed_bytes: int = 0
    entry_points: List[str] = field(default_factory=list)
    workflow_docs: List[str] = field(default_factory=list)


@dataclass
class Report:
    branch: str
    folder: str
    phase: str = ""
    checked_at: str = ""
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    passed: List[str] = field(default_factory=list)
    team_info: Optional[TeamInfo] = None
    team_info_ok: bool = False
    ideation_ok: bool = False
    final_ok: bool = False
    zip: Optional[ZipSummary] = None
    ideation_files: List[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors


# --------------------------------------------------------------------------
# Individual checks
# --------------------------------------------------------------------------
def check_team_info(folder: Path, branch: str, team_no: int, cfg: Config, r: Report) -> None:
    path = folder / "TEAM_INFO.txt"
    if not path.is_file():
        variants = [p for p in folder.iterdir() if p.is_file() and p.name.lower().startswith("team_info")] \
            if folder.is_dir() else []
        if len(variants) == 1:
            r.warnings.append(f"Team info file is named `{variants[0].name}` - please rename it to exactly "
                              f"`TEAM_INFO.txt` (Windows often hides a second `.txt`).")
            path = variants[0]
        else:
            r.errors.append("`TEAM_INFO.txt` is missing from your team folder.")
            return

    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        text = path.read_text(encoding="latin-1")
        r.warnings.append("TEAM_INFO.txt is not UTF-8 encoded; it was read anyway.")
    info = parse_team_info(text)
    r.team_info = info
    errs_before = len(r.errors)

    for key in info.unknown_keys:
        if key.startswith("MEMBER") and key[6:7].isdigit() and int(key[6:7]) > cfg.max_team_size:
            r.errors.append(f"`{key}`: a team may have at most {cfg.max_team_size} members.")
        else:
            r.warnings.append(f"Unknown field `{key}` in TEAM_INFO.txt was ignored (do not rename the keys).")
    for key in sorted(set(info.duplicate_keys)):
        r.errors.append(f"Field `{key}` appears more than once in TEAM_INFO.txt.")
    if info.bad_lines:
        r.warnings.append(f"TEAM_INFO.txt lines {info.bad_lines} have no `KEY: value` format and were ignored.")

    # --- team-level fields
    tn = info.get("TEAM_NUMBER").lstrip("0") or ("0" if info.get("TEAM_NUMBER") else "")
    if not tn:
        r.errors.append("`TEAM_NUMBER` is empty.")
    elif not tn.isdigit() or int(tn) != team_no:
        r.errors.append(f"`TEAM_NUMBER` is `{info.get('TEAM_NUMBER')}` but this is the branch of team {team_no:02d}.")

    if info.get("BRANCH_NAME") != branch:
        r.errors.append(f"`BRANCH_NAME` must be exactly `{branch}` (found `{info.get('BRANCH_NAME') or 'empty'}`).")

    name = info.get("TEAM_NAME")
    if not name:
        r.errors.append("`TEAM_NAME` is empty.")
    elif len(name) > 60:
        r.errors.append("`TEAM_NAME` is longer than 60 characters.")

    ps = info.get("PROBLEM_STATEMENT_NUMBER")
    if not ps:
        r.errors.append("`PROBLEM_STATEMENT_NUMBER` is empty.")
    elif not ps.isdigit() or not 1 <= int(ps) <= cfg.problem_statement_count:
        r.errors.append(f"`PROBLEM_STATEMENT_NUMBER` must be a number from 1 to {cfg.problem_statement_count} "
                        f"(found `{ps}`).")

    if not info.get("WEBSITE_TITLE"):
        r.errors.append("`WEBSITE_TITLE` is empty.")

    ai = info.get("AI_PLATFORM_USED")
    allowed = {a.lower(): a for a in cfg.allowed_ai_platforms}
    if not ai:
        r.errors.append("`AI_PLATFORM_USED` is empty (write ChatGPT, Claude, Gemini or None).")
    elif ai.lower() not in allowed:
        r.errors.append(f"`AI_PLATFORM_USED` must be ONE of {', '.join(cfg.allowed_ai_platforms)} (found `{ai}`). "
                        "Only one AI platform is allowed per team.")

    # --- members
    members = info.members
    leader = members[0]
    if leader.is_empty:
        r.errors.append("Team leader details (`LEADER_*`) are empty.")
    for m in members:
        if m.is_empty:
            continue
        label = m.role
        if not m.name:
            r.errors.append(f"{label}: name is empty.")
        elif not NAME_RE.match(m.name):
            r.warnings.append(f"{label}: name `{m.name}` contains unusual characters - please double-check.")
        if not m.usn:
            r.errors.append(f"{label}: USN is empty.")
        elif not USN_RE.match(m.usn):
            r.errors.append(f"{label}: USN `{m.usn}` is not valid (letters and digits only, 5-15 characters).")
        if not m.email:
            r.errors.append(f"{label}: email is empty.")
        elif not EMAIL_RE.match(m.email):
            r.errors.append(f"{label}: email `{m.email}` is not a valid email address.")
        if m.phone and not phone_is_valid(m.phone):
            r.errors.append(f"{label}: phone `{m.phone}` is not a valid 10-digit mobile number.")
    if not leader.is_empty and not leader.phone:
        r.errors.append("Leader: phone number is required (team leader's contact information).")

    active = info.active_members
    usns = [m.usn for m in active if m.usn]
    if len(usns) != len(set(usns)):
        r.errors.append("The same USN is used for more than one member.")
    emails = [m.email for m in active if m.email]
    if len(emails) != len(set(emails)):
        r.warnings.append("The same email is used for more than one member.")

    if len(r.errors) == errs_before:
        r.team_info_ok = True
        r.passed.append(f"TEAM_INFO.txt is complete ({len(active)} member{'s' if len(active) != 1 else ''}).")


def check_ideation(folder: Path, r: Report) -> None:
    ideation = folder / "ideation"
    if not ideation.is_dir():
        r.errors.append("The `ideation/` folder is missing.")
        return
    files = sorted(p for p in ideation.rglob("*") if p.is_file() and p.name != ".gitkeep")
    r.ideation_files = [p.relative_to(folder).as_posix() for p in files]
    template = (REPO_ROOT / "templates" / "IDEATION.md").read_text(encoding="utf-8")

    filled_docs = []
    for p in files:
        ext = p.suffix.lower()
        if p.name.upper() == "IDEATION.MD":
            content = p.read_text(encoding="utf-8", errors="replace")
            if added_text_chars(content, template) >= MIN_IDEATION_CHARS:
                filled_docs.append(p.name)
        elif ext in IDEATION_DOC_EXT and p.stat().st_size > 0:
            filled_docs.append(p.name)
    images = [p.name for p in files if p.suffix.lower() in IMAGE_EXT]

    if filled_docs:
        r.ideation_ok = True
        r.passed.append(f"Ideation submitted: {', '.join(filled_docs)}"
                        + (f" + {len(images)} image(s)." if images else "."))
    else:
        r.errors.append("Ideation is not filled in: complete `ideation/IDEATION.md` (title, solution, key features) "
                        "or upload your ideation document (PDF/PPTX/DOCX) into `ideation/`.")


def inspect_zip(path: Path, branch: str, cfg: Config, r: Report) -> ZipSummary:
    z = ZipSummary(name=path.name, size_bytes=path.stat().st_size)
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    z.sha256 = h.hexdigest()

    if path.name != f"{branch}.zip":
        r.warnings.append(f"ZIP is named `{path.name}`; the recommended name is `{branch}.zip`.")
    mb = z.size_bytes / (1024 * 1024)
    if mb > cfg.max_zip_size_mb:
        r.warnings.append(f"ZIP is {mb:.1f} MB (recommended limit {cfg.max_zip_size_mb} MB). "
                          "Remove node_modules, build output and large videos.")

    if not zipfile.is_zipfile(path):
        r.errors.append(f"`{path.name}` is not a valid ZIP archive (RAR/7z or a renamed file?).")
        return z
    try:
        with zipfile.ZipFile(path) as zf:
            infos = zf.infolist()
            bad = zf.testzip()
            if bad:
                r.errors.append(f"ZIP is corrupted (first bad entry: `{bad}`). Re-create and re-upload it.")
    except (zipfile.BadZipFile, OSError, RuntimeError, NotImplementedError) as exc:
        r.errors.append(f"ZIP cannot be read ({exc}). Re-create it with a standard tool and do not encrypt it.")
        return z

    names = []
    unsafe = []
    for info in infos:
        n = info.filename.replace("\\", "/")
        if n.startswith("__MACOSX/") or n.endswith(".DS_Store"):
            continue
        if n.startswith("/") or ".." in PurePosixPath(n).parts or (len(n) > 1 and n[1] == ":"):
            unsafe.append(n)
        if info.flag_bits & 0x1:
            r.errors.append("ZIP is password-protected. Upload an unencrypted ZIP.")
            return z
        if not info.is_dir():
            names.append(n)
            z.uncompressed_bytes += info.file_size

    if unsafe:
        r.errors.append(f"ZIP contains unsafe absolute or `..` paths: {unsafe[:3]}")
    z.file_count = len(names)
    if not names:
        r.errors.append("ZIP is empty.")
        return z

    lower = [n.lower() for n in names]
    base = [PurePosixPath(n).name for n in lower]
    z.entry_points = [names[i] for i, b in enumerate(base) if b in ("index.html", "index.htm", "package.json")
                      and "node_modules/" not in lower[i]]
    z.workflow_docs = [names[i] for i, b in enumerate(base)
                       if b.startswith("workflow") and PurePosixPath(b).suffix in WORKFLOW_DOC_EXT]

    if z.workflow_docs:
        r.passed.append(f"Workflow document found in ZIP: `{z.workflow_docs[0]}`.")
    else:
        r.errors.append("ZIP has no development workflow document. Add `WORKFLOW.md` (template in "
                        "`templates/WORKFLOW.md`) to your project root, re-zip and re-upload.")
    if z.entry_points:
        r.passed.append(f"Website entry point found: `{z.entry_points[0]}`.")
    else:
        r.warnings.append("No `index.html` or `package.json` found in the ZIP - make sure the full website "
                          "source is inside and WORKFLOW.md explains how to run it.")

    if any("node_modules/" in n for n in lower):
        r.warnings.append("ZIP contains `node_modules/` - not needed (judges run `npm install`); it bloats the ZIP.")
    if any("/.git/" in f"/{n}" for n in lower):
        r.warnings.append("ZIP contains a `.git/` folder - fine, but it makes the ZIP larger.")
    secrets = [names[i] for i, b in enumerate(base) if b == ".env" or b.startswith(".env.")
               and not b.endswith((".example", ".sample"))]
    if secrets:
        r.warnings.append(f"ZIP contains `{secrets[0]}` - make sure it holds no real passwords or API keys.")
    if any(PurePosixPath(b).suffix in ARCHIVE_EXT for b in base):
        r.warnings.append("ZIP contains another archive inside it - judges prefer plain files.")
    if z.uncompressed_bytes > MAX_UNCOMPRESSED_MB * 1024 * 1024:
        r.warnings.append(f"ZIP expands to more than {MAX_UNCOMPRESSED_MB} MB.")
    return z


def check_final(folder: Path, branch: str, cfg: Config, require: bool, r: Report) -> None:
    archives = sorted(p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() in ARCHIVE_EXT)
    zips = [p for p in archives if p.suffix.lower() == ".zip"]
    others = [p for p in archives if p.suffix.lower() != ".zip"]
    if others:
        r.errors.append(f"Only ZIP format is accepted - found {', '.join(p.name for p in others)}.")
    if len(zips) > 1:
        r.errors.append(f"Exactly ONE ZIP file is allowed - found {len(zips)}: "
                        f"{', '.join(p.relative_to(folder).as_posix() for p in zips)}. Delete the extra ones.")
        return
    if not zips:
        if require:
            r.errors.append(f"Final ZIP not uploaded yet: upload `{branch}.zip` into `{cfg.submissions_dir}/{branch}/`.")
        return
    zp = zips[0]
    if zp.parent != folder:
        r.warnings.append(f"ZIP is at `{zp.relative_to(folder).as_posix()}`; put it directly in your team folder.")
    errs_before = len(r.errors)
    r.zip = inspect_zip(zp, branch, cfg, r)
    if len(r.errors) == errs_before:
        r.final_ok = True
        r.passed.append(f"ZIP `{zp.name}` is valid ({r.zip.file_count} files, {r.zip.size_bytes / 1048576:.2f} MB).")


def check_stray_files(folder: Path, r: Report) -> None:
    stray = []
    for p in folder.iterdir():
        if p.name in ("TEAM_INFO.txt", "ideation", ".gitkeep") or p.name.lower().startswith("team_info"):
            continue
        if p.is_file() and p.suffix.lower() in ARCHIVE_EXT:
            continue
        stray.append(p.name + ("/" if p.is_dir() else ""))
    if stray:
        r.warnings.append(f"Unexpected items in your team folder: {', '.join(sorted(stray)[:8])}. Your website "
                          "must be INSIDE the single ZIP - loose files may not be evaluated.")


# --------------------------------------------------------------------------
# Orchestration
# --------------------------------------------------------------------------
def validate_folder(folder: Path, branch: str, cfg: Config, now: datetime,
                    changed_files: Optional[List[str]] = None,
                    ideation_changed_late: bool = False) -> Report:
    r = Report(branch=branch, folder=f"{cfg.submissions_dir}/{branch}")
    r.checked_at = cfg.fmt(now)
    team_no = cfg.team_number_from_branch(branch)
    if team_no is None:
        r.errors.append(f"`{branch}` is not a valid team branch (expected {cfg.branch_prefix}01 ... "
                        f"{cfg.branch_prefix}{cfg.max_teams:02d}).")
        return r

    require_final = now >= cfg.ideation_deadline_dt
    if now < cfg.ideation_deadline_dt:
        r.phase = "Phase 1 - Ideation (ideation required now; final ZIP due later)"
    elif now <= cfg.final_deadline_dt:
        r.phase = "Phase 2 - Development (ideation + final ZIP required)"
    else:
        r.phase = "After final deadline"

    if not folder.is_dir():
        r.errors.append(f"Team folder `{r.folder}/` does not exist on this branch.")
        return r

    check_team_info(folder, branch, team_no, cfg, r)
    check_ideation(folder, r)
    check_final(folder, branch, cfg, require_final, r)
    check_stray_files(folder, r)

    if changed_files is not None:
        prefix = f"{cfg.submissions_dir}/{branch}/"
        outside = sorted(f for f in changed_files if not f.startswith(prefix))
        if outside:
            r.errors.append(f"Your branch changes files OUTSIDE your team folder: {', '.join(outside[:6])}"
                            f"{' ...' if len(outside) > 6 else ''}. Only edit `{prefix}`.")
        else:
            r.passed.append("Only your own team folder was changed.")
    if ideation_changed_late:
        r.warnings.append("Ideation files were modified after the ideation deadline "
                          f"({cfg.ideation_deadline} {cfg.timezone_label}). Judges will see this.")
    return r


def render_markdown(r: Report, cfg: Config, deadline_note: str = "") -> str:
    status = "PASSED" if r.ok else "ACTION NEEDED"
    icon = "✅" if r.ok else "❌"
    lines = [f"## {icon} Submission check: `{r.branch}` - {status}", ""]
    if r.team_info and r.team_info.get("TEAM_NAME"):
        lines.append(f"**Team:** {r.team_info.get('TEAM_NAME')}  ")
    lines += [f"**Checked at:** {r.checked_at}  ", f"**Stage:** {r.phase}  "]
    if deadline_note:
        lines.append(f"**Deadline status:** {deadline_note}  ")
    lines += [
        "",
        "| Item | Status |", "|------|--------|",
        f"| A. Team information file | {'Complete' if r.team_info_ok else 'Missing / incomplete'} |",
        f"| Ideation (Phase 1) | {'Submitted' if r.ideation_ok else 'Missing / incomplete'} |",
        f"| B. Single ZIP (Phase 2) | {'Submitted & valid' if r.final_ok else ('Invalid' if r.zip else 'Not uploaded yet')} |",
        "",
    ]
    if r.zip and r.zip.sha256:
        lines += [f"ZIP SHA-256: `{r.zip.sha256}`", ""]
    for title, items, mark in (("Errors (must fix)", r.errors, "❌"),
                               ("Warnings", r.warnings, "⚠️"),
                               ("Passed", r.passed, "✅")):
        if items:
            lines.append(f"### {title}")
            lines += [f"- {mark} {i}" for i in items]
            lines.append("")
    return "\n".join(lines)


def render_text(r: Report, deadline_note: str = "") -> str:
    out = [f"Submission check for {r.branch}: {'PASSED' if r.ok else 'FAILED'}",
           f"  Checked at : {r.checked_at}", f"  Stage      : {r.phase}"]
    if deadline_note:
        out.append(f"  Deadline   : {deadline_note}")
    for title, items in (("ERRORS", r.errors), ("WARNINGS", r.warnings), ("PASSED", r.passed)):
        if items:
            out.append(f"\n{title}:")
            out += [f"  - {i.replace('`', '')}" for i in items]
    return "\n".join(out)


def _git(*args: str) -> Optional[str]:
    try:
        return subprocess.run(["git", *args], cwd=REPO_ROOT, capture_output=True, text=True,
                              check=True).stdout
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--branch", help="team branch, e.g. team-07 (default: $GITHUB_REF_NAME or current branch)")
    ap.add_argument("--root", default=str(REPO_ROOT), help="repository root containing the submissions folder")
    ap.add_argument("--base", help="base ref to verify only the team folder changed, e.g. origin/main")
    ap.add_argument("--push-before", help="SHA before this push (detects late ideation edits)")
    ap.add_argument("--now", help="override clock, ISO format e.g. 2026-11-26T12:00:00+05:30")
    args = ap.parse_args(argv)

    cfg = load_config()
    branch = args.branch or os.environ.get("GITHUB_REF_NAME") or (_git("rev-parse", "--abbrev-ref", "HEAD") or "").strip()
    if not branch:
        print("Cannot determine branch; pass --branch team-NN", file=sys.stderr)
        return 2
    now = datetime.fromisoformat(args.now) if args.now else datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=cfg.tz)

    folder = Path(args.root) / cfg.submissions_dir / branch
    team_prefix = f"{cfg.submissions_dir}/{branch}/"

    changed = None
    if args.base:
        out = _git("diff", "--name-only", "--no-renames", f"{args.base}...HEAD")
        changed = [l for l in out.splitlines() if l.strip()] if out is not None else None

    late_ideation = False
    if args.push_before and now > cfg.ideation_deadline_dt and set(args.push_before) != {"0"}:
        out = _git("diff", "--name-only", args.push_before, "HEAD", "--", f"{team_prefix}ideation")
        late_ideation = bool(out and out.strip())

    report = validate_folder(folder, branch, cfg, now, changed, late_ideation)

    if now <= cfg.final_deadline_dt:
        note = f"ON TIME - received before the {cfg.final_deadline} {cfg.timezone_label} final deadline"
    else:
        note = (f"LATE - received after the final deadline ({cfg.fmt(cfg.final_deadline_dt)}). "
                "Late submissions may not be evaluated.")

    print(render_text(report, note))
    summary_file = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_file:
        with open(summary_file, "a", encoding="utf-8") as fh:
            fh.write(render_markdown(report, cfg, note) + "\n")
    return 0 if report.ok else 1


if __name__ == "__main__":
    sys.exit(main())
