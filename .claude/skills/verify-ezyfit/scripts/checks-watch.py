#!/usr/bin/env python3
"""Watch scheduled EZYFIT gates through gh. Alert one Hypertask ticket."""
import fcntl
import json
import os
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

REPO = "valentinyeo/ezyfit-theme"
WORKFLOW = "gates.yml"
PROJECT = "12322"
BACKLOG = "35326"
STALE_HOURS = 30
TITLE = "EZYFIT daily shopper checks need attention"
STATE = Path.home() / ".local/state/ezyfit-checks-watch.json"
TOKEN_FILE = Path.home() / ".config/hypertask-agents/credentials/sessions/ezyfit-checks-watch-agent-token"


def command(args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=120)
    if result.returncode:
        # CLI errors can echo arguments. Never include their output or the token.
        raise RuntimeError(f"{Path(args[0]).name} request failed, exit {result.returncode}")
    data = json.loads(result.stdout)
    if isinstance(data, dict) and data.get("success") is False:
        raise RuntimeError(f"{Path(args[0]).name} request was rejected")
    return data


def runs():
    return command([shutil.which("gh") or "gh", "run", "list", "-R", REPO,
                    "-w", WORKFLOW, "--event", "schedule", "--branch", "main", "-L", "1",
                    "--json", "databaseId,status,conclusion,createdAt,url"])


def problem(rs, now):
    if not rs:
        return "stale", None
    newest = rs[0]
    age = (now - datetime.fromisoformat(newest["createdAt"].replace("Z", "+00:00"))).total_seconds() / 3600
    if age > STALE_HOURS:
        return "stale", newest
    if newest["status"] == "completed" and newest["conclusion"] != "success":
        return "failed", newest
    return None, newest


def alert(kind, run, state, ht):
    key = f"ezyfit-scheduled:{kind}:{run['databaseId'] if run else 'none'}"
    if state.get("alerted") == key:
        return state
    context = ht("context")
    agent = context.get("connected_agent")
    if not agent or not agent.get("id"):
        raise RuntimeError("Hypertask requires a dedicated board agent, not a user login")

    matches = []
    offset = 0
    while True:
        page = ht("task", "list", "--project", PROJECT, "--status", "Normal",
                  "--limit", "100", "--offset", str(offset))
        tasks = page["tasks"]
        matches.extend(t for t in tasks if t["title"] == TITLE)
        offset += len(tasks)
        if offset >= page["total"] or not tasks:
            break
    if len(matches) > 1:
        raise RuntimeError("Multiple watcher tickets found; reconcile them before retrying")
    if matches:
        ticket = matches[0]["id"]
    else:
        created = ht("task", "create", "--project", PROJECT, "--section", BACKLOG,
                     "--title", TITLE, "--labels", "brain-medium", "--description",
                     "<h3>Problem</h3><p>EZYFIT's daily shopper checks need attention.</p>"
                     "<p>They failed or stopped arriving.</p><h3>Fix</h3>"
                     "<p>Restore the daily shopper checks.</p><h3>Done when</h3>"
                     "<p>A fresh daily run passes.</p><h3>Risk</h3>"
                     "<p>Shopper problems could go unnoticed.</p><h3>Decision</h3><p>None.</p>")
        ticket = created["task"]["id"]

    cursor = None
    while True:
        args = ["comment", "list", str(ticket), "--include-activity", "--limit", "100"]
        if cursor:
            args += ["--cursor", cursor]
        page = ht(*args)
        if re.search(re.escape(key) + r"(?![0-9])", json.dumps(page)):
            return {"alerted": key, "ticket": ticket}
        cursor = page.get("nextCursor")
        if not cursor:
            break
    url = run["url"] if run else f"https://github.com/{REPO}/actions/workflows/{WORKFLOW}"
    observed = f"{run['createdAt']}, {run['status']}, {run['conclusion']}" if run else "No scheduled run exists."
    ht("comment", "add", str(ticket), "--text",
       f"<p>+1 Daily shopper checks need attention.</p><p>{key}</p>"
       f"<p>{kind}; {observed}. Stale threshold {STALE_HOURS} hours.</p>"
       f'<p><a href="{url}">{url}</a></p>')
    return {"alerted": key, "ticket": ticket}


def main():
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Read gh only; do not write tickets or state")
    args = parser.parse_args()
    STATE.parent.mkdir(parents=True, exist_ok=True)
    with STATE.with_suffix(".lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        kind, run = problem(runs(), datetime.now(timezone.utc))
        if args.dry_run:
            print(json.dumps({"problem": kind, "run": run}))
            return
        state = json.loads(STATE.read_text()) if STATE.exists() else {}
        if kind:
            token = Path(os.environ.get("EZYFIT_HT_TOKEN_FILE", str(TOKEN_FILE))).read_text().strip()
            if not token:
                raise RuntimeError("Empty Hypertask agent credential")

            def ht(*args):
                return command([shutil.which("hypertask") or "hypertask", "--json", "--token", token, *args])

            state = alert(kind, run, state, ht)
        else:
            state = {}
        temporary = STATE.with_suffix(".tmp")
        temporary.write_text(json.dumps(state))
        temporary.replace(STATE)
        print(f"EZYFIT scheduled gates: {kind or 'healthy'}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        raise SystemExit(f"checks-watch: {type(error).__name__}. Inspect gh access, agent credentials and watcher state.") from None
