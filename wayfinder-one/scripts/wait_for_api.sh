#!/usr/bin/env bash
# Wait until the Wayfinder API /health endpoint returns HTTP 200 (Owner: P3).
set -euo pipefail

URL="${1:-http://localhost:8000/api/v1/health}"
MAX_WAIT="${MAX_WAIT_SEC:-60}"
elapsed=0

echo "Waiting for API at ${URL}..."
while [ "$elapsed" -lt "$MAX_WAIT" ]; do
  if curl -sf "$URL" >/dev/null 2>&1; then
    echo "API ready at ${URL} (${elapsed}s)."
    exit 0
  fi
  sleep 2
  elapsed=$((elapsed + 2))
done

echo "Timed out after ${MAX_WAIT}s waiting for ${URL}" >&2
exit 1
