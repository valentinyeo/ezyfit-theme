#!/usr/bin/env python3
"""Watcher regression checks. Run only on a GitHub-hosted runner."""
import importlib.util
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("checks_watch", Path(__file__).with_name("checks-watch.py"))
watch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(watch)
NOW = datetime(2026, 11, 16, 22, tzinfo=timezone.utc)


def run(hours=1, status="completed", conclusion="success"):
    return {"databaseId": 42, "createdAt": (NOW - timedelta(hours=hours)).isoformat(),
            "status": status, "conclusion": conclusion,
            "url": "https://github.com/valentinyeo/ezyfit-theme/actions/runs/42"}


class WatcherTests(unittest.TestCase):
    def test_healthy(self):
        self.assertIsNone(watch.problem([run()], NOW)[0])

    def test_missing_is_stale(self):
        self.assertEqual(watch.problem([], NOW), ("stale", None))

    def test_stale_even_if_successful(self):
        self.assertEqual(watch.problem([run(hours=31)], NOW)[0], "stale")
        self.assertIsNone(watch.problem([run(hours=30)], NOW)[0])

    def test_failed_conclusions(self):
        for conclusion in ("failure", "cancelled", "timed_out", "startup_failure", "action_required"):
            with self.subTest(conclusion=conclusion):
                self.assertEqual(watch.problem([run(conclusion=conclusion)], NOW)[0], "failed")

    def test_newest_running_does_not_report_previous_failure(self):
        self.assertIsNone(watch.problem([run(status="in_progress", conclusion=""),
                                        run(hours=25, conclusion="failure")], NOW)[0])

    def test_reads_scheduled_main_only(self):
        with patch.object(watch, "command", return_value=[]) as command:
            watch.runs()
        args = command.call_args.args[0]
        self.assertEqual(args[args.index("--event") + 1], "schedule")
        self.assertEqual(args[args.index("--branch") + 1], "main")
        self.assertEqual(args[args.index("-w") + 1], "gates.yml")

    def fake_ht(self, existing=False, marker=False, agent=True):
        calls = []

        def ht(*args):
            calls.append(args)
            if args == ("context",):
                return {"connected_agent": {"id": "watcher"} if agent else None}
            if args[:2] == ("task", "list"):
                tasks = [{"id": 8, "title": watch.TITLE}] if existing else []
                return {"tasks": tasks, "total": len(tasks)}
            if args[:2] == ("task", "create"):
                return {"task": {"id": 8}}
            if args[:2] == ("comment", "list"):
                return {"agent_activity": [{"text": "ezyfit-scheduled:failed:42"}] if marker else [],
                        "nextCursor": None}
            if args[:2] == ("comment", "add"):
                return {"success": True}
            raise AssertionError(args)

        return ht, calls

    def test_create_in_backlog_with_label(self):
        ht, calls = self.fake_ht()
        state = watch.alert("failed", run(conclusion="failure"), {}, ht)
        create = next(c for c in calls if c[:2] == ("task", "create"))
        self.assertEqual(create[create.index("--project") + 1], "12322")
        self.assertEqual(create[create.index("--section") + 1], "35326")
        self.assertEqual(create[create.index("--labels") + 1], "brain-medium")
        self.assertEqual(state, {"alerted": "ezyfit-scheduled:failed:42", "ticket": 8})
        self.assertIn("+1", next(c for c in calls if c[:2] == ("comment", "add"))[-1])

    def test_existing_ticket_is_reused(self):
        ht, calls = self.fake_ht(existing=True)
        watch.alert("failed", run(conclusion="failure"), {}, ht)
        self.assertFalse(any(c[:2] == ("task", "create") for c in calls))
        self.assertEqual(sum(c[:2] == ("comment", "add") for c in calls), 1)

    def test_local_and_remote_deduplication(self):
        ht, calls = self.fake_ht(existing=True, marker=True)
        state = watch.alert("failed", run(conclusion="failure"), {}, ht)
        self.assertFalse(any(c[:2] == ("comment", "add") for c in calls))
        calls.clear()
        self.assertEqual(watch.alert("failed", run(conclusion="failure"), state, ht), state)
        self.assertEqual(calls, [])

    def test_run_id_prefix_is_not_a_duplicate(self):
        ht, calls = self.fake_ht(existing=True)

        def with_other_run(*args):
            result = ht(*args)
            if args[:2] == ("comment", "list"):
                result["agent_activity"] = [{"text": "ezyfit-scheduled:failed:420"}]
            return result

        watch.alert("failed", run(conclusion="failure"), {}, with_other_run)
        self.assertTrue(any(c[:2] == ("comment", "add") for c in calls))

    def test_user_login_is_refused_before_writes(self):
        ht, calls = self.fake_ht(agent=False)
        with self.assertRaises(RuntimeError):
            watch.alert("failed", run(conclusion="failure"), {}, ht)
        self.assertEqual(calls, [("context",)])

    def test_command_failure_does_not_expose_credentials(self):
        class Result:
            returncode = 1
            stdout = "secret"
            stderr = "secret"
        with patch.object(watch.subprocess, "run", return_value=Result()):
            with self.assertRaisesRegex(RuntimeError, "hypertask request failed") as error:
                watch.command(["hypertask", "--token", "secret"])
        self.assertNotIn("secret", str(error.exception))


if __name__ == "__main__":
    unittest.main()
