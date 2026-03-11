"""
LangGraph Node — Curriculum Architect.

The creative engine of the multi-agent pipeline. Reads the selected theme,
student roster, and pedagogy context from the graph state, then calls
Gemini 2.5 Flash to produce a complete 5-day WeekPlanSchema.

On revision passes (iteration_count > 0) the Auditor's critique is
injected into the prompt so the Architect can fix rejected issues.
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

ARCHITECT_SYSTEM_PROMPT = """\
You are a senior Montessori / early-childhood curriculum designer with 20+ \
years of experience creating weekly lesson plans for infant and toddler \
classrooms (ages 0–36 months).

Your task is to produce a COMPLETE 5-day weekly curriculum plan that is:
- Developmentally appropriate for every age group present in the classroom.
- Thematically cohesive — every activity, circle-time element, and newsletter \
  must connect to the selected weekly theme.
- Safe — no choking hazards, toxic materials, or activities beyond the \
  physical capabilities of the youngest children present.
- Rich in sensory experiences, hands-on exploration, and language opportunities.
- Inclusive of age adaptations (0-12m, 12-24m, 24-36m) for every activity.

Structural rules:
- Generate exactly 5 daily plans (Monday through Friday).
- Each day must have a focus developmental domain and 1–3 activities.
- Each activity MUST include safety_notes and at least one age adaptation.
- Circle time must include a greeting song, goodbye song, 2–5 yoga poses, \
  a read-aloud recommendation, and a discussion prompt.
- The newsletter must have both a professional and a warm/friendly version.
- All IDs must be URL-safe kebab-case.
- Palette hex codes must be valid 6-digit codes (e.g. '#7A9B76').
- Song scripts should be 4–8 lines that an educator can sing or chant.

Use the provided student context to tailor activity complexity, and the \
pedagogy context to ground your choices in evidence-based practice.
"""


async def curriculum_architect(state: PlannerState) -> dict:
    """LangGraph node: generate or revise a weekly curriculum plan.

    Reads the selected theme, student context, and pedagogy context from
    the graph state. On first pass, generates a fresh plan. On subsequent
    passes (after Auditor rejection), incorporates the critique to fix
    identified issues.

    Args:
        state: The current PlannerState dictionary.

    Returns:
        A dict of state updates:
          - draft_plan: The generated WeekPlanSchema as a dict.
          - iteration_count: Incremented by 1.
          - error: Set to error message string on failure, None on success.
    """
    # ── Extract state ─────────────────────────────────────────
    selected_theme = state.get("selected_theme", {})
    student_context = state.get("student_context", "No student data available.")
    pedagogy_context = state.get("pedagogy_context", "No pedagogy data available.")
    iteration_count = state.get("iteration_count", 0)
    audit_result = state.get("audit_result")
    week_number = state.get("week_number", 1)
    week_range = state.get("week_range", "")

    # ── Build user prompt ─────────────────────────────────────
    theme_block = json.dumps(selected_theme, indent=2) if selected_theme else "{}"

    user_prompt = (
        f"## Weekly Theme\n"
        f"```json\n{theme_block}\n```\n\n"
        f"## Week Details\n"
        f"- Week number: {week_number}\n"
        f"- Date range: {week_range}\n\n"
        f"## Student Roster\n"
        f"{student_context}\n\n"
        f"## Pedagogy & Research Context\n"
        f"{pedagogy_context}\n\n"
        f"Generate a complete 5-day weekly curriculum plan for this theme "
        f"and these specific children."
    )

    # ── Critique loop: inject Auditor feedback on revisions ───
    if iteration_count > 0 and audit_result:
        critique = audit_result.get("critique", "No specific feedback provided.")
        safety_concerns = audit_result.get("safety_concerns", [])
        concerns_text = "\n".join(f"  - {c}" for c in safety_concerns) if safety_concerns else "  (none listed)"

        user_prompt += (
            f"\n\n---\n\n"
            f"⚠️ **REVISION REQUIRED — Attempt {iteration_count + 1}**\n\n"
            f"Your previous draft was REJECTED by the Safety Auditor. "
            f"You MUST fix the following issues:\n\n"
            f"### Auditor Critique\n"
            f"{critique}\n\n"
            f"### Specific Safety Concerns\n"
            f"{concerns_text}\n\n"
            f"Address every concern above. Do NOT repeat the same mistakes. "
            f"If materials were flagged as hazardous, replace them with safe "
            f"alternatives. If activities were flagged as age-inappropriate, "
            f"redesign them entirely."
        )

    # ── Call Gemini with structured output ─────────────────────
    logger.info("Architect: calling Gemini (iteration %d)", iteration_count)
    try:
        response = await gemini_client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=ARCHITECT_SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_schema=WeekPlanSchema,
                temperature=0.9,
            ),
        )

        raw_text = response.text
        if not raw_text:
            logger.warning("Architect: Gemini returned empty response")
            return {
                "draft_plan": None,
                "iteration_count": iteration_count + 1,
                "error": "Gemini returned an empty response.",
            }

        logger.info("Architect: received %d chars, validating schema", len(raw_text))

        # Validate through Pydantic
        adapter = TypeAdapter(WeekPlanSchema)
        plan = adapter.validate_json(raw_text)

        logger.info("Architect: plan validated successfully")
        return {
            "draft_plan": plan.model_dump(),
            "iteration_count": iteration_count + 1,
            "error": None,
        }

    except Exception as e:
        logger.error("Architect: generation failed — %s", e, exc_info=True)
        return {
            "draft_plan": None,
            "iteration_count": iteration_count + 1,
            "error": f"Architect generation failed: {e}",
        }
