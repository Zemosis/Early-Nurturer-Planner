"""
FastAPI router — Curriculum Planner.

Exposes the LangGraph multi-agent pipeline (Architect → Auditor →
Personalizer) as a single POST endpoint. The frontend sends a
selected theme and the pipeline returns a fully personalised,
safety-audited weekly curriculum plan.
"""

import io
import logging
import re as _re
import uuid
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, func, update as sa_update

from app.agents.graph import build_planner_graph
from app.agents.tools import search_youtube_video, fetch_youtube_video_by_id
from app.db.database import async_session_factory
from app.db.models import WeeklyPlan, ThemePool
from app.services.image_service import get_or_generate_cover_image
from app.services.material_service import get_or_generate_material, VALID_MATERIAL_TYPES
from app.services.pdf_service import (
    generate_weekly_pdf, upload_pdf_to_gcs, save_pdf_url,
    delete_pdf_from_gcs, delete_plan_assets_from_gcs,
)
from app.services.task_service import enqueue_theme_refill

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/planner", tags=["Planner"])


# ── Request schema ────────────────────────────────────────────


class GeneratePlanRequest(BaseModel):
    """Payload for the curriculum generation endpoint."""

    user_id: str
    selected_theme: dict
    theme_pool_id: str | None = None  # UUID of the theme in the pool (to mark as used)


class PlanPositionUpdate(BaseModel):
    """A single plan ID in the new desired order."""

    plan_id: str


# ── Helpers ──────────────────────────────────────────────────


def _compute_week_info(today: date | None = None) -> dict:
    """Compute calendar-based week info from a date.

    Returns dict with year, month, week_of_month, week_range.
    """
    if today is None:
        today = date.today()
    monday = today - timedelta(days=today.weekday())
    friday = monday + timedelta(days=4)
    week_of_month = (monday.day - 1) // 7 + 1
    week_range = f"{monday.month}/{monday.day} - {friday.month}/{friday.day}"
    return {
        "year": monday.year,
        "month": monday.month,
        "week_of_month": week_of_month,
        "week_range": week_range,
    }


# ── Endpoints ─────────────────────────────────────────────────


_YT_URL_PATTERNS = [
    _re.compile(r'(?:youtube\.com/watch\?.*v=|youtu\.be/|youtube\.com/embed/)([\w-]{11})'),
]


def _extract_video_id(text: str) -> str | None:
    """Extract a YouTube video ID from a URL, or return None if not a URL."""
    for pat in _YT_URL_PATTERNS:
        m = pat.search(text)
        if m:
            return m.group(1)
    return None


@router.get("/youtube/search")
async def youtube_search(q: str, exclude_id: str | None = None):
    """Search YouTube for a kid-safe video. Used by the Change Song UI.

    Supports both text queries and direct YouTube URL paste.
    Defined BEFORE parameterized /{user_id}/… routes to avoid
    any routing ambiguity in FastAPI/Starlette.
    """
    if not q or len(q.strip()) < 2:
        raise HTTPException(status_code=400, detail="Query too short")

    # If the query looks like a YouTube URL, fetch the video directly
    video_id = _extract_video_id(q)
    if video_id:
        logger.info("YouTube search: detected URL, fetching video ID %s", video_id)
        try:
            result = await fetch_youtube_video_by_id(video_id)
        except Exception as e:
            logger.error("YouTube fetch failed for ID %s: %s", video_id, e, exc_info=True)
            raise HTTPException(status_code=500, detail=f"YouTube fetch error: {e}")
        if not result:
            raise HTTPException(status_code=404, detail="Video not found or unavailable")
        return result

    # Otherwise do a keyword search (relaxed duration for manual picks)
    exclude = [exclude_id] if exclude_id else None
    try:
        result = await search_youtube_video(
            q, video_category_id="10", exclude_video_ids=exclude,
            min_duration_seconds=30,
        )
    except Exception as e:
        logger.error("YouTube search endpoint failed for q=%r: %s", q, e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"YouTube search error: {e}")

    if not result:
        logger.warning("YouTube search returned no results for q=%r", q)
        raise HTTPException(status_code=404, detail="No suitable video found")
    return result


