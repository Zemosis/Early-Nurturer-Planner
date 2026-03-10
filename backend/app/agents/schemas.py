"""
Pydantic schemas for structured AI (Vertex AI / Gemini) outputs.

These models enforce the exact JSON shape that LangGraph agents must
produce, and double as documentation for the LLM via Field descriptions.

Frontend reference: src/app/utils/themeData.ts — ThemeDetail interface.
"""

from pydantic import BaseModel, Field


# ── Palette ───────────────────────────────────────────────────


class ThemePalette(BaseModel):
    """Hex color palette that drives the entire UI for a given theme week."""

    primary: str = Field(
        ...,
        description="Primary hex color code (e.g. '#7A9B76'). Used for headers, "
                    "buttons, and dominant UI surfaces.",
    )
    secondary: str = Field(
        ...,
        description="Secondary hex color code (e.g. '#8B6F47'). Used for "
                    "supporting elements, borders, and secondary text.",
    )
    accent: str = Field(
        ...,
        description="Accent hex color code (e.g. '#D4845B'). Used for highlights, "
                    "badges, and call-to-action elements.",
    )
    background: str = Field(
        ...,
        description="Background hex color code (e.g. '#F5F1E8'). A soft, neutral "
                    "tone used as the page/card background.",
    )


# ── Circle Time ───────────────────────────────────────────────


class ThemeCircleTime(BaseModel):
    """Circle-time integration details tied to the weekly theme."""

    greeting_style: str = Field(
        ...,
        description="A warm, theme-flavored greeting sentence the educator uses "
                    "to open circle time (e.g. 'Hello forest friends!').",
    )
    counting_context: str = Field(
        ...,
        description="A theme-relevant context for the daily counting exercise "
                    "(e.g. 'Counting forest animals — squirrels, foxes, birds').",
    )
    letter_examples: list[str] = Field(
        ...,
        min_length=3,
        max_length=6,
        description="3–6 words that start with the theme's featured letter "
                    "(e.g. ['Fox', 'Forest', 'Fern', 'Feather']).",
    )
    movement_prompt: str = Field(
        ...,
        description="A short movement cue inspired by the theme "
                    "(e.g. 'Sneak quietly like a fox through the forest').",
    )
    color: str = Field(
        ...,
        description="The color-of-the-week name tied to the theme "
                    "(e.g. 'Orange' for a fox theme).",
    )


# ── Activity Example ──────────────────────────────────────────


class ThemeActivityExample(BaseModel):
    """A brief activity idea suggested by the theme — not a full lesson plan."""

    title: str = Field(
        ...,
        description="Short, descriptive activity title (e.g. 'Leaf Rubbing Art').",
    )
    description: str = Field(
        ...,
        description="One- to two-sentence explanation of the activity and its "
                    "developmental purpose.",
    )
    materials: list[str] = Field(
        ...,
        min_length=1,
        description="List of materials needed (e.g. ['Leaves', 'Crayons', 'Paper']).",
    )


# ── Environment ───────────────────────────────────────────────


class ThemeEnvironment(BaseModel):
    """Describes the physical classroom environment styling for the theme."""

    description: str = Field(
        ...,
        description="A narrative sentence describing the overall room feel "
                    "(e.g. 'A cozy woodland corner with soft earth tones').",
    )
    visual_elements: list[str] = Field(
        ...,
        min_length=2,
        description="Specific decoration ideas or props "
                    "(e.g. ['Tree branch display', 'Leaf garland', 'Plush fox']).",
    )
    ambiance: str = Field(
        ...,
        description="The sensory ambiance of the room — sounds, lighting, textures "
                    "(e.g. 'Soft nature sounds, warm lamp lighting').",
    )


# ── Top-level Theme ───────────────────────────────────────────


class ThemeSchema(BaseModel):
    """Complete theme definition matching the frontend ThemeDetail interface.

    This is the structured output schema that Vertex AI / Gemini must
    conform to when generating a new weekly theme.
    """

    id: str = Field(
        ...,
        description="URL-safe, kebab-case identifier derived from the theme name "
                    "(e.g. 'fox-forest').",
    )
    name: str = Field(
        ...,
        description="Human-readable theme name (e.g. 'Fox Forest').",
    )
    emoji: str = Field(
        ...,
        description="A single emoji that visually represents the theme (e.g. '🦊').",
    )
    letter: str = Field(
        ...,
        max_length=1,
        description="The letter of the week associated with this theme (e.g. 'F').",
    )
    shape: str = Field(
        ...,
        description="The shape of the week tied to the theme (e.g. 'Triangle').",
    )
    mood: str = Field(
        ...,
        description="Comma-separated mood/tone descriptors that guide visual and "
                    "activity design (e.g. 'Cozy, woodland, curious, playful but calm').",
    )
    atmosphere: list[str] = Field(
        ...,
        min_length=2,
        max_length=6,
        description="2–6 short atmosphere tags capturing the theme's vibe "
                    "(e.g. ['Cozy', 'Woodland', 'Curious', 'Calm Playfulness']).",
    )
    visual_direction: str = Field(
        ...,
        description="Art-direction note for designers and the PDF generator "
                    "(e.g. 'Soft forest greens, warm rust tones, tree silhouettes').",
    )
    palette: ThemePalette = Field(
        ...,
        description="Four-color hex palette that drives all UI surfaces for this theme.",
    )
    circle_time: ThemeCircleTime = Field(
        ...,
        description="Circle-time integration: greeting, counting context, letter "
                    "examples, movement prompt, and color of the week.",
    )
    activities: list[ThemeActivityExample] = Field(
        ...,
        min_length=1,
        description="Example activity ideas that align with the theme.",
    )
    environment: ThemeEnvironment = Field(
        ...,
        description="Classroom environment styling: description, visual elements, "
                    "and sensory ambiance.",
    )
