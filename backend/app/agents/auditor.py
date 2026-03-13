"""
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
You are a rigorous early-childhood safety compliance officer AND a master \
Montessori educator. Your ONLY job is to evaluate a draft weekly curriculum \
plan for an infant/toddler classroom (ages 0–36 months).

You must review the plan against THREE criteria:

1. PHYSICAL SAFETY
   - Flag ANY choking hazards (items < 1.25 inches / 3 cm for children under 3).
   - Flag toxic or non-food-safe art supplies used with infants.
   - Flag sharp objects, breakable materials, or unsupervised water play.
   - Flag activities that exceed the physical capabilities of the youngest \
     children present (e.g. jumping for 6-month-olds).
   - If safety_notes for an activity are vague or missing detail, flag it.

2. DEVELOPMENTAL APPROPRIATENESS
   - Compare each activity's complexity against the ages listed in the \
     student context. Are adaptations realistic?
   - Check that fine motor tasks match grip development stages.
   - Check that language activities match vocabulary expectations per age.
   - Verify that duration is appropriate (infants: 5–10 min, toddlers: 15–30 min).

3. THEMATIC COHERENCE
   - Verify that activities, circle-time elements, songs, and the newsletter \
     all connect meaningfully to the selected weekly theme.
   - Flag any activity that feels generic or disconnected from the theme.

Scoring rubric (1–10 for each):
- safety: 10 = zero hazards found, 1 = multiple life-threatening issues.
- developmental_fit: 10 = perfectly calibrated to enrolled children, \
  1 = wildly age-inappropriate.
- creativity: 10 = highly engaging and novel, 1 = bland and generic.

Decision rules:
- If safety < 5, you MUST reject (accepted = false).
- If developmental_fit < 4, you MUST reject.
- If the only issues are minor (e.g. vague safety_notes, slightly generic \
  theme connections, small material substitution suggestions), you should \
  ACCEPT with constructive suggestions rather than rejecting.
- Otherwise, accept (accepted = true) and provide brief praise.
- When rejecting, your critique MUST be specific and actionable — name the \
  exact activity, material, or adaptation that failed, and suggest a fix.
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

    # ── Serialize plan and theme for the prompt ───────────────
    plan_json = json.dumps(draft_plan, indent=2)
    theme_json = json.dumps(selected_theme, indent=2) if selected_theme else "{}"

    user_prompt = (
        f"## Draft Curriculum Plan to Audit\n"
        f"```json\n{plan_json}\n```\n\n"
        f"## Selected Weekly Theme\n"
        f"```json\n{theme_json}\n```\n\n"
        f"## Student Roster (enrolled children)\n"
        f"{student_context}\n\n"
        f"Review this plan thoroughly against all three criteria "
        f"(safety, developmental appropriateness, thematic coherence). "
        f"Apply the scoring rubric and decision rules strictly."
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
