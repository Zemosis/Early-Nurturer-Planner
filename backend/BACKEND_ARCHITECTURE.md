# Backend Architecture

## Overview

The **Early Nurturer Planner Backend** is a FastAPI application powered by a LangGraph AI pipeline that generates personalized weekly curriculum plans for infant/toddler classrooms (ages 0-36 months). It uses Google Vertex AI (Gemini 2.5 Flash) for structured content generation, Supabase (PostgreSQL + pgvector) for persistence and embeddings, and the YouTube Data API for enriching plans with real video content.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | FastAPI | Async REST API |
| **AI Engine** | Gemini 2.5 Flash (Vertex AI) | Structured curriculum generation |
| **Orchestration** | LangGraph | Multi-node pipeline with parallel fan-out |
| **Database** | Supabase (PostgreSQL) + asyncpg | Async relational storage |
| **Vectors** | pgvector | Developmental embeddings & yoga pose search |
| **Background Tasks** | Google Cloud Tasks | Scalable background job enqueuing |
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
├── .dockerignore
├── requirements.txt
├── alembic.ini                      # Alembic config (no credentials)
│
├── app/
│   ├── __init__.py
│   │
│   ├── api/                         # -- FastAPI Routers --
│   │   ├── __init__.py
│   │   └── routers/
│   │       ├── __init__.py
│   │       ├── themes.py            # POST /api/themes/generate (legacy)
│   │       ├── theme_pool.py        # GET /api/theme-pool/{user_id}, POST /refresh
│   │       ├── worker.py            # POST /internal/worker/generate-themes (Cloud Tasks)
│   │       └── planner.py           # Plan generation, CRUD, PDF, reorder, delete
│   │
│   ├── agents/                      # -- LangGraph AI Pipeline --
│   │   ├── __init__.py
│   │   ├── state.py                 # PlannerState TypedDict
│   │   ├── schemas.py               # Pydantic models for Gemini structured output
│   │   ├── tools.py                 # Agent tools (DB queries, Gemini calls, YouTube)
│   │   ├── architect.py             # Master Architect + Day Architect (2-stage split)
│   │   ├── youtube_enricher.py      # YouTube songs + yoga pose vector search
│   │   └── graph.py                 # Graph wiring, parallel fan-out, save node
│   │
│   ├── services/                    # -- Business Logic Services --
│   │   ├── pdf_service.py           # WeasyPrint PDF generation + GCS upload/cache
│   │   ├── image_service.py         # Vertex AI cover image generation + GCS
│   │   ├── material_service.py      # Material poster generation
│   │   └── task_service.py          # Google Cloud Tasks enqueuing + local fallback
│   │
│   └── db/                          # -- Database Layer --
│       ├── __init__.py
│       ├── database.py              # Async engine, session factory, Base
│       └── models.py                # All SQLAlchemy ORM models
│
├── alembic/                         # -- Migrations --
│   ├── env.py                       # Async migration runner
│   ├── script.py.mako
│   └── versions/
│
└── scripts/                         # -- Dev Utilities --
    ├── seed_db.py                   # Insert mock users/students/embeddings
    └── seed_yoga_catalog.py         # Seed yoga pose catalog from PDF + GCS
```

---

## Configuration (`config.py`)

Settings are loaded from `backend/.env` via `pydantic-settings`.

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | -- | `postgresql+asyncpg://user:pass@host:port/db` (Supabase) |
| `GCP_PROJECT_ID` | No | `early-nurturer-planner` | Google Cloud project |
| `GCS_BUCKET_NAME` | No | `early-nurturer-planner-assets` | Cloud Storage bucket |
| `GOOGLE_APPLICATION_CREDENTIALS` | No | `None` | SA key path (not needed on Cloud Run) |
| `VERTEX_AI_LOCATION` | No | `us-central1` | Vertex AI region |
| `YOUTUBE_API_KEY` | No | `""` | YouTube Data API v3 key |
| `WORKER_API_KEY` | Yes | -- | Shared secret for internal worker auth |
| `CLOUD_TASKS_QUEUE` | No | `theme-generation` | Google Cloud Tasks queue name |
| `CLOUD_RUN_URL` | No | `""` | Cloud Run service URL (empty = local mode) |

