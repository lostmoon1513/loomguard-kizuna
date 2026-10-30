"""Stores the checked image for each draft version. Memory first, disk second, MongoDB best-effort."""
import asyncio
import logging
from pathlib import Path
from typing import Optional

log = logging.getLogger("loomguard.images")
_MEM: dict[str, bytes] = {}
DIR = Path(__file__).resolve().parents[2] / ".cache" / "images"
PERSIST = True  # tests switch this off


def _key(draft_id: str, n: int) -> str:
    return f"{draft_id}_{n}"


async def _to_mongo(key: str, data: bytes) -> None:
    from ..db import get_db, mark_down, mongo_ok

    db = get_db()
    if db is None or not mongo_ok():
        return
    try:
        await db.images.replace_one({"_id": key}, {"_id": key, "data": data}, upsert=True)
    except Exception as exc:  # noqa: BLE001
        mark_down()
        log.warning("Image not saved to MongoDB (disk copy kept): %s", str(exc)[:120])


def put(draft_id: str, n: int, data: bytes) -> None:
    key = _key(draft_id, n)
    _MEM[key] = data
    if not PERSIST:
        return
    try:
        DIR.mkdir(parents=True, exist_ok=True)
        (DIR / f"{key}.png").write_bytes(data)
    except OSError as exc:
        log.warning("Image not saved to disk: %s", exc)
    try:
        asyncio.get_running_loop().create_task(_to_mongo(key, data))
    except RuntimeError:
        pass


async def get(draft_id: str, n: int) -> Optional[bytes]:
    key = _key(draft_id, n)
    if key in _MEM:
        return _MEM[key]
    f = DIR / f"{key}.png"
    if PERSIST and f.exists():
        _MEM[key] = f.read_bytes()
        return _MEM[key]
    if PERSIST:
        from ..db import get_db, mark_down, mongo_ok

        db = get_db()
        if db is not None and mongo_ok():
            try:
                doc = await db.images.find_one({"_id": key})
                if doc:
                    _MEM[key] = bytes(doc["data"])
                    return _MEM[key]
            except Exception:  # noqa: BLE001
                mark_down()
    return None