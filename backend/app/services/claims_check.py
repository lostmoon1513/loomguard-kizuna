"""Claim pipeline. Code (not the LLM) decides the status of every claim.

1. Find claims with regex (numbers, prices, percentages, ratings, superlatives).
2. Pick candidate approved facts by unit family and topic words.
3. Compare numbers. Status: SUPPORTED (no issue), CONTRADICTED, OUTDATED, UNSUPPORTED.
Citations (Row N) always come from the fact row metadata."""
import re
from datetime import date
from typing import Optional

from .issues import make_issue

NUM = r"\d(?:[\d,]*\d)?(?:\.\d+)?"
CMP = r"(?:more than|over|at least|above)"
LB = r"(?<![\w#$.,])"
APOS = r"['’]"

SUFFIXES = ("ations", "ation", "ates", "ate", "ions", "ion", "ing", "ies", "es", "s", "ed")
IGNORE_NOUNS = {"and", "or", "of", "to", "in", "the", "a", "by", "am", "pm", "st", "nd", "th", "for", "with", "on", "at", "is", "x"}
VAGUE_MIN = {"hundreds": 200, "thousands": 2000, "millions": 2_000_000, "dozens": 24}

RATING_RE = re.compile(rf"{LB}(?:(?P<cmp>{CMP})\s+)?(?P<n>{NUM})\s*(?:out of|/)\s*(?P<d>5|10)\b", re.I)
MONEY_RE = re.compile(rf"(?:(?P<cmp>{CMP})\s+)?(?:US)?\$\s?(?P<n>{NUM})(?:\s*(?:/|per|a)\s*(?:month|mo|year|yr))?", re.I)
MONEY2_RE = re.compile(rf"{LB}(?:(?P<cmp>{CMP})\s+)?(?P<n>{NUM})\s*(?:USD|dollars)(?:\s*(?:/|per)\s*(?:month|year))?", re.I)
PERCENT_RE = re.compile(rf"{LB}(?:(?P<cmp>{CMP})\s+)?(?P<n>{NUM})\s?%", re.I)
SECONDS_RE = re.compile(rf"{LB}(?:(?P<cmp>{CMP})\s+)?(?P<n>{NUM})\s*(?:seconds?|secs?)\b", re.I)
COUNT_RE = re.compile(rf"{LB}(?:(?P<cmp>{CMP})\s+)?(?P<n>{NUM})\+?[\s-]+(?P<noun>[A-Za-z]{{3,}})", re.I)
VAGUE_RE = re.compile(r"\b(?P<w>hundreds|thousands|millions|dozens)\s+of\s+(?P<noun>[A-Za-z]{3,})", re.I)
SUPER_RES = [re.compile(p, re.I) for p in [
    rf"\bworld{APOS}?s\s+#1",
    r"(?<![\w#])#1(?!\w)",
    r"\bnumber (?:one|1)\b",
    r"\b(?:the\s+)?(?:best|fastest|safest|cheapest)\b(?!-in-class)",
    r"\b(?:a|the)\s+leading\b",
    r"\bmost\s+(?:trusted|powerful|accurate|secure|reliable|popular)\b",
    r"\bguarantee[sd]?\s+(?:results|success|revenue|growth|outcomes|to\s+\w+)",
]]


def stem(word: str) -> str:
    w = word.lower().strip(".,;:!?()\"'")
    for suf in SUFFIXES:
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            return w[: -len(suf)]
    return w


def _stems(text: str) -> set[str]:
    return {stem(t) for t in re.findall(r"[A-Za-z]{3,}", text)}


def _to_num(s: str) -> float:
    return float(s.replace(",", ""))


