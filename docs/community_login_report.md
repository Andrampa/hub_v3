# DIEM Community last-login report

`scripts/report_community_logins.py` is an internal, read-only report inspired
by `C:\git\AGOL_mgmt\scripts\AGOL_delete_inactive_users.py`. It contains no
account deletion or modification operation. It prompts for a Community username
and masked password; neither the password nor a token is written to report files.

## Launch the notebook

For the `diem-access-stats` skill to fetch fresh results without credentials in
chat, run this one-time setup in a local PowerShell window:

```powershell
& 'C:\Program Files\ArcGIS\Pro\bin\Python\envs\arcgispro-py3\python.exe' 'C:\git\hub_v3\scripts\report_community_logins.py' --setup-credentials
```

Enter your Community username and masked password. After validating the account
and Community organization, setup stores credentials in **Windows Credential
Manager**, service `Codex DIEM access statistics`, account `DIEM Community`,
and exits. It uses the Windows vault backend directly, without a plaintext
keyring fallback. The credentials are accessible to programs running as your
Windows user but are not passed into chat or written into scripts/report files.
Rerun setup to update credentials; remove the matching Generic Credential in
Windows Credential Manager to revoke local storage. If external Python cannot
initialize its licence, run `%run` with `--setup-credentials` inside Pro instead.

Fresh noninteractive report command:

```powershell
& 'C:\Program Files\ArcGIS\Pro\bin\Python\envs\arcgispro-py3\python.exe' -B 'C:\git\hub_v3\scripts\report_community_logins.py' --stored-credentials --months 6 12 18 24
```

Missing vault credentials stop the run without prompting. The skill uses this
mode by default and answers only after the fresh report completes. The interactive
notebook remains available as follows.

Run this exact command in PowerShell to open the supplied notebook using the
installed ArcGIS Pro Python environment:

```powershell
& 'C:\Program Files\ArcGIS\Pro\bin\Python\envs\arcgispro-py3\python.exe' -m notebook 'C:\git\hub_v3\scripts\community_login_report.ipynb'
```

Run the notebook's code cell and enter your **DIEM Community** username and
password when prompted. Use an account with permission to read all organization
members and their last-login information. The script explicitly connects to
`https://hqfao-hub.maps.arcgis.com` with `GIS(portal, username, password)` and
verifies organization ID `D5aXW6TZFpeM2wke`. Your FAO account signed in to ArcGIS
Pro is not used. No password is accepted as a command-line argument or embedded
in the notebook.

Alternatively, execute this in an existing notebook:

```python
%run C:/git/hub_v3/scripts/report_community_logins.py
```

If the Pro Python environment cannot initialize its licence from Jupyter, open
the same notebook inside licensed ArcGIS Pro. Authentication still uses your
separately entered Community credentials.

Default scope is **all current DIEM Community organization members**, including
disabled accounts and administrators. This differs from the old script's single
group. Organization enumeration pages in batches of 100 and checks the total
when supplied. A failed directory read stops the report; individual profile
failures remain visible as unknown rows.

To use exactly the old group (`fb190ad8c9aa4d91aba380df83f341a6`), including
owner, admins and users with duplicate names removed:

```python
%run C:/git/hub_v3/scripts/report_community_logins.py --legacy-group
```

Other groups: `--group-id GROUP_ID`. Group reports can include members from
other organizations; `org_id` in the user export identifies them.

Customize the windows and destination (existing reports are never overwritten):

```python
%run C:/git/hub_v3/scripts/report_community_logins.py --months 3 6 9 12 18 24 36 48 --output-dir C:/Users/Amparore/DIEM_login_reports
```

## Read the report

The console prints two tables. A timestamped folder under
`~/DIEM_login_reports/` contains Excel-readable UTF-8 CSV files:

- `login_windows.csv`: cumulative distinct-user counts since each cutoff,
  percentage of all current members, older recorded logins, no recorded login,
  and unknown/unavailable dates. These windows overlap: the 12-month count
  includes the 3-, 6- and 9-month counts.
- `inactivity_bands.csv`: exclusive bands (0–3, 3–6, 6–9, 9–12, 12–18,
  18–24, 24–36 and over 36 months), plus no recorded login and unknown.
  Every member appears in exactly one band. Equality at a cutoff belongs to
  the more recent band.
- `users.csv`: username, name, email when visible, organization, role,
  disabled status, creation date, last-login date, days since login, band and
  lookup status. Sort/filter this file for an account review. Formula-like
  profile text is prefixed with an apostrophe for spreadsheet safety.
- `report_info.json`: scope, snapshot time, window definitions and limitations.

Cutoffs use calendar months in UTC, preserving time of day and clamping
month-end where needed. Missing, malformed, zero or future login values are
**unknown**, not inactive. Only ArcGIS's explicit `lastLogin=-1` sentinel becomes
**no recorded login**. Account creation is shown separately and never used as
a replacement for a login date. Individual-profile failures remain in totals,
so a report with unknowns is not a complete assessment of inactivity.

This is a snapshot of **current membership and each account's latest AGOL
sign-in**. It does not count login events, historical/deleted members, DIEM Hub
visits, downloads, or every kind of account activity. An old sign-in alone is
not evidence that an account is safe to delete: review roles, content ownership,
service dependencies, licences and retention requirements separately. The old
deletion script's exclusion list is not applied here, because this report
counts everyone in scope and makes no deletion recommendations.

Reports contain personal information; keep them outside the public deployment
and source control. No report is loaded by the Hub application.

## Verification

```powershell
& 'C:\Program Files\ArcGIS\Pro\bin\Python\envs\arcgispro-py3\python.exe' -m unittest discover -s scripts -p test_report_community_logins.py
npm run build
```

The user's live run authenticated successfully and enumerated 2,565 Community
members, then stopped before profile reads because the notebook resolved
`datetime` to the module rather than the class. Distinct `ReportDateTime` and
`ReportTimeZone` imports now avoid that collision; a complete mocked report test
reproduces the original global-name collision. Live login counts still need a
rerun at that point. The user subsequently completed the report for 2,565 members
and confirmed secure credential setup. The first noninteractive vault-based
report remains unverified. The initial external Pro Python import also failed
to initialize the Pro licence; open the notebook inside Pro if that persists.

Reusable skill sources are in `skills/diem-access-stats/`, with the installed
personal copy at `C:\Users\Amparore\.codex\skills\diem-access-stats`.

References: [Esri authentication schemes](https://developers.arcgis.com/python/latest/guide/working-with-different-authentication-schemes/),
[organization directory pagination](https://developers.arcgis.com/rest/users-groups-and-items/users/),
[user lastLogin field](https://developers.arcgis.com/rest/users-groups-and-items/user/).
