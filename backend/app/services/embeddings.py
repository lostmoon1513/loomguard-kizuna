"""Gemini embeddings with graceful failure. Returns None when unavailable so retrieval falls back to BM25."""
import asyncio
import logging
from typing import Optional

import numpy as np

from ..config import settings

log = logging.getLogger("loomguard.embeddings")
MODEL = "gemini-embedding-001"
LAST_ERROR = ""


def _embed_sync(texts: list[str]) -> np.ndarray:
    from google import genai

    client = genai.Client(api_key=settings.gemini_api_key)
    res = client.models.embed_content(model=MODEL, contents=texts)
    arr = np.array([e.values for e in res.embeddings], dtype="float32")
    norms = np.linalg.norm(arr, axis=1, keepdims=True)
    return arr / np.where(norms == 0, 1, norms)


async def embed(texts: list[str]) -> Optional[np.ndarray]:
    if not settings.gemini_api_key or not texts:
        return None
    for attempt in range(2):  # one retry, then give up
        try:
            return await asyncio.wait_for(asyncio.to_thread(_embed_sync, texts), timeout=settings.gemini_timeout * 3)
        except Exception as exc:  # noqa: BLE001
            global LAST_ERROR
            LAST_ERROR = f"{type(exc).__name__}: {exc}"[:300]
            log.warning("Embedding attempt %d failed: %s", attempt + 1, exc)
    return None