"""
FastAPI router — Theme Pool.

Manages a persistent pool of 5 pre-generated themes per user.
On first load, 5 themes are generated from scratch. Subsequent loads
return existing active themes, auto-filling if fewer than 5 remain.
"""

import logging
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, update

from app.agents.tools import fetch_student_context, generate_theme_options
from app.db.database import async_session_factory
from app.db.models import ThemePool

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/theme-pool", tags=["Theme Pool"])

POOL_SIZE = 5


# ── Request / Response schemas ────────────────────────────────


class RefreshRequest(BaseModel):
    """Payload for the refresh endpoint."""
    keep_ids: list[str] = []


class ThemePoolItem(BaseModel):
    """Single theme in the pool — returned to frontend."""
    id: str
    theme_data: dict


# ── Helpers ───────────────────────────────────────────────────


async def _generate_and_store(user_id: uuid.UUID, count: int, session) -> list[ThemePool]:
    """Generate `count` new themes via AI and insert them into the pool."""
    if count <= 0:
        return []

    # Fetch student context for the educator
    student_context = await fetch_student_context(str(user_id))
    if not student_context or "No student context available" in student_context:
        student_context = "Mixed-age infant/toddler classroom (0-36 months)."

    themes = await generate_theme_options(student_context, count)

    new_rows = []
    for theme in themes:
        row = ThemePool(
            user_id=user_id,
            theme_data=theme.model_dump(),
            is_used=False,
        )
        session.add(row)
        new_rows.append(row)

    await session.flush()  # assign IDs
    return new_rows


# ── Endpoints ─────────────────────────────────────────────────


@router.get("/{user_id}")
async def get_theme_pool(user_id: str):
    """Return the user's active theme pool (up to 5).

    If fewer than 5 active themes exist, auto-generate replacements.
    First-time users get 5 freshly generated themes.
    """
    try:
        user_uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id")

    async with async_session_factory() as session:
        # Count active (not used) themes
        result = await session.execute(
            select(ThemePool)
            .where(ThemePool.user_id == user_uid, ThemePool.is_used == False)
            .order_by(ThemePool.created_at)
        )
        active_themes = list(result.scalars().all())

        missing = POOL_SIZE - len(active_themes)
        if missing > 0:
            logger.info("ThemePool: user %s has %d active themes, generating %d more",
                        user_id, len(active_themes), missing)
            try:
                new_rows = await _generate_and_store(user_uid, missing, session)
                active_themes.extend(new_rows)
                await session.commit()
            except Exception as e:
                logger.error("ThemePool: generation failed — %s", e)
                await session.rollback()
                raise HTTPException(
                    status_code=500,
                    detail=f"Theme generation failed: {e}",
                )

        return [
            ThemePoolItem(id=str(t.id), theme_data=t.theme_data)
            for t in active_themes[:POOL_SIZE]
        ]


@router.post("/{user_id}/refresh")
async def refresh_theme_pool(user_id: str, request: RefreshRequest):
    """Discard non-kept themes and generate replacements.

    Body: { keep_ids: ["uuid", ...] }
    Themes NOT in keep_ids are marked as used. New themes are generated
    to bring the pool back to 5.
    """
    try:
        user_uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id")

    keep_uuids = set()
    for kid in request.keep_ids:
        try:
            keep_uuids.add(uuid.UUID(kid))
        except ValueError:
            pass

    async with async_session_factory() as session:
        # Fetch all active themes
        result = await session.execute(
            select(ThemePool)
            .where(ThemePool.user_id == user_uid, ThemePool.is_used == False)
        )
        active_themes = list(result.scalars().all())

        # Mark non-kept as used
        kept = []
        for t in active_themes:
            if t.id in keep_uuids:
                kept.append(t)
            else:
                t.is_used = True

        missing = POOL_SIZE - len(kept)
        try:
            new_rows = await _generate_and_store(user_uid, missing, session)
            kept.extend(new_rows)
            await session.commit()
        except Exception as e:
            logger.error("ThemePool refresh failed: %s", e)
            await session.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Theme refresh failed: {e}",
            )

        return [
            ThemePoolItem(id=str(t.id), theme_data=t.theme_data)
            for t in kept[:POOL_SIZE]
        ]
