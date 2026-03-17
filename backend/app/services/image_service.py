"""
Just-in-time AI cover image generation for weekly curriculum PDFs.

Uses Google Imagen (via the google-genai SDK) to generate a watercolor
illustration based on the weekly theme, uploads it to GCS, and caches
the URL in the database for future downloads.
"""

import logging
import uuid

from google import genai
from google.cloud import storage
from google.genai import types
from sqlalchemy import update

from app.db.database import async_session_factory
from app.db.models import WeeklyPlan
from config import settings

logger = logging.getLogger(__name__)

# ── Clients ──────────────────────────────────────────────────
_genai_client = genai.Client(
    vertexai=True,
    project=settings.GCP_PROJECT_ID,
    location=settings.VERTEX_AI_LOCATION,
)

IMAGEN_MODEL = "imagen-3.0-fast-generate-001"
GCS_FOLDER = "theme_covers"


def _build_prompt(theme: str) -> str:
    """Build a constrained Imagen prompt for a preschool cover illustration."""
    return (
        f"A beautiful, soft watercolor illustration for a preschool "
        f"classroom theme about {theme}. Pastel colors, child-friendly, "
        f"no text, clean white background."
    )


def _upload_bytes_to_gcs(image_bytes: bytes, blob_name: str) -> str:
    """Upload raw image bytes to GCS and return the public URL."""
    client = storage.Client(project=settings.GCP_PROJECT_ID)
    bucket = client.bucket(settings.GCS_BUCKET_NAME)
    blob = bucket.blob(blob_name)
    blob.upload_from_string(image_bytes, content_type="image/png")
    blob.make_public()
    public_url = f"https://storage.googleapis.com/{settings.GCS_BUCKET_NAME}/{blob_name}"
    logger.info("Uploaded cover image to %s", public_url)
    return public_url


async def _save_cover_url(plan_id: uuid.UUID, url: str) -> None:
    """Persist the cover_image_url to the database."""
    async with async_session_factory() as session:
        await session.execute(
            update(WeeklyPlan)
            .where(WeeklyPlan.id == plan_id)
            .values(cover_image_url=url)
        )
        await session.commit()


async def get_or_generate_cover_image(plan_row: WeeklyPlan) -> str | None:
    """Return the cover image URL, generating one via Imagen if needed.

    Args:
        plan_row: A WeeklyPlan ORM instance (must have .id, .theme,
                  and .cover_image_url attributes).

    Returns:
        The public GCS URL to the cover image, or None if generation failed.
    """
    # ── 1. Return cached URL if it already exists ────────────
    existing_url = getattr(plan_row, "cover_image_url", None)
    if existing_url:
        logger.info("Cover image already cached: %s", existing_url)
        return existing_url

    theme = plan_row.theme or "Weekly Theme"
    prompt = _build_prompt(theme)
    logger.info("Generating cover image for theme '%s'...", theme)

    # ── 2. Call Imagen API ───────────────────────────────────
    try:
        response = _genai_client.models.generate_images(
            model=IMAGEN_MODEL,
            prompt=prompt,
            config=types.GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio="4:3",
                person_generation="dont_allow",
            ),
        )
    except Exception as e:
        logger.error("Imagen API call failed: %s", e, exc_info=True)
        return None

    if not response.generated_images:
        logger.warning("Imagen returned no images for theme '%s'", theme)
        return None

    # Extract raw PNG bytes from the first generated image
    generated = response.generated_images[0]
    image_bytes = generated.image.image_bytes
    if not image_bytes:
        logger.warning("Imagen returned empty image bytes")
        return None

    # ── 3. Upload to GCS ─────────────────────────────────────
    blob_name = f"{GCS_FOLDER}/{plan_row.id}.png"
    try:
        public_url = _upload_bytes_to_gcs(image_bytes, blob_name)
    except Exception as e:
        logger.error("GCS upload failed: %s", e, exc_info=True)
        return None

    # ── 4. Cache URL in the database ─────────────────────────
    try:
        await _save_cover_url(plan_row.id, public_url)
    except Exception as e:
        logger.error("Failed to save cover_image_url to DB: %s", e, exc_info=True)
        # Still return the URL — the image exists on GCS even if DB save fails

    return public_url
