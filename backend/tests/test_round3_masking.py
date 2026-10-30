"""Round 3 masking: what is masked, that nothing confidential reaches the AI, and that it fails closed."""
import asyncio
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.services import draft_ops, drafts_store, gemini_client, masking, runner, tone_check
from app.services.indexing import build_guide_chunks, parse_facts_csv
from app.services.masking import Masker, luhn_ok
from app.services.parsing import parse_pdf
from app.services.retrieval import HybridIndex

drafts_store.PERSIST = False
KIT_DIR = Path(__file__).resolve().parents[1] / "demo_kit"
CHUNKS = build_guide_chunks(parse_pdf((KIT_DIR / "brand_guide.pdf").read_bytes()), "default", 1)
FACTS = parse_facts_csv((KIT_DIR / "approved_facts.csv").read_bytes(), "default", 1)
TERMS = json.loads((KIT_DIR / "terms.json").read_text(encoding="utf-8"))
KIT = SimpleNamespace(version=1, chunks=CHUNKS, facts=FACTS, guide_index=HybridIndex(CHUNKS), terms=TERMS)

CARD = "4111" + " 1111" * 3          # a well-known test card number, built at runtime on purpose
KEY = "AIza" + "x" * 30             # fake key-shaped string
EMAIL, PHONE = "priya.nair@orion-bank.example", "+91 98765 43210"
SECRET_TEXT = (f"Project Falcon goes live with Orion Bank next month. Write to {EMAIL} or call {PHONE}. "
               f"Test card {CARD}, key {KEY}. Helix is secret. Aurora is super easy to use.")
SECRETS = ["Project Falcon", "Orion Bank", EMAIL, PHONE, CARD, KEY, "Helix", "98765", "priya.nair"]


def run(coro):
    return asyncio.run(coro)


def test_everything_sensitive_is_masked_and_roundtrips():
    m = Masker(SECRET_TEXT, TERMS)
    for s in SECRETS:
        assert s.lower() not in m.masked.lower(), s
    assert m.unmask(m.masked) == SECRET_TEXT
    kinds = {i["kind"] for i in m.items}
    assert kinds == {"confidential", "email", "phone", "card", "key"}
    s = m.summary()
    assert s["count"] == len(m.items) and s["ai_used"] is True and s["by_kind"]["confidential"] == 3


def test_business_numbers_are_not_masked():
    text = ("Used by 10,000 teams in 32 countries since 2019. Uptime 99.9%, loads in 1.2 seconds, plans from $24 per month, "
            "call 1234 5678 9012 3456 reference 20261024 or 2026-10-24.")
    m = Masker(text, TERMS)
    assert m.masked == text and m.items == []


def test_luhn():
    assert luhn_ok(CARD) and not luhn_ok("1234 5678 9012 3456") and not luhn_ok("12345")


def test_email_wins_over_a_confidential_term_inside_it():
    m = Masker("Mail priya.nair@orion-bank.example now.", TERMS)
    assert m.masked == "Mail EMAIL_001 now." and m.items[0]["kind"] == "email"


def test_same_value_same_token_and_casing_is_restored_exactly():
    m = Masker("Project Falcon and Project Falcon and project falcon.", TERMS)
    assert m.masked.count("CONF_001") == 2 and "CONF_002" in m.masked
    assert m.unmask(m.masked) == "Project Falcon and Project Falcon and project falcon."


def test_unmask_leaves_unknown_tokens_alone():
    m = Masker("Project Falcon.", TERMS)
    assert m.unmask("CONF_001 and CONF_999") == "Project Falcon and CONF_999"


def test_nothing_to_mask():
    assert Masker("Aurora is a dashboard.", TERMS).masked == "Aurora is a dashboard."
    assert Masker("Aurora is a dashboard.", {}).items == []


# ---------------------------------------------------------------- what is actually sent to the AI
class FakeGemini:
    """Stands in for the Gemini call and records everything that would have been sent."""

    def __init__(self):
        self.sent: list[str] = []

    def call(self, system, user, schema):
        self.sent += [system, user]
        if schema.__name__ == "ToneResult":
            phrase = "CONF_001 goes live" if "CONF_001 goes live" in user else "super easy"
            return json.dumps({"findings": [{"original_phrase": phrase, "reason": "casual", "replacement_options": ["simple to use"]}]})
        return json.dumps({"phrases": ["CONF_002 is a trusted partner", "Aurora makes dashboards easy"]})


