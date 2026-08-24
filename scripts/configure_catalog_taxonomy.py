"""Provision the reviewed whole-catalog taxonomy without changing existing nodes.

The default invocation is read-only. A live write requires both ``--apply`` and
the exact expected number of new nodes. Existing category trees, branches,
leaves and order are copied unchanged; only missing reviewed branches/leaves
are appended and the returned ArcGIS schema is verified exactly.
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from arcgis.gis import GIS


GROUP_ID = "ab8a43038b6347ac93507988f7e2a90b"
EXPECTED_GROUP_TITLE = "FAO Data in Emergencies Hub Content"
CATEGORY_TREE_TITLE = "Categories"

CATALOG_ROLES = ["Discoverable product", "Supporting component"]
PRODUCT_TYPES = [
    "Assessment Reports",
    "Country Briefs",
    "Crop calendar",
    "DIEM EVE",
    "EVE flood reports",
    "Key Findings Presentations",
    "Other DIEM documents",
    "Photo gallery",
    "Questionnaires",
    "Storymaps",
]


def schema_trees(value: Any) -> list[dict[str, Any]]:
    if not value:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        trees = value.get("categorySchema", [])
        return trees if isinstance(trees, list) else []
    return []


def branch(title: str, description: str, leaves: list[str]) -> dict[str, Any]:
    return {
        "title": title,
        "description": description,
        "categories": [{"title": leaf} for leaf in leaves],
    }


def reviewed_branches() -> list[dict[str, Any]]:
    return [
        branch(
            "Catalog role",
            "Editorial visibility role used by DIEM Hub catalog discovery.",
            CATALOG_ROLES,
        ),
        branch(
            "Product types",
            "Unified user-facing DIEM product classification.",
            PRODUCT_TYPES,
        ),
    ]


def merge_reviewed_taxonomy(
    existing_schema: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[str]]:
    merged = json.loads(json.dumps(existing_schema))
    root = next(
        (tree for tree in merged if tree.get("title") == CATEGORY_TREE_TITLE),
        None,
    )
    if not root or not isinstance(root.get("categories"), list):
        raise RuntimeError(
            f'The live schema has no readable "{CATEGORY_TREE_TITLE}" tree; refusing to modify it.'
        )
    categories = root["categories"]
    changes: list[str] = []
    for desired in reviewed_branches():
        existing = next(
            (value for value in categories if value.get("title") == desired["title"]),
            None,
        )
        if existing:
            if not isinstance(existing.get("categories"), list):
                raise RuntimeError(
                    f'Existing branch "{desired["title"]}" has no readable leaves.'
                )
            existing_titles = {
                str(value.get("title") or "") for value in existing["categories"]
            }
            for leaf in desired["categories"]:
                if leaf["title"] not in existing_titles:
                    existing["categories"].append(leaf)
                    changes.append(f'{desired["title"]}/{leaf["title"]}')
        else:
            categories.append(desired)
            changes.append(desired["title"])
            changes.extend(
                f'{desired["title"]}/{leaf["title"]}'
                for leaf in desired["categories"]
            )
    return merged, changes


def validate_schema(schema: list[dict[str, Any]]) -> int:
    node_count = 0

    def visit(nodes: list[dict[str, Any]], depth: int) -> None:
        nonlocal node_count
        if depth > 4:
            raise RuntimeError("ArcGIS group categories support at most four levels")
        for node in nodes:
            node_count += 1
            title = str(node.get("title") or "").strip()
            if not title or len(title) >= 100 or "/" in title or "," in title:
                raise RuntimeError(f"Invalid ArcGIS category title: {title!r}")
            description = str(node.get("description") or "")
            if len(description) >= 300:
                raise RuntimeError(f"Category description is too long: {title}")
            children = node.get("categories") or []
            if children:
                if not isinstance(children, list):
                    raise RuntimeError(f"Unreadable children for category: {title}")
                visit(children, depth + 1)

    if len(schema) > 5:
        raise RuntimeError("ArcGIS groups support at most five category trees")
    visit(schema, 1)
    if node_count > 200:
        raise RuntimeError(
            f"The desired schema has {node_count} nodes; ArcGIS allows at most 200"
        )
    return node_count


def schemas_match(left: list[dict[str, Any]], right: list[dict[str, Any]]) -> bool:
    return json.dumps(left, sort_keys=True) == json.dumps(right, sort_keys=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--expected-new-node-count", type=int, default=0)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    gis = GIS("home")
    group = gis.groups.get(GROUP_ID)
    if not group or group.title != EXPECTED_GROUP_TITLE:
        raise RuntimeError("The expected DIEM Hub content group was not found")
    existing = schema_trees(group.categories.schema)
    desired, changes = merge_reviewed_taxonomy(existing)
    existing_count = validate_schema(existing)
    desired_count = validate_schema(desired)
    new_node_count = desired_count - existing_count

    print(f"Portal: {gis.url}")
    print(f"Signed in as: {gis.users.me.username if gis.users.me else 'anonymous'}")
    print(f"Group: {group.title} ({group.id})")
    print(f"Existing schema nodes: {existing_count}")
    print(f"Desired schema nodes: {desired_count}")
    print(f"New nodes: {new_node_count}")
    print("Additive changes:")
    for change in changes:
        print(f"- {change}")

    if not args.apply:
        print("DRY RUN ONLY: no ArcGIS changes were made.")
        return 0
    if not gis.users.me:
        raise RuntimeError("An authenticated ArcGIS session is required")
    if args.expected_new_node_count < 1:
        raise RuntimeError("Live application requires a positive exact expected node count")
    if new_node_count != args.expected_new_node_count:
        raise RuntimeError(
            f"Expected {args.expected_new_node_count} new nodes, but dry-run found {new_node_count}"
        )
    if not changes:
        raise RuntimeError("No schema changes remain; refusing a no-op live write")

    group.categories.schema = desired
    returned = schema_trees(group.categories.schema)
    if not schemas_match(returned, desired):
        raise RuntimeError("ArcGIS returned a schema different from the verified request")
    print("SUCCESS: reviewed catalog taxonomy added and verified.")
    print("No categories were assigned to individual items.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise
