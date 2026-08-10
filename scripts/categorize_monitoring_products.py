"""Review and categorize household-monitoring products in the Hub group.

The monitoring feature layer is authoritative for country, round, and its
linked deliverables. Additional candidates must carry an existing Household
monitoring system category or one of the exact controlled tags below. The
script writes a review CSV in dry-run mode by default and never changes tags.

Run with ArcGIS Pro's Python environment and an authenticated GIS("home").
Before applying, create the Monitoring products schema branch, choose the
explicit REVIEW_POLICY, and set DRY_RUN to "false". The "csv" policy requires
one decision per candidate; "approve_all" applies every current candidate.
Existing categories outside the branches managed by this script are preserved.
"""

from __future__ import annotations

import csv
import html
import re
import sys
import time
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

from arcgis.gis import GIS


GROUP_ID = "ab8a43038b6347ac93507988f7e2a90b"
EXPECTED_GROUP_TITLE = "FAO Data in Emergencies Hub Content"
MONITORING_LAYER_URL = (
    "https://services5.arcgis.com/sjP4Ugu5s0dZWLjd/arcgis/rest/services/"
    "OER_Monitoring_System_View/FeatureServer/0/query"
)
DRY_RUN = "false"
REVIEW_POLICY = "approve_all"
APPROVE_ALL_EXPECTED_CANDIDATES = "402"
MAX_ITEMS_TO_UPDATE = "0"
OUTPUT_CSV = r"C:\git\hub_v3\monitoring_product_category_review.csv"
BATCH_SIZE = "100"
VERIFICATION_ATTEMPTS = "6"
VERIFICATION_DELAY_SECONDS = "2"
REVIEW_DECISION_COLUMN = "review_decision"

ROOT = "/Categories"
COUNTRY_BRANCH = f"{ROOT}/Countries"
PRODUCT_BRANCH = f"{ROOT}/Monitoring products"
SCOPE_BRANCH = f"{ROOT}/Geographic scope"
LANGUAGE_BRANCH = f"{ROOT}/Languages"
PILLAR_BRANCH = f"{ROOT}/DIEM pillars"
PILLAR = "Household monitoring system"
MANAGED_BRANCHES = (
    f"{COUNTRY_BRANCH}/",
    f"{PRODUCT_BRANCH}/",
    f"{SCOPE_BRANCH}/",
    f"{LANGUAGE_BRANCH}/",
    f"{PILLAR_BRANCH}/",
)

MONITORING_TAGS = {
    "diem-monitoring",
    "household monitoring",
    "household monitoring system",
    "household survey",
    "household survey questionnaire",
    "household survey report",
}
IMPACT_TAG = "impact assessment"
PRODUCT_TYPES = {
    "Country brief",
    "Findings presentation",
    "Questionnaire",
    "Report",
    "Public dataset",
    "Supporting material",
    "Methodology or guidance",
}
LINK_FIELDS = {
    "country_brief_link": "Country brief",
    "findings_present_link": "Findings presentation",
    "questionn_link": "Questionnaire",
    "report_link": "Report",
}


@dataclass
class RoundLink:
    iso3: str
    country: str
    round: str
    product_type: str


@dataclass
class Classification:
    item: Any
    countries: list[str]
    rounds: list[str]
    product_type: str
    language: str
    scope: str
    confidence: str
    notes: list[str] = field(default_factory=list)
    existing_paths: list[str] = field(default_factory=list)
    proposed_paths: list[str] = field(default_factory=list)
    verified_paths: list[str] = field(default_factory=list)
    review_decision: str = "review"
    override_countries: str = ""
    override_product_type: str = ""
    override_language: str = ""
    override_scope: str = ""
    editor_notes: str = ""
    status: str = "proposed"


def configured_boolean(name: str, value: str) -> bool:
    normalized = value.strip().lower()
    if normalized not in {"true", "false"}:
        raise ValueError(f'{name} must be "true" or "false"')
    return normalized == "true"


def configured_integer(name: str, value: str) -> int:
    try:
        result = int(value.strip())
    except ValueError as error:
        raise ValueError(f"{name} must be a whole number string") from error
    if result < 0:
        raise ValueError(f"{name} cannot be negative")
    return result


def normalized(value: Any) -> str:
    raw = html.unescape(str(value or ""))
    raw = re.sub(r"<[^>]+>", " ", raw)
    decomposed = unicodedata.normalize("NFKD", raw)
    ascii_text = "".join(char for char in decomposed if not unicodedata.combining(char))
    return re.sub(r"\s+", " ", ascii_text).strip().lower()


def item_id(value: Any) -> str:
    match = re.search(r"(?:\bid=|/datasets/|/items/)?([a-f0-9]{32})(?:\b|/)", str(value or ""), re.I)
    return match.group(1).lower() if match else ""


def monitoring_round_links(gis: GIS) -> tuple[dict[str, list[RoundLink]], dict[str, str]]:
    response = gis._con.get(
        MONITORING_LAYER_URL,
        {
            "f": "json",
            "where": "1=1",
            "outFields": ",".join([
                "admin0_isocode", "admin0_name_en", "round", "round_validated",
                *LINK_FIELDS.keys(),
            ]),
            "returnGeometry": "false",
            "resultRecordCount": 2000,
        },
    )
    if "error" in response:
        raise RuntimeError(f"Monitoring service query failed: {response['error']}")
    links: dict[str, list[RoundLink]] = {}
    country_names: dict[str, str] = {}
    for feature in response.get("features", []):
        attributes = feature.get("attributes") or {}
        iso3 = str(attributes.get("admin0_isocode") or "").strip().upper()
        country = str(attributes.get("admin0_name_en") or "").strip()
        round_name = str(attributes.get("round") or "").strip()
        if not iso3 or not country or not round_name:
            continue
        country_names[iso3] = country
        for field_name, product_type in LINK_FIELDS.items():
            linked_id = item_id(attributes.get(field_name))
            if linked_id:
                links.setdefault(linked_id, []).append(
                    RoundLink(iso3, country, round_name, product_type)
                )
    return links, country_names


def category_values(paths: list[str], branch: str) -> list[str]:
    prefix = f"{branch}/".lower()
    return [path[len(prefix):] for path in paths if path.lower().startswith(prefix)]


def exact_monitoring_tag(item: Any) -> bool:
    return any(normalized(tag) in MONITORING_TAGS for tag in item.get("tags") or [])


def exact_impact_tag(item: Any) -> bool:
    return any(normalized(tag) == IMPACT_TAG for tag in item.get("tags") or [])


def inferred_country(item: Any, country_names: dict[str, str]) -> list[str]:
    text = normalized(" ".join([
        str(item.get("title") or ""),
        str(item.get("snippet") or ""),
    ]))
    matches = [iso3 for iso3, name in country_names.items() if re.search(rf"\b{re.escape(normalized(name))}\b", text)]
    return sorted(set(matches))


def inferred_product_type(item: Any) -> str:
    text = normalized(" ".join([
        str(item.get("title") or ""),
        " ".join(item.get("tags") or []),
        str(item.get("type") or ""),
    ]))
    if "questionnaire" in text:
        return "Questionnaire"
    if "country brief" in text:
        return "Country brief"
    if "finding" in text or "presentation" in text:
        return "Findings presentation"
    if any(value in text for value in ("methodolog", "guidance", "manual")):
        return "Methodology or guidance"
    if "report" in text or re.search(r"\bbrief\b", text):
        return "Report"
    if normalized(item.get("type")) in {"feature service", "csv", "microsoft excel", "geojson"}:
        return "Public dataset"
    return "Supporting material"


def inferred_language(item: Any, existing_paths: list[str]) -> str:
    configured = category_values(existing_paths, LANGUAGE_BRANCH)
    if configured:
        return configured[0]
    culture = normalized(item.get("culture"))
    title = normalized(item.get("title"))
    if culture.startswith("fr") or re.search(r"\b(questionnaire menage|resultats|rapport)\b", title):
        return "French"
    if culture.startswith("es") or re.search(r"\b(cuestionario|resultados|informe)\b", title):
        return "Spanish"
    return "English"


def classify(item: Any, links: list[RoundLink], country_names: dict[str, str]) -> Classification:
    existing = sorted(item.get("groupCategories") or [])
    existing_countries = [value.upper() for value in category_values(existing, COUNTRY_BRANCH)]
    countries = sorted(set(link.iso3 for link in links)) or existing_countries or inferred_country(item, country_names)
    linked_types = sorted(set(link.product_type for link in links))
    configured_types = category_values(existing, PRODUCT_BRANCH)
    product_type = linked_types[0] if len(linked_types) == 1 else (configured_types[0] if configured_types else inferred_product_type(item))
    if product_type not in PRODUCT_TYPES:
        raise ValueError(f"Unsupported product type for {item.id}: {product_type}")
    rounds = sorted(set(f"{link.country} — {link.round}" for link in links))
    notes: list[str] = []
    if len(linked_types) > 1:
        notes.append("One item is linked under multiple product types; inferred type requires review")
    if not links:
        notes.append("Not linked from the monitoring round table; inclusion and round require review")
    if not countries:
        notes.append("No country identified")
    confidence = "high" if links and len(linked_types) == 1 else "medium" if countries else "low"
    scope = "Country" if len(countries) == 1 else "Multi-country" if len(countries) > 1 else "Global"
    language = inferred_language(item, existing)
    managed = [path for path in existing if not any(path.lower().startswith(prefix.lower()) for prefix in MANAGED_BRANCHES)]
    proposed = category_paths(managed, countries, product_type, language, scope)
    return Classification(
        item=item,
        countries=countries,
        rounds=rounds,
        product_type=product_type,
        language=language,
        scope=scope,
        confidence=confidence,
        notes=notes,
        existing_paths=existing,
        proposed_paths=proposed,
        review_decision="apply" if confidence == "high" else "review",
    )


def category_paths(
    existing_paths: list[str],
    countries: list[str],
    product_type: str,
    language: str,
    scope: str,
) -> list[str]:
    return list(dict.fromkeys(existing_paths + [f"{COUNTRY_BRANCH}/{code}" for code in countries] + [
        f"{PRODUCT_BRANCH}/{product_type}",
        f"{SCOPE_BRANCH}/{scope}",
        f"{LANGUAGE_BRANCH}/{language}",
        f"{PILLAR_BRANCH}/{PILLAR}",
    ]))


def write_csv(classifications: list[Classification]) -> None:
    path = Path(OUTPUT_CSV)
    fields = [
        "item_id", "title", "item_type", "countries", "survey_rounds",
        "monitoring_product", "language", "geographic_scope", "confidence",
        REVIEW_DECISION_COLUMN, "override_countries", "override_monitoring_product",
        "override_language", "override_geographic_scope", "editor_notes",
        "review_notes", "existing_group_categories", "proposed_group_categories",
        "verified_group_categories", "status",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for value in classifications:
            writer.writerow({
                "item_id": value.item.id,
                "title": value.item.get("title") or "",
                "item_type": value.item.get("type") or "",
                "countries": " | ".join(value.countries),
                "survey_rounds": " | ".join(value.rounds),
                "monitoring_product": value.product_type,
                "language": value.language,
                "geographic_scope": value.scope,
                "confidence": value.confidence,
                REVIEW_DECISION_COLUMN: value.review_decision,
                "override_countries": value.override_countries,
                "override_monitoring_product": value.override_product_type,
                "override_language": value.override_language,
                "override_geographic_scope": value.override_scope,
                "editor_notes": value.editor_notes,
                "review_notes": " | ".join(value.notes),
                "existing_group_categories": " | ".join(value.existing_paths),
                "proposed_group_categories": " | ".join(value.proposed_paths),
                "verified_group_categories": " | ".join(value.verified_paths),
                "status": value.status,
            })
    print(f"Review CSV: {path}")


def review_rows() -> dict[str, dict[str, str]]:
    path = Path(OUTPUT_CSV)
    if not path.exists():
        raise RuntimeError(f"Review CSV is required before applying: {path}")
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames or REVIEW_DECISION_COLUMN not in reader.fieldnames:
            raise RuntimeError(
                f'Add the "{REVIEW_DECISION_COLUMN}" column with the review-preparation '
                "script before applying categories."
            )
        rows = {
            str(row.get("item_id") or "").strip().lower(): {
                key: str(value or "").strip() for key, value in row.items()
            }
            for row in reader
            if str(row.get("item_id") or "").strip()
        }
    if not rows:
        raise RuntimeError("Review CSV contains no item decisions")
    return rows


def review_values(value: str) -> list[str]:
    return [part.strip() for part in value.split("|") if part.strip()]


def apply_review(classifications: list[Classification]) -> tuple[list[Classification], list[str]]:
    rows = review_rows()
    unresolved: list[str] = []
    approved: list[Classification] = []
    current_ids = {value.item.id.lower() for value in classifications}
    missing_rows = sorted(current_ids - set(rows))
    if missing_rows:
        raise RuntimeError(
            "Review CSV is missing current candidates; rerun dry-run before applying: "
            + ", ".join(missing_rows)
        )
    for value in classifications:
        row = rows[value.item.id.lower()]
        decision = row.get(REVIEW_DECISION_COLUMN, "").lower()
        value.review_decision = decision
        value.override_countries = row.get("override_countries", "")
        value.override_product_type = row.get("override_monitoring_product", "")
        value.override_language = row.get("override_language", "")
        value.override_scope = row.get("override_geographic_scope", "")
        value.editor_notes = row.get("editor_notes", "")
        if decision == "exclude":
            value.status = "excluded by review"
            continue
        if decision != "apply":
            unresolved.append(value.item.id)
            value.status = "awaiting review decision"
            continue
        countries = [code.upper() for code in review_values(value.override_countries)] or value.countries
        product_type = value.override_product_type or value.product_type
        language = value.override_language or value.language
        scope = value.override_scope or value.scope
        if product_type not in PRODUCT_TYPES:
            raise RuntimeError(f"Invalid product override for {value.item.id}: {product_type}")
        if language not in {"English", "French", "Spanish", "Other"}:
            raise RuntimeError(f"Invalid language override for {value.item.id}: {language}")
        if scope not in {"Country", "Multi-country", "Regional", "Global"}:
            raise RuntimeError(f"Invalid geographic-scope override for {value.item.id}: {scope}")
        if not countries:
            raise RuntimeError(f"Approved item {value.item.id} needs at least one country")
        value.countries = countries
        value.product_type = product_type
        value.language = language
        value.scope = scope
        managed = [path for path in value.existing_paths if not any(path.lower().startswith(prefix.lower()) for prefix in MANAGED_BRANCHES)]
        value.proposed_paths = category_paths(managed, countries, product_type, language, scope)
        approved.append(value)
    return approved, unresolved


def chunks(values: list[Classification], size: int) -> Iterable[list[Classification]]:
    for start in range(0, len(values), size):
        yield values[start:start + size]


def group_scoped_items(gis: GIS, group_id: str) -> dict[str, dict[str, Any]]:
    url = f"{gis._portal.resturl}content/groups/{group_id}/search"
    start = 1
    items: dict[str, dict[str, Any]] = {}
    while start > 0:
        response = gis._con.get(url, {"f": "json", "num": 100, "start": start})
        if "error" in response:
            raise RuntimeError(f"Group search failed: {response}")
        for item in response.get("results", []):
            if item.get("id"):
                items[str(item["id"]).lower()] = item
        start = int(response.get("nextStart", -1))
    return items


def apply_and_verify(gis: GIS, group: Any, values: list[Classification], batch_size: int, attempts: int, delay: int) -> None:
    for batch in chunks(values, batch_size):
        payload = [{value.item.id: {"categories": value.proposed_paths}} for value in batch]
        results = group.categories.assign_to_items(items=payload)
        if not isinstance(results, list) or len(results) != len(batch) or not all(result is True or result.get("success") for result in results):
            raise RuntimeError(f"ArcGIS category assignment failed: {results!r}")
    pending = {value.item.id.lower() for value in values}
    for attempt in range(attempts):
        refreshed = group_scoped_items(gis, group.id)
        pending.clear()
        for value in values:
            current = refreshed.get(value.item.id.lower(), {})
            value.verified_paths = sorted(current.get("groupCategories") or [])
            if set(value.verified_paths) == set(value.proposed_paths):
                value.status = "verified"
            else:
                value.status = "verification failed"
                pending.add(value.item.id.lower())
        if not pending:
            return
        if attempt + 1 < attempts:
            time.sleep(delay)
    raise RuntimeError("Verification failed for: " + ", ".join(sorted(pending)))


def main() -> int:
    dry_run = configured_boolean("DRY_RUN", DRY_RUN)
    review_policy = REVIEW_POLICY.strip().lower()
    if review_policy not in {"csv", "approve_all"}:
        raise ValueError('REVIEW_POLICY must be either "csv" or "approve_all"')
    limit = configured_integer("MAX_ITEMS_TO_UPDATE", MAX_ITEMS_TO_UPDATE)
    batch_size = configured_integer("BATCH_SIZE", BATCH_SIZE)
    attempts = configured_integer("VERIFICATION_ATTEMPTS", VERIFICATION_ATTEMPTS)
    delay = configured_integer("VERIFICATION_DELAY_SECONDS", VERIFICATION_DELAY_SECONDS)
    if not 1 <= batch_size <= 100 or attempts < 1:
        raise ValueError("BATCH_SIZE must be 1–100 and VERIFICATION_ATTEMPTS at least 1")

    gis = GIS("home")
    if not gis.users.me:
        raise RuntimeError("An authenticated ArcGIS home session is required")
    group = gis.groups.get(GROUP_ID)
    if not group or group.title != EXPECTED_GROUP_TITLE:
        raise RuntimeError("The expected Hub content group was not found")

    round_links, country_names = monitoring_round_links(gis)
    scoped = group_scoped_items(gis, group.id)
    content = {item.id.lower(): item for item in group.content(max_items=2000)}
    candidates = []
    for identifier, item in content.items():
        item["groupCategories"] = scoped.get(identifier, {}).get("groupCategories") or []
        pillar = category_values(item["groupCategories"], PILLAR_BRANCH)
        if (identifier in round_links or exact_monitoring_tag(item) or PILLAR in pillar) and not exact_impact_tag(item):
            candidates.append(item)
    candidates.sort(key=lambda item: (normalized(item.get("title")), item.id))
    if limit:
        candidates = candidates[:limit]
    classifications = [classify(item, round_links.get(item.id.lower(), []), country_names) for item in candidates]

    missing = sorted({path for value in classifications for path in value.proposed_paths if path not in set(group.categories.schema_paths)})
    if missing and not dry_run:
        raise RuntimeError("Group schema is missing category paths:\n- " + "\n- ".join(missing))
    if any(len(value.proposed_paths) > 20 for value in classifications):
        raise RuntimeError("At least one item exceeds ArcGIS's 20-category limit")

    print(f"Candidates: {len(classifications)}; linked to rounds: {sum(bool(value.rounds) for value in classifications)}")
    print("Confidence: " + ", ".join(f"{level}={sum(value.confidence == level for value in classifications)}" for level in ("high", "medium", "low")))
    if dry_run:
        for value in classifications:
            value.status = "dry run; not applied"
        write_csv(classifications)
        if missing:
            print("WARNING: create these category paths before applying:\n- " + "\n- ".join(missing))
        print("DRY RUN ONLY: no ArcGIS categories were changed.")
        return 0

    if review_policy == "approve_all":
        expected_candidates = configured_integer(
            "APPROVE_ALL_EXPECTED_CANDIDATES", APPROVE_ALL_EXPECTED_CANDIDATES
        )
        if len(classifications) != expected_candidates:
            raise RuntimeError(
                "approve_all was authorized for exactly "
                f"{expected_candidates} candidates, but {len(classifications)} were found; "
                "review the changed candidate set before applying"
            )
        # This is an explicit operator decision, not a confidence-based shortcut.
        # Write the complete candidate set before touching ArcGIS so a locked or
        # unwritable CSV fails safely before any remote category assignment.
        approved = classifications
        unresolved: list[str] = []
        for value in classifications:
            value.review_decision = "apply"
            value.status = "approved; awaiting assignment"
        print("Review policy: approve_all (every current candidate is approved)")
        write_csv(classifications)
    else:
        print("Review policy: csv (one explicit decision per candidate)")
        approved, unresolved = apply_review(classifications)
    if unresolved:
        write_csv(classifications)
        raise RuntimeError(
            f"{len(unresolved)} item(s) remain marked review. Set each review_decision to apply or exclude before applying."
        )
    if not approved:
        raise RuntimeError("No items are approved for category assignment")
    missing_after_review = sorted({
        path
        for value in approved
        for path in value.proposed_paths
        if path not in set(group.categories.schema_paths)
    })
    if missing_after_review:
        raise RuntimeError(
            "The approved review overrides use category paths absent from the group schema:\n- "
            + "\n- ".join(missing_after_review)
        )

    try:
        apply_and_verify(gis, group, approved, batch_size, attempts, delay)
    finally:
        write_csv(classifications)
    print(f"SUCCESS: assigned and verified {len(approved)} items; excluded {len(classifications) - len(approved)} items")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise
