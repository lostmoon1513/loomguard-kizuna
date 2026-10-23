"""MongoDB access. Connection is lazy so the API still boots without a database."""
import logging
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import settings

log = logging.getLogger("loomguard.db")

_client: Optional[AsyncIOMotorClient] = None


def get_db() -> Optional[AsyncIOMotorDatabase]:
    """Return the database handle, or None when MONGO_URI is not configured."""
    global _client
    if not settings.mongo_uri:
        return None
    if _client is None:
        _client = AsyncIOMotorClient(settings.mongo_uri, serverSelectionTimeoutMS=4000)
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
