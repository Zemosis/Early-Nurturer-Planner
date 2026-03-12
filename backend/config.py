"""
Early Nurturer Planner — Backend Configuration

Loads environment variables from a .env file using pydantic-settings.
All sensitive values (database URL, credentials path) are kept out of
source control via .env (which is gitignored).

Usage:
    from config import settings

    print(settings.DATABASE_URL)
    print(settings.GCS_BUCKET_NAME)
"""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ── Database ─────────────────────────────────────────────
    DATABASE_URL: str = Field(
        ...,
        description="Async PostgreSQL connection string (postgresql+asyncpg://...)",
    )

    # ── Google Cloud Platform ────────────────────────────────
    GCP_PROJECT_ID: str = Field(
        default="early-nurturer-planner",
        description="GCP project ID",
    )
    GCS_BUCKET_NAME: str = Field(
        default="early-nurturer-planner-assets",
        description="Cloud Storage bucket for PDFs and assets",
    )
    GOOGLE_APPLICATION_CREDENTIALS: str | None = Field(
        default=None,
        description="Path to the GCP service account JSON key file (optional on Cloud Run)",
    )

    # ── Vertex AI ────────────────────────────────────────────
    VERTEX_AI_LOCATION: str = Field(
        default="us-central1",
        description="GCP region for Vertex AI API calls",
    )

    # ── YouTube Data API ──────────────────────────────────────
    YOUTUBE_API_KEY: str = Field(
        default="",
        description="YouTube Data API v3 key for fetching real video embed URLs",
    )

    @field_validator("GOOGLE_APPLICATION_CREDENTIALS")
    @classmethod
    def credentials_file_must_exist(cls, v: str | None) -> str | None:
        if v is None:
            return None
        path = Path(v).expanduser().resolve()
        if not path.is_file():
            raise ValueError(
                f"Service account key file not found: {path}\n"
                "  Run scripts/gcp-phase1-setup.sh to generate it, "
                "or update GOOGLE_APPLICATION_CREDENTIALS in your .env."
            )
        return str(path)

    @field_validator("DATABASE_URL")
    @classmethod
    def must_be_async_postgres(cls, v: str) -> str:
        if not v.startswith(("postgresql+asyncpg://", "postgresql://", "postgres://")):
            raise ValueError(
                "DATABASE_URL must start with 'postgresql+asyncpg://' "
                "(or 'postgresql://' / 'postgres://')."
            )
        return v


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance (reads .env once)."""
    return Settings()


settings = get_settings()
