"""
FastAPI router — Internal Worker Endpoints.

These endpoints are called by Google Cloud Tasks (or locally in dev mode).
They are NOT meant for direct frontend consumption.

Authentication: Requires a valid X-Worker-Key header matching WORKER_API_KEY.
"""

import logging
import uuid

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select, func

from app.agents.tools import fetch_student_context, generate_theme_options
from app.db.database import async_session_factory
from app.db.models import ThemePool
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal/worker", tags=["Internal Workers"])

POOL_SIZE = 5


# ── Auth dependency ───────────────────────────────────────────


def _verify_worker_key(x_worker_key: str = Header(..., alias="X-Worker-Key")) -> None:
    """Reject requests without a valid worker API key."""
    if not settings.WORKER_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Worker endpoint not configured (WORKER_API_KEY is empty)",
        )
    if x_worker_key != settings.WORKER_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid worker key")


# ── Request schema ────────────────────────────────────────────


class GenerateThemesRequest(BaseModel):
    """Payload sent by Cloud Tasks."""
    user_id: str


# ── Worker endpoint ───────────────────────────────────────────


@router.post("/generate-themes")
async def generate_themes_worker(
    request: GenerateThemesRequest,
    x_worker_key: str = Header(..., alias="X-Worker-Key"),
):
    """Generate missing themes for a user's theme pool.

    Called by Google Cloud Tasks. Returns 200 on success so Cloud Tasks
    considers the task complete. Non-2xx triggers automatic retry.
    """
    _verify_worker_key(x_worker_key)

    try:
        user_uid = uuid.UUID(request.user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id")

    async with async_session_factory() as session:
        # Count current active themes
        result = await session.execute(
            select(func.count(ThemePool.id))
            .where(ThemePool.user_id == user_uid, ThemePool.is_used == False)
        )
        current_count = result.scalar() or 0
        missing = POOL_SIZE - current_count

        if missing <= 0:
            logger.info("Worker: pool already full for user %s, skipping", user_uid)
            return {"status": "skipped", "reason": "pool_full"}

        logger.info("Worker: generating %d themes for user %s", missing, user_uid)

        # Fetch student context for the educator
        student_context = await fetch_student_context(str(user_uid))
        if not student_context or "No student context available" in student_context:
            student_context = "Mixed-age infant/toddler classroom (0-36 months)."

        # Collect existing theme names for uniqueness enforcement
        from app.api.routers.theme_pool import _collect_existing_theme_names
        existing_themes = await _collect_existing_theme_names(user_uid, session)

        themes = await generate_theme_options(student_context, missing, existing_themes=existing_themes)

        for theme in themes:
            row = ThemePool(
                user_id=user_uid,
                theme_data=theme.model_dump(),
                is_used=False,
            )
            session.add(row)

        await session.commit()
        logger.info("Worker: generated %d themes for user %s", len(themes), user_uid)

    return {"status": "success", "generated": len(themes)}
