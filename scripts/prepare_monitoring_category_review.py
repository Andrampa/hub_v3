"""Add decision columns to an existing monitoring-category review CSV.

This is intentionally local and fast: it does not contact ArcGIS. It preserves
the existing review rows and adds defaults of ``apply`` for high-confidence
items and ``review`` for medium/low-confidence items. Open the resulting CSV in
Excel and change only the rows you want to review.
"""

from __future__ import annotations

import csv
from pathlib import Path


CSV_PATH = Path(r"C:\git\hub_v3\monitoring_product_category_review.csv")
DECISION_COLUMN = "review_decision"
NEW_COLUMNS = (
    DECISION_COLUMN,
    "override_countries",
    "override_monitoring_product",
    "override_language",
    "override_geographic_scope",
    "editor_notes",
)


def main() -> int:
    if not CSV_PATH.exists():
        raise RuntimeError(f"Review CSV not found: {CSV_PATH}")
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)
    if "item_id" not in fieldnames or "confidence" not in fieldnames:
        raise RuntimeError("This is not a monitoring-category review CSV")
    for column in NEW_COLUMNS:
        if column not in fieldnames:
            fieldnames.append(column)
    for row in rows:
        if not row.get(DECISION_COLUMN):
            row[DECISION_COLUMN] = "apply" if row.get("confidence") == "high" else "review"
        for column in NEW_COLUMNS:
            row.setdefault(column, "")
    with CSV_PATH.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Prepared {len(rows)} review rows: {CSV_PATH}")
    print("High-confidence rows default to apply; medium/low rows default to review.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
