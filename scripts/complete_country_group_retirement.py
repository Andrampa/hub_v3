"""Complete the two additive country assignments needed to retire the legacy group.

The DIEM Hub content group is authoritative. This guarded one-time migration
adds only the reviewed country path for two questionnaire items, preserves all
existing group categories, and verifies the exact read-back. The default run is
read-only; live application requires ``--apply --expected-item-count 2``.
"""

from __future__ import annotations

import argparse
import sys
import time
from typing import Any

from arcgis.gis import GIS


GROUP_ID = "ab8a43038b6347ac93507988f7e2a90b"
EXPECTED_GROUP_TITLE = "FAO Data in Emergencies Hub Content"
ADDITIONS = {
    "f1dab14b858f4d5bb7a86db4c456ed8d": "/Categories/Countries/COD",
    "d157fa8775eb46bea9f6040123086d43": "/Categories/Countries/LBY",
}


def group_scoped_items(gis: GIS) -> dict[str, dict[str, Any]]:
    endpoint = f"{gis._portal.resturl}content/groups/{GROUP_ID}/search"
    items: dict[str, dict[str, Any]] = {}
    start = 1
    while start > 0:
        response = gis._con.get(
            endpoint,
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


def response_succeeded(result: Any) -> bool:
    return result is True or isinstance(result, dict) and bool(result.get("success"))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--expected-item-count", type=int, default=0)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    gis = GIS("home")
    group = gis.groups.get(GROUP_ID)
    if not group or group.title != EXPECTED_GROUP_TITLE:
        raise RuntimeError("The expected DIEM Hub content group was not found")

    live = group_scoped_items(gis)
    pending: list[tuple[str, list[str], str]] = []
    verified = 0
    for identifier, addition in ADDITIONS.items():
        item = live.get(identifier)
        if not item:
            raise RuntimeError(f"Required item is absent from the Hub group: {identifier}")
        categories = list(dict.fromkeys(str(value) for value in item.get("groupCategories") or []))
        if addition in categories:
            verified += 1
        else:
            pending.append((identifier, categories, addition))

    print(f"Portal: {gis.url}")
    print(f"Signed in as: {gis.users.me.username if gis.users.me else 'anonymous'}")
    print(f"Reviewed retirement assignments: {len(ADDITIONS)}")
    print(f"Already verified: {verified}")
    print(f"Pending additions: {len(pending)}")
    for identifier, _, addition in pending:
        print(f"  {identifier}: + {addition}")

    if not args.apply:
        print("DRY RUN ONLY: no ArcGIS group categories were changed.")
        return 0
    if not gis.users.me:
        raise RuntimeError("An authenticated ArcGIS session is required")
    if args.expected_item_count != len(ADDITIONS):
        raise RuntimeError(
            f"Expected-item guard is {args.expected_item_count}, not {len(ADDITIONS)}"
        )

    payload = [
        {identifier: {"categories": categories + [addition]}}
        for identifier, categories, addition in pending
    ]
    if payload:
        results = group.categories.assign_to_items(items=payload)
        if not isinstance(results, list) or len(results) != len(payload):
            raise RuntimeError(f"Unexpected ArcGIS assignment response: {results!r}")
        if not all(response_succeeded(result) for result in results):
            raise RuntimeError(f"ArcGIS rejected an assignment: {results!r}")

    failures: list[str] = []
    for attempt in range(1, 7):
        refreshed = group_scoped_items(gis)
        failures = []
        for identifier, addition in ADDITIONS.items():
            before = set(str(value) for value in live[identifier].get("groupCategories") or [])
            after = set(str(value) for value in refreshed[identifier].get("groupCategories") or [])
            if not before.issubset(after) or addition not in after:
                failures.append(identifier)
        if not failures:
            print("SUCCESS: both additive country assignments are verified.")
            print("Every pre-existing Hub group category was preserved.")
            return 0
        if attempt < 6:
            time.sleep(2)
    raise RuntimeError("Country assignment verification failed for: " + ", ".join(failures))


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise
