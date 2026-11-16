---
name: verify-ezyfit
description: Verify the EZYFIT Shopify storefront through GitHub Actions, maintain its shopper feature map, and monitor daily QA runs. Use after theme changes, before QA promotion, for verification maintenance, or when draft or QA looks wrong. Browsers and tests run only on GitHub-hosted runners. Maintenance uses the existing unpublished theme without uploading files.
---

# Verify the EZYFIT theme

The storefront is `easy-fit-store1.myshopify.com`, opened with `?preview_theme_id=<id>`. There is no local server. Drive it through GitHub Actions.

For verification maintenance, Launch means selecting the existing unpublished draft or QA theme and running Doctor. Do not call upload or promotion helpers. Edit only this skill and the verification workflows. Report product bugs separately. The builder flow below applies only when theme uploads were explicitly authorised.

## Hard rules

- No CI, builds, tests or browsers on this server (house rule, 2026-11-08). Playwright and Chromium run only on GitHub-hosted runners through `gates.yml` and `shot.yml`. Small paid minutes on this private repo are fine. On this server you may push, fetch over plain HTTP, call `gh`, and read artifacts.
- Never push to or publish theme `149894070428`. It is the live ClickShades shop. Upload helpers and workflows refuse it as a target.
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
gh workflow run gates.yml --ref main -f theme_id=158148984988
gh run list --workflow gates.yml --branch main --event workflow_dispatch --limit 1
gh run watch <run id> --interval 300 --exit-status
```

For branch verification, replace both `main` arguments with the pushed branch name. Match the run's branch, HEAD SHA and theme input before watching. Never poll faster than 300 seconds.

`gates.yml` runs on `ubuntu-latest` with Node 22, installs Playwright and Chromium, then runs every `.claude/skills/verify-ezyfit/scripts/gates*.mjs` with the theme ID as its first argument. It continues after a failing file and fails the job at the end if any file failed. Dispatch uses the selected theme. Pushes to `main` use the draft. The daily schedule uses QA, as described in Routine. The job times out at 20 minutes. Dispatch/push runs can cancel an older run on the same ref and theme; scheduled runs do not cancel an in-progress run.

If GitHub refuses to start because billing failed, record the annotation and run link. Report blocked with zero executed gates. Do not run checks here, weaken gates or merge around the failure.

Each gates file prints one `PASS` or `FAIL` line per gate with the observed value, ends with `N/M gates pass`, and exits 1 on any failure. Read the whole log, not just the job colour:

```bash
gh run view <run id> --log | grep -E "PASS|FAIL|gates pass"
```

Gate files, one per area. Add a new area as a new `gates-<area>.mjs`; the workflow picks it up with no edit. Copy the header of `gates.mjs` (theme id from `argv[2]`, `require('playwright')` with no path, evidence under `_preview/evidence/<timestamp>/`, `process.exitCode` set).

| File | Area | Gate ids |
|---|---|---|
| `gates.mjs` | Header/cart, wiper basics, collection/search, footer, finder, newsletter copy, phone fold, legacy forwarding | G0–G13, G5d, G13b, G16–G19, G16b, G21–G23, GERR on exception; G14/G15/G20 absent |
| `gates-cro.mjs` | Brand metadata, review copy, finder inventory, sticky bar, shipping, search order, AWST | C1a–C1f, C2a/C2b, C3, C4a/C4b, C5a/C5b, C6, C7a/C7b; CERR on exception |
| `gates-shade.mjs` | Shade structure/brand, mocked Add All, shade collection, alternate parts homepage | S0–S8, S5b, P1/P1d, P2–P5; ERR on exception |
| `gates-wiper.mjs` | Add-ons, mocked Add All/quantity, Loox, FAQ schema, delivery, footer policies, fit panels, long page | W1a/W1b, W2a–W2d, W3a/W3b, W4, W5a–W5e, W6–W9; WERR on exception |

One page as a picture, on GitHub:

```bash
gh workflow run shot.yml -f path=/products/front-windscreen-wipers-for-toyota-hilux-2018 -f width=390 -f theme_id=158148984988
gh run download <run id> -n shot-<run id> -D /tmp/shot
```

Then view `/tmp/shot/shot.png`. Widths: 390 phone, 1280 desktop.

Stable handles the gates use (keep them when editing sections): `[data-ezy-head]`, `[data-ezy-menu]`, `[data-ezy-drawer]`, `[data-ezy-search]`, `[data-cart-count]`, `[data-ezy-pdp]`, `[data-ezy-type]`, `[data-ezy-position]`, `[data-ezy-year]`, `[data-ezy-fit-video]`, `[data-ezy-add]`, `[data-ezy-coll-q]`, `[data-ezy-finder]`, `[data-ezy-dd]`, `.ezy-coll__item`, `.ezy-coll__card`.

The feature map in [features/README.md](features/README.md) says which gate proves which shopper journey and what is not covered yet.

## Routine

This follows the Funeral Prints routine in `~/projects/funeralprints/scripts/fp-checks-watch.py` and `valentinyeo/fp-checks`'s `smoke.yml`, with one daily run and a board ticket instead of email.

- `gates.yml` schedules the full gate set once daily at **21:00 UTC**, using unpublished QA theme `158330912924`. GitHub schedules run only from the default branch after merge and can start late. The workflow never uploads Shopify files.
- `scripts/checks-watch.py` runs hourly outside GitHub. It reads only scheduled `gates.yml` runs on `main` through `gh`, ignoring manual and push runs. A missing run, newest run older than 30 hours, or newest completed run that did not succeed triggers an alert. A recent queued/running run is not a failure.
- The watcher finds one active ticket titled "EZYFIT daily shopper checks need attention" on board `12322`, or creates it in Backlog `35326` with `brain-medium`. It adds a +1 agent note with the run link. Later incidents reuse the ticket, even if somebody moved it out of Backlog. It never moves or closes tickets.
- A local lock prevents overlapping runs. State under `~/.local/state/ezyfit-checks-watch.json` suppresses repeated alerts for the same problem/run. A remote note marker handles a crash after posting. Healthy runs clear local suppression. GH/API errors exit nonzero without inventing a stale alert. There is no email.

The orchestrator installs cron only after this PR is verified and merged. Provision a dedicated Hypertask agent on board `12322` using board-identity, not a user login. Save its credential privately with mode 600 at `~/.config/hypertask-agents/credentials/sessions/ezyfit-checks-watch-agent-token`. `EZYFIT_HT_TOKEN_FILE` may point to another private file. Never paste the token into cron, logs or this repo. The watcher refuses a user identity before board writes. Ensure `gh` can read this repository and `hypertask` is on PATH.

Read-only inspection is safe here and does not require a board credential:

```bash
.claude/skills/verify-ezyfit/scripts/checks-watch.py --dry-run
```

Normal invocation reads GitHub and can write the board:

```bash
.claude/skills/verify-ezyfit/scripts/checks-watch.py
```

From the merged checkout, the orchestrator creates `~/.local/state` and installs this crontab line. Do not install it during maintenance:

```cron
17 * * * * PATH=/home/valentin/.local/bin:/usr/local/bin:/usr/bin:/bin /home/valentin/projects/ezyfit-theme/.claude/skills/verify-ezyfit/scripts/checks-watch.py >> /home/valentin/.local/state/ezyfit-checks-watch.log 2>&1
```

Watcher regression checks run in `gates.yml` before the browser gates. Their standalone invocation, **GitHub-hosted runner only**, is:

```bash
python3 .claude/skills/verify-ezyfit/scripts/test_checks_watch.py
```

They use mocked CLI responses, never real board writes. After installation, the orchestrator checks the first real alert and confirms a repeated hourly invocation does not duplicate it. Dry-run output alone does not prove board delivery. Until the first scheduled run, the watcher reports stale. Remove only this cron line to stop monitoring; retain its ticket and evidence.

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

Each gates file writes a timestamped directory under `_preview/evidence/` on the runner. It contains screenshots and its JSON result file, such as `gates.json`, `gates-cro.json`, `gates-shade.json` or `gates-wiper.json`, with theme ID, time and observed values. The workflow uploads them as the artifact `gates-evidence-<run id>` (kept 14 days):

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

No browser runs on this server, so there is no browser process to stop. The optional watcher is a short-lived cron command, not an app server. Do not delete the draft or QA themes. Remove disposable scratch downloads only after keeping the proof you need. Evidence in `_preview/evidence/` is git-ignored and Shopify-ignored; keep it. Artifacts expire on GitHub by themselves.

## Other helpers

- `scripts/doctor.mjs` and `scripts/dump-ezy.mjs` need a browser, so they run on GitHub only. `dump-ezy.mjs` feeds impeccable's detector; see [features/design-quality.md](features/design-quality.md). That check is not wired into a workflow yet.
- `scripts/shot.mjs` is the engine behind `shot.yml`.

## Isolation

Two sessions can push to the draft at once, so a run can include another session's half-finished file. If a gate fails on a page you did not touch, check `git log` and the draft's last push before assuming your change broke it. The QA theme is isolated from that: only `promote-qa.sh` writes to it.
