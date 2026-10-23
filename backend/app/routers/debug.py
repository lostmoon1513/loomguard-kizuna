"""Temporary endpoint so Steps 5-7 can be tested before the full draft pipeline (Step 8)."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..services import store
from ..services.claims_check import run_claims_check, verify_extra_phrases
from ..services.demo import demo_drafts
from ..services.guards import scan_injection
from ..services.issues import finalize
from ..services.llm_claims import extract_claim_phrases
from ..services.rules_check import run_rules_check

router = APIRouter(prefix="/api/debug", tags=["debug"])


class TextIn(BaseModel):
    text: str = Field(min_length=3, max_length=50000)
    use_ai: bool = True


@router.post("/check-text")
async def check_text(body: TextIn):
    kit = store.KIT
    if kit.version == 0:
        raise HTTPException(409, "NO_KIT: upload a brand kit or call POST /api/brand/load-demo first.")
    text = body.text.strip()
    issues = run_rules_check(text, kit.terms, kit.chunks) + scan_injection(text)
    claim_issues, claims = run_claims_check(text, kit.facts)
    issues += claim_issues
    ai_available = None
    if body.use_ai:
        phrases = await extract_claim_phrases(text)
        ai_available = phrases is not None
        if phrases:
            issues += verify_extra_phrases(text, phrases, kit.facts, claims)
    issues = finalize(issues)
    by: dict = {}
    for i in issues:
        by[i["category"]] = by.get(i["category"], 0) + 1
    return {"ai_available": ai_available, "kit_version": kit.version, "summary": {"total": len(issues), "by_category": by}, "issues": issues}


@router.get("/demo-drafts")
async def drafts():
    return demo_drafts()