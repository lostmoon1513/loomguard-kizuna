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


# ---------- output guard for Gemini tone findings ----------
_BAD_REPLACEMENT = re.compile(r"https?://|approve|ignore (the )?(brand )?rules", re.I)


def guard_tone_findings(text: str, findings: list, rule_chunks: list[dict]) -> list[dict]:
    """Keep only findings that pass every check. Offsets and citations come from code, never from the model.
    Checks: phrase exists verbatim, no overlaps, <=3 replacements, similar length, no links or instructions."""
    cite_chunk = rule_chunks[0] if rule_chunks else None
    citation = ({"doc": "Brand Guide", "ref": f"Page {cite_chunk['page_number']}", "rule_id": cite_chunk["rule_id"]}
                if cite_chunk else None)
    priority = cite_chunk["priority"] if cite_chunk else "advisory"
    out, used = [], []
    for f in findings[:6]:
        phrase = (f.original_phrase or "").strip()
        if not phrase or len(phrase) > 200 or "\n" in phrase:
            continue
        s = text.find(phrase)
        if s < 0:
            continue  # hallucinated or altered phrase: dropped
        e = s + len(phrase)
        if any(not (e <= a or s >= b) for a, b in used):
            continue
        options = []
        for r in f.replacement_options:
            r = (r or "").strip()
            if not r or r.lower() == phrase.lower() or len(r) > 200 or "\n" in r or _BAD_REPLACEMENT.search(r):
                continue
            if not 0.3 <= len(r) / len(phrase) <= 3.0:
                continue
            if r not in options:
                options.append(r)
        used.append((s, e))
        out.append(make_issue(
            text, s, e, category="TONE", severity="medium" if priority == "mandatory" else "low", source="gemini",
            reason=(f.reason or "Tone does not match the brand voice.").strip()[:240], citation=citation,
            fixes=options[:3], needs_review=bool(not options or (cite_chunk and cite_chunk.get("exception"))),
            priority=priority))
    return out