"""
PDF generation service for weekly curriculum plans.

Uses Jinja2 HTML templating + WeasyPrint to produce beautiful,
print-ready PDF documents with dynamic theme palette colors.
"""

import logging
from datetime import datetime, timezone
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

logger = logging.getLogger(__name__)

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


def generate_weekly_pdf(curriculum_data: dict) -> bytes:
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

    # Collect and deduplicate all materials across the week
    all_materials = _collect_materials(daily_plans)

    # Build template context
    context = {
        "theme": curriculum_data.get("theme", "Untitled Theme"),
        "theme_emoji": curriculum_data.get("theme_emoji", "📋"),
        "week_number": curriculum_data.get("week_number", 1),
        "week_range": curriculum_data.get("week_range", ""),
        "palette": palette,
        "domains": curriculum_data.get("domains", []),
        "objectives": curriculum_data.get("objectives", []),
        "circle_time": curriculum_data.get("circle_time"),
        "daily_plans": daily_plans,
        "newsletter": curriculum_data.get("newsletter"),
        "all_materials": all_materials,
        "cover_image_url": curriculum_data.get("cover_image_url"),
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
