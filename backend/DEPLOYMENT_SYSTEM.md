# Deployment System

## Overview

The **Early Nurturer Planner Backend** is deployed to **Google Cloud Run** as a containerized FastAPI application. The database is hosted on **Supabase** (PostgreSQL), connected via direct TCP.

---

## Architecture

```
+-------------------------------------------------------+
|                  Google Cloud Run                       |
|                                                         |
|  +-----------------------------------------------+     |
|  |  Docker Container (python:3.12-slim)           |     |
|  |                                                 |     |
|  |  uvicorn main:app --host 0.0.0.0 --port 8080  |     |
|  |                                                 |     |
|  |  FastAPI <-- LangGraph <-- Gemini (Vertex AI)  |     |
|  +--------------------+----------------------------+     |
|                       |                                  |
+-------------------------------------------------------+
                        | Direct TCP (port 5432)
          +-------------v-----------------+
          |  Supabase (PostgreSQL)         |
          |  db.xxx.supabase.co            |
          +-------------------------------+
```

---

## Files

### `backend/Dockerfile`

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

- Entry point is `main:app` (not `app.main:app`) -- `main.py` lives at the backend root
- Port 8080 is Cloud Run's default
- No `.env` or SA key JSON inside the container (excluded by `.dockerignore`)

### `backend/.dockerignore`

Excludes: SA key JSON files, dev scripts, alembic migrations, dev log, virtual environments.

### `scripts/deploy-backend.sh`

One-command deployment. Reads `DATABASE_URL` and secrets from `backend/.env` and runs `gcloud run deploy` with all env vars.

```bash
./scripts/deploy-backend.sh
```

---

## Environment Variables

### Local Development (`backend/.env`)

| Variable | Example Value |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:pass@db.xxx.supabase.co:5432/postgres` |
| `GCP_PROJECT_ID` | `early-nurturer-planner` |
| `GCS_BUCKET_NAME` | `early-nurturer-planner-assets` |
| `GOOGLE_APPLICATION_CREDENTIALS` | `/path/to/sa-key.json` |
| `VERTEX_AI_LOCATION` | `us-central1` |
| `YOUTUBE_API_KEY` | `AIzaSy...` |

### Cloud Run (set via `--set-env-vars`)

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:pass@db.xxx.supabase.co:5432/postgres` | Same Supabase URL |
| `GCP_PROJECT_ID` | `early-nurturer-planner` | |
| `VERTEX_AI_LOCATION` | `us-central1` | |
| `YOUTUBE_API_KEY` | `AIzaSy...` | |
| `WORKER_API_KEY` | `shared-secret` | Internal worker auth |
| `CLOUD_TASKS_QUEUE` | `theme-generation` | Queue name |
| `CLOUD_RUN_URL` | `https://...run.app` | Service URL for task callbacks |
| `GOOGLE_APPLICATION_CREDENTIALS` | *(not set)* | Cloud Run uses built-in SA identity |

### Frontend (`.env.production` at project root)

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://early-nurturer-api-872290613394.us-central1.run.app` |

---

## Database Connectivity

Both local development and Cloud Run connect to Supabase via direct TCP. No Cloud SQL proxy or Unix sockets needed.

| Environment | DATABASE_URL Format |
|---|---|
| **Local** | `postgresql+asyncpg://postgres:pass@db.xxx.supabase.co:5432/postgres` |
| **Cloud Run** | Same as local (direct TCP to Supabase) |

---

## CORS Configuration (`main.py`)

```python
allow_origins=[
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "https://early-nurturer-planner.web.app",
    "https://early-nurturer-api-872290613394.us-central1.run.app",
]
```

Add new frontend origins here and redeploy.

---

## Frontend API Integration (`src/app/utils/api.ts`)

```typescript
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
// Local dev: "" -> /api/... -> Vite proxy -> localhost:8000
// Production: "https://...run.app" -> direct to Cloud Run
```

---

## Deploy Checklist

### First-Time Setup
1. Enable Cloud Run, Cloud Build, and Cloud Tasks APIs
2. Create Supabase project and enable pgvector extension
3. Create Cloud Tasks queue:
   ```bash
   gcloud tasks queues create theme-generation \
     --location=us-central1 \
     --max-dispatches-per-second=2 \
     --max-concurrent-dispatches=1 \
     --max-attempts=3 \
     --min-backoff=10s
   ```
4. Grant Cloud Run SA: Vertex AI User, Cloud Tasks Enqueuer roles
5. Run `alembic upgrade head` against Supabase
6. Run `python scripts/seed_db.py` and `python scripts/seed_yoga_catalog.py`

### Every Deploy
1. Make code changes
2. Run `./scripts/deploy-backend.sh`
3. Verify at `https://early-nurturer-api-872290613394.us-central1.run.app/health`
4. Test `/docs` for Swagger UI

### After Schema Changes
- Run `alembic revision --autogenerate -m "description"` locally
- Run `alembic upgrade head` against Supabase
- Redeploy backend

---

## Service Details

| Property | Value |
|---|---|
| **Service name** | `early-nurturer-api` |
| **URL** | `https://early-nurturer-api-872290613394.us-central1.run.app` |
| **Region** | `us-central1` |
| **Memory** | 2 GiB |
| **CPU** | 2 vCPU |
| **Min instances** | 1 (always warm) |
| **CPU throttling** | Disabled (always allocated) |
| **Timeout** | 300s |
| **Port** | 8080 |
| **Auth** | Unauthenticated (public) |

---

## Troubleshooting

### `GOOGLE_APPLICATION_CREDENTIALS` validation error
**Cause:** Env var points to a file that doesn't exist in the container.
**Fix:** Don't set this var on Cloud Run -- it uses built-in SA identity.

### CORS errors from frontend
**Cause:** Frontend origin not in `allow_origins` list in `main.py`.
**Fix:** Add the origin, redeploy backend.

### Gemini 400 INVALID_ARGUMENT
**Cause:** `response_schema` too complex (nested constraints).
**Fix:** Remove `ge`/`le`/`min_length` from deeply nested Pydantic models. Use `Field(description=...)` instead.

### Database connection timeout
**Cause:** Supabase may pause inactive free-tier projects.
**Fix:** Resume the project in Supabase dashboard, or check connection string.
