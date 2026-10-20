"""Read-only DIEM Community login audit using username/password authentication.

Run with ArcGIS Pro Python, or from its notebook with:
    %run C:/git/hub_v3/scripts/report_community_logins.py

Password is prompted securely, optionally held in Windows Credential Manager.
No account changes or deletion methods.
See docs/community_login_report.md.
"""

from __future__ import annotations

import argparse
import calendar
import csv
import getpass
import json
import traceback
import warnings
from datetime import datetime as ReportDateTime, timezone as ReportTimeZone
from pathlib import Path

COMMUNITY_ORG_ID = "D5aXW6TZFpeM2wke"
COMMUNITY_PORTAL = "https://hqfao-hub.maps.arcgis.com"
LEGACY_GROUP_ID = "fb190ad8c9aa4d91aba380df83f341a6"
DEFAULT_MONTHS = (3, 6, 9, 12, 18, 24, 36)
CREDENTIAL_SERVICE = "Codex DIEM access statistics"
CREDENTIAL_ACCOUNT = "DIEM Community"


class ReportError(Exception):
    """Safe, deliberately written diagnostic (never an ArcGIS session exception)."""


def months_ago(now, months):
    """Subtract calendar months, clamping month-end (e.g. May 31 -> Feb 28)."""
    year, month0 = divmod(now.year * 12 + now.month - 1 - months, 12)
    month = month0 + 1
    return now.replace(year=year, month=month,
                       day=min(now.day, calendar.monthrange(year, month)[1]))


def timestamp(value):
    """Missing/invalid timestamps are unknown, never an inferred old login."""
    if value is None or isinstance(value, bool):
        return None
    try:
        number = int(value)
        return ReportDateTime.fromtimestamp(number / 1000, ReportTimeZone.utc) if number > 0 else None
    except (ValueError, TypeError, OverflowError, OSError):
        return None


def iso(value):
    return value.isoformat(timespec="seconds") if value else ""


def login_state(value, now):
    # ArcGIS's explicit sentinel is -1. Missing or malformed values are not "never".
    if value == -1 or value == "-1":
        return "No recorded login", None
    login = timestamp(value)
    if login is None or login > now:
        return "Unknown / unavailable", None
    return "Recorded login", login


def band_labels(months):
    return ([f"0-{months[0]} months"] +
            [f"{lo}-{hi} months" for lo, hi in zip(months, months[1:])] +
            [f"Over {months[-1]} months", "No recorded login", "Unknown / unavailable"])


def user_row(username, data, now, months):
    state, login = login_state(data.get("lastLogin"), now)
    band = state
    if login:
        band = f"Over {months[-1]} months"
        for index, month in enumerate(months):
            if login >= months_ago(now, month):
                band = band_labels(months)[index]
                break
    return {
        "username": username,
        "full_name": data.get("fullName", ""),
        "email": data.get("email", ""),
        "org_id": data.get("orgId", ""),
        "role": data.get("role", ""),
        "disabled": data.get("disabled", ""),
        "created_utc": iso(timestamp(data.get("created"))),
        "last_login_utc": iso(login),
        "login_status": state,
        "days_since_login": (now - login).days if login else "",
        "inactivity_band": band,
        "lookup_status": "ok",
    }


def organization_members(gis):
    """Page the authoritative organization directory; don't use capped search."""
    start, seen_pages, users, total = 1, set(), {}, None
    while start != -1:
        if start in seen_pages:
            raise ReportError("Organization pagination repeated a page; rerun the report.")
        seen_pages.add(start)
        page = gis._con.get(
            f"{gis.url.rstrip('/')}/sharing/rest/portals/{COMMUNITY_ORG_ID}/users",
            {"f": "json", "start": start, "num": 100,
             "sortField": "username", "sortOrder": "asc"},
        )
        if "error" in page or "users" not in page or "nextStart" not in page:
            raise ReportError("Cannot read the full organization directory. Check admin privileges.")
        if total is None:
            total = page.get("total")
        for user in page["users"]:
            users[user["username"].casefold()] = user["username"]
        start = page["nextStart"]
        if start != -1 and (not page["users"] or start <= 0):
            raise ReportError("Organization pagination is incomplete; rerun the report.")
    if total is not None and len(users) != total:
        raise ReportError("Directory count changed or is incomplete; rerun the report.")
    return sorted(users.values(), key=str.casefold)


def credential_store():
    """Pin the Windows vault backend; never fall back to a plaintext keyring."""
    try:
        from keyring.backends.Windows import WinVaultKeyring
        return WinVaultKeyring()
    except Exception:
        raise ReportError("Windows Credential Manager is unavailable in this Python environment.") from None


