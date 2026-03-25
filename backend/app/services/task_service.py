"""
Cloud Tasks integration for background work.

In production (CLOUD_RUN_URL is set), enqueues HTTP tasks to Google Cloud Tasks
which call back into the worker endpoint on the same Cloud Run service.

In local development (CLOUD_RUN_URL is empty), falls back to running the work
in-process via asyncio.create_task — identical to the old behaviour.
"""

import asyncio
import json
import logging
import uuid

from config import settings

logger = logging.getLogger(__name__)

_LOCAL_MODE = not settings.CLOUD_RUN_URL


async def enqueue_theme_refill(user_id: uuid.UUID) -> None:
    """Enqueue a Cloud Tasks job to refill the theme pool.

    In local mode, runs the generation in-process as a fire-and-forget task.
    In production, creates a Cloud Tasks HTTP task targeting the worker endpoint.
    """
    if _LOCAL_MODE:
        await _enqueue_local(user_id)
    else:
        await _enqueue_cloud_task(user_id)


# ── Local fallback (dev) ──────────────────────────────────────


async def _enqueue_local(user_id: uuid.UUID) -> None:
    """Run theme generation in-process (fire-and-forget)."""
    from app.api.routers.theme_pool import _background_refill, POOL_SIZE
    from app.db.database import async_session_factory
    from app.db.models import ThemePool
    from sqlalchemy import select, func

    async with async_session_factory() as session:
        result = await session.execute(
            select(func.count(ThemePool.id))
            .where(ThemePool.user_id == user_id, ThemePool.is_used == False)
        )
        current_count = result.scalar() or 0

    missing = POOL_SIZE - current_count
    if missing > 0:
        asyncio.create_task(_background_refill(user_id, missing))
        logger.info("Local mode: created in-process refill task for user %s (%d missing)",
                     user_id, missing)
    else:
        logger.debug("Local mode: pool already full for user %s", user_id)


# ── Cloud Tasks (production) ─────────────────────────────────


async def _enqueue_cloud_task(user_id: uuid.UUID) -> None:
    """Create a Cloud Tasks HTTP task targeting the worker endpoint."""
    from google.cloud import tasks_v2

    client = tasks_v2.CloudTasksClient()

    queue_path = client.queue_path(
        settings.GCP_PROJECT_ID,
        settings.VERTEX_AI_LOCATION,
        settings.CLOUD_TASKS_QUEUE,
    )

    payload = json.dumps({"user_id": str(user_id)}).encode("utf-8")
    url = f"{settings.CLOUD_RUN_URL}/internal/worker/generate-themes"

    task = tasks_v2.Task(
        http_request=tasks_v2.HttpRequest(
            http_method=tasks_v2.HttpMethod.POST,
            url=url,
            headers={
                "Content-Type": "application/json",
                "X-Worker-Key": settings.WORKER_API_KEY,
            },
            body=payload,
        ),
    )

    try:
        created = client.create_task(
            request=tasks_v2.CreateTaskRequest(
                parent=queue_path,
                task=task,
            )
        )
        logger.info("Cloud Tasks: enqueued theme refill for user %s — task=%s",
                     user_id, created.name)
    except Exception as e:
        logger.error("Cloud Tasks: failed to enqueue theme refill for user %s: %s",
                     user_id, e)
        # Fallback: run in-process so the user isn't stuck
        logger.warning("Cloud Tasks: falling back to in-process generation")
        await _enqueue_local(user_id)
