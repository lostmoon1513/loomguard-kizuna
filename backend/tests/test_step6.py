"""Step 6: claim pipeline. Pure Python, uses the sample kit."""
from datetime import date
from pathlib import Path

from app.schemas import Issue
from app.services.claims_check import find_claims, run_claims_check, verify_extra_phrases
from app.services.indexing import parse_facts_csv
from app.services.issues import finalize

KIT = Path(__file__).resolve().parents[2] / "sample_kit"
FACTS = parse_facts_csv((KIT / "approved_facts.csv").read_bytes(), "default", 1)
TODAY = date(2026, 10, 23)


def draft(name):
    return (KIT / "drafts" / name).read_text(encoding="utf-8").strip()


def claims(text, today=TODAY):
    issues, _ = run_claims_check(text, FACTS, today)
    return finalize(issues)


def by_quote(issues, q):
    return next(i for i in issues if i["quote"].lower() == q.lower())


def test_flawed_1():
    text = draft("flawed_1.md")
    iss = claims(text)
    assert by_quote(iss, "world's #1")["claim_status"] == "UNSUPPORTED"
    up = by_quote(iss, "99.99%")
    assert up["claim_status"] == "CONTRADICTED" and up["citation"]["ref"] == "Row 2" and up["suggested_fixes"] == ["99.9%"]
    price = by_quote(iss, "$19 per month")
    assert price["claim_status"] == "OUTDATED" and price["citation"]["ref"] == "Row 5"
    assert price["suggested_fixes"] == ["$24 per month"]
    teams = by_quote(iss, "thousands of teams")
    assert teams["claim_status"] == "CONTRADICTED" and teams["citation"]["ref"] == "Row 3" and teams["suggested_fixes"] == ["500 teams"]


def test_flawed_2():
    iss = claims(draft("flawed_2.md"))
    assert by_quote(iss, "10,000 teams")["suggested_fixes"] == ["500 teams"]
    c = by_quote(iss, "60 countries")
    assert c["claim_status"] == "CONTRADICTED" and c["citation"]["ref"] == "Row 9" and c["suggested_fixes"] == ["32 countries"]
    assert by_quote(iss, "0.3 seconds")["suggested_fixes"] == ["1.2 seconds"]
    assert by_quote(iss, "30 day")["suggested_fixes"] == ["14 day"]
    assert by_quote(iss, "guarantee results")["claim_status"] == "UNSUPPORTED"


def test_flawed_3():
    iss = claims(draft("flawed_3.md"))
    tools = by_quote(iss, "200 tools")
    assert tools["claim_status"] == "CONTRADICTED" and tools["citation"]["ref"] == "Row 7"
    assert tools["suggested_fixes"] == ["40 integrations"]
    r = by_quote(iss, "4.9 out of 5")
    assert r["suggested_fixes"] == ["4.6 out of 5"] and r["citation"]["ref"] == "Row 6"
    assert by_quote(iss, "guaranteed to boost")["claim_status"] == "UNSUPPORTED"


def test_clean_has_no_claim_issues():
    assert claims(draft("clean.md")) == []


def test_all_issues_valid_and_offsets_exact():
    for n in ["flawed_1.md", "flawed_2.md", "flawed_3.md"]:
        text = draft(n)
        for i in claims(text):
            assert text[i["start"]:i["end"]] == i["quote"]
            Issue.model_validate(i)


def test_expired_fact_becomes_outdated():
    iss = claims("Used by 500 teams.", today=date(2027, 1, 1))
    assert iss and iss[0]["claim_status"] == "OUTDATED"


def test_comparators():
    assert claims("We have more than 30 integrations.") == []          # 40 > 30
    assert claims("We have more than 40 integrations.")[0]["claim_status"] == "CONTRADICTED"  # 40 is not > 40
    assert claims("Rated at least 4 out of 5.") == []


def test_hex_codes_and_small_counts_are_not_claims():
    assert claims("Use Aurora Blue #1F4FD8 in 3 simple steps.") == []
    assert find_claims("Founded in 2019.") == []


def test_gemini_phrases_are_guarded():
    text = "Aurora is the smartest choice for every team."
    out = verify_extra_phrases(text, ["smartest choice", "not in the draft"], FACTS, [])
    assert len(out) == 1 and out[0]["needs_review"] and out[0]["source"] == "gemini+python"
    assert text[out[0]["start"]:out[0]["end"]] == "smartest choice"