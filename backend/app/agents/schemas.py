"""
Pydantic schemas for structured AI (Vertex AI / Gemini) outputs.

These models enforce the exact JSON shape that LangGraph agents must
produce, and double as documentation for the LLM via Field descriptions.

Frontend references:
  - src/app/utils/themeData.ts  — ThemeDetail interface
  - src/app/utils/mockData.ts   — WeekPlan interface
  - src/app/types/activity.ts   — DetailedActivity, AgeAdaptation, Material
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


# ══════════════════════════════════════════════════════════════
#  AUDITOR OUTPUT
# ══════════════════════════════════════════════════════════════


class AuditScores(BaseModel):
    """Numerical rubric the Safety Auditor assigns to a draft curriculum."""

    safety: int = Field(
        ...,
        description="Safety score (1–10). Evaluates whether materials, "
                    "activities, and environments are free from choking hazards, "
                    "sharp objects, toxic substances, and other risks for 0–36 month olds.",
    )
    developmental_fit: int = Field(
        ...,
        description="Developmental appropriateness score (1–10). Evaluates "
                    "whether activities match the age groups present in the "
                    "classroom and support realistic milestones.",
    )
    creativity: int = Field(
        ...,
        description="Creativity and engagement score (1–10). Evaluates "
                    "novelty, sensory richness, and likely child engagement.",
    )


class AuditResultSchema(BaseModel):
    """Structured output from the Safety Auditor agent.

    Maps directly to the critique_history DB table. The Auditor must
    produce this schema after reviewing the Architect's draft plan.
    """

    accepted: bool = Field(
        ...,
        description="True if the plan is safe and developmentally appropriate "
                    "and may proceed to personalisation. False if revisions are required.",
    )
    critique: str = Field(
        ...,
        description="If rejected: detailed, actionable feedback explaining every "
                    "issue and how to fix it. If accepted: brief praise highlighting "
                    "strengths of the plan.",
    )
    safety_concerns: list[str] = Field(
        default_factory=list,
        description="Specific hazards found — e.g. 'Small beads are a choking "
                    "hazard for the 12-month-old group', 'Glitter should not be "
                    "used with infants'. Empty list if no concerns.",
    )
    scores: AuditScores = Field(
        ...,
        description="Numerical rubric with safety, developmental_fit, and "
                    "creativity scores (each 1–10).",
    )


# ══════════════════════════════════════════════════════════════
#  WEEKLY CURRICULUM PLAN
# ══════════════════════════════════════════════════════════════

# ── Objective ─────────────────────────────────────────────────


class ObjectiveSchema(BaseModel):
    """A single developmental objective for the week."""

    domain: str = Field(
        ...,
        description="Developmental domain this objective targets "
                    "(e.g. 'Fine Motor', 'Language', 'Sensory', 'Cognitive', "
                    "'Gross Motor', 'Social-Emotional').",
    )
    goal: str = Field(
        ...,
        description="Clear, measurable goal sentence "
                    "(e.g. 'Practice pincer grasp through themed threading activities').",
    )


# ── Age Adaptation ────────────────────────────────────────────


class AgeAdaptationSchema(BaseModel):
    """How to modify an activity for a specific age group."""

    age_group: str = Field(
        ...,
        description="Target age band — must be one of: '0-12m' (infants), "
                    "'12-24m' (young toddlers), or '24-36m' (older toddlers).",
    )
    description: str = Field(
        ...,
        description="1–2 sentences explaining how to adapt the activity for "
                    "this age group (e.g. 'Provide hand-over-hand support with "
                    "edible finger paint on a tray').",
    )
    modifications: list[str] = Field(
        ...,
        description="Bullet-point list of concrete changes (at least 1) "
                    "(e.g. ['Use larger beads', 'Reduce duration to 5 minutes', "
                    "'Offer soft alternatives']).",
    )


# ── Activity ──────────────────────────────────────────────────


class ActivitySchema(BaseModel):
    """A single classroom activity within a daily plan.

    Combines the simple structure from WeekPlan.activities with richer
    fields from DetailedActivity (adaptations, safety notes, duration).
    """

    id: str = Field(
        ...,
        description="Unique kebab-case identifier "
                    "(e.g. 'monday-sensory-rain-exploration').",
    )
    day: str = Field(
        ...,
        description="Day of the week this activity is scheduled "
                    "(e.g. 'Monday', 'Tuesday').",
    )
    title: str = Field(
        ...,
        description="Short, descriptive activity title "
                    "(e.g. 'Gentle Rain Sensory Bin').",
    )
    domain: str = Field(
        ...,
        description="Primary developmental domain "
                    "(e.g. 'Sensory', 'Fine Motor', 'Language', 'Gross Motor', "
                    "'Cognitive', 'Social-Emotional').",
    )
    duration: int = Field(
        ...,
        description="Planned duration in minutes (5–60). Keep infant activities "
                    "short (5–10 min) and toddler activities moderate (15–30 min).",
    )
    description: str = Field(
        ...,
        description="2–4 sentence description of the activity, its purpose, "
                    "and how it connects to the weekly theme.",
    )
    theme_connection: str = Field(
        ...,
        description="One sentence explaining how this activity ties into the "
                    "week's theme (e.g. 'Children explore water droplets to "
                    "connect with the Gentle Rain theme').",
    )
    materials: list[str] = Field(
        ...,
        description="List of required materials (at least 1) "
                    "(e.g. ['Water table', 'Plastic cups', 'Blue food colouring']).",
    )
    safety_notes: str = Field(
        ...,
        description="Safety considerations specific to this activity "
                    "(e.g. 'Supervise water play at all times. Remove small items "
                    "when infants are present.'). Must never be empty.",
    )
    adaptations: list[AgeAdaptationSchema] = Field(
        ...,
        description="1–3 age-group adaptations explaining how to modify this "
                    "activity for infants, young toddlers, and/or older toddlers.",
    )
    reflection_prompts: list[str] = Field(
        ...,
        description="1–3 prompts for the educator to reflect on after the "
                    "activity (e.g. 'Which children showed sustained interest?', "
                    "'Were adaptations sufficient for the youngest group?').",
    )


# ── Circle Time ───────────────────────────────────────────────


class SongSchema(BaseModel):
    """A song used during circle time (greeting or goodbye)."""

    title: str = Field(
        ...,
        description="Song title (e.g. 'Hello Forest Friends').",
    )
    script: str = Field(
        ...,
        description="Full lyrics or a 4–8 line script the educator can sing "
                    "or chant with the children.",
    )
    duration: str = Field(
        ...,
        description="Approximate duration as a string (e.g. '2:30').",
    )


class YogaPoseSchema(BaseModel):
    """A toddler-friendly yoga or movement pose for circle time.

    The Architect only fills in `name` with thematic keywords.
    The Enricher overwrites all fields from the yoga_poses DB table.
    """

    name: str = Field(
        ...,
        description="Pose name or thematic keyword phrase "
                    "(e.g. 'Tree Pose', 'forest animals'). "
                    "The Enricher will replace this with the real pose name.",
    )
    image_url: str = Field(
        default="",
        description="Public GCS URL to the pose photo. "
                    "Leave empty — filled by the Enricher.",
    )
    how_to: list[str] = Field(
        default_factory=list,
        description="Step-by-step instructions. "
                    "Leave empty — filled by the Enricher.",
    )
    creative_cues: list[str] = Field(
        default_factory=list,
        description="Kid-friendly creative cues. "
                    "Leave empty — filled by the Enricher.",
    )


class CircleTimeSchema(BaseModel):
    """Full circle-time plan for the week.

    Generated by the Architect. Media URLs (YouTube videos) are
    curated separately — the AI generates the educational content only.
    """

    letter: str = Field(
        ...,
        description="Single letter of the week (e.g. 'R' for a rain theme).",
    )
    color: str = Field(
        ...,
        description="Color of the week (e.g. 'Blue').",
    )
    shape: str = Field(
        ...,
        description="Shape of the week (e.g. 'Circle').",
    )
    counting_to: int = Field(
        ...,
        description="Number the class is counting up to this week (1–20).",
    )
    greeting_song: SongSchema = Field(
        ...,
        description="Theme-flavored greeting song to open circle time.",
    )
    goodbye_song: SongSchema = Field(
        ...,
        description="Calming goodbye song to close circle time.",
    )
    yoga_poses: list[YogaPoseSchema] = Field(
        ...,
        description="2–5 toddler-friendly yoga or movement poses tied to the theme.",
    )
    read_aloud: str = Field(
        ...,
        description="Title and brief description of a recommended read-aloud "
                    "book for the week (e.g. 'The Very Hungry Caterpillar — "
                    "supports counting and sequencing').",
    )
    discussion_prompt: str = Field(
        ...,
        description="An open-ended question to spark group discussion "
                    "(e.g. 'What sounds do you hear when it rains?').",
    )


# ── Daily Plan ────────────────────────────────────────────────


class DailyPlanSchema(BaseModel):
    """A single day's schedule within the weekly curriculum."""

    day: str = Field(
        ...,
        description="Day name (e.g. 'Monday', 'Tuesday', 'Wednesday', "
                    "'Thursday', 'Friday').",
    )
    focus_domain: str = Field(
        ...,
        description="The primary developmental domain for this day "
                    "(e.g. 'Sensory' on Monday, 'Gross Motor' on Tuesday).",
    )
    activities: list[ActivitySchema] = Field(
        ...,
        description="Exactly 1 activity scheduled for this day, targeting "
                    "the focus domain.",
    )


