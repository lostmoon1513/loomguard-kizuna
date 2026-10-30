"""Accounts, password hashing and sign-in tokens.

Users are seeded in memory at every start (deterministic ids), so sign-in works even when MongoDB is down.
Passwords use scrypt from the standard library. Tokens are standard HS256 JWTs (PyJWT).
"""
import hashlib
import hmac
import logging
import os
import time
from typing import Optional

import jwt

from ..config import settings

log = logging.getLogger("loomguard.accounts")

ROLES = ("creator", "manager", "reviewer")
USERS: dict[str, dict] = {}

DEMO_USERS = [
    ("u_creator", "creator@loomguard.demo", "Demo Creator", "creator"),
    ("u_creator2", "creator2@loomguard.demo", "Demo Creator 2", "creator"),
    ("u_manager", "manager@loomguard.demo", "Demo Manager", "manager"),
    ("u_reviewer", "reviewer@loomguard.demo", "Demo Compliance Reviewer", "reviewer"),
]


class AuthError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


def hash_password(password: str, salt: Optional[bytes] = None) -> str:
    salt = salt or os.urandom(16)
    h = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2 ** 14, r=8, p=1, dklen=32)
    return f"scrypt${salt.hex()}${h.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt_hex, hash_hex = stored.split("$")
        h = hashlib.scrypt(password.encode("utf-8"), salt=bytes.fromhex(salt_hex), n=2 ** 14, r=8, p=1, dklen=32)
        return hmac.compare_digest(h.hex(), hash_hex)
    except Exception:  # noqa: BLE001 - malformed hash is just a failed login
        return False


def public(user: dict) -> dict:
    return {"id": user["id"], "email": user.get("email"), "name": user["name"], "role": user["role"]}


def seed_demo_users() -> int:
    """Create the demo accounts if they are missing. Safe to call many times."""
    if not settings.seed_demo_users:
        return 0
    created = 0
    pw_hash = None
    for uid, email, name, role in DEMO_USERS:
        if uid in USERS:
            continue
        pw_hash = pw_hash or hash_password(settings.demo_password)
        USERS[uid] = {"id": uid, "email": email, "name": name, "role": role, "password_hash": pw_hash, "demo": True}
        created += 1
    if created and not settings.jwt_secret_from_env:
        log.warning("JWT_SECRET is not set: a random secret is used, so sign-ins end whenever the server restarts.")
    return created


def authenticate(email: str, password: str) -> dict:
    email = (email or "").strip().lower()
    user = next((u for u in USERS.values() if u["email"] == email), None)
    # same error for "no such user" and "wrong password" so accounts cannot be probed
    if not user or not verify_password(password or "", user["password_hash"]):
        raise AuthError(401, "INVALID_CREDENTIALS", "Email or password is not correct.")
    return user


def make_token(user: dict) -> str:
    now = int(time.time())
    return jwt.encode({"sub": user["id"], "name": user["name"], "role": user["role"],
                       "iat": now, "exp": now + settings.token_hours * 3600}, settings.jwt_secret, algorithm="HS256")


def user_from_token(token: str) -> dict:
    try:
        claims = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"], leeway=10)
    except jwt.ExpiredSignatureError as exc:
        raise AuthError(401, "TOKEN_EXPIRED", "Your session ended. Please sign in again.") from exc
    except jwt.PyJWTError as exc:
        raise AuthError(401, "UNAUTHENTICATED", "Sign in first.") from exc
    user = USERS.get(claims.get("sub"))
    if not user:  # token from before a restart/reseed, or a deleted user
        raise AuthError(401, "UNAUTHENTICATED", "Sign in first.")
    return user


def legacy_user(role: Optional[str], name: Optional[str]) -> Optional[dict]:
    """Only used when LEGACY_HEADER_AUTH=true (old frontend that sends X-Role / X-User)."""
    if not settings.legacy_header_auth or role not in ROLES:
        return None
    name = (name or "anonymous").strip()[:60] or "anonymous"
    return {"id": f"legacy:{name.lower()}", "email": None, "name": name, "role": role, "legacy": True}