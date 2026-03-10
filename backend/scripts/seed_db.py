"""
Seed script — populates the database with mock data.

Inserts:
  - 1 User (Sarah, daycare owner)
  - 4 Students tied to Sarah (varying ages, bios)
  - 2 StudentEmbeddings per student (random 768-dim vectors for pgvector testing)

Usage:
    cd backend/
    python scripts/seed_db.py
"""

import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

# Ensure backend/ is on sys.path so config and app resolve.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.db.database import async_session_factory, engine
from app.db.models import EMBEDDING_DIM, Student, StudentEmbedding, User


# ── Mock data ─────────────────────────────────────────────────

SEED_USER = {
    "email": "sarah@littlesprouts.edu",
    "full_name": "Sarah Thompson",
    "daycare_name": "Little Sprouts Learning Center",
    "role": "educator",
    "settings": {"default_theme": "Nature Walk", "notifications": True},
}

SEED_STUDENTS = [
    {
        "name": "Emma Martinez",
        "birthdate": datetime(2023, 3, 15, tzinfo=timezone.utc),
        "age_months": 21,
        "age_group": "12-24m",
        "tags": ["12-24m"],
        "bio": "Loves sensory activities and music. Beginning to use 2-word phrases. "
               "Responds well to texture-rich materials and gentle rhythmic songs.",
    },
    {
        "name": "Liam Chen",
        "birthdate": datetime(2022, 8, 22, tzinfo=timezone.utc),
        "age_months": 30,
        "age_group": "24-36m",
        "tags": ["24-36m"],
        "bio": "Very active and curious. Enjoys circle time and group activities. "
               "Shows strong gross motor skills — loves climbing and jumping.",
    },
    {
        "name": "Sophia Johnson",
        "birthdate": datetime(2023, 11, 10, tzinfo=timezone.utc),
        "age_months": 15,
        "age_group": "12-24m",
        "tags": ["12-24m", "new student"],
        "bio": "Recently joined. Adjusting well to routine. Prefers quiet activities "
               "and one-on-one interactions. Starting to show interest in stacking blocks.",
    },
    {
        "name": "Noah Williams",
        "birthdate": datetime(2024, 1, 5, tzinfo=timezone.utc),
        "age_months": 13,
        "age_group": "12-24m",
        "tags": ["12-24m"],
        "bio": "Walking independently. Enjoys exploring new materials with hands and mouth. "
               "Very social — laughs easily and engages with peers during free play.",
    },
]

# Each student gets two mock embeddings in different developmental domains.
EMBEDDING_DOMAINS = [
    ("Sensory", "Sensory exploration and tactile responsiveness profile."),
    ("Gross Motor", "Large-muscle movement, balance, and coordination snapshot."),
]


# ── Seed logic ────────────────────────────────────────────────

async def seed() -> None:
    async with async_session_factory() as session:
        # Check idempotency — skip if Sarah already exists.
        existing = await session.execute(
            select(User).where(User.email == SEED_USER["email"])
        )
        if existing.scalar_one_or_none():
            print("⚠  Seed data already exists (sarah@littlesprouts.edu found). Skipping.")
            return

        # 1. Create user
        user = User(**SEED_USER)
        session.add(user)
        await session.flush()  # populate user.id
        print(f"✓  Created user: {user.full_name} ({user.id})")

        # 2. Create students
        rng = np.random.default_rng(seed=42)  # deterministic for reproducibility

        for s_data in SEED_STUDENTS:
            student = Student(user_id=user.id, **s_data)
            session.add(student)
            await session.flush()  # populate student.id
            print(f"   ✓  Student: {student.name} — {student.age_months}mo ({student.age_group})")

            # 3. Create embeddings for this student
            for domain, label in EMBEDDING_DOMAINS:
                vec = rng.random(EMBEDDING_DIM).tolist()
                emb = StudentEmbedding(
                    student_id=student.id,
                    domain=domain,
                    label=label,
                    embedding=vec,
                    source_text=f"Mock {domain.lower()} profile for {student.name}.",
                )
                session.add(emb)
            print(f"      ✓  2 embeddings ({EMBEDDING_DIM}-dim) inserted")

        await session.commit()
        print("\n✅  Seed complete — 1 user, 4 students, 8 embeddings.")


async def main() -> None:
    try:
        await seed()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
