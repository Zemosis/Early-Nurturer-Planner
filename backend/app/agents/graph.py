"""
LangGraph pipeline — Curriculum Planner Graph.

Wires the Architect → Auditor → Personalizer agents into a single
executable graph with conditional routing and Postgres persistence.

Graph topology:
    START → fetch_context → architect → auditor
                   ↑                       ↓
                   └──── (revise) ←── route_auditor
                                          ↓
                                    (personalize)
                                          ↓
                              personalizer → youtube_enricher → save → END
"""

import asyncio
import json
import logging
import uuid

from langgraph.graph import END, START, StateGraph
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.agents.architect import curriculum_architect
from app.agents.auditor import safety_auditor
from app.agents.personalizer import personalize_plan
from app.agents.youtube_enricher import youtube_enricher
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
#  ROUTING LOGIC
# ══════════════════════════════════════════════════════════════


def route_auditor(state: PlannerState) -> str:
    """Conditional edge after the Auditor node.

    Returns:
        "personalize" — if plan accepted, iteration cap reached, or error present.
        "revise"      — if plan rejected and iterations remain.
    """
    # If there's an error in state, move forward to avoid infinite loops
    if state.get("error"):
        logger.info("RouteAuditor: error in state, routing to personalize")
        return "personalize"

    audit_result = state.get("audit_result") or {}
    accepted = audit_result.get("accepted", False)
    iteration_count = state.get("iteration_count", 0)

    if accepted or iteration_count >= 2:
        return "personalize"

    return "revise"


# ══════════════════════════════════════════════════════════════
#  GRAPH BUILDER
# ══════════════════════════════════════════════════════════════


def build_planner_graph():
    """Compile the full Architect → Auditor → Personalizer LangGraph.

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
    builder.add_node("architect", curriculum_architect)
    builder.add_node("auditor", safety_auditor)
    builder.add_node("youtube_enricher", youtube_enricher)
    builder.add_node("personalizer", personalize_plan)
    builder.add_node("save", save_plan_node)

    # ── Wire edges ────────────────────────────────────────────
    builder.add_edge(START, "fetch_context")
    builder.add_edge("fetch_context", "architect")
    builder.add_edge("architect", "auditor")
    builder.add_conditional_edges(
        "auditor",
        route_auditor,
        {"personalize": "personalizer", "revise": "architect"},
    )
    builder.add_edge("personalizer", "youtube_enricher")
    builder.add_edge("youtube_enricher", "save")
    builder.add_edge("save", END)

    return builder.compile()
