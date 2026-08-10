"""Add only the monitoring extensions to the DIEM Hub category schema.

Run this script from PyCharm with the ArcGIS Pro Python environment. It uses
GIS("home") to reuse the portal and licensed account currently signed in through
ArcGIS Pro. It only prints the proposed schema while DRY_RUN is set to "true".

This script is intentionally additive: it preserves the live schema byte for
byte except for appending the Monitoring products branch and any explicitly
listed missing monitoring-country leaves. It never replaces, reorders,
removes, or edits the impact-assessment branches or their assigned item paths.
"""

from __future__ import annotations

import json
import sys
from typing import Any

from arcgis.gis import GIS


# ---------------------------------------------------------------------------
# Editable configuration. Keep secrets out of this file.
# ---------------------------------------------------------------------------

GROUP_ID = "ab8a43038b6347ac93507988f7e2a90b"
EXPECTED_GROUP_TITLE = "FAO Data in Emergencies Hub Content"

# Safety switches. Change DRY_RUN to "false" only after reviewing the output.
DRY_RUN = "false"
# Number of monitoring-product leaf categories to include, in the order below.
# Set to "1" for a live permission test; set to "0" to add the complete branch.
MAX_CATEGORIES_TO_CREATE = "0"

# ArcGIS recommends one comprehensive category tree for group-content pages.
CATEGORY_TREE_TITLE = "Categories"
VALUE_SEPARATOR = "|"

MONITORING_PRODUCTS = (
    "Country brief|Findings presentation|Questionnaire|Report|Public dataset|"
    "Supporting material|Methodology or guidance"
)

# These countries occur in the authoritative monitoring-round service but are
# not present in the existing impact-assessment Countries branch. Appending the
# leaves keeps all existing country paths unchanged.
MONITORING_COUNTRY_CODES = "KHM|PSE"

def configured_boolean(name: str, value: str) -> bool:
    normalized = value.strip().lower()
    if normalized not in {"true", "false"}:
        raise ValueError(f'{name} must be the string "true" or "false"')
    return normalized == "true"


def configured_values(name: str, value: str) -> list[str]:
    values = [part.strip() for part in value.split(VALUE_SEPARATOR) if part.strip()]
    if not values:
        raise ValueError(f"{name} must contain at least one value")
    if len(values) != len(set(values)):
        raise ValueError(f"{name} contains duplicate values")
    return values


def configured_category_limit(value: str) -> int:
    try:
        limit = int(value.strip())
    except ValueError as error:
        raise ValueError('MAX_CATEGORIES_TO_CREATE must be a whole number string') from error
    if limit < 0:
        raise ValueError("MAX_CATEGORIES_TO_CREATE cannot be negative")
    return limit


def leaf_categories(values: list[str]) -> list[dict[str, str]]:
    return [{"title": value} for value in values]


def category_branch(
    title: str,
    description: str,
    values: list[str],
) -> dict[str, Any]:
    return {
        "title": title,
        "description": description,
        "categories": leaf_categories(values),
    }


def monitoring_product_branch(limit: int) -> dict[str, Any]:
    """Build only the one branch this script is authorized to add."""
    products = configured_values("MONITORING_PRODUCTS", MONITORING_PRODUCTS)
    if limit == 0:
        selected = products
    else:
        selected = products[:limit]
    return category_branch(
        "Monitoring products",
        "Controlled product types published by the household monitoring system.",
        selected,
    )


def validate_schema(schema: list[dict[str, Any]]) -> None:
    node_count = 0

    def visit(nodes: list[dict[str, Any]], depth: int) -> None:
        nonlocal node_count
        if depth > 4:
            raise ValueError("ArcGIS group categories support at most four levels")
        for node in nodes:
            node_count += 1
            title = str(node.get("title", "")).strip()
            description = str(node.get("description", ""))
            if not title:
                raise ValueError("Every category must have a title")
            if len(title) >= 100:
                raise ValueError(f"Category title is too long: {title}")
            if len(description) >= 300:
                raise ValueError(f"Category description is too long: {title}")
            if "/" in title or "," in title:
                raise ValueError(
                    f"ArcGIS reserves slash and comma in category titles: {title}"
                )
            children = node.get("categories", [])
            if children:
                visit(children, depth + 1)

    if len(schema) > 5:
        raise ValueError("ArcGIS groups support at most five category trees")
    visit(schema, 1)
    if node_count > 200:
        raise ValueError(
            f"The schema contains {node_count} categories; ArcGIS allows at most 200"
        )


def connect() -> GIS:
    return GIS("home")


def schema_trees(value: Any) -> list[dict[str, Any]]:
    if not value:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        trees = value.get("categorySchema", [])
        return trees if isinstance(trees, list) else []
    return []


def schemas_match(left: list[dict[str, Any]], right: list[dict[str, Any]]) -> bool:
    return json.dumps(left, sort_keys=True) == json.dumps(right, sort_keys=True)


def merge_monitoring_extensions(
    existing_schema: list[dict[str, Any]],
    branch: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[str]]:
    """Append approved monitoring nodes without changing any existing node.

    A pre-existing Monitoring products branch must match exactly. A mismatch is
    a manual editorial decision, never a reason for this script to overwrite it.
    """
    merged = json.loads(json.dumps(existing_schema))
    root = next(
        (tree for tree in merged if tree.get("title") == CATEGORY_TREE_TITLE),
        None,
    )
    if not root:
        raise RuntimeError(
            f'The live schema has no "{CATEGORY_TREE_TITLE}" tree; refusing to create '
            "or replace category trees automatically."
        )
    categories = root.get("categories")
    if not isinstance(categories, list):
        raise RuntimeError(
            f'The "{CATEGORY_TREE_TITLE}" tree has no readable category list; refusing to modify it.'
        )
    changes: list[str] = []
    existing_branch = next(
        (value for value in categories if value.get("title") == branch["title"]),
        None,
    )
    if existing_branch:
        if json.dumps(existing_branch, sort_keys=True) != json.dumps(branch, sort_keys=True):
            raise RuntimeError(
                'A "Monitoring products" branch already exists but differs from this '
                "script's controlled values. Inspect it manually; no changes were made."
            )
    else:
        categories.append(branch)
        changes.append("Monitoring products branch")

    countries_branch = next(
        (value for value in categories if value.get("title") == "Countries"),
        None,
    )
    if not countries_branch or not isinstance(countries_branch.get("categories"), list):
        raise RuntimeError(
            'The existing "Countries" branch is missing or unreadable; refusing to modify it.'
        )
    country_leaves = countries_branch["categories"]
    existing_country_codes = {str(value.get("title") or "") for value in country_leaves}
    for code in configured_values("MONITORING_COUNTRY_CODES", MONITORING_COUNTRY_CODES):
        if code not in existing_country_codes:
            country_leaves.append({"title": code})
            changes.append(f"Countries/{code}")
    return merged, changes


def main() -> int:
    dry_run = configured_boolean("DRY_RUN", DRY_RUN)
    category_limit = configured_category_limit(MAX_CATEGORIES_TO_CREATE)
    branch = monitoring_product_branch(category_limit)

    gis = connect()
    group = gis.groups.get(GROUP_ID.strip())
    if not group:
        raise RuntimeError(f"ArcGIS group {GROUP_ID} was not found or is inaccessible")
    if EXPECTED_GROUP_TITLE.strip() and group.title != EXPECTED_GROUP_TITLE.strip():
        raise RuntimeError(
            f'Group title mismatch: expected "{EXPECTED_GROUP_TITLE}", '
            f'found "{group.title}"'
        )

    existing_schema = schema_trees(group.categories.schema)
    desired_schema, changes = merge_monitoring_extensions(existing_schema, branch)
    validate_schema(desired_schema)

    print(f"Portal: {gis.url}")
    print(f"Group: {group.title} ({group.id})")
    print(f"Signed in as: {gis.users.me.username if gis.users.me else 'anonymous'}")
    print(f"Dry run: {dry_run}")
    print(
        "Leaf-category limit: "
        + ("all" if category_limit == 0 else str(category_limit))
    )
    print(f"Existing category trees: {len(existing_schema)}")
    print("Existing impact-assessment paths are preserved exactly.")
    print("\nProposed additive category schema:\n")
    print(json.dumps({"categorySchema": desired_schema}, indent=2, ensure_ascii=False))

    if not changes:
        print("\nAll monitoring schema extensions already exist exactly as configured. Nothing to do.")
        return 0

    print("\nAdditive changes only: " + ", ".join(changes))

    if dry_run:
        print(
            '\nDRY RUN ONLY: no ArcGIS changes were made. Set DRY_RUN = "false" '
            "after reviewing the schema."
        )
        return 0

    if not gis.users.me:
        raise RuntimeError("An authenticated ArcGIS session is required to apply changes")

    # This assigns the merged schema. All existing nodes were copied verbatim;
    # only the explicitly reported monitoring extensions were appended.
    group.categories.schema = desired_schema

    updated_schema = schema_trees(group.categories.schema)
    if not schemas_match(updated_schema, desired_schema):
        raise RuntimeError(
            "ArcGIS accepted the request but the returned schema does not match "
            "the proposed schema. Inspect the group before retrying."
        )

    print("\nSUCCESS: the monitoring schema extensions were added and verified.")
    print("No categories were assigned to individual items.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise
