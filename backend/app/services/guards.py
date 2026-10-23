"""Guardrails. Step 5 part: input scan for prompt-injection text inside a draft.
Later steps add the output guard for Gemini replies."""
import re

from .issues import make_issue

INJECTION_PATTERNS = [
    r"ignore (all |the |any |previous |prior )*(brand )?(rules|instructions|guidelines)",
    r"disregard (all |the |any |previous |prior )*(brand )?(rules|instructions|guidelines)",
    r"(approve|pass|accept) this (draft|content|document)",
    r"you are now",
    r"system prompt",
    r"do not (flag|report|check)",
    r"mark (this|it) as (compliant|approved)",
]
_COMPILED = [re.compile(p, re.I) for p in INJECTION_PATTERNS]


def scan_injection(text: str) -> list[dict]:
    """Flag text that tries to instruct the checker. The draft is data, never instructions."""
    spans = []
    for rx in _COMPILED:
        for m in rx.finditer(text):
            spans.append((m.start(), m.end()))
    if not spans:
        return []
    # merge overlapping spans, then widen each to the whole sentence for a readable highlight
    spans.sort()
    merged = [list(spans[0])]
    for s, e in spans[1:]:
        if s <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged.append([s, e])
    issues = []
    for s, e in merged:
        ends = [m.end() for m in re.finditer(r"[.!?]\s+|\n", text[:s])]
        left = ends[-1] if ends else 0
        right_candidates = [i + 1 for i in (text.find(".", e), text.find("!", e), text.find("?", e), text.find("\n", e)) if i != -1]
        right = min(right_candidates) if right_candidates else len(text)
        issues.append(make_issue(text, left, right, category="SECURITY", severity="high", source="python_rule",
                                 reason="This text tries to give instructions to the checker. LoomGuard treats the draft as content only, so it was ignored and flagged for a human.",
                                 needs_review=True, priority="mandatory"))
    return issues