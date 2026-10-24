"""One place for Gemini generation. Timeout, one retry, schema-validated output, never raises."""
import asyncio
import logging
from typing import Optional, Type, TypeVar

from pydantic import BaseModel

from ..config import settings

log = logging.getLogger("loomguard.gemini")


def mask(text: str) -> str:
    """Never let the API key reach logs or API responses (Google error text can contain it)."""
    key = settings.gemini_api_key
    out = text.replace(key, "***") if key else text
    import re
    return re.sub(r"AIza[0-9A-Za-z_\-]{20,}|AQ\.[0-9A-Za-z_\-]{20,}", "***", out)
LAST_ERROR = ""
_blocked_until = 0.0  # after a quota error (429) skip Gemini for a while: no wasted calls, no slow checks
QUOTA_KEYS = ("RESOURCE_EXHAUSTED", "429")
T = TypeVar("T", bound=BaseModel)


def _call(system: str, user: str, schema: Type[BaseModel]) -> str:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.gemini_api_key)
    kwargs = dict(system_instruction=system, response_mime_type="application/json",
                  response_schema=schema, temperature=0.0)
    try:  # skip "thinking" for speed where the library supports it
        cfg = types.GenerateContentConfig(thinking_config=types.ThinkingConfig(thinking_budget=0), **kwargs)
    except Exception:  # noqa: BLE001
        cfg = types.GenerateContentConfig(**kwargs)
    return client.models.generate_content(model=settings.gemini_model, contents=user, config=cfg).text


async def generate_json(system: str, user: str, schema: Type[T]) -> Optional[T]:
    global LAST_ERROR
    global _blocked_until
    if not settings.gemini_api_key:
        LAST_ERROR = "GEMINI_API_KEY not set"
        return None
    import time
    if time.time() < _blocked_until:
        return None  # LAST_ERROR still holds the quota message
    for attempt in range(2):  # one retry, then fail soft
        try:
            text = await asyncio.wait_for(asyncio.to_thread(_call, system, user, schema), timeout=settings.gemini_timeout)
            return schema.model_validate_json(text)
        except Exception as exc:  # noqa: BLE001
            LAST_ERROR = mask(f"{type(exc).__name__}: {exc}")[:300]
            log.warning("Gemini attempt %d failed: %s", attempt + 1, LAST_ERROR)
            if any(k in LAST_ERROR for k in ("PERMISSION_DENIED", "API_KEY_INVALID", "UNAUTHENTICATED", "SUSPENDED")):
                break  # a blocked key will not recover on retry
            if any(k in LAST_ERROR for k in QUOTA_KEYS):
                _blocked_until = time.time() + 600  # quota used up: stop calling for 10 minutes
                break
            if attempt == 0:
                await asyncio.sleep(2.0)  # short pause: 503 "overloaded" and 429 usually clear in seconds
    return None


async def diagnose() -> dict:
    """Used by /api/health/gemini. Reports the real error text so setup problems are visible."""
    from .embeddings import _embed_sync

    out = {"key_set": bool(settings.gemini_api_key), "model": settings.gemini_model, "embed_model": settings.gemini_embed_model}

    class Ping(BaseModel):
        ok: bool

    for name, fn in (
        ("embedding", lambda: asyncio.to_thread(_embed_sync, ["hello"])),
        ("generation", lambda: asyncio.to_thread(_call, "Reply with JSON.", "Return {\"ok\": true}", Ping)),
    ):
        try:
            await asyncio.wait_for(fn(), timeout=25)
            out[name] = "ok"
        except Exception as exc:  # noqa: BLE001
            out[name] = mask(f"{type(exc).__name__}: {exc}")[:400]
    return out