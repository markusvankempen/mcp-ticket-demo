#!/usr/bin/env bash
# Build linux/amd64, push to ICR (ca-tor), create or update the Code Engine app.
# Needs: working podman machine, ibmcloud logged in with cr + ce plugins.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ID="7e131e87-e967-4e7f-a2f1-480957244eac"
APP="mcp-ticket-demo"
NS="ce--5d0be-29m5mrru3s3n"
IMAGE="ca.icr.io/${NS}/${APP}:latest"
SECRET="ce-auto-icr-private-ca-tor"

if ! podman info >/dev/null 2>&1; then
  echo "Starting podman machine..."
  podman machine start
  sleep 3
fi

podman build --platform linux/amd64 -t "$IMAGE" "$ROOT"
ibmcloud cr login --client podman
podman push "$IMAGE"

ibmcloud ce project select --id "$PROJECT_ID"
if ibmcloud ce app get --name "$APP" >/dev/null 2>&1; then
  ibmcloud ce app update --name "$APP" --image "$IMAGE" --registry-secret "$SECRET"
else
  ibmcloud ce app create --name "$APP" \
    --image "$IMAGE" \
    --registry-secret "$SECRET" \
    --port 8080 \
    --min-scale 1 --max-scale 2 \
    --env MCP_MODE=http \
    --env PORT=8080 \
    --env ADMIN_USER="${ADMIN_USER:-demo}" \
    --env ADMIN_PASSWORD="${ADMIN_PASSWORD:-demo}" \
    --env DEMO_TOKEN="${DEMO_TOKEN:-demo-token}" \
    --env AUTH_MODE="${AUTH_MODE:-write}" \
    --env RATE_LIMIT="${RATE_LIMIT:-60}"
fi

# A public URL should not accept anonymous writes, so AUTH_MODE defaults to write here
# even though the laptop default is off. Set ADMIN_PASSWORD before you share the URL.

ibmcloud ce app get --name "$APP" --output url
