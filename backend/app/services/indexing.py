"""Turn a brand guide PDF and facts CSV into rule chunks and fact rows with metadata."""
import csv
import io
import re
from datetime import date

from .parsing import ParseError, Page, normalise_space

MANDATORY = re.compile(r"\b(must|never|always|do not|don't|prohibited|forbidden|required|only)\b", re.I)
ADVISORY = re.compile(r"\b(should|prefer|aim|try|avoid|recommend|ideally)\b", re.I)
EXCEPTION = re.compile(r"\b(exception|except|unless|only when|only if)\b", re.I)
SENTENCE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9#])")

MIN_WORDS, MAX_WORDS = 60, 450  # roughly 80-600 tokens; sample guide rules are short, real ones longer


def _priority(text: str) -> str:
    if MANDATORY.search(text):
        return "mandatory"
    return "advisory"


def _split_heading(page_text: str) -> tuple[str, str]:
    """First short line without a final period is the section heading."""
    lines = [ln.strip() for ln in page_text.splitlines() if ln.strip()]
    if not lines:
        return "", ""
    first = lines[0]
    if len(first) <= 70 and not first.endswith((".", ":", ",")):
        return first, normalise_space(" ".join(lines[1:]))
    return "", normalise_space(" ".join(lines))


def _group_sentences(sentences: list[str]) -> list[list[str]]:
    """Group sentences into chunks. A sentence holding an exception stays with the sentence before it."""
    groups: list[list[str]] = []
    for s in sentences:
        if groups and EXCEPTION.search(s):
            groups[-1].append(s)
        else:
            groups.append([s])
    # merge small groups, split overly long ones
    merged: list[list[str]] = []
    for g in groups:
        words = sum(len(x.split()) for x in g)
        if merged and sum(len(x.split()) for x in merged[-1]) + words <= MAX_WORDS and words < MIN_WORDS:
            merged[-1].extend(g)
        else:
            merged.append(list(g))
    return merged


def build_guide_chunks(pages: list[Page], brand_id: str, kit_version: int) -> list[dict]:
    chunks: list[dict] = []
    for page in pages:
        heading, body = _split_heading(page.text)
        if not body:
            continue
        sentences = [s.strip() for s in SENTENCE.split(body) if s.strip()]
        for idx, group in enumerate(_group_sentences(sentences), start=1):
            text = " ".join(group)
            exc = next((s for s in group if EXCEPTION.search(s)), None)
            chunks.append({
                "type": "guide",
                "brand_id": brand_id,
                "kit_version": kit_version,
                "rule_id": f"p{page.number}_r{idx}",
                "section": heading,
                "page_number": page.number,
                "text": f"{heading}. {text}" if heading else text,
                "priority": _priority(text),
                "exception": exc,
            })
    return chunks


def _num(value: str):
    try:
        return float(value.replace(",", ""))
    except ValueError:
        return None


def parse_facts_csv(data: bytes, brand_id: str, kit_version: int) -> list[dict]:
    """Rows keep `row` = spreadsheet row number (header is row 1)."""
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ParseError("ENCODING", "The facts CSV must be UTF-8.") from exc
    reader = csv.DictReader(io.StringIO(text))
    required = {"id", "claim", "value", "unit", "source", "valid_until"}
    missing = required - set(reader.fieldnames or [])
    if missing:
        raise ParseError("FACTS_COLUMNS", f"Facts CSV is missing columns: {', '.join(sorted(missing))}")
    rows = []
    for i, r in enumerate(reader, start=2):
        if not (r.get("claim") or "").strip():
            continue
        valid = (r.get("valid_until") or "").strip()
        try:
            valid_date = date.fromisoformat(valid) if valid else None
        except ValueError as exc:
            raise ParseError("FACTS_DATE", f"Row {i}: valid_until must be YYYY-MM-DD, got '{valid}'") from exc
        value = (r["value"] or "").strip()
        rows.append({
            "type": "fact",
            "brand_id": brand_id,
            "kit_version": kit_version,
            "fact_id": r["id"].strip(),
            "row": i,
            "claim": r["claim"].strip(),
            "value": value,
            "value_num": _num(value),
            "unit": (r["unit"] or "").strip(),
            "source": (r["source"] or "").strip(),
            "valid_until": valid_date.isoformat() if valid_date else None,
            "text": f"{r['claim'].strip()} {value} {(r['unit'] or '').strip()}",
        })
    if not rows:
        raise ParseError("FACTS_EMPTY", "The facts CSV has no usable rows.")
    return rows
