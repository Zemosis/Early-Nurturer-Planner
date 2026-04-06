"""
Chat Service — Lightweight Gemini-powered curriculum assistant.

Separate from the heavy LangGraph planner pipeline. Provides fast (~2s)
conversational responses with optional structured activity edits via
Gemini function calling.
"""

import asyncio
import copy
import json
import logging
import uuid
from datetime import datetime, timezone

from google import genai
from google.genai import types
from pydantic import BaseModel
from sqlalchemy import select, func, desc

from app.db.database import async_session_factory
from app.db.models import ChatHistory, WeeklyPlan, Student
from config import settings

logger = logging.getLogger(__name__)

# ── Gemini client (reuse same pattern as architect.py) ───────
gemini_client = genai.Client(
    vertexai=True,
    project=settings.GCP_PROJECT_ID,
    location=settings.VERTEX_AI_LOCATION,
)

GEMINI_MODEL = "gemini-2.5-flash"
TOKEN_LIMIT = 30_000


# ── ChatActivityEdit model ──────────────────────────────────

class ChatActivityEdit(BaseModel):
    """Simplified activity edit for chat function calling.

    All fields except activity_id are optional — Gemini only fills
    what changed. PATCH semantics: merge onto existing activity.
    """
    activity_id: str
    title: str | None = None
    domain: str | None = None
    duration: int | None = None
    description: str | None = None
    theme_connection: str | None = None
    materials: list[str] | None = None
    safety_notes: str | None = None
    adaptations: list[dict] | None = None
    reflection_prompts: list[str] | None = None


# ── Gemini function declaration for edit_activity ────────────

EDIT_ACTIVITY_TOOL = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="edit_activity",
            description=(
                "Modify a specific activity in the weekly plan. "
                "Only include fields that need changing. "
                "The activity_id must match an existing activity."
            ),
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "activity_id": types.Schema(
                        type="STRING",
                        description="The kebab-case ID of the activity to edit",
                    ),
                    "title": types.Schema(type="STRING", description="New title"),
                    "domain": types.Schema(type="STRING", description="New developmental domain"),
                    "duration": types.Schema(type="INTEGER", description="New duration in minutes"),
                    "description": types.Schema(type="STRING", description="New description"),
                    "theme_connection": types.Schema(type="STRING", description="New theme connection"),
                    "materials": types.Schema(
                        type="ARRAY",
                        items=types.Schema(type="STRING"),
                        description="New materials list",
                    ),
                    "safety_notes": types.Schema(type="STRING", description="New safety notes"),
                    "adaptations": types.Schema(
                        type="ARRAY",
                        items=types.Schema(
                            type="OBJECT",
                            properties={
                                "age_group": types.Schema(type="STRING"),
                                "description": types.Schema(type="STRING"),
                                "modifications": types.Schema(
                                    type="ARRAY",
                                    items=types.Schema(type="STRING"),
                                ),
                            },
                            required=["age_group", "description", "modifications"],
                        ),
                        description="New adaptations list",
                    ),
                    "reflection_prompts": types.Schema(
                        type="ARRAY",
                        items=types.Schema(type="STRING"),
                        description="New reflection prompts",
                    ),
                },
                required=["activity_id"],
            ),
        )
    ]
)

# ── System prompt ────────────────────────────────────────────

CHAT_SYSTEM_PROMPT = """\
You are **Nuri**, a senior early childhood curriculum specialist with 15 years \
of experience in infant and toddler classrooms (ages 0-36 months). You work \
alongside the educator as a trusted mentor and planning partner.

You have FULL access to the weekly curriculum plan — every activity's \
description, materials, adaptations, safety notes, and reflection prompts. \
You also know the children in the classroom by name, age, and developmental \
profile. Use this knowledge confidently and specifically.

## How to respond

**When asked about the plan or an activity:**
- Reference the activity by name and quote its description, materials, or \
  adaptations directly. Never say "I don't have that information."
- If the educator asks about a specific day, list all activities for that day \
  with their domains, durations, and key details.
- When relevant, mention which children would benefit most and why, based on \
  their age group and developmental notes.

**When asked to modify an activity:**
- Call the `edit_activity` function with the activity's `activity_id` and ONLY \
  the fields that need changing.
- Explain what you changed and why in your text response.
- Always preserve or improve `safety_notes` and `adaptations` — never remove them.
- Consider the enrolled children's ages and developmental needs when suggesting \
  modifications.

**When asked general pedagogy questions:**
- Ground advice in developmentally appropriate practice for infants/toddlers.
- Connect recommendations to the current week's theme when possible.
- Suggest practical, classroom-ready ideas — not textbook theory.

## Tone
Warm, concise, and practical. Think experienced colleague, not chatbot. \
Use the children's names naturally when relevant. Keep responses focused — \
educators are busy professionals.
"""