---

## LangGraph Pipeline

```
START --> fetch_context --> master_architect --> parallel_generate --> assemble_plan --> save --> END
                                                     |
                                              asyncio.gather:
                                              1. generate_days (5 daily plans)
                                              2. enrich_circle_time (YouTube + yoga)
```

See `AGENTIC_PIPELINE_SYSTEM.md` for full pipeline documentation.

---

## API Endpoints

### Theme Pool

**`GET /api/theme-pool/{user_id}`** -- Returns the user's active theme pool (up to 5 unused themes). Strictly read-only; returns a `generating` flag when pool is incomplete.

**`POST /api/theme-pool/{user_id}/refresh`** -- Discards non-kept themes and generates replacements ("Shuffle" button). Body: `{ "keep_ids": ["uuid", ...] }`

**`POST /internal/worker/generate-themes`** -- Cloud Tasks callback for background theme generation. Requires `X-Worker-Key` header.

### Plan Generation

**`POST /api/planner/generate`** -- Triggers the full LangGraph pipeline. Marks the chosen theme pool entry as used.
```json
{
  "user_id": "83b58b5f-...",
  "selected_theme": { "name": "Fox Forest", ... },
  "theme_pool_id": "uuid-of-pool-entry"
}
```

Pipeline: `fetch_context -> master_architect -> parallel_generate -> assemble_plan -> save`

Response: `{ "status": "success", "plan": { ... }, "plan_id": "uuid" }`

### Plan CRUD

**`GET /api/planner/{user_id}/plans`** -- List all saved plans, ordered by creation date descending.

**`GET /api/planner/{user_id}/plan/{plan_id}`** -- Fetch a full plan by UUID (includes rebuilt `daily_plans`, `cover_image_url`, `pdf_url`).

**`DELETE /api/planner/{user_id}/plan/{plan_id}`** -- Delete a plan and renumber remaining plans sequentially with date recomputation.

**`PATCH /api/planner/{user_id}/plans/reorder`** -- Reorder plans to match client-supplied sequence. Two-phase update to avoid unique constraint violations. Recomputes all calendar fields.

### PDF

**`GET /api/planner/{user_id}/plan/{plan_id}/pdf`** -- Download PDF (GCS-cached). Generates on first request, proxies from GCS on subsequent requests.

**`POST /api/planner/{user_id}/plan/{plan_id}/pdf/regenerate`** -- Force-regenerate PDF (deletes GCS blob, rebuilds with fresh cover image).

**`GET /api/planner/{user_id}/week/{week_number}/pdf`** -- Legacy per-week PDF (no caching).

### Materials

**`GET /api/planner/{user_id}/plan/{plan_id}/materials/{material_type}`** -- Download a material poster (letter, color, shape, counting, yoga) as PDF.

**`POST /api/planner/{user_id}/plan/{plan_id}/materials/bulk-export`** -- Bulk export multiple material types as a single combined PDF.

### Other

**`POST /api/planner/{user_id}/plan/{plan_id}/circle-time/songs`** -- Update greeting/goodbye songs on a saved plan.

**`GET /api/planner/{user_id}/plan/{plan_id}/youtube-search`** -- Search YouTube for replacement songs.

**`POST /api/themes/generate`** -- Legacy on-demand theme generation (use theme-pool instead).

**`GET /health`** -- Liveness probe.

---

## Running Locally

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Set up .env with DATABASE_URL (Supabase), GCP credentials, etc.
alembic upgrade head
python scripts/seed_db.py
python scripts/seed_yoga_catalog.py

uvicorn main:app --reload --port 8000
```

---

## Deployment (Cloud Run)

```bash
./scripts/deploy-backend.sh
```

The script reads `DATABASE_URL` and secrets from `backend/.env`, then runs `gcloud run deploy` with all env vars. Cloud Run connects directly to Supabase over the internet (no Cloud SQL proxy needed).
