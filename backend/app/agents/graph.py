"""
LangGraph pipeline — Curriculum Planner Graph (Phase 3: 2-Way Split).

Graph topology:
    START → fetch_context → master_architect → parallel_generate → assemble_plan → save → END

The parallel_generate node runs two coroutines concurrently via asyncio.gather:
  1. generate_days   — all 5 daily plans with personalization baked in
  2. enrich_circle_time — YouTube songs + DB yoga poses on the skeleton's circle_time

The auditor and personalizer nodes are bypassed (safety enforced via system prompts).
"""

import asyncio
import copy
import json
import logging
import uuid

from langgraph.graph import END, START, StateGraph
from pydantic import TypeAdapter
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.agents.architect import master_architect, generate_days
from app.agents.youtube_enricher import enrich_circle_time
from app.agents.schemas import WeekPlanSchema
from app.agents.state import PlannerState
from app.agents.tools import fetch_student_context, query_pedagogy
from app.db.database import async_session_factory
from app.db.models import AgentReasoningLog, CritiqueHistory, WeeklyPlan

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════
#  NODE: Fetch Context
# ══════════════════════════════════════════════════════════════


async def fetch_context_node(state: PlannerState) -> dict:
    """Populate student_context and pedagogy_context from the DB.

    Calls fetch_student_context() with the educator's user_id and
    query_pedagogy() with the theme name to ground the Architect.
    """
    user_id = state.get("user_id", "")
    selected_theme = state.get("selected_theme", {})
    theme_name = selected_theme.get("name", "early childhood activities")

    logger.info("FetchContext: fetching for user=%s, theme=%s", user_id, theme_name)

    student_coro = fetch_student_context(user_id)
    pedagogy_coro = query_pedagogy(
        f"curriculum activities for '{theme_name}' theme with infants and toddlers"
    )

    results = await asyncio.gather(
        student_coro, pedagogy_coro, return_exceptions=True
    )

    # Handle partial failures gracefully
    if isinstance(results[0], Exception):
        logger.error("FetchContext: student fetch failed — %s", results[0])
        student_ctx = "No student data available."
    else:
        student_ctx = results[0]

    if isinstance(results[1], Exception):
        logger.error("FetchContext: pedagogy fetch failed — %s", results[1])
        pedagogy_ctx = "No pedagogy data available."
    else:
        pedagogy_ctx = results[1]

    return {
        "student_context": student_ctx,
        "pedagogy_context": pedagogy_ctx,
        "error": None,
    }


# ══════════════════════════════════════════════════════════════
#  NODE: Save Plan
# ══════════════════════════════════════════════════════════════


async def save_plan_node(state: PlannerState) -> dict:
    """Persist the final plan, critique history, and reasoning log to Postgres.

    - Saves personalized_plan → weekly_plans table (upsert on year/month/week_of_month)
    - Saves audit_result → critique_history table
    - Logs pipeline completion → agent_reasoning_logs table
    - Returns saved_plan_id so the API can pass it to the frontend
    """
    personalized_plan = state.get("personalized_plan")
    draft_plan = state.get("draft_plan")
    audit_result = state.get("audit_result")
    user_id_str = state.get("user_id", "")
    thread_id = state.get("thread_id", str(uuid.uuid4()))
    iteration_count = state.get("iteration_count", 0)

    # Calendar fields from state (set by the planner endpoint)
    year = state.get("year", 2026)
    month = state.get("month", 1)
    week_of_month = state.get("week_of_month", 1)

    # Use personalized_plan if available, fall back to draft_plan
    final_plan = personalized_plan or draft_plan

    logger.info("save_plan_node: personalized=%s, draft=%s, user=%s, year=%s, month=%s, wom=%s",
                personalized_plan is not None, draft_plan is not None,
                user_id_str, year, month, week_of_month)

    if not final_plan:
        logger.warning("Save: no plan available (personalized=%s, draft=%s)",
                       personalized_plan is not None, draft_plan is not None)
        return {"error": "No plan available to save."}

    try:
        user_uid = uuid.UUID(user_id_str)
    except (ValueError, AttributeError):
        return {"error": f"Invalid user_id: {user_id_str}"}

    # ── Flatten daily_plans → activities list for DB column ───
    activities_flat = []
    for day_plan in final_plan.get("daily_plans", []):
        for activity in day_plan.get("activities", []):
            activities_flat.append(activity)

    try:
        async with async_session_factory() as session:
            # ── 1. Upsert weekly plan (one plan per user per calendar week) ──
            week_num = state.get("week_number", final_plan.get("week_number", 1))
            plan_id = uuid.uuid4()
            stmt = pg_insert(WeeklyPlan).values(
                id=plan_id,
                user_id=user_uid,
                week_number=week_num,
                year=year,
                month=month,
                week_of_month=week_of_month,
                week_range=final_plan.get("week_range", state.get("week_range", "")),
                theme=final_plan.get("theme", ""),
                theme_emoji=final_plan.get("theme_emoji"),
                palette=final_plan.get("palette"),
                domains=final_plan.get("domains"),
                objectives=final_plan.get("objectives"),
                circle_time=final_plan.get("circle_time"),
                activities=activities_flat,
                newsletter=final_plan.get("newsletter"),
                is_generated=True,
            )
            stmt = stmt.on_conflict_do_update(
                constraint="uq_weekly_plans_user_week_number",
                set_={
                    "week_number": stmt.excluded.week_number,
                    "week_range": stmt.excluded.week_range,
                    "theme": stmt.excluded.theme,
                    "theme_emoji": stmt.excluded.theme_emoji,
                    "palette": stmt.excluded.palette,
                    "domains": stmt.excluded.domains,
                    "objectives": stmt.excluded.objectives,
                    "circle_time": stmt.excluded.circle_time,
                    "activities": stmt.excluded.activities,
                    "newsletter": stmt.excluded.newsletter,
                    "is_generated": stmt.excluded.is_generated,
                },
            )
            result = await session.execute(stmt)
            logger.info("Upsert: saved plan for %d/%d week %d (global #%d)",
                        year, month, week_of_month, week_num)

            # Fetch the actual ID (could be existing row on conflict)
            row = await session.execute(
                select(WeeklyPlan.id).where(
                    WeeklyPlan.user_id == user_uid,
                    WeeklyPlan.year == year,
                    WeeklyPlan.month == month,
                    WeeklyPlan.week_of_month == week_of_month,
                )
            )
            saved_id = row.scalar()

            # ── 2. Save critique history ──────────────────────
            if audit_result:
                critique_row = CritiqueHistory(
                    thread_id=thread_id,
                    round_number=iteration_count,
                    architect_proposal=json.dumps(draft_plan) if draft_plan else "{}",
                    auditor_feedback=audit_result.get("critique", ""),
                    resolution=json.dumps(final_plan),
                    accepted=audit_result.get("accepted", False),
                    scores=audit_result.get("scores"),
                )
                session.add(critique_row)

            # ── 3. Log pipeline completion ────────────────────
            reasoning_log = AgentReasoningLog(
                thread_id=thread_id,
                agent_name="save",
                internal_monologue=(
                    f"Pipeline completed after {iteration_count} architect "
                    f"iteration(s). Plan accepted: "
                    f"{audit_result.get('accepted', False) if audit_result else 'N/A'}. "
                    f"Personalized: {personalized_plan is not None}."
                ),
                input_summary=f"thread={thread_id}, user={user_id_str}",
                output_summary=f"Saved week {week_num} "
                               f"plan for theme '{final_plan.get('theme')}'.",
            )
            session.add(reasoning_log)

            await session.commit()

        return {
            "error": None,
            "saved_plan_id": str(saved_id) if saved_id else str(plan_id),
        }

    except Exception as e:
        logger.exception("save_plan_node FAILED: %s", e)
        return {"error": f"Save failed: {e}"}


# ══════════════════════════════════════════════════════════════
#  NODE: Parallel Generate (day architect + YouTube enricher)
# ══════════════════════════════════════════════════════════════


