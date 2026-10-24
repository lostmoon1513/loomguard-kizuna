"""Gemini embeddings with graceful failure. Returns None when unavailable so retrieval falls back to BM25.
Vectors are cached on disk by text hash, so restarts and kit reloads do not spend API quota again."""
import asyncio
import hashlib
import json
import logging
import time
from pathlib import Path
from typing import Optional

import numpy as np

from ..config import settings

log = logging.getLogger("loomguard.embeddings")
LAST_ERROR = ""
_blocked_until = 0.0
CACHE_PATH = Path(__file__).resolve().parent.parent.parent / ".cache" / "embeddings.json"
_cache: Optional[dict] = None


def _key(text: str) -> str:
    return hashlib.sha256(f"{settings.gemini_embed_model}|{text}".encode("utf-8")).hexdigest()


def _load_cache() -> dict:
    global _cache
    if _cache is None:
        try:
            _cache = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001 - missing or corrupt cache is fine
            _cache = {}
    return _cache


def _save_cache() -> None:
    try:
        CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        CACHE_PATH.write_text(json.dumps(_cache), encoding="utf-8")
    except Exception as exc:  # noqa: BLE001 - read-only disk on some hosts
        log.info("Embedding cache not saved: %s", exc)


def _embed_sync(texts: list[str]) -> np.ndarray:
    from google import genai

    client = genai.Client(api_key=settings.gemini_api_key)
    res = client.models.embed_content(model=settings.gemini_embed_model, contents=texts)
    arr = np.array([e.values for e in res.embeddings], dtype="float32")
    norms = np.linalg.norm(arr, axis=1, keepdims=True)
    return arr / np.where(norms == 0, 1, norms)


async def embed(texts: list[str]) -> Optional[np.ndarray]:
    global LAST_ERROR, _blocked_until
    if not texts:
        return None
    cache = _load_cache()
    keys = [_key(t) for t in texts]
    missing = [i for i, k in enumerate(keys) if k not in cache]
    if missing:
        if not settings.gemini_api_key or time.time() < _blocked_until:
            return None
        for attempt in range(2):  # one retry, then give up
            try:
                arr = await asyncio.wait_for(asyncio.to_thread(_embed_sync, [texts[i] for i in missing]),
                                             timeout=settings.gemini_timeout * 3)
                for i, v in zip(missing, arr):
                    cache[keys[i]] = [round(float(x), 6) for x in v]
                _save_cache()
                break
            except Exception as exc:  # noqa: BLE001
                from .gemini_client import mask
                LAST_ERROR = mask(f"{type(exc).__name__}: {exc}")[:300]
                log.warning("Embedding attempt %d failed: %s", attempt + 1, LAST_ERROR)
                if any(k in LAST_ERROR for k in ("RESOURCE_EXHAUSTED", "429")):
                    _blocked_until = time.time() + 600
                    return None
                if any(k in LAST_ERROR for k in ("PERMISSION_DENIED", "API_KEY_INVALID", "UNAUTHENTICATED", "SUSPENDED")):
                    return None
        else:
            return None
    return np.array([cache[k] for k in keys], dtype="float32")