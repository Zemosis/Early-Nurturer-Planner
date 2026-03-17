"""
PDF generation service for weekly curriculum plans.

Uses Jinja2 HTML templating + WeasyPrint to produce beautiful,
print-ready PDF documents with dynamic theme palette colors.

Generated PDFs are uploaded to GCS and the URL is cached in the
database so subsequent requests skip regeneration entirely.
"""

import asyncio
import base64
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx
from google.cloud import storage
from jinja2 import Environment, FileSystemLoader
from sqlalchemy import update
from weasyprint import HTML

from app.db.database import async_session_factory
from app.db.models import WeeklyPlan
from app.services.image_service import get_or_generate_daily_image
from config import settings

logger = logging.getLogger(__name__)

GCS_PDF_FOLDER = "curriculum_pdfs"


def _darken_hex_color(hex_color: str, factor: float = 0.88) -> str:
    """Darken a hex color by the given factor (0.0=black, 1.0=unchanged)."""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) != 6:
        return f"#{hex_color}"
    r = int(int(hex_color[0:2], 16) * factor)
    g = int(int(hex_color[2:4], 16) * factor)
    b = int(int(hex_color[4:6], 16) * factor)
    return f"#{min(r,255):02x}{min(g,255):02x}{min(b,255):02x}"

# ── Template directory ────────────────────────────────────────
TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates" / "pdf"


def _build_jinja_env() -> Environment:
    """Create a Jinja2 environment pointing at the PDF templates folder."""
    return Environment(
        loader=FileSystemLoader(str(TEMPLATE_DIR)),
        autoescape=True,
    )


def _collect_materials(daily_plans: list[dict]) -> list[str]:
    """Aggregate and deduplicate materials from all activities across all days."""
    seen: set[str] = set()
    materials: list[str] = []
    for day_plan in daily_plans:
        for activity in day_plan.get("activities", []):
            for material in activity.get("materials", []):
                normalised = material.strip()
                if normalised.lower() not in seen:
                    seen.add(normalised.lower())
                    materials.append(normalised)
    return sorted(materials, key=str.lower)


def _fetch_image_as_data_uri(url: str) -> str | None:
    """Download an image URL and return it as a data: URI for inline embedding.

    This avoids WeasyPrint's inability to reliably fetch external URLs
    (GCS, etc.) by converting the image to a base64-encoded data URI.
    """
    try:
        with httpx.Client(timeout=15.0, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()
        content_type = resp.headers.get("content-type", "image/png").split(";")[0]
        b64 = base64.b64encode(resp.content).decode("ascii")
        data_uri = f"data:{content_type};base64,{b64}"
        logger.info("Fetched cover image (%d bytes) as data URI", len(resp.content))
        return data_uri
    except Exception as e:
        logger.error("Failed to fetch cover image from %s: %s", url, e, exc_info=True)
        return None


async def generate_weekly_pdf(curriculum_data: dict) -> bytes:
    """Render a weekly curriculum plan as a PDF document.

    Args:
        curriculum_data: A dictionary matching the WeekPlanSchema structure.
            Expected keys: theme, theme_emoji, week_number, week_range,
            palette, domains, objectives, circle_time, daily_plans, newsletter.

    Returns:
        The PDF file contents as raw bytes.
    """
    env = _build_jinja_env()
    template = env.get_template("curriculum_base.html")

    # Prepare palette (dict or object with .primary etc.)
    palette = curriculum_data.get("palette")
    if palette and not isinstance(palette, dict):
        palette = {
            "primary": getattr(palette, "primary", "#7A9B76"),
            "secondary": getattr(palette, "secondary", "#8B6F47"),
            "accent": getattr(palette, "accent", "#D4845B"),
            "background": getattr(palette, "background", "#F5F1E8"),
        }

    daily_plans = curriculum_data.get("daily_plans", [])
    theme = curriculum_data.get("theme", "Untitled Theme")

    # ── Generate daily images for each day (in parallel) ─────────
    tasks = []
    for day_plan in daily_plans:
        day_name = day_plan.get("day", "Day")
        activities = day_plan.get("activities", [])
        summary = activities[0].get("title", "activities") if activities else "learning"
        tasks.append(get_or_generate_daily_image(theme, day_name, summary))
    daily_image_urls = await asyncio.gather(*tasks)

    # Convert each daily image URL to a data URI
    for idx, day_plan in enumerate(daily_plans):
        image_url = daily_image_urls[idx] if idx < len(daily_image_urls) else None
        if image_url:
            day_plan["daily_image_data_uri"] = _fetch_image_as_data_uri(image_url)
        else:
            day_plan["daily_image_data_uri"] = None

    # Collect non-null daily image data URIs for random section decoration
    daily_bg_uris = [
        dp["daily_image_data_uri"]
        for dp in daily_plans
        if dp.get("daily_image_data_uri")
    ]

    # Collect and deduplicate all materials across the week
    all_materials = _collect_materials(daily_plans)

    # Build template context
    context = {
        "theme": curriculum_data.get("theme", "Untitled Theme"),
        "theme_emoji": curriculum_data.get("theme_emoji", "📋"),
        "week_number": curriculum_data.get("week_number", 1),
        "week_range": curriculum_data.get("week_range", ""),
        "palette": palette,
        "background_dark": _darken_hex_color(
            (palette or {}).get("background", "#F5F1E8"), 0.90
        ),
        "domains": curriculum_data.get("domains", []),
        "objectives": curriculum_data.get("objectives", []),
        "circle_time": curriculum_data.get("circle_time"),
        "daily_plans": daily_plans,
        "daily_bg_uris": daily_bg_uris,
        "newsletter": curriculum_data.get("newsletter"),
        "all_materials": all_materials,
        "cover_image_url": _fetch_image_as_data_uri(curriculum_data["cover_image_url"])
            if curriculum_data.get("cover_image_url") else None,
        "generated_date": datetime.now(timezone.utc).strftime("%B %d, %Y"),
    }

    logger.info(
        "Rendering PDF for theme=%s, week=%s (%d materials, %d days)",
        context["theme"],
        context["week_number"],
        len(all_materials),
        len(daily_plans),
    )

    # Render HTML from Jinja2 template
    html_string = template.render(**context)

    # Convert HTML → PDF via WeasyPrint
    css_path = str(TEMPLATE_DIR / "style.css")
    pdf_bytes = HTML(
        string=html_string,
        base_url=str(TEMPLATE_DIR),
    ).write_pdf(
        stylesheets=[css_path],
    )

    logger.info("PDF generated: %d bytes", len(pdf_bytes))
    return pdf_bytes


def upload_pdf_to_gcs(pdf_bytes: bytes, plan_id: uuid.UUID, theme: str) -> str:
    """Upload PDF bytes to GCS and return the public URL."""
    safe_theme = (theme or "plan").lower().replace(" ", "_")[:40]
    blob_name = f"{GCS_PDF_FOLDER}/{plan_id}_{safe_theme}.pdf"

    client = storage.Client(project=settings.GCP_PROJECT_ID)
    bucket = client.bucket(settings.GCS_BUCKET_NAME)
    blob = bucket.blob(blob_name)
    blob.upload_from_string(pdf_bytes, content_type="application/pdf")

    public_url = f"https://storage.googleapis.com/{settings.GCS_BUCKET_NAME}/{blob_name}"
    logger.info("Uploaded PDF to %s", public_url)
    return public_url


async def save_pdf_url(plan_id: uuid.UUID, url: str) -> None:
    """Persist the pdf_url to the database."""
    async with async_session_factory() as session:
        await session.execute(
            update(WeeklyPlan)
            .where(WeeklyPlan.id == plan_id)
            .values(pdf_url=url)
        )
        await session.commit()
    logger.info("Saved pdf_url for plan %s", plan_id)


def delete_pdf_from_gcs(pdf_url: str) -> None:
    """Delete a PDF blob from GCS given its public URL. No-op if not found."""
    try:
        # Extract blob name from URL: https://storage.googleapis.com/{bucket}/{blob}
        prefix = f"https://storage.googleapis.com/{settings.GCS_BUCKET_NAME}/"
        if not pdf_url.startswith(prefix):
            logger.warning("pdf_url does not match expected GCS prefix: %s", pdf_url)
            return
        blob_name = pdf_url[len(prefix):]
        client = storage.Client(project=settings.GCP_PROJECT_ID)
        bucket = client.bucket(settings.GCS_BUCKET_NAME)
        blob = bucket.blob(blob_name)
        blob.delete()
        logger.info("Deleted PDF blob from GCS: %s", blob_name)
    except Exception as e:
        logger.error("Failed to delete PDF from GCS (%s): %s", pdf_url, e)