def with_fake_ai(fn):
    fake = FakeGemini()
    cfg = SimpleNamespace(gemini_api_key="test-key", gemini_timeout=5)
    old = (runner.settings, gemini_client.settings, gemini_client._call)
    runner.settings, gemini_client.settings, gemini_client._call = cfg, cfg, fake.call
    runner._CACHE.clear()
    try:
        return fn(fake)
    finally:
        runner.settings, gemini_client.settings, gemini_client._call = old
        runner._CACHE.clear()


def test_leak_test_no_secret_reaches_the_ai():
    def body(fake):
        r = run(runner.run_checks(SECRET_TEXT, KIT, use_ai=True))
        sent = "\n".join(fake.sent).lower()
        assert fake.sent, "the fake AI was never called"
        for s in SECRETS:
            assert s.lower() not in sent, f"LEAK: {s!r} was sent to the AI"
        assert "conf_001" in sent  # tokens were sent instead
        assert r["ai_available"] is True
        assert r["mask_summary"]["count"] == 7 and r["mask_summary"]["ai_used"] is True
        assert any(c["name"] == "masking" and c["ran"] for c in r["checks"])
        # the AI's answer used tokens: they were turned back into real text, so quotes still match the draft
        for i in r["issues"]:
            assert SECRET_TEXT[i["start"]:i["end"]] == i["quote"]
        quotes = [i["quote"] for i in r["issues"]]
        assert "Project Falcon goes live" in quotes
    with_fake_ai(body)


def test_ai_off_sends_nothing():
    def body(fake):
        r = run(runner.run_checks(SECRET_TEXT, KIT, use_ai=False))
        assert fake.sent == [] and r["mask_summary"]["ai_used"] is False and r["ai_available"] is False
    with_fake_ai(body)


def test_fails_closed_when_masking_breaks():
    def body(fake):
        real = masking.Masker

        def boom(*a, **k):
            raise RuntimeError("boom")
        masking.Masker = boom
        try:
            r = run(runner.run_checks(SECRET_TEXT + " Uptime is 99.99%.", KIT, use_ai=True))
        finally:
            masking.Masker = real
        assert fake.sent == [], fake.sent
        assert r["ai_available"] is False and r["issues"]        # rule results still come back
        notes = " ".join(c.get("note") or "" for c in r["checks"])
        assert "Masking failed" in notes, (notes, r["checks"])
    with_fake_ai(body)


def test_last_line_of_defence_blocks_a_prompt_that_still_has_a_secret():
    def body(fake):
        m = Masker(SECRET_TEXT, TERMS)
        m.masked = SECRET_TEXT          # simulate a masking bug: the secret is back in the prompt
        res = run(tone_check.run_tone_check(SECRET_TEXT, KIT, m))
        assert res is None and fake.sent == []
        assert "still in the prompt" in gemini_client.LAST_ERROR
    with_fake_ai(body)


def test_draft_records_summary_and_audit_line():
    def body(fake):
        drafts_store.DRAFTS.clear()
        d = run(draft_ops.create_draft(SECRET_TEXT, KIT, "leaky", "Alex", use_ai=True, owner_id="u1"))
        assert d["mask_summary"]["count"] == 7
        assert any(e["type"] == "masked" for e in d["audit"])
        before = len(d["audit"])
        d = run(draft_ops.recheck(d, KIT))          # unchanged masking: no new "masked" line
        assert [e["type"] for e in d["audit"][before:]] == ["checked"]
    with_fake_ai(body)


def test_stored_summary_never_holds_secrets_in_full():
    m = Masker(SECRET_TEXT, TERMS)
    blob = json.dumps(m.summary())
    for s in (EMAIL, PHONE, CARD, KEY, "98765 43210", "4111"):
        assert s not in blob, s
    previews = {i["kind"]: i["preview"] for i in m.items}
    assert previews["card"] == "•••• 1111" and previews["key"].startswith("AIza") and "hidden" in previews["key"]
    assert previews["email"] == "p***@orion-bank.example" and previews["confidential"] in ("Project Falcon", "Orion Bank", "Helix")