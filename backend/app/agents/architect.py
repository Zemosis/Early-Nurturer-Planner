"""
LangGraph Node — Master Architect + Day Architect (Phase 3 Map-Reduce).

Two-stage generation pipeline:
  1. master_architect  — LangGraph node that generates the theme skeleton
     (everything except daily_plans) in a single fast Gemini call (~5-8s).
  2. generate_days     — standalone async function that generates all 5 daily
     plans with personalization baked in (~12-15s). Called from the
     parallel_generate node in graph.py alongside YouTube enrichment.

The old monolithic curriculum_architect is replaced by this 2-way split.
"""

import json
import logging
import re

from google import genai
from google.genai import types
from pydantic import TypeAdapter, ValidationError
from tenacity import retry, stop_after_attempt, wait_exponential

from app.agents.schemas import MasterSkeletonSchema, DailyPlansOutputSchema
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

# Matches a valid JSON surrogate pair: high surrogate (\uD800–\uDBFF)
# followed immediately by a low surrogate (\uDC00–\uDFFF).
_SURROGATE_PAIR_RE = re.compile(
    r'\\u([dD][89abAB][0-9a-fA-F]{2})\\u([dD][cdefCDEF][0-9a-fA-F]{2})'
)
# Matches any remaining lone surrogate escape (\uD800–\uDFFF).
_LONE_SURROGATE_RE = re.compile(r'\\u[dD][89a-fA-F][0-9a-fA-F]{2}')


def _decode_surrogate_pair(match: re.Match) -> str:
    """Convert a JSON surrogate pair to the actual Unicode character."""
    high = int(match.group(1), 16)
    low = int(match.group(2), 16)
    code_point = 0x10000 + (high - 0xD800) * 0x400 + (low - 0xDC00)
    return chr(code_point)


def _sanitize_and_extract_json(raw_text: str) -> str:
    """Fix surrogate pairs, strip lone surrogates, extract JSON from markdown fences."""
    # First, convert valid surrogate pairs (e.g. \uD83D\uDC20 → 🐠)
    raw_text = _SURROGATE_PAIR_RE.sub(_decode_surrogate_pair, raw_text)
    # Then strip any remaining lone surrogates that would break JSON parsers
    raw_text = _LONE_SURROGATE_RE.sub('', raw_text)
    json_match = re.search(r'```(?:json)?\s*([\s\S]+?)\s*```', raw_text)
    if json_match:
        raw_text = json_match.group(1)
    return raw_text


# ══════════════════════════════════════════════════════════════
#  SYSTEM PROMPTS
# ══════════════════════════════════════════════════════════════

SKELETON_SYSTEM_PROMPT = """\
You are a senior Montessori curriculum designer for infant/toddler classrooms \
(ages 0–36 months). Generate ONLY the weekly theme skeleton as a single valid \
JSON object. Do NOT generate daily_plans — those will be created separately.

Output ONLY the JSON — no markdown fences, no commentary.

The skeleton includes:
- id, week_number, week_range, theme, theme_emoji
- palette: 4 valid hex colors (primary, secondary, accent, background)
- domains: at least 2 developmental domains covered this week
- objectives: 2+ domain/goal pairs
- circle_time: letter, color, shape, counting_to, letter_word, counting_object, \
  color_object, greeting_song, goodbye_song, \
  yoga_poses (2-3 entries with keyword name, empty image_url/how_to/creative_cues), \
  read_aloud, discussion_prompt
- IMPORTANT: greeting_song and goodbye_song MUST be JSON objects with exactly three \
  keys: "title" (string), "script" (string, 4-8 line lyrics), "duration" (string, \
  e.g. "2:30"). Do NOT output a raw string for these fields.
- newsletter: welcome_message, learning_goals, home_connection, \
  professional_version, warm_version
- IMPORTANT: newsletter.learning_goals MUST be a JSON array of 2-5 strings \
  (e.g. ["goal 1", "goal 2"]). Do NOT output a single paragraph string.

Requirements:
- Thematically cohesive — every element connects to the weekly theme.
- CRITICAL: Randomly vary letter, color, and shape. Do NOT pick obvious choices \
  (e.g., do not always pick 'G' and 'Green' for a garden theme).
- letter_word: a single theme-relevant word starting with the letter of the week.
- counting_object: a plural, theme-relevant noun for the counting poster.
- color_object: a thematic object clearly representing the color (e.g. 'green frog').
- IDs: URL-safe kebab-case. Palette: valid 6-digit hex (e.g. '#7A9B76').
- Songs: 4–8 line scripts an educator can sing or chant.
- yoga_poses: 2–3 entries with a short thematic keyword in `name`. \
  Leave image_url as "", how_to and creative_cues as [].

Tailor to the student roster and ground choices in the pedagogy context.
"""

