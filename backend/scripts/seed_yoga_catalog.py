#!/usr/bin/env python3
"""
Phase 2 — Seed the yoga_poses table from extracted PDF data.

Pipeline per pose page:
  1. Parse raw text with Gemini → {name, how_to, creative_cues}
  2. Match image file in data_prep/images/
  3. Upload image to GCS (yoga/ folder)
  4. Generate 768-dim embedding via text-embedding-004
  5. Upsert row into yoga_poses table

Usage:
    cd backend/
    python scripts/seed_yoga_catalog.py
"""

import asyncio
import json
import logging
import os
import re
import sys
from pathlib import Path

from google import genai
from google.cloud import storage
from google.genai import types
from pydantic import BaseModel

# Ensure backend/ is on sys.path so config and app resolve.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.db.database import async_session_factory, engine
from app.db.models import YogaPose
from config import settings

# ── Logging ────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-5s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── Paths ──────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
DATA_DIR = BACKEND_DIR / "data_prep"
IMAGES_DIR = DATA_DIR / "images"
RAW_TEXT_PATH = DATA_DIR / "raw_text.json"

# ── GCS ────────────────────────────────────────────────────────
GCS_BUCKET = settings.GCS_BUCKET_NAME  # "early-nurturer-planner-assets"
GCS_FOLDER = "yoga"

# ── Gemini client (Vertex AI mode) ─────────────────────────────
gemini_client = genai.Client(
    vertexai=True,
    project=settings.GCP_PROJECT_ID,
    location=settings.VERTEX_AI_LOCATION,
)
GEMINI_MODEL = "gemini-2.5-flash"
EMBEDDING_MODEL = "text-embedding-004"

# Pages that are NOT pose pages
SKIP_PAGES = {1, 2, 3, 4, 17, 25, 27, 28, 36, 41}


# ── Pydantic schema for Gemini structured output ──────────────
class YogaPoseExtract(BaseModel):
    name: str
    how_to: list[str]
    creative_cues: list[str]


# ── Helpers ────────────────────────────────────────────────────

def _to_kebab(name: str) -> str:
    """Convert a pose name to a kebab-case filename slug."""
    slug = re.sub(r"\(.*?\)", "", name)
    slug = slug.replace("'", "").replace("\u2019", "")
    slug = slug.strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug


def _find_image(slug: str) -> Path | None:
    """Find the image file for a pose slug. Handles single and multi-image."""
    single = IMAGES_DIR / f"{slug}.png"
    if single.exists():
        return single
    # Multi-image (e.g. sun-flow-1.png) — return the first one
    first = IMAGES_DIR / f"{slug}-1.png"
    if first.exists():
        return first
    return None


def upload_to_gcs(local_path: Path, blob_name: str) -> str:
    """Upload a file to GCS and return its public URL."""
    client = storage.Client(project=settings.GCP_PROJECT_ID)
    bucket = client.bucket(GCS_BUCKET)
    blob = bucket.blob(blob_name)
    blob.upload_from_filename(str(local_path), content_type="image/png")
    public_url = f"https://storage.googleapis.com/{GCS_BUCKET}/{blob_name}"
    return public_url


async def parse_pose_text(page_text: str) -> YogaPoseExtract | None:
    """Use Gemini to parse raw page text into structured pose data."""
    prompt = (
        "Extract the yoga pose information from the following page text.\n"
        "Return the pose name, step-by-step 'how to' instructions as a list "
        "of strings, and creative cues as a list of strings.\n"
        "If the text does not contain a yoga pose, return name as empty string.\n\n"
        f"PAGE TEXT:\n{page_text}"
    )
    try:
        response = await gemini_client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=YogaPoseExtract,
                temperature=0.1,
            ),
        )
        parsed = json.loads(response.text)
        return YogaPoseExtract(**parsed)
    except Exception as e:
        logger.error(f"Gemini parse error: {e}")
        return None


async def generate_embedding(text: str) -> list[float] | None:
    """Generate a 768-dim embedding using text-embedding-004."""
    try:
        response = await gemini_client.aio.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=text,
        )
        return response.embeddings[0].values
    except Exception as e:
        logger.error(f"Embedding error: {e}")
        return None


# ── Main seed logic ────────────────────────────────────────────

async def seed() -> None:
    # Load raw text
    if not RAW_TEXT_PATH.exists():
        logger.error(f"raw_text.json not found at {RAW_TEXT_PATH}")
        logger.error("Run extract_pdf_raw.py first.")
        sys.exit(1)

    with open(RAW_TEXT_PATH, "r", encoding="utf-8") as f:
        page_texts: dict[str, str] = json.load(f)

    total = 0
    skipped = 0
    inserted = 0
    errors = 0

    async with async_session_factory() as session:
        for page_str, text in page_texts.items():
            page_num = int(page_str)

            if page_num in SKIP_PAGES:
                continue

            total += 1
            logger.info(f"Processing page {page_num}...")

            # 1. Parse text with Gemini
            pose = await parse_pose_text(text)
            if not pose or not pose.name:
                logger.warning(f"  Page {page_num}: no pose extracted, skipping")
                errors += 1
                continue

            logger.info(f"  Parsed: {pose.name}")

            # 2. Check if already exists
            existing = await session.execute(
                select(YogaPose).where(YogaPose.name == pose.name)
            )
            if existing.scalar_one_or_none():
                logger.info(f"  Already exists in DB, skipping")
                skipped += 1
                continue

            # 3. Find and upload image
            slug = _to_kebab(pose.name)
            image_path = _find_image(slug)
            if not image_path:
                logger.warning(f"  No image found for slug '{slug}', skipping")
                errors += 1
                continue

            blob_name = f"{GCS_FOLDER}/{image_path.name}"
            try:
                image_url = upload_to_gcs(image_path, blob_name)
                logger.info(f"  Uploaded → {image_url}")
            except Exception as e:
                logger.error(f"  GCS upload failed: {e}")
                errors += 1
                continue

            # 4. Generate embedding
            embed_text = (
                f"Yoga pose: {pose.name}. "
                f"Instructions: {' '.join(pose.how_to)}. "
                f"Creative cues: {' '.join(pose.creative_cues)}"
            )
            embedding = await generate_embedding(embed_text)
            if not embedding:
                logger.warning(f"  Embedding failed, inserting without vector")

            # 5. Insert into DB
            yoga_pose = YogaPose(
                name=pose.name,
                image_url=image_url,
                how_to=pose.how_to,
                creative_cues=pose.creative_cues,
                embedding=embedding,
            )
            session.add(yoga_pose)
            inserted += 1
            logger.info(f"  ✓ Queued for insert: {pose.name}")

        await session.commit()
        logger.info(f"\n{'='*50}")
        logger.info(f"Seed complete!")
        logger.info(f"  Pages processed : {total}")
        logger.info(f"  Inserted        : {inserted}")
        logger.info(f"  Skipped (exist) : {skipped}")
        logger.info(f"  Errors          : {errors}")


async def main() -> None:
    try:
        await seed()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
