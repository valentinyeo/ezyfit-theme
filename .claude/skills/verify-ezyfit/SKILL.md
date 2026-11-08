---
name: verify-ezyfit
description: Prove the EZYFIT Version B Shopify theme works the way a shopper uses it. Use after any change to this repo, before saying a theme change is done, before promoting to the QA theme, or when the draft or QA theme looks off. The theme only runs on Shopify, so you push files to the unpublished draft theme, then the browser checks (phone and desktop Chromium, header, cart, wiper product, collection, search, footer, shade page parity) run on GitHub Actions, never on this server.
---

# Verify the EZYFIT theme

Surface: the real storefront at `easy-fit-store1.myshopify.com`, opened with `?preview_theme_id=<id>`. There is no local server. "Launch" is pushing files to a theme. "Drive" is a GitHub Actions run.

## Hard rules

- No CI, builds, tests or browsers on this server (house rule, 2026-11-08). Playwright and Chromium run only on GitHub-hosted runners through `gates.yml` and `shot.yml`. Small paid minutes on this private repo are fine. On this server you may push, fetch over plain HTTP, call `gh`, and read artifacts.
- Never push to or publish theme `149894070428`. It is the live ClickShades shop. Every script refuses it, and the workflows refuse it as a `theme_id`.
- Never publish the draft or QA theme. Publishing is the owner's call.
- Never change store data (products, prices, metafields) to make a check pass. A failing gate is reported, not weakened.
- Never print or commit the theme token. Scripts read it from `~/projects/clickshades-theme/CLAUDE.md` into memory.

## Themes

| Theme | Id | Role | Who writes to it |
|---|---|---|---|
| EZYFIT Version B draft | `158148984988` | unpublished | Builders, with `push-draft.sh`, per changed file |
| EZYFIT QA | `158330912924` | unpublished | Only `promote-qa.sh`, a full clean copy of a green `main` HEAD |
| ClickShades live | `149894070428` | live | Nobody here. Never touch |

Preview URLs: draft `https://clickshades.com.au/?preview_theme_id=158148984988`, QA `https://clickshades.com.au/?preview_theme_id=158330912924`. Give the QA link when a human should look at a verified build.

## The flow

1. Edit theme files, commit, `git pull --rebase`, `git push origin main`.
2. Launch: `push-draft.sh <changed files>` pushes them to the draft.
3. Doctor: `doctor.sh`.
4. Drive: `gh workflow run gates.yml -f theme_id=158148984988` (a push to `main` also starts it, against the draft). Wait with `gh run watch <id> --interval 300`. Never poll faster than 5 minutes.
5. Evidence: read the log, download the screenshots.
6. Promote: when the run for your HEAD is green, `promote-qa.sh` copies HEAD to the QA theme.

Gates read what is on the draft, not your commit. If you pushed files to the draft and then changed them again, push again before the run, or the green run proves the old files.

## Launch

```bash
.claude/skills/verify-ezyfit/scripts/push-draft.sh sections/ezy-product.liquid assets/ezy.css
```

Paths are relative to the repo root. Ready means the script prints `success unpublished issues: 0` and exits 0. Wait about 5 seconds for Shopify's cache. It needs network outside the Claude Code sandbox. `EZY_THEME` overrides the target but the live id is refused.

## Doctor

Read-only, plain HTTP, safe here. Run it first and whenever results look strange:

```bash
.claude/skills/verify-ezyfit/scripts/doctor.sh            # draft
.claude/skills/verify-ezyfit/scripts/doctor.sh 158330912924   # QA
```

Every line must say `OK`: store answers, the requested theme id is served, its role is `unpublished`, the EZYFIT header is in the page, `/cart.js` answers. The last `INFO` line shows the `gates.yml` state for your HEAD. It uses a cookie jar because the first preview request redirects and only sets the cookie.

## Drive (GitHub Actions only)

```bash
gh workflow run gates.yml -f theme_id=158148984988
gh run list --workflow gates.yml --limit 3
gh run watch <run id> --interval 300 --exit-status
```

`gates.yml` runs on `ubuntu-latest` with Node 22, installs Playwright and Chromium, then runs every `.claude/skills/verify-ezyfit/scripts/gates*.mjs` in turn with the theme id as the first argument. It keeps going after a failing file and fails the job at the end if any file failed. It runs on `workflow_dispatch` and on every push to `main`. A run of `gates.mjs` alone took 1m42s (2 billable minutes); the job times out at 20 minutes and a newer run of the same theme cancels an older one.

