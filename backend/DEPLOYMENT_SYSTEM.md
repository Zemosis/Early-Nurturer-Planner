# Deployment System - Complete Documentation

## Overview

The **Early Nurturer Planner Backend** is deployed to **Google Cloud Run** as a containerized FastAPI application. Cloud Run provides serverless auto-scaling, built-in HTTPS, and native integration with Cloud SQL via the Auth Proxy.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Google Cloud Run                     │
│                                                       │
│  ┌─────────────────────────────────────────────┐     │
│  │  Docker Container (python:3.12-slim)         │     │
│  │                                               │     │
│  │  uvicorn main:app --host 0.0.0.0 --port 8080│     │
│  │                                               │     │
│  │  FastAPI ← LangGraph ← Gemini (Vertex AI)   │     │
│  └──────────────┬────────────────────────────────┘     │
│                 │ Unix socket                          │
│  ┌──────────────▼────────────────────────┐            │
│  │  Cloud SQL Auth Proxy (auto-mounted)   │            │
│  │  /cloudsql/project:region:instance     │            │
│  └──────────────┬────────────────────────┘            │
└─────────────────┼─────────────────────────────────────┘
                  │
    ┌─────────────▼─────────────┐
    │  Cloud SQL (PostgreSQL)    │
    │  nurture-postgres          │
    │  nurture_db                │
    └───────────────────────────┘
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

**Key details:**
- Entry point is `main:app` (not `app.main:app`) — `main.py` lives at the backend root
- Port 8080 is Cloud Run's default
- No `.env` or SA key JSON inside the container (excluded by `.dockerignore`)

### `backend/.dockerignore`

```
__pycache__/
*.pyc
*.pyo
.env
venv/
.venv/
.git/
.gitignore
dev-log.md
scripts/
alembic/
*.json
```

**Excludes:** SA key JSON files, dev scripts, alembic migrations (run separately), dev log, virtual environments.

### `scripts/deploy-backend.sh`

One-command deployment script. Reads `YOUTUBE_API_KEY` from `backend/.env`, builds the Cloud SQL Unix socket `DATABASE_URL`, and runs `gcloud run deploy` with all env vars.

```bash
./scripts/deploy-backend.sh
```

---

## Environment Variables

### Local Development (`backend/.env`)

| Variable | Example Value |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:pass@34.69.136.252:5432/nurture_db` |
| `GCP_PROJECT_ID` | `early-nurturer-planner` |
| `GCS_BUCKET_NAME` | `early-nurturer-planner-assets` |
| `GOOGLE_APPLICATION_CREDENTIALS` | `/path/to/nurture-backend-sa-key-v2.json` |
| `VERTEX_AI_LOCATION` | `us-central1` |
| `YOUTUBE_API_KEY` | `AIzaSy...` |

### Cloud Run (set via `--set-env-vars`)

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:pass@/nurture_db?host=/cloudsql/project:region:instance` | Unix socket format |
| `GCP_PROJECT_ID` | `early-nurturer-planner` | |
| `VERTEX_AI_LOCATION` | `us-central1` | |
| `YOUTUBE_API_KEY` | `AIzaSy...` | |
| `GOOGLE_APPLICATION_CREDENTIALS` | *(not set)* | Cloud Run uses built-in SA identity |

### Frontend (`.env.production` at project root)

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://early-nurturer-api-872290613394.us-central1.run.app` |

---

## Database Connectivity

### Local → Cloud SQL
- Direct TCP to public IP: `34.69.136.252:5432`
- Requires IP whitelisting (use `scripts/update-db-ip.sh`)

### Cloud Run → Cloud SQL
- Unix socket via Cloud SQL Auth Proxy
- `--add-cloudsql-instances early-nurturer-planner:us-central1:nurture-postgres`
- Socket path: `/cloudsql/early-nurturer-planner:us-central1:nurture-postgres`
- No IP whitelisting needed

### DATABASE_URL Format Comparison

