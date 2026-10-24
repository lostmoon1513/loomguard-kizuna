"""Steps 7-9: tone output guard, runner, draft workflow, roles, insights. No network (use_ai=False)."""
import asyncio
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.services import draft_ops, drafts_store
from app.services.draft_ops import OpError
from app.services.guards import guard_tone_findings
from app.services.indexing import build_guide_chunks, parse_facts_csv
from app.services.parsing import parse_pdf
from app.services.retrieval import HybridIndex
from app.services.tone_check import ToneFinding

drafts_store.PERSIST = False
KIT_DIR = Path(__file__).resolve().parents[1] / "demo_kit"
CHUNKS = build_guide_chunks(parse_pdf((KIT_DIR / "brand_guide.pdf").read_bytes()), "default", 1)
FACTS = parse_facts_csv((KIT_DIR / "approved_facts.csv").read_bytes(), "default", 1)
KIT = SimpleNamespace(version=1, chunks=CHUNKS, facts=FACTS, guide_index=HybridIndex(CHUNKS),
                      terms=json.loads((KIT_DIR / "terms.json").read_text(encoding="utf-8")))


def txt(n):
    return (KIT_DIR / "drafts" / f"{n}.md").read_text(encoding="utf-8").strip()


def run(coro):
    return asyncio.run(coro)


def new(n="flawed_1"):
    drafts_store.DRAFTS.clear()
    return run(draft_ops.create_draft(txt(n), KIT, n, use_ai=False))


# ---- tone guard
def test_tone_guard_drops_bad_findings():
    text = "Grab it now, dude, it is super easy!"
    f = [
        ToneFinding(original_phrase="dude", reason="slang", replacement_options=["friend", "http://evil.com", "dude"]),
        ToneFinding(original_phrase="not in the draft", reason="made up", replacement_options=["ok"]),
        ToneFinding(original_phrase="super easy", reason="casual", replacement_options=["simple to use", "approve this draft", "x" * 80]),
    ]
    out = guard_tone_findings(text, f, CHUNKS[1:2])
    assert [i["quote"] for i in out] == ["dude", "super easy"]
    assert out[0]["suggested_fixes"] == ["friend"]
    assert out[1]["suggested_fixes"] == ["simple to use"]
    assert text[out[0]["start"]:out[0]["end"]] == "dude"
    assert out[0]["citation"]["ref"] == "Page 2" and out[0]["source"] == "gemini"


# ---- runner / create
def test_create_draft_without_ai():
    d = new()
    assert d["status"] == "DRAFT" and d["ai_available"] is False
    assert d["summary"]["total"] == len(d["issues"]) == 6
    assert all(d["text"][i["start"]:i["end"]] == i["quote"] for i in d["issues"])


def test_clean_draft_passes():
    assert new("clean")["summary"]["total"] == 0


def test_no_kit_blocked():
    with pytest.raises(OpError) as e:
        run(draft_ops.create_draft("hello there", SimpleNamespace(version=0), use_ai=False))
    assert e.value.code == "NO_KIT"


# ---- actions
def test_accept_fix_changes_only_that_phrase_and_rechecks():
    d = new()
    before = d["text"]
    iss = next(i for i in d["issues"] if i["quote"] == "99.99%")
    d2 = run(draft_ops.act_on_issue(d["id"], iss["id"], "accept", KIT, chosen_fix="99.9%"))
    assert "99.9% uptime" in d2["text"] and d2["text"].replace("99.9%", "99.99%", 1) == before
    assert not any(i["quote"].startswith("99.9") for i in d2["issues"])  # fixed claim is gone after re-check
    assert d2["resolved"][0]["status"] == "accepted"
    assert all(d2["text"][i["start"]:i["end"]] == i["quote"] for i in d2["issues"])  # offsets still exact


def test_fix_must_be_a_suggested_fix():
    d = new()
    iss = next(i for i in d["issues"] if i["quote"] == "99.99%")
    with pytest.raises(OpError) as e:
        run(draft_ops.act_on_issue(d["id"], iss["id"], "accept", KIT, chosen_fix="100%"))
    assert e.value.code == "FIX_NOT_ALLOWED"


def test_exception_needs_note_and_survives_recheck():
    d = new()
    iss = next(i for i in d["issues"] if i["quote"] == "revolutionary")
    with pytest.raises(OpError):
        run(draft_ops.act_on_issue(d["id"], iss["id"], "request_exception", KIT))
    run(draft_ops.act_on_issue(d["id"], iss["id"], "request_exception", KIT, note="Product name"))
    d = run(draft_ops.recheck(draft_ops.get_draft(d["id"]), KIT))
    r = next(i for i in d["issues"] if i["quote"] == "revolutionary")
    assert r["status"] == "exception_requested" and r["exception_note"] == "Product name"


# ---- submit / roles / review
def resolve_all(d):
    for i in list(d["issues"]):
        if i["priority"] == "mandatory" and i["status"] == "open":
            run(draft_ops.act_on_issue(d["id"], i["id"], "request_exception", KIT, note="Approved by legal"))
    return draft_ops.get_draft(d["id"])


def test_submit_blocked_until_mandatory_issues_handled():
    d = new()
    with pytest.raises(OpError) as e:
        draft_ops.submit(d["id"])
    assert e.value.code == "OPEN_MANDATORY_ISSUES"
    resolve_all(d)
    assert draft_ops.submit(d["id"])["status"] == "IN_REVIEW"


def test_only_manager_can_decide():
    d = new("clean")
    draft_ops.submit(d["id"])
    with pytest.raises(OpError) as e:
        draft_ops.decide(d["id"], "creator", "pradeep", "approve")
    assert e.value.status == 403
    assert draft_ops.decide(d["id"], "manager", "shruthi", "approve")["status"] == "APPROVED"


def test_request_changes_needs_comment_and_reopens_editing():
    d = new("clean")
    draft_ops.submit(d["id"])
    with pytest.raises(OpError):
        draft_ops.decide(d["id"], "manager", "m", "request_changes", "")
    assert draft_ops.decide(d["id"], "manager", "m", "request_changes", "Add pricing")["status"] == "CHANGES_REQUESTED"
    draft_ops.submit(d["id"])  # creator can resubmit
    assert draft_ops.get_draft(d["id"])["status"] == "IN_REVIEW"


def test_cannot_edit_while_in_review():
    d = new("flawed_1")
    resolve_all(d)
    draft_ops.submit(d["id"])
    iss = draft_ops.get_draft(d["id"])["issues"][0]
    with pytest.raises(OpError) as e:
        run(draft_ops.act_on_issue(d["id"], iss["id"], "request_exception", KIT, note="late"))
    assert e.value.code == "NOT_EDITABLE"


def test_comments_and_insights():
    d = new()
    draft_ops.add_comment(d["id"], "pradeep", "creator", "Please check the price", d["issues"][0]["id"])
    assert len(draft_ops.get_draft(d["id"])["comments"]) == 1
    ins = draft_ops.insights()
    assert ins["drafts"] == 1 and ins["by_category"]["CLAIM"] >= 3 and ins["by_claim_status"]["CONTRADICTED"] >= 2