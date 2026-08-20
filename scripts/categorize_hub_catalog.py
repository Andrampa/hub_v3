"""Prepare an additive categorization review for the complete DIEM Hub group.

This first version is deliberately audit-only: it reads the two public ArcGIS
groups and writes a review CSV, but contains no category-assignment operation.
Run it from ArcGIS Pro's Python environment with an authenticated ``GIS("home")``
session.

Existing DIEM Hub group categories are authoritative. The script copies them
verbatim into the expected final category list and proposes values only for an
empty branch. If an existing Hub branch and the legacy Countries-group branch
disagree, it records a conflict and proposes no change to that branch.
"""

from __future__ import annotations

import csv
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from arcgis.gis import GIS


HUB_GROUP_ID = "ab8a43038b6347ac93507988f7e2a90b"
EXPECTED_HUB_GROUP_TITLE = "FAO Data in Emergencies Hub Content"
COUNTRY_GROUP_ID = "c27d3dbba52343c6addfd61edaaa3e86"
EXPECTED_COUNTRY_GROUP_TITLE = "Data in Emergencies Hub - Countries"

# Keep this script incapable of remote writes until the generated review has
# been approved and a separate guarded application phase is implemented.
AUDIT_ONLY = "true"
OVERWRITE_REVIEW_CSV = "false"
OUTPUT_CSV = Path(__file__).resolve().parents[1] / "hub_catalog_category_review.csv"

ROOT = "/Categories"
COUNTRY_BRANCH = f"{ROOT}/Countries"
LEGACY_PRODUCT_BRANCH = f"{ROOT}/Item Type"
SCOPE_BRANCH = f"{ROOT}/Geographic scope"
LANGUAGE_BRANCH = f"{ROOT}/Languages"
PILLAR_BRANCH = f"{ROOT}/DIEM pillars"
MONITORING_PRODUCT_BRANCH = f"{ROOT}/Monitoring products"
CONTENT_ROLE_BRANCH = f"{ROOT}/Content roles"

# These branches are proposed for the unified catalog but are not created by
# this script. Values are review suggestions until the taxonomy is approved.
FUTURE_CATALOG_ROLE_BRANCH = f"{ROOT}/Catalog role"
FUTURE_PRODUCT_BRANCH = f"{ROOT}/Product types"

TECHNICAL_SUPPORT_TYPES = {
    "Feature Service",
    "Image",
    "Service Definition",
    "Web Map",
}
LIKELY_PRODUCT_TYPES = {
    "Document Link",
    "Microsoft Excel",
    "Microsoft Powerpoint",
    "PDF",
    "StoryMap",
}


@dataclass
class AuditRow:
    item: dict[str, Any]
    existing_paths: list[str]
    legacy_paths: list[str]
    existing_countries: list[str]
    legacy_countries: list[str]
    legacy_product_types: list[str]
    proposed_additions: list[str] = field(default_factory=list)
    final_expected_paths: list[str] = field(default_factory=list)
    missing_schema_paths: list[str] = field(default_factory=list)
    suggested_catalog_role: str = ""
    suggested_product_types: list[str] = field(default_factory=list)
    evidence: list[str] = field(default_factory=list)
    conflicts: list[str] = field(default_factory=list)
    review_decision: str = "review"
    editor_notes: str = ""
    status: str = "audit only; not applied"


def configured_boolean(name: str, value: str) -> bool:
    normalized = value.strip().lower()
    if normalized not in {"true", "false"}:
        raise ValueError(f'{name} must be the string "true" or "false"')
    return normalized == "true"


def category_values(paths: list[str], branch: str) -> list[str]:
    prefix = f"{branch}/"
    return list(
        dict.fromkeys(
            path[len(prefix) :].strip()
            for path in paths
            if path.lower().startswith(prefix.lower()) and path[len(prefix) :].strip()
        )
    )


def group_scoped_items(gis: GIS, group_id: str) -> dict[str, dict[str, Any]]:
    """Return every group item with that group's category assignments."""
    url = f"{gis._portal.resturl}content/groups/{group_id}/search"
    items: dict[str, dict[str, Any]] = {}
    start = 1
    while start > 0:
        response = gis._con.get(
            url,
            {
                "f": "json",
                "num": 100,
                "start": start,
                "sortField": "modified",
                "sortOrder": "desc",
            },
        )
        if "error" in response:
            raise RuntimeError(
                f"Group-scoped search failed for {group_id}: {response['error']}"
            )
        for item in response.get("results", []):
            identifier = str(item.get("id") or "").strip().lower()
            if identifier:
                items[identifier] = item
        next_start = int(response.get("nextStart", -1))
        start = next_start if next_start > 0 else -1
    return items


