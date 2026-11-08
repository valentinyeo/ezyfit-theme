#!/bin/bash
# Promote the current git HEAD to the EZYFIT QA theme (unpublished). QA only: refuses the live and draft ids.
# Refuses unless the latest gates.yml run on main for HEAD finished with success on GitHub.
# Pushes a clean export of HEAD (git archive), so other sessions' uncommitted edits never reach QA.
# Usage: .claude/skills/verify-ezyfit/scripts/promote-qa.sh
set -euo pipefail
QA=158330912924
LIVE=149894070428
DRAFT=158148984988
STORE=easy-fit-store1.myshopify.com
[ "$QA" != "$LIVE" ] && [ "$QA" != "$DRAFT" ] || { echo "QA id misconfigured." >&2; exit 2; }

cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
git fetch -q origin main
SHA=$(git rev-parse HEAD)
if ! git merge-base --is-ancestor "$SHA" origin/main; then
  echo "Refusing: HEAD $SHA is not on origin/main. Push it, let gates.yml run, retry." >&2; exit 1
fi

row=$(gh run list --workflow gates.yml --branch main --commit "$SHA" --limit 20 --json databaseId,status,conclusion,event,url,createdAt \
  --jq 'sort_by(.createdAt) | reverse | .[0] // empty | [.databaseId, .status, .conclusion, .url] | @tsv')
if [ -z "$row" ]; then echo "Refusing: no gates.yml run for $SHA yet." >&2; exit 1; fi
IFS=$'\t' read -r RUN_ID RUN_STATUS RUN_CONCLUSION RUN_URL <<<"$row"
if [ "$RUN_STATUS" != "completed" ] || [ "$RUN_CONCLUSION" != "success" ]; then
  echo "Refusing: latest gates.yml run for $SHA is $RUN_STATUS/$RUN_CONCLUSION: $RUN_URL" >&2; exit 1
fi
echo "Gates green for $SHA: $RUN_URL"

SRC=$(mktemp -d)
trap 'rm -rf "$SRC"' EXIT
git archive "$SHA" | tar -x -C "$SRC"

export SHOPIFY_CLI_THEME_TOKEN
SHOPIFY_CLI_THEME_TOKEN=$(grep -oE 'shptka_[a-f0-9]+' "$HOME/projects/clickshades-theme/CLAUDE.md" | head -1)
OUT=$(mktemp)
( cd "$SRC" && "$HOME/.npm-global/bin/shopify" theme push --store "$STORE" --password "$SHOPIFY_CLI_THEME_TOKEN" --theme "$QA" --json >"$OUT" 2>&1 ) || true
python3 - "$OUT" "$QA" <<'PY'
import sys, json
t = open(sys.argv[1]).read()
i = t.rfind("\n{\n")
d = json.loads(t[i + 1:]) if i >= 0 else {}
th = d.get("theme", {})
ok = d.get("status") == "success" and th.get("role") == "unpublished" and str(th.get("id")) == sys.argv[2]
print(d.get("status", "unknown"), th.get("role", ""), th.get("id", ""), "issues:", len(d.get("issues", [])))
sys.exit(0 if ok else 1)
PY
rm -f "$OUT"
echo "QA theme $QA now holds $SHA"
echo "QA preview: https://clickshades.com.au/?preview_theme_id=$QA"