@router.post("/generate")
async def generate_plan(request: GeneratePlanRequest):
    """Trigger the full Architect → Auditor → Personalizer pipeline,
    or instantly resurrect a sleeping plan if the pool theme has a plan_id.

    Auto-computes calendar week info from today's date.
    Marks the selected theme as used in the pool (if theme_pool_id given)
    and kicks off a background task to refill the theme pool.

    Returns:
        A dict with status, the personalised plan, and the saved plan_id.
    """
    try:
        user_uid = uuid.UUID(request.user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id")

    # Count only SCHEDULED plans (week_number IS NOT NULL) so that
    # resurrecting a sleeping row doesn't cause week_number collisions.
    async with async_session_factory() as session:
        result = await session.execute(
            select(func.count(WeeklyPlan.id))
            .where(
                WeeklyPlan.user_id == user_uid,
                WeeklyPlan.week_number.isnot(None),
            )
        )
        global_week_number = result.scalar() + 1

        # Offset week info so plan N starts N-1 weeks from today
        week_info = _compute_week_info(
            today=date.today() + timedelta(weeks=global_week_number - 1)
        )

        existing_plan_to_resurrect = None

        # Check the theme pool for a sleeping plan to resurrect
        if request.theme_pool_id:
            try:
                pool_uid = uuid.UUID(request.theme_pool_id)
                pool_result = await session.execute(
                    select(ThemePool).where(
                        ThemePool.id == pool_uid,
                        ThemePool.user_id == user_uid,
                    )
                )
                pool_theme = pool_result.scalar_one_or_none()
                if pool_theme:
                    # Did this pool theme come from a swapped-out plan?
                    if pool_theme.plan_id:
                        plan_result = await session.execute(
                            select(WeeklyPlan).where(WeeklyPlan.id == pool_theme.plan_id)
                        )
                        existing_plan_to_resurrect = plan_result.scalar_one_or_none()

                    if existing_plan_to_resurrect:
                        # Resurrect: assign the new calendar slot
                        existing_plan_to_resurrect.week_number = global_week_number
                        existing_plan_to_resurrect.year = week_info["year"]
                        existing_plan_to_resurrect.month = week_info["month"]
                        existing_plan_to_resurrect.week_of_month = week_info["week_of_month"]
                        existing_plan_to_resurrect.week_range = week_info["week_range"]
                        # Delete the pool row so it leaves the sidebar
                        await session.delete(pool_theme)
                    else:
                        # Normal AI theme — mark as used
                        pool_theme.is_used = True

                    await session.commit()
            except Exception as e:
                logger.warning("Failed to process pool theme: %s", e)

        # Extract full plan data inside the session (before it closes)
        plan_data = None
        plan_id_str = None
        if existing_plan_to_resurrect:
            plan_data = {
                "theme": existing_plan_to_resurrect.theme,
                "theme_emoji": existing_plan_to_resurrect.theme_emoji,
                "palette": existing_plan_to_resurrect.palette,
                "domains": existing_plan_to_resurrect.domains,
                "objectives": existing_plan_to_resurrect.objectives,
                "circle_time": existing_plan_to_resurrect.circle_time,
                "daily_plans": _rebuild_daily_plans(existing_plan_to_resurrect.activities or []),
                "newsletter": existing_plan_to_resurrect.newsletter,
                "week_number": global_week_number,
                "week_range": week_info["week_range"],
                "cover_image_url": existing_plan_to_resurrect.cover_image_url,
                "pdf_url": existing_plan_to_resurrect.pdf_url,
                "material_urls": existing_plan_to_resurrect.material_urls,
            }
            plan_id_str = str(existing_plan_to_resurrect.id)

    # Kick off background theme pool refill immediately (don't wait for plan gen)
    await enqueue_theme_refill(user_uid)

    # Fast path: resurrected plan — return instantly, skip LangGraph
    if plan_data:
        logger.info("Generate complete (resurrected instantly) — plan_id=%s", plan_id_str)
        return {
            "status": "success",
            "plan": plan_data,
            "plan_id": plan_id_str,
        }

    # ── AI generation fallback ────────────────────────────────
    try:
        graph_app = build_planner_graph()

        initial_state = {
            "user_id": request.user_id,
            "thread_id": str(uuid.uuid4()),
            "selected_theme": request.selected_theme,
            "week_number": global_week_number,
            "week_range": week_info["week_range"],
            "year": week_info["year"],
            "month": week_info["month"],
            "week_of_month": week_info["week_of_month"],
            "iteration_count": 0,
        }

        final_state = await graph_app.ainvoke(initial_state)

        # Log the full final state for debugging
        logger.info("Pipeline finished. Keys in state: %s", list(final_state.keys()))
        logger.info("  draft_plan present: %s", final_state.get("draft_plan") is not None)
        logger.info("  audit_result: %s", final_state.get("audit_result"))
        logger.info("  personalized_plan present: %s", final_state.get("personalized_plan") is not None)
        logger.info("  error: %s", final_state.get("error"))
        logger.info("  iteration_count: %s", final_state.get("iteration_count"))

        # Prefer personalized plan; fall back to draft if auditor
        # rejected after max iterations (plan is still usable).
        plan = final_state.get("personalized_plan") or final_state.get("draft_plan")

        if not plan:
            real_error = final_state.get("error") or "Pipeline produced no usable plan."
            logger.error("Pipeline failed — no plan in state. error=%s", real_error)
            raise HTTPException(
                status_code=500,
                detail=real_error,
            )

        if final_state.get("error"):
            logger.warning(
                "Pipeline completed with non-fatal error: %s",
                final_state["error"],
            )

        # Include the saved plan's DB ID so frontend can navigate to it
        saved_plan_id = final_state.get("saved_plan_id")
        logger.info("Generate complete — saved_plan_id=%s", saved_plan_id)

        return {
            "status": "success",
            "plan": plan,
            "plan_id": str(saved_plan_id) if saved_plan_id else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Plan generation failed: {e}",
        )


@router.post("/{user_id}/plan/{current_plan_id}/swap/{pool_theme_id}")
async def swap_theme(
    user_id: str,
    current_plan_id: str,
    pool_theme_id: str,
):
    """Swap the active plan's theme back into the pool and promote a pool theme.

    The old plan is NOT deleted — it is "unscheduled" by setting all calendar
    fields to NULL.  This preserves the full JSON payload and GCS assets so
    the plan can be instantly resurrected if the user swaps it back in.

    1. Demote: current plan → unschedule (NULL calendar) + new ThemePool row
       with plan_id linking to the sleeping plan.
    2. Promote: if pool theme has a plan_id, resurrect that sleeping plan
       into the freed calendar slot.  Otherwise, run LangGraph generation.
    3. Delete the promoted pool theme row so it leaves the sidebar.
    """
    try:
        user_uid = uuid.UUID(user_id)
        plan_uid = uuid.UUID(current_plan_id)
        pool_uid = uuid.UUID(pool_theme_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID in path")

    # ── Read current plan + pool theme, capture slot info ──────────
    async with async_session_factory() as session:
        result = await session.execute(
            select(WeeklyPlan).where(
                WeeklyPlan.id == plan_uid,
                WeeklyPlan.user_id == user_uid,
            )
        )
        current_plan = result.scalar_one_or_none()
        if not current_plan:
            raise HTTPException(status_code=404, detail="Current plan not found")

        result = await session.execute(
            select(ThemePool).where(
                ThemePool.id == pool_uid,
                ThemePool.user_id == user_uid,
                ThemePool.is_used == False,
            )
        )
        pool_theme = result.scalar_one_or_none()
        if not pool_theme:
            raise HTTPException(status_code=404, detail="Pool theme not found or already used")

        # Capture the calendar slot of the plan being replaced
        old_slot = {
            "week_number": current_plan.week_number,
            "week_range": current_plan.week_range,
            "year": current_plan.year,
            "month": current_plan.month,
            "week_of_month": current_plan.week_of_month,
        }

        # ── Build a full ThemeSchema-shaped dict for the demoted theme ──
        # WeeklyPlan.circle_time uses CircleTimeSchema keys (letter, shape,
        # color, greeting_song, counting_to, counting_object, letter_word …).
        # The frontend transformer expects ThemeCircleTime keys (greeting_style,
        # counting_context, letter_examples, movement_prompt, color).
        ct = current_plan.circle_time or {}
        greeting_song = ct.get("greeting_song") or {}
        domains = current_plan.domains or []

        # Clean theme name: strip AI-generated subtitle (e.g. "Busy Bees: A Sweet Exploration" → "Busy Bees")
        raw_name = current_plan.theme or ""
        clean_name = raw_name.split(":")[0].strip() if ":" in raw_name else raw_name
        clean_id = _re.sub(r"[^a-z0-9-]", "", clean_name.lower().replace(" ", "-"))

        # Recover emoji from the original pool theme if the plan didn't store one
        plan_emoji = current_plan.theme_emoji
        if not plan_emoji:
            clean_lower = clean_name.lower()
            used_result = await session.execute(
                select(ThemePool.theme_data).where(
                    ThemePool.user_id == user_uid,
                    ThemePool.is_used == True,
                    ThemePool.plan_id.is_(None),
                )
            )
            for (td,) in used_result:
                if (td or {}).get("name", "").lower() == clean_lower:
                    plan_emoji = td.get("emoji", "")
                    break
        plan_emoji = plan_emoji or "📁"

        demoted_theme_data = {
            "id": clean_id,
            "name": clean_name,
            "emoji": plan_emoji,
            "letter": ct.get("letter", ""),
            "shape": ct.get("shape", ""),
            "mood": ", ".join(domains) if domains else "",
            "atmosphere": domains[:4],
            "visual_direction": "",
            "palette": current_plan.palette or {},
            "circle_time": {
                "greeting_style": greeting_song.get("title", ""),
                "counting_context": ct.get("counting_object", ""),
                "letter_examples": [w for w in [ct.get("letter_word", "")] if w],
                "movement_prompt": ct.get("discussion_prompt", ""),
                "color": ct.get("color", ""),
            },
            "activities": [
                {
                    "title": a.get("title", ""),
                    "description": a.get("description", ""),
                    "materials": a.get("materials", []),
                }
                for a in (current_plan.activities or [])[:4]
            ],
            "environment": {
                "description": f"Saved curriculum plan: {current_plan.theme or 'Unknown'}",
                "visual_elements": [],
                "ambiance": "",
            },
        }

        demoted_row = ThemePool(
            user_id=user_uid,
            theme_data=demoted_theme_data,
            is_used=False,
            plan_id=current_plan.id,
        )
        session.add(demoted_row)

        # Snapshot promotion info before mutating
        existing_plan_id = pool_theme.plan_id
        pool_theme_data = pool_theme.theme_data

        # ── Unschedule the current plan (free the calendar slot) ──
        # Keep the row alive so JSON + GCS assets survive for resurrection.
        current_plan.week_number = None
        current_plan.year = None
        current_plan.month = None
        current_plan.week_of_month = None
        current_plan.week_range = None

        # Delete the promoted pool theme row (it's leaving the sidebar)
        await session.delete(pool_theme)
        await session.commit()

    # ── Promote: reuse existing plan or generate a new one ─────────

    # A pool slot was consumed — refill in the background regardless of path
    await enqueue_theme_refill(user_uid)

    if existing_plan_id:
        # The promoted pool theme already has a generated plan (sleeping/
        # unscheduled).  Resurrect it by applying the freed calendar slot.
        logger.info("Swap: resurrecting sleeping plan %s for pool theme %s",
                     existing_plan_id, pool_theme_id)
        async with async_session_factory() as session:
            result = await session.execute(
                select(WeeklyPlan).where(WeeklyPlan.id == existing_plan_id)
            )
            promoted_plan = result.scalar_one_or_none()
            if promoted_plan:
                promoted_plan.week_number = old_slot["week_number"]
                promoted_plan.week_range = old_slot["week_range"]
                promoted_plan.year = old_slot["year"]
                promoted_plan.month = old_slot["month"]
                promoted_plan.week_of_month = old_slot["week_of_month"]
                await session.commit()
            else:
                logger.warning("Swap: sleeping plan %s not found, falling through to generation",
                               existing_plan_id)
                existing_plan_id = None  # fall through to generation below

    if existing_plan_id:
        return {
            "status": "existing",
            "plan_id": str(existing_plan_id),
        }

    # Generate a brand-new plan in the old slot
    logger.info("Swap: generating new plan for pool theme %s", pool_theme_id)

    try:
        graph_app = build_planner_graph()
        initial_state = {
            "user_id": user_id,
            "thread_id": str(uuid.uuid4()),
            "selected_theme": pool_theme_data,
            "week_number": old_slot["week_number"],
            "week_range": old_slot["week_range"],
            "year": old_slot["year"],
            "month": old_slot["month"],
            "week_of_month": old_slot["week_of_month"],
            "iteration_count": 0,
        }
        final_state = await graph_app.ainvoke(initial_state)
        plan = final_state.get("personalized_plan") or final_state.get("draft_plan")
        if not plan:
            raise HTTPException(
                status_code=500,
                detail=final_state.get("error") or "Pipeline produced no usable plan.",
            )
        saved_plan_id = final_state.get("saved_plan_id")
        return {
            "status": "generated",
            "plan_id": str(saved_plan_id) if saved_plan_id else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Plan generation failed: {e}")


@router.get("/{user_id}/plans")
async def list_plans(user_id: str):
    """List all saved plans for a user, ordered by creation date descending."""
    try:
        user_uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id")

    async with async_session_factory() as session:
        result = await session.execute(
            select(WeeklyPlan)
            .where(
                WeeklyPlan.user_id == user_uid,
                WeeklyPlan.week_number.isnot(None),  # exclude unscheduled (demoted) plans
            )
            .order_by(WeeklyPlan.created_at.desc())
        )
        plans = result.scalars().all()

    return [
        {
            "id": str(p.id),
            "global_week_number": p.week_number,
            "week_of_month": p.week_of_month,
            "month": p.month,
            "year": p.year,
            "theme": p.theme,
            "theme_emoji": p.theme_emoji,
            "week_range": p.week_range,
            "palette": p.palette,
            "domains": p.domains,
            "pdf_url": p.pdf_url,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in plans
    ]


@router.patch("/{user_id}/plans/reorder")
async def reorder_plans(user_id: str, updates: list[PlanPositionUpdate]):
    """Reorder plans to match the client-supplied sequence of plan IDs.

    The server recomputes all date fields (week_number, week_range, year,
    month, week_of_month) so Curriculum Week N always maps to
    today + (N-1) calendar weeks.

    Uses a two-phase update to avoid unique-constraint violations.
    """
    try:
        user_uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id")

    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")

    plan_uids = []
    for u in updates:
        try:
            plan_uids.append(uuid.UUID(u.plan_id))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid plan_id: {u.plan_id}")

    async with async_session_factory() as session:
        # Verify all plans belong to this user
        result = await session.execute(
            select(WeeklyPlan.id).where(
                WeeklyPlan.id.in_(plan_uids),
                WeeklyPlan.user_id == user_uid,
            )
        )
        found_ids = {row[0] for row in result.all()}
        missing = [str(uid) for uid in plan_uids if uid not in found_ids]
        if missing:
            raise HTTPException(status_code=404, detail=f"Plans not found: {missing}")

        # ── Phase 1: vacate unique slots with temporary negative week_numbers ──
        for i, uid in enumerate(plan_uids):
            await session.execute(
                sa_update(WeeklyPlan)
                .where(WeeklyPlan.id == uid, WeeklyPlan.user_id == user_uid)
                .values(week_number=-(i + 1))
            )
        await session.flush()

        # ── Phase 2: assign sequential 1-based numbers with server-computed dates ──
        today = date.today()
        for new_num, uid in enumerate(plan_uids, start=1):
            info = _compute_week_info(today=today + timedelta(weeks=new_num - 1))
            await session.execute(
                sa_update(WeeklyPlan)
                .where(WeeklyPlan.id == uid, WeeklyPlan.user_id == user_uid)
                .values(
                    week_number=new_num,
                    week_range=info["week_range"],
                    year=info["year"],
                    month=info["month"],
                    week_of_month=info["week_of_month"],
                )
            )

        await session.commit()
        logger.info(
            "Reordered %d plans for user %s", len(updates), user_id
        )

    # Return the updated plan summaries (exclude unscheduled plans)
    async with async_session_factory() as session:
        result = await session.execute(
            select(WeeklyPlan)
            .where(
                WeeklyPlan.user_id == user_uid,
                WeeklyPlan.week_number.isnot(None),
            )
            .order_by(WeeklyPlan.week_number)
        )
        plans = result.scalars().all()

    return [
        {
            "id": str(p.id),
            "global_week_number": p.week_number,
            "week_of_month": p.week_of_month,
            "month": p.month,
            "year": p.year,
            "theme": p.theme,
            "theme_emoji": p.theme_emoji,
            "week_range": p.week_range,
            "palette": p.palette,
            "domains": p.domains,
            "pdf_url": p.pdf_url,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in plans
    ]


@router.get("/{user_id}/plan/{plan_id}")
async def get_plan(user_id: str, plan_id: str):
    """Fetch a full plan by its UUID."""
    try:
        user_uid = uuid.UUID(user_id)
        plan_uid = uuid.UUID(plan_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id or plan_id")

    async with async_session_factory() as session:
        result = await session.execute(
            select(WeeklyPlan).where(
                WeeklyPlan.id == plan_uid,
                WeeklyPlan.user_id == user_uid,
            )
        )
        plan_row = result.scalar_one_or_none()

    if not plan_row:
        raise HTTPException(status_code=404, detail="Plan not found.")

    return {
        "id": str(plan_row.id),
        "week_number": plan_row.week_number,
        "week_of_month": plan_row.week_of_month,
        "month": plan_row.month,
        "year": plan_row.year,
        "week_range": plan_row.week_range,
        "theme": plan_row.theme,
        "theme_emoji": plan_row.theme_emoji,
        "palette": plan_row.palette,
        "domains": plan_row.domains,
        "objectives": plan_row.objectives,
        "circle_time": plan_row.circle_time,
        "daily_plans": _rebuild_daily_plans(plan_row.activities or []),
        "newsletter": plan_row.newsletter,
        "cover_image_url": plan_row.cover_image_url,
        "pdf_url": plan_row.pdf_url,
        "material_urls": plan_row.material_urls,
        "schedule": plan_row.schedule,
    }


@router.delete("/{user_id}/plan/{plan_id}")
async def delete_plan(user_id: str, plan_id: str):
    """Delete a plan and renumber all remaining plans sequentially (1, 2, 3 …).

    After renumbering, each plan's week_range / year / month / week_of_month
    is recomputed so plan N represents the Nth week starting from today.
    """
    try:
        user_uid = uuid.UUID(user_id)
        plan_uid = uuid.UUID(plan_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id or plan_id")

    async with async_session_factory() as session:
        # Verify plan exists and belongs to this user
        result = await session.execute(
            select(WeeklyPlan).where(
                WeeklyPlan.id == plan_uid,
                WeeklyPlan.user_id == user_uid,
            )
        )
        plan_row = result.scalar_one_or_none()
        if not plan_row:
            raise HTTPException(status_code=404, detail="Plan not found.")

        # Clean up ALL GCS assets via prefix-based deletion
        try:
            deleted_count = delete_plan_assets_from_gcs(plan_uid)
            logger.info("Deleted %d GCS blobs for plan %s", deleted_count, plan_id)
        except Exception as e:
            logger.warning("GCS cleanup failed for plan %s: %s", plan_id, e)

        # Delete it
        await session.delete(plan_row)
        await session.flush()

        # Fetch remaining scheduled plans (exclude unscheduled/demoted ones)
        remaining_result = await session.execute(
            select(WeeklyPlan)
            .where(
                WeeklyPlan.user_id == user_uid,
                WeeklyPlan.week_number.isnot(None),
            )
            .order_by(WeeklyPlan.week_number)
        )
        remaining = remaining_result.scalars().all()

        # ── Phase 1: move to negative temp numbers to free unique slots ──
        for i, p in enumerate(remaining):
            p.week_number = -(i + 1)
        await session.flush()

        # ── Phase 2: assign sequential 1-based numbers with correct week info ──
        today = date.today()
        for new_num, p in enumerate(remaining, start=1):
            info = _compute_week_info(today=today + timedelta(weeks=new_num - 1))
            p.week_number = new_num
            p.week_range = info["week_range"]
            p.year = info["year"]
            p.month = info["month"]
            p.week_of_month = info["week_of_month"]

        await session.commit()
        logger.info(
            "Deleted plan %s for user %s; renumbered %d remaining plans",
            plan_id, user_id, len(remaining),
        )

    return {"deleted": plan_id, "remaining_count": len(remaining)}


@router.get("/{user_id}/week/{week_number}/pdf")
async def download_plan_pdf(user_id: str, week_number: int):
    """Download a previously generated weekly plan as a PDF.

    Fetches the plan from the database, renders it through the
    Jinja2 + WeasyPrint pipeline, and streams the PDF back.
    """
    async with async_session_factory() as session:
        result = await session.execute(
            select(WeeklyPlan).where(
                WeeklyPlan.user_id == user_id,
                WeeklyPlan.week_number == week_number,
            )
        )
        plan_row = result.scalar_one_or_none()

    if not plan_row:
        raise HTTPException(
            status_code=404,
            detail=f"No plan found for user {user_id}, week {week_number}.",
        )

    # Generate or retrieve the AI cover image (just-in-time)
    cover_image_url = await get_or_generate_cover_image(plan_row)

    # Reconstruct the curriculum data dict from the DB row
    curriculum_data = {
        "theme": plan_row.theme,
        "theme_emoji": plan_row.theme_emoji,
        "week_number": plan_row.week_number,
        "week_range": plan_row.week_range,
        "palette": plan_row.palette,
        "domains": plan_row.domains,
        "objectives": plan_row.objectives,
        "circle_time": plan_row.circle_time,
        "daily_plans": _rebuild_daily_plans(plan_row.activities or []),
        "newsletter": plan_row.newsletter,
        "cover_image_url": cover_image_url,
    }

    try:
        pdf_bytes = await generate_weekly_pdf(curriculum_data, plan_id=plan_row.id)
    except Exception as e:
        logger.error("PDF generation failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail=f"PDF generation failed: {e}",
        )

    safe_theme = plan_row.theme.replace(" ", "_") if plan_row.theme else "Plan"
    filename = f"{safe_theme}_Week{week_number}_Curriculum.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{user_id}/plan/{plan_id}/pdf")
async def download_plan_pdf_by_id(user_id: str, plan_id: str):
    """Download a weekly plan PDF by its UUID.

    If a cached PDF exists in GCS, redirects to it.
    Otherwise generates the PDF, uploads to GCS, caches the URL, and serves it.
    """
    try:
        user_uid = uuid.UUID(user_id)
        plan_uid = uuid.UUID(plan_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id or plan_id")

    async with async_session_factory() as session:
        result = await session.execute(
            select(WeeklyPlan).where(
                WeeklyPlan.id == plan_uid,
                WeeklyPlan.user_id == user_uid,
            )
        )
        plan_row = result.scalar_one_or_none()

    if not plan_row:
        raise HTTPException(status_code=404, detail="Plan not found.")

    # ── Return cached PDF if available (proxied to avoid CORS) ─
    if plan_row.pdf_url:
        logger.info("Proxying cached PDF for plan %s from %s", plan_id, plan_row.pdf_url)
        import httpx
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                gcs_resp = await client.get(plan_row.pdf_url)
                gcs_resp.raise_for_status()
            safe_theme = (plan_row.theme or "Plan").replace(" ", "_")
            filename = f"{safe_theme}_Week{plan_row.week_number}_Curriculum.pdf"
            return StreamingResponse(
                io.BytesIO(gcs_resp.content),
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            )
        except Exception as e:
            logger.error("Failed to proxy cached PDF for plan %s: %s — regenerating", plan_id, e)
            # Fall through to regeneration if the GCS fetch fails

    # ── Generate, upload, and cache ────────────────────────
    cover_image_url = await get_or_generate_cover_image(plan_row)

    curriculum_data = {
        "theme": plan_row.theme,
        "theme_emoji": plan_row.theme_emoji,
        "week_number": plan_row.week_number,
        "week_range": plan_row.week_range,
        "palette": plan_row.palette,
        "domains": plan_row.domains,
        "objectives": plan_row.objectives,
        "circle_time": plan_row.circle_time,
        "daily_plans": _rebuild_daily_plans(plan_row.activities or []),
        "newsletter": plan_row.newsletter,
        "cover_image_url": cover_image_url,
    }

    try:
        pdf_bytes = await generate_weekly_pdf(curriculum_data, plan_id=plan_uid)
    except Exception as e:
        logger.error("PDF generation failed for plan %s: %s", plan_id, e)
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}")

    # Upload to GCS and cache URL in DB (best-effort)
    try:
        gcs_url = upload_pdf_to_gcs(pdf_bytes, plan_uid, plan_row.theme or "plan")
        await save_pdf_url(plan_uid, gcs_url)
    except Exception as e:
        logger.error("Failed to cache PDF to GCS for plan %s: %s", plan_id, e)
        # Still serve the generated bytes even if caching fails

    safe_theme = (plan_row.theme or "Plan").replace(" ", "_")
    filename = f"{safe_theme}_Week{plan_row.week_number}_Curriculum.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{user_id}/plan/{plan_id}/pdf/regenerate")
async def regenerate_plan_pdf(user_id: str, plan_id: str):
    """Force-regenerate the PDF for a plan.

    Deletes the existing cached PDF from GCS (if any), generates a fresh one,
    uploads it, and updates the pdf_url in the database.
    Returns the new PDF bytes.
    """
    try:
        user_uid = uuid.UUID(user_id)
        plan_uid = uuid.UUID(plan_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id or plan_id")

    async with async_session_factory() as session:
        result = await session.execute(
            select(WeeklyPlan).where(
                WeeklyPlan.id == plan_uid,
                WeeklyPlan.user_id == user_uid,
            )
        )
        plan_row = result.scalar_one_or_none()

    if not plan_row:
        raise HTTPException(status_code=404, detail="Plan not found.")

    # ── Delete existing cached PDF from GCS ─────────────────
    if plan_row.pdf_url:
        logger.info("Deleting existing cached PDF for plan %s", plan_id)
        delete_pdf_from_gcs(plan_row.pdf_url)

    # ── Generate fresh PDF ──────────────────────────────────
    cover_image_url = await get_or_generate_cover_image(plan_row)

    curriculum_data = {
        "theme": plan_row.theme,
        "theme_emoji": plan_row.theme_emoji,
        "week_number": plan_row.week_number,
        "week_range": plan_row.week_range,
        "palette": plan_row.palette,
        "domains": plan_row.domains,
        "objectives": plan_row.objectives,
        "circle_time": plan_row.circle_time,
        "daily_plans": _rebuild_daily_plans(plan_row.activities or []),
        "newsletter": plan_row.newsletter,
        "cover_image_url": cover_image_url,
    }

    try:
        pdf_bytes = await generate_weekly_pdf(curriculum_data, plan_id=plan_uid)
    except Exception as e:
        logger.error("PDF regeneration failed for plan %s: %s", plan_id, e)
        raise HTTPException(status_code=500, detail=f"PDF regeneration failed: {e}")

    # ── Upload new PDF and cache URL ────────────────────────
    try:
        gcs_url = upload_pdf_to_gcs(pdf_bytes, plan_uid, plan_row.theme or "plan")
        await save_pdf_url(plan_uid, gcs_url)
        logger.info("Regenerated PDF cached at %s", gcs_url)
    except Exception as e:
        logger.error("Failed to cache regenerated PDF for plan %s: %s", plan_id, e)

    safe_theme = (plan_row.theme or "Plan").replace(" ", "_")
    filename = f"{safe_theme}_Week{plan_row.week_number}_Curriculum.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{user_id}/plan/{plan_id}/material/{material_type}")
async def get_material_poster(user_id: str, plan_id: str, material_type: str):
    """Generate or retrieve a themed material poster PDF.

    On first call, generates the PDF (may take 10–30 s for Imagen-based
    types), uploads it to GCS, caches the URL, and returns it.
    Subsequent calls return the cached URL instantly.

    Args:
        material_type: One of 'alphabet', 'number', 'shape', 'color'.

    Returns:
        ``{"url": "https://storage.googleapis.com/..."}``
    """
    if material_type not in VALID_MATERIAL_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid material_type '{material_type}'. "
                   f"Must be one of: {', '.join(sorted(VALID_MATERIAL_TYPES))}",
        )

    try:
        user_uid = uuid.UUID(user_id)
        plan_uid = uuid.UUID(plan_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id or plan_id")

    async with async_session_factory() as session:
        result = await session.execute(
            select(WeeklyPlan).where(
                WeeklyPlan.id == plan_uid,
                WeeklyPlan.user_id == user_uid,
            )
        )
        plan_row = result.scalar_one_or_none()

        if not plan_row:
            raise HTTPException(status_code=404, detail="Plan not found.")

        try:
            url = await get_or_generate_material(plan_row, material_type)
        except Exception as e:
            logger.error("Material generation failed for plan %s, type %s: %s",
                         plan_id, material_type, e, exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Material generation failed: {e}",
            )

    return {"url": url}


# ── Phase 2: Editable Circle Time Songs ─────────────────────


class CircleTimeSongUpdate(BaseModel):
    """Payload for updating a single circle-time song."""
    title: str
    youtube_url: str
    duration: str


class CircleTimeUpdateRequest(BaseModel):
    """Payload for PATCH /circle-time."""
    greeting_song: CircleTimeSongUpdate | None = None
    goodbye_song: CircleTimeSongUpdate | None = None


@router.patch("/{user_id}/plan/{plan_id}/circle-time")
async def update_circle_time(user_id: str, plan_id: str, body: CircleTimeUpdateRequest):
    """Update greeting/goodbye songs and invalidate the cached curriculum PDF."""
    try:
        user_uid = uuid.UUID(user_id)
        plan_uid = uuid.UUID(plan_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id or plan_id")

    async with async_session_factory() as session:
        result = await session.execute(
            select(WeeklyPlan).where(
                WeeklyPlan.id == plan_uid,
                WeeklyPlan.user_id == user_uid,
            )
        )
        plan_row = result.scalar_one_or_none()
        if not plan_row:
            raise HTTPException(status_code=404, detail="Plan not found.")

        circle_time = dict(plan_row.circle_time or {})

        if body.greeting_song:
            gs = circle_time.get("greeting_song", {})
            gs["title"] = body.greeting_song.title
            gs["youtube_url"] = body.greeting_song.youtube_url
            gs["duration"] = body.greeting_song.duration
            circle_time["greeting_song"] = gs

        if body.goodbye_song:
            gbs = circle_time.get("goodbye_song", {})
            gbs["title"] = body.goodbye_song.title
            gbs["youtube_url"] = body.goodbye_song.youtube_url
            gbs["duration"] = body.goodbye_song.duration
            circle_time["goodbye_song"] = gbs

        # Cache invalidation: delete old curriculum PDF from GCS
        if plan_row.pdf_url:
            logger.info("Invalidating cached PDF for plan %s", plan_id)
            try:
                delete_pdf_from_gcs(plan_row.pdf_url)
            except Exception as e:
                logger.warning("Failed to delete cached PDF: %s", e)

        await session.execute(
            sa_update(WeeklyPlan)
            .where(WeeklyPlan.id == plan_uid)
            .values(circle_time=circle_time, pdf_url=None)
        )
        await session.commit()

    logger.info("Updated circle-time songs for plan %s", plan_id)
    return {"status": "updated", "circle_time": circle_time}


# ── Phase 7: Two-Way Schedule Sync ─────────────────────────


class ScheduleBlockPayload(BaseModel):
    """A single timed schedule block from the mobile editor."""
    id: str
    startTime: str
    endTime: str
    title: str
    description: str
    category: str
    notes: str | None = None


class UpdateScheduleRequest(BaseModel):
    """Payload for PATCH /schedule — full schedule keyed by weekId."""
    schedule: dict[str, list[ScheduleBlockPayload]]


@router.patch("/{user_id}/plan/{plan_id}/schedule")
async def update_schedule(user_id: str, plan_id: str, body: UpdateScheduleRequest):
    """Persist the user-edited daily schedule blocks to the database."""
    try:
        user_uid = uuid.UUID(user_id)
        plan_uid = uuid.UUID(plan_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id or plan_id")

    # Serialize Pydantic models to plain dicts for JSONB storage
    schedule_data = {
        key: [block.model_dump() for block in blocks]
        for key, blocks in body.schedule.items()
    }

    async with async_session_factory() as session:
        result = await session.execute(
            select(WeeklyPlan).where(
                WeeklyPlan.id == plan_uid,
                WeeklyPlan.user_id == user_uid,
            )
        )
        plan_row = result.scalar_one_or_none()
        if not plan_row:
            raise HTTPException(status_code=404, detail="Plan not found.")

        await session.execute(
            sa_update(WeeklyPlan)
            .where(WeeklyPlan.id == plan_uid)
            .values(schedule=schedule_data)
        )
        await session.commit()

    logger.info("Updated schedule for plan %s", plan_id)
    return {"status": "updated", "schedule": schedule_data}


# ── Activity Edit (Chat Assistant) ──────────────────────────


class ActivityEditRequest(BaseModel):
    """Partial activity update — only changed fields."""
    activity_id: str
    title: str | None = None
    domain: str | None = None
    duration: int | None = None
    description: str | None = None
    theme_connection: str | None = None
    materials: list[str] | None = None
    safety_notes: str | None = None
    adaptations: list[dict] | None = None
    reflection_prompts: list[str] | None = None


@router.patch("/{user_id}/plan/{plan_id}/activity/{activity_id}")
async def patch_activity(
    user_id: str, plan_id: str, activity_id: str, body: ActivityEditRequest
):
    """Merge partial edits onto an existing activity in the plan JSONB."""
    from app.services.chat_service import apply_activity_edit

    if body.activity_id != activity_id:
        raise HTTPException(
            status_code=400,
            detail="activity_id in body must match URL parameter.",
        )

    try:
        uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id")

    edits = body.model_dump(exclude_none=True)
    updated = await apply_activity_edit(user_id, plan_id, activity_id, edits)
    if not updated:
        raise HTTPException(status_code=404, detail="Activity not found in plan.")

    logger.info("Patched activity %s in plan %s", activity_id, plan_id)
    return {"status": "updated", "activity": updated}


# ── Phase 3: Bulk PDF Export ────────────────────────────────


# Static material GCS URLs (same as frontend constants)
_STATIC_MATERIAL_URLS: dict[str, tuple[str, str]] = {
    "days_of_the_week": (
        "Days of the Week",
        "https://storage.googleapis.com/early-nurturer-planner-assets/static-materials/days_of_the_week.pdf",
    ),
    "months_of_the_year": (
        "Months of the Year",
        "https://storage.googleapis.com/early-nurturer-planner-assets/static-materials/months_of_the_year.pdf",
    ),
    "weather": (
        "Types of Weather",
        "https://storage.googleapis.com/early-nurturer-planner-assets/static-materials/weather.pdf",
    ),
}

# Combined valid types for bulk export
_ALL_BULK_TYPES = VALID_MATERIAL_TYPES | set(_STATIC_MATERIAL_URLS.keys())


class BulkExportRequest(BaseModel):
    material_types: list[str]


@router.post("/{user_id}/plan/{plan_id}/materials/bulk-export")
async def bulk_export_materials(user_id: str, plan_id: str, body: BulkExportRequest):
    """Merge selected material PDFs into one download.

    Supports dynamic types (alphabet, number, shape, color) and static
    types (days_of_the_week, months_of_the_year, weather).
    Degrades gracefully — if one dynamic PDF fails, the rest are still merged.
    """
    import httpx as _httpx
    from pypdf import PdfWriter, PdfReader

    requested = body.material_types
    if not requested:
        raise HTTPException(status_code=400, detail="No material_types provided")

    invalid = [t for t in requested if t not in _ALL_BULK_TYPES]
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid types: {invalid}. Valid: {sorted(_ALL_BULK_TYPES)}",
        )

    try:
        user_uid = uuid.UUID(user_id)
        plan_uid = uuid.UUID(plan_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id or plan_id")

    async with async_session_factory() as session:
        result = await session.execute(
            select(WeeklyPlan).where(
                WeeklyPlan.id == plan_uid,
                WeeklyPlan.user_id == user_uid,
            )
        )
        plan_row = result.scalar_one_or_none()
        if not plan_row:
            raise HTTPException(status_code=404, detail="Plan not found.")

        pdf_buffers: list[tuple[str, bytes]] = []

        async with _httpx.AsyncClient(timeout=30.0, follow_redirects=True) as http:
            for mat_type in requested:
                try:
                    if mat_type in VALID_MATERIAL_TYPES:
                        # Dynamic: generate or fetch from cache
                        url = await get_or_generate_material(plan_row, mat_type)
                        resp = await http.get(url)
                        resp.raise_for_status()
                        pdf_buffers.append((mat_type, resp.content))
                    else:
                        # Static: download from known GCS URL
                        label, static_url = _STATIC_MATERIAL_URLS[mat_type]
                        resp = await http.get(static_url)
                        resp.raise_for_status()
                        pdf_buffers.append((mat_type, resp.content))
                except Exception as e:
                    logger.error(
                        "Bulk export: failed to get '%s' for plan %s: %s",
                        mat_type, plan_id, e,
                    )
                    # Graceful degradation — skip this one

    if not pdf_buffers:
        raise HTTPException(
            status_code=500,
            detail="All requested materials failed to generate.",
        )

    # Merge PDFs with pypdf
    writer = PdfWriter()
    for _label, pdf_bytes in pdf_buffers:
        try:
            reader = PdfReader(io.BytesIO(pdf_bytes))
            for page in reader.pages:
                writer.add_page(page)
        except Exception as e:
            logger.error("Bulk export: failed to merge '%s': %s", _label, e)

    merged_buf = io.BytesIO()
    writer.write(merged_buf)
    merged_buf.seek(0)

    # Build filename
    safe_theme = (plan_row.theme or "Plan").replace(" ", "_")
    if len(pdf_buffers) == 1:
        # Single item — use its name
        single_type = pdf_buffers[0][0]
        if single_type in _STATIC_MATERIAL_URLS:
            name = _STATIC_MATERIAL_URLS[single_type][0].replace(" ", "_")
        else:
            name = single_type.capitalize()
        filename = f"{name}.pdf"
    else:
        filename = f"{safe_theme}_Materials_Bundle.pdf"

    return StreamingResponse(
        merged_buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _rebuild_daily_plans(activities: list[dict]) -> list[dict]:
    """Group the flat activities list back into daily_plans structure.

    The DB stores activities as a flat list; this reconstructs the
    DailyPlanSchema-style nested structure grouped by day.
    """
    days_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    day_map: dict[str, list[dict]] = {d: [] for d in days_order}

    for activity in activities:
        day = activity.get("day", "Monday")
        if day in day_map:
            day_map[day].append(activity)
        else:
            day_map.setdefault(day, []).append(activity)

    daily_plans = []
    for day_name in days_order:
        acts = day_map.get(day_name, [])
        if acts:
            daily_plans.append({
                "day": day_name,
                "focus_domain": acts[0].get("domain", ""),
                "activities": acts,
            })

    return daily_plans