def find_claims(text: str) -> list[dict]:
    """Return claim dicts with start/end/kind/number/noun/comparator, no overlaps."""
    claims: list[dict] = []
    taken: list[tuple[int, int]] = []

    def free(s, e):
        return all(e <= a or s >= b for a, b in taken)

    def add(m, kind, **extra):
        s, e = m.span()
        if not free(s, e):
            return
        taken.append((s, e))
        d = {"start": s, "end": e, "kind": kind, "cmp": (m.groupdict().get("cmp") or "").lower() or None}
        if "n" in m.groupdict() and m.group("n"):
            d["number"] = _to_num(m.group("n"))
        d.update(extra)
        claims.append(d)

    for m in SUPER_RES[0:1]:
        for x in m.finditer(text):
            add(x, "superlative")
    for rx, kind in ((RATING_RE, "rating"), (MONEY_RE, "money"), (MONEY2_RE, "money"), (PERCENT_RE, "percent"), (SECONDS_RE, "seconds")):
        for m in rx.finditer(text):
            add(m, kind)
    for m in VAGUE_RE.finditer(text):
        add(m, "vague", word=m.group("w").lower(), noun=m.group("noun").lower())
    for rx in SUPER_RES[1:]:
        for m in rx.finditer(text):
            add(m, "superlative")
    for m in COUNT_RE.finditer(text):
        noun = m.group("noun").lower()
        n = _to_num(m.group("n"))
        if noun in IGNORE_NOUNS or (1900 <= n <= 2100 and "," not in m.group("n")):
            continue
        add(m, "count", noun=noun)
    return sorted(claims, key=lambda c: c["start"])


# ---------- facts side ----------

def fact_family(f: dict) -> str:
    u = f["unit"].lower()
    if "usd" in u or "$" in u:
        return "money"
    if u == "percent" or "%" in u:
        return "percent"
    if "out of" in u:
        return "rating"
    if u in ("second", "seconds"):
        return "seconds"
    return "noun:" + stem(u)


def claim_family(c: dict) -> Optional[str]:
    if c["kind"] in ("money", "percent", "rating", "seconds"):
        return c["kind"]
    if c["kind"] in ("count", "vague"):
        return "noun:" + stem(c["noun"])
    return None


def _expired(f: dict, today: date) -> bool:
    return bool(f.get("valid_until")) and date.fromisoformat(f["valid_until"]) < today


def _base_name(f: dict) -> str:
    return re.sub(r"\(.*?\)", "", f["claim"]).strip().lower()


def _number_ok(c: dict, f: dict) -> bool:
    fv = f.get("value_num")
    if fv is None:
        return False
    if c["kind"] == "vague":
        return fv >= VAGUE_MIN[c["word"]]
    n = c["number"]
    if c["cmp"] in ("more than", "over", "above"):
        return fv > n
    if c["cmp"] == "at least":
        return fv >= n
    return abs(fv - n) < 1e-9


def _candidates(c: dict, ctx_stems: set[str], facts: list[dict]) -> list[dict]:
    fam = claim_family(c)
    direct = [f for f in facts if fact_family(f) == fam]
    if direct or fam is None:
        return direct
    # noun claims such as "200 tools": fall back to topic words around the claim ("integrates")
    return [f for f in facts if fact_family(f).startswith("noun:") and fact_family(f)[5:] in ctx_stems]


def _rank(c, f, ctx_stems, today):
    topic = len(_stems(f["claim"]) & ctx_stems)
    return (-topic, _expired(f, today), f["row"])


def fmt_number(v: float, like_comma: bool) -> str:
    if float(v).is_integer():
        iv = int(v)
        return f"{iv:,}" if (like_comma or iv >= 10000) else str(iv)
    return f"{v:g}"


def _fix_phrase(c: dict, quote: str, f: dict) -> Optional[str]:
    v = f.get("value_num")
    if v is None or c["kind"] in ("superlative",):
        return None
    if c["kind"] == "vague":
        return f"{fmt_number(v, False)} {c['noun']}"
    body = re.sub(rf"^{CMP}\s+", "", quote, flags=re.I)
    out = re.sub(NUM, lambda m: fmt_number(v, "," in m.group(0)), body, count=1)
    fam = fact_family(f)
    if c["kind"] == "count" and fam.startswith("noun:") and stem(c["noun"]) != fam[5:]:
        out = re.sub(rf"{re.escape(c['noun'])}\s*$", f["unit"].lower(), out, flags=re.I)  # "200 tools" -> "40 integrations"
    return out


