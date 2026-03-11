"""
FastAPI router — Theme Generation.

Exposes the AI-powered theme generation pipeline to the frontend.
The educator's student roster is fetched from the DB, then Gemini
generates tailored weekly theme options based on the children's
ages, developmental groups, and needs.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agents.tools import fetch_student_context, generate_theme_options

router = APIRouter(prefix="/api/themes", tags=["Themes"])


# ── Request schema ────────────────────────────────────────────


class GenerateThemesRequest(BaseModel):
    """Payload for the theme generation endpoint."""

    user_id: str
    theme_count: int = 5


# ── Endpoints ─────────────────────────────────────────────────


@router.post("/generate")
async def generate_themes(request: GenerateThemesRequest):
    """Generate AI-powered weekly theme options for an educator's classroom.

    Fetches the educator's student roster, then calls Gemini to produce
    structured theme suggestions tailored to the enrolled children.

    Returns:
        A list of ThemeSchema dicts.
    """
    # 1. Fetch student context
    student_context = await fetch_student_context(request.user_id)

    if not student_context or "No student context available" in student_context:
        raise HTTPException(
            status_code=404,
            detail="No active students found for this educator. "
                   "Please add students before generating themes.",
        )

    # 2. Generate themes via Gemini
    try:
        themes = await generate_theme_options(student_context, request.theme_count)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Theme generation failed: {e}",
        )

    return [theme.model_dump() for theme in themes]
