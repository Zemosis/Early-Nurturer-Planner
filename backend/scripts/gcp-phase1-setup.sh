#!/usr/bin/env bash
#
# GCP Phase 1 Infrastructure Setup — Early Nurturer Planner
# ----------------------------------------------------------
# This script provisions the foundational GCP resources:
#   1. Enables required APIs
#   2. Provisions Cloud SQL (PostgreSQL) + nurture_db database
#   3. Creates a GCS bucket for PDFs/assets
#   4. Creates a service account with appropriate roles + JSON key
#
# Prerequisites:
#   - gcloud CLI installed and authenticated (`gcloud auth login`)
#   - Active project set to "early-nurturer-planner"
#   - Sufficient IAM permissions (Owner or Editor recommended)
#
# Usage:
#   chmod +x scripts/gcp-phase1-setup.sh
#   ./scripts/gcp-phase1-setup.sh
#

set -euo pipefail

# ─────────────────────────────────────────────
# Configuration — edit these if needed
# ─────────────────────────────────────────────
PROJECT_ID="early-nurturer-planner"
REGION="us-central1"
ZONE="us-central1-a"

# Cloud SQL
SQL_INSTANCE_NAME="nurture-postgres"
SQL_TIER="db-g1-small"           # Shared-core small — cheapest tier with pgvector support
SQL_DB_VERSION="POSTGRES_15"
SQL_DB_NAME="nurture_db"
SQL_ROOT_PASSWORD="earlynurturer123!"             # will be generated if left empty

# Cloud Storage
GCS_BUCKET_NAME="${PROJECT_ID}-assets"

# Service Account
SA_NAME="nurture-backend-sa"
SA_DISPLAY_NAME="Nurture Backend Service Account"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
SA_KEY_FILE="$(cd "$(dirname "$0")/.." && pwd)/nurture-backend-sa-key.json"

# ─────────────────────────────────────────────
# Helper functions
# ─────────────────────────────────────────────
info()  { echo -e "\n\033[1;34m[INFO]\033[0m  $*"; }
ok()    { echo -e "\033[1;32m[OK]\033[0m    $*"; }
warn()  { echo -e "\033[1;33m[WARN]\033[0m  $*"; }
err()   { echo -e "\033[1;31m[ERROR]\033[0m $*" >&2; }
divider() { echo -e "\n────────────────────────────────────────────────"; }

check_command() {
  if ! command -v "$1" &>/dev/null; then
    err "'$1' is not installed. Please install it and retry."
    exit 1
  fi
}

# ─────────────────────────────────────────────
# Pre-flight checks
# ─────────────────────────────────────────────
divider
info "Running pre-flight checks..."

check_command gcloud
check_command openssl
check_command psql
check_command curl

ACTIVE_PROJECT=$(gcloud config get-value project 2>/dev/null || true)
if [[ "$ACTIVE_PROJECT" != "$PROJECT_ID" ]]; then
  err "Active gcloud project is '$ACTIVE_PROJECT', expected '$PROJECT_ID'."
  err "Run: gcloud config set project $PROJECT_ID"
  exit 1
fi
ok "gcloud project verified: $PROJECT_ID"

ACTIVE_ACCOUNT=$(gcloud config get-value account 2>/dev/null || true)
if [[ -z "$ACTIVE_ACCOUNT" ]]; then
  err "No authenticated gcloud account found. Run: gcloud auth login"
  exit 1
fi
ok "Authenticated as: $ACTIVE_ACCOUNT"

# ═════════════════════════════════════════════
# STEP 1 — Enable Required APIs
# ═════════════════════════════════════════════
divider
info "STEP 1: Enabling required GCP APIs..."

APIS=(
  "compute.googleapis.com"
  "sqladmin.googleapis.com"
  "storage.googleapis.com"
  "aiplatform.googleapis.com"
)

for api in "${APIS[@]}"; do
  info "  Enabling $api ..."
  if gcloud services enable "$api" --project="$PROJECT_ID" 2>/dev/null; then
    ok "  $api enabled."
  else
    warn "  $api may already be enabled or requires billing. Check the console."
  fi
