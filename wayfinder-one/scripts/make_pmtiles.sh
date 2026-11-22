#!/usr/bin/env bash
# Owner: P3. Builds the free regional map file used by the Live and Offline features.
# UNTESTED: written without network access. Verify against https://docs.protomaps.com (pmtiles CLI) before relying on it.
# Prereq: install the `pmtiles` CLI (go-pmtiles). Find the latest daily planet build URL in the Protomaps docs.
# Usage: PLANET_URL=<latest build .pmtiles URL> ./scripts/make_pmtiles.sh
set -euo pipefail
: "${PLANET_URL:?set PLANET_URL to the latest Protomaps build URL}"
OUT="frontend/public/maps/south-india.pmtiles"
mkdir -p "$(dirname "$OUT")"
# Bounding box (min_lon,min_lat,max_lon,max_lat) covering Kerala, Karnataka and Goa; adjust if you add destinations.
pmtiles extract "$PLANET_URL" "$OUT" --bbox=72.6,8.0,78.6,18.6 --maxzoom=12
ls -lh "$OUT"
echo "Attribution required in the UI: (c) OpenStreetMap contributors"
