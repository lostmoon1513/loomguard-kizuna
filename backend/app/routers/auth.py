import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..config import settings
from ..deps import current_user
from ..services import accounts

router = APIRouter(prefix="/api/auth", tags=["auth"])
_FAILS: dict[str, list[float]] = {}  # email -> times of recent failed logins (simple brute-force brake)


class LoginIn(BaseModel):
    email: str = Field(max_length=200)
    password: str = Field(max_length=200)


@router.post("/login")
async def login(body: LoginIn):
    key = body.email.strip().lower()
    now = time.time()
    recent = [t for t in _FAILS.get(key, []) if now - t < 300]
    if len(recent) >= 10:
        raise HTTPException(429, "RATE_LIMITED: Too many failed sign-ins. Wait a few minutes and try again.")
    try:
        user = accounts.authenticate(body.email, body.password)
    except accounts.AuthError as exc:
        _FAILS[key] = recent + [now]
        raise HTTPException(exc.status, f"{exc.code}: {exc.message}") from exc
    _FAILS.pop(key, None)
    return {"token": accounts.make_token(user), "user": accounts.public(user)}


@router.get("/me")
async def me(user: dict = Depends(current_user)):
    return {"user": accounts.public(user)}


@router.get("/demo-accounts")
async def demo_accounts():
    """For the login page: shows the sample accounts and their shared password. Demo data only (switch off with SEED_DEMO_USERS=false)."""
    demo = [accounts.public(u) for u in accounts.USERS.values() if u.get("demo")]
    return {"demo": bool(demo), "password": settings.demo_password if demo else None, "accounts": demo}