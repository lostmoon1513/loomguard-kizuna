"""Hardening: text normalisation and the rate limiter."""
import asyncio
import json
from pathlib import Path
from types import SimpleNamespace

from app.services import draft_ops, drafts_store
from app.services.indexing import build_guide_chunks, parse_facts_csv
from app.services.parsing import parse_pdf
from app.services.retrieval import HybridIndex

drafts_store.PERSIST = False
KIT_DIR = Path(__file__).resolve().parents[1] / "demo_kit"
CHUNKS = build_guide_chunks(parse_pdf((KIT_DIR / "brand_guide.pdf").read_bytes()), "default", 1)
KIT = SimpleNamespace(version=1, chunks=CHUNKS, facts=parse_facts_csv((KIT_DIR / "approved_facts.csv").read_bytes(), "default", 1),
                      guide_index=HybridIndex(CHUNKS), terms=json.loads((KIT_DIR / "terms.json").read_text(encoding="utf-8")))


def check(text):
    drafts_store.DRAFTS.clear()
    return asyncio.run(draft_ops.create_draft(text, KIT, "t", "a", use_ai=False))


def test_hidden_characters_cannot_hide_a_banned_word():
    d = check("Aurora is best​-in-class and rev​olutionary.")
    assert {i["quote"].lower() for i in d["issues"]} >= {"best-in-class", "revolutionary"}
    assert all(d["text"][i["start"]:i["end"]] == i["quote"] for i in d["issues"])


def test_curly_quotes_and_nbsp_are_normalised():
    d = check("“Aurora” is world‑class – it’s guaranteed.")
    assert "“" not in d["text"] and " " not in d["text"] and "it's" in d["text"]
    assert {"world-class", "guaranteed"} <= {i["quote"].lower() for i in d["issues"]}


def test_rate_limiter_blocks_the_burst_and_sets_retry_after():
    import app.ratelimit as rl
    from starlette.requests import Request

    mw = rl.RateLimit(app=None, enabled=True)

    async def nxt(_):
        return SimpleNamespace(status_code=200)

    def req(path="/api/drafts", method="POST", ip="1.2.3.4"):
        return Request({"type": "http", "method": method, "path": path, "headers": [(b"x-forwarded-for", ip.encode())],
                        "query_string": b"", "client": ("9.9.9.9", 1)})

    codes = [asyncio.run(mw.dispatch(req(), nxt)).status_code for _ in range(22)]
    assert codes[:20] == [200] * 20 and codes[20:] == [429, 429]
    r = asyncio.run(mw.dispatch(req(), nxt))
    assert r.headers["Retry-After"].isdigit() and json.loads(r.body)["error"]["code"] == "RATE_LIMITED"
    assert asyncio.run(mw.dispatch(req(ip="5.5.5.5"), nxt)).status_code == 200      # another client is unaffected
    assert asyncio.run(mw.dispatch(req("/api/health", "GET"), nxt)).status_code == 200  # reads are not "heavy"
    assert asyncio.run(mw.dispatch(req("/", "GET"), nxt)).status_code == 200          # static site is never limited