#!/usr/bin/env bash
set -euo pipefail

# check_status.sh
# Prints available wave-related WMS layer options for the Cook Islands dataset (or a provided WMS URL).
#
# Usage:
#   ./check_status.sh                    # uses default Cook Islands WMS
#   WMS_URL=<custom_wms_url> ./check_status.sh
#   ./check_status.sh --all              # show all layer names and titles
#
# Notes:
# - Requires: curl
# - Optional: xmlstarlet or xmllint for robust parsing (falls back to awk/grep if not present)

DEFAULT_WMS="https://gemthreddshpc.spc.int/thredds/wms/POP/model/country/spc/forecast/hourly/COK/Rarotonga_UGRID.nc"
WMS_URL="${WMS_URL:-$DEFAULT_WMS}"
SHOW_ALL=false
if [[ "${1:-}" == "--all" ]]; then
  SHOW_ALL=true
fi

CAPS_URL="${WMS_URL}?service=WMS&request=GetCapabilities&version=1.3.0"
TMP_FILE=$(mktemp)
trap 'rm -f "$TMP_FILE"' EXIT

if ! command -v curl >/dev/null 2>&1; then
  echo "Error: curl is required" >&2
  exit 1
fi

# Fetch capabilities
curl -s "$CAPS_URL" > "$TMP_FILE"

extract_with_xmlstarlet() {
  xmlstarlet sel -t -m "//Layer[Name]" -v 'concat(Name,"|",Title)' -n < "$TMP_FILE"
}

extract_with_xmllint() {
  xmllint --format "$TMP_FILE" 2>/dev/null | \
    awk 'BEGIN{RS="<Layer"; FS="</Layer>"} NR>1 { \
      match($0, /<Name>([^<]+)<\/Name>/, n); \
      match($0, /<Title>([^<]+)<\/Title>/, t); \
      if (n[1] != "") {printf "%s|%s\n", n[1], t[1]} \
    }'
}

extract_with_awk() {
  tr -d '\n' < "$TMP_FILE" | sed 's#<Layer#\n<Layer#g' | \
    awk '{ \
      match($0, /<Name>([^<]+)<\/Name>/, n); \
      match($0, /<Title>([^<]+)<\/Title>/, t); \
      if (n[1] != "") {printf "%s|%s\n", n[1], t[1]} \
    }'
}

if command -v xmlstarlet >/dev/null 2>&1; then
  PAIRS=$(extract_with_xmlstarlet || true)
elif command -v xmllint >/dev/null 2>&1; then
  PAIRS=$(extract_with_xmllint || true)
else
  PAIRS=$(extract_with_awk || true)
fi

if [[ -z "${PAIRS:-}" ]]; then
  echo "No layers found (or parsing failed)." >&2
  exit 1
fi

# Wave-related variables of interest (include partitions p1..p6)
# This covers: hs, dirm, dirp, tm02, tpeak, dspr, fspr, transp_x/y, and partitioned hs/tp/dirp variables
# Override with: WAVE_KEYS='^...$' ./check_status.sh
WAVE_KEYS="${WAVE_KEYS:-^(hs|dirm|dirp|tm02|tpeak|dspr|fspr|transp_x|transp_y|hs_p[1-6]|tp_p[1-6]|dirp_p[1-6])$}"

if $SHOW_ALL; then
  echo "All Layer Names | Titles"
  echo "---------------------------------------"
  echo "$PAIRS" | sort -u
  exit 0
fi

echo "Wave-related layers found at:" 
echo "  $WMS_URL"

printf "\n%-12s | %s\n" "Name" "Title"
printf "%-12s-+-%s\n" "------------" "----------------------------------------------"

MATCHED=$(awk -F'|' -v R="$WAVE_KEYS" 'NF>=1 { if ($1 ~ R) print $0 }' <<< "$PAIRS" | sort -u || true)
if [[ -z "${MATCHED}" ]]; then
  echo "(No wave-related layers matched filter.)" >&2
  echo "Tip: run with --all to see every layer, or override filter via WAVE_KEYS env." >&2
else
  while IFS='|' read -r NAME TITLE; do
    [[ -z "${NAME:-}" ]] && continue
    printf "%-12s | %s\n" "$NAME" "${TITLE:-}"
  done <<< "$MATCHED"
fi

# Also print a minimal JSON array for programmatic use
JSON=$(echo "$MATCHED" | awk -F'|' '{printf "{\"name\":\"%s\",\"title\":\"%s\"},", $1, $2}' | sed 's/,$//')
echo
echo "As JSON:"
echo "[${JSON}]"
