"""
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

# ── System prompt ─────────────────────────────────────────────

PERSONALIZER_SYSTEM_PROMPT = """\
You are a master Montessori guide with deep expertise in individualised \
learning for infants and toddlers (ages 0–36 months). You have been given \
a weekly curriculum plan that has ALREADY PASSED a strict safety audit.

Your job is to personalise this plan for the specific children enrolled \
in the classroom. You will receive a student roster with each child's \
name, age, developmental group, bio, and special tags.

CRITICAL CONSTRAINTS — read carefully:
- You MUST NOT change the core activities, their titles, domains, or IDs.
- You MUST NOT change any materials lists.
- You MUST NOT change any safety_notes — they are audit-approved.
- You MUST NOT change circle time songs, yoga poses, or the newsletter \
  structure.
- You MUST NOT remove or add activities.

WHAT YOU MAY CHANGE:
- Activity `description` fields — enrich them to mention specific children \
  by name and explain how the activity supports their individual needs \
  (e.g. "Emma (8 months) will benefit from the soft textures during \
  tummy time, while Liam (30 months) can practice sorting by colour").
- Activity `adaptations` — tailor the `description` and `modifications` \
  within each AgeAdaptationSchema to reference enrolled children in that \
  age band and their specific developmental goals or tags.
- Activity `reflection_prompts` — refine to ask about specific children \
  (e.g. "Did Sophia engage with the counting activity for the full \
  duration?").
- Activity `theme_connection` — optionally mention how the theme resonates \
  with specific children's interests from their bio.
- Newsletter `welcome_message` and `warm_version` — may reference the \
  group by the educator's style, but keep it general enough for all families.

Personalisation guidelines:
- Reference every child at least once across the week.
- If a child has special tags (e.g. 'speech_delay', 'high_energy'), \
  explicitly mention strategies for them in relevant activities.
- Keep language warm, professional, and encouraging.
- Preserve the exact JSON structure — your output must be a valid \
  WeekPlanSchema.
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
        return {
            "personalized_plan": None,
            "error": "No draft plan available to personalize.",
        }

    # ── Guard: plan was not accepted by auditor ───────────────
    if audit_result and not audit_result.get("accepted", False):
        logger.warning("Personalizer: plan was rejected by auditor, skipping")
        return {
            "personalized_plan": None,
            "error": "Cannot personalize a plan that was rejected by the Safety Auditor.",
        }

    # ── Serialize plan for the prompt ─────────────────────────
    plan_json = json.dumps(draft_plan, indent=2)

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
            ),
        )

        raw_text = response.text
        if not raw_text:
            return {
                "personalized_plan": None,
                "error": "Gemini returned an empty response during personalization.",
            }

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