async def parallel_generate_node(state: PlannerState) -> dict:
    """Run day generation and YouTube/yoga enrichment concurrently.

    Uses asyncio.gather with return_exceptions=True so that one failure
    doesn't cancel the other. Day generation failure is fatal; enrichment
    failure is gracefully degraded (plan proceeds without enrichment).
    """
    skeleton = state.get("master_skeleton")
    if not skeleton:
        return {"error": "parallel_generate: no master_skeleton in state."}

    student_ctx = state.get("student_context", "No student data available.")
    pedagogy_ctx = state.get("pedagogy_context", "No pedagogy data available.")

    # Deep-copy circle_time so enrich_circle_time can mutate it safely
    circle_time_copy = copy.deepcopy(skeleton.get("circle_time", {}))
    theme = skeleton.get("theme", "")

    days_coro = generate_days(skeleton, student_ctx, pedagogy_ctx)
    yt_coro = enrich_circle_time(circle_time_copy, theme)

    logger.info("ParallelGenerate: launching day architect + enricher concurrently")
    results = await asyncio.gather(days_coro, yt_coro, return_exceptions=True)

    # ── Safeguard #1: explicitly check for Exception objects ──
    days_result = results[0]
    yt_result = results[1]

    if isinstance(days_result, Exception):
        logger.error("ParallelGenerate: day generation FAILED — %s", days_result)
        return {
            "daily_plans_raw": None,
            "enriched_circle_time": None,
            "error": f"Day generation failed: {days_result}",
        }

    if isinstance(yt_result, Exception):
        logger.warning("ParallelGenerate: enrichment failed, continuing without — %s", yt_result)
        enriched_ct = None
    else:
        enriched_ct = yt_result

    logger.info("ParallelGenerate: got %d daily plans, enrichment=%s",
                len(days_result), enriched_ct is not None)

    return {
        "daily_plans_raw": days_result,
        "enriched_circle_time": enriched_ct,
        "error": None,
    }


# ══════════════════════════════════════════════════════════════
#  NODE: Assemble Plan (merge skeleton + days + enrichment)
# ══════════════════════════════════════════════════════════════


async def assemble_plan_node(state: PlannerState) -> dict:
    """Merge master_skeleton + daily_plans_raw + enriched_circle_time into a
    complete WeekPlanSchema dict and write it to draft_plan.

    Validates the assembled plan through Pydantic to catch any structural
    issues before saving.
    """
    skeleton = state.get("master_skeleton")
    daily_plans = state.get("daily_plans_raw")
    enriched_ct = state.get("enriched_circle_time")

    if not skeleton:
        return {"error": "assemble_plan: no master_skeleton in state."}
    if not daily_plans:
        return {"error": "assemble_plan: no daily_plans_raw in state."}

    # Build the full plan dict
    plan = {**skeleton}
    plan["daily_plans"] = daily_plans

    # Apply enriched circle_time if YouTube/yoga enrichment succeeded
    if enriched_ct:
        plan["circle_time"] = enriched_ct

    # Validate the assembled plan through Pydantic (Safeguard #3: pure dict)
    try:
        adapter = TypeAdapter(WeekPlanSchema)
        validated = adapter.validate_python(plan)
        final_plan = validated.model_dump(mode="json")
    except Exception as e:
        logger.error("AssemblePlan: Pydantic validation failed — %s", e)
        # Fall back to raw dict if validation fails (better than no plan)
        logger.warning("AssemblePlan: falling back to unvalidated plan dict")
        final_plan = plan

    logger.info("AssemblePlan: assembled plan for theme '%s' with %d days",
                final_plan.get("theme", "?"), len(final_plan.get("daily_plans", [])))

    return {
        "draft_plan": final_plan,
        "error": None,
    }


# ══════════════════════════════════════════════════════════════
#  GRAPH BUILDER
# ══════════════════════════════════════════════════════════════


def build_planner_graph():
    """Compile the Phase 3 Map-Reduce planner graph.

    Pipeline:
        fetch_context → master_architect → parallel_generate → assemble_plan → save

    Returns a compiled StateGraph ready to be invoked with:
        graph = build_planner_graph()
        result = await graph.ainvoke({
            "user_id": "...",
            "thread_id": "...",
            "selected_theme": {...},
            "week_number": 1,
            "week_range": "3/10 - 3/14",
            "iteration_count": 0,
        })
    """
    builder = StateGraph(PlannerState)

    # ── Add nodes ─────────────────────────────────────────────
    builder.add_node("fetch_context", fetch_context_node)
    builder.add_node("master_architect", master_architect)
    builder.add_node("parallel_generate", parallel_generate_node)
    builder.add_node("assemble_plan", assemble_plan_node)
    builder.add_node("save", save_plan_node)

    # ── Wire edges (linear — no conditional routing) ──────────
    builder.add_edge(START, "fetch_context")
    builder.add_edge("fetch_context", "master_architect")
    builder.add_edge("master_architect", "parallel_generate")
    builder.add_edge("parallel_generate", "assemble_plan")
    builder.add_edge("assemble_plan", "save")
    builder.add_edge("save", END)

    return builder.compile()
