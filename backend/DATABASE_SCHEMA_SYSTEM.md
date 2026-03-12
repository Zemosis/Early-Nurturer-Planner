# Database Schema System - Complete Documentation

## Overview

The **Database Layer** uses PostgreSQL with the `pgvector` extension, accessed via SQLAlchemy 2.0's async API backed by `asyncpg`. The schema is divided into two sections: **Relational Models** (core app data) and **Agentic/Vector Models** (AI pipeline audit trail and embeddings).

---

## Connection Architecture

### Engine (`app/db/database.py`)

```
PostgreSQL (Cloud SQL)
    ↕  asyncpg driver
SQLAlchemy 2.0 Async Engine
    ↕  pool_size=5, max_overflow=10, pool_pre_ping=True
async_session_factory (AsyncSession)
    ↕
FastAPI / LangGraph nodes
```

- **Local dev:** Direct TCP to Cloud SQL public IP (`34.69.136.252:5432`)
- **Cloud Run:** Unix socket via Cloud SQL Auth Proxy (`/cloudsql/early-nurturer-planner:us-central1:nurture-postgres`)

### Session Management
- `get_session()` — Async generator for FastAPI `Depends()`. Auto-commits on success, rolls back on exception.
- `async_session_factory()` — Used directly in LangGraph nodes (not via `Depends`).

---

## Entity Relationship Diagram

