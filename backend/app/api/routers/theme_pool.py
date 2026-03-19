"""
FastAPI router — Theme Pool.

Manages a persistent pool of 5 pre-generated themes per user.
On first load, 5 themes are generated from scratch. Subsequent loads
return existing active themes immediately and kick off background
generation for any missing slots.
"""

import asyncio
import logging
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, update

from app.agents.tools import fetch_student_context, generate_theme_options
from app.db.database import async_session_factory
from app.db.models import ThemePool, WeeklyPlan
from app.services.pdf_service import delete_plan_assets_from_gcs

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/theme-pool", tags=["Theme Pool"])

POOL_SIZE = 5

# ── Per-user generation locks ─────────────────────────────────
# Prevents concurrent background refills for the same user.
_generation_locks: dict[uuid.UUID, asyncio.Lock] = {}
_generating_users: set[uuid.UUID] = set()  # track who has an in-flight generation


def _get_user_lock(user_id: uuid.UUID) -> asyncio.Lock:
    """Get or create an asyncio.Lock for a specific user."""
    if user_id not in _generation_locks:
        _generation_locks[user_id] = asyncio.Lock()
    return _generation_locks[user_id]


# ── Request / Response schemas ────────────────────────────────


class RefreshRequest(BaseModel):
    """Payload for the refresh endpoint."""
    keep_ids: list[str] = []


class ThemePoolItem(BaseModel):
    """Single theme in the pool — returned to frontend."""
    id: str
    theme_data: dict
    plan_id: str | None = None


# ── Helpers ───────────────────────────────────────────────────


async def _collect_existing_theme_names(user_id: uuid.UUID, session) -> list[str]:
    """Gather theme names to exclude from AI generation (uniqueness enforcement).

    Sources (the "Shadow Pool"):
      1. Active pool themes (is_used=False) — don't duplicate what's already offered.
      2. Last 10 weekly plans — if a plan was deleted it won't appear here, which
         is intentional: deleted themes become eligible for regeneration.
      3. Last 10 explicitly discarded pool themes (is_used=True, plan_id IS NULL) —
         themes the user refreshed away. They shouldn't come back soon.
    """
    names: list[str] = []

    # 1. Active pool theme names
    pool_result = await session.execute(
        select(ThemePool.theme_data)
        .where(ThemePool.user_id == user_id, ThemePool.is_used == False)
    )
    for (td,) in pool_result.all():
        if isinstance(td, dict) and td.get("name"):
            names.append(td["name"])

    # 2. Last 10 weekly plans (deleted plans naturally drop off)
    plan_result = await session.execute(
        select(WeeklyPlan.theme)
        .where(WeeklyPlan.user_id == user_id)
        .order_by(WeeklyPlan.created_at.desc())
        .limit(10)
    )
    for (theme_name,) in plan_result.all():
        if theme_name:
            names.append(theme_name)

    # 3. Last 10 explicitly discarded themes (refreshed/shuffled away)
    discarded_result = await session.execute(
        select(ThemePool.theme_data)
        .where(
            ThemePool.user_id == user_id,
            ThemePool.is_used == True,
            ThemePool.plan_id.is_(None),
        )
        .order_by(ThemePool.created_at.desc())
        .limit(10)
    )
    for (td,) in discarded_result.all():
        if isinstance(td, dict) and td.get("name"):
            names.append(td["name"])

    return names


async def _generate_and_store(user_id: uuid.UUID, count: int, session) -> list[ThemePool]:
    """Generate `count` new themes via AI and insert them into the pool."""
    if count <= 0:
        return []

    # Fetch student context for the educator
    student_context = await fetch_student_context(str(user_id))
    if not student_context or "No student context available" in student_context:
        student_context = "Mixed-age infant/toddler classroom (0-36 months)."

    # Collect existing theme names for uniqueness enforcement
    existing_themes = await _collect_existing_theme_names(user_id, session)

    themes = await generate_theme_options(student_context, count, existing_themes=existing_themes)

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


# ── Background refill ─────────────────────────────────────────


async def _background_refill(user_id: uuid.UUID, count: int) -> None:
    """Generate missing themes in the background (fire-and-forget).

    Uses a per-user lock so concurrent calls are serialised, not duplicated.
    """
    lock = _get_user_lock(user_id)
    if lock.locked():
        logger.debug("ThemePool: background refill already running for user %s", user_id)
        return

    async with lock:
        _generating_users.add(user_id)
        try:
            async with async_session_factory() as session:
                # Re-check how many are actually missing (another task may have filled them)
                result = await session.execute(
                    select(func.count(ThemePool.id))
                    .where(ThemePool.user_id == user_id, ThemePool.is_used == False)
                )
                current_count = result.scalar() or 0
                actual_missing = POOL_SIZE - current_count
                if actual_missing <= 0:
                    logger.info("ThemePool: pool already full for user %s, skipping", user_id)
                    return

                logger.info("ThemePool: background-generating %d themes for user %s",
                            actual_missing, user_id)
                await _generate_and_store(user_id, actual_missing, session)
                await session.commit()
                logger.info("ThemePool: background refill complete for user %s", user_id)
        except Exception as e:
            logger.error("ThemePool: background refill failed for user %s: %s", user_id, e)
        finally:
            _generating_users.discard(user_id)


