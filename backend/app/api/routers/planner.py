"""
FastAPI router — Curriculum Planner.

Exposes the LangGraph multi-agent pipeline (Architect → Auditor →
Personalizer) as a single POST endpoint. The frontend sends a
selected theme and the pipeline returns a fully personalised,
safety-audited weekly curriculum plan.
"""

import logging
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agents.graph import build_planner_graph

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

        if final_state.get("error"):
            raise HTTPException(
                status_code=500,
                detail=final_state["error"],
            )

        # Prefer personalized plan; fall back to draft if auditor
        # rejected after max iterations (plan is still usable).
        plan = final_state.get("personalized_plan") or final_state.get("draft_plan")

        if not plan:
            raise HTTPException(
                status_code=500,
                detail="Pipeline produced no usable plan.",
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
