"""Drafts live in memory and are written to MongoDB in the background when Mongo is reachable."""
import asyncio
import copy
import logging
from datetime import datetime, timezone

DRAFTS: dict[str, dict] = {}
PERSIST = True  # tests switch this off
log = logging.getLogger("loomguard.drafts")


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


async def _persist(doc: dict) -> None:
    from ..db import get_db, mark_down, mongo_ok

    db = get_db()
    if db is None or not mongo_ok():
        return
    try:
        await db.drafts.replace_one({"_id": doc["id"]}, {**doc, "_id": doc["id"]}, upsert=True)
    except Exception as exc:  # noqa: BLE001
        mark_down()
        log.warning("Draft not saved to MongoDB (in-memory copy kept): %s", str(exc)[:120])


def save(draft: dict) -> None:
    draft["updated_at"] = now()
    DRAFTS[draft["id"]] = draft
    if not PERSIST:
        return
    try:
        asyncio.get_running_loop().create_task(_persist(copy.deepcopy(draft)))
    except RuntimeError:
        pass  # no running loop (unit tests)


async def load_all() -> None:
    from ..db import get_db, mark_down, mongo_ok

    db = get_db()
    if db is None or not mongo_ok():
        return
    try:
        async for doc in db.drafts.find({}):
            doc.pop("_id", None)
            DRAFTS[doc["id"]] = doc
        log.info("Loaded %d drafts from MongoDB", len(DRAFTS))
    except Exception as exc:  # noqa: BLE001
        mark_down()
        log.warning("Could not load drafts: %s", str(exc)[:120])