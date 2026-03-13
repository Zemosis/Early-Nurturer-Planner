"""
LangGraph Node — Media Enricher (YouTube songs + DB yoga poses).

Runs once after the Auditor loop on the final draft plan.
- Songs: searches YouTube for real videos matching greeting/goodbye songs.
- Yoga: performs a vector similarity search against the yoga_poses DB table
  using the theme + architect keywords, then overwrites circle_time.yoga_poses
  with the 3 closest real poses (image, how_to, creative_cues from PDF data).
"""

import asyncio
import logging
import re

from google import genai
from sqlalchemy import select

from app.agents.state import PlannerState
from app.agents.tools import search_youtube_video
from app.db.database import async_session_factory
from app.db.models import YogaPose
from config import settings

logger = logging.getLogger(__name__)

# ── Gemini client for embeddings ──────────────────────────────
gemini_client = genai.Client(
    vertexai=True,
    project=settings.GCP_PROJECT_ID,
    location=settings.VERTEX_AI_LOCATION,
)
EMBEDDING_MODEL = "text-embedding-004"


def _extract_theme_keyword(theme: str) -> str:
    """Pull one concrete noun from the theme name for search queries.

    E.g. 'Busy Bees & Bright Blooms' → 'bee',
         'Fox Forest'                 → 'fox',
         'Bug Express'                → 'bug',
         'Starry Night Dreamers'      → 'star'.
    """
    words = re.sub(r"[^\w\s]", "", theme).lower().split()
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
    """Build a concise YouTube search query for a circle-time song."""
    kw = _extract_theme_keyword(theme)
    theme_part = f" {kw}" if kw else ""

    if song_type == "greeting":
        return f"good morning{theme_part} song for toddlers"
    elif song_type == "goodbye":
        return f"goodbye{theme_part} song for toddlers"
    else:
        return f"{song_title} song for toddlers"


# ── Yoga vector search ────────────────────────────────────────

async def _find_yoga_poses(theme: str, keywords: list[str], limit: int = 3) -> list[dict]:
    """Embed theme + keywords and return the closest yoga poses from the DB.

    Args:
        theme: The weekly theme name (e.g. 'Ocean Adventure').
        keywords: Architect-generated keyword phrases from yoga_poses[].name.
        limit: Number of poses to return.

    Returns:
        List of dicts with {name, image_url, how_to, creative_cues}.
    """
    # Build a combined query string for embedding
    kw_text = " ".join(keywords) if keywords else ""
    query_text = f"kids yoga poses for theme: {theme} {kw_text}".strip()
    logger.info("YogaSearch: embedding query: %r", query_text)

    try:
        embed_response = await gemini_client.aio.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=query_text,
        )
        query_vector = embed_response.embeddings[0].values
    except Exception as e:
        logger.error("YogaSearch: embedding failed: %s", e)
        return []

    # Vector similarity search
    try:
        async with async_session_factory() as session:
            stmt = (
                select(YogaPose)
                .order_by(YogaPose.embedding.cosine_distance(query_vector))
                .limit(limit)
            )
            result = await session.execute(stmt)
            poses = result.scalars().all()

            return [
                {
                    "name": p.name,
                    "image_url": p.image_url,
                    "how_to": p.how_to or [],
                    "creative_cues": p.creative_cues or [],
                }
                for p in poses
            ]
    except Exception as e:
        logger.error("YogaSearch: DB query failed: %s", e)
        return []


# ── Main enricher node ────────────────────────────────────────

async def youtube_enricher(state: PlannerState) -> dict:
    """LangGraph node: enrich the draft plan with YouTube songs and DB yoga poses.

    - Songs: searches YouTube, overwrites title/duration/youtube_url.
    - Yoga: vector search against yoga_poses table, overwrites entirely.

    Args:
        state: The current PlannerState dictionary.

    Returns:
        A dict with the updated plan.
    """
    plan = state.get("personalized_plan") or state.get("draft_plan")
    plan_key = "personalized_plan" if state.get("personalized_plan") else "draft_plan"
    if not plan:
        logger.warning("Enricher: no plan to enrich")
        return {}

    theme = plan.get("theme", "")
    circle_time = plan.get("circle_time")
    if not circle_time:
        logger.warning("Enricher: no circle_time in plan")
        return {}

    # ── Song YouTube search (unchanged) ───────────────────────
    greeting = circle_time.get("greeting_song")
    goodbye = circle_time.get("goodbye_song")

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

    # ── Yoga vector search ────────────────────────────────────
    yoga_keywords = [
        p.get("name", "") for p in circle_time.get("yoga_poses", [])
        if p.get("name")
    ]
    yoga_coro = _find_yoga_poses(theme, yoga_keywords, limit=3)

    # ── Fire song searches + yoga search concurrently ─────────
    logger.info("Enricher: %d song searches + 1 yoga vector search", len(search_coros))
    all_coros = search_coros + [yoga_coro]
    results = await asyncio.gather(*all_coros, return_exceptions=True)

    song_results = results[: len(search_coros)]
    yoga_result = results[len(search_coros)]

    # ── Apply song results ────────────────────────────────────
    enriched = 0
    for (label, query), result in zip(task_labels, song_results):
        if isinstance(result, Exception):
            logger.warning("Enricher: '%s' failed: %s", label, result)
            continue
        if result is None:
            logger.warning("Enricher: '%s' returned no results", label)
            continue

        if label == "greeting_song" and greeting:
            greeting["youtube_url"] = result["embed_url"]
            greeting["title"] = result["title"]
            greeting["duration"] = result["duration"]
            enriched += 1
            logger.info("Enricher: greeting → '%s' (%s)",
                        result["title"], result["duration"])

        elif label == "goodbye_song" and goodbye:
            goodbye["youtube_url"] = result["embed_url"]
            goodbye["title"] = result["title"]
            goodbye["duration"] = result["duration"]
            enriched += 1
            logger.info("Enricher: goodbye → '%s' (%s)",
                        result["title"], result["duration"])

    # ── Apply yoga results ────────────────────────────────────
    if isinstance(yoga_result, Exception):
        logger.warning("Enricher: yoga vector search failed: %s", yoga_result)
    elif yoga_result:
        circle_time["yoga_poses"] = yoga_result
        enriched += len(yoga_result)
        for p in yoga_result:
            logger.info("Enricher: yoga → '%s' (%s)", p["name"], p["image_url"])
    else:
        logger.warning("Enricher: yoga vector search returned no results")

    logger.info("Enricher: enriched %d items total", enriched)

    return {plan_key: plan}
