"""Offline checks: python -m unittest discover -s scripts -p test_report_community_logins.py"""

import io
import datetime as datetime_module
import unittest
from contextlib import redirect_stdout
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import report_community_logins as report

from report_community_logins import (
    COMMUNITY_PORTAL, DEFAULT_MONTHS, ReportError, connect, login_state, months_ago,
    organization_members, summarize, user_row, write_csv,
)


class LoginReportTests(unittest.TestCase):
    now = datetime(2026, 10, 20, 12, tzinfo=timezone.utc)

    def row(self, value):
        return user_row("test", {"lastLogin": value}, self.now, DEFAULT_MONTHS)

    def test_exact_cutoff_and_exclusive_bands(self):
        cutoff = months_ago(self.now, 3)
        rows = [self.row(int(cutoff.timestamp() * 1000)),
                self.row(int(cutoff.timestamp() * 1000) - 1),
                self.row(-1), self.row(None)]
        windows, bands = summarize(rows, self.now, DEFAULT_MONTHS)
        self.assertEqual(windows[0]["logged_in_since_cutoff"], 1)
        self.assertEqual(windows[0]["last_login_before_cutoff"], 1)
        self.assertEqual(windows[0]["percent_of_all_members"], 25)
        self.assertEqual(windows[1]["logged_in_since_cutoff"], 2)
        self.assertEqual(sum(band["users"] for band in bands), 4)
        self.assertEqual(rows[0]["inactivity_band"], "0-3 months")
        self.assertEqual(rows[1]["inactivity_band"], "3-6 months")

    def test_missing_invalid_future_and_never(self):
        for value in (None, 0, "bad", -2, True, 99999999999999):
            self.assertEqual(login_state(value, self.now)[0], "Unknown / unavailable")
        self.assertEqual(self.row(-1)["login_status"], "No recorded login")
        row = user_row("test", {"created": 1000}, self.now, DEFAULT_MONTHS)
        self.assertEqual(row["last_login_utc"], "")
        self.assertEqual(row["login_status"], "Unknown / unavailable")

    def test_calendar_months_and_empty_scope(self):
        self.assertEqual(months_ago(datetime(2024, 5, 31), 3), datetime(2024, 2, 29))
        windows, bands = summarize([], self.now, DEFAULT_MONTHS)
        self.assertTrue(all(row["percent_of_all_members"] == 0 for row in windows))
        self.assertEqual(sum(row["users"] for row in bands), 0)

    def test_pagination_and_incomplete_directory(self):
        pages = iter([{"users": [{"username": "a"}], "nextStart": 2, "total": 2},
                      {"users": [{"username": "b"}], "nextStart": -1, "total": 2}])
        gis = SimpleNamespace(url="https://example.com", _con=SimpleNamespace(get=lambda *args: next(pages)))
        self.assertEqual(organization_members(gis), ["a", "b"])
        gis._con.get = lambda *args: {"users": [], "nextStart": -1, "total": 2}
        with self.assertRaises(ReportError):
            organization_members(gis)
        gis._con.get = lambda *args: {"users": [{"username": "a"}], "nextStart": 1}
        with self.assertRaises(ReportError):
            organization_members(gis)

    def test_csv_formula_protection(self):
        output = io.StringIO()
        class Capture:
            def __enter__(self):
                return output
            def __exit__(self, *args):
                pass
        with patch.object(Path, "open", return_value=Capture()):
            path = Path("users.csv")
            write_csv(path, [{"name": "=HYPERLINK(1)", "count": 3}])
        self.assertIn("'=HYPERLINK(1),3", output.getvalue())

    def test_password_authentication_uses_community_portal(self):
        gis = SimpleNamespace(users=SimpleNamespace(me={"username": "community_admin"}))
        with patch.dict("sys.modules", {"arcgis": SimpleNamespace(),
                        "arcgis.gis": SimpleNamespace(GIS=lambda *a, **kw: gis)}):
            with patch("report_community_logins.getpass.getpass", return_value="test-only") as prompt:
                with patch("arcgis.gis.GIS", return_value=gis) as factory:
                    connection, mode = connect("community_admin")
                    factory.assert_called_once_with(COMMUNITY_PORTAL, username="community_admin", password="test-only")
                prompt.assert_called_once()
        self.assertIs(connection, gis)
        self.assertEqual(mode, "username/password")

    def test_authentication_exception_does_not_expose_credentials(self):
        def fail(*args, **kwargs):
            raise RuntimeError("secret-token-must-not-appear")
        with patch.dict("sys.modules", {"arcgis": SimpleNamespace(),
                        "arcgis.gis": SimpleNamespace(GIS=fail)}):
            with patch("report_community_logins.getpass.getpass", return_value="test-only"):
                with self.assertRaises(ReportError) as result:
                    connect("community_admin")
        self.assertNotIn("secret-token", str(result.exception))

    def test_full_report_with_notebook_datetime_name_collision(self):
        gis = SimpleNamespace(
            properties={"id": report.COMMUNITY_ORG_ID},
            users=SimpleNamespace(get=lambda username: {"lastLogin": -1}),
        )
        output = io.StringIO()
        # Reproduce a notebook/SDK replacing the common datetime global with
        # the module after the script has imported datetime.datetime.
        with patch.object(report, "datetime", datetime_module, create=True), \
             patch.object(report, "timezone", SimpleNamespace(), create=True), \
             patch.object(report, "connect", return_value=(gis, "username/password")), \
             patch.object(report, "organization_members", return_value=["a", "b"]), \
             patch.object(report, "write_csv") as write, \
             patch.object(Path, "mkdir"), patch.object(Path, "write_text"), \
             redirect_stdout(output):
            report.main(["--output-dir", ".local-reports"])
        self.assertEqual(write.call_count, 3)
        windows = write.call_args_list[0].args[1]
        self.assertTrue(all(row["no_recorded_login"] == 2 for row in windows))
        self.assertTrue(all(row["unknown_or_unavailable"] == 0 for row in windows))
        self.assertIn("No accounts were changed.", output.getvalue())

    def test_stored_credentials_are_not_prompted_or_printed(self):
        import json
        vault = SimpleNamespace(get_password=lambda *a: json.dumps({"username": "community_admin", "password": "vault-test-secret"}))
        gis = SimpleNamespace(users=SimpleNamespace(me={"username": "community_admin"}))
        with patch.dict("sys.modules", {"arcgis": SimpleNamespace(), "arcgis.gis": SimpleNamespace(GIS=lambda *a, **kw: gis)}), \
             patch.object(report, "credential_store", return_value=vault), \
             patch("builtins.input", side_effect=AssertionError("No interactive prompt")), \
             patch.object(report.getpass, "getpass", side_effect=AssertionError("No password prompt")):
            connection, mode = connect(stored_credentials=True)
        self.assertIs(connection, gis)
        self.assertEqual(mode, "Windows Credential Manager")

    def test_missing_stored_credentials_does_not_prompt(self):
        vault = SimpleNamespace(get_password=lambda *a: None)
        with patch.dict("sys.modules", {"arcgis": SimpleNamespace(), "arcgis.gis": SimpleNamespace(GIS=lambda *a, **kw: None)}), \
             patch.object(report, "credential_store", return_value=vault), \
             patch("builtins.input", side_effect=AssertionError("No prompt")):
            with self.assertRaisesRegex(ReportError, "setup-credentials"):
                connect(stored_credentials=True)

    def test_setup_saves_only_valid_community_credentials(self):
        vault = SimpleNamespace(set_password=Mock())
        gis = SimpleNamespace(users=SimpleNamespace(me={"username": "test"}), properties={"id": "wrong-org"})
        with patch.dict("sys.modules", {"arcgis": SimpleNamespace(), "arcgis.gis": SimpleNamespace(GIS=lambda *a, **kw: gis)}), \
             patch.object(report, "credential_store", return_value=vault), \
             patch.object(report.getpass, "getpass", return_value="test-only"):
            with self.assertRaisesRegex(ReportError, "Community organization"):
                connect("test", save_credentials=True)
            vault.set_password.assert_not_called()
            gis.properties["id"] = report.COMMUNITY_ORG_ID
            connect("test", save_credentials=True)
        vault.set_password.assert_called_once()


if __name__ == "__main__":
    unittest.main()
