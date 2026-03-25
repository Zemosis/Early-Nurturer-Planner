# Backend Architecture - Complete Documentation

## Overview

The **Early Nurturer Planner Backend** is a FastAPI application powered by a LangGraph multi-agent AI pipeline that generates safety-audited, personalized weekly curriculum plans for infant/toddler classrooms (ages 0–36 months). It uses Google Vertex AI (Gemini 2.5 Flash) for structured content generation, PostgreSQL with pgvector for persistence and embeddings, and the YouTube Data API for enriching plans with real video content.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | FastAPI | Async REST API |
| **AI Engine** | Gemini 2.5 Flash (Vertex AI) | Structured curriculum generation |
| **Orchestration** | LangGraph | Multi-agent pipeline with conditional routing |
| **Database** | PostgreSQL + asyncpg | Async relational storage |
| **Vectors** | pgvector | Developmental embeddings & RAG |
| **Background Tasks** | Google Cloud Tasks | Scalable, reliable background job enqueuing |
| **ORM** | SQLAlchemy 2.0 (async) | Database models & queries |
| **Migrations** | Alembic | Schema versioning |
| **Config** | pydantic-settings | Type-safe .env loading |
| **HTTP Client** | httpx | YouTube API calls |
| **Deployment** | Google Cloud Run | Containerized serverless |

---

## Directory Structure

```
backend/
├── main.py                          # FastAPI app entry point
├── config.py                        # Settings from .env (pydantic-settings)
├── Dockerfile                       # Cloud Run container image
├── .dockerignore                    # Excludes .env, venv, SA keys
├── requirements.txt                 # Python dependencies
├── alembic.ini                      # Alembic config (no credentials)
├── dev-log.md                       # Development journal (phases 1–8)
│
├── app/
│   ├── __init__.py
│   │
│   ├── api/                         # ── FastAPI Routers ──
│   │   ├── __init__.py
│   │   └── routers/
│   │       ├── __init__.py
│   │       ├── themes.py            # POST /api/themes/generate (legacy)
│   │       ├── theme_pool.py        # GET /api/theme-pool/{user_id} (read-only), POST /refresh
│   │       ├── worker.py            # POST /internal/worker/generate-themes (Cloud Tasks worker)
│   │       └── planner.py           # Plan generation, CRUD, PDF, reorder, delete
│   │
│   ├── agents/                      # ── LangGraph AI Pipeline ──
│   │   ├── __init__.py
│   │   ├── state.py                 # PlannerState TypedDict
│   │   ├── schemas.py               # Pydantic models for Gemini structured output
│   │   ├── tools.py                 # Agent tools (DB queries, Gemini calls, YouTube)
│   │   ├── architect.py             # Curriculum Architect node
│   │   ├── auditor.py               # Safety Auditor node
│   │   ├── personalizer.py          # Personalizer node
│   │   ├── youtube_enricher.py      # YouTube video enrichment node
│   │   └── graph.py                 # Graph wiring, save node, routing logic
│   │
│   ├── services/                    # ── Business Logic Services ──
│   │   ├── pdf_service.py           # WeasyPrint PDF generation + GCS upload/cache
│   │   ├── image_service.py         # Vertex AI cover image generation + GCS
│   │   └── task_service.py          # Google Cloud Tasks enqueuing + local fallback
│   │
│   └── db/                          # ── Database Layer ──
│       ├── __init__.py
│       ├── database.py              # Async engine, session factory, Base
│       └── models.py                # All SQLAlchemy ORM models
│
├── alembic/                         # ── Migrations ──
│   ├── env.py                       # Async migration runner
│   ├── script.py.mako               # Template (imports pgvector)
│   └── versions/                    # Migration files
│
└── scripts/                         # ── Dev Utilities ──
    ├── gcp-phase1-setup.sh          # GCP provisioning (Cloud SQL, SA keys)
    ├── seed_db.py                   # Insert mock users/students/embeddings
    ├── seed_yoga_catalog.py         # Seed yoga pose catalog from PDF + GCS
    └── update-db-ip.sh              # Whitelist current IP on Cloud SQL
```

---

## Configuration (`config.py`)

