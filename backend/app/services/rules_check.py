"""Deterministic checks. Pure Python, no AI, so they work even when Gemini is down."""
import re

from .issues import find_all, guide_citation, make_issue, match_case

MAX_SENTENCE_WORDS = 25
SENTENCE_RE = re.compile(r"[^.!?\n]+[.!?]?")


def check_terms(text: str, terms: dict, chunks: list[dict]) -> list[dict]:
    issues: list[dict] = []
    for b in terms.get("banned", []):
        for s, e in find_all(text, b["term"]):
            cit, prio = guide_citation(chunks, b["term"])
            reason = f"'{text[s:e]}' is a banned term." + (f" {b['reason']}." if b.get("reason") else "")
            issues.append(make_issue(text, s, e, category="TERMINOLOGY", severity="high" if prio == "mandatory" else "medium",
                                     source="python_rule", reason=reason, citation=cit, priority=prio))
    for p in terms.get("preferred", []):
        for s, e in find_all(text, p["avoid"]):
            cit, prio = guide_citation(chunks, p["avoid"])
            issues.append(make_issue(text, s, e, category="TERMINOLOGY", severity="low", source="python_rule",
                                     reason=f"Brand prefers '{p['use']}' instead of '{p['avoid']}'.",
                                     citation=cit, fixes=[match_case(p["use"], text[s:e])], priority=prio))
    return issues


def check_readability(text: str) -> list[dict]:
    issues = []
    for m in SENTENCE_RE.finditer(text):
        raw = m.group(0)
        words = raw.split()
        if len(words) > MAX_SENTENCE_WORDS:
            s = m.start() + (len(raw) - len(raw.lstrip()))
            e = m.start() + len(raw.rstrip())
            issues.append(make_issue(text, s, e, category="READABILITY", severity="low", source="python_rule",
                                     reason=f"Sentence has {len(words)} words. The guide asks for fewer than {MAX_SENTENCE_WORDS + 1}.",
                                     citation={"doc": "Brand Guide", "ref": "Readability section"}))
    return issues


def run_rules_check(text: str, terms: dict, chunks: list[dict]) -> list[dict]:
    return check_terms(text, terms, chunks) + check_readability(text)