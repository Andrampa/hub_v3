"""Create the DIEM Hub content-group category schema in ArcGIS Online.

Run this script from PyCharm with the ArcGIS Pro Python environment. It uses
GIS("home") to reuse the portal and licensed account currently signed in through
ArcGIS Pro. It only prints the proposed schema while DRY_RUN is set to "true".

This script creates the category hierarchy only. It does not assign categories
to individual items.
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
DRY_RUN = "true"
ALLOW_REPLACE_EXISTING_SCHEMA = "false"
# Number of leaf categories to include, in the order below. Set to "1" for a
# live permission test; set to "0" to create the complete taxonomy.
MAX_CATEGORIES_TO_CREATE = "0"

# ArcGIS recommends one comprehensive category tree for group-content pages.
CATEGORY_TREE_TITLE = "Categories"
VALUE_SEPARATOR = "|"

COUNTRY_CODES = (
    "AFG|AGO|BDI|BFA|BGD|BWA|CAF|CMR|COD|COG|COL|GHA|GIN|GTM|HTI|HND|"
    "IRQ|LBN|LBR|LBY|LKA|MAR|MDG|MLI|MMR|MOZ|MRT|MWI|NAM|NER|NGA|NPL|"
    "PAK|PHL|SDN|SEN|SLE|SLV|SOM|SSD|SYR|TCD|TGO|TLS|TON|TUR|TZA|UKR|"
    "VCT|VEN|VNM|YEM|ZMB|ZWE"
)

SHOCK_TYPES = (
    "Conflict and displacement|Drought and climatic anomaly|Earthquake|"
    "Economic shock|Flood|Multiple shocks|Pest and disease|"
    "Tropical cyclone and storm|Volcanic eruption|Wildfire"
)

CONTENT_ROLES = (
    "Primary assessment|Executive summary|StoryMap|Interactive application|"
    "Supporting map or data|Update|Translation"
)

GEOGRAPHIC_SCOPES = "Country|Multi-country|Regional|Global"
LANGUAGES = "English|French|Spanish|Other"

DIEM_PILLARS = (
    "Household monitoring system|Hazard impact assessment|Research|Risk analysis"
)


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


def build_schema() -> list[dict[str, Any]]:
    return [
        {
            "title": CATEGORY_TREE_TITLE,
            "description": (
                "Controlled discovery categories for the FAO Data in Emergencies Hub."
            ),
            "categories": [
                category_branch(
                    "Countries",
                    "ISO 3166-1 alpha-3 country codes represented by the resource.",
                    configured_values("COUNTRY_CODES", COUNTRY_CODES),
                ),
                category_branch(
                    "Shock types",
                    "Hazards or crises addressed by the resource.",
                    configured_values("SHOCK_TYPES", SHOCK_TYPES),
                ),
                category_branch(
                    "Content roles",
                    "The resource's role within an assessment or evidence package.",
                    configured_values("CONTENT_ROLES", CONTENT_ROLES),
                ),
                category_branch(
                    "Geographic scope",
                    "The geographic scope represented by the resource.",
                    configured_values("GEOGRAPHIC_SCOPES", GEOGRAPHIC_SCOPES),
                ),
                category_branch(
                    "Languages",
                    "Languages in which the resource is published.",
                    configured_values("LANGUAGES", LANGUAGES),
                ),
                category_branch(
                    "DIEM pillars",
                    "The DIEM programme pillar represented by the resource.",
                    configured_values("DIEM_PILLARS", DIEM_PILLARS),
                ),
            ],
        }
    ]


def limit_leaf_categories(
    schema: list[dict[str, Any]], limit: int
) -> list[dict[str, Any]]:
    """Keep the first N leaf categories and the branches needed to reach them."""
    if limit == 0:
        return schema

    remaining = limit

    def prune(node: dict[str, Any]) -> dict[str, Any] | None:
        nonlocal remaining
        children = node.get("categories", [])
        if not children:
            if remaining == 0:
                return None
            remaining -= 1
            return {key: value for key, value in node.items() if key != "categories"}

        retained_children = [
            retained for child in children if (retained := prune(child)) is not None
        ]
        if not retained_children:
            return None
        retained_node = {key: value for key, value in node.items() if key != "categories"}
        retained_node["categories"] = retained_children
        return retained_node

    limited_schema = [
        retained for tree in schema if (retained := prune(tree)) is not None
    ]
    if not limited_schema:
        raise ValueError("MAX_CATEGORIES_TO_CREATE must be at least 1 or 0 for all")
    return limited_schema


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


def main() -> int:
    dry_run = configured_boolean("DRY_RUN", DRY_RUN)
    allow_replace = configured_boolean(
        "ALLOW_REPLACE_EXISTING_SCHEMA", ALLOW_REPLACE_EXISTING_SCHEMA
    )
    category_limit = configured_category_limit(MAX_CATEGORIES_TO_CREATE)
    desired_schema = limit_leaf_categories(build_schema(), category_limit)
    validate_schema(desired_schema)

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
    already_current = schemas_match(existing_schema, desired_schema)

    print(f"Portal: {gis.url}")
    print(f"Group: {group.title} ({group.id})")
    print(f"Signed in as: {gis.users.me.username if gis.users.me else 'anonymous'}")
    print(f"Dry run: {dry_run}")
    print(
        "Leaf-category limit: "
        + ("all" if category_limit == 0 else str(category_limit))
    )
    print(f"Existing category trees: {len(existing_schema)}")
    print("\nProposed category schema:\n")
    print(json.dumps({"categorySchema": desired_schema}, indent=2, ensure_ascii=False))

    if already_current:
        print("\nThe group already has this exact category schema. Nothing to do.")
        return 0

    if existing_schema and not allow_replace:
        print("\nExisting category schema:\n")
        print(json.dumps({"categorySchema": existing_schema}, indent=2, ensure_ascii=False))
        message = (
            "The group already has a different category schema. The script will not "
            "replace it while ALLOW_REPLACE_EXISTING_SCHEMA is \"false\"."
        )
        if dry_run:
            print(f"\nWARNING: {message}")
            return 0
        raise RuntimeError(message)

    if dry_run:
        print(
            '\nDRY RUN ONLY: no ArcGIS changes were made. Set DRY_RUN = "false" '
            "after reviewing the schema."
        )
        return 0

    if not gis.users.me:
        raise RuntimeError("An authenticated ArcGIS session is required to apply changes")

    # CategorySchemaManager is the ArcGIS API for Python's public interface for
    # assigning a hierarchical category schema to a group.
    group.categories.schema = desired_schema

    updated_schema = schema_trees(group.categories.schema)
    if not schemas_match(updated_schema, desired_schema):
        raise RuntimeError(
            "ArcGIS accepted the request but the returned schema does not match "
            "the proposed schema. Inspect the group before retrying."
        )

    print("\nSUCCESS: the group category schema was created and verified.")
    print("No categories were assigned to individual items.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise
