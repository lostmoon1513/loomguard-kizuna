"""Central settings, read once from environment / .env."""
import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _list(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    gemini_embed_model: str = os.getenv("GEMINI_EMBED_MODEL", "gemini-embedding-001")
    mongo_uri: str = os.getenv("MONGO_URI", "")
    mongo_db: str = os.getenv("MONGO_DB", "loomguard")
    cors_origins: tuple = tuple(_list(os.getenv("CORS_ORIGINS", "http://localhost:5173")))
    similarity_threshold: float = float(os.getenv("SIMILARITY_THRESHOLD", "0.55"))
    gemini_timeout: float = float(os.getenv("GEMINI_TIMEOUT_SECONDS", "25"))
    max_upload_mb: int = int(os.getenv("MAX_UPLOAD_MB", "10"))
    autoload_demo: bool = os.getenv("AUTOLOAD_DEMO", "true").lower() == "true"


settings = Settings()