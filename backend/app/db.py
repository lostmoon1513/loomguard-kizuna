"""MongoDB access. Connection is lazy so the API still boots without a database."""
import logging
import time
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import settings

log = logging.getLogger("loomguard.db")

_client: Optional[AsyncIOMotorClient] = None
_down_until = 0.0


def mongo_ok() -> bool:
    """False when Mongo is not configured or failed in the last 60 s (skip it, keep the API fast)."""
    return bool(settings.mongo_uri) and time.time() >= _down_until


def mark_down() -> None:
    global _down_until
    _down_until = time.time() + 60


def get_db() -> Optional[AsyncIOMotorDatabase]:
    """Return the database handle, or None when MONGO_URI is not configured."""
    global _client
    if not settings.mongo_uri:
        return None
    if _client is None:
        import certifi

        _client = AsyncIOMotorClient(settings.mongo_uri, serverSelectionTimeoutMS=4000, tlsCAFile=certifi.where())
    return _client[settings.mongo_db]


async def ping_db() -> dict:
    """Used by /api/health. Never raises."""
    db = get_db()
    if db is None:
        return {"connected": False, "reason": "MONGO_URI not set"}
    try:
        await db.command("ping")
        return {"connected": True}
    except Exception as exc:  # noqa: BLE001 - health check must not crash
        log.warning("Mongo ping failed: %s", exc)
        return {"connected": False, "reason": "cannot reach MongoDB, check MONGO_URI and Atlas IP allowlist"}


def close_db() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None