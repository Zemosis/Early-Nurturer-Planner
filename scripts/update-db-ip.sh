#!/usr/bin/env bash
#
# Update Cloud SQL Authorized Network — Early Nurturer Planner
# -------------------------------------------------------------
# Fetches your current public IP and authorizes it on the
# nurture-postgres Cloud SQL instance. Clears any previously
# authorized networks first.
#
# Usage:
#   chmod +x scripts/update-db-ip.sh
#   ./scripts/update-db-ip.sh
#

set -euo pipefail

# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────
PROJECT_ID="early-nurturer-planner"
SQL_INSTANCE_NAME="nurture-postgres"

# ─────────────────────────────────────────────
# Helper functions
# ─────────────────────────────────────────────
info()  { echo -e "\033[1;34m[INFO]\033[0m  $*"; }
ok()    { echo -e "\033[1;32m[OK]\033[0m    $*"; }
warn()  { echo -e "\033[1;33m[WARN]\033[0m  $*"; }
err()   { echo -e "\033[1;31m[ERROR]\033[0m $*" >&2; }

# ─────────────────────────────────────────────
# Pre-flight checks
# ─────────────────────────────────────────────
for cmd in gcloud curl; do
  if ! command -v "$cmd" &>/dev/null; then
    err "'$cmd' is not installed. Please install it and retry."
    exit 1
  fi
done

ACTIVE_PROJECT=$(gcloud config get-value project 2>/dev/null || true)
if [[ "$ACTIVE_PROJECT" != "$PROJECT_ID" ]]; then
  err "Active gcloud project is '$ACTIVE_PROJECT', expected '$PROJECT_ID'."
  err "Run: gcloud config set project $PROJECT_ID"
  exit 1
fi

# ─────────────────────────────────────────────
# Step 1 — Detect current public IP
# ─────────────────────────────────────────────
info "Detecting your current public IP address..."

MY_IP=$(curl -s --max-time 5 https://checkip.amazonaws.com 2>/dev/null || true)
if [[ -z "$MY_IP" ]]; then
  MY_IP=$(curl -s --max-time 5 https://ifconfig.me 2>/dev/null || true)
fi
if [[ -z "$MY_IP" ]]; then
  MY_IP=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null || true)
fi

if [[ -z "$MY_IP" ]]; then
  err "Could not detect your public IP. Check your internet connection."
  exit 1
fi

ok "Public IP: $MY_IP"

# ─────────────────────────────────────────────
# Step 2 — Show current authorized networks
# ─────────────────────────────────────────────
info "Fetching current authorized networks for '$SQL_INSTANCE_NAME'..."

CURRENT_NETWORKS=$(gcloud sql instances describe "$SQL_INSTANCE_NAME" \
  --project="$PROJECT_ID" \
  --format="value(settings.ipConfiguration.authorizedNetworks[].value)" 2>/dev/null || true)

if [[ -n "$CURRENT_NETWORKS" ]]; then
  warn "Current authorized networks: $CURRENT_NETWORKS"
  info "These will be replaced with your new IP."
else
  info "No authorized networks currently set."
fi

# ─────────────────────────────────────────────
# Step 3 — Clear old & authorize new IP
# ─────────────────────────────────────────────
info "Clearing old authorized networks and adding $MY_IP/32 ..."

gcloud sql instances patch "$SQL_INSTANCE_NAME" \
  --project="$PROJECT_ID" \
  --clear-authorized-networks \
  --quiet 2>/dev/null

gcloud sql instances patch "$SQL_INSTANCE_NAME" \
  --project="$PROJECT_ID" \
  --authorized-networks="${MY_IP}/32" \
  --quiet

ok "Authorized network updated."

# ─────────────────────────────────────────────
# Step 4 — Verify
# ─────────────────────────────────────────────
info "Verifying update..."

UPDATED_NETWORKS=$(gcloud sql instances describe "$SQL_INSTANCE_NAME" \
  --project="$PROJECT_ID" \
  --format="value(settings.ipConfiguration.authorizedNetworks[].value)" 2>/dev/null || true)

SQL_PUBLIC_IP=$(gcloud sql instances describe "$SQL_INSTANCE_NAME" \
  --project="$PROJECT_ID" \
  --format="value(ipAddresses[0].ipAddress)" 2>/dev/null || echo "UNKNOWN")

echo ""
ok "╔═══════════════════════════════════════════════════════╗"
ok "║  Cloud SQL IP Authorization Updated                   ║"
ok "╠═══════════════════════════════════════════════════════╣"
ok "║  Instance:      $SQL_INSTANCE_NAME"
ok "║  Instance IP:   $SQL_PUBLIC_IP"
ok "║  Authorized:    ${UPDATED_NETWORKS:-NONE}"
ok "║  Your IP:       $MY_IP"
ok "╚═══════════════════════════════════════════════════════╝"
echo ""
info "You can now connect with:"
echo "  PGPASSWORD='<your-password>' psql -h $SQL_PUBLIC_IP -U postgres -d nurture_db"
echo ""
