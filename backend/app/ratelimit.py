"""Small in-memory rate limiter (per client IP). Protects Gemini quota and the server from repeated or runaway clicks."""
import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

GENERAL = (240, 60)   # requests, seconds
HEAVY = (20, 60)      # draft creation, image upload, revisions, recheck: these can call Gemini
MAX_BODY = 12 * 1024 * 1024


def _heavy(method: str, path: str) -> bool:
    return method == "POST" and (path in ("/api/drafts", "/api/drafts/image") or path.endswith(("/revisions", "/recheck")))


class RateLimit(BaseHTTPMiddleware):
    def __init__(self, app, enabled: bool = True):
        super().__init__(app)
        self.enabled, self.hits = enabled, defaultdict(deque)

    async def dispatch(self, request, call_next):
        path = request.url.path
        if not self.enabled or not path.startswith("/api/") or request.method == "OPTIONS":
            return await call_next(request)
        try:
            if int(request.headers.get("content-length") or 0) > MAX_BODY:
                return _err(413, "REQUEST_TOO_LARGE", "The request is larger than 12 MB.")
        except ValueError:
            return _err(400, "BAD_REQUEST", "Invalid Content-Length.")
        ip = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "?")).split(",")[0].strip()
        now = time.time()
        for name, (limit, window), applies in (("general", GENERAL, True), ("heavy", HEAVY, _heavy(request.method, path))):
            if not applies:
                continue
            q = self.hits[(ip, name)]
            while q and q[0] <= now - window:
                q.popleft()
            if len(q) >= limit:
                return _err(429, "RATE_LIMITED", f"Too many requests. Wait {int(q[0] + window - now) + 1} seconds and try again.",
                            retry=int(q[0] + window - now) + 1)
            q.append(now)
        if len(self.hits) > 5000:  # bound memory
            self.hits.clear()
        return await call_next(request)


def _err(status, code, msg, retry=None):
    r = JSONResponse(status_code=status, content={"error": {"code": code, "message": msg}})
    if retry:
        r.headers["Retry-After"] = str(retry)
    return r