DAY_SYSTEM_PROMPT = """\
You are a senior Montessori curriculum designer for infant/toddler classrooms \
(ages 0–36 months). Generate exactly 5 daily plans (Monday–Friday) as a JSON \
object with a single key "daily_plans" containing an array of 5 day objects. \
Output ONLY the JSON — no markdown fences, no commentary.

Each day must have:
- "day": day name (Monday, Tuesday, Wednesday, Thursday, Friday)
- "focus_domain": primary developmental domain for this day
- "activities": array with exactly 1 activity containing:
  - id (kebab-case), day, title, domain, duration (int minutes), description, \
    theme_connection, materials (array of strings), reflection_prompts (array of strings)
  - IMPORTANT: safety_notes MUST be a single string, NOT an array. Combine all \
    safety considerations into one paragraph string.
  - IMPORTANT: adaptations MUST be a JSON array of objects. Each object has \
    "age_group" (string: "0-12m", "12-24m", or "24-36m"), "description" (string), \
    and "modifications" (array of strings). Do NOT use age groups as dictionary keys. \
    Example: [{"age_group": "0-12m", "description": "...", "modifications": ["..."]}]

Safety checklist (verify before outputting):
- No items < 1.25 in (3 cm) for under-3s. No toxic/sharp materials.
- No unsupervised water play. No beyond-capability activities.
- Duration: infants 5–10 min, toddlers 15–30 min.
- Every activity meaningfully connects to the theme.
Fix any failures before responding.

CRITICAL PERSONALIZATION INSTRUCTIONS:
- You will receive a student roster with each child's name, age, group, bio, and tags.
- In activity descriptions, mention children BY NAME and how the activity supports them.
- In adaptations, tailor descriptions and modifications to the actual enrolled children \
  in each age band, referencing their goals and tags.
- In reflection_prompts, ask about specific children by name.
- In theme_connection, link to children's interests from their bio.
- For children with special tags (e.g. 'speech_delay'), weave in targeted strategies.
- Reference EVERY child at least once across the 5 days.
- Keep language warm, professional, encouraging.

Ground your choices in the provided pedagogy context and skeleton theme details.
"""


# ══════════════════════════════════════════════════════════════
#  NODE: Master Architect (skeleton generation)
# ══════════════════════════════════════════════════════════════


