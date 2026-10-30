"""LoomGuard API entrypoint."""
import json
import os
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import settings
from .db import close_db, ping_db
from .ratelimit import RateLimit
from .routers import auth, brand, debug, drafts
from .services import accounts, drafts_store, store
from .services.demo import demo_available, load_demo_kit
from .services import gemini_client
from .services.gemini_client import diagnose

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("loomguard")

MOCK_PATH = Path(__file__).resolve().parent.parent / "mocks" / "draft_response.json"


@asynccontextmanager
async def lifespan(_: FastAPI):
    log.info("LoomGuard starting. Gemini key set: %s, Mongo URI set: %s",
             bool(settings.gemini_api_key), bool(settings.mongo_uri))
    seeded = accounts.seed_demo_users()
    if seeded:
        log.info("Seeded %d demo accounts", seeded)
    if settings.legacy_header_auth:
        log.warning("LEGACY_HEADER_AUTH is ON: X-Role / X-User headers are accepted. Turn it off before the final submission.")
    await store.load_kit()
    if store.KIT.version == 0 and settings.autoload_demo and demo_available():
        try:
            await load_demo_kit()
            log.info("Demo kit loaded automatically")
        except Exception as exc:  # noqa: BLE001
            log.warning("Demo kit autoload failed: %s", exc)
    await drafts_store.load_all()
    yield
    close_db()


app = FastAPI(title="LoomGuard API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.add_middleware(RateLimit, enabled=os.getenv("RATE_LIMIT", "true").lower() == "true")


def error_json(status: int, code: str, message: str) -> JSONResponse:
    """All errors use the same shape: {"error": {"code", "message"}}."""
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


app.include_router(auth.router)
app.include_router(brand.router)
app.include_router(drafts.router)
app.include_router(debug.router)


@app.exception_handler(StarletteHTTPException)  # also catches FastAPI's HTTPException and router 404s
async def http_exc_handler(_: Request, exc: StarletteHTTPException):
    import re

    detail = str(exc.detail)
    m = re.match(r"^([A-Z][A-Z_]{2,}): (.*)$", detail, re.S)  # "NO_KIT: message" -> code + message
    if m:
        return error_json(exc.status_code, m.group(1), m.group(2))
    return error_json(exc.status_code, f"HTTP_{exc.status_code}", detail)


@app.exception_handler(RequestValidationError)
async def validation_exc_handler(_: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    where = ".".join(str(p) for p in first.get("loc", []))
    return error_json(422, "VALIDATION_ERROR", f"Invalid request at '{where}': {first.get('msg', 'invalid')}")


@app.exception_handler(Exception)
async def unhandled_exc_handler(_: Request, exc: Exception):
    log.exception("Unhandled error: %s", exc)
    return error_json(500, "INTERNAL_ERROR", "Something went wrong on the server.")


def _quota_paused() -> bool:
    import time
    return time.time() < gemini_client._blocked_until


@app.get("/api/health")
async def health():
    db = await ping_db()
    return {
        "status": "ok",
        "version": app.version,
        "gemini_configured": bool(settings.gemini_api_key),
        "database": db,
        "persistence": "mongodb" if db.get("connected") else "memory",  # "memory" = drafts are lost on restart
        "kit_version": store.KIT.version,
        "ai": {"paused_for_quota": _quota_paused(), "last_error": (gemini_client.LAST_ERROR or None)},
        "drafts_in_memory": len(drafts_store.DRAFTS),
        "auth": {"demo_accounts": settings.seed_demo_users, "legacy_header_auth": settings.legacy_header_auth},
    }


@app.get("/api/health/gemini")
async def health_gemini():
    """Shows the real Gemini error text (embedding + generation) so setup problems are visible."""
    return await diagnose()


@app.get("/api/mock/draft", tags=["mock"])
async def mock_draft():
    """Fixed sample response so the frontend can build against the real shape."""
    return json.loads(MOCK_PATH.read_text(encoding="utf-8"))


# Serve the web app from the same server (one link for judges, no CORS problems). Keep this LAST.
WEB_DIR = Path(__file__).resolve().parent.parent / "web"
if WEB_DIR.exists():
    app.mount("/", StaticFiles(directory=str(WEB_DIR), html=True), name="web")
