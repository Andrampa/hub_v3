"""Provision editor-managed carousel slides and campaigns for DIEM Hub 3.0.

Run with the ArcGIS Pro Python environment while signed in. The script creates
one private editable hosted feature service and separate public, query-only
production and staging views. It never stores credentials.
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any

import arcpy
from arcgis.features import FeatureLayerCollection
from arcgis.gis import GIS, Item


EDITOR_GROUP_ID = "7f5d03df97854f4687c2f9defad01f31"
DEFAULT_SERVICE_NAME = "DIEM_Hub_3_Promotions"
DEFAULT_PROD_VIEW_NAME = "DIEM_Hub_3_Promotions_Production"
DEFAULT_STG_VIEW_NAME = "DIEM_Hub_3_Promotions_Staging"


def string_field(name: str, alias: str, length: int, *, nullable: bool = True) -> dict[str, Any]:
    return {
        "name": name,
        "type": "esriFieldTypeString",
        "alias": alias,
        "sqlType": "sqlTypeNVarchar",
        "length": length,
        "nullable": nullable,
        "editable": True,
        "domain": None,
        "defaultValue": None,
    }


def integer_field(name: str, alias: str, *, default: int | None = None) -> dict[str, Any]:
    return {
        "name": name,
        "type": "esriFieldTypeInteger",
        "alias": alias,
        "sqlType": "sqlTypeInteger",
        "nullable": True,
        "editable": True,
        "domain": None,
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


OID_FIELD = {
    "name": "OBJECTID",
    "type": "esriFieldTypeOID",
    "alias": "ObjectID",
    "sqlType": "sqlTypeInteger",
    "nullable": False,
    "editable": False,
    "domain": None,
    "defaultValue": None,
}

TRACKING_FIELDS = [
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

COMMON_PUBLICATION_FIELDS = [
    string_field("channel", "Publication channel (prod or stg)", 12, nullable=False),
    integer_field("published", "Published (0 or 1)", default=0),
    date_field("start_at", "Start displaying at"),
    date_field("end_at", "Stop displaying at"),
    string_field("review_notes", "Internal review notes", 1000),
]

TABLE_DEFINITIONS = [
    {
        "id": 0,
        "name": "Programme carousel",
        "type": "Table",
        "displayField": "title",
        "objectIdField": "OBJECTID",
        "fields": [
            OID_FIELD,
            string_field("slide_id", "Stable slide ID", 80, nullable=False),
            integer_field("sort_order", "Display order", default=10),
            string_field("eyebrow", "Section label", 120),
            string_field("title", "Title", 300, nullable=False),
            string_field("description", "Description", 2000, nullable=False),
            string_field("image_url", "Public image URL", 2048, nullable=False),
            string_field("image_alt", "Image alternative text", 500),
            string_field("cta_label", "Link label", 100),
            string_field("destination", "Internal path or public URL", 2048),
            *COMMON_PUBLICATION_FIELDS,
            *TRACKING_FIELDS,
        ],
        "indexes": [
            {
                "name": "idx_promotion_slide_id_channel",
                "fields": "slide_id,channel",
                "isAscending": True,
                "isUnique": True,
                "description": "One slide per stable ID and publication channel",
            }
        ],
        "capabilities": "Create,Delete,Query,Update,Editing",
        "editFieldsInfo": EDIT_FIELDS_INFO,
        "editorTrackingInfo": EDITOR_TRACKING_INFO,
    },
    {
        "id": 1,
        "name": "Popup campaigns",
        "type": "Table",
        "displayField": "title",
        "objectIdField": "OBJECTID",
        "fields": [
            OID_FIELD,
            string_field("campaign_id", "Stable campaign ID", 80, nullable=False),
            integer_field("sort_order", "Priority order", default=10),
            string_field("title", "Title", 300, nullable=False),
            string_field("description", "Description", 2000, nullable=False),
            string_field("image_url", "Public image URL", 2048),
            string_field("cta_label", "Link label", 100),
            string_field("destination", "Internal path or public URL", 2048, nullable=False),
            integer_field("dismiss_days", "Days before showing again", default=7),
            *COMMON_PUBLICATION_FIELDS,
            *TRACKING_FIELDS,
        ],
        "indexes": [
            {
                "name": "idx_promotion_campaign_id_channel",
                "fields": "campaign_id,channel",
                "isAscending": True,
                "isUnique": True,
                "description": "One campaign per stable ID and publication channel",
            }
        ],
        "capabilities": "Create,Delete,Query,Update,Editing",
        "editFieldsInfo": EDIT_FIELDS_INFO,
        "editorTrackingInfo": EDITOR_TRACKING_INFO,
    },
]


def create_source(gis: GIS, name: str) -> Item:
    item = gis.content.create_service(
        name=name,
        service_type="featureService",
        service_description="Editor-managed homepage promotions for DIEM Hub 3.0.",
        has_static_data=False,
        max_record_count=500,
        supported_query_formats="JSON",
        capabilities="Create,Delete,Query,Update,Editing",
        tags=["DIEM Hub 3.0", "promotions", "editorial configuration"],
        snippet="Editable carousel slides and popup campaigns for DIEM Hub 3.0.",
    )
    result = FeatureLayerCollection.fromitem(item).manager.add_to_definition(
        {"tables": TABLE_DEFINITIONS}
    )
    if not result.get("success"):
        raise RuntimeError(f"Could not add promotion tables: {result}")
    item.update(
        {
            "title": "DIEM Hub 3.0 — Promotion editorial source",
            "description": (
                "<p>Private editable source for the Hub programme carousel and "
                "featured-update campaigns. Share editing only with the designated "
                "DIEM content-editor group.</p>"
            ),
            "accessInformation": "FAO Data in Emergencies (DIEM)",
        }
    )
    return item


def share_source(source: Item, group: Any) -> None:
    source.sharing.sharing_level = "PRIVATE"
    source.sharing.groups.add(group)
    if group.id not in {shared.id for shared in source.sharing.groups.list()}:
        raise RuntimeError(f"Could not share source {source.id} with editor group")


def create_view(source: Item, name: str, channel: str) -> Item:
    collection = FeatureLayerCollection.fromitem(source)
    view = collection.manager.create_view(
        name=name,
        allow_schema_changes=False,
        updateable=False,
        capabilities="Query",
        view_tables=list(collection.tables),
        description=f"Public read-only {channel} promotion view for DIEM Hub 3.0.",
        tags=f"DIEM Hub 3.0,promotions,{channel},public view",
        snippet=f"Read-only {channel} carousel and popup content.",
    )
    item = view.item if hasattr(view, "item") else view
    if not isinstance(item, Item):
        raise RuntimeError("ArcGIS did not return a view item")
    item.update(
        {
            "title": f"DIEM Hub 3.0 — Promotions ({channel})",
            "accessInformation": "FAO Data in Emergencies (DIEM)",
        }
    )
    view_collection = FeatureLayerCollection.fromitem(item)
    for table in view_collection.tables:
        result = table.manager.update_definition(
            {"viewDefinitionQuery": f"published = 1 AND channel = '{channel}'"}
        )
        if not result.get("success"):
            raise RuntimeError(f"Could not filter {channel} view table {table.properties.id}: {result}")
    item.sharing.sharing_level = "EVERYONE"
    return item


def get_or_create_view(
    gis: GIS,
    source: Item,
    item_id: str | None,
    name: str,
    channel: str,
) -> Item:
    if item_id:
        item = gis.content.get(item_id)
        if not item:
            raise RuntimeError(f"Configured {channel} view {item_id} was not found")
        return item
    return create_view(source, name, channel)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-item-id")
    parser.add_argument("--prod-view-item-id")
    parser.add_argument("--stg-view-item-id")
    parser.add_argument("--service-name", default=DEFAULT_SERVICE_NAME)
    parser.add_argument("--prod-view-name", default=DEFAULT_PROD_VIEW_NAME)
    parser.add_argument("--stg-view-name", default=DEFAULT_STG_VIEW_NAME)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    portal = arcpy.GetActivePortalURL()
    if not portal:
        raise RuntimeError("ArcGIS Pro is not signed in. Sign in and rerun the script.")

    gis = GIS("pro")
    user = gis.users.me
    group = gis.groups.get(EDITOR_GROUP_ID)
    if not group:
        raise RuntimeError(f"Editor group {EDITOR_GROUP_ID} is unavailable to {user.username}")
    if "updateitemcontrol" not in (getattr(group, "capabilities", None) or []):
        raise RuntimeError("The editor group is not a shared-update group")

    source = gis.content.get(args.source_item_id) if args.source_item_id else create_source(
        gis, args.service_name
    )
    if not source:
        raise RuntimeError(f"Source item {args.source_item_id} was not found")
    share_source(source, group)

    prod_view = get_or_create_view(
        gis, source, args.prod_view_item_id, args.prod_view_name, "prod"
    )
    stg_view = get_or_create_view(
        gis, source, args.stg_view_item_id, args.stg_view_name, "stg"
    )

    print(
        json.dumps(
            {
                "portal": portal,
                "owner": user.username,
                "editor_group_id": EDITOR_GROUP_ID,
                "source_item_id": source.id,
                "source_service_url": source.url,
                "prod_view_item_id": prod_view.id,
                "prod_view_service_url": prod_view.url,
                "stg_view_item_id": stg_view.id,
                "stg_view_service_url": stg_view.url,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise
