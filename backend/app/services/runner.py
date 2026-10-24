"""Runs every check and merges the results. Python checks always run; Gemini checks fail soft."""
import asyncio
import hashlib
import json
from typing import Optional

from ..config import settings
from .claims_check import run_claims_check, verify_extra_phrases
from .guards import scan_injection
from .issues import finalize, guide_citation
from .llm_claims import extract_claim_phrases
from .rules_check import run_rules_check
from .tone_check import run_tone_check

_CACHE: dict[str, dict] = {}


def _key(text: str, kit, use_ai: bool) -> str:
    raw = json.dumps([text, kit.version, kit.terms, use_ai], sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()


def summarize(issues: list[dict]) -> dict:
    by: dict[str, int] = {}
    for i in issues:
        by[i["category"]] = by.get(i["category"], 0) + 1
    return {"total": len(issues), "by_category": by}


async def run_checks(text: str, kit, use_ai: bool = True) -> dict:
    key = _key(text, kit, use_ai)
    if key in _CACHE:
        return json.loads(json.dumps(_CACHE[key]))
    _, claims_priority = guide_citation(kit.chunks, "Approved Facts")
    claims_priority = claims_priority if claims_priority else "mandatory"

    issues = run_rules_check(text, kit.terms, kit.chunks) + scan_injection(text)
    claim_issues, claims = run_claims_check(text, kit.facts, priority="mandatory")
    issues += claim_issues
    checks = [
        {"name": "terminology", "source": "python_rule", "ran": True},
        {"name": "readability", "source": "python_rule", "ran": True},
        {"name": "claims", "source": "python_rule", "ran": True},
        {"name": "prompt_injection_scan", "source": "python_rule", "ran": True},
    ]
    ai_ok = False
    if use_ai and settings.gemini_api_key:
        phrases, tone = await asyncio.gather(extract_claim_phrases(text), run_tone_check(text, kit))
        if phrases:
            issues += verify_extra_phrases(text, phrases, kit.facts, claims)
        if tone:
            issues += tone
        ai_ok = phrases is not None and tone is not None
        from . import gemini_client
        why = gemini_client.LAST_ERROR or "Gemini returned no usable answer"
        checks.append({"name": "claims_ai_extraction", "source": "gemini+python", "ran": phrases is not None,
                       "note": None if phrases is not None else why})
        checks.append({"name": "tone", "source": "gemini", "ran": tone is not None,
                       "note": None if tone is not None else why})
    else:
        why = "AI switched off for this draft" if settings.gemini_api_key else "GEMINI_API_KEY not set"
        checks.append({"name": "claims_ai_extraction", "source": "gemini+python", "ran": False, "note": why})
        checks.append({"name": "tone", "source": "gemini", "ran": False, "note": why})
    issues = finalize(issues)
    result = {"issues": issues, "checks": checks, "ai_available": ai_ok, "summary": summarize(issues)}
    if ai_ok or not use_ai:
        _CACHE[key] = json.loads(json.dumps(result))
    return result