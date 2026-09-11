# AGOL notebooks (internal)

Notebooks here run inside ArcGIS Online, not in this repository. They are kept
for review and version history only. Never publish them, and never copy them to
the deployment repository `C:\git\fao-oer-diem-hub`. Commit them without cell
outputs and without passwords.

## `diem_community_management.ipynb`

Gives DIEM Hub accounts access to FAO content.

Hub accounts are created in the ArcGIS Hub community organization
(`hqfao-hub`, org `D5aXW6TZFpeM2wke`) and join its built-in group
`fb190ad8c9aa4d91aba380df83f341a6` automatically. The content promised to them
is shared with groups in the FAO organization (`hqfao`), which ArcGIS cannot
populate across organizations. This notebook copies the membership over.

### Role table

Hosted table `7ecd39a2d8d040ba848b7e03036fe607` (FAO organization, owner-only):
`OBJECTID`, `fullName`, `email`, `username`, `role`. **Roles are managed only
here** - edit `role` to promote or demote a user. Memberships changed by hand in
the groups for users in the table are undone on the next run.

| Role | Groups (exclusive) |
|---|---|
| 1 Community Member | Followers + Community Members `c8ae74a0f2de480abe6f72876a52b0cc` |
| 2 Stakeholder | Followers + Stakeholders `568d613416b842bc8574259d0555829e` |
| 3 Contributor | Followers + Contributors `ad13b87919464cb6b9bb6cd8defa0257` |

Followers is the Hub initiative followers group
`3581cdd013a048e1b69a12fdf4cf186f`. Its page opens on the Hub portal, but it is
owned by the FAO admin account, so it is edited through the FAO connection; the
Hub account gets a 403. A Contributor is
not in Community Members, so content meant for every role must also be shared
with the Stakeholders and Contributors groups.

### What a run does

1. Reads the Hub group, the role table (no geometry) and the four target groups,
   all by fixed ID.
2. Adds new accounts to the table as role 1. Full name and email are looked up
   only for new users. Deletes rows, by object ID, for accounts that left the
   Hub group. Existing roles are never changed.
3. Works out the membership each group should have and applies only the
   differences: additions first, then removals. It never removes group
   owners, group managers or users absent from the table (for example FAO
   staff added by hand).
4. Prints a summary and ends with an error if any table edit or membership
   change was rejected, so the scheduled task shows as failed.

A normal run makes six baseline reads (Hub group, role table, four target
groups) plus sign-in, one lookup per new user, one lookup per departed user,
one table edit per 500 rows changed, and one membership call per 25 changed
memberships. On a typical day that is a few dozen requests, compared with
roughly 3,600 (about two hours) in the previous version, which removed and
re-added every user daily.

### Safety

- `DRY_RUN = True` prints the planned changes without writing.
- A self-test cell checks the planning logic before anything is read.
- If more than 10% **and** more than 100 table users appear to have left the
  Hub group, table deletions and group removals are skipped and the run fails.
  For a genuine mass offboarding, run once with `ALLOW_LARGE_REMOVAL = True`,
  then set it back.
- Deleting a row loses that user's role, so each user who seems to have left is
  confirmed on their own Hub record first. A departure counts only if the
  account is deleted, or if it still exists but its group list no longer
  contains the Hub group. If any user's record still lists the group, the group
  read was incomplete. If any lookup fails, the departure can't be confirmed.
  In either case table deletions and group removals are skipped.
  The dry run prints the counts (`gone`, `left`, `member`, `unknown`). If
  `unknown` appears for every user, the admin can't see users' groups and the
  check needs another source.
- Disabled Hub accounts are treated like any other account. Disabling an
  account doesn't remove it from the Hub group, so it keeps its table row, role
  and memberships. It can't sign in, and the Hub app also rejects disabled
  identities, so nothing is exposed. Re-enabling it restores the user's access
  unchanged. To offboard someone for good, delete the account; the next run
  removes the row and memberships.
- New users' names and emails are looked up in dry runs too. Set
  `FORCE_BULK_DETAILS = True` in a dry run to test the paged-search path.
- If a table edit fails or raises, removals are skipped and the summary still
  prints. A new user still gets Community Members access when only their table
  row failed; the next run retries the row. A user whose addition failed is not
  removed from anything in the same run.
- Every group is checked against its expected title on each run. The
  2026-09-11 dry run confirmed that the previous notebook's Followers title
  search resolved to the configured group `3581cdd013a048e1b69a12fdf4cf186f`.

### Operating it

- Connections: `GIS("home")` is the task owner in the FAO organization (an
  admin). The Hub connection uses `hahmad_hqfao-hub`; its password is typed into
  the AGOL copy only.
- Schedule: one AGOL notebook task every 15 minutes, with `DRY_RUN = False`.
  Destructive steps run in every scheduled run, behind the safety checks
  above; there is no separate add-only task.
- Rollout: keep the previous notebook's task disabled as a rollback. Run a dry
  run, then one live run with test accounts for each role and one new account.
  Only then schedule it.
