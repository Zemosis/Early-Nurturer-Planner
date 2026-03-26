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
from tenacity import retry, stop_after_attempt, wait_exponential

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
        return f"good morning{theme_part} kindergarten  song"
    elif song_type == "goodbye":
        return f"goodbye{theme_part} kindergarten song"
    else:
        return f"{song_title} kindergarten song"


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


# ══════════════════════════════════════════════════════════════
#  STANDALONE: enrich_circle_time (callable from parallel node)
# ══════════════════════════════════════════════════════════════


@retry(
    wait=wait_exponential(min=1, max=10),
    stop=stop_after_attempt(3),
    reraise=True,
)
async def enrich_circle_time(circle_time: dict, theme: str) -> dict:
    """Enrich circle_time dict with real YouTube songs and DB yoga poses.

    Standalone async function that can be called directly (e.g. from
    asyncio.gather in the parallel_generate node) without requiring
    LangGraph state.

    Args:
        circle_time: CircleTimeSchema as a dict (mutated in-place AND returned).
        theme: Theme name string for search queries.

    Returns:
        The enriched circle_time dict.
    """
    greeting = circle_time.get("greeting_song")
    goodbye = circle_time.get("goodbye_song")

    # Search greeting song first so we can exclude its video_id
    # from the goodbye search (deduplication).
    greeting_video_id: str | None = None
    enriched = 0

    if greeting:
        q = _build_song_query(greeting.get("title", ""), "greeting", theme)
        logger.info("Enricher: greeting query: %r", q)
        g_result = await search_youtube_video(q, video_category_id="10")
        if g_result:
            greeting["youtube_url"] = g_result["embed_url"]
            greeting["title"] = g_result["title"]
            greeting["duration"] = g_result["duration"]
            greeting_video_id = g_result["embed_url"].rsplit("/", 1)[-1]
            enriched += 1
            logger.info("Enricher: greeting → '%s' (%s)",
                        g_result["title"], g_result["duration"])
        else:
            logger.warning("Enricher: greeting song returned no results")

    # Goodbye search — exclude the greeting video_id
    exclude_ids = [greeting_video_id] if greeting_video_id else []

    if goodbye:
        q = _build_song_query(goodbye.get("title", ""), "goodbye", theme)
        logger.info("Enricher: goodbye query: %r (exclude=%s)", q, exclude_ids)
        gb_result = await search_youtube_video(
            q, video_category_id="10", exclude_video_ids=exclude_ids,
        )
        if gb_result:
            goodbye["youtube_url"] = gb_result["embed_url"]
            goodbye["title"] = gb_result["title"]
            goodbye["duration"] = gb_result["duration"]
            enriched += 1
            logger.info("Enricher: goodbye → '%s' (%s)",
                        gb_result["title"], gb_result["duration"])
        else:
            logger.warning("Enricher: goodbye song returned no results")

    # ── Yoga vector search ────────────────────────────────────
    yoga_keywords = [
        p.get("name", "") for p in circle_time.get("yoga_poses", [])
        if p.get("name")
    ]
    yoga_result = await _find_yoga_poses(theme, yoga_keywords, limit=3)

    if yoga_result:
        circle_time["yoga_poses"] = yoga_result
        enriched += len(yoga_result)
        for p in yoga_result:
            logger.info("Enricher: yoga → '%s' (%s)", p["name"], p["image_url"])
    else:
        logger.warning("Enricher: yoga vector search returned no results")

    logger.info("Enricher: enriched %d items total", enriched)
    return circle_time


# ── LangGraph node wrapper (kept for backward compatibility) ──

async def youtube_enricher(state: PlannerState) -> dict:
    """LangGraph node: thin wrapper around enrich_circle_time.

    Reads circle_time from the plan in state, enriches it, and writes back.
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

    await enrich_circle_time(circle_time, theme)
    return {plan_key: plan}
