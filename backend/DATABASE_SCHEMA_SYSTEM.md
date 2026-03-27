# Database Schema System

## Overview

The **Database Layer** uses Supabase (PostgreSQL) with the `pgvector` extension, accessed via SQLAlchemy 2.0's async API backed by `asyncpg`. The schema is divided into two sections: **Relational Models** (core app data) and **Agentic/Vector Models** (AI pipeline audit trail and embeddings).

---

## Connection Architecture

### Engine (`app/db/database.py`)

```
Supabase (PostgreSQL)
    |  asyncpg driver (direct TCP)
SQLAlchemy 2.0 Async Engine
    |  pool_size=5, max_overflow=10, pool_pre_ping=True
async_session_factory (AsyncSession)
    |
FastAPI / LangGraph nodes
```

- **Local dev:** Direct TCP to Supabase: `postgresql+asyncpg://postgres:pass@db.xxx.supabase.co:5432/postgres`
- **Cloud Run:** Same direct TCP connection (no proxy needed)

### Session Management
- `get_session()` -- Async generator for FastAPI `Depends()`. Auto-commits on success, rolls back on exception.
- `async_session_factory()` -- Used directly in LangGraph nodes (not via `Depends`).

---

## Entity Relationship Diagram

```
+----------+       +--------------+       +-------------------+
|  users   |--1:N--|   students   |--1:N--| student_embeddings|
|          |       |              |       |   (pgvector 768d) |
|          |       +--------------+       +-------------------+
|          |
|          |--1:N--+--------------+
|          |       | weekly_plans |
|          |       +--------------+
|          |
|          |--1:N--+--------------+
|          |       | chat_history |
|          |       +--------------+
|          |
|          |--1:N--+--------------+
|          |       |  theme_pool  |  (pre-generated theme cache)
+----------+       +--------------+

+---------------------+    +------------------+    +----------------------+
| agent_reasoning_logs |    | agent_checkpoints |    |   critique_history   |
|   (audit trail)      |    |  (state snapshots)|    | (legacy, not active) |
+---------------------+    +------------------+    +----------------------+

+--------------------------+    +----------------------+
| vector_store_curriculum   |    |     yoga_poses        |
|   (RAG chunks, 768d)     |    |  (pose catalog, 768d) |
+--------------------------+    +----------------------+
```

---

## Section 1: Relational Models

### `users`

Educator profile, daycare info, and global settings.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default uuid4 | Educator ID |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Login email |
| `full_name` | VARCHAR(255) | NOT NULL | Display name |
| `daycare_name` | VARCHAR(255) | nullable | Facility name |
| `role` | VARCHAR(50) | default "educator" | User role |
| `settings` | JSONB | nullable | Preferences (theme defaults, notifications) |
| `is_active` | BOOLEAN | default true | Soft delete flag |
| `created_at` | TIMESTAMPTZ | server_default now() | |
| `updated_at` | TIMESTAMPTZ | server_default now(), onupdate | |

**Relationships:** `students` (1:N), `weekly_plans` (1:N), `chat_messages` (1:N) -- all cascade delete.

---

### `students`

Child profiles linked to an educator.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Child ID |
| `user_id` | UUID | FK -> users.id, CASCADE | Educator who enrolled this child |
| `name` | VARCHAR(255) | NOT NULL | Child's first name |
| `birthdate` | TIMESTAMPTZ | NOT NULL | Date of birth |
| `age_months` | INTEGER | NOT NULL | Current age in months |
| `age_group` | ENUM | NOT NULL | `0-12m`, `12-24m`, or `24-36m` |
| `photo_url` | VARCHAR(512) | nullable | Profile photo |
| `tags` | JSONB | nullable | e.g. `["special needs", "new student"]` |
| `bio` | TEXT | nullable | Developmental notes by educator |
| `is_active` | BOOLEAN | default true | Soft delete |
| `created_at` | TIMESTAMPTZ | | |
| `updated_at` | TIMESTAMPTZ | | |

