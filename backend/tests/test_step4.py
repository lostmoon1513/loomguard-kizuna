"""Step 4: parsing, rule chunking with exceptions, facts rows, BM25 retrieval. No network needed."""
from pathlib import Path

import pytest

from app.services.indexing import build_guide_chunks, parse_facts_csv
from app.services.parsing import ParseError, parse_pdf, parse_draft_file
from app.services.retrieval import HybridIndex

KIT = Path(__file__).resolve().parents[2] / "sample_kit"


@pytest.fixture(scope="module")
def chunks():
    return build_guide_chunks(parse_pdf((KIT / "brand_guide.pdf").read_bytes()), "default", 1)


@pytest.fixture(scope="module")
def facts():
    return parse_facts_csv((KIT / "approved_facts.csv").read_bytes(), "default", 1)


def test_pages_preserved(chunks):
    assert {c["page_number"] for c in chunks} == {1, 2, 3, 4, 5, 6}


def test_exception_stays_with_rule(chunks):
    red = [c for c in chunks if "red as a background" in c["text"]]
    assert len(red) == 1
    assert "Festive Red" in red[0]["text"] and red[0]["exception"]
    assert red[0]["priority"] == "mandatory"
    tone = [c for c in chunks if c["page_number"] == 2]
    assert any("Aurora Youth" in c["text"] and "slang" in c["text"] for c in tone)


def test_facts_rows_use_spreadsheet_row_numbers(facts):
    assert facts[0]["row"] == 2 and facts[0]["fact_id"] == "F01"
    f04 = next(f for f in facts if f["fact_id"] == "F04")
    assert f04["row"] == 5 and f04["valid_until"] == "2026-06-30" and f04["value_num"] == 19.0


def test_guide_retrieval_cites_right_page(chunks):
    idx = HybridIndex(chunks)
    top = idx.search("banned words revolutionary hype", k=1)[0]["item"]
    assert top["page_number"] == 3
    top = idx.search("can we use red background colour", k=1)[0]["item"]
    assert top["page_number"] == 5


def test_facts_retrieval(facts):
    idx = HybridIndex(facts)
    assert idx.search("uptime 99.99%", k=1)[0]["item"]["fact_id"] == "F01"
    assert idx.search("free trial days", k=1)[0]["item"]["fact_id"] == "F07"


def test_scanned_pdf_rejected():
    from reportlab.pdfgen import canvas
    import io
    buf = io.BytesIO(); c = canvas.Canvas(buf); c.showPage(); c.save()
    with pytest.raises(ParseError) as e:
        parse_pdf(buf.getvalue())
    assert e.value.code == "SCANNED_PDF"


def test_bad_csv_columns():
    with pytest.raises(ParseError) as e:
        parse_facts_csv(b"a,b\n1,2\n", "default", 1)
    assert e.value.code == "FACTS_COLUMNS"


def test_draft_formats():
    assert "Aurora" in parse_draft_file("x.md", (KIT / "drafts/clean.md").read_bytes())
    with pytest.raises(ParseError):
        parse_draft_file("x.exe", b"abc")
