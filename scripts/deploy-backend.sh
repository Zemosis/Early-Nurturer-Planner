#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# Deploy the FastAPI backend to Google Cloud Run.
#
# Usage:
#   ./scripts/deploy-backend.sh
#
# Prerequisites:
#   - gcloud CLI authenticated (gcloud auth login)
#   - Cloud SQL instance "nurture-postgres" exists in us-central1
# ──────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ────────────────────────────────────────────────────
PROJECT_ID="early-nurturer-planner"
REGION="us-central1"
SERVICE_NAME="early-nurturer-api"
CLOUD_SQL_INSTANCE="${PROJECT_ID}:${REGION}:nurture-postgres"

# ── Secrets (read from backend/.env if available) ─────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/../backend"
ENV_FILE="${BACKEND_DIR}/.env"

# Defaults (overridden by .env if present)
DB_USER="postgres"
DB_PASS="early-nurturer-planner1231!"
DB_NAME="nurture_db"
YOUTUBE_KEY=""

if [[ -f "$ENV_FILE" ]]; then
  # Extract YOUTUBE_API_KEY from .env (handles spaces around =)
  YOUTUBE_KEY=$(grep -E '^YOUTUBE_API_KEY' "$ENV_FILE" | sed 's/.*=\s*//' | tr -d '[:space:]') || true
fi

# Cloud Run connects to Cloud SQL via Unix socket
DATABASE_URL="postgresql+asyncpg://${DB_USER}:${DB_PASS}@/${DB_NAME}?host=/cloudsql/${CLOUD_SQL_INSTANCE}"

# ── Build env vars string ─────────────────────────────────────
ENV_VARS="DATABASE_URL=${DATABASE_URL}"
ENV_VARS+=",GCP_PROJECT_ID=${PROJECT_ID}"
ENV_VARS+=",VERTEX_AI_LOCATION=${REGION}"

if [[ -n "$YOUTUBE_KEY" ]]; then
  ENV_VARS+=",YOUTUBE_API_KEY=${YOUTUBE_KEY}"
fi

# ── Deploy ────────────────────────────────────────────────────
echo "🚀 Deploying ${SERVICE_NAME} to Cloud Run (${REGION})..."
echo "   Cloud SQL: ${CLOUD_SQL_INSTANCE}"
echo ""

gcloud run deploy "$SERVICE_NAME" \
  --source "$BACKEND_DIR" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --allow-unauthenticated \
  --add-cloudsql-instances "$CLOUD_SQL_INSTANCE" \
  --set-env-vars "$ENV_VARS" \
  --memory 1Gi \
  --timeout 300 \
  --port 8080

echo ""
echo "✅ Deployed! Service URL:"
gcloud run services describe "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --format='value(status.url)'
