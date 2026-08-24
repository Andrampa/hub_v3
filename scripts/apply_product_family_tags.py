"""Apply approved multilingual product-family tags without replacing metadata.

The review CSV is authoritative for the approved relationships. The default
invocation is a read-only dry run. Live application requires ``--apply`` and an
exact expected item count. Every existing tag is preserved; one controlled
``DIEM-FAMILY:<canonical-item-id>`` and ``DIEM-LANGUAGE:<language>`` tags are
appended and verified per item.
"""

from __future__ import annotations

import argparse
import csv
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Any

from arcgis.gis import GIS


GROUP_ID = "ab8a43038b6347ac93507988f7e2a90b"
EXPECTED_GROUP_TITLE = "FAO Data in Emergencies Hub Content"
FAMILY_TAG_PREFIX = "DIEM-FAMILY:"
LANGUAGE_TAG_PREFIX = "DIEM-LANGUAGE:"
APPROVED_LANGUAGES = {"English", "French", "Spanish"}
REVIEW_CSV = Path(__file__).resolve().parents[1] / "hub_catalog_category_review.csv"


def read_rows() -> list[dict[str, str]]:
    with REVIEW_CSV.open(encoding="utf-8-sig", newline="") as handle:
        rows = [
            {key: str(value or "") for key, value in row.items()}
            for row in csv.DictReader(handle)
        ]
    if not rows:
        raise RuntimeError("The review CSV contains no rows")
    return rows


def group_scoped_items(gis: GIS) -> dict[str, dict[str, Any]]:
    url = f"{gis._portal.resturl}content/groups/{GROUP_ID}/search"
    items: dict[str, dict[str, Any]] = {}
    start = 1
    while start > 0:
        response = gis._con.get(
            url,
            {"f": "json", "num": 100, "start": start, "sortField": "modified"},
        )
        if "error" in response:
            raise RuntimeError(f"Group search failed: {response['error']}")
        for item in response.get("results", []):
            identifier = str(item.get("id") or "").strip().lower()
            if identifier:
                items[identifier] = item
        next_start = int(response.get("nextStart", -1))
        start = next_start if next_start > 0 else -1
    return items


def family_tags(tags: list[str]) -> list[str]:
    return [tag for tag in tags if tag.casefold().startswith(FAMILY_TAG_PREFIX.casefold())]


def language_tags(tags: list[str]) -> list[str]:
    return [tag for tag in tags if tag.casefold().startswith(LANGUAGE_TAG_PREFIX.casefold())]


def approved_families(rows: list[dict[str, str]]) -> dict[str, list[dict[str, str]]]:
    families: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        family_id = row.get("approved_product_family_id", "").strip().lower()
        if family_id:
            families[family_id].append(row)
    if not families:
        raise RuntimeError("The review CSV contains no approved product families")
    for family_id, members in families.items():
        identifiers = {member.get("item_id", "").strip().lower() for member in members}
        if family_id not in identifiers:
            raise RuntimeError(f"Family canonical item is not a member: {family_id}")
        primary = [
            member
            for member in members
            if member.get("is_primary_variant", "").strip().lower() == "true"
        ]
        if len(primary) != 1 or primary[0].get("item_id", "").strip().lower() != family_id:
            raise RuntimeError(f"Family must have one canonical primary variant: {family_id}")
        if len(members) < 2:
            raise RuntimeError(f"Family has fewer than two variants: {family_id}")
        languages = {member.get("approved_variant_language", "").strip() for member in members}
        if not languages.issubset(APPROVED_LANGUAGES):
            raise RuntimeError(f"Family contains an invalid approved language: {family_id}")
    return families


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--expected-item-count", type=int, default=0)
    parser.add_argument(
        "--max-pending-items",
        type=int,
        default=0,
        help="Bound one resumable application wave; zero means all pending items.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    rows = read_rows()
    families = approved_families(rows)
    approved_rows = [member for members in families.values() for member in members]
    gis = GIS("home")
    group = gis.groups.get(GROUP_ID)
    if not group or group.title != EXPECTED_GROUP_TITLE:
        raise RuntimeError("The expected DIEM Hub content group was not found")
    live = group_scoped_items(gis)

    pending: list[tuple[str, list[str], list[str]]] = []
    already_verified = 0
    for family_id, members in families.items():
        expected_tag = f"{FAMILY_TAG_PREFIX}{family_id}"
        for member in members:
            identifier = member.get("item_id", "").strip().lower()
            live_item = live.get(identifier)
            if not live_item:
                raise RuntimeError(f"Approved family item is absent from the Hub group: {identifier}")
            tags = list(dict.fromkeys(str(tag) for tag in (live_item.get("tags") or [])))
            controlled = family_tags(tags)
            if any(tag.casefold() != expected_tag.casefold() for tag in controlled):
                raise RuntimeError(
                    f"Item {identifier} has a conflicting family tag: {' | '.join(controlled)}"
                )
            language = member.get("approved_variant_language", "").strip()
            expected_language_tag = f"{LANGUAGE_TAG_PREFIX}{language}"
            controlled_languages = language_tags(tags)
            if any(tag.casefold() != expected_language_tag.casefold() for tag in controlled_languages):
                raise RuntimeError(
                    f"Item {identifier} has a conflicting language tag: {' | '.join(controlled_languages)}"
                )
            missing_tags = [
                tag for tag in (expected_tag, expected_language_tag)
                if not any(existing.casefold() == tag.casefold() for existing in tags)
            ]
            if not missing_tags:
                already_verified += 1
            else:
                pending.append((identifier, tags, missing_tags))

    print(f"Portal: {gis.url}")
    print(f"Signed in as: {gis.users.me.username if gis.users.me else 'anonymous'}")
    print(f"Approved families: {len(families)}")
    print(f"Approved variant items: {len(approved_rows)}")
    print(f"Fully tagged variants: {already_verified}")
    print(f"Variants pending one or more controlled tags: {len(pending)}")
    if not args.apply:
        print("DRY RUN ONLY: no ArcGIS item tags were changed.")
        return 0
    if not gis.users.me:
        raise RuntimeError("An authenticated ArcGIS session is required")
    if args.expected_item_count != len(approved_rows):
        raise RuntimeError(
            f"Expected-item guard is {args.expected_item_count}, but the review has {len(approved_rows)} variants"
        )
    if already_verified + len(pending) != args.expected_item_count:
        raise RuntimeError("Approved, existing and pending family-tag counts do not reconcile")
    if args.max_pending_items < 0:
        raise RuntimeError("--max-pending-items cannot be negative")
    selected_pending = (
        pending[: args.max_pending_items]
        if args.max_pending_items
        else pending
    )

    for index, (identifier, tags, missing_tags) in enumerate(selected_pending, start=1):
        item = gis.content.get(identifier)
        if not item:
            raise RuntimeError(f"ArcGIS item disappeared before update: {identifier}")
        if not item.update(item_properties={"tags": tags + missing_tags}):
            raise RuntimeError(f"ArcGIS rejected the controlled tags for {identifier}")
        if index % 10 == 0 or index == len(selected_pending):
            print(f"Tagged {index}/{len(selected_pending)} items in this wave")

    for attempt in range(1, 7):
        refreshed = group_scoped_items(gis)
        failures: list[str] = []
        verified_count = 0
        for family_id, members in families.items():
            expected_tag = f"{FAMILY_TAG_PREFIX}{family_id}".casefold()
            for member in members:
                identifier = member.get("item_id", "").strip().lower()
                tags = [str(tag) for tag in (refreshed.get(identifier) or {}).get("tags", [])]
                controlled = family_tags(tags)
                expected_language_tag = (
                    f"{LANGUAGE_TAG_PREFIX}{member.get('approved_variant_language', '').strip()}"
                ).casefold()
                controlled_languages = language_tags(tags)
                if (
                    len(controlled) == 1
                    and controlled[0].casefold() == expected_tag
                    and len(controlled_languages) == 1
                    and controlled_languages[0].casefold() == expected_language_tag
                ):
                    verified_count += 1
                elif identifier in {value[0] for value in selected_pending}:
                    failures.append(identifier)
        if not failures and verified_count >= already_verified + len(selected_pending):
            remaining = len(approved_rows) - verified_count
            print(f"SUCCESS: verified exact family and language tags on {verified_count}/{len(approved_rows)} variants.")
            print(f"Remaining approved variants: {remaining}")
            print("Every pre-existing tag was preserved in the update payload.")
            return 0
        if attempt < 6:
            time.sleep(2)
    raise RuntimeError("Family tag verification failed for: " + ", ".join(failures))


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise
