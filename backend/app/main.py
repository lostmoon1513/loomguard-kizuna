"""LoomGuard API entrypoint."""
import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import settings
from .db import close_db, ping_db
from .routers import brand, debug
from .services import store
from .services.demo import demo_available, load_demo_kit
from .services.gemini_client import diagnose

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("loomguard")

MOCK_PATH = Path(__file__).resolve().parent.parent / "mocks" / "draft_response.json"


@asynccontextmanager
async def lifespan(_: FastAPI):
    log.info("LoomGuard starting. Gemini key set: %s, Mongo URI set: %s",
             bool(settings.gemini_api_key), bool(settings.mongo_uri))
    await store.load_kit()
    if store.KIT.version == 0 and settings.autoload_demo and demo_available():
        try:
            await load_demo_kit()
            log.info("Demo kit loaded automatically")
        except Exception as exc:  # noqa: BLE001
            log.warning("Demo kit autoload failed: %s", exc)
    yield
    close_db()


app = FastAPI(title="LoomGuard API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def error_json(status: int, code: str, message: str) -> JSONResponse:
    """All errors use the same shape: {"error": {"code", "message"}}."""
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


app.include_router(brand.router)
app.include_router(debug.router)


@app.exception_handler(StarletteHTTPException)  # also catches FastAPI's HTTPException and router 404s
async def http_exc_handler(_: Request, exc: StarletteHTTPException):
    return error_json(exc.status_code, f"HTTP_{exc.status_code}", str(exc.detail))


@app.exception_handler(RequestValidationError)
async def validation_exc_handler(_: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    where = ".".join(str(p) for p in first.get("loc", []))
    return error_json(422, "VALIDATION_ERROR", f"Invalid request at '{where}': {first.get('msg', 'invalid')}")


@app.exception_handler(Exception)
async def unhandled_exc_handler(_: Request, exc: Exception):
    log.exception("Unhandled error: %s", exc)
    return error_json(500, "INTERNAL_ERROR", "Something went wrong on the server.")


@app.get("/api/health")
async def health():
    db = await ping_db()
    return {
        "status": "ok",
        "version": app.version,
        "gemini_configured": bool(settings.gemini_api_key),
        "database": db,
    }


@app.get("/api/health/gemini")
async def health_gemini():
    """Shows the real Gemini error text (embedding + generation) so setup problems are visible."""
    return await diagnose()


@app.get("/api/mock/draft", tags=["mock"])
async def mock_draft():
    """Fixed sample response so the frontend can build against the real shape."""
    return json.loads(MOCK_PATH.read_text(encoding="utf-8"))