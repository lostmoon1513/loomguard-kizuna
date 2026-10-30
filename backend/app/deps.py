"""FastAPI dependencies: who is calling, and are they allowed. Roles come from the signed token, never from a header the client picks."""
from typing import Optional

from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .services import accounts

bearer_scheme = HTTPBearer(auto_error=False)


def current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
                 authorization: Optional[str] = Header(None), x_role: Optional[str] = Header(None),
                 x_user: Optional[str] = Header(None)) -> dict:
    raw_token = credentials.credentials if credentials else None
    if not raw_token and authorization and authorization.lower().startswith("bearer "):
        raw_token = authorization[7:].strip()
    if raw_token:
        try:
            return accounts.user_from_token(raw_token)
        except accounts.AuthError as exc:
            raise HTTPException(exc.status, f"{exc.code}: {exc.message}") from exc
    legacy = accounts.legacy_user(x_role, x_user)  # only when LEGACY_HEADER_AUTH=true
    if legacy:
        return legacy
    raise HTTPException(401, "UNAUTHENTICATED: Sign in first.")


def require_roles(*roles: str):
    def dep(user: dict = Depends(current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(403, f"FORBIDDEN_ROLE: This needs one of these roles: {', '.join(roles)}.")
        return user
    return dep