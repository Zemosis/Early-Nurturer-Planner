"""
# BYPASSED in Phase 3 — safety enforced via system prompts in day architect.
LangGraph Node — Safety Auditor.

The safety net of the multi-agent pipeline. Receives the Architect's
draft curriculum plan and evaluates it for:
  - Physical safety (choking hazards, toxic materials, sharp objects)
  - Developmental appropriateness (age-group fit, realistic milestones)
  - Thematic coherence (activities actually connect to the weekly theme)

Returns a structured AuditResultSchema with an accepted/rejected flag,
detailed critique, specific safety concerns, and numerical scores.

This node does NOT mutate iteration_count — that is the Architect's job.
"""

import json
import logging

from google import genai
from google.genai import types
from pydantic import TypeAdapter

from app.agents.schemas import AuditResultSchema
from app.agents.state import PlannerState
from config import settings

logger = logging.getLogger(__name__)

# ── Gemini async client (Vertex AI mode) ──────────────────────
gemini_client = genai.Client(
    vertexai=True,
    project=settings.GCP_PROJECT_ID,
    location=settings.VERTEX_AI_LOCATION,
)

GEMINI_MODEL = "gemini-2.5-flash"

# ── System prompt ─────────────────────────────────────────────

AUDITOR_SYSTEM_PROMPT = """\
You are an early-childhood safety compliance officer and Montessori educator. \
Evaluate a draft curriculum plan for an infant/toddler classroom (0–36 months).

Review against THREE criteria:

1. SAFETY: Flag choking hazards (items < 1.25 in / 3 cm), toxic/non-food-safe \
art supplies, sharp/breakable materials, unsupervised water play, activities \
beyond youngest children's capabilities, vague or missing safety_notes.

2. DEVELOPMENTAL FIT: Check activity complexity vs enrolled ages, fine motor \
tasks vs grip stages, language vs vocabulary expectations, duration \
(infants 5–10 min, toddlers 15–30 min).

3. THEMATIC COHERENCE: Verify activities and circle-time elements connect \
meaningfully to the weekly theme. Flag generic/disconnected activities.

Scoring (1–10): safety, developmental_fit, creativity.

Decision rules:
- safety < 5 → REJECT. developmental_fit < 4 → REJECT.
- Minor issues only → ACCEPT with suggestions.
- When rejecting, name the exact activity/material that failed and suggest a fix.
"""


async def safety_auditor(state: PlannerState) -> dict:
    """LangGraph node: evaluate the Architect's draft plan for safety and quality.

    Reads the draft_plan, student_context, and selected_theme from state.
    Calls Gemini with a strict compliance prompt and low temperature to
    produce a deterministic, structured audit result.

    This node does NOT modify iteration_count.

    Args:
        state: The current PlannerState dictionary.

    Returns:
        A dict of state updates:
          - audit_result: The AuditResultSchema as a dict.
          - error: Set to error message string on failure, None on success.
    """
    # ── Extract state ─────────────────────────────────────────
    draft_plan = state.get("draft_plan")
    student_context = state.get("student_context", "No student data available.")
    selected_theme = state.get("selected_theme", {})

    if not draft_plan:
        logger.warning("Auditor: no draft_plan provided")
        return {
            "audit_result": {
                "accepted": False,
                "critique": "No draft plan was provided to audit.",
                "safety_concerns": [],
                "scores": {"safety": 1, "developmental_fit": 1, "creativity": 1},
            },
            "error": "Auditor received an empty draft_plan.",
        }

    # ── Build safety-relevant payload (skip newsletter, palette, etc.) ──
    audit_payload = {
        "theme": draft_plan.get("theme", ""),
        "circle_time": draft_plan.get("circle_time"),
        "daily_plans": [
            {
                "day": day.get("day", ""),
                "focus_domain": day.get("focus_domain", ""),
                "activities": [
                    {
                        k: v for k, v in act.items()
                        if k in (
                            "title", "domain", "materials", "safety_notes",
                            "adaptations", "duration", "description",
                            "theme_connection",
                        )
                    }
                    for act in day.get("activities", [])
                ],
            }
            for day in draft_plan.get("daily_plans", [])
        ],
    }
    plan_json = json.dumps(audit_payload, separators=(',', ':'))
    theme_json = json.dumps(selected_theme, separators=(',', ':')) if selected_theme else "{}"

    user_prompt = (
        f"## Draft Curriculum Plan to Audit\n"
        f"```json\n{plan_json}\n```\n\n"
        f"## Selected Weekly Theme\n"
        f"```json\n{theme_json}\n```\n\n"
        f"## Student Roster (enrolled children)\n"
        f"{student_context}\n\n"
        f"Review against all three criteria. Apply scoring and decision rules."
    )

    # ── Call Gemini with structured output ─────────────────────
    logger.info("Auditor: evaluating draft plan")
    try:
        response = await gemini_client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=AUDITOR_SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_schema=AuditResultSchema,
                temperature=0.3,
            ),
        )

        raw_text = response.text
        if not raw_text:
            return {
                "audit_result": None,
                "error": "Gemini returned an empty response during audit.",
            }

        # Validate through Pydantic
        adapter = TypeAdapter(AuditResultSchema)
        result = adapter.validate_json(raw_text)

        return {
            "audit_result": result.model_dump(),
            "error": None,
        }

    except Exception as e:
        logger.error("Auditor: evaluation failed — %s", e, exc_info=True)
        return {
            "audit_result": None,
            "error": f"Auditor evaluation failed: {e}",
        }