# ── Thread management ────────────────────────────────────────

async def get_or_create_thread(
    user_id: str, plan_context: dict | None = None
) -> str:
    """Find the user's latest active thread, or create a new one.

    If plan_context is provided, it's stored in the first system message's
    metadata so subsequent messages don't need to resend it.
    """
    async with async_session_factory() as session:
        # Look for existing thread
        result = await session.execute(
            select(ChatHistory.thread_id)
            .where(ChatHistory.user_id == user_id)
            .order_by(desc(ChatHistory.created_at))
            .limit(1)
        )
        row = result.scalar_one_or_none()

        if row and plan_context is None:
            return row

        # Create new thread
        thread_id = str(uuid.uuid4())
        system_msg = ChatHistory(
            user_id=user_id,
            thread_id=thread_id,
            role="system",
            content="Chat thread initialized.",
            metadata_={"plan_context": plan_context} if plan_context else {},
        )
        session.add(system_msg)
        await session.commit()
        return thread_id


async def create_new_thread(
    user_id: str, plan_context: dict | None = None
) -> str:
    """Force-create a new thread."""
    thread_id = str(uuid.uuid4())
    async with async_session_factory() as session:
        system_msg = ChatHistory(
            user_id=user_id,
            thread_id=thread_id,
            role="system",
            content="Chat thread initialized.",
            metadata_={"plan_context": plan_context} if plan_context else {},
        )
        session.add(system_msg)
        await session.commit()
    return thread_id


async def get_thread_history(
    thread_id: str, cursor: str | None = None, limit: int = 50
) -> dict:
    """Fetch messages with cursor-based pagination (ordered by created_at)."""
    async with async_session_factory() as session:
        query = (
            select(ChatHistory)
            .where(ChatHistory.thread_id == thread_id)
            .order_by(ChatHistory.created_at)
        )

        if cursor:
            query = query.where(ChatHistory.created_at > cursor)

        query = query.limit(limit + 1)  # Fetch one extra to detect next page
        result = await session.execute(query)
        rows = result.scalars().all()

        has_more = len(rows) > limit
        messages = rows[:limit]

        next_cursor = None
        if has_more and messages:
            next_cursor = messages[-1].created_at.isoformat()

        return {
            "messages": [
                {
                    "id": str(m.id),
                    "role": m.role,
                    "content": m.content,
                    "metadata": m.metadata_ or {},
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                }
                for m in messages
                if m.role != "system"  # Don't expose system messages to frontend
            ],
            "next_cursor": next_cursor,
        }


async def list_threads(user_id: str) -> list[dict]:
    """List user's threads with preview and message count."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(ChatHistory.thread_id)
            .where(ChatHistory.user_id == user_id)
            .group_by(ChatHistory.thread_id)
            .order_by(func.max(ChatHistory.created_at).desc())
        )
        thread_ids = [r[0] for r in result.all()]

        threads = []
        for tid in thread_ids:
            # Get first user message as preview
            preview_result = await session.execute(
                select(ChatHistory.content)
                .where(
                    ChatHistory.thread_id == tid,
                    ChatHistory.role == "user",
                )
                .order_by(ChatHistory.created_at)
                .limit(1)
            )
            preview = preview_result.scalar_one_or_none() or ""

            # Get message count (excluding system)
            count_result = await session.execute(
                select(func.count())
                .where(
                    ChatHistory.thread_id == tid,
                    ChatHistory.role != "system",
                )
            )
            count = count_result.scalar() or 0

            # Get created_at from first message
            created_result = await session.execute(
                select(ChatHistory.created_at)
                .where(ChatHistory.thread_id == tid)
                .order_by(ChatHistory.created_at)
                .limit(1)
            )
            created_at = created_result.scalar_one_or_none()

            threads.append({
                "thread_id": tid,
                "created_at": created_at.isoformat() if created_at else None,
                "preview": preview[:100] if preview else "",
                "message_count": count,
            })

        return threads


# ── Token counting ───────────────────────────────────────────

def _estimate_tokens(text: str) -> int:
    """Rough token estimate using chars/4 heuristic."""
    return len(text) // 4


def _count_thread_tokens(messages: list[dict]) -> int:
    """Estimate total tokens in a thread's messages."""
    return sum(_estimate_tokens(m.get("content", "")) for m in messages)


