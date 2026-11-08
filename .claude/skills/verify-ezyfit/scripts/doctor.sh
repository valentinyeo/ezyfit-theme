#!/bin/bash
# Read-only, plain HTTP, safe on the VPS: is this theme worth checking? One line per check, exit 1 on any FAIL.
# Usage: .claude/skills/verify-ezyfit/scripts/doctor.sh [themeId]   (default: draft; QA id is in SKILL.md)
set -uo pipefail
THEME="${1:-158148984988}"
STORE=https://easy-fit-store1.myshopify.com
JAR=$(mktemp); HTML=$(mktemp)
trap 'rm -f "$JAR" "$HTML"' EXIT
rc=0
line() { if [ "$1" = 1 ]; then echo "OK   $2"; else echo "FAIL $2"; rc=1; fi; }

# The first request sets the preview cookie and may redirect; the second one is the real page.
curl -sL -m 60 -c "$JAR" -b "$JAR" "$STORE/?preview_theme_id=$THEME" -o /dev/null
code=$(curl -sL -m 60 -c "$JAR" -b "$JAR" "$STORE/?preview_theme_id=$THEME" -o "$HTML" -w '%{http_code}')
line "$([ "$code" = 200 ] && echo 1 || echo 0)" "store answers: HTTP $code"
info=$(grep -oE 'Shopify\.theme = \{[^;]*' "$HTML" | head -1)
id=$(echo "$info" | grep -oE '"id":[0-9]+' | cut -d: -f2)
role=$(echo "$info" | grep -oE '"role":"[a-z]+"' | cut -d'"' -f4)
line "$([ "$id" = "$THEME" ] && echo 1 || echo 0)" "requested theme served: Shopify.theme.id=$id"
line "$([ "$role" = unpublished ] && echo 1 || echo 0)" "theme is not the live one: role=$role"
line "$(grep -q 'ezy-head' "$HTML" && echo 1 || echo 0)" "EZYFIT header present"
cart=$(curl -sL -m 30 -c "$JAR" -b "$JAR" -o /dev/null -w '%{http_code}' "$STORE/cart.js")
line "$([ "$cart" = 200 ] && echo 1 || echo 0)" "cart API answers: HTTP $cart"

if command -v gh >/dev/null 2>&1; then
  sha=$(git rev-parse HEAD 2>/dev/null || true)
  if [ -n "$sha" ]; then
    run=$(gh run list --workflow gates.yml --branch main --commit "$sha" --limit 1 --json status,conclusion,url --jq '.[0] | "\(.status)/\(.conclusion) \(.url)"' 2>/dev/null || true)
    echo "INFO gates.yml for HEAD ${sha:0:8}: ${run:-no run yet}"
  fi
fi
exit $rc
