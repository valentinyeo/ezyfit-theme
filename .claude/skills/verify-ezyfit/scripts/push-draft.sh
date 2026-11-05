#!/bin/bash
# Push named theme files to the EZYFIT draft theme ONLY.
# Usage: .claude/skills/verify-ezyfit/scripts/push-draft.sh sections/ezy-product.liquid assets/ezy.css ...
# Refuses the live ClickShades theme. Token is read from the ClickShades CLAUDE.md into memory, never printed.
set -euo pipefail
DRAFT=158148984988
LIVE=149894070428
THEME="${EZY_THEME:-$DRAFT}"
if [ "$THEME" = "$LIVE" ]; then echo "Refusing: $LIVE is the live ClickShades theme." >&2; exit 2; fi
if [ "$#" -eq 0 ]; then echo "Name the files to push." >&2; exit 2; fi
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
export SHOPIFY_CLI_THEME_TOKEN
SHOPIFY_CLI_THEME_TOKEN=$(grep -oE 'shptka_[a-f0-9]+' "$HOME/projects/clickshades-theme/CLAUDE.md" | head -1)
args=()
for f in "$@"; do args+=(--only "$f"); done
"$HOME/.npm-global/bin/shopify" theme push --store easy-fit-store1.myshopify.com --password "$SHOPIFY_CLI_THEME_TOKEN" --theme "$THEME" "${args[@]}" --json 2>&1 \
  | python3 -c 'import sys,json; t=sys.stdin.read(); i=t.rfind("\n{\n"); d=json.loads(t[i+1:]) if i>=0 else {}; print(d.get("status","unknown"), d.get("theme",{}).get("role",""), "issues:", len(d.get("issues",[])) if d else "?"); sys.exit(0 if d.get("status")=="success" and d.get("theme",{}).get("role")=="unpublished" else 1)'