def verify_claims(text: str, claims: list[dict], facts: list[dict], today: Optional[date] = None,
                  priority: str = "mandatory") -> list[dict]:
    today = today or date.today()
    issues: list[dict] = []
    for c in claims:
        s, e = c["start"], c["end"]
        quote = text[s:e]
        window = text[max(0, s - 70): e + 70]
        ctx = _stems(window)
        no_row = {"doc": "Approved Facts CSV", "ref": "No matching row"}

        if c["kind"] == "superlative":
            issues.append(make_issue(
                text, s, e, category="CLAIM", claim_status="UNSUPPORTED", severity="high", source="python_rule",
                reason="No approved source supports this ranking, superlative or guarantee. It is marked unverified, not false. Add an approved source or reword it.",
                citation=no_row, needs_review=True, priority=priority))
            continue

        cands = _candidates(c, ctx, facts)
        if not cands:
            if c["kind"] == "count" and c["number"] < 10:
                continue  # small plain counts ("3 steps") are not promotional claims
            issues.append(make_issue(
                text, s, e, category="CLAIM", claim_status="UNSUPPORTED", severity="medium", source="python_rule",
                reason=f"No approved fact covers '{quote}'. It is marked unverified, not false.",
                citation=no_row, needs_review=True, priority=priority))
            continue

        cands.sort(key=lambda f: _rank(c, f, ctx, today))
        matches = [f for f in cands if _number_ok(c, f)]
        if matches:
            current = [f for f in matches if not _expired(f, today)]
            if current:
                continue  # SUPPORTED: no issue raised
            old = matches[0]
            alt = next((f for f in facts if f is not old and _base_name(f) == _base_name(old) and not _expired(f, today)), None)
            reason = f"This matches '{old['claim']}' (Row {old['row']}), but that fact expired on {old['valid_until']}."
            fixes = []
            if alt:
                reason += f" The current approved value is {alt['value']} {alt['unit']} (Row {alt['row']})."
                fx = _fix_phrase(c, quote, alt)
                fixes = [fx] if fx else []
            issues.append(make_issue(
                text, s, e, category="CLAIM", claim_status="OUTDATED", severity="medium", source="python_rule",
                reason=reason, citation={"doc": "Approved Facts CSV", "ref": f"Row {old['row']}"},
                fixes=fixes, needs_review=not alt, priority=priority))
            continue

        best = next((f for f in cands if not _expired(f, today)), cands[0])
        fx = _fix_phrase(c, quote, best)
        issues.append(make_issue(
            text, s, e, category="CLAIM", claim_status="CONTRADICTED", severity="high", source="python_rule",
            reason=f"Approved facts list {best['value']} {best['unit']} for '{best['claim']}' (Row {best['row']}), which does not match '{quote}'.",
            citation={"doc": "Approved Facts CSV", "ref": f"Row {best['row']}"},
            fixes=[fx] if fx else [], priority=priority))
    return issues


def verify_extra_phrases(text: str, phrases: list[str], facts: list[dict], taken: list[dict], priority: str = "mandatory") -> list[dict]:
    """Claims found by Gemini that regex missed. Code cannot judge them, so a human reviews."""
    out = []
    for ph in phrases[:5]:
        s = text.find(ph)
        if s < 0:
            continue  # guard: phrase must exist verbatim
        e = s + len(ph)
        if any(not (e <= t["start"] or s >= t["end"]) for t in taken):
            continue
        ph_stems = _stems(ph)
        near = max(facts, key=lambda f: len(_stems(f["claim"]) & ph_stems), default=None)
        cit = {"doc": "Approved Facts CSV", "ref": "No matching row"}
        extra = ""
        if near and _stems(near["claim"]) & ph_stems:
            cit = {"doc": "Approved Facts CSV", "ref": f"Row {near['row']}"}
            extra = f" Closest approved fact: '{near['claim']}' = {near['value']} {near['unit']}."
        out.append(make_issue(
            text, s, e, category="CLAIM", claim_status="UNSUPPORTED", severity="medium", source="gemini+python",
            reason="No approved fact states this exact claim." + extra + " A human should confirm.",
            citation=cit, needs_review=True, priority=priority))
    return out


def run_claims_check(text: str, facts: list[dict], today: Optional[date] = None, priority: str = "mandatory") -> tuple[list[dict], list[dict]]:
    claims = find_claims(text)
    return verify_claims(text, claims, facts, today, priority), claims