def scope_from_legacy_countries(countries: list[str]) -> str:
    real_countries = [country for country in countries if country != "XXX"]
    if "XXX" in countries or len(real_countries) > 1:
        return "Multi-country"
    if len(real_countries) == 1:
        return "Country"
    return ""


def suggest_catalog_role(item: dict[str, Any], legacy_products: list[str]) -> str:
    item_type = str(item.get("type") or "")
    if legacy_products:
        return "Discoverable product"
    if item_type in TECHNICAL_SUPPORT_TYPES:
        return "Supporting component"
    if item_type in LIKELY_PRODUCT_TYPES:
        return "Discoverable product"
    return ""


def audit_item(
    item: dict[str, Any],
    legacy_item: dict[str, Any] | None,
    schema_paths: set[str],
) -> AuditRow:
    existing = list(dict.fromkeys(item.get("groupCategories") or []))
    legacy = list(dict.fromkeys((legacy_item or {}).get("groupCategories") or []))
    existing_countries = [
        value.upper() for value in category_values(existing, COUNTRY_BRANCH)
    ]
    legacy_countries = [
        value.upper() for value in category_values(legacy, COUNTRY_BRANCH)
    ]
    legacy_products = category_values(legacy, LEGACY_PRODUCT_BRANCH)
    row = AuditRow(
        item=item,
        existing_paths=existing,
        legacy_paths=legacy,
        existing_countries=existing_countries,
        legacy_countries=legacy_countries,
        legacy_product_types=legacy_products,
        suggested_catalog_role=suggest_catalog_role(item, legacy_products),
        suggested_product_types=legacy_products,
    )

    additions: list[str] = []
    if not existing_countries and legacy_countries:
        migrated_countries = [code for code in legacy_countries if code != "XXX"]
        additions.extend(f"{COUNTRY_BRANCH}/{code}" for code in migrated_countries)
        row.evidence.append("country assignment from Countries group")
        if "XXX" in legacy_countries:
            row.evidence.append("legacy XXX cross-country assignment")
    elif existing_countries and legacy_countries:
        if set(existing_countries) != set(code for code in legacy_countries if code != "XXX"):
            row.conflicts.append(
                "Hub and Countries-group country assignments differ; Hub values preserved"
            )

    effective_countries = existing_countries or legacy_countries
    suggested_scope = scope_from_legacy_countries(effective_countries)
    existing_scope = category_values(existing, SCOPE_BRANCH)
    if suggested_scope and not existing_scope:
        additions.append(f"{SCOPE_BRANCH}/{suggested_scope}")
        row.evidence.append("geographic scope derived from reviewed country assignment")
    elif suggested_scope and existing_scope and suggested_scope not in existing_scope:
        row.conflicts.append(
            f"Existing geographic scope ({' | '.join(existing_scope)}) differs from "
            f"country-derived suggestion ({suggested_scope}); existing value preserved"
        )

    if legacy_products:
        row.evidence.append("product-type evidence from Countries group")
    if row.suggested_catalog_role:
        row.evidence.append("catalog-role suggestion requires taxonomy review")

    row.proposed_additions = list(
        dict.fromkeys(path for path in additions if path not in existing)
    )
    row.final_expected_paths = list(
        dict.fromkeys(row.existing_paths + row.proposed_additions)
    )
    row.missing_schema_paths = [
        path for path in row.proposed_additions if path not in schema_paths
    ]

    # This invariant is intentionally redundant: future edits must not be able
    # to turn this audit into a destructive replacement by accident.
    if not set(row.existing_paths).issubset(row.final_expected_paths):
        raise RuntimeError(
            f"Internal preservation failure for {item.get('id')}: an existing Hub "
            "category is absent from final_expected_paths"
        )
    if len(row.final_expected_paths) > 20:
        row.conflicts.append(
            "Expected category count exceeds ArcGIS's 20-category item limit"
        )
    return row


def write_review_csv(rows: list[AuditRow], output_path: Path, overwrite: bool) -> None:
    if output_path.exists() and not overwrite:
        raise RuntimeError(
            f"Review CSV already exists: {output_path}. Set "
            'OVERWRITE_REVIEW_CSV = "true" only after preserving any editorial decisions.'
        )
    fields = [
        "item_id",
        "title",
        "item_type",
        "owner",
        "modified",
        "tags",
        "existing_countries",
        "legacy_countries",
        "legacy_product_types",
        "existing_pillars",
        "existing_geographic_scope",
        "existing_languages",
        "existing_monitoring_products",
        "existing_content_roles",
        "suggested_catalog_role",
        "suggested_product_types",
        "confidence",
        "evidence",
        "conflicts",
        "existing_hub_categories",
        "legacy_country_group_categories",
        "proposed_additions",
        "final_expected_categories",
        "missing_schema_paths",
        "existing_categories_preserved",
        "review_decision",
        "editor_notes",
        "status",
    ]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            item = row.item
            if row.conflicts or row.missing_schema_paths:
                confidence = "review"
            elif row.proposed_additions and row.legacy_countries:
                confidence = "high"
            elif row.suggested_catalog_role or row.suggested_product_types:
                confidence = "medium"
            else:
                confidence = "low"
            writer.writerow(
                {
                    "item_id": item.get("id") or "",
                    "title": item.get("title") or "",
                    "item_type": item.get("type") or "",
                    "owner": item.get("owner") or "",
                    "modified": item.get("modified") or "",
                    "tags": " | ".join(item.get("tags") or []),
                    "existing_countries": " | ".join(row.existing_countries),
                    "legacy_countries": " | ".join(row.legacy_countries),
                    "legacy_product_types": " | ".join(row.legacy_product_types),
                    "existing_pillars": " | ".join(
                        category_values(row.existing_paths, PILLAR_BRANCH)
                    ),
                    "existing_geographic_scope": " | ".join(
                        category_values(row.existing_paths, SCOPE_BRANCH)
                    ),
                    "existing_languages": " | ".join(
                        category_values(row.existing_paths, LANGUAGE_BRANCH)
                    ),
                    "existing_monitoring_products": " | ".join(
                        category_values(row.existing_paths, MONITORING_PRODUCT_BRANCH)
                    ),
                    "existing_content_roles": " | ".join(
                        category_values(row.existing_paths, CONTENT_ROLE_BRANCH)
                    ),
                    "suggested_catalog_role": row.suggested_catalog_role,
                    "suggested_product_types": " | ".join(row.suggested_product_types),
                    "confidence": confidence,
                    "evidence": " | ".join(row.evidence),
                    "conflicts": " | ".join(row.conflicts),
                    "existing_hub_categories": " | ".join(row.existing_paths),
                    "legacy_country_group_categories": " | ".join(row.legacy_paths),
                    "proposed_additions": " | ".join(row.proposed_additions),
                    "final_expected_categories": " | ".join(row.final_expected_paths),
                    "missing_schema_paths": " | ".join(row.missing_schema_paths),
                    "existing_categories_preserved": str(
                        set(row.existing_paths).issubset(row.final_expected_paths)
                    ).lower(),
                    "review_decision": row.review_decision,
                    "editor_notes": row.editor_notes,
                    "status": row.status,
                }
            )


def main() -> int:
    if not configured_boolean("AUDIT_ONLY", AUDIT_ONLY):
        raise RuntimeError(
            'This version is audit-only. AUDIT_ONLY must remain "true"; no apply '
            "operation has been implemented or authorized."
        )
    overwrite = configured_boolean("OVERWRITE_REVIEW_CSV", OVERWRITE_REVIEW_CSV)
    gis = GIS("home")
    if not gis.users.me:
        raise RuntimeError("GIS('home') did not return an authenticated ArcGIS user")

    hub_group = gis.groups.get(HUB_GROUP_ID)
    country_group = gis.groups.get(COUNTRY_GROUP_ID)
    if not hub_group or hub_group.title != EXPECTED_HUB_GROUP_TITLE:
        raise RuntimeError("The expected DIEM Hub content group was not found")
    if not country_group or country_group.title != EXPECTED_COUNTRY_GROUP_TITLE:
        raise RuntimeError("The expected DIEM Countries group was not found")

    hub_items = group_scoped_items(gis, HUB_GROUP_ID)
    legacy_items = group_scoped_items(gis, COUNTRY_GROUP_ID)
    schema_paths = set(hub_group.categories.schema_paths)
    rows = [
        audit_item(item, legacy_items.get(identifier), schema_paths)
        for identifier, item in hub_items.items()
    ]
    rows.sort(
        key=lambda row: (
            str(row.item.get("title") or "").casefold(),
            str(row.item.get("id") or ""),
        )
    )
    if not rows:
        raise RuntimeError("The Hub group returned no items")

    write_review_csv(rows, OUTPUT_CSV, overwrite)
    uncategorized = sum(not row.existing_paths for row in rows)
    reusable = sum(bool(row.proposed_additions) for row in rows)
    conflicts = sum(bool(row.conflicts) for row in rows)
    outside_legacy = sum(row.item.get("id", "").lower() not in legacy_items for row in rows)
    print(f"Portal: {gis.url}")
    print(f"Signed in as: {gis.users.me.username}")
    print(f"Hub items audited: {len(rows)}")
    print(f"Items with no existing Hub categories: {uncategorized}")
    print(f"Items with additive proposals: {reusable}")
    print(f"Items requiring conflict review: {conflicts}")
    print(f"Hub items absent from Countries group: {outside_legacy}")
    print(f"Review CSV: {OUTPUT_CSV}")
    print("AUDIT ONLY: no ArcGIS categories were changed.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise
