"""Audit and safely apply additive DIEM Hub group categories.

Run from ArcGIS Pro's Python environment with an authenticated ``GIS("home")``
session. Three explicit modes are available:

``audit``
    Read the Hub and legacy Countries groups and create a review CSV. No remote
    changes are possible in this mode.
``prepare``
    Add the current editable review columns to an existing CSV without reading
    or changing ArcGIS. A dated local backup is created first.
``preflight``
    Validate every approved row against the live Hub group, item timestamps and
    category schema. No remote changes are possible in this mode.
``reconcile``
    Repair local verification status after an interrupted apply by comparing
    every approved row with exact live group categories. No remote writes.
``apply``
    Apply only rows explicitly marked ``apply``. Live Hub categories must still
    exactly match the audited snapshot. Every existing path is retained, all
    additions must exist in the live schema, the approved count must match the
    configured count, and group-scoped read-back must verify the exact result.

Existing Hub group categories are authoritative. This script never removes or
renames a category. A conflicting proposal is held for editorial review.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import shutil
import sys
import time
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Any, Iterable

if TYPE_CHECKING:
    from arcgis.gis import GIS


HUB_GROUP_ID = "ab8a43038b6347ac93507988f7e2a90b"
EXPECTED_HUB_GROUP_TITLE = "FAO Data in Emergencies Hub Content"
COUNTRY_GROUP_ID = "c27d3dbba52343c6addfd61edaaa3e86"
EXPECTED_COUNTRY_GROUP_TITLE = "Data in Emergencies Hub - Countries"

# Safety configuration. Keep MODE as "audit", "prepare" or "preflight" until
# the review is complete. MODE="apply" requires a positive exact approved count.
MODE = "audit"
OVERWRITE_AUDIT_CSV = "false"
APPLY_EXPECTED_ITEM_COUNT = "0"
APPLY_MAX_ITEMS = "10"
# Optional exact pilot allowlist, separated by ``|``. When nonblank, apply mode
# ignores other approved rows without changing their decisions in the CSV.
APPLY_ITEM_IDS = ""
BATCH_SIZE = "10"
VERIFICATION_ATTEMPTS = "6"
VERIFICATION_DELAY_SECONDS = "2"
OUTPUT_CSV = Path(__file__).resolve().parents[1] / "hub_catalog_category_review.csv"

ROOT = "/Categories"
COUNTRY_BRANCH = f"{ROOT}/Countries"
LEGACY_PRODUCT_BRANCH = f"{ROOT}/Item Type"
SCOPE_BRANCH = f"{ROOT}/Geographic scope"
LANGUAGE_BRANCH = f"{ROOT}/Languages"
PILLAR_BRANCH = f"{ROOT}/DIEM pillars"
MONITORING_PRODUCT_BRANCH = f"{ROOT}/Monitoring products"
CONTENT_ROLE_BRANCH = f"{ROOT}/Content roles"
CATALOG_ROLE_BRANCH = f"{ROOT}/Catalog role"
PRODUCT_BRANCH = f"{ROOT}/Product types"
FAMILY_TAG_PREFIX = "DIEM-FAMILY:"

CATALOG_ROLES = {"Discoverable product", "Supporting component"}
SINGLE_VALUE_BRANCHES = {SCOPE_BRANCH, CATALOG_ROLE_BRANCH}
APPLY_ALLOWED_BRANCHES = {
    COUNTRY_BRANCH,
    SCOPE_BRANCH,
    CATALOG_ROLE_BRANCH,
    PRODUCT_BRANCH,
}

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

REVIEW_FIELDS = [
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
    "detected_language",
    "suggested_product_family_id",
    "suggested_family_members",
    "family_match_method",
    "family_match_confidence",
    "approved_product_family_id",
    "approved_variant_language",
    "is_primary_variant",
    "family_review_notes",
    "suggested_catalog_role",
    "suggested_product_types",
    "confidence",
    "evidence",
    "conflicts",
    "existing_hub_categories",
    "legacy_country_group_categories",
    "proposed_additions",
    "override_additions",
    "approved_catalog_role",
    "approved_product_types",
    "final_expected_categories",
    "missing_schema_paths",
    "audit_signature",
    "existing_categories_preserved",
    "review_decision",
    "editor_notes",
    "verified_group_categories",
    "status",
]

LANGUAGE_CODES = {
    "english": "English",
    "en": "English",
    "french": "French",
    "fr": "French",
    "francais": "French",
    "français": "French",
    "spanish": "Spanish",
    "es": "Spanish",
    "espanol": "Spanish",
    "español": "Spanish",
}
LANGUAGE_MARKER_RE = re.compile(
    r"(?:\s*[-–—:]\s*)?(?:\((en|fr|es)\)|\b(english|french|spanish|fran[cç]ais|espa[nñ]ol)\b)\s*$",
    re.IGNORECASE,
)
ROUND_RE = re.compile(r"\b(?:round|cycle|ronda)\s*[-:]?\s*(\d+)\b", re.IGNORECASE)

SERIES_PATTERNS = {
    "monitoring-brief": re.compile(
        r"\b(?:monitoring\s+brief|bulletin\s+de\s+suivi|note\s+d.?information\s+diem.?suivi)\b",
        re.IGNORECASE,
    ),
    "household-questionnaire": re.compile(
        r"\b(?:household\s+questionnaire|questionnaire\s+(?:des\s+)?m[ée]nages?|cuestionario\s+de\s+hogares?)\b",
        re.IGNORECASE,
    ),
    "presentation": re.compile(
        r"\b(?:monitoring\s+presentation|presentation|pr[ée]sentation|presentaci[oó]n)\b",
        re.IGNORECASE,
    ),
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


@dataclass
class ApplyCandidate:
    record: dict[str, str]
    item_id: str
    original_paths: list[str]
    additions: list[str]
    expected_paths: list[str]
    verified_paths: list[str] = field(default_factory=list)
    status: str = "approved; awaiting assignment"


def configured_boolean(name: str, value: str) -> bool:
    normalized = value.strip().lower()
    if normalized not in {"true", "false"}:
        raise ValueError(f'{name} must be the string "true" or "false"')
    return normalized == "true"


def configured_integer(name: str, value: str) -> int:
    try:
        result = int(value.strip())
    except ValueError as error:
        raise ValueError(f"{name} must be a whole-number string") from error
    if result < 0:
        raise ValueError(f"{name} cannot be negative")
    return result


def review_values(value: str) -> list[str]:
    return list(dict.fromkeys(part.strip() for part in value.split("|") if part.strip()))


def normalized_text(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    ascii_text = "".join(character for character in decomposed if not unicodedata.combining(character))
    return " ".join(re.sub(r"[^a-z0-9]+", " ", ascii_text.casefold()).split())


def language_from_title(title: str) -> str:
    marker = LANGUAGE_MARKER_RE.search(title.strip())
    if marker:
        return LANGUAGE_CODES.get(next(value for value in marker.groups() if value).casefold(), "")
    normalized = normalized_text(title)
    if re.search(r"\b(?:bulletin de suivi|questionnaire des menages|questionnaire menages|analyse des|analyse du|impact des conflits|republique democratique)\b", normalized):
        return "French"
    if re.search(r"\b(?:cuestionario de hogares|analisis regional|evaluacion del impacto|ronda)\b", normalized):
        return "Spanish"
    return ""


def detected_language(record: dict[str, str]) -> str:
    title_language = language_from_title(record.get("title", ""))
    if title_language:
        return title_language
    category_languages = review_values(record.get("existing_languages", ""))
    return category_languages[0] if len(category_languages) == 1 else ""


def normalized_family_title(title: str) -> str:
    without_marker = LANGUAGE_MARKER_RE.sub("", title.strip())
    return normalized_text(without_marker)


def explicit_family_id(record: dict[str, str]) -> str:
    for tag in review_values(record.get("tags", "")):
        if tag.casefold().startswith(FAMILY_TAG_PREFIX.casefold()):
            return tag[len(FAMILY_TAG_PREFIX) :].strip().lower()
    return ""


def standardized_series_key(record: dict[str, str]) -> str:
    title = record.get("title", "")
    round_match = ROUND_RE.search(title)
    if not round_match:
        return ""
    series = next(
        (name for name, pattern in SERIES_PATTERNS.items() if pattern.search(title)),
        "",
    )
    countries = sorted(
        set(
            review_values(record.get("existing_countries", ""))
            or review_values(record.get("legacy_countries", ""))
        )
    )
    if not series or not countries:
        return ""
    return f"{'-'.join(countries)}:{series}:{round_match.group(1)}"


def enrich_family_proposals(records: list[dict[str, str]]) -> None:
    """Add conservative multilingual-family candidates for editorial review.

    Explicit ``DIEM-FAMILY`` tags are authoritative evidence. Exact normalized
    titles and standardized country/series/round keys are suggestions only and
    require at least two detected languages.
    """
    for record in records:
        record["detected_language"] = detected_language(record)
        for field_name in (
            "suggested_product_family_id",
            "suggested_family_members",
            "family_match_method",
            "family_match_confidence",
        ):
            record[field_name] = ""

    assigned: set[str] = set()

    def assign_groups(groups: dict[str, list[dict[str, str]]], method: str, confidence: str) -> None:
        for key, members in groups.items():
            eligible = [member for member in members if member.get("item_id", "").lower() not in assigned]
            languages = {member.get("detected_language", "") for member in eligible if member.get("detected_language", "")}
            if len(eligible) < 2 or (method != "explicit DIEM-FAMILY tag" and len(languages) < 2):
                continue
            canonical = min(
                eligible,
                key=lambda member: (
                    member.get("detected_language", "") != "English",
                    member.get("item_id", "").lower(),
                ),
            )
            family_id = key if method == "explicit DIEM-FAMILY tag" else canonical.get("item_id", "").lower()
            member_summary = " || ".join(
                f"{member.get('item_id', '').lower()} [{member.get('detected_language', '') or 'unknown'}] {member.get('title', '')}"
                for member in sorted(eligible, key=lambda value: value.get("item_id", ""))
            )
            for member in eligible:
                member["suggested_product_family_id"] = family_id
                member["suggested_family_members"] = member_summary
                member["family_match_method"] = method
                member["family_match_confidence"] = confidence
                assigned.add(member.get("item_id", "").lower())

    explicit_groups: dict[str, list[dict[str, str]]] = {}
    for record in records:
        family_id = explicit_family_id(record)
        if family_id:
            explicit_groups.setdefault(family_id, []).append(record)
    assign_groups(explicit_groups, "explicit DIEM-FAMILY tag", "confirmed metadata")

    title_groups: dict[str, list[dict[str, str]]] = {}
    for record in records:
        if record.get("item_id", "").lower() not in assigned:
            key = normalized_family_title(record.get("title", ""))
            if key:
                title_groups.setdefault(key, []).append(record)
    assign_groups(title_groups, "same normalized title", "high review candidate")

    series_groups: dict[str, list[dict[str, str]]] = {}
    for record in records:
        if record.get("item_id", "").lower() not in assigned:
            key = standardized_series_key(record)
            if key:
                series_groups.setdefault(key, []).append(record)
    assign_groups(series_groups, "same country, product series and round", "medium review candidate")


def category_values(paths: list[str], branch: str) -> list[str]:
    prefix = f"{branch}/"
    return list(
        dict.fromkeys(
            path[len(prefix) :].strip()
            for path in paths
            if path.lower().startswith(prefix.lower()) and path[len(prefix) :].strip()
        )
    )


def branch_for_path(path: str) -> str:
    segments = path.split("/")
    return "/".join(segments[:3]) if len(segments) >= 4 else ""


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


def audit_signature(
    item_id: str,
    modified: str,
    existing_paths: list[str],
    proposed_additions: list[str],
) -> str:
    payload = {
        "item_id": item_id.strip().lower(),
        "modified": str(modified).strip(),
        "existing": sorted(set(existing_paths)),
        "proposed": sorted(set(proposed_additions)),
    }
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


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
        legacy_real = [code for code in legacy_countries if code != "XXX"]
        if set(existing_countries) != set(legacy_real):
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


def audit_record(row: AuditRow) -> dict[str, str]:
    item = row.item
    if row.conflicts or row.missing_schema_paths:
        confidence = "review"
    elif row.proposed_additions and row.legacy_countries:
        confidence = "high"
    elif row.suggested_catalog_role or row.suggested_product_types:
        confidence = "medium"
    else:
        confidence = "low"
    identifier = str(item.get("id") or "")
    modified = str(item.get("modified") or "")
    return {
        "item_id": identifier,
        "title": str(item.get("title") or ""),
        "item_type": str(item.get("type") or ""),
        "owner": str(item.get("owner") or ""),
        "modified": modified,
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
        "detected_language": "",
        "suggested_product_family_id": "",
        "suggested_family_members": "",
        "family_match_method": "",
        "family_match_confidence": "",
        "approved_product_family_id": "",
        "approved_variant_language": "",
        "is_primary_variant": "",
        "family_review_notes": "",
        "suggested_catalog_role": row.suggested_catalog_role,
        "suggested_product_types": " | ".join(row.suggested_product_types),
        "confidence": confidence,
        "evidence": " | ".join(row.evidence),
        "conflicts": " | ".join(row.conflicts),
        "existing_hub_categories": " | ".join(row.existing_paths),
        "legacy_country_group_categories": " | ".join(row.legacy_paths),
        "proposed_additions": " | ".join(row.proposed_additions),
        "override_additions": "",
        "approved_catalog_role": "",
        "approved_product_types": "",
        "final_expected_categories": " | ".join(row.final_expected_paths),
        "missing_schema_paths": " | ".join(row.missing_schema_paths),
        "audit_signature": audit_signature(
            identifier, modified, row.existing_paths, row.proposed_additions
        ),
        "existing_categories_preserved": str(
            set(row.existing_paths).issubset(row.final_expected_paths)
        ).lower(),
        "review_decision": "review",
        "editor_notes": "",
        "verified_group_categories": "",
        "status": "audit only; not applied",
    }


def read_review_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    if not path.exists():
        raise RuntimeError(f"Review CSV not found: {path}")
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        fieldnames = list(reader.fieldnames or [])
        rows = [
            {key: str(value or "") for key, value in row.items()}
            for row in reader
        ]
    if not rows:
        raise RuntimeError("Review CSV contains no rows")
    identifiers = [row.get("item_id", "").strip().lower() for row in rows]
    if any(not identifier for identifier in identifiers):
        raise RuntimeError("Every review row must contain an item_id")
    if len(identifiers) != len(set(identifiers)):
        raise RuntimeError("Review CSV contains duplicate item_id values")
    return fieldnames, rows


def write_review_csv(records: list[dict[str, str]], path: Path) -> None:
    temporary = path.with_name(f"{path.stem}.writing{path.suffix}")
    with temporary.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=REVIEW_FIELDS, extrasaction="ignore")
        writer.writeheader()
        for record in records:
            writer.writerow({field: record.get(field, "") for field in REVIEW_FIELDS})
    try:
        temporary.replace(path)
    except PermissionError as error:
        temporary.unlink(missing_ok=True)
        raise RuntimeError(
            f"Cannot replace {path}. Close the CSV in Excel and retry."
        ) from error


def ensure_review_file_replaceable(path: Path) -> None:
    """Prove the review CSV is not locked before any ArcGIS assignment."""
    probe = path.with_name(f"{path.stem}.replace-check{path.suffix}")
    if probe.exists():
        raise RuntimeError(f"Unexpected replace-check file already exists: {probe}")
    try:
        path.replace(probe)
        probe.replace(path)
    except PermissionError as error:
        if probe.exists() and not path.exists():
            probe.replace(path)
        raise RuntimeError(
            f"Cannot safely update {path}. Close the CSV in Excel before applying."
        ) from error


def dated_backup(path: Path, label: str) -> Path:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = path.with_name(f"{path.stem}.{label}.{timestamp}{path.suffix}")
    shutil.copy2(path, backup)
    return backup


def prepare_review_csv(path: Path) -> None:
    _, records = read_review_csv(path)
    for record in records:
        for field_name in REVIEW_FIELDS:
            record.setdefault(field_name, "")
        existing = review_values(record.get("existing_hub_categories", ""))
        proposed = review_values(record.get("proposed_additions", ""))
        record["audit_signature"] = audit_signature(
            record.get("item_id", ""),
            record.get("modified", ""),
            existing,
            proposed,
        )
        record["existing_categories_preserved"] = str(
            set(existing).issubset(existing + proposed)
        ).lower()
        record["review_decision"] = record.get("review_decision", "") or "review"
        record["status"] = record.get("status", "") or "prepared for review"
    enrich_family_proposals(records)
    backup = dated_backup(path, "before-prepare")
    write_review_csv(records, path)
    print(f"Prepared {len(records)} review rows: {path}")
    print(f"Local backup: {backup}")
    print("LOCAL ONLY: no ArcGIS categories were changed.")


def connect_groups() -> tuple[GIS, Any, Any]:
    from arcgis.gis import GIS

    gis = GIS("home")
    if not gis.users.me:
        raise RuntimeError("GIS('home') did not return an authenticated ArcGIS user")
    hub_group = gis.groups.get(HUB_GROUP_ID)
    country_group = gis.groups.get(COUNTRY_GROUP_ID)
    if not hub_group or hub_group.title != EXPECTED_HUB_GROUP_TITLE:
        raise RuntimeError("The expected DIEM Hub content group was not found")
    if not country_group or country_group.title != EXPECTED_COUNTRY_GROUP_TITLE:
        raise RuntimeError("The expected DIEM Countries group was not found")
    return gis, hub_group, country_group


def run_audit(overwrite: bool) -> None:
    if OUTPUT_CSV.exists() and not overwrite:
        raise RuntimeError(
            f"Review CSV already exists: {OUTPUT_CSV}. Preserve it first, then set "
            'OVERWRITE_AUDIT_CSV = "true" for an intentional fresh audit.'
        )
    gis, hub_group, _ = connect_groups()
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
    if OUTPUT_CSV.exists():
        print(f"Local backup: {dated_backup(OUTPUT_CSV, 'before-audit')}")
    records = [audit_record(row) for row in rows]
    enrich_family_proposals(records)
    write_review_csv(records, OUTPUT_CSV)
    print(f"Portal: {gis.url}")
    print(f"Signed in as: {gis.users.me.username}")
    print(f"Hub items audited: {len(rows)}")
    print(f"Items with no existing Hub categories: {sum(not row.existing_paths for row in rows)}")
    print(f"Items with additive proposals: {sum(bool(row.proposed_additions) for row in rows)}")
    print(f"Items requiring conflict review: {sum(bool(row.conflicts) for row in rows)}")
    print(
        "Items with multilingual-family proposals: "
        + str(sum(bool(record["suggested_product_family_id"]) for record in records))
    )
    print(f"Review CSV: {OUTPUT_CSV}")
    print("AUDIT ONLY: no ArcGIS categories were changed.")


def proposed_paths_from_record(record: dict[str, str]) -> list[str]:
    override = record.get("override_additions", "").strip()
    if override.casefold() == "none":
        additions: list[str] = []
    elif override:
        additions = review_values(override)
    else:
        additions = review_values(record.get("proposed_additions", ""))

    approved_role = record.get("approved_catalog_role", "").strip()
    if approved_role:
        if approved_role not in CATALOG_ROLES:
            raise RuntimeError(
                f"Invalid approved catalog role for {record.get('item_id')}: {approved_role}"
            )
        additions.append(f"{CATALOG_ROLE_BRANCH}/{approved_role}")
    for product_type in review_values(record.get("approved_product_types", "")):
        additions.append(f"{PRODUCT_BRANCH}/{product_type}")
    return list(dict.fromkeys(additions))


def validate_additions(
    item_id: str,
    original_paths: list[str],
    additions: list[str],
    schema_paths: set[str],
) -> list[str]:
    invalid_branches = sorted(
        path for path in additions if branch_for_path(path) not in APPLY_ALLOWED_BRANCHES
    )
    if invalid_branches:
        raise RuntimeError(
            f"Approved additions for {item_id} use unmanaged branches: "
            + " | ".join(invalid_branches)
        )
    missing_schema = sorted(path for path in additions if path not in schema_paths)
    if missing_schema:
        raise RuntimeError(
            f"Approved additions for {item_id} are absent from the Hub schema: "
            + " | ".join(missing_schema)
        )
    expected = list(dict.fromkeys(original_paths + additions))
    if not set(original_paths).issubset(expected):
        raise RuntimeError(f"Existing-category preservation failed for {item_id}")
    if len(expected) > 20:
        raise RuntimeError(f"{item_id} would exceed ArcGIS's 20-category limit")
    for branch in SINGLE_VALUE_BRANCHES:
        values = category_values(expected, branch)
        if len(values) > 1:
            raise RuntimeError(
                f"{item_id} would have conflicting {branch} values: " + " | ".join(values)
            )
    return expected


def approved_candidates(
    records: list[dict[str, str]],
    live_items: dict[str, dict[str, Any]],
    schema_paths: set[str],
    selected_ids: set[str] | None = None,
) -> list[ApplyCandidate]:
    allowed_decisions = {"review", "apply", "exclude"}
    candidates: list[ApplyCandidate] = []
    for record in records:
        identifier = record.get("item_id", "").strip().lower()
        decision = record.get("review_decision", "").strip().lower()
        if decision not in allowed_decisions:
            raise RuntimeError(
                f"Invalid review_decision for {identifier}: {decision or '(blank)'}"
            )
        if selected_ids is not None and identifier not in selected_ids:
            continue
        if decision != "apply":
            if selected_ids is not None and identifier in selected_ids:
                raise RuntimeError(
                    f"Selected pilot item is not marked apply: {identifier}"
                )
            continue
        if record.get("status", "").strip().lower() == "verified":
            if selected_ids is not None and identifier in selected_ids:
                raise RuntimeError(
                    f"Selected pilot item is already verified: {identifier}"
                )
            continue
        live_item = live_items.get(identifier)
        if not live_item:
            raise RuntimeError(f"Approved item is no longer in the Hub group: {identifier}")
        original = review_values(record.get("existing_hub_categories", ""))
        proposed = review_values(record.get("proposed_additions", ""))
        expected_signature = audit_signature(
            identifier,
            record.get("modified", ""),
            original,
            proposed,
        )
        if record.get("audit_signature", "").strip() != expected_signature:
            raise RuntimeError(
                f"Audit fields changed without a fresh signature for {identifier}"
            )
        live_paths = list(dict.fromkeys(live_item.get("groupCategories") or []))
        if set(live_paths) != set(original):
            raise RuntimeError(
                f"Live Hub categories changed since audit for {identifier}; rerun the audit"
            )
        if str(live_item.get("modified") or "") != record.get("modified", "").strip():
            raise RuntimeError(
                f"Item metadata changed since audit for {identifier}; rerun the audit"
            )
        if record.get("conflicts", "").strip() and not record.get("editor_notes", "").strip():
            raise RuntimeError(
                f"Conflict row {identifier} needs editor_notes before it can be applied"
            )
        additions = proposed_paths_from_record(record)
        expected = validate_additions(identifier, live_paths, additions, schema_paths)
        if set(expected) == set(live_paths):
            raise RuntimeError(f"Approved row {identifier} contains no new category")
        candidates.append(
            ApplyCandidate(
                record=record,
                item_id=identifier,
                original_paths=live_paths,
                additions=additions,
                expected_paths=expected,
            )
        )
    return candidates


def chunks(values: list[ApplyCandidate], size: int) -> Iterable[list[ApplyCandidate]]:
    for start in range(0, len(values), size):
        yield values[start : start + size]


def response_succeeded(result: Any) -> bool:
    if result is True:
        return True
    return isinstance(result, dict) and bool(result.get("success"))


def apply_batches(group: Any, candidates: list[ApplyCandidate], batch_size: int) -> None:
    for batch_number, batch in enumerate(chunks(candidates, batch_size), start=1):
        payload = [
            {candidate.item_id: {"categories": candidate.expected_paths}}
            for candidate in batch
        ]
        results = group.categories.assign_to_items(items=payload)
        if not isinstance(results, list) or len(results) != len(batch):
            raise RuntimeError(
                f"Unexpected ArcGIS response for batch {batch_number}: {results!r}"
            )
        failures: list[str] = []
        for candidate, result in zip(batch, results):
            if response_succeeded(result):
                candidate.status = "assigned; awaiting verification"
            else:
                candidate.status = f"assignment failed: {result!r}"
                failures.append(candidate.item_id)
        if failures:
            raise RuntimeError(
                f"ArcGIS rejected batch {batch_number}: " + ", ".join(failures)
            )
        print(f"Assigned batch {batch_number}: {len(batch)} items")


def verify_candidates(
    gis: GIS,
    candidates: list[ApplyCandidate],
    attempts: int,
    delay_seconds: int,
) -> None:
    pending = {candidate.item_id for candidate in candidates}
    for attempt in range(1, attempts + 1):
        refreshed = group_scoped_items(gis, HUB_GROUP_ID)
        pending.clear()
        for candidate in candidates:
            item = refreshed.get(candidate.item_id)
            candidate.verified_paths = list(
                dict.fromkeys((item or {}).get("groupCategories") or [])
            )
            exact = set(candidate.verified_paths) == set(candidate.expected_paths)
            preserved = set(candidate.original_paths).issubset(candidate.verified_paths)
            if item and exact and preserved:
                candidate.status = "verified"
            else:
                candidate.status = "verification failed"
                pending.add(candidate.item_id)
        if not pending:
            return
        if attempt < attempts and delay_seconds:
            print(
                f"Verification attempt {attempt} left {len(pending)} pending; "
                f"retrying in {delay_seconds} seconds"
            )
            time.sleep(delay_seconds)
    raise RuntimeError(
        "Verification failed for: " + ", ".join(sorted(pending))
    )


def update_apply_records(candidates: list[ApplyCandidate]) -> None:
    for candidate in candidates:
        candidate.record["final_expected_categories"] = " | ".join(
            candidate.expected_paths
        )
        candidate.record["verified_group_categories"] = " | ".join(
            candidate.verified_paths
        )
        if candidate.verified_paths:
            candidate.record["existing_categories_preserved"] = str(
                set(candidate.original_paths).issubset(candidate.verified_paths)
            ).lower()
        candidate.record["status"] = candidate.status


def run_apply(
    expected_count: int,
    max_items: int,
    batch_size: int,
    attempts: int,
    delay_seconds: int,
    selected_ids: set[str] | None = None,
) -> None:
    if expected_count < 1:
        raise RuntimeError(
            "APPLY_EXPECTED_ITEM_COUNT must be a positive exact count before applying"
        )
    if max_items < 1 or expected_count > max_items:
        raise RuntimeError(
            f"Approved count {expected_count} exceeds APPLY_MAX_ITEMS={max_items}"
        )
    _, records = read_review_csv(OUTPUT_CSV)
    missing_columns = [field for field in REVIEW_FIELDS if field not in records[0]]
    if missing_columns:
        raise RuntimeError(
            "Review CSV needs MODE=prepare before applying; missing: "
            + ", ".join(missing_columns)
        )
    gis, hub_group, _ = connect_groups()
    live_items = group_scoped_items(gis, HUB_GROUP_ID)
    if selected_ids is not None and len(selected_ids) != expected_count:
        raise RuntimeError(
            f"Pilot allowlist contains {len(selected_ids)} unique item IDs, "
            f"but APPLY_EXPECTED_ITEM_COUNT={expected_count}"
        )
    candidates = approved_candidates(
        records,
        live_items,
        set(hub_group.categories.schema_paths),
        selected_ids,
    )
    if len(candidates) != expected_count:
        raise RuntimeError(
            f"APPLY_EXPECTED_ITEM_COUNT={expected_count}, but the CSV has "
            f"{len(candidates)} valid apply rows"
        )
    if not 1 <= batch_size <= 100:
        raise ValueError("BATCH_SIZE must be between 1 and 100")
    if attempts < 1:
        raise ValueError("VERIFICATION_ATTEMPTS must be at least 1")

    backup = dated_backup(OUTPUT_CSV, "before-apply")
    ensure_review_file_replaceable(OUTPUT_CSV)
    print(f"Local backup: {backup}")
    print(f"Approved items: {len(candidates)}; pilot ceiling: {max_items}")

    try:
        apply_batches(hub_group, candidates, batch_size)
        verify_candidates(gis, candidates, attempts, delay_seconds)
    finally:
        update_apply_records(candidates)
        write_review_csv(records, OUTPUT_CSV)
    print(f"SUCCESS: assigned and verified {len(candidates)} items")


def run_preflight() -> None:
    """Validate every approved row against live ArcGIS state without writing."""
    _, records = read_review_csv(OUTPUT_CSV)
    missing_columns = [field for field in REVIEW_FIELDS if field not in records[0]]
    if missing_columns:
        raise RuntimeError(
            "Review CSV needs MODE=prepare before preflight; missing: "
            + ", ".join(missing_columns)
        )
    gis, hub_group, _ = connect_groups()
    live_items = group_scoped_items(gis, HUB_GROUP_ID)
    schema_paths = set(hub_group.categories.schema_paths)
    approved = [
        record
        for record in records
        if record.get("review_decision", "").strip().lower() == "apply"
    ]
    pending_approved = [
        record
        for record in approved
        if record.get("status", "").strip().lower() != "verified"
    ]
    verified_approved = [
        record
        for record in approved
        if record.get("status", "").strip().lower() == "verified"
    ]
    issue_counts: dict[str, int] = {}
    issue_examples: dict[str, list[str]] = {}

    def issue(kind: str, item_id: str, detail: str = "") -> None:
        issue_counts[kind] = issue_counts.get(kind, 0) + 1
        examples = issue_examples.setdefault(kind, [])
        if len(examples) < 10:
            examples.append(f"{item_id}: {detail}" if detail else item_id)

    for record in verified_approved:
        identifier = record.get("item_id", "").strip().lower()
        live_item = live_items.get(identifier)
        verified_paths = review_values(record.get("verified_group_categories", ""))
        live_paths = list(dict.fromkeys((live_item or {}).get("groupCategories") or []))
        if not live_item:
            issue("verified item absent from live Hub group", identifier)
        elif not verified_paths or set(live_paths) != set(verified_paths):
            issue("verified item categories drifted", identifier)

    for record in pending_approved:
        identifier = record.get("item_id", "").strip().lower()
        live_item = live_items.get(identifier)
        original = review_values(record.get("existing_hub_categories", ""))
        proposed = review_values(record.get("proposed_additions", ""))
        expected_signature = audit_signature(
            identifier, record.get("modified", ""), original, proposed
        )
        if record.get("audit_signature", "").strip() != expected_signature:
            issue("audit signature mismatch", identifier)
        if not live_item:
            issue("item absent from live Hub group", identifier)
            continue
        live_paths = list(dict.fromkeys(live_item.get("groupCategories") or []))
        if set(live_paths) != set(original):
            issue("live categories drifted", identifier)
        if str(live_item.get("modified") or "") != record.get("modified", "").strip():
            issue(
                "live item timestamp drifted",
                identifier,
                f"audit={record.get('modified', '').strip()} live={live_item.get('modified')}",
            )
        if record.get("conflicts", "").strip() and not record.get("editor_notes", "").strip():
            issue("conflict missing editor notes", identifier)
        try:
            additions = proposed_paths_from_record(record)
            expected = validate_additions(identifier, live_paths, additions, schema_paths)
            if set(expected) == set(live_paths):
                issue("approved row has no new category", identifier)
        except Exception as error:
            issue("category validation failed", identifier, str(error))

    print(f"Portal: {gis.url}")
    print(f"Signed in as: {gis.users.me.username}")
    print(f"Live Hub items visible: {len(live_items)}")
    print(f"Approved rows checked: {len(approved)}")
    print(f"Pending approved rows: {len(pending_approved)}")
    print(f"Previously verified rows: {len(verified_approved)}")
    if issue_counts:
        print("PREFLIGHT BLOCKED:")
        for kind in sorted(issue_counts):
            print(f"- {kind}: {issue_counts[kind]}")
            for example in issue_examples[kind]:
                print(f"  {example}")
        raise RuntimeError("Live preflight found blocking issues; no ArcGIS changes were made")
    print("PREFLIGHT PASSED: all approved rows match live state and schema")
    print("READ ONLY: no ArcGIS categories were changed.")


def run_reconcile() -> None:
    """Reconcile interrupted application state from exact live categories."""
    _, records = read_review_csv(OUTPUT_CSV)
    gis, hub_group, _ = connect_groups()
    live_items = group_scoped_items(gis, HUB_GROUP_ID)
    schema_paths = set(hub_group.categories.schema_paths)
    reconciled: list[ApplyCandidate] = []
    pending = 0
    unexpected: list[str] = []
    for record in records:
        if record.get("review_decision", "").strip().lower() != "apply":
            continue
        if record.get("status", "").strip().lower() == "verified":
            continue
        identifier = record.get("item_id", "").strip().lower()
        live_item = live_items.get(identifier)
        if not live_item:
            unexpected.append(f"{identifier}: absent from live Hub group")
            continue
        original = review_values(record.get("existing_hub_categories", ""))
        live_paths = list(dict.fromkeys(live_item.get("groupCategories") or []))
        try:
            additions = proposed_paths_from_record(record)
            expected = validate_additions(
                identifier, original, additions, schema_paths
            )
        except Exception as error:
            unexpected.append(f"{identifier}: {error}")
            continue
        if set(live_paths) == set(expected) and set(original).issubset(live_paths):
            reconciled.append(
                ApplyCandidate(
                    record=record,
                    item_id=identifier,
                    original_paths=original,
                    additions=additions,
                    expected_paths=expected,
                    verified_paths=live_paths,
                    status="verified",
                )
            )
        elif set(live_paths) == set(original):
            pending += 1
        else:
            unexpected.append(
                f"{identifier}: live categories are neither audited nor fully expected"
            )
    if unexpected:
        print("RECONCILIATION BLOCKED:")
        for value in unexpected[:20]:
            print(f"- {value}")
        raise RuntimeError(
            f"Found {len(unexpected)} unexpected live category sets; CSV unchanged"
        )
    backup = dated_backup(OUTPUT_CSV, "before-reconcile")
    ensure_review_file_replaceable(OUTPUT_CSV)
    update_apply_records(reconciled)
    write_review_csv(records, OUTPUT_CSV)
    print(f"Portal: {gis.url}")
    print(f"Signed in as: {gis.users.me.username}")
    print(f"Reconciled verified rows: {len(reconciled)}")
    print(f"Still pending rows: {pending}")
    print(f"Local backup: {backup}")
    print("READ ONLY REMOTELY: no ArcGIS categories were changed.")


def main() -> int:
    mode = MODE.strip().lower()
    if mode not in {"audit", "prepare", "preflight", "reconcile", "apply"}:
        raise ValueError(
            'MODE must be "audit", "prepare", "preflight", "reconcile", or "apply"'
        )
    if mode == "prepare":
        prepare_review_csv(OUTPUT_CSV)
        return 0
    if mode == "audit":
        run_audit(configured_boolean("OVERWRITE_AUDIT_CSV", OVERWRITE_AUDIT_CSV))
        return 0
    if mode == "preflight":
        run_preflight()
        return 0
    if mode == "reconcile":
        run_reconcile()
        return 0
    run_apply(
        configured_integer("APPLY_EXPECTED_ITEM_COUNT", APPLY_EXPECTED_ITEM_COUNT),
        configured_integer("APPLY_MAX_ITEMS", APPLY_MAX_ITEMS),
        configured_integer("BATCH_SIZE", BATCH_SIZE),
        configured_integer("VERIFICATION_ATTEMPTS", VERIFICATION_ATTEMPTS),
        configured_integer("VERIFICATION_DELAY_SECONDS", VERIFICATION_DELAY_SECONDS),
        set(identifier.lower() for identifier in review_values(APPLY_ITEM_IDS))
        if APPLY_ITEM_IDS.strip()
        else None,
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise
