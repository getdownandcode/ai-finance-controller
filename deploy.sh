#!/usr/bin/env bash
# ==============================================================================
# Google Cloud Run Deployment Script for AI Finance Controller
# ==============================================================================
set -e

# Configuration (edit or override via environment variables)
PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || echo '')}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-ai-finance-controller}"

echo "============================================================"
echo "   AI Finance Controller — Cloud Run Deployment"
echo "============================================================"

if [ -z "$PROJECT_ID" ]; then
  echo "Error: GCP Project ID not found."
  echo "Please run: gcloud config set project YOUR_PROJECT_ID"
  echo "Or set: export GCP_PROJECT_ID=YOUR_PROJECT_ID"
  exit 1
fi

echo "Project ID  : $PROJECT_ID"
echo "Region      : $REGION"
echo "Service Name: $SERVICE_NAME"
echo "============================================================"

# Read GEMINI_API_KEY from .env if present
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo "Submitting build to Google Cloud Build & deploying to Cloud Run..."

gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=${GEMINI_API_KEY:-},RECON_LLM_MODEL=gemini-2.5-flash" \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5

echo ""
echo "Deployment Complete! Service is live on Google Cloud Run."