Settings are loaded from `backend/.env` via `pydantic-settings`. The `Settings` class validates all values at startup.

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | `postgresql+asyncpg://user:pass@host:port/db` |
| `GCP_PROJECT_ID` | ❌ | `early-nurturer-planner` | Google Cloud project |
| `GCS_BUCKET_NAME` | ❌ | `early-nurturer-planner-assets` | Cloud Storage bucket |
| `GOOGLE_APPLICATION_CREDENTIALS` | ❌ | `None` | SA key path (optional on Cloud Run) |
| `VERTEX_AI_LOCATION` | ❌ | `us-central1` | Vertex AI region |
| `YOUTUBE_API_KEY` | ❌ | `""` | YouTube Data API v3 key |
| `WORKER_API_KEY` | ✅ | — | Shared secret for internal worker authentication |
| `CLOUD_TASKS_QUEUE` | ❌ | `theme-generation` | Google Cloud Tasks queue name |
| `CLOUD_RUN_URL` | ❌ | `""` | Base URL of the deployed Cloud Run service |

### Validators
- `GOOGLE_APPLICATION_CREDENTIALS` — if provided, verifies the file exists on disk. `None` is allowed (Cloud Run uses built-in SA identity).
- `DATABASE_URL` — must start with `postgresql+asyncpg://`, `postgresql://`, or `postgres://`.

---

## API Endpoints

### `GET /api/theme-pool/{user_id}`
**Router:** `app/api/routers/theme_pool.py`

Returns the user's active theme pool (up to 5). This endpoint is **strictly read-only** and does not trigger background generation. It returns a `generating` flag (boolean) based on whether the current count is less than 5.

**Response:**
```json
{
  "themes": [ { "id": "...", "theme_data": {...} }, ... ],
  "generating": true,
  "pool_size": 5
}
```

---

### `POST /internal/worker/generate-themes`
**Router:** `app/api/routers/worker.py`

Internal worker endpoint triggered by Google Cloud Tasks. Generates missing themes for a specific user to refill their pool.

**Security:** Requires `X-Worker-Key` header matching `WORKER_API_KEY`.

**Request:** `{ "user_id": "uuid" }`

---

### `POST /api/theme-pool/{user_id}/refresh`
**Router:** `app/api/routers/theme_pool.py`

Discards non-kept themes and generates replacements ("Shuffle" button).

**Request:** `{ "keep_ids": ["uuid", ...] }`

**Flow:**
1. Marks all themes NOT in `keep_ids` as `is_used=True`
2. Generates new themes to bring pool back to 5
3. Returns updated pool

---

### `POST /api/themes/generate`
**Router:** `app/api/routers/themes.py` *(legacy — use theme-pool instead)*

Generates AI-powered theme options on-demand without pool persistence.

**Request:** `{ "user_id": "...", "theme_count": 5 }`

**Response:** Array of `ThemeSchema` objects.

---

### `POST /api/planner/generate`
**Router:** `app/api/routers/planner.py`

Triggers the full multi-agent LangGraph pipeline.

**Request:**
```json
{
  "user_id": "83b58b5f-...",
  "selected_theme": { "name": "Fox Forest", ... },
  "theme_pool_id": "uuid-of-pool-entry"  // optional — marks pool theme as used
}
```

**Flow:**
1. Counts existing user plans → `week_number = count + 1`
2. Computes `week_range`, `year`, `month`, `week_of_month` from `today + (week_number - 1) weeks`
3. Marks `theme_pool_id` as `is_used=True` (if provided)
4. Compiles and invokes LangGraph: `fetch_context → architect → auditor → (1 revision max) → personalizer → youtube_enricher → save`
5. Returns `personalized_plan` or falls back to `draft_plan`

**Response:**
```json
{
  "status": "success",
  "plan": { /* WeekPlanSchema */ },
  "plan_id": "uuid"
}
```

---

### `GET /api/planner/{user_id}/plan/{plan_id}`
**Router:** `app/api/routers/planner.py`

Fetch a full plan by UUID. Returns all fields including `daily_plans` (activities grouped by day via `_rebuild_daily_plans()`), `cover_image_url`, and `pdf_url`.

---

### `GET /api/planner/{user_id}/plans`
**Router:** `app/api/routers/planner.py`

Lists all saved weekly plans for a user, ordered by creation date descending.

**Response:**
```json
[
  {
    "id": "uuid",
    "global_week_number": 1,
    "week_of_month": 3,
    "month": 3,
    "year": 2026,
    "theme": "Fox Forest",
    "theme_emoji": "🦊",
    "week_range": "3/17 - 3/21",
    "palette": {...},
    "domains": ["Fine Motor", "Language"],
    "pdf_url": "https://storage.googleapis.com/...",
    "created_at": "2026-03-17T12:00:00Z"
  }
]
```

---

### `PATCH /api/planner/{user_id}/plans/reorder`
**Router:** `app/api/routers/planner.py`

Reorders plans to match the client-supplied sequence of plan IDs. Server recomputes all date fields to maintain the timeline invariant (Curriculum Week N = today + (N-1) calendar weeks).

**Request:**
```json
[
  {"plan_id": "uuid-3"},
  {"plan_id": "uuid-1"},
  {"plan_id": "uuid-2"}
]
```

**Flow:**
1. Validates all plan IDs belong to the user
2. Two-phase update to avoid unique constraint violations:
   - Phase 1: Set `week_number` to temporary negative values
   - Phase 2: Assign sequential `week_number = 1, 2, 3...` based on position
3. Recomputes `year`, `month`, `week_of_month`, `week_range` via `_compute_week_info(today + (N-1) weeks)`

**Response:** Updated list of plans ordered by `week_number` ascending.

---

### `GET /api/planner/{user_id}/plan/{plan_id}/pdf`
**Router:** `app/api/routers/planner.py`

Primary PDF download endpoint with GCS caching.

**Flow:**
- If `pdf_url` cached: proxies GCS content through backend (avoids CORS on direct GCS access)
- If not cached: generates via WeasyPrint, uploads to GCS at `weekly-plans/{plan_id}.pdf`, saves URL to DB, streams bytes
- Falls through to regeneration if the GCS fetch fails

**Response:** `StreamingResponse` with `Content-Disposition: attachment`

---

### `POST /api/planner/{user_id}/plan/{plan_id}/pdf/regenerate`
**Router:** `app/api/routers/planner.py`

Force-regenerates the PDF (bypasses cache).

**Flow:**
1. Deletes existing GCS blob (if any)
2. Regenerates PDF with current plan data + fresh cover image
3. Uploads to GCS, updates `pdf_url` in DB
4. Streams new PDF bytes

---

### `GET /api/planner/{user_id}/week/{week_number}/pdf`
**Router:** `app/api/routers/planner.py` *(legacy — no caching)*

Generates a PDF on-the-fly by week number. No GCS upload or `pdf_url` caching. Kept for backward compatibility.

---

### `DELETE /api/planner/{user_id}/plan/{plan_id}`
**Router:** `app/api/routers/planner.py`

Deletes a plan and renumbers all remaining plans sequentially (1, 2, 3...). Recomputes calendar data for each remaining plan.

**Flow:**
1. Deletes the specified plan
2. Fetches remaining plans ordered by `week_number`
3. Two-phase renumbering with date recomputation (same logic as reorder)

**Response:**
```json
{
  "deleted": "uuid",
  "remaining_count": 2
}
```

---

### `GET /health`
Simple liveness probe. Returns `{"status": "ok"}`.

---

## Running Locally

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Set up .env with DATABASE_URL, GCP credentials, etc.
# Run migrations
alembic upgrade head

# Seed mock data
python scripts/seed_db.py

# Start server
uvicorn main:app --reload --port 8000
```

---

## Deployment (Cloud Run)

```bash
./scripts/deploy-backend.sh
```

Or manually:
```bash
gcloud run deploy early-nurturer-api \
  --source ./backend \
  --project early-nurturer-planner \
  --region us-central1 \
  --allow-unauthenticated \
  --add-cloudsql-instances early-nurturer-planner:us-central1:nurture-postgres \
  --set-env-vars '...' \
  --memory 1Gi --timeout 300 --port 8080
```

**Key details:**
- Cloud Run connects to Cloud SQL via Unix socket (`/cloudsql/...`), not direct IP
- `GOOGLE_APPLICATION_CREDENTIALS` is not needed — Cloud Run uses its built-in SA
- Dockerfile uses `python:3.12-slim`, exposes port 8080