Each gates file prints one `PASS` or `FAIL` line per gate with the observed value, ends with `N/M gates pass`, and exits 1 on any failure. Read the whole log, not just the job colour:

```bash
gh run view <run id> --log | grep -E "PASS|FAIL|gates pass"
```

Gate files, one per area. Add a new area as a new `gates-<area>.mjs`; the workflow picks it up with no edit. Copy the header of `gates.mjs` (theme id from `argv[2]`, `require('playwright')` with no path, evidence under `_preview/evidence/<timestamp>/`, `process.exitCode` set).

| File | Area | Gate ids |
|---|---|---|
| `gates.mjs` | Header, cart, wiper product, collection, search, footer, homepage finder, shade page keeps old design | G0 to G18 |
| `gates-cro.mjs` | Conversion and CRO checks, written by the CRO agent | see file header |
| `gates-shade.mjs` | ClickShades shade page parity, written by the shade agent | see file header |

One page as a picture, on GitHub:

```bash
gh workflow run shot.yml -f path=/products/front-windscreen-wipers-for-toyota-hilux-2018 -f width=390 -f theme_id=158148984988
gh run download <run id> -n shot-<run id> -D /tmp/shot
```

Then view `/tmp/shot/shot.png`. Widths: 390 phone, 1280 desktop.

Stable handles the gates use (keep them when editing sections): `[data-ezy-head]`, `[data-ezy-menu]`, `[data-ezy-drawer]`, `[data-ezy-search]`, `[data-cart-count]`, `[data-ezy-pdp]`, `[data-ezy-type]`, `[data-ezy-position]`, `[data-ezy-year]`, `[data-ezy-fit-video]`, `[data-ezy-add]`, `[data-ezy-coll-q]`, `[data-ezy-finder]`, `[data-ezy-dd]`, `.ezy-coll__item`, `.ezy-coll__card`.

The feature map in [features/README.md](features/README.md) says which gate proves which shopper journey and what is not covered yet.

## Promote to QA

```bash
.claude/skills/verify-ezyfit/scripts/promote-qa.sh
```

It refuses unless all of these hold:

- HEAD is on `origin/main` (push first).
- The newest `gates.yml` run for the HEAD sha on `main` is `completed` with conclusion `success`.

Then it exports HEAD with `git archive` (other sessions' uncommitted edits cannot leak in), pushes it to theme `158330912924` only, checks the CLI reports `success` with role `unpublished` and id `158330912924`, and prints the QA preview URL. It never takes a theme id argument, so it cannot reach the live theme. Pushing a newer HEAD without a green run for it is refused.

QA proves a whole-repo state the owner can click through. The draft stays the place builders push single files.

## Evidence

Each gates file writes `_preview/evidence/<timestamp>/` on the runner: `gates.json` (theme id, time, each gate with the observed value) and screenshots. The workflow uploads them as the artifact `gates-evidence-<run id>` (kept 14 days):

```bash
gh run download <run id> -n gates-evidence-<run id> -D /tmp/evidence
```

Proof standards:

- A change is proven by a green run after the push, read in full, plus a look at the screenshots of the pages you touched at both widths.
- Add-to-cart proof is the real `/cart.js` count going up and the header badge matching it, not button text. The gate leaves one item in a throwaway browser context, never a real cart.
- Loox reviews load late in an iframe and lazy images can look blank in full-page shots. Check those in a viewport shot after scrolling before calling them broken.
- A gate that fails because a precondition is missing (a product that does not exist) is reported with the reason in that feature's Gotchas. It is never weakened.
- Do not claim live behaviour. Draft and QA are not live. The live shop still runs the old theme.

## Cleanup

Nothing runs on this server, so nothing to stop. Do not delete the draft or QA themes. Delete scratch downloads in `/tmp`. Evidence in `_preview/evidence/` is git-ignored and Shopify-ignored; keep it. Artifacts expire on GitHub by themselves.

## Other helpers

- `scripts/doctor.mjs` and `scripts/dump-ezy.mjs` need a browser, so they run on GitHub only. `dump-ezy.mjs` feeds impeccable's detector; see [features/design-quality.md](features/design-quality.md). That check is not wired into a workflow yet.
- `scripts/shot.mjs` is the engine behind `shot.yml`.

## Isolation

Two sessions can push to the draft at once, so a run can include another session's half-finished file. If a gate fails on a page you did not touch, check `git log` and the draft's last push before assuming your change broke it. The QA theme is isolated from that: only `promote-qa.sh` writes to it.
