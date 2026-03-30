"""
Material poster generation service.

Generates themed PDF posters (alphabet, number, shape, color) for weekly
curriculum plans. Uses Vertex AI Imagen for alphabet/number illustrations,
local SVG injection for shapes, and simple HTML rendering for colors.

All PDFs are cached in GCS and their URLs stored in the ``material_urls``
JSONB column of ``weekly_plans`` so subsequent requests are instant.
"""

import asyncio
import base64
import logging
import uuid
from pathlib import Path

from google import genai
from google.cloud import storage
from google.genai import types
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

from app.db.database import async_session_factory
from app.db.models import WeeklyPlan
from app.utils.svg_utils import generate_simple_shape_svg, inject_theme_color
from config import settings

logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────
TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates" / "pdf"
FONT_DIR = Path(__file__).resolve().parent.parent / "templates" / "fonts"
SVG_DIR = Path(__file__).resolve().parent.parent / "templates" / "svgs"

GCS_MATERIAL_FOLDER = "weekly-materials"

# ── Shape SVG filename map ────────────────────────────────────
SHAPE_MAP: dict[str, str] = {
    "circle": "circle.svg",
    "diamond": "diamond.svg",
    "heart": "heart.svg",
    "hexagon": "hexagon.svg",
    "octagon": "octagon.svg",
    "pentagon": "pentagon.svg",
    "rectangle": "rectangle.svg",
    "square": "square.svg",
    "star": "star.svg",
    "trapezium": "trapezium.svg",
    "triangle": "triangle.svg",
}

# ── Color name → hex lookup ───────────────────────────────────
COLOR_HEX_MAP: dict[str, str] = {
    "red": "#E74C3C",
    "blue": "#3498DB",
    "green": "#27AE60",
    "yellow": "#F1C40F",
    "orange": "#E67E22",
    "purple": "#9B59B6",
    "pink": "#EC87C0",
    "brown": "#8D6E63",
    "black": "#2C3E50",
    "white": "#BDC3C7",
    "gray": "#95A5A6",
    "grey": "#95A5A6",
}

# ── Number → word lookup ──────────────────────────────────────
NUMBER_WORDS: dict[int, str] = {
    1: "one", 2: "two", 3: "three", 4: "four", 5: "five",
    6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten",
    11: "eleven", 12: "twelve", 13: "thirteen", 14: "fourteen",
    15: "fifteen", 16: "sixteen", 17: "seventeen", 18: "eighteen",
    19: "nineteen", 20: "twenty",
}

# ── Fallback letter→word mapping (for plans without letter_word) ──
FALLBACK_LETTER_WORDS: dict[str, str] = {
    "A": "Apple", "B": "Ball", "C": "Cat", "D": "Dog", "E": "Egg",
    "F": "Flower", "G": "Garden", "H": "House", "I": "Ice", "J": "Jump",
    "K": "Kite", "L": "Leaf", "M": "Moon", "N": "Nature", "O": "Orange",
    "P": "Play", "Q": "Quiet", "R": "Rain", "S": "Sun", "T": "Tree",
    "U": "Up", "V": "Van", "W": "Water", "X": "Box", "Y": "Yellow",
    "Z": "Zebra",
}

# ── Imagen client (reuse pattern from image_service) ──────────
_genai_client = genai.Client(
    vertexai=True,
    project=settings.GCP_PROJECT_ID,
    location=settings.VERTEX_AI_LOCATION,
)
IMAGEN_MODEL = "imagen-3.0-fast-generate-001"


# ══════════════════════════════════════════════════════════════
#  INTERNAL HELPERS
# ══════════════════════════════════════════════════════════════

def _build_jinja_env() -> Environment:
    """Jinja2 environment pointing at the PDF templates folder."""
    return Environment(
        loader=FileSystemLoader(str(TEMPLATE_DIR)),
        autoescape=True,
    )


