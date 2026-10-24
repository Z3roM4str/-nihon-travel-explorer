#!/usr/bin/env bash
#
# Builds app/public/geography/japan-prefectures.geojson from the official MLIT
# (国土交通省) "国土数値情報 行政区域データ" (N03) release.
#
# This script is the reproducible record of the transformation described in
# docs/GEOGRAPHY.md. It is a build-time tool only: mapshaper is fetched on demand
# with npx and never enters the application runtime or app/package.json.
#
# Usage:
#   scripts/build-geography.sh [work-dir]
#
# Requires: bash, curl, unzip, node/npx (network access to nlftp.mlit.go.jp).
set -euo pipefail

DATASET_DATE="20260101"
DATASET_YEAR="2026"
SOURCE_URL="https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-${DATASET_YEAR}/N03-${DATASET_DATE}_GML.zip"
MAPSHAPER_VERSION="0.6.109"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK_DIR="${1:-${TMPDIR:-/tmp}/nihon-geography}"
OUT_DIR="${REPO_ROOT}/app/public/geography"
OUT_FILE="${OUT_DIR}/japan-prefectures.geojson"

mkdir -p "$WORK_DIR" "$OUT_DIR"
cd "$WORK_DIR"

# 1. Fetch the official archive (~800 MB) unless it is already cached locally.
if [ ! -f "N03-${DATASET_DATE}_GML.zip" ]; then
  echo "Downloading ${SOURCE_URL}"
  curl -fSL -o "N03-${DATASET_DATE}_GML.zip" "$SOURCE_URL"
fi
sha256sum "N03-${DATASET_DATE}_GML.zip"

# 2. Extract only the nationwide municipal shapefile.
unzip -o -q "N03-${DATASET_DATE}_GML.zip" \
  "N03-${DATASET_DATE}.shp" "N03-${DATASET_DATE}.shx" \
  "N03-${DATASET_DATE}.dbf" "N03-${DATASET_DATE}.prj" "N03-${DATASET_DATE}.cpg"

# 3. Prefecture code (JIS X 0401, 2 digits) is the first two digits of the 5-digit
#    administrative-area code N03_007. Municipal boundaries are dissolved away so the
#    derived layer carries exactly one feature per prefecture.
npx --yes "mapshaper@${MAPSHAPER_VERSION}" \
  -i "N03-${DATASET_DATE}.shp" encoding=utf8 \
  -each 'code = N03_007.substring(0, 2), nameJa = N03_001' \
  -simplify percentage=1% keep-shapes \
  -dissolve2 code copy-fields=nameJa \
  -filter-islands min-area=1km2 \
  -filter-fields code,nameJa \
  -sort 'code' \
  -o "$OUT_FILE" format=geojson precision=0.0001 id-field=code

ls -l "$OUT_FILE"
echo "Wrote $OUT_FILE"
