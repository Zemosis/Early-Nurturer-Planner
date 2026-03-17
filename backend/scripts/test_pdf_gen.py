"""
Standalone test script for PDF generation.

Supports two modes:
  --from-db   Fetch the most recent plan from PostgreSQL
  (default)   Use a hardcoded dummy curriculum with enriched media fields

Usage:
    cd backend
    python -m scripts.test_pdf_gen            # dummy data
    python -m scripts.test_pdf_gen --from-db  # live DB data
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Ensure backend root is on sys.path so `app.*` imports work
BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.services.pdf_service import generate_weekly_pdf  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)


# ── DB fetch mode ────────────────────────────────────────────

async def fetch_latest_plan() -> dict | None:
    """Query the most recent WeeklyPlan row from the database."""
    from sqlalchemy import select
    from app.db.database import async_session_factory
    from app.db.models import WeeklyPlan

    async with async_session_factory() as session:
        result = await session.execute(
            select(WeeklyPlan)
            .order_by(WeeklyPlan.created_at.desc())
            .limit(1)
        )
        row = result.scalar_one_or_none()

    if not row:
        return None

    # Rebuild daily_plans from the flat activities list
    days_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    day_map: dict[str, list[dict]] = {d: [] for d in days_order}
    for activity in (row.activities or []):
        day = activity.get("day", "Monday")
        day_map.setdefault(day, []).append(activity)

    daily_plans = []
    for day_name in days_order:
        acts = day_map.get(day_name, [])
        if acts:
            daily_plans.append({
                "day": day_name,
                "focus_domain": acts[0].get("domain", ""),
                "activities": acts,
            })

    return {
        "theme": row.theme,
        "theme_emoji": row.theme_emoji,
        "week_number": row.week_number,
        "week_range": row.week_range,
        "palette": row.palette,
        "domains": row.domains,
        "objectives": row.objectives,
        "circle_time": row.circle_time,
        "daily_plans": daily_plans,
        "newsletter": row.newsletter,
        "cover_image_url": getattr(row, "cover_image_url", None),
    }


# ── Hardcoded dummy data (matches enriched pipeline output) ──

DUMMY_CURRICULUM = {
    "id": "week-1-gentle-rain",
    "week_number": 1,
    "week_range": "3/10 - 3/14",
    "theme": "Gentle Rain",
    "theme_emoji": "\U0001f327\ufe0f",
    "palette": {
        "primary": "#5B8FA8",
        "secondary": "#7A6B5D",
        "accent": "#9DC3C1",
        "background": "#F0F4F3",
    },
    "domains": ["Sensory", "Fine Motor", "Language", "Gross Motor", "Cognitive"],
    "objectives": [
        {"domain": "Sensory", "goal": "Explore water textures and sounds through rain-themed sensory play."},
        {"domain": "Fine Motor", "goal": "Practice pincer grasp by placing raindrops on contact paper."},
        {"domain": "Language", "goal": "Expand weather vocabulary through songs and read-alouds."},
        {"domain": "Gross Motor", "goal": "Develop balance and coordination with puddle-jump movement activities."},
    ],
    "circle_time": {
        "letter": "R",
        "color": "Blue",
        "shape": "Circle",
        "counting_to": 10,
        "greeting_song": {
            "title": "Good Morning Rain Song for Toddlers",
            "script": (
                "Hello, hello, hello rainy day friends!\n"
                "The clouds are soft, the rain descends.\n"
                "We'll splash and play and sing all day,\n"
                "Hello, hello, hello rainy day friends!"
            ),
            "duration": "2:14",
            "youtube_url": "https://www.youtube.com/embed/aFXYVkHkLJo",
        },
        "goodbye_song": {
            "title": "Goodbye Rain Goodbye Song for Kids",
            "script": (
                "Raindrops falling, soft and slow,\n"
                "Time to wave and time to go.\n"
                "We learned and played the rainy way,\n"
                "See you on another day!"
            ),
            "duration": "1:47",
            "youtube_url": "https://www.youtube.com/embed/lQ8KNyUkKNM",
        },
        "yoga_poses": [
            {
                "name": "Tree Pose",
                "image_url": "https://storage.googleapis.com/early-nurturer-planner-assets/yoga/tree-pose.png",
                "how_to": [
                    "Stand tall like a strong tree in the rain.",
                    "Lift one foot and place it on your opposite ankle.",
                    "Raise your arms like branches reaching for the clouds.",
                    "Hold for 5 breaths, then switch sides.",
                ],
                "creative_cues": [
                    "Imagine rain tickling your leaves!",
                    "Sway gently like a tree in a storm.",
                ],
            },
            {
                "name": "Cat-Cow Pose",
                "image_url": "https://storage.googleapis.com/early-nurturer-planner-assets/yoga/cat-cow.png",
                "how_to": [
                    "Get on all fours like a cat.",
                    "Arch your back up high like a scared cat (Cat).",
                    "Then drop your tummy low and look up (Cow).",
                    "Move slowly back and forth 5 times.",
                ],
                "creative_cues": [
                    "Meow like a cat hiding from the rain!",
                    "Moo like a cow splashing in puddles!",
                ],
            },
            {
                "name": "Downward Facing Dog Pose",
                "image_url": "https://storage.googleapis.com/early-nurturer-planner-assets/yoga/downward-facing-dog-pose.png",
                "how_to": [
                    "Start on all fours.",
                    "Push your hips up high into the sky.",
                    "Straighten your legs and press your heels down.",
                    "Look back between your legs and wag your tail!",
                ],
                "creative_cues": [
                    "You're a puppy shaking off the rain!",
                    "Can you bark while staying in the pose?",
                ],
            },
        ],
        "read_aloud": "Rain! by Linda Ashman — A lyrical picture book about a rainy day, supporting weather vocabulary and sequencing.",
        "discussion_prompt": "What sounds do you hear when it rains? What does rain feel like on your skin?",
    },
    "daily_plans": [
        {
            "day": "Monday",
            "focus_domain": "Sensory",
            "activities": [
                {
                    "id": "monday-sensory-rain-bin",
                    "day": "Monday",
                    "title": "Gentle Rain Sensory Bin",
                    "domain": "Sensory",
                    "duration": 20,
                    "description": "Children explore a water-based sensory bin with blue-tinted water, smooth river stones, and floating foam clouds. This activity introduces the weekly rain theme through tactile exploration and cause-and-effect play.",
                    "theme_connection": "Water and cloud elements directly connect children to the Gentle Rain theme.",
                    "materials": ["Large plastic bin", "Blue food colouring", "Smooth river stones", "Foam craft clouds", "Plastic cups", "Towels"],
                    "safety_notes": "Supervise water play at all times. Remove small stones when infants are present. Keep towels nearby for spills.",
                    "adaptations": [
                        {"age_group": "0-12m", "description": "Place bin on a low mat. Offer only large, soft items for mouthing.", "modifications": ["Use only large foam pieces", "Limit water depth to 1 inch"]},
                        {"age_group": "12-24m", "description": "Encourage pouring and scooping with cups.", "modifications": ["Add plastic funnels", "Model pouring actions"]},
                        {"age_group": "24-36m", "description": "Introduce counting stones and colour-sorting clouds.", "modifications": ["Add numbered stones", "Ask sorting questions"]},
                    ],
                    "reflection_prompts": ["Which children showed sustained interest?", "Were water safety protocols followed?"],
                },
                {
                    "id": "monday-sensory-rain-sounds",
                    "day": "Monday",
                    "title": "Rain Sounds Listening Station",
                    "domain": "Sensory",
                    "duration": 10,
                    "description": "A calm listening area where children hear recorded rain sounds and identify different types of rain — drizzle, downpour, and thunder. Develops auditory discrimination.",
                    "theme_connection": "Authentic rain sounds immerse children in the Gentle Rain theme.",
                    "materials": ["Bluetooth speaker", "Rain sounds playlist", "Soft cushions", "Picture cards of rain types"],
                    "safety_notes": "Keep volume at a comfortable level. Ensure speaker cords are out of reach.",
                    "adaptations": [
                        {"age_group": "0-12m", "description": "Hold infant close and gently sway to rain rhythms.", "modifications": ["Use softest volume setting"]},
                        {"age_group": "12-24m", "description": "Show picture cards and name rain types.", "modifications": ["Point and label together"]},
                        {"age_group": "24-36m", "description": "Ask children to match sounds to picture cards.", "modifications": ["Introduce 'loud' vs 'quiet' vocabulary"]},
                    ],
                    "reflection_prompts": ["Did children differentiate between rain sounds?"],
                },
            ],
        },
        {
            "day": "Tuesday",
            "focus_domain": "Fine Motor",
            "activities": [
                {
                    "id": "tuesday-fine-motor-raindrop-art",
                    "day": "Tuesday",
                    "title": "Raindrop Sticker Art",
                    "domain": "Fine Motor",
                    "duration": 15,
                    "description": "Children peel and place blue raindrop stickers onto a cloud-shaped contact paper sheet. Practices pincer grasp and hand-eye coordination while creating a rain-themed artwork.",
                    "theme_connection": "Raindrop shapes reinforce the Gentle Rain visual theme.",
                    "materials": ["Blue dot stickers", "Cloud-shaped contact paper", "Cardstock backing", "Tape"],
                    "safety_notes": "Monitor sticker use to prevent mouthing. Use large stickers (1.5 inch+) for youngest children.",
                    "adaptations": [
                        {"age_group": "0-12m", "description": "Tape contact paper to tray; let infants pat and press.", "modifications": ["Secure paper firmly", "Use largest stickers only"]},
                        {"age_group": "12-24m", "description": "Demonstrate peeling and placing one at a time.", "modifications": ["Pre-peel sticker edges for easier grip"]},
                        {"age_group": "24-36m", "description": "Encourage creating patterns or counting raindrops.", "modifications": ["Add number labels", "Introduce patterns"]},
                    ],
                    "reflection_prompts": ["Which children demonstrated pincer grasp?", "Was the sticker size appropriate for each age group?"],
                },
            ],
        },
        {
            "day": "Wednesday",
            "focus_domain": "Language",
            "activities": [
                {
                    "id": "wednesday-language-rain-story",
                    "day": "Wednesday",
                    "title": "Rain Story Retelling",
                    "domain": "Language",
                    "duration": 15,
                    "description": "After reading 'Rain!' by Linda Ashman, children retell the story using felt board pieces (umbrella, rain cloud, puddle, child). Develops narrative skills and sequencing.",
                    "theme_connection": "The read-aloud directly explores rain, connecting literacy to the weekly theme.",
                    "materials": ["'Rain!' by Linda Ashman", "Felt board", "Felt weather pieces", "Story sequence cards"],
                    "safety_notes": "Ensure felt pieces are large enough to prevent choking. Supervise felt board use.",
                    "adaptations": [
                        {"age_group": "0-12m", "description": "Hold book and point to large pictures. Let infant touch felt pieces.", "modifications": ["Use board books only", "One piece at a time"]},
                        {"age_group": "12-24m", "description": "Name characters and objects. Encourage pointing.", "modifications": ["Use 3-4 key felt pieces", "Repeat key phrases"]},
                        {"age_group": "24-36m", "description": "Ask 'what happens next?' questions. Encourage full sentences.", "modifications": ["Use all felt pieces", "Introduce sequence cards"]},
                    ],
                    "reflection_prompts": ["Which children attempted retelling?", "Were sequence cards helpful for older toddlers?"],
                },
            ],
        },
        {
            "day": "Thursday",
            "focus_domain": "Gross Motor",
            "activities": [
                {
                    "id": "thursday-gross-motor-puddle-jump",
                    "day": "Thursday",
                    "title": "Indoor Puddle Jumping",
                    "domain": "Gross Motor",
                    "duration": 15,
                    "description": "Blue paper 'puddles' are placed on the floor. Children practice jumping, stepping, and balancing across them. Develops bilateral coordination and spatial awareness.",
                    "theme_connection": "Puddle jumping brings the rain theme to life through whole-body movement.",
                    "materials": ["Blue construction paper (large sheets)", "Non-slip tape", "Masking tape for boundaries"],
                    "safety_notes": "Secure all paper puddles with non-slip tape. Clear surrounding area of obstacles. Spot younger children during jumping.",
                    "adaptations": [
                        {"age_group": "0-12m", "description": "Place infant on tummy on a blue mat for 'puddle' sensory time.", "modifications": ["No jumping — tummy time on textured blue mat"]},
                        {"age_group": "12-24m", "description": "Hold hands and step onto puddles together.", "modifications": ["Place puddles close together", "Offer two-hand support"]},
                        {"age_group": "24-36m", "description": "Encourage two-foot jumping and counting puddles.", "modifications": ["Space puddles further apart", "Add counting challenge"]},
                    ],
                    "reflection_prompts": ["Which children demonstrated two-foot jumping?", "Were non-slip measures effective?"],
                },
            ],
        },
        {
            "day": "Friday",
            "focus_domain": "Cognitive",
            "activities": [
                {
                    "id": "friday-cognitive-rain-experiment",
                    "day": "Friday",
                    "title": "Cloud in a Jar Experiment",
                    "domain": "Cognitive",
                    "duration": 20,
                    "description": "Using a jar filled with water and shaving cream 'clouds', children drop blue food colouring onto the cream to watch 'rain' fall through. Introduces cause-and-effect and simple science concepts.",
                    "theme_connection": "This experiment models real rain formation, deepening understanding of the Gentle Rain theme.",
                    "materials": ["Clear glass jars", "Shaving cream", "Blue food colouring", "Pipettes", "Tray for spills"],
                    "safety_notes": "Educator handles jars and food colouring. Children only use pipettes with supervision. Shaving cream is non-toxic but should not be ingested.",
                    "adaptations": [
                        {"age_group": "0-12m", "description": "Observe from a safe distance. Educator demonstrates at eye level.", "modifications": ["Observation only", "Describe what's happening verbally"]},
                        {"age_group": "12-24m", "description": "Educator guides pipette use hand-over-hand.", "modifications": ["Use large pipettes", "One drop at a time"]},
                        {"age_group": "24-36m", "description": "Children use pipettes independently and predict what will happen.", "modifications": ["Ask prediction questions", "Let child add multiple drops"]},
                    ],
                    "reflection_prompts": ["Did children show surprise or understanding of cause-and-effect?", "Were predictions attempted by older toddlers?"],
                },
                {
                    "id": "friday-cognitive-rain-sorting",
                    "day": "Friday",
                    "title": "Weather Sorting Activity",
                    "domain": "Cognitive",
                    "duration": 10,
                    "description": "Children sort picture cards into categories: rain, sun, snow, wind. Develops classification skills and weather vocabulary.",
                    "theme_connection": "Sorting weather types contextualises rain within the broader weather family.",
                    "materials": ["Laminated weather picture cards", "Sorting trays (4)", "Label cards"],
                    "safety_notes": "Ensure cards are laminated and large enough to prevent choking.",
                    "adaptations": [
                        {"age_group": "0-12m", "description": "Show two contrasting cards (rain vs sun) and name them.", "modifications": ["Two cards only", "Use exaggerated voice"]},
                        {"age_group": "12-24m", "description": "Sort into two categories with support.", "modifications": ["Rain vs not-rain sorting", "Hand-over-hand guidance"]},
                        {"age_group": "24-36m", "description": "Sort all four categories independently.", "modifications": ["Full 4-category sort", "Add written labels"]},
                    ],
                    "reflection_prompts": ["Which children could sort independently?"],
                },
            ],
        },
    ],
    "newsletter": {
        "welcome_message": "Dear Families, this week we explored the wonders of Gentle Rain! Your little ones discovered how rain sounds, feels, and nourishes our world through sensory play, art, movement, and science experiments.",
        "learning_goals": [
            "Explored water textures and rain sounds through sensory experiences",
            "Practiced fine motor skills with raindrop sticker art",
            "Expanded weather vocabulary through stories and songs",
            "Developed gross motor coordination with puddle-jumping games",
            "Learned about cause-and-effect with our Cloud in a Jar experiment",
        ],
        "home_connection": "Try going outside during a light rain together! Listen to the sounds, feel the droplets, and talk about what you observe. You can also make your own 'cloud in a jar' at home with a clear glass, shaving cream, and food colouring.",
        "professional_version": "This week's curriculum focused on the Gentle Rain theme, integrating sensory exploration, fine motor development, language enrichment, gross motor coordination, and cognitive science across all five days. Activities were adapted for three developmental groups (0-12m, 12-24m, 24-36m) with appropriate scaffolding and safety measures. Assessment data was collected through structured observation and reflection prompts.",
        "warm_version": "What a wonderful rainy week we had! \U0001f327\ufe0f Your kiddos were absolute scientists this week — dropping 'rain' into cloud jars, jumping through puddles, and singing rain songs at the top of their lungs. Ask them to show you the Tree Pose we learned in yoga — they're getting so strong! Can't wait for next week's adventures!",
    },
}


def main():
    parser = argparse.ArgumentParser(description="Generate a test curriculum PDF")
    parser.add_argument(
        "--from-db",
        action="store_true",
        help="Fetch the most recent plan from the database instead of using dummy data",
    )
    args = parser.parse_args()

    curriculum_data = None

    if args.from_db:
        print("Fetching latest plan from database...")
        curriculum_data = asyncio.run(fetch_latest_plan())
        if curriculum_data:
            print(f"  Found: '{curriculum_data['theme']}' (week {curriculum_data['week_number']})")
        else:
            print("  No plans found in DB. Falling back to dummy data.")

    if not curriculum_data:
        curriculum_data = DUMMY_CURRICULUM
        print(f"Using dummy data: '{curriculum_data['theme']}'")

    print("Generating PDF...")
    pdf_bytes = generate_weekly_pdf(curriculum_data)

    output_path = BACKEND_ROOT / "test_output.pdf"
    output_path.write_bytes(pdf_bytes)
    print(f"PDF written to: {output_path}")
    print(f"Size: {len(pdf_bytes):,} bytes")


if __name__ == "__main__":
    main()
