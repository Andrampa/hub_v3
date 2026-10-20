---
name: diem-access-stats
description: Fetch fresh DIEM Community access statistics from AGOL using Windows Credential Manager, including sign-ins during the last X months or years and inactivity bands. Use for DIEM user access or login-statistics requests, including Hub-access wording that needs the AGOL-versus-Hub distinction.
---

# DIEM access statistics

Answer requests such as "Give me DIEM access stats", "How many DIEM users
accessed the Hub in the last 6 months?", or comparisons over 6, 12, 18 and 24 months.

## Meaning of the data

The available report measures each current DIEM Community member's latest
**AGOL sign-in**. It cannot identify visits specifically to the DIEM Hub, login
event counts, downloads, or historical membership. When the request says Hub
access, state this distinction briefly and label results as Community AGOL
sign-ins. If actual Hub visits are required, explain that Hub analytics or
application logs are needed; do not claim this report supplies them.

The Community portal is `https://hqfao-hub.maps.arcgis.com`, organization
`D5aXW6TZFpeM2wke`. The user's ArcGIS Pro FAO session is a different account:
use Community username/password authentication for a refresh, never GIS(home/pro).

## Fresh retrieval is the default

For each ordinary statistics request, connect to AGOL and complete a new report
before answering. Cached data is only for explicitly historical/offline requests
or a clearly stated fallback after failed refresh. Never silently use old counts.

```powershell
& 'C:\Program Files\ArcGIS\Pro\bin\Python\envs\arcgispro-py3\python.exe' -B 'C:\git\hub_v3\scripts\report_community_logins.py' --stored-credentials --months 6 12 18 24
```

Adjust months to the request. Use the bundled `scripts/report_community_logins.py`
if the checkout is unavailable. The stored-credential command never prompts;
missing credentials stop the run. Use the normal execution approval path if
sandbox permissions block vault, network, or local report writes. Never retrieve,
inspect or print the vault secret through tools: the Python process consumes it
locally and outputs only report data. Authentication failure requires local setup
again, not repeated retries or substitution of Pro's FAO session.

Summarize the exact new report directory printed by the successful command with
the helper's `--report-dir`. Do not select an older report after a failed run.

## One-time private credential setup

Have the user run this themselves in a local PowerShell window:

```powershell
& 'C:\Program Files\ArcGIS\Pro\bin\Python\envs\arcgispro-py3\python.exe' 'C:\git\hub_v3\scripts\report_community_logins.py' --setup-credentials
```

They enter the username and masked password in that local prompt, outside chat.
Setup validates sign-in and Community organization membership, then saves both
values in Windows Credential Manager using the pinned Windows vault backend.
It exits without collecting profiles. No plaintext keyring fallback, `.env`,
notebook secret, command-line password, chat credential, or credential file is used.
Service: `Codex DIEM access statistics`; account: `DIEM Community`.
The user can rerun setup to update the password or remove the matching Generic
Credential in Windows Credential Manager. The secret is accessible to processes
running as the same Windows user, but is never passed to model context.

Wait for the user to confirm setup completed; never launch a hidden prompt.
If external Pro Python cannot initialize its licence, provide this Pro notebook cell:

```python
%run C:/git/hub_v3/scripts/report_community_logins.py --setup-credentials
```

Then run the noninteractive report. If that process still cannot initialize its
licence, the user can run the report with `--stored-credentials --months ...`
inside Pro; read the newly completed report and explain that unattended refresh
remains unavailable in the external process. Use the bundled path if needed.

## Summarize a fresh report or an explicitly requested saved snapshot

Look in `~/DIEM_login_reports/community_logins_*/` for `report_info.json` and
`users.csv`. Use the newest valid snapshot by its recorded `as_of_utc`, or the
specific report selected by the user. Do not hardcode previous counts.

Use the bundled helper; it selects the newest complete snapshot and recalculates
any requested rolling calendar-month windows from its user dates:

```powershell
& 'C:\Program Files\ArcGIS\Pro\bin\Python\envs\arcgispro-py3\python.exe' '<skill-folder>\scripts\summarize_login_report.py' --months 6 12 18 24
```

Replace `<skill-folder>` with this skill's actual absolute folder. Optional
`--report-dir PATH` selects a snapshot and `--reports-root PATH` changes the
search location. The helper imports only standard-library code and the bundled
report functions; reading saved statistics needs no AGOL login.

Convert 1 year to 12 months, 1.5 years to 18, and 2 years to 24. Default to
3, 6, 9, 12, 18, 24 and 36 months when no period is specified. Cutoffs are
relative to the snapshot's timestamp, not today's date: say "as of [date]".
For an explicitly fresh/current request, get a new snapshot or clearly identify
the available snapshot and arrange the refresh; never present it as newly fetched.

Return a compact table of period, distinct users and percentage of all current
members. Include the total membership, snapshot date, and a brief note that
windows overlap. Include unknown/no-recorded-login counts when relevant to
inactivity or completeness. No-recorded-login and unknown accounts are not
counted as confirmed older logins. Never substitute account creation for login.
Only include individual profiles if the user requests an account-level review.

## Interactive report fallback

The maintained project implementation is
`C:\git\hub_v3\scripts\report_community_logins.py`; the skill also bundles a
working copy at `scripts/report_community_logins.py` for use without that checkout.
Use the maintained project copy when available. It only reads accounts and writes
local CSV reports. It prompts for a Community username and masked password;
never request a password in chat, embed it in a command, persist it outside the Windows vault, or reuse
credentials from a notebook output.

The existing notebook can be launched from PowerShell:

```powershell
& 'C:\Program Files\ArcGIS\Pro\bin\Python\envs\arcgispro-py3\python.exe' -m notebook 'C:\git\hub_v3\scripts\community_login_report.ipynb'
```

Have the user run its cell and enter credentials in the masked prompt. If the
checkout is unavailable, supply a notebook cell `%run` pointing to the bundled
report script. A plain terminal can also run that script and prompt locally.
If external Pro Python cannot initialize its licence, open the notebook inside
licensed ArcGIS Pro; Community authentication remains separate from Pro's FAO
sign-in. Do not launch an unattended job that waits for a hidden password prompt.

After the user completes the report, read the new local snapshot and answer.
Do not claim live counts before successful completion. The earlier user run
confirmed organization enumeration and report export worked on this machine.

Default scope is the entire Community organization. Only use `--legacy-group`
(group `fb190ad8c9aa4d91aba380df83f341a6`) or `--group-id` when group scope is
requested. Label group scope explicitly; groups can include external members.

This skill never deletes, disables, reassigns or changes accounts. Account
deletion is a separate task; an old last-login date alone is not a deletion
recommendation. Do not copy personal report data into the skill or a public repo.