**Indexes:**
- `ix_students_user_id` on `user_id`
- `ix_students_user_active` on `(user_id, is_active)` (composite)
- `ix_students_age_group` on `age_group`

---

### `weekly_plans`

Generated curriculum plans with full payload stored as JSONB columns.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Plan ID |
| `user_id` | UUID | FK -> users.id, CASCADE | Educator |
| `week_number` | INTEGER | NOT NULL | Curriculum week number (sequential: 1, 2, 3...) |
| `year` | INTEGER | nullable | Calendar year |
| `month` | INTEGER | nullable | Calendar month (1-12) |
| `week_of_month` | INTEGER | nullable | Week within month (1-5) |
| `week_range` | VARCHAR(50) | NOT NULL | e.g. "3/17 - 3/21" |
| `theme` | VARCHAR(255) | NOT NULL | Theme name |
| `theme_emoji` | VARCHAR(10) | nullable | e.g. "fox emoji" |
| `palette` | JSONB | nullable | `{primary, secondary, accent, background}` |
| `domains` | JSONB | nullable | `["Fine Motor", "Language", "Sensory"]` |
| `objectives` | JSONB | nullable | `[{domain, goal}]` |
| `circle_time` | JSONB | nullable | Full circle time data |
| `activities` | JSONB | nullable | Flattened activity list (all 5 days combined) |
| `newsletter` | JSONB | nullable | `{professional, warm}` versions |
| `cover_image_url` | VARCHAR(512) | nullable | GCS URL to AI-generated cover image |
| `pdf_url` | VARCHAR(512) | nullable | GCS URL to generated PDF |
| `material_urls` | JSONB | nullable | Cached material poster URLs |
| `is_generated` | BOOLEAN | default true | AI-generated vs manual |
| `created_at` | TIMESTAMPTZ | | |
| `updated_at` | TIMESTAMPTZ | | |

**Indexes:** `ix_weekly_plans_user_created` on `(user_id, created_at)`

**Constraints:** `UniqueConstraint("user_id", "week_number", name="uq_weekly_plans_user_week_number")`

**Timeline Invariant:** Curriculum Week N = `today + (N-1) calendar weeks`. Server recomputes `year`, `month`, `week_of_month`, `week_range` on every write (generate, reorder, delete).

---

### `theme_pool`

Persistent pool of pre-generated AI theme options per user.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default uuid4 | Pool entry ID |
| `user_id` | UUID | FK -> users.id, CASCADE | Educator |
| `theme_data` | JSONB | NOT NULL | Full ThemeSchema dict |
| `is_used` | BOOLEAN | default false, NOT NULL | False = available, True = consumed |
| `plan_id` | UUID | nullable | FK to weekly_plans.id (set when plan generated) |
| `created_at` | TIMESTAMPTZ | server_default now() | |

**Index:** `ix_theme_pool_user_active` on `(user_id, is_used)`

**Pool invariant:** Each user always has up to 5 rows with `is_used=False`.

---

### `chat_history`

Persistent chat messages for educator-AI conversations.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Message ID |
| `user_id` | UUID | FK -> users.id | |
| `thread_id` | VARCHAR(255) | NOT NULL, indexed | Conversation grouping |
| `role` | ENUM | NOT NULL | `user`, `assistant`, `system` |
| `content` | TEXT | NOT NULL | Message body |
| `metadata` | JSONB | nullable | Token counts, model info |
| `created_at` | TIMESTAMPTZ | | |

**Index:** `ix_chat_history_thread_created` on `(thread_id, created_at)`

---

## Section 2: Agentic & Vector Models

### `student_embeddings`

Developmental profile vectors for personalization.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `student_id` | UUID | FK -> students.id |
| `domain` | VARCHAR(100) | e.g. "Sensory", "Gross Motor" |
| `label` | VARCHAR(255) | Human-readable description |
| `embedding` | Vector(768) | pgvector (Vertex AI text-embedding-004) |
| `source_text` | TEXT | Raw text that was embedded |
| `created_at` | TIMESTAMPTZ | |

