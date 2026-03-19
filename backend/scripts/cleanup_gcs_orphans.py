"""
One-off GCS orphan cleanup script.

Connects to the database and GCS bucket, identifies blobs that are not
associated with any existing weekly plan, and deletes them.

Specifically handles:
  - Blobs in curriculum_pdfs/, theme_covers/, weekly-materials/ whose
    name contains a UUID that does NOT exist in the weekly_plans table.
  - Old daily_* blobs in theme_covers/ that lack a plan_id prefix
    (these were generated transiently for PDF rendering and never tracked).

Skips: static-materials/, yoga/ (these are permanent assets).

Usage:
    PYTHONPATH=backend python backend/scripts/cleanup_gcs_orphans.py [--dry-run]
"""

import argparse
import asyncio
import logging
import re
import sys
import uuid
from pathlib import Path

# Ensure backend/ is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from google.cloud import storage
from sqlalchemy import select

from app.db.database import async_session_factory
from app.db.models import WeeklyPlan
from config import settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

# Folders to scan (everything else is skipped)
TARGET_FOLDERS = {"curriculum_pdfs", "theme_covers", "weekly-materials"}
# Folders that are permanent and should never be touched
SKIP_PREFIXES = ("static-materials/", "yoga/")

# Regex to find UUIDs (version 4 style, but matches any 8-4-4-4-12 hex)
UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.IGNORECASE)


async def fetch_valid_plan_ids() -> set[str]:
    """Fetch all plan IDs from the database."""
    async with async_session_factory() as session:
        result = await session.execute(select(WeeklyPlan.id))
        ids = {str(row[0]) for row in result.all()}
    logger.info("Found %d plans in database", len(ids))
    return ids


def scan_and_delete(valid_ids: set[str], dry_run: bool = True) -> tuple[int, int]:
    """Scan the GCS bucket and delete orphaned blobs.

    Returns:
        (deleted_count, total_bytes_freed)
    """
    client = storage.Client(project=settings.GCP_PROJECT_ID)
    bucket = client.bucket(settings.GCS_BUCKET_NAME)

    deleted = 0
    bytes_freed = 0
    skipped = 0

    for folder in TARGET_FOLDERS:
        logger.info("Scanning %s/ ...", folder)
        blobs = list(bucket.list_blobs(prefix=f"{folder}/"))

        for blob in blobs:
            name = blob.name

            # Skip protected folders (shouldn't appear, but safety check)
            if any(name.startswith(p) for p in SKIP_PREFIXES):
                continue

            # ── Handle old-style daily_* blobs (no plan_id) ──
            # These are in theme_covers/daily_* and were never tracked in DB
            basename = name.split("/", 1)[-1] if "/" in name else name
            if basename.startswith("daily_"):
                blob_size = blob.size or 0
                if dry_run:
                    logger.info("  [DRY-RUN] Would delete orphan daily blob: %s (%d bytes)", name, blob_size)
                else:
                    try:
                        blob.delete()
                        logger.info("  Deleted orphan daily blob: %s (%d bytes)", name, blob_size)
                    except Exception as e:
                        logger.warning("  Failed to delete %s: %s", name, e)
                        continue
                deleted += 1
                bytes_freed += blob_size
                continue

            # ── Check for UUID in blob name ──
            match = UUID_RE.search(basename)
            if not match:
                skipped += 1
                continue

            found_uuid = match.group(0).lower()
            if found_uuid in valid_ids:
                # Blob belongs to a valid plan — keep it
                continue

            # Orphan — UUID not in database
            blob_size = blob.size or 0
            if dry_run:
                logger.info("  [DRY-RUN] Would delete orphan: %s (plan %s, %d bytes)", name, found_uuid, blob_size)
            else:
                try:
                    blob.delete()
                    logger.info("  Deleted orphan: %s (plan %s, %d bytes)", name, found_uuid, blob_size)
                except Exception as e:
                    logger.warning("  Failed to delete %s: %s", name, e)
                    continue
            deleted += 1
            bytes_freed += blob_size

    logger.info("Skipped %d blobs without recognisable UUID", skipped)
    return deleted, bytes_freed


async def main():
    parser = argparse.ArgumentParser(description="Clean up orphaned GCS blobs")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Only print what would be deleted (default: true)",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually delete the orphaned blobs",
    )
    args = parser.parse_args()

    dry_run = not args.execute

    if dry_run:
        logger.info("=== DRY RUN MODE — no blobs will be deleted ===")
        logger.info("Run with --execute to actually delete orphans.")
    else:
        logger.info("=== EXECUTE MODE — orphaned blobs WILL be deleted ===")

    valid_ids = await fetch_valid_plan_ids()
    # Lowercase for comparison
    valid_ids = {vid.lower() for vid in valid_ids}

    deleted, bytes_freed = scan_and_delete(valid_ids, dry_run=dry_run)

    mb_freed = bytes_freed / (1024 * 1024)
    action = "Would delete" if dry_run else "Deleted"
    logger.info("")
    logger.info("═══════════════════════════════════════")
    logger.info("  %s %d orphaned blobs", action, deleted)
    logger.info("  Space %s: %.2f MB", "reclaimable" if dry_run else "freed", mb_freed)
    logger.info("═══════════════════════════════════════")


if __name__ == "__main__":
    asyncio.run(main())