async def refill_theme_pool_bg(user_id: uuid.UUID) -> None:
    """Public entry point for background theme pool refill.

    Called from planner.py after a theme is consumed during plan generation.
    Safe to call multiple times — uses the per-user lock to prevent duplicates.
    """
    async with async_session_factory() as session:
        result = await session.execute(
            select(func.count(ThemePool.id))
            .where(ThemePool.user_id == user_id, ThemePool.is_used == False)
        )
        current_count = result.scalar() or 0

    missing = POOL_SIZE - current_count
    if missing > 0:
        await _background_refill(user_id, missing)


# ── Endpoints ─────────────────────────────────────────────────


@router.get("/{user_id}")
async def get_theme_pool(user_id: str):
    """Return the user's active theme pool.

    Returns whatever themes currently exist immediately. If fewer than
    POOL_SIZE are present, kicks off background generation (unless one
    is already running) and sets ``generating=True`` in the response.

    First-time users (0 themes) will block until the initial batch is
    ready so they aren't shown an empty screen.
    """
    try:
        user_uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id")

    async with async_session_factory() as session:
        result = await session.execute(
            select(ThemePool)
            .where(ThemePool.user_id == user_uid, ThemePool.is_used == False)
            .order_by(ThemePool.created_at)
        )
        active_themes = list(result.scalars().all())

    missing = POOL_SIZE - len(active_themes)

    # First-time user: block until initial batch is generated
    if len(active_themes) == 0 and missing > 0:
        logger.info("ThemePool: first load for user %s — generating %d themes synchronously",
                    user_id, POOL_SIZE)
        try:
            async with async_session_factory() as session:
                new_rows = await _generate_and_store(user_uid, POOL_SIZE, session)
                await session.commit()
                active_themes = new_rows
        except Exception as e:
            logger.error("ThemePool: initial generation failed — %s", e)
            raise HTTPException(
                status_code=500,
                detail=f"Theme generation failed: {e}",
            )
        return {
            "themes": [
                ThemePoolItem(id=str(t.id), theme_data=t.theme_data, plan_id=str(t.plan_id) if t.plan_id else None)
                for t in active_themes[:POOL_SIZE]
            ],
            "generating": False,
            "pool_size": POOL_SIZE,
        }

    # Existing user with partial pool: return what we have, background-fill the rest
    is_generating = user_uid in _generating_users
    if missing > 0 and not is_generating:
        asyncio.create_task(_background_refill(user_uid, missing))
        is_generating = True

    return {
        "themes": [
            ThemePoolItem(id=str(t.id), theme_data=t.theme_data, plan_id=str(t.plan_id) if t.plan_id else None)
            for t in active_themes[:POOL_SIZE]
        ],
        "generating": is_generating,
        "pool_size": POOL_SIZE,
    }


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

        # Mark non-kept as used; clean up linked plans
        kept = []
        for t in active_themes:
            if t.id in keep_uuids:
                kept.append(t)
            else:
                # If this pool theme has a linked plan, delete its GCS assets & DB row
                if t.plan_id:
                    try:
                        deleted_count = delete_plan_assets_from_gcs(t.plan_id)
                        logger.info("Cleaned up %d GCS blobs for demoted plan %s", deleted_count, t.plan_id)
                        plan_result = await session.execute(
                            select(WeeklyPlan).where(WeeklyPlan.id == t.plan_id)
                        )
                        plan_row = plan_result.scalar_one_or_none()
                        if plan_row:
                            await session.delete(plan_row)
                            logger.info("Deleted WeeklyPlan row %s (demoted theme discarded)", t.plan_id)
                    except Exception as cleanup_err:
                        logger.warning("Failed to clean up demoted plan %s: %s", t.plan_id, cleanup_err)
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

        return {
            "themes": [
                ThemePoolItem(id=str(t.id), theme_data=t.theme_data, plan_id=str(t.plan_id) if t.plan_id else None)
                for t in kept[:POOL_SIZE]
            ],
            "generating": False,
            "pool_size": POOL_SIZE,
        }