**Index:** `ix_student_embeddings_student_domain` on `(student_id, domain)`

---

### `yoga_poses`

Yoga pose catalog extracted from "Yoga for the Classroom" PDF. ~31 poses with GCS images and 768-dim embeddings for semantic search.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default uuid4 | |
| `name` | VARCHAR(255) | UNIQUE, NOT NULL | Pose name |
| `image_url` | VARCHAR(512) | NOT NULL | Public GCS URL |
| `how_to` | JSONB | nullable | Step-by-step instructions (string array) |
| `creative_cues` | JSONB | nullable | Kid-friendly prompts (string array) |
| `embedding` | Vector(768) | nullable | text-embedding-004 vector |
| `created_at` | TIMESTAMPTZ | server_default now() | |

**Seeded by:** `scripts/seed_yoga_catalog.py`
**Queried by:** `youtube_enricher.py -> _find_yoga_poses()` via cosine distance

---

### `agent_reasoning_logs`

Audit trail for pipeline completions.

| Column | Type | Description |
|---|---|---|
| `log_id` | UUID | PK |
| `thread_id` | VARCHAR(255) | LangGraph run ID |
| `agent_name` | VARCHAR(100) | Node name (e.g. "save") |
| `internal_monologue` | TEXT | Completion summary |
| `tools_used` | JSONB | Tool invocations |
| `input_summary` | TEXT | What the node received |
| `output_summary` | TEXT | What the node produced |
| `duration_ms` | INTEGER | Wall-clock time |
| `timestamp` | TIMESTAMPTZ | |

---

### `agent_checkpoints`

LangGraph state snapshots (reserved for future resume-on-failure).

---

### `critique_history`

Legacy table from the removed Auditor node. Not actively populated by the current pipeline.

---

### `vector_store_curriculum`

Chunked pedagogy PDFs for RAG pipeline (not yet populated with real data).

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `source_document` | VARCHAR(512) | Filename or GCS URI |
| `chunk_index` | INTEGER | Position within source |
| `content` | TEXT | Raw chunk text |
| `embedding` | Vector(768) | pgvector column |
| `token_count` | INTEGER | |
| `metadata` | JSONB | Page number, section, etc. |

---

## Migrations (Alembic)

```bash
cd backend
alembic upgrade head                          # Apply all migrations
alembic revision --autogenerate -m "message"  # Create new migration
alembic downgrade -1                          # Rollback one step
```

- Config: `alembic.ini` (credentials loaded from `.env`)
- Async runner: `alembic/env.py` uses `async_engine_from_config`
- Template: `script.py.mako` pre-imports `pgvector.sqlalchemy.Vector`

---

## Seed Data

### `scripts/seed_db.py`

Inserts deterministic mock data:
- **1 User:** Sarah Thompson (ID: `83b58b5f-698b-4ae1-9529-f83d97641f01` -- matches frontend `DEFAULT_USER_ID`)
- **4 Students:** Emma (21mo), Liam (30mo), Sophia (15mo), Noah (13mo)
- **8 Embeddings:** 2 per student (Sensory + Gross Motor, deterministic 768-dim vectors)

Idempotent -- skips if Sarah already exists.

### `scripts/seed_yoga_catalog.py`

Seeds ~31 yoga poses from the "Yoga for the Classroom" PDF:
1. Parses raw page text with Gemini -> `{name, how_to, creative_cues}`
2. Matches image file in `data_prep/images/`
3. Uploads image to GCS (`yoga/` folder)
4. Generates 768-dim embedding via `text-embedding-004`
5. Upserts row into `yoga_poses` table

Idempotent -- skips poses that already exist by name.

---

## Constants

| Constant | Value | Location | Description |
|---|---|---|---|
| `EMBEDDING_DIM` | 768 | `models.py` | Vertex AI text-embedding-004 output dimension |

---

## JSONB Strategy

Rich nested data (activities, circle_time, palette, objectives, newsletter) is stored as JSONB rather than normalized tables. This keeps the schema manageable and matches how the frontend consumes the data as nested objects.