done

ok "All APIs processed."

# ═════════════════════════════════════════════
# STEP 2 — Provision Cloud SQL PostgreSQL
# ═════════════════════════════════════════════
divider
info "STEP 2: Provisioning Cloud SQL PostgreSQL instance..."

# Generate a strong random root password if not set
if [[ -z "$SQL_ROOT_PASSWORD" ]]; then
  SQL_ROOT_PASSWORD=$(openssl rand -base64 24)
  warn "Generated root (postgres) password. SAVE IT NOW — it will not be shown again:"
  echo ""
  echo "    ┌──────────────────────────────────────────────┐"
  echo "    │  postgres password: $SQL_ROOT_PASSWORD"
  echo "    └──────────────────────────────────────────────┘"
  echo ""
fi

# Check if instance already exists
if gcloud sql instances describe "$SQL_INSTANCE_NAME" --project="$PROJECT_ID" &>/dev/null; then
  warn "Cloud SQL instance '$SQL_INSTANCE_NAME' already exists. Skipping creation."
else
  info "  Creating instance '$SQL_INSTANCE_NAME' (tier: $SQL_TIER, version: $SQL_DB_VERSION)..."
  info "  This can take 5-10 minutes. Please wait..."

  # Try private IP first; fall back to public IP if VPC peering is not configured
  if gcloud sql instances create "$SQL_INSTANCE_NAME" \
    --project="$PROJECT_ID" \
    --database-version="$SQL_DB_VERSION" \
    --tier="$SQL_TIER" \
    --region="$REGION" \
    --root-password="$SQL_ROOT_PASSWORD" \
    --storage-type=HDD \
    --storage-size=10GB \
    --no-assign-ip \
    --network=default \
    --availability-type=zonal \
    --edition=enterprise 2>/dev/null; then
    ok "  Instance created with private IP."
  else
    warn "  Private IP creation failed (VPC peering likely not configured). Retrying with public IP..."
    gcloud sql instances create "$SQL_INSTANCE_NAME" \
      --project="$PROJECT_ID" \
      --database-version="$SQL_DB_VERSION" \
      --tier="$SQL_TIER" \
      --region="$REGION" \
      --root-password="$SQL_ROOT_PASSWORD" \
      --storage-type=HDD \
      --storage-size=10GB \
      --assign-ip \
      --availability-type=zonal \
      --edition=enterprise
    ok "  Instance created with public IP."
  fi

  ok "Cloud SQL instance '$SQL_INSTANCE_NAME' created."
fi

# Create the database
info "  Creating database '$SQL_DB_NAME'..."
if gcloud sql databases describe "$SQL_DB_NAME" --instance="$SQL_INSTANCE_NAME" --project="$PROJECT_ID" &>/dev/null; then
  warn "  Database '$SQL_DB_NAME' already exists. Skipping."
else
  gcloud sql databases create "$SQL_DB_NAME" \
    --instance="$SQL_INSTANCE_NAME" \
    --project="$PROJECT_ID"
  ok "  Database '$SQL_DB_NAME' created."
fi

# Enable the pgvector extension automatically
# Strategy: temporarily authorize our public IP, connect via psql, enable
# the extension, then revoke the temporary network access.
info "  Enabling pgvector extension on '$SQL_DB_NAME'..."