def _generate_imagen(prompt: str, negative_prompt: str | None = None) -> bytes | None:
    """Call Imagen and return raw PNG bytes, or None on failure."""
    try:
        config_kwargs: dict = {
            "number_of_images": 1,
            "aspect_ratio": "1:1",
            "person_generation": "dont_allow",
        }
        if negative_prompt:
            config_kwargs["negative_prompt"] = negative_prompt
        response = _genai_client.models.generate_images(
            model=IMAGEN_MODEL,
            prompt=prompt,
            config=types.GenerateImagesConfig(**config_kwargs),
        )
    except Exception as e:
        logger.error("Imagen API call failed: %s", e, exc_info=True)
        return None

    if not response.generated_images:
        logger.warning("Imagen returned no images")
        return None

    image_bytes = response.generated_images[0].image.image_bytes
    if not image_bytes:
        logger.warning("Imagen returned empty image bytes")
        return None

    return image_bytes


def _image_bytes_to_data_uri(image_bytes: bytes) -> str:
    """Convert raw image bytes to a base64 data URI for WeasyPrint."""
    b64 = base64.b64encode(image_bytes).decode("ascii")
    return f"data:image/png;base64,{b64}"


def _render_template_to_pdf(template_name: str, context: dict) -> bytes:
    """Render a Jinja2 HTML template and convert to PDF bytes via WeasyPrint."""
    env = _build_jinja_env()
    template = env.get_template(template_name)
    html_string = template.render(**context)
    pdf_bytes = HTML(
        string=html_string,
        base_url=str(TEMPLATE_DIR),
    ).write_pdf()
    return pdf_bytes


def _upload_pdf_to_gcs(pdf_bytes: bytes, plan_id: uuid.UUID, material_type: str) -> str:
    """Upload PDF bytes to GCS and return the public URL."""
    blob_name = f"{GCS_MATERIAL_FOLDER}/{plan_id}_{material_type}.pdf"
    client = storage.Client(project=settings.GCP_PROJECT_ID)
    bucket = client.bucket(settings.GCS_BUCKET_NAME)
    blob = bucket.blob(blob_name)
    blob.upload_from_string(pdf_bytes, content_type="application/pdf")
    public_url = f"https://storage.googleapis.com/{settings.GCS_BUCKET_NAME}/{blob_name}"
    logger.info("Uploaded material PDF to %s", public_url)
    return public_url


async def _save_material_url(plan_id: uuid.UUID, material_type: str, url: str) -> None:
    """Persist the material URL into the material_urls JSONB column."""
    key = f"{material_type}_pdf_url"
    async with async_session_factory() as session:
        from sqlalchemy import select, update as sa_update
        result = await session.execute(
            select(WeeklyPlan.material_urls).where(WeeklyPlan.id == plan_id)
        )
        current = result.scalar() or {}
        current[key] = url
        await session.execute(
            sa_update(WeeklyPlan)
            .where(WeeklyPlan.id == plan_id)
            .values(material_urls=current)
        )
        await session.commit()
    logger.info("Saved %s for plan %s", key, plan_id)


# ══════════════════════════════════════════════════════════════
#  GENERATORS PER MATERIAL TYPE
# ══════════════════════════════════════════════════════════════

async def _generate_alphabet_pdf(circle_time: dict, theme: str, palette: dict) -> bytes:
    """Generate an alphabet poster PDF."""
    letter = (circle_time.get("letter") or "A").upper()
    letter_word = circle_time.get("letter_word") or FALLBACK_LETTER_WORDS.get(letter, "Apple")
    theme_color = (palette or {}).get("primary", "#387F39")
    big_letter = f"{letter}{letter.lower()}"

    # Generate illustration via Imagen (run in executor to avoid blocking)
    loop = asyncio.get_event_loop()
    prompt = (
        f"A cute, child-friendly watercolor illustration of a {letter_word} "
        f"for a preschool alphabet poster. Clean white background, "
        f"soft pastel colors, suitable for ages 0-3. "
        f"ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, AND NO WATERMARKS IN THE IMAGE."
    )
    negative_prompt = (
        "text, words, letters, numbers, watermarks, signatures, labels, "
        "realistic photo, 3D render"
    )
    image_bytes = await loop.run_in_executor(None, _generate_imagen, prompt, negative_prompt)

    # Retry with simpler fallback prompt if first attempt failed (safety filter, etc.)
    if not image_bytes:
        logger.warning(
            "Alphabet image failed for '%s' — retrying with fallback prompt", letter_word
        )
        fallback_prompt = (
            f"A simple, cute watercolor illustration of the letter {letter} "
            f"for a children's alphabet poster. Clean white background, "
            f"soft pastel colors. NO TEXT, NO WORDS, NO WATERMARKS."
        )
        image_bytes = await loop.run_in_executor(None, _generate_imagen, fallback_prompt, negative_prompt)
        if not image_bytes:
            logger.warning("Alphabet fallback image also failed for letter %s", letter)

    image_url = _image_bytes_to_data_uri(image_bytes) if image_bytes else None

    context = {
        "theme_color": theme_color,
        "big_letter": big_letter,
        "image_url": image_url,
        "word": letter_word,
        "font_dir": str(FONT_DIR),
    }
    return _render_template_to_pdf("alphabet_poster.html", context)


