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
│   │       ├── themes.py            # POST /api/themes/generate
│   │       └── planner.py           # POST /api/planner/generate
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

### Validators
- `GOOGLE_APPLICATION_CREDENTIALS` — if provided, verifies the file exists on disk. `None` is allowed (Cloud Run uses built-in SA identity).
- `DATABASE_URL` — must start with `postgresql+asyncpg://`, `postgresql://`, or `postgres://`.

---

## API Endpoints

### `POST /api/themes/generate`
**Router:** `app/api/routers/themes.py`

Generates AI-powered weekly theme options for an educator's classroom.

**Request:**
```json
{
  "user_id": "83b58b5f-698b-4ae1-9529-f83d97641f01",
  "theme_count": 5
}
```

**Flow:**
1. `fetch_student_context(user_id)` → queries enrolled students from DB
2. `generate_theme_options(student_context, count)` → calls Gemini with `ThemeSchema` structured output
3. Returns list of theme dicts

**Response:** Array of `ThemeSchema` objects (palette, circle time, activities, environment).

---

### `POST /api/planner/generate`
**Router:** `app/api/routers/planner.py`

Triggers the full multi-agent LangGraph pipeline.

**Request:**
```json
{
  "user_id": "83b58b5f-...",
  "selected_theme": { "name": "Fox Forest", ... },
  "week_number": 1,
  "week_range": "3/10 - 3/14"
}
```

**Flow:**
1. Compiles LangGraph via `build_planner_graph()`
2. Invokes with initial state
3. Pipeline: `fetch_context → architect → auditor → (revise loop) → personalizer → youtube_enricher → save`
4. Returns `personalized_plan` or falls back to `draft_plan`

**Response:**
```json
{
  "status": "success",
  "plan": { /* WeekPlanSchema */ }
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
