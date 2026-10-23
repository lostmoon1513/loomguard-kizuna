"""Helpers shared by all checks: build issues, find phrases, merge and number them."""
import re
from typing import Optional


def find_all(text: str, phrase: str) -> list[tuple[int, int]]:
    """Whole-word, case-insensitive matches. Hyphen, space and underscore are treated as the same."""
    parts = [re.escape(p) for p in re.split(r"[-_\s]+", phrase.strip()) if p]
    if not parts:
        return []
    pattern = r"(?<![A-Za-z0-9])" + r"[-_\s]+".join(parts) + r"(?:s)?(?![A-Za-z0-9])"
    return [(m.start(), m.end()) for m in re.finditer(pattern, text, re.I)]


def match_case(replacement: str, original: str) -> str:
    if original[:1].isupper():
        return replacement[:1].upper() + replacement[1:]
    return replacement


def make_issue(text: str, start: int, end: int, *, category: str, severity: str, source: str, reason: str,
               citation: Optional[dict] = None, fixes: Optional[list] = None, needs_review: bool = False,
               priority: str = "advisory", claim_status: Optional[str] = None) -> dict:
    return {
        "id": "",
        "category": category,
        "claim_status": claim_status,
        "severity": severity,
        "source": source,
        "quote": text[start:end],
        "start": start,
        "end": end,
        "reason": reason,
        "citation": citation,
        "suggested_fixes": (fixes or [])[:3],
        "needs_review": needs_review,
        "priority": priority,
        "status": "open",
        "exception_note": None,
    }


def guide_citation(chunks: list[dict], phrase: str) -> tuple[Optional[dict], str]:
    """Cite the first guide chunk that mentions the phrase. Citation comes from chunk metadata only."""
    for c in chunks:
        if find_all(c["text"], phrase):
            return ({"doc": "Brand Guide", "ref": f"Page {c['page_number']}", "rule_id": c["rule_id"]}, c["priority"])
    return None, "advisory"


def finalize(issues: list[dict]) -> list[dict]:
    """Sort by position, drop exact duplicates, then number as iss_01, iss_02 ..."""
    seen, out = set(), []
    for i in sorted(issues, key=lambda x: (x["start"], x["end"], x["category"])):
        key = (i["start"], i["end"], i["category"])
        if key in seen:
            continue
        seen.add(key)
        out.append(i)
    for n, i in enumerate(out, start=1):
        i["id"] = f"iss_{n:02d}"
    return out