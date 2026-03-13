#!/usr/bin/env python3
"""
Phase 1 — Extract raw text and pose images from the yoga poses PDF.

Names each image after the yoga pose extracted from the page text.
Skips decorative borders and logos automatically.

Usage:
    cd backend/
    pip install PyMuPDF   # if not installed
    python scripts/extract_pdf_raw.py

Outputs:
    data_prep/raw_text.json              — {page_number: text} mapping
    data_prep/images/{pose-name}.png     — pose photos named by pose
"""

import json
import os
import re
import sys

import fitz  # PyMuPDF

# ── Paths ──────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)

PDF_PATH = os.path.expanduser(
    "~/workspace/OmYogaFlowChildrensYogaTeacherTrainingPostures-Part1-1.pdf"
)

OUTPUT_DIR = os.path.join(BACKEND_DIR, "data_prep")
IMAGES_DIR = os.path.join(OUTPUT_DIR, "images")
RAW_TEXT_PATH = os.path.join(OUTPUT_DIR, "raw_text.json")

MIN_IMAGE_DIM = 100  # ignore images smaller than 100px on either side

# Pages that are NOT pose pages (cover, TOC, section dividers, notes,
# continuation pages that don't introduce a new pose name)
SKIP_PAGES = {1, 2, 3, 4, 17, 25, 27, 28, 36, 41}

# Header pattern to strip before extracting the pose name
_HEADER_RE = re.compile(
    r"100[ -]Hour Children.*?Training.*?RCYT.*?\d+",
    re.IGNORECASE | re.DOTALL,
)


def _extract_pose_name(page_text: str) -> str | None:
    """Return the yoga pose name from a page's text, or None."""
    # Strip the repeated header line
    text = _HEADER_RE.sub("", page_text)
    # Grab the first non-empty line after stripping whitespace
    for line in text.splitlines():
        line = line.strip()
        if line and len(line) > 2:
            return line
    return None


def _to_kebab(name: str) -> str:
    """Convert a pose name to a kebab-case filename slug."""
    # Remove parenthetical content and apostrophes for cleaner filenames
    slug = re.sub(r"\(.*?\)", "", name)
    slug = slug.replace("'", "").replace("\u2019", "")
    slug = slug.strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug


def _is_border(width: int, height: int) -> bool:
    """Detect full-page decorative border images."""
    return width > 1500 and height > 1500


def _is_logo(width: int, height: int) -> bool:
    """Detect wide/short logo banners (aspect ratio > 4:1)."""
    if height == 0:
        return True
    return (width / height) > 4.0


def _save_image(doc, xref: int, filepath: str) -> bool:
    """Extract image by xref and save as PNG. Returns True on success."""
    try:
        base_image = doc.extract_image(xref)
    except Exception:
        return False
    if not base_image:
        return False

    img_bytes = base_image["image"]
    img_ext = base_image.get("ext", "png")

    if img_ext == "png":
        with open(filepath, "wb") as f:
            f.write(img_bytes)
    else:
        pix = fitz.Pixmap(img_bytes)
        if pix.n > 4:  # CMYK → RGB
            pix = fitz.Pixmap(fitz.csRGB, pix)
        pix.save(filepath)
    return True


def main() -> None:
    # ── Validate PDF exists ────────────────────────────────────
    if not os.path.isfile(PDF_PATH):
        print(f"ERROR: PDF not found at {PDF_PATH}", file=sys.stderr)
        sys.exit(1)

    # ── Create output directories ──────────────────────────────
    os.makedirs(IMAGES_DIR, exist_ok=True)
    print(f"Output dirs ready: {IMAGES_DIR}")

    # ── Open PDF ───────────────────────────────────────────────
    doc = fitz.open(PDF_PATH)
    total_pages = len(doc)
    print(f"Opened PDF: {total_pages} pages\n")

    page_texts: dict[int, str] = {}
    total_images_saved = 0
    total_images_skipped = 0

    for page_num in range(total_pages):
        page = doc[page_num]
        display_num = page_num + 1  # 1-indexed

        # ── Extract text (always, for raw_text.json) ───────────
        text = page.get_text("text")
        page_texts[display_num] = text

        # ── Skip non-pose pages ────────────────────────────────
        if display_num in SKIP_PAGES:
            print(f"  Page {display_num:3d}: SKIP (non-pose page)")
            continue

        # ── Extract pose name from text ────────────────────────
        pose_name = _extract_pose_name(text)
        if not pose_name:
            print(f"  Page {display_num:3d}: SKIP (no pose name found)")
            continue

        slug = _to_kebab(pose_name)

        # ── Extract & filter images ────────────────────────────
        image_list = page.get_images(full=True)
        pose_images = []

        for img_info in image_list:
            xref = img_info[0]
            try:
                base_image = doc.extract_image(xref)
            except Exception:
                continue
            if not base_image:
                continue

            w, h = base_image["width"], base_image["height"]

            # Filter out non-pose images
            if w < MIN_IMAGE_DIM or h < MIN_IMAGE_DIM:
                total_images_skipped += 1
                continue
            if _is_border(w, h):
                total_images_skipped += 1
                continue
            if _is_logo(w, h):
                total_images_skipped += 1
                continue

            pose_images.append(xref)

        # ── Save pose images with name ─────────────────────────
        if len(pose_images) == 1:
            filepath = os.path.join(IMAGES_DIR, f"{slug}.png")
            if _save_image(doc, pose_images[0], filepath):
                total_images_saved += 1
                print(f"  Page {display_num:3d}: {pose_name} → {slug}.png")
        elif len(pose_images) > 1:
            for i, xref in enumerate(pose_images, start=1):
                filepath = os.path.join(IMAGES_DIR, f"{slug}-{i}.png")
                if _save_image(doc, xref, filepath):
                    total_images_saved += 1
            print(
                f"  Page {display_num:3d}: {pose_name} → "
                f"{slug}-1.png … {slug}-{len(pose_images)}.png"
            )
        else:
            print(f"  Page {display_num:3d}: {pose_name} — no pose images found")

    doc.close()

    # ── Dump raw text to JSON ──────────────────────────────────
    with open(RAW_TEXT_PATH, "w", encoding="utf-8") as f:
        json.dump(page_texts, f, indent=2, ensure_ascii=False)

    print(f"\nDone!")
    print(f"  Pages processed : {total_pages}")
    print(f"  Images saved    : {total_images_saved}")
    print(f"  Images skipped  : {total_images_skipped} (border/logo/tiny)")
    print(f"  Text JSON       : {RAW_TEXT_PATH}")
    print(f"  Images folder   : {IMAGES_DIR}")


if __name__ == "__main__":
    main()
