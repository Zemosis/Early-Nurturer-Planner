"""
Asynchronous database engine and session factory.

Uses SQLAlchemy 2.0 async API backed by asyncpg.
The DATABASE_URL is loaded from the project .env via pydantic-settings.

Usage:
    from app.db.database import get_session

    async with get_session() as session:
        result = await session.execute(...)
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from config import settings

# ── Engine ────────────────────────────────────────────────────
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    connect_args={"statement_cache_size": 0},
)

# ── Session factory ───────────────────────────────────────────
async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ── Declarative base ─────────────────────────────────────────
class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""
    pass


# ── Dependency ────────────────────────────────────────────────
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async session, then close it.

    Designed for use as a FastAPI dependency:
        session: AsyncSession = Depends(get_session)
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
