from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from ..config import settings
from ..deps import current_user, require_roles
from ..services import store
from ..services.demo import demo_available, load_demo_kit
from ..services.embeddings import embed
from ..services.indexing import build_guide_chunks, parse_facts_csv
from ..services.parsing import ParseError, parse_pdf

router = APIRouter(prefix="/api/brand", tags=["brand"])


class BannedTerm(BaseModel):
    term: str = Field(min_length=1, max_length=80)
    reason: str = ""


class PreferredTerm(BaseModel):
    avoid: str = Field(min_length=1, max_length=80)
    use: str = Field(min_length=1, max_length=80)


class ConfidentialTerm(BaseModel):
    term: str = Field(min_length=2, max_length=80)
    kind: str = Field("codename", max_length=30)  # codename, customer, project ... free label shown to the creator


class Terms(BaseModel):
    banned: list[BannedTerm] = []
    preferred: list[PreferredTerm] = []
    hex_codes: list[str] = []
    confidential: list[ConfidentialTerm] = []  # masked locally before any AI call


async def _read(upload: UploadFile) -> bytes:
    data = await upload.read()
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"File is larger than {settings.max_upload_mb} MB.")
    return data


def _parse_error(exc: ParseError) -> HTTPException:
    return HTTPException(400, f"{exc.code}: {exc.message}")


@router.post("/upload", dependencies=[Depends(require_roles("manager"))])
async def upload_kit(guide: UploadFile = File(...), facts: UploadFile = File(...)):
    if not (guide.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "FILE_UNSUPPORTED: the brand guide must be a PDF.")
    if not (facts.filename or "").lower().endswith(".csv"):
        raise HTTPException(400, "FILE_UNSUPPORTED: the approved facts file must be a CSV.")
    next_version = store.KIT.version + 1
    try:
        pages = parse_pdf(await _read(guide))
        chunks = build_guide_chunks(pages, store.BRAND_ID, next_version)
        rows = parse_facts_csv(await _read(facts), store.BRAND_ID, next_version)
    except ParseError as exc:
        raise _parse_error(exc) from exc
    if not chunks:
        raise HTTPException(400, "PDF_EMPTY: no rules could be read from the guide.")
    kit = await store.set_kit(chunks, rows, guide.filename, facts.filename)
    return _summary(kit)


@router.post("/load-demo", dependencies=[Depends(require_roles("manager"))])
async def load_demo():
    """One click: loads the bundled demo guide, facts and terms."""
    if not demo_available():
        raise HTTPException(404, "NO_DEMO: demo kit files are not bundled with this server.")
    try:
        kit = await load_demo_kit()
    except ParseError as exc:
        raise _parse_error(exc) from exc
    return _summary(kit)


@router.put("/terms", dependencies=[Depends(require_roles("manager"))])
async def set_terms(terms: Terms):
    store.KIT.terms = terms.model_dump()
    await store.save_kit()
    return {"banned": len(terms.banned), "preferred": len(terms.preferred), "hex_codes": len(terms.hex_codes),
            "confidential": len(terms.confidential)}


@router.get("", dependencies=[Depends(current_user)])
async def get_brand():
    return _summary(store.KIT)


@router.get("/search", dependencies=[Depends(current_user)])
async def search(q: str = Query(min_length=2), source: Literal["guide", "facts"] = "guide", k: int = 3):
    """Debug endpoint to verify retrieval and citations."""
    kit = store.KIT
    index = kit.guide_index if source == "guide" else kit.facts_index
    if index is None:
        raise HTTPException(409, "NO_KIT: upload a brand kit first.")
    qv = None
    if kit.embedded:
        vecs = await embed([q])
        qv = vecs[0] if vecs is not None else None
    hits = index.search(q, k=k, query_vector=qv)
    return [{**h, "citation": _citation(h["item"])} for h in hits]


def _citation(item: dict) -> dict:
    if item["type"] == "guide":
        return {"doc": "Brand Guide", "ref": f"Page {item['page_number']}", "rule_id": item["rule_id"]}
    return {"doc": "Approved Facts CSV", "ref": f"Row {item['row']}"}


def _summary(kit) -> dict:
    return {
        "kit_version": kit.version,
        "ready": kit.version > 0,
        "guide": {"file": kit.guide_name, "pages": len({c["page_number"] for c in kit.chunks}), "chunks": len(kit.chunks),
                  "mandatory": sum(1 for c in kit.chunks if c["priority"] == "mandatory"),
                  "with_exceptions": sum(1 for c in kit.chunks if c.get("exception"))},
        "facts": {"file": kit.facts_name, "rows": len(kit.facts)},
        "terms": {"banned": len(kit.terms["banned"]), "preferred": len(kit.terms["preferred"]),
                  "hex_codes": len(kit.terms["hex_codes"])},
        "vector_search": kit.embedded,
        "retrieval_mode": "hybrid" if kit.embedded else "bm25_only",
    }