async def _generate_number_pdf(circle_time: dict, theme: str, palette: dict) -> bytes:
    """Generate a multi-page number/counting poster PDF (1 page per number).

    Uses a single Imagen call to generate ONE object image, then composites
    it N times per page via HTML/CSS grid — guaranteeing exact counts.
    """
    counting_to = circle_time.get("counting_to") or 5
    counting_object = circle_time.get("counting_object") or "objects"
    theme_color = (palette or {}).get("primary", "#387F39")

    # Generate a single object image — duplicated N times in the template
    loop = asyncio.get_event_loop()
    prompt = (
        f"A cute, child-friendly soft watercolor illustration of a single, isolated "
        f"{counting_object} on a clean white background. Soft pastel colors, "
        f"suitable for ages 0-3. ONLY ONE ITEM. "
        f"ABSOLUTELY NO TEXT, NO NUMBERS, NO SYMBOLS."
    )
    negative_prompt = (
        "text, symbols, numbers, digits, wooden blocks, letters, "
        "multiple items, group, overlapping items, "
        "watermark, realistic photo, 3D render"
    )
    image_bytes = await loop.run_in_executor(
        None, _generate_imagen, prompt, negative_prompt
    )
    image_url = _image_bytes_to_data_uri(image_bytes) if image_bytes else None

    pages = []
    for i in range(1, counting_to + 1):
        pages.append({
            "number": i,
            "number_word": NUMBER_WORDS.get(i, str(i)),
        })

    context = {
        "theme_color": theme_color,
        "counting_to": counting_to,
        "counting_object": counting_object,
        "image_url": image_url,
        "pages": pages,
        "font_dir": str(FONT_DIR),
    }
    return _render_template_to_pdf("number_poster.html", context)


def _generate_shape_pdf(circle_time: dict, palette: dict) -> bytes:
    """Generate a shape poster PDF.

    Uses the full-page decorative SVG files when available (they already
    contain the shape name as vector text), falling back to a simple
    programmatic SVG wrapped in the poster template.
    """
    shape = (circle_time.get("shape") or "Circle").strip()
    theme_color = (palette or {}).get("primary", "#387F39")
    shape_key = shape.lower()

    svg_filename = SHAPE_MAP.get(shape_key)
    svg_path = SVG_DIR / svg_filename if svg_filename else None

    if svg_path and svg_path.exists():
        svg_content = inject_theme_color(svg_path, theme_color)
    else:
        logger.warning("SVG file not found for '%s', using programmatic fallback", shape)
        svg_content = generate_simple_shape_svg(shape_key, theme_color)

    context = {
        "shape_name": shape.upper(),
        "svg_content": svg_content,
    }
    return _render_template_to_pdf("shape_poster.html", context)


