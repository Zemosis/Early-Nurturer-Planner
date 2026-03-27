#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# Deploy the FastAPI backend to Google Cloud Run.
#
# Usage:
#   ./scripts/deploy-backend.sh
#
# Prerequisites:
#   - gcloud CLI authenticated (gcloud auth login)
# ──────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ────────────────────────────────────────────────────
PROJECT_ID="early-nurturer-planner"
REGION="us-central1"
SERVICE_NAME="early-nurturer-api"

# ── Secrets (read from backend/.env if available) ─────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/../backend"
ENV_FILE="${BACKEND_DIR}/.env"

# Defaults (overridden by .env if present)
DATABASE_URL=""
YOUTUBE_KEY=""
WORKER_API_KEY=""
CLOUD_RUN_URL=""

if [[ -f "$ENV_FILE" ]]; then
  # Extract secrets from .env (handles spaces around =)
  DATABASE_URL=$(grep -E '^DATABASE_URL' "$ENV_FILE" | sed 's/.*=\s*//' | tr -d '[:space:]') || true
  YOUTUBE_KEY=$(grep -E '^YOUTUBE_API_KEY' "$ENV_FILE" | sed 's/.*=\s*//' | tr -d '[:space:]') || true
  WORKER_API_KEY=$(grep -E '^WORKER_API_KEY' "$ENV_FILE" | sed 's/.*=\s*//' | tr -d '[:space:]') || true
  CLOUD_RUN_URL=$(grep -E '^CLOUD_RUN_URL' "$ENV_FILE" | sed 's/.*=\s*//' | tr -d '[:space:]') || true
fi

if [[ -z "$DATABASE_URL" ]]; then
  echo "❌ DATABASE_URL not set in ${ENV_FILE}"
  exit 1
fi

# ── Build env vars string ─────────────────────────────────────
ENV_VARS="DATABASE_URL=${DATABASE_URL}"
ENV_VARS+=",GCP_PROJECT_ID=${PROJECT_ID}"
ENV_VARS+=",VERTEX_AI_LOCATION=${REGION}"

if [[ -n "$YOUTUBE_KEY" ]]; then
  ENV_VARS+=",YOUTUBE_API_KEY=${YOUTUBE_KEY}"
fi

if [[ -n "$WORKER_API_KEY" ]]; then
  ENV_VARS+=",WORKER_API_KEY=${WORKER_API_KEY}"
fi

if [[ -n "$CLOUD_RUN_URL" ]]; then
  ENV_VARS+=",CLOUD_RUN_URL=${CLOUD_RUN_URL}"
fi

# ── Deploy ────────────────────────────────────────────────────
echo "🚀 Deploying ${SERVICE_NAME} to Cloud Run (${REGION})..."
echo ""

gcloud run deploy "$SERVICE_NAME" \
  --source "$BACKEND_DIR" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars "$ENV_VARS" \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --port 8080

echo ""
echo "✅ Deployed! Service URL:"
gcloud run services describe "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --format='value(status.url)'