def connect(username=None, stored_credentials=False, save_credentials=False):
    try:
        from arcgis.gis import GIS
    except Exception:
        raise ReportError("ArcGIS Python could not initialize. Use a working ArcGIS Python environment or a licensed Pro notebook.") from None

    if stored_credentials:
        try:
            saved = credential_store().get_password(CREDENTIAL_SERVICE, CREDENTIAL_ACCOUNT)
            if not saved:
                raise ValueError("Missing credentials")
            credentials = json.loads(saved)
            username, password = credentials["username"], credentials["password"]
            if not username or not password:
                raise ValueError("Empty credentials")
        except Exception:
            raise ReportError("Stored Community credentials are unavailable. Run --setup-credentials locally first.") from None
        finally:
            saved = credentials = None
    else:
        username = (username or input("DIEM Community username: ")).strip()
        if not username:
            raise ReportError("A DIEM Community username is required.")
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", getpass.GetPassWarning)
                password = getpass.getpass("DIEM Community password: ")
        except getpass.GetPassWarning:
            raise ReportError("A masked password prompt is unavailable. Run setup in a local terminal or notebook.") from None
        if not password:
            raise ReportError("A password is required.")
    try:
        gis = GIS(COMMUNITY_PORTAL, username=username, password=password)
        if gis.users.me is None:
            raise ReportError("Authentication did not return a signed-in user.")
        if save_credentials:
            if gis.properties.get("id") != COMMUNITY_ORG_ID:
                raise ReportError("The account is not connected to the DIEM Community organization.")
            try:
                credential_store().set_password(
                    CREDENTIAL_SERVICE, CREDENTIAL_ACCOUNT,
                    json.dumps({"username": username, "password": password}),
                )
            except Exception:
                raise ReportError("Sign-in succeeded but Windows Credential Manager could not save the credentials.") from None
    except ReportError:
        raise
    except Exception:
        # Never print session exceptions, which can contain credential URLs.
        raise ReportError("Community sign-in failed. Check the Community account credentials and network connection.") from None
    finally:
        password = None
    return gis, "Windows Credential Manager" if stored_credentials else "username/password"


def summarize(rows, now, months):
    total = len(rows)
    recorded = [ReportDateTime.fromisoformat(row["last_login_utc"]) for row in rows
                if row["last_login_utc"]]
    never = sum(row["login_status"] == "No recorded login" for row in rows)
    unknown = total - len(recorded) - never
    windows = []
    for month in months:
        cutoff = months_ago(now, month)
        recent = sum(login >= cutoff for login in recorded)
        windows.append({
            "months": month, "cutoff_utc": iso(cutoff), "total_members": total,
            "logged_in_since_cutoff": recent,
            "percent_of_all_members": round(100 * recent / total, 2) if total else 0,
            "last_login_before_cutoff": len(recorded) - recent,
            "no_recorded_login": never, "unknown_or_unavailable": unknown,
        })
    bands = [{"inactivity_band": band,
              "users": sum(row["inactivity_band"] == band for row in rows)}
             for band in band_labels(months)]
    return windows, bands


def write_csv(path, rows, fields=None):
    def safe_cell(value):
        # Neutralize spreadsheet formulas in remotely supplied profile fields.
        if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")):
            return "'" + value
        return value

    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields or list(rows[0]))
        writer.writeheader()
        writer.writerows({key: safe_cell(value) for key, value in row.items()} for row in rows)


def print_table(rows, columns):
    widths = [max(len(title), *(len(str(row[key])) for row in rows)) for key, title in columns]
    print(" | ".join(title.ljust(width) for (_, title), width in zip(columns, widths)))
    print("-+-".join("-" * width for width in widths))
    for row in rows:
        print(" | ".join(str(row[key]).ljust(width) for (key, _), width in zip(columns, widths)))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--username", help="Community username for interactive sign-in; prompted when omitted.")
    credentials = parser.add_mutually_exclusive_group()
    credentials.add_argument("--setup-credentials", action="store_true", help="Validate prompted credentials and save only in Windows Credential Manager, then exit.")
    credentials.add_argument("--stored-credentials", action="store_true", help="Read credentials from Windows Credential Manager without prompting.")
    parser.add_argument("--months", nargs="+", type=int, default=DEFAULT_MONTHS)
    parser.add_argument("--group-id", help="Optional group scope (owner, admins and members).")
    parser.add_argument("--legacy-group", action="store_true", help="Use the old deletion script's group.")
    parser.add_argument("--output-dir", type=Path, default=Path.home() / "DIEM_login_reports")
    args = parser.parse_args(argv)
    months = sorted(set(args.months))
    if not months or months[0] < 1 or months[-1] > 120:
        parser.error("Months must be between 1 and 120.")
    if args.legacy_group and args.group_id:
        parser.error("Choose --legacy-group or --group-id.")
    if args.stored_credentials and args.username:
        parser.error("--stored-credentials uses the stored username; omit --username.")
    gis, auth_mode = connect(args.username, stored_credentials=args.stored_credentials,
                             save_credentials=args.setup_credentials)
    if gis.properties.get("id") != COMMUNITY_ORG_ID:
        raise ReportError("The signed-in account is not connected to the DIEM Community organization.")
    if args.setup_credentials:
        print("Community credentials validated and saved in Windows Credential Manager. No accounts were changed.")
        return
    group_id = LEGACY_GROUP_ID if args.legacy_group else args.group_id
    scope = f"Group {group_id}" if group_id else f"DIEM Community organization {COMMUNITY_ORG_ID}"
    if group_id:
        group = gis.groups.get(group_id)
        if group is None:
            raise ReportError("Group not found or not accessible.")
        members = group.get_members()
        names = [members["owner"], *members["admins"], *members["users"]]
        usernames = sorted({name.casefold(): name for name in names}.values(), key=str.casefold)
        scope += f" ({group.title}); includes members from other organizations"
    else:
        usernames = organization_members(gis)
    print(f"Scope: {scope}\nAuthentication: {auth_mode}\nReading {len(usernames)} profiles...")
    # Snapshot before collection: sign-ins during collection are unavailable for this snapshot.
    now = ReportDateTime.now(ReportTimeZone.utc)
    rows = []
    for index, username in enumerate(usernames, 1):
        try:
            user = gis.users.get(username)
            if user is None:
                raise LookupError("User not found")
            row = user_row(username, user, now, months)
        except Exception as error:
            row = user_row(username, {}, now, months)
            row["lookup_status"] = f"Profile unavailable ({type(error).__name__})"
        rows.append(row)
        if index % 100 == 0:
            print(f"Read {index}/{len(usernames)} profiles")
    windows, bands = summarize(rows, now, months)
    print(f"\nAs of {iso(now)}. Cumulative windows (counts overlap):")
    print_table(windows, [("months", "Months"), ("logged_in_since_cutoff", "Logged in"),
                          ("percent_of_all_members", "% of all members"),
                          ("last_login_before_cutoff", "Older recorded login"),
                          ("no_recorded_login", "No recorded login"),
                          ("unknown_or_unavailable", "Unknown")])
    print("\nExclusive inactivity bands (each member counted once):")
    print_table(bands, [("inactivity_band", "Last login"), ("users", "Users")])
    out = args.output_dir / now.strftime("community_logins_%Y%m%dT%H%M%S_%fZ")
    out.mkdir(parents=True, exist_ok=False)
    write_csv(out / "login_windows.csv", windows)
    write_csv(out / "inactivity_bands.csv", bands)
    fields = list(user_row("", {}, now, months))
    write_csv(out / "users.csv", sorted(rows, key=lambda row: row["last_login_utc"]), fields)
    (out / "report_info.json").write_text(json.dumps({
        "as_of_utc": iso(now), "scope": scope, "total_members": len(rows),
        "months": months, "auth_mode": auth_mode,
        "notes": [
            "Current membership only; not historical membership or login event counts.",
            "lastLogin measures AGOL sign-in, not DIEM Hub visits or all account activity.",
            "Calendar-month cutoffs in UTC; equality belongs to the more recent band.",
            "Only lastLogin=-1 is classified as no recorded login; missing, invalid or future values are unknown.",
            "Creation date is never substituted for last login. Unknown profiles remain in the denominator.",
            "Login windows overlap; inactivity bands are mutually exclusive.",
            "No accounts were changed. Review ownership, roles, licences and service dependencies before deletion.",
        ],
    }, indent=2), encoding="utf-8")
    print(f"\nSaved report: {out}\nNo accounts were changed.")
    if any(row["login_status"] == "Unknown / unavailable" for row in rows):
        print("Some last-login dates were unavailable. Review users.csv before drawing inactivity conclusions.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Avoid exposing tokens/URLs from lower-level ArcGIS exceptions.
        if isinstance(error, ReportError):
            print(f"Report stopped: {error}")
        else:
            frames = [frame for frame in traceback.extract_tb(error.__traceback__)
                      if Path(frame.filename).resolve() == Path(__file__).resolve()]
            location = f" at {frames[-1].name}, line {frames[-1].lineno}" if frames else ""
            print(f"Report stopped ({type(error).__name__}){location}.")
            print("Run %tb in the notebook for the traceback. No account changes were made.")
        raise SystemExit(1)
