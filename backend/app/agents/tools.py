"""
LangGraph agent tools — async functions that fetch context from the
database and generate structured AI outputs via Vertex AI / Gemini.

These tools are designed to be bound to LangGraph nodes so agents can
retrieve live data (students, plans, embeddings) and call Gemini for
curriculum generation and personalisation.
"""

import uuid

from google import genai
from google.genai import types
from pydantic import TypeAdapter
from sqlalchemy import select

from app.agents.schemas import ThemeSchema
from app.db.database import async_session_factory
from app.db.models import Student
from config import settings

# ── Gemini async client (Vertex AI mode) ──────────────────────
gemini_client = genai.Client(
    vertexai=True,
    project=settings.GCP_PROJECT_ID,
    location=settings.VERTEX_AI_LOCATION,
)

GEMINI_MODEL = "gemini-2.5-flash"


async def fetch_student_context(user_id: str) -> str:
    """Retrieve all active students for an educator and return a formatted summary.

    Use this tool when the agent needs to understand which children are in the
    classroom, their ages, developmental groups, and any educator-written notes.
    The returned string is optimised for LLM consumption — one line per child
    with name, age in months, age group, tags, and bio.

    Args:
        user_id: UUID string of the educator whose students to fetch.

    Returns:
        A human-readable, newline-separated summary of every active student,
        or a short message indicating no student context is available.

    Example output:
        "1. Emma Martinez (21 months, group 12-24m) — Loves sensory activities
        and music. Beginning to use 2-word phrases. [tags: 12-24m]
        2. Liam Chen (30 months, group 24-36m) — Very active and curious.
        Enjoys circle time and group activities. [tags: 24-36m]"
    """
    uid = uuid.UUID(user_id)

    async with async_session_factory() as session:
        result = await session.execute(
            select(Student)
            .where(Student.user_id == uid, Student.is_active.is_(True))
            .order_by(Student.name)
        )
        students = result.scalars().all()

    if not students:
        return (
            f"No student context available for user {user_id}. "
            "The educator has not added any active students yet."
        )

    lines: list[str] = []
    for i, s in enumerate(students, start=1):
        bio_part = s.bio.strip() if s.bio else "No bio provided"
        tags_part = ", ".join(s.tags) if s.tags else "none"
        lines.append(
            f"{i}. {s.name} ({s.age_months} months, group {s.age_group}) "
            f"— {bio_part} [tags: {tags_part}]"
        )

    header = f"Student context for educator ({len(students)} active students):"
    return "\n".join([header, *lines])


# ── AI Generation ─────────────────────────────────────────────

THEME_SYSTEM_PROMPT = """\
You are an expert Montessori / early-childhood educator with 20+ years of \
experience designing weekly curriculum themes for infant and toddler classrooms \
(ages 0–36 months).

You will be given a summary of the children currently enrolled in the classroom, \
including their ages, developmental groups, bios, and educator-written notes. \
Use this information to generate unique, engaging, and developmentally \
appropriate weekly themes.

Rules:
- Each theme must be distinct — do not repeat names, emojis, or letters.
- Tailor themes to the specific ages and needs described in the student context.
- Palettes must use valid 6-digit hex codes (e.g. '#7A9B76').
- Circle-time details must be age-appropriate and connected to the theme.
- Activity examples should be hands-on, sensory-rich, and adaptable across the \
  age groups present in the classroom.
- Environment descriptions should be practical for a real daycare setting.
- IDs must be URL-safe kebab-case derived from the theme name.
"""


async def generate_theme_options(
    student_context: str,
    count: int = 5,
) -> list[ThemeSchema]:
    """Generate unique weekly theme options using Vertex AI / Gemini.

    This tool sends the student context to Gemini and requests structured
    JSON output conforming to the ThemeSchema Pydantic model. The AI acts
    as an expert early-childhood educator, producing themes tailored to the
    specific children in the classroom.

    Args:
        student_context: A formatted string describing the enrolled students
            (typically produced by fetch_student_context).
        count: Number of unique themes to generate (default 5).

    Returns:
        A list of ThemeSchema instances parsed from the AI response.

    Raises:
        ValueError: If the AI returns an empty or unparseable response.
    """
    user_prompt = (
        f"Here is the current classroom roster:\n\n"
        f"{student_context}\n\n"
        f"Generate exactly {count} unique weekly themes for this classroom."
    )

    response = await gemini_client.aio.models.generate_content(
        model=GEMINI_MODEL,
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=THEME_SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=list[ThemeSchema],
            temperature=1.0,
        ),
    )

    raw_text = response.text
    if not raw_text:
        raise ValueError(
            "Gemini returned an empty response. "
            "Check your Vertex AI quota and credentials."
        )

    # The SDK guarantees JSON conforming to response_schema.
    # Parse through Pydantic for validation and type safety.
    adapter = TypeAdapter(list[ThemeSchema])
    themes = adapter.validate_json(raw_text)

    if not themes:
        raise ValueError("Gemini returned an empty theme list.")

    return themes