# ── Newsletter ────────────────────────────────────────────────


class NewsletterSchema(BaseModel):
    """Parent-facing newsletter summarising the week's learning."""

    welcome_message: str = Field(
        ...,
        description="A warm 2–3 sentence opening addressing families and "
                    "introducing the week's theme.",
    )
    learning_goals: list[str] = Field(
        ...,
        description="2–5 bullet points summarising what children practised "
                    "and learned this week.",
    )
    home_connection: str = Field(
        ...,
        description="A practical suggestion for families to extend learning "
                    "at home (e.g. 'Try collecting leaves on your walk and "
                    "talking about their colours and shapes').",
    )
    professional_version: str = Field(
        ...,
        description="Formal, professional newsletter text suitable for "
                    "licensing documentation. 1–2 paragraphs.",
    )
    warm_version: str = Field(
        ...,
        description="Friendly, emoji-rich newsletter text for casual parent "
                    "communication. 1–2 paragraphs.",
    )


# ── Top-level Week Plan ──────────────────────────────────────


class WeekPlanSchema(BaseModel):
    """Complete weekly curriculum plan — the master output of the Architect agent.

    This schema represents a full 5-day curriculum including circle time,
    daily activities with age adaptations, and a parent newsletter. It
    maps to the frontend WeekPlan interface and the weekly_plans DB table.
    """

    id: str = Field(
        ...,
        description="Unique identifier for this week plan "
                    "(e.g. 'week-1-gentle-rain').",
    )
    week_number: int = Field(
        ...,
        description="Week number in the curriculum year (1-based).",
    )
    week_range: str = Field(
        ...,
        description="Date range string (e.g. '3/10 - 3/14').",
    )
    theme: str = Field(
        ...,
        description="Theme name for this week (e.g. 'Gentle Rain').",
    )
    theme_emoji: str = Field(
        ...,
        description="Emoji representing the theme (e.g. '🌧️').",
    )
    palette: ThemePalette = Field(
        ...,
        description="Four-color hex palette for this week's UI surfaces.",
    )
    domains: list[str] = Field(
        ...,
        description="Developmental domains covered this week (at least 2) "
                    "(e.g. ['Fine Motor', 'Language', 'Sensory', 'Gross Motor']).",
    )
    objectives: list[ObjectiveSchema] = Field(
        ...,
        description="2+ developmental objectives for the week, each tied to a domain.",
    )
    circle_time: CircleTimeSchema = Field(
        ...,
        description="Full circle-time plan: letter, color, shape, songs, "
                    "yoga poses, read-aloud, and discussion prompt.",
    )
    daily_plans: list[DailyPlanSchema] = Field(
        ...,
        description="Exactly 5 daily plans (Monday through Friday), each with "
                    "a focus domain and exactly 1 activity.",
    )
    newsletter: NewsletterSchema = Field(
        ...,
        description="Parent-facing newsletter with formal and warm versions, "
                    "learning goals, and a home-connection suggestion.",
    )
