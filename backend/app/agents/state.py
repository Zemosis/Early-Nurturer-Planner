"""
LangGraph graph state definition.

PlannerState is the TypedDict that flows between every node in the
Architect → Auditor → Personalizer pipeline. Each node reads what it
needs and returns a partial dict of updates.
"""

from typing import TypedDict


class PlannerState(TypedDict, total=False):
    """Shared state passed between LangGraph nodes.

    Fields marked as required (total=True by default in TypedDict) would
    force every node to supply them. Using total=False lets each node
    return only the keys it modifies.
    """

    # ── Inputs (set once at graph invocation) ─────────────────
    user_id: str
    thread_id: str                # unique ID for this graph run (uuid4)
    selected_theme: dict          # ThemeSchema serialised as dict
    week_number: int
    week_range: str               # e.g. "3/10 - 3/14"

    # ── Context (populated by the fetch_context node) ─────────
    student_context: str          # from fetch_student_context()
    pedagogy_context: str         # from query_pedagogy()

    # ── Architect output ──────────────────────────────────────
    draft_plan: dict | None       # WeekPlanSchema serialised as dict

    # ── Auditor output ────────────────────────────────────────
    audit_result: dict | None     # AuditResultSchema serialised as dict

    # ── Personalizer output ───────────────────────────────────
    personalized_plan: dict | None

    # ── Control flow ──────────────────────────────────────────
    iteration_count: int          # incremented each Architect pass (max 3)
    error: str | None             # set on Gemini / DB failures
