"""Current brand kit in memory, persisted to MongoDB when configured so it survives restarts."""
import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np

from ..db import get_db
from .embeddings import embed
from .retrieval import HybridIndex

log = logging.getLogger("loomguard.store")
BRAND_ID = "default"  # single brand in Round 2; kept in every record so kits never mix


@dataclass
class Kit:
    version: int = 0
    guide_name: str = ""
    facts_name: str = ""
    chunks: list = field(default_factory=list)
    facts: list = field(default_factory=list)
    terms: dict = field(default_factory=lambda: {"banned": [], "preferred": [], "hex_codes": []})
    embedded: bool = False
    guide_index: Optional[HybridIndex] = None
    facts_index: Optional[HybridIndex] = None


KIT = Kit()


async def rebuild_indexes(kit: Kit, reuse_vectors: Optional[dict] = None) -> None:
    g_vec = f_vec = None
    texts = [c["text"] for c in kit.chunks] + [f["text"] for f in kit.facts]
    vecs = await embed(texts)
    if vecs is not None and len(vecs) == len(texts):
        g_vec, f_vec = vecs[: len(kit.chunks)], vecs[len(kit.chunks):]
    kit.embedded = g_vec is not None
    kit.guide_index = HybridIndex(kit.chunks, g_vec)
    kit.facts_index = HybridIndex(kit.facts, f_vec)


async def set_kit(chunks, facts, guide_name, facts_name) -> Kit:
    global KIT
    new = Kit(version=KIT.version + 1, guide_name=guide_name, facts_name=facts_name,
              chunks=chunks, facts=facts, terms=KIT.terms)
    await rebuild_indexes(new)
    KIT = new
    await save_kit()
    return KIT


async def save_kit() -> None:
    db = get_db()
    if db is None:
        return
    try:
        doc = {"_id": "current", "version": KIT.version, "guide_name": KIT.guide_name, "facts_name": KIT.facts_name,
               "chunks": KIT.chunks, "facts": KIT.facts, "terms": KIT.terms}
        await db.brand_kits.replace_one({"_id": "current"}, doc, upsert=True)
    except Exception as exc:  # noqa: BLE001
        log.warning("Could not save kit to MongoDB: %s", exc)


async def load_kit() -> None:
    """Called at startup: rebuild the in-memory indexes from the saved kit."""
    global KIT
    db = get_db()
    if db is None:
        return
    try:
        doc = await db.brand_kits.find_one({"_id": "current"})
        if not doc:
            return
        kit = Kit(version=doc["version"], guide_name=doc.get("guide_name", ""), facts_name=doc.get("facts_name", ""),
                  chunks=doc["chunks"], facts=doc["facts"], terms=doc.get("terms", KIT.terms))
        await rebuild_indexes(kit)
        KIT = kit
        log.info("Loaded kit v%s: %d chunks, %d facts", kit.version, len(kit.chunks), len(kit.facts))
    except Exception as exc:  # noqa: BLE001
        log.warning("Could not load kit from MongoDB: %s", exc)