info "  Detecting your public IP address..."
MY_IP=$(curl -s --max-time 5 https://checkip.amazonaws.com 2>/dev/null || true)
if [[ -z "$MY_IP" ]]; then
  MY_IP=$(curl -s --max-time 5 https://ifconfig.me 2>/dev/null || true)
fi
if [[ -z "$MY_IP" ]]; then
  err "Could not detect public IP. Check your internet connection."
  err "You can enable pgvector manually later via: scripts/update-db-ip.sh + psql"
  exit 1
fi
ok "  Public IP detected: $MY_IP"

info "  Temporarily authorizing $MY_IP on Cloud SQL instance..."
gcloud sql instances patch "$SQL_INSTANCE_NAME" \
  --project="$PROJECT_ID" \
  --authorized-networks="${MY_IP}/32" \
  --quiet
ok "  IP authorized."

# Retrieve the instance public IP
SQL_PUBLIC_IP=$(gcloud sql instances describe "$SQL_INSTANCE_NAME" \
  --project="$PROJECT_ID" \
  --format="value(ipAddresses[0].ipAddress)")

info "  Connecting to ${SQL_PUBLIC_IP} via psql and enabling pgvector..."
PGPASSWORD="$SQL_ROOT_PASSWORD" psql \
  --host="$SQL_PUBLIC_IP" \
  --port=5432 \
  --username=postgres \
  --dbname="$SQL_DB_NAME" \
  --command="CREATE EXTENSION IF NOT EXISTS vector;"
ok "  pgvector extension enabled on '$SQL_DB_NAME'."

# Revoke the temporary network authorization
info "  Revoking temporary IP authorization..."
gcloud sql instances patch "$SQL_INSTANCE_NAME" \
  --project="$PROJECT_ID" \
  --clear-authorized-networks \
  --quiet
ok "  Temporary IP authorization removed."

ok "Cloud SQL setup complete (with pgvector)."

# Print connection info for reference
SQL_CONNECTION_NAME=$(gcloud sql instances describe "$SQL_INSTANCE_NAME" \
  --project="$PROJECT_ID" \
  --format="value(connectionName)" 2>/dev/null || echo "UNKNOWN")

echo ""
info "╔══════════════════════════════════════════════════════════════════╗"
info "║  Cloud SQL Connection Info                                      ║"
info "╠══════════════════════════════════════════════════════════════════╣"
info "║  Instance:   $SQL_INSTANCE_NAME"
info "║  Public IP:  $SQL_PUBLIC_IP"
info "║  Connection: $SQL_CONNECTION_NAME"
info "║  Database:   $SQL_DB_NAME"
info "║  User:       postgres"
info "║  pgvector:   ENABLED"
info "╚══════════════════════════════════════════════════════════════════╝"
echo ""
info "To connect manually in the future:"
echo "  1. Authorize your IP:  ./scripts/update-db-ip.sh"
echo "  2. Connect:            PGPASSWORD='<password>' psql -h $SQL_PUBLIC_IP -U postgres -d $SQL_DB_NAME"

# ═════════════════════════════════════════════
# STEP 3 — Create Cloud Storage Bucket
# ═════════════════════════════════════════════
divider
info "STEP 3: Creating Cloud Storage bucket..."

if gcloud storage buckets describe "gs://${GCS_BUCKET_NAME}" --project="$PROJECT_ID" &>/dev/null; then
  warn "Bucket 'gs://${GCS_BUCKET_NAME}' already exists. Skipping."
else
  gcloud storage buckets create "gs://${GCS_BUCKET_NAME}" \
    --project="$PROJECT_ID" \
    --location="$REGION" \
    --default-storage-class=STANDARD \
    --uniform-bucket-level-access \
    --public-access-prevention
  ok "Bucket 'gs://${GCS_BUCKET_NAME}' created."
fi

# Apply lifecycle rule: auto-delete objects older than 365 days (cost control)
info "  Applying lifecycle rule (auto-delete after 365 days)..."
LIFECYCLE_TEMP=$(mktemp)
cat > "$LIFECYCLE_TEMP" <<'EOF'
{
  "rule": [
    {
      "action": { "type": "Delete" },
      "condition": { "age": 365 }
    }
  ]
}
EOF
gcloud storage buckets update "gs://${GCS_BUCKET_NAME}" \
  --lifecycle-file="$LIFECYCLE_TEMP" \
  --project="$PROJECT_ID" 2>/dev/null && ok "  Lifecycle rule applied." || warn "  Lifecycle rule may already be set."
rm -f "$LIFECYCLE_TEMP"

ok "Cloud Storage setup complete: gs://${GCS_BUCKET_NAME}"

# ═════════════════════════════════════════════
# STEP 4 — Create Service Account + Roles + Key
# ═════════════════════════════════════════════
divider
info "STEP 4: Creating service account and assigning roles..."

# Create the service account
if gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" &>/dev/null; then
  warn "Service account '$SA_EMAIL' already exists. Skipping creation."
else
  gcloud iam service-accounts create "$SA_NAME" \
    --project="$PROJECT_ID" \
    --display-name="$SA_DISPLAY_NAME" \
    --description="Backend service account for Early Nurturer Planner"
  ok "Service account created: $SA_EMAIL"
fi

# Assign roles
ROLES=(
  "roles/aiplatform.user"           # Vertex AI User
  "roles/storage.objectAdmin"       # Storage Object Admin
)

for role in "${ROLES[@]}"; do
  info "  Binding role $role ..."
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$role" \
    --condition=None \
    --quiet 2>/dev/null
  ok "  Bound $role"
done

# Generate JSON key
info "  Generating JSON key file..."
if [[ -f "$SA_KEY_FILE" ]]; then
  warn "  Key file already exists at: $SA_KEY_FILE"
  warn "  Skipping key generation to avoid creating duplicate keys."
  warn "  Delete the existing file and re-run if you need a new key."
else
  gcloud iam service-accounts keys create "$SA_KEY_FILE" \
    --iam-account="$SA_EMAIL" \
    --project="$PROJECT_ID"
  ok "  Key file saved to: $SA_KEY_FILE"
fi

echo ""
warn "╔══════════════════════════════════════════════════════════════════════╗"
warn "║  ⚠  SECURITY WARNING                                               ║"
warn "║                                                                     ║"
warn "║  The service account key file contains sensitive credentials:        ║"
warn "║    $SA_KEY_FILE"
warn "║                                                                     ║"
warn "║  • NEVER commit this file to version control.                       ║"
warn "║  • Ensure it is listed in your .gitignore file.                     ║"
warn "║  • Store it securely and restrict file permissions.                  ║"
warn "╚══════════════════════════════════════════════════════════════════════╝"

# Restrict file permissions
if [[ -f "$SA_KEY_FILE" ]]; then
  chmod 600 "$SA_KEY_FILE"
  ok "  Key file permissions set to 600 (owner read/write only)."
fi

# ═════════════════════════════════════════════
# Summary
# ═════════════════════════════════════════════
divider
echo ""
info "╔══════════════════════════════════════════════════════════════════════╗"
info "║  🎉  Phase 1 Infrastructure Setup Complete                          ║"
info "╠══════════════════════════════════════════════════════════════════════╣"
info "║                                                                     ║"
info "║  APIs Enabled:                                                      ║"
info "║    • compute.googleapis.com                                         ║"
info "║    • sqladmin.googleapis.com                                        ║"
info "║    • storage.googleapis.com                                         ║"
info "║    • aiplatform.googleapis.com                                      ║"
info "║                                                                     ║"
info "║  Cloud SQL:                                                         ║"
info "║    • Instance:  $SQL_INSTANCE_NAME"
info "║    • Database:  $SQL_DB_NAME"
info "║    • Tier:      $SQL_TIER"
info "║                                                                     ║"
info "║  Cloud Storage:                                                     ║"
info "║    • Bucket:    gs://${GCS_BUCKET_NAME}"
info "║                                                                     ║"
info "║  Service Account:                                                   ║"
info "║    • Email:     $SA_EMAIL"
info "║    • Key:       $SA_KEY_FILE"
info "║    • Roles:     Vertex AI User, Storage Object Admin                ║"
info "║                                                                     ║"
info "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
info "Next steps:"
echo "  1. Add the SQL connection string to your backend .env file."
echo "  2. Set GOOGLE_APPLICATION_CREDENTIALS=$SA_KEY_FILE in your environment."
echo "  3. Verify .gitignore includes the key file pattern."
echo ""
