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
import re

from google import genai
from google.genai import types
from pydantic import TypeAdapter, ValidationError

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

# Matches lone Unicode surrogate escapes (\uD800–\uDFFF) that Gemini
# sometimes emits and that break strict JSON parsers.
_SURROGATE_RE = re.compile(r'\\u[dD][89a-fA-F][0-9a-fA-F]{2}')

# ── System prompt ─────────────────────────────────────────────

ARCHITECT_SYSTEM_PROMPT = """\
You are a senior Montessori curriculum designer for infant/toddler classrooms \
(ages 0–36 months). Produce a COMPLETE 5-day weekly curriculum plan as a \
single valid JSON object matching the schema below. Output ONLY the JSON — \
no markdown fences, no commentary.

Requirements:
- Developmentally appropriate for every enrolled age group.
- Thematically cohesive — every activity, circle-time element, and newsletter \
  connects to the weekly theme.
- Safe — no choking hazards, toxic materials, or beyond-capability activities.
- Rich in sensory, hands-on, and language opportunities.
- Age adaptations (0-12m, 12-24m, 24-36m) for every activity.

Structure:
- Exactly 5 daily plans (Mon–Fri), each with a focus domain and exactly 1 activity.
- Each activity: safety_notes (specific, not vague) + at least one adaptation.
- Circle time: greeting song, goodbye song, 2–3 yoga poses, read-aloud, \
  discussion prompt.
- yoga_poses: 2–3 entries with a short thematic keyword in `name`. \
  Leave image_url as "", how_to and creative_cues as [].
- Newsletter: professional_version + warm_version fields.
- IDs: URL-safe kebab-case. Palette: valid 6-digit hex (e.g. '#7A9B76').
- Songs: 4–8 line scripts an educator can sing or chant.

Safety checklist (verify before outputting):
- No items < 1.25 in (3 cm) for under-3s. No toxic/sharp materials.
- No unsupervised water play. No beyond-capability activities.
- Duration: infants 5–10 min, toddlers 15–30 min.
- Every activity meaningfully connects to the theme.
Fix any failures before responding.

Tailor to the student roster and ground choices in the pedagogy context.

JSON SCHEMA (follow exactly — all fields required unless noted):
{
  "id": "week-<N>-<theme-slug>",
  "week_number": <int>,
  "week_range": "<string>",
  "theme": "<string>",
  "theme_emoji": "<emoji>",
  "palette": {"primary":"#RRGGBB","secondary":"#RRGGBB","accent":"#RRGGBB","background":"#RRGGBB"},
  "domains": ["<string>", ...],
  "objectives": [{"domain":"<string>","goal":"<string>"}, ...],
  "circle_time": {
    "letter": "<single letter>",
    "color": "<string>",
    "shape": "<string>",
    "counting_to": <int>,
    "greeting_song": {"title":"<string>","script":"<string>","duration":"<MM:SS>"},
    "goodbye_song":  {"title":"<string>","script":"<string>","duration":"<MM:SS>"},
    "yoga_poses": [{"name":"<keyword>","image_url":"","how_to":[],"creative_cues":[]}, ...],
    "read_aloud": "<string>",
    "discussion_prompt": "<string>"
  },
  "daily_plans": [
    {
      "day": "Monday",
      "focus_domain": "<string>",
      "activities": [
        {
          "id": "<kebab-case>",
          "day": "Monday",
          "title": "<string>",
          "domain": "<string>",
          "duration": <int minutes>,
          "description": "<string>",
          "theme_connection": "<string>",
          "materials": ["<string>", ...],
          "safety_notes": "<string>",
          "adaptations": [
            {"age_group":"0-12m","description":"<string>","modifications":["<string>",...]},
            {"age_group":"12-24m","description":"<string>","modifications":["<string>",...]},
            {"age_group":"24-36m","description":"<string>","modifications":["<string>",...]}
          ],
          "reflection_prompts": ["<string>", ...]
        }  // IMPORTANT: exactly 1 activity per day
      ]
    },
    ... (repeat for Tuesday, Wednesday, Thursday, Friday — exactly 1 activity each)
  ],
  "newsletter": {
    "welcome_message": "<string>",
    "learning_goals": ["<string>", ...],
    "home_connection": "<string>",
    "professional_version": "<string>",
    "warm_version": "<string>"
  }
}
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

    # ── Call Gemini (JSON mode — no response_schema to avoid 400 on deep nesting) ──
    logger.info("Architect: calling Gemini (iteration %d)", iteration_count)
    try:
        response = await gemini_client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=ARCHITECT_SYSTEM_PROMPT,
                response_mime_type="application/json",
                temperature=0.7,
                max_output_tokens=32768,
            ),
        )

        raw_text = response.text
        if not raw_text:
            logger.warning("Architect: Gemini returned empty response")
            # Only clear draft_plan on first pass; preserve previous draft on revisions
            update: dict = {
                "iteration_count": iteration_count + 1,
                "error": "Gemini returned an empty response.",
            }
            if iteration_count == 0:
                update["draft_plan"] = None
            return update

        logger.info("Architect: received %d chars, validating schema", len(raw_text))

        # Sanitize lone surrogate escapes before parsing
        raw_text = _SURROGATE_RE.sub('', raw_text)

        # Extract JSON block if wrapped in markdown fences
        json_match = re.search(r'```(?:json)?\s*([\s\S]+?)\s*```', raw_text)
        if json_match:
            raw_text = json_match.group(1)

        # Validate through Pydantic
        try:
            adapter = TypeAdapter(WeekPlanSchema)
            plan = adapter.validate_json(raw_text)
        except ValidationError as ve:
            logger.error("Architect: Pydantic validation failed — %s", ve)
            update = {
                "iteration_count": iteration_count + 1,
                "error": f"Architect schema validation failed: {ve}",
            }
            if iteration_count == 0:
                update["draft_plan"] = None
            return update

        logger.info("Architect: plan validated successfully")

        return {
            "draft_plan": plan.model_dump(),
            "iteration_count": iteration_count + 1,
            "error": None,
        }

    except Exception as e:
        logger.error("Architect: generation failed — %s", e, exc_info=True)
        # Only clear draft_plan on first pass; preserve previous good draft on revisions
        update = {
            "iteration_count": iteration_count + 1,
            "error": f"Architect generation failed: {e}",
        }
        if iteration_count == 0:
            update["draft_plan"] = None
        return update
