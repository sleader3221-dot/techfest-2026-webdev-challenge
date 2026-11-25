"""Shared helpers: configuration, competition clock and TEAM_INFO.txt parsing.

Standard library only (Python 3.9+), so it runs unchanged on GitHub Actions,
Windows, macOS and Linux.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional

REPO_ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = REPO_ROOT / "competition.json"


# --------------------------------------------------------------------------
# Configuration & clock
# --------------------------------------------------------------------------
@dataclass
class Config:
    event_name: str
    event_date: str
    utc_offset: str
    timezone_label: str
    ideation_deadline: str
    final_deadline: str
    max_teams: int
    max_team_size: int
    problem_statement_count: int
    allowed_ai_platforms: List[str]
    max_zip_size_mb: int
    branch_prefix: str
    submissions_dir: str

    @property
    def tz(self) -> timezone:
        m = re.fullmatch(r"([+-])(\d{2}):(\d{2})", self.utc_offset)
        if not m:
            raise ValueError(f"Invalid utc_offset in competition.json: {self.utc_offset!r}")
        sign = 1 if m.group(1) == "+" else -1
        return timezone(sign * timedelta(hours=int(m.group(2)), minutes=int(m.group(3))))

    def _at(self, hhmm: str) -> datetime:
        return datetime.fromisoformat(f"{self.event_date}T{hhmm}:00").replace(tzinfo=self.tz)

    @property
    def ideation_deadline_dt(self) -> datetime:
        return self._at(self.ideation_deadline)

    @property
    def final_deadline_dt(self) -> datetime:
        return self._at(self.final_deadline)

    def fmt(self, dt: datetime) -> str:
        return dt.astimezone(self.tz).strftime(f"%d %b %Y, %I:%M:%S %p {self.timezone_label}")

    def team_branch(self, number: int) -> str:
        return f"{self.branch_prefix}{number:02d}"

    def team_number_from_branch(self, branch: str) -> Optional[int]:
        m = re.fullmatch(re.escape(self.branch_prefix) + r"(\d{2})", branch)
        if not m:
            return None
        n = int(m.group(1))
        return n if 1 <= n <= self.max_teams else None


def load_config(path: Path = CONFIG_PATH) -> Config:
    with open(path, encoding="utf-8") as fh:
        return Config(**json.load(fh))


# --------------------------------------------------------------------------
# TEAM_INFO.txt
# --------------------------------------------------------------------------
TEAM_FIELDS = [
    "TEAM_NUMBER", "BRANCH_NAME", "TEAM_NAME", "PROBLEM_STATEMENT_NUMBER",
    "WEBSITE_TITLE", "AI_PLATFORM_USED",
]
MEMBER_PREFIXES = ["LEADER", "MEMBER2", "MEMBER3"]
MEMBER_ATTRS = ["NAME", "USN", "EMAIL", "PHONE"]
ALL_KEYS = TEAM_FIELDS + [f"{p}_{a}" for p in MEMBER_PREFIXES for a in MEMBER_ATTRS]

EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
USN_RE = re.compile(r"^[A-Z0-9]{5,15}$")
NAME_RE = re.compile(r"^[A-Za-z][A-Za-z .'-]{1,59}$")


@dataclass
class Member:
    role: str
    name: str = ""
    usn: str = ""
    email: str = ""
    phone: str = ""

    @property
    def is_empty(self) -> bool:
        return not any([self.name, self.usn, self.email, self.phone])


@dataclass
class TeamInfo:
    fields: Dict[str, str] = field(default_factory=dict)
    unknown_keys: List[str] = field(default_factory=list)
    duplicate_keys: List[str] = field(default_factory=list)
    bad_lines: List[int] = field(default_factory=list)

    def get(self, key: str) -> str:
        return self.fields.get(key, "").strip()

    @property
    def members(self) -> List[Member]:
        out = []
        for prefix in MEMBER_PREFIXES:
            m = Member(
                role="Leader" if prefix == "LEADER" else f"Member {prefix[-1]}",
                name=self.get(f"{prefix}_NAME"),
                usn=self.get(f"{prefix}_USN").upper().replace(" ", ""),
                email=self.get(f"{prefix}_EMAIL").lower(),
                phone=self.get(f"{prefix}_PHONE"),
            )
            out.append(m)
        return out

    @property
    def active_members(self) -> List[Member]:
        return [m for m in self.members if not m.is_empty]


def parse_team_info(text: str) -> TeamInfo:
    info = TeamInfo()
    text = text.lstrip("﻿")  # tolerate a BOM added by Windows Notepad
    for lineno, raw in enumerate(text.splitlines(), start=1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            info.bad_lines.append(lineno)
            continue
        key, value = line.split(":", 1)
        key = key.strip().upper().replace(" ", "_")
        value = value.strip()
        if "{{" in value and "}}" in value:  # unreplaced template placeholder
            value = ""
        if key not in ALL_KEYS:
            info.unknown_keys.append(key)
            continue
        if key in info.fields:
            info.duplicate_keys.append(key)
        info.fields[key] = value
    return info


def normalise_phone(phone: str) -> str:
    return re.sub(r"[\s()+-]", "", phone)


def phone_is_valid(phone: str) -> bool:
    digits = normalise_phone(phone)
    if not digits.isdigit():
        return False
    if len(digits) == 10:
        return True
    return (len(digits) == 12 and digits.startswith("91")) or (len(digits) == 11 and digits.startswith("0"))


# --------------------------------------------------------------------------
# Markdown "was the template actually filled in?" heuristic
# --------------------------------------------------------------------------
_COMMENT_RE = re.compile(r"<!--.*?-->", re.S)


def added_text_chars(content: str, template: str) -> int:
    """Number of meaningful characters a team added on top of a template."""
    tmpl_lines = {l.strip() for l in _COMMENT_RE.sub("", template).splitlines()}
    count = 0
    for line in _COMMENT_RE.sub("", content).splitlines():
        s = line.strip()
        if not s or s in tmpl_lines:
            continue
        s = re.sub(r"_\.\.\._|[|#*_`\-:]", "", s).strip()
        count += len(s)
    return count