# ── Pedagogy RAG Search ───────────────────────────────────────


async def query_pedagogy(query_text: str) -> str:
    """Search the curriculum vector store for developmentally appropriate pedagogy.

    Use this tool when the agent needs evidence-based Montessori or early-childhood
    education guidance to ground its curriculum decisions. The function performs a
    semantic search over the vector_store_curriculum table, returning the most
    relevant chunks from ingested pedagogy PDFs and research documents.

    The results help the agent:
      - Justify activity choices with real pedagogical references.
      - Align generated themes with Montessori principles.
      - Suggest age-appropriate adaptations backed by research.

    Args:
        query_text: A natural-language query describing the pedagogical topic
            (e.g. 'fine motor activities for 12-24 month toddlers',
            'sensory play benefits for infant development').

    Returns:
        A formatted string containing the top-k most relevant pedagogy excerpts,
        or a mock response while the vector store is being populated.
    """
    # ------------------------------------------------------------------
    # TODO [Phase 4]: Embed the query_text using Vertex AI embeddings.
    #
    #   from google import genai  # already imported at module level
    #
    #   embed_response = await gemini_client.aio.models.embed_content(
    #       model="text-embedding-004",
    #       contents=query_text,
    #   )
    #   query_vector = embed_response.embeddings[0].values
    # ------------------------------------------------------------------

    # ------------------------------------------------------------------
    # TODO [Phase 4]: Perform pgvector cosine similarity search.
    #
    #   from app.db.models import VectorStoreCurriculum, EMBEDDING_DIM
    #
    #   async with async_session_factory() as session:
    #       results = await session.execute(
    #           select(
    #               VectorStoreCurriculum.content,
    #               VectorStoreCurriculum.source_document,
    #               VectorStoreCurriculum.metadata_,
    #               VectorStoreCurriculum.embedding.cosine_distance(query_vector)
    #                   .label("distance"),
    #           )
    #           .order_by("distance")
    #           .limit(5)
    #       )
    #       chunks = results.all()
    #
    #   if not chunks:
    #       return "No relevant pedagogy found for this query."
    #
    #   return "\n\n---\n\n".join(
    #       f"[{c.source_document}] {c.content}" for c in chunks
    #   )
    # ------------------------------------------------------------------

    # Mock response until the vector store is populated with real PDFs.
    mock_results = {
        "fine motor": (
            "Pedagogy reference (mock):\n"
            "To develop fine motor skills in toddlers (12–24 months), consider "
            "sensory bins with large wooden scoops, threading activities with "
            "oversized beads, and playdough manipulation. Montessori principles "
            "recommend allowing the child to self-select materials and work at "
            "their own pace. For younger infants, soft stacking rings and "
            "grasping toys support palmar-to-pincer grip development."
        ),
        "sensory": (
            "Pedagogy reference (mock):\n"
            "Sensory play is foundational for cognitive development in the first "
            "three years. Water play, sand tables, and textured fabric boards "
            "support tactile discrimination. Montessori environments encourage "
            "natural materials (wood, cotton, wool) over plastic. Rotate sensory "
            "stations weekly to maintain novelty and exploration drive."
        ),
        "gross motor": (
            "Pedagogy reference (mock):\n"
            "Gross motor milestones for 12–36 months include walking, climbing, "
            "and beginning to jump. Obstacle courses with soft tunnels, balance "
            "beams (low to ground), and large-ball kicking activities are "
            "developmentally appropriate. Ensure at least 30 minutes of active "
            "movement per session. Outdoor time is critical for spatial awareness."
        ),
        "language": (
            "Pedagogy reference (mock):\n"
            "Language development between 12–36 months accelerates rapidly. "
            "Naming games, picture-book dialogic reading, and song repetition "
            "support vocabulary growth. Montessori three-period lessons (naming, "
            "recognition, recall) are effective for introducing new concepts. "
            "Reduce screen time; prioritise face-to-face verbal interaction."
        ),
    }

    query_lower = query_text.lower()
    for keyword, response in mock_results.items():
        if keyword in query_lower:
            return response

    return (
        "Pedagogy reference (mock):\n"
        "Early childhood best practices emphasise child-led exploration, "
        "multi-sensory engagement, and scaffolded learning across developmental "
        "domains. Activities should be adaptable for mixed-age groups (0–36 "
        "months) and grounded in observation-based planning. Rotate materials "
        "weekly to sustain interest and challenge."
    )