# ── Plan context helpers ─────────────────────────────────────

async def _get_plan_context_from_thread(thread_id: str) -> dict | None:
    """Retrieve plan context stored in the thread's system message metadata."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(ChatHistory.metadata_)
            .where(
                ChatHistory.thread_id == thread_id,
                ChatHistory.role == "system",
            )
            .order_by(ChatHistory.created_at)
            .limit(1)
        )
        metadata = result.scalar_one_or_none()
        if metadata and isinstance(metadata, dict):
            return metadata.get("plan_context")
        return None


# ── Student roster helper ────────────────────────────────────

async def _fetch_student_roster(user_id: str) -> str | None:
    """Fetch active students and format as a markdown section for the system prompt."""
    try:
        user_uid = uuid.UUID(user_id)
    except ValueError:
        return None

    async with async_session_factory() as session:
        result = await session.execute(
            select(Student)
            .where(Student.user_id == user_uid, Student.is_active == True)
            .order_by(Student.name)
        )
        students = result.scalars().all()

    if not students:
        return None

    lines = ["\n\n## Student Roster"]
    for s in students:
        tags_str = ", ".join(s.tags) if s.tags else ""
        line = f"- **{s.name}** — {s.age_months}mo ({s.age_group})"
        if tags_str:
            line += f" | Tags: {tags_str}"
        if s.bio:
            line += f" | Notes: {s.bio}"
        lines.append(line)

    return "\n".join(lines)


# ── Plan context formatting ─────────────────────────────────

def _format_plan_context_markdown(ctx: dict) -> str:
    """Format plan context as structured markdown for better Gemini comprehension."""
    parts = []

    theme = ctx.get("theme", "Unknown")
    week = ctx.get("week_number", "?")
    parts.append(f"\n\n## Weekly Plan: {theme} (Week {week})")

    # Objectives
    objectives = ctx.get("objectives", [])
    if objectives:
        parts.append("\n### Objectives")
        for obj in objectives:
            parts.append(f"- **{obj.get('domain', '')}**: {obj.get('goal', '')}")

    # Circle time
    ct = ctx.get("circle_time", {})
    if ct:
        parts.append(
            f"\n### Circle Time\n"
            f"- Letter of the week: **{ct.get('letter', '?')}**\n"
            f"- Color: **{ct.get('color', '?')}**\n"
            f"- Shape: **{ct.get('shape', '?')}**\n"
            f"- Counting to: **{ct.get('counting_to', '?')}**"
        )

    # Activities grouped by day
    activities = ctx.get("activities", [])
    if activities:
        parts.append("\n### Activities")
        days_seen: dict[str, list] = {}
        for act in activities:
            day = act.get("day", "Unknown")
            days_seen.setdefault(day, []).append(act)

        for day, day_acts in days_seen.items():
            parts.append(f"\n#### {day}")
            for act in day_acts:
                parts.append(
                    f"**{act.get('title', 'Untitled')}** "
                    f"(ID: `{act.get('id', '')}`) — "
                    f"{act.get('domain', '')} | {act.get('duration', '?')} min"
                )
                desc = act.get("description", "")
                if desc:
                    parts.append(f"  Description: {desc}")
                mats = act.get("materials", [])
                if mats:
                    parts.append(f"  Materials: {', '.join(mats)}")
                tc = act.get("theme_connection", "")
                if tc:
                    parts.append(f"  Theme connection: {tc}")
                sn = act.get("safety_notes", "")
                if sn:
                    parts.append(f"  Safety: {sn}")
                adaptations = act.get("adaptations", [])
                if adaptations:
                    adapt_strs = [
                        f"{a.get('age_group', '?')}: {a.get('description', '')}"
                        for a in adaptations
                    ]
                    parts.append(f"  Adaptations: {' | '.join(adapt_strs)}")
                rp = act.get("reflection_prompts", [])
                if rp:
                    parts.append(f"  Reflection: {'; '.join(rp)}")

    return "\n".join(parts)


# ── Main send_message function ───────────────────────────────

async def send_message(
    user_id: str,
    thread_id: str,
    user_message: str,
    plan_context: dict | None = None,
) -> dict:
    """Send a message and get an AI response.

    Returns:
        {
            "thread_id": str,
            "message": { id, role, content, metadata, created_at },
            "activity_edit": dict | None,
            "thread_rotated": bool,
        }
    """
    thread_rotated = False

    # If plan_context provided (first message), store it
    if plan_context:
        async with async_session_factory() as session:
            result = await session.execute(
                select(ChatHistory)
                .where(
                    ChatHistory.thread_id == thread_id,
                    ChatHistory.role == "system",
                )
                .order_by(ChatHistory.created_at)
                .limit(1)
            )
            system_msg = result.scalar_one_or_none()
            if system_msg:
                meta = system_msg.metadata_ or {}
                meta["plan_context"] = plan_context
                system_msg.metadata_ = meta
                await session.commit()

    # Load thread history
    history_data = await get_thread_history(thread_id, limit=200)
    messages = history_data["messages"]

    # Check token budget — rotate thread if needed
    total_tokens = _count_thread_tokens(messages) + _estimate_tokens(user_message)
    if total_tokens >= TOKEN_LIMIT and len(messages) > 0:
        # Get plan context and last assistant message from old thread
        old_plan_context = await _get_plan_context_from_thread(thread_id)
        last_assistant = None
        applied_edits = []
        for m in reversed(messages):
            if m["role"] == "assistant" and last_assistant is None:
                last_assistant = m["content"]
            meta = m.get("metadata", {})
            if meta.get("activity_edit"):
                applied_edits.append(meta["activity_edit"])

        # Create new thread with carryover context
        new_meta = {}
        if old_plan_context:
            new_meta["plan_context"] = old_plan_context
        if last_assistant:
            new_meta["previous_context"] = last_assistant[:500]
        if applied_edits:
            new_meta["applied_edits"] = applied_edits

        thread_id = str(uuid.uuid4())
        async with async_session_factory() as session:
            system_msg = ChatHistory(
                user_id=user_id,
                thread_id=thread_id,
                role="system",
                content="Thread rotated due to context limit.",
                metadata_=new_meta,
            )
            session.add(system_msg)
            await session.commit()

        # Reset for new thread
        messages = []
        thread_rotated = True

    # Save user message
    user_msg_id = uuid.uuid4()
    async with async_session_factory() as session:
        user_msg = ChatHistory(
            id=user_msg_id,
            user_id=user_id,
            thread_id=thread_id,
            role="user",
            content=user_message,
        )
        session.add(user_msg)
        await session.commit()

    # Build Gemini conversation
    stored_plan_context = plan_context or await _get_plan_context_from_thread(thread_id)

    system_parts = [CHAT_SYSTEM_PROMPT]

    # Format plan context as structured markdown (more natural for Gemini)
    if stored_plan_context:
        system_parts.append(_format_plan_context_markdown(stored_plan_context))

    # Fetch student roster (fresh each message so profile updates are reflected)
    roster_text = await _fetch_student_roster(user_id)
    if roster_text:
        system_parts.append(roster_text)

    # Get previous context note from rotated thread
    async with async_session_factory() as session:
        sys_result = await session.execute(
            select(ChatHistory.metadata_)
            .where(
                ChatHistory.thread_id == thread_id,
                ChatHistory.role == "system",
            )
            .order_by(ChatHistory.created_at)
            .limit(1)
        )
        sys_meta = sys_result.scalar_one_or_none() or {}

    if isinstance(sys_meta, dict):
        prev_ctx = sys_meta.get("previous_context")
        if prev_ctx:
            system_parts.append(
                f"\n\n## Previous Conversation Summary\n{prev_ctx}"
            )
        applied = sys_meta.get("applied_edits")
        if applied:
            system_parts.append(
                f"\n\n## Previously Applied Edits\n"
                f"```json\n{json.dumps(applied, indent=2)}\n```"
            )

    # Convert history to Gemini content format
    gemini_contents = []
    for m in messages:
        if m["role"] == "user":
            gemini_contents.append(
                types.Content(role="user", parts=[types.Part(text=m["content"])])
            )
        elif m["role"] == "assistant":
            gemini_contents.append(
                types.Content(role="model", parts=[types.Part(text=m["content"])])
            )

    # Add current user message
    gemini_contents.append(
        types.Content(role="user", parts=[types.Part(text=user_message)])
    )

    # Call Gemini with retry
    ai_text = ""
    activity_edit = None
    last_error = None

    for attempt in range(2):
        try:
            response = await gemini_client.aio.models.generate_content(
                model=GEMINI_MODEL,
                contents=gemini_contents,
                config=types.GenerateContentConfig(
                    system_instruction="\n".join(system_parts),
                    temperature=0.7,
                    max_output_tokens=4096,
                    tools=[EDIT_ACTIVITY_TOOL],
                ),
            )

            # Extract text and function calls from response
            ai_text = ""
            for candidate in response.candidates:
                for part in candidate.content.parts:
                    if part.text:
                        ai_text += part.text
                    elif part.function_call:
                        fc = part.function_call
                        if fc.name == "edit_activity":
                            args = dict(fc.args) if fc.args else {}
                            activity_edit = args

            if not ai_text and activity_edit:
                ai_text = "I've prepared an activity modification for you. Review the changes below and click Apply to update your plan."

            last_error = None
            break

        except Exception as e:
            last_error = e
            logger.warning("Gemini call attempt %d failed: %s", attempt + 1, e)
            if attempt == 0:
                await asyncio.sleep(2)

    if last_error:
        logger.error("Gemini call failed after retries: %s", last_error)
        error_text = "I'm having trouble connecting right now. Please try again in a moment."
        # Save error response
        assistant_msg_id = uuid.uuid4()
        async with async_session_factory() as session:
            assistant_msg = ChatHistory(
                id=assistant_msg_id,
                user_id=user_id,
                thread_id=thread_id,
                role="assistant",
                content=error_text,
                metadata_={"error": True, "error_code": "GEMINI_UNAVAILABLE"},
            )
            session.add(assistant_msg)
            await session.commit()

        return {
            "thread_id": thread_id,
            "message": {
                "id": str(assistant_msg_id),
                "role": "assistant",
                "content": error_text,
                "metadata": {"error": True, "error_code": "GEMINI_UNAVAILABLE"},
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
            "activity_edit": None,
            "thread_rotated": thread_rotated,
            "error": {"code": "GEMINI_UNAVAILABLE", "retryable": True},
        }

    # Save assistant response
    assistant_msg_id = uuid.uuid4()
    msg_metadata: dict = {}
    if activity_edit:
        msg_metadata["activity_edit"] = activity_edit

    async with async_session_factory() as session:
        assistant_msg = ChatHistory(
            id=assistant_msg_id,
            user_id=user_id,
            thread_id=thread_id,
            role="assistant",
            content=ai_text,
            metadata_=msg_metadata if msg_metadata else {},
        )
        session.add(assistant_msg)
        await session.commit()

    return {
        "thread_id": thread_id,
        "message": {
            "id": str(assistant_msg_id),
            "role": "assistant",
            "content": ai_text,
            "metadata": msg_metadata,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        "activity_edit": activity_edit,
        "thread_rotated": thread_rotated,
    }


# ── Apply activity edit to plan ──────────────────────────────

async def apply_activity_edit(
    user_id: str, plan_id: str, activity_id: str, edits: dict
) -> dict | None:
    """Merge partial activity edits onto the existing activity in the plan.

    WeeklyPlan stores activities as a flat JSONB list (not nested under
    daily_plans). We find the matching activity by id, merge the edits,
    and save back.

    Returns the full updated activity, or None if not found.
    """
    async with async_session_factory() as session:
        result = await session.execute(
            select(WeeklyPlan)
            .where(
                WeeklyPlan.id == plan_id,
                WeeklyPlan.user_id == user_id,
            )
        )
        plan = result.scalar_one_or_none()
        if not plan or not plan.activities:
            return None

        activities = copy.deepcopy(plan.activities)
        updated_activity = None

        for act in activities:
            if act.get("id") == activity_id:
                # Merge edits (only non-None fields)
                for key, value in edits.items():
                    if key == "activity_id":
                        continue
                    if value is not None:
                        act[key] = value
                updated_activity = act
                break

        if not updated_activity:
            return None

        plan.activities = activities
        await session.commit()

        return updated_activity
