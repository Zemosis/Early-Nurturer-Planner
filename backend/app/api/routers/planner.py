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

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select

from app.agents.graph import build_planner_graph
from app.db.database import async_session_factory
from app.db.models import WeeklyPlan
from app.services.image_service import get_or_generate_cover_image
from app.services.pdf_service import generate_weekly_pdf

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/planner", tags=["Planner"])


# ── Request schema ────────────────────────────────────────────


class GeneratePlanRequest(BaseModel):
    """Payload for the curriculum generation endpoint."""

    user_id: str
    selected_theme: dict
    week_number: int = 1
    week_range: str = ""


# ── Endpoints ─────────────────────────────────────────────────


@router.post("/generate")
async def generate_plan(request: GeneratePlanRequest):
    """Trigger the full Architect → Auditor → Personalizer pipeline.

    Compiles the LangGraph, invokes it with the provided theme and
    educator context, and returns the personalised weekly plan.

    Returns:
        A dict with status and the personalised plan.
    """
    try:
        graph_app = build_planner_graph()

        initial_state = {
            "user_id": request.user_id,
            "thread_id": str(uuid.uuid4()),
            "selected_theme": request.selected_theme,
            "week_number": request.week_number,
            "week_range": request.week_range,
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
            # Surface the real upstream error (architect/auditor failure)
            # rather than the generic save-node message.
            real_error = final_state.get("error") or "Pipeline produced no usable plan."
            logger.error("Pipeline failed — no plan in state. error=%s", real_error)
            raise HTTPException(
                status_code=500,
                detail=real_error,
            )

        # Plan exists — return it. Log any non-critical pipeline error
        # (e.g. DB save failure) but don't block the user.
        if final_state.get("error"):
            logger.warning(
                "Pipeline completed with non-fatal error: %s",
                final_state["error"],
            )

        return {
            "status": "success",
            "plan": plan,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Plan generation failed: {e}",
        )


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