| Environment | Format |
|---|---|
| **Local** | `postgresql+asyncpg://user:pass@34.69.136.252:5432/nurture_db` |
| **Cloud Run** | `postgresql+asyncpg://user:pass@/nurture_db?host=/cloudsql/project:region:instance` |

---

## CORS Configuration (`main.py`)

```python
allow_origins=[
    "http://localhost:3000",     # Next.js
    "http://localhost:5173",     # Vite dev
    "http://localhost:5174",     # Vite alt port
    "https://early-nurturer-api-872290613394.us-central1.run.app",
]
```

When the frontend is deployed to its own domain (e.g. Vercel, Firebase Hosting), add that origin here and redeploy.

---

## Frontend API Integration (`src/app/utils/api.ts`)

The frontend uses a `VITE_API_BASE_URL` environment variable to switch between local and production:

```typescript
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
// Local dev: API_BASE = "" → /api/... → Vite proxy → localhost:8000
// Production: API_BASE = "https://...run.app" → direct to Cloud Run
```

- **Local dev:** `VITE_API_BASE_URL` is empty → requests go to `/api/...` → Vite proxy forwards to `localhost:8000`
- **Production build:** `npm run build` loads `.env.production` → requests go directly to Cloud Run URL

---

## Deploy Checklist

### First-Time Setup
1. ✅ Enable Cloud Run, Cloud Build, Cloud SQL APIs
2. ✅ Create Cloud SQL instance (`nurture-postgres`)
3. ✅ Grant Cloud Run SA → Cloud SQL Client role
4. ✅ Grant Cloud Run SA → Vertex AI User role
5. ✅ Run `alembic upgrade head` against the database
6. ✅ Run `python scripts/seed_db.py` for mock data

### Every Deploy
1. Make code changes
2. Run `./scripts/deploy-backend.sh` (or `gcloud run deploy ...`)
3. Verify at `https://early-nurturer-api-872290613394.us-central1.run.app/health`
4. Test `/docs` for Swagger UI

### After CORS Changes
- Must redeploy backend for new allowed origins to take effect

### After Schema Changes
- Run `alembic revision --autogenerate -m "description"` locally
- Run `alembic upgrade head` against Cloud SQL
- Redeploy backend

---

## Service Details

| Property | Value |
|---|---|
| **Service name** | `early-nurturer-api` |
| **URL** | `https://early-nurturer-api-872290613394.us-central1.run.app` |
| **Region** | `us-central1` |
| **Memory** | 1 GiB |
| **Timeout** | 300s (5 min, for long Gemini pipeline) |
| **Port** | 8080 |
| **Auth** | Unauthenticated (public) |
| **Cloud SQL instance** | `early-nurturer-planner:us-central1:nurture-postgres` |

---

## Troubleshooting

### `ConnectionRefusedError: [Errno 111]` or `TimeoutError`
**Cause:** Cloud Run trying to connect via direct IP instead of Unix socket.
**Fix:** Ensure `--add-cloudsql-instances` is in the deploy command and `DATABASE_URL` uses `?host=/cloudsql/...` format.

### `zsh: event not found: @/nurture_db`
**Cause:** The `!` in the DB password triggers zsh history expansion in double quotes.
**Fix:** Use single quotes around `--set-env-vars '...'` or use the deploy script.

### `GOOGLE_APPLICATION_CREDENTIALS` validation error
**Cause:** The env var points to a file that doesn't exist in the container.
**Fix:** Don't set this var on Cloud Run — the field is `str | None = None` (optional).

### CORS errors from frontend
**Cause:** Frontend origin not in `allow_origins` list in `main.py`.
**Fix:** Add the origin, redeploy backend.

### Gemini 400 INVALID_ARGUMENT
**Cause:** `response_schema` too complex (nested constraints).
**Fix:** Remove `ge`/`le`/`min_length` from deeply nested Pydantic models. Use `Field(description=...)` instead.
