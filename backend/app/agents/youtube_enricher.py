"""
LangGraph Node — YouTube Enricher.

Runs once after the Auditor loop on the final draft plan. Searches
YouTube for real videos matching each song and yoga pose, then
**overwrites** the AI-generated titles and durations with the actual
YouTube metadata so the frontend displays consistent information.

This node does NOT alter the plan structure — only injects/overwrites
youtube_url, title, and duration on songs and yoga poses.
"""

import asyncio
import logging
import re

from app.agents.state import PlannerState
from app.agents.tools import search_youtube_video

logger = logging.getLogger(__name__)

# ── Standard yoga pose aliases ────────────────────────────────
# Maps keywords in AI-generated pose names to well-known search terms
_YOGA_POSE_MAP: dict[str, str] = {
    "tree": "tree pose",
    "cat": "cat cow pose",
    "cow": "cat cow pose",
    "butterfly": "butterfly pose",
    "cobra": "cobra pose",
    "downward": "downward dog",
    "dog": "downward dog",
    "child": "child's pose",
    "mountain": "mountain pose",
    "warrior": "warrior pose",
    "star": "star pose",
    "flower": "flower pose",
    "frog": "frog pose",
    "seed": "seed to tree",
    "sprout": "seed to tree",
}


def _extract_theme_keyword(theme: str) -> str:
    """Pull one concrete noun from the theme name for search queries.

    E.g. 'Busy Bees & Bright Blooms' → 'bee',
         'Fox Forest'                 → 'fox',
         'Bug Express'                → 'bug',
         'Starry Night Dreamers'      → 'star'.
    """
    # Strip punctuation, lowercase, split into words
    words = re.sub(r"[^\w\s]", "", theme).lower().split()
    # Skip generic filler words
    _SKIP = {
        "the", "a", "an", "and", "of", "for", "in", "on", "with",
        "little", "big", "busy", "bright", "happy", "fun", "tiny",
        "wonderful", "amazing", "great", "lovely", "sweet", "gentle",
        "friendly", "friends", "week", "weekly", "express", "adventure",
        "adventures", "dreamers", "movers", "groovers", "explorers",
        "blooms",
    }
    for w in words:
        if w not in _SKIP and len(w) >= 3:
            # De-pluralise simple cases (bees→bee, bugs→bug, foxes→fox)
            if w.endswith("xes"):
                return w[:-2]
            if w.endswith("ies"):
                return w[:-3] + "y"
            if w.endswith("es") and len(w) > 4:
                return w[:-2]
            if w.endswith("s") and not w.endswith("ss"):
                return w[:-1]
            return w
    return ""


def _build_song_query(song_title: str, song_type: str, theme: str) -> str:
    """Build a concise YouTube search query for a circle-time song.

    Includes one theme keyword so results feel relevant to the week.

    Args:
        song_title: The AI-generated song title (used as fallback hint).
        song_type: 'greeting' or 'goodbye'.
        theme: The weekly theme name (e.g. 'Busy Bees').
    """
    kw = _extract_theme_keyword(theme)
    theme_part = f" {kw}" if kw else ""

    if song_type == "greeting":
        return f"good morning{theme_part} song for toddlers"
    elif song_type == "goodbye":
        return f"goodbye{theme_part} song for toddlers"
    else:
        return f"{song_title} song for toddlers"


def _build_yoga_query(pose_name: str) -> str:
    """Build a YouTube search query for a yoga pose.

    Maps AI creative names to standard yoga terms when possible,
    otherwise falls back to the original name.
    """
    name_lower = pose_name.lower()

    # Check if any known standard pose keyword appears in the name
    for keyword, standard in _YOGA_POSE_MAP.items():
        if keyword in name_lower:
            return f"{standard} yoga for kids toddlers"

    # Fallback: use the AI name directly
    return f"{pose_name} yoga for kids toddlers"


async def youtube_enricher(state: PlannerState) -> dict:
    """LangGraph node: enrich the draft plan with real YouTube metadata.

    For each greeting song, goodbye song, and yoga pose in the plan,
    searches YouTube, fetches real video metadata, and overwrites the
    AI-generated title and duration with actual YouTube data.

    Args:
        state: The current PlannerState dictionary.

    Returns:
        A dict with the updated draft_plan.
    """
    # Prefer personalized_plan (runs after personalizer now), fall back to draft
    plan = state.get("personalized_plan") or state.get("draft_plan")
    plan_key = "personalized_plan" if state.get("personalized_plan") else "draft_plan"
    if not plan:
        logger.warning("YouTubeEnricher: no plan to enrich")
        return {}

    theme = plan.get("theme", "")
    circle_time = plan.get("circle_time")
    if not circle_time:
        logger.warning("YouTubeEnricher: no circle_time in plan")
        return {}

    # ── Collect search tasks ───────────────────────────────────
    tasks: list[tuple[str, str, asyncio.Task]] = []
    # (label, query, coroutine) — we'll track what each task maps to

    greeting = circle_time.get("greeting_song")
    goodbye = circle_time.get("goodbye_song")
    yoga_poses = circle_time.get("yoga_poses", [])

    search_coros = []
    task_labels = []

    if greeting:
        q = _build_song_query(greeting.get("title", ""), "greeting", theme)
        search_coros.append(search_youtube_video(q, video_category_id="10"))
        task_labels.append(("greeting_song", q))

    if goodbye:
        q = _build_song_query(goodbye.get("title", ""), "goodbye", theme)
        search_coros.append(search_youtube_video(q, video_category_id="10"))
        task_labels.append(("goodbye_song", q))

    for i, pose in enumerate(yoga_poses):
        q = _build_yoga_query(pose.get("name", ""))
        search_coros.append(search_youtube_video(q))
        task_labels.append((f"yoga_{i}", q))

    if not search_coros:
        logger.info("YouTubeEnricher: nothing to enrich")
        return {}

    # ── Fire all searches concurrently ─────────────────────────
    logger.info("YouTubeEnricher: searching %d videos", len(search_coros))
    results = await asyncio.gather(*search_coros, return_exceptions=True)

    # ── Apply results back to the plan ─────────────────────────
    enriched = 0
    for (label, query), result in zip(task_labels, results):
        if isinstance(result, Exception):
            logger.warning("YouTubeEnricher: '%s' failed: %s", label, result)
            continue
        if result is None:
            logger.warning("YouTubeEnricher: '%s' returned no results", label)
            continue

        # result is {embed_url, title, duration, thumbnail}
        if label == "greeting_song" and greeting:
            greeting["youtube_url"] = result["embed_url"]
            greeting["title"] = result["title"]
            greeting["duration"] = result["duration"]
            enriched += 1
            logger.info("YouTubeEnricher: greeting → '%s' (%s)",
                        result["title"], result["duration"])

        elif label == "goodbye_song" and goodbye:
            goodbye["youtube_url"] = result["embed_url"]
            goodbye["title"] = result["title"]
            goodbye["duration"] = result["duration"]
            enriched += 1
            logger.info("YouTubeEnricher: goodbye → '%s' (%s)",
                        result["title"], result["duration"])

        elif label.startswith("yoga_"):
            idx = int(label.split("_")[1])
            if idx < len(yoga_poses):
                yoga_poses[idx]["youtube_url"] = result["embed_url"]
                yoga_poses[idx]["name"] = result["title"]
                yoga_poses[idx]["duration"] = result.get("duration_seconds") or yoga_poses[idx].get("duration", 30)
                enriched += 1
                logger.info("YouTubeEnricher: yoga[%d] → '%s'", idx, result["title"])

    logger.info("YouTubeEnricher: enriched %d / %d items", enriched, len(search_coros))

    return {plan_key: plan}
