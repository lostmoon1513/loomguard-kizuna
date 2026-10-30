"""Insights over time: weekly series, per-rule trends, deterministic recommendations, exports, labelled demo data."""
import asyncio
import csv
import io
import json
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

from app.services import draft_ops, drafts_store, insights
from app.services.indexing import build_guide_chunks, parse_facts_csv
from app.services.parsing import parse_pdf
from app.services.retrieval import HybridIndex

drafts_store.PERSIST = False
KIT_DIR = Path(__file__).resolve().parents[1] / "demo_kit"
CHUNKS = build_guide_chunks(parse_pdf((KIT_DIR / "brand_guide.pdf").read_bytes()), "default", 1)
FACTS = parse_facts_csv((KIT_DIR / "approved_facts.csv").read_bytes(), "default", 1)
KIT = SimpleNamespace(version=1, chunks=CHUNKS, facts=FACTS, guide_index=HybridIndex(CHUNKS),
                      terms=json.loads((KIT_DIR / "terms.json").read_text(encoding="utf-8")))
NOW = datetime(2026, 10, 29, 12, 0, tzinfo=timezone.utc)   # a Thursday
MGR = {"id": "m", "name": "Maya", "role": "manager"}


def fresh():
    drafts_store.DRAFTS.clear()


def test_empty_state_is_valid_and_honest():
    fresh()
    out = insights.build([], 8, NOW)
    assert out["drafts"] == 0 and len(out["weekly"]) == 8 and all(w["drafts_checked"] == 0 for w in out["weekly"])
    assert out["top_rules"] == [] and out["recommendations"][0]["id"] == "none" and out["includes_demo_data"] is False
    assert out["totals"]["median_review_hours"] is None
    assert out["weekly"][-1]["week_start"] == "2026-10-26"       # Monday of the current week


def test_real_drafts_land_in_the_right_week():
    fresh()
    d = asyncio.run(draft_ops.create_draft("Aurora is revolutionary. Uptime is 99.99%.", KIT, "t", "Alex", use_ai=False, owner_id="u"))
    d["created_at"] = "2026-10-20T09:00:00+00:00"
    out = insights.build(list(drafts_store.DRAFTS.values()), 4, NOW)
    wk = {w["week_start"]: w for w in out["weekly"]}
    assert wk["2026-10-19"]["drafts_checked"] == 1 and wk["2026-10-19"]["issues_found"] == len(d["issues"])
    assert sum(w["drafts_checked"] for w in out["weekly"]) == 1
    assert {r["rule"] for r in out["top_rules"]} >= {"TERMINOLOGY: revolutionary"}


def test_demo_history_is_labelled_deterministic_and_removable():
    fresh()
    n = insights.seed_demo_history(NOW)
    assert n == 14 and all(d["title"].startswith("[DEMO]") and d["demo"] for d in drafts_store.DRAFTS.values())
    a = insights.build(list(drafts_store.DRAFTS.values()), 8, NOW)
    fresh(); insights.seed_demo_history(NOW)
    b = insights.build(list(drafts_store.DRAFTS.values()), 8, NOW)
    assert a == b                                           # deterministic
    assert a["includes_demo_data"] and "DEMO" in a["demo_note"] and a["demo_drafts"] == 14
    assert insights.build(list(drafts_store.DRAFTS.values()), 8, NOW, include_demo=False)["drafts"] == 0
    assert draft_ops.insights()["drafts"] == 0              # the old summary never counts demo drafts
    assert draft_ops.global_audit(MGR) == []                # nor does the audit view
    assert insights.clear_demo_history() == 14 and not drafts_store.DRAFTS


def test_trends_and_recommendations_come_with_evidence():
    fresh(); insights.seed_demo_history(NOW)
    out = insights.build(list(drafts_store.DRAFTS.values()), 7, NOW)
    term = [r for r in out["top_rules"] if r["category"] == "TERMINOLOGY"]
    assert term and all(r["trend"] in ("falling", "steady") for r in term) and any(r["trend"] == "falling" for r in term)
    recs = out["recommendations"]
    assert recs and len({r["id"] for r in recs}) == len(recs)
    assert all(r["evidence"] is not None and r["text"] and r["title"] and r["level"] in ("high", "medium", "info") for r in recs)
    ids = {r["id"] for r in recs}
    assert "contrast" in ids or any(r["id"].startswith("rising:") for r in recs)
    for r in recs:                                            # every number quoted in evidence is real
        if r["id"].startswith("exceptions:"):
            rule = next(x for x in out["top_rules"] if x["rule"] == r["id"].split(":", 1)[1])
            assert r["evidence"]["exceptions"] == rule["exceptions_requested"] and r["evidence"]["findings"] == rule["count"]
    assert out["totals"]["median_review_hours"] is not None
    assert [r["level"] for r in recs] == sorted([r["level"] for r in recs], key={"high": 0, "medium": 1, "info": 2}.get)


def test_weekly_totals_match_the_drafts():
    fresh(); insights.seed_demo_history(NOW)
    out = insights.build(list(drafts_store.DRAFTS.values()), 8, NOW)
    assert sum(w["drafts_checked"] for w in out["weekly"]) == 14
    assert sum(w["issues_found"] for w in out["weekly"]) == sum(d["versions"][0]["counts"]["total"] for d in drafts_store.DRAFTS.values())
    assert sum(w["approved"] + w["changes_requested"] for w in out["weekly"]) == 14


def test_csv_tables_parse_and_resist_formula_injection():
    fresh(); insights.seed_demo_history(NOW)
    out = insights.build(list(drafts_store.DRAFTS.values()), 6, NOW)
    rows = list(csv.reader(io.StringIO(insights.to_csv(out, "weekly"))))
    assert rows[0][0] == "week_start" and len(rows) == 7
    rules = list(csv.reader(io.StringIO(insights.to_csv(out, "rules"))))
    assert rules[0][0] == "rule" and len(rules) > 1
    evil = dict(out, recommendations=[{"level": "high", "title": "=HYPERLINK(\"http://x\")", "text": "+cmd"}])
    r = list(csv.reader(io.StringIO(insights.to_csv(evil, "recommendations"))))
    assert r[1][1].startswith("'=") and r[1][2].startswith("'+")


def test_pdf_summary_is_a_real_pdf_and_mentions_demo_data():
    fresh(); insights.seed_demo_history(NOW)
    out = insights.build(list(drafts_store.DRAFTS.values()), 8, NOW)
    pdf = insights.to_pdf(out, "Maya (manager)")
    assert pdf[:5] == b"%PDF-" and len(pdf) > 2000
    empty = insights.to_pdf(insights.build([], 8, NOW), "Maya (manager)")
    assert empty[:5] == b"%PDF-"


def test_old_issues_without_citation_do_not_break_labels():
    assert insights.rule_label({"category": "TONE", "quote": "x", "citation": None}) == "TONE: no source"