async def master_architect(state: PlannerState) -> dict:
    """LangGraph node: generate the weekly theme skeleton (everything except daily_plans).

    Args:
        state: The current PlannerState dictionary.

    Returns:
        A dict of state updates:
          - master_skeleton: The MasterSkeletonSchema as a pure dict.
          - iteration_count: Set to 1.
          - error: Set to error message string on failure, None on success.
    """
    selected_theme = state.get("selected_theme", {})
    student_context = state.get("student_context", "No student data available.")
    pedagogy_context = state.get("pedagogy_context", "No pedagogy data available.")
    week_number = state.get("week_number", 1)
    week_range = state.get("week_range", "")

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
        f"Generate the weekly theme skeleton for this theme. "
        f"Do NOT generate daily_plans."
    )

    logger.info("MasterArchitect: calling Gemini for skeleton")
    try:
        response = await gemini_client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=SKELETON_SYSTEM_PROMPT,
                response_mime_type="application/json",
                temperature=0.7,
                max_output_tokens=8192,
                thinking_config=types.ThinkingConfig(thinking_budget=5000),
            ),
        )

        raw_text = response.text
        if not raw_text:
            logger.warning("MasterArchitect: Gemini returned empty response")
            return {
                "master_skeleton": None,
                "iteration_count": 1,
                "error": "MasterArchitect: Gemini returned an empty response.",
            }

        logger.info("MasterArchitect: received %d chars, validating schema", len(raw_text))
        raw_text = _sanitize_and_extract_json(raw_text)

        try:
            adapter = TypeAdapter(MasterSkeletonSchema)
            skeleton = adapter.validate_json(raw_text)
        except ValidationError as ve:
            logger.error("MasterArchitect: Pydantic validation failed — %s", ve)
            return {
                "master_skeleton": None,
                "iteration_count": 1,
                "error": f"MasterArchitect schema validation failed: {ve}",
            }

        logger.info("MasterArchitect: skeleton validated successfully")
        return {
            "master_skeleton": skeleton.model_dump(mode="json"),
            "iteration_count": 1,
            "error": None,
        }

    except Exception as e:
        logger.error("MasterArchitect: generation failed — %s", e, exc_info=True)
        return {
            "master_skeleton": None,
            "iteration_count": 1,
            "error": f"MasterArchitect generation failed: {e}",
        }


# ══════════════════════════════════════════════════════════════
#  STANDALONE: Day Architect (all 5 days + personalization)
# ══════════════════════════════════════════════════════════════


@retry(
    wait=wait_exponential(min=2, max=15),
    stop=stop_after_attempt(3),
    reraise=True,
)
async def generate_days(
    skeleton: dict,
    student_context: str,
    pedagogy_context: str,
) -> list[dict]:
    """Generate all 5 daily plans with personalization baked in.

    This is a standalone async function (NOT a LangGraph node). It is
    called from the parallel_generate node in graph.py alongside the
    YouTube enricher.

    Args:
        skeleton: MasterSkeletonSchema as a dict (provides theme context).
        student_context: Formatted student roster string.
        pedagogy_context: RAG-retrieved pedagogy advice string.

    Returns:
        A list of 5 DailyPlanSchema dicts (pure dicts via model_dump).

    Raises:
        Exception: On Gemini failure or Pydantic validation failure (retried
                   up to 3 times by tenacity).
    """
    skeleton_block = json.dumps(skeleton, separators=(',', ':'))

    user_prompt = (
        f"## Theme Skeleton (for context — do NOT reproduce these fields)\n"
        f"```json\n{skeleton_block}\n```\n\n"
        f"## Student Roster\n"
        f"{student_context}\n\n"
        f"## Pedagogy & Research Context\n"
        f"{pedagogy_context}\n\n"
        f"Generate exactly 5 daily plans (Monday–Friday) for the theme "
        f"'{skeleton.get('theme', '')}'. Personalize every activity for the "
        f"children listed above."
    )

    logger.info("DayArchitect: calling Gemini for 5 daily plans")
    response = await gemini_client.aio.models.generate_content(
        model=GEMINI_MODEL,
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=DAY_SYSTEM_PROMPT,
            response_mime_type="application/json",
            temperature=0.7,
            max_output_tokens=16384,
            thinking_config=types.ThinkingConfig(thinking_budget=8000),
        ),
    )

    raw_text = response.text
    if not raw_text:
        raise RuntimeError("DayArchitect: Gemini returned an empty response")

    logger.info("DayArchitect: received %d chars, validating schema", len(raw_text))
    raw_text = _sanitize_and_extract_json(raw_text)

    try:
        adapter = TypeAdapter(DailyPlansOutputSchema)
        plans = adapter.validate_json(raw_text)
    except ValidationError as ve:
        logger.error("DayArchitect: Pydantic validation failed (will retry) — %s", ve)
        raise

    logger.info("DayArchitect: %d daily plans validated successfully", len(plans.daily_plans))
    return [dp.model_dump(mode="json") for dp in plans.daily_plans]
