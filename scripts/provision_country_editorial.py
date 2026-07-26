"""Provision the DIEM country-page editorial tables in ArcGIS Online.

Run this script with the ArcGIS Pro Python environment while signed in to the
target ArcGIS Online organization. It creates:

1. A private editable hosted feature service with two non-spatial tables.
2. A public, query-only hosted feature service view used by the web app.
3. Seed country introductions/images from HubCountriesApp.
4. One or two deterministic demo highlights per country from the newest items
   currently assigned to that country in the DIEM country group.

The script never stores credentials. It uses the active ArcGIS Pro sign-in.
Existing editorial rows are preserved; seeding only fills missing countries and
countries that do not yet have any highlight rows.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable

import arcpy
import requests
from arcgis.features import FeatureLayerCollection
from arcgis.gis import GIS, Item


EDITOR_GROUP_ID = "7f5d03df97854f4687c2f9defad01f31"
COUNTRY_GROUP_ID = "c27d3dbba52343c6addfd61edaaa3e86"
LEGACY_COUNTRY_LAYER = (
    "https://services5.arcgis.com/sjP4Ugu5s0dZWLjd/arcgis/rest/services/"
    "HubCountriesApp/FeatureServer/0"
)
DEFAULT_SERVICE_NAME = "DIEM_Hub_3_Country_Editorial"
DEFAULT_VIEW_NAME = "DIEM_Hub_3_Country_Editorial_Public"
COUNTRY_METADATA_PATH = (
    Path(__file__).resolve().parents[1]
    / "node_modules"
    / "@d3-maps"
    / "atlas"
    / "dist"
    / "metadata"
    / "countries.json"
)
DEMO_DESCRIPTION = (
    "A recent DIEM resource selected to demonstrate the country-page curation "
    "layout. Editors can replace this text with a short explanation of why "
    "this evidence matters."
)
DEMO_LEAD = (
    "A recent addition to this country evidence collection, selected to "
    "demonstrate how editors can introduce a featured resource before its card."
)


def string_field(
    name: str,
    alias: str,
    length: int,
    *,
    nullable: bool = True,
    domain: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "name": name,
        "type": "esriFieldTypeString",
        "alias": alias,
        "sqlType": "sqlTypeNVarchar",
        "length": length,
        "nullable": nullable,
        "editable": True,
        "domain": domain,
        "defaultValue": None,
    }


def integer_field(
    name: str,
    alias: str,
    *,
    default: int | None = None,
    domain: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "name": name,
        "type": "esriFieldTypeInteger",
        "alias": alias,
        "sqlType": "sqlTypeInteger",
        "nullable": True,
        "editable": True,
        "domain": domain,
        "defaultValue": default,
    }


def date_field(name: str, alias: str, *, editable: bool = True) -> dict[str, Any]:
    return {
        "name": name,
        "type": "esriFieldTypeDate",
        "alias": alias,
        "sqlType": "sqlTypeTimestamp2",
        "nullable": True,
        "editable": editable,
        "domain": None,
        "defaultValue": None,
    }


def coded_domain(name: str, values: Iterable[tuple[Any, str]]) -> dict[str, Any]:
    return {
        "type": "codedValue",
        "name": name,
        "codedValues": [{"code": code, "name": label} for code, label in values],
    }


PUBLISHED_DOMAIN = coded_domain("Published", [(0, "Draft"), (1, "Published")])
YES_NO_DOMAIN = coded_domain("YesNo", [(0, "No"), (1, "Yes")])
FORMAT_DOMAIN = coded_domain("ContentFormat", [("plain", "Plain text"), ("html", "Safe HTML")])

EDITOR_FIELDS = [
    string_field("created_by", "Created by", 255),
    date_field("created_at", "Created at", editable=False),
    string_field("updated_by", "Updated by", 255),
    date_field("updated_at", "Updated at", editable=False),
]

EDIT_FIELDS_INFO = {
    "creationDateField": "created_at",
    "creatorField": "created_by",
    "editDateField": "updated_at",
    "editorField": "updated_by",
}

EDITOR_TRACKING_INFO = {
    "enableEditorTracking": True,
    "enableOwnershipAccessControl": False,
    "allowOthersToUpdate": True,
    "allowOthersToDelete": True,
}

TABLE_DEFINITIONS = [
    {
        "id": 0,
        "name": "Country page content",
        "type": "Table",
        "displayField": "name",
        "objectIdField": "OBJECTID",
        "fields": [
            {
                "name": "OBJECTID",
                "type": "esriFieldTypeOID",
                "alias": "ObjectID",
                "sqlType": "sqlTypeInteger",
                "nullable": False,
                "editable": False,
                "domain": None,
                "defaultValue": None,
            },
            string_field("iso3", "Country ISO3", 3, nullable=False),
            string_field("name", "Country name", 160),
            string_field("intro_content", "Country introduction", 8000),
            string_field("content_format", "Text format", 12, domain=FORMAT_DOMAIN),
            string_field("hero_image_url", "Hero image URL", 2048),
            string_field("thumbnail_url", "Thumbnail URL", 2048),
            integer_field("published", "Publication status", default=0, domain=PUBLISHED_DOMAIN),
            string_field("review_notes", "Internal review notes", 1000),
            integer_field("is_seeded", "Seeded from legacy layer", default=0, domain=YES_NO_DOMAIN),
            date_field("source_updated_at", "Legacy source updated at"),
            *EDITOR_FIELDS,
        ],
        "indexes": [
            {
                "name": "idx_country_content_iso3",
                "fields": "iso3",
                "isAscending": True,
                "isUnique": True,
                "description": "One editorial profile per ISO3 code",
            }
        ],
        "capabilities": "Create,Delete,Query,Update,Editing",
        "editFieldsInfo": EDIT_FIELDS_INFO,
        "editorTrackingInfo": EDITOR_TRACKING_INFO,
    },
    {
        "id": 1,
        "name": "Country featured items",
        "type": "Table",
        "displayField": "headline",
        "objectIdField": "OBJECTID",
        "fields": [
            {
                "name": "OBJECTID",
                "type": "esriFieldTypeOID",
                "alias": "ObjectID",
                "sqlType": "sqlTypeInteger",
                "nullable": False,
                "editable": False,
                "domain": None,
                "defaultValue": None,
            },
            string_field("iso3", "Country ISO3", 3, nullable=False),
            integer_field("sort_order", "Display order", default=10),
            string_field("item_id", "ArcGIS item ID", 32, nullable=False),
            string_field("lead_content", "Introduction above the card", 4000),
            string_field("lead_format", "Introduction format", 12, domain=FORMAT_DOMAIN),
            string_field("headline", "Editorial headline", 500),
            string_field("description", "Why this item is highlighted", 2000),
            string_field("cta_label", "Link label", 80),
            integer_field("published", "Publication status", default=0, domain=PUBLISHED_DOMAIN),
            integer_field("is_demo", "Demonstration content", default=0, domain=YES_NO_DOMAIN),
            date_field("source_modified", "Resource last modified"),
            *EDITOR_FIELDS,
        ],
        "indexes": [
            {
                "name": "idx_country_highlights_iso3",
                "fields": "iso3",
                "isAscending": True,
                "isUnique": False,
                "description": "Country highlight lookup",
            },
            {
                "name": "idx_country_highlights_item",
                "fields": "item_id",
                "isAscending": True,
                "isUnique": False,
                "description": "Stable ArcGIS item lookup",
            },
        ],
        "capabilities": "Create,Delete,Query,Update,Editing",
        "editFieldsInfo": EDIT_FIELDS_INFO,
        "editorTrackingInfo": EDITOR_TRACKING_INFO,
    },
]


def get_json(url: str, params: dict[str, Any]) -> dict[str, Any]:
    response = requests.get(url, params=params, timeout=60)
    response.raise_for_status()
    payload = response.json()
    if payload.get("error"):
        raise RuntimeError(payload["error"].get("message", "ArcGIS request failed"))
    return payload


def fetch_legacy_profiles() -> dict[str, dict[str, Any]]:
    payload = get_json(
        f"{LEGACY_COUNTRY_LAYER}/query",
        {
            "f": "json",
            "where": "1=1",
            "outFields": "objectid,iso,name,long_description,pic_url,thumb_url",
            "returnGeometry": "false",
            "resultRecordCount": 2000,
        },
    )
    object_ids = [
        str(feature.get("attributes", {}).get("objectid"))
        for feature in payload.get("features", [])
        if feature.get("attributes", {}).get("objectid") is not None
    ]
    attachment_payload = get_json(
        f"{LEGACY_COUNTRY_LAYER}/queryAttachments",
        {
            "f": "json",
            "objectIds": ",".join(object_ids),
            "returnUrl": "true",
        },
    )
    pictures_by_object_id: dict[int, str] = {}
    for group in attachment_payload.get("attachmentGroups", []):
        pictures = [
            attachment
            for attachment in group.get("attachmentInfos", [])
            if str(attachment.get("contentType") or "").lower().startswith("image/")
            and str(attachment.get("name") or "").lower().startswith("picture.")
            and attachment.get("url")
        ]
        if pictures:
            picture = max(pictures, key=lambda attachment: int(attachment.get("size") or 0))
            pictures_by_object_id[int(group["parentObjectId"])] = str(picture["url"])

    profiles: dict[str, dict[str, Any]] = {}
    for feature in payload.get("features", []):
        attributes = feature.get("attributes", {})
        attributes["_picture_url"] = pictures_by_object_id.get(attributes.get("objectid"))
        iso3 = str(attributes.get("iso") or "").strip().upper()
        if re.fullmatch(r"[A-Z]{3}", iso3):
            profiles[iso3] = attributes
    return profiles


def fetch_country_items() -> list[dict[str, Any]]:
    endpoint = (
        "https://www.arcgis.com/sharing/rest/content/groups/"
        f"{COUNTRY_GROUP_ID}/search"
    )
    items: list[dict[str, Any]] = []
    start = 1
    while start != -1:
        payload = get_json(
            endpoint,
            {
                "f": "json",
                "start": start,
                "num": 100,
                "sortField": "modified",
                "sortOrder": "desc",
            },
        )
        items.extend(payload.get("results", []))
        start = int(payload.get("nextStart", -1))
    return items


def country_names() -> dict[str, str]:
    if not COUNTRY_METADATA_PATH.exists():
        return {"XXX": "Cross-country analysis"}
    metadata = json.loads(COUNTRY_METADATA_PATH.read_text(encoding="utf-8"))
    names = {
        str(country.get("isoA3") or country.get("adm0A3") or "").upper(): str(
            country.get("name") or ""
        ).strip()
        for country in metadata
    }
    names["TZN"] = names.get("TZA", "Tanzania")
    names["XXX"] = "Cross-country analysis"
    return names


def item_country_codes(item: dict[str, Any]) -> list[str]:
    prefix = "/categories/countries/"
    result: list[str] = []
    for category in item.get("groupCategories") or []:
        if str(category).lower().startswith(prefix):
            iso3 = str(category)[len(prefix):].strip().upper()
            if re.fullmatch(r"[A-Z]{3}", iso3) and iso3 not in result:
                result.append(iso3)
    return result


def detects_html(value: str) -> bool:
    return bool(re.search(r"</?[a-z][\s\S]*>", value, re.IGNORECASE))


def legacy_image_urls(source: dict[str, Any]) -> tuple[str | None, str | None]:
    picture = str(source.get("_picture_url") or "").strip()
    thumbnail = str(source.get("thumb_url") or "").strip()
    return picture or None, thumbnail or None


def demo_count(iso3: str, available: int) -> int:
    if available <= 1:
        return available
    digest = hashlib.sha256(iso3.encode("ascii")).digest()
    return 1 + (digest[0] % 2)


def batched(values: list[dict[str, Any]], size: int = 200) -> Iterable[list[dict[str, Any]]]:
    for start in range(0, len(values), size):
        yield values[start:start + size]


def ensure_edit_success(result: dict[str, Any], operation: str) -> None:
    failures = [
        entry for key in ("addResults", "updateResults", "deleteResults")
        for entry in result.get(key, [])
        if not entry.get("success")
    ]
    if failures:
        raise RuntimeError(f"{operation} failed: {json.dumps(failures, indent=2)}")


def create_source_service(gis: GIS, service_name: str) -> Item:
    item = gis.content.create_service(
        name=service_name,
        service_type="featureService",
        service_description=(
            "Editor-managed country introductions and curated evidence for DIEM Hub 3.0."
        ),
        has_static_data=False,
        max_record_count=2000,
        supported_query_formats="JSON",
        capabilities="Create,Delete,Query,Update,Editing",
        tags=["DIEM Hub 3.0", "country editorial", "curation", "authoritative configuration"],
        snippet="Editable source tables for DIEM Hub 3.0 country-page curation.",
    )
    collection = FeatureLayerCollection.fromitem(item)
    result = collection.manager.add_to_definition({"tables": TABLE_DEFINITIONS})
    if not result.get("success"):
        raise RuntimeError(f"Could not add editorial tables: {result}")
    item.update(
        {
            "title": "DIEM Hub 3.0 — Country editorial source",
            "description": (
                "<p>Private editable source for country introductions and highlighted "
                "evidence in DIEM Hub 3.0. Share editing only with the designated "
                "country-editor group.</p>"
            ),
            "accessInformation": "FAO Data in Emergencies (DIEM)",
        }
    )
    return item


def create_public_view(source_item: Item, view_name: str) -> Item:
    collection = FeatureLayerCollection.fromitem(source_item)
    view = collection.manager.create_view(
        name=view_name,
        allow_schema_changes=False,
        updateable=False,
        capabilities="Query",
        view_tables=list(collection.tables),
        description=(
            "Public read-only view of published DIEM Hub 3.0 country editorial content."
        ),
        tags="DIEM Hub 3.0,country editorial,public view",
        snippet="Public read-only country introductions and curated evidence.",
    )
    view_item = view.item if hasattr(view, "item") else view
    if not isinstance(view_item, Item):
        raise RuntimeError("ArcGIS did not return an item for the public view")
    view_item.update(
        {
            "title": "DIEM Hub 3.0 — Country editorial (public view)",
            "accessInformation": "FAO Data in Emergencies (DIEM)",
        }
    )
    return view_item


def share_source_with_editors(source_item: Item, group: Any) -> None:
    source_item.sharing.sharing_level = "PRIVATE"
    source_item.sharing.groups.add(group)
    shared_group_ids = {shared.id for shared in source_item.sharing.groups.list()}
    if group.id not in shared_group_ids:
        raise RuntimeError(
            f"Could not share editable source {source_item.id} with group {group.id}"
        )


def share_public_view(view_item: Item, group: Any) -> None:
    view_item.sharing.groups.add(group)
    view_item.sharing.sharing_level = "EVERYONE"
    if str(view_item.sharing.sharing_level).upper().split(".")[-1] != "EVERYONE":
        raise RuntimeError(f"Could not make public view {view_item.id} public")


def allow_view_schema_changes(view_item: Item) -> None:
    collection = FeatureLayerCollection.fromitem(view_item)
    result = collection.manager.update_definition({"sourceSchemaChangesAllowed": True})
    if not result.get("success"):
        raise RuntimeError(f"Could not enable source schema changes on public view: {result}")


def ensure_source_schema(source_item: Item) -> int:
    collection = FeatureLayerCollection.fromitem(source_item)
    if len(collection.tables) != len(TABLE_DEFINITIONS):
        raise RuntimeError("Unexpected editorial source table count")
    added = 0
    for table, definition in zip(collection.tables, TABLE_DEFINITIONS):
        existing = {field["name"].lower() for field in table.properties.fields}
        missing = [
            field for field in definition["fields"]
            if field["name"].lower() not in existing and field["type"] != "esriFieldTypeOID"
        ]
        if missing:
            result = table.manager.add_to_definition({"fields": missing})
            if not result.get("success"):
                raise RuntimeError(f"Could not add fields to {table.properties.name}: {result}")
            added += len(missing)
    return added


def enable_editor_tracking(source_item: Item) -> int:
    collection = FeatureLayerCollection.fromitem(source_item)
    if len(collection.tables) != len(TABLE_DEFINITIONS):
        raise RuntimeError("Unexpected editorial source table count")
    service_result = collection.manager.update_definition(
        {"editorTrackingInfo": EDITOR_TRACKING_INFO}
    )
    if not service_result.get("success"):
        raise RuntimeError(
            f"Could not enable service-level editor tracking: {service_result}"
        )
    enabled = 0
    for table in collection.tables:
        result = table.manager.update_definition(
            {"editFieldsInfo": EDIT_FIELDS_INFO}
        )
        if not result.get("success"):
            raise RuntimeError(
                f"Could not enable editor tracking on {table.properties.name}: {result}"
            )
        enabled += 1
    return enabled


def backfill_editor_dates(source_item: Item) -> int:
    collection = FeatureLayerCollection.fromitem(source_item)
    touched = 0
    for table in collection.tables:
        features = table.query(
            where="updated_at IS NULL",
            out_fields="OBJECTID,published",
            return_geometry=False,
        ).features
        updates = [
            {
                "attributes": {
                    "OBJECTID": feature.attributes["OBJECTID"],
                    "published": feature.attributes.get("published"),
                }
            }
            for feature in features
        ]
        for batch in batched(updates):
            ensure_edit_success(
                table.edit_features(updates=batch),
                f"Editor-date backfill for {table.properties.name}",
            )
            touched += len(batch)
        remaining = table.query(
            where="updated_at IS NULL",
            return_count_only=True,
        )
        if remaining:
            raise RuntimeError(
                f"Editor tracking did not populate updated_at for "
                f"{remaining} rows in {table.properties.name}"
            )
    return touched


def verify_public_view_schema(view_item: Item) -> None:
    collection = FeatureLayerCollection.fromitem(view_item)
    if len(collection.tables) != len(TABLE_DEFINITIONS):
        raise RuntimeError("Unexpected public editorial view table count")
    for table, definition in zip(collection.tables, TABLE_DEFINITIONS):
        available = {field["name"].lower() for field in table.properties.fields}
        required = {field["name"].lower() for field in definition["fields"]}
        missing = sorted(required - available)
        if missing:
            raise RuntimeError(
                f"Public view table {table.properties.name} is missing fields: {missing}"
            )


def expose_public_view_fields(view_item: Item) -> int:
    collection = FeatureLayerCollection.fromitem(view_item)
    changed = 0
    for table, definition in zip(collection.tables, TABLE_DEFINITIONS):
        fields_by_name = {
            str(field["name"]).lower(): field
            for field in table.manager.properties.fields
        }
        hidden = [
            {"name": field["name"], "visible": True}
            for field in definition["fields"]
            if field["name"].lower() in fields_by_name
            and fields_by_name[field["name"].lower()].get("visible") is False
        ]
        if hidden:
            result = table.manager.update_definition({"fields": hidden})
            if not result.get("success"):
                raise RuntimeError(
                    f"Could not expose fields in {table.properties.name}: {result}"
                )
            changed += len(hidden)
    return changed


def seed_tables(source_item: Item) -> tuple[int, int, int, int]:
    collection = FeatureLayerCollection.fromitem(source_item)
    if len(collection.tables) != 2:
        raise RuntimeError("Expected two editorial tables in the source service")
    profile_table, highlight_table = collection.tables

    country_items = fetch_country_items()
    legacy = fetch_legacy_profiles()
    resources_by_iso: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in country_items:
        for iso3 in item_country_codes(item):
            resources_by_iso[iso3].append(item)
    for resources in resources_by_iso.values():
        resources.sort(key=lambda item: int(item.get("modified") or 0), reverse=True)

    country_codes = sorted(resources_by_iso)
    if "TZN" in country_codes and "TZA" in legacy and "TZN" not in legacy:
        legacy["TZN"] = legacy["TZA"]

    existing_profile_features = profile_table.query(
        where="1=1",
        out_fields="OBJECTID,iso3,name,is_seeded,hero_image_url,thumbnail_url",
        return_geometry=False,
    ).features
    existing_profiles = {
        str(feature.attributes.get("iso3") or "").upper()
        for feature in existing_profile_features
    }
    existing_highlight_features = highlight_table.query(
        where="1=1",
        out_fields="OBJECTID,iso3,is_demo,lead_content",
        return_geometry=False,
    ).features
    existing_highlight_countries = {
        str(feature.attributes.get("iso3") or "").upper()
        for feature in existing_highlight_features
    }

    profile_adds: list[dict[str, Any]] = []
    highlight_adds: list[dict[str, Any]] = []
    highlight_repairs: list[dict[str, Any]] = []
    profile_repairs: list[dict[str, Any]] = []
    names_by_iso = country_names()

    for feature in existing_profile_features:
        attributes = feature.attributes
        iso3 = str(attributes.get("iso3") or "").upper()
        current_hero = str(attributes.get("hero_image_url") or "")
        if attributes.get("is_seeded") != 1:
            continue
        repairs: dict[str, Any] = {"OBJECTID": attributes["OBJECTID"]}
        current_name = str(attributes.get("name") or "").strip()
        if (not current_name or current_name == iso3) and names_by_iso.get(iso3):
            repairs["name"] = names_by_iso[iso3]
        if iso3 in legacy:
            hero_image_url, thumbnail_url = legacy_image_urls(legacy[iso3])
            current_thumbnail = str(attributes.get("thumbnail_url") or "")
            if (
                current_hero != (hero_image_url or "")
                and (
                    not current_hero
                    or "/countries/profile/" in current_hero
                    or current_hero == current_thumbnail
                )
            ):
                repairs["hero_image_url"] = hero_image_url
                repairs["thumbnail_url"] = thumbnail_url
        if len(repairs) > 1:
            profile_repairs.append({"attributes": repairs})

    for feature in existing_highlight_features:
        attributes = feature.attributes
        if attributes.get("is_demo") == 1 and not str(attributes.get("lead_content") or "").strip():
            highlight_repairs.append(
                {
                    "attributes": {
                        "OBJECTID": attributes["OBJECTID"],
                        "lead_content": DEMO_LEAD,
                        "lead_format": "plain",
                    }
                }
            )

    for iso3 in country_codes:
        source = legacy.get(iso3, {})
        intro = str(source.get("long_description") or "").strip()
        hero_image_url, thumbnail_url = legacy_image_urls(source)
        if iso3 not in existing_profiles:
            profile_adds.append(
                {
                    "attributes": {
                        "iso3": iso3,
                        "name": str(source.get("name") or names_by_iso.get(iso3) or iso3).strip(),
                        "intro_content": intro,
                        "content_format": "html" if detects_html(intro) else "plain",
                        "hero_image_url": hero_image_url,
                        "thumbnail_url": thumbnail_url,
                        "published": 1 if intro else 0,
                        "review_notes": (
                            "Initial seed from HubCountriesApp. Review before replacing."
                            if source else
                            "No legacy country text was found. Add editorial content before publishing."
                        ),
                        "is_seeded": 1,
                    }
                }
            )

        if iso3 not in existing_highlight_countries:
            resources = resources_by_iso[iso3]
            for order, item in enumerate(
                resources[:demo_count(iso3, len(resources))], start=1
            ):
                highlight_adds.append(
                    {
                        "attributes": {
                            "iso3": iso3,
                            "sort_order": order * 10,
                            "item_id": item["id"],
                            "lead_content": DEMO_LEAD,
                            "lead_format": "plain",
                            "headline": str(item.get("title") or "Featured DIEM resource").strip(),
                            "description": DEMO_DESCRIPTION,
                            "cta_label": "Explore the evidence",
                            "published": 1,
                            "is_demo": 1,
                            "source_modified": item.get("modified"),
                        }
                    }
                )

    for batch in batched(profile_adds):
        ensure_edit_success(profile_table.edit_features(adds=batch), "Profile seed")
    for batch in batched(highlight_adds):
        ensure_edit_success(highlight_table.edit_features(adds=batch), "Highlight seed")
    for batch in batched(profile_repairs):
        ensure_edit_success(profile_table.edit_features(updates=batch), "Seed profile repair")
    for batch in batched(highlight_repairs):
        ensure_edit_success(highlight_table.edit_features(updates=batch), "Demo lead repair")
    return (
        len(profile_adds),
        len(highlight_adds),
        len(profile_repairs),
        len(highlight_repairs),
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--service-name", default=DEFAULT_SERVICE_NAME)
    parser.add_argument("--view-name", default=DEFAULT_VIEW_NAME)
    parser.add_argument(
        "--source-item-id",
        help="Reuse an existing source service instead of creating a new one.",
    )
    parser.add_argument(
        "--view-item-id",
        help="Reuse an existing public view instead of creating a new one.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    active_portal = arcpy.GetActivePortalURL()
    if not arcpy.GetSigninToken():
        raise RuntimeError("ArcGIS Pro is not signed in. Sign in and rerun the script.")

    gis = GIS("pro")
    user = gis.users.me
    group = gis.groups.get(EDITOR_GROUP_ID)
    if not group:
        raise RuntimeError(f"Editor group {EDITOR_GROUP_ID} is unavailable to {user.username}")
    if "updateitemcontrol" not in (getattr(group, "capabilities", None) or []):
        raise RuntimeError(
            "The target editor group is not a shared-update group. "
            "Publishing stopped to avoid creating an unusable editing workflow."
        )

    source_item = gis.content.get(args.source_item_id) if args.source_item_id else None
    if not source_item:
        source_item = create_source_service(gis, args.service_name)
        print(f"Created editable source: {source_item.id}")

    share_source_with_editors(source_item, group)

    view_item = gis.content.get(args.view_item_id) if args.view_item_id else None
    if view_item:
        allow_view_schema_changes(view_item)

    fields_added = ensure_source_schema(source_item)
    tracked_tables = enable_editor_tracking(source_item)
    profiles_added, highlights_added, profiles_repaired, highlight_leads_added = seed_tables(source_item)
    editor_dates_backfilled = backfill_editor_dates(source_item)
    print(
        f"Seeded {profiles_added} country profiles and {highlights_added} demo "
        f"highlights; added {fields_added} schema fields; repaired "
        f"{profiles_repaired} seeded profile rows and {highlight_leads_added} demo leads; "
        f"enabled editor tracking on {tracked_tables} tables and backfilled "
        f"{editor_dates_backfilled} edit dates"
    )

    if not view_item:
        view_item = create_public_view(source_item, args.view_name)
        print(f"Created public read-only view: {view_item.id}")
    share_public_view(view_item, group)
    public_fields_exposed = expose_public_view_fields(view_item)
    verify_public_view_schema(view_item)

    result = {
        "portal": active_portal,
        "owner": user.username,
        "editor_group_id": EDITOR_GROUP_ID,
        "source_item_id": source_item.id,
        "source_service_url": source_item.url,
        "public_view_item_id": view_item.id,
        "public_view_service_url": view_item.url,
        "profiles_added": profiles_added,
        "demo_highlights_added": highlights_added,
        "schema_fields_added": fields_added,
        "public_fields_exposed": public_fields_exposed,
        "seeded_profiles_repaired": profiles_repaired,
        "demo_highlight_leads_added": highlight_leads_added,
        "editor_tracking_tables": tracked_tables,
        "editor_dates_backfilled": editor_dates_backfilled,
    }
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise
