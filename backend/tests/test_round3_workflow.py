"""Round 3: accounts, versions, diff, audit, waivers, revisions, gates, permissions. No network (use_ai=False)."""
import asyncio
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.services import accounts, draft_ops, drafts_store
from app.services.diffing import diff_words
from app.services.draft_ops import OpError
from app.services.indexing import build_guide_chunks, parse_facts_csv
from app.services.parsing import ParseError, parse_pdf
from app.services.retrieval import HybridIndex

drafts_store.PERSIST = False
KIT_DIR = Path(__file__).resolve().parents[1] / "demo_kit"
CHUNKS = build_guide_chunks(parse_pdf((KIT_DIR / "brand_guide.pdf").read_bytes()), "default", 1)
FACTS = parse_facts_csv((KIT_DIR / "approved_facts.csv").read_bytes(), "default", 1)
KIT = SimpleNamespace(version=1, chunks=CHUNKS, facts=FACTS, guide_index=HybridIndex(CHUNKS),
                      terms=json.loads((KIT_DIR / "terms.json").read_text(encoding="utf-8")))
accounts.seed_demo_users()
CREATOR, CREATOR2 = accounts.USERS["u_creator"], accounts.USERS["u_creator2"]
MANAGER, REVIEWER = accounts.USERS["u_manager"], accounts.USERS["u_reviewer"]


def run(coro):
    return asyncio.run(coro)


def new(text="Aurora is best-in-class. Used by 10,000 teams. We utilize AI.", owner=CREATOR):
    drafts_store.DRAFTS.clear()
    return run(draft_ops.create_draft(text, KIT, "t", owner["name"], use_ai=False, owner_id=owner["id"]))


def issue(d, **kw):
    for i in d["issues"]:
        if all(i.get(k) == v for k, v in kw.items()):
            return i
    raise AssertionError(f"no issue {kw}")


def request_all(d, note="legal approved"):
    for i in list(d["issues"]):
        if i["priority"] == "mandatory" and i["status"] == "open":
            run(draft_ops.act_on_issue(d["id"], i["id"], "request_exception", KIT, note=note, actor=CREATOR))
    return draft_ops.get_draft(d["id"])


# ---------------- accounts
def test_login_and_token_roundtrip():
    u = accounts.authenticate("MANAGER@loomguard.demo", "loomguard-demo")
    assert accounts.user_from_token(accounts.make_token(u))["role"] == "manager"


def test_wrong_password_and_unknown_user_look_the_same():
    for email, pw in (("manager@loomguard.demo", "nope"), ("ghost@x.com", "loomguard-demo"), ("", "")):
        with pytest.raises(accounts.AuthError) as e:
            accounts.authenticate(email, pw)
        assert e.value.code == "INVALID_CREDENTIALS"


def test_bad_and_expired_tokens():
    with pytest.raises(accounts.AuthError) as e:
        accounts.user_from_token("not.a.token")
    assert e.value.code == "UNAUTHENTICATED"
    import jwt
    from app.config import settings
    old = jwt.encode({"sub": "u_manager", "exp": 1}, settings.jwt_secret, algorithm="HS256")
    with pytest.raises(accounts.AuthError) as e:
        accounts.user_from_token(old)
    assert e.value.code == "TOKEN_EXPIRED"
    forged = jwt.encode({"sub": "u_manager", "role": "manager", "exp": 4102444800}, "wrong-secret", algorithm="HS256")
    with pytest.raises(accounts.AuthError):
        accounts.user_from_token(forged)


def test_seed_is_idempotent_and_password_is_hashed():
    n = len(accounts.USERS)
    assert accounts.seed_demo_users() == 0 and len(accounts.USERS) == n
    assert "loomguard-demo" not in accounts.USERS["u_manager"]["password_hash"]


# ---------------- versions, diff, audit
def test_new_draft_has_version_one_and_audit():
    d = new()
    assert [v["n"] for v in d["versions"]] == [1] and d["versions"][0]["note"] == "First version"
    assert [e["type"] for e in d["audit"]] == ["created", "checked"]
    assert d["owner_id"] == "u_creator" and d["kind"] == "text"


def test_accept_fix_adds_version_and_diff_shows_exactly_the_change():
    d = new()
    i = issue(d, category="CLAIM", claim_status="CONTRADICTED")
    d = run(draft_ops.act_on_issue(d["id"], i["id"], "accept", KIT, chosen_fix=i["suggested_fixes"][0], actor=CREATOR))
    assert [v["n"] for v in d["versions"]] == [1, 2]
    diff = draft_ops.diff_versions(d, 1, 2)
    kinds = [(o["op"], o["text"]) for o in diff["ops"] if o["op"] != "equal"]
    assert ("delete", "10,000") in kinds and any(k == "insert" for k, _ in kinds)
    assert "".join(o["text"] for o in diff["ops"] if o["op"] != "insert") == d["versions"][0]["text"]
    assert "".join(o["text"] for o in diff["ops"] if o["op"] != "delete") == d["versions"][1]["text"]
    assert "fix_accepted" in [e["type"] for e in d["audit"]]
    assert d["audit"][-1]["type"] == "checked" or d["audit"][-2]["type"] == "checked"


def test_version_listing_hides_text_and_unknown_version_404():
    d = new()
    assert "text" not in draft_ops.list_versions(d)[0]
    with pytest.raises(OpError) as e:
        draft_ops.get_version(d, 9)
    assert e.value.status == 404


def test_diff_edge_cases():
    assert diff_words("same", "same")["stats"] == {"added_words": 0, "removed_words": 0, "unchanged_words": 1}
    assert diff_words("", "new words")["stats"]["added_words"] == 2
    long_a = " ".join(f"w{i}" for i in range(6000))
    long_b = long_a.replace("w3000", "changed")
    assert diff_words(long_a, long_b)["stats"]["removed_words"] == 1


def test_revision_upload_adds_version_and_rechecks():
    d = new()
    d = run(draft_ops.add_revision(d["id"], "Aurora is a fast dashboard tool.", KIT, CREATOR))
    assert len(d["versions"]) == 2 and d["summary"]["total"] == 0
    with pytest.raises(OpError) as e:
        run(draft_ops.add_revision(d["id"], "Aurora is a fast dashboard tool.", KIT, CREATOR))
    assert e.value.code == "NO_CHANGE"
    with pytest.raises(ParseError):
        run(draft_ops.add_revision(d["id"], "  ", KIT, CREATOR))


# ---------------- idempotency and stale clients
def test_double_accept_is_rejected_not_applied_twice():
    d = new()
    i = issue(d, category="CLAIM", claim_status="CONTRADICTED")
    rev, fix = d["revision"], i["suggested_fixes"][0]
    run(draft_ops.act_on_issue(d["id"], i["id"], "accept", KIT, chosen_fix=fix, actor=CREATOR, revision=rev))
    with pytest.raises(OpError) as e:  # the second click carries the old revision
        run(draft_ops.act_on_issue(d["id"], i["id"], "accept", KIT, chosen_fix=fix, actor=CREATOR, revision=rev))
    assert e.value.code == "STALE_REVISION"
    assert len(draft_ops.get_draft(d["id"])["versions"]) == 2


def test_second_exception_request_is_already_handled():
    d = new()
    i = issue(d, category="TERMINOLOGY")
    run(draft_ops.act_on_issue(d["id"], i["id"], "request_exception", KIT, note="brand name", actor=CREATOR))
    with pytest.raises(OpError) as e:
        run(draft_ops.act_on_issue(d["id"], i["id"], "request_exception", KIT, note="brand name", actor=CREATOR))
    assert e.value.code == "ISSUE_ALREADY_HANDLED"


def test_two_parallel_accepts_only_one_wins():
    d = new()
    i = issue(d, category="CLAIM", claim_status="CONTRADICTED")
    fix = i["suggested_fixes"][0]

    async def both():
        return await asyncio.gather(
            draft_ops.act_on_issue(d["id"], i["id"], "accept", KIT, chosen_fix=fix, actor=CREATOR, revision=d["revision"]),
            draft_ops.act_on_issue(d["id"], i["id"], "accept", KIT, chosen_fix=fix, actor=CREATOR, revision=d["revision"]),
            return_exceptions=True)
    res = run(both())
    assert sum(isinstance(r, OpError) for r in res) == 1
    assert len(draft_ops.get_draft(d["id"])["versions"]) == 2


# ---------------- waivers and gates
def test_waiver_flow_unblocks_approval():
    d = new()
    d = request_all(d)
    draft_ops.submit(d["id"], CREATOR)
    with pytest.raises(OpError) as e:  # undecided requests block approval
        draft_ops.decide(d["id"], "manager", "Maya", "approve")
    assert e.value.code == "PENDING_EXCEPTIONS"
    for i in draft_ops.get_draft(d["id"])["issues"]:
        if i["status"] == "exception_requested":
            draft_ops.decide_waiver(d["id"], i["id"], "grant", "Legal confirmed in writing", MANAGER)
    d = draft_ops.get_draft(d["id"])
    waived = [i for i in d["issues"] if i["status"] == "waived"]
    assert waived and waived[0]["waiver"]["by"] == "Demo Manager" and waived[0]["waiver"]["reason"]
    assert draft_ops.decide(d["id"], "manager", "Maya", "approve")["status"] == "APPROVED"
    types = [e["type"] for e in draft_ops.get_draft(d["id"])["audit"]]
    assert "waiver_granted" in types and types[-1] == "decision"


def test_denied_mandatory_waiver_blocks_approval_until_changes():
    d = request_all(new())
    draft_ops.submit(d["id"], CREATOR)
    for i in draft_ops.get_draft(d["id"])["issues"]:
        if i["status"] == "exception_requested":
            draft_ops.decide_waiver(d["id"], i["id"], "deny", "Not allowed: claim is false", MANAGER)
    with pytest.raises(OpError) as e:
        draft_ops.decide(d["id"], "manager", "Maya", "approve")
    assert e.value.code == "OPEN_MANDATORY_ISSUES"
    assert draft_ops.decide(d["id"], "manager", "Maya", "request_changes", "Fix the claims")["status"] == "CHANGES_REQUESTED"
    # denial survives a re-check, and the creator can ask again with a new note
    d = run(draft_ops.recheck(draft_ops.get_draft(d["id"]), KIT, CREATOR))
    denied = [i for i in d["issues"] if (i.get("waiver") or {}).get("state") == "denied"]
    assert denied
    run(draft_ops.act_on_issue(d["id"], denied[0]["id"], "request_exception", KIT, note="new evidence attached", actor=CREATOR))


def test_waiver_expires_when_the_quoted_text_changes():
    d = request_all(new("Aurora is best-in-class today."))
    draft_ops.submit(d["id"], CREATOR)
    i = issue(draft_ops.get_draft(d["id"]), category="TERMINOLOGY")
    draft_ops.decide_waiver(d["id"], i["id"], "grant", "OK for this campaign", MANAGER)
    d = draft_ops.decide(d["id"], "manager", "Maya", "request_changes", "tweak wording")
    d = draft_ops.get_draft(d["id"] if isinstance(d, dict) else d)
    d = run(draft_ops.add_revision(d["id"], "Aurora is a world-class dashboard today.", KIT, CREATOR))
    assert not any(i["status"] == "waived" for i in d["issues"])
    assert "waiver_expired" in [e["type"] for e in d["audit"]]
    assert any(i["quote"].lower() == "world-class" and i["status"] == "open" for i in d["issues"])


def test_waiver_survives_recheck_when_quote_is_unchanged():
    d = request_all(new("Aurora is best-in-class. Used by 10,000 teams."))
    draft_ops.submit(d["id"], CREATOR)
    i = issue(draft_ops.get_draft(d["id"]), category="TERMINOLOGY")
    draft_ops.decide_waiver(d["id"], i["id"], "grant", "Approved by legal", MANAGER)
    d = run(draft_ops.recheck(draft_ops.get_draft(d["id"]), KIT, MANAGER))
    assert any(x["status"] == "waived" and x["waiver"]["state"] == "granted" for x in d["issues"])


