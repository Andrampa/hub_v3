"""Summarize an existing DIEM report without connecting to AGOL."""

import argparse
import csv
import json
from datetime import datetime
from pathlib import Path

from report_community_logins import DEFAULT_MONTHS, summarize


def load_report(directory):
    info = json.loads((directory / "report_info.json").read_text(encoding="utf-8"))
    as_of = datetime.fromisoformat(info["as_of_utc"])
    if as_of.tzinfo is None:
        raise ValueError("Snapshot timestamp has no timezone")
    with (directory / "users.csv").open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if len(rows) != info["total_members"]:
        raise ValueError("Snapshot user count does not match its metadata")
    for row in rows:
        if row["login_status"] not in ("Recorded login", "No recorded login", "Unknown / unavailable"):
            raise ValueError("Unrecognized login status")
        if row["last_login_utc"]:
            login = datetime.fromisoformat(row["last_login_utc"])
            if login.tzinfo is None or login > as_of or row["login_status"] != "Recorded login":
                raise ValueError("Invalid recorded login")
        elif row["login_status"] == "Recorded login":
            raise ValueError("Recorded login has no date")
    return info, as_of, rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--months", nargs="+", type=int, default=DEFAULT_MONTHS)
    parser.add_argument("--report-dir", type=Path)
    parser.add_argument("--reports-root", type=Path, default=Path.home() / "DIEM_login_reports")
    args = parser.parse_args()
    months = sorted(set(args.months))
    if not months or months[0] < 1 or months[-1] > 120:
        parser.error("Months must be between 1 and 120")
    skipped = []
    if args.report_dir:
        directory = args.report_dir
        info, as_of, rows = load_report(directory)
    else:
        valid = []
        for candidate in args.reports_root.glob("community_logins_*"):
            try:
                loaded = load_report(candidate)
                valid.append((loaded[1], candidate, loaded))
            except (OSError, ValueError, KeyError, TypeError):
                skipped.append(str(candidate))
        if not valid:
            raise SystemExit("No complete saved report found. Run the Community login report first.")
        _, directory, (info, as_of, rows) = max(valid, key=lambda entry: entry[0])
    windows, _ = summarize(rows, as_of, months)
    print(json.dumps({
        "report_dir": str(directory), "scope": info["scope"],
        "as_of_utc": as_of.isoformat(), "total_members": len(rows),
        "metric": "Latest AGOL sign-in of current members; not DIEM Hub visits",
        "windows": windows, "skipped_incomplete_reports": skipped,
    }, indent=2))


if __name__ == "__main__":
    main()