async def _generate_color_pdf(circle_time: dict, palette: dict) -> bytes:
    """Generate a color poster PDF with an AI-generated themed object."""
    color_name = (circle_time.get("color") or "Blue").strip()
    color_object = circle_time.get("color_object") or f"{color_name.lower()} ball"
    # Use the color hex from the lookup, or fall back to the palette primary
    theme_color = COLOR_HEX_MAP.get(color_name.lower(), (palette or {}).get("primary", "#3498DB"))

    # Generate illustration via Imagen (run in executor to avoid blocking)
    loop = asyncio.get_event_loop()
    prompt = (
        f"A cute, child-friendly watercolor illustration of a {color_object} "
        f"that is clearly {color_name} colored, for a preschool color poster. "
        f"Clean white background, soft pastel colors, suitable for ages 0-3. "
        f"ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, AND NO WATERMARKS IN THE IMAGE."
    )
    negative_prompt = (
        "text, words, letters, numbers, watermarks, signatures, labels, "
        "realistic photo, 3D render"
    )
    image_bytes = await loop.run_in_executor(None, _generate_imagen, prompt, negative_prompt)

    # Retry with simpler fallback prompt if first attempt failed
    if not image_bytes:
        logger.warning(
            "Color image failed for '%s' — retrying with fallback prompt", color_object
        )
        fallback_prompt = (
            f"A simple watercolor illustration of a {color_name.lower()} colored object "
            f"for a children's poster. Clean white background, soft pastel colors. "
            f"NO TEXT, NO WORDS, NO WATERMARKS."
        )
        image_bytes = await loop.run_in_executor(None, _generate_imagen, fallback_prompt, negative_prompt)
        if not image_bytes:
            logger.warning("Color fallback image also failed for %s", color_name)

    image_url = _image_bytes_to_data_uri(image_bytes) if image_bytes else None

    context = {
        "theme_color": theme_color,
        "color_name": color_name.upper(),
        "color_object": color_object,
        "image_url": image_url,
        "font_dir": str(FONT_DIR),
    }
    return _render_template_to_pdf("color_poster.html", context)


# ══════════════════════════════════════════════════════════════
#  PUBLIC API
# ══════════════════════════════════════════════════════════════

VALID_MATERIAL_TYPES = {"alphabet", "number", "shape", "color"}


async def get_or_generate_material(plan_row: WeeklyPlan, material_type: str) -> str:
    """Return the public URL for a material poster PDF, generating it if needed.

    Args:
        plan_row: A ``WeeklyPlan`` ORM instance with loaded attributes.
        material_type: One of ``'alphabet'``, ``'number'``, ``'shape'``, ``'color'``.

    Returns:
        The public GCS URL to the generated PDF.

    Raises:
        ValueError: If *material_type* is not one of the valid types.
    """
    if material_type not in VALID_MATERIAL_TYPES:
        raise ValueError(f"Invalid material_type: {material_type}")

    # ── 1. Check cache ────────────────────────────────────────
    url_key = f"{material_type}_pdf_url"
    cached_urls = plan_row.material_urls or {}
    if cached_urls.get(url_key):
        logger.info("Material '%s' already cached for plan %s", material_type, plan_row.id)
        return cached_urls[url_key]

    # ── 2. Extract plan data ──────────────────────────────────
    circle_time = plan_row.circle_time or {}
    palette = plan_row.palette or {}
    theme = plan_row.theme or "Weekly Theme"

    # ── 3. Generate PDF ───────────────────────────────────────
    logger.info("Generating '%s' material for plan %s (theme=%s)", material_type, plan_row.id, theme)

    if material_type == "alphabet":
        pdf_bytes = await _generate_alphabet_pdf(circle_time, theme, palette)
    elif material_type == "number":
        pdf_bytes = await _generate_number_pdf(circle_time, theme, palette)
    elif material_type == "shape":
        pdf_bytes = _generate_shape_pdf(circle_time, palette)
    elif material_type == "color":
        pdf_bytes = await _generate_color_pdf(circle_time, palette)
    else:
        raise ValueError(f"Unhandled material_type: {material_type}")

    logger.info("Generated %s PDF: %d bytes", material_type, len(pdf_bytes))

    # ── 4. Upload to GCS ──────────────────────────────────────
    public_url = _upload_pdf_to_gcs(pdf_bytes, plan_row.id, material_type)

    # ── 5. Cache URL in DB ────────────────────────────────────
    try:
        await _save_material_url(plan_row.id, material_type, public_url)
    except Exception as e:
        logger.error("Failed to save material URL to DB: %s", e, exc_info=True)

    return public_url
