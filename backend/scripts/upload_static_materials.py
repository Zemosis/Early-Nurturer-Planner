"""
Upload the 3 static Circle Time PDFs from samples/ to GCS.

Usage:
    PYTHONPATH=backend python backend/scripts/upload_static_materials.py

Uploads:
    samples/Types of Weather (Circle time).pdf  -> static-materials/weather.pdf
    samples/Days of the Week Poster.pdf         -> static-materials/days_of_the_week.pdf
    samples/Months of the Year (Cirlcel Time).pdf -> static-materials/months_of_the_year.pdf
"""

from pathlib import Path
from google.cloud import storage
from config import settings

BUCKET_NAME = settings.GCS_BUCKET_NAME
PROJECT_ID = settings.GCP_PROJECT_ID

SAMPLES_DIR = Path(__file__).resolve().parent.parent.parent / "samples"

FILES_TO_UPLOAD = [
    {
        "local": SAMPLES_DIR / "Types of Weather (Circle time).pdf",
        "blob": "static-materials/weather.pdf",
    },
    {
        "local": SAMPLES_DIR / "Days of the Week Poster.pdf",
        "blob": "static-materials/days_of_the_week.pdf",
    },
    {
        "local": SAMPLES_DIR / "Months of the Year (Cirlcel Time).pdf",
        "blob": "static-materials/months_of_the_year.pdf",
    },
]


def main() -> None:
    client = storage.Client(project=PROJECT_ID)
    bucket = client.bucket(BUCKET_NAME)

    for entry in FILES_TO_UPLOAD:
        local_path: Path = entry["local"]
        blob_name: str = entry["blob"]

        if not local_path.exists():
            print(f"  ✗ MISSING: {local_path}")
            continue

        blob = bucket.blob(blob_name)
        blob.upload_from_filename(str(local_path), content_type="application/pdf")
        # NOTE: bucket uses uniform bucket-level access — public read is
        # controlled by the bucket IAM policy, not per-object ACLs.

        public_url = f"https://storage.googleapis.com/{BUCKET_NAME}/{blob_name}"
        print(f"  ✓ Uploaded {local_path.name}")
        print(f"    → {public_url}")

    print("\nDone.")


if __name__ == "__main__":
    main()