```
┌──────────┐       ┌──────────────┐       ┌───────────────────┐
│  users   │──1:N──│   students   │──1:N──│ student_embeddings│
│          │       │              │       │   (pgvector 768d) │
│          │       └──────────────┘       └───────────────────┘
│          │
│          │──1:N──┌──────────────┐
│          │       │ weekly_plans │
│          │       └──────────────┘
│          │
│          │──1:N──┌──────────────┐
│          │       │ chat_history │
└──────────┘       └──────────────┘

┌─────────────────────┐    ┌──────────────────┐    ┌──────────────────────┐
│ agent_reasoning_logs │    │ agent_checkpoints │    │   critique_history   │
│   (audit trail)      │    │  (state snapshots)│    │ (architect↔auditor)  │
└─────────────────────┘    └──────────────────┘    └──────────────────────┘

┌──────────────────────────┐
│ vector_store_curriculum   │
│   (RAG chunks, 768d)     │
└──────────────────────────┘
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

**Relationships:** `students` (1:N), `weekly_plans` (1:N), `chat_messages` (1:N) — all cascade delete.

---

### `students`

Child profiles — mirrors frontend `Student` interface (`src/app/types/student.ts`).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Child ID |
| `user_id` | UUID | FK → users.id, CASCADE | Educator who enrolled this child |
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

**Indexes:** `ix_students_user_id`, `ix_students_age_group`
**Relationships:** `user` (N:1), `embeddings` (1:N cascade)

---

### `weekly_plans`

Generated curriculum plans — stores the full plan payload as JSONB.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Plan ID |
| `user_id` | UUID | FK → users.id, CASCADE | Educator |
| `week_number` | INTEGER | NOT NULL | Week number (e.g. 1) |
| `week_range` | VARCHAR(50) | NOT NULL | e.g. "2/23 - 2/27" |
| `theme` | VARCHAR(255) | NOT NULL | Theme name |
| `theme_emoji` | VARCHAR(10) | nullable | e.g. "🦊" |
| `palette` | JSONB | nullable | `{primary, secondary, accent, background}` |
| `domains` | JSONB | nullable | `["Fine Motor", "Language", "Sensory"]` |
| `objectives` | JSONB | nullable | `[{domain, goal}]` |
| `circle_time` | JSONB | nullable | Full circle time data (songs, yoga, letter, etc.) |
| `activities` | JSONB | nullable | Flattened activity list (all 5 days combined) |
| `newsletter` | JSONB | nullable | `{professional, warm}` versions |
| `is_generated` | BOOLEAN | default true | AI-generated vs manually created |
| `created_at` | TIMESTAMPTZ | | |
| `updated_at` | TIMESTAMPTZ | | |

**Index:** `ix_weekly_plans_user_week` on `(user_id, week_number)`

⚠️ **Known Bug:** No unique constraint on `(user_id, week_number)` — multiple plans accumulate for the same week. Needs upsert fix. See `dev-log.md`.

---

### `chat_history`

Persistent chat messages for educator ↔ AI assistant conversations.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Message ID |
| `user_id` | UUID | FK → users.id | |
| `thread_id` | VARCHAR(255) | NOT NULL, indexed | Conversation grouping |
| `role` | ENUM | NOT NULL | `user`, `assistant`, `system` |
| `content` | TEXT | NOT NULL | Message body |
| `metadata` | JSONB | nullable | Token counts, model info |
| `created_at` | TIMESTAMPTZ | | |

**Index:** `ix_chat_history_thread_created` on `(thread_id, created_at)`

---

## Section 2: Agentic & Vector Models

### `student_embeddings`

Developmental "vibes" stored as pgvector embeddings for personalization.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `student_id` | UUID | FK → students.id |
| `domain` | VARCHAR(100) | e.g. "Sensory", "Gross Motor" |
| `label` | VARCHAR(255) | Human-readable snapshot description |
| `embedding` | Vector(768) | pgvector column (Vertex AI textembedding-gecko) |
| `source_text` | TEXT | Raw text that was embedded |
| `created_at` | TIMESTAMPTZ | |

**Index:** `ix_student_embeddings_student_domain` on `(student_id, domain)`

---

### `agent_reasoning_logs`

Chain-of-thought audit trail for every LangGraph node invocation.

| Column | Type | Description |
|---|---|---|
| `log_id` | UUID | PK |
| `thread_id` | VARCHAR(255) | LangGraph run ID |
| `agent_name` | VARCHAR(100) | architect, auditor, personalizer, save |
| `internal_monologue` | TEXT | Full reasoning trace |
| `tools_used` | JSONB | `[{tool, input, output}]` |
| `input_summary` | TEXT | What the agent received |
| `output_summary` | TEXT | What the agent produced |
| `duration_ms` | INTEGER | Wall-clock time |
| `timestamp` | TIMESTAMPTZ | |

**Index:** `ix_agent_logs_thread_ts` on `(thread_id, timestamp)`

---

### `agent_checkpoints`

LangGraph state snapshots for resume-on-failure (not yet implemented).

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `thread_id` | VARCHAR(255) | LangGraph thread |
| `checkpoint_ns` | VARCHAR(255) | Sub-graph namespace |
| `parent_checkpoint_id` | VARCHAR(255) | For branching |
| `state` | JSONB | Full serialized LangGraph state |
| `metadata` | JSONB | Step count, node name |
| `created_at` | TIMESTAMPTZ | |

**Index:** `ix_checkpoints_thread_ns` on `(thread_id, checkpoint_ns)`

---

### `critique_history`

Architect ↔ Auditor debate records. One row per critique round.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `thread_id` | VARCHAR(255) | Pipeline run ID |
| `round_number` | INTEGER | 1 = first pass, 2 = revision, ... |
| `architect_proposal` | TEXT | Draft plan JSON |
| `auditor_feedback` | TEXT | Critique text |
| `resolution` | TEXT | Final merged plan JSON |
| `accepted` | BOOLEAN | Did auditor accept? |
| `scores` | JSONB | `{safety, developmental_fit, creativity}` |
| `created_at` | TIMESTAMPTZ | |

**Index:** `ix_critique_thread_round` on `(thread_id, round_number)`

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
| `token_count` | INTEGER | Tokens in this chunk |
| `metadata` | JSONB | Page number, section, etc. |
| `created_at` | TIMESTAMPTZ | |

**Index:** `ix_curriculum_source_chunk` on `(source_document, chunk_index)`

---

## Migrations (Alembic)

- Config: `alembic.ini` (no credentials — loaded from `.env`)
- Async runner: `alembic/env.py` uses `async_engine_from_config` + `asyncio.run()`
- Template: `script.py.mako` pre-imports `pgvector.sqlalchemy.Vector`
- Initial migration: `2026_03_09_5f368ee0298a_initial_schema_with_pgvector.py`

```bash
# Apply migrations
cd backend
alembic upgrade head

# Generate new migration after model changes
alembic revision --autogenerate -m "description"
```

---

## Seed Data (`scripts/seed_db.py`)

Inserts mock data for development:
- **1 User:** Sarah Thompson (Little Sprouts Learning Center)
- **4 Students:** Emma (21mo), Liam (30mo), Sophia (13mo), Noah (25mo)
- **8 Embeddings:** 2 per student (Sensory + Gross Motor domains, random 768-dim vectors)

Idempotent — checks for existing data before inserting.

---

## Constants

| Constant | Value | Location | Description |
|---|---|---|---|
| `EMBEDDING_DIM` | 768 | `models.py` | Vertex AI textembedding-gecko output dimension |

If switching to a different embedding model (e.g. OpenAI 1536-dim), update this constant and generate a new Alembic migration.

---

## JSONB Strategy

Rich nested data (activities, circle_time, palette, objectives, newsletter) is stored as JSONB rather than normalized tables. This keeps the schema manageable and matches how the frontend consumes the data as nested objects. Can be normalized later if query patterns demand it.