def test_waiver_role_rules():
    d = request_all(new())
    draft_ops.submit(d["id"], CREATOR)
    d = draft_ops.get_draft(d["id"])
    term = issue(d, category="TERMINOLOGY")
    claim = issue(d, category="CLAIM", claim_status="CONTRADICTED")
    with pytest.raises(OpError) as e:
        draft_ops.decide_waiver(d["id"], term["id"], "grant", "fine", CREATOR)
    assert e.value.code == "FORBIDDEN_ROLE"
    with pytest.raises(OpError) as e:  # reviewer cannot waive terminology
        draft_ops.decide_waiver(d["id"], term["id"], "grant", "fine", REVIEWER)
    assert e.value.code == "FORBIDDEN_ROLE"
    draft_ops.decide_waiver(d["id"], claim["id"], "grant", "Verified with finance", REVIEWER)  # reviewer on a claim: ok
    with pytest.raises(OpError) as e:
        draft_ops.decide_waiver(d["id"], claim["id"], "grant", "again", MANAGER)
    assert e.value.code == "ISSUE_ALREADY_HANDLED"
    with pytest.raises(OpError) as e:
        draft_ops.decide_waiver(d["id"], term["id"], "grant", "", MANAGER)
    assert e.value.code == "REASON_REQUIRED"


def test_waiver_needs_in_review():
    d = request_all(new())
    i = issue(d, category="TERMINOLOGY")
    with pytest.raises(OpError) as e:
        draft_ops.decide_waiver(d["id"], i["id"], "grant", "fine", MANAGER)
    assert e.value.code == "NOT_IN_REVIEW"


def test_submit_allows_requested_and_waived_but_blocks_open_mandatory():
    d = new()
    with pytest.raises(OpError) as e:
        draft_ops.submit(d["id"], CREATOR)
    assert e.value.code == "OPEN_MANDATORY_ISSUES"
    request_all(d)
    assert draft_ops.submit(d["id"], CREATOR)["status"] == "IN_REVIEW"


# ---------------- comments
def test_comment_replies():
    d = new()
    d = draft_ops.add_comment(d["id"], "Maya", "manager", "Why this number?")
    d = draft_ops.add_comment(d["id"], "Alex", "creator", "From the Q3 deck", parent_id="c_1")
    assert d["comments"][1]["parent_id"] == "c_1" and d["comments"][1]["version"] == 1
    with pytest.raises(OpError) as e:
        draft_ops.add_comment(d["id"], "Alex", "creator", "hi", parent_id="c_99")
    assert e.value.status == 404


# ---------------- visibility and ownership
def test_visibility_rules():
    d = new()
    assert draft_ops.can_view(CREATOR, d) and not draft_ops.can_view(CREATOR2, d)
    assert not draft_ops.can_view(MANAGER, d)  # still a private DRAFT
    request_all(d)
    draft_ops.submit(d["id"], CREATOR)
    assert draft_ops.can_view(MANAGER, d) and draft_ops.can_view(REVIEWER, d) and not draft_ops.can_view(CREATOR2, d)
    with pytest.raises(OpError) as e:  # not yours: 404, not 403, so ids do not leak
        draft_ops.load_for(CREATOR2, d["id"])
    assert e.value.status == 404
    with pytest.raises(OpError) as e:  # visible to a manager but only the owner may edit
        draft_ops.load_for(MANAGER, d["id"], owner=True)
    assert e.value.status == 403
    assert [r["id"] for r in draft_ops.list_drafts(user=CREATOR2)] == []
    assert [r["id"] for r in draft_ops.list_drafts(user=MANAGER)] == [d["id"]]
    assert draft_ops.global_audit(CREATOR2) == [] and draft_ops.global_audit(MANAGER)


def test_exceptions_counted_in_insights_after_waiver():
    d = request_all(new())
    draft_ops.submit(d["id"], CREATOR)
    for i in draft_ops.get_draft(d["id"])["issues"]:
        if i["status"] == "exception_requested":
            draft_ops.decide_waiver(d["id"], i["id"], "grant", "Approved by legal", MANAGER)
    assert draft_ops.insights()["exceptions_requested"] >= 2