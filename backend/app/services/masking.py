"""Local masking of confidential text before anything is sent to an AI service.

What is masked: names the manager lists as confidential (codenames, customer names) plus emails, phone numbers,
card numbers (Luhn-checked) and API-key-looking strings. Each value becomes a token such as CONF_001. The map
(token -> original) never leaves the server. Python rule checks run on the ORIGINAL text, locally.

Fail closed: if masking cannot run, or a secret is still present in the prompt, the AI call is skipped.
"""
import re
from typing import Optional

from .issues import find_all

PREFIX = {"confidential": "CONF", "email": "EMAIL", "phone": "PHONE", "card": "CARD", "key": "KEY"}
LABEL = {"confidential": "Confidential term", "email": "Email address", "phone": "Phone number",
         "card": "Card number", "key": "API key or secret"}
_PRIORITY = {"key": 0, "card": 1, "email": 2, "confidential": 3, "phone": 4}  # who wins when matches overlap

_EMAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}")
_PHONES = [
    re.compile(r"(?<![\w+])\+\d{1,3}[\s().-]?(?:\d[\s().-]?){8,12}\d(?!\d)"),         # +91 98765 43210, +1 (555) 123-4567
    re.compile(r"(?<![\d.,-])\d{3}[-.\s]\d{3}[-.\s]\d{4}(?![\d.,-])"),                  # 555-123-4567
    re.compile(r"(?<![\d.,-])(?:0|91)?[6-9]\d{9}(?![\d.,-])"),                           # Indian mobile, 10 digits
]
_CARD = re.compile(r"(?<![\d-])(?:\d[ -]?){12,18}\d(?![\d-])")
_KEYS = [
    re.compile(r"AIza[0-9A-Za-z_\-]{20,}"), re.compile(r"AQ\.[0-9A-Za-z_\-]{20,}"),
    re.compile(r"\bsk-[A-Za-z0-9_\-]{20,}"), re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}"),
    re.compile(r"\bxox[baprs]-[A-Za-z0-9\-]{10,}"), re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}"),  # JSON web tokens
]


def luhn_ok(number: str) -> bool:
    digits = [int(c) for c in number if c.isdigit()]
    if not 13 <= len(digits) <= 19:
        return False
    total = 0
    for i, d in enumerate(reversed(digits)):
        if i % 2 == 1:
            d *= 2
            d -= 9 if d > 9 else 0
        total += d
    return total % 10 == 0


def _spans(text: str, terms: dict) -> list[tuple[int, int, str]]:
    found: list[tuple[int, int, str]] = []
    for item in (terms or {}).get("confidential", []) or []:
        term = (item.get("term") if isinstance(item, dict) else str(item)) or ""
        if len(term.strip()) >= 2:
            found += [(s, e, "confidential") for s, e in find_all(text, term)]
    found += [(m.start(), m.end(), "email") for m in _EMAIL.finditer(text)]
    for rx in _PHONES:
        found += [(m.start(), m.end(), "phone") for m in rx.finditer(text)]
    found += [(m.start(), m.end(), "card") for m in _CARD.finditer(text) if luhn_ok(m.group())]
    for rx in _KEYS:
        found += [(m.start(), m.end(), "key") for m in rx.finditer(text)]
    # resolve overlaps: stronger kind first, then longer, then earlier
    chosen: list[tuple[int, int, str]] = []
    for s, e, k in sorted(found, key=lambda x: (_PRIORITY[x[2]], -(x[1] - x[0]), x[0])):
        if all(e <= cs or s >= ce for cs, ce, _ in chosen):
            chosen.append((s, e, k))
    return sorted(chosen)


def preview(kind: str, value: str) -> str:
    """What the screen and the stored draft may show. Secrets are never kept in full outside this request."""
    if kind == "confidential":
        return value                                   # a term the manager listed in the brand kit
    if kind == "card":
        return "•••• " + re.sub(r"\D", "", value)[-4:]
    if kind == "key":
        return value[:4] + "… (hidden)"
    if kind == "email":
        name, _, dom = value.partition("@")
        return name[:1] + "***@" + dom
    return "•••• " + re.sub(r"\D", "", value)[-3:]    # phone


class Masker:
    """Mask once per draft check, pass the same masker to every AI call."""

    def __init__(self, text: str, terms: Optional[dict] = None):
        self.original = text
        self.mapping: dict[str, str] = {}   # token -> original value
        self.items: list[dict] = []         # one entry per distinct value
        by_value: dict[tuple[str, str], str] = {}
        counters: dict[str, int] = {}
        out, last = [], 0
        for s, e, kind in _spans(text, terms or {}):
            value = text[s:e]
            token = by_value.get((kind, value))
            if token is None:  # exact value, so unmasking restores the exact original casing
                counters[kind] = counters.get(kind, 0) + 1
                token = f"{PREFIX[kind]}_{counters[kind]:03d}"
                by_value[(kind, value)] = token
                self.mapping[token] = value
                self.items.append({"token": token, "kind": kind, "label": LABEL[kind], "preview": preview(kind, value)})
            out += [text[last:s], token]
            last = e
        out.append(text[last:])
        self.masked = "".join(out)
        self._rx = re.compile("|".join(re.escape(t) for t in sorted(self.mapping, key=len, reverse=True))) if self.mapping else None

    def unmask(self, s: str) -> str:
        return self._rx.sub(lambda m: self.mapping[m.group()], s) if self._rx else s

    def leaked(self, *parts: str) -> list[str]:
        """Originals that still appear in text we are about to send (should always be empty)."""
        blob = "\n".join(parts).lower()
        return [t for t, v in self.mapping.items() if len(v.strip()) >= 3 and v.lower() in blob]

    def summary(self, ai_used: bool = True) -> dict:
        by_kind: dict[str, int] = {}
        for i in self.items:
            by_kind[i["kind"]] = by_kind.get(i["kind"], 0) + 1
        return {"ai_used": ai_used, "count": len(self.items),
                "occurrences": sum(self.masked.count(t) for t in self.mapping),
                "by_kind": by_kind, "items": self.items}


def empty_summary(ai_used: bool) -> dict:
    return {"ai_used": ai_used, "count": 0, "occurrences": 0, "by_kind": {}, "items": []}


def safe_masker(text: str, terms: Optional[dict]) -> Optional[Masker]:
    """None means masking failed: the caller must not call the AI."""
    try:
        return Masker(text, terms)
    except Exception:  # noqa: BLE001
        return None