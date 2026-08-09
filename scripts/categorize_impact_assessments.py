"""Categorize Impact Assessment items in the DIEM Hub ArcGIS group.

Run from PyCharm with the ArcGIS Pro Python environment and an active licensed
portal sign-in. The script uses GIS("home"), targets one exact group ID, creates
a review CSV before writing, assigns group categories in batches, reads every
assignment back, and rewrites the CSV with verification results.

Classification is inferred from live ArcGIS metadata only: title, snippet,
description, tags, item type, culture and URL. It never changes tags or other
item metadata.
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


# ---------------------------------------------------------------------------
# Editable configuration. All operational parameters are strings.
# ---------------------------------------------------------------------------

GROUP_ID = "ab8a43038b6347ac93507988f7e2a90b"
EXPECTED_GROUP_TITLE = "FAO Data in Emergencies Hub Content"
TARGET_TAG = "Impact Assessment"

# "true" produces and validates the CSV without changing ArcGIS.
DRY_RUN = "true"

# "0" means all matching items. Use a positive number for a limited test.
MAX_ITEMS_TO_UPDATE = "0"

# The output is written before assignment and updated after verification.
OUTPUT_CSV = r"C:\git\hub_v3\impact_assessment_category_review.csv"

# ArcGIS accepts at most 100 item-category updates in one request.
BATCH_SIZE = "100"

# Read-back uses the group-scoped search endpoint. Retries cover short ArcGIS
# indexing delays after a successful category update.
VERIFICATION_ATTEMPTS = "6"
VERIFICATION_DELAY_SECONDS = "2"


ROOT = "/Categories"
COUNTRY_BRANCH = f"{ROOT}/Countries"
SHOCK_BRANCH = f"{ROOT}/Shock types"
ROLE_BRANCH = f"{ROOT}/Content roles"
SCOPE_BRANCH = f"{ROOT}/Geographic scope"
LANGUAGE_BRANCH = f"{ROOT}/Languages"
PILLAR_BRANCH = f"{ROOT}/DIEM pillars"

PILLAR_HOUSEHOLD = "Household monitoring system"
PILLAR_HAZARD = "Hazard impact assessment"
PILLAR_RESEARCH = "Research"
PILLAR_RISK = "Risk analysis"


COUNTRY_PATTERNS: dict[str, tuple[str, ...]] = {
    "AFG": (r"\bafghanistan\b",),
    "AGO": (r"\bangola\b",),
    "BDI": (r"\bburundi\b",),
    "BGD": (r"\bbangladesh\b",),
    "BFA": (r"\bburkina faso\b",),
    "BWA": (r"\bbotswana\b",),
    "CAF": (r"\bcentral african republic\b", r"\brepublique centrafricaine\b"),
    "CMR": (r"\bcameroon\b", r"\bcameroun\b"),
    "COD": (
        r"\bdemocratic republic of (?:the )?congo\b",
        r"\brepublique democratique du congo\b",
        r"\b(?:drc|rdc)\b",
        r"\bnord[ -]kivu\b",
        r"\bsud[ -]kivu\b",
        r"\bituri\b",
    ),
    "COG": (
        r"(?<!democratic )\brepublic of (?:the )?congo\b",
        r"(?<!democratique )\brepublique du congo\b",
        r"\bcongo[ -]brazzaville\b",
    ),
    "COL": (r"\bcolombia\b", r"\bcolombie\b", r"\bla mojana\b"),
    "GHA": (r"\bghana\b",),
    "GIN": (r"\bguinea\b", r"\bguinee\b"),
    "GTM": (r"\bguatemala\b",),
    "HTI": (r"\bhaiti\b",),
    "HND": (r"\bhonduras\b",),
    "IRQ": (r"\biraq\b",),
    "LBN": (r"\blebanon\b", r"\bliban\b"),
    "LBR": (r"\bliberia\b",),
    "LBY": (r"\blibya\b", r"\blibye\b", r"\bstorm daniel\b"),
    "LKA": (r"\bsri lanka\b",),
    "MAR": (r"\bmorocco\b", r"\bmaroc\b", r"\bal haouz\b"),
    "MDG": (r"\bmadagascar\b",),
    "MLI": (r"\bmali\b",),
    "MMR": (r"\bmyanmar\b",),
    "MOZ": (r"\bmozambique\b",),
    "MRT": (r"\bmauritania\b", r"\bmauritanie\b"),
    "MWI": (r"\bmalawi\b",),
    "NAM": (r"\bnamibia\b",),
    "NER": (r"\bniger\b",),
    "NGA": (r"\bnigeria\b",),
    "NPL": (r"\bnepal\b",),
    "PAK": (r"\bpakistan\b",),
    "PHL": (r"\bphilippines\b",),
    "SEN": (r"\bsenegal\b",),
    "SLE": (r"\bsierra leone\b",),
    "SLV": (r"\bel salvador\b",),
    "SOM": (r"\bsomalia\b",),
    "SSD": (r"\bsouth sudan\b", r"\bsoudan du sud\b"),
    "SDN": (r"(?<!south )\bsudan\b", r"(?<!du )\bsoudan\b"),
    "SYR": (
        r"\bsyria\b",
        r"\bsyrian arab republic\b",
        r"\brepublique arabe syrienne\b",
    ),
    "TCD": (r"\bchad\b", r"\btchad\b"),
    "TGO": (r"\btogo\b",),
    "TLS": (r"\btimor[ -]leste\b",),
    "TON": (r"\btonga\b",),
    "TUR": (r"\bturkiye\b", r"\bturkey\b"),
    "TZA": (r"\btanzania\b", r"\btanzanie\b"),
    "UKR": (r"\bukraine\b",),
    "VCT": (
        r"\bst\.? vincent(?: and the grenadines)?\b",
        r"\bsaint vincent(?: and the grenadines)?\b",
    ),
    "VEN": (r"\bvenezuela\b",),
    "VNM": (r"\bviet ?nam\b",),
    "YEM": (r"\byemen\b",),
    "ZMB": (r"\bzambia\b",),
    "ZWE": (r"\bzimbabwe\b",),
}


SHOCK_PATTERNS: dict[str, tuple[str, ...]] = {
    "Conflict and displacement": (
        r"\bconflict\w*\b",
        r"\bconflit\w*\b",
        r"\bwar\b",
        r"\bhostilit\w*\b",
        r"\bdisplac\w*\b",
        r"\bdeplac\w*\b",
        r"\bmovilidad humana\b",
        r"\bukraine\b.*\b(?:damages and losses|food security and agricultural livelihoods assessment)\b",
        r"\bsudan\b.*\bsituation overview\b",
    ),
    "Drought and climatic anomaly": (
        r"\bdrought\w*\b",
        r"\bdry spell\w*\b",
        r"\bsequia\w*\b",
        r"\bsecheresse\w*\b",
        r"\bel nino\b",
        r"\bcold wave\b",
        r"\bclimat(?:e|ic) anomal\w*\b",
    ),
    "Earthquake": (r"\bearthquake\w*\b", r"\bseisme\w*\b", r"\bterremoto\w*\b"),
    "Economic shock": (
        r"\brising cost\w*\b",
        r"\bprice shock\w*\b",
        r"\bfood,? feed,? fuel,? fertilizer\b",
    ),
    "Flood": (
        r"\bflood\w*\b",
        r"\binondation\w*\b",
        r"\binundacion\w*\b",
        r"\bcrue\w*\b",
        r"\bheavy rains?\b",
    ),
    "Multiple shocks": (r"\bmultiple shocks?\b", r"\bmulti[ -]hazard\b"),
    "Pest and disease": (
        r"\bpest\w*\b",
        r"\barmyworm\b",
        r"\bfall armyworm\b",
        r"\bafrican swine fever\b",
        r"\blocust\w*\b",
        r"\brodent\w*\b",
        r"\brongeur\w*\b",
        r"\bebola\b",
    ),
    "Tropical cyclone and storm": (
        r"\bcyclone\w*\b",
        r"\btyphoon\w*\b",
        r"\bhurricane\w*\b",
        r"\bstorm\b",
        r"\btempete\w*\b",
    ),
    "Volcanic eruption": (r"\bvolcan\w*\b", r"\beruption\w*\b"),
    "Wildfire": (
        r"\bwildfire\w*\b",
        r"\bforest fire\w*\b",
        r"\bfires?\b",
        r"\bincendio\w*\b",
        r"\bincendie\w*\b",
    ),
}


FRENCH_PATTERNS = (
    r"\banalyse\b",
    r"\binondation\w*\b",
    r"\brepublique\b",
    r"\bconflit\w*\b",
    r"\bmoyens d existence\b",
    r"\bcyclone tropical\b",
)

SPANISH_PATTERNS = (
    r"\bevaluacion\b",
    r"\banalisis\b",
    r"\bincendio\w*\b",
    r"\bsequia\w*\b",
    r"\bmovilidad humana\b",
)


@dataclass
class Classification:
    item: Any
    countries: list[str]
    shocks: list[str]
    roles: list[str]
    scope: str
    language: str
    pillar: str
    confidence: str
    notes: list[str] = field(default_factory=list)
    proposed_paths: list[str] = field(default_factory=list)
    existing_paths: list[str] = field(default_factory=list)
    verified_paths: list[str] = field(default_factory=list)
    status: str = "proposed"


def configured_boolean(name: str, value: str) -> bool:
    normalized = value.strip().lower()
    if normalized not in {"true", "false"}:
        raise ValueError(f'{name} must be the string "true" or "false"')
    return normalized == "true"


def configured_nonnegative_integer(name: str, value: str) -> int:
    try:
        result = int(value.strip())
    except ValueError as error:
        raise ValueError(f"{name} must be a whole number string") from error
    if result < 0:
        raise ValueError(f"{name} cannot be negative")
    return result


def normalize_text(value: Any) -> str:
    raw = html.unescape(str(value or ""))
    without_markup = re.sub(r"<[^>]+>", " ", raw)
    decomposed = unicodedata.normalize("NFKD", without_markup)
    ascii_text = "".join(char for char in decomposed if not unicodedata.combining(char))
    return re.sub(r"\s+", " ", ascii_text).strip().lower()


def metadata_text(item: Any, include_description: bool = True) -> str:
    values = [item.get("title"), item.get("snippet"), " ".join(item.get("tags") or [])]
    if include_description:
        values.append(item.get("description"))
    return normalize_text(" ".join(str(value or "") for value in values))


def matches_any(text: str, patterns: Iterable[str]) -> bool:
    return any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in patterns)


def infer_countries(item: Any) -> list[str]:
    concise_text = metadata_text(item, include_description=False)
    if "monitoring floods in the sahel and central africa" in concise_text:
        if "2024" in concise_text:
            return ["BFA", "CAF", "CMR", "MLI", "NER", "NGA", "TCD"]
        return ["CAF", "CMR", "MLI", "NER", "NGA", "TCD"]
    countries = [
        code for code, patterns in COUNTRY_PATTERNS.items() if matches_any(concise_text, patterns)
    ]
    if countries:
        return countries

    full_text = metadata_text(item, include_description=True)
    return [
        code for code, patterns in COUNTRY_PATTERNS.items() if matches_any(full_text, patterns)
    ]


def infer_shocks(item: Any) -> list[str]:
    concise_text = metadata_text(item, include_description=False)
    shocks = [
        shock for shock, patterns in SHOCK_PATTERNS.items() if matches_any(concise_text, patterns)
    ]
    if shocks:
        return shocks

    full_text = metadata_text(item, include_description=True)
    return [
        shock for shock, patterns in SHOCK_PATTERNS.items() if matches_any(full_text, patterns)
    ]


def infer_language(item: Any) -> str:
    title = normalize_text(item.get("title"))
    url = str(item.get("url") or "").lower().rstrip("/")

    if re.search(r"(?:[._/-]|\b)(?:fr)(?:$|[?#])", url) or matches_any(
        title, FRENCH_PATTERNS
    ):
        return "French"
    if re.search(r"(?:[._/-]|\b)(?:es)(?:$|[?#])", url) or matches_any(
        title, SPANISH_PATTERNS
    ):
        return "Spanish"
    return "English"


def infer_scope(item: Any, countries: list[str]) -> str:
    text = metadata_text(item, include_description=False)
    if matches_any(
        text,
        (
            r"\bregional\b",
            r"\bsahel\b",
            r"\bcentral africa\b",
            r"\bpacific island countries\b",
        ),
    ):
        return "Regional"
    if "cross-country" in text or len(countries) > 1:
        return "Multi-country"
    if len(countries) == 1:
        return "Country"
    return "Global"


def infer_pillar(item: Any) -> str:
    text = metadata_text(item, include_description=False)
    if matches_any(
        text,
        (
            r"\bdiem[ -]monitoring\b",
            r"\bhousehold monitoring\b",
            r"\bagricultural inputs survey\b",
        ),
    ):
        return PILLAR_HOUSEHOLD
    if matches_any(
        text,
        (
            r"\bdiem research\b",
            r"\banalytical report\b",
            r"\bgeospatial applications?\b",
            r"\bresearch and analysis\b",
        ),
    ):
        return PILLAR_RESEARCH
    if matches_any(
        text,
        (r"\brisk analysis\b", r"\brisk profile\b", r"\banticipatory action\b"),
    ):
        return PILLAR_RISK
    return PILLAR_HAZARD


def infer_base_roles(item: Any) -> list[str]:
    item_type = normalize_text(item.get("type"))
    title = normalize_text(item.get("title"))

    if item_type == "storymap":
        return ["StoryMap"]
    if item_type in {"web experience", "dashboard"}:
        return ["Interactive application"]
    if item_type in {"web map", "feature service", "image"}:
        return ["Supporting map or data"]
    if re.search(r"\b(update|mise a jour|actualizacion)\b", title):
        return ["Update"]
    if matches_any(
        title,
        (
            r"\bhighlights?\b",
            r"\babstract\b",
            r"\bsituation overview\b",
            r"\bnote on\b",
        ),
    ):
        return ["Executive summary"]
    return ["Primary assessment"]


def publication_key(item: Any) -> str:
    url = str(item.get("url") or "").lower().rstrip("/")
    match = re.search(r"/(?:handle/[^/]+/|items/)([^/?#]+)", url)
    if not match:
        return ""
    identifier = match.group(1)
    return re.sub(r"(?:en|fr|es)$", "", identifier, flags=re.IGNORECASE)


def year_signature(item: Any) -> tuple[str, ...]:
    return tuple(sorted(set(re.findall(r"\b20\d{2}\b", metadata_text(item, False)))))


def add_translation_roles(classifications: list[Classification]) -> None:
    english_publications = {
        publication_key(classification.item)
        for classification in classifications
        if classification.language == "English" and publication_key(classification.item)
    }
    english_signatures = {
        (
            tuple(classification.countries),
            tuple(classification.shocks),
            year_signature(classification.item),
            normalize_text(classification.item.get("type")),
        )
        for classification in classifications
        if classification.language == "English"
    }

    for classification in classifications:
        if classification.language == "English":
            continue
        key = publication_key(classification.item)
        signature = (
            tuple(classification.countries),
            tuple(classification.shocks),
            year_signature(classification.item),
            normalize_text(classification.item.get("type")),
        )
        if (key and key in english_publications) or signature in english_signatures:
            classification.roles.append("Translation")


def confidence_and_notes(classification: Classification) -> tuple[str, list[str]]:
    notes: list[str] = []
    if not classification.countries:
        notes.append("No country inferred; scope assigned from regional/global wording")
    elif len(classification.countries) > 1:
        notes.append("Multiple countries inferred")
    if not classification.shocks:
        notes.append("No controlled shock type confidently inferred")
    elif len(classification.shocks) > 1:
        notes.append("Multiple shock types inferred")
    if classification.pillar != PILLAR_HAZARD:
        notes.append(f"Pillar exception inferred: {classification.pillar}")
    if "Translation" in classification.roles:
        notes.append("Translation inferred from a matching English publication/event")

    if not classification.countries:
        confidence = "medium"
    elif not classification.shocks and classification.pillar == PILLAR_HAZARD:
        confidence = "medium"
    elif len(classification.countries) > 1 or len(classification.shocks) > 1:
        confidence = "medium"
    else:
        confidence = "high"
    return confidence, notes


def category_paths(classification: Classification) -> list[str]:
    paths = [f"{COUNTRY_BRANCH}/{code}" for code in classification.countries]
    paths.extend(f"{SHOCK_BRANCH}/{shock}" for shock in classification.shocks)
    paths.extend(f"{ROLE_BRANCH}/{role}" for role in classification.roles)
    paths.extend(
        [
            f"{SCOPE_BRANCH}/{classification.scope}",
            f"{LANGUAGE_BRANCH}/{classification.language}",
            f"{PILLAR_BRANCH}/{classification.pillar}",
        ]
    )
    return list(dict.fromkeys(paths))


def classify_items(items: list[Any]) -> list[Classification]:
    classifications: list[Classification] = []
    for item in items:
        countries = infer_countries(item)
        shocks = infer_shocks(item)
        classification = Classification(
            item=item,
            countries=countries,
            shocks=shocks,
            roles=infer_base_roles(item),
            scope=infer_scope(item, countries),
            language=infer_language(item),
            pillar=infer_pillar(item),
            confidence="",
            existing_paths=sorted(item.get("groupCategories") or []),
        )
        classifications.append(classification)

    add_translation_roles(classifications)
    for classification in classifications:
        classification.confidence, classification.notes = confidence_and_notes(
            classification
        )
        classification.proposed_paths = category_paths(classification)
    return classifications


def exact_tag_match(item: Any) -> bool:
    expected = TARGET_TAG.strip().casefold()
    return any(str(tag).strip().casefold() == expected for tag in item.get("tags") or [])


def write_csv(classifications: list[Classification], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "item_id",
        "title",
        "item_type",
        "url",
        "tags",
        "countries",
        "shock_types",
        "content_roles",
        "geographic_scope",
        "language",
        "diem_pillar",
        "confidence",
        "review_notes",
        "existing_group_categories",
        "proposed_group_categories",
        "verified_group_categories",
        "status",
    ]
    with output_path.open("w", encoding="utf-8-sig", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        for classification in classifications:
            item = classification.item
            writer.writerow(
                {
                    "item_id": item.id,
                    "title": item.get("title") or "",
                    "item_type": item.get("type") or "",
                    "url": item.get("url") or "",
                    "tags": " | ".join(item.get("tags") or []),
                    "countries": " | ".join(classification.countries),
                    "shock_types": " | ".join(classification.shocks),
                    "content_roles": " | ".join(classification.roles),
                    "geographic_scope": classification.scope,
                    "language": classification.language,
                    "diem_pillar": classification.pillar,
                    "confidence": classification.confidence,
                    "review_notes": " | ".join(classification.notes),
                    "existing_group_categories": " | ".join(classification.existing_paths),
                    "proposed_group_categories": " | ".join(classification.proposed_paths),
                    "verified_group_categories": " | ".join(classification.verified_paths),
                    "status": classification.status,
                }
            )


def chunks(values: list[Classification], size: int) -> Iterable[list[Classification]]:
    for start in range(0, len(values), size):
        yield values[start : start + size]


def response_succeeded(result: Any) -> bool:
    if result is True:
        return True
    if isinstance(result, dict):
        return bool(result.get("success"))
    return False


def apply_categories(group: Any, classifications: list[Classification], batch_size: int) -> None:
    for batch_number, batch in enumerate(chunks(classifications, batch_size), start=1):
        payload = [
            {classification.item.id: {"categories": classification.proposed_paths}}
            for classification in batch
        ]
        results = group.categories.assign_to_items(items=payload)

        if not isinstance(results, list) or len(results) != len(batch):
            raise RuntimeError(
                f"Unexpected ArcGIS response for batch {batch_number}: {results!r}"
            )
        failures: list[str] = []
        for classification, result in zip(batch, results):
            if response_succeeded(result):
                classification.status = "assigned; awaiting verification"
            else:
                classification.status = f"assignment failed: {result!r}"
                failures.append(classification.item.id)
        if failures:
            raise RuntimeError(
                f"ArcGIS rejected {len(failures)} item(s) in batch {batch_number}: "
                + ", ".join(failures)
            )
        print(f"Assigned batch {batch_number}: {len(batch)} items")


def group_scoped_items(gis: GIS, group_id: str) -> dict[str, dict[str, Any]]:
    """Read groupCategories from the group-specific paginated REST endpoint."""
    url = f"{gis._portal.resturl}content/groups/{group_id}/search"
    start = 1
    items: dict[str, dict[str, Any]] = {}
    while start > 0:
        response = gis._con.get(
            url,
            {
                "f": "json",
                "num": 100,
                "start": start,
            },
        )
        if "error" in response:
            raise RuntimeError(f"Group-scoped verification search failed: {response}")
        for item in response.get("results", []):
            item_id = str(item.get("id") or "")
            if item_id:
                items[item_id] = item
        next_start = int(response.get("nextStart", -1))
        start = next_start if next_start > 0 else -1
    return items


def verify_categories(
    gis: GIS,
    group: Any,
    classifications: list[Classification],
    attempts: int,
    delay_seconds: int,
) -> None:
    pending = {classification.item.id for classification in classifications}

    for attempt in range(1, attempts + 1):
        refreshed = group_scoped_items(gis, group.id)
        pending.clear()
        for classification in classifications:
            refreshed_item = refreshed.get(classification.item.id)
            if not refreshed_item:
                classification.verified_paths = []
                classification.status = "verification failed: item missing from group"
                pending.add(classification.item.id)
                continue

            classification.verified_paths = sorted(
                refreshed_item.get("groupCategories") or []
            )
            if set(classification.verified_paths) == set(
                classification.proposed_paths
            ):
                classification.status = "verified"
            else:
                classification.status = "verification failed: categories differ"
                pending.add(classification.item.id)

        if not pending:
            return
        if attempt < attempts and delay_seconds:
            print(
                f"Verification attempt {attempt} left {len(pending)} item(s) pending; "
                f"retrying in {delay_seconds} seconds"
            )
            time.sleep(delay_seconds)

    raise RuntimeError(
        f"Verification failed for {len(pending)} item(s): "
        + ", ".join(sorted(pending))
    )


def main() -> int:
    dry_run = configured_boolean("DRY_RUN", DRY_RUN)
    max_items = configured_nonnegative_integer(
        "MAX_ITEMS_TO_UPDATE", MAX_ITEMS_TO_UPDATE
    )
    batch_size = configured_nonnegative_integer("BATCH_SIZE", BATCH_SIZE)
    if batch_size < 1 or batch_size > 100:
        raise ValueError("BATCH_SIZE must be between 1 and 100")
    verification_attempts = configured_nonnegative_integer(
        "VERIFICATION_ATTEMPTS", VERIFICATION_ATTEMPTS
    )
    if verification_attempts < 1:
        raise ValueError("VERIFICATION_ATTEMPTS must be at least 1")
    verification_delay = configured_nonnegative_integer(
        "VERIFICATION_DELAY_SECONDS", VERIFICATION_DELAY_SECONDS
    )

    gis = GIS("home")
    if not gis.users.me:
        raise RuntimeError("GIS('home') did not return an authenticated ArcGIS user")

    group = gis.groups.get(GROUP_ID.strip())
    if not group:
        raise RuntimeError(f"Group {GROUP_ID} was not found or is inaccessible")
    if group.title != EXPECTED_GROUP_TITLE.strip():
        raise RuntimeError(
            f'Group title mismatch: expected "{EXPECTED_GROUP_TITLE}", found "{group.title}"'
        )

    all_group_items = group.content(max_items=2000)
    target_items = sorted(
        (item for item in all_group_items if exact_tag_match(item)),
        key=lambda item: ((item.get("title") or "").casefold(), item.id),
    )
    if not target_items:
        raise RuntimeError(
            f'No exact "{TARGET_TAG}" tag matches were found in the target group'
        )
    if max_items:
        target_items = target_items[:max_items]

    classifications = classify_items(target_items)
    schema_paths = set(group.categories.schema_paths)
    missing_paths = sorted(
        {
            path
            for classification in classifications
            for path in classification.proposed_paths
            if path not in schema_paths
        }
    )
    if missing_paths:
        raise RuntimeError(
            "The group schema is missing proposed category paths:\n- "
            + "\n- ".join(missing_paths)
        )
    too_many = [
        classification.item.id
        for classification in classifications
        if len(classification.proposed_paths) > 20
    ]
    if too_many:
        raise RuntimeError(
            "ArcGIS permits at most 20 categories per item; limit exceeded for: "
            + ", ".join(too_many)
        )

    output_path = Path(OUTPUT_CSV)
    write_csv(classifications, output_path)

    print(f"Portal: {gis.url}")
    print(f"Signed in as: {gis.users.me.username}")
    print(f"Target group: {group.title} ({group.id})")
    print(f"Exact tag: {TARGET_TAG}")
    print(f"Items selected: {len(classifications)}")
    print(f"Dry run: {dry_run}")
    print(f"Preflight CSV: {output_path}")
    print(
        "Confidence: "
        + ", ".join(
            f"{level}={sum(c.confidence == level for c in classifications)}"
            for level in ("high", "medium", "low")
        )
    )

    if dry_run:
        for classification in classifications:
            classification.status = "dry run; not applied"
        write_csv(classifications, output_path)
        print("DRY RUN ONLY: no ArcGIS categories were changed.")
        return 0

    apply_categories(group, classifications, batch_size)
    try:
        verify_categories(
            gis,
            group,
            classifications,
            verification_attempts,
            verification_delay,
        )
    finally:
        write_csv(classifications, output_path)
    print(f"SUCCESS: assigned and verified {len(classifications)} items.")
    print(f"Final review CSV: {output_path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise
