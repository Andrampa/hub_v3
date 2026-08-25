# Hub Catalog Categorization

## Purpose

The whole-catalog workflow fills missing DIEM Hub group-category branches
without changing any category already assigned in the Hub content group.
ArcGIS Online remains authoritative. The legacy Countries group supplies
migration evidence only.

The migration was completed on 2026-08-25. Country pages and ongoing country
curation now use the Hub content group exclusively; the legacy group is retained
only as historical evidence until its owners decide to archive or delete it.

The required invariant for every item is:

```text
existing Hub categories are a subset of the categories after application
```

The review CSV is Git-ignored because an authenticated audit can include
non-public editor-visible item metadata.

The same review file also contains reviewed multilingual product-family
relationships. These relationships affect Hub presentation and counting, not
group-category assignments; every language variant remains an independent
ArcGIS item with its own stable URL and metadata.

## Script Modes

`scripts/categorize_hub_catalog.py` has five explicit modes:

- `MODE = "audit"`: reads ArcGIS and creates a fresh review CSV; no remote
  writes are possible.
- `MODE = "prepare"`: adds the current editable columns to an existing review
  CSV, with a dated local backup; ArcGIS is not contacted.
- `MODE = "preflight"`: validates approved rows against live membership,
  timestamps, group categories and schema without writing.
- `MODE = "reconcile"`: repairs local verification status from exact live
  category sets after an interrupted application; it performs no ArcGIS write.
- `MODE = "apply"`: applies only explicitly approved additive paths and then
  verifies them through the group-scoped endpoint.

The checked-in defaults cannot apply anything: mode is `audit`, overwrite is
disabled, the expected apply count is zero and the pilot ceiling is ten.

On this workstation, authenticated runs use
`C:\Users\Amparore\AppData\Local\anaconda3\envs\env202409\python.exe`.
The process must be allowed to access the desktop ArcGIS license and the
signed-in `GIS("home")` portal profile.

## Practical Excel Review

Open `hub_catalog_category_review.csv` in Excel and enable filters. Do not edit
`item_id`, `modified`, `existing_hub_categories`, `evidence`,
`proposed_additions` or `audit_signature`.

### 1. Resolve conflicts first

Filter `conflicts` to nonblank. Compare `existing_countries` and
`legacy_countries`:

- preserve the existing Hub country unless the legacy country is clearly an
  additional valid assignment;
- put only approved full category paths in `override_additions`, separated by
  ` | `;
- enter `NONE` in `override_additions` to reject all automatic country/scope
  additions while still allowing approved catalog-role or product-type values;
- explain every conflict decision in `editor_notes`.

The apply mode refuses a conflict row with empty `editor_notes`.

### 2. Review additive country and scope proposals

Filter `proposed_additions` to nonblank:

- if every path is correct, leave `override_additions` blank;
- if only some paths are correct, paste only those paths into
  `override_additions`;
- if none is correct, set `review_decision` to `exclude`, or use `NONE` when
  approving only other taxonomy additions;
- set `review_decision` to `apply` only when the final additions are approved.

Rows left as `review` are ignored by application and remain available for a
later wave. `exclude` means no ArcGIS change for that row.

### 3. Review catalog role

Use `suggested_catalog_role` as evidence, not as an automatic decision. Enter
one approved value in `approved_catalog_role`:

- `Discoverable product`: a user-facing resource that may appear independently
  in catalog and country discovery;
- `Supporting component`: a map, service, image or other dependency that stays
  in the Hub group but should not appear independently.

Leave the approved field blank when uncertain. Catalog role is single-value;
the script rejects conflicting values.

### 4. Review unified product types

`suggested_product_types` comes from the legacy editorial classification. In
`approved_product_types`, record the product that the user receives, not the
ArcGIS technical file type. Separate multiple approved values with ` | `.

Before application, the approved taxonomy values must exist under
`/Categories/Product types/` in the live Hub schema. The script never creates
or guesses schema leaves and stops if an approved path is missing.

### 5. Record and approve the decision

Use only these `review_decision` values:

- `review`: unresolved; no change;
- `apply`: include in the next approved application wave;
- `exclude`: reviewed and intentionally unchanged.

Use `editor_notes` for ambiguity, exceptions and the evidence behind an
override. Save the CSV as UTF-8 CSV and close Excel before running the script.

### 6. Review multilingual product families

Filter `suggested_product_family_id` to nonblank. Each proposed family should
represent one publication available in more than one language:

- compare `suggested_family_members`, country, product type, round/cycle and
  publication context;
- confirm that the files are translations of the same publication, not merely
  related products;
- copy the suggested canonical item ID into `approved_product_family_id` for
  every confirmed member, or enter another member's item ID consistently;
- set `approved_variant_language` to the actual language of each item, correcting
  `detected_language` where metadata is wrong;
- enter `true` in `is_primary_variant` for exactly one member, normally the
  English item when available, and `false` for the other members;
- explain rejected or ambiguous matches in `family_review_notes` and leave the
  approved family ID blank.

`explicit DIEM-FAMILY tag` is confirmed metadata. `same normalized title` is a
high-confidence review candidate. `same country, product series and round` is a
broader candidate and deserves closer inspection. Similarity is never treated
as an authoritative relationship.

### Apply approved family metadata

`scripts/apply_product_family_tags.py` is a separate, guarded workflow. Its
default invocation is read-only. For every approved variant it verifies and,
only with explicit apply arguments, appends exactly two controlled tags:

- `DIEM-FAMILY:<canonical-item-id>` identifies the reviewed product family;
- `DIEM-LANGUAGE:<English|French|Spanish>` records the reviewed variant
  language without relying on title inference.

The script preserves every existing tag, refuses conflicting controlled tags,
requires the exact approved variant count, and verifies the whole approved set
through the group-scoped endpoint. On 2026-08-24, 39 families / 78 variants
were applied and verified with zero pending variants.

## Pilot Application

Start with at most ten representative `apply` rows. Set:

```python
MODE = "apply"
APPLY_EXPECTED_ITEM_COUNT = "<exact number of apply rows>"
APPLY_MAX_ITEMS = "10"
BATCH_SIZE = "10"
```

The script stops before writing unless:

- the exact number of valid `apply` rows matches the configured count;
- the live item timestamp and existing Hub categories match the audit;
- every addition belongs to an approved managed branch;
- every full path already exists in the live schema;
- no single-value branch conflicts and the item stays within 20 categories;
- all original Hub categories remain present.

Before assignment it creates a dated local CSV backup and confirms the review
file is writable. After assignment it reads the group-scoped results until the
exact category set is verified or the retry limit is reached. Verification
status and returned paths are written back to the CSV.

After a successful pilot, inspect the ten items in ArcGIS and on relevant Hub
surfaces before increasing `APPLY_MAX_ITEMS` for another explicitly reviewed
wave.
