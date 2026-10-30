"""Central settings, read once from environment / .env."""
import os
import secrets
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _list(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    gemini_embed_model: str = os.getenv("GEMINI_EMBED_MODEL", "gemini-embedding-001")
    mongo_uri: str = os.getenv("MONGO_URI", "")
    mongo_db: str = os.getenv("MONGO_DB", "loomguard")
    cors_origins: tuple = tuple(_list(os.getenv("CORS_ORIGINS", "http://localhost:5173")))
    similarity_threshold: float = float(os.getenv("SIMILARITY_THRESHOLD", "0.55"))
    gemini_timeout: float = float(os.getenv("GEMINI_TIMEOUT_SECONDS", "25"))
    max_upload_mb: int = int(os.getenv("MAX_UPLOAD_MB", "10"))
    autoload_demo: bool = os.getenv("AUTOLOAD_DEMO", "true").lower() == "true"
    # --- sign-in (Round 3) ---
    jwt_secret: str = os.getenv("JWT_SECRET") or secrets.token_urlsafe(32)  # set JWT_SECRET in production, or tokens die on restart
    jwt_secret_from_env: bool = bool(os.getenv("JWT_SECRET"))
    token_hours: int = int(os.getenv("TOKEN_HOURS", "12"))
    seed_demo_users: bool = os.getenv("SEED_DEMO_USERS", "true").lower() == "true"
    demo_password: str = os.getenv("DEMO_PASSWORD", "loomguard-demo")
    # Temporary bridge for a frontend that still sends X-Role / X-User. Keep false in production.
    legacy_header_auth: bool = os.getenv("LEGACY_HEADER_AUTH", "false").lower() == "true"


settings = Settings()