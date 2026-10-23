"""Load the bundled demo kit so judges never start with an empty app."""
import json
from pathlib import Path

from . import store
from .indexing import build_guide_chunks, parse_facts_csv
from .parsing import parse_pdf

DEMO_DIR = Path(__file__).resolve().parents[2] / "demo_kit"


def demo_available() -> bool:
    return (DEMO_DIR / "brand_guide.pdf").exists() and (DEMO_DIR / "approved_facts.csv").exists()


def demo_drafts() -> dict[str, str]:
    d = DEMO_DIR / "drafts"
    return {p.stem: p.read_text(encoding="utf-8").strip() for p in sorted(d.glob("*.md"))} if d.exists() else {}


async def load_demo_kit():
    version = store.KIT.version + 1
    pages = parse_pdf((DEMO_DIR / "brand_guide.pdf").read_bytes())
    chunks = build_guide_chunks(pages, store.BRAND_ID, version)
    facts = parse_facts_csv((DEMO_DIR / "approved_facts.csv").read_bytes(), store.BRAND_ID, version)
    terms_file = DEMO_DIR / "terms.json"
    if terms_file.exists():
        store.KIT.terms = json.loads(terms_file.read_text(encoding="utf-8"))
    return await store.set_kit(chunks, facts, "brand_guide.pdf (demo)", "approved_facts.csv (demo)")