"""
FastAPI router — Curriculum Planner.

Exposes the LangGraph multi-agent pipeline (Architect → Auditor →
Personalizer) as a single POST endpoint. The frontend sends a
selected theme and the pipeline returns a fully personalised,
safety-audited weekly curriculum plan.
"""

import io
import logging
import uuid
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, func, update as sa_update

from app.agents.graph import build_planner_graph
from app.db.database import async_session_factory
from app.db.models import WeeklyPlan, ThemePool
from app.services.image_service import get_or_generate_cover_image
from app.services.pdf_service import generate_weekly_pdf, upload_pdf_to_gcs, save_pdf_url, delete_pdf_from_gcs

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/planner", tags=["Planner"])


# ── Request schema ────────────────────────────────────────────


class GeneratePlanRequest(BaseModel):
    """Payload for the curriculum generation endpoint."""

    user_id: str
    selected_theme: dict
    theme_pool_id: str | None = None  # UUID of the theme in the pool (to mark as used)


class PlanPositionUpdate(BaseModel):
    """A single plan's new positional fields for the reorder endpoint."""

    plan_id: str
    week_number: int
    week_range: str
    year: int
    month: int
    week_of_month: int


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


@router.post("/generate")
async def generate_plan(request: GeneratePlanRequest):
    """Trigger the full Architect → Auditor → Personalizer pipeline.

    Auto-computes calendar week info from today's date.
    Marks the selected theme as used in the pool (if theme_pool_id given).

    Returns:
        A dict with status, the personalised plan, and the saved plan_id.
    """
    try:
        user_uid = uuid.UUID(request.user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id")

    # Compute calendar week info
    week_info = _compute_week_info()

    # Compute global week number (max existing + 1)
    async with async_session_factory() as session:
        result = await session.execute(
            select(func.coalesce(func.max(WeeklyPlan.week_number), 0))
            .where(WeeklyPlan.user_id == user_uid)
        )
        global_week_number = result.scalar() + 1

        # Mark theme as used in pool (if pool ID provided)
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
                    pool_theme.is_used = True
                    await session.commit()
            except Exception as e:
                logger.warning("Failed to mark pool theme as used: %s", e)

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
            .where(WeeklyPlan.user_id == user_uid)
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
    """Swap positional fields (week_number, week_range, year, month, week_of_month)
    across a set of plans in a single atomic transaction.

    Uses a two-phase update to avoid unique-constraint violations:
      Phase 1 — set each plan's week_number to a temporary negative value
      Phase 2 — set each plan's week_number (and other fields) to the target
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
        for i, u in enumerate(updates):
            temp_num = -(i + 1)
            await session.execute(
                sa_update(WeeklyPlan)
                .where(WeeklyPlan.id == uuid.UUID(u.plan_id), WeeklyPlan.user_id == user_uid)
                .values(week_number=temp_num)
            )
        await session.flush()

        # ── Phase 2: apply target positional values ──
        for u in updates:
            await session.execute(
                sa_update(WeeklyPlan)
                .where(WeeklyPlan.id == uuid.UUID(u.plan_id), WeeklyPlan.user_id == user_uid)
                .values(
                    week_number=u.week_number,
                    week_range=u.week_range,
                    year=u.year,
                    month=u.month,
                    week_of_month=u.week_of_month,
                )
            )

        await session.commit()
        logger.info(
            "Reordered %d plans for user %s", len(updates), user_id
        )

    # Return the updated plan summaries
    async with async_session_factory() as session:
        result = await session.execute(
            select(WeeklyPlan)
            .where(WeeklyPlan.user_id == user_uid)
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
    }


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
        pdf_bytes = await generate_weekly_pdf(curriculum_data)
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
        pdf_bytes = await generate_weekly_pdf(curriculum_data)
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
        pdf_bytes = await generate_weekly_pdf(curriculum_data)
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
