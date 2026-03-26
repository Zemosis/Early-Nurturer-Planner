"""
# BYPASSED in Phase 3 — personalization merged into day architect system prompt.
LangGraph Node — Personalizer.

The final agent in the Architect → Auditor → Personalizer pipeline.
Takes the safety-approved draft plan and weaves in child-specific
personalization based on the student roster — mentioning children by
name and tailoring adaptations to their developmental needs and tags.

This node does NOT alter core activities, materials, or safety notes.
It only enriches adaptations and descriptions.
"""

import json
import logging
import re

from google import genai
from google.genai import types
from pydantic import TypeAdapter

from app.agents.schemas import WeekPlanSchema
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

_SURROGATE_RE = re.compile(r'\\u[dD][89a-fA-F][0-9a-fA-F]{2}')

# ── System prompt ─────────────────────────────────────────────

PERSONALIZER_SYSTEM_PROMPT = """\
You are a Montessori guide personalising an audit-approved weekly curriculum \
for infants/toddlers (0–36 months). You receive a student roster with each \
child's name, age, group, bio, and tags.

DO NOT CHANGE: activity titles, IDs, domains, materials, safety_notes, \
circle time songs/yoga, newsletter structure. Do not add or remove activities.

YOU MAY CHANGE:
- `description`: mention children by name and how activities support them.
- `adaptations`: tailor descriptions/modifications to enrolled children in \
  each age band, referencing their goals and tags.
- `reflection_prompts`: ask about specific children by name.
- `theme_connection`: link theme to children's interests from their bio.
- Newsletter `welcome_message` / `warm_version`: may reference the group.

Guidelines:
- Reference every child at least once across the week.
- For children with special tags (e.g. 'speech_delay'), mention strategies.
- Keep language warm, professional, encouraging.
- Output must be a valid WeekPlanSchema preserving exact JSON structure.
"""


async def personalize_plan(state: PlannerState) -> dict:
    """LangGraph node: personalise the approved curriculum for enrolled children.

    Takes the safety-approved draft plan and the student context, then
    calls Gemini to weave child-specific names, needs, and strategies
    into the adaptations and descriptions.

    Args:
        state: The current PlannerState dictionary.

    Returns:
        A dict of state updates:
          - personalized_plan: The personalised WeekPlanSchema as a dict.
          - error: Set to error message string on failure, None on success.
    """
    # ── Extract state ─────────────────────────────────────────
    draft_plan = state.get("draft_plan")
    student_context = state.get("student_context", "No student data available.")
    audit_result = state.get("audit_result")

    # ── Guard: no plan to personalise ─────────────────────────
    if not draft_plan:
        logger.warning("Personalizer: no draft_plan provided")
        # Preserve any upstream error already in state rather than overwriting
        return {
            "personalized_plan": None,
        }

    # ── Guard: plan was not accepted by auditor ───────────────
    if audit_result and not audit_result.get("accepted", False):
        logger.warning("Personalizer: plan was rejected by auditor, skipping personalization (draft plan will be used as fallback)")
        # Return only personalized_plan=None; do NOT overwrite error so the
        # upstream failure reason is preserved in state.
        return {
            "personalized_plan": None,
        }

    # ── Serialize plan for the prompt (compact to reduce tokens) ──
    plan_json = json.dumps(draft_plan, separators=(',', ':'))

    # Include auditor praise if available (reinforces what's strong)
    auditor_praise = ""
    if audit_result and audit_result.get("accepted"):
        auditor_praise = (
            f"\n## Auditor Feedback (for context — do not change what was praised)\n"
            f"{audit_result.get('critique', '')}\n"
        )

    user_prompt = (
        f"## Approved Curriculum Plan\n"
        f"```json\n{plan_json}\n```\n\n"
        f"## Enrolled Children\n"
        f"{student_context}\n"
        f"{auditor_praise}\n"
        f"Personalise this plan for the children listed above. "
        f"Remember: do NOT alter core activities, materials, or safety notes. "
        f"ONLY enrich descriptions, adaptations, reflection prompts, and "
        f"theme connections with child-specific references."
    )

    # ── Call Gemini with structured output ─────────────────────
    logger.info("Personalizer: calling Gemini")
    try:
        response = await gemini_client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=PERSONALIZER_SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_schema=WeekPlanSchema,
                temperature=0.5,
                max_output_tokens=24576,
            ),
        )

        raw_text = response.text
        if not raw_text:
            return {
                "personalized_plan": None,
                "error": "Gemini returned an empty response during personalization.",
            }

        # Sanitize lone surrogate escapes before parsing
        raw_text = _SURROGATE_RE.sub('', raw_text)

        # Validate through Pydantic
        adapter = TypeAdapter(WeekPlanSchema)
        plan = adapter.validate_json(raw_text)

        return {
            "personalized_plan": plan.model_dump(),
            "error": None,
        }

    except Exception as e:
        logger.error("Personalizer: failed — %s", e, exc_info=True)
        return {
            "personalized_plan": None,
            "error": f"Personalization failed: {e}",
        }
